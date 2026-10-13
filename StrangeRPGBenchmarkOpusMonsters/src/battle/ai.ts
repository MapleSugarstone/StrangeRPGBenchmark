import { shownHp, setPastAi, act, actJoint, advance, barred, calledOf, castMove, clone, foresees, doAttack, isOut, legal, moveDef, moveType, out, roundOf, runMove, seenTypes, sk, standing, stat, typeOn, typesOf, visit, visitCast, visitChoices } from './engine';
import type { Action, Battle, Fighter, Pending, Summon } from './model';
import { DROPS, FIELDS, GROUNDS, MARKS, MOVES, SUMMONS } from './registry';
import { typeMult } from '../data/types';

/** Counters for the balance report: how many actions were close to the best one. */
export const aiStats = { decisions: 0, options: 0, legal: 0 };

/** Switches for parts of the AI, so two versions can play each other in the benchmark (src/tools/aibench.ts). */
export interface AiOpts {
  /** Statuses on reserves count too, at RESERVE_SHARE of what they are worth on the out whorl. */
  reserves: boolean;
  /** Poison, Bleed, Burn, and Regen count by the HP they will still move. */
  dots: boolean;
  /** A pending wind-up counts by what it would do if it landed now. */
  windups: boolean;
  /** In a joint round, its own choices are first ranked against the foe's likeliest reply rather than a plain attack. */
  foeBest: boolean;
  /** In a joint round, the best rows are judged by the round after as well. */
  twoRound: boolean;
  /** A switch must beat staying in by twice the usual margin. */
  lessSwitch: boolean;
}
/** All on: 57% against all off over 900 benchmark games, and 54% against search depth alone (Notes/ai.md). */
export const AI_DEFAULT: AiOpts = { reserves: true, dots: true, windups: true, foeBest: true, twoRound: true, lessSwitch: false };
let OPTS: AiOpts = AI_DEFAULT;
const SIDE_OPTS: [AiOpts | null, AiOpts | null] = [null, null];
/** Gives one side its own AI switches until cleared with null. The other side keeps the defaults. */
export function setAiOpts(side: 0 | 1, o: Partial<AiOpts> | null): void { SIDE_OPTS[side] = o ? { ...AI_DEFAULT, ...o } : null; }
const RESERVE_SHARE = 0.6;
/** How much better a switch must look than staying in before the AI takes it. */
const switchCost = (): number => (OPTS.lessSwitch ? 0.12 : 0.06);

function fighterValue(f: Fighter): number {
  if (f.ko || f.gone) return 0;
  // An unspent revive is worth part of a slough, or the AI treats the killing blow as wasted.
  const spare = f.mon.notion === 'spareskin' && !f.k.spare ? 0.3 : 0;
  // Poise turns away a foe's Stun, Sleep, Root, and Slow: poise of 30% of max HP is worth about 0.1.
  const poise = 0.33 * Math.min(0.5, (f.poise || 0) / f.maxHp);
  // Cold storage still owes the heals of its turns left, counted at most of their worth as HP.
  const stored = f.stored ? 1.2 * Math.min(1 - f.hp / f.maxHp, f.stored.heal * f.stored.turns) : 0;
  return 1 + 1.4 * (f.hp / f.maxHp) + 0.5 * Math.min(1, f.shield / f.maxHp) + poise + stored + spare;
}

/** How well `a` hits `d` with its own moves' types, minus the reverse. With `b`, hooks that turn the chart count. */
export function matchup(a: Fighter, d: Fighter, b?: Battle): number {
  let best = 1;
  for (const id of a.moves) {
    const m = MOVES[id];
    if (!m) continue;
    const ty = moveType(a, m);
    best = Math.max(best, (b ? typeOn(b, d, ty, undefined, a) : typeMult(ty, seenTypes(d))) * (typesOf(a).includes(ty) ? 1.2 : 1));
  }
  let worst = 1;
  for (const id of d.moves) {
    const m = MOVES[id];
    if (!m) continue;
    const ty = moveType(d, m);
    worst = Math.max(worst, (b ? typeOn(b, a, ty, typeMult(ty, typesOf(a)), d) : typeMult(ty, typesOf(a))) * (seenTypes(d).includes(ty) ? 1.2 : 1));
  }
  return best - worst;
}

const BAD = { stun: 0.35, sleep: 0.3, silence: 0.12, root: 0.04, taunt: 0.08, rot: 0.03, doom: 0.2 } as const;
const GOOD = { unstop: 0.05, ward: 0.08, thorns: 0.03, regen: 0.05, invuln: 0.2, monument: 0.12, dashing: 0.02 } as const;
/**
 * Statuses that pay off on every turn they have left, worth this much per turn up to 3, positive for the holder's side.
 * A plain attack moves about 0.39, so 1.25x damage for a turn is about 0.1, and a turn moved 30% is about 0.1.
 */
const PER_TURN = { expose: -0.1, weaken: -0.08, slow: -0.1, empower: 0.1, fortify: 0.08, haste: 0.1 } as const;
/** Turns a status still has to pay off. A Slow or Haste that already moved the waiting turn has one fewer, and the move shows in the timeline. */
function payTurns(id: string, st: { n: number; v?: number }): number {
  const n = st.n || 1;
  return Math.min(3, (id === 'slow' || id === 'haste') && st.v === 1 ? n - 1 : n);
}
/** What being ahead on the timeline is worth per tick: 100 ticks is about one plain action. */
const TICK_WORTH = 0.003;
/** A move boost per use and per point of multiplier, discounted for the turns its slot goes unused. */
const BOOST_WORTH = 0.25;
/** One turn of cooldown the foe added to a slot, doubled on a crest, up to 3 turns. */
const CD_WORTH = 0.04;

/** What one action, leaving burst, or sprung trap of a summon is worth, found once by running it on a copy and counting HP moved, in evaluate's units. */
const actWorth = new Map<string, number>();
function probeAct(b: Battle, u: Summon, hook: 'act' | 'gone' | 'trap' = 'act'): number {
  const owner = b.s[u.side].f[u.by];
  const key = `${u.def}:${hook}:${owner.mon.uid}:${owner.mon.level}`;
  const known = actWorth.get(key);
  if (known !== undefined) return known;
  actWorth.set(key, 0);
  if (actWorth.size > 4000) actWorth.clear();
  let worth = 0;
  try {
    const c = clone(b);
    const cu = c.s[u.side].sum.find(x => x.uid === u.uid);
    const def = SUMMONS[u.def];
    c.quiet = true;
    if (cu && def?.[hook]) {
      const hp = (s: 0 | 1) => c.s[s].f.reduce((n, f) => n + (f.ko || f.gone ? 0 : f.hp / f.maxHp), 0);
      const mine = hp(u.side), theirs = hp((1 - u.side) as 0 | 1);
      const them = c.s[1 - u.side];
      const next = standing(them).find(x => x.idx !== them.out);
      if (hook === 'trap') { if (next) def.trap!(c, cu, next); } else def[hook]!(c, cu, c.s[u.side].f[u.by]);
      worth = 1.4 * ((theirs - hp((1 - u.side) as 0 | 1)) + (hp(u.side) - mine));
    }
  } catch { worth = 0; }
  actWorth.set(key, Math.max(0, worth));
  return Math.max(0, worth);
}

/**
 * What a summon adds just by standing there, for summons that work through their owner's passives: one exchange of
 * basic attacks between the out whorls with the summon, minus the same exchange without it. Cached.
 */
const presenceWorth = new Map<string, number>();
function probePresence(b: Battle, u: Summon): number {
  const mo = out(b, u.side), to = out(b, (1 - u.side) as 0 | 1);
  if (!mo || !to || mo.ko || to.ko) return 0;
  const key = `${u.def}:${mo.mon.uid}:${to.mon.uid}:${b.s[u.side].sum.filter(x => x.def === u.def).length}`;
  const known = presenceWorth.get(key);
  if (known !== undefined) return known;
  presenceWorth.set(key, 0);
  if (presenceWorth.size > 4000) presenceWorth.clear();
  const exchange = (keep: boolean): number => {
    const c = clone(b);
    c.quiet = true;
    if (!keep) c.s[u.side].sum = c.s[u.side].sum.filter(x => x.uid !== u.uid);
    const hp = (s: number) => c.s[s].f.reduce((n, x) => n + (x.ko || x.gone ? 0 : x.hp / x.maxHp), 0);
    const mine = hp(u.side), theirs = hp(1 - u.side);
    const a = out(c, u.side), d = out(c, (1 - u.side) as 0 | 1);
    doAttack(c, a, d);
    if (!a.ko && !d.ko && !SUMMONS[u.def]?.guard) doAttack(c, d, a);
    return 1.4 * ((hp(u.side) - mine) - (hp(1 - u.side) - theirs));
  };
  let worth = 0;
  try { worth = Math.max(0, exchange(true) - exchange(false)); } catch { worth = 0; }
  presenceWorth.set(key, worth);
  return worth;
}

/** HP share moved toward the holder's side when a mark's turnStart or expire hook runs once, found on a copy and cached. */
const hookWorth = new Map<string, number>();
function probeMark(b: Battle, f: Fighter, id: string, hook: 'turnStart' | 'expire'): number {
  const mk = f.m[id];
  const key = `${id}:${hook}:${mk.by}:${f.mon.uid}:${f.mon.level}`;
  const known = hookWorth.get(key);
  if (known !== undefined) return known;
  hookWorth.set(key, 0);
  if (hookWorth.size > 4000) hookWorth.clear();
  let worth = 0;
  try {
    const c = clone(b);
    c.quiet = true;
    const cf = c.s[f.side].f[f.idx];
    const hp = (s: number) => c.s[s].f.reduce((n, x) => n + (x.ko || x.gone ? 0 : x.hp / x.maxHp), 0);
    const mine = hp(f.side), theirs = hp(1 - f.side);
    const def = MARKS[id];
    if (hook === 'turnStart') def.turnStart?.(c, cf);
    else { const m = cf.m[id]; delete cf.m[id]; def.expire?.(c, cf, m); }
    worth = 1.4 * ((hp(f.side) - mine) - (hp(1 - f.side) - theirs));
  } catch { worth = 0; }
  hookWorth.set(key, worth);
  return worth;
}

/** HP share the move that spends a mark would move if its out holder used it now, found on a copy and cached by the mark's stacks and value. */
const spendWorth = new Map<string, number>();
function probeSpend(b: Battle, f: Fighter, id: string, move: string): number {
  const i = f.moves.indexOf(move);
  if (i < 0 || !isOut(b, f)) return 0;
  const mk = f.m[id], foe = out(b, (1 - f.side) as 0 | 1);
  if (!foe || foe.ko) return 0;
  const key = `${id}:${f.mon.uid}:${f.mon.level}:${mk.n}:${mk.v}:${foe.mon.uid}:${Math.round(10 * foe.hp / foe.maxHp)}`;
  const known = spendWorth.get(key);
  if (known !== undefined) return known;
  spendWorth.set(key, 0);
  if (spendWorth.size > 4000) spendWorth.clear();
  let worth = 0;
  try {
    const c = clone(b);
    c.quiet = true;
    const hp = (s: number) => c.s[s].f.reduce((n, x) => n + (x.ko || x.gone ? 0 : x.hp / x.maxHp), 0);
    const mine = hp(f.side), theirs = hp(1 - f.side);
    runMove(c, c.s[f.side].f[f.idx], i, {});
    worth = 1.4 * ((hp(f.side) - mine) - (hp(1 - f.side) - theirs));
  } catch { worth = 0; }
  worth = Math.max(0, worth);
  spendWorth.set(key, worth);
  return worth;
}

/** What a mark is worth to its holder: its listed value, plus what its turn-start and expiry hooks and its spending move will move, discounted. */
function markWorth(b: Battle, f: Fighter, id: string): number {
  const def = MARKS[id];
  if (!def) return 0;
  const mk = f.m[id];
  let v = (def.value || 0) * Math.min(4, mk.n);
  if (def.turnStart) v += 0.7 * probeMark(b, f, id, 'turnStart') * (mk.t > 0 ? Math.min(4, mk.t) : 3);
  if (def.expire && mk.t > 0) v += 0.7 * probeMark(b, f, id, 'expire');
  if (def.spend) v += 0.5 * probeSpend(b, f, id, def.spend);
  return v;
}

/**
 * What a summon is worth to its side: a twin nearly a whorl, a unit that acts its remaining actions (up to four) at its
 * probed worth, a guard the HP it can still soak, a trap a small flat amount, plus its leaving burst and presence.
 */
function summonWorth(b: Battle, u: Summon): number {
  const share = u.hp / u.maxHp;
  if (u.moves) return 0.3 + 1.1 * share;
  const def = SUMMONS[u.def];
  if (!def) return 0;
  let v = 0;
  if (def.act) v += probeAct(b, u) * Math.min(4, u.turns > 0 ? u.turns : 4) * (0.5 + 0.5 * share);
  if (def.guard) { const owner = b.s[u.side].f[u.by]; v += 1.4 * u.hp / Math.max(1, owner.maxHp); }
  if (def.trap && standing(b.s[1 - u.side]).length > 1) v += 0.1 + 0.7 * probeAct(b, u, 'trap');
  if (def.gone) v += 0.7 * probeAct(b, u, 'gone');
  if (!def.trap) v += 0.7 * probePresence(b, u) * Math.min(3, u.turns > 0 ? u.turns : 3);
  return v || 0.08 * share;
}

/**
 * The HP that Poison, Bleed, and Burn will still take from a whorl, less what Regen will give back, as evaluate's share of
 * the whorl. Poison loses a stack a turn, so n stacks take n(n+1)/2 times 3% of max HP. Positive is bad for the whorl.
 */
function dotWorth(b: Battle, f: Fighter): number {
  if (f.ko || f.gone) return 0;
  let dmg = 0, back = 0;
  const p = f.s.poison, bl = f.s.bleed, bu = f.s.burn, rg = f.s.regen;
  if (p) dmg += 0.03 * f.maxHp * p.n * (p.n + 1) / 2;
  if (bl) dmg += (bl.v || 5) * bl.n * (bl.n + 1) / 2 * 100 / (100 + stat(b, f, 'def'));
  if (bu) dmg += (bu.v || 10) * Math.min(3, bu.n) * 100 / (100 + stat(b, f, 'res'));
  if (rg) back += (rg.v || 0.06) * f.maxHp * Math.min(3, rg.n);
  return 1.4 * 0.8 * (Math.min(f.hp, dmg) - Math.min(f.maxHp - f.hp, back)) / f.maxHp;
}

/** What a pending wind-up would move if it landed on the board as it stands, found on a copy and cached. */
const windWorth = new Map<string, number>();
function probeWind(b: Battle, p: Pending): number {
  const u = b.s[p.side].f[p.idx], foe = out(b, (1 - p.side) as 0 | 1);
  if (!u || u.ko || u.gone || !foe || foe.ko || foe.gone) return 0;
  const key = `${p.move}:${u.mon.uid}:${u.mon.level}:${foe.mon.uid}:${Math.round(10 * foe.hp / foe.maxHp)}:${foe.s.guard ? 1 : 0}`;
  const known = windWorth.get(key);
  if (known !== undefined) return known;
  windWorth.set(key, 0);
  if (windWorth.size > 4000) windWorth.clear();
  let worth = 0;
  try {
    const c = clone(b);
    c.quiet = true;
    const cu = c.s[p.side].f[p.idx];
    const i = cu.moves.indexOf(p.move);
    if (i >= 0) {
      const hp = (s: number) => c.s[s].f.reduce((n, x) => n + (x.ko || x.gone ? 0 : x.hp / x.maxHp), 0);
      const mine = hp(p.side), theirs = hp(1 - p.side);
      runMove(c, cu, i, { target: p.data?.target });
      worth = 1.4 * ((theirs - hp(1 - p.side)) + (hp(p.side) - mine));
    }
  } catch { worth = 0; }
  worth = Math.max(0, worth);
  windWorth.set(key, worth);
  return worth;
}

/** What a pending echo would move if it were cast on the board as it stands, found on a copy and cached. */
const echoWorth = new Map<string, number>();
function probeEcho(b: Battle, p: Pending): number {
  const u = b.s[p.side].f[p.idx], foe = out(b, (1 - p.side) as 0 | 1);
  if (!u || u.ko || u.gone || !foe || foe.ko || foe.gone) return 0;
  const key = `${p.move}:${p.data?.power}:${u.mon.uid}:${u.mon.level}:${foe.mon.uid}:${Math.round(10 * foe.hp / foe.maxHp)}`;
  const known = echoWorth.get(key);
  if (known !== undefined) return known;
  echoWorth.set(key, 0);
  if (echoWorth.size > 4000) echoWorth.clear();
  let worth = 0;
  try {
    const c = clone(b);
    c.quiet = true;
    const hp = (s: number) => c.s[s].f.reduce((n, x) => n + (x.ko || x.gone ? 0 : x.hp / x.maxHp), 0);
    const mine = hp(p.side), theirs = hp(1 - p.side);
    castMove(c, c.s[p.side].f[p.idx], p.move, (p.data?.power ?? 100) / 100);
    worth = 1.4 * ((theirs - hp(1 - p.side)) + (hp(p.side) - mine));
  } catch { worth = 0; }
  worth = Math.max(0, worth);
  echoWorth.set(key, worth);
  return worth;
}

/** Empties every cache the AI's probes fill, so two pages that ran different battles before choose alike in the next one. */
export function resetAiCaches(): void {
  for (const m of [actWorth, presenceWorth, hookWorth, spendWorth, windWorth, echoWorth]) m.clear();
}

export function evaluate(b: Battle, side: 0 | 1): number {
  if (b.over !== null) {
    if (b.over === side) return 1000;
    if (b.over === 1 - side) return -1000;
    return side === 0 ? 500 : -500;
  }
  const me = b.s[side];
  const them = b.s[1 - side];
  let v = 0;
  for (const f of me.f) v += fighterValue(f);
  for (const f of them.f) v -= fighterValue(f);
  v += 0.05 * (me.nerve - them.nerve);
  // A house's store heals the next whorl out: counted as HP, at most half a whorl's worth.
  for (const [sd, sign] of [[me, 1], [them, -1]] as const) { const o = sd.f[sd.out]; if (sd.pool && o?.maxHp) v += sign * 1.1 * Math.min(0.5, sd.pool / o.maxHp); }
  v += me.sum.reduce((n, u) => n + summonWorth(b, u), 0) - them.sum.reduce((n, u) => n + summonWorth(b, u), 0);
  const mo = out(b, side);
  const to = out(b, (1 - side) as 0 | 1);
  if (!mo.ko && !to.ko) v += 0.06 * matchup(mo, to, b);
  for (const [k, w] of Object.entries(BAD)) {
    if ((to.s as any)[k]) v += w * Math.min(2, (to.s as any)[k].n || 1);
    if ((mo.s as any)[k]) v -= w * Math.min(2, (mo.s as any)[k].n || 1);
  }
  for (const [k, w] of Object.entries(GOOD)) {
    if ((mo.s as any)[k]) v += w;
    if ((to.s as any)[k]) v -= w;
  }
  for (const [k, w] of Object.entries(PER_TURN)) {
    const a = (mo.s as any)[k], z = (to.s as any)[k];
    if (a) v += w * payTurns(k, a);
    if (z) v -= w * payTurns(k, z);
  }
  // Team buffs and spread debuffs land on reserves too, and those whorls carry them out with them.
  if (OPTS.reserves) for (const f of [...me.f, ...them.f]) {
    if (f.ko || f.gone || f === mo || f === to) continue;
    const sign = f.side === side ? 1 : -1;
    for (const [k, w] of Object.entries(PER_TURN)) { const st = (f.s as any)[k]; if (st) v += sign * RESERVE_SHARE * w * payTurns(k, st); }
    for (const [k, w] of Object.entries(GOOD)) if ((f.s as any)[k]) v += sign * RESERVE_SHARE * w;
  }
  // A lent passive pays off over the turns it has left, about as much as a turn of Empower at most.
  for (const f of [...me.f, ...them.f]) if (f.lent?.length && !f.ko && !f.gone) for (const x of f.lent) v += (f.side === side ? 1 : -1) * 0.04 * Math.min(3, x.turns);
  // A reach shift waiting on a move: wide is worth more with more foe reserves to splash, tight a little either way.
  for (const f of [...me.f, ...them.f]) if (f.reach && !f.ko && !f.gone) {
    const foeRes = b.s[1 - f.side].f.filter(x => !x.ko && !x.gone).length - 1;
    v += (f.side === side ? 1 : -1) * Math.min(2, f.reach.uses) * (f.reach.mode === 'wide' ? 0.05 * Math.max(0, foeRes) : 0.06);
  }
  // Banked damage lands later in one hit, so it counts like damage taken, discounted a little for the wait.
  for (const f of [...me.f, ...them.f]) if (f.bank && !f.ko && !f.gone) v += (f.side === side ? -1 : 1) * 1.4 * 0.9 * Math.min(f.hp, f.bank) / f.maxHp;
  if (OPTS.dots) {
    for (const f of them.f) v += dotWorth(b, f);
    for (const f of me.f) v -= dotWorth(b, f);
  } else {
    for (const f of them.f) {
      if (f.s.poison) v += 0.02 * f.s.poison.n;
      if (f.s.bleed) v += 0.015 * f.s.bleed.n;
      if (f.s.burn) v += 0.03;
    }
    for (const f of me.f) {
      if (f.s.poison) v -= 0.02 * f.s.poison.n;
      if (f.s.bleed) v -= 0.015 * f.s.bleed.n;
      if (f.s.burn) v -= 0.03;
    }
  }
  for (const f of [...me.f, ...them.f]) {
    if (f.ko || f.gone) continue;
    const sign = f.side === side ? 1 : -1;
    for (const id in f.m) v += sign * markWorth(b, f, id);
    const share = isOut(b, f) ? 1 : RESERVE_SHARE;
    for (const x of f.boost || []) v += sign * share * BOOST_WORTH * (x.mul - 1) * (x.uses > 0 ? Math.min(3, x.uses) : 3);
    if (f.cdHit) f.cdHit.forEach((h, i) => { if (h > 0) v -= sign * share * CD_WORTH * Math.min(3, h) * (MOVES[f.moves[i]]?.nerve ? 2 : 1); });
  }
  // A whorl lying in wait casts its stored move as the foe next acts, so it counts like an echo about to land.
  for (const f of [...me.f, ...them.f]) if (f.wait && !f.ko && !f.gone && isOut(b, f)) {
    const w = 0.8 * probeEcho(b, { id: 0, at: b.t, kind: 'echo', side: f.side, idx: f.idx, move: f.wait.move, data: { power: 100 } });
    v += f.side === side ? w : -w;
  }
  for (const p of b.pend) {
    // An echo lands for sure unless its caster falls first, so it counts at most of its probed worth.
    if (p.kind === 'echo') { const w = 0.8 * probeEcho(b, p); v += p.side === side ? w : -w; continue; }
    // An action held in a cave comes back out free if its whorl stays out: about a plain attack's worth, discounted.
    if (p.kind === 'held') { v += (p.side === side ? 1 : -1) * 0.25; continue; }
    if (p.kind !== 'windup') continue;
    const m = MOVES[p.move];
    // A probed wind-up is discounted for the chance it is cut off or met with a guard first.
    const w = OPTS.windups ? 0.08 + 0.7 * probeWind(b, p) : 0.15 + 0.06 * (m?.nerve || 0);
    v += p.side === side ? w : -w;
  }
  v += 0.04 * them.caps - 0.04 * me.caps;
  if (b.field) v += FIELDS[b.field.id]?.value?.(b, side) || 0;
  // A ground prices itself for `side`, on the field scale, by which side it lies under.
  for (const sd of [0, 1] as const) { const g = b.s[sd].ground; if (g) v += GROUNDS[g.id]?.value?.(b, side) || 0; }
  // A held tide costs its side about a tide's worth a round, up to three rounds.
  for (const sd of [0, 1] as const) { const h = b.s[sd].hold; if (h) v += (sd === side ? -1 : 1) * 0.05 * Math.min(3, h.turns); }
  // A side cut off from its bench loses its switches and its reserves' help: about 0.06 a round, up to 3.
  for (const sd of [0, 1] as const) { const ct = b.s[sd].cut; if (ct) v += (sd === side ? -1 : 1) * 0.06 * Math.min(3, ct.turns); }
  // A spinning side loses its pick of who stands out front, and its wind-ups and channels: about 0.05 a turn left, up to 3.
  for (const sd of [0, 1] as const) { const sp = b.s[sd].spin; if (sp) v += (sd === side ? -1 : 1) * 0.05 * Math.min(3, sp.turns); }
  // A crest price costs its side about 0.04 a round for each tide it adds, up to 3 rounds, and a lower price is worth the same.
  for (const sd of [0, 1] as const) { const pr = b.s[sd].price; if (pr) v += (sd === side ? -1 : 1) * 0.04 * pr.add * Math.min(3, pr.turns); }
  // Bench fog keeps the foe off the side's reserves: about 0.04 a round, up to 3.
  for (const sd of [0, 1] as const) { const fg = b.s[sd].fog; if (fg) v += (sd === side ? 1 : -1) * 0.04 * Math.min(3, fg.turns); }
  // Pink tide cannot pay for a crest, so each counts at about 0.02 of a clear tide's 0.05.
  for (const sd of [0, 1] as const) { const pk = b.s[sd].pink; if (pk) v += (sd === side ? -1 : 1) * 0.03 * Math.min(pk.n, b.s[sd].nerve); }
  // An out whorl up off the ground is out of reach of dashes and grounds: about 0.06.
  for (const sd of [0, 1] as const) { const o = b.s[sd].f[b.s[sd].out]; if (o && o.up && !o.ko) v += (sd === side ? 1 : -1) * 0.06; }
  // A mantle counts as a shield on the side's out whorl, as fighterValue counts one.
  for (const sd of [0, 1] as const) { const m = b.s[sd].mantle, o = out(b, sd); if (m && o) v += (sd === side ? 1 : -1) * 0.5 * Math.min(1, m.hp / o.maxHp); }
  v += TICK_WORTH * Math.max(-150, Math.min(150, them.next - me.next));
  return v;
}

export function chooseReplacement(b: Battle, side: 0 | 1): number {
  const s = b.s[side];
  const foe = out(b, (1 - side) as 0 | 1);
  let best = -1, bv = -Infinity;
  const called = calledOf(s);
  for (const f of standing(s)) {
    if (f.idx === s.out && !f.ko) continue;
    // A called reserve comes out first, and a barred (buried) one only when nobody else can.
    const v = (foe && !foe.ko ? matchup(f, foe, b) : 0) + f.hp / f.maxHp - (barred(f) ? 100 : 0) + (f === called ? 200 : 0);
    if (v > bv) { bv = v; best = f.idx; }
  }
  return best;
}

function settle(b: Battle): void {
  advance(b, chooseReplacement);
}

function rng(b: Battle): number {
  const s = sk(b, 1);
  s.seed = (Math.imul(s.seed || 12345, 1103515245) + 12345) & 0x7fffffff;
  return s.seed / 0x7fffffff;
}

/** A cheap guess at what a side does when nobody has searched its choice: a plain attack if it can make one. */
function guessOf(c: Battle, side: 0 | 1): Action {
  const ls = legal(c, side);
  return ls.find(a => a.k === 'attack' && !a.aim) || ls[0] || { k: 'guard' };
}

/** Plays `a` for `side` at the decision `c` waits on. In a joint round the other side plays `other`, or its guess. */
function step(c: Battle, side: 0 | 1, a: Action, other?: Action): void {
  if (c.need?.kind === 'joint') {
    const o = other || guessOf(c, (1 - side) as 0 | 1);
    if (side === 0) actJoint(c, a, o); else actJoint(c, o, a);
  } else act(c, a);
}

function score1(b: Battle, side: 0 | 1, a: Action): number {
  const c = clone(b);
  step(c, side, a);
  settle(c);
  return evaluate(c, side);
}

/** Both sides' choices for a joint round resolved on a copy, through to the next decision, judged for `side`. */
function pairValue(b: Battle, side: 0 | 1, mine: Action, theirs: Action): { v: number; c: Battle } {
  const c = clone(b);
  if (side === 0) actJoint(c, mine, theirs); else actJoint(c, theirs, mine);
  settle(c);
  return { v: measuredWorth(c, side) ?? evaluate(c, side), c };
}

/** A round paused for a measured choice, judged with that choice made well: the best for the measurer, the worst for its foe. */
function measuredWorth(c: Battle, side: 0 | 1): number | null {
  if (c.need?.kind !== 'act' || c.waited !== c.need.side) return null;
  if (c.need.side === side) return followUp(c, side);
  let worst = Infinity;
  for (const r of legal(c, c.need.side)) {
    const c2 = clone(c);
    act(c2, r);
    settle(c2);
    worst = Math.min(worst, evaluate(c2, side));
  }
  return worst === Infinity ? evaluate(c, side) : worst;
}

/** A side's choices at a decision, best first by one step against the other side's guess, at most k of them. */
function ranked(b: Battle, side: 0 | 1, k: number): { a: Action; v: number }[] {
  return legal(b, side).map(a => ({ a, v: score1(b, side, a) })).sort((x, z) => z.v - x.v).slice(0, k);
}

/** A joint round's worth to `side`, searched shallowly: the best of its few best choices against the worst of the foe's few best. */
function jointWorth(c: Battle, side: 0 | 1): number {
  const other = (1 - side) as 0 | 1;
  const mine = ranked(c, side, 3), theirs = ranked(c, other, 3);
  let best = -Infinity;
  for (const m of mine) {
    let worst = Infinity;
    for (const t of theirs) worst = Math.min(worst, pairValue(c, side, m.a, t.a).v);
    best = Math.max(best, worst);
  }
  return best === -Infinity ? evaluate(c, side) : best;
}

/** The side's best result from one more solo action of its own, with time run on to the next decision. */
function followUp(c: Battle, side: 0 | 1): number {
  let best = -Infinity;
  for (const r of legal(c, side)) {
    const c2 = clone(c);
    act(c2, r);
    settle(c2);
    best = Math.max(best, evaluate(c2, side));
  }
  return best;
}

/** What comes after a board for `side`: its own follow-up, the foe's worst reply, or a joint round searched shallowly. */
function afterwards(c: Battle, side: 0 | 1): number {
  const d = advance(c, chooseReplacement);
  if (d.kind === 'over' || d.kind === 'replace') return evaluate(c, side);
  if (d.kind === 'joint') return jointWorth(c, side);
  if (d.side === side) return followUp(c, side);
  let worst = Infinity;
  for (const r of legal(c, d.side)) {
    const c2 = clone(c);
    act(c2, r);
    settle(c2);
    worst = Math.min(worst, evaluate(c2, side));
  }
  return worst;
}

/** A solo action judged by what the foe can do about it and what comes after. */
function score2(b: Battle, side: 0 | 1, a: Action): number {
  const c = clone(b);
  act(c, a);
  return afterwards(c, side);
}

/** How many of the best first-look candidates the keeper and champion AI search deeper. 0 turns it off. */
export let DEEP_TOP = 4;
export function setDeepTop(n: number): void { DEEP_TOP = n; }

/** The AI's last decision: who made it, in which round, and its best few actions with their scores, best first, for practice's debug menu. */
export const lastChoice: { side: 0 | 1; who: string; round: number; top: { label: string; v: number }[] } = { side: 1, who: '', round: 0, top: [] };

/**
 * The battle as `side` believes it: a disguised foe really has the moves, habits, and types it shows. The AI plans in
 * this copy, so a disguise fools it the way it fools a player. Without a disguise in play, it is the battle itself.
 */
function believed(b: Battle, side: 0 | 1): Battle {
  if (!b.s[1 - side].f.some(f => f.disguise || f.mirage)) return b;
  const c = clone(b);
  for (const f of c.s[1 - side].f) {
    // A mirage shows the other side more HP than its holder has, so the plan is made against the HP shown.
    if (f.mirage) { f.hp = shownHp(f); f.mirage = null; }
    const d = f.disguise;
    if (!d) continue;
    const moves = d.moves || f.moves;
    f.form = null;
    f.mon = { ...f.mon, moves: moves.slice(), passives: d.passives.slice(), types: d.types.slice() };
    f.moves = moves.slice();
    f.cd = f.moves.map(() => 0);
  }
  return c;
}

/** Spread of the foe's replies by how good each looks to the foe: a small number makes the AI expect the foe's best. */
const REPLY_TEMP = 0.12;

/** e to the x for x at or below 0 from plain arithmetic: Still Minute's rewind runs the AI inside online battles, and browsers may round Math.exp differently. */
function expBelow(x: number): number {
  if (!(x > -40)) return 0;
  let r = x, k = 0;
  while (r < -1 / 1024) { r /= 2; k++; }
  let s = 1 + r * (1 + (r / 2) * (1 + (r / 3) * (1 + (r / 4) * (1 + (r / 5) * (1 + r / 6)))));
  for (; k > 0; k--) s *= s;
  return s;
}

/**
 * Scores every choice for a joint round, where the foe chooses at the same time. Each choice first meets the foe's guess,
 * and the foe's choices meet ours. The best few of ours then meet the foe's likeliest few on copies of the round. A choice
 * scores a mix of its worst case and its expected case, with the foe's replies weighted by how good they look to the foe.
 */
function jointScores(b: Battle, side: 0 | 1, level: string): { a: Action; v: number }[] {
  const other = (1 - side) as 0 | 1;
  const myGuess = guessOf(b, side), theirGuess = guessOf(b, other);
  const theirs = legal(b, other).map(r => ({ a: r, v: pairValue(b, other, r, myGuess).v })).sort((x, z) => z.v - x.v);
  // Its own first look meets the foe's likeliest reply when foeBest is on, which ranks guards and counters more fairly.
  const against = OPTS.foeBest && theirs.length ? theirs[0].a : theirGuess;
  const mine = legal(b, side).map(a => ({ a, v: pairValue(b, side, a, against).v - (a.k === 'switch' ? switchCost() : 0) })).sort((x, z) => z.v - x.v);
  const loose = level === 'wild' || level === 'trainer';
  const rows = mine.slice(0, loose ? 4 : 5);
  // A guard is the answer to a big hit the first look cannot see coming, so it always gets a row.
  const guard = mine.find(x => x.a.k === 'guard');
  if (guard && !rows.includes(guard)) rows.push(guard);
  const cols = theirs.slice(0, loose ? 2 : 4);
  const top = Math.max(...cols.map(x => x.v));
  const w = cols.map(x => expBelow((x.v - top) / REPLY_TEMP));
  const wsum = w.reduce((n, x) => n + x, 0) || 1;
  const lean = level === 'champion' ? 0.55 : level === 'keeper' ? 0.45 : 0.25;
  const scoreRow = (cells: number[]) => lean * Math.min(...cells) + (1 - lean) * cells.reduce((n, v, j) => n + v * w[j], 0) / wsum;
  const table = rows.map(r => {
    const cells = cols.map(col => pairValue(b, side, r.a, col.a));
    return { a: r.a, cells, v: scoreRow(cells.map(x => x.v)) - (r.a.k === 'switch' ? switchCost() : 0) };
  }).sort((x, z) => z.v - x.v);
  // Keepers and champions look one action further on the two best rows.
  if (!loose && DEEP_TOP > 0) {
    for (const row of table.slice(0, Math.min(2, DEEP_TOP))) {
      row.v = scoreRow(row.cells.map(x => (OPTS.twoRound ? afterwards(x.c, side) : afterwardsLite(x.c, side)))) - (row.a.k === 'switch' ? switchCost() : 0);
    }
    table.sort((x, z) => z.v - x.v);
  }
  const floor = table.length ? table[table.length - 1].v : 0;
  const rest = mine.filter(x => !table.some(t => t.a === x.a)).map(x => ({ a: x.a, v: Math.min(x.v, floor) - 0.001 }));
  return [...table.map(t => ({ a: t.a, v: t.v })), ...rest];
}

/** One more step on a resolved round: its own follow-up when it moves alone next, otherwise the board as it stands. */
function afterwardsLite(c: Battle, side: 0 | 1): number {
  if (c.need?.kind === 'act' && c.need.side === side) return followUp(c, side);
  return evaluate(c, side);
}

/** The AI's pick for `side`. In a solo turn the side is the one acting. In a joint round pass the side, or side 1 is assumed. */
export function choose(real: Battle, sideArg?: 0 | 1): Action {
  if (real.need?.kind !== 'act' && real.need?.kind !== 'joint') throw new Error('the AI was asked to choose with no turn waiting');
  const side0: 0 | 1 = sideArg ?? (real.need.kind === 'act' ? real.need.side : 1);
  const before = OPTS;
  OPTS = SIDE_OPTS[side0] || AI_DEFAULT;
  try { return chooseFor(real, side0); } finally { OPTS = before; }
}

function chooseFor(real: Battle, sideArg: 0 | 1): Action {
  const joint = real.need?.kind === 'joint';
  const side: 0 | 1 = sideArg ?? (real.need?.kind === 'act' ? real.need.side : 1);
  const b = believed(real, side);
  const level = b.s[side].ai;
  const deep = level === 'keeper' || level === 'champion';
  let scored: { a: Action; v: number }[];
  if (joint) scored = jointScores(b, side, level);
  else {
    scored = legal(b, side).map(a => ({ a, v: score1(b, side, a) - (a.k === 'switch' ? switchCost() : 0) }));
    scored.sort((x, z) => z.v - x.v);
    // The strongest few get a deeper look: the foe's answer, or the joint round that follows. They stay above the rest.
    if (deep && DEEP_TOP > 0 && scored.length > 1) {
      const top = scored.slice(0, DEEP_TOP).map(x => ({ a: x.a, v: score2(b, side, x.a) - (x.a.k === 'switch' ? switchCost() : 0) }));
      top.sort((x, z) => z.v - x.v);
      const floor = top[top.length - 1].v;
      scored.splice(0, top.length, ...top);
      for (let i = top.length; i < scored.length; i++) scored[i].v = Math.min(scored[i].v, floor - 0.001);
    }
  }
  if (!b.quiet) Object.assign(lastChoice, { side, who: out(b, side).mon.name, round: roundOf(b), top: scored.slice(0, 6).map(x => ({ label: describeAction(b, side, x.a), v: x.v })) });
  aiStats.decisions++;
  aiStats.options += scored.filter(x => x.v >= scored[0].v - 0.15).length;
  aiStats.legal += scored.length;
  if (!scored.length) return { k: 'guard' };
  if (level === 'wild') {
    // Wild whorls fight on instinct: about half their actions are any attack or move they could use, chosen at random.
    const r = rng(real);
    const pool = scored.filter(x => x.a.k === 'attack' || x.a.k === 'move');
    if (pool.length > 1 && r < 0.5) return pool[Math.floor(rng(real) * pool.length)].a;
    if (scored.length > 1 && r < 0.65) return scored[1].a;
  } else if (level === 'trainer') {
    const r = rng(real);
    if (scored.length > 1 && r < 0.15 && scored[1].v > scored[0].v - 0.3) return scored[1].a;
  } else if (joint) {
    // In a joint round a keeper is hard to read: it picks among its choices that score almost the same.
    const near = scored.filter(x => x.v >= scored[0].v - 0.03);
    if (near.length > 1) return near[Math.floor(rng(real) * near.length)].a;
  }
  return scored[0].a;
}

/** Makes the decision the battle waits on with the AI on both sides: a solo turn or a joint round. Returns what each side chose. */
/** The best reply for `side` in a joint round when it already knows the foe's choice: each legal action played out against it. */
export function answer(b: Battle, side: 0 | 1, theirs: Action): Action {
  let best: Action = { k: 'attack' }, v = -Infinity;
  for (const a of legal(b, side)) {
    const w = pairValue(b, side, a, theirs).v - (a.k === 'switch' ? switchCost() : 0);
    if (w > v) { v = w; best = a; }
  }
  return best;
}

/**
 * The visitor's choice when Still Minute goes back: each choice is cast on a copy of the past, and the board after it is
 * judged for `side`. The rounds that play again afterwards are not searched.
 */
export function chooseVisit(b: Battle, side: 0 | 1): Action {
  const picks = visitChoices(b);
  let best = picks[0] ?? { k: 'wait' }, bv = -Infinity;
  if (picks.length < 2) return best;
  for (const a of picks) {
    const c = clone(b);
    visitCast(c, a);
    const v = evaluate(c, side);
    if (v > bv) { bv = v; best = a; }
  }
  return best;
}

/** The best of `picks` for f to cast now at `power`, judged on a copy by the board after each. */
function pickCast(b: Battle, f: Fighter, picks: Action[], power: number): Action {
  let best = picks[0], bv = -Infinity;
  for (const a of picks) {
    if (a.k !== 'move') continue;
    const c = clone(b), cf = c.s[f.side].f[f.idx];
    const aim = c.aim;
    c.aim = a.aim ? { side: f.side, uid: a.aim } : null;
    castMove(c, cf, cf.moves[a.i], power, { target: a.target, opt: a.opt });
    c.aim = aim;
    const v = evaluate(c, f.side);
    if (v > bv) { bv = v; best = a; }
  }
  return best;
}

export function aiTurn(b: Battle): { side: 0 | 1; a: Action }[] {
  const d = b.need;
  // The visitor's cast is no action of the out whorl's, so it is not reported.
  if (d?.kind === 'visit') { visit(b, chooseVisit(b, d.side)); return []; }
  if (d?.kind === 'act') { const a = choose(b); act(b, a); return [{ side: d.side, a }]; }
  if (d?.kind === 'joint') {
    // A side that foresees chooses after seeing the other side's choice.
    const sees0 = foresees(b, 0), sees1 = foresees(b, 1);
    const a1 = sees0 ? choose(b, 1) : sees1 ? null : choose(b, 1);
    const a0 = sees0 ? answer(b, 0, a1!) : choose(b, 0);
    const b1 = a1 ?? answer(b, 1, a0);
    actJoint(b, a0, b1);
    return [{ side: 0, a: a0 }, { side: 1, a: b1 }];
  }
  return [];
}

export function describeAction(b: Battle, side: 0 | 1, a: Action): string {
  const f = out(b, side);
  if (a.k === 'attack') return 'Attack';
  if (a.k === 'guard') return 'Guard';
  if (a.k === 'wait') return 'Measure';
  if (a.k === 'switch') return `Switch to ${b.s[side].f[a.to].mon.name}`;
  if (a.k === 'take') { const d = b.drops?.find(x => x.uid === a.i); return `Take ${(d && DROPS[d.id]?.name) || 'it'}`; }
  if (a.k === 'move') {
    const m = moveDef(f, a.i);
    const opt = m?.options && a.opt !== undefined && a.opt >= 0 ? m.options(b, f)[a.opt] : '';
    return (m?.name || '?') + (opt ? `: ${opt}` : '');
  }
  return a.k;
}

// The rewind asks the AI for a turn its record does not hold and a recorded choice with no move or Attack left to stand in for
// it. Cached probe values depend on earlier calls, so each ask in a battle both clients play starts from empty caches and both
// get the same answer.
export const PAST_AI: Parameters<typeof setPastAi>[0] & object = {
  choose: (b, side) => { resetAiCaches(); return choose(b, side); },
  replace: chooseReplacement,
  pick: (b, f, picks, power, fresh) => { if (fresh) resetAiCaches(); return pickCast(b, f, picks, power); },
};
setPastAi(PAST_AI);
