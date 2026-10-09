// A small formant speech synth. Every letter of a line plays as a tiny vowel, hiss, puff, hum, or glide in the speaker's voice.
import { sink } from './audio';

/** What the voice's source sounds like before the formants shape it. */
export type Source = 'breathy' | 'buzzy' | 'reedy';

/** A voice's oddity, on top of its pitch, size, source, and speed. */
export type Quirk = 'none' | 'tremble' | 'wobble' | 'flutter' | 'chirp' | 'glide' | 'crack' | 'twin' | 'echo' | 'bubble'
  | 'bell' | 'coin' | 'hum' | 'buzz' | 'sift' | 'drip' | 'pant' | 'bottle' | 'quill' | 'gust';

export interface TalkVoice {
  /** Middle pitch in Hz. */
  f: number;
  /** Formant scale. Above 1 sounds like a small speaker and below 1 like a large one. */
  size: number;
  /** Breathy is a soft tone with air through it, buzzy a rounded sawtooth, and reedy a pulse that sounds nasal. */
  src: Source;
  /** Letters a second. The dialogue box types at this pace while the speaker talks. */
  rate: number;
  /** Semitone steps above `f` that a word's pitch aims for before it settles on a note of the scale. */
  steps: number[];
  quirk: Quirk;
  /** Vibrato rate in Hz and depth in cents. */
  vib?: [number, number];
  /** Loudness trim in decibels, measured so every voice sits at the same level. */
  trim?: number;
}

/** One letter to speak. */
export interface Letter {
  /** The letter in lowercase, or a digit. */
  ch: string;
  /** Semitones above the voice's pitch. */
  semi: number;
  /** Semitones the pitch slides across the letter. */
  slide: number;
  /** Semitones below its pitch that the letter starts, rising into it. */
  scoop: number;
  /** True when the letter glides on from the last letter's pitch instead of starting fresh. */
  legato: boolean;
  /** Loudness factor. */
  vol: number;
  /** Length factor. */
  stretch: number;
  /** The next vowel in the word, which a glide or an h moves toward. */
  next: string;
  /** True on the last voiced letter of a word, where chirps, pings, and drips go. */
  tail: boolean;
  /** The sentence mark that the word closes, on its tail letter only. */
  end: '' | '.' | '?' | '!' | '...';
  /** The letter's count in its page. */
  n: number;
}

/** Talking plays this much louder than a voice's own level, so speech sits above the music. Set with the sound test page's level check. */
const TALK_GAIN = 0.17;

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

export function kindOf(ch: string): Kind | null { return KIND[DIGIT[ch] || ch] || null; }
/** True for letters with a pitch: vowels, glides, and hums. */
export function isTonal(ch: string): boolean { const k = kindOf(ch); return k === 'vowel' || k === 'glide' || k === 'hum'; }
/** The vowel a digit or letter speaks as, or '' for a consonant. */
export function vowelOf(ch: string): string { const c = DIGIT[ch] || ch; return KIND[c] === 'vowel' ? c : ''; }

/** First and second formants in Hz for a speaker of size 1, set a little low so the voices sound warm. */
const VOWEL: Record<string, [number, number]> = { a: [750, 1180], e: [450, 1780], i: [285, 2250], o: [510, 830], u: [310, 700], y: [300, 1550] };
/** Where a glide's formants start before they move to the next vowel's. */
const GLIDE: Record<string, [number, number]> = { l: [340, 940], r: [430, 1260], w: [285, 570], j: [265, 2120] };
/** Band center and Q for each noisy consonant. An h takes its center from the next vowel instead. Bands sit low and wide so they hush rather than hiss. */
const NOISE: Record<string, [number, number]> = {
  s: [4300, 1.4], c: [4000, 1.4], z: [3600, 1.4], x: [3800, 1.2], f: [2600, 0.8], v: [2000, 0.8], h: [0, 2],
  p: [700, 1], b: [550, 1], t: [2600, 1.1], d: [2100, 1.1], k: [1500, 1.2], g: [1200, 1.2], q: [1400, 1.2],
};
/** A hum's low-pass cutoff in Hz for a speaker of size 1. */
const HUM: Record<string, number> = { m: 360, n: 490 };

/** Length of each kind of letter as a share of the gap between letters. Above 1 overlaps the next letter. */
const LEN: Record<Kind, number> = { vowel: 1.25, glide: 1.1, hum: 1.1, hiss: 0.85, soft: 0.8, burst: 0.6 };
/** Loudness of each kind of letter against a vowel. Consonants sit well under the vowels, which carry the tune. */
const LEVEL: Record<Kind, number> = { vowel: 1, glide: 0.8, hum: 0.65, hiss: 0.16, soft: 0.1, burst: 0.3 };

/** A letter's sound length in seconds at normal stretch. */
export function letterLength(v: TalkVoice, ch: string): number {
  const k = kindOf(ch);
  return k ? (LEN[k] / v.rate) * (v.quirk === 'buzz' ? 1.4 : 1) : 0;
}

// ---------------------------------------------------------------- sources

const HARM = 48;

/** Harmonic amplitudes of each source, scaled so the wave peaks at 1. They are kept so each letter's loudness can be worked out. */
function series(src: Source): { re: Float32Array; im: Float32Array; amp: Float32Array } {
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
const SERIES: Record<Source, ReturnType<typeof series>> = { breathy: series('breathy'), buzzy: series('buzzy'), reedy: series('reedy') };

/** Noise loudness: plain for consonants, louder for a breathy voice's air, louder still for a voice made of wind. */
const AIR = { noise: 1, breath: 2, gust: 6 };

interface Kit { wave: Record<Source, PeriodicWave>; noise: Record<keyof typeof AIR, AudioBuffer> }
const kits = new WeakMap<BaseAudioContext, Kit>();

function kit(a: BaseAudioContext): Kit {
  let k = kits.get(a);
  if (k) return k;
  const wave = {} as Record<Source, PeriodicWave>;
  for (const s of ['breathy', 'buzzy', 'reedy'] as Source[]) wave[s] = a.createPeriodicWave(SERIES[s].re, SERIES[s].im, { disableNormalization: true });
  const noise = {} as Kit['noise'];
  let seed = 99;
  for (const [name, amp] of Object.entries(AIR) as [keyof typeof AIR, number][]) {
    const b = a.createBuffer(1, a.sampleRate, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * amp; }
    noise[name] = b;
  }
  k = { wave, noise };
  kits.set(a, k);
  return k;
}

// ---------------------------------------------------------------- loudness

type Band = ['bp' | 'lp', number, number];

/** Gain of a band-pass biquad at `f`. */
const bandGain = (f: number, fc: number, q: number): number => { const r = f / fc; return 1 / Math.sqrt(1 + q * q * (r - 1 / r) ** 2); };
/** Gain of a low-pass biquad at `f`. The browser takes a low-pass Q in decibels. */
const lowGain = (f: number, fc: number, qdb: number): number => { const r = f / fc, ql = 10 ** (qdb / 20); return 1 / Math.sqrt((1 - r * r) ** 2 + (r / ql) ** 2); };

/** Root mean square of a source at pitch `f0` through parallel filters. */
function toneRms(src: Source, f0: number, bands: Band[]): number {
  const amp = SERIES[src].amp;
  let s = 0;
  for (let n = 1; n < HARM && n * f0 < 12000; n++) {
    let h = 0;
    for (const [t, fc, q] of bands) h += t === 'bp' ? bandGain(n * f0, fc, q) : lowGain(n * f0, fc, q);
    s += (amp[n] * h) ** 2 / 2;
  }
  return Math.sqrt(s);
}

/** Root mean square of uniform noise of amplitude `amp` through parallel band-passes. */
function noiseRms(amp: number, sr: number, bands: Band[]): number {
  let p = 0;
  for (const [, fc, q] of bands) p += ((amp * amp) / 3) * ((Math.PI * fc) / (2 * q)) / (sr / 2);
  return Math.sqrt(p);
}

// ---------------------------------------------------------------- shapes

/** Amplitude flutter per quirk: rate in Hz and depth from 0 to 1. */
const FLUTTER: Partial<Record<Quirk, [number, number]>> = { tremble: [7, 0.35], hum: [50, 0.4], buzz: [28, 0.5], sift: [45, 0.5], quill: [70, 0.45] };
/** Vibrato per quirk, used when the voice sets none of its own. */
const VIB: Partial<Record<Quirk, [number, number]>> = { tremble: [6, 45], wobble: [7, 90], flutter: [12, 50] };
/** Vibrato for every other voice, wide enough to warble across a word. */
const VIB_BASE: [number, number] = [5.8, 28];

/**
 * A letter's loudness over its length: an attack, then a rounded shape for its kind, with any flutter from the quirk.
 * Tonal letters take 8 ms to open and puffs 4 ms, so nothing clicks.
 */
function envelope(kind: Kind, dur: number, peak: number, t: number, quirk: Quirk): Float32Array {
  const N = 24, c = new Float32Array(N);
  const att = kind === 'burst' ? 0.004 : 0.008;
  const fl = FLUTTER[quirk];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), tt = u * dur;
    let e = Math.min(1, tt / att);
    e *= kind === 'burst' ? (1 - u) ** 2 : kind === 'hiss' || kind === 'soft' ? Math.sin(Math.PI * u) : 1 - u ** 2.2;
    if (fl) e *= (1 - fl[1] * (0.5 + 0.5 * Math.sin(2 * Math.PI * fl[0] * (t + tt)))) / (1 - fl[1] / 2);
    c[i] = peak * e;
  }
  c[N - 1] = 0;
  return c;
}

/** The slow pitch drift the music's voices share, in semitones at time `t`: two slow sines, about 20 cents at most. */
const drift = (t: number): number => 0.12 * Math.sin(2 * Math.PI * 0.19 * t) + 0.08 * Math.sin(2 * Math.PI * 0.061 * t + 1);

const clampF = (f: number, a: BaseAudioContext): number => Math.max(60, Math.min(a.sampleRate * 0.45, f));

function band(a: BaseAudioContext, type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
  const b = a.createBiquadFilter();
  b.type = type;
  b.frequency.value = clampF(f, a);
  b.Q.value = q;
  return b;
}

/** A short decaying tone into `out`, for the quirks that add a ping or a drop. */
function ping(a: BaseAudioContext, out: AudioNode, w: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number): void {
  const o = a.createOscillator(), g = a.createGain();
  o.type = w;
  o.frequency.setValueAtTime(clampF(f0, a), t);
  o.frequency.exponentialRampToValueAtTime(clampF(f1, a), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.01);
}

// ---------------------------------------------------------------- the mouth

/** A soft limit on a page's output: straight up to half scale, then rounding off toward 0.84, so overlapping letters cannot spike. */
const SOFT = (() => {
  const c = new Float32Array(1025);
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1, m = Math.abs(x);
    c[i] = m <= 0.5 ? x : Math.sign(x) * (0.5 + 0.4 * Math.tanh((m - 0.5) / 0.4));
  }
  return c;
})();

/** Speaks letters in one voice through one output that `hush` can silence at once. Make one per page of dialogue. */
export class Mouth {
  private bus: GainNode | null = null;
  private gate: GainNode | null = null;
  private ctx: BaseAudioContext | null = null;
  private lastT = -1;
  private lastF = 0;

  constructor(readonly v: TalkVoice) {}

  private out(a: BaseAudioContext, dest: AudioNode): GainNode {
    if (this.bus && this.ctx === a) return this.bus;
    this.ctx = a;
    this.gate = a.createGain();
    this.gate.connect(dest);
    const soft = a.createWaveShaper();
    soft.curve = SOFT;
    soft.connect(this.gate);
    // A gentle low-pass over the whole page takes the edge off the bright band. Small voices keep a little more top.
    const mellow = band(a, 'lowpass', 3200 * Math.max(1, this.v.size), -3);
    mellow.connect(soft);
    this.bus = a.createGain();
    this.bus.gain.value = TALK_GAIN * Math.pow(10, (this.v.trim || 0) / 20);
    this.bus.connect(mellow);
    // One repeat with no feedback, so the echo is over within a letter or two of the text.
    if (this.v.quirk === 'echo') {
      const d = a.createDelay(0.5), wet = a.createGain();
      d.delayTime.value = 0.065;
      wet.gain.value = 0.6;
      this.bus.connect(d); d.connect(wet); wet.connect(mellow);
    }
    return this.bus;
  }

  /** Plays one letter `at` seconds from now. Returns false when it makes no sound, or when it would land on top of the last letter and is dropped. */
  say(l: Letter, at = 0): boolean {
    const kind = kindOf(l.ch);
    if (!kind) return false;
    const o = sink();
    if (!o) return false;
    const v = this.v, a = o.a, t = o.t + Math.max(0, at), gapT = 1 / v.rate;
    if (t < this.lastT + gapT * 0.45) return false;
    this.lastT = t;
    const k = kit(a), bus = this.out(a, o.dest);
    const ch = DIGIT[l.ch] || l.ch;
    const dur = letterLength(v, ch) * l.stretch;
    const size = v.size * (v.quirk === 'quill' ? 1.8 : 1);
    const env = a.createGain();
    env.gain.value = 0;
    env.connect(bus);
    const end = t + dur + 0.01;

    if (kind === 'hiss' || kind === 'soft' || kind === 'burst') {
      const [f0, q] = NOISE[ch];
      const fc = clampF(ch === 'h' ? (VOWEL[l.next] || VOWEL.e)[1] * size : f0 * Math.sqrt(size), a);
      const s = a.createBufferSource();
      s.buffer = k.noise.noise;
      const fl = band(a, 'bandpass', fc, q);
      // An x is a k then an s, so its band sweeps up.
      if (ch === 'x') { fl.frequency.setValueAtTime(fc * 0.45, t); fl.frequency.linearRampToValueAtTime(fc, t + dur * 0.4); }
      s.connect(fl);
      fl.connect(env);
      s.start(t, Math.random() * 0.9);
      s.stop(end);
      const g = (LEVEL[kind] * l.vol * (v.quirk === 'sift' && kind === 'hiss' ? 1.8 : 1)) / noiseRms(AIR.noise, a.sampleRate, [['bp', fc, q]]);
      env.gain.setValueCurveAtTime(envelope(kind, dur, g, t, v.quirk), t, dur);
      return true;
    }

    // A tonal letter: the source through two formant band-passes, or a low-pass for a hum.
    let f = v.f * 2 ** (l.semi / 12);
    if (v.quirk === 'crack' && kind === 'vowel' && l.n % 7 === 3) f *= 2;
    const slide = l.slide + (v.quirk === 'chirp' && l.tail ? 5 : 0);
    const legato = (l.legato || v.quirk === 'glide') && this.lastF > 0 && this.lastF / f < 2 && f / this.lastF < 2;
    const from = legato ? this.lastF : 0;
    const vib = v.vib || VIB[v.quirk] || VIB_BASE;
    const N = 16, pitch = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), tt = t + u * dur;
      let s = slide * u + drift(tt) + (vib[1] / 100) * Math.sin(2 * Math.PI * vib[0] * tt);
      if (!from && l.scoop) s -= l.scoop * (1 - Math.min(1, u / 0.6));
      if (v.quirk === 'bubble' && kind === 'vowel') s += -4 + 8 * u;
      let x = f * 2 ** (s / 12);
      if (from && u < 0.45) x = from * (x / from) ** (u / 0.45);
      pitch[i] = clampF(x, a);
    }
    this.lastF = pitch[N - 1];

    const filters: AudioNode[] = [];
    const bands: Band[] = [];
    if (kind === 'hum') {
      const fc = HUM[ch] * size;
      filters.push(band(a, 'lowpass', fc, 4));
      bands.push(['lp', fc, 4]);
    } else {
      const q = v.quirk === 'bottle' ? 3 : 1;
      const to = VOWEL[kind === 'vowel' ? ch : l.next] || VOWEL.e;
      const start = kind === 'glide' ? GLIDE[ch] : to;
      [0, 1].forEach(j => {
        const qj = (j === 0 ? 3 : 4) * q;
        const b = band(a, 'bandpass', start[j] * size, qj);
        if (kind === 'glide') { b.frequency.setValueAtTime(clampF(start[j] * size, a), t); b.frequency.linearRampToValueAtTime(clampF(to[j] * size, a), t + dur); }
        filters.push(b);
        bands.push(['bp', ((start[j] + to[j]) / 2) * size, qj]);
      });
    }
    for (const fl of filters) fl.connect(env);

    const quill = v.quirk === 'quill';
    const air = quill || v.quirk === 'gust' ? AIR.gust : v.src === 'breathy' ? AIR.breath : 0;
    let power = 0;
    if (!quill) {
      const osc = a.createOscillator();
      osc.setPeriodicWave(k.wave[v.src]);
      osc.frequency.setValueCurveAtTime(pitch, t, dur);
      for (const fl of filters) osc.connect(fl);
      osc.start(t);
      osc.stop(end);
      power += toneRms(v.src, f, bands) ** 2;
      // The second, smaller head answers a fifth higher and a moment late.
      if (v.quirk === 'twin') {
        const o2 = a.createOscillator();
        o2.setPeriodicWave(k.wave.breathy);
        o2.frequency.setValueCurveAtTime(pitch.map(x => x * 1.5), t + 0.015, dur);
        for (const fl of filters) o2.connect(fl);
        o2.start(t + 0.015);
        o2.stop(end + 0.015);
        power += toneRms('breathy', f * 1.5, bands) ** 2;
      }
    }
    if (air && kind !== 'hum') {
      const s = a.createBufferSource();
      s.buffer = air === AIR.gust ? k.noise.gust : k.noise.breath;
      for (const fl of filters) s.connect(fl);
      s.start(t, Math.random() * 0.9);
      s.stop(end);
      power += noiseRms(air, a.sampleRate, bands.filter(b => b[0] === 'bp')) ** 2;
    }
    const g = Math.min(40, (LEVEL[kind] * l.vol) / Math.max(0.01, Math.sqrt(power)));
    env.gain.setValueCurveAtTime(envelope(kind, dur, g, t, v.quirk), t, dur);

    if (l.tail) {
      const after = t + dur * 0.8;
      if (v.quirk === 'bell') ping(a, bus, 'sine', f * 2, f * 1.99, t, 0.12, 0.4);
      if (v.quirk === 'coin' && l.end) ping(a, bus, 'triangle', f * 8, f * 8.02, after, 0.06, 0.4);
      if (v.quirk === 'drip' && l.n % 3 === 0) ping(a, bus, 'sine', f * 2, f * 3, after, 0.035, 0.5);
      if (v.quirk === 'pant' && l.n % 4 === 1) {
        const s = a.createBufferSource(), fl = band(a, 'bandpass', 1300, 1), g2 = a.createGain();
        s.buffer = k.noise.noise;
        g2.gain.setValueCurveAtTime(envelope('soft', 0.08, 0.25 / noiseRms(AIR.noise, a.sampleRate, [['bp', 1300, 1]]), after, 'none'), after, 0.08);
        s.connect(fl); fl.connect(g2); g2.connect(bus);
        s.start(after, Math.random() * 0.9);
        s.stop(after + 0.09);
      }
    }
    return true;
  }

  /** Silences every letter already scheduled within 10 milliseconds, and drops any letter asked for after. */
  hush(): void {
    this.lastT = Infinity;
    if (!this.gate || !this.ctx) return;
    const now = this.ctx.currentTime, g = this.gate.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + 0.01);
  }
}
