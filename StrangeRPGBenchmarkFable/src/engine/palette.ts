/** Fixed 16 color palette. Every sprite uses black plus up to two of these. */
export const PALETTE_NAMES = [
  "black", "white", "red", "orange", "yellow", "lime", "green", "teal",
  "blue", "indigo", "purple", "pink", "brown", "gray", "dark", "salt",
] as const;

export type ColorName = (typeof PALETTE_NAMES)[number];

export const PALETTE_HEX: Record<ColorName, string> = {
  black: "#0b0a10",
  white: "#f4f0e6",
  red: "#e23b3b",
  orange: "#f08a24",
  yellow: "#f5d93a",
  lime: "#9be03a",
  green: "#2e9b4f",
  teal: "#2fc1b5",
  blue: "#3b6fe2",
  indigo: "#5a3be2",
  purple: "#a63be2",
  pink: "#e85fb0",
  brown: "#8a5a2b",
  gray: "#8b8f9a",
  dark: "#262a38",
  salt: "#d9e6f2",
};

export interface Rgb { r: number; g: number; b: number }

export const PALETTE_RGB: Record<ColorName, Rgb> = Object.fromEntries(
  PALETTE_NAMES.map((n) => [n, hexToRgb(PALETTE_HEX[n])]),
) as Record<ColorName, Rgb>;

export function hexToRgb(hex: string): Rgb {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function colorIndex(name: ColorName): number {
  return PALETTE_NAMES.indexOf(name);
}
