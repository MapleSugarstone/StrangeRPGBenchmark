import { Rng } from '../core/rng';
import { CHARS } from '../data/characters';
import { BOSSES } from '../data/enemies';
import { chapterState, BOSS_BONUS, REG_BONUS, fight } from '../sim/simlib';

// Usage: node combos.js <chapter> <samples>. Lists every four-member party containing Wick.
const ch = Number(process.argv[2] ?? 5);
const n = Number(process.argv[3] ?? 16);
const roster = CHARS.filter((c) => c.joinChapter <= ch).map((c) => c.id).filter((i) => i !== 'wick');
const res: [string, number][] = [];
const pick = (arr: string[], k: number): string[][] => (k === 0 ? [[]] : arr.flatMap((x, i) => pick(arr.slice(i + 1), k - 1).map((r) => [x, ...r])));
for (const c of pick(roster, 3)) {
  const ids = ['wick', ...c];
  const rng = new Rng(99);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const s = chapterState(ch, ids, BOSS_BONUS);
    let last;
    for (const g of BOSSES[ch]) last = fight(s, g, true, 'smart', rng, 0.85, { noApply: true });
    w += last!.win ? 1 : 0;
  }
  res.push([ids.join('+'), w / n]);
}
res.sort((a, b) => a[1] - b[1]);
for (const [k, v] of res) console.log(`${(v * 100).toFixed(0).padStart(3)}%  ${k}`);
