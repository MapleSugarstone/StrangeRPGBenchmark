// Round trip for player-facing text, for a naturalizing pass by another model.
//   node scripts/lines.mjs export          writes naturalize/fathom-lines.txt (one text per line, with an id)
//   node scripts/lines.mjs export --new    only lines changed or added since the last export
//   node scripts/lines.mjs export-ui       writes naturalize/fathom-lines-ui.txt: interface text, Sluice text, credits,
//                                          area names, and faction names, with their own sidecar
//   node scripts/lines.mjs import [file]   writes edited text back into src/script/*.txt, map barks, and data files
// Import only replaces a line whose current text still matches the text that was exported.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(root, 'src', 'script');
const MAPS = path.join(root, 'src', 'content', 'maps');
const OUT_DIR = path.join(root, 'naturalize');
const OUT = path.join(OUT_DIR, 'fathom-lines.txt');
const SIDECAR = path.join(OUT_DIR, '.export.json');
const SPEAKER = /^([A-Z][A-Za-z .']{0,24}): (.*)$/;

function scriptTexts(file) {
  const lines = fs.readFileSync(path.join(SCRIPT, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let scene = null, n = 0;
  lines.forEach((line, li) => {
    const t = line.trim();
    if (t.startsWith('== ')) { scene = t.slice(3).trim(); n = 0; return; }
    if (!scene || !t || t.startsWith('#') || t.startsWith('* ')) return;
    const indent = line.slice(0, line.length - line.trimStart().length);
    let speaker, text, rebuild;
    if (t.startsWith('> ')) {
      const m = t.match(/^> chapter (\d+) (.+)$/);
      const tm = t.match(/^> toast (.+)$/);
      if (m) { speaker = 'CHAPTER TITLE'; text = m[2]; rebuild = (s) => `${indent}> chapter ${m[1]} ${s}`; }
      else if (tm) { speaker = 'NOTICE'; text = tm[1]; rebuild = (s) => `${indent}> toast ${s}`; }
      else return;
    } else if (t === '?' || t.startsWith('? ')) {
      text = t.slice(1).trim();
      if (!text) return;
      speaker = 'CHOICE PROMPT'; rebuild = (s) => `${indent}? ${s}`;
    } else if (t.startsWith('- ')) {
      const m = t.match(/^- ((?:\[[A-Za-z]+ \d\]\s*|\{[a-z]+\}\s*|<[a-z]+>\s*|\?\S+\s+|\$\d+\s+)*)(.*?)( -> .+)?$/);
      speaker = 'HERO CHOICE'; text = m[2]; const pre = m[1] || '', tail = m[3] || '';
      rebuild = (s) => `${indent}- ${pre}${s}${tail}`;
    } else if (t.startsWith('(') && t.endsWith(')')) {
      speaker = 'SYSTEM'; text = t.slice(1, -1); rebuild = (s) => `${indent}(${s})`;
    } else if (SPEAKER.test(t)) {
      const m = t.match(SPEAKER);
      speaker = m[1]; text = m[2]; rebuild = (s) => `${indent}${m[1]}: ${s}`;
    } else return;
    n++;
    out.push({ id: `${file.replace('.txt', '')}:${scene}.${String(n).padStart(2, '0')}`, file, li, speaker, text, rebuild });
  });
  return { lines, out };
}

function barkTexts(file) {
  const src = fs.readFileSync(path.join(MAPS, file), 'utf8').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const out = [];
  lines.forEach((line, li) => {
    const m = line.match(/id: '([^']+)'.*bark: \[(.*)\]/);
    if (!m) return;
    const items = [...m[2].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)];
    items.forEach((it, k) => {
      const lit = it[0];
      const text = (it[1] ?? it[2]).replace(/\\(.)/g, '$1');
      out.push({ id: `bark:${file.replace('.ts', '')}:${m[1]}.${k + 1}`, file, li, speaker: 'PASSERBY', text, lit, map: true });
    });
  });
  return { lines, out };
}

const CONTENT = path.join(root, 'src', 'content');
const RULES = path.join(root, 'src', 'rules');
const COMPANIONS = { courtesy: 'Courtesy', sallis: 'Sallis', quaye: 'Quaye', ambrose: 'Ambrose', tova: 'Tova', ignace: 'Ignace' };
const LITERAL = /(?:'(\d+)'|(\w+)): ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
const SKIP = new Set(['speakers.ts', 'register.ts', 'banterlist.ts', 'details.ts', 'banter.ts', 'companions.ts']);

/** Player-facing strings in data files, found by their keys. Each keeps the exact source literal for import. */
function dataTexts(dir, file) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let anchor = 'top', inStages = false;
  const seen = new Map();
  lines.forEach((line, li) => {
    const idm = line.match(/\bid: '([^']+)'/);
    if (idm) anchor = idm[1];
    if (/stages: \{/.test(line)) inStages = true;
    for (const m of line.matchAll(LITERAL)) {
      const key = m[1] ?? m[2];
      const lit = m[3];
      const text = lit.slice(1, -1).replace(/\\(.)/g, '$1');
      const at = m.index;
      let speaker = null;
      if (key === 'text') {
        const ci = line.indexOf('check:');
        if (ci >= 0 && ci < at) speaker = (line.slice(ci).match(/skill: '(\w+)'/)?.[1] ?? 'check').toUpperCase();
        else if (/\btitle: /.test(line) && !/\bmap: /.test(line)) speaker = 'LORE';
        else speaker = 'DETAIL';
      } else if (key === 'title') speaker = /\btext: /.test(line) ? 'LORE TITLE' : 'QUEST TITLE';
      else if (key === 'desc') speaker = 'DESCRIPTION';
      else if (key === 'read') speaker = 'ITEM TEXT';
      else if (key === 'name' && /\bdesc: /.test(line)) speaker = 'NAME';
      else if (/^\d+$/.test(key) || key === 'done' || key === 'fail') {
        const pi = line.indexOf('port:');
        if (pi >= 0 && pi < at) speaker = 'PORT';
        else if (inStages) speaker = 'JOURNAL';
      } else if (COMPANIONS[key]) {
        const pi = line.indexOf('party:');
        if (pi >= 0 && pi < at) speaker = COMPANIONS[key];
      }
      if (!speaker || !text.trim()) continue;
      const base = `data:${file.replace('.ts', '')}:${anchor}.${key}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      out.push({ id: n > 1 ? `${base}.${n}` : base, file, li, speaker, text, key: m[0].slice(0, m[0].length - lit.length), lit, data: dir });
    }
    if (inStages && /^\s*\},?\s*$/.test(line)) inStages = false;
  });
  return { lines, out };
}

function dataFiles() {
  const list = [];
  for (const f of fs.readdirSync(CONTENT).filter((x) => x.endsWith('.ts') && !SKIP.has(x))) list.push([CONTENT, f]);
  list.push([RULES, 'data.ts']);
  return list;
}

const UI_SIDECAR = path.join(OUT_DIR, '.export-ui.json');
const UI_OUT = path.join(OUT_DIR, 'fathom-lines-ui.txt');
const CODE_DIRS = ['ui', 'game', 'combat'].map((d) => path.join(root, 'src', d));
const STR = String.raw`('(?:[^'\\]|\\.)*'|\`(?:[^\`\\]|\\.)*\`)`;
const UI_PATTERNS = [
  [new RegExp(String.raw`\b(drawText|drawWrapped|toast)\(\s*` + STR, 'g'), (m) => (m[1] === 'drawWrapped' ? 'UI HINT' : m[1] === 'toast' ? 'NOTICE' : 'UI LABEL'), 2],
  [new RegExp(String.raw`\bpanel\([^()]*?,\s*` + STR + String.raw`\s*\)`, 'g'), () => 'UI TITLE', 1],
  [new RegExp(String.raw`\b(?:text|right): ` + STR, 'g'), () => 'UI LABEL', 1],
];

const SPEAKER_NAMES = (() => {
  const src = fs.readFileSync(path.join(CONTENT, 'speakers.ts'), 'utf8');
  return new Set([...src.matchAll(/^\s+'?([A-Za-z .]+?)'?: \{ name: '([^']+)'/gm)].flatMap((m) => [m[1], m[2]]).map((x) => x.toLowerCase()));
})();
/** Cards named after a character, or with a one-word name, stay as they are. */
function characterName(name) { return !name.includes(' ') || SPEAKER_NAMES.has(name.toLowerCase()); }

function hashText(t) { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); }

/** Whether an interface string is text a player reads, rather than a control hint, a name, or a symbol. */
function readable(t) {
  const plain = t.replace(/\$\{[^}]*\}/g, '');
  if (!/[a-z]/.test(plain) || plain.replace(/[^A-Za-z]/g, '').length < 3) return false;
  if (/^[A-Z0-9<>/]{1,8}: /.test(plain) || /\b[A-Z]: [a-z]/.test(plain)) return false;
  if (/Claude|Opus|Benchmark/.test(plain)) return false;
  return true;
}

/** Interface strings, Sluice text, credits, area names, and faction names, each with its exact source literal. */
function uiTexts(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const rel = path.relative(path.join(root, 'src'), file).replace(/\\/g, '/').replace(/\.ts$/, '');
  const out = [];
  const seen = new Map();
  const add = (li, speaker, lit, kind) => {
    const text = lit.slice(1, -1).replace(/\\(.)/g, '$1');
    if (!readable(text)) return;
    const base = `${kind}:${rel}:${hashText(text)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (out.some((x) => x.li === li && x.lit === lit)) return;
    out.push({ id: n > 1 ? `${base}.${n}` : base, file, li, speaker, text, lit, ui: true });
  };
  let inRules = false;
  lines.forEach((line, li) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || /^import /.test(line)) return;
    if (rel.startsWith('content/maps/')) {
      const m = line.match(/^  name: ('(?:[^'\\]|\\.)*'),$/);
      if (m) add(li, 'AREA NAME', m[1], 'area');
      return;
    }
    if (rel === 'content/cards') {
      if (/RULE_TEXT/.test(line)) inRules = true;
      if (inRules && /^\};/.test(line)) inRules = false;
      const c = line.match(/\bc\('[a-z0-9_]+', ('(?:[^'\\]|\\.)*')/);
      if (c && !characterName(c[1].slice(1, -1))) add(li, 'CARD NAME', c[1], 'card');
      const r = inRules && line.match(/^  [a-z]+: ('(?:[^'\\]|\\.)*'),/);
      if (r) add(li, 'SLUICE RULE', r[1], 'rule');
      return;
    }
    if (rel === 'content/replay') {
      const m = line.match(/\{ id: '[a-z]+', name: ('(?:[^'\\]|\\.)*'), color/);
      if (m) add(li, 'FACTION NAME', m[1], 'faction');
      return;
    }
    for (const [re, who, g] of UI_PATTERNS) {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) add(li, rel === 'ui/credits' ? 'CREDITS' : who(m), m[g], 'ui');
    }
  });
  return { lines, out };
}

function uiFiles() {
  const list = [];
  for (const d of CODE_DIRS) for (const x of fs.readdirSync(d).filter((y) => y.endsWith('.ts'))) list.push(path.join(d, x));
  for (const x of fs.readdirSync(MAPS).filter((y) => y.endsWith('.ts'))) list.push(path.join(MAPS, x));
  list.push(path.join(CONTENT, 'cards.ts'), path.join(CONTENT, 'replay.ts'));
  return list;
}

function doExportUi() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all = [];
  for (const file of uiFiles()) all.push(...uiTexts(file).out);
  const head = 'FATHOM: INTERFACE TEXT, SLUICE TEXT, CREDITS, AND NAMES\n\nEdit only the text after the "|". Keep ' +
    '${...} placeholders exactly. Labels must stay about as short as they are, so they fit on screen.\n\n';
  fs.writeFileSync(UI_OUT, head + all.map((x) => `[${x.id}] ${x.speaker} | ${x.text}`).join('\n') + '\n');
  fs.writeFileSync(UI_SIDECAR, JSON.stringify(Object.fromEntries(all.map((x) => [x.id, x.text]))));
  console.log(`Wrote ${all.length} lines to ${path.relative(root, UI_OUT)}`);
}

const HEADER = `FATHOM: PLAYER-FACING TEXT FOR NATURALIZING
===========================================

Edit only the text after the "|" on each line. Keep the [id] and the speaker exactly as they are.
Keep one text per line. Delete nothing. A line you leave unchanged stays as it is.

The world, so the lines make sense:
Fathom is a neon city forty meters below the sea, behind a seawall called the Wall. Rain most nights.
The deepest district is the Deeps (canals, stilt houses, markets). Above it the Stair climbs the inside of
the Wall. The top of the Wall is the Brim, where the corporations live. The Board (the Fathom Water Board)
owns the Wall, the pumps, the blood trade, and the color red.
About one person in ten thousand is born a witch. Witch blood wakes things that are not alive: a door, a car,
a robot. A woken thing has the feeling the witch had while bleeding, and stays awake as long as that feeling
lasted. The Board sells blood by feeling and calls each product a Line (Line 4 is anger, Line 9 is calm).
Giant woken pumps called the Bailers walk the canals and bail water over the Wall. A girl woke them forty
years ago in the Great Flood. The city calls her the Saint and thinks she drowned.
The hero is a runner whose neural port woke up when a case of blood burst on a Board barge. The port talks
to the hero and pulls toward someone.
Words people use without explaining: red (witch blood), Line (a blood product), cut (diluted blood),
wake/woken, a wild (unregistered witch), tapped (registered witch), hush (blood that puts wakes to sleep),
going up (a woken thing heading for the Brim), dry (rich, safe, above the waterline), wet (poor),
gilt (money), port (the socket in everyone's neck), chrome (cyberware), arrears (leased chrome switched off),
diver (netrunner), bells (hours), bailing (working), the Census (the Board's blood test), Lost Property
(Board Recovery).

Rules for every line:
- Most lines under 60 characters. Never over 100.
- No em dashes and no semicolons.
- Keep {name} and {port} where they appear: the hero's name and the port's name.
- Keep every fact a line states. Lines marked with ! in front of the speaker are clues for a later twist:
  change their wording if you like, but keep what they say and keep them quiet and ordinary.
- Let the strange world carry the weirdness. People state strange things plainly, as everyday facts.
- No jokes with setups. No narration. No "it's not X, it's Y". No labeled feelings. No wise summary lines.

Who talks how:
- HERO CHOICE lines are the hero's own words. Short, plain. The hero is a Deeps runner.
- PORT: a newborn mind. Early on, single words and pieces of things it heard. Later short sentences, questions.
- Courtesy: a riot robot that can only speak in public announcement phrases, in capitals, recombined.
- Sallis: commands and statements, never a question. Short. "Copy." "No."
- Quaye: an old hacker. Answers with numbers: counts, times, prices, distances. Calls the hero "kid".
- Ambrose: an ex-fighter. Formal, grand, rare old words. Drops into plain short words when hurt or scared.
- Tova: a young witch. Casual, fast, fragments, often lowercase.
- Ignace: a fake deacon. Florid holy language when performing, plain and brief when honest.
- Opal: a fixer. Casual, eats while talking, calls people "sweet".
- Tilly: an old woken tram. Repeats the last word of a question before answering. Slow and kind.
- Mother Sieve: gang boss. Gentle medical words, serves tea, menacing.
- The Dowser: Board hunter. Polite, professional, calls woken things "it" and people "friend".
- Teun: the Board's chairman. Never says "I". Says "the Board", "this office".
- Marit: forty years in a vault. Long run-on sentences that stop when she tires, then a short one.
- CHOIR: monks who speak as a group, several short lines that disagree a little.
- Everyone else: casual, ordinary people. Quirks belong only to the characters above.
- SYSTEM lines are short game text in parentheses. CHAPTER TITLE is a chapter name. NOTICE is a toast.
- DETAIL lines show when the player inspects a thing in the world. Describe what is there, plainly.
- NOTICE, TECH, HACK, TALK, SNEAK, ATHLETICS, SHOOT, STRIKE are the hero's skills speaking up about a
  detail when the party is good at them. Each is a short observation in that skill's angle.
- LORE TITLE and LORE are journal entries about the world. JOURNAL is quest log text. QUEST TITLE names a quest.
- NAME and DESCRIPTION are items, perks, abilities, statuses, enemies, and backgrounds. ITEM TEXT is
  writing on an item the player reads.

`;

function collect() {
  const files = fs.readdirSync(SCRIPT).filter((f) => f.endsWith('.txt') && f !== 'test.txt').sort((a, b) => {
    const r = (f) => (/^ch\d/.test(f) ? Number(f.slice(2).replace(/\D.*$/, '')) : 50);
    return r(a) - r(b) || a.localeCompare(b);
  });
  const all = [];
  for (const f of files) all.push(...scriptTexts(f).out);
  if (fs.existsSync(MAPS)) for (const f of fs.readdirSync(MAPS).filter((x) => x.endsWith('.ts'))) all.push(...barkTexts(f).out);
  for (const [dir, f] of dataFiles()) all.push(...dataTexts(dir, f).out);
  return all;
}

function doExport(onlyNew) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all = collect();
  let prev = {};
  if (onlyNew && fs.existsSync(SIDECAR)) prev = JSON.parse(fs.readFileSync(SIDECAR, 'utf8'));
  const list = onlyNew ? all.filter((x) => prev[x.id] !== x.text) : all;
  const body = list.map((x) => `[${x.id}] ${x.speaker} | ${x.text}`).join('\n');
  const file = onlyNew ? OUT.replace('.txt', '-new.txt') : OUT;
  fs.writeFileSync(file, HEADER + body + '\n');
  const side = { ...prev };
  for (const x of all) side[x.id] = x.text;
  fs.writeFileSync(SIDECAR, JSON.stringify(side, null, 0));
  console.log(`Wrote ${list.length} lines to ${path.relative(root, file)}`);
}

function doImport(file) {
  const src = fs.readFileSync(file ?? OUT, 'utf8').replace(/\r\n/g, '\n');
  const edits = new Map();
  for (const line of src.split('\n')) {
    const m = line.match(/^\[([^\]]+)\] [^|]*\| (.*)$/);
    if (m) edits.set(m[1], m[2].trim());
  }
  const side = fs.existsSync(SIDECAR) ? JSON.parse(fs.readFileSync(SIDECAR, 'utf8')) : {};
  if (fs.existsSync(UI_SIDECAR)) Object.assign(side, JSON.parse(fs.readFileSync(UI_SIDECAR, 'utf8')));
  let changed = 0, skipped = 0;
  const byFile = new Map();
  for (const f of fs.readdirSync(SCRIPT).filter((x) => x.endsWith('.txt'))) byFile.set(f, scriptTexts(f));
  for (const [f, { lines, out }] of byFile) {
    let dirty = false;
    for (const x of out) {
      const e = edits.get(x.id);
      if (e === undefined || e === x.text) continue;
      if (side[x.id] !== undefined && side[x.id] !== x.text) { skipped++; continue; }
      // A rewrite split with " | " becomes one line per part, each with the same speaker.
      lines[x.li] = e.includes(' | ') ? e.split(' | ').map((p) => x.rebuild(p.trim())).join('\n') : x.rebuild(e);
      dirty = true;
      changed++;
    }
    if (dirty) fs.writeFileSync(path.join(SCRIPT, f), lines.join('\n'));
  }
  for (const f of fs.readdirSync(MAPS).filter((x) => x.endsWith('.ts'))) {
    const { lines, out } = barkTexts(f);
    let dirty = false;
    for (const x of out) {
      const e = edits.get(x.id);
      if (e === undefined || e === x.text) continue;
      if (side[x.id] !== undefined && side[x.id] !== x.text) { skipped++; continue; }
      const lit = e.includes("'") ? JSON.stringify(e) : `'${e}'`;
      lines[x.li] = lines[x.li].replace(x.lit, lit);
      dirty = true;
      changed++;
    }
    if (dirty) fs.writeFileSync(path.join(MAPS, f), lines.join('\n'));
  }
  for (const [dir, f] of dataFiles()) {
    const { lines, out } = dataTexts(dir, f);
    let dirty = false;
    for (const x of out) {
      const e = edits.get(x.id);
      if (e === undefined || e === x.text) continue;
      if (side[x.id] !== undefined && side[x.id] !== x.text) { skipped++; continue; }
      const lit = e.includes("'") ? JSON.stringify(e) : `'${e}'`;
      lines[x.li] = lines[x.li].replace(x.key + x.lit, x.key + lit);
      dirty = true;
      changed++;
    }
    if (dirty) fs.writeFileSync(path.join(dir, f), lines.join('\n'));
  }
  for (const file of uiFiles()) {
    const { lines, out } = uiTexts(file);
    let dirty = false;
    for (const x of out) {
      const e = edits.get(x.id);
      if (e === undefined || e === x.text) continue;
      if (side[x.id] !== undefined && side[x.id] !== x.text) { skipped++; continue; }
      const lit = x.lit[0] === '`' ? '`' + e.replace(/`/g, '\\`') + '`' : e.includes("'") ? JSON.stringify(e) : `'${e}'`;
      lines[x.li] = lines[x.li].split(x.lit).join(lit);
      dirty = true;
      changed++;
    }
    if (dirty) fs.writeFileSync(file, lines.join('\n'));
  }
  console.log(`Imported ${changed} lines. Skipped ${skipped} that changed since the export.`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'export') doExport(arg === '--new');
else if (cmd === 'export-ui') doExportUi();
else if (cmd === 'import') doImport(arg);
else console.log('Usage: node scripts/lines.mjs export [--new] | export-ui | import [file]');
