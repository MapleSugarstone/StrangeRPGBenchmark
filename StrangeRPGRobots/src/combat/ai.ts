// Enemy, ally, and woken-object decisions. Each turn the unit scores every tile it can reach by the best
// thing it could do from there, minus the danger of standing there, weighted by its temperament.
import { CB, dist, cheb, unitAt, foesOf, friendsOf, los, hitInfo, weaponFor, isMelee, rangeOf, freeTile, rnd, roll, isWet } from './core';
import { type Unit, has, alive, hostile, addStatus } from './unit';
import { ABILITY, type ItemDef } from '../rules/data';
import { reachable, findPath } from '../world/path';
import { WORLD, propAt, elevAt, walkable } from '../world/world';
import { attack, useAbility, moveAlong, canUse, validTarget, pause, push, damage, float, applyStatus, setSurface, droneAct } from './actions';
import { C } from '../engine/palette';
import { G } from '../game/state';
import { sfx } from '../audio/sfx';
import { lineTiles } from '../world/path';

function avg(w: ItemDef | null, u: Unit): number {
  if (!w?.dmg) return 2;
  let a = (w.dmg[0] + w.dmg[1]) / 2 * (w.shots ?? 1);
  if (isMelee(w)) a += Math.floor(u.attr.body / 2);
  return a;
}

/** Expected damage this unit takes standing at its current tile from foes who can reach it next turn. */
function danger(u: Unit): number {
  let d = 0;
  for (const f of targetsOf(u)) {
    if (f.prop && !f.wake) continue;
    const w = f.ranged ?? f.melee;
    const melee = !f.ranged;
    if (melee && dist(f, u) > f.move + 1) continue;
    if (!melee && (!los(f, u) || dist(f, u) > rangeOf(w) + 4)) continue;
    const h = hitInfo(f, u, w).chance / 100;
    d += h * avg(w, f) * (f.side === 'party' ? 1 : 0.6);
  }
  return d;
}

interface Plan { x: number; y: number; path: [number, number][]; score: number; act?: { id: string; x: number; y: number }; weapon?: Unit }

function targetValue(u: Unit, t: Unit, expected: number): number {
  let v = expected;
  if (expected >= t.hp) v += 10 + (t.side === 'party' ? 6 : 0);
  if (t.member?.cls === 'witch' || t.member?.cls === 'diver') v += 1.5;
  if (t.downed) v -= 100;
  if (t.prop) v *= 0.7;
  if (u.taunter && has(u, 'taunted') && t.id !== u.taunter) v -= 50;
  return v;
}

function bestAction(u: Unit): { score: number; id?: string; x?: number; y?: number } {
  let best = { score: 0 } as { score: number; id?: string; x?: number; y?: number };
  if (!u.action && u.extraActions <= 0) return best;
  for (const t of targetsOf(u)) {
    if (t.downed || (has(t, 'hidden') && dist(u, t) > 1)) continue;
    const w = weaponFor(u, t);
    if (!w) continue;
    const melee = isMelee(w);
    if (melee && cheb(u, t) > (w.reach ?? 1)) continue;
    if (!melee && (!los(u, t) || dist(u, t) > rangeOf(w) + 3)) continue;
    const h = hitInfo(u, t, w).chance / 100;
    const s = targetValue(u, t, h * avg(w, u));
    if (s > best.score) best = { score: s, id: 'attack', x: t.x, y: t.y };
  }
  for (const id of u.abilities) {
    const a = ABILITY.get(id);
    if (!a || a.cost === 'bonus' || a.cost === 'reaction' || !canUse(u, id)) continue;
    for (const c of candidateTargets(u, id)) {
      if (!validTarget(u, a, c.x, c.y)) continue;
      const s = abilityValue(u, id, c.x, c.y);
      if (s > best.score) best = { score: s, id, x: c.x, y: c.y };
    }
  }
  return best;
}

function candidateTargets(u: Unit, id: string): { x: number; y: number }[] {
  const a = ABILITY.get(id)!;
  if (a.target === 'self') return [{ x: u.x, y: u.y }];
  if (a.target === 'ally') return [u, ...friendsOf(u)];
  if (a.target === 'enemy' || a.target === 'unit') return CB.units.filter((t) => alive(t) && t !== u);
  if (a.target === 'prop') return WORLD.props.filter((p) => !p.broken && !p.wake && p.def.wake && dist(p, u) <= a.range).map((p) => ({ x: p.x, y: p.y }));
  if (a.target === 'tile') return targetsOf(u).map((f) => ({ x: f.x, y: f.y }));
  return [];
}

function abilityValue(u: Unit, id: string, x: number, y: number): number {
  const t = unitAt(x, y);
  switch (id) {
    case 'heal': return t && !hostile(u, t) ? Math.min(10, t.maxHp - t.hp) * (t.hp < t.maxHp * 0.5 ? 1.3 : 0.6) : 0;
    case 'tea': return u.hp < u.maxHp * 0.55 ? 14 : 0;
    case 'hushthrow': return t && hostile(u, t) && (t.wake || t.member?.id === 'courtesy') ? (t.wake ? 9 + t.hp / 4 : 8) : 0;
    case 'redvial': {
      const near = targetsOf(u).filter((f) => dist(f, { x, y }) <= 2).length;
      const mine = friendsOf(u).filter((f) => dist(f, { x, y }) <= 2).length;
      return near * 6 - mine * 5;
    }
    case 'enemyhack': return t && hostile(u, t) && t.chrome ? targetValue(u, t, 4.5) + 1 : 0;
    case 'bite': return t && hostile(u, t) && dist(u, t) === 1 ? targetValue(u, t, hitInfo(u, t, u.melee).chance / 100 * 7) + 0.5 : 0;
    case 'grenade': {
      let n = 0;
      for (const f of CB.units) if (alive(f) && cheb(f, { x, y }) <= 1) n += hostile(u, f) ? 1 : -1.2;
      return n >= 2 ? n * 6 : 0;
    }
    default: return classValue(u, id, x, y);
  }
}

/** Rough worth of a class ability, so allies and the balance simulator use their kits. */
function classValue(u: Unit, id: string, x: number, y: number): number {
  const a = ABILITY.get(id)!;
  const t = unitAt(x, y);
  const foe = t && alive(t) && hostile(u, t) ? t : null;
  const ally = t && alive(t) && !hostile(u, t) ? t : null;
  const near = (r: number, cx = u.x, cy = u.y) => targetsOf(u).filter((f) => !f.downed && dist(f, { x: cx, y: cy }) <= r);
  const threat = (f: Unit) => avg(f.ranged ?? f.melee, f) * 0.8 + (f.boss ? 4 : 0);
  switch (id) {
    case 'lunge': case 'execute': case 'taser': case 'charge': case 'cheapshot': {
      if (!foe) return 0;
      const h = hitInfo(u, foe, u.melee, a).chance / 100;
      let dmg = a.dmg ? (a.dmg[0] + a.dmg[1]) / 2 : avg(u.melee, u);
      if (id === 'execute' && foe.hp < foe.maxHp / 3) dmg *= 2;
      if (id === 'cheapshot' && (has(foe, 'stunned') || has(foe, 'taunted') || has(foe, 'distracted'))) dmg *= 1.5;
      return targetValue(u, foe, h * dmg) + (id === 'charge' ? 1.5 : 0) + 0.3;
    }
    case 'cleave': { const n = near(1).length; return n >= 2 ? n * avg(u.melee, u) * 0.7 : 0; }
    case 'shortcircuit': case 'overheat': case 'cascade': {
      if (!foe) return 0;
      const d = a.dmg ? (a.dmg[0] + a.dmg[1]) / 2 : 4;
      const extra = id === 'cascade' ? Math.min(3, near(4, foe.x, foe.y).length - 1) * d * 0.8 : id === 'overheat' ? 6 : 0;
      return targetValue(u, foe, d + (foe.machine ? 2 : 0)) + extra + 0.5;
    }
    case 'blind': return foe && !has(foe, 'blinded') && foe.ranged ? threat(foe) * 0.6 : 0;
    case 'cripple': return foe && !has(foe, 'crippled') && foe.melee && !foe.ranged ? threat(foe) * 0.7 : 0;
    case 'fasttalk': return foe && !foe.machine && !has(foe, 'stunned') ? threat(foe) * 0.9 : 0;
    case 'turncoat': return foe && !foe.machine && !foe.boss ? threat(foe) * 1.8 : 0;
    case 'taunt': return foe && !has(foe, 'taunted') && u.hp > u.maxHp * 0.5 ? threat(foe) * 0.5 : 0;
    case 'remaincalm': return u.hp > u.maxHp * 0.5 ? near(3).length * 2.2 - 1 : 0;
    case 'demoralize': return near(3).length * 2 - 1;
    case 'lockdown': return near(2).length * 4;
    case 'foam': return targetsOf(u).filter((f) => dist(f, { x, y }) <= 1).length * 2.5;
    case 'bulwark': return friendsOf(u).filter((f) => dist(f, u) <= 2).length * 1.5 + (u.hp < u.maxHp * 0.4 ? 2 : 0);
    case 'guard': return ally && ally !== u && ally.hp < ally.maxHp * 0.5 && dist(ally, u) <= 1 ? 4 : 0;
    case 'tag': return foe && !has(foe, 'marked') ? 1.5 + friendsOf(u).length * 0.8 : 0;
    case 'patch': case 'rally': return ally ? Math.min(9, ally.maxHp - ally.hp) * (ally.hp < ally.maxHp * 0.5 ? 1.1 : 0.4) : 0;
    case 'adrenal': return u.hp < u.maxHp * 0.5 ? u.maxHp / 3 : 0;
    case 'help': return t && t.downed ? 14 : 0;
    case 'overclock': return near(6).length ? 5 : 0;
    case 'speech': return friendsOf(u).length * 3;
    case 'smoke': return near(6).filter((f) => f.ranged).length * 1.5 - 1;
    case 'turret': return near(8).length ? 6 : 0;
    case 'overcharge': return u.droneHp > 0 && near(7).length ? 3 : 0;
    case 'shockfield': { let v = 0; for (const f of targetsOf(u)) if (dist(f, { x, y }) <= 1) v += isWet(f.x, f.y) ? 9 : 5.5; return v; }
    case 'kamikaze': { let v = 0; for (const f of CB.units) if (alive(f) && cheb(f, { x, y }) <= 2) v += hostile(u, f) ? 13 : -10; return v; }
    case 'wake': case 'splash': case 'redrain': case 'hijack': {
      let v = 0;
      const props = id === 'wake' || id === 'hijack' ? [propAt(x, y)] : WORLD.props.filter((p) => !p.broken && !p.wake && p.def.wake && dist(p, { x: id === 'redrain' ? u.x : x, y: id === 'redrain' ? u.y : y }) <= (id === 'redrain' ? 4 : 1));
      for (const p of props) {
        if (!p || p.broken || p.wake || !p.def.wake || p.def.wake === 'none') continue;
        const foes = targetsOf(u).filter((f) => dist(f, p) <= 3).length;
        const mates = friendsOf(u).filter((f) => dist(f, p) <= 1).length;
        const mood = id === 'hijack' ? 'calm' : u.mood ?? 'calm';
        v += foes * (mood === 'anger' ? 5 : mood === 'calm' ? 4.5 : 2.5) - (mood === 'anger' ? mates * 4 : 0);
      }
      return v - (a.blood ?? 0) * 0.4;
    }
    case 'rouse': return foe && foe.chrome ? threat(foe) * 0.8 : 0;
    case 'steady': return u.mood === 'fear' || u.mood === 'grief' ? 2 : 0;
    case 'heartfelt': return WORLD.props.some((p) => !p.broken && p.def.wake && dist(p, u) <= 5) ? 3 : 0;
    case 'secondhands': return near(6).length ? 4 : 0;
    case 'call': return CB.units.some((c) => c.member?.id === 'courtesy' && alive(c)) && near(6).length ? 4 : 0;
    case 'shove': {
      if (!foe) return 0;
      const nx = foe.x + Math.sign(foe.x - u.x), ny = foe.y + Math.sign(foe.y - u.y);
      const m = WORLD.map!;
      const deep = m.cells[ny * m.w + nx]?.tile.water === 'deep';
      const drop = elevAt(foe.x, foe.y) - elevAt(nx, ny) >= 2;
      const fire = CB.surf.get(ny * m.w + nx)?.kind === 'fire';
      return (deep ? (foe.machine && !foe.flying ? 25 : 9) : drop ? 8 : fire ? 6 : 0);
    }
    default: return 0;
  }
}

const TEMPER: Record<string, { danger: number; melee: number; range: number; high: number }> = {
  rush: { danger: 0.2, melee: 3, range: 0, high: 0 },
  brute: { danger: 0.1, melee: 4, range: 0, high: 0 },
  cover: { danger: 0.7, melee: 0, range: 0.3, high: 1 },
  sniper: { danger: 0.8, melee: -3, range: 0.6, high: 3 },
  support: { danger: 0.9, melee: -2, range: 0.4, high: 0.5 },
  hacker: { danger: 0.9, melee: -2, range: 0.5, high: 0.5 },
  boss: { danger: 0.4, melee: 1, range: 0.2, high: 1 },
  drone: { danger: 0.4, melee: -1, range: 0.3, high: 0 },
  party: { danger: 0.5, melee: 1, range: 0.2, high: 1 },
  turret: { danger: 0, melee: 0, range: 0, high: 0 },
  coward: { danger: 1.4, melee: -3, range: 0.5, high: 0 },
};

/** Foes worth acting on. A dormant unit is left alone so it stays dormant. */
function targetsOf(u: Unit): Unit[] { return foesOf(u).filter((o) => !o.dormant); }

export async function aiTurn(u: Unit) {
  if (u.dormant) return;
  if (u.wake && u.prop) { await wokenTurn(u); return; }
  if (u.ai === 'turret') { await turretTurn(u); return; }
  const tm = TEMPER[u.ai] ?? TEMPER.cover;
  const smart = G.difficulty === 'flatline' ? 1 : G.difficulty === 'story' ? 0.5 : 0.8;
  const ox = u.x, oy = u.y;
  const reach = reachable(u.x, u.y, u.moveLeft, (x, y) => !freeTile(x, y, u), u.flying);
  let best: Plan = { x: u.x, y: u.y, path: [], score: -Infinity };
  const m = WORLD.map!;
  const lowHp = u.hp < u.maxHp * 0.3 && !u.boss;
  for (const [k, steps] of reach) {
    const x = k % m.w, y = Math.floor(k / m.w);
    u.x = x; u.y = y;
    const act = bestAction(u);
    let s = act.score * 1.0;
    s -= danger(u) * tm.danger * (lowHp ? 1.6 : 1);
    s += elevAt(x, y) * tm.high * 0.6;
    const nearest = targetsOf(u).filter((f) => !f.downed).reduce((d, f) => Math.min(d, dist(f, u)), 99);
    if (nearest === 1) s += tm.melee;
    if (!act.id && nearest < 99) s -= nearest * (tm.melee > 0 ? 0.6 : 0.15);
    if (tm.range > 0 && nearest < 3) s -= (3 - nearest) * tm.range * 2;
    s -= steps * 0.05;
    s += (rnd() - 0.5) * (1 - smart) * 4;
    if (s > best.score) best = { x, y, path: [], score: s, act: act.id ? { id: act.id, x: act.x!, y: act.y! } : undefined };
  }
  u.x = ox; u.y = oy;
  if (best.x !== u.x || best.y !== u.y) {
    const p = findPath(u.x, u.y, best.x, best.y, { blocked: (x, y) => !freeTile(x, y, u), fly: u.flying });
    if (p) { await moveAlong(u, p.slice(0, u.moveLeft)); await pause(0.08); }
  }
  if (!alive(u)) return;
  const act = best.act;
  if (act) {
    const a = ABILITY.get(act.id);
    if (a && canUse(u, act.id) && validTarget(u, a, act.x, act.y)) {
      await useAbility(u, act.id, act.x, act.y);
      await pause(0.15);
    } else {
      const again = bestAction(u);
      if (again.id) await useAbility(u, again.id, again.x!, again.y!);
    }
  }
  if (alive(u) && u.bonus) await bonusPass(u);
  if (u.droneHp > 0) await droneAct(u);
}

/** After the main action: the best bonus action worth taking, if any. */
async function bonusPass(u: Unit) {
  if (u.side === 'party' && u.member && u.hp < u.maxHp * 0.35 && (G.items.stim ?? 0) > 0) {
    G.items.stim--;
    const { heal } = await import('./actions');
    heal(u, roll(10, 14));
    u.bonus = false;
    return;
  }
  let best = { v: 1.5, id: '', x: 0, y: 0 };
  const ids = [...u.abilities, ...(u.machine && !u.member ? [] : ['shove'])];
  for (const id of ids) {
    const a = ABILITY.get(id);
    if (!a || a.cost !== 'bonus' || !canUse(u, id)) continue;
    for (const c of candidateTargets(u, id)) {
      if (!validTarget(u, a, c.x, c.y)) continue;
      const v = abilityValue(u, id, c.x, c.y);
      if (v > best.v) best = { v, id, x: c.x, y: c.y };
    }
  }
  if (best.id) { await useAbility(u, best.id, best.x, best.y); await pause(0.1); }
}

async function turretTurn(u: Unit) {
  const t = targetsOf(u).filter((f) => !f.downed && los(u, f) && dist(u, f) <= 8).sort((a, b) => a.hp - b.hp)[0];
  if (t) await attack(u, t, u.ranged);
}

/** Woken objects act on their feeling. */
async function wokenTurn(u: Unit) {
  const w = u.wake!;
  const p = u.prop!;
  const reps = w.twice ? 2 : 1;
  for (let r = 0; r < reps; r++) {
    if (!alive(u)) return;
    if (w.feeling === 'joy') { float(u, 'DANCES', C.amb3); sfx('note'); await pause(0.2); continue; }
    if (w.feeling === 'grief') {
      for (const o of CB.units) if (alive(o) && o !== u && dist(o, u) <= 1) { applyStatus(o, 'slowed', 1); }
      setSurface(u.x, u.y, 'water', 2);
      float(u, 'WEEPS', C.steel3);
      await pause(0.2);
      continue;
    }
    const by = CB.units.find((x) => x.id === w.by);
    let targets: Unit[];
    if (w.feeling === 'anger') targets = CB.units.filter((o) => alive(o) && o !== u && o.id !== w.by && !o.prop);
    else targets = CB.units.filter((o) => alive(o) && by && hostile(by, o) && o !== u && !o.prop);
    targets.sort((a, b) => dist(a, u) - dist(b, u));
    const t = targets[0];
    if (!t) continue;
    if (w.feeling === 'fear') {
      const away = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy })).filter((c) => freeTile(c.x, c.y) && !propAt(c.x, c.y)).sort((a, b) => dist(b, t) - dist(a, t))[0];
      if (away && dist(away, t) > dist(u, t)) {
        for (const o of CB.units) if (alive(o) && o !== u && dist(o, away) === 0) await push(o, away.x - u.x, away.y - u.y, 1, u);
        await moveAlong(u, [[away.x, away.y]], true);
        float(u, 'FLEES', C.vio3);
      } else { addStatus(u, 'bulwark', 1); float(u, 'COWERS', C.vio3); }
      continue;
    }
    await wokenStrike(u, t);
  }
  void p;
}

async function stepToward(u: Unit, t: Unit, n: number) {
  const path = findPath(u.x, u.y, t.x, t.y, { adjacent: true, blocked: (x, y) => !freeTile(x, y) || !!propAt(x, y) });
  if (path && path.length) await moveAlong(u, path.slice(0, n), true);
}

async function wokenStrike(u: Unit, t: Unit) {
  const act = u.prop!.def.wake;
  switch (act) {
    case 'throw': case 'shoot': {
      const r = act === 'throw' ? 5 : 7;
      if (dist(u, t) > r || !los(u, t)) await stepToward(u, t, 2);
      if (dist(u, t) <= r && los(u, t)) {
        sfx(act === 'throw' ? 'shove' : 'pistol');
        const hit = rnd() < 0.75;
        if (hit) await damage(t, act === 'throw' ? roll(3, 5) : roll(4, 7), 'kinetic', u); else float(t, 'MISS', C.gray);
      }
      return;
    }
    case 'ram': {
      const dx = Math.sign(t.x - u.x), dy = t.x === u.x ? Math.sign(t.y - u.y) : 0;
      const ddx = dx !== 0 ? dx : 0, ddy = dx !== 0 ? 0 : Math.sign(t.y - u.y);
      float(u, 'RAMS', C.mag3);
      sfx('bailer');
      for (let i = 0; i < 5; i++) {
        const nx = u.x + ddx, ny = u.y + ddy;
        const o = unitAt(nx, ny);
        if (o && alive(o)) { await damage(o, roll(6, 10), 'kinetic', u); if (alive(o)) await push(o, ddx, ddy, 2, u); return; }
        if (!walkable(nx, ny) || propAt(nx, ny)) return;
        await moveAlong(u, [[nx, ny]], true);
      }
      return;
    }
    case 'slam': case 'swallow': case 'swing': case 'blast': case 'lift': case 'bump': case 'flash': {
      if (dist(u, t) > 1) await stepToward(u, t, act === 'bump' ? 3 : 2);
      if (dist(u, t) > 1 && act !== 'flash') return;
      sfx('melee');
      if (act === 'slam') { await damage(t, roll(3, 5), 'kinetic', u); applyStatus(t, 'stunned', 1); }
      else if (act === 'swallow') { await damage(t, roll(4, 7), 'kinetic', u); applyStatus(t, 'immobile', 1); }
      else if (act === 'swing') { for (const o of CB.units) if (alive(o) && o !== u && cheb(o, u) === 1 && o.id !== u.wake!.by) await damage(o, roll(4, 6), 'kinetic', u); }
      else if (act === 'blast') { sfx('pa'); for (const o of CB.units) if (alive(o) && o !== u && dist(o, u) === 1) { await damage(o, roll(2, 3), 'kinetic', u); if (alive(o)) { applyStatus(o, 'distracted', 1); await push(o, Math.sign(o.x - u.x), Math.sign(o.y - u.y), 1, u); } } }
      else if (act === 'lift') { await damage(t, roll(4, 7), 'kinetic', u); if (alive(t)) await push(t, Math.sign(t.x - u.x), Math.sign(t.y - u.y), 3, u); }
      else if (act === 'bump') { await damage(t, roll(2, 4), 'kinetic', u); if (alive(t)) await push(t, Math.sign(t.x - u.x), Math.sign(t.y - u.y), 1, u); }
      else if (act === 'flash') { for (const o of CB.units) if (alive(o) && o !== u && dist(o, u) <= 2 && o.id !== u.wake!.by) applyStatus(o, 'blinded', 1); }
      return;
    }
    default: return;
  }
}

export { attack };
