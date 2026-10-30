// Music engine: a lookahead scheduler over the section generators in the track files, voiced as a small synthesizer
// band in a long room. Ported from the user's ElipsusVenum and Gnomon engines. Fathom adds reflections (every lead
// note is followed by a darker, rippling copy an octave down, the way neon lies in a canal), layers that switch on the
// party's and the enemy's turns, a mode shift at low HP, district colors for battles, and melts that never pass
// through silence.
// Safe to import in Node: nothing touches Web Audio until core.ts reports a live context.
import { audioCtx, isMuted, musicOut, onAudioReady } from './core';
import { MODE, Rng, darker, hash, inKey, LEAD_VOICES, vary, wrong } from './score-core';
import type { Ctx, Ev, Flag, Key, Region, Section, TrackDef, Voice } from './score-core';
import { TRACKS } from './tracks';

/** A scheduled note: the score event plus absolute start and length in seconds, and its section's key. */
export interface Note extends Ev { at: number; dur: number; kr: number; km: readonly number[] }

export interface Rendered {
  name: string;
  start: number;
  secs: number;
  bpm: number;
  bar: number;
  key: Key;
  reflect: number;
  tag?: string;
  end?: boolean;
  notes: Note[];
}

/** Voices that play one note at a time. The leads glide between notes that touch. */
export const MONO: ReadonlySet<Voice> = new Set<Voice>(['lead', 'cold', 'sq', 'bass', 'sub']);
/** The most notes each polyphonic voice holds at once, which also bounds the cost of a section. */
export const POLY: Record<Voice, number> = {
  lead: 1, cold: 1, sq: 1, wet: 4, bell: 4, glass: 4, rev: 4, arp: 3, pluck: 4, blip: 3,
  bass: 1, sub: 1, drone: 3, pad: 6, brass: 6, choir: 5, nz: 6,
};
/** A reflection's level against its note. */
export const WET_GAIN = 0.3;

function bandsOverlap(a: Ev, b: Ev): boolean {
  return Math.max(a.lay ?? 0, b.lay ?? 0) < Math.min(a.top ?? 2, b.top ?? 2) && (a.when ?? '') === (b.when ?? '');
}

/** Enforces the band's limits: one note at a time on each mono voice, a cap on the others, nothing past the end. */
export function normalize(sec: Section): Ev[] {
  const ev = sec.ev
    .filter((e) => e.t >= -1e-6 && e.t < sec.beats - 1e-6 && e.d > 0 && e.g > 0 && Number.isFinite(e.n) && Number.isFinite(e.t))
    .map((e) => ({ ...e, t: Math.max(0, e.t) }))
    .sort((a, b) => a.t - b.t);
  return capVoices(ev, sec.beats);
}

function capVoices(ev: Ev[], beats: number): Ev[] {
  const byVoice = new Map<Voice, Ev[]>();
  for (const e of ev) { const l = byVoice.get(e.v); if (l) l.push(e); else byVoice.set(e.v, [e]); }
  const dead = new Set<Ev>();
  for (const [v, list] of byVoice) {
    if (MONO.has(v)) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (dead.has(a)) continue;
        a.d = Math.min(a.d, beats - a.t);
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (dead.has(b)) continue;
          if (b.t >= a.t + a.d) break;
          if (!bandsOverlap(a, b)) continue;
          // Two notes on the same instant: the louder one wins.
          if (b.t - a.t < 0.03) { if (b.g > a.g) { dead.add(a); break; } dead.add(b); continue; }
          a.d = Math.min(a.d, b.t - a.t - 0.01);
          break;
        }
      }
    } else {
      const ringing: Ev[] = [];
      for (const e of list) {
        for (let k = ringing.length - 1; k >= 0; k--) if (ringing[k].t + ringing[k].d <= e.t) ringing.splice(k, 1);
        if (ringing.length >= POLY[v]) {
          ringing.sort((x, y) => x.t + x.d - (y.t + y.d));
          const old = ringing.shift()!;
          old.d = Math.max(0.05, e.t - old.t);
        }
        ringing.push(e);
      }
    }
  }
  return ev.filter((e) => !dead.has(e) && e.d > 0.005);
}

/**
 * Writes the reflections: a quiet, darker, rippling copy of every lead note, `len` beats after it and an octave down
 * when the note sits high enough. Wet districts reflect strongly and dry ones (the Brim, the clinic) not at all.
 */
export function castReflections(ev: Ev[], len: number): Ev[] {
  const out: Ev[] = [];
  if (!(len > 0)) return out;
  for (const e of ev) {
    if (!LEAD_VOICES.has(e.v) || e.d < 0.2 || e.nor || e.rf) continue;
    const n = e.n >= 60 ? e.n - 12 : e.n;
    out.push({
      t: e.t + len, d: Math.max(0.2, e.d * 0.9), v: 'wet', n, g: e.g * WET_GAIN * (e.d < 0.5 ? 0.7 : 1), rf: 1, src: e.v,
      when: e.when, lay: e.lay, top: e.top, x: e.x, pan: e.v === 'cold' ? -0.35 : 0.35,
    });
  }
  return out;
}

export interface Env {
  int(): number;
  region(): Region;
  phase(): number;
  kills(): number;
  low(): boolean;
  ret(): Key | null;
  stir(): number;
}

export interface SeqState {
  cur: string | null;
  pass: number;
  visits: Record<string, number>;
  st: Record<string, number>;
  mem: Record<string, number[]>;
}

/** Walks one track's section graph and renders each section to timed notes. */
export class Seq {
  readonly def: TrackDef;
  readonly id: string;
  private cur: string | null;
  private pass = 0;
  private visits: Record<string, number> = {};
  private st: Record<string, number> = {};
  private mem: Record<string, number[]> = {};
  private seed: number;
  private env: Env;
  private forced: string | null = null;

  constructor(id: string, seed: number, env: Env, saved?: SeqState) {
    this.id = id;
    this.seed = seed;
    this.env = env;
    this.def = TRACKS[id];
    this.cur = this.def.start;
    if (saved) {
      this.cur = saved.cur && this.def.secs[saved.cur] ? saved.cur : this.def.start;
      this.pass = saved.pass;
      this.visits = { ...saved.visits };
      this.st = { ...saved.st };
      this.mem = Object.fromEntries(Object.entries(saved.mem).map(([k, v]) => [k, [...v]]));
    }
  }

  force(name: string): void {
    if (this.def.secs[name]) this.forced = name;
  }

  save(): SeqState {
    return { cur: this.cur, pass: this.pass, visits: { ...this.visits }, st: { ...this.st }, mem: { ...this.mem } };
  }

  next(start: number): Rendered | null {
    const name = this.forced ?? this.cur;
    this.forced = null;
    const def = this.def;
    if (name === null || !def.secs[name]) return null;
    const r = new Rng(this.seed ^ hash(this.id) ^ Math.imul(this.pass + 1, 0x9e3779b1));
    const env = this.env;
    const c: Ctx = {
      r, pass: this.pass, visit: this.visits[name] ?? 0, int: env.int(), bpm: def.bpm, st: this.st, mem: this.mem,
      region: env.region(), phase: env.phase(), kills: env.kills(), low: env.low(), ret: env.ret(),
    };
    let sec = def.secs[name](c);
    const calm = 1 - Math.max(0, Math.min(1, env.stir()));
    if (!sec.still) {
      sec = vary(sec, r, (def.vary ?? 0.5) * (0.5 + 0.5 * calm));
      if (r.chance((def.wrong ?? 0.04) * calm)) sec = wrong(sec, r);
    }
    const K = sec.key ?? def.key;
    const spb = 60 / Math.max(20, sec.bpm || def.bpm);
    const ev = normalize(sec);
    const len = sec.reflect ?? def.reflect;
    const wet = capVoices(castReflections(ev, len).sort((a, b) => a.t - b.t), sec.beats + 4);
    const notes: Note[] = [];
    for (const e of ev) notes.push({ ...e, at: start + e.t * spb, dur: e.d * spb, kr: K.root, km: K.mode });
    for (const e of wet) notes.push({ ...e, at: start + e.t * spb, dur: e.d * spb, kr: K.root, km: K.mode });
    notes.sort((a, b) => a.at - b.at);
    this.visits[name] = c.visit + 1;
    this.pass++;
    let nxt: string | null = null;
    if (def.next) nxt = def.next(name, c);
    else { const opts = def.graph?.[name]; if (opts && opts.length) nxt = r.weighted(opts); }
    this.cur = nxt !== null && def.secs[nxt] ? nxt : null;
    return { name, start, secs: Math.max(0.05, sec.beats * spb), bpm: sec.bpm || def.bpm, bar: sec.bar, key: K, reflect: len, tag: sec.tag, end: sec.end, notes };
  }
}

export interface RenderOpts {
  seed?: number;
  intensity?: (t: number) => number;
  region?: Region;
  phase?: (t: number) => number;
  kills?: (t: number) => number;
  low?: (t: number) => boolean;
  ret?: Key | null;
}

/** Renders a track without audio, for tests and offline checks. */
export function renderTrack(id: string, seconds: number, opts: RenderOpts = {}): Rendered[] {
  let t = 0;
  const env: Env = {
    int: () => opts.intensity?.(t) ?? 0,
    region: () => opts.region ?? 'deeps',
    phase: () => opts.phase?.(t) ?? 0,
    kills: () => opts.kills?.(t) ?? 0,
    low: () => opts.low?.(t) ?? false,
    ret: () => opts.ret ?? null,
    stir: () => 0,
  };
  const seq = new Seq(id, opts.seed ?? 1, env);
  const out: Rendered[] = [];
  while (t < seconds) {
    const s = seq.next(t);
    if (!s) break;
    out.push(s);
    t += s.secs;
  }
  return out;
}

// ---------------------------------------------------------------- melting

/** Seconds a melt takes from one track to the next. Battles cut in fast, places melt slowly. */
export function meltSeconds(from: TrackDef | null, to: TrackDef | null): number {
  if (!to) return 3.2;
  if (to.melt !== undefined) return to.melt;
  if (to.kind === 'battle') return 0.9;
  if (to.kind === 'sting') return 0.5;
  if (from && from.kind === 'sting') return 2.0;
  if (from && from.kind === 'battle') return 1.8;
  return 2.6;
}

/**
 * The note that bridges a melt: a soft held tone that both keys share, so the music never thins to nothing while one
 * track fades and the next one arrives.
 */
export function bridgeNote(from: Key | null, toKey: Key, seconds: number): Ev {
  const cand = [toKey(0), toKey(4), toKey(2), toKey(3), toKey(5), toKey(1), toKey(6)];
  let pc = cand[0];
  if (from) { const shared = cand.find((p) => inKey(from, p)); if (shared !== undefined) pc = shared; }
  let n = pc;
  while (n < 38) n += 12;
  while (n >= 50) n -= 12;
  return { t: 0, d: 0, v: 'drone', n, g: 0.46, a: Math.min(0.5, seconds * 0.25), x: 1, nor: 1 };
}

/** Equal-power fade curve: `x` runs 0..1 across the melt. */
export function meltCurve(x: number, dir: 'in' | 'out'): number {
  const c = Math.max(0, Math.min(1, x));
  return dir === 'out' ? Math.cos((c * Math.PI) / 2) : Math.sin((c * Math.PI) / 2);
}

// ---------------------------------------------------------------- the band

const VOICES: Voice[] = ['lead', 'cold', 'sq', 'wet', 'bell', 'glass', 'rev', 'arp', 'pluck', 'blip', 'bass', 'sub', 'drone', 'pad', 'brass', 'choir', 'nz'];
/**
 * Channel level per voice, so that a voice at g 0.5 sits near the others. Gnomon measured these with offline renders.
 * The louder result comes from the bus level and the compressor, not from these.
 */
export const BASE: Record<Voice, number> = {
  lead: 0.18, cold: 0.143, sq: 0.11, wet: 0.2, bell: 0.168, glass: 0.138, rev: 0.16, arp: 0.357, pluck: 0.3, blip: 0.35,
  bass: 0.327, sub: 0.27, drone: 0.366, pad: 0.146, brass: 0.15, choir: 0.07, nz: 0.7,
};
const PAN: Record<Voice, number> = {
  lead: -0.08, cold: 0.12, sq: -0.04, wet: 0, bell: 0.18, glass: -0.2, rev: 0.1, arp: 0.25, pluck: -0.28, blip: 0.3,
  bass: 0, sub: 0, drone: 0, pad: 0, brass: 0, choir: 0, nz: 0,
};
const VERB: Record<Voice, number> = {
  lead: 0.35, cold: 0.4, sq: 0.2, wet: 0.9, bell: 0.9, glass: 1, rev: 1, arp: 0.35, pluck: 0.4, blip: 0.5,
  bass: 0.05, sub: 0, drone: 0.55, pad: 0.55, brass: 0.4, choir: 0.75, nz: 0.18,
};
const ECHO: Record<Voice, number> = {
  lead: 0.28, cold: 0.32, sq: 0.1, wet: 0.2, bell: 0.45, glass: 0.55, rev: 0.5, arp: 0.6, pluck: 0.35, blip: 0.5,
  bass: 0, sub: 0, drone: 0, pad: 0, brass: 0.1, choir: 0, nz: 0.05,
};
/** Voices whose channel runs through a soft saturator. */
const DRIVEN: ReadonlySet<Voice> = new Set<Voice>(['lead', 'cold', 'bass']);

interface Kit {
  pulse25: PeriodicWave;
  arpWave: PeriodicWave;
  bassWave: PeriodicWave;
  white: AudioBuffer;
  curve: Float32Array<ArrayBuffer>;
  wob: GainNode;
  /** Dry music, ducked under speech. */
  bus: GainNode;
  post: AudioNode;
  verbIn: GainNode;
  echoIn: GainNode;
  echoL: DelayNode;
  echoR: DelayNode;
  talkDuck: GainNode;
}

interface Mono {
  end: number;
  eg: GainNode;
  srcs: OscillatorNode[];
  freqs: AudioParam[];
  mults: number[];
  filters: BiquadFilterNode[];
  vib: GainNode;
  cold: boolean;
  dest: AudioNode;
}

interface SecInfo { start: number; secs: number; bpm: number; bar: number; key: Key; reflect: number; end?: boolean }

interface Player {
  id: string;
  seq: Seq;
  def: TrackDef;
  out: GainNode;
  melt: BiquadFilterNode;
  verbSend: GainNode;
  echoSend: GainNode;
  sag: ConstantSourceNode | null;
  chans: Record<Voice, AudioNode>;
  layers: Map<string, GainNode>;
  banks: Map<string, [AudioNode, AudioNode]>;
  nodes: AudioNode[];
  queue: Note[];
  qi: number;
  secEnd: number;
  ended: boolean;
  stopAt: number | null;
  live: Set<AudioScheduledSourceNode>;
  mono: Partial<Record<Voice, Mono>>;
  secs: SecInfo[];
  lowFrom: number | null;
  lowTo: number | null;
  passedEnd: boolean;
  startedAt: number;
}

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const modn = (a: number, n: number) => ((a % n) + n) % n;

/** How far ahead the scheduler generates sections, so reflections that spill past a section's end still play. */
const GEN_AHEAD = 2.5;

let kit: Kit | null = null;
let player: Player | null = null;
const dying: Player[] = [];
let desired: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let sessionSeed = 1;
/** Notes that failed to schedule. The engine never throws, so this is the only trace of a bad note. */
let noteErrors = 0;
const saved = new Map<string, { s: SeqState; at: number }>();

const state = {
  /** An intensity floor a tool or a debug hook can set. The combat model adds to it. */
  manual: 0,
  phase: 0,
  turn: 'party' as 'party' | 'enemy',
  rounds: 0,
  kills: 0,
  low: false,
  /** Party turns left before low HP clears without a new low_hp. */
  lowLeft: 0,
  fieldRegion: 'deeps' as Region,
  battleRegion: 'deeps' as Region,
  returnTo: null as string | null,
  pending: undefined as string | null | undefined,
  stir: 0,
  stirAt: 0,
  talkUntil: 0,
  ducked: false,
  lastKillFig: -1,
};

function inBattle(): boolean {
  return !!player && player.def.kind === 'battle';
}

function nowTime(): number {
  return audioCtx()?.currentTime ?? 0;
}

function stirNow(): number {
  const dt = Math.max(0, nowTime() - state.stirAt);
  return state.stir * Math.pow(0.5, dt / 4);
}

/** Records that something changed in the music. A lot at once tones down odd notes and wrong events. */
function stir(add: number): void {
  state.stir = Math.max(0, Math.min(1, stirNow() + add));
  state.stirAt = nowTime();
}

/**
 * The battle's intensity, built from what has happened: it starts low, climbs a little each round and with each kill,
 * leans up on the enemy's turn, jumps at low HP, and never falls below the boss phase's floor.
 */
export function combatIntensity(o: { boss: boolean; rounds: number; kills: number; enemy: boolean; low: boolean; phase: number }): number {
  const base = o.boss ? 0.32 : 0.18;
  const x = base + Math.min(0.2, o.rounds * 0.025) + Math.min(0.2, o.kills * 0.05) + (o.enemy ? 0.07 : 0) + (o.low ? 0.25 : 0);
  const floor = [0, 0.4, 0.65, 0.85][Math.min(3, o.phase)] ?? 0.85;
  return Math.max(0, Math.min(1, Math.max(x, floor)));
}

function effectiveIntensity(): number {
  if (!desired || TRACKS[desired]?.kind !== 'battle') return state.manual;
  const fight = combatIntensity({ boss: desired === 'boss', rounds: state.rounds, kills: state.kills, enemy: state.turn === 'enemy', low: state.low, phase: state.phase });
  return Math.max(state.manual, fight);
}

function flagOn(f: Flag): boolean {
  if (f === 'party') return !inBattle() || state.turn === 'party';
  if (f === 'enemy') return inBattle() && state.turn === 'enemy';
  return state.low;
}

/** A wave mixed from a pulse of `duty` at `pulse`, a saw at `saw`, and a sine at `sine`. */
function mixWave(ac: BaseAudioContext, duty: number, pulseAmt = 1, saw = 0, sine = 0): PeriodicWave {
  const H = 40, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) {
    re[h] = (pulseAmt * Math.sin(Math.PI * h * duty)) / h;
    im[h] = (saw * (h % 2 ? 1 : -1) * 2) / (Math.PI * h);
  }
  im[1] += sine;
  return ac.createPeriodicWave(re, im);
}

/** A long room: decorrelated noise in each ear, decaying over rt60 and losing its highs as it fades. */
function roomImpulse(ac: BaseAudioContext, rt60 = 4.0, predelay = 0.025): AudioBuffer {
  const sr = ac.sampleRate, n = Math.round(sr * (rt60 + predelay)), pre = Math.round(sr * predelay);
  const buf = ac.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    let seed = ch ? 0x2f6b1c3d : 0x51ed270b;
    for (let i = pre; i < n; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = seed / 2147483648 - 1;
      const t = (i - pre) / sr;
      const k = 0.85 * Math.exp(-t / 1.1) + 0.06;
      y += k * (x - y);
      d[i] = y * Math.exp((-6.91 * t) / rt60) * (t < 0.01 ? t / 0.01 : 1);
    }
  }
  return buf;
}

function buildKit(ac: BaseAudioContext, master: AudioNode): Kit {
  const sr = ac.sampleRate;
  const white = ac.createBuffer(1, sr * 2, sr);
  const wd = white.getChannelData(0);
  let seed = 0x1234567;
  for (let i = 0; i < wd.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; wd[i] = seed / 2147483648 - 1; }
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
  const wob = ac.createGain();
  wob.gain.value = 3;
  for (const [f, g] of [[0.19, 1], [0.061, 0.7]] as const) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.value = f; og.gain.value = g;
    o.connect(og); og.connect(wob); o.start();
  }
  // The compressor evens the band out and the makeup gain lifts it, so the music sits louder without clipping.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 2.5; comp.knee.value = 8; comp.attack.value = 0.02; comp.release.value = 0.3;
  const makeup = ac.createGain();
  makeup.gain.value = 1.3;
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -3; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.002; lim.release.value = 0.12;
  comp.connect(makeup); makeup.connect(lim); lim.connect(master);
  const talkDuck = ac.createGain();
  const bus = ac.createGain();
  bus.connect(talkDuck); talkDuck.connect(comp);
  const verbIn = ac.createGain();
  const conv = ac.createConvolver();
  conv.buffer = roomImpulse(ac);
  const verbHp = ac.createBiquadFilter();
  verbHp.type = 'highpass'; verbHp.frequency.value = 160;
  const verbOut = ac.createGain();
  verbOut.gain.value = 0.5;
  verbIn.connect(verbHp); verbHp.connect(conv); conv.connect(verbOut); verbOut.connect(talkDuck);
  const echoIn = ac.createGain();
  const echoL = ac.createDelay(2), echoR = ac.createDelay(2);
  echoL.delayTime.value = 0.45; echoR.delayTime.value = 0.45;
  const eLp = ac.createBiquadFilter(), eHp = ac.createBiquadFilter();
  eLp.type = 'lowpass'; eLp.frequency.value = 3200; eHp.type = 'highpass'; eHp.frequency.value = 220;
  const fbL = ac.createGain(), fbR = ac.createGain();
  fbL.gain.value = 0.36; fbR.gain.value = 0.36;
  const merge = ac.createChannelMerger(2);
  const echoOut = ac.createGain();
  echoOut.gain.value = 0.4;
  echoIn.connect(eHp); eHp.connect(eLp); eLp.connect(echoL);
  echoL.connect(fbL); fbL.connect(echoR); echoR.connect(fbR); fbR.connect(echoL);
  echoL.connect(merge, 0, 0); echoR.connect(merge, 0, 1);
  merge.connect(echoOut); echoOut.connect(talkDuck);
  const echoVerb = ac.createGain();
  echoVerb.gain.value = 0.3;
  echoOut.connect(echoVerb); echoVerb.connect(verbIn);
  return { pulse25: mixWave(ac, 0.25), arpWave: mixWave(ac, 0.3, 1, 0.5), bassWave: mixWave(ac, 0.5, 0.4, 0.6, 0.3), white, curve, wob, bus, post: comp, verbIn, echoIn, echoL, echoR, talkDuck };
}

function lowpass(ac: BaseAudioContext, f: number, q = 0.7): BiquadFilterNode {
  const b = ac.createBiquadFilter();
  b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q;
  try { b.frequency.automationRate = 'k-rate'; } catch { /* older engines keep a-rate */ }
  return b;
}

function makePlayer(ac: BaseAudioContext, k: Kit, id: string, dest: AudioNode, seed?: number, savedState?: SeqState): Player {
  const seq = new Seq(id, seed ?? (sessionSeed = (Math.imul(sessionSeed, 1103515245) + 12345 + Date.now()) >>> 0), {
    int: effectiveIntensity,
    region: () => state.battleRegion,
    phase: () => state.phase,
    kills: () => state.kills,
    low: () => state.low,
    ret: () => (state.returnTo && TRACKS[state.returnTo] ? TRACKS[state.returnTo].key : null),
    stir: stirNow,
  }, savedState);
  const def = seq.def;
  const out = ac.createGain();
  out.gain.value = def.level ?? 1;
  const melt = lowpass(ac, 18000, 0.5);
  out.connect(melt); melt.connect(dest);
  const verbSend = ac.createGain(), echoSend = ac.createGain();
  verbSend.connect(k.verbIn); echoSend.connect(k.echoIn);
  let sag: ConstantSourceNode | null = null;
  try { sag = ac.createConstantSource(); sag.offset.value = 0; sag.start(); } catch { sag = null; }
  const nodes: AudioNode[] = [out, melt, verbSend, echoSend];
  if (sag) nodes.push(sag);
  const chans = {} as Record<Voice, AudioNode>;
  for (const v of VOICES) {
    const g = ac.createGain();
    g.gain.value = BASE[v] * (def.mix?.[v] ?? 1);
    let tail: AudioNode = g;
    if (v === 'pad') { const lp = lowpass(ac, 1700, 0.7); tail.connect(lp); tail = lp; nodes.push(lp); }
    if (DRIVEN.has(v)) { const sh = ac.createWaveShaper(); sh.curve = k.curve; tail.connect(sh); tail = sh; nodes.push(sh); }
    const p = ac.createStereoPanner();
    p.pan.value = PAN[v];
    tail.connect(p); tail = p; nodes.push(p);
    tail.connect(out);
    const vs = ac.createGain();
    vs.gain.value = (def.verb ?? 1) * VERB[v];
    tail.connect(vs); vs.connect(verbSend); nodes.push(vs);
    if (ECHO[v] > 0) {
      const es = ac.createGain();
      es.gain.value = (def.echo ?? 0.5) * ECHO[v];
      tail.connect(es); es.connect(echoSend); nodes.push(es);
    }
    nodes.push(g);
    chans[v] = g;
  }
  const pl: Player = {
    id, seq, def, out, melt, verbSend, echoSend, sag, chans, layers: new Map(), banks: new Map(), nodes,
    queue: [], qi: 0, secEnd: ac.currentTime + 0.06, ended: false, stopAt: null, live: new Set(), mono: {}, secs: [],
    lowFrom: null, lowTo: null, passedEnd: false, startedAt: ac.currentTime,
  };
  pl.banks.set('', [formantBank(ac, VOWELS.oo, chans.choir, nodes), formantBank(ac, VOWELS.ah, chans.choir, nodes)]);
  return pl;
}

/** The node a note feeds: its voice's channel, or a layer that opens and closes with a flag. */
function dest(ac: BaseAudioContext, p: Player, v: Voice, when?: Flag): AudioNode {
  if (!when) return p.chans[v];
  const keyName = `${when}:${v}`;
  let g = p.layers.get(keyName);
  if (!g) {
    g = ac.createGain();
    g.gain.value = flagOn(when) ? 1 : 0;
    g.connect(p.chans[v]);
    p.layers.set(keyName, g);
    p.nodes.push(g);
  }
  return g;
}

function choirBanks(ac: BaseAudioContext, p: Player, when?: Flag): [AudioNode, AudioNode] {
  const keyName = when ?? '';
  let b = p.banks.get(keyName);
  if (!b) {
    const into = dest(ac, p, 'choir', when);
    b = [formantBank(ac, VOWELS.oo, into, p.nodes), formantBank(ac, VOWELS.ah, into, p.nodes)];
    p.banks.set(keyName, b);
  }
  return b;
}

function track(p: Player, src: AudioScheduledSourceNode, extra: AudioNode[], params: AudioParam[], k: Kit): void {
  p.live.add(src);
  src.onended = () => {
    p.live.delete(src);
    try { src.disconnect(); } catch { /* ignore */ }
    for (const n of extra) { try { n.disconnect(); } catch { /* ignore */ } }
    for (const a of params) {
      try { k.wob.disconnect(a); } catch { /* ignore */ }
      try { p.sag?.disconnect(a); } catch { /* ignore */ }
    }
  };
}

function osc(ac: BaseAudioContext, k: Kit, p: Player, kind: OscillatorType | PeriodicWave, f: number, at: number, det = 0, drift = true): OscillatorNode {
  const o = ac.createOscillator();
  if (typeof kind === 'string') o.type = kind as OscillatorType; else o.setPeriodicWave(kind);
  o.frequency.setValueAtTime(f, at);
  o.detune.value = det;
  if (drift) {
    k.wob.connect(o.detune);
    if (p.sag) p.sag.connect(o.detune);
  }
  return o;
}

function noise(ac: BaseAudioContext, k: Kit): AudioBufferSourceNode {
  const s = ac.createBufferSource();
  s.buffer = k.white;
  s.loop = true;
  return s;
}

function bendTo(prm: AudioParam, f: number, at: number, dur: number, semis: number): void {
  prm.setValueAtTime(f, at + dur * 0.5);
  prm.exponentialRampToValueAtTime(f * Math.pow(2, semis / 12), at + dur);
}

/** A held envelope: linear attack to the peak, hold, then an exponential release with time constant `rel`. */
function hold(prm: AudioParam, at: number, dur: number, peak: number, a: number, rel: number): void {
  prm.setValueAtTime(0, at);
  prm.linearRampToValueAtTime(peak, at + Math.min(a, Math.max(0.002, dur)));
  prm.setTargetAtTime(0, at + dur, rel);
}

function leadNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const cold = n.v === 'cold';
  const square = n.v === 'sq';
  const at = n.at, dur = Math.max(0.03, n.dur), g = Math.min(1, n.g);
  const f = mtof(n.n);
  const rel = square ? 0.03 : cold ? 0.05 : 0.08;
  const vibDepth = square ? 0 : cold ? 9 : 16, vibDelay = cold ? 0 : 0.33;
  const base = (n.cut ?? (square ? 2400 : cold ? 2600 : 1700)) * (square ? 1 : Math.sqrt(f / 440));
  const env = square ? 0 : cold ? 0.6 : 1.2;
  const m = p.mono[n.v];
  if (!square && m && m.dest === ch && at - m.end < 0.03 && at > m.end - 0.5) {
    // Legato: glide every oscillator to the new pitch, keep the level up, and push the release out.
    m.freqs.forEach((fp, i) => { fp.cancelScheduledValues(at); fp.setTargetAtTime(f * m.mults[i], at, 0.03); });
    if (n.bend) m.freqs.forEach((fp, i) => fp.setTargetAtTime(f * m.mults[i] * Math.pow(2, n.bend! / 12), at + dur * 0.5, dur * 0.18));
    m.eg.gain.cancelScheduledValues(at);
    m.eg.gain.setTargetAtTime(g, at, 0.006);
    m.eg.gain.setTargetAtTime(0, at + dur, rel);
    for (const fl of m.filters) {
      fl.frequency.cancelScheduledValues(at);
      fl.frequency.setTargetAtTime(base * (1 + env * 0.5), at, 0.01);
      fl.frequency.setTargetAtTime(base, at + 0.02, 0.25);
    }
    m.vib.gain.cancelScheduledValues(at);
    m.vib.gain.setValueAtTime(cold ? vibDepth : 0, at);
    if (!cold) { m.vib.gain.setValueAtTime(0, at + vibDelay); m.vib.gain.linearRampToValueAtTime(vibDepth, at + vibDelay + 0.5); }
    for (const s of m.srcs) s.stop(at + dur + rel * 7);
    m.end = at + dur;
    return;
  }
  const tune = n.det ?? 0;
  const srcs: OscillatorNode[] = [];
  const mults: number[] = [];
  const mix = ac.createGain();
  const add = (o: OscillatorNode, mult: number, level: number) => {
    const lg = ac.createGain();
    lg.gain.value = level;
    o.connect(lg); lg.connect(mix);
    srcs.push(o); mults.push(mult);
  };
  if (square) {
    add(osc(ac, k, p, 'square', f, at, tune, false), 1, 0.9);
  } else if (cold) {
    add(osc(ac, k, p, k.pulse25, f, at, tune), 1, 0.8);
    add(osc(ac, k, p, 'sawtooth', f, at, tune + 3), 1, 0.36);
  } else {
    add(osc(ac, k, p, 'sawtooth', f, at, tune - 7), 1, 0.5);
    add(osc(ac, k, p, 'sawtooth', f, at, tune + 7), 1, 0.5);
    add(osc(ac, k, p, 'square', f / 2, at, tune), 0.5, 0.3);
  }
  if (n.bend) for (const [i, s] of srcs.entries()) bendTo(s.frequency, f * mults[i], at, dur, n.bend);
  const vibO = ac.createOscillator(), vib = ac.createGain();
  vibO.frequency.value = cold ? 7.5 : 5.2;
  vib.gain.setValueAtTime(cold ? vibDepth : 0, at);
  if (!cold && !square) { vib.gain.setValueAtTime(0, at + vibDelay); vib.gain.linearRampToValueAtTime(vibDepth, at + vibDelay + 0.5); }
  vibO.connect(vib);
  for (const s of srcs) vib.connect(s.detune);
  const f1 = lowpass(ac, base, square ? 0.5 : 0.9), f2 = lowpass(ac, base, 0.6);
  for (const fl of [f1, f2]) {
    fl.frequency.setValueAtTime(base * (1 + env), at);
    fl.frequency.setTargetAtTime(base, at + 0.012, 0.25);
  }
  const eg = ac.createGain();
  hold(eg.gain, at, dur, g, square ? 0.004 : cold ? 0.008 : 0.03, rel);
  mix.connect(f1); f1.connect(f2); f2.connect(eg); eg.connect(ch);
  const end = at + dur + rel * 7;
  for (const s of srcs) { s.start(at); s.stop(end); }
  vibO.start(at); vibO.stop(end);
  srcs.forEach((s, i) => track(p, s, i === 0 ? [mix, f1, f2, eg, vib] : [], [s.detune], k));
  track(p, vibO, [], [], k);
  if (!square) p.mono[n.v] = { end: at + dur, eg, srcs: [...srcs, vibO], freqs: srcs.map((s) => s.frequency), mults, filters: [f1, f2], vib, cold, dest: ch };
}

/** A reflection: the lead's own oscillators, darker and softer, with a slow ripple of pitch and level. */
function wetNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const at = n.at, dur = Math.max(0.06, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  const srcs: OscillatorNode[] = [];
  if (n.src === 'cold') { srcs.push(osc(ac, k, p, k.pulse25, f, at, -6)); srcs.push(osc(ac, k, p, 'triangle', f, at, 6)); }
  else if (n.src === 'sq') srcs.push(osc(ac, k, p, 'square', f, at, 0, false));
  else { srcs.push(osc(ac, k, p, 'sawtooth', f, at, -9)); srcs.push(osc(ac, k, p, 'sawtooth', f, at, 9)); }
  const mix = ac.createGain();
  mix.gain.value = 1 / srcs.length;
  for (const s of srcs) s.connect(mix);
  // The ripple: a slow pitch wobble and a faster wobble of level, like light on moving water.
  const rip = ac.createOscillator(), ripG = ac.createGain();
  rip.frequency.value = 3.1 + ((n.n * 7) % 5) / 10;
  ripG.gain.value = 22;
  rip.connect(ripG);
  for (const s of srcs) ripG.connect(s.detune);
  const trem = ac.createOscillator(), tremG = ac.createGain(), amp = ac.createGain();
  trem.frequency.value = 5.3;
  tremG.gain.value = 0.35;
  amp.gain.value = 0.65;
  trem.connect(tremG); tremG.connect(amp.gain);
  const lp = lowpass(ac, Math.min(1300, 420 * Math.sqrt(f / 220)), 0.9);
  const eg = ac.createGain(), pan = ac.createStereoPanner();
  pan.pan.value = n.pan ?? 0;
  hold(eg.gain, at, dur, g * 1.4, 0.04, 0.12);
  mix.connect(lp); lp.connect(amp); amp.connect(eg); eg.connect(pan); pan.connect(ch);
  const end = at + dur + 0.7;
  srcs.forEach((s, i) => { s.start(at); s.stop(end); track(p, s, i === 0 ? [mix, lp, amp, eg, pan, ripG, tremG] : [], [s.detune], k); });
  for (const o of [rip, trem]) { o.start(at); o.stop(end); track(p, o, [], [], k); }
}

function bellNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const glass = n.v === 'glass';
  const at = n.at, g = Math.min(1, n.g), f = mtof(n.n);
  const ratio = n.ratio ?? (glass ? 3.5 : 2), index = glass ? 2.2 : 1.6, decay = Math.min(glass ? 2.6 : 2, Math.max(0.4, n.dur * 1.5));
  const car = osc(ac, k, p, 'sine', f, at, n.det ?? 0), md = osc(ac, k, p, 'sine', f * ratio, at, n.det ?? 0);
  if (n.bend) { bendTo(car.frequency, f, at, n.dur, n.bend); bendTo(md.frequency, f * ratio, at, n.dur, n.bend); }
  const mg = ac.createGain(), eg = ac.createGain(), pan = ac.createStereoPanner();
  const dev = index * f * ratio;
  mg.gain.setValueAtTime(dev, at);
  mg.gain.setTargetAtTime(dev * 0.2, at, 0.25);
  mg.gain.setTargetAtTime(0, at + 0.8, decay);
  eg.gain.setValueAtTime(0, at);
  eg.gain.linearRampToValueAtTime(g, at + 0.002);
  eg.gain.setTargetAtTime(0, at + 0.002, decay);
  pan.pan.value = n.pan ?? 0;
  md.connect(mg); mg.connect(car.frequency); car.connect(eg); eg.connect(pan); pan.connect(ch);
  const end = at + decay * 6;
  car.start(at); md.start(at); car.stop(end); md.stop(end);
  track(p, car, [eg, mg, pan], [car.detune], k);
  track(p, md, [], [md.detune], k);
}

/** A bell played backward: brightness and level rise along an exponential curve and stop at the note's end. */
function revNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const at = n.at, dur = Math.max(0.15, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  const ratio = n.ratio ?? 2;
  const car = osc(ac, k, p, 'sine', f, at, n.det ?? 0), car2 = osc(ac, k, p, 'sine', f, at, (n.det ?? 0) + 8);
  const md = osc(ac, k, p, 'sine', f * ratio, at, n.det ?? 0);
  const mg = ac.createGain(), eg = ac.createGain(), g2 = ac.createGain(), pan = ac.createStereoPanner();
  g2.gain.value = 0.45;
  mg.gain.setValueAtTime(f * ratio * 0.12, at);
  mg.gain.exponentialRampToValueAtTime(f * ratio * 2.1, at + dur);
  eg.gain.setValueAtTime(0.0001, at);
  eg.gain.exponentialRampToValueAtTime(g, at + dur);
  eg.gain.setTargetAtTime(0, at + dur, 0.014);
  pan.pan.value = n.pan ?? 0;
  md.connect(mg); mg.connect(car.frequency); mg.connect(car2.frequency);
  car.connect(eg); car2.connect(g2); g2.connect(eg); eg.connect(pan); pan.connect(ch);
  // Breath under it, rising with the swell.
  const s = noise(ac, k), bp = ac.createBiquadFilter(), ng = ac.createGain();
  bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2); bp.Q.value = 6;
  ng.gain.setValueAtTime(0.0001, at);
  ng.gain.exponentialRampToValueAtTime(g * 0.5, at + dur);
  ng.gain.setTargetAtTime(0, at + dur, 0.01);
  s.connect(bp); bp.connect(ng); ng.connect(pan);
  const end = at + dur + 0.15;
  for (const o of [car, car2, md]) { o.start(at); o.stop(end); }
  s.start(at, (at * 7.3) % 1.5); s.stop(end);
  track(p, car, [eg, mg, g2, pan], [car.detune], k);
  track(p, car2, [], [car2.detune], k);
  track(p, md, [], [md.detune], k);
  track(p, s, [bp, ng], [], k);
}

function arpNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode, blip: boolean): void {
  const at = n.at, dur = Math.max(0.02, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  const eg = ac.createGain(), pan = ac.createStereoPanner();
  pan.pan.value = n.pan ?? 0;
  const dec = blip ? 0.07 : 0.18;
  eg.gain.setValueAtTime(0, at);
  eg.gain.linearRampToValueAtTime(g, at + (blip ? 0.001 : 0.002));
  eg.gain.setTargetAtTime(0, at + 0.002, dec);
  eg.gain.setTargetAtTime(0, at + dur, 0.03);
  const end = at + Math.min(dur + 0.12, dec * 6);
  if (blip) {
    const o = osc(ac, k, p, 'triangle', f, at, n.det ?? 0);
    o.connect(eg); eg.connect(pan); pan.connect(ch);
    o.start(at); o.stop(end);
    track(p, o, [eg, pan], [o.detune], k);
    return;
  }
  const a = osc(ac, k, p, k.arpWave, f, at, n.det ?? 0);
  const cut = n.cut ?? 1500;
  const lp = lowpass(ac, cut * 3, 4);
  lp.frequency.setTargetAtTime(cut, at, 0.05);
  a.connect(lp); lp.connect(eg); eg.connect(pan); pan.connect(ch);
  a.start(at); a.stop(end);
  track(p, a, [lp, eg, pan], [a.detune], k);
}

/** A dusty plucked string: a bright saw whose filter closes fast, an octave triangle, and a scrape of noise. */
function pluckNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const at = n.at, dur = Math.max(0.05, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  const a = osc(ac, k, p, 'sawtooth', f, at, n.det ?? 0), b2 = osc(ac, k, p, 'triangle', f * 2, at, (n.det ?? 0) + 4);
  const b2g = ac.createGain();
  b2g.gain.value = 0.35;
  const top = Math.min(9000, f * 14);
  const lp = lowpass(ac, top, 1.4);
  lp.frequency.setValueAtTime(top, at);
  lp.frequency.exponentialRampToValueAtTime(Math.max(180, f * 1.4), at + 0.3);
  const eg = ac.createGain(), pan = ac.createStereoPanner();
  pan.pan.value = n.pan ?? 0;
  eg.gain.setValueAtTime(0, at);
  eg.gain.linearRampToValueAtTime(g, at + 0.003);
  eg.gain.setTargetAtTime(0, at + 0.003, 0.3);
  eg.gain.setTargetAtTime(0, at + dur, 0.06);
  a.connect(lp); b2.connect(b2g); b2g.connect(lp); lp.connect(eg); eg.connect(pan); pan.connect(ch);
  const s = noise(ac, k), bp = ac.createBiquadFilter(), ng = ac.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
  ng.gain.setValueAtTime(g * 0.45, at);
  ng.gain.setTargetAtTime(0, at, 0.006);
  s.connect(bp); bp.connect(ng); ng.connect(eg);
  const end = at + Math.min(dur + 0.4, 2.2);
  a.start(at); b2.start(at); a.stop(end); b2.stop(end);
  s.start(at, (at * 5.1) % 1.5); s.stop(at + 0.06);
  track(p, a, [lp, eg, pan, b2g], [a.detune], k);
  track(p, b2, [], [b2.detune], k);
  track(p, s, [bp, ng], [], k);
}

function bassNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const at = n.at, dur = Math.max(0.03, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  if (n.v === 'sub') {
    const o = osc(ac, k, p, 'sine', f, at), o2 = osc(ac, k, p, 'sine', f * 2, at), g2 = ac.createGain(), eg = ac.createGain();
    g2.gain.value = 0.12;
    hold(eg.gain, at, dur, g, n.a ?? 0.08, 0.08);
    o.connect(eg); o2.connect(g2); g2.connect(eg); eg.connect(ch);
    if (n.bend) { bendTo(o.frequency, f, at, dur, n.bend); bendTo(o2.frequency, f * 2, at, dur, n.bend); }
    const end = at + dur + 0.6;
    o.start(at); o2.start(at); o.stop(end); o2.stop(end);
    track(p, o, [eg, g2], [o.detune], k);
    track(p, o2, [], [o2.detune], k);
    return;
  }
  const a = osc(ac, k, p, k.bassWave, f, at), eg = ac.createGain();
  const cut = n.cut ?? 320;
  const lp = lowpass(ac, cut + 1600, 1.6);
  lp.frequency.setTargetAtTime(cut, at, 0.09);
  eg.gain.setValueAtTime(0, at);
  eg.gain.linearRampToValueAtTime(g, at + 0.004);
  eg.gain.setTargetAtTime(g * 0.65, at + 0.004, 0.12);
  eg.gain.setTargetAtTime(0, at + dur, 0.02);
  if (n.bend) bendTo(a.frequency, f, at, dur, n.bend);
  a.connect(lp); lp.connect(eg); eg.connect(ch);
  const end = at + dur + 0.15;
  a.start(at); a.stop(end);
  track(p, a, [lp, eg], [a.detune], k);
}

/** Additive drone: eight slightly stretched partials, each swelling on its own slow cycle, odd ones left. */
function droneNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const at = n.at, dur = Math.max(0.5, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  const eg = ac.createGain(), left = ac.createStereoPanner(), right = ac.createStereoPanner();
  left.pan.value = -0.55; right.pan.value = 0.55;
  left.connect(eg); right.connect(eg); eg.connect(ch);
  hold(eg.gain, at, dur, g, n.a ?? 3, 0.8);
  const end = at + dur + 5;
  const parts: { fk: number; amp: number }[] = [];
  for (let kk = 1; kk <= 8; kk++) {
    const fk = f * kk * (1 + 0.00035 * kk * kk);
    if (fk > 6000) break;
    parts.push({ fk, amp: (kk === 1 ? 0.5 : 1) / Math.pow(kk, 1.05) });
  }
  const norm = 1 / parts.reduce((s, x) => s + x.amp, 0);
  let seed = (n.n * 7919 + Math.round(at * 1000)) >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  parts.forEach((x, i) => {
    const o = osc(ac, k, p, 'sine', x.fk, at);
    const pg = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    const amp = x.amp * norm * 2;
    pg.gain.value = amp * 0.5;
    lfo.frequency.value = 0.03 + rnd() * 0.17;
    lg.gain.value = amp * 0.5;
    lfo.connect(lg); lg.connect(pg.gain);
    o.connect(pg); pg.connect(i % 2 ? right : left);
    o.start(at); lfo.start(at); o.stop(end); lfo.stop(end);
    track(p, o, i === 0 ? [pg, lg, eg, left, right] : [pg, lg], [o.detune], k);
    track(p, lfo, [], [], k);
  });
}

/** Strings and brass: two detuned saws a note. Brass keeps a filter per note, since it opens with each attack. */
function padNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const isBrass = n.v === 'brass';
  const at = n.at, dur = Math.max(0.1, n.dur), g = Math.min(1, n.g), f = mtof(n.n);
  const eg = ac.createGain(), pan = ac.createStereoPanner();
  pan.pan.value = n.pan ?? Math.max(-0.55, Math.min(0.55, (n.n - 64) / 22));
  let head: AudioNode = eg;
  const extra: AudioNode[] = [eg, pan];
  if (isBrass) {
    const cut = n.cut ?? 2200;
    const lp = lowpass(ac, cut, 0.9);
    lp.frequency.setValueAtTime(cut * 0.4, at);
    lp.frequency.linearRampToValueAtTime(cut * 1.35, at + Math.min(0.35, dur * 0.6));
    lp.frequency.setTargetAtTime(cut, at + Math.min(0.35, dur * 0.6), 0.7);
    lp.connect(eg);
    head = lp;
    extra.push(lp);
  }
  hold(eg.gain, at, dur, g, n.a ?? (isBrass ? 0.06 : 0.5), isBrass ? 0.1 : 0.16);
  eg.connect(pan); pan.connect(ch);
  const stop = at + dur + (isBrass ? 0.7 : 1);
  [-10, 10].forEach((c, i) => {
    const o = osc(ac, k, p, 'sawtooth', f, at, c + (n.det ?? 0) + ((n.n * 37 + i * 11) % 5) - 2);
    if (n.bend) bendTo(o.frequency, f, at, dur, n.bend);
    o.connect(head);
    o.start(at); o.stop(stop);
    track(p, o, i === 0 ? extra : [], [o.detune], k);
  });
}

const VOWELS = { oo: [[325, 1, 5], [800, 0.3, 7], [2400, 0.08, 9]], ah: [[730, 1, 5], [1090, 0.5, 7], [2440, 0.2, 9]] } as const;

function formantBank(ac: BaseAudioContext, vowel: readonly (readonly number[])[], out: AudioNode, nodes: AudioNode[]): GainNode {
  const input = ac.createGain();
  for (const [fc, gain, q] of vowel) {
    const bp = ac.createBiquadFilter(), fg = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q;
    fg.gain.value = gain * 4;
    input.connect(bp); bp.connect(fg); fg.connect(out);
    nodes.push(bp, fg);
  }
  nodes.push(input);
  return input;
}

/** Choir: paired saws with a vibrato that waits and then grows, blended between the oo and ah formant banks. */
function choirNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note): void {
  const at = n.at, dur = Math.max(0.2, n.dur), g = Math.min(1, n.g), f = mtof(n.n), ah = Math.max(0, Math.min(1, n.ah ?? 0));
  const [oo, ahBank] = choirBanks(ac, p, n.when);
  const eg = ac.createGain(), pan = ac.createStereoPanner(), toOo = ac.createGain(), toAh = ac.createGain();
  pan.pan.value = n.pan ?? Math.max(-0.6, Math.min(0.6, (n.n - 62) / 18));
  toOo.gain.value = 1 - ah;
  toAh.gain.value = ah;
  const a = osc(ac, k, p, 'sawtooth', f, at, -7), b = osc(ac, k, p, 'sawtooth', f, at, 7);
  const vibO = ac.createOscillator(), vib = ac.createGain();
  vibO.frequency.value = 4.8 + ((n.n * 13) % 9) / 10;
  vib.gain.setValueAtTime(0, at);
  vib.gain.setValueAtTime(0, at + 0.4);
  vib.gain.linearRampToValueAtTime(14, at + 1.6);
  vibO.connect(vib); vib.connect(a.detune); vib.connect(b.detune);
  a.connect(eg); b.connect(eg);
  hold(eg.gain, at, dur, g, n.a ?? 1.2, 0.3);
  eg.connect(pan); pan.connect(toOo); pan.connect(toAh);
  if (ah < 1) toOo.connect(oo);
  if (ah > 0) toAh.connect(ahBank);
  const stop = at + dur + 1.6;
  for (const s of [a, b, vibO]) { s.start(at); s.stop(stop); }
  track(p, a, [eg, pan, vib, toOo, toAh], [a.detune], k);
  track(p, b, [], [b.detune], k);
  track(p, vibO, [], [], k);
}

function hitNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const at = n.at, dur = Math.max(0.02, n.dur), g = Math.min(1, n.g), kind = n.nz ?? 'tick';
  const eg = ac.createGain();
  const panned = n.pan !== undefined || kind === 'scan';
  const pan = panned ? ac.createStereoPanner() : null;
  if (pan) { pan.pan.value = n.pan ?? 0; eg.connect(pan); pan.connect(ch); } else eg.connect(ch);
  const drop = (from: number, to: number, fall: number, decay: number, level = 1, type: OscillatorType = 'sine', t0 = at) => {
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    o.frequency.exponentialRampToValueAtTime(to, t0 + fall);
    og.gain.setValueAtTime(g * level, t0);
    og.gain.setTargetAtTime(0, t0 + 0.005, decay);
    o.connect(og); og.connect(eg);
    o.start(t0); o.stop(t0 + decay * 6);
    track(p, o, [og], [], k);
  };
  const burst = (type: BiquadFilterType, fc: number, q: number, decay: number, level: number, len = decay * 6, t0 = at) => {
    const s = noise(ac, k), fl = ac.createBiquadFilter(), ng = ac.createGain();
    fl.type = type; fl.frequency.value = fc; fl.Q.value = q;
    ng.gain.setValueAtTime(g * level, t0);
    ng.gain.setTargetAtTime(0, t0 + 0.002, decay);
    s.connect(fl); fl.connect(ng); ng.connect(eg);
    s.start(t0, (t0 * 7.3) % 1.5); s.stop(t0 + len);
    track(p, s, [fl, ng], [], k);
  };
  eg.gain.value = 1;
  switch (kind) {
    case 'kick': drop(150, 42, 0.12, 0.09, 1.2); return;
    case 'snare': burst('bandpass', 1800, 0.7, 0.05, 1.2); drop(220, 160, 0.05, 0.04, 0.5); return;
    case 'taiko': drop(96, 52, 0.25, 0.16, 1.3); burst('lowpass', 420, 0.5, 0.08, 0.7); return;
    case 'tick': burst('highpass', 5200, 0.5, 0.004, 0.9, 0.04); return;
    case 'boom': drop(84, 30, 0.8, 0.35, 1.3); burst('bandpass', 1100, 1.2, 0.03, 0.5); return;
    case 'hat': burst('highpass', 7200, 0.7, 0.022, 0.75, 0.1); return;
    case 'click': burst('bandpass', 3200, 4, 0.003, 1.4, 0.03); drop(2100, 1800, 0.01, 0.004, 0.3); return;
    case 'wood': drop(1150, 960, 0.012, 0.035, 0.9, 'triangle'); burst('bandpass', 2600, 2, 0.004, 0.5, 0.03); return;
    case 'clap': for (let i = 0; i < 3; i++) burst('bandpass', 1500, 1, 0.008, 0.9, 0.04, at + i * 0.011); burst('bandpass', 1300, 0.8, 0.05, 0.6, 0.25, at + 0.033); return;
    case 'crash': burst('highpass', 4200, 0.4, 0.55, 0.7, 3.2); return;
    case 'drip': {
      // A drop into a puddle: a sine that leaps up as the bubble closes, and a tiny tick of the surface.
      const f = mtof(n.n === 60 ? 88 : n.n);
      drop(f * 0.6, f * 1.7, 0.035, 0.035, 0.9);
      burst('bandpass', Math.min(9000, f * 2.5), 3, 0.004, 0.3, 0.02);
      return;
    }
    case 'stomp': {
      // A Bailer's foot coming down in deep water: a huge low thump, then the water closing over it.
      drop(58, 27, 0.45, 0.42, 1.4);
      drop(116, 50, 0.2, 0.12, 0.4, 'triangle');
      const s = noise(ac, k), fl = lowpass(ac, 1100, 0.8), ng = ac.createGain();
      fl.frequency.setValueAtTime(1100, at + 0.06);
      fl.frequency.exponentialRampToValueAtTime(220, at + 0.9);
      ng.gain.setValueAtTime(0, at + 0.05);
      ng.gain.linearRampToValueAtTime(g * 0.7, at + 0.1);
      ng.gain.setTargetAtTime(0, at + 0.12, 0.28);
      s.connect(fl); fl.connect(ng); ng.connect(eg);
      s.start(at, (at * 2.9) % 1.5); s.stop(at + 2.2);
      track(p, s, [fl, ng], [], k);
      return;
    }
    case 'clank': {
      const car = ac.createOscillator(), md = ac.createOscillator(), mg = ac.createGain(), og = ac.createGain();
      car.frequency.value = 430; md.frequency.value = 430 * 1.414;
      mg.gain.setValueAtTime(1600, at); mg.gain.setTargetAtTime(0, at, 0.08);
      og.gain.setValueAtTime(g * 0.6, at); og.gain.setTargetAtTime(0, at + 0.003, 0.09);
      md.connect(mg); mg.connect(car.frequency); car.connect(og); og.connect(eg);
      car.start(at); md.start(at); car.stop(at + 0.7); md.stop(at + 0.7);
      track(p, car, [og, mg], [], k);
      track(p, md, [], [], k);
      burst('highpass', 3500, 0.7, 0.01, 0.5, 0.06);
      return;
    }
    case 'shaker': {
      const s = noise(ac, k), fl = ac.createBiquadFilter(), ng = ac.createGain();
      fl.type = 'bandpass'; fl.frequency.value = 5600; fl.Q.value = 1.4;
      ng.gain.setValueAtTime(0, at);
      ng.gain.linearRampToValueAtTime(g * 0.65, at + 0.014);
      ng.gain.setTargetAtTime(0, at + 0.016, 0.028);
      s.connect(fl); fl.connect(ng); ng.connect(eg);
      s.start(at, (at * 3.7) % 1.5); s.stop(at + 0.2);
      track(p, s, [fl, ng], [], k);
      return;
    }
    case 'roll': {
      const steps = Math.max(2, Math.floor(dur / 0.045));
      for (let i = 0; i < steps; i++) burst('bandpass', 1900, 0.8, 0.02, 0.35 + (0.6 * i) / steps, 0.08, at + i * 0.045);
      return;
    }
    case 'hum': {
      // An electric hum at the note's pitch: two saws beating against each other through a narrow band.
      const f = mtof(n.n);
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), bp = ac.createBiquadFilter(), hg = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = f; o2.frequency.value = f * 1.006;
      bp.type = 'bandpass'; bp.frequency.value = f * 3; bp.Q.value = 1.6;
      hold(hg.gain, at, dur, g * 0.5, n.a ?? 1, 0.4);
      o1.connect(bp); o2.connect(bp); bp.connect(hg); hg.connect(eg);
      const end = at + dur + 2.5;
      o1.start(at); o2.start(at); o1.stop(end); o2.stop(end);
      track(p, o1, [bp, hg], [], k);
      track(p, o2, [], [], k);
      return;
    }
    default: break;
  }
  // Long noises: an envelope over the whole note.
  const s = noise(ac, k), fl = ac.createBiquadFilter(), ng = ac.createGain();
  if (kind === 'hiss') { fl.type = 'bandpass'; fl.frequency.value = 3000; fl.Q.value = 0.3; hold(ng.gain, at, dur, g * 0.5, n.a ?? 2, 0.6); }
  else if (kind === 'swell') {
    fl.type = 'bandpass'; fl.Q.value = 2;
    fl.frequency.setValueAtTime(300, at);
    fl.frequency.exponentialRampToValueAtTime(3600, at + dur);
    ng.gain.setValueAtTime(0, at);
    ng.gain.linearRampToValueAtTime(g, at + dur);
    ng.gain.setTargetAtTime(0, at + dur, 0.03);
  } else if (kind === 'slosh') {
    // Water lapping at a hull or a piling: a low band that rises and falls with the wave.
    fl.type = 'lowpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(320, at);
    fl.frequency.linearRampToValueAtTime(1300, at + dur * 0.4);
    fl.frequency.linearRampToValueAtTime(280, at + dur);
    ng.gain.setValueAtTime(0, at);
    ng.gain.linearRampToValueAtTime(g * 0.8, at + dur * 0.35);
    ng.gain.linearRampToValueAtTime(0, at + dur);
  } else if (kind === 'breath') {
    // A woken thing breathing: an inhale that brightens, a held top, and an exhale that darkens.
    fl.type = 'bandpass'; fl.Q.value = 1.6;
    fl.frequency.setValueAtTime(520, at);
    fl.frequency.linearRampToValueAtTime(1500, at + dur * 0.45);
    fl.frequency.linearRampToValueAtTime(420, at + dur);
    ng.gain.setValueAtTime(0, at);
    ng.gain.linearRampToValueAtTime(g * 0.7, at + dur * 0.45);
    ng.gain.linearRampToValueAtTime(g * 0.5, at + dur * 0.55);
    ng.gain.linearRampToValueAtTime(0, at + dur);
  } else if (kind === 'scan') {
    // A sweep passing: a narrow band rising and falling while it crosses the stereo field.
    fl.type = 'bandpass'; fl.Q.value = 14;
    fl.frequency.setValueAtTime(mtof(n.n), at);
    fl.frequency.exponentialRampToValueAtTime(mtof(n.n + 19), at + dur * 0.5);
    fl.frequency.exponentialRampToValueAtTime(mtof(n.n), at + dur);
    ng.gain.setValueAtTime(0, at);
    ng.gain.linearRampToValueAtTime(g * 3, at + dur * 0.5);
    ng.gain.linearRampToValueAtTime(0, at + dur);
    pan!.pan.setValueAtTime(-0.8, at);
    pan!.pan.linearRampToValueAtTime(0.8, at + dur);
  } else {
    // Corrupted data: a square wave hopping between pitches, gated with short ramps so it never clicks.
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'square';
    let seed = Math.round(at * 997) >>> 0;
    for (let t = 0; t < dur; t += 0.035) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      o.frequency.setValueAtTime(400 + (seed % 2600), at + t);
      og.gain.setTargetAtTime((seed >> 9) % 3 ? g * 0.35 : 0, at + t, 0.002);
    }
    og.gain.setTargetAtTime(0, at + dur, 0.003);
    o.connect(og); og.connect(eg);
    o.start(at); o.stop(at + dur + 0.05);
    track(p, o, [og], [], k);
    return;
  }
  s.connect(fl); fl.connect(ng); ng.connect(eg);
  s.start(at, (at * 7.3) % 1.5); s.stop(at + dur + 3);
  track(p, s, [fl, ng], [], k);
}

function voiceNote(ac: BaseAudioContext, k: Kit, p: Player, n: Note): void {
  if (n.v === 'choir') return choirNote(ac, k, p, n);
  const ch = dest(ac, p, n.v, n.when);
  switch (n.v) {
    case 'lead': case 'cold': case 'sq': return leadNote(ac, k, p, n, ch);
    case 'wet': return wetNote(ac, k, p, n, ch);
    case 'bell': case 'glass': return bellNote(ac, k, p, n, ch);
    case 'rev': return revNote(ac, k, p, n, ch);
    case 'arp': return arpNote(ac, k, p, n, ch, false);
    case 'blip': return arpNote(ac, k, p, n, ch, true);
    case 'pluck': return pluckNote(ac, k, p, n, ch);
    case 'bass': case 'sub': return bassNote(ac, k, p, n, ch);
    case 'drone': return droneNote(ac, k, p, n, ch);
    case 'pad': case 'brass': return padNote(ac, k, p, n, ch);
    case 'nz': return hitNote(ac, k, p, n, ch);
  }
}

// ---------------------------------------------------------------- low HP

/** Re-spells a note in the darker mode, degree for degree, so every voice moves together and the harmony holds. */
export function darkenPitch(n: number, root: number, mode: readonly number[], target: readonly number[]): number {
  if (target === mode || target.length !== mode.length) return n;
  const pc = modn(n - root, 12);
  const i = mode.indexOf(pc);
  if (i < 0) return n;
  return n + (target[i] - mode[i]);
}

function lowTarget(p: Player, n: Note): readonly number[] {
  const own = p.def.low;
  const home = p.def.key.mode;
  if (own && n.km.length === home.length && n.km.every((x, i) => x === home[i])) return own;
  return darker(n.km);
}

function maybeDarken(p: Player, n: Note): Note {
  if (p.lowFrom === null || n.at < p.lowFrom || (p.lowTo !== null && n.at >= p.lowTo)) return n;
  if (n.v === 'nz' || n.x) return n;
  const shifted = darkenPitch(n.n, n.kr, n.km, lowTarget(p, n));
  return shifted === n.n ? n : { ...n, n: shifted };
}

// ---------------------------------------------------------------- scheduler

function lookahead(): number {
  try { return typeof document !== 'undefined' && document.hidden ? 1.5 : 0.12; } catch { return 0.12; }
}

function fill(ac: BaseAudioContext, k: Kit, p: Player, now: number, ahead: number): void {
  const horizon = now + ahead;
  if (!p.ended && p.secEnd < now) { p.queue = []; p.qi = 0; p.secEnd = now + 0.05; }
  let guard = 0;
  let added = false;
  while (!p.ended && p.secEnd < horizon + GEN_AHEAD && guard++ < 8) {
    if (p.stopAt !== null && p.secEnd >= p.stopAt) break;
    const s = p.seq.next(p.secEnd);
    if (!s) { p.ended = true; break; }
    p.secs.push({ start: s.start, secs: s.secs, bpm: s.bpm, bar: s.bar, key: s.key, reflect: s.reflect, end: s.end });
    if (p.secs.length > 10) p.secs.shift();
    for (const n of s.notes) p.queue.push(n);
    p.secEnd += s.secs;
    added = true;
  }
  if (added) { p.queue = p.queue.slice(p.qi).sort((a, b) => a.at - b.at); p.qi = 0; }
  for (const s of p.secs) if (s.end && now >= s.start + s.secs) p.passedEnd = true;
  const muted = isMuted();
  const level = effectiveIntensity();
  const odd = stirNow() > 0.45;
  while (p.qi < p.queue.length && p.queue[p.qi].at < horizon) {
    const n = p.queue[p.qi++];
    if (n.at < now - 0.01) continue;
    if (p.stopAt !== null && n.at >= p.stopAt) continue;
    if ((n.lay ?? 0) > level || (n.top !== undefined && level >= n.top)) continue;
    if (n.odd && odd) continue;
    if (muted) continue;
    try { voiceNote(ac, k, p, maybeDarken(p, n)); } catch { noteErrors++; }
  }
  if (p.qi > 256) { p.queue = p.queue.slice(p.qi); p.qi = 0; }
}

function dispose(p: Player): void {
  for (const s of p.live) { try { s.stop(); } catch { /* ignore */ } }
  p.live.clear();
  try { p.sag?.stop(); } catch { /* ignore */ }
  for (const n of p.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
}

/** Holds a parameter at its current value from `at`, so a new ramp can start from wherever it was. */
function holdAt(prm: AudioParam, at: number): number {
  const v = prm.value;
  try {
    const p2 = prm as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
    if (typeof p2.cancelAndHoldAtTime === 'function') p2.cancelAndHoldAtTime(at);
    else { prm.cancelScheduledValues(at); prm.setValueAtTime(v, at); }
  } catch { try { prm.cancelScheduledValues(at); prm.setValueAtTime(v, at); } catch { /* ignore */ } }
  return v;
}

/** An equal-power ramp built from short straight segments, which every engine schedules without complaint. */
function powerRamp(prm: AudioParam, at: number, dur: number, from: number, to: number, dir: 'in' | 'out'): void {
  const N = 10;
  for (let i = 1; i <= N; i++) {
    const x = i / N;
    const v = dir === 'out' ? from * meltCurve(x, 'out') : to * meltCurve(x, 'in');
    prm.linearRampToValueAtTime(Math.max(0, v), at + dur * x);
  }
}

/**
 * Melts a track away: the dry sound fades on an equal-power curve while its filter closes and its pitch sags a
 * little, and its room sends fade more slowly, so the last of it is only the room.
 */
function meltOut(ac: BaseAudioContext, p: Player, seconds: number): void {
  const now = ac.currentTime, f = Math.max(0.05, seconds);
  try {
    const v = holdAt(p.out.gain, now);
    powerRamp(p.out.gain, now, f, v, 0, 'out');
    holdAt(p.melt.frequency, now);
    p.melt.frequency.exponentialRampToValueAtTime(650, now + f);
    for (const s of [p.verbSend.gain, p.echoSend.gain]) {
      const w = holdAt(s, now);
      s.linearRampToValueAtTime(w * 0.85, now + f * 0.6);
      s.linearRampToValueAtTime(0, now + f * 1.5);
    }
    if (p.sag) { holdAt(p.sag.offset, now); p.sag.offset.linearRampToValueAtTime(-20, now + f); }
  } catch { /* ignore */ }
  p.stopAt = now + f * 1.5;
  if (p.def.kind === 'place' || p.def.kind === 'scene') saved.set(p.id, { s: p.seq.save(), at: now });
  dying.push(p);
}

/** Sets the echo to a dotted eighth at the track's tempo and the drift to the track's depth. */
function tune(ac: BaseAudioContext, k: Kit, def: TrackDef): void {
  const now = ac.currentTime;
  const t = Math.min(1.5, 0.75 * (60 / def.bpm));
  k.echoL.delayTime.setTargetAtTime(t, now, 0.9);
  k.echoR.delayTime.setTargetAtTime(t, now, 0.9);
  k.wob.gain.setTargetAtTime(def.wobble ?? 3, now, 0.5);
}

function currentSection(p: Player, now: number): SecInfo | null {
  let best: SecInfo | null = null;
  for (const s of p.secs) if (s.start <= now + 1e-3) best = s;
  return best ?? p.secs[0] ?? null;
}

function start(id: string): void {
  const ac = audioCtx();
  if (!ac || !kit) return;
  try {
    const old = player;
    const def = TRACKS[id];
    let secs = meltSeconds(old?.def ?? null, def);
    // A battle that replaces another battle a moment after it started (combatEvent('start') then playMusic('boss'))
    // swaps over quickly, so the first one is barely heard.
    if (old && old.def.kind === 'battle' && def.kind === 'battle' && ac.currentTime - old.startedAt < 1.2) secs = 0.3;
    const oldKey = old ? currentSection(old, ac.currentTime)?.key ?? old.def.key : null;
    if (old) meltOut(ac, old, secs);
    const keep = saved.get(id);
    const resume = keep && (def.kind === 'place' || def.kind === 'scene') && ac.currentTime - keep.at < 900 ? keep.s : undefined;
    const p = makePlayer(ac, kit, id, kit.bus, undefined, resume);
    const now = ac.currentTime;
    const level = def.level ?? 1;
    const fadeIn = old ? secs : Math.min(secs, 0.8);
    p.out.gain.setValueAtTime(0, now);
    powerRamp(p.out.gain, now, fadeIn, 0, level, 'in');
    p.melt.frequency.setValueAtTime(old ? 1100 : 3000, now);
    p.melt.frequency.exponentialRampToValueAtTime(18000, now + fadeIn * 0.9);
    tune(ac, kit, def);
    player = p;
    if (old) {
      // The bridge: a tone both keys share, played in both tracks. One copy fades out with the old track and one
      // fades in with the new, on the same equal-power curves, so together they hold one level through the melt.
      const br = bridgeNote(oldKey, def.key, secs);
      const n: Note = { ...br, at: now + 0.02, dur: secs + 1.2, kr: def.key.root, km: def.key.mode };
      try { voiceNote(ac, kit, p, n); } catch { noteErrors++; }
      try { voiceNote(ac, kit, old, n); } catch { noteErrors++; }
    }
    stir(old ? 0.5 : 0.2);
    fill(ac, kit, p, now, lookahead());
  } catch { player = null; }
}

function resetFight(): void {
  state.phase = 0;
  state.low = false;
  state.lowLeft = 0;
  state.turn = 'party';
  state.rounds = 0;
  state.kills = 0;
}

function startTrack(id: string | null): void {
  if (id === null) {
    desired = null;
    const ac = audioCtx();
    if (ac && player) meltOut(ac, player, meltSeconds(player.def, null));
    player = null;
    return;
  }
  const def = TRACKS[id];
  if (!def) return;
  if (def.kind === 'battle') {
    const wasBattle = !!desired && TRACKS[desired]?.kind === 'battle';
    if (!wasBattle) {
      // After the fight the music returns to what played before it: silence if the game asked for none, and the
      // original track if this fight is a retry after a defeat.
      if (desired === null) state.returnTo = null;
      else if (TRACKS[desired] && TRACKS[desired].kind !== 'sting' && desired !== 'defeat') state.returnTo = desired;
      state.battleRegion = state.fieldRegion;
      resetFight();
    }
  } else if (def.kind !== 'sting') {
    state.low = false;
    state.phase = 0;
  }
  if (def.region) state.fieldRegion = def.region;
  desired = id;
  start(id);
}

function tick(): void {
  const ac = audioCtx();
  if (!ac || !kit) return;
  try {
    const now = ac.currentTime, ahead = lookahead();
    if (player) fill(ac, kit, player, now, ahead);
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      if (d.stopAt !== null && now > d.stopAt + 0.3) { dispose(d); dying.splice(i, 1); }
      else fill(ac, kit, d, now, ahead);
    }
    // The victory sting melts back into the track the battle interrupted, or into whatever the game asked for since.
    if (player && player.def.kind === 'sting' && player.ended && now >= player.secEnd - 1.0) {
      const to = state.pending !== undefined ? state.pending : state.returnTo;
      state.pending = undefined;
      startTrack(to && TRACKS[to] ? to : null);
    }
    if (state.ducked && now > state.talkUntil) {
      state.ducked = false;
      kit.talkDuck.gain.setTargetAtTime(1, now, 0.25);
    }
  } catch { /* never throw from the timer */ }
}

function ready(): void {
  const ac = audioCtx(), out = musicOut();
  if (!ac || !out || kit) return;
  try {
    kit = buildKit(ac, out);
    if (timer === null) timer = setInterval(tick, 25);
    if (desired) start(desired);
  } catch { kit = null; }
}

onAudioReady(ready);

// ---------------------------------------------------------------- one-shot figures

export type FigureKind = 'kill' | 'party' | 'enemy';

/** The notes of a one-shot figure in key K, with times in beats from 0. Every pitch stays in the key. */
export function figureEvents(kind: FigureKind, K: Key): Ev[] {
  const ev: Ev[] = [];
  if (kind === 'kill') {
    // A kill: a brass stab on the fifth that leaps to the octave over a quick run of blips up the tonic chord.
    ev.push({ t: 0, d: 0.2, v: 'brass', n: K(4), g: 0.34, cut: 2600 });
    ev.push({ t: 0.25, d: 0.6, v: 'brass', n: K(7), g: 0.36, cut: 2800 });
    [0, 2, 4, 7].forEach((d, i) => ev.push({ t: i * 0.125, d: 0.1, v: 'blip', n: K(d) + 12, g: 0.2 }));
    ev.push({ t: 0.25, d: 1, v: 'bell', n: K(7) + 12, g: 0.18 });
    ev.push({ t: 0, d: 0.5, v: 'nz', n: 60, nz: 'crash', g: 0.22 });
  } else if (kind === 'party') {
    // The party's turn: two soft bells, the tonic and the fifth, like a door held open.
    ev.push({ t: 0, d: 1, v: 'bell', n: K(0) + 12, g: 0.16, pan: -0.3 });
    ev.push({ t: 0.5, d: 1.2, v: 'bell', n: K(4) + 12, g: 0.14, pan: 0.3 });
  } else {
    // The enemy's turn: a low brass swell that falls a step, and a roll under it.
    ev.push({ t: 0, d: 1.4, v: 'brass', n: K(1) - 12, g: 0.24, a: 0.4, cut: 900 });
    ev.push({ t: 1, d: 1, v: 'brass', n: K(0) - 12, g: 0.22, cut: 800 });
    ev.push({ t: 0, d: 1, v: 'nz', n: 60, nz: 'roll', g: 0.16 });
  }
  return ev;
}

function playFigure(kind: FigureKind): void {
  const ac = audioCtx();
  if (!ac || !kit || !player || isMuted()) return;
  try {
    const now = ac.currentTime;
    const info = currentSection(player, now);
    if (!info) return;
    const spb = 60 / Math.max(20, info.bpm);
    const grid = spb * 0.5;
    const t0 = info.start + Math.ceil((now + 0.04 - info.start) / grid) * grid;
    for (const e of figureEvents(kind, info.key)) {
      const n: Note = { ...e, at: t0 + e.t * spb, dur: e.d * spb, kr: info.key.root, km: info.key.mode };
      if (n.at < now) continue;
      voiceNote(ac, kit, player, maybeDarken(player, n));
    }
  } catch { noteErrors++; }
}

function nextGrid(p: Player, now: number, beats: number): number {
  const info = currentSection(p, now);
  if (!info) return now;
  const step = (beats * 60) / Math.max(20, info.bpm);
  return info.start + Math.ceil((now + 0.03 - info.start) / step) * step;
}

/** Opens or closes every flag layer to match the battle state, on the next beat. */
function applyLayers(): void {
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  for (const p of [player, ...dying]) {
    if (!p) continue;
    const at = Math.max(now, Math.min(now + 0.6, nextGrid(p, now, 1)));
    for (const [keyName, g] of p.layers) {
      const f = keyName.split(':')[0] as Flag;
      try { holdAt(g.gain, at); g.gain.setTargetAtTime(flagOn(f) ? 1 : 0, at, 0.04); } catch { /* ignore */ }
    }
  }
}

function nextBar(p: Player, now: number): number {
  const info = currentSection(p, now);
  if (!info) return now;
  const barSec = (info.bar * 60) / Math.max(20, info.bpm);
  return info.start + Math.ceil((now + 0.08 - info.start) / barSec) * barSec;
}

function setLow(on: boolean): void {
  if (state.low === on) return;
  state.low = on;
  const ac = audioCtx();
  if (!ac || !player) return;
  const at = nextBar(player, ac.currentTime);
  if (on) { player.lowFrom = at; player.lowTo = null; }
  else if (player.lowFrom !== null) player.lowTo = at;
  applyLayers();
}

/** Cuts the current section at the next bar line and moves the boss track to its phase material. */
function bossPhase(): void {
  state.phase++;
  const ac = audioCtx();
  if (!ac || !kit || !player || player.def.kind !== 'battle') return;
  try {
    const p = player;
    const at = nextBar(p, ac.currentTime);
    p.queue = p.queue.slice(p.qi).filter((n) => n.at < at);
    p.qi = 0;
    p.secEnd = at;
    p.ended = false;
    p.secs = p.secs.filter((s) => s.start < at);
    p.mono = {};
    if (p.def.secs.phase) p.seq.force('phase');
  } catch { /* never throw */ }
}

// ---------------------------------------------------------------- offline levels

/**
 * Renders a track offline with the real band, for checking levels without listening. Browser only. Returns the
 * loudest one-second RMS and the peak, both in dBFS, before the music bus.
 */
export async function renderOffline(id: string, seconds: number, opts: { level?: number; seed?: number; region?: Region } = {}): Promise<{ rms: number; peak: number; errors: number }> {
  const sr = 44100;
  const ac = new OfflineAudioContext(2, Math.round(sr * seconds), sr);
  const k = buildKit(ac, ac.destination);
  const was = state.manual;
  const wasRegion = state.battleRegion;
  state.manual = opts.level ?? 0;
  if (opts.region) state.battleRegion = opts.region;
  const p = makePlayer(ac, k, id, k.bus, opts.seed ?? 1);
  tune(ac, k, p.def);
  let errors = 0;
  for (let t = 0; t < seconds;) {
    const s = p.seq.next(t);
    if (!s) break;
    for (const n of s.notes) {
      if (n.at < 0 || n.at >= seconds) continue;
      if ((n.lay ?? 0) > state.manual || (n.top !== undefined && state.manual >= n.top)) continue;
      if (n.when === 'enemy' || n.when === 'low') continue;
      try { voiceNote(ac, k, p, n); } catch { errors++; }
    }
    t += s.secs;
  }
  state.manual = was;
  state.battleRegion = wasRegion;
  const buffer = await ac.startRendering();
  let peak = 0, best = 0;
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
  for (let s = 0; s + sr <= L.length; s += sr / 2) {
    let acc = 0;
    for (let i = s; i < s + sr; i++) { acc += L[i] * L[i] + R[i] * R[i]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    best = Math.max(best, Math.sqrt(acc / (2 * sr)));
  }
  const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
  return { rms: db(best), peak: db(peak), errors };
}

// ---------------------------------------------------------------- control

export type CombatEvent = 'start' | 'party_turn' | 'enemy_turn' | 'low_hp' | 'kill' | 'victory' | 'defeat' | 'boss_phase' | 'end';

function fighting(): boolean {
  return !!desired && TRACKS[desired]?.kind === 'battle';
}

export const music = {
  /** Melts into a track. 'none' melts to silence. Returns false for an unknown name. */
  play(name: string): boolean {
    if (name !== 'none' && !TRACKS[name]) return false;
    const id = name === 'none' ? null : name;
    if (id === desired) return true;
    // A victory sting finishes before anything replaces it, then melts into whatever the game asked for.
    const ac = audioCtx();
    if (player && player.def.kind === 'sting' && ac && !player.ended && (id === null || TRACKS[id].kind !== 'sting')) {
      state.pending = id;
      return true;
    }
    if (!ac || !kit) {
      if (id && TRACKS[id].kind === 'battle' && !fighting()) {
        if (desired && TRACKS[desired]?.kind !== 'sting') state.returnTo = desired;
        state.battleRegion = state.fieldRegion;
        resetFight();
      }
      desired = id;
      if (id && TRACKS[id].region) state.fieldRegion = TRACKS[id].region!;
      return true;
    }
    startTrack(id);
    return true;
  },
  event(kind: CombatEvent): boolean {
    switch (kind) {
      case 'start':
        if (!fighting()) music.play('combat');
        resetFight();
        applyLayers();
        stir(0.2);
        return true;
      case 'party_turn':
        if (!fighting()) return true;
        if (state.turn !== 'party') playFigure('party');
        state.turn = 'party';
        state.rounds++;
        if (state.low && --state.lowLeft <= 0) setLow(false);
        applyLayers();
        stir(0.1);
        return true;
      case 'enemy_turn':
        if (!fighting()) return true;
        if (state.turn !== 'enemy') playFigure('enemy');
        state.turn = 'enemy';
        applyLayers();
        stir(0.1);
        return true;
      case 'low_hp':
        if (!fighting()) return true;
        state.lowLeft = 3;
        setLow(true);
        stir(0.3);
        return true;
      case 'kill': {
        if (!fighting()) return true;
        state.kills++;
        const now = nowTime();
        if (now - state.lastKillFig > 0.45 || now < state.lastKillFig) { state.lastKillFig = now; playFigure('kill'); }
        stir(0.15);
        return true;
      }
      case 'victory':
        if (!fighting()) return true;
        music.play('victory');
        return true;
      case 'defeat':
        music.play('defeat');
        return true;
      case 'boss_phase':
        if (!fighting()) return true;
        bossPhase();
        stir(0.4);
        return true;
      case 'end':
        // A fight that ends without the victory sting (a retreat, a talk-down) melts straight back.
        if (fighting() || desired === 'defeat') music.play(state.returnTo && TRACKS[state.returnTo] ? state.returnTo : 'none');
        return true;
      default:
        return false;
    }
  },
  /** Sets an intensity floor from 0 to 1, for tools. The game drives intensity through combat events. */
  setIntensity(x: number): void {
    const v = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
    if (Math.abs(v - state.manual) > 0.2) stir(Math.abs(v - state.manual) * 0.5);
    state.manual = v;
  },
  intensity(): number {
    return effectiveIntensity();
  },
  /** Sets the battle district and recolors a fight that plays now, for the menu's soundtrack player. */
  setRegion(r: Region): void {
    state.fieldRegion = r;
    if (!fighting()) return;
    state.battleRegion = r;
    start(desired!);
    if (state.low && player) player.lowFrom = nowTime();
  },
  /** Notes that failed to schedule since the page loaded. */
  errors(): number {
    return noteErrors;
  },
  /** The district battles take their color from, and the turn, for tools. */
  debugState(): { region: Region; turn: string; low: boolean; phase: number; kills: number; rounds: number; returnTo: string | null } {
    return { region: state.battleRegion, turn: state.turn, low: state.low, phase: state.phase, kills: state.kills, rounds: state.rounds, returnTo: state.returnTo };
  },
  current(): string | null {
    return desired;
  },
  /** True once a track that ends has played its last scripted section, and always true without audio. */
  finished(): boolean {
    const ac = audioCtx();
    if (!ac || !player) return true;
    return player.passedEnd || (player.ended && ac.currentTime >= player.secEnd);
  },
  /** The key the music is in now, so sound effects can sit in it. */
  keyNow(): { root: number; mode: readonly number[] } | null {
    const ac = audioCtx();
    if (!player) return desired && TRACKS[desired] ? TRACKS[desired].key : null;
    const info = ac ? currentSection(player, ac.currentTime) : null;
    const K = info?.key ?? player.def.key;
    if (player.lowFrom !== null && ac && ac.currentTime >= player.lowFrom && (player.lowTo === null || ac.currentTime < player.lowTo)) {
      return { root: K.root, mode: darker(K.mode) };
    }
    return K;
  },
  /** Ducks the music a little while a voice speaks. */
  talk(): void {
    const ac = audioCtx();
    if (!ac || !kit) return;
    state.talkUntil = ac.currentTime + 0.35;
    if (!state.ducked) {
      state.ducked = true;
      try { kit.talkDuck.gain.setTargetAtTime(0.8, ac.currentTime, 0.06); } catch { /* ignore */ }
    }
  },
};

export { MODE };
