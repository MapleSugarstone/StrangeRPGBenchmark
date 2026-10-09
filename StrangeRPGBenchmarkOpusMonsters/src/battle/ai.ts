import { act, advance, clone, doAttack, isOut, legal, moveDef, out, roundOf, runMove, seenTypes, sk, standing, typesOf } from './engine';
import type { Action, Battle, Fighter, Summon } from './model';
import { MARKS, MOVES, SUMMONS } from './registry';
import { typeMult } from '../data/types';

/** Counters for the balance report: how many actions were close to the best one. */
export const aiStats = { decisions: 0, options: 0, legal: 0 };

function fighterValue(f: Fighter): number {
  if (f.ko || f.gone) return 0;
  // An unspent revive is worth part of a slough, or the AI treats the killing blow as wasted.
  const spare = f.mon.notion === 'spareskin' && !f.k.spare ? 0.3 : 0;
  return 1 + 1.4 * (f.hp / f.maxHp) + 0.5 * Math.min(1, f.shield / f.maxHp) + spare;
}

/** How well `a` hits `d` with its own moves' types, minus the reverse. */
export function matchup(a: Fighter, d: Fighter): number {
  let best = 1;
  for (const id of a.moves) {
    const m = MOVES[id];
    if (!m) continue;
    best = Math.max(best, typeMult(m.type, seenTypes(d)) * (typesOf(a).includes(m.type) ? 1.2 : 1));
  }
  let worst = 1;
  for (const id of d.moves) {
    const m = MOVES[id];
    if (!m) continue;
    worst = Math.max(worst, typeMult(m.type, typesOf(a)) * (seenTypes(d).includes(m.type) ? 1.2 : 1));
  }
  return best - worst;
}

const BAD = { stun: 0.35, sleep: 0.3, silence: 0.12, root: 0.04, taunt: 0.08, slow: 0.05, expose: 0.06, weaken: 0.06, rot: 0.03, doom: 0.2 } as const;
const GOOD = { empower: 0.06, fortify: 0.06, haste: 0.05, unstop: 0.05, ward: 0.08, thorns: 0.03, regen: 0.05, invuln: 0.2, monument: 0.12 } as const;

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
  v += me.sum.reduce((n, u) => n + summonWorth(b, u), 0) - them.sum.reduce((n, u) => n + summonWorth(b, u), 0);
  const mo = out(b, side);
  const to = out(b, (1 - side) as 0 | 1);
  if (!mo.ko && !to.ko) v += 0.06 * matchup(mo, to);
  for (const [k, w] of Object.entries(BAD)) {
    if ((to.s as any)[k]) v += w * Math.min(2, (to.s as any)[k].n || 1);
    if ((mo.s as any)[k]) v -= w * Math.min(2, (mo.s as any)[k].n || 1);
  }
  for (const [k, w] of Object.entries(GOOD)) {
    if ((mo.s as any)[k]) v += w;
    if ((to.s as any)[k]) v -= w;
  }
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
  for (const f of [...me.f, ...them.f]) {
    if (f.ko || f.gone) continue;
    const sign = f.side === side ? 1 : -1;
    for (const id in f.m) v += sign * markWorth(b, f, id);
  }
  for (const p of b.pend) {
    if (p.kind !== 'windup') continue;
    const m = MOVES[p.move];
    const w = 0.15 + 0.06 * (m?.nerve || 0);
    v += p.side === side ? w : -w;
  }
  v += 0.04 * them.caps - 0.04 * me.caps;
  v += 0.0004 * Math.max(-100, Math.min(100, them.next - me.next));
  return v;
}

export function chooseReplacement(b: Battle, side: 0 | 1): number {
  const s = b.s[side];
  const foe = out(b, (1 - side) as 0 | 1);
  let best = -1, bv = -Infinity;
  for (const f of standing(s)) {
    if (f.idx === s.out && !f.ko) continue;
    const v = (foe && !foe.ko ? matchup(f, foe) : 0) + f.hp / f.maxHp;
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

function score1(b: Battle, side: 0 | 1, a: Action): number {
  const c = clone(b);
  act(c, a);
  settle(c);
  return evaluate(c, side);
}

/** The side's best result from one more action of its own, with time run on to the next decision after it. */
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

/**
 * Two of its own actions ahead: this action, the foe's three likeliest replies, then its best follow-up, with time run on
 * between them so summons, marks, and wind-ups that land a turn later count.
 */
function score3(b: Battle, side: 0 | 1, a: Action): number {
  const c = clone(b);
  act(c, a);
  const d = advance(c, chooseReplacement);
  if (d.kind !== 'act') return evaluate(c, side);
  if (d.side === side) return followUp(c, side);
  const replies = legal(c, d.side).map(r => { const c2 = clone(c); act(c2, r); return { c2, v: evaluate(c2, d.side) }; })
    .sort((x, z) => z.v - x.v).slice(0, 3);
  let worst = Infinity;
  for (const { c2 } of replies) {
    const d2 = advance(c2, chooseReplacement);
    worst = Math.min(worst, d2.kind === 'act' && d2.side === side ? followUp(c2, side) : evaluate(c2, side));
  }
  return worst;
}

function score2(b: Battle, side: 0 | 1, a: Action): number {
  const c = clone(b);
  act(c, a);
  const d = advance(c, chooseReplacement);
  if (d.kind !== 'act') return evaluate(c, side);
  // A quick move can give the same side the next action too: judge it by its best follow-up, not by the board it leaves.
  if (d.side === side) {
    let best = -Infinity;
    for (const r of legal(c, side)) {
      const c2 = clone(c);
      act(c2, r);
      settle(c2);
      best = Math.max(best, evaluate(c2, side));
    }
    return best;
  }
  let worst = Infinity;
  for (const r of legal(c, d.side)) {
    const c2 = clone(c);
    act(c2, r);
    settle(c2);
    worst = Math.min(worst, evaluate(c2, side));
  }
  return worst;
}

/** How many of the best two-ply candidates the keeper and champion AI search two of their own actions deep. 0 turns it off. */
export let DEEP_TOP = 4;
export function setDeepTop(n: number): void { DEEP_TOP = n; }

/** The AI's last decision: who made it, in which round, and its best few actions with their scores, best first, for practice's debug menu. */
export const lastChoice: { side: 0 | 1; who: string; round: number; top: { label: string; v: number }[] } = { side: 1, who: '', round: 0, top: [] };

/** The AI's pick for the side that must act now. */
/**
 * The battle as `side` believes it: a disguised foe really has the moves, habits, and types it shows. The AI plans in
 * this copy, so a disguise fools it the way it fools a player. Without a disguise in play, it is the battle itself.
 */
function believed(b: Battle, side: 0 | 1): Battle {
  if (!b.s[1 - side].f.some(f => f.disguise)) return b;
  const c = clone(b);
  for (const f of c.s[1 - side].f) {
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

export function choose(real: Battle): Action {
  const side = real.need!.kind === 'act' ? real.need!.side : 1;
  const b = believed(real, side);
  const level = b.s[side].ai;
  const acts = legal(b, side);
  const deep = level === 'keeper' || level === 'champion';
  const scored = acts.map(a => ({ a, v: (deep ? score2(b, side, a) : score1(b, side, a)) - (a.k === 'switch' ? 0.06 : 0) }));
  scored.sort((x, z) => z.v - x.v);
  // The strongest few get a deeper look, two of the side's own actions ahead. They stay above the rest.
  if (deep && DEEP_TOP > 0 && scored.length > 1) {
    const top = scored.slice(0, DEEP_TOP).map(x => ({ a: x.a, v: score3(b, side, x.a) - (x.a.k === 'switch' ? 0.06 : 0) }));
    top.sort((x, z) => z.v - x.v);
    const floor = top[top.length - 1].v;
    scored.splice(0, top.length, ...top);
    for (let i = top.length; i < scored.length; i++) scored[i].v = Math.min(scored[i].v, floor - 0.001);
  }
  if (!b.quiet) Object.assign(lastChoice, { side, who: out(b, side).mon.name, round: roundOf(b), top: scored.slice(0, 6).map(x => ({ label: describeAction(b, side, x.a), v: x.v })) });
  aiStats.decisions++;
  aiStats.options += scored.filter(x => x.v >= scored[0].v - 0.15).length;
  aiStats.legal += scored.length;
  if (level === 'wild') {
    // Wild whorls fight on instinct: about half their actions are any attack or move they could use, chosen at random.
    const r = rng(real);
    const pool = scored.filter(x => x.a.k === 'attack' || x.a.k === 'move');
    if (pool.length > 1 && r < 0.5) return pool[Math.floor(rng(real) * pool.length)].a;
    if (scored.length > 1 && r < 0.65) return scored[1].a;
  } else if (level === 'trainer') {
    const r = rng(real);
    if (scored.length > 1 && r < 0.15 && scored[1].v > scored[0].v - 0.3) return scored[1].a;
  }
  return scored[0].a;
}

export function describeAction(b: Battle, side: 0 | 1, a: Action): string {
  const f = out(b, side);
  if (a.k === 'attack') return 'Attack';
  if (a.k === 'guard') return 'Guard';
  if (a.k === 'switch') return `Switch to ${b.s[side].f[a.to].mon.name}`;
  if (a.k === 'move') return moveDef(f, a.i)?.name || '?';
  return a.k;
}
