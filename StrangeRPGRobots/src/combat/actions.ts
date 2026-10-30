// Everything a unit can do in a fight, with its animation: moving, attacking, abilities, items, shoves,
// jumps, wakes, explosions, and what happens at the start and end of each turn.
import { CB, roll, rnd, dist, cheb, unitAt, standing, foesOf, friendsOf, los, hitInfo, weaponFor, isMelee, rangeOf, difficultyDamage, idx, isWet, freeTile, surfaceAt, type SurfaceKind } from './core';
import { type Unit, has, addStatus, alive, hostile, perk, unitFromProp } from './unit';
import { ABILITY, ITEM, STATUSES, type AbilityDef, type ItemDef, type Feeling, type DType } from '../rules/data';
import { WORLD, walkable, elevAt, propAt, rebuildGrids, type PropInst } from '../world/world';
import { cellAt } from '../world/map';
import { lineTiles, stepOk } from '../world/path';
import { T } from '../world/tiles';
import { C, LIGHT } from '../engine/palette';
import { wait } from '../game/sched';
import { G } from '../game/state';
import { sfx, combatEvent } from '../audio/sfx';

export function pause(s: number): Promise<void> { return CB.sim ? Promise.resolve() : wait(s); }

export function float(u: { x: number; y: number }, text: string, color: number) {
  if (CB.sim) return;
  const n = CB.floats.filter((f) => f.t > 0.6).length;
  CB.floats.push({ x: u.x * T + 5, y: u.y * T - 2 - n * 6, text, color, t: 1.1 });
}

export function sparks(x: number, y: number, n: number, color: number, speed = 30, glow = true) {
  if (CB.sim) return;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, s = speed * (0.4 + rnd() * 0.8);
    CB.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, t: 0.3 + rnd() * 0.4, color, glow });
  }
}

export function flashAt(x: number, y: number, r: number, i: number, color: number, life = 0.18) {
  if (CB.sim) return;
  CB.flashes.push({ x, y, r, i, color, t: life, life });
}

function cpx(u: { x: number; y: number }): [number, number] { return [u.x * T + 5, u.y * T + 4]; }

export function tracer(a: Unit, b: { x: number; y: number }, color: number) {
  if (CB.sim) return;
  const [x0, y0] = cpx(a), [x1, y1] = cpx(b);
  CB.tracers.push({ x0, y0, x1, y1, t: 0.12, color });
  flashAt(x0, y0, 26, 1.2, color === C.cyan3 ? LIGHT.cyan : LIGHT.amber, 0.12);
}

/** Moves the unit's sprite to its tile over time. */
async function glide(u: Unit, speed = 9) {
  if (CB.sim) { snap(u); return; }
  const a = u.actor;
  if (a) {
    a.moving = true;
    await new Promise<void>((res) => {
      const tick = () => {
        const tx = u.x * T, ty = u.y * T;
        const dx = tx - a.px, dy = ty - a.py;
        const d = Math.hypot(dx, dy);
        const step = speed * T / 60;
        a.anim += 1 / 60;
        if (d <= step) { a.px = tx; a.py = ty; a.moving = false; res(); return; }
        a.px += (dx / d) * step; a.py += (dy / d) * step;
        requestFrame(tick);
      };
      tick();
    });
    return;
  }
  if (u.prop) {
    const p = u.prop;
    await new Promise<void>((res) => {
      const tick = () => {
        const d = Math.hypot(p.ox, p.oy);
        const step = speed * T / 60;
        if (d <= step) { p.ox = 0; p.oy = 0; res(); return; }
        p.ox -= (p.ox / d) * step; p.oy -= (p.oy / d) * step;
        requestFrame(tick);
      };
      tick();
    });
  }
}

const frameQueue: (() => void)[] = [];
function requestFrame(f: () => void) { frameQueue.push(f); }
/** Called once per frame by the combat loop to advance glides. */
export function runFrameQueue() { const q = frameQueue.splice(0); for (const f of q) f(); }

function snap(u: Unit) {
  if (u.actor) { u.actor.px = u.x * T; u.actor.py = u.y * T; u.actor.moving = false; }
  if (u.prop) { u.prop.ox = 0; u.prop.oy = 0; }
}

function setPos(u: Unit, x: number, y: number) {
  const ox = u.x, oy = u.y;
  u.x = x; u.y = y;
  if (u.actor) { u.actor.tx = x; u.actor.ty = y; u.actor.dir = x > ox ? 'right' : x < ox ? 'left' : y < oy ? 'up' : 'down'; }
  if (u.prop) { u.prop.ox += (ox - x) * T; u.prop.oy += (oy - y) * T; u.prop.x = x; u.prop.y = y; rebuildGrids(); }
}

export function face(u: Unit, t: { x: number; y: number }) {
  if (!u.actor) return;
  const dx = t.x - u.x, dy = t.y - u.y;
  if (Math.abs(dx) >= Math.abs(dy)) u.actor.dir = dx < 0 ? 'left' : 'right';
  else u.actor.dir = dy < 0 ? 'up' : 'down';
}

/** Damage that grows with level, so fights stay short as hit points grow. */
export function levelBonus(u: Unit): number { return u.prop ? 0 : Math.floor((u.level - 1) * 0.6); }

// ---------- damage ----------

export async function damage(t: Unit, n: number, type: DType, src: Unit | null, crit = false): Promise<number> {
  if (!alive(t)) return 0;
  let d = n;
  if (src) d = difficultyDamage(src, d);
  if (type === 'kinetic') d -= t.plating;
  if (type === 'shock' && isWet(t.x, t.y)) d = Math.round(d * 1.5);
  if (type === 'shock' && t.machine) d += 2;
  if (type === 'hack' && src && perk(src, 'overload')) d += 2;
  if (src?.side === 'enemy' && type === 'shock' && t.side === 'party' && CB.units.some((u) => u.side === 'party' && perk(u, 'firewall'))) d = Math.ceil(d / 2);
  if (type === 'fire' && isWet(t.x, t.y)) d = Math.ceil(d / 2);
  d = Math.max(1, d);
  if (t.hp - d <= 0 && perk(t, 'unbroken') && !t.unbrokenUsed) { t.unbrokenUsed = true; d = t.hp - 1; float(t, 'UNBROKEN', C.amb3); }
  t.hp -= d;
  float(t, crit ? `${d}!` : `${d}`, crit ? C.amb4 : type === 'shock' ? C.cyan3 : type === 'fire' ? C.amb3 : C.white);
  if (t.actor && !CB.sim) { const a = t.actor; const ox = a.px; a.px += src && src.x < t.x ? 1 : -1; setTimeoutFrames(() => { a.px = ox; }, 4); }
  sfx(crit ? 'crit' : 'hit', { pitch: 0.9 + rnd() * 0.2 });
  if (t.member?.cls === 'witch') moodOnHit(t, d);
  if (t.side === 'party' && t.hp > 0 && t.hp < t.maxHp * 0.34) combatEvent('low_hp');
  if (t.boss && t.hp > 0) {
    const ph = t.hp < t.maxHp / 3 ? 2 : t.hp < t.maxHp * 2 / 3 ? 1 : 0;
    if (ph > t.phase) { t.phase = ph; combatEvent('boss_phase'); }
  }
  if (t.hp <= 0) await fall(t, src);
  return d;
}

function setTimeoutFrames(f: () => void, n: number) {
  let k = n;
  const tick = () => { if (--k <= 0) f(); else requestFrame(tick); };
  requestFrame(tick);
}

function moodOnHit(t: Unit, d: number) {
  if (perk(t, 'old_feeling') && rnd() < 0.5) return;
  if (t.hp < t.maxHp * 0.3) setMood(t, 'fear');
  else if (d >= t.maxHp * 0.2) setMood(t, 'anger');
}

export function setMood(t: Unit, m: Feeling) {
  if (t.mood === m) return;
  t.mood = m;
  if (t.member) t.member.mood = m;
  float(t, m.toUpperCase(), MOOD_COLOR[m]);
}

export const MOOD_COLOR: Record<Feeling, number> = { anger: C.mag3, fear: C.vio3, calm: C.cyan3, joy: C.amb3, grief: C.steel3, longing: C.red2 };

async function fall(t: Unit, src: Unit | null) {
  t.hp = 0;
  if (t.wake && t.prop) {
    t.dead = true;
    t.prop.broken = true;
    t.prop.wake = null;
    rebuildGrids();
    sparks(t.x * T + 5, t.y * T + 5, 14, C.gray, 40);
    sfx('explode', { vol: 0.5 });
    return;
  }
  if (t.side === 'party' && !t.member && t.actor?.role === 'ally') { t.downed = true; if (t.actor) t.actor.tint = C.slate; float(t, 'DOWN', C.mag3); return; }
  if (t.side === 'party' && t.member) {
    t.downed = true;
    t.member.hp = 0;
    if (t.actor) t.actor.tint = C.slate;
    float(t, 'DOWN', C.mag3);
    for (const f of friendsOf(t)) if (f.member?.cls === 'witch') setMood(f, 'grief');
    CB.stats.closeCall = true;
    return;
  }
  t.dead = true;
  CB.log.push(`${t.name} falls`);
  combatEvent('kill');
  if (src && perk(src, 'momentum')) src.bonus = true;
  if (src?.wake?.by) { const w = CB.units.find((u) => u.id === src.wake!.by); if (w?.member?.cls === 'witch') setMood(w, 'joy'); }
  void dissipate(t);
}

/** Defeat looks like the sprite's pixels drifting away as gas. */
async function dissipate(t: Unit) {
  sfx('dissipate');
  const a = t.actor;
  if (!a) return;
  if (CB.sim) { a.gone = true; return; }
  for (let k = 0; k <= 20; k++) {
    a.fade = k / 20;
    a.lift = Math.floor(k / 6);
    if (k % 2 === 0) sparks(a.px + 2 + rnd() * 6, a.py + 2 + rnd() * 6, 2, C.slate, 12, false);
    await wait(0.035);
  }
  a.gone = true;
}

// ---------- movement ----------

/** Walks a unit along a path, one tile at a time. Overwatch and free hits may interrupt it. */
export async function moveAlong(u: Unit, path: [number, number][], free = false): Promise<void> {
  for (const [x, y] of path) {
    if (!alive(u)) return;
    if (!freeTile(x, y, u) && !(u.prop && propAt(x, y) === u.prop)) return;
    const leaving = !free ? foesOf(u).filter((e) => e.reaction && dist(e, u) === 1 && isMelee(e.melee) && !e.prop && !has(e, 'stunned') && !has(e, 'shocked')) : [];
    setPos(u, x, y);
    if (!free && u.moveLeft > 0) u.moveLeft--;
    sfx('step', { vol: 0.4, pitch: 0.9 + rnd() * 0.2 });
    await glide(u, 8);
    for (const e of leaving) if (dist(e, u) > 1 && alive(e) && alive(u)) { e.reaction = false; float(e, 'FREE HIT', C.pale); await attack(e, u, e.melee, { reaction: true }); }
    await enterTile(u);
    if (!alive(u)) return;
    for (const e of foesOf(u)) {
      if (has(e, 'overwatch') && e.reaction && e.ranged && los(e, u) && dist(e, u) <= rangeOf(e.ranged) + 2) {
        e.status.delete('overwatch');
        e.reaction = false;
        float(e, 'OVERWATCH', C.amb3);
        await attack(e, u, e.ranged, { reaction: true });
        if (!alive(u)) return;
      }
    }
  }
}

async function enterTile(u: Unit) {
  const s = surfaceAt(u.x, u.y);
  if (isWet(u.x, u.y)) addStatus(u, 'wet', 2);
  if (!s) return;
  if (s.kind === 'fire' && !has(u, 'wet')) { addStatus(u, 'burning', 2); await damage(u, 3, 'fire', null); }
  if (s.kind === 'shock') { await damage(u, 4, 'shock', null); addStatus(u, 'shocked', 1); }
  if (s.kind === 'oil' && !u.flying && rnd() < 0.35) { addStatus(u, 'prone', 1); float(u, 'SLIP', C.pale); }
  if (s.kind === 'foam') { addStatus(u, 'immobile', 1); u.moveLeft = 0; }
}

// ---------- attacks ----------

export interface AttackOpts { bonusDmg?: number; mult?: number; reaction?: boolean; noCover?: boolean; ability?: AbilityDef; forceHit?: boolean }

export async function attack(u: Unit, t: Unit, w: ItemDef | null, o: AttackOpts = {}): Promise<boolean> {
  if (!alive(u) || !alive(t)) return false;
  const guard = guardOf(t);
  if (guard && guard !== u) { float(guard, 'GUARD', C.cyan3); t.status.delete('guarded'); t.guardedBy = undefined; t = guard; sfx('guard'); }
  face(u, t);
  const melee = isMelee(w);
  const shots = w?.shots ?? 1;
  const info = hitInfo(u, t, w, o.ability);
  let anyHit = false;
  if (u.side === 'party' && u.member) { CB.stats.actions++; if (!o.ability) CB.stats.plain++; }
  for (let s = 0; s < shots; s++) {
    if (!alive(t)) break;
    if (melee) await lungeAnim(u, t); else { tracer(u, t, w?.dtype === 'shock' ? C.cyan3 : C.amb4); sfx(gunSfx(w)); }
    const hitRoll = rnd() * 100;
    let hit = o.forceHit || hitRoll < info.chance;
    if (hit && !o.forceHit && t.abilities.includes('reflexstep') && t.reaction && !has(t, 'stunned')) {
      t.reaction = false;
      hit = false;
      G.port.hold += 1;
      float(t, G.port.name.toUpperCase(), C.cyan4);
      sfx('port');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (freeTile(t.x + dx, t.y + dy, t) && dist({ x: t.x + dx, y: t.y + dy }, u) > 1) { setPos(t, t.x + dx, t.y + dy); await glide(t, 14); break; } }
    }
    if (!hit) {
      float(t, 'MISS', C.gray);
      sfx('miss');
      if (melee && !o.reaction && t.abilities.includes('riposte') && t.reaction && alive(t) && dist(t, u) === 1) {
        t.reaction = false;
        float(t, 'RIPOSTE', C.amb3);
        await attack(t, u, t.melee, { reaction: true });
      }
      if (has(t, 'hidden') === false && u.side === 'party' && has(u, 'hidden')) u.status.delete('hidden');
      await pause(0.12);
      continue;
    }
    anyHit = true;
    let critChance = 5 + (info.flank ? 5 : 0) + (perk(u, 'reaper') ? 5 : 0);
    if (has(u, 'hidden')) critChance += 15;
    const crit = rnd() * 100 < critChance;
    const [a, b] = o.ability?.dmg ?? w?.dmg ?? [1, 3];
    let n = roll(a, b) + (o.bonusDmg ?? 0) + levelBonus(u);
    if (melee) n += Math.floor(u.attr.body / 2) + (perk(u, 'brawler') ? 2 : 0);
    if (has(t, 'marked') && CB.units.some((x) => x.side === u.side && perk(x, 'hunter'))) n += 2;
    if (o.mult) n = Math.round(n * o.mult);
    if (crit) n *= 2;
    const dtype: DType = o.ability?.dtype ?? w?.dtype ?? 'kinetic';
    await damage(t, n, dtype, u, crit);
    if (dtype === 'shock') await arcShock(t, Math.ceil(n / 2), u);
    const st = o.ability?.status ?? w?.status;
    if (st && alive(t) && rnd() < (st.chance ?? 1) * (perk(u, 'shock_fist') && st.id === 'stunned' ? 1.6 : 1)) applyStatus(t, st.id, st.turns);
    if (w?.knock && alive(t)) await push(t, Math.sign(t.x - u.x), Math.sign(t.y - u.y), w.knock, u);
    await pause(0.1);
  }
  u.status.delete('hidden');
  u.status.delete('rallied');
  return anyHit;
}

function gunSfx(w: ItemDef | null): string {
  if (!w) return 'melee';
  if (w.id === 'smg') return 'smg';
  if (w.id === 'shotgun') return 'shotgun';
  if (w.id === 'rifle') return 'rifle';
  if (w.dtype === 'shock') return 'shock';
  return 'pistol';
}

async function lungeAnim(u: Unit, t: Unit) {
  sfx('melee', { pitch: 0.9 + rnd() * 0.2 });
  const a = u.actor;
  if (!a || CB.sim) return;
  const dx = Math.sign(t.x - u.x) * 3, dy = Math.sign(t.y - u.y) * 3;
  a.px += dx; a.py += dy;
  await wait(0.07);
  a.px -= dx; a.py -= dy;
}

function guardOf(t: Unit): Unit | null {
  if (!has(t, 'guarded') || !t.guardedBy) return null;
  const g = CB.units.find((u) => u.id === t.guardedBy);
  if (!g || !alive(g) || dist(g, t) > 2) return null;
  return g;
}

/** Shock on a wet unit arcs to every wet unit within 2 tiles for half damage. */
async function arcShock(t: Unit, n: number, src: Unit) {
  if (!isWet(t.x, t.y)) return;
  for (const o of standing()) {
    if (o === t || o === src || dist(o, t) > 2 || !isWet(o.x, o.y)) continue;
    sparks(o.x * T + 5, o.y * T + 5, 6, C.cyan4, 30);
    await damage(o, n, 'shock', src);
    CB.stats.env++;
  }
}

export function applyStatus(t: Unit, id: string, turns: number) {
  if (!alive(t)) return;
  if (id === 'stunned' && t.boss && rnd() < 0.5) { float(t, 'RESISTS', C.gray); return; }
  if (id === 'burning' && has(t, 'wet')) return;
  addStatus(t, id, turns);
  float(t, (STATUSES[id]?.name ?? id).toUpperCase(), STATUSES[id]?.good ? C.grn3 : C.mag3);
}

// ---------- shove, push, fall ----------

export async function push(t: Unit, dx: number, dy: number, n: number, src: Unit | null): Promise<void> {
  if (t.member?.perks.includes('heavy')) return;
  for (let i = 0; i < n; i++) {
    const nx = t.x + dx, ny = t.y + dy;
    const m = WORLD.map!;
    const c = cellAt(m, nx, ny);
    if (c.tile.water === 'deep' || (c.tile.ch === ' ' && WORLD.def?.below)) {
      setPos(t, nx, ny);
      await glide(t, 10);
      sfx('splash');
      CB.stats.env++;
      if (c.tile.ch === ' ') { float(t, 'FELL', C.mag3); await damage(t, 99, 'kinetic', src); return; }
      if (t.machine && !t.flying && !t.member) { float(t, 'SANK', C.cyan3); await damage(t, 999, 'kinetic', src); return; }
      t.swimming = 1;
      addStatus(t, 'wet', 3);
      float(t, 'SPLASH', C.cyan3);
      return;
    }
    const blocker = unitAt(nx, ny);
    if (!walkable(nx, ny) || (blocker && alive(blocker))) {
      float(t, 'BUMP', C.pale);
      await damage(t, 2 + (src ? Math.floor(src.attr.body / 3) : 0), 'kinetic', src);
      if (blocker && alive(blocker)) await damage(blocker, 2, 'kinetic', src);
      return;
    }
    const drop = elevAt(t.x, t.y) - elevAt(nx, ny);
    setPos(t, nx, ny);
    await glide(t, 10);
    if (drop >= 1) {
      CB.stats.env++;
      float(t, 'FALL', C.mag3);
      sfx('fall');
      if (drop >= 2) await damage(t, 3 * drop, 'kinetic', src);
      applyStatus(t, 'prone', 1);
    }
    await enterTile(t);
    if (surfaceAt(nx, ny)?.kind === 'fire') CB.stats.env++;
  }
}

export function shoveChance(u: Unit, t: Unit): number {
  const a = u.attr.body + u.skills.athletics + (u.member?.gear.chrome.includes('gripper') ? 1 : 0);
  const d = t.attr.body + t.skills.athletics + (t.machine ? 2 : 0);
  if (t.member?.perks.includes('heavy')) return 0;
  return Math.max(10, Math.min(95, 55 + 8 * (a - d)));
}

export async function shove(u: Unit, t: Unit) {
  face(u, t);
  await lungeAnim(u, t);
  sfx('shove');
  CB.stats.actions++;
  if (rnd() * 100 >= shoveChance(u, t)) { float(t, 'HOLDS', C.gray); return; }
  const n = u.attr.body >= 6 || u.member?.gear.chrome.includes('gripper') ? 2 : 1;
  await push(t, Math.sign(t.x - u.x), Math.sign(t.y - u.y), n, u);
}

export function jumpRange(u: Unit): number { return 2 + Math.floor(u.skills.athletics / 2) + (u.member?.gear.chrome.includes('legs') ? 1 : 0); }

export function canJumpTo(u: Unit, x: number, y: number): boolean {
  if (!freeTile(x, y, u)) return false;
  const d = dist(u, { x, y });
  if (d < 1 || d > jumpRange(u)) return false;
  if (u.x !== x && u.y !== y && d > 2) return false;
  if (elevAt(x, y) - elevAt(u.x, u.y) > 1) return false;
  return true;
}

export async function jump(u: Unit, x: number, y: number) {
  sfx('jump');
  u.moveLeft = Math.max(0, u.moveLeft - 2);
  const drop = elevAt(u.x, u.y) - elevAt(x, y);
  if (u.actor && !CB.sim) {
    const a = u.actor;
    setPos(u, x, y);
    for (let k = 0; k < 6; k++) { a.lift = [3, 5, 6, 6, 5, 3][k]; await wait(0.03); }
    await glide(u, 14);
    a.lift = 0;
  } else setPos(u, x, y);
  snap(u);
  if (drop >= 2) { await damage(u, 3 * (drop - 1), 'kinetic', null); applyStatus(u, 'prone', 1); }
  await enterTile(u);
}

// ---------- surfaces and explosions ----------

export function setSurface(x: number, y: number, kind: SurfaceKind, turns: number) {
  if (!walkable(x, y) && cellAt(WORLD.map!, x, y).tile.water !== 'deep') return;
  const k = idx(x, y);
  const cur = CB.surf.get(k);
  if (kind === 'fire' && (isWet(x, y) || (WORLD.def?.rain && !WORLD.def.inside && rnd() < 0.3))) return;
  if (kind === 'shock' && !isWet(x, y)) return;
  if (cur && cur.kind === 'oil' && kind === 'fire') turns += 1;
  CB.surf.set(k, { kind, turns });
}

export async function explode(x: number, y: number, r: number, dmg: [number, number], dtype: DType, src: Unit | null, status?: { id: string; turns: number; chance?: number }) {
  sfx('explode');
  if (!CB.sim) { WORLD.shake = 0.35; flashAt(x * T + 5, y * T + 5, 60, 1.8, dtype === 'shock' ? LIGHT.cyan : LIGHT.amber, 0.3); sparks(x * T + 5, y * T + 5, 26, dtype === 'shock' ? C.cyan4 : C.amb4, 70); }
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = x + dx, ty = y + dy;
    if (dtype === 'fire') setSurface(tx, ty, 'fire', 2);
    if (dtype === 'shock') setSurface(tx, ty, 'shock', 2);
    const u = unitAt(tx, ty);
    if (u && alive(u)) {
      await damage(u, roll(dmg[0], dmg[1]), dtype, src);
      if (status && alive(u) && rnd() < (status.chance ?? 1)) applyStatus(u, status.id, status.turns);
    }
    const p = propAt(tx, ty);
    if (p && p.def.explode && !p.broken && (dx || dy)) { p.broken = true; rebuildGrids(); CB.stats.env++; await explode(p.x, p.y, 1, [6, 10], 'fire', src); }
  }
  await pause(0.2);
}

/** Shooting a prop: lamps go dark, fuel drums explode, signs break. */
export async function shootProp(u: Unit, p: PropInst) {
  tracer(u, p, C.amb4);
  sfx(gunSfx(u.ranged));
  CB.stats.env++;
  if (p.def.explode) { p.broken = true; rebuildGrids(); await explode(p.x, p.y, 1, [6, 10], 'fire', u); return; }
  if (p.def.light) { WORLD.dark.add(p.id); sparks(p.x * T + 5, p.y * T - 4, 10, C.amb4, 40); float(p, 'DARK', C.slate); sfx('shock'); return; }
  p.hp -= 6;
  if (p.hp <= 0) { p.broken = true; rebuildGrids(); sparks(p.x * T + 5, p.y * T + 5, 10, C.gray, 30); }
}

// ---------- waking ----------

export async function wakeProp(p: PropInst, by: Unit, feeling: Feeling, turns: number): Promise<Unit | null> {
  if (p.broken || p.wake) return null;
  if (!CB.sim) {
    const [sx, sy] = [by.x * T + 5, by.y * T + 3];
    const [tx, ty] = [p.x * T + 5, p.y * T + 3];
    for (let k = 0; k <= 10; k++) {
      const f = k / 10;
      CB.sparks.push({ x: sx + (tx - sx) * f, y: sy + (ty - sy) * f - Math.sin(f * Math.PI) * 10, vx: 0, vy: 0, t: 0.25, color: C.red2, glow: true });
      await wait(0.02);
    }
    sparks(tx, ty, 10, C.red2, 25);
  }
  sfx('wake');
  p.wake = { feeling, turns, by: by.id };
  const u = unitFromProp(p, by, feeling, turns);
  CB.units.push(u);
  const i = CB.order.indexOf(by);
  CB.order.splice(i + 1, 0, u);
  float(p, feeling.toUpperCase(), feeling === 'anger' ? C.mag3 : feeling === 'fear' ? C.vio3 : feeling === 'calm' ? C.cyan3 : feeling === 'joy' ? C.amb3 : C.steel3);
  CB.stats.env++;
  if (feeling === 'grief') {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) setSurface(p.x + dx, p.y + dy, p.def.kind === 'car' || p.def.kind === 'forklift' ? 'oil' : 'water', 3);
  }
  return u;
}

export function endWake(u: Unit) {
  if (u.prop) { u.prop.wake = null; }
  u.dead = true;
  CB.order = CB.order.filter((x) => x !== u);
}

export async function hush(t: Unit, src: Unit) {
  sfx('hush');
  tracer(src, t, C.steel4);
  if (t.prop && t.wake) { t.prop.hushed = 3; float(t, 'HUSHED', C.steel4); endWake(t); return; }
  if (t.member?.id === 'courtesy' || t.wake) { addStatus(t, 'hushed', 2); float(t, 'HUSHED', C.steel4); if (t.actor) t.actor.tint = C.steel3; return; }
  float(t, 'NO EFFECT', C.gray);
}

// ---------- abilities ----------

export function canUse(u: Unit, id: string): boolean {
  const a = ABILITY.get(id);
  if (!a) return false;
  if (a.cost === 'action' && !u.action && u.extraActions <= 0) return false;
  if (a.cost === 'bonus' && !u.bonus) return false;
  if (a.ram && u.ram < ramCost(u, a)) return false;
  if (a.blood && u.hp <= bloodCost(u, a)) return false;
  if (a.uses) {
    const used = a.uses.per === 'fight' ? u.spentFight[id] ?? 0 : u.member?.spent[id] ?? u.spentFight[id] ?? 0;
    let n = a.uses.n;
    if (u.member) {
      if (id === 'adrenal' && perk(u, 'second_wind')) n = 2;
      if (id === 'turret' && perk(u, 'twin_turret')) n = 2;
      if (id === 'rally' && perk(u, 'inspire')) n = 3;
      if (id === 'remaincalm' && perk(u, 'calm_voice')) n = 2;
      if (id === 'redrain' && perk(u, 'storm_blood')) n = 2;
      if (id === 'overcharge' && perk(u, 'overdrive')) n = 99;
    }
    if (used >= n) return false;
  }
  if (['tag', 'patch', 'smoke', 'overcharge', 'shockfield', 'kamikaze'].includes(id) && u.droneHp <= 0) return false;
  if (has(u, 'hushed')) return false;
  if (id === 'help') return CB.units.some((o) => o.downed && !o.dead && o.side === u.side && dist(o, u) === 1);
  if (id === 'hide') return !foesOf(u).some((e) => los(e, u) && dist(e, u) <= 8);
  if (id === 'call') return CB.units.some((o) => o.member?.id === 'courtesy' && alive(o));
  return true;
}

export function ramCost(u: Unit, a: AbilityDef): number { return a.id === 'shortcircuit' && perk(u, 'backdoor') ? 1 : a.ram ?? 0; }
export function bloodCost(u: Unit, a: AbilityDef): number { return Math.max(1, (a.blood ?? 0) - (perk(u, 'thick_blood') ? 1 : 0)); }

export function spend(u: Unit, a: AbilityDef) {
  if (a.cost === 'action') { if (u.action) u.action = false; else u.extraActions--; }
  if (a.cost === 'bonus') u.bonus = false;
  if (a.cost === 'reaction') u.reaction = false;
  if (a.ram) u.ram -= ramCost(u, a);
  if (a.uses) {
    if (a.uses.per === 'fight' || !u.member) u.spentFight[a.id] = (u.spentFight[a.id] ?? 0) + 1;
    else u.member.spent[a.id] = (u.member.spent[a.id] ?? 0) + 1;
  }
}

/** Valid target check for an ability at a tile. */
export function validTarget(u: Unit, a: AbilityDef, x: number, y: number): boolean {
  const d = dist(u, { x, y });
  const t = unitAt(x, y);
  const p = propAt(x, y);
  if (a.id === 'attack') {
    if (!t || !alive(t) || !hostile(u, t)) return !!p && !p.broken && !!(p.def.light || p.def.explode) && !!u.ranged && d <= rangeOf(u.ranged) + 3 && los(u, p);
    const w = weaponFor(u, t);
    if (isMelee(w)) return dist(u, t) <= (w?.reach ?? 1) && cheb(u, t) <= (w?.reach ?? 1);
    return los(u, t);
  }
  if (a.target === 'self') return x === u.x && y === u.y;
  const range = a.id === 'cheapshot' ? (u.ranged ? rangeOf(u.ranged) + 2 : 1) : a.range;
  if (d > range) return false;
  switch (a.target) {
    case 'enemy': {
      if (!t || !alive(t) || !hostile(u, t)) return false;
      if (a.chromeOnly && !t.chrome) return false;
      if (a.id === 'fasttalk' || a.id === 'turncoat') if (t.machine) return false;
      if (a.network) return true;
      if (a.range === 1) return dist(u, t) === 1;
      return los(u, t);
    }
    case 'ally': return !!t && alive(t) && !hostile(u, t) && (a.id === 'guard' ? t !== u : true);
    case 'downed': return !!t && t.downed && !t.dead && !hostile(u, t) && d <= 1;
    case 'unit': return !!t && alive(t) && t !== u && (a.id === 'shove' ? d === 1 && !t.prop : true) && (a.id !== 'hushthrow' || !!t.wake || t.member?.id === 'courtesy');
    case 'prop': {
      if (!p || p.broken) return false;
      if (a.id === 'hijack') return !!p.def.networked && !!p.def.wake;
      return !!p.def.wake && !p.wake && p.def.wake !== 'none';
    }
    case 'tile': {
      if (a.id === 'jump') return canJumpTo(u, x, y);
      if (a.id === 'turret') return freeTile(x, y) && d <= 2;
      if (a.id === 'blur') return freeTile(x, y) && los(u, { x, y });
      return true;
    }
  }
  return false;
}

/** The tiles an ability affects when aimed at x, y. */
export function areaOf(u: Unit, a: AbilityDef, x: number, y: number): [number, number][] {
  const r = a.id === 'splash' && perk(u, 'wild') ? 2 : a.area ?? 0;
  const cx = a.target === 'self' ? u.x : x, cy = a.target === 'self' ? u.y : y;
  const out: [number, number][] = [];
  if (a.id === 'blur') return lineTiles(u.x, u.y, x, y);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (a.target === 'self' && r >= 2 && Math.abs(dx) + Math.abs(dy) > r) continue;
    out.push([cx + dx, cy + dy]);
  }
  return out;
}

export function wakeTurns(u: Unit): number {
  let n = 3;
  if (u.abilities.includes('longwake')) n += 2;
  if (perk(u, 'deep_cut')) n += 1;
  if (perk(u, 'saint_blood')) n = 99;
  return n;
}

export async function useAbility(u: Unit, id: string, x: number, y: number): Promise<void> {
  const a = ABILITY.get(id)!;
  const t = unitAt(x, y);
  const p = propAt(x, y);
  if (u.side === 'party' && u.member) CB.stats.actions++;
  if (a.blood) { const c = bloodCost(u, a); u.hp -= c; float(u, `-${c}`, C.red2); sparks(u.x * T + 5, u.y * T + 5, 5, C.red2, 18); }
  spend(u, a);
  if (u.actor) face(u, { x, y });
  switch (id) {
    case 'attack': {
      if (u.side === 'party' && u.member) CB.stats.actions--;
      if (t && hostile(u, t)) await attack(u, t, weaponFor(u, t));
      else if (p) await shootProp(u, p);
      return;
    }
    case 'shove': if (t) await shove(u, t); return;
    case 'jump': await jump(u, x, y); return;
    case 'dash': u.moveLeft += u.move; float(u, 'DASH', C.pale); return;
    case 'help': if (t) { t.downed = false; t.hp = Math.max(1, Math.round(t.maxHp * 0.25)); if (t.member) t.member.hp = t.hp; if (t.actor) t.actor.tint = undefined; float(t, 'UP', C.grn3); sfx('heal'); } return;
    case 'overwatch': addStatus(u, 'overwatch', 1); float(u, 'OVERWATCH', C.amb3); return;
    case 'hide': addStatus(u, 'hidden', 2); float(u, 'HIDDEN', C.vio3); return;
    case 'lunge': {
      const path = lineTiles(u.x, u.y, x, y).slice(0, -1);
      const ok = path.every(([px, py]) => freeTile(px, py, u));
      if (ok && path.length) await moveAlong(u, path, true);
      if (t && dist(u, t) === 1) await attack(u, t, u.melee, { ability: a, bonusDmg: 1 });
      return;
    }
    case 'adrenal': { const h = Math.round(u.maxHp / 3); heal(u, h); return; }
    case 'overclock': u.extraActions++; float(u, 'OVERCLOCK', C.amb3); return;
    case 'cleave': {
      for (const e of foesOf(u)) if (cheb(e, u) === 1) { await attack(u, e, u.melee, { ability: a }); if (perk(u, 'whirlwind') && alive(e)) await push(e, Math.sign(e.x - u.x), Math.sign(e.y - u.y), 1, u); }
      return;
    }
    case 'execute': if (t) await attack(u, t, u.melee, { ability: a, mult: t.hp < t.maxHp / 3 ? 2 : 1 }); return;
    case 'blur': {
      const path = lineTiles(u.x, u.y, x, y).filter(([px, py]) => walkable(px, py));
      const hitSet = new Set<Unit>();
      for (const step of path) {
        if (!freeTile(step[0], step[1], u)) continue;
        await moveAlong(u, [step], true);
        for (const e of foesOf(u)) if (cheb(e, u) === 1 && !hitSet.has(e)) { hitSet.add(e); await attack(u, e, u.melee, { ability: a }); }
      }
      return;
    }
    case 'shortcircuit': case 'cascade': {
      if (!t) return;
      const hits = [t];
      const extra = id === 'cascade' ? (perk(u, 'storm') ? 5 : 3) : perk(u, 'daisy') ? 1 : 0;
      let last = t;
      for (let i = 0; i < extra; i++) {
        const next = foesOf(u).filter((e) => e.chrome && !hits.includes(e) && dist(e, last) <= 4).sort((p1, p2) => dist(p1, last) - dist(p2, last))[0];
        if (!next) break;
        hits.push(next);
        last = next;
      }
      sfx('hack');
      for (const h of hits) { tracer(u, h, C.cyan3); sparks(h.x * T + 5, h.y * T + 4, 8, C.cyan4, 30); await damage(h, roll(a.dmg![0], a.dmg![1]) + levelBonus(u), 'shock', u); await pause(0.08); }
      return;
    }
    case 'blind': case 'cripple': case 'fasttalk': case 'taunt': case 'turncoat': {
      if (!t) return;
      sfx(id === 'fasttalk' || id === 'taunt' || id === 'turncoat' ? 'talk' : 'hack');
      if (resisted(u, t, a)) { float(t, 'RESISTS', C.gray); return; }
      let turns = a.status!.turns;
      if (id === 'fasttalk' && perk(u, 'liar')) turns = 2;
      if (id === 'turncoat' && perk(u, 'kingmaker')) turns += 2;
      applyStatus(t, a.status!.id, turns);
      if (id === 'taunt') { t.taunter = u.id; if (perk(u, 'menace')) for (const e of foesOf(u)) if (e !== t && dist(e, t) === 1 && !resisted(u, e, a)) { applyStatus(e, 'taunted', 1); e.taunter = u.id; } }
      if (id === 'blind' && perk(u, 'feedback')) await damage(t, 3, 'hack', u);
      if (id === 'fasttalk' && perk(u, 'crowd')) for (const e of foesOf(u)) if (e !== t && dist(e, t) === 1 && !e.machine && !resisted(u, e, a)) applyStatus(e, 'stunned', 1);
      if (id === 'cripple') t.moveLeft = 0;
      return;
    }
    case 'ping': {
      sfx('hack');
      for (const e of foesOf(u)) if (dist(e, u) <= 10) { e.status.delete('hidden'); applyStatus(e, 'marked', 1); }
      return;
    }
    case 'hijack': {
      if (!p) return;
      sfx('hack');
      const w = await wakeProp(p, u, 'calm', perk(u, 'deep_dive') ? 5 : 3);
      if (w) { w.name = `hijacked ${p.def.name}`; w.side = u.side; }
      return;
    }
    case 'overheat': if (t) { sfx('fire'); await damage(t, roll(3, 5), 'fire', u); applyStatus(t, 'burning', 3); } return;
    case 'tag': if (t) { tracer(u, t, C.mag3); applyStatus(t, 'marked', 3); if (perk(u, 'spotter')) t.status.delete('hidden'); } return;
    case 'patch': if (t) { const h = roll(6, 9) + (perk(u, 'medic') ? 4 : 0); if (t.downed && perk(u, 'field_medic')) { t.downed = false; if (t.actor) t.actor.tint = undefined; } heal(t, h); } return;
    case 'smoke': sfx('smoke'); for (const [sx, sy] of areaOf(u, a, x, y)) setSurface(sx, sy, 'smoke', 2); return;
    case 'turret': summonTurret(u, x, y); return;
    case 'overcharge': u.spentFight.droneExtra = (u.spentFight.droneExtra ?? 0) + 1; float(u, 'OVERCHARGE', C.amb3); return;
    case 'shockfield': {
      sfx('shock');
      for (const [sx, sy] of areaOf(u, a, x, y)) {
        setSurface(sx, sy, 'shock', 2);
        const o = unitAt(sx, sy);
        if (o && alive(o) && hostile(u, o)) await damage(o, roll(4, 7), 'shock', u);
      }
      return;
    }
    case 'kamikaze': u.droneHp = 0; await explode(x, y, 2, [10, 16], 'fire', u); return;
    case 'rally': if (t) { heal(t, roll(4, 6)); applyStatus(t, 'rallied', 2); if (t.member?.cls === 'witch') setMood(t, 'joy'); } return;
    case 'cheapshot': if (t) await attack(u, t, weaponFor(u, t), { ability: a, mult: has(t, 'stunned') || has(t, 'taunted') || has(t, 'distracted') ? 1.5 : 1 }); return;
    case 'demoralize': {
      sfx('talk');
      for (const e of foesOf(u)) if (dist(e, u) <= 3 && !resisted(u, e, a)) applyStatus(e, 'distracted', 2);
      return;
    }
    case 'speech': for (const f of [u, ...friendsOf(u)]) if (f.member) { f.bonus = true; heal(f, 6 + (perk(u, 'saint') ? 10 : 0)); } return;
    case 'guard': if (t) { applyStatus(t, 'guarded', 1); t.guardedBy = u.id; if (perk(u, 'wall')) for (const f of friendsOf(u)) if (dist(f, u) === 1) { applyStatus(f, 'guarded', 1); f.guardedBy = u.id; } } if (perk(u, 'guardian')) u.bonus = true; return;
    case 'taser': if (t) await attack(u, t, u.melee, { ability: a }); return;
    case 'remaincalm': {
      sfx('pa');
      for (const e of foesOf(u)) if (dist(e, u) <= 3 && !resisted(u, e, a)) { applyStatus(e, 'taunted', 1); e.taunter = u.id; }
      if (perk(u, 'shepherd')) for (const f of friendsOf(u)) if (dist(f, u) <= 3) heal(f, 4);
      return;
    }
    case 'charge': {
      if (!t) return;
      const path = lineTiles(u.x, u.y, x, y).slice(0, -1);
      if (path.every(([px, py]) => freeTile(px, py, u)) && path.length) await moveAlong(u, path, true);
      if (dist(u, t) === 1 && await attack(u, t, u.melee, { ability: a }) && alive(t)) await push(t, Math.sign(t.x - u.x), Math.sign(t.y - u.y), perk(u, 'heavy') ? 3 : 2, u);
      return;
    }
    case 'foam': sfx('foam'); for (const [sx, sy] of areaOf(u, a, x, y)) { setSurface(sx, sy, 'foam', 1); const o = unitAt(sx, sy); if (o && alive(o) && hostile(u, o)) applyStatus(o, 'immobile', 1); } return;
    case 'bulwark': applyStatus(u, 'bulwark', perk(u, 'fortress_unit') ? 2 : 1); return;
    case 'lockdown': for (const e of foesOf(u)) if (dist(e, u) <= 2) applyStatus(e, 'stunned', 1); return;
    case 'wake': if (p) { const w = await wakeProp(p, u, u.mood ?? 'calm', wakeTurns(u)); if (w && u.spentFight.heartfelt) { w.wake!.twice = true; w.wake!.turns = 99; u.spentFight.heartfelt = 0; } } return;
    case 'steady': setMood(u, 'calm'); return;
    case 'splash': case 'redrain': {
      for (const [sx, sy] of areaOf(u, a, x, y)) {
        const q = propAt(sx, sy);
        if (q && q.def.wake && !q.wake && !q.broken) await wakeProp(q, u, u.mood ?? 'calm', id === 'splash' ? 2 + (u.abilities.includes('longwake') ? 2 : 0) : wakeTurns(u));
      }
      return;
    }
    case 'rouse': if (t) await rouse(u, t); return;
    case 'heartfelt': u.spentFight.heartfelt = 1; float(u, 'HEARTFELT', C.red2); return;
    case 'secondhands': u.extraActions++; G.port.hold += 1; float(u, G.port.name.toUpperCase(), C.cyan4); sfx('port'); return;
    case 'call': { const c = CB.units.find((o) => o.member?.id === 'courtesy'); if (c) { c.action = true; c.extraActions++; float(c, 'CALLED', C.cyan4); G.port.hold += 1; sfx('port'); } return; }
    case 'hushthrow': if (t) await hush(t, u); return;
    case 'redvial': if (p) await wakeProp(p, u, 'anger', 3); return;
    case 'heal': if (t) heal(t, roll(8, 12)); return;
    case 'tea': heal(u, roll(14, 20)); float(u, 'TEA', C.amb3); return;
    case 'enemyhack': if (t) { sfx('hack'); tracer(u, t, C.cyan3); await damage(t, roll(3, 6), 'shock', u); } return;
    case 'bite': if (t) await attack(u, t, u.melee, { ability: a }); return;
    case 'grenade': await explode(x, y, 1, a.dmg ?? [5, 8], 'kinetic', u); return;
    default: return;
  }
}

function resisted(u: Unit, t: Unit, a: AbilityDef): boolean {
  if (!a.resist || perk(u, 'no_trace')) return false;
  const atk = (a.cls === 'diver' ? u.attr.wits + u.skills.hack : u.attr.nerve + u.skills.talk);
  const def = t.attr[a.resist] + (t.boss ? 3 : 0);
  const chance = Math.max(10, Math.min(90, 70 + 6 * (atk - def)));
  return rnd() * 100 >= chance;
}

/** Tova wakes an enemy's chrome. What the chrome does depends on her mood. */
async function rouse(u: Unit, t: Unit) {
  sfx('wake');
  sparks(t.x * T + 5, t.y * T + 5, 10, C.red2, 25);
  const a = ABILITY.get('rouse')!;
  if (resisted(u, t, a)) { float(t, 'RESISTS', C.gray); return; }
  const m = u.mood ?? 'calm';
  CB.stats.env++;
  if (m === 'anger') { float(t, 'ARM TURNS', C.mag3); await attack(t, t, t.melee, { forceHit: true }); }
  else if (m === 'fear') { float(t, 'DROPS GUN', C.vio3); t.ranged = null; applyStatus(t, 'distracted', 1); }
  else if (m === 'calm') { applyStatus(t, 'turncoat', 1); }
  else if (m === 'joy') { applyStatus(t, 'stunned', 1); float(t, 'DANCES', C.amb3); }
  else if (m === 'grief') { applyStatus(t, 'slowed', 2); applyStatus(t, 'distracted', 2); setSurface(t.x, t.y, 'water', 2); }
}

export function heal(t: Unit, n: number) {
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + n);
  if (t.member) t.member.hp = t.hp;
  float(t, `+${t.hp - before}`, C.grn3);
  sfx('heal');
}

function summonTurret(u: Unit, x: number, y: number) {
  const hp = perk(u, 'fortress') ? 45 : 15;
  const t: Unit = {
    id: `turret_${u.id}_${CB.round}_${x}_${y}`, name: 'Turret', side: u.side, actor: {
      id: 'turret', name: 'Turret', sheet: TURRET_SHEET(), tx: x, ty: y, px: x * T, py: y * T, dir: 'down', anim: 0, moving: false, path: [], speed: 0, role: 'ally', idle: 0, visible: true, lift: 0, alert: 0,
    }, prop: null, member: null, kind: 'turret', level: u.level, hp, maxHp: hp, def: 3, move: 0, init: 0,
    attr: { body: 3, reflex: 3, wits: 1, nerve: 9 }, skills: { shoot: 2 + Math.floor(u.level / 3), strike: 0, hack: 0, tech: 0, sneak: 0, talk: 0, notice: 0, athletics: 0 },
    melee: null, ranged: ITEM.get('pistol')!, plating: 2, machine: true, chrome: true, flying: false, abilities: [], ai: 'turret', boss: false, xp: 0,
    status: new Map(), moveLeft: 0, action: true, bonus: true, reaction: true, extraActions: 0, ram: 0, ramMax: 0, spentFight: {}, downed: false, dead: false,
    droneHp: 0, droneMax: 0, swimming: 0, phase: 0, x, y, owner: u.id,
  };
  WORLD.actors.push(t.actor!);
  CB.units.push(t);
  CB.order.splice(CB.order.indexOf(u) + 1, 0, t);
  sfx('turret');
}

let turretSheet: ReturnType<typeof import('../art/cast').sheetFor> | null = null;
import { sheetFor } from '../art/cast';
function TURRET_SHEET() { if (!turretSheet) turretSheet = sheetFor('turret'); return turretSheet; }

// ---------- turn start and end ----------

/** Runs status effects at the start of a unit's turn. Returns false if the unit cannot act. */
export async function startTurn(u: Unit): Promise<boolean> {
  u.action = true;
  u.bonus = true;
  u.reaction = true;
  u.moveLeft = u.move;
  if (has(u, 'prone')) { u.moveLeft = Math.ceil(u.move / 2); }
  if (has(u, 'slowed')) u.moveLeft = Math.ceil(u.moveLeft / 2);
  if (has(u, 'immobile') || has(u, 'crippled')) u.moveLeft = 0;
  if (u.ramMax) u.ram = Math.min(u.ramMax + (perk(u, 'root') ? 4 : 0), u.ram + 2 + (perk(u, 'fast_ram') ? 1 : 0));
  if (perk(u, 'repair')) heal(u, 3);
  if (u.swimming > 0) { u.swimming = 0; u.action = false; u.moveLeft = 0; await climbOut(u); return false; }
  if (has(u, 'burning')) { await damage(u, 3, 'fire', null); if (!alive(u)) return false; }
  const s = surfaceAt(u.x, u.y);
  if (s?.kind === 'fire') { await damage(u, 3, 'fire', null); addStatus(u, 'burning', 1); }
  if (s?.kind === 'shock') await damage(u, 4, 'shock', null);
  if (!alive(u)) return false;
  for (const e of standing()) if (e.wake?.feeling === 'joy' && hostile(e, u) && dist(e, u) <= 1) addStatus(u, 'distracted', 1);
  if (has(u, 'stunned')) { u.action = false; u.extraActions = 0; float(u, 'STUNNED', C.mag3); }
  if (has(u, 'hushed')) { u.action = false; u.bonus = false; u.moveLeft = 0; }
  return true;
}

async function climbOut(u: Unit) {
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const nx = u.x + dx, ny = u.y + dy;
    if (freeTile(nx, ny, u) && stepOk(nx, ny, nx, ny)) { setPos(u, nx, ny); await glide(u, 6); float(u, 'CLIMBS OUT', C.cyan3); return; }
  }
}

/** Ticks statuses down and lets the unit's woken objects and drone act. */
export async function endTurn(u: Unit) {
  for (const [k, v] of [...u.status]) { if (v <= 1) u.status.delete(k); else u.status.set(k, v - 1); }
  if (!has(u, 'taunted')) u.taunter = undefined;
  if (!has(u, 'hushed') && u.actor && u.member?.id === 'courtesy' && !u.downed) u.actor.tint = undefined;
  if (u.extraActions > 0) u.extraActions = 0;
  if (u.member) u.member.hp = Math.max(0, u.hp);
  if (u.wake) {
    u.wake.turns--;
    if (u.wake.turns <= 0) { float(u, 'STILL', C.gray); endWake(u); }
  }
}

/** Surfaces fade at the end of each round. */
export function tickSurfaces() {
  for (const [k, s] of [...CB.surf]) {
    s.turns--;
    if (s.turns <= 0) CB.surf.delete(k);
    else if (s.kind === 'fire') {
      const m = WORLD.map!;
      const x = k % m.w, y = Math.floor(k / m.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = CB.surf.get(idx(x + dx, y + dy));
        if (o?.kind === 'oil') CB.surf.set(idx(x + dx, y + dy), { kind: 'fire', turns: 2 });
      }
    }
  }
}

/** A rigger's drone shoots at the end of the rigger's turn. */
export async function droneAct(u: Unit) {
  if (u.droneHp <= 0 || u.downed) return;
  const n = 1 + (perk(u, 'swarm') ? 1 : 0) + (u.spentFight.droneExtra ?? 0);
  u.spentFight.droneExtra = 0;
  for (let k = 0; k < n; k++) {
    const targets = foesOf(u).filter((e) => dist(e, u) <= 7 && los(u, e)).sort((a, b) => (has(b, 'marked') ? 1 : 0) - (has(a, 'marked') ? 1 : 0) || a.hp - b.hp);
    const t = targets[0];
    if (!t) return;
    sfx('drone');
    tracer(u, t, C.mag3);
    const chance = perk(u, 'ace') ? 100 : Math.max(20, 60 + 5 * (u.skills.tech - t.def) + (has(t, 'marked') ? 15 : 0));
    if (rnd() * 100 < chance) await damage(t, roll(2, 4) + (perk(u, 'scrapper') ? 2 : 0), 'kinetic', u);
    else float(t, 'MISS', C.gray);
    await pause(0.12);
  }
}

export { ITEM };
export type { Feeling };
