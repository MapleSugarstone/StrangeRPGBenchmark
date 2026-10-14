// Random battles: both sides' rosters come from the match's deal, so neither player can choose or reroll them, and each
// player then picks four of six for each game as in any match. Each whorl is a hybrid one time in four and a plain kind
// otherwise. A roster spreads its types, its attack stats, and its bulk, and a hybrid is built to work: one crest and
// three plain moves, damage that scales with its own attack stat, habits that suit its moves, and a sturdy typing that
// adds reach (Notes/online-design.md, Random battles).
import { MOVES, PASSIVES } from '../battle/registry';
import { TAN_PER_STAT, TAN_TOTAL } from '../battle/engine';
import { SPECIES, WILD_KINDS } from '../data/species';
import { kindProfile, STAT_ORDER, type Profile } from '../data/profiles';
import { TYPES, typeMult, type Type } from '../data/types';
import { nameOptions, NO_FIT_HABITS, SHAPES, typeOptions } from '../game/fitting';
import { PLANNED_NOTIONS } from '../game/wildfit';
import { NOTION_IDS } from '../data/notions';
import { nameBlocked } from './names';
import { FORMAT, NAME_CHARS, ROSTER_SIZE, WHORL_NAME_MAX, type WireMon } from './protocol';

/** The format random battles queue under, so they pair only with each other. */
export const RANDOM_FORMAT = `${FORMAT}r`;
/** The chance that each whorl on a random roster is a hybrid. */
const HYBRID_CHANCE = 0.25;
/** Kinds drawn for each place on a roster. The one that suits the roster best takes the place. */
const DRAWS = 3;
/** Partners tried for each hybrid's first kind. */
const PARTNERS = 10;
/** What every roster holds: types across its six, at most two whorls on any one type, two whorls of each attack stat, and a bulky whorl. */
const MIN_TYPES = 4, MAX_SHARE = 2, MIN_EACH_BASIC = 2, MIN_BULKY = 1;
/** Rosters drawn before the last one stands even if it misses a floor. */
const TRIES = 40;
/** HP, DEF, and RES together at or above which a whorl counts as bulky, and AGI at or above which it counts as fast: about the top 30% of the pool. */
const BULKY = 348, FAST = 113;

/** A small seeded generator, the same on every copy of the game. */
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Both sides' rosters for a random battle from the match's deal. */
export function randomRosters(seed: number): [WireMon[], WireMon[]] {
  return [randomRoster(rngOf(seed ^ 0x2545f491)), randomRoster(rngOf(seed ^ 0x6c8e9cf5))];
}

/** A roster of six from any seed, for a hello in a random battle, whose rosters both clients then build from the match's deal. */
export function placeholderRoster(): WireMon[] {
  return randomRoster(rngOf(Math.floor(Math.random() * 0x7fffffff)));
}

/** The kinds random battles draw from: wild kinds that are neither legendaries nor persons. */
function pool(): string[] {
  return WILD_KINDS.filter(k => SPECIES[k] && !SPECIES[k].legendary && !SPECIES[k].person);
}

/** Which attack stat a move's damage scales with: P for ATK, M for MGK, X for both, or null for a move that deals none. */
function scaling(id: string): 'P' | 'M' | 'X' | null {
  const t = MOVES[id]?.text || '';
  const atk = /% ATK/.test(t), mgk = /% MGK/.test(t);
  return atk && mgk ? 'X' : atk ? 'P' : mgk ? 'M' : null;
}

/** A whorl as the builder weighs it: its wire form, its kinds, its types, its attack stat, and its profile. */
interface Built { w: WireMon; kinds: string[]; types: Type[]; basic: 'P' | 'M'; p: Profile }

/** The profile of a whorl of `kinds`: a hybrid's is the average of its parents'. */
function profileOfKinds(kinds: string[]): Profile {
  const out = {} as Profile;
  for (const k of STAT_ORDER) out[k] = Math.round(kinds.reduce((n, x) => n + kindProfile(x)[k], 0) / kinds.length);
  return out;
}

const isBulky = (p: Profile): boolean => p.hp + p.def + p.res >= BULKY;
const isFast = (p: Profile): boolean => p.agi >= FAST;

/** A whorl's types, attack stat, and profile from its wire form. */
function partsOf(w: WireMon): Pick<Built, 'types' | 'basic' | 'p'> {
  if (w.fit) return { types: w.fit.types as Type[], basic: w.fit.basic, p: profileOfKinds(w.fit.kinds) };
  const sp = SPECIES[w.kind!];
  return { types: [...sp.types], basic: sp.basic, p: kindProfile(w.kind!) };
}

/** Every floor a random roster misses: too few types, a type on too many whorls, too few of an attack stat, or no bulky whorl. */
export function spreadProblems(roster: WireMon[]): string[] {
  const parts = roster.map(partsOf), on = new Map<Type, number>(), out: string[] = [];
  for (const x of parts) for (const t of x.types) on.set(t, (on.get(t) || 0) + 1);
  if (on.size < MIN_TYPES) out.push(`${on.size} types`);
  for (const [t, n] of on) if (n > MAX_SHARE) out.push(`${t} on ${n} whorls`);
  const p = parts.filter(x => x.basic === 'P').length;
  if (p < MIN_EACH_BASIC || roster.length - p < MIN_EACH_BASIC) out.push(`${p} ATK and ${roster.length - p} MGK whorls`);
  if (parts.filter(x => isBulky(x.p)).length < MIN_BULKY) out.push('no bulky whorl');
  return out;
}

/**
 * One roster: six whorls with each kind and each notion once. Each place draws a few kinds and keeps the one that best
 * spreads the roster's types, attack stats, and bulk, so rosters differ and each still holds a team.
 */
export function randomRoster(rnd: () => number): WireMon[] {
  let team: Built[] = [];
  for (let k = 0; k < TRIES; k++) {
    team = draw(rnd);
    if (!spreadProblems(team.map(b => b.w)).length) break;
  }
  const notions = new Set<string>();
  const out = team.map(b => ({ ...b.w, ...kit(rnd, b, notions) }));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Six whorls in turn, each the best of a few draws by how it suits the roster so far. */
function draw(rnd: () => number): Built[] {
  const kinds = pool(), used = new Set<string>(), team: Built[] = [];
  while (team.length < ROSTER_SIZE) {
    const fuse = rnd() < HYBRID_CHANCE, left = kinds.filter(k => !used.has(k));
    let best: Built | null = null, top = -Infinity;
    for (let d = 0; d < DRAWS; d++) {
      const a = left[Math.floor(rnd() * left.length)];
      const c = fuse ? hybrid(rnd, a, left, team) : plain(a);
      const s = suits(team, c) + rnd() * 2;
      if (s > top) { best = c; top = s; }
    }
    for (const k of best!.kinds) used.add(k);
    team.push(best!);
  }
  return team;
}

/** A plain kind as it comes. */
function plain(k: string): Built {
  const sp = SPECIES[k];
  return { w: { kind: k, name: sp.name.length <= WHORL_NAME_MAX ? sp.name : '', notion: null }, kinds: [k], types: [...sp.types], basic: sp.basic, p: kindProfile(k) };
}

/** How well a whorl suits a roster: a new type, the scarcer attack stat, and bulk or speed the roster lacks score, and a pile-up costs. */
function suits(team: Built[], c: Built): number {
  let s = 0;
  for (const t of c.types) {
    const n = team.filter(b => b.types.includes(t)).length;
    s += n === 0 ? 2 : n < MAX_SHARE ? -0.5 : -6;
  }
  const same = team.filter(b => b.basic === c.basic).length;
  if (same >= ROSTER_SIZE - MIN_EACH_BASIC) s -= 6;
  else if (same < team.length - same) s += 1.5;
  const bulky = team.filter(b => isBulky(b.p)).length, fast = team.filter(b => isFast(b.p)).length;
  if (isBulky(c.p)) s += bulky === 0 ? 2 : bulky >= 3 ? -1.5 : 0;
  if (isFast(c.p)) s += fast === 0 ? 1.5 : fast >= 3 ? -1.5 : 0;
  return s;
}

/**
 * A notion that suits the whorl's attack and that no other whorl on the roster holds, and nacre for its part: HP and its
 * weaker guard for a bulky whorl, its attack and AGI for a fast one, and its attack and HP for the rest.
 */
function kit(rnd: () => number, b: Built, notions: Set<string>): Pick<WireMon, 'notion' | 'tan'> {
  const left = PLANNED_NOTIONS[b.basic].filter(n => !notions.has(n));
  const any = NOTION_IDS.filter(n => !notions.has(n));
  const notion = left.length ? left[Math.floor(rnd() * left.length)] : any.length ? any[Math.floor(rnd() * any.length)] : null;
  if (notion) notions.add(notion);
  const atk = b.basic === 'P' ? 'atk' : 'mgk', guard = b.p.def <= b.p.res ? 'def' : 'res', rest = TAN_TOTAL - TAN_PER_STAT;
  const tan = isBulky(b.p) ? { hp: TAN_PER_STAT, [guard]: rest } : isFast(b.p) ? { [atk]: TAN_PER_STAT, agi: rest } : { [atk]: TAN_PER_STAT, hp: rest };
  return { notion, tan };
}

/** Every way to keep two of a kind's four moves. */
function pairs(moves: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < moves.length; i++) for (let j = i + 1; j < moves.length; j++) out.push([moves[i], moves[j]]);
  return out;
}

/** How well a set of four moves suits an attack stat: damage that scales with it scores, damage that scales with the other costs more. */
function movesScore(moves: string[], basic: 'P' | 'M'): number {
  let s = 0, support = 0;
  for (const id of moves) {
    const k = scaling(id);
    if (k === basic) s += 2;
    else if (k === 'X') s += 0.5;
    else if (k === null) { support++; s += 0.5; }
    else s -= 3;
  }
  // A hybrid needs some damage, so a third move that deals none costs.
  return support > 2 ? s - 3 : s;
}

/** Words in a text that name a mechanic, such as Spur or Glare, for matching a habit to the moves that feed it. */
const COMMON = new Set(['Hits', 'Splash', 'Slow', 'Stun', 'Root', 'Haste', 'Expose', 'Fortify', 'Ward', 'Poison', 'Bleed', 'Burn', 'Sleep',
  'Regen', 'Hidden', 'Untouchable', 'ATK', 'MGK', 'DEF', 'RES', 'AGI', 'CHA', 'HP', 'The', 'Its', 'It', 'When', 'Each', 'Every', 'For',
  'If', 'A', 'An', 'At', 'In', 'On', 'Once', 'Then', 'Your', 'Until', 'While', 'After', 'Heals', 'Takes', 'Deals', 'Up', 'Next', 'This']);
function mechanics(text: string): string[] {
  return (text.match(/\b[A-Z][a-z]+\b/g) || []).filter(w => !COMMON.has(w));
}

/** How much a typing resists: one for each attacking type it takes less from, minus one for each it takes more from. */
function sturdiness(types: Type[]): number {
  let s = 0;
  for (const t of TYPES) { const m = typeMult(t, types); if (m < 1) s++; else if (m > 1) s--; }
  return s;
}

/**
 * A hybrid with `a` as one parent. Of ten partners from `left`, it keeps the pair, plain attack, and moves that score
 * best: exactly one crest when either parent has one, two moves from each parent, damage on the hybrid's own attack stat,
 * a good averaged profile in that stat, and a partner of a type the roster lacks. Habits follow its stat and its moves'
 * mechanics, and its typing is sturdy and adds the roster's missing types without putting a third whorl on any type.
 */
function hybrid(rnd: () => number, a: string, left: string[], team: Built[]): Built {
  const A = SPECIES[a];
  const free = left.filter(k => k !== a), on = (t: Type) => team.filter(b => b.types.includes(t)).length;
  const partners: string[] = [];
  while (partners.length < PARTNERS && partners.length < free.length) {
    const k = free[Math.floor(rnd() * free.length)];
    if (!partners.includes(k)) partners.push(k);
  }
  let best: { b: string; basic: 'P' | 'M'; moves: string[]; score: number } | null = null;
  for (const b of partners) {
    const B = SPECIES[b];
    const crestAvail = [...A.moves, ...B.moves].some(id => MOVES[id]?.nerve);
    const reach = B.types.some(t => !on(t)) ? 1 : 0;
    for (const basic of [...new Set([A.basic, B.basic])]) {
      const stat = basic === 'P' ? 'atk' : 'mgk';
      const body = (kindProfile(a)[stat] + kindProfile(b)[stat]) / 2;
      for (const ma of pairs(A.moves)) for (const mb of pairs(B.moves)) {
        const moves = [...ma, ...mb], crests = moves.filter(id => MOVES[id]?.nerve).length;
        if (crestAvail ? crests !== 1 : crests !== 0) continue;
        const score = movesScore(moves, basic) + (body - 100) / 20 + reach + rnd() * 0.5;
        if (!best || score > best.score) best = { b, basic, moves, score };
      }
    }
  }
  // A pool too small for any partner falls back to a plain kind.
  if (!best) return plain(a);
  const B = SPECIES[best.b], basic = best.basic, own = basic === 'P' ? 'ATK' : 'MGK', other = basic === 'P' ? 'MGK' : 'ATK';
  const words = new Set(best.moves.flatMap(id => [...mechanics(MOVES[id]?.name || ''), ...mechanics(MOVES[id]?.text || '')]));
  const habitScore = (id: string): number => {
    const t = PASSIVES[id]?.text || '';
    let s = rnd() * 0.5;
    if (t.includes(own)) s += 2;
    else if (t.includes(other)) s -= 3;
    for (const w of mechanics(t)) if (words.has(w)) s += 2;
    return s;
  };
  const habits = [...new Set([...A.passives, ...B.passives])].filter(id => PASSIVES[id] && !NO_FIT_HABITS.has(id))
    .map(id => ({ id, s: habitScore(id) })).sort((x, y) => y.s - x.s).slice(0, 2).map(h => h.id);
  const typing = (t: Type[]): number => sturdiness(t) + 2 * t.filter(x => !on(x)).length - 6 * t.filter(x => on(x) >= MAX_SHARE).length + rnd() * 0.3;
  const types = typeOptions({ types: A.types } as never, { types: B.types } as never).map(t => ({ t, s: typing(t) })).sort((x, y) => y.s - x.s)[0].t;
  // When every damaging move shares one type and the hybrid has another, its weakest damaging move takes the other for reach.
  const hitters = best.moves.filter(id => scaling(id) !== null && !MOVES[id]?.nerve);
  const hitTypes = new Set(hitters.map(id => MOVES[id]?.type));
  const spare = types.find(t => !hitTypes.has(t));
  let retune: { move: string; type: string } | null = null;
  if (hitters.length >= 2 && hitTypes.size === 1 && spare) {
    const power = (id: string) => Math.max(0, ...((MOVES[id]?.text || '').match(/\d+(?=% (ATK|MGK))/g) || ['0']).map(Number));
    const weakest = hitters.slice().sort((x, y) => power(x) - power(y))[0];
    retune = { move: weakest, type: spare };
  }
  const name = nameOptions(A.name, B.name).find(n => n.length <= WHORL_NAME_MAX && NAME_CHARS.test(n) && !nameBlocked(n)) ?? '';
  return {
    w: {
      fit: {
        kinds: [a, best.b], moves: best.moves, passives: habits, types, basic, retune,
        look: { shape: Math.floor(rnd() * SHAPES.length), palette: Math.floor(rnd() * 3) },
      },
      name,
      notion: null,
    },
    kinds: [a, best.b], types, basic, p: profileOfKinds([a, best.b]),
  };
}
