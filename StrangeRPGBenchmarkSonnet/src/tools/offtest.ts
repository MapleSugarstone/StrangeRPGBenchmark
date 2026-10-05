import { Rng } from '../core/rng';
import { memberStats } from '../core/party';
import { BOSSES } from '../data/enemies';
import { BOSS_BONUS, chapterState, fight } from '../sim/simlib';

// Usage: node offtest.js <chapter> <samples> <offsets comma list> [party]
const ch = Number(process.argv[2]);
const n = Number(process.argv[3]);
const offs = (process.argv[4] ?? '-2,0,2').split(',').map(Number);
const ids = process.argv[5]?.split(',');
for (const off of offs) {
  const rng = new Rng(11);
  let w = 0, rounds = 0;
  const used: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const s = chapterState(ch, ids, BOSS_BONUS);
    for (const m of s.roster) { m.lvl = Math.max(1, m.lvl + off); const st = memberStats(m); m.hp = st.hp; m.mp = st.mp; }
    let last;
    for (const g of BOSSES[ch]) last = fight(s, g, true, 'smart', rng, 0.85, { noApply: true });
    w += last!.win ? 1 : 0; rounds += last!.rounds;
    for (const [k, v] of Object.entries(last!.actions)) used[k] = (used[k] ?? 0) + v;
  }
  if (process.env.USED) console.log("   " + Object.entries(used).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, v]) => k + " " + (v / n).toFixed(1)).join("  "));
  console.log(`offset ${off >= 0 ? '+' : ''}${off}: win ${Math.round((100 * w) / n)}%  rounds ${(rounds / n).toFixed(1)}`);
}
