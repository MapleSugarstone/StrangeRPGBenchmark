// Tracks of the Brim and the flood, and the scene tracks: brim, crown, flood, tense, sad, ending, and credits.
// The Brim is high and dry, so nothing up there reflects. The flooded Deeps reflect a whole beat behind.
import { B, MODE, key, retro, shift, type Key, type TrackDef } from './score-core';
import { arp, brass, chordOn, choir, groove, pad, phrase, pulse, rootOf, sing, song, sub, ticks, tones, type Ch } from './parts';
import { BAILER, BAILER_FALLEN, BOARD_I, MARIT, MARIT_HEAD, PORT, PORT_HOME } from './motifs';
import { bailer, board, lap, marit, port, rain } from './weave';

const CS_AEO = key(61, MODE.aeo);
const F_AEO = key(65, MODE.aeo);
const G_AEO = key(55, MODE.aeo);
const D_PHR = key(62, MODE.phr);
const A_AEO = key(57, MODE.aeo);
const D_ION = key(62, MODE.ion);

/** Wind on the Brim: a hiss bed and gusts that sweep across the stereo field. */
function wind(b: B, beats: number, g: number, gusts: number, r: () => number): void {
  b.hit(0, 'hiss', g * 0.6, beats, { a: 3 });
  for (let k = 0; k < gusts; k++) b.hit(Math.floor(r() * Math.max(1, beats - 4)), 'scan', g * 0.6, 4 + r() * 3, { n: 50 + Math.floor(r() * 12) });
}

/** The sea against the Wall: a slow low boom and the wash after it. */
function waves(b: B, beats: number, every: number, g: number): void {
  for (let t = 0; t < beats; t += every) { b.hit(t, 'boom', g * 0.5, 1); b.hit(t + 0.5, 'slosh', g, every * 0.85); }
}

// ---------------------------------------------------------------- brim

const BRIM_PROG: Ch[] = [[0, 'add9'], [5, 'add9'], [2, 'add9'], [6, 'add9'], [3, 'sev'], [5, 'add9'], [4, 'sev'], [0, 'add9']];

const brim: TrackDef = {
  kind: 'place', key: CS_AEO, reflect: 0, region: 'brim', bpm: 64, start: 'wall', vary: 0.35, wrong: 0.04, echo: 0.55, verb: 1.3, level: 1.14,
  graph: { wall: [['sea', 2], ['below', 1]], sea: [['wall', 2], ['below', 1]], below: [['wall', 1]] },
  secs: {
    wall: (c) => {
      const b = new B(32, 4, 64);
      BRIM_PROG.forEach((ch, i) => {
        pad(b, CS_AEO, i * 4, ch, 4, 0.22, { a: 0.8 });
        brass(b, CS_AEO, i * 4, ch, 4, 0.08, { a: 1.4, cut: 1000 }, 48);
        sub(b, CS_AEO, i * 4, ch, 4, 0.3);
      });
      wind(b, 32, 0.24, 3, () => c.r.next());
      waves(b, 32, 8, 0.24);
      sing(b, 'lead', 0, song(c, { K: CS_AEO, prog: BRIM_PROG, bar: 4, dens: 0, lo: 0, hi: 8, slot: 'brim' }), CS_AEO, 0, 0.32);
      return b.out();
    },
    sea: (c) => {
      // Marit asked to see the sea. Her lullaby over the waves, wide and slow.
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [2, 'add9'], [0, 'add9']];
      const b = new B(16, 4, 64);
      b.n('drone', 0, 37, 16, 0.36, { a: 2 });
      prog.forEach((ch, i) => { pad(b, CS_AEO, i * 4, ch, 4, 0.2, { a: 1 }); choir(b, CS_AEO, i * 4, ch, 4, 0.12, 0.3); sub(b, CS_AEO, i * 4, ch, 4, 0.26); });
      waves(b, 16, 4, 0.3);
      wind(b, 16, 0.2, 2, () => c.r.next());
      marit(b, 'lead', 3, CS_AEO, 0, 0.32, { cut: 1500 });
      return b.out();
    },
    below: (c) => {
      // Far below, the Deeps: their arpeggios through the wind, and a Bailer wading.
      const b = new B(16, 4, 64);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [2, 'add9'], [6, 'add9']];
      prog.forEach((ch, i) => {
        arp(b, CS_AEO, i * 4, ch, 4, 0.25, 0.08, [0, 1, 2, 3, 4, 3, 2, 1], { cut: 600 }, 'arp', 52);
        pad(b, CS_AEO, i * 4, ch, 4, 0.16);
        sub(b, CS_AEO, i * 4, ch, 4, 0.22);
      });
      wind(b, 16, 0.26, 2, () => c.r.next());
      bailer(b, CS_AEO, 4, 0.36, BAILER, {}, true);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- crown

// The Board's tower never plays the tonic chord. Teun never says "I".
const CROWN_PROG: Ch[] = [[5, 'add9'], [6], [3, 'sev'], [4, 'sev'], [5, 'add9'], [2, 'add9'], [3, 'sev'], [4, 'sev']];

const crown: TrackDef = {
  kind: 'place', key: F_AEO, reflect: 0, region: 'brim', bpm: 104, start: 'hall', vary: 0.25, wrong: 0.03, echo: 0.35, level: 1,
  graph: { hall: [['boardroom', 2], ['vault', 1]], boardroom: [['hall', 2], ['vault', 1]], vault: [['hall', 1]] },
  secs: {
    hall: (c) => {
      const b = new B(32, 4, 104);
      CROWN_PROG.forEach((ch, i) => {
        for (let k = 0; k < 4; k++) b.n('bass', i * 4 + k, rootOf(F_AEO, ch, 33), 0.6, k ? 0.3 : 0.4, { cut: 320 });
        sub(b, F_AEO, i * 4, ch, 4, 0.22);
        brass(b, F_AEO, i * 4, ch, 0.6, 0.2, { cut: 1500 }, 48);
        pad(b, F_AEO, i * 4, ch, 4, 0.12, { cut: 1200 });
      });
      groove(b, 0, 8, { kick: '8...8...8...8...', clank: '....6.......6...' }, 0.44);
      groove(b, 0, 8, { tick: '3.3.3.3.3.3.3.3.' }, 0.3);
      b.hit(0, 'hum', 0.14, 32, { n: 48, a: 2 });
      for (let k = 0; k < 8; k++) board(b, 'sq', k * 4, F_AEO, 0, k % 2 ? 0.2 : 0.24);
      if (c.visit % 2) b.hit(16, 'scan', 0.1, 4, { n: 72 });
      return b.out();
    },
    boardroom: (c) => {
      // A strict canon: the Board's figure on the square, the same a beat later and an octave down on the cold lead.
      const b = new B(32, 4, 104);
      CROWN_PROG.forEach((ch, i) => {
        pad(b, F_AEO, i * 4, ch, 4, 0.16);
        pulse(b, F_AEO, i * 4, ch, 4, 0.34, 0.5, { cut: 320 });
      });
      groove(b, 0, 8, { kick: '8.......8.......', tick: '3232323232323232' }, 0.36);
      for (let k = 0; k < 7; k++) { board(b, 'sq', k * 4, F_AEO, 0, 0.2); board(b, 'cold', k * 4 + 1, F_AEO, -1, 0.2); }
      const m = phrase(c.r, { K: F_AEO, chords: CROWN_PROG.slice(4), bar: 4, dens: 1, lo: 2, hi: 9, cad: 'none' });
      sing(b, 'lead', 16, m.filter((x) => x[2] % 7 !== 0), F_AEO, 0, 0.18, { cut: 1300 });
      return b.out();
    },
    vault: (c) => {
      // Forty years in a white room. The lullaby with every note cut short, and nothing under it but a hum.
      const b = new B(16, 4, 104);
      b.n('drone', 0, 41, 16, 0.3, { a: 2 });
      b.hit(0, 'hum', 0.18, 16, { n: 53, a: 1 });
      pad(b, F_AEO, 0, [5, 'add9'], 8, 0.14, { cut: 900 });
      pad(b, F_AEO, 8, [3, 'sev'], 8, 0.14, { cut: 900 });
      b.fig('glass', 2, MARIT, F_AEO, 0, 0.16, { pan: 0.3, ratio: 3.5 }, 0.3);
      ticks(b, c, 16, 5, 0.05, {}, 'click');
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- flood

const flood: TrackDef = {
  kind: 'place', key: G_AEO, reflect: 1, region: 'flood', bpm: 56, start: 'drowned', vary: 0.3, wrong: 0.04, echo: 0.6, verb: 1.2, level: 0.93,
  graph: { drowned: [['hendrik', 1], ['bailing', 1]], hendrik: [['drowned', 1], ['bailing', 1]], bailing: [['drowned', 1], ['bailing', 0.5]] },
  secs: {
    drowned: (c) => {
      const b = new B(16, 4, 56);
      b.n('drone', 0, 31, 16, 0.4, { a: 2 });
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'sev'], [0, 'add9']];
      prog.forEach((ch, i) => { pad(b, G_AEO, i * 4, ch, 4, 0.18, { cut: 1000 }); sub(b, G_AEO, i * 4, ch, 4, 0.34); });
      groove(b, 0, 4, { taiko: '9.......4.......' }, 0.46);
      lap(b, c, 16, 4, 0.3);
      for (let k = 0; k < 6; k++) b.hit(c.r.next() * 16, 'drip', 0.18, 0.1, { n: G_AEO(c.r.pick([0, 2, 4])) + 12, pan: c.r.range(-0.6, 0.6) });
      const m = phrase(c.r, { K: G_AEO, chords: prog, bar: 4, dens: 0, lo: 0, hi: 7, cad: 'open' });
      sing(b, 'lead', 0, m, G_AEO, 1, 0.3, { cut: 1200 });
      return b.out();
    },
    hendrik: (c) => {
      // Hendrik fell. The Bailers' figure walks with its last step missing, and the arpeggio stops at a bar line and
      // does not come back for the rest of the pass.
      const b = new B(16, 4, 56);
      b.n('drone', 0, 31, 16, 0.36, { a: 1.5 });
      pad(b, G_AEO, 0, [0, 'add9'], 8, 0.16);
      pad(b, G_AEO, 8, [6, 'add9'], 8, 0.16);
      arp(b, G_AEO, 0, [0, 'add9'], 4 + 4 * c.r.int(2), 0.5, 0.12, [0, 1, 2, 3], { cut: 900 });
      bailer(b, G_AEO, 4, 0.55, BAILER_FALLEN);
      lap(b, c, 16, 4, 0.26);
      return b.out();
    },
    bailing: (c) => {
      // Bailer Night: the people of the Deeps bail beside the Bailers, buckets in time, and the figure walks whole.
      const prog: Ch[] = [[0, 'add9'], [6, 'add9'], [2, 'add9'], [4, 'sev'], [5, 'add9'], [2, 'add9'], [6, 'add9'], [0, 'add9']];
      const b = new B(32, 4, 56);
      prog.forEach((ch, i) => {
        pad(b, G_AEO, i * 4, ch, 4, 0.18);
        sub(b, G_AEO, i * 4, ch, 4, 0.3);
        choir(b, G_AEO, i * 4, ch, 4, 0.12, Math.min(1, i / 7), {}, 52);
        arp(b, G_AEO, i * 4, ch, 4, 0.5, 0.12, [0, 2, 1, 3, 2, 4, 3, 1], { cut: 1400 });
      });
      groove(b, 0, 8, { wood: '5..3..5.5..3..5.', clap: '....6.......6...', taiko: '8.......5.......' }, 0.38);
      for (let t = 1.5; t < 32; t += 2) b.hit(t, 'slosh', 0.18, 0.8, { pan: (t % 4) < 2 ? -0.4 : 0.4 });
      bailer(b, G_AEO, 0, 0.5);
      bailer(b, G_AEO, 16, 0.55);
      sing(b, 'lead', 8, phrase(c.r, { K: G_AEO, chords: prog.slice(2, 4), bar: 4, dens: 1, lo: 2, hi: 9, cad: 'open' }), G_AEO, 0, 0.28);
      sing(b, 'lead', 24, phrase(c.r, { K: G_AEO, chords: prog.slice(6, 8), bar: 4, dens: 1, lo: 2, hi: 9, cad: 'home' }), G_AEO, 0, 0.3);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- tense

/** Pizzicato steps: short plucks walking up and down by step, the way you cross a room you should not be in. */
function creep(b: B, K: Key, t: number, beats: number, start: number, g: number, r: () => number): void {
  let d = start;
  for (let k = 0; k < beats * 2; k++) {
    if (k % 4 === 3 && r() < 0.6) continue;
    b.n('pluck', t + k * 0.5, K(d) - 12, 0.2, g * (k % 2 ? 0.7 : 1));
    d += r() < 0.5 ? 1 : -1;
    if (d > start + 3) d -= 2;
    if (d < start - 3) d += 2;
  }
}

const tense: TrackDef = {
  kind: 'scene', key: D_PHR, reflect: 0.25, bpm: 92, start: 'creep', vary: 0.4, wrong: 0.05, echo: 0.4, level: 1.17,
  graph: { creep: [['patrol', 2], ['creep', 1], ['hold', 1]], patrol: [['creep', 2], ['hold', 1]], hold: [['creep', 1]] },
  secs: {
    creep: (c) => {
      const b = new B(16, 4, 92);
      sub(b, D_PHR, 0, [0], 8, 0.28);
      sub(b, D_PHR, 8, [1], 8, 0.26);
      pad(b, D_PHR, 0, [0, 'sus4'], 8, 0.1, { cut: 800 }, 50);
      pad(b, D_PHR, 8, [1], 8, 0.1, { cut: 800 }, 50);
      creep(b, D_PHR, 0, 16, 0, 0.24, () => c.r.next());
      groove(b, 0, 4, { tick: '3...2...3...2.2.', kick: '6.........4.....' }, 0.34);
      return b.out();
    },
    patrol: (c) => {
      // A patrol passes: the Board's four notes, and a vision cone sweeping the room.
      const b = new B(16, 4, 92);
      sub(b, D_PHR, 0, [0], 16, 0.28);
      pulse(b, D_PHR, 0, [0], 16, 0.24, 1, { cut: 260 });
      creep(b, D_PHR, 0, 16, 2, 0.18, () => c.r.next());
      board(b, 'sq', 2, D_PHR, 0, 0.18, { pan: 0.4 });
      board(b, 'sq', 10, D_PHR, 0, 0.16, { pan: -0.4 });
      b.hit(4 + c.r.int(4), 'scan', 0.14, 4, { n: 64 });
      groove(b, 0, 4, { tick: '3.2.3.2.3.2.3.2.' }, 0.3);
      return b.out();
    },
    hold: (c) => {
      // Holding still behind cover: a sub, a pulse in the ears, and one tick a beat.
      const b = new B(16, 4, 92);
      sub(b, D_PHR, 0, [0], 16, 0.3);
      for (let t = 0; t < 16; t += 2) { b.hit(t, 'kick', 0.18, 0.25); b.hit(t + 0.4, 'kick', 0.12, 0.25); }
      groove(b, 0, 4, { tick: '3...3...3...3...' }, 0.28);
      if (c.r.chance(0.6)) b.n('glass', 6 + c.r.int(6), D_PHR(c.r.pick([1, 4])) + 12, 2, 0.08, { pan: c.r.range(-0.6, 0.6) });
      ticks(b, c, 16, 3, 0.06, {}, 'click');
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- sad

const SAD_PROG: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'sev'], [4, 'sus4'], [0, 'add9'], [2, 'add9'], [3, 'sev'], [4, 'sev']];

const sad: TrackDef = {
  kind: 'scene', key: A_AEO, reflect: 0.75, bpm: 60, start: 'alone', vary: 0.3, wrong: 0.04, echo: 0.6, verb: 1.2, level: 1.3,
  graph: { alone: [['falling', 1], ['still', 1], ['alone', 0.5]], falling: [['alone', 1]], still: [['alone', 1]] },
  secs: {
    alone: (c) => {
      const b = new B(32, 4, 60);
      SAD_PROG.forEach((ch, i) => {
        for (const n of tones(A_AEO, ch, 55, 4)) b.n('bell', i * 4, n, 2.5, 0.09, { ratio: 1 });
        pad(b, A_AEO, i * 4, ch, 4, 0.16);
        sub(b, A_AEO, i * 4, ch, 4, 0.28);
      });
      sing(b, 'lead', 0, song(c, { K: A_AEO, prog: SAD_PROG, bar: 4, dens: 1, lo: 0, hi: 7, slot: 'sad' }), A_AEO, 0, 0.3, { cut: 1300 });
      return b.out();
    },
    falling: () => {
      // The port's figure backward, each time a step lower.
      const b = new B(16, 4, 60);
      b.n('drone', 0, 33, 16, 0.36, { a: 2 });
      choir(b, A_AEO, 0, [0, 'add9'], 8, 0.14, 0);
      choir(b, A_AEO, 8, [5, 'add9'], 8, 0.14, 0.2);
      sub(b, A_AEO, 0, [0], 8, 0.26);
      sub(b, A_AEO, 8, [5], 8, 0.26);
      for (let k = 0; k < 4; k++) port(b, 'glass', k * 4, A_AEO, 1, 0.18 - k * 0.02, { pan: k % 2 ? 0.3 : -0.3 }, shift(retro(PORT), -k), 0);
      return b.out();
    },
    still: (c) => {
      const b = new B(16, 4, 60);
      b.n('drone', 0, 33, 16, 0.36, { a: 2 });
      pad(b, A_AEO, 0, [0, 'add9'], 16, 0.14);
      b.n('lead', 2, A_AEO(c.r.pick([2, 4])), 10, 0.24, { cut: 1100 });
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- ending

const END_PROG: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [0, 'add9']];

function warmBand(b: B, K: Key, prog: readonly Ch[], bar: number, g = 1, drums = true): void {
  prog.forEach((ch, i) => {
    pad(b, K, i * bar, ch, bar, 0.22 * g);
    sub(b, K, i * bar, ch, bar, 0.3 * g);
    arp(b, K, i * bar, ch, bar, 0.5, 0.15 * g, [0, 2, 1, 3, 2, 1, 0, 2], {}, 'pluck', 57);
  });
  if (drums) groove(b, 0, (prog.length * bar) / 4, { taiko: '6.......3.......', shaker: '..3...3...3...3.' }, 0.36 * g);
}

/** The resolution: the port's figure reaches the octave at last, and that note is the first note of Marit's lullaby. */
function arrival(b: B, K: Key, t: number, g: number): number {
  port(b, 'lead', t, K, 0, g, {}, PORT_HOME, 0);
  return marit(b, 'bell', t + 5, K, 0, g * 0.6, { pan: 0.25 });
}

const ending: TrackDef = {
  kind: 'scene', key: D_ION, reflect: 0.5, bpm: 66, start: 'dawn', vary: 0.3, wrong: 0.01, echo: 0.5, level: 1.12,
  graph: { dawn: [['city', 1]], city: [['sea', 1], ['city', 0.5]], sea: [['dawn', 1], ['city', 1]] },
  secs: {
    dawn: () => {
      const prog: Ch[] = [[0, 'add9'], [0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sus4'], [3, 'add9'], [4, 'sus4'], [0, 'add9']];
      const b = new B(32, 4, 66);
      warmBand(b, D_ION, prog, 4, 1, false);
      arrival(b, D_ION, 1, 0.36);
      // The Bailers keep walking, in the major now.
      bailer(b, D_ION, 16, 0.42);
      chordOn(b, 'bell', D_ION, 24, [0, 'add9'], 6, 0.12, {}, 74, 4);
      return b.out({ still: true });
    },
    city: (c) => {
      const b = new B(32, 4, 66);
      warmBand(b, D_ION, END_PROG, 4);
      sing(b, 'lead', 0, song(c, { K: D_ION, prog: END_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'ending' }), D_ION, 0, 0.32);
      if (c.visit % 2) bailer(b, D_ION, 8, 0.32, BAILER, {}, true);
      else b.fig('glass', 9, MARIT_HEAD, D_ION, 1, 0.12, { pan: -0.3 }, 0.9);
      return b.out();
    },
    sea: (c) => {
      const b = new B(16, 4, 66);
      b.n('drone', 0, 38, 16, 0.34, { a: 2 });
      const pair = ([[[0, 'add9'], [3, 'add9']], [[5, 'sev'], [3, 'add9']], [[0, 'add9'], [4, 'sus4']]] as Ch[][])[c.visit % 3];
      pad(b, D_ION, 0, pair[0], 8, 0.2, { a: 1 });
      pad(b, D_ION, 8, pair[1], 8, 0.2, { a: 1 });
      for (let k = 0; k < 2; k++) b.n('glass', 4 + k * 6 + c.r.int(3), D_ION(c.r.pick([2, 4, 7])) + 12, 2, 0.08, { pan: c.r.range(-0.6, 0.6) });
      choir(b, D_ION, 0, [0, 'add9'], 16, 0.1, 0.4);
      waves(b, 16, 8, 0.2);
      port(b, 'glass', 2 + c.r.int(2), D_ION, 1, 0.16, { pan: 0.3 }, PORT_HOME, 0);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- credits

const CREDITS_ORDER = ['c_deeps', 'c_port', 'c_bailers', 'c_board', 'c_marit', 'c_home'];

const credits: TrackDef = {
  kind: 'end', key: D_ION, reflect: 0.5, bpm: 88, start: 'c_deeps', vary: 0.2, wrong: 0, echo: 0.45, level: 1.15,
  // Each motif once, in story order, then the arrival, then the ending's tune for as long as the scroll runs.
  next: (cur) => {
    const i = CREDITS_ORDER.indexOf(cur);
    if (i >= 0 && i < CREDITS_ORDER.length - 1) return CREDITS_ORDER[i + 1];
    return 'c_after';
  },
  secs: {
    c_deeps: (c) => {
      const prog: Ch[] = [[0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sus4']];
      const b = new B(16, 4, 88);
      warmBand(b, D_ION, prog, 4, 0.9);
      rain(b, c, D_ION, 16, 0.14, 6);
      sing(b, 'lead', 0, phrase(c.r, { K: D_ION, chords: prog, bar: 4, dens: 1, lo: 0, hi: 7, cad: 'open' }), D_ION, 0, 0.32);
      return b.out();
    },
    c_port: () => {
      const b = new B(16, 4, 88);
      warmBand(b, D_ION, [[0, 'add9'], [3, 'add9'], [5, 'sev'], [4, 'sus4']], 4, 0.9);
      port(b, 'lead', 1, D_ION, 0, 0.34);
      port(b, 'lead', 9, D_ION, 0, 0.32);
      return b.out();
    },
    c_bailers: () => {
      const b = new B(16, 4, 88);
      warmBand(b, D_ION, [[0, 'add9'], [5, 'sev'], [3, 'add9'], [0, 'add9']], 4, 0.85);
      bailer(b, D_ION, 0, 0.5);
      bailer(b, D_ION, 8, 0.45);
      return b.out();
    },
    c_board: () => {
      // The Board's four notes, harmless on the bells, and the last time through they land on the tonic.
      const b = new B(16, 4, 88);
      warmBand(b, D_ION, [[3, 'add9'], [4, 'sus4'], [5, 'sev'], [0, 'add9']], 4, 0.85);
      board(b, 'sq', 0, D_ION, 0, 0.22);
      board(b, 'sq', 4, D_ION, 0, 0.22);
      board(b, 'sq', 8, D_ION, 0, 0.22);
      board(b, 'sq', 12, D_ION, 0, 0.24, {}, BOARD_I);
      return b.out();
    },
    c_marit: () => {
      const prog: Ch[] = [[0, 'six'], [0, 'six'], [3, 'add9'], [4, 'sus4'], [0, 'add9'], [0, 'add9']];
      const b = new B(18, 3, 88);
      warmBand(b, D_ION, prog, 3, 0.85, false);
      marit(b, 'lead', 3, D_ION, 0, 0.34);
      return b.out();
    },
    c_home: () => {
      const b = new B(24, 4, 88);
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [0, 'add9'], [4, 'sus4'], [0, 'add9'], [0, 'add9']];
      warmBand(b, D_ION, prog, 4, 1, false);
      arrival(b, D_ION, 1, 0.36);
      chordOn(b, 'bell', D_ION, 16, [0, 'add9'], 6, 0.16, {}, 74, 4);
      b.hit(16, 'crash', 0.24, 1);
      return b.out({ still: true, end: true });
    },
    c_after: (c) => {
      const b = new B(32, 4, 88);
      warmBand(b, D_ION, END_PROG, 4, 0.85);
      sing(b, 'lead', 0, song(c, { K: D_ION, prog: END_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'ending' }), D_ION, 0, 0.3);
      return b.out();
    },
  },
};

export const BRIM_TRACKS: Record<string, TrackDef> = { brim, crown, flood, tense, sad, ending, credits };

