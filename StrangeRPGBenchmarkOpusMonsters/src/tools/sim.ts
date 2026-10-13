// Headless balance simulator. AI against AI at level 25. Reports kind, move, and type balance and fun metrics.
// Usage: node dist-tools/sim.js [battles] [--seed=N] [--workers=N] [--focus=kind,kind] [--out=file]
//   [--progress=file] [--stop=file] [--minutes=N]
// The progress file (default Notes/sim-progress.txt) shows battles done, elapsed time, an ETA, and win rates so far.
// Creating the stop file (default dist-tools/sim.stop) or passing the time limit ends the run early: workers finish
// the battle in hand, and the report covers the battles done, marked partial.
import { clearParts, clearStop, ownFlags, partFile, progressHead, readPart, runCtl, workerArgs, writeText, type RunCtl } from './runctl';
import { act, advance, hpShare, newBattle, roundOf, setSwitchWeight } from '../battle/engine';
import { aiTurn, aiStats, choose, chooseReplacement } from '../battle/ai';
import type { Battle, Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { NOTION_IDS } from '../data/notions';
import { SPECIES, WILD_KINDS, makeMon } from '../data/species';
import { TYPES } from '../data/types';
import { randomFit } from '../game/wildfit';

declare const process: { argv: string[]; execPath: string };
let seed = 1;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

let ctl: RunCtl = runCtl([], 'sim');
/** What this process has done so far, for the progress file: battles done of its total, and kind wins over appearances. */
const prog = { done: 0, total: 0, wins: {} as Record<string, [number, number]> };
let lastTick = 0;
/** Saves progress every few seconds: a worker to its part file, a lone process to the progress file. */
function tick(force = false): void {
  const now = Date.now();
  if (!force && now - lastTick < 3000) return;
  lastTick = now;
  if (ctl.part >= 0) writeText(partFile(ctl, ctl.part), JSON.stringify(prog));
  else writeText(ctl.progress, progressText(prog.done, prog.total, prog.wins, force ? (ctl.halted() ? 'stopped early' : 'finished') : 'running'));
}

function progressText(done: number, total: number, wins: Record<string, [number, number]>, state: string): string {
  const rows = Object.entries(wins).filter(([, [, n]]) => n > 0).map(([k, [w, n]]) => ({ k, r: w / n, n })).sort((a, z) => a.r - z.r);
  const fmt = (x: { k: string; r: number; n: number }) => `${x.k} ${(100 * x.r).toFixed(1)}% (${x.n})`;
  const lines = [progressHead(ctl, done, total, state)];
  if (rows.length) {
    const outside = rows.filter(x => x.r < 0.45 || x.r > 0.65).length;
    lines.push(`win rates so far: ${rows.length} kinds, median ${(100 * rows[Math.floor(rows.length / 2)].r).toFixed(1)}%, ${outside} outside 45 to 65% (counts in brackets)`);
    if (rows.length <= 24) lines.push(rows.map(fmt).join(', '));
    else {
      lines.push(`lowest: ${rows.slice(0, 12).map(fmt).join(', ')}`);
      lines.push(`highest: ${rows.slice(-12).reverse().map(fmt).join(', ')}`);
    }
  }
  return lines.join('\n') + '\n';
}

/** Keeps the progress file current from the workers' part files until `job` settles, then writes the final state. */
async function watched<T>(workers: number, total: number, job: Promise<T>): Promise<T> {
  const write = (state: string) => {
    let done = 0;
    const wins: Record<string, [number, number]> = {};
    for (let k = 0; k < workers; k++) {
      const p = readPart<typeof prog>(ctl, k);
      if (!p) continue;
      done += p.done;
      for (const [kind, [w, n]] of Object.entries(p.wins)) { const x = (wins[kind] ||= [0, 0]); x[0] += w; x[1] += n; }
    }
    writeText(ctl.progress, progressText(done, total, wins, state));
  };
  write('running');
  const timer = setInterval(() => write('running'), 3000);
  try { return await job; } finally { clearInterval(timer); write(ctl.halted() ? 'stopped early' : 'finished'); clearParts(ctl, workers); }
}

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
    if (d.kind === 'act' || d.kind === 'joint') {
      // A move's id is read before the choice resolves, while the slot still holds it.
      const outs = [b.s[0].f[b.s[0].out], b.s[1].f[b.s[1].out]];
      for (const { side, a: a2 } of aiTurn(b)) {
        KINDS[a2.k] = (KINDS[a2.k] || 0) + 1;
        if (a2.k === 'move') used.push([side, outs[side].mon.moves[a2.i] || outs[side].moves[a2.i]]);
      }
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
  // A team holds each kind once, counting both kinds of a fit, as practice and online play require.
  while (out.length < 4) {
    const k = pick(WILD_KINDS);
    if (kinds.has(k)) continue;
    kinds.add(k);
    if (out.length >= fits) { out.push(makeMon(k, 50)); continue; }
    let k2 = pick(WILD_KINDS);
    while (kinds.has(k2)) k2 = pick(WILD_KINDS);
    kinds.add(k2);
    out.push(randomFit(rnd, k, k2, 50));
  }
  return out;
}

/** `--focus=a,b,c`: each listed kind fights N battles in a random four against a random four, and only those rates print. */
function focus(kinds: string[], N: number): void {
  const t0 = Date.now();
  prog.total = kinds.length * N;
  for (const k of kinds) {
    if (!SPECIES[k]) { console.log(`${k.padEnd(12)} unknown kind`); continue; }
    if (ctl.halted()) break;
    let w = 0, rounds = 0, g = 0;
    for (; g < N && !ctl.halted(); g++) {
      const A = team(0).filter(m => m.kind !== k).slice(0, 3);
      A.unshift(makeMon(k, 50));
      const r = runBattle(A, team(0));
      if (r.winner === 0) w++;
      rounds += r.rounds;
      prog.done++;
      prog.wins[k] = [w, g + 1];
      tick();
    }
    if (g) console.log(`${k.padEnd(12)} ${(100 * w / g).toFixed(1).padStart(5)}%  (${g} battles, ${(rounds / g).toFixed(1)} rounds)`);
  }
  tick(true);
  if (ctl.halted()) console.log(`partial: stopped early after ${prog.done} of ${prog.total} battles`);
  console.log(`focus run took ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

/** Every count a run collects, so runs split across worker processes can be merged before the report. */
interface Data {
  /** Main battles done, the fusion and notion battles each side test asked for, and how many of those ran. */
  N: number; FN: number; fitN: number; notionN: number; partial: boolean; secs: number; fitWins: number; notionWins: number;
  wins: Record<string, [number, number]>; pas: Record<string, [number, number]>; nrate: Record<string, [number, number]>;
  res: Result[]; kinds: Record<string, number>; moveUse: Record<string, [number, number]>; ai: { decisions: number; options: number; legal: number };
}

function collect(N: number): Data {
  const wins: Record<string, [number, number]> = {};
  const pas: Record<string, [number, number]> = {};
  const res: Result[] = [];
  const t0 = Date.now();
  const FN = Math.max(15, Math.floor(N / 4));
  prog.total = N + FN * 4;
  prog.wins = wins;
  let done = 0;
  for (let g = 0; g < N && !ctl.halted(); g++) {
    const A = team(0), Z = team(0);
    const r = runBattle(A, Z);
    res.push(r);
    done++;
    prog.done++;
    for (const [side, t] of [[0, A], [1, Z]] as const) {
      for (const m of t) {
        const w = (wins[m.kind] ||= [0, 0]); w[1]++; if (r.winner === side) w[0]++;
        for (const p of m.passives) { const x = (pas[p] ||= [0, 0]); x[1]++; if (r.winner === side) x[0]++; }
      }
    }
    tick();
  }
  // Fitting value: two random fittings against none.
  let fitWins = 0, fitN = 0;
  for (let g = 0; g < FN && !ctl.halted(); g++) { if (runBattle(team(2), team(0)).winner === 0) fitWins++; fitN++; prog.done++; tick(); }

  // Notion value: four random notions against none, and each notion's rate when both sides hold them.
  const withNotions = (t: Mon[]) => { for (const m of t) m.notion = pick(NOTION_IDS); return t; };
  let notionWins = 0, notionN = 0;
  for (let g = 0; g < FN && !ctl.halted(); g++) { if (runBattle(withNotions(team(0)), team(0)).winner === 0) notionWins++; notionN++; prog.done++; tick(); }
  const nrate: Record<string, [number, number]> = {};
  for (let g = 0; g < FN * 2 && !ctl.halted(); g++) {
    prog.done++;
    tick();
    const A = withNotions(team(0)), Z = withNotions(team(0));
    const r = runBattle(A, Z);
    for (const [side, t] of [[0, A], [1, Z]] as const) for (const m of t) { const x = (nrate[m.notion!] ||= [0, 0]); x[1]++; if (r.winner === side) x[0]++; }
  }
  tick(true);
  return { N: done, FN, fitN, notionN, partial: ctl.halted(), secs: (Date.now() - t0) / 1000, fitWins, notionWins, wins, pas, nrate, res, kinds: { ...KINDS }, moveUse: { ...MOVE_USE }, ai: { ...aiStats } };
}

function merge(parts: Data[]): Data {
  const pairs = (key: 'wins' | 'pas' | 'nrate' | 'moveUse') => {
    const out: Record<string, [number, number]> = {};
    for (const p of parts) for (const [k, [w, n]] of Object.entries(p[key])) { const x = (out[k] ||= [0, 0]); x[0] += w; x[1] += n; }
    return out;
  };
  const kinds: Record<string, number> = {};
  for (const p of parts) for (const [k, v] of Object.entries(p.kinds)) kinds[k] = (kinds[k] || 0) + v;
  const sum = (f: (p: Data) => number) => parts.reduce((n, p) => n + f(p), 0);
  return {
    N: sum(p => p.N), FN: sum(p => p.FN), fitN: sum(p => p.fitN), notionN: sum(p => p.notionN), partial: parts.some(p => p.partial),
    secs: Math.max(...parts.map(p => p.secs)), fitWins: sum(p => p.fitWins), notionWins: sum(p => p.notionWins),
    wins: pairs('wins'), pas: pairs('pas'), nrate: pairs('nrate'), moveUse: pairs('moveUse'), res: parts.flatMap(p => p.res), kinds,
    ai: { decisions: sum(p => p.ai.decisions), options: sum(p => p.ai.options), legal: sum(p => p.ai.legal) },
  };
}

function report(d: Data, workers: number, asked: number, outFile?: string): void {
  const lines: string[] = [];
  const console = { log: (t: string) => { lines.push(t); } };
  try { reportLines(d, workers, asked, console); } finally {
    const text = lines.join('\n');
    globalThis.console.log(text);
    if (outFile) writeText(outFile, text + '\n');
  }
}

function reportLines(d: Data, workers: number, asked: number, console: { log(t: string): void }): void {
  const { N, res, wins, pas, nrate, fitWins, notionWins, fitN, notionN } = d;
  if (!N) { console.log(`## Balance run: stopped before any battle finished (${asked} asked)`); return; }
  const avg = (k: keyof Result) => (res.reduce((n, r) => n + Number(r[k]), 0) / res.length);
  const pct = (x: number) => (100 * x).toFixed(1) + '%';
  const totalActs = Object.values(d.kinds).reduce((a, b) => a + b, 0);
  console.log(`## Balance run: ${N} battles, level 50, keeper AI both sides (${d.secs.toFixed(0)}s${workers > 1 ? ` on ${workers} workers` : ''})${d.partial ? `, PARTIAL: stopped early after ${N} of ${asked} battles` : ''}`);
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
  console.log(`- Action mix: ${Object.entries(d.kinds).map(([k, v]) => `${k} ${pct(v / totalActs)}`).join(', ')}`);
  console.log(`- Meaningful options per decision (within 0.15 of the best): ${(d.ai.options / d.ai.decisions).toFixed(2)} of ${(d.ai.legal / d.ai.decisions).toFixed(1)} legal`);
  console.log(`- Draws: ${res.filter(r => r.winner === 'draw').length}`);
  console.log(`- Two random fittings against none: ${fitN ? `${pct(fitWins / fitN)} wins (${fitN} battles)` : 'not run'}`);
  console.log(`- Four random notions against none: ${notionN ? `${pct(notionWins / notionN)} wins (${notionN} battles)` : 'not run'}`);
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
  const mv = Object.entries(d.moveUse).filter(([, [, n]]) => n >= 30).map(([k, [w, n]]) => ({ k, rate: w / n, n })).sort((a, z) => z.rate - a.rate);
  console.log('');
  console.log('### Moves: most and least winning when used (30+ uses)');
  for (const m of [...mv.slice(0, 8), ...mv.slice(-8)]) console.log(`${MOVES[m.k].name.padEnd(16)} ${pct(m.rate).padStart(6)}  used ${m.n}`);
  const never = Object.keys(MOVES).filter(k => !d.moveUse[k] && SPECIES[MOVES[k].owner]?.wild);
  console.log(`Moves the AI never used: ${never.map(k => MOVES[k].name).join(', ') || 'none'}`);
  const pr = Object.entries(pas).map(([k, [w, n]]) => ({ k, rate: w / n, n })).sort((a, z) => z.rate - a.rate);
  console.log('');
  console.log('### Passives: top and bottom');
  for (const p of [...pr.slice(0, 5), ...pr.slice(-5)]) console.log(`${PASSIVES[p.k].name.padEnd(16)} ${pct(p.rate).padStart(6)}`);
}

/** Runs `n` battles in each of `workers` child processes, each on its own seed, and gives back their counts. */
async function inWorkers(n: number, workers: number, args: string[]): Promise<Data[]> {
  const { spawn } = await import('node:child_process');
  const base = Number((args.find(a => a.startsWith('--seed=')) || '--seed=7').slice(7));
  const rest = ownFlags(args.filter(a => !/^\d+$/.test(a) && !a.startsWith('--seed=') && !a.startsWith('--workers=')));
  const share = Math.ceil(n / workers);
  return Promise.all(Array.from({ length: workers }, (_, k) => new Promise<Data>((resolve, reject) => {
    const child = spawn(process.execPath, [process.argv[1], String(share), `--seed=${base + k * 7919}`, '--part', ...workerArgs(ctl, k), ...rest]);
    let out = '', err = '';
    child.stdout.on('data', (c: unknown) => { out += String(c); });
    child.stderr.on('data', (c: unknown) => { err += String(c); });
    // A worker that dies leaves no result, so the error names its seed and keeps the end of its stderr.
    child.on('close', (code: number | null) => { try { resolve(JSON.parse(out.trim().split('\n').pop() || '')); } catch { reject(new Error(`worker ${k} (seed ${base + k * 7919}) exited ${code} with no result:\n${err.slice(-3000)}`)); } });
  })));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  ctl = runCtl(args, 'sim');
  const outFile = args.find(a => a.startsWith('--out='))?.slice(6);
  if (ctl.part < 0) clearStop(ctl);
  const N = Number(args.find(a => /^\d+$/.test(a)) || 400);
  seed = Number((args.find(a => a.startsWith('--seed=')) || '--seed=7').slice(7));
  const only = args.find(a => a.startsWith('--focus='));
  const sw = args.find(a => a.startsWith('--switch='));
  if (sw) setSwitchWeight(Number(sw.slice(9)));
  const workers = Number((args.find(a => a.startsWith('--workers=')) || '--workers=1').slice(10));
  if (only && workers <= 1) { focus(only.slice(8).split(',').filter(Boolean), N); return; }
  if (args.includes('--part')) { console.log(JSON.stringify(collect(N))); return; }
  if (workers > 1 && !only) {
    const share = Math.ceil(N / workers);
    const parts = await watched(workers, workers * (share + Math.max(15, Math.floor(share / 4)) * 4), inWorkers(N, workers, args));
    report(merge(parts), workers, share * workers, outFile);
    return;
  }
  if (only) {
    // Kinds are dealt out across the workers, and each prints its own lines.
    const { spawn } = await import('node:child_process');
    const kinds = only.slice(8).split(',').filter(Boolean);
    const groups = Array.from({ length: Math.min(workers, kinds.length) }, (_, k) => kinds.filter((_, i) => i % workers === k));
    const rest = ownFlags(args.filter(a => a.startsWith('--switch=')));
    const outs = await watched(groups.length, kinds.length * N, Promise.all(groups.map((g, k) => new Promise<string>(resolve => {
      const child = spawn(process.execPath, [process.argv[1], String(N), `--seed=${seed}`, `--focus=${g.join(',')}`, ...workerArgs(ctl, k), ...rest]);
      let out = '';
      child.stdout.on('data', (c: unknown) => { out += String(c); });
      child.on('close', () => resolve(out));
    }))));
    const lines = outs.flatMap(o => o.trim().split('\n').filter(l => l && !l.startsWith('focus run took') && !l.startsWith('partial:')));
    if (outs.some(o => o.includes('partial:'))) lines.push(`partial: stopped early, kinds show the battles they finished`);
    console.log(lines.join('\n'));
    if (outFile) writeText(outFile, lines.join('\n') + '\n');
    return;
  }
  report(collect(N), 1, N, outFile);
}

if (process.argv[1] && process.argv[1].includes('sim')) void main();
