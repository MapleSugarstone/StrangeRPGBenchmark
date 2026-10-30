// Tracks of the Stair: stair, lanterns, church, farm, and spire. The Stair is cleaner and higher. Its wet concrete
// reflects faintly, a sixteenth behind, and its interiors not at all.
import { B, MODE, aug, key, type Key, type TrackDef } from './score-core';
import { arp, bounce, brass, chordOn, choir, groove, oompah, pad, phrase, pulse, rootOf, sing, song, sub, ticks, tones, type Ch } from './parts';
import { BAILER, MARIT, MARIT_HEAD, PORT, PORT_HEAD } from './motifs';
import { bailer, board, marit, port, rain } from './weave';

const AB_LYD = key(68, MODE.lyd);
const FS_AEO = key(66, MODE.aeo);
const D_ION = key(62, MODE.ion);
const C_ION = key(60, MODE.ion);
const E_PHR = key(64, MODE.phr);

// ---------------------------------------------------------------- stair

const STAIR_PROG: Ch[] = [[0, 'sev'], [1, 'add9'], [5, 'sev'], [4, 'sus4'], [0, 'sev'], [1, 'add9'], [6, 'sev'], [2, 'sev']];
const STAIR_KIT = { kick: '7...6...7...6...', wood: '....5.......5...', hat: '..3...3...3...3.' };

/** The Stair's band: an electric piano on the beat, clean arpeggios, and a bass that bounces between octaves. */
function stairBand(b: B, K: Key, prog: readonly Ch[], g = 1, arpLo = 63): void {
  prog.forEach((ch, i) => {
    for (const n of tones(K, ch, 57, 4)) { b.n('bell', i * 4, n, 1.6, 0.09 * g, { ratio: 1 }); b.n('bell', i * 4 + 2.5, n, 1, 0.06 * g, { ratio: 1 }); }
    bounce(b, K, i * 4, ch, 4, 0.3 * g, { cut: 650 }, 36);
    sub(b, K, i * 4, ch, 4, 0.2 * g);
    arp(b, K, i * 4, ch, 4, 0.25, 0.11 * g, [0, 2, 1, 3, 2, 4, 3, 1], { cut: 2600 }, 'arp', arpLo);
  });
}

const stair: TrackDef = {
  kind: 'place', key: AB_LYD, reflect: 0.25, region: 'stair', bpm: 100, start: 'terrace', vary: 0.4, wrong: 0.03, echo: 0.45, level: 1.06,
  mix: { wet: 0.6 },
  graph: { terrace: [['lift', 2], ['terrace', 1], ['garden', 1]], lift: [['terrace', 2], ['garden', 1]], garden: [['terrace', 1]] },
  secs: {
    terrace: (c) => {
      const b = new B(32, 4, 100);
      stairBand(b, AB_LYD, STAIR_PROG);
      groove(b, 0, 8, STAIR_KIT, 0.38);
      sing(b, 'lead', 0, song(c, { K: AB_LYD, prog: STAIR_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'stair' }), AB_LYD, 0, 0.3);
      return b.out();
    },
    lift: (c) => {
      // Going up a terrace: the arpeggios climb a step every two bars, and far above, the Board's four notes.
      const prog: Ch[] = [[0, 'sev'], [1, 'add9'], [2, 'sev'], [4, 'sus4'], [5, 'sev'], [6, 'sev'], [1, 'add9'], [4, 'sus4']];
      const b = new B(32, 4, 100);
      prog.forEach((ch, i) => {
        for (const n of tones(AB_LYD, ch, 57, 4)) b.n('bell', i * 4, n, 1.6, 0.08, { ratio: 1 });
        bounce(b, AB_LYD, i * 4, ch, 4, 0.28, { cut: 650 }, 36);
        sub(b, AB_LYD, i * 4, ch, 4, 0.2);
        arp(b, AB_LYD, i * 4, ch, 4, 0.25, 0.12, [0, 1, 2, 3, 4, 5, 4, 3], { cut: 2800 }, 'arp', 60 + Math.floor(i / 2) * 2);
      });
      groove(b, 0, 8, { ...STAIR_KIT, shaker: '.2.2.2.2.2.2.2.2' }, 0.38);
      const m = phrase(c.r, { K: AB_LYD, chords: prog.slice(0, 4), bar: 4, dens: 2, lo: 0, hi: 7, cad: 'open' });
      sing(b, 'cold', 0, m, AB_LYD, 0, 0.26);
      board(b, 'sq', 18, AB_LYD, 1, 0.13, { pan: 0.4 });
      board(b, 'sq', 26, AB_LYD, 1, 0.11, { pan: -0.4 });
      return b.out();
    },
    garden: (c) => {
      const b = new B(16, 4, 100);
      b.n('drone', 0, 44, 16, 0.3, { a: 2 });
      pad(b, AB_LYD, 0, [0, 'add9'], 8, 0.2);
      pad(b, AB_LYD, 8, [1, 'add9'], 8, 0.2);
      sub(b, AB_LYD, 0, [0], 8, 0.22);
      sub(b, AB_LYD, 8, [1], 8, 0.22);
      // A terrace fountain, and the port's figure among the bells.
      b.hit(0, 'hiss', 0.12, 16, { a: 2 });
      for (let k = 0; k < 8; k++) b.hit(c.r.next() * 16, 'drip', 0.2, 0.1, { n: AB_LYD(c.r.pick([0, 2, 4, 7])) + 24, pan: c.r.range(-0.6, 0.6) });
      port(b, 'glass', 2 + c.r.int(3), AB_LYD, 1, 0.16, { pan: 0.3 });
      chordOn(b, 'bell', AB_LYD, 9, [0, 'sev'], 2, 0.08, { ratio: 1 }, 64, 4);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- lanterns

const CLUB_PROG: Ch[] = [[0, 'add9'], [5, 'add9'], [2, 'add9'], [6, 'add9']];
const CLUB_B: Ch[] = [[3, 'sev'], [5, 'sev'], [0, 'add9'], [4, 'sev']];
const CLUB_KIT = { kick: '9...9...9...9...', clap: '....8.......8...', hat: '..5...5...5...5.' };
const RIFF_CLUB = [[0, 0.75], [2, 0.75], [4, 0.5], [3, 0.5], [2, 0.5], [0, 1], [4, 0.75], [5, 0.75], [4, 0.5], [2, 1], [1, 1]] as const;

/** The club's band: a bass that pumps on the off-beats, short chord stabs, and the port's figure at double speed. */
function clubBand(b: B, K: Key, prog: readonly Ch[], g = 1, hook = true): void {
  prog.forEach((ch, i) => {
    const r = rootOf(K, ch, 33);
    for (let k = 0; k < 4; k++) { b.n('bass', i * 4 + k, r, 0.2, 0.26 * g, { cut: 500 }); b.n('bass', i * 4 + k + 0.5, r + 12, 0.35, 0.42 * g, { cut: 800 }); }
    sub(b, K, i * 4, ch, 4, 0.2 * g);
    for (const off of [0.5, 1.75, 2.5, 3.75]) for (const n of tones(K, ch, 57, 3)) b.n('brass', i * 4 + off, n, 0.2, 0.1 * g, { cut: 2400 });
    pad(b, K, i * 4, ch, 4, 0.12 * g, { a: 0.3 });
    if (hook) b.fig('arp', i * 4 + (i % 2 ? 2 : 0), aug(PORT, 0.5), K, 0, 0.15 * g, { cut: 2200 }, 0.8);
  });
}

const lanterns: TrackDef = {
  kind: 'place', key: FS_AEO, reflect: 0.25, region: 'stair', bpm: 124, start: 'floor', vary: 0.4, wrong: 0.02, echo: 0.4, level: 0.95,
  graph: { floor: [['drop', 2], ['break', 1]], drop: [['floor', 1], ['break', 1], ['outside', 0.5]], break: [['drop', 2], ['floor', 1]], outside: [['floor', 1]] },
  secs: {
    floor: (c) => {
      const prog = [...CLUB_PROG, ...CLUB_PROG];
      const b = new B(32, 4, 124);
      clubBand(b, FS_AEO, prog);
      groove(b, 0, 8, CLUB_KIT, 0.46);
      groove(b, 0, 8, { shaker: '2222222222222222' }, 0.3);
      b.fig('lead', 0, RIFF_CLUB, FS_AEO, 0, 0.28, { m: 1, cut: 2600 }, 0.85);
      b.fig('lead', 16, RIFF_CLUB, FS_AEO, 0, 0.28, { m: 1, cut: 2600 }, 0.85);
      if (c.visit % 2) breatheMachines(b, 32);
      return b.out();
    },
    drop: (c) => {
      const prog = [...CLUB_PROG, ...CLUB_B];
      const b = new B(32, 4, 124);
      clubBand(b, FS_AEO, prog, 1.05);
      groove(b, 0, 8, { ...CLUB_KIT, hat: '..5.3.5.3.5.3.5.' }, 0.48);
      prog.forEach((ch, i) => choir(b, FS_AEO, i * 4, ch, 3.8, 0.12, 1, {}, 57));
      sing(b, 'lead', 0, song(c, { K: FS_AEO, prog, bar: 4, dens: 2, lo: 0, hi: 8, slot: 'lanterns' }), FS_AEO, 0, 0.3, { cut: 2400 });
      b.hit(0, 'crash', 0.24, 1);
      return b.out();
    },
    break: (c) => {
      // The kick drops out, the strings hold, a riser climbs, and the port's first notes hang in the air.
      const b = new B(16, 4, 124);
      pad(b, FS_AEO, 0, [0, 'add9'], 8, 0.2);
      pad(b, FS_AEO, 8, [5, 'add9'], 8, 0.2);
      sub(b, FS_AEO, 0, [0], 8, 0.24);
      sub(b, FS_AEO, 8, [5], 8, 0.24);
      groove(b, 0, 4, { hat: '..3...3...3...3.' }, 0.36);
      b.hit(8, 'swell', 0.26, 8);
      b.hit(12, 'roll', 0.3, 4);
      port(b, 'cold', 2, FS_AEO, 0, 0.26, {}, PORT_HEAD, 0);
      port(b, 'cold', 10, FS_AEO, 0, 0.26, {}, PORT_HEAD, 0);
      if (c.visit % 2) breatheMachines(b, 16);
      return b.out();
    },
    outside: (c) => {
      // Out on the steps: the club through a wall, only the kick and a dull bass, and the rain.
      const b = new B(16, 4, 124);
      CLUB_PROG.forEach((ch, i) => {
        for (let k = 0; k < 4; k++) b.n('bass', i * 4 + k + 0.5, rootOf(FS_AEO, ch, 33), 0.3, 0.3, { cut: 160 });
        pad(b, FS_AEO, i * 4, ch, 4, 0.08, { a: 0.5 }, 48);
      });
      groove(b, 0, 4, { kick: '7...7...7...7...' }, 0.4);
      rain(b, c, FS_AEO, 16, 0.3, 10);
      return b.out({ reflect: 0.5 });
    },
  },
};

/** Tova's dancing washing machines: a clank and a breath on the off-beats. */
function breatheMachines(b: B, beats: number): void {
  for (let t = 1.5; t < beats; t += 4) { b.hit(t, 'clank', 0.12, 0.25, { pan: -0.4 }); b.hit(t + 2, 'breath', 0.1, 1, { pan: 0.4 }); }
}

// ---------------------------------------------------------------- church

const church: TrackDef = {
  kind: 'place', key: D_ION, reflect: 0, region: 'stair', bpm: 60, start: 'nave', vary: 0.25, wrong: 0.02, echo: 0.35, verb: 1.4, level: 0.99,
  graph: { nave: [['hymn', 2], ['offering', 1]], hymn: [['nave', 1], ['offering', 1]], offering: [['nave', 1], ['hymn', 1]] },
  secs: {
    nave: (c) => {
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [4, 'sus4'], [0, 'add9']];
      const b = new B(16, 4, 60);
      b.n('drone', 0, 38, 16, 0.4, { a: 2 });
      prog.forEach((ch, i) => {
        // The organ: strings and a held bass, with the choir on oo above.
        pad(b, D_ION, i * 4, ch, 4, 0.22, { a: 0.4 });
        sub(b, D_ION, i * 4, ch, 4, 0.3);
        choir(b, D_ION, i * 4, ch, 4, 0.2, 0.2, {}, 57);
      });
      b.n('bell', 0, D_ION(0), 3, 0.2, { ratio: 1.41 });
      b.n('bell', 8, D_ION(4), 3, 0.16, { ratio: 1.41 });
      const m = phrase(c.r, { K: D_ION, chords: prog, bar: 4, dens: 0, lo: 2, hi: 9, cad: 'home' });
      sing(b, 'choir', 0, m, D_ION, 0, 0.22, { ah: 0.8, m: undefined });
      return b.out();
    },
    hymn: (c) => {
      // The Church sings the Saint's lullaby as a hymn and does not know whose it is.
      // Three harmonizations of the same tune, one per visit in turn.
      const prog: Ch[] = ([
        [[0, 'six'], [5, 'sev'], [4, 'add9'], [3, 'sev'], [1, 'sev'], [0, 'add9']],
        [[5, 'sev'], [0, 'six'], [2, 'sev'], [3, 'add9'], [4, 'sus4'], [0, 'add9']],
        [[0, 'add9'], [5, 'sev'], [1, 'sev'], [3, 'sev'], [4, 'sus4'], [0, 'six']],
      ] as Ch[][])[c.visit % 3];
      const b = new B(18, 3, 60);
      b.n('drone', 0, 38, 18, 0.36, { a: 1.5 });
      prog.forEach((ch, i) => {
        pad(b, D_ION, i * 3, ch, 3, 0.18);
        choir(b, D_ION, i * 3, ch, 3, 0.16, 0, {}, 52);
        sub(b, D_ION, i * 3, ch, 3, 0.28);
      });
      b.fig('choir', 0, aug(MARIT, 2), D_ION, 0, 0.3, { ah: 1 }, 0.96);
      if (c.visit % 2) b.fig('bell', 0, aug(MARIT_HEAD, 2), D_ION, 1, 0.1, { pan: 0.4 }, 0.9);
      for (let k = 0; k < 2; k++) { const bar = 1 + c.r.int(5); b.n('bell', bar * 3, tones(D_ION, prog[bar], 74, 3)[c.r.int(3)], 2, 0.08, { ratio: 1.41, pan: c.r.range(-0.5, 0.5) }); }
      return b.out();
    },
    offering: (c) => {
      // The collection: soft brass, coins in the plate, and under it all the Board's figure in the bass, the stipend.
      const prog: Ch[] = [[0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sus4']];
      const b = new B(16, 4, 60);
      prog.forEach((ch, i) => {
        brass(b, D_ION, i * 4, ch, 4, 0.12, { a: 0.8, cut: 1200 }, 50);
        pad(b, D_ION, i * 4, ch, 4, 0.16);
      });
      board(b, 'bass', 4, D_ION, -2, 0.3, { cut: 300, m: undefined });
      board(b, 'sub', 4, D_ION, -2, 0.26, { m: undefined });
      for (let k = 0; k < 6; k++) b.n('blip', 1 + c.r.next() * 13, D_ION(c.r.pick([4, 7, 9])) + 12, 0.1, 0.12, { pan: c.r.range(-0.5, 0.5) });
      const m = phrase(c.r, { K: D_ION, chords: prog, bar: 4, dens: 1, lo: 0, hi: 7, cad: 'home' });
      sing(b, 'lead', 0, m, D_ION, 0, 0.26, { cut: 1500 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- farm

const FARM_PROG: Ch[] = [[0], [3], [4], [0], [5], [3], [4, 'sev'], [0]];

const farm: TrackDef = {
  kind: 'place', key: C_ION, reflect: 0, region: 'stair', bpm: 112, start: 'play', vary: 0.45, wrong: 0.14, echo: 0.35, level: 1.62,
  graph: { play: [['lesson', 2], ['play', 1], ['naptime', 1]], lesson: [['play', 2], ['naptime', 1]], naptime: [['play', 1]] },
  secs: {
    play: (c) => {
      const prog = [...FARM_PROG, ...FARM_PROG].slice(0, 8);
      const b = new B(32, 4, 112);
      prog.forEach((ch, i) => { oompah(b, C_ION, i * 4, ch, 4, 0.3, 'pluck'); pad(b, C_ION, i * 4, ch, 4, 0.1, { a: 0.3 }, 60); });
      groove(b, 0, 8, { clap: '....7.......7...', wood: '5.....3.5.......' }, 0.36);
      const m = song(c, { K: C_ION, prog, bar: 4, dens: 1, lo: 0, hi: 7, slot: 'farm' });
      sing(b, 'lead', 0, m, C_ION, 0, 0.28, { cut: 2600 });
      // The glockenspiel doubles the song an octave up, a little too exactly.
      sing(b, 'glass', 0, m, C_ION, 1, 0.1, { ratio: 3.5 });
      // Under the last chorus, very low, a note a tritone from home fades in and out.
      b.n('drone', 24, 42, 8, 0.14, { a: 4, x: 1, odd: 1 });
      return b.out();
    },
    lesson: (c) => {
      // "Our Kees will keep them walking." The Bailers' figure as a toy on the bells, then once for real, very low.
      const b = new B(32, 4, 112);
      FARM_PROG.forEach((ch, i) => { oompah(b, C_ION, i * 4, ch, 4, 0.28, 'brass'); pad(b, C_ION, i * 4, ch, 4, 0.1, { a: 0.3 }, 60); });
      groove(b, 0, 8, { clap: '....7.......7...' }, 0.34);
      for (let k = 0; k < 3; k++) b.fig('glass', k * 4, aug(BAILER, 0.5), C_ION, 2, 0.13, { ratio: 3.5, pan: k % 2 ? 0.3 : -0.3 }, 0.85);
      const m = phrase(c.r, { K: C_ION, chords: FARM_PROG.slice(0, 4), bar: 4, dens: 1, lo: 0, hi: 7, cad: 'open' });
      sing(b, 'lead', 0, m, C_ION, 0, 0.26, { cut: 2600 });
      bailer(b, C_ION, 20, 0.36, BAILER, { odd: 1 }, true);
      return b.out();
    },
    naptime: () => {
      // Marit's lullaby on the music box, with one note a half step low.
      const prog: Ch[] = [[0, 'six'], [0, 'six'], [3], [4, 'sus4'], [0], [0]];
      const b = new B(18, 3, 112);
      prog.forEach((ch, i) => { pad(b, C_ION, i * 3, ch, 3, 0.18); sub(b, C_ION, i * 3, ch, 3, 0.24); b.n('pluck', i * 3, rootOf(C_ION, ch, 43), 1, 0.2); });
      choir(b, C_ION, 0, [0, 'add9'], 18, 0.1, 0);
      const box = MARIT.map((x, i) => (i === 6 && x[0] !== null ? [x[0], x[1], -1] as const : x));
      b.fig('glass', 3, box, C_ION, 1, 0.16, { ratio: 3.5 }, 0.85);
      for (const e of b.ev) if (e.v === 'glass' && Math.abs(e.t - 7.5) < 1e-6) e.x = 1;
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- spire

const SPIRE_PROG: Ch[] = [[0], [1, 'sev'], [5, 'sev'], [0, 'sus4'], [3], [1, 'sev'], [6], [0]];

/** A heart monitor high in the ward. */
function beeps(b: B, K: Key, beats: number, every: number, g: number): void {
  for (let t = 0; t < beats; t += every) b.n('blip', t, K(0) + 24, 0.1, g, { pan: 0.5 });
}

const spire: TrackDef = {
  kind: 'place', key: E_PHR, reflect: 0, region: 'stair', bpm: 84, start: 'lobby', vary: 0.3, wrong: 0.04, echo: 0.45, level: 1.07,
  graph: { lobby: [['ward', 1], ['lift', 1], ['lobby', 0.5]], ward: [['lobby', 1], ['lift', 1]], lift: [['lobby', 1], ['ward', 1]] },
  secs: {
    lobby: (c) => {
      const b = new B(32, 4, 84);
      SPIRE_PROG.forEach((ch, i) => {
        pad(b, E_PHR, i * 4, ch, 4, 0.18, { cut: 1300 });
        for (let k = 0; k < 4; k++) b.n('bass', i * 4 + k, rootOf(E_PHR, ch, 33), 0.5, k ? 0.26 : 0.34, { cut: 300 });
        sub(b, E_PHR, i * 4, ch, 4, 0.2);
      });
      groove(b, 0, 8, { tick: '3.2.3.2.3.2.3.2.' }, 0.28);
      b.hit(0, 'hum', 0.1, 32, { n: 40, a: 2 });
      board(b, 'sq', 4, E_PHR, 0, 0.2);
      board(b, 'sq', 20, E_PHR, 0, 0.18);
      const m = phrase(c.r, { K: E_PHR, chords: SPIRE_PROG.slice(4), bar: 4, dens: 1, lo: 2, hi: 8, cad: 'open' });
      sing(b, 'cold', 8, m, E_PHR, 0, 0.24);
      return b.out();
    },
    ward: (c) => {
      // The top ward. A monitor, and very far off, the first bar of an old lullaby. The port leans toward it.
      const b = new B(16, 4, 84);
      b.n('drone', 0, 40, 16, 0.34, { a: 2 });
      pad(b, E_PHR, 0, [0], 8, 0.16, { cut: 1100 });
      pad(b, E_PHR, 8, [5, 'sev'], 8, 0.16, { cut: 1100 });
      beeps(b, E_PHR, 16, 1.5, 0.11);
      b.fig('glass', 2, MARIT_HEAD, E_PHR, 1, 0.1, { pan: 0.5 }, 0.9);
      port(b, 'cold', 8, E_PHR, 0, 0.26, {}, PORT, 0.7);
      ticks(b, c, 16, 4, 0.06, {}, 'click');
      return b.out();
    },
    lift: (c) => {
      // The service lift: arpeggios step up a chord at a time, and the Board's figure keeps the floor count.
      const prog: Ch[] = [[0], [1, 'sev'], [2], [3], [5, 'sev'], [6], [0], [1, 'sev']];
      const b = new B(32, 4, 84);
      prog.forEach((ch, i) => {
        arp(b, E_PHR, i * 4, ch, 4, 0.25, 0.13, [0, 1, 2, 3, 4, 3, 2, 1], { cut: 2000 }, 'arp', 55 + i);
        pulse(b, E_PHR, i * 4, ch, 4, 0.34, 0.5, { cut: 340 });
        pad(b, E_PHR, i * 4, ch, 4, 0.12);
      });
      groove(b, 0, 8, { kick: '7.......6.......', tick: '..3...3...3...3.' }, 0.36);
      board(b, 'sq', 8, E_PHR, 0, 0.22);
      board(b, 'sq', 24, E_PHR, 0, 0.22);
      if (c.visit % 2) b.hit(16, 'scan', 0.1, 4, { n: 70 });
      return b.out();
    },
  },
};

export const STAIR_TRACKS: Record<string, TrackDef> = { stair, lanterns, church, farm, spire };

