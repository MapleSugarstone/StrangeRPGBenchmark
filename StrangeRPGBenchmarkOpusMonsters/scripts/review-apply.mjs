// Writes the sprites kept in the review page (review/choices.json) into the species and kits files.
// A pick is a design index from review/candidates.json, 'custom' for one drawn in the editor, or 'current' to leave it.
// People sprites (`person:<id>`) go back into their person(...) call in src/engine/sprites.ts.
// Usage: node scripts/review-apply.mjs [--dry] [--choices <file>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');
const read = f => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
const ci = process.argv.indexOf('--choices');
const choices = read(ci > 0 ? path.resolve(process.argv[ci + 1]) : path.join(root, 'review', 'choices.json'));
const spritesFile = path.join(root, 'src', 'engine', 'sprites.ts');
const cands = read(path.join(root, 'review', 'candidates.json'));
const files = fs.readdirSync(path.join(root, 'src', 'data')).filter(f => /^species\d*\.ts$/.test(f)).map(f => path.join(root, 'src', 'data', f));
const text = Object.fromEntries(files.map(f => [f, fs.readFileSync(f, 'utf8')]));

const valid = d => d && Array.isArray(d.px) && d.px.length === 8 && d.px.every(r => typeof r === 'string' && /^[.1234]{8}$/.test(r))
  && Array.isArray(d.c) && d.c.length >= 2 && d.c.every(c => /^#[0-9a-fA-F]{6}$/.test(c));
const lit = arr => `[${arr.map(s => `'${s}'`).join(', ')}]`;

// Summon and form sprites live in the kits files: `summon:<id>` in its defSummon, `form:<const>` in its SpriteData constant.
const kitFiles = fs.readdirSync(path.join(root, 'src', 'data')).filter(f => /^kits\d*\.ts$/.test(f)).map(f => path.join(root, 'src', 'data', f));
for (const f of kitFiles) text[f] = fs.readFileSync(f, 'utf8');
const pic = d => `{ px: ${lit(d.px)}, c: ${lit(d.c.slice(0, 3))} }`;

function applyPart(id, design) {
  if (id.startsWith('summon:')) {
    const sid = id.slice(7);
    const file = kitFiles.find(f => text[f].includes(`defSummon({ id: '${sid}',`));
    if (!file) return `${id}: no defSummon found`;
    const start = text[file].indexOf(`defSummon({ id: '${sid}',`);
    const ends = ['\ndef', '\nconst ', '\nexport ', '\n//'].map(s => text[file].indexOf(s, start + 1)).filter(n => n > 0);
    const end = ends.length ? Math.min(...ends) : text[file].length;
    const block = text[file].slice(start, end);
    // Look for the field itself: a sprite already applied rewrites to the same text, which is not the same as having none.
    const inline = /sprite: \{ px: \[[^\]]*\], c: \[[^\]]*\] \}/;
    const shared = block.match(/sprite: ([A-Z][A-Z0-9_]*)\b/);
    let next = block;
    if (inline.test(block)) next = block.replace(inline, `sprite: ${pic(design)}`);
    else if (shared) return applyPart(`form:${shared[1].toLowerCase()}`, design);
    else {
      next = block.replace(/(owner: '[a-z0-9]+', )/, `$1sprite: ${pic(design)}, `);
      if (next === block) return `${id}: could not place the sprite in its defSummon`;
    }
    text[file] = text[file].slice(0, start) + next + text[file].slice(end);
    return null;
  }
  const name = id.slice(5).toUpperCase();
  const re = new RegExp(`const ${name}: SpriteData = \\{ px: \\[[^\\]]*\\], c: \\[[^\\]]*\\] \\};`);
  const file = kitFiles.find(f => re.test(text[f]));
  if (!file) return `${id}: no SpriteData constant ${name} found`;
  text[file] = text[file].replace(re, `const ${name}: SpriteData = ${pic(design)};`);
  return null;
}

text[spritesFile] = fs.readFileSync(spritesFile, 'utf8');

/** A person's sprite: the rows and two or three colors in its person('id', [...], 'a', 'b', 'hair') call. */
function applyPerson(id, design) {
  const pid = id.slice(7);
  const re = new RegExp(`person\\('${pid}', \\[[^\\]]*\\], '#[0-9a-fA-F]{6}', '#[0-9a-fA-F]{6}'(?:, '#[0-9a-fA-F]{6}')?\\);`);
  if (!re.test(text[spritesFile])) return `${id}: no person('${pid}', ...) call found`;
  const cs = design.c.slice(0, 3).map(c => `'${c}'`).join(', ');
  text[spritesFile] = text[spritesFile].replace(re, `person('${pid}', ${lit(design.px)}, ${cs});`);
  return null;
}

let done = 0;
const problems = [];
for (const [id, ch] of Object.entries(choices)) {
  if (ch.pick === undefined || ch.pick === null || ch.pick === 'current') continue;
  const design = ch.pick === 'custom' ? ch.custom : cands[id]?.designs?.[ch.pick];
  if (!valid(design)) { problems.push(`${id}: the kept design is missing or malformed`); continue; }
  if (id.startsWith('person:')) { const p = applyPerson(id, design); if (p) problems.push(p); else done++; continue; }
  if (id.startsWith('summon:') || id.startsWith('form:')) { const p = applyPart(id, design); if (p) problems.push(p); else done++; continue; }
  const file = files.find(f => text[f].includes(`sp({ id: '${id}',`));
  if (!file) { problems.push(`${id}: no species entry found`); continue; }
  const start = text[file].indexOf(`sp({ id: '${id}',`);
  const end = text[file].indexOf('});', start);
  const block = text[file].slice(start, end);
  const spriteRe = /sprite: \[[^\]]*\], c: \[[^\]]*\]/;
  // A sprite already applied rewrites to the same text, so look for the field rather than for a change.
  if (!spriteRe.test(block)) { problems.push(`${id}: could not find "sprite: [...], c: [...]" in its entry`); continue; }
  const next = block.replace(spriteRe, `sprite: ${lit(design.px)}, c: ${lit(design.c.slice(0, 3))}`);
  text[file] = text[file].slice(0, start) + next + text[file].slice(end);
  done++;
}
if (!dry) for (const f of [...files, ...kitFiles, spritesFile]) fs.writeFileSync(f, text[f]);
// With --dry and --choices, print what the sprites file would hold for each person, so a test can check it without writing.
if (dry && ci > 0) for (const id of Object.keys(choices).filter(k => k.startsWith('person:'))) console.log(text[spritesFile].match(new RegExp(`person\\('${id.slice(7)}', [^\\n]*`))?.[0] || `${id}: not found`);
console.log(`${dry ? 'Would apply' : 'Applied'} ${done} kept sprites.`);
for (const p of problems) console.log('  ' + p);
