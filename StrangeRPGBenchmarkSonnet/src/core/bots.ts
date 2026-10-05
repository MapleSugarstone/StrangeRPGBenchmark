import { CHAR } from '../data/characters';
import { ITEMS } from '../data/items';
import { skill } from '../data/skills';
import type { Skill } from '../data/types';
import type { Fx, Status } from '../data/types';
import type { Action, Battle, Unit } from './battle';
import { Rng } from './rng';

export type Policy = 'mash' | 'smart' | 'random' | 'casual';

export function chooseAction(b: Battle, policy: Policy, rng: Rng): Action {
  const legal = b.legal();
  const attacks = legal.filter((a) => a.k === 'attack') as Extract<Action, { k: 'attack' }>[];
  if (policy === 'mash') {
    const weakest = attacks.sort((x, y) => b.units[x.t].hp - b.units[y.t].hp)[0];
    return weakest ?? legal[0];
  }
  if (policy === 'casual') return casual(b, legal, rng);
  if (policy === 'random') {
    const pool = legal.filter((a) => a.k !== 'flee' && a.k !== 'stance' && a.k !== 'rewind' && a.k !== 'pact');
    return rng.pick(pool);
  }
  return smart(b, legal, rng);
}

const FOE_STATUS_VALUE: Partial<Record<Status, number>> = { sleep: 0.3, stun: 0.3, hex: 0.32, weak: 0.32, chill: 0.14, burn: 0.16, shock: 0.12 };

function fxValue(b: Battle, u: Unit, fx: Fx[], targets: Unit[], cost: number): number {
  let v = 0;
  const foe = targets[0]?.side !== u.side;
  const anyQueued = b.livingFoes().some((f) => f.queued);
  const ref = 2.5 * (b.party.reduce((a, x) => a + x.maxHp, 0) / b.party.length);
  for (const t of targets) {
    if (t.hp <= 0 && !fx.some((f) => f.k === 'revive')) continue;
    const missing = (t.maxHp - t.hp) / t.maxHp;
    let dealt = 0;
    for (const f of fx) {
      switch (f.k) {
        case 'dmg': {
          const d = Math.min(t.hp, b.estimate(u, t, f));
          dealt += d;
          v += d / Math.min(t.maxHp, ref) + (d >= t.hp ? 0.35 : 0);
          if (f.e && (t.aff[f.e] ?? 1) > 1) v += 0.12;
          if (f.e && b.has('reaction') && t.mark && t.mark.e !== f.e) v += 0.1;
          break;
        }
        case 'dmgFlat': { const d = Math.min(t.hp, f.n * (t.aff[f.e ?? 'ember'] ?? 1)); v += d / t.maxHp + (d >= t.hp ? 0.3 : 0); break; }
        case 'heal': { const a = Math.min(t.maxHp - t.hp, f.p * 2 * b.stat(u, 'mag')); v += (a / t.maxHp) * (1 + 2 * missing); break; }
        case 'healFlat': { const a = Math.min(t.maxHp - t.hp, f.n); v += (a / t.maxHp) * (1 + 2 * missing); break; }
        case 'healPct': { const a = Math.min(t.maxHp - t.hp, t.maxHp * f.p); v += (a / t.maxHp) * (1 + 2 * missing); break; }
        case 'mpFlat': v += Math.min(t.maxMp - t.mp, f.n) / Math.max(1, t.maxMp) * 0.35; break;
        case 'revive': if (t.hp <= 0) v += 0.9 + f.p * 0.3; break;
        case 'cleanse': v += Object.keys(t.status).filter((k) => ['burn', 'chill', 'shock', 'sleep', 'hex', 'weak', 'stun'].includes(k)).length * 0.18; break;
        case 'status': {
          const ch = f.chance ?? 1;
          if (foe) {
            let w = FOE_STATUS_VALUE[f.st] ?? 0;
            if (t.status[f.st]) w *= 0.15;
            if (t.boss && (f.st === 'sleep' || f.st === 'stun')) w *= 0.35;
            if (f.st === 'hex' || f.st === 'weak') w *= t.boss ? 1.6 : 1;
            v += w * ch;
          } else if (!t.status[f.st]) {
            const w: Partial<Record<Status, number>> = { ward: anyQueued ? 0.2 : b.boss ? 0.12 : 0.05, haste: 0.1, regen: 0.02 + missing * 0.25, focus: 0.05, taunt: 0.04 };
            v += (w[f.st] ?? 0) * ch;
          }
          break;
        }
        case 'delay': v += 0.18 * f.p * (t.boss ? 0.5 : 1) * (t.hp / t.maxHp > 0.3 ? 1 : 0.3); break;
        case 'quicken': v += 0.16 * f.p; break;
        case 'nerve': v += 0.05 * f.n / 25; break;
        case 'drain': v += (dealt * f.p) / u.maxHp * (1 + 2 * (1 - u.hp / u.maxHp)); break;
        case 'dispense': v += 0.2 + missing * 0.3; break;
        case 'end': if (b.duskable(t)) v += 0.6; break;
        case 'selfHp': v -= f.p * (1 + (u.hp / u.maxHp < 0.5 ? 2 : 0)); break;
      }
    }
  }
  return v - cost;
}

function mpPenalty(b: Battle, u: Unit, mp: number): number {
  if (!u.maxMp) return 0;
  const scarcity = b.boss ? 0.25 : 0.55;
  return scarcity * (mp / u.maxMp) * (u.mp / u.maxMp < 0.4 ? 1.8 : 1);
}

function smart(b: Battle, legal: Action[], rng: Rng): Action {
  const u = b.actor!;
  // Stance once per fight start per unit.
  const stanceWant = CHAR[u.id]?.stance;
  if (b.has('stance') && u.turns === 0 && stanceWant && u.stance !== stanceWant) {
    const a = legal.find((x) => x.k === 'stance' && x.st === stanceWant);
    if (a) return a;
  }
  const partyFrac = b.livingParty().reduce((a, x) => a + x.hp, 0) / b.party.reduce((a, x) => a + x.maxHp, 0);
  const koRecent = b.party.some((x) => x.hp <= 0 && !x.gasp) && b.history.length >= 2;
  const anyQueued = b.livingFoes().some((f) => f.queued);

  const isHeal = (s: Skill) => s.fx.some((f) => f.k === 'heal' || f.k === 'healPct' || f.k === 'revive');
  const healCosts = u.skills.map((id) => skill(id)).filter(isHeal).map((s) => b.mpCost(u, s));
  const healReserve = healCosts.length && !u.gasp ? 2 * Math.min(...healCosts) : 0;
  let best: Action | null = null;
  let bestV = -1e9;
  for (const a of legal) {
    let v = 0;
    const tgt = (id?: number) => (id === undefined ? undefined : b.units[id]);
    switch (a.k) {
      case 'attack': v = fxValue(b, u, [{ k: 'dmg', s: 'atk', p: 1.0 }], [b.units[a.t]], 0); break;
      case 'skill': {
        const s = skill(a.id);
        const t = tgt(a.t);
        const targets = s.tgt === 'foes' ? b.livingFoes() : s.tgt === 'allies' ? b.livingParty() : s.tgt === 'self' ? [u] : t ? [t] : [];
        v = fxValue(b, u, s.fx, targets, mpPenalty(b, u, b.mpCost(u, s)));
        if (healReserve > 0 && !isHeal(s) && u.mp - b.mpCost(u, s) < healReserve) v -= 0.5;
        if (s.tgt === 'foe' && t && b.has('weakness') && s.fx.some((f) => f.k === 'dmg' && f.e && (t.aff[f.e] ?? 1) > 1)) v += 0.08;
        break;
      }
      case 'limit': {
        const s = skill(u.limit!);
        const t = tgt(a.t);
        const targets = s.tgt === 'foes' ? b.livingFoes() : s.tgt === 'allies' ? b.livingParty() : t ? [t] : [];
        v = fxValue(b, u, s.fx, targets, 0) * 1.05 + (b.boss || partyFrac < 0.5 ? 0.15 : 0);
        break;
      }
      case 'item': {
        const it = ITEMS[a.id];
        const t = tgt(a.t);
        const targets = it.tgt === 'foes' ? b.livingFoes() : t ? [t] : [];
        let iv = fxValue(b, u, it.fx, targets, 0.1 + (it.tier >= 6 ? 0.05 : 0));
        if (it.fx.some((f) => f.k === 'healFlat') && t && t.hp / t.maxHp > 0.5) iv -= 1;
        v = iv;
        break;
      }
      case 'guard': {
        v = 0.02;
        if (anyQueued) v += u.row === 0 || !b.has('rows') ? 0.35 : 0.2;
        if (u.hp / u.maxHp < 0.3) v += 0.25;
        break;
      }
      case 'ascend': v = b.boss ? 0.9 : 0.2; break;
      case 'pact': v = b.boss && u.hp / u.maxHp > 0.7 && partyFrac > 0.6 ? 0.45 : -1; break;
      case 'rewind': v = koRecent || partyFrac < 0.25 ? 0.95 : -2; break;
      case 'dusk': v = 1.6; break;
      case 'stance': v = -5; break;
      case 'flee': v = -10; break;
    }
    if (u.gasp) v += 0;
    v += rng.range(0, 0.03);
    if (v > bestV) { bestV = v; best = a; }
  }
  return best ?? legal[0];
}

/** Runs a battle to completion with a policy. Returns the battle. */
export function runBattle(b: Battle, policy: Policy, rng: Rng, maxSteps = 600): Battle {
  let steps = 0;
  while (!b.over && steps++ < maxSteps) {
    const a = chooseAction(b, policy, rng);
    b.act(a);
  }
  if (!b.over) b.over = 'lose';
  return b;
}

/** A relaxed human: heals when someone is low, otherwise mostly casts damaging skills at the weakest foe. */
function casual(b: Battle, legal: Action[], rng: Rng): Action {
  const u = b.actor!;
  const foes = b.livingFoes().sort((x, y) => x.hp - y.hp);
  const low = b.livingParty().filter((x) => x.hp / x.maxHp < 0.35).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  const isHeal = (id: string) => skill(id).fx.some((f) => f.k === 'heal' || f.k === 'healPct');
  if (low) {
    const h = legal.find((a) => a.k === 'skill' && isHeal(a.id) && (a.t === low.uid || a.t === undefined));
    if (h) return h;
    const p = legal.find((a) => a.k === 'item' && ITEMS[a.id].fx.some((f) => f.k === 'healFlat') && a.t === low.uid);
    if (p && rng.chance(0.8)) return p;
  }
  const fallen = legal.find((a) => (a.k === 'skill' && skill(a.id).fx.some((f) => f.k === 'revive')) || (a.k === 'item' && ITEMS[a.id].fx.some((f) => f.k === 'revive')));
  if (fallen && rng.chance(0.7)) return fallen;
  const lim = legal.find((a) => a.k === 'limit' && (a.t === undefined || a.t === foes[0]?.uid));
  if (lim) return lim;
  const dmg = legal.filter((a) => a.k === 'skill' && skill(a.id).fx.some((f) => f.k === 'dmg') && (a.t === undefined || a.t === foes[0]?.uid));
  if (dmg.length && rng.chance(0.75)) return rng.pick(dmg);
  const sup = legal.filter((a) => a.k === 'skill' && !skill(a.id).fx.some((f) => f.k === 'dmg' || f.k === 'heal') && skill(a.id).tgt !== 'foe' && rng.chance(0.15));
  if (sup.length && u.mp > u.maxMp * 0.5) return rng.pick(sup);
  return legal.find((a) => a.k === 'attack' && a.t === foes[0]?.uid) ?? legal[0];
}
