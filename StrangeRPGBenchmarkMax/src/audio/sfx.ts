// Sound effects: small synth patches built from layers (oscillators, FM pairs, noise, glides, vibrato, tremolo,
// filter sweeps), played through a short room and a punchy compressor on the effects bus. Every call varies a little,
// so repeated sounds are never identical. Footsteps and pebbles also walk their pitch slowly from step to step.
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

/** Short noise grains scattered over `span` seconds, for scratches, crackles, and crunches. */
function grains(r: Rand, n: number, span: number, make: (k: number) => Layer): Layer[] {
  const out: Layer[] = [];
  for (let k = 0; k < n; k++) { const l = make(k); out.push({ ...l, at: (l.at ?? 0) + r() * span }); }
  return out;
}

/** An FM bell note at a MIDI pitch. */
const bell = (n: number, d: number, g: number, at = 0, ratio = 2, x: Partial<Layer> = {}): Layer =>
  T('sine', mtof(n), d, g, { at, fm: [ratio, 1.6, 0], room: 0.55, ...x });

/** Slow random walks per material, so footsteps drift in pitch instead of repeating. */
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

const PATCHES: Record<string, Patch> = {
  // ---------------------------------------------------------------- script sounds
  page: (r) => [
    N(0.09, 0.32, { bp: 1800, bp2: 4500, bq: 0.8 }),
    N(0.12, 0.22, { at: 0.06, bp: 3200, bp2: 1500, bq: 0.9 }),
    T('sine', 180, 0.05, 0.1, { f2: 120, at: between(r, 0.08, 0.1) }),
  ],
  pen: (r) => [
    ...grains(r, 7 + Math.floor(r() * 5), 0.55, () => N(between(r, 0.025, 0.05), between(r, 0.12, 0.2), { bp: between(r, 4000, 6500), bq: 3, room: 0.1 })),
    T('sine', 2400, 0.5, 0.025, { vib: [9, 60], room: 0.1 }),
  ],
  pen_stop: () => [N(0.05, 0.18, { bp: 5000, bq: 3 }), T('triangle', 1200, 0.04, 0.2, { f2: 900, at: 0.08 }), N(0.012, 0.15, { at: 0.08, bp: 2500, bq: 2 })],
  pin: () => [T('sine', 1800, 0.5, 0.22, { fm: [2.76, 3, 0], room: 0.4 }), N(0.01, 0.2, { hp: 6000 })],
  lamp_light: (r) => [
    // The light arrives first, a beat before the flame.
    T('sine', 880, 0.35, 0.12, { f2: 910, env: 'swell', vib: [6, 15], room: 0.6 }),
    T('sine', 1320, 0.35, 0.08, { f2: 1360, env: 'swell', vib: [6.5, 15], room: 0.6 }),
    N(0.25, 0.35, { at: 0.3, lp: 1200, lp2: 400 }),
    T('sine', 140, 0.2, 0.3, { f2: 90, at: 0.3 }),
    ...grains(r, 5, 0.4, () => N(0.008, 0.16, { at: 0.32, hp: 3500 })),
  ],
  lamp_out: (r) => [
    N(0.4, 0.25, { bp: 2500, bp2: 800, bq: 0.9 }),
    ...grains(r, 4, 0.3, () => N(0.006, 0.14, { hp: 4000 })),
    T('sine', 160, 0.15, 0.25, { f2: 60, at: 0.05 }),
    T('sine', 600, 0.35, 0.08, { f2: 200, vib: [7, 30], room: 0.5 }),
  ],
  hood: () => [N(0.25, 0.25, { bp: 1200, bp2: 600, bq: 0.7 }), T('sine', 110, 0.12, 0.3, { f2: 70, at: 0.12, lp: 600 })],
  bar_slide: () => [
    N(0.5, 0.2, { bp: 900, bp2: 1600, bq: 6 }),
    T('sine', 220, 0.5, 0.08, { fm: [1.41, 2, 1] }),
    T('sine', 180, 0.1, 0.25, { f2: 90, at: 0.45 }),
    N(0.06, 0.2, { at: 0.45, lp: 800 }),
  ],
  nail: () => [0, 1, 2].flatMap((k) => [
    T('sine', 900 + k * 150, 0.12, 0.25, { at: k * 0.18, fm: [2.4, 4, 0] }),
    N(0.02, 0.25, { at: k * 0.18, hp: 3000 }),
  ]),
  brush: () => [N(0.35, 0.18, { bp: 1500, bp2: 3500, bq: 1, env: 'swell' })],
  thud: () => [T('sine', 120, 0.3, 0.6, { f2: 40 }), N(0.15, 0.35, { lp: 600 }), T('sine', 50, 0.25, 0.3)],
  coin: () => [
    T('sine', 1400, 0.25, 0.18, { fm: [3, 1.5, 0], vib: [12, 12], room: 0.4 }),
    T('sine', 2100, 0.35, 0.16, { at: 0.07, fm: [3, 1.5, 0], vib: [12, 12], room: 0.4 }),
  ],
  glare: () => [T('square', 1200, 0.5, 0.12, { f2: 2400, vib: [11, 40], bp: 2400, bq: 2, env: 'swell' }), N(0.4, 0.08, { hp: 5000, env: 'swell' })],
  crack: (r) => [
    ...grains(r, 8, 0.25, () => N(between(r, 0.004, 0.01), 0.3, { hp: 2500 })),
    T('sine', 2600, 0.3, 0.12, { fm: [3.3, 2, 0], room: 0.4 }),
    T('sawtooth', 90, 0.2, 0.08, { bp: 400, bq: 2 }),
  ],
  shatter: (r) => [
    N(0.35, 0.35, { hp: 3000 }),
    ...grains(r, 18, 0.6, () => T('sine', between(r, 2000, 6000), between(r, 0.08, 0.25), between(r, 0.05, 0.12), { fm: [3.5, 2, 0], pan: between(r, -0.8, 0.8), room: 0.5 })),
    T('sine', 150, 0.15, 0.3, { f2: 60 }),
  ],
  chalk: (r) => [
    ...grains(r, 6, 0.6, () => N(between(r, 0.06, 0.12), 0.18, { bp: between(r, 2200, 3000), bq: 2 })),
    T('sine', 3000, 0.4, 0.02, { vib: [13, 80], at: 0.1 }),
  ],
  fade: (r, o) => [
    ...[0, 2, 4].map((d) => T('sine', mtof(o.key[d] + 12), 0.6, 0.1, { env: 'rev', room: 0.7 })),
    ...[0, 4].map((d, i) => T('sine', mtof(o.key[d] + 12), 1.2, 0.08, { at: 0.6, f2: mtof(o.key[d] + 12) * 0.88, vib: [5, 20], room: 0.8, det: i * 7 })),
    N(1.2, 0.06, { at: 0.5, lp: 1800, lp2: 300 }),
    ...grains(r, 4, 0.6, () => T('sine', between(r, 2500, 4000), 0.05, 0.03, { at: 0.6 })),
  ],
  clamp: () => [T('sine', 330, 0.25, 0.3, { fm: [1.41, 5, 0] }), T('sine', 120, 0.12, 0.35, { f2: 60 }), N(0.03, 0.25, { bp: 2000, bq: 1 })],
  tick: () => [T('triangle', 1600, 0.03, 0.25, { f2: 1400 }), N(0.008, 0.15, { bp: 3000, bq: 2 })],
  crunch: (r) => [
    ...grains(r, 7, 0.25, () => N(between(r, 0.02, 0.05), between(r, 0.2, 0.35), { bp: between(r, 800, 2000), bq: 1.2 })),
    T('sine', 90, 0.1, 0.15),
  ],
  join: (r, o) => [
    ...[0, 2, 4, 7].map((d, i) => bell(o.key[d] + 12, 0.9, 0.18, i * 0.09)),
    ...[0, 2, 4].map((d) => T('sine', mtof(o.key[d]), 1.2, 0.07, { at: 0.3, env: 'hold', a: 0.2, room: 0.6 })),
  ],
  hum_rise: () => [
    T('sawtooth', 55, 2.6, 0.18, { f2: 110, lp: 300, lp2: 2500, env: 'swell', am: [4, 0.3] }),
    T('sawtooth', 55.5, 2.6, 0.14, { f2: 111, lp: 300, lp2: 2500, env: 'swell' }),
    T('sine', 55, 2.6, 0.2, { f2: 110, env: 'swell' }),
  ],
  beam_turn: () => [
    N(1.0, 0.25, { bp: 400, bp2: 3000, bq: 8, pan: -0.7, pan2: 0.7 }),
    T('sine', 600, 1.0, 0.08, { f2: 900, vib: [6, 30], env: 'swell', pan: -0.5, pan2: 0.5 }),
  ],
  glass_chime: (r, o) => [
    ...Array.from({ length: 4 + Math.floor(r() * 3) }, (_, k) => bell(o.key[[0, 1, 2, 4, 5][Math.floor(r() * 5)]] + 24, between(r, 0.5, 0.9), between(r, 0.1, 0.16), k * between(r, 0.1, 0.18), 3.5, { pan: between(r, -0.6, 0.6) })),
  ],

  // ---------------------------------------------------------------- footsteps
  step_stone: (r) => step(r, 'stone', (v) => [N(0.035, 0.16, { bp: between(r, 1600, 2200) * v, bq: 1.5 }), T('sine', 160 * v, 0.05, 0.12, { f2: 110 * v })]),
  step_grass: (r) => step(r, 'grass', (v) => [N(0.06, 0.1, { hp: 2500 * v, bp: between(r, 3500, 4500) * v, bq: 0.8, a: 0.01 })]),
  step_sand: (r) => step(r, 'sand', (v) => [
    ...grains(r, 3, 0.05, () => N(0.012, 0.1, { bp: between(r, 3000, 5000) * v, bq: 1.5 })),
    N(0.05, 0.06, { lp: 1200 * v }),
  ]),
  step_dirt: (r) => step(r, 'dirt', (v) => [
    ...grains(r, 2, 0.04, () => N(0.014, 0.09, { bp: between(r, 1400, 2200) * v, bq: 1.2 })),
    N(0.05, 0.08, { lp: 700 * v }),
  ]),
  step_glass: (r) => step(r, 'glass', (v) => [T('sine', between(r, 2600, 3600) * v, 0.12, 0.06, { fm: [3.5, 1, 0], room: 0.4 }), N(0.01, 0.1, { hp: 5000 })]),
  step_wood: (r) => step(r, 'wood', (v) => [T('triangle', between(r, 190, 240) * v, 0.07, 0.18, { f2: between(r, 160, 200) * v }), N(0.02, 0.08, { bp: 900 * v, bq: 1.5 })]),

  // ---------------------------------------------------------------- the field and menus
  bump: () => [T('sine', 220, 0.14, 0.3, { f2: 140, vib: [14, 60] }), T('triangle', 440, 0.1, 0.08, { f2: 280 })],
  door: () => [
    T('sawtooth', 140, 0.35, 0.08, { f2: 130, vib: [5, 50], bp: 900, bq: 4 }),
    T('sine', 100, 0.12, 0.3, { f2: 70, at: 0.3 }),
    N(0.08, 0.2, { at: 0.3, lp: 700 }),
  ],
  menu_move: () => [T('sine', 660, 0.05, 0.14, { f2: 720, vib: [30, 30] }), T('triangle', 1980, 0.04, 0.03)],
  menu_ok: () => [
    T('sine', 660, 0.12, 0.16, { fm: [2, 1, 0], vib: [9, 12] }),
    T('sine', 990, 0.14, 0.16, { at: 0.06, fm: [2, 1, 0], vib: [9, 12] }),
  ],
  menu_back: () => [T('sine', 880, 0.12, 0.15, { f2: 520, vib: [10, 20] }), T('triangle', 1760, 0.08, 0.04, { f2: 1040 })],
  menu_bad: () => [
    T('square', 180, 0.1, 0.16, { f2: 160, fm: [0.5, 2, 1], lp: 900, vib: [8, 40] }),
    T('square', 150, 0.14, 0.16, { at: 0.11, f2: 120, fm: [0.5, 2, 1], lp: 800, vib: [8, 40] }),
  ],
  save: (r, o) => [
    ...[4, 7, 9].map((d, i) => bell(o.key[d] + 12, 1, 0.14, i * 0.12)),
    ...[0, 4].map((d) => T('sine', mtof(o.key[d]), 1.1, 0.06, { at: 0.2, env: 'hold', a: 0.3, room: 0.6 })),
  ],
  item_get: (r, o) => [
    ...[0, 2, 4, 7].map((d, i) => T('triangle', mtof(o.key[d] + 12), 0.12, 0.16, { at: i * 0.06 })),
    bell(o.key[9] + 12, 0.9, 0.16, 0.24),
    bell(o.key[7] + 12, 0.9, 0.1, 0.24, 2, { det: 6 }),
  ],
  level_up: (r, o) => [
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((d, i) => T('square', mtof(o.key[d] + 12), 0.1, 0.07, { at: i * 0.055, lp: 3000 })),
    ...[0, 2, 4, 7].map((d) => bell(o.key[d] + 12, 1.2, 0.1, 0.45)),
    ...grains(r, 6, 0.6, () => T('sine', between(r, 2500, 4500), 0.06, 0.04, { at: 0.45, room: 0.5 })),
  ],
  battle_start: () => [
    N(0.45, 0.25, { bp: 300, bp2: 3000, bq: 1.5, env: 'swell' }),
    T('sawtooth', 80, 0.45, 0.12, { f2: 400, lp: 2000, env: 'swell' }),
    T('sine', 150, 0.25, 0.45, { at: 0.42, f2: 45 }),
    N(0.1, 0.3, { at: 0.42, lp: 1500 }),
  ],
  hit: () => [
    T('square', 200, 0.1, 0.25, { f2: 70, vib: [20, 40], lp: 2200 }),
    N(0.06, 0.28, { bp: 2000, bq: 1 }),
    T('sine', 120, 0.08, 0.25, { f2: 60 }),
  ],
  // Bold and satisfying: a short punchy rip over a thump, with a cracked top and a sub tail.
  strong_hit: () => [
    T('sine', 160, 0.18, 0.72, { f2: 45, a: 0.001 }),
    T('sawtooth', 220, 0.14, 0.4, { f2: 55, lp: 4000, lp2: 300, fm: [0.5, 3, 0] }),
    N(0.09, 0.52, { bp: 3500, bp2: 800, bq: 1.2 }),
    T('sine', 55, 0.25, 0.28, { at: 0.06 }),
    N(0.02, 0.32, { hp: 5000 }),
  ],
  guard_hit: () => [T('sine', 300, 0.25, 0.22, { fm: [1.414, 4, 0] }), T('sine', 130, 0.1, 0.25, { f2: 80, lp: 1500 })],
  miss: () => [N(0.18, 0.2, { bp: 2200, bp2: 500, bq: 1.2 }), T('sine', 700, 0.12, 0.05, { f2: 350 })],
  heal: (r, o) => [
    ...[0, 4, 9].map((d, i) => T('sine', mtof(o.key[d] + 12), 0.6, 0.1, { env: 'swell', vib: [5, 15], at: i * 0.05, room: 0.6 })),
    ...grains(r, 6, 0.5, () => T('sine', between(r, 2000, 4000), 0.05, 0.04, { room: 0.5 })),
  ],
  // Pixels coming apart like gas: a pop, then a cloud of tiny blips thinning and rising, and a hiss that drifts up.
  enemy_die: (r) => {
    const out: Layer[] = [T('sine', 300, 0.1, 0.3, { f2: 80 })];
    for (let k = 0; k < 24; k++) {
      const at = Math.pow(r(), 1.8) * 0.75;
      const f = between(r, 1500, 6000) * (1 + at * 0.6);
      out.push(T(r() < 0.5 ? 'sine' : 'square', f, between(r, 0.008, 0.02), between(r, 0.03, 0.08) * (1 - at), { at, f2: f * 1.15, pan: between(r, -0.8, 0.8), lp: 6000 }));
    }
    out.push(N(0.8, 0.14, { hp: 800, bp: 800, bp2: 5000, bq: 1, env: 'swell' }));
    return out;
  },
  party_down: () => [
    T('sawtooth', 440, 0.7, 0.1, { f2: 220, vib: [8, 40], vib2: 3, lp: 1500, lp2: 600 }),
    T('triangle', 440, 0.7, 0.08, { f2: 220, vib: [8, 40], vib2: 3 }),
    T('sine', 110, 0.15, 0.3, { at: 0.55, f2: 60 }),
  ],
  pebble_throw: (r) => [N(0.18, 0.14, { bp: 1000, bp2: 2500, bq: 2 }), T('sine', 900 * between(r, 0.95, 1.05), 0.15, 0.03, { f2: 1200 })],
  pebble_land: (r) => step(r, 'pebble', (v) => {
    const f = between(r, 700, 1300) * v;
    const at = between(r, 0.08, 0.12);
    return [
      T('triangle', f, 0.05, 0.2, { f2: f * 0.8 }), N(0.01, 0.15, { bp: 2500 * v, bq: 2 }),
      T('triangle', f * 1.12, 0.04, 0.1, { at, f2: f * 0.9 }), N(0.008, 0.08, { at, bp: 2800 * v, bq: 2 }),
    ];
  }),
  lamp_move: () => [N(0.25, 0.12, { bp: 800, bp2: 1600, bq: 3 }), T('sawtooth', 200, 0.2, 0.04, { vib: [4, 40], bp: 1200, bq: 3 })],
  lead_swing: () => [N(0.35, 0.22, { bp: 300, bp2: 900, bq: 4, pan: -0.5, pan2: 0.5 }), T('sine', 90, 0.3, 0.1, { f2: 70 })],
  shade_raise: () => [
    N(0.5, 0.3, { lp: 300, lp2: 900, env: 'swell' }),
    T('sine', 70, 0.5, 0.35, { f2: 50, env: 'swell' }),
    T('triangle', 140, 0.5, 0.06, { vib: [5, 30], env: 'swell' }),
  ],
  pane_set: () => [T('sine', 2200, 0.5, 0.14, { fm: [3.5, 2, 0], room: 0.5 }), T('sine', 300, 0.08, 0.18, { f2: 200 })],
  // A pane replays late, so it plays its own ping backward first.
  pane_replay: () => [T('sine', 2200, 0.4, 0.14, { fm: [3.5, 0.3, 2.2], env: 'rev', room: 0.5 }), T('sine', 2200, 0.3, 0.12, { at: 0.4, fm: [3.5, 2, 0], room: 0.5 })],
  tug: () => [T('sine', 200, 0.15, 0.2, { f2: 500, vib: [10, 60] }), T('square', 500, 0.08, 0.12, { at: 0.15, f2: 150, lp: 2000 })],
  slip: () => [N(0.3, 0.14, { bp: 3000, bp2: 800, bq: 3, pan: 0.6, pan2: -0.6 }), T('sine', 800, 0.3, 0.06, { f2: 300, vib: [7, 50] })],
  stab: () => [N(0.04, 0.35, { hp: 2000 }), T('sawtooth', 1400, 0.07, 0.15, { f2: 400, lp: 3000 }), T('sine', 3000, 0.12, 0.06, { f2: 2000 })],
  note_mark: () => [N(0.02, 0.15, { bp: 5000, bq: 3 }), T('sine', 1320, 0.06, 0.1, { vib: [12, 20] })],
  note_record: (r, o) => [
    ...grains(r, 4, 0.25, () => N(between(r, 0.02, 0.04), 0.14, { bp: between(r, 4000, 6000), bq: 3 })),
    bell(o.key[4] + 24, 0.4, 0.1, 0.25, 2),
  ],
  beam_sweep: () => [N(0.8, 0.3, { bp: 600, bp2: 2400, bq: 10, pan: -0.8, pan2: 0.8, env: 'swell' })],
  heat_tick: (r) => [...grains(r, 5, 0.15, () => N(0.006, 0.2, { hp: 4000 })), T('sine', 2400, 0.08, 0.03, { vib: [16, 50] })],
  sticks_place: (r) => [T('triangle', between(r, 520, 620), 0.06, 0.28, { f2: 480 }), N(0.015, 0.2, { bp: 1500, bq: 1.5 })],
  sticks_flip: () => [N(0.01, 0.2, { bp: 2500, bq: 2 }), T('sine', 700, 0.08, 0.14, { f2: 1100, vib: [14, 20] })],
  sticks_win: (r, o) => [
    ...[0, 2, 4, 7].map((d, i) => T('triangle', mtof(o.key[d] + 12), 0.12, 0.16, { at: i * 0.07 })),
    bell(o.key[7] + 12, 0.8, 0.14, 0.28),
  ],
  // Tik's three notes, which never come home.
  sticks_lose: (r, o) => [
    ...[4, 3, 1].map((d, i) => T('triangle', mtof(o.key[d]), 0.22, 0.14, { at: i * 0.16, vib: [6, 20] })),
    T('sine', mtof(o.key[0] - 12), 0.5, 0.12, { at: 0.48 }),
  ],
  letter_open: (r, o) => [
    ...grains(r, 3, 0.12, () => N(0.04, 0.14, { bp: between(r, 2000, 3500), bq: 1 })),
    bell(o.key[4] + 12, 0.5, 0.08, 0.15),
  ],
  // The giant lead's two low notes, then a far bell.
  chapter_card: (r, o) => [
    T('sawtooth', mtof(o.key[0] - 17), 0.9, 0.14, { lp: 600, env: 'hold', a: 0.15, room: 0.6 }),
    T('sine', mtof(o.key[0] - 29), 0.9, 0.22, { env: 'hold', a: 0.15 }),
    T('sawtooth', mtof(o.key[0] - 12), 1.5, 0.14, { at: 0.8, lp: 700, env: 'hold', a: 0.2, room: 0.6 }),
    T('sine', mtof(o.key[0] - 24), 1.5, 0.22, { at: 0.8, env: 'hold', a: 0.2 }),
    bell(o.key[4] + 24, 1.2, 0.1, 1.6, 3.5),
  ],
  emote: () => [T('sine', 400, 0.1, 0.16, { f2: 800, vib: [18, 40] }), T('triangle', 800, 0.08, 0.05, { f2: 1600 })],
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
  makeup.gain.value = 1.25;
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
      if (L.vib2) v.frequency.linearRampToValueAtTime(L.vib2, at + L.d);
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
export async function renderSfxOffline(name: string, busGain = 0.7): Promise<{ peak: number; rms: number }> {
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
 * Level trims per effect, set from peaks measured with renderSfxOffline at the default volume. Narrow noise bands and
 * very short blips measure far quieter than their layer gains suggest, so these bring every effect to its target.
 */
const TRIM: Record<string, number> = {
  page: 0.79, pen: 1.17, pen_stop: 0.7, pin: 0.58, lamp_out: 0.79, hood: 0.74, nail: 0.76, brush: 1.2, coin: 1.12, glare: 1.45,
  crack: 0.85, chalk: 1.82, fade: 0.77, clamp: 0.72, tick: 0.58, crunch: 1.57, beam_turn: 3, glass_chime: 0.85,
  step_stone: 0.48, step_grass: 0.84, step_glass: 0.35, step_wood: 0.43, bump: 0.63, door: 0.82, menu_move: 0.79, menu_ok: 1.12,
  strong_hit: 1.23, guard_hit: 0.78, miss: 1.17, pebble_throw: 2.07, pebble_land: 0.64, lamp_move: 6, lead_swing: 1.86,
  shade_raise: 0.89, pane_set: 0.73, tug: 1.12, slip: 1.43, stab: 0.74, note_record: 1.9, beam_sweep: 4.2, heat_tick: 0.56,
  sticks_place: 0.65, sticks_flip: 0.82, sticks_win: 1.45, sticks_lose: 1.48, letter_open: 1.88, chapter_card: 1.16, emote: 0.86,
};

const QUIET = new Set(['step_stone', 'step_grass', 'step_sand', 'step_dirt', 'step_glass', 'step_wood', 'menu_move', 'tick', 'heat_tick', 'pebble_land']);

/** Plays a named effect. Returns false when the name is unknown. */
export function playSfx(name: string, opts: SfxOpts = {}): boolean {
  const p = PATCHES[name];
  if (!p) return false;
  if (!rig) build();
  const R = rig;
  if (!R || isMuted()) return true;
  try {
    const now = R.ac.currentTime;
    const gap = name.startsWith('step_') ? 0.07 : name === 'menu_move' ? 0.03 : 0.02;
    if (now - (lastAt[name] ?? -1) < gap) return true;
    if (live > 160 && QUIET.has(name)) return true;
    lastAt[name] = now;
    let pitch = Number.isFinite(opts.pitch) ? (opts.pitch as number) : 1;
    // A negative or zero pitch is read as semitones, in case a caller passes an offset instead of a ratio.
    if (pitch <= 0) pitch = Math.pow(2, pitch / 12);
    pitch = Math.max(0.25, Math.min(4, pitch));
    const jitter = name.startsWith('menu_') ? 0.01 : 0.05;
    pitch *= 1 + (rand() - 0.5) * jitter;
    const vol = Math.max(0, Math.min(3, Number.isFinite(opts.vol) ? (opts.vol as number) : 1)) * (1 + (rand() - 0.5) * 0.14);
    const pan = Math.max(-1, Math.min(1, Number.isFinite(opts.pan) ? (opts.pan as number) : 0));
    for (const L of p(rand, { key: keyPitches() })) playLayer(R, L, now + 0.005, pitch, vol * (TRIM[name] ?? 1), pan);
  } catch { /* never throw */ }
  return true;
}
