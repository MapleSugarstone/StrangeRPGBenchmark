// Headless balance simulator. AI against AI at level 25. Reports kind, move, and type balance and fun metrics.
// Usage: node dist-tools/sim.js [battles] [--seed=N] [--fits]
import { act, advance, hpShare, newBattle, roundOf } from '../battle/engine';
import { aiStats, choose, chooseReplacement } from '../battle/ai';
import type { Battle, Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { NOTION_IDS } from '../data/notions';
import { SPECIES, WILD_KINDS, makeMon } from '../data/species';
import { TYPES } from '../data/types';
import { randomFit } from '../game/wildfit';

declare const process: { argv: string[] };
let seed = 1;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

export interface Result {
  winner: 0 | 1 | 'draw'; actions: number; leadChanges: number; interrupts: number; bigMoves: number; switches: number;
  endGap: number; comeback: boolean; maxDeficit: number; kos: number; firstMoverWon: boolean; rounds: number; fatigued: boolean;
}

const KINDS: Record<string, number> = {};
const MOVE_USE: Record<string, [number, number]> = {};

export function runBattle(a: Mon[], z: Mon[]): Result {
  const b: Battle = newBattle({ mons: a, name: 'A', ai: 'keeper' }, { mons: z, name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
  b.quiet = true;
  const firstMover = b.s[0].next <= b.s[1].next ? 0 : 1;
  let worst0 = 0, worst1 = 0;
  const used: [number, string][] = [];
  for (let i = 0; i < 500; i++) {
    const d = advance(b, chooseReplacement);
    if (d.kind === 'over') break;
    if (d.kind === 'act') {
      const a2 = choose(b);
      KINDS[a2.k] = (KINDS[a2.k] || 0) + 1;
      if (a2.k === 'move') used.push([d.side, b.s[d.side].f[b.s[d.side].out].moves[a2.i]]);
      act(b, a2);
      const diff = hpShare(b, 0) - hpShare(b, 1);
      worst0 = Math.min(worst0, diff);
      worst1 = Math.min(worst1, -diff);
    }
  }
  const w = b.over === 0 ? 0 : b.over === 1 ? 1 : 'draw';
  for (const [side, id] of used) { const u = (MOVE_USE[id] ||= [0, 0]); u[1]++; if (w === side) u[0]++; }
  const comeback = (w === 0 && worst0 < -0.25) || (w === 1 && worst1 < -0.25);
  return {
    winner: w as any, actions: b.stats.actions, leadChanges: b.stats.leadChanges, interrupts: b.stats.interrupts, bigMoves: b.stats.bigMoves,
    switches: b.stats.switches, endGap: Math.abs(hpShare(b, 0) - hpShare(b, 1)), comeback, maxDeficit: w === 0 ? -worst0 : -worst1,
    kos: b.stats.kos[0] + b.stats.kos[1], firstMoverWon: w === firstMover, rounds: roundOf(b), fatigued: !!b.fatigued,
  };
}

function team(fits: number): Mon[] {
  const out: Mon[] = [];
  const kinds = new Set<string>();
  while (out.length < 4) {
    const k = pick(WILD_KINDS);
    if (kinds.has(k)) continue;
    kinds.add(k);
    out.push(out.length < fits ? randomFit(rnd, k, pick(WILD_KINDS), 50) : makeMon(k, 50));
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const N = Number(args.find(a => /^\d+$/.test(a)) || 400);
  seed = Number((args.find(a => a.startsWith('--seed=')) || '--seed=7').slice(7));
  const wins: Record<string, [number, number]> = {};
  const pas: Record<string, [number, number]> = {};
  const res: Result[] = [];
  const t0 = Date.now();
  for (let g = 0; g < N; g++) {
    const A = team(0), Z = team(0);
    const r = runBattle(A, Z);
    res.push(r);
    for (const [side, t] of [[0, A], [1, Z]] as const) {
      for (const m of t) {
        const w = (wins[m.kind] ||= [0, 0]); w[1]++; if (r.winner === side) w[0]++;
        for (const p of m.passives) { const x = (pas[p] ||= [0, 0]); x[1]++; if (r.winner === side) x[0]++; }
      }
    }
  }
  // Fitting value: two random fittings against none.
  let fitWins = 0;
  const FN = Math.max(60, Math.floor(N / 4));
  for (let g = 0; g < FN; g++) if (runBattle(team(2), team(0)).winner === 0) fitWins++;

  // Notion value: four random notions against none, and each notion's rate when both sides hold them.
  const withNotions = (t: Mon[]) => { for (const m of t) m.notion = pick(NOTION_IDS); return t; };
  let notionWins = 0;
  for (let g = 0; g < FN; g++) if (runBattle(withNotions(team(0)), team(0)).winner === 0) notionWins++;
  const nrate: Record<string, [number, number]> = {};
  for (let g = 0; g < FN * 2; g++) {
    const A = withNotions(team(0)), Z = withNotions(team(0));
    const r = runBattle(A, Z);
    for (const [side, t] of [[0, A], [1, Z]] as const) for (const m of t) { const x = (nrate[m.notion!] ||= [0, 0]); x[1]++; if (r.winner === side) x[0]++; }
  }

  const avg = (k: keyof Result) => (res.reduce((n, r) => n + Number(r[k]), 0) / res.length);
  const pct = (x: number) => (100 * x).toFixed(1) + '%';
  const totalActs = Object.values(KINDS).reduce((a, b) => a + b, 0);
  console.log(`## Balance run: ${N} battles, level 50, keeper AI both sides (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log('');
  console.log('### Fun metrics');
  console.log(`- Actions per battle: ${avg('actions').toFixed(1)} (both sides together)`);
  const rs = res.map(r => r.rounds).sort((a, z) => a - z);
  console.log(`- Rounds per battle: mean ${avg('rounds').toFixed(1)}, median ${rs[Math.floor(N / 2)]}, 90th percentile ${rs[Math.floor(N * 0.9)]}, reached fatigue ${pct(res.filter(r => r.fatigued).length / N)}`);
  console.log(`- KOs per battle: ${avg('kos').toFixed(2)}`);
  console.log(`- Lead changes per battle: ${avg('leadChanges').toFixed(2)}`);
  console.log(`- Comebacks (winner was behind by more than 25% of team HP): ${pct(res.filter(r => r.comeback).length / N)}`);
  console.log(`- Close finishes (HP share gap under 20% at the end): ${pct(res.filter(r => r.endGap < 0.2).length / N)}`);
  console.log(`- First mover wins: ${pct(res.filter(r => r.firstMoverWon).length / N)}`);
  console.log(`- Switches per battle: ${avg('switches').toFixed(1)}, crests per battle: ${avg('bigMoves').toFixed(1)}, interrupts per battle: ${avg('interrupts').toFixed(2)}`);
  console.log(`- Action mix: ${Object.entries(KINDS).map(([k, v]) => `${k} ${pct(v / totalActs)}`).join(', ')}`);
  console.log(`- Meaningful options per decision (within 0.15 of the best): ${(aiStats.options / aiStats.decisions).toFixed(2)} of ${(aiStats.legal / aiStats.decisions).toFixed(1)} legal`);
  console.log(`- Draws: ${res.filter(r => r.winner === 'draw').length}`);
  console.log(`- Two random fittings against none: ${pct(fitWins / FN)} wins (${FN} battles)`);
  console.log(`- Four random notions against none: ${pct(notionWins / FN)} wins (${FN} battles)`);
  const nr = Object.entries(nrate).map(([k, [w, n]]) => `${NOTIONS[k].name} ${pct(w / n)}`).sort((a, z) => parseFloat(z.split(' ').pop()!) - parseFloat(a.split(' ').pop()!));
  console.log(`- Notions when both sides hold them: ${nr.join(', ')}`);
  console.log('');
  const rows = Object.entries(wins).map(([k, [w, n]]) => ({ k, rate: w / n, n })).sort((a, z) => z.rate - a.rate);
  const rates = rows.map(r => r.rate);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length);
  console.log(`### Kind win rates (spread: ${pct(Math.min(...rates))} to ${pct(Math.max(...rates))}, standard deviation ${pct(sd)})`);
  for (const r of rows) console.log(`${r.k.padEnd(10)} ${pct(r.rate).padStart(6)}  (${r.n})`);
  const byType: Record<string, [number, number]> = {};
  for (const r of rows) for (const t of SPECIES[r.k].types) { const x = (byType[t] ||= [0, 0]); x[0] += r.rate * r.n; x[1] += r.n; }
  console.log('');
  console.log('### Types: ' + TYPES.map(t => `${t} ${pct((byType[t]?.[0] || 0) / (byType[t]?.[1] || 1))}`).join(', '));
  const mv = Object.entries(MOVE_USE).filter(([, [, n]]) => n >= 30).map(([k, [w, n]]) => ({ k, rate: w / n, n })).sort((a, z) => z.rate - a.rate);
  console.log('');
  console.log('### Moves: most and least winning when used (30+ uses)');
  for (const m of [...mv.slice(0, 8), ...mv.slice(-8)]) console.log(`${MOVES[m.k].name.padEnd(16)} ${pct(m.rate).padStart(6)}  used ${m.n}`);
  const never = Object.keys(MOVES).filter(k => !MOVE_USE[k] && SPECIES[MOVES[k].owner]?.wild);
  console.log(`Moves the AI never used: ${never.map(k => MOVES[k].name).join(', ') || 'none'}`);
  const pr = Object.entries(pas).map(([k, [w, n]]) => ({ k, rate: w / n, n })).sort((a, z) => z.rate - a.rate);
  console.log('');
  console.log('### Passives: top and bottom');
  for (const p of [...pr.slice(0, 5), ...pr.slice(-5)]) console.log(`${PASSIVES[p.k].name.padEnd(16)} ${pct(p.rate).padStart(6)}`);
}

if (process.argv[1] && process.argv[1].includes('sim')) main();
