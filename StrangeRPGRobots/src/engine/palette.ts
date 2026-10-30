// The master palette. Every lit pixel snaps to one of these colors, and dithering does the darkening.
// The red ramp belongs to witch blood and the Board. Nothing else in the city uses it.

/** Hue ramps, darkest first. Light moves a pixel along its own ramp. */
export const RAMPS: number[][] = [
  [0x07060c, 0x17141f, 0x2b2738, 0x4a4559, 0x767088, 0xaca6bc, 0xe8e4ef],
  [0x2e0b2a, 0x6a1458, 0xb8237e, 0xf04aa8, 0xff9fd4],
  [0x062a30, 0x0d5a60, 0x179e9e, 0x3ed6d0, 0xa8f6ee],
  [0x16123a, 0x2c2a78, 0x4c4cc0, 0x8a7ce8, 0xc6bbf8],
  [0x3a2008, 0x7a4510, 0xc87a1e, 0xf0b440, 0xffe49c],
  [0x10300e, 0x2a6a1a, 0x5aac2a, 0x9be03a, 0xdaf892],
  [0x2e1a12, 0x5a3420, 0x8a5634, 0xb47c52, 0xdaa67c, 0xf3d4b4],
  [0x221a16, 0x46382c, 0x76624a],
  [0x4a0610, 0x9a0c1e, 0xe01a2a, 0xff6c6c],
  [0x0c1420, 0x1e3048, 0x3a5a80, 0x6a92c2, 0xb2cee8],
];

export const MASTER: number[] = RAMPS.flat();
export const N = MASTER.length;

/** Named palette indices. */
export const C = {
  black: 0, ink: 1, night: 2, slate: 3, gray: 4, pale: 5, white: 6,
  mag0: 7, mag1: 8, mag2: 9, mag3: 10, mag4: 11,
  cyan0: 12, cyan1: 13, cyan2: 14, cyan3: 15, cyan4: 16,
  vio0: 17, vio1: 18, vio2: 19, vio3: 20, vio4: 21,
  amb0: 22, amb1: 23, amb2: 24, amb3: 25, amb4: 26,
  grn0: 27, grn1: 28, grn2: 29, grn3: 30, grn4: 31,
  skin0: 32, skin1: 33, skin2: 34, skin3: 35, skin4: 36, skin5: 37,
  mud0: 38, mud1: 39, mud2: 40,
  red0: 41, red1: 42, red2: 43, red3: 44,
  steel0: 45, steel1: 46, steel2: 47, steel3: 48, steel4: 49,
} as const;

const rgb = MASTER.map((c) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]);
export const RGB = rgb;

function pxOf(c: number): number {
  return (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
}

/** Canvas pixel (ABGR in memory) for each palette index. */
export const PX = new Uint32Array(MASTER.map(pxOf));

const RED_FIRST = C.red0, RED_LAST = C.red3;

function nearest(R: number, G: number, B: number, allowRed: boolean): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < N; i++) {
    if (!allowRed && i >= RED_FIRST && i <= RED_LAST) continue;
    const [pr, pg, pb] = rgb[i];
    const rm = (R + pr) / 2;
    const dr = R - pr, dg = G - pg, db = B - pb;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

let lutIdx: Uint8Array | null = null;
let lutRed: Uint8Array | null = null;

/**
 * A 32x32x32 table from 5-bit color to the nearest palette index. Lit colors never snap into the red ramp,
 * so only pixels that are red to begin with stay red.
 */
export function indexLut(): Uint8Array {
  if (lutIdx) return lutIdx;
  lutIdx = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    lutIdx[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, false);
  }
  return lutIdx;
}

/** The same table with the red ramp allowed, for pixels whose own color is red. */
export function redLut(): Uint8Array {
  if (lutRed) return lutRed;
  lutRed = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    lutRed[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, true);
  }
  return lutRed;
}

/** Palette index of the color nearest to an RGB triple (never red). */
export function nearestIndex(r: number, g: number, b: number): number {
  const t = indexLut();
  return t[((Math.max(0, Math.min(255, r)) >> 3) << 10) | ((Math.max(0, Math.min(255, g)) >> 3) << 5) | (Math.max(0, Math.min(255, b)) >> 3)];
}

export function isRed(i: number): boolean { return i >= RED_FIRST && i <= RED_LAST; }

/** One step lighter along the pixel's own ramp. The top of a ramp steps to white, except red, which stays. */
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
      UP[i] = j + 1 < r.length ? i + 1 : (ri === 8 ? i : C.white);
      DOWN[i] = j > 0 ? i - 1 : (ri === 0 ? i : C.black);
      RAMP_OF[i] = ri;
      LEVEL[i] = r.length === 1 ? 0.5 : j / (r.length - 1);
    }
  });
  DOWN[C.ink] = C.black;
}

/** Luminance of each palette index, 0 to 1. */
export const LUMA = new Float32Array(rgb.map(([r, g, b]) => (0.3 * r + 0.59 * g + 0.11 * b) / 255));

/** A color given as 0xRRGGBB for lights. Neon light colors used across the city. */
export const LIGHT = {
  magenta: 0xff3aa8,
  cyan: 0x3ef0e8,
  amber: 0xffb040,
  violet: 0x8a70ff,
  green: 0x9bff40,
  white: 0xfff4e8,
  cold: 0xb0d0ff,
  red: 0xff2030,
  sodium: 0xff9a30,
} as const;
