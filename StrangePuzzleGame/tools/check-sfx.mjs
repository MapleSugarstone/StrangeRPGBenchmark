// Validates the sound effects in src/core.js without audio. It loads core.js in a Node sandbox with a stub AudioContext
// that records every node, then plays every effect and speech blip in every key and checks levels, pitches, and mute.
// Usage: node tools/check-sfx.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = fs.readFileSync(path.join(root, 'src', 'core.js'), 'utf8');

/** The loudest any one voice may be. */
const MAX_VOICE = 0.1;
/** The loudest the voices of one effect may add up to at any instant. */
const MAX_SUM = 0.2;
const OSC_HZ = [25, 6000];
const FILTER_HZ = [100, 12000];
/** Oscillators at or above this pitch in a pitched effect must sit on the key's scale. Lower ones are thuds. */
const PITCHED_FROM = 250;
const NAMES = [
  'step', 'bump', 'pick', 'drop', 'zap', 'compile', 'fizzle', 'spot', 'roll', 'smash', 'fill', 'tick', 'boom', 'hit', 'hurt', 'huskdie',
  'push', 'undo', 'select', 'ok', 'back', 'chip', 'aim', 'fire', 'pop', 'glint', 'shatter', 'swap', 'overclock', 'clank', 'eat', 'turn',
  'hunt', 'print', 'carry', 'door', 'bosstel', 'slam', 'bossstep', 'hire', 'bosshit', 'phase', 'bossdie', 'stack', 'beam',
  'bossturn', 'bossdrive', 'bossfall', 'flip', 'keycard', 'enter', 'slide', 'cook', 'grease', 'portal', 'pay', 'relink', 'bosswarp',
  'spray', 'sprout', 'grow', 'shove', 'sow', 'toggle', 'split', 'bossfire', 'reboot',
  'jump', 'pull', 'park', 'magnets', 'crumble', 'crack', 'boing', 'wind',
];
const CARDS = ['red', 'blue', 'yellow', 'gold', 'silver', 'green', 'violet', 'white', 'black', 'copper', 'pearl', 'rainbow'];
/** Telegraphs with cues of their own beyond the Manager's, which play every turn of their bosses' fights. */
const TELS = ['grease', 'charge', 'relink', 'warp', 'sow', 'spray', 'fire', 'reboot', 'park', 'magnets', 'crack', 'spring', 'wind'];
const CALLS = [
  ['step'], ['bump'], ['pick', 0], ['pick', 1], ['pick', 2], ['drop', 0], ['drop', 1], ['drop', 2], ['zap'],
  ['compile', 'ram'], ['compile', 'fork'], ['compile', 'brick'], ['fizzle'], ['spot'], ['roll'], ['smash'], ['fill'],
  ['tick', 2], ['tick', 1], ['tick', undefined], ['boom'], ['hit'], ['hurt'], ['huskdie'], ['push'], ['undo'], ['select'],
  ['ok'], ['back'], ['chip'], ['aim'], ['fire'], ['pop'], ['glint'], ['shatter'], ['swap'], ['overclock'], ['clank'], ['eat'],
  ['turn'], ['hunt'], ['print'], ['carry'], ['door', true], ['door', false], ['bosstel', 'slam'], ['bosstel', 'step'],
  ['bosstel', 'hire'], ['bosstel', 'wait'], ...TELS.map((k) => ['bosstel', k]), ['bosstel', 'beam'], ['slam'], ['bossstep'], ['hire'], ['bosshit'], ['phase'], ['bossdie'],
  ['stack'], ['beam'], ['bossturn'], ['bossdrive'], ['bossfall'], ['flip'], ...CARDS.map((c) => ['keycard', c]), ['enter'],
  ['slide'], ['cook'], ['grease'], ['portal'], ['pay'], ['relink', 1], ['relink', 0], ['relink', undefined], ['bosswarp'],
  ['spray'], ['sprout'], ['grow'], ['shove'], ['sow'], ['toggle', 1], ['toggle', 0], ['split'], ['bossfire'], ['reboot'],
  ['jump'], ['pull'], ['park'], ['magnets'], ['crumble'], ['crack'], ['boing'], ['wind'],
];
const PITCHED = new Set([
  'pick', 'drop', 'compile', 'spot', 'tick', 'huskdie', 'undo', 'select', 'ok', 'back', 'aim', 'chip', 'fire', 'glint', 'shatter', 'swap',
  'overclock', 'eat', 'turn', 'hunt', 'carry', 'door', 'bosstel', 'hire', 'bosshit', 'phase', 'bossdie', 'beam', 'bossfall',
  'flip', 'keycard', 'enter', 'cook', 'grease', 'portal', 'pay', 'relink', 'bosswarp', 'sprout', 'grow', 'toggle', 'split', 'bossfire', 'reboot', 'jump', 'park', 'boing', 'wind',
]);
/** Effects that can sound every turn, or on every tile of a slide, and the most each may add up to. */
const GENTLE = { carry: 0.025, cook: 0.035, slide: 0.035, portal: 0.035, spray: 0.02, grow: 0.035, split: 0.035, jump: 0.035, boing: 0.035, pull: 0.02, 'toggle(1)': 0.035, 'toggle(0)': 0.035, ...Object.fromEntries(TELS.map((k) => [`bosstel(${k})`, 0.035])) };
/** The most a whole run of slides or portals in one turn may add up to, overlaps included. */
const GENTLE_RUN = 0.04;
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
/** Each place the game can be, as the area passed to Sound.setArea, the track playing, and the key effects should use. */
const PLACES = [
  { name: 'Lobby', area: 0, track: 'area0', key: [58, MAJOR] },
  { name: 'Sales Floor', area: 1, track: 'area1', key: [60, [0, 2, 3, 5, 7, 8, 11]] },
  { name: 'Back Rooms', area: 2, track: 'area2', key: [61, [0, 1, 3, 5, 7, 8, 10]] },
  { name: 'Display Hall', area: 3, track: 'area3', key: [64, [0, 2, 4, 6, 7, 9, 11]] },
  { name: 'Loss Prevention', area: 4, track: 'area4', key: [66, [0, 2, 3, 5, 7, 8, 10]] },
  { name: 'Shipping', area: 5, track: 'area5', key: [62, [0, 2, 3, 5, 7, 9, 10]] },
  { name: 'Head Office', area: 6, track: 'area6', key: [63, MAJOR] },
  { name: 'Overtime', area: 7, track: 'area7', key: [56, MAJOR] },
  { name: 'Overtime rematch', area: 7, track: 'postboss', key: [63, MAJOR] },
  { name: 'Food Court', area: 8, track: 'area8', key: [65, MAJOR] },
  { name: 'Fry Cook fight', area: 8, track: 'boss', key: [63, MAJOR] },
  { name: 'Arcade', area: 9, track: 'area9', key: [57, DORIAN] },
  { name: 'High Score fight', area: 9, track: 'boss', key: [63, MAJOR] },
  { name: 'Garden Center', area: 10, track: 'area10', key: [59, MIXOLYDIAN] },
  { name: 'Gardener fight', area: 10, track: 'boss', key: [63, MAJOR] },
  { name: 'Server Room', area: 11, track: 'area11', key: [55, HARMONIC_MINOR] },
  { name: 'Mainframe fight', area: 11, track: 'boss', key: [63, MAJOR] },
  { name: 'Parking Garage', area: 12, track: 'area12', key: [63, AEOLIAN] },
  { name: 'Cinema', area: 13, track: 'area13', key: [62, HARMONIC_MINOR] },
  { name: 'Toy Store', area: 14, track: 'area14', key: [61, MAJOR] },
  { name: 'Jack fight', area: 14, track: 'boss', key: [63, MAJOR] },
  { name: 'Atrium', area: 15, track: 'area15', key: [62, PHRYGIAN] },
  { name: 'Static fight', area: 15, track: 'final', key: [63, MAJOR] },
  { name: 'ending', area: 15, track: 'ending', key: [62, MAJOR] },
  { name: 'After Hours', area: 16, track: 'area16', key: [55, MAJOR] },
  { name: 'title', area: null, track: 'title', key: [62, MAJOR] },
  { name: 'map after the Sales Floor', area: 1, track: 'title', key: [62, MAJOR] },
  { name: 'boss fight', area: 6, track: 'boss', key: [63, MAJOR] },
  { name: 'boss fight set in another area', area: 2, track: 'boss', key: [63, MAJOR] },
];
/** Places whose keys differ, so a scale run must differ between each two of them. */
const DISTINCT = ['Lobby', 'Sales Floor', 'Back Rooms', 'Display Hall', 'Loss Prevention', 'Shipping', 'Head Office', 'Overtime', 'Food Court', 'Arcade', 'Garden Center', 'Server Room', 'Parking Garage', 'Cinema', 'Toy Store', 'Atrium', 'After Hours', 'title'];
const C_MAJOR = [60, MAJOR];

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };

// ---------------------------------------------------------------- a stub Web Audio graph

let created = [];
const contexts = [];
class Param {
  constructor(v) { this.v = v; this.v0 = v; this.events = []; }
  get value() { return this.v; }
  set value(x) { this.v = x; if (!this.events.length) this.v0 = x; this.add('value', x, 0); }
  setValueAtTime(v, t) { this.add('at', v, t); }
  linearRampToValueAtTime(v, t) { this.add('lin', v, t); }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError(`exponential ramp to ${v}`);
    this.add('exp', v, t);
  }
  setTargetAtTime(v, t) { this.add('target', v, t); }
  setValueCurveAtTime(curve, t, d) {
    for (const e of this.events) if (e.t > t && e.t < t + d) throw new Error('a value curve overlaps another event');
    this.add('curve', Math.max(...curve), t, { d, min: Math.min(...curve), curve: Array.from(curve) });
  }
  cancelScheduledValues() {}
  add(k, v, t, x = {}) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error(`${k} with value ${v} at ${t}`);
    this.events.push({ k, v, t, ...x });
  }
  /** Every value the param takes, or its default when nothing was scheduled. */
  values() { return this.events.length ? this.events.map((e) => e.v) : [this.v]; }
  /** The value at time x, following steps, linear and exponential ramps, and value curves. */
  at(x) {
    let pt = -Infinity, pv = this.v0;
    for (const e of this.events) {
      if (e.k === 'curve') {
        if (x < e.t) return pv;
        if (x <= e.t + e.d) {
          const c = e.curve, u = ((x - e.t) / e.d) * (c.length - 1), i = Math.floor(u);
          return i >= c.length - 1 ? c[c.length - 1] : c[i] + (c[i + 1] - c[i]) * (u - i);
        }
        pt = e.t + e.d; pv = e.curve[e.curve.length - 1];
      } else if (e.k === 'lin' || e.k === 'exp') {
        if (x < e.t) {
          if (x <= pt) return pv;
          const u = (x - pt) / (e.t - pt);
          return e.k === 'lin' ? pv + (e.v - pv) * u : pv * Math.pow(e.v / pv, u);
        }
        pt = e.t; pv = e.v;
      } else {
        if (x < e.t) return pv;
        pt = e.t; pv = e.v;
      }
    }
    return pv;
  }
}
class Node {
  constructor(kind) { this.kind = kind; this.outs = []; created.push(this); }
  connect(d) { this.outs.push(d); return d; }
  disconnect() { this.outs = []; }
}
class Source extends Node {
  constructor(kind) { super(kind); this.started = null; this.stopped = null; }
  start(t = 0) { this.started = t; }
  stop(t = 0) { this.stopped = t; }
}
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = new Node('destination'); contexts.push(this); }
  createGain() { const n = new Node('gain'); n.gain = new Param(1); return n; }
  createOscillator() { const n = new Source('osc'); n.type = 'sine'; n.frequency = new Param(440); n.detune = new Param(0); return n; }
  createBufferSource() { const n = new Source('noise'); n.buffer = null; n.loop = false; return n; }
  createBiquadFilter() { const n = new Node('filter'); n.type = 'lowpass'; n.frequency = new Param(350); n.Q = new Param(1); return n; }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length, sampleRate, getChannelData: () => data };
  }
  resume() { return Promise.resolve(); }
}

function load() {
  const sb = { console, AudioContext: Ctx, Music: null };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(CORE, sb, { filename: 'src/core.js' });
  return sb;
}

/** Runs fn and returns the nodes it created. Each call is a new turn, a second after the last one. */
function record(fn, sameTurn = false) {
  created = [];
  fn();
  const out = created;
  created = [];
  if (!sameTurn) for (const c of contexts) c.currentTime += 1;
  return out;
}

const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
function inKey(f, key) {
  const m = midiOf(f), r = Math.round(m);
  return Math.abs(m - r) < 0.05 && key[1].includes((((r - key[0]) % 12) + 12) % 12);
}

/** Follows a node's connections and returns true when they reach `to`. */
function reaches(n, to, seen = new Set()) {
  if (n === to) return true;
  if (seen.has(n)) return false;
  seen.add(n);
  return n.outs.some((o) => reaches(o, to, seen));
}

/** Checks the nodes one effect made and returns its voices as {start, end, peak, type, freqs}. */
function inspect(where, nodes, sb, key, pitchedFrom) {
  const voices = [];
  for (const n of nodes) {
    if (n.kind === 'filter') {
      for (const f of n.frequency.values()) if (f < FILTER_HZ[0] || f > FILTER_HZ[1]) fail(`${where}: filter at ${f.toFixed(0)} Hz`);
      continue;
    }
    if (n.kind !== 'osc' && n.kind !== 'noise') continue;
    if (n.started === null || n.stopped === null) { fail(`${where}: a ${n.kind} never starts or never stops`); continue; }
    if (n.stopped - n.started > 3 || n.stopped <= n.started) fail(`${where}: a ${n.kind} runs ${(n.stopped - n.started).toFixed(2)} s`);
    if (!reaches(n, sb.Sound.bus)) fail(`${where}: a ${n.kind} never reaches Sound.bus`);
    // The envelope is the first gain node on the way out.
    let env = n, hops = 0;
    while (env && env.kind !== 'gain' && hops++ < 6) env = env.outs[0];
    if (!env || env.kind !== 'gain') { fail(`${where}: a ${n.kind} has no envelope`); continue; }
    const gains = env.gain.values();
    const peak = Math.max(...gains);
    if (peak > MAX_VOICE + 1e-6) fail(`${where}: a ${n.kind} voice peaks at ${peak.toFixed(3)}`);
    if (Math.min(...gains) < 0) fail(`${where}: a negative gain`);
    if (env.gain.at(n.started - 1e-4) !== 0) fail(`${where}: a ${n.kind} gate is open before its voice starts, so its first sample can click`);
    const v = { start: n.started, end: n.stopped - 0.03, peak, env: env.gain, type: n.kind === 'osc' ? n.type : 'noise', freqs: [] };
    if (n.kind === 'osc') {
      v.freqs = n.frequency.values();
      for (const f of v.freqs) if (f < OSC_HZ[0] || f > OSC_HZ[1]) fail(`${where}: a ${n.type} at ${f.toFixed(0)} Hz`);
      if (n.type === 'square' || n.type === 'sawtooth') {
        const lp = n.outs[0];
        if (!lp || lp.kind !== 'filter' || lp.type !== 'lowpass') fail(`${where}: a ${n.type} has no low-pass`);
      }
      if (pitchedFrom !== null) for (const f of v.freqs) if (f >= pitchedFrom && !inKey(f, key)) fail(`${where}: ${f.toFixed(1)} Hz is off the key`);
    }
    voices.push(v);
  }
  return voices;
}

/** The loudest the voices' envelopes add up to at any instant, sampled every millisecond. */
function sumPeak(voices) {
  if (!voices.length) return 0;
  const from = Math.min(...voices.map((v) => v.start)), to = Math.max(...voices.map((v) => v.end));
  let best = 0;
  for (let x = from; x <= to; x += 0.001) {
    let s = 0;
    for (const v of voices) if (v.start <= x && x < v.end + 0.03) s += v.env.at(x);
    best = Math.max(best, s);
  }
  return best;
}

// ---------------------------------------------------------------- effects

console.log('Effects (every call in every place, four times each)');
const sb = load();
for (const n of NAMES) if (typeof sb.SFX[n] !== 'function' && !Array.isArray(sb.SFX[n])) fail(`SFX.${n} is missing`);
{
  const before = record(() => { for (const [n, a] of CALLS) sb.sfx(n, a); sb.Sound.talk('a', 'TILDE'); });
  if (before.length) fail('effects make nodes before the AudioContext exists');
}
sb.Sound.unlock();
if (!sb.Sound.ctx || !reaches(sb.Sound.bus, sb.Sound.master) || !reaches(sb.Sound.master, sb.Sound.ctx.destination)) fail('Sound.bus does not pass through Sound.master to the speakers');

const stats = new Map();
const freqsByPlace = new Map();
for (const place of PLACES) {
  sb.Sound.setArea(place.area);
  sb.Music = { current: () => place.track, setMuted() {} };
  for (const [name, arg] of CALLS) {
    const label = arg === undefined ? name : `${name}(${arg})`;
    const key = name === 'chip' ? C_MAJOR : place.key;
    for (let rep = 0; rep < 4; rep++) {
      let nodes;
      try { nodes = record(() => sb.sfx(name, arg)); } catch (e) { fail(`${label} in the ${place.name} throws ${e.message}`); continue; }
      const voices = inspect(`${label} in the ${place.name}`, nodes, sb, key, PITCHED.has(name) ? PITCHED_FROM : null);
      if (!voices.length) fail(`${label} in the ${place.name} makes no sound`);
      const s = stats.get(label) ?? { voices: 0, peak: 0, sum: 0, lo: Infinity, hi: 0 };
      s.voices = Math.max(s.voices, voices.length);
      s.peak = Math.max(s.peak, ...voices.map((v) => v.peak));
      s.sum = Math.max(s.sum, sumPeak(voices));
      for (const v of voices) for (const f of v.freqs) { s.lo = Math.min(s.lo, f); s.hi = Math.max(s.hi, f); }
      stats.set(label, s);
      if (name === 'phase' && rep === 0) freqsByPlace.set(place.name, voices.filter((v) => v.type === 'square').map((v) => v.freqs[0].toFixed(0)).join(' '));
      if (name === 'tick' && rep === 0) stats.get(label).tick = { n: voices.length, f: voices[0].freqs[0], gap: voices.length > 1 ? voices[1].start - voices[0].start : 0 };
    }
  }
}
console.log('  effect          voices  voice peak  summed peak  Hz');
for (const [label, s] of stats) {
  if (s.sum > MAX_SUM + 1e-6) fail(`${label} adds up to ${s.sum.toFixed(3)}`);
  if (GENTLE[label] !== undefined && s.sum > GENTLE[label]) fail(`${label} can play every turn but adds up to ${s.sum.toFixed(3)}, over ${GENTLE[label]}`);
  const hz = s.hi ? `${s.lo.toFixed(0)} to ${s.hi.toFixed(0)}` : 'noise only';
  console.log(`  ${label.padEnd(15)} ${String(s.voices).padStart(6)}  ${s.peak.toFixed(3).padStart(10)}  ${s.sum.toFixed(3).padStart(11)}  ${hz}`);
}

const loudest = [...stats].sort((a, b) => b[1].sum - a[1].sum)[0][0];
console.log(`  The loudest effect is ${loudest}.`);
if (loudest !== 'slam') fail(`the slam is not the loudest effect, ${loudest} is`);

console.log('\nKeys (the scale run the boss plays at half HP)');
for (const [place, f] of freqsByPlace) console.log(`  ${place.padEnd(30)} ${f} Hz`);
if (new Set(DISTINCT.map((p) => freqsByPlace.get(p))).size < DISTINCT.length) fail('two areas share a key');
for (const p of ['boss fight set in another area', 'Overtime rematch', 'Fry Cook fight', 'High Score fight', 'Gardener fight', 'Mainframe fight', 'Jack fight', 'Static fight']) if (freqsByPlace.get(p) !== freqsByPlace.get('Head Office')) fail(`the ${p} does not use Head Office's key`);
const t2 = stats.get('tick(2)').tick, t1 = stats.get('tick(1)').tick;
console.log(`  Fork fuse: 2 left plays ${t2.n} ticks ${t2.gap.toFixed(3)} s apart at ${t2.f.toFixed(0)} Hz, 1 left plays ${t1.n} ticks ${t1.gap.toFixed(3)} s apart at ${t1.f.toFixed(0)} Hz.`);
if (!(t1.n > t2.n && t1.f > t2.f && t1.gap < t2.gap)) fail('the Fork does not tick faster and higher as it runs out');

console.log('\nTurn-by-turn effects');
{
  sb.Sound.setArea(3);
  sb.Music = { current: () => 'area3', setMuted() {} };
  const ting = (sameTurn) => {
    const v = inspect('glint', record(() => sb.sfx('glint'), sameTurn), sb, PLACES[3].key, PITCHED_FROM);
    return v.find((x) => x.type === 'sine');
  };
  record(() => {});
  const first = ting(true), second = ting(true), third = ting(false), next = ting(false);
  console.log(`  Three bounces in one turn: ${[first, second, third].map((v) => v.freqs[0].toFixed(0)).join(', ')} Hz, starting ${[first, second, third].map((v) => (v.start - first.start).toFixed(2)).join(', ')} s in. The next turn starts again at ${next.freqs[0].toFixed(0)} Hz.`);
  if (!(first.freqs[0] < second.freqs[0] && second.freqs[0] < third.freqs[0])) fail('glint does not rise with each bounce in a turn');
  if (!(first.start < second.start && second.start < third.start)) fail('bounces in one turn sound at once');
  if (Math.abs(next.freqs[0] - first.freqs[0]) > 0.01) fail('glint does not start again on a new turn');
  const tones = (open) => inspect('door', record(() => sb.sfx('door', open)), sb, PLACES[3].key, PITCHED_FROM).filter((v) => v.type === 'triangle').map((v) => v.freqs[0]);
  const opening = tones(true), closing = tones(false);
  if (!(opening[1] > opening[0] && closing[1] < closing[0])) fail('the door does not rise as it opens and fall as it closes');
  const cue = (k) => inspect('bosstel', record(() => sb.sfx('bosstel', k)), sb, PLACES[3].key, PITCHED_FROM);
  const sig = (vs) => vs.map((v) => `${v.type}${(v.freqs[0] ?? 0).toFixed(0)}`).join(' ');
  const kinds = ['slam', 'step', 'hire', 'wait', ...TELS];
  const tel = kinds.map((k) => sig(cue(k)));
  if (new Set(tel).size < kinds.length) fail('two telegraphs sound the same');
  if (sig(cue('beam')) !== tel[3]) fail('a telegraph without a cue of its own does not get the soft tone');
  // The new cues are short, and the charge revs and the warp rises.
  for (const k of TELS) {
    const vs = cue(k), len = Math.max(...vs.map((v) => v.end)) - Math.min(...vs.map((v) => v.start));
    if (len > 0.35) fail(`the ${k} telegraph lasts ${len.toFixed(2)} s`);
  }
  const revs = cue('charge').filter((v) => v.type === 'sawtooth');
  if (!revs.length || revs.some((v) => !(v.freqs[v.freqs.length - 1] > v.freqs[0]))) fail('the charge telegraph does not rev up');
  const shimmer = cue('warp').filter((v) => v.type === 'triangle').sort((a, b) => a.start - b.start).map((v) => v.freqs[0]);
  if (shimmer.some((f, i) => i && !(f > shimmer[i - 1]))) fail('the warp telegraph does not rise');
  console.log(`  The door rises opening and falls closing, each of the ${kinds.length} telegraphs sounds different, and an action without a cue gets the soft tone.`);
  const line = (name, arg) => inspect(name, record(() => sb.sfx(name, arg)), sb, name === 'chip' ? C_MAJOR : PLACES[3].key, PITCHED_FROM)
    .filter((v) => v.type !== 'noise').sort((a, b) => a.start - b.start).map((v) => v.freqs[0]);
  const cards = CARDS.map((c) => line('keycard', c));
  const chip = line('chip');
  if (new Set(cards.map((f) => f[0].toFixed(1))).size < CARDS.length) fail('two keycards start on the same note');
  for (const f of cards) if (!(Math.abs(f[0] - f[1]) < 0.01 && f[2] > f[1])) fail('a keycard does not open with Pilcrow\'s repeated tonic and the fifth above it');
  if (cards.some((f) => f.slice(0, 4).every((x, i) => Math.abs(x - (chip[i] ?? 0)) < 0.01))) fail('a keycard sounds like the chip');
  console.log(`  Keycards open on ${cards.map((f) => f[0].toFixed(0)).join(', ')} Hz with Pilcrow's square half, unlike the chip.`);

  // A slide sends one call per tile, and portals one call per trip, all in the same instant. Each sounds a little after
  // the last, up to a cap, and the next turn starts again from the first.
  const burst = (name, place, calls, cap, longest, runMax = GENTLE_RUN) => {
    sb.Sound.setArea(place.area);
    sb.Music = { current: () => place.track, setMuted() {} };
    const one = (sameTurn) => {
      const t0 = sb.Sound.ctx.currentTime;
      const v = inspect(name, record(() => sb.sfx(name), sameTurn), sb, place.key, PITCHED.has(name) ? PITCHED_FROM : null);
      const tone = v.filter((x) => x.type !== 'noise').sort((a, b) => a.start - b.start)[0];
      return { v, at: v.length ? Math.min(...v.map((x) => x.start)) - t0 : null, len: Math.max(0, ...v.map((x) => x.end - x.start)), f: tone ? tone.freqs[0] : 0 };
    };
    record(() => {});
    const run = [];
    for (let i = 0; i < calls; i++) run.push(one(true));
    record(() => {});
    const fresh = one(false);
    const heard = run.filter((x) => x.v.length), sum = sumPeak(heard.flatMap((x) => x.v));
    console.log(`  ${calls} ${name} calls in one turn: ${heard.length} sound, at ${heard.map((x) => x.at.toFixed(2)).join(', ')} s, each voice at most ${Math.max(...heard.map((x) => x.len)).toFixed(2)} s long, adding up to ${sum.toFixed(3)}. The next turn starts again at ${fresh.at.toFixed(2)} s.`);
    if (heard.length !== cap || run.slice(cap).some((x) => x.v.length)) fail(`${name} does not sound ${cap} times in one turn and then go quiet`);
    if (heard.some((x, i) => i && !(x.at > heard[i - 1].at))) fail(`the ${name} calls of one turn sound at once`);
    if (heard.some((x) => x.len > longest)) fail(`a ${name} voice lasts longer than ${longest} s`);
    if (sum > runMax) fail(`a run of ${name} calls adds up to ${sum.toFixed(3)}, over ${runMax}`);
    if (!(fresh.at === heard[0].at && fresh.v.length === heard[0].v.length)) fail(`${name} does not start again on a new turn`);
    return heard;
  };
  burst('slide', PLACES.find((p) => p.name === 'Food Court'), 9, 8, 0.1);
  const trips = burst('portal', PLACES.find((p) => p.name === 'Arcade'), 7, 6, 0.1);
  if (trips.some((x, i) => i && !(x.f > trips[i - 1].f))) fail('each portal trip in a turn does not start higher than the last');
  const garden = PLACES.find((p) => p.name === 'Garden Center');
  burst('spray', garden, 7, 5, 0.15, 0.02);
  const growth = burst('grow', garden, 5, 4, 0.1);
  if (growth.some((x, i) => i && !(x.f > growth[i - 1].f))) fail('each vine growth in a turn does not start higher than the last');
  burst('sprout', garden, 5, 4, 0.2, 0.08);
  burst('shove', garden, 5, 4, 0.1, 0.08);
  const servers = PLACES.find((p) => p.name === 'Server Room');
  burst('split', servers, 7, 6, 0.1);
  const garage = PLACES.find((p) => p.name === 'Parking Garage'), toys = PLACES.find((p) => p.name === 'Toy Store');
  burst('jump', garage, 5, 4, 0.12);
  burst('pull', garage, 5, 4, 0.15, 0.02);
  const throws = burst('boing', toys, 5, 4, 0.15);
  if (throws.some((x, i) => i && !(x.f > throws[i - 1].f))) fail('each bumper throw in a turn does not start higher than the last');
  // The switch rises as it turns on and falls as it turns off.
  sb.Sound.setArea(servers.area);
  sb.Music = { current: () => servers.track, setMuted() {} };
  const flipTo = (on) => inspect('toggle', record(() => sb.sfx('toggle', on)), sb, servers.key, PITCHED_FROM)
    .filter((v) => v.type === 'square').sort((a, b) => a.start - b.start).map((v) => v.freqs[0]);
  const onFlip = flipTo(1), offFlip = flipTo(0);
  if (!(onFlip[1] > onFlip[0] && offFlip[1] < offFlip[0])) fail('the switch does not rise turning on and fall turning off');
  console.log('  Each vine growth in a turn starts higher than the last, and the switch rises turning on and falls turning off.');
  const flip = (link) => inspect('relink', record(() => sb.sfx('relink', link)), sb, PLACES.find((p) => p.name === 'Arcade').key, PITCHED_FROM)
    .filter((v) => v.type === 'square').sort((a, b) => a.start - b.start).map((v) => v.freqs[0]);
  const crossed = flip(1), back = flip(0);
  if (!(crossed[1] > crossed[0] && back[1] < back[0])) fail('the relink does not rise as the pairs cross and fall as they swap back');
  console.log('  Each portal trip in a turn starts a degree higher, and the relink rises as the pairs cross and falls as they swap back.');
  const dings = (sameTurn) => record(() => sb.sfx('cook'), sameTurn).filter((n) => n.kind === 'osc').length;
  const cooks = [dings(true), dings(false), dings(false)];
  if (!cooks[0] || cooks[1] || !cooks[2]) fail('two microwaves in one turn do not ding once, or the next turn stays silent');
  console.log('  Two microwaves in one turn ding once, and the next turn dings again.');
}

// ---------------------------------------------------------------- speech

console.log('\nSpeech');
{
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~';
  const range = {};
  for (const place of PLACES) {
    sb.Sound.setArea(place.area);
    sb.Music = { current: () => place.track, setMuted() {} };
    const here = {};
    for (const who of ['TILDE', 'PILCROW']) {
      const want = who === 'TILDE' ? 'triangle' : 'square';
      for (const ch of chars) {
        const voices = inspect(`${who} saying ${ch} in the ${place.name}`, record(() => sb.Sound.talk(ch, who)), sb, place.key, 0);
        if (!voices.length) fail(`${who} saying ${ch} is silent`);
        if (voices.some((v) => v.type !== want)) fail(`${who} is not a ${want}`);
        const r = (range[who] ??= { lo: Infinity, hi: 0, len: 0 }), h = (here[who] ??= { lo: Infinity, hi: 0 });
        for (const v of voices) {
          for (const f of v.freqs) { r.lo = Math.min(r.lo, f); r.hi = Math.max(r.hi, f); h.lo = Math.min(h.lo, f); h.hi = Math.max(h.hi, f); }
          r.len = Math.max(r.len, v.end - v.start);
        }
      }
      for (const ch of [' ', '.', ',', '!', '?', "'", undefined]) if (record(() => sb.Sound.talk(ch, who)).length) fail(`${who} makes a sound for ${JSON.stringify(ch)}`);
    }
    if (!(here.TILDE.lo > here.PILCROW.hi)) fail(`Tilde does not speak above Pilcrow in the ${place.name}`);
  }
  for (const [who, r] of Object.entries(range)) console.log(`  ${who}: ${r.lo.toFixed(0)} to ${r.hi.toFixed(0)} Hz across every key, notes up to ${r.len.toFixed(2)} s`);
  if (!(range.PILCROW.len < range.TILDE.len)) fail("Pilcrow's blips are not shorter than Tilde's");
}

// ---------------------------------------------------------------- mute

console.log('\nMute');
{
  const calls = [];
  sb.Music = { current: () => 'area0', setMuted: (m) => calls.push(m) };
  const lastTarget = () => { const e = sb.Sound.master.gain.events; return e.length ? e[e.length - 1].v : sb.Sound.master.gain.value; };
  sb.setMuted(true);
  if (lastTarget() !== 0) fail('setMuted(true) does not close the master');
  if (calls[0] !== true) fail('setMuted(true) does not reach Music.setMuted');
  if (record(() => { sb.sfx('ok'); sb.Sound.talk('a', 'TILDE'); sb.Sound.tone('square', 440, 440, 0.1, 0.02); }).length) fail('effects play while muted');
  sb.setMuted(false);
  if (lastTarget() !== 1) fail('setMuted(false) does not open the master');
  if (!record(() => sb.sfx('ok')).length) fail('effects stay silent after unmuting');
  sb.Sound.muted = true;
  if (lastTarget() !== 0) fail('setting Sound.muted directly does not close the master');
  sb.Sound.muted = false;
  const boot = load();
  boot.Sound.muted = true;
  boot.Sound.unlock();
  if (boot.Sound.master.gain.value !== 0) fail('a game that boots muted opens the master on the first key press');
  const legacy = record(() => { sb.Sound.tone('square', 880, 660, 0.05, 0.02); sb.Sound.noise(0.05, 0.02, 0, 2000); sb.Sound.arp([440, 660], 'triangle', 0.05, 0.05, 0.02); });
  inspect('Sound.tone, noise, and arp', legacy, sb, null, null);
  if (legacy.filter((n) => n.kind === 'osc' || n.kind === 'noise').length !== 4) fail('Sound.tone, noise, and arp do not each play');
  console.log('  setMuted and Sound.muted close and open the master, reach Music, and stop new effects. Booting muted stays muted.');
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll effect checks passed.');
process.exit(failures ? 1 : 0);
