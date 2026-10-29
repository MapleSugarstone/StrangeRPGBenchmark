// Lighting. Light is added per frame, blocked by walls on a 4 pixel grid, and shaded by surface normals.
// The composite dithers each world pixel between its palette color and black, paints leads in the
// region's shade ramp, and steps sprite pixels down their ramp in the dark so figures stay readable.
import { DOWN, LUMA, PX, UP, indexLut, type ShadeRamp, SHADES } from './palette';
import { H, W, buf, emi, nrm, shd } from './screen';

export type RGB = [number, number, number];

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
let shade: ShadeRamp = SHADES.plum;

export function rgbf(c: number): RGB { return [((c >> 16) & 0xff) / 255, ((c >> 8) & 0xff) / 255, (c & 0xff) / 255]; }

/**
 * Starts a lit frame. `blocks(sx, sy)` says whether a screen point lies inside something opaque.
 * Pass null for scenes without walls.
 */
export function beginLight(ambient: RGB, blocks: ((sx: number, sy: number) => boolean) | null, shadeRamp: ShadeRamp = SHADES.plum) {
  LR.fill(ambient[0]);
  LG.fill(ambient[1]);
  LB.fill(ambient[2]);
  shade = shadeRamp;
  occluding = !!blocks;
  if (blocks) {
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        occ[gy * GW + gx] = blocks(gx * CELL - MARGIN + CELL / 2, gy * CELL - MARGIN + CELL / 2) ? 1 : 0;
      }
    }
  }
}

/** A directional light from a sun that never moves. `dx, dy` is the direction leads fall. */
export function addSun(dx: number, dy: number, z: number, intensity: number, color = 0xffffff) {
  if (intensity <= 0) return;
  const [cr, cg, cb] = rgbf(color);
  const lx = -dx, ly = -dy;
  const len = Math.sqrt(lx * lx + ly * ly + z * z) || 1;
  for (let i = 0; i < W * H; i++) {
    let f = intensity;
    const nx = nrm[i * 2], ny = nrm[i * 2 + 1];
    if (nx !== 0 || ny !== 0) {
      const fx = nx / 100, fy = ny / 100;
      const fz = Math.sqrt(Math.max(0, 1 - fx * fx - fy * fy));
      const dot = (lx * fx + ly * fy + z * fz) / len;
      f *= 0.3 + 1.0 * Math.max(0, dot);
    }
    LR[i] += cr * f;
    LG[i] += cg * f;
    LB[i] += cb * f;
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
}

/** Adds a point light centered on a screen pixel. Color is 0xRRGGBB. */
export function addLight(x: number, y: number, r: number, i: number, color = 0xffffff, o: LightOpts = {}) {
  if (r <= 1 || i <= 0) return;
  const [cr, cg, cb] = rgbf(color);
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

/** Adds a shaft of light from a window rectangle, swept along a direction. Used for sun through windows. */
export function addShaft(x: number, y: number, w: number, h: number, dx: number, dy: number, length: number, i: number, color = 0xffffff) {
  const [cr, cg, cb] = rgbf(color);
  const steps = Math.ceil(length);
  const lit = new Uint8Array(W * H);
  for (let k = 0; k <= steps; k++) {
    const ox = Math.round(x + dx * k), oy = Math.round(y + dy * k);
    for (let yy = oy; yy < oy + h; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = ox; xx < ox + w; xx++) {
        if (xx < 0 || xx >= W) continue;
        const idx = yy * W + xx;
        if (lit[idx]) continue;
        lit[idx] = 1;
        const f = i * (1 - (k / (steps + 1)) * 0.6);
        LR[idx] += cr * f;
        LG[idx] += cg * f;
        LB[idx] += cb * f;
      }
    }
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

const LAST_LIT = 1, LAST_UP = 2, LAST_DIM = 4, LAST_DARK = 8, LAST_SHADE = 16;
const last = new Uint8Array(W * H);
const KEEP = 0.3;
const STICK = 0.07;

/**
 * Applies the light to rows y0 to y1. Colored lights add, so where two overlap the hue is their mix.
 * The lit color snaps to the palette. Below full light a world pixel is its color or black by ordered dither.
 * A world pixel under a lead takes the shade ramp at its own brightness. Sprites step down instead of going black.
 */
export function composite(y0 = 0, y1 = H) {
  const IDX = indexLut();
  for (let y = y0; y < y1; y++) {
    const by = (y & 3) * 4;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const kind = emi[i];
      if (kind === 1) { last[i] = LAST_LIT; continue; }
      const th = BAYER[by + (x & 3)] + 0.5;
      const was = last[i];
      const lr = Math.max(0, LR[i]), lg = Math.max(0, LG[i]), lb = Math.max(0, LB[i]);
      const lum = Math.max(lr, lg, lb);
      let now = 0;
      if (kind !== 2 && lum <= th + (was & LAST_LIT ? -STICK : STICK)) { buf[i] = 0xff000000 | 0x10090b; last[i] = 0; continue; }
      const p = buf[i];
      let r = p & 0xff, g = (p >> 8) & 0xff, b = (p >> 16) & 0xff;
      if (lum > 0) {
        const nr = lr / lum, ng = lg / lum, nb = lb / lum;
        const sat = 1 - Math.min(nr, ng, nb);
        const m = Math.max(0, Math.min(1 - KEEP, sat * 1.3 * (1 - KEEP) + (th - 0.5) * 0.25));
        const Y = (0.3 * r + 0.59 * g + 0.11 * b) * 1.15 + 34;
        r += (Y * nr - r) * m;
        g += (Y * ng - g) * m;
        b += (Y * nb - b) * m;
        r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
      }
      let a = IDX[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      const cover = shd[i] / 255;
      if (cover > 0) {
        const inLead = cover > th + (was & LAST_SHADE ? -STICK : STICK) * 0.5;
        if (inLead) {
          now |= LAST_SHADE;
          if (kind === 2) a = DOWN[a];
          else {
            // A lead is one flat tone. Only the darkest marks of the ground (outlines, cracks) show through it.
            a = LUMA[a] < 0.16 ? shade[0] : shade[1];
          }
        }
      }
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
