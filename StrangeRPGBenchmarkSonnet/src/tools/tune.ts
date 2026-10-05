import { CHAPTER_LEVEL } from '../data/characters';
import { Rng } from '../core/rng';
import { BOSSES } from '../data/enemies';
import type { Policy } from '../core/bots';
import { campaign, chapterState, BOSS_BONUS, REG_BONUS, fight, pickEncounter } from '../sim/simlib';

import { TUNE } from '../data/enemies';
if (process.env.HP) TUNE.hp = Number(process.env.HP);
if (process.env.ATK) TUNE.atk = Number(process.env.ATK);
const N = Number(process.argv[2] ?? 60);
const policies: Policy[] = ['smart', 'mash'];
const pct = (x: number) => (x * 100).toFixed(0).padStart(3) + '%';
const f1 = (x: number) => x.toFixed(1).padStart(5);

console.log('=== Isolated fights at expected level (per chapter) ===');
console.log('ch | policy | reg win  hpLeft rounds | boss win  hpLeft rounds');
for (let ch = 1; ch <= 12; ch++) {
  for (const p of policies) {
    const rng = new Rng(ch * 1000 + 7);
    let rw = 0, rh = 0, rr = 0, bw = 0, bh = 0, br = 0;
    for (let i = 0; i < N; i++) {
      const s = chapterState(ch, undefined, REG_BONUS);
      const r = fight(s, pickEncounter(ch, rng), false, p, rng, 0.5, { noApply: true });
      rw += r.win ? 1 : 0; rh += r.hpLeft; rr += r.rounds;
      const s2 = chapterState(ch, undefined, BOSS_BONUS);
      let last;
      for (const g of BOSSES[ch]) last = fight(s2, g, true, p, rng, 0.85, { noApply: true });
      bw += last!.win ? 1 : 0; bh += last!.hpLeft; br += last!.rounds;
    }
    console.log(`${String(ch).padStart(2)} | ${p.padEnd(5)} | ${pct(rw / N)} ${pct(rh / N)} ${f1(rr / N)} | ${pct(bw / N)} ${pct(bh / N)} ${f1(br / N)}`);
  }
}

console.log('\n=== Campaign (smart) ===');
const res = Array.from({ length: Math.max(3, N / 10) }, (_, i) => campaign('smart', 100 + i));
console.log('ch | target lvl | lvl at start | lvl end | fight win | boss tries | gold');
for (let ch = 0; ch < 12; ch++) {
  const avg = (f: (r: typeof res[0]) => number) => res.reduce((a, r) => a + f(r), 0) / res.length;
  const wins = avg((r) => r.chapters[ch].fights.filter((x) => !x.boss && x.win).length / r.chapters[ch].fights.filter((x) => !x.boss).length);
  console.log(`${String(ch + 1).padStart(2)} | ${String(CHAPTER_LEVEL[ch + 1]).padStart(4)} | ${f1(avg((r) => r.levelsAtStart[ch]))} | ${f1(avg((r) => r.chapters[ch].levelEnd))} | ${pct(wins)} | ${f1(avg((r) => r.chapters[ch].bossAttempts))} | ${f1(avg((r) => r.chapters[ch].goldGained))}`);
}
