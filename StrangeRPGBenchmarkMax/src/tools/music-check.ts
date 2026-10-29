// Validates Gnomon's score without listening to it. Renders every track symbolically and checks key, range, density,
// pre-notes, repetition, and gaps, then melts every track into every other and checks that no melt passes through
// silence. Also checks battle events, sound effects, voices, script coverage, and that the API never throws in Node.
// Usage: node scripts/build.mjs --tools && node dist-tools/music-check.js [--minutes 10] [--max-seconds 600]
// Progress goes to dist-tools/music-check.progress.json every two seconds. Creating dist-tools/music-check.stop ends
// the run after the job in hand and writes a partial report. The report goes to Notes/music-report.md.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, bridgeNote, figureEvents, meltCurve, meltSeconds, renderTrack, SHADE_GAIN, darkenPitch, type Note, type Rendered } from '../audio/music';
import { PUBLIC_TRACKS, TRACKS } from '../audio/tracks';
import { REGIONS, LEAD_VOICES, darker, inKey, key as mkKey, realize, Rng, type Ev, type Key, type Region, type TrackDef, type Voice } from '../audio/score-core';
import { NODUS_HEAD } from '../audio/motifs';
import { patchLayers, SFX_LIST } from '../audio/sfx';
import { CAST_NAMES, voiceFor } from '../audio/voices';
import * as api from '../audio/index';

const args = process.argv.slice(2);
const argNum = (name: string, def: number) => { const i = args.indexOf(name); return i >= 0 && Number.isFinite(Number(args[i + 1])) ? Number(args[i + 1]) : def; };
const MINUTES = argNum('--minutes', 10);
const MAX_SECONDS = argNum('--max-seconds', 900);
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'dist-tools');
const PROGRESS = path.join(OUT_DIR, 'music-check.progress.json');
const STOP = path.join(OUT_DIR, 'music-check.stop');
const REPORT = path.join(ROOT, 'Notes', 'music-report.md');
fs.mkdirSync(OUT_DIR, { recursive: true });
try { fs.unlinkSync(STOP); } catch { /* no stop file left from before */ }

// ---------------------------------------------------------------- progress and early stop

const started = Date.now();
let lastProgress = 0;
let stopped = '';
const results: { section: string; ok: boolean; line: string }[] = [];

function record(section: string, ok: boolean, line: string): void {
  results.push({ section, ok, line });
}

function progress(phase: string, done: number, total: number, force = false): void {
  const now = Date.now();
  if (!force && now - lastProgress < 2000) return;
  lastProgress = now;
  const elapsed = (now - started) / 1000;
  const rate = done > 0 ? elapsed / done : 0;
  const body = {
    phase, done, total, elapsed: Math.round(elapsed), etaSeconds: Math.round(rate * Math.max(0, total - done)),
    failures: results.filter((r) => !r.ok).length, checks: results.length, partial: !!stopped,
  };
  try { fs.writeFileSync(PROGRESS, JSON.stringify(body, null, 2)); } catch { /* progress is best effort */ }
}

function shouldStop(): boolean {
  if (stopped) return true;
  if (fs.existsSync(STOP)) stopped = 'stop file';
  else if ((Date.now() - started) / 1000 > MAX_SECONDS) stopped = `time limit of ${MAX_SECONDS} s`;
  return !!stopped;
}

// ---------------------------------------------------------------- the loudness model

/** Comfortable range per voice, as MIDI notes. */
const RANGE: Record<Voice, [number, number]> = {
  lead: [43, 91], cold: [52, 96], sq: [48, 90], shade: [43, 96], bell: [55, 103], glass: [57, 106], rev: [55, 103],
  arp: [45, 103], pluck: [38, 92], blip: [57, 108], bass: [26, 62], sub: [22, 52], drone: [26, 74], pad: [43, 88],
  brass: [38, 86], choir: [48, 84], nz: [0, 127],
};

const ATTACK: Partial<Record<Voice, number>> = { lead: 0.03, cold: 0.008, sq: 0.004, shade: 0.03, pad: 0.5, brass: 0.06, choir: 1.2, sub: 0.08, drone: 3, bass: 0.004 };
const RELEASE: Partial<Record<Voice, number>> = { lead: 0.08, cold: 0.05, sq: 0.03, shade: 0.07, pad: 0.16, brass: 0.1, choir: 0.3, sub: 0.08, drone: 0.8, bass: 0.02 };
const NZ_W: Record<string, [number, number]> = {
  kick: [1, 0.09], snare: [0.7, 0.05], taiko: [1, 0.16], tick: [0.25, 0.004], boom: [1, 0.35], hat: [0.35, 0.022], click: [0.3, 0.004],
  wood: [0.5, 0.035], clap: [0.6, 0.05], crash: [0.5, 0.55], clank: [0.6, 0.09], shaker: [0.35, 0.03],
};

/** Loudness of one note at time t, relative to its gain. Mirrors the engine's envelopes closely enough to find gaps. */
function envAt(n: Ev & { at: number; dur: number }, t: number): number {
  const rel = t - n.at;
  if (rel < 0) return 0;
  const v = n.v;
  if (v === 'nz') {
    const kind = n.nz ?? 'tick';
    const w = NZ_W[kind];
    if (w) return w[0] * Math.exp(-rel / w[1]);
    if (kind === 'swell') return rel < n.dur ? 0.7 * (rel / n.dur) : 0;
    if (kind === 'scan') return rel < n.dur ? 0.6 * (1 - Math.abs(rel / n.dur - 0.5) * 2) : 0;
    const a = n.a ?? (kind === 'hiss' ? 2 : kind === 'hum' ? 1 : 0.01);
    const lvl = kind === 'hiss' ? 0.5 : kind === 'hum' ? 0.8 : 0.5;
    if (rel < a) return (lvl * rel) / a;
    if (rel < n.dur) return lvl;
    return lvl * Math.exp(-(rel - n.dur) / 0.4);
  }
  if (v === 'bell' || v === 'glass') return Math.exp(-rel / Math.min(v === 'glass' ? 2.6 : 2, Math.max(0.4, n.dur * 1.5)));
  if (v === 'arp') return rel < n.dur ? Math.exp(-rel / 0.18) : Math.exp(-n.dur / 0.18) * Math.exp(-(rel - n.dur) / 0.03);
  if (v === 'blip') return Math.exp(-rel / 0.07);
  if (v === 'pluck') return Math.exp(-rel / 0.3);
  if (v === 'rev') return rel < n.dur ? Math.pow(1e-4, 1 - rel / n.dur) : Math.exp(-(rel - n.dur) / 0.014);
  const a = n.a ?? ATTACK[v] ?? 0.02;
  const tau = RELEASE[v] ?? 0.1;
  const sustain = v === 'bass' ? 0.72 : 1;
  if (rel < a) return rel / a;
  if (rel < n.dur) return sustain;
  return sustain * Math.exp(-(rel - n.dur) / tau);
}

function noteEnd(n: Ev & { at: number; dur: number }): number {
  if (n.v === 'bell' || n.v === 'glass') return n.at + 6 * Math.min(2.6, Math.max(0.4, n.dur * 1.5));
  if (n.v === 'nz') return n.at + n.dur + 2;
  return n.at + n.dur + 5 * (RELEASE[n.v] ?? 0.3) + 0.4;
}

const HZ = 20;

/** The loudness curve of a list of timed notes, sampled at HZ, scaled by the track's level and mix. */
function loudness(notes: Array<Ev & { at: number; dur: number }>, def: TrackDef, seconds: number, include: (n: Ev) => boolean = () => true): Float64Array {
  const len = Math.ceil(seconds * HZ);
  const pow = new Float64Array(len);
  const level = def.level ?? 1;
  for (const n of notes) {
    if (n.v !== 'nz' && n.v === 'shade' && n.when === 'lamp') continue;
    if (!include(n)) continue;
    const w = (n.v === 'shade' ? 0.6 : 1) * (def.mix?.[n.v] ?? 1) * level * Math.min(1, n.g) * (BASE[n.v] > 0 ? 1 : 0);
    const i0 = Math.max(0, Math.floor(n.at * HZ));
    const i1 = Math.min(len - 1, Math.ceil(noteEnd(n) * HZ));
    for (let i = i0; i <= i1; i++) {
      const e = envAt(n, i / HZ) * w;
      pow[i] += e * e;
    }
  }
  for (let i = 0; i < len; i++) pow[i] = Math.sqrt(pow[i]);
  return pow;
}

/** Hearing averages over a few hundred milliseconds, so levels are smoothed over 0.3 s before looking for dips. */
function smooth(a: ArrayLike<number>, secs = 0.3): Float64Array {
  const half = Math.max(1, Math.round((secs * HZ) / 2));
  const out = new Float64Array(a.length);
  let acc = 0, n = 0;
  const p = (i: number) => a[i] * a[i];
  for (let i = 0; i < Math.min(a.length, half); i++) { acc += p(i); n++; }
  for (let i = 0; i < a.length; i++) {
    const add = i + half, sub = i - half - 1;
    if (add < a.length) { acc += p(add); n++; }
    if (sub >= 0) { acc -= p(sub); n--; }
    out[i] = Math.sqrt(Math.max(0, acc) / Math.max(1, n));
  }
  return out;
}

function median(a: ArrayLike<number>, from = 0): number {
  const s = Array.from(a).slice(from).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function longestBelow(a: ArrayLike<number>, floor: number, from = 0): number {
  let best = 0, run = 0;
  for (let i = from; i < a.length; i++) { if (a[i] < floor) { run++; best = Math.max(best, run); } else run = 0; }
  return best / HZ;
}

// ---------------------------------------------------------------- rendering cases

interface Case { label: string; region: Region; chapter: number; seed: number; intensity: (t: number) => number; lamp: (t: number) => boolean; low: (t: number) => boolean; phase: (t: number) => number }

function casesFor(id: string, seconds: number): Case[] {
  const def = TRACKS[id];
  const base = { intensity: () => 0, lamp: () => false, low: () => false, phase: () => 0 };
  if (def.kind !== 'battle') {
    const out: Case[] = [
      { label: 'chapter 7', region: 'long', chapter: 7, seed: 1, ...base },
      { label: 'chapter 1', region: 'long', chapter: 1, seed: 2, ...base },
    ];
    if (def.shadow === 0 && def.litShadow) out.push({ label: 'lamp lit', region: 'long', chapter: 7, seed: 3, ...base, lamp: () => true });
    return out;
  }
  const rising = (t: number) => Math.min(1, t / (seconds * 0.8));
  const phases = (t: number) => (t < seconds * 0.3 ? 0 : t < seconds * 0.6 ? 1 : 2);
  const regions: readonly Region[] = id === 'boss_final' ? ['lamp'] : REGIONS;
  return regions.flatMap((region, i) => [
    { label: `${region} calm`, region, chapter: 7, seed: 10 + i, ...base },
    { label: `${region} rising`, region, chapter: 7, seed: 20 + i, intensity: rising, lamp: (t: number) => t > seconds * 0.25, low: (t: number) => t > seconds * 0.5, phase: id === 'battle' ? () => 0 : phases },
  ]);
}

function render(id: string, c: Case, seconds: number): Rendered[] {
  return renderTrack(id, seconds, { seed: c.seed, region: c.region, chapter: c.chapter, intensity: c.intensity, lamp: c.lamp, low: c.low, phase: c.phase });
}

/** Notes as the scheduler would play them: filtered by intensity and lamp, and re-spelled at low HP. */
function played(secs: Rendered[], c: Case, def: TrackDef, respell = true): Note[] {
  const out: Note[] = [];
  for (const s of secs) {
    for (const n of s.notes) {
      const lvl = c.intensity(n.at);
      if ((n.lay ?? 0) > lvl || (n.top !== undefined && lvl >= n.top)) continue;
      const litNow = c.lamp(n.at);
      if (n.when === 'lamp' && !litNow) continue;
      if (n.when === 'dark' && litNow) continue;
      if (n.when === 'low' && !c.low(n.at)) continue;
      if (respell && c.low(n.at) && n.v !== 'nz' && !n.x) {
        const target = def.low && n.km.every((x, i) => x === def.key.mode[i]) ? def.low : darker(n.km);
        out.push({ ...n, n: darkenPitch(n.n, n.kr, n.km, target), km: target });
      } else out.push(n);
    }
  }
  return out;
}

// ---------------------------------------------------------------- per-track checks

interface TrackRow {
  id: string; key: string; bpm: number; region: string; shadow: string; cases: number;
  notesPerSec: number; maxPoly: number; range: string; outKey: number; outRange: number; badGain: number;
  pre: string; preOk: boolean; offsets: string; repeats: string; repeatOk: boolean; med: number; gap: number; gapOk: boolean;
  extra: string[];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODE_NAMES: Array<[string, readonly number[]]> = [
  ['ionian', [0, 2, 4, 5, 7, 9, 11]], ['dorian', [0, 2, 3, 5, 7, 9, 10]], ['phrygian', [0, 1, 3, 5, 7, 8, 10]], ['lydian', [0, 2, 4, 6, 7, 9, 11]],
  ['mixolydian', [0, 2, 4, 5, 7, 9, 10]], ['aeolian', [0, 2, 3, 5, 7, 8, 10]], ['locrian', [0, 1, 3, 5, 6, 8, 10]],
];
const keyName = (K: { root: number; mode: readonly number[] }) => `${NOTE_NAMES[((K.root % 12) + 12) % 12]} ${MODE_NAMES.find(([, m]) => m.every((x, i) => x === K.mode[i]))?.[0] ?? 'mode'}`;

const SPARSE = new Set(['glass_quarry', 'lampeater_den', 'overhead_sad', 'tik', 'lead', 'defeat', 'anthelion']);
/** Sections that repeat note for note on purpose. */
const REPEAT_OK = new Set(['defeat:hold', 'credits:c_after', 'lead:figure']);

function checkTrack(id: string, seconds: number): TrackRow {
  const def = TRACKS[id];
  const cases = casesFor(id, seconds);
  let notes = 0, out = 0, outR = 0, badG = 0, maxPoly = 0, lo = 999, hi = 0;
  let leadNotes = 0, covered = 0, missing = 0, lampCovered = 0, unexpected = 0;
  const offsets = new Map<string, number>();
  const extra: string[] = [];
  let worstRepeat = 0, worstName = '';
  let med = 0, gap = 0, dur = 0;
  for (const c of cases) {
    const secs = render(id, c, seconds);
    const total = secs.reduce((a, s) => a + s.secs, 0);
    dur += total;
    const ns = played(secs, c, def);
    // Key, range, and gain.
    for (const n of ns) {
      if (n.v === 'nz') continue;
      if (!n.sh) notes++;
      const [rlo, rhi] = RANGE[n.v];
      if (n.n < rlo || n.n > rhi) { outR++; if (outR <= 3) extra.push(`out of range: ${n.v} ${n.n} at ${n.at.toFixed(1)}s (${c.label})`); }
      lo = Math.min(lo, n.n); hi = Math.max(hi, n.n);
      if (!(n.g > 0 && n.g <= 1)) badG++;
      if (!n.x && !inKey({ root: n.kr, mode: n.km }, n.n)) { out++; if (out <= 3) extra.push(`out of key: ${n.v} ${n.n} in ${keyName({ root: n.kr, mode: n.km })} (${c.label})`); }
    }
    // Pre-notes: every lead note of 0.2 beats or more has a copy at the section's distance, quieter than it.
    const shades = new Map<string, Note[]>();
    for (const n of played(secs, c, def, false)) if (n.sh) { const k = `${n.src}:${Math.round(n.at * 1000)}`; const l = shades.get(k); if (l) l.push(n); else shades.set(k, [n]); }
    for (const s of secs) {
      const spb = 60 / s.bpm;
      const turned = s.notes.some((x) => x.sh && x.when === 'dark') && s.notes.some((x) => x.sh && x.when === 'lamp') && s.shadow !== 0;
      for (const n of s.notes) {
        if (!LEAD_VOICES.has(n.v) || n.sh || n.nos || n.d < 0.2) continue;
        const lvl = c.intensity(n.at);
        if ((n.lay ?? 0) > lvl || (n.top !== undefined && lvl >= n.top)) continue;
        if ((n.when === 'lamp' && !c.lamp(n.at)) || (n.when === 'dark' && c.lamp(n.at))) continue;
        const lit = c.lamp(n.at);
        const dist = s.shadow !== 0 ? s.shadow : lit ? def.litShadow ?? 0 : 0;
        if (dist === 0) continue;
        const want = turned && !lit ? n.at + Math.abs(dist) * spb : n.at - dist * spb;
        // A pre-note that would fall before a lamp changed belongs to the old light, so it is not counted.
        if (want < 0.05 || c.lamp(want) !== lit) continue;
        // Likewise a pre-note that falls before its note's intensity layer opened.
        const lw = c.intensity(want);
        if ((n.lay ?? 0) > lw || (n.top !== undefined && lw >= n.top)) continue;
        leadNotes++;
        const cands = shades.get(`${n.v}:${Math.round(want * 1000)}`) ?? [];
        // Two lines can share a voice (a lamp line over the riff), so the copy nearest the expected level is this note's.
        const want0 = n.g * SHADE_GAIN * (n.d < 0.5 ? 0.7 : 1);
        const exact = cands.filter((x) => x.n === n.n).sort((a, b) => Math.abs(a.g - want0) - Math.abs(b.g - want0))[0];
        const hit = exact ?? cands.find((x) => x.hard);
        if (hit) {
          covered++;
          if (hit.when === 'lamp') lampCovered++;
          if (exact && exact.g > n.g * SHADE_GAIN + 1e-9) extra.push(`pre-note louder than allowed at ${n.at.toFixed(2)}s`);
          const off = turned && !lit ? -Math.abs(dist) : dist;
          offsets.set(String(off), (offsets.get(String(off)) ?? 0) + 1);
        } else { missing++; if (missing <= 3) extra.push(`no pre-note for ${n.v} ${n.n} at ${n.at.toFixed(2)}s (${c.label})`); }
      }
    }
    // With no sun, a track casts no pre-notes at all unless a lamp is lit.
    if (def.shadow === 0) for (const n of ns) if (n.sh && !c.lamp(n.at)) unexpected++;
    // Repetition: identical sections in this case.
    const seen = new Map<string, number>();
    for (const s of secs) {
      const sig = s.name + '|' + s.notes.filter((n) => !n.sh).map((n) => `${n.v}${n.n}@${(n.at - s.start).toFixed(3)}`).join(',');
      const k = (seen.get(sig) ?? 0) + 1;
      seen.set(sig, k);
      if (!REPEAT_OK.has(`${id}:${s.name}`) && k > worstRepeat) { worstRepeat = k; worstName = s.name; }
    }
    // Polyphony and loudness.
    const curve = smooth(loudness(ns, def, Math.max(1, total)));
    med = Math.max(med, median(curve, 2 * HZ));
    const ends = id === 'victory' ? Math.floor((total - 1) * HZ) : curve.length;
    gap = Math.max(gap, longestBelow(Array.from(curve).slice(0, ends), 0.04, Math.round(1.5 * HZ)));
    const active = new Int32Array(curve.length);
    for (const n of ns) {
      const i0 = Math.max(0, Math.floor(n.at * HZ));
      const i1 = Math.min(active.length - 1, Math.floor((n.at + n.dur + Math.min(1.5, 3 * (RELEASE[n.v] ?? 0.1))) * HZ));
      for (let i = i0; i <= i1; i++) active[i]++;
    }
    for (const a of active) maxPoly = Math.max(maxPoly, a);
    // Overhead has no bass at all. The Back has only bass and percussion until a lamp is lit.
    if (def.noBass || (def.kind === 'battle' && c.region === 'overhead')) {
      const low = ns.filter((n) => (n.v === 'bass' || n.v === 'sub' || (n.v !== 'nz' && n.n < 55) || (n.v === 'nz' && (n.nz === 'kick' || n.nz === 'taiko' || n.nz === 'boom'))));
      if (low.length) extra.push(`bass in a track with no bass: ${low.length} notes (${c.label})`);
    }
    if ((def.bassOnly || (def.kind === 'battle' && c.region === 'back') || id === 'dusk') && !c.lamp(0)) {
      const bad = ns.filter((n) => !c.lamp(n.at) && n.v !== 'nz' && n.v !== 'bass' && n.v !== 'sub' && n.v !== 'drone' && !(id === 'dusk' && secs.find((s) => n.at >= s.start && n.at < s.start + s.secs)?.name !== 'dark'));
      if (bad.length) extra.push(`melodic notes in the dark: ${bad.length} (${c.label})`);
    }
  }
  const preOk = unexpected === 0 && missing === 0;
  const repeatOk = worstRepeat <= Math.max(4, Math.ceil(seconds / 150));
  const gapOk = gap < 1.0;
  if (out) extra.unshift(`${out} notes out of key`);
  const nps = notes / Math.max(1, dur);
  if (nps < (SPARSE.has(id) ? 0.1 : 0.4)) extra.push(`sparse: ${nps.toFixed(2)} notes per second`);
  if (nps > 30) extra.push(`dense: ${nps.toFixed(1)} notes per second`);
  if (maxPoly > 64) extra.push(`polyphony ${maxPoly}`);
  return {
    id, key: keyName(def.key), bpm: def.bpm, region: def.region ?? '-', shadow: def.shadow ? `${def.shadow}` : def.litShadow ? `lamp ${def.litShadow}` : 'none',
    cases: cases.length, notesPerSec: nps, maxPoly, range: `${lo}-${hi}`, outKey: out, outRange: outR, badGain: badG,
    pre: def.shadow === 0 && !def.litShadow ? (unexpected ? `${unexpected} unexpected` : 'none, by design') : `${covered}/${leadNotes}` + (lampCovered ? ` (${lampCovered} under a lamp)` : ''),
    preOk, offsets: [...offsets].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '),
    repeats: `${worstRepeat}${worstName ? ` (${worstName})` : ''}`, repeatOk, med, gap, gapOk, extra,
  };
}

// ---------------------------------------------------------------- melts

interface Curve { def: TrackDef; curve: Float64Array; key: Key; med: number; firstKey: Key }
const curveCache = new Map<string, Curve>();

function curveOf(id: string, region: Region, seconds: number, seed: number): Curve {
  const k = `${id}|${region}|${seed}|${seconds}`;
  const hit = curveCache.get(k);
  if (hit) return hit;
  const def = TRACKS[id];
  const c: Case = { label: 'melt', region, chapter: 7, seed, intensity: () => 0, lamp: () => false, low: () => false, phase: () => 0 };
  const secs = render(id, c, seconds);
  const ns = played(secs, c, def);
  const total = Math.max(seconds, secs.reduce((a, s) => a + s.secs, 0));
  const curve = smooth(loudness(ns, def, total));
  const out: Curve = { def, curve, key: secs[0]?.key ?? def.key, firstKey: secs[0]?.key ?? def.key, med: median(curve, 2 * HZ) };
  curveCache.set(k, out);
  return out;
}

/** The key a curve's track is in at time t. */
function keyAt(id: string, region: Region, seed: number, t: number, seconds: number): Key {
  const def = TRACKS[id];
  const c: Case = { label: 'melt', region, chapter: 7, seed, intensity: () => 0, lamp: () => false, low: () => false, phase: () => 0 };
  const secs = render(id, c, Math.min(seconds, t + 1));
  let K = def.key;
  for (const s of secs) if (s.start <= t) K = s.key;
  return K;
}

interface MeltRow { from: string; to: string; secs: number; minRatio: number; ok: boolean; bridgeShared: boolean }

function checkMelt(a: string, b: string, seed: number): MeltRow {
  const A = a === 'none' ? null : TRACKS[a];
  const B = b === 'none' ? null : TRACKS[b];
  const r = new Rng(seed);
  const region: Region = A?.region ?? 'long';
  const M = meltSeconds(A, B);
  const tA = a === 'victory' ? 4.0 : 15 + r.int(40);
  const span = M + 1.5;
  const steps = Math.ceil(span * HZ);
  const ca = A ? curveOf(a, region, tA + span + 2, seed) : null;
  const cb = B ? curveOf(b, B.kind === 'battle' ? region : 'long', span + 4, seed + 1) : null;
  const fromKey = A ? keyAt(a, region, seed, tA, tA + span + 2) : null;
  let bridgeShared = true;
  let bridge: Array<Ev & { at: number; dur: number }> = [];
  if (A && B) {
    const br = bridgeNote(fromKey, B, B.key, M);
    bridgeShared = !!fromKey && inKey(fromKey, br.n) && inKey(B.key, br.n);
    bridge = [{ ...br, at: 0.02, dur: M + 1.2 }];
  }
  // The bridge sounds in both tracks: one copy at the old track's level fading out, one at the new track's fading in.
  const bridgeB = B && bridge.length ? loudness(bridge, B, span + 1) : null;
  const bridgeA = A && bridge.length ? loudness(bridge, A, span + 1) : null;
  let minLevel = Infinity;
  const ref = Math.min(ca?.med ?? Infinity, cb?.med ?? Infinity);
  for (let i = 0; i < steps; i++) {
    const t = i / HZ;
    const x = Math.min(1, t / M);
    const la = ca ? (ca.curve[Math.floor((tA + t) * HZ)] ?? 0) * meltCurve(x, 'out') : 0;
    const lb = cb ? (cb.curve[i] ?? 0) * meltCurve(Math.min(1, t / (A ? M : Math.min(M, 0.8))), 'in') : 0;
    const lbb = bridgeB ? (bridgeB[i] ?? 0) * meltCurve(x, 'in') : 0;
    const lba = bridgeA ? (bridgeA[i] ?? 0) * meltCurve(x, 'out') : 0;
    const total = Math.sqrt(la * la + lb * lb + lbb * lbb + lba * lba);
    // Melting to silence, or starting from it, is allowed to be quiet. Only track to track must never dip.
    if (A && B) minLevel = Math.min(minLevel, total);
  }
  if (!A || !B) return { from: a, to: b, secs: M, minRatio: 1, ok: true, bridgeShared: true };
  const ratio = ref > 0 && Number.isFinite(ref) ? minLevel / ref : 1;
  return { from: a, to: b, secs: M, minRatio: ratio, ok: minLevel >= 0.04 && ratio >= 0.3, bridgeShared };
}

// ---------------------------------------------------------------- battle events

function checkBattleEvents(): string[] {
  const lines: string[] = [];
  for (const region of REGIONS) {
    const c: Case = { label: region, region, chapter: 7, seed: 5, intensity: () => 0.5, lamp: () => false, low: () => false, phase: () => 0 };
    const secs = render('battle', c, 120);
    const lampPads = secs.flatMap((s) => s.notes).filter((n) => n.when === 'lamp' && n.v === 'pad').length;
    const K = secs[1]?.key ?? secs[0].key;
    const sh = secs[1]?.shadow ?? 0;
    const turn = figureEvents('turn', K, Math.max(0, sh));
    const turnOk = turn.length > 0 && turn.every((e) => inKey(K, e.n) || e.v === 'shade');
    const note = figureEvents('note', K, Math.max(0, sh));
    const want = realize(NODUS_HEAD, K, 1).filter((x) => x[0] !== null).map((x) => x[0]);
    const got = note.filter((e) => e.v === 'glass').map((e) => e.n);
    const noteOk = want.length === got.length && want.every((p, i) => p === got[i]) && (sh > 0 ? note.some((e) => e.sh) : !note.some((e) => e.sh));
    const target = darker(K.mode);
    const lowOk = K.mode.every((_, i) => inKey({ root: K.root, mode: target }, darkenPitch(K(i), K.root, K.mode, target)));
    const ok = lampPads > 0 && turnOk && noteOk && lowOk;
    record('battle events', ok, `${region}: lamp layer ${lampPads} pad notes, turned_hit figure ${turnOk ? 'in key' : 'OUT OF KEY'}, note_recorded ${noteOk ? 'plays Nodus\'s first notes' : 'WRONG'}, low_hp ${keyName(K)} to ${keyName({ root: K.root, mode: target })} ${lowOk ? 'stays in key' : 'BREAKS'}`);
    lines.push(region);
  }
  // Boss phases: the final boss walks through its three phases, and the Lampeater's last phase is total dark.
  const fin = renderTrack('boss_final', 240, { seed: 3, phase: (t) => (t < 60 ? 0 : t < 150 ? 1 : 2) });
  const names = [...new Set(fin.map((s) => s.name))].join(', ');
  record('battle events', names.includes('anth') && names.includes('gather') && names.includes('together'), `boss_phase on boss_final: sections ${names}`);
  const dark = renderTrack('boss', 90, { seed: 4, region: 'back', phase: () => 2, lamp: () => true });
  const melodic = dark.flatMap((s) => s.notes).filter((n) => n.v !== 'nz' && n.v !== 'bass' && n.v !== 'sub').length;
  record('battle events', melodic === 0, `boss in the Back, last phase: ${melodic} melodic notes (total dark wants 0)`);
  const turned = renderTrack('boss', 60, { seed: 6, region: 'long' }).flatMap((s) => s.notes).filter((n) => n.sh);
  const after = turned.filter((n) => n.when === 'dark').length, before = turned.filter((n) => n.when === 'lamp').length;
  record('battle events', after > 0 && before > 0, `Grisaille turns leads: ${after} copies after their notes in the dark, ${before} before them under a lamp`);
  const painted = renderTrack('boss', 60, { seed: 7, region: 'market' }).flatMap((s) => s.notes).filter((n) => n.sh && n.hard).length;
  record('battle events', painted > 0, `the Painter paints ${painted} false pre-notes in a minute`);
  // Victory: the sting lands on the tonic of the track it melts back into.
  for (const ret of [mkKey(62, [0, 2, 4, 5, 7, 9, 10]), mkKey(65, [0, 2, 3, 5, 7, 9, 10]), mkKey(67, [0, 2, 4, 5, 7, 9, 11])]) {
    const v = renderTrack('victory', 10, { ret });
    const ok = v.length === 1 && v[0].end === true && v[0].key.root === ret.root;
    record('battle events', ok, `victory before ${keyName(ret)}: sting in ${keyName(v[0].key)}, ends ${v[0].end ? 'yes' : 'no'}`);
  }
  return lines;
}

// ---------------------------------------------------------------- effects, voices, script, API

const BRIEF_SFX = [
  'page', 'pen', 'pen_stop', 'pin', 'lamp_light', 'lamp_out', 'hood', 'bar_slide', 'nail', 'brush', 'thud', 'coin', 'glare', 'crack',
  'shatter', 'chalk', 'fade', 'clamp', 'tick', 'crunch', 'join', 'hum_rise', 'beam_turn', 'glass_chime', 'step_stone', 'step_grass',
  'step_sand', 'step_glass', 'step_wood', 'bump', 'door', 'menu_move', 'menu_ok', 'menu_back', 'menu_bad', 'save', 'item_get',
  'level_up', 'battle_start', 'hit', 'strong_hit', 'guard_hit', 'miss', 'heal', 'enemy_die', 'party_down', 'pebble_throw',
  'pebble_land', 'lamp_move', 'lead_swing', 'shade_raise', 'pane_set', 'pane_replay', 'tug', 'slip', 'stab', 'note_mark',
  'note_record', 'beam_sweep', 'heat_tick', 'sticks_place', 'sticks_flip', 'sticks_win', 'sticks_lose', 'letter_open',
  'chapter_card', 'emote',
];

function checkSfx(): void {
  const missing = BRIEF_SFX.filter((n) => !SFX_LIST.includes(n));
  record('effects', missing.length === 0, `every effect in the brief exists (${SFX_LIST.length} patches)${missing.length ? `, missing: ${missing.join(', ')}` : ''}`);
  let bad = 0;
  const peaks: Array<[string, number, number]> = [];
  for (const name of SFX_LIST) {
    let longest = 0, peak = 0;
    for (let s = 0; s < 30; s++) {
      const r = new Rng(1000 + s * 7919 + name.length);
      const layers = patchLayers(name, () => r.next()) ?? [];
      for (const L of layers) {
        const nums = [L.f ?? 440, L.f2 ?? 440, L.d, L.g, L.at ?? 0, L.lp ?? 1000, L.bp ?? 1000, L.hp ?? 1000];
        if (!nums.every(Number.isFinite) || L.d <= 0 || L.d > 3 || L.g <= 0 || L.g > 1.2 || (L.at ?? 0) < 0 || (L.f ?? 440) < 20 || (L.f ?? 440) > 18000) bad++;
        longest = Math.max(longest, (L.at ?? 0) + L.d);
      }
      // A rough peak: the summed gain of layers sounding in the first 50 ms.
      peak = Math.max(peak, layers.filter((L) => (L.at ?? 0) < 0.05).reduce((a, L) => a + L.g, 0));
      if (layers.length > 48) bad++;
    }
    peaks.push([name, longest, peak]);
  }
  record('effects', bad === 0, `every patch builds valid layers across 30 random calls each (${bad} problems)`);
  const longest = peaks.reduce((a, p) => (p[1] > a[1] ? p : a));
  record('effects', longest[1] <= 3.5, `longest effect: ${longest[0]} at ${longest[1].toFixed(2)} s`);
  const loud = peaks.filter((p) => p[2] > 2.2);
  record('effects', loud.length === 0, `no effect stacks more than 2.2 of gain at its attack${loud.length ? `: ${loud.map((p) => p[0]).join(', ')}` : ''} (strong_hit ${peaks.find((p) => p[0] === 'strong_hit')?.[2].toFixed(2)}, hit ${peaks.find((p) => p[0] === 'hit')?.[2].toFixed(2)})`);
  // Footsteps and pebbles never repeat exactly.
  for (const name of ['step_stone', 'step_grass', 'step_sand', 'step_glass', 'step_wood', 'pebble_land']) {
    const r = new Rng(77);
    const sigs = new Set<string>();
    for (let k = 0; k < 12; k++) sigs.add(JSON.stringify((patchLayers(name, () => r.next()) ?? []).map((L) => [L.f, L.bp, L.lp, L.hp, L.pan])));
    record('effects', sigs.size === 12, `${name}: 12 calls give ${sigs.size} different sounds`);
  }
}

function checkVoices(): void {
  const profiles = CAST_NAMES.map((n) => voiceFor(n)!);
  const sigs = new Set(profiles.map((v) => `${v.w}|${v.base}|${v.len}`));
  record('voices', sigs.size === profiles.length, `${profiles.length} cast voices, all distinct`);
  const traits: Array<[string, boolean]> = [
    ['Nodus dry and short', voiceFor('Nodus')!.room === 0 && voiceFor('Nodus')!.len <= 0.04],
    ['Parhelia low and warm with gravel', voiceFor('Parhelia')!.base < 55 && (voiceFor('Parhelia')!.grit ?? 0) > 0],
    ['Lot high, airy, ahead of the text', voiceFor('Lot')!.base > 74 && !!voiceFor('Lot')!.early && (voiceFor('Lot')!.air ?? 0) > 0],
    ['Umbraculum big with wide vibrato', (voiceFor('Umbraculum')!.vib?.[1] ?? 0) >= 40 && (voiceFor('Umbraculum')!.wide ?? 0) > 0],
    ['Minim glassy with a reversed tail', voiceFor('Minim')!.w === 'fm' && !!voiceFor('Minim')!.rev],
    ['Tik clicky and close', (voiceFor('Tik')!.click ?? 0) > 0 && voiceFor('Tik')!.room === 0],
    ['Anthelion flat precise square', voiceFor('Anthelion')!.w === 'square' && !!voiceFor('Anthelion')!.fixed],
    ['Tib small and quick', voiceFor('Tib')!.len < 0.035 && voiceFor('Tib')!.base > 70],
    ['Grisaille nasal and clipped', !!voiceFor('Grisaille')!.bp && !!voiceFor('Grisaille')!.clip],
    ['the Painter smeary with sliding pitch', !!voiceFor('Painter')!.slide && !!voiceFor('The Painter')!.slide],
  ];
  for (const [label, ok] of traits) record('voices', ok, label);
  const same = JSON.stringify(voiceFor('Quarle')) === JSON.stringify(voiceFor('Quarle')) && JSON.stringify(voiceFor('Old Hum')) === JSON.stringify(voiceFor('Hum'));
  record('voices', same, 'hashed voices are the same for the same name every time');
  const silent = ['', 'Narration', 'system', '(note)'].every((n) => voiceFor(n) === null);
  record('voices', silent, 'narration and system lines are silent');
}

function scriptNames(): { music: Set<string>; sfx: Set<string>; speakers: Set<string> } {
  const dir = path.join(ROOT, 'src', 'script');
  const out = { music: new Set<string>(), sfx: new Set<string>(), speakers: new Set<string>() };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.txt')) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
      const m = /^>\s*music\s+([a-z_]+)/.exec(line);
      if (m) out.music.add(m[1]);
      const s = /^>\s*sfx\s+([a-z_]+)/.exec(line);
      if (s) out.sfx.add(s[1]);
      const sp = /^([A-Z][A-Za-z' .{}]*):\s/.exec(line);
      if (sp) out.speakers.add(sp[1]);
    }
  }
  return out;
}

function checkScript(): void {
  const s = scriptNames();
  const badMusic = [...s.music].filter((m) => m !== 'none' && !(PUBLIC_TRACKS as readonly string[]).includes(m));
  const badSfx = [...s.sfx].filter((m) => !SFX_LIST.includes(m));
  record('script', badMusic.length === 0, `${s.music.size} music names in src/script all exist${badMusic.length ? `, missing: ${badMusic.join(', ')}` : ''}`);
  record('script', badSfx.length === 0, `${s.sfx.size} sound names in src/script all exist${badSfx.length ? `, missing: ${badSfx.join(', ')}` : ''}`);
  const mute = [...s.speakers].filter((n) => voiceFor(n) === null);
  record('script', mute.length === 0, `${s.speakers.size} speakers in src/script all have voices${mute.length ? `, silent: ${mute.join(', ')}` : ''}`);
}

function checkApi(): void {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
  let threw = '';
  try {
    api.initAudio(); api.initAudio();
    api.setVolumes(8, 8, 7); api.setVolumes(NaN, 99, -3);
    for (const t of [...api.TRACK_NAMES, 'none', 'no_such_track', 'no_such_track']) api.playMusic(t);
    for (const n of [...api.SFX_NAMES, 'no_such_sound', 'no_such_sound']) api.sfx(n, { pitch: 1.2, pan: -0.5, vol: 1 });
    api.sfx('hit', { pitch: -3 });
    for (const sp of ['Nodus', 'Parhelia', '', 'Someone New']) for (const ch of 'Hi, there!') api.voice(sp, ch);
    for (const e of ['lamp_on', 'lamp_off', 'turned_hit', 'low_hp', 'calm', 'victory', 'defeat', 'boss_phase', 'note_recorded', 'no_such_event', 'no_such_event']) api.battleEvent(e as api.BattleEvent);
    api.setBattleIntensity(0.5); api.setBattleIntensity(Infinity);
    api.setRegion('glass'); api.setRegion(null); api.setRegion('nowhere' as Region);
    api.setChapter(5); api.setMuted(true); api.setMuted(false);
    void api.musicFinished(); void api.currentTrack();
  } catch (e) { threw = String(e); }
  console.warn = orig;
  record('api', !threw, threw ? `the API threw in Node: ${threw}` : 'every API call runs in Node without an AudioContext and never throws');
  const unknown = warns.filter((w) => w.includes('no_such') || w.includes('nowhere'));
  record('api', unknown.length === 4, `unknown names log once each: ${unknown.length} warnings for 4 distinct unknown names`);
  const brief = ['title', 'home', 'stile', 'lead', 'wake', 'parhelia', 'gully', 'road', 'market', 'lot', 'underbridge', 'bright', 'solehold', 'relay_tower', 'glass', 'minim', 'glass_quarry', 'overhead', 'overhead_sad', 'first_mirror', 'dusk', 'tik', 'burrow', 'back_road', 'lampeater_den', 'stile_dark', 'office_tower', 'anthelion', 'battle', 'boss', 'boss_final', 'victory', 'sticks', 'epilogue', 'credits'];
  const missing = brief.filter((t) => !TRACKS[t]);
  record('api', missing.length === 0, `all ${brief.length} tracks in the brief exist${missing.length ? `, missing: ${missing.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------- main

function fmt(x: number, d = 2): string { return x.toFixed(d); }

async function main(): Promise<void> {
  const ids = [...PUBLIC_TRACKS, 'defeat'];
  const seconds = MINUTES * 60;
  const pairs: Array<[string, string]> = [];
  for (const a of [...PUBLIC_TRACKS, 'none']) for (const b of [...PUBLIC_TRACKS, 'none']) if (a !== b) pairs.push([a, b]);
  const total = ids.length + pairs.length + 5;
  let done = 0;
  const rows: TrackRow[] = [];
  for (const id of ids) {
    if (shouldStop()) break;
    progress(`track ${id}`, done, total);
    const row = checkTrack(id, id === 'victory' ? 10 : seconds);
    rows.push(row);
    const ok = row.outKey === 0 && row.outRange === 0 && row.badGain === 0 && row.preOk && row.repeatOk && row.gapOk && !row.extra.some((e) => e.startsWith('bass in') || e.startsWith('melodic notes in the dark'));
    record('tracks', ok, `${id}: ${ok ? 'pass' : 'FAIL'}${row.extra.length ? ` (${row.extra.slice(0, 4).join('; ')})` : ''}`);
    done++;
  }
  const melts: MeltRow[] = [];
  for (let i = 0; i < pairs.length; i++) {
    if (i % 20 === 0 && shouldStop()) break;
    progress('melts', done, total);
    melts.push(checkMelt(pairs[i][0], pairs[i][1], 100 + i));
    done++;
  }
  if (!shouldStop()) { checkBattleEvents(); done++; }
  if (!shouldStop()) { checkSfx(); done++; }
  if (!shouldStop()) { checkVoices(); done++; }
  if (!shouldStop()) { checkScript(); done++; }
  if (!shouldStop()) { checkApi(); done++; }
  progress('report', done, total, true);
  const failedMelts = melts.filter((m) => !m.ok);
  const sharedMiss = melts.filter((m) => !m.bridgeShared && m.from !== 'none' && m.to !== 'none').length;
  if (melts.length) {
    record('melts', failedMelts.length === 0, `${melts.length} melts checked between every pair of tracks and silence, ${failedMelts.length} dip below 30 percent of the quieter track`);
    const worst = melts.filter((m) => m.from !== 'none' && m.to !== 'none').sort((a, b) => a.minRatio - b.minRatio).slice(0, 5);
    record('melts', true, `lowest points: ${worst.map((m) => `${m.from} to ${m.to} ${Math.round(m.minRatio * 100)}%`).join(', ')}`);
    record('melts', true, `bridge tone shared by both keys in ${melts.length - sharedMiss - melts.filter((m) => m.from === 'none' || m.to === 'none').length} of ${melts.filter((m) => m.from !== 'none' && m.to !== 'none').length} track-to-track melts (the rest use the new track's tonic)`);
  }
  writeReport(rows, melts, done, total);
  progress('done', done, total, true);
  const fails = results.filter((r) => !r.ok);
  console.log(`music-check: ${results.length - fails.length}/${results.length} checks pass${stopped ? ` (partial: ${stopped})` : ''}. Report: ${path.relative(ROOT, REPORT)}`);
  for (const f of fails.slice(0, 30)) console.log(`  FAIL ${f.section}: ${f.line}`);
  process.exitCode = fails.length ? 1 : 0;
}

function writeReport(rows: TrackRow[], melts: MeltRow[], done: number, total: number): void {
  const L: string[] = [];
  const fails = results.filter((r) => !r.ok).length;
  L.push('# Music check report', '');
  L.push(`Generated by \`node dist-tools/music-check.js\` on ${new Date().toISOString().slice(0, 10)}. ${results.length - fails} of ${results.length} checks pass.`);
  if (stopped) L.push('', `This report is partial: the run stopped early (${stopped}) after ${done} of ${total} jobs.`);
  L.push('', 'The check renders each track symbolically, the way the scheduler would play it, and models each voice\'s envelope to estimate loudness. It cannot hear the result, so the loudness numbers are relative estimates. Levels measured from real audio in a browser are in the Levels section of `Notes/music.md`.', '');
  L.push(`Each track renders for ${MINUTES} minutes per case. Place and scene tracks render in chapter 1 and chapter 7, and tracks with no sun render once more under a lit lamp. Battle tracks render in every region twice: calm, and with intensity rising, a lamp lit after a quarter of the run, low HP after half, and boss phases stepping.`, '');
  L.push('## Tracks', '');
  L.push('| Track | Key | BPM | Region | Pre-notes | Notes/s | Max poly | Range | Out of key | Pre-notes found | Distances (beats:count) | Max repeats | Median level | Longest gap (s) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    L.push(`| ${r.id} | ${r.key} | ${r.bpm} | ${r.region} | ${r.shadow} | ${fmt(r.notesPerSec, 1)} | ${r.maxPoly} | ${r.range} | ${r.outKey} | ${r.pre}${r.preOk ? '' : ' FAIL'} | ${r.offsets || '-'} | ${r.repeats}${r.repeatOk ? '' : ' FAIL'} | ${fmt(r.med)} | ${fmt(r.gap)}${r.gapOk ? '' : ' FAIL'} |`);
  }
  const notes = rows.filter((r) => r.extra.length);
  if (notes.length) {
    L.push('', 'Notes from the track checks:', '');
    for (const r of notes) L.push(`- ${r.id}: ${r.extra.slice(0, 5).join('; ')}`);
  }
  L.push('', '## Melts', '');
  L.push(`A melt starts the new track at once on an equal-power curve while the old one fades on the matching curve, closes its filter, and sags a little in pitch. A held bridge tone that both keys share sounds through the melt. The check melts each track into every other track and into silence (${melts.length} melts) at a random point 15 to 55 seconds in, and finds the quietest moment of each melt as a share of the quieter track's median level. A melt fails below 30 percent.`, '');
  const worst = melts.filter((m) => m.from !== 'none' && m.to !== 'none').sort((a, b) => a.minRatio - b.minRatio).slice(0, 10);
  L.push('| From | To | Melt (s) | Quietest point | Bridge tone shared |', '|---|---|---|---|---|');
  for (const m of worst) L.push(`| ${m.from} | ${m.to} | ${fmt(m.secs, 1)} | ${Math.round(m.minRatio * 100)}% | ${m.bridgeShared ? 'yes' : 'no'} |`);
  const titles: Record<string, string> = {
    tracks: 'Track results', melts: 'Melt results', 'battle events': 'Battle events', effects: 'Effects', voices: 'Voices', script: 'Script coverage', api: 'The API in Node',
  };
  for (const section of Object.keys(titles)) {
    const rs = results.filter((r) => r.section === section);
    if (!rs.length) continue;
    L.push('', `## ${titles[section]}`, '');
    for (const r of rs) L.push(`- ${r.ok ? 'Pass' : 'FAIL'}: ${r.line}`);
  }
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, L.join('\n') + '\n');
}

void main();
