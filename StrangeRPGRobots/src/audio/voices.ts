// Talking voices: one synth blip per call while text prints. Each speaker has a voice of {pitch, wave, rate} in
// src/content/speakers.ts. The wave picks one of four timbres that sound clearly apart: a round sine, a nasal square,
// a buzzy FM pair, and a wobbling detuned pair. Pitch and rate shape the rest, and the port's voice is its own thing.
import { audioCtx, isMuted, onAudioReady, voiceOut } from './core';
import { hash } from './score-core';
import { music } from './music';

export interface SpeakerVoice { pitch: number; wave: number; rate: number }

export interface Timbre {
  family: 'sine' | 'square' | 'fm' | 'wobble' | 'port';
  /** Semitone steps above the base that blips walk between. */
  steps: readonly number[];
  /** Blip length in seconds before the rate scales it. */
  len: number;
  gain: number;
  lp?: number;
  bp?: number;
  /** A band-pass that follows the pitch, as a multiple of it. */
  bpMul?: number;
  bq?: number;
  /** Vibrato rate in Hz and depth in cents. */
  vib?: readonly [number, number];
  /** Glide within each blip, in semitones. */
  chirp?: number;
  /** Glide from the previous blip's pitch, in seconds. */
  slide?: number;
  /** FM ratio and index. */
  fm?: readonly [number, number];
  /** Detune between two oscillators, in cents. */
  wide?: number;
  /** An octave below, mixed in. */
  sub?: number;
  /** A reversed swell after each blip. */
  rev?: boolean;
  /** Tremolo rate in Hz, for a ring-modulated edge. */
  ring?: number;
  room?: number;
  /** Stops dead instead of decaying. */
  clip?: boolean;
}

/** True for the port's voice: pitch 360 on the FM wave, or anything in that family pitched that high. */
export function isPort(v: SpeakerVoice): boolean {
  return Math.round(v.wave) === 2 && v.pitch >= 330;
}

/** The timbre for a speaker's voice. The same voice values always give the same timbre. */
export function timbreFor(v: SpeakerVoice): Timbre {
  const wave = ((Math.round(Number.isFinite(v.wave) ? v.wave : 0) % 4) + 4) % 4;
  const rate = Math.max(0.4, Math.min(2.5, Number.isFinite(v.rate) ? v.rate : 1));
  const h = hash(`${Math.round(v.pitch)}|${wave}|${rate.toFixed(2)}`);
  // A fast talker's blips tilt up, a slow talker's tilt down.
  const tilt = rate >= 1.2 ? 1.5 : rate <= 0.9 ? -1.5 : ((h >>> 3) % 3) - 1;
  if (isPort(v)) {
    // Alien: an inharmonic FM pair, a ring-modulated edge, a whole-tone walk, a slide between blips, and a tail that
    // swells back up and stops.
    return { family: 'port', steps: [0, 2, 4, 6, 8, 10], len: 0.06, gain: 0.23, fm: [2.76, 2.2], ring: 47, slide: 0.03, rev: true, vib: [11, 35], room: 0.45 };
  }
  switch (wave) {
    case 0: return { family: 'sine', steps: [0, 2, 4, 7, 9], len: 0.065, gain: 0.335, chirp: tilt - 0.5, sub: 0.3, vib: [5 + (h % 3), 14], room: 0.15 };
    case 1: return { family: 'square', steps: [0, 3, 5, 7, 10], len: 0.045, gain: 0.77, bpMul: 6, bq: 2, lp: 3200, chirp: tilt, clip: true, room: 0.08 };
    case 2: return { family: 'fm', steps: [0, 1, 5, 6], len: 0.055, gain: 0.375, fm: [1.5 + ((h >>> 5) % 3) * 0.25, 3.2], chirp: tilt * 0.5, room: 0.12 };
    default: return { family: 'wobble', steps: [0, 2, 3, 7], len: 0.07, gain: 0.33, wide: 26, vib: [8.5 + (h % 4) * 0.5, 45], lp: 1800, chirp: tilt * 0.6, room: 0.2 };
  }
}

interface Talk { last: number; count: number; idx: number; prev: number }
const talks = new Map<string, Talk>();
interface VoiceRig { input: GainNode; room: GainNode; noise: AudioBuffer; pulse: PeriodicWave }
let out: VoiceRig | null = null;
let seed = 0x7a1c;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

function makeRig(ac: BaseAudioContext, bus: AudioNode): VoiceRig {
  const input = ac.createGain();
  input.connect(bus);
  const room = ac.createGain();
  const conv = ac.createConvolver();
  const sr = ac.sampleRate, n = Math.round(sr * 0.6);
  const buf = ac.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let s = ch ? 0x3141 : 0x2718;
    for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 2147483648 - 1) * Math.exp((-6.91 * i) / n); }
  }
  conv.buffer = buf;
  const wet = ac.createGain();
  wet.gain.value = 0.3;
  room.connect(conv); conv.connect(wet); wet.connect(bus);
  const noise = ac.createBuffer(1, sr, sr);
  const nd = noise.getChannelData(0);
  let s = 0x55aa;
  for (let i = 0; i < nd.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; nd[i] = s / 2147483648 - 1; }
  const H = 24, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) re[h] = Math.sin(Math.PI * h * 0.25) / h;
  return { input, room, noise, pulse: ac.createPeriodicWave(re, im) };
}

function build(): void {
  const ac = audioCtx(), bus = voiceOut();
  if (!ac || !bus || out) return;
  try { out = makeRig(ac, bus); } catch { out = null; }
}

onAudioReady(build);

/**
 * The next blip's frequency: a walk between the timbre's steps that never jumps far, and a line that drifts down a
 * little as it goes on, the way a sentence does.
 */
export function nextPitch(v: SpeakerVoice, t: Timbre, tk: { count: number; idx: number }, r: () => number): number {
  const L = t.steps.length;
  const move = r() < 0.2 ? 0 : r() < 0.5 ? -1 : 1;
  tk.idx = Math.max(0, Math.min(L - 1, tk.idx + move + (r() < 0.15 ? (r() < 0.5 ? 2 : -2) : 0)));
  const fall = Math.min(2, tk.count / 14);
  const base = Math.max(40, Math.min(1600, Number.isFinite(v.pitch) ? v.pitch : 200));
  return base * Math.pow(2, (t.steps[tk.idx] - fall) / 12);
}

/** Plays one blip for a speaker. With no voice it plays the soft cursor tick the choice list uses. */
export function speakBlip(v: SpeakerVoice | undefined, fallback: () => void): void {
  try {
    if (!v) { fallback(); return; }
    const ac = audioCtx();
    if (!ac) return;
    if (!out) build();
    if (!out || isMuted()) return;
    const t = timbreFor(v);
    const now = ac.currentTime;
    const keyName = `${Math.round(v.pitch)}|${v.wave}|${v.rate}`;
    const tk = talks.get(keyName) ?? { last: -1, count: 0, idx: 1, prev: v.pitch };
    if (now - tk.last < 0.025) return;
    if (now - tk.last > 0.6) { tk.count = 0; tk.idx = 1; }
    const f = nextPitch(v, t, tk, rand);
    const rate = Math.max(0.4, Math.min(2.5, Number.isFinite(v.rate) ? v.rate : 1));
    let len = (t.len / rate) * (0.9 + rand() * 0.2);
    // Blips never overlap: at a fast text speed each one ends before the next begins, so every voice keeps its level.
    const since = now - tk.last;
    if (since > 0 && since < 0.2) len = Math.min(len, Math.max(0.018, since * 0.85));
    blipAt(ac, out, t, f, tk.prev, now + 0.005, len);
    tk.prev = f;
    tk.last = now;
    tk.count++;
    talks.set(keyName, tk);
    music.talk();
  } catch { /* never throw */ }
}

function blipAt(ac: BaseAudioContext, o: VoiceRig, v: Timbre, f: number, prev: number, at: number, len: number): void {
  const srcs: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const eg = ac.createGain();
  const end = at + len + (v.clip ? 0.01 : 0.08) + (v.rev ? 0.09 : 0);
  const osc = (type: OscillatorType | 'pulse', freq: number, det = 0) => {
    const x = ac.createOscillator();
    if (type === 'pulse') x.setPeriodicWave(o.pulse); else x.type = type;
    if (v.slide) { x.frequency.setValueAtTime(prev * (freq / f), at); x.frequency.exponentialRampToValueAtTime(freq, at + v.slide); }
    else x.frequency.setValueAtTime(freq, at);
    if (v.chirp) x.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, v.chirp / 12), at + len);
    x.detune.value = det;
    srcs.push(x);
    return x;
  };
  let tone: AudioNode;
  if (v.family === 'fm' || v.family === 'port') {
    const ratio = v.fm?.[0] ?? 2, index = v.fm?.[1] ?? 1;
    const car = osc('sine', f), md = osc('sine', f * ratio), mg = ac.createGain();
    if (v.family === 'port') {
      // The port's brightness rises through the blip instead of falling, the wrong way round.
      mg.gain.setValueAtTime(index * f * ratio * 0.2, at);
      mg.gain.linearRampToValueAtTime(index * f * ratio, at + len);
    } else {
      mg.gain.setValueAtTime(index * f * ratio, at);
      mg.gain.setTargetAtTime(index * f * ratio * 0.25, at, len * 0.6);
    }
    md.connect(mg); mg.connect(car.frequency);
    nodes.push(mg);
    tone = car;
  } else if (v.family === 'square') {
    const a = osc('pulse', f);
    tone = a;
  } else if (v.family === 'wobble') {
    const a = osc('triangle', f, -(v.wide ?? 20) / 2), b = osc('sawtooth', f, (v.wide ?? 20) / 2), mix = ac.createGain(), bg = ac.createGain();
    bg.gain.value = 0.35;
    a.connect(mix); b.connect(bg); bg.connect(mix);
    nodes.push(mix, bg);
    tone = mix;
  } else {
    tone = osc('sine', f);
  }
  if (v.sub) {
    const s = osc('sine', f / 2), sg = ac.createGain();
    sg.gain.value = v.sub;
    s.connect(sg); sg.connect(eg);
    nodes.push(sg);
  }
  if (v.vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = v.vib[0]; lg.gain.value = v.vib[1];
    l.connect(lg);
    for (const s of srcs) if (s instanceof OscillatorNode) lg.connect(s.detune);
    srcs.push(l); nodes.push(lg);
  }
  let head: AudioNode = tone;
  if (v.ring) {
    const amp = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    amp.gain.value = 0.5;
    l.frequency.value = v.ring; lg.gain.value = 0.5;
    l.connect(lg); lg.connect(amp.gain);
    head.connect(amp); head = amp;
    srcs.push(l); nodes.push(amp, lg);
  }
  const bpF = v.bpMul ? Math.min(9000, f * v.bpMul) : v.bp;
  if (bpF) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = bpF; b.Q.value = v.bq ?? 2; head.connect(b); head = b; nodes.push(b); }
  if (v.lp) { const l = ac.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = Math.max(v.lp, f * 2); head.connect(l); head = l; nodes.push(l); }
  head.connect(eg);
  const g = v.gain;
  eg.gain.setValueAtTime(0, at);
  eg.gain.linearRampToValueAtTime(g, at + 0.003);
  if (v.clip) { eg.gain.setValueAtTime(g * 0.8, at + len); eg.gain.linearRampToValueAtTime(0, at + len + 0.005); }
  else eg.gain.setTargetAtTime(0, at + 0.004, len / 2.5);
  if (v.rev) {
    // A reversed tail: the same note swells back up and stops short.
    eg.gain.setValueAtTime(0.0001, at + len);
    eg.gain.exponentialRampToValueAtTime(g * 0.55, at + len + 0.08);
    eg.gain.setValueAtTime(0, at + len + 0.081);
  }
  const pan = ac.createStereoPanner();
  pan.pan.value = v.family === 'port' ? Math.sin(at * 2.3) * 0.5 : 0;
  eg.connect(pan); pan.connect(o.input);
  const send = ac.createGain();
  send.gain.value = v.room ?? 0.1;
  pan.connect(send); send.connect(o.room);
  nodes.push(eg, pan, send);
  const first = srcs[0];
  for (const s of srcs) { s.start(at); s.stop(end); }
  first.onended = () => {
    for (const s of srcs) { try { s.disconnect(); } catch { /* ignore */ } }
    for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } }
  };
}

/** Renders a run of blips offline at a given bus gain, for checking levels. Browser only. Returns peak and RMS in dBFS. */
export async function renderVoiceOffline(v: SpeakerVoice, blips = 30, busGain = 0.67): Promise<{ peak: number; rms: number }> {
  const sr = 44100, step = 0.036;
  const t = timbreFor(v);
  const ac = new OfflineAudioContext(2, Math.round(sr * (blips * step + 1)), sr);
  const bus = ac.createGain();
  bus.gain.value = busGain;
  bus.connect(ac.destination);
  const R = makeRig(ac, bus);
  const tk = { count: 0, idx: 1 };
  let prev = v.pitch;
  const rate = Math.max(0.4, Math.min(2.5, v.rate));
  for (let i = 0; i < blips; i++) {
    const f = nextPitch(v, t, tk, rand);
    blipAt(ac, R, t, f, prev, 0.02 + i * step, Math.min(t.len / rate, step * 0.85));
    tk.count++;
    prev = f;
  }
  const buf = await ac.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
  let peak = 0, acc = 0;
  for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])); acc += L[i] * L[i]; }
  const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
  return { peak: db(peak), rms: db(Math.sqrt(acc / L.length)) };
}
