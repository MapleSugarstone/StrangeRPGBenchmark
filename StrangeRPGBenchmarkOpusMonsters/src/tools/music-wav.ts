// Renders a short sample of tracks to 16-bit mono WAV files with a software copy of the engine's voices, so you can hear the score outside the game.
// Usage: node dist-tools/music-wav.js [seconds] [track ...]. With no tracks it renders the new world's tracks into Notes/sounds/music/.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, DUTIES, MASTER, SEND, renderTrack, trackDef } from '../engine/music';
import type { Note } from '../engine/music';
import { BATTLE_TRACKS } from '../engine/score';

declare const process: { argv: string[]; exitCode: number };

const SR = 24000;
const OUT = path.join('Notes', 'sounds', 'music');
const DEFAULT = ['cove', 'brook', 'highwater', 'saltings', 'shout', 'kelp', 'gantry', 'floes', 'shingle', 'longway', 'gatering', 'holm', 'gempuzzle', 'geode'];
/** The engine's master level at the default volume, raised for listening on its own. Every file gets the same gain, so their loudness compares. */
const GAIN = MASTER * 0.6 * 7.5;

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

/** Short-mode noise: the same buzzy metallic loop the engine builds. */
const METAL = (() => {
  const out = new Float32Array(SR), hold = Math.max(1, Math.round(SR / 9000));
  let reg = 1, v = 1;
  for (let i = 0; i < SR; i++) {
    if (i % hold === 0) { const bit = (reg ^ (reg >> 6)) & 1; reg = (reg >> 1) | (bit << 14); v = reg & 1 ? 1 : -1; }
    out[i] = v;
  }
  return out;
})();

/** A biquad with the Web Audio formulas: Q is in decibels for low-pass and high-pass, and linear for band-pass. */
class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private kind: 'lp' | 'hp' | 'bp', f: number, private q: number) { this.set(f); }
  set(f: number): void {
    const w = (2 * Math.PI * Math.min(f, SR * 0.49)) / SR, cs = Math.cos(w), sn = Math.sin(w);
    const al = sn / (2 * (this.kind === 'bp' ? this.q : Math.pow(10, this.q / 20))), a0 = 1 + al;
    let b0: number, b1: number, b2: number;
    if (this.kind === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (this.kind === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** The engine's envelope: a linear attack, a fall toward the sustain level, and a release once the note ends. */
function adsr(t: number, dur: number, peak: number, a: number, rel: number, sus: number, dec: number): number {
  if (t < a) return peak * (t / a);
  const D = Math.max(dur, a);
  const held = (x: number) => (dur > a + 0.01 ? peak * sus + (peak - peak * sus) * Math.exp(-(x - a) / dec) : peak);
  return t < D ? held(t) : held(D) * Math.exp(-(t - D) / (rel / 5));
}

function blep(t: number, dt: number): number {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}

type Put = (i: number, v: number) => void;

function noise(n: Note, put: Put, dur: number, g: number): void {
  const kind = n.nz ?? 'hat';
  if (kind === 'kick' || kind === 'thud') {
    const thud = kind === 'thud', fA = thud ? 92 : 150, fB = thud ? 46 : 42, ft = thud ? 0.2 : 0.12, at = thud ? 0.012 : 0.002, end = thud ? 0.4 : 0.22;
    const lp = new Biquad('lp', 280, 1), total = Math.ceil(0.45 * SR);
    let ph = 0;
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * fA * Math.pow(fB / fA, Math.min(1, t / ft))) / SR;
      const e = t < at ? g * (t / at) : t < end ? g * Math.pow(0.001 / g, (t - at) / (end - at)) : 0;
      let v = Math.sin(ph) * e;
      if (thud && t < 0.2) v += lp.run(rnd() * 2 - 1) * g * 0.7 * Math.pow(0.001 / (g * 0.7), Math.min(1, t / 0.16));
      put(i, v);
    }
    return;
  }
  const metal = kind === 'tick' || kind === 'tock', swell = kind === 'sweep' || kind === 'rush';
  let f: Biquad, end = dur;
  if (kind === 'hat') { f = new Biquad('hp', 7000, 1); end = Math.min(dur, 0.07); }
  else if (kind === 'snare') { f = new Biquad('bp', 1800, 0.7); end = 0.16; }
  else if (kind === 'tick') { f = new Biquad('hp', 3500, 1); end = 0.03; }
  else if (kind === 'tock') { f = new Biquad('bp', 1100, 2); end = 0.04; }
  else if (kind === 'stamp') { f = new Biquad('lp', 1100, 1); end = 0.2; }
  else if (kind === 'sweep') f = new Biquad('bp', 300, 5);
  else f = new Biquad('lp', 520, 0.3);
  const up = n.n < 60, total = Math.ceil((swell ? dur + 0.45 : end + 0.01) * SR);
  let mi = Math.floor(rnd() * METAL.length);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    if (kind === 'sweep' && i % 32 === 0) f.set(up ? 300 * Math.pow(12, Math.min(1, t / dur)) : 3600 * Math.pow(1 / 12, Math.min(1, t / dur)));
    let src: number;
    if (metal) { src = METAL[Math.floor(mi) % METAL.length]; mi += kind === 'tock' ? 0.5 : 1; }
    else src = rnd() * 2 - 1;
    const e = swell ? adsr(t, dur, g, n.a ?? dur * 0.4, 0.4, 1, 1) : t < end ? g * Math.pow(0.001 / g, t / end) : 0;
    put(i, f.run(src) * e);
  }
}

function play(n: Note, dry: Float32Array, wet: Float32Array, lvl: number, send: number, wob: number, spread: number): void {
  const s0 = Math.round(n.at * SR), dur = Math.max(0.02, n.dur), g = Math.min(1, n.g);
  const put: Put = (i, v) => { const k = s0 + i; if (k >= 0 && k < dry.length) { dry[k] += v * lvl; wet[k] += v * lvl * send; } };
  // Detune, tape wobble, and the bend across the second half of the note, as the engine applies them.
  const freq = (base: number, i: number, extra = 0) => {
    const t = i / SR, at = n.at + t;
    let f = base;
    if (n.bend && t > dur * 0.5) f *= Math.pow(2, (n.bend / 12) * Math.min(1, (t - dur * 0.5) / (dur * 0.5)));
    const cents = (n.det ?? 0) + extra + wob * (Math.sin(2 * Math.PI * 0.19 * at) + 0.7 * Math.sin(2 * Math.PI * 0.061 * at));
    return f * Math.pow(2, cents / 1200);
  };
  if (n.v === 'nz') { noise(n, put, dur, g); return; }
  const f0 = mtof(n.n);
  if (n.v === 'p1' || n.v === 'p2' || n.v === 'tri') {
    const tri = n.v === 'tri', rel = tri ? 0.03 : 0.06, total = Math.ceil((dur + rel + 0.02) * SR);
    const d = DUTIES[(n.duty ?? 1) & 3], dc = 2 * d - 1, norm = 1 / (1 + Math.abs(dc));
    const extra = (n.v === 'p2' ? spread : 0) + (rnd() * 6 - 3), lp = tri ? null : new Biquad('lp', 4200, 0.4);
    let ph = 0;
    for (let i = 0; i < total; i++) {
      const dt = freq(f0, i, extra) / SR;
      let v: number;
      if (tri) { const x = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4; v = Math.round(x * 7.5) / 7.5; }
      else v = ((ph < d ? 1 : -1) + blep(ph, dt) - blep((ph - d + 1) % 1, dt) - dc) * norm;
      ph += dt;
      if (ph >= 1) ph -= 1;
      const e = tri ? adsr(i / SR, dur, g, n.a ?? 0.006, rel, 1, 1) : adsr(i / SR, dur, g, n.a ?? 0.008, rel, 0.72, 0.18);
      put(i, (lp ? lp.run(v) : v) * e);
    }
    return;
  }
  if (n.v === 'bell') {
    const ratio = n.ratio ?? 3.5, rev = !!n.rev, end = rev ? dur + 0.04 : dur + 0.3, a = n.a ?? 0.004, T = Math.min(dur, 1.2) + 0.01;
    const total = Math.ceil(end * SR);
    let pc = 0, pm = 0;
    for (let i = 0; i < total; i++) {
      const t = i / SR, f = freq(f0, i);
      const dev = rev ? f0 * 0.12 * Math.pow(2.2 / 0.12, Math.min(1, t / dur)) : f0 * 2.2 * Math.pow(0.12 / 2.2, Math.min(1, t / T));
      const e = rev
        ? (t < dur * 0.94 ? 0.0006 * Math.pow(g / 0.0006, t / (dur * 0.94)) : g * Math.max(0, 1 - (t - dur * 0.94) / (end - dur * 0.94)))
        : (t < a ? g * (t / a) : g * Math.pow(0.0006 / g, (t - a) / (end - a)));
      pm += (2 * Math.PI * f * ratio) / SR;
      pc += (2 * Math.PI * (f + dev * Math.sin(pm))) / SR;
      put(i, Math.sin(pc) * e);
    }
    return;
  }
  // Breath: noise through a narrow band at the pitch, with a faint sine under it.
  const bp = new Biquad('bp', f0, 16), total = Math.ceil((dur + 0.3) * SR);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const f = freq(f0, i);
    if (i % 32 === 0) bp.set(f);
    ph += (2 * Math.PI * f) / SR;
    put(i, (bp.run(rnd() * 2 - 1) * 3.4 + Math.sin(ph) * 0.32) * adsr(i / SR, dur, g, n.a ?? 0.07, 0.25, 0.85, 0.4));
  }
}

function render(id: string, seconds: number): Float32Array {
  const def = trackDef(id)!;
  // A battle sample climbs from intensity 0 to 1, so every layer is heard.
  const level = BATTLE_TRACKS.has(id) ? (t: number) => Math.min(1, t / seconds) : () => 0;
  const len = Math.ceil((seconds + 0.5) * SR), dry = new Float32Array(len), wet = new Float32Array(len);
  for (const s of renderTrack(id, seconds, { seed: 1, intensity: level })) {
    for (const n of s.notes) {
      const x = level(n.at);
      if (n.at >= seconds || (n.lay ?? 0) > x || (n.top !== undefined && x >= n.top)) continue;
      play(n, dry, wet, BASE[n.v] * (def.mix?.[n.v] ?? 1), (def.echo ?? 0.3) * SEND[n.v], def.wobble ?? 5, def.spread ?? 7);
    }
  }
  // The shared echo: 0.34 seconds, fed back through a low-pass.
  const D = Math.round(0.34 * SR), line = new Float32Array(len), lp = new Biquad('lp', 2200, 1);
  for (let i = 0; i < len; i++) {
    const l = lp.run(i >= D ? line[i - D] : 0);
    line[i] = wet[i] + 0.36 * l;
    dry[i] += 0.42 * l;
  }
  const fade = Math.round(2.5 * SR);
  for (let i = 0; i < fade; i++) dry[len - 1 - i] *= i / fade;
  return dry;
}

function writeWav(file: string, x: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i] * GAIN));
  const k = peak > 0.97 ? 0.97 / peak : 1;
  const buf = new Uint8Array(44 + x.length * 2), dv = new DataView(buf.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) dv.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.round(x[i] * GAIN * k * 32767))), true);
  fs.writeFileSync(file, buf);
  return peak * k;
}

function main(): void {
  const args = process.argv.slice(2);
  const seconds = args.length && Number.isFinite(Number(args[0])) ? Number(args.shift()) : 40;
  const ids = args.length ? args : DEFAULT;
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of ids) {
    if (!trackDef(id)) { console.log(`no track ${id}`); process.exitCode = 1; continue; }
    const file = path.join(OUT, `${id}.wav`);
    const peak = writeWav(file, render(id, seconds));
    console.log(`${id.padEnd(12)} ${file}  peak ${peak.toFixed(2)}`);
  }
}

main();
