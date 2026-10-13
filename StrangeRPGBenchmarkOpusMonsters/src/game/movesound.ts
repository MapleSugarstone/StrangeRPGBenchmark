// Move sounds: each move's spec played in step with its picture. The cast part plays while the user moves, the travel part
// while each shape flies, and the impact part at each landing (Notes/move-sounds.md). The battle screen hands this module
// the picture as it plays and plain values about the move. It never reads or changes the battle or its random numbers, so
// online play replays a battle the same way with or without sound.
import { sfx, sink } from '../engine/audio';
import { music } from '../engine/music';
import type { MoveDef } from '../battle/registry';
import type { Type } from '../data/types';
import type { FxRun } from './battlefx';
import { fxHash } from './fxspec';
import { ACTIONS, parseSound, soundSpecOf, TYPE_MATERIAL, type SoundLayer, type SoundPlan } from './soundspec';

type Out = { a: BaseAudioContext; dest: AudioNode; t: number };
type Part = 'cast' | 'travel' | 'impact';
type Env = 'hit' | 'hold' | 'swell' | 'rise';
type Buf = 'white' | 'dust' | 'dense' | 'tick' | 'rustle';

/** All move sounds' share of the effects bus, measured so a plain landing sits a little under the plain hit (Notes/move-sounds.md). */
const MOVE_GAIN = 0.084;
/** At most this many move sounds ring at once, or more while a legendary's plays. A part that would go over drops, except a landing's first sound. */
const CAP = 12, CAP_LEGEND = 22;
/** Each part's loudness. The landing is loudest, because it carries the hit. */
const PART_VOL: Record<Part, number> = { cast: 0.55, travel: 0.42, impact: 1 };
/** How much louder a crest plays each part. The cast stays near a plain move's, so it never covers the crest's cry. */
const CREST_VOL: Record<Part, number> = { cast: 1.1, travel: 1.2, impact: 1.25 };
/** The first sound word in a part leads, and the ones after it play under it. */
const LAYER_VOL = [1, 0.75, 0.6, 0.5, 0.45];
/** A legendary's sound plays this much louder than a plain move's, above the music, and its strikes ring this much longer. */
const LEGEND_VOL = 2, LEGEND_LEN = 1.35;
/** How far a legendary's sound lowers the music while it plays, and how far a legendary crest does. */
const DUCK = 0.55, DUCK_CREST = 0.35;
/** Where each side sits left and right, the same as the cries. */
const PAN = [-0.35, 0.35];

// ---------------------------------------------------------------- materials and types

/**
 * A material: its tonal pitch in Hz, the partial ratios a strike rings at, how long a strike rings in seconds, its body
 * wave, the center and Q of its noise band, how much noise a strike carries (0 to 1), a rough flutter rate in Hz, a
 * vibrato depth in cents, frequency modulation index and ratio, a low-pass as a multiple of the pitch, and a level trim.
 */
interface Mat { f: number; parts: number[]; ring: number; wave: OscillatorType; band: number; q: number; grain: number; grit: number; wob: number; fm: number; fmr: number; dark: number; gain: number }

const MATS: Record<string, Mat> = {
  shell: { f: 880, parts: [1, 2.62, 4.41], ring: 0.16, wave: 'sine', band: 5200, q: 3.5, grain: 0.35, grit: 0, wob: 0, fm: 0.6, fmr: 2.62, dark: 8, gain: 0.93 },
  stone: { f: 170, parts: [1, 2.31, 3.92], ring: 0.09, wave: 'triangle', band: 1700, q: 1.1, grain: 0.8, grit: 34, wob: 0, fm: 0.8, fmr: 1.37, dark: 5, gain: 1.07 },
  sand: { f: 320, parts: [1, 1.9], ring: 0.04, wave: 'triangle', band: 4200, q: 0.7, grain: 1, grit: 90, wob: 0, fm: 0, fmr: 1, dark: 4, gain: 1.01 },
  water: { f: 480, parts: [1, 1.5, 2.1], ring: 0.12, wave: 'sine', band: 1100, q: 1.4, grain: 0.45, grit: 0, wob: 55, fm: 0.9, fmr: 0.5, dark: 6, gain: 0.99 },
  ice: { f: 1500, parts: [1, 2.76, 5.4], ring: 0.3, wave: 'sine', band: 7200, q: 4.5, grain: 0.4, grit: 0, wob: 0, fm: 0.4, fmr: 3.1, dark: 10, gain: 0.9 },
  salt: { f: 1150, parts: [1, 2.13, 3.37], ring: 0.18, wave: 'triangle', band: 7600, q: 2.6, grain: 0.6, grit: 48, wob: 0, fm: 0.3, fmr: 1.5, dark: 7, gain: 0.97 },
  root: { f: 240, parts: [1, 1.58, 2.95], ring: 0.09, wave: 'triangle', band: 1300, q: 2.2, grain: 0.35, grit: 0, wob: 0, fm: 0.5, fmr: 1.58, dark: 4, gain: 1.05 },
  gear: { f: 640, parts: [1, 2.41, 3.73], ring: 0.26, wave: 'square', band: 4300, q: 6, grain: 0.3, grit: 0, wob: 0, fm: 2.2, fmr: 3.73, dark: 8, gain: 0.98 },
  bone: { f: 720, parts: [1, 3.13], ring: 0.05, wave: 'triangle', band: 2800, q: 3, grain: 0.55, grit: 0, wob: 0, fm: 0.4, fmr: 3.13, dark: 6, gain: 0.98 },
  fur: { f: 160, parts: [1, 1.5], ring: 0.07, wave: 'sine', band: 650, q: 0.8, grain: 0.65, grit: 0, wob: 0, fm: 0, fmr: 1, dark: 3, gain: 1.12 },
  glass: { f: 1250, parts: [1, 2.32, 4.25, 6.63], ring: 0.55, wave: 'sine', band: 8200, q: 7, grain: 0.12, grit: 0, wob: 0, fm: 0, fmr: 1, dark: 12, gain: 0.92 },
  star: { f: 1050, parts: [1, 2, 2.99, 4.2], ring: 0.7, wave: 'sine', band: 9000, q: 6, grain: 0.08, grit: 0, wob: 12, fm: 0.35, fmr: 3.5, dark: 12, gain: 0.93 },
  void: { f: 115, parts: [1, 1.414, 2.83], ring: 0.6, wave: 'sine', band: 420, q: 0.7, grain: 0.3, grit: 0, wob: 25, fm: 0.8, fmr: 1.41, dark: 4, gain: 1.3 },
  air: { f: 950, parts: [1], ring: 0.08, wave: 'sine', band: 1900, q: 1.1, grain: 0.95, grit: 0, wob: 0, fm: 0, fmr: 1, dark: 4, gain: 0.94 },
  ember: { f: 210, parts: [1, 2.2], ring: 0.07, wave: 'sawtooth', band: 2600, q: 0.9, grain: 0.85, grit: 0, wob: 0, fm: 0, fmr: 1, dark: 3, gain: 1.06 },
};

/**
 * What a move's type adds to every sound it plays, so a move the Fitter retunes sounds a little different: a pitch and
 * band shift, vibrato in cents, a tremble depth, extra metallic modulation, a filter that opens and shuts, a beating twin in
 * cents, a rough flutter on noise, a slower or quicker attack, and a darker tone.
 */
interface Tint { pitch: number; band: number; vib: number; trem: number; fm: number; mouth: boolean; twin: number; grit: number; atk: number; dark: number }
const PLAIN: Tint = { pitch: 1, band: 1, vib: 0, trem: 0, fm: 0, mouth: false, twin: 0, grit: 0, atk: 1, dark: 1 };
const TINTS: Record<Type, Tint> = {
  STONE: { ...PLAIN, pitch: 0.95, band: 0.95, grit: 30 },
  TIDE: { ...PLAIN, vib: 35, atk: 1.4 },
  ROOT: { ...PLAIN, pitch: 0.98, band: 0.9, atk: 1.1, dark: 0.8 },
  GEAR: { ...PLAIN, pitch: 1.04, band: 1.05, fm: 0.9, atk: 0.8 },
  BEAST: { ...PLAIN, pitch: 0.97, mouth: true },
  STAR: { ...PLAIN, pitch: 1.06, band: 1.1, vib: 8, trem: 0.25 },
  SALT: { ...PLAIN, pitch: 1.02, band: 1.1, grit: 52, atk: 0.9 },
  VOID: { ...PLAIN, pitch: 0.92, band: 0.9, twin: 8, atk: 1.5 },
};

/** Where a pitched sound's main pitch sits as a multiple of its material's pitch, so a note word lands on that note. */
const NOTE_AT: Record<string, number> = {
  knock: 1.25, chime: 2, toll: 0.5, pluck: 1, gulp: 1.15, pop: 1, chirp: 2.1, ring: 2, whistle: 2.3, hum: 1, buzz: 0.7, pipe: 1,
  swell: 1, creak: 3.2, howl: 1.2, growl: 0.45, warble: 1.5,
};

/** Evens out how loud each sound word plays, measured over every material (Notes/move-sounds.md, "Loudness"). */
const ACT_GAIN: Record<string, number> = {
  thud: 1.05, knock: 0.88, crack: 2.07, snap: 3.05, crunch: 2.14, shatter: 1.58, chime: 0.53, toll: 0.56, pluck: 1.35, gulp: 1.32,
  pop: 1.46, splash: 1.84, boom: 0.75, chirp: 0.74, zap: 2.16, ring: 0.46, hiss: 0.72, whoosh: 0.5, whistle: 0.68, hum: 0.57,
  buzz: 1.08, pipe: 0.5, rattle: 0.62, scrape: 0.79, rumble: 0.7, crackle: 0.6, fizz: 0.81, rustle: 0.75, swell: 0.63, creak: 0.62,
  howl: 0.63, growl: 1.24, warble: 0.51, drip: 1.82, gurgle: 1.22,
};

// ---------------------------------------------------------------- legendary motifs

/** One note of a motif: when it plays in beats, its pitch in semitones over the root, its sound word, its material, its length in beats when it holds, and its level. */
interface Step { at: number; semi: number; act: string; mat?: string; beats?: number; vol?: number }
/** A legendary's motif: its root in Hz, the length of a beat in seconds, its material, and its notes. */
interface MotifDef { root: number; beat: number; mat: string; steps: Step[] }

const MOTIF_DEFS: Record<string, MotifDef> = {
  // The moon draws the tide up: four star bells climb a fifth, an octave, and a ninth over a rising swell of water.
  full: { root: 440, beat: 0.12, mat: 'star', steps: [
    { at: 0, semi: 0, act: 'chime' }, { at: 1, semi: 7, act: 'chime', vol: 0.9 }, { at: 2, semi: 12, act: 'chime', vol: 0.85 }, { at: 3, semi: 14, act: 'chime', vol: 0.95 },
    { at: 0, semi: -12, act: 'swell', mat: 'water', beats: 4, vol: 0.45 },
  ] },
  // The old Volute's heart: two low beats, the second softer and lower, and a shell ringing out over them.
  mundane: { root: 130, beat: 0.17, mat: 'shell', steps: [
    { at: 0, semi: 0, act: 'thud', mat: 'fur' }, { at: 1, semi: -2, act: 'thud', mat: 'fur', vol: 0.7 },
    { at: 0, semi: 12, act: 'knock', mat: 'shell', vol: 0.5 }, { at: 2.2, semi: 24, act: 'ring', beats: 3, vol: 0.6 },
  ] },
  // The Holdfast's key: three ratchet clicks a semitone apart, then the key turns home a fourth below with a stony clunk.
  knot: { root: 880, beat: 0.075, mat: 'gear', steps: [
    { at: 0, semi: 0, act: 'knock', vol: 0.75 }, { at: 1, semi: 1, act: 'knock', vol: 0.85 }, { at: 2, semi: 2, act: 'knock', vol: 0.95 },
    { at: 3.5, semi: -5, act: 'chime' }, { at: 3.5, semi: -24, act: 'thud', mat: 'stone', vol: 0.8 },
  ] },
  // An island with a house on its back: a low conch horn sounds twice, falling a fourth, over a slow sea.
  holm: { root: 110, beat: 0.22, mat: 'ember', steps: [
    { at: 0, semi: 0, act: 'pipe', beats: 1.6 }, { at: 1.9, semi: -5, act: 'pipe', beats: 2.6 },
    { at: 0, semi: 0, act: 'rumble', mat: 'water', beats: 4.5, vol: 0.5 },
  ] },
  // A collar of set stones: four gems chime up a major chord, pearl, amber, beach glass, and star glass.
  carcanet: { root: 659, beat: 0.085, mat: 'glass', steps: [
    { at: 0, semi: 0, act: 'chime', mat: 'shell' }, { at: 1, semi: 4, act: 'chime', mat: 'root' }, { at: 2, semi: 7, act: 'chime', mat: 'glass' }, { at: 3, semi: 12, act: 'chime', mat: 'star' },
  ] },
  // The Gleaner listens: a low hollow hum leans up a minor third, and a thin whistle answers far off.
  gleaner: { root: 110, beat: 0.2, mat: 'void', steps: [
    { at: 0, semi: 0, act: 'hum', beats: 1.2 }, { at: 1, semi: 3, act: 'hum', beats: 1.8, vol: 0.9 },
    { at: 2.4, semi: 31, act: 'whistle', mat: 'air', beats: 1.8, vol: 0.45 },
  ] },
};

// ---------------------------------------------------------------- the synth

/** One sound word as it plays: where, when, its pitch and band, its part's length, its level, material, and type. */
interface Hit {
  o: Out;
  bus: AudioNode;
  /** Start time in the context's clock. */
  t: number;
  P: number;
  B: number;
  /** The part's length in seconds, for sounds that fill it. */
  S: number;
  L: number;
  M: Mat;
  tint: Tint;
  r: () => number;
  pan: [number, number];
  bend: number;
  /** A length multiplier for strikes. */
  len: number;
  end: number;
}

/** A small seeded generator, so a move's sound varies by its id and never by chance. */
function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A path as automation values, gliding geometrically between its points. */
function glide(pts: number[], n = 48): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (pts.length === 1) { c[i] = pts[0]; continue; }
    const p = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(p)), u = p - k;
    c[i] = pts[k] * Math.pow(pts[k + 1] / pts[k], u);
  }
  return c;
}

/** An envelope as automation values, fine enough that a 3 ms attack stays 3 ms on a long ring. */
function curve(kind: Env, dur: number, a: number, peak: number, vol: number): Float32Array {
  const n = Math.min(4096, Math.max(64, Math.ceil(dur / 0.0025)));
  const c = new Float32Array(n), fa = Math.min(0.9, Math.max(1e-4, a / dur));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    let g = 0;
    if (kind === 'hit') g = u < fa ? u / fa : Math.exp(-5.5 * (u - fa) / (1 - fa));
    else if (kind === 'hold') g = u < fa ? u / fa : u < 0.72 ? 1 : Math.exp(-5 * (u - 0.72) / 0.28);
    else if (kind === 'swell') g = u < peak ? Math.sin((Math.PI / 2) * (u / peak)) ** 2 : Math.pow(1 - (u - peak) / (1 - peak), 1.6);
    else g = u < 0.9 ? Math.pow(u / 0.9, 1.5) : 1 - (u - 0.9) / 0.1;
    c[i] = g * vol;
  }
  c[n - 1] = 0;
  return c;
}

/** A slow oscillator that wobbles parameters around their values. */
function lfo(a: BaseAudioContext, t: number, end: number, rate: number, depth: number, into: AudioParam[], type: OscillatorType = 'sine', rate2?: number): void {
  const l = a.createOscillator();
  l.type = type;
  l.frequency.setValueAtTime(rate, t);
  if (rate2) l.frequency.linearRampToValueAtTime(rate2, end);
  const g = a.createGain();
  g.gain.value = depth;
  l.connect(g);
  for (const p of into) g.connect(p);
  l.start(t);
  l.stop(end + 0.05);
}

const BUFS = new WeakMap<BaseAudioContext, Map<Buf, AudioBuffer>>();

/** A two-second noise texture, made once per context: white, sparse crackle, dense crackle, steady ticks, or uneven rustle. */
function buffer(a: BaseAudioContext, kind: Buf): AudioBuffer {
  let m = BUFS.get(a);
  if (!m) BUFS.set(a, (m = new Map()));
  const have = m.get(kind);
  if (have) return have;
  const sr = a.sampleRate, n = sr * 2, b = a.createBuffer(1, n, sr), d = b.getChannelData(0);
  let s = 12345 + kind.length * 7919;
  const rnd = (): number => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const burst = (at: number, amp: number, len: number): void => { for (let i = 0; i < len && at + i < n; i++) d[at + i] += (rnd() * 2 - 1) * amp * Math.exp((-4 * i) / len); };
  const poisson = (rate: number): number => Math.max(1, Math.round((sr * -Math.log(1 - rnd() * 0.999)) / rate));
  if (kind === 'white') for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  else if (kind === 'dust') for (let t = 0; t < n; t += poisson(70)) burst(t, 0.3 + rnd() * 0.7, Math.round(sr * (0.0008 + rnd() * 0.0015)));
  else if (kind === 'dense') for (let t = 0; t < n; t += poisson(520)) burst(t, 0.3 + rnd() * 0.7, Math.round(sr * 0.0006));
  else if (kind === 'tick') for (let t = 0; t < n; t += Math.round((sr / 20) * (0.9 + rnd() * 0.2))) burst(t, 0.7 + rnd() * 0.3, Math.round(sr * 0.0025));
  else {
    // The brushing level changes 80 times a second, so any 100 ms of it is about as loud as any other.
    let v = 0, goal = 0;
    const step = Math.round(sr / 80);
    for (let i = 0; i < n; i++) {
      if (i % step === 0) goal = 0.15 + (rnd() < 0.35 ? 0.85 * rnd() : 0.25 * rnd());
      v += (goal - v) * 0.01;
      d[i] = (rnd() * 2 - 1) * v;
    }
  }
  // Every texture has white noise's loudness, so changing the texture never changes how loud a sound is. The rounding
  // between the two passes keeps a sparse texture's clicks from peaking far above its loudness.
  for (let pass = 0; pass < 2; pass++) {
    let e = 0;
    for (let i = 0; i < n; i++) e += d[i] * d[i];
    const k = 0.577 / Math.sqrt(e / n || 1);
    for (let i = 0; i < n; i++) d[i] = pass ? d[i] * k : 1.6 * Math.tanh((d[i] * k) / 1.6);
  }
  m.set(kind, b);
  return b;
}

/** Sends a voice out through a panner that slides from the sound's start pan to its end pan. */
function out(h: Hit, node: AudioNode, off: number, t: number, end: number): void {
  const a = h.o.a, p0 = Math.max(-1, Math.min(1, h.pan[0] + off)), p1 = Math.max(-1, Math.min(1, h.pan[1] + off));
  const p = a.createStereoPanner();
  p.pan.setValueAtTime(p0, t);
  if (p1 !== p0) p.pan.linearRampToValueAtTime(p1, end);
  node.connect(p);
  p.connect(h.bus);
}

const bendOf = (f: number[], bend: number, up: number, down: number): number[] => {
  if (!bend) return f;
  const pts = f.length === 1 ? [f[0], f[0]] : f;
  return pts.map((x, i) => x * (bend > 0 ? 1 + (up * i) / (pts.length - 1) : 1 - (down * i) / (pts.length - 1)));
};

interface ToneV {
  w?: OscillatorType; f: number[]; at?: number; dur: number; vol: number; env?: Env; a?: number; peak?: number;
  vib?: [number, number, number?]; trem?: [number, number, OscillatorType?]; fm?: [number, number, number?];
  lp?: [number[], number]; bp?: [number[], number]; wide?: number; pan?: number;
}

/** One oscillator voice of a sound, with the type's tint laid over it. */
function tone(h: Hit, v: ToneV): void {
  if (v.vol <= 0) return;
  const a = h.o.a, T = h.tint, t = h.t + (v.at || 0), dur = Math.max(0.012, v.dur), end = t + dur;
  const f = bendOf(v.f, h.bend, 0.5, 0.38).map(x => Math.min(12000, Math.max(16, x)));
  const wave = v.w || h.M.wave, twin = v.wide ?? T.twin;
  const env = a.createGain();
  env.gain.value = 0;
  const lvl = v.vol * h.L * (twin ? 0.55 : 1) * (wave === 'square' ? 0.6 : 1);
  env.gain.setValueCurveAtTime(curve(v.env || 'hit', dur, (v.a ?? 0.004) * T.atk, v.peak ?? 0.5, lvl), t, dur);
  out(h, env, v.pan || 0, t, end);
  let into: AudioNode = env;
  const trem = v.trem || (T.trem ? ([12, T.trem] as [number, number]) : undefined);
  if (trem) {
    const g = a.createGain();
    g.gain.value = 1 - trem[1] / 2;
    lfo(a, t, end, trem[0], trem[1] / 2, [g.gain], trem[2]);
    g.connect(into);
    into = g;
  }
  let filt: { type: BiquadFilterType; f: number[]; q: number } | null = v.lp ? { type: 'lowpass', f: v.lp[0], q: v.lp[1] } : v.bp ? { type: 'bandpass', f: v.bp[0], q: v.bp[1] } : null;
  if (!filt && T.mouth) filt = { type: 'lowpass', f: [f[0] * 2, f[0] * 6, f[0] * 2.2], q: 3 };
  if (!filt && T.dark < 1 && wave !== 'sine') filt = { type: 'lowpass', f: [f[0] * h.M.dark], q: 0.7 };
  if (filt) {
    const fl = a.createBiquadFilter();
    fl.type = filt.type;
    fl.Q.value = filt.q;
    fl.frequency.setValueCurveAtTime(glide(filt.f.map(x => Math.min(a.sampleRate * 0.45, Math.max(30, x * T.dark)))), t, dur);
    fl.connect(into);
    into = fl;
  }
  const pitch = glide(f);
  const oscs = (twin ? [0, twin] : [0]).map(dt => {
    const s = a.createOscillator();
    s.type = wave;
    s.frequency.setValueCurveAtTime(pitch, t, dur);
    s.detune.value = dt;
    s.connect(into);
    s.start(t);
    s.stop(end + 0.05);
    return s;
  });
  const vib = v.vib ? [v.vib[0], v.vib[1] + T.vib, v.vib[2]] : T.vib ? [9, T.vib] : null;
  if (vib) lfo(a, t, end, vib[0]!, vib[1]!, oscs.map(s => s.detune), 'sine', vib[2]);
  const fm = v.fm ? [v.fm[0], v.fm[1] + T.fm, (v.fm[2] ?? v.fm[1]) + T.fm * 0.3] : T.fm ? [h.M.fmr || 2.4, T.fm, T.fm * 0.3] : null;
  if (fm && fm[1] + fm[2] > 0) {
    const m = a.createOscillator(), mg = a.createGain();
    m.frequency.setValueCurveAtTime(pitch.map(x => x * fm[0]), t, dur);
    mg.gain.setValueCurveAtTime(pitch.map((x, i) => x * (fm[1] + ((fm[2] - fm[1]) * i) / (pitch.length - 1))), t, dur);
    m.connect(mg);
    for (const s of oscs) mg.connect(s.frequency);
    m.start(t);
    m.stop(end + 0.05);
  }
  h.end = Math.max(h.end, end);
}

interface NoiseV { buf?: Buf; rate?: number; f: number[]; q: number; at?: number; dur: number; vol: number; env?: Env; a?: number; peak?: number; trem?: [number, number, OscillatorType?]; pan?: number }

/** One band of noise. A narrower band passes less noise, so its level rises to match and a sound's Q never sets its loudness. */
function noise(h: Hit, v: NoiseV): void {
  if (v.vol <= 0) return;
  const a = h.o.a, T = h.tint, t = h.t + (v.at || 0), dur = Math.max(0.008, v.dur), end = t + dur;
  const f = bendOf(v.f, h.bend, 0.3, 0.25).map(x => Math.min(a.sampleRate * 0.45, Math.max(30, x)));
  const q = Math.max(0.3, v.q);
  const k = Math.min(14, 1.225 * Math.sqrt(a.sampleRate / 2 / (f[0] / q)));
  const env = a.createGain();
  env.gain.value = 0;
  env.gain.setValueCurveAtTime(curve(v.env || 'hit', dur, v.a ?? 0.003, v.peak ?? 0.5, v.vol * h.L * k * 0.35), t, dur);
  out(h, env, v.pan || 0, t, end);
  let into: AudioNode = env;
  const trem = v.trem || (T.grit ? ([T.grit, 0.35] as [number, number]) : undefined);
  if (trem) {
    const g = a.createGain();
    g.gain.value = 1 - trem[1] / 2;
    lfo(a, t, end, trem[0], trem[1] / 2, [g.gain], trem[2]);
    g.connect(into);
    into = g;
  }
  const fl = a.createBiquadFilter();
  fl.type = 'bandpass';
  fl.Q.value = q;
  fl.frequency.setValueCurveAtTime(glide(f), t, dur);
  fl.connect(into);
  const s = a.createBufferSource();
  s.buffer = buffer(a, v.buf || 'white');
  s.loop = true;
  s.playbackRate.value = v.rate || 1;
  s.connect(fl);
  s.start(t, Math.random() * 1.5);
  s.stop(end + 0.05);
  h.end = Math.max(h.end, end);
}

// ---------------------------------------------------------------- the sound words

const part = (M: Mat, i: number): number => M.parts[Math.min(i, M.parts.length - 1)] * (i >= M.parts.length ? 1.5 : 1);

/** Each sound word as voices. P is the material's pitch, B its noise band, S its part's length, and `len` stretches strikes. */
const ACTS: Record<string, (h: Hit) => void> = {
  thud(h) {
    const d = 0.17 * h.len;
    tone(h, { w: 'sine', f: [h.P * 0.55, h.P * 0.3], dur: d, vol: 1, a: 0.003 });
    tone(h, { w: 'triangle', f: [h.P * 1.5, h.P * 0.9], dur: 0.07 * h.len, vol: 0.5, a: 0.002 });
    noise(h, { f: [h.B * 0.5, h.B * 0.25], q: 1.2, dur: d * 0.6, vol: 0.8 * h.M.grain, a: 0.002 });
  },
  knock(h) {
    const p = h.P * 1.25, d = (0.07 + h.M.ring * 0.6) * h.len;
    tone(h, { w: 'sine', f: [p * 1.02, p], dur: d, vol: 1, a: 0.002 });
    tone(h, { w: 'sine', f: [p * part(h.M, 1)], dur: d * 0.55, vol: 0.45, a: 0.002 });
    noise(h, { f: [h.B * 1.3], q: 3, dur: 0.014, vol: 0.5, a: 0.001 });
  },
  crack(h) {
    const d = 0.11 * h.len, fm: [number, number, number] | undefined = h.M.fm ? [h.M.fmr, h.M.fm, 0] : undefined;
    noise(h, { f: [h.B * 1.7, h.B * 0.9], q: 1.3, dur: d * 0.7, vol: 1.1 * (0.5 + 0.5 * h.M.grain), a: 0.001 });
    tone(h, { w: 'sine', f: [h.P * 2 * part(h.M, 1), h.P * 2 * part(h.M, 1) * 0.97], dur: 0.05 + h.M.ring * 0.3, vol: 0.35, a: 0.001, fm });
    tone(h, { w: 'sine', f: [h.P * 2 * part(h.M, 2)], dur: 0.04 + h.M.ring * 0.2, vol: 0.2, a: 0.001 });
    noise(h, { f: [h.B * 0.7, h.B * 0.5], q: 0.9, dur: d * 1.6, vol: 0.45, a: 0.004, trem: [h.M.grit || 40, 0.8] });
  },
  snap(h) {
    noise(h, { f: [h.B * 2.2], q: 2, dur: 0.016 * h.len, vol: 1, a: 0.0008 });
    tone(h, { w: 'sine', f: [h.P * 3, h.P * 2.6], dur: 0.045 * h.len, vol: 0.35, a: 0.001 });
  },
  crunch(h) {
    const d = 0.13 * h.len;
    noise(h, { buf: 'dust', rate: 1.6, f: [h.B * 1.2, h.B * 0.8], q: 1.5, dur: d, vol: 1.3, a: 0.002 });
    noise(h, { f: [h.B * 0.6], q: 1, dur: d * 0.5, vol: 0.45, a: 0.002 });
    tone(h, { w: 'sine', f: [h.P * 0.8, h.P * 0.5], dur: 0.06 * h.len, vol: 0.35, a: 0.002 });
  },
  shatter(h) {
    noise(h, { f: [h.B * 2, h.B * 1.1], q: 1.2, dur: 0.08 * h.len, vol: 1, a: 0.001 });
    for (let k = 0; k < 5; k++) {
      const f0 = h.P * 2.6 * part(h.M, k % 3) * (0.9 + 0.2 * h.r());
      tone(h, { w: 'sine', f: [f0, f0 * 0.98], at: 0.02 + k * 0.045 * (0.7 + 0.6 * h.r()) * h.len, dur: 0.05 + h.M.ring * 0.25, vol: 0.32 * (1 - k * 0.12), a: 0.001, pan: (h.r() - 0.5) * 0.5 });
    }
    noise(h, { buf: 'dust', f: [h.B * 2.2], q: 2, at: 0.03, dur: 0.3 * h.len, vol: 0.7, a: 0.003 });
  },
  chime(h) {
    const d = (0.25 + h.M.ring) * h.len, fm: [number, number, number] | undefined = h.M.fm ? [h.M.fmr, h.M.fm * 0.4, 0] : undefined;
    [1, 0.5, 0.3].forEach((v, i) => tone(h, { w: 'sine', f: [h.P * 2 * part(h.M, i)], dur: d * (1 - 0.25 * i), vol: v, a: 0.002, fm: i === 0 ? fm : undefined }));
    noise(h, { f: [h.B * 1.5], q: 4, dur: 0.012, vol: 0.25, a: 0.001 });
  },
  toll(h) {
    const p = h.P * 0.5, d = (0.8 + h.M.ring * 1.2) * h.len;
    tone(h, { w: 'sine', f: [p, p * 0.997], dur: d, vol: 1, a: 0.003, fm: [2.76, 2.2, 0.15], lp: [[p * 7, p * 1.6], 0.7] });
    tone(h, { w: 'sine', f: [p * 2, p * 1.995], dur: d * 0.6, vol: 0.4, a: 0.003 });
    tone(h, { w: 'sine', f: [Math.max(50, p * 0.5)], dur: d * 0.8, vol: 0.3, a: 0.01 });
    noise(h, { f: [h.B], q: 3, dur: 0.02, vol: 0.3, a: 0.001 });
  },
  pluck(h) {
    const d = (0.2 + h.M.ring * 0.8) * h.len;
    tone(h, { w: h.M.wave === 'square' ? 'square' : 'sawtooth', f: [h.P, h.P * 0.997], dur: d, vol: 0.7, a: 0.002, lp: [[h.P * 10, h.P * 1.5], 3] });
    noise(h, { f: [h.B * 1.4], q: 2, dur: 0.01, vol: 0.35, a: 0.0008 });
  },
  gulp(h) {
    const d = 0.075 * h.len;
    tone(h, { w: 'sine', f: [h.P * 0.7, h.P * 1.9], dur: d, vol: 1, a: 0.004, fm: [1.5, 0.6, 0] });
    tone(h, { w: 'sine', f: [h.P * 0.9, h.P * 2.4], at: d * 0.75, dur: d * 0.7, vol: 0.45, a: 0.003 });
  },
  pop(h) {
    tone(h, { w: 'sine', f: [h.P * 1.6, h.P * 0.55], dur: 0.065 * h.len, vol: 1, a: 0.002 });
    noise(h, { f: [h.B * 0.9], q: 1.2, dur: 0.022, vol: 0.5, a: 0.001 });
  },
  splash(h) {
    const d = 0.28 * h.len;
    noise(h, { f: [h.B * 1.5, h.B * 0.45], q: 0.8, dur: d, vol: 1.1, a: 0.003 });
    for (let k = 0; k < 3; k++) {
      const f0 = h.P * 1.3 * (0.8 + 0.5 * h.r());
      tone(h, { w: 'sine', f: [f0, f0 * 2], at: (0.05 + k * 0.065 * (0.7 + 0.6 * h.r())) * h.len, dur: 0.045, vol: 0.32, a: 0.003, pan: (h.r() - 0.5) * 0.4 });
    }
  },
  boom(h) {
    const d = 0.6 * h.len;
    tone(h, { w: 'sine', f: [Math.max(48, h.P * 0.42), Math.max(30, h.P * 0.2)], dur: d, vol: 1.1, a: 0.004, fm: [0.5, 1.4, 0] });
    noise(h, { f: [Math.max(150, h.B * 0.3), Math.max(60, h.B * 0.08)], q: 0.7, dur: d * 1.1, vol: 0.9, a: 0.01 });
    tone(h, { w: 'triangle', f: [h.P * 1.6, h.P * 0.8], dur: 0.08 * h.len, vol: 0.45, a: 0.002 });
  },
  chirp(h) {
    tone(h, { w: 'sine', f: [h.P * 1.5, h.P * 2.9, h.P * 2.6], dur: 0.075 * h.len, vol: 0.9, a: 0.005, vib: [30, 40], env: 'swell', peak: 0.35 });
  },
  zap(h) {
    const d = 0.13 * h.len;
    tone(h, { w: 'sawtooth', f: [h.P * 5, h.P * 0.9], dur: d, vol: 0.6, a: 0.001, lp: [[h.P * 16, h.P * 3], 2] });
    noise(h, { f: [h.B * 1.8, h.B * 0.6], q: 2, dur: d * 0.6, vol: 0.5, a: 0.001, trem: [70, 0.9, 'square'] });
  },
  ring(h) {
    const d = Math.max(h.S, 0.35 + h.M.ring) * h.len;
    tone(h, { w: 'sine', f: [h.P * 2], dur: d, vol: 0.8, a: 0.004, trem: [5 + 2 * h.r(), 0.3] });
    tone(h, { w: 'sine', f: [h.P * 2 * 1.006], dur: d, vol: 0.55, a: 0.004 });
    tone(h, { w: 'sine', f: [h.P * 2 * part(h.M, 1)], dur: d * 0.5, vol: 0.25, a: 0.003 });
    noise(h, { f: [h.B * 1.6], q: 4, dur: 0.012, vol: 0.25, a: 0.001 });
  },
  hiss(h) {
    noise(h, { f: [h.B * 0.9, h.B * 1.1], q: Math.max(0.6, h.M.q * 0.7), dur: h.S, vol: 0.9, env: 'hold', a: Math.min(0.05, h.S * 0.25) });
  },
  whoosh(h) {
    noise(h, { f: [h.B * 0.35, h.B * 1.25, h.B * 0.5], q: 1.6, dur: h.S, vol: 1, env: 'swell', peak: 0.55 });
  },
  whistle(h) {
    tone(h, { w: 'sine', f: [h.P * 2.6, h.P * 2], dur: h.S, vol: 0.45, vib: [6, 18], env: 'swell', peak: 0.4 });
    noise(h, { f: [h.P * 3.4], q: 7, dur: h.S, vol: 0.3, env: 'swell', peak: 0.4 });
  },
  hum(h) {
    tone(h, { f: [h.P, h.P * 1.005], dur: h.S, vol: 0.55, vib: [5.5, 14], env: 'hold', a: Math.min(0.06, h.S * 0.3), lp: [[h.P * h.M.dark * 0.7], 1] });
  },
  buzz(h) {
    tone(h, { w: 'sawtooth', f: [h.P * 0.7, h.P * 0.72], dur: h.S, vol: 0.5, env: 'hold', a: 0.01, trem: [h.M.grit || 55, 0.7, 'square'], lp: [[h.P * 5], 3] });
  },
  pipe(h) {
    // A sine material blows a flute's breathy pipe, and a buzzier one a reed or a conch through a closing mouth.
    const reed = h.M.wave !== 'sine';
    noise(h, { f: [h.P * 3], q: 3, dur: 0.05, vol: 0.4, a: 0.003 });
    tone(h, { w: reed ? h.M.wave : 'triangle', f: [h.P], dur: h.S, vol: 0.6, vib: [5, 8], env: 'hold', a: 0.03, lp: reed ? [[h.P * 3, h.P * 5, h.P * 3.5], 2] : undefined });
    tone(h, { w: 'sine', f: [h.P * 2], dur: h.S, vol: 0.25, env: 'hold', a: 0.04 });
    tone(h, { w: 'sine', f: [h.P * 3], dur: h.S, vol: 0.12, env: 'hold', a: 0.05 });
    noise(h, { f: [h.P * 2], q: 6, dur: h.S, vol: 0.12, env: 'hold', a: 0.03 });
  },
  rattle(h) {
    noise(h, { buf: 'tick', rate: (16 + 10 * h.r()) / 20, f: [h.B * 1.1], q: 2.5, dur: h.S, vol: 1.1, env: 'hold', a: 0.005 });
  },
  scrape(h) {
    noise(h, { f: [h.B * 0.75, h.B * 1.15, h.B * 0.85], q: 2.2, dur: h.S, vol: 1, env: 'hold', a: 0.02, trem: [(h.M.grit || 38) * (0.85 + 0.3 * h.r()), 0.85, 'sawtooth'] });
  },
  rumble(h) {
    noise(h, { f: [Math.max(70, h.B * 0.12), Math.max(55, h.B * 0.09)], q: 0.6, dur: h.S, vol: 1.2, env: 'swell', peak: 0.3, trem: [7 + 3 * h.r(), 0.6] });
    tone(h, { w: 'sine', f: [Math.max(40, h.P * 0.3), Math.max(34, h.P * 0.26)], dur: h.S, vol: 0.5, env: 'swell', peak: 0.3 });
  },
  crackle(h) {
    noise(h, { buf: 'dust', rate: 0.8 + 0.5 * h.r(), f: [h.B], q: 1.1, dur: h.S, vol: 1.2, env: 'hold', a: 0.01 });
  },
  fizz(h) {
    noise(h, { buf: 'dense', f: [h.B * 1.8, h.B * 2.2], q: 0.9, dur: h.S, vol: 0.9, env: 'hold', a: 0.01 });
    for (let k = 0; k < 3; k++) { const f0 = h.P * 3 * (0.8 + 0.4 * h.r()); tone(h, { w: 'sine', f: [f0, f0 * 1.7], at: h.S * h.r() * 0.8, dur: 0.03, vol: 0.2, a: 0.002 }); }
  },
  rustle(h) {
    noise(h, { buf: 'rustle', rate: 0.9 + 0.3 * h.r(), f: [h.B * 1.4], q: 0.8, dur: h.S, vol: 1, env: 'hold', a: 0.02 });
  },
  swell(h) {
    tone(h, { w: h.M.wave === 'square' ? 'triangle' : h.M.wave, f: [h.P * 0.6, h.P * 1.5], dur: h.S, vol: 0.6, env: 'rise', vib: [4, 20, 9] });
    noise(h, { f: [h.B * 0.5, h.B * 1.3], q: 2, dur: h.S, vol: 0.35, env: 'rise' });
  },
  creak(h) {
    noise(h, { buf: 'tick', rate: (12 + 8 * h.r()) / 20, f: [h.P * 3.2, h.P * 3.4, h.P * 3], q: 9, dur: h.S, vol: 1.1, env: 'hold', a: 0.03 });
  },
  howl(h) {
    tone(h, { w: 'triangle', f: [h.P * 0.9, h.P * 1.5, h.P * 1.2], dur: h.S, vol: 0.6, vib: [5.5, 35], env: 'swell', peak: 0.45, lp: [[h.P * 2, h.P * 5, h.P * 2.5], 2] });
    noise(h, { f: [h.P * 3], q: 3, dur: h.S, vol: 0.15, env: 'swell', peak: 0.45 });
  },
  growl(h) {
    tone(h, { w: 'sawtooth', f: [h.P * 0.42, h.P * 0.48, h.P * 0.4], dur: h.S, vol: 0.6, env: 'swell', peak: 0.35, trem: [26 + 8 * h.r(), 0.75], lp: [[h.P * 1.4, h.P * 3.5, h.P * 1.6], 4], fm: [0.5, 0.6, 0.2] });
  },
  warble(h) {
    tone(h, { w: 'sine', f: [h.P * 1.5, h.P * 1.6], dur: h.S, vol: 0.55, vib: [11 + 4 * h.r(), 110], env: 'hold', a: 0.02 });
  },
  drip(h) {
    const n = Math.max(2, Math.min(6, Math.round(h.S * 7)));
    for (let k = 0; k < n; k++) {
      const f0 = h.P * 1.7 * (0.9 + 0.25 * h.r());
      tone(h, { w: 'sine', f: [f0, f0 * 1.9], at: (k * h.S) / n + h.r() * 0.02, dur: 0.04, vol: 0.6 * (1 - k * 0.08), a: 0.002, pan: (h.r() - 0.5) * 0.3 });
    }
  },
  gurgle(h) {
    const n = Math.max(3, Math.min(8, Math.round(h.S * 12)));
    for (let k = 0; k < n; k++) tone(h, { w: 'sine', f: [h.P * 0.55 * (0.8 + 0.5 * h.r()), h.P * 1.3 * (0.8 + 0.5 * h.r())], at: h.r() * h.S * 0.9, dur: 0.05 + 0.03 * h.r(), vol: 0.5, a: 0.004, fm: [1.5, 0.5, 0] });
    noise(h, { f: [h.B * 0.45], q: 2, dur: h.S, vol: 0.5, env: 'hold', trem: [10 + 4 * h.r(), 0.7] });
  },
};

// ---------------------------------------------------------------- playing a spec

const buses = new WeakMap<AudioNode, AudioNode>(), legendBuses = new WeakMap<AudioNode, AudioNode>();

/** The move sounds' own bus on a destination: their share of the effects volume, and a limiter that catches a pile-up. */
function busOf(o: Out): AudioNode {
  let b = buses.get(o.dest);
  if (!b) {
    const g = o.a.createGain(), c = o.a.createDynamicsCompressor();
    g.gain.value = MOVE_GAIN;
    c.threshold.value = -8; c.knee.value = 6; c.ratio.value = 8; c.attack.value = 0.003; c.release.value = 0.12;
    g.connect(c);
    c.connect(o.dest);
    buses.set(o.dest, g);
    b = g;
  }
  return b;
}

/** A legendary's bus: the move sounds' bus with an echo that repeats every 0.21 seconds, darker each time, so its sounds ring on. */
function legendBusOf(o: Out): AudioNode {
  let b = legendBuses.get(o.dest);
  if (!b) {
    const a = o.a, dry = busOf(o), g = a.createGain(), d = a.createDelay(1), lp = a.createBiquadFilter(), fb = a.createGain(), wet = a.createGain();
    d.delayTime.value = 0.21;
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    fb.gain.value = 0.34;
    wet.gain.value = 0.4;
    g.connect(dry);
    g.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(dry);
    legendBuses.set(o.dest, g);
    b = g;
  }
  return b;
}

/** How a sound word plays within its part: the move's type and seed, whether it is a crest or a legendary's, the speed, its part's length in seconds, its pan, and its level. */
interface Place { type: Type; seed: number; crest: boolean; legend: boolean; spd: number; span: number; pan: [number, number]; vol: number }

/** Plays one sound word `at` seconds after `o.t`. Returns when its last voice ends, in the context's clock. */
function playLayer(o: Out, at: number, ly: SoundLayer, pl: Place): number {
  if (ly.motif) return playMotif(o, at, ly, pl);
  const M = MATS[ly.mat || TYPE_MATERIAL[pl.type]] || MATS.stone, T = TINTS[pl.type] || PLAIN;
  const r = rng(pl.seed), act = ACTS[ly.act], hold = ACTIONS[ly.act].hold;
  const semis = Math.pow(2, ly.shift / 12);
  const P = ly.note !== null ? ly.note / (NOTE_AT[ly.act] || 1)
    : M.f * semis * Math.pow(2, ((r() - 0.5) * 3) / 12) * (1 + (Math.random() - 0.5) * 0.016) * T.pitch * (pl.crest ? 0.89 : 1);
  const B = M.band * Math.pow(semis, 0.6) * (0.88 + r() * 0.24) * T.band * (ly.vol > 1 ? 1.15 : 1);
  const len = ly.len * (pl.crest ? 1.25 : 1) * (pl.legend ? LEGEND_LEN : 1) * (0.9 + r() * 0.2) * (hold ? 1 : Math.pow(pl.spd, -0.5));
  const S = Math.max(0.06, pl.span * (hold ? ly.len : 1));
  const L = (ACT_GAIN[ly.act] ?? 1) * M.gain * ly.vol * pl.vol;
  const bus = pl.legend ? legendBusOf(o) : busOf(o), n = ly.n, gap = Math.max(0.06, Math.min(0.2, S / n));
  let end = o.t + at;
  for (let k = 0; k < n; k++) {
    for (const off of ly.wide ? [-0.22, 0.22] : [0]) {
      const h: Hit = {
        o, bus, t: o.t + at + (hold ? (k * S) / n : k * gap), P: P * (k % 2 ? 0.94 : 1) * (1 + off * 0.02), B, S: hold ? (S / n) * (n > 1 ? 0.85 : 1) : S,
        L: L * (1 - 0.14 * k) * (ly.wide ? 0.55 : 1), M, tint: T, r: rng(pl.seed + k * 101 + (off > 0 ? 7 : 0)), pan: [pl.pan[0] + off, pl.pan[1] + off], bend: ly.bend, len, end: 0,
      };
      act(h);
      end = Math.max(end, h.end);
    }
  }
  return end;
}

/** The music's root as a pitch class, or null when no track plays. A motif moves to the nearest octave of it, so it agrees with the track under it. */
function musicRoot(): number | null {
  try { const h = music.harmony(); return h ? h.root : null; } catch { return null; }
}

/** Plays a legendary's motif as one sound word. Its modifiers change the whole tune: `short` keeps the first half, `long` slows it, and a note sets its root. */
function playMotif(o: Out, at: number, ly: SoundLayer, pl: Place): number {
  const def = MOTIF_DEFS[ly.motif!];
  if (!def) return o.t + at;
  let root = ly.note ?? def.root * Math.pow(2, ly.shift / 12);
  const pc = ly.note === null ? musicRoot() : null;
  if (pc !== null) {
    const now = ((Math.round(12 * Math.log2(root / 261.63)) % 12) + 12) % 12, d = (((pc - now) % 12) + 18) % 12 - 6;
    root *= Math.pow(2, d / 12);
  }
  const beat = def.beat * (ly.len > 1 ? 1.4 : 1) * Math.pow(pl.spd, -0.5);
  const steps = ly.len < 1 ? def.steps.filter(s => s.at < Math.max(...def.steps.map(x => x.at)) / 2 + 0.01) : def.steps;
  const tune = Math.max(...steps.map(s => s.at + (s.beats ?? 1))) * beat;
  let end = o.t + at;
  for (let k = 0; k < ly.n; k++) {
    steps.forEach((s, i) => {
      const hz = root * Math.pow(2, s.semi / 12);
      const step: SoundLayer = { mat: ly.mat || s.mat || def.mat, act: s.act, motif: null, shift: 0, note: hz, len: 1, vol: (s.vol ?? 1) * ly.vol * (1 - 0.15 * k), bend: ly.bend, wide: ly.wide, n: 1 };
      end = Math.max(end, playLayer(o, at + k * (tune + beat) + s.at * beat, step, { ...pl, span: (s.beats ?? 1) * beat, seed: pl.seed + i * 13 + k * 7 }));
    });
  }
  return end;
}

/** End times of the move sounds ringing now, for each context, so a pile of them thins out. */
const ringing = new WeakMap<BaseAudioContext, number[]>();

/** How many of `want` sounds may start at time t, under a cap. A landing's first sound always plays. */
function admit(o: Out, t: number, want: number, first: boolean, cap: number): number {
  let ends = ringing.get(o.a);
  if (!ends) ringing.set(o.a, (ends = []));
  for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= t) ends.splice(i, 1);
  const free = cap - ends.length;
  return first ? Math.max(1, Math.min(want, free)) : Math.max(0, Math.min(want, free));
}

/**
 * When each part of a sound plays, in picture frames: each cast as its start and length, each flight to the first target
 * as its start and length, each landing, how long a landing plays, the moment a lunge, stomp, or blink reaches its target,
 * the picture's end, the user's side, and whether it lands on the user's own side. `timesOf` reads them from a picture, and
 * a picture drawn some other way, or in stages, can build its own.
 */
export interface SoundTimes { casts: [number, number][]; flights: [number, number][]; hits: number[]; land: number; contact: number; end: number; side: 0 | 1; home: boolean }

/** A picture's timings for its sound. */
export function timesOf(r: FxRun): SoundTimes {
  const moved = r.motionAt.length ? r.motionAt[r.motionAt.length - 1] + r.motionLen[r.motionLen.length - 1] : 0;
  const held = r.plan.shape === 'beam' || r.plan.path === 'ray' ? 10 : 0;
  const hits = r.hits.map(h => h.at).sort((a, b) => a - b), last = hits.length ? hits[hits.length - 1] : 0;
  const scope = r.plan.to || 'foe';
  return {
    casts: [[0, moved || 8]], flights: r.flights.filter(f => f.to === 0).map(f => [f.t0, f.dur + held] as [number, number]), hits,
    land: Math.max(10, Math.min(24, r.end - 2 - last)), contact: Math.max(0, r.contact), end: r.end, side: r.side, home: scope === 'self' || scope === 'ally',
  };
}

/** A moment the sound plays a part: its frame in the picture, its length in frames, its place among its part's moments, and how many landings it stands for. */
interface Cue { frame: number; part: Part; span: number; k: number; n: number }

/** A move's sound as it plays alongside its picture. */
interface Live { plan: SoundPlan; type: Type; seed: number; crest: boolean; cues: Cue[]; next: number; contact: number; userPan: number; landPan: number; landSide: 0 | 1 }

/** Anything with a frame count that moves on as its picture plays: a picture's run, or a picture drawn some other way. */
type Clock = { t: number };
const lives = new WeakMap<Clock, Live>();

/** The moments of a picture that sound: each cast, the first three shapes to the first target, and the landings. */
function cuesOf(tm: SoundTimes, plan: SoundPlan): Cue[] {
  const cues: Cue[] = [];
  if (plan.cast.length) tm.casts.forEach(([at, len], k) => cues.push({ frame: at, part: 'cast', span: len, k, n: 1 }));
  if (plan.travel.length) tm.flights.slice(0, 3).forEach(([at, len], k) => cues.push({ frame: at, part: 'travel', span: len, k, n: 1 }));
  // Landings within 3 frames of a group's first sound once, so a volley or a spread hit does not pile up.
  const groups: { at: number; n: number }[] = [];
  for (const h of tm.hits) { const g = groups[groups.length - 1]; if (g && h - g.at <= 3) g.n++; else groups.push({ at: h, n: 1 }); }
  if (plan.impact.length) groups.slice(0, 5).forEach((g, i) => cues.push({ frame: g.at, part: 'impact', span: tm.land, k: i, n: g.n }));
  return cues.sort((a, b) => a.frame - b.frame);
}

/** The last move that landed with a sound: its side, when, how many hits its landings still cover, how often it has played again, and how to play it again. */
let landed: { live: Live; side: 0 | 1; at: number; owed: number; again: number; pan: number; crest: boolean; replay: (vol: number) => void } | null = null;
const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
/** When true, every hit also plays the plain hit sound under the move's landing, for comparing the two by ear. */
let hitOver = false;

/** Plays one moment of a move's sound `at` seconds from now, at the current battle speed. */
function fire(s: Live, c: Cue, at: number, spd: number): void {
  const layers = s.plan[c.part];
  if (!layers.length) return;
  const legend = !!s.plan.legend;
  // Faster battles thin the sound: one shape sounds its flight, a plain move drops its cast at the fastest speed, and fewer landings sound.
  if (spd >= 2 && c.part === 'travel' && c.k > 0) return;
  if (spd >= 3 && c.part === 'cast' && !s.crest && !legend) return;
  if (c.part === 'impact' && c.k >= (spd >= 3 ? 2 : spd >= 2 ? 3 : 5)) return;
  const o = sink();
  if (!o) return;
  const span = c.span / (60 * spd);
  const pan: [number, number] = c.part === 'cast' ? [s.userPan, s.userPan] : c.part === 'travel' ? [s.userPan, s.landPan] : [s.landPan, s.landPan];
  let vol = PART_VOL[c.part] * (s.crest ? CREST_VOL[c.part] : 1) * (legend ? LEGEND_VOL : 1);
  if (c.part === 'travel') vol *= [1, 0.7, 0.5][c.k] ?? 0.4;
  if (c.part === 'impact') vol *= (c.k === 0 ? 1 : Math.max(0.35, 0.7 - 0.1 * c.k)) * (c.n > 1 ? 1.08 : 1);
  const first = c.part === 'impact' && c.k === 0;
  const ok = admit(o, o.t + at, layers.length, first, legend ? CAP_LEGEND : CAP);
  const ends = ringing.get(o.a)!;
  const place = (i: number, v: number): Place => ({ type: s.type, seed: s.seed + (c.part === 'cast' ? 11 : c.part === 'travel' ? 23 : 37) * (i + 1) + c.k * 3, crest: s.crest, legend, spd, span, pan, vol: v });
  layers.slice(0, ok).forEach((ly0, i) => {
    const ly = c.n > 1 && i === 0 && !ly0.wide ? { ...ly0, wide: true } : ly0;
    // A strike in the cast lands when a lunge, stomp, or blink reaches its moment.
    const late = c.part === 'cast' && !ly.motif && !ACTIONS[ly.act].hold && s.contact > 0 ? s.contact / (60 * spd) : 0;
    ends.push(playLayer(o, at + late, ly, place(i, vol * (LAYER_VOL[i] ?? 0.4))));
  });
  const lead = layers.find(l => !l.motif);
  if (first && s.crest) ends.push(playLayer(o, at, { mat: lead?.mat ?? null, act: 'boom', motif: null, shift: 0, note: null, n: 1, wide: false, len: 1, vol: 1, bend: 0 }, place(5, 0.55 * (legend ? LEGEND_VOL : 1))));
  if (c.part !== 'impact' || !lead) return;
  const replay = (v: number): void => {
    const o2 = sink();
    if (o2) playLayer(o2, 0, lead, { ...place(0, v * PART_VOL.impact * (legend ? LEGEND_VOL : 1)), seed: s.seed + 41 });
  };
  if (!landed || landed.live !== s) landed = { live: s, side: s.landSide, at: 0, owed: 0, again: 0, pan: s.landPan, crest: s.crest, replay };
  landed.at = clock() + at;
  landed.owed++;
  landed.replay = replay;
}

/** Starts a move's sound alongside its picture. `opt` is the option picked, or -1 or undefined for its plain picture. `type` is the move's type as its user holds it. */
export function moveSound(r: FxRun, m: MoveDef, opt: number | undefined, type: Type, crest: boolean, speed = 1): void {
  const p = parseSound(soundSpecOf(m, r.plan, opt).spec);
  if ('bad' in p) return;
  startSound(r, p, type, fxHash(m.id + (opt !== undefined && opt >= 0 ? '/' + opt : '')), crest, speed, timesOf(r));
}

/**
 * Starts a sound plan alongside a picture whose frame count `clock.t` moves on as it plays, with the picture's timings.
 * A legendary's sound lowers the music while it plays, unless every motif in it is soft. `live` false skips that, for renders.
 */
export function startSound(clk: Clock, plan: SoundPlan, type: Type, seed: number, crest: boolean, speed: number, tm: SoundTimes, live = true): void {
  const landSide = (tm.home ? tm.side : 1 - tm.side) as 0 | 1;
  lives.set(clk, { plan, type, seed, crest, cues: cuesOf(tm, plan), next: 0, contact: tm.contact, userPan: PAN[tm.side], landPan: PAN[landSide], landSide });
  const motifs = [...plan.cast, ...plan.travel, ...plan.impact].filter(l => l.motif);
  if (live && plan.legend && motifs.some(l => l.vol >= 1) && sink()) music.duck(crest ? DUCK_CREST : DUCK, tm.end / (60 * speed) + 0.2);
  soundTick(clk, speed);
}

/** Plays the moments of a picture's sound that fall before its next frame, each at its exact time. Call it once a frame after the picture moves. */
export function soundTick(clk: Clock, speed = 1): void {
  const s = lives.get(clk);
  if (!s) return;
  while (s.next < s.cues.length && s.cues[s.next].frame < clk.t + speed) {
    const c = s.cues[s.next++];
    fire(s, c, Math.max(0, (c.frame - clk.t) / (60 * speed)), speed);
  }
}

/** Plays every moment of a picture's sound at once, scheduled ahead as the picture would run at `speed`, for renders and auditions. */
export function soundAll(clk: Clock, speed = 1): void {
  const s = lives.get(clk);
  if (!s) return;
  while (s.next < s.cues.length) { const c = s.cues[s.next++]; fire(s, c, c.frame / (60 * speed), speed); }
}

/** How hard a strong hit drives its clipper, and its level after it: about two and a half times the move sounds' bus. */
const CRIT_DRIVE = 1.6, CRIT_GAIN = 0.2;
const critBuses = new WeakMap<AudioNode, AudioNode>();

/** Strong hits' own bus: a soft clipper for crunch, set well above the move sounds and past their limiter so it cuts through. */
function critBusOf(o: Out): AudioNode {
  let b = critBuses.get(o.dest);
  if (!b) {
    const drive = o.a.createGain(), clip = o.a.createWaveShaper(), post = o.a.createGain();
    const n = 1024, k = new Float32Array(n);
    for (let i = 0; i < n; i++) k[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 3) / Math.tanh(3);
    drive.gain.value = CRIT_DRIVE;
    clip.curve = k;
    clip.oversample = '4x';
    post.gain.value = CRIT_GAIN;
    drive.connect(clip);
    clip.connect(post);
    post.connect(o.dest);
    critBuses.set(o.dest, drive);
    b = drive;
  }
  return b;
}

/** A strong hit: a bright crack, a crunchy smack, a punch that drops to the floor, a metal ring, and a short tearing rip. */
function weight(pan: number, crest: boolean): void {
  const o = sink();
  if (!o) return;
  const h: Hit = { o, bus: critBusOf(o), t: o.t, P: 120, B: 480, S: 0.2, L: crest ? 1.15 : 1, M: MATS.fur, tint: PLAIN, r: rng(3), pan: [pan, pan], bend: 0, len: 1, end: 0 };
  noise(h, { f: [6000, 3000], q: 0.8, dur: 0.035, vol: 1.1, a: 0.0005 });
  tone(h, { w: 'square', f: [420, 150], dur: 0.09, vol: 0.8, a: 0.001 });
  tone(h, { w: 'sine', f: [190, 70, 48], dur: 0.24, vol: 0.9, a: 0.001 });
  tone(h, { w: 'triangle', f: [1480, 1400], dur: 0.16, vol: 0.32, a: 0.001 });
  tone(h, { w: 'triangle', f: [2210, 2090], dur: 0.12, vol: 0.24, a: 0.001 });
  // A square gate at 70 Hz chops the swept crackle into a tear, where an ungated sweep reads as a hiss.
  noise(h, { buf: 'dense', f: [3600, 900, 320], q: 1.1, dur: 0.14, vol: 0.7, a: 0.002, trem: [70, 0.9, 'square'] });
}

/**
 * The sound of a damage number on `side`. A move's landing that just sounded there covers the hit, and a heavy hit adds a
 * low thump under it. More hits of the same move play its landing again, softer on a reserve. Any other hit plays the
 * plain hit sound.
 */
export function hitSound(side: 0 | 1, big: boolean, reserve: boolean, speed = 1): void {
  const L = landed, now = clock();
  if (!hitOver && L && L.side === side && now - L.at < 0.9 / speed && now - L.at > -0.2) {
    if (L.owed > 0) L.owed--;
    else if (L.again < 6) { L.again++; L.at = now; L.replay(reserve ? 0.4 : 0.75); }
    else { sfx(big ? 'hitBig' : 'hit'); if (big) weight(L.pan, false); return; }
    if (big) weight(L.pan, L.crest);
    return;
  }
  sfx(big ? 'hitBig' : 'hit');
  if (big) weight(PAN[side], false);
}

/** Plays the plain hit sound under every move's landing as well, or stops doing so. For the audition page. */
export function setHitOver(on: boolean): void { hitOver = on; }

/** The sound words, materials, pitched words, and motifs the synth plays, so the content tests can check the vocabulary against it. */
export const PLAYABLE = { acts: Object.keys(ACTS), mats: Object.keys(MATS), pitched: Object.keys(NOTE_AT), motifs: Object.keys(MOTIF_DEFS) };

/** Plays a picture's sound for the console's picture test: a move id's own sound, or nothing for a bare picture spec. */
export function previewSound(r: FxRun, what: string, moves: Record<string, MoveDef>): void {
  const m = moves[what];
  if (m) moveSound(r, m, undefined, m.type, (m.nerve || 0) > 0);
}
