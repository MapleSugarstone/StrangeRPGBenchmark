// Places Fathom's leitmotifs and its weather into tracks: the port's reaching figure, the Bailers' walk, the Board's
// four notes, Marit's lullaby, rain, and the breath of woken things.
import { B, figLen, type Ctx, type Ev, type Fig, type Key, type Voice } from './score-core';
import { motif } from './parts';
import { BAILER, BOARD, MARIT, PORT } from './motifs';

type X = Partial<Ev>;

/**
 * The port's figure. Its last note leans up toward the octave by a third of a semitone and never gets there.
 * `reach` sets how far it leans. Returns the end time.
 */
export function port(b: B, v: Voice, t: number, K: Key, oct: number, g: number, x: X = {}, f: Fig = PORT, reach = 0.35): number {
  const before = b.ev.length;
  const end = motif(b, v, t, f, K, oct, g, x);
  let last: Ev | null = null;
  for (let i = before; i < b.ev.length; i++) if (!last || b.ev[i].t > last.t) last = b.ev[i];
  if (last && reach) last.bend = reach;
  return end;
}

/**
 * A Bailer wading past: its figure on low brass with a sub under it, a stomp in deep water every second beat, and the
 * water it lifts. `fig` may be the fallen figure, whose last step never lands.
 */
export function bailer(b: B, K: Key, t: number, g: number, fig: Fig = BAILER, x: X = {}, far = false): number {
  const len = figLen(fig);
  b.fig('brass', t, fig, K, -1, g * 0.55, { a: 0.35, cut: far ? 700 : 1100, ...x }, 0.96);
  b.fig('sub', t, fig, K, -2, g * 0.8, x, 0.96);
  let k = 0;
  let at = t;
  for (const [d, l] of fig) {
    // Each note is a step. A rest is a foot that never comes down.
    if (d !== null) b.hit(at, 'stomp', g * (far ? 0.4 : 0.75) * (k % 2 ? 0.85 : 1), 1, x);
    at += l;
    k++;
  }
  b.hit(t + len * 0.5, 'slosh', g * (far ? 0.2 : 0.35), len * 0.45, x);
  return t + len;
}

/** The Board's four notes, flat and square. Returns the end time. */
export function board(b: B, v: Voice, t: number, K: Key, oct: number, g: number, x: X = {}, f: Fig = BOARD): number {
  return motif(b, v, t, f, K, oct, g, { cut: 2600, ...x }, 0.9);
}

/** Marit's lullaby. Returns the end time. */
export function marit(b: B, v: Voice, t: number, K: Key, oct: number, g: number, x: X = {}, f: Fig = MARIT): number {
  return motif(b, v, t, f, K, oct, g, x, 0.94);
}

/** Rain: a soft hiss bed and drips that land on pitches of the key, so the weather plays along. */
export function rain(b: B, c: Ctx, K: Key, beats: number, g: number, drips = 6, x: X = {}): void {
  b.hit(0, 'hiss', g * 0.5, beats, { a: 1.5, ...x });
  for (let k = 0; k < drips; k++) {
    const at = c.r.next() * beats;
    b.hit(at, 'drip', g * c.r.range(0.5, 1), 0.1, { n: K(c.r.pick([0, 2, 4, 7, 9])) + 24, pan: c.r.range(-0.8, 0.8), ...x });
  }
}

/** A woken thing breathing, about once every two seconds at the section's tempo. */
export function breathe(b: B, beats: number, g: number, x: X = {}): void {
  const every = Math.max(1, Math.round((2 * b.bpm) / 60));
  for (let t = 0; t + every <= beats + 1e-6; t += every) b.hit(t, 'breath', g, every * 0.9, x);
}

/** Water lapping at pilings or a hull, every `every` beats with a little drift. */
export function lap(b: B, c: Ctx, beats: number, every: number, g: number, x: X = {}): void {
  for (let t = 0; t < beats; t += every) b.hit(Math.min(beats - 0.1, t + c.r.range(0, 0.5)), 'slosh', g * c.r.range(0.7, 1), every * 0.8, { pan: c.r.range(-0.5, 0.5), ...x });
}
