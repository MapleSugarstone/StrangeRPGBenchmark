// Tracks of the crossing and the Back: dusk, tik, burrow, back_road, and lampeater_den. No sunlight reaches the Back,
// so nothing casts a pre-note there unless a lamp is lit, and the places have only bass and percussion until one is.
import { B, MODE, key, type Ctx, type Key, type TrackDef } from './score-core';
import { arp, fifthOf, groove, motif, pad, pulse, rootOf, sing, song, sub, ticks, type Ch, type Mel } from './parts';
import { LOT, LOT_EARLY, TIK } from './motifs';

const D_DOR = key(62, MODE.dor);
const CS_AEO = key(61, MODE.aeo);
const F_DOR = key(65, MODE.dor);
const C_AEO = key(60, MODE.aeo);
const C_PHR = key(60, MODE.phr);

const LAMP = 0.375;

/** The lamp layer: warm chords and the tune lifted out of the dark, heard only while a light is lit. */
function lampLayer(b: B, K: Key, prog: readonly Ch[], bar: number, m: Mel | null, oct: number): void {
  prog.forEach((ch, i) => pad(b, K, i * bar, ch, bar, 0.2, { when: 'lamp', a: 0.3 }));
  if (m) sing(b, 'cold', 0, m, K, oct, 0.28, { when: 'lamp' });
}

// ---------------------------------------------------------------- dusk

const DUSK_PROG: Ch[] = [[0, 'add9'], [3, 'add9'], [0, 'add9'], [6, 'add9'], [2, 'add9'], [3, 'add9'], [4, 'sev'], [0, 'add9']];

const duskTune = (c: Ctx): Mel => song(c, { K: D_DOR, prog: DUSK_PROG, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'dusk' });

const dusk: TrackDef = {
  kind: 'place', key: D_DOR, shadow: 0.5, litShadow: LAMP, region: 'back', bpm: 60, start: 'sunset', vary: 0.3, wrong: 0.03, echo: 0.6, verb: 1.1, level: 1.06,
  // The sun sinks behind the party: the same tune stretches longer each time, then the light ends.
  graph: { sunset: [['long', 1]], long: [['longest', 1]], longest: [['dark', 1]], dark: [['dark', 1]] },
  secs: {
    sunset: (c) => {
      const b = new B(32, 4, 60);
      DUSK_PROG.forEach((ch, i) => {
        pad(b, D_DOR, i * 4, ch, 4, 0.22);
        sub(b, D_DOR, i * 4, ch, 4, 0.32);
        arp(b, D_DOR, i * 4, ch, 4, 0.5, 0.15, [0, 1, 2, 3, 2, 1]);
      });
      groove(b, 0, 8, { taiko: '6.......4.......' }, 0.4);
      sing(b, 'lead', 0, duskTune(c), D_DOR, 0, 0.34);
      return b.out();
    },
    long: (c) => {
      const b = new B(32, 4, 60);
      for (let i = 0; i < 4; i++) { pad(b, D_DOR, i * 8, DUSK_PROG[i], 8, 0.2); sub(b, D_DOR, i * 8, DUSK_PROG[i], 8, 0.3); }
      b.n('drone', 0, 38, 32, 0.3, { a: 2 });
      const m = duskTune(c).filter((x) => x[0] < 16).map(([t, len, d]) => [t * 2, len * 2, d] as [number, number, number]);
      sing(b, 'lead', 0, m, D_DOR, 0, 0.32, {}, 0.97);
      return b.out({ shadow: 1 });
    },
    longest: (c) => {
      const b = new B(32, 4, 60);
      b.n('drone', 0, 38, 32, 0.34, { a: 1 });
      pad(b, D_DOR, 0, DUSK_PROG[0], 12, 0.18);
      pad(b, D_DOR, 12, DUSK_PROG[1], 6, 0.12);
      sub(b, D_DOR, 0, DUSK_PROG[0], 32, 0.3);
      const m = duskTune(c).filter((x) => x[0] < 8).map(([t, len, d]) => [t * 3, len * 3, d] as [number, number, number]);
      sing(b, 'lead', 0, m, D_DOR, 0, 0.3, {}, 0.98);
      return b.out({ shadow: 1.5 });
    },
    dark: (c) => {
      // The light ends. Only the bass and the drums go on, until someone lights a lamp.
      const b = new B(16, 4, 60);
      // Alternate halves of the dusk tune's chords, so a lamp lit here brings back the matching half of the tune.
      const second = c.visit % 2 === 1;
      const prog = second ? DUSK_PROG.slice(4) : DUSK_PROG.slice(0, 4);
      prog.forEach((ch, i) => {
        const r = rootOf(D_DOR, ch, 36);
        b.n('bass', i * 4, r, 1.4, 0.38, { cut: 260 });
        b.n('bass', i * 4 + c.r.pick([1.5, 2, 2.5]), c.r.chance(0.3) ? fifthOf(D_DOR, ch, 36) : r, 0.4, 0.26, { cut: 260 });
        if (c.r.chance(0.6)) b.n('bass', i * 4 + 3.5, r + 12, 0.4, 0.22, { cut: 260 });
        sub(b, D_DOR, i * 4, ch, 4, 0.26);
      });
      groove(b, 0, 4, { taiko: c.r.pick(['7.....4...5.....', '7.......4...4...', '7...4.....5.....']) }, 0.4);
      ticks(b, c, 16, 5, 0.2, {}, 'click');
      b.hit(0, 'hiss', 0.1, 16, { a: 2 });
      const tune = duskTune(c);
      const half: Mel = second ? tune.filter((x) => x[0] >= 16).map(([t, len, d]) => [t - 16, len, d]) : tune.filter((x) => x[0] < 16);
      lampLayer(b, D_DOR, prog, 4, half, 0);
      return b.out({ shadow: 0 });
    },
  },
};

// ---------------------------------------------------------------- tik

const TIK_PROG: Ch[] = [[0, 'add9'], [5, 'add9'], [6, 'add9'], [5, 'add9']];

function listenBand(b: B, c: Ctx, moving: boolean): void {
  const prog: Ch[] = moving ? TIK_PROG : [[0], [0], [0], [0]];
  prog.forEach((ch, i) => {
    b.n('bass', i * 4, rootOf(CS_AEO, ch, 37), 1.5, 0.34, { cut: 250 });
    b.n('bass', i * 4 + c.r.pick([2, 2.5, 3]), rootOf(CS_AEO, ch, 37), 1, 0.24, { cut: 250 });
    sub(b, CS_AEO, i * 4, ch, 4, 0.24);
  });
  // Tik listens: clicks in a pattern that is almost regular, the way something hears its way along a wall.
  const pat = c.r.pick(['9..5.9....5.9...', '9...5..9.5...9..', '9.5...9..5..9...', '9..5..9..5..9.5.']);
  groove(b, 0, 4, { click: pat, taiko: '6...............' }, 0.36);
  if (moving) groove(b, 0, 4, { shaker: '..2...2...2...2.' }, 0.3);
  b.hit(0, 'hiss', 0.08, 16, { a: 2 });
  if (c.r.chance(0.5)) b.hit(c.r.int(16), 'click', 0.3, 0.05, { pan: c.r.range(-0.8, 0.8) });
}

const tik: TrackDef = {
  kind: 'scene', key: CS_AEO, shadow: 0, bpm: 84, start: 'listen', vary: 0.3, wrong: 0.03, echo: 0.55, level: 0.8,
  graph: { listen: [['listen2', 1]], listen2: [['three', 2], ['listen', 1]], three: [['listen2', 1], ['three', 0.5]] },
  secs: {
    listen: (c) => {
      const b = new B(16, 4, 84);
      listenBand(b, c, false);
      return b.out();
    },
    listen2: (c) => {
      const b = new B(16, 4, 84);
      listenBand(b, c, true);
      return b.out();
    },
    three: (c) => {
      const b = new B(16, 4, 84);
      listenBand(b, c, true);
      pad(b, CS_AEO, 4, TIK_PROG[1], 4, 0.14);
      pad(b, CS_AEO, 8, TIK_PROG[2], 4, 0.14);
      // Three notes that step toward home and stop a step short. Tik has no lead, so they cast no pre-notes.
      motif(b, 'lead', 6, TIK, CS_AEO, 0, 0.34, { nos: 1 });
      // Once Lot has come back, its copy of the same notes lands a sixteenth ahead of them, as their lead.
      if (c.chapter >= 6 && c.r.chance(0.5)) b.fig('cold', 6 + LOT_EARLY, LOT.slice(0, 3), CS_AEO, 0, 0.14, { nos: 1 }, 0.9);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- burrow

const BURROW_PROG: Ch[] = [[0, 'sev'], [3, 'add9'], [0, 'sev'], [6, 'add9'], [2, 'add9'], [3, 'add9'], [4, 'sev'], [0, 'sev']];

const burrow: TrackDef = {
  kind: 'place', key: F_DOR, shadow: 0, litShadow: LAMP, region: 'back', bassOnly: true, bpm: 92, start: 'home', vary: 0.4, wrong: 0.03, echo: 0.4, level: 0.88,
  graph: { home: [['home', 2], ['hearth', 1]], hearth: [['home', 1]] },
  secs: {
    home: (c) => {
      const b = new B(32, 4, 92);
      // The tune lives in the bass, round and close. Under a lamp it rises two octaves onto the lead.
      const m = song(c, { K: F_DOR, prog: BURROW_PROG, bar: 4, dens: 2, lo: -7, hi: 0, slot: 'burrow' });
      sing(b, 'bass', 0, m, F_DOR, -1, 0.4, { cut: 420, m: undefined });
      BURROW_PROG.forEach((ch, i) => sub(b, F_DOR, i * 4, ch, 4, 0.26, {}, 29));
      b.n('drone', 0, 29, 32, 0.22, { a: 3 });
      groove(b, 0, 8, { taiko: '7..4..5.7...4...', shaker: '2.2.2.2.2.2.2.2.', wood: '....4.......4..3', clap: '............3...' }, 0.38);
      lampLayer(b, F_DOR, BURROW_PROG, 4, m.map(([t, len, d]) => [t, len, d + 7] as [number, number, number]), 0);
      return b.out();
    },
    hearth: (c) => {
      const b = new B(16, 4, 92);
      const riffs = [[0, 0, 2, 4, 3, 2, 0, -1], [0, 2, 0, 4, 3, 1, 0, -3], [0, -1, 0, 2, 4, 2, 1, 0]];
      const riff = riffs[c.visit % riffs.length];
      for (let bar = 0; bar < 4; bar++) riff.forEach((d, k) => b.n('bass', bar * 4 + k * 0.5, F_DOR(d) - 24, 0.4, k % 2 ? 0.26 : 0.34, { cut: 380 }));
      b.n('sub', 0, 29, 16, 0.26);
      groove(b, 0, 4, { taiko: c.r.pick(['6.......4.......', '6.....4...4.....']) }, 0.34);
      ticks(b, c, 16, 6, 0.2, {}, 'click');
      lampLayer(b, F_DOR, [[0, 'sev'], [3, 'add9'], [6, 'add9'], [0, 'sev']], 4, null, 0);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- back_road

const ROAD_DARK: Ch[] = [[0, 'sev'], [5, 'add9'], [0, 'sev'], [6, 'add9'], [3, 'sev'], [4, 'sev'], [5, 'add9'], [0, 'sev']];

const backRoad: TrackDef = {
  kind: 'place', key: C_AEO, shadow: 0, litShadow: LAMP, region: 'back', bassOnly: true, bpm: 84, start: 'walk', vary: 0.4, wrong: 0.04, echo: 0.45, level: 1,
  graph: { walk: [['walk', 2], ['still', 1]], still: [['walk', 1]] },
  secs: {
    walk: (c) => {
      const b = new B(32, 4, 84);
      ROAD_DARK.forEach((ch, i) => { pulse(b, C_AEO, i * 4, ch, 4, 0.34, 0.5, { cut: 300 }); sub(b, C_AEO, i * 4, ch, 4, 0.22); });
      groove(b, 0, 8, { kick: '9.....5.9.......', click: '..3...3...3..3..', taiko: '............5...' }, 0.4);
      b.hit(0, 'hiss', 0.1, 32, { a: 3 });
      lampLayer(b, C_AEO, ROAD_DARK, 4, song(c, { K: C_AEO, prog: ROAD_DARK, bar: 4, dens: 1, lo: 0, hi: 8, slot: 'back_road' }), 0);
      return b.out();
    },
    still: (c) => {
      const b = new B(16, 4, 84);
      b.n('sub', 0, 36, 16, 0.32, { a: 1 });
      b.hit(c.r.pick([2, 6, 10]), 'boom', 0.3, 1);
      ticks(b, c, 16, 8, 0.2, {}, 'click');
      lampLayer(b, C_AEO, [[0, 'sev'], [5, 'add9'], [6, 'add9'], [0, 'sev']], 4, null, 0);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- lampeater_den

const lampeaterDen: TrackDef = {
  kind: 'place', key: C_PHR, shadow: 0, litShadow: LAMP, region: 'back', bpm: 66, start: 'hunger', vary: 0.3, wrong: 0.05, echo: 0.5, verb: 1.2, level: 0.86,
  graph: { hunger: [['hunger', 2], ['gulp', 1]], gulp: [['hunger', 1]] },
  secs: {
    hunger: (c) => {
      const b = new B(32, 4, 66);
      b.n('sub', 0, 24, 32, 0.36, { a: 2 });
      // Growls: the half step above home sliding down into it, over and over.
      for (let bar = 0; bar < 8; bar++) {
        const growl = c.r.chance(0.5);
        b.n('bass', bar * 4, growl ? C_PHR(1) - 24 : C_PHR(0) - 24, 3.5, 0.36, { cut: 240, bend: growl ? -1 : 0 });
      }
      for (let k = 0; k < 4; k++) b.hit(k * 8 + c.r.int(4), 'hiss', 0.14, 4, { a: 1.5 });
      groove(b, 0, 8, { click: '..2.......2.....' }, 0.3);
      // It eats a light: a bright note cut off short, then the swallow.
      const at = 8 + c.r.int(4) * 4;
      b.n('glass', at, C_PHR(4) + 12, 0.15, 0.22, { pan: c.r.range(-0.5, 0.5) });
      b.hit(at + 0.25, 'boom', 0.34, 1);
      b.n('bass', at + 0.25, C_PHR(0) - 12, 1.5, 0.3, { cut: 300, bend: -5, x: 1 });
      pad(b, C_PHR, 0, [0], 16, 0.16, { when: 'lamp', a: 1 });
      pad(b, C_PHR, 16, [5], 16, 0.16, { when: 'lamp', a: 1 });
      return b.out();
    },
    gulp: (c) => {
      const b = new B(16, 4, 66);
      b.n('sub', 0, 24, 16, 0.36, { a: 0.5 });
      b.hit(1, 'boom', 0.4, 1.5);
      b.n('bass', 1, 36, 3, 0.32, { cut: 260, bend: -7, x: 1 });
      ticks(b, c, 16, 6, 0.16, {}, 'click');
      b.n('drone', 4, 37, 12, 0.16, { a: 3, odd: 1 });
      pad(b, C_PHR, 0, [0], 16, 0.14, { when: 'lamp', a: 1 });
      return b.out();
    },
  },
};

export const BACK_TRACKS: Record<string, TrackDef> = {
  dusk, tik, burrow, back_road: backRoad, lampeater_den: lampeaterDen,
};
