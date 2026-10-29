// Tracks of Overhead, straight under the sun: overhead, overhead_sad, and first_mirror. Nothing has a lead at the
// Zenith, so these tracks cast no pre-notes unless a lamp is lit, and they have no bass at all.
import { B, MODE, key, type Ctx, type Fig, type TrackDef } from './score-core';
import { arp, chordOn, choir, groove, motif, pad, phrase, sing, song, ticks, tones, type Ch, type Mel } from './parts';
import { PARH } from './motifs';

const G_ION = key(67, MODE.ion);
const G_AEO = key(67, MODE.aeo);
const B_LYD = key(71, MODE.lyd);

/** A lamp has lowness 2, so under one the pre-notes fall a dotted sixteenth early. */
const LAMP = 0.375;

// ---------------------------------------------------------------- overhead

const OVER_PROG: Ch[] = [[0, 'add9'], [5, 'sev'], [3, 'add9'], [4, 'sus4'], [1, 'sev'], [4, 'sev'], [3, 'add9'], [0, 'add9']];

/** The festival band: high brass stabs, a bright arpeggio, and hand percussion. Nothing sits below G3. */
function festa(b: B, prog: readonly Ch[], g = 1): void {
  prog.forEach((ch, i) => {
    const t = i * 4;
    for (const off of [0.5, 1.5, 2.5, 3.5]) for (const n of tones(G_ION, ch, 62, 3)) b.n('brass', t + off, n, 0.3, 0.12 * g, { cut: 2600 });
    arp(b, G_ION, t, ch, 4, 0.25, 0.14 * g, [0, 1, 2, 3, 2, 3, 1, 2], { cut: 2400 }, 'arp', 67);
    pad(b, G_ION, t, ch, 4, 0.12 * g, {}, 60);
  });
  groove(b, 0, prog.length, { clap: '....8.......8...', shaker: '3232323232323232', hat: '4.4.4.4.4.4.4.4.', wood: '..5...5..5....5.' }, 0.4 * g);
}

const overhead: TrackDef = {
  kind: 'place', key: G_ION, shadow: 0, litShadow: LAMP, region: 'overhead', noBass: true, bpm: 126, start: 'festa', vary: 0.55, wrong: 0.06, echo: 0.4, level: 1.73,
  // Nobody makes promises here, so the next section is anyone's guess.
  graph: { festa: [['festa', 1], ['dice', 1], ['parade', 1]], dice: [['festa', 1], ['parade', 1], ['dice', 0.5]], parade: [['festa', 1], ['dice', 1]] },
  secs: {
    festa: (c) => {
      const b = new B(32, 4, 126);
      festa(b, OVER_PROG);
      let m = song(c, { K: G_ION, prog: OVER_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'overhead' });
      // Sometimes the tune breaks its promise to come home and runs off somewhere else.
      if (c.r.chance(0.35)) {
        m = m.filter((x) => x[0] < 24);
        for (const [t, len, d] of phrase(c.r, { K: G_ION, chords: [[1, 'sev'], [4, 'sev']], bar: 4, dens: 3, lo: 2, hi: 10, cad: 'open' })) m.push([t + 24, len, d]);
      }
      sing(b, 'cold', 0, m, G_ION, 0, 0.3);
      return b.out();
    },
    dice: (c) => {
      const b = new B(16, 4, 126);
      const prog: Ch[] = [[0, 'add9'], [3, 'add9'], [5, 'sev'], [4, 'sus4']];
      prog.forEach((ch, i) => pad(b, G_ION, i * 4, ch, 4, 0.14, {}, 60));
      // Dice rattle, and the tune comes back in pieces, shuffled.
      for (let k = 0; k < 10; k++) { const t = c.r.int(32) * 0.5; for (let j = 0; j < 4; j++) b.hit(t + j * 0.06, 'shaker', 0.3, 0.05, { pan: c.r.range(-0.6, 0.6) }); }
      groove(b, 0, 4, { wood: '7..5..7...5.7...', clap: '....6.......6...' }, 0.36);
      const m = song(c, { K: G_ION, prog: OVER_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'overhead' });
      const bits: Mel = [];
      for (let k = 0; k < 4; k++) {
        const from = c.r.int(6) * 4;
        for (const [t, len, d] of m) if (t >= from && t < from + 2) bits.push([k * 4 + (t - from), len, d]);
      }
      sing(b, 'cold', 0, bits, G_ION, 0, 0.28);
      for (let k = 0; k < 4; k++) b.n('glass', c.r.int(32) * 0.5, G_ION(c.r.pick([0, 2, 4, 7])) + 12, 0.8, 0.14, { pan: c.r.range(-0.7, 0.7) });
      return b.out();
    },
    parade: (c) => {
      const b = new B(32, 4, 126);
      festa(b, OVER_PROG, 0.9);
      const m = song(c, { K: G_ION, prog: OVER_PROG, bar: 4, dens: 2, lo: 0, hi: 9, slot: 'overhead' });
      // The brass takes the tune with a line a third below it, and the lead answers in the gaps.
      for (const [t, len, d] of m) if (t < 16) { b.n('brass', t, G_ION(d), len * 0.85, 0.24, { cut: 3000, m: 1 }); b.n('brass', t, G_ION(d - 2), len * 0.85, 0.16, { cut: 2400 }); }
      sing(b, 'cold', 16, m.filter((x) => x[0] >= 16).map(([t, len, d]) => [t - 16, len, d]), G_ION, 0, 0.3);
      for (let k = 0; k < 8; k++) b.n('blip', 16 + k * 2 + 1.5, G_ION(c.r.pick([4, 7, 9])) + 12, 0.25, 0.16, { pan: k % 2 ? 0.5 : -0.5 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- overhead_sad

const overheadSad: TrackDef = {
  kind: 'scene', key: G_AEO, shadow: 0, litShadow: LAMP, region: 'overhead', noBass: true, bpm: 60, start: 'alone', vary: 0.25, wrong: 0.02, echo: 0.65, verb: 1.2, level: 1.36,
  graph: { alone: [['alone', 1], ['empty', 1]], empty: [['alone', 1]] },
  secs: {
    alone: (c: Ctx) => {
      const b = new B(32, 4, 60);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'add9'], [4, 'sus4']];
      prog.forEach((ch, i) => pad(b, G_AEO, i * 8, ch, 8, 0.16, {}, 62));
      // Her held note bends with nothing under it, and where her dry aside used to come, nothing does.
      motif(b, 'lead', 3.5, PARH, G_AEO, 0, 0.36);
      b.n('glass', 11 + c.r.int(3), G_AEO(c.r.pick([4, 2, 7])) + 12, 2.5, 0.14, { pan: c.r.range(-0.5, 0.5) });
      const second: Fig = c.visit % 2 ? [[-2, 0.5], [2, 2.5, 0, 1], [1, 0.5], [0, 2.5]] : [[0, 0.5], [4, 2.5, 0, 1], [3, 0.5], [1, 2.5]];
      motif(b, 'lead', 19.5, second, G_AEO, 0, 0.34);
      if (c.r.chance(0.6)) b.n('glass', 27 + c.r.int(3), G_AEO(c.r.pick([2, 4])) + 12, 3, 0.12, { pan: c.r.range(-0.5, 0.5) });
      return b.out();
    },
    empty: (c) => {
      const b = new B(16, 4, 60);
      const second: Ch = c.visit % 2 ? [3, 'add9'] : [5, 'add9'];
      pad(b, G_AEO, 0, [0, 'add9'], 8, 0.14, {}, 62);
      pad(b, G_AEO, 8, second, 8, 0.14, {}, 62);
      choir(b, G_AEO, 0, [0, 'add9'], 16, 0.12, 0, {}, 62);
      for (let k = 0; k < 2; k++) b.n('glass', 2 + k * 7 + c.r.int(3), G_AEO(c.r.pick([0, 2, 4, 6])) + 12, 3, 0.12, { pan: c.r.range(-0.5, 0.5) });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- first_mirror

const MIRROR_PROG: Ch[] = [[0, 'add9'], [1, 'add9'], [5, 'sev'], [1, 'add9'], [2, 'sev'], [5, 'sev'], [4, 'sus4'], [0, 'add9']];

const firstMirror: TrackDef = {
  kind: 'place', key: B_LYD, shadow: 0, litShadow: LAMP, region: 'overhead', noBass: true, bpm: 92, start: 'blind', vary: 0.4, wrong: 0.05, echo: 0.6, verb: 1.2, level: 1.81,
  graph: { blind: [['blind', 2], ['focus', 1]], focus: [['blind', 1]] },
  secs: {
    blind: (c) => {
      const b = new B(32, 4, 92);
      MIRROR_PROG.forEach((ch, i) => {
        pad(b, B_LYD, i * 4, ch, 4, 0.12, {}, 62);
        arp(b, B_LYD, i * 4, ch, 4, 0.5, 0.12, [0, 2, 1, 3, 2, 1, 3, 2], { cut: 3000 }, 'blip', 78);
        if (i % 2) for (const n of tones(B_LYD, ch, 78, 3)) b.n('rev', i * 4 + 2, n, 2, 0.08);
      });
      groove(b, 0, 8, { hat: '4.3.4.3.4.3.4.3.', clap: '....6.......6...', tick: '..2...2...2...2.' }, 0.36);
      sing(b, 'cold', 0, song(c, { K: B_LYD, prog: MIRROR_PROG, bar: 4, dens: 1, lo: 0, hi: 9, slot: 'first_mirror' }), B_LYD, 0, 0.28);
      if (c.r.chance(0.6)) b.hit(8 + c.r.int(16), 'scan', 0.12, 4, { n: 83 });
      return b.out();
    },
    focus: (c) => {
      const b = new B(16, 4, 92);
      b.hit(0, 'swell', 0.2, 8);
      b.hit(8, 'scan', 0.14, 6, { n: 83 });
      choir(b, B_LYD, 0, [0, 'tri'], 16, 0.14, 1, {}, 66);
      chordOn(b, 'glass', B_LYD, 8, [0, 'add9'], 3, 0.12, {}, 83, 4);
      pad(b, B_LYD, 0, [1, 'add9'], 8, 0.12, {}, 66);
      pad(b, B_LYD, 8, [0, 'add9'], 8, 0.12, {}, 66);
      ticks(b, c, 16, 8, 0.1);
      return b.out();
    },
  },
};

export const OVERHEAD_TRACKS: Record<string, TrackDef> = { overhead, overhead_sad: overheadSad, first_mirror: firstMirror };
