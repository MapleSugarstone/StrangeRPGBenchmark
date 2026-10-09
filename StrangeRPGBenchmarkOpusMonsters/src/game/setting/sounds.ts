// Sounds for the Setting board: small plonky machine noises pitched to the key and chord the music plays now.
import { above, ct, deg, hiss, scaleLen, tone, tune } from '../tuned';
import type { Atom, Part, Sim, Step, Stone } from './core';

// ---------------------------------------------------------------- the machine's actions

/** An arm swings a quarter turn: a ratchet of three clicks, and a reedy note that slides into its chord tone. */
function turnSound(i: number, right: boolean, at: number, v: number): void {
  for (let k = 0; k < 3; k++) hiss({ f: 3400 - k * 300, q: 6, dur: 0.014, vol: 0.05 * v, at: at + k * 0.022 });
  const f = ct(i, 5);
  tone({ w: 'triangle', f: f * Math.pow(2, (right ? -2 : 2) / 12), to: f, dur: 0.1, vol: 0.026 * v, at });
}

/** An arm reaches out with a springy rise to its tone, or pulls in with a fall to it. */
function reachSound(i: number, outward: boolean, at: number, v: number): void {
  const f = ct(i, 4);
  tone({ f: f * (outward ? 0.75 : 1.33), to: f, dur: 0.12, vol: 0.04 * v, at, fm: [2, 0.8] });
}

/** The claw closes on a stone: a hollow wooden knock at the arm's tone and a click. */
function grabSound(i: number, at: number, v: number): void {
  tone({ f: ct(i, 5), dur: 0.08, vol: 0.042 * v, at, fm: [3.98, 2.4] });
  hiss({ f: 2600, q: 3, dur: 0.016, vol: 0.05 * v, at });
}

/** The claw closes on nothing: two dry snaps with no note. */
function emptySound(at: number, v: number): void {
  hiss({ f: 1900, q: 4, dur: 0.02, vol: 0.035 * v, at });
  hiss({ f: 2500, q: 4, dur: 0.016, vol: 0.025 * v, at: at + 0.035 });
}

/** A stone set down on the felt: a soft plonk that settles onto the arm's tone, over a muffled thud. */
function dropSound(i: number, at: number, v: number): void {
  const f = ct(i, 4);
  tone({ f: f * 1.12, to: f, dur: 0.14, vol: 0.046 * v, at, fm: [1, 0.6] });
  hiss({ f: 380, kind: 'lowpass', q: 0.7, dur: 0.05, vol: 0.12 * v, at });
}

/** A polisher shines a stone: a buffing swish that brightens, and two glassy notes high in the chord. */
function polishSound(k: number, at: number, v: number): void {
  hiss({ f: 1800, to: 6000, q: 4, dur: 0.16, vol: 0.03 * v, at });
  tone({ f: ct(k, 6), dur: 0.28, vol: 0.022 * v, at: at + 0.06, fm: [3.5, 1.6] });
  tone({ f: ct(k + 1, 6), dur: 0.24, vol: 0.016 * v, at: at + 0.11, fm: [3.5, 1.4] });
}

/** A setter bonds two stones: two quick plinks a chord apart, then one ring as they join. */
function bondSound(at: number, v: number): void {
  tone({ f: ct(0, 5), dur: 0.06, vol: 0.03 * v, at, fm: [3.98, 1.5] });
  tone({ f: ct(2, 5), dur: 0.06, vol: 0.03 * v, at: at + 0.03, fm: [3.98, 1.5] });
  tone({ f: ct(0, 6), dur: 0.3, vol: 0.026 * v, at: at + 0.07, fm: [2, 1.2] });
}

/** A splitter cuts a bond: a bright snip, and the two notes of a chord falling apart. */
function cutSound(at: number, v: number): void {
  hiss({ f: 5200, q: 5, dur: 0.035, vol: 0.06 * v, at });
  tone({ w: 'triangle', f: ct(2, 5), dur: 0.06, vol: 0.03 * v, at: at + 0.035 });
  tone({ w: 'triangle', f: ct(0, 5), dur: 0.08, vol: 0.03 * v, at: at + 0.08 });
}

/** A fresh stone wells up at an input: a low bubble that rises onto a note of the scale. */
function appearSound(k: number, at: number, v: number): void {
  const f = deg(k * 2, 4);
  tone({ f: f * 0.7, to: f, dur: 0.09, vol: 0.03 * v, at, fm: [1.5, 0.5] });
}

/** A finished piece taken at an output: a bell that climbs the scale with each one, reaching the root an octave up on the last. */
function deliverSound(n: number, need: number, at: number, v: number): void {
  const L = scaleLen(), d = Math.min(L * 2, Math.round((Math.max(1, n) * L) / Math.max(1, need)));
  tone({ f: deg(d, 5), dur: 0.7, vol: 0.045 * v, at, fm: [3.5, 2.2] });
  tone({ f: ct(0, 4), dur: 0.45, vol: 0.02 * v, at, fm: [2, 0.6] });
  tone({ f: deg(d + L, 5), dur: 0.08, vol: 0.012 * v, at: at + 0.09, fm: [2.76, 1] });
}

/** The machine jams: a dull clunk and a low note that sags a little, the one sound here that leaves the key. */
function jamSound(at = 0): void {
  hiss({ f: 300, kind: 'lowpass', q: 0.8, dur: 0.12, vol: 0.22, at });
  const f = deg(0, 3);
  tone({ w: 'triangle', f, to: f * 0.84, dur: 0.32, vol: 0.06, at: at + 0.02 });
  tone({ w: 'triangle', f: f * Math.pow(2, 1 / 12), to: f * 0.89, dur: 0.26, vol: 0.03, at: at + 0.05 });
}

/** The puzzle is solved: bells climb the chord over two octaves, then the root, its fifth, and its octave ring together. */
export function solvedSound(): void {
  const T = tune(), n = above(T.tones, T.root).length;
  for (let k = 0; k <= n * 2; k++) tone({ f: ct(k, 5), dur: 0.5, vol: 0.036, at: k * 0.07, fm: [3.5, 2] });
  const end = (n * 2 + 1) * 0.07 + 0.05;
  for (const [f, vol] of [[deg(0, 4), 0.03], [ct(Math.min(2, n - 1), 4), 0.022], [deg(0, 5), 0.026]] as [number, number][]) tone({ f, dur: 1.4, vol, at: end, a: 0.01, fm: [2, 1] });
  tone({ f: deg(0, 7), dur: 0.12, vol: 0.012, at: end + 0.12, fm: [2.76, 1] });
}

// ---------------------------------------------------------------- reading one step

/** What the machine held before a step, so the step's sounds can be read off by comparing. */
export interface Before { arms: { dir: number; len: number; hold: number | null }[]; stones: Map<Atom, Stone>; pairs: Set<string>; got: number[] }

const serial = new WeakMap<Atom, number>();
let nextSerial = 1;
const sid = (a: Atom): number => { let n = serial.get(a); if (!n) { n = nextSerial++; serial.set(a, n); } return n; };

/** Every bond as a pair of atoms. The simulator keeps atom objects when pieces join or split, so the pairs survive both. */
function pairsOf(sim: Sim): Set<string> {
  const out = new Set<string>();
  for (const p of sim.pieces) for (const [x, y] of p.bonds) { const a = sid(p.atoms[x]), b = sid(p.atoms[y]); out.add(a < b ? `${a},${b}` : `${b},${a}`); }
  return out;
}

export function snapshot(sim: Sim): Before {
  const stones = new Map<Atom, Stone>();
  for (const p of sim.pieces) for (const a of p.atoms) { sid(a); stones.set(a, a.s); }
  return { arms: sim.arms.map(a => ({ dir: a.dir, len: a.len, hold: a.hold })), stones, pairs: pairsOf(sim), got: sim.got.slice() };
}

/** What one step did. Arm actions count only when they changed something, and `arms` holds one entry per arm. */
export interface StepEvents {
  arms: ('turnL' | 'turnR' | 'out' | 'in' | 'grab' | 'miss' | 'drop' | null)[];
  fresh: number; polished: number; bonds: number; cuts: number;
  /** Each output's count after the step, for the outputs that took a piece. */
  delivered: { output: number; n: number }[];
  jam: boolean;
}

/** Reads what one step did by comparing the machine with its state before the step. */
export function readStep(b: Before, sim: Sim, did: Step[]): StepEvents {
  const now = new Set<Atom>();
  let fresh = 0;
  for (const p of sim.pieces) {
    let isNew = false;
    for (const a of p.atoms) { now.add(a); if (!b.stones.has(a)) isNew = true; }
    if (isNew) fresh++;
  }
  const arms = sim.arms.map((a, i): StepEvents['arms'][number] => {
    const p = b.arms[i], d = did[i];
    if (!p) return null;
    if ((d === 'L' || d === 'R') && a.dir !== p.dir) return d === 'R' ? 'turnR' : 'turnL';
    if (d === 'O' && a.len > p.len) return 'out';
    if (d === 'I' && a.len < p.len) return 'in';
    if (d === 'G' && p.hold === null) return a.hold !== null ? 'grab' : 'miss';
    if (d === 'D' && p.hold !== null) return 'drop';
    return null;
  });
  let polished = 0, bonds = 0, cuts = 0;
  for (const [a, s] of b.stones) if (a.s !== s) polished++;
  const after = pairsOf(sim), old = new Set([...b.stones.keys()].map(sid)), alive = new Set([...now].map(sid));
  for (const k of after) if (!b.pairs.has(k) && k.split(',').every(n => old.has(Number(n)))) bonds++;
  for (const k of b.pairs) if (!after.has(k) && k.split(',').every(n => alive.has(Number(n)))) cuts++;
  const delivered = sim.got.map((n, output) => ({ output, n })).filter(({ output, n }) => n > (b.got[output] ?? 0));
  return { arms, fresh, polished, bonds, cuts, delivered, jam: !!sim.err };
}

/**
 * Plays one machine step: new stones at the inputs, then each arm's action as a quick arpeggio up the chord, then the
 * stations' work, then deliveries, or a jam. Running fast drops the turns and reaches so the steps do not blur.
 */
export function stepSounds(b: Before, sim: Sim, did: Step[], need: number, fast: boolean): void {
  const e = readStep(b, sim, did), v = fast ? 0.7 : 1;
  for (let k = 0; k < Math.min(2, e.fresh); k++) appearSound(k, k * 0.03, v);
  e.arms.forEach((ev, i) => {
    const at = 0.02 + i * 0.035;
    if (ev === 'turnL' || ev === 'turnR') { if (!fast) turnSound(i, ev === 'turnR', at, v); }
    else if (ev === 'out' || ev === 'in') { if (!fast) reachSound(i, ev === 'out', at, v); }
    else if (ev === 'grab') grabSound(i, at, v);
    else if (ev === 'miss') emptySound(at, v);
    else if (ev === 'drop') dropSound(i, at, v);
  });
  if (e.jam) { jamSound(0.08); return; }
  for (let k = 0; k < Math.min(2, e.polished); k++) polishSound(k, 0.12 + k * 0.05, v);
  if (e.bonds) bondSound(0.12, v);
  if (e.cuts) cutSound(0.12, v);
  for (const d of e.delivered) deliverSound(d.n, need, 0.16 + d.output * 0.06, v);
}

// ---------------------------------------------------------------- editing

/** The board cursor: a tiny wooden tick that climbs the scale to the right and up the board. */
export function boardTick(x: number, y: number, h: number): void {
  tone({ w: 'triangle', f: deg(x + (h - 1 - y), 5), dur: 0.035, vol: 0.022, fm: [3.98, 1] });
}

/** The tape cursor: a softer tick that climbs the scale along the tape. */
export function tapeTick(col: number): void {
  tone({ f: deg(col, 5), dur: 0.03, vol: 0.02, fm: [2, 0.5] });
}

/** Changing tape rows: the row's arm tone, low then high. */
export function rowSound(row: number): void {
  tone({ f: ct(row, 4), dur: 0.04, vol: 0.022, fm: [2, 0.6] });
  tone({ f: ct(row, 5), dur: 0.05, vol: 0.02, at: 0.04, fm: [2, 0.6] });
}

const KIND_TONE: Record<Part['kind'], number> = { arm: 0, polish: 1, set: 2, split: 3 };

/** A part set on the board: a felt thud, a wooden knock in the part's own chord tone, and a faint brass ping. */
export function placeSound(kind: Part['kind']): void {
  const k = KIND_TONE[kind];
  hiss({ f: 420, kind: 'lowpass', q: 0.7, dur: 0.06, vol: 0.15 });
  tone({ f: ct(k, 4), dur: 0.11, vol: 0.05, fm: [3.98, 2] });
  tone({ f: ct(k, 6), dur: 0.14, vol: 0.014, at: 0.03, fm: [3.5, 1.5] });
}

/** A part slid one cell while it is being moved: a short scrape and a tick for where it is now. */
export function slideSound(x: number, y: number, h: number): void {
  hiss({ f: 1200, q: 1.5, dur: 0.05, vol: 0.045 });
  tone({ w: 'triangle', f: deg(x + (h - 1 - y), 4), dur: 0.04, vol: 0.016, at: 0.02, fm: [3.98, 1] });
}

/** A part turned in place: the arm's ratchet and slide. */
export function turnPartSound(): void {
  turnSound(0, true, 0, 0.9);
}

/** Writing a tape step plays a quiet preview of that action at the row's arm tone. A wait is one soft click. */
export function writeSound(s: Step, row: number): void {
  const v = 0.75;
  if (s === 'G') grabSound(row, 0, v);
  else if (s === 'D') dropSound(row, 0, v);
  else if (s === 'L' || s === 'R') turnSound(row, s === 'R', 0, v);
  else if (s === 'O' || s === 'I') reachSound(row, s === 'O', 0, v);
  else hiss({ f: 1500, q: 3, dur: 0.018, vol: 0.03 });
}

/** Clearing a tape step: a swipe, and the row's tone dropping an octave. */
export function clearSound(row: number): void {
  hiss({ f: 2400, to: 900, q: 1.2, dur: 0.09, vol: 0.045 });
  tone({ f: ct(row, 5), to: ct(row, 4), dur: 0.09, vol: 0.02 });
}
