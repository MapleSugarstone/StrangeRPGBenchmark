// The frame buffer holds palette indexes. Every draw call writes indexes, and present() converts them once a frame.
import { GLYPH_SRC } from './glyphs';

export const W = 256, H = 256;

export const PAL: [number, number, number][] = [
  [0, 0, 0],
  [239, 230, 207], [226, 214, 181], [205, 189, 147], [163, 154, 130], [31, 27, 36], [93, 74, 58],
  [222, 190, 126], [189, 147, 82], [126, 96, 52],
  [150, 170, 208], [78, 98, 152], [37, 46, 88],
  [228, 170, 158], [184, 108, 100], [112, 58, 62],
  [174, 206, 168], [98, 150, 114], [46, 92, 72],
  [207, 166, 242], [148, 87, 207], [90, 47, 138],
  [251, 247, 234],
  [232, 64, 42], [246, 196, 60], [242, 138, 26], [18, 165, 196], [212, 47, 142],
  [18, 48, 94], [31, 74, 140], [111, 147, 204], [207, 226, 255],
  [62, 160, 84], [150, 30, 30], [255, 216, 74], [120, 110, 96],
];

export const C = {
  none: 0, paper: 1, paper2: 2, paper3: 3, pencil: 4, ink: 5, sepia: 6,
  road1: 7, road2: 8, road3: 9, well1: 10, well2: 11, well3: 12, town1: 13, town2: 14, town3: 15, peak1: 16, peak2: 17, peak3: 18,
  doubt1: 19, doubt2: 20, doubt3: 21, white: 22,
  perch: 23, gold: 24, auger: 25, offset: 26, lot: 27,
  bp0: 28, bp1: 29, bp2: 30, bp3: 31, ok: 32, warn: 33, hi: 34, gray: 35,
};

export const buf = new Uint8Array(W * H);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

let stencil: ((x: number, y: number) => boolean) | null = null;
let cx0 = 0, cy0 = 0, cx1 = W, cy1 = H;

export function setStencil(fn: ((x: number, y: number) => boolean) | null): void { stencil = fn; }
export function setClip(x: number, y: number, w: number, h: number): void { cx0 = Math.max(0, x); cy0 = Math.max(0, y); cx1 = Math.min(W, x + w); cy1 = Math.min(H, y + h); }
export function noClip(): void { cx0 = 0; cy0 = 0; cx1 = W; cy1 = H; }

export function px(x: number, y: number, c: number): void {
  if (x < cx0 || y < cy0 || x >= cx1 || y >= cy1 || c === 0) return;
  if (stencil && !stencil(x, y)) return;
  buf[y * W + x] = c;
}

export function get(x: number, y: number): number {
  return x < 0 || y < 0 || x >= W || y >= H ? 0 : buf[y * W + x];
}

export function rect(x: number, y: number, w: number, h: number, c: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c);
}

export function frame(x: number, y: number, w: number, h: number, c: number): void {
  for (let i = 0; i < w; i++) { px(x + i, y, c); px(x + i, y + h - 1, c); }
  for (let j = 0; j < h; j++) { px(x, y + j, c); px(x + w - 1, y + j, c); }
}

export function line(x0: number, y0: number, x1: number, y1: number, c: number): void {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 600; n++) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  void dx; void dy;
}

/** True where an ordered dither of the given level (0 to 16) is on. */
export function bayer(x: number, y: number, level: number): boolean {
  return BAYER[((y & 3) << 2) | (x & 3)] < level;
}

export function dither(x: number, y: number, w: number, h: number, c: number, level: number, ox = 0, oy = 0): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i + ox, y + j + oy, level)) px(x + i, y + j, c);
}

export function disc(x: number, y: number, r: number, c: number): void {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6) px(x + i, y + j, c);
}

export function ellipse(x: number, y: number, rx: number, ry: number, c: number): void {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx + 0.5) + (j * j) / (ry * ry + 0.5) <= 1) px(x + i, y + j, c);
}

export type Sprite = string[];
export type Inks = Record<string, number>;

export function sprite(rows: Sprite, x: number, y: number, inks: Inks, scale = 1, flip = false): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[flip ? row.length - 1 - i : i];
      if (ch === '.' || ch === ' ') continue;
      const c = inks[ch] ?? C.ink;
      if (scale === 1) px(x + i, y + j, c);
      else rect(x + i * scale, y + j * scale, scale, scale, c);
    }
  }
}

interface Glyph { w: number; rows: number[] }
const GLYPHS = new Map<string, Glyph>();
for (const [ch, src] of Object.entries(GLYPH_SRC)) {
  const rows = src.split(' ');
  GLYPHS.set(ch, { w: rows[0].length, rows: rows.map((r) => { let m = 0; for (let i = 0; i < r.length; i++) if (r[i] === '#') m |= 1 << i; return m; }) });
}
const MISSING = GLYPHS.get('?')!;

export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (GLYPHS.get(ch) ?? MISSING).w + 1;
  return Math.max(0, w - 1);
}

export function text(s: string, x: number, y: number, c: number = C.ink): number {
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS.get(ch) ?? MISSING;
    for (let j = 0; j < 8; j++) {
      const m = g.rows[j];
      if (!m) continue;
      for (let i = 0; i < g.w; i++) if (m & (1 << i)) px(cx + i, y + j, c);
    }
    cx += g.w + 1;
  }
  return cx - x;
}

/** Text drawn with each font pixel as a square of `scale` pixels. `pick` can choose an ink per pixel. */
export function textBig(s: string, x: number, y: number, scale: number, pick: (px0: number, py0: number) => number): number {
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS.get(ch) ?? MISSING;
    for (let j = 0; j < 8; j++) {
      const m = g.rows[j];
      if (!m) continue;
      for (let i = 0; i < g.w; i++) if (m & (1 << i)) {
        for (let b = 0; b < scale; b++) for (let a = 0; a < scale; a++) px(cx + i * scale + a, y + j * scale + b, pick(cx + i * scale + a, y + j * scale + b));
      }
    }
    cx += (g.w + 1) * scale;
  }
  return cx - x;
}

export function textRight(s: string, x: number, y: number, c: number = C.ink): void { text(s, x - textWidth(s), y, c); }
export function textCenter(s: string, x: number, y: number, c: number = C.ink): void { text(s, x - Math.floor(textWidth(s) / 2), y, c); }

export function wrap(s: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let lineText = '';
    for (const word of para.split(' ')) {
      const trial = lineText ? lineText + ' ' + word : word;
      if (textWidth(trial) <= maxW || !lineText) lineText = trial;
      else { out.push(lineText); lineText = word; }
    }
    out.push(lineText);
  }
  return out;
}

/** A paper panel with a one-pixel ink border and a drop shadow, the base of every menu and card. */
export function panel(x: number, y: number, w: number, h: number, fill: number = C.paper, edge: number = C.ink): void {
  rect(x + 2, y + 2, w, h, C.paper3);
  rect(x, y, w, h, fill);
  frame(x, y, w, h, edge);
}

let image: ImageData | null = null;
export function present(ctx: CanvasRenderingContext2D): void {
  if (!image) image = ctx.createImageData(W, H);
  const d = image.data;
  for (let i = 0, j = 0; i < buf.length; i++, j += 4) {
    const p = PAL[buf[i]];
    d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

export function clear(c: number): void { buf.fill(c); }

/** A small stable hash for per-cell art variation. */
export function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
