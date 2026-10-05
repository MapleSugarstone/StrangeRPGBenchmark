import { Rng, hash } from "./rng";

/**
 * All sound is synthesized with the Web Audio API. Effects are short envelope shaped oscillators and
 * noise bursts. Music is a seeded 32 step pattern (bass, melody, arpeggio, drums) scheduled a little ahead.
 */
export type Mood = "title" | "town" | "dungeon" | "battle" | "boss" | "victory" | "credits" | "none";

export type Sfx =
  | "blip" | "cursor" | "confirm" | "cancel" | "hit" | "crit" | "heal" | "miss" | "status" | "death"
  | "link" | "levelup" | "open" | "coin" | "rewind" | "fuse" | "chest" | "step" | "encounter" | "flee" | "word";

const SCALES: Record<string, number[]> = {
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
};

interface MoodDef { bpm: number; scale: string; root: [number, number]; drums: boolean; arp: boolean; density: number; wave: OscillatorType }

const MOODS: Record<Exclude<Mood, "none">, MoodDef> = {
  title: { bpm: 72, scale: "minorPent", root: [45, 50], drums: false, arp: false, density: 0.45, wave: "triangle" },
  town: { bpm: 104, scale: "majorPent", root: [50, 57], drums: true, arp: false, density: 0.6, wave: "square" },
  dungeon: { bpm: 92, scale: "dorian", root: [43, 50], drums: true, arp: true, density: 0.5, wave: "triangle" },
  battle: { bpm: 148, scale: "phrygian", root: [45, 52], drums: true, arp: true, density: 0.7, wave: "square" },
  boss: { bpm: 156, scale: "harmonicMinor", root: [41, 48], drums: true, arp: true, density: 0.75, wave: "sawtooth" },
  victory: { bpm: 126, scale: "major", root: [55, 60], drums: true, arp: false, density: 0.8, wave: "square" },
  credits: { bpm: 84, scale: "mixolydian", root: [50, 55], drums: false, arp: true, density: 0.55, wave: "triangle" },
};

interface Note { step: number; midi: number; len: number; vel: number }
interface Pattern { bass: Note[]; melody: Note[]; arp: Note[]; kick: number[]; snare: number[]; hat: number[]; steps: number; bpm: number; wave: OscillatorType }

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function buildPattern(mood: Exclude<Mood, "none">, seed: number): Pattern {
  const d = MOODS[mood];
  const rng = new Rng(hash(`${mood}:${seed}`));
  const scale = SCALES[d.scale];
  const root = rng.int(d.root[0], d.root[1]);
  const steps = 32;
  const degree = (i: number, octave = 0) => root + scale[((i % scale.length) + scale.length) % scale.length] + 12 * (Math.floor(i / scale.length) + octave);
  // Chord progression over four bars, as scale degrees.
  const prog = rng.pick([[0, 3, 4, 0], [0, 5, 3, 4], [0, 2, 3, 4], [0, 0, 5, 4], [0, 4, 5, 3]]);
  const bass: Note[] = [];
  for (let bar = 0; bar < 4; bar++) {
    const rootDeg = prog[bar];
    const rhythm = rng.pick([[0, 4], [0, 3, 4, 6], [0, 2, 4, 6], [0, 6]]);
    for (const r of rhythm) bass.push({ step: bar * 8 + r, midi: degree(rootDeg, -1), len: rhythm.length > 2 ? 1.5 : 3, vel: 0.9 });
    if (rng.chance(0.5)) bass.push({ step: bar * 8 + 7, midi: degree(rootDeg + 4, -1), len: 1, vel: 0.7 });
  }
  const melody: Note[] = [];
  let cur = rng.int(4, 9);
  let step = 0;
  while (step < steps) {
    const len = rng.weighted([1, 2, 3, 4], [4, 4, 1, 2]);
    if (rng.chance(d.density)) {
      cur += rng.weighted([-3, -2, -1, 0, 1, 2, 3], [1, 3, 5, 2, 5, 3, 1]);
      cur = Math.max(2, Math.min(12, cur));
      melody.push({ step, midi: degree(cur, 1), len: len * 0.9, vel: 0.5 + rng.next() * 0.3 });
    }
    step += len;
  }
  const arp: Note[] = [];
  if (d.arp) {
    for (let bar = 0; bar < 4; bar++) {
      const chord = [prog[bar], prog[bar] + 2, prog[bar] + 4, prog[bar] + 7];
      for (let i = 0; i < 8; i++) if (i % 2 === 0 || mood === "boss") arp.push({ step: bar * 8 + i, midi: degree(chord[i % 4], 1), len: 0.5, vel: 0.25 });
    }
  }
  const kick: number[] = [], snare: number[] = [], hat: number[] = [];
  if (d.drums) {
    for (let i = 0; i < steps; i++) {
      if (i % 8 === 0 || (i % 8 === 5 && rng.chance(0.4)) || (mood === "boss" && i % 8 === 3)) kick.push(i);
      if (i % 8 === 4) snare.push(i);
      if (i % 2 === 0 || mood === "battle" || mood === "boss") hat.push(i);
    }
  }
  return { bass, melody, arp, kick, snare, hat, steps, bpm: d.bpm, wave: d.wave };
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private pattern: Pattern | null = null;
  private mood: Mood = "none";
  private seed = 0;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private pending: { mood: Mood; seed: number } | null = null;
  private lastBlip = 0;
  muted = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init(): void {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
    } catch { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(c.destination);
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    this.sfxGain = c.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (this.pending) { const p = this.pending; this.pending = null; this.music(p.mood, p.seed); }
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  // ---------- Effects ----------

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide?: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, filterHz: number, at = 0, q = 1): void {
    if (!this.ctx || !this.sfxGain || !this.noise) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filterHz;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfx(name: Sfx): void {
    if (!this.ctx) return;
    switch (name) {
      case "blip": {
        const now = this.ctx.currentTime;
        if (now - this.lastBlip < 0.03) return;
        this.lastBlip = now;
        this.tone(900 + Math.random() * 200, 0.03, "square", 0.08);
        break;
      }
      case "cursor": this.tone(700, 0.04, "square", 0.12); break;
      case "confirm": this.tone(523, 0.06, "square", 0.14); this.tone(784, 0.08, "square", 0.14, 0.06); break;
      case "cancel": this.tone(392, 0.06, "square", 0.12); this.tone(262, 0.09, "square", 0.1, 0.06); break;
      case "hit": this.burst(0.09, 0.5, 900, 0, 0.7); this.tone(160, 0.12, "square", 0.25, 0, 60); break;
      case "crit": this.burst(0.14, 0.7, 1400, 0, 0.6); this.tone(220, 0.16, "sawtooth", 0.3, 0, 50); this.tone(1760, 0.12, "square", 0.12, 0.03, 880); break;
      case "heal": this.tone(523, 0.1, "sine", 0.18); this.tone(659, 0.1, "sine", 0.18, 0.08); this.tone(784, 0.16, "sine", 0.18, 0.16); break;
      case "miss": this.tone(600, 0.12, "triangle", 0.14, 0, 200); break;
      case "status": this.tone(440, 0.07, "square", 0.12, 0, 520); this.tone(520, 0.07, "square", 0.12, 0.07, 440); break;
      case "death": this.tone(300, 0.35, "sawtooth", 0.22, 0, 40); this.burst(0.3, 0.3, 400, 0.05, 0.5); break;
      case "link": this.tone(392, 0.2, "square", 0.16); this.tone(494, 0.2, "square", 0.16); this.tone(587, 0.2, "square", 0.16); this.tone(784, 0.3, "square", 0.14, 0.1); this.burst(0.2, 0.4, 2000, 0, 0.5); break;
      case "levelup": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "square", 0.16, i * 0.07)); break;
      case "open": this.tone(200, 0.25, "triangle", 0.14, 0, 800); break;
      case "coin": this.tone(1568, 0.05, "sine", 0.16); this.tone(2093, 0.12, "sine", 0.14, 0.05); break;
      case "rewind": this.tone(1200, 0.4, "sawtooth", 0.14, 0, 120); this.burst(0.4, 0.2, 600, 0, 0.3); break;
      case "fuse": this.tone(220, 0.3, "sine", 0.18, 0, 880); this.tone(330, 0.3, "sine", 0.18, 0.05, 1320); break;
      case "chest": this.tone(659, 0.08, "square", 0.14); this.tone(880, 0.08, "square", 0.14, 0.08); this.tone(1319, 0.14, "square", 0.14, 0.16); break;
      case "step": this.burst(0.03, 0.12, 300, 0, 0.8); break;
      case "encounter": this.tone(880, 0.08, "square", 0.18, 0, 220); this.tone(880, 0.08, "square", 0.18, 0.1, 220); this.burst(0.25, 0.3, 500, 0, 0.4); break;
      case "flee": this.burst(0.08, 0.2, 800, 0); this.burst(0.08, 0.2, 800, 0.1); this.burst(0.08, 0.2, 800, 0.2); break;
      case "word": this.tone(330, 0.12, "triangle", 0.16); this.tone(415, 0.12, "triangle", 0.16, 0.1); this.tone(494, 0.2, "triangle", 0.16, 0.2); break;
    }
  }

  // ---------- Music ----------

  music(mood: Mood, seed = 0): void {
    if (!this.ctx) { this.pending = { mood, seed }; return; }
    if (mood === this.mood && seed === this.seed) return;
    this.stop();
    this.mood = mood;
    this.seed = seed;
    if (mood === "none") return;
    this.pattern = buildPattern(mood, seed);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  /** Plays a short one shot pattern then returns to the previous mood. */
  jingle(mood: Mood, seed: number, seconds: number, then: Mood, thenSeed: number): void {
    this.music(mood, seed);
    window.setTimeout(() => { if (this.mood === mood) this.music(then, thenSeed); }, seconds * 1000);
  }

  stop(): void {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    this.pattern = null;
    this.mood = "none";
  }

  get currentMood(): Mood {
    return this.mood;
  }

  private schedule(): void {
    if (!this.ctx || !this.pattern || !this.musicGain) return;
    const p = this.pattern;
    const stepDur = 60 / p.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const s = this.step % p.steps;
      const t = this.nextTime;
      for (const n of p.bass) if (n.step === s) this.note(n.midi, t, n.len * stepDur, "triangle", 0.5 * n.vel);
      for (const n of p.melody) if (n.step === s) this.note(n.midi, t, n.len * stepDur, p.wave, 0.22 * n.vel);
      for (const n of p.arp) if (n.step === s) this.note(n.midi, t, n.len * stepDur, "square", 0.12 * n.vel);
      if (p.kick.includes(s)) this.drum(t, "kick");
      if (p.snare.includes(s)) this.drum(t, "snare");
      if (p.hat.includes(s)) this.drum(t, "hat");
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private note(midi: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = midiHz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicGain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drum(t: number, kind: "kick" | "snare" | "hat"): void {
    const c = this.ctx!;
    if (kind === "kick") {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(this.musicGain!);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    if (!this.noise) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = kind === "snare" ? "bandpass" : "highpass";
    f.frequency.value = kind === "snare" ? 1800 : 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(kind === "snare" ? 0.25 : 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "snare" ? 0.12 : 0.04));
    src.connect(f).connect(g).connect(this.musicGain!);
    src.start(t);
    src.stop(t + 0.15);
  }
}

export const audio = new AudioSystem();
