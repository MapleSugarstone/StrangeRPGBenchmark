// Checks the score without playing it. Usage: node dist-tools/music.js. Writes Notes/music-check.md.
import fs from 'node:fs';
import path from 'node:path';
import { buildFont } from '../audio/font';
import { barNotes, figure, readingAt, settled, tempoOf } from '../audio/score';
import type { MusicState } from '../audio/score';

const lines: string[] = ['# Music check', ''];
let fail = 0;
const check = (ok: boolean, text: string) => { lines.push((ok ? 'PASS ' : 'FAIL ') + text); if (!ok) fail++; };

const font = buildFont();
lines.push('## Samples', '', '| Instrument | Seconds | Peak | Base frequency |', '|---|---|---|---|');
for (const [id, s] of Object.entries(font)) {
  let peak = 0, bad = 0;
  for (const v of s.data) { if (!Number.isFinite(v)) bad++; peak = Math.max(peak, Math.abs(v)); }
  lines.push(`| ${id} | ${(s.data.length / 32000).toFixed(2)} | ${peak.toFixed(2)} | ${s.base} |`);
  check(bad === 0 && peak > 0.3 && peak <= 1, `${id} is finite and peaks between 0.3 and 1`);
  check(Math.abs(s.data[s.data.length - 1]) < 0.01, `${id} ends at silence`);
}

function state(over: Partial<MusicState>): MusicState {
  return { mode: 'sheet', season: 2, decided: 0.5, lean: 0, lead: 'perch', level: false, intensity: 1, ...over };
}

lines.push('', '## Density and range', '', '| State | Tempo | Notes per bar | Most notes on one step | Lowest Hz | Highest Hz | Bars with a melody |', '|---|---|---|---|---|---|---|');
const cases: [string, MusicState][] = [
  ['title', state({ mode: 'title', season: 0 })],
  ['ending', state({ mode: 'ending', season: 6, decided: 1 })],
  ['battle, half pinned', state({ mode: 'battle', season: 4 })],
];
for (let season = 1; season <= 6; season++) for (const d of [0, 0.5, 1]) cases.push([`sheet ${39 + season}, decided ${d}`, state({ season, decided: d, intensity: 0.5 + d })]);
for (const lead of ['deed', 'auger', 'offset', 'lot', 'either']) cases.push([`sheet 43, ${lead} leads`, state({ season: 4, lead, lean: 1 })]);
cases.push(['sheet 44 with the Level', state({ season: 5, level: true })]);
for (const [name, st] of cases) {
  let total = 0, maxStep = 0, lo = 1e9, hi = 0, melodic = 0;
  for (let bar = 0; bar < 16; bar++) {
    const notes = barNotes(st, bar);
    total += notes.length;
    const per = new Map<number, number>();
    let hasLead = false;
    for (const n of notes) {
      per.set(Math.floor(n.step), (per.get(Math.floor(n.step)) ?? 0) + 1);
      if (n.freq > 0) { lo = Math.min(lo, n.freq); hi = Math.max(hi, n.freq); }
      if (n.inst === 'ruler' || n.inst === 'bottle' || (n.inst === 'glass' && st.lead === 'lot') || (n.inst === 'band' && st.lead === 'auger')) hasLead = true;
      if (!(n.gain > 0 && n.gain <= 0.7) || n.step < 0 || n.step >= 17) fail++;
    }
    if (hasLead) melodic++;
    for (const v of per.values()) maxStep = Math.max(maxStep, v);
  }
  lines.push(`| ${name} | ${tempoOf(st)} | ${(total / 16).toFixed(1)} | ${maxStep} | ${lo.toFixed(0)} | ${hi.toFixed(0)} | ${melodic}/16 |`);
  check(total / 16 >= 4 && total / 16 <= 60, `${name}: 4 to 60 notes a bar`);
  check(maxStep <= 9, `${name}: at most 9 notes start on one step`);
  check(lo >= 40 && hi <= 4200, `${name}: pitches stay between 40 and 4200 Hz`);
  check(melodic >= 12, `${name}: a melody sounds in at least 12 of 16 bars`);
}

lines.push('', '## The two readings', '');
const neutral = (st: MusicState) => { let n = 0, all = 0; for (let bar = 0; bar < 16; bar++) for (let s = 0; s < 16; s++) { all++; if (!settled(st, s, bar)) n++; } return n / all; };
check(neutral(state({ decided: 0 })) === 1, 'at decided 0 every step is unsettled, so thirds, sixths, and sevenths are neutral');
check(neutral(state({ decided: 1 })) === 0, 'at decided 1 every step is settled, so every interval is plain major or minor');
const mid = neutral(state({ decided: 0.5 }));
check(mid > 0.35 && mid < 0.65, `at decided 0.5 about half the steps are unsettled (${(mid * 100).toFixed(0)}%)`);
let aCount = 0, bCount = 0;
for (let bar = 0; bar < 16; bar++) for (let s = 0; s < 16; s++) { if (readingAt(state({ decided: 0 }), s, bar) === 0) aCount++; else bCount++; }
check(aCount === bCount, 'at decided 0 the two readings share the steps evenly');
let onlyLean = true;
for (let bar = 0; bar < 16; bar++) for (let s = 0; s < 16; s++) if (readingAt(state({ decided: 1, lean: 1 }), s, bar) !== 1) onlyLean = false;
check(onlyLean, 'at decided 1 only the leaning reading sounds');
const freqs = (st: MusicState) => barNotes(st, 0).filter((n) => n.freq > 0).map((n) => n.freq.toFixed(1)).join(',');
check(freqs(state({ decided: 1, lean: 0 })) !== freqs(state({ decided: 1, lean: 1 })), 'the major and minor readings differ in pitch');
check(freqs(state({ decided: 0 })) !== freqs(state({ decided: 1, lean: 0 })), 'the undecided bar differs from the decided bar');

lines.push('', '## Turn figures', '');
const sigs = new Set<string>();
for (const who of ['perch', 'deed', 'auger', 'offset', 'lot', 'either', 'level']) {
  const f = figure(who);
  sigs.add(f.map((n) => n.inst + n.freq.toFixed(0) + '@' + n.step).join(' '));
  check(f.length >= 2 && f.length <= 5, `${who} has a figure of 2 to 5 notes`);
}
check(sigs.size === 7, 'every party has a different figure');

lines.push('', fail ? `${fail} checks failed.` : 'All checks passed.', '', 'The check cannot say whether the instruments sound good together or whether the theme is memorable. A person has to listen.');
const out = path.resolve('Notes', 'music-check.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(lines.filter((l) => l.startsWith('FAIL') || l.startsWith('|') || l.startsWith('All') || l.includes('failed')).join('\n'));
process.exit(fail ? 1 : 0);
