import { Rng } from '../core/rng';
import { BOSSES } from '../data/enemies';
import { BOSS_BONUS, chapterState, fight } from '../sim/simlib';

// Usage: node abtest.js <chapter> <samples> <party> [party ...]   where a party is ids joined by commas.
const ch = Number(process.argv[2]);
const n = Number(process.argv[3]);
for (const p of process.argv.slice(4)) {
  const ids = p.split(',');
  const rng = new Rng(3);
  let w = 0, rounds = 0, hp = 0;
  const dmg: Record<string, number> = {};
  const heal: Record<string, number> = {};
  const used: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const s = chapterState(ch, ids, BOSS_BONUS);
    let last;
    for (const g of BOSSES[ch]) last = fight(s, g, true, 'smart', rng, 0.85, { noApply: true });
    w += last!.win ? 1 : 0; rounds += last!.rounds; hp += last!.hpLeft;
    for (const [k, v] of Object.entries(last!.dmgByChar)) dmg[k] = (dmg[k] ?? 0) + v;
    for (const [k, v] of Object.entries(last!.healByChar)) heal[k] = (heal[k] ?? 0) + v;
    for (const [k, v] of Object.entries(last!.actions)) used[k] = (used[k] ?? 0) + v;
  }
  const td = Object.values(dmg).reduce((x, y) => x + y, 0) || 1, th = Object.values(heal).reduce((x, y) => x + y, 0) || 1;
  console.log(`   dmg share: ${Object.entries(dmg).map(([k, v]) => k + ' ' + Math.round((100 * v) / td) + '%').join('  ')} | heal: ${Object.entries(heal).map(([k, v]) => k + ' ' + Math.round((100 * v) / th) + '%').join('  ')}`);
  if (process.env.USED) console.log('   actions/fight: ' + Object.entries(used).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + (v / n).toFixed(1)).join('  '));
  console.log(`${p.padEnd(32)} win ${Math.round((100 * w) / n)}%  rounds ${(rounds / n).toFixed(1)}  hp left ${Math.round((100 * hp) / n)}%`);
}
