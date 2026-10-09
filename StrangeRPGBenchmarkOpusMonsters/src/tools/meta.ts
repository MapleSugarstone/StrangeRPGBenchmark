// An Elo ladder of AI players that rebuild their teams when they lose. It measures whether fusions take over the top.
// Usage: node dist-tools/meta.js <rounds> [--seed=N] [--out=file] [--workers=N] [--field=N]
//        node dist-tools/meta.js --analyze run-1.json run-2.json [--report=Notes/meta-lab.md]
// Every unit fights at level 25 with no charm. Both sides use the strongest AI. A battle is deterministic, so a worker pool changes only the speed.
import { act, advance, newBattle, TAN_PER_STAT, TAN_TOTAL } from '../battle/engine';
import { choose, chooseReplacement } from '../battle/ai';
import type { Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { SPECIES, WILD_KINDS, makeMon } from '../data/species';
import { randomFit } from '../game/wildfit';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

declare const process: { argv: string[]; exit(n: number): never };

const PLAYERS = 32, TEAM = 4, START_ELO = 1500, K = 24, JITTER = 30, CHECK_EVERY = 8, SNAP_EVERY = 25, FUSION_RATE = 0.5, TOP = 8, LEVEL = 50;
const CHARMS = ['rib', 'mast', 'spire', 'bole', 'pylon', 'tusk', 'hilt', 'fall'];

/** Notions a player would pick for a unit whose damage comes from this stat. Copied from the duel tool. */
const PLANNED_NOTIONS: Record<'P' | 'M', string[]> = {
  P: ['whetstone', 'edgecharm', 'bodkin', 'heartstone', 'waxseal', 'bloodglass', 'longshin', 'spareskin'],
  M: ['bitterroot', 'crownofhorn', 'bodkin', 'heartstone', 'waxseal', 'bloodglass', 'longshin', 'spareskin'],
};

type Result = 0 | 1 | 'draw';
type Rnd = () => number;

function makeRng(seed: number): Rnd {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- battles

function cloneMon(m: Mon): Mon {
  return { ...m, types: m.types.slice(), moves: m.moves.slice(), passives: m.passives.slice(), tan: m.tan ? { ...m.tan } : undefined };
}

function fight(a: Mon[], z: Mon[], ca: string | null, cz: string | null): Result {
  const b = newBattle({ mons: a, name: 'A', ai: 'champion', charm: ca }, { mons: z, name: 'Z', ai: 'champion', charm: cz }, { nerve: true, wild: false, sync: true, canRun: false });
  b.quiet = true;
  for (let i = 0; i < 600; i++) {
    const d = advance(b, chooseReplacement);
    if (d.kind === 'over') break;
    if (d.kind === 'act') act(b, choose(b));
  }
  return b.over === 0 ? 0 : b.over === 1 ? 1 : 'draw';
}

interface Job { a: Mon[]; z: Mon[]; ca: string | null; cz: string | null }
interface Waiting extends Job { resolve: (r: Result) => void }

class Pool {
  private idle: any[] = [];
  private all: any[] = [];
  private queue: Waiting[] = [];
  private running = new Map<any, Waiting>();

  constructor(n: number) {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL(import.meta.url));
      w.on('message', (r: { winner: Result }) => {
        const job = this.running.get(w)!;
        this.running.delete(w);
        this.idle.push(w);
        job.resolve(r.winner);
        this.pump();
      });
      w.on('error', (e: unknown) => { console.error(e); process.exit(1); });
      this.idle.push(w);
      this.all.push(w);
    }
  }

  play(a: Mon[], z: Mon[], ca: string | null = null, cz: string | null = null): Promise<Result> {
    if (!this.all.length) return Promise.resolve(fight(a.map(cloneMon), z.map(cloneMon), ca, cz));
    return new Promise(resolve => { this.queue.push({ a, z, ca, cz, resolve }); this.pump(); });
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop();
      const job = this.queue.shift()!;
      this.running.set(w, job);
      w.postMessage({ a: job.a, z: job.z, ca: job.ca, cz: job.cz });
    }
  }

  close(): void { for (const w of this.all) w.terminate(); }
}

function workerMain(): void {
  parentPort.on('message', (job: Job) => parentPort.postMessage({ winner: fight(job.a, job.z, job.ca, job.cz) }));
}

// ---------------------------------------------------------------- ladder

interface Unit {
  id: number;
  fusion: boolean;
  /** The base kind, or 'fit' for a fusion. */
  kind: string;
  parents: [string, string] | null;
  name: string;
  types: string[];
  basic: 'P' | 'M';
  moves: string[];
  habits: string[];
  notion: string;
  joined: number;
  left: number | null;
  battles: number;
  wins: number;
  draws: number;
  /** Rounds the unit spent on a team in the top eight by Elo. */
  topRounds: number;
}

interface Player { id: number; elo: number; team: Unit[]; results: string[]; mark: number; since: number; changes: number }

interface Snapshot { round: number; pop: number; top: number; fresh: number; freshCount: number; topPlayers: number[]; topElo: number }

const baseKinds = (u: Unit): string[] => u.parents ?? [u.kind];
const scoreOf = (wins: number, draws: number, n: number): number => (n ? (wins + draws / 2) / n : 0);

function newUnit(id: number, round: number, taken: Set<string>, rnd: Rnd): { unit: Unit; mon: Mon } {
  const free = WILD_KINDS.filter(k => !taken.has(k));
  const pick = (a: string[]): string => a[Math.floor(rnd() * a.length)];
  const fusion = rnd() < FUSION_RATE;
  const a = pick(free);
  const b = fusion ? pick(free.filter(k => k !== a)) : null;
  const mon = b ? randomFit(rnd, a, b, LEVEL) : makeMon(a, LEVEL);
  mon.notion = pick(PLANNED_NOTIONS[mon.basic]);
  mon.tan = { [mon.basic === 'P' ? 'atk' : 'mgk']: TAN_PER_STAT, hp: TAN_TOTAL - TAN_PER_STAT };
  const unit: Unit = {
    id, fusion, kind: b ? 'fit' : a, parents: b ? [a, b] : null, name: mon.name, types: mon.types.slice(), basic: mon.basic,
    moves: mon.moves.slice(), habits: mon.passives.slice(), notion: mon.notion, joined: round, left: null, battles: 0, wins: 0, draws: 0, topRounds: 0,
  };
  return { unit, mon };
}

/** A planned-field opponent, as the duel tool builds one: two random fusions, a planned notion and tan on each, and a charm. */
function fieldTeam(rnd: Rnd): { mons: Mon[]; charm: string } {
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const mons: Mon[] = [];
  const used = new Set<string>();
  while (mons.length < TEAM) {
    const k = pick(WILD_KINDS);
    if (used.has(k)) continue;
    used.add(k);
    const m = mons.length < 2 ? randomFit(rnd, k, pick(WILD_KINDS.filter(x => x !== k)), LEVEL) : makeMon(k, LEVEL);
    m.notion = pick(PLANNED_NOTIONS[m.basic]);
    m.tan = { [m.basic === 'P' ? 'atk' : 'mgk']: TAN_PER_STAT, hp: TAN_TOTAL - TAN_PER_STAT };
    mons.push(m);
  }
  return { mons, charm: pick(CHARMS) };
}

function argOf(args: string[], name: string): string | undefined {
  return args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function ladder(args: string[]): Promise<void> {
  const rounds = Number(args.find(a => /^\d+$/.test(a)) || 100);
  const seed = Number(argOf(args, 'seed') ?? 1);
  const outFile = argOf(args, 'out') ?? `Notes/meta-lab/run-${seed}.json`;
  const nWorkers = Number(argOf(args, 'workers') ?? 12);
  const fieldN = Number(argOf(args, 'field') ?? 100);
  const rnd = makeRng(seed);
  const gauss = (): number => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const pool = new Pool(nWorkers);
  const started = Date.now();

  const mons = new Map<number, Mon>();
  const units: Unit[] = [];
  let nextId = 1;
  const make = (round: number, taken: Set<string>): Unit => {
    const { unit, mon } = newUnit(nextId++, round, taken, rnd);
    units.push(unit);
    mons.set(unit.id, mon);
    return unit;
  };

  const players: Player[] = [];
  for (let i = 0; i < PLAYERS; i++) {
    const team: Unit[] = [];
    const taken = new Set<string>();
    while (team.length < TEAM) {
      const u = make(0, taken);
      baseKinds(u).forEach(k => taken.add(k));
      team.push(u);
    }
    players.push({ id: i + 1, elo: START_ELO, team, results: [], mark: 0, since: 0, changes: 0 });
  }

  const cache = new Map<string, Result>();
  let battles = 0, hits = 0;
  const pop: number[] = [], top: number[] = [];
  const snapshots: Snapshot[] = [];
  const fusionShare = (ps: Player[]): number => ps.reduce((n, p) => n + p.team.filter(u => u.fusion).length, 0) / (ps.length * TEAM);

  const logOf = (extra: Record<string, unknown>): Record<string, unknown> => {
    const names = { kinds: {} as Record<string, string>, moves: {} as Record<string, string>, habits: {} as Record<string, string>, notions: {} as Record<string, string> };
    for (const u of units) {
      for (const k of baseKinds(u)) if (SPECIES[k]) names.kinds[k] = SPECIES[k].name;
      for (const m of u.moves) names.moves[m] = MOVES[m]?.name ?? m;
      for (const h of u.habits) names.habits[h] = PASSIVES[h]?.name ?? h;
      names.notions[u.notion] = NOTIONS[u.notion]?.name ?? u.notion;
    }
    return {
      meta: { seed, rounds: pop.length, players: PLAYERS, teamSize: TEAM, k: K, kinds: WILD_KINDS.length, battles, cacheHits: hits, seconds: Math.round((Date.now() - started) / 1000) },
      names, series: { pop, top }, snapshots,
      players: players.map(p => ({ id: p.id, elo: Math.round(p.elo * 10) / 10, results: p.results.join(''), mark: p.mark, since: p.since, changes: p.changes, team: p.team.map(u => u.id) })),
      units, ...extra,
    };
  };
  const save = (extra: Record<string, unknown> = {}): void => {
    const dir = outFile.slice(0, Math.max(0, outFile.lastIndexOf('/')));
    if (dir) mkdirSync(dir, { recursive: true });
    writeFileSync(outFile, JSON.stringify(logOf(extra)));
  };

  const line = (round: number, s: Snapshot): void => {
    const sec = (Date.now() - started) / 1000;
    console.log(`round ${round}/${rounds}  ${sec.toFixed(0)}s  battles ${battles} (${hits} cached)  fusions: all ${(100 * s.pop).toFixed(0)}%  top 8 ${(100 * s.top).toFixed(0)}%  new ${(100 * s.fresh).toFixed(0)}% of ${s.freshCount}  top Elo ${s.topElo.toFixed(0)}`);
  };

  for (let round = 1; round <= rounds; round++) {
    const order = players.map(p => ({ p, key: p.elo + gauss() * JITTER })).sort((x, y) => y.key - x.key).map(x => x.p);
    const matches: { a: Player; z: Player }[] = [];
    for (let i = 0; i < order.length; i += 2) matches.push(rnd() < 0.5 ? { a: order[i], z: order[i + 1] } : { a: order[i + 1], z: order[i] });
    const outcomes = await Promise.all(matches.map(m => {
      const key = `${m.a.team.map(u => u.id)}|${m.z.team.map(u => u.id)}`;
      battles++;
      const seen = cache.get(key);
      if (seen !== undefined) { hits++; return Promise.resolve(seen); }
      return pool.play(m.a.team.map(u => mons.get(u.id)!), m.z.team.map(u => mons.get(u.id)!)).then(r => { cache.set(key, r); return r; });
    }));
    matches.forEach((m, i) => {
      const r = outcomes[i];
      const sa = r === 0 ? 1 : r === 1 ? 0 : 0.5;
      const ea = 1 / (1 + Math.pow(10, (m.z.elo - m.a.elo) / 400));
      const ra = m.a.elo, rz = m.z.elo;
      m.a.elo = ra + K * (sa - ea);
      m.z.elo = rz + K * ((1 - sa) - (1 - ea));
      for (const [p, s] of [[m.a, sa], [m.z, 1 - sa]] as [Player, number][]) {
        p.results.push(s === 1 ? 'W' : s === 0 ? 'L' : 'D');
        for (const u of p.team) { u.battles++; if (s === 1) u.wins++; else if (s === 0.5) u.draws++; }
      }
    });

    const ranked = players.slice().sort((x, y) => y.elo - x.elo);
    const best = ranked.slice(0, TOP);
    for (const p of best) for (const u of p.team) u.topRounds++;
    pop.push(fusionShare(players));
    top.push(fusionShare(best));

    if (round % SNAP_EVERY === 0 || round === rounds) {
      const fresh = units.filter(u => u.joined > Math.max(0, round - SNAP_EVERY) && u.joined <= round);
      const s: Snapshot = { round, pop: pop[round - 1], top: top[round - 1], fresh: fresh.length ? fresh.filter(u => u.fusion).length / fresh.length : 0, freshCount: fresh.length, topPlayers: best.map(p => p.id), topElo: best[0].elo };
      snapshots.push(s);
      line(round, s);
    }
    if (round % 100 === 0 && round < rounds) save();
    if (round % CHECK_EVERY === 0 && round < rounds) strategy(round, players, ranked, make, rnd);
  }

  const bestPlayers = players.slice().sort((x, y) => y.elo - x.elo).slice(0, TOP);
  const fieldTest: { player: number; battles: number; wins: number; draws: number }[] = [];
  if (fieldN > 0) {
    console.log(`Testing the top ${TOP} teams against ${fieldN} planned-field teams each.`);
    for (const p of bestPlayers) {
      const mine = p.team.map(u => mons.get(u.id)!);
      const jobs = Array.from({ length: fieldN }, (_, g) => {
        const f = fieldTeam(rnd);
        return g % 2 === 0 ? pool.play(mine, f.mons, null, f.charm).then(r => r === 0 ? 1 : r === 'draw' ? 0.5 : 0) : pool.play(f.mons, mine, f.charm, null).then(r => r === 1 ? 1 : r === 'draw' ? 0.5 : 0);
      });
      const scores = await Promise.all(jobs);
      fieldTest.push({ player: p.id, battles: fieldN, wins: scores.filter(s => s === 1).length, draws: scores.filter(s => s === 0.5).length });
    }
  }
  save({ finalTop: bestPlayers.map(p => p.id), fieldTest });
  pool.close();
  console.log(`Done in ${((Date.now() - started) / 60000).toFixed(1)} minutes. Log written to ${outFile}.`);
}

/** Every CHECK_EVERY rounds each player judges the team's record since it last changed and replaces units. */
function strategy(round: number, players: Player[], ranked: Player[], make: (round: number, taken: Set<string>) => Unit, rnd: Rnd): void {
  const bottom = new Set(ranked.slice(-Math.ceil(PLAYERS / 4)).map(p => p.id));
  const plan = players.map(p => {
    const recent = p.results.slice(p.mark);
    const rate = scoreOf(recent.filter(r => r === 'W').length, recent.filter(r => r === 'D').length, recent.length);
    if (rate < 0.25) return { p, n: 3, pull: true };
    if (rate < 0.4) return { p, n: 2, pull: true };
    if (rate < 0.5 && bottom.has(p.id)) return { p, n: 1, pull: false };
    return { p, n: rnd() < 0.1 ? 1 : 0, pull: false };
  });
  for (const { p, n, pull } of plan) {
    if (pull) p.elo = (p.elo + START_ELO) / 2;
    if (!n) continue;
    const worst = p.team.map((u, slot) => ({ u, slot, rate: scoreOf(u.wins, u.draws, u.battles), tie: rnd() })).sort((x, y) => x.rate - y.rate || x.tie - y.tie).slice(0, n);
    for (const w of worst) w.u.left = round;
    const taken = new Set<string>();
    for (const u of p.team) if (u.left === null) baseKinds(u).forEach(k => taken.add(k));
    for (const w of worst.sort((x, y) => x.slot - y.slot)) {
      const fresh = make(round, taken);
      baseKinds(fresh).forEach(k => taken.add(k));
      p.team[w.slot] = fresh;
    }
    p.mark = p.results.length;
    p.since = round;
    p.changes++;
  }
}

// ---------------------------------------------------------------- analysis

interface Log {
  meta: { seed: number; rounds: number; kinds: number; battles: number; cacheHits: number; seconds: number };
  names: { kinds: Record<string, string>; moves: Record<string, string>; habits: Record<string, string>; notions: Record<string, string> };
  series: { pop: number[]; top: number[] };
  snapshots: Snapshot[];
  players: { id: number; elo: number; results: string; mark: number; since: number; changes: number; team: number[] }[];
  units: Unit[];
  finalTop: number[];
  fieldTest: { player: number; battles: number; wins: number; draws: number }[];
  /** Set by the analysis from the command line, such as "old rule". */
  label: string;
}

const pct = (x: number, d = 0): string => `${(100 * x).toFixed(d)}%`;
const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, den = 1 + z * z / n;
  const mid = (p + z * z / (2 * n)) / den, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [mid - half, mid + half];
}

/** Mean of a series with a 95% interval from batch means. */
function batchMean(a: number[], batches = 8): { m: number; half: number } {
  const size = Math.floor(a.length / batches);
  if (size < 1) return { m: mean(a), half: NaN };
  const ms = Array.from({ length: batches }, (_, i) => mean(a.slice(i * size, (i + 1) * size)));
  const m = mean(ms);
  const sd = Math.sqrt(ms.reduce((s, x) => s + (x - m) * (x - m), 0) / (batches - 1));
  return { m, half: 2.365 * sd / Math.sqrt(batches) };
}

/** Files may carry a label after an equals sign, as in run-2.json=old rule. Labeled runs starting with "old" are kept out of the pooled tables. */
function analyze(files: string[], reportFile?: string): void {
  const logs: Log[] = files.map(f => {
    const [path, label] = f.split('=');
    const log = JSON.parse(readFileSync(path, 'utf8')) as Log;
    log.label = label ?? '';
    log.finalTop ??= log.players.slice().sort((x, y) => y.elo - x.elo).slice(0, TOP).map(p => p.id);
    log.fieldTest ??= [];
    return log;
  });
  const pooled = logs.filter(l => !l.label.startsWith('old'));
  const tag = (log: Log): string => `Seed ${log.meta.seed}${log.label ? ` (${log.label})` : ''}`;
  const L: string[] = [];
  const out = (s = ''): void => { L.push(s); };
  const kindName = (log: Log, k: string): string => log.names.kinds[k] ?? k;
  const unitText = (log: Log, u: Unit): string => u.fusion ? `${u.name} (fusion of ${kindName(log, u.parents![0])} and ${kindName(log, u.parents![1])})` : u.name;
  const movesText = (log: Log, u: Unit): string => u.moves.map(m => log.names.moves[m] ?? m).join(', ');
  const habitsText = (log: Log, u: Unit): string => u.habits.map(h => log.names.habits[h] ?? h).join(', ');
  const tenure = (log: Log, u: Unit): number => (u.left ?? log.meta.rounds) - u.joined;
  const last = (log: Log): number => log.meta.rounds;

  out('## 1. Fusion share over time');
  out();
  out('The table gives the share of units that are fusions at the end of every 25th round. "All units" counts the 128 units on teams. "Top 8" counts the 32 units on the eight players with the highest Elo. "New units" counts the units added in the 25 rounds up to that row, and its expected value is 50%.');
  for (const log of logs) {
    out();
    out(`### ${tag(log)}`);
    out();
    out('| Round | All units | Top 8 | New units (count) |');
    out('| ---: | ---: | ---: | ---: |');
    for (const s of log.snapshots) out(`| ${s.round} | ${pct(s.pop)} | ${pct(s.top)} | ${pct(s.fresh)} (${s.freshCount}) |`);
  }
  out();
  out('### Summary by seed');
  out();
  out('| Seed | Rounds | Top 8, whole run | Top 8, second half (95% interval) | All units, second half | Final top 8 (95% interval) |');
  out('| ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const log of logs) {
    const half = Math.floor(last(log) / 2);
    const b = batchMean(log.series.top.slice(half));
    const a = batchMean(log.series.pop.slice(half));
    const finalTop = log.players.filter(p => log.finalTop.includes(p.id));
    const fusions = finalTop.flatMap(p => p.team).filter(id => log.units[id - 1].fusion).length;
    const [lo, hi] = wilson(fusions, finalTop.length * 4);
    out(`| ${tag(log)} | ${last(log)} | ${pct(mean(log.series.top), 1)} | ${pct(b.m, 1)} plus or minus ${pct(b.half, 1)} | ${pct(a.m, 1)} | ${pct(fusions / (finalTop.length * 4), 0)} (${fusions} of ${finalTop.length * 4}, ${pct(lo)} to ${pct(hi)}) |`);
  }
  out();
  out('The final interval is a Wilson interval over 32 units and treats them as independent, which they are not (a team shares one record). The second-half interval comes from eight batch means of the per-round share and is the steadier figure.');

  out();
  out('## 2. The final top 8 teams');
  for (const log of logs) {
    out();
    out(`### ${tag(log)}`);
    const ranked = log.players.slice().sort((x, y) => y.elo - x.elo).slice(0, 8);
    ranked.forEach((p, i) => {
      const recent = p.results.slice(p.mark);
      const w = (s: string, c: string): number => s.split('').filter(x => x === c).length;
      const tail = p.results.slice(-100);
      out();
      out(`**${i + 1}. Player ${p.id}.** Elo ${p.elo.toFixed(0)}. With this team since round ${p.since}: ${w(recent, 'W')} wins, ${w(recent, 'L')} losses, ${w(recent, 'D')} draws. Last 100 rounds: ${pct(scoreOf(w(tail, 'W'), w(tail, 'D'), tail.length))}. Team changes so far: ${p.changes}.`);
      out();
      out('| Unit | Types | Moves | Habits | Notion | Joined | Record |');
      out('| --- | --- | --- | --- | --- | ---: | ---: |');
      for (const id of p.team) {
        const u = log.units[id - 1];
        out(`| ${unitText(log, u)} | ${u.types.join('/')} | ${movesText(log, u)} | ${habitsText(log, u)} | ${log.names.notions[u.notion] ?? u.notion} | ${u.joined} | ${u.wins}-${u.battles - u.wins - u.draws}${u.draws ? `-${u.draws}` : ''} |`);
      }
    });
  }

  out();
  out('## 3. The strongest units');
  out();
  out('Win rate counts a draw as half a win. A unit fights on whichever team holds it, so a unit shares its team\'s record with its three teammates.');
  for (const log of logs) {
    const row = (u: Unit, extra: string): string => `| ${unitText(log, u)} | ${u.fusion ? 'fusion' : 'base'} | ${extra} | ${u.joined} | ${u.left ?? 'on a team'} | ${habitsText(log, u)} | ${movesText(log, u)} |`;
    const head = '| Unit | Kind | Win rate (battles) | Joined | Left | Habits | Moves |\n| --- | --- | ---: | ---: | ---: | --- | --- |';
    const eligible = log.units.filter(u => u.battles >= 30);
    const bestRate = eligible.slice().sort((x, y) => scoreOf(y.wins, y.draws, y.battles) - scoreOf(x.wins, x.draws, x.battles)).slice(0, 15);
    out();
    out(`### ${tag(log)}, best win rate over at least 30 battles`);
    out();
    out(`${eligible.length} units reached 30 battles, and ${pct(eligible.filter(u => u.fusion).length / Math.max(1, eligible.length))} of them are fusions. ${bestRate.filter(u => u.fusion).length} of the 15 below are fusions.`);
    out();
    out(head);
    for (const u of bestRate) out(row(u, `${pct(scoreOf(u.wins, u.draws, u.battles), 1)} (${u.battles})`));
    const longest = log.units.slice().sort((x, y) => tenure(log, y) - tenure(log, x) || scoreOf(y.wins, y.draws, y.battles) - scoreOf(x.wins, x.draws, x.battles)).slice(0, 10);
    out();
    out(`### ${tag(log)}, longest on a team`);
    out();
    out(`${longest.filter(u => u.fusion).length} of the 10 below are fusions.`);
    out();
    out('| Unit | Kind | Rounds on a team (win rate) | Joined | Left | Habits | Moves |\n| --- | --- | ---: | ---: | ---: | --- | --- |');
    for (const u of longest) out(row(u, `${tenure(log, u)} (${pct(scoreOf(u.wins, u.draws, u.battles), 1)})`));
  }

  out();
  out('## 4. What strong fusions share');
  const longLived = pooled.flatMap(log => log.units.filter(u => u.fusion && tenure(log, u) >= 40).map(u => ({ log, u })));
  const allFusions = pooled.flatMap(log => log.units.filter(u => u.fusion).map(u => ({ log, u })));
  out();
  out(`The ${pooled.length} runs without an "old rule" label are pooled. ${allFusions.length} fusions were made, and ${longLived.length} of them lasted 40 rounds or more on a team (${pct(longLived.length / Math.max(1, allFusions.length), 1)}). The tables count the share of fusions that contain each item. Lift is the share among long-lived fusions divided by the share among all fusions. The z column tests that gap against the all-fusions share, so a value above 3 is unlikely to be chance even after looking at many items.`);
  const tally = (get: (x: { log: Log; u: Unit }) => string[], label: (log: Log, id: string) => string, title: string): void => {
    const count = (set: { log: Log; u: Unit }[]): Map<string, number> => {
      const m = new Map<string, number>();
      for (const x of set) for (const id of new Set(get(x))) m.set(id, (m.get(id) || 0) + 1);
      return m;
    };
    const cl = count(longLived), ca = count(allFusions);
    const rows = [...ca.keys()].map(id => {
      const c = cl.get(id) || 0, p1 = c / Math.max(1, longLived.length), p0 = (ca.get(id) || 0) / allFusions.length;
      return { id, c, all: ca.get(id) || 0, p1, p0, lift: p0 ? p1 / p0 : 0, z: (p1 - p0) / Math.sqrt(p0 * (1 - p0) / Math.max(1, longLived.length)) };
    });
    const names = (id: string): string => label(pooled[0], id) !== id ? label(pooled[0], id) : (pooled.map(l => label(l, id)).find(n => n !== id) ?? id);
    const show = (rs: typeof rows): void => {
      out('| Item | Long-lived fusions | Share, long-lived | Share, all fusions | Lift | z |');
      out('| --- | ---: | ---: | ---: | ---: | ---: |');
      for (const r of rs) out(`| ${names(r.id)} | ${r.c} | ${pct(r.p1, 1)} | ${pct(r.p0, 1)} | ${r.lift.toFixed(2)} | ${r.z.toFixed(1)} |`);
    };
    out();
    out(`### ${title}, most common among long-lived fusions`);
    out();
    show(rows.slice().sort((x, y) => y.p1 - x.p1 || y.z - x.z).slice(0, 12));
    out();
    out(`### ${title}, highest lift (at least 8 long-lived fusions)`);
    out();
    show(rows.filter(r => r.c >= 8).sort((x, y) => y.lift - x.lift).slice(0, 10));
  };
  tally(x => x.u.parents!, (log, id) => kindName(log, id), 'Parent kinds');
  tally(x => x.u.habits, (log, id) => log.names.habits[id] ?? id, 'Habits');
  tally(x => x.u.moves, (log, id) => log.names.moves[id] ?? id, 'Moves');

  out();
  out('## 5. Verdict');
  out();
  out('### Measures behind the verdict');
  out();
  out('Fusion and base units compared. "Reached 40 rounds" counts units that spent 40 rounds or more on a team, among units made at least 40 rounds before the run ended. "Win rate" covers units with at least 30 battles.');
  out();
  out('| Runs | Kind | Units made | Reached 40 rounds | Units with 30+ battles | Mean win rate | Share of unit-rounds in the top 8 |');
  out('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
  const groups: [string, Log[]][] = [['Pooled', pooled], ...logs.filter(l => !pooled.includes(l)).map(l => [tag(l), [l]] as [string, Log[]])];
  for (const [name, group] of groups) {
    for (const fusion of [true, false]) {
      const set = group.flatMap(log => log.units.filter(u => u.fusion === fusion).map(u => ({ log, u })));
      const old = set.filter(x => x.u.joined <= last(x.log) - 40);
      const rated = set.filter(x => x.u.battles >= 30);
      const unitRounds = set.reduce((s, x) => s + tenure(x.log, x.u), 0);
      const topRounds = set.reduce((s, x) => s + x.u.topRounds, 0);
      out(`| ${name} | ${fusion ? 'Fusion' : 'Base'} | ${set.length} | ${pct(old.filter(x => tenure(x.log, x.u) >= 40).length / Math.max(1, old.length), 1)} | ${rated.length} | ${pct(mean(rated.map(x => scoreOf(x.u.wins, x.u.draws, x.u.battles))), 1)} | ${pct(topRounds / Math.max(1, unitRounds), 1)} |`);
    }
  }
  out();
  out('The final top 8 teams against the duel tool\'s planned field, with no charm on the ladder team and a random charm on each field team. The project line is that no build should win more than 75%.');
  out();
  out('| Seed | Player | Fusions on team | Battles | Win rate (95% interval) |');
  out('| ---: | ---: | ---: | ---: | ---: |');
  for (const log of logs) {
    for (const f of log.fieldTest) {
      const p = log.players.find(x => x.id === f.player)!;
      const nf = p.team.filter(id => log.units[id - 1].fusion).length;
      const [lo, hi] = wilson(f.wins + f.draws / 2, f.battles);
      out(`| ${tag(log)} | ${f.player} | ${nf} of 4 | ${f.battles} | ${pct((f.wins + f.draws / 2) / f.battles, 0)} (${pct(lo)} to ${pct(hi)}) |`);
    }
  }
  out();
  out('<!-- VERDICT -->');
  const text = L.join('\n') + '\n';
  if (reportFile) writeFileSync(reportFile, text);
  else console.log(text);
}

// ---------------------------------------------------------------- entry

if (!isMainThread) workerMain();
else {
  const args = process.argv.slice(2);
  if (args.includes('--analyze')) analyze(args.filter(a => /\.json(=|$)/.test(a)), argOf(args, 'report'));
  else ladder(args).catch(e => { console.error(e); process.exit(1); });
}
