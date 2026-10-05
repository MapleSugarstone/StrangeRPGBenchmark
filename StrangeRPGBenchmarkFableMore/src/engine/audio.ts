import { Rng } from "./rng";

/**
 * Everything is synthesized. In this world music is made by plucking people's
 * lines, so every voice here is a pluck: a fast attack and an exponential decay.
 */

export type Mood = "town" | "road" | "dungeon" | "battle" | "boss" | "under" | "loft" | "sad" | "slack" | "title";

/** Semitone offsets of the seven note names from A. */
export const NOTE_SEMITONES: Record<string, number> = { A: 0, B: 2, C: 3, D: 5, E: 7, F: 8, G: 10 };
export const NOTE_NAMES = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

const SCALES: Record<Mood, number[]> = {
  town: [0, 2, 4, 7, 9],
  road: [0, 2, 4, 5, 7, 9, 11],
  dungeon: [0, 2, 3, 5, 7, 9, 10],
  battle: [0, 1, 4, 5, 7, 8, 10],
  boss: [0, 2, 3, 5, 7, 8, 11],
  under: [0, 2, 4, 6, 8, 10],
  loft: [0, 2, 4, 6, 7, 9, 11],
  sad: [0, 2, 3, 5, 7, 8, 10],
  slack: [0, 2, 4, 5, 7, 9, 11],
  title: [0, 3, 5, 7, 10],
};

const TEMPO: Record<Mood, number> = {
  town: 104, road: 112, dungeon: 92, battle: 138, boss: 150, under: 80, loft: 72, sad: 66, slack: 96, title: 84,
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  muted = false;
  private musicSeed = "";
  private mood: Mood | null = null;
  private timer: number | null = null;
  private nextStep = 0;
  private step = 0;
  private pattern: Pattern | null = null;
  private fading = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;
      this.musicGain.connect(this.master);
      if (this.mood) this.startScheduler();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /**
   * A plucked string. freq in Hz, dur in seconds, vol 0..1.
   * A triangle wave gives the body, a short noise burst gives the pick.
   */
  pluck(freq: number, dur = 0.6, vol = 0.5, when = 0, dest?: AudioNode, bright = 0.5): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = when || ctx.currentTime;
    const out = dest ?? this.master;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(freq * (3 + bright * 6), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.5), t0 + dur);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.setValueAtTime(freq * 1.004, t0 + 0.02);
    o.frequency.exponentialRampToValueAtTime(freq, t0 + 0.12);
    o.connect(lp).connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    // The pick
    const n = ctx.createBufferSource();
    n.buffer = this.noise();
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.35, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(8000, freq * 4);
    bp.Q.value = 1.5;
    n.connect(bp).connect(ng).connect(out);
    n.start(t0);
    n.stop(t0 + 0.05);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    return b;
  }

  private thump(when: number, vol: number, freq = 70, dest?: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 2, when);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, when + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    o.connect(g).connect(dest ?? this.master!);
    o.start(when);
    o.stop(when + 0.2);
  }

  private tick(when: number, vol: number, dest?: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise();
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;
    n.connect(hp).connect(g).connect(dest ?? this.master!);
    n.start(when);
    n.stop(when + 0.05);
  }

  /** Frequency of a named note. octave 0 is the A at 220 Hz. */
  noteFreq(note: NoteName, octave = 0): number {
    return 220 * Math.pow(2, (NOTE_SEMITONES[note] + octave * 12) / 12);
  }

  /** Play a named note, the sound of plucking someone's line. */
  playNote(note: NoteName, octave = 0, vol = 0.5): void {
    this.pluck(this.noteFreq(note, octave), 0.9, vol, 0, undefined, 0.7);
  }

  /** Strum three notes close together. */
  playChord(notes: NoteName[], good = true): void {
    if (!this.ctx) return;
    const t = this.now();
    notes.forEach((n, i) => this.pluck(this.noteFreq(n, good ? 0 : -1), 1.2, 0.45, t + i * 0.07, undefined, good ? 0.8 : 0.3));
  }

  // -------------------------------------------------------------------------
  // Sound effects

  sfx(name: string): void {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const p = (f: number, d = 0.25, v = 0.4, dt = 0, br = 0.5) => this.pluck(f, d, v, t + dt, undefined, br);
    switch (name) {
      case "cursor": p(880, 0.08, 0.25, 0, 0.3); break;
      case "ok": p(660, 0.15, 0.3); p(990, 0.2, 0.3, 0.05); break;
      case "cancel": p(440, 0.15, 0.3); p(330, 0.2, 0.25, 0.05); break;
      case "text": p(1760, 0.03, 0.08, 0, 0.1); break;
      case "step": this.tick(t, 0.05); break;
      case "hit": this.thump(t, 0.5, 90); this.tick(t, 0.3); break;
      case "hit2": this.thump(t, 0.6, 60); p(110, 0.2, 0.4, 0, 0.9); break;
      case "pluck": p(330, 0.5, 0.5, 0, 0.9); p(660, 0.5, 0.3, 0.01, 0.9); break;
      case "snap": p(1200, 0.08, 0.5, 0, 1); this.tick(t, 0.5); p(150, 0.3, 0.4, 0.05, 0.2); break;
      case "duck": p(220, 0.12, 0.3, 0, 0.2); p(165, 0.15, 0.3, 0.06, 0.2); break;
      case "heal": p(523, 0.4, 0.3); p(659, 0.4, 0.3, 0.08); p(784, 0.6, 0.3, 0.16); break;
      case "tension": p(392 + Math.random() * 30, 0.2, 0.3, 0, 0.8); break;
      case "lift": for (let i = 0; i < 6; i++) p(220 * Math.pow(2, i / 6), 0.3, 0.25, i * 0.06, 0.6); break;
      case "fall": for (let i = 0; i < 6; i++) p(660 * Math.pow(2, -i / 6), 0.25, 0.25, i * 0.05, 0.4); this.thump(t + 0.35, 0.6, 50); break;
      case "knot": p(440, 0.2, 0.3); p(440, 0.2, 0.3, 0.1); p(587, 0.4, 0.35, 0.2); break;
      case "untie": p(587, 0.2, 0.3); p(440, 0.3, 0.3, 0.1); break;
      case "tangle": p(392, 0.3, 0.3, 0, 0.9); p(415, 0.3, 0.3, 0.04, 0.9); p(370, 0.4, 0.3, 0.08, 0.9); break;
      case "wind": { const n = this.ctx.createBufferSource(); n.buffer = this.noise(); const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.6); bp.Q.value = 2; n.connect(bp).connect(g).connect(this.master); n.start(t); n.stop(t + 0.8); break; }
      case "cold": p(1046, 0.5, 0.25, 0, 0.9); p(1568, 0.6, 0.2, 0.05, 1); this.tick(t, 0.2); break;
      case "heat": this.thump(t, 0.4, 120); p(196, 0.3, 0.4, 0, 0.9); p(233, 0.3, 0.3, 0.05, 0.9); break;
      case "miss": p(300, 0.1, 0.2, 0, 0.2); break;
      case "win": [523, 659, 784, 1046].forEach((f, i) => p(f, 0.5, 0.35, i * 0.1)); break;
      case "lose": [440, 415, 392, 311].forEach((f, i) => p(f, 0.6, 0.35, i * 0.18, 0.3)); break;
      case "level": [392, 523, 659, 784, 1046].forEach((f, i) => p(f, 0.35, 0.3, i * 0.07)); break;
      case "item": p(784, 0.2, 0.3); p(1046, 0.3, 0.3, 0.08); break;
      case "slug": p(1200, 0.1, 0.3, 0, 1); p(1500, 0.2, 0.2, 0.05, 1); break;
      case "door": this.thump(t, 0.3, 100); p(165, 0.3, 0.3, 0.05, 0.3); break;
      case "save": [659, 784, 659, 1046].forEach((f, i) => p(f, 0.3, 0.3, i * 0.08)); break;
      case "lock": p(220, 0.2, 0.4, 0, 0.3); p(220, 0.2, 0.4, 0.12, 0.3); break;
      case "unlock": p(659, 0.2, 0.35); p(880, 0.4, 0.35, 0.1); break;
      case "charge": for (let i = 0; i < 4; i++) p(110 * (i + 2), 0.25, 0.25, i * 0.08, 0.9); break;
      case "boss": this.thump(t, 0.7, 45); this.thump(t + 0.3, 0.7, 45); p(98, 1.2, 0.5, 0.3, 0.9); break;
      case "hand": p(1318, 0.15, 0.25, 0, 0.5); p(1046, 0.2, 0.25, 0.06, 0.5); break;
      case "whoosh": { const n = this.ctx.createBufferSource(); n.buffer = this.noise(); const g = this.ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(2000, t); bp.frequency.exponentialRampToValueAtTime(300, t + 0.3); n.connect(bp).connect(g).connect(this.master); n.start(t); n.stop(t + 0.35); break; }
      default: p(660, 0.15, 0.3);
    }
  }

  // -------------------------------------------------------------------------
  // Music

  play(mood: Mood, seed: string): void {
    if (this.mood === mood && this.musicSeed === seed) return;
    this.mood = mood;
    this.musicSeed = seed;
    this.pattern = makePattern(mood, seed);
    this.step = 0;
    if (this.ctx) {
      this.fading = false;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.05);
      this.nextStep = this.ctx.currentTime + 0.1;
      this.startScheduler();
    }
  }

  stop(): void {
    this.mood = null;
    this.pattern = null;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Fade the music out over a second and stop. */
  fadeOut(): void {
    if (!this.ctx || !this.musicGain) {
      this.stop();
      return;
    }
    this.fading = true;
    this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    const seed = this.musicSeed, mood = this.mood;
    setTimeout(() => {
      if (this.fading && this.musicSeed === seed && this.mood === mood) this.stop();
    }, 1200);
  }

  private startScheduler(): void {
    if (this.timer !== null || !this.ctx) return;
    this.nextStep = Math.max(this.nextStep, this.ctx.currentTime + 0.05);
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule(): void {
    if (!this.ctx || !this.pattern || !this.musicGain) return;
    const ahead = this.ctx.currentTime + 0.18;
    while (this.nextStep < ahead) {
      const loop = Math.floor(this.step / this.pattern.length);
      this.playStep(this.pattern, this.step % this.pattern.length, this.nextStep, loop);
      this.nextStep += this.pattern.stepDur;
      this.step++;
    }
  }

  /** A hum: two detuned triangles with a slow swell. The sound of lines under tension. */
  private hum(freq: number, dur: number, vol: number, when: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + Math.min(0.4, dur * 0.3));
    g.gain.setValueAtTime(vol, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = freq * 2.5;
    for (const d of [-0.4, 0.4]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq * Math.pow(2, d / 100);
      o.connect(lp);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
    lp.connect(g).connect(dest);
  }

  /** A bell: a sine with a fifth above it, fast decay. */
  private bell(freq: number, dur: number, vol: number, when: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (const [mul, v] of [[1, 1], [1.5, 0.35], [2.76, 0.15]] as [number, number][]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * v, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur / (mul > 2 ? 3 : 1));
      o.connect(g).connect(dest);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  /** A breath: filtered noise swell for the Under and the Deck. */
  private breath(when: number, dur: number, vol: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise();
    n.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(300, when);
    bp.frequency.exponentialRampToValueAtTime(900, when + dur);
    bp.Q.value = 3;
    n.connect(bp).connect(g).connect(dest);
    n.start(when);
    n.stop(when + dur + 0.05);
  }

  private playStep(p: Pattern, i: number, t: number, loop: number): void {
    const dest = this.musicGain!;
    // Each pass through the loop drops a few melody notes and adds a grace note, so it never repeats exactly
    const vary = (p.varySeed + loop * 7919 + i * 31) % 97;
    const b = p.bass[i];
    if (b !== null) this.pluck(b, p.stepDur * 3.5, 0.5, t, dest, 0.25);
    const m = p.melody[i];
    if (m !== null && !(loop > 0 && vary < 14)) {
      if (p.voice === "bell") this.bell(m, p.stepDur * 5, 0.22, t, dest);
      else this.pluck(m, p.stepDur * 4, 0.3, t, dest, 0.7);
      if (loop > 0 && vary > 90 && p.melody[i + 1] === null) this.pluck(m * 1.125, p.stepDur * 2, 0.15, t + p.stepDur * 0.5, dest, 0.7);
    }
    const h = p.harmony[i];
    if (h !== null) this.pluck(h, p.stepDur * 3, 0.18, t + 0.01, dest, 0.5);
    const pad = p.pad[i];
    if (pad !== null) for (const f of pad) this.hum(f, p.stepDur * 15, 0.07, t, dest);
    if (p.kick[i]) this.thump(t, 0.35, p.kickFreq, dest);
    if (p.tick[i] && !(loop % 2 === 1 && vary < 20)) this.tick(t, 0.12, dest);
    if (p.breath[i]) this.breath(t, p.stepDur * 12, 0.08, dest);
  }
}

interface Pattern {
  stepDur: number;
  length: number;
  bass: (number | null)[];
  melody: (number | null)[];
  harmony: (number | null)[];
  pad: (number[] | null)[];
  kick: boolean[];
  tick: boolean[];
  breath: boolean[];
  kickFreq: number;
  voice: "pluck" | "bell";
  varySeed: number;
}

function freqOf(semi: number, base: number): number {
  return base * Math.pow(2, semi / 12);
}

/** Chord progressions by mood, as scale degrees, one per 16 step bar. */
const PROGRESSIONS: Record<Mood, number[][]> = {
  town: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 2, 3, 4]],
  road: [[0, 4, 5, 3], [0, 3, 0, 4], [5, 3, 0, 4]],
  dungeon: [[0, 0, 5, 3], [0, 6, 5, 0], [0, 3, 6, 4]],
  battle: [[0, 0, 1, 0], [0, 5, 1, 0], [0, 3, 1, 4]],
  boss: [[0, 1, 0, 6], [0, 6, 1, 0], [0, 4, 1, 6]],
  under: [[0, 2, 0, 4], [0, 4, 2, 0]],
  loft: [[0, 3, 0, 4], [0, 1, 0, 6]],
  sad: [[0, 5, 3, 4], [0, 2, 5, 3]],
  slack: [[0, 3, 4, 0], [0, 5, 3, 4]],
  title: [[0, 2, 3, 0], [0, 4, 3, 0]],
};

/**
 * A 128 step pattern in four sections, A A' B A''. A seeded eight note motif
 * is transposed, inverted and thinned per section, so the tune has a shape and
 * comes back changed.
 */
function makePattern(mood: Mood, seed: string): Pattern {
  const rng = new Rng(`${mood}:${seed}`);
  const scale = SCALES[mood];
  const bpm = TEMPO[mood] + rng.range(-6, 6);
  const stepDur = 60 / bpm / 2;
  const root = 110 * Math.pow(2, rng.range(-3, 4) / 12);
  const n = 128;
  const bass: (number | null)[] = new Array(n).fill(null);
  const melody: (number | null)[] = new Array(n).fill(null);
  const harmony: (number | null)[] = new Array(n).fill(null);
  const pad: (number[] | null)[] = new Array(n).fill(null);
  const kick: boolean[] = new Array(n).fill(false);
  const tick: boolean[] = new Array(n).fill(false);
  const breath: boolean[] = new Array(n).fill(false);
  const sparse = mood === "sad" || mood === "loft" || mood === "under" || mood === "title";
  const dense = mood === "battle" || mood === "boss";
  const progA = rng.pick(PROGRESSIONS[mood]);
  const progB = rng.pick(PROGRESSIONS[mood]);
  const L = scale.length;
  const degreeSemi = (deg: number) => scale[((deg % L) + L) % L] + 12 * Math.floor(deg / L);
  // The motif: eight steps, degrees relative to the chord root, with rests
  const motif: (number | null)[] = [];
  let cur = rng.range(0, 3);
  for (let k = 0; k < 8; k++) {
    if (k > 0 && rng.chance(sparse ? 0.45 : 0.25)) { motif.push(null); continue; }
    cur += rng.pick([-2, -1, 0, 1, 1, 2, 3]);
    cur = Math.max(-2, Math.min(7, cur));
    motif.push(cur);
  }
  // A rhythm for the motif: which of the 8 steps are on the beat
  const rhythm = motif.map((m, k) => (m === null ? false : k % 2 === 0 || rng.chance(dense ? 0.7 : 0.45)));
  for (let sec = 0; sec < 4; sec++) {
    const prog = sec === 2 ? progB : progA;
    const transpose = sec === 1 ? rng.pick([0, 2, 4]) : sec === 2 ? rng.pick([3, 4, -3]) : 0;
    const invert = sec === 2 || (sec === 3 && rng.chance(0.5));
    const thin = sec === 3 ? 0.25 : 0;
    for (let bar = 0; bar < 4; bar++) {
      const deg = prog[bar];
      const rootSemi = degreeSemi(deg);
      for (let st = 0; st < 16; st++) {
        const i = sec * 32 + bar * 16 + st;
        if (st % 8 === 0 || (dense && st % 8 === 6) || (st === 12 && rng.chance(0.4))) bass[i] = freqOf(rootSemi + (st === 12 ? degreeSemi(deg + 4) - rootSemi : 0), root);
        if (sparse ? st % 8 === 0 : st % 4 === 0) kick[i] = !sparse || rng.chance(0.5);
        if (dense ? st % 2 === 1 : st % 4 === 2) tick[i] = rng.chance(dense ? 0.85 : 0.5);
        // Melody from the motif, two octaves up, following the chord
        const k = st % 8;
        const m = motif[k];
        if (m !== null && rhythm[k] && !(thin > 0 && rng.chance(thin))) {
          const d = (invert ? -m : m) + transpose + deg;
          const semi = degreeSemi(d) + 24;
          melody[i] = freqOf(semi, root);
        }
        // Second half of each bar answers with a pickup from the next chord
        if (st === 14 && rng.chance(0.5)) melody[i] = freqOf(degreeSemi(prog[(bar + 1) % 4] + 2) + 24, root);
      }
      // Harmony on the half bar: a chord tone
      harmony[sec * 32 + bar * 16 + 8 + (rng.chance(0.5) ? 1 : 0)] = freqOf(degreeSemi(deg + rng.pick([2, 4])) + 12, root);
      // Pads for moods that hum, chord tones held for the bar
      if (mood === "dungeon" || mood === "boss" || mood === "loft" || mood === "under" || mood === "sad" || mood === "title") {
        pad[sec * 32 + bar * 16] = [freqOf(rootSemi, root), freqOf(degreeSemi(deg + 2), root), freqOf(degreeSemi(deg + 4), root)];
      }
      if ((mood === "under" || mood === "loft") && bar % 2 === 0) breath[sec * 32 + bar * 16 + 4] = true;
    }
  }
  // Section B is quieter in the bass so the change is felt
  for (let i = 64; i < 96; i++) if (i % 16 !== 0 && rng.chance(0.5)) bass[i] = null;
  return { stepDur, length: n, bass, melody, harmony, pad, kick, tick, breath, kickFreq: mood === "boss" ? 50 : 70, voice: mood === "town" || mood === "slack" ? "bell" : "pluck", varySeed: rng.int(97) };
}
