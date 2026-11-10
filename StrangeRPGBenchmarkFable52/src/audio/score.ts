// The score. Every part is written with two readings. While the sheet is undecided the readings alternate
// note by note and the thirds, sixths, and sevenths are neutral. As ground is measured the music settles on
// one reading and plain major or minor. Pure functions: the player schedules what they return.
import type { InstId } from './font';

export interface MusicState {
  mode: 'title' | 'sheet' | 'battle' | 'ending' | 'silent';
  season: number;
  /** 0 when everything is undecided, 1 when everything is fixed. */
  decided: number;
  /** Which reading wins when decided: 0 is the major reading, 1 is the minor reading. */
  lean: number;
  lead: string;
  level: boolean;
  /** 0 to 2, rising through the sheet. */
  intensity: number;
}

export interface Note { step: number; inst: InstId; freq: number; gain: number; dur: number; pan: number }

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const TONIC = [174.61, 146.83, 164.81, 196.0, 220.0, 130.81, 146.83];
const TEMPO = [72, 92, 96, 100, 104, 108, 100];
const PROG: number[][] = [
  [1, 4, 6, 4, 1, 4, 2, 5],
  [1, 1, 4, 4, 6, 6, 5, 5],
  [1, 6, 4, 5, 1, 6, 2, 5],
  [6, 4, 1, 5, 6, 4, 2, 5],
  [1, 3, 4, 2, 6, 4, 5, 5],
  [1, 1, 1, 1, 4, 4, 5, 5],
  [1, 5, 6, 3, 4, 1, 4, 5],
];
const ORDER: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 1, 4, 5, 2, 3, 6, 7],
  [2, 3, 0, 1, 6, 7, 4, 5],
  [4, 5, 6, 7, 0, 1, 2, 3],
  [0, 0, 1, 1, 4, 4, 7, 7],
  [6, 7, 4, 5, 2, 3, 0, 1],
];

type Ev = [number, number, number];
/** Reading A of the theme: step, scale degree (8 is the octave), length in steps. */
const THEME_A: Ev[][] = [
  [[0, 3, 2], [2, 5, 2], [4, 6, 4], [8, 5, 2], [10, 3, 2], [12, 2, 4]],
  [[0, 1, 4], [4, 2, 2], [6, 3, 2], [8, 5, 6], [14, 3, 2]],
  [[0, 6, 2], [2, 8, 2], [4, 9, 4], [8, 8, 2], [10, 6, 2], [12, 5, 4]],
  [[0, 6, 4], [4, 5, 2], [6, 3, 2], [8, 2, 8]],
  [[0, 3, 2], [2, 5, 2], [4, 6, 4], [8, 8, 2], [10, 9, 2], [12, 10, 4]],
  [[0, 9, 4], [4, 8, 2], [6, 6, 2], [8, 5, 6], [14, 6, 2]],
  [[0, 8, 2], [2, 6, 2], [4, 5, 4], [8, 3, 2], [10, 2, 2], [12, 3, 4]],
  [[0, 2, 4], [4, 1, 12]],
];
/** Reading B: a second line that moves the other way and sits on the steps reading A leaves open. */
const THEME_B: Ev[][] = [
  [[2, 8, 2], [6, 7, 2], [10, 6, 2], [14, 5, 2]],
  [[2, 5, 2], [6, 6, 2], [10, 3, 4]],
  [[2, 4, 2], [6, 3, 2], [10, 4, 2], [14, 5, 2]],
  [[2, 6, 2], [6, 8, 2], [10, 7, 4]],
  [[2, 8, 2], [6, 7, 2], [10, 5, 2], [14, 6, 2]],
  [[2, 4, 2], [6, 5, 2], [10, 3, 4]],
  [[2, 6, 2], [6, 5, 2], [10, 4, 2], [14, 2, 2]],
  [[2, 7, 2], [6, 5, 2], [8, 8, 8]],
];

const MAJOR = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
const MINOR = [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5];
const NEUTRAL = [1, 9 / 8, 11 / 9, 4 / 3, 3 / 2, 18 / 11, 11 / 6];

export function tempoOf(st: MusicState): number {
  if (st.mode === 'battle') return 132;
  if (st.mode === 'title') return TEMPO[0];
  if (st.mode === 'ending') return 76;
  return TEMPO[st.season] ?? 100;
}

function tonicOf(st: MusicState): number {
  return st.mode === 'title' || st.mode === 'ending' ? TONIC[st.mode === 'title' ? 0 : 1] : TONIC[st.season] ?? TONIC[1];
}

/** True where this step has settled on one reading. */
export function settled(st: MusicState, step: number, bar: number): boolean {
  return BAYER[((bar & 3) << 2) | ((Math.floor(step) >> 1) & 3)] < st.decided * 16;
}

/** Which reading sounds on a step: the leaning one where settled, alternating where not. */
export function readingAt(st: MusicState, step: number, bar: number): number {
  if (settled(st, step, bar)) return st.lean;
  return ((Math.floor(step) >> 1) + bar) & 1;
}

export function freqOf(st: MusicState, degree: number, step: number, bar: number): number {
  const o = Math.floor((degree - 1) / 7);
  const d = (((degree - 1) % 7) + 7) % 7;
  const table = settled(st, step, bar) ? (st.lean ? MINOR : MAJOR) : NEUTRAL;
  return tonicOf(st) * Math.pow(2, o) * table[d];
}

export function barNotes(st: MusicState, bar: number): Note[] {
  const out: Note[] = [];
  if (st.mode === 'silent') return out;
  const sheetIdx = st.mode === 'sheet' || st.mode === 'battle' ? st.season : 0;
  const prog = st.mode === 'battle' ? [1, 1, 6, 6, 4, 4, 5, 5] : PROG[sheetIdx] ?? PROG[1];
  const root = prog[bar % 8];
  const quiet = st.mode === 'title' || st.mode === 'ending';
  const add = (step: number, inst: InstId, degree: number, gain: number, dur: number, pan = 0) => {
    out.push({ step, inst, freq: degree === 0 ? 0 : freqOf(st, degree, step, bar), gain, dur, pan });
  };
  const hit = (step: number, inst: InstId, gain: number, pan = 0) => out.push({ step, inst, freq: 0, gain, dur: 1, pan });
  const gate = (reading: number, step: number) => readingAt(st, step, bar) === reading;

  const low = root - 7;
  const bassA: Ev[] = [[0, low, 5], [6, low, 2], [8, low + 4, 5], [14, low, 2]];
  const bassB: Ev[] = [[0, low, 3], [3, low + 2, 4], [8, low + 4, 3], [11, low + 6, 4]];
  if (!quiet || bar % 2 === 0) {
    for (const [s, d, len] of bassA) if (gate(0, s)) add(s, 'band', d, 0.5, len, -0.15);
    for (const [s, d, len] of bassB) if (gate(1, s)) add(s, 'band', d, 0.5, len, -0.15);
  }

  const compA: Ev[] = [[4, root + 9, 3], [4, root + 11, 3], [12, root + 9, 3], [12, root + 11, 3]];
  const compB: Ev[] = [[2, root + 7, 2], [7, root + 9, 2], [10, root + 11, 2], [15, root + 9, 1]];
  for (const [s, d, len] of compA) if (gate(0, s)) add(s, 'glass', d, 0.16, len, 0.3);
  for (const [s, d, len] of compB) if (gate(1, s)) add(s, 'glass', d, 0.18, len, 0.3);

  const order = ORDER[sheetIdx] ?? ORDER[1];
  let lineA: Ev[], lineB: Ev[];
  if (st.mode === 'battle') {
    const k = (bar * 2) % 8;
    const squeeze = (th: Ev[][]) => th[order[k]].map(([s, d, l]) => [s / 2, d, Math.max(1, l / 2)] as Ev).concat(th[order[(k + 1) % 8]].map(([s, d, l]) => [8 + s / 2, d, Math.max(1, l / 2)] as Ev));
    lineA = squeeze(THEME_A);
    lineB = squeeze(THEME_B);
  } else {
    lineA = THEME_A[order[bar % 8]];
    lineB = THEME_B[order[bar % 8]];
  }
  const lead = quiet ? (st.mode === 'title' ? 'either' : 'perch') : st.lead;
  const voice = (s: number, d: number, len: number) => {
    switch (lead) {
      case 'deed':
        add(s, 'ruler', d, 0.3, len, 0.1);
        if (Math.floor(s) % 4 === 0) add(s, 'bell', d, 0.2, len, 0.2);
        break;
      case 'auger': add(s, 'band', d - 7, 0.5, len, 0.05); add(s, 'ruler', d, 0.2, len, 0.1); break;
      case 'offset': add(s, 'ruler', d, 0.42, len, 0.1); add(s + 1, 'ruler', d - 3, 0.24, len, -0.3); break;
      case 'lot': for (let i = 0; i < 3; i++) add(s + (i * 2) / 3, 'glass', d, 0.26 - i * 0.05, 1, 0.1 + i * 0.1); break;
      case 'either': add(s, 'bottle', d, 0.36, len + 1, 0.1); break;
      default: add(s, 'ruler', d, 0.46, len, 0.1);
    }
  };
  const both = lead === 'either';
  for (const [s, d, len] of lineA) if (both || gate(0, s)) voice(s, d, len);
  for (const [s, d, len] of lineB) if (both || gate(1, s)) voice(s, d, len);

  const drive = st.mode === 'battle' ? 2 : quiet ? 0 : st.intensity;
  if (quiet) { hit(0, 'tap', 0.12); if (bar % 2 === 1) hit(8, 'paper', 0.1, 0.4); }
  else {
    for (const s of [0, 4, 8, 12]) if (gate(0, s)) hit(s, 'tap', s === 0 ? 0.3 : 0.2, -0.2);
    for (const s of [3, 6, 11, 14]) if (gate(1, s)) hit(s, 'tap', 0.2, 0.25);
    if (drive >= 0.6) { for (const s of [4, 12]) if (gate(0, s)) hit(s, 'paper', 0.16, 0.4); for (const s of [2, 10]) if (gate(1, s)) hit(s, 'paper', 0.16, -0.4); }
    if (drive >= 1.1) { if (gate(0, 0)) hit(0, 'stamp', 0.5); if (gate(0, 8)) hit(8, 'stamp', 0.4); if (gate(1, 6)) hit(6, 'stamp', 0.35); }
    if (st.mode === 'battle') for (const s of [2, 6, 10, 14]) hit(s, 'scratch', 0.14, 0.3);
    if (bar % 8 === 7) for (const s of [12, 13, 14, 15]) hit(s, 'scratch', 0.12 + (s - 12) * 0.03, -0.3);
  }
  if (st.level) for (const s of [0, 4, 8, 12]) out.push({ step: s, inst: 'bell', freq: tonicOf(st) * 6, gain: 0.1, dur: 2, pan: -0.5 });
  return out;
}

/** The short figure a party's instrument plays when its turn starts. */
export function figure(who: string, tonic = 196): Note[] {
  const st: MusicState = { mode: 'sheet', season: 1, decided: who === 'either' ? 0 : 1, lean: who === 'auger' || who === 'deed' ? 1 : 0, lead: who, level: false, intensity: 0 };
  const f = (d: number) => { const o = Math.floor((d - 1) / 7), k = (((d - 1) % 7) + 7) % 7; return tonic * Math.pow(2, o) * (who === 'either' ? NEUTRAL : st.lean ? MINOR : MAJOR)[k]; };
  const n = (step: number, inst: InstId, d: number, gain: number, dur = 2): Note => ({ step, inst, freq: f(d), gain, dur, pan: 0 });
  switch (who) {
    case 'perch': return [n(0, 'ruler', 1, 0.4), n(1, 'ruler', 3, 0.4), n(2, 'ruler', 5, 0.45, 3)];
    case 'deed': return [n(0, 'bell', 5, 0.22), n(2, 'bell', 5, 0.22), n(4, 'bell', 1, 0.26, 4)];
    case 'auger': return [n(0, 'band', 1, 0.5), n(1, 'band', 1, 0.45), n(2, 'band', 0, 0.45), n(3, 'band', 1, 0.5, 3)];
    case 'offset': return [n(1, 'ruler', 3, 0.35), n(2, 'ruler', 5, 0.35), n(3, 'ruler', 3, 0.4, 3)];
    case 'lot': return [0, 0.6, 1.2, 1.8, 2.4].map((s, i) => n(s, 'glass', i % 2 ? 6 : 5, 0.24, 1));
    case 'either': return [n(0, 'bottle', 3, 0.3, 5), n(0, 'bottle', 6, 0.3, 5)];
    default: return [n(0, 'bell', 5, 0.18), n(2, 'bell', 5, 0.18)];
  }
}
