import type { Battle } from '../battle/engine';
import { Action, STATUS, Unit } from '../battle/types';
import { Rng } from '../core/rng';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { Choice, keyOf, pairs, ready, single } from './legal';

export interface Snap { snap: string; uid: number; p: number; alive: number; kos: number; tried: Set<string>; }
export interface Ctx { kept: string[]; known: Set<string>; rng: Rng; snaps: Snap[]; avoid: Set<string>; }
export interface Policy { name: string; rate: number; choose(b: Battle, a: Unit, c: Ctx): Choice; }

type Eff = { heal?: number; healPct?: number; revive?: number; vp?: number; cure?: boolean; fx?: string; tgt?: string; power?: number };
const effOf = (x: Action): Eff | undefined => (x.t === 'skill' ? SKILLS[x.skill] : x.t === 'item' ? ITEMS[x.item] : undefined);
const tgtOf = (x: Action): number => (x as { target: number }).target;
const pct = (u: Unit) => (u.alive ? u.hp / u.mhp : 0);
const lowest = (b: Battle) => b.foes().reduce((m, f) => (f.hp < m.hp ? f : m));
const needy = (b: Battle, th: number) => b.partyAll().filter((u) => pct(u) < th).sort((x, y) => pct(x) - pct(y))[0];
// A player knows an enemy type's ask and weak spots after listening to one of that type, or if it is a kept prayer.
const known = (b: Battle, f: Unit, c: Ctx) =>
  c.known.has(f.id) || c.kept.includes(f.id) || b.units.some((u) => u.side === 1 && u.id === f.id && u.listened);

// Timing: mirrors which actions the battle scene turns into a ring (clean hit) or a brace window.
const physTarget = (x: Action): number | null => {
  if (x.t === 'attack' || x.t === 'line') return x.target;
  if (x.t === 'skill') return SKILLS[x.skill]?.kind === 'phys' && SKILLS[x.skill].tgt === 'foe' ? x.target : null;
  return x.t === 'twin' ? physTarget(x.a) ?? physTarget(x.b) : null;
};
export function cleanHit(b: Battle, x: Action, rate: number, rng: Rng): boolean {
  if (!b.mech.has('timed') || rate <= 0) return false;
  const t = physTarget(x);
  return t !== null && b.get(t)?.side === 1 && rng.chance(rate);
}
export function braceSet(b: Battle, x: Action, rate: number, rng: Rng): Set<number> | undefined {
  if (!b.mech.has('timed') || rate <= 0 || (x.t !== 'attack' && x.t !== 'skill')) return undefined;
  const sk = x.t === 'attack' ? SKILLS.attack : SKILLS[x.skill];
  const harmful = sk && (sk.power || sk.fx === 'drainvp' || sk.fx === 'returnto') && (sk.tgt === 'foe' || sk.tgt === 'foes');
  if (!harmful || !rng.chance(rate)) return undefined;
  return new Set(sk.tgt === 'foes' ? b.party().map((u) => u.uid) : [x.target]);
}

function heals(x: Action, n: Unit): boolean {
  const d = effOf(x);
  if (!d) return false;
  if (!n.alive) return !!d.revive && tgtOf(x) === n.uid;
  return !!(d.heal || d.healPct) && (d.tgt === 'allies' || (d.tgt === 'ally' && tgtOf(x) === n.uid));
}

// Applies one head-level chooser to both heads of a twin unit.
const perHead = (one: (b: Battle, a: Unit, c: Ctx, second: boolean) => Action) => (b: Battle, a: Unit, c: Ctx): Action =>
  (a.twin ? { t: 'twin', a: one(b, a, c, false), b: one(b, a, c, true) } : one(b, a, c, false));

const isDamaging = (id: string) => {
  const s = SKILLS[id];
  return !!s && (s.tgt === 'foe' || s.tgt === 'foes') && (!!s.power || ['fetch', 'gamble', 'yesterday', 'tomorrow'].includes(s.fx ?? ''));
};

export const casualAct = perHead((b, a, c, second) => {
  const L = single(b, a, c.kept, second);
  const foe = lowest(b);
  const atk: Action = { t: 'attack', target: foe.uid };
  const hurt = needy(b, 0.3);
  if (hurt && c.rng.chance(0.8)) {
    const h = L.filter((x) => heals(x, hurt));
    if (h.length) return c.rng.pick(h);
  }
  const calm = b.foes().find((f) => ENEMIES[f.id]?.mustAnswer && b.extra['calm' + f.uid] && ready(b, f));
  if (calm && b.mech.has('answer') && c.rng.chance(0.5)) return { t: 'answer', verb: ENEMIES[calm.id].ask, target: calm.uid };
  // A typical player tries the newest tools now and then.
  const line = L.find((x) => x.t === 'line');
  if (line && c.rng.chance(0.35)) return line;
  const calls = L.filter((x) => x.t === 'call');
  if (calls.length && c.rng.chance(0.3)) return c.rng.pick(calls);
  const masks = L.filter((x) => x.t === 'mask');
  if (masks.length && !a.mask && c.rng.chance(0.25)) return c.rng.pick(masks);
  const r = c.rng.next();
  if (r < 0.55) return atk;
  if (r < 0.8) {
    const d = L.filter((x) => x.t === 'skill' && isDamaging(x.skill) && (SKILLS[x.skill].tgt !== 'foe' || x.target === foe.uid));
    return d.length ? c.rng.pick(d) : atk;
  }
  if (r < 0.9 && b.mech.has('answer')) {
    const f = b.foes().find((x) => known(b, x, c) && ready(b, x));
    if (f) return { t: 'answer', verb: ENEMIES[f.id].ask, target: f.uid };
  }
  return c.rng.pick(L);
});

const casual: Policy = {
  name: 'casual', rate: 0.5,
  choose(b, a, c) {
    const prev = c.snaps[c.snaps.length - 2];
    if (b.mech.has('rewind') && b.rewinds > 0 && prev && b.party().length < prev.alive && c.rng.chance(0.5)) return { t: 'rewind' };
    return casualAct(b, a, c);
  },
};

const mash: Policy = {
  name: 'mash', rate: 0.3,
  choose: perHead((b, a, c, second) => {
    const hurt = needy(b, 0.25);
    const h = hurt ? single(b, a, c.kept, second).filter((x) => x.t === 'item' && heals(x, hurt)) : [];
    return h[0] ?? { t: 'attack', target: lowest(b).uid };
  }),
};

const attackOnly: Policy = { name: 'attack', rate: 0.8, choose: perHead((b) => ({ t: 'attack', target: lowest(b).uid })) };
const random: Policy = { name: 'random', rate: 0, choose: perHead((b, a, c, second) => c.rng.pick(single(b, a, c.kept, second))) };

// Drops moves that waste a turn so the lookahead only scores plausible choices.
function sensible(b: Battle, c: Ctx, acts: Action[]): Action[] {
  const hurt = (u?: Unit) => !!u && u.alive && u.hp < u.mhp * 0.8;
  return acts.filter((x) => {
    if (x.t === 'answer') {
      const f = b.get(x.target);
      const d = f && ENEMIES[f.id];
      return !!d && known(b, f, c) && x.verb === d.ask && ready(b, f);
    }
    const d = effOf(x);
    if (!d) return true;
    const t = b.get(tgtOf(x));
    if (d.fx === 'listen') return !!t && !t.listened && (!known(b, t, c) || (b.mech.has('answer') && ENEMIES[t.id]?.askNeed === 'listened'));
    if (d.revive) return true;
    if (d.heal || d.healPct) return d.tgt === 'allies' ? b.party().some(hurt) : hurt(t);
    if (d.vp) return !!t && t.vp < t.mvp * 0.5;
    if (d.cure) return !!t && t.status.some((s) => !STATUS[s.id].good && s.id !== 'tomorrow');
    return true;
  });
}

const measure = (b: Battle) => ({
  e: b.foes().reduce((s, u) => s + u.hp, 0), p: b.hpFrac(0), alive: b.party().length,
  danger: b.party().reduce((s, u) => s + Math.max(0, 0.35 - u.hp / u.mhp), 0),
  items: Object.values(b.inv).reduce((s, n) => s + n, 0), vp: b.party().reduce((s, u) => s + u.vp, 0),
});

// Plays enemies and the other party members (casual) until `me` acts again or 6 actions pass.
function playOut(b: Battle, me: number, c: Ctx, rate: number) {
  for (let n = 0, g = 0; !b.outcome && n < 6 && g < 40; g++) {
    const r = b.beginTurn();
    if (!r.actor) break;
    if (!r.canAct) continue;
    const x = r.actor;
    if (x.uid === me) break;
    if (x.side === 1) {
      const act = b.planEnemy(x);
      b.perform(x, act, { braced: braceSet(b, act, rate, c.rng) });
    } else {
      const act = casualAct(b, x, c);
      b.perform(x, act, { clean: cleanHit(b, act, rate, c.rng) });
    }
    n++;
  }
}

function lookahead(b: Battle, me: number, x: Action, c: Ctx, rate: number, etot: number): number {
  const snap = b.snapshot();
  b.rng.s = (c.rng.int(0x7fffffff) + 1) >>> 0;
  for (const f of b.foes()) if (!known(b, f, c)) { f.weak = []; f.resist = []; f.immune = []; }
  const m0 = measure(b);
  const n0 = b.answered.length;
  const listenTo = x.t === 'skill' && SKILLS[x.skill].fx === 'listen' ? b.get(x.target) : undefined;
  let s = listenTo ? (known(b, listenTo, c) ? 0.1 : 0.3) : 0;
  b.perform(b.get(me)!, x, { clean: cleanHit(b, x, rate, c.rng) });
  for (const id of b.answered.slice(n0)) s += ENEMIES[id]?.kept && !c.kept.includes(id) ? 0.8 : 0.1;
  playOut(b, me, c, rate);
  const m1 = measure(b);
  s += (m0.e - m1.e) / etot - 1.3 * (m0.p - m1.p) - 0.35 * Math.max(0, m0.alive - m1.alive) - m1.danger
    - 0.04 * (m0.items - m1.items) - 0.004 * (m0.vp - m1.vp);
  if (b.outcome === 'win') s += 2;
  if (b.outcome === 'lose') s -= 3;
  b.restore(snap);
  return s;
}

const smart: Policy = {
  name: 'smart', rate: 0.8,
  choose(b, a, c) {
    const prev = c.snaps[c.snaps.length - 2];
    if (b.mech.has('rewind') && b.rewinds > 0 && prev && (prev.p - b.hpFrac(0) > 0.35 || b.party().length < prev.alive)) return { t: 'rewind' };
    const heads = (second: boolean) => sensible(b, c, single(b, a, c.kept, second));
    let acts = a.twin ? pairs(heads(false), heads(true), c.rng) : heads(false);
    const fresh = acts.filter((x) => !c.avoid.has(keyOf(x)));
    if (fresh.length) acts = fresh;
    if (acts.length === 1) return acts[0];
    const etot = b.units.filter((u) => u.side === 1).reduce((s, u) => s + u.mhp, 0) || 1;
    const sc: Ctx = { ...c, rng: new Rng(c.rng.int(0x7fffffff) + 1), avoid: new Set() };
    const rolls = acts.length > 24 ? 1 : 2;
    let best = acts[0], top = -Infinity;
    for (const x of acts) {
      let s = 0;
      for (let i = 0; i < rolls; i++) s += lookahead(b, a.uid, x, sc, 0.8, etot);
      if (s > top) { top = s; best = x; }
    }
    return best;
  },
};

export const POLICIES: Record<string, Policy> = { smart, casual, mash, random, attack: attackOnly };
