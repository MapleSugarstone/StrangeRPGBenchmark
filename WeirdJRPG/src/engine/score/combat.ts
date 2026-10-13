// Battle music: battle, miniboss, boss, keeper, lightbound, guardian.
import type { AreaTint } from '../audio';
import { B, KEEP, MEL, MODE, colorTones, floatProg, fold, key, padTo, prog, realize, shift } from './lib';
import type { Ctx, Key, Line, MotifName, Section, TrackDef } from './lib';
import { KEEPER, STONE, UNRAVEL, VORN, YEAR_BASS, pilgrim } from './motifs';
import { arp, bassLine, gears, toPitch, walkBars } from './kit';
import { lbTune, motifBlock, polka } from './blocks';

/** Key and speed of a fight in each area's palette. */
export const CK: Record<AreaTint, { K: Key; bpm: number }> = {
  brass: { K: key(45, MODE.phr), bpm: 148 },
  sea: { K: key(50, MODE.dor), bpm: 138 },
  year: { K: key(52, MODE.aeo), bpm: 126 },
  stone: { K: key(49, MODE.hmin), bpm: 144 },
  void: { K: key(41, MODE.loc), bpm: 116 },
};

/** One bar of the area's drum kit. Kicks and backbeats never share an instant. */
function kitBar(b: B, t: number, tint: AreaTint, g: number) {
  switch (tint) {
    case 'brass':
      b.hit(t, 'kick', 0.5 * g, 0.2).hit(t + 2, 'kick', 0.45 * g, 0.2);
      b.hit(t + 1, 'gear', 0.4 * g, 0.1, { n: 64 }).hit(t + 3, 'gear', 0.4 * g, 0.1, { n: 70 });
      for (let k = 0; k < 4; k++) b.hit(t + k + 0.5, 'tick', 0.1 * g, 0.04);
      break;
    case 'sea':
      b.hit(t, 'kick', 0.42 * g, 0.28).hit(t + 2.5, 'kick', 0.36 * g, 0.28);
      b.hit(t + 1, 'snare', 0.3 * g, 0.12).hit(t + 3, 'snare', 0.3 * g, 0.12);
      for (let k = 0; k < 4; k++) b.hit(t + k + 0.5, 'drip', 0.1 * g, 0.06);
      break;
    case 'year':
      for (const k of [0, 2, 3.5]) b.hit(t + k, 'kick', 0.5 * g, 0.2);
      b.hit(t + 1, 'clap', 0.34 * g, 0.12).hit(t + 3, 'clap', 0.34 * g, 0.12);
      for (let k = 0; k < 4; k++) b.hit(t + k + 0.5, 'hat', 0.13 * g, 0.06);
      break;
    case 'stone':
      b.hit(t, 'tom', 0.4 * g, 0.2, { n: 50 }).hit(t + 0.75, 'tom', 0.3 * g, 0.2, { n: 53 }).hit(t + 2, 'tom', 0.4 * g, 0.2, { n: 57 });
      b.hit(t + 1, 'crack', 0.34 * g, 0.05).hit(t + 3, 'crack', 0.34 * g, 0.05);
      for (let k = 0; k < 4; k++) b.hit(t + k + 0.5, 'tick', 0.1 * g, 0.04);
      break;
    case 'void':
      b.hit(t, 'kick', 0.6 * g, 0.4).hit(t + 2, 'stamp', 0.4 * g, 0.2);
      b.hit(t + 3.5, 'rumble', 0.2 * g, 0.5, { a: 0.2 });
      break;
  }
}

/** Fight sections shared by battle, miniboss, and boss. w is 0 for battle, 1 for miniboss, 2 for boss. */
function fightSec(c: Ctx, kind: 'a' | 'b' | 'c' | 'bridge', w: 0 | 1 | 2): Section {
  const r = c.r, T = CK[c.tint], K = T.K;
  const bpm = T.bpm * (w === 1 ? 0.9 : w === 2 ? 0.94 + 0.12 * c.int : 1);
  const short = w === 1 && kind === 'a';
  const b = new B(short ? 15.5 : 16, 4, bpm);
  const bars = 4;
  b.mot('vorn');
  const roots = kind === 'bridge' ? [0, 0, 0, 6] : kind === 'c' ? floatProg(r, 4, 5, 0.2) : prog(r, [0, 5, 0, 6], { 5: [5, 3], 6: [6, 4] }, 0.3);
  for (let i = 0; i < bars; i++) {
    const t0 = i * 4, R = roots[i];
    if (kind !== 'bridge') kitBar(b, t0, c.tint, 1);
    else if (i % 2 === 0) { b.hit(t0, 'stamp', 0.5, 0.25); b.hit(t0 + 2, 'stamp', 0.4, 0.25); }
    // Intensity layers: a fuller pulse from 0.3, a double kick from 0.5, a pad and bass octave from 0.67.
    if (kind !== 'bridge') {
      arp(b, 'p2', t0, 4, 0.25, colorTones(K, R, 'tri', 57), [0, 1, 2, 1], 0.09, { duty: 0, lay: 0.3 }, 1.2);
      if (w === 2) {
        for (const k of [0.5, 1.5, 2.5, 3.5]) b.hit(t0 + k, 'kick', 0.3, 0.12, { lay: 0.5 });
        b.n('x', t0, K(R) + 12 + (i % 2 ? 0.5 : 0), 3.9, 0.1, { sus: 1, a: 0.3, lay: 0.67 });
      }
    }
  }
  // Bass.
  const march = padTo(VORN, 4);
  if (kind === 'a' || kind === 'bridge') {
    for (let h = 0; h < 2; h++) bassLine(b, 'tri', h * 8, march, K, roots[h * 2], 33, 0.55, {}, 0.72);
  } else {
    for (let i = 0; i < bars; i++) {
      const t0 = i * 4, low = fold(K(roots[i]), 33);
      if (c.tint === 'year') bassLine(b, 'tri', t0, YEAR_BASS, K, roots[i], 33, 0.55, {}, 0.8);
      else for (let s = 0; s < 8; s++) b.n('tri', t0 + s * 0.5, low + (s % 4 === 3 ? 7 : s % 2 ? 12 : 0), 0.4, s % 2 ? 0.42 : 0.52);
    }
  }
  // Lead. The boss's chorus carries the Pilgrim's figure.
  if (kind !== 'bridge') {
    const riff = walkBars(r, 4, [roots[0], roots[1]], r.pick([2, 4]), { lo: 1, hi: 8, rest: 0.08 });
    const riff2 = walkBars(r, 4, [roots[2], roots[3]], r.pick([2, 4]), { lo: 1, hi: 8, rest: 0.08 });
    const pil = w === 2 && kind === 'b';
    if (pil) b.mot('pilgrim');
    const lead0: Line = pil ? realize(pilgrim(Math.max(c.prog, 0.3), r), K, 1) : toPitch(riff, K, 1);
    b.line('p1', 0, lead0, 0.38, { duty: 1, ...(pil ? KEEP : MEL) }, 0.88);
    b.line('x', 0, lead0.map(([p, l]): [number | null, number] => [p === null ? null : p + 12, l]), 0.1, { lay: 0.6 }, 0.8);
    b.line('p1', 8, toPitch(riff2, K, 1), 0.36, { ...MEL, duty: 1 }, 0.85);
  }
  // Area colors. The Unraveling's cog drives miniboss and boss fights in every area.
  if (w !== 0) {
    b.mot('unravel');
    for (let i = 0; i < bars; i++) bassLine(b, 'p2', i * 4, UNRAVEL, K, roots[i], 45, 0.15, { duty: 0, top: 0.3 }, 0.5);
    if (c.tint === 'brass') gears(b, 0, 16, 0.5, 0.12, [0, 3, 6], 8, { top: 0.5 });
  }
  if (kind !== 'bridge') for (let i = 0; i < bars; i++) for (const k of [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75]) b.hit(i * 4 + k, 'tick', 0.08, 0.03, { lay: 0.5 });
  if (c.tint === 'stone') b.fig('x', 0, STONE, K, 2, 0.1, { top: 0.6 }, 0.8);
  if (c.tint === 'void') b.n('x', 0, K(0) + 12, 15, 0.1, { sus: 1, a: 2, top: 0.5 });
  b.n('x', 0, K(roots[0]) + 12, 15.5, 0.07, { sus: 1, a: 3, top: 0.3 });
  return b.out(short ? { tag: 'seven' } : undefined);
}

const FIGHT_GRAPH: TrackDef['graph'] = {
  a: [['b', 4], ['a', 1], ['c', 1]],
  b: [['a', 3], ['c', 2], ['b', 1]],
  c: [['a', 3], ['b', 2]],
};

export const battle: TrackDef = {
  tame: true, bpm: 148, start: 'a', vary: 0.6, wrong: 0.04, echo: 0.25, wobble: 5, tint: 'brass', key: CK.brass.K, keyFor: (t) => CK[t].K, motifs: ['vorn'],
  graph: FIGHT_GRAPH,
  secs: { a: (c) => fightSec(c, 'a', 0), b: (c) => fightSec(c, 'b', 0), c: (c) => fightSec(c, 'c', 0) },
};

export const miniboss: TrackDef = {
  tame: true, bpm: 134, start: 'a', vary: 0.5, wrong: 0.04, echo: 0.25, wobble: 5, tint: 'brass', key: CK.brass.K, keyFor: (t) => CK[t].K, motifs: ['vorn', 'unravel'],
  graph: FIGHT_GRAPH,
  secs: { a: (c) => fightSec(c, 'a', 1), b: (c) => fightSec(c, 'b', 1), c: (c) => fightSec(c, 'c', 1) },
};

export const boss: TrackDef = {
  tame: true, bpm: 140, start: 'a', vary: 0.5, wrong: 0.04, echo: 0.3, wobble: 6, tint: 'brass', key: CK.brass.K, keyFor: (t) => CK[t].K, motifs: ['vorn', 'unravel', 'pilgrim'],
  // The break section belongs to the last phase, so it is rare until the intensity is high.
  next: (cur, c) => {
    const hi = c.int >= 0.75;
    const opts: Record<string, ReadonlyArray<readonly [string, number]>> = {
      a: [['b', 4], ['bridge', 1], ['a', 1]],
      b: [['a', 3], ['bridge', 2], ['c', hi ? 3 : 0.3]],
      c: [['a', 3], ['b', 2]],
      bridge: [['b', 3], ['a', 1]],
    };
    return c.r.weighted(opts[cur]);
  },
  secs: { a: (c) => fightSec(c, 'a', 2), b: (c) => fightSec(c, 'b', 2), c: (c) => fightSec(c, 'c', 2), bridge: (c) => fightSec(c, 'bridge', 2) },
};

// ---------------------------------------------------------------- keeper

const K_KEEP = key(47, MODE.loc);

function keeperSec(c: Ctx, kind: 'type' | 'ding' | 'count'): Section {
  const r = c.r, K = K_KEEP;
  const b = new B(kind === 'ding' ? 8 : 16, 4, 132);
  b.mot('keeper');
  if (kind === 'type') {
    for (let i = 0; i < 4; i++) {
      const t0 = i * 4;
      b.fig('p1', t0, shift(KEEPER, i === 3 ? r.pick([1, -1, 2]) : r.pick([0, 0, 0, 1])), K, 1, 0.34, { duty: 0, ...KEEP }, 0.6);
      b.fig('p2', t0, KEEPER, K, 2, 0.1, { duty: 0, lay: 0.35, ...KEEP }, 0.5);
      for (let s = 0; s < 16; s++) if (!r.chance(0.12)) b.hit(t0 + s * 0.25, 'type', s % 4 === 0 ? 0.3 : 0.16, 0.04);
      const walkTri = r.pick([[0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 1, 0, 0, 0, 3, 0], [0, 1, 0, 1, 0, 0, 1, 0]]);
      for (let s = 0; s < 8; s++) b.n('tri', t0 + s * 0.5, fold(K(0), 33) + walkTri[s], 0.4, 0.5);
      b.n('x', t0 + r.pick([2.7, 3.2, 3.4]), K(0) + r.pick([36, 36, 34, 39]), 0.8, 0.12, { ratio: 4.13 });
      if (r.chance(0.5)) b.hit(t0, 'stamp', 0.4, 0.2, { lay: 0.2 });
      if (i % 2 === 0) {
        b.n('x', t0 + 1, K(0) + 12, 1.8, 0.1, { ratio: 4.13, lay: 0.65 });
        b.n('x', t0 + 1, K(r.pick([1, 3])) + 12, 1.8, 0.1, { ratio: 4.13, lay: 0.65 });
      }
    }
  } else if (kind === 'ding') {
    // The line is full. The machine stops, a bell rings, and the stamps fall one after another.
    b.n('x', 0, K(0) + 36, 3, 0.2, { ratio: 4.13 });
    b.n('tri', 0, fold(K(0), 33), 3, 0.4);
    for (let i = 0; i < 3; i++) b.hit(4 + i * 0.75, 'stamp', 0.5, 0.25);
    b.n('tri', 4, fold(K(0), 33), 3.5, 0.55);
  } else {
    const form = 1 + (c.pass % 7);
    for (let s = 0; s < 16; s++) {
      const n = 1 + Math.floor(s / 2) % form;
      for (let k = 0; k < n; k++) b.n('p2', s + k * (0.5 / n), K(2) + 12 + s % 5, 0.1, 0.12, { duty: 0 });
      b.hit(s, 'type', 0.22, 0.04);
    }
    for (let i = 0; i < 4; i++) b.n('tri', i * 4, fold(K(i % 2 ? 1 : 0), 33), 3.6, 0.5);
    b.fig('p1', 0, KEEPER, K, 1, 0.3, { duty: 0, ...KEEP }, 0.6);
  }
  return b.out();
}

export const keeper: TrackDef = {
  tame: true, bpm: 132, start: 'type', vary: 0.35, wrong: 0.04, echo: 0.1, wobble: 2, tint: 'sea', key: K_KEEP, motifs: ['keeper'],
  graph: { type: [['type', 3], ['ding', 1], ['count', 2]], ding: [['type', 3], ['count', 1]], count: [['type', 3], ['ding', 1]] },
  secs: { type: (c) => keeperSec(c, 'type'), ding: (c) => keeperSec(c, 'ding'), count: (c) => keeperSec(c, 'count') },
};

// ---------------------------------------------------------------- lightbound

const K_LB = key(60, MODE.ion);

function lightboundSec(c: Ctx, kind: 'tune' | 'rot'): Section {
  const r = c.r, K = K_LB;
  // The kitchen tune is clean at first. Each pass and each step of intensity lets more of the Stone in.
  const corrupt = Math.min(1, 0.12 + 0.07 * c.pass + 0.45 * c.int);
  c.st.rot = corrupt;
  const bpm = 132 + corrupt * 36;
  const b = new B(16, 4, bpm);
  b.mot('lightbound', 'stone');
  const roots = prog(r, [0, 0, 3, 4], { 3: [3, 1], 4: [4, 6] }, corrupt * 0.5);
  lbTune(b, c, K, 0, corrupt, 1);
  lbTune(b, c, K, 8, kind === 'rot' ? Math.min(1, corrupt + 0.3) : corrupt, 1);
  polka(b, K, 0, 4, roots, 1, corrupt);
  if (r.chance(corrupt)) {
    for (let i = 0; i < 4; i++) {
      const tones = colorTones(K, roots[i], 'nin', 60);
      arp(b, 'x', i * 4, 4, 0.25, tones, r.pick([[0, 1, 2, 3, 4, 3, 2, 1], [4, 3, 2, 1, 0, 1, 2, 3]]), 0.1 + corrupt * 0.06, { ratio: 5.19 }, 1.2);
    }
  }
  if (kind === 'rot') b.fig('p2', 0, STONE, K, 2, 0.12, { duty: 0, ...KEEP }, 0.7);
  return b.out({ tempo: [[0, bpm], [16, bpm * 1.04]] });
}

export const lightbound: TrackDef = {
  slip: 0.15, bendy: 0.1, level: 1.25, bpm: 132, start: 'tune', vary: 0.5, wrong: 0.2, echo: 0.3, wobble: 8, tint: 'stone', key: K_LB, motifs: ['lightbound', 'stone'],
  graph: { tune: [['tune', 3], ['rot', 2]], rot: [['tune', 3], ['rot', 1]] },
  secs: { tune: (c) => lightboundSec(c, 'tune'), rot: (c) => lightboundSec(c, 'rot') },
};

// ---------------------------------------------------------------- guardian

const K_GUARD = key(50, MODE.aeo);
const K_GUARD_SEER = key(53, MODE.ion);
export const GUARDIAN_ORDER: MotifName[] = ['pilgrim', 'unravel', 'void', 'stone', 'year', 'choice', 'vorn', 'keeper', 'lightbound', 'seer'];

function guardianSec(c: Ctx, name: MotifName): Section {
  const quiet = name === 'void' || name === 'choice';
  const seer = name === 'seer';
  const K = seer ? K_GUARD_SEER : K_GUARD;
  const b = motifBlock(name, c, K, { drums: quiet || seer ? 0 : 2, g: 1, lay: true, corrupt: 0.6 });
  // Under every motif the Guardian keeps a deep drone, and it fades away when the Seer speaks.
  if (!seer) b.n('x', 0, 38, 16, 0.07, { sus: 1, a: 3, lay: 0.2 });
  return b.out({ tag: name });
}

export const guardian: TrackDef = {
  tame: true, bpm: 120, start: 'pilgrim', vary: 0.4, wrong: 0.04, echo: 0.5, wobble: 8, tint: 'stone', key: K_GUARD,
  motifs: [...GUARDIAN_ORDER],
  next: (cur) => GUARDIAN_ORDER[(GUARDIAN_ORDER.indexOf(cur as MotifName) + 1) % GUARDIAN_ORDER.length],
  secs: Object.fromEntries(GUARDIAN_ORDER.map((m) => [m, (c: Ctx) => guardianSec(c, m)])),
};

