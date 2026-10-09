// Field lighting and screen effects, drawn over the tiles and sprites and under the HUD.
// The field draws in its lit colors. The frame then turns to its unlit hue, and a dithered mask puts back the lit pixels wherever light reaches.
import { ctx, dither, INK } from '../engine/screen';
import { starSound } from '../engine/audio';
import { lightMap, type LightMap } from '../engine/sprites';
import type { SpriteData } from '../battle/model';
import type { MapDef } from './world';
import { isSolid, REGIONS, type Pal } from './tiles';
import { field } from './field';
import { G } from './state';
import { strandFx, ringLit } from './strandfx';
import { backFill, hueMatrices, lampCore, lean, skyFor, skyTables, starsPerMinute, sunk, twoHues, type Sky } from './skies';
import { PROPS } from './props';
import { moonToward, moonTowardTile } from './apex';
import { printFlecks } from './feel';

export interface FieldFxState {
  map: MapDef;
  /** Frame counter. */
  t: number;
  /** Camera offset in pixels: a tile at tx, ty sits on screen at tx * 8 - cam[0], ty * 8 - cam[1]. */
  cam: [number, number];
  /** Ouro's center on screen. */
  px: number;
  py: number;
  /** True when the map is dark and nothing lights it. */
  dark: boolean;
  /** Stays loosened so far. */
  loose: number;
  /** 0 by day, 1 at full evening. */
  dusk: number;
  /** Screen center of a STAR whorl that is worn or following, which carries a bigger light. */
  star: [number, number] | null;
  /** Every sprite drawn this frame, in draw order. */
  figures: Figure[];
}

/** A sprite on the field that takes light by its light map and casts shadows. `y` is where it was drawn, `bob` how far it was lifted. */
export interface Figure { s: SpriteData; x: number; y: number; flip: boolean; bob: number; glow: boolean }

const SW = 192, SH = 192;

function hash(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function px(x: number, y: number, c: string): void {
  if (x < 0 || y < 0 || x >= SW || y >= SH) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
}

/** Cost of the last light pass in milliseconds, what it lit, the glitter specks alive, and where on screen and when the last star landed, for the debug handle. Setting `off` skips the swap to unlit. */
export const lightStats = { ms: 0, avg: 0, stars: 0, glows: 0, lamps: 0, figs: 0, shadows: 0, figMs: 0, shadowMs: 0, shadeMs: 0, specks: 0, landed: [0, 0, -1], off: false };

/** Draws weather, lighting, and glowing things for the field. Called once per frame after sprites. */
export function drawFieldFx(s: FieldFxState): void {
  const p = REGIONS[s.map.region] || REGIONS[0];
  const sky = skyFor(s.map, s.dusk);
  // The art review in Notes/act2-art.md drives the Strand's effects from the console through this handle.
  const dbg = (window as any).__slough;
  if (dbg && !dbg.strandFx) Object.assign(dbg, { strandFx, lightStats, skies: skyTables });
  if (lastMap !== s.map.id) { stars.length = 0; glows.length = 0; specks.length = 0; lastMap = s.map.id; lastSpawn = s.t; hushUntil = 0; lampKey = ''; }
  // The world's own weather draws first, so it takes the lit and unlit hues like the ground under it.
  if (!s.dark) weather(s, p);
  marks(s);
  const hop = ageStrand();
  if (hop >= 0) hopSand(s, p, hop);
  const t0 = performance.now();
  light(s, sky, p);
  const ms = performance.now() - t0;
  Object.assign(lightStats, { ms, avg: lightStats.avg * 0.95 + ms * 0.05, stars: stars.length, glows: glows.length, lamps: lamps.length, specks: specks.length });
  // Everything after this gives off its own light and keeps its lit colors.
  if (s.map.fogRings) ringMarks(s, p);
  if (!s.map.indoor && !s.dark) skyStars(s, p, sky);
  waterGlints(s, p);
  reflections(s, p);
  drawStars(s, p);
  strandLandings(s, p);
  keptGlitter(s, p);
  glitter(s, p);
  if (strandFx.shadow > 0) giantShadow(1 - strandFx.shadow / shadowMax);
  air(s, p);
  if (s.dark) motes(s, p);
}

// ---------------------------------------------------------------- the light buffers

const N = SW * SH;
/** How much of the lit hue shows at each pixel, in sixteenths: starlight, the moon's path, and a STAR whorl. */
const lit = new Float32Array(N);
/** How much lamp light reaches each pixel, in sixteenths: above 0 the dim edge of a pool in the lamp's color, from 10 to 19 a dither into its bright middle. */
const lamp = new Float32Array(N);
/** On dark and ring-fogged maps, how much of each pixel shows at all, in sixteenths. */
const vis = new Float32Array(N);
/** How much of each pixel the figures' shadows turn to ink, in sixteenths. */
const shade = new Float32Array(N);
let shaded = false;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
let fogNow = false;

/** Whether a screen pixel shows at all this frame, so glints in the dark of a fogged map stay hidden. */
const shown = (x: number, y: number) => !fogNow || (x >= 0 && y >= 0 && x < SW && y < SH && vis[y * SW + x] > 8);

/** A pool of light: full within the core, then thinning to nothing at radius r. `peak` above 1 widens the core. Pools that overlap keep the brighter. */
function addLight(buf: Float32Array, cx: number, cy: number, r: number, peak: number): void {
  if (r <= 0 || peak <= 0) return;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(SW - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(SH - 1, Math.ceil(cy + r));
  const k = 16 * peak / r, r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, dy2 = dy * dy, row = y * SW;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, d2 = dx * dx + dy2;
      if (d2 >= r2) continue;
      const v = (r - Math.sqrt(d2)) * k;
      if (v > buf[row + x]) buf[row + x] = v;
    }
  }
}

/** A point light this frame, kept so figures can take light by direction: `z` is its height above the ground, `cast` whether it throws shadows, and `lampy` whether it is a lamp, fire, or door rather than starlight. */
interface Pt { x: number; y: number; r: number; peak: number; z: number; cast: boolean; lampy: boolean }
const pts: Pt[] = [];
/** Heights of lights above the ground in pixels. A landed star's glow stands a tile high, so a figure it backlights catches it on its top edge. */
const Z_STAR = 8, Z_LAMP = 12, Z_RING = 16, Z_WHORL = 5, Z_AIR = 12, Z_EMBER = 6;

/** A pool of light on the ground that also lights the figures near it. A lamp's pool goes in the lamp buffer. */
function pool(x: number, y: number, r: number, peak: number, z: number, cast: boolean, lampy = false): void {
  if (r <= 0 || peak <= 0) return;
  addLight(lampy ? lamp : lit, x, y, r, peak);
  pts.push({ x, y, r, peak, z, cast, lampy });
}

/** A ring of light w pixels wide either side of radius r. */
function addRing(cx: number, cy: number, r: number, w: number, lv: number): void {
  if (lv <= 0 || r <= 0) return;
  const ro = r + w;
  const x0 = Math.max(0, Math.floor(cx - ro)), x1 = Math.min(SW - 1, Math.ceil(cx + ro));
  const y0 = Math.max(0, Math.floor(cy - ro)), y1 = Math.min(SH - 1, Math.ceil(cy + ro));
  const k = 16 * lv;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, row = y * SW;
    for (let x = x0; x <= x1; x++) {
      const e = Math.abs(Math.hypot(x + 0.5 - cx, dy) - r);
      if (e < w) lit[row + x] = Math.max(lit[row + x], k * (1 - e / w));
    }
  }
}

/** Takes light away in a rectangle, for the shadow of something enormous passing over. */
function subLight(x: number, y: number, w: number, h: number, lv: number): void {
  const x0 = Math.max(0, x), x1 = Math.min(SW, x + w), y0 = Math.max(0, y), y1 = Math.min(SH, y + h);
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) lit[yy * SW + xx] -= lv * 16;
}

/** Tiles that light a dark map, with the radius they reveal. Lit tiles light the ground through the sky's lamps. */
const SHOW: Record<string, number> = { L: 16, H: 12, '~': 9, m: 10, q: 14, P: 8 };
/** Things on a map that glow, by prop name, with their radius. */
const PROP_LIGHT: Record<string, number> = { starGrain: 20, augerPoint: 24, conchThroat: 20, bottle: 8, hearth: 26, lantern: 22, stove: 12, shopfront: 14, shopSign: 12 };

interface Lamp { x: number; y: number; r: number; show: number }
let lamps: Lamp[] = [];
let waters: [number, number][] = [];
let lampKey = '';

/** Lamps and water tiles near the screen. Rebuilt when the camera crosses a tile or every half second. */
function scanTiles(s: FieldFxState, sky: Sky): void {
  const tx0 = Math.floor(s.cam[0] / 8) - 3, ty0 = Math.floor(s.cam[1] / 8) - 3;
  const key = `${s.map.id}|${tx0}|${ty0}|${s.t >> 5}|${s.dark}`;
  if (key === lampKey) return;
  lampKey = key;
  lamps = []; waters = [];
  const rows = s.map.rows;
  for (let ty = Math.max(0, ty0); ty < Math.min(rows.length, ty0 + 31); ty++) for (let tx = Math.max(0, tx0); tx < Math.min(rows[0].length, tx0 + 31); tx++) {
    const ch = field.tile(tx, ty);
    if (ch === '~') waters.push([tx, ty]);
    let r = sky.lamps[ch] || 0;
    const show = s.dark ? SHOW[ch] || r : 0;
    if (!r && !show) continue;
    // A run of counter keeps one lamp at its top left, and a door lights the step in front of it.
    if (ch === 'c' && (field.tile(tx - 1, ty) === 'c' || field.tile(tx, ty - 1) === 'c')) r = 0;
    lamps.push({ x: tx * 8 + 4, y: ty * 8 + (ch === 'd' ? 9 : 4), r, show });
  }
  for (const pr of s.map.props || []) {
    const r = PROP_LIGHT[pr.pic];
    const size = PROPS[pr.pic];
    if (r && size && (!pr.when || pr.when())) lamps.push({ x: pr.x * 8 + size.w * 4, y: pr.y * 8 + size.h * 4, r, show: r * 2 });
  }
  surfaceLight(s, tx0, ty0);
}

// ---------------------------------------------------------------- lamps on surfaces

/** What a tile's surface is for light: 0 open ground facing up, 1 water, 2 the front of a wall or building facing the viewer, 3 a roof sloping up away from the viewer, 4 a tree's crown. */
const NOT_BLOCKING = new Set(['~', 'z', 'Z', 'v', 'c', 'p', 'u', 'i', 'U', '|', '`']);
function surfaceOf(ch: string): number {
  if (ch === '~') return 1;
  if (!isSolid(ch) || ch === 'z' || ch === 'Z') return 0;
  return ch === 'r' ? 3 : ch === 'T' ? 4 : 2;
}
/** Each surface's facing, x east, y toward the viewer, z up, and the height its pixels stand at. */
const FACING: [number, number, number, number][] = [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0.97, 0.25, 4], [0, 0.55, 0.83, 6], [0, 0.3, 0.95, 6]];
/** Water is a mirror, so it shows little of a lamp's light as diffuse light and catches it in glints instead. */
const WATER_TAKE = 0.35;

/** The scan window in tiles, and the lamp light on its surfaces in world pixels, rebuilt with the window. */
const WIN = 31, WPX = WIN * 8;
const LAMPW = new Float32Array(WPX * WPX);
const surf = new Int8Array(WIN * WIN), block = new Uint8Array(WIN * WIN);
let winX = 0, winY = 0;

/** Lights every surface in the window from each lamp: by distance, by the lamp's height, and by how squarely the surface faces it. A wall or tall prop between the lamp and a 4 pixel block keeps the lamp's light off that block. */
function surfaceLight(s: FieldFxState, tx0: number, ty0: number): void {
  winX = tx0; winY = ty0;
  LAMPW.fill(0);
  for (let ty = 0; ty < WIN; ty++) for (let tx = 0; tx < WIN; tx++) {
    const ch = field.tile(tx0 + tx, ty0 + ty), i = ty * WIN + tx;
    surf[i] = surfaceOf(ch);
    block[i] = isSolid(ch) && !NOT_BLOCKING.has(ch) ? 1 : 0;
  }
  for (const pr of s.map.props || []) {
    const size = PROPS[pr.pic];
    if (!size || (pr.when && !pr.when()) || size.h < 2) continue;
    // A tall prop blocks light at its foot row, where it stands on the ground.
    for (let k = 0; k < size.w; k++) { const gx = pr.x + k - tx0, gy = pr.y + size.h - 1 - ty0; if (gx >= 0 && gy >= 0 && gx < WIN && gy < WIN) block[gy * WIN + gx] = 1; }
  }
  for (const l of lamps) {
    if (!l.r) continue;
    const lx = l.x - tx0 * 8, ly = l.y - ty0 * 8, z = Z_LAMP, peak = 2, r = l.r;
    const own = Math.floor(ly / 8) * WIN + Math.floor(lx / 8);
    const x0 = Math.max(0, Math.floor(lx - r)) & ~3, x1 = Math.min(WPX - 1, Math.ceil(lx + r));
    const y0 = Math.max(0, Math.floor(ly - r)) & ~3, y1 = Math.min(WPX - 1, Math.ceil(ly + r));
    for (let by = y0; by <= y1; by += 4) for (let bx = x0; bx <= x1; bx += 4) {
      const cxb = bx + 2, cyb = by + 2, d0 = Math.hypot(cxb - lx, cyb - ly);
      if (d0 >= r + 3) continue;
      // Walk the tiles from the lamp to this block, and stop at the first wall that is not the block's own tile or the lamp's.
      const target = Math.floor(cyb / 8) * WIN + Math.floor(cxb / 8);
      let seen = true;
      for (let t = 4; t < d0 - 2; t += 4) {
        const q = Math.floor((ly + (cyb - ly) * t / d0) / 8) * WIN + Math.floor((lx + (cxb - lx) * t / d0) / 8);
        if (q !== own && q !== target && q >= 0 && q < WIN * WIN && block[q]) { seen = false; break; }
      }
      if (!seen) continue;
      for (let y = by; y < Math.min(by + 4, WPX); y++) for (let x = bx; x < Math.min(bx + 4, WPX); x++) {
        const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly);
        if (d >= r) continue;
        const ti = Math.floor(y / 8) * WIN + Math.floor(x / 8), kind = surf[ti], f = FACING[kind];
        // The lamp's own tile glows.
        let v: number;
        if (ti === own) v = 32;
        else {
          const lxv = lx - x - 0.5, lyv = ly - y - 0.5, lzv = z - f[3];
          const dot = (f[0] * lxv + f[1] * lyv + f[2] * lzv) / Math.sqrt(lxv * lxv + lyv * lyv + lzv * lzv);
          if (dot <= 0) continue;
          v = 16 * peak * (1 - d / r) * Math.pow(dot, 0.6) * 1.25 * (kind === 1 ? WATER_TAKE : 1);
        }
        const k = y * WPX + x;
        if (v > LAMPW[k]) LAMPW[k] = v;
      }
    }
  }
}

/** The box on screen the lamp light covers this frame, as x0, y0, x1, y1, or x1 below x0 when there is none. */
const lampBox = [0, 0, -1, -1];

/** Copies the lamp light on the window's surfaces into this frame's lamp buffer, and finds the box it covers. */
function applyLamps(s: FieldFxState): void {
  const dx = s.cam[0] - winX * 8, dy = s.cam[1] - winY * 8;
  let x0 = SW, y0 = SH, x1 = -1, y1 = -1;
  if (!lamps.some(l => l.r)) { lampBox[0] = x0; lampBox[1] = y0; lampBox[2] = x1; lampBox[3] = y1; return; }
  for (let y = 0; y < SH; y++) {
    const wy = y + dy;
    if (wy < 0 || wy >= WPX) continue;
    const row = wy * WPX, out = y * SW;
    for (let x = 0; x < SW; x++) {
      const wx = x + dx;
      if (wx < 0 || wx >= WPX) continue;
      const v = LAMPW[row + wx];
      lamp[out + x] = v;
      if (v > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
  }
  lampBox[0] = x0; lampBox[1] = y0; lampBox[2] = x1; lampBox[3] = y1;
}

/**
 * This frame's moon: its x on screen for a sky's moon, its color as 0xRRGGBB, the sky it belongs to, and the one direction its shadows run on screen.
 * On the Volute's outdoor maps `tx`, `ty` is the way toward the moon over the Apex, and `path` how much of its light path shows on water, from 0 to 1.
 * Set at the start of each light pass.
 */
let moonNow: { x: number; tint: number; sky: Sky; ux: number; uy: number; tx: number; ty: number; path: number; apex: boolean } | null = null;

/** The moon's x on screen: the sky's, or one picked from the map's name. */
function moonXOf(m: MapDef, sky: Sky): number {
  if (sky.moonX >= 0) return sky.moonX;
  let h = 0;
  for (let i = 0; i < m.id.length; i++) h = h * 31 + m.id.charCodeAt(i);
  return 24 + Math.floor(hash(h) * 144);
}

/** Fills the light buffers from every light on screen, then swaps each pixel for its lit or unlit hue. */
function light(s: FieldFxState, sky: Sky, p: Pal): void {
  lit.fill(0); lamp.fill(0);
  const tint = parseInt(sky.moonTint.slice(1), 16);
  const tw = moonToward(s.map, G.time);
  if (tw) {
    // The moon hangs over the Apex, so shadows fall away from it toward the Lip. Its path shows on water only while it stands ahead of the view.
    moonNow = { x: SW / 2 + tw[0] * 90, tint, sky, ux: -tw[0], uy: -tw[1], tx: tw[0], ty: tw[1], path: Math.max(0, Math.min(1, (-tw[1] - 0.15) / 0.45)), apex: !!s.map.apexTile };
  } else {
    // A moon off to the left casts shadows down and to the right, and one straight above casts them straight down.
    const mx = moonXOf(s.map, sky), mdx = SW / 2 - mx, mn = Math.hypot(mdx, 160);
    moonNow = { x: mx, tint, sky, ux: mdx / mn, uy: 160 / mn, tx: 0, ty: -1, path: 1, apex: false };
  }
  const fog = fogNow = s.dark || !!s.map.fogRings;
  scanTiles(s, sky);
  const cx = s.cam[0], cy = s.cam[1];
  if (s.dark) {
    vis.fill(0);
    addLight(vis, s.px, s.py, 60, 60 / 38);
    if (s.star) addLight(vis, s.star[0], s.star[1], 72, 2);
    for (const l of lamps) if (l.show) addLight(vis, l.x - cx, l.y - cy, l.show, 1.43);
  } else if (s.map.fogRings) ringVis(s);
  pts.length = 0;
  if (s.star) pool(s.star[0], s.star[1], 44, 2.2, Z_WHORL, true);
  applyLamps(s);
  for (const l of lamps) if (l.r) pts.push({ x: l.x - cx, y: l.y - cy, r: l.r, peak: 2, z: Z_LAMP, cast: true, lampy: true });
  if (s.map.fogRings) for (const r of strandFx.rings) pool(r.x * 8 + 4 - cx, r.y * 8 + 4 - cy, r.r * 8 + 6, 3, Z_RING, true);
  if (!s.map.indoor && !s.dark) starLights(s, sky);
  landingLights(s);
  if (s.map.region === 26 && !s.dark) emberLights(s);
  const f0 = performance.now();
  waterMask(s);
  moonPath(s);
  figureLight(s);
  lightStats.figMs = performance.now() - f0;
  if (strandFx.shadow > 0) shadowLight(1 - strandFx.shadow / Math.max(1, shadowMax));
  sinkNow = sky.sink;
  if (!lightStats.off) composite(s, sky, p, fog, sinkNow);
}

/** The share of lightness the unlit hue keeps this frame. */
let sinkNow = 1;

// ---------------------------------------------------------------- the moon's light path

/** This frame's light path from the moon: 1 where a glint shows the lit hue, with the pixels it set. */
const PATH = new Uint8Array(N);
const pathPx: number[] = [];
let pathKey = '';
/** Tiles around the screen by how they take the path, filled on demand and kept until the tiles are scanned again: -2 unknown, -1 wall, 0 dry ground, 1 ground beside water, 2 water. */
const wetGrid = new Int8Array(30 * 30);
let wgx = 0, wgy = 0, wetKey = '';

function wetTile(tx: number, ty: number): number {
  const gx = tx - wgx, gy = ty - wgy;
  if (gx < 0 || gy < 0 || gx >= 30 || gy >= 30) return -1;
  const i = gy * 30 + gx;
  if (wetGrid[i] === -2) {
    const ch = field.tile(tx, ty);
    if (ch === '~' || ch === ':') wetGrid[i] = 2;
    else if (isSolid(ch)) wetGrid[i] = -1;
    else {
      let w = 0;
      for (let dy = -1; dy <= 1 && !w; dy++) for (let dx = -1; dx <= 1; dx++) if (field.tile(tx + dx, ty + dy) === '~') { w = 1; break; }
      wetGrid[i] = w;
    }
  }
  return wetGrid[i];
}

/** The middle of a map's water tiles across the map, in pixels, cached per map and tide. */
let waterMidKey = '', waterMidX = 0, waterMidY = 0;
function waterMid(s: FieldFxState): number {
  const key = `${s.map.id}|${lampKey}`;
  if (key === waterMidKey) return waterMidX;
  waterMidKey = key;
  let sum = 0, sumY = 0, n = 0;
  s.map.rows.forEach((row, ty) => { for (let tx = 0; tx < row.length; tx++) if (field.tile(tx, ty) === '~') { sum += tx; sumY += ty; n++; } });
  waterMidX = n ? (sum / n) * 8 + 4 : s.map.rows[0].length * 4;
  waterMidY = n ? (sumY / n) * 8 + 4 : s.map.rows.length * 4;
  return waterMidX;
}

/** Tiles are rechecked when the lamps are, since tide changes tiles. */
function syncWet(s: FieldFxState): void {
  if (wetKey === lampKey) return;
  wetKey = lampKey;
  wgx = Math.floor(s.cam[0] / 8) - 2; wgy = Math.floor(s.cam[1] / 8) - 2;
  wetGrid.fill(-2);
  openGrid.fill(-1);
}

/** How open the water round a tile is, from 0 to 1: the share of water in the five by five tiles centered on it. A brook is under 0.45 and open sea near 1. */
const openGrid = new Float32Array(30 * 30);
function openAt(tx: number, ty: number): number {
  const gx = tx - wgx, gy = ty - wgy;
  if (gx < 0 || gy < 0 || gx >= 30 || gy >= 30) return 0;
  const i = gy * 30 + gx;
  if (openGrid[i] < 0) {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (wetTile(tx + dx, ty + dy) === 2) n++;
    openGrid[i] = n / 25;
  }
  return openGrid[i];
}

/** Screen pixels on water this frame, so the composite can keep unlit water from going darker than unlit ground. */
const WETPX = new Uint8Array(N);
let wetPxKey = '', anyWet = false;
function waterMask(s: FieldFxState): void {
  const key = `${lampKey}|${s.cam[0]}|${s.cam[1]}`;
  if (key === wetPxKey) return;
  wetPxKey = key;
  WETPX.fill(0);
  anyWet = false;
  if (!waters.length) return;
  syncWet(s);
  const cx = s.cam[0], cy = s.cam[1];
  for (let ty = Math.floor(cy / 8); ty <= Math.floor((cy + SH - 1) / 8); ty++) for (let tx = Math.floor(cx / 8); tx <= Math.floor((cx + SW - 1) / 8); tx++) {
    if (wetTile(tx, ty) !== 2) continue;
    anyWet = true;
    const x0 = Math.max(0, tx * 8 - cx), x1 = Math.min(SW, tx * 8 + 8 - cx);
    for (let y = Math.max(0, ty * 8 - cy); y < Math.min(SH, ty * 8 + 8 - cy); y++) WETPX.fill(1, y * SW + x0, y * SW + x1);
  }
}

/**
 * Light on water: a band of short flickering glints on open water, widening toward the bottom of the map, and sparse glints on all water.
 * The band is fixed to the map rather than the screen, so water does not light up as Ouro walks past it, and it fades out toward its edges
 * and over narrow water, where a solid band would read as a lit block. Ground beside water takes no glints.
 */
function moonPath(s: FieldFxState): void {
  // Glints turn over every 14 frames, so the path is rebuilt every other frame or when the view moves, and restored between.
  const mn = moonNow!;
  const key = `${lampKey}|${s.cam[0]}|${s.cam[1]}|${s.t >> 1}|${mn.x}|${mn.path}`;
  if (key === pathKey) { for (const i of pathPx) PATH[i] = 1; return; }
  pathKey = key;
  for (const i of pathPx) PATH[i] = 0;
  pathPx.length = 0;
  if (!waters.length) return;
  syncWet(s);
  // The band sits over the middle of the map's water, nudged toward the moon's side, and widens toward the map's bottom edge.
  const MH = s.map.rows.length * 8;
  // Under the Apex moon the band leans along the way toward the moon and passes through the middle of the water. A sky's moon nudges it to the moon's side.
  const apexMoon = mn.ty !== -1 || mn.tx !== 0;
  const mx = waterMid(s) + (apexMoon ? 0 : (mn.x / SW - 0.5) * SW * 0.5), foot = mx, my = waterMidY;
  const lean = apexMoon ? Math.max(-1.5, Math.min(1.5, mn.tx / Math.min(-0.05, mn.ty))) : 0;
  // Every bit of water keeps a few glints, more while the moon stands ahead of the view.
  const scattered = 0.03 + 0.03 * mn.path;
  for (let y = 0; y < SH; y++) {
    const wy = y + s.cam[1], f = Math.max(0, Math.min(1, wy / MH));
    const c = mx + (foot - mx) * f + (wy - my) * lean - s.cam[0], w = 5 + 30 * f;
    const ty = Math.floor(wy / 8);
    const off = Math.floor(hash(wy * 53 + 7) * 6);
    let cellNow = NaN, h = 0, len = 0, txNow = NaN, wet = 0, open = 0;
    for (let x = 0; x < SW; x++) {
      const wx = x + s.cam[0], tx = Math.floor(wx / 8);
      if (tx !== txNow) {
        txNow = tx; wet = wetTile(tx, ty);
        // Open water takes the band fully, and a brook or a narrow inlet takes none of it.
        const o = wet === 2 ? Math.max(0, Math.min(1, (openAt(tx, ty) - 0.45) / 0.4)) : 0;
        open = o * o * (3 - 2 * o);
      }
      if (wet !== 2) { x = (tx + 1) * 8 - s.cam[0] - 1; continue; }
      // Glints sit in cells fixed to the world, so they stay on the water as the view scrolls. Narrow water gets short ones.
      const cell = Math.floor((wx + off) / 6), at = (((wx + off) % 6) + 6) % 6;
      if (cell !== cellNow) {
        cellNow = cell;
        const ph = Math.floor((s.t + hash(cell * 31 + wy * 7) * 48) / 14);
        h = hash(cell * 977 + wy * 131 + ph * 7919);
        len = (open > 0.5 ? 2 : 1) + Math.floor(hash(cell * 13 + wy + ph) * (open > 0.5 ? 5 : 2));
      }
      // The band fades in from its edges with a smooth step, so it has no hard side.
      const a = Math.max(0, Math.min(1, 1 - Math.abs(x + 0.5 - c) / w)), band = a * a * (3 - 2 * a);
      const chance = scattered + band * open * (1 - 0.35 * f) * mn.path * 1.2;
      if (at < len && h < chance) { const i = y * SW + x; PATH[i] = 1; pathPx.push(i); }
    }
  }
}

/** Puts the path's glints into the light buffer, after shadows have cut it. */
function applyPath(): void {
  for (const i of pathPx) if (PATH[i] && lit[i] < 16) lit[i] = 16;
}

// ---------------------------------------------------------------- figures

/** A light reaches figures out to this many times its pool's radius, and lights the side of a figure facing it this much more than the ground. */
const FIG_REACH = 1.3, FIG_GAIN = 1.6;
/** How far light wraps past the side facing it, so the lit side ends in a short dithered band. */
const WRAP = 0.25;
/** Light from the sky on faces that point up, in sixteenths, so a figure far from any light still shows its shape. */
const SKY_FLOOR = 0;
/**
 * Shortest and longest shadow from a near light, in pixels past the edge of the feet. A shadow's length is 3 plus the figure's height times
 * its distance from the light over the light's height plus 6, so a low or distant light casts a long one and a lamp a tile away still shows one.
 */
const SHADOW_MIN = 3, SHADOW_MAX = 14;
/** Ink at the foot of a shadow from a full light, in sixteenths, and the share of it the shadow loses by its tip. */
const SHADOW_INK = 12, SHADOW_THIN = 0.75;
/** Ink under every figure's feet, in sixteenths. */
const CONTACT = 6;
/** A figure takes light as if it stood this far above its feet on screen, at the middle of its tile. */
const BODY = 3;
/** The view looks down at the ground at 45 degrees, so a sprite's face points south and up, and its top edge points north and up. */
const TILT = Math.SQRT1_2;

/** Solid tiles around the screen, filled on demand and kept until the tiles are scanned again: -1 unknown, 0 ground, 1 wall. */
const solidGrid = new Int8Array(30 * 30);
let sgx = 0, sgy = 0, solidKey = '';

/** Solid tiles that lie flat, so a shadow runs on across them: water, shallows, creases, and holes. */
const FLAT = new Set(['~', ':', 'z', 'Z', 'O']);

function wallAt(x: number, y: number, s: FieldFxState): boolean {
  const tx = Math.floor((x + s.cam[0]) / 8), ty = Math.floor((y + s.cam[1]) / 8);
  const gx = tx - sgx, gy = ty - sgy;
  if (gx < 0 || gy < 0 || gx >= 30 || gy >= 30) return true;
  const i = gy * 30 + gx;
  if (solidGrid[i] < 0) { const ch = field.tile(tx, ty); solidGrid[i] = isSolid(ch) && !FLAT.has(ch) ? 1 : 0; }
  return solidGrid[i] === 1;
}

/** Casts each figure's shadows on the ground, then picks the lit or unlit hue of every figure pixel by the direction it faces. */
function figureLight(s: FieldFxState): void {
  if (shaded) shade.fill(0);
  shaded = false;
  if (solidKey !== lampKey) { solidKey = lampKey; sgx = Math.floor(s.cam[0] / 8) - 2; sgy = Math.floor(s.cam[1] / 8) - 2; solidGrid.fill(-1); }
  clearFig();
  mainLight.clear();
  let n = 0;
  const t0 = performance.now();
  for (const f of s.figures) n += castShadows(f, s);
  const t1 = performance.now();
  applyPath();
  for (const f of s.figures) shadeFigure(f);
  lightStats.figs = s.figures.length; lightStats.shadows = n;
  lightStats.shadowMs = t1 - t0; lightStats.shadeMs = performance.now() - t1;
}

// ---------------------------------------------------------------- backlit figures

/** A moon shadow runs this long down the screen, and turns this much of the ground to ink at the feet, in sixteenths. The tip has half as much. */
const MOON_LONG = 22, MOON_INK = 8;
/** A backlit figure's body keeps this share of the lit lightness, as a fighter's does in battle. The rim leans this far toward the moon's color. */
const BACK_FILL = 1.15, RIM_LEAN = 0.4;

/** Colors written over figure pixels after the light pass: the dim fill and the moon rim of backlit figures. Zero where the lit or unlit hue shows. */
const FIG = new Uint32Array(N);
const figPx: number[] = [];

function clearFig(): void {
  for (const i of figPx) FIG[i] = 0;
  figPx.length = 0;
}

const word = (rgb: number) => (0xff000000 | ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 255)) >>> 0;

/** Each sprite's colors per pixel as drawn on screen, in blocks of 64: the dim fill, the moon rim, the lamp-lit form, and for thin ink pixels the dark tone of the body they join. Cached per sprite, sky, and moon. */
const spriteColCache = new Map<string, Uint32Array>();
let colSky: Sky | null = null, colTint = -1;

function spriteCols(f: Figure, m: LightMap): Uint32Array {
  const mn = moonNow!;
  if (colSky !== mn.sky || colTint !== mn.tint || spriteColCache.size > 600) { spriteColCache.clear(); colSky = mn.sky; colTint = mn.tint; }
  const key = f.s.px.join('') + f.s.c.join('') + (f.flip ? 'f' : '');
  let out = spriteColCache.get(key);
  if (out) return out;
  out = new Uint32Array(256);
  const lampT = parseInt(mn.sky.lampTint.slice(1), 16);
  const rgbAt = (i: number): number => {
    const ch = (f.s.px[i >> 3] || '')[f.flip ? 7 - (i & 7) : i & 7];
    return parseInt((ch === '1' ? INK : ch === '2' ? f.s.c[0] : ch === '4' ? f.s.c[2] || f.s.c[1] : f.s.c[1])!.slice(1), 16);
  };
  for (let i = 0; i < 64; i++) {
    if (!m.solid[i]) continue;
    const rgb = rgbAt(i), lit = twoHues(rgb, mn.sky)[1];
    out[i] = word(backFill(rgb, BACK_FILL));
    out[64 + i] = word(lean(lit, mn.tint, RIM_LEAN));
    out[128 + i] = word(lampCore(lit, lampT));
    // A thin limb shows as a darker tone of the body it joins, so it stands out from the dark ground rather than vanishing into it.
    if (m.thin[i]) out[192 + i] = word(sunk(backFill(m.next[i] >= 0 ? rgbAt(m.next[i]) : rgb, BACK_FILL), 0.7));
  }
  spriteColCache.set(key, out);
  return out;
}

/** The figure's silhouette laid down the screen away from the moon beyond its top edge. It cuts the light path out and darkens the ground a little. */
function moonShadow(solid: Uint8Array, top: number, foot: number, fx: number, gy: number, s: FieldFxState, strength: number, ux = moonNow!.ux, uy = moonNow!.uy): void {
  const hc = foot + 1 - top, len = MOON_LONG * hc / 8;
  const oy = gy - 1;
  const put = (X: number, Y: number, t: number) => {
    if (X < 0 || X >= SW || Y < 0 || Y >= SH) return;
    if (wallAt(X, Y, s) || wallAt((X + fx) / 2, (Y + oy) / 2, s)) return;
    const k = Y * SW + X;
    if (stamp[k] === stampN) return;
    stamp[k] = stampN;
    PATH[k] = 0;
    // The shadow thins to nothing at its tip rather than stopping at full strength.
    shade[k] = Math.min(16, shade[k] + MOON_INK * strength * (1 - t / len));
    shaded = true;
  };
  stampN++;
  if (Math.abs(uy) >= 0.6) {
    // Each row of the shadow is one row of the silhouette, shifted along the moon's slant and as wide as the figure. It runs down the screen, or up it when the moon is behind the view.
    const yA = oy, yB = oy + len * uy;
    const y0 = Math.max(0, Math.floor(Math.min(yA, yB) - 1)), y1 = Math.min(SH - 1, Math.ceil(Math.max(yA, yB) + 1));
    for (let Y = y0; Y <= y1; Y++) {
      const t = (Y + 0.5 - oy) / uy;
      if (t < 0 || t >= len) continue;
      const row = foot - Math.floor(t * hc / len);
      if (row < 0) continue;
      const base = Math.round(fx + t * ux - 4);
      for (let col = 0; col < 8; col++) if (solid[row * 8 + col]) put(base + col, Y, t);
    }
    return;
  }
  // A moon off to the side lays the silhouette along the ground in half-pixel steps, a few pixels deep, so the shadow has body.
  const deep = Math.round((1 - Math.abs(uy)) * 3);
  for (let t = 0; t < len; t += 0.5) {
    const row = foot - Math.floor(t * hc / len);
    if (row < 0) continue;
    const base = Math.round(fx + t * ux - 4), Y = Math.round(oy + t * uy);
    for (let col = 0; col < 8; col++) if (solid[row * 8 + col]) for (let d = 0; d <= deep; d++) put(base + col, Y - d, t);
  }
}

/** Marks pixels already shaded by the shadow being cast, so overlapping steps of one shadow do not stack. */
const stamp = new Uint32Array(SW * SH);
let stampN = 0;

/** The way a figure's moon shadow runs: the map's, or on a map round the Apex, away from the Apex from where the figure stands. */
function moonDirAt(fx: number, gy: number, s: FieldFxState): [number, number] {
  const mn = moonNow!;
  if (!mn.apex) return [mn.ux, mn.uy];
  const tw = moonTowardTile(s.map, G.time, Math.floor((fx + s.cam[0]) / 8), Math.floor((gy - 1 + s.cam[1]) / 8));
  return tw ? [-tw[0], -tw[1]] : [mn.ux, mn.uy];
}

/** Whether a light sits inside the figure's own box, as a STAR whorl's light does. */
const inside = (p: Pt, f: Figure, gy: number) => p.x > f.x - 0.5 && p.x < f.x + 8.5 && p.y > f.y - 0.5 && p.y < gy + 0.5;

/** The moon's shadow outdoors, and one from each light that reaches the figure, strongest first, up to three in all. Each is as dark as its light reaches the figure, so overlaps are darker. Returns how many it cast. */
function castShadows(f: Figure, s: FieldFxState): number {
  const m = lightMap(f.s, f.flip);
  const gy = f.y + f.bob + m.foot + 1, fx = f.x + 4, by = gy - BODY;
  if (fx < -24 || fx > SW + 24 || gy < -24 || gy > SH + 24) return 0;
  cands.length = 0;
  for (const p of pts) {
    if (!p.cast || inside(p, f, gy)) continue;
    const d = Math.hypot(p.x - fx, p.y - by), R = p.r * FIG_REACH;
    if (d < 2 || d >= R) continue;
    const v = 16 * p.peak * (1 - d / R);
    if (v >= 3) cands.push({ p, v });
  }
  contact(m.solid, m.foot, f.x, gy, s);
  // A STAR whorl is its own light, so only the others throw its shadows.
  const moonV = f.glow ? 0 : s.map.indoor ? MOON_V_IN : MOON_V;
  const outdoors = !f.glow && !s.map.indoor;
  if (moonV && !outdoors) cands.push({ p: null, v: moonV });
  cands.sort((a, b) => b.v - a.v);
  const lights: Lit[] = [];
  const [mux, muy] = moonDirAt(fx, gy, s);
  if (outdoors) {
    moonShadow(m.solid, m.top, m.foot, fx, gy, s, 1, mux, muy);
    lights.push({ dx: -mux, dy: -muy, moon: true, v: moonV });
  }
  for (const c of cands) {
    if (lights.length >= 3) break;
    if (!c.p) {
      moonShadow(m.solid, m.top, m.foot, fx, gy, s, c.v / MOON_V, mux, muy);
      lights.push({ dx: -mux, dy: -muy, moon: true, v: c.v });
      continue;
    }
    shadow(m.solid, m.top, m.foot, c.p, Math.min(1, c.v / 16), fx, gy, by, s);
    const d = Math.hypot(c.p.x - fx, c.p.y - by) || 1;
    lights.push({ dx: (c.p.x - fx) / d, dy: (c.p.y - by) / d, moon: false, v: c.v });
  }
  lights.sort((a, b) => b.v - a.v);
  mainLight.set(f, lights);
  return lights.length;
}

/** How strongly the moon lights a figure outdoors and through an interior's window, in sixteenths. A second light this strong also gives the figure a fainter rim. */
const MOON_V = 6, MOON_V_IN = 3, SECOND = 5;
/** A light that reaches a figure: the direction toward it on screen, whether it is the moon, and how strongly it reaches. */
interface Lit { dx: number; dy: number; moon: boolean; v: number }
const cands: { p: Pt | null; v: number }[] = [];
/** The lights that reach each figure this frame, strongest first. Its rim faces the first, and a fainter rim the second. */
const mainLight = new Map<Figure, Lit[]>();

/** A small patch of ink under the feet, one pixel wider than them each side, so a figure stands on darker ground even where no light reaches. */
function contact(solid: Uint8Array, foot: number, x: number, gy: number, s: FieldFxState): void {
  let c0 = 8, c1 = -1;
  for (let c = 0; c < 8; c++) if (solid[foot * 8 + c]) { c0 = Math.min(c0, c); c1 = c; }
  if (c1 < 0) return;
  const cx = x + (c0 + c1 + 1) / 2, rx = (c1 - c0 + 1) / 2 + 1, cy = gy - 0.5;
  for (let Y = Math.max(0, gy - 2); Y <= Math.min(SH - 1, gy + 1); Y++) {
    for (let X = Math.max(0, Math.floor(cx - rx)); X <= Math.min(SW - 1, Math.ceil(cx + rx)); X++) {
      const ex = (X + 0.5 - cx) / rx, ey = (Y + 0.5 - cy) / 1.6;
      if (ex * ex + ey * ey > 1 || wallAt(X, Y, s)) continue;
      const k = Y * SW + X;
      if (shade[k] < CONTACT) { shade[k] = CONTACT; shaded = true; }
    }
  }
}

const others: Pt[] = [];

/** The figure's silhouette laid on the ground away from light p, skewed along the light's direction. The ground under it keeps only the other lights and turns partly to ink. */
function shadow(solid: Uint8Array, top: number, foot: number, p: Pt, strength: number, fx: number, gy: number, by: number, s: FieldFxState): void {
  const dx = fx - p.x, dy = by - p.y, d = Math.hypot(dx, dy);
  const ux = dx / d, uy = dy / d, hc = foot + 1 - top;
  const len = Math.min(SHADOW_MAX, SHADOW_MIN + hc * d / (p.z + 6));
  // The figure's own pixels hide the ground under its feet, so a shadow falling sideways starts at the edge of the feet.
  let c0 = 8, c1 = -1;
  for (let c = 0; c < 8; c++) if (solid[foot * 8 + c]) { c0 = Math.min(c0, c); c1 = c; }
  const edge = c1 < 0 ? 0 : Math.abs(ux) * (c1 - c0 + 1) / 2, end = edge + len;
  // Across the shadow runs the figure's width, narrower when the shadow falls sideways, since a body is shallower than it is wide.
  let ex = -uy, ey = ux;
  if (ex < 0 || (ex === 0 && ey < 0)) { ex = -ex; ey = -ey; }
  const w = 1 - 0.4 * Math.abs(ux);
  const hw = 4 * w, oy = gy - 1;
  const xs = [fx - hw * ex, fx + hw * ex, fx - hw * ex + end * ux, fx + hw * ex + end * ux];
  const ys = [oy - hw * ey, oy + hw * ey, oy - hw * ey + end * uy, oy + hw * ey + end * uy];
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(SW - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(SH - 1, Math.ceil(Math.max(...ys)));
  if (x0 > x1 || y0 > y1) return;
  others.length = 0;
  for (const o of pts) if (o !== p && o.lampy === p.lampy && o.x + o.r > x0 && o.x - o.r < x1 + 1 && o.y + o.r > y0 && o.y - o.r < y1 + 1) others.push(o);
  // The shadow blocks only its own kind of light: a lamp's shadow takes the lamp's light away, a star's shadow the starlight.
  const buf = p.lampy ? lamp : lit;
  for (let Y = y0; Y <= y1; Y++) {
    const qy = Y + 0.5 - oy;
    for (let X = x0; X <= x1; X++) {
      const qx = X + 0.5 - fx;
      const t = qx * ux + qy * uy;
      if (t < 0 || t >= end) continue;
      const col = Math.floor((qx * ex + qy * ey) / w + 4);
      if (col < 0 || col > 7) continue;
      const tt = Math.max(0, t - edge);
      const row = foot - Math.floor(tt * hc / len);
      if (row < 0 || !solid[row * 8 + col]) continue;
      if (wallAt(X, Y, s) || wallAt((X + fx) / 2, (Y + oy) / 2, s)) continue;
      const k = Y * SW + X, cur = buf[k];
      let other = 0;
      for (const o of others) {
        const ox = X + 0.5 - o.x, oy2 = Y + 0.5 - o.y, od = Math.sqrt(ox * ox + oy2 * oy2);
        if (od < o.r) other = Math.max(other, (o.r - od) * 16 * o.peak / o.r);
      }
      // The shadow is darkest at the feet and thins to a quarter at its tip, and another light on the same ground thins it more.
      const fade = 1 - SHADOW_THIN * tt / len;
      if (other < cur) buf[k] = cur - (cur - other) * fade;
      shade[k] = Math.min(16, shade[k] + SHADOW_INK * strength * fade * (1 - Math.min(1, other / 16)));
      shaded = true;
    }
  }
}

const near: Pt[] = [];
const nearAtt: number[] = [];

/** Lights each pixel of a figure by how squarely it faces each light near it, dithered on the figure's own grid so the pattern moves with it. */
function shadeFigure(f: Figure): void {
  if (f.x <= -8 || f.y <= -8 || f.x >= SW || f.y >= SH) return;
  const m = lightMap(f.s, f.flip);
  const gy = f.y + f.bob + m.foot + 1, fx = f.x + 4, by = gy - BODY;
  near.length = 0; nearAtt.length = 0;
  if (!f.glow) for (const p of pts) {
    if (inside(p, f, gy)) continue;
    const R = p.r * FIG_REACH, d = Math.hypot(p.x - fx, p.y - by);
    if (d < R) { near.push(p); nearAtt.push(16 * FIG_GAIN * p.peak * (1 - d / R)); }
  }
  // Backlit, the edges that face the figure's strongest light take its rim (the moon's color, or the lamp's), and a strong second light a fainter rim.
  const mn = f.glow ? null : moonNow;
  const ls = mainLight.get(f) || [];
  const l1 = ls[0] || { dx: -(mn?.ux ?? 0), dy: -(mn?.uy ?? 1), moon: true, v: MOON_V }, l2 = ls[1] && ls[1].v >= SECOND ? ls[1] : null;
  const clear = (c: number, r: number) => c < 0 || c > 7 || r < 0 || r > 7 || !m.solid[r * 8 + c] || m.thin[r * 8 + c] === 1;
  const facing = (l: Lit, c: number, r: number) => (l.dy < -0.3 && clear(c, r - 1)) || (l.dy > 0.3 && clear(c, r + 1)) || (Math.abs(l.dx) > 0.35 && clear(c + Math.sign(l.dx), r));
  const cols = mn ? spriteCols(f, m) : null;
  for (let r = m.top; r <= m.foot; r++) {
    const Y = f.y + r;
    if (Y < 0 || Y >= SH) continue;
    const z = gy - (Y + 0.5);
    for (let c = 0; c < 8; c++) {
      const i = r * 8 + c, X = f.x + c;
      if (!m.solid[i] || X < 0 || X >= SW) continue;
      let v = 16, byLamp = false;
      if (!f.glow) {
        // The light map is in screen terms. Turned to the ground: x east, y south, z up.
        const nx = m.nx[i], ny = (m.nf[i] - m.nz[i]) * TILT, nz = (m.nf[i] + m.nz[i]) * TILT;
        v = SKY_FLOOR * Math.max(0, nz);
        for (let j = 0; j < near.length; j++) {
          const p = near[j], lx = p.x - X - 0.5, ly = p.y - by, lz = p.z - z;
          const dot = (nx * lx + ny * ly + nz * lz) / (Math.sqrt(lx * lx + ly * ly + lz * lz) || 1);
          if (dot <= -WRAP) continue;
          const val = nearAtt[j] * (dot + WRAP) / (1 + WRAP);
          if (val > v) { v = val; byLamp = p.lampy; }
        }
      }
      const k = Y * SW + X;
      // Steps of a quarter keep the dither on a figure to clean, regular patterns.
      const on = (v >> 2) * 4 > BAYER[(r & 3) * 4 + (c & 3)];
      lit[k] = on && !byLamp ? 16 : 0;
      lamp[k] = 0;
      shade[k] = 0;
      if (!mn) continue;
      const rimOf = (l: Lit) => l.moon ? cols![64 + i] : cols![128 + i];
      let col = 0;
      if (on) col = byLamp ? cols![128 + i] : 0;
      else if (m.thin[i]) {
        // A thin limb takes a rim when it points toward a light, and otherwise its lifted tone.
        const ox = m.nx[i], oy = -m.nz[i];
        col = ox * l1.dx + oy * l1.dy > 0.3 ? rimOf(l1) : l2 && ox * l2.dx + oy * l2.dy > 0.3 ? rimOf(l2) : cols![192 + i];
      } else if (facing(l1, c, r)) col = rimOf(l1);
      else if (l2 && ((r + c) & 1) === 0 && facing(l2, c, r)) col = rimOf(l2);
      else col = cols![i];
      if (col) { FIG[k] = col; figPx.push(k); }
    }
  }
}

// ---------------------------------------------------------------- the composite

// The screen is never read back, since that drops it off the GPU and makes every later sprite draw slow (Notes/lighting.md).

const INK32 = (() => { const v = parseInt(INK.slice(1), 16); return (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0; })();

/**
 * The color matrices for a sky over a region, for the unlit hue and the warmed lit hue, with each pixel color's result cached.
 * The screen uses few colors, so mapping it in one pass through these caches costs far less than drawing it through filters.
 */
interface Hues { dim: Float32Array; lit: Float32Array | null; lamp: [number, number, number]; edge: [number, number, number]; faint: string; dimOf: Map<number, number>; litOf: Map<number, number>; coreOf: Map<number, number>; waterOf: Map<number, number>; groundLum: number }

/** Lightness of a pixel word, for comparing two colors. */
const lumW = (c: number): number => 0.3 * (c & 255) + 0.59 * ((c >>> 8) & 255) + 0.11 * ((c >>> 16) & 255);
/** Two pixel words mixed, t of the way from a to b. */
const mixW = (a: number, b: number, t: number): number => rgbWord(
  ((a & 255) * (1 - t) + (b & 255) * t) / 255, (((a >>> 8) & 255) * (1 - t) + ((b >>> 8) & 255) * t) / 255, (((a >>> 16) & 255) * (1 - t) + ((b >>> 16) & 255) * t) / 255);
/** At most this share of the way toward its lit hue, unlit water is lifted so it is no darker than unlit ground. */
const WATER_LIFT = 0.6;
/** Matrix sets by what they contain, so maps with the same sky and palette share one. */
const filters = new Map<string, Hues>();
const skyKeys = new WeakMap<object, string>();
const keyOf = (o: object): string => { let k = skyKeys.get(o); if (!k) { k = JSON.stringify(o); skyKeys.set(o, k); } return k; };
const matrix = (values: string): Float32Array => Float32Array.from(values.trim().split(/[\s,]+/).map(Number));
const unit = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));
/** A pixel word (alpha, blue, green, red from the top byte down) from red, green, and blue between 0 and 1. */
const rgbWord = (r: number, g: number, b: number): number => (0xff000000 | (unit(b) << 16) | (unit(g) << 8) | unit(r)) >>> 0;

/** The matrices for a sky over a region, and the unlit form of the region's highlight for faint sky stars. */
function filtersFor(sky: Sky, p: Pal, sink = 1): Hues {
  const key = `${keyOf(sky)}|${keyOf(p)}|${sink}`;
  let f = filters.get(key);
  if (f) return f;
  const m = hueMatrices(sky, [p.g, p.g2, p.g3, p.path, p.w, p.w2, p.roof, p.a, p.x, p.wt, p.wt2, p.tr, p.tr2, p.hi], sink);
  const faint = twoHues(parseInt(p.hi.slice(1), 16), { ...sky, amb: 0 })[0];
  // A lamp's middle takes the lamp's own color through the color blend, so surfaces keep their lightness. Its edge adds a little of the lamp's color to the night.
  const t = parseInt(sky.lampTint.slice(1), 16), lamp: [number, number, number] = [(t >> 16) / 255, ((t >> 8) & 255) / 255, (t & 255) / 255];
  const dim = matrix(m.dim);
  const g = parseInt(p.g.slice(1), 16), gw = (0xff000000 | ((g & 255) << 16) | (g & 0xff00) | (g >>> 16)) >>> 0;
  f = { dim, lit: m.lit ? matrix(m.lit) : null, lamp, edge: [lamp[0] * 0.12, lamp[1] * 0.12, lamp[2] * 0.12], faint: '#' + (0x1000000 | faint).toString(16).slice(1), dimOf: new Map(), litOf: new Map(), coreOf: new Map(), waterOf: new Map(), groundLum: lumW(throughMatrix(gw, dim)) };
  filters.set(key, f);
  return f;
}

/** A pixel word through a color matrix in the order an SVG color matrix takes, alpha counted as 1. */
function throughMatrix(c: number, m: Float32Array): number {
  const r = (c & 255) / 255, g = ((c >>> 8) & 255) / 255, b = ((c >>> 16) & 255) / 255;
  return rgbWord(m[0] * r + m[1] * g + m[2] * b + m[3] + m[4], m[5] * r + m[6] * g + m[7] * b + m[8] + m[9], m[10] * r + m[11] * g + m[12] * b + m[13] + m[14]);
}

/** The color blend: the lamp's hue and saturation with the pixel's own lightness. */
function colorBlend(c: number, [lr, lg, lb]: [number, number, number]): number {
  const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
  const l = lum((c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255), d = l - lum(lr, lg, lb);
  let r = lr + d, g = lg + d, b = lb + d;
  const L = lum(r, g, b), n = Math.min(r, g, b), x = Math.max(r, g, b);
  if (n < 0) { r = L + (r - L) * L / (L - n); g = L + (g - L) * L / (L - n); b = L + (b - L) * L / (L - n); }
  if (x > 1) { r = L + (r - L) * (1 - L) / (x - L); g = L + (g - L) * (1 - L) / (x - L); b = L + (b - L) * (1 - L) / (x - L); }
  return rgbWord(r, g, b);
}

/** A cached color mapping. The cache empties if odd blends fill it, which keeps it small. */
function cached(map: Map<number, number>, c: number, make: (c: number) => number): number {
  let v = map.get(c);
  if (v === undefined) { if (map.size > 8192) map.clear(); v = make(c); map.set(c, v); }
  return v;
}

/** Swaps every screen pixel for its unlit or lit hue in one pass, adds the lamps' color, and lays the figures' shadows and fog over it. */
function composite(s: FieldFxState, sky: Sky, p: Pal, fog: boolean, sink: number): void {
  const c0 = performance.now();
  const f = filtersFor(sky, p, sink);
  const c1 = performance.now();
  const img = ctx.getImageData(0, 0, SW, SH), u = new Uint32Array(img.data.buffer);
  const c2 = performance.now();
  const [lx0, ly0, lx1, ly1] = lampBox;
  const inked = fog || shaded || figPx.length > 0;
  const dimOf = (c: number) => throughMatrix(c, f.dim);
  const litOf = f.lit ? (c: number) => throughMatrix(c, f.lit!) : null;
  const coreOf = (c: number) => colorBlend(c, f.lamp);
  // Unlit water is lifted toward its lit hue until it is as light as unlit ground, so no stretch of water reads darker than the bank.
  const waterOf = (c: number) => {
    const d = dimOf(c), l = litOf ? litOf(c) : c, ld = lumW(d), ll = lumW(l);
    if (ld >= f.groundLum || ll <= ld) return d;
    return mixW(d, l, Math.min(WATER_LIFT, (f.groundLum - ld) / (ll - ld)));
  };
  const wet = anyWet;
  const [er, eg, eb] = f.edge;
  // The dither is fixed to the world, so it scrolls with the ground instead of crawling over it.
  const ox = ((s.cam[0] % 4) + 4) % 4, oy = ((s.cam[1] % 4) + 4) % 4;
  for (let y = 0, i = 0; y < SH; y++) {
    const br = ((y + oy) & 3) * 4, lampRow = y >= ly0 && y <= ly1;
    for (let x = 0; x < SW; x++, i++) {
      const th = BAYER[br + ((x + ox) & 3)];
      let isLit: boolean, core = false, edge = false;
      if (lampRow && x >= lx0 && x <= lx1) {
        // A lamp's bright middle shows through a dither from 10 sixteenths and is solid from 19. It takes the lit form, then the lamp's color.
        const lv = lamp[i];
        core = lv - 10 > th * 0.6;
        isLit = lit[i] > th || core;
        edge = lv > th && !core;
      } else isLit = lit[i] > th;
      const c = u[i];
      // Ink keeps its own color under every light, so outlines and eyes stay dark.
      if (c === INK32) continue;
      let o: number;
      if (isLit) {
        o = litOf ? cached(f.litOf, c, litOf) : c;
        if (core) o = cached(f.coreOf, o, coreOf);
      } else {
        o = wet && WETPX[i] ? cached(f.waterOf, c, waterOf) : cached(f.dimOf, c, dimOf);
        // The edge of each lamp's pool: the night with a little of the lamp's color added.
        if (edge) o = rgbWord((o & 255) / 255 + er, ((o >>> 8) & 255) / 255 + eg, ((o >>> 16) & 255) / 255 + eb);
      }
      if (inked) { const k = fog && vis[i] <= th ? INK32 : FIG[i] ? FIG[i] : shade[i] > th ? INK32 : 0; if (k) o = k; }
      u[i] = o;
    }
  }
  const c3 = performance.now();
  ctx.putImageData(img, 0, 0);
  Object.assign(lightStats, { hueMs: c1 - c0, readMs: c2 - c1, passMs: c3 - c2, writeMs: performance.now() - c3 });
}

// ---------------------------------------------------------------- weather

function weather(s: FieldFxState, p: Pal): void {
  const r = s.map.region, id = s.map.id;
  if (s.map.indoor && r < 25) return;
  if (r === 6 || r === 19 || r === 40) fallFlakes(s, r === 19 ? 30 : 46, p.hi, 0.35, 1);
  else if (r === 18) fallFlakes(s, 14, p.w, 0.2, 2);
  else if (r === 4) rain(s, p, id === 'bole' ? 44 : 18);
  else if (r === 17) rain(s, p, 10);
  else if (r === 22) shimmer(s);
  else if (r === 24) margin(s, p);
  else if (r === 27) spots(s);
  else if (r === 28) trickle(s, p);
}

/** Things in the air that glow, so they draw after the light pass. */
function air(s: FieldFxState, p: Pal): void {
  const r = s.map.region;
  if (s.dark || (s.map.indoor && r < 25)) return;
  if (r === 8 || r === 21) drift(s, p, r === 21 ? 22 : 26, r === 21);
  else if (r === 22) drift(s, p, 10, true);
  else if (r === 25 || r === 30 || r === 32) glints(s, p);
  else if (r === 26) embers(s, p);
  else if (r === 29 || r === 31) drift(s, p, r === 31 && G.flags.tide ? 20 : 10, true);
}

/** Snow or flakes, fixed to the world so they scroll with it, falling at whole-pixel steps. */
function fallFlakes(s: FieldFxState, n: number, c: string, speed: number, size: number): void {
  for (let i = 0; i < n; i++) {
    const sp = speed * (0.6 + hash(i * 3 + 1) * 0.8);
    const wy = hash(i * 5 + 2) * 400 + s.t * sp;
    const wx = hash(i * 11 + 3) * 400 + Math.sin((s.t + i * 40) / 50) * 3;
    const x = Math.floor(((wx - s.cam[0]) % SW + SW) % SW), y = Math.floor(((wy - s.cam[1]) % SH + SH) % SH);
    ctx.fillStyle = c;
    ctx.fillRect(x, y, i % 4 === 0 ? size + 1 : size, 1);
  }
}

/** Rain near the Bole falls upward while the Bole stands, and down again once it is pulled. */
function rain(s: FieldFxState, p: Pal, n: number): void {
  const up = !G.pulled.includes('bole') && s.map.region === 4;
  for (let i = 0; i < n; i++) {
    const sp = 2 + hash(i * 3 + 7) * 2;
    const wy = hash(i * 5 + 4) * 400 + (up ? -1 : 1) * s.t * sp;
    const wx = hash(i * 11 + 9) * 400;
    const x = Math.floor(((wx - s.cam[0]) % SW + SW) % SW), y = Math.floor(((wy - s.cam[1]) % SH + SH) % SH);
    ctx.fillStyle = p.wt2;
    ctx.fillRect(x, y, 1, 3);
    px(x, up ? y : y + 2, p.hi);
  }
}

/** Star motes drifting toward the star on a sloped map, or rising elsewhere. */
function drift(s: FieldFxState, p: Pal, n: number, rise: boolean): void {
  const target = s.map.slope;
  for (let i = 0; i < n; i++) {
    const life = 240 + Math.floor(hash(i * 17 + 5) * 200);
    const age = (s.t + Math.floor(hash(i * 3 + 11) * life)) % life;
    const bx = hash(i * 7 + Math.floor((s.t + hash(i * 3 + 11) * life) / life) * 131) * SW;
    const by = hash(i * 13 + Math.floor((s.t + hash(i * 3 + 11) * life) / life) * 71) * SH;
    let x = bx, y = by;
    if (target && !rise) {
      const tx = target[0] * 8 + 4 - s.cam[0], ty = target[1] * 8 + 4 - s.cam[1];
      const f = age / life;
      x = bx + (tx - bx) * f * 0.5; y = by + (ty - by) * f * 0.5;
    } else y = by - age * 0.15;
    if (age % 40 < 30) px(Math.round(x), Math.round(y), i % 3 ? p.a : p.hi);
  }
}

/** Whole-pixel heat shimmer: a few screen rows shift one pixel sideways and back. */
function shimmer(s: FieldFxState): void {
  const cv = ctx.canvas as HTMLCanvasElement;
  for (let k = 0; k < 12; k++) {
    const y = (k * 17 + (s.t >> 2)) % SH;
    const dx = ((s.t >> 3) + k) % 4 < 2 ? 1 : -1;
    ctx.drawImage(cv, 0, y, SW, 1, dx, y, SW, 1);
  }
}

/** The edge of the world: the picture thins out toward the screen edges. */
function margin(s: FieldFxState, p: Pal): void {
  const lv = [0.75, 0.5, 0.25, 0.125];
  for (let i = 0; i < 4; i++) {
    const c = lv[i];
    dither(0, i * 3, SW, 3, p.hi, c);
    dither(0, SH - 3 - i * 3, SW, 3, p.hi, c);
    dither(i * 3, 12, 3, SH - 24, p.hi, c);
    dither(SW - 3 - i * 3, 12, 3, SH - 24, p.hi, c);
  }
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(hash(k + (s.t >> 6) * 7) * SW), y = Math.floor(hash(k * 3 + (s.t >> 6) * 13) * SH);
    px(x, y, p.x);
  }
}

/** Dust hanging in the light around Ouro on dark maps. */
function motes(s: FieldFxState, p: Pal): void {
  for (let i = 0; i < 10; i++) {
    const a = hash(i * 7 + 1) * Math.PI * 2 + s.t / (200 + i * 30);
    const r = 6 + hash(i * 13 + 2) * 20;
    const x = Math.round(s.px + Math.cos(a) * r), y = Math.round(s.py + Math.sin(a) * r * 0.8 - ((s.t / 8 + i * 9) % 12));
    if (((s.t >> 3) + i) % 5 !== 0) px(x, y, p.g3);
  }
}

// ---------------------------------------------------------------- falling stars

interface Star { t0: number; wx: number; wy: number; dx: number; dy: number; size: number; fall: number }
interface Glow { t0: number; wx: number; wy: number; size: number; life: number; reach: number; wet: boolean }
const stars: Star[] = [];
const glows: Glow[] = [];
let lastSpawn = 0;
let lastMap = '';

/** Frames a star takes to fall, by size. */
const FALL_T = [16, 22, 26, 34];
/** Light reach and light life of each size, as a share of the sky's. */
const REACH = [0.4, 0.8, 1.15, 1.6];
const LIFE = [0.35, 0.8, 1.1, 1.5];

/** Ground a falling star can land on. */
const LANDS = new Set(['.', ',', 's', 'n', '=', 'x', 'G', 'I', 'g', 'b', '_', 'N', 'E', 'S', 'W', '~']);
/** After the shadow passes and the sweep runs, the sky holds still for a breath before stars fall again. */
let hushUntil = 0;
let shadowWas = 0;

/** Spawns and ages the falling stars, and adds the light of each star in the air and each one that has landed. */
function starLights(s: FieldFxState, sky: Sky): void {
  if (s.t < lastSpawn) lastSpawn = s.t;
  if (shadowWas > 0 && strandFx.shadow === 0) hushUntil = s.t + 300;
  shadowWas = strandFx.shadow;
  const hushed = strandFx.shadow > 0 || s.t < hushUntil;
  const rate = starsPerMinute(s.map, sky, s.dusk);
  if (hushed || rate <= 0) lastSpawn = s.t;
  else if (s.t - lastSpawn > 3600 / rate * (0.5 + hash(lastSpawn))) {
    lastSpawn = s.t;
    for (let k = 0; k < 3; k++) {
      const h1 = hash(s.t * 3 + 1 + k * 101), h2 = hash(s.t * 7 + 2 + k * 211);
      const wx = Math.floor(s.cam[0] + 16 + h1 * 160), wy = Math.floor(s.cam[1] + 36 + h2 * 140);
      if (!LANDS.has(field.tile(Math.floor(wx / 8), Math.floor(wy / 8)))) continue;
      const [lo, hi] = sky.size;
      const size = Math.min(hi, lo + Math.floor(hash(s.t * 11 + 5) ** 2 * (hi - lo + 1)));
      const side = hash(s.t) < 0.5 ? -1 : 1;
      stars.push({ t0: s.t, wx, wy, dx: side * (14 + 6 * size + Math.floor(h1 * 20)), dy: -(46 + 20 * size + Math.floor(h2 * 30)), size, fall: FALL_T[size] });
      starNoise(s, 'fall', wx - s.cam[0], wy - s.cam[1], size);
      break;
    }
  }
  for (let i = stars.length - 1; i >= 0; i--) {
    const st = stars[i], age = s.t - st.t0;
    if (age < 0) { stars.splice(i, 1); continue; }
    if (age >= st.fall) {
      stars.splice(i, 1);
      const wet = field.tile(Math.floor(st.wx / 8), Math.floor(st.wy / 8)) === '~';
      glows.push({ t0: s.t, wx: st.wx, wy: st.wy, size: st.size, life: Math.round(sky.life * LIFE[st.size]), reach: sky.reach * REACH[st.size], wet });
      starNoise(s, wet ? 'splash' : 'land', st.wx - s.cam[0], st.wy - s.cam[1], st.size);
      scatter(st.wx, st.wy, st.size, wet, s.t);
      lightStats.landed = [st.wx - s.cam[0], st.wy - s.cam[1], s.t];
      continue;
    }
    const [hx, hy] = starHead(st, age, s);
    pool(hx, hy, 3 + 2 * st.size, 1.6, Z_AIR, false);
  }
  for (let i = glows.length - 1; i >= 0; i--) {
    const g = glows[i], age = s.t - g.t0;
    if (age >= g.life || age < 0) { glows.splice(i, 1); continue; }
    // The light holds for a moment, then its solid middle shrinks and its dithered edge creeps inward.
    const hold = g.life * 0.12;
    const f = age < hold ? 1 : 1 - (age - hold) / (g.life - hold);
    const flash = age < 4 ? 1.25 : 1;
    pool(g.wx - s.cam[0], g.wy - s.cam[1], g.reach * (0.55 + 0.45 * f) * flash, 3 * f * flash, Z_STAR, !g.wet);
  }
}

function starHead(st: Star, age: number, s: FieldFxState): [number, number] {
  const f = (age + 1) / st.fall;
  return [Math.round(st.wx - s.cam[0] + st.dx * (1 - f)), Math.round(st.wy - s.cam[1] + st.dy * (1 - f))];
}

/** A star's sound, placed left or right by where it lands on screen, quieter when small or far from Ouro, and kept low under the music. Stars off the screen make none. */
function starNoise(s: FieldFxState, kind: 'fall' | 'land' | 'splash', x: number, y: number, size: number): void {
  if (x < 0 || y < 0 || x >= SW || y >= SH) return;
  const far = Math.min(1, Math.hypot(x - s.px, y - s.py) / 150);
  starSound(kind, { size, pan: Math.max(-1, Math.min(1, x / (SW / 2) - 1)), vol: 0.5 * (0.55 + 0.15 * size) * (1 - 0.6 * far) });
}

// ---------------------------------------------------------------- glitter

/** One speck of a star's glitter, in world pixels with a height above the ground. `kind` 0 is flying out from a landing, 1 is rising like fizz, 2 has settled on the ground. */
interface Speck { wx: number; wy: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; kind: number; col: number; per: number; ph: number; bright: boolean; wet: boolean }
const specks: Speck[] = [];
/** Most specks alive at once, so a heavy starfall cannot pile up glitter. */
const SPECK_CAP = 140;
let glitterT = -1;

/** A landing's glitter: a burst of specks that drift out and up, then settle, and a few that rise like fizz. More for a bigger star. */
function scatter(wx: number, wy: number, size: number, wet: boolean, t: number): void {
  const burst = 5 + size * 4, fizz = 2 + size * 2;
  for (let k = 0; k < burst + fizz && specks.length < SPECK_CAP; k++) {
    const h1 = hash(t * 131 + k * 17), h2 = hash(t * 71 + k * 29 + 5), h3 = hash(t * 37 + k * 53 + 9);
    const rising = k >= burst, a = h1 * Math.PI * 2, sp = (0.25 + 0.45 * h2) * (1 + size * 0.2) * (wet ? 0.6 : 1);
    specks.push({
      wx: wx + (rising ? (h2 - 0.5) * 6 : 0), wy: wy + (rising ? (h3 - 0.5) * 3 : 0), z: rising && wet ? -2 : rising ? 0 : 1,
      vx: rising ? 0 : Math.cos(a) * sp, vy: rising ? 0 : Math.sin(a) * sp * 0.6, vz: rising ? 0.2 + 0.25 * h3 : (0.45 + 0.55 * h3) * (wet ? 0.5 : 1),
      age: 0, life: rising ? 30 + Math.floor(h2 * 40) : 240 + Math.floor(h3 * 260), kind: rising ? 1 : 0,
      col: Math.floor(h3 * 3), per: 14 + Math.floor(h1 * 40), ph: Math.floor(h2 * 60), bright: h1 < 0.15, wet,
    });
  }
}

/** Moves and draws the glitter in its lit colors: flying specks slow and sink, fizz wobbles up and winks out, settled specks twinkle at their own rates and fade. No speck covers a figure. */
function glitter(s: FieldFxState, p: Pal): void {
  if (!specks.length) { glitterT = s.t; return; }
  const steps = glitterT < 0 ? 1 : Math.max(0, Math.min(4, s.t - glitterT));
  glitterT = s.t;
  for (let n = 0; n < steps; n++) for (let i = specks.length - 1; i >= 0; i--) {
    const k = specks[i];
    k.age++;
    if (k.kind === 0) {
      k.wx += k.vx; k.wy += k.vy; k.z += k.vz;
      k.vx *= 0.93; k.vy *= 0.93;
      // Glitter is light, so it sinks slowly once it has stopped rising.
      k.vz = Math.max(-0.12, k.vz - 0.04);
      if (k.z <= 0 && k.vz < 0) {
        k.z = 0; k.kind = 2;
        // One settled speck in four stays on the ground for good and twinkles now and then.
        if (!k.wet && hash(k.ph * 7 + k.per * 13 + Math.round(k.wx)) < 0.25) {
          const list = kept.get(s.map.id) || [];
          list.push({ wx: k.wx, wy: k.wy, col: k.col, per: 140 + Math.floor(hash(k.ph + k.wy) * 260), ph: k.ph * 5, bright: k.bright });
          if (list.length > KEPT_CAP) list.splice(0, list.length - KEPT_CAP);
          kept.set(s.map.id, list);
          specks.splice(i, 1);
          continue;
        }
      }
    } else if (k.kind === 1) {
      k.z += k.vz;
      k.wx += Math.sin((k.age + k.ph) / 5) * 0.25;
    } else if (k.wet) k.wx += Math.sin((s.t + k.ph) / 40) * 0.05;
    if (k.age >= k.life) specks.splice(i, 1);
  }
  const cols = [p.hi, p.a, p.x];
  for (const k of specks) {
    const x = Math.round(k.wx - s.cam[0]), y = Math.round(k.wy - k.z - s.cam[1]);
    if (x < 1 || y < 1 || x >= SW - 1 || y >= SH - 1 || !shown(x, y)) continue;
    if (s.figures.some(f => x >= f.x && x < f.x + 8 && y >= f.y && y < f.y + 8)) continue;
    const left = 1 - k.age / k.life, cyc = (s.t + k.ph) % k.per;
    let on = true, peak = false;
    if (k.kind === 1) on = left > 0.25 || (k.age >> 1) % 2 === 0;
    else if (k.kind === 2) { on = cyc < k.per * 0.5 * left; peak = k.bright && cyc < 2 && left > 0.3; }
    if (!on) continue;
    const c = cols[k.col];
    if (peak) { px(x, y, '#ffffff'); px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); }
    else px(x, y, k.bright && k.kind !== 2 ? p.hi : c);
  }
}

/** Glitter that settled for good, by map: one pixel each that twinkles for a few frames now and then. */
interface Grain { wx: number; wy: number; col: number; per: number; ph: number; bright: boolean }
const kept = new Map<string, Grain[]>();
/** Most kept grains on one map. The oldest go first, so a map never fills up. */
const KEPT_CAP = 36;

/** Draws the kept grains and the flecks caught in footprints in their lit colors. A fleck twinkles less as its print fades. */
function keptGlitter(s: FieldFxState, p: Pal): void {
  const cols = [p.hi, p.a, p.x];
  const clear = (x: number, y: number) => x >= 1 && y >= 1 && x < SW - 1 && y < SH - 1 && shown(x, y) && !s.figures.some(f => x >= f.x && x < f.x + 8 && y >= f.y && y < f.y + 8);
  for (const g of kept.get(s.map.id) || []) {
    const x = Math.round(g.wx - s.cam[0]), y = Math.round(g.wy - s.cam[1]);
    const cyc = (s.t + g.ph) % g.per;
    if (cyc >= 3 || !clear(x, y)) continue;
    const c = cols[g.col];
    if (g.bright && cyc === 1) { px(x, y, '#ffffff'); px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); }
    else px(x, y, c);
  }
  for (const f of printFlecks(s.map.id, s.t)) {
    const x = Math.round(f.wx - s.cam[0]), y = Math.round(f.wy - s.cam[1]);
    if ((s.t + f.ph * 7) % 50 >= Math.max(1, Math.round(6 * f.left)) || !clear(x, y)) continue;
    px(x, y, f.left > 0.5 ? p.hi : p.x);
  }
}

/** Trails by size: how many steps, how far apart, and the colors from the head back. */
const TAIL_N = [2, 6, 8, 16];

function drawStars(s: FieldFxState, p: Pal): void {
  for (const st of stars) {
    const age = s.t - st.t0;
    const [hx, hy] = starHead(st, age, s);
    const len = Math.hypot(st.dx, st.dy), ux = st.dx / len, uy = st.dy / len;
    const n = TAIL_N[st.size], gap = st.size === 3 ? 1.5 : 2;
    for (let k = n; k >= 1; k--) {
      if (k > n / 2 && (k + age) % 2) continue;
      const c = k <= n * 0.25 ? p.hi : k <= n * 0.7 ? p.a : p.x;
      px(Math.round(hx + ux * k * gap), Math.round(hy + uy * k * gap), c);
    }
    if (st.size === 0) { px(hx, hy, p.hi); continue; }
    px(hx, hy, st.size === 3 ? '#ffffff' : p.hi);
    px(hx + 1, hy, p.hi); px(hx, hy + 1, p.hi); px(hx - 1, hy, p.a); px(hx, hy - 1, p.a);
    if (st.size >= 2) { px(hx + 2, hy, p.a); px(hx, hy + 2, p.a); }
    if (st.size === 3) { px(hx - 2, hy, p.a); px(hx, hy - 2, p.a); px(hx + 1, hy + 1, p.hi); px(hx - 1, hy - 1, p.a); }
  }
  for (const g of glows) {
    const age = s.t - g.t0, life = 1 - age / g.life;
    const cx = g.wx - s.cam[0], cy = g.wy - s.cam[1];
    const arm = 3 + 2 * g.size;
    if (age < 4) for (let k = -arm + age; k <= arm - age; k++) { px(cx + k, cy, p.hi); px(cx, cy + k, p.hi); }
    if (g.wet) {
      // A star that falls in water sends out a ripple and goes out.
      const r = Math.round(2 + age * 0.25);
      if (life > 0.4 && r < 14) for (let a = 0; a < 16; a++) if ((a + (age >> 2)) % 2) px(Math.round(cx + Math.cos(a / 8 * Math.PI) * r), Math.round(cy + Math.sin(a / 8 * Math.PI) * r * 0.6), p.hi);
      continue;
    }
    // The fallen star shows for as long as its light does, so every pool of its light has a source on screen. It flickers only at the very end.
    if (life < 0.15 && (age >> 2) % 2) continue;
    px(cx, cy, p.hi);
    if (g.size > 0 && ((age >> 2) % 3 !== 0 || life > 0.5)) { px(cx - 1, cy, p.a); px(cx + 1, cy, p.a); px(cx, cy - 1, p.a); }
  }
}

// ---------------------------------------------------------------- sky and water at night

/** Past the edge of an outdoor map the night sky shows, with faint stars and now and then a bright one. */
function skyStars(s: FieldFxState, p: Pal, sky: Sky): void {
  const rows = s.map.rows, W = rows[0].length * 8, H = rows.length * 8;
  const cx = s.cam[0], cy = s.cam[1];
  if (cx >= 0 && cy >= 0 && cx + SW <= W && cy + SH <= H) return;
  const faint = filtersFor(sky, p, sinkNow).faint;
  const gx0 = Math.floor(cx / 12), gy0 = Math.floor(cy / 12);
  for (let gy = gy0; gy <= gy0 + 16; gy++) for (let gx = gx0; gx <= gx0 + 16; gx++) {
    const h = hash(gx * 9173 + gy * 5807 + 11);
    if (h > 0.35) continue;
    const wx = gx * 12 + Math.floor(hash(gx * 31 + gy * 7) * 12), wy = gy * 12 + Math.floor(hash(gx * 11 + gy * 29) * 12);
    if (wx >= 0 && wy >= 0 && wx < W && wy < H) continue;
    const k = (s.t + Math.floor(h * 3000)) % 360;
    px(wx - cx, wy - cy, k < 24 || h < 0.04 ? p.hi : faint);
  }
}

/** Water catches the light: lit water shows glints that come and go, more where the light is strong. */
function waterGlints(s: FieldFxState, p: Pal): void {
  const cx = s.cam[0], cy = s.cam[1];
  for (const [tx, ty] of waters) {
    const x0 = tx * 8 - cx, y0 = ty * 8 - cy;
    if (x0 < -8 || y0 < -8 || x0 >= SW || y0 >= SH) continue;
    for (let k = 0; k < 3; k++) {
      const ph = (s.t >> 4) + k * 5 + tx * 3;
      const h = hash(tx * 73 + ty * 151 + k * 17 + Math.floor(ph / 4) * 977);
      const x = x0 + Math.floor(h * 7), y = y0 + Math.floor(hash(h * 1e6) * 8);
      if (x < 0 || y < 0 || x >= SW - 1 || y >= SH) continue;
      const lv = Math.max(lit[y * SW + x], lamp[y * SW + x]);
      if (lv < 6 + k * 3) continue;
      px(x, y, p.hi);
      if (lv > 12 && ph % 4 < 2) px(x + 1, y, p.wt2);
    }
  }
}

/** A falling star shows upside down in water below where it will land, its reflection rising to meet it. */
function reflections(s: FieldFxState, p: Pal): void {
  for (const st of stars) {
    const age = s.t - st.t0;
    const [hx, hy] = starHead(st, age, s);
    const ly = st.wy - s.cam[1];
    const ry = 2 * ly - hy;
    const len = Math.hypot(st.dx, st.dy), ux = st.dx / len, uy = st.dy / len;
    for (let k = 0; k <= TAIL_N[st.size]; k += 2) {
      const x = Math.round(hx + ux * k * 2), y = Math.round(ry - uy * k * 2);
      if (y < 0 || y >= SH || x < 0 || x >= SW || !shown(x, y)) continue;
      if (field.tile(Math.floor((x + s.cam[0]) / 8), Math.floor((y + s.cam[1]) / 8)) !== '~') continue;
      px(x, y, k === 0 ? p.hi : k < 6 ? p.a : p.wt2);
    }
  }
}

// ---------------------------------------------------------------- the Strand at low water

// The Gleaner's walk at low water. Content fills strandFx, and this file only ages and draws it.
let shadowMax = 0;
const FALL = 14, RINGS = 160;

/** Footprints the tide table shows before their stars come down. */
function marks(s: FieldFxState): void {
  for (const [mx, my] of strandFx.marks) {
    const cx = mx * 8 + 4 - s.cam[0], cy = my * 8 + 4 - s.cam[1];
    dither(cx - 3, cy - 1, 7, 3, INK, 0.5);
  }
}

/** Ages the shadow and the landings once a frame, and returns the age of the newest landing's hop, or -1. */
function ageStrand(): number {
  if (strandFx.shadow > 0) {
    if (strandFx.shadow > shadowMax) shadowMax = strandFx.shadow;
    strandFx.shadow--;
  } else shadowMax = 0;
  let hop = -1;
  for (const l of strandFx.landings) {
    l.t++;
    const age = l.t - FALL;
    if (age >= 0 && age < 10) hop = age;
  }
  while (strandFx.landings.length && strandFx.landings[0].t > FALL + RINGS) strandFx.landings.shift();
  return hop;
}

/** The shadow's core takes the light away under it. */
function shadowLight(prog: number): void {
  const cx = Math.round((-120 + prog * (SW + 240)) / 4) * 4, cy = SH / 2 + 12;
  for (let by = 0; by < SH; by += 4) {
    const ny = (by + 2 - cy) / 150;
    if (Math.abs(ny) >= 1) continue;
    const hw = Math.round(96 * Math.sqrt(1 - ny * ny) * 0.8 / 4) * 4;
    if (hw > 0) subLight(cx - hw, by, hw * 2, 4, 0.75);
  }
}

/** The shadow moves in whole 4 pixel blocks, so its dither pattern stays put and only its edge advances. */
function giantShadow(prog: number): void {
  const cx = Math.round((-120 + prog * (SW + 240)) / 4) * 4, cy = SH / 2 + 12;
  for (let by = 0; by < SH; by += 4) {
    const ny = (by + 2 - cy) / 150;
    if (Math.abs(ny) >= 1) continue;
    const span = Math.sqrt(1 - ny * ny);
    // Bayer levels nest, so the three bands stack into a soft edge, a body, and a dark core.
    for (const [k, lv] of [[1, 0.1875], [0.8, 0.3125], [0.5, 0.4375]]) {
      const hw = Math.round(96 * span * k / 4) * 4;
      if (hw > 0) dither(cx - hw, by, hw * 2, 4, INK, lv);
    }
  }
}

/** Landings light the sand: a pool that shrinks as it fades, and two rings of the lit hue spreading out from it. */
function landingLights(s: FieldFxState): void {
  for (const l of strandFx.landings) {
    if (l.t === 1) starNoise(s, 'fall', l.x * 8 + 4 - s.cam[0], l.y * 8 + 4 - s.cam[1], 2);
    if (l.t === FALL + 1) {
      starNoise(s, 'land', l.x * 8 + 4 - s.cam[0], l.y * 8 + 4 - s.cam[1], 2);
      scatter(l.x * 8 + 4, l.y * 8 + 4, 2, false, s.t);
    }
    if (l.t <= FALL) {
      const f = l.t / FALL;
      pool(l.x * 8 + 4 - s.cam[0] - 30 * (1 - f), l.y * 8 + 4 - s.cam[1] - 110 * (1 - f), 8, 1.6, Z_AIR, false);
      continue;
    }
    const age = l.t - FALL, fade = 1 - age / RINGS;
    const cx = l.x * 8 + 4 - s.cam[0], cy = l.y * 8 + 4 - s.cam[1];
    pool(cx, cy, 14 + 10 * fade, 3 * fade, Z_STAR, true);
    for (let k = 0; k < 2; k++) {
      const r = 4 + ((age * 0.35 + k * 18) % 36);
      addRing(cx, cy, r, 2.5, (1 - r / 40) * fade * 1.4);
    }
  }
}

/** The stars of the landings: one falling on a slant, then the fallen star with a pulse that never goes out. */
function strandLandings(s: FieldFxState, p: Pal): void {
  for (const l of strandFx.landings) {
    const cx = l.x * 8 + 4 - s.cam[0], cy = l.y * 8 + 4 - s.cam[1];
    if (l.t <= FALL) { comingDown(cx, cy, l.t, p); continue; }
    const age = l.t - FALL;
    if (age < 5) for (let k = -7 + age; k <= 7 - age; k++) { px(cx + k, cy, p.hi); px(cx, cy + k, p.hi); }
    const pulse = Math.cos(age / 12) > 0;
    px(cx, cy, '#ffffff'); px(cx - 1, cy, p.a); px(cx + 1, cy, p.a); px(cx, cy - 1, pulse ? p.hi : p.a); px(cx, cy + 1, p.a);
  }
}

/** A star falling into a footprint on a slant, its tail in whole-pixel steps. */
function comingDown(cx: number, cy: number, t: number, p: Pal): void {
  const f = t / FALL;
  const hx = Math.round(cx - 30 * (1 - f)), hy = Math.round(cy - 110 * (1 - f));
  for (let k = 6; k >= 1; k--) {
    if (k > 3 && (k + t) & 1) continue;
    px(Math.round(hx - k * 0.8), Math.round(hy - k * 3), k < 3 ? p.hi : k < 5 ? p.a : p.x);
  }
  px(hx, hy, '#ffffff'); px(hx + 1, hy, p.hi); px(hx, hy + 1, p.hi); px(hx - 1, hy, p.a);
}

/** Sand grains jump when a foot comes down, then settle. */
function hopSand(s: FieldFxState, p: Pal, age: number): void {
  const up = [1, 2, 3, 3, 2, 2, 1, 1, 0, 0][age];
  if (!up) return;
  for (let i = 0; i < 36; i++) {
    const wx = Math.floor(hash(i * 13 + 7) * 400), wy = Math.floor(hash(i * 29 + 3) * 400);
    const x = ((wx - s.cam[0]) % SW + SW) % SW, y = ((wy - s.cam[1]) % SH + SH) % SH;
    px(Math.floor(x), Math.floor(y), p.g2);
    px(Math.floor(x), Math.floor(y) - up, i % 3 ? p.g3 : p.hi);
  }
}

// ---------------------------------------------------------------- star rings on a fogged map

/** Shows only tiles inside a ring or beside Ouro, each thinning into the dark over two pixels where its neighbor is hidden. */
function ringVis(s: FieldFxState): void {
  vis.fill(0);
  const tx0 = Math.floor(s.cam[0] / 8), ty0 = Math.floor(s.cam[1] / 8);
  const ox = field.x, oy = field.y;
  const show = (tx: number, ty: number) => ringLit(tx, ty, ox, oy);
  for (let ty = ty0; ty <= ty0 + 24; ty++) for (let tx = tx0; tx <= tx0 + 24; tx++) {
    if (!show(tx, ty)) continue;
    const x = tx * 8 - s.cam[0], y = ty * 8 - s.cam[1];
    const up = show(tx, ty - 1), rt = show(tx + 1, ty), dn = show(tx, ty + 1), lf = show(tx - 1, ty);
    for (let j = 0; j < 8; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= SH) continue;
      for (let i = 0; i < 8; i++) {
        const xx = x + i;
        if (xx < 0 || xx >= SW) continue;
        const edge = (!up && j < 2) || (!dn && j > 5) || (!lf && i < 2) || (!rt && i > 5);
        vis[yy * SW + xx] = edge ? 10 : 16;
      }
    }
  }
}

/** A gold halo just outside each ring, a dotted circle at its true edge, and its star in the middle. */
function ringMarks(s: FieldFxState, p: Pal): void {
  const tx0 = Math.floor(s.cam[0] / 8), ty0 = Math.floor(s.cam[1] / 8);
  const ox = field.x, oy = field.y;
  for (let ty = ty0; ty <= ty0 + 24; ty++) for (let tx = tx0; tx <= tx0 + 24; tx++) {
    if (ringLit(tx, ty, ox, oy)) continue;
    const near = strandFx.rings.some(r => Math.hypot(tx - r.x, ty - r.y) <= r.r + 1.5);
    const nb = ringLit(tx, ty - 1, ox, oy) || ringLit(tx + 1, ty, ox, oy) || ringLit(tx, ty + 1, ox, oy) || ringLit(tx - 1, ty, ox, oy);
    if (near && nb) dither(tx * 8 - s.cam[0], ty * 8 - s.cam[1], 8, 8, p.a, 0.125);
  }
  for (const r of strandFx.rings) {
    const cx = r.x * 8 + 4 - s.cam[0], cy = r.y * 8 + 4 - s.cam[1];
    ring(cx, cy, r.r * 8 + 2, 1.5, p.a, 0.5);
    ring(cx, cy, r.r * 8 + 5, 1.5, p.a, 0.1875);
    const pulse = Math.cos(s.t / 30) > 0.3;
    px(cx, cy, '#ffffff'); px(cx - 1, cy, p.a); px(cx + 1, cy, p.a); px(cx, cy - 1, p.a); px(cx, cy + 1, p.a);
    if (pulse) { px(cx - 2, cy, p.hi); px(cx + 2, cy, p.hi); px(cx, cy - 2, p.hi); px(cx, cy + 2, p.hi); }
  }
}

const on = (x: number, y: number, lv: number) => BAYER[(y & 3) * 4 + (x & 3)] < lv * 16;

/** A ring of color one or two pixels wide, ordered-dithered at `lv`. */
function ring(cx: number, cy: number, r: number, w: number, c: string, lv: number): void {
  if (lv <= 0 || r <= 0) return;
  ctx.fillStyle = c;
  const ro = r + w / 2, ri = Math.max(0, r - w / 2);
  const y0 = Math.max(0, Math.floor(cy - ro)), y1 = Math.min(SH - 1, Math.ceil(cy + ro));
  // Only the pixels between the two circles are visited, row by row.
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, xo = Math.sqrt(Math.max(0, ro * ro - dy * dy)), xi = dy * dy < ri * ri ? Math.sqrt(ri * ri - dy * dy) : 0;
    for (const [a, b] of [[cx - xo, cx - xi], [cx + xi, cx + xo]]) {
      for (let x = Math.max(0, Math.round(a)); x < Math.min(SW, Math.round(b)); x++) if (on(x, y, lv)) ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- the Strand's air

/** Star grains in the sand catch the light now and then: each is always a gold point, and briefly a cross. */
function glints(s: FieldFxState, p: Pal): void {
  const x0 = Math.floor(s.cam[0] / 24), y0 = Math.floor(s.cam[1] / 24);
  for (let gy = y0; gy <= y0 + 8; gy++) for (let gx = x0; gx <= x0 + 8; gx++) {
    const h = hash(gx * 7919 + gy * 104729);
    if (h > 0.45) continue;
    const wx = gx * 24 + Math.floor(hash(gx * 31 + gy * 17) * 24), wy = gy * 24 + Math.floor(hash(gx * 13 + gy * 37) * 24);
    const ch = field.tile(Math.floor(wx / 8), Math.floor(wy / 8));
    if (!LANDS.has(ch) || ch === '~') continue;
    const x = wx - s.cam[0], y = wy - s.cam[1];
    if (!shown(x, y)) continue;
    const k = (s.t + Math.floor(h * 997)) % 220;
    px(x, y, k < 110 ? p.a : p.g3);
    if (k < 6) { px(x - 1, y, p.hi); px(x + 1, y, p.hi); px(x, y - 1, p.hi); px(x, y + 1, p.hi); if (k > 1 && k < 4) { px(x - 2, y, p.a); px(x + 2, y, p.a); } }
  }
}

/** Where ember i is now on screen, its age, and its life in frames. */
function ember(i: number, t: number): [number, number, number, number] {
  const life = 180 + Math.floor(hash(i * 5 + 1) * 120);
  const age = (t + Math.floor(hash(i * 3 + 2) * life)) % life;
  const gen = Math.floor((t + Math.floor(hash(i * 3 + 2) * life)) / life);
  const wx = hash(i * 7 + gen * 13) * SW, wy = SH - 10 - hash(i * 11 + gen * 7) * 40;
  return [Math.round(wx + Math.sin((age + i * 20) / 18) * 3), Math.round(wy - age * 0.5), age, life];
}

/** Sparks from the Sand Dollar's fire drift up and out through the petals. */
function embers(s: FieldFxState, p: Pal): void {
  for (let i = 0; i < 14; i++) {
    const [x, y, age, life] = ember(i, s.t);
    px(x, y, age < life * 0.6 ? p.a : p.x);
    if (age < 30) px(x, y + 1, p.hi);
  }
}

/** Each young ember lights a few pixels around it. */
function emberLights(s: FieldFxState): void {
  for (let i = 0; i < 14; i++) {
    const [x, y, age, life] = ember(i, s.t);
    if (age < life * 0.6) pool(x + 0.5, y + 0.5, 6, 1.4, Z_EMBER, false);
  }
}

/** The dark spots on the inside of the Cowrie's dome drift, and their shade drifts across the floor. */
function spots(s: FieldFxState): void {
  for (let i = 0; i < 3; i++) {
    const wx = (hash(i * 3 + 5) * 600 + s.t / (10 + i * 3)) % 600, wy = hash(i * 7 + 9) * 300;
    const cx = Math.round((wx - s.cam[0] * 0.5 - 100) / 4) * 4, cy = Math.round((((wy - s.cam[1] * 0.5) % 300) + 300) % 300 - 40);
    const r = 16 + i * 6;
    for (let by = cy - r; by < cy + r; by += 4) {
      const hw = Math.round(Math.sqrt(Math.max(0, r * r - (by + 2 - cy) ** 2)) / 4) * 4;
      if (hw > 0) dither(cx - hw, by, hw * 2, 4, INK, 0.125);
    }
  }
}

/** Sand trickles down inside the Auger from the turns above, in a few thin falls. */
function trickle(s: FieldFxState, p: Pal): void {
  for (let i = 0; i < 4; i++) {
    const wx = Math.floor(hash(i * 17 + 3) * 400);
    const x = ((wx - s.cam[0]) % SW + SW) % SW;
    for (let k = 0; k < 10; k++) {
      const y = (s.t * 2 + k * 19 + i * 47) % SH;
      px(Math.floor(x) + ((k + i) & 1), y, k % 3 ? p.g3 : p.a);
    }
  }
}
