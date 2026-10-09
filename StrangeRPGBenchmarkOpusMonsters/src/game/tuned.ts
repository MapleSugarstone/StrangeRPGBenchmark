// A small synth for effects that play in tune with the music: short voices and filtered noise, pitched from the key and chord sounding now.
// Everything goes through the shared effects gain, so the volume setting and mute apply, and nothing plays while muted.
import { sink } from '../engine/audio';
import { music } from '../engine/music';
import { tuningOf, type Tuning } from './voices';

// ---------------------------------------------------------------- synth

/**
 * One short voice: a pitch that may glide to `to`, an optional FM ring, a low-pass that sweeps from `lp[0]` to `lp[1]`
 * with Q `lp[2]`, a vibrato of `vib[1]` cents at `vib[0]` Hz, and a fast attack and exponential fall.
 */
export interface Tone {
  f: number; dur: number; vol: number; at?: number; w?: OscillatorType; to?: number; fm?: [number, number]; a?: number; pan?: number;
  lp?: [number, number, number?]; vib?: [number, number];
}

function out(ac: BaseAudioContext, dest: AudioNode, pan: number | undefined): AudioNode {
  if (!pan) return dest;
  const p = ac.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(dest);
  return p;
}

export function tone(o: Tone): void {
  const s = sink();
  if (!s) return;
  const ac = s.a, t = s.t + (o.at ?? 0), end = t + o.dur;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(o.vol, t + (o.a ?? 0.003));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  env.connect(out(ac, s.dest, o.pan));
  let into: AudioNode = env;
  if (o.lp) {
    const fl = ac.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = o.lp[2] ?? 1;
    fl.frequency.setValueAtTime(o.lp[0], t);
    fl.frequency.exponentialRampToValueAtTime(o.lp[1], end);
    fl.connect(env);
    into = fl;
  }
  const osc = ac.createOscillator();
  osc.type = o.w ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  // A glide lands on its note in the first half, so the note heard longest is the one in key.
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + Math.min(0.06, o.dur * 0.5));
  if (o.fm) {
    const m = ac.createOscillator(), mg = ac.createGain();
    m.frequency.setValueAtTime(o.f * o.fm[0], t);
    if (o.to) m.frequency.exponentialRampToValueAtTime(o.to * o.fm[0], t + Math.min(0.06, o.dur * 0.5));
    mg.gain.setValueAtTime(o.f * o.fm[1], t);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.01, o.f * 0.02), end);
    m.connect(mg);
    mg.connect(osc.frequency);
    m.start(t);
    m.stop(end + 0.02);
  }
  if (o.vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = o.vib[0];
    lg.gain.value = o.vib[1];
    l.connect(lg);
    lg.connect(osc.detune);
    l.start(t);
    l.stop(end + 0.02);
  }
  osc.connect(into);
  osc.start(t);
  osc.stop(end + 0.02);
}

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Filtered noise: clicks, ratchets, felt thuds, and swishes. `to` sweeps the filter. */
export function hiss(o: { f: number; dur: number; vol: number; at?: number; q?: number; to?: number; kind?: BiquadFilterType; pan?: number }): void {
  const s = sink();
  if (!s) return;
  const ac = s.a, t = s.t + (o.at ?? 0), end = t + o.dur;
  let buf = noiseBufs.get(ac);
  if (!buf) {
    buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = buf.getChannelData(0);
    let r = 11;
    for (let i = 0; i < d.length; i++) { r = (r * 16807) % 2147483647; d[i] = (r / 2147483647) * 2 - 1; }
    noiseBufs.set(ac, buf);
  }
  const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), env = ac.createGain();
  src.buffer = buf;
  src.loop = true;
  fl.type = o.kind ?? 'bandpass';
  fl.Q.value = o.q ?? 2;
  fl.frequency.setValueAtTime(o.f, t);
  if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, end);
  env.gain.setValueAtTime(o.vol, t);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(fl);
  fl.connect(env);
  env.connect(out(ac, s.dest, o.pan));
  src.start(t, Math.random() * 0.4);
  src.stop(end + 0.02);
}

// ---------------------------------------------------------------- pitch

let cache: { at: number; tune: Tuning } | null = null;

/** The music's scale and the chord sounding now, read at most every 150 ms. With no music it is C major pentatonic. */
export function tune(): Tuning {
  const now = performance.now();
  if (!cache || now - cache.at > 150) cache = { at: now, tune: tuningOf(music.harmony()) };
  return cache.tune;
}

const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Pitch classes as steps above the root, lowest first. */
export const above = (pcs: number[], root: number): number[] => [...new Set(pcs.map(p => (((p - root) % 12) + 12) % 12))].sort((a, b) => a - b);

/** The `i`th note up the scale from the root, in octave `oct`, where octave 4 holds middle C, as a frequency. */
export function deg(i: number, oct = 4): number {
  const T = tune(), s = above(T.scale, T.root), o = Math.floor(i / s.length);
  return hz(12 * (oct + 1) + T.root + s[i - o * s.length] + 12 * o);
}

/** The `i`th tone of the chord sounding now, counting up from its lowest, in octave `oct`, as a frequency. */
export function ct(i: number, oct = 4): number {
  const T = tune(), s = above(T.tones, T.root), o = Math.floor(i / s.length);
  return hz(12 * (oct + 1) + T.root + s[i - o * s.length] + 12 * o);
}

/** How many notes the scale has. */
export const scaleLen = (): number => above(tune().scale, tune().root).length;

/** How many tones the chord has. */
export const chordLen = (): number => above(tune().tones, tune().root).length;
