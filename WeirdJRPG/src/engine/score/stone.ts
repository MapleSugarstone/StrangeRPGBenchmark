// The Stone-Deep: spire, vault, void, choice, seer.
import { B, KEEP, MODE, aug, colorTones, fold, floatProg, key, padTo, prog, shift } from './lib';
import type { Ctx, Section, TrackDef } from './lib';
import { LIGHTBOUND, PILGRIM_HEAD, PILGRIM_TAIL, SEER, STONE, VOID } from './motifs';
import { arp, bassLine, chimes, rhy, toPitch, walk } from './kit';

// ---------------------------------------------------------------- spire

const K_SPIRE = key(61, MODE.lyd);
const FACETS = [[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 4, 3, 1, 4, 2, 0], [4, 3, 2, 1, 0, 1, 2, 3], [0, 1, 2, 3, 4, 4, 3, 2, 1, 0]];

function spireSec(c: Ctx, kind: 'arp' | 'chords' | 'rise'): Section {
  const r = c.r, K = K_SPIRE, b = new B(16, 4, c.bpm);
  b.mot('stone');
  const roots = floatProg(r, 4, kind === 'rise' ? 0 : r.pick([0, 2, 5]), 0.15);
  const shape = r.pick(FACETS);
  for (let i = 0; i < 4; i++) {
    const t0 = i * 4, R = kind === 'rise' ? i * 1 : roots[i];
    const tones = colorTones(K, R, 'nin', 60);
    b.n('tri', t0, fold(K(R), 36), 3.9, 0.5, { a: 0.1 });
    if (kind !== 'chords') {
      arp(b, 'p2', t0, 4, 0.25, tones, shape, 0.11 + (kind === 'rise' ? i * 0.02 : 0), { duty: 0 }, 1.3);
      // The same facets a quarter tone off, three sixteenths behind: a harmonic that should not exist.
      const off = r.pick([0.5, 0.5, -0.5, 0]);
      for (let s = 0; s < 16; s += 3) {
        const idx = shape[s % shape.length];
        b.n('x', t0 + s * 0.25 + 0.75, tones[idx % tones.length] + 12 + off, 0.9, 0.1, { a: 0.003 });
      }
    } else {
      b.n('x', t0, tones[0] + 12, 3.8, 0.13, { sus: 1, a: 0.4 });
      b.n('x', t0, tones[1] + 12 + 0.5, 3.8, 0.1, { sus: 1, a: 0.6 });
      b.n('p2', t0, tones[3], 3.8, 0.1, { duty: 0, a: 0.2 });
    }
    if (i % 2 === 0) b.hit(t0, 'tick', 0.1, 0.03);
  }
  const head = kind === 'chords' ? aug(STONE, 2) : STONE;
  b.fig('p1', kind === 'chords' ? 0 : 8, head, K, 1, 0.22, { duty: 0, ...KEEP }, 0.8);
  return b.out();
}

export const spire: TrackDef = {
  slip: 0.08, bendy: 0.05, bpm: 92, start: 'arp', vary: 0.4, wrong: 0.04, echo: 0.62, wobble: 3, tint: 'stone', key: K_SPIRE, motifs: ['stone'],
  graph: { arp: [['arp', 1], ['chords', 2], ['rise', 2]], chords: [['arp', 3], ['rise', 1]], rise: [['arp', 3], ['chords', 2]] },
  secs: { arp: (c) => spireSec(c, 'arp'), chords: (c) => spireSec(c, 'chords'), rise: (c) => spireSec(c, 'rise') },
};

// ---------------------------------------------------------------- vault

const K_VAULT = key(57, MODE.acou);

function vaultSec(c: Ctx, kind: 'crystal' | 'quote' | 'books'): Section {
  const r = c.r, K = K_VAULT, b = new B(kind === 'quote' ? 32 : 16, 4, c.bpm);
  b.mot('stone');
  const bars = b.beats / 4;
  const roots = floatProg(r, bars, 0, 0.15);
  const shape = r.pick(FACETS);
  for (let i = 0; i < bars; i++) {
    const t0 = i * 4, R = roots[i];
    const tones = colorTones(K, R, 'nin', 57);
    b.n('tri', t0, fold(K(R), 33), 3.9, 0.45, { a: 0.3 });
    // The pulse voices hold the pad so the bell voice stays free for chimes and for the quoted tune.
    if (kind !== 'books') arp(b, 'p2', t0, 4, 0.5, tones, shape, 0.08, { duty: 0 }, 1.2);
    if (i % 2 === 0) b.n(kind === 'books' ? 'p2' : 'p1', t0, tones[2] + (i % 4 === 0 ? 0.5 : 0), 7.5, 0.07, { duty: 3, a: 1.6 });
  }
  if (kind === 'quote') {
    // Light-Bound #123's tune at a quarter of its speed, as if remembered from very far away.
    b.mot('lightbound');
    b.fig('x', 2, aug(LIGHTBOUND, 4), K, 1, 0.2, { ...KEEP, ratio: 3.5 }, 0.95);
  } else {
    if (kind === 'books') {
      b.mot('pilgrim');
      b.fig('p1', 3, PILGRIM_HEAD, K, 1, 0.14, { duty: 0, a: 0.05, ...KEEP }, 0.95);
      b.fig('p1', 10, PILGRIM_TAIL, K, 1, 0.12, { duty: 0, a: 0.05, ...KEEP }, 0.95);
    }
    chimes(b, c, K, kind === 'books' ? 5 + r.int(3) : 1 + r.int(4), 0.2, { oct: 1, stretch: r.range(1.1, 1.6), echo: r.pick([1, 2]), max: 4 });
  }
  return b.out();
}

export const vault: TrackDef = {
  slip: 0.06, bendy: 0.08, bpm: 66, start: 'crystal', vary: 0.4, wrong: 0.04, echo: 0.64, wobble: 4, tint: 'stone', key: K_VAULT, motifs: ['stone', 'lightbound'],
  graph: { crystal: [['crystal', 1], ['quote', 2], ['books', 2]], quote: [['crystal', 2], ['books', 2]], books: [['crystal', 2], ['quote', 2]] },
  secs: { crystal: (c) => vaultSec(c, 'crystal'), quote: (c) => vaultSec(c, 'quote'), books: (c) => vaultSec(c, 'books') },
};

// ---------------------------------------------------------------- void

const K_VOID = key(38, MODE.phr);

function voidSec(c: Ctx, kind: 'tone' | 'rest' | 'drop'): Section {
  const r = c.r, K = K_VOID, b = new B(kind === 'rest' ? 24 : 20, 4, c.bpm);
  b.mot('void');
  if (kind === 'tone') {
    // The same two low notes and long rests, set a little differently each time.
    const lo = r.pick([0, 0, 0, 1, -2]);
    b.fig('tri', r.pick([0, 0, 1]), shift(VOID, lo), K, 0, 0.62, { a: 2.5, ...KEEP }, 1);
    b.n('p1', 0.5, K(lo) + 12, 4.5, 0.06, { duty: 3, a: 3, det: r.pick([10, 14, 19]) });
    b.n('x', 9 + r.int(3), K(-3 + lo) + 12, 3, 0.1, { sus: 1, a: 1.5 });
    b.hit(0, 'rumble', 0.1, 12, { a: 5 });
  } else if (kind === 'rest') {
    // Almost nothing: one far note somewhere in the dark.
    b.n('x', 4 + r.int(12), K(r.pick([0, 4, 7])) + 24, 6, 0.1, { sus: 1, a: 2 });
    b.n('tri', r.int(3), K(0), 2, 0.3, { a: 1 });
    if (r.chance(0.5)) b.hit(10 + r.int(10), 'hush', 0.08, 4, { a: 1.5 });
  } else {
    b.n('tri', r.int(3), K(0) + 7, 9, 0.6, { a: 1.5, bend: -7 });
    b.n('x', 2 + r.int(3), K(0) + 24, 8, 0.1, { sus: 1, a: 2, bend: -3.5 });
    b.hit(11, 'rumble', 0.15, 6, { a: 2.5 });
  }
  return b.out();
}

export const voidTrack: TrackDef = {
  bendy: 0.1, level: 0.8, bpm: 40, start: 'tone', vary: 0.2, wrong: 0.03, echo: 0.8, wobble: 14, tint: 'void', key: K_VOID, motifs: ['void'],
  graph: { tone: [['rest', 3], ['drop', 2], ['tone', 1]], rest: [['tone', 3], ['drop', 1]], drop: [['rest', 3], ['tone', 2]] },
  secs: { tone: (c) => voidSec(c, 'tone'), rest: (c) => voidSec(c, 'rest'), drop: (c) => voidSec(c, 'drop') },
};

// ---------------------------------------------------------------- choice

const K_CHOICE = key(38, MODE.aeo);

function choiceSec(c: Ctx, kind: 'res' | 'swell'): Section {
  const r = c.r, K = K_CHOICE, b = new B(24, 4, c.bpm);
  b.mot('choice');
  // One deep resonance, held. Overtones come and go above it without a tune, one at a time.
  b.n('tri', 0, K(0), 24, 0.6, { a: 4 });
  b.hit(0, 'rumble', 0.1, 24, { a: 8 });
  const partials = kind === 'swell' ? [12, 19, 24] : r.chance(0.5) ? [12, 19] : [19, 12];
  partials.forEach((p, i) => b.n('x', 1 + i * 8 + r.int(2), K(0) + p, 8, 0.08, { sus: 1, a: 4, ratio: 1 }));
  if (r.chance(0.8)) chimes(b, c, K, 4 + r.int(8), 0.16, { oct: 1, stretch: r.range(1.4, 2.2), echo: r.pick([2, 3]), max: 4 });
  return b.out();
}

export const choice: TrackDef = {
  level: 0.8, bpm: 36, start: 'res', vary: 0.1, wrong: 0.02, echo: 0.75, wobble: 12, tint: 'void', key: K_CHOICE, motifs: ['choice'],
  graph: { res: [['res', 2], ['swell', 2]], swell: [['res', 3]] },
  secs: { res: (c) => choiceSec(c, 'res'), swell: (c) => choiceSec(c, 'swell') },
};

// ---------------------------------------------------------------- seer

const K_SEER = key(53, MODE.ion);

function seerSec(c: Ctx, kind: 'read' | 'reply'): Section {
  const r = c.r, K = K_SEER, b = new B(24, 4, c.bpm);
  b.mot('seer');
  const fig = padTo(SEER, 4);
  const roots = prog(r, [0, 5, 3, 4, 0, 5, 1, 4], { 5: [5, 2], 3: [3, 1] }, 0.25);
  roots[5] = 4;
  for (let i = 0; i < 6; i++) {
    const t0 = i * 4, R = roots[i % roots.length];
    bassLine(b, 'tri', t0, [[0, 2], [4, 2]], K, R, 36, 0.45, { a: 0.1 }, 0.95);
    const ch = colorTones(K, R, 'tri', 57);
    arp(b, 'p2', t0, 4, 0.5, ch, [0, 1, 2, 1, 2, 1, 0, 1], 0.07, { duty: 3, a: 0.05 }, 1.2);
    b.n('x', t0, ch[1] + 12, 3.9, 0.08, { sus: 1, a: 0.8, ratio: 1 });
  }
  // The first phrase states, the second answers a third higher, the last stops at a comma.
  b.fig('p1', 0, fig, K, 0, 0.3, { duty: 3, a: 0.06, ...KEEP }, 0.97);
  b.fig('p1', 12, kind === 'reply' ? shift(fig, 2) : shift(fig, -1), K, 0, 0.3, { duty: 3, a: 0.06, ...KEEP }, 0.97);
  const line = walk(r, [...rhy(r, 4), ...rhy(r, 4)], 2, [4, 6, 1], { lo: 0, hi: 7, rest: 0.1 });
  if (r.chance(0.5)) b.line('x', 20, toPitch(line, K, 1), 0.1, { ratio: 2 }, 0.9);
  return b.out();
}

export const seer: TrackDef = {
  slip: 0.03, bendy: 0.1, bpm: 56, start: 'read', vary: 0.3, wrong: 0.03, echo: 0.5, wobble: 5, tint: 'sea', key: K_SEER, motifs: ['seer'],
  graph: { read: [['reply', 3], ['read', 1]], reply: [['read', 3], ['reply', 1]] },
  secs: { read: (c) => seerSec(c, 'read'), reply: (c) => seerSec(c, 'reply') },
};
