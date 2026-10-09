// Night skies: how many stars fall on each map, how far their light reaches, and the two hues every field color takes.
import type { MapDef } from './world';
import { G } from './state';

export interface Sky {
  /** Falling stars per minute. */
  rate: number;
  /** Smallest and largest star, from 0 (a one-pixel spark) to 3 (a big star with a long trail). */
  size: [number, number];
  /** Radius in pixels that a size 1 star lights where it lands. */
  reach: number;
  /** Frames that a size 1 star's light lasts. */
  life: number;
  /** How much of the lit hue shows everywhere, from 0 (full night) to 1 (none): the unlit hue sits that far back toward the lit one. */
  amb: number;
  /** The color the unlit hue leans toward. */
  tint: string;
  /** How far the lit hue warms toward star gold, from 0 to 1. */
  warm: number;
  /** Tile characters that give light, with the radius of their pool in pixels. */
  lamps: Record<string, number>;
  /** Under the backlit look, the share of its lightness the unlit hue keeps. Battle look 6 keeps 0.55. */
  sink: number;
  /** Where the moon stands beyond the top of the screen, in screen pixels, or -1 to pick it from the map's name. */
  moonX: number;
  /** The moon's color, which rims figures and colors the light path. Interiors use a window on the back wall. */
  moonTint: string;
  /** The color of the lamps, fires, and doors: what they light leans toward it. */
  lampTint: string;
}

const INDIGO = '#2c2c88', VIOLET = '#4a2a90', BLUE = '#1e44a0', TEAL = '#14507a', DEEP = '#1c2258', PLUM = '#3a2050';

const GLOW: Record<string, number> = { L: 18, H: 14, m: 10, P: 10 };
const TOWN: Record<string, number> = { ...GLOW, d: 18 };

const BASE: Sky = { rate: 12, size: [0, 2], reach: 22, life: 150, amb: 0.05, tint: INDIGO, warm: 0.4, lamps: GLOW, sink: 0.55, moonX: -1, moonTint: '#e8ecff', lampTint: '#ffa040' };

/** Interiors: no sky, the lamps on the counters and shelves light the room, and a window on the back wall stands in for the moon. */
const INDOOR: Partial<Sky> = { rate: 0, amb: 0.2, warm: 0.7, lamps: { ...GLOW, c: 30, p: 16 }, sink: 0.65, moonX: 96, moonTint: '#ffd890', lampTint: '#ffb060' };

const BY_REGION: Partial<Sky>[] = [
  /* 0 fell */ { rate: 14, amb: 0.1, lamps: TOWN },
  /* 1 rib */ { rate: 12, amb: 0, tint: VIOLET, lamps: TOWN },
  /* 2 mast */ { rate: 18, size: [0, 3], amb: 0.1, tint: BLUE, lamps: TOWN },
  /* 3 spire */ { rate: 10, tint: TEAL, lamps: TOWN },
  /* 4 bole */ { rate: 4, size: [0, 1], amb: 0, tint: TEAL, lamps: TOWN },
  /* 5 hum */ { rate: 8, lamps: { ...TOWN, m: 14 }, lampTint: '#ffbc30' },
  /* 6 tusk */ { rate: 10, amb: 0.2, tint: BLUE, lamps: TOWN },
  /* 7 hilt */ { rate: 10, tint: VIOLET, lamps: TOWN },
  /* 8 fall */ { rate: 90, size: [0, 3], reach: 26, life: 180, amb: 0.15, tint: VIOLET, lamps: TOWN },
  /* 9 crown */ { rate: 12, tint: BLUE, lamps: TOWN },
  /* 10 slack */ { rate: 14, tint: DEEP },
  /* 11 den */ { tint: PLUM },
  /* 12 under */ { rate: 0, amb: 0, tint: DEEP, sink: 0.85, lampTint: '#60e8c8' },
  /* 13 knuckle */ { rate: 16, tint: VIOLET },
  /* 14 wreck */ { rate: 20, size: [0, 3], tint: BLUE },
  /* 15 shore */ { rate: 22, size: [0, 3], amb: 0.1, tint: BLUE },
  /* 16 bell */ { tint: TEAL, lampTint: '#80f0b0' },
  /* 17 root */ { rate: 3, size: [0, 1], amb: 0, tint: TEAL },
  /* 18 skin */ { rate: 24, size: [0, 3], tint: VIOLET },
  /* 19 ice */ { rate: 14, amb: 0.2, tint: BLUE },
  /* 20 blade */ { rate: 12, tint: VIOLET },
  /* 21 moon */ { rate: 70, size: [0, 3], reach: 24, life: 170, amb: 0.15 },
  /* 22 glass */ { rate: 60, size: [0, 3], reach: 24, amb: 0.15, tint: TEAL },
  /* 23 orchard */ { rate: 10, tint: BLUE },
  /* 24 margin */ { rate: 60, size: [0, 3], amb: 0.25 },
  /* 25 strand */ { rate: 120, size: [0, 3], reach: 24, life: 170, amb: 0.25, warm: 1, tint: DEEP },
  /* 26 dollar */ { rate: 8, amb: 0.3, warm: 0.9, tint: PLUM, lampTint: '#ff8a30' },
  /* 27 cowrie */ { rate: 12, amb: 0.25, warm: 0.6, tint: VIOLET },
  /* 28 auger */ { rate: 6, amb: 0.25, warm: 0.6, tint: PLUM },
  /* 29 nautilus */ { amb: 0.25, warm: 0.6 },
  /* 30 tray */ { rate: 40, size: [0, 3], amb: 0.25, warm: 0.8, tint: DEEP },
  /* 31 conch */ { rate: 30, size: [0, 3], amb: 0.3, warm: 0.6, tint: VIOLET },
  /* 32 whorl */ { rate: 50, size: [0, 3], reach: 24, amb: 0.3, warm: 0.8, tint: DEEP },
  /* 33 Cockle Cove */ { rate: 20, size: [0, 3], amb: 0.1, tint: BLUE },
  /* 34 the Brook Wood */ { rate: 6, size: [0, 1], amb: 0.05, tint: TEAL },
  /* 35 the High-water Mark */ { rate: 18, size: [0, 3], amb: 0.1, tint: BLUE },
  /* 36 the Saltings */ { rate: 22, size: [0, 3], amb: 0.15, tint: TEAL },
  /* 37 the Shouting Wood */ { rate: 5, size: [0, 1], tint: TEAL },
  /* 38 the Kelp Beds */ { rate: 16, size: [0, 3], amb: 0.05, tint: TEAL },
  /* 39 the Gantry Shore */ { rate: 12, tint: DEEP },
  /* 40 the Floes */ { rate: 14, amb: 0.2, tint: BLUE },
  /* 41 the Shingle */ { rate: 12, tint: VIOLET },
  /* 42 the Long Way Round */ { rate: 50, size: [0, 3], reach: 24, amb: 0.15, tint: VIOLET },
  /* 43 the Gate Ring */ { rate: 4, size: [0, 2], amb: 0.05, tint: DEEP },
  /* 44 the Geode */ { rate: 0, amb: 0.1, tint: VIOLET, warm: 0.3, sink: 0.75, lamps: { ...GLOW, P: 24, j: 12 }, lampTint: '#c890ff' },
];

/** Maps that differ from their region. */
const BY_MAP: Record<string, Partial<Sky>> = {
  route1: { rate: 16, amb: 0.05 },
  route3: { rate: 18, size: [0, 3], amb: 0.05 },
  route4: { rate: 3, size: [0, 1], amb: 0 },
  route6: { rate: 16, size: [0, 3] },
  moonwater: { rate: 24, size: [0, 3], amb: 0.15 },
  route8: { rate: 60, size: [0, 3], reach: 24, amb: 0.15 },
  fallgym: { amb: 0.6, warm: 1 },
  climb: { rate: 30, size: [0, 3] },
  springlow: { rate: 160 },
  hollowtop: { rate: 0 },
  augerpoint: { rate: 30, size: [0, 3] },
  // The driftwood fire in the middle of the Sand Dollar is its only `x` tile.
  sanddollar: { lamps: { ...GLOW, x: 16 } },
  // The bottom of the geode, where the crystal turns teal.
  geodeheart: { lampTint: '#70f0d8', amb: 0.16 },
};

const cache = new Map<string, Sky>();

/** The tables, for tuning from the console. Clear `cache` after changing one. */
export const skyTables = { BASE, INDOOR, BY_REGION, BY_MAP, cache };

/** The sky over one map from the base, its region, the indoor preset, and its own overrides, a little darker in the evening scene. */
export function skyFor(m: MapDef, dusk: number): Sky {
  const key = `${m.id}|${m.region}|${m.indoor ? 1 : 0}|${dusk > 0 ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    s = { ...BASE, ...BY_REGION[m.region], ...(m.indoor ? INDOOR : {}), ...BY_MAP[m.id] };
    if (dusk > 0) s.amb = Math.max(0, s.amb - 0.1);
    cache.set(key, s);
  }
  return s;
}

/** Stars per minute on a map now, a quarter as many at high water on the Strand and half again as many in the evening scene. */
export function starsPerMinute(m: MapDef, s: Sky, dusk: number): number {
  let r = s.rate;
  if (m.strand && G.flags.tide) r /= 4;
  return r * (1 + 0.5 * dusk);
}

// ---------------------------------------------------------------- the two hues

function lin(c: number): number { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function gam(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/** A 0xRRGGBB color in the perceptual space the two hues are defined in, as lightness and two color axes. */
export function toLab(rgb: number): [number, number, number] {
  const R = lin((rgb >> 16) & 255), Gn = lin((rgb >> 8) & 255), B = lin(rgb & 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * Gn + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * Gn + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * Gn + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}

/** Back from the perceptual space to 0xRRGGBB, clamped to the screen's range. */
export function fromLab(L: number, a: number, b: number): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const r = gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  return (r << 16) | (g << 8) | bl;
}

const tintLab = new Map<string, [number, number]>();

/** The unlit and lit forms of one color as 0xRRGGBB, with the unlit forms in the same lightness order so shapes still read. */
export function twoHues(rgb: number, s: Sky): [number, number] {
  let t = tintLab.get(s.tint);
  if (!t) {
    const [, ta, tb] = toLab(parseInt(s.tint.slice(1), 16));
    const n = Math.hypot(ta, tb) || 1;
    t = [ta / n, tb / n];
    tintLab.set(s.tint, t);
  }
  const [L, a, b] = toLab(rgb);
  const n = 1 - s.amb;
  // Darker colors lean further toward the tint, so the night reads in the shadows and the pale tones stay pale.
  const lean = 0.1 * n * (1.2 - 0.6 * L);
  const keep = 1 - 0.72 * n;
  // Warm colors lose more lightness than cool ones, as they do to the eye at dusk.
  const warmth = Math.max(0, Math.min(1, (b + a * 0.5) / 0.15));
  const dim = fromLab(Math.max(0, L * (1 - 0.4 * n) - 0.06 * n * warmth), a * keep + t[0] * lean, b * keep + t[1] * lean);
  const w = s.warm;
  const lit = w > 0 ? fromLab(Math.min(1, L * (1 + 0.05 * w)), a + 0.008 * w, b + 0.035 * w) : rgb;
  return [dim, lit];
}

/** A color sunk to a share k of its lightness, losing some chroma, as the backlit look darkens the unlit hue. */
export function sunk(rgb: number, k: number): number {
  const [L, a, b] = toLab(rgb), c = 0.5 + 0.5 * k;
  return fromLab(L * k, a * c, b * c);
}

/** A figure's body lit from behind: its own color darkened and cooled, in the same lightness order, so every shape stays distinct. */
export function backFill(rgb: number, f: number): number {
  const [L, a, b] = toLab(rgb);
  return fromLab(Math.min(1, 0.04 + L * 0.5 * f), a * 0.7 - 0.004, b * 0.7 - 0.022);
}

/** A color leaned a share k of the way toward another in hue and lightness, for a rim in the moon's color. */
export function lean(rgb: number, toward: number, k: number): number {
  const [L, a, b] = toLab(rgb), [tL, ta, tb] = toLab(toward);
  return fromLab(Math.min(1, L + Math.max(0, tL - L) * k * 0.6), a + (ta - a) * k, b + (tb - b) * k);
}

/** Grays and a wheel of hues, so a fitted matrix also suits sprite colors that are not in the region's palette. */
const SAMPLES: number[] = [];
for (const v of [0, 0x40, 0x80, 0xc0, 0xff]) SAMPLES.push(v * 0x10101);
for (let h = 0; h < 12; h++) for (const [l, c] of [[0.45, 0.5], [0.75, 0.35]]) {
  const t = h / 12 * Math.PI * 2;
  SAMPLES.push(fromLab(l, Math.cos(t) * c * 0.3, Math.sin(t) * c * 0.3));
}

/** A color in a lamp's bright middle: the surface's lit lightness, kept in order so a dark roof stays darker than pale sand, with its hue leaned `k` of the way to the lamp's. */
export function lampCore(lit: number, tint: number, k = 0.55): number {
  const [L, a, b] = toLab(lit), [tL, ta, tb] = toLab(tint);
  return fromLab(Math.min(1, L * 0.78 + 0.04 + 0.08 * tL), a + (ta - a) * k, b + (tb - b) * k);
}

/** A color at the edge of a lamp's pool: the night color, a little lighter, with a little of the lamp's hue in it. */
export function lampEdge(night: number, tint: number): number {
  const [L, a, b] = toLab(night), [, ta, tb] = toLab(tint);
  return fromLab(L + 0.04, a + (ta - a) * 0.25, b + (tb - b) * 0.25);
}

/** The region's palette (weight 4), the grays and hue samples (weight 1), and the ink (weight 12), which every fitted matrix is fitted to. */
function fitPoints(cols: string[]): [number, number][] {
  return [...cols.map(c => parseInt(c.slice(1), 16)).map(c => [c, 4] as [number, number]), ...SAMPLES.map(c => [c, 1] as [number, number]), [0x0b0a10, 12]];
}

/** Least squares fit of an affine color map, returned as the 20 values of an SVG color matrix. */
function fit(pairs: [number, number, number][]): string {
  const rows: number[] = [];
  for (let ch = 0; ch < 3; ch++) {
    const M = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0]);
    for (const [src, dst, w] of pairs) {
      const x = [((src >> 16) & 255) / 255, ((src >> 8) & 255) / 255, (src & 255) / 255, 1];
      const y = ((dst >> (16 - ch * 8)) & 255) / 255;
      for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) M[i][j] += w * x[i] * x[j]; M[i][4] += w * x[i] * y; }
    }
    for (let i = 0; i < 3; i++) M[i][i] += 1e-4;
    for (let i = 0; i < 4; i++) {
      let piv = i;
      for (let r = i + 1; r < 4; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      [M[i], M[piv]] = [M[piv], M[i]];
      for (let r = 0; r < 4; r++) if (r !== i) { const q = M[r][i] / M[i][i]; for (let c = i; c < 5; c++) M[r][c] -= q * M[i][c]; }
    }
    const a = M.map((r, i) => r[4] / r[i]);
    rows.push(a[0], a[1], a[2], 0, a[3]);
  }
  rows.push(0, 0, 0, 1, 0);
  return rows.map(v => +v.toFixed(5)).join(' ');
}

/** The unlit and lit hues as color matrices fitted to the region's palette, the ink, and a spread of other colors. `sink` below 1 darkens the unlit hue for the backlit look. */
export function hueMatrices(s: Sky, cols: string[], sink = 1): { dim: string; lit: string | null } {
  const pts = fitPoints(cols);
  const both = pts.map(([c, w]) => { const [d, l] = twoHues(c, s); return [c, sink < 1 ? sunk(d, sink) : d, l, w]; });
  return {
    dim: fit(both.map(([c, d, , w]) => [c, d, w])),
    lit: s.warm > 0 ? fit(both.map(([c, , l, w]) => [c, l, w])) : null,
  };
}
