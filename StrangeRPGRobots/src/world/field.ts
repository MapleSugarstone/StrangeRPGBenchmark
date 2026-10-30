// Exploration: the leader walks the grid, followers glide along the leader's trail, NPCs wander and bark,
// hostiles watch with vision cones, and stepping on exits and triggers moves the story.
import { isDown, pressed, MOUSE, mouseActive, consume } from '../engine/input';
import { W, H } from '../engine/screen';
import { lightAt } from '../engine/light';
import { C } from '../engine/palette';
import { shadeRect, rect, box, upx } from '../engine/gfx';
import { drawText, textWidth, wrap as wrapText } from '../engine/font';
import { T } from './tiles';
import { WORLD, loadWorld, walkable, actorAt, propAt, propVisible, type Actor, type PropInst } from './world';
import { MAPS, parseMap, type Dir, type MapDef, type NpcPlace } from './map';
import { findPath, sees, stepOk, type Pt } from './path';
import { sheetFor } from '../art/cast';
import { DRAWN } from '../art/drawn';
import { detailAt, detailSeen, detailVisible } from '../game/details';
import { detailsOn, type Detail } from '../content/details';
import { personSheet } from '../art/people';
import { G, flag, setFlag } from '../game/state';
import { partyMembers } from '../rules/stats';
import { ENEMY } from '../rules/data';
import { sfx } from '../audio/sfx';
import { SCENES } from '../game/script';

export const DIRS: Record<Dir, Pt> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const F = {
  locked: false,
  sneaking: false,
  leader: null as Actor | null,
  followers: [] as Actor[],
  trail: [] as Pt[],
  inCombat: false,
  /** The map's exits and triggers are ignored until the leader steps off the arrival tile. */
  armed: false,
  hooks: {
    scene: (_id: string) => {},
    exit: (_to: string, _at: string) => {},
    encounter: (_id: string, _surprise: boolean) => {},
    menu: () => {},
    use: (_p: PropInst) => {},
    talk: (_a: Actor) => {},
    sneak: (_a: Actor) => {},
    detail: (_d: Detail) => {},
  },
  barkCooldown: new Map<string, number>(),
  hudT: 0,
  clickPath: null as Pt[] | null,
  /** An actor carried by another (Courtesy carrying Marit). */
  carry: null as null | { carrier: string; carried: string },
  /** The NPC the party is riding (Tilly), or null. */
  ride: null as string | null,
  interactHint: null as null | { x: number; y: number },
  /** An exit has fired and the map is changing, so a held key cannot fire another. */
  leaving: false,
};

export function lookFor(id: string): ReturnType<typeof sheetFor> {
  if (id === 'hero') return personSheet(G.look);
  const m = G.roster[id];
  if (id === 'courtesy') return sheetFor(G.flags.courtesy_painted ? 'courtesy_cyan' : 'courtesy');
  if (id === 'ambrose' && G.flags.ambrose_eye_arrears && !G.flags.ambrose_free) return sheetFor('ambrose_ads');
  if (DRAWN[id]) return sheetFor(id);
  if (m?.look) return personSheet(m.look);
  return sheetFor(id);
}

function newActor(id: string, name: string, x: number, y: number, dir: Dir, sheet: Actor['sheet'], role: Actor['role']): Actor {
  return { id, name, sheet, tx: x, ty: y, px: x * T, py: y * T, dir, anim: 0, moving: false, path: [], speed: 6, role, idle: Math.random() * 3, visible: true, lift: 0, alert: 0 };
}

export function visibleIf(o: { showIf?: string; hideIf?: string }): boolean {
  if (o.showIf && !flag(o.showIf)) return false;
  if (o.hideIf && flag(o.hideIf)) return false;
  return true;
}

function npcPos(def: MapDef, n: NpcPlace): Pt {
  if (typeof n.at === 'string') return def.markers?.[n.at.slice(1)] ?? [1, 1];
  return n.at;
}

/** Loads a map and places the party at a tile, facing a direction. */
export function enterMap(id: string, at: Pt, dir: Dir) {
  const def = MAPS.get(id);
  if (!def) throw new Error(`No map ${id}`);
  loadWorld(def);
  WORLD.camTarget = null;
  F.leaving = false;
  G.map = id;
  G.x = at[0];
  G.y = at[1];
  G.dir = dir;
  const party = partyMembers();
  F.followers = [];
  F.trail = [];
  const back = DIRS[dir];
  party.forEach((m, i) => {
    let x = at[0] - back[0] * i, y = at[1] - back[1] * i;
    if (!walkable(x, y)) { x = at[0]; y = at[1]; }
    const a = newActor(m.id, m.id === 'hero' ? G.heroName : m.name, x, y, dir, lookFor(m.id), 'party');
    if (m.id === 'courtesy') a.breathe = true;
    WORLD.actors.push(a);
    if (i === 0) F.leader = a; else F.followers.push(a);
  });
  for (const f of F.followers) F.trail.push([f.tx, f.ty]);
  while (F.trail.length < 4) F.trail.push(F.trail[F.trail.length - 1] ?? [at[0], at[1]]);
  spawnNpcs(def);
  spawnEncounters(def);
  if (def.id === (G.campMap ?? 'camp')) spawnCamp(def);
  if (def.below && G.flags.deeps_flooded) void import('../game/anims').then((m) => m.floodMap(false));
  F.armed = false;
  snapCamera();
}

export function spawnNpcs(def: MapDef) {
  for (const n of def.npcs ?? []) {
    if (!visibleIf(n) || WORLD.exited.has(n.id)) continue;
    if (WORLD.actors.some((a) => a.id === n.id)) continue;
    const [x, y] = npcPos(def, n);
    const a = newActor(n.id, n.name ?? n.id, x, y, n.dir ?? 'down', sheetFor(n.look), n.crowd || n.look.startsWith('crowd:') ? 'crowd' : 'npc');
    a.talk = n.talk;
    a.wander = n.wander ?? (a.role === 'crowd' ? 6 : 0);
    a.home = [x, y];
    a.patrol = n.path;
    a.patrolAt = 0;
    a.bark = n.bark;
    a.pocket = n.pocket;
    if (n.down) { a.tint = C.slate; a.lift = -3; a.hold = true; a.wander = 0; }
    a.speed = a.role === 'crowd' ? 2.5 + Math.random() : 3;
    a.crowd = a.role === 'crowd';
    a.breathe = n.look === 'tilly' || n.look.startsWith('woken');
    WORLD.actors.push(a);
  }
}

/** At camp, recruited companions who are not in the active party stand at their spots and can be talked to. */
function spawnCamp(def: MapDef) {
  const spots = Object.entries(def.markers ?? {}).filter(([k]) => k.startsWith('camp_')).map(([, p]) => p);
  let i = 0;
  for (const m of Object.values(G.roster)) {
    if (m.id === 'hero' || m.dead || G.party.includes(m.id) || G.flags[m.id + '_taken']) continue;
    if (WORLD.actors.some((a) => a.id === m.id)) continue;
    const p = def.markers?.[`camp_${m.id}`] ?? spots[i++ % Math.max(1, spots.length)] ?? [2 + i, 2];
    const a = newActor(m.id, m.name, p[0], p[1], 'down', lookFor(m.id), 'npc');
    a.talk = SCENES.has(`camptalk_${m.id}`) ? `camptalk_${m.id}` : undefined;
    a.home = [p[0], p[1]];
    a.wander = 1;
    if (m.id === 'courtesy') a.breathe = true;
    WORLD.actors.push(a);
  }
}

export function spawnEncounters(def: MapDef) {
  for (const e of def.encounters ?? []) {
    if (G.defeated.includes(`${def.id}:${e.id}`)) continue;
    if (!visibleIf(e)) continue;
    e.units.forEach((u, i) => {
      const ed = ENEMY.get(u.kind);
      if (!ed) return;
      const id = u.id ?? `${e.id}_${i}`;
      if (WORLD.actors.some((a) => a.id === id)) return;
      const a = newActor(id, u.name ?? ed.name, u.at[0], u.at[1], u.dir ?? 'down', sheetFor(u.look ?? ed.look), 'enemy');
      a.encounter = e.id;
      a.speed = 4;
      a.seesAll = !!ed.seesAll;
      if (ed.machine && ed.look === 'patrol') a.breathe = false;
      WORLD.actors.push(a);
    });
    (e.allies ?? []).forEach((u, i) => {
      const ed = ENEMY.get(u.kind);
      if (!ed) return;
      const id = u.id ?? e.id + '_ally' + i;
      if (WORLD.actors.some((a) => a.id === id)) return;
      const a = newActor(id, u.name ?? ed.name, u.at[0], u.at[1], u.dir ?? 'down', sheetFor(u.look ?? ed.look), 'ally');
      a.encounter = e.id;
      WORLD.actors.push(a);
    });
  }
}

/** Removes NPCs whose show conditions no longer hold and adds ones that now do. */
export function refreshNpcs() {
  const def = WORLD.def;
  if (!def) return;
  for (const n of def.npcs ?? []) {
    const a = WORLD.actors.find((x) => x.id === n.id);
    if (a && a.role !== 'party' && !visibleIf(n)) WORLD.actors.splice(WORLD.actors.indexOf(a), 1);
  }
  spawnNpcs(def);
}

export function snapCamera() {
  const L = F.leader;
  if (!L) return;
  const m = WORLD.map!;
  WORLD.cam.x = clampCam(L.px + 5 - W / 2, m.w * T, W);
  WORLD.cam.y = clampCam(L.py + 5 - (H - 10) / 2, m.h * T, H);
}

function clampCam(v: number, size: number, view: number): number {
  if (size <= view) return Math.round((size - view) / 2);
  return Math.round(Math.max(0, Math.min(size - view, v)));
}

export function updateCamera(dt: number) {
  const m = WORLD.map;
  if (!m) return;
  let tx: number, ty: number;
  if (WORLD.camTarget) { tx = WORLD.camTarget.x - W / 2; ty = WORLD.camTarget.y - H / 2; }
  else if (F.leader) { tx = F.leader.px + 5 - W / 2; ty = F.leader.py + 5 - (H - 10) / 2; }
  else return;
  tx = clampCam(tx, m.w * T, W);
  ty = clampCam(ty, m.h * T + (F.inCombat ? 30 : 0), H);
  const k = Math.min(1, dt * 8);
  const nx = WORLD.cam.x + (tx - WORLD.cam.x) * k, ny = WORLD.cam.y + (ty - WORLD.cam.y) * k;
  WORLD.cam.x = Math.abs(tx - nx) < 0.5 ? tx : nx;
  WORLD.cam.y = Math.abs(ty - ny) < 0.5 ? ty : ny;
}

/** Moves an actor one tile. Returns false when blocked. */
export function tryStep(a: Actor, dx: number, dy: number, ignoreActors = false): boolean {
  a.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
  const nx = a.tx + dx, ny = a.ty + dy;
  if (!walkable(nx, ny)) return false;
  if (!stepOk(a.tx, a.ty, nx, ny)) return false;
  if (!ignoreActors) {
    const o = actorAt(nx, ny, a);
    if (o && !(a === F.leader && (o.role === 'party' || o.role === 'crowd'))) return false;
  }
  if (a === F.leader) {
    F.trail.unshift([a.tx, a.ty]);
    if (F.trail.length > 8) F.trail.pop();
  }
  a.tx = nx;
  a.ty = ny;
  a.moving = true;
  return true;
}

/** Glides an actor toward its tile. */
export function moveActor(a: Actor, dt: number) {
  const tx = a.tx * T, ty = a.ty * T;
  if (a.px === tx && a.py === ty) {
    if (a.path.length) {
      const [nx, ny] = a.path[0];
      const dx = Math.sign(nx - a.tx), dy = Math.sign(ny - a.ty);
      a.path.shift();
      if ((dx || dy) && !tryStep(a, dx, dy, a.role === 'party' || a.role === 'crowd')) { a.path = []; a.moving = false; }
      return;
    }
    a.moving = false;
    return;
  }
  a.moving = true;
  a.anim += dt;
  const step = a.speed * T * dt;
  const ddx = tx - a.px, ddy = ty - a.py;
  const d = Math.hypot(ddx, ddy);
  if (d <= step) { a.px = tx; a.py = ty; } else { a.px += (ddx / d) * step; a.py += (ddy / d) * step; }
}

const covers = (r: { x: number; y: number; w?: number; h?: number }, x: number, y: number) =>
  x >= r.x && x < r.x + (r.w ?? 1) && y >= r.y && y < r.y + (r.h ?? 1);

function doorAt(x: number, y: number): boolean {
  return WORLD.props.some((p) => !p.broken && p.place.kind === 'door' && p.x === x && p.y === y && propVisible(p, flag));
}

/** Fires the exit or one-time trigger at a tile, if any. Returns whether something fired. */
function fireAt(x: number, y: number): boolean {
  const def = WORLD.def!;
  for (const e of def.exits ?? []) {
    if (!visibleIf(e) || !covers(e, x, y)) continue;
    if (e.scene) F.hooks.scene(e.scene);
    else { F.leaving = true; F.hooks.exit(e.to, e.at); }
    return true;
  }
  let fired = false;
  (def.triggers ?? []).forEach((t, i) => {
    if (fired || !visibleIf(t) || !covers(t, x, y)) return;
    const key = `trig:${def.id}:${i}`;
    if (t.once !== false && G.flags[key]) return;
    if (t.once !== false) setFlag(key);
    F.hooks.scene(t.scene);
    fired = true;
  });
  return fired;
}

/**
 * Walking into a door goes through it: the exit on the door tile fires, or the one on its doorstep. Standing on a
 * doorstep does nothing by itself.
 */
function walkIntoDoor(x: number, y: number): boolean {
  const L = F.leader!;
  if (!doorAt(x, y) || F.leaving) return false;
  return fireAt(x, y) || fireAt(L.tx, L.ty);
}

function leaderArrived() {
  const L = F.leader!;
  G.x = L.tx; G.y = L.ty; G.dir = L.dir;
  // The first step after arriving fires nothing, unless it is a step into a door.
  if (!F.armed) { F.armed = true; if (!doorAt(L.tx, L.ty)) return; }
  // A door the leader can step onto also counts as walked into, with its exit on the door or the step below.
  if (doorAt(L.tx, L.ty)) { if (fireAt(L.tx, L.ty) || fireAt(L.tx, L.ty + 1)) return; }
  // A doorstep, inside or out, never fires by itself. The door does, when walked into.
  if (doorAt(L.tx, L.ty - 1) || doorAt(L.tx, L.ty + 1)) return;
  fireAt(L.tx, L.ty);
}

/** After a fight, followers walk back to the leader and the trail starts again from there. */
export function regroup() {
  const L = F.leader;
  if (!L) return;
  F.trail = Array.from({ length: 8 }, () => [L.tx, L.ty] as Pt);
  for (const f of F.followers) f.path = findPath(f.tx, f.ty, L.tx, L.ty, { blocked: (x, y) => { const o = actorAt(x, y, f); return !!o && o.role !== 'party'; } }) ?? [];
}

function followersUpdate(dt: number) {
  F.followers.forEach((f, i) => {
    const target = F.trail[i];
    if (!target) return;
    if (f.path.length) { moveActor(f, dt); return; }
    if (f.px === f.tx * T && f.py === f.ty * T && (f.tx !== target[0] || f.ty !== target[1])) {
      const dx = target[0] - f.tx, dy = target[1] - f.ty;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        f.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
        f.tx = target[0]; f.ty = target[1];
      } else if (Math.abs(dx) + Math.abs(dy) > 1) {
        f.tx = target[0]; f.ty = target[1];
        f.px = f.tx * T; f.py = f.ty * T;
      }
    }
    f.speed = F.leader!.speed;
    moveActor(f, dt);
  });
}

function wanderUpdate(a: Actor, dt: number) {
  if (a.moving || a.path.length || a.hold) return;
  a.idle -= dt;
  if (a.idle > 0) return;
  a.idle = a.crowd ? 1 + Math.random() * 4 : 3 + Math.random() * 5;
  if (a.patrol && a.patrol.length) {
    a.patrolAt = ((a.patrolAt ?? 0) + 1) % a.patrol.length;
    const [px, py] = a.patrol[a.patrolAt];
    a.path = findPath(a.tx, a.ty, px, py, { blocked: (x, y) => !!actorAt(x, y, a) || railBlock(a, x, y) }) ?? [];
    return;
  }
  if (!a.wander || !a.home) return;
  const r = a.wander;
  for (let tries = 0; tries < 6; tries++) {
    const gx = a.home[0] + Math.round((Math.random() * 2 - 1) * r), gy = a.home[1] + Math.round((Math.random() * 2 - 1) * r);
    if (!walkable(gx, gy) || actorAt(gx, gy)) continue;
    const p = findPath(a.tx, a.ty, gx, gy, { max: r * 3, blocked: (x, y) => !!actorAt(x, y, a) && !a.crowd });
    if (p && p.length) { a.path = p; return; }
  }
}

function barkUpdate(a: Actor, now: number) {
  if (!a.bark?.length || !F.leader) return;
  const d = Math.abs(a.tx - F.leader.tx) + Math.abs(a.ty - F.leader.ty);
  if (d > 3) return;
  const next = F.barkCooldown.get(a.id) ?? 0;
  if (now < next) return;
  F.barkCooldown.set(a.id, now + 18 + Math.random() * 10);
  a.barkLine = { text: a.bark[Math.floor(Math.random() * a.bark.length)], t: 3.2 };
}

/** Whether a hostile actor can see a party actor right now. */
export function canSee(e: Actor, p: Actor, range = 7): boolean {
  const dx = p.tx - e.tx, dy = p.ty - e.ty;
  const d = Math.abs(dx) + Math.abs(dy);
  if (d > range) return false;
  if (e.seesAll) return true;
  if (d > 1) {
    const [fx, fy] = DIRS[e.dir];
    const dot = dx * fx + dy * fy;
    if (dot <= 0) return false;
    if (Math.abs(dx * fy - dy * fx) > dot + 1) return false;
  }
  if (!sees(e.tx, e.ty, p.tx, p.ty)) return false;
  if (d <= 2) return true;
  const sx = p.px + 5 - WORLD.cam.x, sy = p.py + 5 - WORLD.cam.y;
  const lit = sx >= 0 && sy >= 0 && sx < W && sy < H ? lightAt(sx, sy) : 0.3;
  return lit > (F.sneaking ? 0.42 : 0.12);
}

function watchUpdate(dt: number) {
  if (F.inCombat || F.locked) return;
  const party = WORLD.actors.filter((a) => a.role === 'party' && a.visible);
  const def = WORLD.def!;
  for (const e of WORLD.actors) {
    if (e.role !== 'enemy' || e.gone) continue;
    const enc = def.encounters?.find((x) => x.id === e.encounter);
    if (!enc || enc.start === 'script') continue;
    const seen = party.some((p) => canSee(e, p, enc.sightRange ?? 7));
    const rate = F.sneaking ? 0.9 : 3.5;
    e.alert = seen ? Math.min(1, e.alert + rate * dt) : Math.max(0, e.alert - 0.35 * dt);
    if (e.alert >= 1) {
      e.alert = 0;
      e.emote = { kind: '!', t: 1 };
      sfx('alarm');
      if (enc.alert) { F.hooks.scene(enc.alert); return; }
      F.hooks.encounter(enc.id, false);
      return;
    }
  }
}

/** Starts a fight from stealth with a surprise round, if a hostile group is near and nobody has seen the party. */
function ambushCheck() {
  if (!F.sneaking || !F.leader) return null;
  const L = F.leader;
  let best: Actor | null = null;
  for (const e of WORLD.actors) {
    if (e.role !== 'enemy' || e.gone) continue;
    const d = Math.abs(e.tx - L.tx) + Math.abs(e.ty - L.ty);
    if (d <= 8 && e.alert < 0.6 && sees(L.tx, L.ty, e.tx, e.ty)) { if (!best || d < Math.abs(best.tx - L.tx) + Math.abs(best.ty - L.ty)) best = e; }
  }
  return best;
}

function interactTarget(): { actor?: Actor; prop?: PropInst; detail?: Detail; x: number; y: number } | null {
  const L = F.leader!;
  const [dx, dy] = DIRS[L.dir];
  const fx = L.tx + dx, fy = L.ty + dy;
  const a = actorAt(fx, fy, L);
  if (a && a.role !== 'party' && (a.talk || a.role === 'enemy' || (F.sneaking && a.pocket))) return { actor: a, x: fx, y: fy };
  const p = propAt(fx, fy);
  if (p && (p.place.scene || p.def.use || p.place.loot)) return { prop: p, x: fx, y: fy };
  const dt = detailAt(G.map, fx, fy);
  if (dt) return { detail: dt, x: fx, y: fy };
  for (const [ox, oy] of Object.values(DIRS)) {
    const b = actorAt(L.tx + ox, L.ty + oy, L);
    if (b && b.role !== 'party' && b.talk) return { actor: b, x: L.tx + ox, y: L.ty + oy };
  }
  return null;
}

/** Tilly keeps to her track: road tiles only. */
export function railBlock(a: Actor, x: number, y: number): boolean {
  if (a.id !== 'tilly') return false;
  const m = WORLD.map!;
  return m.cells[y * m.w + x]?.tile.ch !== ':';
}

export function updateField(dt: number, now: number) {
  const L = F.leader;
  if (!L) return;
  if (F.carry) {
    const c = findActor(F.carry.carrier), d = findActor(F.carry.carried);
    if (c && d) { d.tx = c.tx; d.ty = c.ty; d.px = c.px; d.py = c.py; d.visible = false; }
  }
  if (F.ride) {
    const r = findActor(F.ride);
    if (r) for (const p of WORLD.actors) if (p.role === 'party') { p.tx = r.tx; p.ty = r.ty; p.px = r.px; p.py = r.py; }
  }
  F.hudT += dt;
  if (!F.locked && !F.inCombat) {
    if (pressed('sneak')) { F.sneaking = !F.sneaking; sfx(F.sneaking ? 'cursor' : 'cancel'); }
    if (pressed('b')) { consume(); F.hooks.menu(); return; }
    if (pressed('tab') && F.followers.length) { cycleLeader(); }
    if (pressed('end')) {
      const e = ambushCheck();
      if (e && e.encounter) { F.hooks.encounter(e.encounter, true); return; }
    }
    const t = interactTarget();
    F.interactHint = t ? { x: t.x, y: t.y } : null;
    if (pressed('a') && t) {
      consume();
      if (t.actor) {
        const a = t.actor;
        if (a.role === 'enemy') {
          if (F.sneaking && a.encounter && a.alert < 0.6) { F.hooks.sneak(a); return; }
          return;
        }
        if (F.sneaking && a.pocket && !G.flags['stole_' + a.id]) { F.hooks.sneak(a); return; }
        faceToward(a, L);
        F.hooks.talk(a);
        return;
      }
      if (t.prop) { F.hooks.use(t.prop); return; }
      if (t.detail) { F.hooks.detail(t.detail); return; }
    }
    if (MOUSE.left && mouseActive()) {
      const wx = Math.floor((MOUSE.x + WORLD.cam.x) / T), wy = Math.floor((MOUSE.y + WORLD.cam.y) / T);
      const a = actorAt(wx, wy, L);
      const p = propAt(wx, wy);
      const target = a && a.role !== 'party' ? a : null;
      const near = Math.abs(wx - L.tx) + Math.abs(wy - L.ty) === 1;
      if (target && near) { faceToward(target, L); L.dir = dirTo(L, wx, wy); if (target.talk) F.hooks.talk(target); }
      else if (p && near && (p.place.scene || p.def.use || p.place.loot)) { L.dir = dirTo(L, wx, wy); F.hooks.use(p); }
      else if (near && detailAt(G.map, wx, wy)) { L.dir = dirTo(L, wx, wy); F.hooks.detail(detailAt(G.map, wx, wy)!); }
      else if (near && doorAt(wx, wy)) { L.dir = dirTo(L, wx, wy); walkIntoDoor(wx, wy); }
      else {
        const path = findPath(L.tx, L.ty, wx, wy, { adjacent: !!target || (!!p && !walkable(wx, wy)), blocked: (x, y) => { const o = actorAt(x, y, L); return !!o && o.role !== 'party' && o.role !== 'crowd'; } });
        if (path) F.clickPath = path;
      }
    }
    const run = isDown('run');
    L.speed = F.sneaking ? 3.5 : run ? 9 : 6.5;
    if (L.px === L.tx * T && L.py === L.ty * T) {
      let dx = 0, dy = 0;
      if (isDown('left')) dx = -1; else if (isDown('right')) dx = 1; else if (isDown('up')) dy = -1; else if (isDown('down')) dy = 1;
      if (dx || dy) F.clickPath = null;
      if (!dx && !dy && F.clickPath?.length) {
        const [nx, ny] = F.clickPath.shift()!;
        dx = Math.sign(nx - L.tx); dy = Math.sign(ny - L.ty);
        if (!F.clickPath.length) F.clickPath = null;
      }
      if (dx || dy) {
        if (!tryStep(L, dx, dy)) { F.clickPath = null; walkIntoDoor(L.tx + dx, L.ty + dy); }
      }
    }
  }
  const wasMoving = L.px !== L.tx * T || L.py !== L.ty * T;
  moveActor(L, dt);
  if (wasMoving && L.px === L.tx * T && L.py === L.ty * T && !F.locked) leaderArrived();
  // A fight moves party members itself, so following stops until it ends.
  if (!F.inCombat) followersUpdate(dt);
  for (const a of WORLD.actors) {
    if (a.role === 'party') continue;
    if (!F.locked && !F.inCombat && (a.role === 'npc' || a.role === 'crowd')) wanderUpdate(a, dt);
    moveActor(a, dt);
    if (a.role === 'npc' || a.role === 'crowd') barkUpdate(a, now);
  }
  for (const a of WORLD.actors) {
    if (a.barkLine) { a.barkLine.t -= dt; if (a.barkLine.t <= 0) a.barkLine = undefined; }
    if (a.emote) { a.emote.t -= dt; if (a.emote.t <= 0) a.emote = undefined; }
  }
  watchUpdate(dt);
}

function dirTo(a: Actor, x: number, y: number): Dir {
  const dx = x - a.tx, dy = y - a.ty;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export function faceToward(a: Actor, other: Actor) {
  const dx = other.tx - a.tx, dy = other.ty - a.ty;
  if (Math.abs(dx) >= Math.abs(dy)) a.dir = dx < 0 ? 'left' : 'right';
  else a.dir = dy < 0 ? 'up' : 'down';
}

function cycleLeader() {
  const all = [F.leader!, ...F.followers];
  const next = all[1];
  if (!next) return;
  const old = F.leader!;
  [old.tx, next.tx] = [next.tx, old.tx];
  [old.ty, next.ty] = [next.ty, old.ty];
  F.leader = next;
  F.followers = [...all.slice(2), old];
  G.party = [next.id, ...G.party.filter((x) => x !== next.id)];
  sfx('cursor');
}

const EMOTE_ART: Record<string, string[]> = {
  '!': ['..1..', '..1..', '..1..', '.....', '..1..'],
  '?': ['.111.', '...1.', '..1..', '.....', '..1..'],
  '...': ['.....', '.....', '.....', '.....', '1.1.1'],
  heart: ['.....', '11.11', '11111', '.111.', '..1..'],
  note: ['..11.', '..1.1', '..1..', '111..', '111..'],
  sweat: ['...1.', '..11.', '.111.', '.111.', '..1..'],
  angry: ['1.1.1', '.1.1.', '1.1.1', '.....', '.....'],
  zzz: ['1111.', '..1..', '.1...', '1111.', '.....'],
};

/** While the player holds the look key: amber marks on things not yet looked at, gray on the rest. */
function markInteractables(cx: number, cy: number) {
  const mark = (tx: number, ty: number, fresh: boolean) => {
    const x = tx * T - cx + 4, y = ty * T - cy + 3;
    if (x < 0 || y < 0 || x > W - 3 || y > H - 3) return;
    const c = fresh ? C.amb3 : C.gray;
    rect(x - 1, y, 3, 1, c); rect(x, y + 1, 1, 1, c);
  };
  for (const d of detailsOn(G.map)) if (detailVisible(d)) mark(d.at[0], d.at[1], !detailSeen(d));
  for (const p of WORLD.props) {
    if (p.broken || !(p.place.scene || p.def.use || p.place.loot)) continue;
    const looted = (p.place.loot || p.def.use === 'loot') && G.looted.includes(`${G.map}:${p.id}`);
    mark(p.x, p.y, !looted);
  }
  for (const a of WORLD.actors) if (a.visible && !a.gone && a.talk && a.role !== 'party') mark(a.tx, a.ty - 1, true);
}

/** Draws bubbles, barks, cones, and hints over the finished frame. */
export function renderFieldOverlay() {
  const cx = WORLD.cam.x, cy = WORLD.cam.y;
  if (F.sneaking && !F.inCombat) {
    for (const e of WORLD.actors) {
      if (e.role !== 'enemy' || e.gone) continue;
      const enc = WORLD.def!.encounters?.find((x) => x.id === e.encounter);
      const range = enc?.sightRange ?? 7;
      for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d === 0 || d > range) continue;
        const [fx, fy] = DIRS[e.dir];
        const dot = dx * fx + dy * fy;
        if (d > 1 && (dot <= 0 || Math.abs(dx * fy - dy * fx) > dot + 1)) continue;
        const x = e.tx + dx, y = e.ty + dy;
        if (!walkable(x, y) && !actorAt(x, y)) continue;
        if (!sees(e.tx, e.ty, x, y)) continue;
        shadeRect(x * T - cx, y * T - cy, T, T, e.alert > 0.05 ? 0.38 : 0.22, e.alert > 0.05 ? C.mag2 : C.mag0);
      }
      if (e.alert > 0) {
        const bx = Math.round(e.px - cx), by = Math.round(e.py - cy) - 5;
        rect(bx, by, 10, 3, C.black);
        rect(bx + 1, by + 1, Math.round(8 * e.alert), 1, C.mag3);
      }
    }
  }
  for (const a of WORLD.actors) {
    if (!a.visible || a.gone) continue;
    const ax = Math.round(a.px - cx), ay = Math.round(a.py - cy) - a.lift;
    if (a.emote) {
      const art = EMOTE_ART[a.emote.kind] ?? EMOTE_ART['!'];
      box(ax + 2, ay - 10, 7, 7, C.white, C.white);
      const col = a.emote.kind === 'heart' || a.emote.kind === 'angry' ? C.mag2 : C.black;
      art.forEach((row, yy) => { for (let xx = 0; xx < 5; xx++) if (row[xx] === '1') upx(ax + 3 + xx, ay - 9 + yy, col); });
    }
    if (a.barkLine && ax > -10 && ax < W && ay > -10 && ay < H) {
      const lines = wrapText(a.barkLine.text, 140);
      const w = Math.min(146, Math.max(...lines.map((l) => textWidth(l))) + 5);
      const h = lines.length * 9 + 2;
      const bx = Math.max(2, Math.min(W - w - 2, ax + 5 - w / 2));
      const by = Math.max(2, ay - 4 - h);
      box(bx, by, w, h, C.ink, C.slate);
      lines.forEach((l, i) => drawText(l, bx + 2, by + 2 + i * 9, a.barkLine!.color ?? C.pale));
    }
  }
  if (isDown('map') && !F.locked && !F.inCombat) markInteractables(cx, cy);
  if (F.interactHint && !F.locked && !F.inCombat) {
    const hx = F.interactHint.x * T - cx + 3, hy = F.interactHint.y * T - cy - 7;
    rect(hx, hy, 5, 1, C.amb3); rect(hx + 1, hy + 1, 3, 1, C.amb3); rect(hx + 2, hy + 2, 1, 1, C.amb3);
  }
  if (F.sneaking && !F.inCombat) {
    drawText('SNEAKING', 4, 4, C.vio3);
    if (ambushCheck()) drawText('E: ambush', 4, 14, C.mag3);
  }
}

/** Arrivals land on a door's step: a point two tiles out from a door moves onto the tile between. */
function onDoorstep(def: MapDef, p: Pt): Pt {
  const doors = (def.props ?? []).filter((q) => q.kind === 'door' && visibleIf(q));
  const doorAtPt = (x: number, y: number) => doors.some((q) => q.x === x && q.y === y);
  if (doorAtPt(p[0], p[1] - 1) || doorAtPt(p[0], p[1] + 1) || doorAtPt(p[0] - 1, p[1]) || doorAtPt(p[0] + 1, p[1])) return p;
  const m = parseMap(def);
  for (const [dx, dy] of [[0, 2], [0, -2], [2, 0], [-2, 0]]) {
    if (!doorAtPt(p[0] + dx, p[1] + dy)) continue;
    const mx = p[0] + dx / 2, my = p[1] + dy / 2;
    if (m.cells[my * m.w + mx]?.tile.walk) return [mx, my];
  }
  return p;
}

export function changeMapNow(to: string, at: string) {
  const def = MAPS.get(to);
  if (!def) { console.warn(`No map ${to}`); return; }
  const p = onDoorstep(def, def.markers?.[at] ?? def.markers?.start ?? [1, 1]);
  const dir = (def.markers && (def as MapDef & { dirs?: Record<string, Dir> }).dirs?.[at]) ?? G.dir;
  enterMap(to, p, dir);
}

export function placeActor(a: Actor, x: number, y: number) { a.tx = x; a.ty = y; a.px = x * T; a.py = y * T; a.path = []; a.moving = false; }

export function findActor(id: string): Actor | undefined {
  if (id === 'hero') return WORLD.actors.find((a) => a.id === 'hero');
  if (id === 'leader') return F.leader ?? undefined;
  return WORLD.actors.find((a) => a.id === id);
}
