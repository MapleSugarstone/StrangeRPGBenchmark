// Phrase and texture builders shared by the tracks.
import { B, fold, recallLine } from './lib';
import type { Ctx, Ev, Fig, Key, Line, Rng, Section, Voice } from './lib';

/** A rhythm that fills a bar: lengths in beats drawn from eighths, quarters, dotted quarters, and halves. */
export function rhy(r: Rng, bar: number, grid = 0.5): number[] {
  const out: number[] = [];
  let left = bar;
  while (left > 1e-6) {
    const opts = ([[0.5, 2], [1, 3], [1.5, 1], [2, 1], [0.25, 0.3]] as const).filter(([x]) => x <= left + 1e-6 && x >= grid - 1e-6);
    const x = opts.length ? r.weighted(opts) : left;
    out.push(x);
    left -= x;
  }
  return out;
}

/** A melodic line as scale degrees: steps and small leaps, landing on chord tones on strong beats. */
export function walk(r: Rng, rhythm: readonly number[], start: number, chordDegs: readonly number[], o: { lo?: number; hi?: number; rest?: number; leap?: number } = {}): Array<[number | null, number]> {
  const lo = o.lo ?? -2, hi = o.hi ?? 9;
  let d = start, t = 0;
  const out: Array<[number | null, number]> = [];
  for (const len of rhythm) {
    if (o.rest && r.chance(o.rest)) { out.push([null, len]); t += len; continue; }
    const strong = Math.abs(t - Math.round(t)) < 1e-6 && Math.round(t) % 2 === 0;
    let cand: number;
    if (strong) {
      const pool: number[] = [];
      for (let k = -3; k <= 3; k++) if ((k !== 0 || r.chance(0.12)) && chordDegs.includes((((d + k) % 7) + 7) % 7)) pool.push(d + k);
      cand = pool.length ? r.pick(pool) : d + r.pick([-1, 1]);
    } else {
      cand = d + r.weighted([[1, 3], [-1, 3], [2, 1.2], [-2, 1.2], [0, 0.6], [r.pick([3, -3, 4, -4]), o.leap ?? 0.5]] as const);
    }
    d = Math.max(lo, Math.min(hi, cand));
    out.push([d, len]);
    t += len;
  }
  return out;
}

/** A melody over a run of bars, one chord root per bar, so each bar lands on the chord that sounds under it. */
export function walkBars(r: Rng, bar: number, roots: readonly number[], start: number, o: { lo?: number; hi?: number; rest?: number; leap?: number; grid?: number } = {}): Array<[number | null, number]> {
  const out: Array<[number | null, number]> = [];
  let d = start;
  for (const R of roots) {
    const line = walk(r, rhy(r, bar, o.grid ?? 0.5), d, [((R % 7) + 7) % 7, (((R + 2) % 7) + 7) % 7, (((R + 4) % 7) + 7) % 7], o);
    for (const x of line) { out.push(x); if (x[0] !== null) d = x[0]; }
  }
  return out;
}

/** Scale-degree lines as pitches in a key, an octave up if asked. */
export function toPitch(line: ReadonlyArray<readonly [number | null, number]>, K: Key, oct = 0): Line {
  return line.map(([d, l]) => [d === null ? null : K(d) + 12 * oct, l]);
}

/** Sixteenth or eighth arpeggio over tones, following a pattern of indexes. */
export function arp(b: B, v: Voice, t: number, len: number, step: number, tones: readonly number[], pattern: readonly number[], g: number, x?: Partial<Ev>, accent = 1.25) {
  const n = Math.round(len / step);
  for (let i = 0; i < n; i++) {
    const idx = pattern[i % pattern.length];
    const p = tones[((idx % tones.length) + tones.length) % tones.length] + 12 * Math.floor(idx / tones.length);
    b.n(v, t + i * step, p, step * 0.8, g * (i % 4 === 0 ? accent : 1), x);
  }
}

/** Mechanical percussion: a gear tick on every step, with accents on the given steps of the cycle. */
export function gears(b: B, t: number, len: number, step: number, g: number, accents: readonly number[] = [0], cycle = 8, x?: Partial<Ev>) {
  const n = Math.round(len / step);
  for (let i = 0; i < n; i++) {
    const acc = accents.includes(i % cycle);
    b.hit(t + i * step, acc ? 'gear' : 'tick', acc ? g : g * 0.55, 0.08, { ...x, n: 60 + ((i * 5) % 12) });
  }
}

/**
 * Memory chimes: a remembered phrase rings on the extra voice and then returns backwards, swelling into each strike, an octave lower and missing its last note.
 * The echo starts after the phrase ends, since a bell channel plays one bell at a time. Returns the end time, or -1 with no memory.
 */
export function chimes(b: B, c: Ctx, K: Key | null, t: number, g: number, o: { oct?: number; stretch?: number; echo?: number; max?: number; ratio?: number } = {}): number {
  const line = recallLine(c, K, o.oct ?? 1);
  if (!line) return -1;
  const st = o.stretch ?? 1.5, max = o.max ?? 5;
  const taken: Array<[number, number, number]> = [];
  let off = 0;
  for (const [p, l] of line) {
    if (p !== null) taken.push([p, off, l * st]);
    off += l * st;
    if (taken.length >= max) break;
  }
  if (!taken.length) return -1;
  const bell = (p: number, at: number, len: number, gain: number, back = false) => b.n('x', at, p, Math.min(2.5, Math.max(0.3, len * 0.95)), gain, back ? { ratio: o.ratio, rev: 1 } : { ratio: o.ratio, a: 0.005 });
  taken.forEach(([p, at, len]) => bell(p, t + at, len, g));
  const start = t + off + (o.echo ?? 1.5);
  taken.slice(0, Math.max(1, taken.length - 1)).forEach(([p, at, len], i) => bell(p - 12 + (i % 2 ? -0.35 : 0), start + at, len, g * 0.6, true));
  return start + off;
}

/** A bass figure on a chord root, folded to start at or above lo. Intervals above the root keep their size. */
export function bassLine(b: B, v: Voice, t: number, fig: Fig, K: Key, R: number, lo: number, g: number, x?: Partial<Ev>, leg = 0.8): number {
  const base = fold(K(R), lo);
  for (const [d, l, acc] of fig) {
    if (d !== null) b.n(v, t, base + (K(R + d) - K(R)) + (acc ?? 0), l * leg, g, x);
    t += l;
  }
  return t;
}

/** Bar-end check for tracks that never cadence: moves a final tonic note up a scale step. */
export function noTonicEnd(sec: Section, K: Key): Section {
  const last = new Map<Voice, Ev>();
  for (const e of sec.ev) {
    if (e.v === 'nz') continue;
    const l = last.get(e.v);
    if (!l || e.t >= l.t) last.set(e.v, e);
  }
  const pc = ((K.root % 12) + 12) % 12;
  const ev = sec.ev.map((e) => {
    if (last.get(e.v) !== e) return e;
    const ep = ((Math.round(e.n) % 12) + 12) % 12;
    if (ep !== pc) return e;
    return { ...e, n: e.n + K.mode[1] };
  });
  return { ...sec, ev };
}
