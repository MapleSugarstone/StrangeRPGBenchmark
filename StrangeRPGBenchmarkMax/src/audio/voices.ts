// Talking voices: one synth blip per printed character, like small animal chatter. Each main cast member has a voice
// of their own, and every other speaker hashes by name into a family, so the same name always sounds the same.
// Narration and system lines are silent.
import { audioCtx, isMuted, onAudioReady, voiceOut } from './core';
import { hash } from './score-core';
import { music } from './music';

export interface VoiceDef {
  family: string;
  /** Center pitch as a MIDI note. */
  base: number;
  /** The pitches, in semitones above the base, that characters map into. */
  steps: readonly number[];
  w: 'square' | 'sawtooth' | 'triangle' | 'sine' | 'pulse' | 'fm';
  /** Blip length in seconds. */
  len: number;
  gain: number;
  lp?: number;
  bp?: number;
  bq?: number;
  vib?: readonly [number, number];
  /** Glide from the previous blip's pitch, in seconds. */
  slide?: number;
  fm?: readonly [number, number];
  /** A reversed swell after each blip. */
  rev?: boolean;
  /** Noise grit mixed in, for gravel. */
  grit?: number;
  /** A click at the front of each blip. */
  click?: number;
  /** Breath noise at the blip's pitch. */
  air?: number;
  /** Plays at once rather than a moment after the character, so it sits slightly ahead of the text. */
  early?: boolean;
  /** No random variation at all. */
  fixed?: boolean;
  /** An octave below, mixed in. */
  sub?: number;
  room?: number;
  /** Glide within each blip, in semitones. */
  chirp?: number;
  /** Stops dead instead of decaying. */
  clip?: boolean;
  /** Detune between two oscillators, in cents. */
  wide?: number;
}

/** The main cast. */
const CAST: Record<string, VoiceDef> = {
  nodus: { family: 'nodus', base: 62, steps: [0, 2, 4, 7, 9], w: 'square', len: 0.035, gain: 0.27, lp: 1800, room: 0 },
  parhelia: { family: 'parhelia', base: 50, steps: [0, 3, 5, 7, 10], w: 'sawtooth', len: 0.075, gain: 0.24, lp: 1100, sub: 0.4, grit: 0.35, vib: [5, 10], room: 0.15 },
  lot: { family: 'lot', base: 79, steps: [0, 2, 5, 7, 9, 12], w: 'sine', len: 0.045, gain: 0.29, air: 0.5, early: true, chirp: 2, room: 0.35 },
  umbraculum: { family: 'umbraculum', base: 50, steps: [0, 4, 7, 12, 7], w: 'sawtooth', len: 0.095, gain: 0.22, lp: 1600, wide: 18, sub: 0.3, vib: [5.5, 55], room: 0.3 },
  minim: { family: 'minim', base: 76, steps: [0, 3, 7, 10, 14], w: 'fm', fm: [3.5, 1.8], len: 0.07, gain: 0.28, rev: true, room: 0.5 },
  tik: { family: 'tik', base: 70, steps: [0, 1, 3], w: 'square', len: 0.016, gain: 0.28, click: 0.8, lp: 3000, room: 0 },
  anthelion: { family: 'anthelion', base: 57, steps: [0, 0, 0, 5], w: 'square', len: 0.05, gain: 0.26, lp: 2000, fixed: true, room: 0.05 },
  tib: { family: 'tib', base: 76, steps: [0, 2, 4, 7, 9, 12], w: 'triangle', len: 0.028, gain: 0.35, chirp: 3, room: 0.1 },
  grisaille: { family: 'grisaille', base: 60, steps: [0, 2, 3, 5], w: 'pulse', len: 0.04, gain: 0.63, bp: 1300, bq: 4, clip: true, room: 0.05 },
  painter: { family: 'painter', base: 60, steps: [0, 3, 5, 8, 10], w: 'sawtooth', len: 0.085, gain: 0.27, lp: 1400, slide: 0.07, vib: [4, 30], room: 0.3 },
};

/** Families for everyone else: a timbre and a pitch range the name's hash picks from. */
const FAMILIES: ReadonlyArray<VoiceDef & { span: number }> = [
  { family: 'squeak', base: 72, span: 12, steps: [0, 2, 4, 7, 9], w: 'triangle', len: 0.03, gain: 0.33, chirp: 4, room: 0.1 },
  { family: 'burble', base: 55, span: 12, steps: [0, 3, 5, 7, 10], w: 'sine', len: 0.05, gain: 0.3, vib: [25, 60], room: 0.1 },
  { family: 'reed', base: 58, span: 12, steps: [0, 2, 5, 7, 9], w: 'pulse', len: 0.045, gain: 0.64, bp: 1500, bq: 2, room: 0.1 },
  { family: 'hollow', base: 48, span: 12, steps: [0, 5, 7, 12], w: 'triangle', len: 0.06, gain: 0.24, sub: 0.4, lp: 900, room: 0.2 },
  { family: 'buzz', base: 52, span: 12, steps: [0, 2, 3, 7], w: 'sawtooth', len: 0.04, gain: 0.81, bp: 1000, bq: 3, room: 0.1 },
  { family: 'chirp', base: 76, span: 12, steps: [0, 4, 7, 11], w: 'sine', len: 0.025, gain: 0.34, chirp: 7, room: 0.1 },
  { family: 'warble', base: 60, span: 12, steps: [0, 2, 4, 5, 7], w: 'square', len: 0.05, gain: 0.27, lp: 1200, vib: [12, 80], room: 0.15 },
  { family: 'grunt', base: 40, span: 10, steps: [0, 3, 7], w: 'sawtooth', len: 0.07, gain: 0.26, lp: 600, sub: 0.5, room: 0.1 },
  { family: 'chime', base: 70, span: 12, steps: [0, 2, 4, 7, 9], w: 'fm', fm: [2, 1], len: 0.05, gain: 0.31, room: 0.3 },
];

const SILENT = new Set(['', 'narration', 'narrator', 'system', 'sign', 'letter', 'none', 'nobody']);
const ALIASES: Record<string, string> = { hero: 'nodus', '{name}': 'nodus', player: 'nodus', 'the painter': 'painter', 'bailiff grisaille': 'grisaille', 'director anthelion': 'anthelion', 'lord umbraculum': 'umbraculum' };

/** The voice a speaker uses, or null for a silent one. The same name always gives the same voice. */
export function voiceFor(speaker: string): VoiceDef | null {
  const raw = String(speaker ?? '').trim().toLowerCase();
  if (SILENT.has(raw) || raw.startsWith('(')) return null;
  const name = ALIASES[raw] ?? raw.replace(/^(the|old|bailiff|director|lord)\s+/, '');
  if (CAST[name]) return CAST[name];
  const h = hash(name);
  const fam = FAMILIES[h % FAMILIES.length];
  const shiftBy = (h >>> 8) % (fam.span + 1);
  const lenK = 0.8 + ((h >>> 16) % 41) / 100;
  return { ...fam, base: fam.base + shiftBy, len: fam.len * lenK, lp: fam.lp ? fam.lp * (0.85 + ((h >>> 20) % 31) / 100) : undefined };
}

interface Talk { last: number; count: number; prev: number }
const talks = new Map<string, Talk>();
interface VoiceRig { input: GainNode; room: GainNode; noise: AudioBuffer; pulse: PeriodicWave }
let out: VoiceRig | null = null;
let seed = 0x7a1c;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

function makeRig(ac: BaseAudioContext, bus: AudioNode): VoiceRig {
  {
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
    for (let h = 1; h <= H; h++) re[h] = Math.sin(Math.PI * h * 0.125) / h;
    return { input, room, noise, pulse: ac.createPeriodicWave(re, im) };
  }
}

function build(): void {
  const ac = audioCtx(), bus = voiceOut();
  if (!ac || !bus || out) return;
  try { out = makeRig(ac, bus); } catch { out = null; }
}

/** True for a character that gets a blip: a letter or a digit in any script. */
export function spoken(ch: string): boolean {
  return typeof ch === 'string' && ch.length > 0 && /[\p{L}\p{N}]/u.test(ch);
}

/** Renders a line of speech offline at a given bus gain, for checking levels. Browser only. Returns peak and RMS in dBFS. */
export async function renderVoiceOffline(speaker: string, text: string, busGain = 0.45): Promise<{ peak: number; rms: number }> {
  const sr = 44100, step = 0.045;
  const v = voiceFor(speaker);
  const ac = new OfflineAudioContext(2, Math.round(sr * (text.length * step + 1)), sr);
  const bus = ac.createGain();
  bus.gain.value = busGain;
  bus.connect(ac.destination);
  const R = makeRig(ac, bus);
  let prev = v?.base ?? 60, count = 0;
  if (v) [...text].forEach((ch, i) => {
    if (!spoken(ch)) return;
    const p = blipPitch(v, ch, count++, rand);
    blip(ac, R, v, p, prev, 0.02 + i * step, v.len * ('aeiouy'.includes(ch.toLowerCase()) ? 1.25 : 0.85));
    prev = p;
  });
  const buf = await ac.startRendering();
  const L = buf.getChannelData(0);
  let peak = 0, acc = 0;
  for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i])); acc += L[i] * L[i]; }
  const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
  return { peak: db(peak), rms: db(Math.sqrt(acc / L.length)) };
}

onAudioReady(build);

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** The pitch a character gets: its code picks a step, and the line drifts down a little as it goes on. */
export function blipPitch(v: VoiceDef, ch: string, count: number, r: () => number): number {
  const code = ch.toLowerCase().codePointAt(0) ?? 0;
  const idx = (code * 7 + (v.fixed ? 0 : Math.floor(r() * 2))) % v.steps.length;
  const fall = v.fixed ? 0 : Math.min(2, count / 12);
  return v.base + v.steps[idx] - fall;
}

/** Plays one blip for a printed character. Spaces and punctuation make no sound. */
export function speak(speaker: string, ch: string): void {
  try {
    if (!spoken(ch)) return;
    const v = voiceFor(speaker);
    if (!v) return;
    const ac = audioCtx();
    if (!ac) return;
    if (!out) build();
    if (!out || isMuted()) return;
    const now = ac.currentTime;
    const keyName = v.family + v.base;
    const tk = talks.get(keyName) ?? { last: -1, count: 0, prev: v.base };
    if (now - tk.last < 0.03) return;
    if (now - tk.last > 0.6) tk.count = 0;
    const vowel = 'aeiouy'.includes(ch.toLowerCase());
    const p = blipPitch(v, ch, tk.count, rand);
    const at = now + (v.early ? 0.001 : 0.025);
    const len = v.len * (vowel ? 1.25 : 0.85) * (v.fixed ? 1 : 0.9 + rand() * 0.2);
    blip(ac, out, v, p, tk.prev, at, len);
    tk.prev = p;
    tk.last = now;
    tk.count++;
    talks.set(keyName, tk);
    music.talk();
  } catch { /* never throw */ }
}

function blip(ac: BaseAudioContext, o: VoiceRig, v: VoiceDef, p: number, prev: number, at: number, len: number): void {
  const f = mtof(p);
  const srcs: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const eg = ac.createGain();
  const end = at + len + (v.clip ? 0.005 : 0.06) + (v.rev ? 0.08 : 0);
  const osc = (type: OscillatorType | 'pulse', freq: number, det = 0) => {
    const x = ac.createOscillator();
    if (type === 'pulse') x.setPeriodicWave(o.pulse); else x.type = type;
    if (v.slide) { x.frequency.setValueAtTime(mtof(prev), at); x.frequency.exponentialRampToValueAtTime(freq, at + v.slide); }
    else x.frequency.setValueAtTime(freq, at);
    if (v.chirp) x.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, v.chirp / 12), at + len);
    x.detune.value = det;
    srcs.push(x);
    return x;
  };
  let tone: AudioNode;
  if (v.w === 'fm') {
    const car = osc('sine', f), md = osc('sine', f * (v.fm?.[0] ?? 2)), mg = ac.createGain();
    mg.gain.setValueAtTime((v.fm?.[1] ?? 1) * f * (v.fm?.[0] ?? 2), at);
    mg.gain.setTargetAtTime(0, at, len);
    md.connect(mg); mg.connect(car.frequency);
    nodes.push(mg);
    tone = car;
  } else {
    const a = osc(v.w, f, v.wide ? -v.wide / 2 : 0);
    const mix = ac.createGain();
    a.connect(mix);
    if (v.wide) { const b = osc(v.w, f, v.wide / 2); b.connect(mix); mix.gain.value = 0.6; }
    nodes.push(mix);
    tone = mix;
  }
  if (v.sub) {
    const s = osc(v.w === 'fm' ? 'sine' : 'triangle', f / 2), sg = ac.createGain();
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
  if (v.bp) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = v.bp; b.Q.value = v.bq ?? 2; head.connect(b); head = b; nodes.push(b); }
  if (v.lp) { const l = ac.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = v.lp; head.connect(l); head = l; nodes.push(l); }
  head.connect(eg);
  const noiseLayer = (level: number, filter: (b: BiquadFilterNode) => void, d: number) => {
    const n = ac.createBufferSource(), fl = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = o.noise; n.loop = true;
    filter(fl);
    ng.gain.setValueAtTime(level * v.gain, at);
    ng.gain.setTargetAtTime(0, at, d);
    n.connect(fl); fl.connect(ng); ng.connect(o.input);
    srcs.push(n); nodes.push(fl, ng);
  };
  if (v.grit) noiseLayer(v.grit, (b) => { b.type = 'bandpass'; b.frequency.value = 900; b.Q.value = 0.8; }, len * 0.5);
  if (v.click) noiseLayer(v.click, (b) => { b.type = 'bandpass'; b.frequency.value = 3200; b.Q.value = 3; }, 0.003);
  if (v.air) noiseLayer(v.air, (b) => { b.type = 'bandpass'; b.frequency.value = f * 2; b.Q.value = 5; }, len * 0.6);
  const g = v.gain;
  eg.gain.setValueAtTime(0, at);
  eg.gain.linearRampToValueAtTime(g, at + 0.003);
  if (v.clip) { eg.gain.setValueAtTime(g * 0.8, at + len); eg.gain.linearRampToValueAtTime(0, at + len + 0.004); }
  else eg.gain.setTargetAtTime(0, at + 0.004, len / 2.5);
  if (v.rev) {
    // Minim's reversed tail: the same note swells back up and stops short.
    eg.gain.setValueAtTime(0.0001, at + len);
    eg.gain.exponentialRampToValueAtTime(g * 0.6, at + len + 0.07);
    eg.gain.setValueAtTime(0, at + len + 0.071);
  }
  eg.connect(o.input);
  const send = ac.createGain();
  send.gain.value = v.room ?? 0.1;
  eg.connect(send); send.connect(o.room);
  nodes.push(eg, send);
  const last = srcs[0];
  for (const s of srcs) {
    if (s instanceof AudioBufferSourceNode) s.start(at, (at * 5.3) % 0.9); else s.start(at);
    s.stop(end);
  }
  last.onended = () => {
    for (const s of srcs) { try { s.disconnect(); } catch { /* ignore */ } }
    for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } }
  };
}

export const CAST_NAMES: readonly string[] = Object.keys(CAST);
