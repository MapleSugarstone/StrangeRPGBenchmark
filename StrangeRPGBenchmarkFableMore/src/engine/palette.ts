/** The whole game draws from this palette. Every sprite uses black plus two of these. */
export const PALETTE = {
  black: "#0b0a10",
  white: "#f2efe6",
  bone: "#d8cfb8",
  ash: "#8e8a92",
  slate: "#4b4f63",
  ink: "#23263a",
  sky: "#6fb7e8",
  teal: "#2fa39a",
  mint: "#8fe3c0",
  moss: "#4f7f4a",
  leaf: "#7fbf52",
  olive: "#8d8f3a",
  sand: "#d9b776",
  gold: "#f0c43c",
  amber: "#e08a2e",
  rust: "#a9512a",
  brick: "#7d2f2a",
  rose: "#e26a8a",
  plum: "#6c2d63",
  violet: "#9a63d8",
  indigo: "#3e3ea8",
  frost: "#bfe3f5",
  salt: "#eae4f0",
  coal: "#2b2a30",
  blood: "#c92f3e",
  orange: "#ef7a3a",
  lilac: "#c9a6e8",
  sea: "#2a5f8f",
  clay: "#b98a63",
  pine: "#1f5e4a",
} as const;

export type ColorName = keyof typeof PALETTE;

export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];

function hexToInt(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Little endian ABGR for Uint32 image data.
  return (0xff << 24) | (b << 16) | (g << 8) | r;
}

export const PALETTE_INT: Record<ColorName, number> = Object.fromEntries(
  COLOR_NAMES.map((n) => [n, hexToInt(PALETTE[n])]),
) as Record<ColorName, number>;

export function colorInt(name: ColorName): number {
  return PALETTE_INT[name];
}

/** Blend two palette ints by t in [0, 1]. Used for fades and dimmed lines. */
export function mixInt(a: number, b: number, t: number): number {
  const ar = a & 0xff, ag = (a >>> 8) & 0xff, ab = (a >>> 16) & 0xff;
  const br = b & 0xff, bg = (b >>> 8) & 0xff, bb = (b >>> 16) & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (0xff << 24) | (bl << 16) | (g << 8) | r;
}
