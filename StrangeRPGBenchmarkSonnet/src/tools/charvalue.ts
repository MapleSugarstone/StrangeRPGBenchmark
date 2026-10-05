import { Rng } from '../core/rng';
import { CHARS } from '../data/characters';
import { BOSSES } from '../data/enemies';
import { chapterState, BOSS_BONUS, REG_BONUS, fight } from '../sim/simlib';

// Marginal value of each partymate: mean boss win rate of every four-member party containing them (Wick always included).
const chapters = (process.argv[2] ?? '4,7,10,12').split(',').map(Number);
const n = Number(process.argv[3] ?? 8);
const pick = (arr: string[], k: number): string[][] => (k === 0 ? [[]] : arr.flatMap((x, i) => pick(arr.slice(i + 1), k - 1).map((r) => [x, ...r])));

console.log(`Marginal boss win rate by character (${n} fights per party).`);
console.log('ch | ' + CHARS.map((c) => c.name.slice(0, 6).padEnd(6)).join(' '));
for (const ch of chapters) {
  const roster = CHARS.filter((c) => c.joinChapter <= ch && c.id !== 'wick').map((c) => c.id);
  const sum: Record<string, number> = {};
  const cnt: Record<string, number> = {};
  let total = 0, parties = 0;
  for (const combo of pick(roster, Math.min(3, roster.length))) {
    const ids = ['wick', ...combo];
    const rng = new Rng(ch * 7 + 1);
    let w = 0;
    for (let i = 0; i < n; i++) {
      const s = chapterState(ch, ids, BOSS_BONUS);
      let last;
      for (const g of BOSSES[ch]) last = fight(s, g, true, 'smart', rng, 0.85, { noApply: true });
      w += last!.win ? 1 : 0;
    }
    const rate = w / n;
    total += rate; parties++;
    for (const id of ids) { sum[id] = (sum[id] ?? 0) + rate; cnt[id] = (cnt[id] ?? 0) + 1; }
  }
  console.log(`${String(ch).padStart(2)} | ` + CHARS.map((c) => (cnt[c.id] ? `${Math.round((100 * sum[c.id]) / cnt[c.id])}%`.padEnd(6) : '-'.padEnd(6))).join(' ') + `  mean ${Math.round((100 * total) / parties)}% over ${parties} parties`);
}
