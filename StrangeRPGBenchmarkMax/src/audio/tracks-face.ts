// Tracks of the Face and the Glass: bright, solehold, relay_tower, glass, minim, and glass_quarry. The sun stands
// high here and leads are short, so lead notes cast their pre-notes only a sixteenth early.
import { B, MODE, aug, inv, key, retro, type Ctx, type Key, type TrackDef } from './score-core';
import { arp, chordOn, choir, groove, motif, oompah, pad, phrase, rootOf, sing, song, sub, ticks, tones, type Ch, type Mel } from './parts';
import { ANTH, MINIM, MINIM_CRACKED, NODUS_HEAD, STILE, UMB } from './motifs';

const E_LYD = key(64, MODE.lyd);
const BB_ION = key(58, MODE.ion);
const EB_ION = key(63, MODE.ion);
const B_MIX = key(59, MODE.mix);
const A_LYD = key(57, MODE.lyd);
const FS_AEO = key(66, MODE.aeo);
const FS_PHR = key(66, MODE.phr);

const SHORT = 0.25;

// ---------------------------------------------------------------- bright

const BRIGHT_PROG: Ch[] = [[0, 'add9'], [1, 'add9'], [0, 'add9'], [5, 'sev'], [2, 'sev'], [1, 'add9'], [5, 'sev'], [0, 'add9']];

/** Heat: a shimmer of very quiet repeated notes high up, the air wavering over the road. */
function shimmer(b: B, c: Ctx, K: Key, beats: number, g: number): void {
  const n = K(c.r.pick([4, 7, 9])) + 24;
  for (let t = 0; t < beats; t += 0.125) b.n('blip', t, n, 0.08, g * (0.5 + 0.5 * Math.sin(t * 1.7)), { pan: Math.sin(t * 0.9) * 0.6 });
}

const bright: TrackDef = {
  kind: 'place', key: E_LYD, shadow: SHORT, region: 'face', bpm: 80, start: 'glare', vary: 0.4, wrong: 0.04, echo: 0.6, verb: 1.1, level: 1.75,
  graph: { glare: [['glare', 2], ['heat', 1], ['tower', 0.6]], heat: [['glare', 1]], tower: [['glare', 1]] },
  secs: {
    glare: (c) => {
      const b = new B(32, 4, 80);
      BRIGHT_PROG.forEach((ch, i) => {
        pad(b, E_LYD, i * 4, ch, 4, 0.14, {}, 64);
        if (i % 2 === 0) b.n('pluck', i * 4, rootOf(E_LYD, ch, 52), 2, 0.16);
        b.n('glass', i * 4 + c.r.pick([0, 1, 2]), tones(E_LYD, ch, 76, 4)[c.r.int(3)], 2, 0.13, { pan: c.r.range(-0.6, 0.6) });
      });
      groove(b, 0, 8, { tick: '3.......2...2...' }, 0.3);
      if (c.r.chance(0.5)) shimmer(b, c, E_LYD, 8, 0.05);
      sing(b, 'cold', 0, song(c, { K: E_LYD, prog: BRIGHT_PROG, bar: 4, dens: 0, lo: 2, hi: 9, slot: 'bright' }), E_LYD, 1, 0.26);
      return b.out();
    },
    heat: (c) => {
      const b = new B(16, 4, 80);
      b.hit(0, 'hiss', 0.18, 16, { a: 1 });
      pad(b, E_LYD, 0, [0, 'add9'], 8, 0.14, {}, 64);
      pad(b, E_LYD, 8, [1, 'add9'], 8, 0.14, {}, 64);
      shimmer(b, c, E_LYD, 16, 0.06);
      b.hit(4, 'scan', 0.12, 6, { n: 76 });
      ticks(b, c, 16, 8, 0.12);
      b.n('glass', 10, E_LYD(3) + 24, 3, 0.14, { pan: 0.5, odd: 1 });
      return b.out();
    },
    tower: (c) => {
      const b = new B(16, 4, 80);
      pad(b, E_LYD, 0, [5, 'sev'], 16, 0.14, {}, 60);
      sub(b, E_LYD, 0, [5], 16, 0.16);
      // The Office's towers stand far down the road: its square stamps, faint.
      motif(b, 'sq', 4, ANTH.slice(0, 5), E_LYD, 1, 0.14);
      b.hit(2, 'scan', 0.14, 8, { n: 72 });
      ticks(b, c, 16, 5, 0.1);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- solehold

const SOLE_PROG: Ch[] = [[0], [4, 'sev'], [3], [4, 'sev'], [5], [1, 'sev'], [4, 'sev'], [0]];

function march(b: B, bars: number, g: number): void {
  groove(b, 0, bars, { kick: '9.......8.......', snare: '6..36..36.6.6..3' }, g);
  b.hit(0, 'crash', 0.24 * g / 0.5, 1);
  b.hit(bars * 4 - 2, 'roll', 0.34 * g / 0.5, 2);
}

const solehold: TrackDef = {
  kind: 'place', key: BB_ION, shadow: SHORT, region: 'face', bpm: 108, start: 'march', vary: 0.35, wrong: 0.03, echo: 0.35, level: 1.24,
  graph: {
    march: [['tune', 1.5], ['march', 1], ['trio', 1], ['fanfare', 0.5]],
    tune: [['march', 1], ['trio', 1]],
    trio: [['march', 1.5], ['fanfare', 0.5]],
    fanfare: [['march', 1]],
  },
  secs: {
    march: (c) => {
      const b = new B(32, 4, 108);
      const prog: Ch[] = [[0], [4, 'sev'], [3], [0], [0], [4, 'sev'], [3], [0]];
      prog.forEach((ch, i) => oompah(b, BB_ION, i * 4, ch, 4, 0.34, 'brass'));
      march(b, 8, 0.48);
      // SALUTATIONS: the dotted figure on the lead with the brass doubling it, answered each time.
      for (const at of [0, 16]) {
        motif(b, 'lead', at, UMB, BB_ION, 1, 0.36);
        b.fig('brass', at, UMB, BB_ION, 0, 0.22, { cut: 2400 }, 0.9);
        const ans = phrase(c.r, { K: BB_ION, chords: [prog[1], prog[2], prog[3]], bar: 4, dens: 2, lo: 2, hi: 9, cad: 'home' });
        sing(b, 'lead', at + 4, ans, BB_ION, 1, 0.32);
      }
      return b.out();
    },
    tune: (c) => {
      const b = new B(32, 4, 108);
      SOLE_PROG.forEach((ch, i) => oompah(b, BB_ION, i * 4, ch, 4, 0.32, 'brass'));
      march(b, 8, 0.44);
      sing(b, 'lead', 0, song(c, { K: BB_ION, prog: SOLE_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'solehold' }), BB_ION, 1, 0.34);
      return b.out();
    },
    trio: (c) => {
      // The shade orchard, in the key a fourth up: softer, with bells and a dotted bass.
      const prog: Ch[] = [[0, 'add9'], [5, 'sev'], [1, 'sev'], [4, 'sev'], [0, 'add9'], [3, 'add9'], [4, 'sus4'], [0, 'add9']];
      const b = new B(32, 4, 108);
      prog.forEach((ch, i) => {
        pad(b, EB_ION, i * 4, ch, 4, 0.18);
        b.n('bass', i * 4, rootOf(EB_ION, ch, 36), 0.7, 0.32, { cut: 300 });
        b.n('bass', i * 4 + 2.75, rootOf(EB_ION, ch, 36), 0.25, 0.22, { cut: 300 });
        b.n('bass', i * 4 + 3, rootOf(EB_ION, ch, 36) + 7, 0.9, 0.28, { cut: 300 });
        chordOn(b, 'bell', EB_ION, i * 4 + 2, ch, 1.5, 0.08, { ratio: 1 }, 60, 3);
      });
      groove(b, 0, 8, { snare: '3..23..2........', kick: '5.......' + '4.......' }, 0.34);
      sing(b, 'cold', 0, song(c, { K: EB_ION, prog, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'trio' }), EB_ION, 0, 0.28);
      return b.out({ key: EB_ION });
    },
    fanfare: () => {
      const b = new B(8, 4, 108);
      motif(b, 'lead', 0, UMB, BB_ION, 1, 0.38);
      b.fig('brass', 0, UMB, BB_ION, 0, 0.3, { cut: 3000 }, 0.9);
      b.fig('brass', 0, UMB, BB_ION, -1, 0.22, { cut: 1800 }, 0.9);
      for (const n of tones(BB_ION, [0, 'tri'], 50, 3)) b.n('brass', 4, n, 3, 0.26, { cut: 2600 });
      b.n('sub', 0, 34, 8, 0.36);
      b.hit(0, 'crash', 0.5, 1);
      b.hit(3.5, 'kick', 0.5);
      b.hit(3.75, 'kick', 0.5);
      b.hit(4, 'crash', 0.5, 1);
      b.hit(4, 'roll', 0.4, 3);
      return b.out({ still: true });
    },
  },
};

// ---------------------------------------------------------------- relay_tower

const RELAY_PROG: Ch[] = [[0, 'add9'], [6, 'add9'], [3, 'add9'], [0, 'add9']];
const STRICT = [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]] as const;

const relayTower: TrackDef = {
  kind: 'place', key: B_MIX, shadow: SHORT, region: 'face', bpm: 120, start: 'gears', vary: 0.25, wrong: 0.02, echo: 0.35, level: 1.19, wobble: 1.5,
  graph: { gears: [['gears', 2], ['beam', 1]], beam: [['gears', 1]] },
  secs: {
    gears: (c) => {
      const b = new B(32, 4, 120);
      for (let bar = 0; bar < 8; bar++) {
        const ch = RELAY_PROG[bar % 4];
        arp(b, B_MIX, bar * 4, ch, 4, 0.25, 0.17, [0, 1, 2, 3, 2, 1, 2, 3], { cut: 2200 });
        for (let k = 0; k < 4; k++) b.n('bass', bar * 4 + k, rootOf(B_MIX, ch, 35), 0.6, 0.34, { cut: 300 });
        b.n('glass', bar * 4, tones(B_MIX, ch, 71, 3)[bar % 3], 1.5, 0.12, { pan: bar % 2 ? 0.5 : -0.5 });
      }
      groove(b, 0, 8, { kick: '9.......9.......', clank: '....5.......5...', tick: '3232323232323232' }, 0.4);
      const m = phrase(c.r, { K: B_MIX, chords: RELAY_PROG, bar: 4, dens: 1, lo: 0, hi: 8, cad: 'home' }, RELAY_PROG.map(() => STRICT));
      sing(b, 'cold', 0, m, B_MIX, 0, 0.28);
      sing(b, 'cold', 16, m, B_MIX, 0, 0.28);
      if (c.r.chance(0.4)) b.hit(8 + c.r.int(16), 'scan', 0.12, 4, { n: 71 });
      return b.out();
    },
    beam: (c) => {
      const b = new B(16, 4, 120);
      choir(b, B_MIX, 0, [0, 'add9'], 8, 0.16, 1);
      choir(b, B_MIX, 8, [6, 'add9'], 8, 0.16, 1);
      pad(b, B_MIX, 0, [0, 'add9'], 8, 0.16);
      pad(b, B_MIX, 8, [6, 'add9'], 8, 0.16);
      sub(b, B_MIX, 0, [0], 8, 0.26);
      sub(b, B_MIX, 8, [6], 8, 0.26);
      b.hit(0, 'scan', 0.16, 8, { n: 71 });
      // A mirror shows the phrase back a bar late.
      const m = phrase(c.r, { K: B_MIX, chords: [[0, 'add9'], [6, 'add9']], bar: 4, dens: 1, lo: 2, hi: 9, cad: 'open' });
      sing(b, 'cold', 0, m, B_MIX, 0, 0.26);
      for (const [t, len, d] of m) b.n('glass', t + 8, B_MIX(d) + 12, len, 0.14, { pan: 0.5 });
      groove(b, 0, 4, { tick: '3.2.3.2.3.2.3.2.' }, 0.3);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- glass

const GLASS_PROG: Ch[] = [[0, 'add9'], [1, 'add9'], [5, 'sev'], [1, 'add9'], [2, 'sev'], [5, 'sev'], [1, 'add9'], [0, 'add9']];

/** Reversed attacks: a chord that swells for `len` beats and stops exactly where the next chord begins. */
function swellInto(b: B, K: Key, at: number, ch: Ch, len: number, g: number): void {
  if (at - len < 0) return;
  for (const n of tones(K, ch, 64, 3)) b.n('rev', at - len, n, len, g);
}

/** The Glass shows each long melody note before it plays: a reversed swell an octave up. */
function preSwell(b: B, K: Key, m: Mel, oct: number, g: number): void {
  for (const [t, len, d] of m) if (len >= 1 && t >= 0.75) b.n('rev', t - 0.75, K(d) + 12 * (oct + 1), 0.75, g);
}

const glass: TrackDef = {
  kind: 'place', key: A_LYD, shadow: SHORT, region: 'glass', bpm: 72, start: 'dune', vary: 0.4, wrong: 0.04, echo: 0.7, verb: 1.2, level: 1.47,
  graph: { dune: [['dune', 2], ['mirage', 1], ['well', 0.7]], mirage: [['dune', 1]], well: [['dune', 1]] },
  secs: {
    dune: (c) => {
      const b = new B(32, 4, 72);
      GLASS_PROG.forEach((ch, i) => {
        pad(b, A_LYD, i * 4, ch, 4, 0.14);
        sub(b, A_LYD, i * 4, ch, 4, 0.24);
        swellInto(b, A_LYD, (i + 1) * 4, GLASS_PROG[(i + 1) % 8], 2, 0.12);
        if (c.r.chance(0.5)) b.n('glass', i * 4 + 2, tones(A_LYD, ch, 76, 3)[c.r.int(3)], 2, 0.12, { pan: c.r.range(-0.7, 0.7) });
      });
      choir(b, A_LYD, 0, [0, 'add9'], 16, 0.12, 1);
      choir(b, A_LYD, 16, [2, 'sev'], 16, 0.12, 1);
      const m = song(c, { K: A_LYD, prog: GLASS_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'glass' });
      sing(b, 'lead', 0, m, A_LYD, 1, 0.28, { cut: 1500 });
      preSwell(b, A_LYD, m, 1, 0.1);
      return b.out();
    },
    mirage: (c) => {
      // Scenes from long ago, played backward on swells that run in reverse, far off: Stile's square, or a caravan's
      // march like the one Solehold still plays.
      const b = new B(32, 4, 72);
      const stileScene = c.visit % 2 === 0;
      const prog: Ch[] = stileScene ? [[4], [1], [5, 'sev'], [0]] : [[0], [5, 'sev'], [0], [5, 'sev']];
      prog.forEach((ch, i) => { pad(b, A_LYD, i * 8, ch, 8, 0.12); sub(b, A_LYD, i * 8, ch, 8, 0.2); });
      b.hit(0, 'hiss', 0.12, 32, { a: 3 });
      if (stileScene) b.fig('rev', 0, retro(STILE), A_LYD, 1, 0.22, { m: 1 }, 1);
      else for (let k = 0; k < 4; k++) b.fig('rev', k * 8, retro(aug(UMB, 2)), A_LYD, 0, 0.2, { m: 1 }, 1);
      choir(b, A_LYD, 0, [0, 'add9'], 32, 0.08, 1);
      for (let k = 0; k < 3; k++) b.n('glass', c.r.int(30), A_LYD(c.r.pick([0, 2, 4])) + 24, 2, 0.08, { pan: c.r.range(-0.8, 0.8) });
      return b.out({ still: true });
    },
    well: (c) => {
      const b = new B(16, 4, 72);
      b.n('drone', 0, 45, 16, 0.34, { a: 2 });
      swellInto(b, A_LYD, 8, [5, 'sev'], 3, 0.14);
      swellInto(b, A_LYD, 16 - 0.01, [0, 'add9'], 3, 0.12);
      pad(b, A_LYD, 0, [0, 'add9'], 8, 0.12);
      pad(b, A_LYD, 8, [5, 'sev'], 8, 0.12);
      motif(b, 'glass', 2, NODUS_HEAD, A_LYD, 1, 0.18, { pan: -0.3 });
      ticks(b, c, 16, 4, 0.08);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- minim

const minim: TrackDef = {
  kind: 'scene', key: FS_AEO, shadow: SHORT, bpm: 70, start: 'pane', vary: 0.15, wrong: 0.02, echo: 0.6, verb: 1.1, level: 1.44,
  graph: { pane: [['reflect', 1], ['pane', 1]], reflect: [['pane', 1]] },
  secs: {
    pane: (c) => {
      // Five bars of five beats, read the same both ways: her line, bells, her line upside down, bells, her line.
      const b = new B(25, 5, 70);
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [5, 'add9'], [3, 'add9'], [0, 'add9']];
      prog.forEach((ch, i) => { pad(b, FS_AEO, i * 5, ch, 5, 0.16); sub(b, FS_AEO, i * 5, ch, 5, 0.24); });
      const line = c.chapter >= 5 ? MINIM_CRACKED : MINIM;
      motif(b, 'lead', 0, line, FS_AEO, 0, 0.32, { cut: 1600 });
      // The bells in the second bar are new each pass, and the fourth bar plays them back in reverse.
      const ns = tones(FS_AEO, [3, 'add9'], 71, 4);
      const bells: Array<[number, number]> = [];
      for (let t = 0; t < 4; t += c.r.pick([0.5, 1, 1])) bells.push([t, ns[c.r.int(ns.length)]]);
      for (const [t, n] of bells) b.n('glass', 5 + t, n, 1.5, 0.11, { pan: -0.4 });
      for (const [t, n] of bells) b.n('glass', 15 + (4 - t), n, 1.5, 0.11, { pan: 0.4 });
      b.fig('glass', 10, inv(MINIM, 4), FS_AEO, 1, 0.18, { m: 1 }, 0.95);
      motif(b, 'lead', 20, line, FS_AEO, 0, 0.32, { cut: 1600 });
      return b.out();
    },
    reflect: (c) => {
      const b = new B(20, 5, 70);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [5, 'add9'], [0, 'add9']];
      prog.forEach((ch, i) => { pad(b, FS_AEO, i * 5, ch, 5, 0.14); choir(b, FS_AEO, i * 5, ch, 5, 0.1, 0.6); sub(b, FS_AEO, i * 5, ch, 5, 0.22); });
      // Played backward the line is the same, but on reversed swells it sounds turned around anyway.
      b.fig('rev', 0, MINIM, FS_AEO, 1, 0.18, { m: 1 }, 1);
      motif(b, 'lead', 5, c.chapter >= 5 ? MINIM_CRACKED : MINIM, FS_AEO, 0, 0.3, { cut: 1600 });
      b.fig('rev', 10, MINIM, FS_AEO, 1, 0.16, { m: 1 }, 1);
      motif(b, 'lead', 15, aug(MINIM.slice(0, 3), 1), FS_AEO, 0, 0.28, { cut: 1600 });
      for (let k = 0; k < 3; k++) b.n('glass', c.r.int(19), FS_AEO(c.r.pick([0, 2, 4, 6])) + 12, 1.5, 0.1, { pan: c.r.range(-0.7, 0.7) });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- glass_quarry

const glassQuarry: TrackDef = {
  kind: 'place', key: FS_PHR, shadow: SHORT, region: 'glass', bpm: 50, start: 'rows', vary: 0.2, wrong: 0.02, echo: 0.6, verb: 1.3, level: 0.88,
  graph: { rows: [['rows', 2], ['still', 1]], still: [['rows', 1]] },
  secs: {
    rows: (c) => {
      const b = new B(32, 4, 50);
      b.n('drone', 0, 42, 32, 0.38, { a: 3 });
      choir(b, FS_PHR, 0, [0], 16, 0.16, 0);
      choir(b, FS_PHR, 16, [5], 16, 0.16, 0);
      b.n('choir', 4, FS_PHR(1), 12, 0.08, { odd: 1 });
      sub(b, FS_PHR, 0, [0], 32, 0.22);
      // The Silvered stand in rows: one cold note repeated at an even step, walking across from left to right.
      const n = FS_PHR(4) + 12;
      for (let k = 0; k < 16; k++) b.n('glass', k * 2, n, 1.5, 0.1, { pan: -0.8 + (k % 8) * 0.23 });
      const m = phrase(c.r, { K: FS_PHR, chords: [[0], [0], [5], [5]], bar: 4, dens: 0, lo: 1, hi: 7, cad: 'none' }).slice(0, 3);
      for (const [t, len, d] of m) b.n('cold', t * 2, FS_PHR(d), len * 1.8, 0.24, { m: 1 });
      if (c.r.chance(0.5)) b.n('rev', 20, FS_PHR(2) + 12, 4, 0.12);
      return b.out();
    },
    still: (c) => {
      const b = new B(16, 4, 50);
      b.n('drone', 0, 42, 16, 0.4, { a: 2 });
      b.n('drone', 0, 43, 16, 0.14, { a: 5, odd: 1, x: 1 });
      b.hit(0, 'hiss', 0.12, 16, { a: 3 });
      b.n('glass', 4 + c.r.int(6), FS_PHR(c.r.pick([4, 6])) + 12, 3, 0.14, { pan: c.r.range(-0.5, 0.5) });
      b.n('cold', 8, FS_PHR(4), 6, 0.2, { m: 1 });
      return b.out();
    },
  },
};

export const FACE_TRACKS: Record<string, TrackDef> = {
  bright, solehold, relay_tower: relayTower, glass, minim, glass_quarry: glassQuarry,
};

