// The score of Slough: leitmotifs as scale-degree figures, and every track as a small seeded generator.
// Pitches are MIDI numbers at the written pitch (57 is A3, 220 Hz). Times and lengths are in quarter-note beats.
// The engine lowers every pitch by one semitone per loosened Stay, so nothing here knows about the drop.

export type TrackId =
  | 'splash' | 'title' | 'home' | 'fellside' | 'route' | 'town' | 'gym' | 'minigame'
  | 'battle' | 'wild' | 'keeper' | 'rival' | 'legend' | 'battleHand' | 'battleCinch' | 'battlePeel'
  | 'drysea' | 'marsh' | 'spire' | 'wood' | 'machine' | 'hum' | 'bare' | 'tundra' | 'tusk' | 'tallow' | 'hiltroad'
  | 'peel' | 'moonwater' | 'crater' | 'fall' | 'climb' | 'crown' | 'slack' | 'oldrind' | 'stack' | 'credits' | 'cave'
  | 'strand' | 'sanddollar' | 'cowrie' | 'auger' | 'nautilus' | 'tray' | 'conch' | 'collector' | 'cinchReal'
  | 'wildStrand' | 'keeperStrand' | 'starfall' | 'credits2'
  | 'cove' | 'brook' | 'highwater' | 'saltings' | 'shout' | 'kelp' | 'gantry' | 'floes' | 'shingle' | 'longway' | 'gatering'
  | 'holm' | 'gempuzzle' | 'geode';

/** Battle tracks. They read intensity through lay and top bands. */
export const BATTLE_TRACKS: ReadonlySet<string> = new Set([
  'battle', 'wild', 'keeper', 'rival', 'legend', 'battleHand', 'battleCinch', 'battlePeel', 'collector', 'wildStrand', 'keeperStrand', 'holm',
]);
/** Tracks that play once and end. */
export const ONCE_TRACKS: ReadonlySet<string> = new Set(['splash', 'credits', 'credits2']);

export type Voice = 'p1' | 'p2' | 'tri' | 'nz' | 'bell' | 'air';
export type Nz = 'hat' | 'snare' | 'kick' | 'tick' | 'tock' | 'sweep' | 'rush' | 'stamp' | 'thud';

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
  /** Melodic: open to ornaments, displacement, and bends. */
  m?: 1;
  /** Kept: never varied, swung, slipped, or dropped. Only Small Gran's figure is kept. */
  k?: 1;
  /** Pinned: a drone or held note that variation, slips, and wrong events leave alone. */
  pin?: 1;
  /** Bell only: a reversed envelope that swells up to the strike and stops there. */
  rev?: 1;
}

export interface Section {
  beats: number;
  bar: number;
  bpm: number;
  ev: Ev[];
  /** Skip automatic variation, wrong events, slips, and swing. */
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
  /** Delay of every off-beat eighth, in beats. */
  swing?: number;
  /** How far the swing wanders from bar to bar, in beats, so it stumbles. */
  stumble?: number;
  /** Chance per section that the key slips a semitone for a bar or for the rest of the section. */
  slip?: number;
  /** Chance that a long melodic note bends. */
  bendy?: number;
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

export function realize(fig: Fig, K: Key, oct = 0): Array<[number | null, number]> {
  return fig.map(([d, len, acc]) => [d === null ? null : K(d) + 12 * oct + (acc ?? 0), len]);
}
export const inv = (f: Fig, axis = 0): Fig => f.map(([d, l, a]) => [d === null ? null : 2 * axis - d, l, a === undefined ? undefined : -a]);
export const retro = (f: Fig): Fig => [...f].reverse();
export const aug = (f: Fig, k: number): Fig => f.map(([d, l, a]) => [d, l * k, a]);
export const shift = (f: Fig, k: number): Fig => f.map(([d, l, a]) => [d === null ? null : d + k, l, a]);
export const figLen = (f: Fig): number => f.reduce((s, x) => s + x[1], 0);

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

// ---------------------------------------------------------------- automatic strangeness

const CEIL: Record<Voice, number> = { p1: 88, p2: 86, tri: 56, nz: 127, bell: 94, air: 78 };
const FLOOR: Record<Voice, number> = { p1: 50, p2: 50, tri: 31, nz: 0, bell: 45, air: 45 };

/** Moves a note an octave, up when there is room above, otherwise down when there is room below. */
function octave(v: Voice, n: number): number {
  if (n + 12 <= CEIL[v] && n <= 74) return n + 12;
  return n - 12 >= FLOOR[v] ? n - 12 : n;
}

/** Ornaments, octave displacement, dropped notes, rhythmic displacement, and bends. Kept and pinned notes are left alone. */
export function vary(sec: Section, r: Rng, amt: number, bendy = 0): Section {
  if ((amt <= 0 && bendy <= 0) || sec.still) return sec;
  const out: Ev[] = [];
  let first = true;
  for (const e of sec.ev) {
    if (e.k || e.pin) { out.push(e); continue; }
    if (!e.m) {
      // Accompaniment varies in ways that cannot break the harmony: a dropped note, an octave, a missing hat.
      if (e.v === 'nz') { if ((e.nz === 'hat' || e.nz === 'tick') && r.chance(0.07 * amt)) continue; out.push(e); continue; }
      if (e.d < 1.5 && e.v !== 'tri' && r.chance(0.05 * amt)) continue;
      const x: Ev = { ...e };
      if (e.d < 1.5 && r.chance(0.05 * amt)) x.n = octave(x.v, x.n);
      out.push(x);
      continue;
    }
    const x: Ev = { ...e, g: e.g * r.range(0.86, 1.05) };
    if (!first && r.chance(0.06 * amt)) continue;
    first = false;
    if (r.chance(0.05 * amt)) x.n = octave(x.v, x.n);
    if (r.chance(0.05 * amt) && x.t >= 0.25) x.t -= 0.25;
    else if (r.chance(0.04 * amt) && x.d >= 0.75) { x.t += 0.25; x.d -= 0.25; }
    if (!x.bend && x.d >= 1 && r.chance(bendy)) x.bend = r.pick([-1, -0.5, 0.5, 1, -2, -0.5]);
    if (r.chance(0.07 * amt) && x.t >= 0.125 && x.d >= 0.5) {
      out.push({ ...x, t: x.t - 0.125, d: 0.12, g: x.g * 0.7, n: x.n + r.pick([1, 2, 2, -1]), bend: undefined });
    } else if (r.chance(0.04 * amt) && x.d >= 1) {
      const up = r.pick([1, 2]);
      out.push({ ...x, d: 0.12, bend: undefined }, { ...x, t: x.t + 0.125, d: 0.12, n: x.n + up, bend: undefined });
      x.t += 0.25; x.d -= 0.25;
    }
    out.push(x);
  }
  return { ...sec, ev: out };
}

/** Rare wrong events: a bar in another meter, a sudden tritone, a held bent note, a hole. */
export function wrong(sec: Section, r: Rng): Section {
  if (sec.still || !sec.ev.length) return sec;
  const fixed = sec.ev.some((e) => e.k || e.pin);
  const bars = Math.max(1, Math.floor(sec.beats / sec.bar + 1e-6));
  const kinds: Array<'meter' | 'tritone' | 'bend' | 'hole'> = bars > 1 && !fixed ? ['meter', 'tritone', 'bend', 'hole'] : ['tritone', 'bend', 'hole'];
  const kind = r.pick(kinds);
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
    for (const e of ev) if (e.v !== 'nz' && !e.k && !e.pin && e.t >= lo && e.t < hi) e.n += e.n + 6 > CEIL[e.v] ? -6 : 6;
  } else if (kind === 'bend') {
    let best: Ev | null = null;
    for (const e of ev) if (e.m && !e.k && (!best || e.d > best.d)) best = e;
    if (best) { best.bend = r.pick([-1, 1, -2, -0.5]); best.d = Math.max(best.d, 1.5); }
  } else {
    ev = ev.filter((e) => !(e.m && !e.k && e.t >= lo && e.t < hi));
  }
  return { ...sec, ev, beats, tag: kind };
}

/** The key slips: one bar, or everything after it, moves a semitone or two while the drums carry on. */
export function slipSec(sec: Section, r: Rng): Section {
  const bars = Math.max(1, Math.floor(sec.beats / sec.bar + 1e-6));
  const lo = r.int(bars) * sec.bar;
  const hi = r.chance(0.4) ? Infinity : lo + sec.bar;
  const s = r.pick([1, -1, 1, -1, 2]);
  for (const e of sec.ev) if (e.v !== 'nz' && !e.k && !e.pin && e.t >= lo - 1e-6 && e.t < hi) e.n += s;
  return { ...sec, tag: (sec.tag ? sec.tag + '+' : '') + 'slip' };
}

/** Swings every off-beat eighth late, by an amount that wanders from bar to bar so the swing stumbles. */
export function swingSec(sec: Section, r: Rng, amt: number, stumble: number): Section {
  const nb = Math.ceil(sec.beats / sec.bar) + 1;
  const per: number[] = [];
  for (let i = 0; i < nb; i++) per.push(Math.max(0, amt + stumble * (r.next() * 2 - 1)));
  for (const e of sec.ev) {
    if (e.k || e.pin) continue;
    const f = e.t - Math.floor(e.t);
    if (Math.abs(f - 0.5) > 0.01) continue;
    const s = per[Math.min(nb - 1, Math.floor(e.t / sec.bar))];
    e.t += s;
    e.d = Math.max(0.06, e.d - s);
  }
  return sec;
}

/** Warps a section's time so the local tempo moves from s0 to s1 times the written tempo. */
export function lean(sec: Section, s0: number, s1: number): Section {
  const L = sec.beats;
  const tau = (t: number) => (Math.abs(s1 - s0) < 1e-6 ? t / s0 : (L / (s1 - s0)) * Math.log((s0 + (s1 - s0) * (Math.min(L, t) / L)) / s0));
  for (const e of sec.ev) { const a = tau(e.t), z = tau(e.t + e.d); e.t = a; e.d = Math.max(0.02, z - a); }
  return { ...sec, beats: tau(L) };
}

// ---------------------------------------------------------------- harmony and line helpers

/** Chord roots with seeded substitutions: subs maps a degree to the degrees that may replace it. */
export function prog(r: Rng, base: readonly number[], subs: Record<number, readonly number[]>, p: number): number[] {
  return base.map((d) => (subs[d] && r.chance(p) ? r.pick(subs[d]) : d));
}

/** Tones of the diatonic chord on degree d: root, third, fifth, seventh, ninth. The key decides each chord's quality. */
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

/** The chord on degree d with its root folded into [lo, lo + 12). */
export function voiced(K: Key, d: number, lo: number, size = 3): number[] {
  const root = fold(K(d), lo);
  return chord(K, d, size).map((p) => root + p - K(d));
}

type BassStyle = 'hold' | 'half' | 'walk' | 'eighths' | 'waltz' | 'octaves';

function bassBar(b: B, K: Key, t0: number, bar: number, R: number, nextR: number, lo: number, style: BassStyle, g: number, r: Rng, x?: Partial<Ev>): void {
  const p = fold(K(R), lo), third = p + K(R + 2) - K(R), five = p + K(R + 4) - K(R), oct = p + 12;
  const q = fold(K(nextR), lo);
  switch (style) {
    case 'hold': b.n('tri', t0, p, bar * 0.97, g, x); break;
    case 'half':
      b.n('tri', t0, p, bar * 0.48, g, x).n('tri', t0 + bar / 2, r.chance(0.7) ? five : oct, bar * 0.45, g * 0.85, x);
      break;
    case 'walk': {
      // A walking line that leans into the next root by a half step.
      const n = Math.max(2, Math.round(bar)), step = bar / n, tones = [third, five, oct, five, third];
      for (let i = 0; i < n; i++) {
        const pitch = i === 0 ? p : i === n - 1 ? q + r.pick([-1, 1, 1, -2]) : tones[r.int(tones.length)];
        b.n('tri', t0 + i * step, pitch, step * 0.85, i === 0 ? g : g * 0.85, x);
      }
      break;
    }
    case 'eighths': {
      const n = Math.round(bar * 2);
      for (let i = 0; i < n; i++) b.n('tri', t0 + i * 0.5, i % 4 === 3 ? oct : i % 4 === 2 && r.chance(0.4) ? five : p, 0.42, i % 2 ? g * 0.8 : g, x);
      break;
    }
    case 'waltz':
      b.n('tri', t0, p, 0.9, g, x);
      if (bar >= 3) b.n('tri', t0 + 2, r.chance(0.5) ? five : p, 0.8, g * 0.7, x);
      break;
    case 'octaves': {
      const n = Math.round(bar);
      for (let i = 0; i < n; i++) b.n('tri', t0 + i, i % 2 ? oct : p, 0.8, g, x);
      break;
    }
  }
}

function bassLine(b: B, K: Key, roots: number[], bar: number, lo: number, style: BassStyle, g: number, r: Rng, x?: Partial<Ev>): void {
  roots.forEach((R, i) => bassBar(b, K, i * bar, bar, R, roots[(i + 1) % roots.length], lo, style, g, r, x));
}

/** Arpeggio over chord tones; a pattern index past the chord climbs an octave, and -1 is a rest. */
function arp(b: B, v: Voice, t0: number, len: number, tones: readonly number[], pat: readonly number[], step: number, g: number, x?: Partial<Ev>, leg = 0.7): void {
  const n = Math.round(len / step);
  for (let i = 0; i < n; i++) {
    const idx = pat[i % pat.length];
    if (idx < 0) continue;
    const p = tones[idx % tones.length] + 12 * Math.floor(idx / tones.length);
    b.n(v, t0 + i * step, p, step * leg, g * (i % pat.length === 0 ? 1 : 0.8), x);
  }
}

/** Comping on the second pulse: seventh-chord tones in an off-beat rhythm, and now and then a chord a half step above the next one. */
function comp(b: B, K: Key, t0: number, bar: number, R: number, nextR: number, lo: number, g: number, r: Rng, x?: Partial<Ev>): void {
  const ch = voiced(K, R, lo, 4);
  const rhythms = bar >= 4 ? [[0, 1.5], [0.5, 2.5], [1.5, 3], [0, 1.5, 3]] : bar >= 3 ? [[0, 1.5], [1, 2], [0.5, 2]] : [[0, 1], [0.5]];
  for (const o of r.pick(rhythms)) b.n('p2', t0 + o, ch[r.pick([1, 3, 2, 3])], 0.42, g, { duty: 2, ...x });
  if (bar >= 3 && r.chance(0.3)) b.n('p2', t0 + bar - 0.5, voiced(K, nextR, lo, 4)[1] + 1, 0.35, g * 0.9, { duty: 2, ...x });
}

const CELLS4: number[][] = [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 2], [2, 1, 1], [1.5, 0.5, 2], [1, 1, 2], [0.5, 0.5, 0.5, 0.5, 2], [3, 1], [2, 2]];
const WALTZ: number[][] = [[2, 1], [1, 1, 1], [1.5, 0.5, 1], [3], [1, 2], [0.5, 0.5, 2]];
const FAST: number[][] = [[0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5], [1, 0.5, 0.5], [0.75, 0.25, 1], [1, 1], [1.5, 0.5], [0.25, 0.25, 0.5, 1]];
const SLOW: number[][] = [[2, 2], [4], [3, 1], [2, 1, 1], [1, 3]];
const SIX: number[][] = [[1.5, 1.5], [1, 0.5, 1.5], [0.5, 0.5, 0.5, 1.5], [3], [1, 0.5, 1, 0.5]];
const SKIP: number[][] = [[1, 0.5], [1, 0.5, 1, 0.5], [0.5, 0.5, 0.5, 1.5], [1.5, 1.5], [0.5, 1, 0.5, 1]];
const MARCH: number[][] = [[1, 1, 2], [0.75, 0.25, 1, 2], [1.5, 0.5, 2], [0.5, 0.5, 1, 1, 1]];

/** A seeded phrase of `len` beats: mostly steps, now and then a leap, landing on `end`. */
export function phrase(r: Rng, len: number, start: number, end: number, o: { cells?: number[][]; lo?: number; hi?: number; avoid?: number[]; rest?: number } = {}): Array<[number | null, number]> {
  const cells = o.cells ?? CELLS4, lo = o.lo ?? -2, hi = o.hi ?? 9;
  const durs: number[] = [];
  let tot = 0;
  while (tot < len - 1e-6) {
    for (const d of r.pick(cells)) {
      if (tot >= len - 1e-6) break;
      const dd = Math.min(d, len - tot);
      durs.push(dd);
      tot += dd;
    }
  }
  const out: Array<[number | null, number]> = [];
  let d = start;
  durs.forEach((l, i) => {
    if (i === durs.length - 1) d = end;
    else if (i === durs.length - 2 && i > 0) d = end + r.pick([1, -1, 1, 2]);
    else if (i > 0) d = Math.max(lo, Math.min(hi, d + r.weighted([[1, 4], [-1, 4], [2, 1.5], [-2, 1.5], [3, 0.6], [-3, 0.6], [4, 0.4], [0, 0.6]] as const)));
    let dd = d;
    if (o.avoid && o.avoid.includes(((dd % 7) + 7) % 7)) dd += r.chance(0.5) ? 1 : -1;
    out.push([i > 0 && i < durs.length - 1 && o.rest && r.chance(o.rest) ? null : dd, l]);
  });
  return out;
}

/** Writes a figure with bends on its long notes: the wandering kind of singing. */
function sing(b: B, r: Rng, v: Voice, t: number, f: Fig, K: Key, oct: number, g: number, p: number, x?: Partial<Ev>, leg = 0.92): number {
  for (const [d, l, a] of f) {
    if (d !== null) b.n(v, t, K(d) + 12 * oct + (a ?? 0), l * leg, g, { ...x, bend: l >= 1 && r.chance(p) ? r.pick([-1, -0.5, 0.5, 1]) : x?.bend });
    t += l;
  }
  return t;
}

/** Doubles the first pulse on the bell an octave up, heard only at or above an intensity. High notes double at pitch. */
function bellCopy(b: B, lay: number, g: number, melodicOnly = false): void {
  for (const e of b.ev.filter((x) => x.v === 'p1' && (!melodicOnly || x.m))) b.n('bell', e.t, e.n + (e.n > 82 ? 0 : 12), e.d, g, { ratio: 3.5, lay: Math.max(lay, e.lay ?? 0), top: e.top });
}

// ---------------------------------------------------------------- leitmotifs

/** Ouro: a figure that always lacks one scale degree. The rest at the end is where that degree belongs. */
export const OURO: Fig = [[0, 0.5], [1, 0.5], [4, 1], [3, 0.5], [1, 0.5], [null, 1]];
/** The degree Ouro's figure never plays, until the end of the credits. */
export const OURO_LACK = 2;
/** Ouro's figure with the missing degree in place. Only the last section of the credits plays it. */
export const OURO_WHOLE: Fig = [[0, 0.5], [1, 0.5], [4, 1], [3, 0.5], [1, 0.5], [2, 3]];
/** Removes the lacking degree from any form of Ouro's figure. */
export const lack = (f: Fig, deg = OURO_LACK): Fig => f.map(([d, l, a]) => [d !== null && ((Math.round(d) % 7) + 7) % 7 === deg ? null : d, l, a]);

/** Small Gran's five lines as [start in seconds, length in seconds, MIDI pitch]. Absolute, so no track can change them. */
export const SMALL_GRAN: ReadonlyArray<readonly [number, number, number]> = [[0, 0.4, 74], [0.45, 0.4, 76], [0.9, 0.4, 74], [1.35, 0.6, 69], [2.1, 1.9, 71]];
export const SG_GAIN = 0.2;
export const SG_RATIO = 4;
/** Writes Small Gran's figure at beat t, identical in seconds at any tempo, and returns the beat it ends on. */
export function smallGran(b: B, t: number): number {
  const k = b.bpm / 60;
  for (const [s, l, n] of SMALL_GRAN) b.n('bell', t + s * k, n, l * k, SG_GAIN, { ratio: SG_RATIO, a: 0.004, k: 1 });
  return t + 4 * k;
}

/** Gran answers Small Gran: plain quarter notes from the note Small Gran ends on, down to home. */
export const GRAN: Fig = [[2, 1], [1, 1], [0, 1], [-3, 1], [0, 2]];

/** Tack's count: four even pulses. The accents spell, in binary, how many times Tack has counted, so no two counts sound alike. */
export function tackCount(b: B, c: Ctx, v: Voice, t: number, K: Key, deg: number, oct: number, step: number, g: number, x?: Partial<Ev>, acc?: Partial<Ev>): number {
  const n = (c.st.count = (c.st.count ?? 0) + 1);
  const mask = (n % 15) + 1;
  for (let i = 0; i < 4; i++) {
    const on = (mask >> (3 - i)) & 1;
    b.n(v, t + i * step, K(deg + (on ? 4 : 0)) + 12 * oct, step * (on ? 0.85 : 0.5), on ? g : g * 0.55, { duty: on ? 2 : 0, ...x, ...(on ? acc : undefined) });
  }
  return t + 4 * step;
}

/** Bare: each note longer than the last, each fall wider, each one let go downward. */
export const BARE: Fig = [[7, 1], [6, 1.5], [4, 2], [1, 3], [-3, 4]];
export function exhale(b: B, t: number, K: Key, oct: number, g: number, stretch = 1, x?: Partial<Ev>): number {
  let tt = t;
  BARE.forEach(([d, l], i) => {
    const len = l * stretch;
    if (d !== null) b.n('air', tt, K(d) + 12 * oct, len * 0.97, g * (1 - i * 0.07), { a: 0.25 + i * 0.12, bend: i >= 2 ? -0.5 - (i - 2) * 0.25 : 0, ...x });
    tt += len;
  });
  return tt;
}

/** The Hermits: a descending run that comes away as it goes, each note shorter and flatter than the last. */
export const PEEL: Fig = [[7, 0.25], [6, 0.25], [5, 0.25], [4, 0.5], [3, 0.5], [1, 0.75], [0, 1.5]];
export function peel(b: B, v: Voice, t: number, K: Key, oct: number, g: number, from = 0, x?: Partial<Ev>): number {
  let tt = t;
  PEEL.forEach(([d, l], i) => {
    if (d !== null) b.n(v, tt, K(d + from) + 12 * oct, l * (0.95 - i * 0.08), g * (1 - i * 0.05), { det: -i * 4, ...MEL, ...x });
    tt += l;
  });
  return tt;
}

/** Cinch's habit: one step, taken again and again. */
export const HABIT: Fig = [[4, 0.5], [5, 0.5]];
/** Cinch's held note: the leading tone, which never goes up to the tonic. */
export const CINCH_HOLD = 6;
export function habit(b: B, v: Voice, t: number, K: Key, oct: number, reps: number, step: number, g: number, x?: Partial<Ev>): number {
  let tt = t;
  for (let i = 0; i < reps; i++) for (const [d] of HABIT) { b.n(v, tt, K(d as number) + 12 * oct, step * 0.8, g, x); tt += step; }
  return tt;
}

/** Full: a swell that rises a fifth and is pulled past it, then settles back. Its long notes glide upward, toward it. */
export const FULL: Fig = [[0, 1.5], [4, 2.5], [5, 1], [4, 3]];
export function full(b: B, v: Voice, t: number, K: Key, oct: number, g: number, stretch = 1, x?: Partial<Ev>): number {
  let tt = t;
  FULL.forEach(([d, l], i) => {
    const len = l * stretch;
    if (d !== null) b.n(v, tt, K(d) + 12 * oct, len * 0.98, g, { a: Math.min(0.9, 0.15 * len), bend: i === 1 ? 1 : i === 3 ? 0.5 : 0, ...MEL, ...x });
    tt += len;
  });
  return tt;
}

/** The Exuvia: open fifths and a step, too slow to be a tune. */
export const RIND: Fig = [[0, 4], [-3, 4], [1, 6], [0, 2]];

/** The Volute's pulse: a lub on the beat and a softer dub after it, every `every` beats. With a root, the triangle beats too. */
export function heart(b: B, from: number, every: number, g: number, o: { root?: number; dub?: number; to?: number; x?: Partial<Ev> } = {}): void {
  const to = o.to ?? b.beats, dub = o.dub ?? 0.5;
  for (let t = from; t < to - 1e-6; t += every) {
    b.hit(t, 'thud', g, 0.3, o.x).hit(t + dub, 'thud', g * 0.6, 0.3, o.x);
    if (o.root !== undefined) b.n('tri', t, o.root, dub * 0.8, Math.min(0.6, 0.3 + g), o.x).n('tri', t + dub, o.root, dub * 0.7, Math.min(0.5, 0.2 + g), o.x);
  }
}

// ---------------------------------------------------------------- splash and title

const splash: TrackDef = {
  bpm: 120, start: 'boot', vary: 0, wrong: 0, echo: 0.5, wobble: 4,
  secs: {
    boot: () => {
      const b = new B(8, 4, 120);
      // The console wakes: two pulses a fifth apart, a bell, and a chord that slips down a semitone before it lands.
      b.n('p1', 0, 74, 0.2, 0.4, { duty: 2 }).n('p1', 0.25, 81, 0.5, 0.38, { duty: 2 });
      b.n('bell', 0.25, 93, 2.2, 0.28, { ratio: 3.5 });
      b.n('tri', 1, 39, 1.45, 0.5).n('tri', 2.5, 38, 5, 0.5);
      [63, 67, 70, 74].forEach((p, i) => b.n('p2', 1 + i * 0.25, p, 0.22, 0.16, { duty: 1 }));
      [62, 66, 69, 73, 78].forEach((p, i) => b.n('p2', 2.5 + i * 0.25, p, i === 4 ? 4 : 0.22, 0.15, { duty: 1 }));
      b.hit(2.5, 'thud', 0.3, 0.3).hit(3, 'thud', 0.18, 0.3);
      // The publisher's chime: a bell that bends flat as it fades.
      b.n('air', 3, 66, 4.5, 0.2, { a: 0.3 });
      b.n('bell', 4, 85, 3.5, 0.17, { ratio: 3.5, bend: -0.5 });
      return b.out({ still: true });
    },
  },
};

const D_DOR = key(62, MODE.dor);

function titleSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const K = D_DOR, r = c.r, b = new B(16, 4, c.bpm);
  heart(b, 0, 8, 0.09);
  if (kind === 'c') {
    b.n('tri', 0, 38, 15.5, 0.4, { a: 1 });
    b.n('air', 1 + r.int(3), K(r.pick([4, 0, 3])), 7, 0.17, { a: 1.5, bend: r.pick([0, -0.5]), ...MEL });
    const n = 1 + r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', 2 + r.int(24) * 0.5, K(r.pick([4, 3, 0, 7, 8])) + 12, 2.5, 0.1, { ratio: 3.5, ...MEL });
    return b.out();
  }
  const roots = prog(r, kind === 'a' ? [0, 5, 3, 4] : [3, 0, 6, 4], { 0: [0, 0, 5], 5: [5, 3], 3: [3, 1], 4: [4, 6], 6: [6, 4] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 4;
    b.n('tri', t0, fold(K(R), 38), 3.8, 0.42, { a: 0.25 });
    // Open fifths: the harmony lacks a third the way Ouro's figure does.
    const lo = fold(K(R), 57), tones = [lo, lo + K(R + 4) - K(R), lo + 12];
    r.pick([[0, 1, 2, 1], [0, 2, 1, 2], [1, 0, 2, 0]]).forEach((k, j) => { if (!r.chance(0.12)) b.n('p2', t0 + j, tones[k], 0.9, 0.13, { duty: 1, a: 0.04 }); });
  });
  const v: Voice = kind === 'a' ? 'air' : 'bell';
  const fig = kind === 'a' ? aug(OURO, 2) : aug(inv(OURO, OURO_LACK), 2);
  const oct = v === 'air' ? 0 : 1, g = v === 'air' ? 0.34 : 0.2;
  b.fig(v, 0, lack(fig), K, oct, g, { ...MEL, a: 0.08, ratio: 3.5 }, 0.96);
  b.fig(v, 8, lack(r.chance(0.5) ? shift(fig, r.pick([-2, 3, 4])) : fig), K, oct, g * 0.9, { ...MEL, a: 0.08, ratio: 3.5 }, 0.96);
  return b.out();
}

const title: TrackDef = {
  bpm: 56, start: 'a', vary: 0.6, wrong: 0.05, slip: 0.1, bendy: 0.15, echo: 0.5, wobble: 7,
  graph: { a: [['b', 3], ['c', 1], ['a', 1]], b: [['a', 3], ['c', 2]], c: [['a', 2], ['b', 2]] },
  secs: { a: (c) => titleSec(c, 'a'), b: (c) => titleSec(c, 'b'), c: (c) => titleSec(c, 'c') },
};

// ---------------------------------------------------------------- Gran's kitchen

const G_ION = key(55, MODE.ion);

function homeSec(c: Ctx, kind: 'kitchen' | 'gran' | 'still'): Section {
  const K = G_ION, r = c.r, b = new B(12, 3, c.bpm);
  if (kind === 'gran') {
    // Small Gran says her next line, exactly as always. Gran answers through her, low and plain, never quite the same way twice.
    b.n('tri', 0, r.pick([43, 43, 48, 38]), 5.4, 0.3, { a: 0.4 });
    b.n('p2', r.pick([0, 0.5, 1]), K(r.pick([0, 4, 2, 5])) + 12, 4.5, 0.06, { duty: 1, a: 0.6 });
    const end = smallGran(b, 1);
    const answer = r.pick<Fig>([GRAN, [[2, 1.5], [1, 0.5], [0, 1], [-3, 1], [0, 2]], [[2, 1], [1, 1], [0, 2], [-3, 2]], [[2, 1], [1, 1], [-1, 1], [-3, 1], [0, 2]]]);
    b.fig('tri', Math.ceil(end), answer, K, 0, 0.5, { a: 0.02 }, r.pick([0.92, 0.8, 0.97]));
    const t = 6 + r.int(4);
    b.n('p2', t, K(r.pick([2, 4, 0, 6])) + 12, 11.8 - t, 0.07, { duty: 1, a: 0.05 + r.next() * 0.3 });
    if (r.chance(0.5)) b.hit(r.pick([6.5, 8.5, 9.5, 10.5]), 'tick', 0.04, 0.03);
    return b.out();
  }
  heart(b, 0, 12, 0.06);
  if (kind === 'kitchen') {
    const roots = prog(r, [0, 3, 4, 0], { 3: [3, 1], 4: [4, 6], 0: [0, 5] }, 0.3);
    roots.forEach((R, i) => {
      bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 4], 43, 'waltz', 0.42, r);
      const ch = voiced(K, R, 59, 4);
      b.n('p2', i * 3 + 1, ch[1], 0.6, 0.1, { duty: 1 }).n('p2', i * 3 + 2, ch[r.pick([2, 3])], 0.6, 0.09, { duty: 1 });
    });
    const mel = [...phrase(r, 6, 4, 2, { cells: WALTZ, lo: 0, hi: 7 }), ...phrase(r, 6, 2, 0, { cells: WALTZ, lo: -1, hi: 6 })];
    b.fig('p1', 0, mel, K, 1, 0.24, { ...MEL, duty: 1 }, 0.9);
    return b.out();
  }
  b.n('tri', 0, 43, 11.5, 0.32, { a: 1 });
  b.n('air', 0.5, K(r.pick([0, 4])), 6, 0.14, { a: 1.2 });
  const n = 1 + r.int(2);
  for (let i = 0; i < n; i++) b.n('bell', 1 + r.int(8) * 0.5, K(r.pick([4, 2, 7, 9])) + 12, 2, 0.1, { ratio: 3.5, ...MEL });
  if (r.chance(0.6)) b.fig('p2', 6, GRAN, K, 1, 0.08, { duty: 1, a: 0.08 });
  return b.out();
}

const home: TrackDef = {
  bpm: 72, start: 'kitchen', vary: 0.4, wrong: 0.04, swing: 0.08, stumble: 0.05, slip: 0.06, bendy: 0.1, echo: 0.4, wobble: 8,
  graph: {
    kitchen: [['gran', 3], ['kitchen', 1], ['still', 1]],
    gran: [['kitchen', 3], ['still', 2]],
    still: [['gran', 2], ['kitchen', 2]],
  },
  secs: { kitchen: (c) => homeSec(c, 'kitchen'), gran: (c) => homeSec(c, 'gran'), still: (c) => homeSec(c, 'still') },
};

// ---------------------------------------------------------------- Turnstone: houses beside their whorls

const D_MIX = key(62, MODE.mix);

function fellSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const K = D_MIX, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, kind === 'b' ? [3, 0, 6, 4] : [0, 6, 3, 0], { 0: [0, 5], 6: [6, 4], 3: [3, 1], 4: [4, 1] }, 0.3);
  bassLine(b, K, roots, 4, 38, kind === 'c' ? 'hold' : 'walk', 0.42, r);
  heart(b, 0, 8, 0.1);
  if (kind === 'c') {
    b.fig('bell', 0, lack(aug(OURO, 2)), K, 1, 0.16, { ratio: 3.5, ...MEL });
    b.fig('air', 8, lack(aug(shift(OURO, 4), 2)), K, 0, 0.22, { a: 0.2, ...MEL });
    roots.forEach((R, i) => { const ch = voiced(K, R, 62, 4); b.n('p2', i * 4 + 1, ch[1 + r.int(3)], 2.5, 0.07, { duty: 1, a: 0.3 }); });
    return b.out();
  }
  // Every phrase has its whorl: the same line a bar later on the thin pulse, quieter, a little flat, and missing a note or two.
  const mel: Fig = kind === 'a'
    ? [...lack(OURO), ...phrase(r, 4, 4, 1, { lo: -1, hi: 8 }), ...phrase(r, 4, 3, 0, { lo: -1, hi: 8 })]
    : [...phrase(r, 4, 7, 5, { lo: 2, hi: 9 }), ...phrase(r, 4, 5, 4, { lo: 1, hi: 9 }), ...lack(shift(OURO, 3))];
  b.fig('p1', 0, mel, K, 0, 0.3, { ...MEL, duty: 1 }, 0.9);
  const pale = mel.map(([d, l], j): readonly [number | null, number] => [d !== null && j > 0 && r.chance(0.15) ? null : d, l]);
  b.fig('p2', 4, pale, K, 0, 0.14, { duty: 0, det: -14 }, 0.7);
  return b.out();
}

const fellside: TrackDef = {
  bpm: 92, start: 'a', vary: 0.55, wrong: 0.05, swing: 0.14, stumble: 0.05, slip: 0.15, bendy: 0.15, echo: 0.3, wobble: 6, spread: 9,
  graph: { a: [['b', 3], ['a', 1], ['c', 1]], b: [['a', 2], ['c', 2]], c: [['a', 3], ['b', 1]] },
  secs: { a: (c) => fellSec(c, 'a'), b: (c) => fellSec(c, 'b'), c: (c) => fellSec(c, 'c') },
};

// ---------------------------------------------------------------- the Midden Road

const A_DOR = key(57, MODE.dor);

function routeSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const K = A_DOR, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, kind === 'b' ? [3, 4, 0, 6] : [0, 3, 0, 4], { 0: [0, 5], 3: [3, 1], 4: [4, 6], 6: [6, 4] }, 0.35);
  bassLine(b, K, roots, 4, 40, 'walk', 0.42, r);
  for (let t = 0; t < 16; t += 0.5) b.hit(t, 'hat', t % 1 ? 0.035 : t % 2 ? 0.07 : 0.045, 0.05);
  heart(b, 0, 8, 0.13);
  roots.forEach((R, i) => comp(b, K, i * 4, 4, R, roots[(i + 1) % 4], 60, 0.1, r));
  const mx = { ...MEL, duty: 1 };
  if (kind === 'a') {
    // Ouro's figure walks the road a step higher each bar, and the missing degree leaves holes in it.
    let t = 0;
    for (const s of [0, 1, 2]) t = b.fig('p1', t, lack(shift(OURO, s)), K, 1, 0.3, mx, 0.85);
    b.fig('p1', t, phrase(r, 4, 4, 0), K, 1, 0.3, mx, 0.85);
  } else if (kind === 'b') {
    sing(b, r, 'p1', 0, [...phrase(r, 8, 4, 3, { hi: 9 }), ...phrase(r, 8, 5, 0, { hi: 9 })], K, 1, 0.3, 0.3, { ...MEL, duty: 3 }, 0.88);
  } else {
    const n = 2 + r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', r.int(28) * 0.5, K(7 + r.int(6)), 1.5, 0.13, { ratio: 3.5, ...MEL });
  }
  return b.out();
}

const route: TrackDef = {
  bpm: 104, start: 'a', vary: 0.6, wrong: 0.05, swing: 0.16, stumble: 0.06, slip: 0.2, bendy: 0.2, echo: 0.25, wobble: 5, spread: 8,
  graph: { a: [['b', 3], ['a', 1], ['c', 1]], b: [['a', 3], ['c', 2]], c: [['a', 2], ['b', 2]] },
  secs: { a: (c) => routeSec(c, 'a'), b: (c) => routeSec(c, 'b'), c: (c) => routeSec(c, 'c') },
};

// ---------------------------------------------------------------- towns: a jazz waltz with the Volute's pulse under it

const F_ION = key(53, MODE.ion);

function townSec(c: Ctx, kind: 'square' | 'talk' | 'drum'): Section {
  const K = F_ION, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, kind === 'talk' ? [4, 0, 4, 0] : [0, 3, 4, 0], { 0: [0, 5, 2], 3: [3, 1], 4: [4, 6] }, 0.35);
  roots.forEach((R, i) => {
    bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 4], 41, 'waltz', 0.42, r);
    const ch = voiced(K, R, 60, 4);
    b.n('p2', i * 3 + 1, ch[r.pick([1, 3])], 0.5, 0.1, { duty: 2 }).n('p2', i * 3 + 2, ch[2], 0.5, 0.09, { duty: 2 });
  });
  heart(b, 0, 6, kind === 'drum' ? 0.22 : 0.1);
  if (kind === 'square') {
    sing(b, r, 'p1', 0, [...phrase(r, 6, 4, 1, { cells: WALTZ }), ...phrase(r, 6, 2, 0, { cells: WALTZ })], K, 1, 0.28, 0.25, { ...MEL, duty: 1 }, 0.9);
  } else if (kind === 'talk') {
    // Townsfolk: flat repeated notes, and one tritone said as if it were ordinary.
    for (let i = 0; i < 4; i++) {
      const d = r.pick([4, 2, 0, 5]), n = 2 + r.int(3), odd = r.int(n);
      for (let j = 0; j < n; j++) b.n('bell', i * 3 + j * 0.5, K(d) + 12 + (j === odd ? 6 : 0), 0.4, 0.13, { ratio: 2, ...MEL });
    }
  } else {
    b.fig('air', 0, lack(aug(OURO, 1.5)), K, 1, 0.24, { a: 0.1, ...MEL });
    b.fig('air', 6, lack(aug(shift(OURO, -3), 1.5)), K, 1, 0.22, { a: 0.1, ...MEL });
  }
  return b.out();
}

const town: TrackDef = {
  bpm: 84, start: 'square', vary: 0.55, wrong: 0.05, swing: 0.12, stumble: 0.05, slip: 0.15, bendy: 0.15, echo: 0.3, wobble: 6,
  graph: { square: [['talk', 2], ['drum', 2], ['square', 1]], talk: [['square', 3], ['drum', 1]], drum: [['square', 2], ['talk', 2]] },
  secs: { square: (c) => townSec(c, 'square'), talk: (c) => townSec(c, 'talk'), drum: (c) => townSec(c, 'drum') },
};

// ---------------------------------------------------------------- keepers' halls, in 5/4

const C_HMIN = key(48, MODE.hmin);

function gymSec(c: Ctx, kind: 'march' | 'hold' | 'call'): Section {
  const K = C_HMIN, r = c.r, b = new B(20, 5, c.bpm);
  if (kind === 'hold') {
    b.n('tri', 0, 36, 9.8, 0.45, { a: 0.3 }).n('tri', 10, r.pick([36, 43, 41]), 9.8, 0.42, { a: 0.3 });
    heart(b, 0, 2.5, 0.2);
    const a = K(4) + 12, z = K(5) + 12;
    for (let i = 0; i < 40; i++) b.n('p2', i * 0.5, i % 2 ? z : a, 0.4, 0.07 + (i / 40) * 0.06, { duty: 0 });
    b.n('bell', r.pick([4, 6, 8]), K(r.pick([6, 4])) + 24, 2, 0.12, { ratio: 1.41, ...MEL });
    return b.out();
  }
  const roots = prog(r, kind === 'march' ? [0, 5, 3, 4] : [0, 3, 5, 4], { 0: [0, 0, 5], 5: [5, 3], 3: [3, 1] }, 0.25);
  roots.forEach((R, i) => {
    const t0 = i * 5, p = fold(K(R), 36);
    // 3 + 2: the heartbeat on one, a snare on the short group.
    b.n('tri', t0, p, 1.4, 0.48).n('tri', t0 + 1.5, p + 12, 1.4, 0.4).n('tri', t0 + 3, p + K(R + 4) - K(R), 0.9, 0.42).n('tri', t0 + 4, p + 12, 0.9, 0.38);
    heart(b, t0, 5, 0.28, { to: t0 + 1 });
    b.hit(t0 + 3, 'snare', 0.17, 0.15);
    if (r.chance(0.35)) b.hit(t0 + 4.5, 'snare', 0.1, 0.1);
    const ch = voiced(K, R, 60, 4);
    [1, 2, 4].forEach((o) => b.n('p2', t0 + o, ch[r.int(4)], 0.3, 0.11, { duty: 2 }));
  });
  if (kind === 'march') {
    const cells = [[1.5, 0.5, 3], [1.5, 0.5, 1, 2], [0.75, 0.25, 2, 2], [3, 2]];
    sing(b, r, 'p1', 0, [...phrase(r, 10, 4, 6, { cells }), ...phrase(r, 10, 6, 0, { cells })], K, 1, 0.3, 0.3, { ...MEL, duty: 3 }, 0.85);
  } else {
    b.fig('p1', 0, lack(aug(OURO, 1.25)), K, 1, 0.3, { ...MEL, duty: 3 });
    b.fig('p1', 5, phrase(r, 5, 4, 6), K, 1, 0.3, { ...MEL, duty: 3 });
    b.fig('p1', 10, lack(aug(shift(OURO, 3), 1.25)), K, 1, 0.3, { ...MEL, duty: 3 });
    b.fig('p1', 15, phrase(r, 5, 6, 7), K, 1, 0.3, { ...MEL, duty: 3 });
  }
  return b.out();
}

const gym: TrackDef = {
  bpm: 104, start: 'march', vary: 0.5, wrong: 0.05, slip: 0.12, bendy: 0.15, echo: 0.2, wobble: 4,
  graph: { march: [['call', 3], ['hold', 1], ['march', 1]], call: [['march', 3], ['hold', 1]], hold: [['march', 2], ['call', 2]] },
  secs: { march: (c) => gymSec(c, 'march'), hold: (c) => gymSec(c, 'hold'), call: (c) => gymSec(c, 'call') },
};

// ---------------------------------------------------------------- tabletop minigames: swung, with a bar too short

const EB_ION = key(51, MODE.ion);
const MINI_BARS = [4, 4, 4, 3];

function miniSec(c: Ctx, kind: 'hook' | 'call' | 'break'): Section {
  const K = EB_ION, r = c.r, b = new B(15, 4, c.bpm);
  if (!c.mem.hook) c.mem.hook = phrase(r, 8, 4, 0, { cells: FAST, hi: 9 }).flatMap(([d, l]) => [d ?? -99, l]);
  const roots = prog(r, kind === 'call' ? [3, 1, 4, 0] : [0, 5, 1, 4], { 0: [0, 2], 5: [5, 3], 1: [1, 6], 4: [4, 6] }, 0.4);
  let t0 = 0;
  MINI_BARS.forEach((bar, i) => {
    bassBar(b, K, t0, bar, roots[i], roots[(i + 1) % 4], 39, 'walk', 0.42, r);
    for (let j = 0; j < bar * 2; j++) b.hit(t0 + j * 0.5, j % 2 ? 'hat' : j % 4 === 2 ? 'tock' : 'hat', j % 4 === 2 ? 0.08 : 0.04, 0.05);
    if (kind !== 'break') comp(b, K, t0, bar, roots[i], roots[(i + 1) % 4], 63, 0.1, r);
    t0 += bar;
  });
  if (kind === 'hook') {
    // The hook comes back every time, and every time one note of it is somewhere else.
    const h = c.mem.hook, f: Array<[number | null, number]> = [];
    for (let i = 0; i < h.length; i += 2) f.push([h[i] === -99 ? null : h[i], h[i + 1]]);
    const w = r.int(f.length);
    if (f[w][0] !== null) f[w] = [(f[w][0] as number) + r.pick([1, -1, 2, -3]), f[w][1]];
    b.fig('p1', 0, f, K, 1, 0.28, { ...MEL, duty: 1 }, 0.8);
    sing(b, r, 'p1', 8, phrase(r, 7, 3, 0, { cells: FAST }), K, 1, 0.28, 0.35, { ...MEL, duty: 1 }, 0.8);
  } else if (kind === 'call') {
    for (let i = 0; i < 3; i++) {
      b.fig('bell', i * 4, phrase(r, 2, r.pick([4, 7]), r.pick([5, 8]), { cells: FAST }), K, 1, 0.14, { ratio: 3.5, ...MEL });
      b.fig('p1', i * 4 + 2, phrase(r, 2, 4, r.pick([2, 0, 1]), { cells: FAST }), K, 1, 0.26, { ...MEL, duty: 2 }, 0.7);
    }
    b.n('p1', 12, K(r.pick([6, 3])) + 12, 2.5, 0.26, { ...MEL, duty: 2, bend: -1 });
  } else {
    b.n('air', 1, K(r.pick([4, 1])) + 12, 6, 0.22, { a: 0.2, bend: r.pick([-1, 1, -2]), ...MEL });
    b.n('air', 8, K(r.pick([0, 5])) + 12, 6, 0.2, { a: 0.2, bend: r.pick([-1, 0.5]), ...MEL });
  }
  return b.out();
}

const minigame: TrackDef = {
  bpm: 132, start: 'hook', vary: 0.55, wrong: 0.06, swing: 0.18, stumble: 0.08, slip: 0.3, bendy: 0.25, echo: 0.2, wobble: 5, spread: 10,
  graph: { hook: [['call', 3], ['hook', 1], ['break', 1]], call: [['hook', 3], ['break', 1]], break: [['hook', 2], ['call', 1]] },
  secs: { hook: (c) => miniSec(c, 'hook'), call: (c) => miniSec(c, 'call'), break: (c) => miniSec(c, 'break') },
};

// ---------------------------------------------------------------- trainer battles, in 7/8

const A_AEO = key(57, MODE.aeo);

function battleSec(c: Ctx, kind: 'a' | 'b' | 'c'): Section {
  const K = A_AEO, r = c.r, bar = 3.5, b = new B(bar * 4, bar, c.bpm);
  const base = kind === 'a' ? r.pick([[0, 5, 3, 4], [0, 6, 5, 4]]) : kind === 'b' ? r.pick([[5, 6, 0, 4], [3, 4, 5, 4]]) : [0, 0, 5, 4];
  base.forEach((R, i) => {
    const t0 = i * bar, p = fold(K(R), 33), five = K(R + 4) - K(R);
    // Seven eighths grouped 2 + 2 + 3.
    [0, 12, 0, 12, 0, five, 12].forEach((o, j) => b.n('tri', t0 + j * 0.5, p + o, 0.42, j === 0 || j === 2 || j === 4 ? 0.55 : 0.4));
    if (kind === 'c') heart(b, t0, bar, 0.38, { to: t0 + 1 });
    else b.hit(t0, 'kick', 0.4, 0.2);
    b.hit(t0 + 1, 'snare', 0.24, 0.15).hit(t0 + 2, 'kick', 0.3, 0.2).hit(t0 + 3, 'snare', 0.2, 0.15);
    for (const j of [1, 3, 5]) b.hit(t0 + j * 0.5, 'hat', 0.06, 0.05, { lay: 0.3 });
    const ch = voiced(K, R, 57, 4);
    [0.5, 1.5, 2.5].forEach((o, j) => b.n('p2', t0 + o, ch[(j + i) % 4], 0.3, 0.13, { duty: 2, top: 0.75 }));
    arp(b, 'p2', t0, bar, ch, [0, 1, 2, 3, 2, 1, 4], 0.25, 0.11, { duty: 1, lay: 0.75 });
  });
  const mx = { ...MEL, duty: 1 };
  if (kind === 'a') {
    // Ouro's figure at double speed with its hole kept, and three eighths of answer to fill the bar.
    for (let i = 0; i < 4; i++) {
      const t = b.fig('p1', i * bar, lack(aug(shift(OURO, [0, 3, 1, 4][i]), 0.5)), K, 1, 0.32, mx, 0.85);
      b.fig('p1', t, phrase(r, 1.5, r.pick([4, 5, 2]), r.pick([3, 4, 0]), { cells: FAST }), K, 1, 0.32, mx, 0.85);
    }
  } else if (kind === 'b') {
    sing(b, r, 'p1', 0, [...phrase(r, 7, 4, 6, { cells: FAST, hi: 10 }), ...phrase(r, 7, 7, 4, { cells: FAST, hi: 10 })], K, 1, 0.32, 0.3, mx, 0.85);
  } else {
    sing(b, r, 'p1', 0, [[4, 2.5], [3, 1], [1, 3.5], [0, 2.5], [-1, 1, 1], [0, 3.5]], K, 1, 0.3, 0.5, mx, 0.95);
  }
  bellCopy(b, 0.55, 0.09);
  return b.out();
}

const battle: TrackDef = {
  bpm: 152, start: 'a', vary: 0.5, wrong: 0.05, slip: 0.15, bendy: 0.12, echo: 0.15, wobble: 4, spread: 8,
  graph: { a: [['b', 3], ['a', 1], ['c', 1]], b: [['a', 3], ['c', 2]], c: [['a', 3], ['b', 1]] },
  secs: { a: (c) => battleSec(c, 'a'), b: (c) => battleSec(c, 'b'), c: (c) => battleSec(c, 'c') },
};

// ---------------------------------------------------------------- wild whorls: short, light, skipping

const E_DOR = key(64, MODE.dor);

function wildSec(c: Ctx, kind: 'a' | 'b'): Section {
  const K = E_DOR, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, kind === 'a' ? [0, 3, 0, 4] : [6, 3, 4, 0], { 0: [0, 5], 3: [3, 1], 4: [4, 6], 6: [6, 4] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 3, p = fold(K(R), 40), five = p + K(R + 4) - K(R);
    b.n('tri', t0, p, 0.9, 0.5).n('tri', t0 + 1.5, five, 0.9, 0.42);
    if (r.chance(0.5)) b.n('tri', t0 + 2.5, p + 12, 0.4, 0.35);
    b.hit(t0, 'kick', 0.3, 0.2).hit(t0 + 1.5, 'snare', 0.16, 0.15);
    for (let j = 1; j < 6; j++) if (j !== 3) b.hit(t0 + j * 0.5, 'hat', 0.05, 0.05);
    const ch = voiced(K, R, 64);
    b.n('p2', t0 + 0.5, ch[1], 0.35, 0.1, { duty: 2, top: 0.7 }).n('p2', t0 + 2, ch[2], 0.35, 0.1, { duty: 2, top: 0.7 });
    arp(b, 'p2', t0, 3, ch, [0, 1, 2, 3, 2, 1], 0.5, 0.1, { duty: 0, lay: 0.7 });
  });
  sing(b, r, 'p1', 0, [...phrase(r, 6, 4, 2, { cells: SKIP, hi: 9 }), ...phrase(r, 6, 3, 0, { cells: SKIP, hi: 9 })], K, 0, 0.28, 0.2, { ...MEL, duty: 2 }, 0.6);
  for (let i = 0; i < 3; i++) b.n('bell', 1 + i * 4 + r.int(4) * 0.5, K(5 + r.int(5)) + 12, 0.5, 0.1, { ratio: 3.5, lay: 0.5 });
  return b.out();
}

const wild: TrackDef = {
  bpm: 168, start: 'a', vary: 0.55, wrong: 0.08, slip: 0.12, bendy: 0.1, echo: 0.2, wobble: 4,
  graph: { a: [['b', 3], ['a', 1]], b: [['a', 3], ['b', 1]] },
  secs: { a: (c) => wildSec(c, 'a'), b: (c) => wildSec(c, 'b') },
};

// ---------------------------------------------------------------- keepers and bosses: the Volute's pulse itself

const D_PHR = key(50, MODE.phr);

function keeperSec(c: Ctx, kind: 'beat' | 'stay' | 'skin'): Section {
  const K = D_PHR, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, kind === 'stay' ? [0, 1, 6, 0] : [0, 0, 1, 0], { 0: [0, 0, 5], 1: [1, 6], 6: [6, 5] }, 0.25);
  const sn = kind === 'skin' ? 0.5 : 0;
  roots.forEach((R, i) => {
    const t0 = i * 4, p = fold(K(R), 38);
    // The bass is the heartbeat: two lub-dubs a bar on triangle and noise.
    heart(b, t0, 2, kind === 'skin' ? 0.3 : 0.4, { root: p, to: t0 + 4 });
    b.n('tri', t0 + 1, p + 12, 0.3, 0.35, { lay: 0.6 }).n('tri', t0 + 3, p + 7, 0.3, 0.35, { lay: 0.6 });
    // Above 0.75 the heart doubles: a lub-dub on every beat, and the snares make way.
    b.hit(t0 + 1, 'snare', 0.2, 0.15, { lay: sn, top: 0.75 }).hit(t0 + 3, 'snare', 0.22, 0.15, { lay: sn, top: 0.75 });
    b.hit(t0 + 1, 'thud', 0.34, 0.3, { lay: 0.75 }).hit(t0 + 1.5, 'thud', 0.2, 0.3, { lay: 0.75 });
    b.hit(t0 + 3, 'thud', 0.34, 0.3, { lay: 0.75 }).hit(t0 + 3.5, 'thud', 0.2, 0.3, { lay: 0.75 });
    for (const o of [0.25, 1.25, 2.25, 3.25]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.35 });
    arp(b, 'p2', t0, 4, voiced(K, R, 62, 4), [0, 2, 1, 3, 2, 4, 3, 1], 0.5, 0.1, { duty: 0, lay: 0.5 });
  });
  const mx = { ...MEL, duty: 3 };
  if (kind === 'beat') {
    const cells = [[1.5, 0.5, 2], [0.5, 0.5, 1, 2], [1.5, 0.5, 1, 1], [0.75, 0.25, 3]];
    sing(b, r, 'p1', 0, [...phrase(r, 8, 0, 1, { cells, hi: 7 }), ...phrase(r, 8, 4, 0, { cells, hi: 8 })], K, 1, 0.32, 0.35, mx, 0.88);
  } else if (kind === 'stay') {
    b.fig('bell', 0, [...phrase(r, 8, 4, 1, { cells: SLOW }), ...phrase(r, 8, 5, 0, { cells: SLOW })], K, 2, 0.16, { ratio: 1.41, ...MEL });
    b.fig('p1', 2, [...phrase(r, 6, 2, 1), [null, 2], ...phrase(r, 6, 1, 0)], K, 1, 0.26, { ...mx, lay: 0.4 });
  } else {
    b.n('air', 0, K(r.pick([0, 1])) + 12, 7.5, 0.24, { a: 0.6, bend: -0.5 }).n('air', 8, K(r.pick([4, 1])) + 12, 7.5, 0.22, { a: 0.6, bend: r.pick([-1, 0.5]) });
    b.fig('p1', 0, phrase(r, 16, 4, 0, { cells: SLOW }), K, 1, 0.26, { ...mx, lay: 0.5 });
  }
  return b.out();
}

const keeper: TrackDef = {
  bpm: 132, start: 'beat', vary: 0.45, wrong: 0.04, slip: 0.1, bendy: 0.15, echo: 0.18, wobble: 4,
  graph: { beat: [['stay', 3], ['beat', 1], ['skin', 1]], stay: [['beat', 3], ['skin', 1]], skin: [['beat', 2], ['stay', 1]] },
  secs: { beat: (c) => keeperSec(c, 'beat'), stay: (c) => keeperSec(c, 'stay'), skin: (c) => keeperSec(c, 'skin') },
};

// ---------------------------------------------------------------- Tack: bars of 2, 3, 4, and 5 beats

const B_AEO = key(59, MODE.aeo);
const TACK_BARS = [2, 3, 4, 5];

function rivalSec(c: Ctx, kind: 'count' | 'tune' | 'drill'): Section {
  const K = B_AEO, r = c.r, b = new B(14, 4, c.bpm);
  const roots = prog(r, kind === 'tune' ? [0, 5, 2, 6] : [0, 3, 5, 4], { 0: [0, 5], 3: [3, 1], 5: [5, 3], 4: [4, 6], 2: [2, 4] }, 0.25);
  let t0 = 0;
  TACK_BARS.forEach((bar, i) => {
    const p = fold(K(roots[i]), 35);
    if (kind === 'drill') for (let j = 0; j < bar; j++) b.n('tri', t0 + j, j === 0 ? p : p + 12, 0.8, j === 0 ? 0.55 : 0.42);
    else for (let j = 0; j < bar * 2; j++) b.n('tri', t0 + j * 0.5, j % 4 === 2 ? p + 12 : j === bar * 2 - 1 ? p + 7 : p, 0.42, j % 2 ? 0.4 : 0.52);
    // Tack counts the bar too: one kick per beat of the bar's number.
    b.hit(t0, 'kick', 0.4, 0.2);
    for (let j = 1; j < bar; j++) b.hit(t0 + j, j % 2 ? 'snare' : 'kick', j % 2 ? 0.2 : 0.28, 0.15);
    for (let j = 0; j < bar; j++) b.hit(t0 + j + 0.5, 'hat', 0.06, 0.05, { lay: 0.3 });
    const ch = voiced(K, roots[i], 59, 4);
    for (let j = 0; j < bar; j++) b.n('p2', t0 + j + 0.5, ch[(j + i) % 4], 0.3, 0.12, { duty: 2, top: 0.8 });
    arp(b, 'p2', t0, bar, ch, [0, 1, 2, 3], 0.25, 0.1, { duty: 1, lay: 0.8 });
    t0 += bar;
  });
  if (kind === 'count') {
    // Seven counts across the four bars, so the counts fall across the bar lines differently each time.
    for (let i = 0; i < 7; i++) tackCount(b, c, 'p1', i * 2, K, [0, 2, 4, 3, 1, 4, 0][i], 1, 0.5, 0.32);
  } else if (kind === 'tune') {
    // One note in the first bar, two in the second, three in the third, four in the fourth.
    const s = r.pick([0, 2, -1]);
    const mel: Fig = [[4 + s, 2], [5 + s, 1.5], [3 + s, 1.5], [2, 4 / 3], [1, 4 / 3], [0, 4 / 3], [1, 1.25], [2, 1.25], [3, 1.25], [4, 1.25]];
    sing(b, r, 'p1', 0, mel, K, 1, 0.32, 0.3, { ...MEL, duty: 1 }, 0.92);
  } else {
    for (let i = 0; i < 7; i++) tackCount(b, c, 'bell', i * 2, K, roots[Math.min(3, i >> 1)], 1, 0.5, 0.16, { ratio: 3.5 });
  }
  bellCopy(b, 0.6, 0.08);
  return b.out();
}

const rival: TrackDef = {
  bpm: 144, start: 'count', vary: 0.3, wrong: 0.04, slip: 0.12, echo: 0.15, wobble: 3, spread: 6,
  graph: { count: [['tune', 3], ['drill', 1], ['count', 1]], tune: [['count', 3], ['drill', 1]], drill: [['count', 2], ['tune', 2]] },
  secs: { count: (c) => rivalSec(c, 'count'), tune: (c) => rivalSec(c, 'tune'), drill: (c) => rivalSec(c, 'drill') },
};

// ---------------------------------------------------------------- Full, the moon's first whorl: a tide

const FS_AEO = key(54, MODE.aeo);

function legendSec(c: Ctx, kind: 'swell' | 'pull' | 'ebb'): Section {
  const tide = (c.st.tide = (c.st.tide ?? 0) + 1);
  const bpm = Math.round(124 + 16 * Math.sin((tide * 2 * Math.PI) / 7));
  const K = FS_AEO, r = c.r, b = new B(16, 4, bpm);
  const roots = prog(r, kind === 'ebb' ? [0, 6, 5, 4] : [0, 5, 6, 4], { 0: [0, 3], 5: [5, 3], 6: [6, 4] }, 0.25);
  roots.forEach((R, i) => {
    const t0 = i * 4, p = fold(K(R), 38);
    // The last eighth of every bar is pulled up a semitone toward the next.
    for (let j = 0; j < 8; j++) b.n('tri', t0 + j * 0.5, j % 2 ? p + 12 : p, 0.45, j % 2 ? 0.42 : 0.52, j === 7 ? { bend: 1 } : undefined);
    b.hit(t0, 'kick', 0.38, 0.2).hit(t0 + 1.5, 'kick', 0.24, 0.2).hit(t0 + 3, 'snare', 0.24, 0.15);
    if (kind !== 'ebb') b.hit(t0 + 1, 'snare', 0.14, 0.12, { lay: 0.45 });
    for (const o of [0.5, 2, 2.5, 3.5]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.3 });
    arp(b, 'p2', t0, 4, voiced(K, R, 61, 4), [0, 1, 2, 3, 4, 3, 2, 1], 0.5, 0.1, { duty: 1, lay: 0.6, bend: 0.5 });
  });
  if (kind === 'swell') {
    full(b, 'air', 0, K, 1, 0.32, 2);
    b.n('p1', 4, K(4) + 12, 3.5, 0.2, { duty: 1, a: 0.3, bend: 1, lay: 0.4 }).n('p1', 12, K(5) + 12, 3.5, 0.2, { duty: 1, a: 0.3, bend: -1, lay: 0.4 });
  } else if (kind === 'pull') {
    full(b, 'p1', 0, K, 1, 0.3, 1, { duty: 3 });
    full(b, 'p1', 8, K, 1, 0.3, 1, { duty: 3, det: 30 });
    b.fig('bell', 0, aug(FULL, 2), K, 2, 0.1, { ratio: 3.5, lay: 0.8 });
  } else {
    sing(b, r, 'air', 0, phrase(r, 16, 5, 0, { cells: SLOW }), K, 0, 0.28, 0.6, { a: 0.3, ...MEL });
    for (let i = 0; i < 3; i++) b.n('bell', 2 + i * 5 + r.int(2), K(7 + r.int(4)) + 12, 2, 0.12, { ratio: 3.5, bend: -1 });
  }
  const sec = b.out();
  return kind === 'pull' ? lean(sec, 0.95, 1.25) : kind === 'ebb' ? lean(sec, 1.15, 0.88) : sec;
}

const legend: TrackDef = {
  bpm: 124, start: 'swell', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.3, echo: 0.35, wobble: 9,
  graph: { swell: [['pull', 3], ['ebb', 1]], pull: [['ebb', 3], ['swell', 1], ['pull', 1]], ebb: [['swell', 3], ['pull', 1]] },
  secs: { swell: (c) => legendSec(c, 'swell'), pull: (c) => legendSec(c, 'pull'), ebb: (c) => legendSec(c, 'ebb') },
};

// ---------------------------------------------------------------- the Hands at the Apex, in 5/4

const G_HMIN = key(55, MODE.hmin);

function handSec(c: Ctx, kind: 'fid' | 'lug' | 'hasp' | 'purchase'): Section {
  const K = G_HMIN, r = c.r, bar = 5, b = new B(20, bar, c.bpm);
  const roots = prog(r, [0, 5, 3, 4], { 0: [0, 0, 5], 5: [5, 1], 3: [3, 1] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * bar, p = fold(K(R), 36), five = K(R + 4) - K(R);
    b.n('tri', t0, p, 1.4, 0.52).n('tri', t0 + 1.5, p + five, 1.4, 0.44).n('tri', t0 + 3, p + 12, 0.9, 0.44).n('tri', t0 + 4, fold(K(roots[(i + 1) % 4]), 36) + 1, 0.9, 0.4);
    b.hit(t0, 'kick', 0.4, 0.2).hit(t0 + 1.5, 'kick', 0.28, 0.2).hit(t0 + 3, 'snare', 0.24, 0.15).hit(t0 + 4, 'snare', 0.16, 0.15);
    for (const o of [0.5, 1, 2, 2.5, 3.5, 4.5]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.3 });
    if (i === 0) heart(b, t0 + 2, 5, 0.22, { x: { lay: 0.6 }, to: t0 + 3 });
  });
  // The Operculum's four arms: Cinch's habit, far off on the bell, under every Hand.
  habit(b, 'bell', 0, K, 2, 5, 2, 0.06, { ratio: 1.41, top: 0.7 });
  const mx = { ...MEL, duty: 1 };
  if (kind === 'fid') {
    // Fid measures: every interval wider than the last, every note longer.
    let d = 0, t = 0;
    for (let i = 0; i < 6; i++) { const len = [0.5, 1, 1.5, 2, 2.5, 2.5][i]; b.n('p1', t, K(d) + 12, len * 0.9, 0.3, mx); t += len; d += (i % 2 ? -1 : 1) * (i + 1); }
    b.fig('p1', 10, phrase(r, 10, 4, 0, { cells: MARCH }), K, 1, 0.3, mx, 0.85);
  } else if (kind === 'lug') {
    // Lug's weather is indoors: a close drizzle of soft quick notes under a held one.
    for (let t = 0; t < 20; t += 0.25) if (r.chance(0.5)) b.n('p1', t, K(7 + r.int(5)) + 12, 0.15, 0.12, { duty: 0 });
    b.n('air', 0, K(4) + 12, 9.5, 0.22, { a: 1, bend: -0.5 }).n('air', 10, K(r.pick([3, 5])) + 12, 9.5, 0.22, { a: 1, bend: 0.5 });
  } else if (kind === 'hasp') {
    // Hasp only asks: phrases that end on a rising leap and are never answered.
    for (let i = 0; i < 4; i++) {
      const t = b.fig('p1', i * bar, phrase(r, 3, r.pick([0, 2, 4]), r.pick([1, 3]), { cells: FAST }), K, 1, 0.3, mx, 0.85);
      b.n('p1', t, K(r.pick([5, 6, 7])) + 12, 1.2, 0.3, { ...mx, bend: 0.5 });
    }
  } else {
    // Purchase tallies: two, then three, then a price a step higher.
    for (let i = 0; i < 4; i++) {
      const d = r.pick([0, 2, 4]), t0 = i * bar;
      for (let j = 0; j < 2; j++) b.n('p1', t0 + j * 0.5, K(d) + 12, 0.3, 0.26, { duty: 2 });
      for (let j = 0; j < 3; j++) b.n('p1', t0 + 1.5 + j * 0.5, K(d + 1) + 12, 0.3, 0.26, { duty: 2 });
      b.n('p1', t0 + 3, K(d + r.pick([3, 4, 5])) + 12, 1.6, 0.3, { ...mx, duty: 2 });
    }
  }
  arp(b, 'p2', 0, 20, voiced(K, 0, 55, 4), [0, 1, 2, 3, 2, 1, 0, 3, 2, 1], 0.5, 0.09, { duty: 0, lay: 0.5 });
  bellCopy(b, 0.7, 0.08, true);
  return b.out();
}

const battleHand: TrackDef = {
  bpm: 132, start: 'fid', vary: 0.45, wrong: 0.05, slip: 0.12, bendy: 0.15, echo: 0.18, wobble: 3, spread: 7,
  next: (cur, c) => c.r.weighted(([['fid', 1], ['lug', 1], ['hasp', 1], ['purchase', 1]] as const).map(([k, w]) => [k, k === cur ? 0.3 : w] as const)),
  secs: { fid: (c) => handSec(c, 'fid'), lug: (c) => handSec(c, 'lug'), hasp: (c) => handSec(c, 'hasp'), purchase: (c) => handSec(c, 'purchase') },
};

// ---------------------------------------------------------------- Cinch at the Operculum: the held note and the habit

function cinchBattleSec(c: Ctx, kind: 'turn' | 'grip'): Section {
  const K = C_HMIN, r = c.r, b = new B(16, 4, c.bpm);
  // Over a long fight the habit wears: notes go missing, drift flat, and come late. Nobody is having it any more.
  const wear = Math.min(1, c.pass / 20);
  b.n('p2', 0, K(CINCH_HOLD) + 12, 16, 0.1, { duty: 1, a: 0.02, pin: 1 });
  const roots = kind === 'turn' ? prog(r, [0, 5, 3, 4], { 0: [0, 5], 3: [3, 1] }, 0.3) : prog(r, [5, 3, 1, 4], { 5: [5, 0], 1: [1, 3] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 4, p = fold(K(R), 36);
    for (let j = 0; j < 8; j++) b.n('tri', t0 + j * 0.5, j % 2 ? p + 12 : p, 0.42, j % 2 ? 0.4 : 0.52);
    b.hit(t0, 'kick', 0.4, 0.2).hit(t0 + 1, 'snare', 0.22, 0.15).hit(t0 + 2, 'kick', 0.32, 0.2).hit(t0 + 3, 'snare', 0.24, 0.15);
    for (const o of [0.5, 1.5, 2.5, 3.5]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.4 });
  });
  for (let i = 0; i < 16; i++) {
    if (r.chance(wear * 0.7)) continue;
    const t = Math.max(0, i + r.range(0, 0.22) * wear);
    b.n('p1', t, K(i % 2 ? 5 : 4) + 12, 0.7, 0.3 * (1 - wear * 0.45), { duty: 2, det: -wear * 40 });
  }
  // Ouro's figure against it, only when the fight is going badly.
  b.fig('air', 0, lack(aug(OURO, 2)), K, 1, 0.24, { a: 0.1, lay: 0.5, top: 0.85, ...MEL });
  b.fig('air', 8, lack(aug(shift(OURO, 3), 2)), K, 1, 0.22, { a: 0.1, lay: 0.5, top: 0.85, ...MEL });
  for (let i = 0; i < 4; i++) b.n('bell', i * 4 + 2, K(CINCH_HOLD) + 24, 1.5, 0.08, { ratio: 1.41, lay: 0.85 });
  return b.out();
}

const battleCinch: TrackDef = {
  bpm: 120, start: 'turn', vary: 0.3, wrong: 0.03, slip: 0.06, echo: 0.2, wobble: 3,
  graph: { turn: [['grip', 2], ['turn', 2]], grip: [['turn', 3], ['grip', 1]] },
  secs: { turn: (c) => cinchBattleSec(c, 'turn'), grip: (c) => cinchBattleSec(c, 'grip') },
};

// ---------------------------------------------------------------- the Hermits' grunts and lieutenants, in 7/8

const C_AEO = key(60, MODE.aeo);

function peelBattleSec(c: Ctx, kind: 'riff' | 'zest' | 'pith'): Section {
  const K = C_AEO, r = c.r, bar = 3.5, b = new B(bar * 4, bar, c.bpm);
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar, from = -i;
    // The bass peels too: seven eighths down the scale from a step lower each bar.
    [7, 6, 5, 4, 3, 1, 0].forEach((d, j) => b.n('tri', t0 + j * 0.5, fold(K(d + from), 36) + (j < 3 ? 12 : 0), 0.42, j === 0 ? 0.55 : 0.42));
    b.hit(t0, 'stamp', 0.36, 0.3).hit(t0 + 1, 'kick', 0.3, 0.2).hit(t0 + 2, 'snare', 0.22, 0.15).hit(t0 + 3, 'kick', 0.24, 0.2);
    for (const j of [1, 3, 5, 6]) b.hit(t0 + j * 0.5, 'hat', 0.05, 0.05, { lay: 0.35 });
    arp(b, 'p2', t0, bar, voiced(K, from, 60, 4), [3, 2, 1, 0, 2, 1, 0], 0.5, 0.1, { duty: 0, lay: 0.5 });
  }
  const mx = { ...MEL, duty: 1 };
  if (kind === 'riff') {
    for (let i = 0; i < 4; i++) peel(b, 'p1', i * bar, K, 1, 0.3, -i + r.pick([0, 0, 2]), { duty: 1 });
  } else if (kind === 'zest') {
    // Tellin is always in the middle of doing it: sixteenths that never stop.
    let d = r.pick([7, 9]);
    for (let t = 0; t < b.beats - 0.01; t += 0.25) {
      b.n('p1', t, K(d), 0.2, t % 1 ? 0.2 : 0.28, { duty: 0 });
      d += r.chance(0.7) ? -1 : 2;
      if (d < 2) d += 7;
      if (d > 11) d -= 7;
    }
  } else {
    // Murex only asks: each phrase stops on a rising step.
    for (let i = 0; i < 4; i++) {
      const t = b.fig('p1', i * bar, phrase(r, 2.5, r.pick([0, 2, 4]), r.pick([2, 3]), { cells: FAST }), K, 1, 0.3, mx, 0.85);
      b.n('p1', t, K(r.pick([4, 5])) + 12 + 1, 0.9, 0.3, { ...mx, bend: 0.5 });
    }
  }
  bellCopy(b, 0.75, 0.08, true);
  return b.out();
}

const battlePeel: TrackDef = {
  bpm: 146, start: 'riff', vary: 0.45, wrong: 0.05, slip: 0.15, bendy: 0.15, echo: 0.15, wobble: 4, spread: 10,
  graph: { riff: [['zest', 2], ['pith', 2], ['riff', 1]], zest: [['riff', 3], ['pith', 1]], pith: [['riff', 3], ['zest', 1]] },
  secs: { riff: (c) => peelBattleSec(c, 'riff'), zest: (c) => peelBattleSec(c, 'zest'), pith: (c) => peelBattleSec(c, 'pith') },
};

// ---------------------------------------------------------------- Bare: bars that breathe in for 4 and out for 6

function bareSec(c: Ctx, kind: 'breathe' | 'push' | 'let'): Section {
  const K = key(60, MODE.dor), r = c.r, b = new B(20, 5, c.bpm);
  const roots = prog(r, [0, 6, 5, 4], { 0: [0, 3], 6: [6, 4], 5: [5, 3] }, 0.3);
  // In for four beats, out for six, twice.
  const bars: Array<[number, number, number]> = [[0, 4, roots[0]], [4, 6, roots[1]], [10, 4, roots[2]], [14, 6, roots[3]]];
  for (const [t0, len, R] of bars) {
    const p = fold(K(R), 36);
    if (kind === 'let') b.n('tri', t0, p, len * 0.97, 0.38, { a: 0.2 });
    else for (let j = 0; j < len * 2; j++) b.n('tri', t0 + j * 0.5, j % 4 === 3 ? p + 12 : p, 0.42, j % 2 ? 0.4 : 0.5);
    if (kind === 'let') heart(b, t0, len, 0.16, { to: t0 + 1 });
    else {
      b.hit(t0, 'kick', 0.38, 0.2);
      for (let j = 1; j < len; j++) b.hit(t0 + j, j % 2 ? 'snare' : 'kick', j % 2 ? 0.2 : 0.26, 0.15);
    }
    for (let j = 0; j < len; j++) b.hit(t0 + j + 0.5, 'hat', 0.05, 0.05, { lay: kind === 'let' ? 0.5 : 0.35 });
    const ch = voiced(K, R, 60, 4);
    if (kind !== 'let') for (let j = 0; j < len; j++) b.n('p2', t0 + j + 0.5, ch[(j * 3) % 4], 0.3, 0.11, { duty: 2, top: 0.8 });
    arp(b, 'p2', t0, len, ch, [0, 1, 2, 3, 2, 1], 0.25, 0.09, { duty: 1, lay: 0.8 });
  }
  if (kind === 'breathe') {
    exhale(b, 4, K, 0, 0.3, 1.25);
  } else if (kind === 'push') {
    // Bare's falls at a run, every interval wider, every note let go.
    sing(b, r, 'p1', 0, [...aug(BARE, 0.5), ...aug(shift(BARE, -2), 0.5), [null, 0.5], ...phrase(r, 2, 4, 0)], K, 1, 0.3, 0.5, { ...MEL, duty: 3 }, 0.9);
  } else {
    exhale(b, 1, K, 0, 0.3, 1.5);
    for (let i = 0; i < 2; i++) b.n('bell', 3 + i * 9 + r.int(3), K(r.pick([7, 4, 1])) + 12, 2, 0.1, { ratio: 3.5, bend: -1 });
  }
  return b.out();
}

const bare: TrackDef = {
  bpm: 100, start: 'breathe', vary: 0.4, wrong: 0.04, slip: 0.1, bendy: 0.2, echo: 0.3, wobble: 6,
  graph: { breathe: [['push', 3], ['let', 1], ['breathe', 1]], push: [['breathe', 2], ['let', 2]], let: [['breathe', 3], ['push', 1]] },
  secs: { breathe: (c) => bareSec(c, 'breathe'), push: (c) => bareSec(c, 'push'), let: (c) => bareSec(c, 'let') },
};

// ---------------------------------------------------------------- the Dry Sea

const A_MIX = key(57, MODE.mix);

function drySec(c: Ctx, kind: 'shore' | 'wall' | 'mast'): Section {
  const K = A_MIX, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  if (kind === 'wall') {
    // The sea's whorl comes back to the old shore and stands there. The swell stops before it breaks.
    b.n('tri', 0, 45, 15, 0.36, { a: 0.8 });
    const len = 10 + r.int(3), at = 1 + r.int(2);
    b.hit(at, 'rush', 0.2, len, { a: len * spb * 0.95 });
    b.n('air', 0, K(r.pick([0, 4])), 6, 0.16, { a: 1 });
    b.n('bell', Math.min(15, at + len + 0.5), K(r.pick([4, 7])) + 12, 1.5, 0.1, { ratio: 3.5, ...MEL });
    return b.out();
  }
  const roots = prog(r, kind === 'mast' ? [0, 6, 3, 0] : [0, 3, 0, 6], { 0: [0, 5], 3: [3, 1], 6: [6, 4] }, 0.3);
  roots.forEach((R, i) => {
    b.n('tri', i * 4, fold(K(R), 40), 3.8, 0.4, { a: 0.4 });
    const ch = voiced(K, R, 57, 4);
    b.n('p2', i * 4, ch[0] + 12, 1.8, 0.08, { duty: 1, a: 0.2 }).n('p2', i * 4 + 2, ch[r.pick([3, 2])], 1.8, 0.07, { duty: 1, a: 0.2 });
  });
  heart(b, 0, 16, 0.1);
  if (kind === 'shore') {
    b.fig('air', 0, lack(aug(OURO, 2)), K, 0, 0.3, { a: 0.15, ...MEL });
    sing(b, r, 'air', 8, phrase(r, 8, 4, 0, { cells: [[2, 2], [3, 1], [1, 3], [4]] }), K, 0, 0.28, 0.4, { a: 0.15, ...MEL });
    if (r.chance(0.5)) b.n('bell', r.int(12), K(9) + 12, 0.6, 0.1, { bend: -2, ratio: 2.4 });
  } else {
    // The Mast creaks, and the Hermits dig at its foot.
    for (let t = 1; t < 16; t += 4) b.hit(t + r.pick([0, 0.5]), 'tock', 0.08, 0.05);
    sing(b, r, 'p1', 0, [...phrase(r, 6, 4, 2), ...phrase(r, 6, 3, 0)], K, 1, 0.24, 0.3, { ...MEL, duty: 1 }, 0.9);
    peel(b, 'bell', 12, K, 1, 0.1, 0, { ratio: 3.5 });
  }
  return b.out();
}

const drysea: TrackDef = {
  bpm: 70, start: 'shore', vary: 0.5, wrong: 0.05, slip: 0.12, bendy: 0.25, echo: 0.55, wobble: 8,
  graph: { shore: [['mast', 2], ['wall', 1], ['shore', 1]], mast: [['shore', 2], ['wall', 1]], wall: [['shore', 2], ['mast', 1]] },
  secs: { shore: (c) => drySec(c, 'shore'), wall: (c) => drySec(c, 'wall'), mast: (c) => drySec(c, 'mast') },
};

// ---------------------------------------------------------------- the salt marsh, in 5/4

const E_PHR = key(52, MODE.phr);

function marshSec(c: Ctx, kind: 'reed' | 'mud' | 'tackle'): Section {
  const K = E_PHR, r = c.r, b = new B(20, 5, c.bpm);
  const roots = prog(r, [0, 1, 0, 6], { 0: [0, 3], 1: [1, 6], 6: [6, 5] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 5, p = fold(K(R), 40);
    b.n('tri', t0, p, 2.8, 0.4, { a: 0.2 }).n('tri', t0 + 3, p + K(R + 4) - K(R), 1.8, 0.32);
    if (r.chance(0.6)) b.hit(t0 + r.int(10) * 0.5, 'tick', 0.05, 0.03);
  });
  if (kind === 'reed') {
    const cells = [[2, 0.5, 0.5, 2], [1.5, 1, 2.5], [3, 2], [1, 1, 3]];
    sing(b, r, 'p1', 0, [...phrase(r, 10, 4, 1, { cells }), ...phrase(r, 10, 3, 0, { cells })], K, 1, 0.26, 0.5, { ...MEL, duty: 0 }, 0.9);
    roots.forEach((R, i) => b.n('p2', i * 5 + 0.5, voiced(K, R, 59, 4)[r.pick([1, 3])], 4, 0.06, { duty: 1, a: 0.5 }));
  } else if (kind === 'mud') {
    const n = 3 + r.int(4);
    for (let i = 0; i < n; i++) b.n('bell', r.int(36) * 0.5, K(r.int(8)) + 12, 1, r.range(0.1, 0.16), { ratio: 2.4, bend: -r.pick([2, 3]), ...MEL });
    b.n('air', 2, K(r.pick([0, 4])), 8, 0.16, { a: 1, bend: -1 });
  } else {
    // Tackle in the Conjoiner: Tack's count slowed down, and every accented pulse bends out of Tack's shape.
    for (let i = 0; i < 4; i++) tackCount(b, c, 'bell', i * 5 + 0.5, K, roots[i] + 2, 1, 1, 0.14, { ratio: 2.4 }, { bend: r.pick([-1, 1, -2, 2]) });
    b.n('air', 0, K(0), 9, 0.12, { a: 1.5 });
  }
  return b.out();
}

const marsh: TrackDef = {
  bpm: 76, start: 'reed', vary: 0.5, wrong: 0.06, swing: 0.1, stumble: 0.08, slip: 0.15, bendy: 0.35, echo: 0.45, wobble: 11,
  graph: { reed: [['mud', 2], ['tackle', 1], ['reed', 1]], mud: [['reed', 3], ['tackle', 1]], tackle: [['reed', 2], ['mud', 2]] },
  secs: { reed: (c) => marshSec(c, 'reed'), mud: (c) => marshSec(c, 'mud'), tackle: (c) => marshSec(c, 'tackle') },
};

// ---------------------------------------------------------------- Spire: bells hanging upside down under the town

const E_AEO = key(52, MODE.aeo);

function spireSec(c: Ctx, kind: 'town' | 'below' | 'toll'): Section {
  const K = E_AEO, r = c.r, b = new B(16, 4, c.bpm);
  if (kind === 'toll') {
    // A bell rings once under the town. Verger writes that it was the wind.
    const t = r.pick([2, 2.5, 3, 4, 5]), p = K(r.pick([0, 0, -3, 4]));
    b.n('bell', t - 2, p, 1.95, 0.18, { ratio: 1.41, rev: 1 });
    b.n('bell', t, p, 6, 0.24, { ratio: 1.41 });
    b.n('tri', 0, r.pick([40, 40, 45]), 12, 0.3, { a: 1 });
    b.n('air', 7 + r.int(3), K(r.pick([4, 3, 0])), 5, 0.12, { a: 1.5 });
    b.hit(t + 6 + r.int(3), 'rush', 0.06, 3, { a: 2 });
    return b.out();
  }
  const roots = prog(r, [0, 5, 3, 4], { 0: [0, 5], 3: [3, 1], 4: [4, 6] }, 0.3);
  roots.forEach((R, i) => b.n('tri', i * 4, fold(K(R), 40), 3.8, 0.34, { a: 0.3 }));
  if (kind === 'town') {
    // The town above talks quietly.
    sing(b, r, 'p2', 0, [...phrase(r, 8, 4, 2), ...phrase(r, 8, 3, 0)], K, 1, 0.12, 0.3, { duty: 1, ...MEL }, 0.85);
    for (let i = 0; i < 2; i++) b.n('bell', 2 + i * 8 + r.int(4), K(r.pick([0, 4, -3])), 3, 0.16, { ratio: 1.41, rev: r.chance(0.5) ? 1 : undefined });
  } else {
    // Ouro's figure upside down, on bells that hang upside down, ringing from under the ground.
    const f = lack(aug(inv(OURO, OURO_LACK), 2));
    let t = 0, i = 0;
    for (const [d, l] of f) {
      if (d !== null) b.n('bell', t, K(d), l * 1.1, 0.22, { ratio: 1.41, rev: i++ % 2 ? 1 : undefined, ...MEL });
      t += l;
    }
    b.n('air', 8, K(r.pick([4, 7])), 7, 0.12, { a: 1, bend: r.pick([0, -0.5]) });
    b.n('p2', 9, K(r.pick([0, 4])) + 24, 6, 0.05, { duty: 1, a: 0.8 });
  }
  return b.out();
}

const spire: TrackDef = {
  bpm: 66, start: 'town', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.2, echo: 0.6, wobble: 7,
  graph: { town: [['below', 3], ['toll', 1], ['town', 1]], below: [['town', 3], ['toll', 1]], toll: [['town', 2], ['below', 1]] },
  secs: { town: (c) => spireSec(c, 'town'), below: (c) => spireSec(c, 'below'), toll: (c) => spireSec(c, 'toll') },
};

// ---------------------------------------------------------------- the understory, where rain falls up

const A_LYD = key(57, MODE.lyd);

function woodSec(c: Ctx, kind: 'drip' | 'canopy' | 'roots'): Section {
  const K = A_LYD, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, [0, 1, 0, 4], { 0: [0, 5], 1: [1, 3], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => {
    bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 4], 40, 'waltz', 0.38, r);
    // Every arpeggio climbs, and none comes down.
    arp(b, 'p2', i * 3, 3, voiced(K, R, 64, 4), [0, 1, 2, 3, 4, 5], 0.5, 0.09, { duty: 1 });
  });
  if (kind === 'drip') {
    const n = 4 + r.int(4);
    for (let i = 0; i < n; i++) b.n('bell', r.int(24) * 0.5, K(r.int(7)) + 12, 0.8, r.range(0.1, 0.18), { ratio: 2.4, bend: 3, ...MEL });
  } else if (kind === 'canopy') {
    sing(b, r, 'p1', 0, [...phrase(r, 6, 0, 4, { cells: WALTZ }), ...phrase(r, 6, 4, 7, { cells: WALTZ })], K, 1, 0.26, 0.3, { ...MEL, duty: 3 }, 0.9);
  } else {
    b.fig('air', 0, lack(aug(OURO, 1.5)), K, 0, 0.24, { a: 0.2, ...MEL });
    b.fig('air', 6, lack(aug(shift(OURO, 4), 1.5)), K, 0, 0.22, { a: 0.2, ...MEL });
  }
  return b.out();
}

const wood: TrackDef = {
  bpm: 84, start: 'drip', vary: 0.5, wrong: 0.05, swing: 0.1, stumble: 0.06, slip: 0.15, bendy: 0.2, echo: 0.45, wobble: 7,
  graph: { drip: [['canopy', 3], ['roots', 1], ['drip', 1]], canopy: [['drip', 2], ['roots', 2]], roots: [['drip', 2], ['canopy', 2]] },
  secs: { drip: (c) => woodSec(c, 'drip'), canopy: (c) => woodSec(c, 'canopy'), roots: (c) => woodSec(c, 'roots') },
};

// ---------------------------------------------------------------- the machine fields, in 7/8

function machineSec(c: Ctx, kind: 'gear' | 'press' | 'idle'): Section {
  const K = D_DOR, r = c.r, bar = 3.5, b = new B(14, bar, c.bpm);
  if (!c.mem.gear) c.mem.gear = [0, 2, 4, 2, 7, 4, 2];
  const gear = c.mem.gear;
  // The machine wears: one tooth of its arpeggio changes each time it turns, and stays changed.
  if (kind === 'gear' && c.visit > 0) gear[r.int(7)] = r.pick([0, 1, 2, 3, 4, 5, 7, 8]);
  // Idling, the machine misses teeth: whole eighths of the ostinato go quiet, a different few each time.
  const miss = kind === 'idle' ? 0.3 : 0;
  for (let i = 0; i < 4; i++) {
    const t0 = i * bar, lo = i === 3 ? r.pick([36, 37, 33]) : 38;
    [0, 0, 7, 0, 12, 0, 7].forEach((o, j) => { if (j === 0 || !r.chance(miss)) b.n('tri', t0 + j * 0.5, lo + o, 0.4, j === 0 ? 0.5 : 0.4); });
    [0, 1.5, 2.5].forEach((o) => { if (!r.chance(miss)) b.hit(t0 + o, 'tick', 0.14, 0.04); });
    [0.5, 1, 2, 3].forEach((o) => { if (!r.chance(miss)) b.hit(t0 + o, 'tock', 0.07, 0.04); });
    if (kind !== 'idle') gear.forEach((d, j) => b.n('p2', t0 + j * 0.5, K(d), 0.3, 0.1, { duty: 0 }));
  }
  if (kind === 'press') {
    for (let i = 0; i < 4; i++) b.hit(i * bar, 'stamp', 0.3, 0.3);
    for (let i = 0; i < 4; i++) b.n('bell', i * bar + 1.5, K(r.pick([0, 1, 4])) + 12, 1.5, 0.14, { ratio: 1.41 });
  } else if (kind === 'idle') {
    // The Hum's note, far off to the north.
    b.n('air', r.int(4) * 0.5, 64, 9 + r.int(4), 0.12, { a: 2, bend: r.pick([0, 0, -0.5]) });
    if (r.chance(0.5)) b.n('bell', 4 + r.int(16) * 0.5, K(r.pick([0, 4, 7])) + 12, 1.5, 0.08, { ratio: 1.41 });
  } else {
    sing(b, r, 'p1', 0, [...phrase(r, 7, 4, 1, { cells: FAST }), ...phrase(r, 7, 3, 0, { cells: FAST })], K, 1, 0.24, 0.25, { ...MEL, duty: 1 }, 0.8);
  }
  return b.out();
}

const machine: TrackDef = {
  bpm: 120, start: 'gear', vary: 0.4, wrong: 0.06, slip: 0.15, bendy: 0.15, echo: 0.15, wobble: 3,
  graph: { gear: [['press', 2], ['gear', 2], ['idle', 1]], press: [['gear', 3], ['idle', 1]], idle: [['gear', 3]] },
  secs: { gear: (c) => machineSec(c, 'gear'), press: (c) => machineSec(c, 'press'), idle: (c) => machineSec(c, 'idle') },
};

// ---------------------------------------------------------------- Hum: everything over one held note

/** The machine's note. Every section of the Hum holds it, and nothing moves it. */
export const HUM = 40;
const HUM_MODES = [MODE.lyd, MODE.mix, MODE.dor, MODE.ion, MODE.phr];

function humSec(c: Ctx, kind: 'hum' | 'tune' | 'change'): Section {
  const r = c.r, b = new B(16, 4, c.bpm);
  const mi = (c.st.mode = ((c.st.mode ?? 0) + (r.chance(0.4) ? 1 : 0)) % HUM_MODES.length);
  const K = key(64, HUM_MODES[mi]);
  b.n('tri', 0, HUM, 16, 0.42, { a: 0.01, pin: 1 });
  if (kind === 'hum') {
    // The town hums along.
    b.n('air', 0, HUM + 12, 16, 0.18, { a: 0.4, pin: 1 });
    sing(b, r, 'p2', 0, [...phrase(r, 8, 4, 2, { cells: SLOW }), ...phrase(r, 8, 2, 0, { cells: SLOW })], K, 0, 0.12, 0.3, { duty: 1, a: 0.06, ...MEL });
  } else if (kind === 'tune') {
    b.fig('p1', 0, lack(OURO), K, 0, 0.26, { ...MEL, duty: 1 });
    b.fig('p1', 4, phrase(r, 4, 4, 1), K, 0, 0.26, { ...MEL, duty: 1 });
    b.fig('p1', 8, lack(shift(OURO, 4)), K, 0, 0.26, { ...MEL, duty: 1 });
    b.fig('p1', 12, phrase(r, 4, 5, 0), K, 0, 0.26, { ...MEL, duty: 1 });
    b.n('p2', 0, K(4), 7.8, 0.06, { duty: 2, a: 0.5 }).n('p2', 8, K(r.pick([3, 5])), 7.8, 0.06, { duty: 2, a: 0.5 });
    if (r.chance(0.5)) b.n('bell', 2 + r.int(12), K(7 + r.int(4)) + 12, 2, 0.1, { ratio: 3.5 });
  } else {
    // Listening for the change: the tune stops to listen, and its long notes lean toward the drone's E.
    b.n('air', 0, HUM + 12, 16, 0.16, { a: 0.4, pin: 1 });
    let t = 0;
    for (const [d, l] of phrase(r, 16, 4, 0, { cells: [[1, 1, 2], [2, 2], [0.5, 0.5, 3], [1, 3]], rest: 0.25 })) {
      if (d !== null) {
        const p = K(d) + 12, e = fold(p, 64) === 64 ? 0 : Math.round(((76 - p) % 12 + 18) % 12 - 6);
        b.n('p1', t, p, l * 0.9, 0.24, { duty: 1, bend: l >= 2 ? Math.max(-2, Math.min(2, e)) : 0 });
      }
      t += l;
    }
    for (let q = 0; q < 16; q += 2) b.hit(q + 1, 'tick', 0.04, 0.03);
  }
  return b.out();
}

const hum: TrackDef = {
  bpm: 80, start: 'hum', vary: 0.45, wrong: 0.05, slip: 0.2, bendy: 0.15, echo: 0.35, wobble: 3,
  graph: { hum: [['tune', 3], ['change', 1], ['hum', 1]], tune: [['hum', 2], ['change', 2]], change: [['hum', 2], ['tune', 2]] },
  secs: { hum: (c) => humSec(c, 'hum'), tune: (c) => humSec(c, 'tune'), change: (c) => humSec(c, 'change') },
};

// ---------------------------------------------------------------- the tundra and Tusk, the oldest town

const G_DOR = key(55, MODE.dor);

function tundraSec(c: Ctx, kind: 'snow' | 'wind' | 'tracks'): Section {
  const K = G_DOR, r = c.r, b = new B(12, 3, c.bpm);
  b.n('tri', 0, 43, 5.8, 0.36, { a: 0.6 }).n('tri', 6, r.pick([50, 43, 41]), 5.8, 0.34, { a: 0.6 });
  if (kind === 'snow') {
    b.n('p2', 0, 62, 11.5, 0.05, { duty: 2, a: 1.5 });
    const n = 3 + r.int(4);
    for (let i = 0; i < n; i++) b.n('bell', r.int(24) * 0.5, K(7 + r.int(6)) + 12, 1.2, r.range(0.07, 0.13), { ratio: 3.5, ...MEL });
  } else if (kind === 'wind') {
    b.hit(r.int(3), 'rush', 0.09, 8, { a: 3 });
    sing(b, r, 'air', 0, phrase(r, 12, 4, 0, { cells: [[3, 3], [2, 1, 3], [4, 2], [6]] }), K, 0, 0.26, 0.4, { a: 0.3, ...MEL });
  } else {
    for (let t = 0; t < 12; t += 1) b.hit(t, 'hat', 0.035 + (t % 3 === 0 ? 0.02 : 0), 0.05);
    sing(b, r, 'p1', 0, [...phrase(r, 6, 4, 2, { cells: WALTZ }), ...phrase(r, 6, 3, 0, { cells: WALTZ })], K, 1, 0.22, 0.3, { ...MEL, duty: 3 }, 0.9);
  }
  return b.out();
}

const tundra: TrackDef = {
  bpm: 54, start: 'snow', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.2, echo: 0.6, wobble: 9,
  graph: { snow: [['wind', 2], ['tracks', 2], ['snow', 1]], wind: [['snow', 2], ['tracks', 2]], tracks: [['snow', 2], ['wind', 2]] },
  secs: { snow: (c) => tundraSec(c, 'snow'), wind: (c) => tundraSec(c, 'wind'), tracks: (c) => tundraSec(c, 'tracks') },
};

function tuskSec(c: Ctx, kind: 'tell' | 'retell' | 'hearth'): Section {
  const K = A_AEO, r = c.r, b = new B(12, 3, c.bpm);
  for (let i = 0; i < 4; i++) b.n('tri', i * 3, i % 2 ? 40 : 45, 2.85, 0.38, { a: 0.1 });
  b.n('p2', 0, 64, 11.8, 0.05, { duty: 2, a: 1 });
  heart(b, 0, 12, 0.08);
  if (kind === 'hearth') {
    b.n('air', r.int(4) * 0.5, K(r.pick([0, 4, 2, 3])) + 12, 6 + r.int(5), 0.14, { a: 1.5, bend: r.pick([0, 0, -0.5]) });
    const n = r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', 2 + r.int(16) * 0.5, K(r.pick([4, 7, 9, 5])) + 12, 1.5, 0.1, { ratio: 2.4 });
    if (r.chance(0.4)) b.fig('p1', 6, aug(retro(RIND), 0.375), K, 1, 0.12, { duty: 1 });
    return b.out();
  }
  // People here repeat what their grandparents said, and the words come back a little late with one of them changed.
  const call = phrase(r, 6, 4, 0, { cells: SIX });
  const w = 1 + r.int(Math.max(1, call.length - 2));
  const retold = call.map(([d, l], j): [number | null, number] => [d !== null && j === w ? d + r.pick([1, -1, 2]) : d, l]);
  const cv: Voice = kind === 'tell' ? 'p1' : 'air', rv: Voice = kind === 'tell' ? 'bell' : 'p1';
  b.fig(cv, 0, call, K, 1, cv === 'air' ? 0.26 : 0.26, { ...MEL, duty: 3, a: cv === 'air' ? 0.1 : undefined });
  b.fig(rv, 6.25, retold, K, 1, rv === 'bell' ? 0.14 : 0.22, { ...MEL, duty: 0, ratio: 2.4 });
  return b.out();
}

const tusk: TrackDef = {
  bpm: 72, start: 'tell', vary: 0.5, wrong: 0.05, slip: 0.1, bendy: 0.15, echo: 0.45, wobble: 8,
  graph: { tell: [['retell', 3], ['hearth', 1], ['tell', 1]], retell: [['tell', 2], ['hearth', 2]], hearth: [['tell', 3], ['retell', 1]] },
  secs: { tell: (c) => tuskSec(c, 'tell'), retell: (c) => tuskSec(c, 'retell'), hearth: (c) => tuskSec(c, 'hearth') },
};

// ---------------------------------------------------------------- Old Amber's hall: everything in the past tense

const D_AEO = key(62, MODE.aeo);

function tallowSec(c: Ctx, kind: 'was' | 'riders' | 'hall'): Section {
  const K = D_AEO, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, [0, 5, 3, 4], { 0: [0, 5], 3: [3, 1], 4: [4, 6] }, 0.3);
  if (kind !== 'riders') {
    roots.forEach((R, i) => {
      bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 4], 38, 'waltz', 0.4, r);
      b.n('p2', i * 3 + 1, voiced(K, R, 57, 4)[r.pick([1, 3])], 1.8, 0.08, { duty: 1 });
    });
  }
  if (kind === 'was') {
    // Ouro's figure told backwards, the hole first.
    b.fig('p1', 0, lack(aug(retro(OURO), 1.5)), K, 0, 0.26, { ...MEL, duty: 3 });
    b.fig('p1', 6, retro(phrase(r, 6, 0, 4, { cells: WALTZ })), K, 0, 0.26, { ...MEL, duty: 3 });
  } else if (kind === 'riders') {
    // Old Amber tells the Riders' story in the Exuvia's figure, a little faster than the Exuvia ever plays it.
    b.fig('tri', 0, aug(RIND, 0.75), K, -1, 0.42, { a: 0.1 }, 0.97);
    b.fig('air', 0, aug(RIND, 0.75), K, 0, 0.16, { a: 0.4 }, 0.97);
    for (let i = 0; i < 2; i++) b.n('bell', 1 + i * 6 + r.int(3), K(r.pick([4, 7, 1])) + 12, 2, 0.1, { ratio: 1.41, ...MEL });
  } else {
    heart(b, 0, 3, 0.14);
    b.fig('p1', 0, retro([...phrase(r, 6, 4, 0, { cells: WALTZ }), ...phrase(r, 6, 2, 4, { cells: WALTZ })]), K, 0, 0.24, { ...MEL, duty: 1 });
  }
  return b.out();
}

const tallow: TrackDef = {
  bpm: 66, start: 'was', vary: 0.45, wrong: 0.05, swing: 0.06, stumble: 0.04, slip: 0.1, bendy: 0.15, echo: 0.4, wobble: 8,
  graph: { was: [['hall', 2], ['riders', 2]], hall: [['was', 2], ['riders', 1]], riders: [['was', 2], ['hall', 1]] },
  secs: { was: (c) => tallowSec(c, 'was'), riders: (c) => tallowSec(c, 'riders'), hall: (c) => tallowSec(c, 'hall') },
};

// ---------------------------------------------------------------- the Hilt road and the Hermitage

const BB_MIX = key(58, MODE.mix);

function hiltSec(c: Ctx, kind: 'road' | 'peel' | 'rust'): Section {
  const K = BB_MIX, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, kind === 'peel' ? [0, 6, 5, 4] : [0, 6, 3, 0], { 0: [0, 3], 6: [6, 4], 3: [3, 1], 5: [5, 3] }, 0.3);
  bassLine(b, K, roots, 4, 34, kind === 'rust' ? 'hold' : 'half', 0.44, r);
  if (kind !== 'rust') {
    for (let i = 0; i < 4; i++) {
      const t0 = i * 4;
      b.hit(t0, 'kick', 0.26, 0.2).hit(t0 + 1, 'snare', 0.16, 0.15).hit(t0 + 2, 'kick', 0.2, 0.2).hit(t0 + 3, 'snare', 0.17, 0.15);
      if (i === 3 && r.chance(0.6)) [3.25, 3.5, 3.75].forEach((o, q) => b.hit(t0 + o, 'snare', 0.07 + q * 0.03, 0.08));
    }
  }
  if (kind === 'road') {
    const mel = [...phrase(r, 8, 4, 1, { cells: MARCH }), ...phrase(r, 8, 4, 0, { cells: MARCH })];
    sing(b, r, 'p1', 0, mel, K, 1, 0.28, 0.3, { ...MEL, duty: 2 }, 0.8);
    // Rust: a second pulse, a quarter of a semitone off and an eighth behind.
    b.fig('p2', 0.5, mel, K, 0, 0.1, { duty: 0, det: 25 }, 0.6);
  } else if (kind === 'peel') {
    for (let i = 0; i < 4; i++) peel(b, 'p1', i * 4, K, 1, 0.28, -i);
    roots.forEach((R, i) => b.n('p2', i * 4 + 2, voiced(K, R, 58, 4)[r.pick([1, 3])], 0.4, 0.12, { duty: 2 }));
  } else {
    sing(b, r, 'air', 0, phrase(r, 16, 4, 0, { cells: SLOW }), K, 0, 0.24, 0.6, { a: 0.3, ...MEL });
    for (let i = 0; i < 3; i++) b.n('bell', 2 + i * 5, K(r.pick([0, 4, 6])) + 12, 1.5, 0.1, { ratio: 1.41, det: -30 });
  }
  return b.out();
}

const hiltroad: TrackDef = {
  bpm: 108, start: 'road', vary: 0.5, wrong: 0.05, swing: 0.1, stumble: 0.1, slip: 0.18, bendy: 0.2, echo: 0.2, wobble: 7, spread: 14,
  graph: { road: [['peel', 2], ['rust', 1], ['road', 1]], peel: [['road', 3], ['rust', 1]], rust: [['road', 2], ['peel', 1]] },
  secs: { road: (c) => hiltSec(c, 'road'), peel: (c) => hiltSec(c, 'peel'), rust: (c) => hiltSec(c, 'rust') },
};

function peelHouseSec(c: Ctx, kind: 'haul' | 'vats' | 'strip'): Section {
  const K = C_AEO, r = c.r, b = new B(16, 4, c.bpm);
  if (kind === 'vats') {
    // The Hermitage's old vats, and Bare's breath somewhere in the building.
    b.n('tri', 0, 36, 15.5, 0.36, { a: 0.6 });
    exhale(b, r.pick([0, 1]), K, 0, 0.26, 1.25);
    for (let i = 0; i < 3; i++) b.n('bell', 1 + i * 5 + r.int(3), K(r.pick([4, 7, 5])) + 12, 0.8, 0.12, { ratio: 2.4, bend: -2 });
    return b.out();
  }
  const roots = prog(r, [0, 6, 5, 4], { 0: [0, 3], 6: [6, 4], 5: [5, 3] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 4, p = fold(K(R), 36);
    // Hauling: heave on one, hold, heave on three.
    b.hit(t0, 'stamp', 0.32, 0.3).hit(t0 + 2, 'stamp', 0.26, 0.3).hit(t0 + 3.5, 'kick', 0.18, 0.2);
    b.n('tri', t0, p, 1.4, 0.48).n('tri', t0 + 2, p + K(R + 4) - K(R), 1.4, 0.42).n('tri', t0 + 3.5, p + 12, 0.4, 0.36);
  });
  if (kind === 'haul') {
    // Each bar's strip starts a step lower.
    for (let i = 0; i < 4; i++) peel(b, 'p1', i * 4, K, 1, 0.28, -i + r.pick([0, 0, 1]));
    roots.forEach((R, i) => b.n('p2', i * 4 + 1, voiced(K, R, 60)[1], 0.3, 0.12, { duty: 2 }).n('p2', i * 4 + 1.5, voiced(K, R, 60)[2], 0.3, 0.1, { duty: 2 }));
  } else {
    // Two strips coming away together, half a beat and a third apart.
    for (let i = 0; i < 4; i++) { peel(b, 'p1', i * 4, K, 1, 0.26, -i); peel(b, 'p2', i * 4 + 0.5, K, 1, 0.14, -i - 2, { duty: 0 }); }
  }
  return b.out();
}

const peelHouse: TrackDef = {
  bpm: 92, start: 'haul', vary: 0.5, wrong: 0.05, swing: 0.08, stumble: 0.08, slip: 0.15, bendy: 0.15, echo: 0.3, wobble: 6,
  graph: { haul: [['strip', 2], ['vats', 1], ['haul', 1]], strip: [['haul', 2], ['vats', 2]], vats: [['haul', 3], ['strip', 1]] },
  secs: { haul: (c) => peelHouseSec(c, 'haul'), vats: (c) => peelHouseSec(c, 'vats'), strip: (c) => peelHouseSec(c, 'strip') },
};

// ---------------------------------------------------------------- the Moonwater, the crater fields, and Fall

const FS_PHR = key(54, MODE.phr);

function moonSec(c: Ctx, kind: 'still' | 'under' | 'ripple'): Section {
  const K = FS_PHR, r = c.r, b = new B(16, 4, c.bpm);
  b.n('tri', 0, 42, 15.6, 0.36, { a: 1.2 });
  if (kind === 'still') {
    b.n('air', r.int(6) * 0.5, K(r.pick([4, 0, 3])), 6 + r.int(4), 0.12, { a: 2, bend: r.pick([0, -0.5, 0.5]) });
    const t = 6 + r.int(12) * 0.5;
    b.n('bell', t - 1.5, K(r.pick([0, 4])) + 12, 1.45, 0.1, { ratio: 3.5, rev: 1 });
    b.n('bell', t, K(r.pick([0, 4])) + 12, 3, 0.1, { ratio: 3.5 });
  } else if (kind === 'under') {
    // Full lies under the black water: its swell, slowed and an octave down.
    full(b, 'air', r.pick([0, 0.5, 1]), K, 0, 0.3, r.pick([1.75, 1.9]));
    if (r.chance(0.5)) b.n('bell', 4 + r.int(16) * 0.5, K(r.pick([4, 5, 0])) + 12, 2, 0.07, { ratio: 3.5, rev: r.chance(0.5) ? 1 : undefined });
  } else {
    // Rings spreading out, each wider and quieter.
    const c0 = K(r.pick([0, 4, 3, 1])) + 12, spread = [0, 3, -2, 5, -4, 7, -5, 10], step = r.pick([1.25, 1.5, 1.75]);
    const t0 = r.int(4) * 0.5;
    for (let i = 0; i < 8; i++) b.n('p2', t0 + i * step, c0 + spread[i] * r.pick([1, 1, -1]), 0.5, 0.11 * (1 - i * 0.09), { duty: 1 });
  }
  return b.out();
}

const moonwater: TrackDef = {
  bpm: 54, start: 'still', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.3, echo: 0.7, wobble: 12,
  graph: { still: [['under', 2], ['ripple', 2], ['still', 1]], under: [['still', 2], ['ripple', 2]], ripple: [['still', 2], ['under', 2]] },
  secs: { still: (c) => moonSec(c, 'still'), under: (c) => moonSec(c, 'under'), ripple: (c) => moonSec(c, 'ripple') },
};

const E_LYD = key(64, MODE.lyd);

function craterSec(c: Ctx, kind: 'field' | 'impact' | 'glint'): Section {
  const K = E_LYD, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, [0, 1, 0, 4], { 0: [0, 5], 1: [1, 6], 4: [4, 1] }, 0.3);
  if (kind === 'impact') {
    // The ground took a star: thuds where the Volute's pulse should be, out of time.
    const n = 3 + r.int(2);
    for (let i = 0; i < n; i++) { const t = Math.round(r.range(0, 15) * 4) / 4; b.hit(t, 'thud', r.range(0.2, 0.34), 0.3); }
    roots.forEach((R, i) => b.n('tri', i * 4, fold(K(R), 40), 3.6, 0.38, { bend: i === 3 ? -2 : 0 }));
    b.n('air', 1, K(r.pick([4, 1])), 6, 0.18, { a: 0.6, bend: -1 }).n('air', 9, K(r.pick([0, 3])), 6, 0.16, { a: 0.6 });
    return b.out();
  }
  bassLine(b, K, roots, 4, 40, 'half', 0.4, r);
  roots.forEach((R, i) => arp(b, 'p2', i * 4, 4, voiced(K, R, 64, 4), [0, 1, 2, 3, 2, 1, 2, 3], 0.5, 0.08, { duty: 0 }));
  if (kind === 'field') {
    sing(b, r, 'p1', 0, [...phrase(r, 8, 4, 1), ...phrase(r, 8, 3, 0)], K, 0, 0.26, 0.3, { ...MEL, duty: 1 }, 0.9);
  } else {
    for (let i = 0; i < 4; i++) {
      const t0 = i * 4 + r.pick([0.5, 1, 2]), top = 7 + r.int(4);
      for (let j = 0; j < 3; j++) b.n('bell', t0 + j * 0.25, K(top - j * 2) + 12, 0.3, 0.12, { ratio: 3.5 });
    }
    for (let t = 0.5; t < 16; t += 1) b.hit(t, 'hat', 0.04, 0.05);
  }
  return b.out();
}

const crater: TrackDef = {
  bpm: 88, start: 'field', vary: 0.5, wrong: 0.05, swing: 0.12, stumble: 0.06, slip: 0.2, bendy: 0.2, echo: 0.4, wobble: 6,
  graph: { field: [['glint', 2], ['impact', 1], ['field', 1]], glint: [['field', 3], ['impact', 1]], impact: [['field', 2], ['glint', 2]] },
  secs: { field: (c) => craterSec(c, 'field'), glint: (c) => craterSec(c, 'glint'), impact: (c) => craterSec(c, 'impact') },
};

const D_LYD = key(62, MODE.lyd);

function fallSec(c: Ctx, kind: 'toward' | 'away' | 'star'): Section {
  const K = D_LYD, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, kind === 'star' ? [0, 1, 0, 1] : [0, 5, 1, 4], { 0: [0, 2], 5: [5, 3], 1: [1, 6], 4: [4, 1] }, 0.3);
  bassLine(b, K, roots, 4, 38, 'walk', 0.4, r);
  for (let t = 0; t < 16; t += 0.5) b.hit(t, 'hat', t % 1 ? 0.035 : 0.055, 0.05);
  roots.forEach((R, i) => comp(b, K, i * 4, 4, R, roots[(i + 1) % 4], 62, 0.09, r));
  if (kind === 'star') {
    b.fig('bell', 0, lack(aug(OURO, 2)), K, 1, 0.14, { ratio: 3.5, ...MEL });
    b.fig('bell', 8, lack(aug(shift(OURO, 3), 2)), K, 1, 0.13, { ratio: 3.5, ...MEL });
  } else {
    // Walking toward the star the tune runs downhill; walking away it climbs.
    const down = kind === 'toward';
    sing(b, r, 'p1', 0, [...phrase(r, 8, down ? 7 : 0, 4), ...phrase(r, 8, 4, down ? 0 : 7)], K, 0, 0.28, 0.3, { ...MEL, duty: 1 }, 0.88);
  }
  const sec = b.out();
  // The ground leans: toward the star the tempo rises across the section, and away from it the tempo falls.
  return kind === 'toward' ? lean(sec, 0.85, 1.4) : kind === 'away' ? lean(sec, 1.25, 0.8) : sec;
}

const fall: TrackDef = {
  bpm: 96, start: 'toward', vary: 0.5, wrong: 0.05, slip: 0.15, bendy: 0.2, echo: 0.35, wobble: 6,
  graph: { toward: [['away', 3], ['star', 1], ['toward', 1]], away: [['toward', 3], ['star', 1]], star: [['toward', 2], ['away', 2]] },
  secs: { toward: (c) => fallSec(c, 'toward'), away: (c) => fallSec(c, 'away'), star: (c) => fallSec(c, 'star') },
};

// ---------------------------------------------------------------- the Climb and the Apex

function climbSec(c: Ctx, kind: 'step' | 'ledge'): Section {
  const up = c.st.up ?? 0;
  const K = key(50 + up, MODE.aeo), r = c.r, b = new B(16, 4, 104 + up * 3);
  if (kind === 'ledge') {
    b.n('tri', 0, fold(K(0), 36), 15.5, 0.36, { a: 0.4 });
    heart(b, 0, 4, 0.14);
    b.fig('air', 2, lack(aug(OURO, 2)), K, 1, 0.26, { a: 0.15, ...MEL });
    return b.out();
  }
  const roots = prog(r, [0, 5, 6, 4], { 0: [0, 3], 5: [5, 3], 6: [6, 4] }, 0.25);
  bassLine(b, K, roots, 4, 36, up >= 3 ? 'eighths' : 'half', 0.44, r);
  for (let i = 0; i < 4; i++) {
    b.hit(i * 4, 'kick', 0.3, 0.2).hit(i * 4 + 2, 'kick', 0.22, 0.2);
    if (up >= 2) b.hit(i * 4 + 1, 'snare', 0.18, 0.15).hit(i * 4 + 3, 'snare', 0.2, 0.15);
    if (up >= 4) for (let j = 1; j < 8; j += 2) b.hit(i * 4 + j * 0.5, 'hat', 0.05, 0.05);
  }
  roots.forEach((R, i) => arp(b, 'p2', i * 4, 4, voiced(K, R, 60, 4), [0, 1, 2, 3, 1, 2, 3, 4], 0.5, 0.09, { duty: 1 }));
  // The tune rises: each phrase ends higher than it began.
  b.fig('p1', 0, [...lack(OURO), ...phrase(r, 4, 3, 5), ...lack(shift(OURO, 3)), ...phrase(r, 4, 5, 7)], K, 1, 0.3, { ...MEL, duty: 3 }, 0.88);
  // Near the top, Cinch's habit on the bell: one step, again and again.
  if (up >= 4) habit(b, 'bell', 8, K, 2, 4, 1, 0.08, { ratio: 3.5 });
  return b.out();
}

const climb: TrackDef = {
  bpm: 104, start: 'step', vary: 0.5, wrong: 0.05, slip: 0.12, bendy: 0.15, echo: 0.25, wobble: 5,
  // Each step climbs a semitone. At the seventh the path switches back down to the fourth and climbs again.
  next: (cur, c) => {
    if (cur === 'ledge') return 'step';
    const up = c.st.up ?? 0;
    c.st.up = up >= 7 ? 4 : up + 1;
    return c.r.chance(0.18) ? 'ledge' : 'step';
  },
  secs: { step: (c) => climbSec(c, 'step'), ledge: (c) => climbSec(c, 'ledge') },
};

function crownSec(c: Ctx, kind: 'held' | 'habit' | 'turn'): Section {
  const K = C_HMIN, r = c.r, b = new B(16, 4, c.bpm);
  // Cinch's held note, the leading tone, for the whole of every section. It never goes up to the tonic.
  b.n('p2', 0, K(CINCH_HOLD) + 12, 16, 0.09, { duty: 1, a: 0.02, pin: 1 });
  b.n('tri', 0, 36, 16, 0.34, { a: 0.02, pin: 1 });
  if (kind === 'held') {
    // Tight: the tonic a half step above the held note, never below it.
    b.n('air', r.int(10) * 0.5, K(0) + 24, 6 + r.int(6), 0.12, { a: 2 });
    if (r.chance(0.6)) b.n('bell', 10 + r.int(10) * 0.5, K(r.pick([4, 5, 1])) + 24, 1.5, 0.07, { ratio: 1.41 });
  } else if (kind === 'habit') {
    habit(b, 'p1', r.int(6) * 0.5, K, 1, 3 + r.int(5), r.pick([1, 1, 0.75, 1.25]), 0.16, { duty: 2 });
  } else {
    // The Operculum turns: a slow stamp, and the habit on the bell.
    for (let t = 0; t < 16; t += 4) b.hit(t + r.pick([0, 0, 0.5]), 'stamp', 0.12, 0.3);
    habit(b, 'bell', 2, K, 2, 2 + r.int(3), 2, 0.08, { ratio: 1.41 });
  }
  return b.out();
}

const crown: TrackDef = {
  bpm: 60, start: 'held', vary: 0.35, wrong: 0.03, slip: 0.05, echo: 0.5, wobble: 2,
  graph: { held: [['habit', 2], ['turn', 2], ['held', 1]], habit: [['held', 2], ['turn', 2]], turn: [['held', 2], ['habit', 2]] },
  secs: { held: (c) => crownSec(c, 'held'), habit: (c) => crownSec(c, 'habit'), turn: (c) => crownSec(c, 'turn') },
};

// ---------------------------------------------------------------- the Shallows, the Exuvia, and the Stack

const G_AEO = key(55, MODE.aeo);

function slackSec(c: Ctx, kind: 'drift' | 'fold' | 'cinch'): Section {
  const r = c.r;
  // Loose ground: the tuning drifts from section to section and every bar is a different length.
  const drift = (c.st.drift = Math.max(-60, Math.min(60, (c.st.drift ?? 0) + r.range(-30, 30))));
  const bars = [r.pick([3.5, 4, 4.5]), r.pick([3, 4, 5]), r.pick([3.5, 4, 4.5]), r.pick([4, 5])];
  const K = G_AEO, b = new B(bars.reduce((s, x) => s + x, 0), 4, c.bpm);
  const loose = (): Partial<Ev> => ({ det: drift, bend: r.pick([0, -0.5, 0.5, -1, 1, -1.5]) });
  const roots = prog(r, [0, 5, 3, 6], { 0: [0, 3], 5: [5, 1], 3: [3, 4], 6: [6, 2] }, 0.4);
  let t0 = 0;
  bars.forEach((len, i) => { b.n('tri', t0, fold(K(roots[i]), 38), len * 0.95, 0.36, { ...loose(), a: 0.2 }); t0 += len; });
  if (kind === 'drift') {
    let t = 0;
    for (const [d, l] of phrase(r, b.beats - 1, 4, 0, { cells: SLOW })) { if (d !== null) b.n('p2', t, K(d) + 12, l * 0.95, 0.12, { duty: 1, ...loose(), ...MEL }); t += l; }
    b.n('air', r.int(4), K(r.pick([4, 0])), 7, 0.14, { a: 1, ...loose() });
  } else if (kind === 'fold') {
    // A phrase, and the same phrase folded back on itself.
    const f = phrase(r, 4, 3, 0, { cells: FAST });
    let t = 0;
    for (const [d, l] of [...f, [null, 1] as [null, number], ...retro(f), [null, 1] as [null, number], ...shift(f, 2)]) {
      if (d !== null) b.n('p1', t, K(d) + 12, l * 0.85, 0.24, { duty: 3, ...loose(), ...MEL });
      t += l;
    }
  } else {
    // The real Cinch, very old, out here: the habit is still in the hands, but it loosens, widens, and stops partway.
    const stop = 5 + r.int(8);
    let t = r.pick([0, 0.5]);
    for (let i = 0; i < stop; i++) {
      const d = i % 2 ? 4 + 1 + r.pick([0, 0, 1, -1]) : 4;
      b.n('p1', t, K(d) + 12, 0.7, 0.2 * (1 - i / (stop + 2)), { duty: 2, det: drift - i * 4 });
      t += 1 + i * r.range(0.05, 0.25);
    }
    b.n('bell', Math.min(b.beats - 3, t + 1), K(CINCH_HOLD) + 12, 2.5, 0.08, { ratio: 1.41, bend: -1 });
  }
  return b.out();
}

const slack: TrackDef = {
  bpm: 70, start: 'drift', vary: 0.5, wrong: 0.1, swing: 0.1, stumble: 0.12, slip: 0.3, bendy: 0.4, echo: 0.55, wobble: 18,
  graph: { drift: [['fold', 2], ['cinch', 1], ['drift', 1]], fold: [['drift', 2], ['cinch', 1]], cinch: [['drift', 2], ['fold', 1]] },
  secs: { drift: (c) => slackSec(c, 'drift'), fold: (c) => slackSec(c, 'fold'), cinch: (c) => slackSec(c, 'cinch') },
};

const A_PHR = key(45, MODE.phr);

function rindSec(c: Ctx, kind: 'hollow' | 'heart' | 'riders'): Section {
  const K = A_PHR, r = c.r, b = new B(16, 4, c.bpm);
  if (kind === 'hollow') {
    // The Exuvia's figure never lines up with itself: its lengths are dealt out again each time.
    const lens = [4, 4, 6, 2].sort(() => r.next() - 0.5);
    const f: Fig = RIND.map(([d], i) => [d, lens[i]]);
    b.fig('tri', 0, f, K, 0, 0.42, { a: 0.6 }, 0.98);
    if (r.chance(0.6)) b.fig('air', r.pick([0, 1, 2]), shift(r.chance(0.5) ? f : retro(f), r.pick([0, 0, 4])), K, 1, 0.12, { a: 1 }, 0.9);
    if (r.chance(0.4)) b.n('bell', 4 + r.int(16) * 0.5, K(r.pick([1, 4, 0])) + 12, 3, 0.07, { ratio: 1.41 });
  } else if (kind === 'heart') {
    // Mundane: the old Volute's heart, one beat in eight, and the dub a whole beat late.
    b.n('tri', 0, r.pick([45, 40, 46]), 15.5, 0.3, { a: 1 });
    heart(b, r.pick([0, 1, 2]), 8, 0.2, { dub: r.pick([0.75, 1, 1.25]) });
    b.n('air', 3 + r.int(4), K(r.pick([4, 1, 0, 3])) + 12, 5 + r.int(4), 0.1, { a: 2, bend: r.pick([0, -0.5, -1]) });
  } else {
    // The Riders: Ouro's figure so slow it is hardly a tune, on a low bell.
    b.n('tri', 0, 40, 15.5, 0.3, { a: 1 });
    b.fig('bell', 0, lack(aug(OURO, 4)), K, 1, 0.14, { ratio: 1.41, ...MEL });
  }
  return b.out();
}

const oldrind: TrackDef = {
  bpm: 48, start: 'hollow', vary: 0.4, wrong: 0.05, slip: 0.08, bendy: 0.3, echo: 0.7, wobble: 14,
  graph: { hollow: [['heart', 2], ['riders', 1], ['hollow', 1]], heart: [['hollow', 2], ['riders', 2]], riders: [['hollow', 2], ['heart', 1]] },
  secs: { hollow: (c) => rindSec(c, 'hollow'), heart: (c) => rindSec(c, 'heart'), riders: (c) => rindSec(c, 'riders') },
};

const CS_DOR = key(61, MODE.dor);
/** The Stack's floor: a short figure. Each pass a new copy goes on top and the older copies sink a voice. */
const STACK: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [3, 0.5], [1, 1], [4, 1]];
const FLOORS: Array<[Voice, number, number]> = [['p1', 1, 0.28], ['p2', 0, 0.14], ['bell', 1, 0.12], ['air', 0, 0.22], ['tri', -1, 0.45]];

function stackSec(c: Ctx, kind: 'floor' | 'shed'): Section {
  const K = CS_DOR, r = c.r, b = new B(8, 4, c.bpm);
  if (kind === 'shed') {
    // The tower sheds a floor: the top falls away and only the oldest floor keeps playing.
    b.hit(r.pick([0, 0.5, 1]), 'sweep', 0.14, 2 + r.int(3), { n: 90 });
    b.fig('tri', 0, aug(shift(r.chance(0.5) ? STACK : retro(STACK), -4 + r.int(3)), 2), K, -1, 0.42, {}, 0.9);
    b.n('air', 3 + r.int(3), K(r.pick([0, 4, -3])), 3.5, 0.14, { a: 0.6, bend: r.pick([-1, -2, 0.5]) });
    return b.out();
  }
  // No floor is built quite like the one before it: one note of the newest copy moves each pass.
  if (!c.mem.floor) c.mem.floor = STACK.map(([d]) => d as number);
  const top = c.mem.floor;
  const w = r.int(top.length);
  top[w] = Math.max(-2, Math.min(7, top[w] + r.pick([1, -1, 2, -2])));
  const fig: Fig = STACK.map(([, l], i) => [top[i], l]);
  const floors = c.st.floors ?? 1;
  for (let j = 0; j < floors; j++) {
    const [v, oct, g] = FLOORS[j];
    const f = j >= 2 ? aug(shift(fig, -j), 2) : shift(fig, -j);
    const x: Partial<Ev> = { duty: j === 0 ? 1 : 0, ratio: 3.5, det: -j * 5, ...(j === 0 ? MEL : undefined) };
    let t = b.fig(v, 0, f, K, oct, g, x, 0.85);
    if (t < 8) b.fig(v, t, r.chance(0.5) ? retro(f) : shift(f, r.pick([1, -1, 2])), K, oct, g, x, 0.85);
  }
  if (floors <= 4) for (let t = 0; t < 8; t += 0.5) b.hit(t, t % 1 ? 'hat' : 'tick', t % 2 ? 0.04 : 0.07, 0.04);
  return b.out();
}

const stack: TrackDef = {
  bpm: 112, start: 'floor', vary: 0.5, wrong: 0.05, swing: 0.1, stumble: 0.05, slip: 0.2, bendy: 0.15, echo: 0.25, wobble: 5,
  next: (cur, c) => {
    if (cur === 'shed') { c.st.floors = 1; return 'floor'; }
    const f = (c.st.floors ?? 1) + 1;
    if (f > FLOORS.length) return 'shed';
    c.st.floors = f;
    return 'floor';
  },
  secs: { floor: (c) => stackSec(c, 'floor'), shed: (c) => stackSec(c, 'shed') },
};

// ---------------------------------------------------------------- the credits: every motif once, then Ouro's figure whole

function creditsDrum(): Section {
  const b = new B(8, 4, 72);
  heart(b, 0, 2, 0.3, { root: 38 });
  b.n('air', 2, 62, 5.5, 0.16, { a: 1 });
  return b.out();
}

function creditsOuro(c: Ctx): Section {
  return titleSec({ ...c, bpm: 66 }, 'a');
}

function creditsTack(c: Ctx): Section {
  const K = B_AEO, b = new B(8, 4, 120);
  for (let i = 0; i < 4; i++) {
    tackCount(b, c, 'p1', i * 2, K, [0, 3, 4, 0][i], 1, 0.5, 0.28);
    b.n('tri', i * 2, fold(K([0, 3, 4, 0][i]), 35), 1.8, 0.45);
    b.hit(i * 2, 'kick', 0.3, 0.2).hit(i * 2 + 1, 'snare', 0.16, 0.15);
  }
  return b.out();
}

function creditsPeel(c: Ctx): Section {
  const K = C_AEO, r = c.r, b = new B(16, 4, 92);
  peel(b, 'p1', 0, K, 1, 0.28, 0);
  peel(b, 'p1', 4, K, 1, 0.24, -2);
  b.n('tri', 0, 36, 7.8, 0.4).n('tri', 8, r.pick([41, 43]), 7.8, 0.38);
  exhale(b, 3, K, 0, 0.28, 1.1);
  return b.out();
}

function creditsCinch(c: Ctx): Section {
  const K = C_HMIN, b = new B(8, 4, 60);
  b.n('p2', 0, K(CINCH_HOLD) + 12, 8, 0.1, { duty: 1, pin: 1 });
  b.n('tri', 0, 36, 8, 0.34, { pin: 1 });
  habit(b, 'p1', 0, K, 1, 4, 1, 0.16, { duty: 2 });
  void c;
  return b.out();
}

function creditsFull(): Section {
  const K = FS_AEO, b = new B(12, 4, 96);
  full(b, 'air', 0, K, 1, 0.3, 1.5);
  for (let i = 0; i < 6; i++) b.n('tri', i * 2, i % 2 ? 54 : 42, 1.8, 0.42, i === 5 ? { bend: 1 } : undefined);
  return b.out();
}

function creditsRind(): Section {
  const K = A_PHR, b = new B(8, 4, 60);
  b.fig('tri', 0, aug(RIND, 0.5), K, 0, 0.42, { a: 0.3 }, 0.97);
  b.fig('air', 0, aug(RIND, 0.5), K, 1, 0.12, { a: 0.6 }, 0.97);
  return b.out();
}

function creditsEnd(): Section {
  const K = key(62, MODE.ion), b = new B(14, 4, 66);
  // Ouro's figure whole: the missing degree lands, as a major third. Cinch's held note goes up to the tonic at last.
  b.fig('air', 0, OURO_WHOLE, K, 0, 0.34, { a: 0.06 }, 0.98);
  b.n('air', 3, K(OURO_LACK), 9, 0.36, { a: 0.1 });
  b.n('bell', 3, K(OURO_LACK) + 12, 4, 0.12, { ratio: 3.5 });
  b.n('p2', 0, K(6) + 12, 3, 0.1, { duty: 1 }).n('p2', 3, K(7) + 12, 9, 0.1, { duty: 1, a: 0.2 });
  b.n('tri', 0, 45, 2.9, 0.4).n('tri', 3, 38, 10, 0.42, { a: 0.2 });
  b.hit(3, 'thud', 0.22, 0.3).hit(3.5, 'thud', 0.13, 0.3);
  b.n('bell', 10, K(0) + 24, 3.5, 0.06, { ratio: 3.5 });
  return b.out({ still: true });
}

const credits: TrackDef = {
  bpm: 72, start: 'drum', vary: 0.3, wrong: 0, echo: 0.5, wobble: 6,
  graph: {
    drum: [['ouro', 1]], ouro: [['gran', 1]], gran: [['tack', 1]], tack: [['peel', 1]],
    peel: [['cinch', 1]], cinch: [['full', 1]], full: [['rind', 1]], rind: [['end', 1]],
  },
  secs: {
    drum: creditsDrum,
    ouro: creditsOuro,
    gran: (c) => homeSec({ ...c, bpm: 72 }, 'gran'),
    tack: creditsTack,
    peel: creditsPeel,
    cinch: creditsCinch,
    full: creditsFull,
    rind: creditsRind,
    end: creditsEnd,
  },
};

// ---------------------------------------------------------------- the Undermeadow

function caveSec(c: Ctx, kind: 'drip' | 'deep'): Section {
  const K = key(50, MODE.aeo), r = c.r, b = new B(16, 4, c.bpm);
  b.n('tri', 0, r.pick([38, 38, 41, 36]), 15.5, 0.34, { a: 1 });
  const n = kind === 'drip' ? 4 + r.int(4) : 1 + r.int(2);
  for (let i = 0; i < n; i++) b.n('bell', r.int(30) * 0.5, K(7 + r.int(7)), 0.6, r.range(0.1, 0.18), { ratio: 2.4, bend: -3, ...MEL });
  if (kind === 'deep') {
    b.n('air', r.int(4), K(r.pick([0, 4, 3])), 8, 0.16, { a: 1, bend: -0.5 });
    b.fig('p2', 8, lack(aug(OURO, 1.5)), K, 1, 0.08, { duty: 1 });
  } else heart(b, r.int(4), 8, 0.08);
  return b.out();
}

const cave: TrackDef = {
  bpm: 62, start: 'drip', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.25, echo: 0.65, wobble: 10,
  graph: { drip: [['deep', 2], ['drip', 1]], deep: [['drip', 2], ['deep', 1]] },
  secs: { drip: (c) => caveSec(c, 'drip'), deep: (c) => caveSec(c, 'deep') },
};

// ================================================================ Act 2: the Strand

/** The Strand: the tide comes up the scale and goes back out, a step past where it began. */
export const STRAND: Fig = [[0, 1], [2, 1], [4, 1], [5, 2], [4, 0.5], [2, 0.5], [0, 1], [-1, 1]];
/** The Collector: a reach up, a long lift down, and a rest where Ouro's missing degree belongs. */
export const COLLECTOR: Fig = [[0, 1], [4, 0.5], [3, 0.5], [1, 1], [0, 0.5], [-3, 0.5], [null, 2]];
/** The Collector's figure with the missing degree in place. */
export const COLLECTOR_WHOLE: Fig = [[0, 1], [4, 0.5], [3, 0.5], [1, 1], [0, 0.5], [-3, 0.5], [OURO_LACK, 2]];
/** The real Cinch: an invitation to sit. Each note is longer than the last, settling onto a long low note. */
export const SIT: Fig = [[4, 0.75], [3, 1], [1, 1.25], [-3, 5]];

/** Writes the Collector's figure. With `fill`, the missing degree sounds in the rest and carries fill's band. */
function collect(b: B, v: Voice, t: number, K: Key, oct: number, g: number, x?: Partial<Ev>, fill?: Partial<Ev>): number {
  const end = b.fig(v, t, COLLECTOR, K, oct, g, x, 0.9);
  if (fill) b.n(v, end - 2, K(OURO_LACK) + 12 * oct, 1.8, g, { ...x, ...fill });
  return end;
}

/** The chord on degree d without the degree Ouro lacks, its root folded into [lo, lo + 12). */
function lacking(K: Key, d: number, lo: number, size = 4): number[] {
  const root = fold(K(d), lo), out: number[] = [];
  for (let i = 0; i <= size && out.length < size; i++) {
    const deg = d + 2 * i;
    if (((deg % 7) + 7) % 7 !== OURO_LACK) out.push(root + K(deg) - K(d));
  }
  return out;
}

/** Labels on the Collector's shelves: a few notes of Act 1 figures. Ouro's is not among them, because the Volute's slot is empty. */
const LABELS: Fig[] = [
  GRAN.slice(0, 3), [[0, 0.25], [4, 0.25], [0, 0.25], [0, 0.25]], aug(BARE.slice(0, 3), 0.5), PEEL.slice(0, 4),
  [...HABIT, ...HABIT], aug(FULL.slice(0, 2), 0.5), aug(RIND.slice(0, 2), 0.25), STACK.slice(0, 4),
];

const EB_LYD = key(51, MODE.lyd);

function strandSec(c: Ctx, kind: 'night' | 'tide' | 'stars'): Section {
  const K = EB_LYD, r = c.r, b = new B(24, 6, c.bpm), spb = 60 / c.bpm;
  const roots = prog(r, kind === 'tide' ? [0, 1, 5, 4] : [0, 4, 1, 0], { 0: [0, 5], 1: [1, 3], 4: [4, 6], 5: [5, 2] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 6;
    b.n('tri', t0, fold(K(R), 39), 5.8, 0.36, { a: 0.5 });
    // High tide: water under everything, an arpeggio that rolls in and back out.
    arp(b, 'p2', t0, 6, voiced(K, R, 58, 4), [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 1], 0.5, 0.07, { duty: 1, lay: 0.5 });
  });
  // At high tide the sea is near. At low tide the Collector walks the tide line, and its footsteps make the stars fall.
  b.hit(0, 'rush', 0.12, 11.5, { a: 5 * spb, lay: 0.5 }).hit(12, 'rush', 0.12, 11.5, { a: 5 * spb, lay: 0.5 });
  for (let t = r.range(1, 5); t < 23; t += r.range(4, 7)) b.hit(t, 'stamp', r.range(0.1, 0.16), 0.3, { top: 0.5 });
  const stars = kind === 'stars' ? 4 + r.int(4) : 1 + r.int(3);
  for (let i = 0; i < stars; i++) b.n('bell', r.int(44) * 0.5, K(7 + r.int(7)) + 12, 1.5, r.range(0.06, 0.12), { ratio: 3.5, bend: -r.pick([2, 3, 5]), top: kind === 'stars' ? undefined : 0.5 });
  if (kind === 'tide') {
    // The Strand's figure on the breath voice, coming in a different distance each time.
    let t = 0;
    for (const reach of [0, r.pick([1, 2, -1])]) t = b.fig('air', t, aug(shift(STRAND, reach), 1.25), K, 1, 0.24, { a: 0.3, ...MEL }) + 0.75;
  } else if (kind === 'night') {
    // Ouro, small on the beach.
    b.fig('p1', 2, lack(aug(OURO, 2)), K, 1, 0.18, { ...MEL, duty: 1 });
    sing(b, r, 'p1', 12, phrase(r, 11, 4, 0, { cells: SLOW }), K, 1, 0.18, 0.4, { ...MEL, duty: 1 });
  }
  return b.out();
}

const strand: TrackDef = {
  bpm: 60, start: 'night', vary: 0.5, wrong: 0.04, swing: 0.08, stumble: 0.06, slip: 0.12, bendy: 0.25, echo: 0.6, wobble: 9,
  graph: { night: [['tide', 3], ['stars', 2], ['night', 1]], tide: [['night', 2], ['stars', 2]], stars: [['tide', 2], ['night', 2]] },
  secs: { night: (c) => strandSec(c, 'night'), tide: (c) => strandSec(c, 'tide'), stars: (c) => strandSec(c, 'stars') },
};

const AB_MIX = key(56, MODE.mix);
/** The Sand Dollar's five arms, one note each. Each bar starts on the next arm round. */
const ARMS = [0, 4, 2, 5, 1];
const ARM_RHYTHM = [1.5, 1, 1, 0.5, 1];

function sandSec(c: Ctx, kind: 'arms' | 'grotto' | 'market'): Section {
  const K = AB_MIX, r = c.r, b = new B(20, 5, c.bpm);
  const roots = prog(r, kind === 'grotto' ? [5, 3, 0, 4] : [0, 6, 3, 4], { 0: [0, 5], 6: [6, 4], 3: [3, 1], 4: [4, 1] }, 0.35);
  roots.forEach((R, i) => {
    const t0 = i * 5, p = fold(K(R), 40);
    // Three and two.
    b.n('tri', t0, p, 1.4, 0.46).n('tri', t0 + 1.5, p + K(R + 4) - K(R), 1.4, 0.4).n('tri', t0 + 3, p + 12, 0.9, 0.4);
    b.n('tri', t0 + 4, fold(K(roots[(i + 1) % 4]), 40) + r.pick([1, -1]), 0.9, 0.36);
    b.hit(t0, 'kick', 0.22, 0.2).hit(t0 + 3, 'tock', 0.1, 0.05);
    for (const o of [1, 2, 4]) b.hit(t0 + o, 'hat', 0.045, 0.05);
    for (const o of [0.5, 1.5, 2.5, 3.5, 4.5]) b.hit(t0 + o, 'hat', 0.03, 0.05);
    if (kind !== 'grotto') comp(b, K, t0, 5, R, roots[(i + 1) % 4], 60, 0.09, r);
  });
  if (kind === 'arms') {
    let arm = c.st.arm ?? 0;
    for (let i = 0; i < 4; i++, arm++) {
      let t = i * 5;
      ARM_RHYTHM.forEach((l, j) => { b.n('p1', t, K(ARMS[(arm + j) % 5]) + 12, l * 0.85, 0.26, { ...MEL, duty: 1 }); t += l; });
    }
    c.st.arm = arm % 5;
  } else if (kind === 'grotto') {
    roots.forEach((R, i) => b.n('p2', i * 5, voiced(K, R, 60, 4)[r.pick([1, 3])], 4.6, 0.06, { duty: 1, a: 0.3 }));
    b.n('air', r.int(4), K(r.pick([0, 4, 5])) + 12, 8, 0.16, { a: 0.8, ...MEL });
    for (let i = 0; i < 3; i++) b.n('bell', 9 + i * 3 + r.int(2) * 0.5, K(ARMS[r.int(5)]) + 12, 1.5, 0.1, { ratio: 2.4 });
  } else {
    sing(b, r, 'p1', 0, [...phrase(r, 10, 4, 1, { cells: SIX }), ...phrase(r, 10, 3, 0, { cells: SIX })], K, 1, 0.26, 0.3, { ...MEL, duty: 3 }, 0.88);
  }
  return b.out();
}

const sanddollar: TrackDef = {
  bpm: 96, start: 'arms', vary: 0.5, wrong: 0.05, swing: 0.14, stumble: 0.06, slip: 0.15, bendy: 0.15, echo: 0.3, wobble: 6,
  graph: { arms: [['market', 2], ['grotto', 1], ['arms', 1]], market: [['arms', 3], ['grotto', 1]], grotto: [['arms', 2], ['market', 1]] },
  secs: { arms: (c) => sandSec(c, 'arms'), grotto: (c) => sandSec(c, 'grotto'), market: (c) => sandSec(c, 'market') },
};

const B_LYD = key(59, MODE.lyd);

function cowrieSec(c: Ctx, kind: 'glaze' | 'mirror' | 'gloss'): Section {
  const K = B_LYD, r = c.r, b = new B(16, 4, c.bpm);
  // The harmony is a palindrome: the second half is the first half backwards.
  const x = r.pick([0, 5, 3]), y = r.pick([1, 4, 6]);
  [x, y, y, x].forEach((R, i) => {
    const t0 = i * 4, p = fold(K(R), 40), five = p + K(R + 4) - K(R);
    if (i < 2) b.n('tri', t0, p, 1.9, 0.42).n('tri', t0 + 2, five, 1.9, 0.36);
    else b.n('tri', t0, five, 1.9, 0.36).n('tri', t0 + 2, p, 1.9, 0.42);
    arp(b, 'p2', t0, 4, voiced(K, R, 62, 4), i < 2 ? [0, 1, 2, 3, 4, 3, 2, 1] : [1, 2, 3, 4, 3, 2, 1, 0], 0.5, 0.07, { duty: 0 });
    b.hit(t0 + (i < 2 ? 1 : 3), 'tick', 0.06, 0.03);
  });
  if (kind === 'glaze') {
    // Gloss says everything twice, the second time reversed.
    const f = phrase(r, 8, 4, r.pick([0, 1, 5]));
    b.fig('p1', 0, f, K, 1, 0.26, { ...MEL, duty: 0 }, 0.85);
    b.fig('p1', 8, retro(f), K, 1, 0.24, { duty: 0, a: 0.12 }, 0.95);
  } else if (kind === 'mirror') {
    // Reflections walk opposite: the bell plays the tune upside down at the same moment.
    const f = phrase(r, 16, 4, 2, { cells: SLOW.concat(CELLS4) });
    b.fig('p1', 0, f, K, 1, 0.24, { ...MEL, duty: 1 }, 0.9);
    b.fig('bell', 0, inv(f, 4), K, 1, 0.1, { ratio: 3.5 }, 0.9);
  } else {
    // A bell phrase, then the same phrase backwards on bells that ring backwards.
    for (let i = 0; i < 2; i++) {
      const f = phrase(r, 4, r.pick([4, 7]), r.pick([0, 2, 4]), { cells: [[1, 1, 2], [0.5, 0.5, 1, 2], [2, 2]] });
      b.fig('bell', i * 8, f, K, 1, 0.16, { ratio: 3.5, ...MEL }, 0.9);
      let t = i * 8 + 4;
      for (const [d, l] of retro(f)) { if (d !== null) b.n('bell', t, K(d) + 12, l * 0.95, 0.15, { ratio: 3.5, rev: 1 }); t += l; }
    }
  }
  return b.out();
}

const cowrie: TrackDef = {
  bpm: 88, start: 'glaze', vary: 0.4, wrong: 0.05, slip: 0.12, bendy: 0.1, echo: 0.45, wobble: 3,
  graph: { glaze: [['mirror', 2], ['gloss', 2], ['glaze', 1]], mirror: [['glaze', 2], ['gloss', 1]], gloss: [['glaze', 2], ['mirror', 1]] },
  secs: { glaze: (c) => cowrieSec(c, 'glaze'), mirror: (c) => cowrieSec(c, 'mirror'), gloss: (c) => cowrieSec(c, 'gloss') },
};

function augerSec(c: Ctx, kind: 'turn' | 'wind'): Section {
  // The root climbs a whole step each pass. Every line folds into one octave, so the climb never runs out of room.
  const step = c.st.step ?? 0;
  const K = key(50 + ((step * 2) % 12), MODE.dor), r = c.r, b = new B(13, 4, c.bpm);
  // Spiral wind pushing along the whorl.
  b.hit(0, 'sweep', 0.08, 3, { n: 40 });
  for (let t = 4; t < 13; t += 1) b.hit(t, t % 2 ? 'hat' : 'tick', 0.04, 0.05);
  // The bass climbs the scale in eighths and folds back down at the top.
  for (let i = 0; i < 26; i++) b.n('tri', i * 0.5, fold(K(Math.floor(i / 2)), 38), 0.42, i % 2 ? 0.38 : 0.46);
  if (kind === 'turn') {
    // Turnwise: each phrase one note longer than the last, each starting a step higher.
    let t = 0;
    for (let k = 0; k < 4; k++) {
      const n = 3 + k;
      let d = k + r.pick([0, 0, 1]);
      for (let j = 0; j < n; j++) { b.n('p1', t + j * 0.5, fold(K(d), 62), j === n - 1 ? 0.9 : 0.4, 0.24, { ...MEL, duty: 1 }); d += r.chance(0.8) ? 1 : 2; }
      t += n * 0.5 + 1;
    }
    b.n('p2', 0, fold(K(4), 66), 12.5, 0.05, { duty: 2, a: 1 });
  } else {
    b.n('air', 0, fold(K(0), 60), 6, 0.2, { a: 1, bend: 2 }).n('air', 6.5, fold(K(4), 60), 6, 0.2, { a: 1, bend: 2 });
    for (let j = 0; j < 6; j++) b.n('bell', 1 + j * 2, fold(K(j * 2 + r.int(2)), 72), 1.5, 0.1, { ratio: 3.5 });
  }
  return b.out();
}

const auger: TrackDef = {
  bpm: 100, start: 'turn', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.15, echo: 0.35, wobble: 5,
  next: (cur, c) => { c.st.step = (c.st.step ?? 0) + 1; return c.r.chance(0.25) ? 'wind' : 'turn'; },
  secs: { turn: (c) => augerSec(c, 'turn'), wind: (c) => augerSec(c, 'wind') },
};

const F_AEO = key(53, MODE.aeo);
/** The order voices leave the Nautilus, one per chamber. */
const CHAMBER_DROP: Voice[] = ['nz', 'p2', 'bell', 'tri'];

function nautilusSec(c: Ctx, kind: 'chamber' | 'seal'): Section {
  const K = F_AEO, r = c.r;
  if (kind === 'seal') {
    // Every chamber is sealed. The Tide-reader's tide on the breath voice, and a new shell begins.
    const b = new B(10, 5, c.bpm);
    b.fig('air', r.pick([0, 0.5]), STRAND, K, 1, 0.22, { a: 0.3, ...MEL });
    return b.out();
  }
  const k = c.st.chamber ?? 0, gone = new Set(CHAMBER_DROP.slice(0, k));
  const beats = 8 + 2 * k, b = new B(beats, 4, c.bpm), nb = Math.ceil(beats / 4);
  const roots = prog(r, [0, 5, 3, 6, 4], { 0: [0, 3], 5: [5, 1], 3: [3, 1], 6: [6, 4] }, 0.3);
  // The valve seals the chamber behind you.
  if (!gone.has('nz')) { b.hit(0, 'stamp', 0.22, 0.3); for (let t = 1; t < beats; t += 1) b.hit(t, 'tick', t % 2 ? 0.04 : 0.06, 0.03); }
  for (let i = 0; i < nb; i++) {
    const t0 = i * 4, len = Math.min(4, beats - t0), R = roots[i % roots.length];
    if (!gone.has('tri')) b.n('tri', t0, fold(K(R), 41), len * 0.95, 0.4, { a: 0.1 });
    if (!gone.has('p2')) arp(b, 'p2', t0, len, voiced(K, R, 60, 4), [0, 2, 1, 3], 0.5, 0.08, { duty: 1 });
    if (!gone.has('bell')) b.n('bell', t0 + r.pick([1.5, 2, 2.5]), K(r.pick([4, 7, 2])) + 12, 1.2, 0.1, { ratio: 2.4 });
  }
  // Siphon only talks about the room it is standing in: one phrase exactly as long as the chamber.
  sing(b, r, 'p1', 0, phrase(r, beats, r.pick([4, 2, 0]), 0), K, 1, 0.26, 0.3, { ...MEL, duty: 1 }, 0.9);
  return b.out();
}

const nautilus: TrackDef = {
  bpm: 88, start: 'chamber', vary: 0.45, wrong: 0.04, slip: 0.12, bendy: 0.2, echo: 0.5, wobble: 6,
  // Each chamber is two beats longer than the last and one voice short. After the last, the shell seals and starts again.
  next: (cur, c) => {
    if (cur === 'seal') { c.st.chamber = 0; return 'chamber'; }
    const k = (c.st.chamber ?? 0) + 1;
    if (k > CHAMBER_DROP.length) return 'seal';
    c.st.chamber = k;
    return 'chamber';
  },
  secs: { chamber: (c) => nautilusSec(c, 'chamber'), seal: (c) => nautilusSec(c, 'seal') },
};

/** A music box plays one label: a short Act 1 fragment in the key of the world it came from. */
function label(b: B, r: Rng, t: number, g: number): number {
  const W = key(60 + r.int(12), r.pick([MODE.ion, MODE.lyd, MODE.dor, MODE.mix, MODE.aeo]));
  return b.fig('bell', t, r.pick(LABELS), W, 1, g, { ratio: 5, a: 0.002 }, 0.6);
}

function traySec(c: Ctx, kind: 'shelf' | 'dust'): Section {
  const r = c.r, b = new B(16, 4, c.bpm);
  b.n('tri', 0, r.pick([36, 41, 43]), 15.5, 0.24, { a: 1.5 });
  if (kind === 'dust') {
    b.n('air', r.int(4), r.pick([60, 65, 67]), 9, 0.12, { a: 1.5, bend: -0.5 });
    label(b, r, 8 + r.int(4), 0.1);
    return b.out();
  }
  // Four slots on the shelf. One is always empty, and its label reads THE VOLUTE.
  const empty = r.int(4);
  for (let s = 0; s < 4; s++) {
    b.hit(s * 4, 'tick', 0.05, 0.03);
    if (s !== empty) label(b, r, s * 4 + 0.5, 0.13);
  }
  if (r.chance(0.4)) b.n('air', empty * 4 + 0.5, r.pick([62, 67]), 3, 0.1, { a: 0.8 });
  // The music box runs down a little across each shelf.
  return lean(b.out(), 1, r.range(0.8, 0.9));
}

const tray: TrackDef = {
  bpm: 84, start: 'shelf', vary: 0.3, wrong: 0.04, slip: 0.05, echo: 0.5, wobble: 6,
  graph: { shelf: [['shelf', 3], ['dust', 1]], dust: [['shelf', 1]] },
  secs: { shelf: (c) => traySec(c, 'shelf'), dust: (c) => traySec(c, 'dust') },
};

const CS_PHR = key(49, MODE.phr);

function conchSec(c: Ctx, kind: 'sleep' | 'sea' | 'hand'): Section {
  const K = CS_PHR, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  // A deep note held through the whole track, and the breath voice humming it.
  b.n('tri', 0, 37, 16, 0.42, { a: 0.02, pin: 1 });
  b.n('air', 0, K(0), 16, 0.14, { a: 2, pin: 1 });
  // The sea inside the shell: two slow swells, which are also the Collector breathing in its sleep.
  b.hit(0, 'rush', 0.13, 7.6, { a: 3 * spb }).hit(8, 'rush', 0.12, 7.6, { a: 3 * spb });
  if (kind === 'sea') {
    let t = r.int(4) * 0.5;
    for (const d of [0, 1, 3, 4, 3, 1, 0, -1]) { b.n('p2', t, K(d) + 12, 1.2, 0.05, { duty: 1, a: 0.3 }); t += r.pick([1.5, 1.75, 2]); }
  } else if (kind === 'hand') {
    // The Collector's figure, slowed down and low, with its rest where Ouro's missing degree belongs.
    b.fig('bell', r.pick([1, 2]), aug(COLLECTOR, 2), K, 1, 0.13, { ratio: 1.41, ...MEL });
  } else {
    const n = 1 + r.int(2);
    for (let i = 0; i < n; i++) b.n('bell', 2 + r.int(24) * 0.5, K(r.pick([0, 4, 1])) + 12, 2.5, 0.08, { ratio: 1.41, rev: r.chance(0.5) ? 1 : undefined });
  }
  return b.out();
}

const conch: TrackDef = {
  bpm: 46, start: 'sleep', vary: 0.35, wrong: 0.03, slip: 0.05, bendy: 0.2, echo: 0.75, wobble: 10,
  graph: { sleep: [['sea', 2], ['hand', 2], ['sleep', 1]], sea: [['sleep', 2], ['hand', 1]], hand: [['sleep', 2], ['sea', 2]] },
  secs: { sleep: (c) => conchSec(c, 'sleep'), sea: (c) => conchSec(c, 'sea'), hand: (c) => conchSec(c, 'hand') },
};

const AB_AEO = key(56, MODE.aeo);

function collectorSec(c: Ctx, kind: 'walk' | 'reach' | 'tray'): Section {
  const K = AB_AEO, r = c.r, b = new B(16, 4, c.bpm);
  // Above 0.85 the missing degree finally sounds. Nothing else in the fight plays it, harmony included.
  const high = { lay: 0.85 };
  const roots = prog(r, kind === 'reach' ? [5, 3, 0, 4] : [0, 6, 3, 4], { 0: [0, 5], 6: [6, 4], 3: [3, 1], 4: [4, 1], 5: [5, 3] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 4, lo = lacking(K, R, 36, 3);
    // The Collector walks: a heavy step on one and another on the and of two.
    b.hit(t0, 'kick', 0.42, 0.2).hit(t0 + 1.5, 'stamp', 0.3, 0.3).hit(t0 + 2, 'snare', 0.22, 0.15).hit(t0 + 3, 'kick', 0.28, 0.2);
    b.hit(t0 + 3.5, 'snare', 0.14, 0.12, { lay: 0.5 });
    for (const o of [0.5, 1, 2.5]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.3 });
    [lo[0], lo[0] + 12, lo[1], lo[0], lo[2], lo[0] + 12, lo[1], lo[0]].forEach((n, j) => b.n('tri', t0 + j * 0.5, n, 0.42, j % 2 ? 0.4 : 0.52));
    const up = lacking(K, R, 60, 4);
    [0.5, 2.5].forEach((o, j) => b.n('p2', t0 + o, up[j + 1], 0.35, 0.12, { duty: 2, top: 0.6 }));
    arp(b, 'p2', t0, 4, up, [0, 1, 2, 3, 2, 1, 0, 1], 0.5, 0.1, { duty: 1, lay: 0.6 });
  });
  const mx = { ...MEL, duty: 3 };
  if (kind === 'walk') {
    collect(b, 'p1', 0, K, 1, 0.32, mx, high);
    b.fig('p1', 6, phrase(r, 2, 4, 3, { cells: FAST, avoid: [OURO_LACK] }), K, 1, 0.3, mx, 0.85);
    collect(b, 'p1', 8, K, 1, 0.32, mx, high);
    b.fig('p1', 14, phrase(r, 2, 1, 0, { cells: FAST, avoid: [OURO_LACK] }), K, 1, 0.3, mx, 0.85);
  } else if (kind === 'reach') {
    // A hand reaching in: the figure slowed on the breath voice, and quick grabs on the pulse once things go badly.
    b.fig('air', 0, aug(COLLECTOR, 2), K, 1, 0.24, { a: 0.15, ...MEL });
    b.n('air', 8, K(OURO_LACK) + 12, 3.6, 0.24, { a: 0.15, ...high });
    for (let i = 0; i < 8; i++) if (r.chance(0.7)) b.n('p1', i * 2 + r.pick([0.5, 1, 1.5]), K(r.pick([4, 5, 7, 8])) + 12, 0.2, 0.22, { duty: 0, lay: 0.4 });
  } else {
    // The habit's team: labels from collected worlds, each in its own key, and the figure between them.
    for (let i = 0; i < 2; i++) {
      const W = key(50 + r.int(12), r.pick([MODE.ion, MODE.dor, MODE.mix, MODE.lyd]));
      b.fig('p1', i * 8, r.pick(LABELS), W, 1, 0.28, mx, 0.8);
      collect(b, 'p1', i * 8 + 3, K, 1, 0.3, mx, high);
    }
  }
  bellCopy(b, 0.7, 0.08, true);
  return b.out();
}

const collector: TrackDef = {
  bpm: 138, start: 'walk', vary: 0.35, wrong: 0.03, slip: 0, bendy: 0.12, echo: 0.2, wobble: 4, spread: 8,
  graph: { walk: [['reach', 2], ['tray', 2], ['walk', 1]], reach: [['walk', 3], ['tray', 1]], tray: [['walk', 3], ['reach', 1]] },
  secs: { walk: (c) => collectorSec(c, 'walk'), reach: (c) => collectorSec(c, 'reach'), tray: (c) => collectorSec(c, 'tray') },
};

function cinchRealSec(c: Ctx, kind: 'sit' | 'notice' | 'down'): Section {
  const K = F_ION, r = c.r, b = new B(12, 3, c.bpm);
  const roots = prog(r, [0, 3, 4, 0], { 0: [0, 5], 3: [3, 1], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => {
    bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 4], 41, 'waltz', 0.4, r);
    b.n('p2', i * 3, voiced(K, R, 57, 4)[r.pick([1, 2, 3])], 2.8, 0.07, { duty: 1, a: 0.25 });
  });
  if (kind === 'sit') {
    // Sit down: the figure slows into a long low note.
    b.fig('p1', 0, r.chance(0.5) ? SIT : shift(SIT, r.pick([2, -1])), K, 1, 0.24, { ...MEL, duty: 1 }, 0.95);
    b.n('bell', 8.5 + r.int(4) * 0.5, K(r.pick([4, 7, 9])) + 12, 1.5, 0.08, { ratio: 3.5, bend: r.chance(0.4) ? -3 : 0 });
  } else if (kind === 'notice') {
    // What someone sitting would notice: a star falling, the tide turning.
    const n = 2 + r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', r.int(22) * 0.5, K(7 + r.int(5)) + 12, 1.5, 0.08, { ratio: 3.5, bend: r.chance(0.5) ? -3 : 0 });
    b.hit(r.int(4), 'rush', 0.04, 6, { a: 3 });
    sing(b, r, 'p1', 0, phrase(r, 12, r.pick([2, 4]), -3, { cells: SLOW }), K, 1, 0.2, 0.3, { ...MEL, duty: 1 }, 0.95);
  } else {
    // The habit, put down: the step goes on up to the leading tone, then to the tonic, and stays.
    habit(b, 'p1', 0, K, 1, 1 + r.int(2), 1, 0.2, { duty: 2 });
    b.n('p1', 4, K(CINCH_HOLD) + 12, 2, 0.22, { duty: 1 }).n('p1', 6, K(7) + 12, 5.5, 0.22, { duty: 1, a: 0.05, ...MEL });
  }
  return b.out();
}

const cinchReal: TrackDef = {
  bpm: 58, start: 'sit', vary: 0.4, wrong: 0.03, swing: 0.1, stumble: 0.03, slip: 0.05, bendy: 0.15, echo: 0.45, wobble: 7,
  graph: { sit: [['notice', 2], ['down', 1], ['sit', 1]], notice: [['sit', 2], ['down', 1]], down: [['notice', 2], ['sit', 1]] },
  secs: { sit: (c) => cinchRealSec(c, 'sit'), notice: (c) => cinchRealSec(c, 'notice'), down: (c) => cinchRealSec(c, 'down') },
};

const G_MIX = key(55, MODE.mix);

function wildStrandSec(c: Ctx, kind: 'a' | 'b'): Section {
  const K = G_MIX, r = c.r, bar = 2.5, b = new B(bar * 4, bar, c.bpm);
  const roots = prog(r, kind === 'a' ? [0, 6, 3, 4] : [3, 0, 6, 4], { 0: [0, 5], 6: [6, 4], 3: [3, 1], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * bar, p = fold(K(R), 40);
    // Five eighths grouped three and two.
    b.n('tri', t0, p, 1.4, 0.5).n('tri', t0 + 1.5, p + K(R + 4) - K(R), 0.9, 0.42);
    b.hit(t0, 'kick', 0.3, 0.2).hit(t0 + 1.5, 'snare', 0.16, 0.15);
    for (const o of [0.5, 1, 2]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.3 });
    const ch = voiced(K, R, 62, 4);
    b.n('p2', t0 + 0.5, ch[1], 0.35, 0.09, { duty: 2, top: 0.7 }).n('p2', t0 + 2, ch[3], 0.35, 0.09, { duty: 2, top: 0.7 });
    arp(b, 'p2', t0, bar, ch, [0, 1, 2, 3, 2], 0.5, 0.09, { duty: 0, lay: 0.7 });
  });
  sing(b, r, 'p1', 0, phrase(r, 10, 4, 0, { cells: [[1, 0.5, 1], [1.5, 1], [0.5, 0.5, 0.5, 1], [1, 1.5]], hi: 9 }), K, 1, 0.27, 0.2, { ...MEL, duty: 2 }, 0.65);
  // Falling stars when it goes badly.
  for (let i = 0; i < 3; i++) b.n('bell', r.int(18) * 0.5, K(7 + r.int(5)) + 12, 0.8, 0.1, { ratio: 3.5, bend: -3, lay: 0.5 });
  return b.out();
}

const wildStrand: TrackDef = {
  bpm: 176, start: 'a', vary: 0.5, wrong: 0.06, slip: 0.12, bendy: 0.1, echo: 0.25, wobble: 5,
  graph: { a: [['b', 3], ['a', 1]], b: [['a', 3], ['b', 1]] },
  secs: { a: (c) => wildStrandSec(c, 'a'), b: (c) => wildStrandSec(c, 'b') },
};

const BB_AEO = key(58, MODE.aeo);

function keeperStrandSec(c: Ctx, kind: 'flood' | 'ebb' | 'crest'): Section {
  const K = BB_AEO, r = c.r, b = new B(16, 4, c.bpm);
  const roots = prog(r, kind === 'ebb' ? [0, 6, 5, 4] : [0, 3, 4, 5], { 0: [0, 5], 3: [3, 1], 4: [4, 6], 5: [5, 3], 6: [6, 4] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 4, p = fold(K(R), 34);
    // The bass is the tide: half a bar up the scale and half a bar back.
    [0, 1, 2, 3, 4, 3, 2, 1].forEach((d, j) => b.n('tri', t0 + j * 0.5, p + K(R + d) - K(R), 0.42, j === 0 ? 0.55 : 0.42));
    b.hit(t0, 'kick', 0.4, 0.2).hit(t0 + 1, 'snare', 0.22, 0.15).hit(t0 + 2.5, 'kick', 0.3, 0.2).hit(t0 + 3, 'snare', 0.24, 0.15);
    b.hit(t0 + 1.5, 'kick', 0.24, 0.2, { lay: 0.75 });
    for (const o of [0.5, 2, 3.5]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.3 });
    const ch = voiced(K, R, 58, 4);
    [0.5, 2, 3.5].forEach((o, j) => b.n('p2', t0 + o, ch[(j + 1) % 4], 0.3, 0.12, { duty: 2, top: 0.6 }));
    arp(b, 'p2', t0, 4, ch, [0, 1, 2, 3, 4, 3, 2, 1], 0.5, 0.1, { duty: 1, lay: 0.6 });
  });
  const mx = { ...MEL, duty: 1 }, wave = STRAND.slice(0, 7);
  if (kind === 'flood') {
    // The Strand's figure at speed, each bar coming in a step further.
    for (let i = 0; i < 4; i++) b.fig('p1', i * 4, aug(shift(wave, i), 0.5), K, 1, 0.3, mx, 0.85);
  } else if (kind === 'ebb') {
    for (let i = 0; i < 4; i++) b.fig('p1', i * 4, aug(shift(retro(wave), -i), 0.5), K, 1, 0.3, mx, 0.85);
  } else {
    sing(b, r, 'p1', 0, [[7, 3], [6, 1], [5, 2], [4, 2], [5, 3], [3, 1], [4, 4]], K, 1, 0.3, 0.6, mx, 0.95);
  }
  bellCopy(b, 0.8, 0.08, true);
  return b.out();
}

const keeperStrand: TrackDef = {
  bpm: 136, start: 'flood', vary: 0.45, wrong: 0.04, slip: 0.12, bendy: 0.15, echo: 0.2, wobble: 4, spread: 8,
  graph: { flood: [['ebb', 3], ['crest', 1]], ebb: [['flood', 2], ['crest', 2]], crest: [['flood', 3], ['ebb', 1]] },
  secs: { flood: (c) => keeperStrandSec(c, 'flood'), ebb: (c) => keeperStrandSec(c, 'ebb'), crest: (c) => keeperStrandSec(c, 'crest') },
};

const C_LYD = key(60, MODE.lyd);

function starfallSec(c: Ctx): Section {
  // Every pass is faster, and the falling arpeggios split finer: eighths, then triplets, then sixteenths.
  const lvl = (c.st.lvl = Math.min(9, (c.st.lvl ?? -1) + 1));
  const K = C_LYD, r = c.r, b = new B(8, 4, 112 + lvl * 9);
  const sub = lvl < 3 ? 0.5 : lvl < 6 ? 1 / 3 : 0.25, n = Math.round(2 / sub);
  const roots = prog(r, [0, 1, 5, 4], { 0: [0, 2], 1: [1, 3], 5: [5, 3], 4: [4, 1] }, 0.35);
  roots.forEach((R, i) => {
    const t0 = i * 2, p = fold(K(R), 40);
    b.n('tri', t0, p, 0.45, 0.5).n('tri', t0 + 0.5, p + 12, 0.4, 0.4).n('tri', t0 + 1, p + K(R + 4) - K(R), 0.45, 0.45).n('tri', t0 + 1.5, p + 12, 0.4, 0.4);
    b.hit(t0, 'kick', 0.26, 0.2).hit(t0 + 1, 'snare', 0.14, 0.12);
    if (lvl >= 2) b.hit(t0 + 0.5, 'hat', 0.04, 0.05).hit(t0 + 1.5, 'hat', 0.04, 0.05);
    // A star falls down the chord, and the shell rings when it is caught.
    const ch = voiced(K, R, 60, 4);
    for (let j = 0; j < n; j++) b.n('p2', t0 + j * sub, ch[3 - (j % 4)] + (j < 4 ? 12 : 0), sub * 0.7, 0.1, { duty: 0 });
    if (r.chance(0.7)) b.n('bell', t0 + 2 - sub, K(r.pick([0, 4, 7])) + 24, 0.5, 0.12, { ratio: 3.5 });
  });
  b.fig('p1', 0, phrase(r, 8, 4, 0, { cells: FAST }), K, 1, 0.22, { ...MEL, duty: 2 }, 0.7);
  return b.out();
}

const starfall: TrackDef = {
  bpm: 112, start: 'fall', vary: 0.45, wrong: 0.05, swing: 0.1, stumble: 0.04, slip: 0.2, bendy: 0.1, echo: 0.3, wobble: 4,
  graph: { fall: [['fall', 1]] },
  secs: { fall: starfallSec },
};

// ---------------------------------------------------------------- Act 2 credits: each place once, then the Volute inside a shell

function c2Strand(c: Ctx): Section {
  const K = EB_LYD, r = c.r, b = new B(10, 5, 66);
  b.n('tri', 0, 39, 9.5, 0.36, { a: 0.5 });
  b.fig('air', 0, STRAND, K, 1, 0.26, { a: 0.3 });
  for (let i = 0; i < 3; i++) b.n('bell', 1 + i * 3 + r.int(2), K(7 + r.int(5)) + 12, 1.5, 0.08, { ratio: 3.5, bend: -3 });
  return b.out();
}

function c2Sand(c: Ctx): Section {
  const K = AB_MIX, b = new B(10, 5, 96);
  for (let i = 0; i < 2; i++) {
    const t0 = i * 5, p = fold(K(i ? 4 : 0), 40);
    b.n('tri', t0, p, 1.4, 0.44).n('tri', t0 + 1.5, p + 7, 1.4, 0.38).n('tri', t0 + 3, p + 12, 1.8, 0.36);
    b.hit(t0, 'kick', 0.2, 0.2).hit(t0 + 3, 'tock', 0.1, 0.05);
    let t = t0;
    ARM_RHYTHM.forEach((l, j) => { b.n('p1', t, K(ARMS[(i * 2 + j) % 5]) + 12, l * 0.85, 0.24, { duty: 1 }); t += l; });
  }
  void c;
  return b.out();
}

function c2Cowrie(c: Ctx): Section {
  const K = B_LYD, r = c.r, b = new B(8, 4, 88);
  const f = phrase(r, 4, 4, 0, { cells: [[1, 1, 2], [0.5, 0.5, 1, 2]] });
  b.fig('bell', 0, f, K, 1, 0.16, { ratio: 3.5 }, 0.9);
  let t = 4;
  for (const [d, l] of retro(f)) { if (d !== null) b.n('bell', t, K(d) + 12, l * 0.95, 0.15, { ratio: 3.5, rev: 1 }); t += l; }
  b.n('tri', 0, 47, 3.9, 0.36).n('tri', 4, 47, 3.9, 0.36);
  return b.out();
}

function c2Auger(c: Ctx): Section {
  const K = key(50, MODE.dor), b = new B(9, 4, 100);
  let t = 0;
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < 3 + k; j++) b.n('p1', t + j * 0.5, fold(K(k * 2 + j), 62), 0.4, 0.24, { duty: 1 });
    t += (3 + k) * 0.5 + 1;
  }
  for (let i = 0; i < 18; i++) b.n('tri', i * 0.5, fold(K(Math.floor(i / 2)), 38), 0.42, 0.4);
  void c;
  return b.out();
}

function c2Nautilus(c: Ctx): Section {
  const K = F_AEO, r = c.r, b = new B(12, 4, 90);
  // Three chambers, three beats, then four, then five, each a voice short.
  let t0 = 0;
  [3, 4, 5].forEach((len, k) => {
    if (k < 1) b.hit(t0, 'stamp', 0.2, 0.3);
    if (k < 2) arp(b, 'p2', t0, len, voiced(K, 0, 60, 4), [0, 2, 1, 3], 0.5, 0.07, { duty: 1 });
    b.n('tri', t0, fold(K([0, 5, 3][k]), 41), len * 0.95, 0.38);
    b.fig('p1', t0, phrase(r, len, 4, 0), K, 1, 0.24, { duty: 1 }, 0.9);
    t0 += len;
  });
  return b.out();
}

function c2Tray(c: Ctx): Section {
  const r = c.r, b = new B(12, 3, 84);
  const empty = 1 + r.int(3);
  for (let s = 0; s < 4; s++) {
    b.hit(s * 3, 'tick', 0.05, 0.03);
    if (s !== empty) label(b, r, s * 3 + 0.5, 0.12);
  }
  b.n('tri', 0, 41, 11.5, 0.22, { a: 1 });
  return b.out();
}

function c2Cinch(c: Ctx): Section {
  const K = F_ION, b = new B(9, 3, 58);
  b.fig('p1', 0, SIT, K, 1, 0.24, { duty: 1 }, 0.95);
  b.n('tri', 0, 41, 2.8, 0.38).n('tri', 3, 46, 2.8, 0.36).n('tri', 6, 41, 2.9, 0.38);
  b.n('p2', 0, 69, 8.5, 0.06, { duty: 1, a: 0.4 });
  void c;
  return b.out();
}

function c2Collector(): Section {
  const K = AB_AEO, b = new B(9, 4, 72);
  // The Collector's figure whole: the missing degree sounds, the same note Ouro's figure lacks.
  b.fig('p1', 0, COLLECTOR_WHOLE, K, 1, 0.28, { duty: 3 }, 0.95);
  b.n('bell', 4, K(OURO_LACK) + 24, 4.5, 0.1, { ratio: 3.5 });
  b.n('tri', 0, 44, 3.9, 0.4).n('tri', 4, 47, 4.8, 0.4, { a: 0.2 });
  b.n('air', 4, K(OURO_LACK) + 12, 4.8, 0.2, { a: 0.3 });
  return b.out({ still: true });
}

function c2Shell(): Section {
  const K = D_DOR, b = new B(20, 4, 56), spb = 60 / 56;
  // A shell held to the ear: the sea, and inside it the title's tune on the breath voice, far away.
  b.hit(0, 'rush', 0.07, 14.9, { a: 3 * spb });
  b.n('tri', 1, 38, 16, 0.24, { a: 2 });
  b.fig('air', 1, lack(aug(OURO, 2)), K, 0, 0.22, { a: 0.4, det: -10 }, 0.97);
  b.fig('air', 9, lack(aug(shift(OURO, 3), 2)), K, 0, 0.18, { a: 0.4, det: -10 }, 0.97);
  // Where the missing note belongs, the sea swells instead.
  b.hit(15, 'rush', 0.12, 4.8, { a: 2 * spb });
  return b.out({ still: true });
}

const credits2: TrackDef = {
  bpm: 66, start: 'strand', vary: 0.25, wrong: 0, echo: 0.55, wobble: 7,
  graph: {
    strand: [['sand', 1]], sand: [['cowrie', 1]], cowrie: [['auger', 1]], auger: [['nautilus', 1]],
    nautilus: [['tray', 1]], tray: [['cinch', 1]], cinch: [['collector', 1]], collector: [['shell', 1]],
  },
  secs: {
    strand: c2Strand, sand: c2Sand, cowrie: c2Cowrie, auger: c2Auger, nautilus: c2Nautilus,
    tray: c2Tray, cinch: c2Cinch, collector: c2Collector, shell: c2Shell,
  },
};

// ================================================================ the new world: the coast round the Lipwater, the woods, Holm, and the gem puzzle

/** Holm's lap: one degree for each place it passes on its way round the Lipwater. Its last note leads back into its first, so the lap never ends. */
export const LAP: readonly number[] = [0, 1, 3, 2, 4, 3, 1, -1];
/** Where each coast map lies on Holm's lap, so Holm far out plays its lap from that place. */
const STATION = { cove: 0, highwater: 1, saltings: 2, kelp: 3, gantry: 4, floes: 5, shingle: 6, longway: 7 } as const;
/** The Islander: she starts after the beat, says it plain, comes home by the step below, and adds a short low "so". */
export const ISLE: Fig = [[null, 0.5], [4, 0.5], [4, 0.5], [3, 0.5], [1, 1], [-1, 0.5], [0, 1.5], [-3, 0.5], [null, 0.5]];

/** `n` notes of Holm's lap from place `from`, each `len` beats long. */
export function lapFig(from: number, n: number, len: number): Fig {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) out.push([LAP[(((from + i) % 8) + 8) % 8], len]);
  return out;
}

/** A wave on the shore: the noise swells over most of its length and stops. Nothing else may use the noise voice while it runs. */
function wave(b: B, t: number, len: number, g: number, spb: number, x?: Partial<Ev>): void {
  b.hit(t, 'rush', g, len, { a: len * spb * 0.6, ...x });
}

/** Holm far out on the water: its lap from the place it has reached, slow, low, and a little flat on the breath voice. */
function farHolm(b: B, t: number, K: Key, from: number, g: number, len = 2): number {
  return b.fig('air', t, lapFig(from, 8, len), K, 0, g, { a: 0.5, det: -12 }, 0.96);
}

const flatFig = (f: Fig): number[] => f.flatMap(([d, l]) => [d ?? -99, l]);
function unflatFig(x: readonly number[]): Fig {
  const f: Array<[number | null, number]> = [];
  for (let i = 0; i < x.length; i += 2) f.push([x[i] === -99 ? null : x[i], x[i + 1]]);
  return f;
}

/** Long cells for bars of six slow beats. */
const SLOW6: number[][] = [[3, 3], [2, 1, 3], [4, 2], [1.5, 1.5, 3], [6]];

// ---------------------------------------------------------------- Cockle Cove: the Islander beside her driftwood floor

const C_ION = key(48, MODE.ion);

function coveSec(c: Ctx, kind: 'floor' | 'pools' | 'dusk'): Section {
  const K = C_ION, r = c.r, b = new B(24, 3, c.bpm), spb = 60 / c.bpm;
  // The bass walks Holm's lap a place a bar and reaches the cove on the last bar. The Islander still keeps its hours.
  for (let i = 0; i < 8; i++) {
    const R = LAP[(i + 1) % 8], p = fold(K(R), 36), t0 = i * 3;
    if (kind === 'dusk') b.n('tri', t0, p, 2.9, 0.34, { a: 0.2 });
    else b.n('tri', t0, p, 1.4, 0.42).n('tri', t0 + 1.5, p + K(R + 4) - K(R), 1.3, 0.34);
    if (kind === 'floor') {
      const ch = voiced(K, R, 60);
      b.n('p2', t0 + 0.5, ch[1], 0.9, 0.08, { duty: 1 }).n('p2', t0 + 2, ch[2], 0.9, 0.07, { duty: 1 });
    } else if (kind === 'pools') arp(b, 'p2', t0, 3, voiced(K, R, 60), [0, 1, 2, 3, 2, 1], 0.5, 0.06, { duty: 0 });
  }
  // A wave every two bars, and crabs crossing the sand sideways between them.
  for (let w = 0; w < 24; w += 6) {
    const at = w + r.pick([0, 0.5, 1]), len = 3.5 + r.int(2) * 0.5;
    wave(b, at, len, r.range(0.09, 0.13), spb);
    if (r.chance(0.5)) for (let j = 0, s = at + len + 0.15; j < 5 && s + j * 0.17 < w + 5.95; j++) b.hit(s + j * 0.17, 'tick', 0.04, 0.03);
  }
  const mx = { ...MEL, duty: 1 };
  if (kind === 'floor') {
    // She says where each thing went, one thing at a time, and comes home on the lap's last bar.
    const opts = { cells: SIX, lo: -1, hi: 7, rest: 0.15 };
    b.fig('p1', 0, [...phrase(r, 9, 4, 2, opts), ...phrase(r, 9, 3, 1, opts)], K, 1, 0.26, mx, 0.9);
    b.fig('p1', 18, ISLE, K, 1, 0.28, mx, 0.9);
  } else if (kind === 'pools') {
    const n = 2 + r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', r.int(32) * 0.5, K(7 + r.int(6)) + 12, 0.6, r.range(0.08, 0.13), { ratio: 2.4, bend: -2, ...MEL });
    sing(b, r, 'p1', 0, phrase(r, 15, 4, 1, { cells: SIX, rest: 0.3 }), K, 1, 0.22, 0.25, mx, 0.85);
    b.fig('bell', 18, ISLE, K, 2, 0.12, { ratio: 3.5, ...MEL });
  } else {
    // At dusk Holm shows far out on its way round, and she says her line to the water.
    farHolm(b, 0, K, STATION.cove, 0.15);
    b.n('p2', 0, K(r.pick([4, 2])) + 12, 11.5, 0.05, { duty: 1, a: 1 });
    b.fig('p1', 18, ISLE, K, 1, 0.24, mx, 0.95);
  }
  return b.out();
}

const cove: TrackDef = {
  bpm: 72, start: 'floor', vary: 0.45, wrong: 0.04, slip: 0.08, bendy: 0.15, echo: 0.45, wobble: 7, spread: 8,
  graph: { floor: [['pools', 3], ['dusk', 1], ['floor', 1]], pools: [['floor', 2], ['dusk', 2]], dusk: [['floor', 3], ['pools', 1]] },
  secs: { floor: (c) => coveSec(c, 'floor'), pools: (c) => coveSec(c, 'pools'), dusk: (c) => coveSec(c, 'dusk') },
};

// ---------------------------------------------------------------- the woods: in threes, with knocks of wood between the trees

const BB_ION = key(58, MODE.ion);

function brookSec(c: Ctx, kind: 'brook' | 'stones' | 'den'): Section {
  const K = BB_ION, r = c.r, b = new B(24, 3, c.bpm);
  const roots = prog(r, kind === 'den' ? [5, 3, 0, 4, 5, 1, 4, 0] : [0, 3, 4, 0, 5, 1, 4, 0], { 0: [0, 5], 3: [3, 1], 4: [4, 6], 5: [5, 3], 1: [1, 3] }, 0.3);
  roots.forEach((R, i) => {
    bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 8], 38, 'waltz', kind === 'den' ? 0.3 : 0.38, r);
    // The brook runs south: every ripple runs downhill.
    if (kind !== 'den' && !(kind === 'stones' && i === 7)) arp(b, 'p2', i * 3, 3, voiced(K, R, 62, 4).reverse(), [0, 1, 2, 3, 1, 2], 0.5, 0.06, { duty: 0 });
    if (r.chance(0.4)) b.hit(i * 3 + r.pick([1, 2]), 'tock', 0.06, 0.04);
  });
  if (kind === 'brook') {
    sing(b, r, 'p1', 0, [...phrase(r, 12, 4, 2, { cells: WALTZ }), ...phrase(r, 12, 2, 0, { cells: WALTZ })], K, 0, 0.26, 0.25, { ...MEL, duty: 3 }, 0.9);
  } else if (kind === 'stones') {
    // The counting stones: stone k has k pebbles, so the bell counts one, then two, and on to seven, a step higher each stone.
    // A stone stepped on out of order tips: the count falls in the brook with a splash, and the crossing stops there.
    const tip = r.chance(0.35) ? 2 + r.int(5) : 0;
    for (let k = 1; k <= 7; k++) {
      const t0 = (k - 1) * 3, n = k === tip ? k + r.pick([1, -1]) : k, step = n > 1 ? 2 / n : 1;
      for (let j = 0; j < n; j++) b.n('bell', t0 + j * step, K(k - 1) + 12, Math.min(0.45, step * 0.8), 0.13, { ratio: 3.5, bend: k === tip && j === n - 1 ? -5 : undefined });
      if (k === tip) { b.hit(t0 + 2.2, 'rush', 0.14, 0.7); break; }
    }
    // Across, Tack's old den keeps his first tally. Back on the near bank is his board: "1 then 2. Easy."
    if (tip) b.fig('p1', 21, [[0, 1], [1, 1.5]], K, 1, 0.24, { ...MEL, duty: 2 });
    else tackCount(b, c, 'p2', 21, K, 0, 1, 0.5, 0.16);
  } else {
    // Tack's old den in the thicket: a hush, leaves, and his count far off and slow.
    roots.forEach((R, i) => { if (i % 2 === 0) b.n('p2', i * 3, voiced(K, R, 62, 4)[r.pick([1, 3])], 5.6, 0.05, { duty: 1, a: 0.4 }); });
    sing(b, r, 'air', 0, phrase(r, 12, 4, 0, { cells: [[3], [2, 1], [1.5, 1.5], [1, 2]] }), K, 0, 0.22, 0.4, { a: 0.2, ...MEL });
    tackCount(b, c, 'bell', 13, K, 4, 1, 1, 0.08, { ratio: 2.4 });
    for (let t = 18.5; t < 24; t += r.pick([1, 1.5])) b.hit(t, 'hat', 0.025, 0.05);
  }
  return b.out();
}

const brook: TrackDef = {
  bpm: 96, start: 'brook', vary: 0.5, wrong: 0.05, slip: 0.12, bendy: 0.15, echo: 0.4, wobble: 6,
  graph: { brook: [['stones', 2], ['den', 1], ['brook', 1]], stones: [['brook', 3], ['den', 1]], den: [['brook', 2], ['stones', 2]] },
  secs: { brook: (c) => brookSec(c, 'brook'), stones: (c) => brookSec(c, 'stones'), den: (c) => brookSec(c, 'den') },
};

function shoutSec(c: Ctx, kind: 'shout' | 'clearing' | 'hush'): Section {
  const K = E_DOR, r = c.r, b = new B(24, 3, c.bpm);
  const roots = prog(r, kind === 'clearing' ? [0, 3, 6, 4, 0, 3, 4, 0] : [0, 6, 3, 0, 4, 3, 6, 0], { 0: [0, 5], 3: [3, 1], 6: [6, 4], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => {
    bassBar(b, K, i * 3, 3, R, roots[(i + 1) % 8], 40, 'waltz', kind === 'hush' ? 0.28 : 0.36, r);
    if (kind !== 'hush' && r.chance(0.5)) b.hit(i * 3 + r.pick([1, 2]), 'tock', 0.06, 0.04);
  });
  if (kind === 'shout') {
    // Spire's people walk out here to talk at full voice: the town's flat repeated notes with a tritone in them, said loud, ending on a leap.
    // The wood says each one back from further off, quieter, later, and a little flat.
    for (let s = 0; s < 4; s++) {
      const t0 = s * 6, d = r.pick([0, 2, 4, 3]), n = 3 + r.int(3), odd = r.chance(0.5) ? 1 + r.int(n - 1) : -1, leap = r.pick([3, 4, 5, 7]);
      let t = t0;
      for (let j = 0; j < n; j++, t += 0.5) b.n('p1', t, K(d) + (j === odd ? 6 : 0), 0.4, 0.34, { ...MEL, duty: 2 });
      b.n('p1', t, K(d + leap), 1.3, 0.36, { ...MEL, duty: 2 });
      const back = t + 1.5 + r.pick([0, 0.5]), m = Math.min(n, 3);
      for (let j = 0; j < m; j++) b.n('p2', back + j * 0.5, K(d), 0.35, 0.08, { duty: 0, det: -18 });
      b.n('p2', back + m * 0.5, K(d + leap), 1, 0.07, { duty: 0, det: -18 });
    }
    // Under Spire a loud voice rings a bell. This far out the bell barely sounds.
    if (r.chance(0.4)) b.n('bell', 20 + r.int(6) * 0.5, fold(K(r.pick([0, -3])), 40), 3, 0.07, { ratio: 1.41 });
  } else if (kind === 'clearing') {
    // The stream runs west toward the Saltings, and here people sing at full voice too.
    roots.forEach((R, i) => arp(b, 'p2', i * 3, 3, voiced(K, R, 59, 4), [0, 1, 2, 3, 2, 1], 0.5, 0.06, { duty: 0 }));
    sing(b, r, 'p1', 0, [...phrase(r, 12, 4, 2, { cells: WALTZ, hi: 8 }), ...phrase(r, 12, 3, 0, { cells: WALTZ, hi: 8 })], K, 0, 0.3, 0.3, { ...MEL, duty: 3 }, 0.9);
  } else {
    // The east path, where a sleeper lies across the way: everyone hushes, and one shout comes from far off.
    sing(b, r, 'air', 0, phrase(r, 12, 4, 0, { cells: [[3], [2, 1], [1.5, 1.5]], lo: -3, hi: 7 }), K, 0, 0.18, 0.4, { a: 0.3, ...MEL });
    const t0 = 13 + r.int(4) * 0.5, d = r.pick([0, 2, 4]);
    for (let j = 0; j < 3; j++) b.n('p2', t0 + j * 0.5, K(d), 0.35, 0.06, { duty: 0, det: -25 });
    b.n('p2', t0 + 1.5, K(d + r.pick([4, 5])), 1.2, 0.05, { duty: 0, det: -25 });
    b.n('p1', 17 + r.int(3), K(r.pick([0, 4])), 4, 0.12, { ...MEL, duty: 1, a: 0.3 });
  }
  return b.out();
}

const shout: TrackDef = {
  bpm: 104, start: 'shout', vary: 0.5, wrong: 0.06, slip: 0.12, bendy: 0.15, echo: 0.6, wobble: 6, spread: 10,
  graph: { shout: [['clearing', 2], ['hush', 1], ['shout', 1]], clearing: [['shout', 2], ['hush', 1], ['clearing', 1]], hush: [['shout', 2], ['clearing', 2]] },
  secs: { shout: (c) => shoutSec(c, 'shout'), clearing: (c) => shoutSec(c, 'clearing'), hush: (c) => shoutSec(c, 'hush') },
};

/** The order the Gate Ring's round brings its voices in, one for each gatehouse. */
const RING_VOICES: Voice[] = ['p1', 'p2', 'air', 'bell'];

/** One line of the round: two bars over the Gate Ring's two chords, I then II, so any line fits under any other. */
function ringLine(r: Rng): Fig {
  return [
    ...phrase(r, 3, r.pick([0, 2, 4, 7]), r.pick([0, 2, 4, 7]), { cells: WALTZ, lo: 0, hi: 9 }),
    ...phrase(r, 3, r.pick([1, 3, 5, 8]), r.pick([1, 3, 5]), { cells: WALTZ, lo: 0, hi: 9 }),
  ];
}

function ringSec(c: Ctx, kind: 'round' | 'springs' | 'gate'): Section {
  const K = C_LYD, r = c.r, b = new B(24, 3, c.bpm);
  // The Apex stands sheer in the middle and nothing moves it: a low C under the whole of every section.
  b.n('tri', 0, 36, 24, 0.3, { a: 0.5, pin: 1 });
  for (let i = 0; i < 8; i++) if (r.chance(0.5)) b.hit(i * 3 + r.pick([1, 2]), 'tock', 0.05, 0.04);
  if (kind === 'round') {
    // The ring road is a round of three lines. A voice comes in every two bars, one for each gatehouse, sings all three lines, and stops.
    // A different gate starts it each time, and one line is new.
    for (let k = 0; k < 3; k++) if (!c.mem['ring' + k] || (c.visit > 0 && k === c.visit % 3)) c.mem['ring' + k] = flatFig(ringLine(r));
    const first = c.st.gate ?? 0;
    c.st.gate = (first + 1) % 4;
    for (let v = 0; v < 4; v++) {
      const voice = RING_VOICES[(first + v) % 4];
      const oct = voice === 'p2' ? -1 : voice === 'bell' ? 1 : 0;
      const g = voice === 'bell' ? 0.12 : voice === 'air' ? 0.22 : voice === 'p2' ? 0.14 : 0.24;
      for (let k = 0; k < 3 && v + k < 4; k++) b.fig(voice, (v + k) * 6, unflatFig(c.mem['ring' + k]), K, oct, g, { ...MEL, duty: 1, ratio: 3.5, a: voice === 'air' ? 0.08 : undefined }, 0.9);
    }
  } else if (kind === 'springs') {
    // Springs rise all round the road, and every stream in the Volute starts at one: short runs that bubble up from low.
    const n = 5 + r.int(4);
    for (let i = 0; i < n; i++) {
      const t0 = r.int(44) * 0.5, d0 = r.pick([0, 1, 2, 4]), len = 4 + r.int(3);
      for (let j = 0; j < len; j++) b.n('p2', t0 + j * 0.25, K(d0 + j), 0.2, 0.05 + j * 0.008, { duty: 0 });
    }
    sing(b, r, 'p1', 0, [...phrase(r, 12, 4, 1, { cells: WALTZ }), ...phrase(r, 12, 3, 0, { cells: WALTZ })], K, 0, 0.22, 0.3, { ...MEL, duty: 3 }, 0.9);
  } else {
    // Each gatekeeper works for one Hand, and the Hand's habit carries out to the road, slow and quiet.
    const hand = (c.st.hand = ((c.st.hand ?? -1) + 1) % 4), mx = { ...MEL, duty: 1 };
    if (hand !== 1) for (let i = 0; i < 8; i++) b.n('p2', i * 3, voiced(K, i % 2, 55)[r.pick([1, 2])], 2.8, 0.05, { duty: 1, a: 0.3 });
    if (hand === 0) {
      // Fid: every interval wider than the last, every note longer.
      let d = 0, t = 0;
      for (let i = 0; i < 6; i++) { const len = [1, 1.5, 2, 2.5, 3, 3][i]; b.n('p1', t, K(d), len * 0.9, 0.22, mx); t += len; d += (i % 2 ? -1 : 1) * (i + 1); }
    } else if (hand === 1) {
      // Lug: weather that stays indoors, a close drizzle under a held note.
      for (let t = 6; t < 18; t += 0.25) if (r.chance(0.45)) b.n('p2', t, K(7 + r.int(5)), 0.15, 0.06, { duty: 0 });
      b.n('air', 3, K(4), 15, 0.16, { a: 1.5, bend: -0.5 });
    } else if (hand === 2) {
      // Hasp: phrases that end on a rising leap and are never answered.
      for (let i = 0; i < 3; i++) {
        const t = b.fig('p1', i * 6, phrase(r, 3, r.pick([0, 2, 4]), r.pick([1, 3]), { cells: WALTZ }), K, 0, 0.22, mx, 0.85);
        b.n('p1', t, K(r.pick([5, 6, 7])), 1.5, 0.22, { ...mx, bend: 0.5 });
      }
    } else {
      // Purchase: two, then three, then a price a step higher.
      for (let i = 0; i < 3; i++) {
        const d = r.pick([0, 2, 4]), t0 = i * 6;
        for (let j = 0; j < 2; j++) b.n('p1', t0 + j * 0.5, K(d), 0.3, 0.2, { duty: 2 });
        for (let j = 0; j < 3; j++) b.n('p1', t0 + 1.5 + j * 0.5, K(d + 1), 0.3, 0.2, { duty: 2 });
        b.n('p1', t0 + 3, K(d + r.pick([3, 4, 5])), 2, 0.22, { ...mx, duty: 2 });
      }
    }
    // High up the Apex, Cinch's held note rings once and does not go up to the tonic.
    b.n('bell', 19 + r.int(4) * 0.5, K(CINCH_HOLD) + 12, 4, 0.07, { ratio: 1.41 });
  }
  return b.out();
}

const gatering: TrackDef = {
  bpm: 80, start: 'round', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.15, echo: 0.5, wobble: 7,
  graph: { round: [['springs', 2], ['gate', 2], ['round', 1]], springs: [['round', 2], ['gate', 1]], gate: [['round', 2], ['springs', 1]] },
  secs: { round: (c) => ringSec(c, 'round'), springs: (c) => ringSec(c, 'springs'), gate: (c) => ringSec(c, 'gate') },
};

// ---------------------------------------------------------------- the coast: waves on the noise voice, and Holm far out on the water

const F_DOR = key(53, MODE.dor);
/** The High-water Mark: the degree every written line on the old tide line climbs to and none goes past. */
const MARK = 11;

function highSec(c: Ctx, kind: 'line' | 'pines' | 'wrack'): Section {
  const K = F_DOR, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  const roots = prog(r, kind === 'wrack' ? [0, 6, 3, 4] : [0, 3, 0, 6], { 0: [0, 5], 3: [3, 1], 6: [6, 4], 4: [4, 1] }, 0.3);
  if (kind === 'pines') roots.forEach((R, i) => b.n('tri', i * 4, fold(K(R), 41), 3.8, 0.34, { a: 0.4 }));
  else bassLine(b, K, roots, 4, 41, kind === 'wrack' ? 'walk' : 'half', 0.38, r);
  const mx = { ...MEL, duty: 1 };
  if (kind === 'line') {
    // Every phrase climbs to the mark the old tides left and holds there, and a bell rings at the same height, like driftwood on the line.
    let t = 0;
    for (let ph = 0; ph < 2; ph++) {
      t = b.fig('p1', t, phrase(r, 4, MARK - 5 - r.int(3), MARK - 2, { lo: MARK - 8, hi: MARK - 1 }), K, 0, 0.26, mx, 0.9);
      b.n('p1', t, K(MARK), 1.9, 0.27, { duty: 1, pin: 1 });
      b.n('bell', t + 0.5, K(MARK), 2.5, 0.09, { ratio: 3.5 });
      t = b.fig('p1', t + 2, phrase(r, 2, MARK - 2, MARK - 4 - r.int(3), { lo: MARK - 8, hi: MARK - 1 }), K, 0, 0.24, mx, 0.9);
    }
    roots.forEach((R, i) => b.n('p2', i * 4 + 1, voiced(K, R, 57, 4)[r.pick([1, 2, 3])], 2.5, 0.06, { duty: 1, a: 0.3 }));
  } else if (kind === 'pines') {
    // Wind in the pines along the ridge, and needles ticking down.
    b.hit(r.int(2), 'rush', 0.06, 7, { a: 4 * spb }).hit(8 + r.int(2), 'rush', 0.05, 6.5, { a: 3.5 * spb });
    sing(b, r, 'air', 0, phrase(r, 16, 7, 4, { cells: [[4], [3, 1], [2, 2], [6, 2]], lo: 4, hi: MARK - 1 }), K, 0, 0.2, 0.5, { a: 0.4, ...MEL });
    const n = 4 + r.int(4);
    for (let i = 0; i < n; i++) b.n('p2', r.int(32) * 0.5, K(MARK - r.int(4)), 0.12, 0.04, { duty: 0 });
  } else {
    // The ridge of old weed and driftwood: knocks of wood, then the sea that left comes back as far as it can and stops.
    for (let t = r.pick([0.5, 1]); t < 11; t += r.pick([1.5, 2, 2.5])) b.hit(t, 'tock', r.range(0.05, 0.09), 0.04);
    wave(b, 12, 3.5, 0.08, spb, { a: 3.3 * spb });
    roots.forEach((R, i) => comp(b, K, i * 4, 4, R, roots[(i + 1) % 4], 57, 0.08, r));
    sing(b, r, 'p1', 0, [...phrase(r, 8, 4, 1, { rest: 0.2, hi: 9 }), ...phrase(r, 8, 3, 0, { hi: 9 })], K, 0, 0.24, 0.3, { ...MEL, duty: 3 }, 0.88);
  }
  return b.out();
}

const highwater: TrackDef = {
  bpm: 74, start: 'line', vary: 0.4, wrong: 0.05, slip: 0.1, bendy: 0.2, echo: 0.5, wobble: 8,
  graph: { line: [['pines', 2], ['wrack', 2], ['line', 1]], pines: [['line', 2], ['wrack', 1]], wrack: [['line', 2], ['pines', 1]] },
  secs: { line: (c) => highSec(c, 'line'), pines: (c) => highSec(c, 'pines'), wrack: (c) => highSec(c, 'wrack') },
};

const EB_MIX = key(51, MODE.mix);

function saltSec(c: Ctx, kind: 'pans' | 'works' | 'far'): Section {
  const K = EB_MIX, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  const roots = prog(r, kind === 'works' ? [0, 6, 3, 4] : [0, 3, 6, 0], { 0: [0, 5], 3: [3, 1], 6: [6, 4], 4: [4, 1] }, 0.3);
  if (kind === 'pans') {
    roots.forEach((R, i) => {
      const t0 = i * 4;
      b.n('tri', t0, fold(K(R), 39), 3.8, 0.36, { a: 0.1 });
      // A board lifts between two pans and the water levels: the two pulses step toward each other until they meet.
      // An odd measure stays in the pan nearer the sea, so then the lower voice ends a step above the upper one.
      let lo = ((R % 7) + 7) % 7, hi = lo + 5 + r.int(4), t = t0 + 0.5;
      b.hit(t0, 'sweep', 0.06, 1);
      while (hi - lo > 1 && t < t0 + 3) {
        b.n('p1', t, K(hi), 0.42, 0.2, { duty: 1 }).n('p2', t, K(lo), 0.42, 0.14, { duty: 1 });
        hi--; lo++; t += 0.5;
      }
      if (hi - lo === 1) [hi, lo] = [lo, hi];
      b.n('p1', t, K(hi), t0 + 3.9 - t, 0.2, { duty: 1 }).n('p2', t, K(lo), t0 + 3.9 - t, 0.14, { duty: 1 });
      // Salt left behind as the pan dries.
      if (r.chance(0.6)) b.n('bell', t0 + 3 + r.pick([0, 0.5]), K(r.pick([4, 7, 9])) + 24, 0.4, 0.07, { ratio: 3.5 });
    });
  } else if (kind === 'works') {
    bassLine(b, K, roots, 4, 39, 'walk', 0.4, r);
    // Rakes on the pans and boots on the jetty boards.
    for (let i = 0; i < 4; i++) { b.hit(i * 4, 'stamp', 0.14, 0.2).hit(i * 4 + 2, 'stamp', 0.1, 0.2); for (const o of [1, 3]) b.hit(i * 4 + o, 'tock', 0.06, 0.04); }
    roots.forEach((R, i) => comp(b, K, i * 4, 4, R, roots[(i + 1) % 4], 60, 0.09, r));
    sing(b, r, 'p1', 0, [...phrase(r, 8, 4, 2), ...phrase(r, 8, 3, 0)], K, 1, 0.26, 0.25, { ...MEL, duty: 1 }, 0.88);
    // The salt workers still talk about Brack: Tack's count on the bell, with one accent bent out of shape.
    if (r.chance(0.4)) tackCount(b, c, 'bell', 12, K, 4, 1, 0.5, 0.1, { ratio: 2.4 }, { bend: r.pick([-1, 1, -2]) });
  } else {
    // Holm off the Saltings, and the Lipwater coming in over the sluice boards.
    roots.forEach((R, i) => b.n('tri', i * 4, fold(K(R), 39), 3.8, 0.32, { a: 0.4 }));
    wave(b, r.pick([0, 0.5]), 5, 0.11, spb);
    wave(b, 8 + r.pick([0, 0.5]), 5, 0.1, spb);
    farHolm(b, 0, K, STATION.saltings, 0.15);
    b.n('p2', 2, K(r.pick([4, 6])) + 12, 12, 0.05, { duty: 1, a: 1 });
    if (r.chance(0.6)) b.n('bell', 13 + r.int(4) * 0.5, K(r.pick([4, 7, 9])) + 24, 0.4, 0.07, { ratio: 3.5 });
  }
  return b.out();
}

const saltings: TrackDef = {
  bpm: 84, start: 'pans', vary: 0.45, wrong: 0.05, swing: 0.1, stumble: 0.04, slip: 0.12, bendy: 0.15, echo: 0.4, wobble: 6,
  graph: { pans: [['works', 2], ['far', 1], ['pans', 1]], works: [['pans', 2], ['far', 1], ['works', 1]], far: [['pans', 2], ['works', 2]] },
  secs: { pans: (c) => saltSec(c, 'pans'), works: (c) => saltSec(c, 'works'), far: (c) => saltSec(c, 'far') },
};

const DB_LYD = key(49, MODE.lyd);

function kelpSec(c: Ctx, kind: 'beds' | 'jingle' | 'far'): Section {
  const K = DB_LYD, r = c.r, b = new B(24, 6, c.bpm), spb = 60 / c.bpm;
  const roots = prog(r, kind === 'jingle' ? [0, 4, 1, 0] : [0, 1, 4, 0], { 0: [0, 5], 1: [1, 3], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 6, p = fold(K(R), 37), five = K(R + 4) - K(R), third = K(R + 2) - K(R);
    if (kind === 'jingle' && i % 2 === 1) {
      // Rung awake, a sleeper rolls over once and goes back to sleep.
      [0, five, 12, 12 + third, 12, five].forEach((o, j) => b.n('tri', t0 + j * 0.5, p + o, 0.45, 0.4));
      b.n('tri', t0 + 3, p, 2.8, 0.38, { a: 0.6 });
    } else b.n('tri', t0, p, 5.8, 0.4, { a: 1.2 });
    // The kelp sways: two notes a step apart, each leaning toward the other.
    for (let j = 0; j < 4; j++) b.n('p2', t0 + j * 1.5, K(R + (j % 2 ? 3 : 2)) + 12, 1.4, 0.06, { duty: 1, a: 0.3, bend: j % 2 ? -0.5 : 0.5 });
    // A second sleeper breathes on the breath voice, in and out. Rolled over, its breath turns upside down.
    if (kind !== 'far' && i % 2 === 1) {
      const flip = kind === 'jingle' ? -1 : 1;
      b.n('air', t0 + 0.5, K(R), 2.4, 0.11, { a: 0.9, bend: flip }).n('air', t0 + 3, K(R) + 2 * flip, 2.8, 0.1, { a: 0.4, bend: -1.5 * flip });
    }
  });
  if (kind === 'beds') {
    for (const w of [0, 12]) wave(b, w + r.pick([0, 1]), 7 + r.int(2), 0.09, spb);
    sing(b, r, 'p1', 0, [...phrase(r, 12, 4, 1, { cells: SLOW6, hi: 9 }), ...phrase(r, 12, 3, 0, { cells: SLOW6, hi: 9 })], K, 1, 0.22, 0.4, { ...MEL, duty: 1 }, 0.92);
  } else if (kind === 'jingle') {
    // The jingle: a hoop of thin shells shaken, and the sleepers within reach roll over once.
    for (const t0 of [0, 12]) for (let j = 0; j < 8; j++) b.hit(t0 + j * 0.125 + (j % 2 ? 0.03 : 0), 'tick', 0.09 * (1 - j * 0.08), 0.03);
    b.fig('p1', 13, phrase(r, 10, 4, 0, { cells: SLOW6 }), K, 1, 0.2, { ...MEL, duty: 1 }, 0.92);
    b.n('bell', 1 + r.int(4) * 0.5, K(r.pick([4, 7, 9])) + 24, 1, 0.08, { ratio: 3.5 });
  } else {
    // Holm off the Kelp Beds.
    for (const w of [0, 12]) wave(b, w + r.pick([0, 1]), 7 + r.int(2), 0.1, spb);
    farHolm(b, 1, K, STATION.kelp, 0.15, 2.75);
  }
  return b.out();
}

const kelp: TrackDef = {
  bpm: 58, start: 'beds', vary: 0.4, wrong: 0.05, slip: 0.1, bendy: 0.35, echo: 0.55, wobble: 11,
  graph: { beds: [['jingle', 1], ['far', 1], ['beds', 1]], jingle: [['beds', 2], ['far', 1]], far: [['beds', 2], ['jingle', 1]] },
  secs: { beds: (c) => kelpSec(c, 'beds'), jingle: (c) => kelpSec(c, 'jingle'), far: (c) => kelpSec(c, 'far') },
};

/** Quarter turns each crane still needs before all four arms point at the sea. A turn moves its crane on one and its neighbors back one. */
export function craneTurns(s: readonly number[]): number[] {
  const m = (x: number) => ((x % 4) + 4) % 4, e = s.map((x) => m(-x));
  return [m(e[0] - e[2] - e[3]), m(-e[2] - e[3]), m(-e[0] - e[1]), m(e[3] - e[0] - e[1])];
}

function gantrySec(c: Ctx, kind: 'turn' | 'far' | 'cage'): Section {
  const K = G_MIX, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  if (!c.mem.cranes) c.mem.cranes = [1 + r.int(3), r.int(4), 1 + r.int(3), r.int(4)];
  const cr = c.mem.cranes;
  let turned = -1;
  if (kind === 'turn') {
    // Somebody works the cranes: one turns a quarter turn, and its neighbors turn back a quarter.
    const need = craneTurns(cr).map((x, j) => (x ? j : -1)).filter((j) => j >= 0);
    turned = need.length && r.chance(0.7) ? r.pick(need) : r.int(4);
    cr[turned] = (cr[turned] + 1) % 4;
    if (turned > 0) cr[turned - 1] = (cr[turned - 1] + 3) % 4;
    if (turned < 3) cr[turned + 1] = (cr[turned + 1] + 3) % 4;
  }
  const roots = prog(r, [0, 6, 3, 4], { 0: [0, 5], 6: [6, 4], 3: [3, 1], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => {
    const t0 = i * 4;
    bassBar(b, K, t0, 4, R, roots[(i + 1) % 4], 40, 'half', 0.38, r);
    // Each crane's arm is a four-note figure on its chord, turned to wherever the arm points. An arm at rest points at the sea.
    const arm = voiced(K, R, 55, 4), o = cr[i], g = kind === 'far' ? 0.05 : 0.09;
    for (let j = 0; j < 8; j++) b.n('p2', t0 + j * 0.5, arm[(j + o) % 4], 0.35, j % 4 === 0 ? g * 1.2 : g, { duty: 2 });
    if (kind === 'far') return;
    if (i === turned) b.hit(t0, 'sweep', 0.07, 3.5);
    else for (let j = 0; j < 4; j++) b.hit(t0 + j, j % 2 ? 'tock' : 'tick', j ? 0.05 : 0.08, 0.04);
  });
  const mx = { ...MEL, duty: 1 };
  if (kind === 'turn') {
    sing(b, r, 'p1', 0, [...phrase(r, 8, 4, 2, { hi: 8 }), ...phrase(r, 8, 3, 0, { hi: 8 })], K, 1, 0.26, 0.25, mx, 0.88);
  } else if (kind === 'cage') {
    // All four arms point at the sea, and the cage comes up out of the water with the Islander's weathervane in it.
    b.fig('bell', 0, [[0, 1], [2, 1], [4, 1], [7, 3]], K, 1, 0.14, { ratio: 3.5 });
    b.fig('p1', 8, ISLE, K, 1, 0.28, mx, 0.92);
    // Then the wind sets the arms swinging again.
    c.mem.cranes = [1 + r.int(3), r.int(4), r.int(4), 1 + r.int(3)];
  } else {
    // Holm off the Gantry Shore while the cranes stand idle.
    wave(b, r.pick([0, 0.5]), 5.5, 0.09, spb);
    wave(b, 8 + r.pick([0, 0.5]), 5.5, 0.09, spb);
    farHolm(b, 0, K, STATION.gantry, 0.15);
  }
  return b.out();
}

const gantry: TrackDef = {
  bpm: 100, start: 'turn', vary: 0.4, wrong: 0.05, swing: 0.08, stumble: 0.03, slip: 0.1, bendy: 0.12, echo: 0.3, wobble: 4,
  next: (cur, c) => {
    if (cur === 'turn' && c.mem.cranes && c.mem.cranes.every((x) => x === 0)) return 'cage';
    if (cur !== 'turn') return 'turn';
    return c.r.chance(0.2) ? 'far' : 'turn';
  },
  secs: { turn: (c) => gantrySec(c, 'turn'), far: (c) => gantrySec(c, 'far'), cage: (c) => gantrySec(c, 'cage') },
};

function floeSec(c: Ctx, kind: 'cross' | 'ice' | 'thaw'): Section {
  const K = B_AEO, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  if (kind === 'cross') {
    // A step onto a floe: the tune moves once and stands still, and the floe carries it, so the chords drift under it the way the step went until it bumps.
    // Each crossing starts where the last floe stopped, because a floe stays put as a stepping stone.
    let t = 0, m = c.st.floeM ?? 2, R = c.st.floe ?? 0;
    while (t < 16 - 1e-6) {
      const dir = m >= 6 ? -1 : m <= -1 ? 1 : r.chance(0.5) ? 1 : -1;
      m += dir * r.pick([1, 1, 2]);
      const n = 1 + r.int(3);
      b.n('p1', t, K(m) + 12, n * 2 - 0.1, 0.25, { ...MEL, duty: 1, a: 0.02 });
      for (let j = 0; j < n; j++) {
        R += dir;
        b.n('tri', t + j * 2, fold(K(R), 35), 1.9, 0.36, { a: 0.15 });
        b.n('p2', t + j * 2 + 0.5, voiced(K, R, 55)[r.pick([1, 2])], 1.4, 0.06, { duty: 1, a: 0.1 });
      }
      b.hit(t + n * 2 - 0.5, 'tock', 0.09, 0.04);
      t += n * 2;
    }
    c.st.floe = ((R % 7) + 7) % 7;
    c.st.floeM = m;
  } else if (kind === 'ice') {
    // Ice at the edge of the Lipwater: cracks on the bell, wind, and Holm off the Floes.
    b.n('tri', 0, fold(K(0), 35), 7.8, 0.32, { a: 0.6 }).n('tri', 8, fold(K(r.pick([5, 3, 0])), 35), 7.8, 0.3, { a: 0.6 });
    b.hit(r.int(2), 'rush', 0.06, 9, { a: 5 * spb });
    farHolm(b, 0, K, STATION.floes, 0.14);
    const n = 2 + r.int(3);
    for (let i = 0; i < n; i++) b.n('bell', 1 + r.int(28) * 0.5, K(7 + r.int(5)) + 12, 0.5, r.range(0.07, 0.11), { ratio: 1.41, bend: -1 });
  } else {
    // Off the map every floe drifts back to where it started: the chords walk home a step at a time.
    let R = c.st.floe ?? 0;
    const dir = R > 3 ? 1 : -1;
    for (let t = 0; t < 16; t += 2) {
      if (((R % 7) + 7) % 7 !== 0) R += dir;
      b.n('tri', t, fold(K(R), 35), 1.9, 0.34, { a: 0.2 });
      b.n('p2', t + 0.5, voiced(K, R, 55)[1], 1.3, 0.05, { duty: 1, a: 0.2 });
    }
    c.st.floe = 0;
    c.st.floeM = 2;
    b.fig('bell', 1, phrase(r, 14, 4, 0, { cells: SLOW }), K, 1, 0.12, { ratio: 3.5, ...MEL });
  }
  return b.out();
}

const floes: TrackDef = {
  bpm: 66, start: 'cross', vary: 0.4, wrong: 0.05, slip: 0.08, bendy: 0.2, echo: 0.55, wobble: 9,
  graph: { cross: [['cross', 2], ['ice', 2], ['thaw', 1]], ice: [['cross', 3]], thaw: [['cross', 2], ['ice', 1]] },
  secs: { cross: (c) => floeSec(c, 'cross'), ice: (c) => floeSec(c, 'ice'), thaw: (c) => floeSec(c, 'thaw') },
};

function shingleSec(c: Ctx, kind: 'drag' | 'cut' | 'far'): Section {
  const K = FS_AEO, r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  const roots = prog(r, kind === 'cut' ? [0, 5, 6, 4] : [0, 6, 5, 6], { 0: [0, 3], 5: [5, 3], 6: [6, 4], 4: [4, 1] }, 0.3);
  roots.forEach((R, i) => { const p = fold(K(R), 38); b.n('tri', i * 4, p, 1.9, 0.4).n('tri', i * 4 + 2, p + K(R + 4) - K(R), 1.8, 0.34); });
  // A wave runs up the stones every two bars, and the stones rattle as it draws back, slower and quieter.
  for (const w of [0, 8]) {
    const at = w + r.pick([0, 0.5]), len = 3 + r.int(2) * 0.5;
    wave(b, at, len, 0.12, spb);
    for (let t = at + len + 0.05, gap = 0.12, g = 0.08; t < w + 7.9; t += gap, gap *= 1.22, g *= 0.9) b.hit(t, 'tick', g, 0.03);
  }
  const mx = { ...MEL, duty: 0 };
  if (kind === 'drag') {
    // The haul: a stone follows into the place Ouro just left. The thin pulse plays a line, and the stone, an octave down, plays the note before.
    let t = 0, prev: number | null = null;
    for (const [d, l] of [...phrase(r, 8, 4, 2, { cells: MARCH }), ...phrase(r, 8, 3, 0, { cells: MARCH })]) {
      if (d !== null) {
        b.n('p1', t, K(d) + 12, l * 0.9, 0.26, mx);
        if (prev !== null) b.n('p2', t, K(prev), l * 0.85, 0.12, { duty: 2 });
        prev = d;
      }
      t += l;
    }
  } else if (kind === 'cut') {
    // Three stones come out of the cut backward: each short line is followed by itself reversed, and a low bell marks the stone coming free.
    for (let s = 0; s < 3; s++) {
      const f = phrase(r, 2, r.pick([4, 2, 5]), r.pick([0, 1, 3]), { cells: FAST });
      const t = b.fig('p1', s * 5, f, K, 1, 0.26, mx, 0.85);
      b.fig('p1', t, retro(f), K, 1, 0.22, mx, 0.85);
      b.n('bell', t + 2, fold(K(0), 42), 1.5, 0.1, { ratio: 1.41 });
    }
    roots.forEach((R, i) => b.n('p2', i * 4 + 0.5, voiced(K, R, 57, 4)[r.pick([1, 3])], 3, 0.05, { duty: 1, a: 0.2 }));
  } else {
    // Holm off the Shingle.
    farHolm(b, 0, K, STATION.shingle, 0.15);
    b.n('p2', 4, K(r.pick([4, 2])) + 12, 8, 0.05, { duty: 1, a: 0.8 });
  }
  return b.out();
}

const shingle: TrackDef = {
  bpm: 80, start: 'drag', vary: 0.45, wrong: 0.05, slip: 0.1, bendy: 0.15, echo: 0.4, wobble: 6, spread: 12,
  graph: { drag: [['cut', 2], ['far', 1], ['drag', 1]], cut: [['drag', 2], ['far', 1]], far: [['drag', 2], ['cut', 1]] },
  secs: { drag: (c) => shingleSec(c, 'drag'), cut: (c) => shingleSec(c, 'cut'), far: (c) => shingleSec(c, 'far') },
};

/** The coast road home lowers one note a stretch: Fall's D lydian, then D ionian, then Turnstone's D mixolydian. */
const HOMEWARD = [MODE.lyd, MODE.ion, MODE.mix];
const HOMEWARD_ROOTS = [[0, 1, 0, 4], [0, 3, 1, 4], [0, 6, 3, 0]];

function longSec(c: Ctx, kind: 'road' | 'ford' | 'gate'): Section {
  const home = Math.min(2, c.st.home ?? 0);
  const K = key(50, kind === 'gate' ? MODE.mix : HOMEWARD[home]), r = c.r, b = new B(16, 4, c.bpm), spb = 60 / c.bpm;
  const mx = { ...MEL, duty: 1 };
  if (kind === 'road') {
    const roots = prog(r, HOMEWARD_ROOTS[home], { 0: [0, 5], 3: [3, 1], 1: [1, 5], 6: [6, 4] }, 0.25);
    bassLine(b, K, roots, 4, 38, 'walk', 0.42, r);
    for (let t = 0; t < 16; t += 0.5) b.hit(t, 'hat', t % 1 ? 0.035 : t % 2 ? 0.065 : 0.045, 0.05);
    roots.forEach((R, i) => comp(b, K, i * 4, 4, R, roots[(i + 1) % 4], 60, 0.1, r));
    // Ouro's figure comes down the coast a step each bar: the Midden Road's climb, walked home the other way.
    let t = 0;
    for (const s of [3, 2, 1]) t = b.fig('p1', t, lack(shift(OURO, s)), K, 1, 0.3, mx, 0.85);
    b.fig('p1', t, phrase(r, 4, 3, 0), K, 1, 0.3, mx, 0.85);
  } else if (kind === 'ford') {
    // The brook mouth where the bridge washed out: waves, haul stones dropped into the ford, and Holm offshore heading west.
    b.n('tri', 0, 38, 7.8, 0.34, { a: 0.3 }).n('tri', 8, fold(K(r.pick([4, 3, 6])), 38), 7.8, 0.32, { a: 0.3 });
    for (const w of [0, 8]) { wave(b, w + r.pick([0, 0.5]), 5, 0.1, spb); b.hit(w + 6.5, 'stamp', 0.16, 0.2); }
    farHolm(b, 0, K, STATION.longway, 0.15);
    b.n('p2', 1, K(r.pick([4, 2])) + 12, 7, 0.05, { duty: 1, a: 0.6 });
    sing(b, r, 'p1', 9, phrase(r, 6, 4, 0, { cells: SLOW }), K, 1, 0.2, 0.3, mx, 0.9);
  } else {
    // Turnstone's field gate with the bar on this side: Turnstone's tune and its whorl a bar behind, then Gran's answer on the triangle.
    bassLine(b, K, prog(r, [0, 6], { 0: [0, 5], 6: [6, 4] }, 0.3), 4, 38, 'walk', 0.4, r);
    heart(b, 0, 8, 0.1);
    const mel: Fig = [...lack(OURO), ...phrase(r, 4, 4, 1, { lo: -1, hi: 8 })];
    b.fig('p1', 0, mel, K, 1, 0.28, mx, 0.9);
    b.fig('p2', 4, mel.map(([d, l], j): readonly [number | null, number] => [d !== null && j > 0 && r.chance(0.15) ? null : d, l]), K, 1, 0.13, { duty: 0, det: -14 }, 0.7);
    b.fig('tri', 9, GRAN, K, 0, 0.5, { a: 0.02 }, r.pick([0.92, 0.8, 0.97]));
  }
  return b.out();
}

const longway: TrackDef = {
  bpm: 100, start: 'road', vary: 0.55, wrong: 0.05, swing: 0.15, stumble: 0.05, slip: 0.12, bendy: 0.18, echo: 0.3, wobble: 6, spread: 8,
  // Each stretch of road lowers the mode a note. After Turnstone's mode the road reaches the gate, and the next walk starts from Fall again.
  next: (cur, c) => {
    if (cur === 'gate') { c.st.home = 0; return 'road'; }
    if (cur === 'ford') return 'road';
    const h = c.st.home ?? 0;
    if (c.r.chance(0.5)) {
      if (h >= 2) return 'gate';
      c.st.home = h + 1;
    }
    return c.r.chance(0.3) ? 'ford' : 'road';
  },
  secs: { road: (c) => longSec(c, 'road'), ford: (c) => longSec(c, 'ford'), gate: (c) => longSec(c, 'gate') },
};

// ---------------------------------------------------------------- Holm: the island that walked off with a house on its back

const C_DOR = key(48, MODE.dor);

function holmSec(c: Ctx, kind: 'lap' | 'carry' | 'round' | 'wake'): Section {
  const K = C_DOR, r = c.r, b = new B(32, 4, c.bpm);
  // Each section is one lap of the Lipwater, from the place after the cove back to the cove.
  // Holm settles harder each lap, so its bass holds the last place longer before it moves to the next.
  const laps = (c.st.laps = (c.st.laps ?? 0) + 1), lag = Math.min(1.5, 0.5 * (laps - 1));
  for (let i = 0; i < 8; i++) {
    const R = LAP[(i + 1) % 8], t0 = i * 4, p = fold(K(R), 36), q = fold(K(LAP[i]), 36), next = fold(K(LAP[(i + 2) % 8]), 36);
    const hold = i > 0 ? lag : 0;
    if (hold > 0) b.n('tri', t0, q, hold - 0.04, 0.5);
    b.n('tri', t0 + hold, p, Math.max(0.4, 1.45 - hold), 0.55);
    const rest = [[1.5, p + 12, 0.4, 0.42], [2, p + K(R + 4) - K(R), 0.9, 0.46], [3, p, 0.45, 0.44], [3.5, next + r.pick([1, -1]), 0.45, 0.4]];
    for (const [o, n, d, g] of rest) if (o > hold + 0.01) b.n('tri', t0 + o, n, d, g);
    if (!(kind === 'round' && i === 7)) {
      b.hit(t0, 'kick', 0.42, 0.2).hit(t0 + 2, 'snare', 0.24, 0.15).hit(t0 + 2.5, 'kick', 0.26, 0.2, { lay: 0.3 });
      b.hit(t0 + 1, 'snare', 0.12, 0.12, { lay: 0.7 }).hit(t0 + 3, 'snare', 0.16, 0.12, { lay: 0.7 });
      for (const o of [0.5, 1.5, 3.5]) b.hit(t0 + o, 'hat', 0.05, 0.05, { lay: 0.35 });
    }
    if (kind !== 'wake') {
      const ch = voiced(K, R, 58, 4);
      b.n('p2', t0 + 1, ch[r.pick([1, 2])], 0.4, 0.12, { duty: 2, top: 0.6 }).n('p2', t0 + 3, ch[r.pick([2, 3])], 0.4, 0.11, { duty: 2, top: 0.6 });
      arp(b, 'p2', t0, 4, ch, [0, 1, 2, 3, 2, 1, 0, 1], 0.5, 0.1, { duty: 1, lay: 0.6 });
    }
  }
  const mx = { ...MEL, duty: 3 };
  if (kind === 'lap') {
    b.fig('p1', 0, phrase(r, 8, 4, 2, { cells: MARCH, hi: 9 }), K, 1, 0.3, mx, 0.88);
    // Holm's lap itself, in quarters, from wherever Holm has got to.
    b.fig('p1', 8, lapFig(laps, 8, 1), K, 1, 0.3, mx, 0.9);
    b.fig('p1', 16, phrase(r, 8, 5, 1, { cells: MARCH, hi: 9 }), K, 1, 0.3, mx, 0.88);
    b.fig('p1', 24, phrase(r, 8, 3, 0, { cells: MARCH, hi: 9 }), K, 1, 0.3, mx, 0.88);
  } else if (kind === 'carry') {
    // The house rides on Holm's back: the tune is the bass two octaves and a third up, and it moves when the bass moves.
    for (let i = 0; i < 8; i++) {
      const R = LAP[(i + 1) % 8], t0 = i * 4, h = i > 0 ? lag : 0;
      b.n('p1', t0 + h, K(R + 9), Math.max(0.4, 1.9 - h), 0.3, mx);
      b.n('p1', t0 + 2, K(R + 11), 0.9, 0.28, mx);
      b.n('p1', t0 + 3, K(R + 9), 0.45, 0.26, mx).n('p1', t0 + 3.5, K(R + 8), 0.45, 0.24, mx);
      // Something falls off its back every bar: a high bell note that drops away.
      b.n('bell', t0 + 3.5, K(R + 14), 0.5, 0.09, { ratio: 3.5, bend: -r.pick([2, 3, 5]) });
    }
  } else if (kind === 'round') {
    // Round the Lip: the lap in eighths, once a bar, each bar from the next place on. Then the crest hits once for each lap so far, up to five.
    for (let i = 0; i < 7; i++) b.fig('p1', i * 4, lapFig(laps + i, 8, 0.5), K, 1, 0.3, { ...MEL, duty: 1 }, 0.8);
    for (let h = 0; h < Math.min(5, laps); h++) b.hit(28 + h * 0.75, 'kick', 0.42, 0.2).n('bell', 28 + h * 0.75, K(r.pick([0, 4])) + 24, 0.5, 0.12, { ratio: 1.41 });
    b.n('p1', 28, K(0) + 12, 3.5, 0.28, { ...MEL, duty: 1 });
  } else {
    // The long wake: the tune leaves a wake, the same line half a beat behind and a third below, and the lap slows as it goes.
    const mel = [...phrase(r, 16, 4, 1, { cells: MARCH, hi: 9 }), ...phrase(r, 16, 3, 0, { cells: MARCH, hi: 9 })];
    b.fig('p1', 0, mel, K, 1, 0.3, mx, 0.85);
    b.fig('p2', 0.5, shift(mel, -2), K, 1, 0.12, { duty: 0 }, 0.75);
  }
  if (kind !== 'round') {
    // When the fight is close the Islander's line comes in over the last two bars, as the lap comes home, and the tune makes way for it.
    for (const e of b.ev) if (e.v === 'p1' && e.t >= 24 - 1e-6) e.top = 0.6;
    b.fig('air', 24, ISLE, K, 1, 0.3, { lay: 0.6, a: 0.05 }, 0.92);
  }
  if (kind !== 'carry') bellCopy(b, 0.45, 0.08, true);
  const sec = b.out();
  return kind === 'wake' ? lean(sec, 1, 0.8) : sec;
}

const holm: TrackDef = {
  bpm: 116, start: 'lap', vary: 0.45, wrong: 0.04, slip: 0.1, bendy: 0.2, echo: 0.25, wobble: 6, spread: 8,
  graph: {
    lap: [['carry', 2], ['round', 1], ['wake', 1]], carry: [['lap', 2], ['round', 2]],
    round: [['lap', 2], ['wake', 1], ['carry', 1]], wake: [['lap', 3], ['carry', 1]],
  },
  secs: { lap: (c) => holmSec(c, 'lap'), carry: (c) => holmSec(c, 'carry'), round: (c) => holmSec(c, 'round'), wake: (c) => holmSec(c, 'wake') },
};

// ---------------------------------------------------------------- the gem puzzle: arms on one shared clock, and the crystal cave it opens

const F_LYD = key(53, MODE.lyd);
/** A gem machine's instructions. Each arm's tape loops, and every arm steps on the same clock. */
const GRAB = 0, DROP = 1, LEFT = 2, RIGHT = 3, OUT = 4, IN = 5;
/** The first machine's tape: grab, turn, reach out, drop, pull in, turn back. The crystal cave plays it in the rock. */
export const GEM_TAPE: readonly number[] = [GRAB, RIGHT, OUT, DROP, IN, LEFT];
const GEM_CHORDS = [0, 1, 0, 4, 5, 1, 6, 4];

function gemTape(r: Rng, n: number): number[] {
  const t = [GRAB];
  for (let i = 1; i < n; i++) t.push(r.pick([LEFT, RIGHT, OUT, IN, DROP, LEFT, RIGHT]));
  if (!t.includes(DROP)) t[n - 1] = DROP;
  return t;
}

function gemSec(c: Ctx, kind: 'run' | 'think' | 'edit'): Section {
  const K = F_LYD, r = c.r, b = new B(16, 4, c.bpm), m = c.mem;
  if (!m.tapeA) { m.tapeA = [...GEM_TAPE]; m.tapeB = gemTape(r, 5); m.tapeC = gemTape(r, 7); m.arm = [0, 0, 0, 0, 0, 0, 0, 0, 0]; }
  if (kind === 'edit') {
    // The player changes one step of one tape, and now and then adds or takes away a step.
    const tp = r.pick([m.tapeA, m.tapeB, m.tapeC]);
    if (tp.length < 12 && r.chance(0.25)) tp.push(r.pick([LEFT, RIGHT, OUT, IN, DROP]));
    else if (tp.length > 4 && r.chance(0.2)) tp.pop();
    else tp[1 + r.int(tp.length - 1)] = r.pick([LEFT, RIGHT, OUT, IN, DROP]);
  }
  const ch0 = c.st.ch ?? 0, clk = c.st.clk ?? 0;
  c.st.ch = (ch0 + 2) % GEM_CHORDS.length;
  c.st.clk = clk + 32;
  // One arm while thinking, two while the machine runs, three once a tape has been edited.
  const arms = kind === 'edit' ? 3 : kind === 'run' ? 2 : 1, tapes = [m.tapeA, m.tapeB, m.tapeC], st = m.arm;
  for (let s = 0; s < 32; s++) {
    const t = s * 0.5, R = GEM_CHORDS[(ch0 + (s >= 16 ? 1 : 0)) % GEM_CHORDS.length];
    let bonds = 0;
    for (let a = 0; a < 3; a++) {
      const ins = tapes[a][(clk + s) % tapes[a].length], o = a * 3;
      if (ins === LEFT) st[o] = (st[o] + 3) % 4;
      else if (ins === RIGHT) st[o] = (st[o] + 1) % 4;
      else if (ins === OUT) st[o + 1] = 1;
      else if (ins === IN) st[o + 1] = 0;
      else if (ins === GRAB) st[o + 2] = 1;
      else if (ins === DROP) { if (st[o + 2] && a < arms) bonds++; st[o + 2] = 0; }
      if (a >= arms) continue;
      const ang = st[o], out = st[o + 1];
      if (a === 0) b.n('p2', t, voiced(K, R, 60, 4)[ang] + 12 * out, 0.3, (st[o + 2] ? 0.08 : 0.055) * (kind === 'think' ? 0.7 : 1), { duty: 0 });
      else if (a === 1 && (ins === GRAB || ins === DROP)) b.n('bell', t, voiced(K, R, 65)[ang % 3] + 12 * out, 0.4, 0.07, { ratio: 2 });
      else if (a === 2 && s % 2 === 0) b.n('tri', t, fold(K(R), 41) + [0, 7, 12, 7][ang], 0.9, 0.36);
    }
    // Two arms setting stones down together bond them: a fifth rings on the bell, and every fourth bond finishes a piece.
    if (bonds >= 2) {
      b.n('bell', t, voiced(K, R, 65)[2] + 12, 1.5, 0.1, { ratio: 2 });
      const del = (c.st.del = (c.st.del ?? 0) + 1);
      if (del % 4 === 0 && t < 14) b.fig('p1', t + 0.5, [[4, 0.5], [7, 0.5], [9, 1]], K, 1, 0.18, { duty: 1 });
    }
    if (arms < 3 && s % 4 === 0) b.n('tri', t, fold(K(R), 41), 1.9, 0.32);
    if (s % 2 === 0) b.hit(t, 'tick', s % 8 === 0 ? 0.05 : 0.03, 0.03);
    else if ((clk + s) % tapes[0].length === 0) b.hit(t, 'tock', 0.05, 0.04);
  }
  if (kind === 'think') {
    // Thinking: one arm runs quietly while a slow line wanders over it.
    sing(b, r, 'p1', 0, [...phrase(r, 8, 4, 2, { cells: SLOW }), ...phrase(r, 8, 2, 0, { cells: SLOW })], K, 1, 0.2, 0.2, { ...MEL, duty: 1 }, 0.92);
    b.n('air', 2 + r.int(4), K(r.pick([0, 4, 1])) + 12, 6, 0.1, { a: 1 });
  }
  return b.out();
}

const gempuzzle: TrackDef = {
  bpm: 92, start: 'run', vary: 0.3, wrong: 0.03, slip: 0.04, bendy: 0.1, echo: 0.35, wobble: 4, spread: 6,
  graph: { run: [['run', 2], ['think', 2], ['edit', 1]], think: [['run', 2], ['edit', 1]], edit: [['run', 2], ['think', 1], ['edit', 1]] },
  secs: { run: (c) => gemSec(c, 'run'), think: (c) => gemSec(c, 'think'), edit: (c) => gemSec(c, 'edit') },
};

const GS_AEO = key(56, MODE.aeo);

function geodeSec(c: Ctx, kind: 'facet' | 'vein' | 'hollow'): Section {
  const K = GS_AEO, r = c.r, b = new B(16, 4, c.bpm);
  // The cave's own note, low and held under everything.
  b.n('tri', 0, 44, 16, 0.32, { a: 0.8, pin: 1 });
  if (kind === 'facet') {
    // The crystal is a chord of stacked fourths, struck a note at a time. Each time the stone turns to its next face, so the strikes start a note on.
    const face = (c.st.face = ((c.st.face ?? -1) + 1) % 5), stack = [0, 3, 6, 9, 12].map((d) => K(d) + 12);
    for (let i = 0; i < 8; i++) {
      b.n('bell', i * 2, stack[(face + i) % 5], 2.9, 0.12, { ratio: 2, ...MEL });
      b.n('p2', i * 2 + 0.25, stack[(face + i + 1) % 5] - 12, 1.4, 0.035, { duty: 0, a: 0.2 });
    }
    b.n('air', 4 + r.int(4), K(r.pick([0, 4, 3])), 6, 0.1, { a: 1.5 });
  } else if (kind === 'vein') {
    // Deep in the rock the first gem machine's tape runs on, slowly, a step a beat.
    const ch = [0, 3, 6, 9].map((d) => K(d) + 12);
    let ang = c.st.vang ?? 0, out = 0;
    for (let s = 0; s < 16; s++) {
      const ins = GEM_TAPE[s % GEM_TAPE.length];
      if (ins === LEFT) ang = (ang + 3) % 4;
      else if (ins === RIGHT) ang = (ang + 1) % 4;
      else if (ins === OUT) out = 1;
      else if (ins === IN) out = 0;
      b.n('p2', s, ch[ang] + 12 * out, 0.6, ins === DROP ? 0.07 : 0.045, { duty: 0 });
      if (ins === DROP) b.n('bell', s, ch[ang] + 12, 2, 0.08, { ratio: 2, ...MEL });
    }
    c.st.vang = (ang + 1) % 4;
    b.n('air', r.int(4), K(r.pick([0, 3])), 8, 0.1, { a: 2 });
  } else {
    // The hollow inside the geode: light catches a crystal, a reversed bell swells into its own strike, and points of light glint.
    const t = 3 + r.int(6) * 0.5, p = K(r.pick([0, 3, 4])) + 24;
    b.n('bell', t - 2, p, 1.95, 0.12, { ratio: 2, rev: 1 }).n('bell', t, p, 5, 0.14, { ratio: 2, ...MEL });
    const n = 3 + r.int(4);
    for (let i = 0; i < n; i++) b.hit(r.int(30) * 0.5, 'tick', r.range(0.03, 0.06), 0.03);
    b.n('air', 8 + r.int(3), K(r.pick([0, 4, 6])), 6, 0.11, { a: 1.5, bend: r.pick([0, -0.5]) });
    const m = 2 + r.int(3);
    for (let i = 0; i < m; i++) b.n('p2', 9 + r.int(12) * 0.5, K(7 + r.int(6)) + 12, 0.15, 0.04, { duty: 0 });
  }
  return b.out();
}

const geode: TrackDef = {
  bpm: 56, start: 'facet', vary: 0.4, wrong: 0.05, slip: 0.06, bendy: 0.2, echo: 0.7, wobble: 6,
  graph: { facet: [['vein', 2], ['hollow', 1], ['facet', 1]], vein: [['facet', 2], ['hollow', 1]], hollow: [['facet', 2], ['vein', 1]] },
  secs: { facet: (c) => geodeSec(c, 'facet'), vein: (c) => geodeSec(c, 'vein'), hollow: (c) => geodeSec(c, 'hollow') },
};

export const TRACKS: Record<TrackId, TrackDef> = {
  splash, title, home, fellside, route, town, gym, minigame,
  battle, wild, keeper, rival, legend, battleHand, battleCinch, battlePeel,
  drysea, marsh, spire, wood, machine, hum, bare, tundra, tusk, tallow, hiltroad,
  peel: peelHouse, moonwater, crater, fall, climb, crown, slack, oldrind, stack, credits, cave,
  strand, sanddollar, cowrie, auger, nautilus, tray, conch, collector, cinchReal, wildStrand, keeperStrand, starfall, credits2,
  cove, brook, highwater, saltings, shout, kelp, gantry, floes, shingle, longway, gatering, holm, gempuzzle, geode,
};
