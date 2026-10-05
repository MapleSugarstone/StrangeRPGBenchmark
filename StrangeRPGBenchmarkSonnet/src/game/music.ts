import { Rng } from '../core/rng';

const SCALES: Record<string, number[]> = {
  minorPent: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
};
const CHAPTER_SCALE = ['major', 'dorian', 'minorPent', 'harmonicMinor', 'dorian', 'phrygian', 'phrygian', 'harmonicMinor', 'lydian', 'wholeTone', 'minorPent', 'major'];

export interface Track {
  id: string;
  bpm: number;
  root: number;
  scale: number[];
  prog: number[];
  lead: OscillatorType;
  bass: OscillatorType;
  seed: number;
  density: number;
  volume: number;
}

export function trackFor(kind: 'title' | 'world' | 'battle' | 'boss', chapter: number): Track {
  const scaleName = kind === 'title' ? 'lydian' : CHAPTER_SCALE[chapter - 1] ?? 'dorian';
  const r = new Rng(chapter * 977 + (kind === 'world' ? 1 : kind === 'battle' ? 2 : kind === 'boss' ? 3 : 4));
  const prog = [0, r.pick([3, 5, 2]), r.pick([4, 5, 1]), r.pick([2, 6, 3])];
  const fast = kind === 'battle' || kind === 'boss';
  return {
    id: `${kind}:${chapter}`,
    bpm: kind === 'title' ? 66 : fast ? (kind === 'boss' ? 156 : 138) : 72 + (chapter % 4) * 6,
    root: 45 + ((chapter * 5) % 12),
    scale: SCALES[scaleName],
    prog,
    lead: fast ? 'square' : chapter % 2 ? 'triangle' : 'square',
    bass: fast ? 'sawtooth' : 'triangle',
    seed: r.int(1e9),
    density: fast ? 0.85 : 0.55,
    volume: fast ? 0.016 : 0.02,
  };
}

/** Procedural chiptune loops. Every chapter has its own scale, progression and tempo. */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: Track | null = null;
  private step = 0;
  private nextTime = 0;
  private pattern: number[] = [];
  constructor(private getCtx: () => AudioContext | null, private isMuted: () => boolean) {}

  set(track: Track | null) {
    if (this.track?.id === track?.id) return;
    this.track = track;
    this.step = 0;
    this.nextTime = 0;
    if (track) {
      const r = new Rng(track.seed);
      this.pattern = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 || r.chance(track.density) ? r.int(6) : -1));
    }
    if (!this.timer && typeof setInterval !== 'undefined') {
      this.timer = setInterval(() => this.pump(), 80);
      (this.timer as unknown as { unref?: () => void }).unref?.();
    }
  }

  private note(ctx: AudioContext, midi: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private degree(tr: Track, d: number): number {
    const n = tr.scale.length;
    const oct = Math.floor(d / n);
    return tr.root + tr.scale[((d % n) + n) % n] + 12 * oct;
  }

  private pump() {
    const tr = this.track;
    const ctx = this.getCtx();
    if (!tr || !ctx || this.isMuted() || ctx.state !== 'running') return;
    const stepDur = 60 / tr.bpm / 4;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 16) % tr.prog.length;
      const s = this.step % 16;
      const chordRoot = tr.prog[bar];
      if (s % 4 === 0) this.note(ctx, this.degree(tr, chordRoot) - 12, this.nextTime, stepDur * 3.6, tr.bass, tr.volume * 1.6);
      const p = this.pattern[s];
      if (p >= 0) {
        const tone = [0, 2, 4, 7, 9, 11][p];
        this.note(ctx, this.degree(tr, chordRoot + tone), this.nextTime, stepDur * 1.6, tr.lead, tr.volume);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}
