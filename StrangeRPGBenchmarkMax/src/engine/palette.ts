// The master palette. Every lit pixel snaps to one of these colors, and dithering does the darkening.

/** Hue ramps, darkest first. Light moves a pixel along its own ramp. */
export const RAMPS: number[][] = [
  [0x0b0910, 0x2a2433, 0x4e4659, 0x7d7488, 0xb8afbd, 0xf4eee9],
  [0x26142c, 0x4a2647, 0x7a3e68],
  [0x5e3a14, 0xa8712a, 0xe3b04a, 0xffe49a],
  [0x441a17, 0x86321f, 0xc85a3a, 0xf09a6a],
  [0x33241b, 0x664532, 0xa0754f],
  [0x183428, 0x2d6644, 0x5e9e57, 0xa8d878],
  [0x14323e, 0x2a6a76, 0x5cb0ad, 0xa9e4d6],
  [0x191b44, 0x373d8a, 0x6c78d0, 0xb3a8e4],
  [0x8e3f62, 0xd47a9c, 0xf6bfd0],
];

export const MASTER: number[] = RAMPS.flat();
export const N = MASTER.length;

/** Named palette indices. */
export const C = {
  black: 0, ink: 1, slate: 2, gray: 3, pale: 4, white: 5,
  plum0: 6, plum1: 7, plum2: 8,
  gold0: 9, gold1: 10, gold2: 11, gold3: 12,
  rust0: 13, rust1: 14, rust2: 15, rust3: 16,
  umber0: 17, umber1: 18, umber2: 19,
  green0: 20, green1: 21, green2: 22, green3: 23,
  teal0: 24, teal1: 25, teal2: 26, teal3: 27,
  blue0: 28, blue1: 29, blue2: 30, lilac: 31,
  pink0: 32, pink1: 33, pink2: 34,
} as const;

const rgb = MASTER.map((c) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]);
export const RGB = rgb;

function pxOf(c: number): number {
  return (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
}

/** Canvas pixel (ABGR in memory) for each palette index. */
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

let lutIdx: Uint8Array | null = null;

/** A 32x32x32 table from 5-bit color to the nearest palette index. */
export function indexLut(): Uint8Array {
  if (lutIdx) return lutIdx;
  lutIdx = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    lutIdx[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4);
  }
  return lutIdx;
}

/** Palette index of the color nearest to an RGB triple. */
export function nearestIndex(r: number, g: number, b: number): number {
  const t = indexLut();
  return t[((Math.max(0, Math.min(255, r)) >> 3) << 10) | ((Math.max(0, Math.min(255, g)) >> 3) << 5) | (Math.max(0, Math.min(255, b)) >> 3)];
}

/** One step lighter along the pixel's own ramp. The top of a ramp steps to white. */
export const UP = new Uint8Array(N);
/** One step darker along the pixel's own ramp. The bottom stays put. */
export const DOWN = new Uint8Array(N);
/** Which ramp each index belongs to, and its position in it from 0 to 1. */
export const RAMP_OF = new Uint8Array(N);
export const LEVEL = new Float32Array(N);
{
  let i = 0;
  RAMPS.forEach((r, ri) => {
    for (let j = 0; j < r.length; j++, i++) {
      UP[i] = j + 1 < r.length ? i + 1 : C.white;
      DOWN[i] = j > 0 ? i - 1 : i;
      RAMP_OF[i] = ri;
      LEVEL[i] = r.length === 1 ? 0.5 : j / (r.length - 1);
    }
  });
}

/** Luminance of each palette index, 0 to 1. */
export const LUMA = new Float32Array(rgb.map(([r, g, b]) => (0.3 * r + 0.59 * g + 0.11 * b) / 255));

/** A shade ramp: three palette indices from dark to light used to draw leads. */
export type ShadeRamp = [number, number, number];
export const SHADES: Record<string, ShadeRamp> = {
  plum: [C.plum0, C.plum1, C.plum2],
  teal: [C.teal0, C.teal1, C.teal2],
  green: [C.green0, C.green1, C.teal1],
  blue: [C.blue0, C.blue1, C.blue2],
  violet: [C.blue0, C.plum1, C.blue2],
  ink: [C.black, C.ink, C.slate],
};
