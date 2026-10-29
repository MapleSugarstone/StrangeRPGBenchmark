// Tracks of the Lead Market: market, lot, underbridge, and sticks. The Market shares the Long's low sun, so its lead
// notes cast pre-notes an eighth early. In the Underbridge some of those pre-notes are painted.
import { B, MODE, key, type Ctx, type Key, type TrackDef } from './score-core';
import { bounce, chordOn, fifthOf, groove, motif, pad, phrase, rootOf, sing, song, sub, ticks, tones, type Ch, type Mel } from './parts';
import { LOT, LOT_EARLY, TIK } from './motifs';

const C_MIX = key(60, MODE.mix);
const B_DOR = key(59, MODE.dor);
const BB_AEO = key(58, MODE.aeo);
const F_ION = key(65, MODE.ion);

/** Shifts every note of a melody by `dt` beats. */
const early = (m: Mel, dt: number): Mel => m.map(([t, len, d]) => [t + dt, len, d]);

// ---------------------------------------------------------------- market

const MARKET_PROG: Ch[] = [[0, 'add9'], [3, 'add9'], [0, 'add9'], [6, 'add9'], [5, 'sev'], [1, 'sev'], [6, 'add9'], [0, 'add9']];

/** Felt hats muffle everything: brass with its filter mostly shut, stabbing on the offbeats over a tuba bass. */
function marketBand(b: B, K: Key, prog: readonly Ch[], g = 1): void {
  prog.forEach((ch, i) => {
    const t = i * 4;
    b.n('bass', t, rootOf(K, ch, 36), 0.7, 0.4 * g, { cut: 280 });
    b.n('bass', t + 2, fifthOf(K, ch, 36), 0.7, 0.34 * g, { cut: 280 });
    for (const off of [1, 3]) for (const n of tones(K, ch, 55, 3)) b.n('brass', t + off, n, 0.35, 0.16 * g, { cut: 1000 });
    for (const off of [1.5, 3.5]) for (const n of tones(K, ch, 55, 3)) b.n('brass', t + off, n, 0.2, 0.08 * g, { cut: 900, lay: 0 });
  });
}

const market: TrackDef = {
  kind: 'place', key: C_MIX, shadow: 0.5, region: 'market', bpm: 116, start: 'bustle', vary: 0.5, wrong: 0.04, echo: 0.35, level: 1.47,
  graph: { bustle: [['bustle', 2], ['haggle', 1.5], ['stall', 1]], haggle: [['bustle', 2], ['stall', 1]], stall: [['bustle', 1], ['haggle', 1]] },
  secs: {
    bustle: (c) => {
      const b = new B(32, 4, 116);
      marketBand(b, C_MIX, MARKET_PROG);
      groove(b, 0, 8, { clap: '....7.......7...', hat: '4.3.4.3.4.3.4.3.', shaker: '2222222222222222' }, 0.4);
      sing(b, 'cold', 0, song(c, { K: C_MIX, prog: MARKET_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'market' }), C_MIX, 0, 0.3);
      if (c.r.chance(0.5)) for (let k = 0; k < 4; k++) b.n('glass', c.r.int(64) * 0.5, C_MIX(c.r.pick([0, 2, 4, 7])) + 12, 0.8, 0.12, { pan: c.r.range(-0.7, 0.7) });
      return b.out();
    },
    haggle: (c) => {
      const prog: Ch[] = [[0, 'add9'], [6, 'add9'], [3, 'add9'], [4, 'sus4'], [0, 'add9'], [6, 'add9'], [3, 'add9'], [0, 'add9']];
      const b = new B(32, 4, 116);
      marketBand(b, C_MIX, prog, 0.9);
      groove(b, 0, 8, { clap: '....7.......7...', hat: '4.3.4.3.4.3.4.3.' }, 0.4);
      // A seller calls on the brass and a buyer answers on the lead, two bars each.
      for (let k = 0; k < 4; k++) {
        const chords = prog.slice(k * 2, k * 2 + 2);
        const m = phrase(c.r, { K: C_MIX, chords, bar: 4, dens: 2, lo: k % 2 ? 2 : -2, hi: k % 2 ? 9 : 5, cad: k === 3 ? 'home' : 'open' });
        if (k % 2 === 0) for (const [t, len, d] of m) b.n('brass', k * 8 + t, C_MIX(d), len * 0.8, 0.24, { cut: 1500, m: 1 });
        else sing(b, 'cold', k * 8, m, C_MIX, 0, 0.3);
      }
      for (let k = 0; k < 6; k++) b.n('bell', c.r.int(64) * 0.5, C_MIX(c.r.pick([0, 2, 4])) + 24, 0.6, 0.1, { pan: c.r.range(-0.8, 0.8) });
      return b.out();
    },
    stall: (c) => {
      const b = new B(16, 4, 116);
      ([[0, 'add9'], [3, 'add9'], [6, 'add9'], [0, 'add9']] as Ch[]).forEach((ch, i) => {
        chordOn(b, 'bell', C_MIX, i * 4, ch, 2.5, 0.12, { ratio: 1 }, 55);
        b.n('sub', i * 4, rootOf(C_MIX, ch, 36), 3.5, 0.3);
      });
      groove(b, 0, 4, { hat: '4.3.4.3.4.3.4.3.', wood: '....5.......5...' }, 0.32);
      const tune = song(c, { K: C_MIX, prog: MARKET_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'market' }).filter((x) => x[0] < 8);
      for (const [t, len, d] of tune) b.n('glass', t * 2, C_MIX(d) + 12, len * 1.6, 0.18, { pan: 0.3 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- lot

/** Lot plays a sixteenth ahead of a band that keeps strict time. */
function lotBand(b: B, K: Key, prog: readonly Ch[], g = 1): void {
  prog.forEach((ch, i) => {
    bounce(b, K, i * 4, ch, 4, 0.3 * g, { cut: 360 });
    pad(b, K, i * 4, ch, 4, 0.16 * g);
  });
  groove(b, 0, prog.length, { kick: '9.......9.......', snare: '....6.......6...', hat: '3.2.3.2.3.2.3.2.' }, 0.4 * g);
}

const LOT_PROG: Ch[] = [[0, 'sev'], [0, 'sev'], [3, 'add9'], [3, 'add9'], [2, 'add9'], [6, 'add9'], [0, 'sev'], [0, 'sev']];

const lot: TrackDef = {
  kind: 'scene', key: B_DOR, shadow: 0.5, bpm: 100, start: 'early', vary: 0.35, wrong: 0.05, echo: 0.5, level: 1.13,
  next: (cur, c) => {
    if (cur !== 'early') return 'early';
    return c.r.weighted([['early', 1], ['slip', 1], ['body', c.chapter >= 6 ? 1 : 0]]);
  },
  secs: {
    early: (c) => {
      const b = new B(32, 4, 100);
      lotBand(b, B_DOR, LOT_PROG);
      motif(b, 'cold', 4 + LOT_EARLY, LOT, B_DOR, 1, 0.32);
      motif(b, 'cold', 12 + LOT_EARLY, LOT, B_DOR, 1, 0.3);
      const m = phrase(c.r, { K: B_DOR, chords: LOT_PROG.slice(4), bar: 4, dens: 2, lo: 3, hi: 10, cad: 'home' });
      sing(b, 'cold', 0, early(m.map(([t, len, d]) => [t + 16, len, d]), LOT_EARLY), B_DOR, 0, 0.3);
      return b.out();
    },
    slip: (c) => {
      const b = new B(16, 4, 100);
      b.hit(0, 'hiss', 0.12, 16, { a: 0.5 });
      sub(b, B_DOR, 0, [0], 16, 0.3);
      pad(b, B_DOR, 0, [0, 'sev'], 8, 0.14);
      pad(b, B_DOR, 8, [6, 'add9'], 8, 0.14);
      // Lot slips through the shade: its first three notes jump octaves, each still a sixteenth early.
      for (let k = 0; k < 4; k++) motif(b, 'cold', k * 4 + 1 + LOT_EARLY, LOT.slice(0, 3), B_DOR, k % 2, 0.28);
      for (let k = 0; k < 8; k++) b.n('pluck', k * 2 + 1.5 + LOT_EARLY, B_DOR(c.r.pick([0, 2, 4])), 0.3, 0.14, { pan: k % 2 ? 0.4 : -0.4 });
      if (c.chapter >= 6) for (let k = 0; k < 16; k++) b.hit(k, 'click', 0.18, 0.05, { pan: -0.2 });
      return b.out();
    },
    body: (c) => {
      const b = new B(16, 4, 100);
      lotBand(b, B_DOR, [[0, 'sev'], [3, 'add9'], [2, 'add9'], [0, 'sev']], 0.8);
      for (let k = 0; k < 4; k++) if (c.r.chance(0.5)) b.n('pluck', k * 4 + 3.5 + LOT_EARLY, B_DOR(c.r.pick([0, 2, 4])) + 12, 0.3, 0.12);
      // Body and lead together: Tik's notes on the beat, and Lot's, the same notes a sixteenth ahead as their lead.
      motif(b, 'lead', 4, TIK, B_DOR, 1, 0.3, { nos: 1 });
      motif(b, 'cold', 4 + LOT_EARLY, LOT, B_DOR, 1, 0.24, { nos: 1 });
      for (let k = 0; k < 16; k++) b.hit(k, 'click', 0.14, 0.05, { pan: -0.2 });
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- underbridge

const UNDER_PROG: Ch[] = [[0, 'sev'], [3, 'sev'], [0, 'sev'], [5, 'add9'], [3, 'sev'], [4, 'sev'], [5, 'add9'], [0, 'sev']];

function sneakBand(b: B, c: Ctx, K: Key, prog: readonly Ch[]): void {
  prog.forEach((ch, i) => {
    const t = i * 4;
    const r = rootOf(K, ch, 40);
    const line = [r, r + 7, K(ch[0] + 2) - 12 * Math.round((K(ch[0] + 2) - r - 4) / 12), r + 7];
    for (let k = 0; k < 8; k++) if (k % 2 === 0 || c.r.chance(0.35)) b.n('pluck', t + k * 0.5, line[(k >> 1) % 4], 0.3, k % 2 ? 0.16 : 0.24);
    for (const n of tones(K, ch, 55, 3)) b.n('brass', t + 1.5, n, 0.25, 0.1, { cut: 900 });
    b.n('sub', t, rootOf(K, ch, 34), 4, 0.24);
  });
  groove(b, 0, prog.length, { hat: '3.13.13.3.13.13.', kick: '7.....5.........', snare: '....4.......4..2' }, 0.36);
}

const underbridge: TrackDef = {
  kind: 'place', key: BB_AEO, shadow: 0.5, region: 'market', bpm: 92, start: 'sneak', vary: 0.45, wrong: 0.05, echo: 0.55, level: 1.5,
  graph: { sneak: [['sneak', 2], ['paint', 1]], paint: [['sneak', 1]] },
  secs: {
    sneak: (c) => {
      const b = new B(32, 4, 92);
      sneakBand(b, c, BB_AEO, UNDER_PROG);
      sing(b, 'cold', 0, song(c, { K: BB_AEO, prog: UNDER_PROG, bar: 4, dens: 2, lo: 0, hi: 8, slot: 'underbridge' }), BB_AEO, 1, 0.28);
      for (let k = 0; k < 5; k++) b.n('blip', c.r.int(64) * 0.5, BB_AEO(c.r.pick([0, 2, 4, 7])) + 24, 0.2, 0.12, { pan: c.r.range(-0.8, 0.8) });
      return b.out({ paint: 0.35 });
    },
    paint: (c) => {
      const b = new B(16, 4, 92);
      b.n('drone', 0, 34, 16, 0.32, { a: 1 });
      ([[0, 'sev'], [5, 'add9'], [3, 'sev'], [4, 'sev']] as Ch[]).forEach((ch, i) => {
        pad(b, BB_AEO, i * 4, ch, 4, 0.14);
        for (let k = 0; k < 4; k++) b.n('pluck', i * 4 + k + 0.5, BB_AEO(c.r.pick([0, 2, 4])), 0.3, 0.14);
      });
      // The Painter smears: long notes sliding into their neighbors, and pre-notes painted on with a hard edge.
      const m = phrase(c.r, { K: BB_AEO, chords: [[0, 'sev'], [5, 'add9'], [3, 'sev'], [4, 'sev']], bar: 4, dens: 0, lo: 2, hi: 9, cad: 'open' });
      for (const [t, len, d] of m) {
        const step = c.r.pick([1, -1, 2]);
        b.n('lead', t, BB_AEO(d) + 12, len * 0.95, 0.3, { m: 1, bend: len >= 1 ? BB_AEO(d + step) - BB_AEO(d) : 0, cut: 1300 });
      }
      return b.out({ paint: 0.5 });
    },
  },
};

// ---------------------------------------------------------------- sticks

const STICKS_PROG: Ch[] = [[0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sev'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [0, 'add9']];

const sticks: TrackDef = {
  kind: 'scene', key: F_ION, shadow: 0.5, bpm: 104, start: 'board', vary: 0.45, wrong: 0.05, echo: 0.4, level: 1.34,
  graph: { board: [['board', 2], ['think', 1]], think: [['board', 1]] },
  secs: {
    board: (c) => {
      const b = new B(32, 4, 104);
      // The lamp walks around the board: a five-step pattern against the four-beat bar, so its accent moves each bar.
      STICKS_PROG.forEach((ch, i) => {
        bounce(b, F_ION, i * 4, ch, 4, 0.28, { cut: 320 });
        const one = tones(F_ION, ch, 57, 4);
        for (let k = 0; k < 8; k++) {
          const step = (i * 8 + k) % 5;
          b.n('pluck', i * 4 + k * 0.5, (step < 4 ? one[step] : one[0] + 12), 0.3, step === 0 ? 0.22 : 0.13);
        }
      });
      groove(b, 0, 8, { wood: '9...5...7...5...', shaker: '..3...3...3...3.', kick: '6.......5.......' }, 0.36);
      sing(b, 'cold', 0, song(c, { K: F_ION, prog: STICKS_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'sticks' }), F_ION, 0, 0.3);
      return b.out();
    },
    think: (c) => {
      const b = new B(16, 4, 104);
      for (let k = 0; k < 16; k++) b.hit(k, 'wood', k % 4 ? 0.07 : 0.11, 0.1, { pan: 0.3 });
      chordOn(b, 'bell', F_ION, 0, [0, 'add9'], 3, 0.12, { ratio: 1 }, 55);
      chordOn(b, 'bell', F_ION, 8, [1, 'sev'], 3, 0.12, { ratio: 1 }, 55);
      sub(b, F_ION, 0, [0], 8, 0.26);
      sub(b, F_ION, 8, [1], 8, 0.26);
      // A question that climbs and stops on the seventh, then the lamp bends while nobody looks.
      [0, 2, 4, 6].forEach((d, k) => b.n('glass', 2 + k, F_ION(d) + 12, 1.5, 0.18, { pan: -0.3 }));
      if (c.r.chance(0.5)) for (const n of tones(F_ION, [4, 'tri'], 55, 3)) b.n('pad', 12, n, 4, 0.12, { bend: -1, x: 1 });
      ticks(b, c, 16, 3, 0.08, {}, 'click');
      return b.out();
    },
  },
};

export const MARKET_TRACKS: Record<string, TrackDef> = { market, lot, underbridge, sticks };

