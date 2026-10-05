import { campaign } from '../sim/simlib';

// Shows how regular fights are won and lost inside a campaign run.
const runs = Array.from({ length: Number(process.argv[2] ?? 6) }, (_, i) => campaign('smart', 800 + i));
console.log('ch | fights | lost | start HP (won) | start HP (lost) | rounds (lost) | foes in lost fights');
for (let ch = 0; ch < 12; ch++) {
  const all = runs.flatMap((r) => r.chapters[ch].fights.filter((f) => !f.boss));
  const won = all.filter((f) => f.win), lost = all.filter((f) => !f.win);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const names: Record<string, number> = {};
  for (const f of lost) names[f.foes.join('+')] = (names[f.foes.join('+')] ?? 0) + 1;
  const top = Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k}x${v}`).join(' ');
  console.log(`${String(ch + 1).padStart(2)} | ${String(all.length).padStart(5)} | ${String(lost.length).padStart(4)} | ${(mean(won.map((f) => f.startHpFrac)) * 100).toFixed(0).padStart(6)}% | ${(mean(lost.map((f) => f.startHpFrac)) * 100).toFixed(0).padStart(7)}% | ${mean(lost.map((f) => f.rounds)).toFixed(1).padStart(6)} | ${top}`);
}

console.log('\nRegular win rate by fight index within the chapter (chapters 8 to 12 pooled):');
const byIdx: number[][] = Array.from({ length: 11 }, () => []);
for (const r of runs) for (let ch = 7; ch < 12; ch++) r.chapters[ch].fights.filter((f) => !f.boss).forEach((f, i) => { if (i < 11) byIdx[i].push(f.win ? 1 : 0); });
console.log(byIdx.map((a, i) => `${i}:${Math.round((100 * a.reduce((x, y) => x + y, 0)) / a.length)}%`).join(' '));

console.log('\nMean equipped gear tier at chapter start (expected chapter minus 1 in isolated tests):');
console.log(Array.from({ length: 12 }, (_, i) => (runs.reduce((a, r) => a + r.gearTier[i], 0) / runs.length).toFixed(1)).join(" "));

// Same chapter, two kinds of party: one from a played campaign and one built by setupChapter.
import { Rng } from '../core/rng';
import { campaignState, chapterState, fight, pickEncounter, REG_BONUS } from '../sim/simlib';
for (const ch of [6, 9, 12]) {
  const rng = new Rng(5);
  let a = 0, b = 0;
  const n = 60;
  const base = campaignState('smart', 901, ch);
  for (let i = 0; i < n; i++) {
    const s1 = structuredClone(base);
    s1.beat = 3;
    a += fight(s1, pickEncounter(ch, rng), false, 'smart', rng, 0.5, { noApply: true }).win ? 1 : 0;
    const s2 = chapterState(ch, undefined, REG_BONUS);
    b += fight(s2, pickEncounter(ch, rng), false, 'smart', rng, 0.5, { noApply: true }).win ? 1 : 0;
  }
  const lv = base.active.map((id) => base.roster.find((m) => m.id === id)!.lvl).join(',');
  console.log(`ch ${ch}: campaign-state win ${a}/${n} (levels ${lv}, party ${base.active.join('+')}) vs setup-state win ${b}/${n}`);
}
