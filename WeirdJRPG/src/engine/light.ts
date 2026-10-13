// Lighting: lights add colored light per pixel, walls block it on a 4 pixel grid, and the composite dithers
// each world pixel between its palette color and black. Adapted from the retro-palette-lighting skill.
import { DOWN, PX, UP, indexLut } from './palette';
import { W, H } from './screen';

export type RGB = [number, number, number];

/** Frame buffer (canvas ABGR), pixel class (0 world, 1 emissive, 2 sprite), and sprite normals. */
export const buf = new Uint32Array(W * H);
export const emi = new Uint8Array(W * H);
export const nrm = new Int8Array(W * H * 2);

const LR = new Float32Array(W * H);
const LG = new Float32Array(W * H);
const LB = new Float32Array(W * H);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

const CELL = 4;
const MARGIN = 64;
const GW = (W + MARGIN * 2) / CELL;
const GH = (H + MARGIN * 2) / CELL;
const occ = new Uint8Array(GW * GH);
const vis = new Float32Array(GW * GH);
let occluding = false;

export function rgbf(c: number): RGB { return [((c >> 16) & 0xff) / 255, ((c >> 8) & 0xff) / 255, (c & 0xff) / 255]; }
export function hex(s: string): number { return parseInt(s.slice(1), 16); }

/** Starts a lit frame. `blocks(sx, sy)` says whether a screen point lies inside something opaque. */
export function beginLight(ambient: RGB, blocks: ((sx: number, sy: number) => boolean) | null): void {
  LR.fill(ambient[0]); LG.fill(ambient[1]); LB.fill(ambient[2]);
  occluding = !!blocks;
  if (blocks) {
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      occ[gy * GW + gx] = blocks(gx * CELL - MARGIN + CELL / 2, gy * CELL - MARGIN + CELL / 2) ? 1 : 0;
    }
  }
}

function computeVis(x: number, y: number, gx0: number, gy0: number, gx1: number, gy1: number): void {
  const lx = Math.floor((x + MARGIN) / CELL), ly = Math.floor((y + MARGIN) / CELL);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
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

export interface LightOpts { z?: number; negative?: boolean; through?: boolean }

/** Adds a light centered on a screen pixel. Color is 0xRRGGBB. */
export function addLight(x: number, y: number, r: number, i: number, color = 0xffffff, o: LightOpts = {}): void {
  if (r <= 1 || i <= 0) return;
  const [cr, cg, cb] = rgbf(color);
  const sgn = o.negative ? -1 : 1;
  const z = o.z ?? 16;
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r));
  if (x0 > x1 || y0 > y1) return;
  const useVis = occluding && !o.through;
  if (useVis) {
    const gx0 = Math.max(0, Math.floor((x0 + MARGIN) / CELL)), gy0 = Math.max(0, Math.floor((y0 + MARGIN) / CELL));
    const gx1 = Math.min(GW - 1, Math.floor((x1 + MARGIN) / CELL)), gy1 = Math.min(GH - 1, Math.floor((y1 + MARGIN) / CELL));
    computeVis(x, y, gx0, gy0, gx1, gy1);
  }
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
      if (useVis) { const v = vis[gy * GW + Math.floor((px + MARGIN) / CELL)]; if (v <= 0) continue; f *= v; }
      const idx = py * W + px;
      const nx = nrm[idx * 2], ny = nrm[idx * 2 + 1];
      if (nx !== 0 || ny !== 0) {
        const fx = nx / 100, fy = ny / 100;
        const fz = Math.sqrt(Math.max(0, 1 - fx * fx - fy * fy));
        const len = Math.sqrt(d2 + z * z) || 1;
        f *= 0.25 + 1.05 * Math.max(0, (-dx * fx - dy * fy + z * fz) / len);
      }
      f *= sgn;
      LR[idx] += cr * f; LG[idx] += cg * f; LB[idx] += cb * f;
    }
  }
}

/** Brightness at a screen pixel. */
export function lightAt(x: number, y: number): number {
  const i = Math.max(0, Math.min(H - 1, y | 0)) * W + Math.max(0, Math.min(W - 1, x | 0));
  return (LR[i] + LG[i] + LB[i]) / 3;
}

/** Builds outward-leaning normals for sprite pixels from their silhouette in the frame. */
export function spriteNormals(): void {
  nrm.fill(0);
  const isS = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && emi[y * W + x] === 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (emi[i] !== 2) continue;
    let gx = 0, gy = 0;
    for (let d = 1; d <= 2; d++) {
      const w = d === 1 ? 1 : 0.5;
      if (!isS(x - d, y)) gx -= w;
      if (!isS(x + d, y)) gx += w;
      if (!isS(x, y - d)) gy -= w;
      if (!isS(x, y + d)) gy += w;
    }
    const len = Math.sqrt(gx * gx + gy * gy + 1.4);
    nrm[i * 2] = Math.round((gx / len) * 100);
    nrm[i * 2 + 1] = Math.round((gy / len) * 100) || -1;
  }
}

const LAST_LIT = 1, LAST_UP = 2, LAST_DIM = 4, LAST_DARK = 8;
const last = new Uint8Array(W * H);
const KEEP = 0.3;
const STICK = 0.07;

/**
 * Applies the light to rows y0 to y1. Overlapping colored lights sum, so the overlap takes their mixed hue.
 * Below full light a world pixel is its palette color or black, by ordered dither. Sprites step down their ramp instead.
 */
export function composite(y0 = 0, y1 = H): void {
  const IDX = indexLut();
  for (let y = y0; y < y1; y++) {
    const by = (y & 3) * 4;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const kind = emi[i];
      if (kind === 1) { const p = buf[i]; buf[i] = PX[IDX[(((p & 0xff) >> 3) << 10) | ((((p >> 8) & 0xff) >> 3) << 5) | (((p >> 16) & 0xff) >> 3)]]; last[i] = LAST_LIT; continue; }
      const th = BAYER[by + (x & 3)] + 0.5;
      const was = last[i];
      const lr = Math.max(0, LR[i]), lg = Math.max(0, LG[i]), lb = Math.max(0, LB[i]);
      const lum = Math.max(lr, lg, lb);
      let now = 0;
      if (kind !== 2 && lum <= th + (was & LAST_LIT ? -STICK : STICK)) { buf[i] = 0xff000000; last[i] = 0; continue; }
      const p = buf[i];
      let r = p & 0xff, g = (p >> 8) & 0xff, b = (p >> 16) & 0xff;
      if (lum > 0) {
        const nr = lr / lum, ng = lg / lum, nb = lb / lum;
        const sat = 1 - Math.min(nr, ng, nb);
        const m = Math.max(0, Math.min(1 - KEEP, sat * 1.3 * (1 - KEEP) + (th - 0.5) * 0.25));
        const Y = (0.3 * r + 0.59 * g + 0.11 * b) * 1.15 + 34;
        r += (Y * nr - r) * m; g += (Y * ng - g) * m; b += (Y * nb - b) * m;
        r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
      }
      let a = IDX[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      if (kind === 2) {
        if (lum < (was & LAST_DIM ? 0.8 : 0.7)) { a = DOWN[a]; now |= LAST_DIM; }
        if (lum < (was & LAST_DARK ? 0.34 : 0.26)) { a = DOWN[a]; now |= LAST_DARK; }
      }
      if (lum > 1.15 + th * 0.6 + (was & LAST_UP ? -STICK : STICK)) { a = UP[a]; now |= LAST_UP; }
      buf[i] = PX[a];
      last[i] = now | LAST_LIT;
    }
  }
}

/** Forgets last frame's pixel states, for a cut to a new scene. */
export function resetLight(): void { last.fill(0); }
