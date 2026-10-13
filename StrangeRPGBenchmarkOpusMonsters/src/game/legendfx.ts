// The legendaries' own pictures. Each runs on its move's spec, starting the spec `lead` frames late when it builds up
// first, and draws behind and in front of the sloughs past the grammar's limits. Every legendary keeps one motif across
// its moves: Full's Moon, Mundane's growth bands, Knot's cord, Holm's house over the sea, Carcanet's collar of Stones,
// and the Gleaner's listening rings and hand. Color bands and the ordered dither only, never a smooth glow. Nothing here
// reads or changes the battle.
import { dither, fxEase as ease, fxHashN as hash, fxLine as line, fxPx as px, poseOf, type FxRun } from './battlefx';
import type { SceneLight } from './backdrops';
import { fxPlanOf, type FxPlan } from './fxspec';
import { MOVES } from '../battle/registry';

export interface LegendArt {
  /** Frames it plays before the spec's own timeline starts. */
  lead?: number;
  /** Frames it keeps playing after the spec's last landing. */
  tail?: number;
  /** Leaves out the spec's flights, when the art draws what travels. */
  noFlights?: boolean;
  /** Leaves out the spec's landing pictures, when the art draws what happens where it lands. The white hit spark stays. */
  noLandings?: boolean;
  /** Draws over the backdrop and behind the sloughs. */
  back?(r: FxRun): void;
  /** Draws in front of the sloughs. */
  front?(r: FxRun): void;
  /** A shake in scene pixels, a white flash, and a darkening this frame. */
  scene?(r: FxRun): { jolt?: number; glare?: number; dark?: number };
  lights?(r: FxRun): SceneLight[];
}

type Pt = { x: number; y: number };

// ---------------------------------------------------------------- timing

const clamp = (u: number): number => Math.max(0, Math.min(1, u));
/** Progress from 0 to 1 between frames a and b. */
const prog = (t: number, a: number, b: number): number => clamp((t - a) / Math.max(1, b - a));
/** A level that rises over f frames from a and falls over f frames to b, and is 0 outside them. */
const hold = (t: number, a: number, b: number, f = 4): number => (t < a || t >= b ? 0 : Math.min(1, (t - a + 1) / f, (b - t) / f));
/** The frame of the first landing. */
const hitOf = (r: FxRun): number => (r.hits.length ? r.hits[0].at : r.end - 12);
/** The frame the spec's first thing leaves, or its first landing when nothing travels. */
const leaveOf = (r: FxRun): number => (r.flights.length ? r.flights[0].t0 : hitOf(r));
const aim = (r: FxRun): Pt => r.to[0] || r.from;
/** Whether the picture lands on the user's own side. */
const selfish = (r: FxRun): boolean => r.plan.to === 'self' || r.plan.to === 'ally';
/** A two-frame shake of `size` scene pixels for `len` frames from 0. */
const shake = (a: number, len: number, size = 1): number => (a >= 0 && a < len ? ((a >> 1) & 1 ? size : -size) : 0);
/** The user's middle where its motion has it this frame. */
function userAt(r: FxRun): Pt { const p = poseOf(r); return { x: r.from.x + p.dx, y: r.from.y + p.dy }; }
/** Whether a point is the far whorl, high on the right, rather than the near one, low on the left. */
const high = (p: Pt): boolean => p.y < 30;
/** A clear spot beside a whorl for a big sign: right of the far whorl, above the near one, clear of both panels. */
const beside = (p: Pt): Pt => (high(p) ? { x: Math.min(89, p.x + 13), y: Math.max(9, p.y - 5) } : { x: p.x, y: p.y - 12 });

// ---------------------------------------------------------------- drawing

/** A filled ellipse in rows of one color. */
function oval(cx: number, cy: number, rx: number, ry: number, c: string, lv = 1): void {
  const h = Math.max(0, Math.round(ry));
  for (let y = -h; y <= h; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / Math.max(0.25, ry * ry))));
    dither(Math.round(cx) - w, Math.round(cy) + y, 2 * w + 1, 1, c, lv);
  }
}

/** An ellipse outline of single pixels, from `a0` to `a1` of the way round (0 is to the right, a quarter is straight down). */
function arc(cx: number, cy: number, rx: number, ry: number, c: string, lv = 1, a0 = 0, a1 = 1): void {
  const n = Math.max(8, Math.round((rx + ry) * 3.2 * Math.abs(a1 - a0)));
  for (let q = 0; q <= n; q++) { const a = (a0 + (a1 - a0) * q / n) * Math.PI * 2; px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c, lv); }
}

/** The letter at column i of row j, or '.' outside the rows. */
const cell = (g: string[], i: number, j: number): string => g[j]?.[i] ?? '.';

/** The Scale2x rule: each letter becomes 2 by 2, and a corner takes a neighbor's letter where two neighbors agree, so diagonals stay smooth. */
function scale2x(g: string[]): string[] {
  const out: string[] = [];
  g.forEach((row, j) => {
    let r0 = '', r1 = '';
    for (let i = 0; i < row.length; i++) {
      const B = cell(g, i, j - 1), D = cell(g, i - 1, j), E = row[i], F = cell(g, i + 1, j), H = cell(g, i, j + 1);
      r0 += (D === B && B !== F && D !== H ? D : E) + (B === F && B !== D && F !== H ? F : E);
      r1 += (D === H && D !== B && H !== F ? D : E) + (H === F && D !== H && B !== F ? F : E);
    }
    out.push(r0, r1);
  });
  return out;
}

/** The Scale3x rule: each letter becomes 3 by 3, by the same corner test as Scale2x, with edge cells that follow a long diagonal. */
function scale3x(g: string[]): string[] {
  const out: string[] = [];
  g.forEach((row, j) => {
    let r0 = '', r1 = '', r2 = '';
    for (let i = 0; i < row.length; i++) {
      const A = cell(g, i - 1, j - 1), B = cell(g, i, j - 1), C = cell(g, i + 1, j - 1), D = cell(g, i - 1, j), E = row[i];
      const F = cell(g, i + 1, j), G = cell(g, i - 1, j + 1), H = cell(g, i, j + 1), I = cell(g, i + 1, j + 1);
      const db = D === B && B !== F && D !== H, bf = B === F && B !== D && F !== H, dh = D === H && D !== B && H !== F, hf = H === F && D !== H && B !== F;
      r0 += (db ? D : E) + ((db && E !== C) || (bf && E !== A) ? B : E) + (bf ? F : E);
      r1 += ((db && E !== G) || (dh && E !== A) ? D : E) + E + ((bf && E !== I) || (hf && E !== C) ? F : E);
      r2 += (dh ? D : E) + ((dh && E !== I) || (hf && E !== G) ? H : E) + (hf ? F : E);
    }
    out.push(r0, r1, r2);
  });
  return out;
}

/** The rules that grow rows of letters by a whole scale. */
const GROW: Record<number, (g: string[]) => string[]> = { 2: scale2x, 3: scale3x, 4: g => scale2x(scale2x(g)), 6: g => scale2x(scale3x(g)) };
const grownMemo = new Map<string, string[]>();

/** Rows turned as asked and grown to `scale`, made once for each set of rows. */
function grown(rows: string[], scale: number, mirror: boolean, flipY: boolean): string[] {
  const key = `${scale}${mirror ? 'm' : ''}${flipY ? 'f' : ''}|${rows.join('/')}`;
  let g = grownMemo.get(key);
  if (!g) {
    let r = flipY ? rows.slice().reverse() : rows;
    if (mirror) r = r.map(s => [...s].reverse().join(''));
    g = GROW[scale](r);
    grownMemo.set(key, g);
  }
  return g;
}

/**
 * Rows of letters at `scale`, each letter a color from `pal` and '.' clear, centered on x, y. A scale of 2, 3, 4, or 6
 * grows the rows first and draws them at 1 scene pixel a letter, so the picture keeps the scene's pixel size.
 */
function blit(rows: string[], x: number, y: number, pal: Record<string, string>, lv = 1, scale = 1, mirror = false, flipY = false): void {
  const h = rows.length, w = rows[0].length, ox = Math.round(x - (w * scale) / 2), oy = Math.round(y - (h * scale) / 2);
  if (GROW[scale]) {
    for (const [j, row] of grown(rows, scale, mirror, flipY).entries()) {
      for (let i = 0, n = 1; i < row.length; i += n) {
        for (n = 1; row[i + n] === row[i]; n++);
        if (row[i] !== '.' && pal[row[i]]) dither(ox + i, oy + j, n, 1, pal[row[i]], lv);
      }
    }
    return;
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[flipY ? h - 1 - j : j][mirror ? w - 1 - i : i];
    if (ch === '.' || !pal[ch]) continue;
    dither(ox + i * scale, oy + j * scale, scale, scale, pal[ch], lv);
  }
}

/** A wash of one color over the whole scene, behind the sloughs, on the ordered dither. */
const wash = (c: string, lv: number): void => { if (lv > 0) dither(0, 0, 96, 60, c, lv); };

/** Hard bands across part of the scene from y0 down, each a color and a height. */
function bands(x: number, w: number, y0: number, list: [string, number][], lv: number): void {
  if (lv <= 0) return;
  let y = y0;
  for (const [c, h] of list) { dither(x, y, w, h, c, lv); y += h; }
}

/** A line two pixels thick, the second row in c2. */
function thick(x0: number, y0: number, x1: number, y1: number, c: string, lv = 1, c2?: string): void {
  line(x0, y0, x1, y1, c, lv);
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  line(x0 - dy / d, y0 + dx / d, x1 - dy / d, y1 + dx / d, c2 || c, lv);
}

/** A point along a sagging line from a to b at u, the middle `sag` pixels low. */
function sagAt(a: Pt, b: Pt, u: number, sag: number): Pt {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + sag * 4 * u * (1 - u) };
}

/** A spark of four points around a white middle. */
function glint(x: number, y: number, c: string, lv = 1): void { px(x, y, '#ffffff', lv); px(x - 1, y, c, lv); px(x + 1, y, c, lv); px(x, y - 1, c, lv); px(x, y + 1, c, lv); }

/** A dome of banded water rising from a foot line: deep at the bottom, light at the top, with a foam crest. */
function waterDome(x: number, foot: number, w: number, h: number, t: number, deep: string, mid: string, top: string, foam: string, lv = 1): void {
  if (h <= 0) return;
  for (let i = 0; i < h; i++) {
    const half = Math.round(w * Math.sqrt(Math.max(0, 1 - (i * i) / (h * h))));
    dither(Math.round(x) - half, Math.round(foot) - i, 2 * half + 1, 1, i < h * 0.4 ? deep : i < h * 0.75 ? mid : top, lv);
  }
  for (let dx = -w; dx <= w; dx++) {
    const top2 = Math.round(h * Math.sqrt(Math.max(0, 1 - (dx * dx) / (w * w))));
    px(x + dx, foot - top2 - (((dx + (t >> 2)) & 3) === 0 ? 1 : 0), foam, lv);
  }
}

// ---------------------------------------------------------------- Full: the Moon

const MOON = { pale: '#fcf4e3', crater: '#e2d4b2', gold: '#f0c860', deep: '#1a3c8a', sea: '#2a58b8', light: '#5a90e0', foam: '#e0eef8', night: '#0a1230', sand: '#c8b088' };

/** Full's Moon: a pale disc with craters. `cover` (0 to 1) slides its shadow over it from the right, for its phases. */
function moon(x: number, y: number, rad: number, lv = 1, cover = 0): void {
  oval(x, y, rad, rad, MOON.pale, lv);
  if (rad >= 3) {
    px(x - rad * 0.4, y - rad * 0.3, MOON.crater, lv); px(x + rad * 0.3, y + rad * 0.4, MOON.crater, lv);
    if (rad >= 5) { oval(x + rad * 0.35, y - rad * 0.35, 1, 1, MOON.crater, lv); px(x - rad * 0.2, y + rad * 0.5, MOON.crater, lv); }
  }
  if (cover > 0) oval(x + rad * 2 * (1 - cover), y, rad, rad, MOON.night, lv);
}
/** Where the Moon hangs over a whorl. */
const moonOver = (p: Pt): Pt => beside(p);
const moonLight = (p: Pt, lv: number): SceneLight => ({ x: Math.round(p.x), y: Math.round(p.y), r: 12, lv: 1.2 * lv, tint: MOON.pale });
/** Full brings the night: a dark blue wash. */
const night = (lv: number): void => wash(MOON.night, 0.25 * lv);

// ---------------------------------------------------------------- Mundane: growth bands

const SHELL = { red: '#c62d28', cream: '#f4ecd8', yellow: '#f0e040', dark: '#5a1a14', deep: '#1a3c8a', sea: '#2a58b8', foam: '#e0eef8', sand: '#c8b088' };
const BAND = [SHELL.red, SHELL.cream, SHELL.yellow];
/** Mundane's growth bands: n arcs round a point like the layers at a shell's lip, `spread` apart. */
function growth(c: Pt, n: number, spread: number, lv = 1, from = 0.5, to = 1): void {
  for (let i = 0; i < n; i++) arc(c.x, c.y + 1, 5 + i * 2 * spread, 4 + i * 1.4 * spread, BAND[i % 3], lv, from, to);
}

// ---------------------------------------------------------------- Knot: the cord

const CORD = { cord: '#e0d0b0', rust: '#aa4525', steel: '#8a8aa0', dark: '#3a2a22', kelp: '#4a6a32', frond: '#8aa85a' };
/** Knot's cord from a to b: a twisted line of two tones that turns with `phase`, sagging in the middle. */
function cord(a: Pt, b: Pt, sag: number, phase: number, lv = 1, wob = 0): void {
  const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  for (let i = 0; i <= n; i++) {
    const p = sagAt(a, b, i / n, sag), w = wob ? Math.sin(i * 0.9 + phase) * wob : 0;
    px(p.x - dy / d * w, p.y + dx / d * w, ((i + phase) >> 1) & 1 ? CORD.rust : CORD.cord, lv);
  }
}
const KNOT_GLYPH = ['.cr.', 'r..c', '.rc.', 'c..r', '.cr.'];
const knotPal = { c: CORD.cord, r: CORD.rust };

// ---------------------------------------------------------------- Holm: the house and the sea

const ISLE = { sand: '#d8c8a8', roof: '#c8604a', wall: '#f8f0e0', window: '#f0c860', door: '#6a4a3a', deep: '#1a3c8a', sea: '#3a78c8', foam: '#e8f4f8', grass: '#6a9a4a' };
const HOUSE = ['..r..', '.rrr.', 'rrrrr', '.wyw.', '.wdw.'];
/** Holm's house: lit, its window glows yellow, and open, its door shows the light inside. */
function house(p: Pt, scale: number, lv: number, lit: boolean, open = false): void {
  blit(HOUSE, p.x, p.y, { r: ISLE.roof, w: ISLE.wall, y: lit ? ISLE.window : ISLE.door, d: open ? ISLE.window : ISLE.door }, lv, scale);
}
/** Where Holm's house floats over it this frame. */
const houseAt = (r: FxRun): Pt => { const u = userAt(r), b = beside(r.from); return { x: b.x + (u.x - r.from.x), y: b.y + (u.y - r.from.y) }; };
/** The sea at a whorl's feet: three bands that slosh. */
function seaAt(p: Pt, w: number, t: number, lv: number): void {
  const foot = p.y + 5, s = (t >> 2) & 1;
  bands(p.x - w, 2 * w + 1, foot - 1, [[ISLE.foam, 1], [ISLE.sea, 2], [ISLE.deep, 2]], lv);
  for (let dx = -w; dx <= w; dx += 3) px(p.x + dx + s, foot - 2, ISLE.foam, lv);
}

// ---------------------------------------------------------------- Carcanet: the collar of Stones

const GEM = { gold: '#e8b848', purple: '#aa82e5', stones: ['#f4ecd8', '#f0a030', '#70d0b8', '#c4a4f4'] };
/** Which Stone a Carcanet picture is about, from the shape its spec throws: pearl, amber, beach glass, or star glass. */
const stoneOf = (r: FxRun): number => ({ pearl: 0, ember: 1, shard: 2, star: 3 } as Record<string, number>)[r.plan.shape || ''] ?? 0;
const GEM_ROWS = ['.c.', 'chc', '.c.'];
function gem(x: number, y: number, k: number, scale = 1, lv = 1): void { blit(GEM_ROWS, x, y, { c: GEM.stones[k], h: '#ffffff' }, lv, scale); }
/** The four settings over Carcanet's head, round an arc of gold, at angle `turn` (whole turns). */
function collarAt(c: Pt, k: number, turn: number, i: number): Pt {
  const a = (0.58 + i * 0.095 + turn) * Math.PI * 2;
  return { x: c.x + Math.cos(a) * 8, y: c.y - 6 + Math.sin(a) * 3.5 };
}
/** Carcanet's collar at its sprite, drawn by the battle screen: the gold arc, a gem in each setting it holds, and a dim socket in each it lacks. */
export function heldCollar(c: Pt, held: boolean[], runs: FxRun[], side: 0 | 1): void {
  // A Rewind or Full Setting draws the whole collar itself, and a Stone still dropping into its setting is not in it yet.
  let skip = -1;
  for (const r of runs) {
    if (r.side !== side) continue;
    const id = r.plan.id;
    if (id === 'carc_rewind' || id === 'carc_crest') return;
    if (id === 'carc_set' && r.t < hitOf(r)) skip = stoneOf(r);
  }
  arc(c.x, c.y - 6, 8, 3.5, GEM.gold, 1, 0.55, 0.95);
  for (let i = 0; i < 4; i++) {
    const p = collarAt(c, i, 0, i);
    if (held[i] && i !== skip) gem(p.x, p.y, i, 1, 1);
    else px(p.x, p.y, '#8a6a30', 1);
  }
}

// ---------------------------------------------------------------- the Gleaner: listening rings and a great hand

const EAR = { pale: '#fcf6ff', pink: '#edc5cd', violet: '#675797', deep: '#2a2048' };
const HAND = ['.ppppppp.', 'pPPPPPPPp', 'pPPPPPPPp', 'pPPPPPPPp', 'pPpPpPpPp', 'pPpPpPpPp', '.p.p.p.p.'];
const FIST = ['.ppppppp.', 'pPPPPPPPp', 'pPPPPPPPp', 'pPPPPPPPp', 'pPPPPPPPp', '.ppppppp.'];
/** Rings of sound running from a to b, the way the Gleaner listens: each an arc facing b. */
function listening(a: Pt, b: Pt, t: number, n: number, lv: number, speed = 1): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx) / (Math.PI * 2);
  for (let q = 0; q < n; q++) {
    const u = ((t * 0.04 * speed + q / n) % 1);
    const p = { x: a.x + dx * u, y: a.y + dy * u }, rr = 2 + 4 * (1 - u);
    arc(p.x, p.y, rr, rr * 0.8, q % 2 ? EAR.pink : EAR.pale, lv * Math.min(1, u * 4), ang - 0.15, ang + 0.15);
  }
}

// ---------------------------------------------------------------- Tynagi: the time machine

/** Still Minute's time machine, in Tynagi's colors: a coiled shell hull with its dial, brass fins, and a glass dome. */
const SHIP = { cream: '#e8d8b0', slate: '#41597a', gray: '#9dadbd', pale: '#dfe5eb', brass: '#c8a060', glass: '#bfe8ff', dark: '#1e2a40' };

/** The time machine behind its rider, centered on the rider's middle: the hull, the dial, the fins at turn `spin`, and the dark inside of the dome. */
export function shipBack(x: number, y: number, lv: number, spin: number): void {
  x = Math.round(x); y = Math.round(y);
  dither(x - 5, y - 5, 11, 10, SHIP.dark, 0.25 * lv);
  oval(x, y + 6, 7, 2, SHIP.slate, lv);
  oval(x, y + 5, 6, 1, SHIP.cream, lv);
  // The hull coils like a shell at its back end.
  arc(x - 4, y + 5, 2, 2, SHIP.slate, lv, 0.25, 1);
  px(x - 4, y + 5, SHIP.gray, lv);
  // Tynagi's dial on the hull's front.
  px(x + 3, y + 5, SHIP.pale, lv); px(x + 4, y + 5, SHIP.slate, lv); px(x + 3, y + 4, SHIP.slate, lv);
  // Brass fins that turn while it flies.
  const f = Math.round(Math.cos(spin) * 3);
  line(x - f, y - 8, x + f, y - 8, SHIP.brass, lv);
  px(x, y - 7, SHIP.brass, lv);
}

/** The time machine's glass in front of its rider: a thin dither of glass, the dome's rim, and a glint. */
export function shipFront(x: number, y: number, lv: number): void {
  x = Math.round(x); y = Math.round(y);
  dither(x - 5, y - 5, 11, 4, SHIP.glass, 0.125 * lv);
  arc(x, y, 6, 6, SHIP.pale, lv, 0.5, 1);
  px(x - 6, y + 1, SHIP.gray, lv); px(x + 6, y + 1, SHIP.gray, lv);
  px(x - 3, y - 4, '#ffffff', lv); px(x - 2, y - 5, '#ffffff', lv);
}

/** The streaks a flying time machine leaves: hard bands of pale and slate running `len` pixels below it. */
export function shipTrail(x: number, y: number, len: number, lv: number): void {
  x = Math.round(x); y = Math.round(y);
  for (let k = 0; k < len; k += 2) {
    const fade = lv * (1 - k / Math.max(1, len));
    px(x - 3, y + 8 + k, SHIP.pale, fade); px(x + 3, y + 8 + k + 1, SHIP.pale, fade);
    if (k % 4 === 0) px(x, y + 9 + k, SHIP.slate, fade);
  }
}

/** A ring of time where the machine comes or goes: two rims of hard color `a` frames old, gone after 12. */
export function shipRing(x: number, y: number, a: number): void {
  if (a < 0 || a >= 12) return;
  const lv = 1 - a / 12;
  arc(x, y, 3 + a, 2 + a * 0.7, SHIP.pale, lv);
  if (a > 2) arc(x, y, 1 + a * 0.6, 1 + a * 0.4, SHIP.slate, lv);
}

// ---------------------------------------------------------------- the pictures

export const LEGEND_ART: Record<string, LegendArt> = {
  // ---------------- Full
  // Tide Lift: the Moon crosses the night to hang over the foe, and the sea stands up under it.
  tidelift: {
    noFlights: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 6);
      night(L);
      const A = moonOver(r.from), B = moonOver(E), u = ease(prog(t, 0, hit));
      moon(A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u - Math.sin(Math.PI * u) * 4, 4, L);
      const a = t - hit, h = Math.round(9 * (a < 2 ? clamp((a + 8) / 10) : 1 - prog(a, 8, r.end - hit)));
      if (a >= -8) waterDome(E.x, E.y + 5, 10, h, t, MOON.deep, MOON.sea, MOON.light, MOON.foam);
    },
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      if (a < 0 || a >= 16) return;
      for (let q = 0; q < 8; q++) {
        const x = E.x - 8 + q * 2.3, up = Math.sin(Math.PI * clamp(a / 16)) * (3 + (q % 3) * 2);
        px(x, E.y - 4 - up, q % 2 ? MOON.foam : '#ffffff', 1 - a / 16);
      }
    },
    lights(r) { return [moonLight(moonOver(aim(r)), hold(r.t, 0, r.end, 6))]; },
  },

  // Neap: a half Moon over its foe pulls the sea out from under it, and tide runs back to Full. Home, it sits over Full.
  neap: {
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      night(0.75 * L);
      if (selfish(r)) { moon(moonOver(r.from).x, moonOver(r.from).y, 4, L, 0.5); return; }
      const E = aim(r), P = moonOver(E);
      moon(P.x, P.y, 4, L, 0.5);
      // The sea goes out from under the foe and leaves a strip of wet sand.
      const h = Math.round(5 * (1 - prog(t, hit - 6, hit + 12)));
      bands(E.x - 10, 21, E.y + 5, [[MOON.sand, 2]], 0.75 * L);
      waterDome(E.x, E.y + 5, 10, h, t, MOON.deep, MOON.sea, MOON.light, MOON.foam, L);
    },
    front(r) {
      if (selfish(r)) {
        // Home: the half Moon throws two pale rings round Full, its Haste.
        const a = r.t - hitOf(r), U = userAt(r);
        for (let q = 0; q < 2; q++) if (a - q * 4 >= 0 && a - q * 4 < 12) arc(U.x, U.y + 2, 4 + (a - q * 4), 2 + (a - q * 4) / 3, MOON.pale, 1 - (a - q * 4) / 12);
        return;
      }
      // Three pips of tide run from the foe back to Full.
      const a = r.t - hitOf(r) - 2, E = aim(r);
      for (let q = 0; q < 3; q++) {
        const u = prog(a - q * 3, 0, 14);
        if (u <= 0 || u >= 1) continue;
        const x = E.x + (r.from.x - E.x) * ease(u), y = E.y + (r.from.y - E.y) * ease(u) - Math.sin(Math.PI * u) * 8;
        blit(['.b.', 'bfb', '.b.'], x, y, { b: MOON.sea, f: MOON.foam }, 1);
      }
    },
    lights(r) { return [moonLight(moonOver(selfish(r) ? r.from : aim(r)), 0.6 * hold(r.t, 0, r.end, 6))]; },
  },

  // Moonfall: the Moon swells over its foe, drops on it, and comes home small. With the Moon home, it settles over Full.
  springtide: {
    lead: 11,
    noFlights: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      night(L);
      if (selfish(r)) {
        const P = moonOver(r.from), U = userAt(r), u = ease(prog(t, 0, hit));
        moon(P.x + (U.x - P.x) * u * 0.5, P.y + (U.y - 8 - P.y) * u * 0.5, 5 - u * 2, L);
        return;
      }
      const E = aim(r), P = moonOver(E);
      const grow = ease(prog(t, 0, hit - 12)), fall = prog(t, hit - 10, hit);
      if (t < hit) {
        // Its shadow spreads on the ground as it swells and falls.
        oval(E.x, E.y + 6, 3 + 7 * Math.max(grow * 0.5, fall), 1 + fall, '#000000', 0.5);
        moon(P.x + (E.x - P.x) * fall, P.y + (E.y - 2 - P.y) * fall * fall, 4 + 5 * grow - 2 * fall, L);
      }
      // A crater opens and rubble flies from it.
      const a = t - hit;
      if (a >= 0 && a < 20) {
        arc(E.x, E.y + 6, 6 + a * 0.5, 2 + a * 0.15, MOON.crater, 1 - a / 20);
        for (let q = 0; q < 12; q++) {
          const ang = Math.PI * (1.05 + 0.9 * q / 11), v = 0.7 + hash(r.seed + q) * 0.9;
          px(E.x + Math.cos(ang) * v * a * 1.5, E.y + 5 + Math.sin(ang) * v * a * 1.2 + 0.1 * a * a, q % 2 ? MOON.crater : '#8a7a62', 1 - a / 20);
        }
      }
    },
    front(r) {
      if (selfish(r)) return;
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0 && a < 3) oval(E.x, E.y, 6 - a, 5 - a, '#ffffff', 1);
      // Then the Moon goes home small along an arc.
      const u = prog(a, 6, 22);
      if (u > 0 && u < 1) moon(E.x + (r.from.x - E.x) * ease(u), E.y + (r.from.y - 10 - E.y) * ease(u) - Math.sin(Math.PI * u) * 12, 2, 1);
    },
    scene(r) { const a = r.t - hitOf(r); return selfish(r) ? {} : { jolt: shake(a, 12, 1) }; },
    lights(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), P = moonOver(selfish(r) ? r.from : E), fall = prog(t, hit - 10, hit);
      return [moonLight({ x: P.x + (E.x - P.x) * fall, y: P.y + (E.y - P.y) * fall }, hold(t, 0, hit + 6, 6))];
    },
  },

  // Syzygy: sun, sea, and Moon slide into one line between Full and its foe, the night deepens, and the Moon's light falls on the foe.
  syzygy: {
    lead: 30,
    noFlights: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 8), k = ease(prog(t, 0, 28));
      night(L * (1 + k));
      const S = r.from, dx = E.x - S.x, dy = E.y - S.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      const at = (u: number, off: number): Pt => ({ x: S.x + dx * u + nx * off * (1 - k), y: S.y + dy * u + ny * off * (1 - k) });
      const sun = at(0.38, 12), sea = at(0.5, -10), mo = at(0.62, 9);
      oval(sun.x, sun.y, 4, 4, MOON.gold, L);
      arc(sun.x, sun.y, 5, 5, MOON.gold, 0.5 * L);
      oval(sea.x, sea.y, 3, 3, MOON.sea, L); px(sea.x - 1, sea.y - 1, MOON.foam, L); px(sea.x + 1, sea.y + 1, MOON.light, L);
      moon(mo.x, mo.y, 3, L);
      if (t >= 28 && t < hit + 16) {
        // In line, a corona rings the Moon and a thin gold thread runs through all three.
        const w = (t >> 2) & 1;
        arc(mo.x, mo.y, 5 + w, 5 + w, MOON.gold, L);
        line(sun.x, sun.y, mo.x, mo.y, MOON.gold, 0.5 * L);
      }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), S = r.from, a = t - hit;
      const mo = { x: S.x + (E.x - S.x) * 0.62, y: S.y + (E.y - S.y) * 0.62 };
      // The Moon's light falls on the foe as a banded beam, pale in the middle and gold at the edges.
      const on = hold(t, hit - 8, hit + 18, 4);
      if (on > 0) {
        thick(mo.x, mo.y, E.x, E.y, MOON.pale, on, MOON.pale);
        const ddx = E.x - mo.x, ddy = E.y - mo.y, dd = Math.hypot(ddx, ddy) || 1, ox = -ddy / dd * 2, oy = ddx / dd * 2;
        line(mo.x + ox, mo.y + oy, E.x + ox, E.y + oy, MOON.gold, on * 0.75);
        line(mo.x - ox, mo.y - oy, E.x - ox, E.y - oy, MOON.gold, on * 0.75);
      }
      if (a >= 0 && a < 14) { arc(E.x, E.y + 5, 3 + a, 1 + a / 3, MOON.pale, 1 - a / 14); arc(E.x, E.y + 5, 1 + a * 0.6, 1 + a / 5, MOON.gold, 1 - a / 14); }
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 1), dark: r.t > 18 && a < 16 ? 0.25 : 0 }; },
    lights(r) {
      const E = aim(r), S = r.from, mo = { x: S.x + (E.x - S.x) * 0.62, y: S.y + (E.y - S.y) * 0.62 };
      return [moonLight(mo, hold(r.t, 0, r.end, 8)), { x: Math.round(E.x), y: Math.round(E.y), r: 12, lv: 1.6 * hold(r.t, hitOf(r) - 8, hitOf(r) + 18, 4), tint: MOON.pale }];
    },
  },

  // ---------------- Mundane
  // Plate: growth bands gather on Mundane's front, and it slams the foe with them: a banded crack opens under the foe.
  plate: {
    back(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), L = hold(t, 0, hit + 4, 3);
      growth(U, 3, 1 - 0.4 * prog(t, hit - 6, hit), L, 0.25, 1.25);
      const a = t - hit, E = aim(r);
      if (a >= 0 && a < 16) for (let i = 0; i < 3; i++) {
        const reach = Math.round(Math.min(1, (a + 1) / 4) * (12 - i * 3)), y = E.y + 5 + i;
        dither(E.x - reach, y, 2 * reach + 1, 1, BAND[i], 1 - a / 16);
      }
    },
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      // A shell plate comes down on the foe at the blow.
      if (a >= -2 && a < 6) {
        const y = E.y - 6 + Math.min(4, a + 2) * 1.5;
        arc(E.x, y + 4, 8, 4, SHELL.red, 1, 0.55, 0.95); arc(E.x, y + 5, 8, 4, SHELL.cream, 1, 0.55, 0.95); arc(E.x, y + 6, 8, 4, SHELL.yellow, 1, 0.58, 0.92);
      }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Undertow: the old sea runs under the foe and drags it out, and Mundane lays down one more band.
  fold: {
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 2, r.end, 5), dir = E.x >= r.from.x ? 1 : -1;
      // A dark current under the foe, its streaks all running off the field.
      bands(E.x - 14, 29, E.y + 3, [[SHELL.foam, 1], [SHELL.sea, 2], [SHELL.deep, 2]], 0.75 * L);
      for (let q = 0; q < 7; q++) {
        const run = ((t * 1.5 + q * 9) % 32) - 16, y = E.y + 4 + (q % 4);
        line(E.x + run * dir, y, E.x + (run + 4) * dir, y, SHELL.foam, L);
      }
      // One more band on Mundane once the foe is pulled under.
      const U = userAt(r), a = t - hit;
      growth(U, 2, 1, 0.5 * L, 0.5, 1);
      if (a >= 4) arc(U.x, U.y + 1, 9 + Math.max(0, 6 - (a - 4)), 6.8, SHELL.yellow, hold(t, hit + 4, r.end, 3), 0.5, 1);
    },
  },

  // Settle: growth bands close in on Mundane from far out and harden round it.
  settle: {
    back(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4), u = ease(prog(t, 0, hitOf(r)));
      for (let i = 0; i < 4; i++) arc(U.x, U.y + 1, 5 + i * 2 + (1 - u) * (12 - i), 4 + i * 1.4 + (1 - u) * (7 - i), BAND[i % 3], L, 0.5, 1);
      // Once they are on, they set: the ground under it darkens.
      if (u >= 1) bands(U.x - 9, 19, U.y + 5, [[SHELL.dark, 1], [SHELL.sand, 1]], 0.5 * L);
    },
  },

  // Peel: every band lifts off Mundane at once and flies at every foe as a strip of shell.
  peel: {
    lead: 18,
    noFlights: true,
    back(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      wash(SHELL.red, 0.125 * hold(t, 0, go + 6, 6));
      // The bands come up one by one, then all leave when it peels.
      const n = Math.min(5, Math.floor(t / 3) + 1);
      if (t < go) growth(U, n, 1, 1, 0.3, 1.2);
    },
    front(r) {
      const t = r.t;
      for (const f of r.flights) {
        const a = t - f.t0, E = r.to[f.to] || r.to[0], S = r.from;
        if (a < 0 || a >= f.dur) continue;
        const u = a / f.dur, p = sagAt(S, E, u, -10 - (f.i % 3) * 3), c = BAND[f.i % 3];
        const dir = E.x >= S.x ? 1 : -1;
        // A curved strip of shell, turning as it flies.
        arc(p.x, p.y + 2, 4, 2, c, 1, 0.55 + u * 0.4 * dir, 0.95 + u * 0.4 * dir);
        arc(p.x, p.y + 3, 4, 2, c, 1, 0.55 + u * 0.4 * dir, 0.95 + u * 0.4 * dir);
      }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 12, 2) }; },
  },

  // ---------------- Knot
  // Crank: a great key turns at Knot's back, the cord between it and the foe twists, and Knot drives in.
  turnkey: {
    back(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4), side = r.to[0].x >= r.from.x ? -1 : 1;
      const turn = (t >> 2) & 3;
      const KEYS = [['.sss.', 's.s.s', '.sss.', '..s..', '..s..', '..ss.', '..s..', '..ss.'], ['.....', '.....', 'ss.s.', 'ssssss', 'ss...'], ['..s..', '..ss.', '..s..', '..ss.', '..s..', '.sss.', 's.s.s', '.sss.'], ['.....', '.s.ss', 'ssssss', '...ss', '.....']];
      const rows = KEYS[turn].map(row => row.padEnd(6, '.'));
      blit(rows, U.x + side * 11, U.y - 8, { s: CORD.steel }, L, 2);
    },
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), E = aim(r), L = hold(t, 0, r.end, 4);
      cord(U, E, t < hit ? 6 * (1 - prog(t, 0, hit)) : 0, t, L * (t < hit ? 1 : 0.6));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Tie: kelp holdfasts rise round the foe, and the cord loops it and knots, tying it to Knot.
  tension: {
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 4), grow = prog(t, 0, hit);
      for (let q = 0; q < 4; q++) {
        const x0 = E.x - 9 + q * 6, h = Math.round((6 + (q % 2) * 3) * grow);
        for (let i = 0; i < h; i++) px(x0 + Math.round(Math.sin((t + i * 2 + q * 5) / 4)), E.y + 5 - i, i === h - 1 ? CORD.frond : CORD.kelp, L);
      }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), U = userAt(r), a = t - hit, L = hold(t, hit - 2, r.end, 4);
      if (a < -2) return;
      const rx = Math.max(5, 9 - a * 0.6);
      arc(E.x, E.y + 1, rx, 2, CORD.cord, L, 0, 1);
      arc(E.x, E.y + 2, rx, 2, CORD.rust, L, 0.05, 0.45);
      blit(KNOT_GLYPH, E.x + (U.x < E.x ? -rx : rx), E.y + 1, knotPal, L);
      cord(U, { x: E.x + (U.x < E.x ? -rx : rx), y: E.y + 1 }, 7, 0, 0.75 * L);
    },
  },

  // Tighten: the cord snaps taut and hums, tension ticks run along it, and the foe is jerked off its feet.
  stand: {
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), E = aim(r), L = hold(t, 0, r.end, 3), taut = prog(t, 0, hit - 2);
      const hum = t < hit + 10 ? ((t & 1) ? 1 : -1) * taut : 0;
      cord(U, E, 8 * (1 - taut), t, L, hum);
      // Ticks across the cord where the strain shows.
      if (taut >= 1) {
        const dx = E.x - U.x, dy = E.y - U.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d * 2, ny = dx / d * 2;
        for (let q = 1; q < 6; q++) { if (((t >> 1) + q) & 1) continue; const p = { x: U.x + dx * q / 6, y: U.y + dy * q / 6 }; line(p.x - nx, p.y - ny, p.x + nx, p.y + ny, CORD.cord, L); }
      }
      // A ring of cord round Knot itself, its shield.
      const a = t - hit;
      if (a >= 0) arc(U.x, U.y + 1, 6, 3, CORD.rust, hold(t, hit, r.end, 3));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // The Operculum: a great round lid comes down out of the sky over the foes and slams shut, and the cord binds the foe.
  thekey: {
    lead: 20,
    noFlights: true,
    back(r) {
      const t = r.t, hit = hitOf(r);
      wash(CORD.rust, 0.125 * hold(t, 0, hit + 8, 6));
      for (const E of r.to) { const g = prog(t, 0, hit); if (t < hit + 4) oval(E.x, E.y + 6, 3 + 9 * g, 1 + g * 2, '#000000', 0.5); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit, U = userAt(r);
      for (const E of r.to) {
        // It hangs over the foe through the build-up, then slams down in the last frames.
        const hang = high(E) ? E.y - 8 : E.y - 14, y = t < hit - 8 ? -8 + (hang + 8) * ease(prog(t, 0, 20)) : hang + (E.y - 1 - hang) * ease(prog(t, hit - 8, hit)), L = hold(t, 0, hit + 10, 3);
        if (L <= 0) continue;
        // The lid: a disc with a spiral cut in it, rimmed in rust.
        oval(E.x, y, 11, 5, CORD.steel, L);
        arc(E.x, y, 11, 5, CORD.rust, L);
        arc(E.x, y, 7, 3, CORD.cord, L, 0, 0.8);
        arc(E.x + 1, y, 4, 2, CORD.cord, L, 0.3, 1);
        px(E.x + 1, y, CORD.dark, L);
      }
      const E = aim(r);
      if (a >= 4) cord(U, E, 4, t, hold(t, hit + 4, r.end, 4));
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 1) }; },
  },

  // ---------------- Holm
  // Shoulder: the sea surges under Holm as it drives in, and the ground heaves up under the foe.
  holm_shoulder: {
    back(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), E = aim(r), L = hold(t, 0, r.end, 4);
      seaAt(U, 8, t, L);
      const a = t - hit;
      if (a >= 0 && a < 14) { const h = Math.round(3 * Math.sin(Math.PI * a / 14)); bands(E.x - 9, 19, E.y + 5 - h, [[ISLE.grass, 1], [ISLE.sand, h + 1]], 1); }
    },
    front(r) { house(houseAt(r), 1, hold(r.t, 0, r.end, 4), (r.t >> 3) & 1 ? true : false); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Carry Them: the house on Holm's back lights up, and a small Rider climbs in at its door.
  holm_carry: {
    front(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 4), H = houseAt(r);
      house(H, 2, L, t >= hit - 4, t >= hit - 8 && t < hit);
      // The Rider: a dot of a figure that hops up into the door.
      const u = prog(t, 2, hit - 4), U = userAt(r);
      if (u > 0 && u < 1) { const x = U.x + (H.x - U.x) * u, y = U.y + 4 + (H.y + 5 - U.y - 4) * u - Math.sin(Math.PI * u) * 5; blit(['k', 'w', 'w'], x, y, { k: ISLE.door, w: ISLE.wall }, 1); }
    },
    back(r) { seaAt(userAt(r), 8, r.t, hold(r.t, 0, r.end, 4)); },
  },

  // Long Wake: a long white V of foam and salt opens behind Holm and runs out to the foe.
  holm_wake: {
    back(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), E = aim(r), L = hold(t, 0, r.end, 5), u = prog(t, 0, hit);
      const dx = E.x - U.x, dy = E.y - U.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      for (let i = 0; i <= Math.round(d * u); i += 1) {
        const f = i / d, w = 1 + f * 7, x = U.x + dx * f, y = U.y + 3 + dy * f;
        const c = (i + (t >> 1)) % 5 === 0 ? '#ffffff' : ISLE.foam;
        px(x + nx * w, y + ny * w, c, L); px(x - nx * w, y - ny * w, c, L);
        if (i % 3 === 0) px(x + nx * w * 0.5, y + ny * w * 0.5, ISLE.sea, L * 0.5);
      }
      seaAt(U, 7, t, L);
    },
    front(r) {
      house(houseAt(r), 1, hold(r.t, 0, r.end, 4), true);
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0 && a < 16) for (let q = 0; q < 6; q++) glint(E.x + (hash(r.seed + q) - 0.5) * 16, E.y + (hash(r.seed + q * 3) - 0.5) * 10, '#e4e8f0', 1 - a / 16);
    },
  },

  // Make Landfall: the sea comes up over the bottom of the field, a shore rises, and the house's door opens on the ally.
  holm_lap: {
    lead: 14,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6), up = ease(prog(t, 0, 14));
      wash('#f0b070', 0.125 * L);
      const top = Math.round(60 - 9 * up);
      bands(0, 96, top, [[ISLE.foam, 1], [ISLE.sea, 3], [ISLE.deep, 6]], L);
      for (let x = (t >> 1) % 4; x < 96; x += 4) px(x, top + 1, '#ffffff', L);
      // A shore rises under the ally coming in.
      const U = r.from, s = prog(t, 8, hit);
      if (s > 0) bands(U.x - 12, 25, U.y + 5, [[ISLE.grass, 1], [ISLE.sand, 2]], s * L);
    },
    front(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6), H = houseAt(r), open = t >= hit - 6;
      house(H, 2, L, true, open);
      // Light spills from the open door down to the shore in hard bands.
      if (open) { const k = hold(t, hit - 6, r.end, 4); for (let y = H.y + 5; y < r.from.y + 5; y++) dither(H.x - 1, y, 3, 1, ISLE.window, 0.5 * k); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 1) }; },
  },

  // ---------------- Carcanet
  // Facet: its newest Stone swells in the collar and throws a faceted beam at the foe.
  carc_facet: {
    noFlights: true,
    front(r) {
      const t = r.t, hit = hitOf(r), k = stoneOf(r), c = GEM.stones[k], U = userAt(r), g = collarAt(U, k, 0, k), E = aim(r);
      gem(g.x, g.y, k, 2, hold(t, 0, r.end, 4));
      const on = hold(t, leaveOf(r) - 2, hit + 6, 2);
      if (on > 0) {
        // A beam that zigzags in facets, white and the Stone's color by turns.
        const n = 6;
        let p0 = g;
        for (let q = 1; q <= n; q++) {
          const u = q / n, j = (q % 2 ? 1 : -1) * (q < n ? 2 : 0), p1 = { x: g.x + (E.x - g.x) * u - (E.y - g.y) / 40 * j, y: g.y + (E.y - g.y) * u + (E.x - g.x) / 40 * j };
          thick(p0.x, p0.y, p1.x, p1.y, q % 2 ? '#ffffff' : c, on, c);
          p0 = p1;
        }
      }
      const a = t - hit;
      if (a >= 0 && a < 14) for (let q = 0; q < 4; q++) gem(E.x + Math.cos(q * 1.57 + a * 0.2) * (3 + a * 0.6), E.y + Math.sin(q * 1.57 + a * 0.2) * (2 + a * 0.4), k, 1, 1 - a / 14);
    },
  },

  // Rewind: the collar spins backward round Carcanet, the Tape runs back, and the next Stone drops into its setting.
  carc_rewind: {
    noFlights: true,
    back(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4), spin = -prog(t, 0, r.end - 6) * 2;
      arc(U.x, U.y - 2, 10, 5, GEM.gold, L);
      for (let i = 0; i < 4; i++) { const a = (spin + i / 4) * Math.PI * 2; gem(U.x + Math.cos(a) * 10, U.y - 2 + Math.sin(a) * 5, i, 1, L); }
      // The Tape: a row of the four colors under it, running backward.
      for (let x = -14; x <= 14; x++) { const k = (((x + (t >> 1)) % 8) + 8) % 8; if (k < 6) px(U.x + x, U.y + 7, GEM.stones[k >> 1 & 3], L); }
    },
    front(r) {
      const a = r.t - hitOf(r), U = userAt(r);
      if (a >= 0 && a < 12) glint(U.x, U.y - 9, GEM.stones[0], 1 - a / 12);
    },
  },

  // Cleave: one cut per Stone it holds, each in a Stone's color, and the oldest Stone falls from the collar.
  carc_cleave: {
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), U = userAt(r);
      for (let q = 0; q < 4; q++) {
        const a = t - hit - q * 2;
        if (a < 0 || a >= 8) continue;
        const n = Math.min(1, (a + 1) / 3), s = q % 2 ? 1 : -1, x0 = E.x + s * 7, y0 = E.y - 7 + q, x1 = x0 - s * 14 * n, y1 = y0 + 13 * n;
        thick(x0, y0, x1, y1, GEM.stones[q], 1 - a / 8, '#ffffff');
      }
      // The oldest Stone pops off and falls with a twinkle.
      const a = t - hit - 6;
      if (a >= 0 && a < 16) { const p = collarAt(U, 0, 0, 0); gem(p.x - a * 0.3, p.y + 0.12 * a * a, 0, 1, 1 - a / 16); }
    },
  },

  // Full Setting: the sky takes the four Stones' colors, they swell round Carcanet, fly, and set round the foe in a ring of gold.
  carc_crest: {
    lead: 24,
    noFlights: true,
    back(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), L = hold(t, 0, r.end, 6);
      wash(GEM.purple, 0.125 * L);
      for (let i = 0; i < 4; i++) bands(i * 24, 24, 53, [[GEM.stones[i], 7]], 0.5 * L);
      if (t < go) {
        const grow = 1 + Math.floor(prog(t, 0, go) * 2.99);
        for (let i = 0; i < 4; i++) { const a = (t / 24 + i / 4) * Math.PI * 2; gem(U.x + Math.cos(a) * 11, U.y - 2 + Math.sin(a) * 5, i, grow, L); }
      }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r);
      for (const f of r.flights) {
        const a = t - f.t0, E = r.to[f.to] || r.to[0];
        if (a < 0 || a >= f.dur || f.i > 3) continue;
        const u = ease(a / f.dur), p = sagAt(U, E, u, -8);
        gem(p.x, p.y, f.i % 4, 2, 1);
      }
      // The setting: a ring of gold round each foe with a Stone at each point.
      r.to.forEach((E) => {
        const a = t - hit, L = hold(t, hit - 1, r.end, 4);
        if (L <= 0) return;
        arc(E.x, E.y + 1, 10, 5, GEM.gold, L);
        arc(E.x, E.y + 1, 11, 6, GEM.gold, 0.5 * L);
        for (let i = 0; i < 4; i++) { const ang = (i / 4 + a / 80) * Math.PI * 2; gem(E.x + Math.cos(ang) * 10, E.y + 1 + Math.sin(ang) * 5, i, 2, L); }
      });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 10, 1) }; },
    lights(r) { return r.to.map(E => ({ x: Math.round(E.x), y: Math.round(E.y), r: 12, lv: 1.4 * hold(r.t, hitOf(r) - 1, r.end, 4), tint: GEM.gold })); },
  },

  // Set Stone: a Stone drops into its setting in the collar, and the gold closes on it.
  carc_set: {
    noFlights: true,
    front(r) {
      const t = r.t, k = stoneOf(r), U = userAt(r), p = collarAt(U, k, 0, k), L = hold(t, 0, r.end, 3), u = ease(prog(t, 0, hitOf(r)));
      gem(p.x, p.y - 12 * (1 - u), k, u < 1 ? 2 : 1, L);
      if (u >= 1) { const a = t - hitOf(r); if (a < 10) { glint(p.x, p.y - 2, GEM.gold, 1 - a / 10); px(p.x - 2, p.y, GEM.gold, L); px(p.x + 2, p.y, GEM.gold, L); } }
    },
  },

  // ---------------- The Gleaner
  // Listen: the field hushes, rings of sound run from the foe to the Gleaner, and what it hears comes back as a blow.
  gleaner_listen: {
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 5);
      wash(EAR.violet, 0.125 * L);
      if (t < hit) listening(E, userAt(r), t, 4, L, 1.5);
    },
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0 && a < 14) { arc(E.x, E.y, 3 + a, 2 + a * 0.7, EAR.pale, 1 - a / 14); arc(E.x, E.y, 1 + a * 0.6, 1 + a * 0.4, EAR.pink, 1 - a / 14); }
    },
  },

  // Label: a tag on a pink string sticks to the foe and swings there, tied back to the Gleaner.
  gleaner_label: {
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), U = userAt(r), a = t - hit, L = hold(t, hit, r.end, 4);
      if (a < 0) return;
      const sw = Math.round(Math.sin(a / 3) * 1.5), tag = { x: E.x + (U.x < E.x ? 5 : -5) + sw, y: E.y - 5 };
      cord2(U, tag, 6, EAR.pink, 0.75 * L);
      blit(['vvvvv', 'vpppv', 'vp.pv', 'vpppv', 'vvvvv'], tag.x, tag.y + 2, { v: EAR.violet, p: EAR.pink }, L);
      if (a < 6) arc(E.x, E.y, 3 + a, 2 + a / 2, EAR.pale, 1 - a / 6);
    },
  },

  // Set Down: a great hand comes down out of the sky on the foe, presses it down, and lifts away.
  gleaner_setdown: {
    noFlights: true,
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), down = ease(prog(t, 0, hit)), up = ease(prog(t, hit + 6, r.end - 2));
      const y = -10 + (E.y - 8 + 10) * down - 26 * up;
      blit(HAND, E.x, y, { p: EAR.violet, P: EAR.pale }, hold(t, 0, r.end, 3), 2, false, true);
    },
    back(r) { const t = r.t, E = aim(r); if (t < hitOf(r) + 6) oval(E.x, E.y + 6, 4 + 6 * prog(t, 0, hitOf(r)), 1 + prog(t, 0, hitOf(r)), '#000000', 0.5); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 1) }; },
  },

  // Hold to Ear: the hand closes on the foe and lifts it out of sight while the Gleaner listens, rings pulsing round it.
  gleaner_hold: {
    lead: 16,
    noFlights: true,
    back(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 6);
      wash(EAR.deep, 0.25 * L);
      for (let q = 0; q < 3; q++) { const k = ((t >> 1) + q * 4) % 12; arc(U.x, U.y, 4 + k, 3 + k * 0.6, q % 2 ? EAR.pink : EAR.pale, L * (1 - k / 12)); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), down = ease(prog(t, 0, 14)), up = ease(prog(t, hit, r.end - 4));
      const closed = t >= 14, y = -10 + (E.y - 3 + 10) * down - 34 * up;
      blit(closed ? FIST : HAND, E.x, y, { p: EAR.violet, P: EAR.pale }, hold(t, 0, r.end, 3), 2, false, !closed);
    },
    scene(r) { return { jolt: shake(r.t - 14, 6, 1) }; },
  },

  // ---------------- Signature moves of other kinds, whose mechanics the grammar could not show

  // Ninth Wave (Bilowa): a wall of water rises behind the foe, its crest curls over, and it breaks on the foe.
  breaker_ninthwave: {
    lead: 12,
    noFlights: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 6);
      // The wall rises behind the foe, on the far side from the user, and leans over it before it breaks.
      const away = high(E) ? 1 : -1, foot = E.y + 5, H = Math.round(4 + 20 * ease(prog(t, 0, hit - 4))), lean = ease(prog(t, hit - 6, hit));
      if (t < hit + 2) for (let i = 0; i <= 16; i++) {
        const x = E.x + away * (4 + i), h = Math.round(H * (1 - i / 22));
        if (h <= 0) continue;
        dither(x, foot - h, 1, h, MOON.sea, L);
        dither(x, foot - Math.round(h * 0.35), 1, Math.round(h * 0.35), MOON.deep, L);
        dither(x, foot - h, 1, Math.max(1, Math.round(h * 0.2)), MOON.light, L);
        px(x, foot - h - 1, MOON.foam, L);
      }
      // The crest: a curl of foam that tips toward the foe.
      if (t < hit + 2) {
        const cx = E.x + away * (4 - 6 * lean), cy = foot - H + 2 + 4 * lean;
        arc(cx, cy, 5, 4, MOON.foam, L, away > 0 ? 0.5 : 0, away > 0 ? 1 : 0.5);
        arc(cx, cy + 1, 3, 2, '#ffffff', L, away > 0 ? 0.55 : 0.05, away > 0 ? 0.95 : 0.45);
      }
      // It breaks over the foe: a foam band at its feet and spray thrown up and back.
      const a = t - hit;
      if (a >= 0 && a < 18) {
        bands(E.x - 14, 29, foot - 1, [[MOON.foam, 1], [MOON.sea, 2]], 1 - a / 18);
        for (let q = 0; q < 26; q++) px(E.x + (hash(r.seed + q) - 0.5) * 36, foot - 2 - a * (0.5 + hash(r.seed + q * 3)) + 0.07 * a * a, q % 3 ? MOON.foam : '#ffffff', 1 - a / 18);
      }
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 1) }; },
  },

  // Cast Round (Sokketu): two outlines trade places along an arc while cogs turn at both ends, the swap of bodies.
  socket_fullrotation: {
    back(r) {
      const t = r.t, hit = hitOf(r), U = r.from, E = aim(r), L = hold(t, 0, r.end, 4), u = ease(prog(t, hit - 4, hit + 12));
      for (const P of [U, E]) for (let q = 0; q < 8; q++) { const a = (q / 8 + t / 40) * Math.PI * 2; px(P.x + Math.cos(a) * 7, P.y + 1 + Math.sin(a) * 4, q % 2 ? '#c87a3a' : '#f0d8a8', L); }
      if (u <= 0 || u >= 1) return;
      const mid = { x: (U.x + E.x) / 2, y: (U.y + E.y) / 2 }, rx = (E.x - U.x) / 2, ry = (E.y - U.y) / 2;
      for (const [s, c] of [[0, '#f0d8a8'], [1, '#c87a3a']] as [number, string][]) {
        const a = Math.PI * (s + u), x = mid.x - Math.cos(a) * rx + Math.sin(a) * ry * 0.6, y = mid.y - Math.cos(a) * ry - Math.sin(a) * rx * 0.3;
        for (let i = -4; i <= 4; i++) { px(x + i, y - 4, c, 1); px(x + i, y + 4, c, 1); px(x - 4, y + i, c, 1); px(x + 4, y + i, c, 1); }
      }
    },
  },

  // Still Minute (Tynagi): a clock face rises round it and its hands run backward before the minute is lived again.
  slackwater_minute: {
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), spin = -t / 10;
      arc(U.x, U.y, 13, 9, '#e8d8b0', L);
      for (let q = 0; q < 12; q++) { const a = q / 12 * Math.PI * 2; px(U.x + Math.cos(a) * 11, U.y + Math.sin(a) * 7.5, q % 3 ? '#a08868' : '#f8f0e0', L); }
      line(U.x, U.y, U.x + Math.cos(spin) * 9, U.y + Math.sin(spin) * 6, '#f8f0e0', L);
      line(U.x, U.y, U.x + Math.cos(spin / 12) * 6, U.y + Math.sin(spin / 12) * 4, '#c8a878', L);
    },
  },

  // Slam (Hatchet): a hatch drops shut over the foe's side and a bolt shoots across it.
  hatch_bangshut: {
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, hit - 6, r.end, 3), fall = ease(prog(t, hit - 6, hit));
      if (L <= 0) return;
      const y = E.y - 16 + 12 * fall;
      bands(E.x - 9, 19, Math.round(y), [['#8a5a3a', 2], ['#6a4430', 1], ['#8a5a3a', 2], ['#6a4430', 1], ['#8a5a3a', 2]], L);
      const a = t - hit;
      if (a >= 2) { const n = Math.min(14, (a - 2) * 3); dither(E.x - 7, Math.round(y) + 3, n, 2, '#c8c0b0', L); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 1) }; },
  },

  // Bad Months (Kellari): frost runs out over its whole side of the field, and snow falls on its bench in cold storage.
  cellar_overwinter: {
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), reach = 6 + 30 * ease(prog(t, 0, hitOf(r)));
      for (let q = 0; q < 40; q++) {
        const ang = hash(r.seed + q) * Math.PI * 2, d = hash(r.seed + q * 7) * reach;
        const x = U.x + Math.cos(ang) * d, y = U.y + 5 + Math.sin(ang) * d * 0.3;
        px(x, y, q % 4 ? '#c8e8f8' : '#ffffff', L);
        if (q % 5 === 0) { px(x + 1, y, '#a8d8f0', L); px(x, y - 1, '#a8d8f0', L); }
      }
      for (let q = 0; q < 10; q++) { const x = U.x - 20 + hash(r.seed + q * 13) * 40, y = (t * 0.6 + q * 7) % 30 + U.y - 24; px(x, y, '#f0f8ff', L); }
    },
  },

  // Whole Mirage (Fatamor): heat haze shimmers up round it, and two copies flicker out to either side.
  fata_massmirage: {
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 5; q++) { const y = U.y - 10 + q * 4 - ((t >> 1) % 4); for (let x = -12; x <= 12; x++) if ((x + q + (t >> 2)) % 6 < 2) px(U.x + x, y + Math.round(Math.sin((x + t) / 3)), '#f8e0a0', 0.75 * L); }
      for (const s of [-1, 1]) {
        const x = U.x + s * (6 + 4 * prog(t, 0, hitOf(r))), on = (((t >> 1) + (s > 0 ? 1 : 0)) & 1) ? L : 0.5 * L;
        for (let i = -4; i <= 4; i++) { px(x + i, U.y - 4, '#f0d070', on); px(x + i, U.y + 4, '#f0d070', on); px(x - 4, U.y + i, '#f0d070', on); px(x + 4, U.y + i, '#f0d070', on); }
      }
    },
  },
};

/** A thin sagging string from a to b in one color. */
function cord2(a: Pt, b: Pt, sag: number, c: string, lv: number): void {
  const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= n; i += 1) { const p = sagAt(a, b, i / n, sag); px(p.x, p.y, c, lv); }
}

/** A test hook for the review sheet: the plan a move's picture runs on, with an option's spec when the move has options. */
if (typeof window !== 'undefined') (window as any).__legendfx = {
  plan(id: string, opt = -1): FxPlan | null { const m = MOVES[id]; return m ? fxPlanOf(opt >= 0 && m.fxOpts ? { ...m, fx: m.fxOpts[opt] } : m) : null; },
  ids: (): string[] => Object.keys(LEGEND_ART),
};

/** Timing and drawing helpers the per-kind pictures in src/game/moveart/ share. */
export { clamp, prog, hold, hitOf, leaveOf, aim, selfish, shake, userAt, high, beside, oval, arc, blit, wash, bands, thick, sagAt, glint, waterDome, type Pt };
