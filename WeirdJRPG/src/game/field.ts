import { ctx, rect, dither, px as pxl, faded, W, H, withTarget, screenCtx } from '../engine/screen';
import { buf, beginLight, addLight, composite, spriteNormals, rgbf, hex } from '../engine/light';
import { rfill, rpx, rdither, rart, routline } from '../engine/raster';
import { text, textWidth } from '../engine/font';
import { input } from '../engine/input';
import { spr, outline, type Art } from '../engine/sprites';
import { sfx, playMusic } from '../engine/audio';
import { S, fmax, flag, setFlag } from './state';
import { MAPS, game, goal } from './registry';
import { TILESETS, type TileDef } from './tiles';
import { AVATAR, LB, VORN, SEER, NULL_FIG, NPC, ENEMY_ART, PICKUP, STEADY_ART, SENSE_ICON } from './art';
import { BRASS, SEA, STONE, YEAR, VOID, UI, MOOD_COLOR } from './palette';
import type { EntDef, DrifterDef, MapDef, ScriptFn } from './types';
import { run, busy } from './script';
import { dlg } from './dialogue';
import { toast, panel, drawToasts } from './ui';
import { hashStr } from '../battle/rng';
import { breathe, stride } from './anim';

/** Field art that stands for an object rather than someone, so it never breathes or walks. */
const STILL_NPC = new Set(['watchman_statue', 'gear', 'letter', 'flowerbig', 'pages', 'symbol', 'stone']);

function isPerson(art: EntDef['art']): boolean {
  if (typeof art !== 'string') return false;
  if (art === 'vorn') return true;
  const [kind, name] = art.includes(':') ? art.split(':') : ['npc', art];
  return kind === 'npc' && !!NPC[name] && !STILL_NPC.has(name);
}
import { SENSES, SENSE_NAME, type SenseId } from '../battle/model';

export const DX = [0, -1, 1, 0], DY = [1, 0, 0, -1];

export interface Ent {
  def: EntDef;
  x: number; y: number; px: number; py: number; dir: number;
  move: { tx: number; ty: number; t: number; dur: number } | null;
  home: { x: number; y: number };
  wanderT: number;
  frames: Art[];
  hiddenNow: boolean;
  removed: boolean;
}

interface Drifter {
  def: DrifterDef; x: number; y: number; px: number; py: number;
  move: { tx: number; ty: number; t: number; dur: number } | null;
  t: number; alive: boolean; frames: Art[];
}

export const F = {
  map: null as MapDef | null,
  rows: [] as string[][],
  w: 0, h: 0,
  revealed: new Uint8Array(0),
  ents: [] as Ent[],
  drifters: [] as Drifter[],
  p: { x: 0, y: 0, px: 0, py: 0, dir: 0, move: null as { tx: number; ty: number; t: number; dur: number } | null, frame: 0 },
  trail: [] as { x: number; y: number }[],
  trueSight: false,
  scent: null as { path: [number, number][]; t: number } | null,
  ring: null as { cursor: number } | null,
  banner: 0,
  safe: 0,
  /** Frames after a field fight when drifters stop chasing, cannot start a fight, and draw faded. */
  rest: 0,
  beaten: new Set<string>(),
  breakT: 0,
  cam: { x: 0, y: 0 },
  hearT: 0,
  onBattle: null as null | ((group: string, d: { id: string }) => void),
  onSense: null as null | ((s: SenseId) => void),
  followers: [] as ('vorn' | 'lb')[],
  frozen: false,
  timer: null as null | { t: number; label: string; fail: () => import('./types').Script },
  stillT: 0,
};

// ---------- Art lookup ----------

export function frames(key: EntDef['art']): Art[] {
  if (!key) return [];
  if (typeof key !== 'string') return (Array.isArray(key[0]) ? key : [key]) as Art[];
  const [kind, name] = key.includes(':') ? key.split(':') : ['npc', key];
  const one = (a: Art | Art[] | undefined): Art[] => (!a ? [] : Array.isArray(a[0]) ? (a as Art[]) : [a as Art]);
  switch (kind) {
    case 'npc': return one(NPC[name]);
    case 'enemy': return one(ENEMY_ART[name]);
    case 'pickup': return one(PICKUP[name]);
    case 'avatar': return AVATAR[name] || AVATAR.snake;
    case 'lb': return LB;
    case 'vorn': return VORN;
    case 'seer': return SEER;
    case 'null': return [NULL_FIG];
    case 'steady': return STEADY_ART;
  }
  return [];
}

// ---------- Tiles ----------

export function tileAt(x: number, y: number): TileDef | null {
  if (!F.map || x < 0 || y < 0 || x >= F.w || y >= F.h) return null;
  const ch = F.rows[y][x];
  return F.map.legend?.[ch] || TILESETS[F.map.area][ch] || TILESETS[F.map.area]['.'];
}

export function setTile(x: number, y: number, ch: string): void { if (F.rows[y]) F.rows[y][x] = ch; }
export function tileChar(x: number, y: number): string { return F.rows[y]?.[x] ?? ' '; }

function solidTile(x: number, y: number): boolean {
  const t = tileAt(x, y);
  if (!t) return true;
  if (t.lie) return false;
  return !!t.solid;
}

// ---------- Reveal ----------

function idx(x: number, y: number): number { return y * F.w + x; }
export function revealed(x: number, y: number): boolean { return !!F.map?.known || F.revealed[idx(x, y)] === 1; }

function reveal(): void {
  const r = F.map?.sight ?? 5;
  const { x, y } = F.p;
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (xx < 0 || yy < 0 || xx >= F.w || yy >= F.h) continue;
    if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r + 1) F.revealed[idx(xx, yy)] = 1;
  }
  if (F.map?.forgets) {
    const far = r + 4;
    for (let i = 0; i < F.revealed.length; i++) {
      if (!F.revealed[i]) continue;
      const xx = i % F.w, yy = Math.floor(i / F.w);
      if ((xx - x) ** 2 + (yy - y) ** 2 > far * far && hashStr(`${i}:${game.tick >> 5}`) % 9 === 0) F.revealed[i] = 0;
    }
  }
}

export function saveReveal(): void {
  if (!F.map || F.map.known) return;
  let s = '';
  for (let i = 0; i < F.revealed.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) if (F.revealed[i + k]) b |= 1 << k;
    s += String.fromCharCode(b);
  }
  S.revealed[F.map.id] = btoa(s);
}

function loadReveal(): void {
  F.revealed = new Uint8Array(F.w * F.h);
  const raw = F.map ? S.revealed[F.map.id] : undefined;
  if (!raw) return;
  try {
    const s = atob(raw);
    for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); for (let k = 0; k < 8; k++) if (b & (1 << k)) F.revealed[i * 8 + k] = 1; }
  } catch { /* a damaged reveal map just starts unknown */ }
}

export function revealedFraction(): number {
  if (!F.map) return 0;
  let n = 0, tot = 0;
  for (let i = 0; i < F.revealed.length; i++) {
    const ch = F.rows[Math.floor(i / F.w)][i % F.w];
    if (ch === ' ' || ch === '~') continue;
    tot++;
    if (F.revealed[i]) n++;
  }
  return tot ? n / tot : 1;
}

// ---------- Loading ----------

export function loadMap(id: string, x: number, y: number, dir = 0): void {
  if (F.map) saveReveal();
  const m = MAPS[id];
  if (!m) throw new Error('no map ' + id);
  const sameMap = F.map?.id === id;
  F.map = m;
  F.rows = m.rows.map(r => [...r]);
  F.h = F.rows.length;
  F.w = Math.max(...m.rows.map(r => r.length));
  for (const r of F.rows) while (r.length < F.w) r.push(' ');
  applyTileFlags();
  loadReveal();
  F.p.x = x; F.p.y = y; F.p.px = x * 8; F.p.py = y * 8; F.p.dir = dir; F.p.move = null;
  F.trail = [];
  for (let i = 0; i < 40; i++) F.trail.push({ x: F.p.px, y: F.p.py });
  if (!sameMap) F.beaten.clear();
  F.ents = m.ents.map(d => makeEnt(d));
  F.drifters = (m.drifters || []).filter(d => !F.beaten.has(m.id + ':' + d.id)).map(d => ({
    def: d, x: d.x, y: d.y, px: d.x * 8, py: d.y * 8, move: null, t: (hashStr(d.id) % 60), alive: true, frames: frames('enemy:' + d.art),
  }));
  F.trueSight = false;
  F.scent = null;
  F.ring = null;
  F.banner = sameMap ? 0 : 130;
  F.safe = 40;
  if (!sameMap) F.rest = 0;
  S.map = id; S.x = x; S.y = y; S.dir = dir;
  reveal();
  playMusic(m.music, { tint: m.tint });
  if (m.onEnter) run(m.onEnter);
}

/** Map tile overrides kept in flags, like a renamed gap that became a bridge. */
function applyTileFlags(): void {
  if (!F.map) return;
  const pre = `tile:${F.map.id}:`;
  for (const k of Object.keys(S.flags)) {
    if (!k.startsWith(pre)) continue;
    const [xs, ys] = k.slice(pre.length).split(',');
    const v = S.flags[k];
    setTile(+xs, +ys, String.fromCharCode(v));
  }
}

/** Changes a tile now and keeps the change in the save. */
export function setTileSaved(x: number, y: number, ch: string): void {
  setTile(x, y, ch);
  if (F.map) setFlag(`tile:${F.map.id}:${x},${y}`, ch.charCodeAt(0));
}

function makeEnt(d: EntDef): Ent {
  return {
    def: d, x: d.x, y: d.y, px: d.x * 8, py: d.y * 8, dir: d.dir ?? 0, move: null, home: { x: d.x, y: d.y },
    wanderT: 30 + (hashStr(d.id) % 90), frames: frames(d.art), hiddenNow: false, removed: false,
  };
}

export function ent(id: string): Ent | null { return F.ents.find(e => e.def.id === id && !e.removed) || null; }

export function entVisible(e: Ent): boolean {
  if (e.removed) return false;
  if (e.def.pickup && flag(e.def.pickup.flag)) return false;
  if (e.def.when && !e.def.when()) return false;
  if (e.def.hidden && !F.trueSight) return false;
  return true;
}

function entSolid(e: Ent): boolean {
  if (!entVisible(e)) return false;
  if (e.def.solid !== undefined) return e.def.solid;
  return !!e.def.art && !e.def.pickup;
}

export function blocked(x: number, y: number, self?: Ent | null): boolean {
  if (solidTile(x, y)) return true;
  for (const e of F.ents) {
    if (e === self || !entSolid(e)) continue;
    if ((e.x === x && e.y === y) || (e.move && e.move.tx === x && e.move.ty === y)) return true;
  }
  if (self !== undefined && F.p.x === x && F.p.y === y) return true;
  return false;
}

// ---------- Movement ----------

export function moving(): boolean { return !!F.p.move; }

/** Starts the Pilgrim stepping one tile. Returns false if blocked. */
export function stepPilgrim(dir: number, dur = 8, force = false): boolean {
  F.p.dir = dir;
  const tx = F.p.x + DX[dir], ty = F.p.y + DY[dir];
  if (!force && blocked(tx, ty)) return false;
  F.p.move = { tx, ty, t: 0, dur };
  return true;
}

export function stepEnt(e: Ent, dir: number, dur = 8): boolean {
  e.dir = dir;
  const tx = e.x + DX[dir], ty = e.y + DY[dir];
  if (blocked(tx, ty, e)) return false;
  e.move = { tx, ty, t: 0, dur };
  return true;
}

export function placeEnt(e: Ent, x: number, y: number): void { e.x = x; e.y = y; e.px = x * 8; e.py = y * 8; e.move = null; }

function advance(o: { x: number; y: number; px: number; py: number; move: { tx: number; ty: number; t: number; dur: number } | null }): boolean {
  const m = o.move;
  if (!m) return false;
  m.t++;
  const k = Math.min(1, m.t / m.dur);
  o.px = (o.x + (m.tx - o.x) * k) * 8;
  o.py = (o.y + (m.ty - o.y) * k) * 8;
  if (m.t >= m.dur) { o.x = m.tx; o.y = m.ty; o.px = o.x * 8; o.py = o.y * 8; o.move = null; return true; }
  return false;
}

function arrive(): void {
  S.x = F.p.x; S.y = F.p.y;
  reveal();
  const t = tileAt(F.p.x, F.p.y);
  for (const e of F.ents) {
    if (!entVisible(e) || e.x !== F.p.x || e.y !== F.p.y) continue;
    if (e.def.door) { if (!tryLocked(e)) warpDoor(e.def.door); return; }
    if (e.def.pickup) { takePickup(e); continue; }
    if (e.def.touch) run(e.def.touch);
  }
  if (t?.harm) {
    S.f -= t.harm;
    game.flash = 4; game.flashColor = '#3c2a6a';
    sfx('void_touch');
    if (S.f <= 0) fadeAway();
  }
  if (busy()) return;
  if (t?.push) {
    const d = t.push[0] === 1 ? 2 : t.push[0] === -1 ? 1 : t.push[1] === 1 ? 0 : 3;
    stepPilgrim(d, 6);
  } else if (t?.well) {
    stepPilgrim(F.p.dir, 5);
  }
}

let fadeHook: () => void = () => {};
export function setFadeHook(f: () => void): void { fadeHook = f; }
function fadeAway(): void { fadeHook(); }

let doorHook: (d: { map: string; x: number; y: number; dir?: number }) => void = d => loadMap(d.map, d.x, d.y, d.dir ?? F.p.dir);
export function setDoorHook(f: typeof doorHook): void { doorHook = f; }
function warpDoor(d: { map: string; x: number; y: number; dir?: number }): void { doorHook(d); }

let lockedHook: (msg: string) => void = () => {};
export function setLockedHook(f: (msg: string) => void): void { lockedHook = f; }
function tryLocked(e: Ent): boolean {
  const msg = e.def.locked?.();
  if (!msg) return false;
  lockedHook(msg);
  return true;
}

function takePickup(e: Ent): void {
  const pk = e.def.pickup!;
  setFlag(pk.flag);
  pickupHook(pk);
}
let pickupHook: (pk: NonNullable<EntDef['pickup']>) => void = () => {};
export function setPickupHook(f: typeof pickupHook): void { pickupHook = f; }

// ---------- Update ----------

export function facing(): { x: number; y: number } { return { x: F.p.x + DX[F.p.dir], y: F.p.y + DY[F.p.dir] }; }

export function entInFront(): Ent | null {
  const { x, y } = facing();
  return F.ents.find(e => entVisible(e) && e.x === x && e.y === y && (e.def.talk || e.def.sense || e.def.rename || e.def.truth || e.def.art)) || null;
}

export function fieldUpdate(): void {
  if (!F.map) return;
  const cut = busy() || dlg.active;
  if (F.banner > 0) F.banner--;
  if (F.safe > 0) F.safe--;
  if (F.rest > 0 && !cut) F.rest--;
  if (F.hearT > 0) F.hearT--;
  if (F.scent && --F.scent.t <= 0) F.scent = null;
  if (F.timer && !cut && --F.timer.t <= 0) { const tm = F.timer; F.timer = null; run(tm.fail); }
  if (F.map?.timeStops && !cut) {
    F.stillT++;
    if (F.stillT === 600) { F.frozen = true; toast('Time stops entirely.', UI.dim); }
    if (F.stillT >= 720) { F.frozen = false; F.stillT = 0; }
  } else if (F.frozen && F.stillT) { F.frozen = false; F.stillT = 0; }

  if (F.p.move) {
    if (advance(F.p)) arrive();
    F.trail.push({ x: F.p.px, y: F.p.py });
    if (F.trail.length > 60) F.trail.shift();
  }
  for (const e of F.ents) {
    if (e.move) advance(e);
    else if (e.def.wander && !cut && entVisible(e) && --e.wanderT <= 0) {
      e.wanderT = 60 + (hashStr(e.def.id + game.tick) % 120);
      const d = hashStr(e.def.id + ':' + game.tick) % 4;
      const tx = e.x + DX[d], ty = e.y + DY[d];
      if (Math.abs(tx - e.home.x) <= e.def.wander && Math.abs(ty - e.home.y) <= e.def.wander) stepEnt(e, d, 16);
    }
  }
  if (!cut && !F.frozen) updateDrifters();

  if (F.ring) { updateRing(); return; }
  if (cut || F.frozen) return;

  if (!F.p.move) {
    const fast = input.held('fast');
    const dirs: [string, number][] = [['down', 0], ['left', 1], ['right', 2], ['up', 3]];
    for (const [b, d] of dirs) {
      if (input.held(b as 'up')) {
        const tx = F.p.x + DX[d], ty = F.p.y + DY[d];
        const dr = F.drifters.find(q => q.alive && q.x === tx && q.y === ty);
        if (dr && F.safe <= 0 && F.rest <= 0) { contact(dr); return; }
        const door = F.ents.find(e => entVisible(e) && e.def.door && e.x === tx && e.y === ty && entSolid(e));
        if (door) { F.p.dir = d; if (!tryLocked(door)) warpDoor(door.def.door!); return; }
        if (!stepPilgrim(d, fast ? 4 : 8)) F.p.dir = d;
        break;
      }
    }
    if (input.hit('ok')) interact();
    else if (input.hit('sense')) { F.ring = { cursor: Math.max(0, SENSES.indexOf(S.lastSense || 'sight')) }; sfx('sense'); }
    else if (input.hit('goal')) showGoal();
  }
  if (!F.p.move) F.p.frame = 0; else F.p.frame = (game.tick >> 3) & 1;
  fieldBreaks();
}

function interact(): void {
  const e = entInFront();
  if (e?.def.talk) { run(e.def.talk); return; }
  if (e?.def.pickup) { takePickup(e); return; }
  if (e?.def.truth) { toast(e.def.truth); return; }
}

export function showGoal(): void {
  const g = goal();
  toast(g.text, UI.gold);
  sfx('scent');
  if ((S.senses.smell || 0) >= 1 && g.map === F.map?.id && g.x !== undefined && g.y !== undefined) scentTo(g.x, g.y!);
  else if ((S.senses.smell || 0) >= 1 && g.map && g.map !== F.map?.id) toast('The scent leads somewhere else.', UI.dim);
}

/** Breadth-first path for the Scent trail. */
export function scentTo(gx: number, gy: number): void {
  const prev = new Int32Array(F.w * F.h).fill(-1);
  const start = idx(F.p.x, F.p.y), goalI = idx(gx, gy);
  const q = [start];
  prev[start] = start;
  while (q.length) {
    const c = q.shift()!;
    if (c === goalI) break;
    const cx = c % F.w, cy = Math.floor(c / F.w);
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= F.w || ny >= F.h) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -1) continue;
      if (solidTile(nx, ny) && ni !== goalI) continue;
      prev[ni] = c;
      q.push(ni);
    }
  }
  if (prev[goalI] === -1) { toast('The scent is lost here.', UI.dim); return; }
  const path: [number, number][] = [];
  for (let c = goalI; c !== start; c = prev[c]) path.push([c % F.w, Math.floor(c / F.w)]);
  F.scent = { path: path.reverse(), t: 240 };
}

function contact(d: Drifter): void {
  if (F.safe > 0 || F.rest > 0 || busy() || !F.onBattle) return;
  F.onBattle(d.def.group, { id: d.def.id });
}

export function drifterBeaten(id: string): void {
  if (!F.map) return;
  F.beaten.add(F.map.id + ':' + id);
  const d = F.drifters.find(q => q.def.id === id);
  if (d) d.alive = false;
}

/** After any field fight, the other drifters back off for a few seconds so the next fight never starts on its own. */
export function drifterRest(): void {
  F.rest = 180;
  for (const d of F.drifters) d.t = Math.max(d.t, 30);
}

function updateDrifters(): void {
  for (const d of F.drifters) {
    if (!d.alive) continue;
    if (d.def.when && !d.def.when()) continue;
    if (d.move) { advance(d); continue; }
    if (--d.t > 0) continue;
    const dist = Math.abs(d.x - F.p.x) + Math.abs(d.y - F.p.y);
    const see = F.rest <= 0 && dist <= 5 && revealed(d.x, d.y);
    d.t = see ? 14 : 40 + (hashStr(d.def.id + game.tick) % 60);
    let dir: number;
    if (see) {
      const dx = F.p.x - d.x, dy = F.p.y - d.y;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    } else dir = hashStr(d.def.id + ':' + game.tick) % 4;
    const tx = d.x + DX[dir], ty = d.y + DY[dir];
    if (tx === F.p.x && ty === F.p.y) { if (F.safe <= 0 && F.rest <= 0 && !F.p.move) contact(d); continue; }
    const wr = d.def.wander ?? 4;
    if (!see && (Math.abs(tx - d.def.x) > wr || Math.abs(ty - d.def.y) > wr)) continue;
    if (blocked(tx, ty, null) || F.drifters.some(o => o !== d && o.alive && o.x === tx && o.y === ty)) continue;
    d.move = { tx, ty, t: 0, dur: 12 };
  }
}

function updateRing(): void {
  const r = F.ring!;
  if (input.hit('back') || input.hit('sense')) { F.ring = null; return; }
  if (input.hit('left') || input.hit('up')) { r.cursor = (r.cursor + 5) % 6; sfx('move'); }
  if (input.hit('right') || input.hit('down')) { r.cursor = (r.cursor + 1) % 6; sfx('move'); }
  if (input.hit('ok')) {
    const s = SENSES[r.cursor];
    if (!(S.senses[s] || 0)) { sfx('buzz'); return; }
    F.ring = null;
    S.lastSense = s;
    F.onSense?.(s);
  }
}

function fieldBreaks(): void {
  if (S.f <= fmax() * 0.8 || busy()) { F.breakT = 0; return; }
  if (++F.breakT < 360) return;
  F.breakT = 0;
  game.shake = 10;
  sfx('overload');
  const k = hashStr('b' + game.tick) % 3;
  if (k === 0) toast('Reality breaks a little around you.', UI.red);
  if (k === 1) { toast('You forget where you have been.', UI.red); for (let i = 0; i < F.revealed.length; i++) if (hashStr('f' + i + game.tick) % 3 === 0) F.revealed[i] = 0; reveal(); }
  if (k === 2) { toast('Physics slips.', UI.red); stepPilgrim(hashStr('s' + game.tick) % 4, 6); }
}

// ---------- Drawing ----------

function areaColors(): { fogA: string; fogB: string } {
  switch (F.map?.area) {
    case 'sea': return { fogA: SEA.deep, fogB: SEA.night };
    case 'year': return { fogA: YEAR.dark, fogB: YEAR.brown };
    case 'stone': return { fogA: STONE.void, fogB: STONE.deep };
    case 'void': return { fogA: VOID.black, fogB: VOID.dim };
    default: return { fogA: BRASS.sky0, fogB: BRASS.sky1 };
  }
}

/** The sky behind floating islands, or the void behind crystal. Drawn unlit. */
function drawBackdrop(): void {
  const area = F.map?.area;
  if (F.map?.indoor) { rfill(0, 0, W, H, '#000000', 1); return; }
  if (area === 'brass' || area === 'year') {
    const bands = area === 'brass' ? [BRASS.sky0, BRASS.sky1, BRASS.sky2, BRASS.sky3, BRASS.sky4, BRASS.sky5] : [YEAR.dark, YEAR.brown, YEAR.red, YEAR.orange, YEAR.sky, YEAR.yellow];
    const off = Math.floor(F.cam.y / 6);
    for (let y = 0; y < H; y++) {
      const i = Math.max(0, Math.min(bands.length - 1, Math.floor(((y + off) / 280) * bands.length)));
      rfill(0, y, W, 1, bands[i], 1);
    }
    for (let i = 0; i < bands.length - 1; i++) {
      const y = Math.round(((i + 1) * 280) / bands.length - off);
      rdither(0, y - 3, W, 3, bands[i + 1], 0.5, 1);
    }
    const cloud = area === 'brass' ? BRASS.cloud : YEAR.pale;
    for (let k = 0; k < 6; k++) {
      const cx = ((hashStr('cl' + k) % 300) - ((game.tick / (6 + k)) | 0) - F.cam.x / 8) % 300;
      const x = ((cx % 300) + 300) % 300 - 40;
      const y = 20 + (hashStr('cy' + k) % 160) - F.cam.y / 10;
      rfill(x, y, 22, 2, cloud, 1);
      rfill(x + 4, y - 2, 12, 2, cloud, 1);
    }
    return;
  }
  const { fogA } = areaColors();
  rfill(0, 0, W, H, area === 'sea' ? SEA.deep : fogA, 1);
  if (area === 'stone' || area === 'void') {
    for (let k = 0; k < 40; k++) {
      const x = (hashStr('st' + k) % 400) - F.cam.x / 5;
      const y = (hashStr('sy' + k) % 400) - F.cam.y / 5;
      if (((game.tick >> 4) + k) % 7 === 0) continue;
      rpx(((x % W) + W) % W, ((y % H) + H) % H, k % 3 === 0 ? STONE.cyan : k % 3 === 1 ? STONE.magenta : VOID.white, 1);
    }
  }
}

function drawTile(t: TileDef, sx: number, sy: number, x: number, y: number): void {
  if (t.backdrop) return;
  const fr = Array.isArray(t.art[0]) ? (t.art as Art[]) : [t.art as Art];
  const f = t.rate ? fr[Math.floor((game.tick + (x * 7 + y * 3)) / t.rate) % fr.length] : fr[0];
  const cls = t.light && !t.light.negative ? 1 : 0;
  if (t.hidden && !F.trueSight) { const base = TILESETS[F.map!.area]['.']; rart(base.art as Art, sx, sy, base.c1, base.c2, base.ink || UI.ink, false, 0); return; }
  let art = f;
  if (t.front) { const below = tileAt(x, y + 1); if (below && !below.solid && !below.backdrop) art = t.front; }
  else if (t.variants) {
    const h = hashStr('v' + x + ',' + y) % 100;
    const crack = Math.min(30, 4 + S.up / 12);
    const n = t.variants.length;
    art = h < crack ? t.variants[n - 1] : h < 55 ? f : t.variants[h % (n - 1)];
  }
  rart(art, sx, sy, t.c1, t.c2, t.ink || UI.ink, false, cls);
  if (t.lie && F.trueSight && (game.tick >> 3) & 1) { rfill(sx, sy, 8, 1, UI.violet, 1); rfill(sx, sy + 7, 8, 1, UI.violet, 1); rfill(sx, sy, 1, 8, UI.violet, 1); rfill(sx + 7, sy, 1, 8, UI.violet, 1); }
}

function moodColor(): string {
  const fm = fmax();
  if (S.f > fm * 0.8) return (game.tick >> 4) & 1 ? UI.red : UI.gold;
  return MOOD_COLOR[S.mood] || MOOD_COLOR.none;
}

/** The Pilgrim: a glowing outline in its mood color, drawn as its own light. Faded, it is half there. */
function drawPilgrim(sx: number, sy: number, frame: number): void {
  const fr = AVATAR[S.avatar] || AVATAR.snake;
  const art = fr[frame % fr.length];
  const fadedNow = S.f < fmax() * 0.2;
  if (!fadedNow) routline(art, sx, sy, '#2a2440', F.p.dir === 1, 1);
  rart(art, sx, sy, moodColor(), '#3a4a6a', '#07060b', F.p.dir === 1, 1, fadedNow ? 0.5 : 1);
}

const AREA_AMBIENT: Record<string, { color: string; level: number }> = {
  brass: { color: '#fff0d8', level: 1.15 }, sea: { color: '#c8e0ff', level: 0.8 }, year: { color: '#ffe0b0', level: 1.0 },
  stone: { color: '#d8c8ff', level: 0.5 }, void: { color: '#c8c0e0', level: 0.32 },
};

const DRIFTER_LIGHT: Record<string, { r: number; i: number; color: string; negative?: boolean }> = {
  wisp: { r: 22, i: 0.6, color: '#f4a850' }, mote: { r: 20, i: 0.6, color: '#a8f040' }, nothing: { r: 26, i: 0.7, color: '#000000', negative: true },
  eater: { r: 22, i: 0.5, color: '#000000', negative: true }, membeing: { r: 20, i: 0.5, color: '#ff98e0' }, shard: { r: 14, i: 0.35, color: '#48f0e4' },
  drone: { r: 12, i: 0.35, color: '#40d868' }, coral: { r: 12, i: 0.3, color: '#e07088' }, fish: { r: 10, i: 0.3, color: '#64c8b0' },
};

/** Lights from tiles, people, drifters, and the Pilgrim, in screen pixels. */
function gatherLights(cx: number, cy: number, x0: number, y0: number): void {
  const m = F.map!;
  for (let y = y0 - 6; y <= y0 + 34; y++) for (let x = x0 - 6; x <= x0 + 34; x++) {
    if (x < 0 || y < 0 || x >= F.w || y >= F.h) continue;
    const t = tileAt(x, y);
    if (!t?.light || !revealed(x, y)) continue;
    const l = t.light;
    addLight(x * 8 - cx + 4, y * 8 - cy + 4, l.r, l.i, hex(l.color), { negative: l.negative, through: l.negative });
  }
  for (const e of F.ents) {
    if (!entVisible(e)) continue;
    const l = e.def.light || (e.def.art === 'lb' ? { r: 44, i: 0.9, color: '#fff0a0' } : e.def.art === 'seer' ? { r: 56, i: 1.1, color: '#fff8d0' } : null);
    if (l) addLight(e.px - cx + 4, e.py - cy + 2, l.r, l.i, hex(l.color), { negative: l.negative });
  }
  for (const d of F.drifters) {
    if (!d.alive || (d.def.when && !d.def.when())) continue;
    const l = DRIFTER_LIGHT[d.def.art];
    if (l) addLight(d.px - cx + 4, d.py - cy + 4, l.r, l.i, hex(l.color), { negative: l.negative, through: l.negative });
  }
  F.followers.forEach((who, i) => {
    if (who !== 'lb') return;
    const t = F.trail[Math.max(0, F.trail.length - 1 - (i + 1) * 9)];
    addLight(t.x - cx + 4, t.y - cy, 46, 0.95, 0xfff0a0, { z: 20 });
  });
  for (const l of m.moving?.(game.tick) || []) addLight(l.x - cx, l.y - cy, l.r, l.i, hex(l.color), { negative: l.negative, through: true });
  const fm = fmax();
  const pi = S.f < fm * 0.2 ? 0.25 : S.f > fm * 0.8 ? 0.85 : 0.55;
  const pc = S.f > fm * 0.8 ? '#e0483c' : MOOD_COLOR[S.mood] || MOOD_COLOR.none;
  addLight(F.p.px - cx + 4, F.p.py - cy + 4, 34, pi, hex(pc), { z: 10 });
}

const frameImg = new ImageData(W, H);
const frameU32 = new Uint32Array(frameImg.data.buffer);

export function fieldDraw(): void {
  if (!F.map) return;
  const ppx = F.p.px + 4, ppy = F.p.py + 4;
  const mw = F.w * 8, mh = F.h * 8;
  F.cam.x = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, ppx - W / 2));
  F.cam.y = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, ppy - H / 2 + 8));
  let cx = Math.round(F.cam.x), cy = Math.round(F.cam.y);
  if (game.shake > 0) { cx += (game.shake & 1 ? 1 : -1); game.shake--; }
  drawBackdrop();
  const { fogA, fogB } = areaColors();
  const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
  for (let y = y0; y <= y0 + 29; y++) for (let x = x0; x <= x0 + 29; x++) {
    const sx = x * 8 - cx, sy = y * 8 - cy;
    if (x < 0 || y < 0 || x >= F.w || y >= F.h) continue;
    const t = tileAt(x, y)!;
    if (!revealed(x, y)) {
      if (t.backdrop) continue;
      rfill(sx, sy, 8, 8, fogA, 1);
      const h = hashStr(`${x},${y},${game.tick >> 3}`);
      for (let k = 0; k < 5; k++) rpx(sx + ((h >> (k * 3)) & 7), sy + ((h >> (k * 3 + 12)) & 7), fogB, 1);
      continue;
    }
    drawTile(t, sx, sy, x, y);
  }

  const sprites: { y: number; draw: () => void }[] = [];
  for (const e of F.ents) {
    if (!entVisible(e) || !revealed(e.x, e.y)) continue;
    const fr = e.frames;
    if (!fr.length) continue;
    const rate = e.def.rate || 24;
    let f = fr[Math.floor((game.tick + hashStr(e.def.id)) / rate) % fr.length];
    let step = 0;
    if (isPerson(e.def.art)) {
      const vorn = e.def.art === 'vorn';
      const still = vorn ? VORN[0] : f;
      if (e.move) {
        step = (game.tick >> 3) & 1;
        f = step ? still : vorn ? VORN[1] : stride(still) || still;
      } else if (fr.length === 1 || vorn) {
        const idle = Math.floor((game.tick + hashStr(e.def.id)) / (40 + (hashStr(e.def.id) % 4) * 6)) & 1;
        f = idle ? breathe(still) : still;
      }
    }
    const h = f.length;
    const sx = Math.round(e.px - cx) + (e.def.ox || 0), sy = Math.round(e.py - cy) - (h - 8) + (e.def.oy || 0) - step;
    const bob = e.def.art === 'lb' || e.def.art === 'seer' ? ((game.tick >> 4) & 1) : 0;
    const cls = e.def.emissive || e.def.art === 'lb' || e.def.art === 'seer' || e.def.art === 'steady' ? 1 : 2;
    sprites.push({
      y: e.py, draw: () => {
        if (e.def.glow) routline(f, sx, sy - bob, e.def.glow, false, 1);
        rart(f, sx, sy - bob, e.def.c1 || UI.paper, e.def.c2 || UI.dim, '#07060b', e.def.flip ?? e.dir === 1, cls);
      },
    });
  }
  for (const d of F.drifters) {
    if (!d.alive || !revealed(d.x, d.y) || (d.def.when && !d.def.when())) continue;
    const f = d.frames[0];
    if (!f) continue;
    const sx = Math.round(d.px - cx), sy = Math.round(d.py - cy) - ((game.tick >> 4) & 1);
    const glow = DRIFTER_LIGHT[d.def.art] && !DRIFTER_LIGHT[d.def.art].negative;
    const flip = ((game.tick >> 5) & 1) === 1;
    const resting = F.rest > 0;
    sprites.push({ y: d.py, draw: () => { if (!resting) routline(f, sx, sy, '#000000', flip, 2); rart(f, sx, sy, d.def.c1, d.def.c2, '#07060b', flip, glow ? 1 : 2, resting ? 0.5 : 1); } });
  }
  const trail = F.trail;
  const walking = !!F.p.move;
  F.followers.forEach((who, i) => {
    const t = trail[Math.max(0, trail.length - 1 - (i + 1) * 9)];
    const step = walking ? (game.tick >> 3) & 1 : 0;
    const art = who === 'vorn'
      ? (walking ? VORN[step ? 0 : 1] : (game.tick >> 5) & 1 ? breathe(VORN[0]) : VORN[0])
      : LB[(game.tick >> 4) & 1];
    const sx = Math.round(t.x - cx), sy = Math.round(t.y - cy) - (art.length - 8) - (who === 'lb' ? 2 + ((game.tick >> 4) & 1) : step);
    sprites.push({ y: t.y - 0.5, draw: () => rart(art, sx, sy, who === 'vorn' ? '#6a7a8c' : '#fff0a0', who === 'vorn' ? '#a0542c' : '#ffffff', '#07060b', false, who === 'lb' ? 1 : 2) });
  });
  if (F.map.ghosts && trail.length > 120) {
    const g = trail[trail.length - 120];
    sprites.push({ y: g.y, draw: () => rart((AVATAR[S.avatar] || AVATAR.snake)[0], Math.round(g.x - cx), Math.round(g.y - cy), '#9cc0d8', '#3a4a6a', '#07060b', false, 1, 0.35) });
  }
  const pstep = F.p.move ? (game.tick >> 3) & 1 : 0;
  const pframe = F.p.move ? (game.tick >> 3) & 1 : (game.tick >> 5) & 1;
  sprites.push({ y: F.p.py + 0.1, draw: () => drawPilgrim(Math.round(F.p.px - cx), Math.round(F.p.py - cy) - pstep, pframe) });
  sprites.sort((a, b) => a.y - b.y).forEach(s => s.draw());

  spriteNormals();
  const amb = F.map.ambient || AREA_AMBIENT[F.map.area];
  const lvl = amb.level + (F.trueSight ? 0.3 : 0);
  const ac = rgbf(hex(F.trueSight ? '#d8b0ff' : amb.color));
  beginLight([ac[0] * lvl, ac[1] * lvl, ac[2] * lvl], lvl >= 1.1 ? null : (sx, sy) => !!tileAt(Math.floor((sx + cx) / 8), Math.floor((sy + cy) / 8))?.opaque);
  gatherLights(cx, cy, x0, y0);
  composite();
  frameU32.set(buf);
  screenCtx().putImageData(frameImg, 0, 0);

  for (const e of F.ents) {
    if (!entVisible(e) || !revealed(e.x, e.y) || !e.frames.length) continue;
    const sx = Math.round(e.px - cx), sy = Math.round(e.py - cy) - (e.frames[0].length - 8);
    if ((S.senses.touch || 0) >= 1 && e.def.mood) rect(sx + 3, sy - 3, 2, 2, MOOD_COLOR[e.def.mood] || UI.paper);
    if (e.def.sings && F.hearT > 0 && (game.tick >> 4) & 1) text('\u0007', sx + 6, sy - 8, UI.gold);
    if (e.def.hidden) rect(sx, sy + e.frames[0].length, 8, 1, UI.violet);
  }
  if (F.scent) {
    F.scent.path.forEach(([x, y], i) => {
      if ((i + (game.tick >> 3)) % 3 !== 0) return;
      rect(x * 8 - cx + 3, y * 8 - cy + 3, 2, 2, UI.gold);
    });
  }
  if (F.trueSight) { dither(0, 0, W, 2, UI.violet, 0.5); dither(0, H - 2, W, 2, UI.violet, 0.5); }
  if (F.timer) {
    const s = Math.ceil(F.timer.t / 60);
    const label = `${F.timer.label}: ${s}`;
    const w = textWidth(label) + 10;
    panel((W - w) >> 1, 24, w, 15, s <= 10 && (game.tick >> 3) & 1 ? UI.red : UI.edge);
    text(label, ((W - w) >> 1) + 5, 28, s <= 10 ? UI.red : UI.gold);
  }
  if (F.frozen) dither(0, 0, W, H, '#9cc0d8', 0.12);
  if (F.banner > 0) {
    const n = F.map.name;
    const w = textWidth(n) + 12;
    panel((W - w) >> 1, 6, w, 15);
    text(n, ((W - w) >> 1) + 6, 10, UI.gold);
  }
  if (F.ring) drawRing(Math.round(F.p.px - cx) + 4, Math.round(F.p.py - cy) + 4);
  if (game.mode === 'field') drawToasts(F.banner > 0 ? 23 : 3);
}

const RING_POS: [number, number][] = [[0, -24], [21, -12], [21, 12], [0, 24], [-21, 12], [-21, -12]];

function drawRing(cx: number, cy: number): void {
  SENSES.forEach((s, i) => {
    const [dx, dy] = RING_POS[i];
    const x = cx + dx - 6, y = cy + dy - 6;
    const has = (S.senses[s] || 0) >= 1;
    panel(x - 1, y - 1, 13, 13, i === F.ring!.cursor ? UI.gold : UI.edge);
    spr(SENSE_ICON[s], x + 2, y + 2, has ? UI.paper : UI.faint, has ? UI.gold : UI.faint);
  });
  const s = SENSES[F.ring!.cursor];
  const has = (S.senses[s] || 0) >= 1;
  const label = has ? `${SENSE_NAME[s]}: ${FIELD_SENSE[s]}` : `${SENSE_NAME[s]}: not yet`;
  const w = textWidth(label) + 10;
  panel((W - w) >> 1, H - 18, w, 15);
  text(label, ((W - w) >> 1) + 5, H - 14, has ? UI.paper : UI.dim);
}

export const FIELD_SENSE: Record<SenseId, string> = {
  sight: 'True Sight', touch: 'Handshake', hearing: 'Echo', taste: 'Savor', smell: 'Scent', thought: 'Insight',
};

/** Lays the follower trail from a point to the Pilgrim, so a new follower glides in from where it stood. */
export function seedTrail(x: number, y: number): void {
  F.trail = [];
  for (let i = 0; i < 60; i++) { const k = i / 59; F.trail.push({ x: x * 8 + (F.p.px - x * 8) * k, y: y * 8 + (F.p.py - y * 8) * k }); }
}

export function setFollowers(): void {
  F.followers = [];
  if (S.vorn) F.followers.push('vorn');
  if (S.lb) F.followers.push('lb');
}

export function runFn(fn: ScriptFn | undefined): boolean { if (!fn) return false; run(fn); return true; }
