// Blends one word per kind from each of two languages into name options for the review page.
// Reads Notes/names/{latin,finnish,japanese}.txt and Notes/names/fudge.json, writes review/names.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const notes = path.join(root, 'Notes', 'names');
const LANGS = [['latin', 'Latin'], ['finnish', 'Finnish'], ['japanese', 'Japanese']];
const PAIRS = [[0, 1], [1, 2], [0, 2]];

const lists = LANGS.map(([f]) => Object.fromEntries(fs.readFileSync(path.join(notes, f + '.txt'), 'utf8').trim().split(/\r?\n/).map(l => l.trim().split(/\s+/))));
const kinds = JSON.parse(fs.readFileSync(path.join(root, 'review', 'whorls.json'), 'utf8')).kinds;
const fudgeFile = path.join(notes, 'fudge.json');
const fudge = fs.existsSync(fudgeFile) ? JSON.parse(fs.readFileSync(fudgeFile, 'utf8')) : {};
const current = kinds.map(k => k.name.toLowerCase());

const VOWELS = 'aeiou';
const DIGRAPHS = ['sh', 'ch', 'ts', 'ph', 'th', 'qu'];
const ONSETS = new Set(['tr', 'pr', 'br', 'gr', 'cr', 'dr', 'fr', 'pl', 'bl', 'cl', 'gl', 'fl', 'sk', 'st', 'sp']);
const CLUSTERS3 = new Set(['str', 'scr', 'spr', 'spl', 'nch', 'ntr', 'ndr', 'mbr', 'mpl', 'rch', 'lch', 'tch', 'sch', 'ght', 'nth', 'rth', 'ngl', 'ngr', 'nkl', 'rst', 'nst', 'mpr', 'lst']);
const RUDE = ['shit', 'fuck', 'fuk', 'fuc', 'cunt', 'kunt', 'cock', 'cok', 'dick', 'dik', 'piss', 'anus', 'rape', 'slut', 'whor', 'fag', 'nazi', 'cum', 'tit', 'poo', 'butt', 'nig', 'porn', 'sex', 'turd', 'arse', 'ass', 'kill', 'dumb', 'gay', 'homo', 'jew', 'spic', 'kike', 'wank', 'puke', 'vomit', 'dung', 'pee', 'inri', 'hodor', 'hohdor', 'kabuto', 'gabuto'];

const isVowel = (w, i) => VOWELS.includes(w[i]) || (w[i] === 'y' && !VOWELS.includes(w[i + 1] || ''));

/** Units: digraphs count as one consonant. Each unit is [text, isVowel]. */
function units(w) {
  const out = [];
  for (let i = 0; i < w.length;) {
    const two = w.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) { out.push([two, false]); i += 2; continue; }
    out.push([w[i], isVowel(w, i)]); i++;
  }
  return out;
}

function syllables(w) {
  const u = units(w), groups = [];
  for (let i = 0; i < u.length; i++) if (u[i][1] && (i === 0 || !u[i - 1][1])) groups.push(i);
  if (groups.length < 2) return [w];
  const cuts = [];
  for (let g = 1; g < groups.length; g++) {
    let end = groups[g], start = end;
    while (start > 0 && !u[start - 1][1]) start--;
    const n = end - start;
    if (n === 0) cuts.push(end);
    else if (n === 1) cuts.push(start);
    else { const last2 = u[end - 2][0] + u[end - 1][0]; cuts.push(ONSETS.has(last2) ? end - 2 : end - 1); }
  }
  const out = []; let from = 0;
  for (const c of [...cuts, u.length]) { out.push(u.slice(from, c).map(x => x[0]).join('')); from = c; }
  return out.filter(Boolean);
}

function vowelGroups(w) { let n = 0; for (let i = 0; i < w.length; i++) if (isVowel(w, i) && (i === 0 || !isVowel(w, i - 1))) n++; return n; }

/** With `loose`, a name may run to 10 letters and 4 syllables, for word pairs where nothing shorter passes. */
function check(w, loose = false) {
  if (w.length < 4 || w.length > (loose ? 10 : 9)) return false;
  const g = vowelGroups(w);
  if (g < 2 || g > (loose ? 4 : 3)) return false;
  if (/(.)\1\1|(..)\2/.test(w)) return false;
  if (/aa|ii|uu|yy|[aeiouy]{3}/.test(w)) return false;
  if (/q(?!u)/.test(w)) return false;
  if (/[jvqcw]$/.test(w) || (/h$/.test(w) && !/(sh|ch|th)$/.test(w))) return false;
  if (/^(ts|ng|nk|rk|mk|ht|ks)/.test(w)) return false;
  const u = units(w); let run = '';
  for (const [t, v] of u) {
    if (v) { run = ''; continue; }
    run += t.length > 1 ? t[0] : t;
    if (run.length >= 3 && !CLUSTERS3.has(run.slice(-3))) return false;
    if (run.length >= 4) return false;
  }
  if (RUDE.some(r => w.includes(r))) return false;
  if (current.includes(w)) return false;
  return true;
}

function score(w, a, b) {
  let s = 0;
  s += w.length >= 5 && w.length <= 7 ? 3 : w.length === 8 || w.length === 4 ? 1 : 0;
  if (/[aeioulnrs]$/.test(w)) s += 1;
  if (Math.min(a, b) >= 3) s += 1;
  if (/kk|pp|hh|jj|vv|tt.$/.test(w)) s -= 1;
  if (/uo|yo|ie|ae|ao|eo|ua|ui/.test(w)) s -= 0.5;
  if (/j/.test(w)) s -= 0.5;
  if (/[^aeiou]y[^aeiou]/.test(w)) s -= 0.5;
  if (/x|z.$/.test(w)) s -= 0.3;
  return s;
}

function blends(w1, w2, loose = false) {
  const s1 = syllables(w1), s2 = syllables(w2), out = [];
  for (const [x, y, sx, sy] of [[w1, w2, s1, s2], [w2, w1, s2, s1]]) {
    for (let i = 1; i <= sx.length; i++) for (let j = 0; j < sy.length; j++) {
      // A whole word followed by a whole word is a compound rather than a blend.
      if (i === sx.length && j === 0) continue;
      const head = sx.slice(0, i).join(''), tail = sy.slice(j).join('');
      if (head.length < 2 || tail.length < 2) continue;
      const w = head + tail;
      if (w === x || w === y || !check(w, loose)) continue;
      out.push({ w, s: score(w, head.length, tail.length) - (loose ? 1 : 0) });
    }
  }
  if (!out.length && !loose) return blends(w1, w2, true);
  return out.sort((p, q) => q.s - p.s);
}

function dist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const cap = w => w[0].toUpperCase() + w.slice(1);
const chosen = [];
const result = {};
let stuck = 0;
for (const k of kinds) {
  const words = lists.map(l => l[k.id]);
  if (words.some(w => !w)) { console.log('missing word for', k.id); continue; }
  const options = [];
  for (const [p, q] of PAIRS) {
    const cands = blends(words[p], words[q]);
    const apart = (c, n) => current.every(x => dist(x, c.w) >= n) && chosen.every(x => dist(x, c.w) >= n) && options.every(o => dist(o.name.toLowerCase(), c.w) >= 2);
    let pick = cands.find(c => apart(c, 3)) || cands.find(c => apart(c, 2));
    if (!pick) { pick = cands.find(c => !chosen.includes(c.w)) || { w: (words[p].slice(0, 3) + words[q].slice(-3)) }; stuck++; }
    chosen.push(pick.w);
    options.push({ name: cap(pick.w), from: `${words[p]} (${LANGS[p][1]}) + ${words[q]} (${LANGS[q][1]})` });
  }
  for (const [i, f] of Object.entries(fudge[k.id] || {})) options[+i] = { ...options[+i], name: f.name, fudge: f.fudge };
  result[k.id] = { current: k.name, options };
}
fs.writeFileSync(path.join(root, 'review', 'names.json'), JSON.stringify(result, null, 1));
if (process.argv.includes('--list')) for (const [id, r] of Object.entries(result)) console.log(`${id}: ${r.options.map(o => o.name).join(' | ')}`);
console.log(`${Object.keys(result).length} kinds, ${stuck} options fell back past the distance check.`);
