// Shared score tools: random numbers, modes, figures, the event builder, automatic variation, and tempo maps.
// Pitches are MIDI numbers and may be fractional (0.5 is a quarter tone). Times and lengths are in quarter-note beats.
import type { AreaTint, TrackId } from '../audio';

export type Voice = 'p1' | 'p2' | 'tri' | 'nz' | 'x';
export type Nz = 'hat' | 'snare' | 'kick' | 'tick' | 'tock' | 'sweep' | 'rush' | 'stamp' | 'gear' | 'steam' | 'clap' | 'tom' | 'crack' | 'rumble' | 'type' | 'drip' | 'hush';
export type MotifName = 'pilgrim' | 'unravel' | 'void' | 'stone' | 'year' | 'choice' | 'seer' | 'lightbound' | 'vorn' | 'keeper';

export interface Ev {
  t: number;
  d: number;
  v: Voice;
  n: number;
  g: number;
  /** Pulse duty slot: 0 is the thinnest, 3 the fullest. The palette decides the exact widths. */
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
  /** FM ratio for the extra voice. */
  ratio?: number;
  /** Extra voice only: hold as a pad instead of ringing out as a bell. */
  sus?: 1;
  /** Melodic: open to automatic ornaments and displacement. */
  m?: 1;
  /** Kept as written: exempt from automatic variation, for motifs whose last note matters. */
  k?: 1;
  /** Extra voice only: ring backwards, swelling up to the strike. Used for memories coming back. */
  rev?: 1;
}

export const KEEP = { k: 1 } as const;

export interface Section {
  beats: number;
  bar: number;
  bpm: number;
  ev: Ev[];
  /** Skip automatic variation and wrong events. */
  still?: boolean;
  tag?: string;
  /** Tempo control points as [beat, bpm]. The tempo glides linearly between them. */
  tempo?: Array<[number, number]>;
  /** Motifs this section plays. */
  motifs?: MotifName[];
}

/** A phrase a past track played, as absolute pitches and beat lengths. */
export interface MemLine { from: TrackId; motif: MotifName; line: Array<[number | null, number]> }

export interface Ctx {
  r: Rng;
  /** Sections generated so far on this track. */
  pass: number;
  /** Times this section has been generated before. */
  visit: number;
  int: number;
  /** Story progress from 0 to 1. */
  prog: number;
  tint: AreaTint;
  bpm: number;
  st: Record<string, number>;
  mem: Record<string, number[]>;
  recall: MemLine[];
}

export type Gen = (c: Ctx) => Section;

export interface TrackDef {
  bpm: number;
  start: string;
  secs: Record<string, Gen>;
  /** Weighted next sections. A section with no entry ends the track. */
  graph?: Record<string, ReadonlyArray<readonly [string, number]>>;
  next?: (cur: string, c: Ctx) => string | null;
  /** Tint when the game passes none. */
  tint: AreaTint;
  /** The track's home key. */
  key: Key;
  /** The key under a tint, for tracks whose key follows the area. */
  keyFor?: (tint: AreaTint) => Key;
  /** Motifs that must be heard within ten minutes. */
  motifs: MotifName[];
  /** Motifs the track leaves in the engine's memory. Defaults to `motifs`. */
  quotes?: MotifName[];
  vary?: number;
  wrong?: number;
  /** Level per voice, multiplied into the engine's base level. */
  mix?: Partial<Record<Voice, number>>;
  echo?: number;
  wobble?: number;
  /** Detune of p2 against p1 in cents. */
  spread?: number;
  /** Every section ends away from the tonic, so the track never reaches a final cadence. */
  neverTonic?: true;
  /** Runs on each section after automatic variation. */
  post?: (sec: Section) => Section;
  /** Output level multiplier, to even out tracks that are sparse by design. */
  level?: number;
  /** How late each off-beat eighth lands, in beats, and how far that lateness wanders from bar to bar. */
  swing?: number;
  stumble?: number;
  /** Chance per section that the key slips a semitone or two for a bar or for the rest of the section. */
  slip?: number;
  /** Chance that a long melodic note bends. */
  bendy?: number;
  /** Wrong events stay in the key: a bar in another meter or a hole, never a tritone shift or a bent note. For fights, where many cues change the music. */
  tame?: true;
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
  acou: [0, 2, 4, 6, 7, 9, 10],
  whole: [0, 2, 4, 6, 8, 10, 12],
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
export const noteCount = (f: Fig): number => f.filter((x) => x[0] !== null).length;
/** Appends a rest so the figure fills a whole number of bars. */
export function padTo(f: Fig, bar: number): Fig {
  const len = figLen(f);
  const full = Math.ceil(len / bar - 1e-6) * bar;
  return full - len > 1e-6 ? [...f, [null, full - len]] : f;
}
/** Drops the last k sounding notes of a figure and turns each into a rest of the same length. */
export function dropLast(f: Fig, k: number): Fig {
  const idx: number[] = [];
  f.forEach((x, i) => { if (x[0] !== null) idx.push(i); });
  const gone = new Set(idx.slice(Math.max(0, idx.length - k)));
  return f.map((x, i) => (gone.has(i) ? [null, x[1]] as const : x));
}
export const MEL = { m: 1 } as const;

export class B {
  ev: Ev[] = [];
  motifs = new Set<MotifName>();
  constructor(public beats: number, public bar = 4, public bpm = 90) {}
  n(v: Voice, t: number, n: number, d: number, g = 0.7, x?: Partial<Ev>): this {
    if (t >= -1e-6 && t < this.beats - 1e-6 && d > 0 && g > 0 && Number.isFinite(n)) this.ev.push({ t, d, v, n, g, ...x });
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
  /** Records that this section plays a motif. */
  mot(...names: MotifName[]): this {
    for (const m of names) this.motifs.add(m);
    return this;
  }
  out(extra?: Partial<Section>): Section {
    return { beats: this.beats, bar: this.bar, bpm: this.bpm, ev: this.ev, motifs: [...this.motifs], ...extra };
  }
}

/** Automatic variation: ornaments, octave displacement, dropped notes, and rhythmic displacement. */
export function vary(sec: Section, r: Rng, amt: number, bendy = 0): Section {
  if ((amt <= 0 && bendy <= 0) || sec.still) return sec;
  const out: Ev[] = [];
  let first = true;
  for (const e of sec.ev) {
    if (e.k) { out.push(e); continue; }
    if (!e.m) {
      if (e.v === 'nz') { if ((e.nz === 'hat' || e.nz === 'tick' || e.nz === 'gear') && r.chance(0.07 * amt)) continue; out.push(e); continue; }
      if (e.d < 1.5 && e.v !== 'tri' && r.chance(0.05 * amt)) continue;
      const x: Ev = { ...e };
      if (e.d < 1.5 && r.chance(0.05 * amt)) x.n += e.v === 'tri' ? (x.n < 40 ? 12 : -12) : x.n < 70 ? 12 : -12;
      out.push(x);
      continue;
    }
    const x: Ev = { ...e, g: e.g * r.range(0.86, 1.05) };
    if (!first && r.chance(0.06 * amt)) continue;
    first = false;
    if (r.chance(0.05 * amt)) x.n += x.n > 76 ? -12 : 12;
    if (!x.bend && x.d >= 1 && r.chance(bendy)) x.bend = r.pick([-1, -0.5, 0.5, 1, -2, -0.5]);
    if (r.chance(0.05 * amt) && x.t >= 0.25) x.t -= 0.25;
    else if (r.chance(0.04 * amt) && x.d >= 0.75) { x.t += 0.25; x.d -= 0.25; }
    if (r.chance(0.07 * amt) && x.t >= 0.125 && x.d >= 0.5) {
      out.push({ ...x, t: x.t - 0.125, d: 0.12, g: x.g * 0.7, n: x.n + r.pick([1, 2, 2, -1]) });
    } else if (r.chance(0.04 * amt) && x.d >= 1) {
      out.push({ ...x, d: 0.12 }, { ...x, t: x.t + 0.125, d: 0.12, n: x.n + r.pick([1, 2]) });
      x.t += 0.25; x.d -= 0.25;
    }
    out.push(x);
  }
  return { ...sec, ev: out };
}

/** The comfortable range of each voice in MIDI notes. */
export const VOICE_RANGE: Record<Voice, [number, number]> = { p1: [40, 100], p2: [40, 100], tri: [26, 64], nz: [0, 127], x: [30, 108] };

/** A signature of a section's notes at quarter-tone and quarter-beat resolution, to tell whether it repeats audibly. */
export function sectionSig(sec: Section): string {
  return sec.ev.map((e) => e.v + Math.round(e.n * 2) + '@' + Math.round(e.t * 4)).join(',');
}

/** Changes a section a little: a few notes move an octave and a share of them start a sixteenth early or late. Motifs marked k stay as written. */
export function nudge(sec: Section, r: Rng): Section {
  const ev = sec.ev.map((e) => ({ ...e }));
  const free = ev.filter((e) => !e.k && e.v !== 'nz');
  if (!free.length) {
    // Nothing is free to change, so a quiet tick or ghost note joins the section.
    if (!ev.length) return sec;
    const src = ev[r.int(ev.length)];
    const t = Math.floor(r.range(0, sec.beats - 0.5) * 4) / 4 + 0.125;
    if (src.v === 'nz') ev.push({ t, d: 0.05, v: 'nz', n: 60 + r.int(12), g: 0.08, nz: 'tick' });
    else ev.push({ t, d: 1, v: 'x', n: Math.min(100, src.n + 12), g: 0.06, a: 0.2 });
    return { ...sec, ev };
  }
  for (let i = 0; i < Math.min(3, free.length); i++) {
    const e = r.pick(free);
    const [lo, hi] = VOICE_RANGE[e.v];
    if (e.n + 12 <= hi - 2 && (e.n - 12 < lo || r.chance(0.5))) e.n += 12;
    else if (e.n - 12 >= lo) e.n -= 12;
  }
  const shifts = Math.max(2, Math.floor(free.length * 0.3));
  for (let i = 0; i < shifts; i++) {
    const e = r.pick(free), dt = r.pick([-0.25, 0.25]);
    if (e.t + dt >= 0 && e.t + dt < sec.beats - 0.5 && e.d > 0.5) { e.t += dt; e.d -= Math.max(0, dt); }
  }
  return { ...sec, ev };
}

/** Rare wrong events: a bar in another meter, a sudden tritone, a held bent note, a hole. A tame track keeps to the meter and the hole. */
export function wrong(sec: Section, r: Rng, tame = false): Section {
  if (sec.still || !sec.ev.length || sec.tempo) return sec;
  const bars = Math.max(1, Math.floor(sec.beats / sec.bar + 1e-6));
  const kind = tame
    ? r.pick(bars > 1 ? ['meter', 'hole'] as const : ['hole'] as const)
    : r.pick(bars > 1 ? ['meter', 'tritone', 'bend', 'hole'] as const : ['tritone', 'bend', 'hole'] as const);
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
    for (const e of ev) if (e.v !== 'nz' && e.t >= lo && e.t < hi) e.n += e.n + 6 > VOICE_RANGE[e.v][1] ? -6 : 6;
  } else if (kind === 'bend') {
    let best: Ev | null = null;
    for (const e of ev) if (e.m && (!best || e.d > best.d)) best = e;
    if (best) { best.bend = r.pick([-1, 1, -2, -0.5]); best.d = Math.max(best.d, 1.5); }
  } else {
    ev = ev.filter((e) => !(e.m && e.t >= lo && e.t < hi));
  }
  return { ...sec, ev, beats, tag: kind };
}

/** The key slips: one bar, or everything after it, moves a semitone or two while the drums carry on. Kept notes stay put. */
export function slipSec(sec: Section, r: Rng): Section {
  if (sec.tempo) return sec;
  const bars = Math.max(1, Math.floor(sec.beats / sec.bar + 1e-6));
  const lo = r.int(bars) * sec.bar;
  const hi = r.chance(0.4) ? Infinity : lo + sec.bar;
  const s = r.pick([1, -1, 1, -1, 2]);
  const ev = sec.ev.map((e) => {
    if (e.v === 'nz' || e.k || e.t < lo - 1e-6 || e.t >= hi) return e;
    const [a, b] = VOICE_RANGE[e.v];
    return e.n + s >= a && e.n + s <= b ? { ...e, n: e.n + s } : e;
  });
  return { ...sec, ev, tag: (sec.tag ? sec.tag + '+' : '') + 'slip' };
}

/** Swings every off-beat eighth late, by an amount that wanders from bar to bar so the swing stumbles. */
export function swingSec(sec: Section, r: Rng, amt: number, stumble: number): Section {
  const nb = Math.ceil(sec.beats / sec.bar) + 1;
  const per: number[] = [];
  for (let i = 0; i < nb; i++) per.push(Math.max(0, amt + stumble * (r.next() * 2 - 1)));
  const ev = sec.ev.map((e) => {
    if (e.k) return e;
    const f = e.t - Math.floor(e.t);
    if (Math.abs(f - 0.5) > 0.01) return e;
    const s = per[Math.min(nb - 1, Math.floor(e.t / sec.bar))];
    return { ...e, t: e.t + s, d: Math.max(0.06, e.d - s) };
  });
  return { ...sec, ev };
}

/** Seconds at a beat of a section, following its tempo points. */
export function timeMap(sec: Pick<Section, 'beats' | 'bpm' | 'tempo'>): (beat: number) => number {
  const bpm0 = Math.max(8, sec.bpm || 90);
  if (!sec.tempo || !sec.tempo.length) { const spb = 60 / bpm0; return (b) => b * spb; }
  const pts = [...sec.tempo].sort((a, b) => a[0] - b[0]);
  const bpmAt = (b: number): number => {
    if (b <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (b <= pts[i][0]) {
        const u = (b - pts[i - 1][0]) / Math.max(1e-6, pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u;
      }
    }
    return pts[pts.length - 1][1];
  };
  const STEP = 1 / 32;
  const n = Math.ceil(sec.beats / STEP) + 2;
  const tab = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) tab[i + 1] = tab[i] + (STEP * 60) / Math.max(8, bpmAt((i + 0.5) * STEP));
  return (beat) => {
    const x = Math.max(0, beat) / STEP;
    const i = Math.min(n - 1, Math.floor(x));
    return tab[i] + (tab[i + 1] - tab[i]) * (x - i);
  };
}

// ---------------------------------------------------------------- harmony

/** Chord roots (scale degrees 0 to 6) that drift without resolving: no fifth-down motion into the tonic, and rarely the tonic at all. */
export function floatProg(r: Rng, n: number, start: number, tonic = 0.1): number[] {
  const out = [((start % 7) + 7) % 7];
  let cur = out[0];
  while (out.length < n) {
    const pool = [-2, 2, -1, 1, 3, -3, 2, -2].map((s) => (((cur + s) % 7) + 7) % 7)
      .filter((c) => c !== cur && (c !== 0 || (cur !== 4 && cur !== 6 && cur !== 3 && r.chance(tonic))));
    cur = r.pick(pool.length ? pool : [(cur + 2) % 7]);
    out.push(cur);
  }
  return out;
}

/** Chord colors as scale-degree offsets from the root. None of them is a plain triad that asks to resolve. */
export const COLOR = {
  sus2: [0, 1, 4], sus4: [0, 3, 4], add9: [0, 2, 4, 8], sev: [0, 2, 4, 6], q4: [0, 3, 6], qq: [0, 1, 3, 6], clus: [0, 1, 2, 4], tri: [0, 2, 4], nin: [0, 2, 4, 6, 8],
} as const;
export type ColorName = keyof typeof COLOR;

/** Pitches of a chord color on a degree, folded to sit at or above lo. */
export function colorTones(K: Key, deg: number, color: ColorName, lo: number): number[] {
  return COLOR[color].map((o) => foldAbove(K(deg + o), lo)).sort((a, b) => a - b);
}

/** Tones of the chord on degree d, stacked in thirds: root, third, fifth, seventh, ninth. */
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
export const foldAbove = fold;

/** Chord roots with seeded substitutions: subs maps a degree to the degrees that may replace it. */
export function prog(r: Rng, base: readonly number[], subs: Record<number, readonly number[]>, p: number): number[] {
  return base.map((d) => (subs[d] && r.chance(p) ? r.pick(subs[d]) : d));
}

/** A Euclidean rhythm: k hits spread over n steps. */
export function euclid(k: number, n: number, rot = 0): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < n; i++) out.push(((i * k) % n) < k);
  const r = ((rot % n) + n) % n;
  return out.map((_, i) => out[(i + r) % n]);
}

/** Removes everything that sounds in [from, from + len) and cuts earlier notes at from. */
export function silence(sec: Section, from: number, len: number): Section {
  const to = from + len;
  const ev: Ev[] = [];
  for (const e of sec.ev) {
    if (e.t >= from - 1e-6 && e.t < to - 1e-6) continue;
    if (e.t < from && e.t + e.d > from) ev.push({ ...e, d: Math.max(0.05, from - e.t - 0.02) });
    else ev.push(e);
  }
  return { ...sec, ev };
}

/** Snaps a pitch to the nearest note of a key. */
export function snap(n: number, K: Key): number {
  let best = n, bd = 99;
  for (let o = -2; o <= 2; o++) {
    for (const s of K.mode) {
      const p = K.root + s + 12 * (Math.round((n - K.root) / 12) + o);
      if (Math.abs(p - n) < bd) { bd = Math.abs(p - n); best = p; }
    }
  }
  return best;
}

/** One remembered phrase from the engine's memory, set into a key. Null when memory is empty. */
export function recallLine(c: Ctx, K: Key | null, oct = 0): Line | null {
  if (!c.recall.length) return null;
  // Newer memories are more likely.
  const i = Math.min(c.recall.length - 1, Math.floor(Math.pow(c.r.next(), 1.6) * c.recall.length));
  const m = c.recall[c.recall.length - 1 - i];
  const keep = c.r.chance(0.45);
  return m.line.map(([p, l]) => [p === null ? null : (K && !keep ? snap(p, K) : p) + 12 * oct, l]);
}
