// AI against AI: two versions of the AI play the same random teams from both seats, so only the AI differs.
// Usage: node dist-tools/aibench.js [pairs] [--seed=N] --a=reserves,dots --b=   (switches from AiOpts in src/battle/ai.ts)
import { actJoint, act, advance, newBattle, roundOf } from '../battle/engine';
import { choose, chooseReplacement, setAiOpts, type AiOpts } from '../battle/ai';
import type { Mon } from '../battle/model';
import { WILD_KINDS, makeMon } from '../data/species';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const PAIRS = Number(args.find(a => /^\d+$/.test(a)) || 100);
let seed = Number((args.find(a => a.startsWith('--seed=')) || '--seed=5').slice(7));
const optsOf = (key: string): Partial<AiOpts> => {
  const raw = (args.find(a => a.startsWith(`--${key}=`)) || `--${key}=`).slice(key.length + 3);
  return Object.fromEntries(raw.split(',').filter(Boolean).map(k => [k, true]));
};
const A = optsOf('a'), B = optsOf('b');
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const team = (): Mon[] => { const s = new Set<string>(); while (s.size < 4) s.add(WILD_KINDS[Math.floor(rnd() * WILD_KINDS.length)]); return [...s].map(k => makeMon(k, 25)); };

const time = { a: 0, b: 0 }, calls = { a: 0, b: 0 };
let winsA = 0, winsB = 0, draws = 0, rounds = 0;
const t0 = Date.now();
for (let n = 0; n < PAIRS; n++) {
  const t1 = team(), t2 = team();
  for (const seat of [0, 1] as const) {
    // seat 0: version A plays side 0. seat 1: version A plays side 1.
    const who = (side: 0 | 1): 'a' | 'b' => (side === seat ? 'a' : 'b');
    setAiOpts(0, who(0) === 'a' ? A : B);
    setAiOpts(1, who(1) === 'a' ? A : B);
    const b = newBattle({ mons: t1.map(m => ({ ...m })), name: 'S', ai: 'keeper' }, { mons: t2.map(m => ({ ...m })), name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    const pick = (side: 0 | 1) => { const s = Date.now(); const a = choose(b, side); time[who(side)] += Date.now() - s; calls[who(side)]++; return a; };
    for (let i = 0; i < 600 && b.over === null; i++) {
      const d = advance(b, chooseReplacement);
      if (d.kind === 'over') break;
      if (d.kind === 'joint') { const a0 = pick(0), a1 = pick(1); actJoint(b, a0, a1); }
      else if (d.kind === 'act') act(b, pick(d.side));
    }
    rounds += roundOf(b);
    if (b.over === 0 || b.over === 1) { if (who(b.over) === 'a') winsA++; else winsB++; } else draws++;
  }
}
setAiOpts(0, null); setAiOpts(1, null);
const games = PAIRS * 2, rate = winsA / Math.max(1, winsA + winsB);
const ci = 1.96 * Math.sqrt(rate * (1 - rate) / Math.max(1, winsA + winsB));
const label = (o: Partial<AiOpts>) => Object.keys(o).join('+') || 'default';
console.log(`A (${label(A)}) against B (${label(B)}): ${games} games on ${PAIRS} team pairs, both seats.`);
console.log(`A wins ${(100 * rate).toFixed(1)}% (+/- ${(100 * ci).toFixed(1)}), draws ${draws}, mean rounds ${(rounds / games).toFixed(1)}.`);
console.log(`ms per decision: A ${(time.a / Math.max(1, calls.a)).toFixed(1)}, B ${(time.b / Math.max(1, calls.b)).toFixed(1)}. Took ${((Date.now() - t0) / 1000).toFixed(0)}s.`);
