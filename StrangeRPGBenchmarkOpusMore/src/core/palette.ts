// Every sprite and tile uses INK plus at most two named colors.
export const INK = '#0d0b14';

export const C = {
  ink: INK,
  paper: '#efe6d2',
  white: '#f6f4ff',
  silt: '#b8a58a',
  siltdk: '#7d6c5a',
  plea: '#dccb86',
  gold: '#e8b33a',
  orange: '#ef8a3a',
  rust: '#b5523b',
  red: '#d8433f',
  pink: '#f08aa2',
  rose: '#b84f7a',
  plum: '#6b3a6e',
  violet: '#8b6bd9',
  lilac: '#c4a8f0',
  navy: '#232a52',
  blue: '#3f6fd8',
  sky: '#7fb7f0',
  ice: '#c8ecf5',
  teal: '#2f9e9a',
  mint: '#8fe0b9',
  green: '#4f9e45',
  moss: '#3a5e36',
  olive: '#8a8a3a',
  lime: '#c4e05a',
  brown: '#7a4a2e',
  tan: '#c99a6a',
  grey: '#8a8a96',
  slate: '#4b5066',
  dusk: '#2c2540',
  cream: '#fff3c4',
  sea: '#1f5f8b',
  // Deep ramp ends, for shading and backgrounds.
  abyss: '#14101f',
  bruise: '#3d2347',
  maroon: '#5a1d2a',
  pine: '#1f3a2c',
  peat: '#3b2a22',
  steel: '#2f3446',
  ash: '#5e5a66',
  bone: '#d8cfc0',
  wine: '#7a2a4a',
  ocean: '#123a5a',
  algae: '#2a5a4a',
  ember: '#ff6a3d',
  ghost: '#d9f2ef',
} as const;

export type ColorName = keyof typeof C;

// Palette modes swap every world color at once, the way old consoles did dusk and night.
export type Mode = 'day' | 'dusk' | 'night' | 'eerie' | 'sepia' | 'cold' | 'blank';

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function lum(c: [number, number, number]) { return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }

const SHIFT: Record<Mode, (c: [number, number, number]) => [number, number, number]> = {
  day: (c) => c,
  dusk: (c) => mix(mix(c, [255, 120, 90], 0.18), [40, 20, 50], 0.22),
  night: (c) => { const l = lum(c); return mix(mix(c, [l, l, l], 0.5), [14, 18, 52], 0.6); },
  eerie: (c) => { const l = lum(c); return mix(mix(c, [l, l, l], 0.6), [70, 110, 80], 0.28); },
  sepia: (c) => { const l = lum(c); return mix([l, l, l], [l * 1.08 + 10, l * 0.9 + 4, l * 0.62], 0.9); },
  cold: (c) => mix(c, [120, 170, 230], 0.25),
  blank: (c) => { const l = lum(c); return mix([l, l, l], [239, 230, 210], 0.55); },
};

const modeCache = new Map<string, string>();
let mode: Mode = 'day';
export function setMode(m: Mode) { mode = m; }
export function getMode(): Mode { return mode; }

export function col(name: ColorName | string, m: Mode = mode): string {
  const base = (C as Record<string, string>)[name] ?? name;
  if (m === 'day' || base === INK || !base.startsWith('#')) return base;
  const key = m + base;
  let v = modeCache.get(key);
  if (!v) { v = rgbToHex(...SHIFT[m](hexToRgb(base))); modeCache.set(key, v); }
  return v;
}
