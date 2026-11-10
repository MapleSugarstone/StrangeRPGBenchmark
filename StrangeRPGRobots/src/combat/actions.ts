// Everything a unit can do in a fight, with its animation: moving, attacking, abilities, items, shoves,
// jumps, wakes, explosions, and what happens at the start and end of each turn.
import { CB, roll, rnd, dist, cheb, unitAt, standing, foesOf, friendsOf, los, hitInfo, weaponFor, isMelee, rangeOf, difficultyDamage, idx, isWet, freeTile, surfaceAt, wallAt, frostAt, type SurfaceKind } from './core';
import { type Unit, has, addStatus, alive, hostile, perk, unitFromProp, unitFromEnemy, canReact, isNet } from './unit';
import { ABILITY, ENEMY, ITEM, STATUSES, type AbilityDef, type ItemDef, type Feeling, type DType, type Attr } from '../rules/data';
import { maxUses, modDmg } from '../rules/stats';
import { WORLD, walkable, elevAt, propAt, rebuildGrids, type PropInst, type Actor } from '../world/world';
import { cellAt } from '../world/map';
import { lineTiles, stepOk } from '../world/path';
import { T } from '../world/tiles';
import { C, LIGHT } from '../engine/palette';
import { wait } from '../game/sched';
import { G } from '../game/state';
import { sfx, combatEvent } from '../audio/sfx';

export function pause(s: number): Promise<void> { return CB.sim ? Promise.resolve() : wait(s); }

/** Set by ai.ts, which imports this file, so Heartbeat can run a woken object's turn. */
export const HOOKS = { wokenTurn: null as null | ((u: Unit) => Promise<void>) };

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

/** Bonus damage from perks for hacks: network abilities and hack damage. */
export function hackBonus(u: Unit): number { return modDmg(u.mod, 'hack'); }

// ---------- damage ----------

/** The hero and the port stand side by side and the port has One Body. */
function oneBody(x: Unit): boolean {
  if (x.member?.id !== 'hero' && x.member?.cls !== 'port') return false;
  const port = CB.units.find((o) => o.member?.cls === 'port' && alive(o) && perk(o, 'one_body'));
  const hero = CB.units.find((o) => o.member?.id === 'hero' && alive(o));
  return !!port && !!hero && dist(port, hero) === 1;
}

function wakerOf(u: Unit): Unit | undefined { return u.wake ? CB.units.find((o) => o.id === u.wake!.by) : undefined; }

export async function damage(t: Unit, n: number, type: DType, src: Unit | null, crit = false): Promise<number> {
  if (!alive(t)) return 0;
  t.dormant = false;
  let d = n;
  if (src) d = difficultyDamage(src, d);
  if (type === 'kinetic') d -= t.plating;
  if (type === 'shock' && isWet(t.x, t.y)) d = Math.round(d * 1.5);
  if (type === 'shock' && t.machine) d += 2;
  if (src?.side === 'enemy' && type === 'shock' && t.side === 'party' && CB.units.some((u) => u.side === 'party' && perk(u, 'firewall'))) d = Math.ceil(d / 2);
  if (type === 'fire' && isWet(t.x, t.y)) d = Math.ceil(d / 2);
  if (src) {
    if (has(t, 'frosted') && CB.units.some((x) => alive(x) && hostile(x, t) && perk(x, 'brittle'))) d += 2;
    const waker = wakerOf(src);
    if (waker && src.wake?.feeling === 'anger' && perk(waker, 'temper')) d += 2;
    if ((src.wake || src.summoned !== undefined) && src.side === 'party' && CB.units.some((x) => x.side === 'party' && perk(x, 'siblings'))) d += 2;
    if (perk(src, 'last_stand') && src.hp < src.maxHp / 2) d += 3;
    if (oneBody(src)) d += 3;
  }
  if (has(t, 'braced')) d -= 3;
  if (perk(t, 'last_stand') && t.hp < t.maxHp / 2) d -= 2;
  if (perk(t, 'calm_center') && t.mood === 'calm') d -= 3;
  if (oneBody(t)) d -= 2;
  d = Math.max(1, d);
  if (src && d >= 5 && t.abilities.includes('numb') && canReact(t) && usesOk(t, 'numb')) {
    t.reaction = false;
    markUse(t, ABILITY.get('numb')!);
    float(t, 'NUMB', C.steel4);
    sfx('hush');
    return 0;
  }
  if (t.hp - d <= 0 && t.side === 'party' && t.member) {
    const r = CB.units.find((x) => alive(x) && x.side === 'party' && perk(x, 'lifeline') && x.droneHp > 0 && !x.spentFight.lifeline);
    if (r) { r.spentFight.lifeline = 1; float(t, 'LIFELINE', C.grn3); heal(t, 10); return 0; }
  }
  if (t.hp - d <= 0 && perk(t, 'unbroken') && !t.unbrokenUsed) { t.unbrokenUsed = true; d = t.hp - 1; float(t, 'UNBROKEN', C.amb3); }
  t.hp -= d;
  float(t, crit ? `${d}!` : `${d}`, crit ? C.amb4 : type === 'shock' ? C.cyan3 : type === 'fire' ? C.amb3 : type === 'hack' ? C.cyan4 : C.white);
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
  if (t.summoned !== undefined) { t.dead = true; CB.order = CB.order.filter((x) => x !== t); void dissipate(t); return; }
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
  if (src && perk(src, 'momentum')) src.bonus = true;
  if (t.spare) {
    // Knocked out and freed: it lies down, with no kill sound and no gas.
    CB.log.push(`${t.name} is free`);
    if (t.actor) { t.actor.tint = C.slate; t.actor.lift = -3; }
    float(t, 'FREE', C.cyan3);
    return;
  }
  CB.log.push(`${t.name} falls`);
  combatEvent('kill');
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
    const leaving = !free ? foesOf(u).filter((e) => canReact(e) && !e.dormant && dist(e, u) === 1 && isMelee(e.melee) && !e.prop) : [];
    setPos(u, x, y);
    if (!free && u.moveLeft > 0) u.moveLeft--;
    sfx('step', { vol: 0.4, pitch: 0.9 + rnd() * 0.2 });
    await glide(u, 8);
    for (const e of leaving) if (dist(e, u) > 1 && alive(e) && alive(u)) { e.reaction = false; float(e, 'FREE HIT', C.pale); await attack(e, u, e.melee, { reaction: true }); }
    await enterTile(u);
    if (!alive(u)) return;
    for (const e of foesOf(u)) {
      if (has(e, 'overwatch') && canReact(e) && e.ranged && los(e, u) && dist(e, u) <= rangeOf(e.ranged) + 2) {
        e.status.delete('overwatch');
        e.reaction = false;
        float(e, 'OVERWATCH', C.amb3);
        await attack(e, u, e.ranged, { reaction: true });
        if (!alive(u)) return;
      }
      if (perk(e, 'sentinel') && canReact(e) && dist(e, u) <= 2 && CB.units.some((g) => g.guardedBy === e.id && has(g, 'guarded') && alive(g) && dist(g, u) === 1)) {
        e.reaction = false;
        float(e, 'SENTINEL', C.cyan3);
        await attack(e, u, e.melee, { reaction: true });
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
  if (s.kind === 'mine' && s.side !== u.side && !u.flying) {
    CB.surf.delete(idx(u.x, u.y));
    sfx('explode');
    sparks(u.x * T + 5, u.y * T + 5, 16, C.amb4, 50);
    CB.stats.env++;
    await damage(u, roll(6, 10), 'kinetic', null);
    applyStatus(u, 'stunned', 1);
    u.moveLeft = 0;
  }
}

// ---------- attacks ----------

export interface AttackOpts { bonusDmg?: number; mult?: number; reaction?: boolean; noCover?: boolean; ability?: AbilityDef; forceHit?: boolean }

export async function attack(u: Unit, t: Unit, w: ItemDef | null, o: AttackOpts = {}): Promise<boolean> {
  if (!alive(u) || !alive(t)) return false;
  const guard = guardOf(t);
  let mult = o.mult ?? 1;
  if (guard && guard !== u) {
    float(guard, 'GUARD', C.cyan3); t.status.delete('guarded'); t.guardedBy = undefined; t = guard; sfx('guard');
    if (perk(guard, 'bastion')) mult *= 0.5;
  } else if (t.member?.id === 'hero' && hostile(u, t)) {
    const port = CB.units.find((p) => p !== t && p.abilities.includes('holdon') && alive(p) && canReact(p) && dist(p, t) <= 3 && !hostile(p, t));
    if (port) {
      port.reaction = false;
      float(port, 'HOLD ON', C.cyan4);
      sfx('port');
      t = port;
      if (perk(port, 'strong_hold')) await damage(u, roll(4, 6) + hackBonus(port), 'hack', port);
      if (!alive(u)) return false;
    }
  }
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
    if (hit && !o.forceHit && perk(t, 'afterimage') && t.spentFight.afterimage !== CB.round) {
      t.spentFight.afterimage = CB.round;
      hit = false;
      float(t, 'AFTERIMAGE', C.vio3);
    }
    if (hit && !o.forceHit && t.abilities.includes('reflexstep') && canReact(t)) {
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
      if (melee && !o.reaction && t.abilities.includes('riposte') && canReact(t) && alive(t) && dist(t, u) === 1) {
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
    const ab = o.ability;
    const [a, b] = (ab?.weapon ? undefined : ab?.dmg) ?? w?.dmg ?? [1, 3];
    let n = roll(a, b) + (o.bonusDmg ?? 0) + levelBonus(u);
    if (melee) n += Math.floor(u.attr.body / 2) + modDmg(u.mod, 'melee');
    else n += modDmg(u.mod, 'ranged');
    if (has(t, 'marked') && CB.units.some((x) => x.side === u.side && perk(x, 'hunter'))) n += 2;
    if (mult !== 1) n = Math.round(n * mult);
    if (crit) n *= 2;
    const dtype: DType = (ab?.weapon ? undefined : ab?.dtype) ?? w?.dtype ?? 'kinetic';
    await damage(t, n, dtype, u, crit);
    if (dtype === 'shock') await arcShock(t, Math.ceil(n / 2), u);
    if (!alive(t) && t.dead && melee && perk(u, 'bloodrush') && u.spentFight.bloodrush !== CB.round) {
      u.spentFight.bloodrush = CB.round;
      u.extraActions++;
      float(u, 'BLOODRUSH', C.mag3);
    }
    const st = ab?.status ?? w?.status;
    if (st && alive(t) && rnd() < (st.chance ?? 1) * (perk(u, 'shock_fist') && st.id === 'stunned' ? 1.6 : 1)) applyStatus(t, st.id, st.turns, u);
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
  if (w.dtype === 'hack') return 'hack';
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

/** Applies a status. The source's perks may lengthen it, and a good status a unit gives itself on its own turn lasts until its next turn ends. */
export function applyStatus(t: Unit, id: string, turns: number, src?: Unit | null) {
  if (!alive(t)) return;
  if (id === 'stunned' && t.boss && rnd() < 0.5) { float(t, 'RESISTS', C.gray); return; }
  if (id === 'burning' && has(t, 'wet')) return;
  if (src) turns += src.mod.statusTurns?.[id] ?? 0;
  if (CB.cur === t && STATUSES[id]?.good) turns += 1;
  addStatus(t, id, turns);
  float(t, (STATUSES[id]?.name ?? id).toUpperCase(), STATUSES[id]?.good ? C.grn3 : C.mag3);
}

const NOT_CLEANSED = new Set(['turncoat', 'hidden', 'wet']);
function cleanse(t: Unit) { for (const k of [...t.status.keys()]) if (STATUSES[k] && !STATUSES[k].good && !NOT_CLEANSED.has(k)) t.status.delete(k); if (t.actor && !has(t, 'hushed') && !t.downed) t.actor.tint = undefined; }
function strip(t: Unit) { for (const k of [...t.status.keys()]) if (STATUSES[k]?.good) t.status.delete(k); }

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
    if (!walkable(nx, ny) || wallAt(nx, ny) || (blocker && alive(blocker))) {
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

/** Pulls a unit up to n tiles toward the puller, one tile at a time, stopping next to it. */
export async function pull(t: Unit, by: Unit, n: number) {
  for (let i = 0; i < n; i++) {
    if (!alive(t) || dist(t, by) <= 1) return;
    const dx = t.x - by.x, dy = t.y - by.y;
    const sx = Math.abs(dx) >= Math.abs(dy) ? -Math.sign(dx) : 0, sy = Math.abs(dx) >= Math.abs(dy) ? 0 : -Math.sign(dy);
    const ox = t.x, oy = t.y;
    await push(t, sx, sy, 1, by);
    if (t.x === ox && t.y === oy) return;
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
  t.dormant = false;
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
  if (cur?.kind === 'wall') return;
  if (kind === 'fire' && (isWet(x, y) || (WORLD.def?.rain && !WORLD.def.inside && rnd() < 0.3))) return;
  if (kind === 'shock' && !isWet(x, y)) return;
  if (cur && cur.kind === 'oil' && kind === 'fire') turns += 1;
  CB.surf.set(k, { kind, turns });
}

/** Frost wall on each walkable tile with nobody on it. Walls block movement and sight until they melt. */
export function raiseWall(tiles: [number, number][], turns: number) {
  let n = 0;
  for (const [x, y] of tiles) {
    if (!walkable(x, y) || unitAt(x, y) || propAt(x, y)) continue;
    CB.surf.set(idx(x, y), { kind: 'wall', turns });
    n++;
  }
  if (n) { sfx('hush'); for (const [x, y] of tiles) sparks(x * T + 5, y * T + 5, 3, C.steel4, 14, false); }
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
      if (status && alive(u) && rnd() < (status.chance ?? 1)) applyStatus(u, status.id, status.turns, src);
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
  if (perk(by, 'iron_heart')) { u.hp *= 2; u.maxHp *= 2; }
  if (perk(by, 'thunderhead')) u.wake!.twice = true;
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
  if (t.member?.id === 'courtesy' || t.wake || t.woken) { addStatus(t, 'hushed', 2); float(t, 'HUSHED', C.steel4); if (t.actor) t.actor.tint = C.steel3; return; }
  float(t, 'NO EFFECT', C.gray);
}

/** Calls an enemy kind onto a tile for the caller's side. It goes after the given number of its own turns. */
export function summonUnit(by: Unit, kind: string, x: number, y: number, turns: number): Unit | null {
  const e = ENEMY.get(kind);
  if (!e || !freeTile(x, y) || propAt(x, y)) return null;
  const id = `summon_${kind}_${CB.round}_${x}_${y}_${CB.units.length}`;
  const actor: Actor = { id, name: e.name, sheet: sheetFor(e.look), tx: x, ty: y, px: x * T, py: y * T, dir: 'down', anim: 0, moving: false, path: [], speed: 6, role: by.side === 'party' ? 'ally' : 'enemy', idle: 0, visible: true, lift: 0, alert: 0 };
  const s = unitFromEnemy(kind, actor, by.side === 'party' ? by.level : undefined);
  s.side = by.side;
  s.xp = 0;
  s.summoned = turns;
  s.owner = by.id;
  if (by.side === 'party') s.name = e.name;
  WORLD.actors.push(actor);
  CB.units.push(s);
  CB.order.splice(CB.order.indexOf(by) + 1, 0, s);
  sparks(x * T + 5, y * T + 5, 10, C.cyan4, 25);
  sfx('port');
  return s;
}

// ---------- abilities ----------

function usesOk(u: Unit, id: string): boolean {
  const a = ABILITY.get(id);
  if (!a?.uses) return true;
  const used = a.uses.per === 'fight' ? u.spentFight[id] ?? 0 : u.member?.spent[id] ?? u.spentFight[id] ?? 0;
  const n = u.member ? maxUses(u.member.perks, id) : a.uses.n;
  return used < n;
}

function markUse(u: Unit, a: AbilityDef) {
  if (!a.uses) return;
  if (a.uses.per === 'fight' || !u.member) u.spentFight[a.id] = (u.spentFight[a.id] ?? 0) + 1;
  else u.member.spent[a.id] = (u.member.spent[a.id] ?? 0) + 1;
}

const DRONE_ABILITIES = ['tag', 'patch', 'smoke', 'overcharge', 'shockfield', 'kamikaze'];

export function canUse(u: Unit, id: string): boolean {
  const a = ABILITY.get(id);
  if (!a) return false;
  if (a.net && !isNet()) return false;
  const quickWake = id === 'wake' && perk(u, 'quick_hands') && u.bonus;
  if (a.cost === 'action' && !u.action && u.extraActions <= 0 && !quickWake) return false;
  if (a.cost === 'bonus' && !u.bonus) return false;
  if (a.ram && u.ram < ramCost(u, a)) return false;
  if (a.blood && u.hp <= bloodCost(u, a)) return false;
  if (!usesOk(u, id)) return false;
  if (a.every) { const last = u.spentFight['cd_' + id]; if (last !== undefined && CB.round - last < a.every) return false; }
  if ((DRONE_ABILITIES.includes(id) || a.needsDrone) && u.droneHp <= 0) return false;
  if (has(u, 'hushed')) return false;
  if (id === 'help') return CB.units.some((o) => o.downed && !o.dead && o.side === u.side && dist(o, u) === 1);
  if (id === 'hide') return !foesOf(u).some((e) => (los(e, u) && dist(e, u) <= 8) || (perk(e, 'spotlight') && dist(e, u) === 1));
  if (id === 'call') return CB.units.some((o) => o.member?.id === 'courtesy' && alive(o));
  if (id === 'wheel') return CB.units.some((o) => o.member?.id === 'hero' && alive(o));
  if (id === 'heartbeat') return CB.units.some((o) => o.wake?.by === u.id && alive(o));
  return true;
}

export function ramCost(u: Unit, a: AbilityDef): number {
  const base = a.id === 'shortcircuit' && perk(u, 'backdoor') ? 1 : a.ram ?? 0;
  return base > 0 ? Math.max(1, base - (u.mod.ramDiscount ?? 0)) : 0;
}
export function bloodCost(u: Unit, a: AbilityDef): number { return Math.max(1, (a.blood ?? 0) - (u.mod.blood ?? 0)); }

export function spend(u: Unit, a: AbilityDef) {
  if (a.cost === 'action') {
    if (a.id === 'wake' && perk(u, 'quick_hands') && u.bonus) u.bonus = false;
    else if (u.action) u.action = false;
    else u.extraActions--;
  }
  if (a.cost === 'bonus') u.bonus = false;
  if (a.cost === 'reaction') u.reaction = false;
  if (a.ram) u.ram -= ramCost(u, a);
  markUse(u, a);
  if (a.every) u.spentFight['cd_' + a.id] = CB.round;
  if (a.hold && u.side === 'party' && u.member) G.port.hold += a.hold;
}

/** Range in tiles, with the user's weapon for weapon abilities and perk bonuses. */
export function rangeFor(u: Unit, a: AbilityDef): number {
  if (a.id === 'cheapshot') return u.ranged ? rangeOf(u.ranged) + 2 : 1;
  let r = a.range;
  if (a.weapon === 'ranged') r = u.ranged ? rangeOf(u.ranged) + 2 : 0;
  if (a.weapon === 'melee') r = u.melee?.reach ?? 1;
  return r + (u.mod.range?.[a.id] ?? 0);
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
  const range = rangeFor(u, a);
  if (d > range) return false;
  switch (a.target) {
    case 'enemy': {
      if (!t || !alive(t) || !hostile(u, t)) return false;
      if (a.chromeOnly && !t.chrome) return false;
      if (a.id === 'fasttalk' || a.id === 'turncoat') if (t.machine) return false;
      if (a.notMachine && t.machine) return false;
      if (a.wokenOnly && !t.woken && !t.wake) return false;
      if (a.weapon === 'melee' && u.melee && (u.melee.reach ?? 1) > 1) return cheb(u, t) <= (u.melee.reach ?? 1);
      if (a.network) return true;
      if (range === 1) return dist(u, t) === 1;
      return los(u, t);
    }
    case 'ally': return !!t && alive(t) && !hostile(u, t) && (a.id === 'guard' ? t !== u : true);
    case 'downed': return !!t && t.downed && !t.dead && !hostile(u, t) && d <= 1;
    case 'unit': return !!t && alive(t) && t !== u && (a.id === 'shove' ? d === 1 && !t.prop : true) && (a.id !== 'hushthrow' || !!t.wake || !!t.woken || t.member?.id === 'courtesy');
    case 'prop': {
      if (!p || p.broken) return false;
      if (a.id === 'hijack') return !!p.def.networked && !!p.def.wake;
      return !!p.def.wake && !p.wake && p.def.wake !== 'none';
    }
    case 'tile': {
      if (a.id === 'jump') return canJumpTo(u, x, y);
      if (a.id === 'turret') return freeTile(x, y) && d <= 2;
      if (a.id === 'blur') return freeTile(x, y) && los(u, { x, y });
      if (a.summon) return freeTile(x, y) && !propAt(x, y) && los(u, { x, y });
      if (a.surface?.kind === 'mine') return freeTile(x, y) && !t && !propAt(x, y) && !surfaceAt(x, y);
      if (a.wall) return walkable(x, y) && !t && d >= 1;
      if (a.shape === 'line' || a.shape === 'cone') return d >= 1;
      return true;
    }
  }
  return false;
}

function dirTo(u: { x: number; y: number }, x: number, y: number): [number, number] {
  const dx = x - u.x, dy = y - u.y;
  if (!dx && !dy) return [0, 1];
  return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}

function blocksShot(x: number, y: number): boolean {
  const m = WORLD.map!;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  return cellAt(m, x, y).tile.opaque || wallAt(x, y);
}

/** The tiles a frost wall covers: a line across the direction from the user to the target, centered on it. */
export function wallTiles(u: Unit, a: AbilityDef, x: number, y: number): [number, number][] {
  const len = (a.wall?.len ?? 3) + (a.id === 'palewall' && perk(u, 'thick_ice') ? 2 : 0);
  const [fx, fy] = dirTo(u, x, y);
  const px = fy, py = fx;
  const half = Math.floor(len / 2);
  const out: [number, number][] = [];
  for (let k = -half; k <= half; k++) out.push([x + px * k, y + py * k]);
  return out;
}

/** The tiles an ability affects when aimed at x, y. */
export function areaOf(u: Unit, a: AbilityDef, x: number, y: number): [number, number][] {
  if (a.id === 'blur') return lineTiles(u.x, u.y, x, y);
  if (a.wall) return wallTiles(u, a, x, y);
  if (a.shape === 'line') {
    const len = a.len ?? 5;
    const dx = x - u.x, dy = y - u.y, m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const out: [number, number][] = [];
    for (const [px, py] of lineTiles(u.x, u.y, u.x + Math.round(dx / m * len), u.y + Math.round(dy / m * len))) {
      if (out.length >= len || blocksShot(px, py)) break;
      out.push([px, py]);
    }
    return out;
  }
  if (a.shape === 'cone') {
    const len = a.len ?? 3;
    const [fx, fy] = dirTo(u, x, y);
    const out: [number, number][] = [];
    for (let d = 1; d <= len; d++) {
      const spread = Math.floor((d + 1) / 2) - (d === 1 ? 1 : 0);
      for (let k = -spread; k <= spread; k++) {
        const tx = u.x + fx * d + fy * k, ty = u.y + fy * d + fx * k;
        if (!blocksShot(tx, ty) && los(u, { x: tx, y: ty })) out.push([tx, ty]);
      }
    }
    return out;
  }
  if (a.shape === 'ring') {
    const out: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) out.push([x + dx, y + dy]);
    return out;
  }
  const r = (a.id === 'splash' && perk(u, 'wild') ? 2 : a.area ?? 0) + (u.mod.area?.[a.id] ?? 0);
  const cx = a.target === 'self' ? u.x : x, cy = a.target === 'self' ? u.y : y;
  const out: [number, number][] = [];
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

/** Abilities that hurt or hinder foes, which end Hidden when used. */
function hostileAbility(a: AbilityDef): boolean {
  if (a.id === 'hide' || a.id === 'mask' || a.affects === 'allies') return false;
  if (a.target === 'enemy') return true;
  return !!(a.dmg || a.status) && (a.target === 'tile' || (a.target === 'self' && !!a.area));
}

export async function useAbility(u: Unit, id: string, x: number, y: number): Promise<void> {
  const a = ABILITY.get(id)!;
  if (u.side === 'party' && u.member) { CB.stats.actions++; CB.usage[id] = (CB.usage[id] ?? 0) + 1; }
  else if (u.side === 'enemy' && id !== 'attack') CB.usage['enemy ' + id] = (CB.usage['enemy ' + id] ?? 0) + 1;
  if (a.blood) { const c = bloodCost(u, a); u.hp -= c; float(u, `-${c}`, a.cls === 'keeper' ? C.steel4 : C.red2); sparks(u.x * T + 5, u.y * T + 5, 5, a.cls === 'keeper' ? C.steel4 : C.red2, 18); }
  spend(u, a);
  if (u.actor) face(u, { x, y });
  await runAbility(u, a, id, x, y);
  if (id !== 'attack' && has(u, 'hidden') && hostileAbility(a) && !(a.network && perk(u, 'ghost'))) u.status.delete('hidden');
}

async function runAbility(u: Unit, a: AbilityDef, id: string, x: number, y: number): Promise<void> {
  const t = unitAt(x, y);
  const p = propAt(x, y);
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
    case 'overwatch': addStatus(u, 'overwatch', 2); float(u, 'OVERWATCH', C.amb3); return;
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
      for (const h of hits) { tracer(u, h, C.cyan3); sparks(h.x * T + 5, h.y * T + 4, 8, C.cyan4, 30); await damage(h, roll(a.dmg![0], a.dmg![1]) + levelBonus(u) + hackBonus(u), 'shock', u); await pause(0.08); }
      return;
    }
    case 'blind': case 'cripple': case 'fasttalk': case 'taunt': case 'turncoat': {
      if (!t) return;
      sfx(id === 'fasttalk' || id === 'taunt' || id === 'turncoat' ? 'talk' : 'hack');
      if (resisted(u, t, a)) { float(t, 'RESISTS', C.gray); return; }
      let turns = a.status!.turns;
      if (id === 'fasttalk' && perk(u, 'liar')) turns = 2;
      if (id === 'turncoat' && perk(u, 'kingmaker')) turns += 2;
      applyStatus(t, a.status!.id, turns, u);
      if (id === 'taunt') { t.taunter = u.id; if (perk(u, 'menace')) for (const e of foesOf(u)) if (e !== t && dist(e, t) === 1 && !resisted(u, e, a)) { applyStatus(e, 'taunted', 1, u); e.taunter = u.id; } }
      if (id === 'blind' && perk(u, 'feedback')) await damage(t, 3 + hackBonus(u), 'hack', u);
      if (id === 'fasttalk' && perk(u, 'crowd')) for (const e of foesOf(u)) if (e !== t && dist(e, t) === 1 && !e.machine && !resisted(u, e, a)) applyStatus(e, 'stunned', 1, u);
      if (id === 'cripple') t.moveLeft = 0;
      return;
    }
    case 'ping': {
      sfx('hack');
      for (const e of foesOf(u)) if (dist(e, u) <= 10) { e.status.delete('hidden'); applyStatus(e, 'marked', 1, u); }
      return;
    }
    case 'hijack': {
      if (!p) return;
      sfx('hack');
      const w = await wakeProp(p, u, 'calm', perk(u, 'deep_dive') ? 5 : 3);
      if (w) { w.name = `hijacked ${p.def.name}`; w.side = u.side; }
      return;
    }
    case 'overheat': if (t) { sfx('fire'); await damage(t, roll(3, 5) + hackBonus(u), 'fire', u); applyStatus(t, 'burning', 3, u); } return;
    case 'tag': if (t) { tracer(u, t, C.mag3); applyStatus(t, 'marked', 3, u); if (perk(u, 'spotter')) t.status.delete('hidden'); } return;
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
    case 'rally': if (t) { heal(t, roll(4, 6)); applyStatus(t, 'rallied', 2, u); if (t.member?.cls === 'witch') setMood(t, 'joy'); } return;
    case 'cheapshot': if (t) await attack(u, t, weaponFor(u, t), { ability: a, mult: has(t, 'stunned') || has(t, 'taunted') || has(t, 'distracted') ? (perk(u, 'low_blow') ? 2 : 1.5) : 1 }); return;
    case 'demoralize': {
      sfx('talk');
      for (const e of foesOf(u)) if (dist(e, u) <= 3 && !resisted(u, e, a)) applyStatus(e, 'distracted', 2, u);
      return;
    }
    case 'speech': for (const f of [u, ...friendsOf(u)]) if (f.member) { f.bonus = true; heal(f, 6 + (perk(u, 'saint') ? 10 : 0)); } return;
    case 'guard': if (t) { applyStatus(t, 'guarded', 1, u); t.guardedBy = u.id; if (perk(u, 'wall')) for (const f of friendsOf(u)) if (dist(f, u) === 1) { applyStatus(f, 'guarded', 1, u); f.guardedBy = u.id; } } if (perk(u, 'guardian')) u.bonus = true; return;
    case 'taser': if (t) await attack(u, t, u.melee, { ability: a }); return;
    case 'remaincalm': {
      sfx('pa');
      for (const e of foesOf(u)) if (dist(e, u) <= 3 && !resisted(u, e, a)) { applyStatus(e, 'taunted', 1, u); e.taunter = u.id; }
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
    case 'foam': sfx('foam'); for (const [sx, sy] of areaOf(u, a, x, y)) { setSurface(sx, sy, 'foam', 1); const o = unitAt(sx, sy); if (o && alive(o) && hostile(u, o)) applyStatus(o, 'immobile', 1, u); } return;
    case 'bulwark': applyStatus(u, 'bulwark', perk(u, 'fortress_unit') ? 2 : 1, u); return;
    case 'lockdown': for (const e of foesOf(u)) if (dist(e, u) <= 2) applyStatus(e, 'stunned', 1, u); return;
    case 'wake': {
      if (!p) return;
      const w = await wakeProp(p, u, u.mood ?? 'calm', wakeTurns(u));
      if (w && u.spentFight.heartfelt) { w.wake!.twice = true; w.wake!.turns = 99; u.spentFight.heartfelt = 0; }
      if (w && perk(u, 'many')) {
        const q = WORLD.props.filter((o) => o !== p && !o.broken && !o.wake && o.def.wake && o.def.wake !== 'none' && dist(o, p) <= 2).sort((m1, m2) => dist(m1, p) - dist(m2, p))[0];
        if (q) await wakeProp(q, u, u.mood ?? 'calm', wakeTurns(u));
      }
      return;
    }
    case 'steady': setMood(u, 'calm'); return;
    case 'splash': case 'redrain': {
      for (const [sx, sy] of areaOf(u, a, x, y)) {
        const q = propAt(sx, sy);
        if (q && q.def.wake && !q.wake && !q.broken) await wakeProp(q, u, u.mood ?? 'calm', id === 'splash' ? 2 + (u.abilities.includes('longwake') ? 2 : 0) : wakeTurns(u));
      }
      return;
    }
    case 'spray': {
      for (const [sx, sy] of areaOf(u, a, x, y)) {
        const q = propAt(sx, sy);
        if (q && q.def.wake && q.def.wake !== 'none' && !q.wake && !q.broken) await wakeProp(q, u, u.mood ?? 'calm', 2 + (u.abilities.includes('longwake') ? 2 : 0));
      }
      await runGeneric(u, a, x, y);
      return;
    }
    case 'heartbeat': {
      setMood(u, u.mood ?? 'calm');
      for (const w of CB.units.filter((o) => o.wake?.by === u.id && alive(o))) if (HOOKS.wokenTurn) { float(w, 'AGAIN', C.red2); await HOOKS.wokenTurn(w); }
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
    // Keeper
    case 'frost': {
      await runGeneric(u, a, x, y);
      if (t && alive(t) && perk(u, 'cold_snap')) await damage(t, roll(3, 5) + hackBonus(u), 'hack', u);
      return;
    }
    case 'absolutezero': {
      const before = new Set(foesOf(u).filter((e) => has(e, 'frosted')));
      await runGeneric(u, a, x, y);
      for (const e of before) if (alive(e) && dist(e, u) <= 4) applyStatus(e, 'stunned', 1, u);
      return;
    }
    case 'glassroom': {
      if (!t) return;
      raiseWall(areaOf(u, { ...a, shape: 'ring' }, t.x, t.y), 2);
      if (t.woken || t.wake) await hush(t, u);
      CB.stats.env++;
      return;
    }
    case 'thaw': {
      await runGeneric(u, a, x, y);
      if (t && perk(u, 'warm_front')) for (const f of friendsOf(u).concat(u)) if (f !== t && alive(f) && dist(f, t) <= 2) { heal(f, roll(a.heal![0], a.heal![1])); cleanse(f); }
      return;
    }
    // Port
    case 'wheel': {
      const hero = CB.units.find((o) => o.member?.id === 'hero' && alive(o));
      if (!hero) return;
      hero.extraActions++;
      float(hero, 'TAKE THE WHEEL', C.cyan4);
      sfx('port');
      if (perk(u, 'pilot')) { heal(hero, 6); applyStatus(hero, 'rallied', 2, u); }
      return;
    }
    case 'portcall': {
      const turns = (a.summon?.turns ?? 2) + (perk(u, 'big_call') ? 1 : 0);
      const first = summonUnit(u, a.summon!.kind, x, y, turns);
      if (!first) { float({ x, y }, 'NO ANSWER', C.gray); return; }
      if (perk(u, 'big_call')) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (summonUnit(u, a.summon!.kind, x + dx, y + dy, turns)) break;
      }
      return;
    }
    case 'coax': {
      if (!t) return;
      if (t.prop && t.wake) { if (resisted(u, t, a)) { float(t, 'RESISTS', C.gray); return; } t.side = u.side; t.wake.by = u.id; t.wake.feeling = 'calm'; float(t, 'KIN', C.cyan4); sfx('port'); return; }
      await runGeneric(u, a, x, y);
      return;
    }
    case 'comehome': {
      sfx('port');
      for (const e of foesOf(u)) {
        if (dist(e, u) > 6 || (!e.woken && !e.wake)) continue;
        if (e.boss && resisted(u, e, { ...a, resist: 'nerve' })) { float(e, 'RESISTS', C.gray); continue; }
        if (e.prop && e.wake) { e.side = u.side; e.wake.by = u.id; e.wake.feeling = 'calm'; float(e, 'KIN', C.cyan4); continue; }
        applyStatus(e, 'turncoat', 2, u);
      }
      return;
    }
    case 'dream': {
      for (const f of CB.units) if (f.downed && !f.dead && f.side === u.side && dist(f, u) <= 6) {
        f.downed = false; f.hp = Math.max(1, Math.round(f.maxHp / 2)); if (f.member) f.member.hp = f.hp; if (f.actor) f.actor.tint = undefined; float(f, 'UP', C.grn3);
      }
      await runGeneric(u, a, x, y);
      return;
    }
    case 'longing': {
      if (!t) return;
      tracer(u, t, C.cyan4);
      sfx('port');
      await pull(t, u, perk(u, 'echo_voice') ? 5 : 3);
      CB.stats.env++;
      return;
    }
    // Diver
    case 'meltdown': {
      await runGeneric(u, a, x, y);
      if (t) for (const e of foesOf(u)) if (e !== t && dist(e, t) === 1 && e.chrome) await damage(e, Math.ceil(roll(a.dmg![0], a.dmg![1]) / 2), 'fire', u);
      return;
    }
    // Enemy specials
    case 'alarm': {
      await runGeneric(u, a, x, y);
      const near = foesOf(u).filter((f) => !f.downed).sort((f1, f2) => dist(f1, u) - dist(f2, u))[0];
      if (!near) return;
      for (let i = 0; i < 3; i++) {
        const step = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy })).filter((c) => freeTile(c.x, c.y, u)).sort((c1, c2) => dist(c2, near) - dist(c1, near))[0];
        if (!step || dist(step, near) <= dist(u, near)) break;
        await moveAlong(u, [[step.x, step.y]], true);
      }
      return;
    }
    default: await runGeneric(u, a, x, y); return;
  }
}

function scaleOf(u: Unit, a: AbilityDef): number {
  if (a.scale === 'wits') return Math.floor(u.attr.wits / 2);
  if (a.scale === 'hold') return Math.floor(G.port.hold / 2);
  if (a.scale === 'self') return Math.floor(G.port.self / 2);
  return 0;
}

function abilitySfx(a: AbilityDef): string {
  if (a.heal || a.cleanse) return 'heal';
  if (a.status?.id === 'frosted' || a.wall || a.surface?.kind === 'frost') return 'hush';
  if (a.dtype === 'hack' || a.network) return 'hack';
  if (a.dtype === 'shock') return 'shock';
  if (a.dtype === 'fire') return 'fire';
  if (a.resist === 'nerve') return 'talk';
  if (a.summon) return 'port';
  return 'confirm';
}

/** The data-driven effect path: self buffs, walls, floors, summons, then every unit the ability touches. */
export async function runGeneric(u: Unit, a: AbilityDef, x: number, y: number) {
  const t = unitAt(x, y);
  if (a.hit !== 'attack') sfx(abilitySfx(a));
  if (a.self) applyStatus(u, a.self.id, a.self.turns, u);
  if (a.extra) { u.extraActions++; float(u, 'EXTRA ACTION', C.amb3); }
  if (a.ramGain) { u.ram = Math.min(u.ramMax + (perk(u, 'root') ? 4 : 0), u.ram + a.ramGain); float(u, `+${a.ramGain} RAM`, C.grn3); }
  const tiles = a.target === 'tile' || (a.target === 'self' && a.area) || a.shape ? areaOf(u, a, x, y) : [];
  if (a.wall) { raiseWall(tiles, a.wall.turns + (a.id === 'palewall' && perk(u, 'thick_ice') ? 1 : 0)); CB.stats.env++; }
  if (a.surface) {
    for (const [sx, sy] of tiles) {
      if (a.surface.kind === 'mine') CB.surf.set(idx(sx, sy), { kind: 'mine', turns: a.surface.turns, side: u.side });
      else setSurface(sx, sy, a.surface.kind, a.surface.turns);
    }
    CB.stats.env++;
  }
  if (a.summon && a.id !== 'portcall') { if (!summonUnit(u, a.summon.kind, x, y, a.summon.turns)) float({ x, y }, 'NO ANSWER', C.gray); }
  const allies = a.affects === 'allies' || (a.affects !== 'foes' && !!(a.heal || a.cleanse) && !a.dmg);
  const effects = a.dmg || a.status || a.heal || a.cleanse || a.push || a.strip || a.reveal || a.hushWoken || a.also || a.vsMachine || a.hit === 'attack';
  if (!effects) return;
  let touched: Unit[];
  if (a.target === 'self' && !a.area) touched = allies ? [u] : [];
  else if (tiles.length) {
    const set = new Set(tiles.map(([tx, ty]) => idx(tx, ty)));
    touched = CB.units.filter((o) => alive(o) && set.has(idx(o.x, o.y)) && (a.target !== 'self' || o !== u || allies));
  } else touched = t && alive(t) ? [t] : [];
  touched = touched.filter((o) => (allies ? !hostile(u, o) : hostile(u, o)));
  if (!allies) touched = touched.filter((o) => (!a.chromeOnly || o.chrome) && (!a.notMachine || !o.machine) && (!a.wokenOnly || o.woken || !!o.wake));
  if (touched.length === 1 && touched[0] !== u) tracer(u, touched[0], a.dtype === 'hack' || a.network ? C.cyan3 : a.status?.id === 'frosted' ? C.steel4 : C.amb4);
  else for (const o of touched) sparks(o.x * T + 5, o.y * T + 4, 5, a.status?.id === 'frosted' ? C.steel4 : allies ? C.grn3 : C.cyan4, 25);
  for (const o of touched) await touch(u, a, o, allies);
  if (touched.length && !allies) await pause(0.1);
}

async function touch(u: Unit, a: AbilityDef, o: Unit, allies: boolean) {
  if (!alive(o)) return;
  if (allies) {
    if (a.heal) heal(o, roll(a.heal[0], a.heal[1]) + scaleOf(u, a) + (a.id === 'want' && perk(u, 'small_wants') ? 3 : 0));
    if (a.cleanse) cleanse(o);
    if (a.status) applyStatus(o, a.status.id, a.status.turns, u);
    return;
  }
  if (a.hit === 'resist' && resisted(u, o, a)) { float(o, 'RESISTS', C.gray); return; }
  if (a.hit === 'attack') {
    const w = a.weapon === 'ranged' ? u.ranged : a.weapon === 'melee' ? u.melee : rangeFor(u, a) <= 1 ? u.melee : u.ranged ?? u.melee;
    const landed = await attack(u, o, w, { ability: a });
    if (!landed || !alive(o)) return;
  } else if (a.dmg) {
    const hack = a.dtype === 'hack' || !!a.network;
    await damage(o, roll(a.dmg[0], a.dmg[1]) + levelBonus(u) + scaleOf(u, a) + (hack ? hackBonus(u) : 0), a.dtype ?? 'kinetic', u);
    if (a.dtype === 'shock' && alive(o)) await arcShock(o, Math.ceil((a.dmg[0] + a.dmg[1]) / 4), u);
    if (!alive(o)) return;
  }
  if (a.strip) strip(o);
  if (a.reveal) o.status.delete('hidden');
  const sOk = !a.sresist || !resisted(u, o, { ...a, resist: a.sresist });
  if (a.status && a.hit !== 'attack') {
    if (!sOk) float(o, 'RESISTS', C.gray);
    else if (rnd() < (a.status.chance ?? 1)) { applyStatus(o, a.status.id, a.status.turns, u); if (a.status.id === 'taunted') o.taunter = u.id; }
  }
  if (sOk) for (const s of a.also ?? []) applyStatus(o, s.id, s.turns, u);
  if (a.vsMachine && (o.machine || o.woken || o.wake)) applyStatus(o, a.vsMachine.id, a.vsMachine.turns, u);
  if (a.hushWoken && (o.woken || o.wake) && alive(o)) await hush(o, u);
  if (a.push && alive(o)) {
    if (a.push > 0) await push(o, Math.sign(o.x - u.x), Math.sign(o.y - u.y), a.push, u);
    else await pull(o, u, -a.push);
  }
}

/** Whether the target resists. The user rolls the better of Wits plus Hack and Nerve plus Talk. */
function resisted(u: Unit, t: Unit, a: AbilityDef): boolean {
  if (!a.resist || perk(u, 'no_trace')) return false;
  const atk = Math.max(u.attr.wits + u.skills.hack, u.attr.nerve + u.skills.talk);
  const def = t.attr[a.resist as Attr] + (t.boss ? 3 : 0);
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
  else if (m === 'fear') { float(t, 'DROPS GUN', C.vio3); t.ranged = null; applyStatus(t, 'distracted', 1, u); }
  else if (m === 'calm') { applyStatus(t, 'turncoat', 1, u); }
  else if (m === 'joy') { applyStatus(t, 'stunned', 1, u); float(t, 'DANCES', C.amb3); }
  else if (m === 'grief') { applyStatus(t, 'slowed', 2, u); applyStatus(t, 'distracted', 2, u); setSurface(t.x, t.y, 'water', 2); }
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
    droneHp: 0, droneMax: 0, swimming: 0, phase: 0, x, y, owner: u.id, mod: {},
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
  const stillMind = u.side === 'party' && CB.units.some((o) => o.side === 'party' && perk(o, 'still_mind'));
  if (frostAt(u.x, u.y) && !u.flying && !stillMind) { addStatus(u, 'frosted', 1); float(u, 'FROSTED', C.steel4); }
  u.moveLeft = u.move;
  if (has(u, 'prone')) { u.moveLeft = Math.ceil(u.move / 2); }
  if (has(u, 'slowed')) u.moveLeft = Math.ceil(u.moveLeft / 2);
  if (has(u, 'frosted')) { u.moveLeft = Math.ceil(u.moveLeft / 2); u.bonus = false; u.reaction = false; }
  if (has(u, 'immobile') || has(u, 'crippled')) u.moveLeft = 0;
  if (u.ramMax) u.ram = Math.min(u.ramMax + (perk(u, 'root') ? 4 : 0), u.ram + 2 + (u.mod.ramRegen ?? 0));
  if (perk(u, 'repair')) heal(u, 3);
  if (perk(u, 'spotlight')) for (const e of foesOf(u)) if (dist(e, u) === 1 && has(e, 'hidden')) { e.status.delete('hidden'); float(e, 'SPOTTED', C.amb3); }
  if (perk(u, 'self_made') && u.hp < u.maxHp) heal(u, 2 + Math.floor(G.port.self / 2));
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
  if (!has(u, 'hushed') && u.actor && (u.member?.id === 'courtesy' || u.woken) && !u.downed && !u.dead) u.actor.tint = undefined;
  if (u.extraActions > 0) u.extraActions = 0;
  if (u.member) u.member.hp = Math.max(0, u.hp);
  if (alive(u) && CB.units.some((k) => alive(k) && hostile(k, u) && perk(k, 'cold_shoulder') && dist(k, u) === 1)) applyStatus(u, 'frosted', 1);
  if (u.wake) {
    u.wake.turns--;
    if (u.wake.turns <= 0) { float(u, 'STILL', C.gray); endWake(u); }
  }
  if (u.summoned !== undefined && alive(u) && --u.summoned <= 0) {
    float(u, 'GONE', C.gray);
    u.dead = true;
    CB.order = CB.order.filter((x) => x !== u);
    void dissipate(u);
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
    if (rnd() * 100 < chance) {
      await damage(t, roll(2, 4) + (perk(u, 'scrapper') ? 2 : 0) + (perk(u, 'wingman') ? 2 : 0), 'kinetic', u);
      if (perk(u, 'wingman') && alive(t)) applyStatus(t, 'marked', 1, u);
    } else float(t, 'MISS', C.gray);
    await pause(0.12);
  }
}

export { ITEM };
export type { Feeling };
