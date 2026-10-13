// The Year 1977: year, factory, storyteller, chasm, despair, escape. A disco bass that decays and detunes, and yellow synths.
import { B, KEEP, MEL, MODE, aug, colorTones, euclid, fold, floatProg, key, prog, shift } from './lib';
import type { Ctx, Section, TrackDef } from './lib';
import { PILGRIM_HEAD, YEAR_BASS, YEAR_LEAD } from './motifs';
import { arp, bassLine, toPitch, walkBars } from './kit';

const K_YEAR = key(57, MODE.aeo);

/** The disco bass for one bar on a chord root: triangle with a thin pulse an octave up. */
function yearBass(b: B, K: typeof K_YEAR, t0: number, R: number, g: number, det: number, pump = 1) {
  bassLine(b, 'tri', t0, YEAR_BASS, K, R, 33, 0.55 * g, { det });
  if (pump) bassLine(b, 'p2', t0, YEAR_BASS, K, R, 45, 0.13 * g, { duty: 0, det }, 0.6);
}

function discoKit(b: B, t0: number, g: number, hats = true) {
  for (const t of [0, 2, 3.5]) b.hit(t0 + t, 'kick', 0.5 * g, 0.2);
  if (hats) for (let t = 0; t < 4; t++) b.hit(t0 + t + 0.5, 'hat', 0.16 * g, 0.12);
  b.hit(t0 + 1, 'clap', 0.34 * g, 0.12).hit(t0 + 3, 'clap', 0.34 * g, 0.12);
}

function yearSec(c: Ctx, kind: 'groove' | 'lead' | 'break' | 'rewind'): Section {
  const r = c.r, K = K_YEAR;
  if (kind === 'rewind') {
    c.st.age = 0;
    const b = new B(8, 4, c.bpm);
    b.mot('year');
    b.hit(0, 'sweep', 0.3, 3.5, { n: 50 });
    b.n('x', 0, K(4), 3.5, 0.14, { sus: 1, a: 1, bend: 7 });
    yearBass(b, K, 4, 0, 0.6, -40, 0);
    return b.out({ tempo: [[0, c.bpm * 0.6], [4, c.bpm * 0.6], [8, c.bpm]] });
  }
  const age = (c.st.age ?? 0) + 1;
  c.st.age = age;
  const g = Math.max(0.35, 1 - age * 0.09), det = -age * 7;
  const b = new B(16, 4, c.bpm);
  b.mot('year');
  const roots = prog(r, [0, 5, 2, 6], { 6: [6, 4], 2: [2, 0], 5: [5, 3] }, 0.3);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i];
    yearBass(b, K, t0, R, g, det);
    if (kind !== 'break') discoKit(b, t0, g);
    // Strings: a held pair that sings a little flat.
    const ch = colorTones(K, R, 'tri', 57);
    b.n('x', t0, ch[1], 3.9, 0.11, { sus: 1, a: 0.5, det: det * 0.5 });
    b.n('x', t0, ch[2], 3.9, 0.09, { sus: 1, a: 0.7, det: det * 0.5 + 6 });
  }
  if (kind === 'lead') {
    b.fig('p1', 0, shift(YEAR_LEAD, roots[0] + 1), K, 1, 0.34, { duty: 1, ...KEEP }, 0.95);
    b.fig('p1', 8, shift(YEAR_LEAD, roots[2] + 1), K, 1, 0.34, { duty: 1, ...KEEP }, 0.95);
  } else if (kind === 'break') {
    b.fig('p1', 4, YEAR_LEAD.slice(0, 3), K, 1, 0.22, { duty: 1, ...KEEP }, 0.95);
  } else if (r.chance(0.5)) {
    b.fig('p1', 8, YEAR_LEAD.slice(0, 5), K, 1, 0.16, { duty: 1, ...KEEP }, 0.9);
  }
  return b.out();
}

export const year: TrackDef = {
  slip: 0.04, bendy: 0.08, bpm: 112, start: 'groove', vary: 0.45, wrong: 0.04, echo: 0.28, wobble: 11, tint: 'year', key: K_YEAR, motifs: ['year'],
  next: (cur, c) => (cur === 'rewind' ? 'groove' : (c.st.age ?? 0) >= 7 ? 'rewind' : c.r.weighted([['groove', 2], ['lead', 3], ['break', 1]])),
  secs: { groove: (c) => yearSec(c, 'groove'), lead: (c) => yearSec(c, 'lead'), break: (c) => yearSec(c, 'break'), rewind: (c) => yearSec(c, 'rewind') },
};

// ---------------------------------------------------------------- factory

const K_FAC = key(52, MODE.aeo);

function factorySec(c: Ctx, kind: 'line' | 'press' | 'belt'): Section {
  const r = c.r, K = K_FAC, b = new B(16, 4, c.bpm);
  b.mot('year');
  const steps = 64;
  const kicks = euclid(r.pick([4, 5, 5, 6]), 16, 0), claps = euclid(2, 16, 4), hats = euclid(r.pick([7, 9, 11]), 16, r.int(4));
  const toms = euclid(r.pick([3, 5]), 16, r.int(8)), drips = euclid(r.pick([3, 5]), 16, r.int(16));
  const roots = prog(r, [0, 5, 3, 6], { 5: [5, 2], 3: [3, 1], 6: [6, 4] }, 0.3);
  for (let s = 0; s < steps; s++) {
    const t = s * 0.25, st = s % 16;
    if (kind !== 'press' || s < 16) {
      if (kicks[st]) b.hit(t, 'kick', 0.5, 0.2);
      if (claps[st]) b.hit(t, 'clap', 0.3, 0.12);
    }
    if (kind !== 'press' && hats[st]) b.hit(t, 'hat', 0.13, 0.05);
    if (kind === 'belt' && toms[st]) b.hit(t, 'tom', 0.28, 0.15, { n: 52 + (s % 5) * 3 });
    if (drips[st] && kind !== 'belt') b.hit(t, 'drip', 0.12, 0.06);
  }
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i];
    // The bass is a sequencer: sixteenths on the Year's octave hop.
    const low = fold(K(R), 33);
    for (let s = 0; s < 16; s++) {
      if (kind === 'press' && i > 1) break;
      const hop = [0, 12, 0, 12, 0, 12, 7, 10][s % 8];
      b.n('tri', t0 + s * 0.25, low + hop, 0.2, s % 4 === 0 ? 0.55 : 0.42, { det: -c.pass % 6 * 3 });
    }
    if (kind !== 'press') arp(b, 'p2', t0, 4, 0.25, colorTones(K, R, 'sev', 57), [0, 2, 1, 3, 2, 1, 3, 2], 0.09, { duty: 0 }, 1.2);
  }
  b.hit(0, 'rumble', 0.14, 16, { a: 3 });
  if (kind !== 'belt') {
    // A slow slide through quarter tones, like something being pressed.
    b.n('x', 0, K(4) + 12, 14, 0.1, { sus: 1, a: 2, bend: r.pick([-1.5, 1.5]) });
    b.n('x', 0, K(4) + 12.5, 14, 0.07, { sus: 1, a: 3, bend: r.pick([-1.5, 1.5]) });
  }
  if (kind === 'line') b.fig('p1', 8, shift(YEAR_LEAD, 1), K, 1, 0.26, { duty: 0, ...KEEP }, 0.8);
  return b.out();
}

export const factory: TrackDef = {
  slip: 0.05, bpm: 124, start: 'line', vary: 0.5, wrong: 0.04, echo: 0.22, wobble: 9, tint: 'year', key: K_FAC, motifs: ['year'],
  graph: { line: [['line', 1], ['belt', 3], ['press', 2]], belt: [['line', 3], ['press', 2], ['belt', 1]], press: [['line', 3], ['belt', 2]] },
  secs: { line: (c) => factorySec(c, 'line'), press: (c) => factorySec(c, 'press'), belt: (c) => factorySec(c, 'belt') },
};

// ---------------------------------------------------------------- storyteller

const K_STORY = key(50, MODE.dor);

function storySec(c: Ctx, kind: 'tale' | 'pause'): Section {
  const r = c.r, K = K_STORY, b = new B(18, 3, c.bpm);
  b.mot('year');
  const roots = floatProg(r, 6, 0, 0.25);
  for (let i = 0; i < 6; i++) {
    const t0 = i * 3, R = roots[i];
    const low = fold(K(R), 38);
    b.n('tri', t0, low, 1.4, 0.45, { det: -c.pass * 2 }).n('tri', t0 + 1.5, low + 12, 1.2, 0.34, { det: -c.pass * 2 });
    if (kind === 'tale') arp(b, 'x', t0, 3, 0.5, colorTones(K, R, 'tri', 62), [0, 1, 2, 1, 2, 1], 0.1, { ratio: 3.5 }, 1.3);
    else b.n('x', t0, K(R + 4) + 12, 2.8, 0.1, { sus: 1, a: 0.5 });
  }
  if (kind === 'tale') {
    b.fig('p1', 0, aug(YEAR_LEAD, 1.5), K, 1, 0.26, { duty: 3, a: 0.04, ...KEEP }, 0.95);
    b.fig('p1', 9, shift(aug(YEAR_LEAD, 1.5), r.pick([-1, 1, 2])), K, 1, 0.24, { duty: 3, a: 0.04, ...KEEP }, 0.95);
  } else {
    b.fig('p1', 3, aug(YEAR_LEAD.slice(0, 4), 1.5), K, 1, 0.2, { duty: 3, a: 0.06, ...KEEP }, 0.95);
  }
  return b.out();
}

export const storyteller: TrackDef = {
  swing: 0.04, stumble: 0.03, bendy: 0.1, bpm: 66, start: 'tale', vary: 0.5, wrong: 0.04, echo: 0.4, wobble: 9, tint: 'year', key: K_STORY, motifs: ['year'],
  graph: { tale: [['tale', 1], ['pause', 2]], pause: [['tale', 3], ['pause', 1]] },
  secs: { tale: (c) => storySec(c, 'tale'), pause: (c) => storySec(c, 'pause') },
};

// ---------------------------------------------------------------- chasm

const K_CHASM = key(45, MODE.phr);

function chasmSec(c: Ctx, kind: 'sink' | 'bottom'): Section {
  const r = c.r, K = K_CHASM;
  if (kind === 'bottom') {
    c.st.depth = 0;
    const b = new B(16, 4, c.bpm);
    b.mot('year', 'void');
    b.n('tri', 0, 28, 12, 0.6, { a: 2, det: -50 });
    b.n('x', 3, K(0) - 12 + 24, 9, 0.12, { sus: 1, a: 2.5, bend: -4 });
    b.hit(0, 'rumble', 0.25, 12, { a: 4 });
    return b.out({ tempo: [[0, 44], [16, 44]] });
  }
  const depth = (c.st.depth ?? 0) + 1;
  c.st.depth = depth;
  const b = new B(16, 4, c.bpm);
  b.mot('year');
  const roots = floatProg(r, 4, 0, 0.2).map((x) => x - depth);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i];
    bassLine(b, 'tri', t0, YEAR_BASS, K, R, 33, 0.5, { det: -depth * 11 });
    bassLine(b, 'p2', t0, YEAR_BASS, K, R, 45, 0.1, { duty: 0, det: -depth * 11 }, 0.6);
    b.hit(t0, 'kick', 0.4 - depth * 0.04, 0.3);
    if (depth < 4) b.hit(t0 + 2, 'kick', 0.3, 0.3);
  }
  b.fig('p1', 0, shift(YEAR_LEAD, -depth), K, 1, 0.3, { duty: 1, ...KEEP, det: -depth * 8 }, 0.95);
  b.fig('p1', 8, shift(YEAR_LEAD, -depth - 1), K, 1, 0.28, { duty: 1, ...KEEP, det: -depth * 9 }, 0.95);
  b.n('x', 0, K(-depth) + 12, 15, 0.1, { sus: 1, a: 3, bend: -depth * 0.4 });
  // The tempo sinks with the notes.
  const bpm0 = c.bpm * Math.pow(0.92, depth - 1), bpm1 = c.bpm * Math.pow(0.92, depth);
  return b.out({ tempo: [[0, bpm0], [16, bpm1]] });
}

export const chasm: TrackDef = {
  slip: 0.1, bendy: 0.15, bpm: 76, start: 'sink', vary: 0.3, wrong: 0.03, echo: 0.5, wobble: 12, tint: 'year', key: K_CHASM, motifs: ['year'],
  next: (cur, c) => (cur === 'bottom' ? 'sink' : (c.st.depth ?? 0) >= 6 ? 'bottom' : 'sink'),
  secs: { sink: (c) => chasmSec(c, 'sink'), bottom: (c) => chasmSec(c, 'bottom') },
};

// ---------------------------------------------------------------- despair

const K_DESP = key(49, MODE.aeo);

function despairSec(c: Ctx, kind: 'fall' | 'low' | 'cluster'): Section {
  const r = c.r, K = K_DESP, b = new B(16, 4, c.bpm);
  b.mot('year', 'void');
  if (kind === 'fall') {
    // A line that steps down a semitone at a time and never gets up.
    let p = K(4) + 12;
    for (let i = 0; i < 8; i++) {
      b.n('x', i * 2, p, 3, 0.16 - i * 0.012, { sus: 1, a: 0.3, bend: -0.5 });
      p -= r.pick([1, 1, 2]);
    }
    bassLine(b, 'tri', 0, YEAR_BASS, K, 0, 30, 0.4, { det: -90 }, 0.5);
    bassLine(b, 'tri', 8, YEAR_BASS, K, 5, 30, 0.36, { det: -110 }, 0.5);
    b.fig('p1', 4, PILGRIM_HEAD.slice(0, 1), K, 1, 0.14, { duty: 3, a: 0.2, ...KEEP }, 0.95);
  } else if (kind === 'low') {
    b.n('tri', 0, 28 + r.int(4), 16, 0.5, { a: 3, det: -30 });
    b.n('tri', 8, 31, 8, 0.4, { a: 2 });
    b.hit(0, 'rumble', 0.2, 16, { a: 5 });
    if (r.chance(0.7)) b.n('x', 6 + r.int(4), K(r.pick([0, 3, 4])) + 12, 4, 0.1, { sus: 1, a: 1.5 });
  } else {
    // Four notes a half step apart cannot fit on two channels, so the pulses hold the rest.
    b.n('x', 0, K(0) + 12, 9, 0.1, { sus: 1, a: 4 }).n('x', 0, K(1) + 12.5, 9, 0.1, { sus: 1, a: 4 });
    b.n('p1', 0, K(3) + 13, 9, 0.08, { duty: 3, a: 4 }).n('p2', 0, K(6) + 13.5, 9, 0.08, { duty: 3, a: 4 });
    b.n('tri', 0, 33, 9, 0.45, { a: 3 });
    b.hit(9, 'crack', 0.4, 0.05);
  }
  return b.out();
}

export const despair: TrackDef = {
  slip: 0.1, bendy: 0.2, level: 1.5, bpm: 46, start: 'fall', vary: 0.3, wrong: 0.04, echo: 0.7, wobble: 14, tint: 'year', key: K_DESP, motifs: ['year', 'void'],
  graph: { fall: [['low', 3], ['cluster', 2], ['fall', 1]], low: [['fall', 3], ['cluster', 2]], cluster: [['fall', 2], ['low', 3]] },
  secs: { fall: (c) => despairSec(c, 'fall'), low: (c) => despairSec(c, 'low'), cluster: (c) => despairSec(c, 'cluster') },
};

// ---------------------------------------------------------------- escape

const K_ESC = key(50, MODE.aeo);

function escapeSec(c: Ctx, kind: 'run' | 'leap'): Section {
  const r = c.r, K = K_ESC;
  const prev = c.st.bpm ?? c.bpm;
  const next = Math.min(188, prev + 3);
  c.st.bpm = next;
  const b = new B(16, 4, prev);
  b.mot('year', 'pilgrim');
  const roots = floatProg(r, 4, 0, 0.3);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = roots[i], low = fold(K(R), 33);
    for (let s = 0; s < 8; s++) b.n('tri', t0 + s * 0.5, low + (s % 2 ? 12 : 0), 0.4, 0.5);
    if (kind === 'run') {
      for (const t of [0, 2, 2.5]) b.hit(t0 + t, 'kick', 0.45, 0.2);
      b.hit(t0 + 1, 'snare', 0.34, 0.12).hit(t0 + 3, 'snare', 0.34, 0.12);
      for (let s = 0; s < 16; s++) if (s % 2) b.hit(t0 + s * 0.25, 'hat', 0.1, 0.05);
    }
  }
  if (kind === 'run') {
    const lead = shift(YEAR_LEAD, 1);
    b.fig('p1', 0, aug(lead, 0.5), K, 1, 0.34, { duty: 1, ...KEEP }, 0.85);
    b.fig('p1', 4, aug(shift(YEAR_LEAD, 0), 0.5), K, 1, 0.34, { duty: 1, ...KEEP }, 0.85);
    const line = walkBars(r, 4, [roots[2], roots[3]], 4, { lo: 2, hi: 9, grid: 0.25 });
    b.line('p1', 8, toPitch(line, K, 1), 0.3, { ...MEL, duty: 1 }, 0.8);
    b.fig('x', 12, PILGRIM_HEAD, K, 1, 0.2, { ...KEEP, ratio: 3.5 }, 0.9);
  } else {
    for (let i = 0; i < 32; i++) b.n('p1', i * 0.25, K(Math.floor(i / 2)) + 12, 0.2, 0.25, { duty: 0 });
    b.hit(8, 'sweep', 0.3, 7, { n: 50 });
    for (let i = 0; i < 8; i++) b.hit(8 + i * 0.5, 'snare', 0.15 + i * 0.03, 0.1);
  }
  return b.out({ tempo: [[0, prev], [16, next]] });
}

export const escape: TrackDef = {
  slip: 0.08, level: 0.85, bpm: 160, start: 'run', vary: 0.5, wrong: 0.03, echo: 0.18, wobble: 6, tint: 'year', key: K_ESC, motifs: ['year', 'pilgrim'],
  graph: { run: [['run', 3], ['leap', 1]], leap: [['run', 1]] },
  secs: { run: (c) => escapeSec(c, 'run'), leap: (c) => escapeSec(c, 'leap') },
};
