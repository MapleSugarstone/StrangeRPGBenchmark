// Tracks of Stile, the Long road, and the Office: title, home, stile, lead, wake, parhelia, gully, road, stile_dark,
// office_tower, and anthelion. The Long has a low sun, so every lead note here casts its pre-note an eighth early.
import { B, MODE, aug, key, shift, type Ctx, type Key, type TrackDef } from './score-core';
import { arp, brass, choir, fifthOf, groove, motif, pad, phrase, pulse, rootOf, sing, song, sub, ticks, tones, walk, type Ch } from './parts';
import { ANTH, BIG, NODUS, NODUS_HEAD, PARH, PARH_ASIDE, PEBBLE, STILE, TIK } from './motifs';

const D_MIX = key(62, MODE.mix);
const D_ION = key(62, MODE.ion);
const D_AEO = key(62, MODE.aeo);
const G_ION = key(67, MODE.ion);
const F_ION = key(65, MODE.ion);
const BB_ION = key(58, MODE.ion);
const BB_AEO = key(58, MODE.aeo);
const E_DOR = key(64, MODE.dor);
const A_ION = key(57, MODE.ion);
const A_AEO = key(57, MODE.aeo);

/** The giant lead's figure, low on the lead with brass and sub under it. */
export function bigFigure(b: B, K: Key, t: number, g: number, x: Record<string, unknown> = {}): void {
  motif(b, 'lead', t, BIG, K, -1, g, { cut: 900, ...x });
  b.fig('brass', t, BIG, K, -1, g * 0.6, { a: 0.4, cut: 1200, ...x }, 0.98);
  b.fig('sub', t, BIG, K, -2, g * 0.9, x, 0.98);
}

/** Ruled lines: four quick steps up from `d`, the way Nodus rules a page. */
function rule(b: B, K: Key, t: number, d: number, g: number, v: 'pluck' | 'blip' = 'pluck'): void {
  for (let k = 0; k < 4; k++) b.n(v, t + k * 0.25, K(d + k), 0.22, g * (k === 0 ? 1 : 0.75));
}

// ---------------------------------------------------------------- title

const title: TrackDef = {
  kind: 'scene', key: D_MIX, shadow: 0.5, bpm: 72, start: 'big', vary: 0.35, wrong: 0.03, echo: 0.6, level: 0.91,
  graph: { big: [['nodus', 1]], nodus: [['walk', 1]], walk: [['walk', 2], ['nodus', 1], ['big', 0.6]] },
  secs: {
    big: (c) => {
      const b = new B(16, 4, 72);
      b.n('drone', 0, 38, 16, 0.42, { a: 2.5 });
      b.hit(0, 'hiss', 0.14, 16, { a: 3 });
      // The giant lead casts the longest pre-notes in the game: a whole beat early.
      bigFigure(b, D_MIX, 1, 0.42);
      bigFigure(b, D_MIX, 9, 0.36);
      choir(b, D_MIX, 9, c.visit % 2 ? [3, 'add9'] : [0, 'sus2'], 7, 0.16, 0);
      b.n('glass', 6 + c.r.int(3), D_MIX(c.r.pick([4, 2, 7])) + 12, 2, 0.2, { pan: c.r.range(-0.5, 0.5) });
      if (c.r.chance(0.5)) b.n('bell', 13 + c.r.int(2), D_MIX(c.r.pick([0, 4])) + 12, 2, 0.14, { pan: c.r.range(-0.5, 0.5) });
      return b.out({ still: true, shadow: 1 });
    },
    nodus: (c) => {
      const b = new B(32, 4, 72);
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [6, 'add9'], [0, 'sus4']];
      prog.forEach((ch, i) => {
        pad(b, D_MIX, i * 8, ch, 8, 0.26);
        sub(b, D_MIX, i * 8, ch, 8, 0.36);
        arp(b, D_MIX, i * 8, ch, 8, 0.5, 0.2, [0, 1, 2, 3, 2, 1, 2, 3]);
      });
      groove(b, 0, 8, { taiko: '7.......4.......', shaker: '..3...3...3...3.' }, 0.45);
      // Nodus at half speed. The pickup falls on the last beat of the first bar, so the line lands on the second.
      motif(b, 'lead', 3, aug(NODUS, 2), D_MIX, 0, 0.36);
      motif(b, 'bell', 12, NODUS_HEAD, D_MIX, 1, 0.24, { pan: 0.3 });
      const m = phrase(c.r, { K: D_MIX, chords: [prog[2], prog[2], prog[3], prog[3]], bar: 4, dens: 1, lo: 0, hi: 7, cad: 'home' });
      sing(b, 'lead', 16, m, D_MIX, 0, 0.32);
      return b.out();
    },
    walk: (c) => {
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [0, 'add9'], [6, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sus4'], [0, 'add9']];
      const b = new B(32, 4, 72);
      prog.forEach((ch, i) => {
        pad(b, D_MIX, i * 4, ch, 4, 0.24);
        sub(b, D_MIX, i * 4, ch, 4, 0.34);
        arp(b, D_MIX, i * 4, ch, 4, 0.5, 0.19, c.visit % 2 ? [0, 2, 1, 3] : [0, 1, 2, 3, 2, 1]);
      });
      groove(b, 0, 8, { taiko: '7.......5.......', shaker: '..3...3...3...3.' }, 0.45);
      sing(b, 'lead', 0, song(c, { K: D_MIX, prog, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'title' }), D_MIX, 0, 0.34);
      if (c.visit % 2) motif(b, 'bell', 24, NODUS, D_MIX, 1, 0.2, { pan: -0.3 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- home

function homeBar(b: B, K: Key, t: number, ch: Ch, beats: number, g = 1): void {
  // An electric piano of ratio-one bells on beats one and three, a plucked root, and a soft sub.
  for (const n of tones(K, ch, 55, 4)) { b.n('bell', t, n, 1.8, 0.12 * g, { ratio: 1 }); b.n('bell', t + 2, n, 1.2, 0.08 * g, { ratio: 1 }); }
  b.n('pluck', t, rootOf(K, ch, 43), 1.5, 0.28 * g);
  b.n('pluck', t + 2.5, fifthOf(K, ch, 43), 1, 0.18 * g);
  b.n('sub', t, rootOf(K, ch, 31), beats, 0.2 * g);
}

const HOME_PROG: Ch[] = [[0, 'sev'], [5, 'sev'], [3, 'sev'], [4, 'sus4']];

const home: TrackDef = {
  kind: 'place', key: G_ION, shadow: 0.5, region: 'long', bpm: 66, start: 'morning', vary: 0.4, wrong: 0.03, echo: 0.5, level: 1.7,
  graph: { morning: [['desk', 2], ['window', 1]], desk: [['morning', 1], ['desk', 1], ['window', 1]], window: [['morning', 1]] },
  secs: {
    morning: () => {
      const b = new B(32, 4, 66);
      HOME_PROG.forEach((ch, i) => { homeBar(b, G_ION, i * 8, ch, 4); homeBar(b, G_ION, i * 8 + 4, ch, 4, 0.8); });
      for (let k = 0; k < 32; k++) b.hit(k, 'wood', k % 4 ? 0.07 : 0.1, 0.1, { pan: 0.4 });
      // Nodus, soft, then the same line ruled again a third higher.
      motif(b, 'lead', 3.5, NODUS, G_ION, 0, 0.26, { cut: 1100 });
      motif(b, 'lead', 19.5, shift(NODUS, 2), G_ION, 0, 0.24, { cut: 1100 });
      rule(b, G_ION, 14, 0, 0.18);
      rule(b, G_ION, 30, 2, 0.16);
      return b.out();
    },
    desk: (c) => {
      const prog: Ch[] = [[0, 'sev'], [5, 'sev'], [0, 'sev'], [3, 'sev'], [1, 'sev'], [4, 'sus4'], [3, 'sev'], [0, 'sev']];
      const b = new B(32, 4, 66);
      prog.forEach((ch, i) => homeBar(b, G_ION, i * 4, ch, 4, 0.9));
      for (let k = 0; k < 32; k += 1) b.hit(k, 'wood', 0.07, 0.1, { pan: 0.4 });
      sing(b, 'lead', 0, song(c, { K: G_ION, prog, bar: 4, dens: 1, lo: -1, hi: 6, slot: 'home' }), G_ION, 0, 0.28, { cut: 1200 });
      if (c.r.chance(0.6)) rule(b, G_ION, 15, c.r.pick([0, 1, 2]), 0.15);
      return b.out();
    },
    window: (c) => {
      const b = new B(16, 4, 66);
      b.n('drone', 0, 43, 16, 0.36, { a: 2 });
      pad(b, G_ION, 0, [0, 'nine'], 8, 0.2);
      pad(b, G_ION, 8, [3, 'nine'], 8, 0.2);
      motif(b, 'glass', 2, aug(NODUS, 2), G_ION, 1, 0.2, { pan: -0.3 });
      ticks(b, c, 16, 6, 0.1, {}, 'wood');
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- stile

const STILE_PROG: Ch[] = [[0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sev']];

function stileBand(b: B, K: Key, g: number, brassToo: boolean): void {
  STILE_PROG.forEach((ch, i) => {
    pad(b, K, i * 8, ch, 8, 0.24 * g);
    if (brassToo) brass(b, K, i * 8, ch, 8, 0.11 * g, { a: 1.2, cut: 1400 });
    sub(b, K, i * 8, ch, 8, 0.34 * g);
    arp(b, K, i * 8, ch, 8, 0.5, 0.17 * g, [0, 2, 1, 3, 2, 1, 0, 2], {}, 'pluck', 57);
  });
}

const stile: TrackDef = {
  kind: 'place', key: D_ION, shadow: 0.5, region: 'long', bpm: 76, start: 'square', vary: 0.4, wrong: 0.03, echo: 0.5, level: 0.95,
  graph: { square: [['bells', 2], ['square', 1], ['evening', 1]], bells: [['square', 2], ['evening', 1]], evening: [['square', 1]] },
  secs: {
    square: () => {
      const b = new B(32, 4, 76);
      stileBand(b, D_ION, 1, true);
      groove(b, 0, 8, { taiko: '6.......3.......', shaker: '..3...3...3...3.' }, 0.4);
      motif(b, 'lead', 0, STILE, D_ION, 0, 0.36);
      return b.out();
    },
    bells: (c) => {
      const prog: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [0, 'add9']];
      const b = new B(32, 4, 76);
      prog.forEach((ch, i) => {
        pad(b, D_ION, i * 4, ch, 4, 0.22);
        sub(b, D_ION, i * 4, ch, 4, 0.32);
        arp(b, D_ION, i * 4, ch, 4, 0.5, 0.16, [0, 2, 1, 3], {}, 'pluck', 57);
      });
      groove(b, 0, 8, { taiko: '6.......3.......', shaker: '..3...3...3...3.' }, 0.4);
      // The town bell rings down the scale once, then the square sings its own tune.
      for (let k = 0; k < 8; k++) b.n('bell', k * 0.5, D_ION(7 - k) + 12, 1.5, 0.16, { pan: 0.35 });
      sing(b, 'lead', 0, song(c, { K: D_ION, prog, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'stile' }), D_ION, 0, 0.34);
      return b.out();
    },
    evening: (c) => {
      const b = new B(16, 4, 76);
      b.n('drone', 0, 38, 16, 0.38, { a: 2 });
      choir(b, D_ION, 0, [0, 'add9'], 8, 0.18, 0);
      choir(b, D_ION, 8, c.visit % 2 ? [3, 'add9'] : [5, 'sev'], 8, 0.18, 0.3);
      bigFigure(b, D_ION, 2, 0.3);
      motif(b, 'bell', 10 + c.r.int(3), NODUS_HEAD, D_ION, 1, 0.2, { pan: c.r.range(-0.4, 0.4) });
      ticks(b, c, 16, 4, 0.08, {}, 'wood');
      return b.out({ still: true, shadow: 1 });
    },
  },
};

// ---------------------------------------------------------------- lead

const lead: TrackDef = {
  kind: 'scene', key: D_AEO, shadow: 1, bpm: 56, start: 'figure', vary: 0.25, wrong: 0.04, echo: 0.6, verb: 1.1, level: 0.73,
  next: (cur, c) => {
    if (cur === 'figure') return c.r.weighted([['measure', 2], ['reveal', c.chapter >= 5 ? 2 : 0.3]]);
    return c.r.weighted([['figure', 2], ['measure', cur === 'measure' ? 0 : 1]]);
  },
  secs: {
    figure: (c) => {
      const b = new B(16, 4, 56);
      b.n('drone', 0, 38, 16, 0.42, { a: 1.5 });
      b.hit(0, 'hiss', 0.12, 16, { a: 2 });
      // The same two notes, read twice: first over the tonic, then as the third and the seventh of the sixth chord.
      bigFigure(b, D_AEO, 1, 0.44);
      choir(b, D_AEO, 0, [0, 'add9'], 8, 0.18, 0);
      bigFigure(b, D_AEO, 9, 0.4);
      choir(b, D_AEO, 8, [5, 'sev'], 8, 0.18, 0.2);
      for (let k = 0; k < 4; k++) b.hit(12 + k * 0.5, 'wood', 0.1, 0.1, { pan: 0.3 });
      if (c.r.chance(0.5)) b.n('glass', 14, D_AEO(4) + 12, 2, 0.16, { pan: -0.4 });
      return b.out();
    },
    measure: (c) => {
      const b = new B(16, 4, 56);
      b.n('drone', 0, 38, 16, 0.4, { a: 1.5 });
      choir(b, D_AEO, 0, [0, 'add9'], 16, 0.16, 0);
      sub(b, D_AEO, 0, [0], 16, 0.3);
      // Nodus measures: lines ruled up the page, each one a step higher.
      for (let bar = 0; bar < 4; bar++) rule(b, D_AEO, bar * 4 + 1, bar, 0.2);
      motif(b, 'glass', 9, NODUS_HEAD, D_AEO, 1, 0.22, { pan: 0.35 });
      ticks(b, c, 16, 5, 0.08, {}, 'wood');
      return b.out({ shadow: 0.5 });
    },
    reveal: (c) => {
      const b = new B(16, 4, 56);
      b.n('drone', 0, 38, 16, 0.36, { a: 1 });
      const prog: Ch[] = c.visit % 2 ? [[0, 'add9'], [6, 'add9'], [5, 'add9'], [0, 'add9']] : [[0, 'add9'], [6, 'add9'], [2, 'add9'], [0, 'add9']];
      prog.forEach((ch, i) => { pad(b, D_AEO, i * 4, ch, 4, 0.22); sub(b, D_AEO, i * 4, ch, 4, 0.34); });
      // The giant lead's two notes are the start of Nodus's line. Played slowly, the rest of the line follows them.
      motif(b, 'lead', 0, aug(NODUS, 2), D_AEO, -1, 0.42, { cut: 1100 });
      b.fig('sub', 0, aug(BIG, 1), D_AEO, -2, 0.3, {}, 0.98);
      motif(b, c.r.chance(0.5) ? 'bell' : 'glass', 11.5, NODUS, D_AEO, 1, 0.24, { pan: c.r.range(-0.4, 0.4) });
      ticks(b, c, 16, 3, 0.07, {}, 'wood');
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- wake

const WAKE_PROG: Ch[] = [[0], [3], [0], [4, 'sev'], [5], [1, 'sev'], [4, 'sev'], [0]];

function waltzBar(b: B, K: Key, t: number, ch: Ch, g = 1): void {
  b.n('bass', t, rootOf(K, ch, 36), 0.9, 0.36 * g, { cut: 260 });
  for (const n of tones(K, ch, 57, 3)) { b.n('bell', t + 1, n, 0.5, 0.1 * g, { ratio: 1 }); b.n('bell', t + 2, n, 0.5, 0.08 * g, { ratio: 1 }); }
  b.n('pluck', t + 1, fifthOf(K, ch, 48), 0.4, 0.12 * g);
}

const wake: TrackDef = {
  kind: 'scene', key: F_ION, shadow: 0.5, bpm: 104, start: 'waltz', vary: 0.45, wrong: 0.06, echo: 0.4, level: 1.47,
  graph: { waltz: [['waltz', 2], ['hymn', 1]], hymn: [['waltz', 1]] },
  secs: {
    waltz: (c) => {
      const b = new B(48, 3, 104);
      for (let rep = 0; rep < 2; rep++) WAKE_PROG.forEach((ch, i) => waltzBar(b, F_ION, rep * 24 + i * 3, ch, rep ? 1 : 0.85));
      groove(b, 0, 16, { shaker: '...3..3..3..', wood: '9...........' }, 0.3, {}, 3);
      const m = song(c, { K: F_ION, prog: WAKE_PROG, bar: 3, dens: 1, lo: 0, hi: 7, slot: 'wake' });
      sing(b, 'cold', 0, m, F_ION, 0, 0.3);
      sing(b, 'cold', 24, m, F_ION, 0, 0.3);
      // The bassoon walks down under the second B phrase, then the cake: a little bell flourish up the tonic chord.
      for (let k = 0; k < 6; k++) b.n('bass', 36 + k, F_ION(5 - k) - 24, 0.8, 0.3, { cut: 300 });
      [0, 2, 4, 7].forEach((d, k) => b.n('blip', 45 + k * 0.33, F_ION(d) + 12, 0.3, 0.2));
      return b.out();
    },
    hymn: (c) => {
      const b = new B(24, 3, 104);
      WAKE_PROG.forEach((ch, i) => { choir(b, F_ION, i * 3, ch, 3, 0.18, 0.2); pad(b, F_ION, i * 3, ch, 3, 0.18); sub(b, F_ION, i * 3, ch, 3, 0.3); });
      sing(b, 'lead', 0, song(c, { K: F_ION, prog: WAKE_PROG, bar: 3, dens: 1, lo: 0, hi: 7, slot: 'wake' }), F_ION, 0, 0.3);
      // His lead went where the giant lead lies, so its two notes close the hymn.
      b.fig('brass', 18, BIG, F_ION, -1, 0.22, { cut: 1000 }, 0.98);
      b.fig('sub', 18, BIG, F_ION, -2, 0.3, {}, 0.98);
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- parhelia

const parhelia: TrackDef = {
  kind: 'scene', key: BB_ION, shadow: 0.5, bpm: 66, start: 'lamp', vary: 0.35, wrong: 0.03, echo: 0.55, level: 1.08,
  next: (cur, c) => {
    if (cur === 'past') return 'lamp';
    if (cur === 'sticks') return c.r.weighted([['lamp', 2], ['sticks', 1]]);
    return c.r.weighted([['lamp', 1], ['sticks', 1], ['past', c.chapter >= 4 ? 0.8 : 0.25]]);
  },
  secs: {
    lamp: (c) => {
      const b = new B(32, 4, 66);
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [5, 'sev'], [4, 'sus4']];
      prog.forEach((ch, i) => {
        pad(b, BB_ION, i * 8, ch, 8, 0.24);
        sub(b, BB_ION, i * 8, ch, 8, 0.32);
        arp(b, BB_ION, i * 8, ch, 8, 0.5, 0.15, [0, 1, 2, 3, 2, 1, 2, 1], { cut: 1100 });
      });
      b.n('drone', 0, 34, 32, 0.22, { a: 3 });
      // Her held note bends, and a dry aside follows it an octave down, quieter and more honest.
      motif(b, 'lead', 3.5, PARH, BB_ION, 1, 0.38);
      b.fig('pluck', 9, PARH_ASIDE, BB_ION, 0, 0.3, {}, 0.9);
      motif(b, 'lead', 19.5, shift(PARH, -2), BB_ION, 1, 0.36);
      if (c.r.chance(0.7)) b.fig('pluck', 25, PARH_ASIDE, BB_ION, 0, 0.26, {}, 0.9);
      b.n('glass', 28, BB_ION(4) + 12, 2, 0.16, { pan: 0.4 });
      return b.out();
    },
    sticks: (c) => {
      const prog: Ch[] = [[0, 'add9'], [5, 'sev'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [2, 'sev'], [4, 'sus4'], [0, 'add9']];
      const b = new B(32, 4, 66);
      prog.forEach((ch, i) => {
        walk(b, BB_ION, i * 4, ch, prog[(i + 1) % prog.length], 4, 0.34, c.r, { cut: 380 });
        for (const n of tones(BB_ION, ch, 55, 3)) b.n('pluck', i * 4 + 1, n, 0.4, 0.12);
        for (const n of tones(BB_ION, ch, 55, 3)) b.n('pluck', i * 4 + 3, n, 0.4, 0.1);
      });
      groove(b, 0, 8, { wood: '9...5...9...5...', shaker: '..3...3...3...3.' }, 0.3);
      sing(b, 'lead', 0, song(c, { K: BB_ION, prog, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'parhelia' }), BB_ION, 1, 0.32);
      // She cheats with the lamp: sometimes the last chord bends while you are not looking.
      if (c.r.chance(0.4)) for (const n of tones(BB_ION, [0, 'tri'], 55, 3)) b.n('pad', 28, n, 4, 0.14, { bend: 1, x: 1 });
      return b.out();
    },
    past: () => {
      const b = new B(16, 4, 66);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'add9'], [4]];
      prog.forEach((ch, i) => { pad(b, BB_AEO, i * 4, ch, 4, 0.22); sub(b, BB_AEO, i * 4, ch, 4, 0.3); });
      choir(b, BB_AEO, 0, [0, 'add9'], 16, 0.14, 0);
      motif(b, 'lead', 0.5, aug(PARH, 1.5), BB_AEO, 1, 0.34);
      // A child's three notes, far off, that never come home.
      b.fig('glass', 11, TIK, BB_AEO, 1, 0.16, { pan: 0.5, nos: 1 }, 0.95);
      return b.out({ still: true, key: BB_AEO });
    },
  },
};

// ---------------------------------------------------------------- gully

const GULLY_PROG: Ch[] = [[0, 'sev'], [3, 'add9'], [0, 'sev'], [6, 'add9'], [2, 'add9'], [3, 'add9'], [6, 'add9'], [0, 'sev']];

function gullyBand(b: B, c: Ctx, K: Key, prog: readonly Ch[]): void {
  prog.forEach((ch, i) => {
    arp(b, K, i * 4, ch, 4, 0.5, 0.2, [0, 2, 1, 3, 2, 1, 0, 2], {}, 'pluck', 52);
    b.n('bass', i * 4, rootOf(K, ch, 36), 1.2, 0.36, { cut: 300 });
    b.n('bass', i * 4 + 2.5, rootOf(K, ch, 36), 1, 0.28, { cut: 300 });
    sub(b, K, i * 4, ch, 4, 0.2);
  });
  groove(b, 0, prog.length, { taiko: '6...............', shaker: '3.3.3.3.3.3.3.3.', wood: '....5.......5...' }, 0.36);
  if (c.r.chance(0.5)) b.hit(c.r.int(prog.length * 4), 'click', 0.2, 0.05, { pan: c.r.range(-0.6, 0.6) });
}

const gully: TrackDef = {
  kind: 'place', key: E_DOR, shadow: 0.5, region: 'long', bpm: 92, start: 'pick', vary: 0.45, wrong: 0.04, echo: 0.45, level: 0.9,
  graph: { pick: [['pick', 2], ['dust', 1], ['quarry', 1]], dust: [['pick', 1]], quarry: [['pick', 1], ['quarry', 1], ['dust', 1]] },
  secs: {
    pick: (c) => {
      const b = new B(32, 4, 92);
      gullyBand(b, c, E_DOR, GULLY_PROG);
      sing(b, 'lead', 0, song(c, { K: E_DOR, prog: GULLY_PROG, bar: 4, dens: 1, lo: 0, hi: 7, slot: 'gully' }), E_DOR, 0, 0.32, { cut: 1300 });
      return b.out();
    },
    dust: (c) => {
      const b = new B(16, 4, 92);
      b.hit(0, 'hiss', 0.16, 16, { a: 1 });
      b.n('sub', 0, 40, 16, 0.26, { a: 2 });
      pad(b, E_DOR, 0, [0, 'sev'], 8, 0.16);
      pad(b, E_DOR, 8, [3, 'add9'], 8, 0.16);
      for (let k = 0; k < 7; k++) b.n('pluck', c.r.int(32) * 0.5, E_DOR(c.r.pick([0, 2, 4, 6, 7])), 0.5, 0.16, { pan: c.r.range(-0.6, 0.6) });
      // A pebble thrown: its lead lands first, so its two notes carry pre-notes like any lead.
      motif(b, 'cold', 3, PEBBLE, E_DOR, 1, 0.28);
      motif(b, 'cold', 11, PEBBLE, E_DOR, 0, 0.24);
      ticks(b, c, 16, 4, 0.1, {}, 'click');
      return b.out();
    },
    quarry: (c) => {
      const prog: Ch[] = [[0, 'sev'], [6, 'add9'], [2, 'add9'], [3, 'add9'], [0, 'sev'], [6, 'add9'], [3, 'add9'], [0, 'sev']];
      const b = new B(32, 4, 92);
      prog.forEach((ch, i) => {
        pulse(b, E_DOR, i * 4, ch, 4, 0.36, 0.5, { cut: 340 });
        arp(b, E_DOR, i * 4, ch, 4, 0.25, 0.14, [0, 1, 2, 3], { lay: 0 }, 'pluck', 57);
      });
      groove(b, 0, 8, { taiko: '7.....5.7.......', snare: '....4.......4...', shaker: '3.3.3.3.3.3.3.3.' }, 0.42);
      sing(b, 'lead', 0, song(c, { K: E_DOR, prog, bar: 4, dens: 2, lo: 0, hi: 8, slot: 'quarry' }), E_DOR, 0, 0.32, { cut: 1400 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- road

const ROAD_PROG: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [0, 'add9']];

function roadBand(b: B, c: Ctx, K: Key, prog: readonly Ch[]): void {
  prog.forEach((ch, i) => {
    walk(b, K, i * 4, ch, prog[(i + 1) % prog.length], 4, 0.36, c.r, { cut: 380 });
    pad(b, K, i * 4, ch, 4, 0.2);
  });
  groove(b, 0, prog.length, { kick: '5.......4.......', snare: '....4.......4...', shaker: '3.2.3.2.3.2.3.2.' }, 0.42);
}

const road: TrackDef = {
  kind: 'place', key: A_ION, shadow: 0.5, region: 'long', bpm: 96, start: 'walk', vary: 0.45, wrong: 0.03, echo: 0.4, level: 1.06,
  graph: { walk: [['walk', 2], ['stride', 1], ['post', 0.5]], stride: [['walk', 2], ['post', 0.5]], post: [['walk', 1]] },
  secs: {
    walk: (c) => {
      const b = new B(32, 4, 96);
      roadBand(b, c, A_ION, ROAD_PROG);
      sing(b, 'lead', 0, song(c, { K: A_ION, prog: ROAD_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'road' }), A_ION, 1, 0.34);
      return b.out();
    },
    stride: (c) => {
      const prog: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [0, 'add9'], [4, 'sus4'], [3, 'add9'], [0, 'add9']];
      const b = new B(32, 4, 96);
      roadBand(b, c, A_ION, prog);
      // Nodus and Parhelia walk the road together, trading their figures.
      motif(b, 'lead', 3.5, NODUS, A_ION, 1, 0.34);
      motif(b, 'lead', 11.5, PARH, A_ION, 1, 0.34);
      motif(b, 'lead', 19.5, shift(NODUS, 1), A_ION, 1, 0.32);
      motif(b, 'lead', 27, [[0, 0.5], [4, 2.5, 0, 1], [2, 1]], A_ION, 1, 0.32);
      return b.out();
    },
    post: (c) => {
      const b = new B(16, 4, 96);
      b.n('drone', 0, 45, 16, 0.36, { a: 1 });
      pad(b, A_ION, 0, [0, 'add9'], 8, 0.2);
      pad(b, A_ION, 8, [3, 'add9'], 8, 0.2);
      const tune = song(c, { K: A_ION, prog: ROAD_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'road' }).filter((x) => x[0] < 8);
      for (const [t, len, d] of tune) b.n('glass', t * 2, A_ION(d) + 12, len * 1.8, 0.2, { pan: -0.3 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- stile_dark

const stileDark: TrackDef = {
  kind: 'place', key: D_ION, shadow: 0.5, region: 'lamp', bpm: 70, start: 'hum', vary: 0.35, wrong: 0.05, echo: 0.5, level: 1.08,
  graph: { hum: [['hum', 2], ['beam', 1]], beam: [['hum', 1]] },
  secs: {
    hum: (c) => {
      const b = new B(32, 4, 70);
      // The Great Lamp's hum sits under the town, with a fainter one a half step above it.
      b.hit(0, 'hum', 0.32, 32, { n: 38, a: 2 });
      b.hit(0, 'hum', 0.12, 32, { n: 39, a: 4, odd: 1, x: 1 });
      STILE_PROG.forEach((ch, i) => { pad(b, D_ION, i * 8, ch, 8, 0.2); sub(b, D_ION, i * 8, ch, 8, 0.3); });
      groove(b, 0, 8, { tick: '5...3...5...3...' }, 0.3);
      motif(b, 'lead', 0, STILE, D_ION, 0, 0.34, { cut: 1300 });
      if (c.r.chance(0.6)) b.hit(12 + c.r.int(8), 'scan', 0.12, 4, { n: 62 });
      // The Office painted false leads from the Ledger, so some pre-notes here are painted.
      return b.out({ paint: 0.3 });
    },
    beam: (c) => {
      const b = new B(16, 4, 70);
      b.hit(0, 'hum', 0.36, 16, { n: 38, a: 1 });
      b.hit(2, 'scan', 0.16, 6, { n: 62 });
      b.hit(10, 'scan', 0.12, 5, { n: 66 });
      choir(b, D_ION, 0, [5, 'sev'], 16, 0.18, 0);
      sub(b, D_ION, 0, [5], 16, 0.28);
      b.fig('glass', 4, STILE.slice(0, 4), D_ION, 1, 0.18, { pan: 0.3 }, 0.95);
      ticks(b, c, 16, 6, 0.12);
      return b.out({ paint: 0.4 });
    },
  },
};

// ---------------------------------------------------------------- office_tower

const OFFICE_PROG: Ch[] = [[0], [5], [6], [4]];
const QUARTERS = [[0, 1], [1, 1], [2, 1], [3, 1]] as const;

const officeTower: TrackDef = {
  kind: 'place', key: A_AEO, shadow: 0.5, region: 'lamp', bpm: 112, start: 'stamp', vary: 0.15, wrong: 0, echo: 0.35, level: 1.02, wobble: 1,
  graph: { stamp: [['stamp', 1], ['file', 1]], file: [['stamp', 1]] },
  secs: {
    stamp: (c) => {
      const b = new B(32, 4, 112);
      for (let bar = 0; bar < 8; bar++) {
        const ch = OFFICE_PROG[bar % 4];
        for (let k = 0; k < 4; k++) b.n('bass', bar * 4 + k, rootOf(A_AEO, ch, 33), 0.7, 0.38, { cut: 300 });
        pad(b, A_AEO, bar * 4, ch, 4, 0.16);
      }
      groove(b, 0, 8, { kick: '9...9...9...9...', clank: '....6.......6...', tick: '4.3.4.3.4.3.4.3.' }, 0.44);
      motif(b, 'sq', 0, ANTH, A_AEO, 1, 0.34);
      motif(b, 'sq', 16, ANTH, A_AEO, 1, 0.32);
      const strict = phrase(c.r, { K: A_AEO, chords: [OFFICE_PROG[2], OFFICE_PROG[3]], bar: 4, dens: 1, lo: 0, hi: 7, cad: 'open' }, [QUARTERS, QUARTERS]);
      sing(b, 'cold', 8, strict, A_AEO, 0, 0.28);
      sing(b, 'cold', 24, strict, A_AEO, 0, 0.28);
      return b.out();
    },
    file: (c) => {
      const b = new B(32, 4, 112);
      for (let bar = 0; bar < 8; bar++) {
        const ch = OFFICE_PROG[bar % 4];
        brass(b, A_AEO, bar * 4 + (c.r.chance(0.3) ? 2 : 0), ch, 0.4, 0.26, { cut: 1600 });
        for (let k = 0; k < 4; k++) b.n('bass', bar * 4 + k, rootOf(A_AEO, ch, 33), 0.7, 0.36, { cut: 300 });
        choir(b, A_AEO, bar * 4, ch, 3.8, 0.14, 0.5, { lay: 0 });
      }
      groove(b, 0, 8, { kick: '9...9...9...9...', tick: '4.3.4.3.4.3.4.3.' }, 0.42);
      // A strict canon: the same stamps two beats apart, filed a set number of steps down in the second half.
      const step = [-2, -3, -4][c.visit % 3];
      motif(b, 'sq', 0, ANTH, A_AEO, 1, 0.32);
      motif(b, 'cold', 2, ANTH, A_AEO, 0, 0.24);
      motif(b, 'sq', 16, shift(ANTH, step), A_AEO, 1, 0.3);
      motif(b, 'cold', 18, shift(ANTH, step), A_AEO, 0, 0.22);
      ticks(b, c, 32, 6, 0.12);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- anthelion

const ANTH_PROG: Ch[] = [[0], [4], [5], [6]];

const anthelion: TrackDef = {
  kind: 'scene', key: A_AEO, shadow: 0.5, bpm: 76, start: 'office', vary: 0, wrong: 0, echo: 0.35, level: 0.94, wobble: 0,
  graph: { office: [['office', 2], ['child', 1]], child: [['office', 1]] },
  secs: {
    office: (c) => {
      const b = new B(32, 4, 76);
      for (let bar = 0; bar < 8; bar++) {
        const ch = ANTH_PROG[bar % 4];
        pad(b, A_AEO, bar * 4, ch, 2, 0.2);
        pad(b, A_AEO, bar * 4 + 2, ch, 2, 0.17);
        for (let k = 0; k < 4; k++) b.n('bass', bar * 4 + k, rootOf(A_AEO, ch, 33), 0.8, 0.32, { cut: 280 });
        sub(b, A_AEO, bar * 4, ch, 4, 0.2);
      }
      for (let k = 0; k < 32; k++) b.hit(k, 'wood', k % 4 ? 0.08 : 0.12, 0.1, { pan: -0.3 });
      // By rule: the stamps, then the same stamps a set number of steps down. Nothing bends. A clerk's line in strict
      // quarters files under the second half, a new one each pass.
      const step = [-2, -3, -1][c.visit % 3];
      motif(b, 'sq', 0, ANTH, A_AEO, 1, 0.34);
      motif(b, 'sq', 8, shift(ANTH, step), A_AEO, 1, 0.32);
      motif(b, 'sq', 16, ANTH, A_AEO, 1, 0.34);
      motif(b, 'sq', 24, shift(ANTH, step), A_AEO, 1, 0.32);
      const clerk = phrase(c.r, { K: A_AEO, chords: ANTH_PROG, bar: 4, dens: 1, lo: -2, hi: 4, cad: 'home' }, ANTH_PROG.map(() => QUARTERS));
      sing(b, 'cold', 16, clerk, A_AEO, 0, 0.16, { nos: undefined });
      return b.out();
    },
    child: (c) => {
      const b = new B(16, 4, 76);
      const second: Ch = c.visit % 2 ? [6, 'tri'] : [3, 'sev'];
      choir(b, A_AEO, 0, [0, 'add9'], 8, 0.16, 0);
      choir(b, A_AEO, 8, second, 8, 0.16, 0);
      pad(b, A_AEO, 0, [0, 'add9'], 8, 0.14);
      pad(b, A_AEO, 8, second, 8, 0.14);
      sub(b, A_AEO, 0, [0], 8, 0.24);
      sub(b, A_AEO, 8, second, 8, 0.24);
      // A child's lamp on the desk, never lit: three notes that do not come home, and his own last two under them.
      b.fig('glass', 2 + c.r.pick([0, 0.5, 1]), TIK, A_AEO, 1, 0.2, { pan: c.r.range(-0.5, 0.5), nos: 1 }, 0.95);
      motif(b, 'sq', 10, [[3, 1], [null, 1], [1, 2]], A_AEO, 1, 0.24);
      ticks(b, c, 16, 3, 0.06, {}, 'wood');
      return b.out({ still: true });
    },
  },
};

export const STILE_TRACKS: Record<string, TrackDef> = {
  title, home, stile, lead, wake, parhelia, gully, road, stile_dark: stileDark, office_tower: officeTower, anthelion,
};
