// Sound effects: small synth patches built from layers (oscillators, FM pairs, noise, glides, vibrato, tremolo,
// filter sweeps), played through a short room and a punchy compressor on the effects bus. Every call varies a little,
// so repeated sounds are never identical, and footsteps walk their pitch slowly from step to step.
// Musical stings read the key the music is in, so they sit in harmony with it.
import { audioCtx, isMuted, onAudioReady, sfxOut } from './core';
import { music } from './music';

type W = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'pulse';

export interface Layer {
  w: W;
  /** Start frequency in Hz. Noise ignores it. */
  f?: number;
  /** End frequency of a glide. */
  f2?: number;
  /** Glide time in seconds. Defaults to the layer's length. */
  glide?: number;
  d: number;
  g: number;
  a?: number;
  /** Delay from the call, in seconds. */
  at?: number;
  env?: 'perc' | 'hold' | 'swell' | 'rev';
  /** Vibrato rate in Hz and depth in cents. `vib2` is the rate it reaches by the end. */
  vib?: readonly [number, number];
  vib2?: number;
  /** Tremolo rate in Hz and depth from 0 to 1. */
  am?: readonly [number, number];
  /** FM ratio, index at the start, and index at the end. */
  fm?: readonly [number, number, number?];
  lp?: number;
  lp2?: number;
  q?: number;
  hp?: number;
  bp?: number;
  bp2?: number;
  bq?: number;
  pan?: number;
  pan2?: number;
  det?: number;
  /** Send to the effects room. */
  room?: number;
}

export interface SfxOpts { pitch?: number; pan?: number; vol?: number }
type Rand = () => number;
type Patch = (r: Rand, o: { key: number[] }) => Layer[];

const T = (w: W, f: number, d: number, g: number, x: Partial<Layer> = {}): Layer => ({ w, f, d, g, ...x });
const N = (d: number, g: number, x: Partial<Layer> = {}): Layer => ({ w: 'noise', d, g, ...x });
const between = (r: Rand, a: number, b: number) => a + (b - a) * r();
const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Short grains scattered over `span` seconds, for scratches, crackles, bubbles, and crunches. */
function grains(r: Rand, n: number, span: number, make: (k: number) => Layer): Layer[] {
  const out: Layer[] = [];
  for (let k = 0; k < n; k++) { const l = make(k); out.push({ ...l, at: (l.at ?? 0) + r() * span }); }
  return out;
}

/** An FM bell note at a MIDI pitch. */
const bell = (n: number, d: number, g: number, at = 0, ratio = 2, x: Partial<Layer> = {}): Layer =>
  T('sine', mtof(n), d, g, { at, fm: [ratio, 1.6, 0], room: 0.55, ...x });

/** Slow random walks per sound, so footsteps drift in pitch instead of repeating. */
const walks: Record<string, number> = {};
let foot = 0;
function stepVar(r: Rand, name: string): number {
  const w = Math.max(-1, Math.min(1, (walks[name] ?? 0) + (r() - 0.5) * 0.5));
  walks[name] = w;
  foot ^= 1;
  return 1 + w * 0.06 + (foot ? 0.015 : -0.015);
}

function step(r: Rand, name: string, body: (v: number) => Layer[]): Layer[] {
  const v = stepVar(r, name);
  return body(v).map((l) => ({ ...l, pan: (l.pan ?? 0) + (foot ? 0.08 : -0.08) }));
}

/** A shot: a noise crack, a sine thump, a square snap, and a tail into the room. */
function shot(r: Rand, at: number, crack: number, thump: number, g: number, tail: number): Layer[] {
  return [
    N(0.05, 0.55 * g, { at, bp: crack * between(r, 0.95, 1.05), bp2: crack * 0.4, bq: 0.8, lp: 7000 }),
    T('sine', thump, 0.12, 0.6 * g, { at, f2: thump * 0.3, a: 0.001 }),
    T('square', crack * 0.42, 0.03, 0.16 * g, { at, f2: crack * 0.14, lp: 3200 }),
    N(tail, 0.08 * g, { at: at + 0.03, lp: 2600, lp2: 500, room: 0.55 }),
  ];
}

const PATCHES: Record<string, Patch> = {
  // ---------------------------------------------------------------- interface
  blip: (r) => [T('sine', between(r, 1050, 1250), 0.05, 0.2, { f2: 1500, vib: [24, 40] }), T('triangle', 2400, 0.03, 0.04)],
  cursor: () => [T('sine', 880, 0.045, 0.15, { f2: 980, vib: [30, 35] }), N(0.008, 0.08, { bp: 4000, bq: 3 })],
  confirm: (r, o) => [
    T('sine', mtof(o.key[4] + 12), 0.12, 0.17, { fm: [2, 1.2, 0], vib: [9, 14] }),
    T('sine', mtof(o.key[7] + 12), 0.16, 0.17, { at: 0.06, fm: [2, 1.2, 0], vib: [9, 14] }),
  ],
  cancel: () => [T('square', 700, 0.12, 0.11, { f2: 380, lp: 1800, vib: [10, 30] }), T('sine', 520, 0.14, 0.13, { f2: 260, vib: [8, 40] })],
  menu: () => [N(0.14, 0.12, { bp: 900, bp2: 3000, bq: 1.2 }), T('sine', 440, 0.16, 0.14, { f2: 880, fm: [1.5, 1, 0], vib: [7, 25] })],
  toast: (r, o) => [
    T('sine', mtof(o.key[4] + 12), 0.08, 0.12, { vib: [12, 15] }),
    T('sine', mtof(o.key[9] + 12), 0.16, 0.12, { at: 0.07, fm: [3, 0.8, 0], room: 0.4 }),
  ],
  error: () => [
    T('square', 180, 0.1, 0.15, { f2: 160, fm: [0.5, 2, 1], lp: 900, vib: [8, 40] }),
    T('square', 150, 0.14, 0.15, { at: 0.11, f2: 120, fm: [0.5, 2, 1], lp: 800, vib: [8, 40] }),
  ],
  talk: () => [T('sine', 300, 0.12, 0.18, { f2: 620, vib: [9, 40] }), N(0.01, 0.1, { bp: 2500, bq: 2 }), T('triangle', 600, 0.06, 0.05, { at: 0.08, f2: 900 })],
  turn: (r, o) => [bell(o.key[0] + 12, 0.5, 0.13, 0), bell(o.key[4] + 12, 0.5, 0.09, 0.08, 2, { pan: 0.3 }), N(0.01, 0.08, { hp: 5000 })],
  save: (r, o) => [
    ...[4, 7, 9].map((d, i) => bell(o.key[d] + 12, 1, 0.14, i * 0.12)),
    ...[0, 4].map((d) => T('sine', mtof(o.key[d]), 1.1, 0.06, { at: 0.2, env: 'hold', a: 0.3, room: 0.6 })),
  ],
  // A new quest: three bells up the chord, then the seventh, held and leaning up, an open question like the port's.
  quest: (r, o) => [
    ...[0, 2, 4].map((d, i) => bell(o.key[d] + 12, 0.6, 0.14, i * 0.1)),
    T('sine', mtof(o.key[6] + 12), 1.0, 0.12, { at: 0.3, env: 'hold', a: 0.05, vib: [5, 18], f2: mtof(o.key[6] + 12) * 1.02, room: 0.6 }),
  ],
  // The port's cue: its figure at speed on an alien FM voice that beats against itself, stopping a step short.
  port: (r, o) => [
    ...[0, 2, 4, 5].map((d, i) => T('sine', mtof(o.key[d] + 12), 0.09, 0.13, { at: i * 0.06, fm: [1.41, 2.5, 0.5], vib: [16, 30], room: 0.3 })),
    T('sine', mtof(o.key[6] + 12), 0.7, 0.14, { at: 0.24, fm: [1.41, 2, 0.3], f2: mtof(o.key[6] + 12) * 1.02, vib: [6, 25], env: 'hold', a: 0.03, room: 0.5 }),
    T('sine', mtof(o.key[6] + 12) * 1.008, 0.7, 0.08, { at: 0.24, env: 'hold', a: 0.03, room: 0.5, pan: 0.4 }),
  ],
  levelup: (r, o) => [
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((d, i) => T('square', mtof(o.key[d] + 12), 0.1, 0.07, { at: i * 0.055, lp: 3000 })),
    ...[0, 2, 4, 7].map((d) => bell(o.key[d] + 12, 1.2, 0.1, 0.45)),
    ...grains(r, 6, 0.6, () => T('sine', between(r, 2500, 4500), 0.06, 0.04, { at: 0.45, room: 0.5 })),
  ],
  loot: (r, o) => [
    ...[0, 2, 4, 7].map((d, i) => T('triangle', mtof(o.key[d] + 12), 0.12, 0.16, { at: i * 0.06, vib: [10, 12] })),
    bell(o.key[9] + 12, 0.9, 0.16, 0.24),
    bell(o.key[7] + 12, 0.9, 0.1, 0.24, 2, { det: 6 }),
  ],
  buy: () => [
    T('square', 1200, 0.04, 0.08, { lp: 3000 }),
    T('sine', 1600, 0.25, 0.16, { at: 0.05, fm: [3, 1.5, 0], vib: [12, 12], room: 0.4 }),
    T('sine', 2400, 0.35, 0.14, { at: 0.12, fm: [3, 1.5, 0], vib: [12, 12], room: 0.4 }),
    N(0.03, 0.12, { bp: 5000, bq: 2 }),
  ],
  pass: (r, o) => [
    ...[0, 2, 4, 7].map((d, i) => bell(o.key[d] + 12, 0.6, 0.15, i * 0.07)),
    ...grains(r, 5, 0.4, () => T('sine', between(r, 2500, 4200), 0.05, 0.04, { at: 0.2, room: 0.5 })),
  ],
  fail: (r, o) => [
    T('triangle', mtof(o.key[2]), 0.2, 0.16, { vib: [6, 30] }),
    T('triangle', mtof(o.key[1]), 0.22, 0.15, { at: 0.17, vib: [6, 30] }),
    T('sawtooth', mtof(o.key[6] - 12), 0.45, 0.11, { at: 0.34, lp: 900, f2: mtof(o.key[6] - 12) * 0.94, vib: [5, 40] }),
  ],
  // Companion approval: a warm third rising. Disapproval: a wobbling step down below the tonic.
  approve: (r, o) => [
    bell(o.key[2] + 12, 0.5, 0.14, 0),
    bell(o.key[4] + 12, 0.6, 0.15, 0.09),
    T('sine', mtof(o.key[4]), 0.5, 0.06, { at: 0.09, env: 'hold', a: 0.1, room: 0.5 }),
  ],
  disapprove: (r, o) => [
    T('triangle', mtof(o.key[1] + 12), 0.16, 0.15, { vib: [7, 40] }),
    T('triangle', mtof(o.key[6]), 0.28, 0.15, { at: 0.13, f2: mtof(o.key[6]) * 0.95, vib: [5, 50], lp: 2000 }),
  ],
  // Spending Edge: a reversed swell, as if the roll were pulled back, then a bright bell.
  edge: (r, o) => [
    N(0.35, 0.14, { bp: 600, bp2: 4000, bq: 2, env: 'rev' }),
    T('sine', 300, 0.35, 0.1, { f2: 1200, env: 'rev', vib: [10, 30] }),
    bell(o.key[4] + 24, 0.8, 0.14, 0.35, 3.5),
  ],
  heal: (r, o) => [
    ...[0, 4, 9].map((d, i) => T('sine', mtof(o.key[d] + 12), 0.6, 0.1, { env: 'swell', vib: [5, 15], at: i * 0.05, room: 0.6 })),
    ...grains(r, 6, 0.5, () => T('sine', between(r, 2000, 4000), 0.05, 0.04, { room: 0.5 })),
  ],
  // A short clatter of small dice: a soft thud on the table, then hollow clicks that bounce closer and closer together.
  dice: (r) => {
    const out: Layer[] = [T('sine', 200, 0.06, 0.16, { f2: 120 })];
    const n = 5 + Math.floor(r() * 3);
    let at = 0;
    let gap = 0.09;
    for (let k = 0; k < n; k++) {
      const f = between(r, 1400, 2600);
      const g = between(r, 0.12, 0.2) * (1 - k / (n + 3));
      out.push(T('triangle', f, 0.03, g, { at, f2: f * 0.9, pan: between(r, -0.4, 0.4) }));
      out.push(N(0.012, g, { at, bp: between(r, 2500, 4500), bq: 3 }));
      at += gap * between(r, 0.8, 1.2);
      gap *= 0.8;
    }
    return out;
  },

  // ---------------------------------------------------------------- moving through the city
  // A footstep on wet ground: a soft thump and a little splash, drifting in pitch from step to step.
  step: (r) => step(r, 'step', (v) => [
    N(0.04, 0.14, { bp: between(r, 900, 1400) * v, bq: 1.4 }),
    T('sine', 150 * v, 0.05, 0.12, { f2: 100 * v }),
    N(0.05, 0.05, { at: 0.02, bp: between(r, 3000, 4500) * v, bq: 3 }),
  ]),
  door: () => [
    N(0.35, 0.22, { bp: 3000, bp2: 900, bq: 1 }),
    T('sawtooth', 220, 0.3, 0.06, { f2: 330, bp: 1000, bq: 4, vib: [6, 30] }),
    T('sine', 90, 0.12, 0.35, { at: 0.3, f2: 60 }),
    N(0.06, 0.2, { at: 0.3, lp: 800 }),
  ],
  jump: () => [T('sine', 300, 0.22, 0.16, { f2: 900, vib: [8, 40] }), N(0.18, 0.12, { bp: 800, bp2: 2500, bq: 1.5 })],
  fall: () => [
    T('sine', 900, 0.4, 0.14, { f2: 200, vib: [10, 60] }),
    T('sine', 110, 0.2, 0.4, { at: 0.38, f2: 50 }),
    N(0.12, 0.25, { at: 0.38, lp: 900 }),
  ],
  shove: () => [
    N(0.1, 0.3, { bp: 500, bp2: 250, bq: 1.2 }),
    T('sine', 130, 0.14, 0.4, { f2: 65 }),
    N(0.25, 0.12, { at: 0.05, bp: 1800, bp2: 900, bq: 3 }),
    T('sawtooth', 90, 0.12, 0.06, { lp: 500, vib: [20, 60] }),
  ],
  splash: (r) => [
    N(0.3, 0.4, { bp: 2400, bp2: 600, bq: 0.9 }),
    T('sine', 160, 0.12, 0.3, { f2: 70 }),
    ...grains(r, 6, 0.4, () => T('sine', between(r, 600, 1400), 0.04, 0.08, { f2: between(r, 1600, 2600), at: 0.08 })),
    N(0.4, 0.1, { at: 0.15, lp: 1500, lp2: 400 }),
  ],

  // ---------------------------------------------------------------- combat
  hit: () => [
    T('square', 200, 0.1, 0.25, { f2: 70, vib: [20, 40], lp: 2200 }),
    N(0.06, 0.28, { bp: 2000, bq: 1 }),
    T('sine', 120, 0.08, 0.28, { f2: 60 }),
  ],
  miss: () => [N(0.18, 0.2, { bp: 2200, bp2: 500, bq: 1.2 }), T('sine', 700, 0.12, 0.05, { f2: 350, vib: [12, 40] })],
  // A critical hit: a rip over a thump with a cracked top, a ringing bell, and a scatter of glitches.
  crit: (r) => [
    T('sine', 160, 0.18, 0.7, { f2: 45, a: 0.001 }),
    T('sawtooth', 220, 0.14, 0.38, { f2: 55, lp: 4000, lp2: 300, fm: [0.5, 3, 0] }),
    N(0.09, 0.5, { bp: 3500, bp2: 800, bq: 1.2 }),
    T('sine', 55, 0.25, 0.26, { at: 0.06 }),
    T('sine', 2800, 0.35, 0.1, { at: 0.01, fm: [3.3, 2, 0], room: 0.4 }),
    ...grains(r, 5, 0.14, () => T('square', between(r, 1500, 4000), 0.015, 0.05, { lp: 6000 })),
  ],
  pistol: (r) => shot(r, 0, 2200, 170, 1, 0.25),
  smg: (r) => [0, 0.065, 0.13, 0.195].flatMap((at, k) => shot(r, at, 2600 * (1 + k * 0.03), 210, 0.62, 0.12)),
  shotgun: () => [
    N(0.18, 0.68, { lp: 2200, lp2: 500 }),
    T('sine', 110, 0.3, 0.78, { f2: 34, a: 0.001 }),
    N(0.04, 0.32, { bp: 1500, bq: 0.7 }),
    T('sawtooth', 70, 0.2, 0.14, { lp: 400 }),
    N(0.4, 0.1, { at: 0.05, lp: 1800, lp2: 300, room: 0.6 }),
    // The pump: two clacks.
    N(0.03, 0.17, { at: 0.42, bp: 2200, bq: 3 }), T('triangle', 500, 0.03, 0.12, { at: 0.42, f2: 400 }),
    N(0.03, 0.19, { at: 0.52, bp: 1800, bq: 3 }), T('triangle', 420, 0.03, 0.12, { at: 0.52, f2: 330 }),
  ],
  rifle: () => [
    N(0.04, 0.58, { hp: 1800, lp: 8000 }),
    T('sine', 140, 0.18, 0.7, { f2: 40, a: 0.001 }),
    T('square', 1600, 0.025, 0.14, { f2: 500, lp: 4000 }),
    N(0.5, 0.12, { at: 0.04, lp: 3000, lp2: 400, room: 0.7 }),
    // The crack comes back off a wall a moment later.
    N(0.04, 0.17, { at: 0.16, bp: 1600, bq: 0.8, room: 0.6, pan: 0.4 }),
  ],
  melee: () => [
    N(0.12, 0.2, { bp: 700, bp2: 2600, bq: 1.5 }),
    T('sine', 140, 0.12, 0.5, { at: 0.1, f2: 60 }),
    N(0.05, 0.3, { at: 0.1, bp: 1500, bq: 1 }),
    T('sine', 1900, 0.22, 0.06, { at: 0.1, fm: [2.7, 2, 0], room: 0.3 }),
  ],
  shock: (r) => [
    T('square', 120, 0.4, 0.14, { fm: [3.1, 8, 2], am: [30, 0.8], lp: 4000 }),
    ...grains(r, 10, 0.4, () => N(between(r, 0.004, 0.01), 0.3, { hp: 3000 })),
    T('sawtooth', 60, 0.4, 0.1, { vib: [50, 80], lp: 800 }),
  ],
  hack: (r) => [
    ...Array.from({ length: 8 }, (_, k) => T('square', between(r, 500, 2500), 0.035, 0.08, { at: k * 0.04, lp: 5000, pan: between(r, -0.5, 0.5) })),
    T('sine', 1200, 0.35, 0.08, { f2: 2400, fm: [0.5, 3, 0.5], at: 0.05, vib: [20, 50] }),
    N(0.3, 0.05, { bp: 4000, bq: 4, am: [40, 1] }),
  ],
  explode: (r) => [
    T('sine', 90, 0.8, 0.88, { f2: 28, a: 0.002 }),
    N(0.9, 0.62, { lp: 3000, lp2: 200 }),
    N(0.08, 0.45, { bp: 1200, bq: 0.6 }),
    ...grains(r, 12, 0.8, () => N(between(r, 0.005, 0.015), between(r, 0.1, 0.22), { hp: 2000, at: 0.1 })),
    T('sawtooth', 50, 0.6, 0.14, { lp: 300, vib: [6, 40] }),
  ],
  guard: () => [
    T('sine', 300, 0.3, 0.24, { fm: [1.414, 4, 0] }),
    T('sine', 130, 0.1, 0.25, { f2: 80, lp: 1500 }),
    T('sawtooth', 110, 0.4, 0.06, { am: [12, 0.6], lp: 600, vib: [4, 20] }),
  ],
  foam: (r) => [
    N(0.6, 0.2, { bp: 1800, bp2: 900, bq: 0.8, env: 'swell' }),
    ...grains(r, 16, 0.6, () => T('sine', between(r, 500, 1500), 0.03, 0.06, { f2: between(r, 1500, 3000), pan: between(r, -0.5, 0.5) })),
  ],
  smoke: () => [
    T('sine', 400, 0.06, 0.25, { f2: 150 }),
    N(1.2, 0.22, { at: 0.04, bp: 1500, bp2: 700, bq: 0.7, env: 'swell' }),
    N(1.1, 0.1, { at: 0.06, hp: 4000, am: [9, 0.4] }),
  ],
  fire: (r) => [
    N(0.4, 0.3, { bp: 500, bp2: 1800, bq: 1 }),
    N(1.0, 0.2, { lp: 700, am: [7, 0.6], at: 0.1 }),
    ...grains(r, 10, 1.0, () => N(between(r, 0.004, 0.01), between(r, 0.12, 0.25), { hp: 2500, at: 0.1 })),
    T('sawtooth', 70, 0.9, 0.08, { lp: 300, vib: [5, 40], at: 0.1 }),
  ],
  // A defeated unit's pixels drifting off like gas: a pop, a cloud of tiny blips thinning and rising, and a hiss.
  dissipate: (r) => {
    const out: Layer[] = [T('sine', 300, 0.1, 0.3, { f2: 80 })];
    for (let k = 0; k < 30; k++) {
      const at = Math.pow(r(), 1.6) * 1.1;
      const f = between(r, 1200, 5000) * (1 + at * 0.7);
      out.push(T(r() < 0.5 ? 'sine' : 'square', f, between(r, 0.008, 0.022), between(r, 0.03, 0.08) * (1 - at * 0.7), { at, f2: f * 1.2, pan: between(r, -0.8, 0.8), lp: 6000 }));
    }
    out.push(N(1.1, 0.14, { hp: 700, bp: 700, bp2: 5000, bq: 1, env: 'swell', pan: -0.3, pan2: 0.4 }));
    return out;
  },

  // ---------------------------------------------------------------- blood, machines, and the city
  // Blood waking an object: a wet pulse, then a rising synth breath, and the thing sings one note in the music's key.
  wake: (r, o) => [
    T('sine', 70, 0.25, 0.6, { f2: 45, a: 0.004 }),
    N(0.18, 0.3, { lp: 700, lp2: 250, q: 3 }),
    T('sawtooth', 110, 1.0, 0.12, { at: 0.12, f2: 330, lp: 400, lp2: 3200, env: 'swell', vib: [3, 25], vib2: 9 }),
    T('sawtooth', 111.5, 1.0, 0.1, { at: 0.12, f2: 334, lp: 400, lp2: 3000, env: 'swell' }),
    N(0.9, 0.16, { at: 0.15, bp: 500, bp2: 2600, bq: 2, env: 'swell' }),
    bell(o.key[4] + 12, 0.9, 0.12, 1.0, 2, { vib: [5, 15] }),
  ],
  // Hush: a cold muffle closing down, a tone whose vibrato slows to nothing, and a glassy ring left behind.
  hush: () => [
    N(0.7, 0.35, { lp: 6000, lp2: 180, q: 1.5 }),
    T('sine', 600, 0.7, 0.14, { f2: 140, vib: [7, 30], vib2: 0.5 }),
    T('sine', 2600, 0.8, 0.07, { fm: [3.5, 1.2, 0], f2: 2500, room: 0.7, env: 'hold', a: 0.05 }),
    T('sine', 90, 0.3, 0.3, { f2: 60, at: 0.05 }),
  ],
  drone: () => [
    T('sawtooth', 220, 1.4, 0.07, { am: [28, 0.5], bp: 1400, bq: 3, pan: -0.6, pan2: 0.6, vib: [5, 20], env: 'swell' }),
    T('sawtooth', 223, 1.4, 0.06, { am: [31, 0.5], bp: 1600, bq: 3, pan: -0.5, pan2: 0.7, env: 'swell' }),
    N(1.4, 0.05, { bp: 3000, bq: 2, env: 'swell', pan: -0.6, pan2: 0.6 }),
  ],
  // A Bailer's foot coming down in a canal some streets away: a huge low thump, the water, and the creak of its body.
  bailer: (r) => [
    T('sine', 52, 0.9, 0.8, { f2: 26, a: 0.01 }),
    T('triangle', 104, 0.3, 0.2, { f2: 50 }),
    N(1.4, 0.4, { at: 0.12, lp: 1000, lp2: 160, room: 0.8 }),
    T('sawtooth', 48, 1.2, 0.08, { at: 0.2, bp: 300, bq: 3, vib: [2, 40], f2: 44, room: 0.6 }),
    ...grains(r, 5, 0.8, () => T('sine', between(r, 300, 700), 0.05, 0.05, { at: 0.5, f2: between(r, 800, 1400), room: 0.6 })),
  ],
  // The Board's public address chime is the Board's own figure on bells, with the speaker's hum under it.
  pa: (r, o) => [
    bell(o.key[4] + 12, 1.0, 0.16, 0, 2),
    bell(o.key[1] + 12, 0.8, 0.15, 0.32),
    bell(o.key[2] + 12, 0.8, 0.15, 0.48),
    bell(o.key[6], 1.4, 0.16, 0.64),
    T('sawtooth', 120, 1.8, 0.03, { bp: 900, bq: 2, env: 'hold', a: 0.05 }),
  ],
  alarm: () => [
    T('square', 760, 1.5, 0.1, { vib: [2.6, 480], lp: 2200, env: 'hold', a: 0.02 }),
    T('sawtooth', 380, 1.5, 0.06, { vib: [2.6, 480], lp: 1200, env: 'hold', a: 0.02 }),
  ],
};

export const SFX_LIST: readonly string[] = Object.keys(PATCHES);

// ---------------------------------------------------------------- playback

interface Rig { ac: BaseAudioContext; input: GainNode; room: GainNode; noise: AudioBuffer; pulse: PeriodicWave }
let rig: Rig | null = null;
let live = 0;
const lastAt: Record<string, number> = {};
let seed = 0x5eed1234;
const rand: Rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

function roomImpulse(ac: BaseAudioContext, secs: number): AudioBuffer {
  const sr = ac.sampleRate, n = Math.round(sr * secs);
  const buf = ac.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let s = ch ? 0x1234 : 0x9876;
    let y = 0;
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const t = i / sr;
      y += 0.6 * ((s / 2147483648 - 1) - y);
      d[i] = y * Math.exp((-6.91 * t) / secs);
    }
  }
  return buf;
}

function makeRig(ac: BaseAudioContext, out: AudioNode): Rig {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.knee.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  const makeup = ac.createGain();
  makeup.gain.value = 1.35;
  comp.connect(makeup); makeup.connect(out);
  const input = ac.createGain();
  input.connect(comp);
  const room = ac.createGain();
  const conv = ac.createConvolver();
  conv.buffer = roomImpulse(ac, 1.1);
  const wet = ac.createGain();
  wet.gain.value = 0.35;
  room.connect(conv); conv.connect(wet); wet.connect(comp);
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noise.getChannelData(0);
  let s = 0xabcdef;
  for (let i = 0; i < nd.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; nd[i] = s / 2147483648 - 1; }
  const H = 32, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) re[h] = Math.sin(Math.PI * h * 0.25) / h;
  return { ac, input, room, noise, pulse: ac.createPeriodicWave(re, im) };
}

function build(): void {
  const ac = audioCtx(), out = sfxOut();
  if (!ac || !out || rig) return;
  try { rig = makeRig(ac, out); } catch { rig = null; }
}

onAudioReady(build);

function envelope(prm: AudioParam, L: Layer, at: number, g: number): number {
  const d = Math.max(0.005, L.d);
  const a = Math.max(0.001, L.a ?? 0.003);
  const env = L.env ?? 'perc';
  prm.setValueAtTime(0, at);
  if (env === 'perc') {
    prm.linearRampToValueAtTime(g, at + a);
    prm.setTargetAtTime(0, at + a, Math.max(0.004, (d - a) / 4));
    return at + d + 0.1;
  }
  if (env === 'hold') {
    prm.linearRampToValueAtTime(g, at + a);
    prm.setValueAtTime(g, at + Math.max(a, d * 0.7));
    prm.setTargetAtTime(0, at + Math.max(a, d * 0.7), Math.max(0.01, d * 0.1));
    return at + d + 0.2;
  }
  if (env === 'swell') {
    prm.linearRampToValueAtTime(g, at + d * 0.6);
    prm.setTargetAtTime(0, at + d * 0.6, Math.max(0.01, d * 0.12));
    return at + d + 0.2;
  }
  prm.setValueAtTime(0.0001, at);
  prm.exponentialRampToValueAtTime(Math.max(0.0002, g), at + d);
  prm.setTargetAtTime(0, at + d, 0.01);
  return at + d + 0.08;
}

function playLayer(R: Rig, L: Layer, t0: number, pitch: number, gain: number, panOff: number): void {
  const { ac } = R;
  const at = t0 + (L.at ?? 0);
  const nodes: AudioNode[] = [];
  const srcs: AudioScheduledSourceNode[] = [];
  let head: AudioNode;
  if (L.w === 'noise') {
    const s = ac.createBufferSource();
    s.buffer = R.noise; s.loop = true;
    srcs.push(s);
    head = s;
  } else {
    const o = ac.createOscillator();
    if (L.w === 'pulse') o.setPeriodicWave(R.pulse); else o.type = L.w;
    const f = Math.max(20, Math.min(18000, (L.f ?? 440) * pitch));
    o.frequency.setValueAtTime(f, at);
    if (L.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, Math.min(18000, L.f2 * pitch)), at + Math.max(0.005, L.glide ?? L.d));
    if (L.det) o.detune.value = L.det;
    if (L.fm) {
      const m = ac.createOscillator(), mg = ac.createGain();
      m.frequency.setValueAtTime(f * L.fm[0], at);
      if (L.f2) m.frequency.exponentialRampToValueAtTime(Math.max(20, L.f2 * pitch * L.fm[0]), at + Math.max(0.005, L.glide ?? L.d));
      const i0 = L.fm[1] * f * L.fm[0], i1 = (L.fm[2] ?? L.fm[1]) * f * L.fm[0];
      mg.gain.setValueAtTime(i0, at);
      mg.gain.linearRampToValueAtTime(i1, at + L.d);
      m.connect(mg); mg.connect(o.frequency);
      srcs.push(m); nodes.push(mg);
    }
    if (L.vib) {
      const v = ac.createOscillator(), vg = ac.createGain();
      v.frequency.setValueAtTime(L.vib[0], at);
      if (L.vib2 !== undefined) v.frequency.linearRampToValueAtTime(Math.max(0.01, L.vib2), at + L.d);
      vg.gain.value = L.vib[1];
      v.connect(vg); vg.connect(o.detune);
      srcs.push(v); nodes.push(vg);
    }
    srcs.push(o);
    head = o;
  }
  const chain = (n: AudioNode) => { head.connect(n); head = n; nodes.push(n); };
  if (L.hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = Math.min(18000, L.hp); chain(f); }
  if (L.bp) {
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = L.bq ?? 1;
    f.frequency.setValueAtTime(Math.min(18000, L.bp), at);
    if (L.bp2) f.frequency.exponentialRampToValueAtTime(Math.min(18000, L.bp2), at + L.d);
    chain(f);
  }
  if (L.lp) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = L.q ?? 0.7;
    f.frequency.setValueAtTime(Math.min(18000, L.lp), at);
    if (L.lp2) f.frequency.exponentialRampToValueAtTime(Math.min(18000, L.lp2), at + L.d);
    chain(f);
  }
  const eg = ac.createGain();
  const end = envelope(eg.gain, L, at, Math.min(1.2, L.g * gain));
  chain(eg);
  if (L.am) {
    const amp = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    amp.gain.value = 1 - L.am[1] / 2;
    lfo.frequency.setValueAtTime(L.am[0], at);
    lfo.frequency.linearRampToValueAtTime(L.am[0] * 3, at + L.d);
    lg.gain.value = L.am[1] / 2;
    lfo.connect(lg); lg.connect(amp.gain);
    chain(amp);
    srcs.push(lfo); nodes.push(lg);
  }
  const pan = ac.createStereoPanner();
  const p0 = Math.max(-1, Math.min(1, (L.pan ?? 0) + panOff));
  pan.pan.setValueAtTime(p0, at);
  if (L.pan2 !== undefined) pan.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, L.pan2 + panOff)), at + L.d);
  chain(pan);
  head.connect(R.input);
  const send = ac.createGain();
  send.gain.value = L.room ?? 0.2;
  head.connect(send); send.connect(R.room);
  nodes.push(send);
  live++;
  const last = srcs[srcs.length - 1];
  for (const s of srcs) {
    if (s instanceof AudioBufferSourceNode) s.start(at, (at * 3.1) % 1.5); else s.start(at);
    s.stop(end);
  }
  last.onended = () => {
    live = Math.max(0, live - 1);
    for (const s of srcs) { try { s.disconnect(); } catch { /* ignore */ } }
    for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } }
  };
}

/**
 * Renders one effect offline at a given bus gain, for checking levels without listening. Browser only. Returns the
 * peak and the loudest 100 ms RMS in dBFS.
 */
export async function renderSfxOffline(name: string, busGain = 0.88): Promise<{ peak: number; rms: number }> {
  // The compressor starts an offline render fully engaged and takes a few hundred milliseconds to let go, so the
  // sound starts half a second in, where a live game would find it already idle.
  const sr = 44100, secs = 4;
  const ac = new OfflineAudioContext(2, sr * secs, sr);
  const bus = ac.createGain();
  bus.gain.value = busGain;
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -1.5; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.12;
  bus.connect(lim); lim.connect(ac.destination);
  const R = makeRig(ac, bus);
  const p = PATCHES[name];
  if (p) for (const L of p(rand, { key: keyPitches() })) playLayer(R, L, 0.5, 1, TRIM[name] ?? 1, 0);
  return levels(await ac.startRendering(), 0.1);
}

/** Peak and loudest RMS over windows of `win` seconds, in dBFS. */
export function levels(buf: AudioBuffer, win: number): { peak: number; rms: number } {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = Math.max(1, Math.round(buf.sampleRate * win));
  let peak = 0, best = 0;
  for (let s = 0; s + n <= L.length; s += Math.round(n / 2)) {
    let acc = 0;
    for (let i = s; i < s + n; i++) { acc += L[i] * L[i] + R[i] * R[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    best = Math.max(best, Math.sqrt(acc / (2 * n)));
  }
  const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
  return { peak: db(peak), rms: db(best) };
}

/** The current music key as eleven scale pitches from about middle C, or C major when no music plays. */
export function keyPitches(): number[] {
  const k = music.keyNow();
  const root = k ? 60 + ((((k.root - 60) % 12) + 12) % 12) : 60;
  const mode = k && k.mode.length === 7 ? k.mode : [0, 2, 4, 5, 7, 9, 11];
  const out: number[] = [];
  for (let d = 0; d < 11; d++) out.push(root + mode[d % 7] + 12 * Math.floor(d / 7));
  return out;
}

/** Builds a patch's layers without playing them, so tools can inspect them in Node. */
export function patchLayers(name: string, r: Rand = rand): Layer[] | null {
  const p = PATCHES[name];
  return p ? p(r, { key: keyPitches() }) : null;
}

/**
 * Level trims per effect. Narrow noise bands and very short blips measure far quieter than their layer gains suggest,
 * so these bring every effect to its target. They come from peaks measured with renderSfxOffline.
 */
export const TRIM: Record<string, number> = {
  blip: 0.79, cursor: 0.84, cancel: 0.69, menu: 1.1, toast: 1.35, talk: 0.87, turn: 0.78, quest: 1.12, levelup: 0.9, buy: 1.23,
  pass: 0.87, fail: 1.45, approve: 1.1, disapprove: 1.55, edge: 1.08, heal: 1.06, dice: 0.82, step: 0.63, door: 0.72, jump: 1.2,
  fall: 0.85, shove: 0.92, splash: 0.82, hit: 0.95, miss: 1.5, pistol: 0.87, shotgun: 0.86, rifle: 0.88, melee: 0.94, shock: 0.92,
  hack: 1.57, explode: 0.89, guard: 0.89, foam: 1.5, smoke: 0.87, dissipate: 0.89, wake: 0.93, hush: 0.87, drone: 3.2, bailer: 0.84,
  pa: 1.07, alarm: 1.48,
};

const QUIET = new Set(['step', 'cursor', 'blip', 'turn', 'toast']);

/** Plays a named effect. Returns false when the name is unknown. */
export function playSfx(name: string, opts: SfxOpts = {}): boolean {
  const p = PATCHES[name];
  if (!p) return false;
  if (!rig) build();
  const R = rig;
  if (!R || isMuted()) return true;
  try {
    const now = R.ac.currentTime;
    const gap = name === 'step' ? 0.07 : name === 'cursor' || name === 'blip' ? 0.025 : 0.02;
    if (now - (lastAt[name] ?? -1) < gap) return true;
    if (live > 160 && QUIET.has(name)) return true;
    lastAt[name] = now;
    let pitch = Number.isFinite(opts.pitch) ? (opts.pitch as number) : 1;
    // A negative or zero pitch is read as semitones, in case a caller passes an offset instead of a ratio.
    if (pitch <= 0) pitch = Math.pow(2, pitch / 12);
    pitch = Math.max(0.25, Math.min(4, pitch));
    const jitter = name === 'cursor' || name === 'menu' || name === 'confirm' || name === 'cancel' ? 0.01 : 0.05;
    pitch *= 1 + (rand() - 0.5) * jitter;
    const vol = Math.max(0, Math.min(3, Number.isFinite(opts.vol) ? (opts.vol as number) : 1)) * (1 + (rand() - 0.5) * 0.14);
    const pan = Math.max(-1, Math.min(1, Number.isFinite(opts.pan) ? (opts.pan as number) : 0));
    for (const L of p(rand, { key: keyPitches() })) playLayer(R, L, now + 0.005, pitch, vol * (TRIM[name] ?? 1), pan);
  } catch { /* never throw */ }
  return true;
}
