// The field: maps, people, leads that move a beat before their owners, followers, encounters, and puzzles.
import { blit, stampLead, type Img } from '../engine/gfx';
import { addLight, addShaft, addSun, beginLight, composite } from '../engine/light';
import { C, PX } from '../engine/palette';
import { H, W, buf, clearLayers, shd } from '../engine/screen';
import { isDown, pressed, type Button } from '../engine/input';
import { REGIONS, type Region } from '../content/regions';
import { charFrame, charImgs, monImgs, propImgs, propTall, tileImgs, type CharImgs } from './art';
import { MAPS, buildMap, condOk, type EncounterDef, type MapRT, type NpcDef } from './map';
import { G, flag, setFlag, type Dir } from './state';
import { sfx, battleEvent } from '../audio';
import { SCENES } from './script';

export const TILE = 8;

export interface Actor {
  id: string;
  imgs: CharImgs | null;
  mon: string | null;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Where the lead is anchored. It reaches the next tile before the body does. */
  lx: number;
  ly: number;
  dir: Dir;
  moving: boolean;
  fromX: number;
  fromY: number;
  t: number;
  speed: number;
  step: number;
  animT: number;
  solid: boolean;
  visible: boolean;
  talk?: string;
  npc?: NpcDef;
  enc?: EncounterDef;
  wander?: { cx: number; cy: number; r: number; timer: number };
  path: [number, number][];
  emote: { kind: string; t: number } | null;
  /** Lead direction forced by a scene, until cleared. */
  leadDir: [number, number] | null;
  fade: number;
  height: number;
  /** Lot: a lead with no body. Drawn flat and dark. */
  flat?: boolean;
  bob: number;
}

const DIRS: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
export function dirVec(d: Dir): [number, number] { return DIRS[d]; }
export function vecDir(dx: number, dy: number): Dir {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

export const F = {
  map: null as MapRT | null,
  /** Where the hero arrived on this map, for leaving a stuck spot. */
  entry: [0, 0] as [number, number],
  region: REGIONS.stile as Region,
  actors: [] as Actor[],
  player: null as Actor | null,
  camX: 0,
  camY: 0,
  camTarget: null as { x: number; y: number } | null,
  camPanFrom: null as { x: number; y: number; t: number; dur: number; tx: number; ty: number } | null,
  staticShade: new Uint8Array(0),
  trail: [] as [number, number][],
  lamp: null as { x: number; y: number; t: number } | null,
  pebble: null as { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; landed: boolean } | null,
  grace: 0,
  time: 0,
  frozen: false,
  anims: new Map<string, { t: number }>(),
  tileOverride: new Map<number, string>(),
  pushed: new Map<string, [number, number]>(),
  hooks: {
    scene: (_id: string) => {},
    encounter: (_a: Actor) => {},
    menu: () => {},
    exit: (_to: string, _at: string) => {},
  },
};

export function sceneBusy(): boolean { return F.frozen; }

function mkActor(id: string, x: number, y: number, dir: Dir): Actor {
  return {
    id, imgs: null, mon: null, x, y, px: x * TILE, py: y * TILE, lx: x * TILE, ly: y * TILE, dir, moving: false, fromX: x, fromY: y,
    t: 0, speed: 5, step: 0, animT: Math.random() * 2, solid: true, visible: true, path: [], emote: null, leadDir: null, fade: 0, height: 8, bob: 0,
  };
}

export function actorById(id: string): Actor | undefined {
  if (id === 'nodus' || id === 'player') return F.player ?? undefined;
  return F.actors.find((a) => a.id === id);
}

export function partyFollowers(): string[] { return G.party.filter((m) => m !== 'nodus'); }

function memberArt(id: string): CharImgs {
  if (id === 'minim' && flag('ch4_freed')) return charImgs('minim_cracked');
  return charImgs(id);
}

/** Loads a map and puts the hero at a marker or tile. */
export function enterMap(id: string, at: string | [number, number], dir?: Dir) {
  const def = MAPS.get(id);
  if (!def) { console.warn('No map', id); return; }
  const prevRegion = G.region;
  const rt = buildMap(def);
  F.map = rt;
  F.region = REGIONS[def.region] ?? REGIONS.stile;
  if (def.region !== prevRegion && !(def.region === 'interior')) {
    if (G.region !== def.region) G.beaten = [];
    G.region = def.region;
  }
  let pos: [number, number] = typeof at === 'string' ? rt.markers.get(at) ?? rt.markers.get('start') ?? [1, 1] : at;
  if (typeof at === 'string' && !rt.markers.get(at)) console.warn('No marker', at, 'on', id);
  G.map = id; G.x = pos[0]; G.y = pos[1];
  F.entry = [pos[0], pos[1]];
  if (dir) G.dir = dir;
  F.actors = [];
  F.tileOverride.clear();
  F.pushed.clear();
  F.lamp = null;
  F.pebble = null;
  const p = mkActor('nodus', pos[0], pos[1], G.dir);
  p.imgs = charImgs('nodus');
  p.speed = 5.5;
  F.player = p;
  F.trail = [];
  // Followers start in a line behind the hero on open ground.
  const back = dirVec(G.dir);
  let fx = pos[0], fy = pos[1];
  for (const m of partyFollowers()) {
    const nx = fx - back[0], ny = fy - back[1];
    if (!blockedTile(nx, ny)) { fx = nx; fy = ny; }
    const a = mkActor(m, fx, fy, G.dir);
    a.imgs = memberArt(m);
    a.solid = false;
    a.flat = m === 'lot';
    if (m === 'lot' && (def.region === 'overhead')) a.visible = false;
    F.actors.push(a);
    F.trail.push([fx, fy]);
  }
  spawnPeople();
  refreshProps();
  computeStaticShade();
  snapCamera();
  F.grace = 1.2;
  resetArrival();
  arrivedAt = `${G.map}:${p.x},${p.y}`;
}

/** Adds or removes people whose conditions changed. Called after every scene. */
export function spawnPeople() {
  const rt = F.map;
  if (!rt) return;
  const has = (f: string) => flag(f);
  for (const n of rt.def.npcs ?? []) {
    const ok = condOk(n.cond, has);
    const cur = F.actors.find((a) => a.npc === n);
    if (ok && !cur && !F.actors.some((a) => a.id === n.id)) {
      const a = mkActor(n.id, n.x, n.y, n.dir ?? 'down');
      a.imgs = n.pal ? charImgs(n.art, n.pal) : charImgs(n.art);
      a.talk = n.talk;
      a.npc = n;
      a.solid = !n.ghost;
      if (n.wander) a.wander = { cx: n.x, cy: n.y, r: n.wander, timer: 1 + Math.random() * 3 };
      a.speed = 3;
      F.actors.push(a);
    } else if (!ok && cur && !cur.moving) {
      F.actors.splice(F.actors.indexOf(cur), 1);
    }
  }
  for (const e of rt.def.encounters ?? []) {
    if (G.beaten.includes(e.id) || !condOk(e.cond, has)) continue;
    if (F.actors.some((a) => a.enc === e)) continue;
    const a = mkActor(e.id, e.x, e.y, 'left');
    a.mon = e.art;
    a.enc = e;
    a.speed = 2.6;
    a.wander = { cx: e.x, cy: e.y, r: e.wander ?? 2, timer: 1 + Math.random() * 2 };
    F.actors.push(a);
  }
}

export function removeEncounter(a: Actor) {
  if (a.enc) G.beaten.push(a.enc.id);
  const i = F.actors.indexOf(a);
  if (i >= 0) F.actors.splice(i, 1);
}

export function tileAt(x: number, y: number) {
  const rt = F.map!;
  if (x < 0 || y < 0 || x >= rt.w || y >= rt.h) return null;
  return rt.tiles[y * rt.w + x];
}

const propSolid = new Set<string>();

/** Rebuilds which tiles props block, after a map load, a push, or a flag change. */
export function refreshProps() {
  propSolid.clear();
  for (const pr of F.map?.def.props ?? []) {
    if (pr.solid === false || !condOk(pr.cond, flag)) continue;
    const [x, y] = cratePos(pr.x, pr.y);
    propSolid.add(`${x},${y}`);
  }
}

export function blockedTile(x: number, y: number): boolean {
  const rt = F.map;
  if (!rt) return true;
  if (x < 0 || y < 0 || x >= rt.w || y >= rt.h) return true;
  const ov = F.tileOverride.get(y * rt.w + x);
  if (ov === 'open') return propSolid.has(`${x},${y}`);
  if (ov === 'shut' || (ov && ov.includes('pit'))) return true;
  for (const g of rt.def.gates ?? []) if (g.x === x && g.y === y) return !flag(g.flag) || propSolid.has(`${x},${y}`);
  return !!rt.solid[y * rt.w + x] || propSolid.has(`${x},${y}`);
}

export function isHiddenPit(x: number, y: number): boolean {
  return (F.map?.def.hiddenPits ?? []).some(([px, py]) => px === x && py === y);
}

function actorAt(x: number, y: number, except?: Actor): Actor | undefined {
  return F.actors.find((a) => a !== except && a.visible && a.solid && ((a.x === x && a.y === y) || (a.moving && a.fromX === x && a.fromY === y)));
}

function canStep(a: Actor, x: number, y: number): boolean {
  if (blockedTile(x, y)) return false;
  if (actorAt(x, y, a)) return false;
  if (a !== F.player && F.player && F.player.x === x && F.player.y === y) return false;
  return true;
}

export function startMove(a: Actor, d: Dir, force = false): boolean {
  a.dir = d;
  const [dx, dy] = dirVec(d);
  const nx = a.x + dx, ny = a.y + dy;
  if (!force && !canStep(a, nx, ny)) return false;
  a.fromX = a.x; a.fromY = a.y;
  a.x = nx; a.y = ny;
  a.t = 0;
  a.moving = true;
  return true;
}

function updateActor(a: Actor, dt: number) {
  a.animT += dt;
  if (a.emote) { a.emote.t -= dt; if (a.emote.t <= 0) a.emote = null; }
  if (a.moving) {
    const run = a === F.player && isDown('run') ? 1.7 : 1;
    a.t += dt * a.speed * run;
    const t = Math.min(1, a.t);
    a.px = (a.fromX + (a.x - a.fromX) * t) * TILE;
    a.py = (a.fromY + (a.y - a.fromY) * t) * TILE;
    // The lead gets to the next tile in a third of the time.
    const lt = Math.min(1, t * 3);
    a.lx = (a.fromX + (a.x - a.fromX) * lt) * TILE;
    a.ly = (a.fromY + (a.y - a.fromY) * lt) * TILE;
    if (a.t >= 0.5 && a.step % 2 === 0) a.step++;
    if (a.t >= 1) {
      a.moving = false;
      a.px = a.x * TILE; a.py = a.y * TILE;
      a.step++;
      if (a.path.length) {
        const [tx, ty] = a.path.shift()!;
        const d = vecDir(tx - a.x, ty - a.y);
        if (!startMove(a, d, true)) a.path = [];
      }
    }
  } else {
    a.lx += (a.px - a.lx) * Math.min(1, dt * 12);
    a.ly += (a.py - a.ly) * Math.min(1, dt * 12);
  }
  a.bob = a.moving && a.step % 2 === 1 && a === F.player ? 1 : 0;
}

/** Walks an actor along a path to a tile. Resolves when it arrives. */
export function walkPath(a: Actor, tx: number, ty: number): boolean {
  const path = findPath(a.x, a.y, tx, ty, a);
  if (!path) { a.path = []; return false; }
  a.path = path;
  if (!a.moving && a.path.length) {
    const [nx, ny] = a.path.shift()!;
    startMove(a, vecDir(nx - a.x, ny - a.y), true);
  }
  return true;
}

export function findPath(sx: number, sy: number, tx: number, ty: number, who?: Actor): [number, number][] | null {
  const rt = F.map;
  if (!rt) return null;
  if (sx === tx && sy === ty) return [];
  const w = rt.w, h = rt.h;
  const prev = new Int32Array(w * h).fill(-1);
  const q: number[] = [sy * w + sx];
  prev[sy * w + sx] = sy * w + sx;
  const goal = ty * w + tx;
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (prev[ni] !== -1) continue;
      if (ni !== goal && blockedTile(nx, ny)) continue;
      if (ni !== goal && who && F.actors.some((o) => o !== who && o.solid && o.visible && !o.moving && o.x === nx && o.y === ny && !partyFollowers().includes(o.id))) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (prev[goal] === -1) return null;
  const out: [number, number][] = [];
  let c = goal;
  while (c !== sy * w + sx) { out.unshift([c % w, (c / w) | 0]); c = prev[c]; }
  return out;
}

function updateFollowers() {
  const p = F.player!;
  const fol = partyFollowers().map((m) => F.actors.find((a) => a.id === m)).filter((a): a is Actor => !!a);
  fol.forEach((a, i) => {
    if (a.moving || a.path.length) return;
    const target = F.trail[i];
    if (!target) return;
    if (a.x === target[0] && a.y === target[1]) return;
    const dx = target[0] - a.x, dy = target[1] - a.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      a.speed = p.speed * (isDown('run') ? 1.7 : 1);
      startMove(a, vecDir(dx, dy), true);
      a.speed = p.speed;
    } else {
      walkPath(a, target[0], target[1]);
    }
  });
}

function pushTrail(x: number, y: number) {
  F.trail.unshift([x, y]);
  if (F.trail.length > 8) F.trail.length = 8;
}

const MOVE_KEYS: [Button, Dir][] = [['up', 'up'], ['down', 'down'], ['left', 'left'], ['right', 'right']];
let lastHeld: Dir | null = null;

/** One frame of free movement and interaction. */
export function updateField(dt: number, controllable: boolean) {
  const rt = F.map;
  const p = F.player;
  if (!rt || !p) return;
  F.time += dt;
  F.grace = Math.max(0, F.grace - dt);
  for (const a of F.anims.values()) a.t += dt;
  if (controllable && !p.moving) {
    let want: Dir | null = null;
    for (const [b, d] of MOVE_KEYS) if (isDown(b)) { if (!want || d === lastHeld) want = d; }
    if (want) {
      lastHeld = want;
      const [dx, dy] = dirVec(want);
      const fromX = p.x, fromY = p.y;
      if (tryPush(p.x + dx, p.y + dy, dx, dy) || startMove(p, want)) {
        pushTrail(fromX, fromY);
        stepSound(p.x, p.y);
      } else if (p.dir !== want) p.dir = want;
      else if (pressed(want as Button)) sfx('bump');
    } else lastHeld = null;
    if (pressed('a')) interact();
    else if (pressed('b')) F.hooks.menu();
    else if (pressed('c')) throwPebble();
    else if (pressed('lamp')) toggleLamp();
  }
  updateActor(p, dt);
  if (!p.moving && controllable) arrived();
  for (const a of F.actors) {
    updateActor(a, dt);
    if (a.wander && !a.moving && !F.frozen) wanderStep(a, dt);
  }
  updateFollowers();
  if (F.pebble) {
    F.pebble.t += dt;
    if (!F.pebble.landed && F.pebble.t >= F.pebble.dur) { F.pebble.landed = true; pebbleLand(); }
    if (F.pebble.t >= F.pebble.dur + 0.4) F.pebble = null;
  }
  if (controllable) checkEncounters();
  updatePlates();
  updateCamera(dt);
}

let arrivedAt = '';
function arrived() {
  const p = F.player!;
  const key = `${G.map}:${p.x},${p.y}`;
  if (key === arrivedAt) return;
  arrivedAt = key;
  G.x = p.x; G.y = p.y; G.dir = p.dir;
  const rt = F.map!;
  const has = (f: string) => flag(f);
  if (isHiddenPit(p.x, p.y) && !F.tileOverride.get(p.y * rt.w + p.x)) {
    F.tileOverride.set(p.y * rt.w + p.x, 'stile_pit');
    sfx('thud');
    stepBack();
    F.hooks.scene('pit_fall');
    return;
  }
  for (const e of rt.def.exits ?? []) {
    if (p.x >= e.x && p.x < e.x + (e.w ?? 1) && p.y >= e.y && p.y < e.y + (e.h ?? 1)) {
      if (!condOk(e.cond, has)) { if (e.blocked) { F.hooks.scene(e.blocked); stepBack(); } continue; }
      F.hooks.exit(e.to, e.at);
      return;
    }
  }
  for (const t of rt.def.triggers ?? []) {
    if (p.x >= t.x && p.x < t.x + (t.w ?? 1) && p.y >= t.y && p.y < t.y + (t.h ?? 1) && condOk(t.cond, has)) {
      F.hooks.scene(t.scene);
      return;
    }
  }
}

function stepBack() {
  const p = F.player!;
  const back = F.trail[0];
  if (!back) return;
  p.x = back[0]; p.y = back[1]; p.px = p.x * TILE; p.py = p.y * TILE; p.lx = p.px; p.ly = p.py;
  arrivedAt = `${G.map}:${p.x},${p.y}`;
}

export function resetArrival() { arrivedAt = ''; }

function stepSound(x: number, y: number) {
  const t = tileAt(x, y);
  const mat = t?.step ?? F.region.step;
  sfx('step_' + mat, { vol: 0.55, pitch: 0.9 + Math.random() * 0.2 });
}

function wanderStep(a: Actor, dt: number) {
  const w = a.wander!;
  w.timer -= dt;
  if (w.timer > 0) return;
  w.timer = 0.8 + Math.random() * 2.4;
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  const d = dirs[(Math.random() * 4) | 0];
  const [dx, dy] = dirVec(d);
  const nx = a.x + dx, ny = a.y + dy;
  if (Math.abs(nx - w.cx) > w.r || Math.abs(ny - w.cy) > w.r) { a.dir = d; return; }
  startMove(a, d);
}

function facingTile(): [number, number] {
  const p = F.player!;
  const [dx, dy] = dirVec(p.dir);
  return [p.x + dx, p.y + dy];
}

/** The scene a party member answers with: one for this map, then one for the region, then their own. */
function memberTalk(id: string): string | null {
  const tries = [`talk_${id}_${G.map}`, `talk_${id}_${F.region.id}`, `talk_${id}`];
  if (id === 'parhelia' && G.map === 'gully') tries.unshift('talk_parhelia_shack');
  return tries.find((s) => SCENES.has(s)) ?? null;
}

function interact() {
  const [tx, ty] = facingTile();
  const rt = F.map!;
  const has = (f: string) => flag(f);
  const who = F.actors.find((a) => a.visible && a.x === tx && a.y === ty && (a.talk || a.npc));
  if (who && who.talk) {
    if (!who.flat) who.dir = vecDir(F.player!.x - who.x, F.player!.y - who.y);
    F.hooks.scene(who.talk);
    return;
  }
  // A party member walking behind the hero answers when the hero turns to them.
  const mate = F.actors.find((a) => a.visible && a !== F.player && a.x === tx && a.y === ty && G.party.includes(a.id));
  const mateTalk = mate && memberTalk(mate.id);
  if (mate && mateTalk) {
    if (!mate.flat) mate.dir = vecDir(F.player!.x - mate.x, F.player!.y - mate.y);
    F.hooks.scene(mateTalk);
    return;
  }
  // Counters: talk across a desk.
  const [dx, dy] = dirVec(F.player!.dir);
  const far = F.actors.find((a) => a.visible && a.x === tx + dx && a.y === ty + dy && a.talk && tileAt(tx, ty)?.solid);
  if (far && far.talk) { F.hooks.scene(far.talk); return; }
  for (const pr of rt.def.props ?? []) if (pr.x === tx && pr.y === ty && pr.talk && condOk(pr.cond, has)) { F.hooks.scene(pr.talk); return; }
  for (const t of rt.def.talks ?? []) if (t.x === tx && t.y === ty && condOk(t.cond, has)) { F.hooks.scene(t.scene); return; }
}

// ---- Puzzles: crates, shade plates, pebbles ----

function propKey(x: number, y: number) { return `${x},${y}`; }

/** Where a pushable crate stands now. */
export function cratePos(ox: number, oy: number): [number, number] { return F.pushed.get(propKey(ox, oy)) ?? [ox, oy]; }

/** Pushes a crate one tile if the hero walks into it and the far tile is open. The hero then steps in. */
function tryPush(x: number, y: number, dx: number, dy: number): boolean {
  const rt = F.map!;
  for (const pr of rt.def.props ?? []) {
    if (pr.art !== 'crate') continue;
    const [cx, cy] = cratePos(pr.x, pr.y);
    if (cx !== x || cy !== y) continue;
    const nx = cx + dx, ny = cy + dy;
    const t = tileAt(nx, ny);
    if (!t || t.water || actorAt(nx, ny) || blockedTile(nx, ny)) return false;
    F.pushed.set(propKey(pr.x, pr.y), [nx, ny]);
    refreshProps();
    sfx('bump', { pitch: 0.7 });
    return false;
  }
  return false;
}

/** Tiles covered by a caster's lead, by the same rule battles use. */
export function leadTiles(x: number, y: number, height: number): [number, number][] {
  const out: [number, number][] = [];
  let dx = 0, dy = 0, len = 0;
  if (F.lamp && Math.hypot(x - F.lamp.x, y - F.lamp.y) <= 3.5) {
    const vx = x - F.lamp.x, vy = y - F.lamp.y;
    if (vx === 0 && vy === 0) return out;
    dx = Math.sign(vx) * (Math.abs(vx) * 2 >= Math.abs(vy) ? 1 : 0);
    dy = Math.sign(vy) * (Math.abs(vy) * 2 >= Math.abs(vx) ? 1 : 0);
    len = 2 * height;
  } else {
    const [sx, sy] = F.region.dir8;
    if (!F.region.sun || (sx === 0 && sy === 0)) return out;
    dx = sx; dy = sy;
    len = Math.round(F.region.battleLowness * height);
  }
  for (let k = 1; k <= len; k++) out.push([x + dx * k, y + dy * k]);
  return out;
}

export const platesLit = new Set<string>();

/** Plates are lit while a lead lies on them. When every plate of a group is lit at once, its flag latches. */
function updatePlates() {
  const rt = F.map!;
  const plates = rt.def.plates ?? [];
  platesLit.clear();
  if (!plates.length) return;
  const covered = new Set<string>();
  const cast = (x: number, y: number, h: number) => { for (const [tx, ty] of leadTiles(x, y, h)) covered.add(`${tx},${ty}`); };
  // Only things cast onto plates: crates, posts, and other props. People's leads are too thin to press one.
  for (const pr of rt.def.props ?? []) { if (!condOk(pr.cond, flag) || pr.lead === false) continue; const [x, y] = cratePos(pr.x, pr.y); cast(x, y, propTall(pr.art) ? 2 : 1); }
  const groups = new Map<string, boolean>();
  for (const pl of plates) {
    const on = covered.has(`${pl.x},${pl.y}`);
    if (on) platesLit.add(`${pl.x},${pl.y}`);
    groups.set(pl.flag, (groups.get(pl.flag) ?? true) && on);
  }
  for (const [f, all] of groups) if (all && !flag(f)) { setFlag(f); sfx('glass_chime'); refreshProps(); }
}

function throwPebble() {
  const p = F.player!;
  if (F.pebble) return;
  const [dx, dy] = dirVec(p.dir);
  let dist = 3;
  for (let k = 1; k <= 3; k++) { const t = tileAt(p.x + dx * k, p.y + dy * k); if (!t || (t.solid && !t.pit && !t.water)) { dist = k - 1; break; } }
  if (dist <= 0) { sfx('bump'); return; }
  F.pebble = { x0: p.x, y0: p.y, x1: p.x + dx * dist, y1: p.y + dy * dist, t: 0, dur: 0.45, landed: false };
  sfx('pebble_throw');
}

function pebbleLand() {
  const pb = F.pebble!;
  const t = tileAt(pb.x1, pb.y1);
  if (t?.pit || isHiddenPit(pb.x1, pb.y1)) {
    sfx('fade', { pitch: 0.6 });
    if (isHiddenPit(pb.x1, pb.y1)) F.tileOverride.set(pb.y1 * F.map!.w + pb.x1, 'stile_pit');
    F.hooks.scene('pebble_pit');
  }
  else if (t?.water) sfx('pebble_land', { pitch: 0.6 });
  else sfx('pebble_land', { pitch: 0.9 + Math.random() * 0.25 });
}

/** Whether the party carries a light it can set down in the field. */
export function hasFieldLamp(): boolean {
  if (G.party.includes('parhelia') && flag('ch1_oil')) return true;
  return !!G.items.lantern && flag('ch5_done') && !flag('ch6_done');
}

function toggleLamp() {
  if (!hasFieldLamp()) { sfx('menu_bad'); return; }
  if (F.lamp) { F.lamp = null; sfx('hood'); battleEvent('lamp_off'); return; }
  const [tx, ty] = facingTile();
  if (blockedTile(tx, ty) || actorAt(tx, ty)) { sfx('bump'); return; }
  F.lamp = { x: tx, y: ty, t: 0 };
  sfx('lamp_light');
  battleEvent('lamp_on');
}

// ---- Encounters ----

function checkEncounters() {
  if (F.grace > 0 || F.frozen) return;
  const p = F.player!;
  for (const a of F.actors) {
    if (!a.enc || !a.visible) continue;
    const d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y);
    if (d <= 1 && !p.moving) { F.hooks.encounter(a); return; }
  }
}

// ---- Camera ----

export function snapCamera() {
  const p = F.player!;
  const rt = F.map!;
  F.camX = clampCam(p.px + 4 - W / 2, rt.w * TILE, W);
  F.camY = clampCam(p.py + 4 - H / 2, rt.h * TILE, H);
}

function clampCam(v: number, size: number, view: number): number {
  if (size <= view) return Math.round((size - view) / 2);
  return Math.round(Math.max(0, Math.min(size - view, v)));
}

export function panCamera(tx: number, ty: number, dur: number) {
  F.camPanFrom = { x: F.camX, y: F.camY, t: 0, dur: Math.max(0.01, dur), tx, ty };
}

function updateCamera(dt: number) {
  const rt = F.map!;
  if (F.camPanFrom) {
    const c = F.camPanFrom;
    c.t += dt;
    const k = Math.min(1, c.t / c.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const tx = clampCam(c.tx - W / 2, rt.w * TILE, W), ty = clampCam(c.ty - H / 2, rt.h * TILE, H);
    F.camX = Math.round(c.x + (tx - c.x) * e);
    F.camY = Math.round(c.y + (ty - c.y) * e);
    if (k >= 1 && F.camTarget === null) { /* hold */ }
    return;
  }
  const p = F.player!;
  F.camX = clampCam(Math.round(p.px) + 4 - W / 2, rt.w * TILE, W);
  F.camY = clampCam(Math.round(p.py) + 4 - H / 2, rt.h * TILE, H);
}

export function releaseCamera() { F.camPanFrom = null; }

// ---- Leads and light ----

function computeStaticShade() {
  const rt = F.map!;
  const mw = rt.w * TILE, mh = rt.h * TILE;
  F.staticShade = new Uint8Array(mw * mh);
  const sun = F.region.sun;
  if (!sun || F.region.lowness <= 0) return;
  // Walls cast shorter leads than people do, so buildings frame the street without swallowing it.
  const len = Math.min(F.region.lowness, 1.6);
  for (let ty = 0; ty < rt.h; ty++) for (let tx = 0; tx < rt.w; tx++) {
    const t = rt.tiles[ty * rt.w + tx];
    if (!t.wall) continue;
    const L = t.wall * len;
    const steps = Math.ceil(L);
    for (let k = 1; k <= steps; k++) {
      const ox = Math.round(tx * TILE + sun.dx * k), oy = Math.round(ty * TILE + sun.dy * k);
      // The last few pixels of a wall's lead thin out in dither.
      const v = k > steps - 4 ? 120 : 255;
      for (let yy = oy; yy < oy + TILE; yy++) {
        if (yy < 0 || yy >= mh) continue;
        for (let xx = ox; xx < ox + TILE; xx++) {
          if (xx < 0 || xx >= mw) continue;
          const i = yy * mw + xx;
          if (F.staticShade[i] < v) F.staticShade[i] = v;
        }
      }
    }
  }
}

/**
 * The big lead over Stile: the party standing side by side on the hill, their outline stretched across the town.
 * Each person's height profile becomes one solid band, so the lead reads as one dark shape with bumps.
 */
function drawBigLead() {
  const bl = F.map!.def.bigLead;
  if (!bl) return;
  const people = bigLeadPeople();
  // One profile value per row of the band: how tall the outline is there, 0 for a gap.
  const prof: number[] = [];
  for (const person of people) {
    const im = person.im;
    const cols: number[] = [];
    for (let sx = 0; sx < im.w; sx++) {
      let top = 0;
      for (let sy = 0; sy < im.h; sy++) if (im.slot[sy * im.w + sx]) { top = im.h - sy; break; }
      cols.push(person.gap ? 0 : top);
    }
    // Trim empty columns at the sides so people stand shoulder to shoulder.
    let a = 0, b = cols.length - 1;
    while (a < b && cols[a] === 0) a++;
    while (b > a && cols[b] === 0) b--;
    for (let i = a; i <= b; i++) { prof.push(cols[i]); prof.push(cols[i]); }
    if (person.gap) for (let i = 0; i < 6; i++) prof.push(0);
  }
  // Smooth single-pixel notches so the outline does not stripe.
  const sm = prof.map((v, i) => Math.max(v, Math.min(prof[i - 1] ?? 0, prof[i + 1] ?? 0)));
  const baseX = bl.x * TILE - F.camX, baseY = bl.y * TILE - F.camY;
  const scale = bl.len / 8;
  sm.forEach((h, row) => {
    if (h <= 0) return;
    const yy = baseY + row;
    if (yy < 0 || yy >= H) return;
    const len = h * scale;
    const edge = row === 0 || row === sm.length - 1 || sm[row - 1] === 0 || sm[row + 1] === 0;
    for (let k = 0; k < len; k++) {
      const xx = Math.round(baseX + k);
      if (xx < 0 || xx >= W) continue;
      const i = yy * W + xx;
      let v = k > len - 10 ? 90 + ((len - k) / 10) * 120 : 255;
      if (edge) v = Math.min(v, 150);
      if (shd[i] < v) shd[i] = v;
    }
  });
}

function bigLeadPeople(): { im: Img; gap?: boolean }[] {
  const out: { im: Img; gap?: boolean }[] = [];
  const side = (id: string) => charImgs(id).side[0];
  out.push({ im: side('nodus') });
  out.push({ im: side('parhelia') });
  if (flag('ch2_lot_joined') && !flag('lot_rejoined')) out.push({ im: side('lot') });
  if (flag('ch3_umbra_joined')) out.push({ im: side('umbraculum') });
  if (flag('ch4_minim_joined')) out.push({ im: side('minim') });
  if (flag('ch6_tik_joined')) out.push({ im: side('tik'), gap: !flag('lot_rejoined') });
  return out;
}

function actorLead(a: Actor): { dx: number; dy: number; len: number } | null {
  if (a.flat || a.height <= 0) return null;
  const reg = F.region;
  if (a.id === 'tik' && !flag('lot_rejoined')) return null;
  const cx = a.lx / TILE, cy = a.ly / TILE;
  if (F.lamp && Math.hypot(cx - F.lamp.x, cy - F.lamp.y) <= 3.5) {
    const vx = cx - F.lamp.x, vy = cy - F.lamp.y;
    const d = Math.hypot(vx, vy);
    if (d < 0.3) return null;
    return { dx: vx / d, dy: vy / d, len: 10 + d * 4 };
  }
  for (const l of F.map!.def.lights ?? []) {
    if (!condOk(l.cond, flag)) continue;
    const vx = cx - l.x, vy = cy - l.y;
    const d = Math.hypot(vx, vy);
    if (d > 0.3 && d <= l.r / TILE * 0.6) return { dx: vx / d, dy: vy / d, len: 8 + d * 3 };
  }
  if (a.leadDir) return { dx: a.leadDir[0], dy: a.leadDir[1], len: 24 };
  if (!reg.sun || reg.lowness <= 0) return null;
  return { dx: reg.sun.dx, dy: reg.sun.dy, len: reg.lowness * a.height };
}

export function renderField() {
  const rt = F.map;
  if (!rt) return;
  const cx = F.camX, cy = F.camY;
  renderMapBase(cx, cy);
  drawFieldThings(cx, cy);
  lightField();
}

/** Tiles, wall leads, the big lead, and plates, for the field and for battles. */
export function renderMapBase(cx: number, cy: number) {
  const rt = F.map!;
  clearLayers();
  // Small maps leave screen outside their edges, and old frames must not show through there.
  buf.fill(PX[C.black]);
  const tx0 = Math.floor(cx / TILE), ty0 = Math.floor(cy / TILE);
  const frame = Math.floor(F.time * 2.5);
  for (let ty = ty0 - 1; ty <= ty0 + H / TILE + 1; ty++) {
    for (let tx = tx0 - 1; tx <= tx0 + W / TILE + 1; tx++) {
      if (tx < 0 || ty < 0 || tx >= rt.w || ty >= rt.h) continue;
      const spec = rt.tiles[ty * rt.w + tx];
      const ov = F.tileOverride.get(ty * rt.w + tx);
      const id = ov && ov !== 'open' && ov !== 'shut' ? ov : spec.t;
      if (spec.under) { const u = tileImgs(spec.under); blit(u[0], tx * TILE - cx, ty * TILE - cy, { kind: 0 }); }
      const ims = tileImgs(id);
      const im = ims[(frame + tx * 7 + ty * 3) % ims.length] ?? ims[0];
      blit(im, tx * TILE - cx, ty * TILE - cy, { kind: 0 });
    }
  }
  // Static leads from walls and roofs.
  const mw = rt.w * TILE;
  if (F.staticShade.length) {
    for (let y = 0; y < H; y++) {
      const my = y + cy;
      if (my < 0 || my >= rt.h * TILE) continue;
      for (let x = 0; x < W; x++) {
        const mx = x + cx;
        if (mx < 0 || mx >= mw) continue;
        const v = F.staticShade[my * mw + mx];
        if (v) shd[y * W + x] = v;
      }
    }
  }
  drawBigLead();
  // Painted leads: hard edges, and no light moves them.
  for (const p of rt.def.painted ?? []) {
    if (!condOk(p.cond, flag)) continue;
    for (let yy = p.y * TILE - cy; yy < (p.y + p.h) * TILE - cy; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = p.x * TILE - cx; xx < (p.x + p.w) * TILE - cx; xx++) if (xx >= 0 && xx < W) shd[yy * W + xx] = 255;
    }
  }
  // Shade plates and gates.
  for (const pl of rt.def.plates ?? []) {
    const on = flag(pl.flag) || platesLit.has(`${pl.x},${pl.y}`);
    const ims = tileImgs(on ? 'stile_plate_on' : 'stile_plate_off');
    blit(ims[0], pl.x * TILE - cx, pl.y * TILE - cy, { kind: 0 });
  }
  for (const g of rt.def.gates ?? []) if (flag(g.flag)) blit(tileImgs(g.open)[0], g.x * TILE - cx, g.y * TILE - cy, { kind: 0 });
}

function drawFieldThings(cx: number, cy: number) {
  const rt = F.map!;
  const frame = Math.floor(F.time * 2.5);
  // Props, people, and their leads, back to front.
  type Drawable = { y: number; draw: () => void; lead?: () => void };
  const list: Drawable[] = [];
  for (const pr of rt.def.props ?? []) {
    if (!condOk(pr.cond, flag)) continue;
    const [px, py] = cratePos(pr.x, pr.y);
    const ims = propImgs(pr.art);
    const im = ims[frame % ims.length];
    const x = px * TILE - cx, y = py * TILE - cy - (im.h - TILE);
    list.push({
      y: py * TILE + 7,
      draw: () => blit(im, x, y, { kind: 2 }),
      lead: pr.lead === false ? undefined : () => {
        const sun = F.region.sun;
        if (F.lamp && Math.hypot(px - F.lamp.x, py - F.lamp.y) <= 3.5) {
          const vx = px - F.lamp.x, vy = py - F.lamp.y, d = Math.hypot(vx, vy) || 1;
          stampLead(im, x, y, vx / d, vy / d, 10 + d * 4);
        } else if (sun && F.region.lowness > 0) stampLead(im, x, y, sun.dx, sun.dy, F.region.lowness * im.h);
      },
    });
  }
  const all = [F.player!, ...F.actors];
  for (const a of all) {
    if (!a.visible) continue;
    let im: Img;
    let flip = false;
    if (a.mon) {
      const ims = monImgs(a.mon);
      im = ims[Math.floor(a.animT * 3) % Math.max(1, ims.length - (ims.length > 2 ? 1 : 0))];
      flip = a.dir === 'right';
    } else if (a.imgs) {
      const f = charFrame(a.imgs, a.dir, a.moving ? a.step : 0);
      im = f.im; flip = f.flip;
    } else continue;
    const x = Math.round(a.px) - cx, y = Math.round(a.py) - cy - a.bob - (im.h - TILE);
    const leadX = Math.round(a.lx) - cx, leadY = Math.round(a.ly) - cy - (im.h - TILE);
    list.push({
      y: a.py + 7,
      draw: () => {
        if (a.flat) blit(im, x, y, { kind: 2, fade: 0.25 });
        else blit(im, x, y, { kind: 2, flip, fade: a.fade });
      },
      lead: () => {
        const l = actorLead(a);
        if (l) stampLead(im, leadX, leadY, l.dx, l.dy, l.len, flip);
      },
    });
  }
  list.sort((p, q) => p.y - q.y);
  for (const d of list) d.draw();
  for (const d of list) d.lead?.();
  // Pebble: its lead lands first, then the pebble.
  if (F.pebble) {
    const pb = F.pebble;
    const k = Math.min(1, pb.t / pb.dur);
    const lk = Math.min(1, k * 2.2);
    const lx = (pb.x0 + (pb.x1 - pb.x0) * lk) * TILE + 3 - cx, ly = (pb.y0 + (pb.y1 - pb.y0) * lk) * TILE + 5 - cy;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 3; xx++) { const i = (Math.round(ly) + yy) * W + Math.round(lx) + xx; if (i >= 0 && i < W * H) shd[i] = 255; }
    if (!pb.landed || pb.t < pb.dur + 0.4) {
      const px = (pb.x0 + (pb.x1 - pb.x0) * k) * TILE + 3 - cx, py = (pb.y0 + (pb.y1 - pb.y0) * k) * TILE + 3 - cy - Math.sin(k * Math.PI) * 10;
      const t = tileAt(pb.x1, pb.y1);
      if (!(pb.landed && t?.pit)) blit(PEBBLE, px, py, { kind: 2 });
    }
  }
}

/** Draws the map's props only (for battles, where people are drawn by the battle screen). */
export function drawProps(cx: number, cy: number) {
  const rt = F.map!;
  for (const pr of rt.def.props ?? []) {
    if (!condOk(pr.cond, flag)) continue;
    const [px, py] = cratePos(pr.x, pr.y);
    const im = propImgs(pr.art)[0];
    blit(im, px * TILE - cx, py * TILE - cy - (im.h - TILE), { kind: 2 });
  }
}

import { img } from '../engine/gfx';
const PEBBLE = img(['.11.', '1221', '.11.'], [C.black, C.gray, C.gray]);

function lightField() { lightScene(F.camX, F.camY, [], null); }

/** Lights the frame: the region's sun, map lights, the field lamp, and any extra lamps (in pixels). */
export function lightScene(cx: number, cy: number, extra: { x: number; y: number; r: number; i: number; color: number }[], beam: { x: number; y: number; angle: number } | null) {
  const rt = F.map!;
  const reg = F.region;
  const blocks = reg.sun ? null : (sx: number, sy: number) => {
    const tx = Math.floor((sx + cx) / TILE), ty = Math.floor((sy + cy) / TILE);
    const t = tileAt(tx, ty);
    return !t || !!t.wall;
  };
  beginLight(reg.ambient, blocks, reg.shade);
  if (reg.sun) addSun(reg.sun.dx, reg.sun.dy, reg.sun.z, reg.sun.intensity, reg.sun.color);
  for (const s of rt.def.shafts ?? []) {
    addShaft(s.x * TILE - cx, s.y * TILE - cy, s.w * TILE, s.h * TILE, 1, 0.3, 40, 0.28, 0xffd890);
  }
  for (const l of rt.def.lights ?? []) {
    if (!condOk(l.cond, flag)) continue;
    const flick = 1 + Math.sin(F.time * 1.3 + l.x) * 0.03;
    addLight(l.x * TILE + 4 - cx, l.y * TILE + 4 - cy, l.r, l.i * flick, l.color, { z: 10 });
  }
  if (F.lamp) {
    F.lamp.t += 1 / 60;
    const k = Math.min(1, F.lamp.t * 2.5);
    addLight(F.lamp.x * TILE + 4 - cx, F.lamp.y * TILE + 4 - cy, 34 * k, 1.6 * k, 0xffc070, { z: 8 });
  }
  if (!reg.sun && F.player && !extra.length && !beam) {
    // In the dark the party carries its lantern while it has one. Without it, a faint circle keeps the way readable.
    const p = F.player;
    if (reg.id === 'back' && !F.lamp) {
      if (hasFieldLamp()) addLight(p.px + 4 - cx, p.py + 4 - cy, 26, 1.0, 0xffc070, { z: 8 });
      else addLight(p.px + 4 - cx, p.py + 4 - cy, 14, 0.5, 0x8a80d0, { z: 6 });
    }
  }
  for (const l of extra) addLight(l.x, l.y, l.r, l.i, l.color, { z: 8 });
  if (beam) {
    // A wedge of white light from the Great Lamp.
    for (let k = 0; k < 9; k++) {
      const d = 12 + k * 10;
      addLight(beam.x + Math.cos(beam.angle) * d, beam.y + Math.sin(beam.angle) * d, 10 + k * 3, 0.9, 0xffffff, { z: 12, through: true });
    }
  }
  composite();
}

export function setLamp(x: number | null, y = 0) {
  if (x === null) { if (F.lamp) battleEvent('lamp_off'); F.lamp = null; return; }
  F.lamp = { x, y, t: 0 };
  battleEvent('lamp_on');
}
