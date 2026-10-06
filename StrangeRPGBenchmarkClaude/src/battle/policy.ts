import type { Action, Battle, Unit } from './engine';
import { SKILLS, SkillDef } from '../data/skills';
import { ITEMS } from '../data/items';
import { Hue, WHEEL, hueMult, opposite } from '../core/palette';

export type Policy = 'mash' | 'random' | 'smart' | 'casual';

interface Cand { a: Action; v: number; why: string }

/** Chooses an action for a party unit. The sim uses these to stand in for players of different skill. */
export function playerAction(b: Battle, u: Unit, p: Policy): Action {
  if (p === 'mash') {
    const t = lowestHpFoe(b);
    return { t: 'skill', skill: 'attack', target: t?.uid };
  }
  const cands = candidates(b, u);
  if (p === 'random') return b.rng.pick(cands).a;
  // A casual player plays well most of the time and picks something arbitrary about a third of the time.
  if (p === 'casual' && b.rng.chance(0.35)) return b.rng.pick(cands).a;
  let best = cands[0];
  for (const c of cands) if (c.v > best.v) best = c;
  return best.a;
}

export function explain(b: Battle, u: Unit): Cand[] {
  return candidates(b, u).sort((x, y) => y.v - x.v);
}

function lowestHpFoe(b: Battle): Unit | undefined {
  const foes = b.alive(1);
  return foes.sort((x, y) => x.hp - y.hp)[0];
}

function isBossFight(b: Battle): boolean {
  return b.enemies.some(e => e.boss);
}

function inkWeight(b: Battle, u: Unit, cost: number): number {
  if (!cost) return 0;
  const frac = u.ink / Math.max(1, u.maxInk);
  const boss = isBossFight(b);
  const base = boss ? 0.004 : 0.012;
  return cost * base * (frac < 0.3 ? 2.5 : 1);
}

function goldWeight(b: Battle, cost: number): number {
  if (!cost) return 0;
  return cost / Math.max(40, b.gold) * (isBossFight(b) ? 0.3 : 0.9);
}

function threat(b: Battle, t: Unit): number {
  const hpFrac = t.hp / t.maxHp;
  let w = 1;
  if (t.boss) w = 1.4;
  if (t.st.charge) w += 0.3;
  return w * (1.2 - hpFrac * 0.4);
}

function dmgValue(b: Battle, u: Unit, t: Unit, sk: SkillDef, pmul = 1, hue?: Hue): number {
  const e = b.expect(u, t, sk, pmul, hue);
  const dealt = Math.min(e.n, t.hp);
  let v = dealt / t.maxHp * threat(b, t);
  if (e.n >= t.hp) v += t.boss ? 1.5 : 0.35;
  if (b.mech.has('break') && t.maxShell > 0 && !t.broken) {
    const crack = (e.mult > 1 ? 1 : 0) + (sk.breakDmg ?? 0);
    if (crack > 0) v += crack >= t.shell ? 0.45 : 0.08 * crack;
  }
  return v;
}

function bestHueAgainst(b: Battle, t: Unit): Hue {
  let best: Hue = WHEEL[0];
  for (const h of WHEEL) if (hueMult(h, b.defHues(t)) > hueMult(best, b.defHues(t))) best = h;
  return best;
}

function mainFoe(b: Battle): Unit | undefined {
  const foes = b.alive(1);
  return foes.sort((x, y) => (y.boss ? 1 : 0) - (x.boss ? 1 : 0) || y.hp - x.hp)[0];
}

function candidates(b: Battle, u: Unit): Cand[] {
  const out: Cand[] = [];
  const foes = b.alive(1);
  const allies = b.alive(0);
  const dead = b.party.filter(x => !x.alive && !x.gone);
  const boss = isBossFight(b);
  const charging = foes.some(f => f.st.charge);
  const partyHurt = allies.reduce((s, a) => s + (1 - a.hp / a.maxHp), 0);

  const lockedOnMe = foes.some(f => f.mem.lockUid === u.uid) && !u.st.mirror;
  const aoeCharge = foes.some(f => f.st.charge && !f.mem.lockUid);
  out.push({ a: { t: 'guard' }, v: (lockedOnMe ? 0.95 : aoeCharge ? 0.55 : 0.02) + (u.ink < u.maxInk * 0.2 ? 0.05 : 0) + (u.hp < u.maxHp * 0.3 && charging ? 0.3 : 0), why: 'guard' });

  for (const id of u.skills) {
    if (!b.canUse(u, id)) continue;
    const sk = SKILLS[id];
    const cost = b.skillCost(u, sk);
    const pay = inkWeight(b, u, cost.ink) + goldWeight(b, cost.gold) + cost.tails * 0.2;
    const fx = sk.fx ?? '';

    if (fx === 'load') {
      const t = mainFoe(b);
      if (!t) continue;
      const h = bestHueAgainst(b, t);
      const now = hueMult(u.loaded, b.defHues(t));
      const gain = hueMult(h, b.defHues(t)) - now;
      out.push({ a: { t: 'skill', skill: id, hue: h }, v: gain > 0 ? 0.12 + gain * 0.35 : -1, why: 'load' });
      continue;
    }
    if (fx === 'tricolor') {
      if (u.extraHue) continue;
      const t = mainFoe(b);
      if (!t) continue;
      const h = bestHueAgainst(b, t);
      out.push({ a: { t: 'skill', skill: id, hue: h }, v: boss ? 0.7 : 0.1, why: 'tricolor' });
      continue;
    }
    if (fx === 'link') {
      const partner = allies.filter(a => a !== u).sort((x, y) => Math.max(y.str, y.mnd) - Math.max(x.str, x.mnd))[0];
      let v = 0;
      for (const f of foes) v += dmgValue(b, u, f, { ...sk, power: 1.15 }) + (partner ? dmgValue(b, partner, f, { ...sk, power: 1.15 }) : 0);
      out.push({ a: { t: 'skill', skill: id, partner: partner?.uid }, v, why: 'link' });
      continue;
    }
    if (fx === 'reflect') {
      const last = b.last ? SKILLS[b.last.skill] : null;
      if (!last) continue;
      let v = 0;
      if (last.kind === 'phys' || last.kind === 'mag') {
        const targets = last.target === 'foes' ? foes : foes.slice(0, 1);
        for (const f of targets) v += dmgValue(b, u, f, last, b.last!.side !== 0 ? 1.25 : 1);
      } else if (last.kind === 'heal') v = partyHurt * 0.3;
      out.push({ a: { t: 'skill', skill: id }, v: v - pay, why: 'reflect' });
      continue;
    }
    if (fx === 'jackpot') {
      let v = 0;
      for (const f of foes) v += dmgValue(b, u, f, { ...sk, power: 0.95 }, 1, 'N');
      out.push({ a: { t: 'skill', skill: id }, v: v - pay, why: 'jackpot' });
      continue;
    }

    if (sk.target === 'foe' || sk.target === 'foes' || sk.target === 'rand') {
      const targets = sk.target === 'foe' ? foes : [null];
      for (const t of targets) {
        let v = 0;
        const hitList = t ? [t] : foes;
        for (const f of hitList) {
          let pv = 0;
          if (sk.kind === 'phys' || sk.kind === 'mag' || (sk.kind === 'debuff' && sk.power)) {
            pv += sk.target === 'rand' ? dmgValue(b, u, f, sk) / Math.max(1, foes.length) : dmgValue(b, u, f, sk);
          }
          if (sk.status && !f.st[sk.status.id]) {
            const s = sk.status.id;
            const weight = s === 'stun' ? (f.boss ? 0 : 0.3) : s === 'static' ? 0.12 : s === 'grey' ? (resistsParty(b, f) ? 0.3 : 0.02) : 0.05;
            pv += weight * sk.status.chance;
          }
          if (sk.stage && sk.stage.d < 0 && f.stg[sk.stage.stat] > -2) pv += (boss && f.boss ? 0.22 : 0.04);
          if (sk.push) pv += f.st.charge ? 0.5 : boss && f.boss ? 0.12 : 0.03;
          if (fx === 'paint') pv += paintValue(b, u, f);
          if (fx === 'wash') pv += (Object.values(f.stg).some(x => x > 0) ? 0.25 : 0) + (f.st.painted ? -0.2 : 0);
          if (fx === 'scan') pv += f.stg.def > -1 && boss ? 0.1 : 0.01;
          if (fx === 'buyout') pv += f.boss ? -1 : (b.gold > f.hp ? 0.4 : -1);
          v += pv;
        }
        out.push({ a: { t: 'skill', skill: id, target: t?.uid }, v: v - pay, why: `${id}>${t?.name ?? 'all'}` });
      }
      continue;
    }
    if (sk.kind === 'heal' || fx === 'rewind' || fx === 'restock') {
      if (sk.target === 'ko') {
        for (const d of dead) out.push({ a: { t: 'skill', skill: id, target: d.uid }, v: 1.2 - pay, why: 'revive' });
        continue;
      }
      if (fx === 'restock') {
        const inkNeed = allies.reduce((s, a) => s + (1 - a.ink / Math.max(1, a.maxInk)), 0);
        out.push({ a: { t: 'skill', skill: id }, v: inkNeed * 0.15 - pay, why: 'restock' });
        continue;
      }
      const targets = sk.target === 'allies' ? [null] : sk.target === 'self' ? [u] : allies;
      for (const t of targets) {
        const list = t ? [t] : allies;
        let v = 0;
        for (const a of list) {
          const missing = a.maxHp - a.hp;
          const amount = fx === 'rewind' ? Math.max(0, a.mark - a.hp) + b.eff(u, 'mnd') * 0.4 : b.eff(u, 'mnd') * (sk.power ?? 1) + 2;
          const eff = Math.min(missing, amount) / a.maxHp;
          const urgency = a.hp / a.maxHp < 0.35 ? 2.2 : a.hp / a.maxHp < 0.6 ? 1.2 : 0.4;
          v += eff * urgency;
          if (fx === 'cleanse') v += Object.keys(a.st).filter(s => ['static', 'stun', 'grey', 'hush'].includes(s)).length * 0.2;
        }
        out.push({ a: { t: 'skill', skill: id, target: t?.uid }, v: v - pay, why: `heal>${t?.name ?? 'all'}` });
      }
      continue;
    }
    if (sk.kind === 'buff' || sk.kind === 'util') {
      const targets = sk.target === 'ally' ? allies : [null];
      for (const t of targets) {
        const list = t ? [t] : sk.target === 'self' ? [u] : allies;
        let v = 0;
        for (const a of list) {
          if (sk.stage && a.stg[sk.stage.stat] < 2) v += boss ? 0.14 : 0.02;
          if (sk.status) {
            const s = sk.status.id;
            if (a.st[s]) continue;
            if (s === 'regen') v += (1 - a.hp / a.maxHp) * 0.3 + (boss ? 0.08 : 0);
            if (s === 'taunt') v += allies.some(x => x !== u && x.hp < x.maxHp * 0.5) ? 0.35 : boss ? 0.15 : 0.02;
            if (s === 'mirror') v += a.st.locked ? 1.3 : boss ? 0.12 : 0.01;
          }
          if (fx === 'prime') {
            const f = mainFoe(b);
            if (f && hueMult(u.loaded, b.defHues(f)) > 1 && a.weaponHue === 'N' && a.str >= a.mnd && !a.st.primed) v += 0.3;
          }
          if (fx === 'hasten' && a !== u) v += boss ? 0.15 : 0.02;
        }
        out.push({ a: { t: 'skill', skill: id, target: t?.uid }, v: v - pay, why: `${id}>${t?.name ?? 'party'}` });
      }
    }
  }

  // Items: only when things look bad.
  for (const [id, n] of Object.entries(b.items)) {
    if (n <= 0) continue;
    const it = ITEMS[id];
    if (!it?.use || !it.battle) continue;
    const use = it.use;
    if (use.revive) for (const d of dead) out.push({ a: { t: 'item', item: id, target: d.uid }, v: 1.0, why: 'item revive' });
    if (use.heal && use.target === 'ally') {
      for (const a of allies) if (a.hp < a.maxHp * 0.3) out.push({ a: { t: 'item', item: id, target: a.uid }, v: Math.min(use.heal, a.maxHp - a.hp) / a.maxHp * 1.6 - 0.05, why: 'item heal' });
    }
    if (use.heal && use.target === 'allies' && partyHurt > 1.2) out.push({ a: { t: 'item', item: id }, v: partyHurt * 0.3, why: 'item heal all' });
    if (use.ink && u.ink < u.maxInk * 0.15 && boss) out.push({ a: { t: 'item', item: id, target: u.uid }, v: 0.25, why: 'item ink' });
  }
  if (!out.length) out.push({ a: { t: 'guard' }, v: 0, why: 'nothing' });
  return out;
}

function resistsParty(b: Battle, f: Unit): boolean {
  return b.alive(0).some(a => a.baseHues.some(h => h !== 'N' && hueMult(h, b.defHues(f)) < 1));
}

/** How much repainting a foe's first hue to the painter's loaded hue helps the rest of the party. */
function paintValue(b: Battle, painter: Unit, f: Unit): number {
  if (f.st.painted) return -0.3;
  const hues = b.alive(0).filter(a => a !== painter).map(a => a.weaponHue !== 'N' ? a.weaponHue : a.baseHues[0]).filter(h => h !== 'N');
  if (!hues.length) return 0;
  const before = Math.max(...hues.map(h => hueMult(h, b.defHues(f))));
  const after = Math.max(...hues.map(h => hueMult(h, [painter.loaded, b.defHues(f)[1]])));
  const worth = f.boss || f.hp > f.maxHp * 0.6 ? 1 : 0.3;
  return (after - before) * 0.4 * worth;
}

export { opposite };
