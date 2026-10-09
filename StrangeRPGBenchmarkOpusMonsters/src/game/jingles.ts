// Jingles for a whorl growing a level, going into the horn, and switching in battle, pitched to the key and chord the music plays now.
import { sfx } from '../engine/audio';
import { chordLen, ct, deg, hiss, scaleLen, tone } from './tuned';

/** A whorl grows a level: a plucked run up the scale that starts a step higher for each level, then a bell on the octave. */
export function levelJingle(level = 1): void {
  const L = scaleLen(), b = ((level % L) + L) % L;
  [0, 2, 4].forEach((s, k) => tone({ w: 'triangle', f: deg(b + s, 5), dur: 0.1, vol: 0.04, at: k * 0.065, fm: [2, 1] }));
  tone({ f: deg(b + L, 5), dur: 0.75, vol: 0.05, at: 0.2, fm: [3.5, 2] });
  tone({ f: ct(0, 4), dur: 0.5, vol: 0.024, at: 0.2, fm: [2, 0.6] });
  tone({ f: deg(b + L + 2, 6), dur: 0.08, vol: 0.012, at: 0.3, fm: [2.76, 1] });
  tone({ f: deg(b + L + 4, 6), dur: 0.08, vol: 0.01, at: 0.36, fm: [2.76, 1] });
}

/** The horn closes round a whorl: a low horn note under a filter that shuts, a body an octave down, and the mouth's soft thud. */
function hornClose(at: number): void {
  const f = deg(0, 3);
  tone({ w: 'sawtooth', f: f * 0.94, to: f, dur: 0.34, vol: 0.05, at, a: 0.02, lp: [1800, 200, 4] });
  tone({ f: f / 2, dur: 0.3, vol: 0.04, at, a: 0.02 });
  hiss({ f: 320, kind: 'lowpass', q: 0.8, dur: 0.1, vol: 0.18, at: at + 0.24 });
}

/** The horn rocks once: a quick wobbling note on a chord tone, and a rattle inside. */
function wobble(at: number, k: number, v: number): void {
  tone({ w: 'triangle', f: ct(k, 4), dur: 0.16, vol: 0.04 * v, at, vib: [16, 70] });
  hiss({ f: 1400, q: 2, dur: 0.06, vol: 0.05 * v, at });
}

/** The bright success chime: bells up the chord, landing on the root an octave up, with a glint above it. */
function chime(at: number): void {
  const n = Math.min(4, chordLen()), land = at + n * 0.06;
  for (let k = 0; k < n; k++) tone({ f: ct(k, 5), dur: 0.35, vol: 0.036, at: at + k * 0.06, fm: [3.5, 2] });
  tone({ f: deg(0, 6), dur: 0.95, vol: 0.045, at: land, fm: [3.5, 2.2] });
  tone({ f: deg(0, 4), dur: 0.7, vol: 0.024, at: land, fm: [2, 0.8] });
  for (let k = 0; k < 3; k++) tone({ f: deg(2 + k * 2, 7), dur: 0.06, vol: 0.01, at: land + 0.1 + k * 0.05, fm: [2.76, 1] });
}

/** A whorl sounded into the horn: the horn closes, rocks twice, and chimes. */
export function catchJingle(): void {
  hornClose(0);
  wobble(0.38, 0, 1);
  wobble(0.62, 1, 0.7);
  chime(0.88);
}

/** A whorl that comes along willingly: the horn closes and chimes, with no rocking. */
export function joinJingle(): void {
  hornClose(0);
  chime(0.34);
}

/** A whorl called back: three quick plucks fall down the chord, then the horn closes softly round it. About 0.35 seconds. */
export function switchOutJingle(): void {
  [2, 1, 0].forEach((k, i) => tone({ w: 'triangle', f: ct(k, 5), dur: 0.08, vol: 0.03, at: i * 0.045, fm: [2, 0.9] }));
  const f = deg(0, 3);
  tone({ w: 'sawtooth', f: f * 0.94, to: f, dur: 0.2, vol: 0.03, at: 0.13, a: 0.015, lp: [1400, 180, 3] });
  tone({ f: f / 2, dur: 0.18, vol: 0.026, at: 0.13, a: 0.015 });
  hiss({ f: 320, kind: 'lowpass', q: 0.8, dur: 0.07, vol: 0.11, at: 0.27 });
}

/** A whorl sent out: the horn opens under a filter that lifts, three quick plucks climb the chord, and a small bell glints on top. About 0.3 seconds. */
export function switchInJingle(): void {
  const f = deg(0, 3);
  tone({ w: 'sawtooth', f, dur: 0.14, vol: 0.026, a: 0.01, lp: [220, 1600, 3] });
  hiss({ f: 900, to: 2600, q: 1.5, dur: 0.08, vol: 0.04, at: 0.04 });
  [0, 1, 2].forEach((k, i) => tone({ w: 'triangle', f: ct(k, 5), dur: 0.08, vol: 0.03, at: 0.08 + i * 0.045, fm: [2, 0.9] }));
  tone({ f: ct(0, 6), dur: 0.2, vol: 0.022, at: 0.21, fm: [3.5, 1.8] });
  tone({ f: deg(4, 7), dur: 0.05, vol: 0.009, at: 0.25, fm: [2.76, 1] });
}

/** A sounding that fails: the horn closes and rocks twice, then the usual sagging conch of a failure. */
export function missJingle(): void {
  hornClose(0);
  wobble(0.38, 0, 1);
  wobble(0.62, 1, 0.7);
  setTimeout(() => sfx('pegFail'), 880);
}
