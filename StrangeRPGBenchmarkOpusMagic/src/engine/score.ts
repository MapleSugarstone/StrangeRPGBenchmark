// The score of Rote: leitmotifs as scale-degree figures, and every track as a small seeded generator.
// Pitches are MIDI numbers (57 is A3, 220 Hz). Times and lengths are in quarter-note beats.
import type { StingerId, TrackId } from './music';

export type Voice = 'p1' | 'p2' | 'tri' | 'nz' | 'bell' | 'air';
export type Nz = 'hat' | 'snare' | 'kick' | 'tick' | 'tock' | 'sweep' | 'rush' | 'stamp';

export interface Ev {
  t: number;
  d: number;
  v: Voice;
  n: number;
  g: number;
  /** Pulse duty: 0 is 12.5%, 1 is 25%, 2 is 50%, 3 is 37.5%. */
  duty?: number;
  /** Glide in semitones across the second half of the note. */
  bend?: number;
  /** Detune in cents. */
  det?: number;
  /** Attack in seconds. */
  a?: number;
  /** Plays only when intensity is at least this. */
  lay?: number;
  /** Plays only when intensity is below this. */
  top?: number;
  nz?: Nz;
  /** FM ratio for the bell. */
  ratio?: number;
  /** Melodic: open to automatic ornaments and displacement. */
  m?: 1;
}

export interface Section {
  beats: number;
  bar: number;
  bpm: number;
  ev: Ev[];
  /** Skip automatic variation and wrong events. */
  still?: boolean;
  tag?: string;
}

export interface Ctx {
  r: Rng;
  /** Sections generated so far on this track. */
  pass: number;
  /** Times this section has been generated before. */
  visit: number;
  int: number;
  spells: number[][];
  bpm: number;
  st: Record<string, number>;
  mem: Record<string, number[]>;
}

export type Gen = (c: Ctx) => Section;

export interface TrackDef {
  bpm: number;
  start: string;
  secs: Record<string, Gen>;
  /** Weighted next sections. A section with no entry ends the track. */
  graph?: Record<string, ReadonlyArray<readonly [string, number]>>;
  next?: (cur: string, c: Ctx) => string | null;
  vary?: number;
  wrong?: number;
  /** Level per voice, multiplied into the engine's base level. */
  mix?: Partial<Record<Voice, number>>;
  echo?: number;
  wobble?: number;
  /** Detune of p2 against p1 in cents. */
  spread?: number;
}

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number { return Math.floor(this.next() * n); }
  pick<T>(a: readonly T[]): T { return a[this.int(a.length)]; }
  chance(p: number): boolean { return this.next() < p; }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  weighted<T>(opts: ReadonlyArray<readonly [T, number]>): T {
    let sum = 0;
    for (const o of opts) sum += Math.max(0, o[1]);
    let x = this.next() * sum;
    for (const o of opts) { x -= Math.max(0, o[1]); if (x < 0) return o[0]; }
    return opts[opts.length - 1][0];
  }
}

export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Modes as semitone steps from the root.
export const MODE = {
  ion: [0, 2, 4, 5, 7, 9, 11],
  dor: [0, 2, 3, 5, 7, 9, 10],
  phr: [0, 1, 3, 5, 7, 8, 10],
  lyd: [0, 2, 4, 6, 7, 9, 11],
  mix: [0, 2, 4, 5, 7, 9, 10],
  aeo: [0, 2, 3, 5, 7, 8, 10],
  loc: [0, 1, 3, 5, 6, 8, 10],
  hmin: [0, 2, 3, 5, 7, 8, 11],
  pdom: [0, 1, 4, 5, 7, 8, 10],
  whole: [0, 2, 4, 6, 8, 10],
} as const;

export interface Key {
  (d: number): number;
  root: number;
  mode: readonly number[];
}

export function key(root: number, mode: readonly number[]): Key {
  const L = mode.length;
  const f = ((d: number) => {
    const i = Math.round(d);
    const o = Math.floor(i / L);
    return root + mode[i - o * L] + 12 * o;
  }) as Key;
  f.root = root;
  f.mode = mode;
  return f;
}

/** A figure: [scale degree or null for a rest, length in beats, optional semitone alteration]. */
export type Fig = ReadonlyArray<readonly [number | null, number, number?]>;
export type Line = Array<[number | null, number]>;

export function realize(fig: Fig, K: Key, oct = 0): Line {
  return fig.map(([d, len, acc]) => [d === null ? null : K(d) + 12 * oct + (acc ?? 0), len]);
}
export const inv = (f: Fig, axis = 0): Fig => f.map(([d, l, a]) => [d === null ? null : 2 * axis - d, l, a === undefined ? undefined : -a]);
export const retro = (f: Fig): Fig => [...f].reverse();
export const aug = (f: Fig, k: number): Fig => f.map(([d, l, a]) => [d, l * k, a]);
export const shift = (f: Fig, k: number): Fig => f.map(([d, l, a]) => [d === null ? null : d + k, l, a]);
export const figLen = (f: Fig): number => f.reduce((s, x) => s + x[1], 0);
export const notesOf = (f: Fig): Fig => f.filter((x) => x[0] !== null);

export const MEL = { m: 1 } as const;

export class B {
  ev: Ev[] = [];
  constructor(public beats: number, public bar = 4, public bpm = 90) {}
  n(v: Voice, t: number, n: number, d: number, g = 0.7, x?: Partial<Ev>): this {
    if (t >= -1e-6 && t < this.beats - 1e-6 && d > 0 && g > 0) this.ev.push({ t, d, v, n, g, ...x });
    return this;
  }
  /** Plays [pitch or null, beats] pairs from t and returns the end time. */
  line(v: Voice, t: number, notes: ReadonlyArray<readonly [number | null, number]>, g = 0.7, x?: Partial<Ev>, leg = 0.92): number {
    for (const [p, len] of notes) { if (p !== null) this.n(v, t, p, len * leg, g, x); t += len; }
    return t;
  }
  fig(v: Voice, t: number, f: Fig, K: Key, oct = 0, g = 0.7, x?: Partial<Ev>, leg = 0.92): number {
    return this.line(v, t, realize(f, K, oct), g, x, leg);
  }
  hit(t: number, kind: Nz, g = 0.5, d = 0.25, x?: Partial<Ev>): this {
    return this.n('nz', t, 60, d, g, { nz: kind, ...x });
  }
  out(extra?: Partial<Section>): Section {
    return { beats: this.beats, bar: this.bar, bpm: this.bpm, ev: this.ev, ...extra };
  }
}

// Automatic variation: ornaments, octave displacement, dropped notes, rhythmic displacement.
export function vary(sec: Section, r: Rng, amt: number): Section {
  if (amt <= 0 || sec.still) return sec;
  const out: Ev[] = [];
  let first = true;
  for (const e of sec.ev) {
    if (!e.m) {
      // Accompaniment varies too, in ways that cannot break the harmony: a dropped note, an octave, a missing hat.
      if (e.v === 'nz') { if ((e.nz === 'hat' || e.nz === 'tick') && r.chance(0.07 * amt)) continue; out.push(e); continue; }
      if (e.d < 1.5 && e.v !== 'tri' && r.chance(0.05 * amt)) continue;
      const x: Ev = { ...e };
      if (e.d < 1.5 && r.chance(0.05 * amt)) x.n += e.v === 'tri' ? (x.n < 40 ? 12 : -12) : x.n < 70 ? 12 : -12;
      out.push(x);
      continue;
    }
    const x: Ev = { ...e, g: e.g * r.range(0.86, 1.05) };
    if (!first && r.chance(0.06 * amt)) continue;
    first = false;
    if (r.chance(0.05 * amt)) x.n += x.n > 74 ? -12 : 12;
    if (r.chance(0.05 * amt) && x.t >= 0.25) x.t -= 0.25;
    else if (r.chance(0.04 * amt) && x.d >= 0.75) { x.t += 0.25; x.d -= 0.25; }
    if (r.chance(0.07 * amt) && x.t >= 0.125 && x.d >= 0.5) {
      out.push({ ...x, t: x.t - 0.125, d: 0.12, g: x.g * 0.7, n: x.n + r.pick([1, 2, 2, -1]) });
    } else if (r.chance(0.04 * amt) && x.d >= 1) {
      const up = r.pick([1, 2]);
      out.push({ ...x, d: 0.12 }, { ...x, t: x.t + 0.125, d: 0.12, n: x.n + up });
      x.t += 0.25; x.d -= 0.25;
    }
    out.push(x);
  }
  return { ...sec, ev: out };
}

// Rare wrong events: a bar in another meter, a sudden tritone, a held bent note, a hole.
export function wrong(sec: Section, r: Rng): Section {
  if (sec.still || !sec.ev.length) return sec;
  const bars = Math.max(1, Math.floor(sec.beats / sec.bar + 1e-6));
  const kind = r.pick(bars > 1 ? ['meter', 'tritone', 'bend', 'hole'] as const : ['tritone', 'bend', 'hole'] as const);
  const k = kind === 'meter' ? 1 + r.int(bars - 1) : r.int(bars);
  const lo = k * sec.bar, hi = lo + sec.bar;
  let ev = sec.ev.map((e) => ({ ...e }));
  let beats = sec.beats;
  if (kind === 'meter') {
    const gap = r.pick([0.5, 1, -0.5]);
    if (gap > 0) {
      for (const e of ev) {
        if (e.t >= lo - 1e-6) e.t += gap;
        else if (e.t + e.d > lo && e.v !== 'nz') e.d += gap;
      }
    } else {
      ev = ev.filter((e) => !(e.t >= lo - 0.5 - 1e-6 && e.t < lo - 1e-6));
      for (const e of ev) if (e.t >= lo - 1e-6) e.t += gap;
    }
    beats += gap;
  } else if (kind === 'tritone') {
    for (const e of ev) if (e.v !== 'nz' && e.t >= lo && e.t < hi) e.n += 6;
  } else if (kind === 'bend') {
    let best: Ev | null = null;
    for (const e of ev) if (e.m && (!best || e.d > best.d)) best = e;
    if (best) { best.bend = r.pick([-1, 1, -2, -0.5]); best.d = Math.max(best.d, 1.5); }
  } else {
    ev = ev.filter((e) => !(e.m && e.t >= lo && e.t < hi));
  }
  return { ...sec, ev, beats, tag: kind };
}

/** Chord roots with seeded substitutions: subs maps a degree to the degrees that may replace it. */
export function prog(r: Rng, base: readonly number[], subs: Record<number, readonly number[]>, p: number): number[] {
  return base.map((d) => (subs[d] && r.chance(p) ? r.pick(subs[d]) : d));
}

/** Tones of the chord on degree d: root, third, fifth, seventh, ninth. */
export function chord(K: Key, d: number, size = 3): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) out.push(K(d + 2 * i));
  return out;
}

/** Folds a pitch into [lo, lo + 12). */
export function fold(n: number, lo: number): number {
  let x = n;
  while (x < lo) x += 12;
  while (x >= lo + 12) x -= 12;
  return x;
}

// Leitmotifs. Degrees are 0-based scale steps of whatever key the track is in.
/** Wait: two notes, then a long rest where the third note (degree 2) should land. */
export const WAIT: Fig = [[4, 1.5], [3, 1], [null, 2.5]];
export const WAIT_THIRD = 2;
/** Gloss: a phrase. Its gloss is the same phrase a diatonic fifth lower, quieter. */
export const GLOSS: Fig = [[2, 0.5], [4, 0.5], [3, 1], [1, 0.5], [2, 0.5], [0, 1]];
export const GLOSS_FALL = -4;
/** Halt: two heavy low notes, then a beat of nothing. */
export const HALT: Fig = [[0, 1], [-3, 1], [null, 1]];
/** Each: seven notes for a canon of voices that count differently. */
export const EACH: Fig = [[0, 0.5], [1, 0.5], [2, 0.5], [4, 0.5], [3, 0.5], [1, 0.5], [2, 1]];
/** When: a call, and the answer that only comes once a bar has passed. */
export const WHEN_CALL: Fig = [[4, 0.5], [5, 0.5], [7, 1.5]];
export const WHEN_ANSWER: Fig = [[6, 0.5], [4, 0.5], [2, 2]];
/** Again: four chromatic offsets, one beat long, copied into a second voice that drifts. */
export const AGAIN = [0, 7, 8, 3] as const;
/** Once: one phrase. It ends on Wait's missing degree. */
export const ONCE: Fig = [[0, 1], [4, 1], [7, 1.5], [6, 0.5], [4, 1], [5, 0.5], [4, 0.5], [2, 1], [3, 0.5], [1, 0.5], [2, 3]];
/** The Scrivener: broken-chord shapes, in chord-tone indexes, played as quick quiet sixteenths. */
export const SCRIV = [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 4], [3, 2, 1, 0, 1, 2], [0, 1, 2, 1, 3, 2, 4, 3]] as const;

/** Plays Again's loop on v from t to end, each note stepping by step beats. */
export function againLoop(b: B, v: Voice, t: number, end: number, root: number, step: number, g: number, x?: Partial<Ev>): number {
  let i = 0;
  let tt = t;
  while (tt < end - 1e-6) {
    b.n(v, tt, root + AGAIN[i % 4], Math.min(step * 0.8, end - tt), g, { duty: 0, ...x });
    tt += step;
    i++;
  }
  return i;
}

/** Scrivener arpeggio: sixteenths over a chord, for len beats. */
export function scriv(b: B, v: Voice, t: number, len: number, tones: readonly number[], shape: readonly number[], g: number, x?: Partial<Ev>, step = 0.25) {
  const n = Math.round(len / step);
  for (let i = 0; i < n; i++) {
    const idx = shape[i % shape.length];
    const p = tones[idx % tones.length] + 12 * Math.floor(idx / tones.length);
    b.n(v, t + i * step, p, step * 0.7, g * (i % 4 === 0 ? 1 : 0.75), x);
  }
}

// ---------------------------------------------------------------- splash and title

const A_AEO = key(57, MODE.aeo);

const splash: TrackDef = {
  bpm: 120, start: 'boot', vary: 0, wrong: 0, echo: 0.5,
  secs: {
    boot: () => {
      const b = new B(11, 4, 120);
      b.n('p1', 0, 76, 0.22, 0.5, { duty: 2 });
      b.n('bell', 0, 88, 2.5, 0.42, { ratio: 3.5 });
      b.n('p1', 0.5, 83, 0.6, 0.5, { duty: 2 });
      b.n('bell', 0.5, 95, 3, 0.32, { ratio: 3.5 });
      b.n('tri', 1.5, 40, 8.5, 0.55, { a: 1.6 });
      b.n('air', 1.5, 64, 8.5, 0.42, { a: 2.2 });
      [64, 71, 73, 68, 66, 71, 75].forEach((p, i) => b.n('p2', 2 + i, p, 1.4, 0.12 + i * 0.02, { duty: 1, a: 0.2 }));
      b.n('bell', 8, 83, 3, 0.2, { ratio: 3.5 });
      return b.out({ still: true });
    },
  },
};

/** Length of a figure up to its first rest. */
function soundLen(f: Fig): number {
  let s = 0;
  for (const [d, l] of f) { if (d === null) break; s += l; }
  return s;
}

function titleSec(c: Ctx, fig: Fig, base: number[], mv: Voice, oct: number, double: boolean): Section {
  const K = A_AEO, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, base, { 5: [5, 2], 3: [3, 1], 4: [4, 6, 2], 0: [0, 0, 5] }, 0.3);
  const gaps: Array<[number, number]> = [];
  for (const start of [0, 8]) {
    const f = start === 8 && r.chance(0.5) ? shift(fig, r.pick([-1, 1, 2])) : fig;
    b.fig(mv, start, f, K, oct, 0.5, { ...MEL, a: 0.08, ratio: 2 }, 0.96);
    if (double) b.fig('air', start, f, K, oct - 1, 0.22, { a: 0.1 }, 0.96);
    const s = start + soundLen(f);
    gaps.push([s, s + 1.25]);
  }
  const inGap = (t: number) => gaps.some(([a, z]) => t >= a && t < z);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, ch = chord(K, roots[i], 3).map((p) => fold(p, 57));
    b.n('tri', t0, fold(K(roots[i]), 33), 3.8, 0.5, { a: 0.3 });
    const pat = r.pick([[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1]]);
    pat.forEach((k, j) => {
      const t = t0 + j;
      if (!inGap(t) && !r.chance(0.15)) b.n('p2', t, ch[k] + (j === 3 && r.chance(0.3) ? 12 : 0), 0.9, 0.15, { duty: 1, a: 0.04 });
    });
  }
  if (r.chance(0.6)) b.n('bell', 4 + r.int(3), K(7 + r.int(3)) + 12, 2, 0.12, { ratio: 3.5 });
  return b.out();
}

function titleQuiet(c: Ctx): Section {
  const K = A_AEO, r = c.r, b = new B(8, 4, c.bpm);
  b.n('tri', 0, 33, 8, 0.45, { a: 1 });
  b.n('air', 0, K(4), 6, 0.2, { a: 1.5, ...MEL });
  const n = 1 + r.int(3);
  for (let i = 0; i < n; i++) b.n('bell', 1 + r.int(12) * 0.5, K(r.pick([4, 3, 0, 7, 9])) + 12, 2.5, 0.12, { ratio: 3.5 });
  return b.out();
}

const title: TrackDef = {
  bpm: 58, start: 'a', vary: 0.6, wrong: 0.05, echo: 0.45, wobble: 7,
  graph: {
    a: [['a2', 3], ['b', 3], ['c', 1]],
    a2: [['b', 3], ['a', 1], ['c', 2]],
    b: [['a', 3], ['c', 2], ['a2', 1]],
    c: [['a', 3], ['b', 1]],
  },
  secs: {
    a: (c) => titleSec(c, WAIT, [0, 5, 3, 4], 'air', 1, false),
    a2: (c) => titleSec(c, aug(WAIT, 1.5), [5, 3, 0, 4], 'air', 1, false),
    b: (c) => titleSec(c, inv(WAIT, 3), [3, 0, 5, 6], 'bell', 1, true),
    c: titleQuiet,
  },
};

// ---------------------------------------------------------------- Busy, in 7/8

const D_DOR = key(62, MODE.dor);
// Wait's figure turned around: the rest comes first, then the two notes rising.
const BUSY_A: Fig[] = [
  [[null, 1], [3, 1], [4, 1.5]],
  [[5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [3, 1.5]],
  [[null, 1], [3, 1], [4, 0.5], [6, 1]],
  [[5, 1], [4, 0.5], [2, 0.5], [1, 1.5]],
];
const BUSY_B: Fig[] = [
  [[7, 1], [6, 0.5], [4, 0.5], [5, 1.5]],
  [[4, 0.5], [3, 0.5], [2, 1], [0, 1.5]],
  [[null, 1], [2, 0.5], [3, 0.5], [4, 1.5]],
  [[3, 1], [1, 1], [2, 1.5]],
];
const BUSY_SUBS: Record<number, number[]> = { 0: [0, 2], 3: [3, 1], 1: [1, 4, 6], 6: [6, 4], 4: [4, 1] };

function busySec(c: Ctx, figs: Fig[], base: number[], copied: boolean, lead: boolean): Section {
  const K = D_DOR, r = c.r, bar = 3.5, b = new B(bar * 4, bar, c.bpm);
  const roots = prog(r, base, BUSY_SUBS, copied ? 0 : 0.3);
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar, R = roots[i], ch = chord(K, R, 4).map((p) => fold(p, 62));
    const line = realize(figs[i], K, 0);
    if (copied) {
      // Every voice reads the same line at the same moment, and one note per bar is wrong.
      const idx = line.map((x, j) => (x[0] === null ? -1 : j)).filter((j) => j >= 0);
      const w = r.pick(idx);
      const bad = line.map(([p, l], j): [number | null, number] => [p === null ? null : j === w ? p + r.pick([1, -1, 6]) : p, l]);
      b.line('p1', t0, bad, 0.36, { duty: 0 }, 0.55);
      b.line('p2', t0, bad, 0.3, { duty: 0 }, 0.55);
      b.line('tri', t0, bad.map(([p, l]) => [p === null ? null : p - 24, l]), 0.5, {}, 0.55);
      b.line('bell', t0, bad.map(([p, l]) => [p === null ? null : p + 12, l]), 0.14, { ratio: 2 }, 0.55);
      for (let e = 0; e < 7; e++) b.hit(t0 + e * 0.5, e % 2 ? 'tick' : 'tock', 0.18, 0.08);
      continue;
    }
    if (lead) b.line('p1', t0, line, 0.4, { ...MEL, duty: 1 }, 0.85);
    const root = fold(K(R), 38);
    b.n('tri', t0, root, 0.85, 0.55).n('tri', t0 + 1, root + 7, 0.85, 0.5);
    b.n('tri', t0 + 2, root + 12, 0.45, 0.5).n('tri', t0 + 2.5, root + 7, 0.9, 0.45);
    [0.5, 1.5, 2.5, 3].forEach((o, j) => b.n('p2', t0 + o, ch[(j + i) % 3 + 1], 0.22, 0.17, { duty: 2 }));
    for (let e = 0; e < 7; e++) {
      const acc = e === 0 || e === 2 || e === 4;
      b.hit(t0 + e * 0.5, acc ? 'tick' : 'hat', acc ? 0.2 : 0.09, 0.08);
    }
    if (!lead && i % 2 === 0) b.fig('bell', t0, retro(WAIT), K, 1, 0.16, { ratio: 3.5 });
  }
  return b.out();
}

const busyGraph: TrackDef['graph'] = {
  a: [['a2', 3], ['b', 2]],
  a2: [['b', 3], ['a', 1], ['c', 1]],
  b: [['a', 2], ['a2', 1], ['c', 2]],
  c: [['a', 3], ['b', 1]],
};

const busy: TrackDef = {
  bpm: 96, start: 'a', vary: 0.7, wrong: 0.06, echo: 0.2, wobble: 5, spread: 7,
  graph: busyGraph,
  secs: {
    a: (c) => busySec(c, BUSY_A, [0, 3, 0, 1], false, true),
    a2: (c) => busySec(c, BUSY_A.map((f, i) => (i % 2 ? f : shift(f, c.r.pick([0, 2, -1])))), [2, 3, 0, 4], false, true),
    b: (c) => busySec(c, BUSY_B, [6, 4, 2, 0], false, true),
    c: (c) => busySec(c, BUSY_A, [0, 6, 0, 6], false, false),
  },
};

const busyAgain: TrackDef = {
  bpm: 96, start: 'a', vary: 0, wrong: 0.12, echo: 0.1, wobble: 0, spread: 0,
  graph: busyGraph,
  secs: {
    a: (c) => busySec(c, BUSY_A, [0, 3, 0, 1], true, true),
    a2: (c) => busySec(c, BUSY_A.map((f) => shift(f, 1)), [0, 3, 0, 1], true, true),
    b: (c) => busySec(c, BUSY_B, [6, 4, 2, 0], true, true),
    c: (c) => busySec(c, [...BUSY_B].reverse(), [0, 6, 0, 6], true, true),
  },
};

// ---------------------------------------------------------------- the Millrace and the river

const E_PHR = key(52, MODE.phr);

function millSec(c: Ctx, kind: 'drip' | 'pulse' | 'deep'): Section {
  const K = E_PHR, r = c.r, b = new B(8, 4, c.bpm);
  if (kind === 'deep') b.n('tri', 0, 40, 4, 0.5, { a: 1 }).n('tri', 4, 41, 4, 0.5, { a: 0.8 });
  else b.n('tri', 0, 40, 8, 0.5, { a: 1.2 });
  const drips = kind === 'drip' ? 3 + r.int(4) : 1 + r.int(2);
  for (let i = 0; i < drips; i++) {
    b.n('bell', r.int(16) * 0.5, K(7 + r.int(7)) + 12, 0.6, r.range(0.14, 0.26), { ratio: 2.4, bend: -3, ...MEL });
  }
  if (kind === 'pulse') b.fig('p2', r.pick([0, 1, 2]), aug(r.chance(0.5) ? WAIT : inv(WAIT, 3), 2), K, 1, 0.15, { duty: 0, ...MEL });
  if (kind === 'deep' || r.chance(0.3)) b.hit(r.int(4), 'rush', 0.16, 4, { a: 1.5 });
  if (kind !== 'pulse' && r.chance(0.4)) b.n('air', 2 + r.int(3), K(r.pick([4, 1, 0])), 3, 0.18, { a: 0.8, ...MEL });
  return b.out();
}

const millrace: TrackDef = {
  bpm: 66, start: 'drip', vary: 0.5, wrong: 0.05, echo: 0.55, wobble: 9,
  graph: {
    drip: [['drip', 2], ['pulse', 3], ['deep', 2]],
    pulse: [['drip', 3], ['deep', 2], ['pulse', 1]],
    deep: [['drip', 3], ['pulse', 2]],
  },
  secs: { drip: (c) => millSec(c, 'drip'), pulse: (c) => millSec(c, 'pulse'), deep: (c) => millSec(c, 'deep') },
};

const G_LYD = key(55, MODE.lyd);

function riverSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const K = G_LYD, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, kind === 'c' ? [5, 4, 1, 0] : [0, 1, 0, 1], { 0: [0, 2, 5], 1: [1, 6] }, 0.3);
  const shape = r.pick([[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 1], [0, 1, 2, 3, 4, 2], [3, 2, 1, 0, 1, 2]]);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 3, R = roots[i], tones = chord(K, R, 5);
    for (let j = 0; j < 6; j++) b.n('p2', t0 + j * 0.5, fold(tones[0], 62) + (tones[shape[j]] - tones[0]), 0.45, j === 0 ? 0.2 : 0.14, { duty: 1 });
    const low = fold(K(R), 40);
    b.n('tri', t0, low, 1.4, 0.5).n('tri', t0 + 1.5, low + 7, 1.4, 0.42);
  }
  if (kind === 'a') {
    const n = 2 + r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', r.int(24) * 0.5, K(7 + r.int(5)) + 12, 1.5, 0.16, { ratio: 3.5, ...MEL });
  } else if (kind === 'b') {
    b.fig('p1', 0, GLOSS, K, 1, 0.36, { ...MEL, duty: 3 });
    b.fig('bell', 6, shift(GLOSS, GLOSS_FALL), K, 1, 0.18, { ratio: 3.5, ...MEL });
  } else {
    b.fig('p1', 0, inv(WAIT, 3), K, 1, 0.36, { ...MEL, duty: 3 });
    b.fig('p1', 6, shift(inv(WAIT, 3), 2), K, 1, 0.32, { ...MEL, duty: 3 });
  }
  return b.out();
}

const river: TrackDef = {
  bpm: 92, start: 'a', vary: 0.6, wrong: 0.05, echo: 0.4, wobble: 6, spread: 6,
  graph: { a: [['b', 3], ['c', 2], ['a', 1]], b: [['a', 2], ['c', 2]], c: [['a', 2], ['b', 2]] },
  secs: { a: (c) => riverSec(c, 'a'), b: (c) => riverSec(c, 'b'), c: (c) => riverSec(c, 'c') },
};

// ---------------------------------------------------------------- Standing, halted and released

const FS_HMIN = key(54, MODE.hmin);
const FS_ION = key(54, MODE.ion);
// Four-voice chords as [tri, air, p2, p1]: i, iv, VI, V, ii dim, and the major I that Standing never reaches.
const SC = {
  i: [42, 61, 66, 69], iv: [47, 62, 66, 71], VI: [50, 62, 66, 69], V: [49, 61, 65, 68], ii: [44, 62, 65, 68], I: [42, 61, 66, 70],
} as const;
type Chord4 = readonly number[];
const SVOICES: Voice[] = ['tri', 'air', 'p2', 'p1'];

function block(b: B, t: number, ch: Chord4, d: number, g: number, x?: Partial<Ev>) {
  ch.forEach((p, i) => b.n(SVOICES[i], t, p, d, i === 0 ? g * 1.3 : i === 1 ? g * 0.9 : g * 0.6, { duty: 1, a: 0.06, ...x }));
}

function clock(b: B, from: number, to: number, g: number, skip?: (t: number) => boolean, soft = false) {
  for (let t = Math.ceil(from); t < to; t++) if (!skip?.(t)) b.hit(t, soft ? 'hat' : t % 2 ? 'tock' : 'tick', g, 0.05);
}

function standCadence(c: Ctx, lit: boolean): Section {
  const r = c.r, hold = lit ? 8 : r.pick([8, 10, 12]), b = new B(6 + hold + (lit ? 2 : 0), 4, c.bpm);
  const path = r.pick([[SC.i, SC.iv, SC.VI], [SC.i, SC.VI, SC.iv], [SC.VI, SC.iv, SC.i], [SC.i, SC.ii, SC.VI], [SC.iv, SC.i, SC.VI]]);
  path.forEach((ch, i) => {
    block(b, i * 2, ch.slice(0, 3), 1.9, 0.38);
    // The top voice moves on its own: a held note, or a step away and back.
    const top = ch[3], step = r.pick([0, 0, 1, 2, -1, -2]);
    if (step) b.n('p1', i * 2, top, 0.95, 0.24, { duty: 1, ...MEL }).n('p1', i * 2 + 1, top + step, 0.9, 0.22, { duty: 1, ...MEL });
    else b.n('p1', i * 2, top, 1.9, 0.24, { duty: 1, ...MEL });
  });
  if (!lit) {
    // The cadence stops on the dominant and holds there.
    block(b, 6, SC.V, hold, 0.36, { a: 0.1 });
    clock(b, 0, b.beats, 0.11);
  } else {
    block(b, 6, SC.V, 1.9, 0.38);
    block(b, 8, SC.I.slice(0, 3), hold, 0.4, { a: 0.15 });
    const tune = r.pick([[[70, 2], [73, 1], [71, 1], [70, 4]], [[70, 3], [68, 1], [70, 4]], [[73, 2], [71, 2], [70, 4]]] as Array<Array<[number, number]>>);
    b.line('p1', 8, tune, 0.26, { duty: 3, ...MEL }, 0.95);
    clock(b, 0, b.beats, 0.05, undefined, true);
  }
  return b.out();
}

function standTick(c: Ctx, lit: boolean): Section {
  const r = c.r, b = new B(r.pick([8, 8, 12]), 4, c.bpm);
  const skip = r.chance(0.3) ? r.int(b.beats) : -1;
  clock(b, 0, b.beats, lit ? 0.06 : 0.12, (t) => t === skip, lit);
  if (r.chance(0.6)) b.n('air', r.int(8) * 0.5, FS_HMIN(r.pick([4, 6, 0, 2, 3])) + (lit ? 12 : 0), 3, 0.16, { a: 0.6, ...MEL });
  if (r.chance(lit ? 0.7 : 0.25)) b.fig('bell', r.int(6) * 0.5, r.chance(0.5) ? inv(HALT, 0) : shift(HALT, 4), lit ? FS_ION : FS_HMIN, 2, lit ? 0.13 : 0.07, { ratio: 3.5, ...MEL });
  return b.out();
}

function standHalt(c: Ctx): Section {
  const r = c.r, b = new B(8, 4, c.bpm);
  const t0 = r.pick([0, 1, 2]);
  const notes = realize(HALT, FS_HMIN, -1);
  b.line('tri', t0, notes, 0.6, {}, 0.95);
  b.line('p1', t0, notes.map(([p, l]) => [p === null ? null : p + 12, l]), 0.2, { duty: 2 }, 0.9);
  b.hit(t0, 'kick', 0.5, 0.3).hit(t0 + 1, 'kick', 0.45, 0.3);
  // Everything stops for the beat after the two notes, the clock too.
  clock(b, 0, 8, 0.12, (t) => t >= t0 && t < t0 + 3);
  return b.out();
}

function standWalk(c: Ctx): Section {
  const K = FS_ION, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, [0, 3, 5, 4], { 3: [3, 1], 5: [5, 2], 4: [4, 4, 6] }, 0.3);
  const mel: Fig = [[0, 1], [3, 1], [4, 0.5], [2, 0.5], [3, 1], [4, 1], [5, 0.5], [4, 0.5], [2, 1], [null, 1],
    [3, 1], [6, 1], [7, 0.5], [5, 0.5], [6, 1], [4, 1.5], [2, 0.5], [3, 1], [null, 1]];
  b.fig('p1', 0, mel, K, 1, 0.34, { ...MEL, duty: 3 });
  roots.forEach((R, i) => {
    const low = fold(K(R), 36);
    r.pick([[0, 7, 12, 7], [0, 4, 7, 12], [0, 12, 7, 5]]).forEach((o, j) => b.n('tri', i * 4 + j, low + o, 0.8, 0.45));
    const ch = chord(K, R, 3).map((p) => fold(p, 61));
    [0.5, 1.5, 2.5, 3.5].forEach((o, j) => b.n('p2', i * 4 + o, ch[j % 3], 0.3, 0.13, { duty: 1 }));
  });
  clock(b, 0, 16, 0.05, undefined, true);
  return b.out();
}

const standing: TrackDef = {
  bpm: 60, start: 'tick', vary: 0.3, wrong: 0.03, echo: 0.5, wobble: 6,
  graph: {
    tick: [['cadence', 3], ['tick', 1], ['halt', 1]],
    cadence: [['tick', 3], ['halt', 1]],
    halt: [['tick', 2], ['cadence', 1]],
  },
  secs: { tick: (c) => standTick(c, false), cadence: (c) => standCadence(c, false), halt: standHalt },
};

const standingLit: TrackDef = {
  bpm: 66, start: 'cadence', vary: 0.6, wrong: 0.04, echo: 0.4, wobble: 5,
  graph: {
    cadence: [['walk', 3], ['tick', 1]],
    walk: [['cadence', 2], ['walk', 1], ['tick', 1]],
    tick: [['cadence', 2], ['walk', 1]],
  },
  secs: { cadence: (c) => standCadence(c, true), walk: standWalk, tick: (c) => standTick(c, true) },
};

// ---------------------------------------------------------------- Twice and the Press

const BB_MIX = key(58, MODE.mix);

function twiceSec(c: Ctx, kind: 'a' | 'b' | 'c', one = false): Section {
  if (one) return twiceOneSec(c, kind);
  const K = BB_MIX, r = c.r, b = new B(kind === 'c' ? 8 : 16, 4, c.bpm);
  const roots = prog(r, kind === 'b' ? [3, 0, 6, 4] : [0, 6, 3, 0], { 0: [0, 5], 6: [6, 4], 3: [3, 1] }, 0.3);
  const bars = b.beats / 4;
  for (let i = 0; i < bars; i++) {
    const low = fold(K(roots[i]), 38);
    [0, 1, 2, 3].forEach((j) => b.n('tri', i * 4 + j, j % 2 ? low + 7 : low, 0.45, 0.5));
    [0.5, 1.5, 2.5, 3.5].forEach((o) => b.hit(i * 4 + o, 'hat', 0.08, 0.06));
    b.hit(i * 4, 'tick', 0.12, 0.05);
  }
  if (kind === 'a') {
    const phrase: Fig = [...EACH, ...shift(EACH, 2), [4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 1], [null, 1], ...WAIT.slice(0, 2), [null, 0.5]];
    // Two bodies: the same line on both pulses, a few cents apart, and a third body a beat behind.
    b.fig('p1', 0, phrase, K, 0, 0.32, { ...MEL, duty: 1 });
    b.fig('p2', 0, phrase, K, 0, 0.26, { duty: 1, det: 14 });
    b.fig('bell', 1, phrase, K, 1, 0.12, { ratio: 3.5 });
  } else if (kind === 'b') {
    const phrase: Fig = [...shift(EACH, 4), [5, 1], [4, 1], [2, 2], ...inv(EACH, 2), [0, 2], [null, 2]];
    b.fig('p1', 0, phrase, K, 0, 0.32, { ...MEL, duty: 1 });
    b.fig('p2', 2, shift(phrase, -3), K, 0, 0.22, { duty: 2, det: 9 });
  } else {
    b.fig('bell', 0, retro(EACH), K, 1, 0.16, { ratio: 3.5, ...MEL });
    b.fig('bell', 4, retro(shift(EACH, -2)), K, 1, 0.14, { ratio: 3.5, ...MEL });
  }
  return b.out();
}

const twice: TrackDef = {
  bpm: 104, start: 'a', vary: 0.55, wrong: 0.06, echo: 0.25, wobble: 5, spread: 12,
  graph: { a: [['b', 3], ['a', 1], ['c', 1]], b: [['a', 3], ['c', 1]], c: [['a', 2], ['b', 2]] },
  secs: { a: (c) => twiceSec(c, 'a'), b: (c) => twiceSec(c, 'b'), c: (c) => twiceSec(c, 'c') },
};

const C_PDOM = key(48, MODE.pdom);

function pressSec(c: Ctx, kind: 'stamp' | 'grind' | 'again'): Section {
  const K = C_PDOM, r = c.r, bar = 5, b = new B(20, bar, c.bpm);
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar;
    b.hit(t0, 'stamp', 0.4, 0.4).hit(t0 + 2, 'kick', 0.4, 0.3).hit(t0 + 3, 'stamp', 0.32, 0.4);
    [1, 2.5, 3.5, 4, 4.5].forEach((o) => b.hit(t0 + o, 'hat', 0.08, 0.05));
    const low = kind === 'grind' ? 36 + [0, 1, 2, 1][i] : 36;
    [0, 12, 0, 7, 12].forEach((o, j) => b.n('tri', t0 + j, low + o, 0.35, 0.55));
  }
  if (kind === 'stamp') {
    // The copier: p2 plays each bar of p1 one bar late, with a worse tuning and sometimes a wrong note.
    const cells: Fig[] = [];
    for (let i = 0; i < 4; i++) cells.push(r.pick([
      [[0, 0.5], [4, 0.5], [0, 0.5], [4, 0.5], [null, 1], [1, 0.5], [0, 1.5]],
      [[4, 1], [3, 0.5], [1, 0.5], [0, 1], [null, 2]],
      [[0, 0.5], [0, 0.5], [4, 1], [null, 1], [5, 0.5], [4, 1.5]],
      [[7, 0.5], [4, 0.5], [1, 1], [0, 1], [null, 2]],
    ] as Fig[]));
    cells.forEach((f, i) => {
      b.fig('p1', i * bar, f, K, 1, 0.3, { ...MEL, duty: 0 }, 0.6);
      const copy = r.chance(0.3) ? f.map(([d, l], j): readonly [number | null, number] => [d === null ? null : j === 0 ? d + 1 : d, l]) : f;
      b.fig('p2', (i + 1) * bar, copy, K, 1, 0.22, { duty: 0, det: 22 }, 0.6);
    });
  } else if (kind === 'grind') {
    for (let i = 0; i < 4; i++) b.n('bell', i * bar, K(r.pick([0, 1, 4])) + 12, 1.5, 0.18, { ratio: 1.41 });
  } else {
    const root = r.pick([72, 67, 74]), from = r.pick([0, 0, 5]);
    againLoop(b, 'p1', from, 20, root, 0.25, 0.2);
    againLoop(b, 'p2', from + r.pick([0.125, 0.25, 0.5]), 20, root, 0.25 * r.range(0.93, 0.97), 0.16, { det: 10 });
  }
  return b.out();
}

const press: TrackDef = {
  bpm: 120, start: 'stamp', vary: 0.4, wrong: 0.05, echo: 0.15, wobble: 4,
  next: (cur, c) => {
    const ag = Math.min(4, 0.5 + c.pass / 6);
    if (cur === 'stamp') return c.r.weighted([['stamp', 2], ['grind', 2], ['again', ag]]);
    if (cur === 'grind') return c.r.weighted([['stamp', 3], ['again', ag / 2]]);
    return c.r.weighted([['stamp', 3], ['grind', 1]]);
  },
  secs: { stamp: (c) => pressSec(c, 'stamp'), grind: (c) => pressSec(c, 'grind'), again: (c) => pressSec(c, 'again') },
};

// ---------------------------------------------------------------- the Ears and the Relay

const FS_LYD = key(54, MODE.lyd);

function earsSec(c: Ctx, kind: 'listen' | 'static' | 'field'): Section {
  const K = FS_LYD, r = c.r, b = new B(16, 4, c.bpm);
  b.n('tri', 0, 42, 8, 0.4, { a: 1 }).n('tri', 8, r.pick([42, 49, 47]), 8, 0.4, { a: 1 });
  const sweeps = kind === 'static' ? 2 + r.int(2) : r.int(2);
  for (let i = 0; i < sweeps; i++) b.hit(r.int(12), 'sweep', 0.12, 2 + r.int(3), { n: r.chance(0.5) ? 40 : 90, a: 0.5 });
  if (kind === 'listen' || kind === 'field') {
    const callV: Voice = kind === 'listen' ? 'bell' : 'air';
    const ansV: Voice = kind === 'listen' ? 'air' : 'bell';
    const t0 = r.pick([0, 0.5, 1, 2]);
    const call = r.chance(0.3) ? shift(WHEN_CALL, -2) : WHEN_CALL;
    const end = b.fig(callV, t0, call, K, 1, callV === 'bell' ? 0.22 : 0.3, { ...MEL, ratio: 3.5, a: 0.05 });
    // The answer waits a bar before it comes.
    b.fig(ansV, end + 4, r.chance(0.25) ? inv(WHEN_ANSWER, 4) : WHEN_ANSWER, K, 1, ansV === 'bell' ? 0.18 : 0.26, { ...MEL, ratio: 3.5, a: 0.1 });
  }
  const far = kind === 'static' ? 3 + r.int(3) : 1 + r.int(2);
  for (let i = 0; i < far; i++) b.n('p2', r.int(30) * 0.5, K(r.int(7)), 1.5, 0.07, { duty: 2, a: 0.15, ...MEL });
  return b.out();
}

const ears: TrackDef = {
  bpm: 63, start: 'listen', vary: 0.5, wrong: 0.05, echo: 0.6, wobble: 8,
  graph: {
    listen: [['static', 2], ['field', 2], ['listen', 1]],
    static: [['listen', 3], ['field', 1]],
    field: [['listen', 2], ['static', 2]],
  },
  secs: { listen: (c) => earsSec(c, 'listen'), static: (c) => earsSec(c, 'static'), field: (c) => earsSec(c, 'field') },
};

const E_PDOM = key(52, MODE.pdom);
const RELAY_CALLS: Fig[] = [
  [[0, 0.5], [1, 0.5], [4, 1]],
  [[4, 0.5], [3, 0.5], [1, 0.5], [0, 0.5]],
  [[4, 0.5], [5, 0.5], [7, 1]],
  [[2, 0.25], [1, 0.25], [0, 0.5], [1, 1]],
];

function relaySec(c: Ctx, kind: 'call' | 'shout' | 'hum', boss: boolean): Section {
  const K = E_PDOM, r = c.r, b = new B(kind === 'hum' ? 8 : 16, 4, c.bpm);
  const bars = b.beats / 4;
  for (let i = 0; i < bars; i++) {
    const t0 = i * 4;
    for (let j = 0; j < 8; j++) b.n('tri', t0 + j * 0.5, kind === 'hum' ? 40 : j === 6 ? 41 : 40, 0.4, kind === 'hum' ? 0.35 : 0.5);
    if (kind !== 'hum') {
      for (let j = 0; j < 8; j++) b.hit(t0 + j * 0.5, 'hat', j % 2 ? 0.06 : 0.1, 0.05);
      b.hit(t0 + 2, 'snare', 0.22, 0.15).hit(t0 + 3.5, 'snare', 0.16, 0.15);
    }
  }
  if (kind === 'call') {
    for (let i = 0; i < bars; i++) {
      const f = r.pick(RELAY_CALLS);
      const t0 = i * 4 + (boss ? 0 : r.pick([0, 0.5]));
      b.fig('p1', t0, f, K, 1, 0.32, { ...MEL, duty: 1 });
      // The relay answers before the call has finished, or a beat late and bent out of shape in the boss fight.
      const lag = boss ? 1 : r.pick([0.25, 0.5]);
      const bent = f.map(([d, l], j): readonly [number | null, number, number?] => [d, l, boss && j === f.length - 1 ? r.pick([1, -1, 6]) : 0]);
      b.fig('p2', t0 + lag, bent, K, boss ? 1 : 2, 0.24, { duty: 0, det: boss ? 30 : 15, bend: boss ? r.pick([0, -1]) : 0 });
      if (boss && r.chance(0.6)) b.fig('p2', t0 + 2.5, bent, K, 2, 0.16, { duty: 0, det: -25 });
    }
  } else if (kind === 'shout') {
    for (let i = 0; i < bars; i++) {
      const d = r.pick([0, 1, 4]);
      b.n('p1', i * 4, K(d) + 12, 1.5, 0.28, { duty: 0, ...MEL }).n('p2', i * 4, K(d) + 18, 1.5, 0.2, { duty: 0 });
      b.n('p1', i * 4 + 2, K(d + 1) + 12, 1, 0.26, { duty: 0 }).n('p2', i * 4 + 2.25, K(d + 1) + 18, 0.75, 0.18, { duty: 0 });
      b.hit(i * 4, 'sweep', 0.1, 2, { n: 90 });
    }
  } else {
    b.n('p2', 0, K(r.pick([4, 7])) + 12, 7, 0.14, { duty: 2, a: 1, bend: -1 });
    b.hit(r.int(4), 'sweep', 0.12, 3, { n: 50 });
  }
  return b.out();
}

const relay: TrackDef = {
  bpm: 132, start: 'call', vary: 0.45, wrong: 0.06, echo: 0.2, wobble: 4, spread: 9,
  graph: { call: [['call', 2], ['shout', 2], ['hum', 1]], shout: [['call', 2], ['hum', 1]], hum: [['call', 3]] },
  secs: { call: (c) => relaySec(c, 'call', false), shout: (c) => relaySec(c, 'shout', false), hum: (c) => relaySec(c, 'hum', false) },
};

// ---------------------------------------------------------------- the Tether and the Writing Room

const E_LYD = key(64, MODE.lyd);

function tetherSec(c: Ctx, kind: 'fall' | 'space' | 'once'): Section {
  const K = E_LYD, r = c.r, b = new B(16, 4, c.bpm);
  b.n('air', 0, K(r.pick([0, 4, -3])), 12, 0.18, { a: 2.5 });
  if (r.chance(0.6)) b.n('tri', r.pick([0, 4]), r.pick([40, 47, 45]), 8, 0.32, { a: 1.5 });
  if (kind === 'fall') {
    const top = 10 + r.int(5), len = 6 + r.int(4), step = r.pick([1, 1.5, 1]);
    for (let i = 0; i < len; i++) if (i === 0 || !r.chance(0.15)) b.n('bell', 1 + i * step, K(top - i) + 12, 2.5, 0.2 - i * 0.01, { ratio: 3.5, ...MEL });
  } else if (kind === 'space') {
    for (let i = 0; i < 2; i++) b.n('bell', 2 + i * 6 + r.int(3), K(7 + r.int(7)) + 12, 3, 0.14, { ratio: 3.5, ...MEL });
  } else {
    b.line('bell', 1, realize(aug(ONCE.slice(0, 4), 2), K, 1), 0.18, { ratio: 3.5, ...MEL });
    b.n('p2', 9, K(4) + 12, 4, 0.06, { duty: 2, a: 0.8 });
  }
  return b.out();
}

const tether: TrackDef = {
  bpm: 54, start: 'fall', vary: 0.4, wrong: 0.04, echo: 0.75, wobble: 8,
  graph: { fall: [['space', 2], ['fall', 1], ['once', 2]], space: [['fall', 3], ['once', 1]], once: [['space', 2], ['fall', 2]] },
  secs: { fall: (c) => tetherSec(c, 'fall'), space: (c) => tetherSec(c, 'space'), once: (c) => tetherSec(c, 'once') },
};

const B_AEO = key(59, MODE.aeo);

function writingSec(c: Ctx, kind: 'write' | 'blot', fast: boolean): Section {
  const K = B_AEO, r = c.r, b = new B(kind === 'blot' ? 8 : 16, 4, c.bpm);
  const eat = c.st.eat ?? 0;
  const roots = prog(r, [0, 5, 2, 6], { 0: [0, 3], 5: [5, 3], 2: [2, 4], 6: [6, 4] }, 0.35);
  const bars = b.beats / 4;
  const loopFrom = kind === 'blot' ? 0 : Math.floor(b.beats * (1 - eat) * 4) / 4;
  for (let i = 0; i < bars; i++) {
    const t0 = i * 4, R = roots[i % 4], tones = chord(K, R, 4).map((p) => fold(p, 59) + 12);
    b.n('tri', t0, fold(K(R), 35), fast ? 0.45 : 1.8, 0.45).n('tri', t0 + 2, fold(K(R + 4), 35), fast ? 0.45 : 1.8, 0.4);
    if (fast) [1, 3].forEach((o) => b.n('tri', t0 + o, fold(K(R), 35) + 12, 0.4, 0.4));
    if (kind === 'blot') continue;
    const shape = r.pick(SCRIV);
    const before = b.ev.length;
    scriv(b, i % 2 ? 'bell' : 'p2', t0, 4, tones, shape, fast ? 0.2 : 0.14, { duty: 0, ratio: 3, ...MEL });
    // Again eats the writing: the more it has spread, the more arpeggio notes it takes.
    b.ev = b.ev.filter((e, j) => j < before || !(e.t >= loopFrom && r.chance(0.35 + eat * 0.5)));
    for (let k = 0; k < 4; k++) b.hit(t0 + k + r.pick([0.25, 0.5, 0.75]), 'hat', 0.04, 0.05);
  }
  if (loopFrom < b.beats) {
    againLoop(b, 'p1', loopFrom, b.beats, 71, 0.25, 0.1 + eat * 0.1);
    if (eat > 0.4 || kind === 'blot') againLoop(b, 'p2', loopFrom + 0.25, b.beats, 71, 0.25 * 0.95, 0.08 + eat * 0.06, { det: 12 });
  }
  return b.out();
}

function writingNext(cur: string, c: Ctx): string {
  const eat = (c.st.eat ?? 0) + c.r.range(0.06, 0.14);
  if (eat > 1 || cur === 'blot') { c.st.eat = cur === 'blot' ? c.r.range(0, 0.3) : 1; return cur === 'blot' ? 'write' : 'blot'; }
  c.st.eat = eat;
  return 'write';
}

const writing: TrackDef = {
  bpm: 96, start: 'write', vary: 0.3, wrong: 0.05, echo: 0.35, wobble: 5,
  next: writingNext,
  secs: { write: (c) => writingSec(c, 'write', false), blot: (c) => writingSec(c, 'blot', false) },
};

// ---------------------------------------------------------------- the Nursery

const F_ION = key(65, MODE.ion);
// The lullaby. Index 2 is Wait's missing degree, and it is always a broken tooth.
const LULLABY: Fig = [[4, 2], [3, 1], [2, 1], [1, 1], [0, 1], [1, 1], [2, 1], [4, 1], [3, 3],
  [4, 2], [3, 1], [2, 1], [3, 1], [5, 1], [4, 1], [2, 1], [1, 1], [0, 3]];

function nurserySec(c: Ctx, kind: 'box' | 'wind' | 'still', teeth = 4): Section {
  const K = F_ION, r = c.r;
  if (!c.mem.broken) {
    const set = [2];
    while (set.length < teeth) { const k = 1 + r.int(LULLABY.length - 2); if (!set.includes(k)) set.push(k); }
    c.mem.broken = set;
  }
  const broken = c.mem.broken;
  if (kind === 'still') {
    const b = new B(6, 3, 60);
    b.n('air', 0, K(r.pick([0, 0, 4])), 5.5, 0.14, { a: 1.5 });
    const n = r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', 0.5 + r.int(9) * 0.5, K(r.pick([2, 4, 7, 5, 9])) + 12, 2, 0.12, { ratio: 4, ...MEL });
    return b.out();
  }
  const bpm = kind === 'wind' ? 54 : 64 + r.int(9);
  const len = kind === 'wind' ? 12 : 24;
  const b = new B(len, 3, bpm);
  let t = 0;
  LULLABY.forEach(([d, l], i) => {
    if (t >= len || d === null) { t += l; return; }
    const extra = r.chance(0.04);
    if (!broken.includes(i) && !extra) {
      const worn = r.chance(0.06);
      b.n('bell', t, K(d) + 12, l + 0.6, kind === 'wind' ? 0.2 - t * 0.012 : 0.2, { ratio: 4, det: worn ? -40 : 0, ...MEL });
    }
    t += l;
  });
  for (let bar = 0; bar < len / 3; bar++) {
    if (r.chance(0.12)) continue;
    const R = [0, 4, 3, 4, 0, 3, 4, 0][bar % 8];
    b.n('p2', bar * 3, fold(K(R), 53), 2.5, 0.07, { duty: 2, a: 0.02 });
  }
  b.n('air', 0, K(0) - 12, len - 0.5, 0.1, { a: 2 });
  return b.out();
}

const nursery: TrackDef = {
  bpm: 68, start: 'box', vary: 0.25, wrong: 0.06, echo: 0.6, wobble: 14,
  graph: { box: [['box', 2], ['wind', 2]], wind: [['still', 2], ['box', 1]], still: [['box', 3]] },
  secs: { box: (c) => nurserySec(c, 'box'), wind: (c) => nurserySec(c, 'wind'), still: (c) => nurserySec(c, 'still') },
};

// ---------------------------------------------------------------- the Margin, Stet, and reeling

const A_DOR = key(57, MODE.dor);

function marginSec(c: Ctx, kind: 'think' | 'gloss' | 'note'): Section {
  const K = A_DOR, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, [0, 3, 0, 6], { 0: [0, 2], 3: [3, 1], 6: [6, 4] }, 0.35);
  const shape = r.pick([[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 3, 2, 1, 2, 3]]);
  roots.forEach((R, i) => {
    const tones = chord(K, R, 5).map((p) => fold(K(R), 52) + (p - K(R)));
    shape.forEach((k, j) => b.n('p1', i * 4 + j * 0.5, tones[k], 0.4, j === 0 ? 0.14 : 0.1, { duty: 1 }));
    b.n('tri', i * 4, fold(K(R), 40), 1.8, 0.4).n('tri', i * 4 + 2, fold(K(R + 4), 40), 1.8, 0.36);
    b.hit(i * 4 + 1, 'hat', 0.05, 0.05).hit(i * 4 + 3, 'hat', 0.05, 0.05);
  });
  if (kind === 'gloss') {
    b.fig('air', 0, aug(GLOSS, 1.5), K, 1, 0.26, { ...MEL, a: 0.06 });
    b.fig('bell', 8, aug(shift(GLOSS, GLOSS_FALL), 1.5), K, 1, 0.13, { ratio: 3.5, ...MEL });
  } else if (kind === 'note') {
    b.fig('air', 0, aug(inv(GLOSS, 2), 1.5), K, 1, 0.24, { ...MEL, a: 0.06 });
    b.fig('bell', 8, aug(shift(inv(GLOSS, 2), GLOSS_FALL), 1.5), K, 1, 0.12, { ratio: 3.5, ...MEL });
  }
  return b.out();
}

const margin: TrackDef = {
  bpm: 80, start: 'think', vary: 0.5, wrong: 0.04, echo: 0.35, wobble: 6,
  graph: { think: [['gloss', 2], ['note', 2], ['think', 1]], gloss: [['think', 3], ['note', 1]], note: [['think', 3]] },
  secs: { think: (c) => marginSec(c, 'think'), gloss: (c) => marginSec(c, 'gloss'), note: (c) => marginSec(c, 'note') },
};

const G_DOR = key(55, MODE.dor);
const STET_A: Fig = [[null, 1], [4, 0.5], [3, 0.5, 1], [4, 1], [null, 1],
  [6, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [2, 1.5], [null, 0.5],
  [null, 2], [1, 0.5], [2, 0.5], [3, 1],
  [4, 0.5], [2, 0.5], [0, 1], [null, 2]];
const STET_B: Fig = [[7, 0.5], [6, 0.5, 1], [7, 0.5], [4, 1.5], [null, 1],
  [5, 0.5], [4, 0.5], [3, 0.5, 1], [4, 0.5], [2, 2],
  [null, 1], [0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 1],
  [3, 1.5], [null, 2.5]];

function swing(sec: Section, amt = 0.16): Section {
  for (const e of sec.ev) { const f = e.t - Math.floor(e.t); if (Math.abs(f - 0.5) < 0.01) { e.t += amt; e.d = Math.max(0.1, e.d - amt); } }
  return sec;
}

function stetSec(c: Ctx, kind: 'deal' | 'think' | 'play'): Section {
  const K = G_DOR, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, [0, 3, 1, 4], { 0: [0, 5], 3: [3, 6], 1: [1, 3], 4: [4, 6] }, 0.35);
  roots.forEach((R, i) => {
    const low = fold(K(R), 38), next = fold(K(roots[(i + 1) % 4]), 38);
    const walk = [low, low + r.pick([3, 4]), low + 7, next + r.pick([1, -1])];
    walk.forEach((p, j) => b.n('tri', i * 4 + j, p, 0.55, 0.45));
    b.hit(i * 4 + 1, 'hat', 0.09, 0.08).hit(i * 4 + 3, 'hat', 0.09, 0.08);
    b.hit(i * 4 + 2.5, 'hat', 0.04, 0.05).hit(i * 4 + 3.5, 'hat', 0.04, 0.05);
    if (kind !== 'deal' || r.chance(0.5)) {
      const ch = chord(K, R, 4).map((p) => fold(p, 60));
      b.n('p2', i * 4 + 1.5, ch[1], 0.3, 0.12, { duty: 1 }).n('p2', i * 4 + 1.75, ch[3], 0.3, 0.1, { duty: 1 });
    }
  });
  if (kind === 'deal') b.fig('p1', 0, STET_A, K, 1, 0.3, { ...MEL, duty: 3 }, 0.7);
  else if (kind === 'play') b.fig('p1', 0, STET_B, K, 1, 0.3, { ...MEL, duty: 3 }, 0.7);
  else if (r.chance(0.7)) b.n('bell', 4 * r.int(4) + 3.5, K(r.pick([4, 6, 2])) + 12, 0.8, 0.14, { ratio: 2, ...MEL });
  return swing(b.out());
}

const stet: TrackDef = {
  bpm: 92, start: 'deal', vary: 0.5, wrong: 0.05, echo: 0.2, wobble: 5,
  graph: { deal: [['think', 2], ['play', 2]], think: [['deal', 2], ['play', 2], ['think', 1]], play: [['think', 2], ['deal', 2]] },
  secs: { deal: (c) => stetSec(c, 'deal'), think: (c) => stetSec(c, 'think'), play: (c) => stetSec(c, 'play') },
};

const D_AEO = key(62, MODE.aeo);
const C_WHOLE = key(60, MODE.whole);

function reelSec(c: Ctx, kind: 'drift' | 'bob' | 'deep'): Section {
  const K = D_AEO, r = c.r, b = new B(12, 3, c.bpm);
  for (let i = 0; i < 4; i++) b.n('tri', i * 3, i % 2 ? 45 : 38, 1.4, 0.4).n('tri', i * 3 + 1.5, i % 2 ? 40 : 45, 1.4, 0.34);
  if (r.chance(0.5)) b.hit(r.int(6), 'rush', 0.1, 5, { a: 2 });
  if (kind === 'drift') {
    const n1 = K(r.pick([4, 2, 6])), n2 = K(r.pick([3, 1, 0]));
    b.n('air', 0.5, n1, 5, 0.22, { a: 0.8, bend: r.pick([0, -1, 1]), ...MEL });
    b.n('air', 6.5, n2, 5, 0.2, { a: 0.8, bend: r.pick([0, -0.5]), ...MEL });
    if (r.chance(0.6)) b.n('bell', 3 + r.int(6), K(7 + r.int(4)) + 12, 1, 0.14, { ratio: 2.4, ...MEL });
  } else if (kind === 'bob') {
    const p = K(r.pick([4, 7, 9])) + 12;
    [0, 1.5, 3, 4, 6, 7.5].forEach((t, i) => { if (!r.chance(0.2)) b.n('bell', t + 0.5, p - (i % 2) * 2, 0.6, 0.15, { ratio: 2.4, bend: i % 2 ? 1 : 0, ...MEL }); });
  } else {
    const top = 6 + r.int(3);
    for (let i = 0; i < 5; i++) b.n('air', i * 2.25, C_WHOLE(top - i) + 2, 2.2, 0.2, { a: 0.4, ...MEL });
  }
  return b.out();
}

const reel: TrackDef = {
  bpm: 58, start: 'drift', vary: 0.5, wrong: 0.05, echo: 0.6, wobble: 12,
  graph: { drift: [['bob', 2], ['deep', 1], ['drift', 1]], bob: [['drift', 3], ['deep', 1]], deep: [['drift', 3]] },
  secs: { drift: (c) => reelSec(c, 'drift'), bob: (c) => reelSec(c, 'bob'), deep: (c) => reelSec(c, 'deep') },
};

// ---------------------------------------------------------------- battle, in 7/8 grouped 3+2+2

const BAT_A: Fig[] = [
  [[4, 1.5], [3, 1], [null, 1]],
  [[4, 0.5], [5, 0.5], [6, 0.5], [7, 1], [6, 0.5], [4, 0.5]],
  [[4, 1.5], [3, 1], [1, 1]],
  [[0, 0.5], [1, 0.5], [2, 0.5], [1, 1], [-1, 1, 1]],
];
const BAT_B: Fig[] = [
  [[2, 1.5], [3, 1], [null, 1]],
  [[2, 0.5], [3, 0.5], [4, 0.5], [6, 1], [5, 1]],
  [[7, 1.5], [8, 1], [6, 1]],
  [[5, 0.5], [4, 0.5], [3, 0.5], [4, 2]],
];
const BAT_C: Fig[] = [
  [[1, 1.5, -1], [0, 1], [null, 1]],
  [[1, 0.5, -1], [2, 0.5], [3, 0.5], [4, 2]],
  [[5, 1.5], [4, 1], [1, 1, -1]],
  [[0, 3.5]],
];
// Chord roots in semitones above A. Roots in MAJ take a major triad.
const BAT_PROGS: Record<string, number[][]> = {
  a: [[0, 8, 5, 7], [0, 8, 3, 7], [0, 5, 8, 7], [0, 10, 8, 7]],
  b: [[3, 8, 10, 7], [3, 5, 10, 7], [8, 3, 10, 7]],
  c: [[1, 0, 1, 0], [1, 0, 10, 0]],
};
const MAJ = new Set([1, 3, 7, 8, 10]);
/** The triad on the root `off` semitones above `base`, major when that offset is in MAJ. */
const triad = (base: number, off: number) => [base + off, base + off + (MAJ.has(((off % 12) + 12) % 12) ? 4 : 3), base + off + 7];

function battleSec(c: Ctx, part: 'a' | 'b' | 'c', copied: boolean): Section {
  const K = A_AEO, r = c.r, bar = 3.5, b = new B(bar * 4, bar, c.bpm);
  const figs = part === 'a' ? BAT_A : part === 'b' ? BAT_B : BAT_C;
  const roots = r.pick(BAT_PROGS[part]);
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar, root = 33 + roots[i], tones = triad(57, roots[i]).map((p) => fold(p, 57));
    // Bass in eighths, grouped 3+2+2.
    [0, 12, 0, 7, 12, 0, 7].forEach((o, j) => b.n('tri', t0 + j * 0.5, root + o, 0.42, j === 0 || j === 3 || j === 5 ? 0.6 : 0.45));
    b.hit(t0, 'kick', 0.42, 0.2).hit(t0 + 1.5, 'snare', 0.28, 0.15).hit(t0 + 2.5, 'kick', 0.32, 0.2);
    for (let j = 0; j < 7; j++) b.hit(t0 + j * 0.5, 'hat', j % 2 ? 0.06 : 0.1, 0.05, { lay: 0.35 });
    b.fig('p1', t0, figs[i], K, 1, 0.34, { ...MEL, duty: 1 }, 0.88);
    b.fig('bell', t0, figs[i], K, 2, 0.1, { ratio: 3.5, lay: 0.6 }, 0.8);
    if (!copied) {
      [0.5, 2, 3].forEach((o, j) => b.n('p2', t0 + o, tones[(j + i) % 3], 0.3, 0.16, { duty: 2, top: 0.85 }));
      for (let j = 0; j < 14; j++) b.n('p2', t0 + j * 0.25, tones[[0, 1, 2, 1][j % 4]] + (j % 7 === 6 ? 12 : 0), 0.2, 0.13, { duty: 1, lay: 0.85 });
    }
  }
  if (copied) {
    // Again's loop takes the second pulse and drifts out of phase with the 7/8 grid.
    againLoop(b, 'p2', 0, b.beats, 69, 0.25 * 0.96, 0.16, { det: 8 });
    for (let t = 0; t < b.beats; t++) b.hit(t, 'tock', 0.12, 0.05);
  }
  return b.out();
}

const battleGraph: TrackDef['graph'] = {
  a: [['b', 3], ['a', 1], ['c', 1]],
  b: [['a', 3], ['c', 2]],
  c: [['a', 3], ['b', 1]],
};

const battle: TrackDef = {
  bpm: 152, start: 'a', vary: 0.5, wrong: 0.05, echo: 0.15, wobble: 4, spread: 8,
  graph: battleGraph,
  secs: { a: (c) => battleSec(c, 'a', false), b: (c) => battleSec(c, 'b', false), c: (c) => battleSec(c, 'c', false) },
};

const battleCopied: TrackDef = {
  bpm: 152, start: 'a', vary: 0.5, wrong: 0.08, echo: 0.15, wobble: 3, spread: 8,
  graph: battleGraph,
  secs: { a: (c) => battleSec(c, 'a', true), b: (c) => battleSec(c, 'b', true), c: (c) => battleSec(c, 'c', true) },
};

// ---------------------------------------------------------------- bosses

const GRIND_CELLS: number[][] = [[0, 1, 0, 3, 0, 1, 4, 3], [0, 0, 1, 0, 3, 1, 0, -1], [0, 1, 3, 1, 0, 1, 4, 1]];

function grindSec(c: Ctx): Section {
  const K = E_PHR, r = c.r, k = c.st.k ?? 0;
  const b = new B(8, 4, 112 * Math.pow(1.09, k));
  const cell = GRIND_CELLS[(c.st.cell ?? 0) % GRIND_CELLS.length];
  const lift = r.pick([[0, 0, 0, 0], [0, 0, 12, 0], [0, 12, 0, 12], [0, 0, 0, 7], [12, 0, 0, 0], [0, 0, 12, 12], [0, 7, 0, 12]]);
  const duty = r.pick([0, 1, 1]), drop = r.chance(0.5) ? r.int(16) : -1;
  for (let i = 0; i < 16; i++) {
    const t = i * 0.5, d = cell[i % 8];
    b.n('tri', t, K(d) - 12 + (i === drop ? 12 : 0), 0.4, 0.55);
    b.n('p1', t, K(d) + 12 + lift[i % 4], 0.3, 0.2, { duty, ...MEL });
    if (k >= 1 || c.int >= 0.4) b.hit(t, 'hat', i % 2 ? 0.06 : 0.1, 0.05);
  }
  const fill = r.chance(0.4);
  for (let q = 0; q < 8; q++) if (!(fill && q === 7)) b.hit(q, q % 2 ? 'snare' : 'kick', q % 2 ? 0.24 : 0.4, 0.18);
  if (fill) for (let q = 0; q < 4; q++) b.hit(7 + q * 0.25, 'snare', 0.12 + q * 0.04, 0.1);
  if (k >= 2 || c.int >= 0.6) b.fig('p2', 0, BUSY_A[0].concat(BUSY_A[1]), K, 1, 0.2, { duty: 0, ...MEL }, 0.7);
  if (k >= 3 || c.int >= 0.85) for (let q = 0; q < 2; q++) b.n('bell', q * 4, K(r.pick([1, 4])) + 12, 1, 0.16, { ratio: 1.41 });
  return b.out();
}

function grindRest(c: Ctx): Section {
  const b = new B(4, 4, 100);
  b.n('tri', 0, 40, 3.5, 0.35, { a: 0.3 });
  b.hit(0, 'stamp', 0.25, 0.6);
  if (c.r.chance(0.5)) b.n('air', 1, E_PHR(c.r.pick([3, 4])), 2.5, 0.14, { a: 0.4 });
  return b.out({ still: true });
}

const bossGrind: TrackDef = {
  bpm: 112, start: 'grind', vary: 0.5, wrong: 0.03, echo: 0.15, wobble: 4,
  next: (cur, c) => {
    if (cur === 'rest') { c.st.k = 0; c.st.cell = c.r.int(GRIND_CELLS.length); return 'grind'; }
    const k = (c.st.k ?? 0) + 1;
    if (k > 3) return 'rest';
    c.st.k = k;
    return 'grind';
  },
  secs: { grind: grindSec, rest: grindRest },
};

function holdMarch(c: Ctx): Section {
  const K = FS_HMIN, r = c.r, b = new B(8, 4, c.bpm);
  const chs = r.pick([[SC.i, SC.V], [SC.iv, SC.V], [SC.VI, SC.ii], [SC.i, SC.iv], [SC.VI, SC.V]]);
  const pat = r.pick([[[0, 2, 1.8], [2, 3, 1.8]], [[0, 2, 0.9], [1, 3, 0.9], [2, 2, 1.8]], [[0.5, 2, 1.4], [2.5, 3, 1.4]]]);
  chs.forEach((ch, i) => {
    const t0 = i * 4;
    [0, 1, 2, 3].forEach((j) => b.n('tri', t0 + j, ch[0] - (j % 2 ? 0 : 12), 0.6, 0.55));
    for (const [o, k, d] of pat) b.n('p2', t0 + o, ch[k], d, 0.19, { duty: 2 });
    b.hit(t0, 'kick', 0.45, 0.2).hit(t0 + 1, 'snare', 0.22, 0.15).hit(t0 + 2, 'kick', 0.4, 0.2);
    if (i === 1 && r.chance(0.4)) [3, 3.25, 3.5, 3.75].forEach((o, q) => b.hit(t0 + o, 'snare', 0.1 + q * 0.04, 0.1));
    else b.hit(t0 + 3, 'snare', 0.22, 0.15);
    for (let j = 0; j < 8; j++) b.hit(t0 + j * 0.5, 'tick', 0.07, 0.04, { lay: 0.4 });
  });
  const f = r.pick([HALT, shift(HALT, 2), inv(HALT, 0), [...HALT.slice(0, 2), [4, 1]] as Fig]);
  b.fig('p1', 0, f, K, 1, 0.34, { ...MEL, duty: 3 });
  b.fig('p1', 4, r.chance(0.5) ? shift(f, -1) : retro(f), K, 1, 0.3, { ...MEL, duty: 3 });
  b.fig('bell', 4, f, K, 2, 0.12, { ratio: 1.41, lay: 0.6 });
  return b.out();
}

const bossHold: TrackDef = {
  bpm: 100, start: 'march', vary: 0.4, wrong: 0.03, echo: 0.2, wobble: 3,
  next: (cur, c) => {
    if (cur === 'halt') { c.st.left = 1 + c.r.int(3); return 'march'; }
    const left = (c.st.left ?? 2) - 1;
    c.st.left = left;
    return left <= 0 ? 'halt' : 'march';
  },
  // The halt bar holds no events at all: the whole score stops for a bar.
  secs: { march: holdMarch, halt: (c) => new B(4, 4, c.bpm).out({ still: true }) },
};

function manySec(c: Ctx, kind: 'crowd' | 'press'): Section {
  const K = BB_MIX, r = c.r, b = new B(kind === 'press' ? 8 : 16, 4, c.bpm);
  const bars = b.beats / 4;
  const roots = prog(r, [0, 6, 3, 4], { 0: [0, 5], 6: [6, 4], 3: [3, 1] }, 0.3);
  for (let i = 0; i < bars; i++) {
    const low = fold(K(roots[i]), 34);
    for (let j = 0; j < 8; j++) b.n('tri', i * 4 + j * 0.5, j % 2 ? low + 12 : low, 0.4, 0.5, { top: 0.75 });
    // Once the fourth body enters, the drums give way, so the bodies alone fill the five voices.
    const top = { top: 0.5 };
    b.hit(i * 4, 'kick', 0.4, 0.2, top).hit(i * 4 + 1, 'snare', 0.22, 0.15, top).hit(i * 4 + 2.5, 'kick', 0.3, 0.2, top).hit(i * 4 + 3, 'snare', 0.22, 0.15, top);
  }
  const mel: Fig = kind === 'press'
    ? [[0, 1], [0, 1], [2, 1], [4, 1], [4, 1], [2, 1], [1, 2]]
    : [...EACH, ...shift(EACH, 2), [4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 1], ...shift(EACH, -1)];
  // One melody, many bodies: each voice enters a little later and counts a little differently.
  const bodies: Array<[Voice, number, number, number, number]> = [
    ['p1', 0, 1, 0.32, 0], ['p2', 0.5, 1, 0.24, 0], ['bell', 1, 2, 0.13, 0.25], ['air', 1.5, 0, 0.22, 0.5], ['tri', 2, -1, 0.4, 0.75],
  ];
  for (const [v, off, oct, g, lay] of bodies) {
    const o = kind === 'press' ? 0 : off;
    const f = mel.map(([d, l], j): readonly [number | null, number] => [d !== null && j > 0 && r.chance(0.08) ? d + r.pick([1, -1]) : d, l]);
    b.fig(v, o, f, K, oct, g, { duty: v === 'p1' ? 1 : 0, det: v === 'p2' ? 11 : 0, lay, ratio: 3.5 }, 0.85);
  }
  return b.out();
}

const bossMany: TrackDef = {
  bpm: 112, start: 'crowd', vary: 0.3, wrong: 0.05, echo: 0.25, wobble: 5,
  graph: { crowd: [['crowd', 2], ['press', 1]], press: [['crowd', 1]] },
  secs: { crowd: (c) => manySec(c, 'crowd'), press: (c) => manySec(c, 'press') },
};

const bossRelay: TrackDef = {
  bpm: 140, start: 'call', vary: 0.4, wrong: 0.06, echo: 0.2, wobble: 4, spread: 15,
  graph: { call: [['call', 3], ['shout', 2]], shout: [['call', 2], ['hum', 1]], hum: [['call', 1]] },
  secs: { call: (c) => relaySec(c, 'call', true), shout: (c) => relaySec(c, 'shout', true), hum: (c) => relaySec(c, 'hum', true) },
};

function armSec(c: Ctx, kind: 'write' | 'blot'): Section {
  c.st.eat = Math.min(0.9, c.int * 0.8 + (kind === 'blot' ? 0.2 : 0));
  const s = writingSec(c, kind, true);
  const b = new B(s.beats, 4, s.bpm);
  b.ev = s.ev;
  for (let t = 0; t < s.beats; t++) b.hit(t, t % 2 ? 'snare' : 'kick', t % 2 ? 0.22 : 0.38, 0.18);
  for (let t = 0; t < s.beats; t += 2) b.n('bell', t + 1.5, B_AEO(c.r.pick([0, 4, 7])) + 24, 0.4, 0.12, { ratio: 3, lay: 0.3 });
  return b.out();
}

const bossArm: TrackDef = {
  bpm: 150, start: 'write', vary: 0.3, wrong: 0.05, echo: 0.2, wobble: 3,
  graph: { write: [['write', 4], ['blot', 1]], blot: [['write', 1]] },
  secs: { write: (c) => armSec(c, 'write'), blot: (c) => armSec(c, 'blot') },
};

// The fallback for boss_again: Wait's figure and the pitches of strike, mend, and jolt.
const FALLBACK_SPELLS = [[7, 5, 0, 0, 0], [7, 0, 4, 7, 11], [0, 0, 0, 12, 7, 5]];
const A_SCALE = new Set(MODE.aeo.map((x) => (57 + x) % 12));

function againSec(c: Ctx): Section {
  const r = c.r, b = new B(16, 4, c.bpm);
  const pages = c.spells.filter((p) => p.length > 0);
  const src = pages.length ? pages : FALLBACK_SPELLS;
  const pi = (c.st.page ?? 0) % src.length;
  c.st.page = pi + 1;
  const page = src[pi].slice(0, 16);
  const collapse = Math.max(0, Math.min(1, (c.int - 0.5) * 2));
  const step = Math.max(0.5, Math.min(2, Math.floor((12 / page.length) * 2) / 2));
  let t = 0, last = 69;
  page.forEach((s, i) => {
    if (t >= 14) return;
    let n = fold(57 + s, 64);
    if (Math.abs(n - last) > 7) n += n > last ? -12 : 12;
    while (n < 60) n += 12;
    while (n > 84) n -= 12;
    last = n;
    const len = i === page.length - 1 ? Math.max(step, 2) : step;
    if (r.chance(collapse)) {
      // Phase two: the loop writes over the player's own melody.
      againLoop(b, 'p1', t, t + len, 69, 0.25, 0.22);
    } else {
      b.n('p1', t, n, len * 0.9, 0.34, { duty: 1, ...MEL });
      const third = A_SCALE.has((n - 3) % 12) ? n - 3 : n - 4;
      b.n('bell', t, third, len * 0.9, 0.12 * (1 - collapse), { ratio: 3.5 });
    }
    if (i % 2 === 0) b.n('tri', t, fold(n, 33) + (r.chance(0.3) ? 7 : 0), Math.min(len * 2, 2) * 0.9, 0.5);
    t += len;
  });
  againLoop(b, 'p2', r.pick([0, 0.125, 0.25]), 16, 69, 0.25 * (r.range(0.96, 0.98) - collapse * 0.04), 0.14 + collapse * 0.08, { det: 10 });
  if (collapse > 0.3) againLoop(b, 'bell', r.pick([0.125, 0.375]), 16, 81, 0.25 * r.range(1.01, 1.04), 0.1 * collapse, { ratio: 2 });
  if (collapse > 0.6) againLoop(b, 'tri', 0, 16, 45, 0.25, 0.4);
  for (let q = 0; q < 16; q++) b.hit(q, q % 2 ? 'snare' : 'kick', q % 2 ? 0.2 : 0.36, 0.15);
  for (let q = 0; q < 32; q++) b.hit(q * 0.5, 'tock', 0.05 + collapse * 0.08, 0.04, { lay: 0.2 });
  return b.out();
}

const bossAgain: TrackDef = {
  bpm: 132, start: 'page', vary: 0.2, wrong: 0.04, echo: 0.2, wobble: 3, spread: 6,
  graph: { page: [['page', 1]] },
  secs: { page: againSec },
};

function erratumSec(c: Ctx): Section {
  const K = A_AEO, r = c.r, b = new B(16, 4, c.bpm);
  if (!c.mem.mel) {
    c.mem.mel = [...realize([...WAIT.slice(0, 2), ...EACH, ...GLOSS.slice(0, 5), ...HALT.slice(0, 2)], K, 1).map((x) => x[0] as number)];
    c.mem.bass = [33, 41, 38, 40];
    c.mem.drum = [1, 0, 0, 1, 0, 0, 1, 0];
  }
  const mel = c.mem.mel, bass = c.mem.bass, drum = c.mem.drum;
  if (c.pass > 0) {
    // The erratum: one note is rewritten each pass, and the rewrite stays.
    const i = r.int(mel.length);
    let n = mel[i] + r.pick([1, -1, 6, -6, 11, -13, 2]);
    while (n > 84) n -= 12;
    while (n < 57) n += 12;
    mel[i] = n;
    if (c.pass % 3 === 0) bass[r.int(4)] += r.pick([1, -1, 5, -7]);
    if (c.pass % 2 === 0) { const k = r.int(8); drum[k] = 1 - drum[k]; }
  }
  for (let rep = 0; rep < 2; rep++) {
    mel.forEach((n, i) => {
      const t = rep * 8 + i * 0.5;
      b.n('p1', t, n, 0.42, 0.3, { duty: rep ? 0 : 1 });
      if (rep) b.n('p2', t + 0.25, n - 12, 0.2, 0.14, { duty: 0, det: 15 });
    });
    bass.forEach((n, i) => {
      const lo = Math.max(28, Math.min(52, n));
      b.n('tri', rep * 8 + i * 2, lo, 0.9, 0.5).n('tri', rep * 8 + i * 2 + 1, lo + 12, 0.9, 0.42);
    });
    for (let q = 0; q < 16; q++) if (drum[q % 8]) b.hit(rep * 8 + q * 0.5, q % 4 === 0 ? 'kick' : 'snare', 0.3, 0.15);
    for (let q = 0; q < 16; q++) b.hit(rep * 8 + q * 0.5, 'hat', 0.06, 0.04, { lay: 0.4 });
  }
  return b.out({ still: true });
}

const bossErratum: TrackDef = {
  bpm: 126, start: 'err', vary: 0, wrong: 0, echo: 0.2, wobble: 6, spread: 10,
  graph: { err: [['err', 1]] },
  secs: { err: erratumSec },
};

// ---------------------------------------------------------------- character themes

const D_AEO_LOW = key(50, MODE.aeo);

function themeWait(c: Ctx, K: Key, alt: boolean): Section {
  const r = c.r, b = new B(8, 4, c.bpm);
  const f = alt ? shift(WAIT, r.pick([2, -1])) : WAIT;
  const mv: Voice = alt ? 'bell' : 'p1';
  b.fig(mv, 0, f, K, 1, alt ? 0.2 : 0.32, { ...MEL, duty: 3, ratio: 3.5 }, 0.96);
  const gapFrom = soundLen(f);
  const roots = alt ? [r.pick([5, 2]), 3] : [0, r.pick([5, 3, 6])];
  const pat = r.pick([[0, 1, 2, 1], [2, 1, 0, 1], [0, 2, 1, 2], [1, 0, 2, 0]]);
  roots.forEach((R, i) => {
    b.n('tri', i * 4, fold(K(R), r.pick([33, 38])), 3.8, 0.42, { a: 0.4 });
    const ch = chord(K, R, 3).map((p) => fold(p, 57));
    pat.forEach((k, j) => { const t = i * 4 + j; if (t < gapFrom || t >= gapFrom + 1.5) b.n('p2', t + 0.5, ch[k], 0.8, 0.11, { duty: 1 }); });
  });
  if (!alt && r.chance(0.4)) b.n('bell', 5 + r.int(4) * 0.5, K(r.pick([7, 9, 11])) + 12, 2, 0.07, { ratio: 3.5, ...MEL });
  return b.out();
}

function themeGloss(c: Ctx, K: Key): Section {
  const r = c.r, b = new B(16, 4, c.bpm);
  const p1 = r.chance(0.5) ? GLOSS : shift(GLOSS, 1);
  const p2 = r.pick([inv(GLOSS, 2), retro(GLOSS), shift(GLOSS, 2)]);
  b.fig('p1', 0, p1, K, 0, 0.32, { ...MEL, duty: 3 });
  b.fig('bell', 4.5, shift(p1, GLOSS_FALL), K, 1, 0.13, { ratio: 3.5, ...MEL });
  b.fig('p1', 8, p2, K, 0, 0.3, { ...MEL, duty: 3 });
  b.fig('bell', 12.5, shift(p2, GLOSS_FALL), K, 1, 0.12, { ratio: 3.5, ...MEL });
  prog(r, [0, 3, 5, 4], { 3: [3, 1], 5: [5, 2] }, 0.35).forEach((R, i) => {
    b.n('tri', i * 4, fold(K(R), 36), 1.9, 0.4).n('tri', i * 4 + 2, fold(K(R + 4), 36), 1.9, 0.35);
    b.n('air', i * 4, fold(K(R + 2), 55), 3.8, 0.12, { a: 0.6 });
  });
  return b.out();
}

function themeHalt(c: Ctx, K: Key): Section {
  const r = c.r, b = new B(8, 4, c.bpm);
  const hi = r.chance(0.5);
  const notes = realize(hi ? shift(HALT, r.pick([2, 4])) : HALT, K, -1);
  b.line('tri', 0, notes, 0.6, {}, 0.95);
  b.line('p1', 0, notes.map(([p, l]) => [p === null ? null : p + 24, l]), 0.24, { duty: 2 }, 0.95);
  b.hit(0, 'kick', 0.5, 0.3).hit(1, 'kick', 0.45, 0.3);
  // Beat 3 is the halt. Nothing sounds until beat 4.
  const ch = chord(K, r.pick([0, 5, 3, 6]), 3).map((p) => fold(p, r.pick([55, 57, 60])));
  const order = r.pick([['air', 'p2', 'bell'], ['p2', 'air', 'bell'], ['bell', 'p2', 'air']] as Voice[][]);
  ch.forEach((p, i) => b.n(order[i], 3, p, 4.5, order[i] === 'bell' ? 0.1 : 0.16, { a: r.pick([0.3, 0.5, 0.8]), duty: 1, ratio: 2, ...MEL }));
  b.n('tri', 3, fold(ch[0], 33), 4.5, 0.35, { a: 0.5 });
  return b.out();
}

function themeEach(c: Ctx, K: Key): Section {
  const r = c.r, b = new B(16, 4, c.bpm);
  // Seven bodies counting differently: each voice stretches the figure a little and gets one note wrong.
  const bodies: Array<[Voice, number, number, number, number]> = [['p1', 0, 1, 0.3, 1], ['p2', 0.5, 1, 0.22, 0.98], ['bell', 1.25, 2, 0.13, 1.03], ['air', 2, 0, 0.22, 0.96]];
  for (const [v, off, oct, g, k] of bodies) {
    let t = off;
    while (t < 15) {
      const bad = r.int(7), drop = r.chance(0.3) ? r.int(7) : -1;
      const f = EACH.map(([d, l], j): readonly [number | null, number] => [j === drop ? null : d !== null && j === bad ? d + r.pick([1, -1, 2]) : d, l * k]);
      t = b.fig(v, t, f, K, oct, g, { duty: v === 'p1' ? 1 : 2, ratio: 3.5 }, 0.85);
    }
  }
  [0, 4, 8, 12].forEach((t, i) => b.n('tri', t, fold(K([0, 6, 3, 0][i]), 34), 3.8, 0.38));
  return b.out();
}

function themeWhen(c: Ctx, K: Key): Section {
  const r = c.r, waitBars = r.chance(0.25) ? 2 : 1, b = new B(8 + 4 * waitBars, 4, c.bpm);
  const call = r.pick([WHEN_CALL, WHEN_CALL, shift(WHEN_CALL, -2), aug(WHEN_CALL, 1.5)]);
  const end = b.fig('bell', r.pick([0, 0.5, 1]), call, K, 1, 0.22, { ...MEL, ratio: 3.5 });
  b.n('tri', 0, fold(K(r.pick([0, 0, 5, 3])), 33), b.beats - 0.5, 0.35, { a: 0.8 });
  b.n('p2', end, K(r.pick([4, 2, 6])), 4 * waitBars - 0.5, 0.06, { duty: 2, a: 1 });
  // The answer comes only after the condition: a full bar or two of waiting.
  b.fig('air', end + 4 * waitBars, r.chance(0.3) ? shift(WHEN_ANSWER, -2) : WHEN_ANSWER, K, 1, 0.28, { ...MEL, a: 0.08 });
  return b.out();
}

function themeAgain(c: Ctx): Section {
  const r = c.r, b = new B(16, 4, c.bpm);
  const off = (c.pass * 0.0625) % 1;
  againLoop(b, 'p1', 0, 16, 81, 0.25, 0.2);
  againLoop(b, 'p2', off, 16, 81, 0.25 * 0.985, 0.17, { det: 6 });
  if (c.pass % 3 === 2) againLoop(b, 'bell', 0.125, 16, 93, 0.25 * 1.01, 0.08, { ratio: 2 });
  b.n('tri', 0, 45, 7.8, 0.4).n('tri', 8, r.pick([45, 46, 51]), 7.8, 0.4);
  for (let q = 0; q < 16; q++) b.hit(q, 'tock', 0.12, 0.05);
  return b.out({ still: true });
}

const D_LYD = key(62, MODE.lyd);

function themeOnce(c: Ctx): Section {
  const K = D_LYD, b = new B(16, 4, c.bpm);
  b.fig('air', 0, ONCE, K, 0, 0.36, { a: 0.1 }, 0.98);
  b.fig('bell', 0, ONCE, K, 1, 0.08, { ratio: 3.5 }, 0.9);
  [[0, 0, 4], [4, 4, 3], [8, 5, 3], [11, 0, 5]].forEach(([t, R, d]) => {
    b.n('tri', t, fold(K(R), 38), d - 0.1, 0.38, { a: 0.3 });
    b.n('p2', t, fold(K(R + 2), 57), d - 0.1, 0.09, { duty: 1, a: 0.3 });
  });
  return b.out({ still: true });
}

function drone(c: Ctx, K: Key): Section {
  const b = new B(16, 4, c.bpm);
  b.n('tri', 0, fold(K(0), 38), 16, 0.3, { a: 3 });
  b.n('air', 1 + c.r.int(3), K(c.r.pick([4, 4, 2, 7])), 12, 0.1, { a: 4 });
  if (c.r.chance(0.3)) b.n('bell', 4 + c.r.int(8), K(c.r.pick([0, 4, 2])) + 12, 3, 0.06, { ratio: 3.5 });
  return b.out({ still: true });
}

const themes = {
  theme_wait: { bpm: 64, start: 'a', vary: 0.5, wrong: 0.04, echo: 0.45, wobble: 7,
    graph: { a: [['b', 2], ['a', 1]], b: [['a', 2]] },
    secs: { a: (c: Ctx) => themeWait(c, D_AEO_LOW, false), b: (c: Ctx) => themeWait(c, D_AEO_LOW, true) } },
  theme_gloss: { bpm: 72, start: 'a', vary: 0.5, wrong: 0.04, echo: 0.4, wobble: 6,
    graph: { a: [['a', 1]] }, secs: { a: (c: Ctx) => themeGloss(c, key(64, MODE.dor)) } },
  theme_halt: { bpm: 76, start: 'a', vary: 0.3, wrong: 0.03, echo: 0.35, wobble: 4,
    graph: { a: [['a', 1]] }, secs: { a: (c: Ctx) => themeHalt(c, FS_HMIN) } },
  theme_each: { bpm: 92, start: 'a', vary: 0.2, wrong: 0.04, echo: 0.3, wobble: 6, spread: 12,
    graph: { a: [['a', 1]] }, secs: { a: (c: Ctx) => themeEach(c, BB_MIX) } },
  theme_when: { bpm: 66, start: 'a', vary: 0.4, wrong: 0.04, echo: 0.6, wobble: 7,
    graph: { a: [['a', 1]] }, secs: { a: (c: Ctx) => themeWhen(c, FS_LYD) } },
  theme_again: { bpm: 120, start: 'a', vary: 0, wrong: 0, echo: 0.15, wobble: 2,
    graph: { a: [['a', 1]] }, secs: { a: themeAgain } },
  theme_once: { bpm: 60, start: 'once', vary: 0, wrong: 0, echo: 0.6, wobble: 8,
    graph: { once: [['drone', 1]], drone: [['drone', 1]] },
    secs: { once: themeOnce, drone: (c: Ctx) => drone(c, D_LYD) } },
} satisfies Record<string, TrackDef>;

// ---------------------------------------------------------------- game over and credits

const gameover: TrackDef = {
  bpm: 60, start: 'fall', vary: 0, wrong: 0, echo: 0.6, wobble: 10,
  secs: {
    fall: () => {
      const K = A_AEO, b = new B(11, 4, 60);
      let t = 0;
      [0, -2, -4].forEach((s, i) => {
        const f = aug(shift(WAIT.slice(0, 2), s), 0.7 + i * 0.25);
        const end = b.fig('air', t, f, K, 1, 0.3 - i * 0.05, { a: 0.05 }, 0.95);
        b.n('tri', t, fold(K(s), 33) - (i === 2 ? 12 : 0), end - t + 0.4, 0.42);
        t = end + 0.5 + i * 0.25;
      });
      b.n('bell', t, K(0) + 12, 3, 0.1, { ratio: 3.5, bend: -1 });
      return b.out({ still: true });
    },
  },
};

const A_ION = key(57, MODE.ion);

function creditsEnd(): Section {
  const b = new B(16, 4, 66);
  // Wait's figure, and this time the third note lands, on the major third.
  b.fig('air', 0, [[4, 1.5], [3, 1]], A_AEO, 1, 0.34, { a: 0.06 }, 0.98);
  b.n('air', 2.5, A_ION(WAIT_THIRD) + 12, 9, 0.36, { a: 0.1 });
  b.n('bell', 2.5, A_ION(WAIT_THIRD) + 24, 4, 0.1, { ratio: 3.5 });
  b.n('tri', 0, 38, 2.4, 0.4).n('tri', 2.5, 33, 11, 0.42, { a: 0.2 });
  [[2.5, 57], [3, 64], [3.5, 69], [4, 76]].forEach(([t, p]) => b.n('p2', t, p, 8.5 - t, 0.09, { duty: 1, a: 0.3 }));
  b.n('bell', 12, A_ION(0) + 24, 4, 0.06, { ratio: 3.5 });
  return b.out({ still: true });
}

const credits: TrackDef = {
  bpm: 76, start: 'wait', vary: 0.3, wrong: 0, echo: 0.5, wobble: 7,
  graph: {
    wait: [['gloss', 1]], gloss: [['halt', 1]], halt: [['halt2', 1]], halt2: [['each', 1]], each: [['when', 1]],
    when: [['again', 1]], again: [['once', 1]], once: [['end', 1]],
  },
  secs: {
    wait: (c) => titleSec(c, WAIT, [0, 5, 3, 4], 'air', 1, false),
    gloss: (c) => themeGloss(c, A_AEO),
    halt: (c) => themeHalt(c, A_AEO),
    halt2: (c) => themeHalt(c, A_AEO),
    each: (c) => themeEach(c, A_AEO),
    when: (c) => themeWhen(c, A_AEO),
    again: (c) => { const s = themeAgain(c); s.ev = s.ev.filter((e) => e.t < 8).map((e) => ({ ...e, g: e.g * 0.6 })); s.beats = 8; return s; },
    once: (c) => { const s = themeOnce(c); return s; },
    end: creditsEnd,
  },
};

// ---------------------------------------------------------------- Act 2 motifs

/** Room: a child's question. It ends on a rising fifth to the ninth and does not come down. */
export const ROOM: Fig = [[0, 0.5], [2, 0.5], [1, 0.5], [3, 0.5], [2, 1], [null, 0.5], [4, 0.5], [8, 2]];
/** Room's answer: the same question, and then the ninth steps down to the octave. */
export const ROOM_ANSWER: Fig = [[0, 0.5], [2, 0.5], [1, 0.5], [3, 0.5], [2, 1], [null, 0.5], [4, 0.5], [8, 1], [7, 2]];
/** Stet's figure. A correction replaces one note, and then the original note comes back. */
export const STET_FIG: Fig = [[0, 1], [2, 1], [4, 1.5], [3, 0.5], [2, 1], [1, 1], [2, 2]];

/** Slows a section from the fraction `from` of its length to `slow` times the tempo at its end, as a spring runs out. */
export function windDown(sec: Section, from: number, slow: number): Section {
  const L = sec.beats, x0 = L * from, k = (1 - slow) / Math.max(1e-6, L - x0);
  const T = (x: number) => (x <= x0 ? x : x0 - Math.log(1 - k * (Math.min(x, L) - x0)) / k);
  const ev = sec.ev.map((e) => ({ ...e, t: T(e.t), d: T(e.t + e.d) - T(e.t) }));
  return { ...sec, ev, beats: T(L) };
}

// ---------------------------------------------------------------- Act 2: title card, the night, Busy seven years on

const actTwoTitle: TrackDef = {
  bpm: 64, start: 'card', vary: 0, wrong: 0, echo: 0.55, wobble: 8,
  secs: {
    card: () => {
      const K = A_AEO, b = new B(9, 4, 64);
      b.n('air', 0, K(4) + 12, 1.45, 0.32, { a: 0.06 });
      // The second note holds through the place where the third should land.
      b.n('air', 1.5, K(3) + 12, 2.6, 0.3, { a: 0.04 });
      b.n('tri', 0, 33, 4, 0.38, { a: 0.3 });
      b.fig('bell', 4.4, GLOSS, K, 1, 0.12, { ratio: 3.5 });
      return b.out({ still: true });
    },
  },
};

const D_AEO_NIGHT = key(50, MODE.aeo);

function nightSec(c: Ctx, kind: 'night' | 'still'): Section {
  const K = D_AEO_NIGHT, r = c.r;
  if (kind === 'still') {
    const b = new B(r.pick([8, 8, 12]), 4, c.bpm);
    b.n('tri', 0, r.pick([38, 38, 36, 41]), b.beats, 0.24, { a: 2 });
    const n = r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', 1 + r.int(12) * 0.5, K(r.pick([7, 9, 11, 4, 6])) + 12, 3, 0.06, { ratio: 3.5 });
    return b.out();
  }
  const b = new B(20, 4, c.bpm);
  // Gloss's phrase, slowed, with one note held far too long.
  const held = 1 + r.int(GLOSS.length - 1), extra = r.pick([2, 3, 4]);
  let t = 0;
  GLOSS.forEach(([d, l], i) => {
    if (d === null) { t += l * 2; return; }
    const len = l * 2 + (i === held ? extra : 0);
    b.n('air', t, K(d) + 12, len * 0.97, 0.24, { a: 0.15, bend: i === held && r.chance(0.3) ? -0.5 : 0 });
    t += len;
  });
  b.n('tri', 0, 38, 10, 0.26, { a: 1.5 }).n('tri', 10, r.pick([38, 41, 36]), 9.5, 0.24, { a: 1.5 });
  if (r.chance(0.5)) b.n('bell', 16 + r.int(6) * 0.5, K(4) + 24, 2, 0.05, { ratio: 3.5 });
  return b.out();
}

const prologueNight: TrackDef = {
  bpm: 50, start: 'night', vary: 0.2, wrong: 0.02, echo: 0.6, wobble: 10,
  graph: { night: [['still', 2], ['night', 1]], still: [['night', 3], ['still', 1]] },
  secs: { night: (c) => nightSec(c, 'night'), still: (c) => nightSec(c, 'still') },
};

function busy7Sec(c: Ctx, figs: Fig[] | null, base: number[]): Section {
  const K = D_DOR, r = c.r, bar = 3.5, b = new B(bar * 4, bar, c.bpm);
  const roots = prog(r, base, BUSY_SUBS, 0.3);
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar, R = roots[i], ch = chord(K, R, 3).map((p) => fold(p, 62));
    if (figs) b.line('p1', t0, realize(figs[i], K, 0), 0.3, { ...MEL, duty: 3 }, 0.8);
    const root = fold(K(R), 38);
    b.n('tri', t0, root, 1.4, 0.42).n('tri', t0 + 2, root + 7, 1.4, 0.36);
    b.n('p2', t0 + 1, ch[1 + (i % 2)], 0.45, 0.11, { duty: 2 });
    if (r.chance(0.45)) b.n('bell', t0 + r.pick([0.5, 1.5, 2.5]), K(r.pick([7, 9, 11])) + 12, 0.8, 0.07, { ratio: 4 });
  }
  if (!figs) b.fig('bell', 0, retro(WAIT), K, 1, 0.12, { ratio: 3.5, ...MEL });
  // A music box tick for each of the sixteen children: sixteen ticks across the four bars, against the 7/8.
  for (let k = 0; k < 16; k++) b.hit(k * 0.875, 'tick', k % 4 === 0 ? 0.08 : 0.05, 0.04);
  // Every so often one voice stops at a bar line and does not come back this pass.
  if (r.chance(0.55)) {
    const v = r.pick(['p1', 'p2', 'tri', 'bell'] as Voice[]), at = (1 + r.int(3)) * bar;
    b.ev = b.ev.filter((e) => !(e.v === v && e.t >= at - 1e-6));
  }
  return b.out();
}

const busy7: TrackDef = {
  bpm: 80, start: 'a', vary: 0.5, wrong: 0.05, echo: 0.3, wobble: 7, spread: 9,
  graph: { a: [['b', 3], ['c', 1], ['a', 1]], b: [['a', 2], ['c', 2]], c: [['a', 3], ['b', 1]] },
  secs: {
    a: (c) => busy7Sec(c, BUSY_A, [0, 3, 0, 1]),
    b: (c) => busy7Sec(c, BUSY_B, [6, 4, 2, 0]),
    c: (c) => busy7Sec(c, null, [0, 6, 0, 6]),
  },
};

function nursery7Sec(c: Ctx, kind: 'box' | 'wind'): Section {
  if (kind === 'wind') {
    // Winding the box: a few turns of a ratchet, then a breath.
    const turns = 2 + c.r.int(3), clicks = 3 + c.r.int(3), gap = c.r.range(0.9, 1.3), b = new B(turns * gap + 1.5, 4, 60);
    for (let k = 0; k < turns; k++) for (let q = 0; q < clicks; q++) b.hit(k * gap + q * 0.14, 'tick', 0.05 + q * 0.012, 0.03);
    if (c.r.chance(0.4)) b.n('bell', turns * gap + 0.5, F_ION(c.r.pick([4, 0, 2])) + 12, 0.8, 0.06, { ratio: 4 });
    return b.out();
  }
  // More teeth are broken now, and the spring runs out before the tune ends.
  return windDown(nurserySec(c, 'box', 6), 0.5, 0.35);
}

const nursery7: TrackDef = {
  bpm: 66, start: 'box', vary: 0.25, wrong: 0.05, echo: 0.6, wobble: 16,
  graph: { box: [['wind', 1]], wind: [['box', 1]] },
  secs: { box: (c) => nursery7Sec(c, 'box'), wind: (c) => nursery7Sec(c, 'wind') },
};

// ---------------------------------------------------------------- Act 2: the low river, Twice in one body, Stet, Every

function riverLowSec(c: Ctx, kind: 'a' | 'b' | 'gap'): Section {
  const K = G_LYD, r = c.r;
  if (kind === 'gap') {
    const b = new B(r.pick([6, 9, 12]), 3, c.bpm);
    b.n('tri', r.pick([0, 0.5, 1.5]), fold(K(r.pick([0, 1, 4, 5, 2])), 31), r.pick([2.6, 4, 5.5]), 0.3, { a: 0.3 });
    if (r.chance(0.4)) b.n('air', r.pick([1.5, 3, 4.5]), K(r.pick([4, 2, 6, 1])), 3, 0.12, { a: 0.8, ...MEL });
    if (r.chance(0.3)) b.n('bell', r.int(10) * 0.5, K(r.pick([7, 9, 11])), 1.5, 0.07, { ratio: 2.4, bend: -2 });
    return b.out();
  }
  const b = new B(12, 3, c.bpm);
  // The river in retrograde: the progression, the arpeggio, and the melody all run backward.
  const roots = prog(r, [1, 0, 1, 0], { 0: [0, 2, 5], 1: [1, 6] }, 0.3);
  const shape = [...r.pick([[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 1], [0, 1, 2, 3, 4, 2]])].reverse();
  for (let i = 0; i < 2; i++) {
    const t0 = i * 3, tones = chord(K, roots[i], 5);
    for (let j = 0; j < 6; j++) b.n('p2', t0 + j * 0.5, fold(tones[0], 50) + (tones[shape[j]] - tones[0]), 0.45, j === 0 ? 0.16 : 0.11, { duty: 1 });
    b.n('tri', t0, fold(K(roots[i]), 31), 2.8, 0.42);
  }
  b.n('tri', 6, fold(K(roots[2]), 31), 5.5, 0.3, { a: 0.4 });
  b.fig(kind === 'a' ? 'p1' : 'air', 0, retro(kind === 'a' ? inv(WAIT, 3) : GLOSS), K, 0, 0.28, { ...MEL, duty: 3, a: 0.05 });
  return b.out();
}

const riverLow: TrackDef = {
  bpm: 76, start: 'a', vary: 0.5, wrong: 0.05, echo: 0.55, wobble: 9,
  graph: { a: [['gap', 3], ['b', 1]], b: [['gap', 3], ['a', 1]], gap: [['a', 2], ['b', 2], ['gap', 1]] },
  secs: { a: (c) => riverLowSec(c, 'a'), b: (c) => riverLowSec(c, 'b'), gap: (c) => riverLowSec(c, 'gap') },
};

const TWICE_CADENCES: Fig[] = [
  [[4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 1]],
  [[4, 0.5], [5, 0.5], [4, 1], [2, 1], [0, 1]],
  [[3, 1], [2, 1], [1, 1], [0, 1]],
];

function twiceOneSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const K = BB_MIX, r = c.r, b = new B(kind === 'c' ? 8 : 16, 4, c.bpm);
  const roots = prog(r, kind === 'b' ? [3, 0, 6, 4] : [0, 6, 3, 0], { 0: [0, 5], 6: [6, 4], 3: [3, 1] }, 0.35);
  const hats = r.pick([[0.5, 1.5, 2.5, 3.5], [0.5, 1.5, 2.5, 3, 3.5], [1, 3]]);
  const walk = r.pick([[0, 7, 0, 7], [0, 12, 7, 12], [0, 0, 7, 0]]);
  for (let i = 0; i < b.beats / 4; i++) {
    const low = fold(K(roots[i]), 38);
    walk.forEach((o, j) => b.n('tri', i * 4 + j, low + o, 0.45, 0.48));
    hats.forEach((o) => b.hit(i * 4 + o, 'hat', 0.07, 0.06));
    b.hit(i * 4, 'tick', 0.12, 0.05);
  }
  // One body now: both pulses play the line in exact unison and in tune, and the canon voice is gone.
  const one = { duty: 1, det: 0 };
  if (kind === 'a') {
    const phrase: Fig = [...EACH, ...shift(EACH, r.pick([2, 2, 1, 3])), ...r.pick(TWICE_CADENCES), [null, 1], ...WAIT.slice(0, 2), [null, 0.5]];
    b.fig('p1', 0, phrase, K, 0, 0.3, one);
    b.fig('p2', 0, phrase, K, 0, 0.26, one);
  } else if (kind === 'b') {
    const phrase: Fig = [...shift(EACH, r.pick([4, 3])), [5, 1], [4, 1], [2, 2], ...inv(EACH, 2), [0, 2], [null, 2]];
    b.fig('p1', 0, phrase, K, 0, 0.3, one);
    b.fig('p2', 0, phrase, K, 0, 0.26, one);
  } else {
    b.fig('bell', r.pick([0, 0.5, 1]), shift(r.pick([retro(EACH), EACH, inv(EACH, 2)]), r.pick([0, 2, -2])), K, 1, 0.14, { ratio: 3.5 });
  }
  return b.out();
}

const twiceOne: TrackDef = {
  bpm: 104, start: 'a', vary: 0, wrong: 0.03, echo: 0.2, wobble: 0, spread: 0,
  graph: { a: [['b', 3], ['a', 1], ['c', 1]], b: [['a', 3], ['c', 1]], c: [['a', 2], ['b', 2]] },
  secs: { a: (c) => twiceSec(c, 'a', true), b: (c) => twiceSec(c, 'b', true), c: (c) => twiceSec(c, 'c', true) },
};

const BB_ION = key(58, MODE.ion);

function stetThemeSec(c: Ctx): Section {
  const K = BB_ION, r = c.r, b = new B(18, 4, c.bpm);
  const fig = r.chance(0.35) ? shift(STET_FIG, r.pick([2, -1])) : STET_FIG;
  const k = 1 + r.int(fig.length - 1);
  let t = 0;
  fig.forEach(([d, l], i) => {
    if (d === null) { t += l; return; }
    const p = K(d) + 12;
    if (i === k) {
      // The correction: a wrong note in a hard voice, a pause, and then the original note stands again.
      b.n('p1', t, p + r.pick([1, -1, 6, 2]), 0.45, 0.18, { duty: 0 });
      t += 1;
    }
    b.n('air', t, p, l * 0.95, 0.28, { a: 0.06, ...MEL });
    t += l;
  });
  b.fig('bell', 10, r.chance(0.5) ? STET_FIG : retro(STET_FIG), K, 1, 0.11, { ratio: 3.5, ...MEL });
  [[0, 0, 4], [4, 5, 2], [6, 3, 3], [9, 4, 1], [10, 0, 4], [14, 3, 2], [16, 4, 2]].forEach(([at, R, d]) => {
    b.n('tri', at, fold(K(R), 34), d - 0.1, 0.36, { a: 0.05 });
    for (let q = 0; q < d; q++) if (r.chance(0.7)) b.n('p2', at + q + 0.5, fold(K(R + 2 * ((q % 2) + 1)), 55), 0.45, 0.07, { duty: 1 });
  });
  return b.out();
}

const themeStet: TrackDef = {
  bpm: 66, start: 'a', vary: 0.35, wrong: 0.02, echo: 0.4, wobble: 6,
  graph: { a: [['a', 1]] }, secs: { a: stetThemeSec },
};

function everySec(c: Ctx): Section {
  const K = BB_MIX, r = c.r, b = new B(12, 4, c.bpm);
  const bodies: Array<[Voice, number, number]> = [['p1', 1, 0.28], ['p2', 1, 0.22], ['air', 0, 0.2], ['tri', -1, 0.36]];
  // I: every voice on one line at one moment.
  for (const [v, oct, g] of bodies) b.fig(v, 0, EACH, K, oct, g, { duty: 1, det: 0 }, 0.85);
  // We: for one bar the line splits into bodies that start late, stretch, and land on other notes.
  const parts: Array<[Voice, number, number, number, number, number]> = [
    ['p1', 1, 0.26, 0, 1, 0], ['p2', 1, 0.2, 0.25, 0.9, 2], ['bell', 2, 0.1, 0.5, 1.1, -2], ['bell', 1, 0.1, 0.875, 0.8, 4],
    ['air', 0, 0.18, 0.375, 1.05, -1], ['tri', -1, 0.32, 0.125, 0.95, 0],
  ];
  for (const [v, oct, g, off, k, sh] of parts) {
    const f = shift(EACH, sh).map(([d, l]): readonly [number | null, number] => [d !== null && r.chance(0.12) ? d + 1 : d, l * k]);
    b.fig(v, 4 + off, f, K, oct, g, { duty: 2, ratio: 3.5, det: r.int(9) - 4 }, 0.8);
  }
  // I again.
  const back = r.chance(0.3) ? shift(EACH, r.pick([2, -1])) : EACH;
  for (const [v, oct, g] of bodies) b.fig(v, 8, back, K, oct, g, { duty: 1, det: 0 }, 0.85);
  return b.out();
}

const themeEvery: TrackDef = {
  bpm: 84, start: 'a', vary: 0, wrong: 0.03, echo: 0.3, wobble: 2, spread: 0,
  graph: { a: [['a', 1]] }, secs: { a: everySec },
};

// ---------------------------------------------------------------- Act 2: Room, and the Ears facing up

const C_ION = key(60, MODE.ion);

function roomSec(c: Ctx, kind: 'ask' | 'answer' | 'small'): Section {
  const K = C_ION, r = c.r;
  if (kind === 'small') {
    const b = new B(8, 4, c.bpm);
    const bits = notesOf(ROOM);
    const n = 2 + r.int(3);
    for (let i = 0; i < n; i++) { const [d] = bits[r.int(bits.length)]; b.n('bell', 0.5 + r.int(12) * 0.5, K(d ?? 0) + 12, 1.5, 0.12, { ratio: 4, ...MEL }); }
    b.n('p2', 0, K(r.pick([0, 3, 5])) - 12, 3.5, 0.05, { duty: 2, a: 0.4 });
    return b.out();
  }
  const b = new B(kind === 'answer' ? 15 : 14, 4, c.bpm);
  const lead: Voice = r.chance(0.7) ? 'bell' : 'p2';
  const first = r.chance(0.3) ? aug(ROOM, 1.25) : ROOM;
  // Room's figures stay out of the automatic variation: a dropped last note would lose the question.
  b.fig(lead, 0, first, K, 1, lead === 'bell' ? 0.2 : 0.15, { ratio: 4, duty: 2 });
  b.n('p1', 0, K(0) - 12, 3.8, 0.06, { duty: 2, a: 0.1 }).n('p1', 4, K(r.pick([3, 5])) - 12, 3.8, 0.06, { duty: 2, a: 0.1 });
  if (kind === 'ask') {
    // The child asks again, a step higher, and still nobody answers.
    b.fig(lead === 'bell' ? 'p2' : 'bell', 7.5, shift(ROOM, r.pick([1, 0, 2])), K, 1, 0.15, { ratio: 4, duty: 2 });
    b.n('p1', 8, K(r.pick([1, 4])) - 12, 5.5, 0.06, { duty: 2, a: 0.1 });
  } else {
    const av: Voice = lead === 'bell' && r.chance(0.4) ? 'p2' : 'bell';
    b.fig(av, 7.5, r.chance(0.3) ? aug(ROOM_ANSWER, 1.1) : ROOM_ANSWER, K, 1, av === 'bell' ? 0.2 : 0.15, { ratio: 4, duty: 2 });
    // At the answer the bass comes in for the first time.
    b.n('tri', 13, K(0) - r.pick([24, 12]), 2, 0.4, { a: 0.2 }).n('air', 13, K(r.pick([2, 4, 7])), 2, 0.14, { a: 0.3 });
    b.n('p1', 8, K(r.pick([4, 3, 5])) - 12, 4.8, 0.06, { duty: 2, a: 0.1 });
    if (r.chance(0.4)) b.n(av === 'bell' ? 'p2' : 'bell', 13.5, K(r.pick([7, 9, 11])) + 12, 1.2, 0.06, { ratio: 4, duty: 2 });
  }
  return b.out();
}

const themeRoom: TrackDef = {
  bpm: 76, start: 'ask', vary: 0.4, wrong: 0.03, echo: 0.5, wobble: 7,
  graph: { ask: [['ask', 2], ['small', 1]], small: [['ask', 1]] },
  secs: { ask: (c) => roomSec(c, 'ask'), small: (c) => roomSec(c, 'small') },
};

const themeRoomAnswer: TrackDef = {
  bpm: 76, start: 'answer', vary: 0.4, wrong: 0.02, echo: 0.5, wobble: 7,
  graph: { answer: [['answer', 2], ['small', 1]], small: [['answer', 1]] },
  secs: { answer: (c) => roomSec(c, 'answer'), small: (c) => roomSec(c, 'small') },
};

function earsUpSec(c: Ctx, kind: 'call' | 'sky'): Section {
  const K = FS_LYD, r = c.r, b = new B(16, 4, c.bpm);
  b.n('tri', 0, 42, 8, 0.36, { a: 1 }).n('tri', 8, r.pick([42, 47, 49]), 8, 0.36, { a: 1 });
  const sweeps = 1 + r.int(2);
  for (let i = 0; i < sweeps; i++) b.hit(r.int(12), 'sweep', 0.1, 2 + r.int(3), { n: 40, a: 0.5 });
  const word = K(4) + 12;
  if (kind === 'call') {
    const end = b.fig('air', r.pick([0, 0.5, 1]), r.chance(0.3) ? shift(WHEN_CALL, -2) : WHEN_CALL, K, 1, 0.26, { ...MEL, a: 0.05 });
    // The sky answers after the bar of waiting, with one word: the same note, again and again.
    const n = 3 + r.int(3);
    for (let i = 0; i < n; i++) b.n('p2', end + 4 + i, word, 0.5, 0.15 - i * 0.012, { duty: 2 });
  } else {
    for (let t = r.pick([0, 1]); t < 16; t += 2) if (!r.chance(0.2)) b.n('p2', t, word, 0.5, 0.11, { duty: 2 });
    if (r.chance(0.6)) b.n('bell', 2 + r.int(10), K(r.int(7)) + 12, 2, 0.08, { ratio: 3.5, ...MEL });
  }
  return b.out();
}

const earsUp: TrackDef = {
  bpm: 63, start: 'call', vary: 0.4, wrong: 0.03, echo: 0.65, wobble: 8,
  graph: { call: [['sky', 2], ['call', 2]], sky: [['call', 3]] },
  secs: { call: (c) => earsUpSec(c, 'call'), sky: (c) => earsUpSec(c, 'sky') },
};

// ---------------------------------------------------------------- Act 2: the Line, inside the Scrivener, the quill

const LOOSE: Fig[] = [WAIT.slice(0, 2), GLOSS.slice(0, 4), HALT.slice(0, 2), EACH.slice(0, 4), WHEN_CALL, ONCE.slice(0, 4), ROOM.slice(0, 5), STET_FIG.slice(0, 3)];

function lineSec(c: Ctx, kind: 'road' | 'drift'): Section {
  const K = D_LYD, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, [0, 1, 0, 4], { 0: [0, 2], 1: [1, 5], 4: [4, 3] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 3, tones = chord(K, R, 4).map((p) => fold(p, 62));
    b.n('p2', t0, tones[0], 1.3, 0.1, { duty: 1 }).n('p2', t0 + 1.5, tones[r.pick([1, 2, 3])], 1, 0.08, { duty: 1 });
    if (r.chance(0.5)) b.n('p2', t0 + 2.5, tones[r.pick([2, 3])] + 12, 0.4, 0.07, { duty: 1 });
    if (kind === 'road' || i % 2 === 0) b.n('tri', t0, fold(K(R), 38), kind === 'road' ? 2.8 : 5.5, 0.3, { a: 0.1 });
  });
  if (kind === 'drift') b.n('air', 0, K(r.pick([4, 6, 2])) + 12, 11, 0.09, { a: 2 });
  // Loose asides drift past: a few notes of every character's figure, in whatever voice catches them.
  const frags = kind === 'road' ? 1 + r.int(2) : 2 + r.int(2);
  for (let i = 0; i < frags; i++) {
    const v: Voice = r.chance(0.7) ? 'bell' : 'p1';
    b.fig(v, r.int(14) * 0.5, shift(r.pick(LOOSE), r.pick([0, 2, 4, -3])), K, v === 'bell' ? r.pick([1, 2]) : 1, 0.12, { ratio: 3.5, duty: 3, ...MEL });
  }
  if (kind === 'road') { const n = 2 + r.int(3); for (let i = 0; i < n; i++) b.n('bell', r.int(24) * 0.5, K(7 + r.int(7)) + 12, 1.5, 0.08, { ratio: 3.5 }); }
  return b.out();
}

const line: TrackDef = {
  bpm: 72, start: 'road', vary: 0.5, wrong: 0.04, echo: 0.7, wobble: 7,
  graph: { road: [['drift', 2], ['road', 2]], drift: [['road', 3], ['drift', 1]] },
  secs: { road: (c) => lineSec(c, 'road'), drift: (c) => lineSec(c, 'drift') },
};

function scrivenerSec(c: Ctx, kind: 'file' | 'rail'): Section {
  const K = B_AEO, r = c.r, b = new B(kind === 'rail' ? 8 : 16, 4, c.bpm);
  // The drone is one word said very slowly: the same low note, struck again every two bars.
  for (let t = 0; t < b.beats; t += 8) b.n('tri', t, 35, 7.6, 0.4, { a: 0.05 });
  b.n('air', 0, 47, b.beats - 0.5, 0.07, { a: 2 });
  // Filing arms on rails: a tock every few sixteenths against steady sixteenth ticks.
  const arm = kind === 'rail' ? r.pick([0.75, 1.25, 1.5]) : 0.75;
  for (let t = 0; t < b.beats; t += 0.25) b.hit(t, t % arm === 0 ? 'tock' : 'tick', t % arm === 0 ? 0.1 : 0.035, 0.03);
  if (r.chance(0.5)) b.hit(r.pick([0, 4, 2, 6]), 'stamp', 0.14, 0.3);
  if (kind === 'rail' && r.chance(0.5)) b.n('bell', r.int(14) * 0.5, K(r.pick([0, 2, 4, 7])) + 24, 1, 0.05, { ratio: 3 });
  if (kind === 'file') {
    if (c.st.shape === undefined || c.pass % 4 === 0) c.st.shape = r.int(SCRIV.length);
    const shape = SCRIV[c.st.shape];
    prog(r, [0, 5, 3, 4], { 0: [0, 3], 5: [5, 2], 4: [4, 6] }, 0.25).forEach((R, i) => {
      const tones = chord(K, R, 4).map((p) => fold(p, 59) + 12);
      scriv(b, 'p2', i * 4, 4, tones, shape, 0.12, { duty: 1 });
      b.n('bell', i * 4, tones[3] + 12, 1.5, 0.07, { ratio: 3 });
    });
  }
  return b.out();
}

const scrivener: TrackDef = {
  bpm: 96, start: 'file', vary: 0.15, wrong: 0.02, echo: 0.3, wobble: 2,
  graph: { file: [['file', 3], ['rail', 1]], rail: [['file', 1]] },
  secs: { file: (c) => scrivenerSec(c, 'file'), rail: (c) => scrivenerSec(c, 'rail') },
};

const E_DOR = key(52, MODE.dor);

function quillSec(c: Ctx, kind: 'confess' | 'silence'): Section {
  const K = E_DOR, r = c.r;
  if (kind === 'silence') {
    const b = new B(r.pick([8, 12]), 4, c.bpm);
    if (r.chance(0.3)) b.n('air', 2 + r.int(4), K(r.pick([0, 4])) + 12, 4, 0.06, { a: 1.5 });
    return b.out();
  }
  const b = new B(24, 4, c.bpm);
  // The phrase on the bell, slow, with no parenthesis after it. Sometimes it stops before the end.
  const stopAt = r.chance(0.35) ? 3 + r.int(3) : GLOSS.length;
  let t = 0;
  GLOSS.forEach(([d, l], i) => {
    if (i >= stopAt || d === null) return;
    b.n('bell', t, K(d) + 12, l * 2 + 1, 0.16, { ratio: 3.5, ...MEL });
    t += l * 2 + (r.chance(0.25) ? 0.5 : 0);
  });
  b.n('tri', 0, 40, 8, 0.22, { a: 1 });
  b.n('air', 0, K(r.pick([2, 4])), 7, 0.06, { a: 2 });
  if (r.chance(0.5)) b.n('bell', 14 + r.int(6), K(r.pick([0, 2])) + 12, 3, 0.06, { ratio: 3.5 });
  return b.out();
}

const quill: TrackDef = {
  bpm: 56, start: 'confess', vary: 0.25, wrong: 0.02, echo: 0.7, wobble: 8,
  graph: { confess: [['silence', 2], ['confess', 1]], silence: [['confess', 3], ['silence', 1]] },
  secs: { confess: (c) => quillSec(c, 'confess'), silence: (c) => quillSec(c, 'silence') },
};

// ---------------------------------------------------------------- Act 2: battle, the Closer, the Corrector, Over

/** Plays line a until `cut`, then line `over` from `cut` on, as if it were written over a. */
function overwrite(b: B, v: Voice, t0: number, a: Line, over: Line, cut: number, g: number, x: Partial<Ev>, xo: Partial<Ev>, leg = 0.88) {
  let t = 0;
  for (const [p, l] of a) { if (p !== null && t < cut) b.n(v, t0 + t, p, Math.min(l * leg, cut - t), g, x); t += l; }
  t = 0;
  for (const [p, l] of over) {
    const s = Math.max(t, cut), e = t + l;
    if (p !== null && e > cut) b.n(v, t0 + s, p, (e - s) * leg, g, xo);
    t += l;
  }
}

const BAT_ALL: Fig[] = [...BAT_A, ...BAT_B, ...BAT_C];

function battle2Sec(c: Ctx, part: 'a' | 'b' | 'c'): Section {
  const K = D_AEO, r = c.r, bar = 3.5, b = new B(14, bar, c.bpm);
  const figs = part === 'a' ? BAT_A : part === 'b' ? BAT_B : BAT_C;
  const roots = r.pick(BAT_PROGS[part]);
  const over = new Set([r.int(4)]);
  if (r.chance(0.4)) over.add(r.int(4));
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar, root = 38 + roots[i], tones = triad(62, roots[i]).map((p) => fold(p, 57));
    [0, 12, 0, 7, 12, 0, 7].forEach((o, j) => b.n('tri', t0 + j * 0.5, root + o, 0.42, j === 0 || j === 3 || j === 5 ? 0.58 : 0.44));
    b.hit(t0, 'kick', 0.4, 0.2).hit(t0 + 1.5, 'snare', 0.26, 0.15).hit(t0 + 2.5, 'kick', 0.3, 0.2);
    for (let j = 0; j < 7; j++) b.hit(t0 + j * 0.5, 'hat', j % 2 ? 0.06 : 0.1, 0.05, { lay: 0.35 });
    const ln = realize(figs[i], K, 0);
    if (over.has(i)) {
      // Written over: partway through the bar another phrase takes the line, with a scratch of the pen.
      const cut = r.pick([1, 1.5, 2]);
      overwrite(b, 'p1', t0, ln, realize(r.pick(BAT_ALL.filter((f) => f !== figs[i])), K, 0), cut, 0.32, { ...MEL, duty: 1 }, { duty: 0, det: -12 });
      b.hit(t0 + cut, 'tick', 0.3, 0.04);
    } else b.line('p1', t0, ln, 0.32, { ...MEL, duty: 1 }, 0.88);
    b.line('bell', t0, ln.map(([p, l]) => [p === null ? null : p + 12, l]), 0.09, { ratio: 3.5, lay: 0.6 }, 0.8);
    [0.5, 2, 3].forEach((o, j) => b.n('p2', t0 + o, tones[(j + i) % 3], 0.3, 0.15, { duty: 2, top: 0.85 }));
    for (let j = 0; j < 14; j++) b.n('p2', t0 + j * 0.25, tones[[0, 1, 2, 1][j % 4]] + (j % 7 === 6 ? 12 : 0), 0.2, 0.12, { duty: 1, lay: 0.85 });
  }
  return b.out();
}

const battle2: TrackDef = {
  bpm: 148, start: 'a', vary: 0.5, wrong: 0.05, echo: 0.18, wobble: 5, spread: 8,
  graph: battleGraph,
  secs: { a: (c) => battle2Sec(c, 'a'), b: (c) => battle2Sec(c, 'b'), c: (c) => battle2Sec(c, 'c') },
};

const G_HMIN = key(55, MODE.hmin);
// March phrases of two bars. The last beat of each is the tonic, and the Closer never lets it sound.
const CLOSER_PHRASES: Fig[] = [
  [[0, 1], [0, 0.5], [1, 0.5], [2, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 1]],
  [[4, 1], [3, 0.5], [2, 0.5], [3, 1], [1, 1], [2, 1], [0, 1], [-1, 1], [0, 1]],
  [[2, 1.5], [1, 0.5], [0, 1], [-3, 1], [0, 1], [2, 1], [-1, 1], [0, 1]],
  [[2, 0.5], [4, 0.5], [3, 1], [1, 0.5], [2, 0.5], [0, 1], [4, 1], [3, 1], [-1, 1], [0, 1]],
];

function closerSec(c: Ctx): Section {
  const K = G_HMIN, r = c.r, b = new B(14, 7, c.bpm);
  for (const p0 of [0, 7]) {
    const ph = shift(r.pick(CLOSER_PHRASES), r.pick([0, 0, 2]));
    const s = new B(8, 4, c.bpm);
    s.fig('p1', 0, ph, K, 1, 0.32, { ...MEL, duty: 3 }, 0.9);
    s.fig('bell', 0, ph, K, 2, 0.08, { ratio: 1.41, lay: 0.6 }, 0.8);
    r.pick([[0, 4], [3, 4], [5, 4], [0, 3]]).forEach((R, i) => {
      const low = fold(K(R), 38), ch = chord(K, R, 3).map((p) => fold(p, 60));
      [0, 1, 2, 3].forEach((j) => s.n('tri', i * 4 + j, j % 2 ? low + 7 : low, 0.7, 0.52));
      [0.5, 1.5, 2.5, 3.5].forEach((o, j) => s.n('p2', i * 4 + o, ch[j % 3], 0.35, 0.14, { duty: 2, top: 0.85 }));
      for (let j = 0; j < 16; j++) s.n('p2', i * 4 + j * 0.25, ch[j % 3] + (j % 8 === 7 ? 12 : 0), 0.2, 0.11, { duty: 1, lay: 0.85 });
      s.hit(i * 4, 'kick', 0.42, 0.2).hit(i * 4 + 1, 'snare', 0.24, 0.15).hit(i * 4 + 2, 'kick', 0.36, 0.2).hit(i * 4 + 3, 'snare', 0.24, 0.15);
      for (let j = 0; j < 8; j++) s.hit(i * 4 + j * 0.5, 'hat', 0.07, 0.05, { lay: 0.35 });
    });
    // The book closes one beat early: the last beat is cut away, and the next phrase starts on a slam.
    for (const e of s.ev) if (e.t < 7 - 1e-6) b.ev.push({ ...e, t: e.t + p0, d: Math.min(e.d, 7 - e.t) });
    b.hit(p0, 'stamp', 0.5, 0.3);
  }
  return b.out();
}

const bossCloser: TrackDef = {
  bpm: 100, start: 'close', vary: 0.45, wrong: 0.03, echo: 0.2, wobble: 4,
  graph: { close: [['close', 1]] },
  secs: { close: closerSec },
};

function correctorSec(c: Ctx): Section {
  const K = E_PDOM, r = c.r, b = new B(16, 4, c.bpm);
  const x = c.st.x ?? 0;
  c.st.x = (x + 1) % 3;
  if (x === 1) { c.st.a = r.int(2); c.st.b = r.int(2); }
  const A: Voice = c.st.a ? 'p1' : 'p2', Bv: Voice = c.st.b ? 'tri' : 'air';
  const mel: Fig = [...EACH, ...shift(EACH, r.pick([2, 1, 3])), ...inv(EACH, r.pick([3, 4])), ...r.pick(TWICE_CADENCES)];
  const cell = r.pick([[0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 4, 0, 1, 0], [0, 0, 0, 1, 0, 0, 3, 1]]);
  const bass: Line = [];
  for (let i = 0; i < 32; i++) bass.push([K(cell[i % 8]) - 12, 0.5]);
  // Each pair is an original and its copy. Each pass the strip crosses out one more copy, and then it restores both.
  b.fig('p1', 0, mel, K, 1, 0.3, { duty: 1 }, 0.88);
  b.fig('p2', 0, mel, K, 1, 0.26, { duty: 1, det: 14 }, 0.88);
  b.line('tri', 0, bass, 0.5, {}, 0.8);
  b.line('air', 0, bass.map(([p, l]) => [p === null ? null : p + 12, l]), 0.14, { a: 0.02 }, 0.8);
  const cross = 4 + 4 * r.int(3);
  const cutA = x === 1 ? cross : x === 2 ? 0 : 99, cutB = x === 2 ? cross : 99;
  b.ev = b.ev.filter((e) => !(e.v === A && e.t >= cutA - 1e-6) && !(e.v === Bv && e.t >= cutB - 1e-6));
  for (let i = 0; i < 4; i++) {
    b.hit(i * 4, 'kick', 0.4, 0.2).hit(i * 4 + 1, 'snare', 0.24, 0.15).hit(i * 4 + 2, 'kick', 0.34, 0.2).hit(i * 4 + 3, 'snare', 0.24, 0.15);
    for (let j = 0; j < 8; j++) b.hit(i * 4 + j * 0.5, 'hat', 0.07, 0.05, { lay: 0.35 });
  }
  if (x === 0) b.hit(0, 'sweep', 0.5, 1, { n: 40 });
  if (cutA > 0 && cutA < 16) b.hit(cutA, 'sweep', 0.5, 1, { n: 90 });
  if (cutB < 16) b.hit(cutB, 'sweep', 0.5, 1, { n: 90 });
  return b.out();
}

const bossCorrector: TrackDef = {
  bpm: 126, start: 'strip', vary: 0.3, wrong: 0.04, echo: 0.2, wobble: 4,
  graph: { strip: [['strip', 1]] },
  secs: { strip: correctorSec },
};

const D_PHR = key(62, MODE.phr);
const OVER_CELLS: Fig[] = [
  [[0, 0.5], [2, 0.5], [1, 0.5], [3, 0.5], [2, 1], [4, 0.5], [8, 1.5]],
  [[4, 0.75], [3, 0.75], [null, 0.5], [4, 0.5], [3, 0.5], [1, 1], [0, 1]],
  [[2, 0.5], [4, 0.5], [3, 0.5], [1, 0.5], [2, 0.5], [0, 0.5], [1, 0.5], [2, 0.5], [4, 1]],
  [[7, 0.5], [6, 0.5], [4, 0.5], [5, 0.5], [3, 0.5], [4, 0.5], [2, 0.5], [3, 0.5], [1, 1]],
];

function overSec(c: Ctx): Section {
  const K = D_PHR, r = c.r, b = new B(16, 4, c.bpm);
  for (let i = 0; i < 4; i++) {
    const v: Voice = i % 2 ? 'p2' : 'p1';
    const f = shift(r.pick(OVER_CELLS), r.pick([0, 0, 2, -2]));
    // Each phrase runs a beat past the start of the next. The notes left under the new phrase are struck through.
    let t = 0;
    for (const [d, l] of f) {
      if (d !== null) b.n(v, i * 4 + t, K(d), l * 0.88, 0.3, t >= 4 - 1e-6 && i < 3 ? { duty: 0, bend: -1, det: -20 } : { duty: 1, ...MEL });
      t += l;
    }
    if (i % 3 === 2) b.fig('bell', i * 4 + 0.5, f, K, 2, 0.08, { ratio: 3.5, lay: 0.6 });
    const low = r.pick([[0, 0, 1, 0], [0, 0, 0, 4], [0, 1, 0, -1]]);
    for (let j = 0; j < 8; j++) b.n('tri', i * 4 + j * 0.5, K(low[j % 4]) - 24, 0.4, 0.5);
    b.hit(i * 4, 'kick', 0.42, 0.2).hit(i * 4 + 1, 'snare', 0.24, 0.15).hit(i * 4 + 2, 'kick', 0.36, 0.2).hit(i * 4 + 3, 'snare', 0.24, 0.15);
    for (let j = 0; j < 8; j++) b.hit(i * 4 + j * 0.5, 'hat', 0.07, 0.05, { lay: 0.35 });
  }
  return b.out();
}

const bossOver: TrackDef = {
  bpm: 160, start: 'over', vary: 0.4, wrong: 0.05, echo: 0.15, wobble: 4, spread: 10,
  graph: { over: [['over', 1]] },
  secs: { over: overSec },
};

// ---------------------------------------------------------------- Act 2: Gloss, the last fight

const E_AEO = key(52, MODE.aeo);
const GLOSS_ANSWER = shift(GLOSS, GLOSS_FALL);

function glossDrums(b: B, from: number, to: number, light: boolean) {
  for (let t = from; t < to; t += 4) {
    b.hit(t, 'kick', 0.42, 0.2);
    if (!light) b.hit(t + 1, 'snare', 0.25, 0.15).hit(t + 2, 'kick', 0.36, 0.2).hit(t + 2.5, 'kick', 0.26, 0.2).hit(t + 3, 'snare', 0.25, 0.15);
    for (let j = 0; j < 8; j++) b.hit(t + j * 0.5, 'hat', 0.07, 0.05, { lay: light ? 0 : 0.3 });
  }
}

function glossBass(b: B, r: Rng, from: number, bars: number) {
  const roots = prog(r, r.pick([[0, 5, 3, 4], [0, 3, 5, 6], [5, 3, 0, 4]]), { 0: [0, 0, 5], 3: [3, 1], 4: [4, 6] }, 0.3);
  for (let i = 0; i < bars; i++) {
    const low = fold(E_AEO(roots[i % 4]), 33);
    for (let j = 0; j < 8; j++) b.n('tri', from + i * 4 + j * 0.5, j % 2 ? low + 12 : low, 0.42, j % 4 === 0 ? 0.58 : 0.46);
  }
}

function glossSec(c: Ctx, kind: 'theme' | 'fight' | 'room' | 'quiet' | 'primer'): Section {
  const K = E_AEO, r = c.r;
  // Above intensity 0.5 the phrase is answered by its parenthesis for the first time. Below, the gap stays empty or Wait answers instead.
  const paren = { lay: 0.5 }, plain = { top: 0.5 };
  const ask = { top: 0.8 }, answered = { lay: 0.8 };
  if (kind === 'primer') {
    const b = new B(8, 4, c.bpm);
    const f = realize(HALT, K, -1);
    b.line('tri', 0, f, 0.6, {}, 0.95);
    b.line('tri', 4, f, 0.6, {}, 0.95);
    b.line('p1', 0, f.map(([p, l]) => [p === null ? null : p + 24, l]), 0.26, { duty: 2 }, 0.9);
    b.line('p1', 4, f.map(([p, l]) => [p === null ? null : p + 24 + r.pick([0, 1, 3]), l]), 0.26, { duty: 2 }, 0.9);
    // The Fifth Primer is one word, written into page after page.
    for (let t = 0; t < 7; t += 0.5) if (t % 4 < 2) b.n('p2', t, K(4) + 12, 0.3, 0.14, { duty: 2 });
    [0, 1, 4, 5].forEach((t) => b.hit(t, 'stamp', 0.4, 0.3));
    return b.out();
  }
  if (kind === 'quiet') {
    const b = new B(12, 4, c.bpm);
    b.fig('air', 0, aug(GLOSS, 1.5), K, 1, 0.26, { a: 0.05, ...MEL });
    b.fig('p1', 6, aug(GLOSS_ANSWER, 1.5), K, 1, 0.14, { duty: 3, ...paren });
    b.fig('bell', 2, WAIT, K, 2, 0.12, { ratio: 3.5, ...MEL });
    b.fig('p2', 6, ROOM, C_ION, 0, 0.12, { duty: 2, ...ask });
    b.fig('p2', 6, ROOM_ANSWER, C_ION, 0, 0.12, { duty: 2, ...answered });
    b.n('tri', 0, 40, 11.5, 0.32, { a: 0.6 });
    return b.out();
  }
  const b = new B(16, 4, c.bpm);
  if (kind === 'theme') {
    // Gloss's phrase played straight, heavy, doubled an octave down.
    const second = r.pick([GLOSS, shift(GLOSS, 1), shift(GLOSS, -2), inv(GLOSS, 2)]);
    for (const [t, f] of [[0, GLOSS], [8, second]] as Array<[number, Fig]>) {
      b.fig('p1', t, f, K, 1, 0.34, { duty: 2, ...MEL });
      b.fig('p2', t, f, K, 0, 0.2, { duty: 1 });
      b.fig('bell', t + 4, shift(f, GLOSS_FALL), K, 1, 0.13, { ratio: 3.5, ...paren });
      b.fig('bell', t + 4.5, r.chance(0.5) ? WAIT : inv(WAIT, 3), K, 1, 0.13, { ratio: 3.5, ...plain });
    }
    glossBass(b, r, 0, 4);
    glossDrums(b, 0, 16, false);
  } else if (kind === 'fight') {
    // Gloss's phrase and Wait's figure at once, each in the other's way.
    b.fig('p1', 0, GLOSS, K, 1, 0.32, { duty: 2, ...MEL });
    b.fig('bell', 2, WAIT, K, 1, 0.16, { ratio: 3.5, ...MEL });
    b.fig('p2', 4, GLOSS_ANSWER, K, 1, 0.16, { duty: 3, ...paren });
    const seq = shift(GLOSS, r.pick([2, 3, -1]));
    b.fig('p1', 8, seq, K, 1, 0.32, { duty: 2, ...MEL });
    b.fig('bell', 10, inv(WAIT, 3), K, 1, 0.16, { ratio: 3.5, ...MEL });
    b.fig('p2', 12, shift(seq, GLOSS_FALL), K, 1, 0.16, { duty: 3, ...paren });
    glossBass(b, r, 0, 4);
    glossDrums(b, 0, 16, false);
  } else {
    // Room's question over Gloss's phrase in the bass. Above 0.8 the question is answered.
    b.fig('p2', 0, ROOM, C_ION, 1, 0.18, { duty: 2, ...ask });
    b.fig('p2', 0, ROOM_ANSWER, C_ION, 1, 0.18, { duty: 2, ...answered });
    b.fig('p2', 8, shift(ROOM, r.pick([0, 1])), C_ION, 1, 0.16, { duty: 2, ...ask });
    b.fig('p2', 8, ROOM_ANSWER, C_ION, 1, 0.16, { duty: 2, ...answered });
    b.fig('tri', 0, aug(GLOSS, 2), K, -1, 0.5, {}, 0.95);
    b.fig('tri', 8, aug(r.chance(0.5) ? GLOSS : GLOSS_ANSWER, 2), K, -1, 0.46, {}, 0.95);
    b.fig('bell', 6, WAIT.slice(0, 2), K, 2, 0.1, { ratio: 3.5, ...MEL });
    b.fig('p1', 13, GLOSS.slice(0, 3), K, 1, 0.14, { duty: 3, ...paren });
    glossDrums(b, 0, 16, true);
  }
  return b.out();
}

const bossGloss: TrackDef = {
  bpm: 138, start: 'theme', vary: 0.4, wrong: 0.05, echo: 0.25, wobble: 5, spread: 8,
  graph: {
    theme: [['fight', 3], ['room', 2], ['primer', 1]],
    fight: [['theme', 2], ['room', 2], ['quiet', 1]],
    room: [['theme', 2], ['fight', 2], ['quiet', 1]],
    quiet: [['theme', 3], ['primer', 1]],
    primer: [['fight', 2], ['theme', 2]],
  },
  secs: {
    theme: (c) => glossSec(c, 'theme'), fight: (c) => glossSec(c, 'fight'), room: (c) => glossSec(c, 'room'),
    quiet: (c) => glossSec(c, 'quiet'), primer: (c) => glossSec(c, 'primer'),
  },
};

// ---------------------------------------------------------------- Act 2: the coda and the credits

function codaEnd(c: Ctx): Section {
  // Wait's figure with the third at last, and then the piece stops on its own, with no fade.
  const hold = c.r.pick([1.5, 2, 2.5, 3.5]);
  const b = new B(2.5 + hold, 4, 66);
  b.fig('air', 0, [[4, 1.5], [3, 1]], A_AEO, 1, 0.32, { a: 0.05 }, 0.98);
  b.n('air', 2.5, A_ION(WAIT_THIRD) + 12, hold, 0.34, { a: 0.08 });
  b.n('tri', 0, 38, 2.45, 0.38).n('tri', 2.5, 33, hold, 0.42);
  b.n('p2', 2.5, 64, hold, 0.1, { duty: 1 }).n('p1', 2.5, 69, hold, 0.1, { duty: 1 });
  return b.out({ still: true });
}

const coda: TrackDef = {
  bpm: 66, start: 'wait', vary: 0, wrong: 0, echo: 0.45, wobble: 6,
  graph: {
    wait: [['gloss', 1]], gloss: [['halt', 1]], halt: [['every', 1]], every: [['when', 1]],
    when: [['once', 1]], once: [['room', 1]], room: [['end', 1]],
  },
  secs: {
    wait: () => { const b = new B(6, 4, 66); b.fig('air', 0, WAIT, A_AEO, 1, 0.3, { a: 0.06 }); b.n('tri', 0, 33, 5.5, 0.36, { a: 0.4 }); return b.out({ still: true }); },
    gloss: () => {
      const b = new B(9, 4, 66);
      b.fig('p1', 0, GLOSS, A_AEO, 1, 0.26, { duty: 3 });
      b.fig('bell', 4.5, GLOSS_ANSWER, A_AEO, 1, 0.12, { ratio: 3.5 });
      b.n('tri', 0, 41, 4, 0.32).n('tri', 4.5, 36, 4, 0.3);
      return b.out({ still: true });
    },
    halt: () => {
      const b = new B(4, 4, 66), f = realize(HALT, A_AEO, -1);
      b.line('tri', 0, f, 0.5, {}, 0.95);
      b.line('p1', 0, f.map(([p, l]) => [p === null ? null : p + 24, l]), 0.18, { duty: 2 }, 0.9);
      return b.out({ still: true });
    },
    every: () => {
      const b = new B(6, 4, 66);
      for (const [v, oct, g] of [['p1', 1, 0.24], ['p2', 1, 0.2], ['air', 0, 0.18]] as Array<[Voice, number, number]>) b.fig(v, 0, EACH, A_AEO, oct, g, { duty: 1 }, 0.85);
      b.n('tri', 0, 33, 4, 0.32);
      return b.out({ still: true });
    },
    when: () => {
      const b = new B(10, 4, 66);
      const end = b.fig('bell', 0, WHEN_CALL, A_AEO, 1, 0.2, { ratio: 3.5 });
      b.fig('air', end + 4, WHEN_ANSWER, A_AEO, 1, 0.26, { a: 0.08 });
      b.n('tri', 0, 33, 9.5, 0.28, { a: 0.8 });
      return b.out({ still: true });
    },
    once: () => {
      const b = new B(12, 4, 66);
      b.fig('air', 0, ONCE, D_LYD, 0, 0.3, { a: 0.1 }, 0.98);
      b.n('tri', 0, 38, 11.5, 0.3, { a: 0.5 });
      return b.out({ still: true });
    },
    room: () => {
      const b = new B(8, 4, 66);
      b.fig('bell', 0, ROOM_ANSWER, A_ION, 1, 0.18, { ratio: 4 });
      b.n('p2', 0, 57, 7.5, 0.06, { duty: 2, a: 0.3 });
      return b.out({ still: true });
    },
    end: codaEnd,
  },
};

const credits2: TrackDef = {
  bpm: 76, start: 'wait', vary: 0.3, wrong: 0, echo: 0.5, wobble: 7,
  graph: {
    wait: [['busy', 1]], busy: [['gloss', 1]], gloss: [['halt', 1]], halt: [['each', 1]], each: [['when', 1]],
    when: [['stet', 1]], stet: [['every', 1]], every: [['once', 1]], once: [['line', 1]], line: [['room', 1]], room: [['end', 1]],
  },
  secs: {
    wait: (c) => titleSec(c, WAIT, [0, 5, 3, 4], 'air', 1, false),
    busy: (c) => busy7Sec(c, BUSY_A, [0, 3, 0, 1]),
    gloss: (c) => themeGloss(c, key(64, MODE.dor)),
    halt: (c) => themeHalt(c, FS_HMIN),
    each: (c) => themeEach(c, BB_MIX),
    when: (c) => themeWhen(c, FS_LYD),
    stet: stetThemeSec,
    every: everySec,
    once: themeOnce,
    line: (c) => lineSec(c, 'road'),
    room: (c) => roomSec(c, 'ask'),
    end: (c) => {
      const b = new B(16, 4, c.bpm);
      b.fig('bell', 0, ROOM_ANSWER, C_ION, 1, 0.2, { ratio: 4 });
      b.fig('p2', 0, shift(ROOM_ANSWER, -2), C_ION, 1, 0.1, { duty: 2 });
      b.n('tri', 0, 36, 3.8, 0.36).n('tri', 4, 41, 2.8, 0.34).n('tri', 7, 36, 8.5, 0.38, { a: 0.3 });
      b.n('air', 7, 64, 8.5, 0.14, { a: 0.6 });
      b.n('bell', 9.5, 84, 4, 0.08, { ratio: 3.5 });
      return b.out({ still: true });
    },
  },
};


// ---------------------------------------------------------------- stingers

export const STINGERS: Record<StingerId, () => Section> = {
  win: () => {
    const b = new B(5, 4, 140);
    b.line('p1', 0, [[69, 0.5], [73, 0.5], [76, 0.5], [81, 0.5], [80, 2]], 0.4, { duty: 2 });
    b.n('bell', 2, 88, 2.5, 0.2, { ratio: 3.5 }).n('tri', 0, 45, 4, 0.5);
    return b.out({ still: true });
  },
  level: () => {
    const b = new B(4, 4, 150);
    b.line('bell', 0, [[69, 0.25], [76, 0.25], [81, 0.25], [83, 0.25], [88, 2]], 0.24, { ratio: 3.5 });
    b.n('p1', 1, 76, 2, 0.3, { duty: 1 }).n('p2', 1, 81, 2, 0.22, { duty: 1 }).n('tri', 0, 45, 3, 0.45);
    return b.out({ still: true });
  },
  get: () => {
    const b = new B(3, 4, 160);
    b.line('p1', 0, [[76, 0.25], [81, 0.25], [83, 0.25], [88, 1]], 0.34, { duty: 1 });
    b.n('bell', 0.75, 93, 2, 0.14, { ratio: 3.5 });
    return b.out({ still: true });
  },
  chapter: () => {
    const b = new B(5, 4, 70);
    b.fig('bell', 0, WAIT, A_AEO, 1, 0.26, { ratio: 3.5 });
    b.fig('air', 0, WAIT, A_AEO, 0, 0.26, { a: 0.05 });
    b.n('tri', 0, 33, 4.5, 0.45, { a: 0.2 }).n('p2', 2.5, 60, 2.4, 0.1, { duty: 1, a: 0.4 });
    return b.out({ still: true });
  },
  secret: () => {
    const b = new B(4, 4, 120);
    b.line('bell', 0, [72, 74, 76, 78, 80, 82, 84].map((p): [number, number] => [p, 0.25]), 0.18, { ratio: 3.5 });
    b.n('air', 0, 72, 3, 0.2, { a: 0.3, bend: 1 }).n('bell', 1.75, 96, 2, 0.1, { ratio: 3.5 });
    return b.out({ still: true });
  },
  lose: () => {
    const b = new B(4, 4, 70);
    b.line('air', 0, [[64, 0.75], [62, 0.75], [60, 0.75], [57, 1.5]], 0.32, { a: 0.04 });
    b.n('tri', 0, 45, 3.5, 0.45, { bend: -5 });
    return b.out({ still: true });
  },
  card: () => {
    const b = new B(1.5, 4, 180);
    b.n('p1', 0, 88, 0.2, 0.26, { duty: 0 }).n('p1', 0.25, 84, 0.4, 0.22, { duty: 0 }).hit(0, 'tick', 0.2, 0.05);
    return b.out({ still: true });
  },
  catch: () => {
    const b = new B(2, 4, 140);
    b.n('bell', 0, 81, 0.6, 0.22, { ratio: 2.4, bend: 2 }).n('p2', 0.5, 76, 0.4, 0.2, { duty: 1 }).n('p2', 1, 83, 0.8, 0.2, { duty: 1 });
    return b.out({ still: true });
  },
  ending: () => {
    // Someone's last line: three soft notes, and the fourth beat never comes.
    const b = new B(4, 4, 72);
    b.line('p2', 0, [[76, 1], [74, 1], [72, 0.6]], 0.16, { duty: 2 }, 0.95);
    b.line('air', 0, [[64, 1], [62, 1], [60, 0.6]], 0.2, { a: 0.04 }, 0.95);
    b.n('tri', 0, 45, 2.55, 0.3);
    return b.out({ still: true });
  },
  write: () => {
    const b = new B(1.5, 4, 150);
    b.hit(0, 'sweep', 0.2, 0.45, { n: 40, a: 0.03 });
    b.line('p1', 0.05, [[72, 0.125], [76, 0.125], [79, 0.125], [84, 0.125], [88, 0.3]], 0.2, { duty: 0 }, 0.9);
    b.hit(0.75, 'tick', 0.2, 0.04);
    return b.out({ still: true });
  },
  stet: () => {
    // A correction undone: the wrong note, a pause, and the right one.
    const b = new B(3, 4, 100);
    b.n('p1', 0, 70, 0.45, 0.24, { duty: 0 });
    b.n('air', 1, 69, 1.8, 0.3, { a: 0.04 }).n('bell', 1, 81, 1.8, 0.1, { ratio: 3.5 }).n('tri', 1, 45, 1.8, 0.32);
    return b.out({ still: true });
  },
};

// ---------------------------------------------------------------- the registry

export const TRACKS: Record<TrackId, TrackDef> = {
  splash, title,
  busy, busy_again: busyAgain, millrace, river, standing, standing_lit: standingLit, twice, press,
  ears, relay, tether, writing, nursery, margin, stet, reel,
  battle, battle_copied: battleCopied, boss_grind: bossGrind, boss_hold: bossHold, boss_many: bossMany,
  boss_relay: bossRelay, boss_arm: bossArm, boss_again: bossAgain, boss_erratum: bossErratum,
  ...themes,
  gameover, credits,
  act2_title: actTwoTitle, prologue_night: prologueNight, busy7, nursery7, river_low: riverLow, twice_one: twiceOne,
  theme_stet: themeStet, theme_every: themeEvery, theme_room: themeRoom, theme_room_answer: themeRoomAnswer,
  ears_up: earsUp, line, scrivener, quill, battle2,
  boss_closer: bossCloser, boss_corrector: bossCorrector, boss_over: bossOver, boss_gloss: bossGloss,
  coda, credits2,
};
