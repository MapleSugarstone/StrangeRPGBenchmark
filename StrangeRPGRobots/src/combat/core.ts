// Combat state and rules: positions, cover, height, line of sight, hit chance, damage, and surfaces.
import { WORLD, elevAt, walkable } from '../world/world';
import { cellAt } from '../world/map';
import { lineTiles, flyable } from '../world/path';
import { T } from '../world/tiles';
import { type Unit, has, alive, hostile, perk } from './unit';
import type { ItemDef, AbilityDef } from '../rules/data';
import { G } from '../game/state';

export type SurfaceKind = 'water' | 'oil' | 'fire' | 'shock' | 'smoke' | 'foam' | 'blood';
export interface Surface { kind: SurfaceKind; turns: number }

export interface FloatText { x: number; y: number; text: string; color: number; t: number }
export interface Spark { x: number; y: number; vx: number; vy: number; t: number; color: number; glow: boolean }
export interface Tracer { x0: number; y0: number; x1: number; y1: number; t: number; color: number }
export interface Flash { x: number; y: number; r: number; i: number; color: number; t: number; life: number }

export const CB = {
  active: false,
  units: [] as Unit[],
  order: [] as Unit[],
  turn: 0,
  round: 1,
  cur: null as Unit | null,
  surf: new Map<number, Surface>(),
  encounters: [] as string[],
  floats: [] as FloatText[],
  sparks: [] as Spark[],
  tracers: [] as Tracer[],
  flashes: [] as Flash[],
  busy: false,
  log: [] as string[],
  surprise: false,
  /** Stats for the balance tools and fun metrics. */
  stats: { actions: 0, plain: 0, env: 0, swings: 0, lead: 0, closeCall: false, deadTurns: 0, turns: 0 },
  sim: false,
  /** Lets the AI play the party's turns (browser tests). */
  autoParty: false,
  rng: Math.random,
};

export function rnd(): number { return CB.rng(); }
export function roll(a: number, b: number): number { return a + Math.floor(rnd() * (b - a + 1)); }

export function idx(x: number, y: number): number { return y * WORLD.map!.w + x; }

export function unitAt(x: number, y: number): Unit | null {
  for (const u of CB.units) if (!u.dead && u.x === x && u.y === y && (!u.downed || u.side === 'party')) return u;
  return null;
}

export function standing(): Unit[] { return CB.units.filter(alive); }
export function foesOf(u: Unit): Unit[] { return CB.units.filter((o) => alive(o) && hostile(u, o) && !(o.prop && o.wake?.feeling !== 'anger' && o.side !== 'enemy' && u.side !== 'party' && false)); }
export function friendsOf(u: Unit): Unit[] { return CB.units.filter((o) => alive(o) && o !== u && !hostile(u, o)); }

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
export function cheb(a: { x: number; y: number }, b: { x: number; y: number }): number { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

export function surfaceAt(x: number, y: number): Surface | undefined { return CB.surf.get(idx(x, y)); }

export function isWet(x: number, y: number): boolean {
  const s = surfaceAt(x, y);
  if (s && (s.kind === 'water' || s.kind === 'shock')) return true;
  return cellAt(WORLD.map!, x, y).tile.water === 'shallow';
}

function smokeAt(x: number, y: number): boolean {
  const s = surfaceAt(x, y);
  if (s && s.kind === 'smoke') return true;
  for (const p of WORLD.props) if (p.def.steam && !p.broken && p.x === x && p.y === y) return true;
  return false;
}

/** Line of sight between tiles. Walls, opaque props, smoke, and steam block it. */
export function los(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const t = lineTiles(a.x, a.y, b.x, b.y);
  const m = WORLD.map!;
  const fa = unitAt(a.x, a.y)?.flying, fb = unitAt(b.x, b.y)?.flying;
  for (let i = 0; i < t.length - 1; i++) {
    const [x, y] = t[i];
    const c = cellAt(m, x, y);
    const nearFlyer = (fa && Math.max(Math.abs(x - a.x), Math.abs(y - a.y)) <= 1) || (fb && Math.max(Math.abs(x - b.x), Math.abs(y - b.y)) <= 1);
    if (c.tile.opaque && !nearFlyer) return false;
    if (smokeAt(x, y)) return false;
    for (const p of WORLD.props) if (!p.broken && p.def.opaque && p.x === x && p.y === y) return false;
    if (c.elev > Math.max(elevAt(a.x, a.y), elevAt(b.x, b.y))) return false;
  }
  return true;
}

/** Cover a target has against an attacker: 0 none, 1 half, 2 full. */
export function coverOf(att: { x: number; y: number }, tgt: { x: number; y: number }): number {
  if (dist(att, tgt) <= 1) return 0;
  const dx = Math.sign(att.x - tgt.x), dy = Math.sign(att.y - tgt.y);
  let best = 0;
  const m = WORLD.map!;
  const check = (x: number, y: number) => {
    const c = cellAt(m, x, y);
    let v: number = c.tile.cover;
    const g = WORLD.coverGrid[y * m.w + x] ?? 0;
    if (g > v) v = g;
    for (const u of CB.units) if (alive(u) && u.x === x && u.y === y && has(u, 'bulwark')) v = 2;
    if (v > best) best = v;
  };
  if (dx) check(tgt.x + dx, tgt.y);
  if (dy) check(tgt.x, tgt.y + dy);
  if (Math.abs(att.x - tgt.x) > 2 * Math.abs(att.y - tgt.y) && dy) best = Math.max(0, best);
  // A target standing higher than the cover is not covered by it.
  return best;
}

export function weaponFor(u: Unit, t: { x: number; y: number }): ItemDef | null {
  const d = dist(u, t);
  const reach = u.melee?.reach ?? 1;
  if (u.melee && d <= reach && (d <= 1 || cheb(u, t) <= reach)) return u.melee;
  if (u.ranged) return u.ranged;
  return u.melee;
}

export function isMelee(w: ItemDef | null): boolean { return !!w && w.kind === 'melee'; }

export function rangeOf(w: ItemDef | null): number {
  if (!w) return 1;
  if (w.kind === 'melee') return w.reach ?? 1;
  return w.range ?? 6;
}

export interface HitInfo { chance: number; cover: number; flank: boolean; height: number }

/** The chance an attack lands, with the parts that made it. */
export function hitInfo(a: Unit, t: Unit, w: ItemDef | null, ab?: AbilityDef): HitInfo {
  const melee = isMelee(w) || ab?.range === 1;
  const attr = melee ? a.attr.body : a.attr.reflex;
  const skill = melee ? a.skills.strike : a.skills.shoot;
  const atk = attr + skill + (w?.acc ?? 0) + (perk(a, 'legend') ? 2 : 0) + (perk(a, 'steady_aim') && !melee ? 2 : 0);
  let def = t.def;
  if (has(t, 'bulwark')) def += 4;
  if (t.taunter && has(t, 'taunted')) def += 0;
  if (t.member?.cls === 'mouth' && CB.units.some((e) => e.taunter === t.id && has(e, 'taunted'))) def += 2;
  for (const f of CB.units) if (alive(f) && f !== t && !hostile(f, t) && perk(f, 'bodyguard') && dist(f, t) === 1) def += 1;
  let c = 65 + 5 * (atk - def);
  let cover = melee ? 0 : coverOf(a, t);
  if (w?.ignoreHalfCover && cover === 1) cover = 0;
  if (t.flying) cover = Math.min(cover, 1);
  if (cover === 1) c -= 25;
  if (cover === 2) c -= 45;
  const flank = !melee && cover === 0 && dist(a, t) > 1;
  if (flank) c += 10;
  const h = elevAt(a.x, a.y) - elevAt(t.x, t.y);
  if (h > 0) c += 10; else if (h < 0) c -= 10;
  const r = rangeOf(w);
  const d = dist(a, t);
  if (!melee && d > r) c -= 8 * (d - r);
  if (has(a, 'blinded')) c -= 30;
  if (has(a, 'distracted')) c -= 20;
  if (has(t, 'marked')) c += 15;
  if (has(t, 'prone')) c += melee ? 15 : -10;
  if (has(a, 'rallied')) c += 15;
  if (has(a, 'hidden')) c += 20;
  if (has(t, 'stunned')) c += 10;
  if (perk(a, 'dirty') && has(t, 'taunted')) c = 100;
  return { chance: Math.max(5, Math.min(95, Math.round(c))), cover, flank, height: h };
}

export function difficultyDamage(attacker: Unit, n: number): number {
  if (attacker.side === 'party') return n;
  if (G.difficulty === 'story') return Math.max(1, Math.round(n * 0.6));
  if (G.difficulty === 'flatline') return Math.round(n * 1.25);
  return n;
}

export function tilePx(x: number, y: number): [number, number] { return [x * T + 5 - WORLD.cam.x, y * T + 5 - WORLD.cam.y]; }

export function freeTile(x: number, y: number, except?: Unit): boolean {
  if (except?.flying ? !flyable(x, y) : !walkable(x, y)) return false;
  const u = unitAt(x, y);
  if (u && u !== except && alive(u)) return false;
  if (u && u.downed && u !== except) return false;
  return true;
}
