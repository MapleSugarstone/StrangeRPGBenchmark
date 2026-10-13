// Part A of the move-art pass: each move's own picture for the kinds in Notes/move-art/parts.ts, keyed by move id.
// Every kind keeps one motif drawn from its own body across its moves, in its own sprite colors with ink and white.
// Solid colors and the ordered dither only. Nothing here runs at module load, and nothing reads the battle.
import { aim, arc, beside, blit, dither, ease, hash, high, hitOf, hold, leaveOf, line, oval, prog, px, sagAt, shake, thick, userAt, waterDome, wash, bands, glint, type FxRun, type LegendArt, type Pt, type SceneLight } from './kit';

const W = '#ffffff', K = '#141018';

// ---------------------------------------------------------------- shared timing

type Flight = FxRun['flights'][number];
/** A thing in flight this frame: where it is, the way it heads, how far along its trip it is, its age, and its target. */
interface Fly { x: number; y: number; ux: number; uy: number; u: number; a: number; f: Flight; E: Pt }

/** A point along the spec's own path at u, the same as the grammar's, so a drawn flight lands where and when the spec does. */
function pathAt(r: FxRun, f: Flight, u: number): { x: number; y: number; show: boolean } {
  const S = r.from, E = r.to[f.to] || r.to[0], seed = r.seed;
  const dx = E.x - S.x, dy = E.y - S.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const jit = (k: number): number => hash(seed * 31 + f.i * 7 + f.to * 13 + k) - 0.5;
  let x = S.x + dx * u, y = S.y + dy * u, show = true;
  switch (r.plan.path || 'line') {
    case 'arc': { const v = (u - 0.8) / 0.2; y -= (4 + d / 9) * (u <= 0.8 ? (u / 0.8) ** 4 : 1 + v - 2 * v * v); break; }
    case 'wave': { const o = Math.sin(u * Math.PI * 4 + f.i) * 4; x += nx * o; y += ny * o; break; }
    case 'zigzag': { const z = (u * 6 + f.i * 0.5) % 2, o = (z < 1 ? z : 2 - z) * 8 - 4; x += nx * o; y += ny * o; break; }
    case 'spiral': { const rr = 5 * (1 - u), o = Math.sin(u * Math.PI * 6 + f.i * 2) * rr; x += nx * o; y += ny * o + Math.cos(u * Math.PI * 6 + f.i * 2) * rr * 0.4; break; }
    case 'rain': { const sx = E.x + jit(1) * 14, sy = E.y - (E.y > 30 ? 18 : 34); x = sx + (E.x - sx) * u; y = sy + (E.y - sy) * u; break; }
    case 'rise': { const sx = E.x + jit(2) * 8; x = sx + (E.x - sx) * u; y = E.y + 6 - 8 * u; show = u > 0.15; break; }
    case 'converge': { const a = (f.i / Math.max(1, f.n)) * Math.PI * 2 + seed, sx = E.x + Math.cos(a) * 18, sy = E.y + Math.sin(a) * 11; x = sx + (E.x - sx) * ease(u); y = sy + (E.y - sy) * ease(u); break; }
    case 'orbit': {
      const a0 = f.i * Math.PI * 2 / Math.max(1, f.n);
      if (u < 0.6) { const a = u / 0.6 * Math.PI * 4 + a0; x = S.x + Math.cos(a) * 9; y = S.y + Math.sin(a) * 5; }
      else { const ox = S.x + Math.cos(a0) * 9, oy = S.y + Math.sin(a0) * 5, v = (u - 0.6) / 0.4; x = ox + (E.x - ox) * v; y = oy + (E.y - oy) * v; }
      break;
    }
    case 'sweep': { const dir = E.x >= S.x ? 1 : -1; x = E.x + dir * (44 * u - 20); y = E.y - 1 + Math.sin(Math.PI * u) * 2; break; }
    case 'return': { const v = u < 0.5 ? ease(u * 2) : 1 - ease((u - 0.5) * 2); x = S.x + dx * v; y = S.y + dy * v - Math.sin(Math.PI * u * 2) * 3; break; }
  }
  return { x, y, show };
}

/** Where flight f is this frame, or null when it is not in the air. */
function flyAt(r: FxRun, f: Flight): Fly | null {
  const a = r.t - f.t0;
  if (a < 0 || a >= f.dur) return null;
  const u = a / f.dur, p = pathAt(r, f, u), E = r.to[f.to] || r.to[0];
  if (!p.show) return null;
  const b = pathAt(r, f, Math.max(0, u - 0.05));
  let vx = p.x - b.x, vy = p.y - b.y, n = Math.hypot(vx, vy);
  if (n < 0.01) { vx = E.x - r.from.x; vy = E.y - r.from.y; n = Math.hypot(vx, vy) || 1; }
  return { x: p.x, y: p.y, ux: vx / n, uy: vy / n, u, a, f, E };
}

/** Calls fn for everything in the air this frame. */
function flights(r: FxRun, fn: (p: Fly) => void): void { for (const f of r.flights) { const p = flyAt(r, f); if (p) fn(p); } }

/** Calls fn at each landing younger than len frames with its target, its age, and its index. The first and last landings hold still `stop` frames. */
function landings(r: FxRun, len: number, fn: (E: Pt, a: number, i: number) => void, stop = 0): void {
  r.hits.forEach((h, i) => {
    const s = i === 0 || i === r.hits.length - 1 ? stop : 0, raw = r.t - h.at;
    if (raw < 0 || raw >= len + s) return;
    capLeft = r.end - h.at - s - 1;
    fn(r.to[h.to] || r.to[0], Math.max(0, raw - s), i);
    capLeft = Infinity;
  });
}

/** Frames left before the run ends for the landing being drawn, so a lingering mark thins out before the picture stops. */
let capLeft = Infinity;

/** A whole-pixel shake of `size` for `len` frames after any landing. */
function jolts(r: FxRun, size = 1, len = 6): number {
  for (const h of r.hits) { const a = r.t - h.at; if (a >= 0 && a < len) return shake(a, len, size); }
  return 0;
}

/** Which way the user faces: 1 when its foe is to the right. */
const face = (r: FxRun): number => (high(r.from) ? -1 : 1);
/** Fast at first, then slow. */
const out = (u: number): number => 1 - (1 - u) * (1 - u);
/** The level of a thing that lasts len frames from a, with its last `f` frames thinning on the dither. */
const fade = (a: number, len: number, f = 4): number => { const n = Math.min(len, capLeft); return a < 0 || a >= n ? 0 : Math.min(1, (n - a) / f); };

/** The user's middle where its motion had it at frame t. */
function userAtFrame(r: FxRun, t: number): Pt { const keep = r.t; r.t = t; const p = userAt(r); r.t = keep; return p; }

/** A light at a point for the scene, in a color, kept softer than the grammar's own so it never hides the picture. */
const lit = (p: Pt, c: string, lv: number, rr = 10): SceneLight => ({ x: Math.round(p.x), y: Math.round(p.y), r: rr, lv: 0.7 * lv, tint: c });

// ---------------------------------------------------------------- shared drawing

/** n chunks thrown up and out from x, y that fall faster each frame, in cols by turns. Size 2 makes them 2 wide. */
function chunks(x: number, y: number, a: number, n: number, seed: number, cols: string[], v = 1, life = 16, size = 1): void {
  if (a < 0 || a >= life) return;
  const lv = fade(a, life, 5);
  for (let q = 0; q < n; q++) {
    const ang = Math.PI * (1.1 + 0.8 * (n > 1 ? q / (n - 1) : 0.5)) + (hash(seed + q) - 0.5) * 0.5, sp = v * (0.8 + hash(seed + q * 5) * 0.8);
    const cx = Math.round(x + Math.cos(ang) * sp * a), cy = Math.round(y + Math.sin(ang) * sp * a + 0.09 * a * a);
    dither(cx, cy, size, q % 2 ? 1 : size, cols[q % cols.length], lv);
  }
}

/** n sparks thrown out from x, y all round, white at first and then c, slowing as they go. */
function sparks(x: number, y: number, a: number, n: number, seed: number, c: string, life = 8, reach = 9): void {
  if (a < 0 || a >= life) return;
  const u = a / life, d = 2 + reach * out(u);
  for (let q = 0; q < n; q++) {
    const ang = (q / n + hash(seed + q) * 0.12) * Math.PI * 2;
    px(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.8, u < 0.35 ? W : c, 1 - u * 0.5);
  }
}

/** A ring that spreads from x, y fast and then slow, thinning as it goes. `flat` squashes it onto the ground. */
function ringOut(x: number, y: number, a: number, len: number, c: string, rmax = 10, flat = 0.7, c2?: string): void {
  if (a < 0 || a >= len) return;
  const u = a / len, rr = 2 + (rmax - 2) * out(u);
  arc(x, y, rr, rr * flat, c, 1 - u * 0.75);
  if (c2 && rr > 3) arc(x, y, rr - 1.5, (rr - 1.5) * flat, c2, 0.5 * (1 - u));
}

/** Dust puffs at the ground that swell and thin away. */
function dust(x: number, foot: number, a: number, len: number, c1: string, c2: string, n = 3, spread = 4): void {
  if (a < 0 || a >= len) return;
  const u = a / len, lv = 0.75 * (1 - u);
  for (let q = 0; q < n; q++) {
    const rr = 1.5 + 2.5 * out(u), cx = x + (q - (n - 1) / 2) * spread * (0.6 + out(u) * 0.6), cy = foot - 1 - u * 3 - (q % 2);
    oval(cx, cy, rr, rr * 0.7, c1, lv);
    if (rr > 2) oval(cx, cy - 1, rr - 1.2, (rr - 1.2) * 0.6, c2, lv);
  }
}

/** A tapered tail behind a point heading ux, uy: one pixel of each color going back, the last on the dither. */
function tail(x: number, y: number, ux: number, uy: number, cols: string[], gap = 1): void {
  cols.forEach((c, i) => px(x - ux * (i + 1) * gap, y - uy * (i + 1) * gap, c, i < cols.length - 1 ? 1 : 0.5));
}

/** A crack opening along the ground at x, foot: a seam that runs out `reach` both ways, white near the middle, with a dark lip. */
function crackAt(x: number, foot: number, a: number, len: number, seam: string, lip: string, reach: number, seed: number): void {
  if (a < 0 || a >= len) return;
  const n = Math.round(reach * Math.min(1, (a + 1) / 4)), lv = fade(a, len, 6);
  for (let i = 0; i <= n; i++) for (const s of [-1, 1]) {
    const xx = Math.round(x + s * i), j = hash(seed + xx * 3) < 0.4 ? 1 : 0;
    px(xx, foot + j, i < 2 && a < 6 ? W : seam, lv);
    px(xx, foot + j + 1, lip, lv);
  }
}

/** Drops thrown up in a crown from x, foot: a ring of n that rise and fall. */
function crown(x: number, foot: number, a: number, len: number, c1: string, c2: string, n = 6, h = 1): void {
  if (a < 0 || a >= len) return;
  const lv = fade(a, len, 5);
  for (let q = 0; q < n; q++) {
    const vx = (q - (n - 1) / 2) * 0.55, vy = -(1.3 + (q % 3) * 0.35) * h;
    px(x + vx * a, foot - 1 + vy * a + 0.12 * a * a, q % 2 ? c1 : c2, lv);
  }
  if (a < 6) for (let i = -3; i <= 3; i++) px(x + i, foot - Math.round((3 - Math.abs(i)) * Math.min(1, a / 3)), Math.abs(i) < 2 ? c1 : c2, 1 - a / 6);
}

/** n motes rising from around x, y, each a little after the last, for heals and blessings. */
function motes(x: number, y: number, a: number, len: number, n: number, seed: number, cols: string[], w = 7, h = 10): void {
  for (let q = 0; q < n; q++) {
    const aa = a - q * 2;
    if (aa < 0 || aa >= len) continue;
    const u = aa / len;
    px(x + (hash(seed + q * 3) - 0.5) * w * 2 + Math.sin((aa + q * 4) / 3), y - u * h, cols[q % cols.length], 1 - u * 0.6);
  }
}

/** A smear of two colors behind the user where its motion had it in the last frames. */
function smear(r: FxRun, c1: string, c2: string, rx = 3, ry = 2.5): void {
  const now = userAt(r);
  for (let k = 3; k >= 1; k--) {
    const p = userAtFrame(r, r.t - k);
    if (Math.hypot(now.x - p.x, now.y - p.y) < 2) continue;
    oval(p.x, p.y, rx, ry, k === 1 ? c1 : c2, 0.75 - k * 0.15);
  }
}

/** A hill of earth from a foot line: columns of c with a lit top edge, h high in the middle and w wide each way. */
function mound(x: number, foot: number, w: number, h: number, c: string, top: string, lv = 1): void {
  if (h <= 0 || w <= 0) return;
  for (let i = -w; i <= w; i++) {
    const hh = Math.round(h * (1 - Math.abs(i) / (w + 1)));
    if (hh <= 0) continue;
    dither(Math.round(x + i), Math.round(foot - hh), 1, hh, c, lv);
    px(x + i, foot - hh, top, lv);
  }
}

/** Short streaks running away from a point along dx, for a push. */
function streaks(x: number, y: number, a: number, len: number, dx: number, c: string, n = 3): void {
  if (a < 0 || a >= len) return;
  const lv = fade(a, len, 4);
  for (let q = 0; q < n; q++) { const x0 = x + dx * (3 + a * 1.2 + (q % 2) * 2), y0 = y - 2 + q * 2; line(x0, y0, x0 + dx * 4, y0, c, lv); }
}

// ---------------------------------------------------------------- Kivishi: the stones of its pile

const CAIRN = { top: '#ddbe9e', gray: '#9d9da5', dark: '#5e5c64', lite: '#f0e8dc', cowrie: '#f4ecd8' };
const CAIRN_BITS = [CAIRN.top, CAIRN.gray, CAIRN.dark];
/** Kivishi's motif: one flat wayside stone, w half-wide, its top edge lit and its underside dark. Tipped, it stands on edge. */
function cairnStone(x: number, y: number, w: number, c: string, lv = 1, tip = false): void {
  const h = Math.max(1, Math.round(w * 0.5)), rx = tip ? h : w, ry = tip ? w : h;
  oval(x, y + 1, rx, ry, CAIRN.dark, lv);
  oval(x, y, rx, ry, c, lv);
  line(x - rx + 1, y - ry, x + rx - 1, y - ry, CAIRN.lite, lv);
}
/** A pile of n stones from a foot line, smaller as it climbs, the top one sand-colored. */
function cairnPile(x: number, foot: number, n: number, lv = 1): void {
  for (let i = 0; i < n; i++) cairnStone(x + (i % 2 ? 1 : 0), foot - 1 - i * 3, Math.max(1.5, 4 - i * 0.6), i === n - 1 ? CAIRN.top : CAIRN.gray, lv);
}

// ---------------------------------------------------------------- Jarira: loose shingle

const SCREE = { pale: '#d2c2aa', mid: '#999189', dark: '#60564e', lite: '#ece2d0' };
const SCREE_PAL = { p: SCREE.pale, m: SCREE.mid, d: SCREE.dark, l: SCREE.lite };
const SCREE_BITS = [SCREE.pale, SCREE.mid, SCREE.dark];
/** Jarira's motif: a flat flake of shingle, tipping over every two frames as it slides or flies. */
function flake(x: number, y: number, a: number, lv = 1, big = false): void {
  const tip = (a >> 1) & 1;
  if (big) blit(tip ? ['.lp.', 'pmmd', '.dd.'] : ['lpp.', 'mmmd', '..dd'], x, y, SCREE_PAL, lv);
  else blit(tip ? ['lp', 'md'] : ['lpm', '.dd'], x, y, SCREE_PAL, lv);
}
/** A slide of flakes streaming along the ground from x along dir, each a little behind the last. */
function slide(x: number, foot: number, a: number, len: number, dir: number, n: number, seed: number): void {
  for (let q = 0; q < n; q++) {
    const aa = a - q * 2;
    if (aa < 0 || aa >= len) continue;
    flake(x + dir * (aa * 1.1 + hash(seed + q) * 4), foot - 1 - (q % 3) + Math.min(0, -Math.sin(aa / 2)), aa, fade(aa, len, 4));
  }
}

// ---------------------------------------------------------------- Daista: the empty plinth

const PLINTH = { pale: '#d8d0c0', pink: '#da94a4', dark: '#7a7468', lite: '#f4eee4', pool: '#7ab8e0', foam: '#d8f0f8' };
/** Daista's motif: a pedestal rising h rows from a foot line, with a pink band round its shaft and its top kept clear. */
function pedestal(x: number, foot: number, w: number, h: number, lv = 1): void {
  if (h <= 0) return;
  dither(x - w - 1, foot - 2, 2 * w + 3, 2, PLINTH.dark, lv);
  dither(x - w, foot - 2 - h, 2 * w + 1, h, PLINTH.pale, lv);
  dither(x - w, foot - 2 - h, 1, h, PLINTH.lite, lv);
  if (h >= 3) dither(x - w, foot - 2 - Math.ceil(h / 2), 2 * w + 1, 1, PLINTH.pink, lv);
  dither(x - w - 1, foot - 3 - h, 2 * w + 3, 1, PLINTH.lite, lv);
}
const BARNACLE = ['.l.', 'lpl', 'dld'];
const BARN_PAL = { l: PLINTH.lite, p: PLINTH.pink, d: PLINTH.dark };

// ---------------------------------------------------------------- Luotsu: the sea cave

const GROTTO = { gray: '#797986', blue: '#6eb6d5', dark: '#474d5c', foam: '#c8ecf8', pale: '#b0b0c0', deep: '#1c1c28' };
/** Luotsu's motif: a cave mouth standing on a foot line, its rim pale and wet, drips falling from its roof. */
function cave(x: number, foot: number, w: number, h: number, t: number, lv = 1, from = 0.5, to = 1): void {
  if (w < 1 || h < 1) return;
  arc(x, foot, w + 1, h + 1, GROTTO.gray, lv, from, to);
  arc(x, foot, w, h, GROTTO.pale, lv, from, to);
  arc(x, foot, w - 1, h - 1, GROTTO.blue, lv * 0.5, from, to);
  for (let q = 0; q < 3; q++) {
    const dx = (q - 1) * w * 0.45, k = (t + q * 4) % 9, y0 = foot - h * Math.sqrt(Math.max(0, 1 - (dx * dx) / (w * w))) + 1;
    if (k < 6) px(x + dx, y0 + k, k < 2 ? GROTTO.foam : GROTTO.blue, lv);
  }
}
/** A stalactite pointing down from x, y: gray with a pale left edge and a wet blue tip. */
function stalactite(x: number, y: number, lv = 1, big = false): void {
  blit(big ? ['pggd', 'pggd', '.pg.', '.pg.', '.gd.', '..b.', '..f.'] : ['pgd', 'pgd', '.g.', '.b.', '.f.'], x, y, { p: GROTTO.pale, g: GROTTO.gray, d: GROTTO.dark, b: GROTTO.blue, f: GROTTO.foam }, lv);
}

// ---------------------------------------------------------------- Menhir: the standing stone and its star marks

const MENHIR = { gray: '#8d8b93', blue: '#78c8f7', dark: '#585665', pale: '#c8c6ce', lite: '#d8f0ff' };
/** The Menhir's motif: a cup-and-ring mark carved in blue, 5 across, its middle lit. */
function cupMark(x: number, y: number, lv = 1, lit2 = false): void {
  blit(['.bbb.', 'b...b', 'b.w.b', 'b...b', '.bbb.'], x, y, { b: lit2 ? MENHIR.lite : MENHIR.blue, w: W }, lv);
}
/** A standing stone h tall from a foot line, lit on its left, with a blue mark when `mark`. */
function slab(x: number, foot: number, h: number, lv = 1, mark = false): void {
  if (h <= 0) return;
  dither(x - 2, foot - h + 1, 5, h, MENHIR.gray, lv);
  dither(x - 2, foot - h + 1, 1, h, MENHIR.pale, lv);
  dither(x + 2, foot - h + 1, 1, h, MENHIR.dark, lv);
  dither(x - 1, foot - h, 3, 1, MENHIR.pale, lv);
  if (mark && h >= 5) { px(x, foot - h + 3, MENHIR.blue, lv); px(x - 1, foot - h + 4, MENHIR.blue, lv); px(x + 1, foot - h + 4, MENHIR.blue, lv); px(x, foot - h + 5, MENHIR.blue, lv); }
}

// ---------------------------------------------------------------- Louriba: bored stone

const QUARRY = { navy: '#354573', teal: '#78e8d8', mid: '#586696', pale: '#c8f8f0', deep: '#1a2238' };
const QUARRY_BITS = [QUARRY.mid, QUARRY.teal, QUARRY.navy];
/** Louriba's motif: a piddock's bore hole, a dark round hole with a teal rim. */
function boreHole(x: number, y: number, rr: number, lv = 1): void {
  oval(x, y, rr, rr * 0.8, QUARRY.deep, lv);
  arc(x, y, rr + 0.5, rr * 0.8 + 0.5, QUARRY.teal, lv, 0.5, 1);
  arc(x, y, rr + 0.5, rr * 0.8 + 0.5, QUARRY.mid, lv, 0, 0.5);
}
/** Chips of stone pulled out of a foe and flying back to its user, the stone it takes. */
function takeStone(E: Pt, U: Pt, a: number, len: number, n: number, seed: number): void {
  for (let q = 0; q < n; q++) {
    const u = prog(a - q * 2, 0, len);
    if (u <= 0 || u >= 1) continue;
    const p = sagAt(E, U, ease(u), -6 - (q % 3) * 3);
    dither(Math.round(p.x), Math.round(p.y), 2, 1, q % 2 ? QUARRY.teal : QUARRY.mid, 1);
  }
}

// ---------------------------------------------------------------- Irvino: the gutter face

const GARG = { purple: '#5c3c7a', lime: '#b1e743', lav: '#9374c2', pale: '#e0d4f4', water: '#7ab8e8', foam: '#d8f0f8' };
const GARG_PAL = { l: GARG.lime, p: GARG.lav, d: GARG.purple, w: GARG.pale, k: K, y: GARG.lime };
/** Irvino's motif: its gutter face, horns up, lime eyes, a wide mouth of stone teeth that opens to spout. */
function gargFace(x: number, y: number, lv = 1, scale = 1, open = false, mirror = false): void {
  blit(['l.....l', 'lpppppl', 'pyppypp', 'ppdpdpp', open ? 'pkkkkkp' : 'pwkwkwp', open ? '.wkkkw.' : '.ppppp.'], x, y, GARG_PAL, lv, scale, mirror);
}
const GARG_HEAD = ['l...l', 'ppppp', 'pyppy', 'pwkwp', '.ddd.'];

// ---------------------------------------------------------------- Kumpuka: the ground that shrugs

const TOR = { soil: '#746e62', ember: '#f4a532', gray: '#999189', pale: '#c8c0b0', hot: '#ffe0a0', dark: '#4a4440' };
const TOR_BITS = [TOR.gray, TOR.soil, TOR.pale];
/** Kumpuka's motif: a ring of ground that spreads from its feet, its edge heaved up in soil with a hot seam inside. */
function groundRing(x: number, foot: number, rr: number, lv = 1): void {
  if (rr < 1) return;
  arc(x, foot, rr, rr * 0.3, TOR.ember, lv);
  arc(x, foot - 1, rr + 1, rr * 0.3 + 0.5, TOR.soil, lv, 0.5, 1);
  arc(x, foot - 1, rr + 1, rr * 0.3 + 0.5, TOR.pale, lv * 0.5, 0.6, 0.9);
}
/** A round boulder of the hill rolling: soil with a band of its orange seam turning round it. */
function boulder(x: number, y: number, rr: number, a: number, lv = 1): void {
  oval(x, y, rr, rr, TOR.soil, lv);
  arc(x, y, rr, rr, TOR.pale, lv, 0.55, 0.85);
  const s = (a * 0.35) % (Math.PI * 2);
  line(x + Math.cos(s) * rr, y + Math.sin(s) * rr, x - Math.cos(s) * rr, y - Math.sin(s) * rr, TOR.ember, lv);
}
/** A zigzag crack running along the ground from a to b, drawn up to u of the way. */
function crazeLine(a: Pt, b: Pt, u: number, seed: number, lv = 1): void {
  const n = Math.max(4, Math.round(Math.abs(b.x - a.x) / 3));
  let p0 = a;
  for (let q = 1; q <= n * u; q++) {
    const v = q / n, p1 = { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v + (q < n ? (hash(seed + q) - 0.5) * 3 : 0) };
    line(p0.x, p0.y, p1.x, p1.y, TOR.ember, lv);
    line(p0.x, p0.y + 1, p1.x, p1.y + 1, TOR.dark, lv);
    p0 = p1;
  }
}

// ---------------------------------------------------------------- shared small pieces

/** A drop of water or brine: a light top, a body, and a dark heel. */
function bead(x: number, y: number, c1: string, c2: string, lv = 1, c3?: string): void { blit(['.l.', 'lbb', '.d.'], x, y, { l: c1, b: c2, d: c3 || c2 }, lv); }
/** Three points circling over a head for a stun or a daze, the first white. */
function daze(E: Pt, a: number, len: number, c: string, c2 = c): void {
  if (a < 0 || a >= len) return;
  for (let q = 0; q < 3; q++) { const ang = a * 0.3 + q * 2.09; px(E.x + Math.cos(ang) * 5, E.y - 7 + Math.sin(ang) * 1.5, q === 0 ? W : q === 1 ? c : c2, fade(a, len, 6)); }
}

/** n flecks running from a foe back home to its user along a high arc, for what a move takes or brings back. */
function takeBack(E: Pt, U: Pt, a: number, len: number, n: number, c: string, c2 = c): void {
  for (let q = 0; q < n; q++) {
    const u = prog(a - q * 2, 0, len);
    if (u <= 0 || u >= 1) continue;
    const p = sagAt(E, U, ease(u), -7 - (q % 3) * 3);
    px(p.x, p.y, q % 2 ? c2 : c); px(p.x - 1, p.y, q % 2 ? c : c2, 0.5);
  }
}
/** A puff of smoke or steam: a solid core in a dithered edge, w across. */
function fogPuffOf(x: number, y: number, w: number, core: string, edge: string, lv = 1): void {
  if (w < 1 || lv <= 0) return;
  oval(x, y, w, w * 0.6, edge, 0.5 * lv);
  oval(x, y, Math.max(0.5, w - 1.2), Math.max(0.5, w * 0.6 - 1), core, 0.75 * lv);
}

// ---------------------------------------------------------------- Kaivodo: the bucket and the rope

const WELL = { stone: '#a8a0b8', gold: '#fce57d', plum: '#5a4995', water: '#6ab0e8', foam: '#d8f0ff', rope: '#c8a870', lite: '#e0dcea' };
const WELL_PAL = { g: WELL.gold, p: WELL.plum, s: WELL.stone, w: WELL.water, f: WELL.foam };
/** Kaivodo's motif: its bucket, gold-rimmed with plum staves, full unless `empty`, tipped to pour toward dir when `tip`. */
function bucket(x: number, y: number, lv = 1, tip = false, empty = false, dir = 1): void {
  if (tip) blit(['.gp..', 'gwsp.', 'gwwsp', '.gpp.'], x, y, WELL_PAL, lv, 1, dir < 0);
  else { blit(['ggggg', empty ? 'p...p' : 'pwfwp', 'spsps', '.ppp.'], x, y, WELL_PAL, lv); arc(x, y - 2, 2, 2, WELL.rope, lv, 0.5, 1); }
}
/** Its well cover: a round stone lid, flat or seen on its edge. */
function lid(x: number, y: number, lv = 1, edge = false): void {
  if (edge) blit(['g', 's', 's', 'p'], x, y, WELL_PAL, lv);
  else { oval(x, y, 4, 1.5, WELL.stone, lv); arc(x, y, 4, 1.5, WELL.gold, lv, 0.5, 1); px(x, y, WELL.plum, lv); }
}

// ---------------------------------------------------------------- Vetoki: the coil of cold current

const RIP = { cyan: '#a8e4f4', white: '#f4fcff', blue: '#2c58c8', deep: '#1a3478', sand: '#d8c8a0', grit: '#a89870' };
/** Vetoki's motif: a coil of clear cold current winding in to x, y, turning with phase, squashed by `flat`. */
function coil(x: number, y: number, rr: number, phase: number, lv = 1, flat = 0.5): void {
  for (let q = 0; q < 20; q++) {
    const u = q / 20, a = phase + u * Math.PI * 4, d = rr * (1 - u * 0.85);
    px(x + Math.cos(a) * d, y + Math.sin(a) * d * flat, q % 3 === 0 ? RIP.white : q % 3 === 1 ? RIP.cyan : RIP.blue, lv);
  }
}

// ---------------------------------------------------------------- Utumi: banks of sea fog

const FOG = { white: '#dde6ee', blue: '#69cafe', dark: '#38344b', gray: '#8a94a4' };
/** Utumi's motif: a bank of sea fog, a pale solid middle in a gray dithered edge. */
function fogPuff(x: number, y: number, w: number, lv = 1): void {
  if (w < 1 || lv <= 0) return;
  oval(x, y, w, w * 0.5, FOG.gray, 0.5 * lv);
  oval(x, y, w - 1.5, Math.max(0.5, w * 0.5 - 1), FOG.white, 0.75 * lv);
  if (w > 3) line(x - w + 3, y - Math.round(w * 0.5) + 1, x + w - 3, y - Math.round(w * 0.5) + 1, FOG.white, lv);
}
/** Two blue eyes looking out of the fog. */
function fogEyes(x: number, y: number, lv = 1): void { px(x - 2, y, FOG.blue, lv); px(x + 2, y, FOG.blue, lv); }

// ---------------------------------------------------------------- Hyolau: plates of sea ice

const FLOE = { white: '#e4f0fb', light: '#96cee5', blue: '#4378ae', ink: '#24406a' };
/** Hyolau's motif: a flat plate of sea ice, w half-wide, white on top and blue at its edge, tipped by `tilt`. */
function icePlate(x: number, y: number, w: number, lv = 1, tilt = 0): void {
  for (let i = -w; i <= w; i++) {
    const yy = y + Math.round(i * tilt);
    px(x + i, yy, FLOE.white, lv);
    px(x + i, yy + 1, i < -w / 2 ? FLOE.white : FLOE.light, lv);
    px(x + i, yy + 2, FLOE.blue, lv);
  }
}
/** A splinter of ice heading ux, uy: a white tip, then light, then blue. */
function splinter(x: number, y: number, ux: number, uy: number, n = 6, lv = 1): void {
  for (let i = 0; i < n; i++) px(x - ux * i, y - uy * i, i === 0 ? W : i < 2 ? FLOE.white : i < 4 ? FLOE.light : FLOE.blue, lv);
  px(x - ux * 2 - uy, y - uy * 2 + ux, FLOE.light, lv);
}
/** Ice crystals growing round a point, each a white middle that grows arms. */
function rime(E: Pt, a: number, len: number, seed: number, n = 6, reach = 7): void {
  for (let q = 0; q < n; q++) {
    const g = prog(a - q, 0, 4), t = hash(seed + q * 3) * Math.PI * 2, d = reach * (0.6 + hash(seed + q) * 0.5);
    if (g <= 0) continue;
    const x = E.x + Math.cos(t) * d, y = E.y + Math.sin(t) * d * 0.7, L = fade(a, len, 5);
    px(x, y, W, L);
    if (g >= 0.5) { px(x + 1, y, FLOE.light, L); px(x - 1, y, FLOE.light, L); px(x, y + 1, FLOE.light, L); px(x, y - 1, FLOE.light, L); }
  }
}

// ---------------------------------------------------------------- Squall: rain that comes in sideways

const SQUALL = { cloud: '#686d85', white: '#e4ecf4', rain: '#7ba3ca', dark: '#3a3e50' };
/** Squall's motif: rain driven sideways, streaks slanting along dir in a box w either side of x and h down from y, running with t. */
function sideRain(x: number, y: number, w: number, h: number, t: number, dir: number, lv = 1, n = 8): void {
  for (let q = 0; q < n; q++) {
    const k = (t * 1.6 + q * 4.7) % h, bx = x - w + ((q * 13) % (2 * w));
    line(bx + dir * k * 1.2, y + k, bx + dir * (k * 1.2 + 3), y + k + 2, q % 3 ? SQUALL.rain : SQUALL.white, lv);
  }
}
/** A low rain cloud, gray with a pale top. */
function cloud(x: number, y: number, w: number, lv = 1): void {
  oval(x, y, w, w * 0.3, SQUALL.cloud, lv);
  oval(x - w * 0.35, y - w * 0.2, w * 0.45, w * 0.3, SQUALL.cloud, lv);
  oval(x + w * 0.3, y - w * 0.15, w * 0.4, w * 0.25, SQUALL.cloud, lv);
  arc(x - w * 0.35, y - w * 0.2, w * 0.45, w * 0.3, SQUALL.white, lv, 0.55, 0.9);
  dither(x - w, y + Math.round(w * 0.3), 2 * w + 1, 1, SQUALL.dark, 0.5 * lv);
}

// ---------------------------------------------------------------- Vuoksho: the bore's one wave

const BORE = { blue: '#4f8cbc', mint: '#6dedbf', dark: '#2e4a68', foam: '#e0fff4' };
/** Vuoksho's motif: the bore's wave front standing h high on a foot line at x, facing dir, a steep front, a long back, and a mint crest. */
function boreWave(x: number, foot: number, h: number, dir: number, t: number, lv = 1, len = 12): void {
  if (h < 1) return;
  for (let i = 0; i <= len; i++) {
    const hh = Math.round(h * (i < 2 ? (i + 1) / 3 : 1 - (i - 2) / (len - 1)));
    if (hh <= 0) continue;
    const xx = Math.round(x - dir * i);
    dither(xx, foot - hh, 1, hh, i < 4 ? BORE.blue : BORE.dark, lv);
    px(xx, foot - hh, i < 3 ? BORE.foam : BORE.mint, lv);
  }
  px(x + dir, foot - h - 1 - (t & 1), BORE.foam, lv);
  px(x + dir * 2, foot - h + 1 + (t & 1), BORE.mint, lv);
}

// ---------------------------------------------------------------- Suomizu: salt pan and brine

const BRINE = { salt: '#f6f2e5', green: '#c8d725', brown: '#776d5e', dark: '#4a4438', olive: '#8a9618' };
/** Suomizu's motif: a patch of dry salt pan on the ground, white plates split by brown cracks. */
function saltPan(x: number, foot: number, w: number, lv = 1, seed = 0): void {
  if (w < 1) return;
  dither(Math.round(x - w), foot, Math.round(2 * w + 1), 2, BRINE.salt, lv);
  for (let i = -w; i <= w; i += 3) { const j = Math.round(hash(seed + i * 7) * 2) - 1; px(x + i + j, foot, BRINE.brown, lv); px(x + i, foot + 1, BRINE.brown, lv); }
}
/** A glob of green brine with a white glint of salt. */
function brineGlob(x: number, y: number, lv = 1): void { blit(['.gg.', 'gwgg', 'gggo', '.oo.'], x, y, { g: BRINE.green, w: W, o: BRINE.olive }, lv); }

// ---------------------------------------------------------------- Pyoruzu: the whirl

const EDDY = { blue: '#75b4d4', white: '#eef6fd', deep: '#2b5b88' };
/** Pyoruzu's motif: a two-armed whirl turning at x, y, rr across, squashed onto the ground by `flat`. */
function whirl(x: number, y: number, rr: number, phase: number, lv = 1, flat = 1): void {
  for (let arm = 0; arm < 2; arm++) for (let q = 1; q <= 10; q++) {
    const u = q / 10, a = phase + arm * Math.PI + u * Math.PI * 1.6, d = rr * u;
    px(x + Math.cos(a) * d, y + Math.sin(a) * d * flat, q > 7 ? EDDY.white : q > 3 ? EDDY.blue : EDDY.deep, lv);
  }
  px(x, y, EDDY.white, lv);
}

// ---------------------------------------------------------------- Yabuko: the buckthorn ball

const HEDGE = { leaf: '#798e67', berry: '#f18f34', dark: '#334329', pale: '#b8c8a0', twig: '#8a6a48' };
/** Yabuko's motif: a balled-up hedge of buckthorn, dark inside with gray-green leaves, thorns, and orange berries, turning with phase. */
function hedgeBall(x: number, y: number, rr: number, phase: number, lv = 1): void {
  oval(x, y, rr, rr * 0.85, HEDGE.dark, lv);
  for (let q = 0; q < 8; q++) {
    const a = phase + q / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    px(x + c * (rr - 1), y + s * (rr - 1) * 0.85, HEDGE.leaf, lv);
    if (q % 2) line(x + c * rr, y + s * rr * 0.85, x + c * (rr + 2), y + s * (rr + 2) * 0.85, HEDGE.twig, lv);
    else px(x + c * (rr * 0.5), y + s * rr * 0.4, HEDGE.berry, lv);
  }
}
/** A buckthorn twig heading ux, uy: a pale tip, a twig with thorns, and an orange berry at its heel. */
function twig(x: number, y: number, ux: number, uy: number, n = 6, lv = 1): void {
  for (let i = 0; i < n; i++) px(x - ux * i, y - uy * i, i === 0 ? HEDGE.pale : HEDGE.twig, lv);
  for (let i = 2; i < n; i += 2) px(x - ux * i - uy * (i % 4 ? 1 : -1), y - uy * i + ux * (i % 4 ? 1 : -1), HEDGE.leaf, lv);
  px(x - ux * n, y - uy * n, HEDGE.berry, lv);
}

// ---------------------------------------------------------------- Sienoko: white threads under the wood

const MYCEL = { white: '#efebdf', brown: '#54443a', tan: '#b9b199', rot: '#3a3028', gill: '#d8c8b0' };
/** Sienoko's motif: white threads running along the ground from a to b, branching as they go, drawn to u of the way. */
function threads(a: Pt, b: Pt, u: number, seed: number, lv = 1): void {
  const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 2)), m = Math.round(n * u);
  let p0 = a;
  for (let q = 1; q <= m; q++) {
    const v = q / n, p1 = { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v + Math.sin(q * 1.3 + seed) * 1.2 };
    line(p0.x, p0.y, p1.x, p1.y, MYCEL.white, lv);
    if (q % 3 === 0) { const s = hash(seed + q) < 0.5 ? -1 : 1; line(p1.x, p1.y, p1.x + 2, p1.y + s * 2, MYCEL.tan, lv); }
    p0 = p1;
  }
}
/** A mushroom pushing up h rows from a foot line: a pale stalk under a white cap with brown gills. */
function shroom(x: number, foot: number, h: number, lv = 1, w = 2): void {
  if (h <= 0) return;
  dither(x, foot - h, 1, h, MYCEL.white, lv);
  oval(x, foot - h - 1, w, 1, MYCEL.white, lv);
  dither(x - w + 1, foot - h, 2 * w - 1, 1, MYCEL.brown, lv);
}
/** A cloud of spores drifting: grains in the kind's pale and tan, spread over a box. */
function sporeCloud(x: number, y: number, a: number, seed: number, w: number, c1: string, c2: string, lv = 1, n = 8): void {
  for (let g = 0; g < n; g++) px(x + (hash(seed + g * 5) - 0.5) * w * 2 + Math.sin((a + g * 3) / 4), y + (hash(seed + g * 11) - 0.5) * w - (a % 8) * 0.2, g % 3 ? c1 : c2, lv);
}

// ---------------------------------------------------------------- Gobonen: the hooked burr

const BURR = { brown: '#8e6f37', orange: '#ec6f16', dark: '#473745', tan: '#c8a868', blood: '#c83a3a' };
/** Gobonen's motif: a burr, a round brown head with hooked spines tipped in orange, turning with phase. */
function burrBall(x: number, y: number, rr: number, phase: number, lv = 1): void {
  oval(x, y, rr, rr, BURR.brown, lv);
  if (rr >= 2) px(x - 1, y - 1, BURR.tan, lv);
  for (let q = 0; q < 8; q++) {
    const a = phase + q / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), tx = x + c * (rr + 2), ty = y + s * (rr + 2);
    line(x + c * rr, y + s * rr, tx, ty, BURR.dark, lv);
    px(tx - s, ty + c, BURR.orange, lv);
  }
}
/** A small burr stuck to something, its hooks catching. */
function burrStuck(x: number, y: number, lv = 1): void { blit(['o.o', '.b.', 'obo'], x, y, { o: BURR.orange, b: BURR.brown }, lv); }

// ---------------------------------------------------------------- Tarhaju: boughs, blossom, and fruit

const ORCH = { cream: '#ebdbcb', pink: '#e596b5', leaf: '#5b9849', bark: '#6a5040', pear: '#d8d060', ripe: '#e8b040' };
/** Tarhaju's motif: a pear, yellow-green with a ripe cheek, a stalk, and a leaf. */
function pear(x: number, y: number, lv = 1): void { blit(['.sl', '.p.', 'ppr', 'ppr', '.p.'], x, y, { s: ORCH.bark, l: ORCH.leaf, p: ORCH.pear, r: ORCH.ripe }, lv); }
/** A bough over a point: a bark branch with leaves and pink blossom along it. */
function bough(x: number, y: number, w: number, lv = 1, bloom = 0.5): void {
  line(x - w, y + 1, x + w, y - 1, ORCH.bark, lv);
  for (let i = -w; i <= w; i += 3) { px(x + i, y - Math.round(i / w) - 1, ORCH.leaf, lv); if (hash(i * 7 + 3) < bloom) { px(x + i + 1, y - Math.round(i / w), ORCH.pink, lv); px(x + i + 1, y - Math.round(i / w) - 1, ORCH.cream, lv); } }
}

// ---------------------------------------------------------------- Kankabu: year rings and shoots

const STUMP = { gray: '#c4ccd3', lime: '#e3ffaf', purple: '#7c4c91', wood: '#d8c0a0', dark: '#4a3058' };
/** Kankabu's motif: a stump's year rings seen from above, n rings round x, y, squashed onto the ground by `flat`. */
function yearRings(x: number, y: number, n: number, gap: number, lv = 1, flat = 0.4): void {
  for (let i = 1; i <= n; i++) arc(x, y, i * gap, i * gap * flat, i % 2 ? STUMP.purple : STUMP.wood, lv);
  px(x, y, STUMP.dark, lv);
}
/** A pale lime shoot coming up h rows from a foot line with a leaf at its tip. */
function shoot(x: number, foot: number, h: number, lv = 1): void {
  if (h <= 0) return;
  for (let i = 0; i < h; i++) px(x + (i % 4 === 3 ? 1 : 0), foot - i, STUMP.lime, lv);
  px(x - 1, foot - h, STUMP.lime, lv); px(x + 1, foot - h + 1, STUMP.lime, lv);
}

// ---------------------------------------------------------------- Tuhkori: the red cap and its spores

const PUFF = { white: '#efebdf', red: '#c8252c', green: '#1b5d10', spore: '#a89870', dust: '#6a5e48' };
/** Tuhkori's motif: a red cap with white spots, w half-wide, on a pale stalk when `stalk` rows show. */
function redCap(x: number, y: number, w: number, lv = 1, stalk = 0): void {
  if (stalk > 0) dither(x, y + 1, 1, stalk, PUFF.white, lv);
  oval(x, y, w, Math.max(1, w * 0.6), PUFF.red, lv);
  px(x - Math.round(w * 0.5), y - 1, PUFF.white, lv); px(x + Math.round(w * 0.4), y, PUFF.white, lv);
  if (w >= 3) px(x, y - Math.round(w * 0.6), PUFF.white, lv);
}

// ---------------------------------------------------------------- Ibabus: the briar cane

const BRIAR = { green: '#3c6b32', red: '#dd3c4c', dark: '#283826', light: '#7aa860', berry: '#4a2840' };
/** Ibabus's motif: a briar cane from a to b, sagging, green with red thorns every few pixels, drawn to u of the way. */
function cane(a: Pt, b: Pt, sag: number, u = 1, lv = 1): void {
  const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= n * u; i++) {
    const p = sagAt(a, b, i / n, sag);
    px(p.x, p.y, i % 5 === 0 ? BRIAR.light : BRIAR.green, lv);
    if (i % 4 === 2) px(p.x + (i % 8 === 2 ? 1 : -1), p.y - 1, BRIAR.red, lv);
  }
}
/** Red drops of blood running from a point. */
function bleed(E: Pt, a: number, len: number, n: number, seed: number, c = BRIAR.red): void {
  for (let q = 0; q < n; q++) { const aa = a - q * 3; if (aa < 0 || aa >= len) continue; px(E.x - 3 + hash(seed + q) * 7, E.y - 2 + aa * 0.6 + 0.04 * aa * aa, c, 1 - aa / len); }
}

// ---------------------------------------------------------------- Myroku: the cracked cup

const CUP = { white: '#f3f3eb', lav: '#cfc7d7', green: '#347433', dose: '#7ac060', crack: '#8a8498', sleep: '#b0a4d8' };
/** Myroku's motif: its cracked cup, white with a lavender shadow and a dark crack, full of green, tipped toward dir by `tip` (0 to 1). */
function cup(x: number, y: number, lv = 1, tip = 0, dir = 1): void {
  const rows = tip < 0.5 ? ['wggggw', 'wwwwwl', '.wwwl.', '..ll..'] : ['.ww..', 'wgw...', 'wggwl.', '.wwwl.', '..ll..'];
  blit(rows, x, y, { w: CUP.white, g: CUP.dose, l: CUP.lav }, lv, 1, dir < 0);
  px(x + (dir < 0 ? -1 : 1), y, CUP.crack, lv);
}
/** A hemlock flower head: a spray of white points on green stalks. */
function umbel(x: number, y: number, lv = 1): void {
  for (let q = -2; q <= 2; q++) { line(x, y + 3, x + q * 1.5, y, CUP.green, lv); px(x + q * 1.5, y - 1, CUP.white, lv); }
}

// ---------------------------------------------------------------- the Orrery: brass rings and Planets

const ORR = { blue: '#6b92d8', gold: '#f0b22c', bronze: '#936421', pale: '#fce8a8', sky: '#c8d8f8' };
/** The Orrery's motif: a brass ring tilted round x, y with a blue Planet riding it at angle a (whole turns). */
function orbitRing(x: number, y: number, rx: number, ry: number, a: number, lv = 1, planets = 1): void {
  arc(x, y, rx, ry, ORR.gold, lv);
  arc(x, y + 1, rx, ry, ORR.bronze, lv * 0.5, 0.05, 0.45);
  for (let i = 0; i < planets; i++) { const ang = (a + i / planets) * Math.PI * 2; planet(x + Math.cos(ang) * rx, y + Math.sin(ang) * ry, lv); }
}
/** A Planet: a blue ball with a lit side and a brass pin. */
function planet(x: number, y: number, lv = 1, big = false): void {
  if (big) blit(['.ss.', 'sbbd', 'sbbd', '.dd.'], x, y, { s: ORR.sky, b: ORR.blue, d: '#3a5aa0' }, lv);
  else blit(['sb', 'bd'], x, y, { s: ORR.sky, b: ORR.blue, d: '#3a5aa0' }, lv);
  px(x, y - (big ? 3 : 2), ORR.gold, lv);
}

// ---------------------------------------------------------------- Notsuru: the hook on its cable

const CRANE = { amber: '#cf9111', brown: '#8d663e', pale: '#d8d0c0', steel: '#a8a8b8', dark: '#4a3a28' };
/** Notsuru's motif: the crane's hook, a pale steel J under an amber block, open toward dir. */
function craneHook(x: number, y: number, lv = 1, dir = 1): void { blit(['aaa', '.s.', '.s.', 's.s', '.ss'], x, y, { a: CRANE.amber, s: CRANE.pale }, lv, 1, dir < 0); }
/** A load on the hook: an amber crate with brown slats. */
function crate(x: number, y: number, lv = 1, big = false): void {
  if (big) blit(['aaaaa', 'abbba', 'aaaaa', 'abbba', 'ddddd'], x, y, { a: CRANE.amber, b: CRANE.brown, d: CRANE.dark }, lv);
  else blit(['aaa', 'aba', 'ddd'], x, y, { a: CRANE.amber, b: CRANE.brown, d: CRANE.dark }, lv);
}

// ---------------------------------------------------------------- Molasha: the wind pump's vanes

const VANE = { white: '#e4e4ec', tan: '#bea68e', gray: '#676775', air: '#c8d8e8' };
/** Molasha's motif: the wind pump's fan, n vanes from a hub, turning with phase. */
function vanes(x: number, y: number, rr: number, phase: number, lv = 1, n = 6): void {
  for (let q = 0; q < n; q++) {
    const a = phase + q / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    line(x + c, y + s, x + c * rr, y + s * rr, VANE.white, lv);
    px(x + c * rr - s, y + s * rr + c, VANE.tan, lv);
  }
  px(x, y, VANE.gray, lv);
}
/** Lines of moving air running along dx past a point. */
function airLines(x: number, y: number, t: number, dx: number, w: number, lv = 1, n = 4): void {
  for (let q = 0; q < n; q++) { const k = ((t * 2 + q * 7) % (2 * w)) - w; line(x + dx * k, y - 4 + q * 3, x + dx * (k + 4), y - 4 + q * 3, q % 2 ? VANE.air : VANE.white, lv); }
}

// ---------------------------------------------------------------- Varhari: the watcher's reticle

const SAT = { gray: '#bdbdc5', cyan: '#aff2ff', navy: '#304f94', hot: '#f0ffff' };
/** Varhari's motif: a targeting reticle round x, y: a cyan ring with four ticks that close in as `close` goes to 1. */
function reticle(x: number, y: number, rr: number, close: number, lv = 1): void {
  arc(x, y, rr, rr * 0.8, SAT.cyan, lv);
  const d = rr + 2 + (1 - close) * 5;
  for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); line(x + c * d, y + s * d * 0.8, x + c * (d - 3), y + s * (d - 3) * 0.8, q % 2 ? SAT.gray : SAT.hot, lv); }
}
/** A watching beam from a to b in bands of cyan that run toward b. */
function scanBeam(a: Pt, b: Pt, t: number, lv = 1): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 0; i <= d; i += 1) { const k = ((i - t * 2) % 6 + 6) % 6, x = a.x + dx * i / d, y = a.y + dy * i / d; px(x, y, k < 2 ? SAT.hot : SAT.cyan, lv); if (k === 0) { px(x + nx, y + ny, SAT.cyan, lv); px(x - nx, y - ny, SAT.cyan, lv); } }
}

// ---------------------------------------------------------------- Camado: the firebox

const FURN = { iron: '#8a86a0', fire: '#ffa040', dark: '#4c4a62', hot: '#ffe8a0', red: '#d85020', smoke: '#5a5466' };
/** Camado's motif: its firebox door, iron with bars, the fire showing orange through it, open by `open` (0 to 1). */
function firebox(x: number, y: number, open: number, t: number, lv = 1): void {
  dither(x - 4, y - 3, 9, 7, FURN.dark, lv);
  dither(x - 3, y - 2, 7, 5, (t >> 1) & 1 ? FURN.fire : FURN.red, lv);
  dither(x - 2, y, 5, 2, FURN.hot, lv * open);
  const w = Math.round(7 * (1 - open));
  if (w > 0) { dither(x - 3, y - 2, w, 5, FURN.iron, lv); for (let i = 0; i < w; i += 2) dither(x - 3 + i, y - 2, 1, 5, FURN.dark, lv); }
  dither(x - 4, y - 4, 9, 1, FURN.iron, lv);
}
/** A live coal: a white-hot middle in orange. */
function coal(x: number, y: number, a: number, lv = 1): void { blit((a >> 1) & 1 ? ['hf', 'fr'] : ['fh', 'rf'], x, y, { h: FURN.hot, f: FURN.fire, r: FURN.red }, lv); }
/** Smoke and cinders rising off a point. */
function cinders(x: number, y: number, a: number, len: number, seed: number, n = 6): void {
  for (let q = 0; q < n; q++) { const aa = a - q; if (aa < 0 || aa >= len) continue; px(x + (hash(seed + q) - 0.5) * 12 + Math.sin(aa / 3), y + 2 - aa * 0.7, (aa + q) % 3 ? FURN.fire : FURN.hot, 1 - aa / len); }
}

// ---------------------------------------------------------------- Manuchi: the piston and its steam

const PIST = { steel: '#9d9dac', light: '#cad2da', dark: '#51515f', steam: '#eef2f6', oil: '#2e2e38' };
/** Manuchi's motif: a piston rod from a to b with its head at b: a light rod with a dark edge and a broad steel head. */
function pistonRod(a: Pt, b: Pt, lv = 1, head = 3): void {
  thick(a.x, a.y, b.x, b.y, PIST.light, lv, PIST.dark);
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  thick(b.x - nx * head, b.y - ny * head, b.x + nx * head, b.y + ny * head, PIST.steel, lv, PIST.dark);
  px(b.x - nx * head, b.y - ny * head, W, lv);
}
/** Puffs of steam blowing out from a point along dx. */
function steam(x: number, y: number, a: number, len: number, dx: number, lv = 1): void {
  if (a < 0 || a >= len) return;
  const u = a / len;
  for (let q = 0; q < 3; q++) fogPuffOf(x + dx * (2 + u * 8 + q * 3), y - q - u * 3, 1 + u * 2.5 - q * 0.3, PIST.steam, PIST.steel, lv * (1 - u));
}

// ---------------------------------------------------------------- Virtaki: the coil and its sparks

const DYN = { gray: '#9d9dac', yellow: '#fdde3d', dark: '#464654', hot: '#fffbe0', copper: '#c87838' };
/** Virtaki's motif: a coil of winding, stacked rings in yellow and gray, h rings tall. */
function windings(x: number, y: number, h: number, phase: number, lv = 1): void {
  for (let i = 0; i < h; i++) arc(x, y - i * 2, 4, 1.2, (i + Math.floor(phase)) % 2 ? DYN.yellow : DYN.copper, lv);
  dither(x - 1, y - h * 2, 3, h * 2 + 1, DYN.dark, lv * 0.5);
}
/** A jagged bolt from a to b in white and yellow, jumping each frame by seed. */
function jolt(a: Pt, b: Pt, seed: number, lv = 1, n = 6): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  let p0 = a;
  for (let q = 1; q <= n; q++) {
    const j = q < n ? (hash(seed + q * 13) - 0.5) * 6 : 0, p1 = { x: a.x + dx * q / n + nx * j, y: a.y + dy * q / n + ny * j };
    line(p0.x, p0.y, p1.x, p1.y, DYN.hot, lv);
    line(p0.x + 1, p0.y, p1.x + 1, p1.y, DYN.yellow, lv * 0.75);
    p0 = p1;
  }
}
/** A Charge on a whorl: a small yellow plus that blinks. */
function charge(x: number, y: number, t: number, lv = 1): void { const c = (t >> 2) & 1 ? DYN.hot : DYN.yellow; px(x, y, c, lv); px(x - 1, y, DYN.yellow, lv); px(x + 1, y, DYN.yellow, lv); px(x, y - 1, DYN.yellow, lv); px(x, y + 1, DYN.yellow, lv); }

// ---------------------------------------------------------------- Pilteki: the buoy's blasts

const BUOY = { red: '#d2272d', white: '#f2f2f2', gray: '#4c4c59', pale: '#f8c0c0' };
/** Pilteki's motif: rings of sound running from a to b, red and white by turns, each an arc facing b. */
function blasts(a: Pt, b: Pt, t: number, n: number, lv = 1, speed = 1, spread = 0.18): void {
  const dx = b.x - a.x, dy = b.y - a.y, ang = Math.atan2(dy, dx) / (Math.PI * 2);
  for (let q = 0; q < n; q++) {
    const u = (t * 0.05 * speed + q / n) % 1, p = { x: a.x + dx * u, y: a.y + dy * u }, rr = 2 + 5 * u;
    arc(p.x, p.y, rr, rr * 0.9, q % 2 ? BUOY.red : BUOY.white, lv * Math.min(1, u * 5), ang - spread, ang + spread);
  }
}
/** A striped buoy bell, red and white, swinging with a. */
function buoyBell(x: number, y: number, a: number, lv = 1): void { blit((a >> 2) & 1 ? ['.w.', 'rrr', 'www', 'rrr', '.g.'] : ['.w.', 'rrr', 'www', 'rrr', 'g..'], x, y, { r: BUOY.red, w: BUOY.white, g: BUOY.gray }, lv); }

// ---------------------------------------------------------------- shared jaws and reach

/** The foe's middle: the target, or for a picture on its own side, the other whorl's place in the scene. */
const foeOf = (r: FxRun): Pt => (r.plan.to === 'self' || r.plan.to === 'ally' ? (high(r.from) ? { x: 22, y: 42 } : { x: 75, y: 16 }) : aim(r));

/** Two rows of teeth over a point, open by `gap` pixels, in a tooth color with a gum color behind. */
function jaws(x: number, y: number, gap: number, w: number, tooth: string, gum: string, lv = 1): void {
  for (let i = -w; i <= w; i++) {
    px(x + i, y - 2 - gap, gum, lv); px(x + i, y + 2 + gap, gum, lv);
    if ((i + w) % 2 === 0) { px(x + i, y - 1 - gap, tooth, lv); px(x + i, y + 1 + gap, tooth, lv); }
  }
}

// ---------------------------------------------------------------- Lupusmi: the pale jaw and the old scent

const WOLF = { pale: '#e8e4dc', brown: '#817162', gray: '#aba39b', white: '#ffffff', moon: '#f4f0d8' };
/** Lupusmi's motif: a trail of old scent along the ground from a to b, a wavy line of pale and gray dots, drawn to u. */
function scent(a: Pt, b: Pt, u: number, t: number, lv = 1): void {
  const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let q = 0; q <= n * u; q++) { const v = q / n; px(a.x + (b.x - a.x) * v, a.y + (b.y - a.y) * v + Math.round(Math.sin(q * 0.8 + t * 0.3)), (q + (t >> 1)) % 3 ? WOLF.gray : WOLF.pale, lv); }
}

// ---------------------------------------------------------------- Iesbiki: the yoke and hoof prints

const YOKE = { wood: '#855644', gold: '#e6b733', cream: '#efe3cf', soil: '#5a3e2e' };
/** Iesbiki's motif: the ox yoke's bow, a wide curved beam of wood with two gold fittings, w half-wide. */
function yokeBow(x: number, y: number, w: number, lv = 1): void {
  for (let i = -w; i <= w; i++) { const yy = y + Math.round((i * i) / (w * w) * -3); px(x + i, yy, YOKE.wood, lv); px(x + i, yy + 1, YOKE.soil, lv); }
  for (const s of [-1, 1]) { const xx = x + s * Math.round(w * 0.55); px(xx, y - 2, YOKE.gold, lv); px(xx, y + 2, YOKE.gold, lv); line(xx, y, xx, y + 3, YOKE.cream, lv); }
}
/** A cloven hoof print pressed into the ground. */
function hoof(x: number, y: number, lv = 1): void { blit(['s.s', 's.s', '.g.'], x, y, { s: YOKE.soil, g: YOKE.gold }, lv); }

// ---------------------------------------------------------------- Okopa: the ermine's white body, ice, and snares

const ERMINE = { white: '#f2f2ee', ice: '#9cd3f2', brown: '#a26420', ink: '#2a2420', snow: '#e8f4fc' };
/** Okopa's motif: its long white body as a ribbon along a curve through the points, black-tipped at the tail end. */
function ermineBody(pts: Pt[], lv = 1): void {
  pts.forEach((p, i) => { const c = i === pts.length - 1 ? ERMINE.ink : i === pts.length - 2 ? ERMINE.brown : ERMINE.white; px(p.x, p.y, c, lv); if (i < pts.length - 2) px(p.x, p.y + 1, i % 2 ? ERMINE.snow : ERMINE.ice, lv); });
}
/** An icicle heading ux, uy: a white point, ice blue, and a pale root. */
function icicle(x: number, y: number, ux: number, uy: number, lv = 1): void {
  for (let i = 0; i < 6; i++) px(x - ux * i, y - uy * i, i === 0 ? W : i < 3 ? ERMINE.white : ERMINE.ice, lv);
  px(x - ux * 4 - uy, y - uy * 4 + ux, ERMINE.ice, lv); px(x - ux * 4 + uy, y - uy * 4 - ux, ERMINE.ice, lv);
}
/** A paw print in brown, the stoat's mark on what it hunts. */
function pawMark(x: number, y: number, lv = 1): void { blit(['b.b', '.b.', 'bbb'], x, y, { b: ERMINE.brown }, lv); }

// ---------------------------------------------------------------- Iliru: the sucker and the blood

const LEECH = { pale: '#f1eded', red: '#c4092a', dark: '#600c20', pink: '#e87a8a' };
/** Iliru's motif: its round sucker mouth seen face on, a red ring of small pale teeth round a dark middle. */
function sucker(x: number, y: number, rr: number, lv = 1, open = 1): void {
  oval(x, y, rr * open, rr * open * 0.9, LEECH.dark, lv);
  arc(x, y, rr, rr * 0.9, LEECH.red, lv);
  for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2; px(x + Math.cos(a) * (rr - 1), y + Math.sin(a) * (rr - 1) * 0.9, LEECH.pale, lv); }
}

// ---------------------------------------------------------------- Varasu: the flock

const CROW = { black: '#393544', red: '#e13634', gray: '#635969', sheen: '#8a80a0' };
/** Varasu's motif: a crow on the wing, a black V with a lit edge and a red eye, its wings up or down with a. */
function crow(x: number, y: number, a: number, lv = 1, mirror = false): void {
  blit((a >> 1) & 1 ? ['s...s', 'bb.bb', '.brb.', '..b..'] : ['.....', 'bb.bb', 'sbrbs', 's.b.s'], x, y, { b: CROW.black, s: CROW.sheen, r: CROW.red }, lv, 1, mirror);
}
/** A black feather drifting down. */
function feather(x: number, y: number, a: number, lv = 1): void { blit((a >> 2) & 1 ? ['s.', 'b.', '.b'] : ['.s', '.b', 'b.'], x, y, { b: CROW.black, s: CROW.sheen }, lv); }

// ---------------------------------------------------------------- Sonno: the barnacled horns

const BULL = { blue: '#0060b7', cream: '#ece4d4', tan: '#ccbc9c', shell: '#a8a090', dust: '#b8a888', sea: '#5aa0e0' };
/** Sonno's motif: a pair of cream horns sweeping up and out from x, y, barnacled at the base. */
function horns(x: number, y: number, lv = 1, size = 1): void {
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6 * size; i++) { const u = i / (6 * size); px(x + s * (2 + i * 0.9), y - Math.round(u * u * 5 * size), i > 4 * size ? W : BULL.cream, lv); }
    px(x + s * 2, y + 1, BULL.shell, lv); px(x + s * 3, y + 1, BULL.tan, lv);
  }
}
/** A hooking sweep of one horn through a point, rising toward dir. */
function hookCut(x: number, y: number, a: number, len: number, dir: number): void {
  if (a < 0 || a >= len) return;
  const n = Math.min(1, (a + 1) / 3), L = fade(a, len, 4);
  for (let i = 0; i <= 10 * n; i++) { const u = i / 10; px(x - dir * 5 + dir * u * 10, y + 4 - Math.round(u * u * 10), i > 7 ? W : BULL.cream, L); px(x - dir * 5 + dir * u * 10, y + 5 - Math.round(u * u * 10), BULL.tan, L); }
}

// ---------------------------------------------------------------- Peubi: the thumb and its print

const THUMB = { skin: '#a47e6a', nail: '#cbc7c5', dark: '#634442', lite: '#c8a08a', shine: '#f0ecea' };
/** Peubi's motif: a giant thumb pointing down at x, y (its tip), nail outward, `w` half-wide. */
function thumbDown(x: number, y: number, lv = 1, scale = 1): void {
  blit(['.ssssss.', 'sslllsss', 'ssnnnnss', 'snnnnnns', 'snwnnnns', 'snnnnnns', '.snnnns.', '..ssss..'], x, y - 4 * scale, { s: THUMB.skin, l: THUMB.lite, n: THUMB.nail, w: THUMB.shine }, lv, scale);
}
/** A thumbprint pressed into the ground: whorled arcs round a point, flat. */
function thumbprint(x: number, y: number, lv = 1): void { for (let i = 1; i <= 3; i++) arc(x, y, i * 2.5, i * 0.8, i % 2 ? THUMB.skin : THUMB.dark, lv, 0.05 * i, 0.9 + 0.05 * i); }

// ---------------------------------------------------------------- Usapus: the boxer's paws and the spring moon

const HARE = { brown: '#bd9576', pale: '#ebe3db', dark: '#815848', moon: '#f8f0c8', rope: '#d8b070' };
/** Usapus's motif: a boxing paw thrown along dir, a pale round fist with a brown cuff, and speed lines behind it. */
function paw(x: number, y: number, dir: number, lv = 1): void {
  blit(['.pp', 'ppp', 'bpp', '.bb'], x, y, { p: HARE.pale, b: HARE.brown }, lv, 1, dir < 0);
  for (let q = 0; q < 2; q++) line(x - dir * (3 + q), y - 1 + q * 2, x - dir * (6 + q * 2), y - 1 + q * 2, HARE.pale, lv * 0.5);
}
/** A boxing ring's ropes round a point, a square of gold rope. */
function ropes(x: number, y: number, w: number, lv = 1): void { for (const yy of [y - 4, y + 4]) dither(x - w, yy, 2 * w + 1, 1, HARE.rope, lv); for (const s of [-1, 1]) dither(x + s * w, y - 6, 1, 11, HARE.dark, lv); }

// ---------------------------------------------------------------- Mikapi: the paring of moon

const PARING = { pale: '#e9e9f9', lilac: '#9696dc', indigo: '#454482', white: '#ffffff' };
/** Mikapi's motif: a crescent of moon bulging toward ang (whole turns), rr across and thick pixels wide at its middle, thin at its horns. */
function crescentAt(x: number, y: number, rr: number, ang: number, lv = 1, thick = 2): void {
  const cx = Math.cos(ang * Math.PI * 2), cy = Math.sin(ang * Math.PI * 2);
  for (let s = 0; s <= thick; s++) arc(x - cx * s, y - cy * s, rr, rr, s === thick ? PARING.lilac : PARING.pale, lv, ang - 0.24, ang + 0.24);
  px(x + cx * rr, y + cy * rr, W, lv);
}
/** The edge of the moon drawn as a curved cut across a point, sweeping along dir. */
function moonCut(x: number, y: number, a: number, len: number, dir: number, rr = 7): void {
  if (a < 0 || a >= len) return;
  const n = Math.min(1, (a + 1) / 3), L = fade(a, len, 4), a0 = dir > 0 ? 0.55 : 0.95 - 0.35 * n, a1 = dir > 0 ? 0.55 + 0.35 * n : 0.95;
  arc(x, y, rr, rr * 0.8, PARING.pale, L, a0, a1);
  arc(x, y + 1, rr - 1, rr * 0.8 - 1, PARING.lilac, L, a0, a1);
}

// ---------------------------------------------------------------- Hometa: the comet's icy head

const COMA = { ice: '#c3d3e3', white: '#f6f9fc', blue: '#6f8fb5', dust: '#9aa8b8', deep: '#3a4a68' };
/** Hometa's motif: a comet's icy head with a long banded tail behind it along ux, uy. */
function cometHead(x: number, y: number, ux: number, uy: number, len: number, lv = 1, big = false): void {
  for (let i = len; i >= 1; i--) { const c = i < len * 0.3 ? COMA.white : i < len * 0.6 ? COMA.ice : COMA.dust, w = big && i < len * 0.5 ? 1 : 0; px(x - ux * i, y - uy * i, c, i > len * 0.8 ? lv * 0.5 : lv); if (w) { px(x - ux * i - uy, y - uy * i + ux, COMA.blue, lv); px(x - ux * i + uy, y - uy * i - ux, COMA.blue, lv); } }
  blit(big ? ['.ww.', 'wWWi', 'wWWi', '.ii.'] : ['wi', 'Wi'], x, y, { w: COMA.white, W: W, i: COMA.ice }, lv);
}

// ---------------------------------------------------------------- Remaku: the hanging folds of light

const AURORA = { green: '#61e293', pale: '#f7e4ff', purple: '#8757c4', deep: '#3a2a60' };
/** Remaku's motif: a curtain of northern light, strands hanging h from y across w each way, swaying with t: green over purple with a pale hem. */
function aurora(x: number, y: number, w: number, h: number, t: number, lv = 1): void {
  for (let i = -w; i <= w; i += 2) {
    const sx = x + i + Math.round(Math.sin((i + t * 0.5) / 4) * 1.5), hh = Math.round(h * (0.7 + 0.3 * Math.sin((i * 1.7 + t * 0.3) / 3)));
    dither(sx, y, 1, Math.round(hh * 0.6), AURORA.green, lv * 0.75);
    dither(sx, y + Math.round(hh * 0.6), 1, hh - Math.round(hh * 0.6), AURORA.purple, lv * 0.5);
    px(sx, y, AURORA.pale, lv);
  }
}
/** A ribbon of aurora from a to b, waving, green with a pale edge, drawn to u of the way. */
function ribbon(a: Pt, b: Pt, t: number, u = 1, lv = 1): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
  for (let i = 0; i <= d * u; i++) { const v = i / d, o = Math.sin(v * 9 - t * 0.4) * 3, x = a.x + (b.x - a.x) * v + nx * o, y = a.y + (b.y - a.y) * v + ny * o; px(x, y, AURORA.green, lv); px(x + nx, y + ny, i % 3 ? AURORA.pale : AURORA.purple, lv); }
}

// ---------------------------------------------------------------- Sazuma: lightning and the glass it leaves

const FULG = { blue: '#97d8ff', white: '#f8f8fc', deep: '#3954b3', sand: '#c8b890' };
/** Sazuma's motif: a fork of glass standing h tall in the sand where lightning struck, branching as it climbs. */
function glassFork(x: number, foot: number, h: number, seed: number, lv = 1): void {
  if (h <= 0) return;
  let px0 = x;
  for (let i = 0; i < h; i++) { const nx = px0 + (hash(seed + i) < 0.3 ? 1 : hash(seed + i) > 0.7 ? -1 : 0); px(nx, foot - i, i === h - 1 ? W : i % 2 ? FULG.blue : FULG.white, lv); if (i === Math.floor(h / 2)) line(nx, foot - i, nx + 2, foot - i - 2, FULG.blue, lv); px0 = nx; }
  px(x - 1, foot + 1, FULG.deep, lv); px(x + 1, foot + 1, FULG.deep, lv);
}
/** A blue bolt from a to b, white at its core, jumping each frame by seed. */
function glassBolt(a: Pt, b: Pt, seed: number, lv = 1, n = 6): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  let p0 = a;
  for (let q = 1; q <= n; q++) { const j = q < n ? (hash(seed + q * 13) - 0.5) * 6 : 0, p1 = { x: a.x + dx * q / n + nx * j, y: a.y + dy * q / n + ny * j }; line(p0.x, p0.y, p1.x, p1.y, FULG.white, lv); line(p0.x + 1, p0.y, p1.x + 1, p1.y, FULG.blue, lv * 0.75); p0 = p1; }
}

// ---------------------------------------------------------------- Kakeha: the halo

const HALO = { cream: '#faf2da', gold: '#dc9307', gray: '#cacad1', white: '#ffffff' };
/** Kakeha's motif: a halo, a flat ring of pale light with a gold inner rim and a glint running round it. */
function haloRing(x: number, y: number, rr: number, t: number, lv = 1, flat = 0.35): void {
  arc(x, y, rr, rr * flat, HALO.cream, lv);
  arc(x, y + 1, rr - 1, rr * flat, HALO.gold, lv, 0, 0.5);
  const g = (t / 16) % 1;
  px(x + Math.cos(g * Math.PI * 2) * rr, y + Math.sin(g * Math.PI * 2) * rr * flat, W, lv);
}

// ---------------------------------------------------------------- Tekage: the eclipse

const UMBRA = { dark: '#3c3858', sky: '#8cccfe', gray: '#7d83aa', gold: '#f0c860', void: '#0a0814' };
/** Tekage's motif: an eclipse, a black disc with a thin bright rim of corona, its rays flickering with t. */
function eclipse(x: number, y: number, rr: number, t: number, lv = 1): void {
  arc(x, y, rr + 1, rr + 1, UMBRA.sky, lv);
  for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2 + (t >> 2) * 0.2, l = rr + 2 + ((q + (t >> 1)) % 3); px(x + Math.cos(a) * l, y + Math.sin(a) * l, q % 2 ? UMBRA.gold : UMBRA.sky, lv); }
  oval(x, y, rr, rr, UMBRA.void, lv);
  arc(x, y, rr, rr, UMBRA.gold, lv, 0.6, 0.9);
}

// ---------------------------------------------------------------- Enneshi: the red star of bad news

const OMEN = { red: '#bb0029', orange: '#f88949', gray: '#918282', pale: '#ffe0c0' };
/** Enneshi's motif: a red star with long rays that twinkle, its middle orange and white. */
function redStar(x: number, y: number, rr: number, t: number, lv = 1): void {
  const tw = (t >> 2) & 1;
  for (let i = 1; i <= rr + tw; i++) { const c = i < 2 ? OMEN.orange : OMEN.red; px(x + i, y, c, lv); px(x - i, y, c, lv); px(x, y + i, c, lv); px(x, y - i, c, lv); }
  for (let i = 1; i <= Math.floor(rr / 2) + (1 - tw); i++) { px(x + i, y + i, OMEN.red, lv); px(x - i, y - i, OMEN.red, lv); px(x + i, y - i, OMEN.red, lv); px(x - i, y + i, OMEN.red, lv); }
  px(x, y, W, lv);
}

// ---------------------------------------------------------------- Honoki: the flare's loops

const SOL = { pale: '#fdeebe', deep: '#d75a0e', amber: '#f3a51d', hot: '#ffffff', ash: '#4a3a3a' };
/** Honoki's motif: a loop of fire arching from a to b, h high, amber with a pale core, its dashes running along it. */
function solarLoop(a: Pt, b: Pt, h: number, t: number, lv = 1, u = 1): void {
  const n = Math.max(8, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1.2));
  for (let i = 0; i <= n * u; i++) { const p = sagAt(a, b, i / n, -h), k = (i + t) % 5; px(p.x, p.y, k === 0 ? SOL.hot : k < 3 ? SOL.amber : SOL.deep, lv); px(p.x, p.y + 1, SOL.deep, lv * 0.5); }
}
/** A blob of the sun with a dark spot on it. */
function sunBlob(x: number, y: number, a: number, lv = 1): void { blit((a >> 1) & 1 ? ['.aa.', 'appa', 'apsa', '.dd.'] : ['.ap.', 'apaa', 'aasa', '.dd.'], x, y, { a: SOL.amber, p: SOL.pale, s: SOL.ash, d: SOL.deep }, lv); }

// ---------------------------------------------------------------- Tanpoka: the dandelion clock

const DANDLE = { fluff: '#f2eee0', gold: '#f0a820', stem: '#6aa048', seed: '#8a6a40' };
/** Tanpoka's motif: one seed under its little parachute of fluff, tipping as it drifts. */
function seedPara(x: number, y: number, a: number, lv = 1): void {
  blit((a >> 2) & 1 ? ['w.w.w', '.www.', '..s..', '..b..'] : ['.w.w.', 'w.w.w', '.www.', '..s..', '..b..'], x, y, { w: DANDLE.fluff, s: DANDLE.stem, b: DANDLE.seed }, lv);
}
/** Its clock: a ball of seed fluff rr across, rays of white with gold seeds at their roots. */
function clockBall(x: number, y: number, rr: number, t: number, lv = 1, n = 12): void {
  for (let q = 0; q < n; q++) { const a = q / n * Math.PI * 2 + t * 0.01; line(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, x + Math.cos(a) * rr, y + Math.sin(a) * rr, DANDLE.fluff, lv * 0.75); px(x + Math.cos(a) * rr, y + Math.sin(a) * rr, W, lv); }
  px(x, y, DANDLE.gold, lv);
}
/** A dandelion flower blooming gold, its rays opening with g (0 to 1). */
function goldBloom(x: number, y: number, g: number, lv = 1): void { const rr = 1 + 2 * g; for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2; px(x + Math.cos(a) * rr, y + Math.sin(a) * rr, q % 2 ? DANDLE.gold : '#ffd860', lv); } px(x, y, W, lv); }

// ---------------------------------------------------------------- Mawkin: the scarecrow and its kelp stuffing

const SCARE = { straw: '#e8d8b0', coat: '#c47a50', purple: '#5e5478', kelp: '#6a7a3a', stick: '#7a5a3a' };
/** Mawkin's motif: a scarecrow on its stick, arms out in a ragged coat, a straw hat, flapping its sleeves with a. */
function scarecrow(x: number, y: number, a: number, lv = 1, scale = 1): void {
  const f = (a >> 1) & 1;
  blit(['...hhh...', '..hhhhh..', '...fff...', f ? 'cc.ccc.cc' : '.cccccc..', f ? '.c.ccc.c.' : 'cc.ccc.cc', 's..ccc..s', '....t....', '....t....'], x, y, { h: SCARE.straw, f: SCARE.coat, c: SCARE.purple, s: SCARE.straw, t: SCARE.stick }, lv, scale);
}
/** A strand of dried kelp from its stuffing, waving. */
function kelpStrand(x: number, y: number, a: number, len: number, lv = 1): void { for (let i = 0; i < len; i++) px(x + i * 0.3 + Math.round(Math.sin((a + i * 2) / 3)), y + i, i === 0 ? SCARE.straw : i % 3 ? SCARE.kelp : SCARE.coat, lv); }

// ---------------------------------------------------------------- Teraba: the six blades

const FLEAM = { steel: '#394b53', teal: '#5dedcd', gray: '#989fa7', blood: '#c83a3a', shine: '#e8fff8' };
/** Teraba's motif: one of its little blades heading ux, uy: a bright point, a teal edge, and a gray heel. */
function lancet(x: number, y: number, ux: number, uy: number, lv = 1): void {
  for (let i = 0; i < 5; i++) px(x - ux * i, y - uy * i, i === 0 ? W : i < 3 ? FLEAM.teal : FLEAM.gray, lv);
  px(x - ux * 2 - uy, y - uy * 2 + ux, FLEAM.shine, lv); px(x - ux * 4 + uy, y - uy * 4 - ux, FLEAM.steel, lv);
}
/** A Blade lodged in something, its heel sticking out at an angle. */
function lodged(x: number, y: number, s: number, lv = 1): void { px(x, y, FLEAM.gray, lv); px(x + s, y - 1, FLEAM.teal, lv); px(x + 2 * s, y - 2, W, lv); }

// ---------------------------------------------------------------- Cutaru: the cask

const VAT = { wood: '#9e5a07', brine: '#8ab8cc', dark: '#602c00', hoop: '#3a3038', foam: '#e0f0f8' };
/** Cutaru's motif: its cask, staves of brown wood bound in two dark hoops, h tall, its staves turning with roll. */
function cask(x: number, y: number, w: number, h: number, roll: number, lv = 1): void {
  for (let i = -w; i <= w; i++) { const bulge = Math.round(1 - (i * i) / (w * w)), c = ((i + roll) & 1) ? VAT.wood : VAT.dark; dither(x + i, y - Math.floor(h / 2) - bulge, 1, h + 2 * bulge, c, lv); }
  for (const yy of [-Math.floor(h / 4), Math.floor(h / 4)]) dither(x - w, y + yy, 2 * w + 1, 1, VAT.hoop, lv);
  dither(x - w + 1, y - Math.floor(h / 2) - 1, 2 * w - 1, 1, VAT.brine, lv);
}

// ---------------------------------------------------------------- Karrum: the cart wheel

const WAIN = { pale: '#d9cdb1', red: '#e85522', dark: '#4e444c', hay: '#e8d070' };
/** Karrum's motif: a spoked cart wheel turning with phase: a pale rim, dark spokes, and a red hub. */
function wheel(x: number, y: number, rr: number, phase: number, lv = 1): void {
  arc(x, y, rr, rr, WAIN.pale, lv);
  for (let q = 0; q < 4; q++) { const a = phase + q * Math.PI / 4; line(x - Math.cos(a) * (rr - 1), y - Math.sin(a) * (rr - 1), x + Math.cos(a) * (rr - 1), y + Math.sin(a) * (rr - 1), WAIN.dark, lv); }
  px(x, y, WAIN.red, lv);
}
/** Wisps of hay blowing off it. */
function hay(x: number, y: number, a: number, dir: number, lv = 1, n = 4): void { for (let q = 0; q < n; q++) { const k = (a + q * 3) % 12; line(x - dir * (k + 2), y - 2 + q * 1.5 - k * 0.2, x - dir * (k + 4), y - 3 + q * 1.5 - k * 0.2, q % 2 ? WAIN.hay : WAIN.pale, lv * (1 - k / 12)); } }

// ---------------------------------------------------------------- Talpara: the star nose and the molehill

const MOLE = { gray: '#8c8898', pink: '#e4b4bc', cream: '#feeac5', soil: '#5a4838', dirt: '#8a7058' };
/** Talpara's motif: its star of a nose, a ring of short pink feelers round a cream middle that reach with a. */
function starNose(x: number, y: number, rr: number, a: number, lv = 1): void {
  for (let q = 0; q < 11; q++) { const ang = q / 11 * Math.PI * 2, l = rr + ((a + q) % 3 === 0 ? 1 : 0); line(x + Math.cos(ang) * 1.5, y + Math.sin(ang) * 1.5, x + Math.cos(ang) * l, y + Math.sin(ang) * l, MOLE.pink, lv); }
  px(x, y, MOLE.cream, lv);
}
/** A molehill of fresh earth h high from a foot line. */
function molehill(x: number, foot: number, h: number, lv = 1): void { mound(x, foot, Math.max(2, h + 2), h, MOLE.soil, MOLE.dirt, lv); }
/** A ridge of raised soil running along the ground from a toward b to u of the way, the tunnel it digs. */
function tunnelRidge(a: Pt, b: Pt, u: number, lv = 1): void {
  const n = Math.max(4, Math.round(Math.abs(b.x - a.x)));
  for (let i = 0; i <= n * u; i++) { const v = i / n, x = a.x + (b.x - a.x) * v, y = a.y + (b.y - a.y) * v; px(x, y - 1, MOLE.dirt, lv); px(x, y, MOLE.soil, lv); }
  const v = u, hx = a.x + (b.x - a.x) * v, hy = a.y + (b.y - a.y) * v;
  if (u > 0 && u < 1) molehill(hx, hy + 1, 2, lv);
}

// ---------------------------------------------------------------- Kucella: shelves and cold

const CELLAR = { slate: '#404858', cold: '#8bebeb', earth: '#8d7d6b', jar: '#c8e8e0', plank: '#7a6048' };
/** Kucella's motif: a cellar shelf, a plank with jars standing on it, w half-wide. */
function shelf(x: number, y: number, w: number, lv = 1): void {
  dither(x - w, y, 2 * w + 1, 1, CELLAR.plank, lv); dither(x - w, y + 1, 2 * w + 1, 1, CELLAR.earth, lv);
  for (let i = -w + 1; i < w; i += 3) blit(i % 2 ? ['c', 'j'] : ['e', 'e'], x + i, y - 1, { c: CELLAR.cold, j: CELLAR.jar, e: CELLAR.earth }, lv);
}
/** A draft of cold air waving along dx, cyan and white. */
function coldDraft(x: number, y: number, a: number, dx: number, lv = 1): void { for (let q = 0; q < 3; q++) { const y0 = y - 3 + q * 3; for (let i = 0; i < 6; i++) px(x - dx * i, y0 + Math.round(Math.sin((a + i * 2 + q * 3) / 2)), i < 2 ? W : CELLAR.cold, i < 4 ? lv : lv * 0.5); } }

// ---------------------------------------------------------------- Mimato: the lugworm and its casts

const WORM = { pink: '#dd8272', cream: '#f7eddd', dark: '#934951', sand: '#c8b090' };
/** Mimato's motif: its long segmented body from a to b, waving, pink with cream bands and a face at each end. */
function worm(a: Pt, b: Pt, t: number, lv = 1, wave = 2): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
  for (let i = 0; i <= d; i++) { const v = i / d, o = Math.sin(v * 8 + t * 0.4) * wave * Math.sin(Math.PI * v), x = a.x + (b.x - a.x) * v + nx * o, y = a.y + (b.y - a.y) * v + ny * o; px(x, y, i % 4 === 0 ? WORM.cream : WORM.pink, lv); px(x - nx, y - ny, WORM.dark, lv); }
  for (const p of [a, b]) { px(p.x, p.y, WORM.cream, lv); px(p.x + 1, p.y, K, lv); }
}
/** A worm cast, a little coiled pile of sand. */
function sandCast(x: number, foot: number, lv = 1): void { blit(['.s.', 'sds', 'sss'], x, foot - 1, { s: WORM.sand, d: WORM.dark }, lv); }

// ---------------------------------------------------------------- Kupas: the hobnailed sole

const BOOT = { leather: '#5f473d', purple: '#9b66dd', nail: '#e0b852', dark: '#2e2420' };
/** Kupas's motif: the print of its hobnailed sole, a leather outline studded with gold nails, pointing along dir. */
function bootPrint(x: number, y: number, dir: number, lv = 1): void {
  blit(['.lllll..', 'lnlnlnll', 'lllllll.', '...lnll.', '...lll..'], x, y, { l: BOOT.leather, n: BOOT.nail }, lv, 1, dir < 0);
}
/** A hobnail, a gold point with a dark shank. */
function hobnail(x: number, y: number, lv = 1): void { px(x, y, BOOT.nail, lv); px(x, y + 1, BOOT.dark, lv); }

// ---------------------------------------------------------------- Herya: the pod and its peas

const POD = { green: '#a8c48c', cream: '#ece4b4', dark: '#5a7848', eye: '#2a2a20' };
/** Herya's motif: a pea that looks back, green and round with a dark eye on a cream white. */
function pea(x: number, y: number, a: number, lv = 1): void { blit(['.gg.', 'gcwg', 'gwkg', '.gg.'], x, y, { g: POD.green, c: POD.cream, w: POD.cream, k: POD.eye }, lv, 1, ((a >> 3) & 1) === 1); }
/** A pea pod len long, split open by `open` (0 to 1) with its peas showing. */
function peaPod(x: number, y: number, len: number, open: number, lv = 1): void {
  const g = Math.round(open * 2);
  for (let i = -len; i <= len; i++) { const h = Math.round(2 * Math.sqrt(1 - (i * i) / (len * len + 1))); px(x + i, y - h - g, POD.green, lv); px(x + i, y + h, POD.dark, lv); }
  for (let i = -len + 2; i < len - 1; i += 3) { px(x + i, y - Math.round(open), POD.cream, lv); px(x + i + 1, y - Math.round(open), POD.green, lv); }
}

// ---------------------------------------------------------------- Tobiku: the cellar door with an eye

const HATCH = { cyan: '#bdeeee', lilac: '#e1c2fe', dark: '#443e57', plank: '#6a5a78', hole: '#0a0812' };
/** Tobiku's motif: its eye where the handle was, a lilac iris in a pale lid, open by `open` (0 to 1). */
function doorEye(x: number, y: number, open: number, lv = 1): void {
  if (open < 0.3) { line(x - 2, y, x + 2, y, HATCH.cyan, lv); return; }
  blit(open < 0.7 ? ['.ccc.', 'cklkc', '.ccc.'] : ['.ccc.', 'cllkc', 'clklc', '.ccc.'], x, y, { c: HATCH.cyan, l: HATCH.lilac, k: K }, lv);
}
/** A cellar hatch lying in the ground at x, foot, w half-wide: a dark hole with the door lifted by `open` (0 shut, 1 standing up). */
function groundHatch(x: number, foot: number, w: number, open: number, t: number, lv = 1): void {
  dither(x - w, foot - 1, 2 * w + 1, 3, HATCH.hole, lv * Math.min(1, open * 3));
  const h = Math.round(open * 8);
  for (let i = -w; i <= w; i += 1) { const c = (i + w) % 3 === 2 ? HATCH.dark : HATCH.plank; dither(x + i, foot - 1 - h, 1, Math.max(1, h), c, lv); }
  dither(x - w, foot - 1 - h, 2 * w + 1, 1, HATCH.cyan, lv);
  if (h > 3) doorEye(x, foot - 1 - Math.round(h / 2), (t >> 3) % 4 ? 1 : 0.2, lv);
}

// ---------------------------------------------------------------- Koolus: the chirps

const CRICK = { pale: '#ddd0b0', salmon: '#cf8070', brown: '#745f4b', white: '#fff4e0' };
/** Koolus's motif: one chirp, a short bow of sound facing along ux, uy; a loud one is wider and white. */
function chirp(x: number, y: number, ux: number, uy: number, loud = false, lv = 1): void {
  const ang = Math.atan2(uy, ux) / (Math.PI * 2), rr = loud ? 5 : 2.5;
  arc(x, y, rr, rr, loud ? W : CRICK.pale, lv, ang - 0.18, ang + 0.18);
  arc(x - ux, y - uy, rr - 1, rr - 1, CRICK.salmon, lv, ang - 0.15, ang + 0.15);
  if (loud) arc(x - ux * 2, y - uy * 2, rr - 2, rr - 2, CRICK.pale, lv, ang - 0.15, ang + 0.15);
}
/** A cricket's hind leg with its knee on backward, a long thigh up and a shin down, at x, foot. */
function crickLeg(x: number, foot: number, dir: number, lv = 1): void { line(x, foot, x + dir * 3, foot - 5, CRICK.brown, lv); line(x + dir * 3, foot - 5, x + dir * 7, foot, CRICK.salmon, lv); px(x + dir * 3, foot - 5, CRICK.pale, lv); }

// ---------------------------------------------------------------- Honevel: the knucklebone

const KNUCK = { bone: '#ece2c8', red: '#b06060', tan: '#b8a080', shade: '#8a7860' };
/** Honevel's motif: a knucklebone tumbling end over end with a, waisted in the middle with a red pip. */
function knucklebone(x: number, y: number, a: number, lv = 1, big = false): void {
  const f = (a >> 1) & 3, P = { b: KNUCK.bone, t: KNUCK.tan, r: KNUCK.red };
  const S = big ? [['bb.bb', 'btrtb', 'bb.bb'], ['bbb', '.t.', 'brb', '.t.', 'bbb'], ['b.b.b', 'btrtb', 'b...b'], ['b.b', 'btb', '.r.', 'btb', 'b.b']] : [['b.b', 'brb', 'b.b'], ['bbb', '.r.', 'bbb'], ['b.b', 'trt', 'b.b'], ['btb', '.r.', 'btb']];
  blit(S[f], x, y, P, lv);
}

// ---------------------------------------------------------------- Hamkuba: the molar

const MOLAR = { white: '#f0ece0', gum: '#b8606c', root: '#d0b890', shade: '#b8b0a0' };
/** A row of n flat molars over a band of gum, crowns facing up or down. */
function molarRow(x: number, y: number, n: number, up: boolean, lv = 1): void {
  for (let q = 0; q < n; q++) { const tx = x - (n - 1) * 2 + q * 4; blit(up ? ['w.w', 'www', 'sws'] : ['sws', 'www', 'w.w'], tx, y, { w: MOLAR.white, s: MOLAR.shade }, lv); }
  dither(x - n * 2 - 1, up ? y + 2 : y - 2, n * 4 + 1, 1, MOLAR.gum, lv);
}
/** Hamkuba's motif: a back tooth, its cusped crown on two roots. */
function molarTooth(x: number, y: number, lv = 1, scale = 1): void { blit(['w.w.w', 'wwwww', 'wwwsw', '.rrr.', '.r.r.', '.r.r.'], x, y, { w: MOLAR.white, s: MOLAR.shade, r: MOLAR.root }, lv, scale); }

// ---------------------------------------------------------------- Kaukubi: the neck bone and its spurs

const ATLAS = { bone: '#eee0c6', pink: '#da8187', brown: '#857059', marrow: '#f0a0a8' };
/** Kaukubi's motif: the atlas bone seen from above, a ring with a wing at each side and a hole through it. */
function vertebra(x: number, y: number, lv = 1, scale = 1): void { blit(['.bbbbb.', 'wbb.bbw', 'wb...bw', '.bb.bb.', '..ppp..'], x, y, { b: ATLAS.bone, w: ATLAS.brown, p: ATLAS.pink }, lv, scale); }
/** A bone spur pointing along ux, uy: a pale point on a brown base. */
function spur(x: number, y: number, ux: number, uy: number, lv = 1, n = 4): void { for (let i = 0; i < n; i++) px(x - ux * i, y - uy * i, i === 0 ? W : i < n - 1 ? ATLAS.bone : ATLAS.brown, lv); }

// ---------------------------------------------------------------- Kynme: the nail

const NAIL = { pink: '#e0b1a9', red: '#d63540', dark: '#494360', edge: '#fff0ec' };
/** Kynme's motif: the curved edge of a giant nail, a pale crescent band w wide, its free edge white, tipped by ang. */
function nailEdge(x: number, y: number, w: number, ang: number, lv = 1): void {
  for (let i = -w; i <= w; i++) { const yy = Math.round((i * i) / (w * 1.5)) * 0.5; const dx = Math.cos(ang) * i - Math.sin(ang) * yy, dy = Math.sin(ang) * i + Math.cos(ang) * yy; px(x + dx, y + dy, NAIL.edge, lv); px(x + dx - Math.sin(ang), y + dy + Math.cos(ang), NAIL.pink, lv); px(x + dx - 2 * Math.sin(ang), y + dy + 2 * Math.cos(ang), NAIL.pink, lv); }
}
/** The same spot, scratched again and again: crossed red scratches that grow with n. */
function sameSpot(x: number, y: number, n: number, lv = 1): void { for (let q = 0; q < n; q++) line(x - 2 + q, y - 2, x + 2 - q * 0.5, y + 2, q % 2 ? NAIL.red : NAIL.edge, lv); }

// ---------------------------------------------------------------- Koshika: the ball and its cup

const JOINT = { gray: '#bcc4d0', pale: '#f0ece4', brown: '#a87a5c', dark: '#5a4a40' };
/** Koshika's motif: a ball sitting in its cup, the ball rolled toward one side by `lean` (-1 to 1) or lifted out by `pop`. */
function joint(x: number, y: number, lean: number, pop: number, lv = 1): void {
  arc(x, y + 1, 4, 3, JOINT.brown, lv, 0.05, 0.45);
  arc(x, y + 2, 4, 3, JOINT.dark, lv, 0.1, 0.4);
  const bx = x + lean * 2, by = y - pop * 5;
  oval(bx, by, 2.5, 2.5, JOINT.gray, lv); px(bx - 1, by - 1, JOINT.pale, lv);
}

// ---------------------------------------------------------------- Netoive: the wishbone

const WISH = { pale: '#d8dcdb', amber: '#db9431', violet: '#443a67', white: '#ffffff' };
/** Netoive's motif: a wishbone, a V of pale bone with a knob at its fork, pulled apart by `split` (0 whole, 1 snapped). */
function wishbone(x: number, y: number, split: number, lv = 1, scale = 1): void {
  const s = Math.round(split * 3);
  for (let i = 0; i < 6 * scale; i++) { px(x - 1 - i * 0.6 - s, y - i, i > 4 * scale ? WISH.white : WISH.pale, lv); px(x + 1 + i * 0.6 + s, y - i, i > 4 * scale ? WISH.white : WISH.pale, lv); }
  if (split < 0.5) { px(x, y + 1, WISH.amber, lv); px(x - 1, y, WISH.pale, lv); px(x + 1, y, WISH.pale, lv); }
  else { px(x - s, y + 1, WISH.amber, lv); px(x + s, y + 1, WISH.pale, lv); }
}

// ---------------------------------------------------------------- Echili: the urchin's test and spines

const URCH = { test: '#d9c1dd', green: '#50a67e', purple: '#5c3c7a', pale: '#c8f0d8' };
/** Echili's motif: its test, a lilac ball dotted in purple rows, with green spines all round that bristle by `out` (0 to 1). */
function urchinBall(x: number, y: number, rr: number, phase: number, lv = 1, out = 0.5): void {
  const n = Math.max(8, Math.round(rr * 3));
  for (let q = 0; q < n; q++) { const a = phase + q / n * Math.PI * 2, l = rr + 1 + out * rr; line(x + Math.cos(a) * rr, y + Math.sin(a) * rr, x + Math.cos(a) * l, y + Math.sin(a) * l, q % 2 ? URCH.green : URCH.pale, lv); }
  oval(x, y, rr, rr, URCH.test, lv);
  for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2 - Math.PI / 2; px(x + Math.cos(a) * rr * 0.55, y + Math.sin(a) * rr * 0.55, URCH.purple, lv); }
}
/** A green spine heading ux, uy. */
function spine(x: number, y: number, ux: number, uy: number, lv = 1, n = 5): void { for (let i = 0; i < n; i++) px(x - ux * i, y - uy * i, i === 0 ? URCH.pale : URCH.green, lv); }

// ---------------------------------------------------------------- Rakani: the great claw

const FIDDLE = { red: '#c6502b', gold: '#d7b352', pale: '#f5e3b9', dark: '#6a2a18' };
/** Rakani's motif: its great claw, gold with pale tips over a red wrist, open or shut, facing dir. */
function greatClaw(x: number, y: number, open: boolean, dir: number, lv = 1, scale = 1): void {
  blit(open ? ['..ppg.', '.gg...', 'gggg..', 'ggg.pp', 'rgggg.', 'rr....'] : ['......', '.ggpp.', 'ggggp.', 'gggg..', 'rgggg.', 'rr....'], x, y, { g: FIDDLE.gold, p: FIDDLE.pale, r: FIDDLE.red }, lv, scale, dir < 0);
}

// ---------------------------------------------------------------- Vistus: heat shimmer and reflections

const FATA = { sky: '#69aeed', red: '#d0513a', deep: '#0534a0', pale: '#d8ecff' };
/** Vistus's motif: lines of heat shimmer over a w by h box at x, y, wavering with t, blue and red by turns. */
function shimmer(x: number, y: number, w: number, h: number, t: number, lv = 1): void {
  for (let q = 0; q < Math.max(1, Math.floor(h / 3)); q++) { const yy = y + q * 3 - ((t >> 1) % 3); for (let i = -w; i <= w; i++) if ((i + q + (t >> 2)) % 5 < 3) px(x + i, yy + Math.round(Math.sin((i + t) / 2.5)), q % 2 ? FATA.red : FATA.sky, lv); }
}
/** A Reflection of it: an 8 by 8 outline of its shape in blue, flickering. */
function reflection(x: number, y: number, t: number, lv = 1): void {
  const on = ((t >> 1) & 1) ? lv : lv * 0.5;
  for (let i = -4; i <= 4; i++) { px(x + i, y - 4, FATA.sky, on); px(x + i, y + 4, FATA.deep, on); px(x - 4, y + i, FATA.sky, on); px(x + 4, y + i, FATA.red, on); }
}

// ---------------------------------------------------------------- Ikara: the anchor and its chain

const ANCHOR = { iron: '#8694a2', pale: '#d7d7de', navy: '#384474', rust: '#9a5a3a' };
/** Ikara's motif: an anchor, ring and stock over its shank, its two arms curving up into flukes. */
function anchor(x: number, y: number, lv = 1, scale = 1, flip = false): void {
  blit(['..o..', 'sssss', '..i..', '..i..', 'f.i.f', 'fiiif', '.iii.'], x, y, { o: ANCHOR.pale, s: ANCHOR.navy, i: ANCHOR.iron, f: ANCHOR.pale }, lv, scale, false, flip);
}
/** A chain from a to b, links of iron and pale by turns, sagging. */
function chain(a: Pt, b: Pt, sag: number, lv = 1): void {
  const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) { const p = sagAt(a, b, i / n, sag); px(p.x, p.y, i % 2 ? ANCHOR.iron : ANCHOR.pale, lv); if (i % 2) px(p.x, p.y + 1, ANCHOR.navy, lv); }
}

// ---------------------------------------------------------------- Prosaki: the figurehead and its wake

const PROW = { wood: '#ecd8bc', gold: '#ca9330', navy: '#375280', foam: '#f0f8ff', ice: '#a8d8f0' };
/** Prosaki's motif: a carved figurehead's bust in profile facing dir, pale wood trimmed in gold. */
function figurehead(x: number, y: number, dir: number, lv = 1, scale = 1): void {
  blit(['.ww..', 'wwww.', '.wkww', '..www', '.ggw.', 'gggg.', '.ggg.'], x, y, { w: PROW.wood, k: PROW.navy, g: PROW.gold }, lv, scale, dir < 0);
}
/** A bow wave, a V of white spray opening back from a point ahead along dir. */
function bowWave(x: number, foot: number, dir: number, t: number, lv = 1, len = 8): void {
  for (let i = 0; i < len; i++) { const y = Math.round(i * 0.5), c = (i + (t >> 1)) % 3 ? PROW.foam : PROW.ice; px(x - dir * i, foot - 1 - y, c, lv); px(x - dir * i, foot + 1 + y * 0.4, c, lv); }
}

// ---------------------------------------------------------------- Sensi: the bilge pump and still water

const BILGE = { green: '#499780', cyan: '#44fff1', slate: '#36515f', pale: '#c8fff8', stone: '#6a8a80' };
/** Sensi's motif: the pump's handle on its pivot, worked up and down with phase. */
function pumpHandle(x: number, y: number, phase: number, lv = 1): void {
  const a = Math.sin(phase) * 0.6;
  line(x, y, x + Math.cos(a) * 8, y - Math.sin(a) * 8, BILGE.green, lv);
  line(x, y + 1, x + Math.cos(a) * 8, y + 1 - Math.sin(a) * 8, BILGE.slate, lv);
  px(x, y, BILGE.cyan, lv); px(x + Math.cos(a) * 8, y - Math.sin(a) * 8, BILGE.pale, lv);
  dither(x - 1, y + 1, 3, 6, BILGE.slate, lv);
}
/** A sheet of still water on the ground, flat and mirror-pale, w half-wide; `set` turns it toward stone. */
function stillWater(x: number, foot: number, w: number, set: number, lv = 1): void {
  if (w < 1) return;
  dither(x - w, foot, 2 * w + 1, 2, set > 0.5 ? BILGE.stone : BILGE.green, lv);
  dither(x - w + 2, foot, 2 * w - 3, 1, set > 0.5 ? BILGE.slate : BILGE.cyan, lv);
  if (set > 0.5) for (let i = -w + 2; i < w; i += 4) px(x + i, foot, BILGE.pale, lv);
}

// ---------------------------------------------------------------- Vesen: the sail, its blocks, and its boom

const SAIL = { canvas: '#e6dec8', blue: '#5395b9', wood: '#5c4939', rope: '#b89a70', shade: '#b8b0a0' };
/** Vesen's motif: a sail on its mast h tall, its canvas bellied out toward dir by `fill` (0 slack to 1 full), with a torn notch. */
function sailCloth(x: number, foot: number, h: number, fill: number, dir: number, lv = 1): void {
  dither(x, foot - h, 1, h, SAIL.wood, lv);
  for (let j = 1; j < h - 1; j++) { const v = j / h, w = Math.round((h - j) * 0.6 + fill * 3 * Math.sin(Math.PI * v)); if (w <= 0) continue; dither(dir > 0 ? x + 1 : x - w, foot - h + j, w, 1, j % 4 === 0 ? SAIL.shade : SAIL.canvas, lv); if (j === Math.floor(h / 2)) px(x + dir * w, foot - h + j, SAIL.blue, lv); }
  px(x + dir * 2, foot - Math.floor(h * 0.6), K, lv);
}
/** A wooden pulley block on a short rope. */
function pulley(x: number, y: number, a: number, lv = 1): void { blit((a >> 1) & 1 ? ['.r.', 'www', 'wbw', '.w.'] : ['r..', '.ww', 'wbw', '.ww'], x, y, { r: SAIL.rope, w: SAIL.wood, b: SAIL.blue }, lv); }

// ---------------------------------------------------------------- Cakoli: the keel timber

const KEEL = { gray: '#9c9890', gold: '#e1c259', brown: '#59493f', dark: '#3a3028' };
/** Cakoli's motif: its keel, a long dark timber len long at angle ang with gold bolts along it. */
function keelBeam(x: number, y: number, len: number, ang: number, lv = 1): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let i = -len / 2; i <= len / 2; i++) { px(x + c * i, y + s * i, KEEL.gray, lv); px(x + c * i - s, y + s * i + c, KEEL.brown, lv); px(x + c * i - 2 * s, y + s * i + 2 * c, KEEL.dark, lv); if (Math.round(i) % 4 === 0) px(x + c * i - s, y + s * i + c, KEEL.gold, lv); }
}

// ---------------------------------------------------------------- Taihoki: the cannon's shot and smoke

const CANNON = { bronze: '#d79f4f', orange: '#d35f00', dark: '#453f4f', smoke: '#8a8494', flash: '#fff0b0' };
/** A cannonball, dark iron rimmed in bronze light with a hot glint. */
function cannonball(x: number, y: number, lv = 1, big = false): void { blit(big ? ['.bb.', 'bwdb', 'bddb', '.bb.'] : ['wb', 'bd'], x, y, { d: CANNON.dark, b: CANNON.bronze, w: CANNON.flash }, lv); }
/** Taihoki's motif: its muzzle going off, a hot flash and then a ring of smoke rolling out along dir. */
function muzzle(x: number, y: number, a: number, dir: number, lv = 1): void {
  if (a < 0 || a >= 16) return;
  if (a < 3) { oval(x + dir * 2, y, 3 - a * 0.5, 2, CANNON.flash, lv); px(x + dir * 5, y, CANNON.orange, lv); }
  const rr = 2 + a * 0.4;
  arc(x + dir * (3 + a * 0.5), y - a * 0.2, rr, rr * 0.8, CANNON.smoke, lv * (1 - a / 16));
}

// ---------------------------------------------------------------- Namito: the curl with an eye

const SURF = { blue: '#9cc0d4', foam: '#eaf0f2', deep: '#4a6a88', eye: '#1a2a3a' };
/** Namito's motif: a breaking wave h tall on a foot line, its crest curled over toward dir, with one dark eye in the curl. */
function curl(x: number, foot: number, h: number, dir: number, t: number, lv = 1, eye = true): void {
  if (h < 2) return;
  for (let i = -3; i <= 4; i++) { const hh = Math.round(h * (1 - Math.abs(i - 1) / 6)); if (hh > 0) { dither(x - dir * i, foot - hh, 1, hh, i > 1 ? SURF.deep : SURF.blue, lv); px(x - dir * i, foot - hh, SURF.foam, lv); } }
  const cx = x + dir * 1, cy = foot - h + 2, rr = Math.max(2, h * 0.3);
  arc(cx, cy, rr, rr, SURF.foam, lv, dir > 0 ? 0.6 : 0.4, dir > 0 ? 1.1 : 0.9);
  px(cx + dir * rr, cy + 1 + (t & 1), W, lv);
  if (eye) { px(cx, cy, SURF.eye, lv); px(cx - dir, cy, SURF.foam, lv); }
}

// ---------------------------------------------------------------- Tozodo: the robber skua

const SKUA = { brown: '#836858', gold: '#ffb900', pale: '#e2d6c2', dark: '#3a2e28' };
/** Tozodo's motif: a skua on the wing, brown with a pale flash on each wing and a gold hooked beak, flapping with a, facing dir. */
function skuaBird(x: number, y: number, a: number, dir: number, lv = 1): void {
  blit((a >> 1) & 1 ? ['p.....p', 'bb...bb', '.bbbbg.', '...b...'] : ['.......', 'pbb.bbp', '.bbbbg.', '..b.b..'], x, y, { b: SKUA.brown, p: SKUA.pale, g: SKUA.gold }, lv, 1, dir < 0);
}
/** Its hooked beak, gold, opening or shut over a point. */
function hookBeak(x: number, y: number, open: number, dir: number, lv = 1): void { const g = Math.round(open * 3); blit(['ggg.', '...g'], x, y - 1 - g, { g: SKUA.gold }, lv, 1, dir < 0); blit(['ggg.'], x, y + 1 + g, { g: SKUA.pale }, lv, 1, dir < 0); }

// ---------------------------------------------------------------- Partica: the moon jellies

const JELLY = { pale: '#cbd9eb', violet: '#aa8ae7', blue: '#57669a', glow: '#eef4ff' };
/** Partica's motif: a moon jelly, a pale see-through bell with its violet four-leaf ring and tentacles trailing and waving with a. */
function jelly(x: number, y: number, rr: number, a: number, lv = 1): void {
  arc(x, y, rr, rr * 0.7, JELLY.pale, lv, 0.5, 1);
  dither(Math.round(x - rr), Math.round(y), Math.round(2 * rr + 1), 1, JELLY.blue, lv);
  for (let q = 0; q < 4; q++) px(x - rr * 0.5 + q * rr / 3, y - rr * 0.3, JELLY.violet, lv);
  for (let q = 0; q < 3; q++) for (let i = 1; i < 2 + rr; i++) px(x - rr * 0.6 + q * rr * 0.6 + Math.round(Math.sin((a + i * 2 + q * 3) / 3)), y + i, i % 2 ? JELLY.pale : JELLY.violet, lv * (i > rr ? 0.5 : 1));
}

// ---------------------------------------------------------------- Ajoku: the driftwood log

const DRIFT = { brown: '#756656', weed: '#79b159', bleach: '#e2d6be', dark: '#3e342a' };
/** Ajoku's motif: the cut end of its log, a bleached disc with a ring and a face looking out of it. */
function logEnd(x: number, y: number, rr: number, lv = 1): void {
  oval(x, y, rr, rr, DRIFT.bleach, lv); arc(x, y, rr, rr, DRIFT.brown, lv); arc(x, y, rr * 0.5, rr * 0.5, DRIFT.brown, lv * 0.5);
  px(x - 1, y - 1, DRIFT.dark, lv); px(x + 1, y - 1, DRIFT.dark, lv);
}
/** A strand of sea weed growing h tall from a foot line, waving with t. */
function weed(x: number, foot: number, h: number, t: number, lv = 1): void { for (let i = 0; i < h; i++) px(x + Math.round(Math.sin((t + i * 2) / 4)), foot - i, i === h - 1 ? '#b8e090' : DRIFT.weed, lv); }
/** A plate of bark with its grain. */
function barkPlate(x: number, y: number, lv = 1): void { blit(['bdb', 'bbd', 'dbb'], x, y, { b: DRIFT.brown, d: DRIFT.dark }, lv); px(x - 1, y - 1, DRIFT.bleach, lv); }

// ---------------------------------------------------------------- Spuawa: sea foam and its bill

const SPUME = { white: '#f2eee8', blue: '#9bbae2', lav: '#9282b7', pale: '#ffffff' };
/** Spuawa's motif: a cluster of foam, small bubble rings packed together w across, each with a white glint, shifting with t. */
function foam(x: number, y: number, w: number, t: number, lv = 1, seed = 0): void {
  const n = Math.max(3, Math.round(w * 1.4));
  for (let q = 0; q < n; q++) { const bx = x + (hash(seed + q * 3) - 0.5) * w * 2, by = y + (hash(seed + q * 7) - 0.5) * w * 0.9 + Math.sin((t + q * 5) / 6), rr = 1 + (q % 3 === 0 ? 1 : 0); arc(bx, by, rr, rr, q % 2 ? SPUME.white : SPUME.blue, lv); px(bx - 1, by - rr, W, lv); }
}
/** The bill it sends later: a slip of paper with lavender writing, swinging on a thread. */
function bill(x: number, y: number, a: number, lv = 1): void { const sw = Math.round(Math.sin(a / 4)); blit(['wwww', 'wllw', 'wlww', 'wwww'], x + sw, y, { w: SPUME.white, l: SPUME.lav }, lv); px(x, y - 3, SPUME.lav, lv); }

// ---------------------------------------------------------------- Aeshio: the tide's own lines

const EBB = { gray: '#a4acb5', blue: '#3f8ec4', dark: '#424d63', foam: '#e0eef8' };
/** Aeshio's motif: three tide lines w across at x, y, running out along dir or drawing back, wavering with t. */
function tideLines(x: number, y: number, w: number, t: number, dir: number, lv = 1): void {
  for (let q = 0; q < 3; q++) { const off = ((t * 1.5 + q * 5) % 12) * dir; for (let i = -w; i <= w; i += 2) px(x + i + off * 0.3, y + q * 2 + Math.round(Math.sin((i + t + q * 4) / 3)), q === 0 ? EBB.foam : q === 1 ? EBB.blue : EBB.gray, lv * (1 - q * 0.2)); }
}
/** A long shot of water heading ux, uy: a foam head and a blue body stretched behind it. */
function waterShot(x: number, y: number, ux: number, uy: number, len: number, lv = 1): void { for (let i = 0; i < len; i++) { px(x - ux * i, y - uy * i, i < 2 ? EBB.foam : i < len - 2 ? EBB.blue : EBB.dark, lv); if (i > 1 && i < len - 2) px(x - ux * i - uy, y - uy * i + ux, EBB.gray, lv); } }

// ---------------------------------------------------------------- Ardeagi: the long bill and the reeds

const HERON = { gray: '#bac6d2', gold: '#ba930f', dark: '#4e586c', reed: '#7a8a50', head: '#c8d0a0' };
/** Ardeagi's motif: its long bill, a spear of gold from a toward ux, uy, len long, its point white. */
function heronBill(x: number, y: number, ux: number, uy: number, len: number, lv = 1): void { for (let i = 0; i < len; i++) { px(x + ux * i, y + uy * i, i === len - 1 ? W : HERON.gold, lv); if (i < len * 0.4) px(x + ux * i - uy, y + uy * i + ux, HERON.dark, lv); } }
/** A stand of reeds h tall from a foot line, swaying with t. */
function reeds(x: number, foot: number, n: number, h: number, t: number, lv = 1): void { for (let q = 0; q < n; q++) { const rx = x - (n - 1) * 1.5 + q * 3, hh = h - (q % 2) * 2; for (let i = 0; i < hh; i++) px(rx + Math.round(Math.sin((t + q * 3) / 6) * i / hh), foot - i, i > hh - 3 ? HERON.head : HERON.reed, lv); } }

// ---------------------------------------------------------------- Annagi: the glass eel

const EEL = { glass: '#bfe7e7', red: '#da3c62', blue: '#67b7d7', dark: '#2a4a5a' };
/** Annagi's motif: a glass eel from a to b, a see-through wave of pale outline with a red heart and a dark eye at its head b. */
function glassEel(a: Pt, b: Pt, t: number, lv = 1, wave = 2): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
  for (let i = 0; i <= d; i++) { const v = i / d, o = Math.sin(v * 7 - t * 0.6) * wave * v, x = a.x + (b.x - a.x) * v + nx * o, y = a.y + (b.y - a.y) * v + ny * o; px(x + nx, y + ny, EEL.glass, lv); px(x - nx, y - ny, EEL.blue, lv * 0.5); if (Math.abs(v - 0.7) < 0.5 / d) px(x, y, EEL.red, lv); }
  px(b.x, b.y, EEL.dark, lv);
}

// ---------------------------------------------------------------- the pictures

export const ART_A: Record<string, LegendArt> = {
  // ---------------- Kivishi
  // Top Stone: the sand stone off the top of its pile lobs over in a tumble and splits the ground, throwing grit.
  topple: {
    noFlights: true, noLandings: true,
    back(r) {
      smear(r, CAIRN.gray, CAIRN.dark);
      landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, CAIRN.top, K, 9, r.seed), 2);
    },
    front(r) {
      const U = userAt(r);
      if (r.t < leaveOf(r)) cairnStone(U.x, U.y - 6, 2, CAIRN.top);
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [CAIRN.top, CAIRN.gray, CAIRN.dark]); cairnStone(p.x, p.y, 2.5, CAIRN.top, 1, ((p.a >> 1) & 1) === 1); });
      landings(r, 16, (E, a) => { chunks(E.x, E.y + 2, a, 5, r.seed, CAIRN_BITS, 1.1, 16, 2); dust(E.x, E.y + 4, a, 12, CAIRN.dark, CAIRN.gray); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Little Cairn: a cowrie lobs over and cracks the ground, and three stones drop one on another into a little cairn at its side.
  laystone: {
    noFlights: true, noLandings: true,
    back(r) {
      landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, CAIRN.cowrie, K, 6, r.seed), 2);
      const hit = hitOf(r), x = r.from.x + face(r) * 12, foot = r.from.y + 5, L = hold(r.t, hit - 8, r.end, 3);
      for (let i = 0; i < 3; i++) {
        const u = ease(prog(r.t, hit - 8 + i * 4, hit - 4 + i * 4));
        if (u > 0) cairnStone(x, foot - 1 - i * 2.5 - (1 - u) * 10, 2.5 - i * 0.5, i === 2 ? CAIRN.top : CAIRN.gray, L);
      }
    },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [CAIRN.cowrie, CAIRN.top, CAIRN.dark]); blit(['.ccc.', 'ckckc', '.ccc.'], p.x, p.y, { c: CAIRN.cowrie, k: CAIRN.dark }, 1, 1, false, ((p.a >> 2) & 1) === 1); });
      landings(r, 14, (E, a) => chunks(E.x, E.y + 2, a, 4, r.seed, [CAIRN.cowrie, CAIRN.gray], 0.9, 14), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Catch a Stone: two stones drop onto its pile, and a wall of stacked stones stands up before it to take the next hit.
  shoulder: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      for (let q = 0; q < 2; q++) {
        const u = ease(prog(t, 1 + q * 5, 8 + q * 5));
        if (u > 0 && t < hit + 4) cairnStone(U.x + (q ? 2 : -1), U.y - 6 - q * 2 - (1 - u) * 14, 2, q ? CAIRN.top : CAIRN.gray, 1, u < 1 && ((t >> 1) & 1) === 1);
      }
      const L = hold(t, hit, r.end, 4);
      for (let i = 0; i < 4; i++) if (t - hit >= i) cairnStone(U.x + dir * (7 + (i % 2)), U.y + 3 - i * 2.5, i === 3 ? 1.5 : 2.5, i === 3 ? CAIRN.top : CAIRN.gray, L, true);
      const a = t - hit;
      if (a >= 0 && a < 8) arc(U.x + dir * 7, U.y, 3 + a, 5 + a, CAIRN.lite, 1 - a / 8, dir > 0 ? 0.8 : 0.3, dir > 0 ? 1.2 : 0.7);
    },
  },

  // Tumbledown: its pile climbs tall over it, then every Stone comes down on the foe as a rain of rocks that shakes the ground.
  landslide: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      landings(r, 20, (E, a, i) => { if (i === 0) crackAt(E.x, E.y + 4, a, 20, CAIRN.top, K, 12, r.seed); dust(E.x + (hash(r.seed + i) - 0.5) * 14, E.y + 4, a, 12, CAIRN.dark, CAIRN.gray, 2); }, 3);
    },
    front(r) {
      const U = userAt(r), go = leaveOf(r);
      if (r.t < go) cairnPile(U.x, U.y - 3, Math.min(6, 1 + Math.floor(r.t / 3)));
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [CAIRN.gray, CAIRN.dark]); cairnStone(p.x, p.y, p.f.i % 3 ? 2 : 3, p.f.i % 4 ? CAIRN.gray : CAIRN.top, 1, ((p.a + p.f.i) >> 1 & 1) === 1); });
      landings(r, 14, (E, a, i) => chunks(E.x + (hash(r.seed + i) - 0.5) * 10, E.y + 3, a, 2, r.seed + i * 7, CAIRN_BITS, 0.9, 14, 2));
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 20 ? shake(a, 20, a < 8 ? 2 : 1) : 0, dark: r.t > 4 && a < 18 ? 0.25 : 0 }; },
    lights(r) { return [lit(aim(r), CAIRN.top, 1.4 * hold(r.t, hitOf(r), hitOf(r) + 16, 4), 14)]; },
  },

  // ---------------- Jarira
  // Shingle Spray: four flakes of shingle skip across, and each clatters down on the foe.
  pelt: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 10, (E, a, i) => crackAt(E.x + (i - 1.5) * 3, E.y + 4, a, 10, SCREE.pale, SCREE.dark, 3, r.seed + i)); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [SCREE.pale, SCREE.mid]); flake(p.x, p.y + Math.round(Math.sin(p.u * 9) * 1.5), p.a); });
      landings(r, 12, (E, a, i) => chunks(E.x + (i - 1.5) * 2, E.y + 1, a, 2, r.seed + i * 5, SCREE_BITS, 0.8, 12), 2);
    },
    scene(r) { const a = r.t - hitOf(r), z = r.t - (r.hits[r.hits.length - 1]?.at ?? 0); return { jolt: shake(a, 3, 1) || shake(z, 3, 1) }; },
  },

  // Slip Shove: three big flakes lob onto the foe, and the shingle under it slides away and takes it off its feet.
  rockfall: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => { slide(E.x, E.y + 5, a, 16, Math.sign(E.x - r.from.x) || 1, 6, r.seed); dust(E.x, E.y + 4, a, 14, SCREE.dark, SCREE.mid); }, 2); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [SCREE.pale, SCREE.mid, SCREE.dark]); flake(p.x, p.y, p.a, 1, true); });
      landings(r, 14, (E, a) => streaks(E.x, E.y, a, 12, Math.sign(E.x - r.from.x) || 1, SCREE.lite), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 8) }; },
  },

  // Bury Cobbles: two cobbles lob over and thump half into the ground by the foe, and sand settles round them.
  skid: {
    noFlights: true, noLandings: true,
    back(r) {
      landings(r, 30, (E, a, i) => {
        const x = E.x + (i % 2 ? 6 : -6), foot = E.y + 5, sink = Math.min(2, a >> 1), L = fade(a, 30, 6);
        blit(['.lpp.', 'lpmmd', 'pmmmd'], x, foot - 2 + sink, SCREE_PAL, L);
        dither(x - 3, foot, 7, 2, SCREE.dark, L);
        dust(x, foot, a, 14, SCREE.mid, SCREE.pale, 2, 3);
      });
    },
    front(r) { flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [SCREE.pale, SCREE.mid]); blit(['.lp.', 'lpmd', '.md.'], p.x, p.y, SCREE_PAL, 1); }); },
  },

  // Shingle Bank: a bank of shingle slides across the ground into the foe and heaps up on both sides of it, so neither can leave.
  avalanche: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), dir = face(r);
      for (const E of r.to) {
        const go = prog(t, leaveOf(r), hit), foot = E.y + 5;
        if (t < hit + 2) mound(E.x - dir * 22 * (1 - go), foot, 6, 4 + go * 2, SCREE.mid, SCREE.pale);
        const a = t - hit, up = ease(prog(a, 0, 6)), L = hold(t, hit, r.end, 6);
        if (a >= 0) { mound(E.x - 8, foot, 5, 6 * up, SCREE.mid, SCREE.lite, L); mound(E.x + 8, foot, 5, 6 * up, SCREE.mid, SCREE.lite, L); }
        if (a >= 0) crackAt(E.x, foot - 1, a, 20, SCREE.pale, SCREE.dark, 12, r.seed);
      }
    },
    front(r) {
      flights(r, p => { flake(p.x, p.y - 2, p.a, 1, p.f.i % 2 === 0); });
      landings(r, 16, (E, a, i) => { chunks(E.x, E.y + 3, a, 3, r.seed + i, SCREE_BITS, 1, 16, 2); dust(E.x, E.y + 5, a, 14, SCREE.dark, SCREE.mid); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 16 ? shake(a, 16, a < 6 ? 2 : 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, SCREE.pale, 1.2 * hold(r.t, hitOf(r), hitOf(r) + 14, 4), 14)); },
  },

  // ---------------- Daista
  // Barnacle Cut: a barnacle shell spins off it and cuts the foe in two strokes, pale and pink.
  raise: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [PLINTH.pink, PLINTH.dark]); blit(BARNACLE, p.x, p.y, BARN_PAL, 1, 1, false, ((p.a >> 1) & 1) === 1); });
      landings(r, 12, (E, a) => {
        const n = Math.min(1, (a + 1) / 3), L = fade(a, 12, 5);
        thick(E.x + 6, E.y - 6, E.x + 6 - 12 * n, E.y - 6 + 12 * n, PLINTH.lite, L, PLINTH.pink);
        if (a >= 2) line(E.x - 6, E.y - 3, E.x - 6 + 12 * Math.min(1, (a - 1) / 3), E.y - 3 + 8 * Math.min(1, (a - 1) / 3), PLINTH.pink, L);
        chunks(E.x, E.y, a, 3, r.seed, [PLINTH.lite, PLINTH.pink], 0.8, 12);
      }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Top Pool: rain gathers in a pool on its clear top, and three drops lift from it and splash down on the ally as a heal.
  lower: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), L = hold(t, 0, hit + 4, 3);
      dither(U.x - 4, U.y - 5, 9, 1, PLINTH.lite, L);
      oval(U.x, U.y - 6, 3, 1, PLINTH.pool, L); px(U.x - 1, U.y - 7, PLINTH.foam, L);
      flights(r, p => { blit(['.f.', 'fbp', '.b.'], p.x, p.y - 8, { f: PLINTH.foam, b: PLINTH.pool, p: PLINTH.pink }, 1); });
      landings(r, 16, (E, a) => { crown(E.x, E.y + 4, a, 14, PLINTH.foam, PLINTH.pool); motes(E.x, E.y + 2, a, 16, 5, r.seed, [PLINTH.pink, PLINTH.lite], 6, 12); });
    },
  },

  // Step Up: a pedestal rises out of the ground under the ally coming in, its pink band lit, and a pale ring spreads from it.
  unveil: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 2, r.end, 4), up = ease(prog(t, 2, hit));
      pedestal(E.x, E.y + 7, 5, Math.round(4 * up), L);
      landings(r, 14, (P, a) => ringOut(P.x, P.y + 5, a, 14, PLINTH.pink, 12, 0.3, PLINTH.lite));
    },
    front(r) { landings(r, 10, (E, a) => { px(E.x - 6, E.y + 3, W, 1 - a / 10); px(E.x + 6, E.y + 3, W, 1 - a / 10); }); },
  },

  // Keep the Top: two pink garlands circle it, then a tall plinth rises behind the ally and holds it up, ringed in pink.
  monument: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 6), up = ease(prog(t, 4, hit));
      pedestal(E.x, E.y + 6, 5, Math.round(13 * up), L);
      if (t >= hit) { const a = t - hit; arc(E.x, E.y + 5, 10, 3, PLINTH.pink, hold(t, hit, r.end, 4)); arc(E.x, E.y + 5, 11 + Math.min(4, a / 3), 3.5, PLINTH.lite, fade(a, 18, 8)); }
    },
    front(r) {
      flights(r, p => { arc(p.x, p.y, 3, 2, PLINTH.pink, 1, 0.5, 1); arc(p.x, p.y + 1, 3, 2, PLINTH.lite, 1, 0.55, 0.95); px(p.x, p.y - 2, W, 1); });
      landings(r, 16, (E, a) => motes(E.x, E.y + 2, a, 16, 6, r.seed, [PLINTH.pink, W, PLINTH.lite], 7, 14));
    },
    scene(r) { const a = r.t - hitOf(r); return { glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0 }; },
    lights(r) { return [lit(aim(r), PLINTH.pink, 1.3 * hold(r.t, hitOf(r) - 4, r.end, 5), 14)]; },
  },

  // ---------------- Luotsu
  // Stalactite: a wet stalactite drops from above onto the foe and cracks the ground, dripping as it breaks.
  cavein: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, GROTTO.blue, K, 8, r.seed), 2); },
    front(r) {
      flights(r, p => { px(p.x, p.y - 7, GROTTO.foam, 0.5); stalactite(p.x, p.y - 1, 1, true); });
      landings(r, 16, (E, a) => {
        chunks(E.x, E.y + 1, a, 5, r.seed, [GROTTO.pale, GROTTO.gray, GROTTO.blue], 1, 16, 2);
        for (let q = 0; q < 3; q++) { const aa = a - 4 - q * 3; if (aa >= 0 && aa < 8) px(E.x - 3 + q * 3, E.y - 3 + aa, GROTTO.blue, 1 - aa / 8); }
      }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Inrush: the tide rushes in on the foe from every side in drops, and a cave mouth behind it fills with the splash.
  takein: {
    noFlights: true, noLandings: true,
    back(r) { for (const E of r.to) { const L = hold(r.t, leaveOf(r), hitOf(r) + 12, 4); cave(E.x, E.y + 5, 9, 11, r.t, L); } },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [GROTTO.foam, GROTTO.blue, GROTTO.gray]); blit(['.f.', 'fbb', '.b.'], p.x, p.y, { f: GROTTO.foam, b: GROTTO.blue }, 1); });
      landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 16, GROTTO.foam, GROTTO.blue, 8));
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Seep Shell: a cave's shell closes round it from the ground up, its walls wet and seeping, to hold off the next blows.
  hush: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), u = ease(prog(t, 2, hit)), L = hold(t, 0, r.end, 4);
      cave(U.x, U.y + 5, 8, 10, t, L, 0.5, 0.5 + 0.25 * u);
      cave(U.x, U.y + 5, 8, 10, t, L, 1 - 0.25 * u, 1);
    },
    front(r) {
      flights(r, p => blit(['.f.', 'fbb', '.b.'], p.x, p.y - 6, { f: GROTTO.foam, b: GROTTO.blue }, 1));
      landings(r, 12, (E, a) => { ringOut(E.x, E.y, a, 12, GROTTO.foam, 10, 0.9, GROTTO.blue); });
    },
  },

  // Take In: a great cave mouth opens round the foe, the sea swirls into it, and it closes over the foe and swallows it.
  swallow: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, 0, r.end, 6), open = ease(prog(t, 0, hit - 6)), shut = prog(t, hit - 2, hit + 2);
      cave(E.x, E.y + 6, 4 + 9 * open, (5 + 11 * open) * (1 - 0.5 * shut), t, L);
      for (let q = 0; q < 5; q++) { const x = E.x - 8 + q * 4; if (open > 0.5) stalactite(x, E.y + 6 - (5 + 11 * open) * (1 - 0.5 * shut) * Math.sqrt(Math.max(0, 1 - ((x - E.x) / (4 + 9 * open)) ** 2)) + 3, L); }
      for (let q = 0; q < 10; q++) { const a = t * 0.25 + q * 0.63, rr = 12 - ((t * 0.4 + q * 2.1) % 10); if (t < hit) px(E.x + Math.cos(a) * rr, E.y + 1 + Math.sin(a) * rr * 0.5, q % 3 ? GROTTO.blue : GROTTO.foam, L); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit;
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [GROTTO.foam, GROTTO.blue]); blit(['.f.', 'fbb', '.b.'], p.x, p.y, { f: GROTTO.foam, b: GROTTO.blue }, 1); });
      for (const E of r.to) if (a >= 0 && a < 12) { oval(E.x, E.y, 6, 5, GROTTO.deep, fade(a, 12, 6)); arc(E.x, E.y, 6, 5, GROTTO.gray, fade(a, 12, 6)); }
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, 2) : 0, dark: r.t > 6 && a < 12 ? 0.25 : 0 }; },
    lights(r) { return [lit(aim(r), GROTTO.blue, 1.2 * hold(r.t, 0, hitOf(r), 6), 14)]; },
  },

  // ---------------- The Menhir
  // Wind Shadow: gusts curl off the standing stone and sweep through the foe in streaks of gray and star blue.
  lean: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => {
        const c = p.f.i === 1 ? MENHIR.blue : MENHIR.pale;
        line(p.x, p.y, p.x - p.ux * 6, p.y - p.uy * 6, c, 1);
        arc(p.x - p.ux * 7, p.y - 2, 2, 2, c, 0.75, 0.25, 0.9);
      });
      landings(r, 14, (E, a) => { dust(E.x, E.y + 4, a, 14, MENHIR.dark, MENHIR.gray); streaks(E.x, E.y, a, 10, Math.sign(E.x - r.from.x) || 1, MENHIR.pale, 2); });
    },
  },

  // Stand Fast: it stamps, and a ring of small standing stones rises round it, their marks lighting blue.
  ringofstones: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, r.end, 4);
      for (let q = 0; q < 6; q++) {
        const ang = (q / 6) * Math.PI * 2 + 0.3, x = U.x + Math.cos(ang) * 11, foot = U.y + 5 + Math.sin(ang) * 3;
        slab(x, foot, Math.round(6 * ease(prog(t, 4 + q, hit))), L, t >= hit);
      }
    },
    front(r) { landings(r, 12, (E, a) => ringOut(E.x, E.y + 4, a, 12, MENHIR.blue, 13, 0.3)); },
  },

  // Star Marks: three cup-and-ring marks lift off the stone and fly, and they cut a ring of marks under the foe that dazes it.
  summons: {
    noFlights: true, noLandings: true,
    back(r) {
      landings(r, 20, (E, a, i) => { if (i === 0) for (let q = 0; q < 3; q++) { const ang = q / 3 * Math.PI * 2 + a * 0.06; cupMark(E.x + Math.cos(ang) * 8, E.y + 5 + Math.sin(ang) * 2, fade(a, 20, 6)); } });
    },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [MENHIR.lite, MENHIR.blue, MENHIR.dark]); cupMark(p.x, p.y, 1, ((p.a >> 2) & 1) === 1); });
      landings(r, 18, (E, a, i) => { if (i === 0) for (let q = 0; q < 3; q++) { const ang = a * 0.3 + q * 2.09; px(E.x + Math.cos(ang) * 5, E.y - 7 + Math.sin(ang) * 1.5, q ? MENHIR.blue : W, fade(a, 18, 6)); } });
    },
  },

  // Keel Over: a great standing stone rises by the foe and falls over on it on purpose, cracking the ground the length of it.
  fallforward: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), dir = face(r);
      for (const E of r.to) {
        const a = t - hit, foot = E.y + 5;
        if (a >= 0) { crackAt(E.x, foot, a, 22, MENHIR.blue, K, 14, r.seed); dust(E.x, foot, a, 16, MENHIR.dark, MENHIR.gray, 4, 5); }
        // It stands beside the foe, then leans and falls toward it from its foot.
        const piv = { x: E.x - dir * 12, y: foot }, up = ease(prog(t, 0, 10)), fall = prog(t, hit - 8, hit) ** 2, L = hold(t, 0, hit + 10, 4);
        if (t < hit) { const ang = -Math.PI / 2 + dir * fall * Math.PI / 2, len = 20 * up; for (let s = -2; s <= 2; s++) { const ox = -Math.sin(ang) * s, oy = Math.cos(ang) * s; line(piv.x + ox, piv.y + oy, piv.x + ox + Math.cos(ang) * len, piv.y + oy + Math.sin(ang) * len, s === -2 ? MENHIR.pale : s === 2 ? MENHIR.dark : MENHIR.gray, L); } cupMark(piv.x + Math.cos(ang) * len * 0.6, piv.y + Math.sin(ang) * len * 0.6, L); }
        else if (a < 12) { dither(Math.min(piv.x, piv.x + dir * 20), foot - 3, 21, 4, MENHIR.gray, fade(a, 12, 6)); dither(Math.min(piv.x, piv.x + dir * 20), foot - 3, 21, 1, MENHIR.pale, fade(a, 12, 6)); }
      }
    },
    front(r) { landings(r, 18, (E, a, i) => chunks(E.x, E.y + 2, a, 4, r.seed + i, [MENHIR.pale, MENHIR.gray, MENHIR.blue], 1.2, 18, 2), 5); },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 18 ? shake(a, 18, a < 6 ? 3 : 1) : 0, glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
    lights(r) { return r.to.map(E => lit(E, MENHIR.blue, 1.4 * hold(r.t, hitOf(r), hitOf(r) + 16, 4), 14)); },
  },

  // ---------------- Louriba
  // Chisel: it lunges and a teal chisel flies true, bores into the foe, and chips of its stone fly back to Louriba.
  cut: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, QUARRY.mid, QUARRY.navy); landings(r, 18, (E, a) => { crackAt(E.x, E.y + 4, a, 18, QUARRY.teal, K, 7, r.seed); if (a > 1) boreHole(E.x + 4, E.y + 5, 1.5, fade(a, 18, 6)); }, 2); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [QUARRY.teal, QUARRY.mid, QUARRY.navy]); px(p.x, p.y, W); px(p.x - p.uy, p.y + p.ux, QUARRY.pale); px(p.x + p.uy, p.y - p.ux, QUARRY.pale); });
      landings(r, 18, (E, a) => { sparks(E.x, E.y, a, 5, r.seed, QUARRY.teal, 6, 6); takeStone(E, userAt(r), a - 3, 12, 4, r.seed); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Blasting: charges set in three bore holes round the foe glow, then blow, and the stone flies out of them.
  blast: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r);
      for (const E of r.to) for (let q = 0; q < 3; q++) {
        const x = E.x + (q - 1) * 7, on = hold(t, 2 + q * 2, hit + 1, 2);
        if (on > 0) { boreHole(x, E.y + 5, 2, on); if ((t + q) & 2) px(x, E.y + 4, QUARRY.teal, on); }
      }
    },
    front(r) {
      flights(r, p => { blit(['tm', 'md'], p.x, p.y - 3, { t: QUARRY.teal, m: QUARRY.mid, d: QUARRY.navy }, 1); });
      landings(r, 16, (E, a, i) => { if (i % 3) return; for (let q = 0; q < 3; q++) { chunks(E.x + (q - 1) * 7, E.y + 4, a - q, 3, r.seed + q * 9, QUARRY_BITS, 1.1, 14, 2); sparks(E.x + (q - 1) * 7, E.y + 3, a - q, 4, r.seed + q, QUARRY.teal, 6, 5); } dust(E.x, E.y + 5, a, 16, QUARRY.mid, QUARRY.navy, 3, 7); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 8) }; },
  },

  // Undermine: it sinks, a drill corkscrews under the ground to the foe, the ground bites up at it, and its shield flies home.
  undermine: {
    noFlights: true, noLandings: true,
    back(r) {
      flights(r, p => { const y = r.from.y + 5 + (p.E.y - r.from.y) * p.u; px(p.x, y + 2, QUARRY.teal); px(p.x - p.ux, y + 3, QUARRY.mid); dither(Math.round(p.x - p.ux * 4), Math.round(y + 3), 3, 1, QUARRY.navy, 0.5); });
      landings(r, 18, (E, a) => boreHole(E.x, E.y + 5, 3 + Math.min(2, a), fade(a, 18, 6)), 2);
    },
    front(r) {
      landings(r, 14, (E, a) => {
        const gap = Math.max(0, 5 - a * 1.5), L = fade(a, 14, 5);
        for (let i = -3; i <= 3; i++) { px(E.x + i * 1.5, E.y + 4 - gap, QUARRY.teal, L); px(E.x + i * 1.5, E.y - 4 + gap, QUARRY.teal, L); if (i % 2 === 0) { px(E.x + i * 1.5, E.y + 3 - gap, QUARRY.pale, L); px(E.x + i * 1.5, E.y - 3 + gap, QUARRY.pale, L); } }
        takeStone(E, userAt(r), a - 2, 12, 4, r.seed + 3);
      }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Flooded Pit: a pit opens round it and rainwater fills it in bands of teal and slate, rising round it in a column.
  excavate: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, r.end, 6), dig = ease(prog(t, 0, 10)), fill = ease(prog(t, 8, hit));
      oval(U.x, U.y + 5, 12 * dig, 3 * dig, QUARRY.deep, L);
      if (fill > 0) { oval(U.x, U.y + 5, 11 * fill, 2.5 * fill, QUARRY.mid, L); oval(U.x, U.y + 4, 8 * fill, 1.5 * fill, QUARRY.teal, L); }
      arc(U.x, U.y + 5, 12 * dig + 1, 3 * dig + 1, QUARRY.teal, L, 0.5, 1);
      const a = t - hit;
      if (a >= 0 && a < 18) for (let s = -2; s <= 2; s++) dither(U.x + s, U.y + 4 - Math.round(16 * out(prog(a, 0, 6))), 1, Math.round(16 * out(prog(a, 0, 6))), Math.abs(s) === 2 ? QUARRY.mid : s === 0 ? QUARRY.pale : QUARRY.teal, fade(a, 18, 8) * 0.75);
    },
    front(r) {
      flights(r, p => blit(['.p.', 'ptt', '.t.'], p.x, p.y, { p: QUARRY.pale, t: QUARRY.teal }, 1));
      landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 16, QUARRY.pale, QUARRY.teal, 8, 1.3));
    },
    lights(r) { return [lit(r.from, QUARRY.teal, 1.4 * hold(r.t, hitOf(r) - 6, r.end, 6), 14)]; },
  },

  // ---------------- Irvino
  // Gutter Drop: a stone head off the gutter flies at the foe pulling its face, and drops on it with a crack.
  drop: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, GARG.lime, K, 8, r.seed), 2); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [GARG.lav, GARG.purple]); blit(GARG_HEAD, p.x, p.y, GARG_PAL, 1, 1, p.ux < 0); });
      landings(r, 16, (E, a) => chunks(E.x, E.y + 2, a, 5, r.seed, [GARG.lav, GARG.purple, GARG.lime], 1, 16, 2), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Rain Spout: its face opens beside it and spouts rainwater through the foe, and lime drops of what it took run back.
  gargle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), B = beside(U), L = hold(t, 0, hitOf(r) + 4, 3), dir = face(r);
      gargFace(B.x, B.y, L, 1, t > 4, dir < 0);
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [GARG.foam, GARG.water, GARG.water]); blit(['.f.', 'fww', '.w.'], p.x, p.y, { f: GARG.foam, w: GARG.water }, 1); });
      landings(r, 22, (E, a) => {
        crown(E.x, E.y + 4, a, 14, GARG.foam, GARG.water, 6);
        const u = prog(a, 6, 22);
        if (u > 0 && u < 1) for (let q = 0; q < 3; q++) { const p = sagAt(E, U, prog(u, q * 0.1, 0.8 + q * 0.1), -8); px(p.x, p.y, GARG.lime); }
      });
    },
  },

  // Off the Roof: it leaps, and its stone face comes down on the foe jaws first and bites with a mouth of stone teeth.
  perch: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, GARG.lav, GARG.purple); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [GARG.lav, GARG.purple, GARG.purple], 2); gargFace(p.x, p.y, 1, 1, true, p.ux < 0); });
      landings(r, 14, (E, a) => {
        const gap = Math.max(0, 7 - a * 2), L = fade(a, 14, 5);
        blit(['lpppppl', 'wkwkwkw'], E.x, E.y - 3 - gap, GARG_PAL, L);
        blit(['wkwkwkw', '.ppppp.'], E.x, E.y + 3 + gap, GARG_PAL, L);
        chunks(E.x, E.y, a, 4, r.seed, [GARG.lav, GARG.lime], 1, 14);
      }, 3);
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // Stone Still: its face rises big over it and leers, lime eyes flashing, as a frame of stone closes round it.
  leer: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, r.end, 5), u = ease(prog(t, 0, hit));
      const B = beside(U);
      gargFace(B.x, B.y + 2 + Math.round((1 - u) * 6), L, 2, false, high(U));
      if (t >= hit && ((t - hit) >> 2) % 2 === 0) { px(B.x - 4, B.y - 1, W, L); px(B.x + 2, B.y - 1, W, L); }
    },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, hit - 2, r.end, 4), c = ease(prog(t, hit - 2, hit + 4));
      if (L > 0) { const w = 7 + (1 - c) * 6, h = 7 + (1 - c) * 5; dither(U.x - w, U.y - h, 2 * w + 1, 1, GARG.lav, L); dither(U.x - w, U.y + 5, 2 * w + 1, 1, GARG.lav, L); dither(U.x - w, U.y - h, 1, h + 5, GARG.purple, L); dither(U.x + w, U.y - h, 1, h + 5, GARG.purple, L); px(U.x - w, U.y - h, GARG.lime, L); px(U.x + w, U.y - h, GARG.lime, L); }
    },
    scene(r) { return { dark: hold(r.t, 0, r.end, 6) * 0.25 }; },
    lights(r) { return [lit(beside(r.from), GARG.lime, 1.2 * hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Kumpuka
  // Craze Line: it stamps, and a hot crack zigzags across the ground to each foe and crazes out under it.
  fissure: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), go = leaveOf(r), L = hold(t, go, r.end, 5);
      for (const E of r.to) {
        crazeLine({ x: r.from.x, y: r.from.y + 5 }, { x: E.x, y: E.y + 5 }, prog(t, go, hit), r.seed, L);
        const a = t - hit;
        if (a >= 0) for (let q = 0; q < 4; q++) { const ang = q * 1.6 + 0.4, n = Math.min(1, (a + 1) / 4) * 6; line(E.x, E.y + 5, E.x + Math.cos(ang) * n, E.y + 5 + Math.sin(ang) * n * 0.3, TOR.ember, L); }
      }
    },
    front(r) {
      flights(r, p => blit(['ls', 'sd'], p.x, p.y + 3, { l: TOR.pale, s: TOR.soil, d: TOR.dark }, 1));
      landings(r, 14, (E, a, i) => { for (let q = 0; q < 3; q++) { const h = Math.round(4 * Math.sin(Math.PI * Math.min(1, a / 10))); line(E.x - 5 + q * 5, E.y + 5, E.x - 5 + q * 5 + 1, E.y + 5 - h, q === 1 ? TOR.pale : TOR.soil, fade(a, 14, 4)); } chunks(E.x, E.y + 4, a, 3, r.seed + i, TOR_BITS, 0.8, 12); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Heel Down: it brings its heel down hard, two rings of ground run out from its feet, and stones hop up off them.
  stamp: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => { groundRing(E.x, E.y + 5, 3 + out(a / 18) * 12, fade(a, 18, 6)); if (a >= 4) groundRing(E.x, E.y + 5, 2 + out((a - 4) / 14) * 8, fade(a - 4, 14, 5)); }, 2); },
    front(r) { flights(r, p => blit(['lg', 'gs'], p.x, p.y - 2, { l: TOR.pale, g: TOR.gray, s: TOR.soil }, 1)); landings(r, 14, (E, a) => chunks(E.x, E.y + 4, a, 4, r.seed, TOR_BITS, 0.8, 14)); },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Roll Downhill: it rolls in, and three boulders off its slopes bowl along the ground into the foe and heave it back.
  heave: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, TOR.soil, TOR.dark); landings(r, 16, (E, a) => groundRing(E.x, E.y + 5, 3 + out(a / 16) * 9, fade(a, 16, 5)), 2); },
    front(r) {
      flights(r, p => { const y = p.y + 2; boulder(p.x, y, p.f.i === 0 ? 3 : 2, p.a); dust(p.x - p.ux * 4, y + 3, p.a % 6, 6, TOR.dark, TOR.soil, 1); });
      landings(r, 14, (E, a, i) => { chunks(E.x, E.y + 2, a, 3, r.seed + i, TOR_BITS, 1, 14, 2); streaks(E.x, E.y, a, 10, Math.sign(E.x - r.from.x) || 1, TOR.pale, 2); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Ground Rings: it stamps and the ground rings: humps of earth run out across the whole field and heave every foe.
  quake: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, hit = hitOf(r), go = leaveOf(r), L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 3; q++) { const a = t - go - q * 4; if (a >= 0 && a < 30) groundRing(U.x, U.y + 5, 4 + a * 1.4, fade(a, 30, 8) * L); }
      if (t < go) groundRing(U.x, U.y + 5, 3 + (t % 6), 0.5 * L);
      for (const E of r.to) { const a = t - hit; if (a >= 0) { crackAt(E.x, E.y + 5, a, 22, TOR.ember, K, 12, r.seed); mound(E.x, E.y + 6, 9, Math.round(4 * Math.sin(Math.PI * Math.min(1, a / 10))), TOR.soil, TOR.pale); } }
    },
    front(r) { landings(r, 18, (E, a, i) => { chunks(E.x, E.y + 3, a, 4, r.seed + i, TOR_BITS, 1.2, 18, 2); if (i === 0) for (let q = 0; q < 3; q++) { const ang = a * 0.3 + q * 2.09; px(E.x + Math.cos(ang) * 5, E.y - 7 + Math.sin(ang) * 1.5, q ? TOR.ember : W, fade(a, 18, 6)); } }, 5); },
    scene(r) { const a = r.t - hitOf(r), go = r.t - leaveOf(r); return { jolt: a >= 0 && a < 20 ? shake(a, 20, a < 6 ? 3 : 1) : go >= 0 && go < 6 ? shake(go, 6, 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, TOR.ember, 1.4 * hold(r.t, hitOf(r), hitOf(r) + 16, 4), 14)); },
  },

  // ---------------- Kaivodo
  // Bucket Drop: its bucket swings up on the rope and tips, three drops lob over, and they splash down on the foe.
  bucket: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), dir = face(r), L = hold(t, 0, go + 10, 3);
      const B = { x: U.x + dir * 4, y: U.y - 8 - Math.round(4 * ease(prog(t, 0, go))) };
      if (L > 0) { line(U.x, U.y - 4, B.x, B.y - 3, WELL.rope, L); bucket(B.x, B.y, L, t >= go, t >= go + 3, dir); }
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [WELL.foam, WELL.water]); bead(p.x, p.y, WELL.foam, WELL.water); });
      landings(r, 16, (E, a, i) => { crown(E.x, E.y + 4, a, 16, WELL.foam, WELL.water, 7); if (i === 0) motes(U.x, U.y + 3, a, 14, 3, r.seed, [WELL.water, WELL.foam], 4, 8); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Haul Water: its bucket is hauled up on the rope over the ally, tips, and pours on it, and gold flecks of the heal rise.
  splash: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, hit + 10, 3), up = ease(prog(t, 0, hit - 3)), B = { x: E.x + 3, y: E.y + 2 - 14 * up };
      line(B.x, B.y - 16, B.x, B.y - 3, WELL.rope, L);
      bucket(B.x, B.y, L, t >= hit - 3, t >= hit + 3, -1);
      if (t >= hit - 3 && t < hit + 6) for (let q = 0; q < 4; q++) px(B.x - 2, B.y + 2 + ((t * 2 + q * 3) % Math.max(2, E.y - B.y)), q % 2 ? WELL.foam : WELL.water, L);
      landings(r, 18, (P, a) => { crown(P.x, P.y + 4, a, 14, WELL.foam, WELL.water, 6); motes(P.x, P.y + 2, a, 18, 5, r.seed, [WELL.gold, WELL.foam], 6, 12); });
    },
  },

  // Well Cover: its round stone lid spins over and claps down on the foe's head, and a ring of well stones holds its feet.
  brim: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => { const L = fade(a, 22, 6); arc(E.x, E.y + 4, 7, 2, WELL.stone, L); arc(E.x, E.y + 5, 7, 2, WELL.plum, L, 0, 0.5); }, 2); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [WELL.stone, WELL.plum]); lid(p.x, p.y, 1, ((p.a >> 1) & 1) === 1); });
      landings(r, 22, (E, a) => { lid(E.x, E.y - 9 + Math.min(4, a * 2), fade(a, 22, 6)); if (a < 6) arc(E.x, E.y - 5, 5 + a, 2 + a / 3, WELL.gold, 1 - a / 6, 0.5, 1); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Spring Rising: water wells up out of the ground under its team in banded domes, and gold flecks rise from the spring.
  spring: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      for (const E of r.to) {
        const h = Math.round(7 * ease(prog(t, 0, hit)) * (1 - prog(t, hit + 10, r.end)));
        waterDome(E.x, E.y + 5, 11, h, t, WELL.plum, WELL.water, WELL.foam, W, L);
        const a = t - hit;
        if (a >= 0 && a < 14) for (let s = -1; s <= 1; s++) dither(E.x + s, E.y + 5 - h - Math.round(8 * out(prog(a, 0, 5))), 1, Math.round(8 * out(prog(a, 0, 5))), s ? WELL.water : WELL.foam, fade(a, 14, 6));
      }
    },
    front(r) {
      flights(r, p => bead(p.x, p.y, WELL.foam, WELL.water));
      landings(r, 20, (E, a) => motes(E.x, E.y, a, 20, 8, r.seed, [WELL.gold, W, WELL.foam], 10, 14));
    },
    lights(r) { return r.to.map(E => lit(E, WELL.water, 1.3 * hold(r.t, hitOf(r) - 6, r.end, 6), 14)); },
  },

  // ---------------- Vetoki
  // Ankle Drag: two drops skim in low, and a coil of cold current winds round the foe's feet and pulls them down.
  pullunder: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a) => { coil(E.x, E.y + 4, 7 - a * 0.15, a * 0.4, fade(a, 20, 6), 0.3); for (let q = 0; q < 3; q++) { const aa = a - 4 - q * 3; if (aa >= 0 && aa < 8) line(E.x - 3 + q * 3, E.y + 5, E.x - 3 + q * 3, E.y + 5 + aa * 0.5, RIP.blue, 1 - aa / 8); } }); },
    front(r) { flights(r, p => { tail(p.x, p.y + 2, p.ux, p.uy, [RIP.white, RIP.cyan, RIP.blue]); bead(p.x, p.y + 2, RIP.white, RIP.cyan, 1, RIP.blue); }); },
  },

  // Sand Churn: the current churns sand off the bottom, swirls of grit sweep through the foes and leave grit in their eyes.
  churn: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { coil(p.x, p.y, 4, p.a * 0.6, 1, 0.6); for (let g = 0; g < 4; g++) px(p.x + (hash(r.seed + g + p.a) - 0.5) * 7, p.y + (hash(r.seed + g * 3 + p.a) - 0.5) * 5, g % 2 ? RIP.sand : RIP.grit); });
      landings(r, 16, (E, a) => { dust(E.x, E.y + 4, a, 16, RIP.grit, RIP.sand); if (a > 2 && a < 14) for (let g = 0; g < 4; g++) px(E.x - 3 + g * 2 + Math.sin(a + g), E.y - 2 + (g % 2), RIP.sand, fade(a, 14, 4)); });
    },
  },

  // Pull Under: the current coils under the foe and under Vetoki both, and deep water rises over their feet as both go down.
  sink: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 2, r.end, 5);
      for (const P of [r.from, aim(r)]) {
        coil(P.x, P.y + 5, 9, t * 0.35, L, 0.3);
        const h = Math.round(5 * prog(t, hit - 6, hit + 6));
        if (h > 0) { dither(P.x - 6, P.y + 6 - h, 13, h, RIP.deep, 0.75 * L); dither(P.x - 6, P.y + 6 - h, 13, 1, RIP.cyan, L); }
      }
    },
    front(r) { flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [RIP.cyan, RIP.blue]); bead(p.x, p.y, RIP.white, RIP.cyan, 1, RIP.blue); }); landings(r, 12, (E, a) => ringOut(E.x, E.y + 4, a, 12, RIP.white, 10, 0.3)); },
  },

  // Rip Current: a strong current runs out under every foe, its streaks all pulling away, and a coil throws them off their feet.
  rip: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), dir = face(r), L = hold(t, leaveOf(r), r.end, 6);
      for (const E of r.to) {
        dither(E.x - 16, E.y + 4, 33, 3, RIP.blue, 0.5 * L);
        for (let q = 0; q < 8; q++) { const run = ((t * 2 + q * 9) % 34) - 17, y = E.y + 4 + (q % 3); line(E.x + run * dir, y, E.x + (run + 4) * dir, y, q % 2 ? RIP.white : RIP.cyan, L); }
        if (t >= hit) coil(E.x, E.y + 3, 9, t * 0.5, hold(t, hit, r.end, 5), 0.4);
      }
    },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [RIP.white, RIP.cyan, RIP.blue]); bead(p.x, p.y, RIP.white, RIP.cyan, 1, RIP.blue); });
      landings(r, 18, (E, a, i) => { crown(E.x, E.y + 4, a, 16, RIP.white, RIP.cyan, 8, 1.2); if (i === 0) daze(E, a, 18, RIP.cyan, RIP.white); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, RIP.cyan, 1.2 * hold(r.t, hitOf(r) - 4, r.end, 5), 14)); },
  },

  // ---------------- Utumi
  // Sea Fret: banks of sea fog roll through the foes, and the fret clings round them and drizzles.
  damp: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => fogPuff(p.x, p.y, 4, 1));
      landings(r, 22, (E, a) => { fogPuff(E.x + Math.sin(a / 5), E.y - 1, 7, fade(a, 22, 8)); for (let q = 0; q < 4; q++) { const k = (a * 1.5 + q * 4) % 10; px(E.x - 5 + q * 3, E.y - 2 + k, FOG.blue, fade(a, 22, 8)); } });
    },
  },

  // Fog Bank: fog circles the ally and settles in a low bank along its side of the field, ringed in blue.
  bank: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a) => { const L = fade(a, 30, 10) * prog(a, 0, 6); for (let q = 0; q < 4; q++) fogPuff(E.x - 15 + q * 10 + Math.sin((a + q * 5) / 6) * 2, E.y + 4, 6, L); }); },
    front(r) {
      flights(r, p => fogPuff(p.x, p.y, 3, 1));
      landings(r, 16, (E, a) => { arc(E.x, E.y, 7, 6, FOG.blue, fade(a, 16, 6)); arc(E.x, E.y, 8, 7, FOG.white, 0.5 * fade(a, 16, 6), 0.5, 1); });
    },
  },

  // Roll Back: Utumi thickens into a bank of fog round itself, and the bank rolls back off the field.
  muffle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), dir = face(r), grow = ease(prog(t, 0, hit)), go = ease(prog(t, hit, r.end));
      const x = U.x - dir * 30 * go, L = hold(t, 0, r.end, 6);
      fogPuff(x, U.y, 3 + 5 * grow, L);
      fogPuff(x - dir * 5, U.y + 3, 2 + 4 * grow, L);
      if (t < hit + 4) fogEyes(x, U.y - 1, L);
    },
  },

  // Haar: banks of fog roll in across the whole field and close on Utumi, and only its blue eyes show inside.
  whiteout: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 8);
      for (let q = 0; q < 2; q++) {
        const y = 30 + q * 14, lv = L * ease(prog(t, q * 4, 16 + q * 4)), off = Math.floor(t / (5 + q * 3)) + q * 17;
        for (let x = 0; x < 96; x += 4) { const h = 2 + Math.round(Math.sin((x + off) / 7) * 1.5 + Math.sin((x + off) / 3) * 0.7); dither(x, y - h, 4, 2 * h + 1, FOG.gray, 0.25 * lv); if (h > 1) dither(x, y - h + 1, 4, 2 * h - 1, FOG.white, 0.25 * lv); }
      }
    },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r);
      flights(r, p => fogPuff(p.x, p.y, 4, 1));
      const L = hold(t, hit - 2, r.end, 6);
      if (L > 0) { fogPuff(U.x, U.y + 1, 9, L); if (((t - hit) >> 3) % 3 !== 2) fogEyes(U.x, U.y - 1, L); }
    },
    scene(r) { return { dark: 0.125 * hold(r.t, 0, r.end, 8) }; },
  },

  // ---------------- Hyolau
  // Ice Splinter: it blinks, and a long splinter of sea ice flies true and ices the foe over with crystals.
  shard: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => splinter(p.x, p.y, p.ux, p.uy, 7));
      landings(r, 16, (E, a) => { rime(E, a, 16, r.seed, 7, 7); if (a < 4) icePlate(E.x, E.y - 1, 3 - a, 1); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Pressure Ridge: plates of ice heave up out of the ground round the foe into a ridge, and a plate stands guard by Hyolau.
  packice: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), L = hold(t, hit - 2, r.end, 5);
      landings(r, 18, (P, a) => crackAt(P.x, P.y + 4, a, 18, FLOE.light, FLOE.ink, 9, r.seed), 2);
      for (let q = 0; q < 4; q++) { const up = ease(prog(t, hit - 2 + q, hit + 4 + q)); if (up > 0) icePlate(E.x - 9 + q * 6, E.y + 5 - Math.round(4 * up), 2, L, q % 2 ? 0.6 : -0.6); }
    },
    front(r) {
      flights(r, p => splinter(p.x, p.y, 0, -1, 4));
      const t = r.t, U = r.from, hit = hitOf(r), dir = face(r), L = hold(t, hit, r.end, 4);
      if (L > 0) for (let j = 0; j < 7; j++) { px(U.x + dir * 7, U.y - 3 + j, j < 2 ? FLOE.white : FLOE.light, L); px(U.x + dir * 8, U.y - 2 + j, FLOE.blue, L); }
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Calving: two great blocks of ice break off above the foe, drop on it, and burst into plates and spray.
  calve: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { blit(['.ww.', 'wwll', 'wllb', '.bb.'], p.x, p.y, { w: FLOE.white, l: FLOE.light, b: FLOE.blue }, 1); px(p.x, p.y - 4, FLOE.light, 0.5); });
      landings(r, 16, (E, a, i) => {
        for (let q = 0; q < 5; q++) { const ang = Math.PI * (1.1 + q * 0.2), d = 2 + a * 0.9; icePlate(E.x + Math.cos(ang) * d, E.y + 2 + Math.sin(ang) * d + 0.08 * a * a, 1, fade(a, 16, 5)); }
        crown(E.x, E.y + 4, a, 14, FLOE.white, FLOE.light, 6);
      }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Sleet Drift: sleet drives down slantwise over every foe, and a crust of ice spreads along the ground under them.
  freezeover: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, hit - 2, r.end, 6);
      for (const E of r.to) { const w = Math.round(14 * ease(prog(t, hit - 2, hit + 8))); if (w > 0) { dither(E.x - w, E.y + 4, 2 * w + 1, 2, FLOE.white, L); dither(E.x - w, E.y + 6, 2 * w + 1, 1, FLOE.light, L); for (let i = -w; i <= w; i += 5) px(E.x + i, E.y + 5, FLOE.blue, L); } }
    },
    front(r) {
      const t = r.t, L = hold(t, 0, hitOf(r) + 10, 5);
      for (const E of r.to) for (let q = 0; q < 10; q++) { const k = (t * 2 + q * 5) % 24, x = E.x - 12 + ((q * 7) % 24) + k * 0.5; line(x, E.y - 20 + k, x + 1, E.y - 18 + k, q % 3 ? FLOE.light : W, L); }
      flights(r, p => splinter(p.x, p.y, p.ux, p.uy, 4));
      landings(r, 18, (E, a, i) => { if (i % 2 === 0) rime(E, a, 18, r.seed + i, 6, 9); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, FLOE.light, 1.2 * hold(r.t, hitOf(r) - 6, r.end, 6), 14)); },
  },

  // ---------------- Squall
  // Rain Shot: sheets of rain drive sideways through the foes, and each splashes twice.
  gust: {
    noFlights: true, noLandings: true,
    front(r) {
      const dir = face(r);
      flights(r, p => { for (let q = 0; q < 3; q++) line(p.x - dir * q * 3, p.y - 3 + q * 2, p.x - dir * (q * 3 + 4), p.y - 4 + q * 2, q === 1 ? SQUALL.white : SQUALL.rain, 1); });
      landings(r, 16, (E, a) => { crown(E.x - 2, E.y + 4, a, 12, SQUALL.white, SQUALL.rain, 5); crown(E.x + 3, E.y + 4, a - 4, 12, SQUALL.white, SQUALL.rain, 5); });
    },
  },

  // Flatten: a cloud over the foe drives its rain straight down, and two sheets of it press the foe flat into a wide puddle.
  sheets: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => { const w = Math.round(4 + 8 * out(prog(a, 0, 8))); oval(E.x, E.y + 5, w, 1, SQUALL.rain, fade(a, 22, 6)); px(E.x - w + 2, E.y + 4, SQUALL.white, fade(a, 22, 6)); }); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), C = { x: E.x, y: Math.max(8, E.y - 13) }, L = hold(t, 0, hit + 8, 4);
      cloud(C.x, C.y, 8, L);
      if (t < hit + 4) for (let q = 0; q < 7; q++) { const k = (t * 3 + q * 5) % (E.y - C.y); line(C.x - 6 + q * 2, C.y + 3 + k, C.x - 6 + q * 2, C.y + 5 + k, q % 3 ? SQUALL.rain : SQUALL.white, L); }
      landings(r, 10, (P, a, i) => { if (i % 2) return; const y = P.y - 6 + Math.min(8, a * 3); line(P.x - 6, y, P.x + 6, y, SQUALL.white, fade(a, 10, 4)); line(P.x - 5, y - 2, P.x + 5, y - 2, SQUALL.rain, fade(a, 10, 4)); });
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Run Ahead: wind runs ahead of it in gusts, a small cloud gathers over it, and it streams off light on its feet.
  bluster: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      flights(r, p => { line(p.x, p.y - 2, p.x - dir * 6, p.y - 2, SQUALL.white, 1); arc(p.x + dir, p.y - 3, 2, 2, SQUALL.rain, 1, dir > 0 ? 0.75 : 0.25, dir > 0 ? 1.25 : 0.75); });
      const L = hold(t, hit - 4, r.end, 4);
      if (L > 0) { const cy = Math.max(10, U.y - 9); cloud(U.x, cy, 5, L); sideRain(U.x, cy + 2, 4, 6, t, dir, 0.5 * L, 4); }
      landings(r, 16, (E, a) => { for (let q = 0; q < 3; q++) { const n = 3 + ((a >> 1) + q) % 4; line(E.x - dir * 6, E.y - 2 + q * 2, E.x - dir * (6 + n), E.y - 2 + q * 2, q === 1 ? SQUALL.white : SQUALL.rain, fade(a, 16, 5)); } });
    },
  },

  // Cloudburst: a dark cloud gathers over the foe and bursts, and six heavy drops hit it one after another.
  cloudburst: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { landings(r, 16, (E, a, i) => { if (i === 0) ringOut(E.x, E.y + 4, a, 16, SQUALL.white, 14, 0.3, SQUALL.rain); }); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), C = { x: E.x, y: Math.max(8, E.y - 13) }, L = hold(t, 0, r.end - 6, 6);
      cloud(C.x, C.y, 4 + 6 * ease(prog(t, 0, 10)), L);
      sideRain(E.x, C.y + 3, 9, E.y - C.y, t, 0, 0.75 * hold(t, 10, hit + 14, 4), 7);
      flights(r, p => { line(p.x, p.y - 4, p.x, p.y - 1, SQUALL.rain, 1); bead(p.x, p.y, SQUALL.white, SQUALL.rain); });
      landings(r, 12, (P, a, i) => crown(P.x + (i % 3 - 1) * 3, P.y + 4, a, 12, SQUALL.white, SQUALL.rain, 5), 3);
    },
    scene(r) { return { jolt: jolts(r, 1, 4), dark: 0.25 * hold(r.t, 4, hitOf(r) + 10, 6) }; },
    lights(r) { return [lit(aim(r), SQUALL.rain, 1.2 * hold(r.t, hitOf(r), r.end, 5), 14)]; },
  },

  // ---------------- Vuoksho
  // Wave Front: a low wave runs ahead of it along the ground the wrong way and breaks on the foe in mint foam.
  surge: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), go = leaveOf(r), E = aim(r), S = r.from, dir = Math.sign(E.x - S.x) || 1, u = prog(t, go - 2, hit);
      if (t < hit + 2 && u > 0) boreWave(S.x + (E.x - S.x) * u, S.y + 5 + (E.y - S.y) * u, 3 + Math.round(2 * u), dir, t, 1, 8);
    },
    front(r) { flights(r, p => bead(p.x, p.y, BORE.foam, BORE.mint, 1, BORE.blue)); landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 16, BORE.foam, BORE.mint, 7, 1.2), 2); },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Draw Back: the wave runs out over the foes and draws back, and mint flecks of what it took run home with it.
  crest: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, f = r.flights[0];
      if (!f) return;
      const S = r.from, E = aim(r), dir = Math.sign(E.x - S.x) || 1, u = prog(t, f.t0, f.t0 + f.dur), v = u < 0.5 ? ease(u * 2) : 1 - ease((u - 0.5) * 2);
      if (u > 0 && u < 1) boreWave(S.x + (E.x - S.x) * v, S.y + 5 + (E.y - S.y) * v, 4, u < 0.5 ? dir : -dir, t, 1, 8);
    },
    front(r) {
      flights(r, p => bead(p.x, p.y, BORE.foam, BORE.mint, 1, BORE.blue));
      landings(r, 18, (E, a) => { crown(E.x, E.y + 4, a, 12, BORE.foam, BORE.mint, 5); takeBack(E, r.from, a - 2, 14, 3, BORE.mint); });
    },
  },

  // Overtop: a tall wave full of pebbles runs in, its crest curls over the foe, and it shoves the foe out.
  runup: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), go = leaveOf(r), E = aim(r), S = r.from, dir = Math.sign(E.x - S.x) || 1, u = prog(t, go - 2, hit);
      if (t < hit + 3 && u > 0) boreWave(S.x + (E.x - S.x) * u, S.y + 5 + (E.y - S.y) * u, 4 + Math.round(5 * u), dir, t, 1, 12);
    },
    front(r) {
      flights(r, p => blit(['lb', 'bd'], p.x, p.y, { l: BORE.foam, b: '#8a8a90', d: BORE.dark }, 1));
      landings(r, 16, (E, a) => { const dir = Math.sign(E.x - r.from.x) || 1; if (a < 8) { arc(E.x - dir * 2, E.y - 4, 6, 5, BORE.foam, 1 - a / 8, dir > 0 ? 0.5 : 0, dir > 0 ? 1 : 0.5); arc(E.x - dir * 2, E.y - 3, 5, 4, BORE.mint, 1 - a / 8, dir > 0 ? 0.55 : 0.05, dir > 0 ? 0.95 : 0.45); } streaks(E.x, E.y, a, 14, dir, BORE.foam, 3); crown(E.x, E.y + 4, a, 14, BORE.foam, BORE.blue, 6); }, 3);
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // Spring Bore: water piles up behind Vuoksho, then a long tall bore runs the wrong way across the field and breaks over every foe.
  boretide: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), go = leaveOf(r), S = r.from, dir = face(r);
      if (t < go) boreWave(S.x - dir * 6, S.y + 5, Math.round(2 + 5 * prog(t, 0, go)), dir, t, 1, 10);
      for (const E of r.to) { const u = prog(t, go - 2, hit); if (t < hit + 3 && u > 0) boreWave(S.x + (E.x - S.x) * u, S.y + 5 + (E.y - S.y) * u, 7 + Math.round(4 * u), dir, t, 1, 18); }
    },
    front(r) {
      flights(r, p => bead(p.x, p.y - 3, BORE.foam, BORE.mint, 1, BORE.blue));
      landings(r, 20, (E, a, i) => { crown(E.x, E.y + 4, a, 18, BORE.foam, BORE.mint, 8, 1.4); if (i === 0) ringOut(E.x, E.y + 4, a, 20, BORE.foam, 16, 0.3, BORE.mint); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, BORE.mint, 1.3 * hold(r.t, hitOf(r) - 4, hitOf(r) + 16, 4), 14)); },
  },

  // ---------------- Suomizu
  // Brine Spit: a glob of green brine flies at the foe, runs down it, and dries round it in a rim of white salt.
  sting: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => { if (a > 6) saltPan(E.x, E.y + 4, Math.min(6, a - 6), fade(a, 22, 6), r.seed); }); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [BRINE.salt, BRINE.green, BRINE.olive]); brineGlob(p.x, p.y); });
      landings(r, 18, (E, a) => { for (let q = 0; q < 4; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 12) px(E.x - 4 + q * 3, E.y - 3 + aa * 0.7, q % 2 ? BRINE.green : BRINE.olive, 1 - aa / 12); } sparks(E.x, E.y, a, 5, r.seed, BRINE.salt, 6, 5); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Salt Rime: salt crystals circle Suomizu and crust its edges in white plates that glint.
  crust: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { blit(['ws', 'sb'], p.x, p.y, { w: W, s: BRINE.salt, b: BRINE.brown }, 1); });
      landings(r, 24, (E, a) => {
        const L = fade(a, 24, 6);
        for (let q = 0; q < 8; q++) { if (a < q) continue; const ang = q / 8 * Math.PI * 2, x = E.x + Math.cos(ang) * 6, y = E.y + Math.sin(ang) * 5; dither(Math.round(x), Math.round(y), 2, 1, BRINE.salt, L); px(x, y + 1, BRINE.brown, L); if (((a + q * 3) % 8) < 2) px(x, y - 1, W, L); }
      });
    },
  },

  // Brine Flood: green brine floods along the ground under the foes and dries into a salt pan that holds their feet.
  pickle: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, leaveOf(r), r.end, 6);
      for (const E of r.to) { const w = Math.round(13 * ease(prog(t, leaveOf(r), hit + 4))), dry = prog(t, hit + 6, hit + 16); if (w > 0) { if (dry < 1) dither(E.x - w, E.y + 4, 2 * w + 1, 2, BRINE.green, L * (1 - dry)); saltPan(E.x, E.y + 4, w, L * dry, r.seed); } }
    },
    front(r) {
      flights(r, p => bead(p.x, p.y + 2, BRINE.salt, BRINE.green, 1, BRINE.olive));
      landings(r, 16, (E, a, i) => { for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa >= 0 && aa < 10) px(E.x - 3 + q * 3 + i, E.y - 4 + aa * 0.8, BRINE.green, 1 - aa / 10); } });
    },
  },

  // Dry Up: heat shimmers round the foe, its water steams off, salt rises out of it in crystals, and the ground dries to a pan.
  evaporate: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, r.end, 6);
      saltPan(E.x, E.y + 4, Math.round(12 * ease(prog(t, hit - 4, hit + 10))), L, r.seed);
      for (let q = 0; q < 4; q++) { const y = E.y + 2 - ((t + q * 5) % 18); for (let x = -6; x <= 6; x += 2) px(E.x + x + Math.round(Math.sin((x + t + q * 3) / 2)), y, BRINE.salt, 0.5 * L); }
    },
    front(r) {
      flights(r, p => { blit(['ws', 'sb'], p.x, p.y, { w: W, s: BRINE.salt, b: BRINE.brown }, 1); tail(p.x, p.y, p.ux, p.uy, [BRINE.salt, BRINE.green]); });
      landings(r, 20, (E, a) => { for (let q = 0; q < 3; q++) fogPuffOf(E.x - 5 + q * 5, E.y - 4 - a * 0.5 - q, 2 + a * 0.15, BRINE.salt, '#b8b4a8', fade(a, 20, 8)); sparks(E.x, E.y, a, 6, r.seed, BRINE.green, 8, 7); }, 3);
    },
    scene(r) { return { jolt: jolts(r, 1, 6), glare: (r.t - hitOf(r)) >= 0 && (r.t - hitOf(r)) < 2 ? 0.25 : 0 }; },
    lights(r) { return [lit(aim(r), BRINE.green, 1.2 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Pyoruzu
  // Dizzy Wave: drops spiral in, a whirl opens at each foe's feet, and a small whirl spins over its head.
  whirl: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => whirl(E.x, E.y + 4, 8, a * 0.5, fade(a, 18, 6), 0.35)); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [EDDY.white, EDDY.blue]); bead(p.x, p.y, EDDY.white, EDDY.blue, 1, EDDY.deep); });
      landings(r, 18, (E, a) => whirl(E.x, E.y - 7, 3, -a * 0.6, fade(a, 18, 6), 0.5));
    },
  },

  // Spin Bolt: a disc of turning water spins off it like a wheel, cracks into the foe, and leaves it reeling.
  turn: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, EDDY.blue, K, 8, r.seed), 2); },
    front(r) {
      flights(r, p => { whirl(p.x, p.y, 3, p.a * 0.9, 1, 1); arc(p.x, p.y, 4, 4, EDDY.white, 1); });
      landings(r, 18, (E, a) => { sparks(E.x, E.y, a, 6, r.seed, EDDY.blue, 6, 6); daze(E, a, 18, EDDY.blue, EDDY.white); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Hand Round: a whirl turns under Pyoruzu, two drops circle it, and the ally comes in on the turn in a ring of spray.
  exchange: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; whirl(U.x, U.y + 5, 6 + 3 * prog(t, 0, hitOf(r)), t * 0.4, hold(t, 0, r.end, 5), 0.35); },
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, hitOf(r) + 2, 3);
      for (let q = 0; q < 2; q++) { const a = t * 0.35 + q * Math.PI; bead(U.x + Math.cos(a) * 8, U.y + Math.sin(a) * 4, EDDY.white, EDDY.blue, L, EDDY.deep); }
      landings(r, 14, (E, a) => { ringOut(E.x, E.y, a, 14, EDDY.white, 11, 0.8, EDDY.blue); motes(E.x, E.y, a, 14, 4, r.seed, [EDDY.white, EDDY.blue], 6, 10); });
    },
  },

  // Whirlpool: a great whirlpool opens on the ground under the reserve it drags in, drops spiral into its dark middle, and it reels.
  maelstrom: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, hit));
      oval(E.x, E.y + 5, 4 * g, 1.2 * g, EDDY.deep, L);
      whirl(E.x, E.y + 5, 6 + 9 * g, t * (0.2 + 0.3 * g), L, 0.35);
      whirl(E.x, E.y + 5, 4 + 6 * g, t * (0.2 + 0.3 * g) + 1, L, 0.35);
    },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [EDDY.white, EDDY.blue]); bead(p.x, p.y, EDDY.white, EDDY.blue, 1, EDDY.deep); });
      landings(r, 20, (E, a, i) => { crown(E.x, E.y + 4, a, 16, EDDY.white, EDDY.blue, 8); if (i === 0) whirl(E.x, E.y - 7, 3, -a * 0.6, fade(a, 20, 6), 0.5); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(aim(r), EDDY.blue, 1.3 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Yabuko
  // Roll Across: it balls up and rolls, three buckthorn twigs fly, and they rake the foe with thorns and spill berries.
  snag: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < hitOf(r)) hedgeBall(U.x, U.y - 7, 3, t * 0.5, hold(t, 0, hitOf(r), 3));
      flights(r, p => twig(p.x, p.y, p.ux, p.uy, 6));
      landings(r, 14, (E, a) => {
        const n = Math.min(1, (a + 1) / 3), L = fade(a, 14, 5);
        thick(E.x + 6, E.y - 5, E.x + 6 - 12 * n, E.y - 5 + 10 * n, HEDGE.pale, L, HEDGE.berry);
        chunks(E.x, E.y, a, 4, r.seed, [HEDGE.berry, HEDGE.leaf], 0.9, 14);
      }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Bristle Up: twigs circle it, then thorns stand out all round it, hung with berries, and it holds them out.
  bristle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      flights(r, p => twig(p.x, p.y, p.ux, p.uy, 4));
      const L = hold(t, hit - 1, r.end, 4), g = ease(prog(t, hit - 1, hit + 5));
      if (L > 0) for (let q = 0; q < 10; q++) {
        const a = q / 10 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r0 = 5, r1 = 5 + 4 * g;
        line(U.x + c * r0, U.y + s * r0 * 0.9, U.x + c * r1, U.y + s * r1 * 0.9, HEDGE.twig, L);
        px(U.x + c * r1, U.y + s * r1 * 0.9, q % 3 ? HEDGE.pale : HEDGE.berry, L);
      }
      landings(r, 12, (E, a) => ringOut(E.x, E.y, a, 12, HEDGE.leaf, 12, 0.85));
    },
  },

  // Catch a Sleeve: a thorny branch grows out across to the foe and hooks it, and holds on.
  tangle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r), L = hold(t, go, r.end, 5), u = prog(t, go, hit);
      if (L > 0) {
        const n = Math.round(Math.hypot(E.x - U.x, E.y - U.y) * u);
        for (let i = 0; i <= n; i++) { const v = i / Math.max(1, Math.hypot(E.x - U.x, E.y - U.y)), p = sagAt(U, E, v, 5); px(p.x, p.y, HEDGE.twig, L); if (i % 4 === 2) px(p.x, p.y - 1, i % 8 === 2 ? HEDGE.leaf : HEDGE.berry, L); }
      }
      landings(r, 18, (P, a) => { arc(P.x, P.y, 4, 4, HEDGE.twig, fade(a, 18, 6), 0.1, 0.7); px(P.x + 3, P.y + 3, HEDGE.pale, fade(a, 18, 6)); });
    },
  },

  // Hedge Fall: a hedge grows up tall behind every foe, bristling with berries, and topples onto them.
  overgrow: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), dir = face(r);
      for (const E of r.to) {
        const up = ease(prog(t, 0, hit - 6)), fall = prog(t, hit - 6, hit), h = Math.round(16 * up * (1 - fall * 0.7)), x0 = E.x + dir * (6 - fall * 6), foot = E.y + 5;
        if (t < hit + 2 && h > 0) for (let i = -6; i <= 6; i++) { const hh = h - (Math.abs(i) > 4 ? 2 : 0) - ((i + 7) % 3 === 0 ? 1 : 0); dither(x0 + i, foot - hh, 1, hh, (i & 1) ? HEDGE.dark : HEDGE.leaf, 1); if (((i * 5) & 7) === 3) px(x0 + i, foot - hh + 2, HEDGE.berry, 1); }
      }
    },
    front(r) {
      flights(r, p => twig(p.x, p.y, p.ux, p.uy, 5));
      landings(r, 18, (E, a, i) => { chunks(E.x, E.y - 2, a, 5, r.seed + i, [HEDGE.berry, HEDGE.leaf, HEDGE.pale], 1.1, 18); const n = Math.min(1, (a + 1) / 3); thick(E.x - 7, E.y - 6, E.x - 7 + 14 * n, E.y - 6 + 11 * n, HEDGE.pale, fade(a, 12, 5), HEDGE.berry); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, HEDGE.berry, 1.2 * hold(r.t, hitOf(r) - 2, hitOf(r) + 14, 4), 14)); },
  },

  // ---------------- Sienoko
  // Spore Gust: pale spores drift over in waves, burst on the foe, and a small cap fruits at its feet.
  spore: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => shroom(E.x + 5, E.y + 5, Math.min(3, a >> 2), fade(a, 24, 6))); },
    front(r) {
      flights(r, p => sporeCloud(p.x, p.y, p.a, r.seed + p.f.i * 9, 3, MYCEL.white, MYCEL.tan, 1, 6));
      landings(r, 18, (E, a) => { dust(E.x, E.y + 2, a, 18, MYCEL.tan, MYCEL.white); sporeCloud(E.x, E.y - 2, a, r.seed, 6, MYCEL.white, MYCEL.tan, fade(a, 18, 6), 8); });
    },
  },

  // Push Up: white threads run out from it under the ground, and a stinkhorn pushes up at its side.
  flush: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, hit = hitOf(r), X = { x: S.x + face(r) * 12, y: S.y + 5 }, L = hold(t, 0, r.end, 5);
      threads({ x: S.x, y: S.y + 5 }, X, prog(t, 0, hit - 4), r.seed, L);
      shroom(X.x, X.y, Math.round(6 * ease(prog(t, hit - 4, hit + 2))), L, 1);
      if (t >= hit) px(X.x, X.y - 7, MYCEL.brown, L);
    },
    front(r) { flights(r, p => sporeCloud(p.x, p.y, p.a, r.seed, 2, MYCEL.white, MYCEL.tan, 1, 4)); landings(r, 16, (E, a) => dust(E.x, E.y + 4, a, 16, MYCEL.tan, MYCEL.white, 2)); },
  },

  // Rot Down: threads close in on the foe from every side, and all its poison goes off at once in a cloud of brown rot.
  decompose: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), go = leaveOf(r), hit = hitOf(r), L = hold(t, go, hit + 10, 4); for (let q = 0; q < 5; q++) { const ang = q / 5 * Math.PI * 2 + 0.4; threads({ x: E.x + Math.cos(ang) * 16, y: E.y + 4 + Math.sin(ang) * 4 }, { x: E.x, y: E.y + 4 }, prog(t, go, hit), r.seed + q, L); } },
    front(r) {
      flights(r, p => { px(p.x, p.y, MYCEL.white); tail(p.x, p.y, p.ux, p.uy, [MYCEL.tan, MYCEL.brown]); });
      landings(r, 20, (E, a) => { for (let q = 0; q < 3; q++) fogPuffOf(E.x - 4 + q * 4, E.y - 1 - a * 0.4 - (q % 2) * 2, 2 + a * 0.12, MYCEL.brown, MYCEL.rot, fade(a, 20, 8)); sporeCloud(E.x, E.y, a, r.seed, 5, MYCEL.tan, MYCEL.white, fade(a, 20, 6), 6); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Through Roots: it stamps, white threads spread under the whole field to every foe, and mushrooms fruit round each one.
  mycorrhiza: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, go = leaveOf(r), hit = hitOf(r), L = hold(t, 0, r.end, 6);
      for (const E of r.to) for (let q = 0; q < 2; q++) threads({ x: S.x, y: S.y + 5 + q * 2 }, { x: E.x + (q ? 7 : -7), y: E.y + 5 + q }, prog(t, go - 4, hit), r.seed + q * 5, 0.75 * L);
      for (const E of r.to) for (let q = 0; q < 4; q++) shroom(E.x - 9 + q * 6, E.y + 5 + (q % 2), Math.round((2 + q % 3) * ease(prog(t, hit + q * 2, hit + q * 2 + 6))), hold(t, hit, r.end, 5), q % 2 ? 1 : 2);
    },
    front(r) {
      flights(r, p => sporeCloud(p.x, p.y + 3, p.a, r.seed + p.f.i, 2, MYCEL.white, MYCEL.tan, 1, 3));
      landings(r, 20, (E, a, i) => { if (i % 2) return; sporeCloud(E.x, E.y - 2, a, r.seed + i, 8, MYCEL.white, MYCEL.tan, fade(a, 20, 8), 10); dust(E.x, E.y + 4, a, 16, MYCEL.tan, MYCEL.white, 3, 6); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, MYCEL.white, 1.1 * hold(r.t, hitOf(r), r.end, 5), 12)); },
  },

  // ---------------- Gobonen
  // Hook On: it lunges, two burrs fly and hook into the foe with a rake of their spines, and they stay stuck.
  catch: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, BURR.brown, BURR.dark); },
    front(r) {
      flights(r, p => burrBall(p.x, p.y, 1, p.a * 0.4));
      landings(r, 28, (E, a, i) => {
        burrStuck(E.x + (i ? 4 : -4), E.y - 2 + i * 3, fade(a, 28, 6));
        if (a < 10) for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 4 + q * 3 - 3 * n, E.y - 5 + 9 * n, q === 1 ? BURR.orange : BURR.tan, 1 - a / 10); }
      }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Seed Burst: Gobonen flares and bursts, its burrs sweep through the foes, and one sticks on each as it bleeds.
  prickle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      if (t < go + 3) burrBall(U.x, U.y, 3 + Math.min(2, t >> 2), t * 0.2, hold(t, 0, go + 3, 2));
      flights(r, p => burrBall(p.x, p.y, 1, p.a * 0.5));
      landings(r, 26, (E, a, i) => { if (i % 6) return; burrStuck(E.x + 3, E.y - 3, fade(a, 26, 6)); bleed(E, a, 14, 3, r.seed + i, BURR.blood); line(E.x + 5, E.y - 5, E.x + 5 - 10 * Math.min(1, (a + 1) / 3), E.y - 5 + 9 * Math.min(1, (a + 1) / 3), BURR.orange, fade(a, 10, 4)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Hitch a Ride: it hops, its hooks stand out ready, and it streams off quick with glints on its hook tips.
  hitch: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      flights(r, p => burrStuck(p.x, p.y - 5, 1));
      const L = hold(t, hit - 2, r.end, 4);
      if (L > 0) { burrBall(U.x, U.y - 1, 3, t * 0.15, 0.75 * L); for (let q = 0; q < 3; q++) { const n = 3 + (((t - hit) >> 1) + q) % 4; line(U.x - dir * 6, U.y - 2 + q * 2, U.x - dir * (6 + n), U.y - 2 + q * 2, q === 1 ? BURR.orange : BURR.tan, L); } }
      landings(r, 12, (E, a) => { for (let q = 0; q < 4; q++) { const ang = q * 1.57 + 0.6; if (((a + q) % 4) < 2) px(E.x + Math.cos(ang) * 6, E.y + Math.sin(ang) * 5, W, fade(a, 12, 4)); } });
    },
  },

  // Drag Along: Gobonen swells with hooks, hooked lines close round the foe it drags in, and burrs catch all over it.
  burstpod: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => { for (let q = 0; q < 4; q++) { const x = E.x - 6 + q * 4; line(x, E.y + 5, x + (q % 2 ? 1 : -1), E.y + 3, BURR.dark, fade(a, 26, 6)); px(x + (q % 2 ? 1 : -1), E.y + 2, BURR.orange, fade(a, 26, 6)); } }); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      if (t < go + 2) burrBall(U.x, U.y, 3 + prog(t, 0, go) * 2, t * 0.3, 1);
      flights(r, p => { line(p.x, p.y, p.x - p.ux * 5, p.y - p.uy * 5, BURR.tan, 1); px(p.x, p.y, BURR.orange); px(p.x - p.uy, p.y + p.ux, BURR.orange); });
      landings(r, 24, (E, a, i) => {
        if (i === 0) for (let q = 0; q < 5; q++) if (a >= q) burrStuck(E.x + Math.cos(q * 1.26) * 5, E.y + Math.sin(q * 1.26) * 4, fade(a, 24, 6));
        if (i === 0 && a < 10) for (let q = 0; q < 3; q++) line(E.x - 5 + q * 4, E.y - 6, E.x - 7 + q * 4, E.y + 4 * Math.min(1, (a + 1) / 3), BURR.orange, 1 - a / 10);
        if (i === 0) daze(E, a, 24, BURR.orange, BURR.tan);
      }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(aim(r), BURR.orange, 1.2 * hold(r.t, hitOf(r) - 4, hitOf(r) + 14, 4), 12)]; },
  },

  // ---------------- Tarhaju
  // Ripe Fruit: a blossoming bough reaches over the ally, two pears drop to it, and one stays at its feet.
  pick: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, hit + 8, 4), B = { x: E.x, y: Math.max(10, E.y - 13) };
      bough(B.x, B.y, 8, L, 0.6);
      for (let q = 0; q < 2; q++) { const u = prog(t, hit - 8 + q * 3, hit - 1 + q * 3); const y = B.y + 3 + (E.y + 2 - B.y - 3) * u * u; if (u < 1) pear(B.x - 3 + q * 6, y, L); }
      landings(r, 30, (P, a) => { pear(P.x + 7, P.y + 2, fade(a, 30, 6)); motes(P.x, P.y + 2, a, 16, 5, r.seed, [ORCH.pink, ORCH.cream], 6, 10); });
    },
  },

  // Hard Pips: three hard pips fly at the foe and crack on it, and a pink fleck of each goes home as a heal.
  graft: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 10, (E, a, i) => crackAt(E.x + (i - 1) * 3, E.y + 4, a, 10, ORCH.cream, K, 3, r.seed + i)); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [ORCH.cream, ORCH.bark]); blit(['.c.', 'cbb', '.b.'], p.x, p.y, { c: ORCH.cream, b: ORCH.bark }, 1); });
      landings(r, 16, (E, a, i) => { chunks(E.x, E.y + 1, a, 2, r.seed + i, [ORCH.cream, ORCH.bark], 0.8, 10); takeBack(E, r.from, a - 2, 12, 1, ORCH.pink, ORCH.cream); }, 2);
    },
    scene(r) { const a = r.t - hitOf(r), z = r.t - (r.hits[r.hits.length - 1]?.at ?? 0); return { jolt: shake(a, 3, 1) || shake(z, 3, 1) }; },
  },

  // Under Boughs: boughs spread over the ally coming in, leaves and blossom rain down on it, and a pink ring wards it.
  dropfruit: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 5), B = { x: E.x, y: Math.max(10, E.y - 13) };
      bough(B.x - 4, B.y, 7, L, 0.8); bough(B.x + 5, B.y + 2, 6, L, 0.4);
      flights(r, p => blit((p.a >> 2) & 1 ? ['pc', '.l'] : ['cp', 'l.'], p.x, p.y, { p: ORCH.pink, c: ORCH.cream, l: ORCH.leaf }, 1));
      landings(r, 16, (P, a) => { arc(P.x, P.y, 7, 6, ORCH.pink, fade(a, 16, 6)); arc(P.x, P.y, 8, 7, ORCH.cream, 0.5 * fade(a, 16, 6), 0.5, 1); });
    },
  },

  // Full Bloom: the boughs over its team burst into blossom, petals rain, the fruit swells, and pink flecks rise all round.
  harvest: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i === 0) ringOut(E.x, E.y + 4, a, 20, ORCH.pink, 14, 0.3, ORCH.cream); }); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, r.end, 6), B = { x: E.x, y: Math.max(10, E.y - 14) }, bl = prog(t, 0, hit);
      bough(B.x - 6, B.y, 8, L, bl); bough(B.x + 7, B.y + 2, 7, L, bl);
      if (t >= hit - 6) { pear(B.x - 3, B.y + 4, L); pear(B.x + 6, B.y + 6, L); }
      flights(r, p => blit((p.a >> 1) & 1 ? ['pc'] : ['cp'], p.x, p.y, { p: ORCH.pink, c: ORCH.cream }, 1));
      landings(r, 20, (P, a, i) => { if (i === 0) motes(P.x, P.y + 3, a, 20, 8, r.seed, [ORCH.pink, ORCH.cream, ORCH.leaf], 9, 14); });
    },
    lights(r) { return [lit(aim(r), ORCH.pink, 1.2 * hold(r.t, hitOf(r) - 6, r.end, 6), 14)]; },
  },

  // ---------------- Kankabu
  // Splinter Off: it lunges, two splinters of pale wood with purple bark fly off it, and they cut the foe.
  splinter: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, STUMP.gray, STUMP.purple); },
    front(r) {
      flights(r, p => { for (let i = 0; i < 6; i++) px(p.x - p.ux * i, p.y - p.uy * i, i === 0 ? W : i < 4 ? STUMP.wood : STUMP.purple); px(p.x - p.ux * 3 - p.uy, p.y - p.uy * 3 + p.ux, STUMP.purple); });
      landings(r, 14, (E, a, i) => { const n = Math.min(1, (a + 1) / 3), s = i ? -1 : 1; line(E.x + 6 * s, E.y - 5, E.x + 6 * s - 12 * s * n, E.y - 5 + 9 * n, STUMP.wood, fade(a, 10, 4)); chunks(E.x, E.y, a, 3, r.seed + i, [STUMP.wood, STUMP.purple], 0.9, 14); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Sap Rising: pale sap climbs up through Kankabu out of its rings, a shoot uncurls, and a drop gathers to keep for later.
  sap: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 5); yearRings(U.x, U.y + 5, 3, 3, L, 0.3); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), L = hold(t, 0, r.end, 5);
      for (let q = 0; q < 4; q++) { const k = (t + q * 3) % 12; if (t < hit + 6) px(U.x - 2 + q * 1.3, U.y + 4 - k, q % 2 ? STUMP.lime : W, L); }
      shoot(U.x + face(r) * 4, U.y - 3, Math.round(4 * ease(prog(t, 2, hit))), L);
      landings(r, 20, (E, a) => { const y = E.y - 6 + Math.min(6, a * 0.5); bead(E.x, y, W, STUMP.lime, fade(a, 20, 6), STUMP.lime); });
    },
  },

  // Stump Butt: it charges, a round of its own trunk flies rings first and hits like a log end, shaking the ground.
  stubborn: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, STUMP.gray, STUMP.purple); landings(r, 16, (E, a) => yearRings(E.x, E.y + 5, 3, 1 + out(a / 16) * 3, fade(a, 16, 5), 0.35), 2); },
    front(r) {
      flights(r, p => { oval(p.x, p.y, 3, 3, STUMP.wood, 1); arc(p.x, p.y, 3, 3, STUMP.purple, 1); arc(p.x, p.y, 1.5, 1.5, STUMP.purple, 1); px(p.x, p.y, STUMP.dark, 1); });
      landings(r, 16, (E, a) => { chunks(E.x, E.y + 2, a, 5, r.seed, [STUMP.wood, STUMP.purple, STUMP.gray], 1, 16, 2); }, 3);
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // New Growth: year rings spread out over the ground from Kankabu, one a beat, and lime shoots spring up all round it.
  heartwood: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      const n = Math.min(5, 1 + Math.floor(t / 5));
      yearRings(U.x, U.y + 5, n, 2.5, L, 0.3);
      for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.5; shoot(U.x + Math.cos(ang) * 11, U.y + 5 + Math.sin(ang) * 3, Math.round(6 * ease(prog(t, hit - 4 + q, hit + 4 + q))), L); }
    },
    front(r) {
      flights(r, p => blit(['.l', 'l.'], p.x, p.y, { l: STUMP.lime }, 1));
      landings(r, 20, (E, a) => { ringOut(E.x, E.y, a, 20, STUMP.lime, 12, 0.8, STUMP.purple); motes(E.x, E.y + 3, a, 20, 6, r.seed, [STUMP.lime, W], 7, 12); });
    },
    lights(r) { return [lit(r.from, STUMP.lime, 1.2 * hold(r.t, hitOf(r) - 4, r.end, 6), 14)]; },
  },

  // ---------------- Tuhkori
  // Eye Dust: puffs of spores fly at the foe, go off in its face, and leave it seeing stars.
  toxicpuff: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { fogPuffOf(p.x, p.y, 2, PUFF.spore, PUFF.dust, 1); px(p.x - 1, p.y - 1, PUFF.white); });
      landings(r, 18, (E, a, i) => { if (i) return; fogPuffOf(E.x, E.y - 2 - a * 0.2, 2 + 3 * out(prog(a, 0, 10)), PUFF.spore, PUFF.dust, fade(a, 18, 8)); sporeCloud(E.x, E.y - 2, a, r.seed, 6, PUFF.spore, PUFF.white, fade(a, 18, 6), 6); daze(E, a, 18, PUFF.red, PUFF.white); });
    },
  },

  // Plant a Cap: a little red cap lobs over and plants itself in the ground by the foe with a puff of spores.
  setcap: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 34, (E, a, i) => { const x = E.x + (i ? -7 : 7), up = Math.min(2, a >> 1); redCap(x, E.y + 3 - up, 2, fade(a, 34, 6), up); }); },
    front(r) {
      flights(r, p => redCap(p.x, p.y, 2, 1));
      landings(r, 16, (E, a, i) => { const x = E.x + (i ? -7 : 7); fogPuffOf(x, E.y + 2 - a * 0.3, 1.5 + a * 0.2, PUFF.spore, PUFF.dust, fade(a, 16, 6)); });
    },
  },

  // Roll Away: it spins and rolls off quick, leaving a trail of spores behind it.
  dust: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r), L = hold(t, 0, r.end, 4);
      for (let q = 0; q < 4; q++) { const k = (t + q * 4) % 16; fogPuffOf(U.x - dir * (4 + k), U.y + 3 - k * 0.3, 1 + k * 0.15, PUFF.spore, PUFF.dust, L * (1 - k / 16)); }
      flights(r, p => redCap(p.x, p.y - 6, 1, 1));
      landings(r, 16, (E, a) => { for (let q = 0; q < 3; q++) { const n = 3 + ((a >> 1) + q) % 4; line(E.x - dir * 6, E.y - 2 + q * 2, E.x - dir * (6 + n), E.y - 2 + q * 2, q === 1 ? PUFF.white : PUFF.spore, fade(a, 16, 5)); } });
    },
  },

  // Ring of Caps: Tuhkori stamps, and a ring of red caps pushes up round the foe's side and puffs spores as each one opens.
  fairyring: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      for (const E of r.to) for (let q = 0; q < 7; q++) {
        const ang = q / 7 * Math.PI * 2, x = E.x + Math.cos(ang) * 12, y = E.y + 5 + Math.sin(ang) * 3, up = ease(prog(t, hit - 6 + q, hit + q));
        if (up > 0) redCap(x, y - Math.round(2 * up), 1 + up, L, Math.round(2 * up));
      }
    },
    front(r) {
      flights(r, p => sporeCloud(p.x, p.y, p.a, r.seed + p.f.i, 2, PUFF.spore, PUFF.white, 1, 3));
      landings(r, 20, (E, a, i) => { if (i % 2) return; for (let q = 0; q < 4; q++) fogPuffOf(E.x - 9 + q * 6, E.y + 1 - a * 0.3, 1.5 + a * 0.15, PUFF.spore, PUFF.dust, fade(a, 20, 8)); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, PUFF.red, 1.1 * hold(r.t, hitOf(r) - 6, r.end, 6), 14)); },
  },

  // ---------------- Ibabus
  // Briar Sweep: a long briar cane whips round through every foe, its red thorns raking them.
  lash: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), hit = hitOf(r), dir = face(r);
      const sw = prog(t, go - 2, hit + 4), L = hold(t, go - 2, hit + 8, 3);
      if (L > 0) { const ang = (dir > 0 ? -1.4 : Math.PI + 1.4) + dir * sw * 1.8, tip = { x: U.x + Math.cos(ang) * 22, y: U.y + Math.sin(ang) * 16 }; cane(U, tip, -4 * dir, 1, L); }
      flights(r, p => { px(p.x, p.y, BRIAR.red); px(p.x - p.ux, p.y - p.uy, BRIAR.green); });
      landings(r, 14, (E, a, i) => { const n = Math.min(1, (a + 1) / 3); line(E.x + 6, E.y - 4, E.x + 6 - 12 * n, E.y - 4 + 8 * n, BRIAR.red, fade(a, 10, 4)); bleed(E, a, 14, 2, r.seed + i); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Snag Cane: it lunges, two canes snag the foe and drag across it, and it bleeds.
  creep: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, BRIAR.green, BRIAR.dark); },
    front(r) {
      flights(r, p => cane({ x: p.x - p.ux * 8, y: p.y - p.uy * 8 }, p, 0, 1, 1));
      landings(r, 16, (E, a, i) => { const n = Math.min(1, (a + 1) / 3), s = i ? -1 : 1; thick(E.x + 6 * s, E.y - 5, E.x + 6 * s - 12 * s * n, E.y - 5 + 10 * n, BRIAR.red, fade(a, 10, 4), BRIAR.green); bleed(E, a, 16, 3, r.seed + i); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Reel In: a cane shoots out, hooks the reserve it drags in, and reels it in as it rakes it.
  ripout: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r);
      const u = t < hit ? prog(t, go, hit) : 1 - 0.4 * prog(t, hit + 2, hit + 12), L = hold(t, go, hit + 14, 3);
      if (L > 0) cane(U, { x: U.x + (E.x - U.x) * u, y: U.y + (E.y - U.y) * u }, 4, 1, L);
      landings(r, 14, (P, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(P.x - 4 + q * 3, P.y - 5, P.x - 6 + q * 3, P.y - 5 + 9 * n, q === 1 ? BRIAR.red : BRIAR.light, fade(a, 14, 5)); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Tear Free: canes close round the foe from every side and wrap it, then tear free all at once in a burst of red.
  thornwall: {
    lead: 6, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), go = leaveOf(r), hit = hitOf(r), a = t - hit;
      for (let q = 0; q < 6; q++) {
        const ang = q / 6 * Math.PI * 2 + 0.3, far = { x: E.x + Math.cos(ang) * 20, y: E.y + Math.sin(ang) * 13 };
        if (t < hit) cane(far, E, 3 * (q % 2 ? 1 : -1), prog(t, go - 6, hit), 1);
        else if (a < 12) { const u = out(prog(a, 0, 12)); cane({ x: E.x + Math.cos(ang) * 4, y: E.y + Math.sin(ang) * 3 }, { x: E.x + Math.cos(ang) * (6 + 14 * u), y: E.y + Math.sin(ang) * (5 + 9 * u) }, 0, 1, 1 - a / 12); }
      }
      landings(r, 20, (P, a2, i) => { if (i) return; sparks(P.x, P.y, a2, 10, r.seed, BRIAR.red, 10, 10); bleed(P, a2, 20, 5, r.seed); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0, glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
    lights(r) { return [lit(aim(r), BRIAR.red, 1.4 * hold(r.t, hitOf(r) - 2, hitOf(r) + 14, 4), 12)]; },
  },

  // ---------------- Myroku
  // Bitter Dose: its cracked cup tips toward the foe, two green drops fly, the dose runs down it, and a white fleck comes home.
  dose: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), dir = face(r), L = hold(t, 0, go + 8, 3);
      cup(U.x + dir * 2, U.y - 8, L, prog(t, 2, go), dir);
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [CUP.dose, CUP.green]); bead(p.x, p.y, CUP.white, CUP.dose, 1, CUP.green); });
      landings(r, 18, (E, a, i) => { bleed(E, a, 14, 3, r.seed + i, CUP.dose); if (i === 0) takeBack(E, r.from, a - 4, 14, 2, CUP.white, CUP.lav); }, 2);
    },
  },

  // Sleeping Cup: the cup is offered, a lavender bubble floats over the foe and pops, and it nods off.
  draught: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), dir = face(r);
      cup(U.x + dir * 6, U.y - 2, hold(t, 0, go + 6, 3), 0, dir);
      flights(r, p => { arc(p.x, p.y, 2, 2, CUP.sleep, 1); px(p.x - 1, p.y - 1, W); });
      landings(r, 24, (E, a) => {
        if (a < 4) for (let q = 0; q < 4; q++) px(E.x + Math.cos(q * 1.57) * (2 + a), E.y - 7 + Math.sin(q * 1.57) * (2 + a), CUP.sleep, 1 - a / 4);
        for (let q = 0; q < 2; q++) { const k = (a + q * 10) % 20; if (a >= 3 + q * 4) blit(['zzz', '.z.', 'zzz'], E.x + 4 + k * 0.3, E.y - 6 - k * 0.4, { z: CUP.sleep }, fade(a, 24, 6)); }
      });
    },
  },

  // Spilled Cup: the cup tips over and its green dose spills along the ground under every foe and drips off them.
  wilt: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, hit = hitOf(r); for (const E of r.to) { const w = Math.round(12 * ease(prog(t, leaveOf(r), hit + 4))); if (w > 0) { dither(E.x - w, E.y + 4, 2 * w + 1, 2, CUP.green, hold(t, leaveOf(r), r.end, 6)); dither(E.x - w + 2, E.y + 4, 2 * w - 3, 1, CUP.dose, hold(t, leaveOf(r), r.end, 6)); } } },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), dir = face(r);
      cup(U.x + dir * 4, U.y - 7, hold(t, 0, go + 6, 3), 1, dir);
      flights(r, p => bead(p.x, p.y + 2, CUP.white, CUP.dose, 1, CUP.green));
      landings(r, 16, (E, a, i) => bleed(E, a, 12, 3, r.seed + i, CUP.dose));
    },
  },

  // Pour Out: a great cup tips over the ally coming in and pours the last of itself, and hemlock flowers open round it.
  lastcup: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), hit = hitOf(r); for (let q = 0; q < 4; q++) { const x = E.x - 9 + q * 6, L = hold(t, hit + q * 2, r.end, 5); if (L > 0) umbel(x, E.y + 1 + (q % 2), L); } },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, hit + 10, 4), C = { x: E.x + 4, y: Math.max(10, E.y - 13) };
      blit(['.wwww.', 'wggggw', 'wggggl', '.wwwl.', '..ll..'], C.x, C.y, { w: CUP.white, g: CUP.dose, l: CUP.lav }, L, 2, false, t >= hit - 6);
      if (t >= hit - 4 && t < hit + 6) for (let q = 0; q < 5; q++) px(C.x - 2 + (q % 2), C.y + 6 + ((t * 2 + q * 3) % Math.max(2, E.y - C.y - 6)), q % 2 ? CUP.white : CUP.dose, L);
      landings(r, 18, (P, a) => { ringOut(P.x, P.y, a, 18, CUP.dose, 12, 0.8, CUP.white); motes(P.x, P.y + 2, a, 18, 6, r.seed, [CUP.white, CUP.dose], 7, 12); });
    },
    lights(r) { return [lit(aim(r), CUP.dose, 1.2 * hold(r.t, hitOf(r) - 6, r.end, 6), 14)]; },
  },

  // ---------------- The Orrery
  // Set Orbit: a Planet swings once round the Orrery's ring and flies off, and a brass ring opens round the foe for it to ride.
  wind: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = userAt(r); orbitRing(U.x, U.y, 9, 4, t / 30, hold(t, 0, leaveOf(r) + 10, 4), 0); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [ORR.gold, ORR.bronze]); planet(p.x, p.y, 1, true); });
      landings(r, 26, (E, a) => { const g = out(prog(a, 0, 8)); orbitRing(E.x, E.y, 6 + 4 * g, 2 + 2 * g, a / 20, fade(a, 26, 6)); sparks(E.x, E.y, a, 6, r.seed, ORR.gold, 8, 7); }, 2);
    },
  },

  // Spin Faster: the Orrery's rings whirl round it, three cogs fly off them, and the foe's ring jerks its Planets on a step.
  unwind: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = userAt(r), L = hold(t, 0, hitOf(r) + 4, 3); orbitRing(U.x, U.y, 9, 3, t / 8, L, 2); orbitRing(U.x, U.y - 1, 6, 5, -t / 10, L, 1); },
    front(r) {
      flights(r, p => blit((p.a >> 1) & 1 ? ['.g.', 'gbg', '.g.'] : ['g.g', '.b.', 'g.g'], p.x, p.y, { g: ORR.gold, b: ORR.bronze }, 1));
      landings(r, 20, (E, a, i) => { if (i) return; orbitRing(E.x, E.y, 10, 4, 0.1 + 0.25 * out(prog(a, 0, 6)), fade(a, 20, 6), 2); ringOut(E.x, E.y, a, 12, ORR.gold, 10, 0.7); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Close Pass: two Planets swing in close round the ally on brass rings, quick, and gold glints trail them.
  tick: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 0, r.end, 4); orbitRing(E.x, E.y + 1, 10, 4, t / 14, L, 2); },
    front(r) { landings(r, 18, (E, a) => { for (let q = 0; q < 5; q++) { const ang = a * 0.25 + q * 1.26; if (((a + q) & 3) < 2) px(E.x + Math.cos(ang) * 11, E.y + 1 + Math.sin(ang) * 5, q % 2 ? ORR.gold : W, fade(a, 18, 6)); } }); },
  },

  // Comes Round: the brass sky turns over the foes, its five Planets line up, and every one of them comes down at once.
  conjunction: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      for (const E of r.to) { const C = { x: E.x, y: Math.max(12, E.y - 10) }; orbitRing(C.x, C.y, 15, 5, t / 40, L * (t < hit ? 1 : 0.5), 0); orbitRing(C.x, C.y, 10, 3, -t / 30, L * (t < hit ? 1 : 0.5), 0); }
    },
    front(r) {
      const t = r.t, go = leaveOf(r);
      for (const E of r.to) { const C = { x: E.x, y: Math.max(12, E.y - 10) }, line5 = ease(prog(t, 0, go)); if (t < go) for (let i = 0; i < 5; i++) { const ang = (i / 5 + t / 40) * Math.PI * 2, x0 = C.x + Math.cos(ang) * 15, y0 = C.y + Math.sin(ang) * 5; planet(x0 + (C.x - 10 + i * 5 - x0) * line5, y0 + (C.y - y0) * line5, 1, true); } }
      flights(r, p => { tail(p.x, p.y, 0, 1, [ORR.gold, ORR.pale, ORR.bronze]); planet(p.x, p.y, 1, true); });
      landings(r, 18, (E, a, i) => { if (i === 0) { ringOut(E.x, E.y, a, 18, ORR.gold, 14, 0.7, ORR.blue); sparks(E.x, E.y, a, 10, r.seed, ORR.gold, 10, 10); } }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0, glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0 }; },
    lights(r) { return r.to.map(E => lit(E, ORR.gold, 1.4 * hold(r.t, hitOf(r) - 6, hitOf(r) + 16, 4), 14)); },
  },

  // ---------------- Notsuru
  // Grab Hook: the hook swings out on its cable, catches the foe it drags in, and hauls back.
  hook: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), J = { x: U.x, y: U.y - 8 };
      blit(['aaaa', 'a...'], J.x + face(r) * 2, J.y - 1, { a: CRANE.amber }, hold(t, 0, r.end - 4, 3));
      flights(r, p => { line(J.x, J.y, p.x, p.y - 3, CRANE.steel, 1); craneHook(p.x, p.y, 1, Math.sign(p.E.x - r.from.x) || 1); });
      landings(r, 12, (E, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 9 * n, q === 1 ? CRANE.amber : CRANE.pale, fade(a, 12, 4)); } daze(E, a, 12, CRANE.amber); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Full Swing: a crate swings round on the cable through every foe and cracks the ground where it hits.
  swing: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a, i) => { if (i % 3 === 0) crackAt(E.x, E.y + 4, a, 18, CRANE.amber, K, 8, r.seed + i); }, 2); },
    front(r) {
      flights(r, p => { if (p.f.i) return; line(p.x, p.y - 14, p.x, p.y - 3, CRANE.steel, 1); crate(p.x, p.y, 1, true); });
      landings(r, 14, (E, a, i) => { if (i % 3 === 0) chunks(E.x, E.y + 2, a, 4, r.seed + i, [CRANE.amber, CRANE.brown, CRANE.pale], 1, 14, 2); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Lift and Drop: the hook comes down on its cable, takes Notsuru up out of reach, and two counterweights swing round under it.
  lift: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4);
      line(U.x, 0, U.x, U.y - 9, CRANE.steel, L);
      craneHook(U.x, U.y - 6, L, face(r));
      flights(r, p => crate(p.x, p.y + 3, 1));
      landings(r, 14, (E, a) => { arc(E.x, E.y + 6, 5 + a * 0.5, 1.5, CRANE.amber, fade(a, 14, 5)); });
    },
  },

  // Drop the Load: crates swing high over the foes on the cable, the hook lets go, and the load comes down on them all.
  staticfield: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i === 0) { crackAt(E.x, E.y + 4, a, 20, CRANE.amber, K, 12, r.seed); dust(E.x, E.y + 4, a, 16, CRANE.brown, CRANE.pale, 4, 5); } }, 4); },
    front(r) {
      const t = r.t, go = leaveOf(r);
      for (const E of r.to) { const C = { x: E.x, y: Math.max(8, E.y - 16) }; if (t < go + 2) { line(C.x, 0, C.x, C.y - 3, CRANE.steel, 1); craneHook(C.x, C.y, 1); crate(C.x, C.y + 5, 1, true); } }
      flights(r, p => crate(p.x, p.y, 1, p.f.i === 0));
      landings(r, 16, (E, a, i) => chunks(E.x + (i % 2 ? 4 : -4), E.y + 2, a, 3, r.seed + i, [CRANE.amber, CRANE.brown], 1, 16, 2), 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, CRANE.amber, 1.2 * hold(r.t, hitOf(r), hitOf(r) + 14, 4), 12)); },
  },

  // ---------------- Molasha
  // Vane Cut: its fan spins up and two vanes fly off it as cutting gusts that sweep through the foe.
  spinup: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      vanes(U.x, U.y - 8, 4, t * 0.7, hold(t, 0, hitOf(r) + 4, 3), 6);
      flights(r, p => { line(p.x - 3, p.y + 2, p.x + 3, p.y - 2, VANE.white, 1); px(p.x + 3, p.y - 2, VANE.tan, 1); arc(p.x, p.y, 4, 3, VANE.air, 0.5, 0.6, 0.9); });
      landings(r, 12, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x + 6, E.y - 5, E.x + 6 - 12 * n, E.y - 5 + 9 * n, VANE.white, fade(a, 12, 4), VANE.tan); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Whirlwind: the fan winds up, leaves spiral over in a whirlwind, and it stands up round the foe and blows its summons off.
  gale: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a) => { for (let i = 0; i < 5; i++) arc(E.x + Math.sin((a + i * 3) / 3) * 2, E.y + 4 - i * 3, 3 + i * 1.5, 1 + i * 0.3, i % 2 ? VANE.air : VANE.white, fade(a, 20, 6), (a * 0.1 + i * 0.2) % 1, (a * 0.1 + i * 0.2) % 1 + 0.7); }); },
    front(r) {
      const t = r.t, U = userAt(r);
      vanes(U.x, U.y - 8, 4, t * 0.5, hold(t, 0, hitOf(r), 3), 6);
      flights(r, p => blit((p.a >> 2) & 1 ? ['.t', 'tg'] : ['t.', 'gt'], p.x, p.y, { t: VANE.tan, g: '#7a9a5a' }, 1));
      landings(r, 18, (E, a) => daze(E, a, 18, VANE.white, VANE.tan));
    },
  },

  // Lee Side: a fan stands at the ally's back and turns the wind up and round it, and the air streams past without touching it.
  updraft: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 5), dir = face(r);
      vanes(E.x - dir * 9, E.y - 3, 5, t * 0.4, L, 6);
      flights(r, p => blit(['t.', '.g'], p.x, p.y, { t: VANE.tan, g: '#7a9a5a' }, 1));
      landings(r, 18, (P, a) => { for (let q = 0; q < 4; q++) { const k = (a * 1.5 + q * 4) % 14; line(P.x - 6 + q * 4, P.y + 4 - k, P.x - 6 + q * 4, P.y + 2 - k, q % 2 ? VANE.air : VANE.white, fade(a, 18, 6)); } arc(P.x, P.y, 7, 6, VANE.white, fade(a, 18, 6), dir > 0 ? 0.6 : 0.1, dir > 0 ? 1.4 : 0.9); });
    },
  },

  // Onshore Wind: a great fan turns beside Molasha, wind streams across the whole field at the foe, and leaves lift round its team.
  monsoon: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, dir = face(r), L = hold(t, 0, r.end, 6); for (let q = 0; q < 8; q++) { const y = 18 + q * 5, k = ((t * 3 + q * 13) % 110) - 10, x = dir > 0 ? k : 96 - k; line(x, y, x + dir * 6, y, q % 3 ? VANE.air : VANE.white, 0.75 * L); } },
    front(r) {
      const t = r.t, U = r.from, B = beside(U), L = hold(t, 0, r.end, 6);
      vanes(B.x, B.y, 7, t * 0.35, L, 8);
      flights(r, p => blit((p.a >> 2) & 1 ? ['.t', 'tg'] : ['t.', 'gt'], p.x, p.y, { t: VANE.tan, g: '#7a9a5a' }, 1));
      landings(r, 20, (E, a, i) => { if (i === 0) motes(E.x, E.y + 3, a, 20, 8, r.seed, [VANE.white, '#a8d080', VANE.tan], 9, 14); });
    },
    lights(r) { return [lit(beside(r.from), VANE.white, hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Varhari
  // Bounce Signal: signal rings zigzag down to every foe, and a reticle closes on each one so it cannot hide.
  ping: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { arc(p.x, p.y, 2, 2, SAT.cyan, 1); px(p.x, p.y, SAT.hot, 1); });
      landings(r, 20, (E, a) => { reticle(E.x, E.y, 6, out(prog(a, 0, 8)), fade(a, 20, 6)); ringOut(E.x, E.y, a, 10, SAT.hot, 9, 0.8); });
    },
  },

  // Sweep: a scanning beam sweeps across every foe from on high, and each is left marked in a reticle.
  fix: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), hit = hitOf(r), L = hold(t, go, hit + 10, 3);
      for (const E of r.to) if (L > 0) { const sw = Math.sin((t - go) / 3) * 6; scanBeam({ x: U.x, y: U.y - 4 }, { x: E.x + sw, y: E.y + 3 }, t, L); }
      landings(r, 22, (E, a) => reticle(E.x, E.y, 6, out(prog(a, 0, 8)), fade(a, 22, 6)));
    },
  },

  // Pinpoint: a reticle closes on the foe, and a thin beam of watching light stabs into its middle.
  burnin: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r);
      reticle(E.x, E.y, 5, prog(t, 0, go), hold(t, 0, hit + 10, 3));
      const f = r.flights[0];
      if (f) { const a = t - f.t0; if (a >= 0 && a < f.dur + 10) scanBeam({ x: U.x, y: U.y - 3 }, E, t, a < f.dur + 6 ? 1 : (f.dur + 10 - a) / 4); }
      landings(r, 12, (P, a) => { if (a < 3) oval(P.x, P.y, 3 - a, 3 - a, SAT.hot, 1); sparks(P.x, P.y, a, 6, r.seed, SAT.cyan, 8, 7); }, 2);
    },
    scene(r) { const a = r.t - hitOf(r); return { glare: a >= 0 && a < 3 ? 0.375 - a * 0.1 : 0, jolt: jolts(r, 1, 4) }; },
  },

  // Last Pass: reticles lock on the foes, and three burning pieces of the watcher fall out of the sky onto them.
  deorbit: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i === 0) crackAt(E.x, E.y + 4, a, 20, SAT.cyan, K, 11, r.seed); }, 4); },
    front(r) {
      const t = r.t, hit = hitOf(r);
      for (const E of r.to) reticle(E.x, E.y, 7, prog(t, 0, hit - 4), hold(t, 0, hit + 2, 3));
      flights(r, p => { for (let i = 1; i < 8; i++) px(p.x - p.ux * i, p.y - p.uy * i, i < 2 ? FURN.hot : i < 4 ? FURN.fire : FURN.smoke, i < 5 ? 1 : 0.5); blit(['gc', 'cn'], p.x, p.y, { g: SAT.gray, c: SAT.cyan, n: SAT.navy }, 1); });
      landings(r, 18, (E, a, i) => { sparks(E.x, E.y, a, 8, r.seed + i, FURN.fire, 10, 10); chunks(E.x, E.y + 2, a, 3, r.seed + i, [SAT.gray, SAT.navy, SAT.cyan], 1, 16, 2); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, FURN.fire, 1.4 * hold(r.t, hitOf(r) - 4, hitOf(r) + 14, 4), 14)); },
  },

  // ---------------- Camado
  // Coal Shot: its firebox door bangs open beside it, a live coal shoots out, and it bursts on the foe in cinders.
  stoke: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), B = beside(U);
      firebox(B.x, B.y, prog(t, 0, go), t, hold(t, 0, go + 8, 3));
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [FURN.fire, FURN.red, FURN.smoke]); coal(p.x, p.y, p.a); });
      landings(r, 18, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, FURN.fire, 8, 8); cinders(E.x, E.y, a, 18, r.seed); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Open Flue: the flue opens and a draft of embers sweeps through the foes, and smoke and cinders roll off them.
  flue: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { coal(p.x, p.y, p.a); tail(p.x, p.y, p.ux, p.uy, [FURN.fire, FURN.smoke, FURN.smoke]); });
      landings(r, 20, (E, a, i) => { if (i % 4) return; for (let q = 0; q < 3; q++) fogPuffOf(E.x - 4 + q * 4, E.y - 2 - a * 0.5 - (q % 2) * 2, 1.5 + a * 0.15, FURN.smoke, FURN.dark, fade(a, 20, 8)); cinders(E.x, E.y, a, 18, r.seed + i); });
    },
  },

  // Hot Plate: an iron plate glowing orange stands before the ally, and two coals circle it.
  firebox: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), dir = face(r), L = hold(t, hit - 2, r.end, 5);
      flights(r, p => coal(p.x, p.y, p.a));
      if (L > 0) { const x = E.x + dir * 7; dither(x - 1, E.y - 4, 3, 9, FURN.iron, L); dither(x, E.y - 3, 1, 7, (t >> 2) & 1 ? FURN.fire : FURN.red, L); px(x, E.y - 4, FURN.hot, L); }
      landings(r, 16, (P, a) => cinders(P.x + dir * 7, P.y, a, 16, r.seed, 4));
    },
  },

  // Let It Out: the firebox opens wide, the Slag Crab climbs out of the fire, and three coals lob over and burst on the foe.
  blastheat: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = beside(U), go = leaveOf(r), hit = hitOf(r), dir = face(r);
      firebox(B.x, B.y, prog(t, 0, go), t, hold(t, 0, r.end, 5));
      const u = ease(prog(t, go, hit)), C = { x: B.x + dir * 2 * u, y: B.y + (U.y + 5 - B.y) * u };
      if (t >= go - 2) blit(['c.....c', 'cc...cc', '.ooooo.', 'ohohoho', '.r.r.r.'], C.x + dir * 8 * u, C.y, { c: FURN.fire, o: FURN.red, h: FURN.hot, r: FURN.dark }, hold(t, go - 2, r.end, 5));
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [FURN.fire, FURN.red, FURN.smoke]); coal(p.x, p.y, p.a); });
      landings(r, 22, (E, a, i) => { sparks(E.x, E.y, a, 10, r.seed + i, FURN.fire, 10, 10); cinders(E.x, E.y, a, 22, r.seed + i, 8); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(beside(r.from), FURN.fire, 1.4 * hold(r.t, 0, r.end, 6), 14), lit(aim(r), FURN.fire, 1.4 * hold(r.t, hitOf(r), hitOf(r) + 14, 4), 12)]; },
  },

  // ---------------- Manuchi
  // In Stroke: it drives in on its rod, the piston head slams the foe, and steam jets out of the joint.
  drive: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = userAt(r), hit = hitOf(r); if (t <= hit + 2) pistonRod({ x: r.from.x, y: r.from.y + 1 }, { x: U.x, y: U.y + 1 }, hold(t, 0, hit + 3, 2), 3); },
    front(r) { landings(r, 14, (E, a) => { sparks(E.x, E.y, a, 6, r.seed, PIST.light, 6, 6); steam(E.x, E.y - 2, a, 14, -(Math.sign(E.x - r.from.x) || 1)); }, 2); },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Rod Slam: the rod pumps down on every foe from above and knocks them back.
  plunge: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a, i) => { if (i % 2 === 0) crackAt(E.x, E.y + 4, a, 18, PIST.light, K, 8, r.seed + i); }, 2); },
    front(r) {
      const t = r.t, hit = hitOf(r);
      for (const E of r.to) { const down = t < hit ? ease(prog(t, hit - 6, hit)) : 1 - ease(prog(t, hit + 3, hit + 10)); if (t >= hit - 6 && t < hit + 10) pistonRod({ x: E.x, y: Math.max(0, E.y - 24) }, { x: E.x, y: E.y - 16 + 11 * down }, 1, 4); }
      flights(r, p => blit(['ls', 'sd'], p.x, p.y, { l: PIST.light, s: PIST.steel, d: PIST.dark }, 1));
      landings(r, 14, (E, a) => { streaks(E.x, E.y, a, 12, Math.sign(E.x - r.from.x) || 1, PIST.steam, 3); steam(E.x, E.y - 5, a, 12, -1); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Hold Pressure: Manuchi draws back on its rod and holds, and steam hisses out of its joints on both sides.
  vent: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4);
      flights(r, p => blit(['.l.', 'lsl', '.l.'], p.x, p.y, { l: PIST.light, s: PIST.dark }, 1));
      for (const s of [-1, 1]) steam(U.x + s * 4, U.y + 1, (t % 14), 14, s, L);
      landings(r, 14, (E, a) => { ringOut(E.x, E.y, a, 14, PIST.light, 10, 0.8, PIST.steel); if (a < 10) { dither(E.x - 6, E.y + 4, 13, 1, PIST.steel, 1 - a / 10); } });
    },
  },

  // Long Stroke: Manuchi's rod drives it all the way up out of reach from a cylinder on the ground, and steam blasts out under it.
  fullstroke: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 5), up = ease(prog(t, 0, hitOf(r)));
      dither(U.x - 5, U.y + 2, 11, 4, PIST.dark, L); dither(U.x - 5, U.y + 2, 11, 1, PIST.light, L); dither(U.x - 5, U.y + 2, 1, 4, PIST.steel, L);
      if (up > 0) pistonRod({ x: U.x, y: U.y + 2 }, { x: U.x, y: U.y + 2 - 30 * up }, L, 4);
    },
    front(r) {
      flights(r, p => blit(['.l.', 'lsl', '.l.'], p.x, p.y, { l: PIST.light, s: PIST.dark }, 1));
      landings(r, 18, (E, a) => { steam(E.x - 4, E.y + 3, a, 18, -1); steam(E.x + 4, E.y + 3, a, 18, 1); dust(E.x, E.y + 5, a, 16, PIST.steel, PIST.steam, 4, 5); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
  },

  // ---------------- Virtaki
  // Brush Spark: its winding hums, a spark jags over to the foe, and it bursts and leaves a Charge on it.
  spark: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      windings(U.x, U.y - 6, 3, t / 2, hold(t, 0, leaveOf(r) + 4, 2));
      flights(r, p => { jolt({ x: p.x - p.ux * 7, y: p.y - p.uy * 7 }, p, r.seed + (p.a >> 1), 1, 3); px(p.x, p.y, W); });
      landings(r, 22, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, DYN.yellow, 8, 8); if (a > 4) charge(E.x + 6, E.y - 5, a, fade(a, 22, 5)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Jump the Gap: a bolt leaps the whole gap from Virtaki's winding to the foe and holds there, crackling.
  arc: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r);
      windings(U.x, U.y - 6, 3, t / 2, hold(t, 0, hit + 6, 2));
      if (t >= go && t < hit + 6) jolt({ x: U.x, y: U.y - 10 }, E, r.seed + (t >> 1), t < hit + 3 ? 1 : 0.5, 7);
      landings(r, 14, (P, a) => { if (a < 3) oval(P.x, P.y, 3, 3, DYN.hot, 1); sparks(P.x, P.y, a, 6, r.seed, DYN.yellow, 8, 7); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
    lights(r) { return [lit(aim(r), DYN.yellow, hold(r.t, leaveOf(r), hitOf(r) + 6, 2), 10)]; },
  },

  // Spin Up: its winding spins up, sparks run round it, and two Charges light on it.
  induct: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = userAt(r); windings(U.x, U.y + 4, 2, t, hold(t, 0, r.end, 3)); },
    front(r) {
      flights(r, p => { px(p.x, p.y, W); tail(p.x, p.y, p.ux, p.uy, [DYN.yellow, DYN.copper]); });
      landings(r, 22, (E, a) => { charge(E.x - 5, E.y - 6, a, fade(a, 22, 5)); if (a > 3) charge(E.x + 5, E.y - 6, a + 2, fade(a, 22, 5)); sparks(E.x, E.y, a, 6, r.seed, DYN.yellow, 8, 6); });
    },
  },

  // Field Coil: a great winding stands beside Virtaki, bolts jag out from it to every foe, and each one is left charged.
  stormcoil: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = beside(r.from); windings(B.x, B.y + 6, 5, t / 2, hold(t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, B = beside(r.from), go = leaveOf(r);
      if (t < go && (t & 3) < 2) jolt({ x: B.x - 3, y: B.y - 4 }, { x: B.x + 3, y: B.y + 4 }, r.seed + t, 1, 3);
      flights(r, p => jolt({ x: B.x, y: B.y - 4 }, p, r.seed + (p.a >> 1) + p.f.i * 7, 0.75, 5));
      landings(r, 22, (E, a, i) => { sparks(E.x, E.y, a, 8, r.seed + i, DYN.yellow, 8, 9); if (i === 0 && a > 4) charge(E.x + 6, E.y - 5, a, fade(a, 22, 5)); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0, glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
    lights(r) { return [lit(beside(r.from), DYN.yellow, 1.4 * hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Pilteki
  // Clank: two buoy bells swing over to the foe, and a small bell hangs on it, clanking with every move it makes.
  blare: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => buoyBell(p.x, p.y, p.a));
      landings(r, 26, (E, a, i) => { if (i) return; ringOut(E.x, E.y, a, 14, BUOY.white, 10, 0.8, BUOY.red); buoyBell(E.x + 6, E.y - 7, a, fade(a, 26, 6)); });
    },
  },

  // Hush Blast: three rings of sound blast across, and the foe reels in a red and white ring.
  shriek: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { const ang = Math.atan2(p.uy, p.ux) / (Math.PI * 2); arc(p.x, p.y, 3, 3, p.f.i % 2 ? BUOY.red : BUOY.white, 1, ang - 0.2, ang + 0.2); arc(p.x - p.ux * 2, p.y - p.uy * 2, 2, 2, BUOY.pale, 0.5, ang - 0.2, ang + 0.2); });
      landings(r, 18, (E, a, i) => { if (i) return; ringOut(E.x, E.y, a, 14, BUOY.red, 9, 0.8, BUOY.white); daze(E, a, 18, BUOY.red, BUOY.white); });
    },
  },

  // Rising Swell: three bells circle Pilteki and its blasts rise round it, swelling, ring on ring.
  allclear: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4);
      flights(r, p => buoyBell(p.x, p.y, p.a));
      blasts({ x: U.x, y: U.y }, { x: U.x, y: U.y - 22 }, t, 3, 0.75 * L, 1.2, 0.3);
      landings(r, 14, (E, a) => ringOut(E.x, E.y, a, 14, BUOY.white, 11, 0.8, BUOY.red));
    },
  },

  // Fog Signal: a great striped buoy rises beside Pilteki and blasts, ring after ring rolling over every foe until they fall silent.
  klaxon: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = beside(U), L = hold(t, 0, r.end, 6);
      blit(['..w..', '.rrr.', '.www.', 'rrrrr', 'wwwww', 'ggggg'], B.x, B.y, { r: BUOY.red, w: BUOY.white, g: BUOY.gray }, L, 2);
      for (const E of r.to) blasts({ x: B.x, y: B.y }, E, t, 4, L * (t >= leaveOf(r) ? 1 : 0.4), 1.5, 0.2);
      landings(r, 22, (E, a, i) => { if (i === 0) { ringOut(E.x, E.y, a, 18, BUOY.white, 13, 0.8, BUOY.red); for (const [i2, j] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]) px(E.x + 6 + i2, E.y - 8 + j, BUOY.red, fade(a, 22, 6)); } }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 1) : 0 }; },
    lights(r) { return [lit(beside(r.from), BUOY.red, 1.3 * hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Lupusmi
  // Jaw: it lunges, a pale wolf's jaw flies open at the foe and shuts on it, and a pale fleck of the bite comes home.
  bite: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, WOLF.pale, WOLF.gray); },
    front(r) {
      flights(r, p => jaws(p.x, p.y, 2, 3, WOLF.white, WOLF.gray, 1));
      landings(r, 18, (E, a) => { jaws(E.x, E.y, Math.max(0, 5 - a * 2), 4, WOLF.white, WOLF.brown, fade(a, 12, 4)); takeBack(E, r.from, a - 4, 12, 2, WOLF.pale, WOLF.gray); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Nose Down: it puts its nose down, an old scent runs along the ground to the foe, and its jaw snaps shut at the end of it.
  rundown: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), S = r.from; scent({ x: S.x, y: S.y + 5 }, { x: E.x, y: E.y + 5 }, prog(t, 0, hitOf(r)), t, hold(t, 0, r.end, 5)); },
    front(r) {
      flights(r, p => { px(p.x, p.y + 4, WOLF.pale); px(p.x - p.ux * 2, p.y + 4, WOLF.gray, 0.5); });
      landings(r, 16, (E, a) => jaws(E.x, E.y, Math.max(0, 5 - a * 2), 4, WOLF.white, WOLF.brown, fade(a, 12, 4)), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Moon Howl: a pale moon rises behind the foe, Lupusmi's howl runs up to it in rings, and the foe reels to leave.
  hackles: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), M = beside(E), up = ease(prog(t, 0, hitOf(r))), L = hold(t, 0, r.end, 6);
      oval(M.x, M.y + 6 - 6 * up, 4, 4, WOLF.moon, L); px(M.x - 1, M.y + 5 - 6 * up, WOLF.gray, L); px(M.x + 2, M.y + 7 - 6 * up, WOLF.gray, L);
    },
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, hitOf(r) + 6, 3);
      for (let q = 0; q < 3; q++) { const k = (t + q * 4) % 12; arc(U.x, U.y - 6 - k, 2 + k * 0.4, 1 + k * 0.2, q % 2 ? WOLF.pale : WOLF.gray, L * (1 - k / 12), 0.55, 0.95); }
      landings(r, 18, (E, a) => daze(E, a, 18, WOLF.pale, WOLF.moon));
    },
  },

  // Never Let Go: three jaws close on the foe from all round, each bites in turn, and the last one holds.
  pindown: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { smear(r, WOLF.pale, WOLF.gray); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r);
      flights(r, p => jaws(p.x, p.y, 2, 2, WOLF.white, WOLF.gray, 1));
      landings(r, 26, (P, a, i) => { const L = i === r.hits.length - 1 ? fade(a, 26, 6) : fade(a, 8, 3); jaws(P.x, P.y - 3 + i * 3, Math.max(0, 4 - a * 2), 4, WOLF.white, WOLF.brown, L); if (i === 0) takeBack(P, r.from, a - 6, 14, 4, WOLF.pale, WOLF.gray); }, 3);
      if (t >= hit) daze(E, t - hit, 26, WOLF.pale, WOLF.white);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
  },

  // ---------------- Iesbiki
  // Plough Up: it stamps, a furrow ploughs open under every foe and throws clods, and a hoof print stays on each.
  toss: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => { const w = Math.round(11 * Math.min(1, (a + 1) / 5)), L = fade(a, 24, 6); dither(E.x - w, E.y + 5, 2 * w + 1, 1, YOKE.soil, L); dither(E.x - w, E.y + 4, 2 * w + 1, 1, YOKE.wood, L); hoof(E.x + 7, E.y + 3, L); }, 2); },
    front(r) { flights(r, p => blit(['ws', 'ss'], p.x, p.y, { w: YOKE.cream, s: YOKE.wood }, 1)); landings(r, 16, (E, a) => chunks(E.x, E.y + 3, a, 5, r.seed, [YOKE.wood, YOKE.soil, YOKE.cream], 1, 16, 2), 2); },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Horn Shove: it charges behind its yoke, the bow drives into the foe, and it bursts gold and shoves the foe off its feet.
  headbutt: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, YOKE.wood, YOKE.soil); landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, YOKE.gold, K, 8, r.seed), 2); },
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r), hit = hitOf(r);
      if (t < hit + 4) yokeBow(U.x + dir * 5, U.y - 1, 5, hold(t, 0, hit + 4, 2));
      landings(r, 14, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, YOKE.gold, 8, 8); streaks(E.x, E.y, a, 12, dir, YOKE.cream, 3); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // Stamp Furrows: it stamps, and hoof prints and furrows break out on the ground round it, ready for its next turns.
  bellow: {
    noFlights: true, noLandings: true,
    back(r) {
      landings(r, 30, (E, a) => { const L = fade(a, 30, 8); for (let q = 0; q < 4; q++) if (a >= q * 2) hoof(E.x - 9 + q * 6, E.y + 5 + (q % 2), L); dither(E.x - 12, E.y + 7, 25, 1, YOKE.soil, L * prog(a, 0, 6)); });
    },
    front(r) { landings(r, 14, (E, a) => dust(E.x, E.y + 5, a, 14, YOKE.soil, YOKE.wood, 3, 5)); },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Pull Hard: a great yoke settles on Iesbiki, traces run taut from it to the foe, and it leans in to drag the foe off with it.
  undertheyoke: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, E = foeOf(r), hit = hitOf(r), L = hold(t, 0, r.end, 6), down = ease(prog(t, 0, 10));
      yokeBow(U.x, U.y - 14 + 9 * down, 8, L);
      if (t >= 10) { const taut = prog(t, 10, hit); for (const s of [-1, 1]) { const a0 = { x: U.x + s * 4, y: U.y - 4 }; for (let i = 0; i <= 20; i++) { const p = sagAt(a0, { x: E.x + s * 2, y: E.y + 2 }, i / 20, 6 * (1 - taut)); if (i % 2 === 0) px(p.x, p.y, i % 4 ? YOKE.gold : YOKE.cream, L); } } }
      landings(r, 20, (P, a) => { ringOut(P.x, P.y + 4, a, 20, YOKE.gold, 13, 0.3, YOKE.cream); motes(P.x, P.y + 2, a, 16, 5, r.seed, [YOKE.cream, W], 6, 12); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
    lights(r) { return [lit(r.from, YOKE.gold, 1.2 * hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Okopa
  // Icicle Throw: it rears back and throws an icicle hard, it shatters on the foe, and a brown paw mark marks the hunt.
  nip: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => icicle(p.x, p.y, p.ux, p.uy));
      landings(r, 22, (E, a) => { for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.3, d = 1 + a * 0.8; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, q % 2 ? ERMINE.ice : W, fade(a, 12, 4)); } if (a > 4) pawMark(E.x + 6, E.y - 6, fade(a, 22, 6)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Snow Snare: snow puffs up round the foe and a snare loop pulls tight round its feet in the snow.
  dart: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => { const rr = Math.max(4, 9 - a * 0.6), L = fade(a, 24, 6); arc(E.x, E.y + 4, rr, rr * 0.3, ERMINE.brown, L); dither(E.x - 10, E.y + 5, 21, 1, ERMINE.snow, 0.5 * L); }); },
    front(r) {
      flights(r, p => { px(p.x, p.y, W); px(p.x + 1, p.y + 1, ERMINE.snow); px(p.x - 1, p.y + 1, ERMINE.ice); });
      landings(r, 18, (E, a) => { line(E.x + 4, E.y + 4, E.x + 6, E.y - 2 - Math.min(4, a), ERMINE.brown, fade(a, 18, 6)); for (let q = 0; q < 5; q++) { const g = prog(a - q, 0, 4); if (g > 0) px(E.x - 6 + q * 3, E.y + 3 - Math.round(g * 2), q % 2 ? W : ERMINE.ice, fade(a, 18, 6)); } });
    },
  },

  // Warm Den: a den of snow mounds up round the ally, dark at its mouth, and it rests hidden inside while it heals.
  slipaway: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), up = ease(prog(t, hit - 6, hit + 4)), L = hold(t, hit - 6, r.end, 6);
      if (L > 0) { mound(E.x, E.y + 5, 9, Math.round(9 * up), ERMINE.snow, W, L); oval(E.x, E.y + 3, 2.5 * up, 2 * up, ERMINE.ink, L); }
      flights(r, p => { px(p.x, p.y, ERMINE.white); px(p.x + 1, p.y, ERMINE.ice); });
      landings(r, 20, (P, a) => motes(P.x, P.y - 4, a, 20, 4, r.seed, [ERMINE.white, ERMINE.ice], 6, 10));
    },
  },

  // Mad Dance: Okopa's long white body loops round itself in figure eights, faster and faster, and snow glitters round it.
  dance: {
    lead: 6, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), sp = 0.12 + 0.12 * prog(t, 0, hitOf(r));
      const pts: Pt[] = [];
      for (let i = 0; i < 14; i++) { const a = (t - i * 1.2) * sp * 2; pts.push({ x: U.x + Math.sin(a) * 10, y: U.y + Math.sin(a * 2) * 4 }); }
      ermineBody(pts, L);
      landings(r, 22, (E, a) => { for (let q = 0; q < 6; q++) { const ang = hash(r.seed + q) * Math.PI * 2, d = 6 + hash(r.seed + q * 3) * 6; if (((a + q * 2) % 6) < 3) glint(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.7, ERMINE.ice, fade(a, 22, 6)); } ringOut(E.x, E.y + 4, a, 18, ERMINE.ice, 12, 0.35); });
    },
    lights(r) { return [lit(r.from, ERMINE.ice, hold(r.t, 0, r.end, 6), 12)]; },
  },

  // Nape Bite: it darts in and bites at the nape from above, and a paw mark marks the hunt.
  stoat_takedown: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, ERMINE.white, ERMINE.ice); },
    front(r) {
      flights(r, p => { px(p.x, p.y, W); px(p.x - 1, p.y + 1, ERMINE.white); });
      landings(r, 18, (E, a) => { jaws(E.x, E.y - 5, Math.max(0, 3 - a), 3, W, ERMINE.brown, fade(a, 10, 4)); if (a > 3) pawMark(E.x + 6, E.y - 6, fade(a, 18, 5)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Pounce Off: it springs up in a white arc, comes down claws first in ice-blue streaks, and springs away.
  stoat_pounce: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      if (t < hitOf(r)) { const pts: Pt[] = []; for (let i = 0; i < 8; i++) { const p = userAtFrame(r, t - i); pts.push({ x: p.x + i * 0.3, y: p.y - 3 }); } ermineBody(pts, 1); }
      landings(r, 12, (E, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 9 * n, q === 1 ? W : ERMINE.ice, fade(a, 12, 4)); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Snow Rake: it spins, snow sprays through the foes, and its claws rake each one in ice-blue streaks.
  stoat_swipe: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { for (let g = 0; g < 4; g++) px(p.x + (hash(r.seed + g + p.a) - 0.5) * 6, p.y + (hash(r.seed + g * 3 + p.a) - 0.5) * 4, g % 2 ? W : ERMINE.snow); });
      landings(r, 12, (E, a, i) => { if (i % 3) return; for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x + 4 - q * 3, E.y - 5, E.x + 6 - q * 3 - 8 * n, E.y - 5 + 9 * n, q === 1 ? W : ERMINE.ice, fade(a, 12, 4)); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // ---------------- Iliru
  // Draw Blood: it lunges, its round sucker clamps on the foe, and red drops run back along a high arc to Iliru.
  draw: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, LEECH.pale, LEECH.red); },
    front(r) {
      flights(r, p => sucker(p.x, p.y, 2, 1, 0.5));
      landings(r, 20, (E, a) => { sucker(E.x, E.y, 3.5 - Math.min(1.5, a * 0.4), fade(a, 10, 4), 1); takeBack(E, r.from, a - 3, 14, 4, LEECH.red, LEECH.pink); bleed(E, a, 14, 2, r.seed, LEECH.red); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Latch On: it hops onto the foe, its sucker latches and stays, and the foe's blood pulses into it.
  pool: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => sucker(p.x, p.y, 2, 1, 0.5));
      landings(r, 30, (E, a) => { const pulse = (a >> 2) & 1; sucker(E.x + 5, E.y - 3, 2.5 + pulse * 0.5, fade(a, 30, 6), 1); bleed(E, a, 16, 2, r.seed, LEECH.red); if (a > 8) takeBack({ x: E.x + 5, y: E.y - 3 }, r.from, (a - 8) % 14, 14, 1, LEECH.red, LEECH.pink); }, 2);
    },
  },

  // Gorge: Iliru swells with what it has drunk, and blood comes out of it in a wave that splashes every foe red.
  bloat: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, leaveOf(r) + 4, 3);
      arc(U.x, U.y, 6 + Math.sin(t / 2), 6 + Math.sin(t / 2), LEECH.red, 0.75 * L);
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [LEECH.red, LEECH.dark]); bead(p.x, p.y, LEECH.pink, LEECH.red, 1, LEECH.dark); });
      landings(r, 16, (E, a) => { crown(E.x, E.y + 4, a, 14, LEECH.pink, LEECH.red, 6); bleed(E, a, 16, 3, r.seed, LEECH.red); });
    },
  },

  // Burst Full: Iliru swells and swells, ringed in red, then bursts and its blood closes in on every foe and splashes them.
  hemorrhage: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, go = leaveOf(r), g = prog(t, 0, go); if (t < go + 2) { for (let q = 0; q < 2; q++) arc(U.x, U.y, 5 + g * 6 + q * 2, 5 + g * 5 + q * 2, q ? LEECH.dark : LEECH.red, 1); } else if (t < go + 10) sparks(U.x, U.y, t - go - 2, 10, r.seed, LEECH.red, 8, 12); },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [LEECH.red, LEECH.dark]); bead(p.x, p.y, LEECH.pink, LEECH.red, 1, LEECH.dark); });
      landings(r, 22, (E, a, i) => { crown(E.x, E.y + 4, a, 16, LEECH.pink, LEECH.red, 8, 1.3); if (i % 3 === 0) bleed(E, a, 22, 4, r.seed + i, LEECH.red); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r), b = r.t - leaveOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : b >= 0 && b < 4 ? shake(b, 4, 1) : 0 }; },
    lights(r) { return [lit(r.from, LEECH.red, 1.3 * hold(r.t, 0, leaveOf(r) + 4, 4), 14)]; },
  },

  // ---------------- Varasu
  // Flock Peck: crows sweep through the foe, each pecks as it passes, and black feathers drift down.
  peck: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => crow(p.x, p.y, p.a + p.f.i, 1, p.ux < 0));
      landings(r, 22, (E, a, i) => { if (a < 6) { const n = Math.min(1, (a + 1) / 3); line(E.x - 3 + i * 3, E.y - 4, E.x - 1 + i * 3, E.y - 4 + 6 * n, CROW.red, 1 - a / 6); } feather(E.x - 4 + i * 4, E.y - 2 + a * 0.4, a, fade(a, 22, 6)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 3) }; },
  },

  // Mobbing: crows gather out of every side onto the foe at once, rake it, and leave it pinned under feathers.
  mob: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => crow(p.x, p.y, p.a + p.f.i, 1, p.ux < 0));
      landings(r, 20, (E, a, i) => { if (i) return; for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 9 * n, q === 1 ? CROW.red : CROW.sheen, fade(a, 12, 4)); } for (let q = 0; q < 4; q++) feather(E.x - 6 + q * 4, E.y - 3 + a * 0.4 + (q % 2) * 2, a + q, fade(a, 20, 6)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Circle Low: two crows circle low over the foe in the dark, drop on it, and claw.
  circle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, hit + 2, 3);
      for (let q = 0; q < 2; q++) { const a = t * 0.2 + q * Math.PI, low = prog(t, hit - 6, hit); crow(E.x + Math.cos(a) * 9 * (1 - low), E.y - 12 + 10 * low + Math.sin(a) * 2, t + q, L, Math.sin(a) > 0); }
      landings(r, 14, (P, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(P.x - 4 + q * 3, P.y - 5, P.x - 6 + q * 3, P.y - 5 + 9 * n, q === 1 ? CROW.red : CROW.sheen, fade(a, 14, 4)); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Black Flock: Varasu comes apart into a flock of four that wheels round where it stood, then the flock cuts through every foe.
  feast: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end - 4, 6);
      for (let q = 0; q < 4; q++) { const a = t * 0.15 + q * Math.PI / 2; crow(U.x + Math.cos(a) * (6 + 4 * prog(t, 0, 8)), U.y - 2 + Math.sin(a) * 4, t + q, L, Math.sin(a) > 0); }
      landings(r, 22, (E, a, i) => { if (i % 3) return; const n = Math.min(1, (a + 1) / 3); thick(E.x + 7, E.y - 6, E.x + 7 - 14 * n, E.y - 6 + 11 * n, CROW.sheen, fade(a, 12, 4), CROW.red); for (let q = 0; q < 3; q++) feather(E.x - 5 + q * 5, E.y - 4 + a * 0.4, a + q, fade(a, 22, 6)); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
  },

  // ---------------- Sonno
  // Hook Horn: it lowers its barnacled horns, charges in, and hooks up through the foe.
  horn: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, BULL.blue, BULL.tan); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit + 2) horns(U.x, U.y - 4, hold(t, 0, hit + 2, 2));
      landings(r, 14, (E, a) => { hookCut(E.x, E.y, a, 12, Math.sign(E.x - r.from.x) || 1); dust(E.x, E.y + 4, a, 14, BULL.dust, BULL.tan, 2); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Long Charge: a long slow charge raises a trail of dust, and it hits head on with a crack and a burst of sea spray.
  charge: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r);
      if (t < hit) for (let k = 1; k <= 4; k++) { const p = userAtFrame(r, t - k * 2); fogPuffOf(p.x, p.y + 4, 1.5 + k * 0.5, BULL.dust, BULL.tan, 0.75 - k * 0.12); }
      landings(r, 20, (E, a) => crackAt(E.x, E.y + 4, a, 20, BULL.cream, K, 10, r.seed), 3);
    },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit + 2) horns(U.x, U.y - 4, 1);
      landings(r, 18, (E, a) => { crown(E.x, E.y + 2, a, 16, W, BULL.sea, 8, 1.2); daze(E, a, 18, BULL.cream, W); }, 3);
    },
    scene(r) { return { jolt: jolts(r, 2, 8) }; },
  },

  // Paw the Sand: it paws the ground, sand flies out behind it, and it backs off for a run-up.
  stampmove: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r);
      for (let q = 0; q < 3; q++) { const k = (t + q * 4) % 12; if (t < r.end - 6) px(U.x - dir * (3 + k), U.y + 4 - k * 0.6 + 0.05 * k * k, q % 2 ? BULL.dust : BULL.tan, 1 - k / 12); }
      flights(r, p => blit(['ds', 's.'], p.x, p.y, { d: BULL.dust, s: BULL.tan }, 1));
      landings(r, 16, (E, a) => { dust(E.x, E.y + 5, a, 16, BULL.tan, BULL.dust); streaks(E.x, E.y, a, 14, -dir, BULL.cream, 2); horns(E.x, E.y - 4, fade(a, 16, 5)); });
    },
  },

  // From Behind: it vanishes, and its horns come at the foe from behind, both at once, with a great hooking blow.
  stampede: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => crackAt(E.x, E.y + 4, a, 22, BULL.cream, K, 12, r.seed), 5); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), dir = Math.sign(E.x - r.from.x) || 1;
      if (t < hit) { const u = ease(prog(t, hit - 10, hit)); horns(E.x + dir * (16 - 14 * u), E.y - 3, hold(t, 0, hit, 3), 1.3); }
      landings(r, 20, (P, a) => { hookCut(P.x, P.y, a, 14, -dir); hookCut(P.x + dir * 2, P.y + 1, a - 2, 14, -dir); chunks(P.x, P.y, a, 4, r.seed, [BULL.cream, BULL.shell, BULL.blue], 1, 18, 2); }, 6);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0, glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
  },

  // ---------------- Peubi
  // Press Down: a giant thumb comes down out of the sky on the foe and presses, and its print stays in the ground.
  press: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => thumbprint(E.x, E.y + 5, fade(a, 26, 6)), 2); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), down = ease(prog(t, 0, hit)), up = ease(prog(t, hit + 6, r.end - 2)), L = hold(t, 0, r.end, 3);
      thumbDown(E.x, E.y - 22 + 18 * down - 22 * up, L, 1);
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // Thumb Flick: the thumb swings in from the side and flicks the foe clean off its feet.
  pinch: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, THUMB.skin, THUMB.dark); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), dir = Math.sign(E.x - r.from.x) || 1, u = prog(t, hit - 5, hit + 2);
      if (u > 0 && u < 1) { const ang = (-0.6 + 1.2 * u) * dir; blit(['.ssss.', 'snnnns', 'snwnns', 'snnnns', '.ssss.'], E.x - dir * (7 - 4 * Math.sin(ang)), E.y - 2, { s: THUMB.skin, n: THUMB.nail, w: THUMB.shine }, 1); }
      landings(r, 14, (P, a) => { sparks(P.x, P.y, a, 8, r.seed, THUMB.nail, 8, 8); streaks(P.x, P.y, a, 12, dir, THUMB.shine, 3); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Let Go: its clench opens, stones it held rise and fall, and the ground heaves under every foe.
  thumbsdown: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 16, (E, a, i) => { if (i % 3 === 0) { mound(E.x, E.y + 6, 9, Math.round(3 * Math.sin(Math.PI * Math.min(1, a / 10))), THUMB.dark, THUMB.skin); thumbprint(E.x, E.y + 6, fade(a, 16, 5)); } }, 2); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), open = prog(t, 0, go);
      if (t < go + 4) blit(open < 0.6 ? ['.kkkk.', 'kssssk', 'ksnssk', '.ssss.'] : ['k.k.k.', 'kskssk', 'ksnssk', '.ssss.'], U.x, U.y - 9, { k: THUMB.dark, s: THUMB.skin, n: THUMB.nail }, 1);
      flights(r, p => blit(['ls', 'sd'], p.x, p.y, { l: THUMB.nail, s: THUMB.skin, d: THUMB.dark }, 1));
      landings(r, 14, (E, a, i) => { if (i % 3 === 0) chunks(E.x, E.y + 3, a, 3, r.seed + i, [THUMB.skin, THUMB.nail], 0.9, 14); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Squash Flat: the thumb rises high over the foe and presses down on it three times, and its print stays deep.
  squash: {
    tail: 16, noFlights: true, noLandings: true,
    back(r) { landings(r, 40, (E, a) => { thumbprint(E.x, E.y + 5, fade(a, 40, 8)); crackAt(E.x, E.y + 4, a, 20, THUMB.nail, K, 12, r.seed); }, 3); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), a = t - hit, L = hold(t, 0, r.end, 4);
      let y: number;
      if (a < 0) y = E.y - 26 + 22 * ease(prog(t, 0, hit));
      else { const k = a % 8, n = Math.floor(a / 8); y = n < 3 ? E.y - 4 - Math.round(Math.sin(Math.PI * k / 8) * 6) : E.y - 4 - 22 * ease(prog(a, 24, 32)); }
      thumbDown(E.x, y, L, 2);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 24 ? shake(a % 8, 6, a < 8 ? 3 : 2) : 0 }; },
  },

  // ---------------- Usapus
  // Hind Kick: it hops and lashes out with both hind feet, and ropes go up round the foe for the bout.
  kick: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => { if (a > 4) ropes(E.x, E.y, 9, fade(a, 26, 6)); }); },
    front(r) {
      landings(r, 14, (E, a) => { const dir = Math.sign(E.x - r.from.x) || 1; if (a < 6) { blit(['bpppp', 'bbbpp'], E.x - dir * (6 - a), E.y - 1, { b: HARE.brown, p: HARE.pale }, 1, 1, dir < 0); blit(['bpppp', 'bbbpp'], E.x - dir * (6 - a), E.y + 2, { b: HARE.brown, p: HARE.pale }, 1, 1, dir < 0); } sparks(E.x, E.y, a, 6, r.seed, HARE.pale, 8, 7); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Zigzag: it darts off in a zigzag trail, and the ally coming in stands in a pale ring.
  bolt: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, dir = face(r), u = prog(t, 0, hitOf(r)), L = hold(t, 0, r.end, 4);
      let p0 = { x: U.x, y: U.y + 2 };
      for (let q = 1; q <= 6 * u; q++) { const p1 = { x: U.x - dir * q * 3, y: U.y + 2 + (q % 2 ? -3 : 3) }; line(p0.x, p0.y, p1.x, p1.y, q % 2 ? HARE.pale : HARE.brown, L); p0 = p1; }
      landings(r, 16, (E, a) => { arc(E.x, E.y, 7, 6, HARE.pale, fade(a, 16, 6)); arc(E.x, E.y, 8, 7, HARE.brown, 0.5 * fade(a, 16, 6), 0.5, 1); });
    },
  },

  // Thump Ring: it thumps the ground, stones jump, the ground heaves, and ropes go up round every foe for a bout.
  freeze: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a, i) => { if (i % 2) return; ringOut(E.x, E.y + 5, a, 16, HARE.rope, 12, 0.3); if (a > 4) ropes(E.x, E.y, 10, fade(a, 30, 6)); }, 2); },
    front(r) { flights(r, p => blit(['lb', 'bd'], p.x, p.y, { l: HARE.pale, b: HARE.brown, d: HARE.dark }, 1)); landings(r, 14, (E, a, i) => { if (i % 2 === 0) chunks(E.x, E.y + 3, a, 3, r.seed + i, [HARE.pale, HARE.brown], 0.9, 14); }); },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Box the Moon: it jabs at the spring moon over it, punches the moon across the sky, and the moon lands on the foe like a fist.
  madmarch: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), dir = face(r), M = { x: U.x + dir * 4, y: U.y - 13 };
      if (t < go) { oval(M.x, M.y, 4, 4, HARE.moon, 1); px(M.x - 1, M.y - 1, HARE.rope, 1); if ((t >> 2) & 1) paw(M.x - dir * 6, M.y + 2, dir, 1); }
      flights(r, p => { oval(p.x, p.y, 4, 4, HARE.moon, 1); px(p.x - 1, p.y - 1, HARE.rope, 1); tail(p.x, p.y, p.ux, p.uy, [HARE.moon, HARE.rope, HARE.brown], 2); });
      landings(r, 20, (E, a) => { sparks(E.x, E.y, a, 10, r.seed, HARE.moon, 10, 11); ringOut(E.x, E.y, a, 16, HARE.moon, 13, 0.8, HARE.rope); streaks(E.x, E.y, a, 16, Math.sign(E.x - r.from.x) || 1, HARE.pale, 3); }, 6);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0, glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
    lights(r) { const go = leaveOf(r); return [lit(r.t < go ? { x: r.from.x, y: r.from.y - 13 } : aim(r), HARE.moon, 1.2 * hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Mikapi
  // Crescent Edge: a crescent of moon spins across, its edge cuts the foe, and a small crescent stays on it, Moonlit.
  crescent: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => crescentAt(p.x, p.y, 4, p.a / 10, 1, 2));
      landings(r, 24, (E, a) => { moonCut(E.x, E.y, a, 12, Math.sign(E.x - r.from.x) || 1); if (a > 4) crescentAt(E.x + 6, E.y - 7, 2, 0.1, fade(a, 24, 6), 1); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Wane: two crescents circle Mikapi and close into a ring of moon phases round it, its shield, that thins as it holds.
  waning: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => crescentAt(p.x, p.y, 3, p.a / 12, 1, 1));
      landings(r, 24, (E, a) => { for (let q = 0; q < 6; q++) { if (a < q) continue; const ang = q / 6 * Math.PI * 2 + a * 0.03; crescentAt(E.x + Math.cos(ang) * 8, E.y + Math.sin(ang) * 6, 2, q / 6 + 0.5, fade(a, 24, 6), q % 3); } });
    },
  },

  // Thin Edge: it blinks, the thinnest paring of moon flies fast and long, and the foe's Moonlit mark breaks under the cut.
  lunarrush: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { const ang = Math.atan2(p.uy, p.ux) / (Math.PI * 2); crescentAt(p.x, p.y, 5, ang, 1, 0); tail(p.x, p.y, p.ux, p.uy, [PARING.pale, PARING.lilac, PARING.indigo], 2); });
      landings(r, 16, (E, a) => { const dir = Math.sign(E.x - r.from.x) || 1, n = Math.min(1, (a + 1) / 2); line(E.x - dir * 9, E.y - 3, E.x - dir * 9 + dir * 18 * n, E.y + 1, PARING.pale, fade(a, 12, 4)); line(E.x - dir * 9, E.y - 2, E.x - dir * 9 + dir * 18 * n, E.y + 2, PARING.lilac, fade(a, 12, 4)); for (let q = 0; q < 3; q++) px(E.x + 6 + q - a * 0.3, E.y - 7 + a * 0.5 + q, PARING.lilac, fade(a, 16, 5)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Waxes Full: a crescent over the foes waxes through its phases to a full moon, and four crescents rain down from it.
  fullphase: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, go = leaveOf(r), L = hold(t, 0, r.end, 6);
      for (const E of r.to) { const M = beside(E), ph = Math.min(4, Math.floor(prog(t, 0, go) * 5)); if (ph >= 4) { oval(M.x, M.y, 5, 5, PARING.pale, L); arc(M.x, M.y, 6, 6, PARING.lilac, L); } else crescentAt(M.x, M.y, 5, 0.5, L, 1 + ph * 2); }
    },
    front(r) {
      flights(r, p => crescentAt(p.x, p.y, 3, 0.25, 1, 1));
      landings(r, 20, (E, a, i) => { if (i % 4) return; for (let q = 0; q < 6; q++) { const ang = hash(r.seed + q) * Math.PI * 2, d = 5 + hash(r.seed + q * 3) * 6; if (((a + q * 2) % 6) < 3) glint(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.7, PARING.lilac, fade(a, 20, 6)); } moonCut(E.x, E.y, a, 12, 1, 8); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0, glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0 }; },
    lights(r) { return r.to.map(E => lit(beside(E), PARING.pale, 1.3 * hold(r.t, 0, r.end, 6), 14)); },
  },

  // ---------------- Hometa
  // Dust Tail: the comet's icy head flies at the foe with its long tail behind it and bursts in ice dust.
  dustmove: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => cometHead(p.x, p.y, p.ux, p.uy, 10));
      landings(r, 16, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, COMA.ice, 8, 8); dust(E.x, E.y + 3, a, 14, COMA.dust, COMA.ice, 2); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Frozen Core: shards of ice circle Hometa and freeze round it into a crust, hard and white.
  icecore: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => splinter(p.x, p.y, p.ux, p.uy, 4));
      landings(r, 24, (E, a) => { const L = fade(a, 24, 6); for (let q = 0; q < 6; q++) { if (a < q) continue; const ang = q / 6 * Math.PI * 2, x0 = E.x + Math.cos(ang) * 7, y0 = E.y + Math.sin(ang) * 6, x1 = E.x + Math.cos(ang + 1.05) * 7, y1 = E.y + Math.sin(ang + 1.05) * 6; line(x0, y0, x1, y1, q % 2 ? COMA.white : COMA.ice, L); } rime(E, a, 20, r.seed, 5, 6); });
    },
  },

  // Tail Sweep: the comet's dust tail sweeps through the foes in a long gray-blue band and leaves them in its haze.
  streak: {
    noFlights: true, noLandings: true,
    front(r) {
      const dir = face(r);
      flights(r, p => { if (p.f.i) return; for (let i = 0; i < 14; i++) px(p.x - dir * i, p.y + Math.round(Math.sin(i / 2 + p.a / 2)), i < 3 ? COMA.white : i < 8 ? COMA.ice : COMA.dust, i < 10 ? 1 : 0.5); });
      landings(r, 18, (E, a, i) => { if (i % 4) return; dust(E.x, E.y + 2, a, 18, COMA.dust, COMA.ice, 3, 5); });
    },
  },

  // Strike Home: Hometa rises, and three comets come back out of the sky on the foes with long tails and burst.
  impact: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a, i) => { if (i === 0) crackAt(E.x, E.y + 4, a, 22, COMA.ice, K, 12, r.seed); }, 5); },
    front(r) {
      flights(r, p => cometHead(p.x, p.y, p.ux, p.uy, 14, 1, true));
      landings(r, 20, (E, a, i) => { sparks(E.x, E.y, a, 10, r.seed + i, COMA.white, 10, 11); chunks(E.x, E.y + 2, a, 3, r.seed + i, [COMA.white, COMA.ice, COMA.blue], 1, 18, 2); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0, glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
    lights(r) { return r.to.map(E => lit(E, COMA.ice, 1.4 * hold(r.t, hitOf(r) - 4, hitOf(r) + 14, 4), 14)); },
  },

  // ---------------- Remaku
  // Fold Back: a fold of the curtain bends out from Remaku to the foe as a waving ribbon, and a fold of it stays on the foe to strike again.
  ripple: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), f = r.flights[0];
      if (f) { const a = t - f.t0; if (a >= 0 && a < f.dur + 10) ribbon({ x: U.x, y: U.y - 3 }, E, t, Math.min(1, (a + 1) / f.dur), a < f.dur + 6 ? 1 : (f.dur + 10 - a) / 4); }
      landings(r, 24, (P, a) => { if (a > 6) aurora(P.x, P.y - 8, 5, 8, t, fade(a, 24, 6)); sparks(P.x, P.y, a, 6, r.seed, AURORA.green, 8, 7); }, 2);
    },
  },

  // Flicker: the curtain flickers on and off behind Remaku, and three stars run round it inside a ward.
  brighthour: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; if ((t >> 1) % 3) aurora(U.x, U.y - 12, 9, 13, t, hold(t, 0, r.end, 5)); },
    front(r) { flights(r, p => glint(p.x, p.y, AURORA.green, 1)); landings(r, 16, (E, a) => { arc(E.x, E.y, 7, 6, AURORA.pale, fade(a, 16, 6)); arc(E.x, E.y, 8, 7, AURORA.green, 0.5 * fade(a, 16, 6), 0.5, 1); }); },
  },

  // Green Bands: green bands of light wave across and wrap round each foe, slowing it.
  bands: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { px(p.x, p.y, AURORA.pale); px(p.x - 1, p.y, AURORA.green); px(p.x - 2, p.y + 1, AURORA.purple); });
      landings(r, 24, (E, a, i) => { if (i % 4) return; const L = fade(a, 24, 6), n = Math.min(1, (a + 1) / 6); for (let q = 0; q < 3; q++) arc(E.x, E.y - 3 + q * 3, 7, 2, q % 2 ? AURORA.purple : AURORA.green, L, 0, n); });
    },
  },

  // Draw Close: curtains of light hang down on both sides of the foe and close round it, a glyph of light under it.
  encore: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, r.end, 6), c = ease(prog(t, 0, hit));
      for (const s of [-1, 1]) aurora(E.x + s * (16 - 8 * c), E.y - 14, 4, 18, t + s * 5, L);
      if (t >= hit) { const a = t - hit; arc(E.x, E.y + 5, 8, 2.5, AURORA.green, fade(a, 30, 8)); arc(E.x, E.y + 5, 6, 2, AURORA.pale, fade(a, 30, 8), (a * 0.02) % 1, (a * 0.02) % 1 + 0.6); }
    },
    front(r) { landings(r, 20, (E, a) => { for (let q = 0; q < 5; q++) { const ang = hash(r.seed + q) * Math.PI * 2, d = 5 + hash(r.seed + q * 3) * 5; if (((a + q * 2) % 6) < 3) glint(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.7, AURORA.green, fade(a, 20, 6)); } }); },
    scene(r) { const a = r.t - hitOf(r); return { glare: a >= 0 && a < 3 ? 0.375 - a * 0.1 : 0 }; },
    lights(r) { return [lit(aim(r), AURORA.green, 1.4 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Sazuma
  // Sand Arc: grains of sand jag over in arcs, burst on the foes, and a small fork of glass stands where each was struck.
  arcbolt: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a, i) => { if (i % 3 === 0) glassFork(E.x + 6, E.y + 5, Math.min(5, a), r.seed + i, fade(a, 24, 6)); }); },
    front(r) {
      flights(r, p => { px(p.x, p.y, W); px(p.x - p.ux, p.y - p.uy, FULG.blue); px(p.x + 1, p.y + 1, FULG.sand); px(p.x - 1, p.y + 1, FULG.sand); });
      landings(r, 12, (E, a, i) => { if (i % 3 === 0) sparks(E.x, E.y, a, 8, r.seed + i, FULG.blue, 8, 8); }, 2);
    },
  },

  // Same Place: a bolt strikes the foe from Sazuma, and a fork of glass shoots up out of the sand where it hit.
  fork: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => glassFork(E.x + 4, E.y + 5, Math.min(7, a), r.seed, fade(a, 26, 6))); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r);
      if (t >= go && t < hit + 3) glassBolt({ x: U.x, y: U.y - 4 }, E, r.seed + (t >> 1), t < hit + 1 ? 1 : 0.5, 6);
      landings(r, 12, (P, a) => { if (a < 3) oval(P.x, P.y, 3 - a, 3 - a, W, 1); sparks(P.x, P.y, a, 6, r.seed, FULG.blue, 8, 7); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Flash Over: it blinks, a bolt jags across to the foe, and a white mark scorches the sand under it for the next strike.
  flash: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => { const L = fade(a, 26, 6); line(E.x - 3, E.y + 3, E.x + 3, E.y + 6, W, L); line(E.x + 3, E.y + 3, E.x - 3, E.y + 6, FULG.blue, L); }); },
    front(r) {
      flights(r, p => { glassBolt({ x: p.x - p.ux * 8, y: p.y - p.uy * 8 }, p, r.seed + (p.a >> 1), 1, 3); px(p.x, p.y, W); });
      landings(r, 12, (P, a) => sparks(P.x, P.y, a, 6, r.seed, FULG.blue, 8, 7), 2);
    },
  },

  // Whole Sky: the sky opens, bolts come down on every foe, and forks of glass shoot up out of the sand round them.
  thundergod: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a, i) => glassFork(E.x - 8 + (i % 5) * 4, E.y + 5, Math.min(4 + (i % 3), a), r.seed + i, fade(a, 30, 8))); },
    front(r) {
      flights(r, p => { glassBolt({ x: p.x + 3, y: Math.max(0, p.y - 18) }, p, r.seed + (p.a >> 1) + p.f.i * 5, 1, 4); });
      landings(r, 14, (E, a, i) => { if (a < 2) oval(E.x - 8 + (i % 5) * 4, E.y, 2, 3, W, 1); if (i % 2 === 0) sparks(E.x, E.y, a, 8, r.seed + i, FULG.blue, 8, 9); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0, glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0, dark: 0.25 * hold(r.t, 0, hitOf(r) + 4, 4) }; },
    lights(r) { return r.to.map(E => lit(E, FULG.blue, 1.5 * hold(r.t, hitOf(r) - 2, hitOf(r) + 12, 3), 16)); },
  },

  // ---------------- Kakeha
  // Ring Strike: the halo flies edge-on at the foe, strikes in rings of light, and a gold fleck goes home to heal.
  smite: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => haloRing(p.x, p.y, 4, p.a * 3, 1, (p.a >> 2) & 1 ? 0.35 : 0.8));
      landings(r, 18, (E, a) => { ringOut(E.x, E.y, a, 14, HALO.cream, 10, 0.4, HALO.gold); takeBack(E, r.from, a - 4, 12, 2, HALO.gold, HALO.cream); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Hover Over: a halo comes down over the ally's head and stays there, glowing, as it heals.
  aegis: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => haloRing(p.x, p.y - 4, 4, p.a * 3));
      landings(r, 30, (E, a) => { haloRing(E.x, E.y - 7 + Math.min(2, a >> 1), 5, a * 2, fade(a, 30, 8)); motes(E.x, E.y + 2, a, 18, 5, r.seed, [HALO.gold, HALO.cream], 6, 10); });
    },
  },

  // Lit Rim: the halo spins out flat like a blade, cuts the foe with its gold rim, and comes back.
  sanctify: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { haloRing(p.x, p.y, 5, p.a * 4, 1, 0.3); tail(p.x, p.y, p.ux, p.uy, [HALO.cream, HALO.gold], 3); });
      landings(r, 12, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x + 6, E.y - 3, E.x + 6 - 12 * n, E.y - 3 + 5 * n, HALO.cream, fade(a, 12, 4), HALO.gold); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Crowned: three halos come down over the ally one on another, and a pillar of pale light stands round it.
  intervention: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, hit - 2, r.end, 6); if (L > 0) { const h = Math.round(26 * out(prog(t, hit - 2, hit + 4))); for (let s = -4; s <= 4; s++) dither(E.x + s, E.y + 5 - h, 1, h, Math.abs(s) === 4 ? HALO.gold : Math.abs(s) > 1 ? HALO.cream : W, (Math.abs(s) > 2 ? 0.5 : 0.75) * L); } },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r);
      flights(r, p => haloRing(p.x, p.y - 4, 5, p.a * 3));
      landings(r, 40, (P, a, i) => haloRing(P.x, P.y - 7 - i * 3, 6 - i, a * 2 + i * 5, fade(a, 40, 8)));
      if (t > hit) motes(E.x, E.y + 3, t - hit, 20, 6, r.seed, [HALO.gold, W], 7, 14);
    },
    scene(r) { const a = r.t - hitOf(r); return { glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0 }; },
    lights(r) { return [lit(aim(r), HALO.cream, 1.5 * hold(r.t, hitOf(r) - 2, r.end, 6), 16)]; },
  },

  // ---------------- Tekage
  // Dusk Edge: it lunges in shadow, and its gold-rimmed edge cuts across the foe in a curve of corona light.
  shade: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, UMBRA.dark, UMBRA.void, 4, 3); },
    front(r) {
      landings(r, 14, (E, a) => { const n = Math.min(1, (a + 1) / 3), L = fade(a, 14, 4); arc(E.x + 3, E.y - 3, 8, 7, UMBRA.sky, L, 0.3, 0.3 + 0.35 * n); arc(E.x + 3, E.y - 2, 7, 6, UMBRA.gold, L, 0.3, 0.3 + 0.35 * n); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Blot Out: an eclipse slides over Tekage and stays, its corona flickering, to block the next move.
  blot: {
    noFlights: true, noLandings: true,
    front(r) {
      landings(r, 30, (E, a) => { const u = ease(prog(a, 0, 6)), L = fade(a, 30, 8); arc(E.x, E.y, 7, 7, UMBRA.sky, L); for (let q = 0; q < 8; q++) { const ang = q / 8 * Math.PI * 2 + (a >> 2) * 0.2; px(E.x + Math.cos(ang) * (9 + (q + (a >> 1)) % 2), E.y + Math.sin(ang) * (9 + (q + (a >> 1)) % 2), q % 2 ? UMBRA.gold : UMBRA.sky, L); } if (u < 1) arc(E.x - 10 + 10 * u, E.y, 6, 6, UMBRA.gray, L); });
    },
  },

  // Noon Dark: it blinks, a disc of shadow flies at the foe and cracks the ground, and the foe's shadow stretches away from it.
  umbralstep: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => { crackAt(E.x, E.y + 4, a, 18, UMBRA.sky, K, 8, r.seed); const dir = Math.sign(E.x - r.from.x) || 1, n = Math.round(14 * out(prog(a, 0, 10))); dither(Math.min(E.x, E.x + dir * n), E.y + 5, n, 2, UMBRA.void, 0.75 * fade(a, 22, 6)); }, 2); },
    front(r) { flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [UMBRA.gray, UMBRA.dark]); eclipse(p.x, p.y, 2, p.a, 1); }); },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Full Eclipse: over the foe a black disc slides across the sun, the corona flares round it, and the light goes out.
  paranoia: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), S = beside(E), L = hold(t, 0, r.end, 6), u = ease(prog(t, 0, hit));
      oval(S.x, S.y, 5, 5, UMBRA.gold, L); oval(S.x, S.y, 4, 4, '#fff4c0', L);
      if (u < 1) oval(S.x - 12 + 12 * u, S.y, 5, 5, UMBRA.void, L);
      else eclipse(S.x, S.y, 5, t, L);
    },
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [UMBRA.gray, UMBRA.dark]); eclipse(p.x, p.y, 2, p.a, 1); });
      landings(r, 22, (E, a) => { for (let q = 0; q < 10; q++) { const ang = a * 0.25 + q * 0.63, rr = 11 - ((a * 0.5 + q * 2) % 9); px(E.x + Math.cos(ang) * rr, E.y + Math.sin(ang) * rr * 0.6, q % 3 ? UMBRA.sky : UMBRA.gold, fade(a, 22, 6)); } }, 6);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0, dark: 0.375 * hold(r.t, hitOf(r) - 6, r.end, 6) }; },
    lights(r) { return [lit(beside(aim(r)), UMBRA.gold, 1.4 * hold(r.t, 0, hitOf(r), 6), 14)]; },
  },

  // ---------------- Enneshi
  // Red Streak: the red star streaks across like a falling star and bursts on the foe, which keeps burning.
  sign: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { for (let i = 1; i < 9; i++) px(p.x - p.ux * i, p.y - p.uy * i, i < 3 ? OMEN.orange : OMEN.red, i < 6 ? 1 : 0.5); redStar(p.x, p.y, 2, p.a); });
      landings(r, 18, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, OMEN.red, 8, 8); cinders(E.x, E.y, a, 18, r.seed); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Red Sky: the red star rises over Enneshi, the sky reddens, and three small red stars circle it.
  badnews: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 8); wash(OMEN.red, 0.0625 * L); },
    front(r) {
      const t = r.t, U = r.from, B = beside(U), L = hold(t, 0, r.end, 6);
      redStar(B.x, B.y + 4 - 4 * ease(prog(t, 0, 12)), 4, t, L);
      flights(r, p => redStar(p.x, p.y, 1, p.a + p.f.i * 2));
      landings(r, 18, (E, a) => motes(E.x, E.y + 2, a, 18, 5, r.seed, [OMEN.orange, OMEN.pale], 6, 10));
    },
    lights(r) { return [lit(beside(r.from), OMEN.red, 1.3 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // On Its Way: the red star hangs over the foe, a red ring marks the ground under it, and a stone drops slowly out of the star.
  unlucky: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6); arc(E.x, E.y + 5, 7, 2, OMEN.red, L); arc(E.x, E.y + 5, 4, 1.2, OMEN.orange, L * ((t >> 3) & 1 ? 1 : 0.5)); landings(r, 18, (P, a) => crackAt(P.x, P.y + 4, a, 18, OMEN.orange, K, 8, r.seed), 2); },
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, hitOf(r) + 6, 4);
      redStar(E.x, Math.max(8, E.y - 18), 3, t, L);
      flights(r, p => { blit(['og', 'gk'], p.x, p.y, { o: OMEN.orange, g: OMEN.gray, k: '#5a4a4a' }, 1); px(p.x, p.y - 3, OMEN.red, 0.5); });
      landings(r, 14, (P, a) => chunks(P.x, P.y + 2, a, 4, r.seed, [OMEN.gray, OMEN.orange], 1, 14), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Ill Omen: the red star hangs over the foe in the dark, three red omens close round it, and its star is cut under the foe with three marks of Doom.
  doom: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { landings(r, 40, (E, a) => { const L = fade(a, 40, 8); for (let q = 0; q < 8; q++) { const ang = q / 8 * Math.PI * 2; line(E.x, E.y + 5, E.x + Math.cos(ang) * 8 * Math.min(1, a / 6), E.y + 5 + Math.sin(ang) * 2.5 * Math.min(1, a / 6), q % 2 ? OMEN.orange : OMEN.red, L); } }); },
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6);
      redStar(beside(E).x, beside(E).y, 5, t, L);
      flights(r, p => blit(['r.r', '.o.', 'r.r'], p.x, p.y, { r: OMEN.red, o: OMEN.orange }, 1));
      landings(r, 40, (P, a) => { for (let q = 0; q < 3; q++) if (a > 6 + q * 3) px(P.x - 3 + q * 3, P.y - 8, q === 2 ? W : OMEN.red, fade(a, 40, 8)); });
    },
    scene(r) { return { dark: 0.25 * hold(r.t, 0, r.end, 8) }; },
    lights(r) { return [lit(beside(aim(r)), OMEN.red, 1.4 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Honoki
  // Sunspot: a blob of the sun with a dark spot on it flies at the foe and bursts into flame.
  sear: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [SOL.amber, SOL.deep, SOL.ash]); sunBlob(p.x, p.y, p.a); });
      landings(r, 18, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, SOL.amber, 8, 8); cinders(E.x, E.y, a, 18, r.seed); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Leap Out: a loop of fire leaps out of Honoki as it dashes, two blobs ride it to the foe, and they burst.
  flashpoint: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, SOL.amber, SOL.deep); },
    front(r) {
      const t = r.t, E = aim(r), go = leaveOf(r), hit = hitOf(r);
      if (t >= go - 2 && t < hit + 6) solarLoop(r.from, E, 10, t, hold(t, go - 2, hit + 6, 3), prog(t, go - 2, hit));
      flights(r, p => sunBlob(p.x, p.y, p.a));
      landings(r, 18, (P, a) => { sparks(P.x, P.y, a, 8, r.seed, SOL.amber, 8, 9); cinders(P.x, P.y, a, 18, r.seed); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Solar Loop: a loop of fire arches out from Honoki onto the foe and runs back, and a small loop leaps on to the foe's first reserve.
  prominence: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, leaveOf(r) - 2, r.end - 4, 4);
      if (L > 0) solarLoop(r.from, E, 12, t, L);
      flights(r, p => sunBlob(p.x, p.y, p.a));
      landings(r, 22, (P, a) => { sparks(P.x, P.y, a, 8, r.seed, SOL.amber, 8, 8); const B = { x: P.x + (P.x > 48 ? 14 : -14), y: P.y + 3 }; if (a > 4 && a < 18) solarLoop(P, B, 5, t, 1, prog(a, 4, 10)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Burn Down: loops of fire burst round Honoki, then it burns down into a dark cinder shell with the fire showing through its cracks.
  supernova: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, hit + 4, 4);
      for (let q = 0; q < 5; q++) { const a0 = q / 5 * Math.PI * 2 + t * 0.05, a1 = a0 + 0.9; if (L > 0) solarLoop({ x: U.x + Math.cos(a0) * 5, y: U.y + Math.sin(a0) * 4 }, { x: U.x + Math.cos(a1) * 5, y: U.y + Math.sin(a1) * 4 }, 5 + 3 * Math.sin(t / 4 + q), t + q * 3, L); }
    },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, hit - 2, r.end, 6);
      flights(r, p => sunBlob(p.x, p.y, p.a));
      if (L > 0) { const u = ease(prog(t, hit - 2, hit + 6)); oval(U.x, U.y + 1, 6 * u, 5 * u, SOL.ash, L); arc(U.x, U.y + 1, 6 * u, 5 * u, SOL.deep, L, 0.5, 1); for (let q = 0; q < 4; q++) { const ang = q * 1.6 + 0.3; if ((t + q * 3) % 8 < 5) line(U.x + Math.cos(ang) * 2 * u, U.y + 1 + Math.sin(ang) * 2 * u, U.x + Math.cos(ang) * 5 * u, U.y + 1 + Math.sin(ang) * 4 * u, SOL.amber, L); } }
      landings(r, 20, (E, a) => cinders(E.x, E.y, a, 20, r.seed, 8));
    },
    scene(r) { return { dark: 0.125 * hold(r.t, hitOf(r), r.end, 6) }; },
    lights(r) { return [lit(r.from, SOL.amber, 1.6 * hold(r.t, 0, hitOf(r) + 4, 4), 16)]; },
  },

  // ---------------- Tanpoka
  // Puff Blow: Tanpoka breathes out, three seeds fly fast under their fluff, and the Seeds in the foe bloom gold at once.
  dandle_sow: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { seedPara(p.x, p.y, p.a); px(p.x - p.ux * 4, p.y - p.uy * 4, DANDLE.fluff, 0.5); });
      landings(r, 18, (E, a, i) => { if (i) return; for (let q = 0; q < 4; q++) goldBloom(E.x - 5 + (q % 2) * 10, E.y - 4 + (q >> 1) * 7, out(prog(a - q, 0, 6)), fade(a, 18, 6)); }, 2);
    },
  },

  // Seed Drift: five seeds drift over slowly in waves and catch in the foe, where they stay.
  dandle_spines: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => seedPara(p.x, p.y, p.a));
      landings(r, 30, (E, a, i) => { seedPara(E.x - 6 + i * 3, E.y - 3 + (i % 2) * 4, a, fade(a, 30, 8)); if (i === 0) dust(E.x, E.y + 4, a, 14, DANDLE.fluff, W, 2); });
    },
  },

  // Tell the Hour: four seeds circle Tanpoka, a clock of seed fluff opens under the foe, and its gold hand sweeps round so all comes due.
  dandle_snarl: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => { const L = fade(a, 26, 6); for (let q = 0; q < 12; q++) { const ang = q / 12 * Math.PI * 2; px(E.x + Math.cos(ang) * 9, E.y + 5 + Math.sin(ang) * 2.5, q % 3 ? DANDLE.fluff : W, L); } const h = -Math.PI / 2 + a * 0.4; line(E.x, E.y + 5, E.x + Math.cos(h) * 7, E.y + 5 + Math.sin(h) * 2, DANDLE.gold, L); }); },
    front(r) {
      flights(r, p => seedPara(p.x, p.y, p.a));
      landings(r, 22, (E, a) => { for (let q = 0; q < 3; q++) if (a > 4 + q * 3) goldBloom(E.x - 5 + q * 5, E.y + 3, out(prog(a - 4 - q * 3, 0, 5)), fade(a, 22, 6)); });
    },
  },

  // Blow Apart: Tanpoka's clock swells, it blows apart, and a storm of seeds sweeps over every foe and blooms gold in them.
  dandle_thornburst: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      if (t < go) clockBall(U.x, U.y - 9, 3 + 3 * prog(t, 0, go), t, 1);
      else if (t < go + 8) for (let q = 0; q < 10; q++) { const ang = q / 10 * Math.PI * 2, d = 6 + (t - go) * 1.5; px(U.x + Math.cos(ang) * d, U.y - 9 + Math.sin(ang) * d * 0.7, DANDLE.fluff, 1 - (t - go) / 8); }
      flights(r, p => seedPara(p.x, p.y - 2, p.a + p.f.i));
      landings(r, 20, (E, a, i) => { if (i % 4) return; for (let q = 0; q < 5; q++) goldBloom(E.x - 8 + q * 4, E.y - 4 + (q % 2) * 6, out(prog(a - q, 0, 6)), fade(a, 20, 6)); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, DANDLE.gold, 1.3 * hold(r.t, hitOf(r), r.end, 6), 14)); },
  },

  // ---------------- Mawkin
  // Kelp Swipe: a strand of dried kelp out of its stuffing lashes through the foe, and straw flies.
  mawkin_rattle: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => kelpStrand(p.x, p.y - 4, p.a, 8));
      landings(r, 14, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x + 6, E.y - 5, E.x + 6 - 12 * n, E.y - 5 + 9 * n, SCARE.straw, fade(a, 12, 4), SCARE.kelp); chunks(E.x, E.y, a, 4, r.seed, [SCARE.straw, SCARE.kelp], 0.9, 14); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Flap Up: a scarecrow rears up beside Mawkin and flaps its sleeves, crows fly up off it at the foe, and the foe takes fright.
  mawkin_terrify: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, B = beside(r.from);
      scarecrow(B.x, B.y + 2, t, hold(t, 0, hitOf(r) + 6, 4));
      flights(r, p => blit((p.a >> 1) & 1 ? ['p...p', 'pp.pp', '..p..'] : ['.....', 'pp.pp', 'p.p.p'], p.x, p.y, { p: SCARE.purple }, 1, 1, p.ux < 0));
      landings(r, 20, (E, a) => daze(E, a, 20, SCARE.purple, SCARE.straw));
    },
  },

  // Pick Clean: Mawkin flinches, three crows zigzag over and peck the foe, and straw flecks of what they took come home.
  mawkin_glean: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => blit((p.a >> 1) & 1 ? ['p...p', 'pp.pp', '..c..'] : ['.....', 'pp.pp', 'p.c.p'], p.x, p.y, { p: SCARE.purple, c: SCARE.coat }, 1, 1, p.ux < 0));
      landings(r, 20, (E, a, i) => { if (a < 6) { const n = Math.min(1, (a + 1) / 3); line(E.x - 3 + i * 3, E.y - 4, E.x - 1 + i * 3, E.y - 4 + 6 * n, SCARE.coat, 1 - a / 6); } if (i === 0) takeBack(E, r.from, a - 4, 14, 3, SCARE.straw, SCARE.coat); }, 2);
    },
  },

  // Crows Come In: the scarecrow spreads its arms high in the dark, crows come in from every side onto every foe, and they claw.
  mawkin_crowstorm: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, B = beside(r.from);
      scarecrow(B.x, B.y + 2, t, hold(t, 0, r.end - 6, 6), 2);
      flights(r, p => blit((p.a >> 1) & 1 ? ['p...p', 'pp.pp', '..c..'] : ['.....', 'pp.pp', 'p.c.p'], p.x, p.y, { p: SCARE.purple, c: SCARE.coat }, 1, 1, p.ux < 0));
      landings(r, 18, (E, a, i) => { if (i % 4) return; for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 9 * n, q === 1 ? SCARE.coat : SCARE.straw, fade(a, 14, 4)); } daze(E, a, 18, SCARE.purple, SCARE.straw); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
  },

  // ---------------- Teraba
  // Nick: one blade flies straight off it, nicks the foe, and lodges there.
  fleam_pierce: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => lancet(p.x, p.y, p.ux, p.uy));
      landings(r, 26, (E, a) => { const n = Math.min(1, (a + 1) / 2); line(E.x + 5, E.y - 4, E.x + 5 - 10 * n, E.y - 4 + 7 * n, FLEAM.shine, fade(a, 8, 3)); if (a > 2) lodged(E.x + 3, E.y - 1, 1, fade(a, 26, 6)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 3) }; },
  },

  // Draw Blades: every blade in the foe pulls out at once and flies home to Teraba, and it bleeds where they were.
  fleam_rend: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { const back = p.u > 0.5; lancet(p.x, p.y, back ? -p.ux : p.ux, back ? -p.uy : p.uy); });
      const t = r.t, E = aim(r);
      if (t < leaveOf(r) + 4) for (let q = 0; q < 4; q++) lodged(E.x - 4 + q * 3, E.y - 3 + (q % 2) * 4, q % 2 ? 1 : -1, 1);
      landings(r, 18, (P, a, i) => { if (i % 3 === 0) { const n = Math.min(1, (a + 1) / 3); line(P.x - 5, P.y - 4, P.x - 5 + 10 * n, P.y - 4 + 8 * n, FLEAM.teal, fade(a, 10, 4)); } bleed(P, a, 18, 2, r.seed + i, FLEAM.blood); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 3) }; },
  },

  // Score: two blades jag across and score the foe in a claw of teal cuts, and the blades in it double.
  fleam_notch: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => lancet(p.x, p.y, p.ux, p.uy));
      landings(r, 24, (E, a, i) => { if (i) return; for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 9 * n, q === 1 ? FLEAM.teal : FLEAM.shine, fade(a, 12, 4)); } if (a > 5) for (let q = 0; q < 4; q++) lodged(E.x - 5 + q * 3, E.y + (q % 2) * 3, q % 2 ? 1 : -1, fade(a, 24, 6)); bleed(E, a, 20, 3, r.seed, FLEAM.blood); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Lancing: Teraba spins and its six blades fan out round it, fly, and open the foe so it bleeds, and an ally comes in.
  fleam_openvein: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => lancet(p.x, p.y, p.ux, p.uy));
      landings(r, 22, (E, a, i) => { if (i === 0) { const n = Math.min(1, (a + 1) / 3); thick(E.x + 7, E.y - 6, E.x + 7 - 14 * n, E.y - 6 + 11 * n, FLEAM.teal, fade(a, 12, 4), FLEAM.shine); daze(E, a, 22, FLEAM.teal, FLEAM.shine); } bleed(E, a, 22, 2, r.seed + i, FLEAM.blood); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(aim(r), FLEAM.teal, 1.2 * hold(r.t, hitOf(r) - 2, hitOf(r) + 14, 4), 12)]; },
  },

  // ---------------- Cutaru
  // Slop Over: the cask tips and brine slops out of it over the foes in lobbing drops that splash.
  vat_rollcask: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r) + 4) { cask(U.x, U.y - 9, 3, 6, 0, 1); for (let q = 0; q < 3; q++) px(U.x + face(r) * (3 + q), U.y - 12 + q, VAT.brine, 1); }
      flights(r, p => bead(p.x, p.y, VAT.foam, VAT.brine));
      landings(r, 16, (E, a, i) => { if (i % 5 === 0) crown(E.x, E.y + 4, a, 16, VAT.foam, VAT.brine, 7); });
    },
  },

  // Barrel In: it rolls in like a cask on its side, staves turning, and bursts on the foe in brine.
  vat_bodyslam: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, VAT.brine, K, 9, r.seed), 3); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit) for (const s of [-1, 1]) for (let i = 0; i < 9; i++) px(U.x + s * 5, U.y - 4 + i, ((i + t) >> 1) & 1 ? VAT.wood : VAT.hoop, 1);
      landings(r, 18, (E, a) => { crown(E.x, E.y + 2, a, 16, VAT.foam, VAT.brine, 8, 1.2); daze(E, a, 18, VAT.brine, VAT.foam); }, 3);
    },
    scene(r) { return { jolt: jolts(r, 2, 8) }; },
  },

  // Top Up: brine rises into Cutaru from round its feet, and its hoops pull tight round it one by one.
  vat_drinkup: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => bead(p.x, p.y, VAT.foam, VAT.brine));
      landings(r, 26, (E, a) => { const L = fade(a, 26, 6); for (let q = 0; q < 3; q++) if (a >= q * 3) { const w = 6 + Math.max(0, 3 - (a - q * 3)); dither(E.x - w, E.y - 3 + q * 3, 2 * w + 1, 1, VAT.hoop, L); px(E.x - w, E.y - 3 + q * 3, '#8a8098', L); } for (let q = 0; q < 4; q++) { const aa = a - q * 3; if (aa >= 0 && aa < 10) px(E.x - 3 + q * 2, E.y - 2 - aa * 0.6, VAT.foam, 1 - aa / 10); } });
    },
  },

  // Burst Hoops: Cutaru swells till its hoops burst off, and a wave of brine breaks over every foe and washes them out.
  vat_caskburst: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, go = leaveOf(r);
      if (t < go) { const s = 6 + prog(t, 0, go) * 4; for (let q = 0; q < 3; q++) dither(U.x - s, U.y - 3 + q * 3, 2 * s + 1, 1, VAT.hoop, 1); }
      else if (t < go + 12) for (let q = 0; q < 4; q++) { const a = t - go, ang = q * 1.57 + 0.4; arc(U.x + Math.cos(ang) * a * 1.5, U.y + Math.sin(ang) * a + 0.1 * a * a, 3, 1.5, VAT.hoop, 1 - a / 12); }
      flights(r, p => { const dir = p.ux >= 0 ? 1 : -1; blit(['.ff', 'fbb', 'bbb'], p.x, p.y, { f: VAT.foam, b: VAT.brine }, 1, 1, dir < 0); });
      landings(r, 22, (E, a, i) => { if (i % 4 === 0) { crown(E.x, E.y + 4, a, 18, VAT.foam, VAT.brine, 8, 1.4); streaks(E.x, E.y, a, 16, Math.sign(E.x - r.from.x) || 1, VAT.foam, 3); } }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, VAT.brine, 1.2 * hold(r.t, hitOf(r) - 2, hitOf(r) + 14, 4), 14)); },
  },

  // ---------------- Karrum
  // Run Over: its wheels turn under it as it rolls in, and it runs the foe down, leaving two ruts.
  wain_trundle: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => { const L = fade(a, 24, 6), n = Math.round(12 * Math.min(1, (a + 1) / 4)); dither(E.x - n, E.y + 4, 2 * n, 1, WAIN.dark, L); dither(E.x - n, E.y + 6, 2 * n, 1, WAIN.dark, L); }, 2); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit + 2) { wheel(U.x - 3, U.y + 4, 3, t * 0.6, 1); wheel(U.x + 4, U.y + 4, 3, t * 0.6, 1); hay(U.x, U.y - 2, t, face(r), 1, 3); }
      landings(r, 16, (E, a) => chunks(E.x, E.y + 2, a, 4, r.seed, [WAIN.hay, WAIN.pale, WAIN.dark], 1, 16), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Into the Rut: three clods lob onto the foe, and a deep rut breaks open under it that holds it fast.
  wain_rut: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 28, (E, a, i) => { if (i) return; const L = fade(a, 28, 6), n = Math.round(10 * Math.min(1, (a + 1) / 5)); for (const yy of [E.y + 4, E.y + 7]) { dither(E.x - n, yy, 2 * n + 1, 1, '#2a2228', L); dither(E.x - n, yy - 1, 2 * n + 1, 1, WAIN.pale, L * 0.5); } }); },
    front(r) { flights(r, p => blit(['lp', 'pd'], p.x, p.y, { l: WAIN.hay, p: WAIN.pale, d: WAIN.dark }, 1)); landings(r, 14, (E, a, i) => chunks(E.x, E.y + 3, a, 3, r.seed + i, [WAIN.pale, WAIN.dark], 0.9, 14), 2); },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Chock Wheels: it stamps down, two wooden chocks slam in by its wheels, and it holds where it stands.
  wain_chock: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, r.end, 4);
      wheel(U.x - 4, U.y + 4, 3, 0, L); wheel(U.x + 4, U.y + 4, 3, 0, L);
      flights(r, p => blit(['.r', 'rr'], p.x, p.y, { r: WAIN.red }, 1));
      if (t >= hit - 3) for (const s of [-1, 1]) { const x = U.x + s * (9 + Math.max(0, hit - t)); blit(s < 0 ? ['..d', '.dd', 'ddd'] : ['d..', 'dd.', 'ddd'], x, U.y + 6, { d: WAIN.red }, L); }
      landings(r, 14, (E, a) => ringOut(E.x, E.y + 2, a, 14, WAIN.pale, 12, 0.6, WAIN.red));
    },
  },

  // Runaway Cart: its wheels spin up while it shudders, then it runs away down on the foe, shedding hay, and smashes into it.
  wain_runaway: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { smear(r, WAIN.pale, WAIN.hay, 4, 3); landings(r, 22, (E, a) => crackAt(E.x, E.y + 4, a, 22, WAIN.red, K, 12, r.seed), 5); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), sp = 0.3 + 0.8 * prog(t, 0, hit);
      if (t < hit + 2) { wheel(U.x - 4, U.y + 4, 3, t * sp, 1); wheel(U.x + 4, U.y + 4, 3, t * sp, 1); hay(U.x, U.y - 2, t, face(r), 1, 5); }
      landings(r, 22, (E, a) => { chunks(E.x, E.y, a, 6, r.seed, [WAIN.hay, WAIN.pale, WAIN.red, WAIN.dark], 1.3, 20, 2); sparks(E.x, E.y, a, 8, r.seed, WAIN.hay, 8, 10); daze(E, a, 22, WAIN.red, WAIN.hay); }, 6);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 3 : 1) : r.t < hitOf(r) - 6 ? shake(r.t, 40, 1) : 0 }; },
  },

  // ---------------- Talpara
  // Nibble: it darts in nose first, its star of a nose spreads, and it nibbles three times quick.
  talpa_gnaw: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit) starNose(U.x + face(r) * 5, U.y, 2, t, 1);
      landings(r, 16, (E, a) => { for (let q = 0; q < 3; q++) { const aa = a - q * 4; if (aa >= 0 && aa < 5) jaws(E.x - 3 + q * 3, E.y - 2 + q * 2, Math.max(0, 2 - aa), 2, MOLE.cream, MOLE.pink, 1); } starNose(E.x - face(r) * 6, E.y, 3, a, fade(a, 12, 4)); }, 2);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a % 4, 2, 1) : 0 }; },
  },

  // Dig Claw: sand spurts up under the foe, and Talpara's claws dig up out of a fresh molehill at it.
  talpa_erupt: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => molehill(E.x, E.y + 6, Math.min(3, a), fade(a, 22, 6))); },
    front(r) {
      flights(r, p => { px(p.x, p.y, MOLE.dirt); px(p.x + 1, p.y + 1, MOLE.soil); });
      landings(r, 14, (E, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y + 4, E.x - 3 + q * 3, E.y + 4 - 9 * n, q === 1 ? MOLE.cream : MOLE.pink, fade(a, 14, 4)); } chunks(E.x, E.y + 4, a, 4, r.seed, [MOLE.dirt, MOLE.soil], 1, 14); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Go to Earth: Talpara digs in, and a molehill heaps up over it with sand spurting off the top.
  talpa_burrow: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 5);
      molehill(U.x, U.y + 6, Math.round(6 * ease(prog(t, 2, hitOf(r)))), L);
      flights(r, p => { px(p.x, p.y, MOLE.dirt); px(p.x - 1, p.y + 1, MOLE.soil); });
      landings(r, 14, (E, a) => dust(E.x, E.y + 2, a, 14, MOLE.soil, MOLE.dirt, 2));
    },
  },

  // Surface Lunge: a ridge of soil runs along the ground to the foe, the molehill under it bursts, and its claws and star nose come up together.
  talpa_breach: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), hit = hitOf(r);
      if (t < hit) tunnelRidge({ x: S.x, y: S.y + 6 }, { x: E.x, y: E.y + 6 }, prog(t, 0, hit), 1);
      landings(r, 22, (P, a) => { molehill(P.x, P.y + 6, Math.max(0, 5 - (a >> 1)), fade(a, 22, 6)); crackAt(P.x, P.y + 5, a, 22, MOLE.pink, K, 10, r.seed); }, 5);
    },
    front(r) {
      landings(r, 20, (E, a) => { starNose(E.x, E.y + 2, 3 + Math.min(2, a >> 1), a, fade(a, 12, 4)); for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 5 + q * 5, E.y + 5, E.x - 4 + q * 5, E.y + 5 - 12 * n, MOLE.cream, fade(a, 14, 4)); } chunks(E.x, E.y + 4, a, 6, r.seed, [MOLE.dirt, MOLE.soil, MOLE.gray], 1.2, 20, 2); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0 }; },
  },

  // Bubble Sniff: it blows bubbles that wave over every foe, and its star nose sniffs out each one as the bubbles break.
  talpa_seek: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { arc(p.x, p.y, 2, 2, MOLE.cream, 1); px(p.x - 1, p.y - 1, W); });
      landings(r, 18, (E, a, i) => { if (i % 4) return; starNose(E.x + 6, E.y - 6, 2, a, fade(a, 18, 6)); for (let q = 0; q < 4; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 8) arc(E.x - 4 + q * 3, E.y + 2 - aa, 1, 1, MOLE.cream, 1 - aa / 8); } });
    },
  },

  // Mound Up: Talpara stamps from below, and a molehill heaves up under the foe and throws it.
  talpa_unburrow: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => molehill(E.x, E.y + 6, Math.round(5 * Math.sin(Math.PI * Math.min(1, a / 12))) + 1, fade(a, 22, 6)), 2); },
    front(r) { flights(r, p => { px(p.x, p.y, MOLE.dirt); px(p.x + 1, p.y + 1, MOLE.soil); }); landings(r, 18, (E, a) => { chunks(E.x, E.y + 3, a, 5, r.seed, [MOLE.dirt, MOLE.soil], 1.1, 16, 2); daze(E, a, 18, MOLE.pink, MOLE.cream); }, 2); },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Tunnel Past: a ridge of soil races along under the foe and past it, and the ground tears open in its wake.
  talpa_tunnel: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), hit = hitOf(r), dir = Math.sign(E.x - S.x) || 1;
      if (t < hit + 6) tunnelRidge({ x: S.x, y: S.y + 6 }, { x: E.x + dir * 12, y: E.y + 6 }, prog(t, 0, hit + 6), 1);
    },
    front(r) { landings(r, 12, (E, a) => { const n = Math.min(1, (a + 1) / 3); line(E.x - 6, E.y + 4, E.x - 6 + 12 * n, E.y + 4 - 8 * n, MOLE.pink, fade(a, 12, 4)); chunks(E.x, E.y + 4, a, 3, r.seed, [MOLE.dirt, MOLE.soil], 0.9, 12); }, 2); },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // ---------------- Kucella
  // Cold Draft: a draft of cellar cold waves over to the foe and frosts it, and a cold fleck of it heals its weakest at home.
  cellar_coldbreath: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => coldDraft(p.x, p.y, p.a, p.ux >= 0 ? 1 : -1));
      landings(r, 18, (E, a) => { rime(E, a, 16, r.seed, 6, 7); takeBack(E, r.from, a - 4, 12, 2, CELLAR.cold, W); });
    },
  },

  // Top Shelf: a cellar shelf comes down over the ally like a roof, jars and all, to keep it.
  cellar_shelf: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, r.end, 5), y = E.y - 9 - 6 * (1 - ease(prog(t, 0, hit)));
      shelf(E.x, y, 7, L);
      flights(r, p => blit(['c', 'j'], p.x, p.y, { c: CELLAR.cold, j: CELLAR.jar }, 1));
      landings(r, 16, (P, a) => ringOut(P.x, P.y, a, 16, CELLAR.cold, 10, 0.8, CELLAR.jar));
    },
  },

  // Frost Bite: it lunges, a bite of cold shuts on the foe with icicle teeth, and frost grows on it.
  cellar_frostrot: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, CELLAR.slate, CELLAR.earth); },
    front(r) {
      flights(r, p => { blit(['wc', 'cc'], p.x, p.y, { w: W, c: CELLAR.cold }, 1); });
      landings(r, 20, (E, a) => { jaws(E.x, E.y, Math.max(0, 5 - a * 2), 4, W, CELLAR.cold, fade(a, 12, 4)); rime(E, a - 4, 16, r.seed, 6, 8); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // ---------------- Mimato
  // Long Slap: it stretches out its whole length to the foe and slaps it twice.
  lumbric_stretch: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r), u = t < hit ? prog(t, go, hit) : 1 - prog(t, hit + 6, hit + 14);
      if (u > 0) worm(U, { x: U.x + (E.x - U.x) * u, y: U.y + (E.y - U.y) * u - 3 }, t, 1, 3);
      landings(r, 14, (P, a) => { for (let q = 0; q < 2; q++) { const aa = a - q * 4; if (aa >= 0 && aa < 6) { const n = Math.min(1, (aa + 1) / 2); line(P.x + 5 - q * 3, P.y - 5, P.x + 5 - q * 3 - 9 * n, P.y - 5 + 8 * n, q ? WORM.cream : WORM.pink, 1 - aa / 6); } } }, 2);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 3, 1) || shake(a - 4, 3, 1) }; },
  },

  // Squirm: it squirms and flings sand over the foes, and short worms wriggle at their feet.
  lumbric_wriggle: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i % 4 === 0) for (let q = 0; q < 2; q++) worm({ x: E.x - 8 + q * 10, y: E.y + 5 }, { x: E.x - 3 + q * 10, y: E.y + 5 }, a + q * 5, fade(a, 20, 6), 1); }); },
    front(r) {
      flights(r, p => { for (let g = 0; g < 3; g++) px(p.x + (hash(r.seed + g + p.a) - 0.5) * 5, p.y + (hash(r.seed + g * 3 + p.a) - 0.5) * 4, g % 2 ? WORM.sand : WORM.cream); });
      landings(r, 16, (E, a, i) => { if (i % 4 === 0) bleed(E, a, 16, 2, r.seed + i, WORM.pink); });
    },
  },

  // Sling Self: it whirls its length round and slings itself at the foe, the ground shakes, and a worm end curls up by it on guard.
  lumbric_fling: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, WORM.pink, WORM.dark); landings(r, 18, (E, a, i) => { if (i === 0) crackAt(E.x, E.y + 4, a, 18, WORM.cream, K, 9, r.seed); }, 2); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < r.motionAt[1]) { const a = t * 0.6; worm({ x: U.x, y: U.y }, { x: U.x + Math.cos(a) * 9, y: U.y + Math.sin(a) * 5 }, t, 1, 1); }
      landings(r, 16, (E, a, i) => { if (i === 0) chunks(E.x, E.y + 3, a, 4, r.seed, [WORM.sand, WORM.pink], 1, 16); daze(E, a, 16, WORM.pink, WORM.cream); }, 2);
      if (t >= hit) { const G = { x: r.from.x + face(r) * 10, y: r.from.y + 4 }; worm({ x: G.x - 3, y: G.y }, { x: G.x + 3, y: G.y - 2 }, t, hold(t, hit, r.end, 4), 1); }
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Loop Bounce: it loops itself into a hoop and bounces on the foe four times, and its sand casts break open to heal it.
  lumbric_bounce: {
    lead: 6, tail: 14, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, hitOf(r), 4); for (let q = 0; q < 3; q++) sandCast(U.x - 6 + q * 6, U.y + 6, L); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), a = t - hit;
      if (a >= -2 && a < 20) { const k = ((a % 5) + 5) % 5, y = E.y - 3 - Math.round(Math.sin(Math.PI * k / 5) * 7); arc(E.x, y, 4, 3, WORM.pink, 1); arc(E.x, y + 1, 4, 3, WORM.dark, 1, 0.1, 0.4); px(E.x - 4, y, WORM.cream, 1); }
      for (let q = 0; q < 4; q++) { const aa = a - q * 5; if (aa >= 0 && aa < 6) { const n = Math.min(1, (aa + 1) / 2); line(E.x + 5, E.y - 4, E.x + 5 - 10 * n, E.y - 4 + 7 * n, WORM.cream, 1 - aa / 6); } }
      if (a >= 20 && a < 36) motes(r.from.x, r.from.y + 4, a - 20, 16, 5, r.seed, [WORM.cream, WORM.pink], 7, 10);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 20 && a % 5 < 3 ? shake(a % 5, 3, a < 5 || a >= 15 ? 2 : 1) : 0 }; },
  },

  // ---------------- Kupas
  // Hobnail: it kicks, its hobnailed sole stamps the foe, and a gold nail sticks in where it struck.
  brogue_hobnail: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, BOOT.leather, BOOT.dark); },
    front(r) {
      landings(r, 22, (E, a) => { const dir = Math.sign(E.x - r.from.x) || 1; if (a < 8) bootPrint(E.x - dir * 2, E.y, dir, 1 - a / 8); sparks(E.x, E.y, a, 6, r.seed, BOOT.nail, 8, 7); if (a > 3) hobnail(E.x + 3, E.y - 3, fade(a, 22, 6)); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Scuff Mark: it stamps and scuffs a long smear of grit across the ground at the foe, and leaves it dazed.
  brogue_scuff: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => { const n = Math.round(12 * Math.min(1, (a + 1) / 5)), L = fade(a, 24, 6), dir = Math.sign(E.x - r.from.x) || 1; dither(Math.min(E.x - dir * 6, E.x - dir * 6 + dir * n), E.y + 4, n, 2, BOOT.leather, L); for (let i = 0; i < n; i += 3) px(E.x - dir * 6 + dir * i, E.y + 4, BOOT.nail, L); }); },
    front(r) { flights(r, p => { px(p.x, p.y + 3, BOOT.leather); px(p.x - 1, p.y + 4, BOOT.nail, 0.5); }); landings(r, 20, (E, a) => daze(E, a, 20, BOOT.purple, BOOT.nail)); },
  },

  // Tread Hard: a great hobnailed sole treads down on every foe and leaves its print studded with nails.
  brogue_tread: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => { bootPrint(E.x, E.y + 6, 1, fade(a, 26, 6)); crackAt(E.x, E.y + 4, a, 18, BOOT.nail, K, 9, r.seed); }, 2); },
    front(r) {
      const t = r.t, hit = hitOf(r);
      for (const E of r.to) { const u = ease(prog(t, hit - 6, hit)); if (t < hit + 2 && t >= hit - 6) blit(['.lllll..', 'lllllll.', 'lllllll.', '.dnldnl.'], E.x, E.y - 14 + 10 * u, { l: BOOT.leather, d: BOOT.dark, n: BOOT.nail }, 1, 2); }
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // Forced March: nails circle Kupas, then its boot prints march across the ground to the foe, left, right, and it holds the foe's eye.
  brogue_longmarch: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), hit = hitOf(r), dir = Math.sign(E.x - S.x) || 1, L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 6; q++) { const u = (q + 1) / 7; if (t >= q * ((hit - 4) / 6)) bootPrint(S.x + (E.x - S.x) * u, S.y + 6 + (E.y - S.y) * u + (q % 2 ? 2 : -1), dir, L); }
    },
    front(r) {
      flights(r, p => hobnail(p.x, p.y));
      landings(r, 22, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, BOOT.nail, 8, 9); daze(E, a, 22, BOOT.purple, BOOT.nail); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(aim(r), BOOT.purple, 1.2 * hold(r.t, hitOf(r) - 2, r.end, 5), 12)]; },
  },

  // ---------------- Herya
  // Pea Shot: Herya hops and shoots three peas that look back as they fly, and they burst on the foes.
  pod_pop: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [POD.green, POD.dark]); pea(p.x, p.y, p.a); });
      landings(r, 14, (E, a, i) => { if (i % 3) return; sparks(E.x, E.y, a, 8, r.seed + i, POD.green, 8, 8); chunks(E.x, E.y, a, 3, r.seed + i, [POD.green, POD.cream], 0.9, 12); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Grow Pods: peas lob over and splash the foe, and two new pods sprout on Herya's side to ripen.
  pod_setpods: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, S = r.from, hit = hitOf(r), dir = face(r); for (let q = 0; q < 2; q++) { const g = ease(prog(t, hit + q * 3, hit + 8 + q * 3)); if (g > 0) { line(S.x + dir * (10 + q * 6), S.y + 6, S.x + dir * (10 + q * 6), S.y + 6 - 3 * g, POD.dark, 1); peaPod(S.x + dir * (10 + q * 6), S.y + 2 - 3 * g, Math.round(2 + 2 * g), 0, hold(t, hit, r.end, 4)); } } },
    front(r) { flights(r, p => pea(p.x, p.y, p.a)); landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 14, POD.cream, POD.green, 6)); },
  },

  // Shell Out: Herya's pod splits down its seam and the old husk falls away in two halves.
  pod_shuck: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), a = t - hit;
      if (a < 0) peaPod(U.x, U.y - 7, 5, prog(t, 0, hit), 1);
      else if (a < 16) for (const s of [-1, 1]) { const x = U.x + s * (2 + a * 0.6), y = U.y - 7 + 0.1 * a * a; for (let i = -3; i <= 3; i++) px(x + i * 0.7, y + Math.abs(i) * 0.4 * s, POD.green, 1 - a / 16); }
      landings(r, 16, (E, a2) => motes(E.x, E.y + 2, a2, 16, 5, r.seed, [POD.cream, POD.green], 6, 10));
    },
  },

  // Pea Rain: a great pod opens over the foes, and its peas rain down on them, every one looking back.
  pod_shower: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, go = leaveOf(r), L = hold(t, 0, r.end - 6, 6);
      for (const E of r.to) { const B = { x: E.x, y: Math.max(8, E.y - 16) }; peaPod(B.x, B.y, 9, prog(t, 0, go), L); }
      flights(r, p => pea(p.x, p.y, p.a + p.f.i));
      landings(r, 14, (E, a, i) => { sparks(E.x + (i % 3 - 1) * 4, E.y, a, 5, r.seed + i, POD.green, 6, 6); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, POD.green, 1.2 * hold(r.t, hitOf(r) - 4, r.end, 5), 14)); },
  },

  // ---------------- Tobiku
  // Swing Shut: a trapdoor flips over and over across the gap and slams down on the foe with its eye shut tight.
  hatch_latch: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, HATCH.cyan, K, 8, r.seed), 2); },
    front(r) {
      flights(r, p => { const flat = (p.a >> 1) & 1; if (flat) dither(Math.round(p.x - 3), Math.round(p.y), 7, 2, HATCH.plank, 1); else dither(Math.round(p.x), Math.round(p.y - 3), 2, 7, HATCH.plank, 1); px(p.x, p.y, HATCH.lilac, 1); });
      landings(r, 16, (E, a) => { if (a < 8) { dither(E.x - 6, E.y - 6 + Math.min(4, a * 2), 13, 2, HATCH.plank, 1 - a / 8); doorEye(E.x, E.y - 6 + Math.min(4, a * 2), 0, 1 - a / 8); } chunks(E.x, E.y + 2, a, 4, r.seed, [HATCH.plank, HATCH.cyan], 1, 16); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Below Stairs: a hatch opens in the ground under the foe, its eye looks up, the foe goes down, and the door drops shut.
  hatch_shutin: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), open = t < hit ? ease(prog(t, 0, hit)) : 1 - ease(prog(t, hit + 6, hit + 12));
      groundHatch(E.x, E.y + 6, 7, open, t, hold(t, 0, r.end, 4));
    },
    front(r) { landings(r, 14, (E, a) => { if (a < 8) { dither(E.x - 5, E.y + 1 + a, 11, 4, HATCH.hole, 0.75 * (1 - a / 8)); } }); },
    scene(r) { return { dark: 0.25 * hold(r.t, 0, r.end, 6) }; },
  },

  // Down Below: hatches open in the ground under every foe in the dark, eyes rise out of them, and the ground heaves as they all drop shut.
  hatch_downbelow: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, hit = hitOf(r); for (const E of r.to) { const open = t < hit ? ease(prog(t, 0, hit - 4)) : 1 - ease(prog(t, hit, hit + 5)); groundHatch(E.x, E.y + 6, 8, open, t, hold(t, 0, r.end, 5)); } },
    front(r) {
      flights(r, p => doorEye(p.x, p.y, ((p.a >> 2) % 3) ? 1 : 0.5, 1));
      landings(r, 20, (E, a, i) => { if (i % 6 === 0) { dust(E.x, E.y + 5, a, 16, HATCH.plank, HATCH.dark, 4, 5); chunks(E.x, E.y + 4, a, 4, r.seed + i, [HATCH.plank, HATCH.cyan], 1, 18, 2); } }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0, dark: 0.25 * hold(r.t, 0, r.end, 8) }; },
    lights(r) { return r.to.map(E => lit(E, HATCH.lilac, 1.2 * hold(r.t, 0, hitOf(r), 6), 12)); },
  },

  // ---------------- Koolus
  // Trill: two quick chirps fly at the foe, and a ring of sound rolls off it.
  chirr_trill: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => chirp(p.x, p.y, p.ux, p.uy));
      landings(r, 14, (E, a, i) => { if (i === 0) ringOut(E.x, E.y, a, 14, CRICK.pale, 10, 0.8, CRICK.salmon); });
    },
  },

  // Cave Drip: Koolus hops, drops fall on the foe from a cave roof over it, and the wet holds its feet.
  chirr_stridulate: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => { if (a > 2) oval(E.x, E.y + 5, Math.min(7, a), 1, '#5a7898', fade(a, 26, 6)); }); },
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, hitOf(r) + 8, 3), y0 = Math.max(6, E.y - 16);
      for (let q = 0; q < 4; q++) blit(['b', 'b', 'p'], E.x - 6 + q * 4, y0 + (q % 2), { b: CRICK.brown, p: CRICK.pale }, L);
      flights(r, p => bead(p.x, p.y, '#d8f0f8', '#6aa0d0'));
      landings(r, 14, (P, a) => crown(P.x, P.y + 4, a, 12, '#d8f0f8', '#6aa0d0', 5));
    },
  },

  // Hop Off: Koolus springs away on its backward knees and leaves a Leg Snare of cricket legs set in the ground.
  chirr_cavehop: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, hit, r.end, 5); if (L > 0) { const x = U.x + face(r) * 11; crickLeg(x - 3, U.y + 6, 1, L); crickLeg(x + 3, U.y + 6, -1, L); } },
    front(r) { const t = r.t, U = userAt(r); if (t < hitOf(r)) crickLeg(U.x - 4, U.y + 4, -1, 1); landings(r, 14, (E, a) => dust(E.x + face(r) * 11, E.y + 5, a, 14, CRICK.brown, CRICK.pale, 2)); },
  },

  // Four Chirps: three quiet chirps fly at the foe, then a fourth, loud and white, bursts on it.
  chirr_lastnotes: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => chirp(p.x, p.y, p.ux, p.uy, p.f.i === 3));
      landings(r, 18, (E, a, i) => { if (i < 3) { if (a < 6) arc(E.x, E.y, 3 + a, 2 + a * 0.6, CRICK.pale, 1 - a / 6); } else { ringOut(E.x, E.y, a, 18, W, 14, 0.8, CRICK.salmon); sparks(E.x, E.y, a, 10, r.seed, CRICK.salmon, 10, 10); } }, 3);
    },
    scene(r) { const z = r.t - (r.hits[r.hits.length - 1]?.at ?? 0); return { jolt: z >= 0 && z < 12 ? shake(z, 12, 2) : 0 }; },
  },

  // ---------------- Honevel
  // Toss Up: a knucklebone flips up and over, tumbling end over end, and lands on the foe with a crack.
  talus_tossup: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, KNUCK.bone, K, 8, r.seed), 2); },
    front(r) { flights(r, p => knucklebone(p.x, p.y, p.a, 1, true)); landings(r, 14, (E, a) => chunks(E.x, E.y + 2, a, 4, r.seed, [KNUCK.bone, KNUCK.tan], 1, 14), 2); },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Chip Off: two chips of bone fly fast and shatter on the foe, and red cracks run across it, Fractured.
  talus_bonechip: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [KNUCK.bone, KNUCK.tan]); knucklebone(p.x, p.y, p.a * 2); });
      landings(r, 22, (E, a, i) => { if (i) return; for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2, d = 1 + a; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, KNUCK.bone, fade(a, 10, 4)); } if (a > 3) { const L = fade(a, 22, 6); line(E.x - 3, E.y - 4, E.x, E.y, KNUCK.red, L); line(E.x, E.y, E.x - 1, E.y + 3, KNUCK.red, L); line(E.x, E.y, E.x + 3, E.y - 1, KNUCK.red, L); } daze(E, a, 22, KNUCK.red, KNUCK.bone); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Roll for It: four knucklebones circle the ally, fall in a roll, and two land pips up and glint, so its next move goes twice.
  talus_eggon: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => knucklebone(p.x, p.y, p.a));
      landings(r, 24, (E, a, i) => { if (i % 2) return; const x = E.x + (i ? 4 : -4), y = E.y + 5; knucklebone(x, y, a < 8 ? a : 2, fade(a, 24, 6)); if (a > 8 && ((a >> 1) & 1)) px(x, y - 2, W, fade(a, 24, 6)); });
    },
  },

  // All Five: five knucklebones go up in the air, then come down one after another on the foes, and the last one cracks the ground.
  talus_jackstones: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i === r.hits.length - 1) crackAt(E.x, E.y + 4, a, 20, KNUCK.red, K, 11, r.seed); }, 4); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      if (t < go) for (let q = 0; q < 5; q++) knucklebone(U.x - 8 + q * 4, U.y - 10 - Math.round(Math.sin(Math.PI * prog(t, q, go)) * 6), t + q, 1);
      flights(r, p => knucklebone(p.x, p.y, p.a + p.f.i, 1, true));
      landings(r, 14, (E, a, i) => { chunks(E.x, E.y + 2, a, 3, r.seed + i, [KNUCK.bone, KNUCK.tan, KNUCK.red], 1, 14); if (i === r.hits.length - 1) daze(E, a, 14, KNUCK.red, KNUCK.bone); }, 4);
    },
    scene(r) { const z = r.t - (r.hits[r.hits.length - 1]?.at ?? 0); return { jolt: jolts(r, 1, 3) || (z >= 0 && z < 10 ? shake(z, 10, 2) : 0) }; },
  },

  // ---------------- Hamkuba
  // Cusp Bite: it lunges, and rows of great flat molars close on the foe.
  molar_cusp: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, MOLAR.white, MOLAR.root); },
    front(r) { landings(r, 14, (E, a) => { const gap = Math.max(0, 5 - a * 2), L = fade(a, 14, 5); molarRow(E.x, E.y - 3 - gap, 3, false, L); molarRow(E.x, E.y + 3 + gap, 3, true, L); }, 3); },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Root Heave: Hamkuba stamps, and great tooth roots heave up out of the ground under every foe.
  molar_rupture: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i % 4) return; crackAt(E.x, E.y + 5, a, 20, MOLAR.root, K, 10, r.seed + i); for (let q = 0; q < 3; q++) { const h = Math.round(8 * Math.sin(Math.PI * Math.min(1, (a - q) / 14))); if (h > 0) { dither(E.x - 6 + q * 6, E.y + 5 - h, 2, h, MOLAR.root, 1); px(E.x - 6 + q * 6, E.y + 5 - h, MOLAR.white, 1); } } }, 2); },
    front(r) { flights(r, p => { px(p.x, p.y, MOLAR.white); px(p.x, p.y + 1, MOLAR.root); }); landings(r, 18, (E, a, i) => { if (i % 4 === 0) daze(E, a, 18, MOLAR.gum, MOLAR.white); }); },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Molar Grind: rows of molars clamp on the foe and grind side to side, and the foe cracks.
  molar_gnash: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a) => crackAt(E.x, E.y + 4, a, 20, MOLAR.gum, K, 8, r.seed), 2); },
    front(r) { landings(r, 18, (E, a) => { const L = fade(a, 18, 5), g = Math.max(0, 3 - a), s = a > 3 ? Math.round(Math.sin(a * 1.2) * 2) : 0; molarRow(E.x + s, E.y - 3 - g, 3, false, L); molarRow(E.x - s, E.y + 3 + g, 3, true, L); }, 2); },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, 1) : 0 }; },
  },

  // Chew Down: a great tooth rises over Hamkuba, then huge molars close on the foe and chew it three times.
  molar_chewup: {
    lead: 6, tail: 10, noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => crackAt(E.x, E.y + 4, a, 26, MOLAR.gum, K, 12, r.seed), 4); },
    front(r) {
      const t = r.t, B = beside(r.from), hit = hitOf(r);
      molarTooth(B.x, B.y, hold(t, 0, hit, 4), 2);
      landings(r, 26, (E, a) => { const k = a % 8, g = Math.round(Math.abs(Math.sin(Math.PI * k / 8)) * 4); molarRow(E.x, E.y - 4 - g, 4, false, fade(a, 26, 6)); molarRow(E.x, E.y + 4 + g, 4, true, fade(a, 26, 6)); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 24 && a % 8 < 4 ? shake(a % 8, 4, a < 8 ? 3 : 1) : 0 }; },
  },

  // ---------------- Kaukubi
  // Spur Spray: bone spurs shake off Kaukubi and spray through the foes, and splinter on them.
  atlas_quills: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => spur(p.x, p.y, p.ux, p.uy));
      landings(r, 16, (E, a, i) => { if (i % 5) return; for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.2, d = 1 + a * 0.8; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, q % 2 ? ATLAS.bone : ATLAS.pink, fade(a, 12, 4)); } if (a > 4) spur(E.x + 5, E.y - 4, -0.7, 0.7, fade(a, 16, 5), 3); });
    },
  },

  // Marrow Spit: Kaukubi spits two globs of pink marrow, and they stick to the foe and drip.
  atlas_marrow: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 28, (E, a) => { if (a > 3) oval(E.x, E.y + 5, Math.min(5, a - 3), 1, ATLAS.pink, fade(a, 28, 6)); }); },
    front(r) { flights(r, p => bead(p.x, p.y, ATLAS.marrow, ATLAS.pink, 1, ATLAS.brown)); landings(r, 20, (E, a, i) => bleed(E, a, 20, 3, r.seed + i, ATLAS.marrow)); },
  },

  // Bow the Neck: the atlas bone settles round Kaukubi as a ring and its spurs stand out all round, braced to be hit.
  atlas_hunker: {
    noFlights: true, noLandings: true,
    front(r) { landings(r, 30, (E, a) => { const L = fade(a, 30, 8), d = Math.max(0, 8 - a * 2); vertebra(E.x, E.y - 6 - d, L, 1); for (let q = 0; q < 6; q++) { if (a < q) continue; const ang = q / 6 * Math.PI * 2 + 0.5, c = Math.cos(ang), s = Math.sin(ang); spur(E.x + c * 9, E.y + s * 7, c, s, L, 3); } }); },
  },

  // Hold Up: four bones circle Kaukubi, then they stack up over it into a spine that holds high, ringed in pink.
  atlas_shrugoff: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => { ringOut(E.x, E.y + 4, a, 20, ATLAS.pink, 12, 0.3, ATLAS.bone); }); },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), L = hold(t, 0, r.end, 6);
      flights(r, p => vertebra(p.x, p.y, 1, 1));
      for (let q = 0; q < 4; q++) if (t >= hit + q * 2) vertebra(U.x, U.y - 7 - q * 5, L, 1);
    },
    lights(r) { return [lit(r.from, ATLAS.pink, 1.2 * hold(r.t, hitOf(r), r.end, 6), 14)]; },
  },

  // ---------------- Kynme
  // Nail Flick: it darts in, the edge of its nail flicks across the foe, and its tip glints for the next one.
  nail_flick: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, NAIL.pink, NAIL.dark); },
    front(r) { landings(r, 18, (E, a) => { const n = Math.min(1, (a + 1) / 3); if (a < 8) nailEdge(E.x + 4 - 8 * n, E.y - 3 + 6 * n, 4, 0.6, 1 - a / 8); if (a > 6 && a < 14 && ((a >> 1) & 1)) glint(r.from.x + face(r) * 4, r.from.y - 5, NAIL.pink, 1); }, 2); },
    scene(r) { return { jolt: jolts(r, 1, 3) }; },
  },

  // Pin Under: the nail rakes down the foe three times and presses its edge into the ground to pin it.
  nail_rake: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 22, (E, a) => crackAt(E.x, E.y + 4, a, 22, NAIL.red, K, 9, r.seed), 2); },
    front(r) { landings(r, 22, (E, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 6, E.x - 5 + q * 3, E.y - 6 + 10 * n, q === 1 ? NAIL.red : NAIL.edge, fade(a, 12, 4)); } if (a > 4) nailEdge(E.x, E.y + 4, 5, 0, fade(a, 22, 6)); }, 2); },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Pare Down: crescent parings sweep through the foe, and the same spot it keeps scratching flares red.
  nail_pare: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => nailEdge(p.x, p.y, 3, Math.atan2(p.uy, p.ux), 1));
      landings(r, 20, (E, a) => { sameSpot(E.x + 2, E.y - 2, Math.min(4, 1 + (a >> 2)), fade(a, 20, 6)); if (a < 4) oval(E.x + 2, E.y - 2, 3 - a * 0.5, 3 - a * 0.5, NAIL.red, 1); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Down to Quick: a great nail grows long over Kynme, its red quick showing, and scratches the air with it.
  nail_gouge: {
    lead: 6, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = beside(U), L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, hitOf(r)));
      for (let q = 0; q < 3; q++) nailEdge(B.x, B.y + 3 - q * 2, Math.round(3 + 4 * g), 0, L);
      dither(B.x - Math.round(2 + 3 * g), B.y + 4, Math.round(5 + 6 * g), 1, NAIL.red, L);
      landings(r, 16, (E, a) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 6, E.x - 5 + q * 3, E.y - 6 + 9 * n, q === 1 ? NAIL.red : NAIL.edge, fade(a, 14, 4)); } });
    },
    lights(r) { return [lit(beside(r.from), NAIL.red, 1.2 * hold(r.t, 0, r.end, 6), 12)]; },
  },

  // ---------------- Koshika
  // Pop Joint: Koshika hops and its ball pops out of the cup and snaps back, and the snap bursts on the foe.
  socket_snap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      joint(U.x, U.y - 9, 0, Math.sin(Math.PI * prog(t, 0, hit)), hold(t, 0, hit + 4, 3));
      landings(r, 14, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, JOINT.pale, 8, 8); if (a < 4) oval(E.x, E.y, 3 - a * 0.5, 3 - a * 0.5, JOINT.gray, 1); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Swing Leg: Koshika spins, a long leg bone swings round from its joint, and it comes in and knocks the foe down.
  socket_adapt: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, JOINT.pale, K, 9, r.seed), 2); },
    front(r) {
      const t = r.t, U = userAt(r), sw = t < r.motionAt[1] ? t * 0.6 : -1;
      if (sw >= 0) { const tip = { x: U.x + Math.cos(sw) * 10, y: U.y + Math.sin(sw) * 5 }; thick(U.x, U.y, tip.x, tip.y, JOINT.pale, 1, JOINT.gray); oval(tip.x, tip.y, 1.5, 1.5, JOINT.brown, 1); }
      landings(r, 14, (E, a) => chunks(E.x, E.y + 2, a, 4, r.seed, [JOINT.pale, JOINT.gray, JOINT.brown], 1, 14), 2);
    },
    scene(r) { return { jolt: jolts(r, 2, 6) }; },
  },

  // Shift Weight: the ball rolls across its cup from one side to the other, and Koshika settles on its new lean.
  socket_lockjoint: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), lean = -1 + 2 * ease(prog(t, 0, hit));
      joint(U.x, U.y - 9, lean, 0, hold(t, 0, r.end, 4));
      landings(r, 14, (E, a) => ringOut(E.x, E.y + 4, a, 14, JOINT.gray, 10, 0.35, JOINT.brown));
    },
  },

  // ---------------- Netoive
  // Splinter Spray: Netoive shakes and splinters of wishbone spray through the foes and shatter on them.
  furcula_wish: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { for (let i = 0; i < 4; i++) px(p.x - p.ux * i, p.y - p.uy * i, i === 0 ? W : i < 3 ? WISH.pale : WISH.amber, 1); });
      landings(r, 14, (E, a, i) => { if (i % 5) return; for (let q = 0; q < 7; q++) { const ang = q / 7 * Math.PI * 2, d = 1 + a * 0.8; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, q % 2 ? WISH.pale : WISH.amber, fade(a, 14, 4)); } });
    },
  },

  // Pull the Bone: a wishbone is pulled apart over the foes, its two ends fly out at them and back, and the bone shatters where they hit.
  furcula_fan: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      if (t < go + 2) wishbone(U.x, U.y - 6, prog(t, 0, go), 1, 1);
      flights(r, p => { for (let i = 0; i < 5; i++) px(p.x - p.ux * i * 0.8 + (p.f.i ? 1 : -1) * i * 0.3, p.y - p.uy * i * 0.8 - i * 0.4, i === 0 ? W : WISH.pale, 1); px(p.x, p.y + 1, WISH.amber, 1); });
      landings(r, 14, (E, a, i) => { if (i % 2) return; for (let q = 0; q < 7; q++) { const ang = q / 7 * Math.PI * 2, d = 1 + a * 0.8; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, q % 2 ? WISH.pale : WISH.amber, fade(a, 14, 4)); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Make a Wish: a wishbone over Netoive snaps with a glint of amber, and three amber stars circle it.
  furcula_stacked: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = beside(U), hit = hitOf(r), L = hold(t, 0, r.end, 5);
      wishbone(B.x, B.y + 3, prog(t, hit - 4, hit), L, 2);
      if (t >= hit && t < hit + 8) glint(B.x, B.y + 3, WISH.amber, 1 - (t - hit) / 8);
      flights(r, p => glint(p.x, p.y, WISH.amber, 1));
      landings(r, 18, (E, a) => motes(E.x, E.y + 2, a, 18, 5, r.seed, [WISH.amber, W], 6, 10));
    },
  },

  // Wish Them Here: a great wishbone hangs over the foe it drags in, stars close in on it, and it snaps in a flash.
  furcula_fulldeck: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), B = beside(E), L = hold(t, 0, hit + 12, 5);
      wishbone(B.x, B.y + 5, prog(t, hit - 2, hit + 2), L, 2);
      flights(r, p => glint(p.x, p.y, WISH.amber, 1));
      landings(r, 22, (P, a, i) => { if (i) return; ringOut(P.x, P.y, a, 18, WISH.amber, 13, 0.8, WISH.pale); sparks(P.x, P.y, a, 10, r.seed, WISH.amber, 10, 11); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0, glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0 }; },
    lights(r) { return [lit(aim(r), WISH.amber, 1.4 * hold(r.t, hitOf(r) - 4, hitOf(r) + 14, 4), 14)]; },
  },

  // ---------------- Echili
  // Spine Sweep: Echili spins, spines fly off it in a ring through the foes, and break on them.
  urchin_spinering: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < hitOf(r)) urchinBall(U.x, U.y - 9, 2, t * 0.3, 0.75, 0.6);
      flights(r, p => urchinBall(p.x, p.y, 1.5, p.a * 0.4, 1, 0.8));
      landings(r, 14, (E, a, i) => { if (i % 3) return; for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.3, c = Math.cos(ang), s = Math.sin(ang); spine(E.x + c * (2 + a * 0.8), E.y + s * (2 + a * 0.8) * 0.8, c, s, fade(a, 14, 4), 3); } });
    },
  },

  // Water Jet: Echili rears back and jets water from its mouth in a fast stream, and the foe is pushed off.
  urchin_gush: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, ['#d8f0f8', '#6aa0d0', '#6aa0d0']); bead(p.x, p.y, '#d8f0f8', '#6aa0d0'); });
      landings(r, 16, (E, a, i) => { if (i) return; crown(E.x, E.y + 3, a, 14, '#d8f0f8', '#6aa0d0', 7); streaks(E.x, E.y, a, 14, Math.sign(E.x - r.from.x) || 1, '#d8f0f8', 3); });
    },
  },

  // Spine Pin: it lunges and a cluster of spines flies fast into the foe and stays stuck in it like pins.
  urchin_pincushion: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, URCH.test, URCH.purple); },
    front(r) {
      flights(r, p => { for (let q = -1; q <= 1; q++) spine(p.x - p.uy * q * 2, p.y + p.ux * q * 2, p.ux, p.uy, 1, 4); });
      landings(r, 28, (E, a) => { const L = fade(a, 28, 6); for (let q = 0; q < 5; q++) if (a >= q) { const ang = -0.5 + q * 0.6, c = Math.cos(ang + Math.PI), s = Math.sin(ang + Math.PI); spine(E.x - 2 + q * 1.5 + c * 2, E.y - 2 + (q % 2) * 3 + s * 2, -c, -s, L, 4); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // All Spines Out: Echili swells and puts every spine out at once, and they close in on every foe from all round.
  urchin_ravage: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, go = leaveOf(r);
      if (t < go + 4) urchinBall(U.x, U.y, 4 + 2 * prog(t, 0, go), t * 0.05, 1, 0.3 + prog(t, 0, go));
      flights(r, p => spine(p.x, p.y, p.ux, p.uy, 1, 5));
      landings(r, 20, (E, a, i) => { if (i % 8) return; for (let q = 0; q < 8; q++) { const ang = q / 8 * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang); spine(E.x + c * (3 + a * 0.6), E.y + s * (3 + a * 0.6) * 0.8, c, s, fade(a, 20, 6), 3); } daze(E, a, 20, URCH.green, URCH.test); }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(r.from, URCH.green, 1.2 * hold(r.t, 0, leaveOf(r) + 4, 4), 14)]; },
  },

  // ---------------- Rakani
  // Sidelong Jab: it darts in sideways, its great claw snaps shut on the foe, and gold scratches rake it.
  fiddler_clawwave: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, FIDDLE.red, FIDDLE.dark); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      if (t < hit) greatClaw(U.x + dir * 6, U.y - 2, true, dir, 1);
      landings(r, 14, (E, a) => { if (a < 6) greatClaw(E.x - dir * 3, E.y - 2, a > 1, dir, 1 - a / 6); for (let q = 0; q < 3; q++) { const n = Math.min(1, (a + 1 - q) / 3); if (n > 0) line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 9 * n, q === 1 ? FIDDLE.pale : FIDDLE.gold, fade(a, 14, 4)); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Wave the Claw: Rakani waves its great claw high, a wave of water sweeps out through the foe, and the foe can't look away.
  fiddler_sidle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r);
      greatClaw(U.x + dir * 3, U.y - 9 - Math.round(Math.abs(Math.sin(t / 3)) * 3), (t >> 2) & 1 ? true : false, dir, hold(t, 0, hitOf(r) + 6, 3));
      flights(r, p => { const d = p.ux >= 0 ? 1 : -1; blit(['.ff', 'fbb', 'bbb'], p.x, p.y, { f: '#e8f4fc', b: '#6aa0d0' }, 1, 1, d < 0); });
      landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 16, '#e8f4fc', '#6aa0d0', 7));
    },
  },

  // Claw Raised: Rakani raises its great claw in front of itself to catch the blows, shut tight.
  fiddler_counterclaw: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r), up = ease(prog(t, 0, hitOf(r)));
      greatClaw(U.x + dir * 6, U.y + 2 - 4 * up, false, dir, hold(t, 0, r.end, 4), 1);
      landings(r, 14, (E, a) => arc(E.x + dir * 6, E.y - 2, 5 + a * 0.3, 6 + a * 0.3, FIDDLE.pale, fade(a, 14, 5), dir > 0 ? 0.8 : 0.3, dir > 0 ? 1.2 : 0.7));
    },
  },

  // Regrow Claw: a new great claw grows big beside Rakani, then snaps down over the foe and cuts it.
  fiddler_regrown: {
    lead: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = beside(U), hit = hitOf(r), dir = face(r);
      if (t < hit - 4) greatClaw(B.x, B.y, (t >> 2) & 1 ? true : false, dir, 1, t < 10 ? 1 : 2);
      landings(r, 18, (E, a) => { if (a < 8) greatClaw(E.x, E.y - 3, a > 2, dir, 1 - a / 8, 2); const n = Math.min(1, (a + 1) / 3); thick(E.x + 7, E.y - 6, E.x + 7 - 14 * n, E.y - 6 + 11 * n, FIDDLE.pale, fade(a, 14, 4), FIDDLE.gold); }, 6);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(aim(r), FIDDLE.gold, 1.2 * hold(r.t, hitOf(r) - 2, hitOf(r) + 14, 4), 12)]; },
  },

  // ---------------- Vistus
  // Heat Glint: a glint of heat shoots across through shimmering air, twinkles on the foe, and a Reflection of Vistus wavers up.
  fata_glint: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, hit = hitOf(r); if (t >= hit) reflection(r.from.x + face(r) * 11, r.from.y, t, hold(t, hit, r.end, 4)); },
    front(r) {
      flights(r, p => { for (let i = 1; i < 6; i++) px(p.x - p.ux * i, p.y - p.uy * i + Math.round(Math.sin((p.a + i) / 1.5)), i % 2 ? FATA.sky : FATA.red, i < 4 ? 1 : 0.5); glint(p.x, p.y, FATA.sky, 1); });
      landings(r, 16, (E, a) => { for (let q = 0; q < 4; q++) { const ang = q * 1.57 + 0.6; if (((a + q) % 4) < 2) glint(E.x + Math.cos(ang) * 6, E.y + Math.sin(ang) * 5, FATA.red, fade(a, 16, 5)); } });
    },
  },

  // Waver Off: heat shimmers up round Vistus, it wavers out of true, and a Reflection stands beside it.
  fata_waver: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 5); shimmer(U.x, U.y - 6, 7, 12, t, 0.75 * L); if (t >= hitOf(r)) reflection(U.x + face(r) * 11, U.y, t, hold(t, hitOf(r), r.end, 4)); },
    front(r) { landings(r, 14, (E, a) => { for (let q = 0; q < 4; q++) { const ang = q * 1.57; if (((a + q) % 4) < 2) glint(E.x + Math.cos(ang) * 7, E.y + Math.sin(ang) * 6, FATA.sky, fade(a, 14, 5)); } }); },
  },

  // Haze Run: Vistus blinks into the haze and runs at the foe, leaving a string of wavering copies of itself behind.
  fata_hazerush: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, hit = hitOf(r); if (t < hit + 4) for (let k = 1; k <= 3; k++) { const p = userAtFrame(r, t - k * 2); reflection(p.x, p.y, t + k, 0.75 - k * 0.15); } },
    front(r) { landings(r, 16, (E, a) => { shimmer(E.x, E.y - 4, 6, 9, a, fade(a, 16, 5)); for (let q = 0; q < 3; q++) if (((a + q) % 4) < 2) glint(E.x - 5 + q * 5, E.y - 6 + (q % 2) * 6, FATA.red, fade(a, 16, 5)); }, 2); },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // ---------------- Ikara
  // Fluke Swipe: Ikara swings its anchor round on its chain, and a fluke cuts across the foe.
  fluke_anchorswing: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit) { const a = t * 0.6, A = { x: U.x + Math.cos(a) * 11, y: U.y + Math.sin(a) * 6 }; chain(U, A, 0, 1); anchor(A.x, A.y, 1); }
      landings(r, 14, (E, a) => { const n = Math.min(1, (a + 1) / 3), L = fade(a, 14, 4); arc(E.x + 2, E.y - 2, 7, 6, ANCHOR.pale, L, 0.3, 0.3 + 0.35 * n); arc(E.x + 2, E.y - 1, 6, 5, ANCHOR.iron, L, 0.3, 0.3 + 0.35 * n); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Drop Anchor: an anchor drops out of the sky beside the foe and bites into the ground, its chain running to the foe to hold it there.
  fluke_markspot: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a) => crackAt(E.x - 8, E.y + 5, a, 20, ANCHOR.pale, K, 6, r.seed), 2); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), X = { x: E.x - 8, y: E.y + 2 };
      const y = t < hit ? X.y - 24 + 24 * ease(prog(t, 0, hit)) : X.y;
      anchor(X.x, y, hold(t, 0, r.end, 4));
      if (t >= hit) chain({ x: X.x, y: X.y - 3 }, { x: E.x + 2, y: E.y }, 3, hold(t, hit, r.end, 4));
      landings(r, 14, (P, a) => chunks(P.x - 8, P.y + 4, a, 4, r.seed, [ANCHOR.iron, ANCHOR.pale], 1, 14), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 6) }; },
  },

  // Sand Spout: Ikara stamps its flukes and a spout of sand bursts up under the foe and stuns it.
  fluke_torrent: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a) => { const h = Math.round(14 * out(prog(a, 0, 6)) * (1 - prog(a, 10, 18))); for (let s = -2; s <= 2; s++) dither(E.x + s, E.y + 5 - h, 1, h, Math.abs(s) === 2 ? '#8a7860' : '#c8b088', 0.75); }); },
    front(r) { flights(r, p => { px(p.x, p.y, '#e0d0a8'); px(p.x + 1, p.y + 1, '#8a7860'); }); landings(r, 18, (E, a) => { dust(E.x, E.y + 4, a, 16, '#8a7860', '#c8b088', 3, 5); daze(E, a, 18, ANCHOR.pale, '#c8b088'); }); },
  },

  // Wreck Comes In: a wreck's dark hull looms up behind the foes, its planks and iron come down on them, and the ground heaves.
  fluke_scuttle: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r);
      for (const E of r.to) { const h = Math.round(14 * ease(prog(t, 0, hit)) * (1 - prog(t, hit + 6, hit + 16))); if (h > 0) { const dir = face(r); for (let i = -12; i <= 12; i++) { const hh = Math.round(h * (1 - Math.abs(i) / 14)); dither(E.x + dir * 8 + i, E.y + 5 - hh, 1, hh, (i & 3) ? '#4a3a30' : '#2a2220', 1); } } }
      landings(r, 22, (E, a, i) => { if (i === 0) crackAt(E.x, E.y + 4, a, 22, ANCHOR.pale, K, 12, r.seed); }, 5);
    },
    front(r) {
      flights(r, p => (p.f.i % 3 === 0 ? anchor(p.x, p.y, 1) : p.f.i % 3 === 1 ? blit(['bbbb', 'dddd'], p.x, p.y, { b: '#8a6a48', d: '#4a3a30' }, 1) : cannonball(p.x, p.y, 1)));
      landings(r, 18, (E, a, i) => chunks(E.x, E.y + 2, a, 3, r.seed + i, ['#8a6a48', ANCHOR.iron, ANCHOR.pale], 1, 16, 2), 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 2 : 1) : 0 }; },
  },

  // ---------------- Prosaki
  // Spray Over: it drives in like a ship's bow, cold spray sweeps over the foe, and frost grows where it lands.
  prow_coldspray: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit + 2) bowWave(U.x + face(r) * 5, U.y + 4, face(r), t, 1, 7);
      flights(r, p => bead(p.x, p.y, PROW.foam, PROW.ice));
      landings(r, 16, (E, a) => rime(E, a, 16, r.seed, 6, 7));
    },
  },

  // Into the Swell: it braces behind a bow wave, and a swell sweeps out and breaks over the foe.
  prow_bulwark: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r);
      bowWave(U.x + dir * 6, U.y + 4, dir, t, hold(t, 0, r.end, 4), 8);
      flights(r, p => { const d = p.ux >= 0 ? 1 : -1; blit(['.ff', 'fbb', 'bnn'], p.x, p.y, { f: PROW.foam, b: PROW.ice, n: PROW.navy }, 1, 1, d < 0); });
      landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 16, PROW.foam, PROW.ice, 7));
    },
  },

  // Stand In Front: the figurehead rises before Prosaki, carved and gilded, and a gold ring stands round it.
  prow_standbefore: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, dir = face(r), up = ease(prog(t, 0, hitOf(r)));
      figurehead(U.x + dir * 8, U.y + 2 - 5 * up, dir, hold(t, 0, r.end, 4), 1);
      landings(r, 16, (E, a) => { arc(E.x, E.y, 8, 7, PROW.gold, fade(a, 16, 6)); arc(E.x, E.y, 9, 8, PROW.wood, 0.5 * fade(a, 16, 6), 0.5, 1); });
    },
  },

  // Ice Wake: a great figurehead rides beside Prosaki, its wake opens in a wide V of foam and ice over every foe, and it freezes on them.
  prow_breakwater: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, dir = face(r), u = prog(t, 0, hitOf(r) + 6), L = hold(t, 0, r.end, 6);
      for (let i = 0; i < 60 * u; i += 2) { const w = 1 + i * 0.25, x = U.x + dir * i, y = U.y + 5 - i * (high(U) ? -0.45 : 0.45); px(x, y - w, (i >> 1) % 3 ? PROW.foam : PROW.ice, L); px(x, y + w * 0.5, (i >> 1) % 3 ? PROW.ice : PROW.foam, L); }
    },
    front(r) {
      const t = r.t, B = beside(r.from), dir = face(r);
      figurehead(B.x, B.y, dir, hold(t, 0, r.end - 4, 6), 2);
      flights(r, p => { const d = p.ux >= 0 ? 1 : -1; blit(['.ff', 'fii', 'iii'], p.x, p.y, { f: PROW.foam, i: PROW.ice }, 1, 1, d < 0); });
      landings(r, 20, (E, a, i) => { if (i % 4 === 0) { rime(E, a, 20, r.seed + i, 7, 9); daze(E, a, 20, PROW.ice, PROW.foam); } }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, PROW.ice, 1.2 * hold(r.t, hitOf(r) - 4, r.end, 6), 14)); },
  },

  // ---------------- Sensi
  // Bail Out: its pump handle works, and water bailed out of it lobs over onto the foe.
  bilge_bail: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      pumpHandle(U.x - face(r) * 3, U.y - 8, t * 0.6, hold(t, 0, leaveOf(r) + 8, 3));
      flights(r, p => bead(p.x, p.y, BILGE.pale, BILGE.cyan, 1, BILGE.green));
      landings(r, 16, (E, a) => crown(E.x, E.y + 4, a, 16, BILGE.pale, BILGE.cyan, 6));
    },
  },

  // Suction: water is sucked in from round every foe into a spinning drain, and a drop of tide flies home to Sensi.
  bilge_siphon: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a, i) => { if (i % 4 === 0) for (let q = 0; q < 10; q++) { const ang = a * 0.4 + q * 0.63, rr = 9 - ((a * 0.6 + q * 2) % 8); px(E.x + Math.cos(ang) * rr, E.y + 4 + Math.sin(ang) * rr * 0.3, q % 3 ? BILGE.cyan : BILGE.pale, fade(a, 18, 6)); } }); },
    front(r) {
      flights(r, p => bead(p.x, p.y, BILGE.pale, BILGE.cyan, 1, BILGE.green));
      landings(r, 22, (E, a, i) => { if (i === 0) takeBack(E, r.from, a - 4, 16, 1, BILGE.cyan, BILGE.pale); });
    },
  },

  // Still Water: a sheet of still water spreads under the foe without a ripple, then sets like stone round its feet.
  bilge_stagnant: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a) => stillWater(E.x, E.y + 4, Math.round(11 * out(prog(a, 0, 8))), prog(a, 10, 14), fade(a, 30, 8))); },
    front(r) { landings(r, 18, (E, a) => { if (a > 10) for (let q = 0; q < 4; q++) px(E.x - 6 + q * 4, E.y + 4, ((a + q) & 3) < 2 ? W : BILGE.pale, fade(a, 18, 4)); }); },
  },

  // Dead Calm: everything goes still, a mirror of water lies flat under the foe, drops hang in the air over it, then drop and set.
  bilge_deadwater: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), hit = hitOf(r); stillWater(E.x, E.y + 4, Math.round(13 * ease(prog(t, 0, 12))), prog(t, hit + 4, hit + 10), hold(t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, E = aim(r), go = leaveOf(r);
      if (t < go) for (let q = 0; q < 6; q++) bead(E.x - 10 + q * 4, E.y - 12 + (q % 2) * 3, BILGE.pale, BILGE.cyan, prog(t, q, q + 6), BILGE.green);
      flights(r, p => bead(p.x, p.y, BILGE.pale, BILGE.cyan, 1, BILGE.green));
      landings(r, 22, (P, a, i) => { if (i === 0) { ringOut(P.x, P.y + 4, a, 22, BILGE.cyan, 13, 0.3, BILGE.pale); daze(P, a, 22, BILGE.cyan, BILGE.pale); } }, 5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 8 ? shake(a, 8, 1) : 0, dark: 0.125 * hold(r.t, 0, r.end, 8) }; },
    lights(r) { return [lit(aim(r), BILGE.cyan, 1.2 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Vesen
  // Thrown Blocks: Vesen spins and throws its pulley blocks on their ropes, and they burst on every foe.
  sail_gybe: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => pulley(p.x, p.y, p.a));
      landings(r, 14, (E, a, i) => { if (i % 3 === 0) { sparks(E.x, E.y, a, 8, r.seed + i, SAIL.rope, 8, 8); chunks(E.x, E.y, a, 3, r.seed + i, [SAIL.wood, SAIL.rope], 0.9, 12); } }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Come About: its boom swings across under the sail from one side to the other, and the canvas flips with it.
  sail_boomswing: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), u = ease(prog(t, 0, hit)), ang = Math.PI * u, L = hold(t, 0, r.end, 4);
      sailCloth(U.x, U.y - 2, 9, 0.5, u < 0.5 ? 1 : -1, L);
      thick(U.x, U.y - 2, U.x + Math.cos(ang) * 9, U.y - 2 + Math.sin(ang) * 1.5, SAIL.wood, L, SAIL.rope);
      landings(r, 12, (E, a) => ringOut(E.x, E.y + 3, a, 12, SAIL.canvas, 10, 0.4, SAIL.blue));
    },
  },

  // Fill Out: Vesen's torn sail fills with a wind out of nowhere, and the wind runs on toward the foe.
  sail_billow: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = face(r);
      sailCloth(U.x, U.y - 1, 10, ease(prog(t, 0, hitOf(r))), dir, hold(t, 0, r.end, 4));
      flights(r, p => { line(p.x, p.y - 2, p.x - dir * 6, p.y - 2, SAIL.canvas, 1); px(p.x + dir, p.y - 3, SAIL.blue, 1); });
      landings(r, 14, (E, a) => airLines(E.x + dir * 8, E.y, a, dir, 10, fade(a, 14, 5), 3));
    },
  },

  // Storm Canvas: a great storm sail stands over Vesen, full and straining in streaks of storm, and it will not come down.
  sail_galeforce: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = beside(r.from), dir = face(r); sailCloth(B.x - dir * 4, B.y + 10, 18, 0.5 + 0.5 * Math.sin(t / 3), dir, hold(t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = r.from, dir = face(r), L = hold(t, 0, r.end, 6);
      airLines(U.x, U.y - 4, t, dir, 16, 0.75 * L, 5);
      flights(r, p => { const d = p.ux >= 0 ? 1 : -1; blit(['.ff', 'fbb'], p.x, p.y, { f: SAIL.canvas, b: SAIL.blue }, 1, 1, d < 0); });
      landings(r, 20, (E, a) => { ringOut(E.x, E.y, a, 20, SAIL.canvas, 12, 0.8, SAIL.blue); motes(E.x, E.y + 3, a, 20, 5, r.seed, [SAIL.canvas, W], 7, 12); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 8 ? shake(a, 8, 1) : 0 }; },
    lights(r) { return [lit(beside(r.from), SAIL.canvas, hold(r.t, 0, r.end, 6), 12)]; },
  },

  // Boom Beat: Vesen spins, and its heavy boom swings across and beats the foe.
  sail_axes: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      if (t < hit + 2) { const ang = (dir > 0 ? Math.PI : 0) - dir * Math.PI * prog(t, 0, hit); thick(U.x, U.y - 2, U.x + Math.cos(ang) * 12, U.y - 2 + Math.sin(ang) * 3, SAIL.wood, 1, SAIL.rope); }
      landings(r, 14, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x - dir * 7, E.y - 2, E.x - dir * 7 + dir * 14 * n, E.y - 1, SAIL.wood, fade(a, 12, 4), SAIL.canvas); chunks(E.x, E.y, a, 3, r.seed, [SAIL.wood, SAIL.canvas], 0.9, 14); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // ---------------- Cakoli
  // Two Knocks: it rams in, and the end of its keel knocks the foe twice, hard and harder.
  keel_doubleknock: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, KEEL.gray, KEEL.brown); landings(r, 20, (E, a) => crackAt(E.x, E.y + 4, a, 20, KEEL.gold, K, 8, r.seed), 2); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      if (t < hit + 8) keelBeam(U.x + dir * 4, U.y + 1, 10, 0, 1);
      landings(r, 16, (E, a) => { ringOut(E.x, E.y, a, 8, KEEL.gold, 7, 0.8); ringOut(E.x, E.y, a - 5, 10, W, 10, 0.8, KEEL.gold); }, 2);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 3, 1) || shake(a - 5, 5, 2) }; },
  },

  // Ram Ashore: a long keel slides along the ground ahead of Cakoli and rams the foe like a ship running ashore.
  keel_ram: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), dir = face(r);
      if (t < hit + 3) keelBeam(U.x + dir * 8, U.y + 4, 16, 0, 1);
      landings(r, 22, (E, a) => { crackAt(E.x, E.y + 4, a, 22, KEEL.gold, K, 11, r.seed); dust(E.x, E.y + 5, a, 16, KEEL.brown, KEEL.gray, 4, 5); }, 3);
    },
    front(r) { landings(r, 16, (E, a) => chunks(E.x, E.y + 2, a, 5, r.seed, [KEEL.gray, KEEL.brown, KEEL.gold], 1.1, 16, 2), 3); },
    scene(r) { return { jolt: jolts(r, 2, 8) }; },
  },

  // Sit Upright: its keel settles under it and rocks level, the gold bolts catch the light, and it braces against any charge.
  keel_righting: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 5), rock = Math.sin(t / 3) * 0.25 * (1 - prog(t, 0, hitOf(r) + 4)); keelBeam(U.x, U.y + 6, 20, rock, L); },
    front(r) { landings(r, 18, (E, a) => { for (let q = 0; q < 4; q++) if (((a + q * 2) % 6) < 3) glint(E.x - 8 + q * 5, E.y + 6, KEEL.gold, fade(a, 18, 6)); ringOut(E.x, E.y + 2, a, 16, KEEL.gold, 12, 0.6, KEEL.gray); }); },
  },

  // Launch: Cakoli shudders, rams in, and its keel flips the foe up and off the field like a ship sliding down its ways.
  keel_verdict: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { landings(r, 24, (E, a) => { crackAt(E.x, E.y + 4, a, 24, KEEL.gold, K, 12, r.seed); keelBeam(E.x - face(r) * 4, E.y + 4 - Math.min(4, a), 14, -face(r) * 0.4 * Math.min(1, a / 4), fade(a, 24, 6)); }, 6); },
    front(r) {
      landings(r, 22, (E, a) => { for (let q = 0; q < 3; q++) { const y0 = E.y - 6 - a * 2.2 - q * 3; if (y0 > -4) line(E.x - 3 + q * 3, y0, E.x - 3 + q * 3, y0 + 4, q === 1 ? W : KEEL.gold, fade(a, 22, 6)); } sparks(E.x, E.y, a, 8, r.seed, KEEL.gold, 8, 9); }, 6);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, a < 6 ? 3 : 1) : r.t < hitOf(r) - 4 ? shake(r.t, 40, 1) : 0 }; },
    lights(r) { return [lit(aim(r), KEEL.gold, 1.2 * hold(r.t, hitOf(r), hitOf(r) + 16, 4), 12)]; },
  },

  // ---------------- Taihoki
  // Scatter Shot: its muzzle goes off in a flash and a ring of smoke, and four shot lob over onto the foes and crack the ground.
  bombard_lob: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 18, (E, a, i) => { if (i % 4 === 0) crackAt(E.x, E.y + 4, a, 18, CANNON.orange, K, 9, r.seed + i); }, 2); },
    front(r) {
      const U = userAt(r);
      muzzle(U.x + face(r) * 4, U.y - 3, r.t - leaveOf(r), face(r));
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [CANNON.smoke, CANNON.dark]); cannonball(p.x, p.y, 1); });
      landings(r, 14, (E, a, i) => chunks(E.x + (i % 4 - 1.5) * 3, E.y + 3, a, 2, r.seed + i, [CANNON.bronze, CANNON.dark], 0.9, 14), 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Load Grape: grapeshot pours into the top of Taihoki's head, and its fuse fizzes ready.
  bombard_grapeshot: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (let q = 0; q < 5; q++) { const u = prog(t, q * 2, q * 2 + 6); if (u > 0 && u < 1) cannonball(U.x - 2 + (q % 3) * 2, U.y - 14 + 10 * u, 1); }
      landings(r, 22, (E, a) => { line(E.x + 3, E.y - 4, E.x + 5, E.y - 7, CANNON.dark, fade(a, 22, 6)); if ((a & 1) === 0) glint(E.x + 5, E.y - 8, CANNON.orange, fade(a, 22, 6)); cinders(E.x + 5, E.y - 8, a, 20, r.seed, 4); });
    },
  },

  // Fire a Friend: the muzzle goes off and a shot streaks across with a smoke trail and bursts on the foe as an ally comes in.
  bombard_ramhome: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r);
      muzzle(U.x + face(r) * 4, U.y - 3, r.t - leaveOf(r), face(r));
      flights(r, p => { for (let i = 1; i < 8; i++) px(p.x - p.ux * i, p.y - p.uy * i, i < 2 ? CANNON.flash : i < 4 ? CANNON.orange : CANNON.smoke, i < 5 ? 1 : 0.5); cannonball(p.x, p.y, 1, true); });
      landings(r, 16, (E, a) => { sparks(E.x, E.y, a, 8, r.seed, CANNON.orange, 8, 9); daze(E, a, 16, CANNON.bronze, CANNON.flash); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Late Shot: a big flash and a great ring of smoke, and six slow shot hang high and come down on every foe one after another.
  bombard_broadside: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 20, (E, a, i) => { if (i % 6 === 0) crackAt(E.x, E.y + 4, a, 20, CANNON.orange, K, 11, r.seed + i); }, 4); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      muzzle(U.x + face(r) * 4, U.y - 3, t - go, face(r)); muzzle(U.x + face(r) * 4, U.y - 3, t - go - 4, face(r));
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [CANNON.orange, CANNON.smoke]); cannonball(p.x, p.y, 1, p.f.i % 2 === 0); });
      landings(r, 16, (E, a, i) => { sparks(E.x + (i % 3 - 1) * 4, E.y, a, 6, r.seed + i, CANNON.orange, 8, 7); chunks(E.x, E.y + 3, a, 2, r.seed + i, [CANNON.bronze, CANNON.dark], 1, 14, 2); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 14 ? shake(a, 14, 2) : 0, glare: (r.t - leaveOf(r)) >= 0 && (r.t - leaveOf(r)) < 2 ? 0.25 : 0 }; },
    lights(r) { return [lit({ x: r.from.x + face(r) * 4, y: r.from.y - 3 }, CANNON.flash, 1.6 * hold(r.t, leaveOf(r), leaveOf(r) + 6, 2), 12)]; },
  },

  // ---------------- Namito
  // Crash Down: three curling waves, each with an eye in its curl, lob over and crash down on every foe.
  breaker_spill: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => curl(p.x, p.y + 3, 6, p.ux >= 0 ? 1 : -1, p.a, 1));
      landings(r, 16, (E, a, i) => { if (i % 3 === 0) crown(E.x, E.y + 4, a, 16, SURF.foam, SURF.blue, 8, 1.2); });
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Curl Over: a wave lobs over and curls round the foe, and its hollow holds over the foe with the eye watching.
  breaker_hollowout: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => curl(p.x, p.y + 3, 7, p.ux >= 0 ? 1 : -1, p.a, 1));
      landings(r, 30, (E, a) => { const L = fade(a, 30, 8), dir = Math.sign(E.x - r.from.x) || 1; arc(E.x, E.y + 4, 8, 10, SURF.foam, L, 0.5, 1); arc(E.x, E.y + 4, 9, 11, SURF.blue, L, 0.5, 1); px(E.x - dir * 5, E.y - 4, SURF.eye, L); px(E.x - dir * 4, E.y - 4, SURF.foam, L); crown(E.x, E.y + 4, a, 12, SURF.foam, SURF.blue, 6); });
    },
  },

  // Throw Spray: it sways and throws up a Spray Column at its side, a pillar of white water that stands there.
  breaker_longdraw: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, hit = hitOf(r), X = { x: S.x + face(r) * 12, y: S.y + 6 }, L = hold(t, hit - 4, r.end, 5), h = Math.round(14 * out(prog(t, hit - 4, hit + 2)));
      if (L > 0) for (let s = -2; s <= 2; s++) { dither(X.x + s, X.y - h + Math.abs(s), 1, h - Math.abs(s), Math.abs(s) === 2 ? SURF.blue : SURF.foam, 0.75 * L); px(X.x + s, X.y - h + Math.abs(s) - ((t + s) & 1), W, L); }
    },
    front(r) { flights(r, p => bead(p.x, p.y, SURF.foam, SURF.blue)); landings(r, 14, (E, a) => crown(E.x + face(r) * 12, E.y + 5, a, 14, SURF.foam, SURF.blue, 6)); },
  },

  // ---------------- Tozodo
  // Harry: a skua dives fast at the foe and its gold hooked beak snaps on it.
  skua_harry: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { tail(p.x, p.y, p.ux, p.uy, [SKUA.pale, SKUA.brown], 2); skuaBird(p.x, p.y, p.a, p.ux >= 0 ? 1 : -1); });
      landings(r, 14, (E, a) => { const dir = Math.sign(E.x - r.from.x) || 1; hookBeak(E.x - dir * 2, E.y - 1, Math.max(0, 1 - a / 4), dir, fade(a, 12, 4)); chunks(E.x, E.y - 2, a, 3, r.seed, [SKUA.brown, SKUA.pale], 0.8, 14); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Stoop: it climbs, then stoops on the foe in a dive and hits with a splash, and a drop of tide flies home with it.
  skua_stoop: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, SKUA.brown, SKUA.dark); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit) skuaBird(U.x, U.y - 7, t, face(r), 1);
      landings(r, 20, (E, a) => { crown(E.x, E.y + 2, a, 16, '#e8f4fc', '#6aa0d0', 7); if (a > 4) takeBack(E, r.from, a - 4, 14, 1, '#6aa0d0', '#e8f4fc'); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Follow: two skuas wheel over the foe, and a gold ring marks it as the one Tozodo will follow.
  skua_track: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 5);
      for (let q = 0; q < 2; q++) { const a = t * 0.18 + q * Math.PI; skuaBird(E.x + Math.cos(a) * 10, E.y - 12 + Math.sin(a) * 2, t + q, Math.sin(a) > 0 ? -1 : 1, L); }
      landings(r, 26, (P, a) => { arc(P.x, P.y + 4, 7, 2, SKUA.gold, fade(a, 26, 6)); arc(P.x, P.y + 4, 5, 1.5, SKUA.pale, fade(a, 26, 6), (a * 0.03) % 1, (a * 0.03) % 1 + 0.5); });
    },
  },

  // Out of the Sun: a sun glares up beside Tozodo, its shape crosses the sun, and it is gone into the glare.
  skua_plunder: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = beside(r.from), L = hold(t, 0, r.end, 6);
      oval(B.x, B.y, 5, 5, SKUA.gold, L); oval(B.x, B.y, 3, 3, '#fff0a0', L);
      for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2 + t * 0.02; line(B.x + Math.cos(a) * 7, B.y + Math.sin(a) * 7, B.x + Math.cos(a) * (8 + (q + (t >> 2)) % 2), B.y + Math.sin(a) * (8 + (q + (t >> 2)) % 2), SKUA.gold, L); }
    },
    front(r) {
      const t = r.t, B = beside(r.from), hit = hitOf(r), u = prog(t, 0, hit);
      if (u > 0 && u < 1) skuaBird(B.x - 10 + 20 * u, B.y, t, 1, 1);
      landings(r, 12, (E, a) => { for (let q = 0; q < 4; q++) { const ang = q * 1.57 + 0.8; if (((a + q) % 4) < 2) glint(E.x + Math.cos(ang) * 6, E.y + Math.sin(ang) * 5, SKUA.gold, fade(a, 12, 4)); } });
    },
    scene(r) { const a = r.t - hitOf(r); return { glare: a >= 0 && a < 3 ? 0.5 - a * 0.15 : 0 }; },
    lights(r) { return [lit(beside(r.from), SKUA.gold, 1.4 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Partica
  // Trailing Sting: two moon jellies drift over trailing their tentacles, and their stings run down the foe.
  bloom_tendrils: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => jelly(p.x, p.y - 2, 2.5, p.a));
      landings(r, 18, (E, a, i) => { for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa >= 0 && aa < 10) line(E.x - 3 + q * 3 + i, E.y - 5, E.x - 3 + q * 3 + i + Math.sin(aa), E.y - 5 + aa * 0.8, q % 2 ? JELLY.violet : JELLY.pale, 1 - aa / 10); } });
    },
  },

  // Upwelling: moon jellies rise out of the deep under every foe, sting, and stun them in a spray.
  bloom_upwell: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => jelly(p.x, p.y, 2, p.a));
      landings(r, 18, (E, a, i) => { if (i % 5) return; crown(E.x, E.y + 4, a, 16, JELLY.glow, JELLY.violet, 7); daze(E, a, 18, JELLY.violet, JELLY.pale); });
    },
  },

  // Drift Over: three jellies drift down over the foe, and one stays hanging over it, stinging turn after turn.
  bloom_swarm: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => jelly(p.x, p.y, 2, p.a));
      landings(r, 32, (E, a, i) => { if (i === 0) jelly(E.x + 4, E.y - 9 + Math.sin(a / 5), 3, a, fade(a, 32, 8)); bleed(E, a, 14, 2, r.seed + i, JELLY.violet); });
    },
  },

  // Open Bloom: a bloom of moon jellies circles Partica and spreads out over every foe, trailing stings.
  bloom_openbloom: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, go = leaveOf(r); if (t < go + 4) for (let q = 0; q < 5; q++) { const a = t * 0.08 + q * 1.26; jelly(U.x + Math.cos(a) * 11, U.y - 4 + Math.sin(a) * 5, 2, t + q, hold(t, 0, go + 4, 4)); } },
    front(r) {
      flights(r, p => jelly(p.x, p.y, 2.5, p.a + p.f.i));
      landings(r, 22, (E, a, i) => { if (i % 8) return; for (let q = 0; q < 3; q++) jelly(E.x - 7 + q * 7, E.y - 10 + (q % 2) * 3 + Math.sin((a + q * 4) / 5), 2, a + q, fade(a, 22, 6)); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 8 ? shake(a, 8, 1) : 0 }; },
    lights(r) { return r.to.map(E => lit(E, JELLY.violet, 1.2 * hold(r.t, hitOf(r) - 4, r.end, 6), 14)); },
  },

  // ---------------- Ajoku
  // Waterlog: two drops lob over and soak the foe, and a dark wet patch spreads under it.
  drift_waterlog: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 26, (E, a) => oval(E.x, E.y + 5, Math.min(7, 2 + a * 0.5), 1, '#3a4a58', fade(a, 26, 6))); },
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r) + 2) logEnd(U.x + face(r) * 5, U.y - 6, 3, 1);
      flights(r, p => bead(p.x, p.y, '#d8f0f8', '#6aa0d0'));
      landings(r, 16, (E, a, i) => bleed(E, a, 16, 3, r.seed + i, '#6aa0d0'));
    },
  },

  // Weed Seed: strands of weed lob over, root at the foe's feet and grow up it, and green flecks of what they drain go home.
  drift_tideseed: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a, i) => { if (i) return; for (let q = 0; q < 4; q++) weed(E.x - 6 + q * 4, E.y + 6, Math.min(6, a >> 1) - (q % 2), a, fade(a, 30, 8)); }); },
    front(r) {
      flights(r, p => kelpStrand(p.x, p.y - 3, p.a, 6));
      landings(r, 24, (E, a, i) => { if (i === 0 && a > 8) takeBack(E, r.from, a - 8, 14, 3, DRIFT.weed, '#b8e090'); });
    },
  },

  // Bark Coat: plates of bark close in on the ally and grow over it in a coat.
  drift_graincoat: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => barkPlate(p.x, p.y));
      landings(r, 26, (E, a) => { const L = fade(a, 26, 6); for (let q = 0; q < 6; q++) { if (a < q) continue; const ang = q / 6 * Math.PI * 2 + 0.3; barkPlate(E.x + Math.cos(ang) * 6, E.y + Math.sin(ang) * 5, L); } });
    },
  },

  // Washed Up: a big wave washes driftwood logs up onto every foe, they roll in and pin them, and weed tangles their feet.
  drift_washedup: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a, i) => { if (i % 4) return; for (let q = 0; q < 3; q++) weed(E.x - 7 + q * 7, E.y + 6, Math.min(5, a >> 1), a + q, fade(a, 30, 8)); }); },
    front(r) {
      flights(r, p => { if (p.f.i % 2) { logEnd(p.x, p.y, 2.5, 1); dither(Math.round(p.x - (p.ux >= 0 ? 8 : -1)), Math.round(p.y - 1), 8, 3, DRIFT.brown, 1); } else curl(p.x, p.y + 3, 6, p.ux >= 0 ? 1 : -1, p.a, 1, false); });
      landings(r, 22, (E, a, i) => { if (i % 4 === 0) { crown(E.x, E.y + 4, a, 18, SURF.foam, SURF.blue, 8, 1.2); if (a > 4) { dither(E.x - 9, E.y + 2, 18, 3, DRIFT.brown, fade(a, 22, 6)); logEnd(E.x + 9, E.y + 3, 2, fade(a, 22, 6)); } } }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
  },

  // ---------------- Spuawa
  // Foam Wash: foam washes over the foe in waves and fizzes off it, and its good fortune pops away in a glint.
  spume_foamwash: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => foam(p.x, p.y, 2, p.a, 1, r.seed + p.f.i));
      landings(r, 22, (E, a, i) => { if (i) return; foam(E.x, E.y + 2 - a * 0.2, 5, a, fade(a, 22, 6), r.seed); if (a > 6 && a < 14) glint(E.x + 4, E.y - 8 - (a - 6), SPUME.lav, 1 - (a - 6) / 8); });
    },
  },

  // Foam Cover: foam rises round the ally and closes over it in a shell of bubbles.
  spume_becalm: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => foam(p.x, p.y, 1.5, p.a, 1, r.seed + p.f.i));
      landings(r, 30, (E, a) => { const L = fade(a, 30, 8); for (let q = 0; q < 10; q++) { if (a < q) continue; const ang = q / 10 * Math.PI * 2; arc(E.x + Math.cos(ang) * 7, E.y + Math.sin(ang) * 6, 1.5, 1.5, q % 2 ? SPUME.white : SPUME.blue, L); } });
    },
  },

  // Rinse Clean: rinse water rains on the ally, foam fizzes up round it, and dark flecks of what ailed it wash off.
  spume_washout: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => bead(p.x, p.y, SPUME.white, SPUME.blue));
      landings(r, 20, (E, a, i) => { if (i) return; foam(E.x, E.y + 3, 4, a, fade(a, 20, 6), r.seed); for (let q = 0; q < 3; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 10) px(E.x - 3 + q * 3, E.y + aa * 0.6, '#3a3048', 1 - aa / 10); } motes(E.x, E.y, a, 20, 4, r.seed, [SPUME.white, SPUME.blue], 6, 10); });
    },
  },

  // Kept Afloat: the ally floats on a raft of foam, and the bill for the damage it is spared hangs over it to be paid later.
  spume_keptafloat: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6); foam(E.x, E.y + 5, 7, t, L, r.seed); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r);
      flights(r, p => foam(p.x, p.y, 1.5, p.a, 1, r.seed + p.f.i));
      if (t >= hit) bill(E.x + 6, E.y - 10, t - hit, hold(t, hit, r.end, 6));
      landings(r, 22, (P, a) => ringOut(P.x, P.y, a, 22, SPUME.white, 12, 0.8, SPUME.lav));
    },
    lights(r) { return [lit(aim(r), SPUME.blue, 1.2 * hold(r.t, 0, r.end, 6), 14)]; },
  },

  // ---------------- Aeshio
  // Wave Shot: Aeshio draws back and fires the tide out as one long shot of water, and it bursts on the foe.
  ebb_lap: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => { if (p.f.i === 0) waterShot(p.x, p.y, p.ux, p.uy, 12); });
      landings(r, 16, (E, a, i) => { if (i === 0) crown(E.x, E.y + 3, a, 16, EBB.foam, EBB.blue, 8, 1.2); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Run Out: the tide lines run out from Aeshio toward the foe, ready to fire.
  ebb_setback: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, dir = face(r); tideLines(U.x + dir * 8, U.y + 3, 8, t, dir, hold(t, 0, r.end, 5)); },
    front(r) { landings(r, 14, (E, a) => ringOut(E.x, E.y + 3, a, 14, EBB.foam, 10, 0.4, EBB.blue)); },
  },

  // Pull In: the tide lines draw back into Aeshio from both sides and turn round it.
  ebb_slackwater: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 5);
      tideLines(U.x - 10, U.y + 3, 6, t, 1, L); tideLines(U.x + 10, U.y + 3, 6, t, -1, L);
      landings(r, 16, (E, a) => whirl(E.x, E.y + 4, 7, a * 0.4, fade(a, 16, 5), 0.35));
    },
  },

  // High Water: the water rises along the bottom of the field, and four crests run in a line from Aeshio and break on the foe.
  ebb_kingtide: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6), top = Math.round(60 - 8 * ease(prog(t, 0, 14))); dither(0, top, 96, 60 - top, EBB.dark, 0.5 * L); for (let x = (t >> 1) % 4; x < 96; x += 4) px(x, top, EBB.foam, L); dither(0, top + 1, 96, 1, EBB.blue, L); },
    front(r) {
      flights(r, p => { const d = p.ux >= 0 ? 1 : -1; blit(['.ff', 'fbb', 'bdd'], p.x, p.y, { f: EBB.foam, b: EBB.blue, d: EBB.dark }, 1, 1, d < 0); });
      landings(r, 20, (E, a) => crown(E.x, E.y + 4, a, 18, EBB.foam, EBB.blue, 8, 1.3), 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
    lights(r) { return [lit(aim(r), EBB.blue, 1.2 * hold(r.t, hitOf(r) - 4, hitOf(r) + 16, 4), 14)]; },
  },

  // Wave Crash: it rushes in like a wave and crashes on the foe, cracking the ground.
  ebb_skies: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, EBB.blue, EBB.dark); landings(r, 18, (E, a) => crackAt(E.x, E.y + 4, a, 18, EBB.foam, K, 9, r.seed), 2); },
    front(r) { landings(r, 16, (E, a) => crown(E.x, E.y + 3, a, 16, EBB.foam, EBB.blue, 8, 1.2), 2); },
    scene(r) { return { jolt: jolts(r, 1, 5) }; },
  },

  // Churned Water: drops churn round Aeshio, and the tide lines circle it as a guard.
  ebb_field: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; tideLines(U.x, U.y + 3, 9, t, (t >> 4) & 1 ? 1 : -1, hold(t, 0, r.end, 5)); },
    front(r) { flights(r, p => bead(p.x, p.y, EBB.foam, EBB.blue, 1, EBB.dark)); landings(r, 16, (E, a) => ringOut(E.x, E.y, a, 16, EBB.foam, 10, 0.85, EBB.blue)); },
  },

  // Ebb Out: Aeshio lifts, and the tide lines run back out from it.
  ebb_cannon: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; for (const s of [-1, 1]) tideLines(U.x + s * 8, U.y + 3, 5, t, s, hold(t, 0, r.end, 5)); },
    front(r) { landings(r, 12, (E, a) => ringOut(E.x, E.y + 3, a, 12, EBB.foam, 11, 0.35)); },
  },

  // Undertow Pull: an undertow rushes out under the foe, every tide line pulling away from it, and it drags the foe off.
  ebb_blow: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), dir = Math.sign(E.x - r.from.x) || 1, L = hold(t, 0, r.end, 6);
      dither(E.x - 14, E.y + 4, 29, 3, EBB.dark, 0.5 * L);
      for (let q = 0; q < 8; q++) { const run = ((t * 2 + q * 9) % 32) - 16, y = E.y + 4 + (q % 3); line(E.x + run * dir, y, E.x + (run + 5) * dir, y, q % 2 ? EBB.foam : EBB.blue, L); }
      landings(r, 18, (P, a) => whirl(P.x, P.y + 4, 9, a * 0.5, fade(a, 18, 6), 0.35), 4);
    },
    front(r) { landings(r, 16, (E, a) => streaks(E.x, E.y, a, 16, Math.sign(E.x - r.from.x) || 1, EBB.foam, 3), 4); },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 12 ? shake(a, 12, 2) : 0 }; },
  },

  // ---------------- Ardeagi
  // Bill Stab: it darts its neck out and its long gold bill stabs through the foe.
  heron_billstab: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), hit = hitOf(r), d = Math.hypot(E.x - U.x, E.y - U.y) || 1;
      if (t >= hit - 3 && t < hit + 3) heronBill(U.x, U.y - 2, (E.x - U.x) / d, (E.y - U.y + 2) / d, Math.min(d, 10 + (t - hit + 3) * 3), 1);
      landings(r, 12, (P, a) => { const n = Math.min(1, (a + 1) / 2); line(P.x - 5, P.y - 1, P.x - 5 + 10 * n, P.y + 1, W, fade(a, 10, 4)); sparks(P.x, P.y, a, 5, r.seed, HERON.gold, 6, 6); }, 2);
    },
    scene(r) { return { jolt: jolts(r, 1, 4) }; },
  },

  // Reed Snare: reeds spring up round the foe and close in on it, holding its legs.
  heron_reedsnare: {
    noFlights: true, noLandings: true,
    back(r) { landings(r, 30, (E, a) => { const L = fade(a, 30, 8), h = Math.min(9, a + 2); reeds(E.x - 5, E.y + 6, 3, h, a, L); reeds(E.x + 6, E.y + 6, 2, h - 1, a + 3, L); }); },
    front(r) { flights(r, p => { px(p.x, p.y, HERON.head); px(p.x, p.y + 1, HERON.reed); px(p.x, p.y + 2, HERON.reed); }); landings(r, 14, (E, a) => ringOut(E.x, E.y + 4, a, 14, HERON.gold, 9, 0.35)); },
  },

  // Spot Prey: still among the reeds, it spots the foe, flicks water at it, and a gold eye marks it as prey.
  heron_reedstand: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; reeds(U.x + face(r) * 6, U.y + 6, 3, 9, t, hold(t, 0, hitOf(r) + 6, 4)); },
    front(r) {
      flights(r, p => bead(p.x, p.y, '#e8f4fc', '#6aa0d0'));
      landings(r, 26, (E, a) => { crown(E.x, E.y + 3, a, 14, '#e8f4fc', '#6aa0d0', 6); if (a > 4) { const L = fade(a, 26, 6); blit(['.gg.', 'gkkg', '.gg.'], E.x + 6, E.y - 8, { g: HERON.gold, k: K }, L); } });
    },
  },

  // Strike Down: Ardeagi sinks back into tall reeds and goes still, and only the gold of its eye shows, waiting.
  heron_longneck: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), h = Math.round(4 + 8 * ease(prog(t, 0, hitOf(r)))); reeds(U.x - 5, U.y + 6, 3, h, t, L); reeds(U.x + 5, U.y + 6, 3, h - 1, t + 4, L); },
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6);
      reeds(U.x, U.y + 6, 2, Math.round(4 + 7 * ease(prog(t, 0, hitOf(r)))), t + 2, L);
      if (t >= hitOf(r) && ((t >> 3) % 3) !== 2) { px(U.x + face(r) * 2, U.y - 3, HERON.gold, L); px(U.x + face(r) * 2, U.y - 2, W, L); }
      landings(r, 20, (E, a) => ringOut(E.x, E.y + 4, a, 20, HERON.gold, 13, 0.3, HERON.gray));
    },
    scene(r) { return { dark: 0.125 * hold(r.t, 0, r.end, 8) }; },
  },

  // Spring Up: its neck springs out, the long bill strikes and bites, and the foe is cut through.
  heron_strike: {
    noFlights: true, noLandings: true,
    back(r) { smear(r, HERON.gray, HERON.dark); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), hit = hitOf(r), d = Math.hypot(E.x - U.x, E.y - U.y) || 1;
      if (t >= hit - 3 && t < hit + 4) heronBill(U.x, U.y - 2, (E.x - U.x) / d, (E.y - U.y + 2) / d, Math.min(d, 12 + (t - hit + 3) * 3), 1);
      landings(r, 16, (P, a) => { jaws(P.x, P.y, Math.max(0, 3 - a), 3, HERON.gold, HERON.dark, fade(a, 10, 4)); const n = Math.min(1, (a + 1) / 3); thick(P.x + 7, P.y - 6, P.x + 7 - 14 * n, P.y - 6 + 11 * n, W, fade(a, 14, 4), HERON.gold); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
  },

  // ---------------- Annagi
  // Dart Off: a glass eel you can see through streaks off from Annagi and is gone, quick.
  elver_murk: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, dir = face(r), u = prog(t, 2, hitOf(r) + 6);
      if (u > 0 && u < 1) { const h = { x: U.x + dir * (4 + 20 * u), y: U.y - 2 - 6 * u }; glassEel({ x: h.x - dir * 10, y: h.y + 2 }, h, t, 1 - u * 0.5); }
      landings(r, 14, (E, a) => ringOut(E.x, E.y, a, 14, EEL.glass, 10, 0.8, EEL.blue));
    },
  },

  // Eel Coil: glass eels coil round every foe in a ring and squeeze until it reels.
  elver_glasseel: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => glassEel({ x: p.x - p.ux * 6, y: p.y - p.uy * 6 }, p, p.a, 1, 1));
      landings(r, 22, (E, a, i) => { if (i % 3) return; const L = fade(a, 22, 6); for (let q = 0; q < 16; q++) { const ang = q / 16 * Math.PI * 2 + a * 0.15, rr = 8 - Math.min(2, a * 0.2); px(E.x + Math.cos(ang) * rr, E.y + 1 + Math.sin(ang) * rr * 0.6, q === 0 ? EEL.red : q % 2 ? EEL.glass : EEL.blue, L); } daze(E, a, 22, EEL.glass, EEL.red); });
    },
  },

  // Writhe: an eel writhes across the foe, slick, and the ward round the foe breaks apart.
  elver_writhe: {
    noFlights: true, noLandings: true,
    front(r) {
      flights(r, p => glassEel({ x: p.x - p.ux * 8, y: p.y - p.uy * 8 }, p, p.a, 1, 2));
      landings(r, 18, (E, a) => { if (a < 10) for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2, d = 7 + a * 0.6; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, EEL.blue, 1 - a / 10); } bleed(E, a, 18, 3, r.seed, EEL.glass); });
    },
  },

  // Elver Run: a run of glass eels streams in with Annagi, they bite the foe, and one holds on.
  elver_elverrun: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r);
      if (t < hit) for (let q = 0; q < 3; q++) { const p = userAtFrame(r, t - 2 - q * 2); glassEel({ x: p.x - face(r) * 8, y: p.y - 3 + q * 3 }, { x: p.x, y: p.y - 3 + q * 3 }, t + q * 3, 1 - q * 0.2, 1); }
      landings(r, 24, (E, a) => { jaws(E.x, E.y, Math.max(0, 4 - a * 2), 3, EEL.glass, EEL.red, fade(a, 10, 4)); crown(E.x, E.y + 3, a, 14, '#e8f4fc', EEL.blue, 6); if (a > 6) glassEel({ x: E.x + 3, y: E.y - 4 }, { x: E.x - 2, y: E.y - 1 }, a, fade(a, 24, 6), 1); }, 4);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: a >= 0 && a < 10 ? shake(a, 10, 2) : 0 }; },
  },
};
