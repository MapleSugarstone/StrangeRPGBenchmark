// Tracks of the Deeps and the scenes that start there: title, home, deeps, market, pound, ferries, clinic, and camp.
// The Deeps are wet, so every lead note here leaves a reflection an eighth behind it, an octave down.
import { B, MODE, aug, key, retro, type Key, type TrackDef } from './score-core';
import { arp, chordOn, choir, fifthOf, groove, pad, phrase, pulse, rootOf, sing, song, sub, ticks, tones, type Ch } from './parts';
import { BAILER, MARIT_HEAD, PORT, PORT_HEAD, TILLY } from './motifs';
import { bailer, breathe, lap, marit, port, rain } from './weave';

const D_DOR = key(62, MODE.dor);
const F_ION = key(65, MODE.ion);
const A_AEO = key(57, MODE.aeo);
const E_DOR = key(64, MODE.dor);
const G_ION = key(67, MODE.ion);
const B_AEO = key(59, MODE.aeo);
const C_LYD = key(60, MODE.lyd);
const EB_ION = key(63, MODE.ion);

/** Wet bass and arpeggios: root eighths through a low filter, a sine sub, sixteenth arpeggios, and thin strings. */
export function wetBand(b: B, K: Key, prog: readonly Ch[], bar: number, g = 1, arpPat: readonly number[] = [0, 1, 2, 3, 4, 3, 2, 1]): void {
  prog.forEach((ch, i) => {
    pulse(b, K, i * bar, ch, bar, 0.42 * g, 0.5, { cut: 380 });
    sub(b, K, i * bar, ch, bar, 0.26 * g);
    arp(b, K, i * bar, ch, bar, 0.25, 0.15 * g, arpPat, { cut: 1700 });
    pad(b, K, i * bar, ch, bar, 0.13 * g, { a: 0.6 });
  });
}

// ---------------------------------------------------------------- title

const title: TrackDef = {
  kind: 'scene', key: D_DOR, reflect: 0.5, bpm: 70, start: 'rise', vary: 0.35, wrong: 0.03, echo: 0.6, level: 0.87,
  graph: { rise: [['tune', 1]], tune: [['tune', 1], ['hollow', 1], ['rise', 0.5]], hollow: [['tune', 1]] },
  secs: {
    rise: (c) => {
      const b = new B(16, 4, 70);
      b.n('drone', 0, 38, 16, 0.42, { a: 2.5 });
      rain(b, c, D_DOR, 16, 0.3, 5);
      pad(b, D_DOR, 0, [0, 'add9'], 8, 0.22);
      pad(b, D_DOR, 8, [3, 'add9'], 8, 0.22);
      // The title plays the port's figure at half speed: one long rise that stops a step short.
      port(b, 'lead', 1, D_DOR, 0, 0.38, {}, aug(PORT, 2), 0.5);
      bailer(b, D_DOR, 8, 0.5, BAILER, {}, true);
      if (c.visit % 2) marit(b, 'glass', 10, D_DOR, 1, 0.12, { pan: 0.4 }, MARIT_HEAD);
      return b.out({ still: true });
    },
    tune: (c) => {
      const prog: Ch[] = [[0, 'add9'], [6, 'add9'], [3, 'add9'], [0, 'sus4'], [2, 'add9'], [6, 'add9'], [3, 'add9'], [4, 'sev']];
      const b = new B(32, 4, 70);
      prog.forEach((ch, i) => {
        pad(b, D_DOR, i * 4, ch, 4, 0.22);
        sub(b, D_DOR, i * 4, ch, 4, 0.34);
        arp(b, D_DOR, i * 4, ch, 4, 0.5, 0.18, c.visit % 2 ? [0, 2, 1, 3] : [0, 1, 2, 3, 2, 1]);
      });
      groove(b, 0, 8, { taiko: '7.......4.......', shaker: '..3...3...3...3.' }, 0.42);
      rain(b, c, D_DOR, 32, 0.2, 8);
      sing(b, 'lead', 0, song(c, { K: D_DOR, prog, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'title' }), D_DOR, 0, 0.34);
      if (c.visit % 2) port(b, 'bell', 26, D_DOR, 1, 0.16, { pan: -0.3 });
      return b.out();
    },
    hollow: (c) => {
      const b = new B(16, 4, 70);
      b.n('drone', 0, 38, 16, 0.38, { a: 1.5 });
      choir(b, D_DOR, 0, [0, 'add9'], 8, 0.16, 0);
      choir(b, D_DOR, 8, [6, 'add9'], 8, 0.16, 0.3);
      sub(b, D_DOR, 0, [0], 16, 0.28);
      rain(b, c, D_DOR, 16, 0.28, 7);
      port(b, 'glass', 2 + c.r.int(2), D_DOR, 1, 0.2, { pan: 0.3 });
      if (c.visit % 2) bailer(b, D_DOR, 8, 0.4, BAILER, {}, true);
      else port(b, 'cold', 9, D_DOR, 0, 0.24, { cut: 1600 }, PORT_HEAD, 0);
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
  b.n('sub', t, rootOf(K, ch, 29), beats, 0.2 * g);
}

const HOME_PROG: Ch[] = [[0, 'sev'], [5, 'sev'], [1, 'sev'], [4, 'sus4'], [3, 'sev'], [2, 'sev'], [1, 'sev'], [4, 'sev']];

const home: TrackDef = {
  kind: 'place', key: F_ION, reflect: 0.5, region: 'deeps', bpm: 72, start: 'room', vary: 0.4, wrong: 0.03, echo: 0.5, level: 1.6,
  graph: { room: [['room', 1], ['jar', 1], ['night', 1]], jar: [['room', 1]], night: [['room', 1]] },
  secs: {
    room: (c) => {
      const b = new B(32, 4, 72);
      HOME_PROG.forEach((ch, i) => homeBar(b, F_ION, i * 4, ch, 4, i % 2 ? 0.85 : 1));
      // A clock on the shelf, and rain on the tin roof.
      for (let k = 0; k < 32; k++) b.hit(k, 'wood', k % 4 ? 0.05 : 0.08, 0.1, { pan: 0.45 });
      rain(b, c, F_ION, 32, 0.16, 7, { pan: -0.2 });
      sing(b, 'lead', 0, song(c, { K: F_ION, prog: HOME_PROG, bar: 4, dens: 1, lo: -1, hi: 6, slot: 'home' }), F_ION, 0, 0.28, { cut: 1200 });
      return b.out();
    },
    jar: (c) => {
      // The jar marked DRY: coins dropped in one at a time, three years of them, rising.
      const b = new B(16, 4, 72);
      const prog: Ch[] = [[0, 'sev'], [3, 'sev'], [5, 'sev'], [4, 'sus4']];
      prog.forEach((ch, i) => homeBar(b, F_ION, i * 4, ch, 4, 0.8));
      for (let k = 0; k < 6; k++) b.n('glass', 1 + k * 2 + c.r.int(2) * 0.5, F_ION(k) + 12, 0.8, 0.12, { pan: 0.35, ratio: 3.5 });
      // The home town hears the port's figure backward, a sigh that starts on the note it never leaves.
      port(b, 'cold', 8, F_ION, 0, 0.22, { cut: 1500 }, retro(PORT), 0);
      rain(b, c, F_ION, 16, 0.16, 4);
      return b.out();
    },
    night: (c) => {
      const b = new B(16, 4, 72);
      b.n('drone', 0, 41, 16, 0.34, { a: 2 });
      pad(b, F_ION, 0, [0, 'nine'], 8, 0.2);
      pad(b, F_ION, 8, [3, 'nine'], 8, 0.2);
      rain(b, c, F_ION, 16, 0.3, 10);
      const m = phrase(c.r, { K: F_ION, chords: [[0], [0], [3], [3]], bar: 4, dens: 0, lo: 0, hi: 6, cad: 'open' });
      sing(b, 'lead', 0, m, F_ION, 0, 0.26, { cut: 1100 });
      ticks(b, c, 16, 4, 0.06, {}, 'wood');
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- deeps

const DEEPS_PROG: Ch[] = [[0, 'add9'], [5, 'add9'], [2, 'add9'], [6, 'add9']];
const DEEPS_B: Ch[] = [[3, 'sev'], [0, 'add9'], [5, 'sev'], [4, 'sev']];
const DEEPS_KIT = { kick: '9.....5...9.....', wood: '....5.......5..3', hat: '..3...3...3...3.' };

const deeps: TrackDef = {
  kind: 'place', key: A_AEO, reflect: 0.5, region: 'deeps', bpm: 96, start: 'canal', vary: 0.45, wrong: 0.04, echo: 0.55, level: 0.8,
  graph: { canal: [['neon', 2], ['bailer', 1], ['canal', 1]], neon: [['canal', 2], ['drain', 1]], bailer: [['canal', 1], ['neon', 1]], drain: [['canal', 1]] },
  secs: {
    canal: (c) => {
      const prog = [...DEEPS_PROG, ...DEEPS_PROG];
      const b = new B(32, 4, 96);
      wetBand(b, A_AEO, prog, 4);
      groove(b, 0, 8, DEEPS_KIT, 0.44);
      rain(b, c, A_AEO, 32, 0.2, 10);
      sing(b, 'lead', 0, song(c, { K: A_AEO, prog, bar: 4, dens: 1, lo: -1, hi: 7, slot: 'deeps' }), A_AEO, 0, 0.32);
      return b.out();
    },
    neon: (c) => {
      const prog = [...DEEPS_PROG, ...DEEPS_B];
      const b = new B(32, 4, 96);
      wetBand(b, A_AEO, prog, 4, 1, c.visit % 2 ? [0, 2, 4, 2, 1, 3, 5, 3] : [0, 1, 2, 3, 4, 3, 2, 1]);
      groove(b, 0, 8, { ...DEEPS_KIT, shaker: '.2.2.2.2.2.2.2.2' }, 0.44);
      rain(b, c, A_AEO, 32, 0.2, 8);
      sing(b, 'cold', 0, phrase(c.r, { K: A_AEO, chords: DEEPS_PROG, bar: 4, dens: 2, lo: 2, hi: 9, cad: 'open' }), A_AEO, 0, 0.26);
      // The home town hears the port's figure backward, a falling sigh on the glass.
      port(b, 'glass', 17, A_AEO, 1, 0.16, { pan: 0.35 }, retro(PORT), 0);
      sing(b, 'lead', 20, phrase(c.r, { K: A_AEO, chords: DEEPS_B.slice(1), bar: 4, dens: 1, lo: 0, hi: 7, cad: 'home' }), A_AEO, 0, 0.3);
      return b.out();
    },
    bailer: (c) => {
      // A Bailer wades down the canal: the band drops to bass and rain while it passes.
      const b = new B(16, 4, 96);
      DEEPS_PROG.forEach((ch, i) => { pulse(b, A_AEO, i * 4, ch, 4, 0.3, 1, { cut: 300 }); });
      b.n('drone', 0, 45, 16, 0.3, { a: 1 });
      bailer(b, A_AEO, 2, 0.6);
      rain(b, c, A_AEO, 16, 0.26, 8);
      arp(b, A_AEO, 10, DEEPS_PROG[2], 6, 0.25, 0.1, [0, 1, 2, 3], { cut: 1200 });
      groove(b, 8, 2, { hat: '..2...2...2...2.' }, 0.4);
      return b.out();
    },
    drain: (c) => {
      const b = new B(16, 4, 96);
      sub(b, A_AEO, 0, [0], 8, 0.3);
      sub(b, A_AEO, 8, [5], 8, 0.3);
      // Five plucks against four beats, so the accent drifts like water running down a drain.
      arp(b, A_AEO, 0, [0, 'add9'], 8, 0.5, 0.2, [0, 2, 4, 1, 3], {}, 'pluck', 57);
      arp(b, A_AEO, 8, [5, 'add9'], 8, 0.5, 0.2, [0, 2, 4, 1, 3], {}, 'pluck', 57);
      rain(b, c, A_AEO, 16, 0.3, 14);
      port(b, 'bell', 4 + c.r.int(3), A_AEO, 1, 0.18, { pan: -0.3 }, PORT_HEAD, 0);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- market

/** A funk bass bar: root, octave, and fifth in syncopated sixteenths, all short. */
function funkBar(b: B, K: Key, t: number, ch: Ch, g: number): void {
  const r = rootOf(K, ch, 40), f = fifthOf(K, ch, 40);
  const hits: Array<[number, number, number]> = [[0, r, 1], [0.75, r + 12, 0.7], [1.5, r, 0.8], [2, f, 0.75], [2.75, r + 12, 0.6], [3.25, f, 0.7], [3.5, r, 0.85]];
  for (const [at, n, k] of hits) b.n('bass', t + at, n, 0.2, g * k, { cut: 520 });
}

const MARKET_KIT = { kick: '9.....6...9.....', clap: '....8.......8...', shaker: '2.2.2.2.2.2.2.2.', wood: '..4.......4..4..' };

const market: TrackDef = {
  kind: 'place', key: E_DOR, reflect: 0.5, region: 'deeps', bpm: 108, start: 'stalls', vary: 0.45, wrong: 0.03, echo: 0.4, level: 1.05,
  graph: { stalls: [['haggle', 2], ['stalls', 1], ['boat', 1]], haggle: [['stalls', 2], ['boat', 1]], boat: [['stalls', 1]] },
  secs: {
    stalls: (c) => {
      const prog: Ch[] = [[0, 'sev'], [3, 'sev'], [0, 'sev'], [3, 'sev'], [1, 'sev'], [3, 'sev'], [6, 'add9'], [4, 'sev']];
      const b = new B(32, 4, 108);
      prog.forEach((ch, i) => {
        funkBar(b, E_DOR, i * 4, ch, 0.42);
        sub(b, E_DOR, i * 4, ch, 4, 0.18);
        // Brass stabs on the off-beats of two and four.
        for (const off of [1.5, 3.5]) for (const n of tones(E_DOR, ch, 55, 3)) b.n('brass', i * 4 + off, n, 0.22, 0.13, { cut: 1500 });
        b.n('pad', i * 4, tones(E_DOR, ch, 60, 1)[0], 4, 0.1);
      });
      groove(b, 0, 8, MARKET_KIT, 0.44);
      sing(b, 'lead', 0, song(c, { K: E_DOR, prog, bar: 4, dens: 2, lo: 0, hi: 8, slot: 'market' }), E_DOR, 0, 0.3);
      return b.out();
    },
    haggle: (c) => {
      // A seller and a buyer trade phrases, two bars each, over a vamp.
      const prog: Ch[] = [[1, 'sev'], [3, 'sev'], [0, 'sev'], [4, 'sev'], [1, 'sev'], [3, 'sev'], [6, 'add9'], [0, 'sev']];
      const b = new B(32, 4, 108);
      prog.forEach((ch, i) => {
        funkBar(b, E_DOR, i * 4, ch, 0.4);
        sub(b, E_DOR, i * 4, ch, 4, 0.16);
        chordOn(b, 'bell', E_DOR, i * 4 + 0.5, ch, 0.4, 0.07, { ratio: 1 }, 60, 3);
        chordOn(b, 'bell', E_DOR, i * 4 + 2.5, ch, 0.4, 0.06, { ratio: 1 }, 60, 3);
      });
      groove(b, 0, 8, { ...MARKET_KIT, hat: '..3...3...3...3.' }, 0.42);
      for (let k = 0; k < 4; k++) {
        const ch2 = prog.slice(k * 2, k * 2 + 2);
        const m = phrase(c.r, { K: E_DOR, chords: ch2, bar: 4, dens: 2, lo: k % 2 ? -1 : 2, hi: k % 2 ? 5 : 9, cad: k === 3 ? 'home' : 'open' });
        sing(b, k % 2 ? 'lead' : 'cold', k * 8, m, E_DOR, 0, k % 2 ? 0.3 : 0.26);
      }
      return b.out();
    },
    boat: (c) => {
      // Opal's noodle boat: a bell on the bow, steam, water at the pilings, and a Bailer passing far off.
      const b = new B(16, 4, 108);
      const prog: Ch[] = [[0, 'sev'], [3, 'sev'], [0, 'sev'], [6, 'add9']];
      prog.forEach((ch, i) => { funkBar(b, E_DOR, i * 4, ch, 0.3); pad(b, E_DOR, i * 4, ch, 4, 0.14); });
      b.hit(0, 'hiss', 0.12, 16, { a: 3 });
      lap(b, c, 16, 4, 0.26);
      for (let k = 0; k < 3; k++) b.n('glass', k * 5 + c.r.int(2), E_DOR(c.r.pick([4, 7, 9])) + 12, 1.2, 0.14, { pan: 0.4 });
      groove(b, 0, 4, { shaker: '2.2.2.2.2.2.2.2.', clap: '....5.......5...' }, 0.38);
      bailer(b, E_DOR, 6, 0.42, BAILER, {}, true);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- pound

/** One bar of the music box: a plucked root on one, soft chords on two and three, and a sub. */
function boxBar(b: B, K: Key, t: number, ch: Ch, g = 1): void {
  b.n('pluck', t, rootOf(K, ch, 43), 0.9, 0.24 * g);
  for (const n of tones(K, ch, 60, 3)) { b.n('bell', t + 1, n, 0.5, 0.07 * g, { ratio: 1 }); b.n('bell', t + 2, n, 0.5, 0.06 * g, { ratio: 1 }); }
  b.n('sub', t, rootOf(K, ch, 31), 3, 0.15 * g);
}

const POUND_PROG: Ch[] = [[0], [4], [5], [3], [0], [1, 'sev'], [4, 'sev'], [0]];

/** Tilly's loop on the music box, round and round. Its four beats run against the waltz's three. */
function tillyLoop(b: B, K: Key, t: number, times: number, g: number): void {
  for (let k = 0; k < times; k++) b.fig('glass', t + k * 4, TILLY, K, 1, g * (k % 2 ? 0.85 : 1), { ratio: 3.5, pan: 0.25 }, 0.8);
}

const pound: TrackDef = {
  kind: 'place', key: G_ION, reflect: 0.25, region: 'deeps', bpm: 88, start: 'loop', vary: 0.35, wrong: 0.03, echo: 0.45, level: 2,
  graph: { loop: [['loop', 1], ['tilly', 1], ['yard', 1]], tilly: [['loop', 2], ['yard', 1]], yard: [['loop', 1]] },
  secs: {
    loop: (c) => {
      const b = new B(24, 3, 88);
      POUND_PROG.forEach((ch, i) => boxBar(b, G_ION, i * 3, ch));
      tillyLoop(b, G_ION, 0, 6, 0.13);
      groove(b, 0, 8, { wood: '5...3...3...', click: '......2.....' }, 0.3, {}, 3);
      breathe(b, 24, 0.07);
      // A question, then Tilly's habit: the last word again, and then the answer.
      const q = phrase(c.r, { K: G_ION, chords: POUND_PROG.slice(0, 4), bar: 3, dens: 1, lo: 0, hi: 6, cad: 'open' });
      const last = q[q.length - 1][2];
      const a = phrase(c.r, { K: G_ION, chords: POUND_PROG.slice(4), bar: 3, dens: 1, lo: 0, hi: 6, cad: 'home', start: last });
      sing(b, 'cold', 0, q, G_ION, 0, 0.26, { cut: 1800 });
      sing(b, 'cold', 12, a, G_ION, 0, 0.26, { cut: 1800 });
      return b.out();
    },
    tilly: (c) => {
      // Tilly herself: warm low brass, her loop slowed to walking pace in the bass, and her bell at the stop.
      const b = new B(24, 3, 88);
      POUND_PROG.forEach((ch, i) => {
        for (const n of tones(G_ION, ch, 48, 3)) b.n('brass', i * 3, n, 2.8, 0.1, { a: 0.5, cut: 900 });
        b.n('sub', i * 3, rootOf(G_ION, ch, 31), 3, 0.2);
      });
      b.fig('bass', 0, aug(TILLY, 2), G_ION, -2, 0.34, { cut: 400 }, 0.85);
      b.fig('bass', 16, aug(TILLY.slice(0, 4), 2), G_ION, -2, 0.3, { cut: 400 }, 0.85);
      groove(b, 0, 8, { wood: '9.....5.....' }, 0.26, {}, 3);
      for (const at of [9, 9.5]) b.n('bell', at, G_ION(4) + 12, 1, 0.2, { pan: -0.3 });
      breathe(b, 24, 0.1);
      if (c.visit % 2) tillyLoop(b, G_ION, 12, 3, 0.1);
      return b.out();
    },
    yard: (c) => {
      // Woken junk keeps time. The port's figure rises, and the loop stops for a bar after it, the way longing
      // stops when it arrives. Then the loop starts again.
      const b = new B(24, 3, 88);
      POUND_PROG.forEach((ch, i) => boxBar(b, G_ION, i * 3, ch, 0.85));
      groove(b, 0, 8, { clank: '6...........', wood: '....4...4...' }, 0.26, {}, 3);
      tillyLoop(b, G_ION, 0, 2, 0.12);
      port(b, 'cold', 6, G_ION, 0, 0.26, { cut: 1700 });
      tillyLoop(b, G_ION, 12, 3, 0.12);
      breathe(b, 24, 0.08);
      ticks(b, c, 24, 5, 0.08, {}, 'click');
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- ferries

const ferries: TrackDef = {
  kind: 'place', key: B_AEO, reflect: 0.75, region: 'deeps', bpm: 60, start: 'shore', vary: 0.35, wrong: 0.05, echo: 0.6, verb: 1.2, level: 1.07,
  graph: { shore: [['horn', 1], ['hulls', 1], ['shore', 0.5]], horn: [['shore', 1], ['hulls', 1]], hulls: [['shore', 1]] },
  secs: {
    shore: (c) => {
      const b = new B(16, 4, 60);
      b.n('drone', 0, 35, 16, 0.38, { a: 2 });
      pad(b, B_AEO, 0, [0, 'add9'], 8, 0.2);
      pad(b, B_AEO, 8, [5, 'add9'], 8, 0.2);
      sub(b, B_AEO, 0, [0], 8, 0.24);
      sub(b, B_AEO, 8, [5], 8, 0.24);
      lap(b, c, 16, 4, 0.3);
      const m = phrase(c.r, { K: B_AEO, chords: [[0], [0], [5], [5]], bar: 4, dens: 0, lo: 0, hi: 6, cad: 'open' });
      sing(b, 'lead', 0, m, B_AEO, 0, 0.3, { cut: 1300 });
      for (let k = 0; k < 2; k++) b.n('glass', 3 + k * 7 + c.r.int(2), B_AEO(c.r.pick([2, 4, 6])) + 12, 2, 0.12, { pan: c.r.range(-0.6, 0.6) });
      return b.out();
    },
    horn: (c) => {
      // A foghorn far out, and the woken barge breathing on the sand. The port's figure, slow and alone.
      const b = new B(16, 4, 60);
      b.n('drone', 0, 35, 16, 0.32, { a: 1.5 });
      b.n('brass', 0, B_AEO(0) - 12, 3.5, 0.3, { a: 0.6, cut: 700, bend: -1, x: 1 });
      b.n('brass', 8, B_AEO(-1) - 12, 3.5, 0.26, { a: 0.6, cut: 650, bend: -1, x: 1 });
      sub(b, B_AEO, 0, [0], 16, 0.26);
      choir(b, B_AEO, 4, [0, 'add9'], 12, 0.12, 0);
      breathe(b, 16, 0.12);
      lap(b, c, 16, 5, 0.22);
      port(b, 'cold', 5, B_AEO, 0, 0.26, { cut: 1500 }, aug(PORT, 1.5), 0.45);
      return b.out();
    },
    hulls: (c) => {
      const b = new B(16, 4, 60);
      pad(b, B_AEO, 0, [3, 'add9'], 8, 0.18);
      pad(b, B_AEO, 8, [6, 'add9'], 8, 0.18);
      sub(b, B_AEO, 0, [3], 8, 0.24);
      sub(b, B_AEO, 8, [6], 8, 0.24);
      // Old hulls creak as the tide moves them: low notes that sag.
      for (let k = 0; k < 3; k++) b.n('bass', 1 + k * 5, B_AEO(c.r.pick([0, 3, 4])) - 12, 1.6, 0.2, { cut: 260, bend: -0.6, x: 1 });
      for (let k = 0; k < 6; k++) b.n('pluck', c.r.int(30) * 0.5, B_AEO(c.r.pick([0, 2, 4, 7])) + 12, 0.5, 0.12, { pan: c.r.range(-0.7, 0.7) });
      rain(b, c, B_AEO, 16, 0.14, 6);
      lap(b, c, 16, 4, 0.24);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- clinic

/** A heart monitor: a high blip every one and a half beats, so it slides across the five-beat bars. */
function monitor(b: B, K: Key, beats: number, g: number, from = 0): void {
  for (let t = from; t < beats; t += 1.5) b.n('blip', t, K(4) + 24, 0.12, g, { pan: 0.5 });
}

const clinic: TrackDef = {
  kind: 'place', key: C_LYD, reflect: 0, region: 'deeps', bpm: 88, start: 'ward', vary: 0.3, wrong: 0.06, echo: 0.45, level: 1.46,
  graph: { ward: [['scan', 2], ['quiet', 1]], scan: [['ward', 2], ['quiet', 1]], quiet: [['ward', 1]] },
  secs: {
    ward: (c) => {
      const b = new B(20, 5, 88);
      pad(b, C_LYD, 0, [0, 'add9'], 10, 0.2, { cut: 1400 });
      pad(b, C_LYD, 10, [1, 'add9'], 10, 0.2);
      sub(b, C_LYD, 0, [0], 10, 0.26);
      sub(b, C_LYD, 10, [1], 10, 0.26);
      monitor(b, C_LYD, 20, 0.12);
      groove(b, 0, 4, { tick: '3.2.3.2.3.2.3.2.3.2.' }, 0.3, {}, 5);
      const m = phrase(c.r, { K: C_LYD, chords: [[0], [0], [1], [1]], bar: 5, dens: 1, lo: 2, hi: 9, cad: 'open' });
      sing(b, 'cold', 0, m, C_LYD, 0, 0.26);
      return b.out();
    },
    scan: (c) => {
      // Doc Seo looks at the port. The monitor finds its rhythm and copies the port's figure note for note.
      const b = new B(20, 5, 88);
      pad(b, C_LYD, 0, [5, 'add9'], 10, 0.18);
      pad(b, C_LYD, 10, [0, 'add9'], 10, 0.18);
      sub(b, C_LYD, 0, [5], 10, 0.24);
      sub(b, C_LYD, 10, [0], 10, 0.24);
      arp(b, C_LYD, 0, [5, 'add9'], 10, 0.25, 0.1, [0, 2, 1, 3], { cut: 2600 }, 'arp', 69);
      arp(b, C_LYD, 10, [0, 'add9'], 10, 0.25, 0.1, [0, 2, 1, 3], { cut: 2600 }, 'arp', 69);
      b.hit(c.r.int(5), 'scan', 0.12, 4, { n: 74 });
      port(b, 'glass', 8, C_LYD, 1, 0.18, { pan: -0.3 });
      b.fig('blip', 8, PORT, C_LYD, 2, 0.1, { pan: 0.5 }, 0.3);
      monitor(b, C_LYD, 8, 0.1);
      monitor(b, C_LYD, 20, 0.1, 13);
      return b.out();
    },
    quiet: (c) => {
      const b = new B(20, 5, 88);
      b.n('drone', 0, 36, 20, 0.3, { a: 1.5 });
      b.hit(0, 'hum', 0.16, 20, { n: 48, a: 2 });
      monitor(b, C_LYD, 20, 0.12);
      for (let k = 0; k < 2; k++) b.n('glass', 4 + k * 8 + c.r.int(3), C_LYD(c.r.pick([3, 4, 6])) + 12, 2, 0.1, { pan: c.r.range(-0.5, 0.5) });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- camp

const CAMP_PROG: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [0, 'add9'], [4, 'sus4'], [3, 'add9'], [0, 'add9']];

function campBand(b: B, K: Key, prog: readonly Ch[], bar: number, g = 1): void {
  prog.forEach((ch, i) => {
    pad(b, K, i * bar, ch, bar, 0.2 * g);
    sub(b, K, i * bar, ch, bar, 0.28 * g);
    arp(b, K, i * bar, ch, bar, 0.5, 0.17 * g, bar === 3 ? [0, 2, 1, 3, 2, 1] : [0, 2, 1, 3, 2, 1, 0, 2], {}, 'pluck', 55);
  });
}

const camp: TrackDef = {
  kind: 'scene', key: EB_ION, reflect: 0.5, bpm: 76, start: 'fire', vary: 0.4, wrong: 0.03, echo: 0.5, level: 1.22,
  graph: { fire: [['fire', 1], ['water', 1], ['lullaby', 1]], water: [['fire', 1], ['lullaby', 0.5]], lullaby: [['fire', 1], ['water', 1]] },
  secs: {
    fire: (c) => {
      const b = new B(32, 4, 76);
      campBand(b, EB_ION, CAMP_PROG, 4);
      breathe(b, 32, 0.07);
      lap(b, c, 32, 8, 0.18);
      groove(b, 0, 8, { shaker: '..2...2...2...2.', wood: c.visit % 2 ? '4.......3.......' : '4...........3...' }, 0.32);
      sing(b, 'lead', 0, song(c, { K: EB_ION, prog: CAMP_PROG, bar: 4, dens: 1, lo: -1, hi: 7, slot: 'camp' }), EB_ION, 0, 0.3, { cut: 1400 });
      return b.out();
    },
    water: (c) => {
      // The barge breathing in the dark, and the port's figure on the glass.
      const b = new B(16, 4, 76);
      b.n('drone', 0, 39, 16, 0.34, { a: 2 });
      choir(b, EB_ION, 0, [0, 'add9'], 8, 0.14, 0);
      choir(b, EB_ION, 8, [5, 'sev'], 8, 0.14, 0.2);
      sub(b, EB_ION, 0, [0], 8, 0.24);
      sub(b, EB_ION, 8, [5], 8, 0.24);
      breathe(b, 16, 0.12);
      lap(b, c, 16, 4, 0.22);
      port(b, 'glass', 3 + c.r.int(3), EB_ION, 1, 0.18, { pan: 0.3 });
      return b.out();
    },
    lullaby: (c) => {
      // Marit's lullaby by the stove, in three: first on the lead, then on the glass an octave up.
      const prog: Ch[] = [[0, 'add9'], [0, 'six'], [3, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [4, 'sus4'], [0, 'add9'], [0, 'add9']];
      const b = new B(27, 3, 76);
      campBand(b, EB_ION, prog, 3, 0.85);
      breathe(b, 27, 0.06);
      marit(b, 'lead', 3, EB_ION, 0, 0.3, { cut: 1300 });
      marit(b, 'glass', 12, EB_ION, 1, 0.14, { pan: -0.3 });
      if (c.visit % 2) b.fig('bell', 21, MARIT_HEAD, EB_ION, 0, 0.12, { pan: 0.3 }, 0.9);
      return b.out();
    },
  },
};

export const DEEPS_TRACKS: Record<string, TrackDef> = { title, home, deeps, market, pound, ferries, clinic, camp };

