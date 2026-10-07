// The Asterisk-8 master palette. Every frame is snapped to these colors before it reaches the screen.

/** Thirty-two colors in hue ramps, darkest first. Light moves a pixel along its ramp. */
export const RAMPS: number[][] = [
  [0x000000, 0x2a2833, 0x4e4a5c, 0xaaa4ba, 0xe6dfd0, 0xffffff],
  [0x2a1a18, 0x8a3e2a, 0xc25a3a, 0xf2a070],
  [0x7a5a1a, 0xc2a05a, 0xf2d25a],
  [0x123a3c, 0x2a8a8a, 0x6fe3e0],
  [0x1e2440, 0x3e5a74, 0x6f8cff],
  [0x2e1e4a, 0x6a5a98, 0xa99ad8],
  [0x5a2a4a, 0xb05a8a, 0xe07aa0],
  [0x1e3a1e, 0x4a6a3a, 0x8fe08a],
  [0x5a7a1a, 0xc8ff2e],
  [0x8a1a1a, 0xff3a3a],
];

export const MASTER: number[] = RAMPS.flat();

const SIZE = 32;
const N = MASTER.length;
const rgb = MASTER.map((c) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]);

function pxOf(c: number): number {
  return (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
}

/** Buffer pixel for each master index. */
export const PX = new Uint32Array(MASTER.map(pxOf));

function nearest(R: number, G: number, B: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < N; i++) {
    const [pr, pg, pb] = rgb[i];
    const rm = (R + pr) / 2;
    const dr = R - pr, dg = G - pg, db = B - pb;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

let idx: Uint8Array | null = null;
let lut: Uint32Array | null = null;

/** A 32x32x32 table from 5-bit color to the nearest master index. */
export function indexLut(): Uint8Array {
  if (idx) return idx;
  idx = new Uint8Array(SIZE * SIZE * SIZE);
  for (let r = 0; r < SIZE; r++) for (let g = 0; g < SIZE; g++) for (let b = 0; b < SIZE; b++) {
    idx[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4);
  }
  return idx;
}

/** The same table, giving buffer pixels. */
export function paletteLut(): Uint32Array {
  if (lut) return lut;
  const t = indexLut();
  lut = new Uint32Array(t.length);
  for (let i = 0; i < t.length; i++) lut[i] = PX[t[i]];
  return lut;
}

/** Snaps a buffer pixel to the master palette. */
export function snap(p: number, table: Uint32Array): number {
  const r = p & 0xff, g = (p >> 8) & 0xff, b = (p >> 16) & 0xff;
  return table[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}

/** One step lighter along the pixel's own ramp. The top of a ramp burns to white. */
export const UP = new Uint8Array(N);
/** One step darker along the pixel's own ramp. The bottom of a ramp stays put. */
export const DOWN = new Uint8Array(N);
{
  const white = MASTER.indexOf(0xffffff);
  let i = 0;
  for (const r of RAMPS) {
    for (let j = 0; j < r.length; j++, i++) { UP[i] = j + 1 < r.length ? i + 1 : white; DOWN[i] = j > 0 ? i - 1 : i; }
  }
}
