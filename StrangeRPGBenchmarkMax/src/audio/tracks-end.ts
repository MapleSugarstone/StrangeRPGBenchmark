// The ending: epilogue and credits. Here Nodus's line is played with its blank filled at last, Tik's three notes take
// their missing step into that same note, and Anthelion's stamped note bends for the first time.
import { B, MODE, inv, key, type Ctx, type Fig, type Key, type TrackDef } from './score-core';
import { arp, brass, chordOn, choir, groove, motif, pad, sing, song, sub, type Ch } from './parts';
import { BIG, LOT, LOT_EARLY, MINIM_CRACKED, NODUS, NODUS_FULL, PARH, PARH_ASIDE, STILE, TIK, TIK_HOME, UMB } from './motifs';

const D_ION = key(62, MODE.ion);

/** Anthelion's stamps with the last note bent up a step into the third, the license lifted. */
const ANTH_FREE: Fig = [[4, 1], [4, 1], [4, 1], [4, 1], [3, 1], [null, 1], [1, 2, 0, 1]];

function warmBand(b: B, K: Key, prog: readonly Ch[], bar: number, g = 1, drums = true): void {
  prog.forEach((ch, i) => {
    pad(b, K, i * bar, ch, bar, 0.22 * g);
    sub(b, K, i * bar, ch, bar, 0.32 * g);
    arp(b, K, i * bar, ch, bar, 0.5, 0.15 * g, [0, 2, 1, 3, 2, 1, 0, 2], {}, 'pluck', 57);
  });
  if (drums) groove(b, 0, (prog.length * bar) / 4, { taiko: '6.......3.......', shaker: '..3...3...3...3.' }, 0.38 * g);
}

const STILE_PROG: Ch[] = [[0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sev']];

// ---------------------------------------------------------------- epilogue

const epilogue: TrackDef = {
  kind: 'end', key: D_ION, shadow: 0.5, bpm: 70, start: 'morning', vary: 0.3, wrong: 0.01, echo: 0.5, level: 1,
  graph: { morning: [['entry', 1]], entry: [['square', 1]], square: [['morning', 1]] },
  secs: {
    morning: () => {
      const b = new B(32, 4, 70);
      STILE_PROG.forEach((ch, i) => {
        pad(b, D_ION, i * 8, ch, 8, 0.24);
        brass(b, D_ION, i * 8, ch, 8, 0.1, { a: 1.2, cut: 1400 });
        sub(b, D_ION, i * 8, ch, 8, 0.32);
        arp(b, D_ION, i * 8, ch, 8, 0.5, 0.15, [0, 2, 1, 3, 2, 1, 0, 2], {}, 'pluck', 57);
      });
      groove(b, 0, 8, { taiko: '6.......3.......', shaker: '..3...3...3...3.' }, 0.38);
      motif(b, 'lead', 0, STILE, D_ION, 0, 0.36);
      return b.out();
    },
    entry: (c) => {
      const b = new B(32, 4, 70);
      const prog: Ch[] = [[0, 'add9'], [0, 'add9'], [3, 'add9'], [0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sus4'], [0, 'add9']];
      warmBand(b, D_ION, prog, 4, 1, false);
      groove(b, 8, 6, { taiko: '6.......3.......' }, 0.34);
      // Each time round the same story is told by different instruments.
      const turn = c.visit % 3;
      // Tik's notes take the step they never took, into the note Nodus's line always left blank.
      b.fig(turn === 1 ? 'bell' : turn === 2 ? 'pluck' : 'glass', 0, TIK_HOME, D_ION, 1, 0.24, { nos: 1 }, 0.96);
      // The entry, written: the blank filled.
      motif(b, 'lead', 7.5, NODUS_FULL, D_ION, 0, 0.38);
      // Parhelia's held note, and her brother's stamps, bending at last.
      b.fig(turn === 2 ? 'pad' : 'brass', 15.5, PARH, D_ION, 0, 0.22, { cut: 1800 }, 0.96);
      motif(b, 'sq', 16, ANTH_FREE, D_ION, 1, 0.22);
      // The party stands on the hill, and its lead falls across the town: the giant lead's two notes, warm.
      b.fig('sub', 24, BIG, D_ION, -2, 0.34, {}, 0.98);
      b.fig('brass', 24, BIG, D_ION, -1, 0.2, { cut: 1400 }, 0.98);
      motif(b, turn === 1 ? 'glass' : 'bell', 26, NODUS_FULL, D_ION, 1, 0.22, { pan: c.r.range(-0.4, 0.4) });
      if (turn === 2) b.hit(24, 'crash', 0.2, 1);
      return b.out({ still: true });
    },
    square: (c) => {
      const prog: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [0, 'add9']];
      const b = new B(32, 4, 70);
      warmBand(b, D_ION, prog, 4);
      sing(b, 'lead', 0, song(c, { K: D_ION, prog, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'epilogue' }), D_ION, 0, 0.32);
      b.fig('brass', 0, UMB, D_ION, -1, 0.16, { cut: 1500 }, 0.9);
      b.fig('glass', 9, MINIM_CRACKED, D_ION, 1, 0.16, {}, 0.95);
      motif(b, 'cold', 20 + LOT_EARLY, LOT, D_ION, 1, 0.2);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- credits

const CREDITS_ORDER = ['c_nodus', 'c_parhelia', 'c_lot', 'c_umb', 'c_minim', 'c_tik', 'c_anth', 'c_big', 'c_end'];

function creditBar(c: Ctx, prog: readonly Ch[], extra?: (b: B) => void): B {
  const b = new B(prog.length * 4, 4, 88);
  warmBand(b, D_ION, prog, 4, 0.9);
  extra?.(b);
  void c;
  return b;
}

const credits: TrackDef = {
  kind: 'end', key: D_ION, shadow: 0.5, bpm: 88, start: 'c_nodus', vary: 0.2, wrong: 0, echo: 0.45, level: 1.21,
  // Each motif once, in story order, then the entry, then the town's tune for as long as the scroll runs.
  next: (cur) => {
    const i = CREDITS_ORDER.indexOf(cur);
    if (i >= 0 && i < CREDITS_ORDER.length - 1) return CREDITS_ORDER[i + 1];
    return 'c_after';
  },
  secs: {
    c_nodus: (c) => {
      const b = creditBar(c, [[0, 'add9'], [3, 'add9'], [5, 'sev'], [4, 'sus4']]);
      motif(b, 'lead', 3.5, NODUS, D_ION, 0, 0.36);
      motif(b, 'lead', 11.5, NODUS, D_ION, 0, 0.34);
      return b.out();
    },
    c_parhelia: (c) => {
      const b = creditBar(c, [[0, 'add9'], [3, 'add9'], [5, 'sev'], [4, 'sus4']]);
      motif(b, 'lead', 3.5, PARH, D_ION, 0, 0.36);
      b.fig('pluck', 9, PARH_ASIDE, D_ION, -1, 0.3, {}, 0.9);
      return b.out();
    },
    c_lot: (c) => {
      const b = creditBar(c, [[5, 'sev'], [3, 'add9'], [5, 'sev'], [4, 'sus4']]);
      groove(b, 0, 4, { hat: '3.2.3.2.3.2.3.2.' }, 0.34);
      motif(b, 'cold', 4 + LOT_EARLY, LOT, D_ION, 1, 0.3);
      motif(b, 'cold', 12 + LOT_EARLY, LOT, D_ION, 1, 0.28);
      return b.out();
    },
    c_umb: (c) => {
      const b = creditBar(c, [[0], [4, 'sev'], [3], [0]]);
      groove(b, 0, 4, { snare: '6..36..36.6.6..3' }, 0.34);
      motif(b, 'lead', 0, UMB, D_ION, 0, 0.34);
      b.fig('brass', 0, UMB, D_ION, -1, 0.2, { cut: 2000 }, 0.9);
      motif(b, 'lead', 8, UMB, D_ION, 0, 0.32);
      return b.out();
    },
    c_minim: (c) => {
      const b = creditBar(c, [[5, 'sev'], [3, 'add9'], [1, 'sev'], [5, 'sev']]);
      motif(b, 'lead', 0, MINIM_CRACKED, D_ION, 0, 0.32, { cut: 1600 });
      b.fig('glass', 8, inv(MINIM_CRACKED, 4), D_ION, 1, 0.18, {}, 0.95);
      return b.out();
    },
    c_tik: (c) => {
      const b = creditBar(c, [[5, 'sev'], [3, 'add9'], [6], [3, 'add9']]);
      groove(b, 0, 4, { click: '9..5.9....5.9...' }, 0.3);
      motif(b, 'lead', 2, TIK, D_ION, 0, 0.32, { nos: 1 });
      motif(b, 'lead', 10, TIK, D_ION, 0, 0.3, { nos: 1 });
      return b.out();
    },
    c_anth: (c) => {
      const b = creditBar(c, [[0], [4], [5], [6]]);
      motif(b, 'sq', 0, [[4, 1], [4, 1], [4, 1], [4, 1], [3, 1], [null, 1], [1, 1], [null, 1]], D_ION, 1, 0.3);
      motif(b, 'sq', 8, ANTH_FREE, D_ION, 1, 0.3);
      return b.out();
    },
    c_big: () => {
      const b = new B(16, 4, 88);
      b.n('drone', 0, 38, 16, 0.38, { a: 1 });
      choir(b, D_ION, 0, [0, 'add9'], 8, 0.18, 0);
      choir(b, D_ION, 8, [3, 'add9'], 8, 0.18, 0.3);
      b.fig('sub', 1, BIG, D_ION, -2, 0.36, {}, 0.98);
      motif(b, 'lead', 1, BIG, D_ION, -1, 0.34, { cut: 900 });
      b.fig('brass', 9, BIG, D_ION, -1, 0.24, { cut: 1400 }, 0.98);
      return b.out({ still: true, shadow: 1 });
    },
    c_end: () => {
      const b = new B(24, 4, 88);
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [0, 'add9'], [4, 'sus4'], [0, 'add9'], [0, 'add9']];
      warmBand(b, D_ION, prog, 4, 1, false);
      b.fig('glass', 0, TIK_HOME, D_ION, 1, 0.24, { nos: 1 }, 0.96);
      motif(b, 'lead', 7.5, NODUS_FULL, D_ION, 0, 0.38);
      chordOn(b, 'bell', D_ION, 16, [0, 'add9'], 6, 0.16, {}, 74, 4);
      b.hit(16, 'crash', 0.26, 1);
      return b.out({ still: true, end: true });
    },
    c_after: (c) => {
      const b = new B(32, 4, 88);
      warmBand(b, D_ION, STILE_PROG.flatMap((ch) => [ch, ch]), 4, 0.85);
      motif(b, 'lead', 0, STILE, D_ION, 0, 0.3);
      void c;
      return b.out();
    },
  },
};

export const END_TRACKS: Record<string, TrackDef> = { epilogue, credits };
