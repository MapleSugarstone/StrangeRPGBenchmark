// Images, world drawing, and interface drawing. Images come from text rows: '.' is clear, '0' is black,
// and '1' to '4' are color slots. World drawing writes albedo for the lighting pass. Interface drawing
// writes finished pixels and runs after the composite.
import { normalsOf } from './normals';
import { PX, C } from './palette';
import { BAYER } from './light';
import { H, W, alb, buf, emi, flo, nrm, roof } from './screen';
import { LAYOUT, area, ring, beginIcon, iconPixel, linePixel } from './layout';

export interface Img {
  w: number;
  h: number;
  /** Palette index per pixel, 255 for clear. */
  px: Uint8Array;
  /** Slot per pixel (0 clear, 1 to 4, 5 black, 6 and 7 the fifth and sixth colors), for normals and recolors. */
  slot: Uint8Array;
  nrm: Int8Array;
}

const SLOT: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '0': 5, '5': 6, '6': 7 };
const palOf = (pal: readonly number[], s: number) => (s === 5 ? C.black : pal[s >= 6 ? s - 2 : s - 1] ?? C.black);

/** Builds an image from rows of slot characters and a palette of up to five colors ('5' is the fifth). */
export function img(rows: string[], pal: readonly number[]): Img {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Uint8Array(w * h).fill(255);
  const slot = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = SLOT[rows[y][x] ?? '.'] ?? 0;
      if (!s) continue;
      slot[y * w + x] = s;
      px[y * w + x] = palOf(pal, s);
    }
  }
  return { w, h, px, slot, nrm: normalsOf(depthSlots(slot), w, h) };
}

/** Normals read black as a recess and the first slot as the main surface. */
function depthSlots(slot: Uint8Array): Uint8Array {
  const d = new Uint8Array(slot.length);
  for (let i = 0; i < slot.length; i++) d[i] = slot[i] === 0 ? 0 : slot[i] === 5 ? 1 : slot[i] === 4 ? 3 : 2;
  return d;
}

/** Builds an image straight from palette indices (255 clear). */
export function imgFromIdx(w: number, h: number, idx: Uint8Array): Img {
  const slot = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) slot[i] = idx[i] === 255 ? 0 : idx[i] === C.black ? 5 : 2;
  return { w, h, px: idx, slot, nrm: normalsOf(depthSlots(slot), w, h) };
}

/** The same image with different colors. */
export function recolor(src: Img, pal: readonly number[]): Img {
  const px = new Uint8Array(src.px.length).fill(255);
  for (let i = 0; i < px.length; i++) {
    const s = src.slot[i];
    if (s) px[i] = palOf(pal, s);
  }
  return { ...src, px };
}

export interface BlitOpts {
  flip?: boolean;
  /** 0 world, 1 emissive, 2 sprite. */
  kind?: number;
  /** Draw only rows of the image above this many pixels from its bottom (for wading). */
  cutBottom?: number;
  /** Solid color override for every opaque pixel (silhouettes, hush frost). */
  tint?: number;
  /** Dither the image away: 0 solid, 1 gone. */
  fade?: number;
  /** Floor class to write under the image (0 for standing things). */
  floor?: number;
  /** Pixels in this slot glow (drawn emissive). */
  glowSlot?: number;
}

/** Draws an image into the world layer with its normals and light class. */
export function blit(im: Img, x: number, y: number, o: BlitOpts = {}) {
  const kind = o.kind ?? 2;
  const fl = o.floor ?? 0;
  const x0 = Math.round(x), y0 = Math.round(y);
  const hMax = im.h - (o.cutBottom ?? 0);
  for (let yy = 0; yy < hMax; yy++) {
    const sy = y0 + yy;
    if (sy < 0 || sy >= H) continue;
    for (let xx = 0; xx < im.w; xx++) {
      const sx = x0 + xx;
      if (sx < 0 || sx >= W) continue;
      const srcX = o.flip ? im.w - 1 - xx : xx;
      const si = yy * im.w + srcX;
      const c = im.px[si];
      if (c === 255) continue;
      if (o.fade && o.fade > 0 && BAYER[((sy & 3) << 2) | (sx & 3)] + 0.5 < o.fade) continue;
      const di = sy * W + sx;
      alb[di] = o.tint ?? c;
      emi[di] = o.glowSlot && !o.tint && im.slot[si] === o.glowSlot ? 1 : kind;
      flo[di] = fl;
      if (kind === 2) roof[di] = 0;
      if (kind === 2 || kind === 0) {
        nrm[di * 2] = o.flip ? -im.nrm[si * 2] : im.nrm[si * 2];
        nrm[di * 2 + 1] = im.nrm[si * 2 + 1];
      } else {
        nrm[di * 2] = 0;
        nrm[di * 2 + 1] = 0;
      }
    }
  }
}

/** Fills a world rectangle with one albedo color. */
export function wrect(x: number, y: number, w: number, h: number, color: number, kind = 0, floor = 0) {
  const x0 = Math.max(0, Math.round(x)), x1 = Math.min(W, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = yy * W + xx;
      alb[i] = color; emi[i] = kind; flo[i] = floor; nrm[i * 2] = 0; nrm[i * 2 + 1] = 0;
    }
  }
}

/** Sets one world pixel. */
export function wpx(x: number, y: number, color: number, kind = 0, floor = -1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  alb[i] = color; emi[i] = kind;
  if (floor >= 0) flo[i] = floor;
  nrm[i * 2] = 0; nrm[i * 2 + 1] = 0;
}

/** Fills a rectangle with one palette color. Interface layer: call after the composite. */
export function rect(x: number, y: number, w: number, h: number, color: number) {
  const px = PX[color];
  const x0 = Math.max(0, Math.round(x)), x1 = Math.min(W, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) buf.fill(px, yy * W + x0, yy * W + x1);
  if (LAYOUT.on) area(x0, y0, x1, y1, Math.min(w, h) <= 3);
}

/** Sets one interface pixel. */
export function upx(x: number, y: number, color: number) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = PX[color];
}

/** Fills a rectangle with an ordered-dither mix of two colors. `t` is how much of b shows. */
export function ditherRect(x: number, y: number, w: number, h: number, a: number, b: number, t: number) {
  const pa = PX[a], pb = PX[b];
  const x0 = Math.max(0, Math.round(x)), x1 = Math.min(W, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    buf[yy * W + xx] = BAYER[((yy & 3) << 2) | (xx & 3)] + 0.5 < t ? pb : pa;
  }
}

/** Darkens part of the finished frame toward a color by ordered dither. */
export function shadeRect(x: number, y: number, w: number, h: number, t: number, color: number = C.black) {
  if (t <= 0) return;
  const p = PX[color];
  const x0 = Math.max(0, Math.round(x)), x1 = Math.min(W, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    if (BAYER[((yy & 3) << 2) | (xx & 3)] + 0.5 < t) buf[yy * W + xx] = p;
  }
}

/** Darkens the whole frame toward black by ordered dither, for fades. */
export function fadeFrame(t: number, color: number = C.black) { shadeRect(0, 0, W, H, t, color); }

/** A framed interface box: a dark fill, a one-pixel border, and a one-pixel black rim outside it. */
export function box(x: number, y: number, w: number, h: number, fill: number = C.ink, border: number = C.slate) {
  rect(x - 1, y - 1, w + 2, h + 2, C.black);
  rect(x, y, w, h, border);
  rect(x + 1, y + 1, w - 2, h - 2, fill);
  if (LAYOUT.on) ring(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A horizontal interface line. */
export function hline(x: number, y: number, w: number, color: number) { rect(x, y, w, 1, color); }
export function vline(x: number, y: number, h: number, color: number) { rect(x, y, 1, h, color); }

/** Draws an image straight into the interface layer with no lighting. */
export function blitUI(im: Img, x: number, y: number, flip = false, tint?: number) {
  const x0 = Math.round(x), y0 = Math.round(y);
  const rec = LAYOUT.on;
  if (rec) beginIcon(x0, y0);
  for (let yy = 0; yy < im.h; yy++) {
    const sy = y0 + yy;
    if (sy < 0 || sy >= H) continue;
    for (let xx = 0; xx < im.w; xx++) {
      const sx = x0 + xx;
      if (sx < 0 || sx >= W) continue;
      const c = im.px[yy * im.w + (flip ? im.w - 1 - xx : xx)];
      if (c === 255) continue;
      buf[sy * W + sx] = PX[tint ?? c];
      if (rec) iconPixel(sy * W + sx);
    }
  }
}

/** Outline of a rectangle in the interface layer. */
export function frame(x: number, y: number, w: number, h: number, color: number) {
  rect(x, y, w, 1, color); rect(x, y + h - 1, w, 1, color);
  rect(x, y, 1, h, color); rect(x + w - 1, y, 1, h, color);
}

/** Dotted outline for selection cursors: every other pixel. */
export function dotFrame(x: number, y: number, w: number, h: number, color: number, phase = 0) {
  for (let i = 0; i < w; i++) {
    if (((i + phase) & 1) === 0) { upx(x + i, y, color); upx(x + w - 1 - i, y + h - 1, color); }
  }
  for (let j = 0; j < h; j++) {
    if (((j + phase) & 1) === 0) { upx(x, y + h - 1 - j, color); upx(x + w - 1, y + j, color); }
  }
  if (LAYOUT.on) {
    for (let i = 0; i < w; i++) { linePixel(x + i, y); linePixel(x + i, y + h - 1); }
    for (let j = 0; j < h; j++) { linePixel(x, y + j); linePixel(x + w - 1, y + j); }
  }
}
