// Round trip for player-facing text.
//   node scripts/lines.mjs export   writes naturalize/gnomon-lines.txt (one line per text, with an id)
//   node scripts/lines.mjs export2  writes naturalize/gnomon-lines-2.txt (new or changed lines, plus skill, item, and Sticks rule text)
//   node scripts/lines.mjs import [file]   writes edited text back into src/script/*.txt and the code it came from
// Import only replaces a line whose current text still matches the text that was exported.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(root, 'src', 'script');
const OUT_DIR = path.join(root, 'naturalize');
const OUT = path.join(OUT_DIR, 'gnomon-lines.txt');
const SIDECAR = path.join(OUT_DIR, '.export.json');

const SPEAKER = /^([A-Z][A-Za-z ]{0,20}): (.*)$/;

/** Every player-facing text in a script file, with a function that rebuilds its source line. */
function texts(file) {
  const src = fs.readFileSync(path.join(SCRIPT, file), 'utf8').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let scene = null;
  let n = 0;
  const isLetters = file === 'letters.txt';
  const isLedger = file === 'ledger.txt';
  lines.forEach((line, li) => {
    const t = line.trim();
    if (t.startsWith('== ')) { scene = t.slice(3).trim(); n = 0; return; }
    if (!scene || !t || t.startsWith('#') || t.startsWith('* ')) return;
    let speaker = null, text = null, rebuild = null;
    if (t.startsWith('> ')) {
      const m = t.match(/^> chapter (\d+) (.+)$/);
      if (!m) return;
      speaker = 'CHAPTER TITLE'; text = m[2]; rebuild = (s) => `> chapter ${m[1]} ${s}`;
    } else if (t.startsWith('? ') || t === '?') {
      text = t.slice(1).trim();
      if (!text) return;
      speaker = 'CHOICE PROMPT'; rebuild = (s) => `? ${s}`;
    } else if (t.startsWith('- ')) {
      const m = t.match(/^- (.*?)( -> \S+)?$/);
      speaker = 'HERO CHOICE'; text = m[1]; const tail = m[2] || ''; rebuild = (s) => `- ${s}${tail}`;
    } else if (t.startsWith('(') && t.endsWith(')')) {
      speaker = 'SYSTEM'; text = t.slice(1, -1); rebuild = (s) => `(${s})`;
    } else if (SPEAKER.test(t) && !isLetters && !isLedger) {
      const m = t.match(SPEAKER);
      speaker = m[1]; text = m[2]; rebuild = (s) => `${m[1]}: ${s}`;
    } else if (isLetters) {
      speaker = 'TIB LETTER'; text = t; rebuild = (s) => s;
    } else if (isLedger) {
      speaker = 'LEDGER NOTE'; text = t; rebuild = (s) => s;
    } else return;
    n++;
    out.push({ id: `${file.replace('.txt', '')}:${scene}.${String(n).padStart(2, '0')}`, file, scene, n, li, speaker, text, rebuild });
  });
  return { lines, out };
}

const HEADER = `GNOMON: PLAYER-FACING TEXT FOR NATURALIZING
============================================

Edit only the text after the "|" on each line. Keep the [id] and the speaker exactly as they are.
Keep one text per line. Delete nothing. A line you leave unchanged stays as it is.

The world, so the lines make sense:
Shadows arrive before the things that cast them, and things follow their shadows. People call a shadow a "lead".
The sun never moves. In the Long (the rim) leads are very long and show days ahead. On the Face leads are short.
At Overhead (the Zenith) nothing has a lead. In the Back (the night side) there is no light at all.
Lamps can turn a lead, so lamps need a license from the Bearers' Office. Nodus is the clerk who writes down
the leads that cross the town square in the Ledger. One morning a giant lead with nothing at its end lies over the town.
Words people use without explaining: lead (shadow), follow (arrive where your lead was), slack (no lead showing),
turn (bend a lead with light), hood (cover a lamp), Bearer (licensed lamp carrier), stray (a lead with no owner),
sleep (a day), bell (an hour), mites (coins), lead-wake (a wake for someone whose lead vanished; they attend it).

Rules for every line:
- Most lines under 60 characters. Never over 100.
- No em dashes and no semicolons.
- Keep {name} where it appears. It is the hero's name.
- Keep every fact a line states. Lines marked with ! in front of the speaker are clues for a later twist:
  change their wording if you like, but keep exactly what they say and keep them quiet and ordinary.
- Let the strange world carry the weirdness. People state strange things plainly, as everyday facts.
- No jokes with setups. No narration. No "it's not X, it's Y". No labeled feelings. No wise summary lines.

Who talks how:
- Nodus (hero, HERO CHOICE lines too): short and rare. About one line in three is ledger shorthand ("Noted." "Entry: one lead, no owner.").
- Tib (and TIB LETTER): Nodus's younger sibling. lowercase, casual, emoticons like :-] and :-[.
- Parhelia: old ex-Bearer, casual and dry. About one line in three ends with a parenthesis that is drier and more honest than the sentence.
- Lot: a stray lead, childlike. In about one line in three it answers before the question is asked. Short. Calls Tik "Body".
- Umbraculum: one-legged sciapod lord. Overreaching: grand invented words, stacked exclamation marks, titles for everyone, in quick bursts.
- Minim: a person made of silvered glass. In about one line in three she says words back in reverse order, sometimes only the reversed half. The only character who repeats.
- Tik and the Unled (Hum, Drip, Scuff): never use the future tense. No "will", "later", "going to", "tomorrow". Short fragments.
- Anthelion: the Director. Official and clipped, like orders read aloud. Never exclaims, never lies.
- Grisaille: Office bailiff. Fussy and loud, cites rule numbers in short barks.
- The Painter: forger. Talks in paint colors and instructions to himself.
- Everyone else: casual, ordinary people. Quirks belong only to the characters above.
- SYSTEM lines are short game text in parentheses (no voice). CHAPTER TITLE is a chapter name.

`;

const CLUES = [
  'license every light', 'One unlicensed light', 'Body went where leads', 'turned one lead', 'Two, now',
  'bump on top like a strap', 'like a kid', 'one big foot', 'long flat bit', 'too big for my child',
  'a small round outline', 'Shade eats leads', 'simply gone', 'no lead at all', 'small brass sundial', 'little sun',
];

function scriptTexts() {
  const files = fs.readdirSync(SCRIPT).filter((f) => f.endsWith('.txt')).sort((a, b) => {
    const r = (f) => (/^ch\d/.test(f) ? Number(f.slice(2, -4)) : 50 + (f === 'letters.txt' ? 1 : f === 'strays.txt' ? 2 : 3));
    return r(a) - r(b);
  });
  const all = [];
  for (const f of files) all.push(...texts(f).out);
  return all;
}

// Short rules text that lives in code. One entry per source line, found by its key.
const TS_SOURCES = [
  { file: 'src/battle/skills.ts', label: 'skill', speaker: 'SKILL TEXT', re: /^\s*(\w+): S\(\{ id: '\w+', name: '[^']*', desc: ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/ },
  { file: 'src/content/items.ts', label: 'item', speaker: 'ITEM TEXT', re: /^\s*(\w+): \{ id: '\w+', name: '[^']*', desc: ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/ },
  { file: 'src/game/sticks.ts', label: 'sticks', speaker: 'STICKS RULE', re: /^\s*(basic|still|twolamp|short|mirror|noon|dark|late): ('(?:[^'\\]|\\.)*')/ },
  { file: 'src/content/foes.ts', label: 'battle', speaker: 'SYSTEM', re: /^\s*(\w+): F\(\{.*addsText: ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/ },
];
const unquote = (lit) => lit.slice(1, -1).replace(/\\(.)/g, (m, c) => c);
const quote = (text) => (text.includes("'") ? JSON.stringify(text) : `'${text}'`);

function tsTexts() {
  const out = [];
  for (const s of TS_SOURCES) {
    const lines = fs.readFileSync(path.join(root, s.file), 'utf8').replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, li) => {
      const m = line.match(s.re);
      if (m) out.push({ id: `${s.label}:${m[1]}`, src: s.file, li, lit: m[2], text: unquote(m[2]), speaker: s.speaker, scene: s.label, file: s.file });
    });
  }
  return out;
}

const GAMES = path.join(root, '..', 'games.json');
const CART_FIELDS = [['role', (g) => g.hero?.role], ['blurb', (g) => g.blurb], ['controls', (g) => g.controls]];

/** The cartridge menu's text for this game: the hero's role line, the blurb, and the controls line. */
function cartTexts() {
  if (!fs.existsSync(GAMES)) return [];
  const game = JSON.parse(fs.readFileSync(GAMES, 'utf8')).games.find((g) => g.folder === path.basename(root));
  if (!game) return [];
  return CART_FIELDS.map(([k, get]) => ({ id: `cartridge:${k}`, text: get(game), speaker: 'CARTRIDGE TEXT', file: 'games.json', scene: 'cartridge' })).filter((t) => typeof t.text === 'string');
}

function writeBatch(out, sidecar, all, header) {
  let body = header;
  let lastScene = '';
  for (const t of all) {
    const key = `${t.file}:${t.scene}`;
    if (key !== lastScene) { body += `\n# ${t.file} / ${t.scene}\n`; lastScene = key; }
    const clue = CLUES.some((c) => t.text.includes(c)) ? '!' : '';
    body += `[${t.id}] ${clue}${t.speaker} | ${t.text}\n`;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(out, body);
  fs.writeFileSync(sidecar, JSON.stringify(Object.fromEntries(all.map((t) => [t.id, t.text])), null, 1));
  console.log(`Wrote ${all.length} lines to ${path.relative(root, out)}`);
}

function exportAll() {
  writeBatch(OUT, SIDECAR, scriptTexts(), HEADER);
}

const OUT2 = path.join(OUT_DIR, 'gnomon-lines-2.txt');
const SIDECAR2 = path.join(OUT_DIR, '.export-2.json');
const HEADER2 = HEADER.replace('GNOMON: PLAYER-FACING TEXT FOR NATURALIZING\n============================================',
  'GNOMON: PLAYER-FACING TEXT FOR NATURALIZING, BATCH 2\n===================================================\n\nThis batch holds the lines that are new or changed since batch 1, then the short rules text from the menus.\nSKILL TEXT, ITEM TEXT, and STICKS RULE lines are plain instructions a young reader can follow, with no voice.\nKeep every number in them.');

/** Script lines that are new or changed since batch 1, then the rules text in code. */
function exportNew() {
  const prev = fs.existsSync(SIDECAR) ? JSON.parse(fs.readFileSync(SIDECAR, 'utf8')) : {};
  writeBatch(OUT2, SIDECAR2, [...scriptTexts().filter((t) => prev[t.id] !== t.text), ...tsTexts()], HEADER2);
}

/** Script lines whose text was in no earlier batch and in no rewrite that came back, as the next numbered batch. */
function exportNext() {
  let n = 3;
  while (fs.existsSync(path.join(OUT_DIR, `.export-${n}.json`))) n++;
  const known = new Map();
  const remember = (id, text) => { const scene = id.slice(0, id.lastIndexOf('.')); if (!known.has(scene)) known.set(scene, new Set()); known.get(scene).add(text); };
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^\.export(-\d+)?\.json$/.test(f)) for (const [id, text] of Object.entries(JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')))) remember(id, text);
    if (/^naturalized-\d+\.txt$/.test(f)) for (const line of fs.readFileSync(path.join(OUT_DIR, f), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
      const m = line.match(/^\[([^\]]+)\] !?[^|]*\| ?(.*)$/);
      if (m) remember(m[1], m[2].trimEnd());
    }
  }
  const seenText = (id, text) => known.get(id.slice(0, id.lastIndexOf('.')))?.has(text) || known.get(id)?.has(text);
  for (const f of fs.readdirSync(OUT_DIR)) if (/^\.export(-\d+)?\.json$/.test(f)) for (const [id, text] of Object.entries(JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')))) { if (!known.has(id)) known.set(id, new Set()); known.get(id).add(text); }
  for (const f of fs.readdirSync(OUT_DIR)) if (/^naturalized-\d+\.txt$/.test(f)) for (const line of fs.readFileSync(path.join(OUT_DIR, f), 'utf8').replace(/\r\n/g, '\n').split('\n')) { const m = line.match(/^\[([^\]]+)\] !?[^|]*\| ?(.*)$/); if (m) { if (!known.has(m[1])) known.set(m[1], new Set()); known.get(m[1]).add(m[2].trimEnd()); } }
  const fresh = [...scriptTexts().filter((t) => !known.get(`${t.file.replace('.txt', '')}:${t.scene}`)?.has(t.text)), ...tsTexts().filter((t) => !seenText(t.id, t.text)), ...cartTexts().filter((t) => !seenText(t.id, t.text))];
  const header = HEADER.replace('GNOMON: PLAYER-FACING TEXT FOR NATURALIZING\n============================================',
    `GNOMON: PLAYER-FACING TEXT FOR NATURALIZING, BATCH ${n}\n===================================================\n\nThis batch holds only the lines written since the earlier batches came back.\nCARTRIDGE TEXT lines appear on the game\'s card in the menu of all the games: a short role line for the hero, a blurb that sells the game in a few plain sentences, and the controls.`);
  writeBatch(path.join(OUT_DIR, `gnomon-lines-${n}.txt`), path.join(OUT_DIR, `.export-${n}.json`), fresh, header);
}

function importAll(file) {
  const edited = fs.readFileSync(file || OUT, 'utf8').replace(/\r\n/g, '\n');
  const batch = Number(edited.slice(0, 200).match(/BATCH (\d+)/)?.[1] ?? 1);
  const orig = JSON.parse(fs.readFileSync(batch === 1 ? SIDECAR : path.join(OUT_DIR, `.export-${batch}.json`), 'utf8'));
  const want = new Map();
  for (const line of edited.split('\n')) {
    const m = line.match(/^\[([^\]]+)\] !?[^|]*\| ?(.*)$/);
    if (m) want.set(m[1], m[2].trimEnd());
  }
  let changed = 0, stale = 0;
  const warnings = [];
  for (const f of fs.readdirSync(SCRIPT).filter((x) => x.endsWith('.txt'))) {
    const { lines, out } = texts(f);
    const key = f.replace('.txt', '') + ':';
    const byScene = new Map();
    for (const t of out) { if (!byScene.has(t.scene)) byScene.set(t.scene, []); byScene.get(t.scene).push(t); }
    const used = new Set();
    let dirty = false;
    for (const [id, next] of want) {
      if (!id.startsWith(key) || orig[id] === undefined || next === orig[id]) continue;
      const scene = id.slice(key.length, id.lastIndexOf('.'));
      const here = byScene.get(scene) ?? [];
      // A line keeps its text but may have moved when lines before it in the scene were added or cut.
      const t = here.find((c) => c.id === id && c.text === orig[id] && !used.has(c)) ?? here.find((c) => c.text === orig[id] && !used.has(c));
      if (!t) {
        if (!here.some((c) => c.text === next)) { stale++; warnings.push(`stale (source changed since export): ${id}`); }
        continue;
      }
      used.add(t);
      const indent = lines[t.li].match(/^\s*/)[0];
      lines[t.li] = indent + t.rebuild(next);
      dirty = true;
      changed++;
      if (next.length > 100) warnings.push(`over 100 characters: ${id}`);
      if (/[–—;]/.test(next)) warnings.push(`dash or semicolon: ${id}`);
    }
    if (dirty) fs.writeFileSync(path.join(SCRIPT, f), lines.join('\n'));
  }
  const byFile = new Map();
  for (const t of tsTexts()) {
    const next = want.get(t.id);
    if (next === undefined || next === t.text) continue;
    if (orig[t.id] !== t.text) { stale++; warnings.push(`stale (source changed since export): ${t.id}`); continue; }
    if (!byFile.has(t.src)) byFile.set(t.src, fs.readFileSync(path.join(root, t.src), 'utf8').replace(/\r\n/g, '\n').split('\n'));
    const lines = byFile.get(t.src);
    lines[t.li] = lines[t.li].replace(t.lit, () => quote(next));
    changed++;
    if (/[–—;]/.test(next)) warnings.push(`dash or semicolon: ${t.id}`);
  }
  for (const [f, lines] of byFile) fs.writeFileSync(path.join(root, f), lines.join('\n'));
  for (const t of cartTexts()) {
    const next = want.get(t.id);
    if (next === undefined || next === t.text) continue;
    if (orig[t.id] !== t.text) { stale++; warnings.push(`stale (source changed since export): ${t.id}`); continue; }
    const g = fs.readFileSync(GAMES, 'utf8');
    const old = JSON.stringify(t.text);
    if (g.split(old).length !== 2) { warnings.push(`not unique in games.json: ${t.id}`); continue; }
    fs.writeFileSync(GAMES, g.split(old).join(JSON.stringify(next)));
    changed++;
    if (/[–—;]/.test(next)) warnings.push(`dash or semicolon: ${t.id}`);
  }
  console.log(`Imported ${changed} changed lines. ${stale} skipped as stale.`);
  for (const w of warnings) console.log('  ' + w);
}

const cmd = process.argv[2];
// A sent batch's sidecar records what the naturalizer saw. Overwriting it breaks the import, so it takes --force.
const force = process.argv.includes('--force');
const guard = (f) => { if (fs.existsSync(f) && !force) { console.log(`${path.relative(root, f)} exists, so that batch was already sent. Add --force to overwrite it.`); process.exit(1); } };
if (cmd === 'export') { guard(SIDECAR); exportAll(); }
else if (cmd === 'export2') { guard(SIDECAR2); exportNew(); }
else if (cmd === 'next') exportNext();
else if (cmd === 'import') importAll(process.argv[3]);
else console.log('Usage: node scripts/lines.mjs export | export2 | next | import [file]');
