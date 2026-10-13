// The Brass Dreamscape: title, plaza, tower, library, gardens. The Unraveling's gears grow here.
import { B, KEEP, MEL, MODE, colorTones, fold, floatProg, inv, key, prog, shift, silence } from './lib';
import type { Ctx, Section, TrackDef } from './lib';
import { PILGRIM_HEAD, PILGRIM_TAIL, UNRAVEL, pilgrim } from './motifs';
import { arp, gears, toPitch, walkBars } from './kit';

// ---------------------------------------------------------------- title

const K_TITLE = key(57, MODE.aeo);

function titleSec(c: Ctx, kind: 'a' | 'b' | 'q'): Section {
  const r = c.r, K = K_TITLE, b = new B(16, 4, c.bpm);
  b.mot('pilgrim');
  const roots = floatProg(r, 4, kind === 'b' ? 5 : 0);
  const fig = pilgrim(c.prog, r);
  const len = fig.reduce((s, x) => s + x[1], 0);
  const gaps: Array<[number, number]> = [];
  if (kind === 'q') {
    b.n('tri', 0, 33, 16, 0.4, { a: 2 });
    b.n('x', 0, K(4), 12, 0.12, { sus: 1, a: 2.5 });
    const n = 1 + r.int(3);
    for (let i = 0; i < n; i++) b.n('x', 2 + r.int(12), K(r.pick([2, 4, 6, 9])) + 12, 2.5, 0.12);
    b.fig('p1', 6 + r.int(4), PILGRIM_HEAD, K, 1, 0.12, { duty: 3, a: 0.1, ...KEEP }, 0.96);
    return b.out();
  }
  for (const start of len <= 8.01 ? [0, 8] : [0]) {
    const f = kind === 'b' ? inv(fig, 4) : start === 8 && r.chance(0.5) ? shift(fig, r.pick([-1, 1])) : fig;
    if (kind === 'b') b.fig('p1', start, f, K, 0, 0.36, { duty: 2, a: 0.07, ...KEEP }, 0.96);
    else b.fig('p1', start, f, K, 1, 0.42, { duty: 3, a: 0.07, ...KEEP }, 0.96);
    // The rest after the last note is the point of the figure: nothing else plays across it.
    let s = start, last = start;
    for (const [d, l] of f) { s += l; if (d !== null) last = s; }
    gaps.push([last, Math.min(16, last + 1.5)]);
  }
  const inGap = (t: number) => gaps.some(([a, z]) => t >= a && t < z);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, ch = colorTones(K, roots[i], r.pick(['sus2', 'sus4', 'add9', 'tri']), 57);
    b.n('tri', t0, fold(K(roots[i]), 33), 3.8, 0.5, { a: 0.3 });
    const pat = r.pick([[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1]]);
    pat.forEach((k, j) => {
      const t = t0 + j;
      if (!inGap(t) && !r.chance(0.15)) b.n('p2', t, ch[k % ch.length] + (j === 3 && r.chance(0.3) ? 12 : 0), 0.9, 0.15, { duty: 1, a: 0.04 });
    });
    if (kind === 'b' && i % 2 === 1) b.n('x', t0 + 1, K(roots[i] + 4) + 12 + 0.5, 3, 0.1, { sus: 1, a: 0.6 });
  }
  if (r.chance(0.6)) b.n('x', 4 + r.int(3), K(7 + r.int(3)) + 12, 2, 0.12);
  return b.out();
}

export const title: TrackDef = {
  slip: 0.08, bendy: 0.12, bpm: 56, start: 'a', vary: 0.6, wrong: 0.05, echo: 0.45, wobble: 7, tint: 'brass', key: K_TITLE, motifs: ['pilgrim'],
  graph: { a: [['a', 1], ['b', 3], ['q', 1]], b: [['a', 3], ['q', 2]], q: [['a', 3], ['b', 1]] },
  secs: { a: (c) => titleSec(c, 'a'), b: (c) => titleSec(c, 'b'), q: (c) => titleSec(c, 'q') },
};

// ---------------------------------------------------------------- plaza

const K_PLAZA = key(55, MODE.mix);

function chirps(b: B, c: Ctx, K: typeof K_PLAZA, t: number, g: number) {
  const r = c.r, n = 3 + r.int(4);
  let p = K(r.pick([7, 8, 9, 11])) + 12;
  for (let i = 0; i < n; i++) {
    p += r.pick([-3, -2, 0, 2, 3, 5]);
    p = Math.max(84, Math.min(100, p));
    b.n('x', t + i * 0.2, p + (r.chance(0.3) ? 0.5 : 0), 0.16, g, { ratio: 1.5, bend: r.pick([-1, 1, 2, -2]) });
    if (i % 2 === 0) b.hit(t + i * 0.2, 'drip', 0.08, 0.06);
  }
}

function plazaSec(c: Ctx, kind: 'a' | 'b' | 'birds'): Section {
  const r = c.r, K = K_PLAZA, b = new B(16, 4, c.bpm);
  b.mot('unravel');
  const roots = kind === 'b' ? floatProg(r, 4, 3, 0.2) : prog(r, [0, 3, 5, 4], { 3: [3, 1], 5: [5, 2], 4: [4, 6] }, 0.3);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i];
    b.fig('p2', t0, shift(UNRAVEL, R), K, 0, kind === 'birds' ? 0.12 : 0.19, { duty: 0 }, 0.6);
    const low = fold(K(R), 36);
    b.n('tri', t0, low, 0.9, 0.55).n('tri', t0 + 1, low + 7, 0.9, 0.48).n('tri', t0 + 2, low + 12, 0.45, 0.48).n('tri', t0 + 2.5, low + 7, 0.9, 0.44);
    gears(b, t0, 4, 0.5, kind === 'birds' ? 0.1 : 0.17, [0, 3, 6], 8);
    if (kind === 'b') b.hit(t0 + 0.5, 'steam', 0.1, 3.4, { a: 1.4 });
  }
  if (kind !== 'birds') {
    const line = walkBars(r, 4, roots, r.pick([2, 4, 5]), { lo: 1, hi: 9, rest: 0.1 });
    b.line('p1', 0, toPitch(line, K, 1), 0.38, { ...MEL, duty: 1 }, 0.85);
  }
  const flights = kind === 'birds' ? 4 : r.chance(0.65) ? 1 + r.int(2) : 0;
  for (let i = 0; i < flights; i++) chirps(b, c, K, 1 + r.int(14), kind === 'birds' ? 0.2 : 0.14);
  return b.out();
}

export const plaza: TrackDef = {
  swing: 0.06, stumble: 0.04, slip: 0.05, bendy: 0.08, bpm: 108, start: 'a', vary: 0.7, wrong: 0.05, echo: 0.2, wobble: 5, tint: 'brass', key: K_PLAZA, motifs: ['unravel'],
  graph: { a: [['a', 1], ['b', 3], ['birds', 1]], b: [['a', 3], ['birds', 2]], birds: [['a', 3], ['b', 1]] },
  secs: { a: (c) => plazaSec(c, 'a'), b: (c) => plazaSec(c, 'b'), birds: (c) => plazaSec(c, 'birds') },
};

// ---------------------------------------------------------------- tower

const K_TOWER = key(40, MODE.phr);

function towerSec(c: Ctx, kind: 'grind' | 'consume'): Section {
  const r = c.r, K = K_TOWER;
  if (kind === 'consume') {
    c.st.grow = 0;
    const b = new B(12, 4, c.bpm);
    b.mot('unravel');
    b.n('tri', 0, 40, 6, 0.55, { bend: -12 });
    b.hit(0, 'rumble', 0.4, 8, { a: 3 });
    for (let i = 0; i < 6; i++) b.hit(i * 1.5, 'gear', 0.16 - i * 0.02, 0.1, { n: 60 + i });
    b.hit(8, 'crack', 0.5, 0.05);
    b.fig('tri', 9, UNRAVEL.slice(0, 4), K, -1, 0.5);
    return b.out({ tempo: [[0, c.bpm], [8, 36], [8.01, c.bpm]] });
  }
  const g = (c.st.grow ?? 0) + 1;
  c.st.grow = g;
  const b = new B(16, 4, c.bpm);
  b.mot('unravel');
  const roots = floatProg(r, 4, 0, 0.3);
  gears(b, 0, 16, 0.5, 0.2, [0, 3, 6], 8);
  if (g >= 2) for (let i = 0; i < 4; i++) b.fig('tri', i * 4, shift(UNRAVEL, roots[i] % 3), K, 0, 0.5, {}, 0.7);
  if (g >= 3) for (let i = 0; i < 4; i++) b.fig('p2', i * 4, shift(UNRAVEL, roots[i] % 3 + 1), K, 1, 0.17, { duty: 0 }, 0.5);
  if (g >= 4) for (let i = 0; i < 4; i += 2) {
    b.n('x', i * 4, K(roots[i]) + 12, 7.5, 0.13, { sus: 1, a: 1.2 });
    b.n('x', i * 4, K(roots[i] + 1) + 12, 7.5, 0.1, { sus: 1, a: 1.6 });
  }
  if (g >= 5) {
    const line = walkBars(r, 4, roots, 4, { lo: 2, hi: 8, rest: 0.15 });
    b.line('p1', 0, toPitch(line, K, 1), 0.3, { ...MEL, duty: 0 }, 0.8);
  }
  if (g >= 6) for (let t = 0; t < 16; t++) b.hit(t, t % 2 ? 'stamp' : 'kick', 0.4, 0.2);
  if (g >= 7) {
    for (let t = 0; t < 16; t += 0.25) if (t % 0.5) b.hit(t, 'tick', 0.1, 0.04);
    b.hit(0, 'rumble', 0.3, 16, { a: 6 });
  }
  let sec = b.out();
  // The gears sometimes stop: one beat of nothing, a crack before it, and a ratchet after.
  if (g >= 2 && r.chance(0.45)) {
    const at = 4 * (1 + r.int(3)) + 3;
    sec = silence(sec, at, 1);
    sec.ev.push({ t: at - 0.25, d: 0.05, v: 'nz', n: 60, g: 0.5, nz: 'crack' });
    for (let i = 0; i < 4; i++) sec.ev.push({ t: at + 1 + i * 0.125, d: 0.05, v: 'nz', n: 66 + i, g: 0.2, nz: 'gear' });
    sec.tempo = [[0, c.bpm], [at - 1, c.bpm], [at, c.bpm * 0.55], [at + 1, c.bpm]];
    sec.tag = 'stop';
  }
  return sec;
}

export const tower: TrackDef = {
  slip: 0.06, level: 1.2, bpm: 124, start: 'grind', vary: 0.5, wrong: 0.03, echo: 0.15, wobble: 4, tint: 'brass', key: K_TOWER, motifs: ['unravel'],
  next: (cur, c) => (cur === 'consume' ? 'grind' : (c.st.grow ?? 0) >= 8 ? 'consume' : 'grind'),
  secs: { grind: (c) => towerSec(c, 'grind'), consume: (c) => towerSec(c, 'consume') },
};

// ---------------------------------------------------------------- library

const K_LIB = key(52, MODE.dor);

function libSec(c: Ctx, kind: 'whisper' | 'pages' | 'fragment'): Section {
  const r = c.r, K = K_LIB, b = new B(12, 3, c.bpm);
  b.mot('pilgrim');
  b.n('tri', 0, 40, 12, 0.35, { a: 1.5 });
  const hushes = kind === 'whisper' ? 4 + r.int(4) : 1 + r.int(2);
  for (let i = 0; i < hushes; i++) b.hit(r.int(20) * 0.5, 'hush', r.range(0.1, 0.2), r.range(0.8, 2), { a: 0.4 });
  if (kind === 'whisper') {
    for (const k of [0, 6]) if (r.chance(0.7)) {
      const root = r.pick([0, 2, 4, 5]);
      b.n('x', k, K(root) + 12, 5, 0.09, { sus: 1, a: 1.5 });
      b.n('p2', k, K(root + 1) + 12 + 0.5, 5, 0.07, { duty: 3, a: 2 });
    }
  }
  if (kind === 'pages') {
    const t0 = r.int(4);
    arp(b, 'p2', t0, 5, 0.25, [K(0) + 24, K(2) + 24, K(4) + 24, K(6) + 24], r.pick([[0, 1, 2, 3, 2, 1], [3, 2, 1, 0], [0, 2, 1, 3]]), 0.08, { duty: 0 }, 1);
  }
  if (kind === 'fragment' || r.chance(0.5)) {
    const frag = r.pick([PILGRIM_HEAD, PILGRIM_TAIL, PILGRIM_HEAD, shift(PILGRIM_HEAD, 1)]);
    b.fig(r.chance(0.5) ? 'x' : 'p1', 1 + r.int(5), frag, K, 1, 0.17, { duty: 3, a: 0.12, ratio: 2, ...KEEP }, 0.96);
    if (c.prog > 0.5 && r.chance(0.5)) b.fig('x', 7 + r.int(3), frag.slice(0, 1), K, 2, 0.1, { ...KEEP }, 0.9);
  }
  return b.out();
}

export const library: TrackDef = {
  slip: 0.05, bendy: 0.15, level: 1.3, bpm: 54, start: 'whisper', vary: 0.5, wrong: 0.05, echo: 0.55, wobble: 8, tint: 'brass', key: K_LIB, motifs: ['pilgrim'],
  graph: {
    whisper: [['pages', 2], ['fragment', 3], ['whisper', 1]],
    pages: [['whisper', 3], ['fragment', 2]],
    fragment: [['whisper', 3], ['pages', 2], ['fragment', 1]],
  },
  secs: { whisper: (c) => libSec(c, 'whisper'), pages: (c) => libSec(c, 'pages'), fragment: (c) => libSec(c, 'fragment') },
};

// ---------------------------------------------------------------- gardens

const K_GARD = key(53, MODE.lyd);

function bloom(b: B, c: Ctx, K: typeof K_GARD, t: number, g: number) {
  const r = c.r, n = 3 + r.int(4);
  const steps = [0, 1, 2, 4, 5, 7];
  const base = r.int(3);
  for (let i = 0; i < n; i++) {
    const d = base + steps[i % steps.length];
    b.n('x', t + i * 0.125, K(d) + 12, i === n - 1 ? 1.4 : 0.12, g * (1 - i * 0.07), { ratio: 3.5, a: 0.003 });
  }
}

function gardenSec(c: Ctx, kind: 'a' | 'b'): Section {
  const r = c.r, K = K_GARD, b = new B(12, 3, c.bpm);
  b.mot('unravel');
  const roots = floatProg(r, 4, kind === 'b' ? 3 : 0, 0.2);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 3, R = roots[i];
    const low = fold(K(R), 38);
    b.n('tri', t0, low, 1.3, 0.5).n('tri', t0 + 1.5, low + 7, 1.3, 0.42);
    const ch = colorTones(K, R, r.pick(['tri', 'add9', 'sus2']), 62);
    b.n('p2', t0 + 1, ch[1 % ch.length], 0.4, 0.14, { duty: 1 }).n('p2', t0 + 2.5, ch[2 % ch.length], 0.4, 0.12, { duty: 1 });
    // Steam warbles on a long held note that bends one way and then the other.
    if (i % 2 === 0) b.n('x', t0, K(R + 4) + 12, 5.5, 0.1, { sus: 1, a: 0.9, bend: i % 4 === 0 ? -0.4 : 0.4 });
    if (r.chance(0.5)) b.hit(t0 + 0.5, 'steam', 0.09, 2.2, { a: 0.9 });
  }
  const line = walkBars(r, 3, roots, 4, { lo: 2, hi: 10, rest: 0.12 });
  b.line('p1', 0, toPitch(line, K, 1), 0.34, { ...MEL, duty: 2 }, 0.85);
  const blooms = kind === 'a' ? 1 + r.int(3) : 2 + r.int(3);
  for (let i = 0; i < blooms; i++) bloom(b, c, K, r.int(20) * 0.5, 0.11);
  gears(b, 0, 12, 1.5, 0.07, [0], 2);
  return b.out();
}

export const gardens: TrackDef = {
  swing: 0.05, stumble: 0.04, slip: 0.06, bendy: 0.15, bpm: 100, start: 'a', vary: 0.7, wrong: 0.05, echo: 0.4, wobble: 9, tint: 'brass', key: K_GARD, motifs: ['unravel'],
  graph: { a: [['a', 1], ['b', 3]], b: [['a', 3], ['b', 1]] },
  secs: { a: (c) => gardenSec(c, 'a'), b: (c) => gardenSec(c, 'b') },
};
