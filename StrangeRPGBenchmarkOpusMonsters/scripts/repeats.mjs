// Lists repeated phrasing across all game text, from the last `lines.mjs export`, into dialogue/repeats.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const side = JSON.parse(fs.readFileSync(path.join(root, 'dialogue', '.export.json'), 'utf8'));
const lines = Object.entries(side.lines).map(([id, l]) => ({ id, who: l.who, text: l.text.replace(/\{[^}]*\}/g, 'X') }));
const MIN = Number(process.argv.find(a => a.startsWith('--min='))?.slice(6) || 4);

const STOP = new Set('a an the and or but of to in on at for with it its it\'s is are was be i you he she we they this that there here my your his her our their me him them do does did not no so if as by from up out off'.split(' '));
const words = s => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const tally = () => new Map();
const add = (m, k, l) => { if (!m.has(k)) m.set(k, []); m.get(k).push(l); };

const grams = tally(), openers = tally(), endings = tally(), tails = tally();
for (const l of lines) {
  const w = words(l.text);
  for (const n of [3, 4, 5]) {
    const seen = new Set();
    for (let i = 0; i + n <= w.length; i++) {
      const g = w.slice(i, i + n);
      if (g.filter(x => !STOP.has(x)).length < 2 || seen.has(g.join(' '))) continue;
      seen.add(g.join(' '));
      add(grams, g.join(' '), l);
    }
  }
  if (w.length >= 3) { add(openers, w.slice(0, 2).join(' '), l); add(endings, w.slice(-2).join(' '), l); }
  // A short last sentence after a longer line: the "fact, then a dry afterthought" shape.
  const sents = l.text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sents.length >= 2) {
    const last = words(sents[sents.length - 1]);
    if (last.length > 0 && last.length <= 3) add(tails, last.join(' '), l);
  }
}

const TICS = { 'kinda': /\bkinda\b/i, 'yeah': /\byeah\b/i, 'uh': /\buh\b/i, 'um': /\bum\b/i, 'okay': /\bokay\b/i, 'mostly': /\bmostly\b/i,
  'though': /\bthough\b/i, 'anyway': /\banyways?\b/i, 'just': /\bjust\b/i, 'really': /\breally\b/i, 'actually': /\bactually\b/i,
  ':-] and :-)': /:-[\])]/, ':-(': /:-\(/, '!! or more': /!!/, '?? or more': /\?\?/, 'a line of ...': /^\.\.\.$/, '... inside a line': /.\.\.\./,
  'parenthetical aside': /\([a-z][^)]*\)$/, 'cut off with a hyphen': /\w-(\s|$)/, 'ALL CAPS word': /\b[A-Z]{4,}\b/ };

const total = lines.length;
const fmt = (k, list, max = 6) => {
  const who = tally();
  for (const l of list) add(who, l.who, l);
  const speakers = [...who].sort((a, b) => b[1].length - a[1].length).map(([w, ls]) => `${w} ${ls.length}`).join(', ');
  const samples = list.slice(0, max).map(l => `  - [${l.id}] ${l.who}: ${l.text}`).join('\n');
  return `- **${k}** (${list.length}) from ${speakers}\n${samples}`;
};
const top = (m, min, limit) => [...m].filter(([, ls]) => ls.length >= min).sort((a, b) => b[1].length - a[1].length).slice(0, limit);

const out = [
  '# Repeated phrasing', '',
  `${total} lines from the export of ${side.created}. A phrase that comes from one speaker may be their running joke. A phrase spread across many speakers is usually an accident.`, '',
  '## Tics and marks', '',
  ...Object.entries(TICS).map(([k, re]) => { const n = lines.filter(l => re.test(l.text)).length; return `- ${k}: ${n} lines (${(100 * n / total).toFixed(1)}%)`; }), '',
  `## Phrases of three to five words used in ${MIN} or more lines`, '',
  ...top(grams, MIN, 80).map(([k, ls]) => fmt(k, ls)), '',
  '## Line openings used in 8 or more lines', '',
  ...top(openers, 8, 40).map(([k, ls]) => fmt(k, ls, 4)), '',
  '## Line endings used in 8 or more lines', '',
  ...top(endings, 8, 40).map(([k, ls]) => fmt(k, ls, 4)), '',
  '## Short last sentences (three words or fewer) used in 3 or more lines', '',
  ...top(tails, 3, 60).map(([k, ls]) => fmt(k, ls, 4)), '',
];
fs.writeFileSync(path.join(root, 'dialogue', 'repeats.md'), out.join('\n'));
console.log(`Wrote dialogue/repeats.md from ${total} lines.`);
