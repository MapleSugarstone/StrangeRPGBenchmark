// The master palette. Every frame is snapped to these colors before it reaches the screen.

/** Hue ramps, darkest first. Light moves a pixel along its own ramp. */
export const RAMPS: number[][] = [
  [0x000000, 0x07060b, 0x141022, 0x2a2440, 0x4e4466, 0x8a8270, 0xc8c0a8, 0xefe6cf, 0xffffff],
  [0x2e1c10, 0x5a3818, 0x8a6430, 0xc8963c, 0xf0cc6c, 0xfbe8c0],
  [0x1e0f28, 0x4a1f44, 0x8c3a44, 0xd8683c, 0xf4a850],
  [0x5a1a1a, 0xa04a28, 0xe0483c, 0xff98a0],
  [0x0a0e2c, 0x16204c, 0x244c84, 0x2c8494, 0x64c8b0, 0xe0f4f0],
  [0x2e1e4a, 0x6a2cc0, 0xa070e0, 0xc4a0e4],
  [0x4a1240, 0xb03c8c, 0xf03cc4, 0xff98e0],
  [0x2830b8, 0x48f0e4, 0xc8f8f4],
  [0x1c3a24, 0x1c6c38, 0x40d868, 0xa8f040],
  [0x6a5010, 0xb08c1c, 0xe8c838, 0xf4e08c],
  [0x6a3a2a, 0x9a6a4a, 0xd89a78],
  [0x3a4a6a, 0x5a84ff, 0x9cc0d8, 0xdceeff],
  [0x3a2a1a, 0x6a5a40, 0xa08a60, 0xc8b890, 0xe8dcb8],
  [0x7a2a40, 0xc05068, 0xe07088, 0xf4b0b8],
];

export const MASTER: number[] = RAMPS.flat();
const N = MASTER.length;
const rgb = MASTER.map(c => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]);

function pxOf(c: number): number {
  return (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
}

/** Canvas pixel (little-endian ABGR) for each master index. */
export const PX = new Uint32Array(MASTER.map(pxOf));

function nearest(R: number, G: number, B: number): number {
  let best = 0, bestD = Infinity;
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

/** A 32x32x32 table from 5-bit color to the nearest master index. */
export function indexLut(): Uint8Array {
  if (idx) return idx;
  idx = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) idx[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4);
  return idx;
}

/** One step lighter along the pixel's own ramp. The top of a ramp burns to white. */
export const UP = new Uint8Array(N);
/** One step darker along the pixel's own ramp. The bottom stays put. */
export const DOWN = new Uint8Array(N);
{
  const white = MASTER.indexOf(0xffffff);
  let i = 0;
  for (const r of RAMPS) for (let j = 0; j < r.length; j++, i++) { UP[i] = j + 1 < r.length ? i + 1 : white; DOWN[i] = j > 0 ? i - 1 : i; }
}

/** Snaps a whole RGBA buffer to the master palette in place. */
export function snapBuffer(buf: Uint32Array, from = 0, to = buf.length): void {
  const t = indexLut();
  for (let i = from; i < to; i++) {
    const p = buf[i];
    buf[i] = PX[t[(((p & 0xff) >> 3) << 10) | ((((p >> 8) & 0xff) >> 3) << 5) | (((p >> 16) & 0xff) >> 3)]];
  }
}
