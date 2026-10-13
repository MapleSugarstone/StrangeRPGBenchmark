// Part B of the move-art pass: each move's own picture for the kinds in Notes/move-art/parts.ts, keyed by move id.
// Every kind keeps one motif from its own body across its moves, drawn in its sprite colors with ink and white. Solid
// colors and the ordered dither only. Nothing here runs at module load, and nothing reads the battle.
import { aim, arc, bands, beside, blit, dither, ease, glint, hash, high, hitOf, hold, leaveOf, line, oval, prog, px, sagAt, shake, thick, userAt, wash, type FxRun, type LegendArt, type Pt } from './kit';

const W = '#ffffff';

// ---------------------------------------------------------------- shared timing

/** A level that is 1 through a life of `len` frames and fades over its last `f`, and 0 outside it. */
const fade = (a: number, len: number, f = 4): number => (a < 0 || a >= len ? 0 : Math.min(1, (len - a) / f));
/** The age a layer shows `a` frames after a landing when it holds still there for `n` frames: the hit-stop. */
const still = (a: number, n = 2): number => (a <= 0 ? a : Math.max(0, a - n));
/** The middle of the whorl across the field from a point. */
const across = (p: Pt): Pt => (high(p) ? { x: 22, y: 42 } : { x: 75, y: 16 });
/** Which way the foe lies from the user: 1 to the right and -1 to the left. */
const toward = (r: FxRun): number => (across(r.from).x >= r.from.x ? 1 : -1);
const lerp = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
/** The frame of the last landing. */
const lastOf = (r: FxRun): number => (r.hits.length ? r.hits[r.hits.length - 1].at : r.end - 12);
/** A clear spot over a whorl for a sign: right of the far whorl and above the near one, out of both panels. */
const perch = (p: Pt): Pt => (high(p) ? { x: Math.min(86, p.x + 10), y: p.y - 6 } : { x: p.x, y: p.y - 13 });
/** A clear spot for a sign up to 28 wide: under the far whorl and above the near one, out of both panels. */
const wideSpot = (p: Pt): Pt => (high(p) ? { x: p.x - 2, y: p.y + 15 } : { x: p.x, y: p.y - 13 });

/** Each landing so far: its target, its age in frames, and its place among the run's landings. */
function landed(r: FxRun, fn: (E: Pt, a: number, i: number) => void): void {
  r.hits.forEach((h, i) => { const a = r.t - h.at; if (a >= 0) fn(r.to[h.to] || r.to[0], a, i); });
}
/** The share of a flight's trip at which it lands. */
const shareOf = (r: FxRun): number => (r.plan.path === 'return' ? 0.5 : r.plan.path === 'sweep' ? 20 / 44 : 1);
/** Each flight still on its way in: its progress from 0 to 1, its target, its place in its volley, and the volley's size. */
function inbound(r: FxRun, fn: (u: number, E: Pt, i: number, n: number) => void): void {
  const s = shareOf(r);
  for (const f of r.flights) {
    const len = Math.max(1, Math.round(f.dur * s)), a = r.t - f.t0;
    if (a >= 0 && a < len) fn(a / len, r.to[f.to] || r.to[0], f.i, f.n);
  }
}
/** A point on the grammar's lob from S to E at u: low through the middle, where the panels close in, and high late over E. */
function lobAt(S: Pt, E: Pt, u: number, k = 1): Pt {
  const d = Math.hypot(E.x - S.x, E.y - S.y), v = (u - 0.8) / 0.2;
  return { x: S.x + (E.x - S.x) * u, y: S.y + (E.y - S.y) * u - k * (4 + d / 9) * (u <= 0.8 ? (u / 0.8) ** 4 : 1 + v - 2 * v * v) };
}

// ---------------------------------------------------------------- shared particles

/** n sparks thrown out from x, y over `life` frames, slowing as they go: white, then hot, then light. */
function sparks(x: number, y: number, a: number, n: number, hot: string, light: string, seed: number, reach = 8, life = 8): void {
  if (a < 0 || a >= life) return;
  const u = a / life, d = 1 + reach * (1 - (1 - u) * (1 - u));
  for (let q = 0; q < n; q++) {
    const t = (q + hash(seed + q) * 0.7) / n * Math.PI * 2;
    px(x + Math.cos(t) * d, y + Math.sin(t) * d * 0.75, u < 0.3 ? W : u < 0.65 ? hot : light, u < 0.75 ? 1 : 0.5);
  }
}
/** n chunks of a material thrown up from x, y on arcs that fall faster each frame, in two tones. */
function chunks(x: number, y: number, a: number, n: number, c1: string, c2: string, seed: number, life = 16, spread = 1.2, up = 1.4): void {
  if (a < 0 || a >= life) return;
  const lv = fade(a, life, 5);
  for (let q = 0; q < n; q++) {
    const vx = (hash(seed + q * 3) - 0.5) * 2 * spread, vy = -up - hash(seed + q * 5);
    dither(Math.round(x + vx * a), Math.round(y + vy * a + 0.13 * a * a), q % 3 ? 1 : 2, 2 - (q & 1), q & 1 ? c1 : c2, lv);
  }
}
/** A puff of dust or smoke at x, y: a solid core with a dithered rim that swells, rises, and thins over `life` frames. */
function puff(x: number, y: number, a: number, life: number, core: string, rim: string, size = 3, rise = 0.25): void {
  if (a < 0 || a >= life) return;
  const u = a / life, r = size * (0.6 + 0.7 * u), cy = y - a * rise;
  oval(x, cy, r + 1, r * 0.7 + 1, rim, 0.5 * (1 - u));
  oval(x, cy, r, r * 0.7, core, u < 0.5 ? 1 : (1 - u) * 2);
}
/** A ring that spreads from x, y to rx over `life` frames, `flat` as tall as it is wide, thinning in its second half. */
function ringOut(x: number, y: number, a: number, life: number, rx: number, c: string, flat = 0.6, a0 = 0, a1 = 1): void {
  if (a < 0 || a >= life) return;
  const u = a / life, rr = 1 + (rx - 1) * (1 - (1 - u) * (1 - u));
  arc(x, y, rr, rr * flat, c, u < 0.5 ? 1 : 2 - 2 * u, a0, a1);
}
/** A tapered tail behind p, which came from b: light, then body, then dark, then one dithered pixel. */
function tail(p: Pt, b: Pt, c1: string, c2: string, c3: string, n = 4): void {
  const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  for (let i = 1; i <= n; i++) px(p.x - dx / d * i, p.y - dy / d * i, i === 1 ? c1 : i < n - 1 ? c2 : c3, i === n ? 0.5 : 1);
}
/** Pluses that rise and fade round a whorl after a heal, in the healer's color. */
function mends(p: Pt, a: number, c: string, life = 16): void {
  for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa >= 0 && aa < life) glint(p.x - 5 + q * 5, p.y + 2 - aa * 0.6, c, fade(aa, life)); }
}
/** Small things circling over a whorl's head, as for a Stun: `draw` puts the q-th at x, y. */
function circling(p: Pt, a: number, n: number, draw: (x: number, y: number, q: number) => void, rx = 5): void {
  for (let q = 0; q < n; q++) { const t = a * 0.25 + q * Math.PI * 2 / n; draw(p.x + Math.cos(t) * rx, p.y - 7 + Math.sin(t) * 1.5, q); }
}
/** Streaks behind the user while it dashes at its target, in two of its colors. */
function smear(r: FxRun, c1: string, c2: string, len = 8): void {
  const U = userAt(r), E = aim(r), dx = E.x - r.from.x, dy = E.y - r.from.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const moved = Math.hypot(U.x - r.from.x, U.y - r.from.y);
  if (moved < 3) return;
  for (let q = -1; q <= 1; q++) {
    const ox = -uy * q * 2, oy = ux * q * 2, l = Math.min(len, moved) - Math.abs(q) * 2;
    line(U.x - ux * 4 + ox, U.y - uy * 4 + oy, U.x - ux * (4 + l) + ox, U.y - uy * (4 + l) + oy, q ? c2 : c1, 1);
  }
}

// ---------------------------------------------------------------- Deispes (peat): its bog, and marsh gas breaking out of it

const PEAT = { dark: '#231c1c', peat: '#473d3d', moss: '#9be262', gas: '#2fffa2' };
/** The bog at a whorl's feet: a dark pool w wide with a moss lip and gas specks breaking on it. */
function bog(x: number, foot: number, w: number, t: number, lv = 1): void {
  if (w < 1 || lv <= 0) return;
  const h = Math.max(1, w * 0.3);
  oval(x, foot, w, h, PEAT.dark, lv);
  arc(x, foot, w, h, PEAT.peat, lv, 0.5, 1);
  arc(x, foot, w + 1, h + 0.5, PEAT.moss, lv, 0.05, 0.45);
  for (let q = 0; q < Math.floor(w / 3); q++) { const k = (t + q * 5) % 10; if (k < 6) px(x - w + 2 + ((q * 7) % Math.max(1, 2 * w - 3)), foot - (k >> 1), k < 3 ? PEAT.gas : PEAT.moss, lv); }
}
/** A marsh-gas bubble: a mint ring with a white shine, five wide when big. */
function gasBubble(x: number, y: number, big: boolean, lv = 1): void {
  blit(big ? ['.ggg.', 'gw..g', 'g...g', '.ggg.'] : ['.g.', 'w.g', '.g.'], x, y, { g: PEAT.gas, w: W }, lv);
}
/** A gas bubble popping, a frames after: a white middle, then four dots flying apart. */
function gasPop(x: number, y: number, a: number): void {
  if (a < 0 || a >= 6) return;
  if (a < 2) px(x, y, W);
  const d = 2 + a;
  for (const [i, j] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(x + i * d, y + j * d * 0.8, a < 3 ? PEAT.gas : PEAT.moss);
}
/** A cut brick of peat with moss round it, as the spade lifts it. */
function peatBrick(x: number, y: number, lv = 1): void { blit(['.mmmm.', 'mppdpm', 'mdpppm', '.mmmm.'], x, y, { m: PEAT.moss, p: PEAT.peat, d: PEAT.dark }, lv); }

const PEAT_ART: Record<string, LegendArt> = {
  // Bog Pulse: bog opens under every foe, marsh gas bubbles up through them and bursts, and green rises round Deispes.
  peat_seep: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 4);
      bog(r.from.x, r.from.y + 5, 7, t, L);
      for (const E of r.to) bog(E.x, E.y + 5, Math.round(10 * ease(prog(t, 3, leaveOf(r) + 4))), t, L);
    },
    front(r) {
      inbound(r, (u, E, i) => gasBubble(E.x + (i - 1.5) * 4 + Math.round(Math.sin(u * 6 + i)), E.y + 5 - 9 * u, u > 0.45));
      landed(r, (E, a, i) => { const x = E.x + ((i % 4) - 1.5) * 4; gasPop(x, E.y - 4, a); ringOut(x, E.y - 4, a - 1, 8, 4, PEAT.moss); });
      mends(userAt(r), r.t - hitOf(r) - 2, PEAT.moss);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Marsh Gas: Deispes sinks into its bog, mint gas wells up round it into a veil, and a coil of gas settles at the foe's feet.
  peat_smoke: {
    noLandings: true,
    back(r) {
      bog(r.from.x, r.from.y + 5, 8, r.t, hold(r.t, 0, r.end, 4));
      const a = r.t - hitOf(r), F = across(r.from);
      if (a >= 2) { const L = fade(a, r.end - hitOf(r), 5), w = Math.min(8, a); arc(F.x, F.y + 5, w, 2, PEAT.gas, L, 0.05, 0.45); arc(F.x, F.y + 4, w - 2, 1.5, PEAT.moss, L, 0.55, 0.95); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), L = hold(t, 2, r.end, 5), g = prog(t, 0, hit);
      for (let q = 0; q < 3; q++) for (let k = 0; k < 4; k++) {
        const age = (t + k * 4 + q * 3) % 16, x = U.x + (q - 1) * 5 + Math.sin((t + k * 3 + q) / 3) * 1.5;
        oval(x, U.y + 4 - age * 0.8 * g, 1 + age / 8, 1, age < 8 ? PEAT.gas : PEAT.moss, L * (1 - age / 16) * 0.75);
      }
      if (t >= hit) oval(U.x, U.y, 6, 6, PEAT.gas, 0.25 * hold(t, hit, r.end, 4));
    },
  },

  // Sink Hole: the ground under the foe turns to bog and swirls down, gulps at it, and leaves it dripping with rot.
  peat_mire: {
    noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), foot = E.y + 5, L = hold(t, 0, r.end, 5), w = 3 + 8 * ease(prog(t, 2, hit));
      const gulp = t >= hit && t < hit + 4 ? 1 : 0;
      oval(E.x, foot, w + 1, w * 0.32 + 1, PEAT.peat, L);
      oval(E.x, foot, w, w * 0.3, PEAT.dark, L);
      for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + t * 0.3, rr = w * (0.35 + 0.5 * ((q + (t >> 2)) % 3) / 3); px(E.x + Math.cos(ang) * rr, foot + Math.sin(ang) * rr * 0.3, q % 2 ? PEAT.moss : PEAT.gas, L); }
      arc(E.x, foot - gulp, w + 1, w * 0.32 + 1, PEAT.moss, L, 0.05, 0.45);
    },
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      chunks(E.x, E.y + 4, still(a, 2), 6, PEAT.peat, PEAT.moss, r.seed, 14, 1.4, 1.3);
      for (let q = 0; q < 3; q++) { const aa = a - 3 - q * 3; if (aa < 0 || aa >= 14) continue; const x = E.x - 3 + q * 3, y = E.y - 3 + aa * 0.6; px(x, y, PEAT.moss, fade(aa, 14)); px(x, y + 1, PEAT.gas, fade(aa, 14)); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Peat Spade: a turf spade rises behind the foe, drives into the ground at its feet, and a cut brick of peat heaves up and breaks over it.
  peat_slane: {
    lead: 14, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), foot = E.y + 5, a = t - hit, L = hold(t, 0, r.end, 6);
      wash(PEAT.dark, 0.25 * L);
      bog(r.from.x, r.from.y + 5, 6, t, hold(t, 0, hit + 4, 3));
      if (a >= 0) { const n = Math.min(9, 2 + a * 2); dither(E.x - n, foot, 2 * n + 1, 2, PEAT.dark, L); line(E.x - n, foot - 1, E.x + n, foot - 1, PEAT.moss, L); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit, s = high(E) ? 1 : -1;
      const L = hold(t, 0, hit + 10, 3), up = ease(prog(t, 0, 12)), down = ease(prog(t, hit - 5, hit));
      // The spade: its blade tip comes up behind the foe through the build-up, then drives down at its feet.
      const tip = { x: E.x + s * (12 - 8 * down), y: E.y + 6 - 12 * up * (1 - down) };
      if (L > 0) {
        thick(tip.x + s, tip.y - 4, tip.x + s * 4, tip.y - 13, PEAT.moss, L, PEAT.peat);
        line(tip.x + s * 3, tip.y - 14, tip.x + s * 6, tip.y - 13, PEAT.moss, L);
        dither(tip.x - 1, tip.y - 4, 4, 5, '#b8bcc0', L);
        line(tip.x - 1, tip.y - 4, tip.x - 1, tip.y, W, L);
      }
      // The brick heaves up out of the cut, then breaks over the foe's head.
      if (a >= 0 && a < 8) peatBrick(E.x, E.y + 3 - 13 * Math.sin(Math.PI * a / 16));
      chunks(E.x, E.y - 8, a - 8, 8, PEAT.peat, PEAT.moss, r.seed, 16, 1.4, 0.4);
      sparks(E.x + s * 4, E.y + 5, still(a, 5), 7, PEAT.gas, PEAT.moss, r.seed, 9, 9);
      if (a >= 8) circling(E, a, 3, (x, y) => gasBubble(x, y, false, fade(a, r.end - hit, 5)));
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 2), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
    lights(r) { const E = aim(r); return [{ x: Math.round(E.x), y: Math.round(E.y + 4), r: 10, lv: 1.4 * fade(r.t - hitOf(r), 12), tint: PEAT.gas }]; },
  },
};

// ---------------------------------------------------------------- Kelpana (tenor): the bell, and its own outline ringing out from it

const TENOR = { dark: '#664c3c', bronze: '#d19940', cream: '#f1e5bd', deep: '#2e2018' };
const BELL_TOP = ['..dd..', '.bbbb.', '.bcbb.', '.bcbb.', 'bbbbbb'];
/** The bell at x, y, `s` times its size, its clapper swung by `sw` (-1, 0, or 1). */
function bell(x: number, y: number, s: number, lv = 1, sw = 0): void {
  blit([...BELL_TOP, sw < 0 ? '.cc...' : sw > 0 ? '...cc.' : '..cc..'], x, y, { d: TENOR.dark, b: TENOR.bronze, c: TENOR.cream }, lv, s);
}
/** A bell-shaped outline rx wide from x, y: an arch with its lip flared, the way the tenor's sound spreads. */
function bow(x: number, y: number, rx: number, c: string, lv = 1): void {
  arc(x, y, rx, rx * 0.7, c, lv, 0.5, 1);
  px(x - rx - 1, y + 1, c, lv); px(x + rx + 1, y + 1, c, lv);
}
/** A stroke of the bell at x, y, a frames after: three outlines in cream, bronze, and brown spreading `big` wide. */
function toll(x: number, y: number, a: number, big = 10, life = 16): void {
  for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa < 0 || aa >= life) continue; const u = aa / life; bow(x, y + 2, 2 + big * (1 - (1 - u) * (1 - u)), [TENOR.cream, TENOR.bronze, TENOR.dark][q], fade(aa, life, 6)); }
}

const TENOR_ART: Record<string, LegendArt> = {
  // Clapper: Kelpana hops on its clapper and throws a small bell that tolls on the foe, and a pale Bell Spirit stands up beside it.
  tenor_clapper: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u), b = lerp(r.from, E, Math.max(0, u - 0.18)); bow(b.x, b.y, 2, TENOR.bronze, 0.75); bell(p.x, p.y, 1, 1, ((t >> 1) & 1) * 2 - 1); });
      landed(r, (E, aa) => { toll(E.x, E.y - 1, still(aa, 2), 9); if (aa < 3) glint(E.x, E.y - 1, TENOR.cream); });
      if (a >= 0) bell(r.from.x + toward(r) * 10, r.from.y - 1, 1, 0.5 * fade(a, r.end - hit, 6));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Peal: two bell outlines fly at the foe and toll on it, and a small bell stays hanging by it, still swinging, for the stroke to come.
  tenor_peal: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), last = lastOf(r), a = t - last;
      inbound(r, (u, E2, i) => { const p = lerp(r.from, E2, ease(u)), b = lerp(r.from, E2, Math.max(0, ease(u) - 0.08)); bow(p.x, p.y, 3 + i, i ? TENOR.cream : TENOR.bronze); bow(b.x, b.y, 2, TENOR.dark, 0.5); });
      landed(r, (E2, aa, i) => toll(E2.x, E2.y - 1, still(aa, 2), 7 + i * 2, 14));
      if (a >= 0) { const sw = Math.round(Math.sin(a / 2.5) * 1.5), B = perch(E); bell(B.x + sw, B.y, 1, fade(a, r.end - last, 5), sw); }
    },
  },

  // Ring Out: Kelpana shakes and rings, and its outline keeps spreading from it in slow bronze bows.
  tenor_ringout: {
    tail: 8, noLandings: true,
    back(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 5), big = high(U) ? 11 : 15;
      for (let q = 0; q < 4; q++) { const u = ((t + q * 6) % 24) / 24; bow(U.x, U.y - 1, 3 + big * u, q % 2 ? TENOR.bronze : TENOR.cream, L * (1 - u)); }
    },
    front(r) { const a = r.t - hitOf(r), U = userAt(r); if (a >= 0 && a < 4) glint(U.x, U.y - 6, TENOR.cream); },
  },

  // Great Toll: a great bell swings over the foes, and each of its four strokes drops a bronze outline over them that shakes the field.
  tenor_greattoll: {
    lead: 12, noFlights: true, noLandings: true,
    back(r) { wash(TENOR.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, E = aim(r), B = perch(E), L = hold(t, 0, r.end, 6), last = lastOf(r), a = t - last;
      const sw = Math.round(Math.sin(t / 3) * Math.min(2, t / 8));
      bell(B.x + sw, B.y - 2, 2, L, Math.sign(sw));
      inbound(r, (u, E2) => { const p = lerp(B, E2, ease(u)); bow(p.x, p.y, 4 + 4 * u, TENOR.cream); bow(p.x, p.y + 2, 3 + 3 * u, TENOR.bronze, 0.75); });
      landed(r, (E2, aa, i) => toll(E2.x, E2.y - 1, still(aa, i === 0 || i === r.hits.length - 1 ? 5 : 1), 12, 18));
      if (a >= 0) for (const E2 of r.to) circling(E2, a, 3, (x, y) => blit(['.b.', 'bbb', '.c.'], x, y, { b: TENOR.bronze, c: TENOR.cream }, fade(a, r.end - last, 5)));
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 3) || shake(r.t - hitOf(r), 8, 2) }; },
    lights(r) { const B = perch(aim(r)); return [{ x: Math.round(B.x), y: Math.round(B.y), r: 12, lv: 1.2 * hold(r.t, 0, r.end, 6), tint: TENOR.bronze }]; },
  },
};

// ---------------------------------------------------------------- Madotra (glaze): leaded diamond panes of blue and red glass

const GLAZE = { blue: '#558be2', red: '#ae0e30', lead: '#cbb393', dark: '#1e2a52', pale: '#bcd4f4' };
/** A diamond pane `s` from its middle to its points, filled with c, leaded round, with a shine near its top. */
function pane(x: number, y: number, s: number, c: string, lv = 1): void {
  x = Math.round(x); y = Math.round(y);
  for (let j = -s; j <= s; j++) { const w = s - Math.abs(j); if (w > 0) dither(x - w + 1, y + j, 2 * w - 1, 1, c, lv); px(x - w, y + j, GLAZE.lead, lv); px(x + w, y + j, GLAZE.lead, lv); }
  if (s >= 2) px(x - 1, y - s + 2, W, lv);
}

const GLAZE_ART: Record<string, LegendArt> = {
  // Stained Light: a shaft of light through the window in blue, red, and gold bands that run along it, and panes of light fall over the foe.
  glaze_stain: {
    tail: 6, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), U = userAt(r), go = leaveOf(r), on = hold(t, go, hitOf(r) + 12, 2), C = [GLAZE.blue, GLAZE.red, GLAZE.lead];
      if (on > 0) {
        const dx = E.x - U.x, dy = E.y - U.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, reach = d * Math.min(1, (t - go + 1) / 3);
        for (let k = -1; k <= 1; k++) for (let i = 0; i <= reach; i++) px(U.x + dx / d * i + nx * k, U.y + dy / d * i + ny * k, k === 0 ? (((i + t) >> 1) % 4 === 0 ? W : GLAZE.pale) : C[((i >> 2) + (t >> 1) + k + 3) % 3], on);
      }
      landed(r, (E2, a) => { const s = still(a, 2); for (let q = 0; q < 4; q++) { const ang = q * Math.PI / 2 + 0.6; pane(E2.x + Math.cos(ang) * (3 + s * 0.4), E2.y + Math.sin(ang) * (2 + s * 0.3), 2, C[q % 3], fade(a, 16, 6)); } });
    },
  },

  // New Pane: three slivers of glass circle Madotra and set one by one into a new leaded pane in front of it.
  glaze_refract: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), P = { x: U.x + toward(r) * 8, y: U.y - 1 }, C = [GLAZE.blue, GLAZE.red, GLAZE.pale];
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const u = a / f.dur, ang = u * Math.PI * 4 + f.i * 2.1, rr = 9 * (1 - u * 0.7), c = lerp(U, P, u);
        blit(['.w', 'cc', 'c.'], c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr * 0.55, { w: W, c: C[f.i % 3] });
      }
      const set = r.hits.filter(h => t >= h.at).length, L = hold(t, hitOf(r), r.end, 4);
      if (set >= 1) pane(P.x, P.y, 3, set >= 2 ? GLAZE.blue : GLAZE.dark, L);
      if (set >= 3) { px(P.x, P.y, GLAZE.red, L); px(P.x + 1, P.y, GLAZE.red, L); }
      landed(r, (_, a) => { if (a < 6) glint(P.x + 2, P.y - 4, GLAZE.pale, fade(a, 6, 3)); });
    },
  },

  // Lead Line: lines of lead draw themselves across Madotra in a lattice, and the crossings flash gold.
  glaze_leading: {
    tail: 4, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), L = hold(t, 0, r.end, 4), n = Math.round(14 * prog(t, 0, hit)), a = t - hit;
      for (let q = -1; q <= 1; q++) {
        line(U.x - 7 + q * 4, U.y - 7, U.x - 7 + q * 4 + n, U.y - 7 + n, GLAZE.lead, L);
        line(U.x + 7 + q * 4, U.y - 7, U.x + 7 + q * 4 - n, U.y - 7 + n, GLAZE.lead, L);
      }
      for (let q = 0; q < 3; q++) glint(U.x + (q - 1) * 4, U.y + (q & 1 ? -2 : 2), GLAZE.lead, fade(a - q * 2, 12, 4));
    },
  },

  // Rose Window: a round window of panes builds behind the foe, then every pane breaks loose, flies into it, and shatters in a white flash.
  glaze_rosewindow: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), go = leaveOf(r), L = hold(t, 0, r.end, 6), C = [GLAZE.blue, GLAZE.red];
      wash(GLAZE.dark, 0.25 * L);
      arc(E.x, E.y, 10, 9, GLAZE.lead, L * hold(t, 0, go + 10, 3));
      const built = Math.min(8, Math.floor(t / 2));
      for (let q = 0; q < built; q++) { if (r.flights[q] && t >= r.flights[q].t0) continue; const ang = q / 8 * Math.PI * 2; pane(E.x + Math.cos(ang) * 7, E.y + Math.sin(ang) * 6, 2, C[q % 2], L); }
    },
    front(r) {
      const t = r.t, E = aim(r), C = [GLAZE.blue, GLAZE.red], last = lastOf(r), a = t - last;
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const u = ease(aa / f.dur), ang = f.i / 8 * Math.PI * 2; pane(E.x + Math.cos(ang) * 7 * (1 - u), E.y + Math.sin(ang) * 6 * (1 - u), u < 0.6 ? 2 : 1, C[f.i % 2]); }
      landed(r, (E2, aa, i) => { if (aa >= 12) return; for (let q = 0; q < 3; q++) { const ang = (i * 3 + q) * 0.83, d = 2 + aa * 0.9; px(E2.x + Math.cos(ang) * d, E2.y + Math.sin(ang) * d * 0.8 + 0.05 * aa * aa, q ? C[i % 2] : W, fade(aa, 12)); } });
      if (a >= 0) pane(E.x + 6, E.y + 5, 1, GLAZE.pale, fade(a, r.end - last, 5));
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 2), glare: a >= 0 && a < 3 ? 0.375 : 0 }; },
  },
};

// ---------------------------------------------------------------- Urkuda (pipe): sung notes and the standing wave out of its mouth

const PIPE = { pale: '#95d5b5', green: '#45a781', lime: '#59ff62', dark: '#163c2e' };
/** A sung note: a round lime head on a pale stem with a flag, `s` times size. */
function note(x: number, y: number, lv = 1, s = 1): void { blit(['..f', '.sf', '.s.', 'hs.', 'hh.'], x, y, { f: PIPE.pale, s: PIPE.pale, h: PIPE.lime }, lv, s); }
/** A standing wave of sound from a to b: a sine line `amp` high, pinned at a, that moves with `ph`. */
function sing(a: Pt, b: Pt, amp: number, ph: number, c: string, lv = 1, k = 0.45): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 0; i <= d; i++) { const o = Math.sin(i * k + ph) * amp * Math.min(1, i / 4); px(a.x + dx / d * i + nx * o, a.y + dy / d * i + ny * o, c, lv); }
}

const PIPE_ART: Record<string, LegendArt> = {
  // Low Drone: a slow, wide sound wave runs out of Urkuda's middle to every foe and shakes them in its rings, and notes float back to it.
  pipe_drone: {
    tail: 8, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), L = hold(t, 0, hit + 10, 4), a = t - hit - 4;
      for (const E of r.to) {
        const reach = lerp(U, E, ease(prog(t, 0, hit)));
        sing(U, reach, 3, -t * 0.3, PIPE.lime, L, 0.25);
        sing(U, reach, 3, -t * 0.3 + Math.PI, PIPE.green, L * 0.75, 0.25);
      }
      landed(r, (E, aa) => { for (let q = 0; q < 2; q++) ringOut(E.x, E.y, still(aa, 2) - q * 4, 14, 8, q ? PIPE.green : PIPE.pale, 0.7); });
      for (let q = 0; q < 3; q++) { const u = prog(a - q * 3, 0, 16); if (u > 0 && u < 1) { const p = sagAt(aim(r), U, ease(u), -4); note(p.x, p.y, fade(a - q * 3, 16)); } }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Stopped Note: Urkuda jerks back and lets out one sharp burst of sound, and a green stopper seals the foe with its note crossed out.
  pipe_stopped: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), E = aim(r), on = hold(t, 1, hit + 2, 2);
      if (on > 0) sing(U, lerp(U, E, ease(prog(t, 1, hit))), 2, t * 1.2, PIPE.pale, on, 0.9);
      landed(r, (E2, a) => {
        const s = still(a, 2), L = fade(a, 20, 6), y = E2.y - 7 + Math.min(0, s - 3), B = perch(E2);
        ringOut(E2.x, E2.y, s, 10, 7, PIPE.lime, 0.7);
        dither(E2.x - 2, y + 1, 5, 2, PIPE.green, L); line(E2.x - 2, y, E2.x + 2, y, PIPE.pale, L);
        note(B.x, B.y, L); line(B.x - 3, B.y + 3, B.x + 3, B.y - 3, W, L);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Draw Air: Urkuda sinks and draws breath, and streams of air run off the foe into its middle as the foe's rings close in.
  pipe_bellows: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), L = hold(t, 2, r.end, 5);
      for (let s = -1; s <= 1; s++) for (let q = 0; q < 4; q++) {
        const u = ((t * 0.04 + q / 4 + s * 0.1) % 1 + 1) % 1, p = sagAt(E, U, u, s * 4), b = sagAt(E, U, Math.max(0, u - 0.05), s * 4);
        line(b.x, b.y, p.x, p.y, q % 2 ? PIPE.pale : PIPE.lime, L * Math.min(1, u / 0.15));
      }
      for (let q = 0; q < 2; q++) { const k = (t + q * 6) % 12; arc(E.x, E.y, 9 - k * 0.6, (9 - k * 0.6) * 0.7, q ? PIPE.green : PIPE.pale, L * (k / 12)); }
      landed(r, (E2, a) => { if (a < 3) glint(E2.x, E2.y, PIPE.lime); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Full Organ: a rank of pipes rises behind Urkuda and sounds in turn, and two Held Notes step out to stand beside it.
  pipe_fullorgan: {
    lead: 16, tail: 4, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), top = high(U) ? 11 : 16, foot = U.y + 5;
      wash(PIPE.dark, 0.25 * L);
      for (let q = 0; q < 5; q++) {
        const x = U.x - 8 + q * 4, h = Math.round(top * (0.55 + 0.45 * Math.sin((q + 0.5) / 5 * Math.PI)) * ease(prog(t, q * 2, q * 2 + 10)));
        if (h <= 0) continue;
        dither(x - 1, foot - h, 3, h, PIPE.green, L); line(x - 1, foot - h, x - 1, foot - 1, PIPE.pale, L);
        dither(x - 1, foot - h + 3, 3, 1, PIPE.dark, L);
        const k = (t - 14 - q * 3) % 15;
        if (t > 14 && k >= 0 && k < 10) arc(x, foot - h + 3, 2 + k * 0.6, 1 + k * 0.4, PIPE.lime, L * (1 - k / 10));
      }
    },
    front(r) {
      const hit = hitOf(r), a = r.t - hit, U = userAt(r), dir = toward(r);
      if (a < 0) return;
      for (let q = 0; q < 2; q++) { const u = ease(prog(a - q * 3, 0, 8)); note(U.x + dir * (4 + (q + 1) * 6 * u), U.y - 2 - Math.sin(Math.PI * u) * 4, fade(a - q * 3, r.end - hit - q * 3, 6)); }
      if (a < 4) glint(U.x, U.y - 6, PIPE.lime);
    },
    lights(r) { return [{ x: r.from.x, y: r.from.y - 8, r: 12, lv: 1.2 * hold(r.t, 10, r.end, 6), tint: PIPE.lime }]; },
  },
};

// ---------------------------------------------------------------- Nanum (pew): the pew's boards and the green ribbon of a saved seat

const PEW = { wood: '#6e4a3a', green: '#2bd200', cream: '#ecdcc8', dark: '#2e1e16' };
/** A board from x0 to x1 at y: a cream top edge over two rows of wood. */
function board(x0: number, x1: number, y: number, lv = 1): void { line(x0, y, x1, y, PEW.cream, lv); dither(Math.min(x0, x1), y + 1, Math.abs(x1 - x0) + 1, 2, PEW.wood, lv); }
/** A pew standing on `foot`, w each side of x and h tall: two end posts, a back board, and a seat. */
function pewAt(x: number, foot: number, w: number, h: number, lv = 1): void {
  for (const sx of [x - w, x + w]) { dither(sx, foot - h, 1, h + 1, PEW.wood, lv); px(sx, foot - h - 1, PEW.cream, lv); }
  board(x - w, x + w, foot - h, lv); board(x - w, x + w, foot - 4, lv);
}

const PEW_ART: Record<string, LegendArt> = {
  // Slide Along: Nanum slides along the floor on its legs leaving board-colored streaks, and splinters burst off the foe.
  pew_slidealong: {
    tail: 8, noLandings: true,
    front(r) {
      smear(r, PEW.cream, PEW.wood, 12);
      landed(r, (E, a) => { const s = still(a, 2); chunks(E.x, E.y, s, 7, PEW.wood, PEW.cream, r.seed, 14, 1.4, 1.2); sparks(E.x, E.y, s, 6, PEW.cream, PEW.wood, r.seed, 7, 7); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Open Hymnbook: a green hymnbook drops beside Nanum and falls open, its pages turning.
  pew_hardseat: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), B = { x: r.from.x + toward(r) * 10, y: r.from.y + 2 }, a = t - hit, L = hold(t, 2, r.end, 5);
      if (a < 0) { blit(['ggggg', 'gcccg', 'ggggg'], B.x, B.y - 12 * (1 - ease(prog(t, 2, hit))), { g: PEW.green, c: PEW.cream }, L); return; }
      blit(['g.....g', 'gccwccg', 'gcc.ccg', 'ggggggg'], B.x, B.y, { g: PEW.green, c: PEW.cream, w: PEW.wood }, L);
      const k = (a >> 2) % 3; if (a < 16) line(B.x, B.y - 1, B.x + (k - 1) * 3, B.y - 3 - (k === 1 ? 1 : 0), W, L);
      puff(B.x, B.y + 2, a, 10, PEW.cream, PEW.wood, 3, 0.1);
    },
  },

  // Box Pew: Nanum stomps, and the boards of a box pew slam down round the foe with a green ribbon on its door, its Seat.
  pew_boxpew: {
    noLandings: true,
    back(r) { landed(r, (E, a) => board(E.x - 8, E.x + 8, E.y - 5, fade(a, 20, 6))); },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit, drop = ease(prog(t, hit - 5, hit));
      const L = a < 0 ? hold(t, hit - 5, hit + 1, 2) : fade(a, 20, 6), y = E.y + 5 - 14 * (1 - drop);
      if (L <= 0) return;
      for (const sx of [E.x - 8, E.x + 8]) { dither(sx, y - 10, 1, 11, PEW.wood, L); px(sx, y - 11, PEW.cream, L); }
      board(E.x - 8, E.x + 8, y - 3, L);
      if (a >= 2) { px(E.x + 3, y - 2, PEW.green, L); px(E.x + 3, y - 1, PEW.green, L); px(E.x + 4, y, PEW.green, L); px(E.x + 2, y, PEW.green, L); }
      chunks(E.x, E.y + 5, a, 5, PEW.wood, PEW.cream, r.seed, 10, 1.6, 1);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // All Kneel: the light dims, a pew rises behind each whorl on the field, and green kneelers come down under both at the stroke.
  pew_respite: {
    lead: 14, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 6), up = ease(prog(t, 0, hit - 2));
      wash(PEW.dark, 0.25 * L);
      for (const P of [r.from, across(r.from)]) pewAt(P.x, P.y + 5, 9, Math.round(13 * up), L);
    },
    front(r) {
      const hit = hitOf(r), a = r.t - hit;
      if (a < 0) return;
      for (const P of [r.from, across(r.from)]) {
        const L = fade(a, r.end - hit, 6), y = P.y + 5 - Math.max(0, 3 - a);
        dither(P.x - 5, y, 11, 2, PEW.green, L); line(P.x - 5, y, P.x + 5, y, PEW.cream, L);
        puff(P.x - 6, P.y + 5, a, 10, PEW.cream, PEW.wood, 2, 0.1); puff(P.x + 6, P.y + 5, a, 10, PEW.cream, PEW.wood, 2, 0.1);
        if (a < 10) glint(P.x, P.y - 8, PEW.cream, fade(a, 10));
      }
    },
  },
};

// ---------------------------------------------------------------- Arcapas (relic): the gilt reliquary with its glass front

const RELIC = { bronze: '#816242', gold: '#e6b63c', glass: '#d1e9f1', dark: '#2e2216' };
/** The reliquary w by h each side of x, y: a gold frame round a glass front at `glass` cover, its lid lifted `lid` pixels. */
function casket(x: number, y: number, w: number, h: number, lid: number, lv = 1, glass = 0.5): void {
  x = Math.round(x); y = Math.round(y); lid = Math.round(lid);
  if (glass > 0) dither(x - w + 1, y - h + 1, 2 * w - 1, 2 * h - 1, RELIC.glass, glass * lv);
  line(x - w, y + h, x + w, y + h, RELIC.gold, lv);
  line(x - w, y - h + 1, x - w, y + h, RELIC.gold, lv); line(x + w, y - h + 1, x + w, y + h, RELIC.gold, lv);
  line(x - w, y - h - lid, x + w, y - h - lid, RELIC.bronze, lv);
  arc(x, y - h - lid, w, 2, RELIC.gold, lv, 0.5, 1);
  px(x, y - h - lid - 3, W, lv); px(x - w + 1, y - h + 2, W, lv);
}

const RELIC_ART: Record<string, LegendArt> = {
  // Gilt Edge: a flake of gold leaf turns as it flies, cuts the foe with a gilt line, and its flakes drift down glinting.
  relic_giltedge: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => {
        const p = lerp(r.from, E, u), b = lerp(r.from, E, Math.max(0, u - 0.1));
        tail(p, b, RELIC.gold, RELIC.bronze, RELIC.dark, 5);
        if ((t >> 1) & 1) blit(['gg', 'gw'], p.x, p.y, { g: RELIC.gold, w: W }); else line(p.x - 1, p.y + 1, p.x + 1, p.y - 1, W);
      });
      landed(r, (E, a) => {
        const n = Math.min(1, (still(a, 2) + 1) / 3);
        if (a < 10) thick(E.x - 6, E.y + 5, E.x - 6 + 12 * n, E.y + 5 - 10 * n, RELIC.gold, fade(a, 10, 4), W);
        for (let q = 0; q < 4; q++) {
          const aa = a - 2 - q * 2; if (aa < 0 || aa >= 16) continue;
          const x = E.x - 5 + q * 3 + Math.round(Math.sin(aa / 2 + q) * 1.5), y = E.y - 4 + aa * 0.5;
          px(x, y, (aa >> 1) & 1 ? W : RELIC.gold, fade(aa, 16)); px(x + 1, y, RELIC.gold, fade(aa, 16));
        }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Lid Shut: the reliquary's gold lid lobs over and slams down on the foe, and a glass case closes round it.
  relic_pall: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a) => { if (a < 14) { const n = Math.min(8, a * 2); line(E.x - n, E.y + 6, E.x + n, E.y + 6, RELIC.gold, fade(a, 14)); } }); },
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); arc(p.x, p.y + 1, 4, 2, RELIC.gold, 1, 0.5, 1); line(p.x - 4, p.y + 1, p.x + 4, p.y + 1, RELIC.bronze); px(p.x, p.y - 2, W); });
      landed(r, (E, a) => {
        const s = still(a, 3), L = fade(a, 20, 6);
        casket(E.x, E.y, 6, 5, Math.max(0, 3 - s), L, 0.375);
        if (a < 3) line(E.x - 7, E.y - 7, E.x + 7, E.y - 7, W);
        if (a >= 4) circling(E, a, 2, (x, y) => glint(x, y - 3, RELIC.gold, L));
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Glass Dust: pale glass dust swirls round Arcapas and settles over it as a dome of glass, and its gold frame glints.
  relic_keepsake: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), a = t - hit;
      for (let q = 0; q < 10; q++) { const ang = q / 10 * Math.PI * 2 + t * 0.2, rr = 10 - 4 * ease(prog(t, 0, hit)); if (a < 4) px(U.x + Math.cos(ang) * rr, U.y + Math.sin(ang) * rr * 0.6, q % 3 ? RELIC.glass : W, a < 0 ? 1 : 1 - a / 4); }
      if (a < 0) return;
      const L = fade(a, r.end - hit, 6);
      dither(U.x - 6, U.y - 5, 13, 10, RELIC.glass, 0.125 * L);
      arc(U.x, U.y + 1, 7, 7, RELIC.glass, L, 0.5, 1); line(U.x - 7, U.y + 5, U.x + 7, U.y + 5, RELIC.gold, L); px(U.x - 4, U.y - 4, W, L);
      if (a < 8) glint(U.x + 6, U.y + 4, RELIC.gold, fade(a, 8));
    },
  },

  // Into the Case: a great reliquary stands open behind the foe, its four gold fittings close in, and its glass door shuts over the foe in the dark.
  relic_heartbreak: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const L = hold(r.t, 0, r.end, 6), E = aim(r); wash(RELIC.dark, 0.375 * L); casket(E.x, E.y, 9, 8, 0, L, 0); },
    front(r) {
      const t = r.t, E = aim(r), last = lastOf(r), a = t - last, C = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const f of r.flights) {
        const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue;
        const u = ease(aa / f.dur), [cx, cy] = C[f.i % 4];
        blit(['ggg', 'gw.', 'g..'], E.x + cx * (16 - 7 * u), E.y + cy * (12 - 4 * u), { g: RELIC.gold, w: W }, 1, 1, cx > 0, cy > 0);
      }
      landed(r, (E2, aa, i) => { const [cx, cy] = C[i % 4]; blit(['ggg', 'gw.', 'g..'], E2.x + cx * 8, E2.y + cy * 7, { g: RELIC.gold, w: W }, fade(aa, r.end - r.hits[i].at, 6), 1, cx > 0, cy > 0); });
      if (a >= -4) {
        const shut = ease(prog(a, -4, 2)), L = fade(a, r.end - last, 6), x = Math.round(E.x - 8 + 16 * shut);
        dither(E.x - 8, E.y - 7, x - E.x + 9, 15, RELIC.glass, 0.375 * L); line(x, E.y - 7, x, E.y + 8, RELIC.gold, L);
      }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 2) || shake(r.t - hitOf(r), 6, 1) }; },
    lights(r) { const E = aim(r); return [{ x: Math.round(E.x), y: Math.round(E.y), r: 12, lv: 1.2 * hold(r.t, 0, r.end, 6), tint: RELIC.gold }]; },
  },
};

// ---------------------------------------------------------------- Fumusri (censer): the chain it swings on and the coils of its incense

const CENSER = { brass: '#c69e4e', violet: '#8857c3', smoke: '#473d56', pale: '#b89ee0', dark: '#221c2c' };
/** A lit coal of the censer: brass round a white heart. */
function coal(x: number, y: number, lv = 1): void { blit(['.b.', 'bwb', '.b.'], x, y, { b: CENSER.brass, w: W }, lv); }
/** The chain from a to b, sagging `sag` pixels: links of brass and dark. */
function chain(a: Pt, b: Pt, lv = 1, sag = 0): void {
  const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= n; i++) { const p = sagAt(a, b, i / n, sag); px(p.x, p.y, i & 1 ? CENSER.smoke : CENSER.brass, lv); }
}
/** A curl of incense a frames old: three lobes of gray, violet, and pale that rise, lean, and thin out. */
function curl(x: number, y: number, a: number, life: number, size = 2): void {
  if (a < 0 || a >= life) return;
  const u = a / life, lv = 1 - u * 0.75;
  for (let q = 0; q < 3; q++) oval(x + Math.sin(a / 4 + q * 2) * (1 + q), y - a * 0.4 - q * size * 0.9, Math.max(0.5, size * (0.7 + u) - q * 0.3), size * 0.6, [CENSER.smoke, CENSER.violet, CENSER.pale][q], lv * (q === 2 ? 0.5 : 1));
}
/** The chain Fumusri hangs from, running up out of sight from its top as it swings. */
function hanger(r: FxRun, lv = 1): void { const U = userAt(r); chain({ x: U.x - (U.x - r.from.x) * 2, y: U.y - 16 }, { x: U.x, y: U.y - 4 }, lv); }

const CENSER_ART: Record<string, LegendArt> = {
  // Soot Bind: Fumusri swings out two coals on trails of smoke, and each time soot coils round the foe and ties it to the ground.
  censer_binding: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      hanger(r, hold(t, 0, r.end, 4));
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], v = a < f.dur / 2 ? ease(a / (f.dur / 2)) : 1 - ease((a - f.dur / 2) / (f.dur / 2)), p = sagAt(U, E, v, -4);
        for (let k = 1; k < 5; k++) { const b = sagAt(U, E, Math.max(0, v - k * 0.05 * (a < f.dur / 2 ? 1 : -1)), -4); px(b.x, b.y - 1, k < 3 ? CENSER.pale : CENSER.smoke, k < 4 ? 1 : 0.5); }
        coal(p.x, p.y);
      }
      landed(r, (E, a, i) => {
        const L = fade(a, 22, 6);
        for (let q = 0; q < 2; q++) arc(E.x, E.y + 1 + q * 3 - i, 6 - q, 2, q ? CENSER.violet : CENSER.pale, L);
        for (const s of [-1, 1]) line(E.x + s * 5, E.y + 3, E.x + s * 6, E.y + 6, CENSER.pale, L);
        curl(E.x + (i ? 3 : -3), E.y - 2, a, 16, 2);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Smoke Screen: smoke pours up out of the censer and settles over its side as a dome of incense, lines of it running down.
  censer_sootshield: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), A = r.to[0], a = t - hit;
      hanger(r, hold(t, 0, r.end, 4));
      if (a < 4) for (let q = 0; q < 3; q++) curl(U.x - 2 + q * 2, U.y - 3, (t + q * 4) % 12, 12, 1.5);
      if (a < 0) return;
      const L = fade(a, r.end - hit, 6), g = ease(prog(a, 0, 6));
      dither(A.x - 7, A.y - 5, 15, 10, CENSER.violet, 0.125 * L);
      for (let q = 0; q < 2; q++) arc(A.x, A.y + 4, (9 - q * 2) * g, (10 - q * 2) * g, q ? CENSER.violet : CENSER.pale, L, 0.5, 1);
      for (let q = 0; q < 4; q++) { const k = (a + q * 3) % 12; px(A.x - 7 + q * 4.5, A.y - 5 + k, CENSER.pale, L * (1 - k / 12)); }
    },
  },

  // Ash Pool: three coals drop on the foe trailing smoke, and gray ash spreads at its feet with the coals glowing in it.
  censer_ashpool: {
    noFlights: true, noLandings: true,
    back(r) {
      const E = aim(r), hit = hitOf(r), a = r.t - hit;
      if (a < 0) return;
      const w = Math.min(11, 4 + a), L = fade(a, r.end - hit, 6);
      oval(E.x, E.y + 5, w, w * 0.3, CENSER.smoke, L); arc(E.x, E.y + 5, w, w * 0.3, CENSER.pale, 0.5 * L, 0.05, 0.45);
      r.hits.forEach((h, q) => { if (r.t >= h.at) px(E.x - 5 + q * 5, E.y + 5, ((r.t + q * 3) >> 2) & 1 ? CENSER.brass : W, L); });
    },
    front(r) {
      hanger(r, hold(r.t, 0, r.end, 4));
      inbound(r, (u, E, i) => { const x0 = E.x + (i - 1) * 7, p = { x: x0 + (E.x + (i - 1) * 2 - x0) * u, y: E.y - 22 + 22 * u }; coal(p.x, p.y); for (let k = 1; k < 5; k++) px(p.x + Math.sin((r.t + k) / 2) * 0.6, p.y - 1 - k, k < 3 ? CENSER.pale : CENSER.smoke, k < 4 ? 1 : 0.5); });
      landed(r, (E, a, i) => { sparks(E.x + (i - 1) * 2, E.y + 2, a, 5, CENSER.brass, CENSER.pale, r.seed + i, 5, 7); curl(E.x + (i - 1) * 4, E.y + 1, a, 18, 2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Smoke Closes: Fumusri swings wide on its chain, four coals circle it and fly, and rings of smoke close round the foe like a chain pulled tight.
  censer_smokechain: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(CENSER.dark, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), last = lastOf(r), a = t - last;
      hanger(r, hold(t, 0, r.end, 4));
      for (let q = 0; q < 3; q++) curl(U.x + (q - 1) * 4, U.y - 2, (t + q * 5) % 15, 15, 1.5);
      for (const f of r.flights) {
        const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue;
        const u = aa / f.dur, a0 = f.i / f.n * Math.PI * 2;
        const p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 4 + a0) * 9, y: U.y + Math.sin(u / 0.6 * Math.PI * 4 + a0) * 5 } : lerp({ x: U.x + Math.cos(a0) * 9, y: U.y + Math.sin(a0) * 5 }, E, (u - 0.6) / 0.4);
        coal(p.x, p.y);
      }
      // The rings close in on the foe one per coal and stay drawn tight.
      landed(r, (E2, aa, i) => { const rr = Math.max(4 + i, 12 - aa * 1.5), L = a >= 0 ? fade(a, r.end - last, 6) : 1; for (const k of [0, 1]) chain({ x: E2.x - rr, y: E2.y - 2 + i * 2 + k }, { x: E2.x + rr, y: E2.y - 2 + i * 2 + k }, L, k ? -2 : 2); });
      if (a >= 0) { curl(E.x - 5, E.y, a, 20, 2.5); curl(E.x + 5, E.y + 1, a - 3, 20, 2.5); }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 2) || shake(r.t - hitOf(r), 6, 1) }; },
  },
};

// ---------------------------------------------------------------- Polro (strix): the eyes painted on its wings

const STRIX = { cream: '#e9ddc5', amber: '#d7a02b', brown: '#665444', dark: '#1e1812' };
/** One of the eyes painted on its wings: an amber ring round a dark pupil, `open` from 0 shut to 1 wide, `look` moving the pupil. */
function owlEye(x: number, y: number, s: number, open: number, lv = 1, look = 0): void {
  if (lv <= 0) return;
  const mid = look < 0 ? 'appcca' : look > 0 ? 'accppa' : 'acppca';
  const rows = open > 0.66 ? ['.aaaa.', mid, '.aaaa.'] : open > 0.33 ? ['......', mid.replace(/c/g, 'a'), '.aaaa.'] : ['......', 'aaaaaa', '......'];
  blit(rows, x, y, { a: STRIX.amber, c: STRIX.cream, p: STRIX.dark }, lv, s);
}
/** A feather that flutters down: a cream quill with a brown tip. */
function quill(x: number, y: number, a: number, lv = 1): void { const s = (a >> 2) & 1 ? 1 : -1; px(x, y, STRIX.cream, lv); px(x + s, y + 1, STRIX.cream, lv); px(x + 2 * s, y + 1, STRIX.brown, lv); }

const STRIX_ART: Record<string, LegendArt> = {
  // Swoop: Polro comes down on the foe without a sound, a pale wedge of wing behind it, and three talon rakes cross the foe.
  strix_swoop: {
    tail: 4, noLandings: true,
    front(r) {
      smear(r, STRIX.cream, STRIX.brown, 10);
      landed(r, (E, a) => {
        const s = still(a, 2), L = fade(a, 12, 4);
        for (let q = 0; q < 3; q++) {
          const aa = s - q; if (aa < 0 || L <= 0) continue;
          const n = Math.round(10 * Math.min(1, (aa + 1) / 3)), x0 = E.x - 5 + q * 4, y0 = E.y - 6;
          for (let i = 0; i <= n; i++) px(x0 + i * 0.3 + Math.sin(i / 3), y0 + i, i < 3 ? W : STRIX.cream, L);
          px(x0 + 1, y0 + n, STRIX.amber, L);
        }
        for (let q = 0; q < 2; q++) { const aa = a - 4 - q * 3; if (aa >= 0 && aa < 16) quill(E.x + (q ? 5 : -6) + Math.sin(aa / 3) * 2, E.y - 2 + aa * 0.5, aa, fade(aa, 16)); }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Owl Stare: the field darkens, two painted eyes open over the foe and stare, amber rings close on it, and its voice is sealed.
  strix_dreadcall: {
    noFlights: true, noLandings: true,
    back(r) { wash(STRIX.dark, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, E = aim(r), B = wideSpot(E), L = hold(t, 0, r.end, 5), open = prog(t, 0, 6) * (1 - prog(t, r.end - 6, r.end));
      const look = E.x < B.x ? -1 : 1;
      owlEye(B.x - 7, B.y, 2, open, L, look); owlEye(B.x + 7, B.y, 2, open, L, look);
      inbound(r, (u, E2, i) => { const rr = 11 - 8 * ease(u); arc(E2.x, E2.y, rr, rr * 0.7, i ? STRIX.cream : STRIX.amber, 1); });
      landed(r, (E2, a, i) => { const s = still(a, 2), lv = fade(a, r.end - r.hits[i].at, 6); arc(E2.x, E2.y, 3 + i, 2 + i, STRIX.amber, lv); if (s < 6) ringOut(E2.x, E2.y, s, 8, 6, STRIX.cream, 0.7); });
      const a = t - lastOf(r);
      if (a >= 0) { const lv = fade(a, r.end - lastOf(r), 6); line(E.x - 2, E.y - 4, E.x + 2, E.y, STRIX.cream, lv); line(E.x + 2, E.y - 4, E.x - 2, E.y, STRIX.cream, lv); }
    },
  },

  // Wing Mantle: three feathers circle Polro, and its wings fold round it one beat at a time with the painted eyes on them opening.
  strix_mantle: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const ang = a / f.dur * Math.PI * 3 + f.i * 2.1, rr = 11 - 5 * (a / f.dur);
        quill(U.x + Math.cos(ang) * rr, U.y + Math.sin(ang) * rr * 0.5, a);
      }
      const n = r.hits.filter(h => t >= h.at).length;
      if (!n) return;
      const L = hold(t, hitOf(r), r.end, 4), close = n / 3;
      for (const s of [-1, 1]) {
        const x = U.x + s * (8 - 2 * close);
        arc(x, U.y, 3, 6, STRIX.cream, L, s > 0 ? 0.75 : 0.25, s > 0 ? 1.25 : 0.75);
        arc(x - s, U.y, 3, 6, STRIX.brown, L, s > 0 ? 0.8 : 0.3, s > 0 ? 1.2 : 0.7);
        owlEye(x + s, U.y, 1, close, L);
      }
    },
  },

  // Moonless: night comes down over the field, a dark moon rises by Polro, and painted eyes open one pair at a time all round in the dark.
  strix_longnight: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), L = hold(t, 0, r.end, 8), M = beside(r.from), y = M.y + 6 - 6 * ease(prog(t, 0, hit));
      wash(STRIX.dark, 0.5 * L);
      oval(M.x, y, 5, 5, STRIX.dark, L); arc(M.x, y, 5, 5, STRIX.amber, L, 0.6, 1.15); arc(M.x, y, 6, 6, STRIX.brown, 0.5 * L, 0.65, 1.1);
    },
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit, L = hold(t, 0, r.end, 8), U = userAt(r);
      const SPOTS = [[6, 30], [34, 31], [58, 31], [89, 29], [9, 56], [36, 56]];
      SPOTS.forEach(([x, y], q) => { const open = prog(t, 4 + q * 4, 8 + q * 4) * (1 - prog(t, r.end - 8, r.end)); const look = a >= 0 ? (U.x < x ? -1 : 1) : 0; owlEye(x - 4, y, 1, open, L, look); owlEye(x + 4, y, 1, open, L, look); });
      if (a >= 0) { const lv = fade(a, r.end - hit, 6); for (let q = 0; q < 3; q++) line(U.x - toward(r) * 6, U.y - 2 + q * 2, U.x - toward(r) * (9 + q * 2), U.y - 2 + q * 2, STRIX.cream, lv); if (a < 6) glint(U.x, U.y - 6, STRIX.amber); }
    },
  },
};

// ---------------------------------------------------------------- Shivus (hart): its antlers, and the red Grit it stores up

const HART = { red: '#a54929', bone: '#e8d4b8', tan: '#b29a7a', dark: '#3a1c10' };
const RACK = ['c.c...c.c', '.cc...cc.', '..c...c..', '...c.c...'];
/** A pair of antlers centered on x, y at `s` times size, upside down when `flip`. */
function antlers(x: number, y: number, s: number, lv = 1, flip = false): void { blit(RACK, x, y, { c: HART.bone }, lv, s, false, flip); }
/** A tine's cut from x0, y0 sweeping w across and h down, `n` of the way: cream with a red edge under it. */
function tine(x0: number, y0: number, w: number, h: number, n: number, lv = 1): void {
  const d = Math.max(Math.abs(w), Math.abs(h), 1), m = Math.round(d * n);
  for (let i = 0; i <= m; i++) { const u = i / d, x = x0 + w * u, y = y0 + h * u - Math.sin(Math.PI * u) * 2; px(x, y, i < 2 ? W : HART.bone, lv); px(x, y + 1, HART.red, lv); }
}

const HART_ART: Record<string, LegendArt> = {
  // Antler Jab: Shivus drives in antlers first, two tines rake up across the foe, and chips of bone fly.
  hart_antlers: {
    tail: 8, noLandings: true,
    front(r) {
      const U = userAt(r);
      smear(r, HART.bone, HART.red, 9);
      if (r.t < hitOf(r) + 3) antlers(U.x, U.y - 6, 1);
      landed(r, (E, a) => { const s = still(a, 2), L = fade(a, 14, 5), n = Math.min(1, (s + 1) / 3); for (let q = 0; q < 2; q++) tine(E.x - 6 + q * 3, E.y + 4 - q * 2, 12, -9, n, L); chunks(E.x + 2, E.y - 2, s, 4, HART.bone, HART.tan, r.seed, 12, 1.2, 1.2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Lock Antlers: Shivus locks antlers with the foe, its rack and a mirrored one grinding together over the foe's head, and the ground cracks.
  hart_lockantlers: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { if (a >= 18) return; const n = Math.min(9, a * 2), L = fade(a, 18); line(E.x - n, E.y + 5, E.x + n, E.y + 5, HART.tan, L); line(E.x - n + 2, E.y + 6, E.x + n - 2, E.y + 6, HART.red, L); }); },
    front(r) {
      smear(r, HART.bone, HART.red, 9);
      landed(r, (E, a) => { const s = still(a, 3), L = fade(a, 18, 5), g = (s >> 1) & 1; antlers(E.x - 3 + g, E.y - 9, 1, L); antlers(E.x + 3 - g, E.y - 6, 1, L, true); sparks(E.x, E.y - 7, s, 6, HART.bone, HART.tan, r.seed, 6, 8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 1) }; },
  },

  // All At Once: red marks of all Shivus stored close in on it as it swells, and it spends them in one wide antler swing that bursts red and cream.
  hart_haymaker: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), a = t - hit;
      if (a < 0) for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + t * 0.15, rr = 12 - 8 * ease(prog(t, 0, 12)), x = U.x + Math.cos(ang) * rr, y = U.y + Math.sin(ang) * rr * 0.7; line(x, y - 1, x, y + 1, HART.red, 1); px(x, y - 2, HART.bone, 1); }
      smear(r, HART.red, HART.tan, 10);
      landed(r, (E, aa) => {
        const s = still(aa, 3), L = fade(aa, 16, 5), n = Math.min(1, (s + 1) / 4);
        arc(E.x, E.y, 9, 7, HART.bone, L, 0.6, 0.6 + 0.5 * n); arc(E.x, E.y, 8, 6, HART.red, L, 0.6, 0.6 + 0.5 * n);
        sparks(E.x, E.y, s, 9, HART.bone, HART.red, r.seed, 11, 10);
      });
      if (a >= 4) arc(U.x, U.y + 1, 7, 6, HART.tan, fade(a - 4, r.end - hit - 4, 5), 0.5, 1);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 2) }; },
  },

  // Stag Leap: Shivus crouches, leaps over the foe with a cream arc behind it, and drives its antlers down on it, the blow carrying on to the reserve behind.
  hart_stagleap: {
    lead: 8, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit;
      wash(HART.dark, 0.25 * hold(t, 0, r.end, 6));
      if (a >= 0 && a < 16) { const h = Math.round(3 * Math.sin(Math.PI * a / 16)); for (let q = 0; q < 8; q++) px(E.x - 12 + q * 3.5, E.y + 5 - (q % 2 ? h : 0), q % 2 ? HART.tan : HART.bone, fade(a, 16)); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), E = aim(r), a = t - hit, dir = E.x >= r.from.x ? 1 : -1;
      if (t < 8) for (let q = 0; q < 3; q++) px(U.x - 3 + q * 3, U.y + 5, (t + q) & 2 ? HART.red : HART.bone);
      const go = prog(t, 8, hit);
      if (go > 0 && a < 6) for (let i = 0; i < 16; i++) { const p = lobAt(r.from, E, go * i / 15, 1.6); px(p.x, p.y - 2, i > 12 ? W : HART.bone, (a < 0 ? 1 : 1 - a / 6) * (0.4 + 0.6 * i / 15)); }
      landed(r, (E2, aa) => {
        const s = still(aa, 6), L = fade(aa, 20, 6), R = { x: E2.x + dir * 13, y: E2.y + 2 };
        antlers(E2.x, E2.y - 6 + Math.min(4, s * 2), 2, L);
        sparks(E2.x, E2.y, s, 10, HART.bone, HART.red, r.seed, 13, 12);
        if (aa >= 4 && aa < 16) { glint(R.x, R.y, HART.red, fade(aa - 4, 12)); ringOut(R.x, R.y, aa - 4, 10, 5, HART.red); }
      });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Pechi (skep): the bees that come out of the door in its belly

const SKEP = { straw: '#d9b159', honey: '#c16f0c', dark: '#7d5419', ink: '#22160a' };
/** A bee: a body striped straw, dark, and honey, with a white wing that beats. */
function bee(x: number, y: number, t: number, lv = 1): void { px(x, y, SKEP.straw, lv); px(x + 1, y, SKEP.ink, lv); px(x - 1, y, SKEP.honey, lv); px(x, y - 1, (t >> 1) & 1 ? W : SKEP.straw, lv); }
/** A swarm of n bees weaving round cx, cy within rx by ry, each on its own figure of eight. */
function swarm(cx: number, cy: number, n: number, t: number, rx: number, ry: number, seed: number, lv = 1): void {
  for (let q = 0; q < n; q++) { const ph = hash(seed + q) * 6.28, sp = 0.12 + hash(seed + q * 3) * 0.08; bee(cx + Math.sin(t * sp + ph) * rx, cy + Math.sin(t * sp * 2 + ph * 1.3) * ry, t + q, lv); }
}
/** A sting a frames after it lands: a prick of honey with a white point and a small straw ring. */
function sting(x: number, y: number, a: number): void {
  if (a < 0 || a >= 8) return;
  const L = fade(a, 8, 3);
  px(x, y, a < 2 ? W : SKEP.honey, L); px(x - 1, y - 1, SKEP.straw, L); px(x + 1, y - 1, SKEP.straw, L); px(x, y + 1, SKEP.honey, L);
  ringOut(x, y, a, 5, 3, SKEP.straw);
}

const SKEP_ART: Record<string, LegendArt> = {
  // Buzz: bees pour out of Pechi's door and whirl round it faster and faster, and rings of straw pulse round it.
  skep_buzz: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 5);
      swarm(U.x, U.y - 1, Math.min(8, 1 + (t >> 1)), t * (1 + prog(t, 0, hitOf(r))), 9, 5, r.seed, L);
      landed(r, (_, a) => { ringOut(U.x, U.y + 3, a, 12, 9, SKEP.straw, 0.4); ringOut(U.x, U.y + 3, a - 3, 12, 7, SKEP.honey, 0.4); });
    },
  },

  // Smoke Out: gray smoke rolls over every foe, and the bees scatter out of it away from them.
  skep_smokeout: {
    noLandings: true,
    front(r) {
      const t = r.t;
      landed(r, (E, a) => {
        for (let q = 0; q < 3; q++) puff(E.x - 4 + q * 4, E.y + 3, a + 2 - q * 2, 20, '#5a5466', '#9a94a0', 3, 0.3);
        for (let q = 0; q < 5; q++) { const ang = q / 5 * Math.PI * 2 + 0.3, d = 3 + a * 1.1; if (a < 16) bee(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.6, t + q, fade(a, 16)); }
      });
      if (t < hitOf(r)) for (let q = 0; q < 2; q++) puff(userAt(r).x + (q ? 3 : -3), userAt(r).y - 2, t - q * 3, 12, '#5a5466', '#9a94a0', 2, 0.3);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Swarm Up: the bees close in round Pechi into a thick ball that holds over it.
  skep_swarmup: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), L = hold(t, 0, r.end, 5), k = 1 - 0.5 * ease(prog(t, 0, hit));
      swarm(U.x, U.y, 14, t, 11 * k, 7 * k, r.seed, L);
      if (t >= hit) arc(U.x, U.y, 7, 6, SKEP.straw, 0.5 * hold(t, hit, r.end, 4));
    },
  },

  // Whole Hive: the whole swarm boils out of Pechi's door, five streams of bees close on the foe, and each lands a sting on the same spot.
  skep_hiverage: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { wash(SKEP.ink, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), last = lastOf(r), a = t - last;
      if (t < go + 6) swarm(U.x, U.y - 2, Math.min(14, 2 + (t >> 1)), t, 12, 7, r.seed, hold(t, 0, go + 6, 4));
      for (const f of r.flights) {
        const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], u = ease(aa / f.dur), ang = f.i / f.n * Math.PI * 2 + 0.5, S = { x: E.x + Math.cos(ang) * 18, y: E.y + Math.sin(ang) * 11 };
        for (let k = 0; k < 3; k++) { const p = lerp(S, E, Math.max(0, u - k * 0.1)); bee(p.x + Math.sin(t + k), p.y + Math.cos(t * 0.7 + k), t + k); }
      }
      landed(r, (E, aa, i) => { sting(E.x + 1, E.y - 1, aa); if (aa < 10) swarm(E.x, E.y, 3, t, 6, 4, r.seed + i, fade(aa, 10)); });
      if (a >= 0) { const E = aim(r); sparks(E.x + 1, E.y - 1, still(a, 5), 9, SKEP.straw, SKEP.honey, r.seed, 12, 12); }
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Nekkori (taproot): roots that run, rise, and hold

const TAPROOT = { root: '#523e2f', light: '#8c6e52', leaf: '#6afa8b', green: '#459d34', dark: '#221a12' };
/** A root from a to b that wavers as it grows, `grow` of the way there: pale on a dark side, a green tip, and hairs off it. */
function rootTo(a: Pt, b: Pt, grow: number, t: number, lv = 1, wob = 1.5): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, n = Math.round(d * grow);
  for (let i = 0; i <= n; i++) {
    const o = Math.sin(i * 0.5 + t * 0.2) * wob * Math.min(1, i / 6), x = a.x + dx / d * i + nx * o, y = a.y + dy / d * i + ny * o;
    px(x, y, i >= n - 1 ? TAPROOT.leaf : TAPROOT.light, lv); px(x + nx, y + ny, TAPROOT.root, lv);
    if (i % 5 === 3) px(x - nx * 2, y - ny * 2, TAPROOT.light, lv);
  }
}
/** A root rising h out of the ground at x, foot, twisting as it goes, with a green tip. */
function rootUp(x: number, foot: number, h: number, ph: number, lv = 1, amp = 2): void {
  for (let k = 0; k <= h; k++) { const x1 = x + Math.sin(k * 0.55 + ph) * amp; px(x1, foot - k, k >= h - 1 ? TAPROOT.leaf : TAPROOT.light, lv); px(x1 + 1, foot - k, TAPROOT.root, lv); }
}
/** A seedling: two green leaves on a stem over its root ball, its leaves swapping as it tumbles. */
function seedling(x: number, y: number, flip: boolean, lv = 1): void { blit(flip ? ['.gg', '.s.', '.s.', 'bbb'] : ['gg.', '.s.', '.s.', 'bbb'], x, y, { g: TAPROOT.leaf, s: TAPROOT.green, b: TAPROOT.light }, lv); }

const TAPROOT_ART: Record<string, LegendArt> = {
  // Root Shove: two roots run out along the ground from Nekkori and shove up under the foe in a burst of soil and leaf.
  taproot_rootshove: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 5);
      const at = (P: Pt, i: number): Pt => ({ x: P.x + (i ? 2 : -2), y: P.y + 5 });
      inbound(r, (u, E, i) => rootTo(at(U, i), at(E, i), u, t + i * 7, L));
      landed(r, (E, a, i) => rootTo(at(U, i), at(E, i), 1, t + i * 7, fade(a, 14, 5)));
    },
    front(r) { landed(r, (E, a, i) => { const s = still(a, 2); chunks(E.x + (i ? 2 : -2), E.y + 4, s, 5, TAPROOT.root, TAPROOT.light, r.seed + i, 12, 1, 1.6); sparks(E.x, E.y + 2, s, 5, TAPROOT.leaf, TAPROOT.green, r.seed + i, 7, 7); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Root Under: three roots break up out of the ground round the foe and twist about it, holding it where it stands.
  taproot_twisted: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E, i) => rootUp(E.x + (i - 1) * 6, E.y + 6, Math.round(12 * u), t * 0.2 + i * 2));
      landed(r, (E, a, i) => {
        const L = fade(a, r.end - r.hits[i].at, 6);
        rootUp(E.x + (i - 1) * 6, E.y + 6, 12, t * 0.2 + i * 2, L);
        arc(E.x, E.y - 2 + i * 3, 6, 2, i % 2 ? TAPROOT.light : TAPROOT.green, L, 0.05, 0.45);
        chunks(E.x + (i - 1) * 6, E.y + 5, still(a, 2), 4, TAPROOT.root, TAPROOT.light, r.seed + i, 10, 0.8, 1.4);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Seedling Toss: a seedling with its root ball lobs onto the foe with a wet splash of soil, and a Sapling sprouts by Nekkori.
  taproot_saplingtoss: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit;
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); seedling(p.x, p.y, ((t >> 2) & 1) === 1); });
      landed(r, (E, aa) => {
        const s = still(aa, 2);
        chunks(E.x, E.y + 2, s, 6, TAPROOT.root, TAPROOT.light, r.seed, 14, 1.3, 1.4);
        if (s < 12) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.6, vy = -1.5 - hash(r.seed + q) * 0.8; px(E.x + vx * s, E.y + vy * s + 0.12 * s * s, q % 2 ? TAPROOT.leaf : W, fade(s, 12)); }
      });
      if (a >= 2) { const P = { x: r.from.x + toward(r) * 10, y: r.from.y + 4 }, g = Math.min(4, (a - 2) >> 1), L = fade(a, r.end - hit, 6); for (let k = 0; k < g; k++) px(P.x, P.y - k, TAPROOT.green, L); if (g >= 3) { px(P.x - 1, P.y - g, TAPROOT.leaf, L); px(P.x + 1, P.y - g, TAPROOT.leaf, L); } line(P.x - 2, P.y + 1, P.x + 2, P.y + 1, TAPROOT.light, L); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Root Wave: Nekkori stomps, a wave of roots heaves along the ground toward the foes, and a ring of root spikes bursts up round each.
  taproot_rootwave: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, c = r.contact;
      wash(TAPROOT.dark, 0.25 * hold(t, 0, r.end, 6));
      for (const E of r.to) for (let q = 0; q < 6; q++) { const a = t - c - q * 2; if (a < 0 || a >= 10) continue; const p = lerp({ x: r.from.x, y: r.from.y + 5 }, { x: E.x, y: E.y + 5 }, (q + 1) / 7); rootUp(p.x, p.y, Math.round(4 * Math.sin(Math.PI * a / 10)), q, 1, 1); }
    },
    front(r) {
      const t = r.t;
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0) continue;
        const E = r.to[f.to] || r.to[0], ang = f.i / f.n * Math.PI * 2, L = a < f.dur ? 1 : fade(a - f.dur, r.end - f.t0 - f.dur, 6);
        rootUp(E.x + Math.cos(ang) * 9, E.y + 5 + Math.sin(ang) * 2.5, Math.round(9 * Math.min(1, a / f.dur)), ang * 2, L, 1.2);
      }
      landed(r, (E, a, i) => { if (i % 3 === 0) chunks(E.x, E.y + 4, a, 4, TAPROOT.root, TAPROOT.light, r.seed + i, 12, 1.4, 1.5); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Mushina (borer): bored holes, frass, and the beetle's sheen

const BORER = { sheen: '#11ffdb', amber: '#dc9d32', dark: '#2b2320', deep: '#100c0a', teal: '#0a8a78', frass: '#f0c878' };
/** A bored hole rr across: a dark mouth in a ring of amber frass, with a glint of the beetle's sheen. */
function borehole(x: number, y: number, rr: number, lv = 1): void { oval(x, y, rr + 1, (rr + 1) * 0.8, BORER.amber, lv); oval(x, y, rr, rr * 0.8, BORER.deep, lv); px(x - rr + 1, y - 1, BORER.sheen, lv); }
/** Frass spraying out of a hole a frames after it opens: amber sawdust thrown out in a turning spiral. */
function frass(x: number, y: number, a: number, n: number, seed: number, life = 14): void {
  if (a < 0 || a >= life) return;
  for (let q = 0; q < n; q++) { const ang = q / n * Math.PI * 2 + a * 0.25, d = 2 + a * (0.6 + hash(seed + q) * 0.5); px(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.7 + 0.04 * a * a, q % 3 ? BORER.amber : BORER.frass, fade(a, life)); }
}

const BORER_ART: Record<string, LegendArt> = {
  // Bore Hole: Mushina dashes in with a streak of sheen, its jaws close, a round hole bores into the foe, and frass sprays out in a spiral.
  borer_borehole: {
    tail: 8, noLandings: true,
    front(r) {
      smear(r, BORER.sheen, BORER.teal, 9);
      landed(r, (E, a) => {
        const s = still(a, 2);
        borehole(E.x, E.y, Math.min(2.5, 0.5 + s * 0.5), fade(a, 18, 5));
        frass(E.x, E.y, s, 9, r.seed);
        if (a < 4) { line(E.x - 5, E.y - 3 + a, E.x - 2, E.y, W); line(E.x + 5, E.y - 3 + a, E.x + 2, E.y, W); }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Galleries: Mushina sinks into its hole, galleries run under the ground beneath the foes, and holes burst open under each one after another.
  borer_gallery: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 5);
      borehole(r.from.x, r.from.y + 5, 3, hold(t, 0, leaveOf(r) + 8, 4));
      for (const E of r.to) {
        const g = prog(t, 4, hitOf(r)), n = Math.round(24 * g), y = E.y + 7;
        for (let i = 0; i <= n; i++) px(E.x - 12 + i, y + Math.round(Math.sin(i * 0.7)), i === n ? BORER.frass : BORER.amber, L);
        for (let q = 0; q < 4; q++) if (n >= 3 + q * 6) line(E.x - 9 + q * 6, y - 1, E.x - 9 + q * 6, y - 2, BORER.amber, L);
      }
    },
    front(r) {
      landed(r, (E, a, i) => { const x = E.x - 9 + (i % 4) * 6; borehole(x, E.y + 5, 1.5, fade(a, r.end - r.hits[i].at, 5)); frass(x, E.y + 4, still(a, 1), 6, r.seed + i, 12); });
      const a = r.t - lastOf(r);
      if (a >= 0) for (const E of r.to) circling(E, a, 3, (x, y) => px(x, y, BORER.sheen, fade(a, r.end - lastOf(r), 5)));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Hard Back: Mushina's wing cases snap shut over it with a flash of sheen, and amber spines stand out round their edge.
  borer_carapace: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), a = t - hit, close = ease(prog(t, 0, hit)), L = hold(t, 0, r.end, 5);
      arc(U.x - 4 * (1 - close), U.y + 3, 7, 8, BORER.sheen, L, 0.5, 0.75); arc(U.x + 4 * (1 - close), U.y + 3, 7, 8, BORER.sheen, L, 0.75, 1);
      arc(U.x - 4 * (1 - close), U.y + 3, 6, 7, BORER.teal, L, 0.52, 0.73); arc(U.x + 4 * (1 - close), U.y + 3, 6, 7, BORER.teal, L, 0.77, 0.98);
      if (a < 0) return;
      if (a < 4) glint(U.x, U.y - 5, BORER.sheen);
      for (let q = 0; q < 5; q++) { const ang = Math.PI * (1.1 + q * 0.2), x = U.x + Math.cos(ang) * 8, y = U.y + 3 + Math.sin(ang) * 9; line(x, y, x + Math.cos(ang) * 2, y + Math.sin(ang) * 2, BORER.amber, fade(a, r.end - hit, 5)); }
    },
  },

  // Into the Wood: Mushina bores down into the ground in a spray of frass, and only its hole is left, with two points of sheen looking out.
  borer_vendetta: {
    lead: 8, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 6); wash(BORER.deep, 0.375 * L); borehole(U.x, U.y + 5, 1 + 4 * ease(prog(t, 0, hitOf(r))), L); },
    front(r) {
      const t = r.t, hit = hitOf(r), U = r.from, a = t - hit;
      if (t < hit + 4) frass(U.x, U.y + 4, t % 12, 10, r.seed + Math.floor(t / 12), 12);
      if (a < 0) return;
      const L = fade(a, r.end - hit, 6), on = ((a >> 3) & 3) !== 3;
      if (on) { px(U.x - 1, U.y + 5, BORER.sheen, L); px(U.x + 2, U.y + 5, BORER.sheen, L); }
      ringOut(U.x, U.y + 5, a, 14, 9, BORER.amber, 0.35);
    },
  },
};

// ---------------------------------------------------------------- Mulchi (clod): lumps of its own earth, each with a sprout

const CLOD = { earth: '#927c63', sprout: '#68d899', dark: '#564434', light: '#bca888', deep: '#261e16' };
const LUMPS = [['.g..', 'llee', 'eeed', '.dd.'], ['....', 'leeg', 'eeed', '.dd.'], ['....', 'llee', 'eeed', '.dg.'], ['....', 'glee', 'eeed', '.dd.']];
/** A lump of Mulchi's earth: a round clod with a pale top, a dark underside, and a sprout that turns with `spin`. */
function lump(x: number, y: number, spin = 0, lv = 1, s = 1): void { blit(LUMPS[spin & 3], x, y, { g: CLOD.sprout, l: CLOD.light, e: CLOD.earth, d: CLOD.dark }, lv, s); }
/** A mound of earth heaped round a whorl's feet, w wide and h tall, with sprouts along its top. */
function mound(E: Pt, w: number, h: number, sprouts: number, lv = 1): void {
  oval(E.x, E.y + 5, w, h, CLOD.earth, lv); arc(E.x, E.y + 5, w, h, CLOD.light, lv, 0.55, 0.95); dither(E.x - w, E.y + 5, 2 * w + 1, 1, CLOD.dark, lv);
  for (let q = 0; q < sprouts; q++) px(E.x - w + 2 + q * Math.max(2, (2 * w - 3) / Math.max(1, sprouts)), E.y + 5 - h - (q & 1), CLOD.sprout, lv);
}

const CLOD_ART: Record<string, LegendArt> = {
  // Roll Clod: Mulchi bowls two lumps of itself over at the foe, turning as they go, and they burst into clods of earth.
  clod_rollclod: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a) => { if (a < 16) { const n = Math.min(7, 2 + a); dither(E.x - n, E.y + 5, 2 * n + 1, 1, CLOD.dark, fade(a, 16)); } }); },
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); lump(p.x, p.y, Math.floor(u * 8)); });
      landed(r, (E, a, i) => { const s = still(a, 2); chunks(E.x, E.y + 1, s, 7, CLOD.earth, CLOD.light, r.seed + i * 9, 16, 1.4, 1.3); sparks(E.x, E.y, s, 4, CLOD.sprout, CLOD.light, r.seed + i, 6, 6); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Pull Clod: a lump swings out on a green root, smacks the foe, and is yanked back to Mulchi.
  clod_pullclod: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], v = a < f.dur / 2 ? ease(a / (f.dur / 2)) : 1 - ease((a - f.dur / 2) / (f.dur / 2)), p = lerp(U, E, v), n = Math.round(Math.hypot(p.x - U.x, p.y - U.y));
        for (let i = 0; i <= n; i++) { const q = sagAt(U, p, i / Math.max(1, n), 3 * (1 - v)); px(q.x, q.y, i % 3 ? CLOD.sprout : CLOD.dark); }
        lump(p.x, p.y, a >> 1);
      }
      landed(r, (E, a) => { const s = still(a, 2); chunks(E.x, E.y, s, 6, CLOD.earth, CLOD.dark, r.seed, 14, 1.3, 1.2); ringOut(E.x, E.y, s, 8, 6, CLOD.light); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Pack Earth: Mulchi stomps, lumps fly in round the foe from three sides, and they pack onto it in a growing mound of earth.
  clod_packearth: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, n = r.hits.filter(h => t >= h.at).length;
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], u = ease(a / f.dur), ang = f.i / f.n * Math.PI * 2 + 0.4, S = { x: E.x + Math.cos(ang) * 17, y: E.y + Math.sin(ang) * 10 };
        lump(S.x + (E.x - S.x) * u, S.y + (E.y + 2 - S.y) * u, a >> 2);
      }
      if (n) mound(aim(r), 3 + n * 2, 1 + n, n, hold(t, hitOf(r), r.end, 5));
      landed(r, (E, a, i) => chunks(E.x, E.y + 2, a, 4, CLOD.earth, CLOD.light, r.seed + i * 5, 10, 1.2, 1));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Earthen Hold: every lump lifts off the ground round Mulchi, then all fly in round the foe and pile into a mound that holds it, sprouts and all.
  clod_earthenhold: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(CLOD.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), n = r.hits.filter(h => t >= h.at).length;
      for (let q = 0; q < 6; q++) { const f = r.flights[q]; if (f && t >= f.t0) continue; const ang = q / 6 * Math.PI * 2 + t * 0.08; lump(U.x + Math.cos(ang) * 10, U.y + 4 + Math.sin(ang) * 3 - ease(prog(t, q, q + 8)) * 6, q); }
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], u = ease(a / f.dur), ang = f.i / f.n * Math.PI * 2 + 0.3, S = { x: E.x + Math.cos(ang) * 18, y: E.y + Math.sin(ang) * 11 - 6 };
        lump(S.x + (E.x - S.x) * u, S.y + (E.y + 2 - S.y) * u, a >> 2);
      }
      if (n) mound(aim(r), 4 + n * 1.3, 1 + n * 0.5, n, hold(t, hitOf(r), r.end, 6));
      landed(r, (E, a, i) => chunks(E.x, E.y + 2, still(a, i === r.hits.length - 1 ? 6 : 0), 4, CLOD.earth, CLOD.light, r.seed + i * 5, 12, 1.4, 1.2));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 3) || shake(r.t - hitOf(r), 4, 1), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Virtsa (whip): green switches that lash and leaves that open

const WHIP = { bark: '#7c5c3b', gold: '#e1c161', leaf: '#4da33b', light: '#8ad070', dark: '#1e180e' };
/** A lash from a to b, `n` of the way, bowed `bow` pixels: a green switch with leaf pairs along it and a gold tip. */
function lash(a: Pt, b: Pt, n: number, bow: number, lv = 1): void {
  const d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), m = Math.round(d * n);
  for (let i = 0; i <= m; i++) { const p = sagAt(a, b, i / d, bow); px(p.x, p.y, i >= m - 1 ? WHIP.gold : i % 2 ? WHIP.leaf : WHIP.light, lv); if (i % 6 === 3) { px(p.x - 1, p.y - 1, WHIP.leaf, lv); px(p.x + 1, p.y - 1, WHIP.leaf, lv); } }
}
/** A small leaf of green with a gold vein, turned by k. */
function leafAt(x: number, y: number, k: number, lv = 1): void { blit(k & 1 ? ['.gl', 'gl.'] : ['lg.', '.lg'], x, y, { g: WHIP.leaf, l: WHIP.gold }, lv); }
/** A big leaf, five wide, mirrored by k. */
function bigLeaf(x: number, y: number, k: number, lv = 1): void { blit(['..ggl', '.gglg', 'ggg..'], x, y, { g: WHIP.leaf, l: WHIP.light }, lv, 1, (k & 1) === 1); }

const WHIP_ART: Record<string, LegendArt> = {
  // Root Pull: two green switches lash out from Virtsa, each wraps once round the foe, and they hold it down to the ground.
  whip_rootcaller: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r);
      inbound(r, (u, E, i) => lash(U, E, ease(u), i ? 4 : -4));
      landed(r, (E, a, i) => {
        const L = fade(a, r.end - r.hits[i].at, 6), y = E.y - 1 + i * 3;
        if (a < 6) lash(U, E, 1, (i ? 4 : -4) * (1 - a / 6), 1 - a / 6);
        arc(E.x, y, 6, 2, i ? WHIP.light : WHIP.leaf, L); px(E.x + 6, y, WHIP.gold, L);
        if (i) { line(E.x - 5, E.y + 3, E.x - 6, E.y + 6, WHIP.bark, L); line(E.x + 5, E.y + 3, E.x + 6, E.y + 6, WHIP.bark, L); }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Seed Shield: three big leaves close in on the ally from round it and lap over each other into a shield before it.
  whip_seedshield: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], dir = toward(r);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const u = ease(a / f.dur), ang = f.i / f.n * Math.PI * 2 + 1, S = { x: A.x + Math.cos(ang) * 16, y: A.y + Math.sin(ang) * 10 };
        bigLeaf(S.x + (A.x + dir * 6 - S.x) * u, S.y + (A.y - 3 + f.i * 3 - S.y) * u, a >> 2);
      }
      landed(r, (_, a, i) => { bigLeaf(A.x + dir * 6, A.y - 3 + i * 3, dir > 0 ? 0 : 1, fade(a, r.end - r.hits[i].at, 6)); if (a < 5) glint(A.x + dir * 7, A.y - 4 + i * 3, WHIP.gold); });
    },
  },

  // Leafing: dew drips from Virtsa's leaves onto the ally, and each drop opens a new leaf on it.
  whip_leafing: {
    noFlights: true, noLandings: true,
    front(r) {
      const A = r.to[0], top = high(A) ? 10 : 14;
      inbound(r, (u, _, i) => { const x = A.x - 5 + i * 5, y = A.y - top + (top - 2) * u * u; px(x, y, W); px(x, y + 1, WHIP.light); px(x, y - 1, WHIP.light, 0.5); });
      landed(r, (_, a, i) => { const x = A.x - 5 + i * 5, y = A.y - 2 + (i & 1) * 3; leafAt(x, y, i, fade(a, r.end - r.hits[i].at, 6)); ringOut(x, y + 1, a, 6, 3, WHIP.light, 0.5); });
      mends(A, r.t - lastOf(r), WHIP.light);
    },
  },

  // Sprout Guard: leaves rise from the ground beside Virtsa and a Root Friend grows up out of them, trunk first, then a crown with eyes.
  whip_sproutguard: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(WHIP.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, P = { x: r.from.x + toward(r) * 12, y: r.from.y + 5 }, n = r.hits.filter(h => t >= h.at).length, g = n / 6;
      inbound(r, (u, _, i) => leafAt(P.x - 6 + i * 2.4, P.y - u * 10, i));
      if (!n) return;
      const L = hold(t, hitOf(r), r.end, 6), h = Math.round(4 + (high(P) ? 6 : 10) * g), cy = P.y - h - 2;
      dither(P.x - 1, P.y - h, 3, h, WHIP.bark, L); line(P.x - 1, P.y - h, P.x - 1, P.y - 1, WHIP.gold, 0.5 * L);
      line(P.x, P.y - h + 3, P.x - 4 * g, P.y - h, WHIP.bark, L); line(P.x, P.y - h + 2, P.x + 4 * g, P.y - h - 1, WHIP.bark, L);
      oval(P.x, cy, 3 + 3 * g, 2 + 2 * g, WHIP.leaf, L); arc(P.x, cy, 3 + 3 * g, 2 + 2 * g, WHIP.light, L, 0.55, 0.95);
      if (n >= 6) { px(P.x - 2, cy, WHIP.gold, L); px(P.x + 2, cy, WHIP.gold, L); }
      landed(r, (_, a, i) => { if (a < 6) glint(P.x + ((i * 5) % 7) - 3, cy - 1, WHIP.gold, fade(a, 6)); });
    },
  },
};

// ---------------------------------------------------------------- Kobudus (gnarl): the eye that is too big, and dreams

const GNARL = { lav: '#81719e', eye: '#eada7a', dark: '#403850', deep: '#18141f', pale: '#c4b8dc' };
const EYE_OPEN = ['.lllll.', 'lleeell', 'leepeel', '.eeeee.', '..eee..'], EYE_HALF = ['.lllll.', 'lllllll', 'leepeel', '.eeeee.', '.......'], EYE_SHUT = ['.lllll.', 'lllllll', '.ddddd.', '.......', '.......'];
/** The eye that is too big: a pale yellow ball and dark pupil under a heavy lavender lid, `open` from 0 to 1, `s` times size. */
function bigEye(x: number, y: number, s: number, open: number, lv = 1): void { blit(open > 0.66 ? EYE_OPEN : open > 0.33 ? EYE_HALF : EYE_SHUT, x, y, { l: GNARL.lav, e: GNARL.eye, p: GNARL.dark, d: GNARL.dark }, lv, s); }
/** A dream: a pale lavender bubble with a yellow star in it. */
function dreamBubble(x: number, y: number, lv = 1): void { blit(['.ppp.', 'p...p', 'p.y.p', '.ppp.'], x, y, { p: GNARL.pale, y: GNARL.eye }, lv); }
/** A sleep mark: a small Z. */
function zee(x: number, y: number, lv = 1): void { blit(['zzz', '.z.', 'zzz'], x, y, { z: GNARL.pale }, lv); }

const GNARL_ART: Record<string, LegendArt> = {
  // Sap Dream: a dream bubble drifts at the foe and bursts over it, and wisps of what it held float back to Kobudus.
  gnarl_enfeeble: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), a = t - hitOf(r) - 3;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); dreamBubble(p.x, p.y + Math.sin(u * 9) * 1.5); });
      landed(r, (E, aa) => { const s = still(aa, 2); if (s < 10) for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2, d = 2 + s * 0.8; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, q % 2 ? GNARL.eye : GNARL.pale, fade(s, 10)); } if (aa < 3) glint(E.x, E.y, GNARL.eye); });
      for (let q = 0; q < 3; q++) { const u = prog(a - q * 3, 0, 14); if (u > 0 && u < 1) { const p = sagAt(aim(r), U, ease(u), -4); px(p.x, p.y, GNARL.pale); px(p.x - 1, p.y + 1, GNARL.lav); px(p.x + 1, p.y + 1, GNARL.lav); } }
    },
  },

  // Bad Sleep: night comes in, the eye that is too big opens by the foe and stares, its lid comes down, and sleep marks rise off the foe.
  gnarl_nightmare: {
    noFlights: true, noLandings: true,
    back(r) { wash(GNARL.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), B = perch(E), a = t - hit;
      bigEye(B.x, B.y, 1, a < 0 ? prog(t, 0, 6) : 1 - prog(a, 0, 6), hold(t, 0, r.end, 5));
      inbound(r, (u, E2) => { const p = lobAt(r.from, E2, u); dreamBubble(p.x, p.y); });
      if (a >= 0) for (let q = 0; q < 3; q++) { const aa = (a + q * 6) % 18; zee(E.x + 3 + aa * 0.3, E.y - 5 - aa * 0.6, fade(a, r.end - hit, 6) * (1 - aa / 18)); }
    },
  },

  // Heavy Eye: two heavy lavender lids close on the foe from above and below and press, and yellow drowse drips off it.
  gnarl_mindsap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit, go = leaveOf(r), u = ease(prog(t, go, hit)), L = a < 0 ? 1 : fade(a, 14, 5);
      if (t >= go && L > 0) {
        const gap = 12 - 8 * u + (a >= 0 ? Math.min(2, a * 0.5) : 0);
        arc(E.x, E.y - gap + 3, 8, 4, GNARL.lav, L, 0.05, 0.45); arc(E.x, E.y - gap + 4, 7, 3, GNARL.pale, L, 0.1, 0.4);
        arc(E.x, E.y + gap - 3, 8, 4, GNARL.lav, L, 0.55, 0.95);
      }
      if (a >= 0) for (let q = 0; q < 3; q++) { const aa = (a + q * 4) % 12; px(E.x - 4 + q * 4, E.y - 2 + aa * 0.5, GNARL.eye, fade(a, r.end - hit, 6) * (1 - aa / 12)); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Dream Grip: the night deepens, the great eye opens over Kobudus, three dreams circle it and fly, and a spiral of dream closes round the foe and drains it.
  gnarl_grip: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), a = t - hit;
      wash(GNARL.deep, 0.5 * hold(t, 0, r.end, 8));
      if (a >= 0) for (let q = 0; q < 16; q++) { const ang = q * 0.6 + a * 0.3, rr = (12 - (q % 8) * 1.2) * (1 - prog(a, 0, r.end - hit) * 0.4); px(E.x + Math.cos(ang) * rr, E.y + Math.sin(ang) * rr * 0.6, q % 3 ? GNARL.lav : GNARL.pale, fade(a, r.end - hit, 6)); }
    },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), M = perch(r.from), hit = hitOf(r), a = t - hit;
      bigEye(M.x, M.y, 2, prog(t, 0, 10) * (1 - prog(t, r.end - 8, r.end)), hold(t, 0, r.end, 6));
      for (const f of r.flights) {
        const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue;
        const u = aa / f.dur, a0 = f.i / f.n * Math.PI * 2, O = { x: U.x + Math.cos(a0) * 10, y: U.y + Math.sin(a0) * 5 };
        const p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 4 + a0) * 10, y: U.y + Math.sin(u / 0.6 * Math.PI * 4 + a0) * 5 } : lerp(O, E, (u - 0.6) / 0.4);
        dreamBubble(p.x, p.y);
      }
      landed(r, (E2, aa) => { if (aa < 8) glint(E2.x, E2.y, GNARL.eye, fade(aa, 8)); });
      if (a >= 0) {
        const L = fade(a, r.end - hit, 6);
        for (let q = 0; q < 4; q++) { const p = lerp(E, U, (a * 0.04 + q / 4) % 1); px(p.x, p.y, GNARL.eye, L); px(p.x, p.y - 1, GNARL.pale, 0.5 * L); }
        for (let q = 0; q < 2; q++) { const aa = (a + q * 9) % 18; zee(E.x + 4 + aa * 0.3, E.y - 6 - aa * 0.5, L * (1 - aa / 18)); }
      }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 10, 2) }; },
  },
};

// ---------------------------------------------------------------- Amevia (upfall): rain that falls upward

const UPFALL = { blue: '#7abae1', pale: '#cde9fc', gray: '#788096', deep: '#202a3c' };
/** A drop falling upward: its round head on top and its streak trailing below. */
function updrop(x: number, y: number, lv = 1): void { blit(['.p.', 'pwp', 'bbb', '.b.', '.g.'], x, y, { p: UPFALL.pale, w: W, b: UPFALL.blue, g: UPFALL.gray }, lv); }
/** A splash thrown upward from x, y a frames after: a crown of drops that fly up and keep falling up. */
function upsplash(x: number, y: number, a: number, seed: number, life = 12): void {
  if (a < 0 || a >= life) return;
  for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5, vy = -1.2 - hash(seed + q) * 0.8; px(x + vx * a, y + vy * a - 0.05 * a * a, q % 2 ? UPFALL.pale : W, fade(a, life)); }
  if (a < 5) for (let i = -3; i <= 3; i++) px(x + i, y - (3 - Math.abs(i)) * Math.min(1, a / 2), Math.abs(i) < 2 ? UPFALL.pale : UPFALL.blue, 1 - a / 5);
}

const UPFALL_ART: Record<string, LegendArt> = {
  // Rising Drops: four drops shoot up out of a puddle under the foe and break upward over it in crowns of spray that keep falling up.
  upfall_risingdrops: {
    noFlights: true, noLandings: true,
    back(r) { const E = aim(r), go = leaveOf(r); if (r.t >= go) { const L = hold(r.t, go, r.end, 5); oval(E.x, E.y + 5, 8, 2, UPFALL.deep, L); arc(E.x, E.y + 5, 8, 2, UPFALL.blue, L, 0.05, 0.45); } },
    front(r) {
      inbound(r, (u, E, i) => updrop(E.x - 4.5 + i * 3, E.y + 6 - 12 * u * u));
      landed(r, (E, a, i) => upsplash(E.x - 4.5 + i * 3, E.y - 5, still(a, i === 0 ? 2 : 0), r.seed + i));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Shrink: drops rise past the foe, and a pale bar comes down on its head one step for each drop, leaving it shorter.
  upfall_shrink: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length, L = hold(t, leaveOf(r), r.end, 5), top = E.y - 11 + n * 2;
      inbound(r, (u, E2, i) => updrop(E2.x + (i - 1) * 6, E2.y + 6 - 20 * u));
      if (L > 0) {
        line(E.x - 6, top, E.x + 6, top, UPFALL.pale, L); line(E.x - 6, E.y + 5, E.x + 6, E.y + 5, UPFALL.blue, L);
        for (const s of [-4, 0, 4]) { px(E.x + s - 1, top - 2, UPFALL.blue, L); px(E.x + s + 1, top - 2, UPFALL.blue, L); px(E.x + s, top - 1, UPFALL.pale, L); }
      }
      landed(r, (E2, a) => { if (a < 6) glint(E2.x + ((a * 3) % 9) - 4, top, UPFALL.pale, fade(a, 6)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Help Up: drops rise up under the ally and rings of water close round it, with streaks inside them all running up.
  upfall_helpup: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], a = t - hitOf(r);
      inbound(r, (u, _, i) => updrop(A.x + (i ? 4 : -4), A.y + 6 - 12 * u));
      landed(r, (_, aa, i) => arc(A.x, A.y + 1, 7 + i, 6 + i, i ? UPFALL.pale : UPFALL.blue, fade(aa, r.end - r.hits[i].at, 6)));
      if (a >= 0) for (let q = 0; q < 5; q++) { const k = (a + q * 3) % 12; px(A.x - 6 + q * 3, A.y + 4 - k, UPFALL.pale, fade(a, r.end - hitOf(r), 6) * (1 - k / 12)); }
    },
  },

  // Grow Tall: rain pours upward over the field, a pale frame round the ally stands taller with each drop, and drops circle the foe's head.
  upfall_swell: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6);
      wash(UPFALL.deep, 0.25 * L);
      for (let q = 0; q < 14; q++) { const x = (q * 7 + 3) % 96, y = 60 - ((t * 2 + q * 11) % 64); line(x, y, x, y + 2, q % 3 ? UPFALL.blue : UPFALL.pale, 0.5 * L); }
    },
    front(r) {
      const t = r.t, A = r.to[0], n = r.hits.filter(h => t >= h.at).length, last = lastOf(r), a = t - last;
      inbound(r, (u, _, i) => updrop(A.x - 7.5 + i * 3, A.y + 6 - 14 * u));
      if (n) { const L = hold(t, hitOf(r), r.end, 6), top = A.y - 5 - n * (high(A) ? 0.8 : 1.5); line(A.x - 6, top, A.x + 6, top, UPFALL.pale, L); line(A.x - 6, top, A.x - 6, A.y + 4, UPFALL.blue, L); line(A.x + 6, top, A.x + 6, A.y + 4, UPFALL.blue, L); px(A.x, top - 1, W, L); }
      if (a >= 0) circling(across(A), a, 3, (x, y) => updrop(x, y, fade(a, r.end - last, 5)));
    },
  },
};

// ---------------------------------------------------------------- Kiln (kiln): fired bricks, its flames, and the glaze it leaves

const KILN = { brick: '#912c0f', fire: '#e28419', glaze: '#dcd0b4', dark: '#3a120a', hot: '#f6c070' };
/** A fired brick: brick red with a hot orange face and a dark lower edge, five wide. */
function fireBrick(x: number, y: number, lv = 1, s = 1): void { blit(['bbbbb', 'bffbb', 'ddddd'], x, y, { b: KILN.brick, f: KILN.fire, d: KILN.dark }, lv, s); }
/** Glaze on a whorl: a cream crazing of short broken lines over it, with a shine that runs across. */
function glazeOn(E: Pt, lv: number, t: number): void {
  if (lv <= 0) return;
  for (const [x, y, w, h] of [[-4, -3, 2, 1], [1, -4, 1, 2], [-3, 1, 2, -1], [2, 0, 2, 2], [-1, 3, 2, 1]]) line(E.x + x, E.y + y, E.x + x + w, E.y + y + h, KILN.glaze, 0.75 * lv);
  const k = (t >> 1) % 10; px(E.x - 4 + k, E.y - 4 + (k >> 1), W, lv);
}
/** Tongues of flame w each side of x standing h tall on `foot`: banded red, orange, and pale, flickering with t. */
function flames(x: number, foot: number, w: number, h: number, t: number, lv = 1): void {
  for (let i = -w; i <= w; i++) {
    const hh = Math.round(h * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.3 + t * 0.4))) * (1 - Math.abs(i) / (w + 1)));
    for (let k = 0; k < hh; k++) px(x + i, foot - k, k > hh * 0.7 ? KILN.hot : k > hh * 0.35 ? KILN.fire : KILN.brick, lv);
  }
}

const KILN_ART: Record<string, LegendArt> = {
  // Clinker: two lumps of glowing clinker lob over and smash on the foe, and a cream glaze sets over it, crazed and shining.
  kiln_clinker: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, a = t - lastOf(r);
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u), b = lobAt(r.from, E, Math.max(0, u - 0.08)); tail(p, b, KILN.fire, KILN.brick, KILN.dark, 4); blit(['.dd.', 'dffd', '.dd.'], p.x, p.y, { d: KILN.brick, f: (t >> 1) & 1 ? KILN.hot : KILN.fire }); });
      landed(r, (E, aa, i) => { const s = still(aa, 2); chunks(E.x, E.y + 1, s, 6, KILN.brick, KILN.fire, r.seed + i * 7, 14, 1.3, 1.3); sparks(E.x, E.y, s, 6, KILN.hot, KILN.fire, r.seed + i, 8, 8); });
      if (a >= 2) glazeOn(aim(r), fade(a, r.end - lastOf(r), 6), t);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Into the Kiln: three embers circle Kiln and drop into it one by one, and flame stands taller out of its top with each.
  kiln_bellows: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), n = r.hits.filter(h => t >= h.at).length;
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const u = a / f.dur, ang = u * Math.PI * 4 + f.i * 2.1, rr = 10 * (1 - u), x = U.x + Math.cos(ang) * rr, y = U.y + 1 + Math.sin(ang) * rr * 0.5;
        px(x, y, (a >> 1) & 1 ? W : KILN.hot); px(x - Math.cos(ang), y - Math.sin(ang), KILN.fire); px(x - 2 * Math.cos(ang), y - 2 * Math.sin(ang), KILN.brick, 0.5);
      }
      if (n) flames(U.x, U.y - 4, 3, 2 + n * 2, t, hold(t, hitOf(r), r.end, 5));
      landed(r, (_, a) => { if (a < 6) glint(U.x, U.y + 1, KILN.fire, fade(a, 6)); });
    },
  },

  // Pillar Charge: Kiln charges with heat streaming off it, and the glaze on the foe bursts off in cream shards as the ground cracks.
  kiln_temper: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { if (a >= 16) return; const n = Math.min(8, a * 2), L = fade(a, 16); line(E.x - n, E.y + 5, E.x + n, E.y + 5, KILN.fire, L); line(E.x - n + 1, E.y + 6, E.x + n - 1, E.y + 6, KILN.dark, L); }); },
    front(r) {
      smear(r, KILN.fire, KILN.brick, 12);
      landed(r, (E, a) => {
        const s = still(a, 3);
        if (s < 12) for (let q = 0; q < 7; q++) { const ang = q / 7 * Math.PI * 2 + 0.3, d = 3 + s * 1.1; line(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, E.x + Math.cos(ang) * (d + 2), E.y + Math.sin(ang) * (d + 2) * 0.8, q % 2 ? KILN.glaze : W, fade(s, 12)); }
        sparks(E.x, E.y, s, 5, KILN.hot, KILN.fire, r.seed, 6, 7);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 2) }; },
  },

  // Fire Brick: flames rise round Kiln as it fires, four hot bricks lob out over the foes, and each lands in a crack of glaze and sparks.
  kiln_ram: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, go = leaveOf(r);
      wash(KILN.dark, 0.25 * hold(t, 0, r.end, 6));
      flames(U.x, U.y + 5, 5, Math.round(4 + 6 * prog(t, 0, go)), t, hold(t, 0, go + 10, 4));
      landed(r, (E, a) => { if (a >= 18) return; const n = Math.min(10, a * 2), L = fade(a, 18); line(E.x - n, E.y + 5, E.x + n, E.y + 5, KILN.fire, L); line(E.x - n + 2, E.y + 6, E.x + n - 2, E.y + 6, KILN.dark, L); });
    },
    front(r) {
      const a = r.t - lastOf(r);
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u, 1.2), b = lobAt(r.from, E, Math.max(0, u - 0.08), 1.2); tail(p, b, KILN.hot, KILN.fire, KILN.brick, 5); fireBrick(p.x, p.y); });
      landed(r, (E, aa, i) => {
        const s = still(aa, i === 0 ? 5 : 0);
        chunks(E.x, E.y, s, 6, KILN.brick, KILN.fire, r.seed + i * 5, 14, 1.4, 1.4);
        if (s < 10) for (let q = 0; q < 5; q++) { const ang = q * 1.26 + i, d = 2 + s; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, KILN.glaze, fade(s, 10)); }
      });
      if (a >= 2) for (const E of r.to) glazeOn(E, fade(a, r.end - lastOf(r), 6), r.t);
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(a, 6, 2), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Vyobi (belt): the belt loop with its treads running, and its rollers

const BELT = { rubber: '#5c5c6a', white: '#ebf3fa', blue: '#9dcce3', dark: '#22222c' };
/** A belt looped round a and b, rr from their line, its treads running at `speed` with t: dark rubber with blue and white marks. */
function beltLoop(a: Pt, b: Pt, rr: number, t: number, lv = 1, speed = 1): void {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), ux = d ? dx / d : 1, uy = d ? dy / d : 0, nx = -uy, ny = ux, arcLen = Math.PI * rr;
  const n = Math.round(2 * d + 2 * arcLen), off = Math.floor(t * speed);
  for (let i = 0; i < n; i++) {
    let s = i, x: number, y: number;
    if (s < d) { x = a.x + ux * s + nx * rr; y = a.y + uy * s + ny * rr; }
    else if ((s -= d) < arcLen) { const g = s / rr; x = b.x + nx * rr * Math.cos(g) + ux * rr * Math.sin(g); y = b.y + ny * rr * Math.cos(g) + uy * rr * Math.sin(g); }
    else if ((s -= arcLen) < d) { x = b.x - ux * s - nx * rr; y = b.y - uy * s - ny * rr; }
    else { s -= d; const g = s / rr; x = a.x - nx * rr * Math.cos(g) - ux * rr * Math.sin(g); y = a.y - ny * rr * Math.cos(g) - uy * rr * Math.sin(g); }
    const k = (i + off) % 4;
    px(x, y, k === 0 ? BELT.white : k === 2 ? BELT.blue : BELT.rubber, lv);
  }
}
/** A roller: a blue wheel with a white spoke turned by `turn`. */
function roller(x: number, y: number, turn: number, lv = 1): void { arc(x, y, 2, 2, BELT.blue, lv); px(x, y, BELT.white, lv); px(x + Math.round(Math.cos(turn) * 1.5), y + Math.round(Math.sin(turn) * 1.5), BELT.white, lv); }

const BELT_ART: Record<string, LegendArt> = {
  // Roller Spin: three rollers come rolling through the foes one after another, knocking up dust.
  belt_rollers: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur;
        roller(E.x + dir * (44 * u - 20), E.y + 3, t * 0.8 * dir); px(E.x + dir * (44 * u - 23), E.y + 5, BELT.rubber); px(E.x + dir * (44 * u - 26), E.y + 5, BELT.rubber, 0.5);
      }
      landed(r, (E, a, i) => { puff(E.x, E.y + 3, a, 14, BELT.rubber, BELT.blue, 3, 0.2); sparks(E.x, E.y + 1, still(a, 2), 5, BELT.white, BELT.blue, r.seed + i, 6, 6); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Couple Up: two rollers circle Vyobi and set at either end, and a belt loops round them, treads running, as Vyobi and its friend mend.
  belt_couple: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), ends = [{ x: U.x - dir * 6, y: U.y + 2 }, { x: U.x + dir * 8, y: U.y + 2 }];
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const u = a / f.dur, ang = u * Math.PI * 4 + f.i * Math.PI, rr = 10 * (1 - u), c = lerp(U, ends[f.i % 2], u);
        roller(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr * 0.5, t * 0.6);
      }
      landed(r, (_, a, i) => roller(ends[i % 2].x, ends[i % 2].y, t * 0.6, fade(a, r.end - r.hits[i].at, 6)));
      const a = t - lastOf(r);
      if (a >= 0) { beltLoop(ends[0], ends[1], 4, t, fade(a, r.end - lastOf(r), 6)); mends(U, a, BELT.blue); }
    },
  },

  // Belt Speed: a belt loops round Vyobi and runs faster with each spark that strikes it, speed lines streaming off behind.
  belt_overdrive: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), n = r.hits.filter(h => t >= h.at).length, L = hold(t, 0, r.end, 5), dir = toward(r);
      beltLoop({ x: U.x - 3, y: U.y }, { x: U.x + 3, y: U.y }, 5, t, L, 1 + n);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const ang = a / f.dur * Math.PI * 4 + f.i * 2.1, rr = 11 - 5 * a / f.dur; glint(U.x + Math.cos(ang) * rr, U.y + Math.sin(ang) * rr * 0.6, BELT.blue); }
      if (n) for (let q = 0; q < 3; q++) { const k = (t * 2 + q * 5) % 12; line(U.x - dir * (9 + k), U.y - 3 + q * 3, U.x - dir * (12 + k), U.y - 3 + q * 3, q === 1 ? BELT.white : BELT.blue, L * (1 - k / 12)); }
      landed(r, (_, a) => sparks(U.x, U.y, a, 6, BELT.white, BELT.blue, r.seed, 8, 6));
    },
  },

  // Carry Over: a long belt runs along the ground on Vyobi's side with rollers turning under it, and it carries a friend in to stand in a column of light.
  belt_trip: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), dir = toward(r), a0 = { x: U.x - dir * 18, y: U.y + 6 }, b0 = { x: U.x + dir * 10, y: U.y + 6 };
      wash(BELT.dark, 0.25 * L);
      beltLoop(a0, b0, 2, t, L, 2);
      for (let q = 0; q < 4; q++) roller(a0.x + (b0.x - a0.x) * q / 3, U.y + 6, t * 0.6 * dir, L);
    },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), dir = toward(r), x = U.x - dir * 20 * (1 - ease(prog(t, 6, hit)));
      if (t < hit + 2) for (let i = -4; i <= 4; i++) { px(x + i, U.y - 4, BELT.white, 0.75); px(x + i, U.y + 4, BELT.white, 0.75); px(x - 4, U.y + i, BELT.white, 0.75); px(x + 4, U.y + i, BELT.white, 0.75); }
      landed(r, (_, a, i) => {
        if (i === 0) { const L = fade(a, r.end - hit, 6), h = Math.min(26, a * 4); dither(U.x - 2, U.y + 5 - h, 5, h, BELT.blue, 0.5 * L); line(U.x, U.y + 5 - h, U.x, U.y + 5, BELT.white, L); }
        if (a < 6) glint(U.x + (i - 1.5) * 4, U.y - 6, BELT.white, fade(a, 6));
      });
    },
  },
};

// ---------------------------------------------------------------- Vienum (aerial): radio waves off the mast, and static

const AERIAL = { mast: '#e9ebef', gold: '#dabb5b', blue: '#a8acff', dark: '#20224a' };
/** Radio waves leaving a mast top toward `dir`: n arcs spreading over `life` frames, gold and blue by turns. */
function waves(x: number, y: number, a: number, dir: number, lv = 1, n = 3, life = 12): void {
  for (let q = 0; q < n; q++) { const k = (a + q * (life / n)) % life, rr = 2 + k; arc(x, y, rr, rr, q % 2 ? AERIAL.gold : AERIAL.blue, lv * (1 - k / life), dir > 0 ? -0.12 : 0.38, dir > 0 ? 0.12 : 0.62); }
}
/** Static over a whorl: short broken bands that flicker across it. */
function staticOn(E: Pt, a: number, seed: number, lv = 1): void {
  if (lv <= 0) return;
  for (let q = 0; q < 4; q++) { const y = E.y - 4 + ((q * 3 + a) % 9), x0 = E.x - 6 + Math.floor(hash(seed + q + (a >> 1)) * 4); line(x0, y, x0 + 3 + (q % 3) * 2, y, q % 2 ? AERIAL.mast : AERIAL.blue, lv); }
}
const mastTop = (r: FxRun): Pt => { const U = userAt(r); return { x: U.x, y: U.y - 5 }; };

const AERIAL_ART: Record<string, LegendArt> = {
  // Static Flash: waves pulse off Vienum's mast, a jag of static jumps to the foe, and bands of static flicker across it.
  aerial_reception: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, M = mastTop(r);
      if (t < hitOf(r)) waves(M.x, M.y, t, toward(r));
      inbound(r, (u, E) => {
        let lx = r.from.x, ly = r.from.y;
        const n = Math.max(2, Math.round(8 * u)), dx = E.x - r.from.x, dy = E.y - r.from.y;
        for (let i = 1; i <= n; i++) { const v = u * i / n, j = i < n ? (hash(r.seed + i + (t >> 1) * 7) - 0.5) * 8 : 0, x = r.from.x + dx * v - dy / 60 * j, y = r.from.y + dy * v + dx / 60 * j; line(lx, ly, x, y, i === n ? W : AERIAL.blue); lx = x; ly = y; }
      });
      landed(r, (E, a) => { staticOn(E, still(a, 2), r.seed, fade(a, 12, 4)); if (a < 3) glint(E.x, E.y, AERIAL.blue); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Tune In: waves pulse off the mast and the band picks the rest: a long slow wave that flashes, short pulses over every foe, or a fast thin jag that seals the foe's voice.
  aerial_broadcast: {
    tail: 4, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, M = mastTop(r), band = r.plan.shape === 'spark' ? 1 : r.plan.shape === 'rune' ? 2 : 0, hit = hitOf(r), on = hold(t, leaveOf(r), hit + 12, 2);
      if (t < hit + 2) waves(M.x, M.y, t * (1 + band), toward(r));
      for (const E of r.to) {
        if (band === 0 && on > 0) { sing(M, E, 4, -t * 0.4, AERIAL.gold, on, 0.12); sing(M, E, 4, -t * 0.4 + Math.PI, AERIAL.blue, 0.75 * on, 0.12); }
        if (band === 1 && on > 0) for (let q = 0; q < 8; q++) { const u = ((q + (t >> 1)) % 8) / 8, p = lerp(M, E, u), b = lerp(M, E, Math.max(0, u - 0.03)); line(b.x, b.y, p.x, p.y, q % 2 ? AERIAL.gold : AERIAL.mast, on); }
      }
      if (band === 2) inbound(r, (u, E) => sing(M, lerp(M, E, u), 1.5, t, AERIAL.blue, 1, 1.2));
      landed(r, (E, a) => {
        const s = still(a, 2);
        if (band === 0) { ringOut(E.x, E.y, s, 12, 9, AERIAL.gold, 0.7); ringOut(E.x, E.y, s - 3, 12, 7, AERIAL.blue, 0.7); }
        else if (band === 1) { staticOn(E, s, r.seed, fade(a, 12, 4)); sparks(E.x, E.y, s, 6, AERIAL.mast, AERIAL.gold, r.seed, 7, 8); }
        else { const L = fade(a, r.end - hit, 6); arc(E.x, E.y + 1, 4, 3, AERIAL.gold, L); line(E.x - 3, E.y + 3, E.x + 3, E.y - 1, AERIAL.mast, L); }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Crosstalk: three signals weave across to the foe and tangle into a knot of static over its head, and its moves wait.
  aerial_interference: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, E2, i) => { const p = lerp(r.from, E2, u), dx = E2.x - r.from.x, dy = E2.y - r.from.y, d = Math.hypot(dx, dy) || 1, o = Math.sin(u * Math.PI * 4 + i * 2) * 4; glint(p.x - dy / d * o, p.y + dx / d * o, [AERIAL.blue, AERIAL.gold, AERIAL.mast][i % 3]); });
      if (n) { const L = hold(t, hitOf(r), r.end, 6); for (let q = 0; q < n * 2; q++) { const ph = q * 1.7 + t * 0.3, o = (q % 3) * 0.1; arc(E.x + Math.cos(ph) * 2, E.y - 7 + Math.sin(ph), 3, 2, q % 2 ? AERIAL.gold : AERIAL.blue, L, 0.5 + o, 1 + o); } }
      landed(r, (E2, a) => staticOn(E2, a, r.seed, fade(a, 8, 3)));
    },
  },

  // Dead Air: the field darkens, waves close in on the foe from all round, and the air over it goes flat: one still line and nothing else.
  aerial_longwave: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(AERIAL.dark, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, M = mastTop(r), E = aim(r), last = lastOf(r), a = t - last;
      if (t < leaveOf(r) + 4) waves(M.x, M.y, t, toward(r), 1, 4, 14);
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const rr = 16 - 13 * ease(aa / f.dur); arc(E.x, E.y, rr, rr * 0.7, f.i % 2 ? AERIAL.gold : AERIAL.blue, 1, f.i * 0.25, f.i * 0.25 + 0.3); }
      landed(r, (E2, aa) => { if (aa < 4) glint(E2.x, E2.y, AERIAL.mast, fade(aa, 4)); });
      if (a >= 0) { const L = fade(a, r.end - last, 6), n = Math.min(12, a * 3); line(E.x - n, E.y - 7, E.x + n, E.y - 7, AERIAL.mast, L); for (let q = 0; q < 2; q++) { px(E.x - n - 1 - q * 2, E.y - 7, AERIAL.gold, 0.5 * L); px(E.x + n + 1 + q * 2, E.y - 7, AERIAL.gold, 0.5 * L); } }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Kazeli (vane): the vane's arrow and the compass points

const VANE = { brass: '#bf9847', gold: '#f4d575', dark: '#4a4458', deep: '#1c1824' };
/** The vane's arrow centered on x, y pointing along `ang`: a white point with gold barbs, a brass shaft, and a fletched tail, `len` long. */
function vaneArrow(x: number, y: number, ang: number, len = 9, lv = 1): void {
  const ux = Math.cos(ang), uy = Math.sin(ang), h = len / 2, hx = x + ux * h, hy = y + uy * h, tx = x - ux * h, ty = y - uy * h;
  line(tx, ty, hx, hy, VANE.brass, lv);
  px(hx, hy, W, lv); px(hx - ux - uy, hy - uy + ux, VANE.gold, lv); px(hx - ux + uy, hy - uy - ux, VANE.gold, lv);
  for (const s of [-1, 1]) { px(tx - uy * s * 1.5, ty + ux * s * 1.5, VANE.gold, lv); px(tx + ux - uy * s * 1.5, ty + uy + ux * s * 1.5, VANE.gold, lv); }
}
/** The compass points turning: four arms rr long, the north arm gold. */
function compass(x: number, y: number, rr: number, turn: number, lv = 1): void {
  for (let q = 0; q < 4; q++) { const ang = turn + q * Math.PI / 2; line(x, y, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8, q ? VANE.brass : VANE.gold, lv); }
  px(x, y, W, lv);
}

const VANE_ART: Record<string, LegendArt> = {
  // Spin on Pin: the arrow whirls round Kazeli on its pin, and two cuts of it cross the foe one after the other.
  vane_spar: {
    tail: 4, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < hitOf(r) + 2) vaneArrow(U.x, U.y - 1, t * 0.9, 13);
      landed(r, (E, a) => { for (let q = 0; q < 2; q++) { const aa = still(a - q * 5, 1); if (aa < 0 || a - q * 5 >= 10) continue; const n = Math.min(1, (aa + 1) / 3), s = q ? -1 : 1; thick(E.x + s * 6, E.y - 6, E.x + s * 6 - s * 12 * n, E.y - 6 + 12 * n, VANE.gold, fade(a - q * 5, 10, 4), W); } });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 4, 1) || shake(a - 5, 4, 1) }; },
  },

  // Throw Arrow: Kazeli throws its arrow straight at the foe, it strikes with a gold cut, and it turns over and flies home.
  vane_jibe: {
    tail: 10, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit, U = userAt(r), E = aim(r), u = prog(a, 3, r.end - hit - 3);
      inbound(r, (v, E2) => { const p = lerp(r.from, E2, v); vaneArrow(p.x, p.y, Math.atan2(E2.y - r.from.y, E2.x - r.from.x), 9); tail(lerp(r.from, E2, Math.max(0, v - 0.1)), lerp(r.from, E2, Math.max(0, v - 0.18)), VANE.gold, VANE.brass, VANE.dark, 3); });
      landed(r, (E2, aa) => { const n = Math.min(1, (still(aa, 2) + 1) / 3); if (aa < 10) thick(E2.x + 6, E2.y - 6, E2.x + 6 - 12 * n, E2.y - 6 + 12 * n, VANE.gold, fade(aa, 10, 4), W); });
      if (u > 0 && u < 1) { const p = lobAt(E, U, u, 0.8); vaneArrow(p.x, p.y, Math.atan2(U.y - E.y, U.x - E.x) + u * 6.28, 9); }
      if (u >= 1 && t < r.end - 1) glint(U.x, U.y - 2, VANE.gold);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // After It: Kazeli dashes after its arrow, plucks it from the foe in three brass scrapes, and the foe reels under turning compass points.
  vane_halyard: {
    tail: 6, noLandings: true,
    front(r) {
      smear(r, VANE.gold, VANE.brass, 10);
      landed(r, (E, a) => {
        const s = still(a, 2), L = fade(a, 12, 4);
        for (let q = 0; q < 3; q++) { const aa = s - q; if (aa < 0 || L <= 0) continue; const n = Math.min(1, (aa + 1) / 3), x0 = E.x - 1 + q * 3; line(x0, E.y - 5, x0 - 5 * n, E.y - 5 + 10 * n, q === 1 ? W : VANE.gold, L); }
        if (a >= 4) compass(E.x, E.y - 8, 3, a * 0.2, fade(a - 4, r.end - hitOf(r) - 4, 5));
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Land Beside: compass points turn over the field, four arrows rain down on the foes, and Kazeli is ringed in gold as it mends its friend.
  vane_touchdown: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(VANE.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), B = perch(r.from), last = lastOf(r), a = t - last;
      compass(B.x, B.y, 6, t * 0.15, hold(t, 0, r.end, 6));
      inbound(r, (u, E, i) => { const x0 = E.x + (i - 1.5) * 4, y0 = E.y - (high(E) ? 14 : 26); vaneArrow(x0, y0 + (E.y - 2 - y0) * u * u, Math.PI / 2, 7); });
      landed(r, (E, aa, i) => { const x = E.x + ((i % 4) - 1.5) * 4; if (aa < 8) glint(x, E.y - 1, VANE.gold, fade(aa, 8)); if (aa < 14) vaneArrow(x, E.y - 3, Math.PI / 2, 7, fade(aa, 14)); });
      if (a >= 0) { arc(U.x, U.y + 4, 7, 2, VANE.gold, fade(a, r.end - last, 6)); mends(U, a, VANE.gold); }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Capkara (capsule): the two hull halves that shut like a clam

const CAPSULE = { hull: '#a29e96', window: '#abe0fd', blue: '#3a78b6', dark: '#20222a' };
/** The capsule's two hull halves round x, y, parted `gap` pixels each way and w wide: gray shells with blue rims and a lit window on top. */
function hull(x: number, y: number, w: number, gap: number, lv = 1): void {
  const h = Math.max(2, w * 0.6);
  arc(x, y - gap, w, h, CAPSULE.hull, lv, 0.5, 1); line(x - w, y - gap, x + w, y - gap, CAPSULE.blue, lv);
  arc(x, y + gap, w, h, CAPSULE.hull, lv, 0, 0.5); line(x - w, y + gap, x + w, y + gap, CAPSULE.blue, lv);
  px(x, y - gap - h + 1, CAPSULE.window, lv); px(x + 1, y - gap - h + 1, CAPSULE.window, lv);
}
/** A small capsule: a gray hull with a lit window over a blue heat shield. */
function pod(x: number, y: number, lv = 1): void { blit(['.hhh.', 'hwhhh', 'hhhhh', 'bbbbb'], x, y, { h: CAPSULE.hull, w: CAPSULE.window, b: CAPSULE.blue }, lv); }

const CAPSULE_ART: Record<string, LegendArt> = {
  // Hot Drop: a small capsule comes down on the foe trailing white-hot air, and it lands in a flash with sparks that keep burning.
  capsule_reentry: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u, 1.4); for (let k = 1; k < 7; k++) { const b = lobAt(r.from, E, Math.max(0, u - k * 0.03), 1.4); px(b.x, b.y, k < 2 ? W : k < 4 ? CAPSULE.window : CAPSULE.blue, k < 5 ? 1 : 0.5); } pod(p.x, p.y); });
      landed(r, (E, a) => {
        const s = still(a, 2);
        if (a < 2) oval(E.x, E.y, 3 - a, 2 - a, W, 1);
        ringOut(E.x, E.y + 2, s, 12, 9, CAPSULE.window, 0.5);
        for (let q = 0; q < 5; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 16) px(E.x - 6 + q * 3 + Math.sin(aa / 3), E.y + 3 - aa * 0.6, (aa + q) % 3 ? CAPSULE.window : W, fade(aa, 16)); }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Seal In: hull plates close in from all round on a friend's outline behind Capkara and lock into a capsule with its window lit.
  capsule_hullburst: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), P = { x: r.from.x - toward(r) * 12, y: r.from.y }, a = t - hit, u = ease(prog(t, leaveOf(r), hit));
      if (a < 2) for (let i = -3; i <= 3; i++) { px(P.x + i, P.y - 3, CAPSULE.window, 0.5); px(P.x + i, P.y + 3, CAPSULE.window, 0.5); px(P.x - 3, P.y + i, CAPSULE.window, 0.5); px(P.x + 3, P.y + i, CAPSULE.window, 0.5); }
      if (a < 0) { if (t >= leaveOf(r)) for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + t * 0.1, rr = 14 - 8 * u; line(P.x + Math.cos(ang) * rr, P.y + Math.sin(ang) * rr * 0.7, P.x + Math.cos(ang + 0.4) * rr, P.y + Math.sin(ang + 0.4) * rr * 0.7, CAPSULE.hull); } return; }
      hull(P.x, P.y, 6, Math.max(0, 2 - a), fade(a, r.end - hit, 6));
      if (a < 4) glint(P.x, P.y - 5, CAPSULE.window);
    },
  },

  // Clam Shut: the two halves of a capsule close on the ally like a clam and lock, and it glows pale blue inside as it mends.
  capsule_sealin: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], hit = hitOf(r), a = t - hit, go = leaveOf(r);
      if (t < go) return;
      const L = a < 0 ? 1 : fade(a, r.end - hit, 6);
      hull(A.x, A.y, 7, 4 + Math.round(8 * (1 - ease(prog(t, go, hit)))), L);
      if (a >= 0) { dither(A.x - 5, A.y - 3, 11, 7, CAPSULE.window, 0.25 * L); mends(A, a, CAPSULE.window); if (a < 3) line(A.x - 8, A.y, A.x + 8, A.y, W); }
    },
  },

  // Turn Them: three hull plates circle Capkara and fly to the foe, they lock into a ring round it that turns, and points close in on it from its own side.
  capsule_mutiny: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(CAPSULE.dark, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), n = r.hits.filter(h => t >= h.at).length, last = lastOf(r), a = t - last;
      for (const f of r.flights) {
        const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue;
        const u = aa / f.dur, a0 = f.i / f.n * Math.PI * 2, O = { x: U.x + Math.cos(a0) * 10, y: U.y + Math.sin(a0) * 5 };
        const p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 4 + a0) * 10, y: U.y + Math.sin(u / 0.6 * Math.PI * 4 + a0) * 5 } : lerp(O, E, (u - 0.6) / 0.4);
        blit(['hhh', 'bwb'], p.x, p.y, { h: CAPSULE.hull, b: CAPSULE.blue, w: CAPSULE.window });
      }
      if (n) { const L = hold(t, hitOf(r), r.end, 6); for (let q = 0; q < n; q++) { const g = t * 0.008 + q / 3; arc(E.x, E.y, 9, 7, CAPSULE.hull, L, g, g + 0.22); arc(E.x, E.y, 8, 6, CAPSULE.blue, L, g + 0.02, g + 0.2); } }
      if (a >= 0) { const L = fade(a, r.end - last, 6); for (let q = 0; q < 4; q++) { const ang = q * Math.PI / 2 + 0.78, d = 13 - Math.min(5, a * 0.5), x = E.x + Math.cos(ang) * d, y = E.y + Math.sin(ang) * d * 0.7; line(x, y, x - Math.cos(ang) * 3, y - Math.sin(ang) * 2, CAPSULE.window, L); px(x - Math.cos(ang) * 3, y - Math.sin(ang) * 2, W, L); } }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Imshin (booster): its exhaust plume and the stage it drops

const BOOSTER = { hull: '#81719e', white: '#f5f1f1', flame: '#f37533', gold: '#f8c080', smoke: '#3e3450' };
/** An exhaust plume from x, y along (ux, uy), `len` long: a white throat, gold, then orange that flickers, then lavender smoke. */
function plume(x: number, y: number, ux: number, uy: number, len: number, t: number, lv = 1): void {
  for (let i = 0; i < len; i++) {
    const w = Math.round(1 + i * 0.25 + ((t + i) & 1)), c = i < 2 ? W : i < len * 0.5 ? BOOSTER.gold : i < len * 0.8 ? BOOSTER.flame : BOOSTER.hull, cx = x + ux * i, cy = y + uy * i;
    for (let k = -w + 1; k < w; k++) px(cx - uy * k, cy + ux * k, c, lv * (i < len * 0.8 ? 1 : 0.5));
  }
}
/** The unit vector from the user toward its first target. */
const headOf = (r: FxRun): Pt => { const E = aim(r), d = Math.hypot(E.x - r.from.x, E.y - r.from.y) || 1; return { x: (E.x - r.from.x) / d, y: (E.y - r.from.y) / d }; };

const BOOSTER_ART: Record<string, LegendArt> = {
  // Thrust: Imshin fires and shoots at the foe on a plume of orange flame, and hits in a burst of sparks.
  booster_thrust: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), h = headOf(r);
      if (t < hitOf(r) + 3) plume(U.x - h.x * 4, U.y - h.y * 4, -h.x, -h.y, 9, t);
      landed(r, (E, a) => { sparks(E.x, E.y, still(a, 2), 9, BOOSTER.gold, BOOSTER.flame, r.seed, 10, 9); for (let q = 0; q < 4; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 14) px(E.x - 4 + q * 3, E.y + 2 - aa * 0.7, (aa + q) % 3 ? BOOSTER.flame : W, fade(aa, 14)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Spark Spray: Imshin sprays burning sparks out of its nozzle in a weaving stream, and they burst orange on the foe.
  booster_scatter: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), h = headOf(r);
      if (t >= leaveOf(r) - 2 && t < leaveOf(r) + 10) plume(U.x + h.x * 4, U.y + h.y * 4, h.x, h.y, 5, t);
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u), dx = E.x - r.from.x, dy = E.y - r.from.y, d = Math.hypot(dx, dy) || 1, o = Math.sin(u * Math.PI * 4 + i) * 4, q = { x: p.x - dy / d * o, y: p.y + dx / d * o }; px(q.x, q.y, W); px(q.x - h.x, q.y - h.y, BOOSTER.gold); px(q.x - 2 * h.x, q.y - 2 * h.y, BOOSTER.flame); px(q.x - 3 * h.x, q.y - 3 * h.y, BOOSTER.hull, 0.5); });
      landed(r, (E, a, i) => { sparks(E.x, E.y, still(a, i === 0 ? 2 : 0), 6, BOOSTER.gold, BOOSTER.flame, r.seed + i, 7, 8); if (a < 3) glint(E.x, E.y, BOOSTER.flame); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Drop Stage: Imshin drops a burning ring of its own stage, it lobs onto the foe, and the hot clamp sits round its feet, smoking.
  booster_fuelleak: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a) => arc(E.x, E.y + 5, 8, 2.5, BOOSTER.hull, fade(a, r.end - hitOf(r), 6), 0.5, 1)); },
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); arc(p.x, p.y, 4, 2, BOOSTER.white); arc(p.x, p.y + 1, 4, 2, BOOSTER.flame, 1, 0, 0.5); px(p.x, p.y - 3 - ((t >> 1) & 1), BOOSTER.flame); });
      landed(r, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 6);
        arc(E.x, E.y + 5, 8, 2.5, (a >> 2) & 1 ? BOOSTER.flame : BOOSTER.gold, L, 0, 0.5);
        sparks(E.x, E.y + 5, still(a, 2), 6, BOOSTER.gold, BOOSTER.flame, r.seed, 8, 8);
        for (let q = 0; q < 3; q++) puff(E.x - 6 + q * 6, E.y + 3, (a + q * 5) % 15, 15, BOOSTER.smoke, BOOSTER.hull, 2, 0.4);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Long Burn: Imshin lights up with its plume growing behind it, then flies at the foe as a streak with a long tail of flame, and bursts on it.
  booster_downrange: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { wash(BOOSTER.smoke, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), h = headOf(r);
      if (t < go) plume(U.x - h.x * 4, U.y - h.y * 4, -h.x, -h.y, Math.round(3 + 8 * prog(t, 0, go)), t);
      inbound(r, (u, E) => { const p = lerp(r.from, E, ease(u)); plume(p.x - h.x * 3, p.y - h.y * 3, -h.x, -h.y, 14, t); blit(['.ww.', 'whhw', '.ww.'], p.x, p.y, { w: BOOSTER.white, h: BOOSTER.hull }); });
      landed(r, (E, a) => {
        const s = still(a, 6);
        if (a < 2) oval(E.x, E.y, 4 - a * 2, 3 - a, W, 1);
        sparks(E.x, E.y, s, 12, BOOSTER.gold, BOOSTER.flame, r.seed, 15, 12);
        for (let q = 0; q < 3; q++) puff(E.x - 5 + q * 5, E.y, a - 4 - q * 2, 18, BOOSTER.smoke, BOOSTER.hull, 3, 0.3);
      });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
  },
};

// ---------------------------------------------------------------- Pasara (dish): the echo that comes back louder

const DISH = { white: '#dadee6', gold: '#d19a21', green: '#147e35', dark: '#0a2414' };
/** An echo: an arc rr across facing `dir`, white with a gold inner line. */
function echoArc(x: number, y: number, rr: number, dir: number, lv = 1): void {
  const a0 = dir > 0 ? -0.15 : 0.35, a1 = dir > 0 ? 0.15 : 0.65;
  arc(x, y, rr, rr, DISH.white, lv, a0, a1);
  if (rr > 2) arc(x, y, rr - 1, rr - 1, DISH.gold, 0.75 * lv, a0 + 0.02, a1 - 0.02);
}
/** Echoes coming back off a whorl toward U, a frames after: n arcs, each bigger than the last. */
function echoes(E: Pt, U: Pt, a: number, n: number, lv = 1): void {
  const dir = U.x >= E.x ? 1 : -1;
  for (let q = 0; q < n; q++) { const aa = a - q * 3; if (aa >= 0 && aa < 12) echoArc(E.x + dir * (2 + aa * 0.8), E.y, 2 + aa * 0.5 + q, dir, lv * fade(aa, 12)); }
}
/** A ping: a gold point in a white ring. */
function ping(x: number, y: number, lv = 1): void { arc(x, y, 2, 2, DISH.white, lv); px(x, y, DISH.gold, lv); }

const DISH_ART: Record<string, LegendArt> = {
  // Ping Back: a ping leaves the dish for the foe, and echoes of it come back off the foe, each bigger than the last.
  dish_downlink: {
    tail: 6, noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); tail(p, lerp(r.from, E, Math.max(0, u - 0.1)), DISH.gold, DISH.white, DISH.green, 3); ping(p.x, p.y); });
      landed(r, (E, a) => { echoes(E, r.from, still(a, 2), 3); if (a < 3) glint(E.x, E.y, DISH.gold); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Feedback: two rings weave over to the foe, and a ring round it comes again and again, each echo a beat behind, as its moves will.
  dish_sidelobe: {
    noFlights: true, noLandings: true,
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      inbound(r, (u, E2, i) => { const p = lerp(r.from, E2, u), dx = E2.x - r.from.x, dy = E2.y - r.from.y, d = Math.hypot(dx, dy) || 1, o = Math.sin(u * Math.PI * 4 + i) * 4; arc(p.x - dy / d * o, p.y + dx / d * o, 2 + ((r.t >> 2) & 1), 2, i ? DISH.gold : DISH.white); });
      if (a >= 0) for (let q = 0; q < 4; q++) { const aa = a - q * 5; if (aa < 0) continue; const k = aa % 20; arc(E.x, E.y, 3 + k * 0.5, 2 + k * 0.35, q % 2 ? DISH.gold : DISH.white, fade(a, r.end - hitOf(r), 6) * (1 - k / 20)); }
    },
  },

  // Say It Back: the dish throws a ping that catches the foe's last move and carries it home, and echoes ring off the dish as it takes it.
  dish_intercept: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), f = r.flights[0];
      for (const g of r.flights) {
        const a = t - g.t0; if (a < 0 || a >= g.dur) continue;
        const E = r.to[g.to] || r.to[0], half = g.dur / 2, back = a >= half, p = lerp(U, E, back ? 1 - ease((a - half) / half) : ease(a / half));
        ping(p.x, p.y);
        if (back) { glint(p.x, p.y - 3, DISH.gold); echoArc(p.x + (U.x > E.x ? -3 : 3), p.y, 3, U.x > E.x ? -1 : 1); }
      }
      landed(r, (E, a) => sparks(E.x, E.y, still(a, 2), 7, DISH.gold, DISH.white, r.seed, 8, 8));
      const a = f ? t - f.t0 - f.dur : -1;
      if (a >= 0 && a < 9) for (let q = 0; q < 3; q++) echoArc(U.x, U.y, 4 + q * 2, toward(r), fade(a, 9));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Loud Hail: the dish swells and says three things back, each a bigger ring than the last, and the last bursts over the foe in a white flash.
  dish_uplift: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(DISH.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), a = t - lastOf(r);
      if (t < leaveOf(r)) for (let q = 0; q < 3; q++) { const k = (t + q * 4) % 12; echoArc(U.x + dir * 2, U.y, 2 + k * 0.6, dir, 1 - k / 12); }
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u), rr = 3 + i * 2; echoArc(p.x, p.y, rr, dir); echoArc(p.x - dir * 2, p.y, rr - 1, dir, 0.5); });
      landed(r, (E, aa, i) => { ringOut(E.x, E.y, still(aa, i === 2 ? 6 : 1), 14, 7 + i * 3, i === 2 ? W : DISH.gold, 0.7); sparks(E.x, E.y, aa, 6 + i * 2, DISH.gold, DISH.white, r.seed + i, 7 + i * 3, 10); });
      if (a >= 6) circling(aim(r), a, 3, (x, y) => ping(x, y, fade(a, r.end - lastOf(r), 5)));
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Kuzumen (debris): red-hot hull scrap and the heat coming off it

const DEBRIS = { metal: '#65616b', hot: '#ec4e2e', white: '#dddde5', glow: '#f8a080', dark: '#24222a' };
const SCRAPS = [['mmw.', '.mmm', '..m.'], ['.mm', 'mmw', 'm..'], ['m.m', 'mmm', '.w.']];
/** A shard of hull scrap, its edge glowing when `hot`. */
function scrap(x: number, y: number, k: number, hot: boolean, lv = 1): void { blit(SCRAPS[k % 3], x, y, { m: hot && (k & 1) ? DEBRIS.hot : DEBRIS.metal, w: hot ? DEBRIS.glow : DEBRIS.white }, lv); }
/** Heat rising off a spot: short wavering strokes of red and pale that drift up and thin out. */
function shimmer(x: number, y: number, w: number, t: number, lv = 1): void {
  for (let q = 0; q < 4; q++) { const k = (t + q * 4) % 16, yy = y - k * 0.8, xx = x - w + q * (2 * w / 3); for (let i = 0; i < 3; i++) px(xx + i, yy + Math.round(Math.sin((t + i + q) / 2)), q % 2 ? DEBRIS.hot : DEBRIS.glow, lv * (1 - k / 16)); }
}
const HOOK = ['ww..', '.m..', '.m.h', '..mm'];

const DEBRIS_ART: Record<string, LegendArt> = {
  // Hot Sparks: heat shimmers off Kuzumen as it shakes, curls of red-hot swarf weave over to the foe, and each bursts in molten sparks.
  debris_swarf: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r) + 6) shimmer(U.x, U.y - 4, 4, t);
      inbound(r, (u, E, i) => {
        const p = lerp(r.from, E, u), dx = E.x - r.from.x, dy = E.y - r.from.y, d = Math.hypot(dx, dy) || 1, o = Math.sin(u * Math.PI * 4 + i) * 4, x = p.x - dy / d * o, y = p.y + dx / d * o;
        for (let k = 0; k < 5; k++) { const ang = k * 1.4 + t * 0.6; px(x + Math.cos(ang) * k * 0.7, y + Math.sin(ang) * k * 0.7, k ? (k < 3 ? DEBRIS.glow : DEBRIS.hot) : W); }
      });
      landed(r, (E, a, i) => sparks(E.x, E.y, still(a, 2), 7, DEBRIS.glow, DEBRIS.hot, r.seed + i, 8, 9));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Hull Hook: Kuzumen fires a hook of red-hot scrap on a chain, it bites into the foe, and molten metal runs off where the plating melts.
  debris_harpoon: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r), pal = { m: DEBRIS.metal, h: DEBRIS.hot, w: W };
      const chainTo = (p: Pt, lv: number): void => { const n = Math.hypot(p.x - U.x, p.y - U.y); for (let i = 0; i <= n; i += 2) { const q = lerp(U, p, i / Math.max(1, n)); px(q.x, q.y, (i >> 1) & 1 ? DEBRIS.metal : DEBRIS.white, 0.75 * lv); } };
      inbound(r, (u, E) => { const p = lerp(U, E, u); chainTo(p, 1); blit(HOOK, p.x, p.y, pal, 1, 1, E.x < U.x); });
      landed(r, (E, a) => {
        const L = fade(a, 14, 5);
        if (a < 6) chainTo(E, 1 - a / 6);
        blit(HOOK, E.x + (E.x < U.x ? 2 : -2), E.y, pal, L, 1, E.x < U.x);
        for (let q = 0; q < 3; q++) { const aa = a - 2 - q * 2; if (aa >= 0 && aa < 12) { px(E.x - 2 + q * 2, E.y + 1 + aa * 0.6, DEBRIS.hot, fade(aa, 12)); px(E.x - 2 + q * 2, E.y + aa * 0.6, DEBRIS.glow, fade(aa, 12)); } }
        sparks(E.x, E.y, still(a, 2), 5, DEBRIS.glow, DEBRIS.hot, r.seed, 6, 6);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Vent: Kuzumen vents its heat in a blast of steam that rolls over every foe as shimmer, and a plate of cooled hull closes over its front.
  debris_plating: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), U = userAt(r), a = t - hit, dir = toward(r);
      if (a < 0) { shimmer(U.x, U.y - 4, 5, t); return; }
      for (let q = 0; q < 6; q++) puff(U.x + Math.cos(q * 1.05) * (3 + a * 0.6), U.y + Math.sin(q * 1.05) * (2 + a * 0.4), a - (q & 1), 16, DEBRIS.white, DEBRIS.metal, 2, 0.3);
      landed(r, (E, aa) => { shimmer(E.x, E.y + 2, 5, t, fade(aa, 16)); sparks(E.x, E.y, still(aa, 2), 6, DEBRIS.glow, DEBRIS.hot, r.seed, 8, 8); });
      arc(U.x + dir * 2, U.y + 1, 7, 7, DEBRIS.metal, fade(a, r.end - hit, 6), dir > 0 ? -0.2 : 0.3, dir > 0 ? 0.2 : 0.7);
      arc(U.x + dir * 3, U.y + 1, 7, 7, DEBRIS.white, 0.5 * fade(a, r.end - hit, 6), dir > 0 ? -0.15 : 0.35, dir > 0 ? 0.15 : 0.65);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Low Pass: Kuzumen rises with heat shimmering off it, four burning scraps strafe low across the foes, and a line of fire is left on the ground.
  debris_strafe: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t;
      wash(DEBRIS.dark, 0.25 * hold(t, 0, r.end, 6));
      landed(r, (E, a, i) => { if (i % 4) return; const L = fade(a, r.end - hitOf(r), 6), n = Math.min(14, a * 2); for (let x = -n; x <= n; x++) if ((x + t) % 3) px(E.x + x, E.y + 5 - (((x + t) >> 1) & 1), (x + (t >> 1)) & 3 ? DEBRIS.hot : DEBRIS.glow, L); });
    },
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r)) shimmer(U.x, U.y - 4, 5, t);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y - 1 + Math.sin(Math.PI * u) * 2 + (f.i - 1.5) * 2;
        scrap(x, y, f.i, true); for (let k = 1; k < 5; k++) px(x - dir * k * 2, y, k < 2 ? DEBRIS.glow : DEBRIS.hot, k < 4 ? 1 : 0.5);
      }
      landed(r, (E, a, i) => sparks(E.x, E.y, still(a, i === 0 ? 5 : 0), 6, DEBRIS.glow, DEBRIS.hot, r.seed + i, 8, 8));
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 3) || shake(r.t - hitOf(r), 6, 2) }; },
  },
};

// ---------------------------------------------------------------- Bosshi (musk): the boss of its horns and frost gathering in flakes

const MUSK = { wool: '#5e483a', frost: '#c0e4f7', horn: '#bab09b', dark: '#2a2018', light: '#8a7060' };
/** Its horns: a tan hook curling down and out each side of x, y, `s` times size. */
function horns(x: number, y: number, s: number, lv = 1): void { blit(['hhh..hhh', 'h......h', 'h......h', '.h....h.'], x, y, { h: MUSK.horn }, lv, s); }
/** A six-point frost flake `rr` from its middle: pale blue arms with a white heart. */
function flake(x: number, y: number, rr: number, lv = 1): void {
  for (let q = 0; q < 3; q++) { const ang = q * Math.PI / 3; line(x - Math.cos(ang) * rr, y - Math.sin(ang) * rr, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, MUSK.frost, lv); }
  px(x, y, W, lv);
}
/** Flakes gathering on a whorl, `n` of them, growing over `g` from 0 to 1. */
function frostOn(E: Pt, n: number, g: number, lv = 1): void { for (let q = 0; q < n; q++) { const ang = q * 2.4 + 0.5, d = 4 + (q % 2) * 2; flake(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, 1 + Math.round(g * (q % 2 ? 1 : 2)), lv); } }

const MUSK_ART: Record<string, LegendArt> = {
  // Head Down: Bosshi charges horns first, its boss hooks up through the foe, and tufts of wool fly.
  musk_bowl: {
    tail: 6, noLandings: true,
    front(r) {
      const U = userAt(r);
      smear(r, MUSK.light, MUSK.wool, 10);
      if (r.t < hitOf(r) + 2) horns(U.x, U.y - 3, 1);
      landed(r, (E, a) => { const s = still(a, 2), L = fade(a, 12, 4), n = Math.min(1, (s + 1) / 3); arc(E.x - 3, E.y + 2, 5, 6, MUSK.horn, L, 0.6, 0.6 + 0.35 * n); arc(E.x + 3, E.y + 2, 5, 6, MUSK.horn, L, 0.9 - 0.35 * n, 0.9); chunks(E.x, E.y - 2, s, 5, MUSK.wool, MUSK.light, r.seed, 14, 1.2, 1.2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Snow Snort: Bosshi snorts, two plumes of frozen breath roll out over every foe, and frost flakes gather on them.
  musk_sweep: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      for (const E of r.to) for (let q = 0; q < 4; q++) { const u = prog(t, 1 + q, hit + q), p = lerp(U, E, u); if (u > 0 && u < 1) puff(p.x, p.y + (q & 1 ? 2 : -2), Math.round(u * 6), 12, W, MUSK.frost, 1.5 + u * 2, 0); }
      landed(r, (E, a) => { puff(E.x, E.y, a, 14, MUSK.frost, W, 4, 0.2); frostOn(E, 4, prog(a, 2, 10), fade(a, r.end - hit, 6)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Frozen Stiff: Bosshi stomps, frost cracks run under the foe, and ice stands up round it in crystals with flakes thick on it.
  musk_hardfreeze: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { const L = fade(a, 18, 6), n = Math.min(10, a * 2); for (const s of [-1, 1]) { line(E.x, E.y + 5, E.x + s * n, E.y + 5 + (n > 4 ? 1 : 0), MUSK.frost, L); line(E.x + s * n * 0.5, E.y + 5, E.x + s * n * 0.6, E.y + 7, W, L * 0.75); } }); },
    front(r) {
      landed(r, (E, a) => {
        const s = still(a, 3), L = fade(a, 18, 6), g = Math.min(1, s / 4);
        for (let q = 0; q < 4; q++) { const x = E.x - 6 + q * 4, h = Math.round((3 + (q % 2) * 3) * g); if (h > 0) { line(x, E.y + 4, x + (q < 2 ? -1 : 1), E.y + 4 - h, MUSK.frost, L); px(x + (q < 2 ? -1 : 1), E.y + 4 - h, W, L); } }
        frostOn(E, 5, g, L);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Ring the Herd: the herd stands up in a ring round Bosshi's side, horns out, and frost bursts over every foe.
  musk_corral: {
    lead: 10, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), up = ease(prog(t, 0, hitOf(r)));
      wash(MUSK.dark, 0.25 * L);
      for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.3, x = U.x + Math.cos(ang) * 13, y = U.y + 3 + Math.sin(ang) * 4; if (Math.sin(ang) > 0.1) continue; oval(x, y + 2 - 3 * up, 3, 2, MUSK.wool, L); horns(x, y - 1 - 3 * up, 0.5, L); }
    },
    front(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), up = ease(prog(t, 0, hitOf(r)));
      for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.3, x = U.x + Math.cos(ang) * 13, y = U.y + 3 + Math.sin(ang) * 4; if (Math.sin(ang) <= 0.1) continue; oval(x, y + 2 - 3 * up, 3, 2, MUSK.wool, L); arc(x, y + 2 - 3 * up, 3, 2, MUSK.light, L, 0.55, 0.95); horns(x, y - 1 - 3 * up, 0.5, L); }
      landed(r, (E, a) => { if (E.x === U.x && E.y === U.y) return; const s = still(a, 6); for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2, d = 2 + s * 0.9; if (s < 14) flake(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.7, 1, fade(s, 14)); } frostOn(E, 4, 1, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 12, 3) }; },
  },
};

// ---------------------------------------------------------------- Hyocies (serac): blocky glacier ice with blue crevasses and glare

const SERAC = { ice: '#bddded', white: '#f9fcff', deep: '#5a82b9', dark: '#1c2a44' };
/** A block of glacier ice w by h centered on x, y: pale ice with a white top edge, a deep blue crevasse, and a dark side. */
function iceBlock(x: number, y: number, w: number, h: number, lv = 1): void {
  x = Math.round(x - w / 2); y = Math.round(y - h / 2);
  dither(x, y, w, h, SERAC.ice, lv); line(x, y, x + w - 1, y, SERAC.white, lv); line(x + w - 1, y + 1, x + w - 1, y + h - 1, SERAC.deep, lv);
  if (w > 3 && h > 3) line(x + 1, y + h - 2, x + Math.min(w - 2, h - 1), y + 1, SERAC.deep, lv);
}

const SERAC_ART: Record<string, LegendArt> = {
  // Ice Spall: two slabs split off Hyocies and fly straight at the foe, and each breaks into blocky chips.
  serac_spall: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u); iceBlock(p.x, p.y + (i ? 2 : -2), 4, 3); tail(p, lerp(r.from, E, Math.max(0, u - 0.1)), SERAC.white, SERAC.ice, SERAC.deep, 4); });
      landed(r, (E, a, i) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 5; q++) { const vx = (q - 2) * 0.7, vy = -1.2 - hash(r.seed + q + i * 5) * 0.8; iceBlock(E.x + vx * s, E.y + vy * s + 0.12 * s * s, 2, 2, fade(s, 12)); } if (a < 2) glint(E.x, E.y, SERAC.white); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Glare Ice: a sheet of glare ice spreads under the foe in three steps, bright streaks slide across it, and it gleams.
  serac_icefloor: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      if (!n) return;
      const L = hold(t, hitOf(r), r.end, 6), w = 4 + n * 3;
      oval(E.x, E.y + 5, w, w * 0.25, SERAC.ice, L); arc(E.x, E.y + 5, w, w * 0.25, SERAC.white, L, 0.55, 0.95);
      for (let q = 0; q < 2; q++) { const k = (t + q * 9) % 18, x = E.x - w + k * (2 * w / 18); line(x, E.y + 5, x + 3, E.y + 4, W, L * (1 - k / 18)); }
    },
    front(r) {
      inbound(r, (u, E, i) => { const ang = i / 3 * Math.PI * 2 + 0.8, S = { x: E.x + Math.cos(ang) * 16, y: E.y + 5 + Math.sin(ang) * 6 }, p = lerp(S, { x: E.x, y: E.y + 5 }, ease(u)); iceBlock(p.x, p.y, 2, 2); px(p.x - 1, p.y - 1, W); });
      landed(r, (E, a, i) => { if (a < 6) glint(E.x - 4 + i * 4, E.y + 4, SERAC.white, fade(a, 6)); });
    },
  },

  // Frozen Boots: Hyocies sinks, and blocks of ice close over the foe's feet while spindrift blows past.
  serac_spindrift: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), a = t - hit, L = hold(t, 2, r.end, 5);
      for (let q = 0; q < 5; q++) { const k = (t * 2 + q * 7) % 24, x = E.x - 12 + k, y = E.y - 2 + q * 2; line(x, y, x + 2, y, q % 2 ? SERAC.white : SERAC.ice, L * (1 - k / 24)); }
      if (a >= 0) { const g = Math.min(1, (still(a, 2) + 1) / 3), Lb = fade(a, r.end - hit, 6); iceBlock(E.x - 3, E.y + 5 - 2 * g, 5, Math.round(1 + 3 * g), Lb); iceBlock(E.x + 3, E.y + 5 - 2 * g, 5, Math.round(1 + 3 * g), Lb); if (a < 3) glint(E.x, E.y + 3, SERAC.white); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Calving Face: a wall of glacier ice rises behind the foes and calves, five great blocks fall on them and shatter.
  serac_icefall: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), up = ease(prog(t, 0, 16));
      wash(SERAC.dark, 0.25 * L);
      for (const E of r.to) { const away = high(E) ? 1 : -1, h = Math.round(16 * up); for (let q = 0; q < 3; q++) iceBlock(E.x + away * (9 + q * 4), E.y + 5 - h / 2 + q * 2, 5, Math.max(1, h - q * 3), hold(t, 0, lastOf(r) + 4, 4)); }
    },
    front(r) {
      inbound(r, (u, E, i) => { const away = high(E) ? 1 : -1, S = { x: E.x + away * 10, y: E.y - 12 }, p = lerp(S, { x: E.x + (i - 2) * 3, y: E.y - 1 }, u * u); iceBlock(p.x, p.y, 5, 4); });
      landed(r, (E, a, i) => { const s = still(a, i === 0 ? 6 : 0); if (s < 14) for (let q = 0; q < 4; q++) { const vx = (q - 1.5) * 0.9, vy = -1.4 - hash(r.seed + q + i * 7) * 0.8; iceBlock(E.x + (i - 2) * 3 + vx * s, E.y + vy * s + 0.12 * s * s, 2, 2, fade(s, 14)); } });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(a, 6, 2), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Phoshi (selkie): the teal sea it dreams of, in curling waves

const SELKIE = { seal: '#7b8189', teal: '#5becdc', slate: '#465464', foam: '#c8f8f0', deep: '#1a2430' };
/** A wave's curl at x, y, w wide facing `dir`: a teal crest that tips over with foam on top. */
function curlWave(x: number, y: number, w: number, dir: number, lv = 1): void {
  arc(x, y, w, w * 0.8, SELKIE.teal, lv, dir > 0 ? 0.5 : 0.25, dir > 0 ? 1.0 : 0.75);
  arc(x - dir, y + 1, w - 1, (w - 1) * 0.8, SELKIE.slate, lv, dir > 0 ? 0.55 : 0.3, dir > 0 ? 0.95 : 0.7);
  px(x + dir * w, y, SELKIE.foam, lv); px(x, y - w * 0.8, SELKIE.foam, lv);
}

const SELKIE_ART: Record<string, LegendArt> = {
  // Undertow Mend: two curls of the sea roll over to the foe and break on it, and the backwash runs home to Phoshi's side as a mend.
  selkie_backwash: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), a = t - lastOf(r);
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u), o = Math.sin(u * Math.PI * 4 + i) * 3; curlWave(p.x, p.y + o, 3, dir); });
      landed(r, (E, aa, i) => { const s = still(aa, 2); if (s < 12) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.5, vy = -1.4 - hash(r.seed + q + i) * 0.7; px(E.x + vx * s, E.y + 2 + vy * s + 0.12 * s * s, q % 2 ? SELKIE.foam : SELKIE.teal, fade(s, 12)); } });
      if (a >= 0) { for (let q = 0; q < 3; q++) { const u = prog(a - q * 2, 0, 12); if (u > 0 && u < 1) { const p = lerp(aim(r), U, ease(u)); px(p.x, p.y + 4, SELKIE.teal); px(p.x + 1, p.y + 4, SELKIE.foam); } } mends(U, a - 8, SELKIE.teal); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Lullaby: the sea closes over the foe in a teal hush, its bubbles sinking instead of rising, and it settles into the dream.
  selkie_bubble: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), go = leaveOf(r), a = t - hitOf(r), L = hold(t, go, r.end, 6);
      if (t >= go) { const g = ease(prog(t, go, lastOf(r))); dither(E.x - 7, E.y - 6 + Math.round(12 * (1 - g)), 15, Math.round(12 * g), SELKIE.teal, 0.25 * L); curlWave(E.x, E.y - 6 + Math.round(12 * (1 - g)), 7, 1, L); }
      inbound(r, (u, E2, i) => { const x = E2.x - 4.5 + i * 3, y = E2.y - 6 + 10 * u; arc(x, y, 1, 1, SELKIE.foam); });
      if (a >= 0) for (let q = 0; q < 2; q++) { const k = (a + q * 8) % 16; arc(E.x + 4 + k * 0.3, E.y - 6 - k * 0.5, 1 + (k > 8 ? 1 : 0), 1, SELKIE.foam, fade(a, r.end - hitOf(r), 6) * (1 - k / 16)); }
    },
  },

  // Seal Bite: Phoshi slips at the foe on a streak of sea, gray jaws close on it, and the water splashes up.
  selkie_gift: {
    tail: 6, noLandings: true,
    front(r) {
      smear(r, SELKIE.teal, SELKIE.slate, 10);
      landed(r, (E, a) => {
        const s = still(a, 2), gap = Math.max(0, 5 - s * 1.6), L = fade(a, 12, 4);
        for (let i = -3; i <= 3; i++) { px(E.x + i, E.y - 2 - gap, i % 2 ? SELKIE.seal : W, L); px(E.x + i, E.y + 2 + gap, i % 2 ? SELKIE.seal : W, L); }
        if (s < 10) for (let q = 0; q < 5; q++) px(E.x + (q - 2) * 0.6 * s, E.y + 3 - 1.3 * s + 0.12 * s * s, q % 2 ? SELKIE.foam : SELKIE.teal, fade(s, 10));
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Seven Waves: seven curls of the sea sweep through the foes one after another, each bigger, and the seventh breaks white.
  selkie_seventh: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) { const L = hold(r.t, 0, r.end, 6); wash(SELKIE.deep, 0.25 * L); for (const E of r.to) bands(E.x - 14, 29, E.y + 5, [[SELKIE.foam, 1], [SELKIE.teal, 1], [SELKIE.slate, 2]], 0.5 * L); },
    front(r) {
      for (const f of r.flights) {
        const a = r.t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur;
        curlWave(E.x + dir * (44 * u - 20), E.y + 3, 2 + f.i * 0.7, dir, f.i === 6 ? 1 : 0.75 + f.i * 0.04);
      }
      landed(r, (E, a, i) => { if (i === r.hits.length - 1) { const s = still(a, 6); if (s < 14) for (let q = 0; q < 10; q++) { const vx = (q - 4.5) * 0.6, vy = -1.6 - hash(r.seed + q) * 0.8; px(E.x + vx * s, E.y + 3 + vy * s + 0.12 * s * s, q % 3 ? W : SELKIE.teal, fade(s, 14)); } } });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Rosmachi (walrus): its ivory tusks and the count of its blows

const WALRUS = { hide: '#9c654d', ivory: '#f1e7cd', navy: '#3d4d6c', dark: '#1c1a24' };
/** Two ivory tusks hanging from x, y, `len` long, a little apart. */
function tusks(x: number, y: number, len: number, lv = 1): void { for (const s of [-2, 2]) { line(x + s, y, x + s * 1.3, y + len, WALRUS.ivory, lv); px(x + s * 1.3, y + len, W, lv); } }
/** The count over Rosmachi: three pips, the first `n` lit ivory and the rest dark. */
function pips(x: number, y: number, n: number, lv = 1): void { for (let q = 0; q < 3; q++) { const c = q < n ? WALRUS.ivory : WALRUS.navy; px(x - 3 + q * 3, y, c, lv); px(x - 3 + q * 3, y - 1, c, lv); } }

const WALRUS_ART: Record<string, LegendArt> = {
  // Flipper Slap: Rosmachi slaps the foe with a broad flipper, the water flies, and a pip of its count lights over it.
  walrus_flipper: {
    tail: 6, noLandings: true,
    front(r) {
      const U = userAt(r), hit = hitOf(r), a = r.t - hit;
      smear(r, WALRUS.ivory, WALRUS.hide, 9);
      landed(r, (E, aa) => { const s = still(aa, 2), n = Math.min(1, (s + 1) / 3), L = fade(aa, 12, 4); thick(E.x - 6, E.y - 4, E.x - 6 + 12 * n, E.y - 1 + 2 * n, WALRUS.hide, L, WALRUS.ivory); if (s < 12) for (let q = 0; q < 6; q++) px(E.x + (q - 2.5) * 0.6 * s, E.y + 2 - 1.4 * s + 0.12 * s * s, q % 2 ? W : SELKIE.teal, fade(s, 12)); });
      if (a >= 0) pips(r.from.x, r.from.y - 8, 1, fade(a, r.end - hit, 5));
      else pips(U.x, U.y - 8, 0, 0.5);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Herd Roll: Rosmachi rolls into the foe with its herd tumbling in behind it, and the ground jumps.
  walrus_snowball: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { if (a < 14) for (let q = 0; q < 6; q++) px(E.x - 10 + q * 4, E.y + 5 - Math.max(0, Math.sin((a + q * 2) / 3)) * 2, q % 2 ? WALRUS.ivory : WALRUS.hide, fade(a, 14)); }); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), d = Math.hypot(E.x - r.from.x, E.y - r.from.y) || 1, ux = (E.x - r.from.x) / d, uy = (E.y - r.from.y) / d, moved = Math.hypot(U.x - r.from.x, U.y - r.from.y);
      if (moved > 3) for (let q = 1; q <= 3; q++) { const x = U.x - ux * q * 6, y = U.y - uy * q * 6 + 2; oval(x, y, 2.5, 2, WALRUS.hide, 1 - q * 0.2); px(x + ux * 2, y + 1, WALRUS.ivory, 1 - q * 0.2); px(x + Math.cos(t * 0.8 + q) * 2, y + Math.sin(t * 0.8 + q) * 1.5, WALRUS.ivory, 1 - q * 0.2); }
      landed(r, (E2, a) => { chunks(E2.x, E2.y + 4, still(a, 3), 6, WALRUS.ivory, SELKIE.foam, r.seed, 14, 1.5, 1.3); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 10, 2) }; },
  },

  // Tusk Gouge: Rosmachi stomps, a pair of great tusks drives down over the foe, and two gouges pin it where it stands.
  walrus_shardwall: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); for (const s of [-2, 2]) { line(E.x + s * 1.3, E.y + 5, E.x + s * 2.5, E.y + 7, WALRUS.navy, L); px(E.x + s * 1.3, E.y + 5, WALRUS.ivory, L); } }); },
    front(r) {
      inbound(r, (u, E) => tusks(E.x, E.y - 16 + 10 * u * u, 6));
      landed(r, (E, a) => { const s = still(a, 3), L = fade(a, 14, 5); tusks(E.x, E.y - 6 + Math.min(3, s), 8, L); chunks(E.x, E.y + 5, s, 5, WALRUS.ivory, WALRUS.navy, r.seed, 12, 1.2, 1.2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Tusk Down: the count lights one, two, three over Rosmachi, then two great tusks come down on the foe and the ground cracks.
  walrus_haymaker: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6);
      wash(WALRUS.dark, 0.25 * L);
      landed(r, (E, a) => { if (a < 20) { const n = Math.min(11, a * 3), L2 = fade(a, 20); line(E.x - n, E.y + 5, E.x + n, E.y + 5, WALRUS.ivory, L2); line(E.x - n + 2, E.y + 6, E.x + n - 2, E.y + 6, WALRUS.navy, L2); } });
    },
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 6);
      pips(U.x, U.y - 9, Math.min(3, 1 + Math.floor(t / 4)), L);
      inbound(r, (u, E, i) => tusks(E.x + (i ? 3 : -3), E.y - (high(E) ? 14 : 24) + (high(E) ? 10 : 20) * u * u, 9));
      landed(r, (E, a, i) => { const s = still(a, i ? 6 : 2), Lb = fade(a, 16, 5); tusks(E.x + (i ? 3 : -3), E.y - 6 + Math.min(3, s), 10, Lb); sparks(E.x, E.y, s, 8, W, WALRUS.ivory, r.seed + i, 10, 10); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 3) || shake(r.t - hitOf(r), 6, 1), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Gevuori (berg): the waterline, and the great mass of it under

const BERG = { white: '#eef6fd', cyan: '#57e8f7', blue: '#2f5ca3', deep: '#142848' };
/** The waterline from x0 to x1 at y: a flat cyan line with small ripples that move with t. */
function waterline(x0: number, x1: number, y: number, t: number, lv = 1): void { for (let x = x0; x <= x1; x++) px(x, y + (((x + (t >> 2)) % 6) === 0 ? -1 : 0), ((x + (t >> 1)) % 5) ? BERG.cyan : BERG.white, lv); }
/** The mass under the line: a wide wedge of ice w across at the top, h deep, its point down, deep blue with a pale edge. */
function underMass(x: number, y: number, w: number, h: number, lv = 1): void {
  for (let j = 0; j < h; j++) { const half = Math.round(w * (1 - j / h)); dither(x - half, y + j, 2 * half + 1, 1, BERG.blue, lv * 0.75); px(x - half, y + j, BERG.cyan, lv * 0.5); px(x + half, y + j, BERG.cyan, lv * 0.5); }
}

const BERG_ART: Record<string, LegendArt> = {
  // Scrape Hull: Gevuori runs into the foe low, and the jagged underside of it saws along the foe's lower edge in chips of ice.
  berg_bit: {
    tail: 6, noLandings: true,
    front(r) {
      smear(r, BERG.cyan, BERG.blue, 9);
      landed(r, (E, a) => { const s = still(a, 2), n = Math.min(1, (s + 1) / 4), L = fade(a, 14, 4); for (let i = 0; i <= 14 * n; i++) px(E.x - 7 + i, E.y + 3 - (i % 3 === 1 ? 2 : i % 3 === 2 ? 1 : 0), i < 2 ? W : BERG.cyan, L); chunks(E.x, E.y + 3, s, 5, BERG.white, BERG.cyan, r.seed, 12, 1.2, 1.1); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Ice Groan: Gevuori groans, and slow dark rings roll out along the ground under every foe and rock it to sleep.
  berg_groan: {
    tail: 6, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 3; q++) { const k = (t + q * 7) % 21; arc(r.from.x, r.from.y + 5, 3 + k * 1.2, 1 + k * 0.3, q % 2 ? BERG.blue : BERG.cyan, L * (1 - k / 21)); }
      landed(r, (E, a) => { for (let q = 0; q < 2; q++) ringOut(E.x, E.y + 5, a - q * 5, 14, 10, q ? BERG.blue : BERG.cyan, 0.3); });
    },
    front(r) { landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); line(E.x - 2, E.y - 6, E.x + 2, E.y - 6, BERG.white, L); line(E.x - 1, E.y - 5, E.x + 1, E.y - 5, BERG.cyan, L); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Undercut: a waterline opens under the foe, and a growler of ice comes up from the mass beneath and strikes it from below.
  berg_growler: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 2, r.end, 5); waterline(E.x - 12, E.x + 12, E.y + 5, t, L); underMass(E.x, E.y + 6, 10, 6, L); },
    front(r) {
      inbound(r, (u, E) => { const y = E.y + 8 - 12 * u; for (let k = 0; k < 4; k++) line(E.x - 3 + k, y + 4 - (k === 1 || k === 2 ? 3 : 0), E.x - 3 + k, y + 4, k === 1 ? BERG.white : BERG.cyan); });
      landed(r, (E, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.6, vy = -1.6 - hash(r.seed + q) * 0.8; iceBlock(E.x + vx * s, E.y + 2 + vy * s + 0.12 * s * s, 2, 2, fade(s, 12)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Capsize: a waterline runs across the field, the great mass under it rises under the foe and rolls over, and the sea breaks white.
  berg_capsize: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), a = t - hit, L = hold(t, 0, r.end, 6);
      wash(BERG.deep, 0.375 * L);
      waterline(0, 95, E.y + 5, t, L);
      const up = ease(prog(t, 6, hit)), roll = ease(prog(t, hit - 8, hit + 4));
      if (a < 6) { const h = Math.round(10 * (1 - 2 * roll)); if (h > 0) underMass(E.x, E.y + 6, 12, Math.round(h * (0.5 + up * 0.5)), L); else { for (let j = 0; j < -h; j++) { const half = Math.round(12 * (1 - j / -h)); dither(E.x - half, E.y + 4 - j, 2 * half + 1, 1, BERG.white, 0.75 * L); } } }
    },
    front(r) {
      const a = r.t - hitOf(r), E = aim(r);
      if (a >= 0) { const s = still(a, 6); if (s < 16) for (let q = 0; q < 12; q++) { const vx = (q - 5.5) * 0.6, vy = -1.8 - hash(r.seed + q) * 0.9; px(E.x + vx * s, E.y + 4 + vy * s + 0.12 * s * s, q % 3 ? W : BERG.cyan, fade(s, 16)); } }
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Sarkaku (narwhal): its spiral tusk and the sight line it lays

const NARWHAL = { gray: '#808e9e', ivory: '#f1e7cd', pale: '#a7c2d2', dark: '#1c2430' };
/** The spiral tusk from a to b: a line of ivory with gray twists along it and a white point. */
function tuskLine(a: Pt, b: Pt, lv = 1): void { const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y)); for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / Math.max(1, n)); px(p.x, p.y, i === n ? W : i % 3 === 0 ? NARWHAL.gray : NARWHAL.ivory, lv); } }
/** The sight line from a to b: pale dashes that run toward b, `n` of the way laid. */
function sight(a: Pt, b: Pt, n: number, t: number, lv = 1): void { const d = Math.hypot(b.x - a.x, b.y - a.y); for (let i = 0; i <= d * n; i += 1) if (((i + t) >> 1) % 3 === 0) { const p = lerp(a, b, i / Math.max(1, d)); px(p.x, p.y, NARWHAL.pale, lv); } }
/** A sighting ring on a whorl: a pale ring rr wide with four ticks. */
function reticle(E: Pt, rr: number, lv = 1): void { arc(E.x, E.y, rr, rr * 0.8, NARWHAL.pale, lv); for (let q = 0; q < 4; q++) { const ang = q * Math.PI / 2; line(E.x + Math.cos(ang) * (rr - 1), E.y + Math.sin(ang) * (rr - 1) * 0.8, E.x + Math.cos(ang) * (rr + 2), E.y + Math.sin(ang) * (rr + 2) * 0.8, NARWHAL.ivory, lv); } }

const NARWHAL_ART: Record<string, LegendArt> = {
  // Shard Fall: a sighting ring settles on the foe, and two ivory shards drop out of the sky onto it and burst.
  narwhal_lance: {
    noFlights: true, noLandings: true,
    front(r) {
      const E = aim(r), t = r.t;
      if (t < lastOf(r)) reticle(E, 8 - 4 * prog(t, 0, hitOf(r)), 0.75);
      inbound(r, (u, E2, i) => { const x = E2.x + (i ? 3 : -3), y = E2.y - (high(E2) ? 14 : 26) * (1 - u); tuskLine({ x, y: y - 6 }, { x, y }); });
      landed(r, (E2, a, i) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 5; q++) { const ang = q / 5 * Math.PI * 2 + i, d = 2 + s; px(E2.x + Math.cos(ang) * d, E2.y + Math.sin(ang) * d * 0.7, q % 2 ? NARWHAL.ivory : W, fade(s, 12)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Breach: Sarkaku breaches at the foe in a burst of sea, its tusk drives in, and the water falls back.
  narwhal_breach: {
    tail: 8, noLandings: true,
    front(r) {
      const U = userAt(r), E = aim(r), h = { x: (E.x - r.from.x), y: (E.y - r.from.y) }, d = Math.hypot(h.x, h.y) || 1;
      smear(r, NARWHAL.pale, NARWHAL.gray, 10);
      if (r.t < hitOf(r) + 4) tuskLine(U, { x: U.x + h.x / d * 8, y: U.y + h.y / d * 8 });
      landed(r, (E2, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 8; q++) { const vx = (q - 3.5) * 0.6, vy = -1.5 - hash(r.seed + q) * 0.8; px(E2.x + vx * s, E2.y + 3 + vy * s + 0.12 * s * s, q % 2 ? W : NARWHAL.pale, fade(s, 12)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Pod Dive: three small narwhals circle Sarkaku and dive one after another, each in a splash, and the pod's wake runs fast.
  narwhal_podrush: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const u = a / f.dur, ang = u * Math.PI * 3 + f.i * 2.1, rr = 11 - 4 * u, x = U.x + Math.cos(ang) * rr, y = U.y + 2 + Math.sin(ang) * rr * 0.4 + u * u * 4, dir = -Math.sin(ang) > 0 ? 1 : -1;
        oval(x, y, 2, 1, NARWHAL.gray); px(x + dir * 2, y, NARWHAL.pale); line(x + dir * 3, y, x + dir * 5, y - 1, NARWHAL.ivory);
      }
      landed(r, (_, a, i) => { const x = U.x - 6 + i * 6, s = a; if (s < 10) for (let q = 0; q < 5; q++) px(x + (q - 2) * 0.6 * s, U.y + 5 - 1.2 * s + 0.12 * s * s, q % 2 ? W : NARWHAL.pale, fade(s, 10)); });
      const a = t - lastOf(r); if (a >= 0) for (let q = 0; q < 3; q++) { const k = (a * 2 + q * 5) % 14; line(U.x - toward(r) * (6 + k), U.y + 5 - q, U.x - toward(r) * (9 + k), U.y + 5 - q, NARWHAL.pale, fade(a, r.end - lastOf(r), 5) * (1 - k / 14)); }
    },
  },

  // Tusk Line: Sarkaku lays its sight line on the foe a dash at a time while a ring closes on it, then the tusk fires down the line and the foe bursts white.
  narwhal_hornshot: {
    lead: 18, noFlights: true, noLandings: true,
    back(r) { wash(NARWHAL.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), hit = hitOf(r), a = t - hit;
      if (t < hit) { sight(U, E, prog(t, 0, 16), t); reticle(E, 10 - 6 * ease(prog(t, 0, go))); }
      inbound(r, (u) => tuskLine(lerp(U, E, Math.max(0, u - 0.35)), lerp(U, E, u)));
      if (a >= 0) { const s = still(a, 6), L = fade(a, 16, 6); if (a < 4) tuskLine(lerp(U, E, 0.6), E, 1 - a / 4); if (s < 14) for (let q = 0; q < 8; q++) { const ang = q / 8 * Math.PI * 2, d = 2 + s * 0.9; line(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.7, E.x + Math.cos(ang) * (d + 2), E.y + Math.sin(ang) * (d + 2) * 0.7, q % 2 ? NARWHAL.ivory : W, L); } }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 12, 3) }; },
  },
};

// ---------------------------------------------------------------- Puikria (rime): frost flowers, icicles, and a heart of frost

const RIME = { pale: '#e4eff8', blue: '#7bd0ec', deep: '#3a7aa8', dark: '#162430' };
/** A heart of frost, five wide: blue round a white heart. */
function frostHeart(x: number, y: number, lv = 1, s = 1): void { blit(['bb.bb', 'bwbwb', 'bwwwb', '.bwb.', '..b..'], x, y, { b: RIME.blue, w: W }, lv, s); }
/** A frost flower opening at x, y, `g` from 0 to 1: six pale petals round a blue heart. */
function frostFlower(x: number, y: number, g: number, lv = 1): void { const rr = 1 + 2.5 * g; for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2 + 0.26; line(x + Math.cos(ang), y + Math.sin(ang) * 0.8, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8, q % 2 ? RIME.pale : W, lv); } px(x, y, RIME.blue, lv); }
/** An icicle from x, y down `len`, pale with a blue edge and a white tip. */
function icicle(x: number, y: number, len: number, lv = 1): void { for (let k = 0; k < len; k++) { const w = k < len * 0.4 ? 1 : 0; px(x, y + k, k === len - 1 ? W : RIME.pale, lv); if (w) px(x + 1, y + k, RIME.blue, lv); } }

const RIME_ART: Record<string, LegendArt> = {
  // Frost Flower: frost petals spiral over to the foes and open into frost flowers on them.
  rime_petal: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u), rr = 5 * (1 - u), ang = u * Math.PI * 6 + i * 2; px(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.6, W); px(p.x + Math.cos(ang) * rr + 1, p.y + Math.sin(ang) * rr * 0.6, RIME.blue); });
      landed(r, (E, a, i) => { const x = E.x + ((i % 4) - 1.5) * 4, y = E.y - 3 + (i & 1) * 4; frostFlower(x, y, Math.min(1, a / 5), fade(a, r.end - r.hits[i].at, 6)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Frost Bitten: icicles close in on the foe and drive into the ground round its feet, frost creeps up it, and cold drips off.
  rime_grip: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), a = t - lastOf(r);
      inbound(r, (u, E2, i) => { const ang = i / 3 * Math.PI * 2 + 0.6, S = { x: E2.x + Math.cos(ang) * 16, y: E2.y - 10 + Math.sin(ang) * 6 }, p = lerp(S, { x: E2.x - 5 + i * 5, y: E2.y + 1 }, ease(u)); icicle(p.x, p.y - 3, 5); });
      landed(r, (E2, aa, i) => icicle(E2.x - 5 + i * 5, E2.y - 2 + Math.min(2, aa), 5, fade(aa, r.end - r.hits[i].at, 6)));
      if (a >= 0) { const L = fade(a, r.end - lastOf(r), 6); for (let q = 0; q < 3; q++) { const aa = (a + q * 4) % 12; px(E.x - 3 + q * 3, E.y + aa * 0.5, RIME.blue, L * (1 - aa / 12)); } dither(E.x - 4, E.y + 1, 9, 3, RIME.pale, 0.25 * L); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Chilly Kiss: three small frost hearts circle the ally and settle on it, and a pale heart stays over it, its first blow to soften.
  rime_bloom: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0];
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const u = a / f.dur, ang = u * Math.PI * 4 + f.i * 2.1, rr = 11 * (1 - u * 0.8); blit(['b.b', 'bwb', '.b.'], A.x + Math.cos(ang) * rr, A.y + Math.sin(ang) * rr * 0.55, { b: RIME.blue, w: W }); }
      const n = r.hits.filter(h => t >= h.at).length;
      if (n) frostHeart(A.x, A.y - 9, hold(t, hitOf(r), r.end, 6), n >= 3 ? 1 : 1);
      landed(r, (_, a, i) => { if (a < 6) glint(A.x - 4 + i * 4, A.y - 2, RIME.pale, fade(a, 6)); });
    },
  },

  // Kind Winter: snow comes down gently over the foes in great six-point flakes, each opening a frost flower where it lands, and frost lies over all.
  rime_field: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6);
      wash(RIME.dark, 0.25 * L);
      for (let q = 0; q < 12; q++) { const x = (q * 8 + 4 + Math.sin((t + q * 5) / 6) * 2) % 96, y = (t * 0.5 + q * 13) % 60; px(x, y, q % 3 ? RIME.pale : W, 0.75 * L); }
      landed(r, (E, a) => bands(E.x - 12, 25, E.y + 5, [[RIME.pale, 1], [RIME.blue, 1]], 0.5 * fade(a, r.end - hitOf(r), 6)));
    },
    front(r) {
      inbound(r, (u, E, i) => { const x = E.x + (i - 2) * 4 + Math.sin(u * 6 + i) * 2, y = E.y - (high(E) ? 14 : 24) * (1 - u); flake(x, y, 2); });
      landed(r, (E, a, i) => frostFlower(E.x + (i - 2) * 4, E.y + 1 - (i & 1) * 4, Math.min(1, a / 5), fade(a, r.end - r.hits[i].at, 6)));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 2) }; },
  },
};

// ---------------------------------------------------------------- Ruokme (auk): skid tracks on the ice and the chevrons of its Momentum

const AUK = { dark: '#44404e', orange: '#d48d28', white: '#e9ebef', ice: '#b8d8f0' };
/** Two skid tracks behind the user from where it started to where it is, white with orange flecks. */
function skid(a: Pt, b: Pt, lv = 1): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  for (let i = 0; i <= d; i++) { const p = lerp(a, b, i / Math.max(1, d)); px(p.x, p.y + 3, i % 7 === 3 ? AUK.orange : AUK.white, lv); px(p.x, p.y + 5, i % 7 === 0 ? AUK.orange : AUK.ice, lv); }
}
/** Momentum: `n` orange chevrons in a row behind x, y, pointing `dir`. */
function chevrons(x: number, y: number, dir: number, n: number, lv = 1): void { for (let q = 0; q < n; q++) { const cx = x - dir * q * 3; px(cx - dir, y - 1, AUK.orange, lv); px(cx, y, AUK.orange, lv); px(cx - dir, y + 1, AUK.orange, lv); } }

const AUK_ART: Record<string, LegendArt> = {
  // Wing Slaps: Ruokme slides in and slaps the foe three times with its wings, left, right, left.
  auk_flurry: {
    tail: 8, noLandings: true,
    front(r) {
      smear(r, AUK.white, AUK.dark, 9);
      landed(r, (E, a) => { for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa < 0 || aa >= 6) continue; const s = q % 2 ? 1 : -1; arc(E.x + s * 3, E.y, 5, 4, q === 1 ? W : AUK.white, fade(aa, 6, 3), s > 0 ? 0.6 : 0.15, s > 0 ? 0.85 : 0.4); arc(E.x + s * 4, E.y, 5, 4, AUK.dark, fade(aa, 6, 3), s > 0 ? 0.62 : 0.17, s > 0 ? 0.83 : 0.38); } });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 3, 1) || shake(a - 6, 4, 1) }; },
  },

  // Crash Landing: Ruokme hops and comes down belly first, slush bursts over every foe, and a pale shield stands round it.
  auk_carom: {
    noLandings: true,
    front(r) {
      const U = r.from, hit = hitOf(r);
      landed(r, (E, a) => { const s = still(a, 2); if (s < 14) for (let q = 0; q < 8; q++) { const vx = (q - 3.5) * 0.6, vy = -1.5 - hash(r.seed + q) * 0.8; px(E.x + vx * s, E.y + 3 + vy * s + 0.12 * s * s, q % 3 ? AUK.ice : W, fade(s, 14)); } puff(E.x, E.y + 3, a, 14, AUK.white, AUK.ice, 3, 0.15); });
      const a = r.t - hit; if (a >= 0) { puff(U.x, U.y + 4, a, 12, AUK.white, AUK.ice, 3, 0.1); arc(U.x, U.y + 1, 7, 6, AUK.ice, fade(a, r.end - hit, 6), 0.5, 1); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Belly Slide: Ruokme slides at the foe on its belly, leaving two long skid tracks, bursts snow off it, and a chevron of Momentum lights.
  auk_bellyflop: {
    noLandings: true,
    back(r) { const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 6); skid(r.from, t < hitOf(r) ? U : aim(r), L); },
    front(r) {
      const dir = toward(r), hit = hitOf(r), a = r.t - hit;
      landed(r, (E, aa) => puff(E.x, E.y + 2, aa, 14, AUK.white, AUK.ice, 4, 0.2));
      if (a >= 0) chevrons(r.from.x - dir * 2, r.from.y - 8, dir, 1, fade(a, r.end - hit, 6));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Ice Slide: three chevrons of Momentum build behind Ruokme, it slides the length of the field on its tracks, and crashes into the foe in a spray of ice.
  auk_toboggan: {
    lead: 10, noLandings: true,
    back(r) { const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 6); wash(AUK.dark, 0.25 * L); if (t >= 10) skid(r.from, t < hitOf(r) ? U : aim(r), L); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), hit = hitOf(r), a = t - hit;
      if (t < hit) chevrons(U.x - dir * 6, U.y, dir, Math.min(3, 1 + Math.floor(t / 4)));
      landed(r, (E, aa) => { const s = still(aa, 6); if (s < 16) for (let q = 0; q < 12; q++) { const vx = (q - 5.5) * 0.7, vy = -1.6 - hash(r.seed + q) * 0.9; px(E.x + vx * s, E.y + 2 + vy * s + 0.12 * s * s, q % 3 ? AUK.ice : W, fade(s, 16)); } frostOn(E, 3, 1, fade(aa, r.end - hit, 6)); });
      if (a >= 0) chevrons(r.from.x - dir * 2, r.from.y - 8, dir, 3, fade(a, r.end - hit, 6));
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Losari (cuirass): dents in its plate and the rivets along it

const CUIRASS = { steel: '#717b8b', bright: '#e6ecf2', dark: '#433f50', deep: '#1c1a24' };
/** A dent in a plate: a dark crescent above and a bright one below, rr across. */
function dent(x: number, y: number, rr: number, lv = 1): void { arc(x, y, rr, rr * 0.8, CUIRASS.dark, lv, 0.5, 1); arc(x, y, rr, rr * 0.8, CUIRASS.bright, lv, 0.05, 0.45); }
/** A saw edge from a to b: a zigzag of bright steel with dark roots, `n` of the way laid. */
function sawEdge(a: Pt, b: Pt, n: number, lv = 1): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d, m = Math.round(d * n);
  for (let i = 0; i <= m; i++) { const p = lerp(a, b, i / d), o = (i % 4 < 2 ? i % 2 : 2 - (i % 2)) * 1.5; px(p.x + nx * o, p.y + ny * o, o > 1 ? W : CUIRASS.bright, lv); px(p.x - nx, p.y - ny, CUIRASS.dark, lv); }
}

const CUIRASS_ART: Record<string, LegendArt> = {
  // Strap Whirl: Losari spins with its straps whirling round it, and a strap studded with rivets lashes across every foe.
  cuirass_rivet: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit + 2) for (let q = 0; q < 2; q++) { const g = t * 0.12 + q * 0.5; arc(U.x, U.y + 1, 8, 4, CUIRASS.steel, 1, g, g + 0.3); px(U.x + Math.cos((g + 0.3) * 6.283) * 8, U.y + 1 + Math.sin((g + 0.3) * 6.283) * 4, CUIRASS.bright); }
      landed(r, (E, a) => { const s = still(a, 2), n = Math.min(1, (s + 1) / 3), L = fade(a, 12, 4); arc(E.x, E.y - 1, 8, 5, CUIRASS.steel, L, 0.55, 0.55 + 0.4 * n); for (let q = 0; q < 4; q++) { const g = (0.58 + q * 0.1) * 6.283; if (q / 4 < n) px(E.x + Math.cos(g) * 8, E.y - 1 + Math.sin(g) * 5, W, L); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Hammer Out: Losari stomps, the dents round it pop out all at once as steel rings, and the force shatters off the foe in chips of plate.
  cuirass_platespin: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), a = t - hit;
      if (a < 0) for (let q = 0; q < 4; q++) { const g = q / 4 * Math.PI * 2 + 0.4; dent(U.x + Math.cos(g) * 6, U.y + Math.sin(g) * 4, 1.5); }
      else for (let q = 0; q < 4; q++) { const g = q / 4 * Math.PI * 2 + 0.4; ringOut(U.x + Math.cos(g) * 6, U.y + Math.sin(g) * 4, a, 8, 4, CUIRASS.bright); }
      landed(r, (E, aa) => { const s = still(aa, 3); for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2, d = 2 + s; if (s < 12) { px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, q % 2 ? CUIRASS.steel : W, fade(s, 12)); px(E.x + Math.cos(g) * (d + 1), E.y + Math.sin(g) * (d + 1) * 0.8, CUIRASS.dark, fade(s, 12)); } } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 2) }; },
  },

  // Take Dents: four blows land round Losari one after another, each leaving a dent, and a bright line of burnish runs across it.
  cuirass_burnish: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 5), hit = hitOf(r);
      for (let q = 0; q < 4; q++) { const at = 1 + q * 2, a = t - at, g = q * 1.7 + 0.8, x = U.x + Math.cos(g) * 4, y = U.y + Math.sin(g) * 3; if (a < 0) continue; if (a < 3) glint(x, y, CUIRASS.bright); else dent(x, y, 1.5, L); }
      const a = t - hit; if (a >= 0 && a < 10) line(U.x - 6 + a, U.y - 4, U.x - 3 + a, U.y + 4, W, fade(a, 10));
      if (a >= 0) mends(U, a, CUIRASS.bright);
    },
  },

  // Saw Edge: Losari's dents rise into a saw edge round it, and it runs at the foe and cuts it with the teeth of its own dents.
  cuirass_hammerout: {
    lead: 12, noLandings: true,
    back(r) { wash(CUIRASS.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit) { const g = ease(prog(t, 0, 12)); sawEdge({ x: U.x - 7, y: U.y - 6 }, { x: U.x + 7, y: U.y - 6 }, g, 1); }
      smear(r, CUIRASS.bright, CUIRASS.steel, 12);
      landed(r, (E, a) => { const s = still(a, 6), n = Math.min(1, (s + 1) / 4), L = fade(a, 16, 5); sawEdge({ x: E.x - 9, y: E.y - 6 }, { x: E.x + 9, y: E.y + 5 }, n, L); sawEdge({ x: E.x + 9, y: E.y - 6 }, { x: E.x - 9, y: E.y + 5 }, Math.max(0, n * 1.3 - 0.3), L); sparks(E.x, E.y, s, 8, W, CUIRASS.bright, r.seed, 10, 10); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Hatari (pennon): its red banner and the snap of it in the wind

const PENNON = { pole: '#54443a', gold: '#fbdc7c', red: '#c13142', dark: '#3a0e14', deep: '#1c1414' };
/** The banner w by h hung from a pole top at x, y, flying toward `dir`: red with a gold edge, rippling with t. */
function banner(x: number, y: number, w: number, h: number, dir: number, t: number, lv = 1): void {
  for (let i = 0; i < w; i++) { const o = Math.round(Math.sin(i * 0.8 - t * 0.5) * (i / w) * 1.5), cx = x + dir * (i + 1); for (let j = 0; j < h; j++) px(cx, y + j + o, j === 0 || j === h - 1 || i === w - 1 ? PENNON.gold : PENNON.red, lv); }
  line(x, y - 1, x, y + h + 4, PENNON.pole, lv); px(x, y - 2, PENNON.gold, lv);
}
/** A snap of wind at x, y, a frames after: a gold zigzag crack that flashes and thins. */
function snapMark(x: number, y: number, a: number, s = 1): void { if (a < 0 || a >= 6) return; const L = fade(a, 6, 3); line(x - 3 * s, y - 2 * s, x, y, a < 2 ? W : PENNON.gold, L); line(x, y, x - 1 * s, y + 2 * s, PENNON.gold, L); line(x - 1 * s, y + 2 * s, x + 3 * s, y + 3 * s, a < 2 ? W : PENNON.gold, L); }

const PENNON_ART: Record<string, LegendArt> = {
  // Wind Crack: Hatari's banner snaps, and three cracks of wind whip through every foe as red ribbons.
  pennon_snap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < 8) snapMark(U.x + toward(r) * 5, U.y - 6, t - 2);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y - 3 + f.i * 3;
        for (let k = 0; k < 6; k++) px(x - dir * k, y + Math.round(Math.sin((k + t) * 0.9)), k < 2 ? PENNON.gold : PENNON.red, k < 5 ? 1 : 0.5);
      }
      landed(r, (E, a, i) => snapMark(E.x + 2, E.y - 2 + (i % 3) * 3, a));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Guy Rope: a guy rope shoots out from Hatari's pole and loops the foe, and a stake drives it down to the ground.
  pennon_rally: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r), top = { x: U.x, y: U.y - 6 };
      inbound(r, (u, E) => { const p = lerp(top, E, u), n = Math.round(Math.hypot(p.x - top.x, p.y - top.y)); for (let i = 0; i <= n; i++) { const q = sagAt(top, p, i / Math.max(1, n), 3 * u); px(q.x, q.y, i % 4 ? PENNON.pole : PENNON.gold); } px(p.x, p.y, W); });
      landed(r, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 6), stake = { x: E.x + (E.x > U.x ? 7 : -7), y: E.y + 5 };
        arc(E.x, E.y, 5, 3, PENNON.gold, L); line(E.x + (E.x > U.x ? 5 : -5), E.y, stake.x, stake.y - 1, PENNON.pole, L);
        line(stake.x, stake.y - 3 + Math.min(3, a), stake.x, stake.y, PENNON.gold, L); px(stake.x, stake.y - 4 + Math.min(3, a), W, L);
        if (a < 6) snapMark(E.x, E.y - 3, a);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Plant Pole: Hatari stomps its pole into the ground by its ally, the banner runs up and flies, and a gold edge stands round the ally.
  pennon_plant: {
    noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], hit = hitOf(r), a = t - hit, dir = toward(r), P = { x: A.x - dir * 7, y: A.y - 8 };
      if (a < 0) return;
      const L = fade(a, r.end - hit, 6), up = ease(prog(a, 0, 6));
      banner(P.x, P.y + Math.round(4 * (1 - up)), 5, 3, dir, t, L);
      arc(A.x, A.y + 1, 7, 6, PENNON.gold, L, 0.5, 1); if (a < 6) snapMark(P.x + dir * 4, P.y - 2, a);
    },
  },

  // Snap Out: a great banner unfurls behind Hatari and snaps, four gold stars circle it and burst in a white flash.
  pennon_unfurl: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), dir = toward(r), w = Math.round(4 + 8 * ease(prog(t, 0, 14)));
      wash(PENNON.deep, 0.25 * L);
      banner(U.x - dir * 3, U.y - (high(U) ? 8 : 14), w, high(U) ? 5 : 7, dir, t, L);
    },
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = a / f.dur * Math.PI * 4 + f.i * Math.PI / 2, rr = 11 - 4 * a / f.dur; glint(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, PENNON.gold); }
      landed(r, (_, a, i) => { snapMark(U.x + (i - 1.5) * 4, U.y - 8, a); if (i === r.hits.length - 1) sparks(U.x, U.y, still(a, 5), 10, PENNON.gold, PENNON.red, r.seed, 12, 12); });
    },
  },
};

// ---------------------------------------------------------------- Glakago (tang): the keen edge and the spinning grip

const TANG = { steel: '#bdc5d1', red: '#cb1d27', gold: '#ca9415', dark: '#1e1c24' };
/** A keen cut from (x0, y0) to (x1, y1), `n` of the way: a white edge with steel beside it and a red line under. */
function keenCut(x0: number, y0: number, x1: number, y1: number, n: number, lv = 1): void {
  const x2 = x0 + (x1 - x0) * n, y2 = y0 + (y1 - y0) * n;
  line(x0, y0, x2, y2, W, lv); line(x0 + 1, y0, x2 + 1, y2, TANG.steel, lv); line(x0, y0 + 1, x2, y2 + 1, TANG.red, 0.75 * lv);
}
/** The grip turned to `ang`: a gold crossguard across a red grip with a gold pommel. */
function grip(x: number, y: number, ang: number, lv = 1): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  line(x - c * 4, y - s * 4, x + c * 4, y + s * 4, TANG.gold, lv);
  line(x + s * 1, y - c * 1, x - s * 4, y + c * 4, TANG.red, lv); px(x - s * 5, y + c * 5, TANG.gold, lv);
  line(x + s * 2, y - c * 2, x + s * 6, y - c * 6, TANG.steel, lv);
}

const TANG_ART: Record<string, LegendArt> = {
  // Pommel Chip: Glakago knocks the foe with its gold pommel, and a chip flies with a bright ring.
  tang_chip: {
    noLandings: true,
    front(r) {
      smear(r, TANG.steel, TANG.gold, 9);
      landed(r, (E, a) => { const s = still(a, 2); if (a < 3) blit(['.gg.', 'gwgg', 'gggg', '.gg.'], E.x - 2, E.y, { g: TANG.gold, w: W }); ringOut(E.x, E.y, s, 10, 7, TANG.steel, 0.8); chunks(E.x, E.y + 2, s, 4, TANG.steel, TANG.gold, r.seed, 12, 1.2, 1.2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Grip Spin: Glakago spins on its grip, three bright blades circle it and fly, and each cuts across a foe.
  tang_spin: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r) + 10) grip(U.x, U.y - 1, t * 0.7, hold(t, 0, leaveOf(r) + 10, 3));
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], u = a / f.dur, a0 = f.i / f.n * Math.PI * 2, O = { x: U.x + Math.cos(a0) * 9, y: U.y + Math.sin(a0) * 5 };
        const p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 4 + a0) * 9, y: U.y + Math.sin(u / 0.6 * Math.PI * 4 + a0) * 5 } : lerp(O, E, (u - 0.6) / 0.4), g = t * 0.9 + f.i;
        line(p.x - Math.cos(g) * 2, p.y - Math.sin(g) * 2, p.x + Math.cos(g) * 2, p.y + Math.sin(g) * 2, W); px(p.x - Math.cos(g) * 3, p.y - Math.sin(g) * 3, TANG.red);
      }
      landed(r, (E, a, i) => { const s = still(a, 1), n = Math.min(1, (s + 1) / 3), k = i % 2 ? 1 : -1; if (a < 10) keenCut(E.x + k * 6, E.y - 5 + i, E.x - k * 6, E.y + 4 + i, n, fade(a, 10, 4)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Hand Over: a whetstone runs along an edge beside the ally in a spray of sparks, and the keen edge glints on it.
  tang_scabbard: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], U = userAt(r), dir = toward(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur / 2) continue; const p = lerp(U, { x: A.x + dir * 7, y: A.y - 3 }, ease(a / (f.dur / 2))); grip(p.x, p.y, -Math.PI / 2 * dir + a * 0.5); }
      landed(r, (_, a) => {
        const L = fade(a, r.end - hitOf(r), 6), x0 = A.x + dir * 7, y0 = A.y - 7;
        line(x0, y0, x0, y0 + 9, TANG.steel, L); px(x0, y0, W, L); line(x0 - 2, y0 + 9, x0 + 2, y0 + 9, TANG.gold, L);
        if (a < 14) { const y = y0 + (a % 7) * 1.2; dither(x0 - dir * 3, y, 2, 2, '#8a8a90', L); sparks(x0, y, a % 7, 4, W, TANG.gold, r.seed + (a / 7 | 0), 4, 7); }
        else glint(x0, y0 + ((a >> 1) % 9), TANG.steel, L);
      });
    },
  },

  // Thousand Cuts: Glakago blinks out, and six keen cuts cross the foe two frames apart, every third flying on to the reserve behind.
  tang_cuts: {
    lead: 10, noLandings: true,
    back(r) { wash(TANG.dark, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r);
      if (t < 10) for (let q = 0; q < 3; q++) glint(U.x + Math.cos(t * 0.6 + q * 2) * 7, U.y + Math.sin(t * 0.6 + q * 2) * 4, TANG.steel, 0.75);
      landed(r, (E, a) => {
        for (let q = 0; q < 6; q++) {
          const aa = a - q * 2; if (aa < 0 || aa >= 8) continue;
          const n = Math.min(1, (aa + 1) / 2), ang = q * 1.05 + 0.3, c = Math.cos(ang) * 7, s = Math.sin(ang) * 6, o = q % 3 === 2 ? dir * 12 : 0;
          keenCut(E.x + o - c, E.y - s, E.x + o + c, E.y + s, n, fade(aa, 8, 3));
        }
      });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 2) || shake(a - 10, 4, 3) }; },
  },
};

// ---------------------------------------------------------------- Scutate (buckler): the round shield and the tally of blows it took

const BUCKLER = { bronze: '#c38c43', red: '#c11b24', leather: '#5a3a28', dark: '#24160e' };
/** The round shield at x, y, rr across, turned edge-on by `flat` (1 face on, 0 edge on): leather inside a red ring and a bronze rim round a boss. */
function shieldDisc(x: number, y: number, rr: number, flat: number, lv = 1): void {
  const rx = Math.max(1, rr * flat);
  oval(x, y, rx, rr, BUCKLER.leather, lv); arc(x, y, rx, rr, BUCKLER.bronze, lv); if (rr > 3) arc(x, y, rx * 0.65, rr * 0.65, BUCKLER.red, lv);
  px(x, y, W, lv); px(x + (flat > 0.5 ? 1 : 0), y, BUCKLER.bronze, lv);
}
/** Tally marks of blows taken: red strokes, every fifth crossing the four before it. */
function tallies(x: number, y: number, n: number, lv = 1): void { for (let q = 0; q < n; q++) { const g = Math.floor(q / 5), k = q % 5, bx = x + g * 7; if (k < 4) line(bx + k * 1.5, y - 2, bx + k * 1.5, y + 2, BUCKLER.red, lv); else line(bx - 1, y + 2, bx + 6, y - 2, W, lv); } }

const BUCKLER_ART: Record<string, LegendArt> = {
  // Rim Throw: Scutate spins and throws itself rim first, the shield turns as it flies, rings off the foe, and comes back.
  buckler_rim: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], half = f.dur / 2, v = a < half ? ease(a / half) : 1 - ease((a - half) / half), p = lerp(U, E, v); shieldDisc(p.x, p.y - Math.sin(Math.PI * a / f.dur) * 3, 4, Math.abs(Math.cos(t * 0.6))); }
      landed(r, (E, a) => { ringOut(E.x, E.y, still(a, 2), 12, 8, BUCKLER.bronze, 0.75); sparks(E.x, E.y, still(a, 2), 6, W, BUCKLER.bronze, r.seed, 7, 7); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Pay It Back: the tally of blows Scutate took streams off it into the foe as it bashes in, boss first, and the count bursts on the foe.
  buckler_vault: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r);
      if (t < hit) tallies(U.x - 6, U.y - 9, 6, 1);
      smear(r, BUCKLER.bronze, BUCKLER.red, 10);
      landed(r, (E, a) => {
        const s = still(a, 3);
        for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3, d = 2 + s * 1.1; if (s < 12) line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8 - 1, E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8 + 1, q % 2 ? BUCKLER.red : W, fade(s, 12)); }
        if (a < 4) shieldDisc(E.x - (E.x > U.x ? 4 : -4), E.y, 4, 0.6);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 2) }; },
  },

  // Raise the Rim: the shield's rim circles Scutate and stands up before it, turning, and anything thrown at it glances off.
  buckler_parry: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), P = { x: U.x + dir * 7, y: U.y };
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const u = a / f.dur, g = u * Math.PI * 4, p = lerp({ x: U.x + Math.cos(g) * 9, y: U.y + Math.sin(g) * 5 }, P, ease(u)); shieldDisc(p.x, p.y, 3, 0.5 + 0.5 * Math.abs(Math.cos(g))); }
      landed(r, (_, a) => { const L = fade(a, r.end - hitOf(r), 6); shieldDisc(P.x, P.y, 5, 0.45, L); if (a < 12) for (let q = 0; q < 2; q++) { const aa = (a + q * 6) % 12; px(P.x + dir * (2 + aa * 0.6), P.y - 3 + q * 6 - (q ? 1 : -1) * aa * 0.4, W, 1 - aa / 12); } });
    },
  },

  // Falling Shield: a great shield comes down out of the sky over the foes, its shadow growing, and slams flat on them.
  buckler_fall: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), g = ease(prog(t, 0, hit));
      wash(BUCKLER.dark, 0.25 * hold(t, 0, r.end, 6));
      for (const E of r.to) { if (t < hit + 2) oval(E.x, E.y + 6, 3 + 9 * g, 1 + g * 2, '#000000', 0.5); landed(r, (E2, a) => { if (E2 !== E || a >= 18) return; const n = Math.min(11, a * 3), L = fade(a, 18); line(E.x - n, E.y + 5, E.x + n, E.y + 5, BUCKLER.bronze, L); line(E.x - n + 2, E.y + 6, E.x + n - 2, E.y + 6, BUCKLER.dark, L); }); }
    },
    front(r) {
      const t = r.t, hit = hitOf(r), a = t - hit;
      for (const E of r.to) {
        const top = high(E) ? -6 : 10, y = top + (E.y - 2 - top) * ease(prog(t, 0, hit)) * prog(t, 0, hit), flat = a < 0 ? 0.5 + 0.5 * Math.abs(Math.cos(t * 0.15)) : 1;
        if (a < 0) shieldDisc(E.x, y, 7, flat);
        else if (a < 12) { const L = fade(a, 12, 4); oval(E.x, E.y + 5, 10, 2.5, BUCKLER.leather, L); arc(E.x, E.y + 5, 10, 2.5, BUCKLER.bronze, L); arc(E.x, E.y + 5, 6, 1.5, BUCKLER.red, L); }
        if (a >= 0) sparks(E.x, E.y + 4, still(a, 6), 10, BUCKLER.bronze, BUCKLER.red, r.seed, 14, 12);
      }
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Umatsu (destrier): horseshoes, hoofprints, and its gold-trimmed barding

const DESTRIER = { brown: '#805037', gold: '#e1b948', gray: '#9a9eaa', dark: '#2a1c14' };
/** A horseshoe at x, y: a gray U with gold nails, open side `up` or down. */
function horseshoe(x: number, y: number, up: boolean, lv = 1): void { blit(up ? ['g...g', 'gn.ng', 'g...g', '.ggg.'] : ['.ggg.', 'g...g', 'gn.ng', 'g...g'], x, y, { g: DESTRIER.gray, n: DESTRIER.gold }, lv); }
/** Hoofprints from a to b, `n` of them, alternating side to side. */
function hoofprints(a: Pt, b: Pt, n: number, lv = 1): void { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d; for (let q = 0; q < n; q++) { const p = lerp(a, b, (q + 0.5) / n), s = q % 2 ? 1.5 : -1.5; arc(p.x + nx * s, p.y + ny * s + 5, 1, 1, DESTRIER.dark, lv, 0.5, 1); px(p.x + nx * s, p.y + ny * s + 4, DESTRIER.gray, lv); } }

const DESTRIER_ART: Record<string, LegendArt> = {
  // Lead Rope: Umatsu throws a lead rope that loops the foe and yanks it back, a gold knot pulled tight.
  destrier_rearup: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r);
      inbound(r, (u, E) => { const p = lerp(U, E, u); line(U.x, U.y - 2, p.x, p.y, DESTRIER.brown); arc(p.x, p.y, 3, 2, DESTRIER.gold); });
      landed(r, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 6), yank = a < 6 ? Math.round(Math.sin(Math.PI * a / 6) * 2) * (E.x > U.x ? -1 : 1) : 0;
        if (a < 8) line(U.x, U.y - 2, E.x + yank, E.y, DESTRIER.brown, 1 - a / 8);
        arc(E.x + yank, E.y + 1, 6, 3, DESTRIER.brown, L); px(E.x + yank + (E.x > U.x ? -6 : 6), E.y + 1, DESTRIER.gold, L); px(E.x + yank + (E.x > U.x ? -6 : 6), E.y, W, L);
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Spur On: a gold spur turns at Umatsu's side as it stamps, dust flies from its hooves, and speed lines stream behind it.
  destrier_couch: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), hit = hitOf(r), a = t - hit, S = { x: U.x - dir * 6, y: U.y + 2 };
      for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + t * 0.4; line(S.x, S.y, S.x + Math.cos(g) * 2.5, S.y + Math.sin(g) * 2.5, DESTRIER.gold, hold(t, 0, r.end, 5)); }
      px(S.x, S.y, W);
      if (a >= 0) { puff(U.x - 3, U.y + 5, a, 12, DESTRIER.gray, DESTRIER.brown, 2, 0.15); puff(U.x + 3, U.y + 5, a - 2, 12, DESTRIER.gray, DESTRIER.brown, 2, 0.15); for (let q = 0; q < 3; q++) { const k = (a * 2 + q * 5) % 14; line(U.x - dir * (8 + k), U.y - 3 + q * 3, U.x - dir * (11 + k), U.y - 3 + q * 3, q === 1 ? DESTRIER.gold : DESTRIER.gray, fade(a, r.end - hit, 5) * (1 - k / 14)); } }
    },
  },

  // Ride Through: Umatsu rides at the foe with a lance couched, runs it through, and leaves hoofprints behind.
  destrier_joust: {
    tail: 8, noLandings: true,
    back(r) { const a = r.t - hitOf(r); if (a >= -4) hoofprints(r.from, aim(r), 5, fade(a + 4, r.end - hitOf(r) + 4, 6)); },
    front(r) {
      const U = userAt(r), E = aim(r), d = Math.hypot(E.x - r.from.x, E.y - r.from.y) || 1, ux = (E.x - r.from.x) / d, uy = (E.y - r.from.y) / d, hit = hitOf(r), a = r.t - hit;
      if (a < 4) { line(U.x, U.y, U.x + ux * 12, U.y + uy * 12, DESTRIER.gray); px(U.x + ux * 12, U.y + uy * 12, W); px(U.x + ux * 3 - uy * 2, U.y + uy * 3 + ux * 2, DESTRIER.gold); px(U.x + ux * 4 - uy * 2, U.y + uy * 4 + ux * 2, DESTRIER.gold); }
      landed(r, (E2, aa) => { const s = still(aa, 2); if (s < 8) line(E2.x + ux * 2, E2.y + uy * 2, E2.x + ux * (4 + s * 1.5), E2.y + uy * (4 + s * 1.5), W, fade(s, 8)); sparks(E2.x, E2.y, s, 6, DESTRIER.gold, DESTRIER.gray, r.seed, 8, 8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Full Gallop: barding plates settle onto Umatsu, it gallops a line of hoofprints at the foe, tramples it, and drives it off the field.
  destrier_gallop: {
    lead: 12, noLandings: true,
    back(r) {
      const t = r.t, hit = hitOf(r), a = t - hit;
      wash(DESTRIER.dark, 0.25 * hold(t, 0, r.end, 6));
      if (t >= 12) hoofprints(r.from, aim(r), Math.min(7, 1 + Math.floor((t - 12) / 1.2)), hold(t, 12, r.end, 6));
      if (a >= 0) { const E = aim(r), away = high(E) ? 1 : -1, n = Math.min(16, a * 2); for (let i = 0; i < n; i += 2) puff(E.x + away * (4 + i), E.y + 5, a - i / 2, 10, DESTRIER.gray, DESTRIER.brown, 1.5, 0.1); }
    },
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < 12) for (const s of [-1, 1]) { const y = U.y - 10 + 10 * ease(prog(t, s > 0 ? 2 : 0, 10)); line(U.x + s * 2, y, U.x + s * 5, y + 2, DESTRIER.gray); px(U.x + s * 5, y + 2, DESTRIER.gold); }
      landed(r, (E, a) => { const s = still(a, 6); horseshoe(E.x - 2, E.y - 2 + Math.min(2, s), false, fade(a, 12, 4)); horseshoe(E.x + 3, E.y + 1 + Math.min(2, s), false, fade(a - 2, 12, 4)); sparks(E.x, E.y + 3, s, 8, DESTRIER.gold, DESTRIER.gray, r.seed, 12, 10); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Mangonel (mangonel): the throwing arm and its cradle

const MANGONEL = { gray: '#7a7a7f', pale: '#c2beb2', dark: '#47474d', wood: '#8a6a4a', deep: '#1c1c20' };
/** The arm from its pivot at x, y swung to `ang` (0 points back, a half turn points at the foe side), `len` long, with its cradle at the end. */
function throwArm(x: number, y: number, ang: number, len: number, dir: number, lv = 1): void {
  const ex = x - dir * Math.cos(ang) * len, ey = y - Math.sin(ang) * len;
  thick(x, y, ex, ey, MANGONEL.wood, lv, MANGONEL.dark);
  arc(ex, ey, 2, 1.5, MANGONEL.pale, lv, 0, 0.5); px(x, y, MANGONEL.pale, lv);
}
/** A boulder `s` across: pale stone with a gray side. */
function boulder(x: number, y: number, s = 1, lv = 1): void { blit(['.pp.', 'pwpg', 'ppgg', '.gg.'], x, y, { p: MANGONEL.pale, w: W, g: MANGONEL.gray }, lv, s); }
/** The arm's swing over the user through a throw at `leave`: wound back before it, over the top after it. */
const swingOf = (t: number, leave: number): number => Math.PI * (0.15 + 0.7 * ease(prog(t, leave - 4, leave + 2)));

const MANGONEL_ART: Record<string, LegendArt> = {
  // Loose Stones: Mangonel's arm swings over and lets go a cradleful of small stones that rain on the foes and crack the ground.
  mangonel_lob: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a, i) => { if (a >= 12 || i % 2) return; const n = Math.min(6, a * 2), L = fade(a, 12); line(E.x - n, E.y + 5, E.x + n, E.y + 5, MANGONEL.pale, L); line(E.x - n + 1, E.y + 6, E.x + n - 1, E.y + 6, MANGONEL.deep, L); }); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r);
      throwArm(U.x, U.y - 2, swingOf(t, leaveOf(r)), 9, dir, hold(t, 0, r.end - 6, 4));
      inbound(r, (u, E, i) => { const p = lobAt(r.from, E, u, 1.2); boulder(p.x + (i - 1.5), p.y, 0.5); });
      landed(r, (E, a, i) => chunks(E.x + (i - 1.5) * 3, E.y + 2, still(a, i ? 0 : 2), 4, MANGONEL.pale, MANGONEL.gray, r.seed + i, 12, 1.2, 1.2));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Fling Back: what Mangonel caught glows white in its cradle, the arm flings it high over, and it bursts on the foe.
  mangonel_hurl: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), go = leaveOf(r), ang = swingOf(t, go), ex = U.x - 2 - dir * Math.cos(ang) * 9, ey = U.y - 2 - Math.sin(ang) * 9;
      throwArm(U.x, U.y - 2, ang, 9, dir, hold(t, 0, r.end - 6, 4));
      if (t < go) { oval(ex + 2, ey - 1, 2, 2, W); arc(ex + 2, ey - 1, 3, 3, MANGONEL.pale, (t >> 1) & 1 ? 1 : 0.5); }
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u, 1.4); oval(p.x, p.y, 2, 2, W); tail(p, lobAt(r.from, E, Math.max(0, u - 0.06), 1.4), MANGONEL.pale, MANGONEL.gray, MANGONEL.dark, 5); });
      landed(r, (E, a) => { const s = still(a, 2); ringOut(E.x, E.y, s, 12, 9, W, 0.8); chunks(E.x, E.y + 2, s, 7, MANGONEL.pale, MANGONEL.gray, r.seed, 14, 1.4, 1.3); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Arm Swing: Mangonel runs in and brings its arm down across the foe like a club, and the foe reels.
  mangonel_payload: {
    tail: 6, noLandings: true,
    front(r) {
      const U = userAt(r), E = aim(r), dir = E.x >= r.from.x ? 1 : -1, hit = hitOf(r), t = r.t, g = Math.PI * (0.15 + 0.85 * ease(prog(t, hit - 4, hit)));
      if (t < hit + 6) throwArm(U.x, U.y - 2, g, 11, dir);
      landed(r, (E2, a) => { const s = still(a, 3); arc(E2.x, E2.y - 2, 8, 6, MANGONEL.pale, fade(a, 8, 3), dir > 0 ? 0.55 : 0.7, dir > 0 ? 0.8 : 0.95); sparks(E2.x, E2.y, s, 6, W, MANGONEL.pale, r.seed, 8, 8); if (a >= 4) circling(E2, a, 3, (x, y) => px(x, y, MANGONEL.pale, fade(a, r.end - hit, 5))); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 2) }; },
  },

  // Wind Arm: a ratchet wheel clicks round at Mangonel's side as its arm winds back bigger, then it throws three boulders that shake the ground.
  mangonel_ratchet: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(MANGONEL.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), go = leaveOf(r), R = { x: U.x - dir * 7, y: U.y + 2 };
      for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + Math.floor(t / 3) * 0.4; px(R.x + Math.cos(g) * 3, R.y + Math.sin(g) * 3, q % 2 ? MANGONEL.pale : MANGONEL.gray); }
      px(R.x, R.y, W);
      const fl = r.flights.filter(f => t >= f.t0 - 4 && t < f.t0 + 4)[0], ang = fl ? swingOf(t, fl.t0) : t < go ? Math.PI * 0.15 : Math.PI * 0.85;
      throwArm(U.x, U.y - 2, ang, 9 + 3 * prog(t, 0, go), dir, hold(t, 0, r.end - 6, 4));
      inbound(r, (u, E) => boulder(lobAt(r.from, E, u, 1.3).x, lobAt(r.from, E, u, 1.3).y, 1));
      landed(r, (E, a, i) => { chunks(E.x, E.y + 3, still(a, i === 2 ? 5 : 1), 6, MANGONEL.pale, MANGONEL.gray, r.seed + i * 3, 14, 1.5, 1.3); if (a < 14) { const n = Math.min(10, a * 2); line(E.x - n, E.y + 5, E.x + n, E.y + 5, MANGONEL.pale, fade(a, 14)); } });
      const a = t - lastOf(r); if (a >= 0) mends(U, a, MANGONEL.pale);
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 6, 2) }; },
  },
};

// ---------------------------------------------------------------- Kabura (sallet): breath through the visor slits and the green drake inside

const SALLET = { steel: '#aab2be', flame: '#db5434', drake: '#156d5c', gold: '#f0b060', dark: '#1a1a20', light: '#4aa890' };
/** Breath out of the visor slits from x, y toward `dir`: three flame lines `len` long that flicker, hot at the slit. */
function visorBreath(x: number, y: number, dir: number, len: number, t: number, lv = 1): void {
  for (let q = 0; q < 3; q++) { const l = len - (q === 1 ? 0 : 2) + ((t + q) & 1); for (let i = 0; i < l; i++) px(x + dir * i, y - 2 + q * 2 + (i > l * 0.6 ? Math.round(Math.sin(i + t)) : 0), i < 2 ? W : i < l * 0.5 ? SALLET.gold : SALLET.flame, lv * (i < l - 1 ? 1 : 0.5)); }
}
/** The drake's head looking out toward `dir`, `s` times size: green with a light jaw and a flame-red eye. */
function drakeHead(x: number, y: number, dir: number, s = 1, lv = 1): void { blit(['.gg...', 'ggrgg.', 'gggggg', '.lll.l'], x, y, { g: SALLET.drake, r: SALLET.flame, l: SALLET.light }, lv, s, dir < 0); }
/** A small helm: steel with a dark visor slit. */
function helm(x: number, y: number, lv = 1): void { blit(['.sss.', 'sssss', 'sdddd', 'sssss'], x, y, { s: SALLET.steel, d: SALLET.dark }, lv); }

const SALLET_ART: Record<string, LegendArt> = {
  // Visor Breath: hot breath pours out of Kabura's visor slits in three lines of flame, and heat breaks over every foe.
  sallet_hotbreath: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), hit = hitOf(r);
      if (t < hit + 6) visorBreath(U.x + dir * 4, U.y, dir, Math.round(4 + 6 * prog(t, 0, hit)), t, hold(t, 0, hit + 6, 3));
      landed(r, (E, a) => { puff(E.x, E.y + 1, a, 16, SALLET.flame, SALLET.gold, 3, 0.3); for (let q = 0; q < 4; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 14) px(E.x - 5 + q * 3 + Math.sin(aa / 2), E.y + 2 - aa * 0.6, aa % 3 ? SALLET.gold : W, fade(aa, 14)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Plume Bash: Kabura butts the foe with its helm, a streak of red plume behind it, and the steel rings off the foe's head.
  sallet_browbash: {
    tail: 4, noLandings: true,
    front(r) {
      smear(r, SALLET.flame, SALLET.steel, 10);
      landed(r, (E, a) => { const s = still(a, 3); ringOut(E.x, E.y - 2, s, 10, 8, SALLET.steel, 0.7); ringOut(E.x, E.y - 2, s - 2, 10, 6, W, 0.7); if (a >= 4) circling(E, a, 3, (x, y) => glint(x, y, SALLET.gold, fade(a, r.end - hitOf(r), 5))); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Lend the Helm: a small helm flies from Kabura to the ally and settles on its head, warm, with a glint on its steel.
  sallet_visor: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], U = userAt(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur / 2) continue; const u = ease(a / (f.dur / 2)), p = sagAt(U, { x: A.x + toward(r) * 10, y: A.y - 8 }, u, -6); helm(p.x, p.y); }
      landed(r, (_, a) => { const L = fade(a, r.end - hitOf(r), 6); helm(A.x, A.y - 6 + Math.max(0, 2 - a), L); if (a < 6) glint(A.x + 2, A.y - 8, SALLET.steel); mends(A, a - 2, SALLET.gold); });
    },
  },

  // Drake Day: the drake climbs out of Kabura's helm, big and green, four embers circle it and fly, and fire breaks over every foe.
  sallet_drake: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(SALLET.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), up = ease(prog(t, 0, 14)), L = hold(t, 0, r.end, 6);
      drakeHead(U.x + dir * 2, U.y - 5 - 6 * up, dir, 2, L);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], u = a / f.dur, a0 = f.i / f.n * Math.PI * 2, O = { x: U.x + Math.cos(a0) * 9, y: U.y - 6 + Math.sin(a0) * 5 };
        const p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 4 + a0) * 9, y: U.y - 6 + Math.sin(u / 0.6 * Math.PI * 4 + a0) * 5 } : lerp(O, E, (u - 0.6) / 0.4);
        px(p.x, p.y, (a >> 1) & 1 ? W : SALLET.gold); px(p.x - dir, p.y, SALLET.flame); px(p.x - dir * 2, p.y - 1, SALLET.flame, 0.5);
      }
      landed(r, (E, a, i) => { puff(E.x + (i - 1.5) * 3, E.y + 1, a, 14, SALLET.flame, SALLET.gold, 2.5, 0.35); sparks(E.x, E.y, still(a, i ? 0 : 5), 6, SALLET.gold, SALLET.flame, r.seed + i, 9, 9); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Drake Fire: the drake looks out of the helm and breathes a sweep of fire through every foe, which burns on as smoke.
  sallet_drakefire: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r);
      drakeHead(U.x + dir * 3, U.y - 7, dir, 1, hold(t, 0, r.end, 5));
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], d2 = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + d2 * (44 * u - 20), y = E.y - 3 + f.i * 3;
        visorBreath(x, y + 2, -d2, 5, t);
      }
      landed(r, (E, a, i) => { puff(E.x + (i - 1) * 4, E.y - 1, a - 2, 16, '#5a5466', '#3e3a48', 2, 0.4); sparks(E.x, E.y, a, 5, SALLET.gold, SALLET.flame, r.seed + i, 7, 7); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Sagitli (fletch): the arrow that never came down, and high frost

const FLETCH = { pale: '#d1e1ec', blue: '#95c4ea', slate: '#55647a', dark: '#18202c' };
/** An arrow centered on x, y along `ang`, `len` long: a white head, a slate shaft, and blue fletching. */
function arrowOf(x: number, y: number, ang: number, len = 8, lv = 1): void {
  const ux = Math.cos(ang), uy = Math.sin(ang), h = len / 2, hx = x + ux * h, hy = y + uy * h, tx = x - ux * h, ty = y - uy * h;
  line(tx, ty, hx, hy, FLETCH.slate, lv); px(hx, hy, W, lv); px(hx - ux, hy - uy, FLETCH.pale, lv);
  for (const s of [-1, 1]) px(tx - uy * s, ty + ux * s, FLETCH.blue, lv);
}
/** A frost streak behind p coming from b: pale, then blue, then a dithered slate pixel. */
function frostTail(p: Pt, b: Pt, n = 5): void { tail(p, b, FLETCH.pale, FLETCH.blue, FLETCH.slate, n); }

const FLETCH_ART: Record<string, LegendArt> = {
  // Loose: an arrow leaves Sagitli with a frost streak behind it and strikes the foe with a crackle of rime.
  fletch_nock: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, u), ang = Math.atan2(E.y - r.from.y, E.x - r.from.x); frostTail(p, lerp(r.from, E, Math.max(0, u - 0.2)), 6); arrowOf(p.x, p.y, ang, 7); });
      landed(r, (E, a) => { const ang = Math.atan2(E.y - r.from.y, E.x - r.from.x); arrowOf(E.x - Math.cos(ang) * 2, E.y - Math.sin(ang) * 2, ang, 7, fade(a, 12, 4)); if (a < 10) for (let q = 0; q < 4; q++) { const g = q * 1.57 + 0.8, d = 2 + a * 0.5; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d, q % 2 ? FLETCH.blue : W, fade(a, 10)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Sheaf Loose: Sagitli lets go every arrow it has left high into the sky, and they come straight down on the foes.
  fletch_sheaf: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (let q = 0; q < 3; q++) { const a = t - 2 - q * 2; if (a >= 0 && a < 8) arrowOf(U.x + (q - 1) * 3, U.y - 6 - a * 3, -Math.PI / 2, 6); }
      inbound(r, (u, E, i) => { const x = E.x + (i - 1) * 5, top = E.y - (high(E) ? 16 : 28), y = top + (E.y - 1 - top) * u * u; arrowOf(x, y, Math.PI / 2, 6); frostTail({ x, y: y + 3 }, { x, y: y - 3 }, 4); });
      landed(r, (E, a, i) => { const x = E.x + (i - 1) * 5; arrowOf(x, E.y - 1, Math.PI / 2, 6, fade(a, r.end - r.hits[i].at, 6)); sparks(x, E.y + 2, still(a, i ? 0 : 2), 4, FLETCH.pale, FLETCH.blue, r.seed + i, 5, 6); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Frost Tip: an arrow arcs high over the field trailing frost, lands in the foe, and frost blooms over it with marks at its corners.
  fletch_overshoot: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u, 1.6), b = lobAt(r.from, E, Math.max(0, u - 0.06), 1.6); frostTail(p, b, 6); arrowOf(p.x, p.y, Math.atan2(p.y - b.y, p.x - b.x), 7); });
      landed(r, (E, a) => {
        const L = fade(a, r.end - hitOf(r), 6), g = Math.min(1, a / 6);
        for (let q = 0; q < 6; q++) { const ang = q / 6 * Math.PI * 2, d = 2 + 4 * g; px(E.x + Math.cos(ang) * d, E.y + Math.sin(ang) * d * 0.8, q % 2 ? FLETCH.blue : W, L); }
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { px(E.x + sx * 6, E.y + sy * 5, FLETCH.pale, L); px(E.x + sx * 5, E.y + sy * 5, FLETCH.pale, L); px(E.x + sx * 6, E.y + sy * 4, FLETCH.pale, L); }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Overdraw: a bow bends at Sagitli's side and draws further and further as frost gathers on the point, then the arrow goes like a line of ice and the foe bursts white.
  fletch_overdraw: {
    lead: 16, noFlights: true, noLandings: true,
    back(r) { wash(FLETCH.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), ang = Math.atan2(E.y - U.y, E.x - U.x), draw = ease(prog(t, 0, go));
      if (t < go + 2) {
        const nx = -Math.sin(ang), ny = Math.cos(ang), bx = U.x + Math.cos(ang) * 5, by = U.y + Math.sin(ang) * 5;
        for (let i = -6; i <= 6; i++) { const bend = (1 - (i * i) / 36) * (1 + draw); px(bx + nx * i + Math.cos(ang) * bend, by + ny * i + Math.sin(ang) * bend, FLETCH.slate); }
        const back = 2 + 4 * draw; line(bx + nx * 6, by + ny * 6, bx - Math.cos(ang) * back, by - Math.sin(ang) * back, FLETCH.pale, 0.75); line(bx - nx * 6, by - ny * 6, bx - Math.cos(ang) * back, by - Math.sin(ang) * back, FLETCH.pale, 0.75);
        arrowOf(bx + Math.cos(ang) * (3 - back), by + Math.sin(ang) * (3 - back), ang, 9);
        if (draw > 0.5) glint(bx + Math.cos(ang) * (7.5 - back), by + Math.sin(ang) * (7.5 - back), FLETCH.blue, (t >> 1) & 1 ? 1 : 0.5);
      }
      inbound(r, (u) => { const p = lerp(U, E, u); frostTail(p, lerp(U, E, Math.max(0, u - 0.5)), 14); arrowOf(p.x, p.y, ang, 9); });
      landed(r, (E2, a) => { const s = still(a, 6); if (s < 14) for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2, d = 2 + s; line(E2.x + Math.cos(g) * d, E2.y + Math.sin(g) * d * 0.8, E2.x + Math.cos(g) * (d + 2), E2.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? FLETCH.blue : W, fade(s, 14)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 12, 3) }; },
  },
};

// ---------------------------------------------------------------- Kugami (image): a still water surface and the reflections in it

const IMAGE = { gold: '#f3dbab', teal: '#2bc1c9', lav: '#8777a5', dark: '#1e1a30' };
/** A still surface w each side of x at y: a teal line with pale glints that run along it. */
function surface(x: number, y: number, w: number, t: number, lv = 1): void { for (let i = -w; i <= w; i++) px(x + i, y, (i + (t >> 1)) % 6 === 0 ? IMAGE.gold : IMAGE.teal, lv); }
/** A reflection of a whorl: an 8 by 8 outline of it in lavender, with a pale top edge, at `lv`. */
function reflection(x: number, y: number, lv = 1): void {
  for (let i = -4; i <= 4; i++) { px(x + i, y - 4, IMAGE.gold, lv); px(x + i, y + 4, IMAGE.lav, lv); }
  for (let j = -3; j <= 3; j++) { px(x - 4, y + j, IMAGE.lav, lv); px(x + 4, y + j, IMAGE.lav, lv); }
}
/** A diamond glint of reflected light, `s` from its middle to its points. */
function glintDiamond(x: number, y: number, s: number, lv = 1): void { for (let j = -s; j <= s; j++) { const w = s - Math.abs(j); line(x - w, y + j, x + w, y + j, Math.abs(j) < s / 2 ? W : IMAGE.gold, lv); } px(x + s + 1, y, IMAGE.teal, lv); px(x - s - 1, y, IMAGE.teal, lv); }

const IMAGE_ART: Record<string, LegendArt> = {
  // Mirror Flash: three flashes of reflected light slide through every foe over a still teal surface.
  image_glint: {
    noFlights: true, noLandings: true,
    back(r) { for (const E of r.to) surface(E.x, E.y + 5, 12, r.t, hold(r.t, leaveOf(r), r.end, 5)); },
    front(r) {
      for (const f of r.flights) {
        const a = r.t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y - 2 + f.i * 2;
        glintDiamond(x, y, 2); line(x - dir * 3, y, x - dir * 8, y, IMAGE.teal, 0.75); px(x, E.y + 5 + (E.y + 5 - y) * 0.3, IMAGE.gold, 0.5);
      }
      landed(r, (E, a) => { if (a < 4) glintDiamond(E.x, E.y - 1, 3 - a * 0.7, fade(a, 4, 2)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Ripple Back: Kugami blinks, a ripple runs to the foe, and its rings come back in on it the wrong way, closing instead of spreading.
  image_invert: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], half = f.dur / 2, v = a < half ? ease(a / half) : 1 - ease((a - half) / half), p = lerp(r.from, E, v); arc(p.x, p.y, 3, 2, IMAGE.teal); arc(p.x, p.y + 4, 3, 1, IMAGE.lav, 0.5); }
      landed(r, (E, a) => { for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa < 0 || aa >= 12) continue; const rr = 10 - aa * 0.7; arc(E.x, E.y, rr, rr * 0.6, q % 2 ? IMAGE.lav : IMAGE.teal, fade(aa, 12)); } reflection(E.x, E.y + 9, 0.5 * fade(a, r.end - hitOf(r), 5)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Glassy Beam: a beam of glassy light leaves Kugami, glances off a still surface on the ground, and strikes the foe from below.
  image_lure: {
    tail: 6, noFlights: true, noLandings: true,
    back(r) { const E = aim(r), m = lerp(r.from, E, 0.6); surface(m.x, Math.max(r.from.y, E.y) + 4, 8, r.t, hold(r.t, 0, r.end, 4)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), on = hold(t, go, hitOf(r) + 12, 2), m = lerp(U, E, 0.6), M = { x: m.x, y: Math.max(U.y, E.y) + 4 };
      if (on > 0) { const u = Math.min(1, (t - go + 1) / 3); for (const [a, b] of [[U, M], [M, E]] as [Pt, Pt][]) { const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * u); for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))); px(p.x, p.y, ((i + t) >> 1) % 3 ? IMAGE.teal : W, on); px(p.x, p.y + 1, IMAGE.lav, 0.5 * on); } } }
      landed(r, (E2, a) => { if (a < 8) glintDiamond(E2.x, E2.y, 3 - Math.min(2, a * 0.4), fade(a, 8)); });
    },
  },

  // Reflect It: the field darkens, the foe's reflection forms over Kugami as glints close on the foe, and in a white flash Kugami takes its shape.
  image_mirrortake: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const L = hold(r.t, 0, r.end, 6); wash(IMAGE.dark, 0.375 * L); surface(r.from.x, r.from.y + 5, 12, r.t, L); surface(aim(r).x, aim(r).y + 5, 12, r.t, L); },
    front(r) {
      const t = r.t, U = r.from, E = aim(r), n = r.hits.filter(h => t >= h.at).length, L = hold(t, 0, r.end, 6);
      reflection(E.x, E.y, 0.75 * L); reflection(E.x, E.y + 10, 0.25 * L);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = f.i / f.n * Math.PI * 2, rr = 16 - 13 * ease(a / f.dur); glintDiamond(E.x + Math.cos(g) * rr, E.y + Math.sin(g) * rr * 0.6, 1); }
      if (n) { reflection(U.x, U.y, L); dither(U.x - 3, U.y - 3, 7, 7, IMAGE.teal, (n / 4) * 0.5 * L); }
      landed(r, (_, a, i) => { if (a < 6) glintDiamond(U.x + (i - 1.5) * 3, U.y - 6, 1, fade(a, 6)); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2), glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
  },
};

// ---------------------------------------------------------------- Salgoro (skipper): mud, and the big thing under it

const SKIPPER = { blue: '#4f9dbd', white: '#f2f2ee', mud: '#604737', dark: '#2a1e16', deep: '#140e0a' };
/** Mud thrown up from x, y a frames after: brown clots with a few blue and white drops. */
function mudSplash(x: number, y: number, a: number, seed: number, n = 7, life = 14): void {
  if (a < 0 || a >= life) return;
  for (let q = 0; q < n; q++) { const vx = (q - (n - 1) / 2) * 0.55, vy = -1.3 - hash(seed + q) * 0.8, cx = x + vx * a, cy = y + vy * a + 0.13 * a * a; dither(Math.round(cx), Math.round(cy), q % 3 ? 2 : 1, 1, q % 3 === 0 ? SKIPPER.white : q % 3 === 1 ? SKIPPER.mud : SKIPPER.blue, fade(a, life)); }
}
/** The big thing under the mud: a dark shape w across with a fin cutting the surface, at x, foot. */
function bigUnder(x: number, foot: number, w: number, fin: number, lv = 1): void {
  oval(x, foot + 1, w, 1.5, SKIPPER.deep, lv);
  for (let k = 0; k < 4; k++) line(x + fin - k, foot - 3 + k, x + fin + 1, foot - 3 + k, k ? SKIPPER.dark : SKIPPER.blue, lv);
  px(x + fin - 4, foot, SKIPPER.white, lv); px(x + fin + 2, foot, SKIPPER.white, lv);
}
/** A mudskipper in flight: a small blue fish with a white eye and a brown tail. */
function skipperFish(x: number, y: number, dir: number, t: number, lv = 1): void { blit((t >> 1) & 1 ? ['..bbbw.', 'm.bbbbb', '.mbbbb.'] : ['m.bbbw.', '.mbbbbb', '..bbbb.'], x, y, { b: SKIPPER.blue, w: SKIPPER.white, m: SKIPPER.mud }, lv, 1, dir < 0); px(x + dir * 2, y + 1, SKIPPER.white, lv); }

const SKIPPER_ART: Record<string, LegendArt> = {
  // Skip In: Salgoro skips across the mud to the foe, splashing at each bounce, and lands on it in a burst of mud.
  skipper_dart: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, dir = toward(r);
      inbound(r, (u, E) => { const k = u < 0.5 ? u * 2 : (u - 0.5) * 2, A = lerp(r.from, E, u < 0.5 ? 0 : 0.5), B = lerp(r.from, E, u < 0.5 ? 0.5 : 1), p = sagAt(A, B, k, -6); skipperFish(p.x, p.y, dir, t); if (u >= 0.5 && u < 0.6) mudSplash(lerp(r.from, E, 0.5).x, lerp(r.from, E, 0.5).y + 4, Math.round((u - 0.5) * 30), r.seed, 4, 6); });
      landed(r, (E, a) => mudSplash(E.x, E.y + 3, still(a, 2), r.seed, 11, 16));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Mud Hop: Salgoro hops clear, mud splashes up in a ring where it was, and a smeared double of it shows it is hard to touch.
  skipper_hop: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); oval(E.x, E.y + 5, 7, 1.5, SKIPPER.mud, L); arc(E.x, E.y + 5, 7, 1.5, SKIPPER.blue, L, 0.05, 0.45); }); },
    front(r) {
      if (r.t < hitOf(r)) reflection(r.from.x + 3, r.from.y, 0.25);
      landed(r, (E, a) => { mudSplash(E.x - 4, E.y + 4, a, r.seed, 5); mudSplash(E.x + 4, E.y + 4, a, r.seed + 9, 5); if (a < 8) ringOut(E.x, E.y + 5, a, 8, 8, SKIPPER.white, 0.25); });
    },
  },

  // Barb Fin: Salgoro flicks its barbed fin out as it dashes, a fan of white spines cuts the foe, and brown drips run from the cuts.
  skipper_barbfin: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, SKIPPER.blue, SKIPPER.mud, 9);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); for (let k = 0; k < 4; k++) line(p.x, p.y + 2, p.x - 3 + k * 2, p.y - 2, k % 2 ? SKIPPER.white : SKIPPER.blue); });
      landed(r, (E, a) => {
        const n = Math.min(1, (still(a, 2) + 1) / 3), L = fade(a, 12, 4);
        for (let k = 0; k < 3; k++) line(E.x - 5 + k * 4, E.y - 4, E.x - 5 + k * 4 + 3 * n, E.y - 4 + 7 * n, k === 1 ? W : SKIPPER.white, L);
        for (let q = 0; q < 3; q++) { const aa = a - 3 - q * 3; if (aa >= 0 && aa < 14) { px(E.x - 4 + q * 4, E.y + aa * 0.5, SKIPPER.mud, fade(aa, 14)); px(E.x - 4 + q * 4, E.y + 1 + aa * 0.5, SKIPPER.dark, fade(aa, 14)); } }
      });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Something Big: the field darkens, a great shape circles under the mud by the foe with its fin cutting the surface, and the mud bursts up over the foe.
  skipper_chum: {
    lead: 10, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6), g = t * 0.12;
      wash(SKIPPER.deep, 0.375 * L);
      oval(E.x, E.y + 5, 13, 2.5, SKIPPER.mud, 0.75 * L); arc(E.x, E.y + 5, 13, 2.5, SKIPPER.blue, 0.5 * L, 0.05, 0.45);
      bigUnder(E.x + Math.cos(g) * 6, E.y + 5, 6, Math.round(Math.sin(g) * 3) + 3, L);
    },
    front(r) { landed(r, (E, a) => { const s = still(a, 5); mudSplash(E.x, E.y + 3, s, r.seed, 12, 18); if (a < 3) oval(E.x, E.y + 3, 6 - a, 2, SKIPPER.mud, 1); }); },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 2) }; },
  },
};

// ---------------------------------------------------------------- Liemus (silt): murk that clouds up and settles in layers

const SILT = { gray: '#636171', green: '#9ce341', dark: '#3d3b48', pale: '#a8a6b4', deep: '#16151c' };
/** A cloud of murk round x, y, w by h: a dithered gray mass with specks drifting down through it and a few green flecks. */
function murk(x: number, y: number, w: number, h: number, t: number, lv = 1): void {
  oval(x, y, w, h, SILT.gray, 0.5 * lv); oval(x, y, w * 0.6, h * 0.6, SILT.pale, 0.25 * lv);
  for (let q = 0; q < 6; q++) { const sx = x - w + ((q * 7) % (2 * w + 1)), sy = y - h + ((t * 0.3 + q * 5) % (2 * h + 1)); px(sx, sy, q % 3 ? SILT.pale : SILT.green, lv); }
}
/** Layers of settled silt on the ground under a whorl: bands that `sink` pixels down into it. */
function siltLayers(x: number, foot: number, w: number, sink: number, lv = 1): void { for (let q = 0; q < 3; q++) { const ww = w - q * 3, y = foot + q + Math.round(sink * (1 - q * 0.3)); line(x - ww, y, x + ww, y, [SILT.pale, SILT.gray, SILT.green][q], lv); } }

const SILT_ART: Record<string, LegendArt> = {
  // Stir Up: Liemus sinks, and silt boils up out of the ground under every foe in two clouds that hang there.
  silt_sludge: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E, i) => murk(E.x + (i ? 4 : -4), E.y + 5 - 8 * u, 2 + 3 * u, 1 + 2 * u, t));
      landed(r, (E, a, i) => { const L = fade(a, r.end - r.hits[i].at, 6); murk(E.x + (i ? 4 : -4), E.y - 3, 5 + Math.min(2, a * 0.3), 3, t, L); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Cloud Up: murk closes round the foe, green strands rise through it, and the silt runs down off it.
  silt_cloud: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), a = t - hitOf(r);
      if (t >= leaveOf(r)) murk(E.x, E.y, 7, 6, t, hold(t, leaveOf(r), r.end, 6));
      inbound(r, (u, E2, i) => { const x = E2.x + (i ? 3 : -3), h = Math.round(9 * u); for (let k = 0; k < h; k++) px(x + Math.round(Math.sin((k + t) / 2)), E2.y + 5 - k, k === h - 1 ? SILT.green : '#5a8a2a'); });
      if (a >= 0) for (let q = 0; q < 3; q++) { const aa = (a + q * 4) % 12; px(E.x - 3 + q * 3, E.y + aa * 0.5, SILT.gray, fade(a, r.end - hitOf(r), 6) * (1 - aa / 12)); }
    },
  },

  // Sink Pit: the ground under the foe sinks away in rings of silt, its feet go in, and a pit stays open there.
  silt_mirepit: {
    noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), L = hold(t, 2, r.end, 5), g = ease(prog(t, 2, hit + 6));
      oval(E.x, E.y + 6, 3 + 7 * g, 1 + 2 * g, SILT.deep, L); siltLayers(E.x, E.y + 5, Math.round(4 + 7 * g), 2 * g, L);
    },
    front(r) { landed(r, (E, a) => { if (a < 14) for (let q = 0; q < 2; q++) ringOut(E.x, E.y + 5, a - q * 4, 10, 9, q ? SILT.green : SILT.pale, 0.3); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Bottom Opens: the field goes dark, silt pours in toward the foes from all round, and the ground under them falls away in layers.
  silt_sink: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, L = hold(t, 0, r.end, 6), hit = hitOf(r);
      wash(SILT.deep, 0.375 * L);
      for (const E of r.to) { const g = ease(prog(t, hit - 6, lastOf(r) + 6)); oval(E.x, E.y + 6, 4 + 9 * g, 1 + 3 * g, '#000000', 0.75 * L); siltLayers(E.x, E.y + 5, Math.round(6 + 7 * g), 4 * g, L); }
    },
    front(r) {
      const t = r.t;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], g = f.i / f.n * Math.PI * 2 + 0.4, S = { x: E.x + Math.cos(g) * 18, y: E.y + 3 + Math.sin(g) * 8 }; murk(S.x + (E.x - S.x) * ease(a / f.dur), S.y + (E.y + 4 - S.y) * ease(a / f.dur), 3, 2, t); }
      landed(r, (E, a, i) => { if (i % 2 === 0) chunks(E.x, E.y + 5, a, 4, SILT.gray, SILT.green, r.seed + i, 10, 1.2, 0.8); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Ranaru (spawn): frogs, frogspawn, and tadpoles

const SPAWN = { green: '#4e943c', belly: '#dce4ac', dark: '#3b3d45', deep: '#141a12', light: '#8ac870' };
/** A small frog crouched at x, y: green with a pale belly and two bulging eyes. */
function frog(x: number, y: number, lv = 1, s = 1, leap = false): void { blit(leap ? ['g...g', '.ggg.', 'gbbbg', 'g...g'] : ['w...w', 'ggggg', 'gbbbg', 'g.g.g'], x, y, { g: SPAWN.green, b: SPAWN.belly, w: W }, lv, s); }
/** A tadpole: a dark head and a tail that wiggles with t. */
function tadpole(x: number, y: number, t: number, dir: number, lv = 1): void { oval(x, y, 1, 1, SPAWN.dark, lv); px(x, y - 1, SPAWN.light, lv); for (let k = 1; k <= 3; k++) px(x - dir * (k + 1), y + Math.round(Math.sin(t * 0.8 + k) * 0.8), SPAWN.green, lv); }
/** A clutch of frogspawn: n clear eggs with dark dots in them round x, y. */
function eggs(x: number, y: number, n: number, lv = 1): void { for (let q = 0; q < n; q++) { const g = q * 2.4, d = q ? 2 + (q % 3) : 0, ex = x + Math.cos(g) * d * 1.2, ey = y + Math.sin(g) * d * 0.8; arc(ex, ey, 1.5, 1.5, SPAWN.belly, lv); px(ex, ey, SPAWN.dark, lv); } }

const SPAWN_ART: Record<string, LegendArt> = {
  // Belly Croak: Ranaru's belly swells into a pale sac, and the croak rolls out over every foe in a wet ring.
  spawn_flick: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), g = ease(prog(t, 0, hit));
      if (t < hit + 2) { oval(U.x, U.y + 2, 2 + 3 * g, 1 + 2 * g, SPAWN.belly, 1); px(U.x - 1, U.y + 1, W); }
      landed(r, (E, a) => { for (let q = 0; q < 2; q++) ringOut(E.x, E.y, still(a, 2) - q * 4, 14, 9, q ? SPAWN.green : SPAWN.belly, 0.6); if (a < 12) for (let q = 0; q < 5; q++) px(E.x + (q - 2) * 0.6 * a, E.y + 3 - 1.2 * a + 0.12 * a * a, q % 2 ? SPAWN.belly : W, fade(a, 12)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Make a Frog: two small frogs hop in and land on the foe, a puff goes up, and a green frog's shape settles over it.
  spawn_hex: {
    noFlights: true, noLandings: true,
    front(r) {
      const E = aim(r), last = lastOf(r), a = r.t - last;
      inbound(r, (u, E2, i) => { const s = i ? 1 : -1, S = { x: E2.x + s * 14, y: E2.y + 4 }, p = sagAt(S, E2, u, -8); frog(p.x, p.y, 1, 1, u > 0.2 && u < 0.8); });
      landed(r, (E2, aa, i) => puff(E2.x + (i ? 2 : -2), E2.y + 2, aa, 14, SPAWN.light, SPAWN.belly, 3, 0.2));
      if (a >= 2) frog(E.x, E.y - 1, 0.5 * fade(a, r.end - last, 6), 2);
    },
  },

  // Sticky Tongue: Ranaru's tongue shoots out of its belly to the foe, sticks, and yanks it.
  spawn_tongue: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r), B = { x: U.x, y: U.y + 2 };
      const tongue = (p: Pt, lv: number): void => { const n = Math.round(Math.hypot(p.x - B.x, p.y - B.y)); for (let i = 0; i <= n; i++) { const q = lerp(B, p, i / Math.max(1, n)); px(q.x, q.y, SPAWN.belly, lv); px(q.x, q.y + 1, SPAWN.green, 0.5 * lv); } oval(p.x, p.y, 1.5, 1.5, SPAWN.belly, lv); px(p.x, p.y, W, lv); };
      inbound(r, (u, E) => tongue(lerp(B, E, u), 1));
      landed(r, (E, a) => { if (a < 8) { const back = a < 3 ? 0 : (a - 3) / 5; tongue(lerp(E, B, back), 1); } if (a >= 3) circling(E, a, 3, (x, y) => px(x, y, SPAWN.belly, fade(a, r.end - hitOf(r), 5))); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Frogspawn: a clutch of frogspawn wells up before Ranaru egg by egg, and two tadpoles hatch out of it and swim off to stand guard.
  spawn_frogspawn: {
    noFlights: true, noLandings: true,
    back(r) { wash(SPAWN.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = r.from, dir = toward(r), P = { x: U.x + dir * 9, y: U.y + 2 }, n = r.hits.filter(h => t >= h.at).length, last = lastOf(r), a = t - last;
      inbound(r, (u, _, i) => { arc(P.x + (i - 1.5) * 2, U.y + 6 - 6 * u, 1.5, 1.5, SPAWN.belly); });
      if (n && a < 6) eggs(P.x, P.y, 2 + n * 2, hold(t, hitOf(r), last + 6, 3));
      if (a >= 0) for (let q = 0; q < 2; q++) { const u = ease(prog(a - q * 2, 0, 12)), x = P.x + dir * (2 + 6 * u) * (q ? 1 : 0.4), y = P.y + (q ? -3 : 3) * u; tadpole(x, y, t, dir, fade(a, r.end - last, 6)); }
    },
  },

  // Frog Hop: a frog's hop, a small green leap that lands on the target with a soft puff.
  spawn_hop: {
    noLandings: true,
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r), u = prog(t, 0, hit);
      if (u > 0 && u < 1) { const p = sagAt(r.from, E, u, -10); frog(p.x, p.y, 1, 1, true); }
      landed(r, (E2, a) => puff(E2.x, E2.y + 3, a, 12, SPAWN.light, SPAWN.belly, 2, 0.15));
    },
  },

  // Croak: the throat swells into a pale sac and lets out one small ring. Nothing happens.
  spawn_croak: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), g = Math.sin(Math.PI * prog(t, 0, hit + 2));
      if (g > 0) oval(U.x, U.y + 3, 1 + 2 * g, 1 + g, SPAWN.belly, 1);
      landed(r, (_, a) => ringOut(U.x, U.y + 3, a, 10, 5, SPAWN.light, 0.6));
    },
  },
};

// ---------------------------------------------------------------- Lunkuu (lune): crescent edges of the moon's shell, thrown and coming back

const LUNE = { pale: '#d3d7e7', gold: '#d4b454', indigo: '#4a4a88', deep: '#14142a' };
/** A crescent edge at x, y rr across, turned to `ang`: pale with a gold outer rim. */
function crescent(x: number, y: number, rr: number, ang: number, lv = 1): void {
  const a0 = ang / (Math.PI * 2);
  arc(x, y, rr, rr, LUNE.gold, lv, a0 - 0.18, a0 + 0.18); arc(x - Math.cos(ang) * 1, y - Math.sin(ang) * 1, rr, rr, LUNE.pale, lv, a0 - 0.15, a0 + 0.15);
  px(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, W, lv);
}

const LUNE_ART: Record<string, LegendArt> = {
  // Pale Beam: a thin pale beam edged in gold runs from Lunkuu to the foe and lands as a crescent of light.
  lune_facet: {
    tail: 6, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), on = hold(t, go, hitOf(r) + 12, 2);
      if (on > 0) { const dx = E.x - U.x, dy = E.y - U.y, d = Math.hypot(dx, dy) || 1, n = d * Math.min(1, (t - go + 1) / 3); for (let i = 0; i <= n; i++) { const x = U.x + dx / d * i, y = U.y + dy / d * i; px(x, y, (i + t) % 7 ? LUNE.pale : W, on); px(x - dy / d, y + dx / d, LUNE.gold, 0.5 * on); } }
      landed(r, (E2, a) => { if (a < 10) crescent(E2.x, E2.y, 4 + a * 0.3, -Math.PI / 2 + a * 0.2, fade(a, 10)); });
    },
  },

  // Edges Out: Lunkuu spins and throws a crescent edge that cuts the foe and comes back turning.
  lune_beam: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], half = f.dur / 2, v = a < half ? ease(a / half) : 1 - ease((a - half) / half), p = lerp(U, E, v); p.y -= Math.sin(Math.PI * a / f.dur) * 3; crescent(p.x, p.y, 3, t * 0.9); }
      landed(r, (E, a) => { const n = Math.min(1, (still(a, 2) + 1) / 3); if (a < 10) arc(E.x, E.y, 6, 5, LUNE.pale, fade(a, 10, 4), 0.6, 0.6 + 0.5 * n); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Full Light: three crescents circle Lunkuu and wax into a full ring of pale light round its side, gold glinting on it.
  lune_glaive: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), n = r.hits.filter(h => t >= h.at).length;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = a / f.dur * Math.PI * 4 + f.i * 2.1, rr = 10 - 3 * a / f.dur; crescent(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, 2, g); }
      if (n) { const L = hold(t, hitOf(r), r.end, 6); arc(U.x, U.y + 1, 8, 6, LUNE.pale, L, 0, n / 3); arc(U.x, U.y + 1, 9, 7, LUNE.gold, 0.5 * L, 0, n / 3); }
      landed(r, (_, a, i) => { if (a < 6) glint(U.x + (i - 1) * 5, U.y - 7, LUNE.gold, fade(a, 6)); });
    },
  },

  // Shard Rain: the sky darkens, four crescent shards of the moon's shell fall on the foes and burst in pale and gold.
  lune_totality: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(LUNE.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t;
      inbound(r, (u, E, i) => { const x = E.x + (i - 1.5) * 4, y = E.y - (high(E) ? 16 : 28) * (1 - u); crescent(x, y, 3, Math.PI / 2 + t * 0.4); px(x, y - 4, LUNE.pale, 0.5); px(x, y - 6, LUNE.indigo, 0.5); });
      landed(r, (E, a, i) => { const s = still(a, i === 0 || i === r.hits.length - 1 ? 3 : 0), x = E.x + ((i % 4) - 1.5) * 4; if (s < 10) for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + i, d = 2 + s; px(x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, q % 2 ? LUNE.gold : LUNE.pale, fade(s, 10)); } });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Siderite (siderite): magnetic field lines and iron filings

const SIDERITE = { iron: '#645452', blue: '#5cc4fb', tan: '#998169', dark: '#24201e', pale: '#c8e8fc' };
/** Field lines from a to b: n arcs bowing out each side, with filings in dashes that run along them with t. */
function fieldLines(a: Pt, b: Pt, n: number, t: number, lv = 1): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  for (let k = 1; k <= n; k++) for (const s of [-1, 1]) { const bow = s * k * 3; for (let i = 0; i <= d; i += 1) if (((i + t) >> 1) % 3 !== 0) { const p = sagAt(a, b, i / d, bow); px(p.x, p.y, k === 1 ? SIDERITE.blue : SIDERITE.tan, lv * (k === 1 ? 1 : 0.5)); } }
}
/** Iron filings standing up on a whorl: short tan strokes with blue tips, `h` tall. */
function filings(E: Pt, h: number, lv = 1): void { for (let q = 0; q < 6; q++) { const x = E.x - 6 + q * 2.4, hh = Math.max(1, Math.round(h * (0.5 + 0.5 * Math.abs(Math.sin(q * 1.7))))); line(x, E.y + 5, x, E.y + 5 - hh, SIDERITE.tan, lv); px(x, E.y + 5 - hh, SIDERITE.blue, lv); } }

const SIDERITE_ART: Record<string, LegendArt> = {
  // Iron Wave: Siderite stomps, a wave of iron filings runs out over the ground, and they stand up on end round every foe.
  siderite_knock: {
    noLandings: true,
    back(r) { const a = r.t - hitOf(r); if (a >= 0 && a < 14) for (let q = 0; q < 2; q++) ringOut(r.from.x, r.from.y + 5, a - q * 3, 14, 24, q ? SIDERITE.tan : SIDERITE.blue, 0.25); },
    front(r) { landed(r, (E, a) => { filings(E, Math.min(4, still(a, 2) + 1), fade(a, r.end - hitOf(r), 6)); if (a < 3) glint(E.x, E.y, SIDERITE.blue); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Pull Iron: field lines reach out to the foe and pull, filings stream off it toward Siderite, and a blue spark jumps as it lands.
  siderite_skewer: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), L = hold(t, 0, r.end, 5);
      fieldLines(U, E, 2, -t, L);
      landed(r, (E2, a) => { if (a < 4) glint(E2.x, E2.y, SIDERITE.blue); for (let q = 0; q < 5; q++) { const u = ((a * 0.06 + q / 5) % 1); if (a < 14) { const p = lerp(E2, U, u); line(p.x, p.y, p.x + (U.x - E2.x) * 0.03, p.y + (U.y - E2.y) * 0.03, SIDERITE.tan, fade(a, 14)); } } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Iron Grip: a burr of iron filings flies at the foe and clings, and field lines loop round it and hold it to the ground.
  siderite_magnetize: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2 + t * 0.3; line(p.x, p.y, p.x + Math.cos(g) * 2.5, p.y + Math.sin(g) * 2.5, q % 2 ? SIDERITE.tan : SIDERITE.blue); } px(p.x, p.y, W); });
      landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); for (let k = 0; k < 2; k++) arc(E.x, E.y + 2, 6 + k * 2, 5 + k, k ? SIDERITE.tan : SIDERITE.blue, L, 0.55 + ((t >> 2) & 1) * 0.05, 1.45); filings(E, 2, L); sparks(E.x, E.y, still(a, 2), 6, SIDERITE.pale, SIDERITE.blue, r.seed, 7, 7); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Turn Poles: a bar magnet turns end over end over Siderite, every field line on the field swings round with it, and the ground jumps under the foes.
  siderite_poleswap: {
    lead: 10, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), flip = ease(prog(t, 8, hitOf(r)));
      wash(SIDERITE.dark, 0.25 * L);
      for (const E of r.to) fieldLines(U, E, 2, flip < 1 ? t : -t, L * (0.5 + 0.5 * Math.abs(1 - 2 * flip)));
    },
    front(r) {
      const t = r.t, B = perch(r.from), g = Math.PI * ease(prog(t, 8, hitOf(r))) + Math.PI / 2, c = Math.cos(g) * 5, s = Math.sin(g) * 5, L = hold(t, 0, r.end, 6);
      thick(B.x, B.y, B.x + c, B.y + s, SIDERITE.blue, L, SIDERITE.pale); thick(B.x, B.y, B.x - c, B.y - s, SIDERITE.tan, L, SIDERITE.iron);
      landed(r, (E, a) => { filings(E, Math.min(5, still(a, 6) + 1), fade(a, r.end - hitOf(r), 6)); sparks(E.x, E.y + 3, still(a, 6), 10, SIDERITE.pale, SIDERITE.blue, r.seed, 13, 12); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 3) }; },
  },
};

// ---------------------------------------------------------------- Kuoria (slag): the acid brew that bubbles in it

const SLAG = { dark: '#534a51', acid: '#7bfa5a', gray: '#9e8e87', deep: '#1c1a1c', pale: '#c8fcb8' };
/** An acid bubble: a green ring with a pale shine, two wide when big. */
function acidBubble(x: number, y: number, big: boolean, lv = 1): void { arc(x, y, big ? 2 : 1, big ? 2 : 1, SLAG.acid, lv); px(x - (big ? 1 : 0), y - (big ? 1 : 0), SLAG.pale, lv); }
/** A pool of acid at x, foot, w across, bubbles breaking on it with t. */
function acidPool(x: number, foot: number, w: number, t: number, lv = 1): void {
  oval(x, foot, w, Math.max(1, w * 0.25), SLAG.dark, lv); arc(x, foot, w, Math.max(1, w * 0.25), SLAG.acid, lv, 0.05, 0.45);
  for (let q = 0; q < 3; q++) { const k = (t + q * 5) % 12; if (k < 8) acidBubble(x - w + 2 + q * (w - 1), foot - (k >> 2), k > 5, lv); }
}

const SLAG_ART: Record<string, LegendArt> = {
  // Dross Hit: Kuoria stomps, and a gray crust breaks off the foe in flakes with acid green glinting in the cracks.
  slag_dross: {
    noLandings: true,
    front(r) { landed(r, (E, a) => { const s = still(a, 2); chunks(E.x, E.y - 1, s, 7, SLAG.gray, SLAG.dark, r.seed, 14, 1.4, 1.3); if (a < 12) for (let q = 0; q < 3; q++) px(E.x - 3 + q * 3, E.y - 2 + q, (a + q) & 2 ? SLAG.acid : SLAG.pale, fade(a, 12)); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Acid Run: acid spills down over every foe in green runs, pools at their feet, and fumes rise off it.
  slag_spill: {
    noLandings: true,
    back(r) { landed(r, (E, a) => acidPool(E.x, E.y + 5, Math.min(9, 3 + a), r.t, fade(a, r.end - hitOf(r), 6))); },
    front(r) { landed(r, (E, a) => { for (let q = 0; q < 4; q++) { const aa = a - q * 2; if (aa >= 0 && aa < 12) { px(E.x - 5 + q * 3, E.y - 4 + aa * 0.8, SLAG.acid, fade(aa, 12)); px(E.x - 5 + q * 3, E.y - 5 + aa * 0.8, SLAG.pale, 0.5 * fade(aa, 12)); } } puff(E.x, E.y - 2, a - 4, 16, SLAG.dark, SLAG.gray, 2, 0.4); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Brew Up: a gob of bubbling brew lobs over to the foe, bursts on it in green bubbles, and fumes rise.
  slag_pour: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); oval(p.x, p.y, 2, 2, SLAG.acid); px(p.x - 1, p.y - 1, SLAG.pale); acidBubble(p.x + 2, p.y - 2 - ((t >> 2) & 1), false); });
      landed(r, (E, a) => { for (let q = 0; q < 5; q++) { const aa = a - q; if (aa >= 0 && aa < 12) acidBubble(E.x - 4 + q * 2, E.y + 2 - aa * 0.6, q % 2 === 0, fade(aa, 12)); } puff(E.x, E.y, a - 3, 16, SLAG.dark, SLAG.gray, 3, 0.35); if (a < 3) oval(E.x, E.y, 3, 2, SLAG.acid, 1); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Melt Down: Kuoria runs with acid, a pool spreads round it bubbling, four drops of brew circle it, and it comes out clean.
  slag_remelt: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6); wash(SLAG.deep, 0.25 * L); acidPool(r.from.x, r.from.y + 5, Math.round(4 + 6 * ease(prog(t, 0, hitOf(r)))), t, L); },
    front(r) {
      const t = r.t, U = userAt(r), L = hold(t, 0, r.end, 6);
      for (let q = 0; q < 4; q++) { const aa = (t + q * 4) % 14; px(U.x - 4 + q * 3, U.y - 3 + aa * 0.6, SLAG.acid, L * (1 - aa / 14)); }
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = a / f.dur * Math.PI * 4 + f.i * Math.PI / 2, rr = 10 - 4 * a / f.dur; acidBubble(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.5, true); }
      landed(r, (_, a) => { if (a < 6) glint(U.x, U.y - 6, SLAG.acid, fade(a, 6)); });
      const a = t - lastOf(r); if (a >= 0) mends(U, a, SLAG.acid);
    },
  },
};

// ---------------------------------------------------------------- Vilasi (cullet): jagged shards of broken glass and violet glints

const CULLET = { glass: '#c3d3e3', violet: '#b565f3', dark: '#373352', deep: '#14121e' };
const SHARDS = [['g..', 'gg.', 'gwg'], ['.g', 'gg', 'wg', 'g.'], ['ggw', '.g.']];
/** A jagged shard of broken glass, one of three shapes by k, `s` times size, with a violet glint at its edge. */
function glassShard(x: number, y: number, k: number, s = 1, lv = 1): void { blit(SHARDS[k % 3], x, y, { g: CULLET.glass, w: W }, lv, s); px(x + s, y - s, CULLET.violet, lv); }
/** A glass mite: a small glass body on four violet legs that skitter with t. */
function mite(x: number, y: number, t: number, lv = 1): void { blit(['.gw.', 'gggg'], x, y, { g: CULLET.glass, w: W }, lv); const k = (t >> 1) & 1; for (const i of [-2, 1]) { px(x + i, y + 2, CULLET.violet, lv); px(x + i + 1 + (k ? 1 : -1), y + 2, CULLET.violet, lv); } }

const CULLET_ART: Record<string, LegendArt> = {
  // Glass Mites: two glass mites skitter over to the foe and cut it, and one comes back to stay by Vilasi.
  cullet_sliver: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, a = t - lastOf(r);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); mite(p.x, p.y + 3 + ((t >> 1) & 1), t); });
      landed(r, (E, aa, i) => { const n = Math.min(1, (still(aa, 1) + 1) / 3); if (aa < 8) line(E.x - 4 + i * 4, E.y - 3, E.x - 4 + i * 4 + 4 * n, E.y - 3 + 6 * n, i ? CULLET.violet : W, fade(aa, 8)); });
      if (a >= 0) { const u = ease(prog(a, 2, 14)), P = lerp(aim(r), { x: r.from.x + toward(r) * 9, y: r.from.y + 3 }, u); mite(P.x, P.y + 3, t, fade(a, r.end - lastOf(r), 6)); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Ringing Glass: thin rings of ringing glass run to the foe, and its voice breaks off it in a spray of glass bits.
  cullet_ring: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { for (let q = 0; q < 3; q++) { const v = Math.max(0, u - q * 0.12), p = lerp(r.from, E, v); arc(p.x, p.y, 2 + q, 2 + q, q % 2 ? CULLET.violet : CULLET.glass, 1 - q * 0.25, 0.3, 0.7); arc(p.x, p.y, 2 + q, 2 + q, q % 2 ? CULLET.violet : CULLET.glass, 1 - q * 0.25, 0.8, 1.2); } });
      landed(r, (E, a) => { ringOut(E.x, E.y, still(a, 2), 12, 9, CULLET.glass, 0.8); ringOut(E.x, E.y, still(a, 2) - 3, 12, 7, CULLET.violet, 0.8); if (a < 12) for (let q = 0; q < 4; q++) glassShard(E.x - 3 + q * 2 + (q - 1.5) * a * 0.5, E.y - 4 - a * 0.5 + 0.08 * a * a, q, 1, fade(a, 12)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Glass Visions: three violet afterimages close in on the foe and settle over it, glinting, and they stay.
  cullet_mirage: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, E2, i) => { const g = i / 3 * Math.PI * 2 + 0.5, S = { x: E2.x + Math.cos(g) * 16, y: E2.y + Math.sin(g) * 9 }, p = lerp(S, E2, ease(u)); for (let k = -4; k <= 4; k += 2) { px(p.x + k, p.y - 4, CULLET.violet); px(p.x + k, p.y + 4, CULLET.violet); px(p.x - 4, p.y + k, CULLET.violet); px(p.x + 4, p.y + k, CULLET.violet); } });
      if (n) { const L = hold(t, hitOf(r), r.end, 6); for (let q = 0; q < n; q++) { const o = (q - 1) * 2 + Math.round(Math.sin(t / 4 + q)); for (let k = -4; k <= 4; k += 2) { px(E.x + o + k, E.y - 4, CULLET.violet, 0.5 * L); px(E.x + o - 4, E.y + k, CULLET.violet, 0.5 * L); px(E.x + o + 4, E.y + k, CULLET.violet, 0.5 * L); } } }
      landed(r, (_, a, i) => { if (a < 6) glint(E.x - 3 + i * 3, E.y - 6, CULLET.violet, fade(a, 6)); });
    },
  },

  // Shard Grip: four big jagged shards close on the foe like a hand and bite in, and broken glass bursts from it.
  cullet_grip: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(CULLET.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, C = [[-1, -1], [1, -1], [-1, 1], [1, 1]], last = lastOf(r), a = t - last;
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const E = r.to[f.to] || r.to[0], [cx, cy] = C[f.i % 4], u = ease(aa / f.dur); glassShard(E.x + cx * (16 - 10 * u), E.y + cy * (11 - 6 * u), f.i, 2); }
      landed(r, (E, aa, i) => { const [cx, cy] = C[i % 4]; glassShard(E.x + cx * 6, E.y + cy * 5, i, 2, a >= 0 ? fade(a, r.end - last, 6) : 1); if (aa < 3) glint(E.x + cx * 4, E.y + cy * 3, CULLET.violet); });
      if (a >= 0) { const E = aim(r), s = still(a, 5); if (s < 14) for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2, d = 3 + s; glassShard(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7 + 0.05 * s * s, q, 1, fade(s, 14)); } }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Scorri (telson): the curled sting and its lime venom

const TELSON = { green: '#347433', lime: '#b1ef4e', dark: '#2f3c31', deep: '#121a12' };
/** The sting from base x, y curling toward `dir`: four segments up and over, then a hooked barb, `s` times size. */
function sting2(x: number, y: number, dir: number, curl: number, s = 1, lv = 1): void {
  let px0 = x, py0 = y;
  for (let k = 0; k < 4; k++) { const g = -Math.PI / 2 + dir * curl * (k + 1) * 0.55, nx = px0 + Math.cos(g) * 2.5 * s, ny = py0 + Math.sin(g) * 2.5 * s; oval(nx, ny, 1.2 * s, 1.2 * s, k % 2 ? TELSON.green : TELSON.lime, lv); px0 = nx; py0 = ny; }
  const g = -Math.PI / 2 + dir * curl * 2.75; line(px0, py0, px0 + Math.cos(g) * 3 * s, py0 + Math.sin(g) * 3 * s, W, lv); px(px0 + Math.cos(g) * 3 * s, py0 + Math.sin(g) * 3 * s, TELSON.lime, lv);
}
/** Venom running down from x, y, a frames on: three lime drops at different paces. */
function venom(x: number, y: number, a: number, lv = 1, life = 16): void { for (let q = 0; q < 3; q++) { const aa = a - q * 3; if (aa < 0 || aa >= life) continue; px(x - 3 + q * 3, y + aa * 0.5, TELSON.lime, lv * fade(aa, life)); px(x - 3 + q * 3, y + aa * 0.5 - 1, TELSON.green, lv * fade(aa, life)); } }

const TELSON_ART: Record<string, LegendArt> = {
  // Sting Tip: Scorri runs in with its sting curled over, stabs down into the foe, and lime venom runs off it.
  telson_barb: {
    noLandings: true,
    front(r) {
      const U = userAt(r), dir = toward(r), hit = hitOf(r);
      if (r.t < hit + 3) sting2(U.x - dir * 2, U.y - 2, dir, 0.6 + 0.4 * prog(r.t, 0, hit));
      landed(r, (E, a) => { const s = still(a, 2); if (s < 6) { line(E.x - dir * 4, E.y - 6, E.x, E.y - 1, W, fade(s, 6)); px(E.x, E.y - 1, TELSON.lime); } ringOut(E.x, E.y - 1, s, 8, 5, TELSON.lime, 0.7); venom(E.x, E.y, a - 2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Venom Pool: lime venom seeps up out of the ground under every foe into pools, and fumes come off them.
  telson_seep: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6), w = Math.min(9, 3 + a); oval(E.x, E.y + 5, w, w * 0.25, TELSON.dark, L); arc(E.x, E.y + 5, w, w * 0.25, TELSON.lime, L, 0.05, 0.45); px(E.x - 2, E.y + 5, TELSON.lime, L); }); },
    front(r) { landed(r, (E, a) => { puff(E.x - 3, E.y + 2, a - 3, 16, TELSON.green, TELSON.dark, 2, 0.4); puff(E.x + 3, E.y + 2, a - 6, 16, TELSON.green, TELSON.dark, 2, 0.4); for (let q = 0; q < 3; q++) { const aa = (a + q * 5) % 15; px(E.x - 4 + q * 4, E.y + 4 - aa * 0.4, TELSON.lime, fade(a, r.end - hitOf(r), 6) * (1 - aa / 15)); } }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Venom Jet: Scorri squirts a jet of venom from its sting straight at the foe, and it splashes lime over it.
  telson_pincer: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r), dir = toward(r);
      if (r.t < hitOf(r) + 2) sting2(U.x - dir * 2, U.y - 2, dir, 1);
      inbound(r, (u, E) => { const tip = { x: U.x + dir * 3, y: U.y - 9 }, p = lerp(tip, E, u), b = lerp(tip, E, Math.max(0, u - 0.3)); line(b.x, b.y, p.x, p.y, TELSON.lime); px(p.x, p.y, W); });
      landed(r, (E, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.6, vy = -1.2 - hash(r.seed + q) * 0.7; px(E.x + vx * s, E.y + vy * s + 0.13 * s * s, q % 2 ? TELSON.lime : W, fade(s, 12)); } venom(E.x, E.y - 1, a - 3); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Deep Sting: the field darkens, Scorri's sting rears high and curls, and it drives deep into the foe in rings of venom.
  telson_cripple: {
    lead: 10, noLandings: true,
    back(r) { wash(TELSON.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), hit = hitOf(r);
      if (t < hit + 2) sting2(U.x - dir * 3, U.y - 2, dir, 0.5 + 0.5 * ease(prog(t, 0, 10)), 1.6);
      landed(r, (E, a) => {
        const s = still(a, 6);
        if (s < 8) { line(E.x - dir * 6, E.y - 9, E.x, E.y - 1, W, fade(s, 8)); line(E.x - dir * 6 + 1, E.y - 9, E.x + 1, E.y - 1, TELSON.lime, fade(s, 8)); }
        for (let q = 0; q < 3; q++) ringOut(E.x, E.y, s - q * 3, 14, 10, q % 2 ? TELSON.green : TELSON.lime, 0.7);
        venom(E.x, E.y, a - 4, 1, 20); puff(E.x, E.y - 2, a - 8, 16, TELSON.green, TELSON.dark, 3, 0.4);
      });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Spitoge (cholla): spined cactus joints that jump and cling

const CHOLLA = { green: '#7ba051', spine: '#efe7af', dark: '#4a5930', deep: '#141a0e' };
/** A cactus joint: a green oval with pale spines standing off it all round, `s` times size. */
function joint(x: number, y: number, s = 1, lv = 1): void {
  oval(x, y, 2 * s, 1.5 * s, CHOLLA.green, lv); px(x - s, y - s * 0.6, CHOLLA.spine, lv);
  for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + 0.3; px(x + Math.cos(g) * (2 * s + 1), y + Math.sin(g) * (1.5 * s + 1), CHOLLA.spine, lv); }
}
/** Spines bursting out of a spot, a frames after: pale strokes flying out. */
function spineBurst(x: number, y: number, a: number, n = 8, life = 10): void { if (a < 0 || a >= life) return; for (let q = 0; q < n; q++) { const g = q / n * Math.PI * 2 + 0.2, d = 2 + a * 0.9; line(x + Math.cos(g) * d, y + Math.sin(g) * d * 0.8, x + Math.cos(g) * (d + 1.5), y + Math.sin(g) * (d + 1.5) * 0.8, CHOLLA.spine, fade(a, life)); } }

const CHOLLA_ART: Record<string, LegendArt> = {
  // Jump On: a joint jumps off Spitoge at the foe, hooks into it, and its spines burst out.
  cholla_jump: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = sagAt(r.from, E, u, -4); joint(p.x, p.y); });
      landed(r, (E, a) => { joint(E.x + 2, E.y - 1, 1, fade(a, r.end - hitOf(r), 6)); spineBurst(E.x + 2, E.y - 1, still(a, 2)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Joint Drop: Spitoge shakes and joints drop on every foe and cling, while its own spines bristle round it as a guard.
  cholla_jointdrop: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      inbound(r, (u, E, i) => { const x = E.x + (i - 1.5) * 4, y = E.y - (high(E) ? 16 : 26) * (1 - u * u); joint(x, y); });
      landed(r, (E, a, i) => { const x = E.x + ((i % 4) - 1.5) * 4; joint(x, E.y + 1 - (i & 1) * 3, 1, fade(a, r.end - r.hits[i].at, 6)); spineBurst(x, E.y, a, 5, 6); });
      const a = t - hitOf(r); if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 10; q++) { const g = q / 10 * Math.PI * 2; line(U.x + Math.cos(g) * 6, U.y + Math.sin(g) * 5, U.x + Math.cos(g) * 8, U.y + Math.sin(g) * 6.5, CHOLLA.spine, L); } }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Burst Pad: a fat pad of cactus lobs over to the foe and bursts on it in a spray of spines and green juice.
  cholla_spinebed: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); joint(p.x, p.y, 1.5); });
      landed(r, (E, a) => { const s = still(a, 2); spineBurst(E.x, E.y, s, 10, 12); if (s < 12) for (let q = 0; q < 5; q++) px(E.x + (q - 2) * 0.6 * s, E.y + 2 - 1.3 * s + 0.12 * s * s, q % 2 ? CHOLLA.green : CHOLLA.spine, fade(s, 12)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Cholla Grab: Spitoge runs in, four joints close on the foe from all round and cling, and every spine in it flashes as it goes deep.
  cholla_grab: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(CHOLLA.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, C = [[-1, -1], [1, -1], [-1, 1], [1, 1]], last = lastOf(r), a = t - last;
      smear(r, CHOLLA.spine, CHOLLA.green, 10);
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const E = r.to[f.to] || r.to[0], [cx, cy] = C[f.i % 4], u = ease(aa / f.dur); joint(E.x + cx * (16 - 11 * u), E.y + cy * (10 - 6 * u), 1.3); }
      landed(r, (E, aa, i) => { const [cx, cy] = C[i % 4]; joint(E.x + cx * 5, E.y + cy * 4, 1.3, a >= 0 ? fade(a, r.end - last, 6) : 1); });
      if (a >= 0) { const E = aim(r); spineBurst(E.x, E.y, still(a, 5), 12, 14); if (a >= 6) circling(E, a, 3, (x, y) => px(x, y, CHOLLA.spine, fade(a, r.end - last, 5))); }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Sunaka (erg): blown sand and the red coral of its dead reef

const ERG = { sand: '#efe7d7', dark: '#5b4d60', coral: '#8d0101', bright: '#d84040', tan: '#c8b898', deep: '#1c1820' };
/** A coral polyp: a branching red twig with a bright tip on each branch, `s` times size. */
function polyp(x: number, y: number, s = 1, lv = 1): void { blit(['b.b.b', 'c.c.c', '.ccc.', '..c..'], x, y, { c: ERG.coral, b: ERG.bright }, lv, s); }
/** Sand blowing along at y from x0 to x1: streaks of pale and tan that run with t. */
function sandStreaks(x0: number, x1: number, y: number, t: number, lv = 1, dir = 1): void { for (let q = 0; q < 6; q++) { const k = ((t * 2 * dir + q * 7) % (x1 - x0) + (x1 - x0)) % (x1 - x0), x = x0 + k; line(x, y + (q % 3) * 2, x + 2 * dir, y + (q % 3) * 2, q % 2 ? ERG.sand : ERG.tan, lv); } }

const ERG_ART: Record<string, LegendArt> = {
  // Polyp Rush: Sunaka's polyps rush through every foe on streams of sand, one after another, each bursting in grit.
  erg_sandblast: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y + 1 + (f.i - 1) * 2; polyp(x, y - 2); for (let k = 1; k < 6; k++) px(x - dir * k * 1.5, y + 2 + (k & 1), k < 3 ? ERG.sand : ERG.tan, k < 5 ? 1 : 0.5); }
      landed(r, (E, a, i) => sparks(E.x, E.y + 1, still(a, i ? 0 : 2), 6, ERG.sand, ERG.tan, r.seed + i, 7, 8));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Bud Polyp: grains of sand hop over to the foe in little bounds and sting it, and a new red polyp buds beside Sunaka.
  erg_saltation: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, a = t - hitOf(r);
      inbound(r, (u, E) => { for (let q = 0; q < 4; q++) { const v = Math.max(0, u - q * 0.06), p = lerp(r.from, E, v), hop = Math.abs(Math.sin(v * Math.PI * 5)) * 4; px(p.x, p.y - hop, q ? ERG.tan : ERG.sand); } });
      landed(r, (E, aa) => sparks(E.x, E.y, still(aa, 2), 7, ERG.sand, ERG.bright, r.seed, 7, 8));
      if (a >= 0) { const P = { x: r.from.x + toward(r) * 10, y: r.from.y + 2 }, g = Math.min(1, a / 8); polyp(P.x, P.y + 3 * (1 - g), 1, fade(a, r.end - hitOf(r), 6)); if (a < 6) glint(P.x, P.y - 3, ERG.bright, fade(a, 6)); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Sand Over: a slip face of sand pours down beside the foe over the reserve waiting behind it and buries it in a mound.
  erg_slipface: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), R = { x: E.x + (high(E) ? 12 : -12), y: E.y + 5 }, n = r.hits.filter(h => t >= h.at).length; if (n) { const L = hold(t, hitOf(r), r.end, 6), h = Math.min(4, 1 + Math.ceil(n * 0.6)), w = 4 + n; for (let j = 0; j < h; j++) { const half = Math.round(w * (1 - j / h)); line(R.x - half, R.y - j, R.x + half, R.y - j, j === h - 1 ? ERG.sand : j % 2 ? ERG.tan : '#a89878', L); } px(R.x - 2, R.y - h, ERG.coral, L); px(R.x + 1, R.y - h + 1, ERG.coral, L); } },
    front(r) {
      const t = r.t, E = aim(r), R = { x: E.x + (high(E) ? 12 : -12), y: E.y + 5 };
      inbound(r, (u, _, i) => { const x = R.x - 3 + i * 1.5, top = R.y - (high(E) ? 16 : 24); for (let k = 0; k < 3; k++) px(x + k * 0.5, top + (R.y - top) * Math.max(0, u - k * 0.05), k ? ERG.tan : ERG.sand); });
      landed(r, (_, a, i) => { if (i === 0) sparks(E.x, E.y, still(a, 2), 6, ERG.sand, ERG.tan, r.seed, 7, 8); });
      const a = t - hitOf(r); if (a >= 0) { arc(r.from.x, r.from.y + 1, 7, 6, ERG.sand, 0.5 * fade(a, r.end - hitOf(r), 6), 0.5, 1); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Reef Rises: sand streams over the field, and a wall of red coral reef rises out of it before the foes, driving them back.
  erg_dunewall: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6); wash(ERG.deep, 0.25 * L); for (const E of r.to) sandStreaks(E.x - 16, E.x + 16, E.y + 3, t, 0.75 * L, toward(r)); },
    front(r) {
      const t = r.t, n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, E, i) => polyp(E.x - 10 + i * 4, E.y + 8 - 6 * u, 1));
      for (const E of r.to) {
        if (!n) continue;
        const L = hold(t, hitOf(r), r.end, 6), dir = toward(r), wx = E.x - dir * 8;
        for (let q = 0; q < Math.min(6, n); q++) polyp(wx + (q % 2) * 2 - 1, E.y + 4 - q * 2, 1, L);
        line(wx - 3, E.y + 5, wx + 3, E.y + 5, ERG.sand, L);
      }
      landed(r, (E, a, i) => { if (i === r.hits.length - 1) for (let q = 0; q < 4; q++) puff(E.x + (high(E) ? 4 : -4) + q * (high(E) ? 3 : -3), E.y + 4, a - q * 2, 14, ERG.tan, ERG.sand, 2, 0.1); });
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 3) || shake(r.t - hitOf(r), 4, 1), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Haze (haze): the three weathers it holds: glare, waver, and dew

const HAZE = { pale: '#e9ddc1', amber: '#dc9307', blue: '#4281ae', light: '#9cc8e8', deep: '#1c1a24' };
/** A weather held in its mouth: 0 glare (an amber sun with rays), 1 waver (two pale wavy strokes), 2 dew (a blue drop). */
function weather(k: number, x: number, y: number, t: number, lv = 1): void {
  if (k === 0) { oval(x, y, 1, 1, HAZE.amber, lv); px(x, y, W, lv); for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2 + (t >> 2) * 0.4; px(x + Math.cos(g) * 3, y + Math.sin(g) * 3, HAZE.amber, lv); } }
  else if (k === 1) { for (let i = -2; i <= 2; i++) { px(x + i, y - 1 + Math.round(Math.sin(i + t * 0.4)), HAZE.pale, lv); px(x + i, y + 1 + Math.round(Math.sin(i + t * 0.4 + 1)), HAZE.pale, 0.75 * lv); } }
  else blit(['.l.', 'lbl', 'bbb', '.b.'], x, y, { l: HAZE.light, b: HAZE.blue }, lv);
}
/** Heat waver over a whorl: pale wavy strokes that shimmer across it. */
function waverOn(E: Pt, t: number, lv = 1): void { for (let q = 0; q < 3; q++) for (let i = -5; i <= 5; i++) if ((i + q + (t >> 1)) % 4) px(E.x + i, E.y - 3 + q * 3 + Math.round(Math.sin((i + t) / 2 + q)), HAZE.pale, 0.5 * lv); }

const HAZE_ART: Record<string, LegendArt> = {
  // Hard Glare: Haze opens its mouth on a glare and throws a blinding amber beam with rays standing off it, and the foe flashes.
  haze_glare: {
    tail: 6, noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), go = leaveOf(r), on = hold(t, go, hitOf(r) + 12, 2);
      if (t < go + 2) weather(0, U.x, U.y - 7, t);
      if (on > 0) { const dx = E.x - U.x, dy = E.y - U.y, d = Math.hypot(dx, dy) || 1, n = d * Math.min(1, (t - go + 1) / 3); for (let i = 0; i <= n; i++) { const x = U.x + dx / d * i, y = U.y + dy / d * i; px(x, y, W, on); px(x - dy / d, y + dx / d, HAZE.amber, on); px(x + dy / d, y - dx / d, HAZE.amber, on); if (i % 6 === 3) { px(x - dy / d * 3, y + dx / d * 3, HAZE.amber, 0.75 * on); px(x + dy / d * 3, y - dx / d * 3, HAZE.amber, 0.75 * on); } } }
      landed(r, (E2, a) => { if (a < 8) for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2, d = 3 + a; line(E2.x + Math.cos(g) * d, E2.y + Math.sin(g) * d * 0.8, E2.x + Math.cos(g) * (d + 2), E2.y + Math.sin(g) * (d + 2) * 0.8, q % 2 ? HAZE.amber : W, fade(a, 8)); } });
    },
  },

  // Heat Wobble: three ripples of heat waver across to the foe, and its outline wobbles in the shimmer they leave.
  haze_waver: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r);
      if (t < leaveOf(r) + 2) weather(1, U.x, U.y - 7, t);
      inbound(r, (u, E2, i) => { const p = lerp(r.from, E2, u), dx = E2.x - r.from.x, dy = E2.y - r.from.y, d = Math.hypot(dx, dy) || 1; for (let k = -3; k <= 3; k++) { const o = Math.sin(k * 0.9 + t * 0.6 + i) * 1.5; px(p.x - dy / d * k + dx / d * o, p.y + dx / d * k + dy / d * o, k ? HAZE.pale : W); } });
      const n = r.hits.filter(h => t >= h.at).length;
      if (n) waverOn(E, t, hold(t, hitOf(r), r.end, 6) * (0.5 + n / 6));
    },
  },

  // Night Dew: drops of dew fall on the foe and burst, and dew beads on Haze too as it mends.
  haze_dew: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r) + 2) weather(2, U.x, U.y - 7, t);
      inbound(r, (u, E, i) => weather(2, E.x + (i - 1) * 4, E.y - (high(E) ? 14 : 24) * (1 - u * u), t));
      landed(r, (E, a, i) => { const x = E.x + (i - 1) * 4, s = a; if (s < 10) for (let q = 0; q < 4; q++) px(x + (q - 1.5) * 0.7 * s, E.y - 1 - 1.2 * s + 0.12 * s * s, q % 2 ? HAZE.light : W, fade(s, 10)); });
      const a = t - hitOf(r); if (a >= 0) { mends(U, a, HAZE.light); for (let q = 0; q < 3; q++) px(U.x - 3 + q * 3, U.y - 3 + (q & 1) * 3, HAZE.light, fade(a, r.end - hitOf(r), 6)); }
    },
  },

  // Weather Mix: glare, waver, and dew spiral out of Haze's mouth together, and each lands on the foes as its own weather.
  haze_thermal: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(HAZE.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r)) for (let k = 0; k < 3; k++) { const g = t * 0.25 + k * 2.1; weather(k, U.x + Math.cos(g) * 6, U.y - 6 + Math.sin(g) * 2, t); }
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u), o = Math.sin(u * Math.PI * 6 + i * 2) * 5 * (1 - u); weather(i % 3, p.x + o, p.y + Math.cos(u * Math.PI * 6 + i * 2) * 2 * (1 - u), t); });
      landed(r, (E, a, i) => {
        const k = i % 3, s = still(a, i === 2 ? 5 : 1);
        if (k === 0 && s < 8) for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2, d = 3 + s; line(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.8, E.x + Math.cos(g) * (d + 2), E.y + Math.sin(g) * (d + 2) * 0.8, HAZE.amber, fade(s, 8)); }
        if (k === 1) waverOn(E, t, fade(a, 14));
        if (k === 2 && s < 12) for (let q = 0; q < 6; q++) px(E.x + (q - 2.5) * 0.7 * s, E.y + 1 - 1.3 * s + 0.12 * s * s, q % 2 ? HAZE.light : W, fade(s, 12));
      });
      const a = t - lastOf(r); if (a >= 0) mends(U, a, HAZE.light);
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Calkuro (bonedry): bleached bone, cracks, and a green glow in the sockets

const BONEDRY = { bone: '#efebe3', green: '#39e163', dark: '#34403a', dust: '#c8c0a8', deep: '#101612' };
/** A crack running from x, y along `ang` for len: a dark zigzag with green showing in it. */
function boneCrack(x: number, y: number, ang: number, len: number, lv = 1): void {
  let cx = x, cy = y;
  for (let i = 0; i < len; i++) { const j = (i & 1 ? 1 : -1) * 0.7, nx = cx + Math.cos(ang) + Math.cos(ang + Math.PI / 2) * j * (i % 3 === 0 ? 1 : 0), ny = cy + Math.sin(ang) + Math.sin(ang + Math.PI / 2) * j * (i % 3 === 0 ? 1 : 0); px(nx, ny, BONEDRY.dark, lv); if (i % 3 === 1) px(nx + 1, ny, BONEDRY.green, lv); cx = nx; cy = ny; }
}
/** A small skull: bone white with two green-lit sockets. */
function skull(x: number, y: number, lv = 1, s = 1): void { blit(['.bbb.', 'bgbgb', 'bbbbb', '.b.b.'], x, y, { b: BONEDRY.bone, g: BONEDRY.green }, lv, s); }
/** A bone in flight, turning with t: a white shaft with knobs. */
function boneSpin(x: number, y: number, t: number, lv = 1): void { const g = t * 0.5, c = Math.cos(g) * 2.5, s = Math.sin(g) * 2.5; line(x - c, y - s, x + c, y + s, BONEDRY.bone, lv); px(x - c - 0.7, y - s, BONEDRY.bone, lv); px(x + c + 0.7, y + s, BONEDRY.bone, lv); }

const BONEDRY_ART: Record<string, LegendArt> = {
  // Dry Bite: Calkuro's jaws of bleached bone close on the foe, and dry dust puffs off it instead of blood.
  bonedry_marrow: {
    noLandings: true,
    front(r) {
      smear(r, BONEDRY.bone, BONEDRY.dust, 9);
      landed(r, (E, a) => { const s = still(a, 2), gap = Math.max(0, 5 - s * 1.7), L = fade(a, 12, 4); for (let i = -4; i <= 4; i++) { px(E.x + i, E.y - 2 - gap + (i & 1), BONEDRY.bone, L); px(E.x + i, E.y + 2 + gap - (i & 1), BONEDRY.bone, L); } puff(E.x - 2, E.y + 2, a - 3, 14, BONEDRY.dust, BONEDRY.bone, 2, 0.3); puff(E.x + 3, E.y, a - 5, 14, BONEDRY.dust, BONEDRY.bone, 2, 0.3); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Bleached Stare: the field dims, green light kindles in Calkuro's sockets, a green ball flies at the foe, and a ring of bone locks round it.
  bonedry_stare: {
    noFlights: true, noLandings: true,
    back(r) { wash(BONEDRY.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r);
      if (t < go + 4) { px(U.x - 2, U.y - 1, BONEDRY.green, prog(t, 0, go)); px(U.x + 1, U.y - 1, BONEDRY.green, prog(t, 0, go)); px(U.x - 2, U.y - 2, W, prog(t, 2, go)); }
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); oval(p.x, p.y, 1.5, 1.5, BONEDRY.green); px(p.x, p.y, W); arc(p.x, p.y, 3, 3, BONEDRY.bone, 0.75, t * 0.05, t * 0.05 + 0.6); });
      landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); arc(E.x, E.y, 6, 5, BONEDRY.bone, L); for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2 + 0.78; px(E.x + Math.cos(g) * 6, E.y + Math.sin(g) * 5, BONEDRY.green, L); } if (a < 3) glint(E.x, E.y, BONEDRY.green); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Crack Open: two chips of bone circle Calkuro, and cracks open across it one after the other with green light inside.
  bonedry_crack: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = a / f.dur * Math.PI * 4 + f.i * Math.PI, rr = 10 - 4 * a / f.dur; boneSpin(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, t); }
      landed(r, (_, a, i) => { const L = fade(a, r.end - r.hits[i].at, 6), n = Math.min(7, 2 + a); boneCrack(U.x + (i ? 2 : -2), U.y - 4, Math.PI / 2 + (i ? -0.4 : 0.4), n, L); if (a < 4) glint(U.x + (i ? 2 : -2), U.y - 4, BONEDRY.green); });
    },
  },

  // Ossuary: bones rise out of the ground before Calkuro, rattle together, and stand up as small skeletons with green eyes.
  bonedry_ossuary: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(BONEDRY.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = r.from, dir = toward(r), n = r.hits.filter(h => t >= h.at).length, last = lastOf(r), a = t - last;
      const spots = [{ x: U.x + dir * 9, y: U.y + 1 }, { x: U.x + dir * 15, y: U.y + 3 }, { x: U.x - dir * 9, y: U.y + 2 }];
      inbound(r, (u, _, i) => boneSpin(spots[i % 3].x + (i > 2 ? 2 : 0), U.y + 6 - 8 * u, t));
      if (a < 0) { for (let q = 0; q < Math.min(3, n); q++) for (let k = 0; k < 2; k++) boneSpin(spots[q].x + (k ? 2 : -2), spots[q].y + 3, 0); return; }
      for (let q = 0; q < 3; q++) { const S = spots[q], L = fade(a - q * 2, r.end - last, 6), up = Math.min(3, Math.max(0, a - q * 2) * 0.5); skull(S.x, S.y - 3 - up, L); line(S.x, S.y - up, S.x, S.y + 3, BONEDRY.bone, L); line(S.x - 2, S.y + 1 - up * 0.5, S.x + 2, S.y + 1 - up * 0.5, BONEDRY.bone, L); }
    },
  },
};

// ---------------------------------------------------------------- Hasafex (shears): the blades closing and the snip they leave

const SHEARS = { steel: '#bdc5d1', red: '#b90e1d', brass: '#bf9008', deep: '#1a181e' };
/** A pair of blades on a brass pivot at x, y, pointing along `ang`, opened by `open` (0 shut), `len` long. */
function blades(x: number, y: number, ang: number, open: number, len: number, lv = 1): void {
  for (const s of [-1, 1]) { const g = ang + s * open * 0.5; line(x, y, x + Math.cos(g) * len, y + Math.sin(g) * len, s > 0 ? W : SHEARS.steel, lv); const hg = ang + Math.PI - s * open * 0.4; line(x, y, x + Math.cos(hg) * len * 0.6, y + Math.sin(hg) * len * 0.6, SHEARS.red, lv); }
  px(x, y, SHEARS.brass, lv);
}
/** A snip on a whorl, a frames after: a white X that closes, with a red flick under it. */
function snip(x: number, y: number, a: number, s = 1): void { if (a < 0 || a >= 8) return; const n = Math.max(1, 4 - a) * s, L = fade(a, 8, 3); line(x - n, y - n, x + n, y + n, W, L); line(x - n, y + n, x + n, y - n, SHEARS.steel, L); px(x, y + 1, SHEARS.red, L); }

const SHEARS_ART: Record<string, LegendArt> = {
  // Snip Snip: Hasafex runs in with its blades open and snips the foe twice, two white crosses closing on it.
  shears_snip: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), ang = Math.atan2(E.y - r.from.y, E.x - r.from.x);
      smear(r, SHEARS.steel, SHEARS.red, 8);
      if (t < lastOf(r) + 2) blades(U.x, U.y, ang, 0.9 * Math.abs(Math.cos(t * 0.5)), 7);
      landed(r, (E2, a, i) => snip(E2.x + (i ? 2 : -2), E2.y - 1 + i * 2, a));
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 3, 1) || shake(r.t - lastOf(r), 4, 1) }; },
  },

  // Prune Back: blades snip round the foe three times, and the good things on it fall off as cut leaves.
  shears_lop: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E, i) => { const g = i / 3 * Math.PI * 2 + 0.5, S = { x: E.x + Math.cos(g) * 14, y: E.y + Math.sin(g) * 9 }, p = lerp(S, E, ease(u)); blades(p.x, p.y, g + Math.PI, 0.9, 5); });
      landed(r, (E, a, i) => { const g = i / 3 * Math.PI * 2 + 0.5, x = E.x + Math.cos(g) * 5, y = E.y + Math.sin(g) * 4; snip(x, y, a); if (a < 16) leafAt(x + Math.sin(a / 3) * 2, y + a * 0.5, a >> 2, fade(a, 16)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Oil Pivot: a drop of oil runs down onto Hasafex's pivot, the brass gleams, and the blades swing open, waiting.
  shears_oil: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), a = t - hit, dir = toward(r);
      if (a < 0) { const y = U.y - 12 + 10 * prog(t, 0, hit); blit(['.b.', 'bwb', '.b.'], U.x, y, { b: SHEARS.brass, w: W }); return; }
      const L = fade(a, r.end - hit, 6); blades(U.x, U.y - 1, dir > 0 ? 0 : Math.PI, Math.min(1.2, a * 0.2), 8, L); if (a < 6) glint(U.x, U.y - 1, SHEARS.brass);
    },
  },

  // One Branch: great blades close on the foe from both sides and snap shut, and a red cord ties it to Hasafex for the duel.
  shears_lockblades: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(SHEARS.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), last = lastOf(r), a = t - last;
      inbound(r, (u, E2, i) => { const s = i ? 1 : -1, x = E2.x + s * (16 - 12 * ease(u)); line(x, E2.y - 7, x - s * 4, E2.y + 6, i ? W : SHEARS.steel); line(x + s, E2.y - 7, x - s * 3, E2.y + 6, SHEARS.steel); px(x, E2.y - 7, SHEARS.brass); });
      landed(r, (E2, aa) => snip(E2.x, E2.y, still(aa, 4), 2));
      if (a >= 2) { const L = fade(a, r.end - last, 6), n = Math.round(Math.hypot(E.x - U.x, E.y - U.y)); for (let i = 0; i <= n; i += 2) { const p = sagAt(U, E, i / Math.max(1, n), 4); px(p.x, p.y, SHEARS.red, L); } arc(E.x, E.y + 1, 6, 3, SHEARS.red, L); }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Tebukas (glove): the gardener's hand, open and closing

const GLOVE = { leather: '#d3bb8b', red: '#8b1a30', green: '#378847', dirt: '#6a4a2a', deep: '#1a1410' };
const HAND_OPEN = ['l.l.l.', 'l.l.l.', 'llllll', 'lllll.', '.rrr..'];
const HAND_FIST = ['......', '.llll.', 'llllll', 'lllll.', '.rrr..'];
/** The glove at x, y, `s` times size, open or a fist, its thumb toward `dir`. */
function glove(x: number, y: number, s: number, open: boolean, dir: number, lv = 1): void { blit(open ? HAND_OPEN : HAND_FIST, x, y, { l: GLOVE.leather, r: GLOVE.red }, lv, s, dir < 0); px(x + dir * 3 * s, y - s, GLOVE.leather, lv); }
/** A weed pulled up: a green tuft over a clod of dirt with roots hanging off it. */
function weed(x: number, y: number, lv = 1): void { blit(['g.g', '.g.', 'ddd', 'd.d'], x, y, { g: GLOVE.green, d: GLOVE.dirt }, lv); }

const GLOVE_ART: Record<string, LegendArt> = {
  // Weed Pull: Tebukas yanks a weed out of the ground clod and all, throws it over, and it bursts on the foe in dirt and leaves.
  glove_grub: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), dir = toward(r);
      if (t < go) { glove(U.x + dir * 5, U.y + 2 - 3 * prog(t, 2, go), 1, false, dir); weed(U.x + dir * 5, U.y + 5 - 4 * prog(t, 2, go)); }
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); weed(p.x, p.y); });
      landed(r, (E, a) => { const s = still(a, 2); chunks(E.x, E.y, s, 6, GLOVE.dirt, GLOVE.green, r.seed, 14, 1.3, 1.3); if (a < 14) leafAt(E.x + 3 + Math.sin(a / 3) * 2, E.y - 4 + a * 0.5, a >> 2, fade(a, 14)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Lend a Hand: a great open glove rises behind Tebukas palm up, and a friend's outline springs off it toward the foe in a gold arc.
  glove_springoff: {
    noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), a = t - hit, dir = toward(r), H = { x: U.x - dir * 6, y: U.y - 4 };
      glove(H.x, H.y + 4 * (1 - ease(prog(t, 0, 8))), 2, true, dir, hold(t, 0, r.end, 6));
      if (a >= -4) { const u = prog(a, -4, 14), F = across(U), p = sagAt({ x: H.x, y: H.y - 6 }, lerp(H, F, 0.4), u, -12); if (u > 0 && u < 1) { for (let i = -3; i <= 3; i++) { px(p.x + i, p.y - 3, W, 0.75); px(p.x + i, p.y + 3, W, 0.75); px(p.x - 3, p.y + i, W, 0.75); px(p.x + 3, p.y + i, W, 0.75); } glint(p.x, p.y, GLOVE.leather); } }
    },
  },

  // Green Thumb: three leaves fly from Tebukas into the foe and bloom there, and a green thumb stands up over its own side.
  glove_helping: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u); leafAt(p.x, p.y + (i - 1) * 2, t >> 2); });
      landed(r, (E, a, i) => { const x = E.x - 4 + i * 4, g = Math.min(1, a / 5), L = fade(a, r.end - r.hits[i].at, 6); for (let q = 0; q < 5; q++) { const ang = q / 5 * Math.PI * 2; px(x + Math.cos(ang) * (1 + 2 * g), E.y - 2 + Math.sin(ang) * (1 + 1.5 * g), q % 2 ? GLOVE.red : GLOVE.green, L); } px(x, E.y - 2, W, L); });
      const a = t - hitOf(r); if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6), y = U.y - 10; blit(['.g.', '.g.', 'ggg', 'ggg'], U.x, y, { g: GLOVE.green }, L); mends(U, a, GLOVE.green); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Let Loose: a great fist over Tebukas opens finger by finger, four gold sparks circle it, and it bursts free.
  glove_unclench: {
    noFlights: true, noLandings: true,
    back(r) { wash(GLOVE.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), n = r.hits.filter(h => t >= h.at).length, B = perch(r.from);
      glove(B.x, B.y, 2, n >= 2, dir, hold(t, 0, r.end, 6));
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = a / f.dur * Math.PI * 4 + f.i * Math.PI / 2, rr = 11 - 4 * a / f.dur; glint(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, '#f0c060'); }
      landed(r, (_, a, i) => { if (i === r.hits.length - 1) sparks(B.x, B.y, still(a, 5), 10, '#f0c060', GLOVE.leather, r.seed, 12, 12); });
    },
  },
};

// ---------------------------------------------------------------- Surcuki (scion): the graft, bark joined to pale wood, and its buds

const SCION = { bark: '#816248', pale: '#84a2c1', red: '#791723', light: '#b4c8dc', deep: '#140e10' };
/** A grafted shoot from a to b, `n` of the way: bark for its first half, pale wood past a red-wrapped union, and a bud at its tip. */
function graft(a: Pt, b: Pt, n: number, lv = 1): void {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, m = Math.round(d * n);
  for (let i = 0; i <= m; i++) { const p = lerp(a, b, i / d), u = i / d; px(p.x, p.y, Math.abs(u - 0.5) < 0.04 ? SCION.red : u < 0.5 ? SCION.bark : SCION.pale, lv); if (i % 5 === 2) px(p.x, p.y - 1, u < 0.5 ? SCION.bark : SCION.light, lv); }
  const p = lerp(a, b, m / d); px(p.x, p.y - 1, SCION.red, lv); px(p.x + 1, p.y - 1, W, lv);
}
/** A cleft cut: a V of bark and pale wood opening on a whorl, `n` of the way. */
function cleft(E: Pt, n: number, lv = 1): void { line(E.x - 5, E.y - 6, E.x - 5 + 5 * n, E.y - 6 + 10 * n, SCION.bark, lv); line(E.x + 5, E.y - 6, E.x + 5 - 5 * n, E.y - 6 + 10 * n, SCION.pale, lv); if (n >= 1) px(E.x, E.y + 4, W, lv); }

const SCION_ART: Record<string, LegendArt> = {
  // Graft Slash: Surcuki dashes in and cuts a cleft into the foe, one side bark and one side pale wood, and splinters of both fly.
  scion_cleft: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, SCION.pale, SCION.bark, 9);
      landed(r, (E, a) => { const s = still(a, 2); if (a < 12) cleft(E, Math.min(1, (s + 1) / 3), fade(a, 12, 4)); chunks(E.x, E.y, s, 6, SCION.bark, SCION.pale, r.seed, 12, 1.2, 1.2); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Long Shoot: a long grafted shoot grows out of Surcuki to the foe, buds along it, and jabs it with its tip.
  scion_budding: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r);
      inbound(r, (u, E) => graft(U, E, ease(u)));
      landed(r, (E, a) => { if (a < 8) graft(U, E, 1, 1 - a / 8); sparks(E.x, E.y, still(a, 2), 6, SCION.light, SCION.red, r.seed, 7, 8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Splice In: Surcuki splices a wedge of pale wood into the foe, blue sap splashes, and the joint mends Surcuki.
  scion_splice: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = userAt(r), dir = toward(r);
      smear(r, SCION.pale, SCION.light, 9);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); blit(['pp.', 'ppp', 'pp.'], p.x, p.y, { p: SCION.pale }, 1, 1, dir < 0); });
      landed(r, (E, a) => { const s = still(a, 2); blit(['pp.', 'ppp', 'pp.'], E.x - dir * 2, E.y, { p: SCION.pale }, fade(a, 14, 5), 1, dir < 0); line(E.x - dir * 4, E.y - 2, E.x - dir * 4, E.y + 2, SCION.red, fade(a, 14, 5)); if (s < 12) for (let q = 0; q < 5; q++) px(E.x + (q - 2) * 0.6 * s, E.y - 1.3 * s + 0.12 * s * s, q % 2 ? SCION.light : W, fade(s, 12)); mends(U, a - 2, SCION.light); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Grow Inside: the field darkens, three shoots grow into the foe from round it, and red and pale buds open on it where they took.
  scion_ingrowth: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { wash(SCION.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, n = r.hits.filter(h => t >= h.at).length, E = aim(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0) continue; const g = f.i / f.n * Math.PI * 2 + 0.6, S = { x: E.x + Math.cos(g) * 16, y: E.y + Math.sin(g) * 10 }; graft(S, E, Math.min(1, ease(a / f.dur)) * 0.85, a < f.dur ? 1 : hold(t, 0, r.end, 6)); }
      if (n) { const L = hold(t, hitOf(r), r.end, 6); for (let q = 0; q < n * 2; q++) { const g = q * 2.3, d = 2 + (q % 3), x = E.x + Math.cos(g) * d, y = E.y + Math.sin(g) * d * 0.8, open = Math.min(1, (t - r.hits[Math.floor(q / 2)].at) / 4); px(x, y, q % 2 ? SCION.red : SCION.pale, L); if (open >= 1) { px(x - 1, y, q % 2 ? SCION.red : SCION.light, L); px(x + 1, y, q % 2 ? SCION.red : SCION.light, L); px(x, y - 1, W, L); } } }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Napirus (espalier): pears, and branches trained flat in tiers on a wall

const ESPALIER = { pear: '#bad76c', red: '#870c0c', leaf: '#58a84e', bark: '#6a5030', deep: '#121a0e' };
/** A pear: yellow-green with a red blush, a stem, and a leaf, `s` times size. */
function pear(x: number, y: number, s = 1, lv = 1): void { blit(['.bl', '.p.', 'ppp', 'prp', '.p.'], x, y, { b: ESPALIER.bark, l: ESPALIER.leaf, p: ESPALIER.pear, r: ESPALIER.red }, lv, s); }
/** Branches trained flat from a trunk at x, foot: up to `tiers` tiers reaching w each way, `g` of the way grown, with leaves along them. */
function trellis(x: number, foot: number, w: number, tiers: number, g: number, lv = 1): void {
  const h = tiers * 4 + 2;
  line(x, foot, x, foot - Math.round(h * Math.min(1, g * 1.5)), ESPALIER.bark, lv);
  for (let k = 0; k < tiers; k++) { const y = foot - 3 - k * 4, n = Math.round(w * Math.max(0, Math.min(1, g * 2 - k * 0.3))); if (n <= 0) continue; line(x - n, y, x + n, y, ESPALIER.bark, lv); for (let i = 2; i <= n; i += 3) { px(x - i, y - 1, ESPALIER.leaf, lv); px(x + i, y - 1, ESPALIER.leaf, lv); } }
}

const ESPALIER_ART: Record<string, LegendArt> = {
  // Pear Drop: a pear comes off Napirus's branch, lobs over, and bursts on the foe in a splash of juice.
  espalier_spur: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); pear(p.x, p.y); });
      landed(r, (E, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 7; q++) { const vx = (q - 3) * 0.6, vy = -1.3 - hash(r.seed + q) * 0.8; px(E.x + vx * s, E.y + vy * s + 0.12 * s * s, q % 2 ? ESPALIER.pear : W, fade(s, 12)); } if (a < 14) leafAt(E.x + 3 + Math.sin(a / 3), E.y - 3 + a * 0.5, a >> 2, fade(a, 14)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Prop Up: a trellis grows up behind the ally as two leaves rise, and a pear hangs ready on it.
  espalier_propup: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, A = r.to[0], L = hold(t, 0, r.end, 6); trellis(A.x - toward(r) * 2, A.y + 5, 9, 2, prog(t, 2, lastOf(r)), L); },
    front(r) {
      const t = r.t, A = r.to[0], a = t - lastOf(r);
      inbound(r, (u, _, i) => leafAt(A.x + (i ? 5 : -5), A.y + 5 - 10 * u, t >> 2));
      if (a >= 0) { pear(A.x + toward(r) * 7, A.y - 4, 1, fade(a, r.end - lastOf(r), 6)); mends(A, a, ESPALIER.pear); }
    },
  },

  // Wall Sap: sap runs from the wall to the ally in two yellow-green drops, and it glows as it mends and quickens.
  espalier_saprise: {
    noFlights: true, noLandings: true,
    back(r) { trellis(r.to[0].x - toward(r) * 2, r.to[0].y + 5, 8, 2, 1, hold(r.t, 0, r.end, 6) * 0.75); },
    front(r) {
      const A = r.to[0];
      inbound(r, (u, _, i) => { const S = { x: A.x - toward(r) * 8, y: A.y - 6 }, p = lerp(S, A, u); px(p.x, p.y + i, ESPALIER.pear); px(p.x, p.y + i + 1, W); });
      landed(r, (_, a, i) => { ringOut(A.x, A.y, a, 10, 7, i ? ESPALIER.pear : ESPALIER.leaf, 0.7); mends(A, a, ESPALIER.pear); });
    },
  },

  // Full Trellis: branches grow out flat in tiers over every foe, leaves sweep along them, and pears hang off them as Napirus's side mends.
  espalier_lattice: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6); wash(ESPALIER.deep, 0.25 * L); for (const E of r.to) trellis(E.x, E.y + 6, 11, 3, prog(t, 4, lastOf(r)), L); },
    front(r) {
      const t = r.t, a = t - lastOf(r);
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = aa / f.dur; leafAt(E.x + dir * (44 * u - 20), E.y - 5 + (f.i % 3) * 4, t >> 2); }
      if (a >= 0) { for (const E of r.to) for (let q = 0; q < 3; q++) pear(E.x - 7 + q * 7, E.y - 1 - (q % 2) * 4 + Math.min(0, a - 4), 1, fade(a, r.end - lastOf(r), 6)); mends(r.from, a, ESPALIER.pear); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },
};

// ---------------------------------------------------------------- Scalago (rung): rungs, a ladder climbing step by step, and its ring at the top

const RUNG = { red: '#ef4343', gold: '#efcf5f', teal: '#266875', light: '#5aa8b8', deep: '#0e1c20' };
/** One rung w each side of x at y: a teal bar with gold ends and a light top edge. */
function rungBar(x: number, y: number, w: number, lv = 1): void { line(x - w, y, x + w, y, RUNG.light, lv); line(x - w, y + 1, x + w, y + 1, RUNG.teal, lv); px(x - w - 1, y, RUNG.gold, lv); px(x + w + 1, y, RUNG.gold, lv); px(x - w - 1, y + 1, RUNG.gold, lv); px(x + w + 1, y + 1, RUNG.gold, lv); }
/** A ladder standing on `foot` at x with `steps` rungs showing, red rails 3 pixels apart. */
function ladder(x: number, foot: number, steps: number, lv = 1): void { const h = steps * 3 + 1; line(x - 3, foot, x - 3, foot - h, RUNG.red, lv); line(x + 3, foot, x + 3, foot - h, RUNG.red, lv); for (let k = 0; k < steps; k++) line(x - 2, foot - 2 - k * 3, x + 2, foot - 2 - k * 3, k === steps - 1 ? RUNG.gold : RUNG.light, lv); }

const RUNG_ART: Record<string, LegendArt> = {
  // Rung Rap: a rung spins flat across to the foe and raps it, and a gold ring goes out from the knock.
  rung_rap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); rungBar(p.x, p.y, Math.max(1, Math.round(Math.abs(Math.cos(t * 0.6)) * 4))); });
      landed(r, (E, a) => { ringOut(E.x, E.y, still(a, 2), 12, 8, RUNG.gold, 0.7); if (a < 6) rungBar(E.x, E.y - 1, 4, fade(a, 6)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Crossbar: a crossbar slams across the foe, and a second one goes on past it to bar the reserve behind.
  rung_crossbar: {
    noFlights: true, noLandings: true,
    front(r) {
      const E = aim(r), R = { x: E.x + (high(E) ? 12 : -12), y: E.y + 2 };
      inbound(r, (u, E2, i) => { const T = i ? R : E2, p = lerp(r.from, T, u); rungBar(p.x, p.y, 5); });
      landed(r, (E2, a, i) => { const T = i ? R : E2, L = fade(a, r.end - r.hits[i].at, 6); rungBar(T.x, T.y - 1, 6, L); if (a < 8) sparks(T.x, T.y, a, 6, W, RUNG.gold, r.seed + i, 7, 8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) || shake(r.t - lastOf(r), 4, 1) }; },
  },

  // Landing Rest: a broad landing rises beside Scalago with a short flight of rungs up to it, and its gold edge glints.
  rung_reststep: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = r.from, dir = toward(r), P = { x: U.x + dir * 11, y: U.y + 5 }, g = ease(prog(r.t, leaveOf(r), hitOf(r) + 4)), L = hold(r.t, leaveOf(r), r.end, 6);
      if (g <= 0) return;
      const top = P.y - Math.round(6 * g);
      line(P.x - 5, top, P.x + 5, top, RUNG.gold, L); dither(P.x - 5, top + 1, 11, 1, RUNG.teal, L); line(P.x - 4, top + 2, P.x - 4, P.y, RUNG.red, L); line(P.x + 4, top + 2, P.x + 4, P.y, RUNG.red, L);
      for (let k = 1; k < 3; k++) if (top + k * 2 < P.y) line(P.x - 3, top + k * 2, P.x + 3, top + k * 2, RUNG.light, L);
      landed(r, (_, a) => { if (a < 6) glint(P.x, top - 1, RUNG.gold, fade(a, 6)); });
    },
  },

  // Top Rung: a ladder climbs up beside Scalago one rung at a time, the top one rings gold, and three rungs come down on the foe in a white flash.
  rung_standstill: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 6); wash(RUNG.deep, 0.25 * L); ladder(U.x - toward(r) * 8, U.y + 5, Math.min(high(U) ? 4 : 6, 1 + Math.floor(t / 3)), L * hold(t, 0, leaveOf(r) + 4, 3)); },
    front(r) {
      const t = r.t, U = r.from, go = leaveOf(r), top = { x: U.x - toward(r) * 8, y: U.y + 5 - (high(U) ? 4 : 6) * 3 - 1 };
      if (t >= go - 6 && t < go + 2) ringOut(top.x, top.y, t - go + 6, 8, 6, RUNG.gold, 0.8);
      inbound(r, (u, E, i) => { const y = E.y - (high(E) ? 14 : 26) * (1 - u * u); rungBar(E.x + (i - 1) * 3, y, 4); });
      landed(r, (E, a, i) => { rungBar(E.x + (i - 1) * 3, E.y + 3 - i, 5, fade(a, r.end - r.hits[i].at, 6)); ringOut(E.x, E.y, still(a, i === 2 ? 5 : 1), 12, 9, RUNG.gold, 0.7); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Nolhaku (nought): blanks that rub things out

const NOUGHT = { white: '#f3f1f7', lav: '#9b83ca', gray: '#72688e', deep: '#16141e' };
/** A blank w by h centered on x, y: a white patch with a dotted lavender border. */
function blankPatch(x: number, y: number, w: number, h: number, lv = 1, fill = 1): void {
  x = Math.round(x - w / 2); y = Math.round(y - h / 2);
  dither(x + 1, y + 1, w - 2, h - 2, NOUGHT.white, fill * lv);
  for (let i = 0; i < w; i += 2) { px(x + i, y, NOUGHT.lav, lv); px(x + i, y + h - 1, NOUGHT.lav, lv); }
  for (let j = 0; j < h; j += 2) { px(x, y + j, NOUGHT.lav, lv); px(x + w - 1, y + j, NOUGHT.lav, lv); }
}
/** Rubbing out across a whorl, a frames in: white zigzag strokes that leave a blank behind them. */
function rubOut(E: Pt, a: number, lv = 1): void { const n = Math.min(12, a * 2); for (let i = 0; i < n; i++) { const x = E.x - 6 + i, y = E.y - 4 + ((i >> 1) % 2 ? 4 : 0) + (i % 2); px(x, y, i > n - 3 ? W : NOUGHT.white, lv); } if (a > 6) blankPatch(E.x, E.y - 1, 8, 6, lv, 0.5); }

const NOUGHT_ART: Record<string, LegendArt> = {
  // Blank Edge: a blank card flips across to the foe edge-on and cuts it, leaving a white strip where it passed.
  nought_edge: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u), w = 1 + Math.round(Math.abs(Math.cos(t * 0.7)) * 3); blankPatch(p.x, p.y, w * 2, 5, 1, 1); });
      landed(r, (E, a) => { const n = Math.min(1, (still(a, 2) + 1) / 3), L = fade(a, 14, 5); line(E.x - 6, E.y + 4, E.x - 6 + 12 * n, E.y + 4 - 9 * n, NOUGHT.white, L); line(E.x - 6, E.y + 5, E.x - 6 + 12 * n, E.y + 5 - 9 * n, NOUGHT.lav, 0.5 * L); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Rub Out: a ring of blank closes on the foe, and white strokes rub across it and leave it blank in the middle.
  nought_erase: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const rr = 12 - 9 * ease(u); for (let q = 0; q < 16; q += 2) { const g = q / 16 * Math.PI * 2; px(E.x + Math.cos(g) * rr, E.y + Math.sin(g) * rr * 0.7, NOUGHT.lav); } });
      landed(r, (E, a) => { rubOut(E, a, fade(a, r.end - hitOf(r), 6)); if (a > 4 && a < 18) for (let q = 0; q < 3; q++) px(E.x - 3 + q * 3, E.y + 2 + (a - 4) * 0.4, NOUGHT.gray, fade(a - 4, 14)); });
    },
  },

  // Blank Stamp: Nolhaku stomps, a blank stamp flies over, and it comes down square on the foe with a dotted edge.
  nought_path: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); blankPatch(p.x, p.y, 6, 6, 1, 0.5); });
      landed(r, (E, a) => { const s = still(a, 3); blankPatch(E.x, E.y - Math.max(0, 3 - s), 10, 10, fade(a, r.end - hitOf(r), 6), 0.375); if (a < 3) ringOut(E.x, E.y, a, 3, 8, W, 0.8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Nothing There: the field goes dark, blanks fall on every foe, and each leaves a patch of nothing where it lands.
  nought_haunting: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(NOUGHT.deep, 0.5 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      inbound(r, (u, E, i) => { const x = E.x + ((i % 6) - 2.5) * 3, y = E.y - (high(E) ? 16 : 28) * (1 - u); blankPatch(x, y, 4, 4, 1, 0.75); });
      landed(r, (E, a, i) => { const x = E.x + ((i % 6) - 2.5) * 3, y = E.y - 2 + (i % 2) * 4; blankPatch(x, y, 4, 4, fade(a, r.end - r.hits[i].at, 6), 0.5); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Owanis (terminus): the striped barrier at the end of the road

const TERMINUS = { white: '#eeeeee', red: '#c60117', dark: '#44404e', deep: '#141218' };
/** A barrier board w each side of x and h tall at y: red and white stripes running on a slant, with a dark edge. */
function barrier(x: number, y: number, w: number, h: number, lv = 1): void {
  for (let j = 0; j < h; j++) for (let i = -w; i <= w; i++) px(x + i, y + j, (((i + j) >> 1) & 1) ? TERMINUS.red : TERMINUS.white, lv);
  line(x - w, y + h, x + w, y + h, TERMINUS.dark, lv);
}
/** A warning post at x on `foot`, h tall: a striped column with a dark cap. */
function post(x: number, foot: number, h: number, lv = 1): void { for (let k = 0; k < h; k++) { px(x, foot - k, (k >> 1) & 1 ? TERMINUS.red : TERMINUS.white, lv); px(x + 1, foot - k, (k >> 1) & 1 ? TERMINUS.red : TERMINUS.white, lv); } line(x - 1, foot - h, x + 2, foot - h, TERMINUS.dark, lv); }

const TERMINUS_ART: Record<string, LegendArt> = {
  // Barrier Charge: Owanis charges behind a striped barrier board, slams the foe with it, and splinters of red and white fly.
  terminus_lastmile: {
    noLandings: true,
    back(r) { landed(r, (E, a) => { if (a < 14) { const n = Math.min(8, a * 2); line(E.x - n, E.y + 5, E.x + n, E.y + 5, TERMINUS.red, fade(a, 14)); } }); },
    front(r) {
      const U = userAt(r), dir = toward(r), hit = hitOf(r);
      if (r.t < hit + 3) barrier(U.x + dir * 5, U.y - 3, 1, 7);
      landed(r, (E, a) => { const s = still(a, 2); chunks(E.x, E.y, s, 7, TERMINUS.red, TERMINUS.white, r.seed, 14, 1.4, 1.3); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 2) }; },
  },

  // Warning Posts: Owanis stamps, and two striped warning posts come up out of the ground at either side of it.
  terminus_deadend: {
    noFlights: true, noLandings: true,
    front(r) {
      const U = r.from;
      inbound(r, (u, _, i) => post(U.x + (i ? 7 : -8), U.y + 5, Math.round(9 * u)));
      landed(r, (_, a, i) => { post(U.x + (i ? 7 : -8), U.y + 5, 9, fade(a, r.end - r.hits[i].at, 6)); if (a < 6) puff(U.x + (i ? 7 : -8), U.y + 5, a, 6, TERMINUS.white, TERMINUS.dark, 2, 0.1); });
    },
  },

  // Toll Bar: a striped toll bar swings down across the foe from its post, clangs shut, and a coin of tide flies back to Owanis.
  terminus_toll: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), a = t - hit, side = high(E) ? 1 : -1, P = { x: E.x + side * 8, y: E.y - 2 }, g = (Math.PI / 2) * (1 - ease(prog(t, leaveOf(r), hit)));
      if (t >= leaveOf(r) - 2) { post(P.x, E.y + 5, 7, hold(t, leaveOf(r) - 2, r.end, 6)); const L = hold(t, leaveOf(r), r.end, 6); for (let k = 0; k <= 14; k++) { const x = P.x - side * Math.cos(g) * k, y = P.y - Math.sin(g) * k; px(x, y, (k >> 1) & 1 ? TERMINUS.red : TERMINUS.white, L); px(x, y + 1, TERMINUS.dark, L); } }
      if (a >= 0 && a < 4) sparks(E.x, E.y - 2, a, 6, W, TERMINUS.red, r.seed, 6, 4);
      if (a >= 4) { const u = prog(a, 4, 16); if (u > 0 && u < 1) { const p = sagAt(E, r.from, u, -6); oval(p.x, p.y, 1, 1, '#f0e0c0'); px(p.x, p.y, W); } }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Road's End: the field darkens, a great striped barrier rises behind the foe, Owanis drives it into it, and a red column stands where the road ends.
  terminus_roadsend: {
    lead: 12, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), away = high(E) ? 1 : -1, up = ease(prog(t, 0, 12)), L = hold(t, 0, r.end, 6);
      wash(TERMINUS.deep, 0.5 * L);
      barrier(E.x + away * 7, E.y + 5 - Math.round(12 * up), 4, Math.round(12 * up), L);
      const a = t - hit; if (a >= 0) { const h = Math.min(30, a * 5), Lb = fade(a, r.end - hit, 6); dither(E.x - 2, E.y + 5 - h, 5, h, TERMINUS.red, 0.5 * Lb); line(E.x, E.y + 5 - h, E.x, E.y + 5, W, Lb); }
    },
    front(r) { smear(r, TERMINUS.white, TERMINUS.red, 12); landed(r, (E, a) => chunks(E.x, E.y + 2, still(a, 6), 8, TERMINUS.red, TERMINUS.white, r.seed, 16, 1.6, 1.4)); },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 14, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Finihei (horizon): the curve of the horizon and the gold stars turning round it

const HORIZON = { blue: '#424f9e', gold: '#e8c858', pale: '#8695cb', deep: '#10142c' };
/** A gold four-point star, `big` with longer arms, twinkling with t. */
function goldStar(x: number, y: number, t: number, big = false, lv = 1): void { const r1 = big ? 2 : 1; px(x, y, W, lv); for (let i = 1; i <= r1; i++) { const c = i === r1 && ((t >> 2) & 1) ? HORIZON.pale : HORIZON.gold; px(x + i, y, c, lv); px(x - i, y, c, lv); px(x, y + i, c, lv); px(x, y - i, c, lv); } }
/** The horizon's curve under a whorl: a pale arc rx wide with a blue band under it. */
function horizonCurve(x: number, y: number, rx: number, lv = 1): void { arc(x, y + rx * 0.3, rx, rx * 0.3, HORIZON.pale, lv, 0.55, 0.95); arc(x, y + rx * 0.3 + 1, rx, rx * 0.3, HORIZON.blue, lv, 0.58, 0.92); }
/** The circling stars round a whorl: n gold stars on a turning ring. */
function circlingStars(p: Pt, n: number, t: number, lv = 1): void { for (let q = 0; q < n; q++) { const g = t * 0.08 + q / n * Math.PI * 2; goldStar(p.x + Math.cos(g) * 9, p.y - 2 + Math.sin(g) * 3, t + q, false, lv); } }

const HORIZON_ART: Record<string, LegendArt> = {
  // Star Breath: Finihei's circling stars stream off it one after another to the foe and burst in gold.
  horizon_skyline: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      circlingStars(U, 3, t, hold(t, 0, leaveOf(r) + 4, 3));
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); goldStar(p.x, p.y, t, true); tail(p, lerp(r.from, E, Math.max(0, u - 0.1)), HORIZON.gold, HORIZON.pale, HORIZON.blue, 4); });
      landed(r, (E, a, i) => sparks(E.x, E.y, still(a, i ? 0 : 2), 6, W, HORIZON.gold, r.seed + i, 7, 8));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Rise Up: a new star rises off the horizon under Finihei and joins the stars turning round it.
  horizon_widen: {
    noFlights: true, noLandings: true,
    back(r) { horizonCurve(r.from.x, r.from.y + 5, 12, hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), a = t - hitOf(r);
      circlingStars(U, a >= 0 ? 3 : 2, t, hold(t, 0, r.end, 6));
      inbound(r, (u) => goldStar(U.x, U.y + 6 - 12 * u, t, true));
      if (a >= 0 && a < 6) glint(U.x, U.y - 6, HORIZON.gold, fade(a, 6));
    },
  },

  // Sink Well: a dark well opens under the foe with the horizon's curve round its lip, and three drops run down into it.
  horizon_farpoint: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), g = ease(prog(t, 2, hitOf(r))), L = hold(t, 2, r.end, 6); oval(E.x, E.y + 5, 3 + 6 * g, 1 + 1.5 * g, HORIZON.deep, L); horizonCurve(E.x, E.y + 3, 3 + 6 * g, L); },
    front(r) {
      inbound(r, (u, E, i) => { const g = i / 3 * Math.PI * 2 + 0.5, S = { x: E.x + Math.cos(g) * 14, y: E.y + Math.sin(g) * 7 }, p = lerp(S, { x: E.x, y: E.y + 5 }, ease(u)); blit(['.p.', 'pbp', '.b.'], p.x, p.y, { p: HORIZON.pale, b: HORIZON.blue }); });
      landed(r, (E, a) => { if (a < 6) ringOut(E.x, E.y + 5, a, 6, 5, HORIZON.pale, 0.3); });
    },
  },

  // Stars Fall: the field darkens and every star Finihei keeps falls at once, streaking down on the foes in gold, and the sky flashes.
  horizon_skyfall: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(HORIZON.deep, 0.375 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < leaveOf(r)) circlingStars(U, 3, t * 2);
      inbound(r, (u, E, i) => { const x = E.x + ((i % 6) - 2.5) * 3 + (1 - u) * 6, y = E.y - (high(E) ? 16 : 28) * (1 - u); goldStar(x, y, t, true); line(x + 1, y - 1, x + 5, y - 5, HORIZON.gold, 0.75); line(x + 5, y - 5, x + 8, y - 8, HORIZON.pale, 0.5); });
      landed(r, (E, a, i) => sparks(E.x + ((i % 6) - 2.5) * 3, E.y, still(a, i === 0 ? 5 : 0), 5, W, HORIZON.gold, r.seed + i, 7, 8));
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Murk (murk): fog banks and the yellow eyes in them

const MURK = { fog: '#7d739b', eye: '#f5d655', dark: '#48445c', pale: '#b4acc8', deep: '#141220' };
/** A bank of fog w each side of x and h tall from y: drifting dithered rows of gray-violet with paler tops. */
function fogBank(x: number, y: number, w: number, h: number, t: number, lv = 1): void { for (let j = 0; j < h; j++) { const o = Math.round(Math.sin((t + j * 7) / 9) * 3), ww = Math.round(w * (0.7 + 0.3 * Math.sin(j * 1.3 + t / 13))); dither(x - ww + o, y + j, 2 * ww, 1, j % 3 === 0 ? MURK.pale : MURK.fog, lv * (j % 2 ? 0.5 : 0.75)); } }
/** Two yellow eyes in the fog at x, y. */
function fogEyes(x: number, y: number, lv = 1): void { px(x - 1, y, MURK.eye, lv); px(x + 2, y, MURK.eye, lv); }

const MURK_ART: Record<string, LegendArt> = {
  // Cold Edge: Murk comes out of a streak of fog at the foe, and a cold white cut opens across it with frost glinting.
  murk_coldcut: {
    tail: 4, noLandings: true,
    front(r) {
      smear(r, MURK.pale, MURK.fog, 12);
      landed(r, (E, a) => { const n = Math.min(1, (still(a, 2) + 1) / 3), L = fade(a, 12, 4); line(E.x + 6, E.y - 6, E.x + 6 - 12 * n, E.y - 6 + 11 * n, W, L); line(E.x + 7, E.y - 6, E.x + 7 - 12 * n, E.y - 6 + 11 * n, MURK.pale, 0.5 * L); if (a >= 2 && a < 12) for (let q = 0; q < 3; q++) glint(E.x - 4 + q * 4, E.y - 2 + (q & 1) * 3, MURK.pale, fade(a - 2, 10)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Fog Pall: banks of fog close on the foe from three sides and settle over it, muffling it, with yellow eyes in them.
  murk_pall: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, E2, i) => { const g = i / 3 * Math.PI * 2 + 0.6, S = { x: E2.x + Math.cos(g) * 16, y: E2.y + Math.sin(g) * 9 }, p = lerp(S, E2, ease(u)); fogBank(p.x, p.y - 2, 4, 4, t); });
      if (n) { const L = hold(t, hitOf(r), r.end, 6); fogBank(E.x, E.y - 5, 6 + n, 4 + n * 2, t, L); fogEyes(E.x + 5, E.y - 5, L * (((t >> 3) & 3) ? 1 : 0)); }
    },
  },

  // Thicken: fog thickens round Murk until only its yellow eyes show through.
  murk_lurk: {
    tail: 6, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, g = ease(prog(t, 0, hitOf(r) + 6)), L = hold(t, 0, r.end, 6);
      fogBank(U.x, U.y - 6, 6 + 3 * g, Math.round(4 + 9 * g), t, L);
      if (g > 0.5) fogEyes(U.x, U.y - 1, L * (((t >> 3) & 3) ? 1 : 0));
    },
  },

  // Fogbound: the fog rolls over every foe in the dark, three cold cuts flash out of it one after another, and yellow eyes watch.
  murk_fogbound: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6); wash(MURK.deep, 0.375 * L); for (const E of r.to) fogBank(E.x, E.y - 6, 14, 12, t, L); },
    front(r) {
      const t = r.t;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y - 4 + f.i * 3; line(x, y, x - dir * 5, y + 1, W); line(x - dir * 5, y + 1, x - dir * 8, y + 1, MURK.pale, 0.5); }
      landed(r, (E, a, i) => { if (a < 8) { const n = Math.min(1, (a + 1) / 3); line(E.x + 5 - i * 2, E.y - 6 + i * 2, E.x + 5 - i * 2 - 10 * n, E.y - 6 + i * 2 + 9 * n, W, fade(a, 8)); } });
      for (const E of r.to) fogEyes(E.x + 9, E.y - 7, hold(t, 0, r.end, 6) * (((t >> 3) & 3) ? 1 : 0));
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Avachi (undine): the part of something too big to see, kelp, and its song

const UNDINE = { deep: '#2e4a68', pink: '#d75d7e', pale: '#bfd7cf', dark: '#121c28', kelp: '#3a6a4a' };
/** A curve of its body rising out of the ground: a broad deep-blue arc rx wide with pink spots and a pale back. */
function bodyArc(x: number, foot: number, rx: number, up: number, lv = 1): void {
  if (up <= 0) return;
  for (let k = 0; k < 3; k++) arc(x, foot, rx - k, up - k, k ? UNDINE.deep : UNDINE.pale, lv, 0.5, 1);
  for (let q = 0; q < 4; q++) { const g = 0.58 + q * 0.11; px(x + Math.cos(g * Math.PI * 2) * (rx - 1), foot + Math.sin(g * Math.PI * 2) * (up - 1), UNDINE.pink, lv); }
}
/** A kelp ribbon from x, foot rising h, waving with t, with a pink holdfast. */
function kelpRibbon(x: number, foot: number, h: number, t: number, lv = 1): void { for (let k = 0; k < h; k++) px(x + Math.round(Math.sin((t + k * 2) / 4) * 1.5), foot - k, k === h - 1 ? UNDINE.pale : UNDINE.kelp, lv); px(x, foot, UNDINE.pink, lv); }

const UNDINE_ART: Record<string, LegendArt> = {
  // Deep Rip: a curve of the drowned thing's body heaves up out of the ground behind the foe and drags at it in a splash.
  undine_fathom: {
    noLandings: true,
    back(r) { const t = r.t, E = aim(r), hit = hitOf(r), up = Math.round(10 * Math.sin(Math.PI * prog(t, 2, hit + 12))), away = high(E) ? 1 : -1; bodyArc(E.x + away * 4, E.y + 6, 13, up); },
    front(r) { landed(r, (E, a) => { const s = still(a, 2); if (s < 14) for (let q = 0; q < 8; q++) { const vx = (q - 3.5) * 0.6, vy = -1.4 - hash(r.seed + q) * 0.8; px(E.x + vx * s, E.y + 3 + vy * s + 0.12 * s * s, q % 3 ? UNDINE.pale : W, fade(s, 14)); } }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Kelp Wrap: three kelp ribbons rise round the foe from pink holdfasts and wrap it.
  undine_kelphold: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E, i) => kelpRibbon(E.x - 6 + i * 6, E.y + 5, Math.round(12 * u), t + i * 3));
      landed(r, (E, a, i) => { const L = fade(a, r.end - r.hits[i].at, 6); kelpRibbon(E.x - 6 + i * 6, E.y + 5, 12, t + i * 3, L); arc(E.x, E.y - 2 + i * 3, 6, 2, i % 2 ? UNDINE.kelp : UNDINE.pale, L, 0.05, 0.45); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Show a Part: a great pale eye opens in the ground under the foe, jaws snap up out of it, and a drowned image stands beside Avachi.
  undine_glimpse: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), open = Math.sin(Math.PI * prog(t, 2, r.end - 2)), L = hold(t, 2, r.end, 6);
      oval(E.x, E.y + 6, 10, Math.max(0.5, 3 * open), UNDINE.pale, L); oval(E.x, E.y + 6, 3, Math.max(0.5, 2.5 * open), UNDINE.pink, L); px(E.x, E.y + 6, UNDINE.dark, L);
    },
    front(r) {
      inbound(r, (u, E) => { for (let i = -3; i <= 3; i += 2) line(E.x + i, E.y + 6 - 10 * u, E.x + i + 1, E.y + 4 - 10 * u, UNDINE.pale); });
      landed(r, (E, a) => { const gap = Math.max(0, 4 - still(a, 2) * 1.5), L = fade(a, 12, 4); for (let i = -4; i <= 4; i++) { px(E.x + i, E.y - 3 - gap + (i & 1), UNDINE.pale, L); px(E.x + i, E.y + 3 + gap - (i & 1), UNDINE.pale, L); } const P = { x: r.from.x + toward(r) * 10, y: r.from.y }; reflection(P.x, P.y, 0.5 * fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Deep Song: rings of song rise from the deep under the foe in pink and pale, and it is held still inside them as Avachi's side mends.
  undine_undersong: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6), E = aim(r); wash(UNDINE.dark, 0.375 * L); bodyArc(E.x + (high(E) ? 6 : -6), E.y + 8, 15, Math.round(6 * L)); },
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const u = a / f.dur; for (let i = -4; i <= 4; i++) px(E.x + i * 1.5, E.y + 8 - 14 * u + Math.round(Math.sin(i + t * 0.5) * 1.5), f.i % 2 ? UNDINE.pink : UNDINE.pale); }
      if (n) { const L = hold(t, hitOf(r), r.end, 6); for (let q = 0; q < n; q++) arc(E.x, E.y, 6 + q * 2, 5 + q * 1.5, q % 2 ? UNDINE.pink : UNDINE.pale, L); }
      const a = t - lastOf(r); if (a >= 0) mends(r.from, a, UNDINE.pale);
    },
  },
};

// ---------------------------------------------------------------- Hebrum (lip): the broken edge and the drop below it

const LIP = { pink: '#e0b1a9', white: '#f8f4f0', dark: '#624250', deep: '#160e14' };
/** The lip of an edge w each side of x at y: a broken pink and white line with dark below where the ground drops away. */
function ledge(x: number, y: number, w: number, lv = 1): void { for (let i = -w; i <= w; i++) { const j = (i * 7 + 3) % 5 === 0 ? 1 : 0; px(x + i, y + j, i % 3 ? LIP.pink : LIP.white, lv); px(x + i, y + j + 1, LIP.dark, lv); px(x + i, y + j + 2, LIP.deep, lv); } }
/** Crumbs of the edge falling from x, y a frames on: pink and white bits that drop away faster and faster. */
function crumbs(x: number, y: number, a: number, n: number, seed: number, life = 16): void { if (a < 0 || a >= life) return; for (let q = 0; q < n; q++) { const vx = (hash(seed + q) - 0.5) * 1.2; px(x + (q - n / 2) * 2 + vx * a, y + 0.15 * a * a, q % 2 ? LIP.pink : LIP.white, fade(a, life)); } }

const LIP_ART: Record<string, LegendArt> = {
  // Edge Bite: Hebrum bites a piece off the foe, and the bitten edge crumbles away underneath.
  lip_gnaw: {
    noLandings: true,
    front(r) {
      smear(r, LIP.white, LIP.pink, 9);
      landed(r, (E, a) => { const gap = Math.max(0, 5 - still(a, 2) * 1.7), L = fade(a, 12, 4); for (let i = -4; i <= 4; i++) { px(E.x + i, E.y - 2 - gap + (i & 1), LIP.white, L); px(E.x + i, E.y + 2 + gap - (i & 1), LIP.white, L); } crumbs(E.x, E.y + 3, a - 2, 5, r.seed); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Over the Edge: a pink line hooks out to the foe's side, catches something there, and hauls it back over the edge to Hebrum's side.
  lip_pullover: {
    noFlights: true, noLandings: true,
    back(r) { const L = hold(r.t, 0, r.end, 6), M = lerp(r.from, aim(r), 0.5); ledge(M.x, M.y + 6, 6, 0.5 * L); },
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], half = f.dur / 2, back = a >= half, v = back ? 1 - ease((a - half) / half) : ease(a / half), p = lerp(U, E, v), n = Math.round(Math.hypot(p.x - U.x, p.y - U.y));
        for (let i = 0; i <= n; i += 1) { const q = lerp(U, p, i / Math.max(1, n)); px(q.x, q.y, LIP.pink); }
        arc(p.x, p.y, 2, 2, LIP.white, 1, 0.25, 0.9);
        if (back) reflection(p.x, p.y, 0.5);
      }
      landed(r, (E, a) => crumbs(E.x, E.y + 4, a, 4, r.seed));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Crumble: bits of the edge rain on the foe, and the ground under it breaks off at the lip and falls away.
  lip_fester: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a) => ledge(E.x, E.y + 5 + Math.min(2, a >> 3), 9, fade(a, r.end - hitOf(r), 6))); },
    front(r) {
      inbound(r, (u, E, i) => { const x = E.x + (i - 1) * 5, y = E.y - (high(E) ? 16 : 26) * (1 - u * u); blit(['pw', 'pp'], x, y, { p: LIP.pink, w: LIP.white }); });
      landed(r, (E, a, i) => { chunks(E.x + (i - 1) * 5, E.y, still(a, i ? 0 : 2), 4, LIP.pink, LIP.white, r.seed + i, 12, 1.1, 1); crumbs(E.x, E.y + 6, a - 4, 4, r.seed + i * 3); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Pull Apart: the ground splits across the foe, and the two sides of the edge close on it like jaws, once and again.
  lip_pullapart: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, hitOf(r))); wash(LIP.deep, 0.375 * L); const n = Math.round(14 * g); for (let i = -n; i <= n; i++) { px(E.x + i, E.y + 6 + ((i * 3) % 2), LIP.deep, L); px(E.x + i, E.y + 5, i % 3 ? LIP.pink : LIP.white, L); } },
    front(r) {
      smear(r, LIP.white, LIP.pink, 12);
      inbound(r, (u, E, i) => { const s = i ? 1 : -1, x = E.x + s * (14 - 9 * ease(u)); ledge(x, E.y - 2, 3); line(x, E.y - 6, x, E.y + 2, i ? LIP.pink : LIP.white); });
      landed(r, (E, a, i) => { const L = fade(a, 12, 4), gap = Math.max(1, 5 - still(a, i ? 5 : 2) * 1.5); line(E.x - gap, E.y - 6, E.x - gap, E.y + 4, LIP.white, L); line(E.x + gap, E.y - 6, E.x + gap, E.y + 4, LIP.pink, L); crumbs(E.x, E.y + 5, a - 2, 6, r.seed + i); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 6, 2) }; },
  },
};

// ---------------------------------------------------------------- Shiruga (rumple): loose ground that rucks up into folds

const RUMPLE = { earth: '#9e805e', green: '#7ad959', dark: '#50405e', light: '#c8b090', deep: '#141018' };
/** Ground rucked into folds w each side of x on `foot`, `amp` tall, the folds walking with `ph`: tan ridges, a light crest, dark troughs, and grass on top. */
function ruck(x: number, foot: number, w: number, amp: number, ph: number, lv = 1): void {
  if (amp <= 0) { line(x - w, foot, x + w, foot, RUMPLE.earth, lv); return; }
  for (let i = -w; i <= w; i++) { const h = Math.round(amp * Math.max(0, Math.sin(i * 0.5 + ph)) * (1 - Math.abs(i) / (w + 2))); for (let k = 0; k <= h; k++) px(x + i, foot - k, k === h ? RUMPLE.light : RUMPLE.earth, lv); if (h === 0) px(x + i, foot + 1, RUMPLE.dark, lv); else if (i % 3 === 0) px(x + i, foot - h - 1, RUMPLE.green, lv); }
}

const RUMPLE_ART: Record<string, LegendArt> = {
  // Ruck Up: Shiruga stamps, a ridge of ground runs along to the foe, and the ground rucks up under it in folds.
  rumple_ruck: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp({ x: r.from.x, y: r.from.y + 5 }, { x: E.x, y: E.y + 5 }, u); ruck(p.x, p.y, 4, 3, 1.5, 1); });
      landed(r, (E, a) => ruck(E.x, E.y + 5, 10, Math.min(6, 1 + still(a, 2)), t * 0.2, fade(a, r.end - hitOf(r), 6)));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Buckle Under: Shiruga stamps, and the ground under the foe's side buckles into folds that stay up.
  rumple_buckle: {
    noLandings: true,
    back(r) { landed(r, (E, a) => ruck(E.x, E.y + 5, 14, Math.min(6, 1 + still(a, 3) * 1.2), 0.5, fade(a, r.end - hitOf(r), 6))); },
    front(r) { landed(r, (E, a) => chunks(E.x, E.y + 4, a, 5, RUMPLE.earth, RUMPLE.green, r.seed, 12, 1.4, 1.2)); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Pucker Up: the ground under the foe puckers in toward a dimple, and water squeezes up out of the middle.
  rumple_pucker: {
    noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), g = ease(prog(t, leaveOf(r), hitOf(r) + 4)), L = hold(t, leaveOf(r), r.end, 6);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const x = E.x + s * (11 - k * 3 - 3 * g); line(x, E.y + 5, x + s, E.y + 3 - Math.round(g), k ? RUMPLE.earth : RUMPLE.light, L); }
      oval(E.x, E.y + 6, 1 + 2 * g, 1, RUMPLE.dark, L);
    },
    front(r) { landed(r, (E, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 6; q++) { const vx = (q - 2.5) * 0.4, vy = -1.8 - hash(r.seed + q) * 0.6; px(E.x + vx * s, E.y + 5 + vy * s + 0.13 * s * s, q % 2 ? '#a8d8e8' : W, fade(s, 12)); } }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Fold Up: the ground under every foe folds up in big ridges, and a raised corner of it stands up beside Shiruga.
  rumple_upfold: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, n = r.hits.filter(h => t >= h.at).length, L = hold(t, 0, r.end, 6);
      wash(RUMPLE.deep, 0.25 * L);
      for (const E of r.to) ruck(E.x, E.y + 5, 14, n ? 2 + n : 1, t * 0.15, L);
      if (n) { const P = { x: r.from.x + toward(r) * 11, y: r.from.y + 5 }, h = Math.min(9, 2 + n * 2); for (let k = 0; k < h; k++) { const w = Math.round((h - k) * 0.6); line(P.x - w, P.y - k, P.x + w, P.y - k, k === h - 1 ? RUMPLE.light : k % 2 ? RUMPLE.earth : '#8a6e50', hold(t, hitOf(r), r.end, 6)); } px(P.x, P.y - h, RUMPLE.green, L); }
    },
    front(r) { landed(r, (E, a, i) => chunks(E.x + (i - 1.5) * 4, E.y + 4, still(a, i ? 0 : 3), 4, RUMPLE.earth, RUMPLE.green, r.seed + i, 12, 1.3, 1.3)); },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Notbomi (sag): mud laid down in layers and the salt water seeping up

const SAG = { mud: '#7d634c', salt: '#e2eef2', dark: '#493f47', water: '#8ab0c0', deep: '#141012' };
/** Layers of mud laid down at x on `foot`, w each side: n bands of mud and dark under a white salt crust. */
function strata(x: number, foot: number, w: number, n: number, lv = 1): void { for (let k = 0; k < n; k++) line(x - w + k, foot - k, x + w - k, foot - k, k % 2 ? SAG.dark : SAG.mud, lv); line(x - w + n, foot - n, x + w - n, foot - n, SAG.salt, lv); }
/** A drop of salt water: white over pale blue. */
function saltDrop(x: number, y: number, lv = 1): void { px(x, y, W, lv); px(x, y + 1, SAG.water, lv); px(x - 1, y + 1, SAG.salt, lv); }

const SAG_ART: Record<string, LegendArt> = {
  // Run Off: muddy water runs off Notbomi in a stream to the foe and splashes brown and white, and a new layer settles on Notbomi.
  sag_runoff: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), a = t - hitOf(r);
      inbound(r, (u, E) => { for (let k = 0; k < 5; k++) { const p = lerp(r.from, E, Math.max(0, u - k * 0.05)); px(p.x, p.y + Math.round(Math.sin(t + k)), k ? SAG.mud : SAG.water); } saltDrop(lerp(r.from, E, u).x, lerp(r.from, E, u).y - 1); });
      landed(r, (E, aa) => { const s = still(aa, 2); if (s < 12) for (let q = 0; q < 7; q++) { const vx = (q - 3) * 0.6, vy = -1.3 - hash(r.seed + q) * 0.8; px(E.x + vx * s, E.y + 2 + vy * s + 0.12 * s * s, q % 3 ? SAG.mud : W, fade(s, 12)); } });
      if (a >= 0) strata(U.x, U.y + 5, 6, Math.min(2, 1 + (a >> 3)), fade(a, r.end - hitOf(r), 6));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Cold Hollow: the drops Notbomi gathered close on the foe from three sides and crack into a ring of salt crust round it.
  sag_coldhollow: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, E2, i) => { const g = i / 3 * Math.PI * 2 + 0.4, S = { x: E2.x + Math.cos(g) * 15, y: E2.y + Math.sin(g) * 9 }, p = lerp(S, E2, ease(u)); saltDrop(p.x, p.y); });
      if (n) { const L = hold(t, hitOf(r), r.end, 6); for (let q = 0; q < n * 4; q++) { const g = q / 12 * Math.PI * 2; px(E.x + Math.cos(g) * 7, E.y + 2 + Math.sin(g) * 4, q % 2 ? W : SAG.salt, L); px(E.x + Math.cos(g) * 7, E.y + 3 + Math.sin(g) * 4, SAG.dark, L); } }
      landed(r, (E2, a, i) => sparks(E2.x, E2.y, still(a, i === 2 ? 3 : 0), 5, W, SAG.salt, r.seed + i, 6, 7));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Settle In: salt water floods Notbomi's side into a pale pool, four drops rise through it, and its layers build back one by one.
  sag_sinkhole: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, U = r.from, g = ease(prog(t, 2, hitOf(r))), L = hold(t, 2, r.end, 6); oval(U.x, U.y + 5, 6 + 12 * g, 1.5 + 1.5 * g, SAG.water, 0.75 * L); arc(U.x, U.y + 5, 6 + 12 * g, 1.5 + 1.5 * g, SAG.salt, L, 0.05, 0.45); },
    front(r) {
      const t = r.t, U = r.from, n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, _, i) => saltDrop(U.x - 6 + i * 4, U.y + 6 - 10 * u));
      if (n) strata(U.x, U.y + 5, 7, n, hold(t, hitOf(r), r.end, 6));
    },
  },

  // Mud Up: mud bubbles up beside Notbomi in a swelling mound, and two mud puppies climb out of it with white eyes.
  sag_subside: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(SAG.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = r.from, dir = toward(r), P = { x: U.x + dir * 11, y: U.y + 5 }, n = r.hits.filter(h => t >= h.at).length, last = lastOf(r), a = t - last;
      inbound(r, (u, _, i) => arc(P.x - 4 + i * 2.5, P.y - 8 * u, 1, 1, SAG.mud));
      if (n && a < 8) { const h = 1 + n; oval(P.x, P.y, 5 + n, h, SAG.mud, 1); arc(P.x, P.y, 5 + n, h, SAG.salt, 0.5, 0.55, 0.95); }
      if (a >= 0) for (let q = 0; q < 2; q++) { const u = ease(prog(a - q * 3, 0, 10)), x = P.x + (q ? 5 : -4) * u + (q ? 2 : 0), y = P.y - 2 - Math.sin(Math.PI * u) * 3; blit(['.mm.', 'mwmw', 'mmmm', 'm..m'], x, y, { m: SAG.mud, w: W }, fade(a - q * 3, r.end - last - q * 3, 6)); }
    },
  },
};

// ---------------------------------------------------------------- Vakone (furrow): crazed ground and a crown of purple thorns

const FURROW = { tan: '#9a8262', thorn: '#962f97', dark: '#352933', light: '#c8b090', pale: '#d8a0d8' };
/** Crazing: cracks branching out from x, y, `g` of the way grown, dark with a light lip, steady for one seed. */
function craze(x: number, y: number, n: number, g: number, seed: number, lv = 1): void {
  for (let q = 0; q < n; q++) { const ang = (q / n + hash(seed + q) * 0.15) * Math.PI * 2, len = Math.round((5 + hash(seed + q * 3) * 5) * g); let cx = x, cy = y; for (let i = 0; i < len; i++) { cx += Math.cos(ang + (i % 3 === 1 ? 0.5 : -0.3)); cy += Math.sin(ang + (i % 3 === 1 ? 0.5 : -0.3)) * 0.4; px(cx, cy, FURROW.dark, lv); px(cx, cy - 1, FURROW.light, 0.5 * lv); } }
}
/** A purple thorn standing up from x, foot, h tall, its tip pale. */
function thornUp(x: number, foot: number, h: number, lv = 1): void { for (let k = 0; k < h; k++) { px(x, foot - k, k === h - 1 ? FURROW.pale : FURROW.thorn, lv); if (k < h / 2) px(x + 1, foot - k, FURROW.dark, lv); } }
/** A crown of thorns round x, y, rr across: a purple ring with spikes standing out of it. */
function thornCrown(x: number, y: number, rr: number, n: number, lv = 1): void { arc(x, y, rr, rr * 0.35, FURROW.thorn, lv); for (let q = 0; q < n; q++) { const g = q / n * Math.PI * 2, bx = x + Math.cos(g) * rr, by = y + Math.sin(g) * rr * 0.35; line(bx, by, bx + Math.cos(g) * 1.5, by - 2, FURROW.thorn, lv); px(bx + Math.cos(g) * 1.5, by - 2, FURROW.pale, lv); } }

const FURROW_ART: Record<string, LegendArt> = {
  // Crack Thorn: a crack runs along the ground to the foe, and a purple thorn spears up out of it.
  furrow_split: {
    noFlights: true, noLandings: true,
    back(r) { inbound(r, (u, E) => { const a = { x: r.from.x, y: r.from.y + 5 }, b = { x: E.x, y: E.y + 5 }, n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * u); for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))); px(p.x, p.y + ((i >> 1) & 1), FURROW.dark); } }); },
    front(r) { landed(r, (E, a) => { const s = still(a, 2); thornUp(E.x + 2, E.y + 5, Math.min(11, 3 + s * 3), fade(a, 14, 5)); craze(E.x + 2, E.y + 5, 4, 1, r.seed, fade(a, 14, 5)); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Crazed Ground: Vakone stamps, the ground under the foe crazes into a web of cracks, and three thorns spike up out of it and stay as a tangle.
  furrow_maze: {
    noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), g = ease(prog(t, 7, hitOf(r))); if (t >= 7) craze(E.x, E.y + 5, 7, g, r.seed, hold(t, 7, r.end, 6)); },
    front(r) {
      inbound(r, (u, E, i) => thornUp(E.x - 5 + i * 5, E.y + 5, Math.round(8 * u)));
      landed(r, (E, a, i) => thornUp(E.x - 5 + i * 5, E.y + 5, 8 - (i & 1) * 2, fade(a, r.end - r.hits[i].at, 6)));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Into the Crack: a crack opens under Vakone and it slips into it, and only the tips of thorns show at the crack's lip.
  furrow_underfold: {
    tail: 6, noLandings: true,
    back(r) { const t = r.t, U = r.from, g = ease(prog(t, 0, hitOf(r))), L = hold(t, 0, r.end, 6); line(U.x - Math.round(8 * g), U.y + 5, U.x + Math.round(8 * g), U.y + 5, FURROW.dark, L); line(U.x - Math.round(7 * g), U.y + 6, U.x + Math.round(7 * g), U.y + 6, '#000000', L); craze(U.x, U.y + 5, 5, g, r.seed, L * 0.75); },
    front(r) { const a = r.t - hitOf(r), U = r.from; if (a >= 0) for (let q = 0; q < 3; q++) thornUp(U.x - 4 + q * 4, U.y + 5, 2 + (q & 1), fade(a, r.end - hitOf(r), 6)); },
  },

  // Thorn Ring: six purple thorns circle Vakone and fly to the foe, and they set in a crown of thorns round its head.
  furrow_circlet: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(FURROW.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const u = a / f.dur, a0 = f.i / f.n * Math.PI * 2, O = { x: U.x + Math.cos(a0) * 9, y: U.y + Math.sin(a0) * 5 };
        const p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 4 + a0) * 9, y: U.y + Math.sin(u / 0.6 * Math.PI * 4 + a0) * 5 } : lerp(O, { x: E.x, y: E.y - 6 }, (u - 0.6) / 0.4);
        line(p.x, p.y + 1, p.x, p.y - 2, FURROW.thorn); px(p.x, p.y - 3, FURROW.pale);
      }
      if (n) thornCrown(E.x, E.y - 6, 6, n, hold(t, hitOf(r), r.end, 6));
      landed(r, (_, a, i) => { if (a < 4) glint(E.x - 5 + (i % 6) * 2, E.y - 7, FURROW.pale, fade(a, 4)); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Rokbo (acorn): its barnacle plates and the cyan cirri that sweep out of them

const ACORN = { shell: '#a29e93', cirri: '#67e6f6', green: '#48683e', dark: '#2a2824', pale: '#d0ccc0' };
/** Cirri fanning out of x, y toward `dir`: four curled cyan strands, `open` from 0 to 1, curling with t. */
function cirri(x: number, y: number, dir: number, open: number, t: number, lv = 1): void {
  for (let q = 0; q < 4; q++) { const base = -Math.PI / 2 + dir * (0.3 + q * 0.35) * open; let cx = x, cy = y; for (let i = 0; i < 5; i++) { const g = base + dir * i * 0.25 * Math.sin(t * 0.3 + q); cx += Math.cos(g); cy += Math.sin(g); px(cx, cy, i === 4 ? W : ACORN.cirri, lv); } }
}
/** A barnacle cone on `foot` at x, s across: gray plates with a pale top and a dark opening. */
function barnacleCone(x: number, foot: number, s: number, lv = 1): void { for (let k = 0; k < s; k++) { const w = Math.round(s - k * 0.6); line(x - w, foot - k, x + w, foot - k, k === s - 1 ? ACORN.pale : (k + x) % 2 ? ACORN.shell : ACORN.pale, lv); } px(x, foot - s, ACORN.dark, lv); }

const ACORN_ART: Record<string, LegendArt> = {
  // Cirri Fire: Rokbo's cirri flick out and throw three feathery darts at the foe, each landing in a cyan burst.
  acorn_cirri: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < lastOf(r)) cirri(U.x, U.y - 3, toward(r), 0.5 + 0.5 * Math.abs(Math.sin(t * 0.4)), t);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u), b = lerp(r.from, E, Math.max(0, u - 0.12)); line(b.x, b.y, p.x, p.y, ACORN.cirri); px(p.x, p.y, W); px(b.x, b.y - 1, ACORN.cirri); px(b.x, b.y + 1, ACORN.cirri); });
      landed(r, (E, a, i) => sparks(E.x + (i - 1) * 2, E.y - 1 + i, still(a, i === 0 || i === 2 ? 2 : 0), 6, W, ACORN.cirri, r.seed + i, 6, 7));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 3, 1) || shake(r.t - lastOf(r), 4, 1) }; },
  },

  // Cement Spear: a spear of white cement shoots from Rokbo, sticks in the foe, and the cement sets on it in gray crusts.
  acorn_cement: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, u), b = lerp(r.from, E, Math.max(0, u - 0.18)); line(b.x, b.y, p.x, p.y, ACORN.pale); px(p.x, p.y, W); });
      landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6), g = Math.min(1, a / 6); for (let q = 0; q < 4; q++) { const g2 = q * 1.6 + 0.4; oval(E.x + Math.cos(g2) * 3, E.y + Math.sin(g2) * 3, 1 + g, 1, q % 2 ? ACORN.pale : ACORN.shell, L); } if (a < 8) sparks(E.x, E.y, a, 6, W, ACORN.pale, r.seed, 7, 8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Shut Tight: Rokbo's cirri pull in and its plates slide shut over it into a hard gray cone.
  acorn_shut: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), g = ease(prog(t, 0, hit)), a = t - hit;
      if (g < 0.7) cirri(U.x, U.y - 3, toward(r), 1 - g, t, 1 - g);
      for (const s of [-1, 1]) { const x = U.x + s * (6 - 3 * g); line(x, U.y + 5, U.x + s * (1 + 2 * (1 - g)), U.y - 4, ACORN.shell, hold(t, 0, r.end, 5)); line(x + s, U.y + 5, U.x + s * (2 + 2 * (1 - g)), U.y - 4, ACORN.pale, hold(t, 0, r.end, 5)); }
      if (a >= 0 && a < 4) glint(U.x, U.y - 5, ACORN.pale);
    },
  },

  // Barnacle Bed: barnacle cones rain down on the foes and cement themselves round their feet in a bed, and the ground shakes.
  acorn_bed: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { wash(ACORN.dark, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      inbound(r, (u, E, i) => { const x = E.x + ((i % 6) - 2.5) * 3, y = E.y - (high(E) ? 16 : 26) * (1 - u * u); barnacleCone(x, y, 2); });
      landed(r, (E, a, i) => { const x = E.x + ((i % 6) - 2.5) * 3; barnacleCone(x, E.y + 6, 2 + (i & 1), fade(a, r.end - r.hits[i].at, 6)); if (a < 6) sparks(x, E.y + 4, a, 4, W, ACORN.pale, r.seed + i, 4, 6); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Comine (varix): the flared old lip of a shell, and its rising rage

const VARIX = { tan: '#ddb58d', rust: '#b75139', cream: '#f2eada', dark: '#4a2a1c', deep: '#180e0a' };
/** The flared lip at x, y rr across facing `dir`: a thick curve with a cream edge and a rust inside, with growth lines across it. */
function lipRim(x: number, y: number, rr: number, dir: number, lv = 1): void {
  const a0 = dir > 0 ? -0.2 : 0.3, a1 = dir > 0 ? 0.2 : 0.7;
  arc(x, y, rr, rr, VARIX.cream, lv, a0, a1); arc(x - dir, y, rr - 1, rr - 1, VARIX.tan, lv, a0, a1); arc(x - dir * 2, y, rr - 2, rr - 2, VARIX.rust, lv, a0 + 0.03, a1 - 0.03);
}
/** Rage rising off a whorl: small red puffs of steam over its head. */
function rageOn(p: Pt, t: number, lv = 1): void { for (let q = 0; q < 2; q++) { const k = (t + q * 6) % 12; px(p.x - 2 + q * 4, p.y - 6 - k * 0.5, VARIX.rust, lv * (1 - k / 12)); px(p.x - 2 + q * 4 + 1, p.y - 7 - k * 0.5, VARIX.cream, 0.5 * lv * (1 - k / 12)); } }

const VARIX_ART: Record<string, LegendArt> = {
  // Lip Toss: Comine throws a chip of its old lip over at the foe, and it bursts in tan and rust.
  varix_toss: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); lipRim(p.x, p.y, 3, Math.cos(t * 0.5) > 0 ? 1 : -1); });
      landed(r, (E, a) => chunks(E.x, E.y, still(a, 2), 6, VARIX.tan, VARIX.rust, r.seed, 14, 1.3, 1.3));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Lip Hop: Comine hops onto the foe, its lip snaps on it like a jaw, and rage steams up off it.
  varix_hop: {
    noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), a = t - hit;
      if (t < hit) { const p = sagAt(r.from, aim(r), prog(t, 2, hit), -10); if (t > 2) lipRim(p.x, p.y, 3, toward(r)); }
      landed(r, (E, aa) => { const g = Math.max(0, 4 - still(aa, 2) * 1.5), L = fade(aa, 10, 4); arc(E.x, E.y - g, 5, 3, VARIX.cream, L, 0.05, 0.45); arc(E.x, E.y + g, 5, 3, VARIX.rust, L, 0.55, 0.95); });
      if (a >= 0) rageOn(U, t, fade(a, r.end - hit, 6));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Grind: three ridges of lip close on the foe from three sides and grind on it in tan dust.
  varix_grind: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E, i) => { const g = i / 3 * Math.PI * 2 + 0.3, S = { x: E.x + Math.cos(g) * 15, y: E.y + Math.sin(g) * 9 }, p = lerp(S, E, ease(u)); lipRim(p.x, p.y, 3, Math.cos(g) > 0 ? -1 : 1); });
      landed(r, (E, a, i) => { const g = i / 3 * Math.PI * 2 + 0.3; lipRim(E.x + Math.cos(g) * 4, E.y + Math.sin(g) * 3, 3, Math.cos(g) > 0 ? -1 : 1, fade(a, 8, 3)); sparks(E.x, E.y, still(a, i === 2 ? 3 : 0), 5, VARIX.cream, VARIX.tan, r.seed + i, 6, 8); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 3, 1) || shake(r.t - lastOf(r), 6, 2) }; },
  },

  // Lip Break: Comine swells, a great new lip grows round it in bands, and it breaks off and smashes down on the foe.
  varix_spring: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(VARIX.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r), go = leaveOf(r), g = ease(prog(t, 0, go));
      if (t < go) { for (let k = 0; k < 3; k++) lipRim(U.x - dir * 2, U.y, 4 + k * 2 * g, dir, g); rageOn(U, t); }
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u, 1.3); lipRim(p.x, p.y, 6, dir); });
      landed(r, (E, a) => { const s = still(a, 6); if (a < 6) lipRim(E.x - dir * 2, E.y, 7, dir, fade(a, 6)); chunks(E.x, E.y, s, 9, VARIX.tan, VARIX.rust, r.seed, 16, 1.6, 1.5); rageOn(U, t, fade(a, r.end - hitOf(r), 6)); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },

  // Boulder Lob: big now, Comine lobs three tan boulders over the foes, and they come down with a thump.
  varix_boulder: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u, 1.2); blit(['.tt.', 'tcct', 'tttr', '.rr.'], p.x, p.y, { t: VARIX.tan, c: VARIX.cream, r: VARIX.rust }); });
      landed(r, (E, a, i) => { chunks(E.x, E.y + 3, still(a, i ? 0 : 2), 5, VARIX.tan, VARIX.rust, r.seed + i, 12, 1.3, 1.2); if (a < 10) { const n = Math.min(8, a * 2); line(E.x - n, E.y + 5, E.x + n, E.y + 5, VARIX.tan, fade(a, 10)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Wallop: big now, Comine stamps, a wave the shape of its lip rolls along the ground, and every foe is knocked back in dust.
  varix_wallop: {
    noLandings: true,
    back(r) { const a = r.t - hitOf(r); if (a >= 0 && a < 14) for (const E of r.to) lipRim(lerp(r.from, E, Math.min(1, a / 8)).x, lerp(r.from, E, Math.min(1, a / 8)).y + 4, 4, toward(r), fade(a, 14)); },
    front(r) { landed(r, (E, a) => { const away = high(E) ? 1 : -1; for (let q = 0; q < 3; q++) puff(E.x + away * (3 + q * 3), E.y + 4, a - 4 - q * 2, 12, VARIX.tan, VARIX.cream, 2, 0.1); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 10, 2) }; },
  },

  // Lip Crush: big now, Comine's lips close on the foe like jaws, chips fly, and it mends on what it bit.
  varix_crunch: {
    noLandings: true,
    front(r) {
      smear(r, VARIX.cream, VARIX.tan, 10);
      landed(r, (E, a) => { const g = Math.max(0, 5 - still(a, 2) * 1.6), L = fade(a, 12, 4); for (const s of [-1, 1]) lipRim(E.x + s * (3 + g), E.y, 5, -s, L); chunks(E.x, E.y, a, 5, VARIX.tan, VARIX.rust, r.seed, 12, 1.2, 1.2); mends(r.from, a - 4, VARIX.cream); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 2) }; },
  },
};

// ---------------------------------------------------------------- Kamorus (mew): a gull's wings riding the warm air, and the clock it keeps

const MEW = { white: '#f0f2f4', gold: '#dd9e09', gray: '#717b8a', deep: '#141820' };
/** A gull in the air: a white M of wings with gray tips, flapping with `flap`, `s` times size. */
function gull(x: number, y: number, flap: number, s = 1, lv = 1): void { blit(flap ? ['g.....g', '.ww.ww.', '...w...'] : ['.......', 'gww.wwg', '...w...'], x, y, { w: MEW.white, g: MEW.gray }, lv, s); px(x, y + s, MEW.gold, lv); }
/** Warm air rising from x, foot, h tall: pale curls that climb with t. */
function thermal(x: number, foot: number, h: number, t: number, lv = 1): void { for (let q = 0; q < 4; q++) { const k = (t * 0.6 + q * (h / 4)) % h; px(x + Math.sin((k + q * 3) / 3) * 3, foot - k, q % 2 ? MEW.white : MEW.gray, lv * (1 - k / h)); } }
/** A clock face at x, y with its hand at `hour` (0 to 12). */
function clock(x: number, y: number, hour: number, lv = 1): void { arc(x, y, 5, 5, MEW.white, lv); for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2; px(x + Math.cos(g) * 4, y + Math.sin(g) * 4, MEW.gray, lv); } const g = (hour / 12) * Math.PI * 2 - Math.PI / 2; line(x, y, x + Math.cos(g) * 4, y + Math.sin(g) * 4, MEW.gold, lv); line(x, y, x, y - 3, MEW.gray, lv); px(x, y, W, lv); }

const MEW_ART: Record<string, LegendArt> = {
  // Gull Dive: Kamorus folds and dives at the foe, its yellow beak strikes, and a white feather drifts off.
  mew_dive: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, MEW.white, MEW.gray, 12);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); line(p.x - 2, p.y - 1, p.x, p.y, MEW.white); line(p.x + 2, p.y - 1, p.x, p.y, MEW.white); px(p.x, p.y + 1, MEW.gold); });
      landed(r, (E, a) => { if (a < 4) { line(E.x - 3, E.y - 3, E.x, E.y, MEW.gold); line(E.x + 3, E.y - 3, E.x, E.y, W); } if (a >= 2 && a < 18) { const x = E.x + 4 + Math.sin(a / 3) * 2, y = E.y - 3 + (a - 2) * 0.5; px(x, y, MEW.white, fade(a - 2, 16)); px(x + 1, y + 1, MEW.gray, fade(a - 2, 16)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Wheel: gulls wheel round Kamorus on a column of warm air, and one goes over to circle the foe's head.
  mew_wheel: {
    noFlights: true, noLandings: true,
    back(r) { thermal(r.from.x, r.from.y + 4, 16, r.t, hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), a = t - hitOf(r);
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const g = aa / f.dur * Math.PI * 3 + f.i * 2.1, rr = 11 - 3 * aa / f.dur; gull(U.x + Math.cos(g) * rr, U.y - 4 + Math.sin(g) * rr * 0.4, (aa >> 2) & 1); }
      if (a >= 0) circling(across(r.from), a, 1, (x, y) => gull(x, y - 2, (a >> 2) & 1, 1, fade(a, r.end - hitOf(r), 6)), 6);
    },
  },

  // Wave Skim: Kamorus skims low with a white wake under it, snatches at the foe, and the water splashes up.
  mew_snatch: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      if (t < hitOf(r) + 2) { smear(r, MEW.white, '#a8d0e8', 12); line(U.x - 6, U.y + 5, U.x + 2, U.y + 5, MEW.white, 0.75); }
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20); line(x - dir * 6, E.y + 4, x, E.y + 4, '#a8d0e8'); px(x, E.y + 4, W); }
      landed(r, (E, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 6; q++) px(E.x + (q - 2.5) * 0.6 * s, E.y + 3 - 1.4 * s + 0.12 * s * s, q % 2 ? MEW.white : '#a8d0e8', fade(s, 12)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Forty Years: a clock face over Kamorus winds round to six, warm air rises under it, and it goes up with its gulls in a white flash.
  mew_forty: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const L = hold(r.t, 0, r.end, 6); wash(MEW.deep, 0.25 * L); thermal(r.from.x, r.from.y + 4, 22, r.t * 1.5, L); thermal(r.from.x + 5, r.from.y + 4, 18, r.t * 1.5 + 7, L); },
    front(r) {
      const t = r.t, U = userAt(r), C = perch(r.from);
      clock(C.x, C.y, 4 + 2 * ease(prog(t, 0, hitOf(r))), hold(t, 0, r.end, 6));
      inbound(r, (u, _, i) => gull(U.x - 6 + i * 4, U.y + 4 - 14 * u, (t >> 2) & 1));
      landed(r, (_, a, i) => { if (a < 6) glint(C.x + (i - 1.5) * 3, C.y + 6, MEW.gold, fade(a, 6)); });
    },
  },
};

// ---------------------------------------------------------------- Shiola (halite): square grains of salt with a pink cast

const HALITE = { white: '#f8f6f2', pink: '#f0b0c8', gray: '#8890b0', deep: '#16141c' };
/** A square grain of salt `s` across: a white top and left, a pink face, and a gray bottom and right. */
function saltCube(x: number, y: number, s: number, lv = 1): void {
  x = Math.round(x - s / 2); y = Math.round(y - s / 2);
  dither(x, y, s, s, HALITE.pink, lv); line(x, y, x + s - 1, y, HALITE.white, lv); line(x, y, x, y + s - 1, HALITE.white, lv);
  line(x + s - 1, y + 1, x + s - 1, y + s - 1, HALITE.gray, lv); line(x + 1, y + s - 1, x + s - 1, y + s - 1, HALITE.gray, lv);
  if (s >= 3) px(x + 1, y + 1, W, lv);
}
/** A grain breaking into small squares, a frames after: four cubes flying apart from x, y. */
function cubeBurst(x: number, y: number, a: number, seed: number, life = 12): void { if (a < 0 || a >= life) return; for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + hash(seed + q), d = 2 + a * 0.9; saltCube(x + Math.cos(g) * d, y + Math.sin(g) * d * 0.8 + 0.05 * a * a, 2, fade(a, life)); } }

const HALITE_ART: Record<string, LegendArt> = {
  // Grain Drop: a grain of salt flies at the foe and breaks into small squares, and a new Grain sets beside Shiola.
  halite_grain: {
    noFlights: true, noLandings: true,
    front(r) {
      const a = r.t - hitOf(r);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); saltCube(p.x, p.y, 3); });
      landed(r, (E, aa) => cubeBurst(E.x, E.y, still(aa, 2), r.seed));
      if (a >= 2) { const P = { x: r.from.x + toward(r) * 10, y: r.from.y + 3 }; saltCube(P.x, P.y - Math.max(0, 6 - a), 4, fade(a - 2, r.end - hitOf(r) - 2, 6)); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Dry Out: Shiola throws a grain over at the foe, it bursts, and square crystals of salt grow over the foe.
  halite_dryout: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); saltCube(p.x, p.y, 4); });
      landed(r, (E, a) => { cubeBurst(E.x, E.y - 1, still(a, 2), r.seed); const L = fade(a, r.end - hitOf(r), 6), g = Math.min(1, a / 8); for (let q = 0; q < 4; q++) { const g2 = q * 1.6 + 0.6; saltCube(E.x + Math.cos(g2) * 4, E.y + Math.sin(g2) * 3, 1 + Math.round(g * 2), L); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Square Off: Shiola stamps, salt cubes rise out of the ground at the four corners round every foe, and they crack.
  halite_square: {
    noFlights: true, noLandings: true,
    front(r) {
      const C = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      inbound(r, (u, E, i) => { const [cx, cy] = C[i % 4]; saltCube(E.x + cx * 6, E.y + cy * 4 + 6 * (1 - u), 3); });
      landed(r, (E, a, i) => { const [cx, cy] = C[i % 4], x = E.x + cx * 6, y = E.y + cy * 4; if (a < 4) saltCube(x, y, 3); else cubeBurst(x, y, a - 4, r.seed + i, 10); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Salt Pan: a white salt pan spreads under the foe in squares, every grain flies in and crashes onto it, and it flashes white.
  halite_pan: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, E = aim(r), g = ease(prog(t, 0, hitOf(r))), L = hold(t, 0, r.end, 6), n = Math.round(12 * g);
      wash(HALITE.deep, 0.25 * L);
      for (let i = -n; i <= n; i += 4) { line(E.x + i, E.y + 4, E.x + i, E.y + 7, HALITE.gray, L); } line(E.x - n, E.y + 5, E.x + n, E.y + 5, HALITE.white, L); line(E.x - n, E.y + 7, E.x + n, E.y + 7, HALITE.pink, 0.5 * L);
    },
    front(r) {
      inbound(r, (u, E, i) => { const g = i / 6 * Math.PI * 2 + 0.3, S = { x: E.x + Math.cos(g) * 18, y: E.y + Math.sin(g) * 10 }, p = lerp(S, E, ease(u)); saltCube(p.x, p.y, 3); });
      landed(r, (E, a, i) => cubeBurst(E.x, E.y, still(a, i === r.hits.length - 1 ? 5 : 0), r.seed + i, 10));
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 3) || shake(r.t - hitOf(r), 4, 1), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Nomipu (skitter): long hops onto shadows

const SKITTER = { sand: '#d2c2a2', white: '#f2eee2', dark: '#54443a', wet: '#8a7a60', deep: '#100c0a' };
/** A hop's track from a to b: a dotted arc h high, `n` of it laid. */
function hopTrack(a: Pt, b: Pt, h: number, n: number, lv = 1): void { for (let i = 0; i <= 30 * n; i++) { if (i % 3 === 2) continue; const p = sagAt(a, b, i / 30, -h); px(p.x, p.y, i % 3 ? SKITTER.sand : SKITTER.white, lv); } }
/** A shadow on the ground at x, foot, w across. */
function shadowSpot(x: number, foot: number, w: number, lv = 1): void { oval(x, foot, w, Math.max(1, w * 0.3), SKITTER.deep, 0.75 * lv); }

const SKITTER_ART: Record<string, LegendArt> = {
  // Pounce: Nomipu takes one long hop onto the foe's shadow, a dotted arc behind it, and bites as it lands.
  skitter_pounce: {
    noLandings: true,
    back(r) { const E = aim(r); if (r.t < hitOf(r) + 4) shadowSpot(E.x, E.y + 5, 5, hold(r.t, 0, hitOf(r) + 4, 3)); },
    front(r) {
      const t = r.t, hit = hitOf(r), E = aim(r);
      if (t < hit + 6) hopTrack(r.from, E, 14, prog(t, 0, hit), hold(t, 0, hit + 6, 3));
      landed(r, (E2, a) => { const g = Math.max(0, 4 - still(a, 2) * 1.4), L = fade(a, 10, 4); for (let i = -3; i <= 3; i++) { px(E2.x + i, E2.y - 2 - g, SKITTER.white, L); px(E2.x + i, E2.y + 2 + g, SKITTER.white, L); } puff(E2.x, E2.y + 4, a, 10, SKITTER.sand, SKITTER.white, 2, 0.1); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Sand Kick: Nomipu hops and kicks back, and sprays of wet sand sweep through every foe one after another.
  skitter_kick: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y + (f.i - 1) * 2; for (let k = 0; k < 5; k++) { const sx = x - dir * k * 1.5 + Math.sin(t + k) * 0.5; px(sx, y + (k & 1), k ? SKITTER.wet : W); } }
      landed(r, (E, a, i) => sparks(E.x, E.y + 1, still(a, i ? 0 : 2), 6, SKITTER.white, SKITTER.wet, r.seed + i, 6, 8));
      const a = t - lastOf(r); if (a >= 0) mends(r.from, a, SKITTER.white);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Sand Throw: Nomipu flings a handful of sand in the foe's face, it bursts in a dry cloud, and the foe reels.
  skitter_burrow: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { for (let q = 0; q < 6; q++) { const v = Math.max(0, u - q * 0.03), p = lerp(r.from, E, v); px(p.x + (hash(r.seed + q) - 0.5) * 4 * v, p.y - 1 + (hash(r.seed + q * 3) - 0.5) * 3 * v, q % 2 ? SKITTER.sand : SKITTER.white); } });
      landed(r, (E, a) => { puff(E.x, E.y - 2, a, 16, SKITTER.sand, SKITTER.white, 3, 0.15); if (a >= 4) circling(E, a, 3, (x, y) => px(x, y, SKITTER.white, fade(a, r.end - hitOf(r), 5))); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Night Hunt: the field goes dark, Nomipu hops off into the shadows from one dark spot to the next, and only its two eyes show where it waits.
  skitter_night: {
    lead: 8, noLandings: true,
    back(r) { const t = r.t, U = r.from, L = hold(t, 0, r.end, 6); wash(SKITTER.deep, 0.5 * L); for (let q = 0; q < 3; q++) shadowSpot(U.x + (q - 1) * 9, U.y + 5 + (q & 1), 4, L); },
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), a = t - hit;
      for (let q = 0; q < 2; q++) { const n = prog(t, q * 4, q * 4 + 6); if (n > 0 && t < hit) hopTrack({ x: U.x + (q - 1) * 9, y: U.y }, { x: U.x + q * 9, y: U.y + (q ? 0 : 1) }, 6, n, 0.75); }
      if (a >= 0 && ((t >> 3) & 3) !== 3) { px(U.x + 8, U.y + 2, W, fade(a, r.end - hit, 6)); px(U.x + 10, U.y + 2, W, fade(a, r.end - hit, 6)); }
    },
  },
};

// ---------------------------------------------------------------- Rakmata (fucus): the orange bladders of its wrack, and the pop when they burst

const FUCUS = { olive: '#84743a', orange: '#ed9f0b', dark: '#54443a', light: '#f8d080', deep: '#14120c' };
/** A bladder of wrack, `s` across: an orange oval with an olive rim and a white shine. */
function bladder(x: number, y: number, s = 1.5, lv = 1): void { oval(x, y, s + 0.5, s, FUCUS.olive, lv); oval(x, y, s - 0.5, s - 0.5, FUCUS.orange, lv); px(x - 1, y - 1, W, lv); }
/** A bladder popping a frames after: a white middle, then an orange ring breaking into four bits and olive scraps. */
function popBurst(x: number, y: number, a: number, s = 1): void {
  if (a < 0 || a >= 8) return;
  if (a < 2) px(x, y, W);
  const d = (2 + a) * s;
  for (const [i, j] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(x + i * d, y + j * d * 0.8, a < 4 ? FUCUS.orange : FUCUS.olive, fade(a, 8, 3));
  if (a < 4) arc(x, y, 1 + a * s, (1 + a * s) * 0.8, FUCUS.light, 1 - a / 4);
}
/** A frond of wrack from x, foot rising h, with bladders along it. */
function frond(x: number, foot: number, h: number, t: number, lv = 1): void { for (let k = 0; k < h; k++) { const sx = x + Math.round(Math.sin((t + k * 2) / 5) * 1.2); px(sx, foot - k, FUCUS.olive, lv); if (k % 4 === 3) oval(sx + 1, foot - k, 1, 1, FUCUS.orange, lv); } }

const FUCUS_ART: Record<string, LegendArt> = {
  // Pop Lob: a bladder lobs over and pops on the foe in a wet splash, and a smaller pop goes off at the reserve behind.
  fucus_lash: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lobAt(r.from, E, u); bladder(p.x, p.y, 2); });
      landed(r, (E, a) => { const s = still(a, 2); popBurst(E.x, E.y - 1, s, 1.2); if (s < 12) for (let q = 0; q < 6; q++) px(E.x + (q - 2.5) * 0.6 * s, E.y + 2 - 1.3 * s + 0.12 * s * s, q % 2 ? '#a8d0e0' : W, fade(s, 12)); popBurst(E.x + (high(E) ? 12 : -12), E.y + 2, a - 5, 0.7); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Inflate: three bladders close on the foe and swell under it, and it floats up off its feet.
  fucus_inflate: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, E = aim(r), n = r.hits.filter(h => t >= h.at).length;
      inbound(r, (u, E2, i) => { const g = i / 3 * Math.PI * 2 + 0.7, S = { x: E2.x + Math.cos(g) * 15, y: E2.y + Math.sin(g) * 9 }, p = lerp(S, { x: E2.x - 4 + i * 4, y: E2.y + 5 }, ease(u)); bladder(p.x, p.y, 1.5); });
      if (n) { const L = hold(t, hitOf(r), r.end, 6), lift = Math.min(4, (t - hitOf(r)) * 0.25); for (let q = 0; q < n; q++) bladder(E.x - 4 + q * 4, E.y + 5 - lift, 1.5 + n * 0.3, L); for (let q = 0; q < 3; q++) { const k = (t + q * 4) % 12; px(E.x - 3 + q * 3, E.y - 6 - k * 0.5, FUCUS.light, L * (1 - k / 12)); } }
      landed(r, (_, a, i) => { if (a < 4) glint(E.x - 4 + i * 4, E.y + 3, FUCUS.light, fade(a, 4)); });
    },
  },

  // Pop Field: two pods of wrack sprout on the foe's ground, bladders swelling on their stalks, waiting for whoever comes out next.
  fucus_pop: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, F = across(r.from);
      inbound(r, (u, _, i) => frond(F.x + (i ? 8 : -8), F.y + 5, Math.round(7 * u), t));
      landed(r, (_, a, i) => { const L = fade(a, r.end - r.hits[i].at, 6), x = F.x + (i ? 8 : -8); frond(x, F.y + 5, 7, t, L); bladder(x + 1, F.y - 3, 1.5 + 0.3 * Math.sin(t / 4), L); });
    },
  },

  // Wrack Bomb: a great clump of wrack swells over the foes, and five bladders drop out of it and pop one after another.
  fucus_wrack: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(FUCUS.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, g = ease(prog(t, 0, leaveOf(r))), last = lastOf(r);
      for (const E of r.to) { const P = { x: E.x, y: E.y - (high(E) ? 10 : 20) }; if (t < last) { for (let q = 0; q < 5; q++) bladder(P.x - 6 + q * 3, P.y + Math.sin(q + t / 5), 1 + g, hold(t, 0, last, 4)); line(P.x - 7, P.y + 2, P.x + 7, P.y + 2, FUCUS.olive, hold(t, 0, last, 4)); } }
      inbound(r, (u, E, i) => { const x = E.x - 6 + i * 3, top = E.y - (high(E) ? 10 : 20); bladder(x, top + (E.y - top) * u * u, 1.5); });
      landed(r, (E, a, i) => { popBurst(E.x - 6 + (i % 5) * 3, E.y - 1, still(a, i === 0 ? 3 : 0), 1); if (i === r.hits.length - 1) chunks(E.x, E.y, a, 6, FUCUS.olive, FUCUS.orange, r.seed, 14, 1.5, 1.3); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Cistako (flotsam): the crate, its planks, iron bands, and gold nails

const FLOTSAM = { wood: '#997149', gold: '#f9ca5a', iron: '#4c4c59', light: '#c8a070', deep: '#141218', sea: '#3a6a90' };
/** The crate at x, y, w each side and h tall from its top: planks with a light top, iron bands at the ends, and gold nails. */
function crate(x: number, y: number, w: number, h: number, lv = 1): void {
  x = Math.round(x); y = Math.round(y);
  dither(x - w, y, 2 * w + 1, h, FLOTSAM.wood, lv); line(x - w, y, x + w, y, FLOTSAM.light, lv);
  for (let j = 2; j < h; j += 3) line(x - w + 1, y + j, x + w - 1, y + j, '#7a5838', lv);
  line(x - w, y, x - w, y + h - 1, FLOTSAM.iron, lv); line(x + w, y, x + w, y + h - 1, FLOTSAM.iron, lv);
  px(x - w + 1, y + 1, FLOTSAM.gold, lv); px(x + w - 1, y + 1, FLOTSAM.gold, lv); px(x - w + 1, y + h - 2, FLOTSAM.gold, lv); px(x + w - 1, y + h - 2, FLOTSAM.gold, lv);
}
/** A nail driven in at x, y, `d` of the way down: a gold head on an iron shank. */
function nailIn(x: number, y: number, d: number, lv = 1): void { const up = Math.round(4 * (1 - d)); line(x, y - up, x, y - up + 2, FLOTSAM.iron, lv); px(x - 1, y - up, FLOTSAM.gold, lv); px(x, y - up, W, lv); px(x + 1, y - up, FLOTSAM.gold, lv); }

const FLOTSAM_ART: Record<string, LegendArt> = {
  // Batten: Cistako throws a plank that lands across the foe, and two gold nails drive it home.
  flotsam_batten: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); line(p.x - 5, p.y, p.x + 5, p.y, FLOTSAM.light); line(p.x - 5, p.y + 1, p.x + 5, p.y + 1, FLOTSAM.wood); });
      landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); line(E.x - 7, E.y - 1, E.x + 7, E.y + 1, FLOTSAM.light, L); line(E.x - 7, E.y, E.x + 7, E.y + 2, FLOTSAM.wood, L); nailIn(E.x - 5, E.y, Math.min(1, a / 4), L); nailIn(E.x + 5, E.y + 1, Math.min(1, Math.max(0, a - 4) / 4), L); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 4, 1) || shake(a - 4, 3, 1) }; },
  },

  // Stove In: Cistako comes down hard on the foe, boards splinter off it, and a plank stands across Cistako's front as a shield.
  flotsam_stove: {
    noLandings: true,
    front(r) {
      landed(r, (E, a) => { const s = still(a, 3); chunks(E.x, E.y, s, 8, FLOTSAM.wood, FLOTSAM.light, r.seed, 14, 1.5, 1.4); if (a < 6) sparks(E.x, E.y, a, 5, W, FLOTSAM.gold, r.seed, 6, 6); });
      const a = r.t - hitOf(r), U = userAt(r), dir = toward(r);
      if (a >= 2) { const L = fade(a, r.end - hitOf(r), 6); line(U.x + dir * 6, U.y - 5, U.x + dir * 6, U.y + 4, FLOTSAM.light, L); line(U.x + dir * 7, U.y - 5, U.x + dir * 7, U.y + 4, FLOTSAM.wood, L); px(U.x + dir * 6, U.y - 3, FLOTSAM.gold, L); px(U.x + dir * 6, U.y + 2, FLOTSAM.gold, L); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 8, 2) }; },
  },

  // Bob Up: a gold rope hooks out over the water to a small crate on the foe's side and hauls it bobbing back.
  flotsam_bob: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) {
        const a = t - f.t0; if (a < 0 || a >= f.dur) continue;
        const E = r.to[f.to] || r.to[0], half = f.dur / 2, back = a >= half, v = back ? 1 - ease((a - half) / half) : ease(a / half), p = lerp(U, E, v), n = Math.round(Math.hypot(p.x - U.x, p.y - U.y));
        for (let i = 0; i <= n; i++) { const q = sagAt(U, p, i / Math.max(1, n), 3); px(q.x, q.y, i % 3 ? FLOTSAM.gold : FLOTSAM.wood); }
        if (back) { crate(p.x, p.y - 3 + Math.round(Math.sin(t / 2)), 3, 5); line(p.x - 5, p.y + 3, p.x + 5, p.y + 3, FLOTSAM.sea); }
        else arc(p.x, p.y, 2, 2, FLOTSAM.gold, 1, 0.25, 0.9);
      }
      landed(r, (E, a) => { if (a < 4) glint(E.x, E.y, FLOTSAM.gold, fade(a, 4)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Nailed Shut: a crate's lid comes down over the foe, three gold nails drive into it one by one, and a drop of the foe's tide goes over to Cistako.
  flotsam_nailed: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { wash(FLOTSAM.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), last = lastOf(r), drop = ease(prog(t, leaveOf(r), hit)), L = hold(t, leaveOf(r), r.end, 6);
      if (L > 0) { const y = E.y - 7 - 10 * (1 - drop); crate(E.x, y, 7, 3, L); }
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; nailIn(E.x - 4 + f.i * 4, E.y - 7, ease(a / f.dur) * 0.3, 1); }
      landed(r, (_, a, i) => nailIn(E.x - 4 + i * 4, E.y - 7, Math.min(1, (a + 1) / 2), L));
      const a = t - last; if (a >= 4) { const u = prog(a, 4, 18); if (u > 0 && u < 1) { const p = sagAt(E, r.from, u, -8); blit(['.b.', 'bwb', '.b.'], p.x, p.y, { b: FLOTSAM.sea, w: W }); } }
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Mibu (mote): a grain of star warm on one side, turning

const MOTE = { rust: '#9e522e', gold: '#e9ab20', teal: '#027977', pale: '#f8e098', deep: '#0c1a1a' };
/** The grain, rr across, its warm side turned to `turn`: a teal disc with its gold half on the warm side and a white point at its hottest. */
function warmGrain(x: number, y: number, rr: number, turn: number, lv = 1): void {
  oval(x, y, rr, rr, MOTE.teal, lv);
  const c = Math.cos(turn), s = Math.sin(turn);
  for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) if (i * i + j * j <= rr * rr && i * c + j * s > 0) px(x + i, y + j, i * c + j * s > rr * 0.6 ? MOTE.pale : MOTE.gold, lv);
  px(x + c * rr * 0.6, y + s * rr * 0.6, W, lv);
}
/** Warm rays off a point, a frames on: short gold strokes that pulse out and back. */
function warmRays(x: number, y: number, a: number, rr: number, lv = 1): void { const k = (a >> 1) % 3; for (let q = 0; q < 8; q++) { const g = q / 8 * Math.PI * 2; line(x + Math.cos(g) * (rr + k), y + Math.sin(g) * (rr + k), x + Math.cos(g) * (rr + 2 + k), y + Math.sin(g) * (rr + 2 + k), q % 2 ? MOTE.gold : MOTE.pale, lv); } }

const MOTE_ART: Record<string, LegendArt> = {
  // Warm Glint: a warm glint flies from Mibu to the foe and breaks in gold rays, and warmth glints on its own side.
  mote_glint: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); warmGrain(p.x, p.y, 2, t * 0.4); tail(p, lerp(r.from, E, Math.max(0, u - 0.1)), MOTE.gold, MOTE.rust, MOTE.teal, 4); });
      landed(r, (E, a) => { if (a < 10) warmRays(E.x, E.y, a, 3, fade(a, 10)); mends({ x: r.from.x - toward(r) * 8, y: r.from.y }, a - 2, MOTE.gold); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Turn Over: the grain turns its warm side round, and a warm pylon rises beside Mibu with heat shimmering off its gold tip.
  mote_turn: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), P = { x: r.from.x + toward(r) * 10, y: r.from.y + 5 }, hit = hitOf(r), a = t - hit;
      if (a < 0) warmGrain(U.x, U.y - 9, 2, t * 0.3);
      inbound(r, (u) => { const h = Math.round(9 * u); line(P.x, P.y, P.x, P.y - h, MOTE.rust); line(P.x + 1, P.y, P.x + 1, P.y - h + 1, MOTE.teal); px(P.x, P.y - h, MOTE.gold); });
      if (a >= 0) { const L = fade(a, r.end - hit, 6); line(P.x, P.y, P.x, P.y - 9, MOTE.rust, L); line(P.x + 1, P.y, P.x + 1, P.y - 8, MOTE.teal, L); px(P.x, P.y - 10, MOTE.gold, L); px(P.x, P.y - 11, W, L); warmRays(P.x, P.y - 10, a, 1, 0.75 * L); }
    },
  },

  // Handful: Mibu runs in and flings a handful of hot grains, gold and rust, that burst on the foe one after another.
  mote_hand: {
    noFlights: true, noLandings: true,
    front(r) {
      smear(r, MOTE.gold, MOTE.rust, 9);
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u); for (let q = 0; q < 3; q++) px(p.x + (q - 1) * 1.5, p.y + (i - 1) + (q & 1), q === 1 ? MOTE.pale : MOTE.gold); });
      landed(r, (E, a, i) => sparks(E.x, E.y, still(a, i ? 0 : 2), 5, MOTE.pale, MOTE.gold, r.seed + i, 6, 7));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Captive Star: a small sun gathers over Mibu, circles it once, settles over the foe, and is held there blazing.
  mote_star: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(MOTE.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), go = leaveOf(r), hit = hitOf(r), a = t - hit, E = aim(r);
      if (t < go) warmGrain(U.x, U.y - 10, 1 + Math.round(3 * prog(t, 0, go)), t * 0.3);
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const u = aa / f.dur, O = { x: U.x + 9, y: U.y }, p = u < 0.6 ? { x: U.x + Math.cos(u / 0.6 * Math.PI * 2) * 9, y: U.y - 4 + Math.sin(u / 0.6 * Math.PI * 2) * 5 } : lerp(O, { x: E.x, y: E.y - 9 }, (u - 0.6) / 0.4); warmGrain(p.x, p.y, 4, t * 0.3); }
      if (a >= 0) { const L = fade(a, r.end - hit, 6); warmGrain(E.x, E.y - 9, 4, t * 0.3, L); warmRays(E.x, E.y - 9, a, 5, L); }
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 10, 2) }; },
    lights(r) { const E = aim(r), a = r.t - hitOf(r); return a >= 0 ? [{ x: Math.round(E.x), y: Math.round(E.y - 9), r: 12, lv: 1.4 * fade(a, r.end - hitOf(r), 6), tint: MOTE.gold }] : []; },
  },
};

// ---------------------------------------------------------------- Ampullo (seaglass): rounded, frosted pieces of bottle glass

const SEAGLASS = { green: '#a1d9c1', white: '#eefdf6', dark: '#336351', deep: '#0e1c16' };
/** A piece of sea glass, w by h: a rounded green pebble frosted with a dither of white, a dark lower edge, and one bright shine. */
function seaGlass(x: number, y: number, w: number, h: number, lv = 1): void { oval(x, y, w, h, SEAGLASS.green, lv); oval(x, y, w, h, SEAGLASS.white, 0.25 * lv); arc(x, y, w, h, SEAGLASS.dark, lv, 0.1, 0.4); px(x - w * 0.4, y - h * 0.4, W, lv); }
/** A sliver of broken bottle along `ang`: a green blade `len` long with a white edge and a dark back. */
function glassKnife(x: number, y: number, ang: number, len: number, lv = 1): void { const c = Math.cos(ang), s = Math.sin(ang); line(x - c * len / 2, y - s * len / 2, x + c * len / 2, y + s * len / 2, SEAGLASS.green, lv); line(x - c * len / 2 - s, y - s * len / 2 + c, x + c * (len / 2 - 1) - s, y + s * (len / 2 - 1) + c, SEAGLASS.dark, lv); px(x + c * len / 2, y + s * len / 2, W, lv); }

const SEAGLASS_ART: Record<string, LegendArt> = {
  // Shard Knives: two green slivers of bottle glass fly at the foe and cut it, and dark drops run from the cuts.
  seaglass_shard: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E, i) => { const p = lerp(r.from, E, u); glassKnife(p.x, p.y + (i ? 2 : -2), Math.atan2(E.y - r.from.y, E.x - r.from.x), 6); });
      landed(r, (E, a, i) => { const n = Math.min(1, (still(a, 1) + 1) / 3); if (a < 10) line(E.x + 5 - i * 3, E.y - 5, E.x + 5 - i * 3 - 9 * n, E.y - 5 + 9 * n, i ? SEAGLASS.green : W, fade(a, 10)); for (let q = 0; q < 2; q++) { const aa = a - 3 - q * 3; if (aa >= 0 && aa < 12) px(E.x - 2 + q * 3 + i, E.y + aa * 0.5, SEAGLASS.dark, fade(aa, 12)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Rub Through: Ampullo rubs through the foe sharp end first, leaving frosted streaks across it.
  seaglass_rub: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      smear(r, SEAGLASS.white, SEAGLASS.green, 10);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20); for (let k = 0; k < 6; k++) px(x - dir * k, E.y - 1 + (k & 1) * 2, k ? SEAGLASS.green : W, k < 5 ? 1 : 0.5); }
      landed(r, (E, a) => { const L = fade(a, 14, 5); for (let q = 0; q < 3; q++) line(E.x - 6, E.y - 3 + q * 3, E.x + 6, E.y - 2 + q * 3, q === 1 ? SEAGLASS.white : SEAGLASS.green, 0.5 * L); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Break Glass: Ampullo breaks into frosted pieces that circle it and settle into a ring round it, there to take the blows.
  seaglass_break: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const g = a / f.dur * Math.PI * 4 + f.i * Math.PI / 2, rr = 10 - 3 * a / f.dur; seaGlass(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, 1.5, 1); }
      landed(r, (_, a, i) => { const g = i * Math.PI / 2 + 0.4, L = fade(a, r.end - r.hits[i].at, 6); seaGlass(U.x + Math.cos(g) * 7, U.y + Math.sin(g) * 4, 1.5, 1, L); if (a < 4) glint(U.x + Math.cos(g) * 7, U.y + Math.sin(g) * 4 - 2, SEAGLASS.white, fade(a, 4)); });
    },
  },

  // Beach Glass: three rounded pieces of sea glass close on the foe and grind it, and the last one cuts it through.
  seaglass_beach: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(SEAGLASS.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, last = lastOf(r), a = t - last;
      smear(r, SEAGLASS.white, SEAGLASS.green, 12);
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const E = r.to[f.to] || r.to[0], g = f.i / 3 * Math.PI * 2 + 0.5, S = { x: E.x + Math.cos(g) * 16, y: E.y + Math.sin(g) * 9 }, p = lerp(S, E, ease(aa / f.dur)); seaGlass(p.x, p.y, 2.5, 1.5); }
      landed(r, (E, aa, i) => { const g = i / 3 * Math.PI * 2 + 0.5; seaGlass(E.x + Math.cos(g) * 4, E.y + Math.sin(g) * 3, 2.5, 1.5, fade(aa, 8, 3)); sparks(E.x, E.y, aa, 5, W, SEAGLASS.green, r.seed + i, 6, 7); });
      if (a >= 0) { const E = aim(r), n = Math.min(1, (still(a, 6) + 1) / 3), L = fade(a, 14, 5); thick(E.x + 8, E.y - 7, E.x + 8 - 16 * n, E.y - 7 + 14 * n, W, L, SEAGLASS.green); }
    },
    scene(r) { const a = r.t - lastOf(r); return { jolt: shake(a, 12, 3) || shake(r.t - hitOf(r), 4, 1), glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Kamono (kipper): a flat dried fish and the salt on it

const KIPPER = { blue: '#5d8ab9', white: '#f8f8f8', dark: '#335380', deep: '#0c1420' };
/** A split dried fish facing `dir`, `s` times size: a flat blue body with white ribs, an eye, and a forked tail. */
function kipperFish(x: number, y: number, dir: number, s = 1, lv = 1): void { blit(['d.bbbbb.', 'ddbwbwbw', 'd.bbbbb.'], x, y, { b: KIPPER.blue, w: KIPPER.white, d: KIPPER.dark }, lv, s, dir < 0); px(x + dir * 3 * s, y - s * 0.5, W, lv); }
/** Salt sprinkled down over x, y, a frames on: white grains that drift down. */
function saltFall(x: number, y: number, a: number, lv = 1, w = 6): void { for (let q = 0; q < 6; q++) { const k = (a + q * 3) % 14; px(x - w + q * (2 * w / 5), y - 6 + k * 0.7, q % 2 ? W : '#d8e4ec', lv * (1 - k / 14)); } }

const KIPPER_ART: Record<string, LegendArt> = {
  // Kipper Slap: a big flat kipper swings through every foe sideways and slaps it, and salt flakes spray off.
  kipper_slap: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur; kipperFish(E.x + dir * (44 * u - 20), E.y - 1 + Math.sin(Math.PI * u) * 2, dir, 1); }
      landed(r, (E, a) => { const s = still(a, 2); if (s < 12) for (let q = 0; q < 6; q++) px(E.x + (q - 2.5) * 0.7 * s, E.y - 1.2 * s + 0.12 * s * s, q % 2 ? W : KIPPER.blue, fade(s, 12)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 6, 1) }; },
  },

  // Bubble Up: brine bubbles rise round the ally and pop into salt, and it stands stiff and mended in a white outline.
  kipper_desiccate: {
    noFlights: true, noLandings: true,
    front(r) {
      const A = r.to[0];
      inbound(r, (u, _, i) => arc(A.x - 5 + i * 5, A.y + 5 - 10 * u, 1.5, 1.5, KIPPER.white));
      landed(r, (_, a, i) => { if (a < 6) sparks(A.x - 5 + i * 5, A.y - 5, a, 4, W, KIPPER.blue, r.seed + i, 3, 6); });
      const a = r.t - lastOf(r); if (a >= 0) { const L = fade(a, r.end - lastOf(r), 6); for (let i = -4; i <= 4; i += 2) { px(A.x + i, A.y - 5, W, L); px(A.x + i, A.y + 5, W, L); } mends(A, a, KIPPER.white); }
    },
  },

  // Flip Under: a strand of wrack whips the foe, and Kamono flips under a heap of wrack where it lies hidden.
  kipper_flip: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), a = t - hit;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); for (let k = 0; k < 6; k++) { const q = lerp(r.from, E, Math.max(0, u - k * 0.04)); px(q.x, q.y + Math.round(Math.sin(t + k) * 1.5), k ? '#4a6a3a' : '#8aa85a'); } px(p.x, p.y, W); });
      landed(r, (E, aa) => { if (aa < 6) { const n = Math.min(1, (aa + 1) / 3); line(E.x - 5, E.y - 4, E.x - 5 + 10 * n, E.y + 3 * n, '#8aa85a', fade(aa, 6)); } });
      if (a >= 2) { const L = fade(a - 2, r.end - hit - 2, 6); for (let q = 0; q < 5; q++) arc(U.x - 4 + q * 2, U.y + 4, 3, 2, q % 2 ? '#4a6a3a' : '#8aa85a', L, 0.5, 1); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Cured: the field darkens, a great kipper closes on the foe with its mouth open and swallows it, and salt falls over it.
  kipper_cured: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { wash(KIPPER.deep, 0.5 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, E = aim(r), hit = hitOf(r), a = t - hit, dir = toward(r);
      inbound(r, (u, E2) => { const S = { x: E2.x - dir * 18, y: E2.y }, p = lerp(S, E2, ease(u)); kipperFish(p.x, p.y, dir, 2); });
      if (a >= 0) { const L = fade(a, r.end - hit, 6); kipperFish(E.x, E.y, dir, 2, L); saltFall(E.x, E.y - 4, a, L, 7); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 10, 2) }; },
  },
};

// ---------------------------------------------------------------- Isoko (actinia): a crown of pink tentacles and its stinging cells

const ACTINIA = { red: '#c2533c', pink: '#e596b5', pale: '#dfe5eb', deep: '#1c0e12', pool: '#2a5a7a' };
/** A crown of n tentacles from x, y, `open` from 0 shut to 1 spread, waving with t: pink with pale tips. */
function tentacles(x: number, y: number, n: number, open: number, t: number, lv = 1, len = 6): void {
  for (let q = 0; q < n; q++) { const base = -Math.PI / 2 + (q - (n - 1) / 2) * 0.35 * open; let cx = x, cy = y; for (let i = 0; i < len; i++) { const g = base + Math.sin(t * 0.25 + q + i * 0.5) * 0.25 * open; cx += Math.cos(g); cy += Math.sin(g); px(cx, cy, i === len - 1 ? ACTINIA.pale : i < 2 ? ACTINIA.red : ACTINIA.pink, lv); } }
}
/** A sting: pale stinging cells pricking into a spot, a frames after. */
function stingCells(x: number, y: number, a: number): void { if (a < 0 || a >= 8) return; for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2 + 0.78, d = 1 + a * 0.4; px(x + Math.cos(g) * d, y + Math.sin(g) * d, a < 3 ? W : ACTINIA.pale, fade(a, 8, 3)); } }

const ACTINIA_ART: Record<string, LegendArt> = {
  // Arm Lunge: Isoko throws one long tentacle out to the foe, it wraps on, and its cells sting.
  actinia_arm: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r);
      const arm = (p: Pt, lv: number): void => { const n = Math.round(Math.hypot(p.x - U.x, p.y - U.y)); for (let i = 0; i <= n; i++) { const q = lerp(U, p, i / Math.max(1, n)); px(q.x, q.y + Math.round(Math.sin(i * 0.4 + t * 0.5)), i >= n - 1 ? ACTINIA.pale : ACTINIA.pink, lv); } };
      inbound(r, (u, E) => arm(lerp(U, E, u), 1));
      landed(r, (E, a) => { if (a < 6) arm(E, 1 - a / 6); arc(E.x, E.y, 5, 3, ACTINIA.pink, fade(a, 12, 4)); stingCells(E.x, E.y, still(a, 2)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Close Up: Isoko's tentacles fold in over it and it shuts tight into a red ball inside a pale ring.
  actinia_close: {
    tail: 4, noLandings: true,
    front(r) {
      const t = r.t, U = userAt(r), hit = hitOf(r), g = ease(prog(t, 0, hit)), a = t - hit;
      if (g < 1) tentacles(U.x, U.y - 2, 5, 1 - g, t, 1, Math.round(6 - 3 * g));
      if (a >= 0) { const L = fade(a, r.end - hit, 6); oval(U.x, U.y + 1, 4, 3, ACTINIA.red, 0.5 * L); arc(U.x, U.y + 1, 6, 5, ACTINIA.pale, L); }
    },
  },

  // Arms Around: Isoko's tentacles reach out to a friend's outline beside it, wrap it, and draw it in safe.
  actinia_bloom: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, P = { x: U.x - toward(r) * 11, y: U.y }, last = lastOf(r), a = t - last;
      reflection(P.x, P.y, 0.5 * hold(t, 0, last + 4, 4));
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const half = f.dur / 2, v = aa < half ? ease(aa / half) : 1 - ease((aa - half) / half), p = lerp({ x: U.x, y: U.y - 2 }, { x: P.x, y: P.y - 2 + f.i * 2 }, v), n = Math.round(Math.hypot(p.x - U.x, p.y - U.y)); for (let i = 0; i <= n; i++) { const q = lerp(U, p, i / Math.max(1, n)); px(q.x, q.y - 2 + Math.round(Math.sin(i * 0.5 + t * 0.4)), i >= n - 1 ? ACTINIA.pale : ACTINIA.pink); } }
      if (a >= 0) { tentacles(U.x, U.y - 2, 5, 0.6, t, fade(a, r.end - last, 6)); mends(U, a, ACTINIA.pink); }
    },
  },

  // Pool Challenge: a tide pool spreads under the foe, four tentacles rise out of it and sting it one after another, and Isoko's side mends.
  actinia_pool: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { const t = r.t, E = aim(r), L = hold(t, 0, r.end, 6), g = ease(prog(t, 0, leaveOf(r))); wash(ACTINIA.deep, 0.25 * L); oval(E.x, E.y + 5, 4 + 9 * g, 1 + 2 * g, ACTINIA.pool, L); arc(E.x, E.y + 5, 4 + 9 * g, 1 + 2 * g, ACTINIA.pale, L, 0.05, 0.45); },
    front(r) {
      const t = r.t, a = t - lastOf(r);
      inbound(r, (u, E, i) => { const x = E.x - 6 + i * 4; tentacles(x, E.y + 5, 1, 1, t + i * 3, 1, Math.round(9 * u)); });
      landed(r, (E, aa, i) => { const x = E.x - 6 + (i % 4) * 4; tentacles(x, E.y + 5, 1, 1, t + i * 3, fade(aa, r.end - r.hits[i].at, 6), 9); stingCells(E.x - 3 + (i % 4) * 2, E.y - 1, still(aa, i === 0 || i === 3 ? 2 : 0)); });
      if (a >= 0) mends(r.from, a, ACTINIA.pink);
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 3, 1) || shake(r.t - lastOf(r), 6, 2) }; },
  },
};

// ---------------------------------------------------------------- Keeba (lacuna): the hollow a taken shell left, and hollow copies of shells

const LACUNA = { teal: '#59bfaf', pink: '#c0667c', cream: '#f2e2ca', deep: '#0e1418', sand: '#8a7a68' };
/** A hollow shell: the outline of a whelk `s` times size in teal with a pink lip, empty inside. */
function hollowShell(x: number, y: number, s = 1, lv = 1): void { blit(['..t..', '.t.t.', 't...t', 't..pt', '.tpp.'], x, y, { t: LACUNA.teal, p: LACUNA.pink }, lv, s); }
/** The hollow in the sand where a shell lay at x, foot, w across: a dark dip with a cream lip. */
function sandHollow(x: number, foot: number, w: number, lv = 1): void { oval(x, foot, w, Math.max(1, w * 0.3), LACUNA.deep, lv); arc(x, foot, w, Math.max(1, w * 0.3), LACUNA.cream, lv, 0.55, 0.95); arc(x, foot, w + 1, Math.max(1, w * 0.3) + 0.5, LACUNA.sand, 0.5 * lv, 0.05, 0.45); }

const LACUNA_ART: Record<string, LegendArt> = {
  // Scoop: two hollow shells fly at the foe, each scooping a piece out of it with a pink burst.
  lacuna_scoop: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); hollowShell(p.x, p.y, 1); });
      landed(r, (E, a, i) => { const s = still(a, i ? 0 : 2); if (s < 10) for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + i, d = 2 + s; px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, q % 2 ? LACUNA.pink : LACUNA.cream, fade(s, 10)); } if (a < 8) arc(E.x, E.y, 3, 2, LACUNA.deep, fade(a, 8)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Sweep Off: Keeba fades into the sand, leaving its hollow, and a hollow copy of a shell stands up beside it.
  lacuna_sweep: {
    tail: 6, noLandings: true,
    back(r) { sandHollow(r.from.x, r.from.y + 5, 5, hold(r.t, 0, r.end, 6)); },
    front(r) { const a = r.t - hitOf(r), P = { x: r.from.x + toward(r) * 10, y: r.from.y }; if (a >= 0) { const L = fade(a, r.end - hitOf(r), 6); hollowShell(P.x, P.y + Math.max(0, 4 - a), 2, L); sandHollow(P.x, P.y + 5, 4, L); } },
  },

  // Sink Barbs: a ball of barbs flies at the foe, sinks its hooks in, and dark drops run.
  lacuna_sink: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); px(p.x, p.y, LACUNA.pink); for (let q = 0; q < 6; q++) { const g = q / 6 * Math.PI * 2 + t * 0.2; line(p.x + Math.cos(g), p.y + Math.sin(g), p.x + Math.cos(g) * 3, p.y + Math.sin(g) * 3, q % 2 ? LACUNA.teal : LACUNA.cream); } });
      landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); for (let q = 0; q < 4; q++) { const g = q * Math.PI / 2 + 0.78; line(E.x + Math.cos(g) * 5, E.y + Math.sin(g) * 4, E.x + Math.cos(g) * 3, E.y + Math.sin(g) * 2, LACUNA.teal, L); } for (let q = 0; q < 2; q++) { const aa = a - 3 - q * 4; if (aa >= 0 && aa < 12) px(E.x - 2 + q * 4, E.y + 1 + aa * 0.5, LACUNA.pink, fade(aa, 12)); } });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Dead Low: the tide drains to dead low, hollows open in the sand under every foe, and five shells rise hollow out of them and pull them down.
  lacuna_deadlow: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6); wash(LACUNA.deep, 0.5 * L); for (const E of r.to) sandHollow(E.x, E.y + 5, Math.round(3 + 8 * ease(prog(t, 4, hitOf(r)))), L); },
    front(r) {
      inbound(r, (u, E, i) => hollowShell(E.x - 6 + i * 3, E.y + 5 - 8 * u, 1, Math.min(1, u * 3)));
      landed(r, (E, a, i) => { const x = E.x - 6 + (i % 5) * 3; hollowShell(x, E.y - 3 + Math.min(4, a * 0.5), 1, fade(a, r.end - r.hits[i].at, 6)); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 12, 3) || shake(r.t - hitOf(r), 4, 1) }; },
  },
};

// ---------------------------------------------------------------- Cohato (columba): the doves out of a sand dollar, and the dollar itself

const COLUMBA = { white: '#f5f5f9', gold: '#e0b02a', gray: '#919191', night: '#121430' };
/** A sand dollar rr across: a pale disc with a gold five-petal star on it. */
function sandDollar(x: number, y: number, rr: number, turn = 0, lv = 1): void {
  oval(x, y, rr, rr * 0.9, COLUMBA.white, lv); arc(x, y, rr, rr * 0.9, COLUMBA.gray, lv);
  for (let q = 0; q < 5; q++) { const g = turn + q / 5 * Math.PI * 2 - Math.PI / 2; line(x + Math.cos(g), y + Math.sin(g), x + Math.cos(g) * rr * 0.65, y + Math.sin(g) * rr * 0.6, COLUMBA.gold, lv); }
}
/** A white dove, wings up or down with `flap`, facing `dir`. */
function dove(x: number, y: number, flap: boolean, dir: number, lv = 1): void { blit(flap ? ['w...w', '.w.w.', '..wwg'] : ['.....', 'wwwwg', '.w...'], x, y, { w: COLUMBA.white, g: COLUMBA.gold }, lv, 1, dir < 0); }

const COLUMBA_ART: Record<string, LegendArt> = {
  // Dove Wing: a dove flies up out of a sand dollar to the ally and folds its wings round it, mending it.
  columba_wing: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, A = r.to[0], U = userAt(r), dir = toward(r);
      if (t < leaveOf(r) + 2) sandDollar(U.x, U.y - 9, 3, t * 0.1);
      inbound(r, (u) => { const p = sagAt({ x: U.x, y: U.y - 9 }, { x: A.x, y: A.y - 4 }, u, -8); dove(p.x, p.y, ((t >> 2) & 1) === 1, dir); });
      landed(r, (_, a) => { if (a < 10) { arc(A.x - 4, A.y, 4, 5, COLUMBA.white, fade(a, 10), 0.25, 0.75); arc(A.x + 4, A.y, 4, 5, COLUMBA.white, fade(a, 10), 0.75, 1.25); } mends(A, a, COLUMBA.gold); });
    },
  },

  // Dollar Edge: Cohato spins a sand dollar edge-on at the foe and it cuts, and a gold glint goes to its ally.
  columba_carry: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u), w = Math.max(1, Math.round(Math.abs(Math.cos(t * 0.7)) * 3)); oval(p.x, p.y, w, 3, COLUMBA.white); line(p.x, p.y - 2, p.x, p.y + 2, COLUMBA.gold); });
      landed(r, (E, a) => { const n = Math.min(1, (still(a, 2) + 1) / 3); if (a < 10) thick(E.x + 6, E.y - 6, E.x + 6 - 12 * n, E.y - 6 + 12 * n, COLUMBA.white, fade(a, 10, 4), COLUMBA.gold); if (a >= 2 && a < 12) glint(r.from.x + toward(r) * 2, r.from.y - 7, COLUMBA.gold, fade(a - 2, 10)); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Fly Home: three doves fly in at night and bring a friend home in a ring of them.
  columba_home: {
    noFlights: true, noLandings: true,
    back(r) { wash(COLUMBA.night, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, A = r.to[0], dir = toward(r);
      inbound(r, (u, _, i) => { const g = i / 3 * Math.PI * 2, S = { x: A.x - dir * 18 + i * 3, y: A.y - 14 + i * 4 }, p = sagAt(S, { x: A.x + Math.cos(g) * 6, y: A.y - 2 + Math.sin(g) * 3 }, u, -4); dove(p.x, p.y, ((t >> 2) + i) % 2 === 1, dir); });
      landed(r, (_, a, i) => { const g = i / 3 * Math.PI * 2 + a * 0.08; dove(A.x + Math.cos(g) * 7, A.y - 3 + Math.sin(g) * 3, ((t >> 2) + i) % 2 === 1, dir, fade(a, r.end - r.hits[i].at, 6)); });
      mends(A, t - lastOf(r), COLUMBA.gold);
    },
  },

  // Ring Home: night falls, a great sand dollar rises over Cohato's side, its five doves fly out of it, and gold rings come down over the team.
  columba_ring: {
    lead: 8, noFlights: true, noLandings: true,
    back(r) { const t = r.t, L = hold(t, 0, r.end, 6), B = perch(r.from); wash(COLUMBA.night, 0.5 * L); sandDollar(B.x, B.y - 2 * ease(prog(t, 0, 12)), 5, t * 0.04, L); },
    front(r) {
      const t = r.t, B = perch(r.from), U = r.from, dir = toward(r), last = lastOf(r), a = t - last;
      inbound(r, (u, _, i) => { const g = -Math.PI / 2 + (i - 2) * 0.6, p = { x: B.x + Math.cos(g) * (3 + 14 * u), y: B.y + Math.sin(g) * 3 + 12 * u * u }; dove(p.x, p.y, ((t >> 2) + i) % 2 === 1, dir); });
      landed(r, (_, aa, i) => { if (aa < 6) glint(U.x - 8 + i * 4, U.y - 6, COLUMBA.gold, fade(aa, 6)); });
      if (a >= 0) { for (let q = 0; q < 2; q++) ringOut(U.x, U.y + 3, a - q * 4, 16, 12, q ? COLUMBA.white : COLUMBA.gold, 0.35); mends(U, a, COLUMBA.gold); }
    },
    scene(r) { const a = r.t - lastOf(r); return { glare: a >= 0 && a < 2 ? 0.25 : 0 }; },
  },
};

// ---------------------------------------------------------------- Spijire (lobworm): coiled casts of sand that keep curling

const LOBWORM = { sand: '#bfa77f', mint: '#a3ebbb', dark: '#554b43', light: '#e0d0b0', deep: '#14100c' };
/** A coiled cast on `foot` at x, `s` loops tall: stacked loops of sand, each narrower, with a mint tip that curls with t. */
function cast(x: number, foot: number, s: number, t: number, lv = 1): void {
  for (let k = 0; k < s; k++) { const w = Math.max(1, s + 1 - k), y = foot - k * 2, o = ((k + (t >> 3)) & 1) ? 1 : -1; arc(x + o * 0.5, y, w, 1.2, LOBWORM.sand, lv, 0.5, 1); arc(x + o * 0.5, y, w, 1.2, LOBWORM.dark, lv, 0, 0.5); px(x + o * w, y, LOBWORM.light, lv); }
  px(x, foot - s * 2, LOBWORM.mint, lv); px(x + ((t >> 2) & 1 ? 1 : -1), foot - s * 2 - 1, LOBWORM.mint, lv);
}
/** A coil of sand thrown along: a small spiral `rr` across turning with t. */
function sandCoil(x: number, y: number, rr: number, t: number, lv = 1): void { for (let i = 0; i < 10; i++) { const g = i * 0.7 + t * 0.4, d = rr * i / 10; px(x + Math.cos(g) * d, y + Math.sin(g) * d * 0.7, i > 7 ? LOBWORM.mint : LOBWORM.sand, lv); } }

const LOBWORM_ART: Record<string, LegendArt> = {
  // Curl: Spijire spins a coil of sand at the foe, and it curls tight round it, and Spijire mends.
  lobworm_curl: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); sandCoil(p.x, p.y, 3, t); });
      landed(r, (E, a) => { const L = fade(a, 14, 5), rr = Math.max(3, 7 - still(a, 2) * 0.6); for (let i = 0; i < 16; i++) { const g = i * 0.6 + a * 0.3, d = rr * (1 - i / 24); px(E.x + Math.cos(g) * d, E.y + Math.sin(g) * d * 0.7, i < 4 ? LOBWORM.mint : LOBWORM.sand, L); } mends(r.from, a - 4, LOBWORM.mint); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Go Under: Spijire sinks, wet sand bursts up under the foe and holds it, and a little curl rises beside Spijire.
  lobworm_go: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, a = t - hitOf(r);
      inbound(r, (u, E) => { const y = E.y + 6 - 6 * u; px(E.x, y, LOBWORM.mint); px(E.x - 1, y + 1, LOBWORM.sand); px(E.x + 1, y + 1, LOBWORM.sand); });
      landed(r, (E, aa) => { const s = still(aa, 2); if (s < 12) for (let q = 0; q < 7; q++) px(E.x + (q - 3) * 0.5 * s, E.y + 4 - 1.4 * s + 0.12 * s * s, q % 2 ? LOBWORM.sand : '#a8d0e0', fade(s, 12)); arc(E.x, E.y + 4, 6, 2, LOBWORM.sand, fade(aa, r.end - hitOf(r), 6), 0, 0.5); });
      if (a >= 2) cast(r.from.x + toward(r) * 10, r.from.y + 5, Math.min(2, 1 + ((a - 2) >> 2)), t, fade(a - 2, r.end - hitOf(r) - 2, 6));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Collapse: Spijire stamps, three coils of sand close on the foe and fall in on it, and the ground sinks under it.
  lobworm_collapse: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a, i) => { if (i === 0) { const L = fade(a, r.end - hitOf(r), 6); oval(E.x, E.y + 5, 7, 2, LOBWORM.dark, L); arc(E.x, E.y + 5, 7, 2, LOBWORM.sand, L, 0.55, 0.95); } }); },
    front(r) {
      const t = r.t;
      inbound(r, (u, E, i) => { const g = i / 3 * Math.PI * 2 + 0.5, S = { x: E.x + Math.cos(g) * 15, y: E.y + Math.sin(g) * 9 }, p = lerp(S, E, ease(u)); sandCoil(p.x, p.y, 3, t); });
      landed(r, (E, a, i) => chunks(E.x, E.y + 2, still(a, i === 2 ? 3 : 0), 4, LOBWORM.sand, LOBWORM.light, r.seed + i, 12, 1.2, 1));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 3, 1) || shake(r.t - lastOf(r), 6, 2) }; },
  },

  // Great Curl: a great cast rises out of the sand beside Spijire loop by loop, and two little curls push up at its sides.
  lobworm_coil: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { wash(LOBWORM.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = r.from, dir = toward(r), P = { x: U.x + dir * 12, y: U.y + 5 }, n = r.hits.filter(h => t >= h.at).length, L = hold(t, hitOf(r), r.end, 6), last = lastOf(r);
      inbound(r, (u, _, i) => { const x = P.x - 3 + i * 2; px(x, P.y - 6 * u, LOBWORM.mint); px(x, P.y + 1 - 6 * u, LOBWORM.sand); });
      if (n) cast(P.x, P.y, Math.min(high(U) ? 3 : 5, n + 1), t, L);
      const a = t - last; if (a >= 0) { cast(P.x - 7, P.y + 1, 1, t, fade(a, r.end - last, 6)); cast(P.x + 7, P.y + 1, 1, t + 4, fade(a - 2, r.end - last, 6)); }
    },
  },
};

// ---------------------------------------------------------------- Veigai (razor): the long razor clam, digging and cutting in threes

const RAZOR = { steel: '#bdc5cd', green: '#21af43', dark: '#493f47', sand: '#c8b898', deep: '#101214' };
/** The razor clam `len` long at x, y along `ang`: a long steel blade with a green edge and a white point. */
function razorShell(x: number, y: number, ang: number, len: number, lv = 1): void {
  const c = Math.cos(ang), s = Math.sin(ang), h = len / 2;
  thick(x - c * h, y - s * h, x + c * h, y + s * h, RAZOR.steel, lv, RAZOR.dark); line(x - c * h - s, y - s * h + c, x + c * h - s, y + s * h + c, RAZOR.green, 0.75 * lv); px(x + c * h, y + s * h, W, lv);
}
/** Three cuts in a row on a whorl, a frames after the first: each a white line with a green edge, two frames apart. */
function threeCuts(E: Pt, a: number, size = 1): void { for (let q = 0; q < 3; q++) { const aa = a - q * 2; if (aa < 0 || aa >= 8) continue; const n = Math.min(1, (aa + 1) / 2), x0 = E.x - 5 * size + q * 4 * size, y0 = E.y - 6 * size; line(x0, y0, x0 + 3 * size * n, y0 + 11 * size * n, W, fade(aa, 8, 3)); line(x0 + 1, y0, x0 + 1 + 3 * size * n, y0 + 11 * size * n, RAZOR.green, fade(aa, 8, 3)); } }

const RAZOR_ART: Record<string, LegendArt> = {
  // Razor Cut: Veigai darts in blade first and leaves three quick cuts in a row.
  razor_cut: {
    tail: 8, noLandings: true,
    front(r) {
      const U = userAt(r), E = aim(r);
      if (r.t < hitOf(r) + 2) razorShell(U.x, U.y, Math.atan2(E.y - r.from.y, E.x - r.from.x), 9);
      smear(r, RAZOR.steel, RAZOR.green, 10);
      landed(r, (E2, a) => threeCuts(E2, still(a, 2)));
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Upright: razor shells stab up out of the sand under every foe one after another, and stand there.
  razor_upright: {
    noFlights: true, noLandings: true,
    front(r) {
      inbound(r, (u, E, i) => { const x = E.x - 5 + i * 5; razorShell(x, E.y + 6 - 6 * u, -Math.PI / 2, Math.round(10 * u)); });
      landed(r, (E, a, i) => { const x = E.x - 5 + i * 5, L = fade(a, r.end - r.hits[i].at, 6); razorShell(x, E.y, -Math.PI / 2, 10, L); if (a < 8) puff(x, E.y + 5, a, 8, RAZOR.sand, RAZOR.steel, 2, 0.1); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Dig In: Veigai digs straight down in a spray of sand until only its tip shows, and a ring of packed sand stands round it.
  razor_dig: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, hit = hitOf(r), a = t - hit;
      if (t < hit + 4) for (let q = 0; q < 2; q++) puff(U.x + (q ? 4 : -4), U.y + 4, (t + q * 4) % 10, 10, RAZOR.sand, RAZOR.steel, 2, 0.3);
      if (a >= 0) { const L = fade(a, r.end - hit, 6); razorShell(U.x, U.y + 3, -Math.PI / 2, 4, L); arc(U.x, U.y + 5, 7, 2, RAZOR.sand, L); arc(U.x, U.y + 4, 6, 6, RAZOR.steel, 0.5 * L, 0.5, 1); }
    },
  },

  // Wind Up: three razor shells circle Veigai faster and faster, and each one cuts the air round it in a flash of green.
  razor_wind: {
    lead: 6, noFlights: true, noLandings: true,
    back(r) { wash(RAZOR.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = userAt(r), dir = toward(r);
      for (const f of r.flights) { const a = t - f.t0; if (a < 0 || a >= f.dur) continue; const u = a / f.dur, g = u * u * Math.PI * 6 + f.i * 2.1, rr = 10 - 2 * u; razorShell(U.x + Math.cos(g) * rr, U.y + Math.sin(g) * rr * 0.55, g + Math.PI / 2, 7); }
      landed(r, (_, a, i) => { threeCuts({ x: U.x + dir * (8 + i * 2), y: U.y }, still(a, i === 2 ? 5 : 1), 0.7); });
    },
    scene(r) { return { jolt: shake(r.t - lastOf(r), 10, 2) || shake(r.t - hitOf(r), 3, 1) }; },
  },
};

// ---------------------------------------------------------------- Renbiwa (annulet): a ring of light on wet sand

const ANNULET = { cream: '#fcf5dd', gold: '#edbe24', blue: '#5271bc', deep: '#0e1428' };
/** A ring of light on the wet sand round x, foot, rx across: a gold ring with cream bands that run round it and a blue sheen of wet sand inside. */
function lightRing(x: number, foot: number, rx: number, t: number, lv = 1): void {
  const ry = Math.max(1, rx * 0.3), n = Math.max(12, Math.round(rx * 6));
  dither(x - rx + 1, foot, 2 * rx - 1, 1, ANNULET.blue, 0.5 * lv);
  for (let q = 0; q < n; q++) { const g = q / n * Math.PI * 2; px(x + Math.cos(g) * rx, foot + Math.sin(g) * ry, (q + (t >> 1)) % 4 === 0 ? ANNULET.cream : ANNULET.gold, lv); }
}
/** Light rising off a ring: short cream strokes standing up from it. */
function ringRays(x: number, foot: number, rx: number, t: number, lv = 1): void { for (let q = 0; q < 5; q++) { const g = q / 5 * Math.PI * 2 + t * 0.05, bx = x + Math.cos(g) * rx, by = foot + Math.sin(g) * rx * 0.3, h = 2 + ((t + q * 3) >> 2) % 3; line(bx, by - 1, bx, by - h, ANNULET.cream, lv); } }

const ANNULET_ART: Record<string, LegendArt> = {
  // Draw Light: a ring of light rolls across to the foe and lays itself down on the sand round its feet, lit.
  annulet_draw: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a) => { const L = fade(a, r.end - hitOf(r), 6); lightRing(E.x, E.y + 5, Math.min(9, 3 + a), r.t, L); ringRays(E.x, E.y + 5, Math.min(9, 3 + a), r.t, 0.75 * L); }); },
    front(r) { inbound(r, (u, E) => { const p = lerp(r.from, E, u); arc(p.x, p.y, 3 * Math.abs(Math.cos(r.t * 0.4)) + 1, 3, ANNULET.gold); px(p.x, p.y - 3, W); }); },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
    lights(r) { const a = r.t - hitOf(r), E = aim(r); return a >= 0 ? [{ x: Math.round(E.x), y: Math.round(E.y + 5), r: 10, lv: 1.2 * fade(a, r.end - hitOf(r), 6), tint: ANNULET.gold }] : []; },
  },

  // Glow: a ring of light rises from the sand round the ally and lifts up over it as a glowing band.
  annulet_glow: {
    noFlights: true, noLandings: true,
    back(r) { const A = r.to[0]; lightRing(A.x, A.y + 5, 8, r.t, hold(r.t, 2, r.end, 6)); },
    front(r) {
      const A = r.to[0];
      inbound(r, (u) => arc(A.x, A.y + 5 - 8 * u, 8, 2.5, ANNULET.cream, 1, 0, 0.5));
      landed(r, (_, a) => { const L = fade(a, r.end - hitOf(r), 6); arc(A.x, A.y + 1, 7, 6, ANNULET.gold, L); arc(A.x, A.y + 1, 8, 7, ANNULET.cream, 0.5 * L); });
    },
  },

  // Dither: four sparks of light skip across every foe one after another, and each leaves a small lit ring on the sand.
  annulet_dither: {
    noFlights: true, noLandings: true,
    back(r) { landed(r, (E, a, i) => lightRing(E.x - 6 + (i % 4) * 4, E.y + 5, 2, r.t, fade(a, r.end - r.hits[i].at, 6))); },
    front(r) {
      for (const f of r.flights) { const a = r.t - f.t0; if (a < 0 || a >= f.dur) continue; const E = r.to[f.to] || r.to[0], dir = E.x >= r.from.x ? 1 : -1, u = a / f.dur, x = E.x + dir * (44 * u - 20), y = E.y + 2 - Math.abs(Math.sin(u * Math.PI * 3)) * 4; glint(x, y, ANNULET.gold); }
      landed(r, (E, a, i) => { if (a < 4) px(E.x - 6 + (i % 4) * 4, E.y + 3, W); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Long Spark: a ring of light gathers round Renbiwa, and a long spark leaps from it to the foe and bursts there in a great lit ring and a white flash.
  annulet_landing: {
    lead: 10, noFlights: true, noLandings: true,
    back(r) {
      const t = r.t, U = r.from, L = hold(t, 0, r.end, 6), hit = hitOf(r), a = t - hit;
      wash(ANNULET.deep, 0.375 * L);
      if (t < hit + 2) lightRing(U.x, U.y + 5, Math.round(4 + 6 * ease(prog(t, 0, leaveOf(r)))), t, L);
      if (a >= 0) { const E = aim(r), Lb = fade(a, r.end - hit, 6); lightRing(E.x, E.y + 5, Math.min(12, 4 + a), t, Lb); ringRays(E.x, E.y + 5, Math.min(12, 4 + a), t, Lb); }
    },
    front(r) {
      const t = r.t;
      inbound(r, (u, E) => { let lx = r.from.x, ly = r.from.y; const n = Math.max(2, Math.round(9 * u)), dx = E.x - r.from.x, dy = E.y - r.from.y; for (let i = 1; i <= n; i++) { const v = u * i / n, j = i < n ? (hash(r.seed + i + (t >> 1) * 5) - 0.5) * 7 : 0, x = r.from.x + dx * v - dy / 60 * j, y = r.from.y + dy * v + dx / 60 * j; line(lx, ly, x, y, i === n ? W : ANNULET.gold); lx = x; ly = y; } });
      landed(r, (E, a) => { if (a < 2) oval(E.x, E.y, 3 - a, 2 - a, W, 1); sparks(E.x, E.y, still(a, 6), 10, ANNULET.cream, ANNULET.gold, r.seed, 13, 12); });
    },
    scene(r) { const a = r.t - hitOf(r); return { jolt: shake(a, 12, 3), glare: a >= 0 && a < 2 ? 0.375 : 0 }; },
    lights(r) { const a = r.t - hitOf(r), E = aim(r); return a >= 0 ? [{ x: Math.round(E.x), y: Math.round(E.y + 4), r: 14, lv: 1.6 * fade(a, r.end - hitOf(r), 6), tint: ANNULET.gold }] : []; },
  },
};

// ---------------------------------------------------------------- Madaku (macula): dark spots on a cream dome that move when nobody looks

const MACULA = { dark: '#423850', cream: '#f2eae2', red: '#b32037', deep: '#100c14' };
/** A dark spot rr across: a dark oval with a red rim. */
function darkSpot(x: number, y: number, rr: number, lv = 1): void { oval(x, y, rr, rr * 0.75, MACULA.dark, lv); arc(x, y, rr, rr * 0.75, MACULA.red, lv); }
/** A box of dark: a square outline in red with dark dithered inside, `s` across. */
function spotBox(x: number, y: number, s: number, lv = 1): void { x = Math.round(x - s / 2); y = Math.round(y - s / 2); dither(x + 1, y + 1, s - 2, s - 2, MACULA.dark, 0.75 * lv); line(x, y, x + s - 1, y, MACULA.red, lv); line(x, y + s - 1, x + s - 1, y + s - 1, MACULA.red, lv); line(x, y, x, y + s - 1, MACULA.red, lv); line(x + s - 1, y, x + s - 1, y + s - 1, MACULA.red, lv); px(x + 1, y + 1, MACULA.cream, lv); }

const MACULA_ART: Record<string, LegendArt> = {
  // Dark Spot: Madaku blinks out, a dark spot slides across to the foe and settles on it, and the foe reels.
  macula_dark: {
    noFlights: true, noLandings: true,
    back(r) { wash(MACULA.deep, 0.25 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      inbound(r, (u, E) => { const p = lerp(r.from, E, ease(u)); darkSpot(p.x, p.y, 2.5); });
      landed(r, (E, a) => { darkSpot(E.x + 1, E.y - 1, 3 - Math.min(1, a / 8), fade(a, r.end - hitOf(r), 6)); if (a >= 4) circling(E, a, 3, (x, y) => px(x, y, MACULA.red, fade(a, r.end - hitOf(r), 5))); });
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Move Off: a box of dark flips over to stand on Madaku's side, and the dark settles round it.
  macula_moveoff: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, P = { x: r.from.x + toward(r) * 10, y: r.from.y + 1 };
      inbound(r, (u) => { const p = sagAt(r.from, P, u, -10); spotBox(p.x, p.y, Math.max(2, Math.round(5 * Math.abs(Math.cos(t * 0.5))))); });
      landed(r, (_, a) => { const L = fade(a, r.end - hitOf(r), 6); spotBox(P.x, P.y, 6, L); puff(P.x, P.y + 3, a, 12, MACULA.dark, MACULA.red, 3, 0.15); });
    },
  },

  // Look Away: a dark drop flies at the foe and splashes it, and while nobody looks Madaku's spot slides off somewhere else.
  macula_lookup: {
    noFlights: true, noLandings: true,
    front(r) {
      const t = r.t, U = r.from, a = t - hitOf(r);
      inbound(r, (u, E) => { const p = lerp(r.from, E, u); blit(['.d.', 'ddd', '.r.'], p.x, p.y, { d: MACULA.dark, r: MACULA.red }); });
      landed(r, (E, aa) => { const s = still(aa, 2); if (s < 12) for (let q = 0; q < 6; q++) px(E.x + (q - 2.5) * 0.6 * s, E.y + 2 - 1.3 * s + 0.12 * s * s, q % 2 ? MACULA.dark : MACULA.red, fade(s, 12)); });
      if (a >= 2) { const u = ease(prog(a, 2, 12)); darkSpot(U.x + toward(r) * (-2 - 10 * u), U.y + 4 - 3 * u, 2, fade(a - 2, r.end - hitOf(r) - 2, 6)); }
    },
    scene(r) { return { jolt: shake(r.t - hitOf(r), 4, 1) }; },
  },

  // Many Spots: Madaku blinks out, four dark spots circle where it was, and a copy of it made of spots stands up in a box of dark.
  macula_spots: {
    lead: 4, noFlights: true, noLandings: true,
    back(r) { wash(MACULA.deep, 0.5 * hold(r.t, 0, r.end, 6)); },
    front(r) {
      const t = r.t, U = r.from, P = { x: U.x + toward(r) * 11, y: U.y }, last = lastOf(r), a = t - last;
      for (const f of r.flights) { const aa = t - f.t0; if (aa < 0 || aa >= f.dur) continue; const u = aa / f.dur, g = u * Math.PI * 4 + f.i * Math.PI / 2, c = lerp(U, P, Math.max(0, (u - 0.6) / 0.4)), rr = 9 * (1 - u * 0.5); darkSpot(c.x + Math.cos(g) * rr, c.y + Math.sin(g) * rr * 0.55, 2); }
      landed(r, (_, aa, i) => { const g = i * Math.PI / 2 + 0.78; darkSpot(P.x + Math.cos(g) * 3, P.y + Math.sin(g) * 3, 1.5, fade(aa, r.end - r.hits[i].at, 6)); });
      if (a >= 0) spotBox(P.x, P.y, 11, fade(a, r.end - last, 6));
    },
  },
};

export const ART_B: Record<string, LegendArt> = {
  ...PEAT_ART, ...TENOR_ART, ...GLAZE_ART, ...PIPE_ART, ...PEW_ART, ...RELIC_ART, ...CENSER_ART, ...STRIX_ART,
  ...HART_ART, ...SKEP_ART, ...TAPROOT_ART, ...BORER_ART, ...CLOD_ART, ...WHIP_ART, ...GNARL_ART, ...UPFALL_ART,
  ...KILN_ART, ...BELT_ART, ...AERIAL_ART, ...VANE_ART, ...CAPSULE_ART, ...BOOSTER_ART, ...DISH_ART, ...DEBRIS_ART,
  ...MUSK_ART, ...SERAC_ART, ...SELKIE_ART, ...WALRUS_ART, ...BERG_ART, ...NARWHAL_ART, ...RIME_ART, ...AUK_ART,
  ...CUIRASS_ART, ...PENNON_ART, ...TANG_ART, ...BUCKLER_ART, ...DESTRIER_ART, ...MANGONEL_ART, ...SALLET_ART, ...FLETCH_ART,
  ...IMAGE_ART, ...SKIPPER_ART, ...SILT_ART, ...SPAWN_ART, ...LUNE_ART, ...SIDERITE_ART, ...SLAG_ART, ...CULLET_ART,
  ...TELSON_ART, ...CHOLLA_ART, ...ERG_ART, ...HAZE_ART, ...BONEDRY_ART, ...SHEARS_ART, ...GLOVE_ART, ...SCION_ART,
  ...ESPALIER_ART, ...RUNG_ART, ...NOUGHT_ART, ...TERMINUS_ART, ...HORIZON_ART, ...MURK_ART, ...UNDINE_ART, ...LIP_ART,
  ...RUMPLE_ART, ...SAG_ART, ...FURROW_ART, ...ACORN_ART, ...VARIX_ART, ...MEW_ART, ...HALITE_ART, ...SKITTER_ART,
  ...FUCUS_ART, ...FLOTSAM_ART, ...MOTE_ART, ...SEAGLASS_ART, ...KIPPER_ART, ...ACTINIA_ART, ...LACUNA_ART, ...COLUMBA_ART,
  ...LOBWORM_ART, ...RAZOR_ART, ...ANNULET_ART, ...MACULA_ART,
};
