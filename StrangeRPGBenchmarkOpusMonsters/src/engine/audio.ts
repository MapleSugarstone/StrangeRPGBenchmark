// Short synthesized sound effects. The music lives in music.ts and shares this context.
let ac: AudioContext | null = null;
let sfxGain: GainNode | null = null;
export let sfxVolume = 0.6;
export let muted = false;
/** Effects play at this share of the volume setting, so a full setting sits under the music. */
const TRIM = 0.72;
/** Effects start this many seconds after the call. Scheduling at the current time loses the first few milliseconds while the audio thread catches up, which swallowed the shortest sounds. */
const LEAD = 0.03;

export function audio(): AudioContext | null {
  if (!ac) {
    try {
      ac = new AudioContext();
      sfxGain = ac.createGain();
      sfxGain.gain.value = sfxVolume * TRIM;
      sfxGain.connect(ac.destination);
    } catch { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export function setSfxVolume(v: number): void {
  sfxVolume = v;
  if (sfxGain) sfxGain.gain.value = muted ? 0 : v * TRIM;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (sfxGain) sfxGain.gain.value = m ? 0 : sfxVolume * TRIM;
}

/** An offline context that effects render into while an audition is made, and where in it the next effect starts. */
let offline: { a: BaseAudioContext; dest: AudioNode } | null = null;
let base = 0;

function target(): { a: BaseAudioContext; dest: AudioNode; t: number } | null {
  if (offline) return { ...offline, t: base };
  const a = audio();
  if (!a || !sfxGain || muted) return null;
  return { a, dest: sfxGain, t: a.currentTime + LEAD };
}

/** Where an effect plays now: the context, the node to connect to, and the time to start at. Null while muted or without audio. */
export const sink = target;

/** One synth voice. Paths are spread evenly over the voice and glide between points. */
interface Voice {
  /** Oscillator shape, or 'noise' for noise through a band-pass whose center follows `f`. */
  w: OscillatorType | 'noise';
  /** Pitch path in Hz. */
  f: number[];
  dur: number;
  vol: number;
  /** Delay from the call in seconds. */
  at?: number;
  /** Attack in seconds. */
  a?: number;
  /** Vibrato: rate in Hz, depth in cents, and an end rate it speeds or slows to. */
  vib?: [number, number, number?];
  /** Tremolo: rate in Hz, depth from 0 to 1, and an end rate. */
  trem?: [number, number, number?];
  /** Frequency modulation: modulator ratio to the pitch, index at the start, index at the end. */
  fm?: [number, number, number?];
  /** Resonant low-pass: cutoff path in Hz and Q. */
  lp?: [number[], number];
  /** Band-pass Q for noise. */
  q?: number;
  /** A second oscillator detuned by this many cents. */
  wide?: number;
  /** Stereo position from -1 (left) to 1 (right). */
  pan?: number;
}

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuf(a: BaseAudioContext): AudioBuffer {
  let b = noiseBufs.get(a);
  if (!b) {
    b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = b.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    noiseBufs.set(a, b);
  }
  return b;
}

/** A path as automation values, gliding geometrically between its points. */
function path(pts: number[], n = 48): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (pts.length === 1) { c[i] = pts[0]; continue; }
    const p = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(p)), u = p - k;
    c[i] = pts[k] * Math.pow(pts[k + 1] / pts[k], u);
  }
  return c;
}

/** A slow sine that wobbles a parameter around its value. */
function lfo(a: BaseAudioContext, t: number, end: number, rate: [number, number?], depth: number, into: AudioParam[]): void {
  const l = a.createOscillator();
  l.frequency.setValueAtTime(rate[0], t);
  if (rate[1]) l.frequency.linearRampToValueAtTime(rate[1], end);
  const g = a.createGain();
  g.gain.value = depth;
  l.connect(g);
  for (const p of into) g.connect(p);
  l.start(t);
  l.stop(end + 0.05);
}

function voice(v: Voice): void {
  const o = target();
  if (!o) return;
  const a = o.a;
  const t = o.t + (v.at || 0), end = t + v.dur;
  const env = a.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(v.vol * (v.wide ? 0.65 : 1), t + (v.a ?? 0.004));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  if (v.pan) {
    const p = a.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, v.pan));
    p.connect(o.dest);
    env.connect(p);
  } else env.connect(o.dest);
  let into: AudioNode = env;
  if (v.trem) {
    const tg = a.createGain();
    tg.gain.value = 1 - v.trem[1] / 2;
    lfo(a, t, end, [v.trem[0], v.trem[2]], v.trem[1] / 2, [tg.gain]);
    tg.connect(into);
    into = tg;
  }
  if (v.w === 'noise' || v.lp) {
    const fl = a.createBiquadFilter();
    fl.type = v.w === 'noise' ? 'bandpass' : 'lowpass';
    fl.Q.value = v.w === 'noise' ? v.q ?? 1 : v.lp![1];
    fl.frequency.setValueCurveAtTime(path(v.w === 'noise' ? v.f : v.lp![0]), t, v.dur);
    fl.connect(into);
    into = fl;
  }
  if (v.w === 'noise') {
    const s = a.createBufferSource();
    s.buffer = noiseBuf(a);
    s.loop = true;
    s.connect(into);
    s.start(t, Math.random() * 1.5);
    s.stop(end + 0.05);
    return;
  }
  const pitch = path(v.f);
  const oscs = (v.wide ? [0, v.wide] : [0]).map(dt => {
    const s = a.createOscillator();
    s.type = v.w as OscillatorType;
    s.frequency.setValueCurveAtTime(pitch, t, v.dur);
    s.detune.value = dt;
    s.connect(into);
    s.start(t);
    s.stop(end + 0.05);
    return s;
  });
  if (v.vib) lfo(a, t, end, [v.vib[0], v.vib[2]], v.vib[1], oscs.map(s => s.detune));
  if (v.fm) {
    const [ratio, i0, i1 = i0] = v.fm;
    const m = a.createOscillator();
    m.frequency.setValueCurveAtTime(pitch.map(x => x * ratio), t, v.dur);
    const mg = a.createGain();
    mg.gain.setValueCurveAtTime(pitch.map((x, i) => x * (i0 + (i1 - i0) * i / (pitch.length - 1))), t, v.dur);
    m.connect(mg);
    for (const s of oscs) mg.connect(s.frequency);
    m.start(t);
    m.stop(end + 0.05);
  }
}

/** A value nudged up or down by up to `amt` of itself, so repeated effects never sound identical. */
const jit = (x: number, amt = 0.04): number => x * (1 + (Math.random() * 2 - 1) * amt);

export const SFX = ['blip', 'move', 'ok', 'back', 'hit', 'hitBig', 'heal', 'shield', 'ko', 'peg', 'pegFail', 'wind', 'cut', 'status', 'switch', 'nerve', 'step', 'bump', 'level', 'boom', 'fit', 'guard', 'spot', 'page'] as const;
export type Sfx = typeof SFX[number];

/** A bell struck far below, `semi` semitones above a low C, with an inharmonic ring that dies away. */
export function bellTone(semi: number, opts: { at?: number; vol?: number } = {}): void {
  const f = 130.8 * Math.pow(2, semi / 12);
  voice({ w: 'sine', f: [f, f * 0.995], dur: 1.6, vol: opts.vol ?? 0.1, at: opts.at, a: 0.004, fm: [2.76, 2.2, 0.2], lp: [[2400, 600], 0.7] });
  voice({ w: 'sine', f: [f * 2, f * 1.99], dur: 0.9, vol: (opts.vol ?? 0.1) * 0.4, at: opts.at, a: 0.004 });
}

export function sfx(k: Sfx): void {
  switch (k) {
    // Menus: small wet plips, a rising bwoop, a falling wub.
    case 'blip': voice({ w: 'triangle', f: [jit(1900, 0.06), 1400], dur: 0.03, vol: 0.04, vib: [40, 60] }); break;
    case 'move': voice({ w: 'sine', f: [jit(1500, 0.05), 760], dur: 0.045, vol: 0.07, fm: [2, 0.6, 0], vib: [30, 40] }); break;
    case 'ok':
      voice({ w: 'square', f: [420, 980, 880], dur: 0.13, vol: 0.05, lp: [[700, 3200, 1400], 6], vib: [13, 35], wide: 9 });
      voice({ w: 'sine', f: [1760, 2100], dur: 0.06, vol: 0.03, at: 0.07, fm: [3, 1, 0] });
      break;
    case 'back': voice({ w: 'triangle', f: [560, 300, 330], dur: 0.12, vol: 0.08, vib: [9, 70], lp: [[2400, 500], 4] }); break;
    // The field: sand underfoot, a rubbery bump, a two-note ping when something is found.
    case 'step': voice({ w: 'noise', f: [jit(2600, 0.25), 1800], dur: 0.028, vol: 0.1, q: 2.5 }); break;
    case 'bump': voice({ w: 'sine', f: [150, 82, 112, 78], dur: 0.11, vol: 0.08, vib: [22, 90], fm: [0.5, 1.2, 0] }); break;
    // A page of the Register turning: a soft swish of paper and a faint flap at the end.
    case 'page':
      voice({ w: 'noise', f: [jit(1400, 0.1), 3800, 1600], dur: 0.2, vol: 0.09, a: 0.05, q: 0.8 });
      voice({ w: 'noise', f: [900, 500], dur: 0.05, vol: 0.06, at: 0.17, q: 1.5 });
      break;
    case 'spot':
      voice({ w: 'sine', f: [1180], dur: 0.16, vol: 0.06, fm: [3.5, 2.2, 0], trem: [24, 0.4] });
      voice({ w: 'sine', f: [1580, 1620], dur: 0.24, vol: 0.06, at: 0.07, fm: [3.5, 2.2, 0], vib: [7, 30] });
      break;
    case 'switch':
      voice({ w: 'triangle', f: [280, 640, 360], dur: 0.22, vol: 0.07, vib: [7, 50, 14], wide: 14 });
      voice({ w: 'noise', f: [500, 2600, 900], dur: 0.22, vol: 0.07, q: 3 });
      break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => voice({ w: 'sine', f: [f, f * 1.01], dur: 0.22, vol: 0.06, at: i * 0.085, fm: [2.01, 1.6, 0.2], vib: [6, 25], trem: [11, 0.25] }));
      voice({ w: 'triangle', f: [1046, 1568], dur: 0.35, vol: 0.04, at: 0.34, vib: [9, 45, 3] });
      break;
    // Two shells sliding together, wobbling faster until they ring as one.
    case 'fit':
      voice({ w: 'triangle', f: [300, 520], dur: 0.5, vol: 0.06, trem: [4, 0.8, 22], vib: [5, 40, 19] });
      voice({ w: 'triangle', f: [780, 520], dur: 0.5, vol: 0.05, vib: [6, 40, 23], wide: 7 });
      voice({ w: 'sine', f: [1040], dur: 0.55, vol: 0.06, at: 0.45, fm: [1.41, 2.5, 0], vib: [5, 18] });
      break;
    // A star coming down: a short falling whistle, a deep wobbling boom, and a glittering tail.
    case 'boom':
      voice({ w: 'sine', f: [2400, 600], dur: 0.22, vol: 0.04, vib: [18, 60] });
      voice({ w: 'noise', f: [900, 120, 60], dur: 1.4, vol: 0.9, at: 0.18, q: 0.7 });
      voice({ w: 'sine', f: [78, 34], dur: 1.6, vol: 0.5, at: 0.18, vib: [3.5, 60, 1.2], fm: [0.5, 1.5, 0] });
      voice({ w: 'sine', f: [2200, 1400], dur: 0.9, vol: 0.03, at: 0.25, fm: [2.7, 3, 0], trem: [13, 0.6, 5] });
      break;
    // Battle.
    case 'hit':
      voice({ w: 'square', f: [240, 85], dur: 0.1, vol: 0.1, lp: [[2600, 220], 9] });
      voice({ w: 'noise', f: [1400, 700], dur: 0.07, vol: 0.5, q: 1.2 });
      break;
    case 'hitBig':
      voice({ w: 'sawtooth', f: [210, 48], dur: 0.24, vol: 0.1, lp: [[3200, 110], 11], wide: 18, fm: [0.5, 2.5, 0] });
      voice({ w: 'noise', f: [900, 200], dur: 0.2, vol: 0.6, q: 0.9 });
      break;
    case 'heal':
      voice({ w: 'sine', f: [480, 990], dur: 0.24, vol: 0.09, fm: [2, 0.8, 0.1], vib: [14, 55] });
      [0.05, 0.11, 0.17].forEach((at, i) => voice({ w: 'sine', f: [jit(700 + i * 260, 0.08), jit(1400 + i * 300, 0.08)], dur: 0.05, vol: 0.04, at }));
      break;
    case 'shield': voice({ w: 'sine', f: [620, 660], dur: 0.3, vol: 0.11, fm: [1.41, 3, 0.4], trem: [18, 0.5], vib: [5, 20] }); break;
    case 'ko':
      voice({ w: 'triangle', f: [900, 420, 140, 55], dur: 0.7, vol: 0.16, vib: [12, 120, 3], lp: [[4000, 300], 3] });
      voice({ w: 'noise', f: [1200, 150], dur: 0.45, vol: 0.3, at: 0.15, q: 1 });
      break;
    // Sounding: a conch horn that steps up, or sags when it fails.
    case 'peg': voice({ w: 'sawtooth', f: [300, 330, 330, 495, 495, 660, 660], dur: 0.55, vol: 0.07, a: 0.03, lp: [[600, 1400, 1100, 1800, 1500], 4], vib: [5.5, 22], wide: 8 }); break;
    case 'pegFail': voice({ w: 'sawtooth', f: [330, 300, 240], dur: 0.35, vol: 0.06, a: 0.02, lp: [[1200, 400], 4], vib: [4, 90] }); break;
    case 'wind':
      voice({ w: 'sawtooth', f: [110, 440], dur: 0.45, vol: 0.05, lp: [[300, 2400], 7], vib: [3, 40, 18] });
      voice({ w: 'noise', f: [300, 3000], dur: 0.45, vol: 0.05, q: 4 });
      break;
    case 'cut':
      voice({ w: 'noise', f: [5200, 1500], dur: 0.08, vol: 0.7, q: 4 });
      voice({ w: 'sine', f: [1900, 380], dur: 0.1, vol: 0.06, fm: [2.7, 4, 0] });
      break;
    case 'status': voice({ w: 'triangle', f: [420, 300], dur: 0.18, vol: 0.08, vib: [11, 160], lp: [[600, 2000, 500], 6] }); break;
    // Tide rising: two bubbles.
    case 'nerve':
      voice({ w: 'sine', f: [700, 1500], dur: 0.06, vol: 0.06, fm: [1.5, 0.6, 0] });
      voice({ w: 'sine', f: [900, 1900], dur: 0.06, vol: 0.045, at: 0.045, fm: [1.5, 0.6, 0] });
      break;
    // Two knocks on a shell, inharmonic so they read as hollow.
    case 'guard':
      voice({ w: 'sine', f: [230], dur: 0.08, vol: 0.09, fm: [2.76, 3, 0] });
      voice({ w: 'sine', f: [310], dur: 0.09, vol: 0.08, at: 0.06, fm: [2.76, 3, 0] });
      break;
  }
}

/** Star pitches: a whole-tone scale, which has no home note, so any pick sounds unresolved and floating. */
const STAR_SCALE = [587.3, 659.3, 740, 830.6, 932.3, 1046.5];
const starPitch = (): number => STAR_SCALE[Math.floor(Math.random() * STAR_SCALE.length)] * (Math.random() < 0.3 ? 2 : 1) * jit(1, 0.012);
/** Start times of recent star sounds, so a heavy starfall thins out instead of piling up. */
let starTimes: number[] = [];

/**
 * A star falling, landing on ground, or landing in water. `size` is 0 to 3, `vol` scales it (for a star far from the
 * view), and `pan` places it left or right. Each call picks new pitches.
 */
export function starSound(kind: 'fall' | 'land' | 'splash', opts: { size?: number; vol?: number; pan?: number } = {}): void {
  const o = target();
  if (!o) return;
  const now = o.t;
  starTimes = starTimes.filter(t => now - t < 0.4);
  if (starTimes.length >= 3) return;
  starTimes.push(now);
  const size = opts.size ?? 1, pan = opts.pan ?? 0;
  const v = 1.8 * (opts.vol ?? 1) * (0.6 + 0.2 * size) / (1 + starTimes.length * 0.4);
  const p = starPitch();
  if (kind === 'fall') {
    // A thin whistle sliding down a few steps, with a slow wobble and a breath of air under it.
    voice({ w: 'sine', f: [p * 1.6, p * 1.25, p * 1.05], dur: 0.5 + 0.12 * size, vol: 0.016 * v, a: 0.06, vib: [jit(6, 0.2), 25, jit(11, 0.2)], fm: [jit(2.01, 0.01), 0.35, 0], pan });
    voice({ w: 'noise', f: [p * 3, p * 1.6], dur: 0.45 + 0.1 * size, vol: 0.012 * v, a: 0.05, q: 6, pan });
    return;
  }
  if (kind === 'splash') {
    // A drop into water, then bubbles rising.
    voice({ w: 'sine', f: [p, p * 0.45], dur: 0.12, vol: 0.05 * v, fm: [1.5, 0.8, 0], pan });
    for (let k = 0; k < 2 + size; k++) voice({ w: 'sine', f: [jit(p * 0.8, 0.15), jit(p * 1.7, 0.15)], dur: 0.05, vol: 0.022 * v, at: 0.1 + k * jit(0.07, 0.4), pan: pan + jit(1, 0.3) - 1 });
    return;
  }
  // Landing: a soft glassy chime, then a fizz of tiny bright pings that scatter up and away.
  voice({ w: 'sine', f: [p, p * 1.005], dur: 0.7 + 0.2 * size, vol: 0.035 * v, a: 0.005, fm: [jit(3.5, 0.03), 1.8, 0], vib: [jit(5, 0.3), 12], trem: [jit(9, 0.3), 0.3], pan });
  for (let k = 0; k < 3 + size * 2; k++) {
    const q = starPitch() * 2;
    voice({ w: 'sine', f: [q, q * jit(1.06, 0.03)], dur: jit(0.06, 0.4), vol: jit(0.012, 0.4) * v, at: 0.04 + k * jit(0.055, 0.5), fm: [2.76, 1.2, 0], pan: pan + (Math.random() - 0.5) * 0.6 });
  }
  voice({ w: 'noise', f: [7000, 4000], dur: 0.25 + 0.1 * size, vol: 0.02 * v, at: 0.02, q: 3, trem: [jit(27, 0.3), 0.8], pan });
}

// ---------------------------------------------------------------- cries

/** A whorl's cry: a pitch path in Hz, a length, its types, a seed for small differences, and how much of its sprite is solid (0 to 1). */
export interface CryDef { f: number[]; dur: number; types: string[]; seed: number; mass: number }

const hashUnit = (n: number): number => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** One type's layer of a cry. `v` is the layer's loudness. */
function cryLayer(type: string, f: number[], dur: number, v: number, at: number, pan: number, seed: number): void {
  const r = (k: number) => hashUnit(seed * 31 + k);
  const lo = f.map(x => x / 2), hi = f.map(x => x * 2);
  switch (type) {
    // Gravel: a low rasp through a closing filter, with grit under it.
    case 'STONE':
      voice({ w: 'sawtooth', f: lo, dur, vol: 0.05 * v, at, pan, lp: [[f[0] * 3, f[0] * 1.2], 4], vib: [5 + r(1) * 4, 25] });
      voice({ w: 'noise', f: [f[0] * 2, f[0]], dur: dur * 0.8, vol: 0.14 * v, q: 0.9, trem: [26 + r(2) * 14, 0.9], at, pan });
      break;
    // Water: a wobbling, gurgling tone and bubbles rising through it.
    case 'TIDE':
      voice({ w: 'sine', f, dur, vol: 0.07 * v, at, pan, fm: [0.5, 1.3, 0.3], vib: [9 + r(1) * 5, 70] });
      for (let k = 0; k < 3; k++) voice({ w: 'sine', f: [f[0] * (1.2 + r(k + 3)), f[0] * (2.2 + r(k + 6))], dur: 0.045, vol: 0.03 * v, at: at + dur * (0.2 + 0.25 * k), pan, fm: [1.5, 0.6, 0] });
      break;
    // Wood: a hollow knock, then a creaking body.
    case 'ROOT':
      voice({ w: 'sine', f: [f[0] * 2.4], dur: 0.06, vol: 0.06 * v, at, pan, fm: [3.98, 2, 0] });
      voice({ w: 'triangle', f, dur, vol: 0.07 * v, at: at + 0.03, pan, lp: [[f[0] * 4, f[0] * 2], 3], vib: [3 + r(1) * 3, 45] });
      break;
    // Clockwork: a ratcheting buzz with clicks keeping time.
    case 'GEAR': {
      voice({ w: 'square', f, dur, vol: 0.042 * v, at, pan, lp: [[f[0] * 6, f[0] * 3], 6], trem: [14 + r(1) * 10, 0.7] });
      const n = 4 + Math.floor(r(2) * 4);
      for (let k = 0; k < n; k++) voice({ w: 'noise', f: [4200 + r(k + 3) * 1600], dur: 0.012, vol: 0.12 * v, q: 6, at: at + (dur * k) / n, pan });
      break;
    }
    // An animal call: a growling saw through a filter that opens and shuts like a mouth.
    case 'BEAST':
      voice({ w: 'sawtooth', f, dur, vol: 0.045 * v, at, pan, wide: 10, lp: [[f[0] * 1.5, f[0] * 6, f[0] * 1.8], 5], vib: [5 + r(1) * 3, 55], fm: [0.5, 0.7, 0] });
      break;
    // Glass: a bell an octave up, shimmering, with glints after it.
    case 'STAR':
      voice({ w: 'sine', f: hi, dur: dur * 1.15, vol: 0.068 * v, at, pan, fm: [3.5, 2, 0.3], trem: [11 + r(1) * 6, 0.4] });
      for (let k = 0; k < 2; k++) voice({ w: 'sine', f: [f[0] * (4 + 2 * r(k + 2))], dur: 0.05, vol: 0.018 * v, at: at + dur * (0.4 + 0.3 * k), pan, fm: [2.76, 1, 0] });
      break;
    // Brine: a thin reedy tone over a crackle of crystals.
    case 'SALT':
      voice({ w: 'triangle', f: f.map(x => x * 1.5), dur, vol: 0.05 * v, at, pan, trem: [22 + r(1) * 10, 0.6] });
      voice({ w: 'noise', f: [6500, 3500], dur, vol: 0.06 * v, q: 3, trem: [38 + r(2) * 12, 0.95], at, pan });
      break;
    // Hollow: a slow swell that sinks, with a beating twin.
    case 'VOID':
      voice({ w: 'sine', f: f.map((x, i) => x * (1 - 0.06 * i)), dur: dur * 1.1, vol: 0.1 * v, a: dur * 0.45, at, pan, fm: [1.41, 0.8, 0], wide: 7, vib: [2.5 + r(1) * 2, 30] });
      break;
  }
}

/**
 * Plays a cry. A whorl cries when it is sent out, when it uses a crest (brighter and quicker), and when it is knocked out
 * (lower, slower, and sinking). `vol` scales it and `pan` places it left or right.
 */
export function cry(c: CryDef, mode: 'out' | 'crest' | 'ko' = 'out', opts: { vol?: number; pan?: number; at?: number } = {}): void {
  let f = c.f.slice(), dur = c.dur, v = opts.vol ?? 1;
  if (mode === 'crest') { f = f.map(x => x * 1.12); dur *= 0.9; v *= 1.15; }
  if (mode === 'ko') { f = f.map(x => x * 0.72); f.push(f[f.length - 1] * 0.6); dur = Math.min(0.98, dur * 1.35); v *= 0.9; }
  const at = opts.at || 0, pan = opts.pan || 0;
  c.types.forEach((t, i) => cryLayer(t, f, dur, i === 0 ? v : v * 0.6, at + i * 0.015, pan, c.seed + i * 7));
  if (mode === 'ko') voice({ w: 'noise', f: [1100, 160], dur: 0.4, vol: 0.14 * v, q: 1, at: at + dur * 0.6, pan });
}

// ---------------------------------------------------------------- footsteps

/** What a walker steps on. */
export type Ground = 'sand' | 'wet' | 'grass' | 'wood' | 'stone' | 'shell' | 'metal' | 'water' | 'ice' | 'snow' | 'mud' | 'earth' | 'blank';
export const GROUNDS: readonly Ground[] = ['sand', 'wet', 'grass', 'wood', 'stone', 'shell', 'metal', 'water', 'ice', 'snow', 'mud', 'earth', 'blank'];

/** Evens out how loud each ground's step sounds, measured with `measure`. Low thuds get a little more and bright clicks a little less. */
const STEP_GAIN: Record<Ground, number> = {
  sand: 1.15, wet: 1.08, grass: 0.76, wood: 0.57, stone: 1.41, shell: 1.35, metal: 0.83, water: 0.68, ice: 1.77, snow: 1.47, mud: 0.72, earth: 0.75, blank: 1,
};

/** One footstep on a ground. `vol` scales it for walkers further off, `pan` places it, and `foot` 1 is the other foot, a little lower. */
export function footstep(g: Ground, opts: { vol?: number; pan?: number; foot?: number } = {}): void {
  const v = (opts.vol ?? 1) * STEP_GAIN[g], pan = opts.pan ?? 0, k = opts.foot ? 0.93 : 1;
  switch (g) {
    case 'sand': voice({ w: 'noise', f: [jit(2300 * k, 0.15), 1500], dur: 0.05, vol: 0.09 * v, q: 1.6, a: 0.008, pan }); break;
    case 'wet':
      voice({ w: 'noise', f: [jit(1000 * k, 0.15), 520], dur: 0.06, vol: 0.09 * v, q: 2, a: 0.006, pan });
      voice({ w: 'sine', f: [jit(320 * k, 0.1), 190], dur: 0.04, vol: 0.022 * v, fm: [1.5, 0.8, 0], pan });
      break;
    case 'grass': voice({ w: 'noise', f: [jit(4600 * k, 0.15), 3000], dur: 0.075, vol: 0.06 * v, q: 0.9, a: 0.018, pan }); break;
    case 'wood':
      voice({ w: 'sine', f: [jit(300 * k, 0.06), 250], dur: 0.06, vol: 0.05 * v, fm: [2.3, 1.2, 0], pan });
      voice({ w: 'noise', f: [1800], dur: 0.015, vol: 0.05 * v, q: 3, pan });
      break;
    case 'stone':
      voice({ w: 'noise', f: [jit(3200 * k, 0.12), 2200], dur: 0.022, vol: 0.09 * v, q: 4, pan });
      voice({ w: 'sine', f: [jit(820 * k, 0.05)], dur: 0.025, vol: 0.012 * v, fm: [2.76, 1, 0], pan });
      break;
    case 'shell':
      for (let i = 0; i < 3; i++) voice({ w: 'noise', f: [jit(5200 * k, 0.2)], dur: 0.01, vol: 0.08 * v, q: 6, at: i * jit(0.013, 0.3), pan });
      voice({ w: 'sine', f: [jit(1900 * k, 0.08)], dur: 0.05, vol: 0.008 * v, fm: [2.76, 1.4, 0], at: 0.01, pan });
      break;
    case 'metal':
      voice({ w: 'sine', f: [jit(540 * k, 0.05)], dur: 0.1, vol: 0.022 * v, fm: [3.7, 2.6, 0.4], pan });
      voice({ w: 'noise', f: [4000], dur: 0.012, vol: 0.05 * v, q: 4, pan });
      break;
    case 'water':
      voice({ w: 'noise', f: [jit(1500, 0.15), 600, 900], dur: 0.13, vol: 0.09 * v, q: 1, a: 0.01, pan });
      for (let i = 0; i < 2; i++) voice({ w: 'sine', f: [jit(500, 0.2), jit(1100, 0.2)], dur: 0.04, vol: 0.015 * v, at: 0.06 + i * jit(0.05, 0.4), fm: [1.5, 0.6, 0], pan });
      break;
    case 'ice':
      voice({ w: 'noise', f: [jit(6200 * k, 0.1), 4200], dur: 0.03, vol: 0.06 * v, q: 5, pan });
      voice({ w: 'sine', f: [jit(2400 * k, 0.06)], dur: 0.04, vol: 0.008 * v, fm: [2.76, 1.6, 0], pan });
      break;
    case 'snow': voice({ w: 'noise', f: [jit(1300 * k, 0.12), 850], dur: 0.085, vol: 0.1 * v, q: 0.8, a: 0.01, trem: [jit(60, 0.2), 0.9], pan }); break;
    case 'mud':
      voice({ w: 'sine', f: [jit(170 * k, 0.1), 95, 140], dur: 0.08, vol: 0.035 * v, fm: [1.5, 1.4, 0], pan });
      voice({ w: 'noise', f: [700, 400], dur: 0.05, vol: 0.05 * v, q: 1.5, pan });
      break;
    case 'earth':
      voice({ w: 'sine', f: [jit(115 * k, 0.08), 72], dur: 0.05, vol: 0.04 * v, pan });
      voice({ w: 'noise', f: [jit(900 * k, 0.15)], dur: 0.03, vol: 0.06 * v, q: 1, pan });
      break;
    case 'blank': voice({ w: 'sine', f: [jit(1250 * k, 0.04)], dur: 0.03, vol: 0.006 * v, pan }); break;
  }
}

// ---------------------------------------------------------------- auditions

/**
 * Renders whatever `play` sounds offline, through the effects volume as it stands, and returns its peak, its energy (sum of
 * squared samples), and its level: the root mean square of the 50 ms windows within 40 dB of the loudest, so gaps do not count.
 */
export async function measure(play: () => void, dur = 0.6): Promise<{ peak: number; energy: number; level: number }> {
  const sr = 44100;
  const a = new OfflineAudioContext(1, Math.ceil(sr * (dur + 0.2)), sr);
  const master = a.createGain();
  master.gain.value = sfxVolume;
  master.connect(a.destination);
  offline = { a, dest: master };
  base = 0.05;
  try { play(); } finally { offline = null; base = 0; }
  const d = (await a.startRendering()).getChannelData(0);
  let peak = 0, energy = 0;
  for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); energy += d[i] * d[i]; }
  const win = Math.round(sr * 0.05), wins: number[] = [];
  for (let i = 0; i + win <= d.length; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += d[j] * d[j]; wins.push(s / win); }
  const top = Math.max(...wins, 1e-12), live = wins.filter(w => w > top * 1e-4);
  const level = Math.sqrt(live.reduce((n, w) => n + w, 0) / Math.max(1, live.length));
  return { peak, energy, level };
}

/** Renders effects one after another into a 16-bit mono WAV data URL, for auditioning outside the game. */

export async function sfxWav(list: readonly Sfx[] = SFX, slot = 1.1): Promise<{ url: string; peaks: number[] }> {
  return renderWav(list.map(k => ({ len: k === 'boom' ? 2 : slot, play: () => sfx(k) })));
}

/** Renders a list of sounds one after another, each given `len` seconds, into a WAV data URL with each slot's peak. */
export async function renderWav(items: { len: number; play: () => void }[]): Promise<{ url: string; peaks: number[] }> {
  const sr = 44100;
  const slots = items.map(it => it.len);
  const total = slots.reduce((n, s) => n + s, 0.2);
  const a = new OfflineAudioContext(1, Math.ceil(sr * total), sr);
  const master = a.createGain();
  master.gain.value = sfxVolume;
  master.connect(a.destination);
  offline = { a, dest: master };
  base = 0.1;
  try { items.forEach((it, i) => { it.play(); base += slots[i]; }); } finally { offline = null; base = 0; }
  const buf = await a.startRendering();
  const d = buf.getChannelData(0);
  const peaks: number[] = [];
  let at = 0.1;
  for (const s of slots) { let p = 0; for (let i = Math.floor(at * sr); i < Math.min(d.length, Math.floor((at + s) * sr)); i++) p = Math.max(p, Math.abs(d[i])); peaks.push(Math.round(p * 1000) / 1000); at += s; }
  const bytes = new Uint8Array(44 + d.length * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { url: 'data:audio/wav;base64,' + btoa(bin), peaks };
}
