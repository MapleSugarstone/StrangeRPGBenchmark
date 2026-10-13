// Part C of the move-art pass: each move's own picture for the kinds in Notes/move-art/parts.ts, keyed by move id. Each
// kind keeps one motif drawn by its own helper in its own sprite colors, with hard bands and the ordered dither only.
import { aim, arc, bands, beside, blit, dither, ease, glint, hash, high, hitOf, hold, leaveOf, line, oval, prog, px, shake, thick, userAt, wash, waterDome, type FxRun, type LegendArt, type Pt, type SceneLight } from './kit';

const W = '#ffffff';

// ---------------------------------------------------------------- shared timing

/** A landing's age with hit-stop: it reads 0 for the first n+1 frames, so a layer holds still on the blow. */
const hs = (a: number, n = 2): number => (a <= n ? 0 : a - n);
/** A level that is 1 until the last `f` frames before `len`, then thins to 0. */
const fade = (a: number, len: number, f = 4): number => (a < 0 || a >= len ? 0 : Math.min(1, (len - a) / f));
/** Which way a whorl faces: the near one looks right (1) and the far one left (-1). */
const face = (p: Pt): number => (high(p) ? -1 : 1);
/** The frame of the last landing. */
const lastOf = (r: FxRun): number => (r.hits.length ? r.hits[r.hits.length - 1].at : hitOf(r));
/** How many landings have happened by this frame. */
const landedN = (r: FxRun): number => r.hits.filter(h => r.t >= h.at).length;
/** The frame a target's own first landing comes. */
const hitAt = (r: FxRun, j: number): number => { const h = r.hits.find(x => x.to === j); return h ? h.at : hitOf(r); };
/** A whole-pixel shake from the first landing. */
const jolt = (r: FxRun, len = 6, size = 1): { jolt: number } => ({ jolt: shake(r.t - hitOf(r), len, size) });

/** Calls fn for each landing younger than `len` frames with its target, its age, and its place in the list. */
function landed(r: FxRun, len: number, fn: (E: Pt, a: number, i: number) => void): void {
  for (let i = 0; i < r.hits.length; i++) { const h = r.hits[i], a = r.t - h.at; if (a >= 0 && a < len) fn(r.to[h.to] || r.to[0], a, i); }
}

interface Fly { x: number; y: number; ux: number; uy: number; u: number; a: number; i: number; n: number; E: Pt }

/** Where a flight is at u along a path, on the same paths the spec grammar draws. */
function pathAt(path: string, u: number, S: Pt, E: Pt, i: number, n: number, to: number, seed: number): { x: number; y: number; show: boolean } {
  const dx = E.x - S.x, dy = E.y - S.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const jit = (k: number): number => hash(seed * 31 + i * 7 + to * 13 + k) - 0.5;
  let x = S.x + dx * u, y = S.y + dy * u, show = true;
  switch (path) {
    case 'arc': { const v = (u - 0.8) / 0.2; y -= (4 + d / 9) * (u <= 0.8 ? (u / 0.8) ** 4 : 1 + v - 2 * v * v); break; }
    case 'wave': { const o = Math.sin(u * Math.PI * 4 + i) * 4; x += nx * o; y += ny * o; break; }
    case 'zigzag': { const z = (u * 6 + i * 0.5) % 2, o = (z < 1 ? z : 2 - z) * 8 - 4; x += nx * o; y += ny * o; break; }
    case 'spiral': { const rr = 5 * (1 - u), o = Math.sin(u * Math.PI * 6 + i * 2) * rr; x += nx * o; y += ny * o + Math.cos(u * Math.PI * 6 + i * 2) * rr * 0.4; break; }
    case 'rain': { const sx = E.x + jit(1) * 14, sy = E.y - (E.y > 30 ? 18 : 34); x = sx + (E.x - sx) * u; y = sy + (E.y - sy) * u; break; }
    case 'rise': { const sx = E.x + jit(2) * 8; x = sx + (E.x - sx) * u; y = E.y + 6 - 8 * u; show = u > 0.15; break; }
    case 'converge': { const g = (i / Math.max(1, n)) * Math.PI * 2 + seed, sx = E.x + Math.cos(g) * 18, sy = E.y + Math.sin(g) * 11; x = sx + (E.x - sx) * ease(u); y = sy + (E.y - sy) * ease(u); break; }
    case 'orbit': {
      const g0 = i * Math.PI * 2 / Math.max(1, n);
      if (u < 0.6) { const g = u / 0.6 * Math.PI * 4 + g0; x = S.x + Math.cos(g) * 9; y = S.y + Math.sin(g) * 5; }
      else { const ox = S.x + Math.cos(Math.PI * 4 + g0) * 9, oy = S.y + Math.sin(Math.PI * 4 + g0) * 5, v = (u - 0.6) / 0.4; x = ox + (E.x - ox) * v; y = oy + (E.y - oy) * v; }
      break;
    }
    case 'sweep': { const dir = E.x >= S.x ? 1 : -1; x = E.x + dir * (44 * u - 20); y = E.y - 1 + Math.sin(Math.PI * u) * 2; break; }
    case 'return': { const v = u < 0.5 ? ease(u * 2) : 1 - ease((u - 0.5) * 2); x = S.x + dx * v; y = S.y + dy * v - Math.sin(Math.PI * u * 2) * 3; break; }
  }
  return { x, y, show };
}

/** Calls fn for each thing in flight this frame on the spec's path (or `path`), with its place, heading, progress, and age, or `lag` frames behind it. */
function flying(r: FxRun, fn: (p: Fly) => void, path?: string, lag = 0): void {
  const P = path || r.plan.path || 'line';
  for (const f of r.flights) {
    const a = r.t - f.t0 - lag;
    if (a < 0 || a >= f.dur) continue;
    const E = r.to[f.to] || r.to[0], u = a / f.dur;
    const p = pathAt(P, u, r.from, E, f.i, f.n, f.to, r.seed), b = pathAt(P, Math.max(0, u - 0.06), r.from, E, f.i, f.n, f.to, r.seed);
    let ux = p.x - b.x, uy = p.y - b.y, m = Math.hypot(ux, uy);
    if (m < 0.01) { ux = E.x - r.from.x; uy = E.y - r.from.y; m = Math.hypot(ux, uy) || 1; }
    if (p.show) fn({ x: p.x, y: p.y, ux: ux / m, uy: uy / m, u, a, i: f.i, n: f.n, E });
  }
}

/** A small light on each of the first two things in flight, for a picture that draws its own flights. */
function flyLights(r: FxRun, tint: string, path?: string): SceneLight[] {
  const out: SceneLight[] = [];
  flying(r, p => { if (p.i < 2) out.push({ x: Math.round(p.x), y: Math.round(p.y), r: 6, lv: 1.4, tint }); }, path);
  return out;
}

// ---------------------------------------------------------------- shared drawing

/** Where a small sign sits over a whorl: `dx` across and above the near one, right of the far one, clear of both panels and the message line. */
const signAt = (p: Pt, dx: number): Pt => (high(p) ? { x: Math.min(89, p.x + 11), y: p.y - 3 } : { x: p.x + dx, y: p.y - 10 });

/** A ring round a point, flattened the way the ground is. */
const ring = (x: number, y: number, rad: number, c: string, lv = 1): void => arc(x, y, rad, rad * 0.6, c, lv);

/** n chunks thrown up from x, y on arcs that fall faster each frame, a frames old, colored from `cols` by turns. */
function chunks(x: number, y: number, a: number, n: number, seed: number, cols: string[], life = 16, v = 1): void {
  if (a < 0 || a >= life) return;
  const lv = fade(a, life, 4);
  for (let q = 0; q < n; q++) {
    const g = Math.PI * (1.08 + 0.84 * hash(seed + q * 5)), sp = (0.6 + hash(seed + q * 9) * 0.8) * v;
    const cx = x + Math.cos(g) * sp * a * 1.3, cy = y + Math.sin(g) * sp * a * 1.5 + 0.09 * a * a, c = cols[q % cols.length];
    px(cx, cy, c, lv);
    px(cx, cy + 1, cols[(q + 1) % cols.length], lv);
    if (q % 2 === 0) px(cx + 1, cy, c, lv);
  }
}

/** n sparks thrown out round x, y, light while young and in c2 after, slowing as they go. */
function sparks(x: number, y: number, a: number, n: number, seed: number, c1: string, c2: string, life = 8, v = 1): void {
  if (a < 0 || a >= life) return;
  for (let q = 0; q < n; q++) {
    const g = (q / n + hash(seed + q) * 0.12) * Math.PI * 2, d = 1 + v * 2.4 * a * (1 - a / (2 * life));
    px(x + Math.cos(g) * d, y + Math.sin(g) * d * 0.8, a < life / 2 ? c1 : c2, a < life - 2 ? 1 : 0.5);
  }
}

/** n motes rising from round x, y with a slow wobble, a frames old: the lift of a heal or a blessing. */
function motes(x: number, y: number, a: number, n: number, seed: number, cols: string[], life = 24, spread = 8): void {
  if (a < 0 || a >= life) return;
  for (let q = 0; q < n; q++) {
    const b = a - q * 2;
    if (b < 0) continue;
    const mx = x + (hash(seed + q * 3) - 0.5) * 2 * spread + Math.sin((b + q * 4) / 3), my = y + 4 - b * 0.6;
    px(mx, my, cols[q % cols.length], fade(b, life - q * 2, 5));
  }
}

/** A tapered tail behind a moving point: one pixel in each of `cols`, then one dithered. */
function tail(x: number, y: number, ux: number, uy: number, cols: string[], lv = 1): void {
  cols.forEach((c, i) => px(x - ux * (i + 1), y - uy * (i + 1), c, lv));
  px(x - ux * (cols.length + 1), y - uy * (cols.length + 1), cols[cols.length - 1], lv * 0.5);
}

/** A smear in two colors behind the user while it dashes in, from where it is back toward where it stood. */
function smear(r: FxRun, c1: string, c2: string): void {
  if (r.contact >= 0 && r.t > r.contact) return;
  const U = userAt(r), dx = U.x - r.from.x, dy = U.y - r.from.y, d = Math.hypot(dx, dy);
  if (d < 3) return;
  const n = Math.min(12, d), ux = dx / d, uy = dy / d;
  for (let i = 4; i < n; i++) {
    const lv = i < n - 3 ? 1 : 0.5, x = U.x - ux * i, y = U.y - uy * i;
    px(x, y - 2, c2, lv * 0.75); px(x, y, c1, lv); px(x, y + 2, c2, lv * 0.75);
    if (i < n * 0.6) { px(x, y - 1, c1, lv); px(x, y + 1, c1, lv); }
  }
}

// ---------------------------------------------------------------- Haota: the cowrie's mantle, a soft spotted lobe with a polish gleam

const HAO = { tan: '#af7850', cream: '#f9f1e1', dark: '#543423', light: '#d0a070', gleam: '#fff8e8' };
const COWRIE = ['.cc.', 'cwtc', 'ctdc', '.cc.'];
const cowrie = (x: number, y: number, lv = 1): void => blit(COWRIE, x, y, { c: HAO.cream, w: W, t: HAO.tan, d: HAO.dark }, lv);

/** Haota's mantle: a spotted dome w each side and h high over `foot`, rimmed in cream, its gleam crossing at `shine` (0 to 1). */
function mantle(x: number, foot: number, w: number, h: number, shine: number, lv = 1, fill = true): void {
  if (h < 1 || w < 1 || lv <= 0) return;
  x = Math.round(x); foot = Math.round(foot);
  if (fill) for (let i = 0; i < h; i++) {
    const half = Math.round(w * Math.sqrt(1 - (i * i) / (h * h)));
    dither(x - half, foot - i, 2 * half + 1, 1, i > h * 0.6 ? HAO.light : HAO.tan, lv);
  }
  arc(x, foot, w, h, HAO.cream, lv, 0.5, 1);
  for (let q = 0; q < 5; q++) { const g = (0.56 + q * 0.09) * Math.PI * 2; px(x + Math.cos(g) * w * 0.65, foot + Math.sin(g) * h * 0.6, HAO.dark, lv); }
  if (shine > 0 && shine < 1) for (let i = 1; i < h; i++) {
    const gx = x - w + 2 * w * shine + i * 0.5, half = w * Math.sqrt(1 - (i * i) / (h * h));
    if (Math.abs(gx - x) < half) { px(gx, foot - i, W, lv); px(gx + 1, foot - i, HAO.gleam, lv * 0.5); }
  }
}

/** One lobe of mantle, the side `s` of a closing pair: tan, spotted, its inner edge rimmed in cream. */
function lobe(x: number, y: number, s: number, lv: number): void {
  oval(x, y, 4, 7, HAO.tan, lv * 0.5);
  arc(x, y, 4, 7, HAO.cream, lv, s > 0 ? 0.25 : 0.75, s > 0 ? 0.75 : 1.25);
  arc(x, y, 4, 7, HAO.light, lv, s > 0 ? -0.25 : 0.25, s > 0 ? 0.25 : 0.75);
  px(x, y - 3, HAO.dark, lv); px(x - s, y + 2, HAO.dark, lv);
}

// ---------------------------------------------------------------- Lainami: standing gray water whose top rocks like a basin

const SEI = { gray: '#6a8aa7', foam: '#eef6fd', deep: '#30506f', light: '#9ab4c8' };

/** Lainami's standing water: a gray block over `foot`, w each side and h high, its top tipped `tilt` pixels at the edges. */
function standing(x: number, foot: number, w: number, h: number, tilt: number, lv = 1): void {
  if (h <= 0 || lv <= 0) return;
  x = Math.round(x); foot = Math.round(foot);
  const low = Math.max(1, Math.round(h * 0.35));
  dither(x - w, foot - low + 1, 2 * w + 1, low, SEI.deep, lv);
  for (let dx = -w; dx <= w; dx++) {
    const hh = Math.round(h + tilt * dx / w);
    if (hh <= low) continue;
    dither(x + dx, foot - hh + 1, 1, hh - low, SEI.gray, lv);
    px(x + dx, foot - hh, SEI.foam, lv);
    if ((dx & 3) === 1 && hh > low + 3) px(x + dx, foot - Math.round((hh + low) / 2), SEI.light, lv);
  }
}

const SEI_DROP = ['.f.', 'fgf', '.d.'];

// ---------------------------------------------------------------- Roibuki: spray that keeps going, and the shades it leaves

const SCU = { pale: '#c0ccd8', red: '#da031e', dark: '#3c3c4a', foam: '#eef2f8' };
const SCUD_ROWS = ['..pppp..', '.pppppp.', 'p.r..r.p', '.pppppp.', 'd.pppp.d', 'dd.pp.dd', '..p..p..', '.p....p.'];

/** A shade of Roibuki: its outline left behind on the dither, facing the way it was going. */
function shade(x: number, y: number, s: number, lv: number, eyes = true): void {
  blit(SCUD_ROWS, x, y, eyes ? { p: SCU.pale, r: SCU.red } : { p: SCU.pale }, lv, 1, s < 0);
}

/** A streak of spray with a white head, pale shades thinning out behind it, and a red fleck that flickers. */
function spray(x: number, y: number, ux: number, uy: number, len: number, t: number, lv = 1): void {
  for (let i = 0; i < len; i++) {
    const l = lv * (i < len * 0.5 ? 1 : i < len * 0.75 ? 0.5 : 0.25), cx = x - ux * i, cy = y - uy * i;
    px(cx, cy, i === 0 ? W : i < 3 ? SCU.foam : SCU.pale, l);
    if (i % 3 === 1) { px(cx - uy, cy + ux, SCU.pale, l * 0.5); px(cx + uy, cy - ux, SCU.pale, l * 0.5); }
  }
  if ((t >> 1) & 1) px(x - ux * 2 + uy, y - uy * 2 - ux, SCU.red, lv);
}

/** A star of spray: a white middle with arms that turn between a plus and a cross. */
function sprayStar(x: number, y: number, t: number, rad: number, lv = 1): void {
  px(x, y, W, lv);
  const plus = (t >> 1) & 1;
  for (let i = 1; i <= rad; i++) {
    const c = i === 1 ? SCU.foam : SCU.pale;
    if (plus) { px(x + i, y, c, lv); px(x - i, y, c, lv); px(x, y + i, c, lv); px(x, y - i, c, lv); }
    else { px(x + i, y + i, c, lv); px(x - i, y - i, c, lv); px(x + i, y - i, c, lv); px(x - i, y + i, c, lv); }
  }
}

// ---------------------------------------------------------------- Nitorshi: a sheet of enamel that catches the light

const ENA = { cream: '#efe3cf', gold: '#e9ab20', bronze: '#9f702f', sun: '#ffe890', dim: '#c8b898' };

/** Nitorshi's coat: a pane w by h of cream enamel with a gold rim, leaning `lean` pixels, a white gleam crossing at `gleam` (0 to 1). */
function coat(x: number, y: number, w: number, h: number, lean: number, gleam: number, lv = 1, body = ENA.cream): void {
  if (lv <= 0 || h < 1) return;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  for (let j = 0; j < h; j++) {
    const off = Math.round(lean * (j / Math.max(1, h - 1) - 0.5));
    dither(x0 + off, y0 + j, w, 1, j === 0 ? ENA.gold : j === h - 1 ? ENA.bronze : body, lv);
    px(x0 + off - 1, y0 + j, ENA.gold, lv); px(x0 + off + w, y0 + j, ENA.bronze, lv);
    if (gleam > 0 && gleam < 1) {
      const gx = x0 + off + Math.round((w + h) * gleam - j);
      if (gx >= x0 + off && gx < x0 + off + w) { px(gx, y0 + j, W, lv); if (gx + 1 < x0 + off + w) px(gx + 1, y0 + j, ENA.sun, lv); }
    }
  }
}

/** The Sunlit mark: a small gold sun with four rays that turn. */
function sunlit(x: number, y: number, t: number, lv = 1): void {
  oval(x, y, 1.5, 1.5, ENA.gold, lv);
  px(x, y, ENA.sun, lv);
  const d = (t >> 2) & 1;
  for (const [i, j] of d ? [[3, 0], [-3, 0], [0, 3], [0, -3]] : [[2, 2], [-2, -2], [2, -2], [-2, 2]]) px(x + i, y + j, ENA.sun, lv);
}

// ---------------------------------------------------------------- Poscus: a glazed pig rolled into a ball, and the snow it gathers

const POS = { white: '#f5f5f9', pink: '#e697a7', blue: '#3563c2', ice: '#a8c8f0', shade: '#c8d4e8' };

/** Poscus rolled up: a white ball of radius rad ringed in blue glaze, a band and its pink snout turning with `spin`. */
function piggy(x: number, y: number, rad: number, spin: number, lv = 1): void {
  oval(x, y, rad, rad, POS.white, lv);
  arc(x, y, rad, rad, POS.blue, lv);
  const c = Math.cos(spin), s = Math.sin(spin);
  line(x - c * (rad - 1), y - s * (rad - 1), x + c * (rad - 1), y + s * (rad - 1), POS.blue, lv);
  px(x - s * rad * 0.5, y + c * rad * 0.5, POS.pink, lv); px(x - s * rad * 0.5 + 1, y + c * rad * 0.5, POS.pink, lv);
}

/** A clump of snow: a white lump with a pale blue underside. */
function snow(x: number, y: number, rad: number, lv = 1): void {
  oval(x, y, rad, rad * 0.8, POS.white, lv);
  if (rad >= 2) dither(Math.round(x - rad + 1), Math.round(y + rad * 0.4), Math.round(rad * 2 - 1), 1, POS.shade, lv);
}

// ---------------------------------------------------------------- Kolikni: tiny cowrie coins flicked from a purse grown shut

const KOL = { teal: '#72e3c3', light: '#c0f4e2', edge: '#3a9a80', dark: '#272723', leather: '#926b4b', hide: '#6a4a32' };
const COIN = [['.tlt.', 'tlhlt', 'tkkkt', 'ttlte', '.eee.'], ['.tl.', 'tlht', 'tkkt', 'ttte', '.ee.'], ['l', 'h', 't', 't', 'e'], ['.lt.', 'thlt', 'tkkt', 'etlt', '.ee.']];
/** One of Kolikni's coins, a tiny cowrie with its slit, turning through face, tilt, edge, and tilt with `spin`. */
const coin = (x: number, y: number, spin: number, lv = 1): void => blit(COIN[spin & 3], x, y, { t: KOL.teal, l: KOL.light, h: W, k: KOL.dark, e: KOL.edge }, lv);
const PURSE = ['..d.d..', '.lllll.', 'lltttll', 'lhhhhhl', 'lllllll', '.lllll.'];
/** Kolikni's purse, its mouth of coins showing, or burst open with `open`. */
function purse(x: number, y: number, lv: number, open = 0): void {
  blit(PURSE, x, y + open, { d: KOL.dark, l: KOL.leather, t: KOL.teal, h: KOL.hide }, lv);
  if (open > 0) { blit(['ll...ll'], x, y - 3 - open, { l: KOL.leather }, lv); for (let q = 0; q < 3; q++) coin(x - 3 + q * 3, y - 3 - open, q, lv); }
}

// ---------------------------------------------------------------- Limashi: scouring grit and the scratches it leaves

const LIM = { sand: '#ccad6d', gold: '#fbdc7c', brown: '#957444', pale: '#fff4c8' };
const LIM_COLS = [LIM.sand, LIM.gold, LIM.brown];

/** A cloud of n grains of grit round x, y within rad, turning with t, in sand, gold, and brown. */
function grit(x: number, y: number, rad: number, n: number, seed: number, t: number, lv = 1): void {
  for (let q = 0; q < n; q++) {
    const g = hash(seed + q) * Math.PI * 2 + t * 0.15 * (q % 2 ? 1 : -1), d = (0.3 + 0.7 * hash(seed + q * 3)) * rad;
    const gx = x + Math.cos(g) * d, gy = y + Math.sin(g) * d * 0.7;
    px(gx, gy, LIM_COLS[q % 3], lv);
    if (q % 4 === 0) px(gx + 1, gy, LIM.gold, lv);
  }
}

/** k parallel scratches across x, y, `len` long, drawn in by n (0 to 1), each with a white leading edge. */
function scour(x: number, y: number, k: number, len: number, n: number, lv = 1, slope = -0.5): void {
  for (let i = 0; i < k; i++) {
    const ox = x - len / 2 + i, oy = y + (i - (k - 1) / 2) * 2, ex = ox + len * n, ey = oy + len * n * slope;
    line(ox, oy, ex, ey, i % 2 ? LIM.sand : LIM.gold, lv);
    px(ex, ey, W, lv);
  }
}

// ---------------------------------------------------------------- Faience: a glazed bellflower that rings when touched

const FAI = { glaze: '#25a5ad', light: '#8ee0e0', yellow: '#f9ca5a', pot: '#73452c', dark: '#4a2a1a' };
const FBELL = ['..g..', '.lht.', 'ltttt', 'ttttt', 't.y.t'];
/** A glazed bellflower, swung one way or the other with `swing`, at `scale`. */
const fbell = (x: number, y: number, swing: number, lv = 1, scale = 1): void => blit(FBELL, x, y, { g: FAI.pot, l: FAI.light, h: W, t: FAI.glaze, y: FAI.yellow }, lv, scale, swing > 0);
/** The ting: n thin rings running out from x, y, glaze and yellow by turns, each starting 3 frames after the last. */
function ting(x: number, y: number, a: number, n: number, len = 14, big = 1): void {
  for (let q = 0; q < n; q++) { const b = a - q * 3; if (b < 0 || b >= len) continue; const rr = (2 + b * 0.9) * big; arc(x, y, rr, rr * 0.7, q % 2 ? FAI.yellow : FAI.light, fade(b, len, 5)); }
}

// ---------------------------------------------------------------- Serrari: three teeth that mesh on whatever is there

const SER = { bone: '#eedace', red: '#c5002a', gum: '#643d1e', pale: '#fff4ec' };
const TOOTH = ['.ggg.', 'wwwww', 'whwww', 'wwwww', '.www.', '..w..'];
/** One big tooth pointing down, or up with `up`. */
const tooth = (x: number, y: number, up: boolean, lv = 1): void => blit(TOOTH, x, y, { g: SER.red, w: SER.bone, h: W }, lv, 1, false, up);
const SMALL_TOOTH = ['ggg', 'whw', 'www', '.w.'];
/** Serrari's mesh: a row of n teeth pointing down and a row pointing up, `gap` pixels from y each, offset half a tooth. */
function mesh(x: number, y: number, n: number, gap: number, lv = 1): void {
  for (let q = 0; q < n; q++) {
    const ox = x + (q - (n - 1) / 2) * 4;
    blit(SMALL_TOOTH, ox, y - gap - 1, { g: SER.red, w: SER.bone, h: W }, lv);
    blit(SMALL_TOOTH, ox + 2, y + gap + 1, { g: SER.red, w: SER.bone, h: W }, lv, 1, false, true);
  }
}
/** Red drops running down from x, y, a frames old. */
function blood(x: number, y: number, a: number, n: number, seed: number, len = 18): void {
  for (let q = 0; q < n; q++) { const b = a - q * 3; if (b < 0 || b >= len) continue; const dx = x + (hash(seed + q) - 0.5) * 8; px(dx, y + b * 0.6 + 0.04 * b * b, SER.red, fade(b, len)); px(dx, y + b * 0.6 + 0.04 * b * b - 1, SER.red, 0.5 * fade(b, len)); }
}

// ---------------------------------------------------------------- Rakoma: the gap between two teeth

const RAK = { white: '#efebdf', violet: '#b565f3', dark: '#54437a', deep: '#2a2040' };
/** Rakoma's gap: two white tooth columns h high standing over `foot`, w apart, the void between them dark with violet edges. */
function gapAt(x: number, foot: number, h: number, w: number, lv = 1): void {
  if (h < 2 || lv <= 0) return;
  x = Math.round(x); foot = Math.round(foot);
  const half = Math.round(w / 2);
  if (w > 0) { dither(x - half, foot - h + 1, 2 * half + 1, h, RAK.deep, 0.75 * lv); line(x - half, foot - h + 1, x - half, foot, RAK.violet, lv); line(x + half, foot - h + 1, x + half, foot, RAK.violet, lv); }
  for (const s of [-1, 1]) {
    const cx = x + s * (half + 2);
    dither(cx - 1, foot - h + 2, 3, h - 2, RAK.white, lv);
    px(cx, foot - h + 1, RAK.white, lv);
    line(cx - s, foot - h + 3, cx - s, foot - 1, '#c8c0d8', lv);
  }
}

// ---------------------------------------------------------------- Makimen: the rolled-in lip, a spiral that rolls and unrolls

const MAK = { pale: '#e3c3b3', maroon: '#933c55', pink: '#bc7d8d', light: '#f8e4da' };
/** Makimen's curl: a spiral of `rad` round x, y turned by `phase`, pale outside and maroon inside, its outer end `open` (0 to 1) unrolled into a strip. */
function curl(x: number, y: number, rad: number, phase: number, lv = 1, open = 0, dir = 1): void {
  const n = Math.round(10 + rad * 3), keep = Math.round(n * (1 - open));
  let ex = x, ey = y;
  for (let k = 0; k <= keep; k++) {
    const g = phase + dir * k * 0.55, rr = rad * k / n;
    ex = x + Math.cos(g) * rr; ey = y + Math.sin(g) * rr * 0.8;
    px(ex, ey, k > n * 0.5 ? MAK.pale : k > n * 0.25 ? MAK.pink : MAK.maroon, lv);
  }
  if (open > 0) { const len = rad * 3 * open; line(ex, ey, ex + dir * len, ey, MAK.pale, lv); line(ex, ey + 1, ex + dir * len, ey + 1, MAK.pink, lv); }
}

// ---------------------------------------------------------------- Tardas: a gilded mirror, and echoes that come three steps late

const TAR = { silver: '#dadee6', gold: '#d19a21', purple: '#633381', glass: '#a8b0c8', light: '#b088d0' };
/** Tardas's mirror: an oval of silver glass rx by ry in a gold frame, with a purple glint. */
function gilt(x: number, y: number, rx: number, ry: number, lv = 1): void {
  oval(x, y, rx - 1, ry - 1, TAR.glass, 0.5 * lv);
  arc(x, y, rx, ry, TAR.gold, lv);
  arc(x, y, rx - 1, ry - 1, TAR.silver, lv, 0.6, 0.8);
  px(x - rx * 0.4, y - ry * 0.4, W, lv); px(x + rx * 0.3, y + ry * 0.3, TAR.light, lv);
}
/** An echo: a purple outline ring, the shape of something that already happened. */
const echo = (x: number, y: number, rad: number, lv = 1): void => { arc(x, y, rad, rad, TAR.light, lv); px(x, y, TAR.purple, lv); };

// ---------------------------------------------------------------- Tain: a bare sheet of silver with blue sheen

const TAI = { silver: '#d4d8e4', blue: '#5a83cd', violet: '#6a5e80', light: '#a8c0f0' };
/** Tain's pane: a w by h sheet of silver, two blue sheen stripes sliding across it at `sheen`, and `tarn` (0 to 1) of it tarnished. */
function pane(x: number, y: number, w: number, h: number, sheen: number, lv = 1, tarn = 0): void {
  if (lv <= 0) return;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  dither(x0, y0, w, h, TAI.silver, lv);
  line(x0 - 1, y0, x0 - 1, y0 + h - 1, TAI.violet, lv); line(x0 + w, y0, x0 + w, y0 + h - 1, TAI.violet, lv);
  for (let q = 0; q < 2; q++) { const sx = x0 + ((sheen * (w + h) + q * 4) % (w + h)) - h; for (let j = 0; j < h; j++) { const gx = sx + j; if (gx >= x0 && gx < x0 + w) px(gx, y0 + h - 1 - j, q ? TAI.light : TAI.blue, lv); } }
  if (tarn > 0) dither(x0, y0 + Math.round(h * (1 - tarn)), w, Math.round(h * tarn), TAI.violet, 0.5 * lv);
}

// ---------------------------------------------------------------- Daz: the shine off a dome at full dark

const DAZ = { white: '#f8f0f0', gold: '#f2c453', purple: '#7a3fb4', night: '#1a1030' };
/** Daz's shine: a crescent highlight of radius rad, white inside and gold out, with a twinkle at its tip. */
function dome(x: number, y: number, rad: number, t: number, lv = 1): void {
  arc(x, y, rad, rad, DAZ.gold, lv, 0.55, 0.85);
  arc(x, y, rad - 1, rad - 1, DAZ.white, lv, 0.57, 0.83);
  if (rad >= 4) arc(x, y, rad - 2, rad - 2, DAZ.white, lv, 0.62, 0.78);
  const g = 0.85 * Math.PI * 2, tx = x + Math.cos(g) * rad, ty = y + Math.sin(g) * rad;
  if ((t >> 2) & 1) glint(tx, ty, DAZ.gold, lv); else px(tx, ty, W, lv);
}

// ---------------------------------------------------------------- Tulimuji: a wind that kept the auger shell's shape

const GYR = { pale: '#c4e4f4', blue: '#46a8e6', slate: '#476784', sand: '#c8a870', dust: '#8a7050' };
/** Tulimuji's funnel: a cone of spinning rings h high over `foot`, narrow at the bottom and w wide at the top, a white mark on each ring. */
function funnel(x: number, foot: number, h: number, w: number, t: number, lv = 1, c1 = GYR.blue, c2 = GYR.pale): void {
  if (h < 2 || lv <= 0) return;
  const k = Math.max(2, Math.round(h / 3));
  for (let i = 0; i < k; i++) {
    const u = i / (k - 1), rx = 1 + (w - 1) * u, y = foot - u * h, ph = t * 0.3 + i * 0.8, cx = x + Math.sin(ph * 0.5) * u * 1.5;
    arc(cx, y, rx, Math.max(0.6, rx * 0.28), i % 2 ? c1 : c2, lv, 0, 0.5);
    arc(cx, y, rx, Math.max(0.6, rx * 0.28), c1, lv * 0.5, 0.5, 1);
    px(cx + Math.cos(ph) * rx, y + Math.sin(ph) * rx * 0.28, W, lv);
  }
}
/** The Flux mark: a small swirl turning with t. */
const swirl = (x: number, y: number, t: number, lv = 1, c = GYR.blue): void => { arc(x, y, 3, 2, c, lv, t * 0.05, t * 0.05 + 0.7); px(x, y, W, lv); };

// ---------------------------------------------------------------- Kokala: lichen that creeps in a crust of rosettes

const LIC = { sage: '#afbe97', orange: '#cd7100', olive: '#4a5039', pale: '#d8e4c0' };
/** A crust of n lichen rosettes round x, y out to `rad` times `grow`, sage with olive undersides and orange cups. */
function crust(x: number, y: number, rad: number, n: number, seed: number, grow: number, lv = 1): void {
  for (let q = 0; q < n; q++) {
    const g = hash(seed + q) * Math.PI * 2, d = Math.sqrt(hash(seed + q * 3)) * rad * grow, cx = x + Math.cos(g) * d, cy = y + Math.sin(g) * d * 0.7;
    px(cx, cy, LIC.pale, lv); px(cx - 1, cy, LIC.sage, lv); px(cx + 1, cy, LIC.sage, lv); px(cx, cy - 1, LIC.sage, lv); px(cx, cy + 1, LIC.olive, lv);
    if (q % 3 === 0) px(cx, cy, LIC.orange, lv);
  }
}
/** A flake of lichen: a small rosette with an orange cup. */
const flake = (x: number, y: number, lv = 1): void => blit(['.s.', 'sos', '.d.'], x, y, { s: LIC.sage, o: LIC.orange, d: LIC.olive }, lv);

// ---------------------------------------------------------------- Maineri: the swell that lifts and sets down

const MAI = { teal: '#42a1b1', foam: '#e6f6f6', deep: '#26526f', light: '#7ccad4' };
/** Maineri's swell: a low hump of banded water over `foot`, w each side and h high, with a foam crest. */
const swellAt = (x: number, foot: number, w: number, h: number, t: number, lv = 1): void => waterDome(x, foot, w, h, t, MAI.deep, MAI.teal, MAI.light, MAI.foam, lv);
/** A shield plate: a pale arched plate with a white top edge. */
const plate = (x: number, y: number, lv = 1): void => blit(['.wwwww.', 'wfffffw', 'wfbfffw', 'wfffffw', '.wfffw.', '..www..'], x, y, { w: W, f: '#c8dce8', b: MAI.light }, lv);

// ---------------------------------------------------------------- Hakutu: chalk handprints and puffs of chalk dust

const CHA = { white: '#f2f2ee', lav: '#c0b8d8', gray: '#6d6d7b' };
const HANDP = ['.w.w.w', '.w.w.w', '.wwwww', 'wwwwwl', '.wwwl.', '..ll..'];
/** A chalk handprint, mirrored for the other hand. */
const handprint = (x: number, y: number, lv = 1, mirror = false): void => blit(HANDP, x, y, { w: CHA.white, l: CHA.lav }, lv, 1, mirror);
/** A puff of chalk dust that swells and thins: a white core and a lavender edge on the dither. */
function chalkPuff(x: number, y: number, a: number, life = 14, size = 1): void {
  if (a < 0 || a >= life) return;
  const rr = (1.5 + a * 0.35) * size, lv = fade(a, life, 6);
  oval(x, y - a * 0.15, rr + 1, (rr + 1) * 0.75, CHA.lav, 0.5 * lv);
  oval(x, y - a * 0.15, rr, rr * 0.75, CHA.white, lv * (a < life / 2 ? 1 : 0.5));
}

// ---------------------------------------------------------------- Sujiva: the white tide line, rising, and its salt post

const SUJ = { white: '#efefe9', gold: '#d19a21', slate: '#677d94', crust: '#c8d0d8' };
/** Sujiva's tide line: a white line from x0 to x1 with a crust of salt above it and gold ticks under it. */
function tideline(x0: number, x1: number, y: number, lv = 1): void {
  y = Math.round(y);
  line(x0, y, x1, y, SUJ.white, lv);
  for (let x = Math.round(x0); x <= x1; x++) { if (hash(x * 7 + 3) < 0.4) px(x, y - 1, SUJ.crust, lv); if ((x & 3) === 0) px(x, y + 1, SUJ.gold, lv); }
}
/** A Salt Post h high over `foot`: a slate post banded with salt and a gold flag on top. */
function saltPost(x: number, foot: number, h: number, lv = 1): void {
  if (h < 1) return;
  dither(x - 1, foot - h, 3, h, SUJ.slate, lv);
  for (let j = 1; j < h; j += 3) line(x - 1, foot - j, x + 1, foot - j, SUJ.white, lv);
  if (h > 4) blit(['gg', 'ggg', 'g'], x + 2, foot - h - 1, { g: SUJ.gold }, lv);
}

// ---------------------------------------------------------------- Kokieri: a tumbleweed that rolls and never roots

const TUM = { tan: '#bf9f6f', pink: '#c84f80', brown: '#705037', pale: '#e8d0a0' };
/** Kokieri's tumbleweed: a ball of crossing twigs of radius rad, turning with `spin`, with pink burrs caught in it. */
function weed(x: number, y: number, rad: number, spin: number, lv = 1): void {
  for (let q = 0; q < 3; q++) {
    const g = spin + q * 1.05;
    arc(x, y, Math.abs(Math.cos(g)) * rad + 0.5, rad, q % 2 ? TUM.tan : TUM.pale, lv);
    arc(x, y, rad, Math.abs(Math.sin(g)) * rad + 0.5, q % 2 ? TUM.brown : TUM.tan, lv);
  }
  for (let q = 0; q < 2; q++) px(x + Math.cos(spin + q * 3) * rad * 0.6, y + Math.sin(spin + q * 3) * rad * 0.6, TUM.pink, lv);
}

// ---------------------------------------------------------------- Pordan: stair treads that go up

const RIS = { rust: '#b5602f', gold: '#fdbe4e', gray: '#5d5463', dark: '#3a3040' };
/** Pordan's stair: n treads over `foot` climbing toward `dir`, each `step` wide and 2 higher, rust with gold noses. */
function stairs(x: number, foot: number, n: number, dir: number, lv = 1, step = 3): void {
  for (let i = 0; i < n; i++) {
    const sx = Math.round(dir > 0 ? x + i * step : x - (i + 1) * step + 1), top = Math.round(foot - (i + 1) * 2);
    dither(sx, top, step, foot - top + 1, RIS.rust, lv);
    line(sx, top, sx + step - 1, top, RIS.gold, lv);
    line(dir > 0 ? sx : sx + step - 1, top + 1, dir > 0 ? sx : sx + step - 1, foot, RIS.gray, lv);
  }
}
/** One tread flying: a rust block with a gold nose. */
const tread = (x: number, y: number, lv = 1): void => blit(['ggggg', 'rrrrr', 'rrrrd'], x, y, { g: RIS.gold, r: RIS.rust, d: RIS.dark }, lv);

// ---------------------------------------------------------------- Coshira: the spiral post down the middle of a shell

const COS = { cream: '#decfb7', blue: '#46a8e6', brown: '#937355', pale: '#f4ece0' };
/** Coshira's post: a cream column w wide and h high over `foot`, a brown spiral groove winding up it with `phase`, and a blue cap. */
function column(x: number, foot: number, h: number, w: number, phase: number, lv = 1): void {
  if (h < 1 || lv <= 0) return;
  x = Math.round(x); foot = Math.round(foot);
  const x0 = x - Math.floor(w / 2);
  dither(x0, foot - h + 1, w, h, COS.cream, lv);
  line(x0 - 1, foot - h + 1, x0 - 1, foot, COS.pale, lv);
  for (let j = 0; j < h; j++) { const k = ((j + Math.floor(phase)) % 4 + 4) % 4; if (k < w) px(x0 + k, foot - j, COS.brown, lv); }
  line(x0 - 1, foot - h, x0 + w, foot - h, COS.blue, lv);
}

// ---------------------------------------------------------------- Tegaote: a climbing hold, worn finger-shaped

const CRI = { pink: '#ff24ce', yellow: '#f6d733', purple: '#502f8c', light: '#ff9ae8' };
/** Tegaote's hold: a pink knob s wide with finger grooves on top, a purple underside, and a yellow bolt. */
function grip(x: number, y: number, s = 1, lv = 1): void {
  oval(x, y, 3 * s, 2 * s, CRI.pink, lv);
  arc(x, y + 0.5, 3 * s, 2 * s, CRI.purple, lv, 0.05, 0.45);
  for (let q = -1; q <= 1; q++) px(x + q * 2 * s, y - 2 * s, CRI.light, lv);
  px(x, y, CRI.yellow, lv);
}

// ---------------------------------------------------------------- Kamopra: a goat's hooked horns and the ledge it runs up

const CHM = { cream: '#decfb7', rose: '#bc7676', dark: '#3f3539', horn: '#6a5a50', rock: '#8a7a68' };
/** Kamopra's horns: two hooked horns curling back from x, y, facing `dir`, s their size. */
function horns(x: number, y: number, dir: number, s = 1, lv = 1): void {
  for (const k of [-1, 1]) {
    const bx = x + k * 2 * s;
    arc(bx - dir * 2 * s, y, 3 * s, 3 * s, CHM.horn, lv, dir > 0 ? 0.55 : 0.7, dir > 0 ? 0.8 : 0.95);
    arc(bx - dir * 2 * s, y + 1, 3 * s, 3 * s, CHM.dark, lv, dir > 0 ? 0.55 : 0.7, dir > 0 ? 0.8 : 0.95);
    px(bx + dir * s, y - 1, CHM.cream, lv);
  }
}
/** A cloven hoofprint. */
const hoof = (x: number, y: number, lv = 1): void => { px(x, y, CHM.cream, lv); px(x + 2, y, CHM.cream, lv); px(x, y + 1, CHM.rose, lv); px(x + 2, y + 1, CHM.rose, lv); };

// ---------------------------------------------------------------- Pasubame: a swift's sickle wings

const SWI = { dark: '#4d4353', cream: '#f6eeae', taupe: '#817162', edge: '#a89ab8' };
/** Pasubame in flight: two sickle wings swept back from a cream throat, `flap` closing them, facing `dir`. */
function sickle(x: number, y: number, dir: number, flap = 0, lv = 1, s = 1): void {
  for (const k of [-1, 1]) {
    const ex = x - dir * s, ey = y + k * 2 * s, tipx = x - dir * 5 * s, tipy = y + k * (6 - flap * 2) * s;
    line(x, y, ex, ey, SWI.edge, lv); line(ex, ey, tipx, tipy, SWI.edge, lv);
    line(x - dir, y, ex - dir, ey, SWI.dark, lv); line(ex - dir, ey, tipx - dir, tipy - k, SWI.dark, lv);
    px(tipx, tipy, W, lv);
  }
  px(x + dir, y, SWI.cream, lv); px(x, y, SWI.cream, lv); px(x + dir, y - 1, SWI.edge, lv);
}

// ---------------------------------------------------------------- Kukira: pushed air and the Pressure gauge

const TOR = { gray: '#b3aca2', cream: '#ffeaaa', green: '#416147', light: '#e8e4d8' };
/** Kukira's push: a ball of air pressed into tight rings, cream at the core. */
function pressed(x: number, y: number, rad: number, t: number, lv = 1): void {
  for (let q = 0; q < 2; q++) arc(x, y, rad - q * 1.5, (rad - q * 1.5) * 0.8, q ? TOR.cream : TOR.gray, lv, t * 0.05 + q * 0.3, t * 0.05 + q * 0.3 + 0.8);
  px(x, y, W, lv);
}
/** The Pressure gauge: a small round dial with its needle `k` of the way round (0 to 1), and ticks. */
function gauge(x: number, y: number, k: number, lv = 1): void {
  oval(x, y, 3, 3, TOR.green, lv);
  arc(x, y, 3, 3, TOR.light, lv);
  const g = Math.PI * (0.75 + 1.5 * k);
  line(x, y, x + Math.cos(g) * 2.5, y + Math.sin(g) * 2.5, TOR.cream, lv);
  px(x, y, W, lv);
}
/** Push lines: short streaks of air running away from `from` past x, y, a frames old. */
function pushLines(x: number, y: number, from: Pt, a: number, len = 12, lv = 1): void {
  const dx = x - from.x, dy = y - from.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  for (let q = 0; q < 4; q++) { const o = (q - 1.5) * 3, s = a * 1.2 + (q % 2) * 3, cx = x + ux * s - uy * o, cy = y + uy * s + ux * o; line(cx, cy, cx - ux * 4, cy - uy * 4, q % 2 ? TOR.cream : TOR.light, fade(a, len)); }
}

// ---------------------------------------------------------------- Otosus: a drop that keeps falling

const PLU = { lav: '#c1b9d1', purple: '#8757c4', dark: '#413657', deep: '#1a1428' };
/** Otosus's pit: a hole in the ground over `foot`, w each side, dark inside with purple walls and a lavender far rim. */
function pit(x: number, foot: number, w: number, lv = 1): void {
  if (w < 1 || lv <= 0) return;
  oval(x, foot, w, Math.max(1, w * 0.3), PLU.deep, lv);
  arc(x, foot, w, Math.max(1, w * 0.3), PLU.lav, lv, 0.5, 1);
  arc(x, foot + 1, w - 1, Math.max(1, w * 0.3) - 0.5, PLU.purple, lv, 0.5, 1);
}
/** Falling streaks: n short lines dropping past x, y, a frames old, the way things fall into the drop. */
function falling(x: number, y: number, a: number, n: number, seed: number, spread = 8, lv = 1): void {
  for (let q = 0; q < n; q++) { const fx = x + (hash(seed + q) - 0.5) * 2 * spread, fy = y - 8 + ((a * 2 + q * 5) % 16); line(fx, fy, fx, fy + 2, q % 2 ? PLU.lav : PLU.purple, lv); }
}

// ---------------------------------------------------------------- Huipki: the point the auger aims at, and its sights

const ZEN = { pale: '#e4ccbc', bronze: '#8e764f', purple: '#483866', star: '#fff4d8' };
/** Huipki's needle: a tapered spike `len` long from x, y pointing along ux, uy, a pale tip down a bronze body to a purple base. */
function needle(x: number, y: number, ux: number, uy: number, len = 6, lv = 1): void {
  for (let i = 0; i < len; i++) { const c = i === 0 ? W : i < 2 ? ZEN.pale : i < len - 1 ? ZEN.bronze : ZEN.purple; px(x - ux * i, y - uy * i, c, lv); if (i > len / 2) { px(x - ux * i - uy, y - uy * i + ux, ZEN.bronze, lv * 0.5); px(x - ux * i + uy, y - uy * i - ux, ZEN.bronze, lv * 0.5); } }
}
/** Huipki's sights: a ring of radius rad with four ticks pointing in. */
function sights(x: number, y: number, rad: number, lv = 1): void {
  arc(x, y, rad, rad, ZEN.pale, lv);
  for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(x + i * (rad + 2), y + j * (rad + 2), x + i * (rad - 1), y + j * (rad - 1), ZEN.bronze, lv);
}

// ---------------------------------------------------------------- Humiri: the auger's low note, a slow drone wave

const BOU = { brown: '#9c663e', lime: '#9cd32e', dark: '#3c3c4a', pale: '#d8f0a0', gold: '#f0c860' };
/** Humiri's drone: a slow sine wave from a to b, `amp` high, scrolling with t, lime on a brown shadow. */
function drone(a: Pt, b: Pt, t: number, amp: number, lv = 1, c = BOU.lime): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, n = Math.round(d);
  for (let i = 0; i <= n; i++) { const u = i / n, o = Math.sin(i * 0.35 - t * 0.3) * amp; px(a.x + dx * u + nx * o, a.y + dy * u + ny * o, c, lv); px(a.x + dx * u + nx * o, a.y + dy * u + ny * o + 1, BOU.brown, lv * 0.5); }
}
/** A whole note: an open lime oval with a pale shine. */
const note = (x: number, y: number, lv = 1, c = BOU.lime): void => { arc(x, y, 2, 1.5, c, lv); px(x - 1, y - 1, BOU.pale, lv); };

// ---------------------------------------------------------------- Reikuchi: a hole burned through, white light inside

const OST = { blue: '#000f97', white: '#eef6fd', gray: '#9098af', rim: '#3a4ad0', ember: '#f0a040' };
/** Reikuchi's hole: a disc of white light rad wide inside a deep blue rim, with gray burnt flecks round it. */
function hole(x: number, y: number, rad: number, t: number, lv = 1): void {
  if (rad < 1 || lv <= 0) return;
  oval(x, y, rad, rad, OST.white, lv);
  arc(x, y, rad, rad, OST.blue, lv); arc(x, y, rad + 1, rad + 1, OST.rim, lv);
  for (let q = 0; q < 4; q++) { const g = q / 4 * Math.PI * 2 + 0.4, d = rad + 2 + ((t >> 2) + q) % 2; px(x + Math.cos(g) * d, y + Math.sin(g) * d, q % 2 ? OST.gray : OST.ember, lv); }
}

// ---------------------------------------------------------------- Kairari: a drill bit, and the neat round holes it leaves

const GIM = { pale: '#ede5ed', violet: '#a958e6', dark: '#563674', deep: '#2a1a3a' };
/** Kairari's bit: a tapered drill `len` long from x, y pointing along ux, uy, its flutes scrolling with t. */
function bit(x: number, y: number, ux: number, uy: number, len: number, t: number, lv = 1): void {
  for (let i = 0; i < len; i++) {
    const w = Math.min(2, i * 0.4), cx = x - ux * i, cy = y - uy * i, c = ((i + (t >> 1)) % 3) === 0 ? GIM.violet : GIM.pale;
    px(cx, cy, i === 0 ? W : c, lv);
    if (w >= 1) { px(cx - uy * w, cy + ux * w, GIM.dark, lv); px(cx + uy * w, cy - ux * w, c, lv); }
  }
}
/** A neat round drill hole: a pale ring with a dark middle. */
const drillHole = (x: number, y: number, lv = 1): void => blit(['.pp.', 'pddp', 'pddp', '.pp.'], x, y, { p: GIM.pale, d: GIM.deep }, lv);

// ---------------------------------------------------------------- Vobasa: an albatross with long white wings, and its shadow

const ALB = { white: '#f5f5f5', blue: '#31acdc', yellow: '#ffeb35', gray: '#b8c8d8', shadow: '#141018' };
/** Vobasa's bird: long straight white wings drooping at the tips, a blue body, and a yellow beak facing `dir`. */
function bird(x: number, y: number, dir: number, flap = 0, lv = 1, s = 1): void {
  const half = Math.round(7 * s), sh = Math.round(2.5 * s), up = Math.round((flap ? 2 : 1) * Math.sqrt(s)), tip = flap ? -1 : Math.round(s), rows = Math.max(1, Math.round(s * 0.8));
  for (const k of [-1, 1]) {
    const shx = x + k * sh, shy = y - up, tx = x + k * half, ty = y + tip;
    for (let j = 0; j < rows; j++) { line(x + k, y + j, shx, shy + j, ALB.white, lv); line(shx, shy + j, tx - k * j, ty + j, ALB.white, lv); }
    line(x + k, y + rows, shx, shy + rows, ALB.gray, lv); line(shx, shy + rows, tx - k * rows, ty + rows, ALB.gray, lv);
    px(tx, ty, '#4a4a5a', lv); px(tx - k, ty, '#4a4a5a', lv);
  }
  oval(x, y, 1.5 * s, Math.max(1, s), ALB.white, lv); px(x - dir, y + 1, ALB.blue, lv); px(x + dir * (2 + Math.round(s)), y, ALB.yellow, lv);
}
/** The bird's shadow on the ground: a dark flat oval on the dither. */
const birdShadow = (x: number, foot: number, w: number, lv = 1): void => oval(x, foot, w, 1, ALB.shadow, 0.5 * lv);

// ---------------------------------------------------------------- Alkume: the first room of a nautilus, growing room by room

const PRO = { purple: '#62419e', pink: '#ee61c1', dark: '#352b50', light: '#f8b0e0' };
/** Alkume's chambers: n rooms of a spiral shell round x, y, each a little bigger, with pink septa between them. */
function chambers(x: number, y: number, n: number, scale = 1, lv = 1, turn = 0): void {
  for (let q = 0; q < n; q++) {
    const g0 = turn + q * 1.1, g1 = g0 + 1.1, r0 = (1.2 + q * 0.9) * scale, r1 = (1.2 + (q + 1) * 0.9) * scale;
    const steps = Math.max(4, Math.round(r1 * 1.2));
    for (let k = 0; k <= steps; k++) { const g = g0 + (g1 - g0) * k / steps, rr = r0 + (r1 - r0) * k / steps; px(x + Math.cos(g) * rr, y + Math.sin(g) * rr * 0.85, PRO.light, lv); if (rr > 2) px(x + Math.cos(g) * (rr - 1), y + Math.sin(g) * (rr - 1) * 0.85, PRO.purple, lv); }
    line(x + Math.cos(g1) * (r1 - 2), y + Math.sin(g1) * (r1 - 2) * 0.85, x + Math.cos(g1) * r1, y + Math.sin(g1) * r1 * 0.85, PRO.pink, lv);
  }
  px(x, y, W, lv);
}
/** Swell pips: k pink beads in a row over a foe. */
const pips = (x: number, y: number, k: number, lv = 1): void => { for (let q = 0; q < k; q++) blit(['lp', 'pp'], x - (k - 1) * 1.5 + q * 3, y, { l: PRO.light, p: PRO.pink }, lv); };

// ---------------------------------------------------------------- Small Gran: her lines, said in speech bubbles

const GRN = { pale: '#e8dcd0', white: '#f4eef8', lav: '#b890d0', ink: '#5a4a6a' };
const GLYPHS: Record<string, string[]> = { ask: ['.kk.', '...k', '..k.', '....', '..k.'], no: ['k..k', '.kk.', '.kk.', 'k..k', '....'], yes: ['.k..', '.k..', '.k..', '....', '.k..'], dots: ['....', '....', '....', '....', 'k.k.k'], go: ['..k.', '...k', 'kkkk', '...k', '..k.'] };
/** A speech bubble over Small Gran: a white box with a lavender edge and a tail, a line's mark in it. */
function speech(x: number, y: number, glyph: string, lv = 1): void {
  const g = GLYPHS[glyph] || GLYPHS.dots, w = g[0].length + 4;
  dither(Math.round(x - w / 2), Math.round(y - 4), w, 9, GRN.white, lv);
  arc(x, y, w / 2 + 0.5, 4.5, GRN.lav, lv);
  px(x - 1, y + 5, GRN.white, lv); px(x - 2, y + 6, GRN.lav, lv);
  blit(g, x, y, { k: GRN.ink }, lv);
}
/** Where Small Gran's bubble sits: above her when she is near, right of her when she is far, clear of the panels. */
const talkX = (U: Pt): number => (high(U) ? Math.min(88, U.x + 12) : U.x + 6);
const talkY = (U: Pt): number => (high(U) ? U.y - 3 : U.y - 13);

// ---------------------------------------------------------------- Konleva: a broad kelp blade with a golden midrib

const LAM = { olive: '#726230', gold: '#dea734', dark: '#49392f', light: '#c8b860' };
/** Konleva's blade: a broad kelp ribbon from x, foot reaching `len` up and leaning `bend` pixels at its tip, waving with t. */
function blade(x: number, foot: number, len: number, bend: number, t: number, lv = 1): void {
  for (let i = 0; i < len; i++) {
    const u = i / Math.max(1, len - 1), cx = x + bend * u * u + Math.sin(t * 0.25 + i * 0.6) * 0.8 * u, cy = foot - i;
    px(cx - 1, cy, i % 3 ? LAM.olive : LAM.light, lv); px(cx, cy, LAM.gold, lv); px(cx + 1, cy, LAM.olive, lv);
    if (i % 4 === 2) px(cx + 2, cy, LAM.dark, lv);
  }
}

// ---------------------------------------------------------------- Nikusa: a meadow of thin sea grass and its pink dream dust

const EEL = { tan: '#dec6ae', pink: '#d588b7', green: '#487736', light: '#7aa860', dust: '#f8c8e8' };
/** Nikusa's meadow: n thin blades of sea grass over `foot` across w each side, h high, swaying with t, laid down by `flat` (0 to 1). */
function meadow(x: number, foot: number, w: number, h: number, t: number, lv = 1, flat = 0, n = 7): void {
  for (let q = 0; q < n; q++) {
    const bx = x - w + (2 * w * q) / Math.max(1, n - 1), hh = h * (0.7 + 0.3 * ((q * 7) % 3) / 2), lean = Math.sin(t * 0.2 + q) * 1.5 + flat * hh * (q % 2 ? 1 : -1);
    const len = Math.max(1, Math.round(hh * (1 - flat * 0.7)));
    for (let i = 0; i < len; i++) { const u = i / len; px(bx + lean * u * u, foot - i, i === len - 1 ? EEL.tan : u > 0.5 ? EEL.light : EEL.green, lv); }
  }
}
/** Dream dust: n pink motes drifting and twinkling round x, y, a frames old. */
function dreamDust(x: number, y: number, a: number, n: number, seed: number, rad = 7, lv = 1): void {
  for (let q = 0; q < n; q++) { const g = hash(seed + q) * Math.PI * 2 + a * 0.05, d = rad * (0.4 + 0.6 * hash(seed + q * 3)), cx = x + Math.cos(g) * d, cy = y + Math.sin(g) * d * 0.6 - a * 0.15; if (((a >> 1) + q) % 4) px(cx, cy, q % 2 ? EEL.dust : EEL.pink, lv); else glint(cx, cy, EEL.pink, lv); }
}

// ---------------------------------------------------------------- Syvakai: two eyes that look up out of the deep

const GRE = { pale: '#e9e1f1', purple: '#704fbd', deep: '#3700ca', night: '#140a30' };
/** Syvakai's eyes: a pair of pale eyes with their purple pupils turned up, s apart. */
function upEyes(x: number, y: number, lv = 1, s = 3): void {
  for (const k of [-1, 1]) { const ex = x + k * s; oval(ex, y, 1.5, 1.5, GRE.pale, lv); px(ex, y - 1, GRE.purple, lv); px(ex, y - 1, GRE.deep, lv * 0.5); }
}
/** A long needle tooth pointing along ux, uy. */
function needleTooth(x: number, y: number, ux: number, uy: number, lv = 1): void {
  for (let i = 0; i < 6; i++) px(x - ux * i, y - uy * i, i === 0 ? W : i < 4 ? GRE.pale : GRE.purple, lv);
}

// ---------------------------------------------------------------- Tahtode: a starfish with five arms, fallen from the sky

const AST = { orange: '#cf6227', cream: '#f1c99a', brown: '#77391f', hot: '#ffe8c8' };
/** Tahtode's starfish: five tapered orange arms of `rad` turned by `spin`, cream dots on them, `arms` of them still on. */
function starfish(x: number, y: number, rad: number, spin: number, lv = 1, arms = 5): void {
  for (let q = 0; q < arms; q++) {
    const g = spin + q / 5 * Math.PI * 2 - Math.PI / 2, n = Math.max(2, Math.round(rad));
    for (let i = 0; i <= n; i++) { const u = i / n, cx = x + Math.cos(g) * rad * u, cy = y + Math.sin(g) * rad * u; px(cx, cy, i === n ? AST.cream : AST.orange, lv); if (u < 0.5 && rad >= 4) { px(cx + Math.sin(g), cy - Math.cos(g), AST.orange, lv); px(cx - Math.sin(g), cy + Math.cos(g), AST.brown, lv); } }
  }
  px(x, y, AST.cream, lv);
}
/** One arm thrown: a tapered orange spike with a cream tip and a dot. */
function arm(x: number, y: number, ux: number, uy: number, lv = 1): void {
  for (let i = 0; i < 5; i++) { px(x - ux * i, y - uy * i, i === 0 ? AST.cream : i < 3 ? AST.orange : AST.brown, lv); if (i > 1 && i < 4) px(x - ux * i - uy, y - uy * i + ux, AST.orange, lv); }
}

// ---------------------------------------------------------------- Lonshu: a nautilus arm that reaches and holds

const CIR = { sage: '#a7c7af', mint: '#a1feaa', dark: '#37473d', pale: '#d8f8e0' };
/** Lonshu's arm from a to b: a waving sage tentacle, two pixels at the base and one at the tip, mint suckers along it, its tip curled. */
function tentacle(a: Pt, b: Pt, t: number, lv = 1, wave = 2): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, n = Math.max(4, Math.round(d));
  for (let i = 0; i <= n; i++) {
    const u = i / n, o = Math.sin(u * 7 - t * 0.4) * wave * u * (1 - u) * 2, x = a.x + dx * u + nx * o, y = a.y + dy * u + ny * o;
    px(x, y, CIR.sage, lv);
    if (u < 0.6) px(x + nx, y + ny, CIR.dark, lv);
    if (i % 3 === 1) px(x - nx, y - ny, CIR.mint, lv);
  }
  arc(b.x + nx * 1.5, b.y + ny * 1.5, 1.5, 1.5, CIR.sage, lv, 0, 0.75);
}
/** Sucker marks: n small mint rings on a foe. */
const suckers = (x: number, y: number, n: number, lv = 1): void => { for (let q = 0; q < n; q++) arc(x - 3 + (q % 3) * 3, y - 2 + Math.floor(q / 3) * 3 + (q % 2), 1, 1, CIR.mint, lv); };

// ---------------------------------------------------------------- Puhalki: the jet a nautilus breathes out

const HYP = { blue: '#a3d3ea', white: '#effbfe', deep: '#4a78a7', shell: '#e8d8c0', band: '#b06a40' };
/** Puhalki's jet from a to b: a white core and light blue streams on either side that run with t, widening toward b. */
function jet(a: Pt, b: Pt, t: number, width = 2, lv = 1): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, n = Math.round(d);
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = a.x + dx * u, y = a.y + dy * u, w = 0.5 + width * u, run = ((i - t * 2) % 4 + 4) % 4;
    px(x, y, HYP.white, lv);
    if (run < 2) { px(x + nx * w, y + ny * w, HYP.blue, lv); px(x - nx * w, y - ny * w, HYP.blue, lv); }
    else if (w > 1.5) { px(x + nx * (w + 1), y + ny * (w + 1), HYP.deep, lv * 0.5); px(x - nx * (w + 1), y - ny * (w + 1), HYP.deep, lv * 0.5); }
  }
}
/** The Jet Shell: a coiled shell half under Puhalki, cream with rust bands, cracked when `crack` is set. */
function jetShell(x: number, y: number, lv = 1, crack = 0): void {
  arc(x, y, 7, 4, HYP.shell, lv, 0, 0.5); arc(x, y, 6, 3, HYP.band, lv, 0.05, 0.45); arc(x, y + 1, 4, 2, HYP.shell, lv, 0, 0.5);
  if (crack) { line(x - 1, y + 1, x + 1, y + 4, '#141018', lv); line(x + 2, y + 1, x + 4, y + 3, '#141018', lv); }
}

// ---------------------------------------------------------------- Tynagi: the still minute, a dial and dead-level water

const TYN = { gray: '#9dadbd', slate: '#41597a', pale: '#dfe5eb', cream: '#e8d8b0' };
/** Tynagi's dial: a pale ring of radius rad with four slate ticks and one hand at angle `ang`. */
function dial(x: number, y: number, rad: number, ang: number, lv = 1): void {
  arc(x, y, rad, rad * 0.9, TYN.pale, lv);
  for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2; px(x + Math.cos(g) * (rad - 1), y + Math.sin(g) * (rad - 1) * 0.9, TYN.slate, lv); }
  line(x, y, x + Math.cos(ang) * (rad - 1), y + Math.sin(ang) * (rad - 1) * 0.9, TYN.cream, lv);
  px(x, y, W, lv);
}
/** Dead-level water: a flat line from x0 to x1 with one glint that does not move. */
function stillLine(x0: number, x1: number, y: number, lv = 1): void { line(x0, y, x1, y, TYN.pale, lv); line(x0 + 1, y + 1, x1 - 1, y + 1, TYN.slate, lv); px((x0 + x1) / 2, y, W, lv); }

// ---------------------------------------------------------------- Soryubi: a finger of brine freezing its way down

const BRI = { ice: '#ddedfc', blue: '#72c2f0', navy: '#354573', white: '#ffffff' };
/** Soryubi's brinicle: an icicle hanging from `top` down `len` pixels at x, white in the middle, blue at its edges. */
function icicle(x: number, top: number, len: number, lv = 1, w = 2): void {
  for (let i = 0; i < len; i++) {
    const half = Math.max(0, Math.round(w * (1 - i / len))), y = top + i;
    if (half > 0) { px(x - half, y, BRI.blue, lv); px(x + half, y, BRI.navy, lv); if (half > 1) dither(x - half + 1, y, 2 * half - 1, 1, BRI.ice, lv); }
    px(x, y, i === len - 1 ? BRI.white : BRI.ice, lv);
  }
}
/** Frost along the ground: crystals spreading from x out to `reach` each side over `foot`. */
function frostLine(x: number, foot: number, reach: number, seed: number, lv = 1): void {
  for (let i = -reach; i <= reach; i += 2) { const h = 1 + Math.floor(hash(seed + i * 3) * 3); line(x + i, foot, x + i, foot - h, i % 4 ? BRI.blue : BRI.ice, lv); if (h > 2) px(x + i, foot - h, W, lv); }
  line(x - reach, foot + 1, x + reach, foot + 1, BRI.navy, lv);
}

// ---------------------------------------------------------------- Yliri: a star crossing the moon, shown twice

const YLI = { blue: '#4f97dd', pale: '#dff7fe', navy: '#2e4a88', star: '#fff8d0' };
/** Yliri's showing: a pale moon of radius rad with a navy shadow, and a star crossing its face at u (0 to 1). */
function transitAt(x: number, y: number, rad: number, u: number, lv = 1): void {
  oval(x, y, rad, rad, YLI.pale, lv);
  oval(x + rad * 0.45, y - rad * 0.2, rad * 0.55, rad * 0.7, YLI.navy, lv * 0.5);
  arc(x, y, rad, rad, YLI.blue, lv);
  if (u > 0 && u < 1) { const sx = x - rad - 2 + (2 * rad + 4) * u, sy = y + rad * 0.3 - rad * 0.6 * u; glint(sx, sy, YLI.star, lv); }
}

// ---------------------------------------------------------------- Paimori: a sack of sinking stones

const BAL = { teal: '#00d5c5', pink: '#e95cad', purple: '#460086', light: '#80f0e8' };
/** One of Paimori's sinkers: a teal stone with a pink band and a purple underside. */
const sinker = (x: number, y: number, lv = 1, s = 1): void => blit(['.lll.', 'ltttl', 'ppppp', 'ttttt', '.ddd.'], x, y, { l: BAL.light, t: BAL.teal, p: BAL.pink, d: BAL.purple }, lv, s);
/** Paimori's sack: a purple bag tied with a pink cord, teal stones showing at its neck, swollen by `full`. */
function sack(x: number, y: number, lv = 1, full = 0): void {
  const w = 4 + Math.round(full * 2);
  oval(x, y + 2, w, 4 + full, BAL.purple, lv);
  arc(x, y + 2, w, 4 + full, '#7a30b8', lv, 0.6, 0.9);
  line(x - 2, y - 2, x + 2, y - 2, BAL.pink, lv);
  px(x - 1, y - 3, BAL.teal, lv); px(x + 1, y - 3, BAL.light, lv);
}

// ---------------------------------------------------------------- Monti: a sluice gate that lets one side through

const SLU = { blue: '#5b80bf', pale: '#ddedfc', purple: '#483866', water: '#7ab0e8' };
/** Monti's gate over `foot`, h high: two posts, a planked panel raised by `open` (0 to 1), and water running under it when open. */
function gate(x: number, foot: number, h: number, open: number, t: number, lv = 1): void {
  x = Math.round(x); foot = Math.round(foot);
  line(x - 4, foot, x - 4, foot - h, SLU.purple, lv); line(x + 4, foot, x + 4, foot - h, SLU.purple, lv);
  line(x - 4, foot - h, x + 4, foot - h, SLU.pale, lv);
  const lift = Math.round(open * (h - 3)), ph = h - 3;
  for (let j = 0; j < ph; j++) { const y = foot - 1 - lift - j; if (y <= foot - h) break; line(x - 3, y, x + 3, y, j % 3 === 0 ? SLU.pale : SLU.blue, lv); }
  if (lift > 0) for (let q = 0; q < 3; q++) { const k = ((t >> 1) + q * 2) % 6; line(x - 3 + k, foot - 1 - (q % lift), x - 2 + k, foot - 1 - (q % lift), SLU.water, lv); }
}

// ---------------------------------------------------------------- Mukabe: a curved wall inside the shell

const SEP = { slate: '#6d839a', pale: '#c4ecfb', dark: '#384256', nacre: '#e8f4ff' };
/** Mukabe's wall: a curved partition h high over `foot`, bowed `bow` pixels toward `dir`, slate with a pale nacre edge. */
function septWall(x: number, foot: number, h: number, dir: number, lv = 1, bow = 2): void {
  if (h < 1) return;
  for (let j = 0; j < h; j++) {
    const u = j / Math.max(1, h - 1), cx = Math.round(x + dir * bow * Math.sin(Math.PI * u)), y = Math.round(foot - j);
    px(cx - dir, y, SEP.dark, lv); px(cx, y, SEP.slate, lv); px(cx + dir, y, SEP.pale, lv);
    if (j % 4 === 1) px(cx + dir * 2, y, SEP.nacre, lv);
  }
}

// ---------------------------------------------------------------- Hafusen: a sealed bubble of old air with gold dust in it

const VAC = { white: '#f1f1f9', gold: '#f2c453', brown: '#aa7332' };
/** Hafusen's bubble: a white ring of radius rad with a gold shine, old gold dust turning slowly inside it. */
function oldAir(x: number, y: number, rad: number, t: number, lv = 1): void {
  arc(x, y, rad, rad, VAC.white, lv);
  arc(x, y, rad - 1, rad - 1, VAC.gold, lv, 0.6, 0.75);
  for (let q = 0; q < Math.min(6, Math.round(rad)); q++) { const g = q * 2.4 + t * 0.04, d = (rad - 1.5) * (0.3 + 0.7 * ((q * 37) % 10) / 10); px(x + Math.cos(g) * d, y + Math.sin(g) * d, q % 2 ? VAC.gold : VAC.brown, lv); }
}
/** A kept moment: four gold corner brackets round a whorl, `rad` out from it. */
function keptFrame(x: number, y: number, rad: number, lv = 1): void {
  for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = x + i * rad, cy = y + j * rad; line(cx, cy, cx - i * 3, cy, VAC.gold, lv); line(cx, cy, cx, cy - j * 3, VAC.gold, lv); }
}

// ---------------------------------------------------------------- Kuorisho: rings of salt a dried room left

const EVA = { white: '#efefe9', gold: '#d19a21', gray: '#7f7f87' };
/** Kuorisho's rings: n flat rings of dried salt round x over `foot`, out to `rad`, white, gold, and gray by turns. */
function saltRings(x: number, foot: number, n: number, rad: number, lv = 1): void {
  for (let q = 0; q < n; q++) { const rr = rad * (q + 1) / n; arc(x, foot, rr, rr * 0.3, [EVA.white, EVA.gold, EVA.gray][q % 3], lv); }
}

// ---------------------------------------------------------------- Hupfuta: the hood a nautilus shuts its door with

const HOO = { brown: '#977060', red: '#fc4747', cream: '#efe3cf', dark: '#5a4038' };
/** Hupfuta's door: a round-topped hood w wide and h high, brown striped with cream and a red knob, swung `open` (0 shut to 1 open) on its hinge. */
function hoodDoor(x: number, y: number, w: number, h: number, open: number, lv = 1): void {
  const ww = Math.max(1, Math.round(w * (1 - open * 0.8))), x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  for (let j = 0; j < h; j++) {
    const inset = j < 2 ? 2 - j : 0, rw = Math.max(1, ww - inset * 2);
    dither(x0 + inset, y0 + j, rw, 1, j % 3 === 1 ? HOO.cream : HOO.brown, lv);
    px(x0 + inset - 1, y0 + j, HOO.dark, lv); px(x0 + inset + rw, y0 + j, HOO.dark, lv);
  }
  px(x0 + ww - 2, y0 + Math.round(h * 0.55), HOO.red, lv);
}

// ---------------------------------------------------------------- Ashiaki: a giant footprint that falling stars land in

const SPO = { dark: '#4a4458', gold: '#facb39', brown: '#926b4b', rim: '#7a6a88' };
/** Ashiaki's print: a sole pressed flat into the ground over `foot`, s its size, toes toward `dir`, dark inside with a brown rim. */
function footprint(x: number, foot: number, s: number, dir: number, lv = 1): void {
  oval(x, foot, 4 * s, 1.5 * s, SPO.dark, lv);
  arc(x, foot, 4 * s, 1.5 * s, SPO.brown, lv);
  arc(x, foot, 4 * s - 1, 1.5 * s - 0.5, SPO.rim, lv, 0.55, 0.95);
  for (let q = 0; q < 4; q++) { const tx = x + dir * (4 * s + 1.5 + q * 0.2) , ty = foot - 1.2 * s + q * 0.8 * s; oval(tx, ty, Math.max(1, 0.8 * s), Math.max(0.6, 0.5 * s), SPO.dark, lv); px(tx, ty - 0.5 * s, SPO.brown, lv); }
}
/** A star falling into a print: a gold glint with a short trail above it, a frames into its fall of `len`. */
function starFall(x: number, y: number, a: number, len = 10, lv = 1): void {
  if (a < 0 || a >= len) return;
  const yy = y - (len - a) * 2;
  glint(x, yy, SPO.gold, lv); px(x, yy - 2, SPO.gold, lv * 0.75); px(x, yy - 4, SPO.gold, lv * 0.5);
}

// ---------------------------------------------------------------- Tulisei: a star that came down and kept burning

const BOL = { pale: '#feefaf', red: '#d74b0e', orange: '#f3a51d', smoke: '#5a4a48' };
/** Tulisei's burn: a meteor at x, y heading along ux, uy, a white head and a flame tail `len` long in pale, orange, and red bands. */
function meteor(x: number, y: number, ux: number, uy: number, len: number, t: number, lv = 1): void {
  for (let i = len; i >= 0; i--) {
    const u = i / Math.max(1, len), cx = x - ux * i, cy = y - uy * i, c = i === 0 ? W : u < 0.3 ? BOL.pale : u < 0.65 ? BOL.orange : BOL.red, w = Math.max(0, Math.round((1 - u) * 1.5));
    px(cx, cy, c, u < 0.85 ? lv : lv * 0.5);
    if (w > 0) { px(cx - uy * w, cy + ux * w, u < 0.4 ? BOL.orange : BOL.red, lv); px(cx + uy * w, cy - ux * w, (t + i) & 1 ? BOL.orange : BOL.red, lv); }
  }
}
/** Heat: k small flames in a row over a whorl. */
function heatPips(x: number, y: number, k: number, t: number, lv = 1): void {
  for (let q = 0; q < k; q++) { const fx = x - (k - 1) * 2 + q * 4, h = 2 + ((t >> 2) + q) % 2; line(fx, y, fx, y - h, BOL.orange, lv); px(fx, y - h, BOL.pale, lv); px(fx, y + 1, BOL.red, lv); }
}

// ---------------------------------------------------------------- Heinaba: stiff dune grass on a sand hump, and its runner roots

const MAR = { sand: '#d3c39b', dark: '#347433', green: '#8dab54', root: '#a08a60' };
/** Heinaba's tussock: a hump of sand over `foot` with a stiff fan of five blades h high. */
function tussock(x: number, foot: number, h: number, lv = 1): void {
  if (h < 1) return;
  oval(x, foot, 3, 1.2, MAR.sand, lv);
  for (let q = -2; q <= 2; q++) line(x + q * 0.5, foot - 1, x + q * 2, foot - h + Math.abs(q), q % 2 ? MAR.dark : MAR.green, lv);
}
/** A runner: a root running under the ground from x0 to x1 at y, a node every few pixels. */
function runner(x0: number, x1: number, y: number, lv = 1): void {
  line(x0, y, x1, y, MAR.root, lv);
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 5) { px(x, y - 1, MAR.green, lv); px(x, y + 1, MAR.root, lv); }
}

// ---------------------------------------------------------------- Ruojiki: a salt plant whose spit piles up as crust

const SWO = { green: '#73a253', white: '#f2f2ee', red: '#9b373a', gray: '#b8b8b0' };
/** Crust: k lumps of salt piled on a whorl over `foot`, white with gray undersides, climbing as k grows. */
function crustPile(x: number, foot: number, k: number, lv = 1): void {
  for (let q = 0; q < k; q++) { const cx = x - 5 + (q % 3) * 5 + (Math.floor(q / 3) % 2) * 2, cy = foot - 1 - Math.floor(q / 3) * 3; blit(['.www.', 'wwwww', 'wwwwg', '.ggg.'], cx, cy, { w: SWO.white, g: SWO.gray }, lv); }
}
/** Ruojiki's stem: a jointed succulent stalk h high, green with red joints. */
function saltStem(x: number, foot: number, h: number, bend: number, lv = 1): void {
  for (let i = 0; i < h; i++) { const u = i / Math.max(1, h - 1); px(x + bend * u * u, foot - i, i % 3 === 2 ? SWO.red : SWO.green, lv); }
}

// ---------------------------------------------------------------- Shidor: the white glare off a salt flat at night

const ALBD = { mauve: '#cfbfc7', violet: '#b869e6', dark: '#382e42' };
/** Shidor's glare: a long flat streak of white light `len` wide with a short upright spike and violet points at its ends. */
function glare(x: number, y: number, len: number, lv = 1): void {
  line(x - len, y, x + len, y, ALBD.mauve, lv);
  line(x - len * 0.5, y, x + len * 0.5, y, W, lv);
  line(x, y - 2, x, y + 2, W, lv);
  px(x - len - 1, y, ALBD.violet, lv); px(x + len + 1, y, ALBD.violet, lv);
}
/** A Shine: a small violet diamond with a white middle. */
const shine = (x: number, y: number, lv = 1): void => blit(['.v.', 'vwv', '.v.'], x, y, { v: ALBD.violet, w: W }, lv);

// ---------------------------------------------------------------- Ikapia: a cuttlebone and the colors that run over it

const CUT = { white: '#ffffff', gold: '#b18e0c', green: '#136a29', ink: '#1a2a20', pale: '#e8e0c8' };
const CHROMA = [CUT.gold, CUT.green, CUT.pale];
/** Ikapia's bone: a long oval of white cuttlebone w each side with gold growth lines. */
function cuttlebone(x: number, y: number, w: number, lv = 1): void {
  oval(x, y, w, w * 0.4, CUT.white, lv);
  for (let q = -w + 2; q < w - 1; q += 2) px(x + q, y, CUT.gold, lv);
  arc(x, y, w, w * 0.4, CUT.pale, lv, 0, 0.5);
}
/** Color running over an oval: bands of gold, green, and pale that travel across it with t. */
function chroma(x: number, y: number, rx: number, ry: number, t: number, lv = 1): void {
  for (let i = -rx; i <= rx; i++) { const h = Math.round(ry * Math.sqrt(Math.max(0, 1 - (i * i) / (rx * rx)))); if (h < 1) continue; dither(x + i, y - h, 1, 2 * h, CHROMA[(((i + Math.floor(t / 2)) % 6) + 6) % 6 >> 1], lv); }
}

// ---------------------------------------------------------------- Kutelo: a jelly's pulsing bell and its ripples

const MED = { purple: '#6f64c3', blue: '#78c8f7', pale: '#e2e2f3' };
/** Kutelo's bell: a dome of radius rad, squeezed by `pulse` (0 to 1), pale and blue with a purple hem and four trailing tentacles. */
function jelly(x: number, y: number, rad: number, pulse: number, t: number, lv = 1): void {
  const rx = rad * (1 - 0.2 * pulse), ry = rad * 0.8 * (1 + 0.2 * pulse);
  for (let j = 0; j <= Math.round(ry); j++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry)))); dither(Math.round(x - w), Math.round(y - j), 2 * w + 1, 1, j > ry * 0.5 ? MED.pale : MED.blue, lv * 0.75); }
  arc(x, y, rx, ry, MED.pale, lv, 0.5, 1);
  line(x - rx, y, x + rx, y, MED.purple, lv);
  for (let q = 0; q < 4; q++) { const tx = x - rx * 0.7 + q * rx * 0.47; for (let k = 1; k < rad; k++) px(tx + Math.sin((t + k + q * 3) * 0.4), y + k, q % 2 ? MED.purple : MED.blue, k < rad - 2 ? lv : lv * 0.5); }
}

// ---------------------------------------------------------------- Pakui: a white corner post that stands where it is put

const BOLL = { white: '#f9f9f1', mint: '#7ded9d', dark: '#444a42', gray: '#b8b8b0' };
/** Pakui's post: a thick white post h high over `foot` with a round cap, a mint band, and a shaded side. */
function post(x: number, foot: number, h: number, lv = 1): void {
  if (h < 2) return;
  x = Math.round(x); foot = Math.round(foot);
  dither(x - 1, foot - h + 2, 3, h - 2, BOLL.white, lv);
  line(x + 2, foot - h + 2, x + 2, foot, BOLL.gray, lv);
  line(x - 1, foot - h + 1, x + 1, foot - h + 1, BOLL.white, lv); px(x, foot - h, BOLL.white, lv);
  if (h > 4) line(x - 1, foot - h + 3, x + 2, foot - h + 3, BOLL.mint, lv);
  line(x - 2, foot + 1, x + 3, foot + 1, BOLL.dark, lv);
}

// ---------------------------------------------------------------- Tifuda: a paper ticket on a string

const DOC = { white: '#fff7ee', cyan: '#5ee6fd', dark: '#3c3c4a' };
/** Tifuda's ticket: a white tag with a notched corner, a dark hole, and a cyan line of writing, turned with `flip`. */
const ticket = (x: number, y: number, lv = 1, flip = false): void => blit(['.wwwww', 'wkwwww', 'wwcccw', 'wwwwww'], x, y, { w: DOC.white, k: DOC.dark, c: DOC.cyan }, lv, 1, flip);
/** A ticket hung on a foe: a string from its top and the tag swinging under it, with `n` cyan ticks. */
function tagged(x: number, y: number, a: number, n: number, lv = 1): void {
  const sw = Math.round(Math.sin(a / 4) * 1.5);
  line(x, y, x + sw, y + 3, DOC.white, lv);
  ticket(x + sw + 3, y + 5, lv);
  for (let q = 0; q < n; q++) px(x + sw + 1 + q * 2, y + 9, DOC.cyan, lv);
}

// ---------------------------------------------------------------- Tyhaki: an empty square slot

const VACY = { cream: '#f9f1e0', lime: '#b5dc4a', taupe: '#b0998a', deep: '#1a1820' };
/** Tyhaki's slot: an empty square s each side, a cream frame with lime corners and a dark inside. */
function slot(x: number, y: number, s: number, lv = 1, fill = 0.5): void {
  if (s < 1) return;
  const x0 = Math.round(x - s), y0 = Math.round(y - s), w = Math.round(2 * s);
  if (fill > 0) dither(x0 + 1, y0 + 1, w - 1, w - 1, VACY.deep, fill * lv);
  line(x0, y0, x0 + w, y0, VACY.cream, lv); line(x0, y0 + w, x0 + w, y0 + w, VACY.cream, lv); line(x0, y0, x0, y0 + w, VACY.cream, lv); line(x0 + w, y0, x0 + w, y0 + w, VACY.cream, lv);
  for (const [i, j] of [[0, 0], [w, 0], [0, w], [w, w]]) px(x0 + i, y0 + j, VACY.lime, lv);
}

// ---------------------------------------------------------------- Hyrkoma: a top shell that spins

const TRO = { tan: '#ccb48c', pale: '#d6deee', blue: '#2e4d9a' };
/** Hyrkoma's top: a cone s wide at its rim narrowing to a point below, its blue stripes running round as it spins with t. */
function top(x: number, y: number, s: number, t: number, lv = 1): void {
  const h = Math.round(s * 1.6);
  for (let j = 0; j <= h; j++) {
    const w = Math.max(0, Math.round(s * (1 - j / h))), yy = Math.round(y - s * 0.4 + j);
    if (w > 0) dither(Math.round(x - w), yy, 2 * w + 1, 1, TRO.tan, lv);
    if (w > 1) px(x - w + ((j * 2 + Math.floor(t)) % (2 * w + 1)), yy, TRO.blue, lv);
    else px(x, yy, TRO.blue, lv);
  }
  line(x - s, y - s * 0.4, x + s, y - s * 0.4, TRO.pale, lv);
}

// ---------------------------------------------------------------- Kidedan: a hopper crystal stepped inward

const HOP = { white: '#e5e5dd', taupe: '#b1a292', dark: '#424050' };
/** Kidedan's crystal: n diamonds nested inward round x, y out to rad, white and taupe by turns, with a dark core. */
function hopperAt(x: number, y: number, rad: number, n: number, lv = 1): void {
  for (let q = 0; q < n; q++) {
    const rr = Math.round(rad * (n - q) / n), c = q % 2 ? HOP.taupe : HOP.white;
    if (rr < 1) continue;
    line(x - rr, y, x, y - rr, c, lv); line(x, y - rr, x + rr, y, c, lv); line(x + rr, y, x, y + rr, c, lv); line(x, y + rr, x - rr, y, c, lv);
  }
  px(x, y, HOP.dark, lv);
}

// ---------------------------------------------------------------- Sivuko: a salt-crusted crab claw

const CRB = { rust: '#bb653e', salt: '#efefe9', dark: '#8b3e1d' };
/** Sivuko's pincer: a claw at x, y facing `dir`, its two jaws parted by `open` (0 to 1), crusted with salt. */
function pincer(x: number, y: number, dir: number, open: number, lv = 1): void {
  oval(x - dir * 2, y, 2.5, 2, CRB.rust, lv);
  const g = 1 + open * 3;
  line(x, y - 1, x + dir * 4, y - g, CRB.rust, lv); line(x + dir * 4, y - g, x + dir * 5, y - g + 1, CRB.dark, lv);
  line(x, y + 1, x + dir * 4, y + g, CRB.rust, lv); line(x + dir * 4, y + g, x + dir * 5, y + g - 1, CRB.dark, lv);
  px(x - dir * 2, y - 1, CRB.salt, lv); px(x - dir, y + 1, CRB.salt, lv); px(x + dir * 2, y - g * 0.5 - 1, CRB.salt, lv);
}
/** Sideways cuts: k short horizontal slashes across x, y, drawn in by n (0 to 1). */
function sideCuts(x: number, y: number, k: number, n: number, dir: number, lv = 1): void {
  for (let q = 0; q < k; q++) { const yy = y - (k - 1) * 1.5 + q * 3, x0 = x - dir * 6; line(x0, yy, x0 + dir * 12 * n, yy, q % 2 ? CRB.salt : W, lv); }
}

// ---------------------------------------------------------------- Picagi: a magpie and the bright things it keeps

const MAG = { dark: '#393544', gold: '#e6b733', white: '#eeeeee', blue: '#5a70b0' };
const TRINKETS = [['.gg.', 'g..g', 'g..g', '.gg.'], ['.gg.', 'gwgg', 'gggg', '.gg.'], ['gg..', 'gwggg', 'gg.g.']];
/** One of Picagi's trinkets: a gold ring, a coin, or a key, with a white shine. */
const trinket = (x: number, y: number, k: number, lv = 1): void => blit(TRINKETS[((k % 3) + 3) % 3].map(r => r.padEnd(5, '.')), x, y, { g: MAG.gold, w: W }, lv);
/** Picagi in flight: a dark body with a white belly and wing bars, a long tail, and its wings up or down with `flap`, facing `dir`. */
function magpieBird(x: number, y: number, dir: number, flap: number, lv = 1): void {
  oval(x, y, 2.5, 1.5, MAG.dark, lv); px(x, y + 1, MAG.white, lv); px(x + dir, y + 1, MAG.white, lv);
  line(x - dir * 2, y, x - dir * 7, y + 2, MAG.dark, lv); px(x - dir * 7, y + 2, MAG.blue, lv);
  const wy = flap ? -4 : 3;
  line(x, y - 1, x - dir, y + wy, MAG.dark, lv); line(x + 1, y - 1, x + 1 - dir, y + wy, MAG.white, lv);
  px(x + dir * 3, y - 1, MAG.dark, lv); px(x + dir * 4, y - 1, MAG.white, lv * 0.5);
}

// ---------------------------------------------------------------- Kakulo: the Mudlark's hiding hole and the finds in it

const CAC = { pale: '#efe7f7', green: '#63e376', purple: '#423361', sand: '#c8b088', deep: '#1a1428' };
/** Kakulo's hole: a dug hole over `foot` w each side, dark inside, a mound of dug sand on one side, and green glints of finds in it. */
function cacheHole(x: number, foot: number, w: number, t: number, lv = 1): void {
  if (w < 1 || lv <= 0) return;
  oval(x, foot, w, Math.max(1, w * 0.35), CAC.deep, lv);
  arc(x, foot, w, Math.max(1, w * 0.35), CAC.purple, lv, 0.5, 1);
  arc(x, foot + 1, w + 1, Math.max(1, w * 0.35) + 0.5, CAC.sand, lv, 0, 0.5);
  oval(x + w + 3, foot - 1, 3, 2, CAC.sand, lv); px(x + w + 2, foot - 3, CAC.pale, lv); px(x + w + 4, foot - 2, CAC.pale, lv);
  for (let q = 0; q < 2; q++) if (((t >> 2) + q) & 1) glint(x - w * 0.4 + q * w * 0.7, foot, CAC.green, lv);
}
/** Sand on a foe: k grains piled in a small heap. */
function sandPips(x: number, y: number, k: number, lv = 1): void { for (let q = 0; q < k; q++) blit(['ss', 'sp'], x - k + q * 2, y - (q % 2), { s: CAC.sand, p: CAC.pale }, lv); }

// ---------------------------------------------------------------- Masilma: an eye on a stalk that never blinks

const STR = { violet: '#747ab8', crimson: '#ad0248', pink: '#de9f97', white: '#f8f0f0' };
/** Masilma's eye on its stalk: a pink stalk curving from `base` up to `tip`, a white eye there with a crimson ring and its pupil turned toward `look`. */
function eyestalk(base: Pt, tip: Pt, look: Pt, lv = 1, big = 1): void {
  const n = Math.max(4, Math.round(Math.hypot(tip.x - base.x, tip.y - base.y)));
  for (let i = 0; i <= n; i++) { const u = i / n, p = { x: base.x + (tip.x - base.x) * u + Math.sin(Math.PI * u) * 2, y: base.y + (tip.y - base.y) * u }; px(p.x, p.y, i % 3 ? STR.pink : STR.violet, lv); }
  const dx = look.x - tip.x, dy = look.y - tip.y, d = Math.hypot(dx, dy) || 1;
  oval(tip.x, tip.y, 2 * big, 1.6 * big, STR.white, lv);
  arc(tip.x, tip.y, 2 * big, 1.6 * big, STR.violet, lv);
  const ix = tip.x + dx / d * big, iy = tip.y + dy / d * big * 0.6;
  px(ix, iy, STR.crimson, lv); px(ix + 1, iy, STR.crimson, lv * (big > 1 ? 1 : 0)); px(ix + dx / d * 0.6, iy + dy / d * 0.4, '#141018', lv);
}

// ---------------------------------------------------------------- Sirdori: a shore bird's tracks along the edge of a wave

const SAN = { gray: '#c0c4cc', green: '#19be50', white: '#ebebeb', foam: '#f4fbff', sea: '#4a88c8' };
/** A three-toed track pointing toward `dir`. */
const birdTrack = (x: number, y: number, dir: number, lv = 1): void => { px(x, y, SAN.gray, lv); px(x + dir, y - 1, SAN.gray, lv); px(x + dir, y + 1, SAN.gray, lv); px(x - dir, y, SAN.gray, lv * 0.75); };
/** The edge of a wave: a wavy foam line from x0 to x1 over sea, rolling with t. */
function foamEdge(x0: number, x1: number, y: number, t: number, lv = 1): void {
  for (let x = Math.round(Math.min(x0, x1)); x <= Math.max(x0, x1); x++) { const o = Math.round(Math.sin((x + t * 0.8) / 3)); px(x, y + o, SAN.foam, lv); px(x, y + o + 1, SAN.sea, lv * 0.75); }
}

// ---------------------------------------------------------------- Manva: high water that comes in and stays

const FLO = { blue: '#468cc2', foam: '#eef6fd', gold: '#d7a02b', deep: '#2a5a90' };
/** Manva's flood: water standing h deep over `foot`, w each side, a rippling foam top, and a gold high-water mark above it. */
function floodAt(x: number, foot: number, w: number, h: number, t: number, lv = 1, fill = 0.75): void {
  if (h < 1 || lv <= 0) return;
  x = Math.round(x); foot = Math.round(foot);
  dither(x - w, foot - h + 1, 2 * w + 1, h, FLO.blue, fill * lv);
  dither(x - w, foot - Math.floor(h / 2) + 1, 2 * w + 1, Math.ceil(h / 2), FLO.deep, fill * lv * 0.5);
  for (let dx = -w; dx <= w; dx++) px(x + dx, foot - h + (((dx + (t >> 2)) & 3) === 0 ? 1 : 0), FLO.foam, lv);
  line(x - w, foot - h - 2, x - w + 3, foot - h - 2, FLO.gold, lv); line(x + w - 3, foot - h - 2, x + w, foot - h - 2, FLO.gold, lv);
}

// ---------------------------------------------------------------- Kohisai: the sea sound out of a conch, going backward

const SUR = { light: '#96c6dd', white: '#eef6fd', blue: '#305eb9' };
/** Sea sound: n arcs of sound round x, y facing `dir`, white and light blue by turns, each with a foam curl at its top. */
function seaArcs(x: number, y: number, dir: number, n: number, lv = 1, gap = 3): void {
  for (let q = 0; q < n; q++) {
    const rr = 2 + q * gap, c = q % 2 ? SUR.light : SUR.white;
    arc(x, y, rr, rr * 1.1, c, lv, dir > 0 ? -0.15 : 0.35, dir > 0 ? 0.15 : 0.65);
    const g = (dir > 0 ? -0.15 : 0.65) * Math.PI * 2; px(x + Math.cos(g) * rr + dir, y + Math.sin(g) * rr * 1.1, SUR.white, lv);
  }
}
/** A reversal: an arrow up that turns into an arrow down as `u` goes from 0 to 1. */
function flipArrow(x: number, y: number, u: number, lv = 1): void {
  const up = u < 0.5, c = up ? SUR.white : SUR.blue;
  line(x, y - 2, x, y + 2, c, lv);
  if (up) { px(x - 1, y - 1, c, lv); px(x + 1, y - 1, c, lv); } else { px(x - 1, y + 1, c, lv); px(x + 1, y + 1, c, lv); }
}

// ---------------------------------------------------------------- Kukhana: a flower of salt and the dry cracks it leaves

const FLE = { white: '#efefe9', pink: '#db94a4', gray: '#8c857d' };
/** Kukhana's flower: five white salt petals opened by `open` round a pink heart, rad across. */
function saltFlower(x: number, y: number, rad: number, open: number, lv = 1, turn = 0): void {
  for (let q = 0; q < 5; q++) { const g = turn + q / 5 * Math.PI * 2 - Math.PI / 2, d = rad * (0.4 + 0.6 * open), px0 = x + Math.cos(g) * d, py0 = y + Math.sin(g) * d * 0.85; line(x + Math.cos(g) * 1.5, y + Math.sin(g) * 1.3, px0, py0, FLE.white, lv); px(px0, py0, W, lv); px(px0 + Math.cos(g + 1.6), py0 + Math.sin(g + 1.6), FLE.gray, lv); }
  oval(x, y, 1, 1, FLE.pink, lv);
}
/** Dry cracks: a crazing of short gray and white lines over x, y, more of them as k grows. */
function dryCracks(x: number, y: number, k: number, seed: number, lv = 1): void {
  for (let q = 0; q < k * 3; q++) { const g = hash(seed + q) * Math.PI * 2, d = 1 + hash(seed + q * 3) * 5, cx = x + Math.cos(g) * d, cy = y + Math.sin(g) * d * 0.8, h = g + 1.2; line(cx, cy, cx + Math.cos(h) * 2, cy + Math.sin(h) * 2, q % 2 ? FLE.gray : FLE.white, lv); }
}

// ---------------------------------------------------------------- Kosango: a coral hand

const MAD = { pale: '#f7e7df', gold: '#dbbb52', coral: '#d46f78', dark: '#9a4048' };
/** Kosango's hand: a coral palm with four fingers spread by `open` (0 a fist, 1 a flat hand) pointing up, pale polyps along them. */
function coralHand(x: number, y: number, s: number, open: number, lv = 1): void {
  oval(x, y, 2.5 * s, 2 * s, MAD.coral, lv);
  arc(x, y, 2.5 * s, 2 * s, MAD.dark, lv, 0.05, 0.45);
  for (let q = 0; q < 4; q++) {
    const g = -Math.PI / 2 + (q - 1.5) * 0.35 * (0.3 + open), len = (2 + open * 3) * s, fx = x + (q - 1.5) * s, fy = y - 1.5 * s;
    line(fx, fy, fx + Math.cos(g) * len, fy + Math.sin(g) * len, MAD.coral, lv); px(fx + Math.cos(g) * len, fy + Math.sin(g) * len, MAD.pale, lv);
  }
  line(x + 2.5 * s, y, x + 2.5 * s + 2 * open * s, y - 1.5 * s, MAD.coral, lv);
  px(x - s, y, MAD.pale, lv); px(x + s, y + 1, MAD.pale, lv);
}

// ---------------------------------------------------------------- Shinmi: a pink pearl that rolls toward voices

const BLU = { pink: '#e8a0b0', white: '#fff6f9', rose: '#904a5b' };
/** Shinmi's pearl: a pink pearl of radius rad with a white sheen that turns round it as it rolls with t, darker underneath. */
function pearlAt(x: number, y: number, rad: number, t: number, lv = 1): void {
  oval(x, y, rad, rad, BLU.pink, lv);
  arc(x, y, rad, rad, BLU.rose, lv, 0.05, 0.45);
  const g = t * 0.3;
  px(x + Math.cos(g) * rad * 0.5, y - Math.abs(Math.sin(g)) * rad * 0.5 - 0.5, BLU.white, lv);
  if (rad >= 2) px(x + Math.cos(g) * rad * 0.5 + 1, y - Math.abs(Math.sin(g)) * rad * 0.5 - 0.5, W, lv);
}
/** A voice calling: two small arcs facing `dir`. */
const voice = (x: number, y: number, dir: number, lv = 1): void => { arc(x, y, 2, 2, BLU.white, lv, dir > 0 ? -0.15 : 0.35, dir > 0 ? 0.15 : 0.65); arc(x, y, 4, 4, BLU.pink, lv, dir > 0 ? -0.12 : 0.38, dir > 0 ? 0.12 : 0.62); };

// ---------------------------------------------------------------- Korvami: the spiral that makes a sound louder

const COC = { pale: '#ebe3db', red: '#c4092a', dark: '#39363f' };
/** Korvami's horn: a small red spiral that opens into a flared pale horn facing `dir`. */
function horn(x: number, y: number, s: number, dir: number, t: number, lv = 1): void {
  for (let k = 0; k <= 12; k++) { const g = k * 0.55 + t * 0.05, rr = (0.4 + k * 0.2) * s; px(x + Math.cos(g) * rr, y + Math.sin(g) * rr, k > 8 ? COC.pale : COC.red, lv); }
  line(x + dir * 2 * s, y - s, x + dir * 5 * s, y - 2.5 * s, COC.pale, lv); line(x + dir * 2 * s, y + s, x + dir * 5 * s, y + 2.5 * s, COC.pale, lv);
}
/** Louder: k sound arcs out of x, y facing `dir`, each bigger and bolder than the last. */
function louder(x: number, y: number, dir: number, k: number, lv = 1): void {
  for (let q = 0; q < k; q++) { const rr = 3 + q * 2.5; arc(x, y, rr, rr, q % 2 ? COC.red : COC.pale, lv, dir > 0 ? -0.12 : 0.38, dir > 0 ? 0.12 : 0.62); if (q > 1) arc(x, y, rr + 1, rr + 1, COC.pale, lv * 0.5, dir > 0 ? -0.1 : 0.4, dir > 0 ? 0.1 : 0.6); }
}

// ---------------------------------------------------------------- Suomono: beaded samphire stems and a pickling jar

const SAM = { green: '#66ae3d', red: '#c14537', brown: '#54443a', glass: '#c8e0d0', brine: '#7ab85a' };
/** Suomono's stem: a stalk of round green beads h high with a red bead on top, bent `bend` pixels at its tip. */
function beads(x: number, foot: number, h: number, bend: number, lv = 1): void {
  for (let i = 0; i < h; i += 2) { const u = i / Math.max(1, h), bx = x + bend * u * u, top = i + 2 >= h; oval(bx, foot - i, 1, 1, top ? SAM.red : SAM.green, lv); }
}
/** A pickling jar round a whorl: glass sides w each side and h high, a brown lid, and brine standing to `level` (0 to 1) with bubbles. */
function jar(x: number, foot: number, w: number, h: number, level: number, t: number, lv = 1): void {
  line(x - w, foot, x - w, foot - h, SAM.glass, lv); line(x + w, foot, x + w, foot - h, SAM.glass, lv); line(x - w, foot, x + w, foot, SAM.glass, lv);
  line(x - w - 1, foot - h, x + w + 1, foot - h, SAM.brown, lv);
  const bh = Math.round(h * level);
  if (bh > 0) { dither(x - w + 1, foot - bh, 2 * w - 1, bh, SAM.brine, 0.5 * lv); for (let q = 0; q < 3; q++) { const by = foot - ((t * 0.5 + q * 4) % Math.max(2, bh)); px(x - w + 2 + q * Math.max(1, (2 * w - 4) / 2), by, W, lv); } }
}

// ---------------------------------------------------------------- Tenbinka: a ring in a ring that keeps things level

const GIB = { brass: '#d3ab5b', pale: '#f0e8f0', maroon: '#5d2a3a' };
/** Tenbinka's gimbal: an outer brass ring and an inner ring turned by `spin`, with a pale level line through the middle that stays flat. */
function gimbalRings(x: number, y: number, rad: number, spin: number, lv = 1): void {
  arc(x, y, rad, rad, GIB.brass, lv);
  arc(x, y, Math.max(0.6, Math.abs(Math.cos(spin)) * (rad - 2)), rad - 2, GIB.pale, lv);
  px(x, y - rad, GIB.maroon, lv); px(x, y + rad, GIB.maroon, lv);
  line(x - rad + 3, y, x + rad - 3, y, GIB.pale, lv); px(x, y, W, lv);
}

// ---------------------------------------------------------------- Hilzuka: the quiet that takes the sound out of things

const LUL = { white: '#f8f8ff', cyan: '#57e8f7', gray: '#525867' };
/** A hush: a dotted cyan ring of quiet of radius rad, its dots turning slowly. */
function hush(x: number, y: number, rad: number, t: number, lv = 1): void {
  const n = Math.max(8, Math.round(rad * 2.4));
  for (let q = 0; q < n; q++) { if (q % 2) continue; const g = q / n * Math.PI * 2 + t * 0.02; px(x + Math.cos(g) * rad, y + Math.sin(g) * rad * 0.8, q % 4 ? LUL.cyan : LUL.white, lv); }
}
/** Muted sound: two small arcs facing `dir` with a line struck through them. */
function muted(x: number, y: number, dir: number, lv = 1): void {
  arc(x, y, 2, 2, LUL.white, lv, dir > 0 ? -0.15 : 0.35, dir > 0 ? 0.15 : 0.65); arc(x, y, 4, 4, LUL.cyan, lv, dir > 0 ? -0.12 : 0.38, dir > 0 ? 0.12 : 0.62);
  line(x - 1, y - 4, x + 5 * dir, y + 3, LUL.white, lv);
}

// ---------------------------------------------------------------- Laibiru: the flared lip of a conch, and its notches

const FLA = { red: '#b1291b', silver: '#c4ccd3', brown: '#55332b' };
/** Laibiru's lip: two flaring red edges with silver rims opening toward `dir` from x, y, spread by `open` (0 to 1). */
function flaredLip(x: number, y: number, dir: number, open: number, lv = 1, s = 1): void {
  for (const k of [-1, 1]) {
    const g = (1 + open * 4) * s;
    for (let i = 0; i <= 6 * s; i++) { const u = i / (6 * s), lx = x + dir * i, ly = y + k * (1 + g * u * u); px(lx, ly, i > 4 * s ? FLA.silver : FLA.red, lv); px(lx, ly - k, FLA.brown, lv * 0.75); }
  }
}
/** A notch: a small silver V cut. */
const notch = (x: number, y: number, lv = 1): void => { px(x - 1, y - 1, FLA.silver, lv); px(x, y, FLA.silver, lv); px(x + 1, y - 1, FLA.silver, lv); px(x, y - 1, FLA.brown, lv); };

// ---------------------------------------------------------------- Sisarmai: seven sister stars that fell together

const PLE = { pale: '#fff0b0', orange: '#ffb040', blue: '#6a78d8' };
const SEVEN = [[0, 0], [3, -1], [5, 1], [2, 3], [-3, 2], [-2, -3], [6, -3]];
/** Sisarmai's cluster: n of the seven sisters in their pattern at s apart round x, y, blue lines joining those found. */
function sisters(x: number, y: number, n: number, s: number, t: number, lv = 1): void {
  for (let q = 1; q < n; q++) line(x + SEVEN[q - 1][0] * s, y + SEVEN[q - 1][1] * s, x + SEVEN[q][0] * s, y + SEVEN[q][1] * s, PLE.blue, lv * 0.5);
  for (let q = 0; q < n; q++) { const sx = x + SEVEN[q][0] * s, sy = y + SEVEN[q][1] * s; if (((t >> 2) + q) % 4) { px(sx, sy, W, lv); px(sx - 1, sy, PLE.pale, lv); px(sx + 1, sy, PLE.pale, lv); px(sx, sy - 1, PLE.orange, lv); px(sx, sy + 1, PLE.orange, lv); } else px(sx, sy, PLE.pale, lv); }
}

// ---------------------------------------------------------------- Pakaeri: a star on its way back along a long orbit

const APH = { pale: '#fcf5dd', orange: '#da650f', plum: '#5d3c4b', gold: '#f8c860' };
/** A long orbit: a dotted ellipse round cx, cy, rx by ry. */
function orbitPath(cx: number, cy: number, rx: number, ry: number, lv = 1): void { for (let q = 0; q < 28; q++) { if (q % 2) continue; const g = q / 28 * Math.PI * 2; px(cx + Math.cos(g) * rx, cy + Math.sin(g) * ry, APH.plum, lv); px(cx + Math.cos(g) * rx + 1, cy + Math.sin(g) * ry, APH.orange, lv * 0.5); } }
/** Pakaeri's star: a pale core with orange rays, bigger and hotter as s grows. */
function returnStar(x: number, y: number, s: number, t: number, lv = 1): void {
  const r0 = Math.max(0.6, s * 0.5);
  oval(x, y, r0, r0, APH.pale, lv);
  for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + t * 0.05, l = s * (q % 2 ? 0.9 : 1.6); line(x + Math.cos(g) * (r0 + 0.5), y + Math.sin(g) * (r0 + 0.5), x + Math.cos(g) * (r0 + l), y + Math.sin(g) * (r0 + l), q % 2 ? APH.gold : APH.orange, lv); }
  px(x, y, W, lv);
}

// ---------------------------------------------------------------- Astrolabe: a brass star-measurer

const AST2 = { brass: '#d3ab5b', cream: '#eee6be', brown: '#7e5c2c' };
/** The astrolabe: a brass disc rim of radius rad with ticks, an off-center inner ring, star dots, and a sighting bar at angle `ang`. */
function astro(x: number, y: number, rad: number, ang: number, lv = 1): void {
  arc(x, y, rad, rad, AST2.brass, lv);
  for (let q = 0; q < 12; q++) { const g = q / 12 * Math.PI * 2; px(x + Math.cos(g) * (rad - 1), y + Math.sin(g) * (rad - 1), q % 3 ? AST2.brown : AST2.cream, lv); }
  arc(x + rad * 0.2, y - rad * 0.15, rad * 0.5, rad * 0.5, AST2.cream, lv * 0.75);
  line(x - Math.cos(ang) * rad, y - Math.sin(ang) * rad, x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, AST2.brass, lv);
  px(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, W, lv); px(x, y, AST2.brown, lv);
}
/** The reading tally: four marks, the first k of them lit. */
function tally(x: number, y: number, k: number, lv = 1): void { for (let q = 0; q < 4; q++) line(x - 4 + q * 3, y, x - 4 + q * 3, y + 2, q < k ? AST2.cream : AST2.brown, lv); }

// ---------------------------------------------------------------- Pallasite: a cold crystal star in a shell that shuts

const PAL = { shell: '#ebe3db', blue: '#73bbe3', deep: '#395594', green: '#9ad8a8' };
/** Pallasite's shell: two pale halves hinged at the back of x, y, parted by `open` (0 shut, 1 wide), the faceted cold crystal showing between. */
function clamStar(x: number, y: number, s: number, open: number, dir: number, t: number, lv = 1): void {
  const g = open * 4 * s;
  if (open > 0.1) { oval(x, y, 2 * s, Math.max(0.6, g * 0.4), PAL.blue, lv); line(x - s, y, x + s, y, PAL.green, lv); if ((t >> 2) & 1) px(x, y, W, lv); }
  arc(x, y - g * 0.5, 3 * s, 1.5 * s, PAL.shell, lv, 0.5, 1); arc(x, y + g * 0.5, 3 * s, 1.5 * s, PAL.shell, lv, 0, 0.5);
  px(x - dir * 3 * s, y, PAL.deep, lv);
}
/** A faceted shard of the crystal: a small blue diamond with a pale facet line. */
const facet = (x: number, y: number, lv = 1): void => blit(['.b.', 'bgb', 'bwd', '.d.'], x, y, { b: PAL.blue, g: PAL.green, w: W, d: PAL.deep }, lv);

// ---------------------------------------------------------------- Rusumo: water turned pink

const HAL = { pink: '#cf638b', white: '#fff6f9', gray: '#d2d2ca', clear: '#7ab0d8' };
/** A pink pool over `foot`, w each side: pink water with a white crust rim and a shimmer that runs across it. */
function pinkPool(x: number, foot: number, w: number, t: number, lv = 1, c = HAL.pink): void {
  if (w < 1) return;
  oval(x, foot, w, Math.max(1, w * 0.3), c, 0.75 * lv);
  arc(x, foot, w + 1, Math.max(1, w * 0.3) + 0.5, HAL.white, lv, 0, 0.5);
  px(x - w + ((t >> 1) % (2 * w)), foot, W, lv);
}

// ---------------------------------------------------------------- Petami: an old empty whorl that takes the best thing you have

const HEI = { tan: '#d2c2aa', violet: '#a958e6', brown: '#726141' };
/** Petami: an old empty spiral shell, tan and worn, its dark mouth violet inside, opened by `open`. */
function oldWhorl(x: number, y: number, s: number, open: number, lv = 1): void {
  oval(x, y, 4 * s, 3.2 * s, HEI.brown, 0.5 * lv);
  for (let k = 0; k <= 30; k++) { const g = k * 0.3, rr = (0.5 + k * 0.13) * s; px(x + Math.cos(g) * rr, y + Math.sin(g) * rr * 0.8, k % 6 === 0 ? HEI.brown : HEI.tan, lv); }
  oval(x + 3.5 * s, y + 1.5 * s, (1 + open) * s, (0.8 + open * 0.6) * s, HEI.violet, 0.75 * lv);
  arc(x + 3.5 * s, y + 1.5 * s, (1 + open) * s, (0.8 + open * 0.6) * s, HEI.tan, lv, 0.6, 1.1);
}
/** A violet hook on a thread from a to b, its catch at b. */
function hookLine(a: Pt, b: Pt, lv = 1): void { thick(a.x, a.y, b.x, b.y, HEI.violet, lv, HEI.tan); arc(b.x, b.y + 1, 2, 2, HEI.violet, lv, 0, 0.6); px(b.x - 2, b.y, W, lv); }

// ---------------------------------------------------------------- Opaski: a star that still points one way, and fixed stars

const LOD = { pale: '#f6f2de', gold: '#f0b22c', slate: '#4d4d7a' };
/** Opaski: a four-point star of size s, one point long and aimed at `ang`. */
function compassStar(x: number, y: number, s: number, ang: number, lv = 1): void {
  for (let q = 0; q < 4; q++) { const g = ang + q * Math.PI / 2, l = (q === 0 ? 2.4 : 1) * s; line(x, y, x + Math.cos(g) * l, y + Math.sin(g) * l, q === 0 ? LOD.gold : LOD.pale, lv); }
  px(x, y, W, lv);
}
/** A Fixed Star: a small gold star on a short slate pin. */
const fixedStar = (x: number, y: number, lv = 1): void => { glint(x, y, LOD.gold, lv); line(x, y + 2, x, y + 4, LOD.slate, lv); };

// ---------------------------------------------------------------- Kotigai: a coiled fossil that keeps every blow in its chambers

const AMM = { brown: '#986941', pale: '#e4ecf4', tan: '#d8c199' };
/** Kotigai's coil: a ribbed spiral of radius rad, its chambers lit pale from the middle out by `fill` (0 to 1). */
function ammo(x: number, y: number, rad: number, fill: number, lv = 1): void {
  const n = Math.round(10 + rad * 4);
  oval(x, y, rad * 0.9, rad * 0.8, AMM.brown, 0.5 * lv);
  for (let k = 0; k <= n; k++) { const g = k * (13 / n), rr = rad * (0.15 + 0.85 * k / n), cx = x + Math.cos(g) * rr, cy = y + Math.sin(g) * rr * 0.9; px(cx, cy, k / n <= fill ? AMM.pale : AMM.tan, lv); if (rr > 2.5) px(x + Math.cos(g) * (rr - 1), y + Math.sin(g) * (rr - 1) * 0.9, k % 3 === 0 ? AMM.brown : k / n <= fill ? AMM.tan : AMM.brown, lv); }
  px(x, y, W, lv);
}

// ---------------------------------------------------------------- the pictures

export const ART_C: Record<string, LegendArt> = {
  // ---------------- Haota
  // Slide Over: the mantle slides up over Haota from behind, its gleam runs across, and cream motes rise as it heals.
  pallium_slide: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), s = -face(r.from), u = ease(prog(t, leaveOf(r), hit)), down = prog(t, hit + 10, r.end - 2);
      mantle(U.x + s * 14 * (1 - u), U.y + 5, 7, Math.round(10 * (1 - down)), 0, hold(t, leaveOf(r) - 2, r.end, 3));
    },
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r);
      if (t >= hit - 2 && t < hit + 10) mantle(U.x, U.y + 5, 7, 10, prog(t, hit - 2, hit + 10), 1, false);
      landed(r, 22, (E, a) => motes(E.x, E.y, a, 7, r.seed, [HAO.cream, W, HAO.light], 22, 7));
    },
  },

  // Mantle Over: three cowries rise round Haota, the mantle grows a lobe at each, and closes into one dome rimmed twice for Fortify.
  pallium_buff: {
    noFlights: true, noLandings: true,
    back(r) {
      const n = landedN(r), U = userAt(r);
      if (n) mantle(U.x, U.y + 5, 5 + n, 6 + n * 2, 0, hold(r.t, 0, r.end, 4));
    },
    front(r) {
      flying(r, p => cowrie(p.x, p.y));
      landed(r, 8, (E, a) => sparks(E.x, E.y - 4, a, 5, r.seed + a, W, HAO.cream, 8, 0.8));
      const t = r.t, last = lastOf(r), U = userAt(r), L = hold(t, last, r.end, 4);
      if (L > 0) { mantle(U.x, U.y + 5, 8, 12, prog(t, last, r.end - 4), L, false); arc(U.x, U.y + 5, 9, 13, HAO.tan, L, 0.5, 1); }
    },
  },

  // Lie Over: two lobes of mantle close over the foe from either side and meet on it, and it comes out polished, a gleam on it.
  pallium_dazzle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit, u = ease(prog(t, leaveOf(r), hit));
      const gap = a < 0 ? 16 - 12 * u : 4 + 10 * ease(prog(a, 6, 14)), L = hold(t, leaveOf(r), hit + 14, 3);
      for (const s of [-1, 1]) lobe(E.x + s * gap, E.y, s, L);
      if (a >= 0 && a < 3) { arc(E.x, E.y, 7, 6, W, 1); arc(E.x, E.y, 8, 7, HAO.cream, 0.5); }
      if (a >= 6) { const g = fade(a - 6, r.end - hit - 6); glint(E.x + 3, E.y - 3, HAO.cream, g); if ((a >> 2) & 1) glint(E.x - 3, E.y + 1, HAO.cream, g); }
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // Shine: the sky warms, a great polished mantle stands over Haota's side, gleams race across it, and light falls on the team.
  pallium_shine: {
    lead: 14, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), grow = ease(prog(t, 0, 18));
      wash(HAO.cream, 0.0625 * L);
      mantle(U.x, U.y + 6, 4 + 9 * grow, 4 + 12 * grow, (t * 0.035) % 1, L);
    },
    front(r) {
      flying(r, p => { glint(p.x, p.y, HAO.cream, 1); tail(p.x, p.y, p.ux, p.uy, [HAO.cream, HAO.light]); });
      landed(r, 12, (E, a) => { if (a < 2) glint(E.x, E.y - 6, HAO.gleam, 1); ring(E.x, E.y + 3, 3 + a, HAO.cream, fade(a, 12)); });
      const t = r.t, last = lastOf(r), U = r.from, L = hold(t, last, r.end, 4);
      if (L > 0) { arc(U.x, U.y + 1, 7, 8, HAO.gleam, L * ((t >> 2) & 1 ? 1 : 0.5)); arc(U.x, U.y + 1, 8, 9, HAO.cream, L * 0.5); }
    },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y) - 4, r: 14, lv: 1.2 * hold(r.t, 0, r.end, 6), tint: HAO.cream }]; },
  },

  // ---------------- Lainami
  // Slosh: gray water stands up under each foe and rocks side to side, and its high side throws foam over the foe.
  seiche_slosh: {
    noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 3);
      r.to.forEach((E, j) => {
        const h0 = hitAt(r, j), a = t - h0, up = ease(prog(t, 0, h0));
        const tilt = a >= 0 && a < 3 ? 5 : Math.sin((t - h0) * 0.6 + Math.PI / 2) * 5 * (a < 0 ? up : 1 - prog(a, 3, 18));
        standing(E.x, E.y + 6, 10, Math.round(2 + 4 * up - 4 * prog(a, 6, 18)), tilt, L);
      });
    },
    front(r) {
      landed(r, 16, (E, a) => {
        const b = hs(a);
        for (let q = 0; q < 7; q++) { const vx = (q - 3) * 0.35, vy = -1.2 - hash(r.seed + q) * 0.9; px(E.x + 6 + vx * b, E.y - 1 + vy * b + 0.1 * b * b, q % 2 ? SEI.foam : W, fade(a, 16)); }
        if (a < 6) bands(E.x + 3, 7, E.y - 1 - (a >> 1), [[SEI.foam, 1], [SEI.light, 1]], 1 - a / 6);
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Still: drops climb out of the ground into a gray wall beside Lainami, and the wall stands dead level, a Still Wall.
  seiche_still: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, n = landedN(r), x = U.x + face(U) * 10;
      if (n) standing(x, U.y + 6, 3, 4 + n * 3, n < 3 ? Math.sin(t * 0.8) * 2 : 0, hold(t, 0, r.end, 4));
    },
    front(r) {
      const U = r.from, x = U.x + face(U) * 10;
      flying(r, p => blit(SEI_DROP, x - 2 + p.i * 2, U.y + 6 - p.u * (6 + p.i * 3), { f: SEI.foam, g: SEI.gray, d: SEI.deep }, 1));
      landed(r, 8, (E, a, i) => ring(x, U.y + 6 - 4 - (i + 1) * 3, 2 + a * 0.6, SEI.foam, fade(a, 8)));
      const last = lastOf(r), a = r.t - last;
      if (a >= 0 && a < 10) line(x - 4, U.y + 6 - 13, x + 4, U.y + 6 - 13, W, 1 - a / 10);
    },
  },

  // Gray Hold: two gray walls slide in on the foe from either side, close, and hold it in still gray water with a dead-level top.
  seiche_hold: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), u = ease(prog(t, leaveOf(r), hit));
      if (t < hit + 1) for (const s of [-1, 1]) standing(E.x + s * (16 - 11 * u), E.y + 6, 2, 11, s * Math.sin(t * 0.7) * 2, hold(t, leaveOf(r) - 2, r.end, 3));
    },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit;
      if (a < 0) return;
      const h = Math.round(11 * (1 - prog(a, 12, r.end - hit - 2))), L = fade(a, r.end - hit);
      standing(E.x, E.y + 6, 7, h, 0, 0.5 * L);
      line(E.x - 7, E.y + 6 - h, E.x + 7, E.y + 6 - h, SEI.foam, L);
      if (a < 3) { line(E.x - 8, E.y + 6 - h, E.x - 8, E.y + 6, W, 1); line(E.x + 8, E.y + 6 - h, E.x + 8, E.y + 6, W, 1); }
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // Break Over: Lainami stands up tall and gray, the water it held stands behind the foes, rocks once, and falls over them all.
  seiche_break: {
    lead: 16, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), L = hold(t, 0, r.end, 6);
      standing(U.x, U.y + 6, 6, Math.round(14 * ease(prog(t, 0, 14)) * (1 - prog(t, hit - 6, hit))), Math.sin(t * 0.3) * 2, L);
      r.to.forEach((E, j) => {
        const h0 = hitAt(r, j), a = t - h0, away = high(E) ? 1 : -1, up = ease(prog(t, 10, h0 - 4)), fall = prog(a, -2, 5);
        if (a < 6) standing(E.x + away * 10 * (1 - fall), E.y + 6, 7 - Math.round(fall * 2), Math.round(18 * up * (1 - fall)), a < -2 ? -away * Math.sin(t * 0.25) * 3 : -away * 4, L);
        if (a >= 0) bands(E.x - 13, 27, E.y + 5, [[SEI.foam, 1], [SEI.gray, 2], [SEI.deep, 1]], fade(a, r.end - h0, 8));
      });
    },
    front(r) {
      landed(r, 20, (E, a) => {
        const b = hs(a, 5);
        for (let q = 0; q < 14; q++) { const vx = (hash(r.seed + q * 3) - 0.5) * 2.4, vy = -1 - hash(r.seed + q) * 1.4; px(E.x + vx * b, E.y + 2 + vy * b + 0.09 * b * b, q % 3 ? SEI.foam : W, fade(a, 20)); }
        if (a < 6) { arc(E.x, E.y + 2, 9, 6, W, 1 - a / 6, 0.5, 1); arc(E.x, E.y + 3, 10, 7, SEI.foam, 1 - a / 6, 0.5, 1); }
      });
    },
    scene(r) { return jolt(r, 12, 2); },
    lights(r) { return r.to.map(E => ({ x: Math.round(E.x), y: Math.round(E.y), r: 12, lv: 1.2 * hold(r.t, hitOf(r) - 4, hitOf(r) + 12, 4), tint: SEI.light })); },
  },

  // ---------------- Roibuki
  // Spray Star: two stars of spray streak across with shades thinning behind them and burst on the foe in spray.
  scud_whip: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { spray(p.x, p.y, p.ux, p.uy, 9, r.t); sprayStar(p.x, p.y, r.t, p.i ? 1 : 2); });
      landed(r, 12, (E, a, i) => {
        sparks(E.x, E.y, hs(a), i ? 6 : 9, r.seed + i, W, SCU.pale, 12, i ? 1 : 1.4);
        if (a < 4) { sprayStar(E.x, E.y, a, i ? 3 : 4); ring(E.x, E.y, 3 + a, SCU.foam, 1 - a / 4); }
        if (a > 2 && a < 8) px(E.x + (i ? -3 : 3), E.y - 2, SCU.red, 1);
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Skip Ahead: Roibuki skips a step forward, leaves a Spray Shade where it stood, and spray rises round the shade.
  scud_skip: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, s = face(U), x = U.x - s * 9, L = hold(t, r.contact, r.end, 4);
      if (L > 0) shade(x, U.y, s, 0.5 * L);
    },
    front(r) {
      const t = r.t, U = r.from, s = face(U), x = U.x - s * 9;
      flying(r, p => spray(x + (p.i - 0.5) * 4, U.y + 6 - p.u * 12, 0, -1, 6, t));
      landed(r, 18, (E, a) => {
        sparks(x, U.y - 4, hs(a), 6, r.seed, W, SCU.pale, 10, 0.8);
        for (let q = 0; q < 2; q++) { const cx = U.x + s * (6 + q * 3 + (a >> 2)); line(cx, U.y - 2, cx + s * 2, U.y, SCU.foam, fade(a, 18)); line(cx + s * 2, U.y, cx, U.y + 2, SCU.foam, fade(a, 18)); }
      });
    },
  },

  // Run Through: Roibuki dashes through, a line of shades fading behind it, and streaks of spray run on past each foe.
  scud_run: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), dx = U.x - r.from.x, dy = U.y - r.from.y;
      if (t < r.contact + 10) for (let q = 1; q <= 3; q++) shade(r.from.x + dx * q / 4, r.from.y + dy * q / 4, face(r.from), (0.75 - q * 0.2) * fade(t - r.contact, 10, 6), q === 3);
    },
    front(r) {
      smear(r, SCU.foam, SCU.pale);
      flying(r, p => spray(p.x, p.y, p.ux, p.uy, 8, r.t));
      landed(r, 14, (E, a, i) => { if (a < 4) sprayStar(E.x + (i % 3 - 1) * 3, E.y - 1 + (i % 2) * 2, a, 2); sparks(E.x, E.y, a, 4, r.seed + i * 3, SCU.foam, SCU.red, 8, 0.6); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Spume Mark: spray whirls round Roibuki, it slips out of sight and leaves a shade, a long streak bursts on the foe, and a red mark stays.
  scud_spume: {
    lead: 10, tail: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, hitOf(r) + 6, 4);
      for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + t * 0.3; px(U.x + Math.cos(g) * 8, U.y + 1 + Math.sin(g) * 4, q % 2 ? SCU.foam : SCU.pale, L); }
      if (t >= r.contact) shade(U.x, U.y, face(U), 0.5 * hold(t, r.contact, r.end, 6));
    },
    front(r) {
      flying(r, p => { spray(p.x, p.y, p.ux, p.uy, 14, r.t); sprayStar(p.x, p.y, r.t, 2); });
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit;
      if (a >= 0) {
        sparks(E.x, E.y, hs(a, 5), 12, r.seed, W, SCU.pale, 14, 1.3);
        chunks(E.x, E.y, hs(a, 5), 6, r.seed, [SCU.foam, SCU.pale], 18);
        const L = hold(t, hit + 4, r.end, 4);
        ring(E.x, E.y + 5, 6, SCU.red, L);
        for (let q = 0; q < 2; q++) if (((a >> 3) & 1) || q === 0) px(E.x - 1 + q * 2, E.y - 7, SCU.red, L);
      }
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Nitorshi
  // Daybreak: Nitorshi's coat stands up and tilts until it catches the light, throws a banded sunbeam, and the foe is left Sunlit.
  enamel_slam: {
    lead: 8, tail: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, P = { x: U.x + face(U) * 8, y: U.y - 8 }, L = hold(t, 0, hitOf(r) + 8, 4);
      coat(P.x, P.y, 6, 8, -face(U) * 3 * prog(t, 0, 10), prog(t, 4, 14), L);
    },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), E = aim(r), P = { x: U.x + face(U) * 8, y: U.y - 8 }, on = hold(t, leaveOf(r), hit + 8, 2);
      if (on > 0) { thick(P.x, P.y, E.x, E.y, W, on, ENA.sun); line(P.x + 2, P.y + 1, E.x + 2, E.y + 1, ENA.gold, on * 0.75); line(P.x - 2, P.y - 1, E.x - 2, E.y - 1, ENA.gold, on * 0.5); }
      const a = t - hit;
      if (a >= 0) { if (a < 3) oval(E.x, E.y, 5, 4, ENA.sun, 0.5); sunlit(E.x, E.y - 9, t, fade(a, r.end - hit)); sparks(E.x, E.y, hs(a), 6, r.seed, W, ENA.gold, 8); }
    },
    scene(r) { return jolt(r, 6, 1); },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 12, lv: 1.6 * hold(r.t, hitOf(r) - 2, r.end, 4), tint: ENA.sun }]; },
  },

  // Dim Coat: two panes of enamel fold round Nitorshi and their gloss dims to bronze, and a gold spark waits on top for its next turn.
  enamel_bash: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), u = ease(prog(t, 0, hitOf(r))), dim = prog(t, hitOf(r) - 2, hitOf(r) + 8), L = hold(t, 0, r.end, 4);
      const body = dim < 0.34 ? ENA.cream : dim < 0.67 ? ENA.dim : ENA.bronze;
      for (const s of [-1, 1]) coat(U.x + s * (12 - 6 * u), U.y, 3, 9, s * 2 * u, dim < 1 ? prog(t, 2, hitOf(r)) : 0, L, body);
      const a = t - hitOf(r);
      if (a >= 2) glint(U.x, U.y - 8, ENA.gold, ((t >> 2) & 1 ? 1 : 0.5) * L);
    },
  },

  // Glaze Blade: Nitorshi dashes in trailing gloss, a blade of enamel cuts the foe, and a pool of glaze hardens round its feet.
  enamel_glaze: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit;
      if (a >= 0) { const w = Math.min(8, 3 + a), L = fade(a, r.end - hit); oval(E.x, E.y + 5, w, 1.5, a < 6 ? ENA.cream : ENA.dim, L); arc(E.x, E.y + 5, w, 1.5, ENA.gold, L); if (a > 4) px(E.x - w + ((a - 4) % (2 * w)), E.y + 4, W, L); }
    },
    front(r) {
      smear(r, ENA.cream, ENA.gold);
      flying(r, p => { thick(p.x, p.y, p.x - p.ux * 6, p.y - p.uy * 6, ENA.cream, 1, ENA.gold); px(p.x, p.y, W, 1); });
      landed(r, 10, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x + 6, E.y - 6, E.x + 6 - 12 * n, E.y - 6 + 12 * n, W, fade(a, 10), ENA.gold); sparks(E.x, E.y, hs(a), 5, r.seed, ENA.sun, ENA.gold, 8); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Whole Dome: panes of enamel rise round every foe, close into a glossy dome with gold seams, and a gleam races round it in the glare.
  enamel_whole: {
    lead: 14, tail: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, leaveOf(r) + 4, 4);
      for (let q = 0; q < 3; q++) { const y = U.y - 4 - (t * 0.8 + q * 6) % 18; coat(U.x - 4 + q * 4, y, 3, 4, 0, 0, L * (y > U.y - 18 ? 1 : 0.5)); }
    },
    front(r) {
      flying(r, p => coat(p.x, p.y, 4, 5, 0, p.u, 1));
      const t = r.t;
      r.to.forEach((E, j) => {
        const h0 = hitAt(r, j), last = r.hits.filter(h => h.to === j).pop()?.at ?? h0, n = r.hits.filter(h => h.to === j && t >= h.at).length, L = hold(t, h0, r.end, 4);
        if (!n) return;
        const done = t >= last, fill = done ? 1 : n / 5;
        arc(E.x, E.y + 5, 9, 12, ENA.gold, L, 0.5, 0.5 + 0.5 * fill);
        arc(E.x, E.y + 5, 10, 13, ENA.cream, L * 0.5, 0.5, 0.5 + 0.5 * fill);
        if (done) { for (let q = 1; q < 4; q++) { const g = (0.5 + q / 8) * Math.PI * 2; line(E.x + Math.cos(g) * 4, E.y + 5 + Math.sin(g) * 5, E.x + Math.cos(g) * 9, E.y + 5 + Math.sin(g) * 12, ENA.bronze, L * 0.75); } const g = (0.5 + ((t - last) * 0.03) % 0.5) * Math.PI * 2; glint(E.x + Math.cos(g) * 9, E.y + 5 + Math.sin(g) * 12, ENA.sun, L); }
      });
    },
    scene(r) { return jolt(r, 10, 2); },
    lights(r) { return r.to.map(E => ({ x: Math.round(E.x), y: Math.round(E.y), r: 12, lv: 1.4 * hold(r.t, lastOf(r), r.end, 4), tint: ENA.sun })); },
  },

  // ---------------- Poscus
  // Snort: Poscus barrels in, snorts two white clouds over the foe, chips of glaze fly, and a pink wisp of the blow comes back to heal it.
  porcella_snort: {
    noLandings: true,
    front(r) {
      smear(r, POS.white, POS.pink);
      landed(r, 18, (E, a) => {
        const b = hs(a), s = face(r.from), rad = Math.max(1, 3 - Math.max(0, b - 8) * 0.25);
        for (let q = 0; q < 2; q++) { const cx = E.x - s * (4 + b * 0.6), cy = E.y - 3 + q * 6 - b * 0.15; snow(cx, cy, rad, 1); px(cx - 1, cy - 1, W, 1); }
        chunks(E.x, E.y, a, 5, r.seed, [POS.white, POS.blue], 14);
        motes(r.from.x, r.from.y, a - 4, 3, r.seed, [POS.pink, W], 14, 4);
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Start Rolling: Poscus curls into a glazed ball, spins up, and rolls into the foe over a track of snow, cracking the ice under it.
  porcella_start: {
    noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), a = t - hit;
      if (t >= r.motionAt[1] && a < 12) for (let q = 1; q <= 4; q++) { const u = q / 5; snow(r.from.x + (U.x - r.from.x) * u, r.from.y + (U.y - r.from.y) * u + 4, 1 + u, fade(a, 12, 6)); }
      if (a >= 0 && a < 22) { const n = Math.min(10, 3 + a * 2), L = fade(a, 22); for (let i = 0; i <= n; i++) for (const s of [-1, 1]) { const y = aim(r).y + 5 + (hash(r.seed + i) < 0.4 ? 1 : 0); px(aim(r).x + s * i, y, i < 3 ? W : POS.ice, L); px(aim(r).x + s * i, y + 1, POS.blue, L); } }
    },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit + 2) { const L = hold(t, 0, hit + 2, 3); arc(U.x, U.y, 6, 6, POS.blue, L); arc(U.x, U.y, 7, 7, POS.white, 0.5 * L, (t * 0.08) % 1, (t * 0.08) % 1 + 0.5); }
      smear(r, POS.white, POS.ice);
      landed(r, 16, (E, a) => { chunks(E.x, E.y + 2, hs(a), 6, r.seed, [POS.white, POS.ice, POS.blue], 16); if (a < 3) arc(E.x, E.y, 6, 5, W, 1); });
    },
    scene(r) { return jolt(r, 8, 2); },
  },

  // Bump: Poscus bumps three snowballs over, each bursts into snow on the foe, and a crust of ice grows round its feet with each one.
  porcella_bump: {
    noFlights: true, noLandings: true,
    back(r) {
      const n = landedN(r), E = aim(r);
      if (n) { const L = fade(r.t - hitOf(r), r.end - hitOf(r), 6); oval(E.x, E.y + 5, 3 + n * 2, 1 + n * 0.4, POS.ice, L); arc(E.x, E.y + 5, 3 + n * 2, 1 + n * 0.4, W, L); }
    },
    front(r) {
      flying(r, p => { snow(p.x, p.y, 2); px(p.x - 1, p.y - 1, W, 1); tail(p.x, p.y, p.ux, p.uy, [POS.white, POS.shade]); });
      landed(r, 14, (E, a, i) => { chunks(E.x, E.y - 2, hs(a), 5, r.seed + i * 11, [POS.white, POS.shade], 14); if (a < 3) snow(E.x, E.y - 1, 3); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Downhill: snow blows down the field, and Poscus rolls downhill in a growing snowball through every foe and bursts in a heap of snow.
  porcella_downhill: {
    lead: 24, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 14; q++) { const x = (hash(q * 7) * 110 + t * 1.4) % 110 - 7, y = (hash(q * 13) * 60 + t * 0.9) % 60; px(x, y, q % 3 ? POS.white : POS.ice, L * 0.75); }
      const hit = hitOf(r);
      r.to.forEach(E => { const a = t - hit; if (a >= 0) bands(E.x - 12, 25, E.y + 5, [[W, 1], [POS.ice, 1]], fade(a, r.end - hit, 8)); });
    },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), S = r.from, u = ease(prog(t, 4, hit));
      if (t < hit) { const x = S.x + (E.x - S.x) * u, y = S.y + (E.y - S.y) * u - Math.abs(Math.sin(u * Math.PI * 3)) * 4, rad = 3 + 4 * u; snow(x, y + 1, rad + 1, 1); piggy(x, y, rad - 1, t * 0.5); }
      landed(r, 22, (P, a) => { const b = hs(a, 5); chunks(P.x, P.y, b, 10, r.seed, [POS.white, POS.ice, POS.white], 22, 1.3); if (a < 6) snow(P.x, P.y, 6 - a * 0.5, 1); });
    },
    scene(r) { return jolt(r, 14, 2); },
  },

  // ---------------- Kolikni
  // Clip: a coin flicked edge on cuts the foe, and a coin clipped off it flies back to heal Kolikni's weakest.
  specie_clip: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { coin(p.x, p.y, 2 + ((r.t >> 1) & 1)); tail(p.x, p.y, p.ux, p.uy, [KOL.light, KOL.teal]); });
      landed(r, 14, (E, a) => {
        if (a < 6) { const n = Math.min(1, (a + 1) / 2); thick(E.x + 5, E.y - 5, E.x + 5 - 10 * n, E.y - 5 + 10 * n, W, 1 - a / 6, KOL.teal); }
        const u = prog(a, 2, 14), S = r.from;
        if (u > 0 && u < 1) coin(E.x + (S.x - E.x) * u, E.y + (S.y - E.y) * u - Math.sin(Math.PI * u) * 10, (r.t >> 1) & 3);
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Pay Out: three coins lob over and stack at the foe's feet, a little pile that stays to pin it down.
  specie_payout: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => coin(p.x, p.y, (r.t >> 1) + p.i));
      const t = r.t, n = landedN(r), E = aim(r), L = fade(t - hitOf(r), r.end - hitOf(r), 6);
      for (let q = 0; q < n; q++) blit(['.ttttt.', 'tlhhllt', 'tkkkkkt', '.eeeee.'], E.x - 6 + (q % 2), E.y + 5 - q * 3, { t: KOL.teal, l: KOL.light, h: W, k: KOL.dark, e: KOL.edge }, L);
      landed(r, 8, (P, a) => { sparks(P.x - 5, P.y + 3, a, 5, r.seed + a, W, KOL.teal, 8, 0.7); if (a < 6) line(P.x - 9, P.y + 7, P.x + 9, P.y + 7, KOL.edge, 1 - a / 6); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Buy Time: Kolikni's purse appears over it, two coins circle in and drop through its slit, and it clinks shut to buy another turn.
  specie_buy: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), P = { x: U.x, y: U.y - 11 }, L = hold(t, 0, r.end, 4);
      purse(P.x, P.y, L);
      flying(r, p => { const u = p.u < 0.6 ? 0 : (p.u - 0.6) / 0.4, g = p.u * Math.PI * 5 + p.i * Math.PI; coin(U.x + Math.cos(g) * 9 * (1 - u), U.y + Math.sin(g) * 4 * (1 - u) + (P.y - U.y) * u, (t >> 1) + p.i); });
      landed(r, 10, (E, a) => { sparks(P.x, P.y - 2, a, 6, r.seed + a, W, KOL.teal, 8, 0.7); });
      const a = t - lastOf(r);
      if (a >= 0) { const c = (a >> 2) & 1 ? KOL.light : KOL.teal; arc(U.x, U.y + 1, 7, 4, c, fade(a, r.end - lastOf(r))); }
    },
  },

  // Spend It All: the purse bursts open over Kolikni, coins rain on every foe and pile up clinking, and a teal ring shields the team.
  specie_spend: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 5);
      const pop = ease(prog(t, 6, 14));
      purse(U.x, U.y - 12, L, Math.round(pop * 2));
      if (t > 8 && t < leaveOf(r) + 6) for (let q = 0; q < 6; q++) { const a = (t - 8 + q * 3) % 14; coin(U.x - 6 + q * 2.4, U.y - 16 - a * 1.2, (t >> 1) + q, L); }
      const last = lastOf(r);
      if (t >= last) { const k = hold(t, last, r.end, 4); arc(U.x, U.y + 1, 9, 6, KOL.teal, k); arc(U.x, U.y + 1, 10, 7, KOL.light, 0.5 * k); }
    },
    front(r) {
      flying(r, p => coin(p.x, p.y, (r.t >> 1) + p.i));
      const t = r.t;
      r.to.forEach((E, j) => { const n = r.hits.filter(h => h.to === j && t >= h.at).length; for (let q = 0; q < Math.min(n, 6); q++) coin(E.x - 6 + (q % 3) * 4 + (q > 2 ? 2 : 0), E.y + 6 - (q > 2 ? 2 : 0), 0, fade(t - hitOf(r), r.end - hitOf(r), 6)); });
      landed(r, 10, (E, a, i) => { if (a < 4) glint(E.x - 5 + (i % 4) * 3, E.y + 2, KOL.teal, 1); });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Limashi
  // Coarse Sting: Limashi dashes in, two clumps of grit fly, and each scores a set of bright scratches across the foe.
  emery_coarse: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, LIM.gold, LIM.sand);
      flying(r, p => { grit(p.x, p.y, 3, 7, r.seed + p.i, r.t); px(p.x, p.y, LIM.pale, 1); tail(p.x, p.y, p.ux, p.uy, [LIM.gold, LIM.sand, LIM.brown]); });
      landed(r, 14, (E, a, i) => {
        scour(E.x, E.y + (i ? 2 : -2), 3, 10, Math.min(1, (a + 1) / 3), fade(a, 14, 6), i ? 0.5 : -0.5);
        chunks(E.x, E.y, hs(a), 4, r.seed + i * 5, LIM_COLS, 12);
      });
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 4) grit(E.x, E.y + 6, 6, 6, r.seed, 0, fade(a, r.end - lastOf(r)));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Rub Under: a stream of grit sweeps along the ground under the foe and scours a long band across it, grains left clinging.
  emery_rub: {
    noFlights: true, noLandings: true,
    back(r) {
      flying(r, p => { for (let q = 0; q < 10; q++) px(p.x - q * Math.sign(p.ux || 1), p.E.y + 5 - (q % 3), LIM_COLS[q % 3], q < 6 ? 1 : 0.5); });
    },
    front(r) {
      smear(r, LIM.gold, LIM.sand);
      flying(r, p => grit(p.x, p.E.y + 3, 3, 6, r.seed, r.t));
      landed(r, 12, (E, a) => { scour(E.x, E.y + 1, 3, 14, Math.min(1, (a + 1) / 3), fade(a, 12, 5), 0); sparks(E.x, E.y, hs(a), 6, r.seed, LIM.pale, LIM.gold, 8); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 3) for (let q = 0; q < 5; q++) px(E.x - 3 + hash(r.seed + q) * 7, E.y - 2 + hash(r.seed + q * 5) * 7, LIM_COLS[q % 3], fade(a, r.end - hitOf(r)));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Abrade: grit whirls round Limashi in a ring that thickens into a scouring cloud, and Limashi is lost inside it.
  emery_abrade: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, n = landedN(r), L = hold(t, 0, r.end, 5);
      if (n) oval(U.x, U.y + 1, 5 + n, 3 + n * 0.6, LIM.brown, 0.25 * L);
    },
    front(r) {
      const t = r.t, U = r.from, n = landedN(r), L = hold(t, 0, r.end, 5);
      flying(r, p => { const g = p.u * Math.PI * 6 + p.i * Math.PI / 2; grit(U.x + Math.cos(g) * 9, U.y + Math.sin(g) * 5, 2, 4, r.seed + p.i, t); });
      if (n) { grit(U.x, U.y, 8, 6 + n * 4, r.seed, t, L); oval(U.x, U.y, 5, 4, LIM.sand, 0.25 * n * L); }
    },
  },

  // Polish Off: a wheel of grit spins up before Limashi, rolls through every foe, grinds their shields to shards, and scours them.
  emery_polishoff: {
    lead: 14, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, s = face(U), L = hold(t, 0, leaveOf(r) + 2, 3), spin = t * (0.2 + prog(t, 0, 14) * 0.4);
      const wheel = (x: number, y: number, rad: number, lv: number): void => {
        arc(x, y, rad, rad, LIM.gold, lv); arc(x, y, rad - 1, rad - 1, LIM.brown, lv * 0.5);
        for (let q = 0; q < 4; q++) { const g = spin + q * Math.PI / 2; line(x, y, x + Math.cos(g) * (rad - 1), y + Math.sin(g) * (rad - 1), q % 2 ? LIM.sand : LIM.pale, lv); }
      };
      if (L > 0) wheel(U.x + s * 9, U.y - 2, 2 + 3 * ease(prog(t, 0, 12)), L);
      flying(r, p => { if (p.i === 0) wheel(p.x, p.y, 5, 1); else grit(p.x, p.y, 4, 5, r.seed + p.i, t); });
      landed(r, 18, (E, a, i) => {
        const b = hs(a, 5);
        if (i < r.to.length) for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + 0.3, d = 3 + b * 0.9; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8 - 1, q % 2 ? '#d8e8f8' : W, fade(a, 18)); }
        scour(E.x, E.y + (i % 2 ? 2 : -2), 3, 12, Math.min(1, (a + 1) / 3), fade(a, 18, 6), i % 2 ? 0.4 : -0.4);
      });
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Faience
  // Clear Note: a glazed bellflower swings across and rings on the foe in thin rings of glaze and yellow.
  faience_clear: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { const s = Math.sin(p.a * 0.8); fbell(p.x, p.y, s); tail(p.x, p.y + 2, p.ux, p.uy, [FAI.light, FAI.glaze]); });
      landed(r, 18, (E, a) => { ting(E.x, E.y, hs(a), 3, 14); if (a < 6) fbell(E.x, E.y - 9, a & 2 ? 1 : -1); sparks(E.x, E.y, hs(a), 5, r.seed, W, FAI.light, 8, 0.8); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Chime: three bellflowers circle Faience and ring one by one, and a cup of glazed petals closes round it as a shield.
  faience_chime: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), n = landedN(r), L = hold(t, hitOf(r), r.end, 4);
      for (let q = 0; q < n + 2 && q < 5; q++) { const g = (0.55 + q * 0.1) * Math.PI * 2, x = U.x + Math.cos(g) * 7, y = U.y + 1 + Math.sin(g) * 7; oval(x, y, 2, 3, FAI.glaze, L); px(x, y - 2, FAI.light, L); }
    },
    front(r) {
      const t = r.t, U = userAt(r);
      flying(r, p => { const g = p.u * Math.PI * 4 + p.i * Math.PI * 2 / 3, rr = 11 - p.u * 4; fbell(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, Math.cos(g)); });
      landed(r, 12, (E, a) => ting(E.x, E.y - 2, a, 2, 12));
      const a = t - lastOf(r);
      if (a >= 0) { const L = fade(a, r.end - lastOf(r)); arc(U.x, U.y + 3, 8, 3, FAI.light, L, 0, 0.5); if ((a >> 2) & 1) glint(U.x + 6, U.y - 5, FAI.yellow, L); }
    },
  },

  // Window Box: a window box of glazed flowers hangs over the foe, tips, pours three runs of water on it, and keeps dripping.
  faience_box: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), bx = E.x, by = E.y - (high(E) ? 9 : 14), L = hold(t, 0, r.end, 4), tip = ease(prog(t, leaveOf(r) - 4, leaveOf(r)));
      for (let i = -4; i <= 4; i++) {
        const dy = Math.round(tip * 2 * (i + 4) / 8);
        px(bx + i, by + dy, FAI.pot, L); px(bx + i, by + 1 + dy, FAI.dark, L);
        if (i % 3 === 0) { px(bx + i, by - 1 + dy, FAI.glaze, L); px(bx + i, by - 2 + dy, FAI.light, L); px(bx + i + 1, by - 2 + dy, FAI.yellow, L); }
      }
      flying(r, p => { const y = by + 3 + (E.y - 4 - by - 3) * p.u * p.u; blit(SEI_DROP, bx + 4, y, { f: FAI.light, g: FAI.glaze, d: '#1a6a70' }, 1); });
      landed(r, 8, (P, a) => { for (let q = 0; q < 5; q++) px(P.x + 4 + (q - 2) * (1 + a * 0.4), P.y - 4 - Math.sin(Math.PI * a / 8) * (2 + (q % 2)), q % 2 ? FAI.light : W, fade(a, 8)); });
      const a = t - lastOf(r);
      if (a >= 0) for (let q = 0; q < 3; q++) { const b = (a + q * 6) % 18; px(bx + 4, by + 3 + b * 0.7, FAI.light, L); }
    },
  },

  // Peal Out: a great bellflower grows beside Faience and peals, four bells sweep through every foe, and rings of glaze roll out in the glare.
  faience_peal: {
    lead: 14, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = beside(r.from), L = hold(t, 0, leaveOf(r) + 8, 4), sw = Math.sin(t * 0.4);
      fbell(B.x, B.y + 2, sw, L, 2);
      if (t < leaveOf(r) + 4) ting(B.x, B.y + 5, t % 12, 2, 12, 1.2);
    },
    front(r) {
      flying(r, p => { fbell(p.x, p.y, Math.sin(p.a * 0.9)); px(p.x - p.ux * 4, p.y - 1, FAI.light, 0.5); });
      landed(r, 20, (E, a, i) => { ting(E.x, E.y, hs(a, 4), 3, 16, 1.4); if (i % 4 === 0) sparks(E.x, E.y, hs(a, 4), 8, r.seed + i, W, FAI.yellow, 10, 1.2); });
    },
    scene(r) { return jolt(r, 10, 2); },
    lights(r) { return r.to.map(E => ({ x: Math.round(E.x), y: Math.round(E.y), r: 12, lv: 1.4 * hold(r.t, hitOf(r) - 2, hitOf(r) + 14, 4), tint: FAI.light })); },
  },

  // ---------------- Serrari
  // Gnash Bite: three teeth close on the foe from round it, the rows mesh as each one lands, and blood runs.
  denticle_bite: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, SER.bone, SER.red);
      flying(r, p => tooth(p.x, p.y, p.y > p.E.y));
      landed(r, 8, (E, a, i) => { mesh(E.x, E.y, 2, Math.max(0, 3 - hs(a)), fade(a, 8)); sparks(E.x, E.y, hs(a), 4, r.seed + i, W, SER.red, 8, 0.7); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) blood(E.x, E.y + 1, a, 5, r.seed, r.end - hitOf(r));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // All Teeth: three teeth circle Serrari and set round it, two rows of teeth bared above and below it.
  denticle_teeth: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), n = landedN(r), L = hold(t, hitOf(r), r.end, 4);
      flying(r, p => { const g = p.u * Math.PI * 4 + p.i * Math.PI * 2 / 3, rr = 11 - p.u * 4; tooth(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.6, Math.sin(g) > 0); });
      if (n) mesh(U.x, U.y, n, 6, L);
      landed(r, 8, (E, a) => sparks(U.x, U.y - 7, a, 5, r.seed + a, W, SER.red, 8, 0.7));
    },
  },

  // Overbite: a great upper row of teeth swings down over the foe and bites past the lower one, and blood runs back to heal Serrari.
  denticle_overbite: {
    noLandings: true,
    front(r) {
      smear(r, SER.bone, SER.red);
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit, L = hold(t, hit - 6, hit + 12, 3);
      if (L > 0) {
        const c = ease(a < 0 ? prog(t, hit - 6, hit) : 1 - prog(a, 6, 12));
        for (let q = -1; q <= 1; q++) tooth(E.x + q * 5, E.y - 12 + 9 * c, false, L);
        for (let q = 0; q < 2; q++) tooth(E.x - 2.5 + q * 5, E.y + 9 - 3 * c, true, L);
      }
      if (a >= 0) { blood(E.x, E.y + 2, a, 4, r.seed, 18); motes(r.from.x, r.from.y, a - 6, 4, r.seed, [SER.red, SER.pale], 16, 4); }
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // Lockjaw: Serrari bares every tooth, dashes in, four teeth close from round the foe, and the jaws lock shut on its feet and stay.
  denticle_lockjaw: {
    lead: 10, tail: 8, noFlights: true, noLandings: true,
    back(r) { if (r.t < 12) mesh(r.from.x, r.from.y, 3, 6, hold(r.t, 0, 12, 3)); },
    front(r) {
      smear(r, SER.bone, SER.red);
      flying(r, p => tooth(p.x, p.y, p.y > p.E.y));
      const t = r.t, n = landedN(r), E = aim(r), a = t - hitOf(r), L = fade(a, r.end - hitOf(r), 6);
      if (n) { mesh(E.x, E.y + 4, 3, Math.max(0, 4 - n), L); if (n >= 4) ring(E.x, E.y + 6, 9, SER.red, L * ((t >> 2) & 1 ? 1 : 0.5)); }
      landed(r, 10, (P, b, i) => sparks(P.x, P.y + 3, hs(b), 5, r.seed + i, W, SER.red, 8));
      if (a >= 0) blood(E.x, E.y + 2, a, 6, r.seed, r.end - hitOf(r));
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Rakoma
  // Gap Sphere: a ball of the gap's dark flies at the foe, and two teeth spring up round it with the void opening between them.
  diastema_null: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => gapAt(E.x, E.y + 6, Math.round(Math.min(1, (a + 1) / 3) * 13), Math.round(6 + 4 * (1 - prog(a, 8, 18))), fade(a, 18))); },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2, 2, RAK.deep, 1); arc(p.x, p.y, 3, 3, RAK.violet, 1); px(p.x - 1, p.y - 1, RAK.white, 1); tail(p.x, p.y, p.ux, p.uy, [RAK.violet, RAK.dark], 1); });
      landed(r, 14, (E, a) => {
        if (a < 3) line(E.x - 6, E.y - 6, E.x + 6, E.y + 6, W, 1);
        for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + a * 0.4, d = 9 * (1 - a / 14); px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, q % 2 ? RAK.violet : RAK.white, fade(a, 14)); }
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Slip Blade: two teeth close in round Rakoma, and a thin violet blade slides up out of the gap between them and hangs ready.
  diastema_slip: {
    tail: 12, noLandings: true,
    back(r) { const t = r.t, U = r.from, u = ease(prog(t, 0, hitOf(r))); gapAt(U.x, U.y + 6, 13, Math.round(22 - 12 * u), hold(t, 0, r.end, 4)); },
    front(r) {
      const t = r.t, a = t - hitOf(r), U = r.from;
      if (a < 0) return;
      const y = U.y - 5 - Math.min(6, a), L = hold(t, hitOf(r), r.end, 4);
      line(U.x, y, U.x, y + 8, RAK.violet, L); line(U.x + 1, y + 1, U.x + 1, y + 7, RAK.dark, L); px(U.x, y - 1, W, L);
      if (a < 6) glint(U.x, y, RAK.violet, 1 - a / 6);
    },
  },

  // Get Between: a violet wedge flies past the foe and drives in behind it, two teeth standing between the foe and its bench.
  diastema_close: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, r.end, (E, a) => gapAt(E.x + (high(E) ? 9 : -9), E.y + 6, Math.round(Math.min(1, (a + 1) / 3) * 12), 2, fade(a, r.end - hitOf(r), 6))); },
    front(r) {
      flying(r, p => { const k = 6, s = 3; line(p.x, p.y, p.x - p.ux * k - p.uy * s, p.y - p.uy * k + p.ux * s, RAK.violet, 1); line(p.x, p.y, p.x - p.ux * k + p.uy * s, p.y - p.uy * k - p.ux * s, RAK.violet, 1); line(p.x, p.y, p.x - p.ux * k, p.y - p.uy * k, RAK.dark, 1); px(p.x, p.y, W, 1); });
      landed(r, 18, (E, a) => { for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 - a * 0.35, d = 10 * (1 - a / 18) + 2; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.6, q % 2 ? RAK.violet : '#8ab0e0', fade(a, 18)); } });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Wider: Rakoma dashes in, three dark balls close on the foe, and with each the gap round the foe opens wider.
  diastema_wider: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), n = landedN(r), h0 = n ? r.hits[n - 1].at : 0;
      gapAt(E.x, E.y + 6, Math.round(4 + 12 * ease(prog(t, 0, 10))), 6 + n * 5 + (n && t - h0 < 2 ? 2 : 0), hold(t, 0, r.end, 6));
    },
    front(r) {
      smear(r, RAK.violet, RAK.dark);
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, RAK.deep, 1); arc(p.x, p.y, 2, 2, RAK.violet, 1); });
      landed(r, 10, (E, a, i) => { sparks(E.x, E.y, hs(a), 6, r.seed + i, RAK.white, RAK.violet, 10); if (a < 3) arc(E.x, E.y, 6 + i * 2, 5 + i, W, 1); });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Makimen
  // Claw Roll: Makimen rolls up tight as it spins, then unrolls into three hooked cuts across the foe, and blood runs.
  furl_lash: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r);
      if (t < hit + 2) curl(U.x, U.y, 7, t * 0.6, hold(t, 0, hit + 2, 2), prog(t, hit - 3, hit + 2), face(r.from));
      landed(r, 14, (E, a) => {
        for (let q = 0; q < 3; q++) { const b = a - q * 2; if (b < 0) continue; const n = Math.min(1, (b + 1) / 3); arc(E.x + (q - 1) * 4, E.y - 1, 4, 6, q === 1 ? MAK.light : MAK.pale, fade(a, 14), 0.62, 0.62 + 0.4 * n); px(E.x + (q - 1) * 4 - 2, E.y + 5, MAK.maroon, fade(a, 14)); }
        blood(E.x, E.y + 2, a - 3, 3, r.seed, 11);
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Roll Tight: Makimen rolls in on itself layer over layer until two thick rolls ring it as a shield.
  furl_tight: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 4), u = prog(t, 0, lastOf(r));
      curl(U.x, U.y, 12 - 4 * u, -t * 0.5, L * (1 - prog(t, lastOf(r), lastOf(r) + 6)));
    },
    front(r) {
      const t = r.t, U = userAt(r), n = landedN(r), L = hold(t, hitOf(r), r.end, 4);
      for (let q = 0; q < n; q++) { arc(U.x, U.y + 1, 7 + q * 2, 5 + q * 2, q ? MAK.pink : MAK.pale, L, 0, 0.5); arc(U.x, U.y + 2, 7 + q * 2, 5 + q * 2, MAK.maroon, L, 0.05, 0.45); }
      landed(r, 8, (E, a) => sparks(U.x, U.y, a, 6, r.seed + a, MAK.light, MAK.pink, 8, 0.9));
    },
  },

  // Whip Out: a strip of lip unrolls out of Makimen like a whip, cracks wet on the foe twice, and Makimen rolls up and away.
  furl_whip: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      flying(r, p => { if (p.i) return; const n = 12; for (let k = 0; k <= n; k++) { const u = k / n, x = U.x + (p.x - U.x) * u, y = U.y + (p.y - U.y) * u + Math.sin(u * 9 - t) * 2 * (1 - u); px(x, y, k % 3 ? MAK.pale : MAK.pink, 1); } curl(p.x, p.y, 2.5, t, 1); });
      landed(r, 14, (E, a, i) => { if (a < 3) { line(E.x - 5, E.y - 3 + i * 3, E.x + 5, E.y - 1 + i * 3, W, 1); } for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5, vy = -1.3 - hash(r.seed + q + i) * 0.8; px(E.x + vx * a, E.y + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : MAK.light, fade(a, 14)); } });
      const a = t - lastOf(r);
      if (a >= 0 && a < 16) curl(U.x - face(r.from) * a * 0.8, U.y + 2, 4, -a * 0.8, fade(a, 16));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Unroll: a great spiral winds up beside Makimen, then unrolls into curled ribbons that spiral out and open over every foe in a bloom of curls.
  furl_unroll: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = beside(r.from), go = leaveOf(r);
      curl(B.x, B.y, 11, t * 0.35, hold(t, 0, go + 6, 4), prog(t, go - 4, go + 6), face(r.from));
    },
    front(r) {
      flying(r, p => curl(p.x, p.y, 3, r.t * 0.7 + p.i, 1));
      landed(r, 20, (E, a, i) => {
        if (a < 5) { const n = Math.min(1, (a + 1) / 3); line(E.x + 6, E.y - 6, E.x + 6 - 12 * n, E.y - 6 + 12 * n, MAK.light, 1); }
        if (i % 6 === 0) for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2, d = 3 + hs(a, 4) * 0.5; curl(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, 3.5, g + a * 0.2, fade(a, 20), prog(a, 4, 14)); }
      });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Tardas
  // Catch Up: a silver orb flies with its purple echo three steps behind, and a gilded ring settles under the foe with three ticks.
  laggard_catchup: {
    noFlights: true, noLandings: true,
    back(r) {
      landed(r, r.end, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 5);
        arc(E.x, E.y + 6, 8, 2.5, TAR.gold, L);
        for (let q = 0; q < 3; q++) if (a > 2 + q * 2) px(E.x - 4 + q * 4, E.y + 3, TAR.gold, L);
      });
    },
    front(r) {
      flying(r, p => echo(p.x, p.y, 2, 0.75), undefined, 6);
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, TAR.silver, 1); px(p.x - 1, p.y - 1, W, 1); tail(p.x, p.y, p.ux, p.uy, [TAR.silver, TAR.glass]); });
      landed(r, 10, (E, a) => { sparks(E.x, E.y, hs(a), 5, r.seed, W, TAR.silver, 8); const b = a - 6; if (b >= 0) ring(E.x, E.y, 2 + b, TAR.light, fade(b, 4)); });
    },
  },

  // Fall Behind: Tardas steps back into its mirror, three silver orbs weave out trailed by late echoes, and gilded rings close on every foe.
  laggard_behind: {
    noFlights: true, noLandings: true,
    back(r) { const U = r.from; gilt(U.x, U.y, 6, 8, hold(r.t, 0, r.contact + 8, 4)); },
    front(r) {
      flying(r, p => echo(p.x, p.y, 2, 0.75), undefined, 5);
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, TAR.silver, 1); px(p.x, p.y, W, 1); });
      landed(r, 14, (E, a) => { const rr = 10 - hs(a) * 0.5; arc(E.x, E.y, rr, rr * 0.8, TAR.gold, fade(a, 14)); const b = a - 5; if (b >= 0) arc(E.x, E.y, rr + 1, rr * 0.8 + 1, TAR.light, fade(b, 9)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Late Ripple: three silver drops fall into a mirror pool under the foe, rings spread from each, and the same rings spread again late.
  laggard_lag: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), L = hold(t, leaveOf(r), r.end, 5);
      oval(E.x, E.y + 6, 10, 2, TAR.glass, 0.5 * L); arc(E.x, E.y + 6, 11, 2.5, TAR.gold, L);
      landed(r, 20, (P, a, i) => { const b = hs(a); arc(P.x + (i - 1) * 3, P.y + 6, 2 + b * 0.5, 0.8 + b * 0.12, TAR.silver, fade(a, 12)); const c = a - 8; if (c >= 0) arc(P.x + (i - 1) * 3, P.y + 6, 2 + c * 0.5, 0.8 + c * 0.12, TAR.light, fade(c, 12)); });
    },
    front(r) { flying(r, p => blit(SEI_DROP, p.x, p.y, { f: W, g: TAR.silver, d: TAR.purple }, 1)); },
  },

  // Mirror Back: a tall gilded mirror stands beside Tardas, two orbs go out to the foe and back into it, and the mirror throws the move again.
  laggard_mirror: {
    lead: 16, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = beside(r.from), L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12));
      gilt(B.x, B.y + 2, 2 + 3 * g, 3 + 5 * g, L);
      landed(r, r.end, (E, a) => { const k = fade(a, r.end - hitOf(r), 6); arc(E.x, E.y + 6, 11, 3, TAR.gold, k); arc(E.x, E.y + 6, 9, 2, TAR.light, k * ((a >> 2) & 1 ? 1 : 0.5)); });
    },
    front(r) {
      flying(r, p => echo(p.x, p.y, 3, 0.75), undefined, 5);
      flying(r, p => { oval(p.x, p.y, 2, 2, TAR.silver, 1); arc(p.x, p.y, 2, 2, TAR.gold, 1); px(p.x, p.y, W, 1); });
      landed(r, 16, (E, a) => { if (a < 4) gilt(E.x, E.y, 7, 9, 1 - a / 4); sparks(E.x, E.y, hs(a, 5), 8, r.seed, W, TAR.gold, 12); });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Tain
  // Backing: a pane of silver flies to the foe, shows it in blue, and comes back carrying what it showed.
  tain_backing: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { pane(p.x, p.y, 4, 6, p.u, 1); if (p.u > 0.5) { px(p.x, p.y - 1, TAI.blue, 1); px(p.x, p.y + 1, TAI.blue, 1); } });
      landed(r, 10, (E, a) => { const L = fade(a, 10); line(E.x - 5, E.y - 5, E.x + 5, E.y - 5, TAI.blue, L); line(E.x - 5, E.y + 5, E.x + 5, E.y + 5, TAI.blue, L); line(E.x - 5, E.y - 5, E.x - 5, E.y + 5, TAI.light, L); line(E.x + 5, E.y - 5, E.x + 5, E.y + 5, TAI.light, L); if (a < 3) oval(E.x, E.y, 3, 3, W, 0.5); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Silvering: a line of stars runs to the foe, and a sheet of silver rises in front of it with its sheen sliding: Silver Glass.
  tain_blank: {
    tail: 10, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, S = r.from, E = aim(r), go = leaveOf(r), hit = hitOf(r), on = hold(t, go, hit + 8, 2);
      if (on > 0) for (let q = 1; q <= 5; q++) { const u = q / 6 * Math.min(1, (t - go + 1) / 3); glint(S.x + (E.x - S.x) * u, S.y + (E.y - S.y) * u, TAI.light, on); }
      const a = t - hit;
      if (a >= 0) { const P = { x: E.x - face(E) * 8, y: E.y }, h = Math.round(Math.min(1, (a + 1) / 4) * 12); pane(P.x, P.y + 6 - h / 2, 4, h, (a * 0.04) % 1, fade(a, r.end - hit, 6)); sparks(E.x, E.y, hs(a), 6, r.seed, W, TAI.light, 8); }
    },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 10, lv: 1.2 * hold(r.t, hitOf(r), r.end, 4), tint: TAI.light }]; },
  },

  // Tarnish: a sheet of silver stands behind Tain and tarnishes from the bottom up, dark wisps curling off it.
  tain_tarnish: {
    tail: 6, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 5), k = prog(t, 2, hitOf(r) + 6);
      pane(U.x, U.y - 2, 13, 14, t * 0.03, L, k);
      landed(r, r.end, (E, a) => { for (let q = 0; q < 3; q++) { const b = (a + q * 6) % 18; dither(U.x - 5 + q * 5 + Math.round(Math.sin((b + q) / 3)), U.y - 9 - b * 0.6, 2, 2, TAI.violet, fade(b, 18, 8) * L); } });
    },
  },

  // Empty Swap: a pane stands before Tain and another before the foe, two orbs cross between them, and each pane flashes with the other's outline.
  tain_empty: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, E = aim(r), L = hold(t, 0, r.end, 6), h = Math.round(4 + 10 * ease(prog(t, 0, 12)));
      for (const P of [U, E]) pane(P.x + face(P) * 9, P.y + 6 - h / 2, 4, h, t * 0.03, L);
    },
    front(r) {
      const S = r.from;
      flying(r, p => { const k = p.i % 2 ? 1 - p.u : p.u, x = S.x + (p.E.x - S.x) * k, y = S.y + (p.E.y - S.y) * k - Math.sin(Math.PI * k) * 6 * (p.i % 2 ? -1 : 1); oval(x, y, 2, 2, p.i % 2 ? TAI.blue : TAI.silver, 1); px(x, y, W, 1); }, 'line');
      landed(r, 16, (E, a) => {
        for (const P of [S, E]) { const L = fade(a, 16); arc(P.x, P.y, 6, 6, TAI.light, L * ((a >> 1) & 1 ? 1 : 0.5)); }
        if (a < 3) for (const P of [S, E]) oval(P.x, P.y, 4, 4, W, 0.5);
      });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Daz
  // Dome Shine: a crescent of shine slides across the dark and glares on the foe, twinkling.
  luster_shine: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { dome(p.x, p.y, 4, r.t); tail(p.x - 2, p.y - 2, p.ux, p.uy, [DAZ.white, DAZ.gold, DAZ.purple]); });
      landed(r, 18, (E, a) => {
        if (a < 6) dome(E.x, E.y + 2, 9 - a, a);
        for (let q = 0; q < 4; q++) { const ph = (a + q * 3) % 8; if (ph < 4 && a > 3) glint(E.x + [-7, 6, -4, 7][q], E.y + [-5, -3, 5, 4][q], DAZ.gold, fade(a, 18)); }
      });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Drowse: a dim crescent lobs over and settles over the foe's head, swaying slowly in a purple hush.
  luster_drowse: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => dome(p.x, p.y, 3, 0, 0.75));
      const t = r.t, a = t - hitOf(r), E = aim(r);
      if (a >= 0) {
        const L = fade(a, r.end - hitOf(r), 6), sw = Math.round(Math.sin(a / 5) * 2);
        oval(E.x, E.y - 1, 7, 6, DAZ.purple, 0.25 * L);
        dome(E.x + sw, E.y - 4, 4, 0, L);
        for (let q = 0; q < 2; q++) if (((a >> 3) + q) & 1) px(E.x - 5 + q * 10, E.y - 9 + q, DAZ.gold, L);
      }
    },
  },

  // Lamp Out: three sparks fly at a lamp flame over the foe, each snuffs it lower, and a gold padlock closes on it in the dark.
  luster_long: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = landedN(r), x = E.x, y = E.y - (high(E) ? 8 : 11), L = hold(t, 0, r.end, 4);
      if (n < 3) { const h = 3 - n; oval(x, y - 1 - h, 1, h, DAZ.gold, L); px(x, y - 1 - h * 0.5, DAZ.white, L); px(x, y - 2 - h * 2 + ((t >> 1) & 1), DAZ.white, L); }
      blit(['ddddd', '.ddd.'], x, y + 1, { d: '#c89030' }, L);
      flying(r, p => { px(p.x, p.y, W, 1); tail(p.x, p.y, p.ux, p.uy, [DAZ.gold, DAZ.purple]); });
      landed(r, 8, (P, a) => sparks(x, y, a, 4, r.seed + a, DAZ.white, DAZ.gold, 6, 0.6));
      const a = t - lastOf(r);
      if (a >= 0) { const k = fade(a, r.end - lastOf(r)); blit(['.ggg.', 'g...g', 'ddddd', 'ddkdd', 'ddddd'], x + 6, y + 1, { g: DAZ.gold, d: '#c89030', k: DAZ.night }, k); for (let q = 0; q < 2; q++) px(x + Math.sin((a + q * 4) / 3), y - 2 - (a + q * 4) % 10 * 0.6, '#5a5466', k); }
    },
  },

  // Glare Off: the night deepens, a great shine swells on Daz's dome, and a broad beam of it glares the foe white.
  luster_glare: {
    lead: 18, tail: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = beside(r.from), L = hold(t, 0, r.end, 6);
      wash(DAZ.night, 0.25 * L);
      dome(B.x, B.y + 4, 3 + 6 * ease(prog(t, 0, leaveOf(r))), t, hold(t, 0, hitOf(r) + 10, 4));
    },
    front(r) {
      const t = r.t, B = beside(r.from), E = aim(r), on = hold(t, leaveOf(r), hitOf(r) + 10, 2);
      if (on > 0) { const P = { x: B.x, y: B.y }; thick(P.x, P.y, E.x, E.y, W, on, DAZ.white); line(P.x + 2, P.y + 1, E.x + 2, E.y + 1, DAZ.gold, on); line(P.x - 2, P.y - 1, E.x - 2, E.y - 1, DAZ.gold, on); line(P.x + 3, P.y + 2, E.x + 3, E.y + 2, DAZ.purple, on * 0.5); line(P.x - 3, P.y - 2, E.x - 3, E.y - 2, DAZ.purple, on * 0.5); }
      landed(r, 14, (P, a) => { if (a < 6) { oval(P.x, P.y, 6, 5, W, 0.5); arc(P.x, P.y, 7 + a * 0.5, 6 + a * 0.5, W, 1); arc(P.x, P.y, 8 + a * 0.5, 7 + a * 0.5, DAZ.gold, 1); } sparks(P.x, P.y, hs(a, 5), 10, r.seed, W, DAZ.gold, 14, 1.3); });
    },
    scene(r) { return jolt(r, 10, 2); },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 14, lv: 1.8 * hold(r.t, hitOf(r) - 2, hitOf(r) + 10, 3), tint: DAZ.white }]; },
  },

  // ---------------- Tulimuji
  // Round: three small whirls corkscrew to the foe, and each spins out a ring of water round it and leaves a Flux swirl.
  gyre_round: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => funnel(p.x, p.y + 3, 6, 3, r.t + p.i * 3));
      landed(r, 14, (E, a, i) => {
        const b = hs(a);
        for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + b * 0.25 + i, d = 3 + b * 0.8; px(E.x + Math.cos(g) * d, E.y + 1 + Math.sin(g) * d * 0.5, q % 2 ? GYR.pale : W, fade(a, 14)); }
      });
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 0) swirl(E.x, E.y - 8, r.t, fade(a, r.end - lastOf(r)));
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Whirl In: wisps of wind circle Tulimuji, then a funnel stands up round the foe and grows with each one, spinning its side round.
  gyre_whirlin: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), E = aim(r); if (n) funnel(E.x, E.y + 6, 8 + n * 3, 3 + n, r.t, fade(r.t - hitOf(r), r.end - hitOf(r), 6)); },
    front(r) {
      flying(r, p => { const P = { x: p.x, y: p.y }; arc(P.x, P.y, 3, 1.5, GYR.pale, 1, r.t * 0.1, r.t * 0.1 + 0.5); px(P.x, P.y, W, 1); });
      const n = landedN(r), E = aim(r);
      if (n) arc(E.x, E.y + 5, 3 + n * 1.5, 1 + n * 0.4, GYR.blue, fade(r.t - hitOf(r), r.end - hitOf(r), 6), 0, 0.5);
      landed(r, 6, (P, a) => sparks(P.x, P.y, a, 4, r.seed + a, W, GYR.pale, 6, 0.8));
    },
  },

  // Dust Devil: little whirls of sand corkscrew out, and a dust devil stands up on every foe, flinging grit, with a Flux swirl over it.
  gyre_gather: {
    noFlights: true, noLandings: true,
    back(r) { r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) funnel(E.x, E.y + 6, 13, 5, r.t, fade(a, r.end - hitAt(r, j), 6), GYR.sand, GYR.dust); }); },
    front(r) {
      flying(r, p => { funnel(p.x, p.y + 2, 5, 2, r.t + p.i * 2, 1, GYR.sand, GYR.dust); px(p.x, p.y - 2, '#f0e0c0', 1); });
      landed(r, 16, (E, a, i) => { if (i < r.to.length) chunks(E.x, E.y, a, 6, r.seed + i, [GYR.sand, GYR.dust], 16, 1.2); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 4) swirl(E.x, E.y - 10, r.t, fade(a, r.end - hitAt(r, j)), GYR.sand); });
    },
  },

  // Auger Warp: a tall funnel in the auger shell's shape stands over Tulimuji and spins faster and faster, and rings of water burst as the ally comes through.
  gyre_auger: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; funnel(U.x, U.y + 6, 6 + 16 * ease(prog(t, 0, 14)), 4 + 4 * ease(prog(t, 0, 14)), t * (1 + prog(t, 0, hitOf(r))), hold(t, 0, lastOf(r) + 4, 4)); },
    front(r) {
      flying(r, p => { arc(p.x, p.y, 2, 2, GYR.pale, 1); px(p.x, p.y, W, 1); });
      landed(r, 18, (E, a, i) => { ring(E.x, E.y + 3, 3 + a * 0.8, i % 2 ? GYR.blue : GYR.pale, fade(a, 18)); if (i === 0) motes(E.x, E.y, a, 6, r.seed, [W, GYR.pale], 18, 6); });
    },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y) - 6, r: 12, lv: 1.2 * hold(r.t, 0, r.end, 6), tint: GYR.blue }]; },
  },

  // ---------------- Kokala
  // Encrust: three flakes of lichen lob onto the foe, a crust of rosettes spreads over it with each, and orange drips run.
  lichen_encrust: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => flake(p.x, p.y));
      const t = r.t, n = landedN(r), E = aim(r), a = t - hitOf(r);
      if (n) crust(E.x, E.y + 1, 6, n * 5, r.seed, Math.min(1, 0.4 + n * 0.2 + prog(t, lastOf(r), lastOf(r) + 8) * 0.2), fade(a, r.end - hitOf(r), 6));
      landed(r, 14, (P, b, i) => { for (let q = 0; q < 2; q++) { const c = b - q * 4; if (c >= 0) px(P.x - 2 + q * 4 + i, P.y + 2 + c * 0.5, LIC.orange, fade(c, 10)); } });
    },
  },

  // Lichen Feed: threads of lichen climb up round every foe's feet, a crust binds them there, and sage motes run home to feed Kokala.
  lichen_feed: {
    noFlights: true, noLandings: true,
    back(r) {
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6); crust(E.x, E.y + 6, 9, 14, r.seed + j, Math.min(1, (a + 2) / 8), L); } });
    },
    front(r) {
      flying(r, p => { for (let k = 0; k < 6 * p.u + 1; k++) px(p.x + Math.round(Math.sin((r.t + k * 2) / 3)), p.E.y + 6 - k, k % 3 ? LIC.sage : LIC.orange, 1); });
      landed(r, 16, (E, a, i) => { if (i === 0) motes(r.from.x, r.from.y, a - 4, 4, r.seed, [LIC.sage, LIC.pale], 12, 4); });
    },
  },

  // Cling Fang: two crusted stone fangs close on the foe from either side, and lichen stays where they bit.
  lichen_cling: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, LIC.sage, LIC.olive);
      flying(r, p => { blit(['ooooo', '.oso.', '.oo.', '..o.'], p.x, p.y, { o: LIC.olive, s: LIC.sage }, 1, 1, p.x > p.E.x, p.y > p.E.y); px(p.x, p.y - 1, LIC.orange, 1); });
      landed(r, 12, (E, a, i) => { const s = i ? 1 : -1, x = E.x + s * Math.max(2, 5 - hs(a)); oval(x, E.y, 2, 5, LIC.olive, fade(a, 12)); arc(x, E.y, 2, 5, LIC.sage, fade(a, 12)); sparks(E.x, E.y, hs(a), 4, r.seed + i, LIC.pale, LIC.orange, 8); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) crust(E.x, E.y, 5, 8, r.seed, 1, fade(a, r.end - hitOf(r), 6));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Stone Crust: lichen creeps over the ground from Kokala to the foe, four crusted stones close on it, and set round it in a shell of stone.
  lichen_crust: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), L = hold(t, 0, r.end, 6), u = ease(prog(t, 0, 16));
      for (let q = 0; q < 10; q++) { const k = q / 9; if (k > u) break; crust(S.x + (E.x - S.x) * k, S.y + 6 + (E.y - S.y) * k, 2, 3, r.seed + q, 1, L * 0.75); }
      const a = t - hitOf(r);
      if (a >= 0) { const reach = Math.min(10, 3 + a); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, LIC.orange, fade(a, r.end - hitOf(r), 6)); line(E.x - reach, E.y + 7, E.x + reach, E.y + 7, LIC.olive, fade(a, r.end - hitOf(r), 6)); }
    },
    front(r) {
      flying(r, p => { blit(['.oo.', 'osoo', 'oooo', '.oo.'], p.x, p.y, { o: '#7a7a68', s: LIC.sage }, 1); px(p.x + 1, p.y - 1, LIC.orange, 1); });
      const t = r.t, n = landedN(r), E = aim(r), L = fade(t - hitOf(r), r.end - hitOf(r), 6);
      for (let q = 0; q < n; q++) { arc(E.x, E.y, 7, 7, '#7a7a68', L, q * 0.25 - 0.1, q * 0.25 + 0.15); arc(E.x, E.y, 8, 8, LIC.sage, L * 0.75, q * 0.25 - 0.1, q * 0.25 + 0.15); }
      landed(r, 16, (P, a, i) => { if (i === r.hits.length - 1) for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2, d = 4 + hs(a, 5) * 0.7; flake(P.x + Math.cos(g) * d, P.y + Math.sin(g) * d * 0.7, fade(a, 16)); } chunks(P.x, P.y, hs(a), 4, r.seed + i, ['#7a7a68', LIC.sage], 12); });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Maineri
  // Swell Up: a swell rises under every foe as the drops weave in, lifts it, and sets it down in a splash.
  groundswell_swell: {
    noFlights: true, noLandings: true,
    back(r) {
      r.to.forEach((E, j) => {
        const mine = r.hits.filter(h => h.to === j), n = mine.filter(h => r.t >= h.at).length, last = mine.length ? mine[mine.length - 1].at : hitOf(r), a = r.t - last;
        const h = a < 0 ? 1 + n * 1.5 : Math.round((1 + n * 1.5) * (1 - prog(a, 2, 8)));
        swellAt(E.x, E.y + 6, 11, h, r.t, hold(r.t, 0, r.end, 4));
      });
    },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: MAI.foam, g: MAI.teal, d: MAI.deep }, 1));
      r.to.forEach((E, j) => { const mine = r.hits.filter(h => h.to === j), last = mine.length ? mine[mine.length - 1].at : hitOf(r), a = r.t - last; if (a >= 2 && a < 16) for (let q = 0; q < 6; q++) { const b = a - 2, vx = (q - 2.5) * 0.6; px(E.x + vx * b, E.y + 5 - (1.6 + (q % 2) * 0.6) * b + 0.12 * b * b, q % 2 ? MAI.foam : W, fade(b, 14)); } });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Lift Dome: bubbles rise beside Maineri and swell into a Water Dome, a little higher with each one.
  groundswell_lift: {
    noFlights: true, noLandings: true,
    back(r) { const U = r.from, n = landedN(r); if (n) swellAt(U.x + face(U) * 11, U.y + 6, 4 + n, 3 + n * 2, r.t, hold(r.t, 0, r.end, 4)); },
    front(r) {
      const U = r.from, x = U.x + face(U) * 11;
      flying(r, p => { const y = U.y + 6 - p.u * 10, bx = x - 3 + p.i * 3; arc(bx, y, 1.5, 1.5, MAI.foam, 1); px(bx - 1, y - 1, W, 1); });
      landed(r, 8, (E, a, i) => ring(x, U.y + 6 - 3 - i * 2, 2 + a, MAI.foam, fade(a, 8)));
    },
  },

  // Lift Off: two gobs of the swell lob onto the foe, a swell heaves under it, and its shield plate floats off and over onto Maineri.
  groundswell_turn: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), up = prog(t, leaveOf(r), hitOf(r)), down = prog(t, lastOf(r), lastOf(r) + 8); swellAt(E.x, E.y + 6, 10, Math.round(1 + 4 * up * (1 - down)), t, hold(t, 0, r.end, 4)); },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2, 1.5, MAI.teal, 1); px(p.x, p.y - 1, MAI.foam, 1); px(p.x - 1, p.y - 1, W, 1); });
      landed(r, 10, (E, a) => sparks(E.x, E.y, hs(a), 5, r.seed + a, W, MAI.foam, 8));
      const t = r.t, E = aim(r), U = r.from, u = ease(prog(t, hitOf(r), r.end - 8));
      if (t >= hitOf(r)) { const x = E.x + (U.x - E.x) * u, y = E.y - 8 + (U.y - 8 - E.y + 8) * u - Math.sin(Math.PI * u) * 10; plate(x, y, hold(t, hitOf(r), r.end, 4)); }
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Spring High: a great swell lifts every foe high and holds it there, then drops it, and foam rings run out over the field.
  groundswell_spring: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, last = lastOf(r), L = hold(t, 0, r.end, 6);
      r.to.forEach(E => { const up = ease(prog(t, 0, hitOf(r))), drop = prog(t, last, last + 4); swellAt(E.x, E.y + 6, 14, Math.round(2 + 9 * up * (1 - drop)), t, L); if (t >= last) bands(E.x - 14, 29, E.y + 5, [[MAI.foam, 1], [MAI.teal, 1]], fade(t - last, r.end - last, 8)); });
    },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: MAI.foam, g: MAI.teal, d: MAI.deep }, 1));
      const a = r.t - lastOf(r);
      if (a >= 0) r.to.forEach(E => { for (let q = 0; q < 3; q++) { const b = a - q * 3; if (b >= 0 && b < 16) ring(E.x, E.y + 5, 4 + b * 1.1, q % 2 ? MAI.light : MAI.foam, fade(b, 16)); } chunks(E.x, E.y + 3, hs(a, 4), 8, r.seed, [MAI.foam, W, MAI.light], 18, 1.2); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 2) }; },
  },

  // ---------------- Hakutu
  // Chalk Toss: a cloud of chalk sweeps through every foe and leaves a white handprint on each.
  chalk_toss: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2.5, 2, CHA.white, 0.75); px(p.x + 1, p.y - 1, W, 1); px(p.x - 3, p.y + 1, CHA.lav, 0.5); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { chalkPuff(E.x, E.y + 3, a, 14); handprint(E.x + 1, E.y, fade(a, r.end - hitAt(r, j), 6) * (a < 3 ? 1 : 0.75), j % 2 === 1); } });
    },
  },

  // Dust Cloud: Hakutu claps, chalk billows up round it into a white cloud, and it is gone inside.
  chalk_dust: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, n = landedN(r), L = hold(t, 0, r.end, 5);
      flying(r, p => chalkPuff(U.x + (p.i - 2.5) * 3, U.y + 4 - p.u * 8, p.a, 12, 0.8));
      if (n) { oval(U.x, U.y, 4 + n, 3 + n * 0.6, CHA.lav, 0.25 * L); oval(U.x, U.y - 1, 2 + n, 2 + n * 0.5, CHA.white, Math.min(0.5, n * 0.1) * L); }
      if (t < 6) for (const s of [-1, 1]) handprint(U.x + s * (6 - t), U.y - 6, 1, s > 0);
    },
  },

  // Climb Over: handprints climb hand over hand up over the foe and down its far side, and chalk streaks rake its bench.
  chalk_climb: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => handprint(p.x, p.y, 1, p.i % 2 === 1));
      for (const f of r.flights) { const a = r.t - f.t0; if (a < 0) continue; for (let k = 1; k <= 2; k++) { const b = Math.min(a, f.dur) - k * 4; if (b <= 0) continue; const u = b / f.dur, E = r.to[f.to] || r.to[0], p = pathAt('arc', u, r.from, E, f.i, f.n, f.to, r.seed); handprint(p.x, p.y, fade(a - k * 4, 18, 8) * 0.5, (f.i + k) % 2 === 1); } }
      landed(r, 12, (E, a, i) => { for (let q = 0; q < 3; q++) { const n = Math.min(1, (hs(a) + 1) / 3); line(E.x - 4 + q * 3, E.y - 5, E.x - 6 + q * 3, E.y - 5 + 10 * n, q === 1 ? W : CHA.white, fade(a, 12)); } chalkPuff(E.x, E.y + 4, a, 12, 0.8); });
    },
  },

  // Clean Hands: Hakutu claps its hands clean in a burst of chalk, dashes in, and cuts the foe with two handprints left on it.
  chalk_hands: {
    lead: 10, tail: 10, noLandings: true,
    front(r) {
      const t = r.t, U = r.from;
      if (t < 10) for (const s of [-1, 1]) handprint(U.x + s * Math.max(0, 7 - t), U.y - 7, 1, s > 0);
      chalkPuff(U.x, U.y - 5, t - 7, 16, 1.4);
      smear(r, CHA.white, CHA.lav);
      landed(r, r.end, (E, a) => {
        if (a < 8) { const n = Math.min(1, (a + 1) / 2); thick(E.x + 7, E.y - 7, E.x + 7 - 14 * n, E.y - 7 + 14 * n, W, fade(a, 8), CHA.lav); }
        const L = fade(a, r.end - hitOf(r), 6);
        handprint(E.x - 3, E.y - 2, L * 0.75); handprint(E.x + 3, E.y + 2, L * 0.75, true);
        for (let q = 0; q < 6; q++) { const g = hash(r.seed + q) * Math.PI * 2, d = 4 + hs(a, 5) * 0.6; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, q % 2 ? CHA.white : CHA.lav, fade(a, 18)); }
      });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Sujiva
  // Rime Strike: two cubes of salt streak in, and at each a white tide line draws across the foe with salt crusting along it.
  saltline_rime: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { blit(['ww', 'wc'], p.x, p.y, { w: SUJ.white, c: SUJ.crust }, 1); if ((r.t >> 1) & 1) px(p.x - 1, p.y - 1, SUJ.gold, 1); tail(p.x, p.y, p.ux, p.uy, [SUJ.crust, SUJ.slate]); });
      landed(r, 16, (E, a, i) => { const n = Math.min(1, (a + 1) / 3), y = E.y + (i ? 2 : -1); tideline(E.x - 8, E.x - 8 + 16 * n, y, fade(a, 16, 6)); for (let q = 0; q < 4; q++) if (a > q * 2) px(E.x - 6 + q * 4, y - 2 - (q % 2), W, fade(a, 16)); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Mark the Wall: three shots of salt, and a white tide line under the foe climbs a step with each, a Rising Line, while a salt rim guards Sujiva.
  saltline_wall: {
    noFlights: true, noLandings: true,
    back(r) {
      const n = landedN(r), E = aim(r), a = r.t - hitOf(r);
      if (n) tideline(E.x - 13, E.x + 13, E.y + 6 - n * 2, fade(a, r.end - hitOf(r), 6));
    },
    front(r) {
      flying(r, p => { blit(['ww', 'wc'], p.x, p.y, { w: SUJ.white, c: SUJ.crust }, 1); tail(p.x, p.y, p.ux, p.uy, [SUJ.crust, SUJ.slate]); });
      landed(r, 8, (E, a) => sparks(E.x, E.y + 4, a, 5, r.seed + a, W, SUJ.crust, 8, 0.8));
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 0) arc(U.x, U.y + 1, 7, 6, SUJ.white, fade(a, r.end - hitOf(r), 6) * ((a >> 2) & 1 ? 1 : 0.5));
    },
  },

  // Wash Line: Sujiva stamps, a wash runs out along the ground, and salt rises beside it into a Salt Post with a gold flag.
  saltline_wash: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, n = landedN(r), a = t - r.contact;
      if (a >= 0 && a < 14) tideline(U.x - 4 - a, U.x + 4 + a, U.y + 6, fade(a, 14));
      if (n) saltPost(x, U.y + 6, 3 + n * 3 + Math.min(2, Math.max(0, t - lastOf(r))), hold(t, 0, r.end, 4));
    },
    front(r) {
      const U = r.from, x = U.x + face(U) * 10;
      flying(r, p => { const y = U.y + 6 - p.u * 12; blit(['ww', 'wc'], x - 2 + (p.i % 3) * 2, y, { w: SUJ.white, c: SUJ.crust }, 1); });
      landed(r, 6, (E, a) => sparks(x, U.y - 4, a, 4, r.seed + a, W, SUJ.gold, 6, 0.6));
    },
  },

  // Spring Line: a spring tide line climbs up the whole field, salt closes on the foe, and salt posts spring up round both whorls so neither can leave.
  saltline_spring: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), y = 58 - 5 * ease(prog(t, 0, 14));
      tideline(0, 95, y, L);
      dither(0, Math.round(y) + 1, 96, 60 - Math.round(y), SUJ.slate, 0.25 * L);
      const a = t - hitOf(r);
      if (a >= 0) for (const P of [r.from, aim(r)]) for (const s of [-1, 1]) saltPost(P.x + s * 8, P.y + 6, Math.round(Math.min(1, (a + 1) / 4) * 9), fade(a, r.end - hitOf(r), 6));
    },
    front(r) {
      smear(r, SUJ.white, SUJ.crust);
      flying(r, p => { blit(['ww', 'wc'], p.x, p.y, { w: SUJ.white, c: SUJ.crust }, 1); if ((r.t + p.i) & 2) px(p.x + 1, p.y - 1, SUJ.gold, 1); });
      landed(r, 18, (E, a, i) => { if (i === 0) for (let q = 0; q < 7; q++) { const g = q / 7 * Math.PI * 2 + 0.3, d = 2 + hs(a, 5) * 0.9; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? SUJ.white : SUJ.crust, fade(a, 18)); } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Kokieri
  // Roll Through: two tumbleweeds bounce across and burst on the foe in dust and twigs, and a wisp of straw goes back to heal.
  tumbleweed_through: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => weed(p.x, p.y - Math.abs(Math.sin(p.u * Math.PI * 3)) * 3, 3, r.t * 0.5 + p.i));
      landed(r, 16, (E, a, i) => { chunks(E.x, E.y, hs(a), 5, r.seed + i, [TUM.tan, TUM.brown, TUM.pale], 14); if (a < 8) oval(E.x, E.y + 4, 3 + a * 0.5, 1.5, TUM.pale, 0.5 * fade(a, 8)); });
      const a = r.t - lastOf(r);
      if (a >= 0) motes(r.from.x, r.from.y, a, 4, r.seed, [TUM.pale, TUM.tan], 14, 4);
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Roll Off With: Kokieri rolls in fast in a spray of sand, snags something of the foe's in its twigs, and rolls home with it.
  tumbleweed_bound: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { if (p.i === 0) weed(p.x, p.y, 4, r.t * 0.8); else for (let q = 0; q < 4; q++) px(p.x - p.ux * q * 2 + (hash(r.seed + q + p.i) - 0.5) * 3, p.y - p.uy * q * 2 + (hash(r.seed + q * 3) - 0.5) * 3, q % 2 ? GYR.sand : TUM.pale, 1); });
      landed(r, 12, (E, a, i) => { if (i === 0) chunks(E.x, E.y + 2, hs(a), 5, r.seed, [TUM.tan, GYR.sand], 12); });
      const t = r.t, E = aim(r), U = r.from, u = ease(prog(t, lastOf(r), r.end - 2));
      if (u > 0 && u < 1) { const x = E.x + (U.x - E.x) * u, y = E.y + (U.y - E.y) * u - Math.abs(Math.sin(u * Math.PI * 2)) * 4; weed(x, y, 4, -t * 0.8); glint(x, y, TUM.pink, 1); }
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Hitch Ride: a small tumbleweed circles Kokieri and hitches onto its back, and a ring of twigs shields the ally coming next.
  tumbleweed_hitch: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      flying(r, p => { const g = p.u * Math.PI * 4, rr = 10 * (1 - p.u * 0.5); weed(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.5, 2.5, t * 0.5); });
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); weed(U.x - face(r.from) * 4, U.y - 6, 2.5, t * 0.2, L); arc(U.x, U.y + 1, 8, 6, TUM.tan, L * (a < 6 ? 1 : 0.5)); if (a < 8) sparks(U.x, U.y, a, 6, r.seed, TUM.pale, TUM.pink, 8); }
    },
  },

  // Round Up: a great tumbleweed rolls a loop round the foes like a lasso, the loop of twigs draws tight, and Kokieri runs off quick.
  tumbleweed_round: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 3; q++) { const len = 3 + ((t >> 2) + q) % 3; line(U.x - face(U) * 6, U.y - 2 + q * 2, U.x - face(U) * (6 + len), U.y - 2 + q * 2, TUM.pale, L); }
    },
    front(r) {
      const t = r.t, E = aim(r), go = leaveOf(r), last = lastOf(r), u = prog(t, go, last);
      if (t >= go && t < last + 2) { const g = u * Math.PI * 2.5 + Math.PI, rx = 14 - 4 * u; weed(E.x + Math.cos(g) * rx, E.y + 2 + Math.sin(g) * rx * 0.4, 4, t * 0.6); for (let k = 1; k < 10; k++) { const h = g - k * 0.25; px(E.x + Math.cos(h) * rx, E.y + 2 + Math.sin(h) * rx * 0.4, k % 2 ? TUM.tan : TUM.brown, k < 6 ? 1 : 0.5); } }
      r.to.forEach((P, j) => { const a = t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6), rr = Math.max(8, 12 - hs(a, 5) * 0.5); arc(P.x, P.y + 2, rr, rr * 0.4, TUM.tan, L); arc(P.x, P.y + 3, rr, rr * 0.4, TUM.brown, L * 0.5); for (let q = 0; q < 3; q++) { const g2 = q / 3 * Math.PI * 2 + a * 0.2; px(P.x + Math.cos(g2) * 5, P.y - 7 + Math.sin(g2) * 1.5, TUM.pink, L); } } });
    },
    scene(r) { return jolt(r, 8, 1); },
  },

  // ---------------- Pordan
  // Stair Tread: Pordan stamps, two treads fly off its stair and slam into the foe in a burst of gold, an ember left glowing.
  riser_tread: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { tread(p.x, p.y); tail(p.x - 2, p.y, p.ux, p.uy, [RIS.gold, RIS.rust]); });
      landed(r, 12, (E, a, i) => { sparks(E.x, E.y, hs(a), 7, r.seed + i, W, RIS.gold, 10, 1.1); chunks(E.x, E.y, hs(a), 3, r.seed + i, [RIS.rust, RIS.gold], 12); });
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 4) for (let q = 0; q < 2; q++) { const b = (a + q * 7) % 14; px(E.x - 2 + q * 4, E.y + 2 - b * 0.5, (b >> 1) & 1 ? RIS.gold : '#f08a30', fade(a, r.end - lastOf(r))); }
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Go Up: stairs climb out of the ground under every foe a tread at a time, and the ground shakes at each.
  riser_goup: {
    noFlights: true, noLandings: true,
    back(r) {
      r.to.forEach((E, j) => { const n = r.hits.filter(h => h.to === j && r.t >= h.at).length; if (n) stairs(E.x - 6, E.y + 7, n, 1, fade(r.t - hitAt(r, j), r.end - hitAt(r, j), 6)); });
    },
    front(r) { landed(r, 10, (E, a, i) => chunks(E.x - 6 + (i % 4) * 3, E.y + 5, a, 3, r.seed + i, [RIS.rust, RIS.gray], 10)); },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 6, 1) }; },
  },

  // Kick Plate: Pordan hops, a stair builds itself beside it three treads up, and its kick plate shines gold.
  riser_kick: {
    tail: 8, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) stairs(U.x + face(U) * 6, U.y + 7, Math.min(3, 1 + (a >> 2)), face(U), fade(a, r.end - hitOf(r), 6)); },
    front(r) {
      const a = r.t - hitOf(r), U = r.from;
      if (a < 0) return;
      const L = fade(a, r.end - hitOf(r), 6);
      line(U.x - 4, U.y + 4, U.x + 4, U.y + 4, RIS.gold, L);
      if (a < 10) glint(U.x - 4 + a, U.y + 4, RIS.gold, 1);
      arc(U.x, U.y + 1, 7, 6, RIS.gold, L * ((a >> 2) & 1 ? 1 : 0.5));
    },
  },

  // Top Flight: a long stair builds beside Pordan up into the sky, and treads come up out of the ground under every foe in bursts of gold and cinders.
  riser_flight: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6);
      stairs(U.x + face(U) * 6, U.y + 7, Math.min(7, 1 + Math.floor(t / 2)), face(U), L);
    },
    front(r) {
      flying(r, p => tread(p.x, p.y));
      landed(r, 20, (E, a, i) => {
        sparks(E.x, E.y, hs(a, 4), 8, r.seed + i, W, RIS.gold, 12, 1.2);
        for (let q = 0; q < 4; q++) { const b = a - q * 2; if (b >= 0 && b < 16) px(E.x + (hash(r.seed + q + i * 5) - 0.5) * 14 + Math.sin(b / 3), E.y + 2 - b * 0.7, (b + q) % 3 ? RIS.gold : '#f08a30', fade(b, 16)); }
      });
      const a = r.t - lastOf(r);
      if (a >= 0) motes(r.from.x, r.from.y, a, 5, r.seed, [RIS.gold, W], 16, 6);
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Coshira
  // Axis Cut: a blade of the spiral post whirls out to the foe, cuts, and whirls back, a blue glint saying it comes again.
  columella_axis: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { const g = p.a * 0.7, c = Math.cos(g) * 4, s = Math.sin(g) * 4; thick(p.x - c, p.y - s, p.x + c, p.y + s, COS.cream, 1, COS.brown); px(p.x + c, p.y + s, W, 1); });
      landed(r, 10, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x - 6, E.y - 5, E.x - 6 + 12 * n, E.y - 5 + 10 * n, W, fade(a, 10), COS.cream); sparks(E.x, E.y, hs(a), 5, r.seed, COS.pale, COS.brown, 8); });
      const a = r.t - (r.flights[0] ? r.flights[0].t0 + r.flights[0].dur : r.end), U = r.from;
      if (a >= 0) glint(U.x + face(U) * 5, U.y - 6, COS.blue, fade(a, r.end - r.t + a + 1));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Post Dash: Coshira dashes in, a slice of its spiral post spins into the foe and cracks the ground, and a blue post mark blinks over it.
  columella_dash: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(10 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, COS.brown, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, COS.cream, fade(a, 18)); }); },
    front(r) {
      smear(r, COS.cream, COS.brown);
      flying(r, p => { oval(p.x, p.y, 3, 3, COS.cream, 1); arc(p.x, p.y, 2, 2, COS.brown, 1, r.t * 0.1, r.t * 0.1 + 0.75); px(p.x, p.y, COS.blue, 1); });
      landed(r, 12, (E, a) => chunks(E.x, E.y + 3, hs(a), 5, r.seed, [COS.cream, COS.brown], 12));
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 2 && (a >> 2) & 1) column(E.x, E.y - 8, 4, 1, 0, fade(a, r.end - hitOf(r)));
    },
    scene(r) { return jolt(r, 5, 1); },
  },

  // Middle Post: Coshira stamps, a tall spiral post rises behind it, and bars of it reach out to either side to share the blows.
  columella_middle: {
    tail: 8, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      if (a < 0) return;
      const L = fade(a, r.end - hitOf(r), 6), h = Math.round((high(U) ? 16 : 22) * Math.min(1, (a + 1) / 5));
      column(U.x, U.y + 6, h, 4, -t * 0.3, L);
      if (a >= 5) { const reach = Math.min(14, (a - 5) * 2); for (const s of [-1, 1]) { line(U.x + s * 3, U.y - 8, U.x + s * (3 + reach), U.y - 8, COS.brown, L); line(U.x + s * 3, U.y - 9, U.x + s * (3 + reach), U.y - 9, COS.cream, L); } }
    },
    front(r) { landed(r, 10, (E, a) => chunks(E.x, E.y + 5, a, 6, r.seed, [COS.cream, COS.brown], 10)); },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Stand Under: a spiral post rises over Coshira's place and holds a lintel up over it, and the ally steps in under the shelter.
  columella_under: {
    lead: 12, tail: 8, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), top = high(U) ? 14 : 20, h = Math.round(top * ease(prog(t, 0, 14)));
      for (const s of [-1, 1]) column(U.x + s * 8, U.y + 6, h, 3, t * 0.2 * s, L);
      if (h >= top - 2) { bands(U.x - 11, 23, U.y + 6 - h - 2, [[COS.blue, 1], [COS.cream, 2], [COS.brown, 1]], L); }
    },
    front(r) { landed(r, 16, (E, a) => { ring(E.x, E.y + 3, 4 + a * 0.6, COS.blue, fade(a, 16)); motes(E.x, E.y, a, 5, r.seed, [COS.pale, COS.blue], 16, 6); }); },
  },

  // ---------------- Tegaote
  // Fingertip: a pink hold flies off the wall into the foe and knocks it flat, the ground cracking purple under it.
  crimp_tip: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, CRI.purple, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, CRI.pink, fade(a, 18)); }); },
    front(r) {
      flying(r, p => { grip(p.x, p.y); tail(p.x, p.y, p.ux, p.uy, [CRI.light, CRI.pink, CRI.purple]); });
      landed(r, 14, (E, a) => { chunks(E.x, E.y, hs(a), 5, r.seed, [CRI.pink, CRI.yellow], 12); if (a >= 3 && a < 12) { const y = E.y - 10 + ((a >> 1) & 1); line(E.x, y - 3, E.x, y, CRI.yellow, 1); px(E.x - 1, y - 1, CRI.yellow, 1); px(E.x + 1, y - 1, CRI.yellow, 1); } });
    },
    scene(r) { return jolt(r, 5, 1); },
  },

  // Loose Hold: a strip of wall over the foe shakes, three holds work loose and fall on it, and the ground breaks under it.
  crimp_under: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), y = E.y - (high(E) ? 8 : 16), L = hold(t, 0, lastOf(r), 3), j = t < leaveOf(r) ? ((t >> 1) & 1) : 0;
      line(E.x - 10 + j, y, E.x + 10 + j, y, CRI.purple, L);
      const n = r.flights.filter(f => t < f.t0).length;
      for (let q = 0; q < n; q++) grip(E.x - 6 + q * 6 + j, y + 2, 1, L);
      landed(r, 22, (P, a) => { const reach = Math.round(12 * Math.min(1, (a + 1) / 4)); line(P.x - reach, P.y + 6, P.x + reach, P.y + 6, CRI.purple, fade(a, 22)); line(P.x - reach, P.y + 7, P.x + reach, P.y + 7, '#2a1848', fade(a, 22)); });
    },
    front(r) {
      const E = aim(r), y = E.y - (high(E) ? 8 : 16);
      flying(r, p => grip(E.x - 6 + p.i * 6, y + 2 + (E.y - y - 2) * p.u * p.u));
      landed(r, 12, (P, a, i) => chunks(P.x - 6 + i * 6, P.y + 2, hs(a), 5, r.seed + i, [CRI.pink, CRI.yellow, CRI.purple], 12));
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // Rest Hold: two holds slide in to the foe's feet and bolt down on either side of it, pinning it in place.
  crimp_rest: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => grip(p.x, p.y));
      const t = r.t, E = aim(r);
      landed(r, r.end, (P, a, i) => { const s = i ? 1 : -1, L = fade(a, r.end - hitOf(r), 6); grip(P.x + s * 5, P.y + 5, 1, L); if (a < 4) glint(P.x + s * 5, P.y + 5, CRI.yellow, 1); });
      const a = t - lastOf(r);
      if (a >= 0) line(E.x - 5, E.y + 4, E.x + 5, E.y + 4, CRI.yellow, fade(a, r.end - lastOf(r), 6) * ((a >> 2) & 1 ? 1 : 0.5));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Go Through: holds sprout up a wall-line behind Tegaote, then fly straight through the foe one after another and out the far side.
  crimp_through: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, s = -face(U), L = hold(t, 0, leaveOf(r) + 4, 3);
      for (let q = 0; q < Math.min(4, 1 + Math.floor(t / 3)); q++) grip(U.x + s * 9 + (q % 2) * 2, U.y + 4 - q * 5, 1, L);
    },
    front(r) {
      smear(r, CRI.pink, CRI.purple);
      for (const f of r.flights) {
        const a = r.t - f.t0, E = r.to[f.to] || r.to[0], S = r.from;
        if (a < 0 || a >= f.dur + 8) continue;
        const u = a / f.dur, x = S.x + (E.x - S.x) * u, y = S.y + (E.y - S.y) * u, d = Math.hypot(E.x - S.x, E.y - S.y) || 1;
        grip(x, y, 1, a < f.dur ? 1 : fade(a - f.dur, 8));
        tail(x, y, (E.x - S.x) / d, (E.y - S.y) / d, [CRI.light, CRI.pink, CRI.purple]);
      }
      landed(r, 18, (E, a, i) => { sparks(E.x, E.y, hs(a, 4), 6, r.seed + i, CRI.yellow, CRI.pink, 10, 1.2); if (a < 3) arc(E.x, E.y, 3, 3, W, 1); });
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Kamopra
  // Head Butt: Kamopra drops its horns and charges, and they meet the foe with a crack that knocks it down.
  chamois_butt: {
    noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, CHM.rock, fade(a, 18)); }); },
    front(r) {
      const U = userAt(r), d = face(r.from), t = r.t;
      if (t <= hitOf(r) + 2) horns(U.x + d * 3, U.y - 3, d, 1, 1);
      smear(r, CHM.cream, CHM.rose);
      landed(r, 12, (E, a) => { sparks(E.x - d * 3, E.y - 2, hs(a), 8, r.seed, W, CHM.cream, 10, 1.1); if (a < 3) arc(E.x - d * 3, E.y - 2, 4, 4, W, 1); });
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // Wall Run: a rock wall stands beside Kamopra, hoofprints run up it sideways, pebbles fall, and it stands on a ledge up high.
  chamois_wallrun: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, L = hold(t, 0, r.end, 4);
      dither(x - 2, U.y - 12, 5, 18, CHM.rock, L);
      line(x - 3, U.y - 12, x - 3, U.y + 5, CHM.cream, L * 0.5);
      for (let q = 0; q < 3; q++) line(x - 2, U.y - 8 + q * 6, x + 2, U.y - 9 + q * 6, CHM.dark, L);
      for (let q = 0; q < 5; q++) if (t > q * 2) hoof(x - 1 + (q % 2 ? 1 : -1), U.y + 3 - q * 3, L);
      const a = t - hitOf(r);
      if (a >= 0) { line(U.x - 6, U.y + 5, U.x + 6, U.y + 5, CHM.cream, fade(a, r.end - hitOf(r))); line(U.x - 6, U.y + 6, U.x + 6, U.y + 6, CHM.rock, fade(a, r.end - hitOf(r))); }
    },
    front(r) {
      const U = r.from, x = U.x + face(U) * 10;
      flying(r, p => blit(['rr', 'rd'], x + (p.i ? 2 : -2), U.y - 12 + p.u * 16, { r: CHM.rock, d: CHM.dark }, 1));
      landed(r, 8, (E, a) => sparks(x, U.y + 5, a, 4, r.seed + a, CHM.cream, CHM.rock, 6, 0.6));
    },
  },

  // Leap Off: Kamopra leaps high, its horns lead it down onto the foe, and it lands in a great splash with spray behind.
  chamois_leap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, S = r.from, E = aim(r), go = leaveOf(r), hit = hitOf(r), d = face(S);
      if (t >= go && t < hit) { const u = prog(t, go, hit), x = S.x + (E.x - S.x) * u, y = S.y + (E.y - S.y) * u - Math.sin(Math.PI * u) * 12; horns(x, y, d, 1, 1); hoof(x - 1, y + 5, 1); }
      flying(r, p => { if (p.i) blit(SEI_DROP, p.x, p.y, { f: W, g: '#7ab0d8', d: '#3a6a9a' }, 1); });
      landed(r, 20, (P, a, i) => { if (i) return; const b = hs(a, 3); for (let q = 0; q < 10; q++) { const vx = (q - 4.5) * 0.45, vy = -1.6 - hash(r.seed + q) * 0.9; px(P.x + vx * b, P.y + 4 + vy * b + 0.12 * b * b, q % 2 ? '#a8d8f0' : W, fade(a, 20)); } if (a < 6) arc(P.x, P.y + 5, 5 + a, 2 + a * 0.3, W, 1 - a / 6); hoof(P.x - 3, P.y + 5, fade(a, 20)); hoof(P.x + 2, P.y + 6, fade(a, 20)); });
    },
    scene(r) { return jolt(r, 8, 2); },
  },

  // Headlong: Kamopra paws the ground and lowers its horns, charges headlong, and drives the foe off the field in a blast of rock.
  chamois_headlong: {
    lead: 10, tail: 8, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, d = face(U);
      if (t < 10) chunks(U.x - d * 4, U.y + 5, t % 6, 3, r.seed + Math.floor(t / 6), [CHM.rock, CHM.cream], 6, 0.6);
      landed(r, 22, (E, a) => { const reach = Math.round(13 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, CHM.rock, fade(a, 22)); line(E.x - reach, E.y + 7, E.x + reach, E.y + 7, CHM.dark, fade(a, 22)); });
    },
    front(r) {
      const U = userAt(r), d = face(r.from), t = r.t;
      if (t <= hitOf(r) + 2) horns(U.x + d * 3, U.y - 3, d, 1.4, 1);
      smear(r, CHM.cream, CHM.rose);
      landed(r, 20, (E, a) => {
        const b = hs(a, 5);
        sparks(E.x, E.y, b, 10, r.seed, W, CHM.cream, 14, 1.4);
        chunks(E.x, E.y + 3, b, 6, r.seed, [CHM.rock, CHM.cream], 18, 1.2);
        for (let q = 0; q < 3; q++) { const s = b * 1.5 + q * 3, y = E.y - 3 + q * 3; line(E.x - d * 0 + d * s, y, E.x + d * (s + 5), y, q % 2 ? CHM.cream : W, fade(a, 20)); }
      });
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Pasubame
  // Scythe Shot: two sickle wings shear across and leave crescent cuts on the foe.
  swift_scythe: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => sickle(p.x, p.y, p.ux >= 0 ? 1 : -1, (p.a >> 1) & 1));
      landed(r, 10, (E, a, i) => { const n = Math.min(1, (a + 1) / 3); arc(E.x + (i ? 2 : -2), E.y, 6, 5, i ? SWI.cream : W, fade(a, 10), 0.6, 0.6 + 0.45 * n); arc(E.x + (i ? 2 : -2), E.y + 1, 6, 5, SWI.edge, fade(a, 10) * 0.75, 0.6, 0.6 + 0.45 * n); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Screech: a swift wheels screaming over Pasubame, and sharp V's of sound weave to the foe and ring round its head.
  swift_screech: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, leaveOf(r) + 8, 3);
      if (L > 0) sickle(U.x + Math.cos(t * 0.3) * 6, U.y - 12 + Math.sin(t * 0.3) * 2, Math.sin(t * 0.3) > 0 ? -1 : 1, (t >> 1) & 1, L);
      flying(r, p => { const d = p.ux >= 0 ? 1 : -1; line(p.x, p.y, p.x - d * 3, p.y - 3, SWI.cream, 1); line(p.x, p.y, p.x - d * 3, p.y + 3, SWI.cream, 1); px(p.x, p.y, W, 1); });
      landed(r, 18, (E, a) => { for (let q = 0; q < 2; q++) { const b = a - q * 3; if (b >= 0 && b < 12) arc(E.x, E.y - 6, 3 + b * 0.6, 1.5 + b * 0.2, q ? SWI.edge : SWI.cream, fade(b, 12)); } });
    },
  },

  // Dive Past: Pasubame dives low across the foe skimming the water, throws up a line of spray, and climbs away high.
  swift_dive: {
    noFlights: true, noLandings: true,
    back(r) { flying(r, p => { if (p.i === 0) for (let q = 1; q < 8; q++) px(p.x - Math.sign(p.ux || 1) * q * 2, p.E.y + 5 - (q % 2), q % 2 ? '#a8d8f0' : W, q < 5 ? 1 : 0.5); }); },
    front(r) {
      smear(r, SWI.edge, SWI.dark);
      flying(r, p => { if (p.i === 0) sickle(p.x, p.y + 2, p.ux >= 0 ? 1 : -1, 1); });
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.5, vy = -1.4 - hash(r.seed + q + i) * 0.6; px(E.x + (i ? 4 : -4) + vx * a, E.y + 4 + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : W, fade(a, 14)); } });
      const a = r.t - lastOf(r), U = r.from;
      if (a >= 0 && a < 14) sickle(U.x + face(U) * 3, U.y - 8 - a, face(U), (a >> 1) & 1, fade(a, 14));
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Endless: a flock of swifts wheels high over the foes, then dives on them one after another in crescent cuts.
  swift_endless: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, leaveOf(r) + 4, 4), cy = high(E) ? 8 : E.y - 16;
      for (let q = 0; q < 6; q++) { const g = t * 0.12 + q * Math.PI / 3; sickle(E.x + Math.cos(g) * 14, cy + Math.sin(g) * 3, Math.sin(g) > 0 ? -1 : 1, ((t >> 1) + q) & 1, L); }
    },
    front(r) {
      flying(r, p => sickle(p.x, p.y, (p.i & 1) ? -1 : 1, 0));
      landed(r, 12, (E, a, i) => { const n = Math.min(1, (a + 1) / 3), o = (i % 4 - 1.5) * 3; arc(E.x + o, E.y, 5, 6, i % 2 ? SWI.cream : W, fade(a, 12), 0.55, 0.55 + 0.4 * n); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 8, 1) }; },
  },

  // ---------------- Kukira
  // Gust Fire: two balls of pressed air fly in and pop on the foe, and a Pressure gauge over it ticks up.
  torr_gust: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { pressed(p.x, p.y, 3, r.t); tail(p.x, p.y, p.ux, p.uy, [TOR.light, TOR.gray]); });
      landed(r, 14, (E, a) => { pushLines(E.x, E.y, r.from, a, 10); if (a < 4) arc(E.x, E.y, 3 + a, 2 + a, TOR.cream, 1 - a / 4); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) gauge(E.x + (high(E) ? 9 : 7), E.y - (high(E) ? 3 : 8), Math.min(0.25, a * 0.03) + (r.t >= lastOf(r) ? 0.25 : 0), fade(a, r.end - hitOf(r), 6));
    },
  },

  // Blast Jump: Kukira stamps and rides a blast of air up, and blasts sweep through every foe and burst in push lines.
  torr_blast: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - r.contact, U = r.from; if (r.contact >= 0 && a >= 0 && a < 12) for (let q = 0; q < 2; q++) { const b = a - q * 3; if (b >= 0) arc(U.x, U.y + 6, 3 + b * 0.9, 1 + b * 0.25, q ? TOR.light : TOR.cream, fade(b, 9)); } },
    front(r) {
      flying(r, p => pressed(p.x, p.y, 3, r.t));
      landed(r, 12, (E, a, i) => { if (i < r.to.length) pushLines(E.x, E.y, r.from, a, 12); sparks(E.x, E.y, hs(a), 5, r.seed + i, W, TOR.cream, 8); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Breathe In: air is drawn in on the foe from all round in closing rings, and its Pressure gauge winds full and ticks.
  torr_breathe: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r);
      flying(r, p => { arc(p.x, p.y, 2, 2, TOR.light, 1); px(p.x, p.y, TOR.cream, 1); });
      if (t >= leaveOf(r) && t < lastOf(r) + 4) for (let q = 0; q < 2; q++) { const k = 1 - ((t * 0.08 + q * 0.5) % 1); arc(E.x, E.y, 3 + k * 10, 2 + k * 7, q ? TOR.light : TOR.cream, 0.75); }
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); gauge(E.x + (high(E) ? 9 : 7), E.y - (high(E) ? 3 : 8), Math.min(1, landedN(r) / 3), L); if ((t >> 2) & 1) for (let q = 0; q < 2; q++) px(E.x + (high(E) ? 7 : 5) + q * 4, E.y - (high(E) ? 8 : 13), TOR.cream, L); }
    },
  },

  // Blowout: pressure winds up round Kukira until its gauge pins, four blasts rush the foe, and push lines blow it off the field.
  torr_blowout: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, go = leaveOf(r), L = hold(t, 0, go + 4, 3), k = ease(prog(t, 0, go));
      for (let q = 0; q < 3; q++) { const rr = 12 - k * 6 + q * 2 - ((t >> 1) % 2); arc(U.x, U.y, rr, rr * 0.7, q % 2 ? TOR.light : TOR.cream, L * 0.75); }
      gauge(U.x + face(U) * 8, U.y - 10, k, L);
    },
    front(r) {
      flying(r, p => { pressed(p.x, p.y, 4, r.t); tail(p.x, p.y, p.ux, p.uy, [TOR.cream, TOR.light, TOR.gray]); });
      landed(r, 20, (E, a, i) => { if (i === r.hits.length - 1) { pushLines(E.x, E.y - 3, r.from, hs(a, 5), 20); pushLines(E.x, E.y + 3, r.from, hs(a, 5) + 2, 20); } sparks(E.x, E.y, hs(a), 6, r.seed + i, W, TOR.cream, 10); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 2) }; },
  },

  // ---------------- Otosus
  // Drop In: two dark weights fall on the foe from above in falling streaks, and a pit cracks open under its feet.
  plummet_drop: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, r.end, (E, a, i) => { if (i === 0) pit(E.x, E.y + 6, Math.min(7, 2 + a), fade(a, r.end - hitOf(r), 6)); }); },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2, 2, PLU.dark, 1); arc(p.x, p.y, 2, 2, PLU.lav, 1, 0.5, 1); for (let k = 2; k < 6; k++) px(p.x + (k % 2 ? 1 : -1), p.y - k * 1.5, PLU.purple, k < 4 ? 1 : 0.5); });
      landed(r, 12, (E, a, i) => chunks(E.x, E.y + 4, hs(a), 5, r.seed + i, [PLU.lav, PLU.purple], 12));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Freefall: a pit opens wide under the foe, streaks pour down past it, and it drops out of sight into the dark.
  plummet_freefall: {
    tail: 8, noLandings: true,
    back(r) { const t = r.t, E = aim(r), a = t - hitOf(r) + 6; if (a >= 0) pit(E.x, E.y + 6, Math.min(10, 2 + a), fade(a, r.end - hitOf(r) + 6, 6)); },
    front(r) {
      const t = r.t, E = aim(r), a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); falling(E.x, E.y, a, 6, r.seed, 7, L); oval(E.x, E.y, 5, 5, PLU.deep, 0.5 * L * Math.min(1, a / 6)); }
    },
  },

  // Trip: the ground drops a step under every foe as a dip sweeps through, and each stumbles into a splash.
  plummet_trip: {
    noFlights: true, noLandings: true,
    back(r) { flying(r, p => { if (p.i === 0) { line(p.x - 5, p.E.y + 6, p.x + 5, p.E.y + 6, PLU.deep, 1); line(p.x - 5, p.E.y + 7, p.x + 5, p.E.y + 7, PLU.purple, 1); px(p.x - 6, p.E.y + 5, PLU.lav, 1); } }); },
    front(r) {
      flying(r, p => { if (p.i) blit(SEI_DROP, p.x, p.E.y + 3, { f: W, g: '#7ab0d8', d: PLU.purple }, 1); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0 && a < 16) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5, vy = -1.3 - hash(r.seed + q) * 0.7; px(E.x + vx * a, E.y + 4 + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : W, fade(a, 16)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Bottom Out: the ground falls away under the whole field in dark bands, weights rain down on every foe, and the bottom booms.
  plummet_bottom: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), k = ease(prog(t, 0, 14));
      dither(0, 52, 96, 8, PLU.deep, 0.5 * L * k);
      for (let q = 0; q < 6; q++) { const x = (q * 17 + t * 2) % 100 - 2, y = 48 + ((t * 2 + q * 7) % 12); line(x, y, x, y + 2, q % 2 ? PLU.lav : PLU.purple, L * k); }
      r.to.forEach((E, j) => { const a = t - hitAt(r, j); pit(E.x, E.y + 6, a >= 0 ? 12 : 4 + 6 * k, L); });
    },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2, 2, PLU.dark, 1); arc(p.x, p.y, 2, 2, PLU.lav, 1, 0.5, 1); px(p.x, p.y - 3, PLU.purple, 1); px(p.x, p.y - 5, PLU.purple, 0.5); });
      landed(r, 18, (E, a, i) => { if (i < r.to.length) for (let q = 0; q < 2; q++) { const b = hs(a, 5) - q * 3; if (b >= 0) arc(E.x, E.y + 6, 6 + b, 2 + b * 0.3, q ? PLU.purple : PLU.lav, fade(b, 13)); } });
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Huipki
  // Point At: Huipki's sights close on the foe, a needle streaks to it and flashes, and the needle runs on through toward its bench.
  zenith_pointat: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r);
      if (t < hit + 4) sights(E.x, E.y, 10 - 6 * ease(prog(t, 0, hit)), hold(t, 0, hit + 4, 2));
      flying(r, p => needle(p.x, p.y, p.ux, p.uy, 7));
      landed(r, 12, (P, a) => {
        if (a < 3) glint(P.x, P.y, ZEN.star, 1);
        const d = Math.hypot(P.x - r.from.x, P.y - r.from.y) || 1, ux = (P.x - r.from.x) / d, uy = (P.y - r.from.y) / d;
        if (a < 8) needle(P.x + ux * a * 2, P.y + uy * a * 2, ux, uy, 5, fade(a, 8));
      });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Snap Shot: a bronze trap lobs over, lands at the foe's feet, and snaps shut on it, and stays set.
  zenith_shot: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => blit(['b.b', 'bpb', '.b.'], p.x, p.y, { b: ZEN.bronze, p: ZEN.pale }, 1));
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) {
        const L = fade(a, r.end - hitOf(r), 6), shut = Math.min(1, a / 3), y = E.y + 5;
        for (const s of [-1, 1]) { line(E.x - 5, y + s * 3 * (1 - shut), E.x + 5, y + s * 3 * (1 - shut), ZEN.bronze, L); for (let q = -4; q <= 4; q += 2) px(E.x + q, y + s * (3 * (1 - shut) - 1), ZEN.pale, L); }
        if (a < 3) sparks(E.x, y, a, 5, r.seed, W, ZEN.pale, 4, 0.8);
      }
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Net Bearing: three bronze points lob over the foe and pull a net of lines between them, and Huipki's sights settle on it.
  zenith_bearing: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { px(p.x, p.y, W, 1); arc(p.x, p.y, 1.5, 1.5, ZEN.bronze, 1); });
      const t = r.t, E = aim(r), n = landedN(r), L = fade(t - hitOf(r), r.end - hitOf(r), 6);
      const pts = [{ x: E.x - 7, y: E.y - 6 }, { x: E.x + 7, y: E.y - 4 }, { x: E.x, y: E.y + 6 }];
      for (let q = 0; q < n; q++) { glint(pts[q].x, pts[q].y, ZEN.bronze, L); if (q) line(pts[q - 1].x, pts[q - 1].y, pts[q].x, pts[q].y, ZEN.pale, L); }
      if (n === 3) { line(pts[2].x, pts[2].y, pts[0].x, pts[0].y, ZEN.pale, L); line(pts[0].x + 3, pts[0].y + 1, pts[2].x + 2, pts[2].y - 3, ZEN.purple, L); line(pts[1].x - 3, pts[1].y + 1, pts[2].x - 2, pts[2].y - 3, ZEN.purple, L); sights(E.x, E.y, 4, L * ((t >> 2) & 1 ? 1 : 0.5)); }
    },
  },

  // Highest: a long needle rises from Huipki to the top of the sky, a star lights there, and needles of starlight rain down on the foe.
  zenith_highest: {
    lead: 16, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, leaveOf(r) + 4, 4), up = ease(prog(t, 0, 12));
      needle(U.x, U.y - 6 - up * 18, 0, -1, Math.round(4 + up * 14), L);
    },
    front(r) {
      const t = r.t, E = aim(r), Z = high(E) ? { x: Math.min(90, E.x + 10), y: 8 } : { x: E.x, y: E.y - 30 }, L = hold(t, 10, lastOf(r) + 4, 4);
      if (L > 0) { glint(Z.x, Z.y, ZEN.star, L); if ((t >> 2) & 1) { px(Z.x - 3, Z.y, ZEN.pale, L); px(Z.x + 3, Z.y, ZEN.pale, L); } }
      flying(r, p => needle(p.x, p.y, 0, 1, 7));
      if (t >= leaveOf(r) && t < lastOf(r) + 6) sights(E.x, E.y, 5, 0.75);
      landed(r, 14, (P, a, i) => { if (i === r.hits.length - 1 && a < 4) { arc(P.x, P.y, 6 + a, 5 + a, W, 1); oval(P.x, P.y, 4, 4, ZEN.star, 0.5); } sparks(P.x, P.y, hs(a), 4, r.seed + i, W, ZEN.pale, 8); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 12, lv: 1.6 * hold(r.t, hitOf(r), lastOf(r) + 8, 4), tint: ZEN.star }]; },
  },

  // Parting Shot: Huipki's sights snap onto the foe as it goes, and a quick needle streaks after it.
  zenith_parting: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r);
      if (t < hit + 2) sights(E.x, E.y, 7 - 3 * prog(t, 0, hit), 1);
      flying(r, p => needle(p.x, p.y, p.ux, p.uy, 8));
      landed(r, 10, (P, a) => { if (a < 3) glint(P.x, P.y, ZEN.star, 1); sparks(P.x, P.y, a, 5, r.seed, W, ZEN.bronze, 8); });
    },
  },

  // ---------------- Humiri
  // Low Pulse: a slow drone wave runs to the foe, four note pulses ride it, and each lands as a ring of the low note.
  bourdon_low: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, leaveOf(r) - 2, lastOf(r) + 6, 3); if (L > 0) drone(r.from, E, t, 2, 0.5 * L); },
    front(r) {
      flying(r, p => note(p.x, p.y));
      landed(r, 12, (E, a, i) => { const rr = 3 + a * 0.8; arc(E.x, E.y, rr, rr * 0.7, i % 2 ? BOU.lime : BOU.pale, fade(a, 12)); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Drone Shift: a note circles Humiri, and the drone ringing round it turns from one song's color to the other's.
  bourdon_drone: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), L = hold(t, 0, r.end, 4), c = t < hit ? BOU.lime : BOU.gold;
      for (let q = 0; q < 24; q++) { const g = q / 24 * Math.PI * 2, rr = 9 + Math.sin(q * 1.5 - t * 0.3) * 1.2; px(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.6, c, L); }
    },
    front(r) {
      flying(r, p => note(p.x, p.y, 1, BOU.gold));
      landed(r, 16, (E, a) => { if (a < 6) ring(E.x, E.y, 4 + a, W, 1 - a / 6); motes(E.x, E.y, a, 4, r.seed, [BOU.pale, BOU.gold], 16, 5); });
    },
  },

  // Push Air: three wave fronts of the low note roll out and push into the foe, and it is blown off in a puff.
  bourdon_air: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { const nx = -p.uy, ny = p.ux; for (let k = -4; k <= 4; k++) { const o = Math.sin(k * 0.8 + r.t * 0.4) * 0.8; px(p.x + nx * k + p.ux * o, p.y + ny * k + p.uy * o, Math.abs(k) < 3 ? BOU.lime : BOU.brown, 1); } });
      landed(r, 14, (E, a, i) => { if (i === r.hits.length - 1) chalkPuff(E.x, E.y + 2, a, 14); ring(E.x, E.y, 2 + a * 0.6, BOU.pale, fade(a, 10)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Tune Up: the low note hums across Humiri's side, three notes circle it, and a ring of the song builds round the team as a shield.
  bourdon_tune: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6);
      drone({ x: U.x - 18, y: U.y - 10 }, { x: U.x + 18, y: U.y - 10 }, t, 2 * ease(prog(t, 0, 12)), L);
      const n = landedN(r);
      for (let q = 0; q < n; q++) arc(U.x, U.y + 1, 8 + q * 2, 6 + q * 1.5, q % 2 ? BOU.gold : BOU.lime, hold(t, hitOf(r), r.end, 4));
    },
    front(r) {
      flying(r, p => note(p.x, p.y, 1, p.i % 2 ? BOU.gold : BOU.lime));
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) motes(E.x, E.y, a, 6, r.seed, [BOU.pale, BOU.gold, W], 18, 7); if (a < 3) glint(E.x, E.y - 8, BOU.pale, 1); });
    },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y), r: 12, lv: 1.2 * hold(r.t, hitOf(r), r.end, 4), tint: BOU.lime }]; },
  },

  // ---------------- Reikuchi
  // Hole Through: holes open beside Reikuchi and at the foe, white light pours through between them, and the foe is burned.
  ostium_through: {
    lead: 6, tail: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, E = aim(r), L = hold(t, 0, hitOf(r) + 10, 3), g = Math.min(1, t / 6); hole(U.x + face(U) * 9, U.y - 4, 2 + 2 * g, t, L); },
    front(r) {
      const t = r.t, U = r.from, E = aim(r), A = { x: U.x + face(U) * 9, y: U.y - 4 }, on = hold(t, leaveOf(r), hitOf(r) + 8, 2);
      if (on > 0) { thick(A.x, A.y, E.x, E.y, OST.white, on, W); line(A.x + 1, A.y + 2, E.x + 1, E.y + 2, OST.blue, on); line(A.x - 1, A.y - 2, E.x - 1, E.y - 2, OST.rim, on); }
      landed(r, 14, (P, a) => { if (a < 8) hole(P.x, P.y, 4 - a * 0.4, t, fade(a, 8)); sparks(P.x, P.y, hs(a), 6, r.seed, OST.white, OST.ember, 12); });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 10, lv: 1.6 * hold(r.t, hitOf(r) - 2, hitOf(r) + 8, 3), tint: OST.white }]; },
  },

  // Open Under: a hole opens in the ground beside Reikuchi, stars rise out of it, and a small Hole Turret stands up on a stalk.
  ostium_under: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, x = U.x + face(U) * 10; oval(x, U.y + 6, 4, 1.5, OST.blue, hold(t, 0, r.end, 4)); oval(x, U.y + 6, 3, 1, OST.white, hold(t, 0, r.end, 4)); },
    front(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, n = landedN(r);
      flying(r, p => glint(x - 2 + p.i * 4, U.y + 6 - p.u * 10, OST.white, 1));
      if (n) { const h = 3 + n * 3; line(x, U.y + 5, x, U.y + 5 - h, OST.gray, 1); hole(x, U.y + 5 - h - 2, 2, t, hold(t, hitOf(r), r.end, 4)); }
      landed(r, 10, (E, a) => sparks(x, U.y - 4, a, 5, r.seed + a, W, OST.ember, 8, 0.8));
    },
  },

  // Other End: a hole opens before Reikuchi and its other end opens behind the foe, a line of light joining them.
  ostium_step: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, F = { x: r.from.x + (high(U) ? -50 : 50), y: high(U) ? 42 : 16 }, L = hold(t, r.contact, r.end, 4), g = prog(t, r.contact, hitOf(r));
      const A = { x: U.x + face(U) * 9, y: U.y - 2 }, B = { x: F.x + (high(F) ? 9 : -9), y: F.y - 2 };
      hole(A.x, A.y, 1 + 3 * g, t, L); hole(B.x, B.y, 1 + 3 * g, t, L);
      if (t >= hitOf(r)) for (let q = 0; q < 8; q++) { const u = ((q / 8 + t * 0.03) % 1); px(A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u - Math.sin(Math.PI * u) * 10, OST.white, fade(t - hitOf(r), r.end - hitOf(r))); }
    },
    front(r) { flying(r, p => { arc(p.x, p.y, 2, 2, OST.rim, 1); px(p.x, p.y, OST.white, 1); }); },
  },

  // Margin Hole: a wall of three holes opens in front of Reikuchi's side, white light in each, and the team stands fortified behind it.
  ostium_margin: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 11, L = hold(t, 0, r.end, 6), n = landedN(r);
      for (let q = 0; q < 3; q++) hole(x, U.y + 4 - q * 6, q < n ? 3 : 1 + 2 * prog(t, q * 4, 12), t, L);
      line(x - face(U), U.y + 6, x - face(U), U.y - 13, OST.blue, L);
    },
    front(r) {
      flying(r, p => { arc(p.x, p.y, 2.5, 2.5, OST.rim, 1); px(p.x, p.y, OST.white, 1); });
      landed(r, 16, (E, a, i) => { if (i === r.hits.length - 1) { arc(E.x, E.y + 1, 8, 6, OST.white, fade(a, 16)); arc(E.x, E.y + 1, 9, 7, OST.rim, fade(a, 16) * 0.5); } });
    },
  },

  // ---------------- Kairari
  // Drill: a spinning drill bit flies into the foe, bores in with violet grit flying, and leaves a neat round hole.
  gimlet_drillmove: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => bit(p.x, p.y, p.ux, p.uy, 9, r.t));
      landed(r, r.end, (E, a) => {
        const d = Math.hypot(E.x - r.from.x, E.y - r.from.y) || 1, ux = (E.x - r.from.x) / d, uy = (E.y - r.from.y) / d;
        if (a < 8) { bit(E.x - ux * 2 + ux * a * 0.3, E.y - uy * 2 + uy * a * 0.3, ux, uy, 7 - Math.floor(a / 2), r.t); chunks(E.x, E.y, a, 4, r.seed + (a >> 2), [GIM.violet, GIM.pale], 8, 0.8); }
        else drillHole(E.x - ux * 2, E.y - uy * 2, fade(a, r.end - hitOf(r), 6));
      });
    },
    scene(r) { return { jolt: r.t - hitOf(r) >= 0 && r.t - hitOf(r) < 8 ? (r.t & 1 ? 1 : -1) : 0 }; },
  },

  // Radula: a ribbon of tiny teeth rasps across the foe twice, shavings flying off it.
  gimlet_radula: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, GIM.pale, GIM.violet);
      landed(r, 10, (E, a, i) => {
        const u = Math.min(1, (a + 1) / 6), dir = i % 2 ? -1 : 1, y = E.y - 2 + i * 3;
        for (let k = 0; k < 10; k++) { const x = E.x - dir * 6 + dir * (k + u * 6); px(x, y, GIM.pale, fade(a, 10)); if (k % 2 === 0) px(x, y + 1, GIM.violet, fade(a, 10)); }
        chunks(E.x + dir * 4, y, a, 3, r.seed + i, [GIM.pale, GIM.violet], 10, 0.7);
      });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Moon Foot: Kairari's broad pale foot rolls out along the ground and over every foe, smothering them.
  gimlet_foot: {
    noFlights: true, noLandings: true,
    back(r) {
      flying(r, p => { if (p.i) return; const dir = p.ux >= 0 ? 1 : -1; for (let k = 0; k < 14; k++) { const x = p.x - dir * k, h = Math.round(4 * Math.sin(Math.PI * (k / 14)) + 1); dither(x, p.E.y + 6 - h, 1, h, k % 3 ? GIM.pale : '#c8b8d8', 1); px(x, p.E.y + 6 - h, W, 1); } });
    },
    front(r) {
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0 && a < 14) { arc(E.x, E.y + 2, 9, 7 - a * 0.3, GIM.pale, fade(a, 14), 0.5, 1); arc(E.x, E.y + 3, 8, 6 - a * 0.3, GIM.violet, fade(a, 14) * 0.75, 0.5, 1); } });
      landed(r, 12, (E, a, i) => { if (i < r.to.length) chunks(E.x, E.y + 3, hs(a), 4, r.seed + i, [W, '#c8b8d8'], 12); });
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // Go In: Kairari's bit spins up, four drills corkscrew into the foes, bore in leaving holes, and the last one goes in out of sight.
  gimlet_goin: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; if (t < leaveOf(r) + 2) bit(U.x + face(U) * 10, U.y, face(U), 0, 8, t * 2, hold(t, 0, leaveOf(r) + 2, 3)); },
    front(r) {
      flying(r, p => bit(p.x, p.y, p.ux, p.uy, 9, r.t));
      r.to.forEach((E, j) => {
        const n = r.hits.filter(h => h.to === j && r.t >= h.at).length, a = r.t - hitAt(r, j), L = fade(a, r.end - hitAt(r, j), 6);
        for (let q = 0; q < n; q++) drillHole(E.x - 4 + (q % 2) * 6, E.y - 3 + Math.floor(q / 2) * 5, L);
      });
      landed(r, 12, (E, a, i) => chunks(E.x, E.y, a, 4, r.seed + i, [GIM.violet, GIM.pale], 10, 0.8));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Vobasa
  // Wingspan: the albatross spreads its long wings over Vobasa and throws three long feathers that cut the foe.
  albatross_wingspan: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, leaveOf(r) + 6, 3); bird(U.x, U.y - 13, face(U), (t >> 2) & 1, L, 1.2); },
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 6, p.y - p.uy * 6, ALB.white, 1); px(p.x - p.ux * 6, p.y - p.uy * 6, ALB.blue, 1); px(p.x, p.y, W, 1); });
      landed(r, 10, (E, a, i) => { const n = Math.min(1, (a + 1) / 3), o = (i - 1) * 3; line(E.x + 5 + o, E.y - 5, E.x + 5 + o - 10 * n, E.y - 5 + 10 * n, i === 1 ? W : ALB.white, fade(a, 10)); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Soar Over: the albatross lifts off Vobasa, flies over to the foe, and circles above it, its shadow left on the foe: Overflown.
  albatross_soar: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - hitOf(r), E = aim(r); if (a >= -4) birdShadow(E.x + Math.sin(r.t * 0.15) * 4, E.y + 6, 6, hold(r.t, hitOf(r) - 4, r.end, 4)); },
    front(r) {
      const t = r.t, U = r.from, E = aim(r), go = leaveOf(r), hit = hitOf(r), up = high(E) ? 8 : E.y - 14;
      if (t < hit) { const u = prog(t, 0, hit), x = U.x + (E.x - U.x) * u, y = (U.y - 13) + (up - U.y + 13) * u - Math.sin(Math.PI * u) * 6; bird(x, y, face(U), (t >> 2) & 1, t < go ? prog(t, 0, 4) : 1); }
      else { const a = t - hit, g = a * 0.15; bird(E.x + Math.sin(g) * 8, up + Math.cos(g) * 1.5, Math.cos(g) > 0 ? 1 : -1, (t >> 2) & 1, fade(a, r.end - hit, 6)); }
    },
  },

  // Shadow Shift: Vobasa slips into the bird's shadow, the shadow skims under the foe, and the water jumps up where it passes.
  albatross_shadow: {
    noFlights: true, noLandings: true,
    back(r) { flying(r, p => { if (p.i === 0) birdShadow(p.x, p.E.y + 6, 7, 1); }); },
    front(r) {
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.5, vy = -1.5 - hash(r.seed + q + i) * 0.6; px(E.x + (i ? 3 : -3) + vx * a, E.y + 4 + vy * a + 0.12 * a * a, q % 2 ? ALB.blue : W, fade(a, 14)); } });
      const t = r.t, E = aim(r);
      if (t >= leaveOf(r) && t < lastOf(r) + 4) bird(E.x + Math.sin(t * 0.3) * 6, high(E) ? 6 : E.y - 16, 1, (t >> 2) & 1, 0.75);
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Whole Beach: the albatross spreads its wings across the whole sky, its shadow covers the beach, and it rains long feathers on every foe.
  albatross_beach: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12));
      dither(0, 50, 96, 4, ALB.shadow, 0.5 * L * g);
      bird(48, 10, 1, (t >> 3) & 1, L, 1 + 2.5 * g);
    },
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x, p.y - 5, ALB.white, 1); px(p.x, p.y, W, 1); px(p.x, p.y - 5, ALB.blue, 1); });
      landed(r, 12, (E, a, i) => { const n = Math.min(1, (a + 1) / 3), o = (i % 3 - 1) * 3; line(E.x + 5 + o, E.y - 5, E.x + 5 + o - 10 * n, E.y - 5 + 10 * n, i % 2 ? W : ALB.white, fade(a, 12)); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // Bird Dive: the albatross folds its wings high over the foe and dives on it, three feathers raining with it.
  albatross_dive: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), top = high(E) ? 6 : E.y - 22, u = ease(prog(t, 0, hit));
      if (t < hit) { const y = top + (E.y - 4 - top) * u * u, fold = u > 0.4; if (fold) { line(E.x - 2, y - 3, E.x, y, ALB.white, 1); line(E.x + 2, y - 3, E.x, y, ALB.white, 1); px(E.x, y + 1, ALB.yellow, 1); } else bird(E.x, y, 1, (t >> 2) & 1, 1); }
      flying(r, p => { line(p.x, p.y, p.x, p.y - 4, ALB.white, 1); px(p.x, p.y, W, 1); });
      landed(r, 10, (P, a, i) => { const n = Math.min(1, (a + 1) / 3); line(P.x + 4 + i, P.y - 5, P.x + 4 + i - 8 * n, P.y - 5 + 10 * n, W, fade(a, 10)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // ---------------- Alkume
  // Jet Rain: six quick jets of water rain on the foe, each a little splash, and Swell beads gather over it.
  protoconch_jet: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 3, p.y - p.uy * 3, PRO.light, 1); px(p.x, p.y, W, 1); });
      landed(r, 8, (E, a, i) => { const x = E.x + (i % 3 - 1) * 3; for (let q = 0; q < 3; q++) px(x + (q - 1) * (1 + a * 0.4), E.y - 4 - Math.sin(Math.PI * a / 8) * (2 + q % 2), q % 2 ? PRO.pink : W, fade(a, 8)); });
      const n = landedN(r), E = aim(r);
      if (n) pips(E.x, E.y - 9, Math.min(5, Math.ceil(n / 1.5)), fade(r.t - hitOf(r), r.end - hitOf(r), 6));
    },
  },

  // Room Seeker: a small chambered shell flies into the foe and its rooms burst into pink Swell beads round it.
  protoconch_room: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => chambers(p.x, p.y, 4, 0.8, 1, r.t * 0.3));
      landed(r, r.end, (E, a) => {
        if (a < 10) for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2, d = 2 + hs(a) * 0.9; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, q % 2 ? PRO.pink : PRO.light, fade(a, 10)); }
        pips(E.x, E.y - 9, Math.min(2, 1 + (a >> 2)), fade(a, r.end - hitOf(r), 6));
      });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Pea Charge: a pea-sized room circles Alkume and seals itself onto a growing spiral of rooms round it, and it darts off quicker.
  protoconch_pea: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = userAt(r), n = 2 + Math.min(4, Math.floor(prog(t, 0, hitOf(r)) * 4)); chambers(U.x, U.y + 1, n, 1.6, hold(t, 0, r.end, 4), -t * 0.05); },
    front(r) {
      const U = userAt(r);
      flying(r, p => { const g = p.u * Math.PI * 4, rr = 10 * (1 - p.u * 0.6); oval(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.5, 1, 1, PRO.pink, 1); });
      const a = r.t - hitOf(r);
      if (a >= 0) for (let q = 0; q < 3; q++) { const len = 2 + ((a >> 1) + q) % 3; line(U.x - face(r.from) * 6, U.y - 2 + q * 2, U.x - face(r.from) * (6 + len), U.y - 2 + q * 2, PRO.light, fade(a, r.end - hitOf(r))); }
    },
  },

  // Coil In: a nautilus spiral coils round Alkume as its shield, three chambered shells corkscrew to the foe, and it bursts in a splash ring.
  protoconch_coil: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; chambers(U.x, U.y + 1, Math.min(7, 2 + Math.floor(t / 3)), 1.7, hold(t, 0, r.end, 6), t * 0.04); },
    front(r) {
      flying(r, p => chambers(p.x, p.y, 3, 0.8, 1, r.t * 0.4));
      landed(r, 18, (E, a, i) => { const b = hs(a, i === r.hits.length - 1 ? 5 : 2); for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5, vy = -1.4 - hash(r.seed + q) * 0.6; px(E.x + vx * b, E.y + 3 + vy * b + 0.12 * b * b, q % 2 ? PRO.light : W, fade(a, 18)); } ring(E.x, E.y + 3, 3 + b * 0.8, PRO.pink, fade(a, 14)); });
      const n = landedN(r), E = aim(r);
      if (n) pips(E.x, E.y - 9, Math.min(5, n + 1), fade(r.t - hitOf(r), r.end - hitOf(r), 6));
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Small Gran
  // Is It Today: Small Gran asks her line, dashes in, and scratches the foe three times, quicker for it.
  smallgranw_today: {
    lead: 8, tail: 6, noLandings: true,
    back(r) { const U = r.from; speech(talkX(U), talkY(U), 'ask', hold(r.t, 0, r.contact, 3)); },
    front(r) {
      smear(r, GRN.white, GRN.lav);
      landed(r, 12, (E, a) => { for (let q = 0; q < 3; q++) { const b = a - q * 2; if (b < 0) continue; const n = Math.min(1, (b + 1) / 3); line(E.x + 3 + (q - 1) * 3, E.y - 5, E.x + 3 + (q - 1) * 3 - 6 * n, E.y - 5 + 10 * n, q === 1 ? W : GRN.lav, fade(a, 12)); } });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Don't Scratch: Small Gran says no, her bad statuses fall off her as lavender dust, and a firm ring stands round her.
  smallgranw_scratch: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      speech(talkX(U), talkY(U), 'no', hold(t, 0, hitOf(r) + 8, 3));
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 5; q++) px(U.x - 4 + q * 2, U.y - 2 + a * 0.6 + (q % 2) * 2, GRN.lav, L); arc(U.x, U.y + 1, 7, 6, GRN.white, L * ((a >> 2) & 1 ? 1 : 0.5)); motes(U.x, U.y, a, 4, r.seed, [GRN.white, GRN.lav], 16, 5); }
    },
  },

  // I Can Feel It: Small Gran feels it coming, and a lavender ring pulses out from her with arrows rising round it.
  smallgranw_feel: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      speech(talkX(U), talkY(U), 'yes', hold(t, 0, hitOf(r) + 6, 3));
      if (a >= 0) { for (let q = 0; q < 2; q++) { const b = a - q * 4; if (b >= 0 && b < 12) ring(U.x, U.y + 2, 3 + b, q ? GRN.white : GRN.lav, fade(b, 12)); } for (let q = 0; q < 2; q++) { const y = U.y + 2 - ((a + q * 5) % 12); line(U.x - 6 + q * 12, y, U.x - 6 + q * 12, y + 2, GRN.lav, fade(a, r.end - hitOf(r))); px(U.x - 7 + q * 12, y + 1, GRN.lav, fade(a, r.end - hitOf(r))); px(U.x - 5 + q * 12, y + 1, GRN.lav, fade(a, r.end - hitOf(r))); } }
    },
  },

  // Don't Look Yet: Small Gran trails off, a lavender hoop floats over to the foe and turns slowly round its head, and a ward rings her.
  smallgranw_look: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from;
      speech(talkX(U), talkY(U), 'dots', hold(t, 0, leaveOf(r) + 6, 3));
      flying(r, p => { arc(p.x, p.y, 3, 1.5, GRN.lav, 1); px(p.x, p.y - 2, W, 1); });
      const a = t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); arc(E.x, E.y - 7, 5, 1.5, GRN.lav, L, a * 0.02, a * 0.02 + 0.7); arc(U.x, U.y + 1, 7, 6, GRN.white, L * 0.5); }
    },
  },

  // There It Goes: Small Gran points, dashes through, and a great lavender cut runs across every foe, and she is mended a little.
  smallgranw_there: {
    lead: 12, tail: 8, noLandings: true,
    back(r) { const U = r.from; speech(talkX(U), talkY(U), 'go', hold(r.t, 0, r.contact, 3)); },
    front(r) {
      smear(r, GRN.white, GRN.lav);
      landed(r, 14, (E, a) => { const n = Math.min(1, (a + 1) / 3); thick(E.x + 8, E.y - 7, E.x + 8 - 16 * n, E.y - 7 + 14 * n, W, fade(a, 14), GRN.lav); sparks(E.x, E.y, hs(a, 5), 6, r.seed, GRN.white, GRN.lav, 10); });
      const a = r.t - hitOf(r);
      if (a >= 4) motes(r.from.x, r.from.y, a - 4, 4, r.seed, [GRN.white, GRN.lav], 16, 5);
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Konleva
  // Frond Slap: two kelp blades arc over and slap down on the foe, and a Kelp Arm stands up beside Konleva.
  laminaria_frond: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) blade(U.x + face(U) * 10, U.y + 6, Math.min(12, 3 + a), face(U) * 2, r.t, fade(a, r.end - hitOf(r), 6)); },
    front(r) {
      flying(r, p => blade(p.x, p.y + 4, 8, -(p.ux >= 0 ? 1 : -1) * 6 * p.u, r.t));
      landed(r, 10, (E, a, i) => { const n = Math.min(1, (a + 1) / 3); thick(E.x - 7, E.y - 4 + i * 3, E.x - 7 + 14 * n, E.y - 2 + i * 3, LAM.gold, fade(a, 10), LAM.olive); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Blade Sway: three kelp blades swing through the foe one way and back, slapping water off it.
  laminaria_sway: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { const lean = (p.u - 0.45) * 16 * (p.ux >= 0 ? 1 : -1); blade(p.E.x + (p.x - p.E.x) * 0.4, p.E.y + 6, 13, lean, r.t); });
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 4; q++) { const vx = (q - 1.5) * 0.6, vy = -1.3 - hash(r.seed + q + i) * 0.6; px(E.x + vx * a, E.y + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : W, fade(a, 14)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Shed Water: Konleva shakes and water showers off it onto the foe, and two blades curl round the foe and hold it.
  laminaria_shed: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: W, g: '#7ab0d8', d: LAM.olive }, 1));
      landed(r, 8, (E, a) => { for (let q = 0; q < 3; q++) px(E.x + (q - 1) * (1 + a * 0.4), E.y - 4 - Math.sin(Math.PI * a / 8) * 2, q % 2 ? '#a8d8f0' : W, fade(a, 8)); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), g = Math.min(1, a / 10); for (const s of [-1, 1]) blade(E.x + s * 6, E.y + 6, Math.round(4 + 8 * g), -s * 5 * g, r.t, L); }
    },
  },

  // Ebb Blade: the sea runs out and kelp stands up round Konleva, it dashes in, and blades sweep through every foe and open in a bloom.
  laminaria_ebbblade: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), out = ease(prog(t, 0, 10));
      bands(0, 96, Math.round(52 + 8 * out), [['#a8d8f0', 1], ['#2a58b8', 8]], L * (1 - out * 0.75));
      for (let q = 0; q < 3; q++) blade(U.x - 9 + q * 9, U.y + 6, Math.round(10 * out) + (q === 1 ? 0 : 2), (q - 1) * 3, t + q * 5, L);
    },
    front(r) {
      smear(r, LAM.gold, LAM.olive);
      flying(r, p => { const lean = (p.u - 0.45) * 16 * (p.ux >= 0 ? 1 : -1); blade(p.x, p.E.y + 6, 12, lean, r.t); });
      landed(r, 18, (E, a, i) => { if (i < r.to.length) { const n = Math.min(1, (a + 1) / 3); thick(E.x + 7, E.y - 7, E.x + 7 - 14 * n, E.y - 7 + 14 * n, LAM.gold, fade(a, 12), W); for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2, d = 3 + hs(a, 5) * 0.6; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, q % 2 ? LAM.gold : LAM.light, fade(a, 18)); } } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },


  // ---------------- Nikusa
  // Comb Through: a tuft of sea grass combs through every foe and leaves pink dream dust, and a little of it heals Nikusa.
  eelgrass_comb: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { if (p.i === 0) meadow(p.x, p.E.y + 6, 4, 9, r.t, 1, 0.3); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) dreamDust(E.x, E.y, a, 6, r.seed + j, 7, fade(a, r.end - hitAt(r, j), 6)); });
      const a = r.t - lastOf(r);
      if (a >= 0) motes(r.from.x, r.from.y, a, 4, r.seed, [EEL.light, EEL.tan], 16, 5);
    },
  },

  // Sway Over: blades of sea grass weave over to the foe, and a meadow springs up round its feet and tangles them.
  eelgrass_sway: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), E = aim(r); if (n) meadow(E.x, E.y + 6, 7, 3 + n * 2, r.t, fade(r.t - hitOf(r), r.end - hitOf(r), 6), 0, 9); },
    front(r) {
      flying(r, p => { for (let i = 0; i < 6; i++) px(p.x + Math.sin(r.t * 0.3 + i) * 1, p.y - i + 3, i === 5 ? EEL.tan : EEL.light, 1); });
      const n = landedN(r), E = aim(r);
      if (n) { const L = fade(r.t - hitOf(r), r.end - hitOf(r), 6); for (const s of [-1, 1]) arc(E.x + s * 2, E.y + 4, 4, 2, EEL.green, L, s > 0 ? 0.5 : 0, s > 0 ? 1 : 0.5); dreamDust(E.x, E.y + 2, r.t - hitOf(r), 4, r.seed, 6, L); }
    },
  },

  // Meadow Seed: two seed pods lob onto the foe, splash, and a tuft of sea grass sprouts where each one fell.
  eelgrass_mend: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, r.end, (E, a, i) => meadow(E.x + (i ? 5 : -5), E.y + 6, 2, Math.min(7, 2 + a), r.t, fade(a, r.end - hitOf(r), 6), 0, 3)); },
    front(r) {
      flying(r, p => blit(['.t.', 'tgt', '.g.'], p.x, p.y, { t: EEL.tan, g: EEL.green }, 1));
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.5, vy = -1.3 - hash(r.seed + q + i) * 0.6; px(E.x + (i ? 5 : -5) + vx * a, E.y + 3 + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : W, fade(a, 14)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Lull Over: the meadow spreads along the bottom of the field, pink dream dust drifts down on every foe, and the grass lies flat.
  eelgrass_farreach: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12)), flat = prog(t, lastOf(r), lastOf(r) + 10);
      for (let q = 0; q < 6; q++) meadow(8 + q * 16, 57, 5, Math.round(6 * g), t + q * 3, L, flat, 4);
    },
    front(r) {
      flying(r, p => { px(p.x, p.y, EEL.dust, 1); px(p.x + 1, p.y - 1, EEL.pink, 1); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6); dreamDust(E.x, E.y - 2, a, 8, r.seed + j, 9, L); for (let q = 0; q < 2; q++) { const b = (a + q * 10) % 20; blit(['kkk', '.k.', 'kkk'], E.x + 6 + b * 0.3, E.y - 8 - b * 0.4, { k: EEL.dust }, L * fade(b, 20, 6)); } } });
    },
  },

  // ---------------- Syvakai
  // Long Bite: Syvakai lunges up out of the dark, two long needle teeth close on the foe, and its upturned eyes glint over it.
  grenadier_bite: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, GRE.pale, GRE.purple);
      flying(r, p => needleTooth(p.x, p.y, p.ux, p.uy));
      landed(r, 12, (E, a, i) => { const g = Math.max(0, 4 - hs(a)); line(E.x - 6, E.y - 1 - g, E.x + 6, E.y - 1 - g, GRE.pale, fade(a, 12)); line(E.x - 6, E.y + 1 + g, E.x + 6, E.y + 1 + g, GRE.pale, fade(a, 12)); sparks(E.x, E.y, hs(a), 4, r.seed + i, W, GRE.purple, 8); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 2) upEyes(E.x, E.y - 9, fade(a, r.end - hitOf(r)));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Deep Rake: two pale spines fly in and rake the foe, and a pair of upturned eyes opens over it and stays, Haunting it.
  grenadier_rake: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 5, p.y - p.uy * 5, GRE.pale, 1); px(p.x, p.y, W, 1); px(p.x - p.ux * 5, p.y - p.uy * 5, GRE.purple, 1); });
      landed(r, 12, (E, a) => { for (let q = 0; q < 3; q++) { const b = a - q * 2; if (b < 0) continue; const n = Math.min(1, (b + 1) / 3); line(E.x + 4 + (q - 1) * 3, E.y - 5, E.x + 4 + (q - 1) * 3 - 8 * n, E.y - 5 + 10 * n, q === 1 ? W : GRE.pale, fade(a, 12)); } });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), blink = (a % 16) < 2; oval(E.x, E.y - 9, 6, 3, GRE.night, 0.5 * L); if (!blink) upEyes(E.x, E.y - 9, L); else line(E.x - 4, E.y - 9, E.x + 4, E.y - 9, GRE.pale, L); }
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Lure Up: a pale lure light dangles before the foe, bubbles rise to it, and the dark of the deep spreads under the foe's feet.
  grenadier_lure: {
    noFlights: true, noLandings: true,
    back(r) { const E = aim(r), L = hold(r.t, 0, r.end, 5); oval(E.x, E.y + 6, 9, 2, GRE.night, 0.75 * L * prog(r.t, 0, hitOf(r))); },
    front(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 5), lx = E.x - face(E) * 7 + Math.sin(t * 0.2) * 1.5, ly = E.y - 6;
      line(lx, ly - 7, lx, ly - 2, GRE.purple, L); oval(lx, ly, 1.5, 1.5, GRE.pale, L); if ((t >> 2) & 1) glint(lx, ly, GRE.pale, L);
      flying(r, p => { arc(p.x, p.y, 1.5, 1.5, '#a8d8f0', 1); px(p.x - 1, p.y - 1, W, 1); });
      landed(r, 10, (P, a) => sparks(lx, ly, a, 4, r.seed + a, W, GRE.pale, 8, 0.6));
    },
    lights(r) { return [{ x: Math.round(aim(r).x - face(aim(r)) * 7), y: Math.round(aim(r).y - 6), r: 8, lv: 1.4 * hold(r.t, 0, r.end, 5), tint: GRE.pale }]; },
  },

  // Pressure Drop: the field sinks into deep dark, pairs of upturned eyes open all round, and dark weights fall on every foe as the ground shakes.
  grenadier_drop: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12));
      wash(GRE.night, 0.375 * L * g);
      for (let q = 0; q < 5; q++) { const on = t > 4 + q * 3 && ((t + q * 7) % 24) > 2; if (on) upEyes(10 + q * 18 + (q % 2) * 4, 24 + (q % 3) * 10, L * 0.75, 2); }
    },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2, 2, GRE.deep, 1); arc(p.x, p.y, 2, 2, GRE.purple, 1, 0.5, 1); });
      landed(r, 16, (E, a, i) => { if (i < r.to.length) { chunks(E.x, E.y + 5, hs(a, 5), 6, r.seed + i, [GRE.purple, GRE.pale], 16); upEyes(E.x, E.y - 9, fade(a, 16)); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 12, 2), dark: 0.25 * hold(r.t, 0, r.end, 6) }; },
  },

  // ---------------- Tahtode
  // Arm Barrage: Tahtode throws two of its arms, and each lands on the foe in a twinkle of cream stars.
  asterias_barrage: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => arm(p.x, p.y, p.ux, p.uy));
      landed(r, 16, (E, a, i) => { for (let q = 0; q < 4; q++) { const ph = (a + q * 3) % 8; if (ph < 4 && a > 1) glint(E.x + [-6, 5, -3, 6][q] + i, E.y + [-4, -3, 5, 4][q], AST.cream, fade(a, 16)); } if (a < 3) starfish(E.x, E.y, 3, 0, 1); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Point Five: a starfish over Tahtode points all five arms and fires them, and they sweep through every foe.
  asterias_five: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, P = { x: U.x + face(U) * 9, y: U.y - 9 }, left = 5 - r.flights.filter(f => t >= f.t0).length; starfish(P.x, P.y, 5, t * 0.05, hold(t, 0, lastOf(r) + 4, 3), Math.max(0, left)); },
    front(r) {
      flying(r, p => arm(p.x, p.y, p.ux, p.uy));
      landed(r, 14, (E, a, i) => { if (a < 6) glint(E.x + (i % 5 - 2) * 3, E.y - 2 + (i % 2) * 3, AST.cream, 1 - a / 6); });
    },
  },

  // Fallen Star: three small starfish fall out of the sky on the foe like burning stones, and an arm grows back on Tahtode.
  asterias_homing: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, AST.orange, fade(a, 18)); line(E.x - reach, E.y + 7, E.x + reach, E.y + 7, AST.brown, fade(a, 18)); }); },
    front(r) {
      flying(r, p => { starfish(p.x, p.y, 2.5, r.t * 0.3, 1); for (let k = 1; k < 6; k++) px(p.x - p.ux * k * 1.5, p.y - p.uy * k * 1.5, k < 3 ? AST.hot : AST.orange, k < 4 ? 1 : 0.5); });
      landed(r, 12, (E, a, i) => chunks(E.x, E.y + 3, hs(a), 4, r.seed + i, [AST.orange, AST.cream], 12));
      const a = r.t - lastOf(r), U = r.from;
      if (a >= 0 && a < 14) { line(U.x, U.y - 4, U.x, U.y - 4 - Math.min(4, a), AST.orange, fade(a, 14)); glint(U.x, U.y - 5 - Math.min(4, a), AST.cream, fade(a, 14)); }
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Falling Arms: a great starfish climbs into the sky, its arms fall on the foe as eight burning stars, and a pillar of light stands over it.
  asterias_skydrop: {
    lead: 14, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, go = leaveOf(r), up = ease(prog(t, 0, go)), L = hold(t, 0, go + 4, 4);
      starfish(U.x + (aim(r).x - U.x) * up * 0.5, U.y - 10 - up * 30, 4 + 3 * up, t * 0.1, L);
    },
    front(r) {
      flying(r, p => { arm(p.x, p.y, p.ux, p.uy); px(p.x - p.ux * 6, p.y - p.uy * 6, AST.hot, 0.5); });
      landed(r, 12, (E, a, i) => { if (a < 4) glint(E.x + (i % 4 - 1.5) * 3, E.y - 1 + (i % 2) * 2, AST.cream, 1); });
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= -4 && a < 16) { const L = fade(a, 16, 6), h = Math.round(Math.min(1, (a + 5) / 4) * 26); for (let y = 0; y < h; y++) { px(E.x, E.y + 5 - y, W, L); px(E.x - 1, E.y + 5 - y, AST.cream, L); px(E.x + 1, E.y + 5 - y, AST.orange, L * 0.75); } }
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 12, lv: 1.6 * hold(r.t, hitOf(r), lastOf(r) + 12, 4), tint: AST.cream }]; },
  },

  // ---------------- Lonshu
  // Sucker Slap: Lonshu's arm whips out and slaps the foe, leaving a row of sucker marks.
  cirrus_slap: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), hit = hitOf(r);
      if (t >= hit - 3 && t < hit + 4) tentacle(U, E, t, 1, 1);
      landed(r, r.end, (P, a) => { if (a < 4) arc(P.x, P.y, 4 + a, 3 + a, W, 1 - a / 4); suckers(P.x, P.y, 5, fade(a, r.end - hit, 6)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Cling On: Lonshu's arm coils round its place and holds on to the ally coming in, a mint shield ring round it.
  cirrus_cling: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      for (let q = 0; q < 3; q++) arc(U.x, U.y - 3 + q * 4, 7 - q, 2, q % 2 ? CIR.mint : CIR.sage, hold(t, q * 3, r.end, 4), (t * 0.03 + q * 0.2) % 1, (t * 0.03 + q * 0.2) % 1 + 0.6);
      if (a >= 0) arc(U.x, U.y + 1, 9, 7, CIR.mint, fade(a, r.end - hitOf(r), 6) * ((a >> 2) & 1 ? 1 : 0.5));
    },
  },

  // Long Reach: Lonshu's arm reaches past the foe right to its bench, grabs one, and drags it in by the feet.
  cirrus_reach: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r), dx = E.x - r.from.x, dy = E.y - r.from.y;
      const out = t < hit ? prog(t, go, hit) : 1 - prog(t, hit + 2, r.end - 6), far = { x: r.from.x + dx * (0.3 + 1.0 * out), y: r.from.y + dy * (0.3 + 1.0 * out) };
      if (t >= go && t < r.end - 4) tentacle(U, far, t, 1, 2);
      landed(r, 14, (P, a) => { suckers(P.x, P.y + 2, 4, fade(a, 14)); for (let q = 0; q < 2; q++) { const n = Math.min(1, (a + 1) / 3); line(P.x - 3 + q * 4, P.y - 5, P.x - 5 + q * 4, P.y - 5 + 9 * n, CIR.mint, fade(a, 12)); } });
      const a = t - hitOf(r);
      if (a >= 6) arc(E.x, E.y + 5, 5, 1.5, CIR.sage, fade(a, r.end - hitOf(r), 4));
    },
  },

  // Wrap Around: Lonshu's arm uncoils, then wraps round the foe coil by coil, tightening, its suckers holding fast.
  cirrus_wrap: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; if (t < leaveOf(r) + 4) tentacle(U, { x: U.x + face(U) * (4 + t), y: U.y - 8 - Math.sin(t * 0.3) * 3 }, t, hold(t, 0, leaveOf(r) + 4, 3), 3); },
    front(r) {
      flying(r, p => { tentacle({ x: p.x - p.ux * 8, y: p.y - p.uy * 8 }, { x: p.x, y: p.y }, r.t, 1, 1); });
      const n = landedN(r), E = aim(r), L = fade(r.t - hitOf(r), r.end - hitOf(r), 6);
      for (let q = 0; q < n; q++) { const rr = Math.max(5, 9 - (n - q)); arc(E.x, E.y - 4 + q * 3, rr, 2, CIR.sage, L, 0, 0.5); arc(E.x, E.y - 3 + q * 3, rr, 2, CIR.dark, L * 0.75, 0.05, 0.45); px(E.x - rr + 2, E.y - 2 + q * 3, CIR.mint, L); px(E.x + rr - 2, E.y - 2 + q * 3, CIR.mint, L); }
      landed(r, 10, (P, a, i) => sparks(P.x, P.y, hs(a), 5, r.seed + i, W, CIR.mint, 8));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Puhalki
  // Squirt: three quick jets squirt from Puhalki's siphon and burst on the foe.
  hyponome_squirt: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => jet({ x: p.x - p.ux * 8, y: p.y - p.uy * 8 }, { x: p.x, y: p.y }, r.t, 1));
      landed(r, 12, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.5, vy = -1.2 - hash(r.seed + q + i) * 0.7; px(E.x + vx * a, E.y + 1 + vy * a + 0.12 * a * a, q % 2 ? HYP.blue : W, fade(a, 12)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Push Off: Puhalki jets forward on a stream thrown out behind it, and two jets slam the foe off the field.
  hyponome_pushoff: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), d = face(r.from);
      if (t < r.contact + 2) jet({ x: U.x - d * 3, y: U.y }, { x: U.x - d * 14, y: U.y + 1 }, t, 2, hold(t, 0, r.contact + 2, 2));
      flying(r, p => jet({ x: p.x - p.ux * 7, y: p.y - p.uy * 7 }, { x: p.x, y: p.y }, t, 1.5));
      landed(r, 14, (E, a, i) => { if (i === r.hits.length - 1) pushLines(E.x, E.y, r.from, hs(a), 14); sparks(E.x, E.y, hs(a), 5, r.seed + i, W, HYP.blue, 8); });
    },
    scene(r) { return jolt(r, 5, 1); },
  },

  // Exhale: Puhalki breathes out a curtain of running water in front of itself that holds until a shot comes.
  hyponome_exhale: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 8, k = ease(prog(t, 2, hitOf(r))), L = hold(t, 0, r.end, 5);
      for (let q = 0; q < 6; q++) { const y = U.y - 6 + q * 2.4, len = Math.round(k * 4); line(x, y, x + face(U) * len, y + ((t + q) & 1), q % 2 ? HYP.blue : HYP.white, L); }
      for (let j = 0; j < 14 * k; j++) px(x, U.y + 6 - j, ((j + t) % 4) < 2 ? W : HYP.blue, L);
    },
  },

  // Full Jet: Puhalki's Jet Shell cracks open under it, and a great jet sweeps across every foe and bursts in rings.
  hyponome_jet: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; jetShell(U.x, U.y + 4, hold(t, 0, leaveOf(r) + 6, 3), t > 8 ? 1 : 0); if (t > 8 && t < 20) chunks(U.x, U.y + 5, t - 8, 4, r.seed, [HYP.shell, HYP.band], 12, 0.8); },
    front(r) {
      const t = r.t, U = r.from, on = hold(t, leaveOf(r), lastOf(r) + 4, 2);
      flying(r, p => { if (p.i === 0 && on > 0) jet(U, { x: p.x, y: p.y }, t, 3, on); });
      landed(r, 18, (E, a, i) => { if (i % 3 === 0) { ring(E.x, E.y + 3, 3 + hs(a, 4) * 0.9, HYP.white, fade(a, 18)); for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.6, vy = -1.5 - hash(r.seed + q + i) * 0.8; px(E.x + vx * a, E.y + 2 + vy * a + 0.12 * a * a, q % 2 ? HYP.blue : W, fade(a, 18)); } } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Tynagi
  // Still Lap: a flat lap of still water runs out to the foe and back, and the dial over Tynagi turns its hand back as it heals.
  slackwater_lap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from;
      flying(r, p => stillLine(p.x - 4, p.x + 4, p.y + 4));
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 4; q++) { const vx = (q - 1.5) * 0.6, vy = -1.2 - hash(r.seed + q + i) * 0.6; px(E.x + vx * a, E.y + 3 + vy * a + 0.12 * a * a, q % 2 ? TYN.gray : W, fade(a, 14)); } });
      dial(signAt(U, 8).x, signAt(U, 8).y, 4, -Math.PI / 2 - prog(t, hitOf(r), r.end) * Math.PI * 1.5, hold(t, 0, r.end, 4));
      const a = t - lastOf(r);
      if (a >= 0) motes(U.x, U.y, a, 4, r.seed, [TYN.pale, TYN.gray], 14, 5);
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Slacken: two slow dials drift to the foe, and one hangs over it with its hand dragging round, everything it does slower.
  slackwater_slacken: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r);
      flying(r, p => dial(p.x, p.y, 3, t * 0.1, 1));
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); dial(signAt(E, 0).x, signAt(E, 0).y, 4, -Math.PI / 2 + a * 0.03, L); for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + a * 0.05; px(E.x + Math.cos(g) * 7, E.y + 1 + Math.sin(g) * 4, q % 2 ? TYN.gray : TYN.slate, L); } }
    },
  },

  // Running Tide: the slack water runs again. Small breaking waves roll out to the foe and burst on it, and the dial over
  // Tynagi turns its hand forward a full round.
  slackwater_flood: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from;
      flying(r, p => { line(p.x - 4, p.y + 2, p.x, p.y + 2, TYN.pale, 1); px(p.x + 1, p.y + 1, W, 1); px(p.x + 2, p.y + 2, TYN.slate, 1); px(p.x - 2, p.y + 3, TYN.gray, 1); });
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.7, vy = -1.5 - hash(r.seed + q + i) * 0.6; px(E.x + vx * a, E.y + 3 + vy * a + 0.12 * a * a, q % 2 ? TYN.gray : W, fade(a, 14)); } });
      dial(signAt(U, 8).x, signAt(U, 8).y, 4, -Math.PI / 2 + prog(t, 0, r.end) * Math.PI * 2, hold(t, 0, r.end, 4));
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Hold Still: the water at Tynagi's feet goes dead level, and a still ring stands round it with its ticks stopped.
  slackwater_hold: {
    tail: 8, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) stillLine(U.x - 9, U.x + 9, U.y + 6, fade(a, r.end - hitOf(r), 6)); },
    front(r) {
      const a = r.t - hitOf(r), U = r.from;
      if (a < 0) return;
      const L = fade(a, r.end - hitOf(r), 6);
      arc(U.x, U.y, 8, 7, TYN.pale, L);
      for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2; px(U.x + Math.cos(g) * 6.5, U.y + Math.sin(g) * 5.5, q % 2 ? TYN.slate : TYN.cream, L); }
      if (a < 4) arc(U.x, U.y, 10 - a, 9 - a, W, 1 - a / 4);
    },
  },

  // ---------------- Soryubi
  // Cold Drip: a cold drop flies to the foe, a brinicle grows down onto it from above, and frost spreads round its feet.
  brinicle_drip: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { blit(SEI_DROP, p.x, p.y, { f: W, g: BRI.blue, d: BRI.navy }, 1); tail(p.x, p.y, p.ux, p.uy, [BRI.ice, BRI.blue]); });
      landed(r, r.end, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 6), top = E.y - (high(E) ? 8 : 14);
        icicle(E.x, top, Math.round(Math.min(1, (a + 1) / 4) * (E.y - 2 - top)), L);
        frostLine(E.x, E.y + 6, Math.min(8, 2 + a), r.seed, L);
      });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Brine Ring: crystals of brine circle Soryubi and fly out, and a ring of ice freezes round every foe's feet.
  brinicle_spray: {
    noFlights: true, noLandings: true,
    back(r) { r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6), k = Math.min(1, (a + 1) / 6); arc(E.x, E.y + 6, 8 * k, 2.5 * k, BRI.ice, L); arc(E.x, E.y + 7, 8 * k, 2.5 * k, BRI.blue, L * 0.75); } }); },
    front(r) {
      flying(r, p => { blit(['ww', 'wb'], p.x, p.y, { w: BRI.ice, b: BRI.blue }, 1); if ((r.t + p.i) & 2) px(p.x - 1, p.y - 1, W, 1); });
      landed(r, 12, (E, a, i) => { if (i < r.to.length) for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2, d = 4 + hs(a) * 0.5; glint(E.x + Math.cos(g) * d * 1.5, E.y + 5 + Math.sin(g) * d * 0.4, BRI.blue, fade(a, 12)); } });
    },
  },

  // Freeze Line: Soryubi stamps, and a line of ice freezes along the bottom from it to the foe, three shards of ice jutting up.
  brinicle_line: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, E = aim(r), a = t - r.contact;
      if (a < 0) return;
      const u = Math.min(1, a / Math.max(1, hitOf(r) - r.contact)), L = fade(t - hitOf(r), r.end - hitOf(r), 6), n = 14;
      for (let q = 0; q <= n * u; q++) { const k = q / n, x = U.x + (E.x - U.x) * k, y = U.y + 6 + (E.y - U.y) * k; px(x, y, q % 2 ? BRI.ice : BRI.blue, a < hitOf(r) - r.contact + 4 ? 1 : L); px(x + 1, y, BRI.navy, L); }
    },
    front(r) {
      flying(r, p => { const y = p.E.y + 6 + (r.from.y - p.E.y) * (1 - p.u), x = r.from.x + (p.E.x - r.from.x) * p.u; icicle(x, y - 5, 5, 1, 1); });
      landed(r, r.end, (E, a, i) => { if (i === 0) frostLine(E.x, E.y + 6, Math.min(9, 2 + a), r.seed, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Sea Floor: a great brinicle grows down out of the sky onto the foe, ice runs along the whole floor, and brine crystals shatter round it in the glare.
  brinicle_floor: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 0, r.end, 6), top = high(E) ? 6 : E.y - 24;
      icicle(E.x, top, Math.round(ease(prog(t, 0, hit)) * (E.y - 2 - top)), L, 3);
      const a = t - hit;
      if (a >= 0) { const reach = Math.min(48, a * 4); frostLine(E.x, E.y + 6, Math.min(14, 3 + a), r.seed, fade(a, r.end - hit, 6)); line(Math.max(0, E.x - reach), 58, Math.min(95, E.x + reach), 58, BRI.ice, fade(a, r.end - hit, 6)); }
    },
    front(r) {
      flying(r, p => { blit(['ww', 'wb'], p.x, p.y, { w: BRI.ice, b: BRI.blue }, 1); px(p.x, p.y - 2, W, 0.5); });
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) for (let q = 0; q < 7; q++) { const g = q / 7 * Math.PI * 2 + 0.3, d = 2 + hs(a, 5) * 0.9; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? BRI.ice : W, fade(a, 18)); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 12, lv: 1.4 * hold(r.t, hitOf(r) - 4, r.end, 4), tint: BRI.ice }]; },
  },


  // ---------------- Yliri
  // Cross Over: a moon hangs over the foe, a star streaks in and crosses its face, and the crossing plays again, fainter.
  transit_cross: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), M = signAt(E, 0), L = hold(t, 0, r.end, 4);
      transitAt(M.x, M.y, 4, prog(t, hit - 4, hit + 4), L);
      if (t > hit + 6) transitAt(M.x, M.y, 4, prog(t, hit + 6, hit + 14), 0.5 * L);
      flying(r, p => { glint(p.x, p.y, YLI.star, 1); tail(p.x, p.y, p.ux, p.uy, [YLI.pale, YLI.blue]); });
      landed(r, 18, (P, a) => { for (let q = 0; q < 4; q++) { const ph = (a + q * 3) % 8; if (ph < 4 && a > 1) glint(P.x + [-6, 5, -3, 6][q], P.y + [-3, -4, 4, 3][q], YLI.blue, fade(a, 18)); } });
    },
    lights(r) { return flyLights(r, YLI.pale); },
  },

  // Late Light: a spark rises beside Yliri and stays there under a small moon, a Late Spark waiting its turn.
  transit_late: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10;
      flying(r, p => glint(x, U.y + 6 - p.u * 12, YLI.star, 1));
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), y = U.y - 6 + Math.round(Math.sin(a * 0.2)); transitAt(x + 3, y - 3, 2, 0, L * 0.75); glint(x, y, YLI.star, L); arc(x, y, 3, 2, YLI.blue, L, a * 0.03, a * 0.03 + 0.6); }
    },
  },

  // Moon Pass: a moon lobs over and passes across the foe, then comes back to hang before Yliri as a guard.
  transit_eclipse: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from;
      flying(r, p => transitAt(p.x, p.y, 3, 0, 1));
      landed(r, r.end, (E, a) => {
        if (a < 8) { transitAt(E.x, E.y - 1, 5, a / 8, 0.5); arc(E.x, E.y - 1, 5, 5, YLI.pale, 1); }
        const u = prog(a, 6, 16), k = fade(a, r.end - hitOf(r), 6);
        if (u > 0) { const P = { x: U.x + face(U) * 7, y: U.y - 3 }, x = E.x + (P.x - E.x) * ease(u), y = E.y + (P.y - E.y) * ease(u) - Math.sin(Math.PI * u) * 8; arc(x, y, 4, 4, YLI.pale, k, 0.6, 1.4); arc(x, y, 3, 3, YLI.blue, k, 0.6, 1.4); }
      });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, YLI.pale); },
  },

  // Played Back: the night of the crossing plays over Yliri's side, stars circle, and a second showing of Yliri stands beside it.
  transit_double: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), B = signAt(U, -8);
      wash(YLI.navy, 0.125 * L);
      transitAt(B.x, B.y, 5, (t % 30) / 30, L);
    },
    front(r) {
      const t = r.t, U = r.from, n = landedN(r);
      flying(r, p => glint(p.x, p.y, YLI.star, 1));
      if (n) { const x = U.x + face(U) * 11, L = hold(t, hitOf(r), r.end, 4) * (n >= 3 ? 0.75 : 0.5); arc(x, U.y, 4, 5, YLI.pale, L); arc(x, U.y, 3, 4, YLI.blue, L); line(x - 4, U.y + 6, x + 4, U.y + 6, YLI.pale, L); }
      landed(r, 10, (E, a) => sparks(U.x + face(U) * 11, U.y, a, 5, r.seed + a, W, YLI.pale, 8, 0.8));
    },
  },

  // ---------------- Paimori
  // Drop Stone: Paimori heaves up a heavy sinker that comes down on the foe and drives the ground in under it.
  ballast_drop: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 22, (E, a) => { const w = Math.min(10, 3 + a * 2); oval(E.x, E.y + 6, w, 1.5, BAL.purple, fade(a, 22)); arc(E.x, E.y + 6, w, 1.5, BAL.teal, fade(a, 22), 0, 0.5); }); },
    front(r) {
      flying(r, p => sinker(p.x, p.y));
      landed(r, 16, (E, a) => chunks(E.x, E.y + 3, hs(a, 4), 6, r.seed, [BAL.teal, BAL.purple], 16, 1.2));
    },
    scene(r) { return jolt(r, 10, 2); },
    lights(r) { return flyLights(r, BAL.teal); },
  },

  // Storm Stone: Paimori stamps and its stones settle round it in a low wall tied with pink cord, its Barrier.
  ballast_storm: {
    tail: 8, noLandings: true,
    back(r) {
      const a = r.t - hitOf(r), U = r.from;
      if (a < 0) return;
      const L = fade(a, r.end - hitOf(r), 6);
      for (let q = 0; q < 5; q++) { const g = (0.05 + q * 0.1) * Math.PI * 2, y0 = U.y + 3 + Math.sin(g) * 4 - Math.max(0, 6 - a - q) * 2; sinker(U.x + Math.cos(g) * 9, y0, L); }
    },
    front(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) { arc(U.x, U.y + 5, 9, 3, BAL.pink, fade(a, r.end - hitOf(r), 6), 0, 0.5); chunks(U.x, U.y + 6, a, 4, r.seed, [BAL.teal, BAL.purple], 10, 0.6); } },
  },

  // Sink Room: two sinkers drop on the foe from above, and a ring of stones settles round Paimori.
  ballast_room: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { sinker(p.x, p.y); px(p.x, p.y - 4, BAL.light, 0.5); });
      landed(r, 14, (E, a, i) => chunks(E.x, E.y + 3, hs(a), 4, r.seed + i, [BAL.teal, BAL.purple], 14));
      const a = r.t - lastOf(r), U = r.from;
      if (a >= 0) arc(U.x, U.y + 5, 8, 3, BAL.teal, fade(a, r.end - lastOf(r), 6));
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, BAL.teal); },
  },

  // Full Hold: Paimori's sack swells and tips over, stones pour down on every foe, and they are held down under the pile.
  ballast_hold: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, B = signAt(U, 0), L = hold(t, 0, leaveOf(r) + 6, 4);
      sack(B.x, B.y, L, ease(prog(t, 0, 10)));
      r.to.forEach((E, j) => { const n = r.hits.filter(h => h.to === j && t >= h.at).length; for (let q = 0; q < Math.min(n, 5); q++) sinker(E.x - 6 + (q % 3) * 5 + (q > 2 ? 2 : 0), E.y + 5 - (q > 2 ? 3 : 0), fade(t - hitAt(r, j), r.end - hitAt(r, j), 6)); });
    },
    front(r) {
      flying(r, p => sinker(p.x, p.y));
      landed(r, 12, (E, a, i) => { if (i % 3 === 0) chunks(E.x, E.y + 4, hs(a), 5, r.seed + i, [BAL.teal, BAL.purple], 12); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 12, 2) }; },
  },

  // ---------------- Monti
  // Gate Slap: a small gate drops shut beside Monti's ally and crackles with charge along its edge, a Charged Shell.
  sluice_slap: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, a = t - hitOf(r); gate(U.x + face(U) * 10, U.y + 6, 12, a < 0 ? 1 - prog(t, 2, hitOf(r)) : 0, t, hold(t, 0, r.end, 4)); },
    front(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, a = t - hitOf(r);
      flying(r, p => { blit(['.p.', 'pbp', '.p.'], p.x, p.y, { p: SLU.pale, b: SLU.blue }, 1); });
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 3; q++) { const y = U.y + 5 - ((a * 2 + q * 4) % 12); px(x - 4, y, W, L); px(x + 4, y + 2, '#f0e060', L); } }
    },
  },

  // Back Flow: a gate rises behind the foe, water runs back through it, and the bench whorl is pulled out into the flow.
  sluice_backflow: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), away = high(E) ? 1 : -1, gx = E.x + away * 11, L = hold(t, 0, r.end, 4);
      gate(gx, E.y + 6, 12, ease(prog(t, 0, hitOf(r))), t, L);
      if (t >= hitOf(r) - 4) for (let q = 0; q < 4; q++) { const k = ((t * 0.8 + q * 3) % 12), x = gx - away * k; line(x, E.y + 3 + q, x - away * 2, E.y + 3 + q, q % 2 ? SLU.water : SLU.pale, L); }
    },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, SLU.blue, 1); px(p.x, p.y, W, 1); });
      landed(r, 18, (E, a) => { for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + a * 0.35, d = 9 * (1 - a / 18) + 1; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.6, q % 2 ? SLU.water : SLU.pale, fade(a, 18)); } });
    },
    lights(r) { return flyLights(r, SLU.water); },
  },

  // Gate Bolt: the gate beside Monti flies open and its ally rushes through on a fast run of water.
  sluice_bolt: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; gate(U.x + face(U) * 10, U.y + 6, 12, ease(prog(t, 0, hitOf(r))), t * 2, hold(t, 0, r.end, 4)); },
    front(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 4, p.y - p.uy * 4, SLU.water, 1); px(p.x, p.y, W, 1); });
      if (a >= 0) { const L = fade(a, r.end - hitOf(r)); for (let q = 0; q < 3; q++) { const len = 3 + ((a >> 1) + q) % 3; line(U.x - face(U) * 5, U.y - 2 + q * 2, U.x - face(U) * (5 + len), U.y - 2 + q * 2, SLU.pale, L); } }
    },
  },

  // Swap Rooms: a great gate stands in the middle of the field and lifts, and the two sides' rooms slide past each other and change places.
  sluice_swap: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), S = r.from, E = aim(r), M = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 + 4 };
      gate(M.x, M.y + 6, 16, ease(prog(t, 8, hitOf(r))), t, L);
      const u = ease(prog(t, hitOf(r) - 6, lastOf(r) + 6));
      for (const [A, B, c] of [[S, E, SLU.blue], [E, S, SLU.pale]] as [Pt, Pt, string][]) {
        const x = A.x + (B.x - A.x) * u, y = A.y + (B.y - A.y) * u;
        if (u > 0 && u < 1) { line(x - 7, y - 7, x + 7, y - 7, c, L); line(x - 7, y + 6, x + 7, y + 6, c, L); line(x - 7, y - 7, x - 7, y + 6, c, L); line(x + 7, y - 7, x + 7, y + 6, c, L); }
      }
    },
    front(r) {
      flying(r, p => { arc(p.x, p.y, 2.5, 2.5, SLU.pale, 1); px(p.x, p.y, SLU.blue, 1); });
      landed(r, 14, (E, a) => { sparks(E.x, E.y, hs(a, 4), 8, r.seed + a, W, SLU.water, 12, 1.2); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Mukabe
  // Wall Slam: a curved wall of the shell swings in with Mukabe and slams the foe, cracking the ground.
  septum_slam: {
    noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, SEP.dark, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, SEP.pale, fade(a, 18)); }); },
    front(r) {
      const t = r.t, U = userAt(r), d = face(r.from), hit = hitOf(r);
      if (t <= hit + 4) septWall(U.x + d * 6, U.y + 5, 11, d, hold(t, 0, hit + 4, 2));
      landed(r, 10, (E, a) => { if (a < 3) arc(E.x, E.y, 5, 5, W, 1); sparks(E.x, E.y, hs(a), 6, r.seed, SEP.nacre, SEP.slate, 8); });
    },
    scene(r) { return jolt(r, 5, 1); },
  },

  // Chamber Knock: Mukabe stamps against the curved wall behind it, knocks ripple out across it, and the room settles round it.
  septum_knock: {
    tail: 8, noLandings: true,
    back(r) { const t = r.t, U = r.from; septWall(U.x - face(U) * 8, U.y + 6, 14, -face(U), hold(t, 0, r.end, 4), 3); },
    front(r) {
      const a = r.t - hitOf(r), U = r.from, x = U.x - face(U) * 8;
      if (a < 0) return;
      for (let q = 0; q < 2; q++) { const b = a - q * 4; if (b >= 0 && b < 10) arc(x, U.y - 1, 2 + b * 0.8, 3 + b, q ? SEP.slate : SEP.pale, fade(b, 10), face(U) > 0 ? 0.75 : 0.25, face(U) > 0 ? 1.25 : 0.75); }
      motes(U.x, U.y, a, 4, r.seed, [SEP.pale, SEP.nacre], 16, 5);
    },
  },

  // Seal Room: a piece of wall flies at the foe, and a curved wall rises behind it and stays, sealing it in.
  septum_seal: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, r.end, (E, a) => septWall(E.x + (high(E) ? 9 : -9), E.y + 6, Math.round(Math.min(1, (a + 1) / 4) * 13), high(E) ? -1 : 1, fade(a, r.end - hitOf(r), 6), 3)); },
    front(r) {
      flying(r, p => { line(p.x, p.y - 3, p.x + 1, p.y + 3, SEP.slate, 1); line(p.x + 1, p.y - 3, p.x + 2, p.y + 3, SEP.pale, 1); });
      landed(r, 12, (E, a) => chunks(E.x, E.y + 3, hs(a), 4, r.seed, [SEP.slate, SEP.pale], 12));
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, SEP.pale); },
  },

  // Seal Shot: walls rise on both sides of the foe to seal it in, three shards of wall fly through it, and the walls crack on it.
  septum_shot: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6), h = Math.round(13 * ease(prog(t, 0, 10)));
      for (const s of [-1, 1]) septWall(E.x + s * 9, E.y + 6, h, -s, L, 3);
    },
    front(r) {
      flying(r, p => { line(p.x, p.y - 2, p.x + 1, p.y + 2, SEP.slate, 1); px(p.x + 1, p.y - 2, SEP.nacre, 1); });
      landed(r, 18, (E, a, i) => { sparks(E.x, E.y, hs(a), 6, r.seed + i, SEP.nacre, SEP.slate, 10, 1.1); if (i === r.hits.length - 1) for (let q = 0; q < 3; q++) line(E.x - 2 + q * 2, E.y - 4, E.x - 3 + q * 3, E.y + 3, SEP.dark, fade(a, 18)); });
      const a = r.t - lastOf(r);
      if (a >= 4) motes(r.from.x, r.from.y, a - 4, 4, r.seed, [SEP.pale, SEP.nacre], 14, 5);
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Hafusen
  // Old Air: a sealed bubble of old air drifts to the foe and pops, and a cloud of stale gold dust hangs round it.
  vacuole_old: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => oldAir(p.x, p.y, 3.5, r.t));
      landed(r, 18, (E, a) => { if (a < 3) arc(E.x, E.y, 4 + a, 4 + a, W, 1); for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + a * 0.03, d = 3 + hs(a) * 0.5; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7 - a * 0.15, q % 2 ? VAC.gold : VAC.brown, fade(a, 18, 8)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, VAC.gold); },
  },

  // Thin Out: two gold stars fly in, and the air round the foe is drawn away from it, leaving it standing in a thin pale outline.
  vacuole_vacuum: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { glint(p.x, p.y, VAC.gold, 1); tail(p.x, p.y, p.ux, p.uy, [VAC.white, VAC.gold]); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2, d = 4 + Math.min(10, a * 0.7); px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, q % 2 ? VAC.gold : VAC.white, fade(a, 14)); } arc(E.x, E.y, 6, 6, VAC.white, 0.5 * L); }
    },
    lights(r) { return flyLights(r, VAC.gold); },
  },

  // Kept Air: a bubble of old air closes round Hafusen's ally, and gold corners frame the moment it keeps.
  vacuole_shell: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      flying(r, p => oldAir(p.x, p.y, 2.5, t));
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); oldAir(U.x, U.y, 8, t, L); keptFrame(U.x, U.y, 10 - Math.min(3, a / 2), L); }
    },
  },

  // Old Year: gold dust fills the air, bubbles circle and pop on the foe, and gold corners close round it to keep this moment.
  vacuole_wall: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6); for (let q = 0; q < 16; q++) { const x = (hash(q * 7) * 96 + t * 0.2) % 96, y = (hash(q * 13) * 50 + Math.sin(t * 0.05 + q) * 2); px(x, y, q % 3 ? VAC.gold : VAC.brown, L * 0.75); } },
    front(r) {
      const t = r.t, E = aim(r);
      flying(r, p => oldAir(p.x, p.y, 3, t));
      landed(r, 10, (P, a) => { if (a < 3) arc(P.x, P.y, 3 + a, 3 + a, W, 1); });
      const a = t - hitOf(r);
      if (a >= 0) keptFrame(E.x, E.y, Math.max(7, 14 - a * 0.7), fade(a, r.end - hitOf(r), 6));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
  },

  // ---------------- Kuorisho
  // Salt Flake: a flake of salt shatters on the foe, and a ring of salt lifts off it and flies back to Kuorisho.
  evaporite_flake: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { blit(['ww', 'wg'], p.x, p.y, { w: EVA.white, g: EVA.gold }, 1); tail(p.x, p.y, p.ux, p.uy, [EVA.white, EVA.gray]); });
      landed(r, r.end, (E, a) => {
        if (a < 14) for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 2 + hs(a) * 0.8; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? EVA.white : EVA.gold, fade(a, 14)); }
        const u = ease(prog(a, 3, r.end - hitOf(r) - 2)), S = r.from;
        if (u > 0 && u < 1) arc(E.x + (S.x - E.x) * u, E.y + 6 + (S.y - E.y) * u - Math.sin(Math.PI * u) * 12, 5, 1.5, EVA.white, 1);
      });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, EVA.white); },
  },

  // Dry Ring: Kuorisho stamps, rings of dried salt spread out under every foe and crack, and the salt they take mends it.
  evaporite_ring: {
    noFlights: true, noLandings: true,
    back(r) { r.to.forEach((E, j) => { const a = r.t - hitAt(r, j) + 6; if (a >= 0) saltRings(E.x, E.y + 6, 3, Math.min(11, 3 + a), fade(a, r.end - hitAt(r, j) + 6, 6)); }); },
    front(r) {
      flying(r, p => blit(['ww', 'wg'], p.x, p.y, { w: EVA.white, g: EVA.gold }, 1));
      landed(r, 12, (E, a, i) => { if (i < r.to.length) chunks(E.x, E.y + 5, hs(a), 5, r.seed + i, [EVA.white, EVA.gold], 12); });
      const a = r.t - lastOf(r);
      if (a >= 0) motes(r.from.x, r.from.y, a, 4, r.seed, [EVA.white, EVA.gold], 14, 5);
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Draw Water: rings of salt dry out beside Kuorisho and stack up into a Salt Tomb.
  evaporite_draw: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, L = hold(t, 0, r.end, 4);
      saltRings(x, U.y + 6, 3, 6, L * (1 - prog(t, hitOf(r), lastOf(r))));
      const n = landedN(r);
      for (let q = 0; q < n * 2; q++) arc(x, U.y + 5 - q * 2, 4 - q * 0.4, 1.2, [EVA.white, EVA.gold, EVA.gray][q % 3], L);
    },
    front(r) { const U = r.from, x = U.x + face(U) * 10; flying(r, p => blit(['ww', 'wg'], x - 2 + p.i * 3, U.y + 6 - p.u * 8, { w: EVA.white, g: EVA.gold }, 1)); },
  },

  // Dry Room: the whole room dries, salt rings spread round both sides, salt closes on the foe, and two rings lift off it home to Kuorisho.
  evaporite_room: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12));
      bands(0, 96, Math.round(52 + 8 * g), [['#a8d8f0', 1], ['#2a58b8', 7]], L * (1 - g));
      for (const P of [r.from, aim(r)]) saltRings(P.x, P.y + 6, 3, 4 + 8 * g, L);
    },
    front(r) {
      flying(r, p => blit(['ww', 'wg'], p.x, p.y, { w: EVA.white, g: EVA.gold }, 1));
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) for (let q = 0; q < 7; q++) { const g = q / 7 * Math.PI * 2 + 0.3, d = 2 + hs(a, 5) * 0.9; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? EVA.white : EVA.gold, fade(a, 18)); } });
      const a = r.t - lastOf(r), E = aim(r), S = r.from;
      for (let q = 0; q < 2; q++) { const u = ease(prog(a, 4 + q * 4, 18 + q * 4)); if (u > 0 && u < 1) arc(E.x + (S.x - E.x) * u, E.y + 6 + (S.y - E.y) * u - Math.sin(Math.PI * u) * 12, 5, 1.5, q ? EVA.gold : EVA.white, 1); }
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Hupfuta
  // Hood Knock: Hupfuta comes in behind its shut hood and knocks the foe with it, and the ground cracks.
  hood_knock: {
    noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, HOO.dark, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, HOO.cream, fade(a, 18)); }); },
    front(r) {
      const t = r.t, U = userAt(r), d = face(r.from), hit = hitOf(r);
      if (t <= hit + 3) hoodDoor(U.x + d * 6, U.y, 5, 9, 0, hold(t, 0, hit + 3, 2));
      landed(r, 10, (E, a) => { for (let q = 0; q < 2; q++) { const b = a - q * 3; if (b >= 0 && b < 7) arc(E.x - d * 3, E.y, 3 + b, 3 + b, q ? HOO.cream : W, fade(b, 7), d > 0 ? 0.25 : 0.75, d > 0 ? 0.75 : 1.25); } });
    },
    scene(r) { return jolt(r, 5, 1); },
  },

  // Purify: Hupfuta's door opens on its ally and cream light spills out to mend it, and a red spark of the same goes at the foe.
  hood_purify: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = signAt(U, 8), open = ease(prog(t, 2, hitOf(r))), L = hold(t, 0, r.end, 4);
      hoodDoor(B.x, B.y, 6, 9, open, L);
      if (open > 0.5) for (let y = B.y + 5; y < U.y; y++) px(B.x + ((y + t) % 3) - 1, y, HOO.cream, 0.5 * L);
      const a = t - hitOf(r);
      if (a >= 0) { motes(U.x, U.y, a, 6, r.seed, [HOO.cream, W], 18, 6); const E = { x: U.x + face(U) * 50, y: high(U) ? 42 : 16 }, u = prog(a, 2, 14); if (u > 0 && u < 1) glint(U.x + (E.x - U.x) * u, U.y + (E.y - U.y) * u - Math.sin(Math.PI * u) * 8, HOO.red, 1); }
    },
  },

  // Door Slam: a door flies past the foe and slams shut behind it, a red bar across it, and Hupfuta stands fortified.
  hood_holdshut: {
    noFlights: true, noLandings: true,
    back(r) {
      landed(r, r.end, (E, a) => { const x = E.x + (high(E) ? 10 : -10), L = fade(a, r.end - hitOf(r), 6); hoodDoor(x, E.y, 6, 11, Math.max(0, 1 - a / 3), L); if (a >= 3) line(x - 4, E.y, x + 4, E.y, HOO.red, L); });
    },
    front(r) {
      flying(r, p => hoodDoor(p.x, p.y, 4, 6, (r.t >> 1) & 1 ? 0.5 : 0, 1));
      landed(r, 14, (E, a) => chunks(E.x, E.y + 3, hs(a), 5, r.seed, [HOO.brown, HOO.cream], 14));
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 0) arc(U.x, U.y + 1, 7, 6, HOO.cream, fade(a, r.end - hitOf(r), 6) * ((a >> 2) & 1 ? 1 : 0.5));
    },
    scene(r) { return jolt(r, 8, 2); },
  },

  // Shut Door: a great hood stands over Hupfuta's side, shells circle, and the door swings shut in steps, a pillar of cream light behind it.
  hood_shutdoor: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), n = landedN(r), x = U.x + face(U) * 10;
      hoodDoor(x, U.y - 3, 9, 15, Math.max(0, 1 - n / 3) * ease(prog(t, 0, 10)), L);
      const a = t - lastOf(r);
      if (a >= 0) { const k = fade(a, r.end - lastOf(r), 6); for (let y = U.y + 6; y > U.y - 20; y--) { px(U.x, y, W, k); px(U.x - 1, y, HOO.cream, k * 0.75); px(U.x + 1, y, HOO.cream, k * 0.75); } }
    },
    front(r) {
      flying(r, p => blit(['.cb', 'cwr', 'bbr'], p.x, p.y, { c: HOO.cream, w: W, b: HOO.brown, r: HOO.red }, 1));
      landed(r, 10, (E, a) => { if (a < 4) arc(E.x, E.y + 1, 9 - a, 8 - a, HOO.cream, 1 - a / 4); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 8, 1) }; },
  },


  // ---------------- Ashiaki
  // Footfall: a giant sole presses down into the ground under the foe, and a falling star lands in the print.
  spoor_footfall: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, r.end, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); footprint(E.x, E.y + 6, Math.min(2, 1 + a / 3), face(r.from), L); starFall(E.x + 2, E.y + 5, a - 4, 10, L); }); },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 2, 2, SPO.dark, 1); arc(p.x, p.y, 2, 2, SPO.gold, 1); });
      landed(r, 14, (E, a) => chunks(E.x, E.y + 5, hs(a), 6, r.seed, [SPO.brown, SPO.rim], 14));
    },
    scene(r) { return jolt(r, 6, 1); },
    lights(r) { return flyLights(r, SPO.gold); },
  },

  // Toe Prints: two toe prints splash down on the foe and fill with water, and a Live Print sets beside Ashiaki.
  spoor_toes: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) { footprint(U.x + face(U) * 12, U.y + 6, 1, face(U), fade(a, r.end - hitOf(r), 6)); starFall(U.x + face(U) * 12, U.y + 5, a - 2, 10); } },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 1.5, 1, SPO.dark, 1); px(p.x, p.y - 1, SPO.brown, 1); });
      landed(r, 14, (E, a, i) => { oval(E.x + (i ? 3 : -3), E.y + 6, 2, 1, '#7ab0d8', fade(a, 14)); for (let q = 0; q < 4; q++) { const vx = (q - 1.5) * 0.6, vy = -1.2 - hash(r.seed + q + i) * 0.5; px(E.x + (i ? 3 : -3) + vx * a, E.y + 4 + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : W, fade(a, 14)); } });
    },
  },

  // Print Guard: Ashiaki stamps, two footprints press into the ground on either side of it, and stars fall into them.
  spoor_guard: {
    tail: 10, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a < 0) return; const L = fade(a, r.end - hitOf(r), 6); for (const s of [-1, 1]) { footprint(U.x + s * 11, U.y + 6, Math.min(1.2, 0.6 + a * 0.15), face(U), L); starFall(U.x + s * 11, U.y + 5, a - (s > 0 ? 3 : 6), 10, L); } },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Walk Back: a line of giant footprints walks across the field with stars falling into them, and the last ones stamp down on every foe.
  spoor_walkback: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), L = hold(t, 0, r.end, 6), n = Math.min(5, Math.floor(t / 4));
      for (let q = 0; q < n; q++) { const u = (q + 1) / 6, x = S.x + (E.x - S.x) * u, y = S.y + 6 + (E.y - S.y) * u; footprint(x + (q % 2 ? 2 : -2), y, 0.8, face(S), L * 0.75); if (q === n - 1) starFall(x, y - 1, t % 4 * 2, 8, L); }
      r.to.forEach((P, j) => { const a = t - hitAt(r, j); if (a >= 0) footprint(P.x, P.y + 6, 1.8, face(S), fade(a, r.end - hitAt(r, j), 6)); });
    },
    front(r) {
      smear(r, SPO.rim, SPO.dark);
      landed(r, 16, (E, a, i) => { if (i < r.to.length) chunks(E.x, E.y + 5, hs(a, 5), 7, r.seed + i, [SPO.brown, SPO.gold], 16, 1.2); });
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Tulisei
  // Cinder Flick: three burning cinders flick out and sweep through every foe, leaving sparks drifting up.
  bolide_flick: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => meteor(p.x, p.y, p.ux, p.uy, 5, r.t));
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0 && a < 18) for (let q = 0; q < 5; q++) { const b = a - q; if (b >= 0) px(E.x + (hash(r.seed + q + j) - 0.5) * 12 + Math.sin(b / 3), E.y + 2 - b * 0.7, (b + q) % 3 ? BOL.orange : BOL.pale, fade(a, 18)); } });
    },
    lights(r) { return flyLights(r, BOL.orange); },
  },

  // Bright Streak: a bright meteor streaks over to the foes and burns a glowing crack into the ground under them.
  bolide_streak: {
    noFlights: true, noLandings: true,
    back(r) { r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const reach = Math.round(10 * Math.min(1, (a + 1) / 4)), L = fade(a, r.end - hitAt(r, j), 6); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, BOL.orange, L); line(E.x - reach + 3, E.y + 5, E.x + reach - 3, E.y + 5, BOL.pale, L); line(E.x - reach, E.y + 7, E.x + reach, E.y + 7, BOL.red, L); } }); },
    front(r) {
      flying(r, p => meteor(p.x, p.y, p.ux, p.uy, 10, r.t));
      landed(r, 14, (E, a, i) => { if (a < 3) oval(E.x, E.y, 4, 4, BOL.pale, 0.5); sparks(E.x, E.y, hs(a), 8, r.seed + i, W, BOL.orange, 12, 1.2); });
    },
    scene(r) { return jolt(r, 6, 1); },
    lights(r) { return flyLights(r, BOL.orange); },
  },

  // Strike Ring: four embers circle Tulisei and close into a ring of fire round it, and three flames of Heat flare over it.
  bolide_ring: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), U = userAt(r), L = hold(r.t, hitOf(r), r.end, 4); if (n) { arc(U.x, U.y + 3, 9, 3, BOL.orange, L); arc(U.x, U.y + 4, 9, 3, BOL.red, L * 0.75); } },
    front(r) {
      const t = r.t, U = userAt(r);
      flying(r, p => { const g = p.u * Math.PI * 4 + p.i * Math.PI / 2; meteor(U.x + Math.cos(g) * 9, U.y + 3 + Math.sin(g) * 3, Math.sin(g), -Math.cos(g) * 0.3, 3, t); });
      const n = landedN(r);
      if (n) { arc(U.x, U.y + 3, 9, 3, BOL.pale, hold(t, hitOf(r), r.end, 4), 0, 0.5); heatPips(U.x, U.y - 8, Math.min(3, n), t, hold(t, hitOf(r), r.end, 4)); }
    },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y) + 2, r: 10, lv: 1.2 * hold(r.t, hitOf(r), r.end, 4), tint: BOL.orange }]; },
  },

  // White Line: a star falls burning out of the sky behind Tulisei, and it throws a line of white heat straight through the foe.
  bolide_whiteline: {
    lead: 16, tail: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, u = ease(prog(t, 0, 16)); if (t < 18) meteor(U.x - face(U) * (20 - 14 * u), -4 + (U.y - 6) * u, face(U) * 0.6, 0.8, 8, t); },
    front(r) {
      const t = r.t, U = r.from, E = aim(r), on = hold(t, leaveOf(r), hitOf(r) + 6, 2);
      if (t >= 16 && t < 22) { oval(U.x, U.y, 5, 5, BOL.pale, 0.5); arc(U.x, U.y, 6, 6, BOL.orange, 1); }
      if (on > 0) { const k = Math.min(1, (t - leaveOf(r) + 1) / 4), X = { x: U.x + (E.x - U.x) * k, y: U.y + (E.y - U.y) * k }; thick(U.x, U.y, X.x, X.y, W, on, W); line(U.x, U.y + 2, X.x, X.y + 2, BOL.orange, on); line(U.x, U.y - 1, X.x, X.y - 1, BOL.pale, on); }
      landed(r, 14, (P, a) => { if (a < 4) { arc(P.x, P.y, 6 + a, 6 + a, W, 1); oval(P.x, P.y, 4, 4, BOL.pale, 0.5); } sparks(P.x, P.y, hs(a, 5), 10, r.seed, W, BOL.orange, 14, 1.3); });
    },
    scene(r) { return jolt(r, 10, 2); },
    lights(r) { return [{ x: Math.round(aim(r).x), y: Math.round(aim(r).y), r: 14, lv: 1.8 * hold(r.t, hitOf(r) - 2, hitOf(r) + 10, 3), tint: BOL.pale }]; },
  },

  // ---------------- Heinaba
  // Sprout Ring: three tussocks of dune grass sprout in a ring round the foe and hold it where it stands.
  marram_sprout: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), E = aim(r), L = fade(r.t - hitOf(r), r.end - hitOf(r), 6); for (let q = 0; q < n; q++) { const g = (0.1 + q * 0.4) * Math.PI * 2; tussock(E.x + Math.cos(g) * 8, E.y + 6 + Math.sin(g) * 1.5, Math.min(8, 3 + (r.t - r.hits[q].at)), L); } },
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 4, p.y - p.uy * 4, MAR.green, 1); px(p.x, p.y, MAR.sand, 1); });
      landed(r, 8, (E, a, i) => { const g = (0.1 + i * 0.4) * Math.PI * 2; chunks(E.x + Math.cos(g) * 8, E.y + 5, a, 3, r.seed + i, [MAR.sand, MAR.green], 8, 0.6); });
    },
    lights(r) { return flyLights(r, MAR.green); },
  },

  // Runner: a runner root creeps out under the ground from Heinaba, and two tussocks come up along it.
  marram_runner: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, d = face(U), L = hold(t, 0, r.end, 4), reach = Math.round(16 * ease(prog(t, 0, hitOf(r))));
      runner(U.x, U.x + d * reach, U.y + 7, L);
      landed(r, r.end, (E, a, i) => tussock(U.x + d * (8 + i * 7), U.y + 6, Math.min(8, 2 + a), L));
    },
    front(r) { const U = r.from, d = face(U); landed(r, 8, (E, a, i) => chunks(U.x + d * (8 + i * 7), U.y + 5, a, 3, r.seed + i, [MAR.sand, MAR.green], 8, 0.6)); },
  },

  // Walk Off: two clods of sand fly into the foe, and Heinaba walks off, leaving a runner and a tussock where it stood.
  marram_walkoff: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - lastOf(r), U = r.from; if (a >= 0) { const L = fade(a, r.end - lastOf(r), 4); runner(U.x - 8, U.x + 8, U.y + 7, L); tussock(U.x, U.y + 6, Math.min(7, 2 + a), L); } },
    front(r) {
      flying(r, p => { blit(['.ss.', 'ssss', '.ss.'], p.x, p.y, { s: MAR.sand }, 1); px(p.x, p.y - 2, MAR.green, 1); px(p.x + 1, p.y - 3, MAR.green, 1); });
      landed(r, 14, (E, a, i) => chunks(E.x, E.y + 3, hs(a), 5, r.seed + i, [MAR.sand, MAR.root], 14));
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, MAR.sand); },
  },

  // Root Run: runners spread under the whole field, stiff blades sweep through every foe, and tussocks burst up under them.
  marram_rootrun: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), reach = Math.round(48 * ease(prog(t, 0, 14)));
      runner(48 - reach, 48 + reach, 57, L);
      r.to.forEach((E, j) => { const a = t - hitAt(r, j); if (a >= 0) { const Lb = fade(a, r.end - hitAt(r, j), 6); for (let q = -1; q <= 1; q++) tussock(E.x + q * 6, E.y + 6, Math.min(10, 2 + a * 2) - Math.abs(q) * 2, Lb); } });
    },
    front(r) {
      flying(r, p => { line(p.x, p.y - 3, p.x - p.ux * 3, p.y + 3, MAR.green, 1); line(p.x + 1, p.y - 3, p.x + 1 - p.ux * 3, p.y + 3, MAR.dark, 1); });
      landed(r, 16, (E, a, i) => { if (i < r.to.length) chunks(E.x, E.y + 5, hs(a, 5), 7, r.seed + i, [MAR.sand, MAR.green, MAR.root], 16, 1.2); });
    },
    scene(r) { return jolt(r, 12, 2); },
  },

  // ---------------- Ruojiki
  // Salt Spit: Ruojiki spits a glob of salt that bursts on the foe and leaves a lump of crust stuck to it.
  saltwort_spit: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, SWO.white, 1); px(p.x + 1, p.y + 1, SWO.gray, 1); tail(p.x, p.y, p.ux, p.uy, [SWO.white, SWO.gray]); });
      landed(r, r.end, (E, a) => { if (a < 12) sparks(E.x, E.y, hs(a), 6, r.seed, W, SWO.gray, 12); crustPile(E.x, E.y + 4, 1, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, SWO.white); },
  },

  // Brine Mist: a mist of salt grains sweeps through every foe, and crust piles up on each of them.
  saltwort_mist: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { for (let q = 0; q < 5; q++) px(p.x - p.ux * q * 2 + (hash(r.seed + q + p.i) - 0.5) * 4, p.y - p.uy * q * 2 + (hash(r.seed + q * 5) - 0.5) * 4, q % 2 ? SWO.white : SWO.gray, q < 3 ? 1 : 0.5); });
      r.to.forEach((E, j) => { const n = r.hits.filter(h => h.to === j && r.t >= h.at).length; if (n) crustPile(E.x, E.y + 4, Math.min(2, n), fade(r.t - hitAt(r, j), r.end - hitAt(r, j), 6)); });
    },
  },

  // Cure Through: green stems close on every foe, and the crust on them cracks open and bursts all at once.
  saltwort_cure: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => saltStem(p.x, p.y + 3, 6, (p.x < p.E.x ? 1 : -1) * 2, 1));
      r.to.forEach((E, j) => {
        const a = r.t - hitAt(r, j);
        if (a < 0) crustPile(E.x, E.y + 4, 3, 1);
        else if (a < 14) for (let q = 0; q < 7; q++) { const g = q / 7 * Math.PI * 2 + 0.3, d = 2 + hs(a) * 0.9; line(E.x + Math.cos(g) * d, E.y + 2 + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + 2 + Math.sin(g) * (d + 2) * 0.8, q % 2 ? SWO.white : SWO.red, fade(a, 14)); }
      });
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // Pressed Flat: Ruojiki's stems press down flat, salt rains over it, and it is buried in a white mound of crust.
  saltwort_pressed: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, flat = ease(prog(t, 0, 12)), L = hold(t, 0, leaveOf(r) + 4, 4); for (let q = -2; q <= 2; q++) saltStem(U.x + q * 3, U.y + 6, Math.round(8 - flat * 5), q * (1 + flat * 3), L); },
    front(r) {
      const U = r.from, n = landedN(r);
      flying(r, p => { blit(['ww', 'wg'], p.x, p.y, { w: SWO.white, g: SWO.gray }, 1); });
      if (n) { const L = hold(r.t, hitOf(r), r.end, 5); crustPile(U.x, U.y + 6, n * 2, L); if (n >= 3) oval(U.x, U.y + 1, 6, 5, SWO.white, 0.5 * L); }
      landed(r, 10, (E, a) => sparks(U.x, U.y, a, 5, r.seed + a, W, SWO.gray, 8, 0.8));
    },
  },

  // ---------------- Shidor
  // Night Glint: a glint of glare streaks to the foe and flares flat across it, and the foe dims under it.
  albedo_glint: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { glare(p.x, p.y, 3, 1); });
      landed(r, 18, (E, a) => { if (a < 10) glare(E.x, E.y - 1, 6 + a, fade(a, 10)); if (a > 2) oval(E.x, E.y, 4, 4, ALBD.dark, 0.25 * fade(a, 18)); });
    },
    lights(r) { return flyLights(r, W); },
  },

  // White Field: a white salt flat spreads under Shidor, glare rises off it, and it mends.
  albedo_field: {
    tail: 6, noLandings: true,
    back(r) { const t = r.t, U = r.from, w = Math.round(14 * ease(prog(t, 0, hitOf(r)))), L = hold(t, 0, r.end, 5); if (w > 0) bands(U.x - w, 2 * w + 1, U.y + 5, [[W, 1], [ALBD.mauve, 2]], L); },
    front(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) { glare(U.x, U.y + 3 - a * 0.4, 7, fade(a, 12)); motes(U.x, U.y, a, 6, r.seed, [W, ALBD.mauve], 18, 7); } },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y) + 4, r: 10, lv: 1.2 * hold(r.t, 0, r.end, 5), tint: W }]; },
  },

  // Glare Link: a flat beam of glare links Shidor to the foe, Shidor is lost in its white, and the foe flares.
  albedo_link: {
    lead: 6, tail: 8, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, E = aim(r), on = hold(t, leaveOf(r), hitOf(r) + 10, 2);
      if (on > 0) { line(U.x, U.y, E.x, E.y, W, on); line(U.x, U.y + 1, E.x, E.y + 1, ALBD.mauve, on); line(U.x, U.y - 1, E.x, E.y - 1, ALBD.violet, on * 0.5); }
      if (t >= leaveOf(r)) { oval(U.x, U.y, 5, 5, W, 0.5 * hold(t, leaveOf(r), r.end, 4)); glare(U.x, U.y, 7, hold(t, leaveOf(r), r.end, 4)); }
      landed(r, 14, (P, a) => glare(P.x, P.y, 5 + a * 0.5, fade(a, 14)));
    },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y), r: 10, lv: 1.4 * hold(r.t, leaveOf(r), r.end, 4), tint: W }]; },
  },

  // Salt Flare: the night deepens over a white salt flat, salt rises round Shidor, and a great flat flare of glare crosses it with two Shines.
  albedo_flare: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12));
      wash(ALBD.dark, 0.25 * L);
      bands(0, 96, 56, [[W, 1], [ALBD.mauve, 3]], L * g);
    },
    front(r) {
      const t = r.t, U = r.from;
      flying(r, p => blit(['ww', 'wv'], p.x, p.y, { w: W, v: ALBD.mauve }, 1));
      const a = t - lastOf(r);
      if (a >= 0) { const L = fade(a, r.end - lastOf(r), 6); glare(U.x, U.y - 1, Math.min(22, 6 + a * 3), L); shine(U.x - 6, U.y - 10, L); shine(U.x + 6, U.y - 10, L); }
    },
    lights(r) { return [{ x: Math.round(r.from.x), y: Math.round(r.from.y), r: 14, lv: 1.6 * hold(r.t, lastOf(r), r.end, 4), tint: W }]; },
  },

  // ---------------- Ikapia
  // Color Jab: a blob of shifting color jabs into the foe and splashes in gold, green, and pale.
  cuttle_jab: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { chroma(p.x, p.y, 3, 2.5, r.t * 2); arc(p.x, p.y, 3, 2.5, CUT.white, 1); tail(p.x, p.y, p.ux, p.uy, [CUT.pale, CUT.gold]); });
      landed(r, 14, (E, a) => { for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5, vy = -1.3 - hash(r.seed + q) * 0.7; px(E.x + vx * a, E.y + 2 + vy * a + 0.12 * a * a, CHROMA[q % 3], fade(a, 14)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, CUT.gold); },
  },

  // Flat Clap: a cuttlebone flies and claps shut on the foe, and Ikapia fades away while a bone decoy stands in its place.
  cuttle_clap: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) cuttlebone(U.x + face(U) * 10, U.y + 2, 4, fade(a, r.end - hitOf(r), 6)); },
    front(r) {
      flying(r, p => cuttlebone(p.x, p.y, 4));
      landed(r, 12, (E, a) => { const g = Math.max(0, 4 - hs(a)); cuttlebone(E.x, E.y - 2 - g, 5, fade(a, 12)); cuttlebone(E.x, E.y + 2 + g, 5, fade(a, 12)); });
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 0) chroma(U.x, U.y, 5, 5, r.t, 0.25 * fade(a, r.end - hitOf(r), 6));
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, CUT.pale); },
  },

  // Cloud Brew: bubbles circle Ikapia and an ink cloud brews round it, colors rippling through it as the ally comes out.
  cuttle_brew: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), n = landedN(r);
      flying(r, p => { arc(p.x, p.y, 1.5, 1.5, CUT.pale, 1); px(p.x - 1, p.y - 1, W, 1); });
      if (n) { const L = hold(t, hitOf(r), r.end, 5); for (let q = 0; q < n + 1; q++) { oval(U.x + (q - 1) * 4, U.y + 2 - (q % 2) * 3, 3 + n, 2 + n * 0.5, CUT.ink, 0.5 * L); arc(U.x + (q - 1) * 4, U.y + 2 - (q % 2) * 3, 3 + n, 2 + n * 0.5, CUT.green, L, 0.5, 1); } chroma(U.x, U.y, 4, 4, t, 0.5 * L); }
    },
  },

  // Three Colors: colors run over Ikapia in three bands, three orbs fly to the foe, and its colors run back over to Ikapia.
  cuttle_three: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; chroma(U.x, U.y, 7, 6, t, 0.5 * hold(t, 0, leaveOf(r) + 4, 4)); },
    front(r) {
      const t = r.t, U = r.from;
      flying(r, p => { oval(p.x, p.y, 2, 2, CHROMA[p.i % 3], 1); px(p.x, p.y, W, 1); });
      landed(r, 16, (E, a, i) => { if (a < 4) arc(E.x, E.y, 5 + a, 5 + a, CHROMA[i % 3], 1); const u = prog(a, 2, 14); if (u > 0 && u < 1) for (let q = 0; q < 4; q++) { const k = Math.min(1, u + q * 0.05); px(E.x + (U.x - E.x) * k, E.y + (U.y - E.y) * k + (q - 1.5) * 2, CHROMA[(i + q) % 3], 1); } });
      const a = t - lastOf(r);
      if (a >= 0) chroma(U.x, U.y, 6, 5, t, 0.5 * fade(a, r.end - lastOf(r), 6));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 8, 1) }; },
    lights(r) { return flyLights(r, CUT.gold); },
  },

  // ---------------- Kutelo
  // Bell Sting: a small jelly bell flies to the foe, its tentacles whip down over it, and ripples run out.
  medusa_sting: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => jelly(p.x, p.y, 3, (r.t >> 2) & 1, r.t));
      landed(r, 14, (E, a) => { if (a < 8) jelly(E.x, E.y - 5, 4, a < 3 ? 1 : 0, r.t, fade(a, 8)); for (let q = 0; q < 2; q++) { const b = a - q * 4; if (b >= 0 && b < 10) ring(E.x, E.y + 3, 3 + b, q ? MED.blue : MED.pale, fade(b, 10)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, MED.blue); },
  },

  // Quiet Pulse: a big jelly bell over Kutelo squeezes and opens, and quiet ripples spread out round it.
  medusa_pulse: {
    tail: 8, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 5); jelly(U.x, U.y - 3, 7, Math.abs(Math.sin(t * 0.25)), t, L * 0.75); },
    front(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) for (let q = 0; q < 3; q++) { const b = a - q * 4; if (b >= 0 && b < 14) ring(U.x, U.y + 4, 4 + b, q % 2 ? MED.blue : MED.pale, fade(b, 14)); } },
  },

  // Pulse Bell: two jelly bells close on the foe, wrap it in tentacles, and draw drops of its tide out of it.
  medusa_bell: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => jelly(p.x, p.y, 3, (r.t >> 2) & 1, r.t));
      landed(r, 12, (E, a, i) => { const s = i ? 1 : -1, g = Math.max(1, 5 - hs(a)); jelly(E.x + s * g, E.y - 2, 3, 1, r.t, fade(a, 12)); });
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 0) for (let q = 0; q < 3; q++) { const b = a - q * 3; if (b >= 0 && b < 12) blit(SEI_DROP, E.x - 3 + q * 3, E.y - 6 - b, { f: W, g: MED.blue, d: MED.purple }, fade(b, 12)); }
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, MED.blue); },
  },

  // Big Ripple: a great jelly pulses beside Kutelo, ripples roll out over the whole field, the sea runs out, and every foe is splashed.
  medusa_bigripple: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = signAt(r.from, 0), L = hold(t, 0, r.end, 6), low = ease(prog(t, 4, r.end - 8));
      jelly(B.x, B.y, 6, Math.abs(Math.sin(t * 0.3)), t, hold(t, 0, leaveOf(r) + 6, 4));
      for (let q = 0; q < 3; q++) { const k = ((t * 0.04 + q / 3) % 1); arc(B.x, B.y + 4, 4 + k * 40, 2 + k * 16, q % 2 ? MED.blue : MED.pale, L * (1 - k) * 0.75); }
      bands(0, 96, Math.round(54 + 6 * low), [['#a8d8f0', 1], ['#2a58b8', 6]], L);
    },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: W, g: MED.blue, d: MED.purple }, 1));
      landed(r, 18, (E, a, i) => { if (i % 3 === 0) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.6, vy = -1.5 - hash(r.seed + q + i) * 0.7; px(E.x + vx * a, E.y + 2 + vy * a + 0.12 * a * a, q % 2 ? MED.blue : W, fade(a, 18)); } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },


  // ---------------- Pakui
  // Post Shot: a white post flies end over end and plants itself in the ground before the foe, cracking it.
  bollard_post: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, r.end, (E, a) => { const L = fade(a, r.end - hitOf(r), 6), x = E.x + (high(E) ? -7 : 7); post(x, E.y + 6, Math.min(9, 3 + a * 2), L); const reach = Math.min(8, 2 + a); line(x - reach, E.y + 7, x + reach, E.y + 7, BOLL.dark, L); }); },
    front(r) {
      flying(r, p => { const g = p.a * 0.6, c = Math.cos(g) * 3, s = Math.sin(g) * 3; thick(p.x - c, p.y - s, p.x + c, p.y + s, BOLL.white, 1, BOLL.gray); px(p.x + c, p.y + s, BOLL.mint, 1); });
      landed(r, 14, (E, a) => chunks(E.x, E.y + 3, hs(a), 5, r.seed, [BOLL.white, BOLL.dark], 14));
    },
    scene(r) { return jolt(r, 5, 1); },
    lights(r) { return flyLights(r, BOLL.white); },
  },

  // Shove Back: Pakui stamps, and three posts slide along the ground through every foe and shove them back.
  bollard_shove: {
    noFlights: true, noLandings: true,
    back(r) { flying(r, p => post(p.x, p.E.y + 6, 7, 1)); },
    front(r) { landed(r, 12, (E, a, i) => { if (i < r.to.length * 3) pushLines(E.x, E.y, r.from, hs(a), 12); }); },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Post Drive: Pakui drives itself into the ground, cracks ring out round its foot, and a white collar settles at its base.
  bollard_drive: {
    tail: 6, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, a = t - hitOf(r) + 4;
      if (a < 0) return;
      const L = fade(a, r.end - hitOf(r) + 4, 6);
      for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = Math.min(9, 2 + a); line(U.x + Math.cos(g) * 3, U.y + 6 + Math.sin(g) * 1, U.x + Math.cos(g) * d, U.y + 6 + Math.sin(g) * d * 0.3, BOLL.dark, L); }
      arc(U.x, U.y + 6, 6, 2, BOLL.white, L); arc(U.x, U.y + 7, 6, 2, BOLL.mint, L * 0.5, 0, 0.5);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 4, 1) }; },
  },

  // Four Posts: four white posts rain down round every foe and drive into the ground at its corners, and stay there.
  bollard_four: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      r.to.forEach((E, j) => { const mine = r.hits.filter(h => h.to === j); mine.forEach((h, q) => { const a = r.t - h.at; if (a >= 0) post(E.x + [-9, 9, -6, 6][q % 4], E.y + 6 + [0, 0, -3, -3][q % 4], Math.min(9, 4 + a), fade(r.t - hitAt(r, j), r.end - hitAt(r, j), 6)); }); });
    },
    front(r) {
      flying(r, p => { const k = [-9, 9, -6, 6][p.i % 4]; post(p.E.x + k, p.y + 4, 7, 1); });
      landed(r, 12, (E, a, i) => chunks(E.x + [-9, 9, -6, 6][i % 4], E.y + 5, a, 4, r.seed + i, [BOLL.white, BOLL.dark], 12, 0.8));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // Post Volley: Pakui shakes loose a volley of small posts, and the last two fly on past the foe toward its bench.
  bollard_gatling: {
    noFlights: true, noLandings: true,
    front(r) {
      for (const f of r.flights) {
        const a = r.t - f.t0, E = r.to[f.to] || r.to[0], S = r.from, over = f.i >= 3 ? 1.6 : 1;
        if (a < 0 || a >= f.dur * over) continue;
        const u = a / f.dur, x = S.x + (E.x - S.x) * u, y = S.y + (E.y - S.y) * u - (f.i >= 3 ? Math.max(0, u - 1) * 6 : 0);
        thick(x - 2, y, x + 2, y, BOLL.white, 1, BOLL.gray); px(x + 2, y, BOLL.mint, 1);
      }
      landed(r, 10, (E, a, i) => { if (i < 3) sparks(E.x, E.y, a, 4, r.seed + i, W, BOLL.mint, 6, 0.7); });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // ---------------- Tifuda
  // Post Tap: a ticket flies over to the foe and is pinned to it on a string, three ticks on it.
  docket_tap: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => ticket(p.x, p.y, 1, (r.t >> 2) & 1 ? true : false));
      landed(r, r.end, (E, a) => { if (a < 3) arc(E.x, E.y, 4 + a, 4 + a, W, 1); tagged(E.x + (high(E) ? 4 : -4), E.y - 5, a, 3, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, DOC.cyan); },
  },

  // Plant Label: a label post pops up out of the ground beside Tifuda with a ticket on it, a Trip Label set to go off.
  docket_plant: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, a = t - hitOf(r);
      flying(r, p => { const h = Math.round(p.u * 9); line(x, U.y + 6, x, U.y + 6 - h, DOC.dark, 1); });
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); line(x, U.y + 6, x, U.y - 3, DOC.dark, L); ticket(x + 3, U.y - 3, L); if (a < 6) sparks(x, U.y + 6, a, 5, r.seed, W, DOC.cyan, 6, 0.6); }
    },
  },

  // Hold Label: a ticket circles Tifuda and is held up before it, big, as a shield against the next shot.
  docket_hold: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      flying(r, p => { const g = p.u * Math.PI * 4; ticket(U.x + Math.cos(g) * 9, U.y + Math.sin(g) * 4, 1); });
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); blit(['.wwwww', 'wkwwww', 'wwcccw', 'wwwwww', 'wwccww'], U.x + face(U) * 8, U.y - 2, { w: DOC.white, k: DOC.dark, c: DOC.cyan }, L, 2); arc(U.x, U.y + 1, 7, 6, DOC.cyan, L * 0.5); }
    },
  },

  // All Ticketed: a fan of tickets spreads beside Tifuda, five sweep through every foe, and each foe is left with a ticket hung on it.
  docket_blast: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0), L = hold(t, 0, leaveOf(r) + 4, 4); for (let q = 0; q < 5; q++) { const g = (q - 2) * 0.35 * ease(prog(t, 0, 10)); ticket(B.x + Math.sin(g) * 6, B.y + 2 - Math.cos(g) * 3, L, q % 2 === 1); } },
    front(r) {
      flying(r, p => ticket(p.x, p.y, 1, (p.a >> 1) & 1 ? true : false));
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { if (a < 4) arc(E.x, E.y, 5 + a, 5 + a, W, 1); tagged(E.x + (high(E) ? 4 : -4), E.y - 5, a, 3, fade(a, r.end - hitAt(r, j), 6)); } });
      landed(r, 10, (E, a, i) => sparks(E.x, E.y, hs(a), 5, r.seed + i, W, DOC.cyan, 8));
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Tyhaki
  // Hollow Tap: a small empty square flies at the foe, opens round it, and draws a little of it back to Tyhaki.
  vacancy_tap: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => slot(p.x, p.y, 2, 1, 0.75));
      landed(r, 18, (E, a) => {
        slot(E.x, E.y, Math.max(4, 8 - a * 0.4), fade(a, 18), 0.25);
        const u = prog(a, 3, 16), S = r.from;
        if (u > 0 && u < 1) for (let q = 0; q < 3; q++) { const k = Math.min(1, u + q * 0.06); px(E.x + (S.x - E.x) * k, E.y + (S.y - E.y) * k - Math.sin(Math.PI * k) * 6, VACY.lime, 1); }
      });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, VACY.lime); },
  },

  // Slip In: Tyhaki slips into an empty square, a drop slips across to the foe, and a slow square closes round it.
  vacancy_slip: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; slot(U.x, U.y, 6, hold(t, 0, r.contact + 6, 3), 0.25); },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: W, g: '#7ab0d8', d: VACY.taupe }, 1));
      landed(r, 16, (E, a) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.5, vy = -1.3 - hash(r.seed + q) * 0.6; px(E.x + vx * a, E.y + 2 + vy * a + 0.12 * a * a, q % 2 ? '#a8d8f0' : W, fade(a, 16)); } if (a > 4) slot(E.x, E.y, 7, fade(a, 16), 0); });
    },
  },

  // Empty Out: a square frames Tyhaki, everything clinging to it falls out the bottom, and the frame thickens round it.
  vacancy_emptyout: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 4), a = t - hitOf(r);
      slot(U.x, U.y, 7, L, 0);
      if (a >= 0) { slot(U.x, U.y, 8, fade(a, r.end - hitOf(r), 6), 0); for (let q = 0; q < 5; q++) { const b = a - q; if (b >= 0 && b < 12) px(U.x - 4 + q * 2, U.y + 2 + b * 0.8, VACY.taupe, fade(b, 12)); } }
    },
  },

  // Square Waits: a big empty square opens where Tyhaki stands, it steps in, and smaller squares nest inside it, waiting.
  vacancy_square: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), n = landedN(r);
      slot(U.x, U.y + 1, 2 + 7 * ease(prog(t, 0, 10)), L, 0.5);
      for (let q = 0; q < n; q++) slot(U.x, U.y + 1, 7 - (q + 1) * 1.7, L, 0);
    },
    front(r) { flying(r, p => slot(p.x, p.y, 1.5, 1, 0)); },
  },

  // ---------------- Hyrkoma
  // Top Spin: a spinning top shell skids across to the foe and grinds into it, cracking the ground.
  trochus_spin: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, TRO.blue, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, TRO.pale, fade(a, 18)); }); },
    front(r) {
      flying(r, p => { top(p.x, p.y, 4, r.t * 2); line(p.x - 5, p.y - 2, p.x - 4, p.y - 2, TRO.pale, 0.5); line(p.x + 4, p.y - 2, p.x + 5, p.y - 2, TRO.pale, 0.5); });
      landed(r, 12, (E, a) => { if (a < 8) top(E.x, E.y + 2, 3, r.t * 2, 1); sparks(E.x, E.y + 3, a, 6, r.seed, W, TRO.tan, 10); });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, TRO.pale); },
  },

  // Spin Under: a top's outline spins round Hyrkoma and screws down into the ground, shaking off what clings to it.
  trochus_under: {
    tail: 6, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 4), down = prog(t, hitOf(r), r.end - 4); top(U.x, U.y - 2 + down * 3, 7, t * 2, L * 0.5); },
    front(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) { ring(U.x, U.y + 6, 5 + a * 0.6, TRO.pale, fade(a, 12)); chunks(U.x, U.y + 5, a, 5, r.seed, [TRO.tan, TRO.pale], 12, 0.8); } },
  },

  // Grit Finish: a top skims across throwing a spray of grit through every foe, and the grit clings to them.
  trochus_grit: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { if (p.i === 0) { top(p.x, p.E.y + 2, 4, r.t * 2); for (let q = 1; q < 6; q++) px(p.x - Math.sign(p.ux || 1) * q * 2, p.E.y + 4 - (q % 3), q % 2 ? TRO.tan : TRO.pale, q < 4 ? 1 : 0.5); } });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) for (let q = 0; q < 5; q++) px(E.x - 3 + hash(r.seed + q + j) * 7, E.y - 2 + hash(r.seed + q * 5) * 7, q % 2 ? TRO.tan : TRO.blue, fade(a, r.end - hitAt(r, j), 6)); });
    },
  },

  // Spin Out: a big top spins up beside Hyrkoma, three small tops circle out to the foe, and the big one spins out onto it, grinding.
  trochus_spinout: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0); if (t < leaveOf(r) + 4) top(B.x, B.y + 2, 3 + 3 * ease(prog(t, 0, 10)), t * (1 + prog(t, 0, 10) * 2), hold(t, 0, leaveOf(r) + 4, 3)); },
    front(r) {
      flying(r, p => top(p.x, p.y, 3.5, r.t * 2));
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= -6 && a < 16) top(E.x, E.y + 1, 6, r.t * 3, fade(a + 6, 22, 6));
      landed(r, 18, (P, b, i) => { if (i === r.hits.length - 1) { chunks(P.x, P.y + 5, hs(b, 5), 8, r.seed, [TRO.tan, TRO.pale, TRO.blue], 18, 1.2); ring(P.x, P.y + 6, 4 + b, TRO.pale, fade(b, 14)); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 2) }; },
  },

  // ---------------- Kidedan
  // Cube Face: a small hopper crystal flies at the foe and shatters into diamond shards.
  hopper_face: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => hopperAt(p.x, p.y, 3, 2));
      landed(r, 14, (E, a) => { for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 2 + hs(a) * 0.9; hopperAt(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, 1, 1, fade(a, 14)); } if (a < 3) hopperAt(E.x, E.y, 6, 3); });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, HOP.white); },
  },

  // Inward Stair: a stepped crystal opens at the foe and its steps run inward, and shards close on it, pulling in from its bench.
  hopper_stair: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, leaveOf(r), r.end, 4); hopperAt(E.x, E.y, 10, 4, L * 0.5); const k = (t * 0.1) % 1; hopperAt(E.x, E.y, 10 * (1 - k), 1, L); },
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 4, p.y - p.uy * 4, HOP.white, 1); px(p.x, p.y, W, 1); });
      landed(r, 12, (E, a, i) => chunks(E.x, E.y, hs(a), 4, r.seed + i, [HOP.white, HOP.taupe], 12));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Crust Over: three salt cubes circle Kidedan and lay crust round it, a stepped diamond added with each.
  hopper_crust: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), U = userAt(r); if (n) hopperAt(U.x, U.y, 7 + n * 1.5, n + 1, hold(r.t, hitOf(r), r.end, 4)); },
    front(r) {
      const U = userAt(r);
      flying(r, p => { const g = p.u * Math.PI * 4 + p.i * 2.1, rr = 10 - p.u * 3; blit(['ww', 'wt'], U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.6, { w: HOP.white, t: HOP.taupe }, 1); });
      landed(r, 14, (E, a) => motes(E.x, E.y, a, 3, r.seed + a, [HOP.white, W], 14, 5));
    },
  },

  // Hollow Core: the steps round Kidedan fall in one by one to its core, crystals close on every foe, and a hopper flares on each and shatters.
  hopper_core: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, n = Math.max(0, 4 - Math.floor(t / 4)); if (t < leaveOf(r)) hopperAt(U.x, U.y, 4 + n * 2.5, n + 1, hold(t, 0, leaveOf(r), 3)); },
    front(r) {
      flying(r, p => blit(['ww', 'wt'], p.x, p.y, { w: HOP.white, t: HOP.taupe }, 1));
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0 && a < 18) { if (a < 8) hopperAt(E.x, E.y, 4 + a, 3, fade(a, 8)); for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 3 + hs(a, 5) * 0.9; hopperAt(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, 1, 1, fade(a, 18)); } } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Sivuko
  // Claw Nip: a salt-crusted pincer snaps shut on the foe and leaves three sideways cuts.
  crabwise_nip: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), d = face(r.from);
      if (t >= hit - 4 && t < hit + 6) pincer(E.x - d * 6, E.y, d, t < hit ? 1 : 0, 1);
      landed(r, 12, (P, a) => sideCuts(P.x, P.y, 3, Math.min(1, (a + 1) / 3), d, fade(a, 12)));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Salt Flick: Sivuko flicks salt round itself, and it crusts into a white shield on the side the shots come from.
  crabwise_flick: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r), d = face(r.from), n = landedN(r);
      flying(r, p => { const g = p.u * Math.PI * 4 + p.i * 2.1; blit(['ww', 'wd'], U.x + Math.cos(g) * 9, U.y + Math.sin(g) * 5, { w: CRB.salt, d: CRB.rust }, 1); });
      if (n) { const L = hold(r.t, hitOf(r), r.end, 4); for (let q = 0; q < n; q++) arc(U.x + d * 2, U.y, 7 + q, 7 + q, q % 2 ? CRB.salt : W, L, d > 0 ? -0.18 : 0.32, d > 0 ? 0.18 : 0.68); }
      pincer(U.x + d * 5, U.y - 6, d, (r.t >> 3) & 1, hold(r.t, 0, r.end, 4));
    },
  },

  // Side Step: Sivuko blinks sideways, leaving a trail of crab tracks, and cuts the foe from the side.
  crabwise_side: {
    tail: 6, noLandings: true,
    back(r) { const t = r.t, U = r.from; for (let q = 0; q < 4; q++) if (t > q * 2) { const x = U.x - 3 + q * 3; px(x, U.y + 6, CRB.rust, hold(t, q * 2, r.end, 4)); px(x, U.y + 8, CRB.rust, hold(t, q * 2, r.end, 4)); } },
    front(r) {
      const E = aim(r), d = face(r.from), t = r.t, hit = hitOf(r);
      if (t >= hit - 3 && t < hit + 5) pincer(E.x - d * 7, E.y + 1, d, t < hit ? 1 : 0, 1);
      landed(r, 12, (P, a) => sideCuts(P.x, P.y, 2, Math.min(1, (a + 1) / 3), d, fade(a, 12)));
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Between Slots: Sivuko scuttles sideways between the Tray's slots, dashes in, and a great pincer clamps the foe in a crust of salt.
  crabwise_between: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, E = aim(r), L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 3; q++) { line(U.x - 14 + q * 14, U.y + 7, U.x - 14 + q * 14, U.y + 3, VACY.cream, 0.5 * L); }
      if (t < 10) for (let q = 0; q < Math.floor(t / 2); q++) { px(U.x - 8 + q * 3, U.y + 6, CRB.rust, L); px(U.x - 8 + q * 3, U.y + 8, CRB.rust, L); }
      const a = t - lastOf(r);
      if (a >= 0) frostLine(E.x, E.y + 6, Math.min(8, 2 + a), r.seed, fade(a, r.end - lastOf(r), 6));
    },
    front(r) {
      smear(r, CRB.salt, CRB.rust);
      flying(r, p => blit(['ww', 'wd'], p.x, p.y, { w: CRB.salt, d: CRB.rust }, 1));
      const t = r.t, E = aim(r), d = face(r.from), last = lastOf(r);
      if (t >= last - 6 && t < last + 10) { const k = 1.6; pincer(E.x - d * 8, E.y, d, t < last ? 1 : 0, 1); arc(E.x - d * 8 + d * 4 * k, E.y, 3, 6, CRB.salt, t >= last ? 1 : 0, 0, 1); }
      landed(r, 14, (P, a, i) => sideCuts(P.x, P.y + (i - 1) * 2, 2, Math.min(1, (a + 1) / 3), d, fade(a, 14)));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Picagi
  // Snatch: Picagi swoops three times across the foe, and each time a gold trinket comes away and flies back to it.
  magpie_snatch: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => magpieBird(p.x, p.y, p.ux >= 0 ? 1 : -1, (r.t >> 1) & 1));
      landed(r, 16, (E, a, i) => {
        if (a < 6) { const n = Math.min(1, (a + 1) / 3); line(E.x + 5, E.y - 4 + i * 2, E.x + 5 - 10 * n, E.y - 2 + i * 2, W, fade(a, 6)); }
        const u = prog(a, 2, 14), S = r.from;
        if (u > 0 && u < 1) trinket(E.x + (S.x - E.x) * u, E.y + (S.y - E.y) * u - Math.sin(Math.PI * u) * 8, i, 1);
      });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Three Pecks: three pecks of a sharp beak close on the foe with gold glints, and its next move is pecked away.
  magpie_pecks: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, MAG.white, MAG.dark);
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 4, p.y - p.uy * 4, MAG.dark, 1); line(p.x, p.y + 1, p.x - p.ux * 3, p.y - p.uy * 3 + 1, MAG.white, 1); px(p.x, p.y, MAG.gold, 1); });
      landed(r, 10, (E, a, i) => glint(E.x + (i - 1) * 3, E.y - 1 + (i % 2) * 2, MAG.gold, fade(a, 10)));
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 2) { const L = fade(a, r.end - lastOf(r), 6), y = E.y - 10; line(E.x - 2, y - 2, E.x + 2, y + 2, MAG.gold, L); line(E.x + 2, y - 2, E.x - 2, y + 2, MAG.gold, L); }
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Hoard: Picagi spreads its wings over its place, its trinkets circle and tuck under them, and the ally comes out with a gold ring.
  magpie_hoard: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), B = signAt(r.from, 0);
      magpieBird(B.x, B.y, face(r.from), (t >> 2) & 1, hold(t, 0, hitOf(r) + 4, 3));
      flying(r, p => { const g = p.u * Math.PI * 4; for (let q = 0; q < 3; q++) { const h = g + q * 2.1; trinket(U.x + Math.cos(h) * 9 * (1 - p.u * 0.5), U.y + Math.sin(h) * 5 * (1 - p.u * 0.5), q, 1); } });
      const a = t - hitOf(r);
      if (a >= 0) arc(U.x, U.y + 1, 7, 6, MAG.gold, fade(a, r.end - hitOf(r), 6) * ((a >> 2) & 1 ? 1 : 0.5));
    },
  },

  // Gives It Back: Picagi spreads its wings over a glittering hoard, then flings it all at every foe, and their shields break.
  magpie_back: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = signAt(r.from, 0), L = hold(t, 0, leaveOf(r) + 4, 4);
      magpieBird(B.x, B.y - 2, face(r.from), (t >> 2) & 1, L);
      for (let q = 0; q < 5; q++) trinket(B.x - 6 + q * 3, B.y + 5 + (q % 2), q, L);
    },
    front(r) {
      flying(r, p => trinket(p.x, p.y, p.i, 1));
      landed(r, 16, (E, a, i) => {
        if (i < r.to.length) for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + 0.4, d = 3 + hs(a, 4) * 0.8; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? '#d8e8f8' : W, fade(a, 16)); }
        if (a < 6) { const n = Math.min(1, (a + 1) / 3); line(E.x + 5, E.y - 5 + (i % 3), E.x + 5 - 10 * n, E.y + 5 * n + (i % 3), W, fade(a, 6)); }
      });
    },
    scene(r) { return jolt(r, 10, 2); },
  },


  // ---------------- Kakulo
  // Poke In: two pokes of sand fly into the foe and puff, and a grain of Sand stays on it.
  cache_poke: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { for (let q = 0; q < 4; q++) px(p.x - p.ux * q * 1.5 + (q % 2), p.y - p.uy * q * 1.5 + (q % 3 - 1), q % 2 ? CAC.sand : CAC.pale, q < 3 ? 1 : 0.5); });
      landed(r, 14, (E, a) => { if (a < 10) oval(E.x, E.y + 2, 2 + a * 0.3, 1.5 + a * 0.2, CAC.sand, fade(a, 10) * 0.5); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) sandPips(E.x, E.y - 8, Math.min(2, landedN(r)), fade(a, r.end - hitOf(r), 6));
    },
    lights(r) { return flyLights(r, CAC.sand); },
  },

  // Fall In: a hole opens under the foe, its shield breaks and falls in among the green glints, and it sinks to its knees.
  cache_fallin: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), w = Math.round(3 + 6 * ease(prog(t, 0, hitOf(r)))); cacheHole(E.x, E.y + 6, w, t, hold(t, 0, r.end, 4)); },
    front(r) {
      flying(r, p => { blit(SEI_DROP, p.x, p.y, { f: W, g: CAC.green, d: CAC.purple }, 1); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0 && a < 14) { const y = E.y - 2 + a * 0.6; arc(E.x, y, 7, 5, '#d8e8f8', fade(a, 14), 0.55 + a * 0.01, 0.95 - a * 0.01); }
      if (a >= 0) sandPips(E.x, E.y - 8, 1, fade(a, r.end - hitOf(r), 6));
    },
  },

  // Shallow Hole: a hole opens wide under the foe, sand pours over it, and it is kept out of sight.
  cache_hole: {
    noLandings: true,
    back(r) { const t = r.t, E = aim(r); cacheHole(E.x, E.y + 6, Math.round(3 + 7 * ease(prog(t, 0, hitOf(r)))), t, hold(t, 0, r.end, 4)); },
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), h = Math.min(10, a); dither(E.x - 5, E.y + 5 - h, 11, h, CAC.sand, 0.5 * L); for (let q = 0; q < 4; q++) px(E.x - 4 + q * 3, E.y - 6 + ((a + q * 3) % 10), CAC.sand, L); }
    },
  },

  // Keeps It: Kakulo's hole opens beside it with its finds glinting, sand piles on every foe, and the piles burst.
  cache_keepsit: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0); cacheHole(B.x, B.y + 6, Math.round(2 + 5 * ease(prog(t, 0, 10))), t, hold(t, 0, r.end, 6)); },
    front(r) {
      flying(r, p => { px(p.x, p.y, CAC.sand, 1); px(p.x + 1, p.y - 1, CAC.pale, 1); });
      r.to.forEach((E, j) => {
        const n = r.hits.filter(h => h.to === j && r.t >= h.at).length, last = r.hits.filter(h => h.to === j).pop()?.at ?? hitOf(r), a = r.t - last;
        if (a < 0 && n) sandPips(E.x, E.y + 4, n * 2, 1);
        if (a >= 0 && a < 16) for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2, d = 2 + hs(a, 4) * 0.9; px(E.x + Math.cos(g) * d, E.y + 2 + Math.sin(g) * d * 0.7, q % 3 ? CAC.sand : CAC.green, fade(a, 16)); }
      });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
  },

  // ---------------- Masilma
  // Stalk Jab: Masilma's eye shoots out on its stalk all the way to the foe and jabs it.
  strombus_jab: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, E = aim(r), go = leaveOf(r), hit = hitOf(r);
      const out = t < hit ? prog(t, go, hit) : 1 - prog(t, hit + 3, r.end - 2);
      if (out > 0) eyestalk({ x: U.x, y: U.y - 3 }, { x: U.x + (E.x - U.x) * out * 0.85, y: U.y - 3 + (E.y - U.y) * out * 0.85 }, E, 1);
      landed(r, 10, (P, a) => { if (a < 3) arc(P.x, P.y, 4 + a, 4 + a, W, 1); sparks(P.x, P.y, hs(a), 6, r.seed, W, STR.crimson, 8); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Long Look: the eye rises on its stalk and stares a long red line at the foe, poison drips, and a trap ring is left at its feet.
  strombus_look: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - hitOf(r), E = aim(r); if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); arc(E.x, E.y + 6, 6, 2, STR.crimson, L); px(E.x - 6, E.y + 6, STR.pink, L); px(E.x + 6, E.y + 6, STR.pink, L); } },
    front(r) {
      const t = r.t, U = r.from, E = aim(r), tip = { x: U.x + face(U) * 3, y: U.y - 12 }, L = hold(t, 0, r.end, 4);
      eyestalk({ x: U.x, y: U.y - 3 }, tip, E, L);
      if (t >= leaveOf(r) && t < lastOf(r) + 4) line(tip.x, tip.y, E.x, E.y, STR.crimson, 0.5);
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: STR.pink, g: STR.crimson, d: STR.violet }, 1));
      landed(r, 18, (P, a) => { for (let q = 0; q < 3; q++) { const b = a - q * 4; if (b >= 0 && b < 12) px(P.x - 2 + q * 2, P.y + 1 + b * 0.5, '#9a5ab0', fade(b, 12)); } });
    },
  },

  // Stare: a great eye opens over Masilma and stares without blinking, its pupil drawn to a point.
  strombus_stare: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = signAt(U, 0), L = hold(t, 0, r.end, 4), open = ease(prog(t, 0, hitOf(r)));
      const look = { x: U.x + face(U) * 40, y: high(U) ? 42 : 16 };
      if (open > 0.2) eyestalk({ x: U.x, y: U.y - 3 }, B, look, L, 1 + open);
      const a = t - hitOf(r);
      if (a >= 0 && a < 10) for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2 + 0.785; line(B.x + Math.cos(g) * 5, B.y + Math.sin(g) * 4, B.x + Math.cos(g) * (6 + a * 0.4), B.y + Math.sin(g) * (5 + a * 0.3), STR.pink, fade(a, 10)); }
    },
  },

  // Cull: the eye climbs high on its stalk and locks on, then a bone strike flies fast and bites and rakes the foe.
  strombus_cull: {
    lead: 14, tail: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, E = aim(r), up = ease(prog(t, 0, 12)); eyestalk({ x: U.x, y: U.y - 3 }, { x: U.x + face(U) * 4, y: U.y - 4 - up * 12 }, E, hold(t, 0, hitOf(r) + 4, 3), 1 + up * 0.5); },
    front(r) {
      const t = r.t, E = aim(r);
      if (t > 8 && t < hitOf(r) + 2) { arc(E.x, E.y, 6, 6, STR.crimson, 0.75); px(E.x - 8, E.y, STR.crimson, 1); px(E.x + 8, E.y, STR.crimson, 1); }
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 6, p.y - p.uy * 6, STR.white, 1); px(p.x, p.y, W, 1); });
      landed(r, 14, (P, a) => { const g = Math.max(0, 5 - hs(a, 4) * 1.5); line(P.x - 5, P.y - 1 - g, P.x + 5, P.y - 1 - g, STR.white, fade(a, 14)); line(P.x - 5, P.y + 1 + g, P.x + 5, P.y + 1 + g, STR.white, fade(a, 14)); for (let q = 0; q < 3; q++) { const b = a - q * 2; if (b >= 0) { const n = Math.min(1, (b + 1) / 3); line(P.x + 3 + (q - 1) * 3, P.y - 5, P.x + 3 + (q - 1) * 3 - 6 * n, P.y - 5 + 10 * n, STR.crimson, fade(a, 14)); } } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Sirdori
  // Pin: Sirdori runs in fast on a line of tracks and pins every foe with quick jabs of its beak.
  sanderling_pin: {
    lead: 6, tail: 8, noLandings: true,
    back(r) { const t = r.t, U = r.from, d = face(U); for (let q = 0; q < Math.min(4, Math.floor(t / 2)); q++) birdTrack(U.x + d * (4 + q * 3), U.y + 6 + (q % 2), d, hold(t, 0, r.end, 4)); },
    front(r) {
      smear(r, SAN.white, SAN.gray);
      landed(r, 10, (E, a, i) => { for (let q = 0; q < 2; q++) { const b = a - q * 2; if (b >= 0 && b < 6) line(E.x - 4 + q * 5, E.y - 4 + q * 2, E.x - 1 + q * 5, E.y - 1 + q * 2, W, fade(b, 6)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Still Foot: Sirdori stands on one foot as a wave runs in and stops just short of it, and it mends, dry.
  sanderling_longshot: {
    tail: 6, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, d = face(U), reach = Math.round(10 * Math.sin(Math.PI * prog(t, 0, r.end)));
      foamEdge(U.x + d * 18 - d * reach, U.x + d * 20, U.y + 7, t, hold(t, 0, r.end, 4));
      birdTrack(U.x, U.y + 7, d, hold(t, 0, r.end, 4));
    },
    front(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) { motes(U.x, U.y, a, 5, r.seed, [SAN.white, SAN.green], 16, 5); arc(U.x, U.y + 1, 7, 6, SAN.white, fade(a, r.end - hitOf(r), 6) * 0.5); } },
  },

  // Edge Run: Sirdori runs the wave's edge to the foe on a line of tracks, a star flies, and it cuts the foe, a green glint left on it.
  sanderling_run: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, S = r.from, E = aim(r); for (let q = 0; q < Math.min(6, t); q++) { const u = (q + 1) / 8; birdTrack(S.x + (E.x - S.x) * u, S.y + 6 + (E.y - S.y) * u, face(S), hold(t, q, r.end, 4)); } },
    front(r) {
      smear(r, SAN.white, SAN.gray);
      flying(r, p => { glint(p.x, p.y, SAN.green, 1); tail(p.x, p.y, p.ux, p.uy, [SAN.white, SAN.gray]); });
      landed(r, 10, (E, a) => { const n = Math.min(1, (a + 1) / 3); line(E.x + 5, E.y - 5, E.x + 5 - 10 * n, E.y - 5 + 10 * n, W, fade(a, 10)); });
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 4) glint(U.x + face(U) * 5, U.y - 6, SAN.green, fade(a, r.end - hitOf(r)));
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, SAN.green); },
  },

  // Wave Edge: a wave runs in along the field and Sirdori runs ahead of it on a line of tracks, quicker and stronger, and never wet.
  sanderling_wave: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, d = face(U), L = hold(t, 0, r.end, 6), u = prog(t, 0, r.end - 10), x = U.x - d * 30 + d * 50 * u;
      foamEdge(U.x - d * 40, x, U.y + 8, t, L);
      for (let q = 0; q < 5; q++) birdTrack(x + d * (3 + q * 3), U.y + 7 + (q % 2), d, L);
    },
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - Math.sign(p.ux || 1) * 4, p.y + 1, SAN.white, 1); px(p.x, p.y, W, 1); });
      landed(r, 16, (E, a, i) => { if (i === r.hits.length - 1) { ring(E.x, E.y + 3, 4 + a * 0.6, SAN.white, fade(a, 16)); motes(E.x, E.y, a, 4, r.seed, [SAN.green, W], 16, 6); } });
    },
  },

  // ---------------- Manva
  // Rise: the water comes up round the foe's feet in two steps, and splashes over it.
  flood_rise: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), E = aim(r), a = r.t - hitOf(r); if (n) floodAt(E.x, E.y + 6, 9, 2 + n * 2, r.t, fade(a, r.end - hitOf(r), 6)); },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: FLO.foam, g: FLO.blue, d: FLO.deep }, 1));
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.6, vy = -1.4 - hash(r.seed + q + i) * 0.6; px(E.x + vx * a, E.y + 2 + vy * a + 0.12 * a * a, q % 2 ? FLO.foam : W, fade(a, 14)); } });
    },
  },

  // Top Spill: a flat sheet of water spills low along the ground through the foe and on past it to whoever is lowest.
  flood_spill: {
    noFlights: true, noLandings: true,
    back(r) { flying(r, p => { if (p.i) return; const d = p.ux >= 0 ? 1 : -1; for (let k = 0; k < 16; k++) { const x = p.x - d * k; px(x, p.E.y + 6 - ((k + (r.t >> 1)) % 3 === 0 ? 1 : 0), FLO.foam, k < 12 ? 1 : 0.5); px(x, p.E.y + 7, FLO.blue, k < 12 ? 1 : 0.5); } }); },
    front(r) { landed(r, 14, (E, a, i) => { for (let q = 0; q < 4; q++) { const vx = (q - 1.5) * 0.6, vy = -1.2 - hash(r.seed + q + i) * 0.5; px(E.x + vx * a, E.y + 4 + vy * a + 0.12 * a * a, q % 2 ? FLO.foam : W, fade(a, 14)); } }); },
  },

  // Stay a While: water swirls in round the foe and settles there, standing to its middle under a gold high-water mark, and stays.
  flood_stay: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), E = aim(r); if (n) floodAt(E.x, E.y + 6, 8, 3 + n * 2, r.t, fade(r.t - hitOf(r), r.end - hitOf(r), 6), 0.5); },
    front(r) {
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, FLO.blue, 1); px(p.x, p.y, FLO.foam, 1); });
      const n = landedN(r), E = aim(r);
      if (n) for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + r.t * 0.08; px(E.x + Math.cos(g) * 7, E.y + 4 + Math.sin(g) * 1.5, FLO.foam, fade(r.t - hitOf(r), r.end - hitOf(r), 6)); }
    },
  },

  // Spring Flood: the sea comes up over the whole bottom of the field under a gold mark, surges up on every foe, and rings spread.
  flood_spring: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), h = Math.round(10 * ease(prog(t, 0, 16)));
      if (h > 0) { dither(0, 60 - h, 96, h, FLO.blue, 0.5 * L); for (let x = 0; x < 96; x++) px(x, 60 - h + (((x + (t >> 2)) & 3) === 0 ? 1 : 0), FLO.foam, L); line(0, 58 - h, 95, 58 - h, FLO.gold, 0.5 * L); }
    },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: FLO.foam, g: FLO.blue, d: FLO.deep }, 1));
      landed(r, 18, (E, a, i) => { if (i % 3 === 0) { ring(E.x, E.y + 4, 4 + hs(a, 4) * 0.9, FLO.foam, fade(a, 18)); for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.6, vy = -1.6 - hash(r.seed + q + i) * 0.7; px(E.x + vx * a, E.y + 2 + vy * a + 0.12 * a * a, q % 2 ? FLO.foam : W, fade(a, 18)); } } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Kohisai
  // Hiss: arcs of sea sound run to the foe and ring round it, and an echo of them runs backward to Kohisai.
  surf_hiss: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => seaArcs(p.x, p.y, p.ux >= 0 ? 1 : -1, 3, 1, 2));
      landed(r, 16, (E, a) => {
        if (a < 10) ring(E.x, E.y, 3 + a, SUR.white, fade(a, 10));
        const u = prog(a, 3, 15), S = r.from;
        if (u > 0 && u < 1) seaArcs(E.x + (S.x - E.x) * u, E.y + (S.y - E.y) * u, S.x >= E.x ? -1 : 1, 2, 0.75, 2);
      });
    },
    lights(r) { return flyLights(r, SUR.light); },
  },

  // Crash: a soft wave curls over Kohisai's side and breaks into drops that mend the team, and a ring of foam guards Kohisai.
  surf_crash: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, u = ease(prog(t, 0, hitOf(r))), L = hold(t, 0, hitOf(r) + 4, 3); if (L > 0) { arc(U.x - face(U) * 4, U.y - 4, 10, 8 * u + 1, SUR.white, L, 0.5, 1); arc(U.x - face(U) * 4, U.y - 3, 9, 7 * u + 1, SUR.light, L, 0.55, 0.95); } },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: W, g: SUR.light, d: SUR.blue }, 1));
      landed(r, 16, (E, a, i) => { if (i === 0) motes(E.x, E.y, a, 6, r.seed, [SUR.white, SUR.light], 16, 7); });
      const a = r.t - lastOf(r), U = r.from;
      if (a >= 0) arc(U.x, U.y + 1, 7, 6, SUR.white, fade(a, r.end - lastOf(r), 6) * 0.75);
    },
  },

  // Roar Back: three arcs of sea sound weave to the foe, and every arrow over it turns over, up becoming down.
  surf_rush: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => seaArcs(p.x, p.y, p.ux >= 0 ? 1 : -1, 2, 1, 2));
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), u = prog(a, 4, 14); for (let q = 0; q < 3; q++) flipArrow(E.x + (high(E) ? 6 : -5) + q * 5, E.y - (high(E) ? 3 : 10), prog(a, 4 + q * 3, 8 + q * 3), L); for (let q = 0; q < 2; q++) { const b = a - q * 4; if (b >= 0 && b < 12) arc(E.x, E.y - 6, 3 + b * 0.5, 1.5, SUR.light, fade(b, 12)); } }
    },
    lights(r) { return flyLights(r, SUR.light); },
  },

  // Sea Sound: a great conch spiral beside Kohisai pours out the sea's roar, the arcs break over every foe, and their arrows turn over.
  surf_seasound: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = signAt(r.from, 0), L = hold(t, 0, leaveOf(r) + 6, 4);
      for (let k = 0; k <= 18; k++) { const g = k * 0.6 + t * 0.05, rr = 1 + k * 0.4; px(B.x + Math.cos(g) * rr, B.y + Math.sin(g) * rr * 0.8, k % 3 ? SUR.light : SUR.white, L); }
      if (t < leaveOf(r) + 4) seaArcs(B.x, B.y, face(r.from), 3 + ((t >> 2) % 3), L * 0.75, 3);
    },
    front(r) {
      flying(r, p => seaArcs(p.x, p.y, p.ux >= 0 ? 1 : -1, 2, 1, 2));
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6); for (let q = 0; q < 3; q++) flipArrow(E.x + (high(E) ? 6 : -5) + q * 5, E.y - (high(E) ? 3 : 10), prog(a, 2 + q * 3, 6 + q * 3), L); if (a < 14) ring(E.x, E.y + 3, 4 + a * 0.8, SUR.white, fade(a, 14)); } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Kukhana
  // Spray: two salt petals fly in and shatter, and dry cracks craze the foe.
  fleur_spray: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 3 - p.uy, p.y - p.uy * 3 + p.ux, FLE.white, 1); px(p.x, p.y, W, 1); px(p.x - p.ux * 2, p.y - p.uy * 2, FLE.pink, 1); });
      landed(r, 12, (E, a, i) => { for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + i, d = 2 + hs(a) * 0.8; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, q % 2 ? FLE.white : FLE.pink, fade(a, 12)); } });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 2) dryCracks(E.x, E.y, landedN(r), r.seed, fade(a, r.end - hitOf(r), 6));
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, FLE.white); },
  },

  // Salt Bloom: salt flowers open at every foe's feet and their petals shatter up over it.
  fleur_bloom: {
    noFlights: true, noLandings: true,
    back(r) { r.to.forEach((E, j) => { const a = r.t - hitAt(r, j) + 6; if (a >= 0 && a < 20) saltFlower(E.x, E.y + 6, 5, Math.min(1, a / 6), fade(a, 20)); }); },
    front(r) {
      flying(r, p => { px(p.x, p.y, FLE.white, 1); px(p.x, p.y + 1, FLE.pink, 1); });
      landed(r, 12, (E, a, i) => { if (i < r.to.length) for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 2 + hs(a) * 0.9; line(E.x + Math.cos(g) * d, E.y + 2 + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + 2 + Math.sin(g) * (d + 2) * 0.8, q % 2 ? FLE.white : FLE.pink, fade(a, 12)); } });
    },
  },

  // Crack: Kukhana stamps, dry cracks run along the ground to the foe with two spines, and the crazing spreads on past it.
  fleur_crack: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), a = t - r.contact;
      if (a < 0) return;
      const u = Math.min(1.3, a / Math.max(1, hitOf(r) - r.contact)), L = fade(t - hitOf(r), r.end - hitOf(r), 6), n = 16;
      for (let q = 0; q <= n * u; q++) { const k = q / n, x = S.x + (E.x - S.x) * k, y = S.y + 6 + (E.y - S.y) * k + (q % 2 ? 1 : 0); px(x, y, q % 3 ? FLE.gray : FLE.white, a < hitOf(r) - r.contact + 4 ? 1 : L); if (q % 4 === 2) px(x + 1, y - 1, FLE.gray, L); }
    },
    front(r) {
      flying(r, p => { line(p.x, p.y, p.x - p.ux * 4, p.y - p.uy * 4, FLE.white, 1); px(p.x - p.ux * 4, p.y - p.uy * 4, FLE.pink, 1); });
      landed(r, r.end, (E, a, i) => { if (i === 0) dryCracks(E.x, E.y + 3, 2, r.seed, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Salt Flower: a great salt flower opens beside Kukhana, its petals fly out at the foes and come back to it, and the foes craze dry.
  fleur_flower: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0); saltFlower(B.x, B.y + 2, 7, ease(prog(t, 0, 12)), hold(t, 0, r.end, 6), t * 0.03); },
    front(r) {
      flying(r, p => { const g = r.t * 0.5 + p.i; line(p.x - Math.cos(g) * 2, p.y - Math.sin(g) * 2, p.x + Math.cos(g) * 2, p.y + Math.sin(g) * 2, FLE.white, 1); px(p.x, p.y, FLE.pink, 1); });
      landed(r, r.end, (E, a, i) => { if (i === r.hits.length - 1 || i < r.to.length) dryCracks(E.x, E.y, Math.min(3, 1 + (a >> 2)), r.seed + i, fade(a, r.end - hitOf(r), 6)); if (a < 4) glint(E.x, E.y, FLE.white, 1); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 8, 2) }; },
  },

  // ---------------- Kosango
  // Hand Hold: a coral hand takes hold of Kosango's ally and mends it, while a small coral knuckle raps the foe.
  madrepore_rap: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      coralHand(U.x + face(U) * 6, U.y - 1 - Math.round(2 * (1 - ease(prog(t, 0, hitOf(r))))), 1, 0.5, hold(t, 0, r.end, 4));
      if (a >= 0) { motes(U.x, U.y, a, 5, r.seed, [MAD.pale, MAD.gold], 18, 6); const E = { x: U.x + face(U) * 53, y: high(U) ? 42 : 16 }; if (a >= 4 && a < 14) { coralHand(E.x - face(U) * 5, E.y - 6, 0.7, 0, 1); for (let q = 0; q < 2; q++) { const b = a - 6 - q * 3; if (b >= 0 && b < 5) arc(E.x, E.y - 6, 2 + b, 2 + b, W, fade(b, 5), 0.6, 0.9); } } }
    },
  },

  // Knuckle Rap: a coral fist flies at the foe and raps it hard over the head, and the ground cracks.
  madrepore_close: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, MAD.dark, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, MAD.coral, fade(a, 18)); }); },
    front(r) {
      smear(r, MAD.pale, MAD.coral);
      flying(r, p => coralHand(p.x, p.y, 1, 0, 1));
      landed(r, 12, (E, a) => { if (a < 6) coralHand(E.x, E.y - 6, 1, 0, 1); for (let q = 0; q < 2; q++) { const b = a - q * 3; if (b >= 0 && b < 7) arc(E.x, E.y - 8, 3 + b, 2 + b, W, fade(b, 7), 0.55, 0.95); } });
    },
    scene(r) { return jolt(r, 5, 1); },
    lights(r) { return flyLights(r, MAD.coral); },
  },

  // Open Palm: a great coral palm rises open before Kosango's ally, shines gold, and everything clinging to it falls away.
  madrepore_palm: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 4), up = ease(prog(t, 0, hitOf(r))), a = t - hitOf(r);
      coralHand(U.x + face(U) * 9, U.y + 2 - up * 3, 1.4, 1, L);
      if (a >= 0) { if ((a >> 2) & 1) glint(U.x + face(U) * 9, U.y - 8, MAD.gold, L); for (let q = 0; q < 4; q++) { const b = a - q; if (b >= 0 && b < 12) px(U.x - 3 + q * 2, U.y + b * 0.7, '#8a7a88', fade(b, 12)); } }
    },
  },

  // Every Hand: coral hands rise beside Kosango, four coral pieces circle and fly to rap every foe, and gold rises round the team.
  madrepore_hand: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, B = signAt(U, 0), L = hold(t, 0, leaveOf(r) + 6, 4); for (let q = 0; q < 3; q++) coralHand(B.x - 5 + q * 5, B.y + 4 - Math.round(3 * ease(prog(t, q * 3, 10 + q * 3))), 0.8, 1, L); },
    front(r) {
      flying(r, p => coralHand(p.x, p.y, 0.7, 0, 1));
      landed(r, 18, (E, a, i) => { if (a < 7) arc(E.x, E.y - 6, 3 + a, 2 + a, W, fade(a, 7), 0.55, 0.95); if (i < r.to.length) for (let y = 0; y < Math.min(20, a * 4); y++) px(E.x, E.y + 5 - y, MAD.gold, fade(a, 18)); });
      const a = r.t - lastOf(r);
      if (a >= 0) motes(r.from.x, r.from.y, a, 6, r.seed, [MAD.gold, MAD.pale], 18, 8);
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 8, 2) }; },
  },


  // ---------------- Shinmi
  // Pearl Roll: three pink pearls roll across, bouncing a little, and each lands on the foe with a glint of sheen.
  blush_roll: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => pearlAt(p.x, p.y - Math.abs(Math.sin(p.u * Math.PI * 2)) * 2, 2, r.t + p.i * 3));
      landed(r, 12, (E, a, i) => { if (a < 8) glint(E.x - 3 + i * 3, E.y - 2 + (i % 2) * 2, BLU.white, fade(a, 8)); sparks(E.x, E.y, hs(a), 4, r.seed + i, W, BLU.pink, 8, 0.7); });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, BLU.pink); },
  },

  // Roll Over: four pearls roll along the ground through every foe, and cracks open in the ground under them.
  blush_hum: {
    noFlights: true, noLandings: true,
    back(r) { r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0 && a < 18) { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 7, E.x + reach, E.y + 7, BLU.rose, fade(a, 18)); } }); },
    front(r) {
      flying(r, p => pearlAt(p.x, p.E.y + 4, 2, r.t * 2 + p.i * 3));
      landed(r, 10, (E, a, i) => { if (i < r.to.length) sparks(E.x, E.y + 4, a, 5, r.seed + i, BLU.white, BLU.pink, 8, 0.8); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Hear a Voice: a voice calls from the foe's side, and a pearl rolls fast to it and bursts into nacre shards.
  blush_give: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), S = r.from, d = S.x >= E.x ? 1 : -1; if (t < hitOf(r)) for (let q = 0; q < 2; q++) { const k = ((t * 0.08 + q * 0.5) % 1); voice(E.x + (S.x - E.x) * k * 0.6, E.y + (S.y - E.y) * k * 0.6, d, 0.75); } },
    front(r) {
      flying(r, p => { pearlAt(p.x, p.y, 2.5, r.t * 3); tail(p.x, p.y, p.ux, p.uy, [BLU.white, BLU.pink]); });
      landed(r, 14, (E, a) => { for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 2 + hs(a) * 0.9; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? BLU.white : BLU.pink, fade(a, 14)); } });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, BLU.pink); },
  },

  // Rolls Home: voices call from all round, pearls sweep through every foe, and three small Seed Pearls are left by Shinmi.
  blush_home: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, leaveOf(r) + 4, 4);
      for (let q = 0; q < 3; q++) { const g = q / 3 * Math.PI * 2 + t * 0.05; voice(U.x + Math.cos(g) * 14, U.y - 2 + Math.sin(g) * 6, Math.cos(g) > 0 ? -1 : 1, L * 0.75); }
      const a = t - lastOf(r);
      if (a >= 0) for (let q = 0; q < 3; q++) pearlAt(U.x - 6 + q * 6, U.y + 7, 1.5, t + q * 4, fade(a, r.end - lastOf(r), 6));
    },
    front(r) {
      flying(r, p => pearlAt(p.x, p.E.y + 3, 2.5, r.t * 2 + p.i * 3));
      landed(r, 14, (E, a, i) => { if (i < r.to.length) { const reach = Math.round(10 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 7, E.x + reach, E.y + 7, BLU.rose, fade(a, 14)); } if (a < 6) glint(E.x - 4 + (i % 5) * 2, E.y - 2, BLU.white, 1 - a / 6); });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Korvami
  // Spiral Hum: sound rings spiral out of Korvami's horn and grow as they go, ringing round every foe.
  cochlea_hum: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; horn(U.x + face(U) * 7, U.y - 6, 1, face(U), t, hold(t, 0, leaveOf(r) + 8, 3)); },
    front(r) {
      flying(r, p => arc(p.x, p.y, 1 + p.u * 3, 1 + p.u * 3, p.i % 2 ? COC.red : COC.pale, 1));
      landed(r, 12, (E, a, i) => { if (i % 3 === 0) ring(E.x, E.y, 3 + a * 0.9, COC.pale, fade(a, 12)); });
    },
  },

  // Inner Ear: a small spiral settles by the foe's ear and pulses, and a struck-through arc says it hears nothing.
  cochlea_ear: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { blit(SEI_DROP, p.x, p.y, { f: COC.pale, g: '#7ab0d8', d: COC.dark }, 1); });
      const a = r.t - hitOf(r), E = aim(r), P = signAt(E, -7);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), k = (a >> 3) & 1; horn(P.x, P.y + 3, 0.7 + k * 0.2, -face(E), r.t, L); line(P.x - 3, P.y - 1, P.x + 3, P.y + 5, COC.red, L); }
    },
  },

  // Ring Through: two rings pass right through the foe and on toward its bench, and red rings shiver round it, Resonant.
  cochlea_bind: {
    noFlights: true, noLandings: true,
    front(r) {
      for (const f of r.flights) {
        const a = r.t - f.t0, E = r.to[f.to] || r.to[0], S = r.from;
        if (a < 0 || a >= f.dur * 1.5) continue;
        const u = a / f.dur, x = S.x + (E.x - S.x) * u, y = S.y + (E.y - S.y) * u;
        arc(x, y, 3, 3, f.i ? COC.red : COC.pale, u < 1 ? 1 : fade(a - f.dur, f.dur * 0.5));
      }
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), j = (r.t & 1) ? 1 : 0; arc(E.x + j, E.y, 6, 5, COC.red, L); arc(E.x - j, E.y, 8, 7, COC.pale, L * 0.5); }
    },
  },

  // Louder Out: a great horn beside Korvami sends out arcs that grow louder and louder, they spiral into the foe, and burst on past it.
  cochlea_louder: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0), d = face(r.from), L = hold(t, 0, leaveOf(r) + 6, 4); horn(B.x - d * 4, B.y + 2, 1.5, d, t, L); if (t < leaveOf(r) + 4) louder(B.x + d * 4, B.y + 2, d, 1 + Math.min(4, Math.floor(t / 4)), L); },
    front(r) {
      flying(r, p => arc(p.x, p.y, 1 + p.u * 4, 1 + p.u * 4, p.i % 2 ? COC.red : COC.pale, 1));
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) { const d = E.x >= r.from.x ? 1 : -1; louder(E.x + d * 4, E.y, d, Math.min(5, 1 + (a >> 1)), fade(a, 18)); sparks(E.x, E.y, hs(a, 5), 8, r.seed, W, COC.red, 12, 1.2); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
  },

  // ---------------- Suomono
  // Brine Mend: two beaded stems fly into the foe in a splash of brine, and green motes rise behind Suomono for its reserves.
  samphire_mend: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => beads(p.x, p.y + 3, 6, -(p.ux >= 0 ? 1 : -1) * 2));
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 4; q++) { const vx = (q - 1.5) * 0.6, vy = -1.2 - hash(r.seed + q + i) * 0.5; px(E.x + vx * a, E.y + vy * a + 0.12 * a * a, q % 2 ? SAM.brine : W, fade(a, 14)); } });
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 0) motes(U.x - face(U) * 8, U.y, a, 4, r.seed, [SAM.green, W], 18, 4);
    },
    lights(r) { return flyLights(r, SAM.green); },
  },

  // Pod Toss: three samphire pods lob onto the foe and burst in brine.
  samphire_pod: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { oval(p.x, p.y, 1.5, 1.5, SAM.green, 1); px(p.x, p.y - 2, SAM.red, 1); px(p.x - 1, p.y - 1, W, 1); });
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.6, vy = -1.4 - hash(r.seed + q + i) * 0.6; px(E.x + vx * a, E.y + vy * a + 0.12 * a * a, q % 2 ? SAM.brine : SAM.green, fade(a, 14)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, SAM.green); },
  },

  // Pickle: salt closes on the foe, a glass jar forms round it, the brine rises inside, and the lid goes on.
  samphire_curse: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => blit(['ww', 'wg'], p.x, p.y, { w: '#f2f2ee', g: SAM.glass }, 1));
      const n = landedN(r), E = aim(r);
      if (n) { const a = r.t - hitOf(r), L = fade(a, r.end - hitOf(r), 6); jar(E.x, E.y + 6, 6, Math.min(14, 6 + n * 3), Math.min(0.8, prog(a, 0, 20) * 0.8), r.t, L); }
    },
  },

  // Stake Down: beaded stems sprout round Suomono, and a salt-crusted stake drives into the sand beside it with each blow.
  samphire_stake: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 10));
      for (let q = 0; q < 4; q++) beads(U.x - 9 + q * 6, U.y + 6, Math.round(4 + 4 * g) - (q % 2) * 2, (q - 1.5) * 1.5, L);
      const n = landedN(r), x = U.x + face(U) * 12;
      if (n) { const h = 4 + n * 4; dither(x - 1, U.y + 6 - h, 3, h, SAM.brown, L); for (let j = 2; j < h; j += 3) line(x - 1, U.y + 6 - j, x + 1, U.y + 6 - j, '#f2f2ee', L); px(x, U.y + 6 - h - 1, '#f2f2ee', L); }
    },
    front(r) {
      const U = r.from, x = U.x + face(U) * 12;
      flying(r, p => blit(['ww', 'wg'], x - 2 + p.i * 3, U.y + 6 - p.u * 10, { w: '#f2f2ee', g: SAM.glass }, 1));
      landed(r, 10, (E, a) => chunks(x, U.y + 5, a, 5, r.seed + a, ['#f2f2ee', SAM.brown], 10, 0.8));
    },
    scene(r) { return jolt(r, 6, 1); },
  },

  // ---------------- Tenbinka
  // Tip: a small gimbal lobs over and lands tipped on the foe, and the ground cracks under the side it tips to.
  gimbal_tip: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x, E.y + 6, E.x + reach, E.y + 6, GIB.maroon, fade(a, 18)); line(E.x, E.y + 5, E.x + reach - 2, E.y + 5, GIB.brass, fade(a, 18)); }); },
    front(r) {
      flying(r, p => gimbalRings(p.x, p.y, 3, r.t * 0.3));
      landed(r, 14, (E, a) => { if (a < 10) { const tilt = Math.min(1, a / 4) * 0.4; line(E.x - 6, E.y - 6 - tilt * 6, E.x + 6, E.y - 6 + tilt * 6, GIB.pale, fade(a, 10)); px(E.x, E.y - 6, GIB.brass, fade(a, 10)); } });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, GIB.brass); },
  },

  // Steep: the inner ring spins round the foe and steeps it, and green drops run from it back to Tenbinka.
  gimbal_inner: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), S = r.from;
      flying(r, p => { const g = p.u * Math.PI * 4 + p.i * 2; px(E.x + Math.cos(g) * 9 * (1 - p.u * 0.4), E.y + Math.sin(g) * 5 * (1 - p.u * 0.4), '#8ac850', 1); });
      const a = t - hitOf(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); arc(E.x, E.y, Math.abs(Math.cos(t * 0.2)) * 6 + 0.6, 6, GIB.pale, L); for (let q = 0; q < 3; q++) { const u = ((a + q * 5) % 16) / 16; px(E.x + (S.x - E.x) * u, E.y + (S.y - E.y) * u - Math.sin(Math.PI * u) * 6, '#8ac850', L); } }
    },
  },

  // Outer Ring: the outer ring spins off Tenbinka carrying its troubles as dark motes, and closes round the foe with them.
  gimbal_outer: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { arc(p.x, p.y, 5, 5, GIB.brass, 1); for (let q = 0; q < 3; q++) { const g = q * 2.1 + r.t * 0.3; px(p.x + Math.cos(g) * 3, p.y + Math.sin(g) * 3, '#9a5ab0', 1); } });
      landed(r, r.end, (E, a) => { const L = fade(a, r.end - hitOf(r), 6), rr = Math.max(6, 10 - a * 0.5); arc(E.x, E.y, rr, rr, GIB.brass, L); for (let q = 0; q < 3; q++) { const g = q * 2.1 + r.t * 0.1; px(E.x + Math.cos(g) * 3, E.y + Math.sin(g) * 3, '#9a5ab0', L); } });
    },
    scene(r) { return jolt(r, 3, 1); },
    lights(r) { return flyLights(r, GIB.brass); },
  },

  // Level: a great gimbal stands between Tenbinka and the foe, a level line between them tips and swings, and settles dead even.
  gimbal_level: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), L = hold(t, 0, r.end, 6), M = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 - 2 };
      gimbalRings(M.x, M.y, 8, t * 0.15, L);
      const settle = prog(t, hitOf(r), lastOf(r) + 6), sw = Math.sin(t * 0.3) * 6 * (1 - settle);
      line(S.x, S.y - 8 + sw, E.x, E.y - 8 - sw, GIB.brass, 0.75 * L);
      px(S.x, S.y - 8 + sw, W, L); px(E.x, E.y - 8 - sw, W, L);
    },
    front(r) {
      flying(r, p => arc(p.x, p.y, 2, 2, GIB.brass, 1));
      landed(r, 14, (E, a) => { if (a < 6) ring(E.x, E.y + 2, 4 + a, GIB.pale, 1 - a / 6); });
    },
  },

  // ---------------- Hilzuka
  // Shh: a small ring of quiet flies to the foe and settles round its head, and the sound goes out of it.
  lull_bolt: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => hush(p.x, p.y, 2.5, r.t));
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); hush(E.x, E.y - 2, 7, r.t, L); muted(E.x + 6, E.y - 8, 1, L); }
    },
  },

  // Low Note: three low notes weave to every foe, and rings of quiet spread round each, muting what it hears.
  lull_note: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { arc(p.x, p.y, 2, 2, LUL.cyan, 1, 0.6, 1.4); px(p.x, p.y, LUL.white, 1); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6); hush(E.x, E.y, 6 + Math.min(4, a * 0.4), r.t, L); if (j === 0) muted(E.x + 7, E.y - 7, 1, L); } });
    },
    lights(r) { return flyLights(r, LUL.cyan); },
  },

  // Hush Seal: a seal of quiet flies to the foe and sticks to it, and the struck-through sound stays on it.
  lull_seal: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { arc(p.x, p.y, 2.5, 2.5, LUL.cyan, 1); line(p.x - 2, p.y, p.x + 2, p.y, LUL.white, 1); line(p.x, p.y - 2, p.x, p.y + 2, LUL.white, 1); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); arc(E.x, E.y, 3, 3, LUL.cyan, L); line(E.x - 2, E.y, E.x + 2, E.y, LUL.white, L); line(E.x, E.y - 2, E.x, E.y + 2, LUL.white, L); muted(E.x + 6, E.y - 8, 1, L); if (a < 4) hush(E.x, E.y, 8 - a, r.t, 1); }
    },
    lights(r) { return flyLights(r, LUL.cyan); },
  },

  // Long Quiet: a dome of quiet spreads out from Hilzuka over the whole field, rings close on every foe, and nothing hears.
  lull_long: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 16)); hush(U.x, U.y, 6 + 50 * g, t, L); hush(U.x, U.y, 4 + 40 * g, -t, L * 0.5); },
    front(r) {
      flying(r, p => { arc(p.x, p.y, 2, 2, LUL.cyan, 1); px(p.x, p.y, LUL.white, 1); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6); muted(E.x + 6, E.y - 8, 1, L); if (a < 10) hush(E.x, E.y, 9 - a * 0.5, r.t, 1 - a / 10); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 6, 1) }; },
  },

  // ---------------- Laibiru
  // Lip Notch: Laibiru's flared lip snaps shut on the foe, and a silver notch is cut into it.
  flange_ring: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, FLA.silver, FLA.red);
      flying(r, p => flaredLip(p.x - p.ux * 4, p.y, p.ux >= 0 ? 1 : -1, 0.5));
      landed(r, r.end, (E, a) => { const d = E.x >= r.from.x ? 1 : -1; if (a < 6) flaredLip(E.x - d * 6, E.y, d, Math.max(0, 0.8 - a * 0.2)); notch(E.x + 1, E.y - 3, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Flare Out: Laibiru's lip flares wide beside it, edges of shell sweep out through every foe, and each takes another notch.
  flange_flare: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; flaredLip(U.x + face(U) * 4, U.y - 2, face(U), ease(prog(t, 0, leaveOf(r))), hold(t, 0, leaveOf(r) + 6, 3)); },
    front(r) {
      flying(r, p => { arc(p.x, p.y, 3, 2, FLA.silver, 1, 0.5, 1); arc(p.x, p.y + 1, 3, 2, FLA.red, 1, 0.55, 0.95); });
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) notch(E.x - 2 + j, E.y - 3, fade(a, r.end - hitAt(r, j), 6)); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Name Call: Laibiru calls its own name, its lip opens wider and wider in two steps, and the call rings out.
  flange_call: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, d = face(U), open = Math.min(1, Math.floor(prog(t, 0, hitOf(r)) * 2.99) / 2);
      flaredLip(U.x + d * 5, U.y - 2, d, open, hold(t, 0, r.end, 4));
      flying(r, p => { const x = U.x + d * (11 + p.u * 8); arc(x, U.y - 2, 2 + p.u * 3, 2 + p.u * 3, FLA.silver, 1, d > 0 ? -0.15 : 0.35, d > 0 ? 0.15 : 0.65); });
      const a = t - hitOf(r);
      if (a >= 0) arc(U.x, U.y + 1, 7, 6, FLA.silver, fade(a, r.end - hitOf(r), 6) * ((a >> 2) & 1 ? 1 : 0.5));
    },
  },

  // Wide Open: Laibiru's lip opens wider and wider, it dashes in, and two edges of the lip close on the foe like jaws.
  flange_wide: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; if (t < 14) flaredLip(U.x + face(U) * 5, U.y - 2, face(U), Math.floor(t / 4) / 3, 1); },
    front(r) {
      smear(r, FLA.silver, FLA.red);
      flying(r, p => flaredLip(p.x, p.y, p.x < p.E.x ? 1 : -1, 1 - p.u));
      landed(r, 16, (E, a, i) => { if (i === r.hits.length - 1) { sparks(E.x, E.y, hs(a, 5), 9, r.seed, W, FLA.silver, 12, 1.2); for (let q = 0; q < 3; q++) notch(E.x - 4 + q * 4, E.y - 4, fade(a, 16)); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
  },

  // ---------------- Sisarmai
  // Twinkle: a star twinkles across to the foe, and a little ring of sister stars pins its feet.
  pleiad_twinkle: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { glint(p.x, p.y, PLE.orange, 1); tail(p.x, p.y, p.ux, p.uy, [PLE.pale, PLE.blue]); });
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 4; q++) { const g = q / 4 * Math.PI * 2 + a * 0.05; if (((a >> 2) + q) % 3) glint(E.x + Math.cos(g) * 7, E.y + 6 + Math.sin(g) * 1.5, PLE.orange, L); } }
    },
    lights(r) { return flyLights(r, PLE.pale); },
  },

  // Cluster: three star stones close on the foe, blue lines join them round it like a constellation, and the ground cracks.
  pleiad_cluster: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, PLE.blue, fade(a, 18)); } }); },
    front(r) {
      flying(r, p => { blit(['.ss.', 'swss', '.ss.'], p.x, p.y, { s: '#8a8070', w: PLE.pale }, 1); });
      const n = landedN(r), E = aim(r), L = fade(r.t - hitOf(r), r.end - hitOf(r), 6), pts = [{ x: E.x - 7, y: E.y - 4 }, { x: E.x + 7, y: E.y - 2 }, { x: E.x, y: E.y + 5 }];
      for (let q = 0; q < n; q++) { glint(pts[q].x, pts[q].y, PLE.orange, L); if (q) line(pts[q - 1].x, pts[q - 1].y, pts[q].x, pts[q].y, PLE.blue, L); }
      if (n === 3) line(pts[2].x, pts[2].y, pts[0].x, pts[0].y, PLE.blue, L);
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Call Out: the seven sisters show over Sisarmai, more of them light with each call, and a sister star comes down beside it.
  pleiad_call: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, B = signAt(U, 0); sisters(B.x - 2, B.y + 1, 1 + landedN(r) * 2, 1.4, t, hold(t, 0, r.end, 4)); },
    front(r) {
      const U = r.from, x = U.x + face(U) * 11;
      flying(r, p => glint(p.x, p.y, PLE.pale, 1));
      const a = r.t - lastOf(r);
      if (a >= 0) { const y = U.y - 10 + Math.min(10, a); glint(x, y, PLE.orange, fade(a, r.end - lastOf(r), 6)); arc(x, y, 3, 3, PLE.blue, fade(a, r.end - lastOf(r), 6)); }
    },
  },

  // Seven Fall: the seven sisters show high over the field joined by blue lines, then all of them fall on every foe in a glare.
  pleiad_seven: {
    lead: 14, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 0, leaveOf(r) + 4, 4); sisters(48, 12, Math.min(7, 1 + Math.floor(t / 2)), 2, t, L); },
    front(r) {
      flying(r, p => { glint(p.x, p.y, PLE.orange, 1); px(p.x, p.y - 2, PLE.pale, 0.75); px(p.x, p.y - 4, PLE.blue, 0.5); });
      landed(r, 14, (E, a, i) => { if (a < 4) glint(E.x + (i % 7 - 3) * 2, E.y - 1 + (i % 2) * 2, PLE.pale, 1); });
      const a = r.t - lastOf(r), U = r.from;
      if (a >= 0) for (let q = 0; q < 2; q++) glint(U.x + (q ? 11 : -11), U.y - 6, PLE.orange, fade(a, r.end - lastOf(r), 6));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 8, 1) }; },
  },


  // ---------------- Pakaeri
  // Return Flare: a star comes in from far out, growing as it nears, bursts on the foe, and leaves orange Glow on it.
  aphelion_spear: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { returnStar(p.x, p.y, 0.5 + p.u * 2.5, r.t); tail(p.x, p.y, p.ux, p.uy, [APH.gold, APH.orange, APH.plum]); });
      landed(r, r.end, (E, a) => { if (a < 10) sparks(E.x, E.y, hs(a), 8, r.seed, W, APH.orange, 10, 1.1); const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 2; q++) { const b = (a + q * 6) % 12; px(E.x - 2 + q * 4, E.y + 2 - b * 0.5, (b >> 1) & 1 ? APH.gold : APH.orange, L); } });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, APH.gold); },
  },

  // Far Out: a wide orbit shows high over the field, and two small far stars come down out of it on the foe.
  aphelion_farout: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, S = r.from, E = aim(r); orbitPath((S.x + E.x) / 2, 14, 34, 7, hold(t, 0, lastOf(r) + 4, 4) * 0.75); },
    front(r) {
      flying(r, p => returnStar(p.x, p.y, 1, r.t));
      landed(r, 18, (E, a) => { const reach = Math.round(8 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, APH.plum, fade(a, 18)); line(E.x - reach + 2, E.y + 5, E.x + reach - 2, E.y + 5, APH.orange, fade(a, 18)); });
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, APH.gold); },
  },

  // Swing Back: the star swings round a tight orbit about Pakaeri and sweeps through every foe, and Pakaeri streaks off to let an ally in.
  aphelion_swing: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; orbitPath(U.x, U.y, 10, 4, hold(t, 0, leaveOf(r) + 4, 3)); },
    front(r) {
      const t = r.t, U = r.from;
      if (t < leaveOf(r)) { const g = t * 0.6; returnStar(U.x + Math.cos(g) * 10, U.y + Math.sin(g) * 4, 1.5, t); }
      flying(r, p => returnStar(p.x, p.y, 1.5, t));
      landed(r, 14, (E, a, i) => { if (a < 6) glint(E.x + (i % 3 - 1) * 3, E.y - 2, APH.gold, 1 - a / 6); });
      const a = t - lastOf(r);
      if (a >= 0 && a < 12) returnStar(U.x - face(U) * a * 2, U.y - a, 1, t, fade(a, 12));
    },
  },

  // Comes Back: a long orbit crosses the sky and the star rides it home, bigger and hotter at each step, then three comets strike the foe.
  aphelion_back: {
    lead: 14, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), L = hold(t, 0, leaveOf(r) + 4, 4), u = Math.min(4, Math.floor(prog(t, 0, 14) * 4.99));
      orbitPath((S.x + E.x) / 2, 18, 40, 10, L * 0.75);
      const g = Math.PI * (1.2 - u * 0.2), M = { x: (S.x + E.x) / 2, y: 18 };
      returnStar(M.x + Math.cos(g) * 40, M.y + Math.sin(g) * 10, 1 + u * 0.6, t, L);
    },
    front(r) {
      smear(r, APH.pale, APH.orange);
      flying(r, p => { returnStar(p.x, p.y, 2, r.t); tail(p.x, p.y, p.ux, p.uy, [APH.gold, APH.orange, APH.plum]); });
      landed(r, 16, (E, a, i) => { if (i === r.hits.length - 1) { if (a < 4) { arc(E.x, E.y, 6 + a, 6 + a, W, 1); oval(E.x, E.y, 4, 4, APH.pale, 0.5); } sparks(E.x, E.y, hs(a, 5), 10, r.seed, W, APH.orange, 14, 1.3); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(a, 10, 2) }; },
    lights(r) { return flyLights(r, APH.gold); },
  },

  // ---------------- Astrolabe
  // Sight Line: the astrolabe stands beside its keeper, swings its sighting bar onto the foe, and a dashed sight line runs to it.
  astrolabe_sight: {
    lead: 6, tail: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, B = signAt(U, 8), E = aim(r), ang = Math.atan2(E.y - B.y, E.x - B.x) * ease(prog(t, 0, 8)); astro(B.x, B.y, 5, ang, hold(t, 0, r.end, 4)); },
    front(r) {
      const t = r.t, U = r.from, B = signAt(U, 8), E = aim(r), on = hold(t, leaveOf(r), hitOf(r) + 8, 2);
      if (on > 0) line(B.x, B.y, E.x, E.y, AST2.cream, on, 2);
      landed(r, r.end, (P, a) => { if (a < 6) { arc(P.x, P.y, 5, 5, AST2.brass, 1 - a / 6); for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2; px(P.x + Math.cos(g) * 6, P.y + Math.sin(g) * 6, AST2.cream, 1 - a / 6); } } tally(B.x, B.y + 8, 2, fade(a, r.end - hitOf(r), 6)); });
    },
  },

  // Brass Ring: brass rings with marked rims sweep through every foe and settle round them, slowing them.
  astrolabe_ring: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => astro(p.x, p.y, 3, r.t * 0.3, 1));
      r.to.forEach((E, j) => { const a = r.t - hitAt(r, j); if (a >= 0) { const L = fade(a, r.end - hitAt(r, j), 6), rr = Math.max(6, 10 - a * 0.5); arc(E.x, E.y + 2, rr, rr * 0.4, AST2.brass, L); for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2; px(E.x + Math.cos(g) * rr, E.y + 2 + Math.sin(g) * rr * 0.4, AST2.cream, L); } } });
    },
  },

  // Star Shower: the astrolabe tilts up and its star dots light, stars rain onto the foe, and three marks stay over it.
  astrolabe_shower: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 8); astro(B.x, B.y, 5, -Math.PI / 2 * ease(prog(t, 0, 12)), hold(t, 0, lastOf(r) + 4, 4)); },
    front(r) {
      flying(r, p => { glint(p.x, p.y, AST2.cream, 1); px(p.x, p.y - 2, AST2.brass, 0.5); });
      landed(r, 10, (E, a, i) => { if (a < 6) glint(E.x + (i - 1.5) * 3, E.y - 1, AST2.cream, 1 - a / 6); });
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 0) for (let q = 0; q < 3; q++) glint(E.x - 4 + q * 4, E.y - 9, AST2.brass, fade(a, r.end - lastOf(r), 6));
    },
  },

  // Last Reading: the great astrolabe turns and takes its readings, four marks close on the foe, the fourth lights, and its disc opens under the foe.
  astrolabe_last: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, B = signAt(r.from, 8), L = hold(t, 0, r.end, 6);
      astro(B.x, B.y, 7, t * 0.15, L);
      tally(B.x, B.y + 10, Math.min(3, Math.floor(t / 4)) + (t >= lastOf(r) ? 1 : 0), L);
      const a = t - lastOf(r), E = aim(r);
      if (a >= 0) { const k = fade(a, r.end - lastOf(r), 6); arc(E.x, E.y + 6, 12, 3.5, AST2.brass, k); for (let q = 0; q < 12; q++) { const g = q / 12 * Math.PI * 2; px(E.x + Math.cos(g) * 11, E.y + 6 + Math.sin(g) * 3, q % 3 ? AST2.brown : AST2.cream, k); } }
    },
    front(r) {
      flying(r, p => { line(p.x, p.y - 2, p.x, p.y + 2, AST2.cream, 1); px(p.x, p.y, AST2.brass, 1); });
      landed(r, 14, (E, a, i) => { if (i === r.hits.length - 1 && a < 6) { arc(E.x, E.y, 6 + a, 6 + a, W, 1); arc(E.x, E.y, 4, 4, AST2.brass, 1); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
  },

  // ---------------- Pallasite
  // Green Glint: Pallasite's shell opens on its cold crystal, a faceted shard flies out, and frost grows on the foe.
  pallasite_glint: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from; clamStar(U.x + face(U) * 9, U.y - 2, 1, hold(t, 0, hitOf(r), 4), face(U), t, hold(t, 0, hitOf(r) + 4, 3)); },
    front(r) {
      flying(r, p => { facet(p.x, p.y); tail(p.x, p.y, p.ux, p.uy, [PAL.blue, PAL.deep]); });
      landed(r, 16, (E, a) => { for (let q = 0; q < 5; q++) { const g = hash(r.seed + q * 3) * Math.PI * 2, d = 4 + hash(r.seed + q) * 3, k = Math.min(1, Math.max(0, (a - q) / 3)); if (k > 0) glint(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, PAL.blue, fade(a, 16) * k); } });
    },
    lights(r) { return flyLights(r, PAL.blue); },
  },

  // Iron Sparks: iron sparks zigzag out of the open shell and fizz on the foe, and then the shell shuts round Pallasite.
  pallasite_sparks: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, last = lastOf(r), open = t < last ? 1 : 1 - prog(t, last, last + 6);
      flying(r, p => { px(p.x, p.y, W, 1); tail(p.x, p.y, p.ux, p.uy, ['#f8c860', '#da650f']); });
      landed(r, 14, (E, a, i) => { for (let q = 0; q < 3; q++) { const b = a - q * 2; if (b >= 0 && b < 10) arc(E.x + (q - 1) * 3 + (i % 2), E.y + 4 - b * 0.8, 1, 1, PAL.blue, fade(b, 10)); } });
      if (t >= last) clamStar(U.x, U.y + 1, 2.2, open, face(U), t, hold(t, last, r.end, 4));
    },
    lights(r) { return flyLights(r, '#f8c860', 'zigzag'); },
  },

  // Half Shell: half of Pallasite's shell rises beside it and stands on edge, a Shell Wall.
  pallasite_dive: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, x = U.x + face(U) * 10, n = landedN(r);
      flying(r, p => { const h = Math.round(p.u * 6); arc(x, U.y + 6, 3, h, PAL.shell, 1, 0.5, 1); });
      if (n) { const L = hold(t, hitOf(r), r.end, 4); arc(x, U.y + 6, 4, 10, PAL.shell, L, 0.5, 1); arc(x, U.y + 6, 3, 9, PAL.blue, L * 0.5, 0.55, 0.95); for (let q = 0; q < 3; q++) line(x - 2 + q * 2, U.y + 6, x - 1 + q, U.y - 2, PAL.deep, L * 0.75); }
    },
    front(r) { const U = r.from, x = U.x + face(U) * 10; landed(r, 10, (E, a) => sparks(x, U.y, a, 5, r.seed + a, W, PAL.blue, 8, 0.8)); },
  },

  // Shell Nova: Pallasite's shell opens wide on its cold crystal, crystal shards sweep through every foe, and they shatter in the glare.
  pallasite_nova: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0); clamStar(B.x, B.y + 2, 2, ease(prog(t, 0, 12)), face(r.from), t, hold(t, 0, leaveOf(r) + 6, 4)); },
    front(r) {
      flying(r, p => facet(p.x, p.y));
      landed(r, 16, (E, a, i) => { if (i < r.to.length) for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 2 + hs(a, 4) * 0.9; facet(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, fade(a, 16)); } });
    },
    scene(r) { return jolt(r, 10, 2); },
  },

  // ---------------- Rusumo
  // Pink Bloom: pink petals spiral in and a pink bloom opens on the foe, and two drops of its tide turn pink.
  halophile_bloom: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => blit((r.t >> 1) & 1 ? ['pw', 'p.'] : ['wp', '.p'], p.x, p.y, { p: HAL.pink, w: HAL.white }, 1));
      const a = r.t - lastOf(r), E = aim(r);
      if (a >= 0) { const L = fade(a, r.end - lastOf(r), 6); for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 - Math.PI / 2, d = 2 + Math.min(1, a / 6) * 3; oval(E.x + Math.cos(g) * d, E.y - 1 + Math.sin(g) * d * 0.8, 1.5, 1.5, HAL.pink, L); } px(E.x, E.y - 1, HAL.white, L); for (let q = 0; q < 2; q++) blit(SEI_DROP, E.x - 3 + q * 6, E.y - 10, { f: HAL.white, g: HAL.pink, d: '#904a5b' }, L); }
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 4, 1) }; },
  },

  // Salt Draw: salt closes on the foe, and a clear drop of its tide is drawn out and flies over to Rusumo.
  halophile_draw: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => blit(['ww', 'wp'], p.x, p.y, { w: HAL.white, p: HAL.pink }, 1));
      landed(r, 18, (E, a, i) => { if (i !== r.hits.length - 1) return; const u = prog(a, 2, 16), S = r.from; if (u > 0 && u < 1) blit(SEI_DROP, E.x + (S.x - E.x) * u, E.y + (S.y - E.y) * u - Math.sin(Math.PI * u) * 8, { f: W, g: HAL.clear, d: '#3a6a9a' }, 1); });
      landed(r, 8, (E, a) => sparks(E.x, E.y, a, 4, r.seed + a, W, HAL.pink, 6, 0.6));
    },
  },

  // Stain Water: pink drops rain on the foe and a pink pool spreads at its feet, staining the water it holds.
  halophile_stain: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), E = aim(r); if (n) pinkPool(E.x, E.y + 6, 3 + n * 2, r.t, fade(r.t - hitOf(r), r.end - hitOf(r), 6)); },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: HAL.white, g: HAL.pink, d: '#904a5b' }, 1));
      landed(r, 8, (E, a) => { for (let q = 0; q < 3; q++) px(E.x + (q - 1) * (1 + a * 0.4), E.y - 3 - Math.sin(Math.PI * a / 8) * 2, q % 2 ? HAL.pink : HAL.white, fade(a, 8)); });
    },
  },

  // Pink Pool: the ground on the foe's side turns to a pink pool, drops close in on the foe and burst pink, and the pool runs clear.
  halophile_pink: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, 12)), clear = prog(t, lastOf(r) + 4, r.end - 4);
      pinkPool(E.x, E.y + 6, 4 + 12 * g, t, L, clear > 0.5 ? HAL.clear : HAL.pink);
    },
    front(r) {
      flying(r, p => blit(SEI_DROP, p.x, p.y, { f: HAL.white, g: HAL.pink, d: '#904a5b' }, 1));
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) for (let q = 0; q < 8; q++) { const vx = (q - 3.5) * 0.6, vy = -1.6 - hash(r.seed + q) * 0.8, b = hs(a, 5); px(E.x + vx * b, E.y + 2 + vy * b + 0.12 * b * b, q % 2 ? HAL.pink : W, fade(a, 18)); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
  },

  // ---------------- Petami
  // Old Dust: old dust weaves over to the foe in a cloud, and a violet glint of its best is pulled back to Petami.
  heirloom_dust: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { for (let q = 0; q < 3; q++) px(p.x - p.ux * q * 2, p.y - p.uy * q * 2 + (q % 2), q % 2 ? HEI.tan : HEI.brown, q < 2 ? 1 : 0.5); });
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) { const u = prog(a, 2, 16), S = r.from; if (u > 0 && u < 1) glint(E.x + (S.x - E.x) * u, E.y + (S.y - E.y) * u - Math.sin(Math.PI * u) * 6, HEI.violet, 1); } if (a < 12) oval(E.x, E.y - a * 0.2, 3 + a * 0.3, 2 + a * 0.2, HEI.tan, 0.25 * fade(a, 12)); });
    },
  },

  // Faded Label: an old faded label flies to the foe and sticks, and a gold good status is lifted off it and carried back to Petami.
  heirloom_faded: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => blit(['.ttttt', 'tbtttt', 'ttbbbt', 'tttttt'], p.x, p.y, { t: HEI.tan, b: HEI.brown }, 1));
      landed(r, r.end, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 6); blit(['.ttttt', 'tbtttt', 'ttbbbt', 'tttttt'], E.x + 4, E.y - 4, { t: HEI.tan, b: HEI.brown }, L);
        const u = prog(a, 3, 16), S = r.from;
        if (u > 0 && u < 1) { const x = E.x + (S.x - E.x) * u, y = E.y - 6 + (S.y - 6 - E.y + 6) * u - Math.sin(Math.PI * u) * 6; line(x - 1, y, x + 1, y, '#f0c860', 1); line(x, y - 1, x, y + 1, '#f0c860', 1); }
      });
    },
  },

  // Nobody Knows: old glyphs circle Petami as it slips out of sight, it comes back behind a worn shell, and dust smokes off the foe.
  heirloom_nobody: {
    noFlights: true, noLandings: true,
    back(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); arc(U.x, U.y + 1, 8, 7, HEI.tan, L, 0.55, 0.95); arc(U.x, U.y + 2, 8, 7, HEI.brown, L, 0.6, 0.9); } },
    front(r) {
      flying(r, p => blit(['t.t', '.v.', 't.t'], p.x, p.y, { t: HEI.tan, v: HEI.violet }, 1));
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) for (let q = 0; q < 3; q++) { const r0 = Math.ceil(1 + a * 0.12); dither(E.x - 3 + q * 3 - r0, E.y - a * 0.5 - q * 2, 2 * r0 + 1, 2, q === 1 ? HEI.tan : HEI.brown, fade(a, 18) * 0.75); } });
    },
  },

  // Take to Keep: the old empty whorl opens over Petami, glyphs close on the foe, and a violet hook reaches out and pulls its crest into the whorl.
  heirloom_take: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0); oldWhorl(B.x - 2, B.y + 2, 1.4, ease(prog(t, 0, 12)), hold(t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, B = signAt(r.from, 0), M = { x: B.x - 2 + 5, y: B.y + 4 }, E = aim(r);
      flying(r, p => blit(['t.t', '.v.', 't.t'], p.x, p.y, { t: HEI.tan, v: HEI.violet }, 1));
      const out = ease(prog(t, hitOf(r) - 4, lastOf(r))) * (1 - ease(prog(t, lastOf(r) + 6, r.end - 4))), P = { x: M.x + (E.x - M.x) * out, y: M.y + (E.y - M.y) * out };
      if (out > 0.05) { hookLine(M, P, 1); if (t >= lastOf(r)) glint(P.x, P.y + 2, '#f8e0a0', 1); }
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 8, 2), dark: 0.25 * hold(r.t, 0, r.end, 6) }; },
  },

  // ---------------- Opaski
  // Bearing: Opaski's star swings its long point onto the foe, a star flies along it, and a pointer stays over the foe.
  lodestar_bearing: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = signAt(U, 8), E = aim(r), ang = Math.atan2(E.y - B.y, E.x - B.x) * ease(prog(t, 0, leaveOf(r))) - Math.PI / 2 * (1 - ease(prog(t, 0, leaveOf(r))));
      compassStar(B.x, B.y, 3, ang, hold(t, 0, hitOf(r) + 6, 3));
      flying(r, p => { glint(p.x, p.y, LOD.gold, 1); tail(p.x, p.y, p.ux, p.uy, [LOD.pale, LOD.slate]); });
      landed(r, r.end, (E2, a) => { const L = fade(a, r.end - hitOf(r), 6), P = signAt(E2, 0); compassStar(P.x, P.y, 2, Math.atan2(E2.y - P.y, E2.x - P.x), L); if (a < 6) glint(E2.x, E2.y, LOD.pale, 1 - a / 6); });
    },
    lights(r) { return flyLights(r, LOD.gold); },
  },

  // Star Fix: a star rises up out of the ground under the foe and strikes it, and a Fixed Star is pinned beside Opaski.
  lodestar_fix: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => { glint(p.x, p.y, LOD.gold, 1); px(p.x, p.y + 2, LOD.pale, 0.5); });
      landed(r, 12, (E, a) => { if (a < 6) { line(E.x, E.y + 6, E.x, E.y - 6 + a, LOD.pale, 1 - a / 6); glint(E.x, E.y - 1, LOD.gold, 1 - a / 6); } });
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 0) fixedStar(U.x + face(U) * 10, U.y - 4 + Math.max(0, 6 - a), fade(a, r.end - hitOf(r), 6));
    },
    lights(r) { return flyLights(r, LOD.gold, 'rise'); },
  },

  // Steer By: Opaski's star spins and fixes on the foe, a gold bolt runs to it, and fixed stars pin round it so it cannot leave.
  lodestar_steer: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, B = signAt(U, 8), E = aim(r);
      compassStar(B.x, B.y, 3, t < leaveOf(r) ? t * 0.6 : Math.atan2(E.y - B.y, E.x - B.x), hold(t, 0, hitOf(r) + 4, 3));
      flying(r, p => { let lx = p.x, ly = p.y; for (let i = 1; i < 5; i++) { const j = (hash(r.seed + i + (p.a >> 1)) - 0.5) * 3, nx = p.x - p.ux * i * 2 - p.uy * j, ny = p.y - p.uy * i * 2 + p.ux * j; line(lx, ly, nx, ny, i === 1 ? W : LOD.gold, 1); lx = nx; ly = ny; } });
      landed(r, r.end, (P, a) => { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 4; q++) { const g = q / 4 * Math.PI * 2 + 0.785; fixedStar(P.x + Math.cos(g) * 8, P.y + Math.sin(g) * 4, L * Math.min(1, (a - q) / 2 + 0.01)); } });
    },
    scene(r) { return jolt(r, 3, 1); },
  },

  // Kept Course: a great star over Opaski points at the foe, fixed stars light in a course between them, stars close on the foe, and the course stays as a wall.
  lodestar_course: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, S = r.from, E = aim(r), B = signAt(S, 8), L = hold(t, 0, r.end, 6);
      compassStar(B.x, B.y, 4, Math.atan2(E.y - B.y, E.x - B.x), L);
      const n = Math.min(5, Math.floor(t / 2));
      for (let q = 1; q <= n; q++) { const u = q / 6; fixedStar(S.x + (E.x - S.x) * u, S.y - 8 + (E.y - S.y) * u, L * 0.75); }
    },
    front(r) {
      flying(r, p => glint(p.x, p.y, LOD.gold, 1));
      landed(r, 14, (E, a, i) => { if (i === r.hits.length - 1 && a < 5) { arc(E.x, E.y, 6 + a, 6 + a, W, 1); oval(E.x, E.y, 4, 4, LOD.pale, 0.5); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) }; },
  },

  // ---------------- Kotigai
  // Coil Knock: three small coiled shells roll through every foe, knocking the ground out from under them.
  ammonite_knock: {
    noFlights: true, noLandings: true,
    front(r) {
      flying(r, p => ammo(p.x, p.E.y + 3, 3, 0, 1));
      landed(r, 12, (E, a, i) => { if (i < r.to.length * 3) chunks(E.x, E.y + 5, a, 3, r.seed + i, [AMM.tan, AMM.brown], 12, 0.8); });
    },
    scene(r) { return jolt(r, 4, 1); },
  },

  // Spiral Ridge: a ridged coil corkscrews into the foe and cracks the ground, and a chamber lights in Kotigai's own coil.
  ammonite_ridge: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, 18, (E, a) => { const reach = Math.round(9 * Math.min(1, (a + 1) / 4)); line(E.x - reach, E.y + 6, E.x + reach, E.y + 6, AMM.brown, fade(a, 18)); }); },
    front(r) {
      flying(r, p => ammo(p.x, p.y, 3, 0, 1));
      const a = r.t - hitOf(r), U = r.from;
      if (a >= 0) ammo(U.x + face(U) * 10, U.y - 6, 4, Math.min(0.5, a * 0.05), fade(a, r.end - hitOf(r), 6));
    },
    scene(r) { return jolt(r, 4, 1); },
    lights(r) { return flyLights(r, AMM.tan, 'spiral'); },
  },

  // Septa: three ribbed septa rise round Kotigai and its team, and its own coil fills a little more with what it keeps.
  ammonite_septa: {
    noFlights: true, noLandings: true,
    back(r) { const n = landedN(r), U = r.from, L = hold(r.t, hitOf(r), r.end, 4); for (let q = 0; q < n; q++) arc(U.x, U.y + 1, 6 + q * 2, 5 + q * 2, q % 2 ? AMM.brown : AMM.tan, L, 0.55, 0.95); },
    front(r) {
      const U = r.from;
      flying(r, p => arc(p.x, p.y, 2, 1.5, AMM.tan, 1, 0.5, 1));
      const a = r.t - hitOf(r);
      if (a >= 0) { ammo(U.x + face(U) * 10, U.y - 6, 4, Math.min(0.6, 0.2 + a * 0.03), fade(a, r.end - hitOf(r), 6)); motes(U.x, U.y, a, 4, r.seed, [AMM.pale, AMM.tan], 16, 6); }
    },
  },

  // All Struck: a great coil beside Kotigai lights chamber by chamber with every blow it kept, four shells close on the foe, and it all comes out at once.
  ammonite_all: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { const t = r.t, B = signAt(r.from, 0), last = lastOf(r); ammo(B.x, B.y + 2, 7, t < last ? prog(t, 0, last) : 1 - prog(t, last, last + 8), hold(t, 0, r.end, 6)); },
    front(r) {
      flying(r, p => ammo(p.x, p.y, 2.5, 1, 1));
      landed(r, 18, (E, a, i) => { if (i === r.hits.length - 1) { if (a < 5) { arc(E.x, E.y, 6 + a, 6 + a, W, 1); oval(E.x, E.y, 4, 4, AMM.pale, 0.5); } chunks(E.x, E.y + 4, hs(a, 5), 8, r.seed, [AMM.tan, AMM.brown, AMM.pale], 18, 1.2); } });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 2) }; },
  },
};
