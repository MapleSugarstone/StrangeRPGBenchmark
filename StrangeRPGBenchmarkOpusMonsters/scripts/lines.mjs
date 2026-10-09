// Round trip for game text: `export` writes every line to dialogue/lines/*.txt, `import` writes edited lines back
// into the source, and `restore` undoes the last import. See dialogue/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'dialogue');
const LINES = path.join(OUT, 'lines');
const SIDECAR = path.join(OUT, '.export.json');
const BACKUP = path.join(OUT, 'backup');
const CHUNK = Number(process.argv.find(a => a.startsWith('--chunk='))?.slice(8) || 20000);

// Contexts whose strings are always player-facing text, by callee name and argument index.
const TEXT_ARGS = { say: [1], narr: [0], notice: [0], hint: [0], goal: [0], stash: [3] };
const LIST_ARGS = { lines: 1, choose: 0 };
// Property keys whose values are identifiers, assets, or names, never prose.
const DENY_KEYS = new Set(['id', 'name', 'sprite', 'music', 'map', 'to', 'script', 'talk', 'enter', 'img', 'mon', 'kind', 'flag', 'key',
  'style', 'pic', 'bestKey', 'prize', 'area', 'region', 'ai', 'fit', 'basic', 'types', 'moves', 'passives', 'c', 'deck', 'owner', 'type']);
const DENY_CALLS = new Set(['setFlag', 'flag', 'has', 'defScript', 'defMap', 'play', 'sfx', 'giveKey', 'giveNotion', 'giveScale', 'warp', 'link',
  'moveNpc', 'movePlayer', 'face', 'npcAt', 'npc', 'defProp', 'drawProp', 'tannery', 'mon', 'makeMon', 'require', 'import', 'portraitFor', 'rows']);

const rel = f => path.relative(root, f).split(path.sep).join('/');
const read = f => fs.readFileSync(f, 'utf8');

function walkDir(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkDir(p, out); else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Content files in story order: Act 1 chapters, optional areas and halls, then Act 2, then the rest. */
function contentFiles() {
  const all = walkDir(path.join(root, 'src', 'content')).map(rel);
  const rank = f => {
    let m = f.match(/^src\/content\/ch(\d+)\.ts$/);
    if (m) return Number(m[1]);
    if (/areas\d|gyms/.test(f)) return 20 + Number(f.match(/\d+/)?.[0] || 9);
    m = f.match(/act2\/ch(\d+)\.ts$/);
    if (m) return 40 + Number(m[1]);
    return 60;
  };
  return all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
const speciesFiles = () => fs.readdirSync(path.join(root, 'src', 'data')).filter(f => /^species\d*\.ts$/.test(f)).sort().map(f => `src/data/${f}`);

function fnv(s, salt = 0) {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36).padStart(7, '0');
}

const calleeName = e => ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
const isText = n => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n);
const propKey = p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : '';

/** Strings the game compares or looks up by value: speaker names, `name:` values, comparison operands, and lookup keys. */
function protectedTexts() {
  const set = new Set();
  for (const f of walkDir(path.join(root, 'src'))) {
    const sf = ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true);
    const lit = n => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;
    const visit = n => {
      if (ts.isCallExpression(n)) {
        const c = calleeName(n.expression);
        if ((c === 'say' || c === 'lines') && n.arguments[0] && lit(n.arguments[0]) !== null) set.add(lit(n.arguments[0]));
        if ((c === 'includes' || c === 'indexOf') && ts.isPropertyAccessExpression(n.expression)) {
          for (const a of n.arguments) if (lit(a) !== null) set.add(lit(a));
          const recv = n.expression.expression;
          if (ts.isArrayLiteralExpression(recv)) for (const el of recv.elements) if (lit(el) !== null) set.add(lit(el));
        }
      }
      if (ts.isPropertyAssignment(n) && propKey(n) === 'name' && lit(n.initializer) !== null) set.add(lit(n.initializer));
      if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.name)) set.add(n.name.text);
      if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)) {
        for (const s of [n.left, n.right]) if (lit(s) !== null) set.add(lit(s));
      }
      if (ts.isCaseClause(n) && lit(n.expression) !== null) set.add(lit(n.expression));
      if (ts.isElementAccessExpression(n) && lit(n.argumentExpression) !== null) set.add(lit(n.argumentExpression));
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return set;
}

/** Prose-like strings the export left out, with the reason, for dialogue/skipped.txt. */
const skipped = [];

/** One-line helpers such as `const cinch = (line) => say('Cinch', line)`, by name, with the speaker they pass to say. */
const wrappers = {};
function scanWrappers(files) {
  const sayName = body => {
    const call = ts.isCallExpression(body) ? body : ts.isBlock(body) && body.statements.length === 1 && ts.isReturnStatement(body.statements[0]) ? body.statements[0].expression : null;
    return call && ts.isCallExpression(call) && calleeName(call.expression) === 'say' && call.arguments[0] && ts.isStringLiteral(call.arguments[0]) ? call.arguments[0].text : null;
  };
  for (const f of files) {
    const sf = ts.createSourceFile(f, read(path.join(root, f)), ts.ScriptTarget.Latest, true);
    const scan = n => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isArrowFunction(n.initializer)) { const s = sayName(n.initializer.body); if (s) wrappers[n.name.text] = s; }
      if (ts.isFunctionDeclaration(n) && n.name && n.body) { const s = sayName(n.body); if (s) wrappers[n.name.text] = s; }
      ts.forEachChild(n, scan);
    };
    scan(sf);
  }
}

/**
 * How a line can become several text boxes: 'stmt' repeats its `await say(...)` statement, 'array' and 'args' add list
 * items or arguments. Null when it cannot split.
 */
function splitKind(n) {
  const p = n.parent;
  if (ts.isArrayLiteralExpression(p)) return 'array';
  if (!ts.isCallExpression(p)) return null;
  const c = calleeName(p.expression), i = p.arguments.indexOf(n);
  if (c === 'look' && i >= 2) return 'args';
  const spoken = (c === 'say' && i === 1) || ((c === 'narr' || c === 'notice' || c === 'hint') && i === 0) || (wrappers[c] && i === 0);
  return spoken && p.parent && ts.isAwaitExpression(p.parent) && p.parent.parent && ts.isExpressionStatement(p.parent.parent) ? 'stmt' : null;
}

/** Every exportable string in one file, in source order, with a stable id. */
function collect(file, prot) {
  const src = read(path.join(root, file));
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const isData = file.startsWith('src/data/');
  const out = [];
  const seenRaw = new Map();

  const speakerOf = e => {
    if (!e || e.kind === ts.SyntaxKind.NullKeyword) return 'narration';
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isIdentifier(e)) return e.text === 'HERO' ? 'Ouro' : e.text;
    return e.getText(sf);
  };
  const sceneOf = n => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && calleeName(p.expression) === 'defScript' && p.arguments[0] && ts.isStringLiteral(p.arguments[0])) return p.arguments[0].text;
      if (ts.isCallExpression(p) && calleeName(p.expression) === 'defMap' && p.arguments[0] && ts.isObjectLiteralExpression(p.arguments[0])) {
        const idp = p.arguments[0].properties.find(q => ts.isPropertyAssignment(q) && propKey(q) === 'id');
        if (idp && ts.isStringLiteral(idp.initializer)) return `map ${idp.initializer.text}`;
      }
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(sf);
      if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
    }
    return path.basename(file, '.ts');
  };
  const siblingName = obj => {
    const np = obj.properties.find(q => ts.isPropertyAssignment(q) && propKey(q) === 'name');
    return np && ts.isStringLiteral(np.initializer) ? np.initializer.text : null;
  };

  /** Where a string sits: its speaker label, and whether that place always holds player-facing text. */
  const placeOf = node => {
    let child = node, p = node.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isTemplateSpan(p) || ts.isTemplateExpression(p) ||
      (ts.isBinaryExpression(p) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)))) {
      if (ts.isConditionalExpression(p) && child === p.condition) return { deny: true };
      child = p; p = p.parent;
    }
    if (!p) return { deny: true };
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isElementAccessExpression(p)) return { deny: true };
    if (ts.isPropertyAssignment(p)) {
      if (child === p.name) return { deny: true };
      const k = propKey(p);
      if (k === 'entry') return { known: true, who: `Register entry: ${siblingName(p.parent) || '?'}` };
      if (DENY_KEYS.has(k) || isData) return { deny: true };
      return { known: false, who: `? (${k})` };
    }
    if (isData) return { deny: true };
    if (ts.isCallExpression(p)) {
      const c = calleeName(p.expression), i = p.arguments.indexOf(child);
      if (DENY_CALLS.has(c)) return { deny: true };
      if (c === 'say' && i === 0) return { deny: true };
      if (wrappers[c] && i === 0) return { known: true, who: wrappers[c] };
      if (TEXT_ARGS[c]?.includes(i)) return { known: true, who: c === 'say' ? speakerOf(p.arguments[0]) : c === 'stash' ? 'look' : c === 'narr' ? 'narration' : c };
      if (c === 'look' && i >= 2) return { known: true, who: 'look' };
      if (c === 'choose' && i === 2) return { known: true, who: 'choice prompt' };
      return { known: false, who: `? (${c})` };
    }
    if (ts.isArrayLiteralExpression(p)) {
      const q = p.parent;
      if (q && ts.isCallExpression(q)) {
        const c = calleeName(q.expression), i = q.arguments.indexOf(p);
        if (DENY_CALLS.has(c)) return { deny: true };
        if (c in LIST_ARGS && LIST_ARGS[c] === i) return { known: true, who: c === 'choose' ? 'choice' : speakerOf(q.arguments[0]) };
        // Helpers such as tideTalk(id, name, [...]) and hand(id, prev, [...], team, outro, name) pass the speaker as a capitalized plain string.
        const plain = q.arguments.filter(a => a !== p && ts.isStringLiteral(a) && !/[.!?,]$/.test(a.text));
        const named = plain.find(a => /^[A-Z]/.test(a.text));
        const before = plain.filter(a => a.pos < p.pos);
        return { known: false, who: named ? named.text : before.length ? before[before.length - 1].text : `? (${c})` };
      }
      if (q && ts.isPropertyAssignment(q)) {
        const k = propKey(q);
        if (k === 'lines') return { known: true, who: siblingName(q.parent) || '?' };
        if (DENY_KEYS.has(k)) return { deny: true };
        return { known: false, who: `? (${k})` };
      }
      return { known: false, who: '?' };
    }
    return { known: false, who: '?' };
  };

  /** The `name` of the nearest object around a string, for NPC lines and trainer intros. A map's name marks a sign. */
  const nameAbove = n => {
    for (let p = n.parent; p; p = p.parent) if (ts.isObjectLiteralExpression(p)) {
      const s = siblingName(p);
      if (s) return p.properties.some(q => ts.isPropertyAssignment(q) && ['rows', 'warps'].includes(propKey(q))) ? `sign or spot in ${s}` : s;
    }
    return null;
  };
  const SPOKEN_KEYS = /\((lines|intro|defeat|win|lose|after|before|talk|text|line)\)$/;

  const visit = n => {
    if (isText(n)) {
      const raw = src.slice(n.getStart(sf), n.end);
      const k = (seenRaw.get(raw) || 0);
      seenRaw.set(raw, k + 1);
      let text, exprs = [];
      if (ts.isTemplateExpression(n)) {
        text = n.head.text;
        n.templateSpans.forEach((s, i) => {
          const e = s.expression.getText(sf);
          const label = /^[\w.]+$/.test(e) ? e : `#${i + 1}`;
          exprs.push({ label, src: e });
          text += `{${label}}` + s.literal.text;
        });
      } else text = n.text;
      const pl = placeOf(n);
      if (!pl.deny && (pl.who === '?' || pl.who.startsWith('? ('))) {
        const nm = nameAbove(n);
        if (nm) pl.who = SPOKEN_KEYS.test(pl.who) || pl.who === '?' ? nm : `${nm} ${pl.who.slice(2)}`;
      }
      const plain = text.replace(/\{[^}]*\}/g, '');
      const prose = plain.length >= 12 && /[a-z] [a-z]/i.test(plain) && /[.!?,]/.test(plain);
      const why = pl.deny ? 'not text' : text.includes('\n') ? 'multi-line' : prot.has(text) ? 'protected' : !/[a-z]/.test(plain) ? 'no lowercase (label)'
        : pl.known ? (plain.trim().length ? '' : 'empty') : prose ? '' : 'not prose';
      if (!why) out.push({ file, raw, n: k, text, exprs, quote: raw[0], who: pl.who, scene: sceneOf(n), split: splitKind(n) });
      else if (plain.length >= 12 && /[a-z] [a-z]/i.test(plain)) skipped.push(`${why}\t${file}\t${text}`);
      if (ts.isTemplateExpression(n)) for (const s of n.templateSpans) visit(s.expression);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function idsFor(items) {
  const used = new Map();
  for (const it of items) {
    let id = fnv(`${it.file}\0${it.raw}\0${it.n}`), salt = 1;
    while (used.has(id)) id = fnv(`${it.file}\0${it.raw}\0${it.n}`, salt++);
    used.set(id, it);
    it.id = id;
  }
}

function exportAll() {
  const prot = protectedTexts();
  const files = [...contentFiles(), ...speciesFiles()];
  scanWrappers(contentFiles());
  const items = files.flatMap(f => collect(f, prot));
  idsFor(items);
  fs.mkdirSync(LINES, { recursive: true });
  for (const f of fs.readdirSync(LINES)) if (f.endsWith('.txt')) fs.unlinkSync(path.join(LINES, f));

  // Chunks: consecutive lines of one file, split at scene changes once a chunk passes the size limit.
  const chunks = [];
  let cur = null;
  for (const it of items) {
    const line = `[${it.id}] ${it.who} | ${it.text}`;
    if (!cur || cur.file !== it.file || (cur.size > CHUNK && cur.scene !== it.scene)) {
      cur = { file: it.file, lines: [], size: 0, scene: null };
      chunks.push(cur);
    }
    if (cur.scene !== it.scene) { cur.lines.push('', `== scene: ${it.scene}`); cur.scene = it.scene; }
    cur.lines.push(line);
    cur.size += line.length + 1;
  }
  // Small neighbors from different files share a chunk so the count stays low.
  const merged = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && last.size + c.size < CHUNK && !last.file.startsWith('src/data') === !c.file.startsWith('src/data')) {
      last.lines.push('', `==== file: ${c.file}`, ...c.lines); last.size += c.size; last.files.push(c.file);
    } else merged.push({ ...c, files: [c.file], lines: [`==== file: ${c.file}`, ...c.lines] });
  }
  merged.forEach((c, i) => {
    const counts = new Map();
    for (const l of c.lines) { const m = l.match(/^\[\w+\] (.*?) \| /); if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1); }
    const who = [...counts].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} (${n})`).join(', ');
    const name = `${String(i + 1).padStart(3, '0')}-${path.basename(c.files[0], '.ts')}.txt`;
    const head = [
      `# WHORL game text, chunk ${i + 1} of ${merged.length}. Files: ${c.files.join(', ')}`,
      `# Speakers: ${who}`,
      '# Rewrite only the text after " | ". Keep each [id] and speaker as they are. One line in, one line out.',
      '# Keep every {placeholder} and every number. Stay under 100 characters per box. " // " splits a line into more boxes.',
      '# See dialogue/README.md, dialogue/style.md, and dialogue/cast.md.',
    ];
    fs.writeFileSync(path.join(LINES, name), [...head, ...c.lines, ''].join('\n'));
  });

  const sidecar = { created: new Date().toISOString(), files: {}, lines: {} };
  for (const f of files) sidecar.files[f] = fnv(read(path.join(root, f)));
  for (const it of items) sidecar.lines[it.id] = { file: it.file, raw: it.raw, n: it.n, text: it.text, exprs: it.exprs, quote: it.quote, who: it.who, split: it.split };
  fs.writeFileSync(SIDECAR, JSON.stringify(sidecar));

  const speakers = new Map();
  for (const it of items) speakers.set(it.who, (speakers.get(it.who) || 0) + 1);
  fs.writeFileSync(path.join(OUT, 'speakers.txt'), [...speakers].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n}\t${w}`).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'skipped.txt'), skipped.sort().join('\n') + '\n');
  const chars = items.reduce((s, it) => s + it.text.length, 0);
  console.log(`Exported ${items.length} lines (${chars} characters) from ${files.length} files into ${merged.length} chunks in dialogue/lines.`);
  console.log(`${prot.size} protected strings (names, compared values) were left out. Speaker counts: dialogue/speakers.txt.`);
}

/** The validator's rules for content text, read from src/tools/test.ts so the two never disagree. */
function validatorRules() {
  const t = read(path.join(root, 'src', 'tools', 'test.ts'));
  const m = t.match(/const banned = (\[.*\]);/);
  return { banned: m ? new Function(`return ${m[1]}`)() : [] };
}

function quoteAs(text, q, exprs) {
  if (q === '`') {
    let s = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    for (const e of exprs) s = s.split(`{${e.label}}`).join(`\${${e.src}}`);
    return '`' + s + '`';
  }
  return q + text.replace(/\\/g, '\\\\').split(q).join('\\' + q) + q;
}

function importAll() {
  if (!fs.existsSync(SIDECAR)) { console.log('No export found. Run `node scripts/lines.mjs export` first.'); process.exitCode = 1; return; }
  const dry = process.argv.includes('--dry');
  const side = JSON.parse(read(SIDECAR));
  const { banned } = validatorRules();
  const glossary = new Set(Object.values(side.lines).map(l => l.who).filter(w => /^[A-Z]/.test(w) && !w.includes(':')));

  const edits = new Map();
  for (const f of fs.readdirSync(LINES).filter(f => f.endsWith('.txt')).sort()) {
    for (const line of read(path.join(LINES, f)).split(/\r?\n/)) {
      const m = line.match(/^\s*(?:[-*]\s+)?\[([0-9a-z]{7})\][^|]*\|\s?(.*)$/);
      if (m) edits.set(m[1], { text: m[2], chunk: f });
    }
  }

  const rejected = [], warnings = [], byFile = new Map();
  let changed = 0, same = 0;
  for (const [id, l] of Object.entries(side.lines)) {
    const e = edits.get(id);
    if (!e) continue;
    const lead = l.text.match(/^\s*/)[0], trail = l.text.match(/\s*$/)[0];
    const text = lead + e.text.trim() + trail;
    if (text === l.text) { same++; continue; }
    const why = [];
    const labels = l.exprs.map(x => `{${x.label}}`);
    const found = text.match(/\{[^}]*\}/g) || [];
    const count = (list, lb) => list.filter(x => x === lb).length;
    if (found.length !== labels.length || labels.some(lb => count(found, lb) !== count(labels, lb))) why.push(`placeholders must be exactly ${labels.join(' ') || 'none'}`);
    if (/[{}]/.test(text.replace(/\{[^}]*\}/g, ''))) why.push('stray brace');
    const nums = s => (s.replace(/\{[^}]*\}/g, '').match(/\d+/g) || []).sort().join(',');
    if (nums(text) !== nums(l.text)) why.push(`numbers changed (${nums(l.text) || 'none'} to ${nums(text) || 'none'})`);
    if (!text.trim()) why.push('empty');
    const parts = text.includes(' // ') ? text.split(' // ').map(s => s.trim()) : [text];
    if (parts.length > 1 && !l.split) why.push('this line cannot become several boxes, so remove " // "');
    if (parts.length > 1 && parts.some(s => !s)) why.push('empty box');
    if (parts.length > 1 && /\{#/.test(text)) why.push('a line with {#n} placeholders cannot split');
    const content = l.file.startsWith('src/content/');
    const limit = content ? 100 : Math.max(l.text.length, 140);
    for (const s of parts) if (s.replace(/\{[^}]*\}/g, 'xxxxxxxx').length > limit) why.push(`a box is over ${limit} characters: "${s.slice(0, 40)}..."`);
    if (content) {
      for (const b of banned) if (b.test(text)) why.push(`validator bans ${b}`);
      if (/;/.test(text) && !/[{}()=]/.test(text)) why.push('validator bans semicolons in text');
    }
    if (why.length) { rejected.push({ id, chunk: e.chunk, text, why }); continue; }
    for (const g of glossary) if (l.text.includes(g) && !text.includes(g)) warnings.push(`[${id}] dropped the name "${g}": ${text}`);
    if (!byFile.has(l.file)) byFile.set(l.file, []);
    byFile.get(l.file).push({ ...l, id, newText: text });
    changed++;
  }

  // Find every edited literal again in the current source by its raw text and occurrence number, then splice from the end.
  const stale = [];
  const writes = [];
  for (const [file, list] of byFile) {
    const full = path.join(root, file);
    const src = read(full);
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    const spots = new Map(), seen = new Map();
    const visit = n => {
      if (isText(n)) {
        const raw = src.slice(n.getStart(sf), n.end), k = seen.get(raw) || 0;
        seen.set(raw, k + 1);
        spots.set(`${raw}\0${k}`, n);
        if (ts.isTemplateExpression(n)) for (const s of n.templateSpans) visit(s.expression);
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    const reps = [];
    for (const l of list) {
      const node = spots.get(`${l.raw}\0${l.n}`);
      if (!node) { stale.push(`[${l.id}] ${file}: the original line is no longer in the source`); continue; }
      const at = [node.getStart(sf), node.end];
      const parts = l.newText.includes(' // ') ? l.newText.split(' // ').map(s => s.trim()) : [l.newText];
      if (parts.length === 1) { reps.push({ at, rep: quoteAs(l.newText, l.quote, l.exprs) }); continue; }
      const lits = parts.map(s => quoteAs(s, /\{[^#][^}]*\}/.test(s) ? l.quote : l.quote === '`' ? "'" : l.quote, l.exprs));
      if (l.split !== 'stmt') { reps.push({ at, rep: lits.join(', ') }); continue; }
      // Repeat the whole `await say(...)` statement once per box, in braces when it is the body of an if or a loop.
      const stmt = node.parent.parent.parent;
      const s0 = stmt.getStart(sf), text = src.slice(s0, stmt.end);
      const a = at[0] - s0, b = at[1] - s0;
      const lineStart = src.lastIndexOf('\n', s0) + 1;
      const indent = src.slice(lineStart, s0).match(/^\s*/)[0];
      const copies = lits.map(q => text.slice(0, a) + q + text.slice(b));
      const bare = ts.isBlock(stmt.parent) || ts.isSourceFile(stmt.parent) || ts.isCaseClause(stmt.parent) || ts.isDefaultClause(stmt.parent);
      reps.push({ at: [s0, stmt.end], rep: bare ? copies.join('\n' + indent) : `{ ${copies.join(' ')} }` });
    }
    reps.sort((a, b) => b.at[0] - a.at[0]);
    let out = src, floor = Infinity;
    for (const r of reps) {
      if (r.at[1] > floor) { stale.push(`${file}: two edits overlap at offset ${r.at[0]}, so one was skipped`); continue; }
      out = out.slice(0, r.at[0]) + r.rep + out.slice(r.at[1]);
      floor = r.at[0];
    }
    if (reps.length) writes.push({ file, full, src, out, n: reps.length });
  }

  const report = [
    `# Import report, ${new Date().toISOString()}`, '',
    `${changed - stale.length} lines changed in ${writes.length} files. ${same} unchanged. ${rejected.length} rejected. ${stale.length} stale.`, '',
    '## Rejected (fix the line in its chunk and import again)', '',
    ...rejected.map(r => `- [${r.id}] in ${r.chunk}: ${r.why.join('. ')}.\n  ${r.text}`), '',
    '## Stale (the source changed since the export; export again)', '', ...stale.map(s => `- ${s}`), '',
    '## Warnings (imported, check by eye)', '', ...warnings.map(w => `- ${w}`), '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'import-report.md'), report);
  console.log(report.split('\n').slice(2, 3).join(''));
  if (dry) { console.log('Dry run: nothing written. See dialogue/import-report.md.'); return; }
  if (!writes.length) return;

  fs.rmSync(BACKUP, { recursive: true, force: true });
  for (const w of writes) {
    const b = path.join(BACKUP, w.file);
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.writeFileSync(b, w.src);
    fs.writeFileSync(w.full, w.out);
  }
  console.log(`Wrote ${writes.length} files. Originals are in dialogue/backup. Checking types and content...`);
  try { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: root, stdio: 'pipe' }); }
  catch (err) {
    console.log(String(err.stdout || err.message).slice(0, 3000));
    restore();
    console.log('The type check failed, so the import was undone. Please report this: it is an importer bug.');
    process.exitCode = 1;
    return;
  }
  try { execSync('npm test --silent', { cwd: root, stdio: 'pipe' }); console.log('Type check and npm test pass. Run `node scripts/lines.mjs export` before the next round.'); }
  catch (err) {
    console.log(String(err.stdout || err.message).split('\n').filter(l => l.startsWith('FAIL')).join('\n').slice(0, 3000));
    console.log('npm test failed on the lines above. Fix them in the source, or run `node scripts/lines.mjs restore` to undo the import.');
    process.exitCode = 1;
  }
}

function restore() {
  if (!fs.existsSync(BACKUP)) { console.log('No backup to restore.'); return; }
  const files = walkDir(BACKUP);
  for (const b of files) fs.copyFileSync(b, path.join(root, path.relative(BACKUP, b)));
  console.log(`Restored ${files.length} files from dialogue/backup.`);
}

const cmd = process.argv[2];
if (cmd === 'export') exportAll();
else if (cmd === 'import') importAll();
else if (cmd === 'restore') restore();
else console.log('Usage: node scripts/lines.mjs export [--chunk=20000] | import [--dry] | restore');
