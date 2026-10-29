// The score framework: section types, a seeded generator, keys and figures, and automatic variation.
// Pitches are MIDI numbers (57 is A3, 220 Hz). Times and lengths are in quarter-note beats.
// Ported from the user's ElipsusVenum engine and extended for Gnomon's pre-notes, layers, and regions.

/**
 * The band. `lead` is the warm played lead, `cold` the narrow one, and `sq` a flat square with no drift.
 * `shade` plays the pre-notes the engine writes before every lead note. `bell` and `glass` are FM bells, `rev` swells
 * up and stops like a bell played backward, `pluck` is a dusty plucked string, `drone` is additive, `pad` and `brass`
 * are detuned saw sections, and `choir` sings through formants.
 */
export type Voice =
  | 'lead' | 'cold' | 'sq' | 'shade' | 'bell' | 'glass' | 'rev' | 'arp' | 'pluck' | 'blip'
  | 'bass' | 'sub' | 'drone' | 'pad' | 'brass' | 'choir' | 'nz';
export type Nz =
  | 'kick' | 'snare' | 'taiko' | 'tick' | 'hiss' | 'swell' | 'glitch' | 'scan' | 'boom'
  | 'hat' | 'shaker' | 'clap' | 'wood' | 'clank' | 'crash' | 'roll' | 'hum' | 'click';
/** Layer flags. A note with `when` sounds only while its flag holds, and the layer opens or closes within a beat. */
export type Flag = 'lamp' | 'dark' | 'low';
/** Where a battle takes its color from. */
export type Region = 'long' | 'market' | 'face' | 'glass' | 'overhead' | 'back' | 'lamp';
export const REGIONS: readonly Region[] = ['long', 'market', 'face', 'glass', 'overhead', 'back', 'lamp'];

/** The voices that carry a melody and so cast pre-notes. */
export const LEAD_VOICES: ReadonlySet<Voice> = new Set<Voice>(['lead', 'cold', 'sq']);

export interface Ev {
  t: number;
  d: number;
  v: Voice;
  n: number;
  g: number;
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
  /** FM ratio for a bell. */
  ratio?: number;
  /** Filter cutoff in Hz, for voices that have one. */
  cut?: number;
  /** Choir vowel from oo (0) to ah (1). */
  ah?: number;
  /** Stereo position from -1 to 1. */
  pan?: number;
  /** Melodic: open to automatic ornaments and displacement. */
  m?: 1;
  /** Sounds only while this flag holds. */
  when?: Flag;
  /** A strange color note. The engine drops it while a lot changes at once. */
  odd?: 1;
  /** Chromatic on purpose, so the key check skips it. */
  x?: 1;
  /** A lead note that casts no pre-note. */
  nos?: 1;
  /** A pre-note. Only the engine writes these. */
  sh?: 1;
  /** The voice a pre-note copies. */
  src?: Voice;
  /** A painted pre-note: unfiltered, with a hard edge. */
  hard?: 1;
}

export interface Section {
  beats: number;
  bar: number;
  bpm: number;
  ev: Ev[];
  /** Skip automatic variation and wrong events. */
  still?: boolean;
  tag?: string;
  /** The section's key, for the low-HP mode shift and the key check. Defaults to the track's key. */
  key?: Key;
  /** Pre-note distance in beats for this section. Negative values put the copy after the note. */
  shadow?: number;
  /** Chance that a pre-note is painted: a neighbor pitch with a hard edge. */
  paint?: number;
  /** A lantern turns the leads: copies fall after their notes in the dark and before them under a lamp. */
  turn?: boolean;
  /** Marks the last section of a track that ends, so the game can wait for it. */
  end?: boolean;
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
  /** The region a battle takes its color from. */
  region: Region;
  /** Boss phase, stepped by battleEvent('boss_phase'). */
  phase: number;
  /** Story chapter, if the game reports it, else 1. */
  chapter: number;
  lamp: boolean;
  low: boolean;
  /** The key of the track the victory sting melts back into. */
  ret: Key | null;
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
  /** Send to the dotted-eighth echo. */
  echo?: number;
  /** Send to the long room. */
  verb?: number;
  /** Depth of the shared tape drift in cents. */
  wobble?: number;
  /** Output gain of the whole track. */
  level?: number;
  /** The home key. */
  key: Key;
  /** Pre-note distance in beats. 0 means the track casts none. */
  shadow: number;
  /** Pre-note distance while a lamp is lit, for tracks where no sun reaches. */
  litShadow?: number;
  /** Place tracks set the region that later battles take their color from. */
  region?: Region;
  /** place, scene, battle, sting, or ending. Battles reset the battle state when they start. */
  kind: 'place' | 'scene' | 'battle' | 'sting' | 'end';
  /** Seconds to melt into this track. */
  melt?: number;
  /** Overhead: no bass at all. */
  noBass?: boolean;
  /** The Back: only bass and percussion until a lamp is lit. */
  bassOnly?: boolean;
  /** The mode low HP shifts to. Defaults to two steps darker. */
  low?: readonly number[];
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

/** The mode two steps darker on the circle of modes, used when low HP shifts the music. Aeolian stops at Phrygian. */
export function darker(mode: readonly number[]): readonly number[] {
  const same = (m: readonly number[]) => m.length === mode.length && m.every((x, i) => x === mode[i]);
  if (same(MODE.lyd)) return MODE.mix;
  if (same(MODE.ion)) return MODE.dor;
  if (same(MODE.mix)) return MODE.aeo;
  if (same(MODE.dor)) return MODE.phr;
  if (same(MODE.aeo)) return MODE.phr;
  if (same(MODE.hmin)) return MODE.phr;
  return mode;
}

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

/** True when pitch `n` belongs to the key's scale. */
export function inKey(K: { root: number; mode: readonly number[] }, n: number): boolean {
  const pc = (((n - K.root) % 12) + 12) % 12;
  return K.mode.includes(pc);
}

/**
 * A figure: [scale degree or null for a rest, length in beats, optional semitone alteration, optional bend in scale
 * steps]. A bend glides across the second half of the note to the degree that many steps away.
 */
export type Fig = ReadonlyArray<readonly [number | null, number, number?, number?]>;
/** Pitch or rest, length, and an optional bend in semitones. */
export type Line = Array<[number | null, number, number?]>;

export function realize(fig: Fig, K: Key, oct = 0): Line {
  return fig.map(([d, len, acc, bend]) => {
    if (d === null) return [null, len];
    const p = K(d) + 12 * oct + (acc ?? 0);
    if (!bend) return [p, len];
    return [p, len, K(d + bend) + 12 * oct + (acc ?? 0) - p];
  });
}
export const inv = (f: Fig, axis = 0): Fig => f.map(([d, l, a, b]) => [d === null ? null : 2 * axis - d, l, a === undefined ? undefined : -a, b === undefined ? undefined : -b]);
export const retro = (f: Fig): Fig => [...f].reverse();
export const aug = (f: Fig, k: number): Fig => f.map(([d, l, a, b]) => [d, l * k, a, b]);
export const shift = (f: Fig, k: number): Fig => f.map(([d, l, a, b]) => [d === null ? null : d + k, l, a, b]);
export const figLen = (f: Fig): number => f.reduce((s, x) => s + x[1], 0);
export const notesOf = (f: Fig): Fig => f.filter((x) => x[0] !== null);
/** Drops the note at index `i`, leaving its time as a rest. */
export const drop = (f: Fig, i: number): Fig => f.map((x, k) => (k === i ? [null, x[1]] as const : x));

export class B {
  ev: Ev[] = [];
  beats: number;
  bar: number;
  bpm: number;
  constructor(beats: number, bar = 4, bpm = 90) {
    this.beats = beats;
    this.bar = bar;
    this.bpm = bpm;
  }
  n(v: Voice, t: number, n: number, d: number, g = 0.7, x?: Partial<Ev>): this {
    if (t >= -1e-6 && t < this.beats - 1e-6 && d > 0 && g > 0 && Number.isFinite(n)) this.ev.push({ t, d, v, n, g, ...x });
    return this;
  }
  /** Plays [pitch or null, beats, bend] entries from t and returns the end time. */
  line(v: Voice, t: number, notes: ReadonlyArray<readonly [number | null, number, number?]>, g = 0.7, x?: Partial<Ev>, leg = 0.92): number {
    for (const [p, len, bend] of notes) {
      if (p !== null) this.n(v, t, p, len * leg, g, bend ? { ...x, bend } : x);
      t += len;
    }
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

const SHORT_ACC: ReadonlySet<Voice> = new Set<Voice>(['arp', 'bell', 'glass', 'blip', 'pluck']);

/** Automatic variation: ornaments, octave displacement, dropped notes, and rhythmic displacement. */
export function vary(sec: Section, r: Rng, amt: number): Section {
  if (amt <= 0 || sec.still) return sec;
  const out: Ev[] = [];
  let first = true;
  for (const e of sec.ev) {
    if (!e.m) {
      // Accompaniment varies in ways that cannot break the harmony. Held harmony and the low end never change.
      if (e.v === 'nz') { if ((e.nz === 'tick' || e.nz === 'hat') && r.chance(0.07 * amt)) continue; out.push(e); continue; }
      if (!SHORT_ACC.has(e.v) || e.d >= 1.5) { out.push(e); continue; }
      if (r.chance(0.05 * amt)) continue;
      const x: Ev = { ...e };
      if (r.chance(0.05 * amt)) x.n += x.n < 70 ? 12 : -12;
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
      out.push({ ...x, t: x.t - 0.125, d: 0.12, g: x.g * 0.7, n: x.n + r.pick([1, 2, 2, -1]), x: 1, nos: 1, m: undefined });
    } else if (r.chance(0.04 * amt) && x.d >= 1) {
      const up = r.pick([1, 2]);
      out.push({ ...x, d: 0.12, nos: 1 }, { ...x, t: x.t + 0.125, d: 0.12, n: x.n + up, x: 1, nos: 1 });
      x.t += 0.25; x.d -= 0.25;
    }
    out.push(x);
  }
  return { ...sec, ev: out };
}

/** Rare wrong events: a bar in another meter, a sudden tritone, a held bent note, or a hole. */
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
    // A tritone up and a tritone down land on the same pitch class, so high notes go down and stay in range.
    for (const e of ev) if (e.v !== 'nz' && e.v !== 'drone' && e.v !== 'sub' && e.t >= lo && e.t < hi) { e.n += e.n > 78 ? -6 : 6; e.x = 1; }
  } else if (kind === 'bend') {
    let best: Ev | null = null;
    for (const e of ev) if (e.m && (!best || e.d > best.d)) best = e;
    if (best) { best.bend = r.pick([-1, 1, -2, -0.5]); best.d = Math.max(best.d, 1.5); }
  } else {
    ev = ev.filter((e) => !(e.m && e.t >= lo && e.t < hi));
  }
  return { ...sec, ev, beats, tag: kind };
}

/** Folds a pitch into [lo, lo + 12). */
export function fold(n: number, lo: number): number {
  let x = n;
  while (x < lo) x += 12;
  while (x >= lo + 12) x -= 12;
  return x;
}
