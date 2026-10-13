// Sound design data: each effect as a short list of synth voices, the stingers that follow the music's key, and the tables that duck and bend the music. audio.ts plays them.
import type { SfxId } from '../audio';

/** One synth voice. Paths spread evenly across the voice and glide geometrically between points. */
export interface Vc {
  w: 'sine' | 'triangle' | 'square' | 'saw' | 'pulse' | 'noise' | 'breathy' | 'buzzy' | 'reedy';
  /** Pitch path in Hz, or the band center path for noise. */
  f: number[];
  /** Length in seconds. */
  d: number;
  /** Peak level. */
  v: number;
  /** Delay from the call in seconds. */
  at?: number;
  /** Attack in seconds. */
  a?: number;
  /** Vibrato: rate in Hz, depth in cents, end rate. */
  vib?: [number, number, number?];
  /** Tremolo: rate in Hz, depth from 0 to 1, end rate. */
  trem?: [number, number, number?];
  /** Frequency modulation: modulator ratio, index at the start, index at the end. */
  fm?: [number, number, number?];
  /** Low-pass cutoff path in Hz and Q. */
  lp?: [number[], number];
  /** High-pass cutoff in Hz, for noise. */
  hp?: number;
  /** Band-pass Q for noise. */
  q?: number;
  /** A second oscillator detuned by this many cents. */
  wide?: number;
  /** Gate: the voice stops dead at this many seconds. */
  cut?: number;
  /** Random pitch variation as a share of the pitch. */
  j?: number;
  /** Replaces the usual fast fall with a speech letter's shape. */
  shape?: 'voice' | 'swell' | 'puff';
  /** Two formant frequencies in Hz: the source runs through a band-pass at each, as a mouth shapes a vowel. */
  form?: [number, number];
  /** Noise mixed into the formants, as a multiple of the plain level, for a breathy voice. */
  air?: number;
}

/** Sound effects play at this share of the master level. Whorl's battle hit sat 3 dB under its music and peaked about 5 dB over it, and these match. */
export const SFX_LEVEL = 0.31;

type X = Partial<Vc>;
const sine = (f: number | number[], d: number, v: number, x: X = {}): Vc => ({ w: 'sine', f: ([] as number[]).concat(f), d, v, ...x });
const tri = (f: number | number[], d: number, v: number, x: X = {}): Vc => ({ w: 'triangle', f: ([] as number[]).concat(f), d, v, ...x });
const sqr = (f: number | number[], d: number, v: number, x: X = {}): Vc => ({ w: 'square', f: ([] as number[]).concat(f), d, v, ...x });
const saw = (f: number | number[], d: number, v: number, x: X = {}): Vc => ({ w: 'saw', f: ([] as number[]).concat(f), d, v, ...x });
const pls = (f: number | number[], d: number, v: number, x: X = {}): Vc => ({ w: 'pulse', f: ([] as number[]).concat(f), d, v, ...x });
const noi = (f: number | number[], d: number, v: number, q = 1, x: X = {}): Vc => ({ w: 'noise', f: ([] as number[]).concat(f), d, v, q, ...x });

/** A sound repeated n more times at gaps, each softer and a little lower. */
function echoes(v: Vc, n: number, gap: number, decay: number, drop = 0.97): Vc[] {
  const out: Vc[] = [v];
  for (let i = 1; i <= n; i++) out.push({ ...v, at: (v.at ?? 0) + gap * i, v: v.v * Math.pow(decay, i), f: v.f.map((x) => x * Math.pow(drop, i)) });
  return out;
}

/** Unmaking: grains that thin out and fall, each gap longer than the last, as if time were stretching. */
function grains(): Vc[] {
  const out: Vc[] = [];
  for (let i = 0; i < 12; i++) {
    const f = 1500 * Math.pow(0.84, i);
    out.push(sine([f, f * 0.8], 0.05 + i * 0.012, 0.2 * (1 - i / 13), { at: 0.05 * Math.pow(i, 1.4), fm: [1.5, 1.2, 0], a: 0.004 }));
  }
  return out;
}

// ---------------------------------------------------------------- tuning

/** A key as pitch classes: its root and the pitch classes of its scale. Whorl's effects and voices were pitched to the music's key this way. */
export interface Tuning { root: number; scale: number[] }

/** The Pilgrim's key (A aeolian), used when no music plays. */
export const DEFAULT_TUNING: Tuning = { root: 9, scale: [9, 11, 0, 2, 4, 5, 7] };

export function tuningOf(h: { root: number; scale: number[] } | null | undefined): Tuning {
  return h && h.scale.length >= 3 ? { root: h.root, scale: h.scale } : DEFAULT_TUNING;
}

const mtof = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
export const ftom = (f: number): number => 69 + 12 * Math.log2(f / 440);

/** The scale as semitone steps above the root, lowest first. */
function above(T: Tuning): number[] {
  return [...new Set(T.scale.map((p) => (((p - T.root) % 12) + 12) % 12).concat(0))].sort((a, b) => a - b);
}

/** The MIDI note of scale degree i above the root in an octave, where octave 4 holds middle C. A degree past the scale's length climbs an octave. */
export function scaleNote(T: Tuning, i: number, oct: number): number {
  const s = above(T), L = s.length, o = Math.floor(i / L);
  return 12 * (oct + 1) + T.root + s[i - o * L] + 12 * o;
}

/** The nearest note of the scale to a MIDI pitch. */
export function snapMidi(m: number, T: Tuning): number {
  const s = above(T), base = Math.floor((m - T.root) / 12);
  let best = m, bd = 99;
  for (let o = base - 1; o <= base + 1; o++) for (const x of s) { const p = T.root + x + 12 * o; if (Math.abs(p - m) < bd) { bd = Math.abs(p - m); best = p; } }
  return best;
}

// ---------------------------------------------------------------- stingers

export type StingerId = 'victory' | 'defeat' | 'state_up';
export const STINGER_IDS: readonly StingerId[] = ['victory', 'defeat', 'state_up'];

/**
 * A short musical stinger in the key now sounding. Victory climbs the tonic chord with a raised third and rests on a sixth, so it is
 * bright and still a little wistful. Defeat falls through the key and sags on its last note. The music ducks while either plays.
 */
/** Level of each stinger, set by rendering them over the music: the music dips 16 dB under them, and they peak a few decibels over it. */
const STING_GAIN: Record<StingerId, number> = { victory: 0.8, defeat: 0.6, state_up: 2 };

export function stingerVoices(id: StingerId, T: Tuning): Vc[] {
  return stingerRaw(id, T).map((v) => ({ ...v, v: v.v * STING_GAIN[id] }));
}

function stingerRaw(id: StingerId, T: Tuning): Vc[] {
  const R = scaleNote(T, 0, 4);
  const f = (m: number): number => mtof(m);
  if (id === 'victory') {
    return [
      pls(f(R), 0.1, 0.17, { a: 0.002 }), pls(f(R), 0.1, 0.17, { at: 0.12, a: 0.002 }), pls(f(R + 4), 0.1, 0.17, { at: 0.24, a: 0.002 }), pls(f(R + 7), 0.1, 0.17, { at: 0.36, a: 0.002 }),
      pls(f(R + 12), 0.9, 0.15, { at: 0.5, a: 0.004, vib: [6, 14] }), pls(f(R + 16), 0.8, 0.07, { at: 0.5, a: 0.02 }),
      tri(f(R - 24), 0.9, 0.3, { at: 0.5, a: 0.01 }), sine(f(R + 19), 0.8, 0.07, { at: 0.5, a: 0.02, fm: [2, 0.8, 0] }),
      sine(f(R + 21), 0.7, 0.06, { at: 0.5, a: 0.06, fm: [3.5, 1.2, 0] }),
      sine(f(R + 28), 0.3, 0.05, { at: 0.64, fm: [2.76, 1.2, 0] }), sine(f(R + 31), 0.3, 0.04, { at: 0.76, fm: [2.76, 1.2, 0] }),
    ];
  }
  if (id === 'defeat') {
    const line = [R + 7, R + 3, R + 2];
    const out: Vc[] = line.map((m, i) => pls(f(m), 0.27, 0.15, { at: i * 0.28, a: 0.004, wide: 22, lp: [[3000, 1400], 1] }));
    out.push(
      pls([f(R), f(R) * 0.93], 0.85, 0.15, { at: 0.84, a: 0.01, wide: 22, vib: [4, 35], lp: [[2400, 700], 1] }),
      tri(f(R - 24), 0.9, 0.3, { at: 0.84, a: 0.02 }), tri([f(R - 12), f(R - 12) * 0.9], 0.8, 0.14, { at: 0.84 }),
      sine([70, 38], 0.5, 0.3, { at: 0.84 }), noi([2600, 200], 0.7, 0.07, 1.2, { at: 0.5, a: 0.1 }),
    );
    return out;
  }
  const up = [0, 2, 4].map((i) => f(scaleNote(T, i, 5)));
  return [
    pls(up[0], 0.07, 0.14, { a: 0.002 }), pls(up[1], 0.07, 0.14, { at: 0.07, a: 0.002 }), pls(up[2], 0.1, 0.14, { at: 0.14, a: 0.002 }),
    sine(f(scaleNote(T, 7, 5)), 0.32, 0.1, { at: 0.21, fm: [3.5, 1.6, 0] }), sine(f(scaleNote(T, 9, 6)), 0.2, 0.05, { at: 0.3, fm: [2.76, 1.2, 0] }),
  ];
}

export const SFX_DEFS: Record<SfxId, Vc[]> = {
  move: [tri([1500, 1700], 0.03, 0.22, { j: 0.03 })],
  confirm: [pls(660, 0.07, 0.22), pls([990, 1100], 0.09, 0.22, { at: 0.06 }), sine(1980, 0.12, 0.06, { at: 0.06, fm: [2, 0.6, 0] })],
  cancel: [tri([700, 420], 0.1, 0.26), tri([520, 340], 0.12, 0.22, { at: 0.07 })],
  buzz: [saw([110, 104], 0.22, 0.22, { trem: [38, 0.7], lp: [[900, 500], 3], wide: 23 }), sqr(55, 0.22, 0.12)],
  step: [noi([2400, 1700], 0.03, 0.22, 2.5, { j: 0.25 })],
  door: [noi([300, 900, 500], 0.28, 0.35, 1.5, { a: 0.05 }), saw([90, 140, 100], 0.3, 0.14, { lp: [[400, 250], 2], vib: [7, 40] }), noi(120, 0.08, 0.5, 1, { at: 0.28 })],
  portal: [sine([220, 1760], 0.8, 0.2, { fm: [1.5, 3, 0], vib: [9, 60, 24], a: 0.2 }), sine([330, 2640], 0.8, 0.12, { fm: [2.01, 2, 0], a: 0.3, at: 0.05 }), noi([800, 6000], 0.7, 0.16, 2, { a: 0.3 })],
  strip: [
    noi([6200, 4000], 0.03, 0.5, 2.5, { hp: 3000 }), noi([5200, 3600], 0.03, 0.45, 3, { at: 0.05, hp: 3000 }), noi([4800, 3000], 0.04, 0.45, 3, { at: 0.13, hp: 2500 }),
    sine(2400, 0.5, 0.1, { at: 0.02, fm: [2.76, 2.6, 0.2] }), sine(3100, 0.4, 0.07, { at: 0.06, fm: [2.76, 2, 0.2] }),
    tri([220, 70], 0.2, 0.3, { at: 0.13 }), noi([700, 200], 0.2, 0.28, 1, { at: 0.13 }),
  ],
  extract_memory: [
    noi([3400, 2400], 0.25, 0.18, 0.7, { a: 0.1 }), noi([2900, 2000], 0.25, 0.12, 0.7, { a: 0.1, at: 0.24 }), noi([2400, 1700], 0.25, 0.07, 0.7, { a: 0.1, at: 0.48 }),
    sine([880, 660], 0.3, 0.07, { a: 0.1, fm: [1.5, 0.5, 0] }), sine([660, 500], 0.3, 0.05, { a: 0.1, at: 0.24 }), sine([500, 390], 0.3, 0.03, { a: 0.1, at: 0.48 }),
  ],
  extract_emotion: [
    noi([1500, 2600], 0.22, 0.3, 0.8, { a: 0.15, cut: 0.22, hp: 800 }),
    sine([62, 58], 0.7, 0.34, { at: 0.24, a: 0.05 }), sine([124, 116], 0.6, 0.1, { at: 0.24, a: 0.05 }),
  ],
  extract_name: [
    saw([220, 250, 215], 0.42, 0.12, { lp: [[800, 1250, 500], 5], a: 0.03, vib: [5.5, 20] }),
    saw([220, 250, 215], 0.42, 0.07, { lp: [[1700, 2400, 900], 6], a: 0.03, vib: [5.5, 20] }),
    sine(1760, 0.2, 0.04, { at: 0.34, fm: [3, 1, 0] }),
  ],
  absorb: [sine([180, 720], 0.35, 0.22, { fm: [2, 1.2, 0.1], trem: [9, 0.4] }), sine([360, 1100], 0.28, 0.1, { at: 0.1, trem: [14, 0.5] }), noi([400, 2500], 0.3, 0.1, 1.5, { a: 0.1 })],
  weave: [tri([300, 900], 0.45, 0.18, { vib: [8, 30] }), tri([900, 300], 0.45, 0.18, { vib: [8, 30] }), sine(1200, 0.3, 0.07, { at: 0.3, fm: [2, 1.5, 0] })],
  unmake: [
    ...grains(),
    noi([3000, 200], 1.4, 0.12, 1.2, { a: 0.1 }), sine([90, 30], 0.5, 0.3, { at: 1.1 }), sine([700, 90], 1.4, 0.07, { vib: [4, 60, 1] }),
  ],
  hit: [noi([1500, 600], 0.06, 0.5, 1.2), sqr([240, 80], 0.09, 0.24, { lp: [[2600, 200], 6] })],
  hurt: [saw([330, 95], 0.22, 0.24, { lp: [[3200, 250], 5], wide: 30, vib: [18, 80] }), noi([1200, 300], 0.18, 0.34, 0.9)],
  vorn_hit: [
    sqr([120, 48], 0.24, 0.34, { lp: [[1800, 150], 4] }), noi([900, 150], 0.22, 0.45, 0.8), sine([1500, 1100], 0.3, 0.1, { fm: [2.76, 2.4, 0.1], at: 0.02 }), tri([60, 35], 0.3, 0.34),
  ],
  miss: [noi([3200, 900], 0.16, 0.2, 1.2, { a: 0.05 })],
  float: [sine([320, 520, 480], 0.55, 0.2, { vib: [6, 30], a: 0.15, trem: [7, 0.3] }), sine([640, 1040], 0.5, 0.06, { a: 0.2 })],
  slide: [noi([600, 3000, 700], 0.25, 0.2, 1.8, { a: 0.06 }), tri([420, 180], 0.25, 0.18)],
  overload: [
    saw([220, 330], 0.8, 0.17, { wide: 40, trem: [7, 0.5, 28], lp: [[600, 3500], 5], a: 0.1 }), saw([233, 350], 0.8, 0.13, { wide: -35, trem: [9, 0.5, 31], lp: [[600, 3500], 5] }),
    noi([1000, 7000], 0.8, 0.16, 2, { a: 0.5 }), noi(5000, 0.06, 0.45, 1, { at: 0.76 }),
  ],
  fade: [sine([700, 180], 0.85, 0.18, { vib: [5, 40], a: 0.05 }), noi([2500, 400], 0.8, 0.09, 1, { a: 0.1 }), sine([1400, 360], 0.8, 0.05)],
  unravel: [
    sine([440, 300], 1.6, 0.13, { wide: 50, vib: [3, 70, 9], a: 0.2 }), saw([233, 150], 1.6, 0.09, { lp: [[2000, 300], 3], wide: -45, trem: [5, 0.5, 15] }),
    noi([4000, 200], 1.7, 0.12, 1.4, { a: 0.4 }), sine([1400, 80], 1.8, 0.08, { fm: [1.37, 3, 0], at: 0.1 }), sine(60, 0.5, 0.28, { at: 1.3 }),
  ],
  shell_get: [sine(2400, 0.5, 0.14, { fm: [2.76, 2.4, 0.1] }), sine(3200, 0.45, 0.1, { at: 0.08, fm: [2.76, 2.2, 0.1] }), noi([6500, 5000], 0.03, 0.26, 3)],
  memory_get: [
    sine(523, 0.6, 0.16, { fm: [2, 1.2, 0.05], a: 0.01 }), sine(784, 0.6, 0.12, { at: 0.1, fm: [2, 1.1, 0.05] }),
    sine(523, 0.4, 0.05, { at: 0.35 }), sine(784, 0.4, 0.04, { at: 0.45 }),
  ],
  emotion_get: [tri([330, 415], 0.6, 0.18, { trem: [10, 0.5], a: 0.1 }), tri([415, 523], 0.6, 0.14, { trem: [10, 0.5], a: 0.12, at: 0.06 }), sine(660, 0.5, 0.07, { a: 0.15 })],
  name_get: [sine([440, 660], 0.3, 0.14, { fm: [1, 1.4, 0], a: 0.02, vib: [7, 30] }), sine([880, 1320], 0.3, 0.09, { at: 0.12, fm: [3, 1, 0] }), sine(1760, 0.25, 0.05, { at: 0.22 })],
  concept_get: [523, 659, 784, 1047].flatMap((f, i) => [
    sine(f, 0.3, 0.12, { at: i * 0.085, fm: [2, 1.2, 0.1] }), sine(f * 1.0293, 0.3, 0.07, { at: i * 0.085 + 0.02, fm: [2, 1.2, 0.1] }),
  ]).concat([sine(2094, 0.3, 0.05, { at: 0.34, fm: [2.76, 1.4, 0] })]),
  steady: [sine([220, 224], 0.8, 0.2, { a: 0.15 }), sine([330, 334], 0.8, 0.14, { a: 0.2 }), sine(440, 0.7, 0.07, { a: 0.25, fm: [2, 0.6, 0] }), sine(1320, 0.4, 0.04, { at: 0.3, fm: [2.76, 1.5, 0] })],
  sense: [sine([880, 1320], 0.22, 0.16, { fm: [1.5, 1, 0], vib: [8, 20] }), sine(1760, 0.18, 0.05, { at: 0.1 })],
  true_sight: [sine([500, 2000], 0.45, 0.16, { a: 0.05, fm: [1.5, 2, 0] }), pls([800, 3200], 0.4, 0.07, { at: 0.05 }), sine(2400, 0.3, 0.09, { at: 0.3, fm: [2.76, 2, 0] }), sine(3600, 0.25, 0.06, { at: 0.38, fm: [2.76, 2, 0] })],
  echo: echoes(sine(660, 0.15, 0.18, { fm: [2, 1, 0] }), 3, 0.2, 0.6),
  savor: [sine([300, 480, 330], 0.12, 0.2), sine([260, 420, 290], 0.12, 0.18, { at: 0.14 }), noi([700, 300], 0.08, 0.16, 2, { at: 0.02 }), sine([660, 880], 0.2, 0.09, { at: 0.28, vib: [6, 20] })],
  scent: [noi([900, 2600], 0.1, 0.26, 1.8, { a: 0.02 }), noi([800, 2800], 0.12, 0.26, 1.8, { at: 0.14, a: 0.02 }), sine([1200, 1500], 0.3, 0.07, { at: 0.28, a: 0.1 })],
  insight: [sine(880, 0.2, 0.15, { fm: [3.5, 1.4, 0.05] }), sine(1175, 0.2, 0.15, { at: 0.08, fm: [3.5, 1.4, 0.05] }), sine(1568, 0.35, 0.15, { at: 0.16, fm: [3.5, 1.4, 0.05] })],
  handshake: [tri([300, 400], 0.35, 0.18, { a: 0.04 }), tri([520, 400], 0.35, 0.18, { a: 0.04 }), noi(1200, 0.04, 0.22, 1.5, { at: 0.3 }), sine(800, 0.25, 0.08, { at: 0.3, fm: [2, 0.8, 0] })],
  silence: [noi([4000, 300], 0.3, 0.26, 0.7, { a: 0.28, cut: 0.3 }), sine(41, 0.64, 0.36, { at: 0.34, a: 0.1 }), sine(82, 0.6, 0.09, { at: 0.34, a: 0.1 })],
  devour: [
    saw([140, 55], 0.5, 0.22, { lp: [[1200, 150], 5], fm: [0.5, 2, 0], vib: [11, 60] }), noi([1500, 150], 0.45, 0.26, 0.8, { a: 0.1 }), sine([300, 60], 0.35, 0.18, { at: 0.05 }), sine([200, 70], 0.12, 0.28, { at: 0.5 }),
  ],
  void_touch: [
    sine([49, 48.5], 1, 0.34, { a: 0.15 }), sine([73.5, 74.3], 1, 0.26, { a: 0.2 }), sine([98, 97], 0.9, 0.18, { a: 0.2, fm: [1.41, 2.5, 0.1] }), sine([310, 300], 0.8, 0.045, { a: 0.3, fm: [2.76, 3, 0], vib: [3, 90] }),
  ],
  gear: [noi([800, 600], 0.05, 0.45, 4, { j: 0.2 }), noi(500, 0.04, 0.36, 5, { at: 0.07 }), sine(1900, 0.1, 0.08, { fm: [2.76, 3, 0] }), noi(900, 0.05, 0.4, 4, { at: 0.14 })],
  bird: [0, 1, 2].flatMap((k) => [sine([2100 + 200 * k, 3300 + 300 * k, 2800], 0.09, 0.14, { at: k * 0.14, fm: [1.5, 1.2, 0], vib: [40, 100] }), noi(6000, 0.012, 0.16, 2, { at: k * 0.14 })]),
  storm: [noi([400, 150], 0.9, 0.34, 0.5, { a: 0.2 }), noi([6000, 3500], 0.08, 0.22, 2, { at: 0.15 }), noi(5000, 0.05, 0.2, 2, { at: 0.4 }), sine([55, 40], 0.8, 0.28, { at: 0.1 })],
  paper: [noi([4000, 2500, 3800], 0.22, 0.26, 1.2, { a: 0.04 }), noi(5200, 0.05, 0.18, 1.2, { at: 0.12 }), noi(3000, 0.05, 0.22, 1.2, { at: 0.2 })],
  typewriter: [
    noi(2300, 0.03, 0.45, 1.6), tri([220, 120], 0.04, 0.26), noi(2300, 0.03, 0.4, 1.6, { at: 0.09 }), tri([220, 120], 0.04, 0.22, { at: 0.09 }),
    noi(2300, 0.03, 0.4, 1.6, { at: 0.18 }), tri([220, 120], 0.04, 0.22, { at: 0.18 }), sine(2640, 0.35, 0.09, { at: 0.3, fm: [4.13, 2, 0] }),
  ],
  crystal: [sine(2093, 0.7, 0.13, { fm: [5.19, 2.4, 0.05] }), sine(3136, 0.6, 0.09, { at: 0.06, fm: [5.19, 2.4, 0.05] }), sine(3151, 0.6, 0.07, { at: 0.06, fm: [5.19, 2.4, 0.05] }), sine(4186, 0.5, 0.045, { at: 0.12, fm: [2.76, 2, 0] })],
  riddle: [tri(330, 0.22, 0.18), tri(392, 0.22, 0.18, { at: 0.2 }), tri([523, 560, 600], 0.45, 0.18, { at: 0.4, vib: [7, 50] })],
  state_up: stingerVoices('state_up', DEFAULT_TUNING),
  victory: stingerVoices('victory', DEFAULT_TUNING),
  defeat: stingerVoices('defeat', DEFAULT_TUNING),
  cook: [noi([6000, 3500], 0.3, 0.2, 0.8, { a: 0.02, hp: 4000 }), sine([600, 900], 0.08, 0.16, { at: 0.05 }), sine([700, 1050], 0.08, 0.16, { at: 0.15 }), pls(1100, 0.06, 0.12, { at: 0.24 })],
  heal: [sine(392, 0.3, 0.13, { fm: [2, 0.8, 0] }), sine(494, 0.3, 0.13, { at: 0.08, fm: [2, 0.8, 0] }), sine(587, 0.3, 0.13, { at: 0.16, fm: [2, 0.8, 0] }), sine(784, 0.45, 0.13, { at: 0.24, fm: [2, 0.8, 0] }), sine(1568, 0.4, 0.04, { at: 0.28, fm: [2.76, 1.5, 0] })],
  rename: [noi(2300, 0.03, 0.4, 1.6), noi(2300, 0.03, 0.4, 1.6, { at: 0.1 }), sine([440, 660], 0.25, 0.14, { at: 0.2, fm: [1, 1.4, 0], vib: [7, 25] }), sine(880, 0.3, 0.09, { at: 0.3, fm: [3, 1.2, 0] })],
  quake: [noi([140, 90], 0.9, 0.5, 0.5, { a: 0.05 }), sine([42, 34], 0.9, 0.36, { trem: [14, 0.6] }), noi(2500, 0.04, 0.22, 1, { at: 0.2 }), noi(2200, 0.05, 0.22, 1, { at: 0.5 })],
};

/** Level trims measured by rendering every effect offline, so all effects peak between 0.05 and 0.25. */
const SFX_TRIM: Partial<Record<SfxId, number>> = {
  vorn_hit: 0.5, void_touch: 0.55, strip: 0.85, extract_emotion: 0.8, silence: 0.8, typewriter: 0.85, hit: 0.85, hurt: 0.85, handshake: 0.9,
  step: 0.7, move: 0.5, confirm: 0.6, cancel: 0.6, miss: 1.4, gear: 1.3, scent: 1.7, door: 1.3, name_get: 1.2, concept_get: 1.2, heal: 1.2, memory_get: 1.15,
};
for (const [id, k] of Object.entries(SFX_TRIM) as Array<[SfxId, number]>) for (const v of SFX_DEFS[id]) v.v *= k;

/** Effects that may run past one second. */
export const LONG_SFX: ReadonlySet<SfxId> = new Set<SfxId>(['unmake', 'unravel', 'victory', 'defeat']);

/** The length of an effect in seconds. */
export function sfxLength(id: SfxId): number {
  return SFX_DEFS[id].reduce((m, v) => Math.max(m, (v.at ?? 0) + v.d), 0);
}

/**
 * Effects that duck the music: the depth it drops to (1 is no duck), how long it holds, and how long it takes to come back. The dips
 * are quick going down and slow coming back, so the music is not cut off. Silence and emotion neutralization drop it almost to nothing.
 */
export const DUCKS: Partial<Record<SfxId, readonly [number, number, number]>> = {
  victory: [0.16, 1.1, 1.1], defeat: [0.1, 1.3, 1.6], state_up: [0.5, 0.35, 0.5],
  portal: [0.45, 0.5, 0.7], unmake: [0.3, 1.0, 1.1], unravel: [0.25, 1.3, 1.3], overload: [0.5, 0.5, 0.7], void_touch: [0.3, 0.9, 1.1],
  silence: [0.08, 0.4, 1.0], extract_emotion: [0.12, 0.35, 0.9], quake: [0.45, 0.6, 0.8], devour: [0.45, 0.4, 0.7], true_sight: [0.6, 0.3, 0.6],
  steady: [0.55, 0.5, 0.8], concept_get: [0.5, 0.4, 0.7], name_get: [0.65, 0.2, 0.5], extract_name: [0.6, 0.3, 0.6], extract_memory: [0.6, 0.3, 0.7],
  riddle: [0.6, 0.4, 0.6], fade: [0.5, 0.5, 0.9], storm: [0.5, 0.5, 0.8], strip: [0.7, 0.12, 0.4],
};

/** Effects that bend the music's pitch down once and let it back: cents, seconds down, seconds held, seconds back. */
export const BENDS: Partial<Record<SfxId, readonly [number, number, number, number]>> = {
  unmake: [200, 0.5, 0.3, 1.2], unravel: [320, 0.6, 0.6, 1.5], void_touch: [150, 0.6, 0.4, 1.2], quake: [100, 0.15, 0.1, 0.6],
};

/** Effects whose notes move to the nearest note of the music's scale, so they never clash with the track under them. */
export const TUNED: ReadonlySet<SfxId> = new Set<SfxId>([
  'move', 'confirm', 'cancel', 'memory_get', 'emotion_get', 'name_get', 'concept_get', 'steady', 'sense', 'true_sight', 'echo', 'insight',
  'handshake', 'heal', 'crystal', 'riddle', 'shell_get', 'float', 'rename', 'savor', 'extract_name',
]);

/** Moves an effect's tonal voices together so its first note lands on a note of the key. Noise voices stay put. At most a fifth either way. */
export function retune(vcs: Vc[], T: Tuning): Vc[] {
  const ref = vcs.find((v) => v.w !== 'noise');
  if (!ref) return vcs;
  const m = ftom(ref.f[0]);
  const r = Math.pow(2, Math.max(-7, Math.min(7, snapMidi(m, T) - m)) / 12);
  if (Math.abs(r - 1) < 1e-4) return vcs;
  return vcs.map((v) => (v.w === 'noise' ? v : { ...v, f: v.f.map((x) => x * r) }));
}
