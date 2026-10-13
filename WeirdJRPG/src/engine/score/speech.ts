// Dialogue blips as a small vocal synth. Each letter is a short pitched sound shaped like a vowel, hum, hiss, or puff, and each word
// sings one note of the music's scale, so a line reads as quiet speech that follows the key. The game calls blip() once per letter.
import type { VoiceId } from '../audio';
import { hash } from './lib';
import { DEFAULT_TUNING, ftom, snapMidi } from './sfxdefs';
import type { Tuning, Vc } from './sfxdefs';

/** Blips play at this share of the master level. Whorl's talking was cut by a third after the user found it loud, so this starts low. */
export const BLIP_LEVEL = 0.16;
/** The root mean square level a vowel aims for at the blip bus, before BLIP_LEVEL. */
const TARGET = 0.1;

export type Source = 'breathy' | 'buzzy' | 'reedy';
const HARM = 48;

export interface Series { re: Float32Array; im: Float32Array; amp: Float32Array }

/** Harmonic amplitudes of each source, scaled so the wave peaks at 1. Each is rolled off faster than a plain wave so it does not rasp. */
function series(src: Source): Series {
  const re = new Float32Array(HARM), im = new Float32Array(HARM);
  for (let n = 1; n < HARM; n++) {
    if (src === 'buzzy') im[n] = n ** -1.35;
    else if (src === 'reedy') re[n] = Math.sin(Math.PI * n * 0.25) * n ** -1.25;
    else im[n] = 1 / (n * n);
  }
  let peak = 0;
  for (let k = 0; k < 1024; k++) {
    const th = (2 * Math.PI * k) / 1024;
    let x = 0;
    for (let n = 1; n < HARM; n++) x += re[n] * Math.cos(n * th) + im[n] * Math.sin(n * th);
    peak = Math.max(peak, Math.abs(x));
  }
  const amp = new Float32Array(HARM);
  for (let n = 1; n < HARM; n++) { re[n] /= peak; im[n] /= peak; amp[n] = Math.hypot(re[n], im[n]); }
  return { re, im, amp };
}
export const SERIES: Record<Source, Series> = { breathy: series('breathy'), buzzy: series('buzzy'), reedy: series('reedy') };

// ---------------------------------------------------------------- letters

type Kind = 'vowel' | 'glide' | 'hum' | 'hiss' | 'soft' | 'burst';
const KIND: Record<string, Kind> = {};
for (const c of 'aeiouy') KIND[c] = 'vowel';
for (const c of 'lrwj') KIND[c] = 'glide';
for (const c of 'mn') KIND[c] = 'hum';
for (const c of 'szcx') KIND[c] = 'hiss';
for (const c of 'fvh') KIND[c] = 'soft';
for (const c of 'tkpbdgq') KIND[c] = 'burst';
/** A digit speaks as the main vowel of its name. */
const DIGIT: Record<string, string> = { 0: 'o', 1: 'u', 2: 'u', 3: 'i', 4: 'o', 5: 'a', 6: 'i', 7: 'e', 8: 'e', 9: 'a' };
/** First and second formants in Hz for a speaker of size 1. They sit a little under adult averages so the voices sound warm. */
const VOWEL: Record<string, [number, number]> = { a: [750, 1180], e: [450, 1780], i: [285, 2250], o: [510, 830], u: [310, 700], y: [300, 1550] };
const GLIDE: Record<string, [number, number]> = { l: [340, 940], r: [430, 1260], w: [285, 570], j: [265, 2120] };
/** Band center and Q of each noisy consonant. */
const NOISE: Record<string, [number, number]> = {
  s: [4300, 1.4], c: [4000, 1.4], z: [3600, 1.4], x: [3800, 1.2], f: [2600, 0.8], v: [2000, 0.8], h: [2400, 2],
  p: [700, 1], b: [550, 1], t: [2600, 1.1], d: [2100, 1.1], k: [1500, 1.2], g: [1200, 1.2], q: [1400, 1.2],
};
const HUM: Record<string, number> = { m: 360, n: 490 };
/** Length of each kind of letter as a share of the gap between letters. */
const LEN: Record<Kind, number> = { vowel: 1.25, glide: 1.1, hum: 1.1, hiss: 0.85, soft: 0.8, burst: 0.6 };
/** Loudness of each kind of letter against a vowel. Consonants sit well under the vowels, which carry the tune. */
const LEVEL: Record<Kind, number> = { vowel: 1, glide: 0.8, hum: 0.65, hiss: 0.16, soft: 0.1, burst: 0.3 };

export const FORMANT_Q: [number, number] = [3, 4];

const bandGain = (f: number, fc: number, q: number): number => { const r = f / fc; return 1 / Math.sqrt(1 + q * q * (r - 1 / r) ** 2); };
const lowGain = (f: number, fc: number, qdb: number): number => { const r = f / fc, ql = 10 ** (qdb / 20); return 1 / Math.sqrt((1 - r * r) ** 2 + (r / ql) ** 2); };

/** The root mean square of a source at pitch f0 after parallel band-pass or low-pass filters, so every letter can be leveled before it plays. */
function toneRms(src: Source, f0: number, bands: Array<['bp' | 'lp', number, number]>): number {
  const amp = SERIES[src].amp;
  let s = 0;
  for (let n = 1; n < HARM && n * f0 < 12000; n++) {
    let h = 0;
    for (const [t, fc, q] of bands) h += t === 'bp' ? bandGain(n * f0, fc, q) : lowGain(n * f0, fc, q);
    s += (amp[n] * h) ** 2 / 2;
  }
  return Math.sqrt(s);
}

/** The root mean square of uniform noise of amplitude 1 through a band-pass. */
const noiseRms = (fc: number, q: number, sr = 44100): number => Math.sqrt((1 / 3) * ((Math.PI * fc) / (2 * q)) / (sr / 2));

// ---------------------------------------------------------------- voices

interface Spec {
  /** Middle pitch in Hz. */
  f: number;
  /** Semitones above or below the middle pitch that a word may aim for. */
  steps: number[];
  /** Semitones below its note that a word starts, rising into it. */
  scoop: number;
  /** Longest letter in seconds. */
  dur: number;
  /** Loudness against the other voices. */
  level: number;
  /** Vibrato rate in Hz and depth in cents. */
  vib?: [number, number];
  /** Chance that a letter makes no sound. */
  gap?: number;
  /** Words move to the nearest note of the music's scale. */
  tuned: boolean;
  /** Amplitude flutter for a rasping voice: rate in Hz and depth. */
  rasp?: [number, number];
  /** A vocal voice shapes its source with vowel formants. A synth voice is a plain tone. */
  vocal?: { size: number; src: Source; air?: number };
  synth?: { w: Vc['w']; fm?: [number, number, number]; lp?: number; wide?: number; glide?: number; hiss?: number; ping?: boolean };
}

const PENT = [0, 2, 4, 7, 9, 12];
const SPECS: Record<Exclude<VoiceId, 'npc'>, Spec> = {
  pilgrim: { f: 294, steps: [0, 2, 4, -1, 5, 3], scoop: 1, dur: 0.07, level: 1.4, vib: [5.6, 22], gap: 0.06, tuned: true, vocal: { size: 1.05, src: 'breathy', air: 1 } },
  lightbound: { f: 659, steps: [0, 4, 7, 2, 9, 5], scoop: 2, dur: 0.06, level: 1.66, vib: [7, 30], tuned: true, vocal: { size: 1.5, src: 'reedy' } },
  vorn: { f: 123, steps: [0, 0, 5, -2, 3], scoop: 0.5, dur: 0.09, level: 1.42, vib: [4, 10], tuned: true, vocal: { size: 0.85, src: 'buzzy' } },
  seer: { f: 247, steps: [0, 7, -3, 9, 4, 12], scoop: 1.5, dur: 0.11, level: 1.37, vib: [4.5, 18], tuned: true, vocal: { size: 1, src: 'breathy', air: 1 } },
  keeper: { f: 698, steps: [0, 0, 0, 1, 0], scoop: 0, dur: 0.045, level: 1.99, tuned: true, vocal: { size: 1.1, src: 'reedy' } },
  watchman: { f: 98, steps: [0, 3, 7, 5, 2], scoop: 0.5, dur: 0.12, level: 1.27, vib: [3.5, 14], tuned: true, vocal: { size: 0.78, src: 'buzzy' } },
  null: { f: 62, steps: [0, 0.5, 1.5, -0.5, 1], scoop: 0.5, dur: 0.14, level: 0.78, vib: [2.5, 35], gap: 0.2, tuned: false, vocal: { size: 0.65, src: 'breathy', air: 2 } },
  guardian: { f: 49, steps: [0, 0, -2, -5, 2], scoop: 0.5, dur: 0.15, level: 1.5, rasp: [28, 0.5], tuned: true, vocal: { size: 0.55, src: 'buzzy' } },
  gear: { f: 480, steps: [0, 5, 7, 12, 3], scoop: 0, dur: 0.05, level: 1.2, tuned: true, synth: { w: 'sine', fm: [2.76, 2.4, 0.2], hiss: 0.8 } },
  paper: { f: 3500, steps: [0, 3, 5, -3, 7], scoop: 0, dur: 0.04, level: 1.65, tuned: false, synth: { w: 'noise' } },
  sea: { f: 500, steps: PENT, scoop: 0, dur: 0.07, level: 1.16, tuned: true, synth: { w: 'sine', glide: 0.5 } },
  crystal: { f: 1400, steps: [0, 3, 7, 10, 12, 15], scoop: 0, dur: 0.09, level: 1, tuned: true, synth: { w: 'sine', fm: [3.5, 1.4, 0.1], ping: true } },
  year: { f: 440, steps: [0, 3, 5, 7, 10, 12], scoop: 0, dur: 0.05, level: 0.79, tuned: true, synth: { w: 'square', lp: 3500, wide: 15 } },
};

const NPC_SRC: Source[] = ['breathy', 'buzzy', 'reedy'];
const NPC_STEPS = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 4, 7, 12, 5]];

/** A passer-by's voice, set by a seed so the same seed is always the same person. */
function npcSpec(seed: number): Spec {
  const s = Math.abs(Math.floor(seed)) >>> 0;
  return {
    f: 130 + ((s * 37) % 400), steps: NPC_STEPS[(s >> 2) & 3], scoop: 0.5 + (s & 3) * 0.5, dur: 0.045 + ((s >> 4) & 3) * 0.012, level: 1.45,
    vib: [5 + (s % 3), 18], tuned: true, vocal: { size: 0.75 + ((s * 7) % 7) * 0.11, src: NPC_SRC[s % 3], air: s % 3 === 0 ? 1 : 0 },
  };
}

export const BLIP_VOICE_IDS: VoiceId[] = ['pilgrim', 'lightbound', 'vorn', 'seer', 'keeper', 'watchman', 'null', 'guardian', 'gear', 'paper', 'sea', 'crystal', 'year', 'npc'];

// ---------------------------------------------------------------- speaking

/** What one speaker has said so far: when the last letter came, which word it is in, and the note that word sings. */
export interface BlipState { at: number; gap: number; word: number; inWord: number; sentence: number; lastStep: number; note: number; boundary: boolean }

export const newBlipState = (): BlipState => ({ at: -9, gap: 0.05, word: 0, inWord: 0, sentence: 0, lastStep: 99, note: 60, boundary: true });

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** What a character is, or null for a space or punctuation, which make no sound. */
export function letterKind(ch: string): { c: string; kind: Kind } | null {
  if (typeof ch !== 'string' || !ch.length) return null;
  const lc = ch.charAt(0).toLowerCase();
  const c = DIGIT[lc] ?? lc;
  const kind = KIND[c];
  if (kind) return { c, kind };
  return /[a-zÀ-ɏ]/.test(lc) ? { c: 'e', kind: 'vowel' } : null;
}

/**
 * Plans one letter. Letters that arrive after a pause, or after about five letters, start a new word, and each word sings one note
 * of the key: a word aims for one of the voice's steps, and the aim never repeats, so the pitch bounces from word to word and
 * drifts down a little through a sentence. The state is updated, and the voices to play come back, or null for a silent letter.
 */
export function planBlip(st: BlipState, now: number, voice: VoiceId, ch: string, seed: number, mood: number, T: Tuning = DEFAULT_TUNING): Vc[] | null {
  const lk = letterKind(ch);
  if (!lk) { st.boundary = true; return null; }
  const spec = voice === 'npc' ? npcSpec(seed) : SPECS[voice];
  if (!spec) return null;
  const m = Math.max(-1, Math.min(1, Number.isFinite(mood) ? mood : 0));
  const gap = st.at < 0 ? 0.05 : Math.max(0, now - st.at);
  const fresh = st.boundary || gap > 0.11 || st.inWord >= 5 + (hash(voice + seed + st.word) % 4);
  if (gap > 0.5) st.sentence = 0;
  if (fresh) {
    st.word++; st.inWord = 0; st.boundary = false;
    const h = hash(voice + ':' + Math.floor(seed) + ':' + st.word);
    let step = spec.steps[h % spec.steps.length];
    if (step === st.lastStep && spec.steps.length > 1) step = spec.steps[(h + 1) % spec.steps.length];
    st.lastStep = step;
    const midi = ftom(spec.f) + step - Math.min(2, st.sentence * 0.18) + m * 3.5;
    st.note = spec.tuned ? snapMidi(midi, T) : midi;
    st.sentence++;
  }
  const first = st.inWord === 0;
  st.inWord++;
  if (gap < 1 && st.at >= 0) st.gap = gap;
  st.at = now;
  if (spec.gap && (hash(lk.c + seed + st.word + st.inWord) % 100) / 100 < spec.gap) return null;

  const kind = lk.kind;
  const base = Math.min(spec.dur, Math.max(0.03, st.gap));
  const d = Math.max(0.02, base * LEN[kind] * (1 - 0.25 * m));
  const f0 = midiHz(st.note);
  const noisy = kind === 'hiss' || kind === 'soft' || kind === 'burst';
  if (!spec.vocal) {
    // A plain synth voice plays every letter as a short tone, with a click under the consonants for a voice that has one.
    const out = tone(spec, noisy ? d * 0.8 : d, f0, first, TARGET * spec.level * (noisy ? 0.7 : 1), kind);
    if (noisy && spec.synth?.hiss) out.push({ w: 'noise', f: [NOISE[lk.c][0]], d: 0.02, v: Math.min(4, (TARGET * spec.synth.hiss * 0.5) / noiseRms(NOISE[lk.c][0], NOISE[lk.c][1])), q: NOISE[lk.c][1], a: 0.002 });
    return out;
  }
  const lvl = TARGET * spec.level * LEVEL[kind];
  if (noisy) {
    const [fc, q] = NOISE[lk.c];
    const cut = Math.pow(spec.vocal.size, 0.5);
    return [{ w: 'noise', f: [fc * cut], d: kind === 'burst' ? Math.min(d, 0.03) : d, v: Math.min(4, lvl / noiseRms(fc * cut, q)), q, a: 0.002, shape: kind === 'burst' ? 'puff' : 'swell' }];
  }
  return tone(spec, d, f0, first, lvl, kind, lk.c);
}

function tone(spec: Spec, d: number, f0: number, first: boolean, lvl: number, kind: Kind, c = 'e'): Vc[] {
  const path = first && spec.scoop ? [f0 * Math.pow(2, -spec.scoop / 12), f0] : [f0];
  if (spec.vocal) {
    const { size, src, air } = spec.vocal;
    if (kind === 'hum') {
      const fc = HUM[c] * Math.pow(size, 0.5);
      const v: Vc = { w: src, f: path, d, v: Math.min(3, lvl / toneRms(src, f0, [['lp', fc, 1]])), a: 0.008, lp: [[fc, fc], 1], shape: 'voice' };
      if (spec.vib) v.vib = spec.vib;
      return [v];
    }
    const fm = (kind === 'glide' ? GLIDE[c] : VOWEL[c]) ?? VOWEL.e;
    const F1 = fm[0] * size, F2 = fm[1] * size;
    const rms = toneRms(src, f0, [['bp', F1, FORMANT_Q[0]], ['bp', F2, FORMANT_Q[1]]]);
    const v: Vc = { w: src, f: path, d, v: Math.min(3, lvl / Math.max(0.01, rms)), a: 0.008, form: [F1, F2], shape: 'voice' };
    if (air) v.air = air;
    if (spec.vib) v.vib = spec.vib;
    if (spec.rasp) v.trem = spec.rasp;
    return [v];
  }
  const s = spec.synth!;
  if (s.w === 'noise') return [{ w: 'noise', f: [f0, f0 * 0.8], d, v: lvl * 5, q: 1.2, a: 0.004 }];
  const g = s.glide ?? 0;
  const v: Vc = { w: s.w, f: g ? [f0 * (1 - g), f0] : path, d: s.ping ? d * 1.6 : d, v: lvl * 3, a: 0.004 };
  if (s.fm) v.fm = s.fm;
  if (s.lp) v.lp = [[s.lp, s.lp * 0.6], 1];
  if (s.wide) v.wide = s.wide;
  return [v];
}

/** The synth voices for one dialogue character as if it began a word, or null for a space, punctuation, or a silent letter. Used for checks. */
export function blipVoices(voice: VoiceId, ch: string, seed = 0, mood = 0): Vc[] | null {
  return planBlip(newBlipState(), 0, voice, ch, seed, mood, DEFAULT_TUNING);
}
