// Animated battle backdrops. Each is a pattern function sampled through whole-pixel row and column waves,
// with palette cycling. Nothing is scaled or rotated: every offset is a whole pixel.
import { W, buf, px } from './screen';

type Pattern = (x: number, y: number, t: number) => number;

export interface Backdrop {
  pal: number[];
  /** Two layers. The second shows through where the first gives index 0, or on alternate lines when interlaced. */
  a: Pattern;
  b?: Pattern;
  /** Row wave: amplitude in pixels, frequency, speed. */
  wave?: [number, number, number];
  /** Column wave on the second layer. */
  waveB?: [number, number, number];
  /** Odd rows shift the other way. */
  interlace?: boolean;
  /** Steps per second through the palette, skipping slot 0. */
  cycle?: number;
  /** Freezes the animation for this many seconds out of every period, for halted places. */
  halt?: [number, number];
}

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const P = {
  bricks: (s: number): Pattern => (x, y) => {
    const row = Math.floor(y / s);
    const xx = x + (row & 1) * (s >> 1);
    if (y % s === 0 || xx % (s * 2) === 0) return 1;
    return hash(Math.floor(xx / (s * 2)), row) > 0.7 ? 3 : 2;
  },
  drips: (x: number, y: number, t: number) => {
    const col = x % 9;
    if (col !== 0 && col !== 4) return 0;
    const speed = 12 + (x % 5) * 6;
    const yy = (y - Math.floor(t * speed) + x * 13) % 40;
    return yy < 0 ? 0 : yy < 2 ? 3 : yy < 6 ? 2 : yy < 10 ? 1 : 0;
  },
  grid: (s: number): Pattern => (x, y) => (x % s === 0 || y % s === 0 ? 2 : (x + y) % (s * 2) === 0 ? 1 : 0),
  diamonds: (s: number): Pattern => (x, y) => {
    const u = Math.abs((x % (s * 2)) - s) + Math.abs((y % (s * 2)) - s);
    return u === s ? 3 : u === s - 2 ? 2 : u < s - 4 && (x + y) % 3 === 0 ? 1 : 0;
  },
  rings: (cx: number, cy: number, gap: number): Pattern => (x, y, t) => {
    const d = Math.floor(Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - t * 10);
    const m = ((d % gap) + gap) % gap;
    return m === 0 ? 3 : m === 1 ? 2 : m === gap - 1 ? 1 : 0;
  },
  stars: (x: number, y: number, t: number) => {
    const yy = y - Math.floor(t * 8 * (1 + (x % 3)));
    const h = hash(x, Math.floor(yy / 1) & 1023);
    return h > 0.993 ? 3 : h > 0.985 ? 2 : 0;
  },
  cables: (x: number, y: number, t: number) => {
    const m = x % 32;
    if (m === 14 || m === 17) return 1;
    if (m === 15 || m === 16) return ((y + Math.floor(t * 20)) % 12) < 3 ? 3 : 2;
    return 0;
  },
  lines: (x: number, y: number, t: number) => {
    const row = Math.floor((y + Math.floor(t * 4)) / 6);
    const len = 20 + Math.floor(hash(row, 3) * 60);
    const start = Math.floor(hash(row, 7) * 40);
    const yy = (y + Math.floor(t * 4)) % 6;
    if (yy !== 2) return 0;
    const xx = (x - start + 192) % 128;
    return xx < len && hash(Math.floor(xx / 3), row) > 0.25 ? 2 : 0;
  },
  checker: (s: number): Pattern => (x, y) => ((Math.floor(x / s) + Math.floor(y / s)) & 1 ? 2 : 1),
  spokes: (cx: number, cy: number, n: number): Pattern => (x, y, t) => {
    const a = Math.atan2(y - cy, x - cx) + t * 0.6;
    const k = Math.floor(((a / (Math.PI * 2)) * n * 2 + 1000) % 2);
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    return d < 6 ? 0 : k ? 2 : (d | 0) % 10 === 0 ? 3 : 1;
  },
  bars: (x: number, y: number) => (x % 12 < 2 ? 2 : y % 30 < 2 ? 3 : 0),
  chairs: (x: number, y: number) => {
    const u = x % 16, v = y % 16;
    if (u === 3 && v < 12) return 2;
    if (v === 8 && u >= 3 && u < 13) return 2;
    if ((u === 3 || u === 12) && v >= 8 && v < 14) return 1;
    return 0;
  },
  strokes: (x: number, y: number, t: number) => {
    const k = (x + y * 2 + Math.floor(t * 30)) % 23;
    return k === 0 ? 3 : k === 1 ? 2 : hash(x >> 2, y >> 2) > 0.97 ? 1 : 0;
  },
  glitch: (x: number, y: number, t: number) => {
    const band = Math.floor(y / 4);
    const off = hash(band, Math.floor(t * 3)) > 0.8 ? Math.floor(hash(band, 9) * 40) : 0;
    const xx = x + off;
    return (xx >> 3) % 5 === 0 ? 3 : hash(xx >> 2, band) > 0.85 ? 2 : (xx + y) % 7 === 0 ? 1 : 0;
  },
  mobile: (x: number, y: number, t: number) => {
    const k = Math.floor(x / 24);
    const sway = Math.round(Math.sin(t + k) * 3);
    const cx = k * 24 + 12 + sway;
    if (Math.abs(x - cx) === 0 && y < 20 + (k % 3) * 8) return 1;
    const dy = y - (22 + (k % 3) * 8), dx = x - cx;
    return dx * dx + dy * dy < 9 ? 2 : 0;
  },
} as const;

export const BACKDROPS: Record<string, Backdrop> = {
  busy: { pal: [0x0b0a10, 0x2a1a18, 0x5a2a1a, 0x8a3e2a], a: P.bricks(8), wave: [2, 0.09, 1.4], cycle: 0 },
  millrace: { pal: [0x07161a, 0x0a2a34, 0x1e5a60, 0x6fe3e0], a: P.drips, b: P.grid(16), wave: [1, 0.2, 2] },
  river: { pal: [0x070b12, 0x0e131c, 0x1e2440, 0x3e5a74], a: P.diamonds(10), wave: [3, 0.05, 1.1], cycle: 1.2 },
  standing: { pal: [0x070b12, 0x0e131c, 0x1e2440, 0x2a8a8a], a: P.grid(12), b: P.drips, wave: [2, 0.12, 2], halt: [6, 2.5] },
  twice: { pal: [0x15121c, 0x3a1a2a, 0x8a3a5a, 0x9fd88a], a: P.diamonds(8), b: P.diamonds(8), waveB: [2, 0.1, 1.6], interlace: true },
  press: { pal: [0x100810, 0x2a1424, 0x5a2a4a, 0x9fd88a], a: P.bars, b: P.checker(4), wave: [1, 0.3, 3] },
  ears: { pal: [0x0d0c14, 0x2a2440, 0x4a3e6a, 0xa99ad8], a: P.rings(96, 70, 9), wave: [1, 0.07, 0.8] },
  tether: { pal: [0x05060a, 0x1e2440, 0x6f8cff, 0xf2f2f2], a: P.cables, b: P.stars },
  writing: { pal: [0x141414, 0x262626, 0x6a6478, 0xe6dfd0], a: P.lines, wave: [1, 0.04, 0.6] },
  nursery: { pal: [0x101a08, 0x2a2620, 0x5a4a30, 0xd8d4cc], a: P.mobile },
  copied: { pal: [0x000000, 0x1a2a0a, 0x5a7a1a, 0xc8ff2e], a: P.checker(6), b: P.checker(6), wave: [4, 0.06, 1.7], waveB: [4, 0.06, 1.9], interlace: true },
  grind: { pal: [0x0b0a10, 0x2a2420, 0x5a3a2a, 0xc8ff2e], a: P.spokes(96, 46, 10), wave: [1, 0.1, 2] },
  hold: { pal: [0x070b12, 0x141a3a, 0x3e5a74, 0x6fe3e0], a: P.bars, b: P.grid(16), halt: [3, 1.5] },
  many: { pal: [0x110a12, 0x3a1a2a, 0x8a3a5a, 0xe07aa0], a: P.chairs, b: P.chairs, waveB: [3, 0.08, 1.3], interlace: true },
  relay: { pal: [0x0d0c14, 0x2a2440, 0x6a5a98, 0xe07aa0], a: P.rings(96, 40, 7), b: P.rings(40, 60, 11), wave: [2, 0.1, 2.5] },
  arm: { pal: [0x0a0a0a, 0x262626, 0x8a849a, 0xc8ff2e], a: P.strokes, wave: [1, 0.2, 4] },
  again: { pal: [0x000000, 0x2a3a0a, 0x5a7a1a, 0xc8ff2e], a: P.rings(96, 46, 6), b: P.checker(3), wave: [5, 0.05, 2.2], waveB: [5, 0.05, 2.35], interlace: true },
  erratum: { pal: [0x0b0a10, 0x3a0a0a, 0x8a1a1a, 0xff5a5a], a: P.glitch, b: P.lines },
  // Act 2: seven years on, and up in the sky.
  busy7: { pal: [0x000000, 0x2a1a18, 0x2a2833, 0x5a2a4a], a: P.bricks(8), wave: [1, 0.05, 0.6] },
  river7: { pal: [0x070b12, 0x0e131c, 0x123a3c, 0x2a8a8a], a: P.diamonds(10), wave: [3, 0.05, -1.1], cycle: -1.2 },
  twice7: { pal: [0x15121c, 0x3a1a2a, 0x8a3a5a, 0xe6dfd0], a: P.diamonds(8), wave: [1, 0.1, 1.6] },
  ears7: { pal: [0x0d0c14, 0x2a2440, 0x6a5a98, 0xd8d0ff], a: P.rings(96, 120, 9), wave: [1, 0.07, -0.8] },
  line: { pal: [0x0e131c, 0x1e2440, 0xaaa4ba, 0xffffff], a: P.lines, b: P.stars, wave: [2, 0.03, 0.8] },
  scriv: { pal: [0x15121c, 0x2a2833, 0x7a7488, 0xf2d25a], a: P.grid(10), b: P.lines, wave: [1, 0.15, 3] },
  closer: { pal: [0x0b0a10, 0x2e1e4a, 0x6a5a98, 0xd8d0ff], a: P.bars, b: P.lines, halt: [2.4, 0.4] },
  corrector: { pal: [0x15121c, 0x3a0a0a, 0xe6dfd0, 0xff3a3a], a: P.lines, b: P.strokes, wave: [1, 0.2, 3] },
  over: { pal: [0x07161a, 0x1e2440, 0xaaa4ba, 0xff3a3a], a: P.strokes, b: P.lines, wave: [3, 0.08, 2.4], interlace: true },
  gloss: { pal: [0x000000, 0x2e1e4a, 0xa99ad8, 0xffffff], a: P.lines, b: P.rings(96, 46, 9), wave: [1, 0.03, 0.5], cycle: 0.6 },
};

/** Act 2 versions of the region backdrops. */
const LATER: Record<string, string> = { busy: 'busy7', river: 'river7', twice: 'twice7', press: 'twice7', ears: 'ears7', line: 'line', scriv: 'scriv' };

/** Draws a backdrop into rows y0 to y1 of the frame. */
export function drawBackdrop(name: string, t: number, y0: number, y1: number, darken = 1) {
  const bd = BACKDROPS[name] ?? BACKDROPS.busy;
  let time = t;
  if (bd.halt) {
    const [period, stop] = bd.halt;
    const m = t % period;
    time = Math.floor(t / period) * (period - stop) + Math.min(m, period - stop);
  }
  const pal = bd.pal.map((c) => {
    const f = (v: number) => Math.round(v * darken);
    return px((f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255));
  });
  const shift = bd.cycle ? Math.floor(time * bd.cycle) : 0;
  const cyc = (i: number) => (i === 0 || !shift ? i : 1 + ((i - 1 + shift) % (pal.length - 1)));
  for (let y = y0; y < y1; y++) {
    let ox = 0;
    if (bd.wave) ox = Math.round(bd.wave[0] * Math.sin(y * bd.wave[1] + time * bd.wave[2]));
    if (bd.interlace && (y & 1)) ox = -ox;
    let oxB = ox;
    if (bd.waveB) oxB = Math.round(bd.waveB[0] * Math.sin(y * bd.waveB[1] + time * bd.waveB[2]) * ((y & 1) && bd.interlace ? -1 : 1));
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let i = bd.a(x + ox, y, time);
      if (bd.b && (i === 0 || (bd.interlace && (y & 1)))) {
        const j = bd.b(x + oxB, y, time);
        if (j) i = j;
      }
      buf[row + x] = pal[cyc(i)];
    }
  }
}

/** Picks the backdrop for a fight from its region and foes. */
export function backdropFor(region: string, foeKeys: string[], copied: boolean, later = false): string {
  const boss = ['grind', 'hold', 'many', 'relay', 'arm', 'again', 'erratum', 'closer', 'corrector', 'over', 'gloss'].find((b) => foeKeys.includes(b));
  if (boss) return boss;
  if (copied) return 'copied';
  if (later && LATER[region]) return LATER[region];
  return BACKDROPS[region] ? region : 'busy';
}
