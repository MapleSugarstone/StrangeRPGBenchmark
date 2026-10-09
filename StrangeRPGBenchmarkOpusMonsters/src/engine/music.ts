// Music engine: a lookahead scheduler over the generators in score.ts, voiced like a small console sound chip.
// Safe to import in Node: nothing touches Web Audio until a track is wanted and audio() hands back a context.
import { audio, muted } from './audio';
import { Rng, TRACKS, hash, slipSec, swingSec, vary, wrong } from './score';
import type { Ctx, Ev, Section, TrackDef, Voice } from './score';

/** A scheduled note: the score event plus absolute start and length in seconds. */
export interface Note extends Ev { at: number; dur: number }

/** One generated section, timed from `start` in seconds. `capped` counts notes the channel limit trimmed. */
export interface Rendered { name: string; start: number; secs: number; bpm: number; tag?: string; capped: number; notes: Note[] }

const MONO: ReadonlySet<Voice> = new Set<Voice>(['p1', 'p2', 'tri', 'nz', 'air']);
const BELL_POLY = 2;
/** The most channels that may sound at once. Each ringing bell note counts as one channel. */
export const MAX_CHANNELS = 5;
/** The lowest triangle pitch that may sound after the drop. Lower bass folds up an octave. */
export const TRI_FLOOR = 28;
const TRI_CEIL = 64;
/** Level of each voice before the track mix. */
export const BASE: Record<Voice, number> = { p1: 0.3, p2: 0.28, tri: 0.55, nz: 0.4, bell: 0.34, air: 0.75 };
const PAN: Record<Voice, number> = { p1: -0.25, p2: 0.25, tri: 0, nz: 0.06, bell: 0.15, air: -0.12 };
/** Share of each voice sent to the shared echo, before the track's echo amount. */
export const SEND: Record<Voice, number> = { p1: 0.55, p2: 0.55, tri: 0.12, nz: 0.25, bell: 1, air: 1 };
const VOICES: Voice[] = ['p1', 'p2', 'tri', 'nz', 'bell', 'air'];
export const DUTIES = [0.125, 0.25, 0.5, 0.375];
/** The music's overall level, applied once at the output so every track keeps its balance. */
export const MASTER = 0.4;

/** The definition of a track, or undefined for an id the score does not have. */
export function trackDef(id: string): TrackDef | undefined {
  return Object.prototype.hasOwnProperty.call(TRACKS, id) ? (TRACKS as Record<string, TrackDef>)[id] : undefined;
}

function bandsOverlap(a: Ev, b: Ev): boolean {
  return Math.max(a.lay ?? 0, b.lay ?? 0) < Math.min(a.top ?? 2, b.top ?? 2);
}

function prio(e: Ev): number {
  if (e.k) return 30;
  let p = e.v === 'tri' ? 5 : e.v === 'p1' ? 4 : e.v === 'air' ? 3 : e.v === 'p2' ? 2 : e.v === 'bell' ? 1.5
    : e.nz === 'kick' || e.nz === 'thud' || e.nz === 'snare' || e.nz === 'stamp' ? 4.5 : 2.5;
  if (e.m) p += 3;
  if (e.pin) p += 6;
  return p + e.g * 0.1;
}

/** Channels in use by a set of simultaneous notes: one per mono voice, one per ringing bell note. */
export function channels(list: readonly Ev[]): number {
  const mono = new Set<Voice>();
  let bells = 0;
  for (const e of list) { if (e.v === 'bell') bells++; else mono.add(e.v); }
  return mono.size + bells;
}

/** Enforces the chip: one note per mono voice, two ringing bell notes, five channels, nothing past the section end. Kept notes always win. */
export function normalize(sec: Section): { ev: Ev[]; capped: number } {
  const ev = sec.ev
    .filter((e) => Number.isFinite(e.n) && Number.isFinite(e.t) && Number.isFinite(e.d) && e.t >= -1e-6 && e.t < sec.beats - 1e-6 && e.d > 0 && e.g > 0)
    .map((e) => ({ ...e, t: Math.max(0, e.t), g: Math.min(1, e.g) }))
    .sort((a, b) => a.t - b.t);
  const dead = new Set<Ev>();
  const byVoice = new Map<Voice, Ev[]>();
  for (const e of ev) { const l = byVoice.get(e.v); if (l) l.push(e); else byVoice.set(e.v, [e]); }
  for (const [v, list] of byVoice) {
    if (MONO.has(v)) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (dead.has(a)) continue;
        a.d = Math.min(a.d, sec.beats - a.t);
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (dead.has(b)) continue;
          if (b.t >= a.t + a.d) break;
          if (!bandsOverlap(a, b)) continue;
          if (a.k && !b.k) { dead.add(b); continue; }
          // Two notes on the same instant: the kept one wins, then the louder one, so a kick beats a hat.
          if (b.t - a.t < 0.03) {
            if (b.k || b.g > a.g) { dead.add(a); break; }
            dead.add(b);
            continue;
          }
          a.d = Math.min(a.d, b.t - a.t - 0.01);
          break;
        }
      }
    } else {
      const ringing: Ev[] = [];
      for (const e of list) {
        if (dead.has(e)) continue;
        e.d = Math.min(e.d, sec.beats - e.t);
        for (let k = ringing.length - 1; k >= 0; k--) if (dead.has(ringing[k]) || ringing[k].t + ringing[k].d <= e.t + 1e-6) ringing.splice(k, 1);
        const over = ringing.filter((x) => bandsOverlap(x, e));
        if (over.length >= BELL_POLY) {
          const cut = over.filter((x) => !x.k).sort((x, y) => x.t + x.d - (y.t + y.d))[0];
          if (!cut) { dead.add(e); continue; }
          if (e.t - cut.t < 0.03) dead.add(cut);
          else cut.d = Math.max(0.02, e.t - cut.t - 0.01);
          ringing.splice(ringing.indexOf(cut), 1);
        }
        ringing.push(e);
      }
    }
  }
  // The channel limit, checked at every intensity where the set of sounding notes changes.
  let capped = 0;
  const live = ev.filter((e) => !dead.has(e));
  for (const e of live) {
    if (dead.has(e)) continue;
    const t = e.t + 1e-4;
    for (let guard = 0; guard < 24; guard++) {
      const S = live.filter((s) => !dead.has(s) && s.t <= t && s.t + s.d > t);
      if (S.length <= MAX_CHANNELS) break;
      const xs = [...new Set([0, ...S.map((s) => s.lay ?? 0), ...S.map((s) => s.top ?? 2)])].filter((x) => x <= 1).sort((a, b) => a - b);
      let hit = false;
      for (const x of xs) {
        const A = S.filter((s) => (s.lay ?? 0) <= x && x < (s.top ?? 2));
        if (channels(A) <= MAX_CHANNELS) continue;
        let victim = A[0], best = Infinity;
        for (const s of A) { const sc = prio(s) - ((s.lay ?? 0) < x ? 0.75 : 0); if (sc < best) { best = sc; victim = s; } }
        if (x === 0 && victim.t < e.t - 0.02) victim.d = Math.max(0.01, e.t - victim.t - 0.01);
        else if ((victim.lay ?? 0) < x) victim.top = x;
        else dead.add(victim);
        capped++;
        hit = true;
        break;
      }
      if (!hit) break;
    }
  }
  return { ev: live.filter((e) => !dead.has(e) && e.d > 0.005 && (e.lay ?? 0) < (e.top ?? 2)), capped };
}

/** Walks one track's section graph and renders each section to timed notes. */
export class Seq {
  private cur: string | null;
  private pass = 0;
  private visits: Record<string, number> = {};
  private st: Record<string, number> = {};
  private mem: Record<string, number[]> = {};

  constructor(readonly id: string, readonly def: TrackDef, private seed: number, private int: () => number) {
    this.cur = def.start;
  }

  next(start: number): Rendered | null {
    const name = this.cur;
    const def = this.def;
    if (name === null || !def.secs[name]) return null;
    const r = new Rng(this.seed ^ hash(this.id) ^ Math.imul(this.pass + 1, 0x9e3779b1));
    const c: Ctx = { r, pass: this.pass, visit: this.visits[name] ?? 0, int: this.int(), bpm: def.bpm, st: this.st, mem: this.mem };
    let sec = def.secs[name](c);
    if (!sec.still) {
      sec = vary(sec, r, def.vary ?? 0.5, def.bendy ?? 0);
      if (r.chance(def.wrong ?? 0.04)) sec = wrong(sec, r);
      if (r.chance(def.slip ?? 0)) sec = slipSec(sec, r);
      if (def.swing) sec = swingSec(sec, r, def.swing, def.stumble ?? 0);
    }
    const spb = 60 / Math.max(20, sec.bpm || def.bpm);
    const { ev, capped } = normalize(sec);
    const notes: Note[] = ev.map((e) => ({ ...e, at: start + e.t * spb, dur: e.d * spb }));
    this.visits[name] = c.visit + 1;
    this.pass++;
    let nxt: string | null = null;
    if (def.next) nxt = def.next(name, c);
    else { const opts = def.graph?.[name]; if (opts && opts.length) nxt = r.weighted(opts); }
    this.cur = nxt !== null && def.secs[nxt] ? nxt : null;
    return { name, start, secs: Math.max(0.05, sec.beats * spb), bpm: sec.bpm, tag: sec.tag, capped, notes };
  }
}

/** Renders a track without audio, for tests and offline checks. */
export function renderTrack(id: string, seconds: number, opts: { seed?: number; intensity?: (t: number) => number } = {}): Rendered[] {
  const def = trackDef(id);
  if (!def) return [];
  let t = 0;
  const seq = new Seq(id, def, opts.seed ?? 1, () => opts.intensity?.(t) ?? 0);
  const out: Rendered[] = [];
  while (t < seconds) {
    const s = seq.next(t);
    if (!s) break;
    out.push(s);
    t += s.secs;
  }
  return out;
}

/** Lifts a section's bass an octave when the drop would take it below the floor. */
export function foldBass(notes: Array<{ v: Voice; n: number }>, drop: number): void {
  let lo = Infinity, hi = -Infinity;
  for (const x of notes) if (x.v === 'tri') { lo = Math.min(lo, x.n); hi = Math.max(hi, x.n); }
  if (lo === Infinity || lo - drop >= TRI_FLOOR) return;
  if (hi + 12 - drop <= TRI_CEIL) { for (const x of notes) if (x.v === 'tri') x.n += 12; return; }
  for (const x of notes) if (x.v === 'tri') while (x.n - drop < TRI_FLOOR) x.n += 12;
}

// ---------------------------------------------------------------- voices

interface Kit {
  ac: AudioContext;
  pulse: PeriodicWave[];
  tri: PeriodicWave;
  white: AudioBuffer;
  metal: AudioBuffer;
  /** Every pitched node's detune listens here: tape wobble, the Stays' drop, and the moon's bend. */
  pitch: GainNode;
  wob: GainNode;
  drop: ConstantSourceNode;
  bend: ConstantSourceNode;
  out: GainNode;
  bus: GainNode;
  echoIn: GainNode;
}

interface Player {
  id: string;
  seq: Seq;
  out: GainNode;
  chans: Record<Voice, AudioNode>;
  nodes: AudioNode[];
  queue: Note[];
  qi: number;
  secEnd: number;
  ended: boolean;
  stopAt: number | null;
  live: Set<AudioScheduledSourceNode>;
}

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let kit: Kit | null = null;
let player: Player | null = null;
const dying: Player[] = [];
let desired: string | null = null;
let intensity = 0;
let drop = 0;
let volume = 0.6;
let level = -1;
let timer: ReturnType<typeof setInterval> | null = null;
let sessionSeed = 1;

function buildKit(ac: AudioContext): Kit {
  const pulse = DUTIES.map((d) => {
    const H = 28, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let h = 1; h <= H; h++) re[h] = Math.sin(Math.PI * h * d) / h;
    return ac.createPeriodicWave(re, im);
  });
  // A 32-step triangle, the stepped shape of a console bass channel.
  const N = 256, H = 32, x = new Float32Array(N);
  for (let i = 0; i < N; i++) { const ph = i / N; const tri = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4; x[i] = Math.round(tri * 7.5) / 7.5; }
  const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { a += x[i] * Math.cos((2 * Math.PI * h * i) / N); b += x[i] * Math.sin((2 * Math.PI * h * i) / N); }
    re[h] = (2 * a) / N; im[h] = (2 * b) / N;
  }
  const tri = ac.createPeriodicWave(re, im);
  const sr = ac.sampleRate;
  const white = ac.createBuffer(1, sr * 2, sr);
  const wd = white.getChannelData(0);
  for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
  // Short-mode LFSR noise: a buzzy metallic loop.
  const metal = ac.createBuffer(1, sr, sr);
  const md = metal.getChannelData(0);
  let reg = 1, v = 1;
  const hold = Math.max(1, Math.round(sr / 9000));
  for (let i = 0; i < md.length; i++) {
    if (i % hold === 0) { const bit = (reg ^ (reg >> 6)) & 1; reg = (reg >> 1) | (bit << 14); v = reg & 1 ? 1 : -1; }
    md[i] = v;
  }
  const pitch = ac.createGain();
  pitch.gain.value = 1;
  const wob = ac.createGain();
  wob.gain.value = 5;
  wob.connect(pitch);
  for (const [f, g] of [[0.19, 1], [0.061, 0.7]] as const) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.value = f; og.gain.value = g;
    o.connect(og); og.connect(wob); o.start();
  }
  const dropSrc = ac.createConstantSource();
  dropSrc.offset.value = -100 * drop;
  dropSrc.connect(pitch); dropSrc.start();
  const bendSrc = ac.createConstantSource();
  bendSrc.offset.value = 0;
  bendSrc.connect(pitch); bendSrc.start();
  const out = ac.createGain();
  out.gain.value = 0;
  out.connect(ac.destination);
  const bus = ac.createGain();
  bus.connect(out);
  const echoIn = ac.createGain();
  const dl = ac.createDelay(1);
  dl.delayTime.value = 0.34;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2200;
  const fb = ac.createGain();
  fb.gain.value = 0.36;
  const echoOut = ac.createGain();
  echoOut.gain.value = 0.42;
  echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(echoOut); echoOut.connect(bus);
  return { ac, pulse, tri, white, metal, pitch, wob, drop: dropSrc, bend: bendSrc, out, bus, echoIn };
}

function makePlayer(k: Kit, id: string, def: TrackDef): Player {
  const ac = k.ac;
  sessionSeed = (Math.imul(sessionSeed, 1103515245) + 12345 + Date.now()) >>> 0;
  const seq = new Seq(id, def, sessionSeed, () => intensity);
  const out = ac.createGain();
  out.connect(k.bus);
  const nodes: AudioNode[] = [out];
  const chans = {} as Record<Voice, AudioNode>;
  for (const v of VOICES) {
    const g = ac.createGain();
    g.gain.value = BASE[v] * (def.mix?.[v] ?? 1);
    let tail: AudioNode = g;
    if (v === 'p1' || v === 'p2') {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 4200; f.Q.value = 0.4;
      tail.connect(f); tail = f; nodes.push(f);
    }
    if (typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner();
      p.pan.value = PAN[v];
      tail.connect(p); tail = p; nodes.push(p);
    }
    tail.connect(out);
    const s = ac.createGain();
    s.gain.value = (def.echo ?? 0.3) * SEND[v];
    tail.connect(s); s.connect(k.echoIn); nodes.push(s);
    nodes.push(g);
    chans[v] = g;
  }
  return { id, seq, out, chans, nodes, queue: [], qi: 0, secEnd: ac.currentTime + 0.06, ended: false, stopAt: null, live: new Set() };
}

function link(k: Kit, params: AudioParam[]): void {
  for (const a of params) k.pitch.connect(a);
}

function track(p: Player, src: AudioScheduledSourceNode, extra: AudioNode[], params: AudioParam[], k: Kit): void {
  p.live.add(src);
  src.onended = () => {
    p.live.delete(src);
    try { src.disconnect(); } catch { /* ignore */ }
    for (const n of extra) { try { n.disconnect(); } catch { /* ignore */ } }
    for (const a of params) { try { k.pitch.disconnect(a); } catch { /* ignore */ } }
  };
}

function envelope(p: AudioParam, at: number, dur: number, peak: number, a: number, rel: number, sus: number, dec: number): void {
  p.setValueAtTime(0, at);
  p.linearRampToValueAtTime(peak, at + a);
  if (dur > a + 0.01) p.setTargetAtTime(peak * sus, at + a, dec);
  p.setTargetAtTime(0, at + Math.max(dur, a), rel / 5);
}

function bendTo(p: AudioParam, f: number, at: number, dur: number, semis: number): void {
  p.setValueAtTime(f, at + dur * 0.5);
  p.exponentialRampToValueAtTime(f * Math.pow(2, semis / 12), at + dur);
}

function voiceNote(k: Kit, p: Player, n: Note, spread: number): void {
  const ac = k.ac, ch = p.chans[n.v];
  const at = n.at, dur = Math.max(0.02, n.dur), g = Math.min(1, n.g);
  if (n.v === 'nz') { noiseNote(k, p, n, ch); return; }
  const f = mtof(n.n);
  if (n.v === 'p1' || n.v === 'p2' || n.v === 'tri') {
    const o = ac.createOscillator();
    o.setPeriodicWave(n.v === 'tri' ? k.tri : k.pulse[(n.duty ?? 1) & 3]);
    o.frequency.setValueAtTime(f, at);
    if (n.bend) bendTo(o.frequency, f, at, dur, n.bend);
    o.detune.value = (n.det ?? 0) + (n.v === 'p2' ? spread : 0) + (Math.random() * 6 - 3);
    link(k, [o.detune]);
    const eg = ac.createGain();
    const rel = n.v === 'tri' ? 0.03 : 0.06;
    if (n.v === 'tri') envelope(eg.gain, at, dur, g, n.a ?? 0.006, rel, 1, 1);
    else envelope(eg.gain, at, dur, g, n.a ?? 0.008, rel, 0.72, 0.18);
    o.connect(eg); eg.connect(ch);
    o.start(at); o.stop(at + dur + rel + 0.02);
    track(p, o, [eg], [o.detune], k);
    return;
  }
  if (n.v === 'bell') {
    const ratio = n.ratio ?? 3.5;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), eg = ac.createGain();
    car.frequency.setValueAtTime(f, at);
    mod.frequency.setValueAtTime(f * ratio, at);
    if (n.bend) { bendTo(car.frequency, f, at, dur, n.bend); bendTo(mod.frequency, f * ratio, at, dur, n.bend); }
    car.detune.value = n.det ?? 0;
    mod.detune.value = n.det ?? 0;
    link(k, [car.detune, mod.detune]);
    let end: number;
    if (n.rev) {
      // A bell played backwards: it swells up to the strike and stops there.
      end = at + dur + 0.04;
      mg.gain.setValueAtTime(f * 0.12, at);
      mg.gain.exponentialRampToValueAtTime(f * 2.2, at + dur);
      eg.gain.setValueAtTime(0.0006, at);
      eg.gain.exponentialRampToValueAtTime(g, at + dur * 0.94);
      eg.gain.linearRampToValueAtTime(0, end);
    } else {
      end = at + dur + 0.3;
      mg.gain.setValueAtTime(f * 2.2, at);
      mg.gain.exponentialRampToValueAtTime(f * 0.12, at + Math.min(dur, 1.2) + 0.01);
      eg.gain.setValueAtTime(0, at);
      eg.gain.linearRampToValueAtTime(g, at + (n.a ?? 0.004));
      eg.gain.exponentialRampToValueAtTime(0.0006, end);
    }
    mod.connect(mg); mg.connect(car.frequency); car.connect(eg); eg.connect(ch);
    car.start(at); mod.start(at); car.stop(end + 0.02); mod.stop(end + 0.02);
    track(p, car, [eg, mg], [car.detune, mod.detune], k);
    track(p, mod, [], [], k);
    return;
  }
  // Breath: noise through a narrow band at the pitch, with a faint sine under it.
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
  const o = ac.createOscillator(), og = ac.createGain(), eg = ac.createGain();
  src.buffer = k.white; src.loop = true;
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, at); bp.Q.value = 16;
  ng.gain.value = 3.4;
  o.type = 'sine'; o.frequency.setValueAtTime(f, at); og.gain.value = 0.32;
  if (n.bend) { bendTo(bp.frequency, f, at, dur, n.bend); bendTo(o.frequency, f, at, dur, n.bend); }
  o.detune.value = n.det ?? 0;
  bp.detune.value = n.det ?? 0;
  link(k, [o.detune, bp.detune]);
  envelope(eg.gain, at, dur, g, n.a ?? 0.07, 0.25, 0.85, 0.4);
  src.connect(bp); bp.connect(ng); ng.connect(eg); o.connect(og); og.connect(eg); eg.connect(ch);
  const stop = at + dur + 0.3;
  src.start(at, Math.random() * 1.5); o.start(at); src.stop(stop); o.stop(stop);
  track(p, src, [bp, ng, eg], [bp.detune], k);
  track(p, o, [og], [o.detune], k);
}

function noiseNote(k: Kit, p: Player, n: Note, ch: AudioNode): void {
  const ac = k.ac;
  const at = n.at, dur = Math.max(0.02, n.dur), g = Math.min(1, n.g), kind = n.nz ?? 'hat';
  const eg = ac.createGain();
  eg.connect(ch);
  if (kind === 'kick' || kind === 'thud') {
    // The thud is the Volute's pulse: soft and low, slower and rounder than a kick.
    const thud = kind === 'thud';
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(thud ? 92 : 150, at);
    o.frequency.exponentialRampToValueAtTime(thud ? 46 : 42, at + (thud ? 0.2 : 0.12));
    link(k, [o.detune]);
    eg.gain.setValueAtTime(0, at);
    eg.gain.linearRampToValueAtTime(g, at + (thud ? 0.012 : 0.002));
    eg.gain.exponentialRampToValueAtTime(0.001, at + (thud ? 0.4 : 0.22));
    o.connect(eg); o.start(at); o.stop(at + 0.45);
    track(p, o, [eg], [o.detune], k);
    if (thud) {
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
      src.buffer = k.white; src.loop = true;
      f.type = 'lowpass'; f.frequency.value = 280;
      ng.gain.setValueAtTime(g * 0.7, at);
      ng.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
      link(k, [f.detune]);
      src.connect(f); f.connect(ng); ng.connect(ch);
      src.start(at, Math.random() * 0.9); src.stop(at + 0.2);
      track(p, src, [f, ng], [f.detune], k);
    }
    return;
  }
  const src = ac.createBufferSource(), f = ac.createBiquadFilter();
  const metal = kind === 'tick' || kind === 'tock';
  src.buffer = metal ? k.metal : k.white;
  src.loop = true;
  let end = at + dur;
  if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 7000; end = at + Math.min(dur, 0.07); }
  else if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; end = at + 0.16; }
  else if (kind === 'tick') { f.type = 'highpass'; f.frequency.value = 3500; end = at + 0.03; }
  else if (kind === 'tock') { f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2; src.playbackRate.value = 0.5; end = at + 0.04; }
  else if (kind === 'stamp') { f.type = 'lowpass'; f.frequency.value = 1100; end = at + 0.2; }
  else if (kind === 'sweep') {
    f.type = 'bandpass'; f.Q.value = 5;
    const lo = 300, hi = 3600, up = n.n < 60;
    f.frequency.setValueAtTime(up ? lo : hi, at);
    f.frequency.exponentialRampToValueAtTime(up ? hi : lo, at + dur);
  } else { f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.3; }
  const params: AudioParam[] = [f.detune];
  if (metal && src.detune) params.push(src.detune);
  link(k, params);
  if (kind === 'sweep' || kind === 'rush') envelope(eg.gain, at, dur, g, n.a ?? dur * 0.4, 0.4, 1, 1);
  else { eg.gain.setValueAtTime(g, at); eg.gain.exponentialRampToValueAtTime(0.001, end); }
  src.connect(f); f.connect(eg);
  src.start(at, Math.random() * 0.9);
  src.stop(Math.max(end, at + dur) + 0.45);
  track(p, src, [f, eg], params, k);
}

// ---------------------------------------------------------------- what is playing

/** What the music plays around now, for sounds that should stay in tune with it. Pitch classes run from 0 (C) to 11 (B). */
export interface Harmony {
  /** The key's root: the pitch class the bass dwells on most. */
  root: number;
  /** The pitch classes the current track has used lately, most used first, at most seven. */
  scale: number[];
  /** The bass note sounding now as a MIDI number, or the last one if the bass is resting. */
  bass: number | null;
  /** Pitch classes sounding now, the bass's first. */
  chord: number[];
}

/** Recently voiced notes of the current track, with their pitch after the drop and a weight from loudness and length. */
const HEARD_SECS = 8;
let heard: { at: number; end: number; n: number; bass: boolean; w: number }[] = [];

function hear(n: Note, now: number): void {
  heard.push({ at: n.at, end: n.at + n.dur, n: n.n - drop, bass: n.v === 'tri', w: Math.min(1, n.g) * Math.min(2, n.dur) });
  if (heard.length > 300) heard = heard.filter(h => h.at > now - HEARD_SECS);
}

const pc = (n: number): number => ((Math.round(n) % 12) + 12) % 12;

/** The current track's key, scale, and the notes sounding now, or null when no track plays. Reads only. */
function harmonyNow(): Harmony | null {
  if (!kit || !player) return null;
  const t = kit.ac.currentTime;
  const recent = heard.filter(h => h.at > t - HEARD_SECS && h.at <= t + 0.15);
  if (!recent.length) return null;
  const all = new Array(12).fill(0), low = new Array(12).fill(0);
  let total = 0;
  for (const h of recent) { all[pc(h.n)] += h.w * (h.bass ? 1.5 : 1); total += h.w * (h.bass ? 1.5 : 1); if (h.bass) low[pc(h.n)] += h.w; }
  const order = all.map((w, i) => [i, w]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const scale: number[] = [];
  let sum = 0;
  for (const i of order) { if (scale.length >= 7 || (scale.length >= 5 && sum >= total * 0.93)) break; scale.push(i); sum += all[i]; }
  const lowMax = Math.max(...low);
  const root = lowMax > 0 ? low.indexOf(lowMax) : scale[0];
  const sounding = recent.filter(h => h.at <= t + 0.02 && h.end > t);
  const bassNow = sounding.filter(h => h.bass).sort((a, b) => a.n - b.n)[0] ?? recent.filter(h => h.bass && h.at <= t).sort((a, b) => b.at - a.at)[0];
  const chord: number[] = [];
  if (bassNow) chord.push(pc(bassNow.n));
  for (const h of sounding) if (!chord.includes(pc(h.n))) chord.push(pc(h.n));
  return { root, scale, bass: bassNow ? Math.round(bassNow.n) : null, chord };
}

// ---------------------------------------------------------------- scheduler

function lookahead(): number {
  try { return typeof document !== 'undefined' && document.hidden ? 1.5 : 0.12; } catch { return 0.12; }
}

function fill(k: Kit, p: Player, now: number, ahead: number): void {
  const horizon = now + ahead;
  if (!p.ended && p.secEnd < now) { p.queue = []; p.qi = 0; p.secEnd = now + 0.05; }
  let guard = 0;
  while (!p.ended && p.secEnd < horizon + 0.05 && guard++ < 8) {
    if (p.stopAt !== null && p.secEnd >= p.stopAt) break;
    const s = p.seq.next(p.secEnd);
    if (!s) { p.ended = true; break; }
    foldBass(s.notes, drop);
    for (const n of s.notes) p.queue.push(n);
    p.secEnd += s.secs;
  }
  const quiet = muted;
  const spread = p.seq.def.spread ?? 7;
  while (p.qi < p.queue.length && p.queue[p.qi].at < horizon) {
    const n = p.queue[p.qi++];
    if (n.at < now - 0.01) continue;
    if (p.stopAt !== null && n.at >= p.stopAt) continue;
    if ((n.lay ?? 0) > intensity || (n.top !== undefined && intensity >= n.top)) continue;
    if (quiet) continue;
    try { voiceNote(k, p, n, spread); } catch { /* one bad note must not stop the score */ }
    if (p === player && n.v !== 'nz') hear(n, now);
  }
  if (p.qi > 256) { p.queue = p.queue.slice(p.qi); p.qi = 0; }
}

function dispose(p: Player): void {
  for (const s of p.live) { try { s.stop(); } catch { /* ignore */ } }
  p.live.clear();
  for (const n of p.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
}

function applyLevel(): void {
  if (!kit) return;
  const target = muted ? 0 : volume * MASTER;
  if (target === level) return;
  level = target;
  try { kit.out.gain.setTargetAtTime(target, kit.ac.currentTime, 0.04); } catch { /* ignore */ }
}

function tick(): void {
  const k = kit;
  if (!k) return;
  try {
    applyLevel();
    const now = k.ac.currentTime, ahead = lookahead();
    if (player) fill(k, player, now, ahead);
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      if (d.stopAt !== null && now > d.stopAt + 0.3) { dispose(d); dying.splice(i, 1); }
      else fill(k, d, now, ahead);
    }
  } catch { /* never throw from the timer */ }
}

function fadeOut(k: Kit, p: Player, fade: number): void {
  const now = k.ac.currentTime, f = Math.max(0.02, fade);
  try {
    p.out.gain.cancelScheduledValues(now);
    p.out.gain.setValueAtTime(p.out.gain.value, now);
    p.out.gain.linearRampToValueAtTime(0, now + f);
  } catch { /* ignore */ }
  p.stopAt = now + f;
  dying.push(p);
}

function start(id: string, fade: number): void {
  const k = kit;
  if (!k) return;
  try {
    const old = player;
    if (old) fadeOut(k, old, fade);
    player = null;
    const def = trackDef(id);
    if (!def) return;
    const p = makePlayer(k, id, def);
    const now = k.ac.currentTime;
    p.out.gain.setValueAtTime(0, now);
    p.out.gain.linearRampToValueAtTime(1, now + Math.max(0.01, old ? fade : Math.min(fade, 0.4)));
    k.wob.gain.setTargetAtTime(def.wobble ?? 5, now, 0.5);
    player = p;
    heard = [];
    fill(k, p, now, lookahead());
  } catch { player = null; }
}

/** Builds the voices once a track is wanted and the shared context exists. */
function ensure(): void {
  if (kit || desired === null) return;
  const ac = audio();
  if (!ac) return;
  try {
    kit = buildKit(ac);
  } catch { kit = null; return; }
  level = -1;
  applyLevel();
  if (timer === null) timer = setInterval(tick, 25);
  start(desired, 0.6);
}

export const music = {
  /** The id last passed to play, or empty after stop. */
  current: '',
  /** Switches tracks. The same id again does nothing, and an id the score does not have plays silence. */
  play(id: string): void {
    try {
      if (id === desired) return;
      desired = id;
      music.current = id;
      intensity = 0;
      if (!kit) { ensure(); return; }
      start(id, 1);
    } catch { /* never throw */ }
  },
  stop(): void {
    try {
      desired = null;
      music.current = '';
      if (kit && player) fadeOut(kit, player, 1);
      player = null;
    } catch { /* never throw */ }
  },
  /** Lowers every note of every track by this many semitones, notes already sounding included, until called again. */
  setDrop(semitones: number): void {
    drop = Number.isFinite(semitones) ? Math.max(0, Math.min(12, Math.round(semitones))) : 0;
    if (!kit) return;
    try { kit.drop.offset.setTargetAtTime(-100 * drop, kit.ac.currentTime, 0.06); } catch { /* ignore */ }
  },
  /** One downward pitch bend of everything, about 1.5 seconds long, that comes back to pitch. */
  bend(): void {
    if (!kit) return;
    try {
      const o = kit.bend.offset, now = kit.ac.currentTime;
      o.cancelScheduledValues(now);
      o.setValueAtTime(o.value, now);
      o.linearRampToValueAtTime(-320, now + 0.55);
      o.setValueAtTime(-320, now + 0.8);
      o.linearRampToValueAtTime(0, now + 1.5);
    } catch { /* ignore */ }
  },
  setVolume(v: number): void {
    volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
    applyLevel();
  },
  /** Called every frame. The scheduler runs on its own timer, so this only starts the voices once audio exists. */
  update(): void {
    if (!kit) { if (desired !== null) ensure(); return; }
    applyLevel();
  },
  /** 0 to 1. Notes carry lay and top bands, so layers come and go within about 120 ms. */
  setIntensity(x: number): void {
    intensity = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  },
  /** The current track's root, scale, bass, and sounding chord, or null when nothing plays. It changes nothing. */
  harmony(): Harmony | null {
    try { return harmonyNow(); } catch { return null; }
  },
  /** True once a track that does not loop has played its last note. Always true without audio. */
  finished(): boolean {
    if (!kit || !player) return true;
    return player.ended && kit.ac.currentTime >= player.secEnd;
  },
};
