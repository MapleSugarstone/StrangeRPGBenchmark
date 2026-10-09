// Renames kinds to the names picked on the review page. Ids stay the same. Many old names are ordinary words, places, or parts of
// move names, so a rename only touches places that are certainly about the kind:
//   species files: the kind's own `name:` field;
//   kits files: ability texts on that kind's own definitions, with multi-word move, habit, summon, and notion names left alone;
//   content: lines that point at the kind (mon: 'id', kindSprite('id'), SPECIES.id) and lines listed in Notes/names/allow.txt.
// Then `node scripts/lines.mjs export` refreshes dialogue/lines.
// node scripts/names-apply.mjs --dry   lists every change without writing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const choices = JSON.parse(fs.readFileSync(path.join(root, 'review', 'choices.json'), 'utf8'));
const names = JSON.parse(fs.readFileSync(path.join(root, 'review', 'names.json'), 'utf8'));
const allowFile = path.join(root, 'Notes', 'names', 'allow.txt');
const allow = new Set(fs.existsSync(allowFile) ? fs.readFileSync(allowFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')) : []);
// Kinds whose ability texts use their own name for something else (Nail counts nails it has driven in).
const KEEP_TEXT = new Set(['nail']);

const renames = Object.entries(names)
  .map(([id, n]) => ({ id, from: n.current, to: choices[id]?.name }))
  .filter(r => r.to && r.to !== r.from);
if (!renames.length) { console.log('No names picked yet.'); process.exit(0); }

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const dataDir = path.join(root, 'src', 'data');
const speciesFiles = fs.readdirSync(dataDir).filter(f => /^species\d*\.ts$/.test(f)).map(f => path.join(dataDir, f));
const kitFiles = fs.readdirSync(dataDir).filter(f => /^kits\d*\.ts$/.test(f)).map(f => path.join(dataDir, f));
const contentFiles = walk(path.join(root, 'src', 'content')).filter(f => f.endsWith('.ts'));

const protectedNames = new Set();
for (const f of kitFiles) for (const m of fs.readFileSync(f, 'utf8').matchAll(/name: '((?:[^'\\]|\\.)*)'/g)) if (m[1].includes(' ')) protectedNames.add(m[1].replace(/\\'/g, "'"));
const word = from => new RegExp(`\\b${from}\\b`, 'g');

/** Replaces the old name in a piece of text, leaving any multi-word ability name that contains it untouched. */
function swap(text, r) {
  const masks = [];
  let out = text;
  for (const n of protectedNames) if (word(r.from).test(n) && out.includes(n)) { out = out.split(n).join(`\u0000${masks.length}\u0000`); masks.push(n); }
  out = out.replace(word(r.from), r.to);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[+i]);
}

let changed = 0;
function edit(file, fn) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let dirty = false;
  lines.forEach((line, i) => {
    const next = fn(line, `${rel}:${i + 1}`);
    if (next !== line) { changed++; dirty = true; if (dry) console.log(`${rel}:${i + 1}: ${next.trim().slice(0, 170)}`); lines[i] = next; }
  });
  if (dirty && !dry) fs.writeFileSync(file, lines.join('\n'));
}

for (const f of speciesFiles) edit(f, line => {
  for (const r of renames) if (line.includes(`id: '${r.id}'`)) line = line.replace(`name: '${r.from}'`, `name: '${r.to}'`);
  return line;
});

for (const f of kitFiles) edit(f, line => {
  for (const r of renames) {
    if (KEEP_TEXT.has(r.id) || !line.includes(`owner: '${r.id}'`)) continue;
    line = line.replace(/text: '((?:[^'\\]|\\.)*)'/g, (m, t) => `text: '${swap(t, r)}'`);
  }
  return line;
});

for (const f of contentFiles) edit(f, (line, where) => {
  for (const r of renames) {
    const points = line.includes(`mon: '${r.id}'`) || line.includes(`kindSprite('${r.id}')`) || line.includes(`SPECIES.${r.id}`);
    if (points || allow.has(where)) line = swap(line, r);
  }
  return line;
});

console.log(`${renames.length} renames, ${changed} lines ${dry ? 'would change' : 'changed'}.`);
