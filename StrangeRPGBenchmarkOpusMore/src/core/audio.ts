// Fake 8-bit console: two pulse channels, a triangle bass, and a noise channel, driven by the composer in compose.ts.
import { Composer } from './compose';
import type { Ch, Ev, Kit, Style } from './compose';
import { SFX } from '../data/sfx';

export type { Style } from './compose';

// One voice of a sound effect. Times are seconds, slide is semitones per second, arp entries are [time, semitone offset].
export interface SfxPart {
  wave: 'pulse' | 'tri' | 'sine' | 'saw' | 'noise';
  f: number;
  at?: number;
  duty?: number;
  slide?: number;
  dslide?: number;
  vib?: [number, number];
  arp?: [number, number][];
  rep?: number;
  a?: number;
  s?: number;
  d?: number;
  punch?: number;
  vol?: number;
  lp?: number;
  hp?: number;
  q?: number;
}

const LOOK = 0.15;
const MASTER = 0.7;
const DUTY = [0.125, 0.25, 0.5];
const CH: Record<Ch, number> = { lead: 0.1, echo: 0.1, harm: 0.07, bass: 0.26, drum: 0.15 };
const KIT: Record<Kit, number> = { k: 1, s: 0.75, h: 0.32, o: 0.32, c: 0.28, t: 0.8 };
const DECAY: Record<Kit, number> = { k: 0.13, s: 0.11, h: 0.035, o: 0.16, c: 0.8, t: 0.18 };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function sfxFreq(p: SfxPart, t: number): number {
  const ph = p.rep ? t % p.rep : t;
  let semi = (p.slide ?? 0) * ph + 0.5 * (p.dslide ?? 0) * ph * ph;
  let off = 0;
  for (const [at, st] of p.arp ?? []) if (ph >= at) off = st;
  semi += off;
  if (p.vib) semi += p.vib[1] * Math.sin(2 * Math.PI * p.vib[0] * t);
  return Math.min(18000, Math.max(20, p.f * Math.pow(2, semi / 12)));
}

function pulseWave(ctx: AudioContext, d: number): PeriodicWave {
  const n = 33, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) re[k] = (2 * Math.sin(k * Math.PI * d)) / (k * Math.PI);
  return ctx.createPeriodicWave(re, im);
}

interface Song { comp: Composer; out: GainNode; t: number; q: { t: number; e: Ev; sd: number }[]; done: boolean; }

export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  muted = false;
  tracks: Record<string, Style> = {};
  current: string | null = null;
  private song: Song | null = null;
  private waves: PeriodicWave[] = [];
  private noiseBuf: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
      return;
    }
    const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = g.AudioContext ?? g.webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try { ctx = new AC(); } catch { return; }
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER;
    this.master.connect(comp);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.waves = DUTY.map((d) => pulseWave(ctx, d));
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.pump(), 25);
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    if (this.current) { const c = this.current; this.current = null; this.play(c); }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime, g = this.master.gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(this.muted ? 0 : MASTER, t, 0.02);
    }
    return this.muted;
  }

  play(id: string | null) {
    if (id === this.current) return;
    this.current = id;
    this.stopSong();
    if (!id || !this.ctx || !this.musicGain) return;
    const st = this.tracks[id];
    if (!st) return;
    const out = this.ctx.createGain();
    out.connect(this.musicGain);
    this.song = { comp: new Composer(id, st), out, t: this.ctx.currentTime + 0.05, q: [], done: false };
    this.pump();
  }

  sfx(name: string) {
    const ctx = this.ctx, bus = this.sfxGain, def = SFX[name];
    if (!ctx || !bus || !def) return;
    const t = ctx.currentTime + 0.005;
    for (const p of Array.isArray(def) ? def : [def]) this.sfxPart(p, t, bus);
  }

  private stopSong() {
    const s = this.song;
    this.song = null;
    if (!s || !this.ctx) return;
    const t = this.ctx.currentTime, g = s.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.15);
    setTimeout(() => s.out.disconnect(), 400);
  }

  private pump() {
    const s = this.song, ctx = this.ctx;
    if (!s || !ctx) return;
    const now = ctx.currentTime, ahead = now + LOOK;
    // A stalled timer (a hidden tab) skips ahead rather than playing the backlog at once.
    if (s.t < now - 0.25) { s.t = now + 0.05; s.q = []; }
    while (!s.done && s.t < ahead) {
      const bar = s.comp.next();
      if (!bar) { s.done = true; break; }
      const sd = 60 / bar.bpm / 4;
      for (const e of bar.evs) s.q.push({ t: s.t + e.at * sd, e, sd });
      s.t += Math.max(0.05, bar.steps * sd);
      s.q.sort((a, b) => a.t - b.t);
    }
    while (s.q.length && s.q[0].t < ahead) {
      const x = s.q.shift()!;
      if (x.t > now - 0.03) this.voice(x.e, Math.max(x.t, now), x.sd, s.out);
    }
  }

  private noise(t: number, dur: number): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur);
    return src;
  }

  private voice(e: Ev, t: number, sd: number, out: AudioNode) {
    const ctx = this.ctx!;
    if (e.ch === 'drum') { this.drum(e, t, out); return; }
    const dur = Math.max(0.04, e.len * sd), v = Math.min(1, e.vel) * CH[e.ch];
    if (v <= 0) return;
    const o = ctx.createOscillator();
    if (e.ch === 'bass') o.type = 'triangle';
    else o.setPeriodicWave(this.waves[e.duty ?? 1] ?? this.waves[1]);
    if (e.arp?.length && e.rate) {
      const st = e.rate * sd;
      for (let i = 0; i * st < dur; i++) o.frequency.setValueAtTime(mtof(e.midi + e.arp[i % e.arp.length]), t + i * st);
    } else {
      o.frequency.setValueAtTime(mtof(e.midi), t);
      if (e.bend) o.frequency.exponentialRampToValueAtTime(mtof(e.midi + e.bend), t + dur);
    }
    if (e.det) o.detune.setValueAtTime(e.det, t);
    const g = ctx.createGain(), a = 0.004, r = Math.min(0.04, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (e.env) g.gain.exponentialRampToValueAtTime(Math.max(1e-4, v * Math.exp(-(dur - r - a) / e.env)), t + dur - r);
    else {
      g.gain.linearRampToValueAtTime(v * 0.8, t + Math.min(dur - r, 0.09));
      g.gain.setValueAtTime(v * 0.8, t + dur - r);
    }
    g.gain.linearRampToValueAtTime(0, t + dur);
    if (e.vib && dur > 0.3) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + 0.16);
      lg.gain.linearRampToValueAtTime(e.vib, t + 0.36);
      lfo.connect(lg);
      lg.connect(o.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    o.connect(g);
    g.connect(out);
    o.onended = () => g.disconnect();
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drum(e: Ev, t: number, out: AudioNode) {
    const ctx = this.ctx!, k = e.kit ?? 'h', v = Math.min(1, e.vel) * CH.drum * KIT[k], dec = DECAY[k];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, v * 0.01), t + dec);
    g.gain.linearRampToValueAtTime(0, t + dec + 0.01);
    g.connect(out);
    if (k === 'k' || k === 't') {
      const o = ctx.createOscillator(), f0 = k === 'k' ? 150 : mtof(e.midi || 50);
      o.type = k === 'k' ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(k === 'k' ? 42 : f0 * 0.55, t + dec);
      o.connect(g);
      o.onended = () => g.disconnect();
      o.start(t);
      o.stop(t + dec + 0.03);
      return;
    }
    const src = this.noise(t, dec + 0.02), f = ctx.createBiquadFilter();
    if (k === 's') {
      f.type = 'bandpass';
      f.frequency.value = 1900;
      f.Q.value = 0.8;
      const body = ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(190, t);
      body.frequency.exponentialRampToValueAtTime(110, t + 0.06);
      body.connect(g);
      body.start(t);
      body.stop(t + 0.07);
    } else {
      f.type = 'highpass';
      f.frequency.value = k === 'c' ? 4000 : k === 'o' ? 6500 : 7500;
    }
    src.connect(f);
    f.connect(g);
    src.onended = () => g.disconnect();
  }

  private sfxPart(p: SfxPart, t0: number, bus: AudioNode) {
    const ctx = this.ctx!, t = t0 + (p.at ?? 0);
    const a = Math.max(0.003, p.a ?? 0.003), s = p.s ?? 0.05, d = Math.max(0.01, p.d ?? 0.05), T = a + s + d, v = p.vol ?? 0.1;
    const n = Math.min(256, Math.max(8, Math.ceil(T * 200))), curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = sfxFreq(p, (T * i) / (n - 1));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * (1 + (p.punch ?? 0)), t + a);
    g.gain.linearRampToValueAtTime(v, t + a + s);
    g.gain.linearRampToValueAtTime(0, t + T);
    let src: AudioScheduledSourceNode, last: AudioNode;
    if (p.wave === 'noise') {
      const ns = this.noise(t, T + 0.02), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = p.q ?? 0.7;
      bp.frequency.setValueCurveAtTime(curve, t, T);
      ns.connect(bp);
      src = ns;
      last = bp;
    } else {
      const o = ctx.createOscillator();
      if (p.wave === 'pulse') o.setPeriodicWave(this.waves[p.duty ?? 2] ?? this.waves[2]);
      else o.type = p.wave === 'tri' ? 'triangle' : p.wave === 'saw' ? 'sawtooth' : 'sine';
      o.frequency.setValueCurveAtTime(curve, t, T);
      o.start(t);
      o.stop(t + T + 0.02);
      src = o;
      last = o;
    }
    for (const [type, hz] of [['lowpass', p.lp], ['highpass', p.hp]] as [BiquadFilterType, number | undefined][]) {
      if (!hz) continue;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      last.connect(f);
      last = f;
    }
    last.connect(g);
    g.connect(bus);
    src.onended = () => g.disconnect();
  }
}
