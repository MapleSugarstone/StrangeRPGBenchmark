// Sprites, tiles, leads, and interface boxes. Sprites are drawn from text: '.' is clear, '1' '2' '3' are the
// three color slots. Every sprite keeps to three colors, usually black plus two.
import { normalsOf } from './normals';
import { PX, C } from './palette';
import { BAYER } from './light';
import { H, W, buf, emi, nrm, shd } from './screen';

export interface Img {
  w: number;
  h: number;
  /** Palette index per pixel, 255 for clear. */
  px: Uint8Array;
  /** Slot per pixel (0 clear, 1 to 3), for normals and masks. */
  slot: Uint8Array;
  nrm: Int8Array;
}

/** Builds an image from rows of slot characters and a three-color palette. */
export function img(rows: string[], pal: readonly number[]): Img {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Uint8Array(w * h).fill(255);
  const slot = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      const s = ch === '1' ? 1 : ch === '2' ? 2 : ch === '3' ? 3 : 0;
      if (!s) continue;
      slot[y * w + x] = s;
      px[y * w + x] = pal[s - 1];
    }
  }
  return { w, h, px, slot, nrm: normalsOf(slot, w, h) };
}

/** The same image with different colors. */
export function recolor(src: Img, pal: readonly number[]): Img {
  const px = new Uint8Array(src.px.length).fill(255);
  for (let i = 0; i < px.length; i++) if (src.slot[i]) px[i] = pal[src.slot[i] - 1];
  return { ...src, px };
}

export interface BlitOpts {
  flip?: boolean;
  /** 0 world, 1 emissive, 2 sprite. */
  kind?: number;
  /** Draw only rows of the image above this many pixels from its bottom (for wading). */
  cutBottom?: number;
  /** Solid color override for every opaque pixel (flashes, silhouettes). */
  tint?: number;
  /** Dither the sprite away: 0 solid, 1 gone. */
  fade?: number;
}

/** Draws an image into the frame with its normals and light class. */
export function blit(im: Img, x: number, y: number, o: BlitOpts = {}) {
  const kind = o.kind ?? 2;
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
      const di = sy * W + sx;
      if (o.fade && o.fade > 0 && BAYER[((sy & 3) << 2) | (sx & 3)] + 0.5 < o.fade) continue;
      buf[di] = PX[o.tint ?? c];
      emi[di] = kind;
      if (kind === 2) {
        nrm[di * 2] = o.flip ? -im.nrm[si * 2] : im.nrm[si * 2];
        nrm[di * 2 + 1] = im.nrm[si * 2 + 1];
      } else {
        nrm[di * 2] = 0;
        nrm[di * 2 + 1] = 0;
      }
    }
  }
}

/**
 * Stamps an image's lead into the shade layer: the silhouette swept along (dx, dy) for `len` pixels.
 * The sweep starts at the image's feet, so a lead lies on the ground and runs away from the light.
 */
export function stampLead(im: Img, x: number, y: number, dx: number, dy: number, len: number, flip = false, strength = 255, keep = 0.45) {
  if (len <= 0) return;
  const x0 = Math.round(x), y0 = Math.round(y);
  const base = y0 + im.h - 1;
  // Each pixel lands on the ground at a distance set by its height above the feet, so the lead is the figure
  // sheared away from the light. `keep` is how much of the figure's height survives as the lead's thickness.
  const k = len / Math.max(1, im.h);
  const sub = Math.max(1, Math.ceil(Math.hypot(dx * k, dy * k - keep)));
  for (let yy = 0; yy < im.h; yy++) {
    const hgt = im.h - 1 - yy;
    for (let xx = 0; xx < im.w; xx++) {
      const srcX = flip ? im.w - 1 - xx : xx;
      if (!im.slot[yy * im.w + srcX]) continue;
      for (let s = 0; s < sub; s++) {
        const hh = hgt + s / sub;
        const px = Math.round(x0 + xx + dx * k * hh);
        const py = Math.round(base + dy * k * hh - keep * hh);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = py * W + px;
        if (emi[i] === 2) continue;
        if (shd[i] < strength) shd[i] = strength;
      }
    }
  }
}

/** Stamps a rectangle's lead (for walls and props drawn as blocks). */
export function stampBlockLead(x: number, y: number, w: number, h: number, height: number, dx: number, dy: number, lowness: number) {
  const len = height * lowness;
  if (len <= 0) return;
  const steps = Math.ceil(len);
  for (let k = 1; k <= steps; k++) {
    const ox = Math.round(x + dx * k), oy = Math.round(y + dy * k);
    for (let yy = oy; yy < oy + h; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = ox; xx < ox + w; xx++) {
        if (xx < 0 || xx >= W) continue;
        const i = yy * W + xx;
        if (emi[i] === 2) continue;
        shd[i] = 255;
      }
    }
  }
}

/** Fills a rectangle with one palette color. UI layer: call after the composite. */
export function rect(x: number, y: number, w: number, h: number, color: number) {
  const px = PX[color];
  const x0 = Math.max(0, Math.round(x)), x1 = Math.min(W, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) buf.fill(px, yy * W + x0, yy * W + x1);
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

/** Darkens the whole frame toward black by ordered dither, for fades. */
export function fadeFrame(t: number, color: number = C.black) {
  if (t <= 0) return;
  const p = PX[color];
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    if (BAYER[((yy & 3) << 2) | (xx & 3)] + 0.5 < t) buf[yy * W + xx] = p;
  }
}

/** A framed interface box: a dark fill, a one-pixel light border, and a one-pixel dark rim outside it. */
export function box(x: number, y: number, w: number, h: number, fill: number = C.ink, border: number = C.pale) {
  rect(x - 1, y - 1, w + 2, h + 2, C.black);
  rect(x, y, w, h, border);
  rect(x + 1, y + 1, w - 2, h - 2, fill);
}

/** A horizontal line. */
export function hline(x: number, y: number, w: number, color: number) { rect(x, y, w, 1, color); }

/** Draws an image straight into the UI layer with no lighting. */
export function blitUI(im: Img, x: number, y: number, flip = false, tint?: number) {
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let yy = 0; yy < im.h; yy++) {
    const sy = y0 + yy;
    if (sy < 0 || sy >= H) continue;
    for (let xx = 0; xx < im.w; xx++) {
      const sx = x0 + xx;
      if (sx < 0 || sx >= W) continue;
      const c = im.px[yy * im.w + (flip ? im.w - 1 - xx : xx)];
      if (c === 255) continue;
      buf[sy * W + sx] = PX[tint ?? c];
    }
  }
}
