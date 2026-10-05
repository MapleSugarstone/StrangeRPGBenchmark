export type Hue = 'R' | 'Y' | 'G' | 'C' | 'B' | 'M' | 'N';
export const WHEEL: Hue[] = ['R', 'Y', 'G', 'C', 'B', 'M'];
export const HUE_NAME: Record<Hue, string> = { R: 'Red', Y: 'Amber', G: 'Green', C: 'Cyan', B: 'Blue', M: 'Violet', N: 'Grey' };

export const COLORS = {
  k: '#0c0a12',
  ink: '#262234',
  g1: '#4a4658',
  g2: '#8e8a9c',
  g3: '#cbc7d4',
  w: '#f6f2e8',
  r1: '#6b1d2e',
  r2: '#d6404a',
  r3: '#ff9a82',
  o1: '#7a3e14',
  o2: '#e8842c',
  o3: '#ffc27a',
  y1: '#7c6414',
  y2: '#e8c030',
  y3: '#fff08a',
  n1: '#3a2418',
  n2: '#8c5c38',
  n3: '#d8a878',
  e1: '#1d5a3a',
  e2: '#3fae52',
  e3: '#b4f084',
  c1: '#11505e',
  c2: '#26b4c4',
  c3: '#9af4ec',
  b1: '#1e2a7c',
  b2: '#3e6ae8',
  b3: '#a0b8ff',
  m1: '#5a1a66',
  m2: '#c244c8',
  m3: '#ff9ce8',
} as const;

export type Col = keyof typeof COLORS;
export type Pal3 = [Col, Col, Col];

export function hueOf(c: Col): Hue {
  switch (c[0]) {
    case 'r': return 'R';
    case 'o': case 'y': case 'n': return 'Y';
    case 'e': return 'G';
    case 'c': return 'C';
    case 'b': return 'B';
    case 'm': return 'M';
    default: return 'N';
  }
}

export function huesOf(p: Pal3): Hue[] {
  return [hueOf(p[1]), hueOf(p[2])];
}

export function opposite(h: Hue): Hue {
  if (h === 'N') return 'N';
  return WHEEL[(WHEEL.indexOf(h) + 3) % 6];
}

/** Multiplier for an attack of hue `atk` against a target with `hues`. */
export function hueMult(atk: Hue, hues: readonly Hue[]): number {
  if (atk === 'N') return 1;
  let m = 1;
  for (const t of hues) {
    if (t === 'N') continue;
    if (t === atk) m -= 0.25;
    else if (opposite(t) === atk) m += 0.5;
  }
  return m;
}

export const HUE_COLOR: Record<Hue, Col> = { R: 'r2', Y: 'y2', G: 'e2', C: 'c2', B: 'b2', M: 'm2', N: 'g2' };
export const HUE_LIGHT: Record<Hue, Col> = { R: 'r3', Y: 'y3', G: 'e3', C: 'c3', B: 'b3', M: 'm3', N: 'g3' };

const greyCache = new Map<string, string>();
export function greyHex(hex: string): string {
  let g = greyCache.get(hex);
  if (g) return g;
  const n = parseInt(hex.slice(1), 16);
  const l = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  const v = Math.round(l * 0.9 + 12).toString(16).padStart(2, '0');
  g = `#${v}${v}${v}`;
  greyCache.set(hex, g);
  return g;
}
