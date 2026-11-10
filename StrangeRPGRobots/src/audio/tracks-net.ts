// Tracks of the net: the Shallows inside the Pale, the Undertow beyond it, and the Pale's heart.
// The net is a sea, so it reflects. The Undertow is deep water and reflects a whole beat behind. The heart is frost.
import { B, MODE, key, type TrackDef } from './score-core';
import { arp, chordOn, choir, groove, pad, phrase, pulse, sing, song, sub, ticks, tones, type Ch } from './parts';
import { MARIT, MARIT_HEAD, PORT, PORT_HEAD } from './motifs';
import { board, breathe, lap, marit, port } from './weave';

const FS_DOR = key(66, MODE.dor);
const E_AEO = key(64, MODE.aeo);
const D_PHR = key(62, MODE.phr);

// ---------------------------------------------------------------- net (the Shallows, the Desk's net, the Pale)

const NET_PROG: Ch[] = [[0, 'add9'], [2, 'sev'], [5, 'add9'], [3, 'sus2'], [0, 'add9'], [6, 'sev'], [3, 'add9'], [4, 'sus4']];
const NET_KIT = { kick: '7.......7.......', tick: '..3..3.3..3..3.3', hat: '....4.......4...' };

/** Packets: sixteenth arpeggios that climb as they cross a bar, a pulse bass, and a glassy pad. */
function netBand(b: B, prog: readonly Ch[], g = 1): void {
  prog.forEach((ch, i) => {
    arp(b, FS_DOR, i * 4, ch, 4, 0.25, 0.11 * g, [0, 2, 1, 3, 2, 4, 3, 5], { cut: 3200 }, 'arp', 62);
    pulse(b, FS_DOR, i * 4, ch, 4, 0.24 * g, 0.5, { cut: 420 });
    pad(b, FS_DOR, i * 4, ch, 4, 0.1 * g, { cut: 1600, a: 0.6 }, 57);
  });
}

const net: TrackDef = {
  kind: 'place', key: FS_DOR, reflect: 0.5, region: 'brim', bpm: 112, start: 'grid', vary: 0.3, wrong: 0.04, echo: 0.5, level: 1.05,
  mix: { wet: 0.7 },
  graph: { grid: [['packets', 2], ['grid', 1], ['frost', 1]], packets: [['grid', 2], ['frost', 1]], frost: [['grid', 1], ['packets', 1]] },
  secs: {
    grid: (c) => {
      const b = new B(32, 4, 112);
      netBand(b, NET_PROG);
      groove(b, 0, 8, NET_KIT, 0.34);
      sing(b, 'cold', 0, song(c, { K: FS_DOR, prog: NET_PROG, bar: 4, dens: 1, lo: 1, hi: 9, slot: 'net' }), FS_DOR, 0, 0.27);
      ticks(b, c, 32, 6, 0.05, {}, 'click');
      return b.out();
    },
    packets: (c) => {
      // The port runs the grid on its own legs: its figure at double speed on blips, answered by glitches.
      const b = new B(32, 4, 112);
      netBand(b, NET_PROG, 0.85);
      groove(b, 0, 8, { ...NET_KIT, shaker: '.2.2.2.2.2.2.2.2' }, 0.34);
      for (let k = 0; k < 4; k++) {
        b.fig('blip', k * 8 + 1, PORT.map(([d, l]) => [d, l * 0.5] as [number | null, number]), FS_DOR, 1, 0.13, { pan: k % 2 ? 0.4 : -0.4 }, 0.8);
        b.hit(k * 8 + 4 + c.r.int(3), 'glitch', 0.12, 0.5, { pan: c.r.range(-0.7, 0.7) });
      }
      port(b, 'cold', 17, FS_DOR, 0, 0.24, {});
      port(b, 'cold', 25, FS_DOR, 0, 0.2, { pan: 0.2 });
      return b.out();
    },
    frost: (c) => {
      // Near the Pale: the arpeggios stop, a flat square holds, and the Board's four notes come cold out of the white.
      const b = new B(16, 4, 112);
      b.n('drone', 0, 42, 16, 0.26, { a: 2 });
      pad(b, FS_DOR, 0, [0, 'sus2'], 8, 0.14, { cut: 900 }, 50);
      pad(b, FS_DOR, 8, [6, 'sus2'], 8, 0.14, { cut: 900 }, 50);
      sub(b, FS_DOR, 0, [0], 16, 0.24);
      b.n('sq', 0, FS_DOR(4) + 12, 7.5, 0.06, { cut: 1200, nor: 1 });
      b.n('sq', 8, FS_DOR(3) + 12, 7.5, 0.06, { cut: 1200, nor: 1 });
      board(b, 'glass', 3, FS_DOR, 1, 0.12, { pan: 0.3 });
      board(b, 'glass', 11, FS_DOR, 1, 0.1, { pan: -0.3 });
      groove(b, 0, 4, { tick: '3...3...3...3...' }, 0.22);
      if (c.r.chance(0.7)) port(b, 'glass', 6, FS_DOR, 1, 0.1, { pan: -0.5 }, PORT_HEAD);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- undertow (beyond the Pale)

const DROWN_PROG: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'sev'], [4, 'sus4'], [0, 'add9'], [2, 'add9'], [5, 'sev'], [4, 'sus4']];

const undertow: TrackDef = {
  kind: 'place', key: E_AEO, reflect: 1, region: 'flood', bpm: 66, start: 'drift', vary: 0.35, wrong: 0.06, echo: 0.6, verb: 1.3, level: 1.2,
  mix: { wet: 1 },
  graph: { drift: [['hall', 2], ['deep', 1], ['drift', 0.5]], hall: [['drift', 2], ['deep', 1]], deep: [['drift', 1], ['hall', 1]] },
  secs: {
    drift: (c) => {
      // The drowned: a choir far down, water over the cables, and the start of a lullaby someone used to sing.
      const b = new B(32, 4, 66);
      DROWN_PROG.forEach((ch, i) => {
        choir(b, E_AEO, i * 4, ch, 4, 0.1, 1, { a: 1.5, cut: 1400 });
        sub(b, E_AEO, i * 4, ch, 4, 0.22);
        for (const n of tones(E_AEO, ch, 64, 3)) b.n('rev', i * 4 + 2, n, 2, 0.05);
      });
      lap(b, c, 32, 6, 0.2);
      marit(b, 'glass', 6 + c.r.int(4), E_AEO, 1, 0.14, { pan: 0.4 }, MARIT_HEAD);
      if (c.r.chance(0.6)) port(b, 'glass', 22, E_AEO, 1, 0.1, { pan: -0.4 }, PORT_HEAD);
      return b.out();
    },
    hall: (c) => {
      // The Ferry Hall, in three: the lullaby whole on a music box, with the old ferry bell between verses.
      const b = new B(24, 3, 66);
      const prog: Ch[] = [[0, 'add9'], [3, 'sev'], [5, 'add9'], [4, 'sus4'], [0, 'add9'], [5, 'add9'], [3, 'sev'], [4, 'tri']];
      prog.forEach((ch, i) => {
        b.n('bass', i * 3, E_AEO(ch[0]) - 24, 1.5, 0.22, { cut: 600 });
        chordOn(b, 'pluck', E_AEO, i * 3 + 1, ch, 0.5, 0.08, {}, 57, 3);
        chordOn(b, 'pluck', E_AEO, i * 3 + 2, ch, 0.5, 0.07, {}, 57, 3);
        pad(b, E_AEO, i * 3, ch, 3, 0.1, { cut: 1200 }, 52);
      });
      marit(b, 'lead', 1, E_AEO, 0, 0.22, {}, MARIT);
      b.n('bell', 0, E_AEO(0) + 12, 3, 0.07, { ratio: 1.41 });
      b.n('bell', 12, E_AEO(4) + 12, 3, 0.06, { ratio: 1.41 });
      lap(b, c, 24, 8, 0.14);
      return b.out();
    },
    deep: (c) => {
      // Under everything: a drone, a breath that is not anyone's, and the port's figure answered from below.
      const b = new B(16, 4, 66);
      b.n('drone', 0, 40, 16, 0.32, { a: 3 });
      pad(b, E_AEO, 0, [0, 'sus2'], 16, 0.12, { cut: 700 }, 45);
      breathe(b, 16, 0.18);
      port(b, 'cold', 2, E_AEO, 0, 0.2, {});
      const m = phrase(c.r, { K: E_AEO, chords: [[0, 'add9'], [5, 'add9'], [3, 'sev'], [4, 'sus4']], bar: 4, dens: 0, lo: -3, hi: 4, cad: 'open' });
      sing(b, 'wet', 8, m, E_AEO, -1, 0.14, { nor: 1 });
      b.hit(c.r.int(12), 'stomp', 0.12, 1, { pan: c.r.range(-0.3, 0.3) });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- quiet (the Pale's heart)

const quiet: TrackDef = {
  kind: 'scene', key: D_PHR, reflect: 0, bpm: 72, start: 'still', vary: 0.25, wrong: 0.08, echo: 0.3, verb: 1.4, level: 1.25,
  graph: { still: [['cut', 2], ['still', 1]], cut: [['still', 1], ['white', 1]], white: [['still', 1]] },
  secs: {
    still: (c) => {
      // Stillness: one held glass note, a sub, and a tick that slows down across the section.
      const b = new B(16, 4, 72);
      b.n('glass', 0, D_PHR(0) + 24, 15, 0.06, { nor: 1 });
      sub(b, D_PHR, 0, [0], 16, 0.3);
      pad(b, D_PHR, 0, [0, 'sus2'], 16, 0.1, { cut: 500 }, 48);
      let t = 0, gap = 0.5;
      while (t < 16) { b.hit(t, 'tick', 0.2, 0.1); t += gap; gap = Math.min(1.1, gap * 1.18); }
      breathe(b, 16, 0.08);
      if (c.r.chance(0.5)) b.hit(6 + c.r.int(6), 'hum', 0.1, 4);
      return b.out();
    },
    cut: (c) => {
      // The port's figure tries to rise and the frost stops it a note short, each time a note earlier.
      const b = new B(16, 4, 72);
      sub(b, D_PHR, 0, [1], 16, 0.28);
      pad(b, D_PHR, 0, [1, 'sus4'], 16, 0.1, { cut: 600 }, 48);
      for (let k = 0; k < 3; k++) {
        const fig = PORT.slice(0, 4 - k);
        b.fig('cold', k * 5 + 1, fig, D_PHR, 0, 0.2 - k * 0.04, { pan: k % 2 ? 0.3 : -0.3 }, 0.9);
        b.hit(k * 5 + 1 + fig.length * 0.5 + 0.1, 'swell', 0.08, 1.5);
      }
      ticks(b, c, 16, 3, 0.05, {}, 'click');
      return b.out();
    },
    white: (c) => {
      // White out: a wide frozen chord on the choir with no movement at all, then nothing.
      const b = new B(16, 4, 72);
      choir(b, D_PHR, 0, [0, 'sus2'], 12, 0.14, 0, { a: 2, cut: 1800 });
      b.n('drone', 0, 38, 16, 0.3, { a: 1 });
      sub(b, D_PHR, 0, [0], 16, 0.24);
      b.hit(0, 'hiss', 0.1, 16, { a: 3 });
      if (c.r.chance(0.6)) b.n('rev', 11, D_PHR(4) + 12, 3, 0.06);
      return b.out();
    },
  },
};

export const NET_TRACKS: Record<string, TrackDef> = { net, undertow, quiet };
