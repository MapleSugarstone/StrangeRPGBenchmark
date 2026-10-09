// Tests a team build against a field of opponents, or against another build.
// Usage: node dist-tools/duel.js builds/a.json [battles] [--vs=builds/b.json] [--field=resourced|plain] [--seed=N]
// A build file: { "name": "...", "charm": "rib", "team": [ { "kind": "cairn", "notion": "spareskin" },
//   { "fit": ["quarry", "carrion"], "moves": ["cut", "excavate", "peck", "mob"], "passives": ["dugout", "gather"],
//     "types": ["STONE", "BEAST"], "basic": "P", "notion": "bodkin" } ] }
// Every slough fights at level 25. Both sides use the strongest AI. The build takes each side half the time.
import { act, advance, newBattle, roundOf, TAN_PER_STAT, TAN_TOTAL } from '../battle/engine';
import { choose, chooseReplacement } from '../battle/ai';
import type { Battle, Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { SPECIES, WILD_KINDS, makeMon } from '../data/species';
import { NOTION_IDS } from '../data/notions';
import { plannedKit, randomFit } from '../game/wildfit';
import { makeFit, nameOptions, NO_FIT_HABITS, paletteOf, shapeOf } from '../game/fitting';
import type { Type } from '../data/types';
import { readFileSync } from 'node:fs';

declare const process: { argv: string[]; exit(n: number): never };

interface Entry { kind?: string; fit?: [string, string]; moves?: string[]; passives?: string[]; types?: Type[]; basic?: 'P' | 'M'; notion?: string; tan?: Record<string, number>; tape?: string }
interface Build { name: string; charm?: string | null; team: Entry[] }

const CHARMS = [null, 'rib', 'mast', 'spire', 'bole', 'pylon', 'tusk', 'hilt', 'fall'];
let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

function fail(msg: string): never { console.error(msg); process.exit(1); }

/** Builds one slough from a build entry, checking every rule the Fitter enforces. */
function monOf(e: Entry, where: string): Mon {
  let m: Mon;
  if (e.fit) {
    const [a, b] = e.fit;
    if (!SPECIES[a] || !SPECIES[b]) fail(`${where}: unknown kind in fit ${a}+${b}`);
    if (a === b) fail(`${where}: a slough cannot be fitted with its own kind`);
    const A = makeMon(a, 50), B = makeMon(b, 50);
    const moves = e.moves || [];
    const fromA = moves.filter(id => A.moves.includes(id)).length, fromB = moves.filter(id => B.moves.includes(id) && !A.moves.includes(id)).length;
    if (moves.length !== 4 || fromA !== 2 || fromB !== 2) fail(`${where}: a fitting keeps exactly two moves from each parent`);
    if (moves.filter(id => MOVES[id]?.nerve).length > 2) fail(`${where}: at most two crests`);
    const passives = e.passives || [];
    if (passives.length !== 2 || passives.some(p => !A.passives.includes(p) && !B.passives.includes(p))) fail(`${where}: two passives from the parents`);
    if (passives.some(p => NO_FIT_HABITS.has(p))) fail(`${where}: a fit cannot keep ${passives.filter(p => NO_FIT_HABITS.has(p)).join(', ')}`);
    const types = e.types || [A.types[0]];
    if (types.length < 1 || types.length > 2 || types.some(t => !A.types.includes(t) && !B.types.includes(t))) fail(`${where}: one or two types from the parents`);
    const basic = e.basic || A.basic;
    m = makeFit(A, B, { moves, passives, types, basic, retune: null, sprite: { px: shapeOf(A.sprite, B.sprite, 0), c: paletteOf(A.sprite, B.sprite, 0) }, name: nameOptions(A.name, B.name)[0] }, 0);
  } else {
    if (!e.kind || !SPECIES[e.kind]) fail(`${where}: unknown kind ${e.kind}`);
    m = makeMon(e.kind, 50);
  }
  if (e.tape) {
    if (!/^[pags]{4}$/.test(e.tape)) fail(`${where}: a Tape is four of p, a, g, s`);
    m.tape = e.tape;
  }
  if (e.notion) {
    if (!NOTIONS[e.notion]) fail(`${where}: unknown notion ${e.notion}`);
    m.notion = e.notion;
  }
  if (e.tan) {
    const pts = Object.values(e.tan);
    if (Object.keys(e.tan).some(k => !['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'].includes(k))) fail(`${where}: tan names an unknown stat`);
    if (pts.some(v => v < 0 || v > TAN_PER_STAT) || pts.reduce((a, b) => a + b, 0) > TAN_TOTAL) fail(`${where}: at most ${TAN_PER_STAT} tan in a stat and ${TAN_TOTAL} in all`);
    m.tan = { ...e.tan };
  }
  return m;
}

function load(file: string): Build {
  const b = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as Build;
  if (!b.team || b.team.length !== 4) fail(`${file}: a team has exactly four sloughs`);
  const kinds = b.team.map(e => e.kind || e.fit!.join('+'));
  if (new Set(kinds).size !== 4) fail(`${file}: four different sloughs`);
  if (b.charm && !CHARMS.includes(b.charm)) fail(`${file}: unknown charm ${b.charm}`);
  return b;
}

/**
 * An opponent field. Resourced: random kinds, two random fittings, a random notion and random tan on each, a random charm.
 * Planned: the same kinds and fittings, but each slough's tan goes into its attack stat and HP, its notion suits its attack,
 * and the team always wears a charm, the way a player builds a team.
 */
function fieldTeam(kind: 'resourced' | 'plain' | 'planned'): { mons: Mon[]; charm: string | null } {
  const mons: Mon[] = [];
  const used = new Set<string>();
  while (mons.length < 4) {
    const k = pick(WILD_KINDS);
    if (used.has(k)) continue;
    used.add(k);
    const m = kind !== 'plain' && mons.length < 2 ? randomFit(rnd, k, pick(WILD_KINDS.filter(x => x !== k)), 50) : makeMon(k, 50);
    if (kind === 'planned') plannedKit(rnd, m);
    else if (kind === 'resourced') {
      m.notion = pick(NOTION_IDS);
      const tan: Record<string, number> = {};
      const stats = ['hp', 'atk', 'def', 'res', 'mgk', 'agi', 'cha'];
      for (let p = 0; p < TAN_TOTAL; p++) { const s = pick(stats); if ((tan[s] || 0) < TAN_PER_STAT) tan[s] = (tan[s] || 0) + 1; }
      m.tan = tan;
    }
    mons.push(m);
  }
  return { mons, charm: kind === 'plain' ? null : kind === 'planned' ? pick(CHARMS.filter(c => c)) : pick(CHARMS) };
}

function fight(a: { mons: Mon[]; charm: string | null }, z: { mons: Mon[]; charm: string | null }): { winner: 0 | 1 | 'draw'; rounds: number; fatigued: boolean } {
  const b: Battle = newBattle({ mons: a.mons, name: 'A', ai: 'champion', charm: a.charm }, { mons: z.mons, name: 'Z', ai: 'champion', charm: z.charm }, { nerve: true, wild: false, sync: true, canRun: false });
  b.quiet = true;
  for (let i = 0; i < 600; i++) {
    const d = advance(b, chooseReplacement);
    if (d.kind === 'over') break;
    if (d.kind === 'act') act(b, choose(b));
  }
  return { winner: b.over === 0 ? 0 : b.over === 1 ? 1 : 'draw', rounds: roundOf(b), fatigued: !!b.fatigued };
}

function main(): void {
  const args = process.argv.slice(2);
  const file = args.find(a => a.endsWith('.json'));
  if (!file) fail('Give a build file.');
  const N = Number(args.find(a => /^\d+$/.test(a)) || 300);
  seed = Number((args.find(a => a.startsWith('--seed=')) || '--seed=7').slice(7));
  const vsFile = args.find(a => a.startsWith('--vs='))?.slice(5);
  const fieldKind = ((args.find(a => a.startsWith('--field='))?.slice(8)) || 'planned') as 'resourced' | 'plain' | 'planned';
  const build = load(file);
  const vs = vsFile ? load(vsFile) : null;
  const team = (bd: Build) => ({ mons: bd.team.map((e, i) => monOf(e, `${bd.name} slot ${i + 1}`)), charm: bd.charm ?? null });

  let wins = 0, draws = 0, rounds = 0, fatigued = 0;
  for (let g = 0; g < N; g++) {
    const mine = team(build);
    const other = vs ? team(vs) : fieldTeam(fieldKind);
    const swap = g % 2 === 1;
    const r = swap ? fight(other, mine) : fight(mine, other);
    const myWin = swap ? r.winner === 1 : r.winner === 0;
    if (r.winner === 'draw') draws++;
    else if (myWin) wins++;
    rounds += r.rounds;
    if (r.fatigued) fatigued++;
  }
  const p = wins / N;
  const ci = 1.96 * Math.sqrt(p * (1 - p) / N);
  const pct = (x: number) => (100 * x).toFixed(1) + '%';
  console.log(`${build.name} against ${vs ? vs.name : `the ${fieldKind} field`}: ${pct(p)} wins (plus or minus ${pct(ci)}), ${draws} draws, ${N} battles.`);
  console.log(`Mean rounds ${(rounds / N).toFixed(1)}, reached fatigue ${pct(fatigued / N)}.`);
  if (p - ci > 0.75) console.log('OVER THE LINE: this build wins more than 75% even at the low end of its interval.');
  const names = build.team.map((e, i) => { const m = monOf(e, `slot ${i + 1}`); return `${m.name} [${m.moves.map(id => MOVES[id].name).join(', ')}] {${m.passives.map(id => PASSIVES[id].name).join(', ')}}${m.notion ? ` holding ${NOTIONS[m.notion].name}` : ''}`; });
  for (const n of names) console.log('  ' + n);
}

main();
