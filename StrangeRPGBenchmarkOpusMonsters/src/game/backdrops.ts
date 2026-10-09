// Battle backdrops. Each one paints a 96 by 60 scene that the battle view shows at double size,
// so the backdrop and the double-size sloughs share one pixel grid.
// The still part of each scene is painted once into a cached canvas. Only the moving part is drawn every frame.
// Every scene is at night like the field: it shows its unlit hue, and light reveals the lit hue through an ordered dither (Notes/lighting.md).
import { ctx, INK } from '../engine/screen';
import { starSound } from '../engine/audio';
import { lightMap, type LightMap } from '../engine/sprites';
import type { SpriteData } from '../battle/model';
import { MAPS, type MapDef } from './world';
import { backFill, fromLab, lampCore, lampEdge, skyFor, starsPerMinute, sunk, toLab, twoHues, type Sky } from './skies';

export const SCENE_W = 96;
export const SCENE_H = 60;
/** Where the out sloughs stand, in scene pixels (top left of the 8 by 8 sprite). */
export const FOE_AT: [number, number] = [71, 12];
export const MINE_AT: [number, number] = [18, 38];

const W = SCENE_W, H = SCENE_H, N = W * H;

/** A light cast by a move or an event, in scene pixels. */
export interface SceneLight {
  x: number;
  y: number;
  /** Radius in scene pixels. */
  r: number;
  /** Strength: 1 fully lights only the middle, 2 the inner half. */
  lv: number;
  /** A color the lit hue leans toward, such as a move's type color. */
  tint?: string;
  /** Draws a bright point at the middle, for a light that travels. */
  core?: boolean;
}

export interface SceneState {
  /** Frame counter. */
  t: number;
  /** Stays loosened so far: each one adds a crease to the ground. */
  loose: number;
  /** 0 by night, 1 for the evening scene, which darkens the unlit hue and brings more stars as on the field. */
  dusk: number;
  /** The map the battle is on, which picks the sky. Without it the scene uses a map that has this backdrop. */
  map?: string;
  /** Battle intensity from 0 to 1. Stars fall faster as it rises. */
  heat?: number;
  /** Lights cast by moves and events this frame. */
  lights?: SceneLight[];
  /** The sloughs and summons on screen, which cast shadows from the key light. */
  figures?: SceneFigure[];
}

let S: SceneState = { t: 0, loose: 0, dusk: 0 };

/** The field keeps this current: the backdrop for the map Vellum is on, and how far evening has come. */
export const sceneNow = { key: 'fellside', dusk: 0 };

// ---------------------------------------------------------------- drawing into the current target

let T: CanvasRenderingContext2D = ctx;
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const pats = new Map<string, CanvasPattern>();

/** What a scene pixel shows, which decides how it takes the night and whether stars land on it. */
const THING = 0, SKY = 1, STAR = 2, WATER = 3, GROUND = 4;
/** While a still part is painted, the kind of every pixel, and the kind the next shapes write. */
let kinds: Uint8Array | null = null;
let tag = THING;
/** Where shapes go: 0 the canvas T, 1 the frame's copy of the still part (it takes the two hues), 2 the glow layer (it keeps its lit colors). */
let mode = 0;
const WORLD = new Uint32Array(N), GLOW = new Uint32Array(N);
let inAnim = false;

const words = new Map<string, number>();
/** A '#rrggbb' color as an opaque image word. */
function word(col: string): number {
  let v = words.get(col);
  if (v === undefined) { v = u32(parseInt(col.slice(1), 16)); words.set(col, v); }
  return v;
}

/** Fills a rectangle of a pixel buffer, or the pixels of it that a Bayer step covers. */
function fillBuf(buf: Uint32Array | Uint8Array, x: number, y: number, w: number, h: number, v: number, steps: number): void {
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = Math.max(0, y); yy < y1; yy++) {
    const row = yy * W, br = (yy & 3) * 4;
    for (let xx = Math.max(0, x); xx < x1; xx++) if (steps >= 16 || BAY[br + (xx & 3)] < steps) buf[row + xx] = v;
  }
}

function rect(x: number, y: number, w: number, h: number, col: string): void {
  const X = Math.round(x), Y = Math.round(y), w2 = Math.round(w), h2 = Math.round(h);
  if (mode) { fillBuf(mode === 1 ? WORLD : GLOW, X, Y, w2, h2, word(col), 16); return; }
  T.fillStyle = col;
  T.fillRect(X, Y, w2, h2);
  if (kinds) fillBuf(kinds, X, Y, w2, h2, tag, 16);
}
function px(x: number, y: number, col: string): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  rect(x, y, 1, 1, col);
}

/** Ordered dither: covers `level` (0 to 1) of the area with col in a fixed 4 by 4 pattern anchored to the scene. */
function dither(x: number, y: number, w: number, h: number, col: string, level: number): void {
  const steps = Math.max(0, Math.min(16, Math.ceil(level * 16)));
  if (steps === 0 || w <= 0 || h <= 0) return;
  const X = Math.round(x), Y = Math.round(y), w2 = Math.round(w), h2 = Math.round(h);
  if (mode) { fillBuf(mode === 1 ? WORLD : GLOW, X, Y, w2, h2, word(col), steps); return; }
  if (kinds) fillBuf(kinds, X, Y, w2, h2, tag, steps);
  if (steps === 16) { T.fillStyle = col; T.fillRect(X, Y, w2, h2); return; }
  const key = col + steps;
  let p = pats.get(key);
  if (!p) {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const g = cv.getContext('2d')!;
    g.fillStyle = col;
    for (let k = 0; k < 16; k++) if (BAY[k] < steps) g.fillRect(k & 3, k >> 2, 1, 1);
    p = T.createPattern(cv, 'repeat')!;
    pats.set(key, p);
  }
  T.fillStyle = p;
  T.fillRect(X, Y, w2, h2);
}

/** Paints with every pixel marked as kind k. */
function paintAs(k: number, fn: () => void): void {
  const p = tag;
  tag = k;
  fn();
  tag = p;
}

/** Draws something that gives off its own light, so it keeps its lit colors over the night. */
function glow(fn: () => void): void {
  if (!inAnim) { fn(); return; }
  const p = mode;
  mode = 2;
  fn();
  mode = p;
}

// ---------------------------------------------------------------- light

/** The horizon row and the top row of the far water, set by the still part as it paints. */
let hz = H, sea = -1;
/** Falling star colors from the head back, set by the still part. */
let starCols: [string, string, string] = ['#ffffff', '#fff4c4', '#ffd04a'];

interface Lamp { x: number; y: number; r: number; lv: number; sq: number; tint: number }
let lampList: Lamp[] | null = null;

/** How much of the lit hue shows at each pixel, in sixteenths, plain and tinted, and on a dark map how much shows at all. */
const LIT = new Float32Array(N), TLIT = new Float32Array(N), VIS = new Float32Array(N);
const TCOL = new Uint8Array(N);
let darkNow = false;

const tintIds = new Map<string, number>();
const tintLabs: [number, number, number][] = [];
const tintPow: number[] = [];
const tintHex: string[] = [];
/** The index of a tint. A strong tint, for the light of a move, lifts what it lights further toward its own color. */
function tintOf(col: string, strong = false): number {
  const key = strong ? col + '+' : col;
  let i = tintIds.get(key);
  if (i === undefined) {
    i = Math.min(255, tintLabs.length);
    tintLabs.push(toLab(parseInt(col.slice(1), 16)));
    tintPow.push(strong ? 1 : 0);
    tintHex.push(col);
    tintIds.set(key, i);
  }
  return i;
}

/** Starlight this frame, from falling stars and the stars that have landed, which keeps the plain lit form while lamps take their own color. */
const STARL = new Float32Array(N);
let toStar = false;

/** A pool of light: full within the core, thinning to nothing at radius r. `sq` flattens it for pools that lie on the ground. Overlaps keep the brighter. */
function pool(cx: number, cy: number, r: number, lv: number, sq: number, tint: number): void {
  if (r <= 0 || lv <= 0) return;
  const ry = r / sq;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  const k = 16 * lv / r, r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) * sq, dy2 = dy * dy, row = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, d2 = dx * dx + dy2;
      if (d2 >= r2) continue;
      const v = (r - Math.sqrt(d2)) * k, i = row + x;
      if (tint < 0) { const into = toStar ? STARL : LIT; if (v > into[i]) into[i] = v; }
      else if (v > TLIT[i]) { TLIT[i] = v; TCOL[i] = tint; }
    }
  }
  // On a dark map a light also lets the scene show around it, further than it lights.
  if (darkNow) {
    const R = r * 1.8, Ry = R / sq, kv = 16 * 1.43 / R;
    for (let y = Math.max(0, Math.floor(cy - Ry)); y <= Math.min(H - 1, Math.ceil(cy + Ry)); y++) {
      const dy = (y - cy) * sq;
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const d = Math.sqrt((x - cx) * (x - cx) + dy * dy);
        if (d < R) VIS[y * W + x] = Math.max(VIS[y * W + x], (R - d) * kv);
      }
    }
  }
}

/** Whether the moving part's lamps light the scene this frame: indoors and in scenes with a real light, and not under open sky. */
let animLamps = true;
/** Outdoor scenes whose painted lights are real: fires, and lights the people there carry. Every other outdoor scene is lit by the moon alone. */
const REAL_LIGHTS = new Set(['sanddollar', 'battlefield', 'hilt', 'tusk']);

/** A light painted into the scene: a lamp, a moon, a glowing shell. Called from a still part it lasts, from a moving part it lasts one frame. */
function lamp(x: number, y: number, r: number, tint?: string, lv = 2, sq = 1): void {
  const l: Lamp = { x, y, r, lv, sq, tint: tint ? tintOf(tint) : -1 };
  if (lampList) lampList.push(l);
  else if (inAnim && animLamps) pool(l.x, l.y, l.r, l.lv, l.sq, l.tint);
}

/** The light level at a scene pixel this frame, in sixteenths. */
function lightAt(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= W || y >= H) return 0;
  const i = (y | 0) * W + (x | 0);
  return Math.max(LIT[i], TLIT[i]);
}

function hash(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise along one axis, 0 to 1. */
function noise(x: number, seed: number, scale: number): number {
  const i = Math.floor(x / scale), f = x / scale - i;
  const a = hash(i * 7919 + seed * 104729), b = hash((i + 1) * 7919 + seed * 104729);
  return a + (b - a) * f * f * (3 - 2 * f);
}

/** Vertical bands through the colors, ordered-dithered where they meet. */
function grad(y0: number, y1: number, cols: string[]): void {
  const n = cols.length - 1;
  for (let y = y0; y < y1; y++) {
    const p = ((y - y0) / Math.max(1, y1 - y0 - 1)) * n;
    const i = Math.min(n - 1, Math.floor(p)), f = p - i;
    rect(0, y, W, 1, cols[i]);
    if (f > 0.06) dither(0, y, W, 1, cols[i + 1], f);
  }
}

/** A ridge line of hills filled down to `to`. */
function ridge(base: number, amp: number, seed: number, scale: number, col: string, to = H): void {
  for (let x = 0; x < W; x++) {
    const top = Math.round(base - amp * noise(x, seed, scale));
    rect(x, top, 1, to - top, col);
  }
}

/** Draws a small picture: each character maps to a color, '.' is clear. */
function pic(rows: string[], x: number, y: number, pal: Record<string, string>, flip = false): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col) px(x + (flip ? row.length - 1 - i : i), y + j, col);
    }
  });
}

/** The flat spot a slough stands on. */
function pad(x: number, y: number, w: number, col: string): void {
  rect(x + 2, y, w - 4, 1, col);
  rect(x, y + 1, w, 1, col);
  dither(x + 2, y + 2, w - 4, 1, col, 0.5);
}

function pads(col: string): void {
  pad(FOE_AT[0] - 4, FOE_AT[1] + 8, 16, col);
  pad(MINE_AT[0] - 5, MINE_AT[1] + 8, 18, col);
}

/** Visual law: taut ground shows a faint grid. Lines run toward a point on the horizon. */
function tautGrid(y0: number, col: string, vx = 48): void {
  if (S.loose >= 3) return;
  const step = S.loose === 0 ? 1 : 2;
  for (let k = 0, y = y0 + 2; y < H; k++, y += 2 + k * 2) for (let x = 0; x < W; x += step) px(x, y, col);
  for (let k = -6; k <= 6; k++) {
    for (let y = y0 + 1; y < H; y += 2 * step) {
      const x = Math.round(vx + k * 7 * (y - y0) / 8);
      if (x >= 0 && x < W) px(x, y, col);
    }
  }
}

/** Visual law: every loosened Stay adds a wavy black crease. */
function creases(y0: number): void {
  for (let n = 0; n < S.loose; n++) {
    const y = y0 + 4 + ((n * 11) % Math.max(1, H - y0 - 6));
    const x0 = Math.floor(hash(n + 3) * 50), len = 24 + Math.floor(hash(n + 9) * 30);
    for (let i = 0; i < len; i++) {
      const x = x0 + i;
      if (x >= W) break;
      const yy = y + Math.round(Math.sin((x + n * 5) / 3));
      rect(x, yy, 1, i > 3 && i < len - 4 ? 2 : 1, INK);
    }
  }
}

/** A stage for a slough: 'scallop' is a fan of ribs, 'spiral' a coiled mosaic, 'ring' a rim around a flat center. */
type Stage = [kind: 'scallop' | 'spiral' | 'ring', a: string, b: string];

function stageAt(x: number, y: number, w: number, h: number, st: Stage, ln: string): void {
  const [kind, a, b] = st;
  const cx = x + w / 2, cy = y + h / 2;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const nx = (xx + 0.5 - cx) / (w / 2), ny = (yy + 0.5 - cy) / (h / 2), d = Math.hypot(nx, ny);
    if (d > 1) continue;
    const ang = Math.atan2(ny, nx);
    let col: string;
    if (d > 0.8) col = ln;
    else if (kind === 'scallop') col = Math.floor((ang + Math.PI) / (Math.PI / 5)) % 2 ? a : b;
    else if (kind === 'spiral') col = ((d * 2.6 - (ang + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1 < 0.3 ? b : a;
    else col = d > 0.55 ? b : a;
    px(xx, yy, col);
  }
  dither(x + 2, y + h, w - 4, 1, ln, 0.5);
}

/** Stages wait until the rest of the still scene is painted, so ground detail never covers them. */
let stagePending: { st?: Stage; col: string } | null = null;

function drawStages(): void {
  if (!stagePending) return;
  const { st, col } = stagePending;
  stagePending = null;
  if (st) {
    stageAt(FOE_AT[0] - 4, FOE_AT[1] + 6, 16, 5, st, col);
    stageAt(MINE_AT[0] - 5, MINE_AT[1] + 6, 18, 6, st, col);
  } else pads(col);
}

/** Ground from the horizon down, with its grid, its creases, and the two stages or pads. */
function ground(y0: number, cols: string[], lineCol: string, padCol: string, st?: Stage): void {
  hz = Math.min(hz, y0);
  paintAs(GROUND, () => {
    grad(y0, H, cols);
    tautGrid(y0, lineCol);
    creases(y0);
  });
  stagePending = { st, col: padCol };
}

/** A night sky: bands of color from the top down, which take a deeper night than the land. */
function sky(y0: number, y1: number, cols: string[]): void {
  paintAs(SKY, () => grad(y0, y1, cols));
}

/** Sand ripples in perspective: close together near the horizon, wider and wavier nearer the viewer. */
function ripples(y0: number, dark: string, light: string, seed: number): void {
  for (let k = 1; ; k++) {
    const y = y0 + Math.round(k * 1.6 + k * k * 0.3);
    if (y >= H) break;
    const amp = 0.4 + k * 0.22, per = 5 + k * 1.5;
    for (let x = 0; x < W; x++) {
      if (noise(x, seed + k, 11) < 0.3) continue;
      const yy = y + Math.round(amp * Math.sin((x + k * 7) / per));
      px(x, yy, dark); px(x, yy - 1, light);
    }
  }
}

/** Shells scattered on the ground, smaller toward the horizon. */
function shells(y0: number, n: number, seed: number, body: string, ln: string, hi: string): void {
  for (let k = 0; k < n; k++) {
    const x = Math.floor(hash(seed * 97 + k) * (W - 4)) + 2, y = y0 + 3 + Math.floor(hash(seed * 89 + k * 5) * (H - y0 - 5));
    const s = (y - y0) / (H - y0);
    if (s < 0.3) { px(x, y, hi); px(x + 1, y, body); }
    else if (s < 0.65) pic(['.bb', 'bhb', 'bb.'], x, y, { b: body, h: ln }, !!(k & 1));
    else if (k % 3 === 0) whorl(x, y, 3, body, ln, hi);
    else pic(['.bbb.', 'bhbhb', '.bbb.', '..h..'], x, y, { b: body, h: ln });
  }
}

/** Tide pools that hold a piece of the sky. */
function pools(list: number[][], top: string, deep: string, rim: string): void {
  for (const [x, y, w] of list) {
    const h = Math.max(2, Math.round(w / 4));
    for (let j = 0; j < h; j++) {
      const hw = Math.round((w / 2) * Math.sqrt(1 - ((j + 0.5 - h / 2) / (h / 2)) ** 2));
      paintAs(j === 0 ? THING : WATER, () => rect(x + w / 2 - hw, y + j, hw * 2, 1, j === 0 ? rim : j < h / 2 ? top : deep));
    }
    rect(x + w / 2 - 1, y + 1, 3, 1, '#ffffff');
  }
}

/** A line one pixel wide, or `w` wide, between two points. */
function line(x0: number, y0: number, x1: number, y1: number, col: string, w = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    rect(x, y, w, w, col);
  }
}

/** A thick line through a list of points. */
function path(pts: number[][], col: string, w = 1): void {
  for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col, w);
}

function disc(cx: number, cy: number, r: number, col: string): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    const hw = Math.sqrt(Math.max(0, r * r - (y + 0.5 - cy) * (y + 0.5 - cy)));
    if (hw > 0.3) rect(Math.round(cx - hw), y, Math.round(cx + hw) - Math.round(cx - hw), 1, col);
  }
}

/** A moon: a lit disc with a shadow disc laid over it in the sky color. */
function moon(cx: number, cy: number, r: number, lit: string, sky: string, phase: number, rim?: string): void {
  disc(cx, cy, r, lit);
  if (rim) dither(Math.round(cx - r), Math.round(cy - r), Math.round(r), Math.round(r * 2), rim, 0.25);
  if (phase) disc(cx + phase, cy - Math.abs(phase) * 0.3, r, sky);
}

/** A spiral line on a square grid, one pixel thick. */
const spirals = new Map<string, Uint8Array>();
function spiralMask(size: number, turn: number): Uint8Array {
  const key = size + ':' + turn;
  let m = spirals.get(key);
  if (m) return m;
  m = new Uint8Array(size * size);
  const h = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - h, dy = y + 0.5 - h, r = Math.hypot(dx, dy);
    const th = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
    const f = (((r / turn - th) % 1) + 1) % 1;
    if (r < h && f < 1.05 / turn + 0.08) m[y * size + x] = 1;
  }
  spirals.set(key, m);
  return m;
}

/** A coiled shell seen side on: a disc, its spiral, a pale lip on the upper left. */
function whorl(cx: number, cy: number, r: number, body: string, ln: string, hi: string): void {
  const size = r * 2;
  disc(cx, cy, r, body);
  const m = spiralMask(size, Math.max(2, r / 2.4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y * size + x]) px(cx - r + x, cy - r + y, ln);
  for (let a = 3.4; a < 4.6; a += 0.12) px(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)), hi);
}

/** A conch on its side: a coiled end, a body that tapers to a point, and dark sutures. */
function conch(x: number, y: number, len: number, h: number, body: string, ln: string, hi: string, flip = false): void {
  const r = Math.floor(h / 2);
  for (let i = 0; i < len; i++) {
    const X = flip ? x - i : x + i;
    const half = Math.max(0, r * (1 - i / len) * (1 + 0.15 * Math.sin(i / 2)));
    const top = Math.round(y - half), bot = Math.round(y + half * 0.8);
    if (bot <= top) continue;
    rect(X, top, 1, bot - top, body);
    px(X, top, i % 4 === 0 ? hi : ln);
    if (i % 5 === 2) rect(X, top + 1, 1, Math.max(1, bot - top - 2), ln);
  }
  whorl(x, y, r, body, ln, hi);
}

/** A sky full of stars. Placement is fixed by the seed. They show faint in the unlit hue. */
function stars(y0: number, y1: number, n: number, seed: number, cols: string[]): void {
  paintAs(STAR, () => {
    for (let k = 0; k < n; k++) {
      const x = Math.floor(hash(seed * 1013 + k) * W), y = y0 + Math.floor(hash(seed * 2027 + k) * (y1 - y0));
      const col = cols[k % cols.length];
      if (k % 13 === 0) { px(x, y, col); px(x - 1, y, cols[0]); px(x + 1, y, cols[0]); px(x, y - 1, cols[0]); px(x, y + 1, cols[0]); }
      else px(x, y, col);
    }
  });
}

/** A few bright stars that blink off for a moment, on whole frames. */
function twinkle(y0: number, y1: number, n: number, seed: number, col: string): void {
  glow(() => {
    for (let k = 0; k < n; k++) {
      const x = Math.floor(hash(seed * 31 + k * 7) * W), y = y0 + Math.floor(hash(seed * 57 + k * 3) * (y1 - y0));
      if ((S.t + k * 53) % 180 < 150) px(x, y, col);
    }
  });
}

/** A spiral galaxy: dithered arms around a bright core. Its core lights the sky around it a little. */
function galaxy(cx: number, cy: number, r: number, arm: string, core: string, tilt = 0.5): void {
  paintAs(STAR, () => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y / tilt);
      if (d > r) continue;
      const a = Math.atan2(y / tilt, x);
      const v = Math.cos(2 * (a - Math.log(d + 1) * 2.2));
      const lv = (v * 0.5 + 0.5) * (1 - d / r);
      if (BAY[((cy + y) & 3) * 4 + ((cx + x) & 3)] < lv * 22) px(cx + x, cy + y, d < r * 0.25 ? core : arm);
    }
    px(cx, cy, core); px(cx - 1, cy, core); px(cx + 1, cy, core);
  });
  lamp(cx, cy, r * 0.8, arm, 1.2, 1 / tilt);
}

/** A band of dithered color across the sky, like the light of many far stars. */
function band(y: number, amp: number, thick: number, col: string, seed: number): void {
  paintAs(SKY, () => {
    for (let x = 0; x < W; x++) {
      const yy = Math.round(y + amp * Math.sin((x + seed * 9) / 14));
      dither(x, yy - thick, 1, thick * 2, col, 0.25);
      dither(x, yy - 1, 1, 2, col, 0.5);
    }
  });
}

/** Layered water: dithered blues between foam lines. Its top row is the line falling stars show in. */
function water(y0: number, y1: number, deep: string, mid: string, light: string, foam: string): void {
  if (sea < 0 || y0 < sea) sea = y0;
  paintAs(WATER, () => {
    grad(y0, y1, [light, mid, deep]);
    for (let y = y0 + 1; y < y1; y += 3) {
      for (let x = 0; x < W; x++) if (((x + y * 5) >> 2) % 3 === 0) px(x, y + (((x >> 3) + y) & 1), mid);
    }
    rect(0, y0, W, 1, foam);
  });
}

/** Glints sliding a whole pixel at a time across water, shown only where light reaches it, more where it is strong. */
function glints(y0: number, y1: number, col: string, n: number): void {
  glow(() => {
    for (let k = 0; k < n * 3; k++) {
      const y = y0 + Math.floor(hash(k * 3 + 1) * (y1 - y0));
      const x = Math.floor((hash(k * 7 + 2) * W + S.t / (6 + k % 4)) % (W + 6)) - 3;
      const w = 1 + (k % 3);
      const lv = lightAt(x + 1, y);
      if (lv >= 3 + (k % 4) * 2 && ((S.t >> 4) + k) % 7 !== 0) rect(x, y, lv > 10 ? w + 1 : w, 1, col);
    }
  });
}

/** Straight streaks of rain. With `up`, the rain falls toward the sky. */
function rain(x0: number, x1: number, y0: number, y1: number, n: number, col: string, up: boolean): void {
  for (let k = 0; k < n; k++) {
    const x = x0 + Math.floor(hash(k * 13 + 5) * (x1 - x0));
    const span = y1 - y0 + 4;
    const off = Math.floor(hash(k * 7 + 1) * span);
    const y = up ? y1 - ((S.t * 2 + off) % span) : y0 + ((S.t * 2 + off) % span) - 2;
    rect(x, y, 1, 2, col);
  }
}

function snowfall(n: number, col: string, speed = 3): void {
  for (let k = 0; k < n; k++) {
    const x = Math.floor(hash(k * 13 + 1) * W + Math.sin((S.t + k * 30) / 40) * 2);
    const y = Math.floor((hash(k * 7 + 2) * H + S.t / (speed + (k % 3))) % H);
    px(x, y, col);
  }
}

/** Wavy curtains of light. They drift sideways a whole pixel at a time, and each curtain lights the ground under it in its own color. */
function aurora(y: number, cols: string[], ground = -1): void {
  glow(() => {
    for (let k = 0; k < cols.length; k++) {
      for (let x = 0; x < W; x++) {
        const yy = Math.round(y + k * 3 + 2 * Math.sin((x + Math.floor(S.t / 8) + k * 20) / 9));
        const h = 3 + Math.round(2 * Math.sin((x + k * 13) / 5));
        dither(x, yy - h, 1, h, cols[k], 0.25);
        if ((x + k) % 2 === 0) px(x, yy, cols[k]);
      }
    }
  });
  if (ground < 0) return;
  for (let k = 0; k < cols.length; k++) {
    const x = 16 + k * 34 + 10 * Math.sin((S.t / 8 + k * 40) / 30);
    lamp(Math.round(x), ground + 6 + k * 5, 17, cols[k], 0.9, 2.6);
  }
}

/** Whole-pixel heat shimmer: some rows of the scene shift one pixel sideways and back. */
function shimmer(y0: number, y1: number): void {
  for (let y = y0; y < y1; y += 3) {
    const dx = ((S.t >> 3) + y) % 4 < 2 ? 1 : -1, row = y * W;
    if (mode === 1) WORLD.copyWithin(dx > 0 ? row + 1 : row, dx > 0 ? row : row + 1, row + W - (dx > 0 ? 1 : 0));
    else T.drawImage(T.canvas as HTMLCanvasElement, 0, y, W, 1, dx, y, W, 1);
  }
}

// ---------------------------------------------------------------- the Stays, black plus one color

function stayRib(x: number, accent: string): void {
  path([[x - 10, 21], [x - 9, 14], [x - 7, 9], [x - 4, 5], [x, 3], [x + 4, 3], [x + 7, 5], [x + 9, 8]], INK, 2);
  path([[x - 4, 21], [x - 3, 15], [x - 1, 11], [x + 2, 9], [x + 5, 9], [x + 7, 11]], INK, 1);
  path([[x + 2, 21], [x + 3, 17], [x + 5, 15], [x + 8, 15]], INK, 1);
  for (const [ax, ay] of [[-9, 16], [-7, 11], [-3, 6], [2, 3]]) px(x + ax, ay, accent);
}

function stayMast(x: number, accent: string): void {
  rect(x, 1, 2, 20, INK);
  rect(x - 7, 4, 16, 1, INK);
  rect(x - 5, 10, 12, 1, INK);
  pic(['aaaaaa', '.aaaaa', '.aaaa.', '..aaa.'], x + 2, 5, { a: accent });
  pic(['.aaa', 'aaaa', '.aa.'], x - 4, 11, { a: accent });
  rect(x - 1, 0, 4, 2, INK);
}

/** The Spire is a church driven in point first, so the point is underground and the nave stands in the air. */
function staySpire(x: number, accent: string): void {
  for (let j = 0; j < 12; j++) { const w = Math.round(j * 0.55); rect(x - w, 21 - j, w * 2 + 1, 1, INK); }
  rect(x - 7, 3, 15, 7, INK);
  for (let i = 0; i < 4; i++) rect(x - 8 + i, 3 - i, 17 - i * 2, 1, INK);
  px(x - 4, 5, accent); px(x - 4, 6, accent); px(x, 5, accent); px(x, 6, accent); px(x + 4, 5, accent); px(x + 4, 6, accent);
  rect(x - 7, 10, 15, 1, accent);
}

function stayBole(x: number, accent: string): void {
  rect(x - 2, 9, 5, 13, INK);
  for (let k = 0; k < 9; k++) {
    let rx = x, ry = 9;
    const dir = (k - 4) * 0.55;
    for (let s = 0; s < 14; s++) {
      rx += dir + Math.sin(s + k) * 0.3; ry -= 0.55;
      px(Math.round(rx), Math.round(ry), INK);
      if (s < 4) px(Math.round(rx) + 1, Math.round(ry), INK);
    }
  }
  rect(x - 1, 14, 3, 1, accent);
  rect(x - 2, 18, 1, 2, accent);
}

function stayPylon(x: number, accent: string): void {
  for (let j = 0; j < 20; j++) {
    const w = Math.round(1 + j * 0.4);
    rect(x - w - 1, 1 + j, 2, 1, INK); rect(x + w, 1 + j, 2, 1, INK);
    if (j % 5 === 0) rect(x - w, 1 + j, w * 2 + 1, 1, INK);
    // Cross bracing between the rungs.
    const f = (j % 5) / 5;
    px(Math.round(x - w + f * w * 2), 1 + j, INK); px(Math.round(x + w - f * w * 2), 1 + j, INK);
  }
  rect(x - 7, 4, 15, 2, INK);
  if ((S.t >> 5) % 2) { px(x, 0, accent); px(x - 6, 5, accent); px(x + 6, 5, accent); }
}

function stayTusk(x: number, accent: string): void {
  for (let j = 0; j < 19; j++) {
    const off = Math.round(Math.pow(j / 18, 2) * 11);
    const w = Math.max(1, 4 - Math.floor(j / 5));
    rect(x + off, 21 - j, w, 1, INK);
    if (j % 6 === 3) px(x + off + 1, 21 - j, accent);
  }
}

function stayHilt(x: number, accent: string): void {
  rect(x - 1, 9, 3, 12, INK);
  rect(x - 8, 14, 17, 2, INK);
  rect(x - 2, 4, 5, 5, INK);
  px(x, 10, accent); px(x, 12, accent);
  px(x - 7, 14, accent); px(x + 7, 14, accent);
  px(x, 5, accent);
}

function stayFall(x: number, accent: string): void {
  pic([
    '.....1.....',
    '....111....',
    '...11211...',
    '11111211111',
    '.111222111.',
    '..1112111..',
    '.111.1.111.',
    '111.....111',
  ], x - 5, 14, { '1': INK, '2': accent });
}

function stayKey(x: number, accent: string): void {
  rect(x, 6, 2, 15, INK);
  rect(x - 6, 9, 14, 1, INK);
  rect(x - 4, 13, 10, 1, INK);
  disc(x + 1, 4, 3, INK);
  px(x + 1, 4, accent);
  rect(x - 6, 10, 1, 2, accent);
  rect(x + 7, 10, 1, 2, accent);
}

// ---------------------------------------------------------------- shared pieces

/** A small conch-roofed house for a horizon. */
function shellHouse(x: number, y: number, roof: string, wall: string, ln: string, door: string, flip = false): void {
  rect(x, y - 4, 10, 4, wall);
  rect(x, y - 1, 10, 1, ln);
  if (door) { rect(x + 4, y - 3, 2, 3, door); }
  conch(flip ? x + 10 : x, y - 6, 11, 6, roof, ln, wall, flip);
}

/** Tall stems in the lower left, so a scene has a foreground. */
function stems(x0: number, x1: number, y: number, col: string, tip: string, seed: number): void {
  for (let x = x0; x < x1; x++) {
    if (hash(x * 7 + seed) < 0.45) continue;
    const h = 4 + Math.floor(hash(x * 13 + seed) * 9);
    rect(x, y - h, 1, h, col);
    px(x, y - h - 1, tip);
  }
}

/** The colors falling stars draw in, from the head back. */
function starColors(head: string, trail: string, tail: string): void {
  starCols = [head, trail, tail];
}

/** A lantern: a lit glass in a dark frame, with its pool of light in the glass's color. */
function lantern(x: number, y: number, glass: string, r = 7, frame = '#1e1418'): void {
  pic(['.f.', 'fgf', 'fgf', '.f.'], x - 1, y - 1, { f: frame, g: glass });
  lamp(x, y + 1, r * 0.8, glass, 1.6);
}

/** Small lights that drift and blink out now and then, each lighting a few pixels: fireflies, wisps, sparks. `rise` lifts them as they age. */
function wisps(n: number, x0: number, x1: number, y0: number, y1: number, col: string, seed: number, r = 4, rise = 0): void {
  for (let k = 0; k < n; k++) {
    const life = 200 + Math.floor(hash(seed * 31 + k) * 160);
    const ph = S.t + Math.floor(hash(seed * 17 + k) * life);
    const age = ph % life, gen = Math.floor(ph / life);
    if (age < 12 || age > life - 12 || (age >> 3) % 9 === 0) continue;
    const x = Math.round(x0 + hash(seed * 7 + k * 13 + gen * 101) * (x1 - x0) + 3 * Math.sin((age + k * 30) / 23));
    const y = Math.round(y0 + hash(seed * 11 + k * 7 + gen * 37) * (y1 - y0) + 2 * Math.sin((age + k * 17) / 31) - age * rise);
    glow(() => px(x, y, col));
    lamp(x, y, r, col, 1.6);
  }
}

// ---------------------------------------------------------------- places

interface Scene { base: () => void; anim?: () => void; over?: () => void }
type Painter = () => void;

const P: Record<string, Scene> = {
  fellside: {
    base() {
      sky(0, 22, ['#5a6ab8', '#c886a8', '#f4b07a', '#fae0a0']);
      moon(84, 8, 5, '#fff4d8', '#c886a8', 0);
      stars(0, 8, 10, 1, ['#fff4d8']);
      ridge(20, 4, 1, 14, '#9aa85a', 23);
      // The foe stands on open ground. Turnstone's one house keeps to the right edge, under the moon.
      shellHouse(86, 20, '#e8604a', '#f2e4d4', '#8a4a3a', '#2ec8b0', true);
      ground(22, ['#e2c27a', '#d0aa62', '#c29a50'], '#d8b670', '#a8823e', ['spiral', '#f8ecd2', '#e8604a']);
      ripples(23, '#c29a50', '#f4e0a4', 1);
      stems(0, 16, 60, '#6aae3a', '#f4e0a4', 1);
      conch(30, 55, 14, 8, '#e8604a', '#8a4a3a', '#fffaf0');
      lamp(84, 8, 8, '#fff4d8', 1.1);
      starColors('#fffaf0', '#f4b07a', '#fae0a0');
    },
  },
  tanning: {
    base() {
      sky(0, 21, ['#3a9ad8', '#8ad0e0', '#d8f0e0']);
      for (let k = 0; k < 4; k++) { const x = 8 + k * 26; dither(x, 4 + (k & 1) * 3, 18, 2, '#ffffff', 0.5); rect(x + 4, 5 + (k & 1) * 3, 10, 1, '#ffffff'); }
      ridge(20, 3, 2, 10, '#a8b860', 22);
      // Giant scallops stand on edge along the road.
      for (const x of [58, 74, 88]) {
        for (let r = 6; r >= 0; r--) disc(x, 21, r, r % 2 ? '#e8604a' : '#f6c8a0');
        for (let a = -1.4; a <= 1.4; a += 0.35) line(x, 21, Math.round(x + Math.sin(a) * 6), Math.round(21 - Math.cos(a) * 6), '#c04a3a');
        rect(x - 7, 21, 15, 1, '#c29a50');
      }
      ground(21, ['#e2c27a', '#d4b06a', '#c29a50'], '#d8b670', '#a8823e', ['scallop', '#f6c8a0', '#e8604a']);
      shells(21, 8, 2, '#f6c8a0', '#c04a3a', '#ffffff');
      water(48, 60, '#1e5ab8', '#3aa8d0', '#8ad0e0', '#ffffff');
      pads('#a8823e');
      whorl(8, 44, 7, '#f6c8a0', '#c04a3a', '#ffffff');
    },
    anim() {
      // The surf glows sea-glass green where each wave breaks, and the glow runs along the shore.
      for (let k = 0; k < 4; k++) {
        const x = Math.round(((S.t / (5 + k) + k * 29) % 112) - 8), on = ((S.t >> 5) + k) % 5 !== 0;
        if (!on) continue;
        glow(() => { for (let i = 0; i < 6; i++) if ((i + (S.t >> 3)) % 3) px(x + i, 48 + (i & 1), '#8afce4'); });
        lamp(x + 3, 50, 8, '#3ee8c8', 1.7, 2);
      }
      glints(49, 59, '#8afce4', 5);
    },
  },
  rib: {
    base() {
      sky(0, 22, ['#6a4a9a', '#b47ab8', '#eab0c8', '#f8dcd8']);
      stars(0, 10, 12, 3, ['#fff4ea', '#ffb0c0']);
      // The ribcage arches over the town, porcelain white against the sky.
      for (let k = 0; k < 4; k++) {
        const x0 = -6 + k * 9, top = 2 + k * 3;
        path([[x0, 60], [x0 + 3, 38], [x0 + 10, 18], [x0 + 22, top + 4], [x0 + 36, top], [x0 + 48, top + 2]], '#fff4ea', 2);
        path([[x0 + 1, 60], [x0 + 4, 39], [x0 + 11, 20], [x0 + 23, top + 6]], '#c4a0b8', 1);
      }
      stayRib(86, '#ff7a92');
      ground(22, ['#c4a0b8', '#b08ca6', '#a07c98'], '#b896ae', '#8a2c50', ['spiral', '#fff4ea', '#ff7a92']);
      shells(22, 12, 3, '#fff4ea', '#a07c98', '#ffffff');
      // Pink lanterns hang from the ribs on threads.
      for (const [x, y0, y1] of [[58, 12, 15], [67, 14, 19], [76, 5, 9]] as const) { rect(x, y0, 1, y1 - y0, '#5a3a4a'); lantern(x, y1 + 1, '#ff7a92', 9, '#4a1a2a'); }
      rect(8, 30, 1, 3, '#5a3a4a');
      lantern(8, 34, '#ff7a92', 10, '#4a1a2a');
    },
    anim() { twinkle(0, 8, 5, 3, '#ffffff'); },
  },
  ribgym: {
    base() {
      grad(0, 60, ['#2a0e24', '#5a1e44', '#8a2c50']);
      for (let x = 2; x < W; x += 12) {
        rect(x, 0, 4, 40, '#fff4ea'); rect(x + 3, 0, 1, 40, '#c4a0b8');
        for (let y = 4; y < 40; y += 9) rect(x - 1, y, 6, 2, '#fff4ea');
      }
      whorl(76, 14, 7, '#f6d2d8', '#8a2c50', '#ffffff');
      ground(34, ['#f6d2d8', '#e8b4c4', '#c4a0b8'], '#ffffff', '#8a2c50', ['spiral', '#ffffff', '#ff7a92']);
      for (let x = 0; x < W; x += 16) dither(x, 36, 8, 24, '#ffffff', 0.25);
      // The nacre whorl on the wall glows, and pink lamps hang on the columns.
      lamp(76, 14, 16, '#ffd0dc', 1.5);
      for (const x of [52, 64, 88]) lantern(x, 26, '#ff7a92', 9, '#4a1a2a');
    },
  },
  drysea: {
    base() {
      sky(0, 22, ['#120c38', '#24164a', '#4a2a6a', '#a05a6a']);
      stars(0, 16, 40, 5, ['#fff8ec', '#9ad0f0', '#ffd0a0']);
      galaxy(62, 7, 9, '#4ab4cc', '#fff8ec');
      // The sea's slough stands on the horizon as a wall of still gray water.
      rect(0, 16, W, 6, '#6a8494');
      rect(0, 16, W, 1, '#c4ecf4');
      dither(0, 17, W, 2, '#c4ecf4', 0.25);
      pic(['.xx.x', 'xxxxx', '.xx.x'], 30, 18, { x: '#ff6448' });
      pic(['....1111111', '..111222221', '.1122222221', '11111111111', '33333333333'], 80, 17, { '1': '#4a2a1a', '2': '#7a4a2a', '3': '#ee3e28' });
      ground(22, ['#a8885a', '#8a6a44', '#6a5034'], '#b09060', '#4a3420', ['scallop', '#e8c47c', '#ff6448']);
      ripples(22, '#6a5034', '#c8a870', 5); shells(22, 10, 5, '#e8c47c', '#7a4a2a', '#fff8ec');
      for (let k = 0; k < 10; k++) { const x = Math.floor(hash(k + 40) * 90), y = 28 + Math.floor(hash(k + 70) * 28); rect(x, y, 3, 1, '#c8a870'); px(x + 1, y - 1, '#e8c890'); }
      whorl(10, 52, 6, '#e8c47c', '#7a4a2a', '#fff8ec');
      lantern(83, 15, '#ffc860', 8);
      starColors('#fff8ec', '#ffd0a0', '#e8c47c');
    },
    anim() {
      twinkle(0, 15, 8, 5, '#ffffff');
      // Fish held in the wall of the sea glow coral, each brightening in turn.
      for (const [x, y, k] of [[56, 18, 0], [66, 19, 1], [74, 17, 2], [30, 18, 3]] as const) {
        const on = ((S.t >> 5) + k) % 4 !== 0;
        if (on) glow(() => pic(['.xx.x', 'xxxxx', '.xx.x'], x, y, { x: '#ff8a68' }));
        lamp(x + 2, y + 1, on ? 6 : 4, '#ff6448', 1.6);
      }
    },
  },
  mast: {
    base() {
      sky(0, 21, ['#3a2a7a', '#b04a7a', '#ff8a5a', '#ffd08a']);
      disc(48, 20, 7, '#fff0b0');
      sea = 16;
      paintAs(WATER, () => { rect(0, 16, W, 5, '#6a8494'); rect(0, 16, W, 1, '#c4ecf4'); dither(0, 18, W, 3, '#ffd08a', 0.25); });
      stayMast(84, '#4ab4cc');
      ridge(21, 3, 4, 8, '#d0a868', 23);
      ground(22, ['#e8c47c', '#d4ac66', '#c4944e'], '#d8b672', '#7a4a2a', ['scallop', '#4ab4cc', '#fff8ec']);
      ripples(22, '#c4944e', '#f8e2aa', 6); shells(22, 8, 6, '#ff6448', '#7a4a2a', '#fff8ec');
      pic(['...a...', '..aia..', '.aaaaa.', 'aaWaWaa', '.aaaaa.'], 4, 50, { a: '#4ab4cc', i: '#fff8ec', W: '#24345a' });
      // The low moon on the water, and teal lamps at the Mast's yard ends and masthead.
      lamp(48, 18, 11, '#fff0b0', 1.1);
      for (const [x, y] of [[77, 5], [92, 5], [79, 11], [90, 11]] as const) { px(x, y, '#9cf0ff'); lamp(x, y, 7, '#4ab4cc', 1.7); }
      lamp(7, 52, 7, '#4ab4cc', 1.4);
    },
    anim() {
      glints(17, 21, '#ffffff', 3);
      const on = (S.t >> 5) % 2;
      glow(() => { px(85, 0, on ? '#ffffff' : '#9cf0ff'); px(84, 0, '#9cf0ff'); });
      lamp(85, 1, on ? 8 : 6, '#4ab4cc', 1.6);
    },
  },
  marsh: {
    base() {
      sky(0, 18, ['#0a1430', '#143e66', '#2a7a9a']);
      stars(0, 12, 34, 7, ['#ecf6f2', '#9af0d0']);
      moon(84, 6, 4, '#ecf6f2', '#0a1430', 2);
      moon(70, 4, 2, '#f0b030', '#0a1430', 0);
      water(18, 30, '#0a2440', '#143e66', '#2a7a9a', '#9af0d0');
      // The moons in the water show a different phase from the ones in the sky.
      moon(84, 24, 3, '#9af0d0', '#143e66', -2);
      for (let x = 0; x < W; x += 2) { const h = 3 + Math.floor(hash(x) * 7); rect(x, 30 - h, 1, h, '#1a4a36'); if (hash(x + 9) < 0.3) px(x, 29 - h, '#f0b030'); }
      ground(30, ['#7cae94', '#6a9c84', '#5a8a74'], '#86b89e', '#2a5a48', ['ring', '#7cae94', '#1a4a36']);
      pools([[30, 34, 12], [52, 40, 10], [2, 32, 8]], '#2a7a9a', '#143e66', '#1a4a36');
      stems(0, 14, 60, '#1a4a36', '#f0b030', 7);
      lamp(84, 6, 8, '#ecf6f2', 1.1);
      lamp(70, 4, 4, '#f0b030', 1.2);
      lamp(84, 24, 9, '#9af0d0', 1.6, 1.4);
      starColors('#ffffff', '#9af0d0', '#7cae94');
    },
    anim() {
      glints(19, 29, '#9af0d0', 6);
      twinkle(0, 12, 8, 7, '#ffffff');
      // Fireflies over the marsh, gold like the reed tips.
      wisps(9, 0, W, 20, 52, '#ffd060', 3, 4);
    },
  },
  spire: {
    base() {
      sky(0, 21, ['#141038', '#343c66', '#6a78a8', '#a8b8d0']);
      stars(0, 10, 18, 9, ['#ecf6f2']);
      // Turret shells on the far ridge.
      for (const [x, h] of [[56, 9], [60, 13], [64, 7], [92, 10]] as const) {
        for (let j = 0; j < h; j++) { const w = Math.round(j * 0.35); rect(x - w, 21 - h + j, w * 2 + 1, 1, '#4a5a80'); if ((j + x) % 3 === 0) rect(x - w, 21 - h + j, w * 2 + 1, 1, '#20263e'); }
      }
      staySpire(80, '#34d6a4');
      ground(21, ['#7cae94', '#6a9c84', '#5a8a74'], '#86b89e', '#20263e', ['spiral', '#cdd4e2', '#34d6a4']);
      // Bells half buried in the near ground.
      for (const [x, y] of [[6, 52], [30, 57]] as const) pic(['..xxxx..', '.xxixxx.', 'xxixxxxx', 'xxxxxxxx', 'WWWWWWWW'], x, y, { x: '#f0b030', i: '#fff4c4', W: '#5a8a74' });
      // The Spire's windows burn sea-glass green, and its light falls on the ground below.
      lamp(80, 7, 11, '#34d6a4', 1.6);
      lamp(80, 24, 10, '#34d6a4', 1, 2.4);
      for (const [x, y] of [[56, 13], [60, 9], [92, 12]] as const) { px(x, y, '#9cffd8'); lamp(x, y, 4, '#34d6a4', 1.4); }
    },
    anim() { twinkle(0, 10, 6, 9, '#ffffff'); },
  },
  spiregym: {
    base() {
      grad(0, 60, ['#08060e', '#141038', '#20263e']);
      // A rose window of spiral glass.
      disc(76, 14, 10, '#20263e');
      const m = spiralMask(20, 3.2);
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        const d = Math.hypot(x - 9.5, y - 9.5);
        if (d > 9.5) continue;
        px(66 + x, 4 + y, m[y * 20 + x] ? '#08060e' : ['#34d6a4', '#f0b030', '#7a58e4', '#3a9ad8'][Math.floor(Math.atan2(y - 9.5, x - 9.5) * 2 + 7) % 4]);
      }
      for (const x of [6, 22, 38]) { rect(x, 0, 2, 10 + (x % 5), '#4a5a80'); pic(['..xxxx..', '.xxixxx.', 'xxxxxxxx', 'WWWWWWWW', '...xx...'], x - 3, 10 + (x % 5), { x: '#f0b030', i: '#fff4c4', W: '#5a4a20' }); }
      ground(34, ['#4a5a80', '#343c66', '#20263e'], '#5a6a90', '#08060e');
      for (const x of [4, 40, 80]) { rect(x, 52, 12, 6, '#08060e'); rect(x + 1, 53, 5, 2, '#34d6a4'); rect(x + 6, 53, 5, 2, '#f0b030'); rect(x + 1, 56, 10, 1, '#7a58e4'); }
      // The rose window throws its colors down the crypt in separate pools.
      lamp(76, 14, 14, '#7a58e4', 1.5);
      lamp(64, 40, 10, '#34d6a4', 1.4, 2);
      lamp(78, 44, 11, '#f0b030', 1.4, 2);
      lamp(92, 39, 9, '#3a9ad8', 1.4, 2);
      lamp(30, 46, 10, '#7a58e4', 1.2, 2);
      for (const x of [4, 40, 80]) lamp(x + 6, 54, 6, '#34d6a4', 1.4, 1.5);
    },
  },
  understory: {
    base() {
      grad(0, 60, ['#0c2a18', '#1e4a24', '#2e6a2a']);
      // Trees here grow roots-up: the roots fan out at the top of the picture.
      for (const x of [6, 24, 52, 66, 90]) {
        rect(x, 6, 4, 30, '#123a14'); rect(x + 1, 6, 1, 30, '#2a5a20');
        for (let k = -3; k <= 3; k++) line(x + 2, 7, x + 2 + k * 4, 0, '#123a14');
        disc(x + 2, 36, 5, '#2a7a28'); dither(x - 3, 32, 10, 4, '#88cc58', 0.25);
      }
      ground(36, ['#5ca440', '#4e9038', '#3e7c2e'], '#68b04a', '#123a14', ['ring', '#88cc58', '#2a7a28']);
      for (let k = 0; k < 14; k++) { const x = Math.floor(hash(k + 60) * 92), y = 38 + Math.floor(hash(k + 61) * 20); rect(x, y, 2, 2, '#88cc58'); px(x + 1, y + 1, '#3e7c2e'); }
      // Red caps glow at the foot of the trees.
      for (const [x, y] of [[4, 40], [56, 39], [70, 41], [88, 40]] as const) { pic(['.ff.', 'ffff', '.s..'], x, y, { f: '#ff6a50', s: '#ecfac4' }); lamp(x + 2, y + 1, 5, '#ff6a50', 1.5); }
    },
    anim() {
      // Shafts of light through the roots, stepping sideways a pixel now and then, pooling where they reach the ground.
      const s = (S.t >> 6) % 3;
      glow(() => { dither(40 + s, 0, 6, 36, '#ecfac4', 0.125); dither(78 - s, 0, 4, 36, '#ecfac4', 0.125); });
      lamp(43 + s, 38, 11, '#ecfac4', 1.6, 2.2);
      lamp(80 - s, 38, 9, '#ecfac4', 1.6, 2.2);
      rain(0, W, 0, 36, 10, '#38a0c0', true);
    },
  },
  bole: {
    base() {
      sky(0, 22, ['#1e3a48', '#3a6a6a', '#78a890', '#b0d0a8']);
      stayBole(80, '#88cc58');
      ground(22, ['#5ca440', '#4e9038', '#3e7c2e'], '#68b04a', '#123a14', ['ring', '#88cc58', '#2a7a28']);
      for (let k = 0; k < 14; k++) { const x = Math.floor(hash(k + 70) * 92), y = 25 + Math.floor(hash(k + 71) * 32); rect(x, y, 2, 2, '#88cc58'); px(x + 1, y + 1, '#3e7c2e'); }
      conch(10, 52, 16, 10, '#3a8a3a', '#123a14', '#88cc58');
      // Sap lamps hang under the Bole's roots, and the moss shell glows.
      for (const [x, y] of [[64, 14], [93, 12], [72, 6]] as const) { rect(x, y - 3, 1, 2, '#123a14'); lantern(x, y, '#e8b828', 9, '#123a14'); }
      lamp(14, 50, 9, '#88cc58', 1.4);
    },
    anim() { rain(54, W, 0, 22, 18, '#ecfac4', true); rain(0, 54, 0, 22, 6, '#38a0c0', true); },
  },
  machines: {
    base() {
      sky(0, 21, ['#060c24', '#101a3a', '#1c3a7a', '#2e78b0']);
      stars(0, 14, 36, 11, ['#f2f6fa', '#3ce8c4']);
      // Old machines lie in the field like shells left by the tide.
      for (const [x, r] of [[58, 6], [76, 4], [90, 7]] as const) { whorl(x, 21, r, '#566880', '#364254', '#9cacbe'); }
      ground(21, ['#4c586a', '#424c5c', '#3a4454'], '#566276', '#20283a', ['spiral', '#6c788c', '#ffb020']);
      pic(['11111111111.', '.12222222221', '..111111111.'], 2, 28, { '1': '#364254', '2': '#9cacbe' });
      whorl(8, 52, 7, '#566880', '#20283a', '#9cacbe');
      starColors('#f2f6fa', '#3ce8c4', '#6c788c');
    },
    anim() {
      // Each old machine still blinks amber, and its blink lights the field around it.
      for (const [x, r] of [[58, 6], [76, 4], [90, 7], [8, 7]] as const) {
        const y = x === 8 ? 44 : 21 - r - 1;
        if (!(((S.t >> 5) + x) % 3)) continue;
        glow(() => px(x, y, '#ffb020'));
        lamp(x, y + 1, 9, '#ffb020', 1.6);
      }
      twinkle(0, 14, 8, 11, '#ffffff');
    },
  },
  hum: {
    base() {
      sky(0, 21, ['#1c3a7a', '#566880', '#9cacbe', '#c8d4e0']);
      stayPylon(84, '#ffb020');
      ground(21, ['#4c586a', '#424c5c', '#3a4454'], '#566276', '#20283a', ['ring', '#9cacbe', '#ffb020']);
      for (let y = 26; y < H; y += 6) rect(0, y, W, 1, '#364254');
      // Phosphor glows green in the grating.
      for (const [x, y] of [[8, 26], [30, 32], [60, 26], [92, 32], [24, 56], [70, 56]] as const) { rect(x - 1, y, 3, 1, '#3ce8c4'); lamp(x, y, 8, '#3ce8c4', 1.4, 2.2); }
    },
    anim() {
      // The note the town hums: a band of lighter sky moves down a pixel at a time.
      const y = (S.t >> 2) % 24;
      glow(() => dither(0, y, W, 1, '#f2f6fa', 0.25));
      const on = (S.t >> 4) % 2;
      if (on) glow(() => px(84, 0, '#ffb020'));
      lamp(84, 2, on ? 12 : 8, '#ffb020', 1.6);
    },
  },
  pylon: {
    base() {
      grad(0, 60, ['#0c1020', '#1c2434', '#262e40']);
      for (let y = 0; y < 34; y += 4) rect(0, y, W, 1, '#364254');
      for (let x = 6; x < W; x += 16) { rect(x, 4, 8, 24, '#4a5662'); rect(x + 1, 5, 6, 1, '#9cacbe'); px(x + 2, 8, '#20283a'); px(x + 5, 8, '#20283a'); rect(x + 2, 11, 4, 1, '#20283a'); }
      ground(34, ['#3a4454', '#2e3646', '#262e40'], '#46505a', '#0c1020', ['spiral', '#3a4454', '#3ce8c4']);
    },
    anim() {
      // Amber current climbs each cabinet and lights the floor in front of it.
      for (let x = 6; x < W; x += 16) {
        const y = 14 + ((S.t >> 4) + x) % 12;
        glow(() => rect(x + 2, y, 4, 1, '#ffb020'));
        lamp(x + 4, y, 7, '#ffb020', 1.5);
        lamp(x + 4, 36, 7, '#ffb020', 1.2, 2);
        if (((S.t >> 3) + x) % 9 === 0) { glow(() => px(x + 3, 6, '#3ce8c4')); lamp(x + 3, 6, 5, '#3ce8c4', 1.5); }
      }
    },
  },
  tundra: {
    base() {
      sky(0, 20, ['#0a1440', '#1a2458', '#3a4a8a']);
      stars(0, 14, 40, 13, ['#ffffff', '#a6bede']);
      ridge(20, 4, 6, 12, '#c2d0e4', 22);
      ground(21, ['#e8f0fa', '#d4e0f0', '#c2d0e4'], '#d8e4f4', '#8aa0c0', ['ring', '#ffffff', '#6ab4f4']);
      ripples(21, '#a6bede', '#ffffff', 13);
      for (const x of [4, 12, 30]) pic(['..i..', '.iTi.', '.TTT.', 'iTTTi', 'TTTTT', '..W..'], x, 48 + (x % 5), { i: '#ffffff', T: '#123e3a', W: '#8a6a40' });
    },
    anim() { aurora(6, ['#3ce8c4', '#7a58e4', '#6ab4f4'], 21); snowfall(26, '#ffffff'); twinkle(0, 12, 8, 13, '#ffffff'); },
  },
  tusk: {
    base() {
      sky(0, 21, ['#6ab4f4', '#a6cef4', '#e8f0fa', '#fff4e0']);
      moon(60, 8, 6, '#ffffff', '#a6cef4', 0, '#ecdcb4');
      // Scrimshaw lines across the ivory moon.
      line(55, 6, 64, 10, '#8a6a40'); line(56, 9, 62, 12, '#8a6a40');
      stayTusk(78, '#ecdcb4');
      ridge(20, 3, 8, 9, '#ffffff', 22);
      ground(21, ['#e8f0fa', '#d4e0f0', '#c2d0e4'], '#d8e4f4', '#8aa0c0', ['spiral', '#ecdcb4', '#8a6a40']);
      ripples(21, '#a6bede', '#ffffff', 14);
      whorl(9, 52, 7, '#ecdcb4', '#8a6a40', '#ffffff');
      // Moonlight on the snow, and a snow dome at the Tusk's foot with its door lit warm.
      lamp(60, 8, 10, '#fff4e0', 1.1);
      for (let j = 0; j < 4; j++) rect(88 - j * 2, 18 + j, 4 + j * 4, 1, j === 0 ? '#ffffff' : '#ecdcb4');
      rect(89, 20, 2, 2, '#ffb060');
      lamp(90, 22, 8, '#ffb060', 1.8, 1.6);
    },
    anim() { snowfall(14, '#ffffff', 4); },
  },
  hiltroad: {
    base() {
      sky(0, 21, ['#1e1030', '#5a2a3a', '#b04a2a', '#e8904a']);
      moon(60, 9, 5, '#f4d438', '#b04a2a', 2);
      stars(0, 8, 14, 15, ['#ffe0c0']);
      // Old blades still standing in the field.
      for (const [x, h] of [[54, 8], [66, 5], [86, 9], [92, 6]] as const) { rect(x, 21 - h, 1, h, '#a0a8b8'); rect(x - 1, 21 - h + 2, 3, 1, '#3c4256'); px(x, 21 - h, '#ffffff'); }
      ground(21, ['#8c7058', '#7c624c', '#6a5240'], '#9a7c62', '#3a2a20', ['ring', '#aa8a6a', '#d8622a']);
      for (const x of [2, 10, 34]) { rect(x, 40, 2, 20, '#a0a8b8'); rect(x - 2, 44, 6, 2, '#3c4256'); px(x, 40, '#ffffff'); px(x + 1, 41, '#dce0ec'); }
      // The sulfur moon lays a yellow light down the road.
      lamp(60, 9, 9, '#f4d438', 1.1);
      lamp(58, 27, 12, '#f4d438', 0.9, 2.4);
      starColors('#fff4c4', '#f4d438', '#d8622a');
    },
    anim() {
      // Blade edges catch the moon one at a time.
      const k = (S.t >> 4) % 7, tips = [[54, 13], [66, 16], [86, 12], [92, 15], [2, 40], [10, 40], [34, 40]];
      const [x, y] = tips[k];
      glow(() => { px(x, y, '#ffffff'); px(x - 1, y, '#fff4c4'); px(x + 1, y, '#fff4c4'); px(x, y - 1, '#fff4c4'); });
      lamp(x, y, 4, '#f4d438', 1.6);
    },
  },
  hilt: {
    base() {
      sky(0, 21, ['#3c4256', '#7a6a78', '#c88a5a', '#f4c070']);
      for (let k = 0; k < 3; k++) dither(0, 4 + k * 5, W, 2, '#f4d438', 0.125);
      stayHilt(84, '#d8622a');
      ground(21, ['#8c7058', '#7c624c', '#6a5240'], '#9a7c62', '#3a2a20', ['ring', '#aa8a6a', '#d8622a']);
      for (let k = 0; k < 9; k++) { const x = Math.floor(hash(k + 90) * 90), y = 26 + Math.floor(hash(k + 91) * 30); pic(['.a.', 'aya', '.a.'], x, y, { a: '#d8622a', y: '#f4d438' }); lamp(x + 1, y + 1, 5, '#f4d438', 1.5, 1.4); }
      // Forge light at the foot of the Hilt.
      rect(82, 20, 5, 1, '#ffb040');
      lamp(84, 21, 12, '#ff8a30', 1.7, 1.8);
    },
    anim() {
      // Sparks fly up from the forge.
      wisps(5, 78, 92, 10, 20, '#ffd060', 31, 3, 0.04);
    },
  },
  moonwater: {
    base() {
      sky(0, 18, ['#080c28', '#142a6a', '#2a5aa8']);
      stars(0, 16, 44, 17, ['#fffbe8', '#9ad0f0', '#ffe0a0']);
      moon(82, 6, 5, '#fff4d0', '#080c28', 0);
      // Beside the moon, its own pale slough, a ring with nothing inside.
      for (let a = 0; a < 6.3; a += 0.25) px(Math.round(66 + Math.cos(a) * 4), Math.round(8 + Math.sin(a) * 4), '#a8a4c8');
      water(18, 32, '#0a1a4a', '#142a6a', '#2a5aa8', '#9ad0f0');
      ground(32, ['#5a6a5a', '#4e5e4e', '#425242'], '#5e6e5e', '#2a3a32', ['ring', '#7a8a6a', '#fff4d0']);
      stems(0, 12, 60, '#2e4220', '#fff4d0', 17);
      // The moon and its road of light across the lake.
      lamp(82, 6, 9, '#fff4d0', 1.1);
      lamp(82, 25, 10, '#fff4d0', 1.6, 0.8);
      lamp(66, 8, 5, '#a8a4c8', 1.2);
      starColors('#ffffff', '#9ad0f0', '#fff4d0');
    },
    anim() {
      glow(() => { for (let y = 19; y < 31; y += 2) { const dx = ((S.t >> 4) + y) % 3 - 1; rect(80 + dx, y, 5 - (y & 2), 1, '#fff4d0'); } });
      glints(19, 31, '#fff4d0', 6);
      twinkle(0, 16, 10, 17, '#ffffff');
    },
  },
  peelhouse: {
    base() {
      grad(0, 60, ['#1a120e', '#2e2218', '#3e2e20']);
      // Shelves of outgrown shells, and a crack of starlight through the roof.
      for (let y = 6; y < 30; y += 8) { rect(0, y + 5, W, 1, '#5a4030'); for (let x = 4; x < W; x += 11) whorl(x + (y % 3), y + 2, 3, '#f2e4d4', '#8a6a50', '#ffffff'); }
      ground(32, ['#6a5a4a', '#5e4e40', '#4e4034'], '#6e5e4e', '#2a1e14', ['spiral', '#7a6a58', '#f2e4d4']);
      lamp(61, 18, 6, '#fff4c4', 1.6, 0.3);
      lamp(61, 36, 11, '#fff4c4', 1.8, 2);
      lantern(84, 9, '#ffc860', 10);
    },
    anim() {
      const s = (S.t >> 6) % 2;
      glow(() => { dither(60 + s, 0, 3, 60, '#fff4c4', 0.25); px(61, 2 + ((S.t >> 2) % 50), '#ffffff'); });
    },
  },
  crater: {
    base() {
      sky(0, 21, ['#0e0828', '#2c1c5c', '#583890', '#7a58b4']);
      stars(0, 18, 50, 19, ['#fffbe8', '#3cf0e0', '#ffd0f0']);
      galaxy(30, 9, 8, '#9c7cd6', '#fffbe8');
      ground(21, ['#7a58b4', '#6a48a4', '#583890'], '#8a68c4', '#2c1c5c', ['spiral', '#9c7cd6', '#fffbe8']);
      // Craters, each with the star that made it still shining at the bottom.
      pools([[2, 28, 16], [32, 53, 14], [56, 27, 12], [80, 50, 12]], '#180e34', '#2c1c5c', '#9c7cd6');
      for (const [x, y, w] of [[2, 28, 16], [32, 53, 14], [56, 27, 12], [80, 50, 12]]) lamp(x + w / 2, y + 1, w * 0.7, '#3cf0e0', 1.7, 1.8);
      starColors('#ffffff', '#fff4c4', '#3cf0e0');
    },
    anim() { twinkle(0, 18, 12, 19, '#ffffff'); },
  },
  fall: {
    base() {
      sky(0, 32, ['#0e0828', '#2c1c5c', '#6a48a4', '#9c7cd6']);
      stars(0, 18, 46, 21, ['#fffbe8', '#3cf0e0']);
      stayFall(84, '#fff4c4');
      // The ground leans toward the star.
      hz = 23;
      paintAs(GROUND, () => {
        for (let x = 0; x < W; x++) { const top = 23 + Math.round((W - x) / 12); rect(x, top, 1, H - top, x % 2 ? '#7a58b4' : '#7454ae'); }
        grad(31, H, ['#6a48a4', '#583890']);
        tautGrid(24, '#8a68c4', 84);
        creases(26);
      });
      pads('#2c1c5c');
      for (let k = 0; k < 7; k++) { const x = Math.floor(hash(k + 300) * 50), y = 34 + Math.floor(hash(k + 301) * 24); pic(['i.', 'xi', 'xx'], x, y, { i: '#fffbe8', x: '#3cf0e0' }); lamp(x + 1, y + 1, 4, '#3cf0e0', 1.4); }
      // The fallen star still burns, and the whole slope leans into its light.
      lamp(84, 18, 16, '#fff4c4', 2);
      lamp(80, 28, 16, '#fff4c4', 1, 2.4);
      starColors('#ffffff', '#fff4c4', '#9c7cd6');
    },
    anim() {
      twinkle(0, 18, 12, 21, '#ffffff');
      const k = (S.t >> 3) % 4;
      glow(() => { px(84, 13 - (k & 1), '#ffffff'); px(78 - k, 17, '#fff4c4'); px(90 + k, 17, '#fff4c4'); });
    },
  },
  fallgym: {
    base() {
      sky(0, 60, ['#000000', '#0e0828', '#2c1c5c']);
      stars(0, 34, 70, 23, ['#fffbe8', '#3cf0e0', '#9c7cd6', '#ffd0f0']);
      galaxy(72, 12, 12, '#7a58b4', '#fffbe8', 0.45);
      ground(32, ['#fffbe8', '#f4e8c4', '#dcd0f4'], '#ffffff', '#9c7cd6', ['spiral', '#ffffff', '#9c7cd6']);
      for (let x = 0; x < W; x += 6) dither(x, 33, 3, 27, '#9c7cd6', 0.125);
      // The white ground is star itself and gives its own light in long bands.
      for (let x = 0; x <= W; x += 16) lamp(x, 46, 13, '#fffbe8', 1, 1.6);
      starColors('#ffffff', '#3cf0e0', '#9c7cd6');
    },
    anim() { twinkle(0, 32, 16, 23, '#ffffff'); },
  },
  climb: {
    base() {
      sky(0, 21, ['#2a48c8', '#7a9ae0', '#e8e8f0', '#fff4d8']);
      stars(0, 8, 14, 25, ['#ffffff']);
      stayKey(84, '#e4b440');
      for (let k = 0; k < 6; k++) { rect(52 + k * 4, 20 - k * 2, 8, 2, '#ece2ca'); rect(52 + k * 4, 21 - k * 2, 8, 1, '#d8c8a0'); }
      ground(21, ['#f4ecd8', '#e8dcc0', '#d8c8a0'], '#ece2ca', '#1a1820', ['spiral', '#ffffff', '#2a48c8']);
      for (let x = 0; x < 30; x += 8) { const m = spiralMask(8, 2.2); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (m[j * 8 + i]) px(x + i, 50 + j, '#2a48c8'); }
      // The Key shines gold, and gold lamps climb the stair beside it.
      lamp(85, 6, 12, '#e4b440', 1.7);
      for (let k = 0; k < 6; k += 2) { px(55 + k * 4, 18 - k * 2, '#ffe080'); lamp(55 + k * 4, 18 - k * 2, 6, '#e4b440', 1.6); }
      for (const x of [4, 20]) lamp(x + 4, 54, 7, '#6a8cff', 1.4, 1.6);
    },
    anim() {
      const on = (S.t >> 5) % 3;
      glow(() => { px(85, 4, on ? '#fff8d0' : '#e4b440'); if (on === 1) { px(84, 4, '#fff8d0'); px(86, 4, '#fff8d0'); } });
    },
  },
  slack: {
    base() {
      sky(0, 30, ['#4a7ab0', '#a8c4dc', '#d8e0e8']);
      // A second horizon hangs upside down from the top of the sky.
      for (let x = 0; x < W; x++) { const b = Math.round(6 + 4 * noise(x, 30, 7)); rect(x, 0, 1, b, '#78767e'); px(x, b, '#4a6a8c'); }
      hz = 22;
      paintAs(GROUND, () => {
        ridge(22, 6, 9, 6, '#9a98a0', 24);
        grad(24, H, ['#9a98a0', '#8a888e', '#78767e']);
        for (let k = 0; k < 9; k++) {
          const y = 26 + k * 4;
          for (let x = 0; x < W; x++) if ((x + k * 7) % 31 < 22) px(x, y + Math.round(Math.sin((x + k * 13) / 4)), INK);
        }
      });
      pads('#4a4a52');
      // Rose lamps stand upside down on the hanging horizon.
      for (const x of [58, 72, 88]) { const b = Math.round(6 + 4 * noise(x, 30, 7)); rect(x, b + 1, 1, 3, '#4a6a8c'); lantern(x, b + 5, '#e478a8', 9, '#2a2a3a'); }
      starColors('#ffffff', '#e478a8', '#e4dccc');
    },
  },
  oldrind: {
    base() {
      sky(0, 22, ['#4a7ab0', '#a8c4dc', '#e4dccc']);
      // The old shell of the world, hollow and cracked, on the far horizon.
      for (let y = 4; y < 22; y++) {
        const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((22 - y) / 18) ** 2)) * 30);
        rect(66 - hw, y, hw * 2, 1, y % 4 === 0 ? '#78767e' : '#b8b6be');
      }
      line(62, 6, 58, 21, '#4a6a8c'); line(70, 8, 76, 21, '#4a6a8c');
      for (let a = 0; a < 3.1; a += 0.3) px(Math.round(66 + Math.cos(a + 3.14) * 12), Math.round(14 + Math.sin(a + 3.14) * 6), '#ffffff');
      hz = 22;
      paintAs(GROUND, () => { grad(22, H, ['#9a98a0', '#8a888e']); creases(22); creases(36); });
      pads('#4a4a52');
      // Pale light leaks out through the old shell's cracks.
      for (const [x, y] of [[61, 10], [59, 17], [71, 11], [74, 17], [66, 14]] as const) lamp(x, y, 6, '#b4d0ec', 1.5);
    },
  },
  stack: {
    base() {
      sky(0, 60, ['#0c0a14', '#1a1626', '#262234']);
      // Floors the tower has shed, piled up and each a little paler.
      for (let k = 0; k < 6; k++) { const y = 30 - k * 5, w = 40 - k * 4; rect(48 - w / 2 + 20, y, w, 4, ['#3a2c22', '#5a4030', '#7a5a44', '#9a7458', '#c8a070', '#f4e0bc'][k]); rect(48 - w / 2 + 20, y + 3, w, 1, '#0c0a14'); }
      stars(0, 20, 20, 27, ['#fff4c4']);
      ground(34, ['#4a4450', '#3e3a44', '#2a2830'], '#4e4856', '#0c0a14', ['ring', '#4e4856', '#f4e0bc']);
      // A lamp left burning on the top floor, and lit gaps between the floors.
      lantern(68, 3, '#ffc860', 12);
      for (let k = 1; k < 5; k++) { const y = 33 - k * 5; rect(70 + k * 2, y, 2, 1, '#ffb060'); lamp(71 + k * 2, y, 5, '#ffb060', 1.4); }
    },
    anim() { twinkle(0, 20, 6, 27, '#ffffff'); },
  },
  indoor: {
    base() {
      grad(0, 60, ['#22160e', '#3a2a1e', '#4a3428']);
      for (let x = 0; x < W; x += 8) rect(x, 0, 1, 32, '#22160e');
      rect(0, 14, W, 1, '#5a4030');
      for (let x = 6; x < W; x += 14) whorl(x, 11, 3, '#f4e0bc', '#7a5a44', '#ffffff');
      ground(32, ['#7a5a44', '#6a4e3a', '#5a4030'], '#8a6a50', '#22160e', ['spiral', '#8a6a50', '#f4e0bc']);
      // Lamps on the shelf, as on counters and shelves indoors.
      for (const x of [27, 61, 89]) lantern(x, 11, '#ffc860', 11);
    },
  },

  // ------------------------------------------------------------ the optional areas
  undermeadow: {
    base() {
      grad(0, 60, ['#0a0810', '#1c1410', '#33281f']);
      // Roots hang from the ceiling. Their tips glow.
      for (let x = 2; x < W; x += 5) {
        const h = 6 + Math.floor(hash(x * 3) * 22), tx = x + Math.round(Math.sin((h + x) / 4));
        for (let y = 0; y < h; y++) px(x + Math.round(Math.sin((y + x) / 4)), y, '#6a4c30');
        px(tx, h, '#5cf4d4');
        lamp(tx, h, 4, '#5cf4d4', 1.5);
      }
      ground(34, ['#4a3a30', '#3e3028', '#33281f'], '#56463a', '#140e0c', ['ring', '#56463a', '#5cf4d4']);
      for (let x = 0; x < W; x += 3) { const l = 2 + Math.floor(hash(x + 40) * 6); line(x, 60, x + l, 60 - l, '#6a4c30'); }
      lamp(65, 16, 5, '#ecc470', 1.6, 0.3);
      lamp(65, 36, 12, '#ecc470', 1.8, 2);
    },
    anim() {
      // Light falls through the crease above, a little wider some moments than others.
      const w = 6 + ((S.t >> 5) % 2);
      glow(() => {
        dither(62, 0, w, 34, '#ecc470', 0.25);
        dither(63, 0, w - 2, 34, '#ecc470', 0.125);
        dither(58, 34, w + 8, 4, '#ecc470', 0.25);
        for (let k = 0; k < 4; k++) px(63 + (k * 3) % w, (S.t / (3 + k) + k * 9) % 34, '#fae8c0');
      });
    },
  },
  knucklebones: {
    base() {
      sky(0, 22, ['#5a3a9a', '#a07ac8', '#e8b8d0', '#f8e0d8']);
      // A giant's finger bones curl up out of the grass.
      for (const [x, s] of [[54, 1], [66, 1.4], [86, 1.1]] as const) {
        const pts = [[x, 22], [x + 1, 22 - 6 * s], [x + 4 * s, 22 - 11 * s], [x + 9 * s, 22 - 13 * s]];
        path(pts.map(([a, b]) => [Math.round(a), Math.round(b)]), '#f6eee0', 3);
        for (const [a, b] of pts.slice(1, 3)) disc(Math.round(a) + 1, Math.round(b) + 1, 2, '#ffffff');
        px(Math.round(pts[2][0]) + 1, Math.round(pts[2][1]) + 1, '#ff8498');
      }
      ground(22, ['#b4a45c', '#a0904a', '#8c7a3c'], '#c0b068', '#3a5a22', ['spiral', '#f6eee0', '#ff8498']);
      path([[0, 44], [8, 40], [16, 41], [22, 46]], '#f6eee0', 3);
      disc(1, 44, 3, '#ffffff'); disc(16, 41, 2, '#ffffff');
      stems(26, 42, 60, '#7a9e38', '#d4c47c', 13);
    },
    anim() {
      // Violet wisps drift between the knuckles.
      wisps(6, 50, 96, 4, 26, '#c8a0ff', 13, 5);
      wisps(4, 0, 30, 30, 50, '#c8a0ff', 14, 5);
    },
  },
  wrecks: {
    base() {
      sky(0, 22, ['#0a0a2a', '#22164a', '#4a2a6a', '#8a4a6a']);
      stars(0, 16, 40, 29, ['#fff4e0', '#44b4cc']);
      // Hulls on their sides along the horizon, red undersides up.
      for (const [x, w, f] of [[52, 18, 0], [76, 20, 1]] as const) {
        for (let i = 0; i < w; i++) {
          const h = Math.round(7 * Math.sin(Math.PI * (i + 0.5) / w));
          const X = f ? x + w - i : x + i;
          rect(X, 22 - h, 1, h, '#6a3e22');
          rect(X, 22 - h, 1, 2, '#ee3e28');
          if (i % 3 === 0) px(X, 22 - Math.max(1, h - 3), '#2a160c');
        }
      }
      ground(22, ['#dcb06c', '#c49a5a', '#b28646'], '#e4be7c', '#6a3e22', ['scallop', '#f2d296', '#ee3e28']);
      ripples(22, '#b28646', '#f2d296', 29);
      // The ribs of a boat in the near sand.
      for (let k = 0; k < 5; k++) path([[2 + k * 6, 60], [k * 6, 50], [4 + k * 6, 42]], '#4a2a14', 1);
      path([[0, 44], [30, 40]], '#4a2a14', 1);
      // A lantern hung on the near hull, and a lit porthole in the far one.
      rect(63, 13, 1, 2, '#2a160c');
      lantern(63, 16, '#ffc860', 10);
      disc(85, 18, 1.5, '#ffd890');
      lamp(85, 18, 6, '#ffc860', 1.6);
      starColors('#ffffff', '#44b4cc', '#f2d296');
    },
    anim() { twinkle(0, 16, 8, 29, '#ffffff'); },
  },
  shoreline: {
    base() {
      sky(0, 8, ['#c4d8e4', '#e4ecf0']);
      // The sea's slough stands as a gray wall of still water up to the sky, with fish held in it.
      grad(8, 22, ['#5a7690', '#7898ac', '#9ab4c4']);
      for (let y = 10; y < 22; y += 3) dither(0, y, W, 1, '#c4ecf4', 0.25);
      rect(0, 8, W, 1, '#f4fbff');
      for (const [x, y] of [[58, 12], [76, 16], [88, 11], [20, 14]] as const) pic(['.xx.x', 'xxixx', '.xx.x'], x, y, { x: '#ff8a30', i: '#ffffff' });
      // Its reflection on the wet sand, upside down.
      sea = 22;
      paintAs(WATER, () => { grad(22, 34, ['#9ab4c4', '#c0ccd0', '#d4c4a0']); for (let x = 0; x < W; x += 3) dither(x, 23, 1, 10, '#5a7690', 0.25); });
      ground(34, ['#d4c4a0', '#c4b490', '#aa9a78'], '#dccca8', '#3a5670', ['scallop', '#ecdec0', '#ff8a30']);
      ripples(34, '#aa9a78', '#ecdec0', 31); pools([[44, 52, 14], [76, 56, 10]], '#9ab4c4', '#5a7690', '#aa9a78');
      // The fish held in the wall glow orange, and so do their reflections.
      for (const [x, y] of [[58, 12], [76, 16], [88, 11], [20, 14]] as const) { lamp(x + 2, y + 1, 7, '#ff8a30', 1.7); lamp(x + 2, 43 - y, 5, '#ff8a30', 1.3, 1.6); }
    },
    anim() { glints(23, 33, '#ffffff', 5); },
  },
  underspire: {
    base() {
      grad(0, 60, ['#262c44', '#141828', '#08060e']);
      // The bell tower hangs upside down: its floor is above and its bells hang mouth up.
      for (let y = 0; y < 6; y += 2) rect(0, y, W, 1, '#4c5a7e');
      for (const [x, h] of [[8, 14], [30, 10], [58, 18], [84, 12]] as const) {
        rect(x + 3, 6, 2, h, '#4c5a7e');
        pic(['...aa...', 'WWWWWWWW', 'xxxxxxxx', '.xxxxxx.', '.xixxxx.', '..xxxx..'], x, 6 + h, { a: '#34d6a4', W: '#5a4a20', x: '#f4b42c', i: '#fff4c4' });
        // Each bell holds a little green light in its upturned mouth.
        lamp(x + 4, 6 + h, 9, '#34d6a4', 1.7);
      }
      ground(34, ['#384260', '#2e3654', '#262c44'], '#4e5a7e', '#08060e', ['spiral', '#4e5a7e', '#f4b42c']);
    },
    anim() {
      const k = (S.t >> 6) % 4, xs = [8, 30, 58, 84];
      if ((S.t >> 3) % 8 < 2) { const y = [14, 10, 18, 12][k] + 9; glow(() => px(xs[k] + 2, y, '#ffffff')); lamp(xs[k] + 2, y, 6, '#fff4c4', 1.6); }
    },
  },
  geode: {
    base() {
      grad(0, 60, ['#0c0820', '#1e1438', '#352a4a']);
      // Crystal points hang from the geode's roof, each lit from inside at its tip.
      for (let k = 0; k < 9; k++) {
        const x = 4 + k * 11 + Math.floor(hash(k + 900) * 5), h = 6 + Math.floor(hash(k + 901) * 14);
        for (let y = 0; y < h; y++) { const w = Math.max(0, Math.round((h - y) / 4)); rect(x - w, y, w * 2 + 1, 1, y < 2 ? '#6a48a4' : '#b48cf0'); }
        px(x, h - 1, '#f4eaff');
        lamp(x, h, 5, '#c890ff', 1.5);
      }
      ground(34, ['#463a5e', '#3e3354', '#352a4a'], '#5e5080', '#0c0820', ['ring', '#5e5080', '#c890ff']);
      for (const [x, y] of [[10, 44], [80, 40], [52, 55]] as const) {
        pic(['..i..', '.iai.', 'iaaai', 'aaxaa'], x - 2, y - 3, { i: '#f4eaff', a: '#c890ff', x: '#5ae8d0' });
        lamp(x, y, 8, '#c890ff', 1.6);
      }
    },
    anim() {
      // One crystal tip at a time catches a glint.
      const k = (S.t >> 4) % 9;
      glow(() => px(4 + k * 11 + Math.floor(hash(k + 900) * 5), 2, '#ffffff'));
    },
  },
  rootfall: {
    base() {
      sky(0, 22, ['#24481a', '#4a7a34', '#a8c870', '#e0ecb8']);
      // The fallen Bole's roots arch overhead.
      for (let k = 0; k < 5; k++) {
        const x0 = k * 22 - 6;
        path([[x0, 60], [x0 + 4, 30], [x0 + 12, 10], [x0 + 24, 2], [x0 + 34, 0]], '#4a2812', 3);
        path([[x0 + 1, 60], [x0 + 5, 31], [x0 + 13, 11]], '#a46838', 1);
      }
      ground(22, ['#5a4426', '#4c3a20', '#3e2e18'], '#665030', '#24481a', ['ring', '#7a5e36', '#6ac840']);
      // Sulfur fungus glows on the roots and the ground.
      for (let k = 0; k < 6; k++) { const x = Math.floor(hash(k + 500) * 90), y = 30 + Math.floor(hash(k + 501) * 26); pic(['ff', 'fi'], x, y, { f: '#f4d038', i: '#ecf8c0' }); lamp(x + 1, y + 1, 6, '#f4d038', 1.6); }
      for (const [x, y] of [[60, 14], [82, 6], [40, 24]] as const) { pic(['ff', 'fi'], x, y, { f: '#f4d038', i: '#ecf8c0' }); lamp(x + 1, y + 1, 6, '#f4d038', 1.6); }
    },
    anim() { rain(0, W, 0, 30, 10, '#2e8ab0', false); },
  },
  skinfall: {
    base() {
      sky(0, 22, ['#120c2a', '#2a3a80', '#685c80', '#aca2c0']);
      stars(0, 14, 30, 31, ['#ffffff', '#94b4d4']);
      // Husks of the old high machines lie where they came down, pearly and striped.
      whorl(62, 18, 8, '#f2eaf4', '#8a789c', '#ffffff');
      rect(54, 17, 17, 2, '#ff5a34');
      whorl(86, 20, 5, '#dccce4', '#8a789c', '#ffffff');
      ground(22, ['#8a7ea0', '#7a6e92', '#685c80'], '#9a8eb0', '#3a3060', ['ring', '#aca2c0', '#ff5a34']);
      shells(22, 6, 33, '#f2eaf4', '#8a789c', '#ffffff');
      for (const [x, y, w] of [[2, 30, 16], [34, 54, 12]] as const) { rect(x + 1, y, w - 2, 1, '#aca2c0'); rect(x, y + 1, w, 2, '#3a3060'); }
      starColors('#ffffff', '#ff5a34', '#dccce4');
    },
    anim() {
      twinkle(0, 14, 8, 31, '#ffffff');
      snowfall(8, '#f2eaf4', 6);
      // The husks' warning lamps still blink, one after the other.
      const k = (S.t >> 5) % 3, at = [[55, 17], [70, 17], [86, 15]][k];
      glow(() => { px(at[0], at[1], '#ffb090'); px(at[0], at[1] - 1, '#ff5a34'); });
      lamp(at[0], at[1], 10, '#ff5a34', 1.7);
    },
  },
  iceshelf: {
    base() {
      sky(0, 22, ['#060a30', '#101a48', '#2a3a8a']);
      stars(0, 16, 40, 33, ['#ffffff', '#bde2f6']);
      // Pressure ridges on the frozen lake.
      for (const [x, h] of [[54, 4], [62, 6], [70, 3], [86, 5]] as const) for (let j = 0; j < h; j++) rect(x - j, 22 - h + j, j * 2 + 1, 1, j === 0 ? '#ffffff' : '#4a7ec0');
      ground(22, ['#bde2f6', '#a4cee8', '#84b6dc'], '#d0ecfa', '#1a3a72', ['ring', '#ecfaff', '#4a7ec0']);
      // Something large and pale under the ice, glowing faintly through it.
      for (let x = 4; x < 36; x++) { const h = Math.round(4 * Math.sin(Math.PI * (x - 4) / 32)); dither(x, 50 - h, 1, h * 2, '#ffffff', 0.25); }
      line(40, 30, 60, 36, '#1a3a72'); line(60, 36, 70, 34, '#1a3a72');
      lamp(20, 50, 12, '#c8b4ff', 1, 2.6);
    },
    anim() { aurora(5, ['#3ce8c4', '#7836d8'], 22); twinkle(0, 16, 8, 33, '#ffffff'); },
  },
  battlefield: {
    base() {
      sky(0, 22, ['#1e1028', '#5a2a30', '#a04a2a', '#d88a4a']);
      // Blades still standing, rows of them to the horizon.
      for (let k = 0; k < 14; k++) { const x = 52 + Math.floor(hash(k + 600) * 44), h = 3 + Math.floor(hash(k + 601) * 6); rect(x, 22 - h, 1, h, '#a0a8b8'); px(x - 1, 22 - h + 2, '#30343e'); px(x + 1, 22 - h + 2, '#30343e'); }
      ground(22, ['#7c7250', '#6a6044', '#5a523a'], '#8a8060', '#30343e', ['ring', '#9a8c62', '#d8622a']);
      for (let k = 0; k < 14; k++) { const x = Math.floor(hash(k + 700) * 44), y = 26 + Math.floor(hash(k + 701) * 32); px(x, y, '#ff3434'); px(x + 1, y, '#ff3434'); px(x, y + 1, '#3a4422'); }
      for (const x of [4, 30]) { rect(x, 36, 2, 24, '#a0a8b8'); rect(x - 3, 41, 8, 2, '#30343e'); px(x, 36, '#ffffff'); px(x + 1, 38, '#e4e8f0'); }
      // Old fires still smolder among the blades.
      for (const [x, y] of [[62, 24], [88, 26], [16, 50]] as const) { pic(['.e.', 'eoe'], x - 1, y - 1, { e: '#d8622a', o: '#ffb040' }); lamp(x, y, 9, '#ff6a34', 1.6, 1.6); }
    },
    anim() {
      const y = 4 + ((S.t >> 5) % 10);
      dither(0, y, W, 2, '#d88a4a', 0.125);
      // Red embers rise from the fires.
      wisps(4, 56, 94, 12, 24, '#ffa060', 21, 3, 0.05);
      wisps(3, 8, 24, 38, 50, '#ffa060', 22, 3, 0.05);
    },
  },
  moonbed: {
    base() {
      sky(0, 22, ['#04041a', '#0c0c2a', '#20204c', '#484880']);
      stars(0, 20, 56, 35, ['#fffbe8', '#74f4e4', '#ffd0f0']);
      moon(82, 7, 6, '#fff4d0', '#04041a', 0);
      // The moon's slough rose out of this bed and hangs above it, pale and empty.
      for (let a = 0; a < 6.3; a += 0.2) px(Math.round(60 + Math.cos(a) * 6), Math.round(10 + Math.sin(a) * 6), '#aaaad4');
      dither(54, 4, 13, 13, '#aaaad4', 0.125);
      ground(22, ['#8888b8', '#7878a6', '#686896'], '#9898c4', '#20204c', ['spiral', '#aaaad4', '#fff4d0']);
      ripples(22, '#686896', '#aaaad4', 35);
      // Moon shells in the silt hold a little moonlight each.
      for (let k = 0; k < 8; k++) { const x = Math.floor(hash(k + 800) * 90), y = 28 + Math.floor(hash(k + 801) * 28); pic(['.aa', 'a..', '.aa'], x, y, { a: '#fff4d0' }); lamp(x + 1, y + 1, 5, '#74f4e4', 1.5, 1.5); }
      lamp(82, 7, 10, '#fff4d0', 1.1);
      lamp(60, 10, 7, '#aaaad4', 1.1);
      starColors('#ffffff', '#74f4e4', '#fff4d0');
    },
    anim() { twinkle(0, 20, 14, 35, '#ffffff'); },
  },
  glassdesert: {
    base() {
      sky(0, 22, ['#3a90d0', '#a0e0f0', '#f6fff8']);
      stars(0, 10, 16, 37, ['#ffffff', '#ff58b4']);
      // Spires of fused sand, green glass catching the light.
      for (const [x, h] of [[56, 12], [62, 7], [80, 15], [90, 9]] as const) {
        for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((h - j) * 0.3)); rect(x - w, 22 - j, w * 2, 1, '#24807c'); px(x - w, 22 - j, '#c0f4e6'); }
        px(x, 22 - h, '#ffffff'); px(x + 1, 22 - h + 2, '#ff58b4');
        lamp(x, 22 - h + 2, 6, '#ff58b4', 1.5);
      }
      ground(22, ['#84d4c2', '#6cc0ae', '#54a896'], '#a0e4d4', '#0e3a3a', ['spiral', '#c0f4e6', '#ff58b4']);
      ripples(22, '#54a896', '#c0f4e6', 37);
      for (let k = 0; k < 10; k++) { const x = Math.floor(hash(k + 900) * 92), y = 26 + Math.floor(hash(k + 901) * 30); px(x, y, '#ffffff'); px(x + 1, y + 1, k % 3 ? '#c0f4e6' : '#ff58b4'); }
      starColors('#ffffff', '#ff58b4', '#c0f4e6');
    },
    anim() {
      shimmer(14, 30);
      // Glass in the sand flashes magenta where light passes through it.
      const k = (S.t >> 4) % 10, x = Math.floor(hash(k + 900) * 92), y = 26 + Math.floor(hash(k + 901) * 30);
      glow(() => { px(x, y, '#ffffff'); px(x - 1, y, '#ff58b4'); px(x + 1, y, '#ff58b4'); px(x, y - 1, '#ff58b4'); });
      lamp(x, y, 7, '#ff58b4', 1.6);
    },
  },
  handsorchard: {
    base() {
      sky(0, 22, ['#1e6ab8', '#6ab0e8', '#c8e8f8']);
      // The garden wall, with trees trained flat on it into the shapes of hands.
      rect(50, 6, W - 50, 16, '#f6eedc'); rect(50, 6, W - 50, 1, '#ffffff'); rect(50, 21, W - 50, 1, '#9a8460');
      for (const x of [56, 74, 90]) {
        rect(x, 13, 2, 8, '#124a1a');
        for (let f = -2; f <= 2; f++) line(x + 1, 13, x + 1 + f * 2, 7 + Math.abs(f), '#2a8c2a');
        px(x - 3, 9, '#ec364c'); px(x + 4, 8, '#ecb428'); px(x + 1, 6, '#ec364c');
        // The fruit glows like small lamps.
        lamp(x - 3, 9, 4, '#ec364c', 1.5); lamp(x + 4, 8, 5, '#ecb428', 1.6); lamp(x + 1, 6, 4, '#ec364c', 1.5);
      }
      ground(22, ['#68b446', '#5aa03c', '#488c30'], '#78c454', '#124a1a', ['ring', '#90d664', '#ecb428']);
      for (let x = 0; x < 44; x += 2) if (x % 4 === 0) dither(x, 24, 2, 36, '#90d664', 0.25);
      for (const [x, y] of [[6, 30], [34, 54], [12, 56]] as const) { px(x, y, '#ec364c'); px(x + 1, y, '#ec364c'); px(x, y - 1, '#2a8c2a'); lamp(x, y, 5, '#ecb428', 1.5); }
    },
  },
  margin: {
    base() {
      sky(0, 30, ['#000010', '#0a1040', '#2a4ce8']);
      stars(0, 28, 70, 39, ['#ffffff', '#b4d0ec', '#ffd8a0']);
      galaxy(70, 10, 11, '#9ab4d8', '#ffffff', 0.4);
      // The world ends at a clean edge, and past it there is only sky, below as well as above.
      hz = 30;
      paintAs(GROUND, () => {
        for (let x = 0; x < W; x++) { const top = 30 + Math.round(3 * noise(x, 40, 9)); rect(x, top, 1, H - top, '#e6e2d8'); px(x, top, '#ffffff'); }
        for (let x = 0; x < W; x += 4) dither(x, 31, 2, 4, '#c6c2b6', 0.5);
        tautGrid(32, '#c6c2b6');
        creases(32);
      });
      pads('#9a98aa');
      // Points of deep blue in the blank ground, each a little light from the sky below.
      for (let k = 0; k < 6; k++) { const x = Math.floor(hash(k + 950) * W), y = 34 + Math.floor(hash(k + 951) * 24); px(x, y, '#2a4ce8'); lamp(x, y, 6, '#4a6cff', 1.6, 1.6); }
      starColors('#ffffff', '#b4d0ec', '#f6f4ee');
    },
    anim() { twinkle(0, 28, 16, 39, '#ffffff'); },
  },
};

// ---------------------------------------------------------------- the Strand (Act 2)

/** The Strand's night: deep blues and violets, and stars in pearl, gold, sea glass, and lilac. */
const NIGHT = ['#04031a', '#0c0a2e', '#1c1650', '#33276a', '#4e3a82'];
const STARC = ['#fff8e8', '#ffd04a', '#3ee8c8', '#c8c0ff'];
const NSAND = ['#a49ecb', '#8a84b4', '#7e78a8', '#6a6496', '#5c5688', '#3e3a66'];
const IVORY = ['#fff8ec', '#ece0cc', '#c8b8a0', '#9a8878', '#6a5a58'];
const CASTC = ['#fbf8f4', '#e8e0e2', '#c8bccc', '#9a8cac', '#62567a'];
const PINKS = ['#fff0ec', '#ffd6c4', '#f6b2c4', '#e494ac', '#c06a8a', '#8a2a56', '#3a0c26'];

function strandSky(y1: number, seed: number, n = 64): void {
  sky(0, y1, NIGHT.slice(0, 4).concat(y1 > 24 ? [NIGHT[4]] : []));
  band(Math.round(y1 * 0.45), 3, 4, '#3a2a7a', seed);
  stars(0, y1 - 1, n, seed, STARC);
  starCols = ['#ffffff', '#ffd04a', '#fff0b0'];
}

/** Ground with no grid and no crazes: the Stays hold the Volute and nothing out here. */
function sandFloor(y0: number, cols: string[], padCol: string, st?: Stage): void {
  hz = Math.min(hz, y0);
  paintAs(GROUND, () => grad(y0, H, cols));
  stagePending = { st, col: padCol };
}

/** The night sea: deep blue under foam lines, with the stars standing in it. */
function nightSea(y0: number, y1: number, seed: number): void {
  water(y0, y1, '#0c1650', '#1e3a96', '#3a62c0', '#e8f0ff');
  paintAs(WATER, () => {
    for (let k = 0; k < 14; k++) {
      const x = Math.floor(hash(seed * 71 + k) * W), y = y0 + 1 + Math.floor(hash(seed * 43 + k * 3) * (y1 - y0 - 1));
      px(x, y, k % 4 ? '#c8c0ff' : '#ffd04a');
    }
  });
}
function seaAnim(y0: number, y1: number, seed: number): void {
  glints(y0 + 1, y1, '#e8f0ff', 4);
  glow(() => {
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(hash(seed * 71 + k) * W), y = y0 + 1 + Math.floor(hash(seed * 43 + k * 3) * (y1 - y0 - 1));
      if ((S.t + k * 37) % 120 < 8) { px(x - 1, y, '#ffffff'); px(x + 1, y, '#ffffff'); }
    }
  });
}

/** The Strand's bright stars, which blink. Its falling stars come from the sky's rate. */
function strandFall(n: number, y1: number): void {
  twinkle(0, y1 - 2, 10, n * 7 + y1, '#ffffff');
}

/** The Volute seen from the Strand: a spiral shell the size of a hill lying in the sand, Stay points through it. */
function volute(x: number, y: number, len: number, h: number): void {
  const r = Math.floor(h / 2);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const half = u < 0.35 ? r * Math.pow(Math.sin((u / 0.35) * Math.PI / 2), 0.7) : r * (1 - (u - 0.35) / 0.65);
    const step = u > 0.45 && (i % 4 === 0) ? 1 : 0;
    const top = Math.round(y - half) + step, bot = Math.round(y + half * 0.7);
    if (bot <= top) continue;
    rect(x + i, top, 1, bot - top, IVORY[1]);
    px(x + i, top, IVORY[0]);
    rect(x + i, bot - 1, 1, 1, IVORY[3]);
    if (step) rect(x + i, top, 1, Math.max(1, Math.round((bot - top) * 0.6)), IVORY[3]);
    else if ((i + Math.round(top)) % 5 === 0 && u < 0.45) px(x + i, top + 2, '#8a5a4a');
    if (i % 5 === 2 && i < len - 4) { px(x + i, top - 1, INK); px(x + i, top - 2, INK); }
  }
}

/** The Conch, lip flat on the sand at x, y and the spire rising up and right in knobbed turns. s scales it. */
function conchShell(x: number, y: number, s: number): void {
  // The flared lip, glossy, spread on the sand.
  for (let j = 0; j < 4 * s; j++) { const w = Math.round((22 - j * 2) * s); rect(x + Math.round(j * 1.5), y - j, w, 1, j === 0 ? PINKS[4] : j === Math.ceil(4 * s) - 1 ? PINKS[0] : PINKS[1]); }
  // The body whorl, striped, with knobs along its shoulder.
  const bx = x + Math.round(16 * s), by = y - Math.round(9 * s), rx = 11 * s, ry = 7 * s;
  for (let yy = Math.floor(by - ry); yy <= by + ry; yy++) for (let xx = Math.floor(bx - rx); xx <= bx + rx; xx++) {
    const d = Math.hypot((xx + 0.5 - bx) / rx, (yy + 0.5 - by) / ry);
    if (d > 1) continue;
    px(xx, yy, d > 0.88 ? PINKS[4] : yy < by - ry * 0.5 ? PINKS[1] : (xx + yy) % 5 === 0 ? PINKS[3] : PINKS[2]);
  }
  for (let k = 0; k < 4; k++) { const kx = Math.round(bx - rx * 0.6 + k * rx * 0.45), ky = Math.round(by - ry * 0.85); px(kx, ky - 1, PINKS[0]); px(kx, ky - 2, PINKS[1]); }
  // The spire: turns that step up and shrink, a knob on each.
  for (let k = 0; k < 4; k++) {
    const w = Math.round((9 - k * 2) * s), sx = bx + Math.round((6 + k * 4) * s), sy = by - Math.round((5 + k * 3) * s);
    rect(sx - w / 2, sy, w, Math.max(1, Math.round(3 * s)), k & 1 ? PINKS[3] : PINKS[2]);
    rect(sx - w / 2, sy, w, 1, PINKS[1]);
    px(sx, sy - 1, PINKS[0]);
  }
  // The mouth, dark and wet, opening toward the sea.
  for (let i = 0; i < Math.round(14 * s); i++) px(x + Math.round(3 * s) + i, y - Math.round(2 * s) - (i >> 2), PINKS[6]);
}

/** A white slot post, small on the horizon. */
function whitePost(x: number, y: number, h: number): void { rect(x, y - h, 1, h, '#ffffff'); px(x + 1, y - h + 1, '#c8c4dc'); }

/** Driftwood labels stuck in the sand, capitals pressed in. */
function labelPost(x: number, y: number): void {
  rect(x + 2, y - 3, 1, 4, '#76685e');
  rect(x, y - 6, 6, 3, '#a89a8e'); rect(x, y - 6, 6, 1, '#d4c8bc');
  px(x + 1, y - 4, '#4a3e38'); px(x + 3, y - 4, '#4a3e38'); px(x + 4, y - 5, '#4a3e38');
}

/** A black weed ridge along the tide line. */
function weedLine(y: number, seed: number, x0 = 0, x1 = W): void {
  for (let x = x0; x < x1; x++) {
    const h = 1 + Math.floor(noise(x, seed, 4) * 3);
    rect(x, y - h, 1, h, '#141420');
    if (hash(x * 3 + seed) < 0.12) px(x, y - h - 1, '#262a3e');
    if (hash(x * 5 + seed) < 0.05) { px(x, y - h, '#3ee8c8'); lamp(x, y - h, 4, '#3ee8c8', 1.6); }
  }
}

const STRAND_SCENES: Record<string, Scene> = {
  outerwhorl: {
    base() {
      strandSky(24, 51, 80);
      galaxy(64, 9, 8, '#5a4aa8', '#fff8e8');
      // Far below lie the beach and the sea, and the Exuvia lies on the sand to the north.
      nightSea(24, 28, 51);
      rect(0, 28, W, 3, NSAND[3]); dither(0, 28, W, 1, NSAND[1], 0.5);
      volute(58, 26, 18, 5);
      // The shell underfoot curves away in growth ridges.
      hz = 31;
      paintAs(GROUND, () => {
        for (let x = 0; x < W; x++) {
          const top = 31 + Math.round(4 * Math.pow((x - 48) / 48, 2));
          rect(x, top, 1, H - top, IVORY[1]);
          px(x, top, IVORY[0]);
        }
        for (let k = 0; k < 7; k++) {
          const y0 = 36 + k * 4 + k;
          for (let x = 0; x < W; x++) { const y = y0 + Math.round(2 * Math.sin((x + k * 9) / 13)); px(x, y, IVORY[2]); if (k % 3 === 1) px(x, y + 1, IVORY[3]); }
        }
      });
      // The varix, an old lip standing up from the shell, with barnacles on it.
      for (let x = 0; x < 40; x++) { const y = 46 + Math.round(x * 0.2); rect(x, y - 2, 1, 3, IVORY[0]); px(x, y + 1, IVORY[3]); if (x % 6 === 2) pic(['.b.', 'bkb'], x, y - 4, { b: '#6a7486', k: INK }); }
      stagePending = { st: ['ring', IVORY[0], '#ffd04a'], col: IVORY[3] };
      // A Stay's point standing out of the shell: black, with gold glints that light the shell around it.
      for (let j = 0; j < 22; j++) { const w = Math.max(1, Math.round(j * 0.22)); rect(86 - w, 31 - j, w * 2 + 1, 1, INK); }
      px(86, 16, '#ffd04a'); px(86, 22, '#ffd04a');
      lamp(86, 16, 6, '#ffd04a', 1.6); lamp(86, 22, 6, '#ffd04a', 1.6);
      lamp(86, 33, 11, '#ffd04a', 1, 2.2);
    },
    anim() { strandFall(5, 24); seaAnim(24, 28, 51); },
  },
  wrack: {
    base() {
      strandSky(20, 52);
      volute(56, 18, 38, 12);
      nightSea(20, 27, 52);
      sandFloor(27, [NSAND[1], NSAND[2], NSAND[3]], NSAND[5], ['scallop', NSAND[0], '#ffd04a']);
      ripples(27, NSAND[4], NSAND[0], 52);
      // The weed along the tide lines glows sea-glass green where it is wet.
      weedLine(29, 1); weedLine(40, 2, 0, 50);
      // Empty shells the size of houses, lying where the tide left them.
      whorl(14, 25, 4, '#e4d8ec', '#5c5688', '#f4f0ff');
      whorl(38, 26, 3, '#e4d8ec', '#5c5688', '#f4f0ff');
      conch(2, 54, 16, 9, '#e4d8ec', '#5c5688', '#f4f0ff');
      labelPost(30, 58);
    },
    anim() {
      strandFall(5, 20);
      seaAnim(20, 27, 52);
      // The glow runs along the weed in waves.
      const x = (S.t >> 1) % 140 - 20;
      lamp(x, 28, 10, '#3ee8c8', 1.5, 2.5);
      lamp(50 - ((S.t >> 1) % 90), 39, 9, '#3ee8c8', 1.4, 2.5);
    },
  },
  flats: {
    base() {
      strandSky(22, 53);
      // The Cowrie's dome on the far side, cream with brown spots.
      for (let i = 0; i < 26; i++) { const h = Math.round(9 * Math.sin(Math.PI * (i + 0.5) / 26)); rect(64 + i, 22 - h, 1, h, '#e6d2b0'); px(64 + i, 22 - h, '#fff0d4'); }
      for (const [sx, sy] of [[68, 19], [74, 15], [82, 16], [79, 20], [86, 19]] as const) px(sx, sy, '#8a4a2a');
      // Wet sand to the horizon holds the whole sky upside down.
      sea = 22;
      paintAs(WATER, () => {
        grad(22, 36, [NIGHT[3], NIGHT[2], NSAND[4]]);
        for (let k = 0; k < 22; k++) px(Math.floor(hash(k + 530) * W), 23 + Math.floor(hash(k + 531) * 12), k % 3 ? '#c8c0ff' : '#ffd04a');
      });
      sandFloor(36, [NSAND[3], NSAND[4], NSAND[5]], NSAND[5], ['ring', NSAND[2], '#ffd04a']);
      // The line of hollows going away toward the Cowrie, each holding a star's worth of light.
      for (let k = 0; k < 6; k++) { const y = 58 - k * 5, x = 8 + k * 9, w = Math.max(2, 8 - k); rect(x, y, w, Math.max(1, 3 - (k >> 1)), NSAND[5]); px(x, y - 1, NSAND[1]); px(x + (w >> 1), y, '#ffd04a'); lamp(x + (w >> 1), y, 7 - k * 0.6, '#ffd04a', 1.6, 1.8); }
      for (let k = 0; k < 8; k++) pic(['.hh', 'h..', '.hh'], Math.floor(hash(k + 540) * 40), 44 + Math.floor(hash(k + 541) * 14), { h: NSAND[1] });
    },
    anim() {
      strandFall(5, 22);
      // Each star has its double falling up in the wet sand.
      const k = (S.t >> 2) % 40;
      if (k < 8) glow(() => { px(30 + k, 24 + k, '#ffffff'); px(29 + k, 23 + k, '#ffd04a'); });
    },
  },
  sanddollar: {
    base() {
      // Inside the test: a low pale dome, and five petal openings with the night showing through.
      grad(0, 34, ['#ece2d4', '#d8c8b4', '#b29278']);
      // Five petals radiate from the middle of the dome overhead, each cut through to the night.
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * (1.1 + k * 0.2);
        for (let j = 4; j <= 26; j++) {
          const w = Math.round(3.4 * Math.sin(Math.PI * (j - 4) / 22));
          const x = Math.round(48 + Math.cos(a) * j * 1.7), y = Math.round(16 + Math.sin(a) * j * 0.55);
          if (w <= 0) continue;
          rect(x - w, y, w * 2 + 1, 1, NIGHT[1]);
          px(x - w - 1, y, '#8a7466'); px(x + w + 1, y, '#8a7466');
          if ((j * 7 + k) % 5 === 0) px(x + ((j & 1) ? 1 : -1), y, STARC[(j + k) % 4]);
        }
      }
      // Rows of pores round the dome.
      for (let x = 2; x < W; x += 3) px(x, 20 + Math.round(3 * Math.sin(x / 10)), '#8a7466');
      // The test's pillars, and the fire glowing up from below.
      for (const x of [6, 30, 62, 88]) { rect(x, 10, 3, 26, '#f6eee2'); rect(x + 2, 10, 1, 26, '#c8b8a8'); }
      sandFloor(34, ['#d2b694', '#b29278', '#8a6e5c'], '#5a4038', ['ring', '#e4d0a8', '#ff8c3a']);
      dither(0, 26, W, 8, '#ff8c3a', 0.125);
      dither(0, 32, W, 4, '#ff8c3a', 0.25);
      // Firelight from below fills the test, warm and low.
      lamp(48, 40, 26, '#ff8c3a', 0.9, 2.4);
      for (const x of [6, 30, 62, 88]) lamp(x + 1, 30, 6, '#ffb060', 1.3, 0.5);
    },
    anim() {
      // Firelight moves on the floor in whole steps, and embers rise through the petals.
      const k = (S.t >> 4) % 3;
      glow(() => dither(0, 34 + k, W, 2, '#ffb060', 0.125));
      lamp(30 + k * 14, 46, 14, '#ffb060', 1.6, 2.2);
      wisps(10, 0, W, 34, 56, '#ffd080', 26, 3, 0.12);
    },
  },
  doves: {
    base() {
      STRAND_SCENES.sanddollar.base();
      // The five doves at the middle of the test, standing in a ring and facing in.
      for (let k = 0; k < 5; k++) {
        const x = 56 + k * 8, y = 26 + Math.abs(k - 2) * 2;
        pic(['.oo....', 'owwo...', 'owwwooo', '.owwwwo', '..owwo.', '...oo..'], x, y, { w: '#fffaf0', o: '#8a7466' }, k > 2);
        dither(x + 1, y + 6, 5, 1, '#5a4038', 0.5);
      }
    },
    anim() { STRAND_SCENES.sanddollar.anim!(); },
  },
  cowrieback: {
    base() {
      strandSky(18, 54);
      nightSea(18, 24, 54);
      // Gray standing on the seaward sand: water a wave left when it turned. It keeps a little of the moon in it.
      for (const [x, w, h] of [[56, 10, 9], [72, 6, 6], [86, 9, 11]] as const) { rect(x, 24 - h, w, h, '#727e9e'); rect(x, 24 - h, w, 1, '#d6def0'); dither(x, 25 - h, w, h - 2, '#98a4c2', 0.25); lamp(x + w / 2, 24 - h / 2, w * 0.7, '#b4c4ff', 1.4, 0.9); }
      // The Cowrie's back fills the near ground: glaze and spots.
      hz = 24;
      paintAs(GROUND, () => { for (let x = 0; x < W; x++) { const top = 24 + Math.round(10 * Math.pow((x - 20) / 76, 2)); rect(x, top, 1, H - top, '#e6d2b0'); px(x, top, '#ffffff'); if (on2(x, top + 1)) px(x, top + 1, '#fff0d4'); } });
      for (let k = 0; k < 18; k++) { const x = Math.floor(hash(k + 560) * W), y = 30 + Math.floor(hash(k + 561) * 28); disc(x, y, 1 + (k % 3 === 0 ? 1 : 0), '#a85a30'); }
      line(0, 52, 60, 30, '#fff0d4');
      stagePending = { st: ['spiral', '#fff0d4', '#8a5ae0'], col: '#c0a07a' };
    },
    anim() {
      strandFall(4, 18);
      seaAnim(18, 24, 54);
      // A violet sheen slides along the glaze.
      const x = ((S.t >> 1) % 130) - 20;
      lamp(x, 52 - x * 0.37, 9, '#a07af0', 1.5, 1.5);
    },
  },
  polish: {
    base() {
      // Inside the Cowrie the sky is the dome, cream, with dark spots on it.
      grad(0, 30, ['#c0a07a', '#e6d2b0', '#f2e2c4']);
      // Terraces round the inner roll, lamps of glaze, windows of the town.
      for (let k = 0; k < 3; k++) {
        const y = 18 + k * 4;
        rect(54 - k * 6, y, W, 2, '#c0a07a');
        for (let x = 58 - k * 6; x < W; x += 7) { rect(x, y - 3, 3, 3, k & 1 ? '#8a4a2a' : '#a85a30'); px(x + 1, y - 2, '#ffd890'); lamp(x + 1, y - 2, 5, '#ffb060', 1.6); }
      }
      // The floor shows everything above it again, a little late: the dome, upside down.
      grad(30, H, ['#f2e2c4', '#e6d2b0', '#c0a07a']);
      for (let x = 0; x < W; x += 5) dither(x, 31, 2, 20, '#fff0d4', 0.25);
      // The town's lamps show again in the polished floor.
      for (let x = 58; x < W; x += 14) lamp(x, 40, 6, '#ffb060', 1.2, 1.4);
      stagePending = { st: ['spiral', '#fff0d4', '#8a5ae0'], col: '#c0a07a' };
    },
    anim() {
      // The spots drift on the dome, and their reflections drift in the floor three steps behind.
      for (let k = 0; k < 4; k++) {
        const x = Math.round((hash(k + 570) * 120 + S.t / (14 + k * 4)) % 120) - 12, y = 4 + Math.floor(hash(k + 571) * 12);
        disc(x, y, 3 + (k & 1), '#5a2a14');
        const lx = Math.round((hash(k + 570) * 120 + (S.t - 90) / (14 + k * 4)) % 120) - 12;
        dither(lx - 3, 56 - y, 7, 4, '#8a4a2a', 0.5);
      }
    },
  },
  underteeth: {
    base() {
      grad(0, H, ['#1e0e28', '#3a1a0e', '#5a2a14']);
      // A long slit of light through the floor, and the teeth along it, each as tall as Ouro, meshed shut.
      rect(0, 30, W, 3, '#8a5ae0'); rect(0, 31, W, 1, '#e8dcff');
      for (let x = 2; x < W; x += 9) {
        pic(['.www.', 'wwwww', 'wwwwh', 'wwwwh', 'wwwhh', '.whh.'], x, 24, { w: '#ffffff', h: '#c0a07a' });
        pic(['.whh.', 'wwwhh', 'wwwwh', 'wwwwh', 'wwwww', '.www.'], x + 4, 33, { w: '#fff8ec', h: '#c0a07a' });
      }
      sandFloor(40, ['#c0a07a', '#a08060', '#806040'], '#3a1a0e', ['ring', '#e6d2b0', '#8a5ae0']);
      // The slit lights the teeth and the floor in violet.
      for (let x = 4; x < W; x += 12) lamp(x, 31, 11, '#b89cff', 1.6, 1.4);
    },
    anim() {
      const k = (S.t >> 3) % 24;
      if (k < 12) { glow(() => rect(k * 8, 31, 4, 1, '#ffffff')); lamp(k * 8 + 2, 31, 9, '#e8dcff', 1.8, 1.2); }
    },
  },
  glosshall: {
    base() {
      // Gloss's hall: round, polished white, the mouth's slit along one wall.
      grad(0, 36, ['#d8d0e8', '#f4f0f8', '#ffffff']);
      for (let x = 0; x < W; x += 12) { rect(x, 0, 1, 36, '#e8e0f0'); }
      rect(54, 12, 42, 2, '#2a1438'); rect(54, 13, 42, 1, '#8a5ae0');
      for (let x = 56; x < W; x += 4) { px(x, 11, '#ffffff'); px(x + 2, 14, '#fff8ec'); }
      sandFloor(36, ['#ffffff', '#ece8f4', '#d8d0e8'], '#a098b8', ['spiral', '#ffffff', '#8a5ae0']);
      // Two faces in the floor, the second one late.
      for (const [x, y] of [[12, 46], [24, 50]] as const) { dither(x, y, 6, 5, '#c8bcd8', 0.5); px(x + 1, y + 2, '#7a3a22'); px(x + 4, y + 2, '#7a3a22'); }
      // Violet light from the mouth's slit runs along the white wall and down to the floor.
      for (let x = 58; x < W; x += 10) lamp(x, 13, 9, '#a07af0', 1.6, 1.2);
      lamp(76, 40, 12, '#a07af0', 1, 2.4);
    },
  },
  auger: {
    base() {
      strandSky(22, 55);
      nightSea(22, 26, 55);
      // A high dune, and the Auger lying up its side: a long tapering spire, ridged in tight turns.
      ridge(30, 12, 55, 30, '#6a6496', H);
      for (let i = 0; i < 76; i++) {
        const x = 8 + i, cy = 46 - i * 0.52, hh = Math.max(0.6, 8 * Math.pow(1 - i / 78, 0.8));
        for (let y = Math.round(cy - hh); y <= Math.round(cy + hh); y++) {
          const f = (y - (cy - hh)) / (2 * hh);
          // Sutures run on a slant round the spire, one per turn.
          const sut = (((x * 2 - y) % 9) + 9) % 9;
          let col = f < 0.18 ? '#fff0dc' : f < 0.6 ? '#d8b48a' : f < 0.85 ? '#9c8270' : '#5c3a4c';
          if (sut === 0) col = '#5c3a4c'; else if (sut === 1 && f < 0.6) col = '#fff0dc';
          px(x, y, col);
        }
      }
      disc(11, 47, 5, '#26141e'); disc(12, 47, 3, '#120a1e');
      sandFloor(42, [NSAND[2], NSAND[3], NSAND[4]], NSAND[5], ['ring', NSAND[1], '#f0c060']);
      stagePending = { st: ['ring', NSAND[1], '#f0c060'], col: NSAND[5] };
      // A gold light burns deep in the Auger's mouth and spills out over the dune.
      disc(12, 47, 1.5, '#ffe090');
      lamp(12, 47, 14, '#f0c060', 1.8);
      lamp(24, 52, 12, '#f0c060', 0.9, 2.2);
    },
    anim() { strandFall(5, 22); seaAnim(22, 26, 55); },
  },
  augerin: {
    base() {
      // Inside the spiral: whorl walls that bank and climb, vents with sky in them, and the turns narrowing above.
      grad(0, H, ['#120a1e', '#26141e', '#5c3a4c']);
      for (let k = 0; k < 7; k++) {
        const rx = 60 - k * 8, ry = 34 - k * 5, cy = 30 - k * 3;
        for (let a = 0; a < Math.PI * 2; a += 0.02) { const x = Math.round(48 + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry * 0.6); px(x, y, k & 1 ? '#76604e' : '#9c8270'); }
      }
      // Each vent lets in a shaft of pale blue sky that pools on the turn below.
      for (const [x, y] of [[70, 12], [84, 18], [60, 8]] as const) { disc(x, y, 3, '#120a1e'); disc(x, y, 2, '#4ad8f0'); px(x, y, '#ffffff'); lamp(x, y, 7, '#4ad8f0', 1.7); lamp(x - 2, y + 14, 6, '#4ad8f0', 1.4, 0.35); }
      px(48, 10, '#fff0dc'); px(48, 9, '#ffffff');
      lamp(48, 10, 6, '#fff0dc', 1.5);
      sandFloor(40, ['#c0a48c', '#9c8270', '#76604e'], '#26141e', ['ring', '#cdb49a', '#f0c060']);
      for (let x = 0; x < W; x += 2) px(x, 40 + ((x >> 1) & 1), '#76604e');
      lamp(70, 44, 12, '#4ad8f0', 0.9, 2.4);
    },
    anim() {
      // Sand runs down the turns.
      for (let k = 0; k < 6; k++) px(20 + k * 13, (S.t + k * 23) % 40, k & 1 ? '#c0a48c' : '#f0c060');
    },
  },
  augerpoint: {
    base() {
      // From the point the sky has a seam, winding round and up to a point overhead.
      strandSky(34, 56, 90);
      sandFloor(34, [NSAND[2], NSAND[3], NSAND[5]], NSAND[5], ['ring', '#d8b48a', '#ffd04a']);
      // Far below: the line of hollows going east to rows of squares, and a pink shell at the end of the beach.
      for (let k = 0; k < 10; k++) px(8 + k * 6, 37 + (k & 1), NSAND[0]);
      for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) px(70 + k * 3, 36 + j * 2, '#ffffff');
      conch(86, 36, 8, 4, PINKS[2], PINKS[4], PINKS[0], true);
      // The seam: a spiral line across the sky, winding round and up to a point overhead.
      for (let a = 0; a < 16; a += 0.04) {
        const [x, y] = seamAt(a);
        if (x < 0 || x >= W || y < 0 || y > 32) continue;
        px(x, y, a < 4 ? '#ffffff' : '#a89ce8');
        if (on2(x, y - 1)) px(x, y - 1, '#4a3a8a');
      }
      lamp(64, 12, 9, '#ffd04a', 1.6);
      lamp(91, 34, 8, '#ff9ab4', 1.4, 1.6);
    },
    anim() {
      // A stretch of the seam brightens and travels inward to the point, lighting the sky around it.
      const head = 16 - ((S.t / 5) % 16);
      glow(() => {
        for (let a = head; a < head + 1.2 && a < 16; a += 0.04) { const [x, y] = seamAt(a); if (y >= 0 && y <= 32) px(x, y, '#ffffff'); }
        px(64, 12, '#ffffff'); px(63, 12, '#ffd04a'); px(65, 12, '#ffd04a');
      });
      const [lx, ly] = seamAt(head + 0.6);
      if (ly >= 0 && ly <= 32) lamp(lx, ly, 7, '#c8c0ff', 1.6);
    },
  },
  lowline: {
    base() {
      strandSky(20, 57);
      nightSea(20, 30, 57);
      // The grounded Auger and the Nautilus at the water's edge.
      for (let i = 0; i < 24; i++) { const h = Math.max(1, Math.round(4 * (1 - i / 26))); rect(56 + i, 26 - h, 1, h * 2, i % 4 === 0 ? '#5c3a4c' : '#d8b48a'); }
      whorl(86, 22, 7, '#f2eee6', '#e8743e', '#ffffff');
      sandFloor(30, ['#545894', NSAND[4], NSAND[5]], NSAND[5], ['scallop', NSAND[2], '#3ee8c8']);
      // Kelp and eelgrass lying flat, and a deep fish with its eyes on top and a lure that glows.
      for (let k = 0; k < 6; k++) path([[k * 8, 60], [k * 8 + 3, 52], [k * 8 + 1, 46]], '#1a3a2a', 1);
      pic(['..ii....', '.bkbkb..', 'bbbbbbbb', '.bbbbbb.'], 28, 50, { b: '#5a6a8a', k: INK, i: '#ffffff' });
      line(30, 49, 33, 46, '#5a6a8a');
      // The Nautilus keeps a lamp lit in its open chamber.
      lamp(84, 24, 11, '#e8743e', 1.7);
    },
    anim() {
      strandFall(5, 20);
      seaAnim(20, 30, 57);
      const on = Math.cos(S.t / 40) > -0.6;
      if (on) glow(() => { px(34, 45, '#c8fff0'); px(34, 46, '#3ee8c8'); });
      lamp(34, 45, on ? 9 : 5, '#3ee8c8', 1.6);
    },
  },
  springlow: {
    base() {
      strandSky(26, 58, 90);
      // Far out on the bared sand, something sitting holds the Volute up to where an ear would be.
      const gx = 74;
      for (let j = 0; j < 13; j++) { const w = Math.round(4 + j * 0.6); rect(gx - w, 26 - j, w * 2, 1, '#100c2a'); }
      disc(gx, 10, 4, '#100c2a');
      line(gx - 5, 15, gx - 9, 10, '#100c2a', 2);
      for (let i = 0; i < 9; i++) { const h = Math.max(1, Math.round(2.5 * Math.sin(Math.PI * (i + 1) / 10))); rect(gx - 14 + i, 9 - h, 1, h * 2, i % 3 === 0 ? '#c8b8a0' : '#ece0cc'); }
      px(gx - 12, 8, INK); px(gx - 9, 7, INK);
      // The Volute held up to the ear glows faintly ivory.
      lamp(gx - 10, 9, 7, '#ece0cc', 1.4);
      // Ribs of sand, weed lying flat, and the sea a long way out.
      nightSea(26, 28, 58);
      sandFloor(28, [NSAND[3], NSAND[4], NSAND[5]], NSAND[5], ['ring', NSAND[2], '#ffd04a']);
      for (let k = 0; k < 8; k++) { const y = 30 + k * 4; for (let x = 0; x < W; x++) if (noise(x, k + 60, 7) > 0.4) px(x, y + Math.round(Math.sin(x / 6 + k)), NSAND[1]); }
      for (let k = 0; k < 4; k++) path([[k * 6, 60], [k * 6 + 2, 50], [k * 6 + 6, 44]], '#3a2a1a', 1);
    },
    anim() { twinkle(0, 26, 14, 58, '#ffffff'); },
  },
  nautilus: {
    base() {
      // Chambers going inward: curved septa, each smaller, nacre on their faces, a round hole low in each.
      grad(0, H, ['#181034', '#3a2a5a', '#948cb4']);
      for (let k = 0; k < 6; k++) {
        const rx = 56 - k * 9, ry = 30 - k * 5, cx = 54 + k * 4, cy = 30 - k * 2;
        for (let a = -Math.PI * 0.95; a < 0; a += 0.015) {
          const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
          rect(x, y, 1, 2, k & 1 ? '#e0dcf2' : '#f2eee6');
          if (on2(x, y + 2)) px(x, y + 2, '#40e8a8');
        }
        disc(cx, cy - 2, Math.max(1, 3 - k * 0.4), '#181034');
        // Green light shows through the hole in each septum, from the chambers further in.
        lamp(cx, cy - 2, 8 - k, '#40e8a8', 1.7);
      }
      sandFloor(36, ['#e0dcf2', '#bcb4d4', '#948cb4'], '#7a5a6e', ['spiral', '#ffffff', '#ff8a48']);
      lamp(60, 40, 12, '#40e8a8', 0.9, 2.4);
    },
    anim() {
      // A sheen goes round the nacre, slowly.
      const a = -Math.PI * 0.95 + ((S.t / 200) % 1) * Math.PI * 0.9;
      glow(() => { for (let k = 0; k < 4; k++) px(Math.round(54 + k * 4 + Math.cos(a) * (56 - k * 9)), Math.round(30 - k * 2 + Math.sin(a) * (30 - k * 5)), '#ffffff'); });
      lamp(Math.round(54 + Math.cos(a) * 56), Math.round(30 + Math.sin(a) * 30), 7, '#e0dcf2', 1.5);
    },
  },
  tidechamber: {
    base() {
      grad(0, H, ['#181034', '#2a2050', '#5a4a7a']);
      // Marks cut into every wall, one for every low, in a spiral up to a point in the ceiling. The longest are gilded and glow.
      for (let a = 0; a < 26; a += 0.16) {
        const r = 44 - a * 1.6, x = Math.round(48 + Math.cos(a) * r), y = Math.round(28 + Math.sin(a) * r * 0.5 - a * 0.6);
        if (r < 1) break;
        const n = 1 + Math.floor((Math.sin(a * 1.3) + 1) * 1.6);
        for (let j = 0; j < n; j++) px(x, y - j, '#e0dcf2');
        if (n >= 4) { px(x + 1, y - 4, '#ffd04a'); lamp(x + 1, y - 4, 4, '#ffd04a', 1.5); }
      }
      sandFloor(40, ['#bcb4d4', '#948cb4', '#7a6a9a'], '#3a2a5a', ['ring', '#e0dcf2', '#ff8a48']);
      lamp(48, 12, 10, '#ffd04a', 1.4);
    },
  },
  longstrand: {
    base() {
      strandSky(22, 59);
      nightSea(22, 26, 59);
      ridge(30, 6, 59, 12, NSAND[3], H);
      sandFloor(30, [NSAND[1], NSAND[2], NSAND[3]], NSAND[5], ['scallop', NSAND[0], '#ffd04a']);
      // Labels everywhere, stuck in the sand in no order. One on a post points at the sky, with a lantern hung from it.
      for (const [x, y] of [[56, 30], [64, 28], [78, 31], [90, 29], [6, 44], [30, 56], [40, 42]] as const) labelPost(x, y);
      rect(84, 6, 1, 24, '#76685e'); rect(82, 6, 5, 3, '#a89a8e'); px(84, 4, '#a89a8e'); px(84, 5, '#a89a8e');
      rect(87, 9, 1, 2, '#76685e');
      lantern(87, 12, '#ffd04a', 11, '#3a2e2a');
      stems(0, 24, 60, '#8a8a66', '#e2ded2', 59);
    },
    anim() { strandFall(5, 22); seaAnim(22, 26, 59); },
  },
  tray: {
    base() {
      strandSky(20, 60);
      // Rows of squares to the horizon, each marked by four white posts, each with a world in it that gives its own light.
      sandFloor(20, ['#e2ded2', '#c4c0b0', '#9e9a8c'], '#565464', ['ring', '#e2ded2', '#9a58f0']);
      for (let row = 0; row < 5; row++) {
        const y = 22 + row * row * 2 + row * 3, sc = 0.4 + row * 0.35, h = Math.max(2, Math.round(3 * sc));
        for (let x = (row & 1) * 6; x < W; x += Math.round(16 * sc + 6)) {
          whitePost(x, y, h); whitePost(x + Math.round(10 * sc), y, h);
          if (row < 3 && !(row === 1 && x > 40 && x < 70)) {
            const col = ['#e8c0a8', '#f4a8c0', '#a8c4e8', '#e8d070'][(x + row) % 4], wx = x + Math.round(5 * sc), wy = y - Math.round(2 * sc);
            whorl(wx, wy, Math.max(1, Math.round(3 * sc)), col, '#565464', '#ffffff');
            lamp(wx, wy, 3 + 3 * sc, col, 1.5);
          }
        }
      }
      // The biggest square, in the middle, empty.
      for (const [x, y] of [[56, 30], [80, 30], [54, 37], [82, 37]] as const) whitePost(x, y, 4);
    },
    anim() { strandFall(4, 20); },
  },
  hollowtop: {
    base() {
      // Inside a collected shell: the sky is the shell, pale and crazed, and in the middle a hollow where its new shell came off.
      grad(0, 24, ['#d4d0dc', '#e8e4ec', '#f4f2f6']);
      for (let k = 0; k < 9; k++) path([[Math.floor(hash(k + 610) * W), 0], [Math.floor(hash(k + 611) * W), 10], [Math.floor(hash(k + 612) * W), 22]], '#b4b0c0', 1);
      for (let i = 0; i < 20; i++) { const h = Math.round(6 * Math.sin(Math.PI * (i + 0.5) / 20)); rect(64 + i, 22 - h, 1, h, '#c8c4d0'); }
      // Empty houses, and a table set for four with the bowls upside down.
      for (const x of [56, 70, 86]) { rect(x, 16, 8, 6, '#e8e0d8'); rect(x - 1, 14, 10, 2, '#a89a8e'); rect(x + 3, 18, 2, 4, '#3a3442'); }
      sandFloor(24, ['#d8d0c8', '#c4bcb0', '#a89a8e'], '#76685e', ['ring', '#e8e0d8', '#9a58f0']);
      rect(6, 44, 26, 2, '#8a7a6a'); rect(8, 46, 1, 8, '#6a5a4a'); rect(29, 46, 1, 8, '#6a5a4a');
      for (let k = 0; k < 4; k++) pic(['.bb.', 'bbbb'], 8 + k * 6, 42, { b: '#e8e4ec' });
      // One candle left burning on the table, and one window still lit.
      rect(32, 42, 1, 2, '#f4f2f6');
      lamp(32, 41, 10, '#ffc860', 1.6);
      rect(73, 18, 2, 2, '#ffc860');
      lamp(74, 19, 7, '#ffc860', 1.6);
    },
    anim() {
      const f = (S.t >> 3) % 5;
      glow(() => { px(32, 41, f ? '#ffd060' : '#ffffff'); if (f === 2) px(32, 40, '#ffb040'); });
      lamp(32, 41, f === 2 ? 8 : 7, '#ffc860', 1.7);
    },
  },
  oldapex: {
    base() {
      // The top of the Volute's old shell, lying on its side, so the horizon leans.
      sky(0, 36, NIGHT.slice(0, 4));
      stars(0, 34, 70, 61, STARC);
      hz = 20;
      paintAs(GROUND, () => { for (let x = 0; x < W; x++) { const top = 20 + Math.round(x * 0.18); rect(x, top, 1, H - top, '#d8ccb8'); px(x, top, '#f4ecd8'); } });
      for (let k = 0; k < 14; k++) { const x = Math.floor(hash(k + 620) * W); path([[x, 24 + (x >> 3)], [x + 4, 34], [x - 2, 46], [x + 3, 60]], '#8a7e6e', 1); }
      // The Operculum, black, with four arms and a gold eye that lights the shell around it, and the cast at its post with its hands in the air.
      disc(72, 22, 6, INK); rect(60, 21, 24, 2, INK); rect(71, 12, 2, 20, INK); px(72, 22, '#e4b440');
      pic(['c.c', 'c.c', '.c.', 'ccc', '.c.', '.c.', 'c.c'], 86, 14, { c: '#e8e4f0' });
      lamp(72, 22, 13, '#e4b440', 1.4);
      stagePending = { st: ['ring', '#f4ecd8', '#e4b440'], col: '#8a7e6e' };
      starColors('#ffffff', '#ffd04a', '#fff0b0');
    },
    anim() { twinkle(0, 20, 10, 61, '#ffffff'); },
  },
  conch: {
    base() {
      strandSky(22, 62);
      nightSea(22, 28, 62);
      // The great pink shell lies with its mouth to the sea, its lip spread flat, its spire going up in knobbed turns. Its throat glows.
      conchShell(56, 25, 1);
      lamp(64, 22, 10, '#ff9ab4', 1.8, 1.6);
      lamp(64, 29, 12, '#ff9ab4', 0.9, 2.4);
      sandFloor(28, [NSAND[1], NSAND[2], NSAND[3]], NSAND[5], ['scallop', PINKS[1], PINKS[4]]);
      ripples(28, NSAND[4], NSAND[0], 62);
      labelPost(8, 46);
    },
    anim() { strandFall(5, 22); seaAnim(22, 28, 62); },
  },
  conchin: {
    base() {
      // Glossy pink walls curving over, turn behind turn.
      grad(0, H, [PINKS[5], PINKS[4], PINKS[3]]);
      for (let k = 0; k < 6; k++) {
        const rx = 70 - k * 10, ry = 40 - k * 6, cx = 48 + k * 5, cy = 44 - k * 3;
        for (let a = -Math.PI; a < 0; a += 0.012) { const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry); rect(x, y, 1, 2, PINKS[Math.max(0, 3 - k)]); px(x, y - 1, PINKS[Math.max(0, 2 - k)]); }
      }
      sandFloor(38, [PINKS[2], PINKS[3], PINKS[4]], PINKS[5], ['spiral', PINKS[1], '#36e0d0']);
      // Green light comes from deep in the turns, the way the sea comes in.
      lamp(73, 22, 14, '#36e0d0', 1.6);
      lamp(66, 40, 11, '#36e0d0', 0.9, 2.2);
    },
    anim() {
      // The walls stand in a little and out again, and the light from inside swells with them.
      const k = Math.cos(S.t / 60) > 0 ? 1 : 0;
      for (let x = 0; x < W; x += 3) px(x, 37 - k, PINKS[1]);
      lamp(73, 22, 18 + k * 3, '#36e0d0', 1);
    },
  },
  conchroar: {
    base() {
      grad(0, H, [PINKS[6], PINKS[5], PINKS[4]]);
      // Five openings in the inner wall, one above the next, each with a door beside it.
      for (let k = 0; k < 5; k++) {
        const x = 60 + k * 6, y = 34 - k * 7;
        disc(x, y, 3, PINKS[6]); disc(x, y, 2, INK);
        rect(x + 4, y - 3, 3, 5, PINKS[2]); px(x + 5, y - 1, PINKS[6]);
        // A pale gold lamp burns by each door.
        px(x + 7, y - 2, '#ffe2a0');
        lamp(x + 7, y - 2, 6, '#ffe2a0', 1.5);
      }
      sandFloor(40, [PINKS[3], PINKS[4], PINKS[5]], PINKS[6], ['ring', PINKS[2], '#ffe2a0']);
    },
    anim() {
      // The sea's sound comes up the spiral: rings out of each opening in turn, and the opening it leaves lights up.
      const k = (S.t >> 5) % 5, r = 3 + ((S.t >> 2) % 8);
      const x = 60 + k * 6, y = 34 - k * 7;
      glow(() => { for (let a = 0; a < 6.3; a += 0.3) if (on2(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r))) px(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), PINKS[1]); });
      lamp(x, y, 4 + r, '#ffd6c4', 1.2);
    },
  },
  conchmouth: {
    base() {
      grad(0, H, [PINKS[5], PINKS[4], PINKS[2]]);
      for (let x = 0; x < W; x += 4) dither(x, 0, 2, 30, PINKS[1], 0.125);
      // The Gleaner, curled in the mouth with its back to the door, and the aperture at its nape.
      for (let x = 50; x < W; x++) { const top = 6 + Math.round(10 * Math.pow((x - 74) / 24, 2)); rect(x, top, 1, 26 - top, CASTC[1]); px(x, top, CASTC[0]); if (top + 2 < 26 && on2(x, top + 18)) px(x, Math.min(25, top + 16), CASTC[2]); }
      disc(60, 13, 3, CASTC[4]); disc(60, 13, 2, INK);
      for (let k = 0; k < 6; k++) px(66 + k * 5, 7 + Math.round(Math.pow((66 + k * 5 - 74) / 24, 2) * 10), CASTC[2]);
      sandFloor(30, [PINKS[2], PINKS[3], PINKS[4]], PINKS[5], ['spiral', PINKS[1], CASTC[3]]);
      pools([[8, 50, 14], [30, 56, 10]], PINKS[1], PINKS[4], PINKS[5]);
      // The pools in the mouth hold a cold pearl light, and the light comes up off the Gleaner's back.
      lamp(15, 51, 11, '#e8e0ff', 1.6, 1.8);
      lamp(35, 57, 8, '#e8e0ff', 1.5, 1.8);
      lamp(80, 14, 14, '#e8e0ff', 1.1);
    },
    anim() {
      // It breathes.
      if (Math.cos(S.t / 90) > 0.6) for (let x = 56; x < 92; x++) px(x, 6 + Math.round(10 * Math.pow((x - 74) / 24, 2)) - 1, CASTC[1]);
    },
  },
};
Object.assign(P, STRAND_SCENES);

// ---------------------------------------------------------------- the ring round the Lipwater

interface CoastLook { sky: string[]; lip: string; sea: [string, string, string, string]; sand: string[]; line: string; pad: string; shell: [string, string, string]; extra?: () => void; anim?: () => void }

/** A beach on the Lipwater: the Lip across the water as a pale band, the sea, and a strip of sand with the region's things on it. */
function coastScene(c: CoastLook): Scene {
  return {
    base() {
      sky(0, 15, c.sky);
      stars(0, 12, 24, 7, ['#fff8ec', '#c4ecf4']);
      rect(0, 13, W, 3, c.lip); rect(0, 13, W, 1, '#ffffff'); dither(0, 16, W, 1, c.lip, 0.5);
      water(17, 27, c.sea[0], c.sea[1], c.sea[2], c.sea[3]);
      ground(27, c.sand, c.line, c.pad, ['scallop', c.shell[0], c.shell[1]]);
      shells(27, 8, 3, c.shell[0], c.shell[1], c.shell[2]);
      c.extra?.();
    },
    anim() { glints(18, 26, '#ffffff', 4); twinkle(0, 12, 4, 7, '#ffffff'); c.anim?.(); },
  };
}

interface WoodLook { sky: string[]; trunk: string; leaf: string; leaf2: string; ground: string[]; line: string; pad: string; light: string; extra?: () => void }

/** A wood: round trees along the back with their crowns over the top, a clearing in front, and light coming down between them. */
function woodScene(c: WoodLook): Scene {
  return {
    base() {
      sky(0, 22, c.sky);
      stars(0, 8, 10, 11, ['#fff8ec']);
      for (const [x, r] of [[2, 9], [22, 7], [42, 10], [64, 8], [86, 9]] as const) {
        rect(x + 2, 8, 3, 16, c.trunk); px(x + 3, 12, c.leaf2);
        disc(x + 3, 8, r, c.leaf); dither(x + 3 - r, 2, r * 2, r, c.leaf2, 0.5);
      }
      ground(23, c.ground, c.line, c.pad, ['ring', c.leaf2, c.leaf]);
      stems(0, W, 26, c.leaf, c.leaf2, 5);
      for (let k = 0; k < 10; k++) { const x = Math.floor(hash(k + 90) * 92), y = 30 + Math.floor(hash(k + 91) * 26); rect(x, y, 2, 1, c.leaf2); }
      c.extra?.();
    },
    anim() {
      const s = (S.t >> 6) % 3;
      glow(() => { dither(30 + s, 0, 5, 24, c.light, 0.125); dither(72 - s, 0, 4, 24, c.light, 0.125); });
      lamp(32 + s, 26, 10, c.light, 1.5, 2.2);
      lamp(74 - s, 26, 8, c.light, 1.5, 2.2);
    },
  };
}

Object.assign(P, {
  cocklecove: coastScene({ sky: ['#2a3a7a', '#5a6ab8', '#c886a8', '#f4b07a'], lip: '#e8dcc8', sea: ['#1e5ab8', '#3a8ad0', '#4ab8d8', '#c8f0f0'], sand: ['#ecd49a', '#dcbe82', '#ccae6c'], line: '#d8b670', pad: '#a8823e', shell: ['#fbeec4', '#e8604a', '#fffaf0'],
    extra: () => { conch(70, 50, 14, 8, '#e8604a', '#8a4a3a', '#fffaf0'); lantern(84, 22, '#ffc860', 8); } }),
  saltings: coastScene({ sky: ['#141038', '#2a3a6a', '#5a8aa0', '#a0c8c0'], lip: '#d8e4e8', sea: ['#1a4a80', '#2a6a98', '#3a8ab0', '#e8f4f0'], sand: ['#d8d8cc', '#c4c4b8', '#b0b0a4'], line: '#c0c0b4', pad: '#6a7a8a', shell: ['#f4f4ec', '#6a7a8a', '#ffffff'],
    extra: () => { for (let k = 0; k < 4; k++) { rect(6 + k * 22, 34, 16, 6, '#3a8ab0'); rect(6 + k * 22, 34, 16, 1, '#ffffff'); dither(6 + k * 22, 35, 16, 5, '#f4f4ec', 0.25); } } }),
  kelpbeds: coastScene({ sky: ['#10203a', '#1e3a48', '#3a6a5a', '#88a868'], lip: '#c8d0a8', sea: ['#1e5a90', '#2a7aa0', '#38a0c0', '#e0f0c0'], sand: ['#c4b880', '#b2a66c', '#a09458'], line: '#b0a46a', pad: '#4a7a2a', shell: ['#e0d8a4', '#4a7a2a', '#f4f8d4'],
    extra: () => { for (let x = 4; x < W; x += 9) { for (let y = 30; y < 56; y += 2) px(x + ((y >> 2) & 1), y, '#4a7a2a'); rect(x, 54, 3, 2, '#1e3e10'); } } }),
  gantry: coastScene({ sky: ['#101a3a', '#2a3a5a', '#566880', '#9aa8b8'], lip: '#c8ccd2', sea: ['#1c3a7a', '#24568e', '#2e78b0', '#c8e8f0'], sand: ['#9aa0a8', '#888e98', '#767c86'], line: '#8a909a', pad: '#2a3240', shell: ['#bcc2ca', '#2a3240', '#f2f6fa'],
    extra: () => { for (const x of [20, 62]) { rect(x, 6, 3, 22, '#2a3240'); rect(x, 6, 26, 2, '#2a3240'); rect(x + 24, 8, 1, 10, '#6c7888'); rect(x + 21, 18, 7, 4, '#ffb020'); } } }),
  floes: coastScene({ sky: ['#1a2458', '#3a5a9a', '#8ab4e0', '#dce8f4'], lip: '#f4faff', sea: ['#1a4aa0', '#2a6ac0', '#3a8ad8', '#ffffff'], sand: ['#dce8f4', '#c8d8ec', '#a6bede'], line: '#c0d0e4', pad: '#3a5a80', shell: ['#f4faff', '#6ab4f4', '#ffffff'],
    extra: () => { for (const [x, y, w] of [[8, 20, 14], [40, 22, 18], [74, 19, 12]] as const) { rect(x, y, w, 3, '#eaf4fc'); rect(x, y + 3, w, 1, '#5a88b8'); } } }),
  shingle: coastScene({ sky: ['#1e1030', '#3c3256', '#6a6a80', '#a09a90'], lip: '#c0bab0', sea: ['#142a6a', '#22408a', '#2a5aa8', '#d0d8e8'], sand: ['#a09a90', '#8e887e', '#7e786e'], line: '#8a847a', pad: '#2a2c34', shell: ['#c0bab0', '#2a2c34', '#e8ecf0'],
    extra: () => { for (let k = 0; k < 7; k++) { const x = 4 + k * 13, y = 32 + (k % 3) * 7; line(x, y + 6, x + 9, y, '#6a7080'); line(x + 1, y + 6, x + 10, y, '#c0bab0'); } } }),
  longway: coastScene({ sky: ['#0e0828', '#2a1e54', '#6a4a9a', '#c8a0d8'], lip: '#e0d0ec', sea: ['#221e78', '#2e3a98', '#3a5ab0', '#e8e0ff'], sand: ['#c8b0d8', '#b69ec8', '#a48cb8'], line: '#b8a0cc', pad: '#2a1e44', shell: ['#e0d0ec', '#9a58e4', '#fffbe8'],
    extra: () => { galaxy(70, 6, 7, '#9a58e4', '#fff4c4'); } }),
  brookwood: woodScene({ sky: ['#1a1840', '#2a4a5a', '#4a7a5a'], trunk: '#3a2a1a', leaf: '#3a8a3a', leaf2: '#1a4a20', ground: ['#6aa850', '#5a9844', '#4a8838'], line: '#7ab858', pad: '#1a4a20', light: '#f4fae0',
    extra: () => { rect(0, 44, W, 3, '#3aa8d0'); rect(0, 44, W, 1, '#f4fae0'); } }),
  highwater: woodScene({ sky: ['#24164a', '#3a3a6a', '#6a6a7a'], trunk: '#3e2a18', leaf: '#4a7a4a', leaf2: '#1e3e2a', ground: ['#c8b07a', '#b69c66', '#a48a54'], line: '#c0a870', pad: '#3e2a18', light: '#fff8ec',
    extra: () => { for (let x = 0; x < W; x += 7) rect(x, 30 + (x % 3), 5, 1, '#8a6a4a'); } }),
  shoutwood: woodScene({ sky: ['#141038', '#1e3a48', '#3a6a5a'], trunk: '#1e2a30', leaf: '#2a7a5a', leaf2: '#10402e', ground: ['#5a9a7a', '#4c8a6c', '#3e7a5e'], line: '#6aa888', pad: '#10402e', light: '#ecf6f2' }),
  gatering: woodScene({ sky: ['#0c1430', '#1a2a4a', '#2a3a5a'], trunk: '#2a2420', leaf: '#2a5a3a', leaf2: '#102a1a', ground: ['#3a6a4a', '#325e40', '#284e36'], line: '#4a7a5a', pad: '#102a1a', light: '#74f4e4',
    extra: () => { rect(30, 0, 36, 22, '#2a2440'); dither(30, 0, 36, 22, '#3a3460', 0.5); rect(30, 0, 1, 22, '#1a1820'); rect(65, 0, 1, 22, '#1a1820'); } }),
} as Record<string, Scene>);


/** A point on the sky's seam over the Auger's point, a turns along it from the middle. */
function seamAt(a: number): [number, number] {
  const r = 1 + a * 2.7;
  return [Math.round(64 + Math.cos(a + 1) * r * 1.5), Math.round(12 + Math.sin(a + 1) * r * 0.55)];
}

/** One pixel in two on the Bayer grid, for half-tone lines. */
function on2(x: number, y: number): boolean { return BAY[(y & 3) * 4 + (x & 3)] < 8; }

/** Which backdrop a map uses: by map id first, then by its zone area, then by region. */
const BY_MAP: Record<string, string> = {
  fellside: 'fellside', route1: 'tanning', rib: 'rib', ribgym: 'ribgym', route2: 'drysea', mast: 'mast',
  route3: 'marsh', spire: 'spire', spirecrypt: 'spiregym', spiregym: 'spiregym', route4: 'understory', bole: 'bole',
  bolegym: 'understory', route5: 'machines', hum: 'hum', pylon: 'pylon', route6: 'tundra', tusk: 'tusk',
  route7: 'hiltroad', peelhouse: 'peelhouse', moonwater: 'moonwater', hilt: 'hilt', hiltgym: 'indoor',
  route8: 'crater', fall: 'fall', fallgym: 'fallgym', climb: 'climb', crown: 'climb', slack: 'slack',
  oldrind: 'oldrind', stack: 'stack',
  undermeadow: 'undermeadow', knucklebones: 'knucklebones', wrecks: 'wrecks', shoreline: 'shoreline',
  underspire: 'underspire', rootfall: 'rootfall', skinfall: 'skinfall', iceshelf: 'iceshelf',
  battlefield: 'battlefield', moonbed: 'moonbed', glassdesert: 'glassdesert', handsorchard: 'handsorchard', margin: 'margin',
  outerwhorl: 'outerwhorl', wrack: 'wrack', sanddollar: 'sanddollar', doves: 'doves', flats: 'flats',
  cowrieback: 'cowrieback', polish: 'polish', underteeth: 'underteeth', glazehalls: 'polish', glosshall: 'glosshall',
  augerdune: 'auger', augermouth: 'augerin', augerroll: 'augerin', augerstair: 'augerin', turnwisegym: 'augerin', augerpoint: 'augerpoint',
  lowline: 'lowline', livingchamber: 'nautilus', oldchambers: 'nautilus', tidechamber: 'tidechamber', siphuncle: 'nautilus',
  springlow: 'springlow', longstrand: 'longstrand', tray: 'tray', hollowtop: 'hollowtop', mudlarkyard: 'tray', oldapex: 'oldapex',
  conchlip: 'conch', conchpink: 'conchin', conchturn: 'conchin', conchroar: 'conchroar', conchmouth: 'conchmouth',
  cocklecove: 'cocklecove', saltings: 'saltings', kelpbeds: 'kelpbeds', gantry: 'gantry', floes: 'floes', shingle: 'shingle', longway: 'longway',
  brookwood: 'brookwood', highwater: 'highwater', shoutwood: 'shoutwood', gatering: 'gatering',
  geodemouth: 'geode', geodehall: 'geode', geodevein: 'geode', geodeheart: 'geode',
};
const BY_REGION = ['fellside', 'rib', 'drysea', 'marsh', 'understory', 'machines', 'tundra', 'hiltroad', 'crater', 'climb', 'slack', 'indoor',
  'undermeadow', 'knucklebones', 'wrecks', 'shoreline', 'underspire', 'rootfall', 'skinfall', 'iceshelf', 'battlefield', 'moonbed', 'glassdesert', 'handsorchard', 'margin',
  'wrack', 'sanddollar', 'polish', 'augerin', 'nautilus', 'tray', 'conchin', 'outerwhorl'];

export function backdropKey(mapId: string, region: number, indoor: boolean): string {
  if (BY_MAP[mapId]) return BY_MAP[mapId];
  if (indoor) return 'indoor';
  return BY_REGION[region] || 'fellside';
}

/** Registers or replaces a backdrop. New areas add theirs here. The painter runs every frame and draws straight onto the target after the night pass. */
export function defBackdrop(key: string, paint: Painter, maps: string[] = []): void {
  P[key] = { base: () => {}, over: paint };
  bases.clear();
  for (const m of maps) BY_MAP[m] = key;
}

// ---------------------------------------------------------------- the night pass

/** A still part with the unlit and lit form of every pixel and the light of its own lamps. */
interface Base {
  src: Uint32Array;
  kind: Uint8Array;
  dim: Uint32Array;
  lit: Uint32Array;
  L: Float32Array;
  TL: Float32Array;
  TC: Uint8Array;
  V: Float32Array;
  hz: number;
  sea: number;
  open: boolean;
  cols: [string, string, string];
  sky: Sky;
  map: MapDef;
  /** How far the sky's lightness is scaled down, so a pale sky still reads as night. */
  sk: number;
  memo: Map<number, [number, number]>;
  /** The still part's lamps, kept as points for the fighters. */
  lamps: Lamp[];
  /** The back light by rule, and which pixels take its shimmer, built on first use. */
  back?: BackLight;
  pw?: Float32Array;
  /** The pixels of shapes the moon rims from behind, built on first use. */
  rim?: Uint8Array;
  /** The still part sunk to `deepAt` of its dim lightness, built on first use. */
  deepAt?: number;
  deepD?: Uint32Array;
}

/** The still part of each scene, painted once per key, evening, number of loosened Stays, and map. */
const bases = new Map<string, Base>();

/** Sky pixels are scaled so the palest shows at about this lightness unlit, about the field's night past the map edge plus a glow at the horizon. */
const SKY_TOP = 0.3;

const u32 = (rgb: number) => (0xff000000 | ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 255)) >>> 0;
const rgbOf = (u: number) => ((u & 255) << 16) | (u & 0xff00) | ((u >>> 16) & 255);
const INK32 = u32(parseInt(INK.slice(1), 16));

const formCache = new WeakMap<Sky, Map<number, [number, number]>>();
/** The unlit and lit form of a color under a sky, as image words. */
function forms(rgb: number, sky: Sky): [number, number] {
  let m = formCache.get(sky);
  if (!m) { m = new Map(); formCache.set(sky, m); }
  let f = m.get(rgb);
  if (!f) {
    const [d, l] = twoHues(rgb, sky);
    f = [u32(d), u32(l)];
    m.set(rgb, f);
  }
  return f;
}

/** A sky pixel's two forms: its unlit hue scaled toward night, and its plain unlit hue where a light shines on it. */
function skyForms(rgb: number, b: Base): [number, number] {
  let f = b.memo.get(rgb);
  if (!f) {
    const [d] = twoHues(rgb, b.sky);
    const [L, a, bb] = toLab(d);
    const s = b.sk, c = 0.5 + 0.5 * s;
    f = [u32(fromLab(L * s, a * c, bb * c)), u32(d)];
    b.memo.set(rgb, f);
  }
  return f;
}

const tintCache = new Map<number, number>();
/** A lit color leaned toward a light's tint, brighter where the tint is brighter. */
function tinted(lit: number, ti: number): number {
  const key = rgbOf(lit) * 256 + ti;
  let v = tintCache.get(key);
  if (v === undefined) {
    const [L, a, b] = toLab(rgbOf(lit));
    const [tL, ta, tb] = tintLabs[ti];
    const pw = tintPow[ti], k = 0.35 + 0.15 * pw;
    v = u32(fromLab(Math.min(1, L + Math.max(0, tL - L) * (0.2 + 0.4 * pw) + 0.08 * pw), a + (ta - a) * k, b + (tb - b) * k));
    tintCache.set(key, v);
  }
  return v;
}

/** A map that uses this backdrop, for its sky when no map is given. */
const repMaps = new Map<string, MapDef>();
function mapFor(key: string, id?: string): MapDef {
  if (id && MAPS[id]) return MAPS[id];
  let m = repMaps.get(key);
  if (!m) {
    const r = BY_REGION.indexOf(key);
    const byId = Object.keys(BY_MAP).find(k => BY_MAP[k] === key && MAPS[k]);
    m = (byId && MAPS[byId]) || Object.values(MAPS).find(x => x.region === r) || ({ id: key, region: Math.max(0, r), rows: ['.'], npcs: [] } as unknown as MapDef);
    repMaps.set(key, m);
  }
  return m;
}

function baseFor(key: string, sc: Scene, map: MapDef, sk: Sky): Base {
  const bk = `${key}|${S.dusk}|${S.loose}|${map.id}`;
  const had = bases.get(bk);
  if (had) return had;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  T = g;
  kinds = new Uint8Array(N);
  tag = THING;
  lampList = [];
  hz = H; sea = -1;
  starCols = ['#ffffff', '#fff4c4', '#ffd04a'];
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  sc.base();
  drawStages();
  const kind = kinds;
  // The evening scene adds a few faint stars wherever there is sky.
  if (S.dusk > 0) paintAs(STAR, () => { for (let k = 0; k < 24; k++) { const x = Math.floor(hash(key.length * 1013 + k) * W), y = Math.floor(hash(key.length * 2027 + k) * 20); if (kind[y * W + x] === SKY) px(x, y, k & 1 ? '#fffbe8' : '#b4d0ec'); } });
  const painted = lampList!;
  kinds = null; lampList = null;
  const src = new Uint32Array(g.getImageData(0, 0, W, H).data.buffer);
  let top = 0, open = 0;
  for (let i = 0; i < N; i++) if (kind[i] === SKY) { open++; top = Math.max(top, toLab(twoHues(rgbOf(src[i]), sk)[0])[0]); }
  const b: Base = {
    src, kind, dim: new Uint32Array(N), lit: new Uint32Array(N),
    L: new Float32Array(N), TL: new Float32Array(N), TC: new Uint8Array(N), V: new Float32Array(N),
    hz, sea, open: open > 60, cols: starCols, sky: sk, map, sk: top > SKY_TOP ? SKY_TOP / top : 1, memo: new Map(), lamps: [],
  };
  for (let i = 0; i < N; i++) {
    const rgb = rgbOf(src[i]);
    const f = kind[i] === SKY ? skyForms(rgb, b) : forms(rgb, sk);
    b.dim[i] = f[0]; b.lit[i] = f[1];
  }
  darkNow = !!map.dark;
  LIT.fill(0); TLIT.fill(0); TCOL.fill(0); VIS.fill(0);
  // Under open sky only a pale glow in the sky (a moon, a galaxy) stays, unless the scene has a real light. Indoors and in caves every lamp stays.
  b.lamps = painted.filter(l => !b.open || REAL_LIGHTS.has(key) || (l.y < b.hz && (l.tint < 0 || tintLabs[l.tint][0] > 0.85)));
  for (const l of b.lamps) pool(l.x, l.y, l.r, l.lv, l.sq, l.tint);
  b.L.set(LIT); b.TL.set(TLIT); b.TC.set(TCOL); b.V.set(VIS);
  bases.set(bk, b);
  return b;
}

// ---------------------------------------------------------------- falling stars

interface Faller { t0: number; x: number; y: number; sx: number; sy: number; size: number; fall: number; wet: boolean }
interface Landed { t0: number; x: number; y: number; size: number; life: number; reach: number; wet: boolean }
/** A scene's stars. `heard` is the last frame whose falls and landings made a sound, so stars caught up in one go stay quiet. */
interface Fall { last: number; t: number; stars: Faller[]; glows: Landed[]; heard: number }
const falls = new Map<string, Fall>();

/** Frames a star takes to fall, by size, and its light's reach and life as a share of the sky's, as on the field. */
const FALL_T = [16, 22, 26, 34];
const REACH = [0.4, 0.8, 1.15, 1.6];
const LIFE = [0.35, 0.8, 1.1, 1.5];
const TAIL = [1, 3, 5, 9];

/** The battle view's two status panels in scene pixels, where a landing would not be seen. */
const PANELS = [[1, 7, 53, 24], [43, 36, 95, 53]];

/** Stars per minute in this scene now: the sky's rate, none without open sky, and up to twice as many as the battle nears its end. */
function rateNow(b: Base): number {
  return b.open ? starsPerMinute(b.map, b.sky, S.dusk) * (1 + (S.heat || 0)) : 0;
}

function tickFall(f: Fall, b: Base, t: number, rate: number): void {
  if (rate <= 0) f.last = t;
  else if (t - f.last > 3600 / rate * (0.5 + hash(f.last * 5 + 7))) {
    f.last = t;
    for (let k = 0; k < 4; k++) {
      const h1 = hash(t * 3 + 1 + k * 101), h2 = hash(t * 7 + 2 + k * 211);
      const x = 2 + Math.floor(h1 * (W - 4)), y = Math.min(H - 2, b.hz + 1 + Math.floor(Math.sqrt(h2) * (H - b.hz - 2)));
      const kd = b.kind[y * W + x];
      if ((kd !== GROUND && kd !== WATER) || PANELS.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
      const [lo, hi] = b.sky.size;
      const size = Math.min(hi, lo + Math.floor(hash(t * 11 + 5) ** 2 * (hi - lo + 1)));
      const side = hash(t) < 0.5 ? -1 : 1;
      const sy = Math.min(b.hz - 5, y - 22 - 6 * size - Math.floor(h2 * 10));
      f.stars.push({ t0: t, x, y, sx: x + side * (6 + 3 * size + Math.floor(h1 * 8)), sy, size, fall: FALL_T[size], wet: kd === WATER });
      break;
    }
  }
  for (let i = f.stars.length - 1; i >= 0; i--) {
    const s = f.stars[i];
    if (t - s.t0 < s.fall) continue;
    f.stars.splice(i, 1);
    const depth = 0.5 + 0.5 * (s.y - b.hz) / Math.max(1, H - b.hz);
    f.glows.push({ t0: t, x: s.x, y: s.y, size: s.size, life: Math.round(b.sky.life * LIFE[s.size]), reach: b.sky.reach * REACH[s.size] * 0.5 * depth, wet: s.wet });
  }
  for (let i = f.glows.length - 1; i >= 0; i--) if (t - f.glows[i].t0 >= f.glows[i].life) f.glows.splice(i, 1);
}

/** Brings a scene's stars up to now. A new scene starts with a few seconds of stars already fallen. */
function starfall(key: string, b: Base): Fall {
  let f = falls.get(key);
  if (!f || S.t < f.t || S.t - f.t > 600) {
    f = { last: S.t - 300, t: S.t - 300, stars: [], glows: [], heard: S.t };
    falls.set(key, f);
  }
  const rate = rateNow(b);
  for (let t = f.t + 1; t <= S.t; t++) tickFall(f, b, t, rate);
  f.t = S.t;
  // Only the last few frames sound, and a star that fell and landed in that time only lands.
  const fresh = (t0: number) => t0 > f!.heard && S.t - t0 < 4;
  for (const st of f.stars) if (fresh(st.t0)) battleStarNoise('fall', st.x, st.size);
  for (const g of f.glows) if (fresh(g.t0)) { battleStarNoise(g.wet ? 'splash' : 'land', g.x, g.size); scatterB(g.x, g.y, g.size, g.wet, g.t0); backdropStats.landed = [g.x, g.y, S.t]; }
  f.heard = S.t;
  return f;
}

/** A battle star's sound, placed left or right by where it lands in the scene. */
function battleStarNoise(kind: 'fall' | 'land' | 'splash', x: number, size: number): void {
  starSound(kind, { size, pan: Math.max(-1, Math.min(1, x / (W / 2) - 1)), vol: 0.7 * (0.55 + 0.15 * size) });
}

// ---------------------------------------------------------------- glitter

/** One speck of a star's glitter on the scene's grid, with a height above the ground. `kind` 0 is flying out from a landing, 1 is rising like fizz, 2 has settled. */
interface BSpeck { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; kind: number; col: number; per: number; ph: number; bright: boolean; wet: boolean }
const bspecks: BSpeck[] = [];
/** Most specks alive at once in a scene. */
const BSPECK_CAP = 70;
let bspeckKey = '', bspeckT = -1;

/** A landing's glitter in a scene: a burst that drifts out and up, then settles, and a few specks that rise like fizz. */
function scatterB(x: number, y: number, size: number, wet: boolean, t: number): void {
  const burst = 3 + size * 3, fizz = 1 + size;
  for (let k = 0; k < burst + fizz && bspecks.length < BSPECK_CAP; k++) {
    const h1 = hash(t * 131 + k * 17), h2 = hash(t * 71 + k * 29 + 5), h3 = hash(t * 37 + k * 53 + 9);
    const rising = k >= burst, a = h1 * Math.PI * 2, sp = (0.15 + 0.25 * h2) * (1 + size * 0.2) * (wet ? 0.6 : 1);
    bspecks.push({
      x: x + (rising ? (h2 - 0.5) * 4 : 0), y, z: rising && wet ? -1 : rising ? 0 : 0.5,
      vx: rising ? 0 : Math.cos(a) * sp, vy: rising ? 0 : Math.sin(a) * sp * 0.4, vz: rising ? 0.12 + 0.12 * h3 : (0.25 + 0.3 * h3) * (wet ? 0.5 : 1),
      age: 0, life: rising ? 30 + Math.floor(h2 * 40) : 220 + Math.floor(h3 * 240), kind: rising ? 1 : 0,
      col: Math.floor(h3 * 3), per: 90 + Math.floor(h1 * 120), ph: Math.floor(h2 * 200), bright: h1 < 0.15, wet,
    });
  }
}

/** Moves and draws the scene's glitter on the glow layer: flying specks slow and sink, fizz wobbles up and winks out, settled specks twinkle and fade. No speck covers a slough or summon. */
function glitterB(key: string, b: Base, figs: SceneFigure[]): void {
  if (key !== bspeckKey) { bspecks.length = 0; bspeckKey = key; }
  if (!bspecks.length) { bspeckT = S.t; return; }
  const steps = bspeckT < 0 ? 1 : Math.max(0, Math.min(4, S.t - bspeckT));
  bspeckT = S.t;
  for (let n = 0; n < steps; n++) for (let i = bspecks.length - 1; i >= 0; i--) {
    const k = bspecks[i];
    k.age++;
    if (k.kind === 0) {
      k.x += k.vx; k.y += k.vy; k.z += k.vz;
      k.vx *= 0.93; k.vy *= 0.93;
      k.vz = Math.max(-0.06, k.vz - 0.02);
      if (k.z <= 0 && k.vz < 0) { k.z = 0; k.kind = 2; }
    } else if (k.kind === 1) {
      k.z += k.vz;
      k.x += Math.sin((k.age + k.ph) / 5) * 0.12;
    } else if (k.wet) k.x += Math.sin((S.t + k.ph) / 40) * 0.03;
    if (k.age >= k.life) bspecks.splice(i, 1);
  }
  const [hi, a, x3] = b.cols, cols = [hi, a, x3];
  for (const k of bspecks) {
    const x = Math.round(k.x), y = Math.round(k.y - k.z);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
    if (figs.some(f => x >= f.x && x < f.x + 8 && y >= f.y && y < f.y + 8)) continue;
    const left = 1 - k.age / k.life, cyc = (S.t + k.ph) % k.per;
    let on = true, peak = false;
    // In battle nothing blinks: fizz goes out at the end of its life, and settled specks glow for most of a slow cycle.
    if (k.kind === 2) { on = cyc < k.per * 0.7 * Math.min(1, left * 1.5); peak = k.bright && cyc > k.per * 0.2 && cyc < k.per * 0.4 && left > 0.4; }
    if (!on) continue;
    const c = cols[k.col];
    if (peak) { px(x, y, '#ffffff'); px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); }
    else px(x, y, k.bright && k.kind !== 2 ? hi : c);
  }
}

function headAt(s: Faller, age: number): [number, number] {
  const f = (age + 1) / s.fall;
  return [Math.round(s.sx + (s.x - s.sx) * f), Math.round(s.sy + (s.y - s.sy) * f)];
}

function fallLights(f: Fall): void {
  toStar = true;
  for (const s of f.stars) { const [hx, hy] = headAt(s, S.t - s.t0); pool(hx, hy, 1.5 + s.size, 1.6, 1, -1); }
  for (const g of f.glows) {
    const age = S.t - g.t0, hold = g.life * 0.12;
    // The light holds for a moment, then its solid middle shrinks and its dithered edge creeps inward.
    const k = age < hold ? 1 : 1 - (age - hold) / (g.life - hold);
    const flash = age < 4 ? 1.25 : 1;
    pool(g.x, g.y, g.reach * (0.55 + 0.45 * k) * flash, 3 * k * flash, 2, -1);
  }
  toStar = false;
}

function drawFall(f: Fall, b: Base): void {
  const [hi, a, x3] = b.cols;
  for (const s of f.stars) {
    const age = S.t - s.t0;
    const [hx, hy] = headAt(s, age);
    const dx = s.sx - s.x, dy = s.sy - s.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const n = TAIL[s.size];
    for (let k = n; k >= 1; k--) {
      if (k > n / 2 && (k + age) % 2) continue;
      px(Math.round(hx + ux * k), Math.round(hy + uy * k), k <= n * 0.3 ? hi : k <= n * 0.7 ? a : x3);
    }
    px(hx, hy, s.size === 3 ? '#ffffff' : hi);
    if (s.size >= 2) { px(hx + 1, hy, a); px(hx - 1, hy, a); px(hx, hy - 1, a); px(hx, hy + 1, a); }
    // A star over water shows upside down below the waterline, rising to meet it.
    if (b.sea >= 0 && hy < b.sea && hx >= 0 && hx < W) {
      const ry = 2 * b.sea - hy;
      if (ry < H && b.kind[ry * W + hx] === WATER) { px(hx, ry, a); if (s.size >= 2) px(hx, ry - 1, x3); }
    }
  }
  for (const g of f.glows) {
    const age = S.t - g.t0, life = 1 - age / g.life;
    const arm = 1 + g.size;
    if (age < 4) for (let k = -arm + (age >> 1); k <= arm - (age >> 1); k++) { px(g.x + k, g.y, hi); if (Math.abs(k) <= arm >> 1) px(g.x, g.y + k, hi); }
    if (g.wet) {
      // A star that falls in water sends out a ripple and goes out.
      const r = 1 + age * 0.12;
      if (life > 0.4 && r < 7) for (let q = 0; q < 12; q++) if ((q + (age >> 2)) % 2) px(Math.round(g.x + Math.cos(q / 6 * Math.PI) * r), Math.round(g.y + Math.sin(q / 6 * Math.PI) * r * 0.4), hi);
      continue;
    }
    // The fallen star keeps a little shine until its light is gone.
    if (g.size === 0) { if (life > 0.5) px(g.x, g.y, hi); continue; }
    px(g.x, g.y, hi);
    if (g.size >= 2 && ((age >> 2) % 3 !== 0 || life > 0.5)) { px(g.x - 1, g.y, a); px(g.x + 1, g.y, a); }
  }
}

// ---------------------------------------------------------------- the frame

/** The finished frame is written here as pixels and put on screen in one upload. */
let outG: CanvasRenderingContext2D | null = null;
let outImg: ImageData | null = null;
let outU: Uint32Array | null = null;

/** Cost of the last backdrop frame in milliseconds, a running average, the falling stars, landed stars, and glitter specks on screen, and where and when the last star landed, for the debug handle. */
export const backdropStats = { ms: 0, avg: 0, stars: 0, glows: 0, specks: 0, landed: [0, 0, -1] };

/** Paints the scene for this key into the current target, which must be SCENE_W by SCENE_H. */
export function paintBackdrop(key: string, st: SceneState): void {
  const t0 = performance.now();
  S = st;
  const out = ctx;
  if (!outG) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    outG = cv.getContext('2d', { willReadFrequently: true })!;
    outImg = outG.createImageData(W, H);
    outU = new Uint32Array(outImg.data.buffer);
    const dbg = (window as any).__slough;
    if (dbg) Object.assign(dbg, { backdropStats, BACKS });
  }
  const sc = P[key] || P.fellside;
  const map = mapFor(key, st.map);
  const sk = skyFor(map, st.dusk);
  const b = baseFor(key, sc, map, sk);
  lastBase = b; lastKey = key; lastLights = st.lights || [];
  darkNow = !!map.dark;
  LIT.set(b.L); TLIT.set(b.TL); TCOL.set(b.TC); VIS.set(b.V); STARL.fill(0);
  const f = starfall(`${key}|${map.id}`, b);
  fallLights(f);
  // Move lights shade the sloughs rather than the ground, except a light that travels, which lights a small disc round itself.
  for (const l of lastLights) if (l.core) crispDisc(l.x, l.y, 3, l.tint ? tintOf(l.tint, true) : -1);
  const bl = backOf(key, b), bt = tintOf(bl.tint), rim = rimOf(b, bl);
  animLamps = !b.open || REAL_LIGHTS.has(key);
  const dD = deepOf(b, BACK_DARK), plain = tintOf(LAMP);
  lightPath(b, bl, st.t);
  SHDV.fill(0); CUT.fill(0);
  backShadows(st.figures || [], b, bl, key);
  // The moving part draws over a copy of the still part, and lamps it lights join this frame's light.
  // Glowing things, falling stars, and the middles of travelling lights go on the glow layer, which keeps its lit colors.
  WORLD.set(b.src);
  mode = 1; inAnim = true;
  if (sc.anim) sc.anim();
  inAnim = false; mode = 2;
  drawFall(f, b);
  glitterB(`${key}|${map.id}`, b, st.figures || []);
  for (const l of lastLights) if (l.core) { const c = l.tint || '#ffffff'; px(l.x, l.y, '#ffffff'); px(l.x - 1, l.y, c); px(l.x + 1, l.y, c); px(l.x, l.y - 1, c); px(l.x, l.y + 1, c); }
  mode = 0;
  const o = outU!, bs = b.src, src = WORLD, dark = darkNow;
  for (let y = 0, i = 0; y < H; y++) {
    const br = (y & 3) * 4;
    for (let x = 0; x < W; x++, i++) {
      const g = GLOW[i];
      if (g) { o[i] = g; GLOW[i] = 0; continue; }
      const th = BAY[br + (x & 3)], pa = PATH[i];
      // Ink keeps its own color under every light, as it does on the field.
      if (src[i] === INK32 || (dark && VIS[i] <= th && !pa)) { o[i] = INK32; continue; }
      let lt = b.lit[i], dm = b.dim[i];
      if (src[i] !== bs[i]) { const fm = b.kind[i] === SKY ? skyForms(rgbOf(src[i]), b) : forms(rgbOf(src[i]), sk); dm = fm[0]; lt = fm[1]; }
      // Lamps and move lights take their own color, the path's glints and starlight the lit form, and the rest sinks below its dim form, darker under each shadow.
      const moved = src[i] !== bs[i], sv = SHDV[i], cut = CUT[i] === 1;
      const night = moved ? deep(dm, BACK_DARK) : dD[i];
      // The moon and other lights painted in the sky keep their own glow.
      const kd = b.kind[i];
      if (kd === SKY || kd === STAR) { o[i] = TLIT[i] > th ? tinted(lt, TCOL[i]) : LIT[i] > th || STARL[i] > th ? lt : night; continue; }
      o[i] = TLIT[i] > th && !cut ? lampWord(lt, night, TCOL[i], core(TLIT[i], th))
        : pa === 3 ? dm : rim[i] && !sv ? tinted(lt, bt) : STARL[i] > th ? lt
        : LIT[i] > th && !cut ? lampWord(lt, night, plain, core(LIT[i], th))
        : sv ? deep(dm, BACK_DARK * (1 - SHADE_STEP * Math.min(1.5, Math.round(sv * 4) / 4))) : night;
    }
  }
  outG.putImageData(outImg!, 0, 0);
  out.drawImage(outG.canvas, 0, 0);
  T = out;
  if (sc.over) sc.over();
  const ms = performance.now() - t0;
  Object.assign(backdropStats, { ms, avg: backdropStats.avg * 0.95 + ms * 0.05, stars: f.stars.length, glows: f.glows.length, specks: bspecks.length });
}

// ---------------------------------------------------------------- shadows

/** How flat the ground lies under a move flash's shadow. */
const SHADOW_FLAT = 2.2;

let lastKey = '';
let lastLights: SceneLight[] = [];
/** This frame's shadows: how much darkness falls on each pixel (shadows that overlap add up), and where a lamp's shadow blocks lamp light. */
const SHDV = new Float32Array(N), CUT = new Uint8Array(N);

/** A small solid disc of tinted light with a checker edge, under a light that travels. */
function crispDisc(cx: number, cy: number, r: number, tint: number): void {
  for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(H - 1, Math.ceil(cy + r + 1)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(W - 1, Math.ceil(cx + r + 1)); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), i = y * W + x, v = d < r - 0.5 ? 16 : d < r + 0.5 ? 8 : 0;
      if (tint < 0) { if (v > LIT[i]) LIT[i] = v; }
      else if (v > TLIT[i]) { TLIT[i] = v; TCOL[i] = tint; }
    }
  }
}

/** Lays a figure's silhouette on the ground below the horizon, away from a light at sx, sy, `long` pixels long before the ground flattens it. `mark` gets each pixel and how far along the shadow it lies, from 0 to 1. */
function layShadow(solid: Uint8Array, foot: number, hc: number, fg: SceneFigure, sx: number, sy: number, long: number, b: Base, mark: (i: number, a: number) => void, flat = SHADOW_FLAT): void {
  const fx = fg.x + 4, gy = fg.ground - 0.5;
  let gx = fx - sx, gz = gy - sy;
  const n = Math.hypot(gx, gz);
  if (n < 1) return;
  gx /= n; gz /= n;
  // Along the shadow and across it, both as ground directions seen on screen.
  const vx = long * gx, vy = long * gz / flat;
  let ex = -gz, ez = gx;
  if (ex < 0 || (ex === 0 && ez < 0)) { ex = -ex; ez = -ez; }
  const wx = 4 * ex, wy = 4 * ez / flat;
  const det = vx * wy - vy * wx;
  if (Math.abs(det) < 1e-3) return;
  const xs = [fx - wx, fx + wx, fx + vx - wx, fx + vx + wx], ys = [gy - wy, gy + wy, gy + vy - wy, gy + vy + wy];
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const floor = Math.max(0, Math.min(b.hz, Math.floor(fg.ground) - 3));
  const y0 = Math.max(floor, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let Y = y0; Y <= y1; Y++) {
    for (let X = x0; X <= x1; X++) {
      const qx = X + 0.5 - fx, qy = Y + 0.5 - gy;
      const a = (qx * wy - qy * wx) / det, c = (vx * qy - vy * qx) / det;
      if (a < 0 || a >= 1 || c < -1 || c >= 1) continue;
      const row = foot - Math.floor(a * hc), col = Math.floor((c + 1) * 4);
      if (row < 0 || !solid[row * 8 + col]) continue;
      const i = Y * W + X, kd = b.kind[i];
      if (kd === SKY || kd === STAR || kd === WATER) continue;
      mark(i, a);
    }
  }
}

// ---------------------------------------------------------------- back light

/** The unlit scene keeps this share of its dim form's lightness, and a fighter's body this share of its lit lightness. */
const BACK_DARK = 0.55, BACK_FILL = 1.15;
const MOON = '#d8e4ff', LAMP = '#ffb860';

/** A scene's light behind the field: where it is in scene pixels, its color, optionally where its path meets the bottom of the scene, and whether it is near (a window or a shaft, whose shadows spread out from it) rather than a moon (whose shadows run parallel). */
export interface BackLight { x: number; y: number; tint: string; foot?: number; near?: boolean }

/** Back lights set by hand. Any other scene takes its pale moon, or else a moon or a lamp above and behind the foe's side. */
export const BACKS: Record<string, BackLight> = {
  fellside: { x: 84, y: 8, tint: '#fff4d8' },
  shoreline: { x: 70, y: 4, tint: '#d8e4ff' },
  indoor: { x: 62, y: 14, tint: '#ffd890', near: true },
  undermeadow: { x: 65, y: 12, tint: '#ecc470', near: true },
};

/** A shadow from the back light runs this long before the ground flattens it this much. */
const BACK_LONG = 30, BACK_FLAT = 1.5;

/** This frame's light path: 0 none, 1 a glint in the plain lit form, 2 a glint in the light's color. */
const PATH = new Uint8Array(N);

function backOf(key: string, b: Base): BackLight {
  const hand = BACKS[key];
  if (hand) return hand;
  if (b.back) return b.back;
  const up = b.lamps.filter(l => l.y < b.hz && (l.tint < 0 || tintLabs[l.tint][0] > 0.85)).sort((p, q) => q.r * q.lv - p.r * p.lv)[0];
  const x = 58 + Math.floor(hash(key.length * 977 + key.charCodeAt(0) * 31 + key.charCodeAt(key.length - 1)) * 30);
  b.back = up && b.open ? { x: up.x, y: up.y, tint: up.tint >= 0 ? tintHex[up.tint] : MOON }
    : { x, y: Math.max(3, b.hz - (b.open ? 14 : 10)), tint: b.open ? MOON : LAMP, near: !b.open };
  return b.back;
}

/** Which pixels take the light's shimmer: water, built on first use. */
function pathPrep(b: Base): void {
  if (b.pw) return;
  const pw = new Float32Array(N);
  for (let i = 0; i < N; i++) if (b.kind[i] === WATER) pw[i] = 1;
  b.pw = pw;
}

/** The light's reflection on water only: a few short glints in a band below the light, each fading in and out slowly through the ordered dither, close in value to the water. */
function lightPath(b: Base, bl: BackLight, t: number): void {
  pathPrep(b);
  PATH.fill(0);
  const pw = b.pw!, sx = bl.x;
  const col = Math.max(0, Math.min(W - 1, Math.round(sx)));
  let y0 = Math.max(0, Math.ceil(bl.y + 1));
  while (y0 < H && pw[y0 * W + col] === 0) y0++;
  if (y0 >= H - 1) return;
  const foot = bl.foot ?? MINE_AT[0] + 10, span = H - y0;
  for (let y = y0; y < H; y++) {
    const f = (y - y0) / span, c = sx + (foot - sx) * f, w = 3 + 18 * f;
    const off = Math.floor(hash(y * 53 + 7) * 5);
    for (let x = Math.max(0, Math.floor(c - w)); x <= Math.min(W - 1, Math.ceil(c + w)); x++) {
      const i = y * W + x;
      if (pw[i] < 1) continue;
      const cell = Math.floor((x + off) / 5), at = (x + off) % 5, h = hash(cell * 977 + y * 131);
      const across = 1 - Math.abs(x + 0.5 - c) / w;
      if (h > 0.3 * across * (1 - 0.4 * f) || at > 1 + Math.floor(h * 6)) continue;
      // Each glint swells and fades over about three seconds.
      const amp = 0.5 + 0.5 * Math.sin(t / 30 + hash(cell * 31 + y * 7) * 6.283);
      if (amp * 14 > BAY[(y & 3) * 4 + (x & 3)]) PATH[i] = 3;
    }
  }
}

/** Shapes rimmed by the moon from behind: each pixel of a shape (a house, a tree, a rock, not the ground) whose neighbor toward the light is sky. Built once a scene. */
function rimOf(b: Base, bl: BackLight): Uint8Array {
  if (b.rim) return b.rim;
  const rim = new Uint8Array(N), side = bl.x > W * 0.6 ? 1 : bl.x < W * 0.4 ? -1 : 0;
  const sky = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (b.kind[y * W + x] === SKY || b.kind[y * W + x] === STAR);
  for (let y = 1, i = W; y < H; y++) for (let x = 0; x < W; x++, i++) {
    if (b.kind[i] !== THING) continue;
    if (sky(x, y - 1) || (side && sky(x + side, y))) rim[i] = 1;
  }
  b.rim = rim;
  return rim;
}

/** The back light's shadow pixels for the last set of figures, kept while no figure moves. */
let shadowSig = '';
/** Each shadow pixel as three numbers: its index, how dark the shadow is, and 1 when a lamp casts it. */
let shadowPx: number[] = [];

/** Shadows from the back light or the lamp that reaches each figure most, long and sharp, cutting the light path out. The last 45 percent of each thins out through the ordered dither. */
function backShadows(figs: SceneFigure[], b: Base, bl: BackLight, key: string): void {
  const keep = (i: number, a: number): boolean => {
    if (a <= 0.55) return true;
    const x = i % W, y = (i / W) | 0;
    return BAY[(y & 3) * 4 + (x & 3)] >= (a - 0.55) / 0.45 * 16;
  };
  const sig = key + '|' + bl.x + ',' + bl.y + ',' + (bl.near ? 1 : 0) + '|' + figs.map(fg => `${fg.x},${fg.y},${fg.ground},${fg.flip ? 1 : 0},${fg.s.px.join('')}`).join(';');
  if (sig !== shadowSig) {
    shadowSig = sig;
    shadowPx = [];
    for (const fg of figs) {
      const m = lightMap(fg.s, fg.flip), hc = m.foot + 1 - m.top;
      const fx = fg.x + 4, gy = fg.ground - 0.5, ls = lightsAt(b, bl, fx, gy);
      // The back light always casts, and the two lamps that reach the figure most cast too, each as dark as its light is strong.
      const casting = [ls.find(l => !l.lamp)!, ...ls.filter(l => l.lamp).slice(0, 2)];
      for (const l of casting) {
        const lampy = l.lamp ? 1 : 0, dark = lampy ? Math.min(1, l.v / 1.2) : 1;
        const long = lampy ? Math.min(BACK_LONG, Math.max(4, hc * Math.hypot(fx - l.x, gy - l.y) / 10)) : BACK_LONG;
        layShadow(m.solid, m.foot, hc, fg, l.x, l.y, long, b, (i, a) => { if (keep(i, a)) shadowPx.push(i, dark, lampy); }, BACK_FLAT);
      }
    }
  }
  for (let j = 0; j < shadowPx.length; j += 3) {
    const i = shadowPx[j];
    SHDV[i] += shadowPx[j + 1];
    if (shadowPx[j + 2]) CUT[i] = 1;
    PATH[i] = 0;
  }
  // A flash near a figure, though not one that travels, throws a brief extra shadow away from itself.
  for (const fg of figs) {
    const cx = fg.x + 4, cy = fg.y + 4;
    let e: SceneLight | null = null;
    for (const l of lastLights) {
      const d = Math.hypot(l.x - cx, l.y - cy);
      if (!l.core && d > 6 && d < l.r * 4 && l.lv >= 0.8 && (!e || l.lv > e.lv)) e = l;
    }
    if (!e) continue;
    const m = lightMap(fg.s, fg.flip);
    layShadow(m.solid, m.foot, m.foot + 1 - m.top, fg, e.x, e.y, 7, b, (i, a) => { if (keep(i, a)) { SHDV[i] += 0.8; PATH[i] = 0; } });
  }
}

/** How strongly the back light reaches every figure, against a lamp's strength times how near its middle the figure stands. */
const BACK_V = 0.7;
/** Each full shadow takes this share of the dark ground's lightness, and overlapping shadows take more, up to one and a half times as much. */
const SHADE_STEP = 0.38;

/** The lights that reach a figure, strongest first: each lamp painted below the horizon whose lit disc covers the feet, and the back light, which always does. A far back light comes back as a point far along its one direction, so its shadows run parallel. */
function lightsAt(b: Base, bl: BackLight, fx: number, gy: number): { x: number; y: number; v: number; lamp: Lamp | null }[] {
  const out: { x: number; y: number; v: number; lamp: Lamp | null }[] = [];
  for (const l of b.lamps) {
    if (l.lv < 1.2 || l.y < b.hz - 2) continue;
    const d = Math.hypot(fx - l.x, (gy - l.y) * l.sq);
    if (d < l.r) out.push({ x: l.x, y: l.y, v: l.lv * (1 - d / l.r), lamp: l });
  }
  if (bl.near) out.push({ x: bl.x, y: bl.y, v: BACK_V, lamp: null });
  else {
    const dx = W / 2 - bl.x, dy = H * 0.65 - bl.y, n = Math.hypot(dx, dy) || 1;
    out.push({ x: fx - dx / n * 400, y: gy - dy / n * 400, v: BACK_V, lamp: null });
  }
  return out.sort((a, c) => c.v - a.v);
}

/** Whether a lamp's light this strong shows its bright middle: through a dither from 10 sixteenths, solid from 19, so a weak lamp still has a small bright core. */
const core = (v: number, th: number): boolean => v - 10 > th * 0.6;

const lampCache = new Map<number, number>();
/** A pixel in a lamp's light as an image word: in the bright middle its lit form, kept in its lightness order and leaned toward the lamp's color, and at the pool's edge its night form with a little of the lamp's color. */
function lampWord(lit: number, night: number, ti: number, core: boolean): number {
  const from = core ? lit : night, key = rgbOf(from) * 512 + ti * 2 + (core ? 1 : 0);
  let v = lampCache.get(key);
  if (v === undefined) {
    if (lampCache.size > 20000) lampCache.clear();
    const t = parseInt(tintHex[ti].slice(1), 16);
    v = u32(core ? lampCore(rgbOf(lit), t, tintPow[ti] ? 0.7 : 0.55) : lampEdge(rgbOf(night), t));
    lampCache.set(key, v);
  }
  return v;
}

const deepCache = new Map<number, number>();
/** A dim form sunk to a share k of its lightness, losing some chroma, so the scene's shapes still read at the darkest level. */
function deep(dm: number, k: number): number {
  const key = (dm >>> 0) * 128 + Math.round(k * 100);
  let v = deepCache.get(key);
  if (v === undefined) {
    if (deepCache.size > 20000) deepCache.clear();
    const [L, a, bb] = toLab(rgbOf(dm)), c = 0.5 + 0.5 * k;
    v = u32(fromLab(L * k, a * c, bb * c));
    deepCache.set(key, v);
  }
  return v;
}

function deepOf(b: Base, k: number): Uint32Array {
  if (b.deepAt !== k || !b.deepD) {
    b.deepD = new Uint32Array(N);
    for (let i = 0; i < N; i++) b.deepD[i] = deep(b.dim[i], k);
    b.deepAt = k;
  }
  return b.deepD;
}

const thinCache = new Map<number, number>();
/** A thin limb's tone: the fill of the body it joins, darker, so it shows against the dark ground without turning black. */
function thinWord(rgb: number): number {
  let v = thinCache.get(rgb);
  if (v === undefined) { v = u32(sunk(backFill(rgb, BACK_FILL), 0.7)); thinCache.set(rgb, v); }
  return v;
}

const fillCache = new Map<number, number>();
/** A fighter's body lit from behind: its own color darkened and cooled, in the same lightness order, so every shape of the sprite stays distinct. */
function fillOf(rgb: number, f: number): number {
  const key = rgb * 128 + Math.round(f * 100);
  let v = fillCache.get(key);
  if (v === undefined) {
    if (fillCache.size > 20000) fillCache.clear();
    v = u32(backFill(rgb, f));
    fillCache.set(key, v);
  }
  return v;
}

/** A fighter lit from behind: a dim fill for the body and a one-pixel rim on the edges that face its main light. Effect lights rim the side facing them, and the slough an effect sits on shows lit. */
function backFighter(s: SpriteData, m: LightMap, x: number, y: number, flip: boolean, b: Base): void {
  const u = figU!;
  const bl = backOf(lastKey, b), bt = tintOf(bl.tint);
  const cx = x + 4, cy = y + 4, ls = lightsAt(b, bl, cx, y + m.foot + 1), plain = tintOf(LAMP);
  const l1 = ls[0], l2 = ls[1] && ls[1].v >= 0.5 ? ls[1] : null;
  const dirOf = (l: { x: number; y: number }): [number, number] => { const d = Math.hypot(l.x - cx, l.y - cy) || 1; return [(l.x - cx) / d, (l.y - cy) / d]; };
  const d1 = dirOf(l1), d2 = l2 ? dirOf(l2) : null;
  const rimOf = (l: { lamp: Lamp | null }, lit: number) => l.lamp ? lampWord(lit, lit, l.lamp.tint >= 0 ? l.lamp.tint : plain, true) : tinted(lit, bt);
  let on: SceneLight | null = null;
  const effs: [number, number, number][] = [];
  for (const l of lastLights) {
    const d = Math.hypot(l.x - cx, l.y - cy);
    if (d < 6 && !l.core) { if (l.lv > 0.6 && (!on || l.lv > on.lv)) on = l; }
    else if (d < l.r * 4 && l.lv > 0.6) effs.push([(l.x - cx) / d, (cy - l.y) / d, l.tint ? tintOf(l.tint, true) : -1]);
  }
  const onTint = on?.tint ? tintOf(on.tint, true) : -1;
  const clear = (c: number, r: number) => c < 0 || c > 7 || r < 0 || r > 7 || !m.solid[r * 8 + c] || m.thin[r * 8 + c] === 1;
  const facing = (k: [number, number], c: number, r: number) => (k[1] < -0.3 && clear(c, r - 1)) || (k[1] > 0.3 && clear(c, r + 1)) || (Math.abs(k[0]) > 0.35 && clear(c + Math.sign(k[0]), r));
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const i = r * 8 + c;
    if (!m.solid[i]) { u[i] = 0; continue; }
    const ch = s.px[r][flip ? 7 - c : c];
    // Ink keeps its own color under every light, thin limbs included, as on the field.
    if (ch === '1') { u[i] = INK32; continue; }
    const rgb = pixelColor(s, ch);
    const lit = forms(rgb, b.sky)[1];
    let px: number;
    if (m.thin[i]) {
      // A thin limb takes a rim when it points toward a light, and otherwise a darker tone of the body it joins.
      const ox = m.nx[i], oy = -m.nz[i], n = m.next[i];
      px = ox * d1[0] + oy * d1[1] > 0.3 ? rimOf(l1, lit) : d2 && ox * d2[0] + oy * d2[1] > 0.3 ? rimOf(l2!, lit)
        : thinWord(n >= 0 ? pixelColor(s, s.px[n >> 3][flip ? 7 - (n & 7) : n & 7]) : rgb);
    } else if (facing(d1, c, r)) px = rimOf(l1, lit);
    else if (d2 && ((r + c) & 1) === 0 && facing(d2, c, r)) px = rimOf(l2!, lit);
    else px = fillOf(rgb, BACK_FILL);
    for (const [ex, ey, ti] of effs) if (m.nf[i] < 0.8 && m.nx[i] * ex + m.nz[i] * ey > 0.45) px = ti >= 0 ? tinted(lit, ti) : lit;
    if (on) px = m.nf[i] < 0.75 && onTint >= 0 ? tinted(lit, onTint) : lit;
    u[i] = px;
  }
}

// ---------------------------------------------------------------- fighters

/** A slough or summon as the battle view draws it this frame, in scene pixels: its top left, its facing, and the row its feet stand on. */
export interface SceneFigure { s: SpriteData; x: number; y: number; flip: boolean; ground: number }

/** The scene painted last, whose sky and lights the fighters take. */
let lastBase: Base | null = null;
let figG: CanvasRenderingContext2D | null = null;
let figImg: ImageData | null = null;
let figU: Uint32Array | null = null;

/** Draws a slough or summon lit by direction from this frame's scene lights. Call after paintBackdrop, in scene pixels. */
export function drawFighter(s: SpriteData, x: number, y: number, flip: boolean): void {
  const b = lastBase;
  if (!b) return;
  if (!figG) {
    const cv = document.createElement('canvas');
    cv.width = 8; cv.height = 8;
    figG = cv.getContext('2d')!;
    figImg = figG.createImageData(8, 8);
    figU = new Uint32Array(figImg.data.buffer);
  }
  const m = lightMap(s, flip);
  backFighter(s, m, x, y, flip, b);
  figG!.putImageData(figImg!, 0, 0);
  ctx.drawImage(figG!.canvas, Math.round(x), Math.round(y));
}

/** The color of one sprite pixel as 0xRRGGBB. */
function pixelColor(s: SpriteData, ch: string): number {
  const col = ch === '1' ? INK : ch === '2' ? s.c[0] : ch === '4' ? s.c[2] || s.c[1] : s.c[1];
  return parseInt(col.slice(1), 16);
}

export const BACKDROP_KEYS = (): string[] => Object.keys(P);

/** Paints six backdrops at once, two across, for reviewing art. */
export function contactSheet(page: number, st: SceneState, draw: (key: string, i: number) => void): void {
  const keys = BACKDROP_KEYS().slice(page * 6, page * 6 + 6);
  keys.forEach((k, i) => { S = st; draw(k, i); });
}
