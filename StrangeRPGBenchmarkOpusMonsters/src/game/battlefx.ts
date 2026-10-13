// Battle effects: a move's picture played from its plan, statuses on and around the sloughs, field states over the scene,
// and the kind icons. Pictures draw on the scene's own grid (96 by 60) in solid colors, fade through the ordered dither,
// and cast their light through the scene lights.
import { ctx, layer, rect, mix, INK } from '../engine/screen';
import { TYPE_COLOR, type Type } from '../data/types';
import type { SceneLight } from './backdrops';
import type { FxPlan } from './fxspec';
import { LEGEND_ART, type LegendArt } from './legendfx';
import { ART_A } from './moveart/a';
import { ART_B } from './moveart/b';
import { ART_C } from './moveart/c';

/** A move's own picture drawn in code: a legendary's, or a kind's from the move-art pass. */
export const artOf = (id?: string): LegendArt | undefined => (id ? LEGEND_ART[id] || ART_A[id] || ART_B[id] || ART_C[id] : undefined);

const SW = 96, SH = 60;
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Whether a pixel shows at a level from 0 to 1 of the ordered dither. */
const keep = (x: number, y: number, lv: number): boolean => lv >= 1 || BAY[((y & 3) << 2) | (x & 3)] < lv * 16;

/**
 * Each color and coverage as a scene-sized dithered sheet, made once. A pattern fill on the scene layer after the screen
 * has drawn from it costs about 20 microseconds a rectangle, while a copy from a finished sheet costs next to nothing.
 */
const sheets = new Map<string, HTMLCanvasElement>();

function sheetOf(c: string, steps: number): HTMLCanvasElement {
  let cv = sheets.get(c + steps);
  if (!cv) {
    const tile = document.createElement('canvas');
    tile.width = 4; tile.height = 4;
    const tg = tile.getContext('2d', { willReadFrequently: true })!;
    tg.fillStyle = c;
    for (let k = 0; k < 16; k++) if (BAY[k] < steps) tg.fillRect(k & 3, k >> 2, 1, 1);
    cv = document.createElement('canvas');
    cv.width = SW; cv.height = SH;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = g.createPattern(tile, 'repeat')!;
    g.fillRect(0, 0, SW, SH);
    sheets.set(c + steps, cv);
  }
  return cv;
}

/** The recoloring of the picture being drawn now (a fit's colors or a changed type), or null. */
let paint: ((c: string) => string) | null = null;

/** Ordered dither in the scene: covers `level` (0 to 1) of the area with color c, on the same 4 by 4 grid as px. */
export function dither(x: number, y: number, w: number, h: number, c: string, level: number): void {
  const steps = Math.max(0, Math.min(16, Math.ceil(level * 16)));
  if (steps === 0 || w <= 0 || h <= 0) return;
  if (paint) c = paint(c);
  if (steps === 16) { rect(x, y, w, h, c); return; }
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(SW, Math.round(x + w)), y1 = Math.min(SH, Math.round(y + h));
  if (x1 > x0 && y1 > y0) ctx.drawImage(sheetOf(c, steps), x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
}

let fadeRing = 0;

/** Draws `fn` with its origin at x, y in the scene, keeping `level` (0 to 1) of its pixels on the scene's dither grid. `fn` draws inside a w by h box. */
export function fadedScene(w: number, h: number, x: number, y: number, level: number, fn: () => void): void {
  const steps = Math.max(0, Math.min(16, Math.round(level * 16)));
  if (steps === 0) return;
  x = Math.round(x); y = Math.round(y);
  const mask = steps < 16 ? sheetOf('#ffffff', steps) : null;
  fadeRing = (fadeRing + 1) % 6;
  layer('fxfade' + fadeRing, w, h, x, y, 1, () => {
    ctx.clearRect(0, 0, w, h);
    fn();
    if (!mask) return;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, x & 3, y & 3, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }, true);
}

function px(x: number, y: number, c: string, lv = 1): void {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= SW || y >= SH || !keep(x, y, lv)) return;
  rect(x, y, 1, 1, paint ? paint(c) : c);
}

/** A line of single pixels from one point to another. */
function line(x0: number, y0: number, x1: number, y1: number, c: string, lv = 1, every = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i += every) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c, lv);
}

/** Small hashes for steady scatter. */
const hash = (n: number): number => {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
};
const ease = (u: number): number => u * u * (3 - 2 * u);

// ---------------------------------------------------------------- colors

/** A picture's tones from its color: a hot core, a light tone, the body, a dark edge, and an accent. */
export interface Tones { hot: string; light: string; body: string; edge: string; acc: string }
const toneCache = new Map<string, Tones>();

export function tonesOf(body: string, acc?: string): Tones {
  const key = body + (acc || '');
  let t = toneCache.get(key);
  if (!t) {
    t = { hot: mix(body, '#ffffff', 0.78), light: mix(body, '#ffffff', 0.42), body, edge: mix(body, INK, 0.5), acc: acc || mix(body, '#fff4c8', 0.55) };
    toneCache.set(key, t);
  }
  return t;
}

/** A plan's color word as a color: a '#rrggbb' as it is, or a type's color. */
export const colorOf = (c: string | null, fallback: string): string => (!c ? fallback : c[0] === '#' ? c : TYPE_COLOR[c as Type] || fallback);

// ---------------------------------------------------------------- runs

export interface FxPoint { x: number; y: number }
/** One thing in flight: when it leaves, how long it takes, which target it goes to, and its place among its fellows. */
interface Flight { t0: number; dur: number; to: number; i: number; n: number }
/** One landing: when it happens and at which target. */
interface Hit { at: number; to: number }

/** A move's picture as it plays: frames so far, the user's side and middle, where it lands, its timings, and how many landings the events have caught up with. */
export interface FxRun {
  plan: FxPlan;
  t: number;
  side: 0 | 1;
  from: FxPoint;
  to: FxPoint[];
  tone: Tones;
  seed: number;
  /** Size: 0 small, 1 plain, 2 big. */
  k: number;
  pace: number;
  motionAt: number[];
  motionLen: number[];
  contact: number;
  flights: Flight[];
  hits: Hit[];
  played: number;
  end: number;
  /** A legendary move's own picture, drawn with the spec's (legendfx.ts). */
  art?: LegendArt;
  /** Recolors the art's own colors for a fit user or a changed type (fitcolors.ts). The spec's parts already draw in `tone`. */
  paint?: (c: string) => string;
  /** Cast by a whorl visiting from the future in its time machine: its motion moves the rider there and no whorl on the field. */
  visit?: boolean;
}

const MOTION_LEN: Record<string, number> = { lunge: 12, hop: 10, shake: 8, spin: 10, lift: 12, sink: 12, recoil: 8, flare: 8, swell: 12, blink: 12, sway: 10, stomp: 12 };
/** Where in a motion it reaches the target. */
const CONTACT: Record<string, number> = { lunge: 0.45, stomp: 0.6, blink: 0.5 };
const PATH_LEN: Record<string, number> = { line: 11, arc: 14, wave: 14, zigzag: 12, spiral: 14, rain: 12, rise: 10, converge: 12, orbit: 16, sweep: 13, return: 16, ray: 3 };
const IMPACT_LEN: Record<string, number> = { flash: 10, ring: 14, splash: 16, shatter: 16, crack: 18, sparkle: 18, puff: 18, slash: 10, bite: 12, pillar: 16, sigil: 18, quake: 16, burst: 12, claw: 12, vortex: 18, bloom: 16, drip: 18, smoke: 18, fizz: 18, cinders: 18, daze: 18, frost: 16 };
/** Landings drawn under the sloughs, on the ground. */
const UNDER = new Set(['crack', 'sigil', 'quake']);
/** Frames from the first thing thrown to the last, however many there are: plain, then big. */
const SPREAD = [8, 10];

/** How long a landing plays at size k. */
const landLen = (w: string, k: number): number => Math.round((IMPACT_LEN[w] || 10) * (k === 2 ? 1.2 : k === 0 ? 0.85 : 1));

/** Starts a picture: the user at `from`, landing on each point of `to`, in a color and an accent. */
export function startRun(plan: FxPlan, side: 0 | 1, from: FxPoint, to: FxPoint[], color: string, accent: string | undefined, seed: number): FxRun {
  const k = plan.big ? 2 : plan.small ? 0 : 1;
  const pace = (plan.big ? 1.15 : plan.small ? 0.8 : 1) * (plan.fast ? 0.7 : plan.slow ? 1.35 : 1);
  const motionAt: number[] = [], motionLen: number[] = [];
  let t = 0, contact = -1;
  for (const m of plan.motion) {
    const len = Math.round(MOTION_LEN[m] * pace);
    motionAt.push(t); motionLen.push(len);
    if (contact < 0 && CONTACT[m] !== undefined) contact = t + Math.round(len * CONTACT[m]);
    t += len;
  }
  const flights: Flight[] = [], hits: Hit[] = [];
  const shape = plan.shape;
  // Things thrown leave while the last motion finishes. Without them the landing waits for the motion to end.
  const release = contact >= 0 ? contact : shape && t ? Math.round(t * 0.6) : t;
  if (shape) {
    const path = shape === 'beam' ? 'ray' : plan.path || 'line';
    const per = path === 'ray' ? 1 : plan.count;
    const stagger = per > 1 ? Math.max(1, Math.min(Math.round(4 * pace), Math.floor(SPREAD[k === 2 ? 1 : 0] / (per - 1)))) : 0;
    const dur = Math.round(PATH_LEN[path] * pace), share = path === 'return' ? 0.5 : path === 'sweep' ? SWEEP_AT : 1;
    // Every target gets its own volley at once, each a little behind the last.
    to.forEach((_, j) => {
      for (let i = 0; i < per; i++) {
        const t0 = release + i * stagger + j * 2;
        flights.push({ t0, dur, to: j, i, n: per });
        hits.push({ at: t0 + Math.round(dur * share), to: j });
      }
    });
  } else to.forEach((_, j) => hits.push({ at: release + (plan.motion.length ? 0 : 3) + j * 2, to: j }));
  hits.sort((a, b) => a.at - b.at);
  const land = Math.max(...plan.impact.map(w => landLen(w, k)), 10);
  let end = t;
  for (const f of flights) end = Math.max(end, f.t0 + f.dur + (plan.shape === 'beam' || plan.path === 'ray' ? 10 : 0));
  for (const h of hits) end = Math.max(end, h.at + land);
  // A legendary picture may build up first: the spec's own timeline then starts `lead` frames late.
  const art = artOf(plan.id), lead = art?.lead || 0;
  if (lead) {
    for (let i = 0; i < motionAt.length; i++) motionAt[i] += lead;
    for (const f of flights) f.t0 += lead;
    for (const h of hits) h.at += lead;
    if (contact >= 0) contact += lead;
    end += lead;
  }
  return { plan, t: 0, side, from, to, tone: tonesOf(color, accent), seed, k, pace, motionAt, motionLen, contact, flights, hits, played: 0, end: end + 2 + (art?.tail || 0), art };
}

/** The frame of the next landing the events have not caught up with, or -1. */
export function nextHit(r: FxRun): number { return r.played < r.hits.length ? r.hits[r.played].at : -1; }

// ---------------------------------------------------------------- the user's motion

/** How the user's sprite stands this frame: an offset, a turn, a size from its feet, how much of it shows, and whether it glows. */
export interface Pose { dx: number; dy: number; flip: boolean; k: number; vis: number; glow: boolean }

export function poseOf(r: FxRun): Pose {
  const p: Pose = { dx: 0, dy: 0, flip: false, k: 1, vis: 1, glow: false };
  const aim = r.to[0] || r.from, ax = aim.x - r.from.x, ay = aim.y - r.from.y, d = Math.hypot(ax, ay) || 1;
  r.plan.motion.forEach((m, i) => {
    const a = r.t - r.motionAt[i], len = r.motionLen[i];
    if (a < 0 || a >= len) return;
    const u = a / len;
    switch (m) {
      case 'lunge': {
        const c = CONTACT.lunge, f = u < c ? ease(u / c) : 1 - ease((u - c) / (1 - c));
        const reach = Math.max(0, d - 11);
        p.dx += ax / d * reach * f; p.dy += ay / d * reach * f - Math.sin(Math.PI * u) * 2;
        break;
      }
      case 'hop': p.dy -= Math.round(Math.sin(Math.PI * u) * 6); break;
      case 'shake': p.dx += (a >> 1) & 1 ? 1 : -1; break;
      case 'spin': p.flip = ((a >> 1) & 1) === 1; p.dy -= u < 0.8 ? 1 : 0; break;
      case 'lift': p.dy -= Math.round(4 * (u < 0.35 ? ease(u / 0.35) : u < 0.7 ? 1 : 1 - ease((u - 0.7) / 0.3))); break;
      case 'sink': p.k = u < 0.4 ? 1 - 0.45 * ease(u / 0.4) : u < 0.6 ? 0.55 : 0.55 + 0.45 * ease((u - 0.6) / 0.4); break;
      case 'recoil': { const f = Math.sin(Math.PI * u); p.dx -= ax / d * 4 * f; p.dy -= ay / d * 2 * f; break; }
      case 'flare': p.glow = a % 4 < 2; break;
      case 'swell': p.k = u < 0.3 ? 1 - 0.25 * ease(u / 0.3) : u < 0.6 ? 0.75 + 0.55 * ease((u - 0.3) / 0.3) : 1.3 - 0.3 * ease((u - 0.6) / 0.4); break;
      case 'blink': p.vis = u < 0.35 ? 1 - u / 0.35 : u < 0.65 ? 0 : (u - 0.65) / 0.35; break;
      case 'sway': p.dx += Math.round(Math.sin(u * Math.PI * 2) * 2); break;
      case 'stomp': p.dy -= u < 0.6 ? Math.round(Math.sin(Math.PI * u / 0.6) * 7) : u < 0.7 ? -1 : 0; break;
    }
  });
  p.dx = Math.round(p.dx); p.dy = Math.round(p.dy);
  return p;
}

// ---------------------------------------------------------------- paths

interface At { x: number; y: number; ux: number; uy: number; show: boolean }

/** Where a flight is at fraction u of its trip, and the way it is going, taken from a point a little behind it. */
function along(path: string, u: number, S: FxPoint, E: FxPoint, f: Flight, seed: number): At {
  const p = posAt(path, u, S, E, f, seed);
  const dx = E.x - S.x, dy = E.y - S.y, d = Math.hypot(dx, dy) || 1;
  if (u > 0.02) {
    const b = posAt(path, Math.max(0, u - 0.04), S, E, f, seed), vx = p.x - b.x, vy = p.y - b.y, n = Math.hypot(vx, vy);
    if (n > 0.01) return { x: p.x, y: p.y, ux: vx / n, uy: vy / n, show: p.show };
  }
  return { x: p.x, y: p.y, ux: dx / d, uy: dy / d, show: p.show };
}

function posAt(path: string, u: number, S: FxPoint, E: FxPoint, f: Flight, seed: number): { x: number; y: number; show: boolean } {
  const dx = E.x - S.x, dy = E.y - S.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const jit = (k: number) => (hash(seed * 31 + f.i * 7 + f.to * 13 + k) - 0.5);
  let x = S.x + dx * u, y = S.y + dy * u, show = true;
  switch (path) {
    // The lob stays low through the middle, where the two HUD panels close in, and peaks late over the target.
    case 'arc': { const v = (u - 0.8) / 0.2; y -= (4 + d / 9) * (u <= 0.8 ? (u / 0.8) ** 4 : 1 + v - 2 * v * v); break; }
    case 'wave': { const o = Math.sin(u * Math.PI * 4 + f.i) * 4; x += nx * o; y += ny * o; break; }
    case 'zigzag': { const z = (u * 6 + f.i * 0.5) % 2, o = (z < 1 ? z : 2 - z) * 8 - 4; x += nx * o; y += ny * o; break; }
    case 'spiral': { const r = 5 * (1 - u), o = Math.sin(u * Math.PI * 6 + f.i * 2) * r; x += nx * o; y += ny * o + Math.cos(u * Math.PI * 6 + f.i * 2) * r * 0.4; break; }
    case 'rain': { const sx = E.x + jit(1) * 14, sy = E.y - (E.y > 30 ? 18 : 34); x = sx + (E.x - sx) * u; y = sy + (E.y - sy) * u; break; }
    case 'rise': { const sx = E.x + jit(2) * 8; x = sx + (E.x - sx) * u; y = E.y + 6 - 8 * u; show = u > 0.15; break; }
    case 'converge': { const a = (f.i / Math.max(1, f.n)) * Math.PI * 2 + seed, sx = E.x + Math.cos(a) * 18, sy = E.y + Math.sin(a) * 11; x = sx + (E.x - sx) * ease(u); y = sy + (E.y - sy) * ease(u); break; }
    case 'orbit': {
      if (u < 0.6) { const a = u / 0.6 * Math.PI * 4 + f.i * Math.PI * 2 / Math.max(1, f.n); x = S.x + Math.cos(a) * 9; y = S.y + Math.sin(a) * 5; }
      else { const a = Math.PI * 4 + f.i * Math.PI * 2 / Math.max(1, f.n), ox = S.x + Math.cos(a) * 9, oy = S.y + Math.sin(a) * 5, v = (u - 0.6) / 0.4; x = ox + (E.x - ox) * v; y = oy + (E.y - oy) * v; }
      break;
    }
    case 'sweep': { const dir = E.x >= S.x ? 1 : -1; x = E.x + dir * (44 * u - 20); y = E.y - 1 + Math.sin(Math.PI * u) * 2; break; }
    case 'return': { const v = u < 0.5 ? ease(u * 2) : 1 - ease((u - 0.5) * 2); x = S.x + dx * v; y = S.y + dy * v - Math.sin(Math.PI * u * 2) * 3; break; }
  }
  return { x, y, show };
}

/** When a sweep passes the target, as a share of its trip. */
const SWEEP_AT = 20 / 44;

// ---------------------------------------------------------------- shapes

/** Draws rows of letters centered on x, y: each letter takes its tone, '.' stays clear. `mirror` flips them left to right. */
function stamp(rows: string[], x: number, y: number, T: Tones, lv: number, mirror = false): void {
  const h = rows.length, w = rows[0].length, ox = Math.round(x - (w - 1) / 2), oy = Math.round(y - (h - 1) / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][mirror ? w - 1 - i : i];
    if (ch === '.') continue;
    px(ox + i, oy + j, ch === 'h' ? T.hot : ch === 'l' ? T.light : ch === 'b' ? T.body : ch === 'e' ? T.edge : ch === 'a' ? T.acc : ch === 'k' ? INK : T.body, lv);
  }
}

const RUNES = [['l.l', '.h.', 'l.l'], ['lll', 'l.l', 'lhl'], ['.l.', 'lhl', '.l.'], ['l..', 'lhl', '..l'], ['lll', '.h.', 'lll']];

/** Draws one thing in flight at x, y going along ux, uy, a frames old, at size k and dither level lv. */
function shapeAt(shape: string, x: number, y: number, ux: number, uy: number, a: number, T: Tones, k: number, lv: number, seed: number): void {
  const big = k === 2, back = (n: number) => [x - ux * n, y - uy * n];
  switch (shape) {
    case 'orb': stamp(big ? ['.lll.', 'lhhhl', 'lhhhl', 'lhhhl', '.lll.'] : ['.l.', 'lhl', '.l.'], x, y, T, lv); if (!big) { px(x - 1, y - 1, T.body, lv); px(x + 1, y + 1, T.edge, lv); } break;
    case 'pearl': stamp(big ? ['.lll.', 'lhhll', 'lhlll', 'lllal', '.lll.'] : ['.l.', 'lhl', '.a.'], x, y, T, lv); break;
    case 'shard': for (let i = 0; i < (big ? 5 : 4); i++) { const [bx, by] = back(i); px(bx, by, i === 0 ? T.hot : i === 1 ? T.light : i < 3 ? T.body : T.edge, lv); } break;
    case 'thorn': for (let i = 0; i < (big ? 6 : 5); i++) { const [bx, by] = back(i); px(bx, by, i === 0 ? T.light : i < 3 ? T.body : T.edge, lv); } px(x - uy, y + ux, T.edge, lv); break;
    case 'star': { const r = big ? 2 : 1, plus = (a >> 2) & 1; px(x, y, T.hot, lv); for (let i = 1; i <= r; i++) { if (plus) { px(x + i, y, T.light, lv); px(x - i, y, T.light, lv); px(x, y + i, T.light, lv); px(x, y - i, T.light, lv); } else { px(x + i, y + i, T.light, lv); px(x - i, y - i, T.light, lv); px(x + i, y - i, T.light, lv); px(x - i, y + i, T.light, lv); } } break; }
    case 'hoop': { const r = big ? 3 : 2, wide = (a >> 2) & 1 ? 1 : 0.5; for (let q = 0; q < 12; q++) { const t = q / 12 * Math.PI * 2; px(x + Math.cos(t) * r * wide, y + Math.sin(t) * r, q % 3 ? T.light : T.hot, lv); } break; }
    case 'bolt': {
      let lx = x, ly = y;
      for (let i = 1; i <= (big ? 5 : 4); i++) {
        const j = (hash(seed + i * 17 + (a >> 1)) - 0.5) * 3, nx = x - ux * i * 2 - uy * j, ny = y - uy * i * 2 + ux * j;
        line(lx, ly, nx, ny, i === 1 ? T.hot : T.light, lv);
        lx = nx; ly = ny;
      }
      px(x, y, '#ffffff', lv);
      break;
    }
    case 'drop': stamp(big ? ['..l..', '.lhl.', 'lhhbl', 'lbbbe', '.eee.'] : ['.l.', 'lhb', 'beb'], x, y, T, lv); break;
    case 'bubble': { const w = (a >> 2) & 1; stamp(big ? ['.lll.', 'lh..l', 'l...l', 'l...l', '.lll.'] : ['.l.', 'h.l', '.l.'], x, y + (w ? -1 : 0), T, lv); break; }
    case 'leaf': stamp((a >> 2) & 1 ? ['..l', '.bh', 'be.'] : ['l..', 'hb.', '.eb'], x, y, T, lv); break;
    case 'petal': stamp((a >> 1) & 1 ? ['lh', 'b.'] : ['hl', '.b'], x, y, T, lv); break;
    case 'pebble': stamp(big ? ['.ll.', 'lhbb', 'lbbe', '.ee.'] : ['lb', 'be'], x, y, T, lv); break;
    case 'sand': for (let g = 0; g < (big ? 9 : 6); g++) px(x + (hash(seed + g * 5 + (a >> 1)) - 0.5) * 5, y + (hash(seed + g * 11 + (a >> 1)) - 0.5) * 4, g % 3 ? T.body : T.light, lv); break;
    case 'feather': { const s = (a >> 2) & 1 ? 1 : -1; for (let i = 0; i < 4; i++) { const [bx, by] = back(i); px(bx - uy * s * (i === 1 || i === 2 ? 1 : 0), by + ux * s * (i === 1 || i === 2 ? 1 : 0), i === 0 ? T.hot : T.light, lv); } const [qx, qy] = back(4); px(qx, qy, T.edge, lv); break; }
    case 'spark': { px(x, y, '#ffffff', lv); const [b1x, b1y] = back(1), [b2x, b2y] = back(2); px(b1x, b1y, T.light, lv); px(b2x, b2y, T.body, lv); if ((a & 3) === 0) { px(x + 1, y, T.light, lv); px(x, y - 1, T.light, lv); } break; }
    case 'rune': stamp(RUNES[(seed + (a >> 3)) % RUNES.length], x, y, T, lv); break;
    case 'crest': stamp(big ? ['.lll.', 'l...h', 'bb..l', 'bbbbb'] : ['.ll', 'l.h', 'bbb'], x, y, T, lv, ux < 0); break;
    case 'card': { const flat = ((a >> 1) % 4) === 1; stamp(flat ? ['l', 'h', 'l', 'e'] : ['ll', 'lh', 'll', 'ee'], x, y, T, lv); break; }
    case 'bone': stamp((a >> 2) & 1 ? ['l.l', '.l.', '.l.', '.l.', 'l.l'] : ['l...l', '.lll.', 'l...l'], x, y, T, lv); break;
    case 'shell': stamp(['.lb', 'lhe', 'bbe'], x, y, T, lv, ux < 0); break;
    case 'fang': stamp(ux >= 0 ? ['l.', 'hl', 'l.', '..', 'l.', 'hl', 'l.'] : ['.l', 'lh', '.l', '..', '.l', 'lh', '.l'], x, y, T, lv); break;
    case 'cog': stamp((a >> 2) & 1 ? ['.l.l.', 'lbbbl', '.bhb.', 'lbbbl', '.l.l.'] : ['..l..', '.bbb.', 'lbhbl', '.bbb.', '..l..'], x, y, T, lv); break;
    case 'comet': { stamp(big ? ['lhl', 'hhh', 'lhl'] : ['h'], x, y, T, lv); for (let i = 1; i < (big ? 9 : 7); i++) { const [bx, by] = back(i); px(bx, by, i < 3 ? T.light : T.body, lv * (1 - i / 9)); } break; }
    case 'moon': stamp(ux >= 0 ? ['.ll', 'l..', 'h..', 'l..', '.ll'] : ['ll.', '..l', '..h', '..l', 'll.'], x, y, T, lv); break;
    case 'salt': { stamp(['hl', 'be'], x, y, T, lv); if ((a + seed) % 8 < 2) px(x - 1, y - 1, '#ffffff', lv); break; }
    case 'fish': stamp((a >> 1) & 1 ? ['.lh.l', 'bbbbl'] : ['.lhb.', 'bbbbl'], x, y, T, lv, ux < 0); break;
    case 'kelp': for (let i = -2; i <= 2; i++) px(x + Math.round(Math.sin((a + i * 3) / 3)), y + i, i === -2 ? T.light : T.body, lv); break;
    case 'ember': { px(x, y, (a >> 1) & 1 ? '#ffffff' : T.hot, lv); for (let i = 1; i < 4; i++) { const [bx, by] = back(i); px(bx, by - i * 0.4, i < 2 ? T.light : '#4a4450', lv * (1 - i / 4)); } break; }
    case 'bell': stamp((a >> 2) & 1 ? ['.l.', 'lhl', 'lbl', 'bbb', '.e.'] : ['.l.', 'lhl', 'lbl', 'bbb', 'e..'], x, y, T, lv); break;
    case 'urchin': { px(x, y, T.hot, lv); for (let q = 0; q < 6; q++) { const t = q / 6 * Math.PI * 2 + a * 0.2; px(x + Math.cos(t) * 2, y + Math.sin(t) * 2, T.light, lv); } break; }
  }
}

/** A beam held from the user to the target: a bright core line with a light edge that flickers. */
function beamAt(S: FxPoint, E: FxPoint, a: number, T: Tones, k: number, lv: number): void {
  const dx = E.x - S.x, dy = E.y - S.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = k === 2 ? 1.5 : 1;
  line(S.x, S.y, E.x, E.y, T.hot, lv);
  if ((a >> 1) & 1 || k === 2) { line(S.x + nx * w, S.y + ny * w, E.x + nx * w, E.y + ny * w, T.light, lv, 1); line(S.x - nx * w, S.y - ny * w, E.x - nx * w, E.y - ny * w, T.light, lv, 2); }
}

// ---------------------------------------------------------------- landings

/** Draws one landing at x, y (the target's middle), a frames old out of len, at size k. */
function impactAt(w: string, x: number, y: number, a: number, len: number, T: Tones, k: number, seed: number): void {
  const u = a / len, fade = 1 - u, s = k === 2 ? 1.4 : k === 0 ? 0.75 : 1, foot = y + 4;
  switch (w) {
    case 'flash': {
      if (a < 2) { stamp(['.lll.', 'lhhhl', 'lhhhl', 'lhhhl', '.lll.'], x, y, T, 1); break; }
      const r = Math.round((2 + a * 0.6) * s);
      for (let i = 1; i <= r; i++) { const c = i < r / 2 ? T.hot : T.light; px(x + i, y, c, fade); px(x - i, y, c, fade); px(x, y + i, c, fade); px(x, y - i, c, fade); }
      break;
    }
    case 'ring': { const r = (2 + a * 0.7) * s; for (let q = 0; q < 20; q++) { const t = q / 20 * Math.PI * 2; px(x + Math.cos(t) * r, y + Math.sin(t) * r * 0.7, q % 2 ? T.light : T.hot, fade); } break; }
    case 'splash': {
      if (a < 6) for (let i = -3; i <= 3; i++) px(x + i * s, foot - Math.round((3 - Math.abs(i)) * (a < 3 ? a / 3 : 1)), Math.abs(i) < 2 ? T.light : T.body, 1 - a / 6);
      for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5 * s, vy = -1.4 - hash(seed + q) * 0.8; px(x + vx * a, y + vy * a + 0.12 * a * a, q % 2 ? T.hot : T.light, fade); }
      break;
    }
    case 'shatter': for (let q = 0; q < 7; q++) { const t = q / 7 * Math.PI * 2 + seed, r = (1 + a * 0.8) * s; shapeAt('shard', x + Math.cos(t) * r, y + Math.sin(t) * r * 0.8, Math.cos(t), Math.sin(t), a, T, 0, fade, seed); } break;
    case 'crack': {
      // The crack glows from inside, with a dark lip below it, and grit jumps out of it as it opens.
      const reach = Math.round(9 * s * Math.min(1, a / 5));
      for (let i = 0; i <= reach; i++) {
        for (const sx of [x + i, x - i]) {
          const j = hash(seed + sx * 3) < 0.4 ? 1 : 0;
          px(sx, foot + j, i < 3 ? T.hot : T.light, fade * 1.6);
          px(sx, foot + j + 1, INK, fade * 1.6);
        }
        if (i % 4 === 2 && a < 8) { px(x + i, foot - 1 - (a >> 1), T.body, 1 - a / 8); px(x - i, foot - 2 - (a >> 1), T.body, 1 - a / 8); }
      }
      break;
    }
    case 'sparkle': for (let q = 0; q < 6; q++) { const t = hash(seed + q * 7) * Math.PI * 2, r = (5 + hash(seed + q) * 5) * s, ph = (a + q * 3) % 6; const sx = x + Math.cos(t) * r, sy = y + Math.sin(t) * r * 0.7; if (ph < 4) { px(sx, sy, '#ffffff', fade * 1.5); if (ph < 2) { px(sx + 1, sy, T.light, fade); px(sx - 1, sy, T.light, fade); px(sx, sy + 1, T.light, fade); px(sx, sy - 1, T.light, fade); } } } break;
    case 'puff':
      for (let q = 0; q < 3; q++) {
        const r = (1.5 + a * 0.22 + q * 0.6) * s, cx = Math.round(x + (q - 1) * 3 * s), cy = Math.round(foot - 1 - q % 2 - a * 0.15);
        for (let yy = -Math.ceil(r / 1.3); yy <= Math.ceil(r / 1.3); yy++) {
          const w = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy * 1.6)));
          dither(cx - w, cy + yy, 2 * w + 1, 1, yy < 0 ? T.light : T.body, fade * 0.8);
        }
      }
      break;
    case 'slash': { const n = Math.min(1, (a + 1) / 3), r = 6 * s; line(x + r, y - r, x + r - 2 * r * n, y - r + 2 * r * n, T.hot, fade * 1.5); line(x + r + 1, y - r, x + r + 1 - 2 * r * n, y - r + 2 * r * n, T.light, fade); break; }
    case 'claw': for (let q = 0; q < 3; q++) { const aa = a - q * 2; if (aa < 0) continue; const n = Math.min(1, (aa + 1) / 3), r = 5 * s, ox = (q - 1) * 3; line(x + ox + r * 0.6, y - r, x + ox + r * 0.6 - r * 1.2 * n, y - r + 2 * r * n, q === 1 ? T.hot : T.light, fade * 1.5); } break;
    case 'bite': {
      const gap = Math.max(0, 6 - a * 1.5) * s;
      for (let i = -3; i <= 3; i++) { px(x + i * s, y - 1 - gap, T.light, fade * 1.5); px(x + i * s, y + 1 + gap, T.light, fade * 1.5); if (i % 2 === 0) { px(x + i * s, y - gap, T.hot, fade * 1.5); px(x + i * s, y + gap, T.hot, fade * 1.5); } }
      break;
    }
    case 'pillar': { const h = Math.min(1, a / 4) * 26 * s, w = k === 2 ? 2 : 1; for (let yy = 0; yy < h; yy++) { px(x, foot - yy, T.hot, fade * 1.4); for (let i = 1; i <= w; i++) { px(x + i, foot - yy, T.light, fade); px(x - i, foot - yy, T.light, fade); } } break; }
    case 'sigil': {
      // The seed picks how many marks turn on the circle, which way, and the glyph that lights above it at the end.
      const r = 7 * s, n = 3 + (seed >>> 3) % 3, turn = a * 0.12 * ((seed >>> 6) & 1 ? 1 : -1), lv = a < len - 4 ? 1 : (len - a) / 4;
      for (let q = 0; q < 24; q++) { const t = q / 24 * Math.PI * 2; px(x + Math.cos(t) * r, foot + Math.sin(t) * r * 0.35, q % 2 ? T.light : T.body, lv); }
      for (let q = 0; q < n; q++) { const t = q / n * Math.PI * 2 + turn; stamp(['lhl'], x + Math.cos(t) * r * 0.55, foot + Math.sin(t) * r * 0.2, T, lv); }
      if (a > len - 6) stamp(RUNES[(seed >>> 8) % RUNES.length], x, y, T, lv);
      break;
    }
    case 'quake': for (let q = 0; q < 8; q++) { const t = hash(seed + q) - 0.5, hop = Math.max(0, Math.sin((a + q * 2) / 3)) * 3; px(x + t * 16 * s, foot - hop, q % 2 ? T.body : T.light, fade * 1.5); px(x + t * 16 * s + 1, foot, INK, fade); } break;
    case 'burst': for (let q = 0; q < 8; q++) { const t = q / 8 * Math.PI * 2 + 0.2, r0 = (1 + a * 0.6) * s, r1 = r0 + 2 + (q % 2) * 2; line(x + Math.cos(t) * r0, y + Math.sin(t) * r0, x + Math.cos(t) * r1, y + Math.sin(t) * r1, q % 2 ? T.light : T.hot, fade * 1.3); } break;
    case 'vortex': for (let q = 0; q < 14; q++) { const t = q * 0.7 + a * 0.35, r = (9 - (q % 7) * 1.1) * s * (1 - u * 0.5); px(x + Math.cos(t) * r, y + Math.sin(t) * r * 0.6, q % 3 ? T.body : T.light, fade * 1.2); } break;
    case 'bloom': for (let q = 0; q < 5; q++) { const t = q / 5 * Math.PI * 2 + a * 0.05, r = (1 + a * 0.45) * s; stamp(q % 2 ? ['lh'] : ['hl'], x + Math.cos(t) * r, y + Math.sin(t) * r * 0.8, T, fade * 1.3); } break;
    case 'drip': for (let q = 0; q < 4; q++) { const aa = a - q * 3; if (aa < 0) continue; px(x + (q - 1.5) * 2.5 * s, y - 6 + aa * 0.9, q % 2 ? T.light : T.hot, fade * 1.4); } break;
    case 'smoke':
      for (let q = 0; q < 3; q++) {
        const r = Math.ceil((1 + a * 0.12) * s), cx = Math.round(x + (q - 1) * 2 + Math.sin((a + q * 5) / 4)), cy = Math.round(y - a * 0.5 - q * 2);
        dither(cx - r, cy - 1, 2 * r + 1, 3, q === 1 ? '#5a5466' : '#3e3a48', fade * 0.9);
      }
      break;
    case 'fizz': for (let q = 0; q < 5; q++) { const aa = a - q * 2; if (aa < 0) continue; shapeAt('bubble', x + (q - 2) * 3 * s + Math.sin((aa + q) / 2), foot - aa * 0.9, 0, -1, aa, T, 0, fade * 1.3, seed); } break;
    case 'cinders': for (let q = 0; q < 6; q++) { const aa = a - q; if (aa < 0) continue; px(x + (hash(seed + q) - 0.5) * 12 * s + Math.sin(aa / 3), y + 2 - aa * 0.7, (aa + q) % 3 ? T.hot : '#ffffff', fade * 1.3); } break;
    case 'daze': for (let q = 0; q < 3; q++) { const t = a * 0.3 + q * Math.PI * 2 / 3; shapeAt('star', x + Math.cos(t) * 5, y - 7 + Math.sin(t) * 1.5, 0, 0, a + q, T, 0, fade * 1.4, seed); } break;
    case 'frost': for (let q = 0; q < 6; q++) { const g = Math.min(1, Math.max(0, (a - q * 1.5) / 4)); if (g <= 0) continue; const t = hash(seed + q * 3) * Math.PI * 2, r = (4 + hash(seed + q) * 4) * s, cx = x + Math.cos(t) * r, cy = y + Math.sin(t) * r * 0.7; px(cx, cy, '#ffffff', fade * 1.4); if (g > 0.5) { px(cx + 1, cy, T.light, fade); px(cx - 1, cy, T.light, fade); px(cx, cy + 1, T.light, fade); px(cx, cy - 1, T.light, fade); } } break;
  }
}

// ---------------------------------------------------------------- drawing a run

/** Draws a run's ground landings (`under`), or everything that stands or flies in front of the sloughs. */
export function drawRun(r: FxRun, layer: 'under' | 'over'): void {
  const T = r.tone, plan = r.plan;
  if (layer === 'under' && r.art?.back) painted(r, () => r.art!.back!(r));
  if (layer === 'over') {
    // A lunge leaves short streaks behind the user while it is on its way.
    plan.motion.forEach((m, i) => {
      const a = r.t - r.motionAt[i], len = r.motionLen[i];
      if (m !== 'lunge' || a < 0 || a >= len * CONTACT.lunge) return;
      const p = poseOf(r), aim = r.to[0], ax = aim.x - r.from.x, ay = aim.y - r.from.y, d = Math.hypot(ax, ay) || 1;
      for (let q = 0; q < 3; q++) line(r.from.x + p.dx - ax / d * (4 + q), r.from.y + p.dy - 2 + q * 2 - ay / d * (4 + q), r.from.x + p.dx - ax / d * (8 + q * 2), r.from.y + p.dy - 2 + q * 2 - ay / d * (8 + q * 2), T.light, 0.5);
    });
    for (const f of r.art?.noFlights ? [] : r.flights) {
      const a = r.t - f.t0;
      if (a < 0) continue;
      const S = r.from, E = r.to[f.to] || r.to[0];
      if (plan.shape === 'beam') { if (a < f.dur + 10) beamAt(S, E, a, T, r.k, a < f.dur + 6 ? 1 : (f.dur + 10 - a) / 4); continue; }
      const path = plan.path || 'line';
      if (path === 'ray') {
        if (a >= f.dur + 10) continue;
        const n = Math.max(4, plan.count * 3), lv = a < f.dur + 6 ? 1 : (f.dur + 10 - a) / 4;
        for (let q = 1; q <= n; q++) { const u = q / (n + 1) * Math.min(1, (a + 1) / f.dur); shapeAt(plan.shape!, S.x + (E.x - S.x) * u, S.y + (E.y - S.y) * u, (E.x - S.x) / (Math.hypot(E.x - S.x, E.y - S.y) || 1), (E.y - S.y) / (Math.hypot(E.x - S.x, E.y - S.y) || 1), a + q, T, r.k, lv, r.seed + q); }
        continue;
      }
      if (a >= f.dur) continue;
      const at = along(path, a / f.dur, S, E, f, r.seed);
      if (at.show) shapeAt(plan.shape!, at.x, at.y, at.ux, at.uy, a, T, r.k, 1, r.seed + f.i);
    }
  }
  for (const h of r.hits) {
    const a = r.t - h.at, E = r.to[h.to] || r.to[0];
    if (a < 0) continue;
    // Every landing marks its moment with a white spark, whatever else it does.
    if (layer === 'over' && a < 3) stamp(a < 2 ? ['.h.', 'hhh', '.h.'] : ['h.h', '...', 'h.h'], E.x, E.y, { ...T, hot: '#ffffff' }, 1);
    for (const w of r.art?.noLandings ? [] : plan.impact.length ? plan.impact : ['flash']) {
      if (UNDER.has(w) !== (layer === 'under')) continue;
      const len = landLen(w, r.k);
      if (a < len) impactAt(w, E.x, E.y, a, len, T, r.k, r.seed + h.to * 7);
    }
  }
  // A stomp throws dust from the user's feet when it lands.
  if (layer === 'under') plan.motion.forEach((m, i) => {
    const a = r.t - r.motionAt[i] - Math.round(r.motionLen[i] * CONTACT.stomp);
    if (m === 'stomp' && a >= 0 && a < 14) impactAt('quake', r.from.x, r.from.y, a, 14, T, 1, r.seed);
  });
  if (layer === 'over' && r.art?.front) painted(r, () => r.art!.front!(r));
}

/** Draws a run's own art with the run's recoloring on. */
function painted(r: FxRun, fn: () => void): void {
  paint = r.paint || null;
  try { fn(); } finally { paint = null; }
}

/** The lights a run casts this frame: a flare at the user as it starts, a point on everything in flight, and a burst at each landing. */
export function runLights(r: FxRun): SceneLight[] {
  const out: SceneLight[] = [], T = r.tone, plan = r.plan;
  if (r.t < 10) out.push({ x: r.from.x, y: r.from.y, r: 8, lv: 1.6 * (1 - r.t / 10), tint: T.body });
  // Art that draws its own flights lights them through its own `lights`.
  for (const f of r.art?.noFlights ? [] : r.flights) {
    const a = r.t - f.t0;
    if (a < 0 || f.i > 1) continue;
    const S = r.from, E = r.to[f.to] || r.to[0];
    if (plan.shape === 'beam' || plan.path === 'ray') {
      if (a < f.dur + 8) for (const u of [0.3, 0.6, 0.9]) out.push({ x: Math.round(S.x + (E.x - S.x) * u), y: Math.round(S.y + (E.y - S.y) * u), r: 6, lv: 1.6, tint: T.body });
      continue;
    }
    if (a >= f.dur) continue;
    const at = along(plan.path || 'line', a / f.dur, S, E, f, r.seed);
    if (at.show) out.push({ x: Math.round(at.x), y: Math.round(at.y), r: r.k === 2 ? 8 : 6, lv: 1.6, tint: T.body, core: true });
  }
  for (const h of r.hits) {
    const a = r.t - h.at, E = r.to[h.to] || r.to[0];
    if (a >= 0 && a < 12) out.push({ x: Math.round(E.x), y: Math.round(E.y), r: r.k === 2 ? 14 : 10, lv: 2 * (1 - a / 12), tint: T.body });
  }
  if (r.art?.lights) for (const l of r.art.lights(r)) out.push(r.paint && l.tint ? { ...l, tint: r.paint(l.tint) } : l);
  return out;
}

/** What a run does to the whole scene this frame: a shake in scene pixels, a wash of its color, a darkening, and a white flash, each as a dither level. */
export function runScene(r: FxRun): { jolt: number; wash: number; dark: number; glare: number; color: string } {
  const sc = r.plan.scene, first = r.hits.length ? r.hits[0].at : 0, a = r.t - first;
  const out = {
    jolt: sc.includes('jolt') && a >= 0 && a < 8 ? ((a >> 1) & 1 ? 1 : -1) : 0,
    wash: sc.includes('tint') ? (r.t < first ? 0.125 : a < 14 ? 0.1875 * (1 - a / 14) + 0.0625 : 0) : 0,
    dark: sc.includes('dark') ? Math.min(1, r.t / 6) * (r.t > r.end - 8 ? Math.max(0, (r.end - r.t) / 8) : 1) * 0.375 : 0,
    glare: sc.includes('glare') && a >= 0 && a < 4 ? 0.5 - a * 0.125 : 0,
    color: r.tone.body,
  };
  // A legendary picture may shake harder, flash, or darken the scene in its own beats.
  const own = r.art?.scene?.(r);
  if (own) { if (own.jolt) out.jolt = own.jolt; out.glare = Math.max(out.glare, own.glare || 0); out.dark = Math.max(out.dark, own.dark || 0); }
  return out;
}

// ---------------------------------------------------------------- statuses

/** Each status that has a picture on or around the sprite, with its color. */
export const STATUS_FX: Record<string, string> = {
  stun: '#f0e060', sleep: '#8aa0e0', slow: '#7aa0c8', haste: '#a0e0a0', root: '#8a6a3a', silence: '#a0a0c0', taunt: '#e07040',
  burn: '#f08a30', bleed: '#c83a3a', poison: '#9a5ab0', rot: '#9aac5a', expose: '#e8a0a0', weaken: '#a08070', fortify: '#c8c8d8',
  empower: '#f0a040', stasis: '#d0d0e0', unstop: '#e0c080', ward: '#a0d0f0', thorns: '#6aa04a', regen: '#7ad07a', invuln: '#f8e8a0',
  doom: '#b03a5a', monument: '#d8d4c8', guard: '#e8e2d0', dashing: '#d8e0f0', deaf: '#9a9ab8',
};

/** Draws one status around a sprite whose top left is x, y, facing right when `right`. `t` is the frame. */
export function drawStatus(id: string, x: number, y: number, t: number, right: boolean): void {
  const c = STATUS_FX[id];
  if (!c) return;
  const cx = x + 4, front = right ? x + 9 : x - 2, behind = right ? x - 2 : x + 9, dir = right ? 1 : -1;
  const light = mix(c, '#ffffff', 0.5);
  switch (id) {
    case 'stun': for (let q = 0; q < 3; q++) { const a = t / 9 + q * Math.PI * 2 / 3; px(cx + Math.cos(a) * 5, y - 2 + Math.sin(a) * 1.5, q === 0 ? '#ffffff' : c); } break;
    case 'sleep': for (let q = 0; q < 2; q++) { const a = (t + q * 30) % 60, zx = x + 7 + a / 12, zy = y - 1 - a / 8; if (a < 50) { px(zx, zy, c); px(zx + 1, zy, c); px(zx + 2, zy, c); px(zx + 1, zy + 1, c); px(zx, zy + 2, c); px(zx + 1, zy + 2, c); px(zx + 2, zy + 2, c); } } break;
    case 'slow': { const up = Math.floor(t / 60) % 2 === 0, hx = cx - 1, hy = y - 7; for (const [i, j] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 3], [1, 3], [2, 3]]) px(hx + i, hy + (up ? j : 3 - j), c); px(hx + 1, hy + (up ? 3 : 0) - (up ? 1 : -1), light); break; }
    case 'haste': case 'dashing': for (let q = 0; q < 3; q++) { const len = 2 + ((t >> 2) + q) % 3; for (let i = 0; i < len; i++) px(behind - dir * i, y + 2 + q * 2, i === 0 ? light : c, id === 'dashing' ? 0.5 : 1); } break;
    case 'root': for (let i = -1; i <= 8; i++) { if (hash(i * 7 + 3) < 0.45) continue; px(x + i, y + 8, c); if (hash(i * 3 + 1) < 0.35) px(x + i, y + 7, '#5aa04a'); } break;
    case 'silence': for (const [i, j] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]) px(front + (right ? i : -i), y + 1 + j, c); break;
    case 'taunt': if (t % 30 < 20) for (const [i, j] of [[0, 0], [1, 1], [2, 0], [0, 2], [2, 2]]) px(front - dir + (right ? i : -i), y - 3 + j, c); break;
    case 'burn': for (let q = 0; q < 4; q++) { const h = 1 + ((t >> 2) + q * 3) % 3; for (let j = 0; j < h; j++) px(x + 1 + q * 2, y + 7 - j, j === h - 1 ? '#ffe060' : c); } break;
    case 'bleed': { const a = t % 24; if (a < 16) px(x + 3 + (Math.floor(t / 24) % 3), y + 5 + a / 3, c); break; }
    case 'poison': for (let q = 0; q < 2; q++) { const a = (t + q * 20) % 40; if (a < 30) { px(cx - 2 + q * 4, y - a / 8, c); px(cx - 1 + q * 4, y - 1 - a / 8, light); } } break;
    case 'rot': for (let q = 0; q < 2; q++) { const a = t / 4 + q * Math.PI; px(cx + Math.cos(a) * 6, y + 2 + Math.sin(a * 2) * 2, c); } break;
    case 'expose': if (t % 24 < 18) for (const [i, j] of [[-2, -2], [-1, -2], [-2, -1], [9, -2], [8, -2], [9, -1], [-2, 9], [-1, 9], [-2, 8], [9, 9], [8, 9], [9, 8]]) px(x + i, y + j, c); break;
    case 'weaken': for (const [i, j] of [[1, 0], [1, 1], [0, 2], [1, 2], [2, 2], [1, 3]]) px(front + (right ? i : -i), y + 4 + j, c); break;
    case 'fortify': for (let j = 0; j < 5; j++) { px(front, y + 2 + j, j === 0 ? light : c); if (j < 4) px(front + dir, y + 2 + j, c); } break;
    case 'empower': for (const [i, j] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]]) px(behind + (right ? -i : i), y + 1 + j, t % 20 < 10 ? light : c); break;
    case 'stasis': for (let i = -1; i <= 8; i += 2) { px(x + i, y - 1, c); px(x + i, y + 8, c); px(x - 1, y + i, c); px(x + 8, y + i, c); } break;
    case 'unstop': if (t % 16 < 10) for (const [i, j] of [[-1, -1], [8, -1], [-1, 8], [8, 8]]) px(x + i, y + j, c); break;
    case 'ward': for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2 + t / 20; px(cx + Math.cos(a) * 6, y + 4 + Math.sin(a) * 5, q % 2 ? c : light, 0.75); } break;
    case 'thorns': for (const [i, j] of [[-1, 2], [-2, 5], [8, 3], [9, 6], [3, -1], [6, -1]]) px(x + i, y + j, c); break;
    case 'regen': for (let q = 0; q < 2; q++) { const a = (t + q * 25) % 50; if (a < 40) { const gx = x + 1 + q * 5, gy = y + 6 - a / 6; px(gx, gy, c); px(gx - 1, gy, c, 0.5); px(gx + 1, gy, c, 0.5); px(gx, gy - 1, c, 0.5); } } break;
    case 'invuln': if (t % 12 < 6) for (const [i, j] of [[-1, 0], [8, 3], [2, -1], [6, 8]]) px(x + i, y + j, '#ffffff'); break;
    case 'doom': for (let i = -1; i <= 3; i++) px(cx - 1 + i, y - 4, '#3e3a48'); px(cx, y - 5, '#3e3a48'); if (t % 30 < 15) px(cx + 1, y - 3, c); break;
    case 'monument': for (let i = -1; i <= 8; i++) { px(x + i, y + 8, c); px(x + i, y + 9, mix(c, INK, 0.4)); } break;
    case 'guard': for (let j = 0; j < 7; j++) px(front + (j === 0 || j === 6 ? -dir : 0), y + 1 + j, j === 3 ? '#ffffff' : c); break;
    // Deaf: two sound arcs behind the head with a line through them.
    case 'deaf': {
      const o = t % 48 < 32 ? 1 : 0.5;
      for (const [i, j] of [[0, 1], [1, 2], [1, 3], [0, 4], [2, 0], [3, 1], [3, 2], [3, 3], [3, 4], [2, 5]]) px(behind - dir * i, y - 4 + j, c, o);
      for (let q = 0; q < 6; q++) px(behind - dir * Math.round(q * 0.7), y - 4 + q, light, o);
      break;
    }
  }
}

// ---------------------------------------------------------------- field states

/** Draws a field state over the scene, behind the sloughs. */
export function drawField(id: string, t: number, color: string): void {
  const dim = mix(color, INK, 0.55), lite = mix(color, '#ffffff', 0.35);
  switch (id) {
    case 'fog':
      // Each bank drifts in 4 pixel columns, thick in the middle and thin at its wavy edges.
      for (let q = 0; q < 3; q++) {
        const by = 14 + q * 15, off = Math.floor(t / (10 + q * 4)) + q * 37;
        for (let x = 0; x < SW; x += 4) {
          const h = 2 + Math.round(Math.sin((x + off) / 9) * 1.5 + Math.sin((x + off) / 4) * 0.8);
          dither(x, by - h, 4, 2 * h + 1, '#5a6878', 0.1875);
          if (h > 1) dither(x, by - h + 1, 4, 2 * h - 1, '#7a8898', 0.375);
        }
      }
      break;
    case 'gale': for (let q = 0; q < 12; q++) { const y = 4 + Math.floor(hash(q * 13) * 52), sp = 3 + hash(q * 7) * 2, x = ((t * sp + hash(q * 3) * 200) % 130) - 20, len = 4 + Math.floor(hash(q) * 5); line(x, y, x + len, y, q % 4 ? dim : lite, 1); if (q % 5 === 0) px(x + len + 2, y - 1, '#6aa04a'); } break;
    case 'hightide': {
      const top = 49 + Math.round(Math.sin(t / 40) * 1.5);
      for (let x = 0; x < SW; x++) { const wv = Math.round(Math.sin((x + t / 3) / 5)); px(x, top + wv, lite); if (wv < 1) px(x, top + 1, color, 0.5); }
      dither(0, top + 2, SW, 2, color, 0.5);
      dither(0, top + 4, SW, SH - top - 4, dim, 0.625);
      break;
    }
    case 'starfall': for (let q = 0; q < 3; q++) { const a = (t + q * 47) % 70, sx = 10 + hash(q * 5 + Math.floor((t + q * 47) / 70)) * 76; if (a < 18) { for (let i = 0; i < 5; i++) px(sx - a * 1.2 + i * 1.2, a * 1.1 - i, i === 0 ? '#ffffff' : lite, 1 - i / 6); } } break;
    case 'saltcrust': { for (let x = 0; x < SW; x += 1) if (hash(x * 3 + 1) < 0.35) px(x, 56 + Math.floor(hash(x) * 4), lite, 0.75); for (let q = 0; q < 14; q++) { const gx = Math.floor(hash(q * 11) * 96), gy = 38 + Math.floor(hash(q * 19) * 20); px(gx, gy, (t + q * 9) % 60 < 6 ? '#ffffff' : lite); } break; }
    case 'eclipse': {
      // The moon goes dark behind a black disc with a thin corona, and the sky above the ground dims.
      const ex = 84, ey = 8;
      dither(0, 0, SW, 34, INK, 0.25);
      for (let q = 0; q < 24; q++) { const a = q / 24 * Math.PI * 2; px(ex + Math.cos(a) * 5, ey + Math.sin(a) * 5, q % 3 ? lite : '#ffffff'); }
      for (let y = -4; y <= 4; y++) { const w = Math.floor(Math.sqrt(16 - y * y)); rect(ex - w, ey + y, 2 * w + 1, 1, INK); }
      break;
    }
    case 'stillwater': for (let q = 0; q < 10; q++) { const gy = 42 + q * 2, gx = Math.floor(hash(q * 7) * 80), len = 4 + Math.floor(hash(q) * 9); if ((t + q * 13) % 120 < 90) line(gx, gy, gx + len, gy, q % 2 ? lite : color, 0.75); } break;
    case 'mirror': {
      // A sheen slides across the glass on a slow beat, and a silver edge runs along the ground.
      const sx = (t * 0.8) % 150 - 30;
      for (let y = 0; y < SH; y++) { const x = sx + (SH - y) * 0.5; px(x, y, lite, 0.5); px(x + 1, y, '#ffffff', 0.375); px(x + 5, y, lite, 0.25); }
      for (let x = 0; x < SW; x += 2) px(x, 57, color, 0.5);
      break;
    }
    case 'driftsand': {
      // A haze of sand thickens toward the ground, and loose grains blow along it.
      for (let y = 44; y < SH; y += 4) dither(0, y, SW, 4, dim, 0.0625 + (y - 44) / 40);
      for (let q = 0; q < 16; q++) { const y = 40 + Math.floor(hash(q * 5) * 20), x = (t * (0.6 + hash(q) * 0.6) + hash(q * 9) * 120) % 110 - 7; px(x, y, q % 3 ? color : lite); }
      break;
    }
  }
}

// ---------------------------------------------------------------- kind icons

/** Each kind's icon, 7 by 7: '#' in the light tone and 'o' in the kind's own color. The first four match the Guide's drawings. */
export const KIND_ICONS: Record<string, { rows: string[]; color: string }> = {
  dash: { rows: ['#......', '.#..#..', '..#..#.', '...#..#', '..#..#.', '.#..#..', '#......'], color: '#e8903a' },
  projectile: { rows: ['.......', '.....#.', '....#o#', '##.#ooo', '....#o#', '.....#.', '.......'], color: '#7ab0d8' },
  spell: { rows: ['...#...', '..#.#..', '.#.o.#.', '#.ooo.#', '.#.o.#.', '..#.#..', '...#...'], color: '#b08ae0' },
  channel: { rows: ['.......', '.......', '#.#.#.#', '.#o#o#.', '#.#.#.#', '.......', '.......'], color: '#5ac8b0' },
  quick: { rows: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'], color: '#e8c860' },
  late: { rows: ['#######', '.#ooo#.', '..#o#..', '...#...', '..#.#..', '.#...#.', '#######'], color: '#8a9ac8' },
  sound: { rows: ['...#...', '..#o#..', '.#ooo#.', '.#ooo#.', '#ooooo#', '#######', '...#...'], color: '#e0b060' },
};

/** The kinds a move shows as icons, in a fixed order. */
export function kindsOf(m: { tags?: string[]; quick?: boolean; late?: boolean }): string[] {
  const out = ['dash', 'projectile', 'spell', 'channel', 'sound'].filter(k => m.tags?.includes(k));
  if (m.quick) out.push('quick');
  if (m.late) out.push('late');
  return out;
}

/** Draws a kind's icon on the screen at x, y. */
export function kindIcon(kind: string, x: number, y: number, ink: string): void {
  const ic = KIND_ICONS[kind];
  if (!ic) return;
  ic.rows.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] !== '.') rect(x + i, y + j, 1, 1, r[i] === '#' ? ink : ic.color); });
}

/** Drawing pieces the legendary pictures share with the grammar's own. */
export { px as fxPx, line as fxLine, hash as fxHashN, ease as fxEase, stamp as fxStamp, shapeAt as fxShape, beamAt as fxBeam, impactAt as fxImpact };
