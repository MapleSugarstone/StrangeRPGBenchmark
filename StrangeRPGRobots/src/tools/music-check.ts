// Validates Fathom's score without listening to it. Checks that every track and effect name in the contract resolves,
// renders every track symbolically and checks key, range, density, reflections, repetition, and gaps, then melts
// every track into every other and checks that no melt passes through silence. Also checks combat events, the boss
// mechanics, sound effects, voices, script coverage, and that the API never throws in Node.
// Usage: node scripts/build.mjs --tools && node dist-tools/music-check.js [--minutes 10] [--max-seconds 900]
// Progress goes to dist-tools/music-check.progress.json every two seconds. Creating dist-tools/music-check.stop ends
// the run after the job in hand and writes a partial report. The report goes to dist-tools/music-report.md.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, bridgeNote, combatIntensity, darkenPitch, figureEvents, meltCurve, meltSeconds, renderTrack, WET_GAIN, type Note, type Rendered } from '../audio/music';
import { INTERNAL_TRACKS, TRACKS } from '../audio/tracks';
import { REGIONS, LEAD_VOICES, darker, inKey, key as mkKey, Rng, type Ev, type Key, type Region, type TrackDef, type Voice } from '../audio/score-core';
import { patchLayers, SFX_LIST } from '../audio/effects';
import { isPort, timbreFor } from '../audio/voices';
import { SPEAKERS, PORT_SPEAKER } from '../content/speakers';
import '../audio/engine';
import * as api from '../audio/sfx';

const args = process.argv.slice(2);
const argNum = (name: string, def: number) => { const i = args.indexOf(name); return i >= 0 && Number.isFinite(Number(args[i + 1])) ? Number(args[i + 1]) : def; };
const MINUTES = argNum('--minutes', 10);
const MAX_SECONDS = argNum('--max-seconds', 900);
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'dist-tools');
const PROGRESS = path.join(OUT_DIR, 'music-check.progress.json');
const STOP = path.join(OUT_DIR, 'music-check.stop');
const REPORT = path.join(OUT_DIR, 'music-report.md');
fs.mkdirSync(OUT_DIR, { recursive: true });
try { fs.unlinkSync(STOP); } catch { /* no stop file left from before */ }

const PUBLIC = api.TRACK_NAMES.filter((t) => t !== 'none') as string[];

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
  lead: [43, 91], cold: [43, 96], sq: [48, 90], wet: [31, 84], bell: [55, 103], glass: [57, 106], rev: [55, 103],
  arp: [45, 103], pluck: [38, 92], blip: [57, 108], bass: [26, 62], sub: [22, 52], drone: [26, 74], pad: [43, 88],
  brass: [31, 86], choir: [45, 84], nz: [0, 127],
};

const ATTACK: Partial<Record<Voice, number>> = { lead: 0.03, cold: 0.008, sq: 0.004, wet: 0.04, pad: 0.5, brass: 0.06, choir: 1.2, sub: 0.08, drone: 3, bass: 0.004 };
const RELEASE: Partial<Record<Voice, number>> = { lead: 0.08, cold: 0.05, sq: 0.03, wet: 0.12, pad: 0.16, brass: 0.1, choir: 0.3, sub: 0.08, drone: 0.8, bass: 0.02 };
const NZ_W: Record<string, [number, number]> = {
  kick: [1, 0.09], snare: [0.7, 0.05], taiko: [1, 0.16], tick: [0.25, 0.004], boom: [1, 0.35], hat: [0.35, 0.022], click: [0.3, 0.004],
  wood: [0.5, 0.035], clap: [0.6, 0.05], crash: [0.5, 0.55], clank: [0.6, 0.09], shaker: [0.35, 0.03], drip: [0.6, 0.035], stomp: [1.2, 0.42],
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
    if (kind === 'slosh' || kind === 'breath') return rel < n.dur ? 0.5 * (1 - Math.abs(rel / n.dur - 0.45) * 2) : 0;
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
function loudness(notes: Array<Ev & { at: number; dur: number }>, def: TrackDef, seconds: number): Float64Array {
  const len = Math.ceil(seconds * HZ);
  const pow = new Float64Array(len);
  const level = def.level ?? 1;
  for (const n of notes) {
    const w = (n.v === 'wet' ? 0.6 : 1) * (def.mix?.[n.v] ?? 1) * level * Math.min(1, n.g) * (BASE[n.v] > 0 ? 1 : 0);
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

interface Case {
  label: string; region: Region; seed: number;
  intensity: (t: number) => number; enemy: (t: number) => boolean; low: (t: number) => boolean; phase: (t: number) => number; kills: (t: number) => number;
}

function casesFor(id: string, seconds: number): Case[] {
  const def = TRACKS[id];
  const base = { intensity: () => 0, enemy: () => false, low: () => false, phase: () => 0, kills: () => 0 };
  if (def.kind !== 'battle') return [{ label: 'seed 1', region: 'deeps', seed: 1, ...base }, { label: 'seed 2', region: 'deeps', seed: 2, ...base }];
  const boss = id === 'boss';
  // A fight as the game would report it: turns of about twenty seconds, a kill every forty, low HP in the second half.
  const enemy = (t: number) => Math.floor(t / 20) % 2 === 1;
  const kills = (t: number) => Math.floor(t / 40);
  const low = (t: number) => t > seconds * 0.5 && t < seconds * 0.8;
  const phase = (t: number) => (!boss ? 0 : t < seconds * 0.3 ? 0 : t < seconds * 0.6 ? 1 : 2);
  const rising = (t: number) => combatIntensity({ boss, rounds: Math.floor(t / 40), kills: kills(t), enemy: enemy(t), low: low(t), phase: phase(t) });
  return REGIONS.flatMap((region, i) => [
    { label: `${region} calm`, region, seed: 10 + i, ...base, intensity: () => (boss ? 0.32 : 0.18) },
    { label: `${region} fight`, region, seed: 20 + i, intensity: rising, enemy, low, phase, kills },
  ]);
}

function render(id: string, c: Case, seconds: number): Rendered[] {
  return renderTrack(id, seconds, { seed: c.seed, region: c.region, intensity: c.intensity, low: c.low, phase: c.phase, kills: c.kills });
}

/** Notes as the scheduler would play them: filtered by intensity and turn, and re-spelled at low HP. */
function played(secs: Rendered[], c: Case, def: TrackDef, respell = true): Note[] {
  const out: Note[] = [];
  const battle = def.kind === 'battle';
  for (const s of secs) {
    for (const n of s.notes) {
      const lvl = c.intensity(n.at);
      if ((n.lay ?? 0) > lvl || (n.top !== undefined && lvl >= n.top)) continue;
      const foe = battle && c.enemy(n.at);
      if (n.when === 'party' && foe) continue;
      if (n.when === 'enemy' && !foe) continue;
      if (n.when === 'low' && !c.low(n.at)) continue;
      if (respell && battle && c.low(n.at) && n.v !== 'nz' && !n.x) {
        const target = def.low && n.km.every((x, i) => x === def.key.mode[i]) ? def.low : darker(n.km);
        out.push({ ...n, n: darkenPitch(n.n, n.kr, n.km, target), km: target });
      } else out.push(n);
    }
  }
  return out;
}

// ---------------------------------------------------------------- per-track checks

interface TrackRow {
  id: string; key: string; bpm: number; region: string; reflect: string; cases: number;
  notesPerSec: number; maxPoly: number; range: string; outKey: number; outRange: number; badGain: number;
  wet: string; wetOk: boolean; repeats: string; repeatOk: boolean; med: number; gap: number; gapOk: boolean;
  extra: string[];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODE_NAMES: Array<[string, readonly number[]]> = [
  ['ionian', [0, 2, 4, 5, 7, 9, 11]], ['dorian', [0, 2, 3, 5, 7, 9, 10]], ['phrygian', [0, 1, 3, 5, 7, 8, 10]], ['lydian', [0, 2, 4, 6, 7, 9, 11]],
  ['mixolydian', [0, 2, 4, 5, 7, 9, 10]], ['aeolian', [0, 2, 3, 5, 7, 8, 10]], ['locrian', [0, 1, 3, 5, 6, 8, 10]],
];
const keyName = (K: { root: number; mode: readonly number[] }) => `${NOTE_NAMES[((K.root % 12) + 12) % 12]} ${MODE_NAMES.find(([, m]) => m.every((x, i) => x === K.mode[i]))?.[0] ?? 'mode'}`;

const SPARSE = new Set(['ferries', 'sad', 'tense', 'defeat', 'flood', 'clinic']);
/** Sections that repeat note for note on purpose. */
const REPEAT_OK = new Set(['defeat:hold', 'crown:vault', 'sad:still', 'farm:naptime', 'ending:dawn']);

function checkTrack(id: string, seconds: number): TrackRow {
  const def = TRACKS[id];
  const cases = casesFor(id, seconds);
  let notes = 0, out = 0, outR = 0, badG = 0, maxPoly = 0, lo = 999, hi = 0;
  let leads = 0, covered = 0, missing = 0, unexpected = 0;
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
      if (!n.rf) notes++;
      const [rlo, rhi] = RANGE[n.v];
      if (n.n < rlo || n.n > rhi) { outR++; if (outR <= 3) extra.push(`out of range: ${n.v} ${n.n} at ${n.at.toFixed(1)}s (${c.label})`); }
      lo = Math.min(lo, n.n); hi = Math.max(hi, n.n);
      if (!(n.g > 0 && n.g <= 1)) badG++;
      if (!n.x && !inKey({ root: n.kr, mode: n.km }, n.n)) { out++; if (out <= 3) extra.push(`out of key: ${n.v} ${n.n} in ${keyName({ root: n.kr, mode: n.km })} (${c.label})`); }
    }
    // Reflections: every lead note of 0.2 beats or more has a darker copy behind it at the section's distance.
    const wets = new Map<string, Note[]>();
    for (const s of secs) for (const n of s.notes) if (n.rf) { const k = `${n.src}:${Math.round(n.at * 1000)}`; const l = wets.get(k); if (l) l.push(n); else wets.set(k, [n]); }
    for (const s of secs) {
      const spb = 60 / s.bpm;
      for (const n of s.notes) {
        if (n.rf && s.reflect === 0) unexpected++;
        if (!LEAD_VOICES.has(n.v) || n.rf || n.nor || n.d < 0.2 || s.reflect === 0) continue;
        leads++;
        const want = n.at + s.reflect * spb;
        const cands = wets.get(`${n.v}:${Math.round(want * 1000)}`) ?? [];
        const pitch = n.n >= 60 ? n.n - 12 : n.n;
        const hit = cands.find((x) => x.n === pitch && x.when === n.when);
        if (hit) {
          covered++;
          if (hit.g > n.g * WET_GAIN + 1e-9) extra.push(`reflection louder than allowed at ${n.at.toFixed(2)}s`);
        } else { missing++; if (missing <= 3) extra.push(`no reflection for ${n.v} ${n.n} at ${n.at.toFixed(2)}s (${c.label})`); }
      }
    }
    // Repetition: identical sections in this case.
    const seen = new Map<string, number>();
    for (const s of secs) {
      const sig = s.name + '|' + s.notes.filter((n) => !n.rf).map((n) => `${n.v}${n.n}@${(n.at - s.start).toFixed(3)}`).join(',');
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
  }
  const wetOk = unexpected === 0 && missing === 0;
  const repeatOk = worstRepeat <= Math.max(4, Math.ceil(seconds / 150));
  const gapOk = gap < 1.0;
  if (out) extra.unshift(`${out} notes out of key`);
  const nps = notes / Math.max(1, dur);
  if (nps < (SPARSE.has(id) ? 0.1 : 0.4)) extra.push(`sparse: ${nps.toFixed(2)} notes per second`);
  if (nps > 30) extra.push(`dense: ${nps.toFixed(1)} notes per second`);
  if (maxPoly > 64) extra.push(`polyphony ${maxPoly}`);
  return {
    id, key: keyName(def.key), bpm: def.bpm, region: def.region ?? '-', reflect: def.reflect ? `${def.reflect}` : 'dry',
    cases: cases.length, notesPerSec: nps, maxPoly, range: `${lo}-${hi}`, outKey: out, outRange: outR, badGain: badG,
    wet: def.reflect === 0 && def.kind !== 'battle' ? (unexpected ? `${unexpected} unexpected` : 'none, by design') : `${covered}/${leads}`,
    wetOk, repeats: `${worstRepeat}${worstName ? ` (${worstName})` : ''}`, repeatOk, med, gap, gapOk, extra,
  };
}

// ---------------------------------------------------------------- melts

interface Curve { def: TrackDef; curve: Float64Array; med: number }
const curveCache = new Map<string, Curve>();
const calm: Omit<Case, 'label' | 'region' | 'seed'> = { intensity: () => 0, enemy: () => false, low: () => false, phase: () => 0, kills: () => 0 };

function curveOf(id: string, region: Region, seconds: number, seed: number): Curve {
  const k = `${id}|${region}|${seed}|${seconds}`;
  const hit = curveCache.get(k);
  if (hit) return hit;
  const def = TRACKS[id];
  const c: Case = { label: 'melt', region, seed, ...calm };
  const secs = render(id, c, seconds);
  const ns = played(secs, c, def);
  const total = Math.max(seconds, secs.reduce((a, s) => a + s.secs, 0));
  const curve = smooth(loudness(ns, def, total));
  const out: Curve = { def, curve, med: median(curve, 2 * HZ) };
  curveCache.set(k, out);
  return out;
}

/** The key a track is in at time t. */
function keyAt(id: string, region: Region, seed: number, t: number): Key {
  const def = TRACKS[id];
  const secs = render(id, { label: 'melt', region, seed, ...calm }, t + 1);
  let K = def.key;
  for (const s of secs) if (s.start <= t) K = s.key;
  return K;
}

interface MeltRow { from: string; to: string; secs: number; minRatio: number; ok: boolean; bridgeShared: boolean }

function checkMelt(a: string, b: string, seed: number): MeltRow {
  const A = a === 'none' ? null : TRACKS[a];
  const B = b === 'none' ? null : TRACKS[b];
  if (!A || !B) return { from: a, to: b, secs: meltSeconds(A, B), minRatio: 1, ok: true, bridgeShared: true };
  const r = new Rng(seed);
  const region: Region = A.region ?? 'deeps';
  const M = meltSeconds(A, B);
  const tA = 15 + r.int(40);
  const span = M + 1.5;
  const steps = Math.ceil(span * HZ);
  const ca = curveOf(a, region, tA + span + 2, seed);
  const cb = curveOf(b, B.kind === 'battle' ? region : 'deeps', span + 4, seed + 1);
  const fromKey = keyAt(a, region, seed, tA);
  const br = bridgeNote(fromKey, B.key, M);
  const bridgeShared = inKey(fromKey, br.n) && inKey(B.key, br.n);
  const bridge = [{ ...br, at: 0.02, dur: M + 1.2 }];
  // The bridge sounds in both tracks: one copy at the old track's level fading out, one at the new track's fading in.
  const bridgeB = loudness(bridge, B, span + 1);
  const bridgeA = loudness(bridge, A, span + 1);
  let minLevel = Infinity;
  const ref = Math.min(ca.med, cb.med);
  for (let i = 0; i < steps; i++) {
    const t = i / HZ;
    const x = Math.min(1, t / M);
    const la = (ca.curve[Math.floor((tA + t) * HZ)] ?? 0) * meltCurve(x, 'out');
    const lb = (cb.curve[i] ?? 0) * meltCurve(x, 'in');
    const lbb = (bridgeB[i] ?? 0) * meltCurve(x, 'in');
    const lba = (bridgeA[i] ?? 0) * meltCurve(x, 'out');
    minLevel = Math.min(minLevel, Math.sqrt(la * la + lb * lb + lbb * lbb + lba * lba));
  }
  const ratio = ref > 0 && Number.isFinite(ref) ? minLevel / ref : 1;
  return { from: a, to: b, secs: M, minRatio: ratio, ok: minLevel >= 0.04 && ratio >= 0.3, bridgeShared };
}

// ---------------------------------------------------------------- combat events and bosses

function checkCombat(): void {
  for (const region of REGIONS) {
    const c: Case = { label: region, region, seed: 5, ...calm, intensity: () => 0.5 };
    const secs = render('combat', c, 120);
    const all = secs.flatMap((s) => s.notes);
    const party = all.filter((n) => n.when === 'party' && LEAD_VOICES.has(n.v)).length;
    const foe = all.filter((n) => n.when === 'enemy' && n.v !== 'nz').length;
    const K = secs[1]?.key ?? secs[0].key;
    const figs = (['kill', 'party', 'enemy'] as const).map((k) => figureEvents(k, K));
    const figOk = figs.every((f) => f.length > 0 && f.every((e) => e.v === 'nz' || inKey(K, e.n)));
    const target = darker(K.mode);
    const lowOk = K.mode.every((_, i) => inKey({ root: K.root, mode: target }, darkenPitch(K(i), K.root, K.mode, target)));
    const heart = all.filter((n) => n.when === 'low').length;
    record('combat', party > 0 && foe > 0 && figOk && lowOk && heart > 0, `${region}: party riff ${party} notes, enemy layer ${foe} notes, kill/turn figures ${figOk ? 'in key' : 'OUT OF KEY'}, low_hp ${keyName(K)} to ${keyName({ root: K.root, mode: target })} ${lowOk ? 'stays in key' : 'BREAKS'}, heartbeat ${heart} hits`);
  }
  const steps = [
    combatIntensity({ boss: false, rounds: 0, kills: 0, enemy: false, low: false, phase: 0 }),
    combatIntensity({ boss: false, rounds: 4, kills: 1, enemy: false, low: false, phase: 0 }),
    combatIntensity({ boss: false, rounds: 6, kills: 3, enemy: true, low: false, phase: 0 }),
    combatIntensity({ boss: false, rounds: 8, kills: 3, enemy: true, low: true, phase: 0 }),
    combatIntensity({ boss: true, rounds: 10, kills: 4, enemy: true, low: true, phase: 3 }),
  ];
  const rising = steps.every((x, i) => i === 0 || x > steps[i - 1]);
  record('combat', rising, `intensity climbs through a fight: ${steps.map((x) => x.toFixed(2)).join(', ')}`);
  // Mother Sieve: the pedal climbs and her line thins.
  const sieve = renderTrack('boss', 120, { seed: 3, region: 'deeps' });
  const pedals = sieve.map((s) => s.notes.find((n) => n.v === 'drone' && n.at - s.start < 0.01)?.n ?? -1);
  const climbs = pedals.slice(1, 6).filter((p, i) => p > pedals[i]).length;
  record('bosses', climbs >= 4, `Mother Sieve's lock fills: pedal ${pedals.slice(0, 7).join(' ')}`);
  // The Dowser: her copy of the riff trails it, and the gap closes with each phase.
  const lags = [0, 1, 2].map((ph) => {
    const s = renderTrack('boss', 30, { seed: 4, region: 'stair', phase: () => ph })[0];
    const lead = s.notes.find((n) => n.v === 'lead' && !n.rf);
    const cold = s.notes.find((n) => n.v === 'cold' && !n.rf);
    return lead && cold ? Math.round(((cold.at - lead.at) * s.bpm) / 60 * 100) / 100 : -1;
  });
  record('bosses', lags[0] > lags[1] && lags[1] > lags[2] && lags[2] > 0, `the Dowser follows the riff by ${lags.join(', ')} beats in phases 0, 1, 2`);
  // Teun: no tonic chord until phase 2, then exactly one figure that lands on the tonic.
  const teun = renderTrack('boss', 200, { seed: 6, region: 'brim', phase: (t) => (t < 60 ? 0 : t < 120 ? 1 : 2) });
  const K = teun[0].key;
  let tonicBefore = 0, saidI = 0;
  for (const s of teun) {
    const roots = s.notes.filter((n) => n.v === 'sub' && !n.when);
    if (s.start >= 60 && s.start < 120) for (const n of roots) if (((n.n - K.root) % 12 + 12) % 12 === 0) tonicBefore++;
    const sq = s.notes.filter((n) => n.v === 'sq' && !n.rf && n.d >= 1.5 && s.start >= 120);
    for (const n of sq) if (((n.n - K.root) % 12 + 12) % 12 === 0) saidI++;
  }
  record('bosses', tonicBefore === 0 && saidI === 1, `Teun never plays the tonic chord in phase 1 (${tonicBefore} tonic roots) and says "I" once in phase 2 (${saidI})`);
  const warden = renderTrack('boss', 40, { seed: 7, region: 'brim' }).flatMap((s) => s.notes).filter((n) => n.when === 'enemy' && n.x && n.v !== 'nz').length;
  record('bosses', warden > 0, `the Warden's anger: ${warden} enemy notes a tritone off`);
  // Victory: the sting lands on the tonic of the track it melts back into.
  for (const ret of [mkKey(57, [0, 2, 3, 5, 7, 8, 10]), mkKey(68, [0, 2, 4, 6, 7, 9, 11]), mkKey(62, [0, 2, 4, 5, 7, 9, 11])]) {
    const v = renderTrack('victory', 10, { ret });
    const ok = v.length === 1 && v[0].end === true && v[0].key.root === ret.root;
    record('combat', ok, `victory before ${keyName(ret)}: sting in ${keyName(v[0].key)}, ends ${v[0].end ? 'yes' : 'no'}`);
  }
}

// ---------------------------------------------------------------- effects, voices, script, API

function checkNames(): void {
  const badTracks = api.TRACK_NAMES.filter((t) => t !== 'none' && !TRACKS[t]);
  record('names', badTracks.length === 0, `all ${api.TRACK_NAMES.length} names in TRACK_NAMES resolve${badTracks.length ? `, missing: ${badTracks.join(', ')}` : ''}`);
  const badSfx = api.SFX_NAMES.filter((n) => !SFX_LIST.includes(n));
  record('names', badSfx.length === 0, `all ${api.SFX_NAMES.length} names in SFX_NAMES resolve${badSfx.length ? `, missing: ${badSfx.join(', ')}` : ''}`);
  const spare = SFX_LIST.filter((n) => !(api.SFX_NAMES as readonly string[]).includes(n));
  record('names', spare.length === 0, `no effect exists outside the contract${spare.length ? `: ${spare.join(', ')}` : ''}`);
  const internal = INTERNAL_TRACKS.every((t) => !!TRACKS[t]);
  record('names', internal, `internal tracks exist: ${INTERNAL_TRACKS.join(', ')}`);
}

function checkSfx(): void {
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
      if (layers.length > 64) bad++;
    }
    peaks.push([name, longest, peak]);
  }
  record('effects', bad === 0, `every patch builds valid layers across 30 random calls each (${bad} problems)`);
  const longest = peaks.reduce((a, p) => (p[1] > a[1] ? p : a));
  record('effects', longest[1] <= 3.5, `longest effect: ${longest[0]} at ${longest[1].toFixed(2)} s`);
  const loud = peaks.filter((p) => p[2] > 2.4);
  record('effects', loud.length === 0, `no effect stacks more than 2.4 of gain at its attack${loud.length ? `: ${loud.map((p) => p[0]).join(', ')}` : ''}`);
  // Footsteps and dice never repeat exactly.
  for (const name of ['step', 'dice', 'dissipate']) {
    const r = new Rng(77);
    const sigs = new Set<string>();
    for (let k = 0; k < 12; k++) sigs.add(JSON.stringify((patchLayers(name, () => r.next()) ?? []).map((L) => [L.f, L.bp, L.lp, L.hp, L.pan, L.at])));
    record('effects', sigs.size === 12, `${name}: 12 calls give ${sigs.size} different sounds`);
  }
  // The four guns differ in length and weight.
  const sig = (n: string) => { const l = patchLayers(n, () => 0.5) ?? []; return `${l.length}|${Math.max(...l.map((x) => (x.at ?? 0) + x.d)).toFixed(2)}`; };
  const guns = ['pistol', 'smg', 'shotgun', 'rifle'].map(sig);
  record('effects', new Set(guns).size === 4, `pistol, smg, shotgun, and rifle are distinct patches (${guns.join(', ')})`);
}

function checkVoices(): void {
  const fam = [0, 1, 2, 3].map((w) => timbreFor({ pitch: 200, wave: w, rate: 1 }).family);
  record('voices', new Set(fam).size === 4, `the four waves give four timbres: ${fam.join(', ')}`);
  const portT = timbreFor(PORT_SPEAKER.voice);
  record('voices', isPort(PORT_SPEAKER.voice) && portT.family === 'port' && !!portT.rev && !!portT.ring, `the port's voice (pitch ${PORT_SPEAKER.voice.pitch}, wave ${PORT_SPEAKER.voice.wave}) is alien: ${portT.family}, reversed tail, ring edge`);
  const sp = Object.entries(SPEAKERS);
  const sigs = new Map<string, string[]>();
  for (const [id, s] of sp) {
    const k = `${s.voice.pitch}|${s.voice.wave}|${s.voice.rate}`;
    sigs.set(k, [...(sigs.get(k) ?? []), id]);
  }
  const same = [...sigs.values()].filter((l) => l.length > 1);
  record('voices', same.length === 0, `${sp.length} speakers have ${sigs.size} distinct voices${same.length ? `, shared: ${same.map((l) => l.join('/')).join(', ')}` : ''}`);
  const portLike = sp.filter(([, s]) => isPort(s.voice)).map(([id]) => id);
  record('voices', portLike.length === 0, `no speaker but the port gets the port's voice${portLike.length ? `: ${portLike.join(', ')}` : ''}`);
}

function scriptNames(): { music: Set<string>; sfx: Set<string> } {
  const dir = path.join(ROOT, 'src', 'script');
  const out = { music: new Set<string>(), sfx: new Set<string>() };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.txt')) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
      const m = /^>\s*music\s+([a-z_]+)/.exec(line);
      if (m) out.music.add(m[1]);
      const s = /^>\s*sfx\s+([a-z_]+)/.exec(line);
      if (s) out.sfx.add(s[1]);
    }
  }
  return out;
}

function checkScript(): void {
  const s = scriptNames();
  const badMusic = [...s.music].filter((m) => m !== 'none' && !TRACKS[m]);
  const badSfx = [...s.sfx].filter((m) => !SFX_LIST.includes(m));
  record('script', badMusic.length === 0, `${s.music.size} music names in src/script all exist${badMusic.length ? `, missing: ${badMusic.join(', ')}` : ''}`);
  record('script', badSfx.length === 0, `${s.sfx.size} sound names in src/script all exist${badSfx.length ? `, missing: ${badSfx.join(', ')}` : ''}`);
}

function checkApi(): void {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
  let threw = '';
  try {
    api.initAudio(); api.initAudio();
    api.setVolumes(8, 8, 7); api.setVolumes(NaN, 99, -3);
    for (const t of [...api.TRACK_NAMES, 'no_such_track', 'no_such_track']) api.playMusic(t);
    for (const n of [...api.SFX_NAMES, 'no_such_sound', 'no_such_sound']) api.sfx(n, { pitch: 1.2, pan: -0.5, vol: 1 });
    api.sfx('hit', { pitch: -3 });
    for (const v of [...Object.values(SPEAKERS).map((s) => s.voice), PORT_SPEAKER.voice, undefined, { pitch: NaN, wave: 9, rate: 0 }]) api.blip(v);
    for (const e of ['start', 'party_turn', 'enemy_turn', 'low_hp', 'kill', 'boss_phase', 'victory', 'end', 'defeat', 'end', 'no_such_event', 'no_such_event']) api.combatEvent(e as api.CombatEvent);
  } catch (e) { threw = String(e); }
  console.warn = orig;
  record('api', !threw, threw ? `the API threw in Node: ${threw}` : 'every API call runs in Node without an AudioContext and never throws');
  const unknown = warns.filter((w) => w.includes('no_such'));
  record('api', unknown.length === 3, `unknown names log once each: ${unknown.length} warnings for 3 distinct unknown names`);
}

// ---------------------------------------------------------------- main

function fmt(x: number, d = 2): string { return x.toFixed(d); }

async function main(): Promise<void> {
  const ids = [...PUBLIC, ...INTERNAL_TRACKS];
  const seconds = MINUTES * 60;
  const pairs: Array<[string, string]> = [];
  for (const a of [...PUBLIC, 'none']) for (const b of [...PUBLIC, 'none']) if (a !== b) pairs.push([a, b]);
  const total = ids.length + pairs.length + 6;
  let done = 0;
  checkNames(); done++;
  const rows: TrackRow[] = [];
  for (const id of ids) {
    if (shouldStop()) break;
    progress(`track ${id}`, done, total);
    const row = checkTrack(id, id === 'victory' ? 10 : seconds);
    rows.push(row);
    const ok = row.outKey === 0 && row.outRange === 0 && row.badGain === 0 && row.wetOk && row.repeatOk && row.gapOk;
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
  if (!shouldStop()) { checkCombat(); done++; }
  if (!shouldStop()) { checkSfx(); done++; }
  if (!shouldStop()) { checkVoices(); done++; }
  if (!shouldStop()) { checkScript(); done++; }
  if (!shouldStop()) { checkApi(); done++; }
  progress('report', done, total, true);
  const failedMelts = melts.filter((m) => !m.ok);
  const tt = melts.filter((m) => m.from !== 'none' && m.to !== 'none');
  if (melts.length) {
    record('melts', failedMelts.length === 0, `${melts.length} melts checked between every pair of tracks and silence, ${failedMelts.length} dip below 30 percent of the quieter track${failedMelts.length ? `: ${failedMelts.slice(0, 6).map((m) => `${m.from}>${m.to}`).join(', ')}` : ''}`);
    const worst = [...tt].sort((a, b) => a.minRatio - b.minRatio).slice(0, 5);
    record('melts', true, `lowest points: ${worst.map((m) => `${m.from} to ${m.to} ${Math.round(m.minRatio * 100)}%`).join(', ')}`);
    record('melts', true, `bridge tone shared by both keys in ${tt.filter((m) => m.bridgeShared).length} of ${tt.length} track-to-track melts (the rest use the new track's tonic)`);
  }
  writeReport(rows, melts, done, total);
  progress('done', done, total, true);
  const fails = results.filter((r) => !r.ok);
  console.log(`music-check: ${results.length - fails.length}/${results.length} checks pass${stopped ? ` (partial: ${stopped})` : ''}. Report: ${path.relative(ROOT, REPORT)}`);
  for (const f of fails.slice(0, 40)) console.log(`  FAIL ${f.section}: ${f.line}`);
  process.exitCode = fails.length ? 1 : 0;
}

function writeReport(rows: TrackRow[], melts: MeltRow[], done: number, total: number): void {
  const L: string[] = [];
  const fails = results.filter((r) => !r.ok).length;
  L.push('# Music check report', '');
  L.push(`Generated by \`node dist-tools/music-check.js\` on ${new Date().toISOString().slice(0, 10)}. ${results.length - fails} of ${results.length} checks pass.`);
  if (stopped) L.push('', `This report is partial: the run stopped early (${stopped}) after ${done} of ${total} jobs.`);
  L.push('', 'The check renders each track symbolically, the way the scheduler would play it, and models each voice\'s envelope to estimate loudness. It cannot hear the result, so the loudness numbers are relative estimates.', '');
  L.push(`Each track renders for ${MINUTES} minutes per case. Place and scene tracks render with two seeds. Battle tracks render in every district twice: calm, and as a fight with turns of about twenty seconds, a kill every forty, low HP from half to four fifths of the run, and boss phases stepping.`, '');
  L.push('## Tracks', '');
  L.push('| Track | Key | BPM | District | Reflection | Notes/s | Max poly | Range | Out of key | Reflections found | Max repeats | Median level | Longest gap (s) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    L.push(`| ${r.id} | ${r.key} | ${r.bpm} | ${r.region} | ${r.reflect} | ${fmt(r.notesPerSec, 1)} | ${r.maxPoly} | ${r.range} | ${r.outKey} | ${r.wet}${r.wetOk ? '' : ' FAIL'} | ${r.repeats}${r.repeatOk ? '' : ' FAIL'} | ${fmt(r.med)} | ${fmt(r.gap)}${r.gapOk ? '' : ' FAIL'} |`);
  }
  const notes = rows.filter((r) => r.extra.length);
  if (notes.length) {
    L.push('', 'Notes from the track checks:', '');
    for (const r of notes) L.push(`- ${r.id}: ${r.extra.slice(0, 5).join('; ')}`);
  }
  L.push('', '## Melts', '');
  L.push(`The check melts each track into every other track and into silence (${melts.length} melts) at a random point 15 to 55 seconds in, and finds the quietest moment of each melt as a share of the quieter track's median level. A melt fails below 30 percent.`, '');
  const worst = melts.filter((m) => m.from !== 'none' && m.to !== 'none').sort((a, b) => a.minRatio - b.minRatio).slice(0, 10);
  L.push('| From | To | Melt (s) | Quietest point | Bridge tone shared |', '|---|---|---|---|---|');
  for (const m of worst) L.push(`| ${m.from} | ${m.to} | ${fmt(m.secs, 1)} | ${Math.round(m.minRatio * 100)}% | ${m.bridgeShared ? 'yes' : 'no'} |`);
  const titles: Record<string, string> = {
    names: 'Names', tracks: 'Track results', melts: 'Melt results', combat: 'Combat events', bosses: 'Boss mechanics', effects: 'Effects', voices: 'Voices', script: 'Script coverage', api: 'The API in Node',
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
