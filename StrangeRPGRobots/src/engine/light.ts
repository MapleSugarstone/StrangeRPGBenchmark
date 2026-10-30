// Lighting. Light is added per frame, blocked by walls on a 4 pixel grid, and shaded by surface normals.
// The composite dithers each world pixel between its palette color and black and steps sprite pixels down
// their ramp in the dark so figures stay readable. Colored light pulls hues, and overlapping lights mix.
import { DOWN, PX, RGB, UP, LUMA, indexLut, redLut, isRed } from './palette';
import { H, W, alb, buf, emi, ibuf, nrm, roof } from './screen';
import type { Img } from './gfx';

export type RGBf = [number, number, number];

interface FrameLight { x: number; y: number; r: number; i: number; z: number; cr: number; cg: number; cb: number }
/** Point lights added this frame, for figure shadows. */
const FRAME_LIGHTS: FrameLight[] = [];
/** Pixels under a figure's contact shadow. */
const SHD = new Uint8Array(W * H);
let AR = 0, AG = 0, AB = 0;
const LR = new Float32Array(W * H);
const LG = new Float32Array(W * H);
const LB = new Float32Array(W * H);
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

const CELL = 4;
const MARGIN = 64;
const GW = (W + MARGIN * 2) / CELL;
const GH = (H + MARGIN * 2) / CELL;
const occ = new Uint8Array(GW * GH);
const vis = new Float32Array(GW * GH);
let occluding = false;

export function rgbf(c: number): RGBf { return [((c >> 16) & 0xff) / 255, ((c >> 8) & 0xff) / 255, (c & 0xff) / 255]; }

/**
 * Starts a lit frame. `blocks(sx, sy)` says whether a screen point lies inside something opaque.
 * Pass null for scenes without walls.
 */
export function beginLight(ambient: RGBf, blocks: ((sx: number, sy: number) => boolean) | null) {
  FRAME_LIGHTS.length = 0;
  SHD.fill(0);
  [AR, AG, AB] = ambient;
  LR.fill(ambient[0]);
  LG.fill(ambient[1]);
  LB.fill(ambient[2]);
  occluding = !!blocks;
  if (blocks) {
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        occ[gy * GW + gx] = blocks(gx * CELL - MARGIN + CELL / 2, gy * CELL - MARGIN + CELL / 2) ? 1 : 0;
      }
    }
  }
}

function computeVis(x: number, y: number, gx0: number, gy0: number, gx1: number, gy1: number) {
  const lx = Math.floor((x + MARGIN) / CELL), ly = Math.floor((y + MARGIN) / CELL);
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const dx = gx - lx, dy = gy - ly;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      let seen = 1;
      if (steps > 1) {
        const sx = dx / steps, sy = dy / steps;
        let cx = lx + 0.5, cy = ly + 0.5;
        for (let k = 1; k < steps; k++) {
          cx += sx; cy += sy;
          const ix = Math.floor(cx), iy = Math.floor(cy);
          if (ix === lx && iy === ly) continue;
          if (ix < 0 || iy < 0 || ix >= GW || iy >= GH) continue;
          if (occ[iy * GW + ix]) { seen = 0; break; }
        }
      }
      vis[gy * GW + gx] = seen;
    }
  }
}

export interface LightOpts {
  /** Height of the light above the ground, in pixels. Low lights rake across sprites. */
  z?: number;
  /** Subtracts light instead of adding it. */
  negative?: boolean;
  /** Ignores walls. */
  through?: boolean;
  /** A cone: direction in radians and half-width in radians. */
  dir?: number;
  spread?: number;
}

/** Adds a point light centered on a screen pixel. Color is 0xRRGGBB. */
export function addLight(x: number, y: number, r: number, i: number, color = 0xffffff, o: LightOpts = {}) {
  if (r <= 1 || i <= 0) return;
  const [cr, cg, cb] = rgbf(color);
  if (!o.negative && !o.dir && !o.through && i >= 0.3) FRAME_LIGHTS.push({ x, y, r, i, z: o.z ?? 16, cr, cg, cb });
  const sgn = o.negative ? -1 : 1;
  const z = o.z ?? 16;
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r));
  if (x0 > x1 || y0 > y1) return;
  const useVis = occluding && !o.through;
  if (useVis) {
    const gx0 = Math.max(0, Math.floor((x0 + MARGIN) / CELL));
    const gy0 = Math.max(0, Math.floor((y0 + MARGIN) / CELL));
    const gx1 = Math.min(GW - 1, Math.floor((x1 + MARGIN) / CELL));
    const gy1 = Math.min(GH - 1, Math.floor((y1 + MARGIN) / CELL));
    computeVis(x, y, gx0, gy0, gx1, gy1);
  }
  const cone = o.dir !== undefined;
  const cdx = cone ? Math.cos(o.dir!) : 0, cdy = cone ? Math.sin(o.dir!) : 0;
  const cosSpread = cone ? Math.cos(o.spread ?? 0.6) : 0;
  const r2 = r * r;
  for (let py = y0; py <= y1; py++) {
    const dy = py - y;
    const gy = Math.floor((py + MARGIN) / CELL);
    for (let px = x0; px <= x1; px++) {
      const dx = px - x;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const k = 1 - d2 / r2;
      let f = k * k * i;
      if (cone && d2 > 4) {
        const d = Math.sqrt(d2);
        const c = (dx * cdx + dy * cdy) / d;
        if (c < cosSpread) continue;
        f *= Math.min(1, (c - cosSpread) / 0.12);
      }
      if (useVis) {
        const v = vis[gy * GW + Math.floor((px + MARGIN) / CELL)];
        if (v <= 0) continue;
        f *= v;
      }
      const idx = py * W + px;
      const nx = nrm[idx * 2], ny = nrm[idx * 2 + 1];
      if (nx !== 0 || ny !== 0) {
        const fx = nx / 100, fy = ny / 100;
        const fz = Math.sqrt(Math.max(0, 1 - fx * fx - fy * fy));
        const len = Math.sqrt(d2 + z * z) || 1;
        const dot = (-dx * fx - dy * fy + z * fz) / len;
        f *= 0.25 + 1.05 * Math.max(0, dot);
      }
      f *= sgn;
      LR[idx] += cr * f;
      LG[idx] += cg * f;
      LB[idx] += cb * f;
    }
  }
}

/** Adds flat light to a rectangle (a lit window spilling onto a wall, a room's own light). */
export function addRectLight(x: number, y: number, w: number, h: number, i: number, color = 0xffffff) {
  const [cr, cg, cb] = rgbf(color);
  const x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0);
  const y0 = Math.max(0, y | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const k = yy * W + xx;
    LR[k] += cr * i; LG[k] += cg * i; LB[k] += cb * i;
  }
}

/** A figure on screen: its frame and the top left where it is drawn. */
export interface Figure { img: Img; x: number; y: number; flip: boolean }

/**
 * Lays each figure's silhouette on the ground away from its two strongest lights and takes those lights back
 * out of the ground there. The shadow is longer for a low or distant light, narrows when it falls sideways,
 * fades toward its tip, and stops at walls. Every figure also darkens a patch under its feet.
 */
export function castShadows(figs: Figure[]) {
  for (const fg of figs) {
    const { img: im } = fg;
    const fx = fg.x + im.w / 2, fy = fg.y + im.h - 1;
    if (fx < -20 || fy < -4 || fx > W + 20 || fy > H + 24) continue;
    for (let dx = -im.w / 2 - 1; dx <= im.w / 2; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (Math.abs(dy) === 1 && (dx < -im.w / 2 + 1 || dx > im.w / 2 - 2)) continue;
      const px = Math.round(fx + dx), py = Math.round(fy + dy + 1);
      if (px >= 0 && py >= 0 && px < W && py < H && emi[py * W + px] !== 2) SHD[py * W + px] = 1;
    }
    const near = FRAME_LIGHTS.map((l) => {
      const d2 = (fx - l.x) ** 2 + (fy - l.y) ** 2;
      const k = 1 - d2 / (l.r * l.r);
      return { l, f: k > 0 ? k * k * l.i : 0, d: Math.sqrt(d2) };
    }).filter((n) => n.f >= 0.12 && n.d > 2).sort((a, b) => b.f - a.f).slice(0, 2);
    for (const { l, f, d } of near) {
      const ux = (fx - l.x) / d, uy = (fy - l.y) / d;
      const len = Math.max(2, Math.min(14, (im.h * d) / (l.z + 6)));
      const ws = 1 - 0.4 * Math.abs(ux);
      const s = Math.min(1, f / 0.6) * 0.9;
      const r2 = l.r * l.r;
      for (let st = 0; st <= len; st++) {
        const row = im.h - 1 - Math.min(im.h - 1, Math.floor((st / (len + 1)) * im.h));
        const fade = s * (1 - 0.5 * (st / len));
        for (let x = 0; x < im.w; x++) {
          const sx = fg.flip ? im.w - 1 - x : x;
          if (im.px[row * im.w + sx] === 255) continue;
          const off = (x - im.w / 2 + 0.5) * ws;
          const px = Math.round(fx + ux * st - uy * off), py = Math.round(fy + 1 + uy * st + ux * off);
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const idx = py * W + px;
          if (emi[idx] === 2) continue;
          if (occluding && occ[Math.floor((py + MARGIN) / CELL) * GW + Math.floor((px + MARGIN) / CELL)]) continue;
          const dd = (px - l.x) ** 2 + (py - l.y) ** 2;
          if (dd >= r2) continue;
          const kk = 1 - dd / r2;
          const cut = kk * kk * l.i * fade;
          LR[idx] = Math.max(AR, LR[idx] - l.cr * cut);
          LG[idx] = Math.max(AG, LG[idx] - l.cg * cut);
          LB[idx] = Math.max(AB, LB[idx] - l.cb * cut);
        }
      }
    }
  }
}

/** Cool light from the sky haze on roof tops, so roofs read apart from the streets below them. */
export function addSkyLight(i: number) {
  if (i <= 0) return;
  for (let k = 0; k < W * H; k++) {
    if (!roof[k]) continue;
    LR[k] += 0.62 * i; LG[k] += 0.72 * i; LB[k] += 1.0 * i;
  }
}

/** Darkens a rectangle completely. */
export function blockLight(x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0);
  const y0 = Math.max(0, y | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = yy * W + xx; LR[i] = LG[i] = LB[i] = 0; }
}

/** Brightness at a screen pixel, for gameplay checks. */
export function lightAt(x: number, y: number): number {
  const i = Math.max(0, Math.min(H - 1, y | 0)) * W + Math.max(0, Math.min(W - 1, x | 0));
  return Math.max(LR[i], LG[i], LB[i]);
}

/** The light at a pixel as a palette index at a given brightness, for rain and spray. -1 when too dark. */
export function lightTint(i: number, gain: number, minLum: number): number {
  const lr = Math.max(0, LR[i]), lg = Math.max(0, LG[i]), lb = Math.max(0, LB[i]);
  const lum = Math.max(lr, lg, lb);
  if (lum < minLum) return -1;
  const s = Math.min(1.4, lum) * gain / lum;
  const IDX = indexLut();
  const r = Math.min(255, lr * s * 255), g = Math.min(255, lg * s * 255), b = Math.min(255, lb * s * 255);
  return IDX[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}

let OX = 0, OY = 0;
/** Anchors the dither pattern to the world so it does not crawl when the camera scrolls. */
export function setDitherOrigin(x: number, y: number) {
  const dx = x - OX, dy = y - OY;
  OX = x; OY = y;
  if (dx || dy) shiftLast(-dx, -dy);
}

const LAST_LIT = 1, LAST_UP = 2, LAST_DIM = 4, LAST_DARK = 8, LAST_SHADE = 16;
let SHADE = 0;
/** The district night color that dark world pixels dither through before black. */
export function setShade(c: number) { SHADE = c; }
const last = new Uint8Array(W * H);
const KEEP = 0.3;
const STICK = 0.07;

/** Applies the light to rows y0 to y1 and writes the result to ibuf and buf. */
export function composite(y0 = 0, y1 = H) {
  const IDX = indexLut();
  const RED = redLut();
  for (let y = y0; y < y1; y++) {
    const by = ((y + OY) & 3) * 4;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const kind = emi[i];
      const a0 = alb[i];
      if (kind === 1) { ibuf[i] = a0; buf[i] = PX[a0]; last[i] = LAST_LIT; continue; }
      const th = BAYER[by + ((x + OX) & 3)] + 0.5;
      const was = last[i];
      const lr = Math.max(0, LR[i]), lg = Math.max(0, LG[i]), lb = Math.max(0, LB[i]);
      const lum = Math.max(lr, lg, lb);
      let now = 0;
      if (kind !== 2 && lum <= th + (was & LAST_LIT ? -STICK : STICK)) {
        const sh = SHADE && a0 !== 0 && !SHD[i] && lum * 4 > th + (was & LAST_SHADE ? -STICK : STICK);
        // In the shade band a pixel keeps a dark step of its own ramp, so walls and floors stay readable.
        const d2 = DOWN[DOWN[a0]];
        const c = sh ? (d2 > 1 && LUMA[d2] > LUMA[SHADE] * 0.7 ? d2 : SHADE) : 0;
        ibuf[i] = c; buf[i] = PX[c]; last[i] = sh ? LAST_SHADE : 0;
        continue;
      }
      let [r, g, b] = RGB[a0];
      const red = isRed(a0);
      if (lum > 0 && !red) {
        const nr = lr / lum, ng = lg / lum, nb = lb / lum;
        const sat = 1 - Math.min(nr, ng, nb);
        const m = Math.max(0, Math.min(1 - KEEP, sat * 1.3 * (1 - KEEP) + (th - 0.5) * 0.25));
        const Y = (0.3 * r + 0.59 * g + 0.11 * b) * 1.15 + 34;
        r += (Y * nr - r) * m;
        g += (Y * ng - g) * m;
        b += (Y * nb - b) * m;
        r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
      }
      let a = red ? a0 : IDX[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      if (red && lum > 0) a = RED[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      if (kind === 2) {
        if (lum < (was & LAST_DIM ? 0.56 : 0.48)) { a = DOWN[a]; now |= LAST_DIM; }
        if (lum < (was & LAST_DARK ? 0.1 : 0.06)) { a = DOWN[a]; now |= LAST_DARK; }
        if (a === 0 && a0 !== 0) a = 1;
      }
      if (SHD[i] && kind !== 2) a = DOWN[DOWN[a]];
      else if (lum > 1.45 + th * 0.7 + (was & LAST_UP ? -STICK : STICK)) { a = UP[a]; now |= LAST_UP; }
      ibuf[i] = a;
      buf[i] = PX[a];
      last[i] = now | LAST_LIT;
    }
  }
}

function shiftLast(dx: number, dy: number) {
  if (Math.abs(dx) >= W || Math.abs(dy) >= H) { last.fill(0); return; }
  const tmp = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= H) continue;
    for (let x = 0; x < W; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= W) continue;
      tmp[y * W + x] = last[sy * W + sx];
    }
  }
  last.set(tmp);
}

/** The dither threshold at a screen pixel, anchored to the world. */
export function ditherAt(x: number, y: number): number { return BAYER[(((y + OY) & 3) << 2) | ((x + OX) & 3)] + 0.5; }

/** Forgets last frame's pixel states, after a cut or a map change. */
export function resetHysteresis() { last.fill(0); }
