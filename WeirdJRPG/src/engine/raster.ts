// A software rasterizer into the light buffer, so a lit frame needs no canvas readback.
import type { Art } from './sprites';
import { buf, emi } from './light';
import { W, H } from './screen';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const cache = new Map<string, number>();

/** A hex color as a canvas pixel (little-endian ABGR). */
export function px32(c: string): number {
  let v = cache.get(c);
  if (v === undefined) {
    const n = parseInt(c.slice(1), 16);
    v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    cache.set(c, v);
  }
  return v;
}

export function rfill(x: number, y: number, w: number, h: number, c: string, cls = 0): void {
  const v = px32(c);
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * W;
    buf.fill(v, row + x0, row + x1);
    emi.fill(cls, row + x0, row + x1);
  }
}

export function rpx(x: number, y: number, c: string, cls = 0): void {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = px32(c);
  emi[y * W + x] = cls;
}

/** Covers `level` of the area with color c in a fixed 4 by 4 ordered dither. */
export function rdither(x: number, y: number, w: number, h: number, c: string, level: number, cls = 0): void {
  const steps = Math.max(0, Math.min(16, Math.ceil(level * 16)));
  if (!steps) return;
  const v = px32(c);
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    if (BAYER[((yy & 3) << 2) | (xx & 3)] >= steps) continue;
    buf[yy * W + xx] = v; emi[yy * W + xx] = cls;
  }
}

/** Draws a sprite: '0' ink, '1' and '2' colors. `level` below 1 keeps that share of its pixels by ordered dither. */
export function rart(art: Art, x: number, y: number, c1: string, c2: string, ink: string, flip = false, cls = 0, level = 1): void {
  x = Math.round(x); y = Math.round(y);
  const h = art.length, w = art[0]?.length || 0;
  const v1 = px32(c1), v2 = px32(c2), v0 = px32(ink);
  const steps = level >= 1 ? 16 : Math.max(1, Math.min(15, Math.round(level * 16)));
  for (let r = 0; r < h; r++) {
    const yy = y + r;
    if (yy < 0 || yy >= H) continue;
    const row = art[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ' || ch === undefined) continue;
      const xx = x + (flip ? w - 1 - c : c);
      if (xx < 0 || xx >= W) continue;
      if (steps < 16 && BAYER[((yy & 3) << 2) | (xx & 3)] >= steps) continue;
      const i = yy * W + xx;
      buf[i] = ch === '0' ? v0 : ch === '1' ? v1 : v2;
      emi[i] = cls;
    }
  }
}

/** One-pixel ring outside a sprite's filled pixels. */
export function routline(art: Art, x: number, y: number, c: string, flip = false, cls = 0): void {
  x = Math.round(x); y = Math.round(y);
  const h = art.length, w = art[0]?.length || 0;
  const v = px32(c);
  const filled = (cc: number, rr: number) => rr >= 0 && rr < h && cc >= 0 && cc < w && art[rr][cc] !== '.' && art[rr][cc] !== ' ';
  for (let rr = -1; rr <= h; rr++) for (let cc = -1; cc <= w; cc++) {
    if (filled(cc, rr)) continue;
    if (!(filled(cc - 1, rr) || filled(cc + 1, rr) || filled(cc, rr - 1) || filled(cc, rr + 1))) continue;
    const xx = x + (flip ? w - 1 - cc : cc), yy = y + rr;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    buf[yy * W + xx] = v; emi[yy * W + xx] = cls;
  }
}

/** Draws a sprite's silhouette in one color. */
export function rsil(art: Art, x: number, y: number, c: string, flip = false, cls = 0): void {
  rart(art, x, y, c, c, c, flip, cls);
}
