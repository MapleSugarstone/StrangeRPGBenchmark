// Harmony, accompaniment, drum grooves, and a melody generator shared by every track.
// Chords are diatonic: a scale degree plus an extension, so every chord tone stays in the key.
import { B, Rng, fold, hash, type Ctx, type Ev, type Fig, type Key, type Nz, type Voice } from './score-core';

export type Ext = 'tri' | 'add9' | 'sev' | 'nine' | 'sus2' | 'sus4' | 'six';
/** A diatonic chord: its root as a scale degree, and an extension. */
export type Ch = readonly [number, Ext?];
type X = Partial<Ev>;

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** The scale degrees of a chord, root first. */
export function chordDegs(c: Ch): number[] {
  const d = c[0];
  switch (c[1] ?? 'tri') {
    case 'add9': return [d, d + 2, d + 4, d + 8];
    case 'sev': return [d, d + 2, d + 4, d + 6];
    case 'nine': return [d, d + 2, d + 4, d + 6, d + 8];
    case 'sus2': return [d, d + 1, d + 4];
    case 'sus4': return [d, d + 3, d + 4];
    case 'six': return [d, d + 2, d + 4, d + 5];
    default: return [d, d + 2, d + 4];
  }
}

/** Close voicing with the root folded into [lo, lo + 12). Five-note chords leave their root to the bass. */
export function tones(K: Key, c: Ch, lo: number, max = 5): number[] {
  const degs = chordDegs(c);
  const out = [fold(K(degs[0]), lo)];
  for (let i = 1; i < degs.length; i++) {
    let p = K(degs[i]);
    const prev = out[out.length - 1];
    while (p <= prev) p += 12;
    while (p - 12 > prev) p -= 12;
    out.push(p);
  }
  return (out.length >= 5 ? out.slice(1) : out).slice(0, max);
}

export const rootOf = (K: Key, c: Ch, lo: number) => fold(K(c[0]), lo);
export const fifthOf = (K: Key, c: Ch, lo: number) => fold(K(c[0] + 4), lo);

export function pad(b: B, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}, lo = 53): void {
  for (const n of tones(K, c, lo)) b.n('pad', t, n, d, g, x);
}

export function brass(b: B, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}, lo = 50): void {
  for (const n of tones(K, c, lo, 4)) b.n('brass', t, n, d, g, x);
}

export function choir(b: B, K: Key, t: number, c: Ch, d: number, g: number, ah = 0, x: X = {}, lo = 55): void {
  for (const n of tones(K, c, lo, 4)) b.n('choir', t, n, d, g, { ah, ...x });
}

/** A chord on any polyphonic voice, for bells and swells. */
export function chordOn(b: B, v: Voice, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}, lo = 60, max = 4): void {
  for (const n of tones(K, c, lo, max)) b.n(v, t, n, d, g, x);
}

export function sub(b: B, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}, lo = 33): void {
  b.n('sub', t, rootOf(K, c, lo), d, g, x);
}

/** An arpeggio over the chord: `pat` indexes the chord's tones from the bottom, two octaves deep. */
export function arp(b: B, K: Key, t: number, c: Ch, d: number, step: number, g: number, pat: readonly number[] = [0, 1, 2, 3, 2, 1], x: X = {}, v: Voice = 'arp', lo = 57): void {
  const one = tones(K, c, lo, 4);
  const ladder = [...one, ...one.map((n) => n + 12)].sort((a, z) => a - z);
  const n = Math.round(d / step);
  for (let k = 0; k < n; k++) b.n(v, t + k * step, ladder[pat[k % pat.length] % ladder.length], step * 0.8, g * (k % 4 === 0 ? 1 : 0.74), x);
}

/** Root eighths with the octave on every fourth step. */
export function pulse(b: B, K: Key, t: number, c: Ch, d: number, g: number, step = 0.5, x: X = {}, lo = 33): void {
  const r = rootOf(K, c, lo);
  for (let k = 0; k < Math.round(d / step); k++) b.n('bass', t + k * step, k % 4 === 3 ? r + 12 : r, step * 0.8, g * (k % 2 ? 0.8 : 1), x);
}

/** Root and octave bouncing in eighths. */
export function bounce(b: B, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}, lo = 36): void {
  const r = rootOf(K, c, lo);
  for (let k = 0; k < Math.round(d / 0.5); k++) b.n('bass', t + k * 0.5, k % 2 ? r + 12 : r, 0.4, g * (k % 2 ? 0.75 : 1), x);
}

/** A walking bass in quarters: root, a chord tone, a passing tone, then a step into the next chord's root. */
export function walk(b: B, K: Key, t: number, c: Ch, next: Ch, beats: number, g: number, r: Rng, x: X = {}, lo = 36): void {
  const root = c[0];
  const to = next[0];
  const pathDeg = [root, root + r.pick([2, 4, 2]), root + r.pick([4, 3, 5]), to + (r.chance(0.5) ? 1 : -1)];
  for (let k = 0; k < beats; k++) {
    const d = k < pathDeg.length ? pathDeg[k] : root + 4;
    b.n('bass', t + k, fold(K(d), lo), 0.85, g * (k === 0 ? 1 : 0.82), x);
  }
}

/** Oom-pah: root and fifth on the strong beats, a chord stab between. */
export function oompah(b: B, K: Key, t: number, c: Ch, beats: number, g: number, stab: Voice = 'brass', x: X = {}, lo = 36): void {
  for (let k = 0; k < beats; k++) {
    if (k % 2 === 0) b.n('bass', t + k, k % 4 === 0 ? rootOf(K, c, lo) : fifthOf(K, c, lo), 0.6, g, x);
    else for (const n of tones(K, c, 55, 3)) b.n(stab, t + k, n, 0.35, g * 0.42, x);
  }
}

/**
 * A drum groove. Each pattern is one bar of steps (16 in 4/4, 12 in 3/4) with a digit 1-9 for a hit's level and any
 * other character for silence. The pattern repeats for `bars` bars from t.
 */
export function groove(b: B, t: number, bars: number, pat: Partial<Record<Nz, string>>, g: number, x: X = {}, beatsPerBar = 4): void {
  for (const [kind, s] of Object.entries(pat) as Array<[Nz, string]>) {
    const steps = s.length;
    const len = beatsPerBar / steps;
    for (let bar = 0; bar < bars; bar++) {
      for (let k = 0; k < steps; k++) {
        const ch = s.charCodeAt(k) - 48;
        if (ch < 1 || ch > 9) continue;
        const dur = kind === 'hiss' || kind === 'hum' || kind === 'roll' || kind === 'swell' || kind === 'breath' || kind === 'slosh' ? len : 0.25;
        b.hit(t + bar * beatsPerBar + k * len, kind, (g * ch) / 9, dur, x);
      }
    }
  }
}

/** Scattered ticks across `beats`, about `n` of them. */
export function ticks(b: B, c: Ctx, beats: number, n: number, g: number, x: X = {}, kind: Nz = 'tick'): void {
  for (let k = 0; k < n; k++) b.hit(c.r.next() * beats, kind, g * c.r.range(0.5, 1), 0.04, { pan: c.r.range(-0.7, 0.7), ...x });
}

/** Places a motif with the melodic flag set, so automatic variation may ornament it. */
export function motif(b: B, v: Voice, t: number, f: Fig, K: Key, oct: number, g: number, x: X = {}, leg = 0.96): number {
  return b.fig(v, t, f, K, oct, g, { m: 1, ...x }, leg);
}

// ---------------------------------------------------------------- melody

/** Cost of a melodic step by size in scale steps: repeats cost a little, steps nothing, leaps more. */
const STEP = [1.1, 0, 0.5, 1.2, 1.6, 2.2];

type Rh = ReadonlyArray<readonly [number, number]>;
const RH4: Rh[][] = [
  [[[0, 4]], [[0, 2], [2, 2]], [[0, 3], [3, 1]], [[0, 2], [2, 1], [3, 1]]],
  [[[0, 1], [1, 1], [2, 2]], [[0, 1.5], [1.5, 0.5], [2, 2]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]], [[0, 2], [2, 1], [3, 0.5], [3.5, 0.5]], [[0.5, 0.5], [1, 1], [2, 1], [3, 1]], [[0, 1], [1, 1], [2, 1], [3, 1]]],
  [[[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]], [[0, 0.75], [0.75, 0.25], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]]],
  [[[0, 0.5], [0.5, 0.25], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 0.25], [2.25, 0.25], [2.5, 0.5], [3, 1]], [[0, 0.25], [0.25, 0.25], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]]],
];
const CAD4: Rh[] = [[[0, 1], [1, 1], [2, 2]], [[0, 2], [2, 2]], [[0, 0.5], [0.5, 0.5], [1, 3]], [[0, 4]]];
const RH3: Rh[][] = [
  [[[0, 3]], [[0, 2], [2, 1]]],
  [[[0, 1], [1, 1], [2, 1]], [[0, 2], [2, 1]], [[0, 1.5], [1.5, 0.5], [2, 1]]],
  [[[0, 1], [1, 0.5], [1.5, 0.5], [2, 1]], [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1]], [[0, 1.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5]]],
  [[[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1]]],
];
const CAD3: Rh[] = [[[0, 3]], [[0, 1], [1, 2]]];

/** One melody note as [time in beats, length in beats, scale degree]. */
export type Mel = Array<[number, number, number]>;

export interface PhraseOpts {
  K: Key;
  /** One chord per bar. */
  chords: readonly Ch[];
  bar: number;
  /** Rhythm density from 0 (long tones) to 3 (sixteenths). */
  dens: number;
  /** Range in scale degrees. */
  lo: number;
  hi: number;
  start?: number;
  /** home ends on the tonic, open ends on any chord tone, none leaves the ending alone. */
  cad?: 'home' | 'open' | 'none';
  /** Optional guide degrees by note index, which the line leans toward. */
  guide?: number[];
}

/** One phrase fitted to its chords: chord tones on strong beats, steps preferred, leaps recovered. */
export function phrase(r: Rng, o: PhraseOpts, rhythm?: Rh[]): Mel {
  const out: Mel = [];
  const bank = o.bar === 3 ? RH3 : RH4;
  const cads = o.bar === 3 ? CAD3 : CAD4;
  const dens = Math.max(0, Math.min(bank.length - 1, Math.round(o.dens)));
  const mid = (o.lo + o.hi) / 2;
  let p = o.start ?? Math.round(mid), pp = p;
  let gi = 0;
  for (let bi = 0; bi < o.chords.length; bi++) {
    const last = bi === o.chords.length - 1;
    const rh = rhythm?.[bi] ?? (last && o.cad !== 'none' ? r.pick(cads) : r.pick(bank[dens]));
    const ch = new Set(chordDegs(o.chords[bi]).map((d) => mod(d, 7)));
    for (let k = 0; k < rh.length; k++) {
      const [on, len] = rh[k];
      const s = on === 0 ? 2 : Math.abs(on - Math.round(on)) < 1e-6 ? 1 : 0;
      const final = last && k === rh.length - 1 && o.cad !== 'none';
      const g = o.guide?.[gi];
      let best = p, bc = Infinity;
      for (let d = p - 5; d <= p + 5; d++) {
        const tone = ch.has(mod(d, 7));
        let cost = STEP[Math.abs(d - p)];
        if (!tone) cost += s === 2 ? 3.5 : s === 1 ? 1.2 : len >= 1 ? 1.5 : 0;
        if (Math.abs(p - pp) >= 3 && Math.sign(d - p) === Math.sign(p - pp)) cost += 1.5;
        if (Math.abs(o.K(d) - o.K(p)) === 6) cost += 2;
        cost += Math.max(0, o.lo - d, d - o.hi) * 2 + Math.abs(d - mid) * 0.08 + r.next() * 1.3;
        if (g !== undefined) cost += Math.abs(d - g) * 0.9;
        if (final) { if (o.cad === 'home' ? mod(d, 7) !== 0 : !tone) cost += 8; }
        if (cost < bc) { bc = cost; best = d; }
      }
      if (out.length === 0 && o.start !== undefined) best = o.start;
      out.push([bi * o.bar + on, len, best]);
      pp = p;
      p = best;
      gi++;
    }
  }
  return out;
}

/** Re-fits a phrase's rhythm and contour to new chords, a number of steps away. Used to develop a tune. */
export function refit(r: Rng, m: Mel, o: PhraseOpts, steps: number): Mel {
  const rh: Array<Array<readonly [number, number]>> = o.chords.map(() => []);
  for (const [t, len] of m) {
    const bi = Math.min(o.chords.length - 1, Math.floor(t / o.bar + 1e-6));
    rh[bi].push([t - bi * o.bar, len]);
  }
  for (let i = 0; i < rh.length; i++) if (!rh[i].length) rh[i] = [[0, o.bar]];
  return phrase(r, { ...o, guide: m.map((x) => x[2] + steps), start: undefined }, rh);
}

const pack = (m: Mel): number[] => m.flatMap((x) => [x[0], x[1], x[2]]);
const unpack = (a: number[] | undefined): Mel | null => {
  if (!a || a.length < 3) return null;
  const out: Mel = [];
  for (let i = 0; i + 2 < a.length; i += 3) out.push([a[i], a[i + 1], a[i + 2]]);
  return out;
};

export interface SongOpts {
  K: Key;
  /** One chord per bar. The form splits these evenly across its letters. */
  prog: readonly Ch[];
  bar: number;
  dens: number;
  lo: number;
  hi: number;
  /** The memory slot that keeps this tune's A phrase, so the tune stays the same every pass and every session. */
  slot: string;
  form?: string;
}

/**
 * A tune in a phrase form (AABA by default). The A phrase comes from a fixed seed, so a track keeps its own tune.
 * Later A phrases end at home, B develops A by sequence or writes a new phrase, and the engine ornaments the rest.
 */
export function song(c: Ctx, o: SongOpts): Mel {
  const form = o.form ?? 'AABA';
  const per = Math.max(1, Math.floor(o.prog.length / form.length));
  const chordsAt = (k: number) => o.prog.slice(k * per, k * per + per);
  let A = unpack(c.mem[o.slot]);
  if (!A) {
    A = phrase(new Rng(hash(o.slot)), { K: o.K, chords: chordsAt(0), bar: o.bar, dens: o.dens, lo: o.lo, hi: o.hi, cad: 'open' });
    c.mem[o.slot] = pack(A);
  }
  const out: Mel = [];
  let seenA = false;
  for (let k = 0; k < form.length; k++) {
    const off = k * per * o.bar;
    const chords = chordsAt(k);
    const last = k === form.length - 1;
    let m: Mel;
    if (form[k] === 'A') {
      const sameChords = chords.every((ch, i) => ch[0] === o.prog[i][0]);
      m = seenA && (!sameChords || last)
        ? refit(c.r, A, { K: o.K, chords, bar: o.bar, dens: o.dens, lo: o.lo, hi: o.hi, cad: last ? 'home' : 'open' }, 0)
        : A;
      seenA = true;
    } else {
      const base = { K: o.K, chords, bar: o.bar, dens: Math.min(3, o.dens + (c.r.chance(0.5) ? 1 : 0)), lo: o.lo, hi: o.hi, cad: last ? 'home' as const : 'open' as const };
      m = c.r.chance(0.5) ? refit(c.r, A, base, c.r.pick([2, -1, 3])) : phrase(c.r, base);
    }
    for (const [t, len, d] of m) out.push([t + off, len, d]);
  }
  return out;
}

/** Writes a melody onto a voice with the melodic flag set. */
export function sing(b: B, v: Voice, t: number, m: Mel, K: Key, oct: number, g: number, x: X = {}, leg = 0.94): void {
  for (const [at, len, d] of m) b.n(v, t + at, K(d) + 12 * oct, len * leg, g, { m: 1, ...x });
}
