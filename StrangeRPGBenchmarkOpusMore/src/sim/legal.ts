import type { Battle } from '../battle/engine';
import { Action, Target, Unit, VERBS } from '../battle/types';
import type { Rng } from '../core/rng';
import { duoFor } from '../data/duos';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';

export type Choice = Action | { t: 'rewind' };
export const keyOf = (a: Choice): string => JSON.stringify(a);

// Mirrors the readiness test in Battle.answer.
export function ready(b: Battle, f: Unit): boolean {
  const d = ENEMIES[f.id];
  if (!d || d.noAnswer || !f.alive) return false;
  if (d.needItem && !(b.inv[d.needItem] > 0)) return false;
  const need = d.askNeed ?? 'none';
  return need === 'none' || (need === 'listened' && !!f.listened) || (need === 'low' && f.hp <= f.mhp * 0.5)
    || (need === 'alone' && b.foes().length === 1) || (need === 'late' && (f.turns ?? 0) >= 2);
}

// Area targets collapse to one entry because the engine ignores the target for them.
export function targets(b: Battle, a: Unit, tgt: Target): number[] {
  const foes = b.foes().map((u) => u.uid);
  const allies = b.party().map((u) => u.uid);
  switch (tgt) {
    case 'foe': return foes;
    case 'foes': case 'any': return foes.slice(0, 1);
    case 'ally': return allies;
    case 'allies': return allies.slice(0, 1);
    case 'self': return [a.uid];
    case 'other': return allies.filter((u) => u !== a.uid);
    case 'dead': return b.partyAll().filter((u) => !u.alive && !u.gone).map((u) => u.uid);
  }
}

// Actions for one head of a unit. Run is never listed because no policy flees.
export function single(b: Battle, a: Unit, kept: string[], second = false): Action[] {
  const out: Action[] = [];
  const add = (ts: number[], f: (t: number) => Action) => { for (const t of ts) out.push(f(t)); };
  add(targets(b, a, 'foe'), (target) => ({ t: 'attack', target }));
  for (const id of second ? a.skills2 ?? [] : a.skills) {
    const sk = SKILLS[id];
    if (!sk || !b.canUse(a, sk)) continue;
    if (id === 'evacuate') {
      for (const o of b.party()) for (const n of b.bench().filter((x) => x.alive)) out.push({ t: 'swap', out: o.uid, inn: n.uid });
      continue;
    }
    add(targets(b, a, sk.tgt), (target) => ({ t: 'skill', skill: id, target }));
  }
  for (const [id, n] of Object.entries(b.inv)) {
    const it = ITEMS[id];
    if (it?.battle && n > 0) add(targets(b, a, it.tgt ?? 'ally'), (target) => ({ t: 'item', item: id, target }));
  }
  if (!b.has(a, 'lastword')) out.push({ t: 'guard' });
  if (b.mech.has('answer')) {
    for (const f of b.foes()) for (const verb of VERBS) if (verb !== 'remember' || ENEMIES[f.id]?.ask === 'remember') out.push({ t: 'answer', verb, target: f.uid });
  }
  if (a.twin) return out;
  const p = b.linePartner(a);
  if (p) {
    const tech = duoFor(a.id, p.id);
    const cost = tech.cost ?? 0;
    if (a.vp >= cost && p.vp >= cost) add(targets(b, a, tech.tgt), (target) => ({ t: 'line', partner: p.uid, tech: tech.id, target }));
  }
  if (a.id === 'hello' && b.mech.has('call') && !b.callUsed && a.vp >= 6) {
    for (const k of kept) {
      const sk = SKILLS[ENEMIES[k]?.kept?.skill ?? ''];
      if (sk) add(targets(b, a, ['ally', 'other', 'allies', 'self'].includes(sk.tgt) ? 'ally' : 'foe'), (target) => ({ t: 'call', kept: k, target }));
    }
  }
  if (a.id === 'someone' && b.mech.has('mask')) {
    for (const k of kept) if (ENEMIES[k]?.kept?.skill && a.mask !== k) out.push({ t: 'mask', kept: k });
  }
  return out;
}

// Pairs one action per head for a twin unit, sampling when the product is large.
export function pairs(first: Action[], second: Action[], rng: Rng, cap = 40): Action[] {
  const out: Action[] = [];
  for (const x of first) for (const y of second) out.push({ t: 'twin', a: x, b: y });
  return out.length > cap ? rng.shuffle(out).slice(0, cap) : out;
}

export function legal(b: Battle, a: Unit, kept: string[], rng: Rng): Action[] {
  return a.twin ? pairs(single(b, a, kept), single(b, a, kept, true), rng) : single(b, a, kept);
}
