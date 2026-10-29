// Battle tracks: battle, boss, boss_final, victory, and defeat. A battle takes its color from the region of the last
// place track: warm in the Long, thin and high on the Face, reversed in the Glass, bassless Overhead, and only bass
// and drums in the Back until a lamp is lit. Each chapter boss acts out its own mechanic in the score.
import { B, MODE, aug, fold, inv, key, shift, type Ctx, type Ev, type Fig, type Key, type Nz, type Region, type Section, type TrackDef, type Voice } from './score-core';
import { arp, brass, chordOn, choir, groove, motif, pad, pulse, rootOf, sub, ticks, tones, type Ch } from './parts';
import { ANTH, BIG, LOT, LOT_EARLY, MINIM, NODUS, NODUS_HEAD, PARH, RULE, TIK, UMB } from './motifs';

type X = Partial<Ev>;
type Kit = Partial<Record<Nz, string>>;

interface Color {
  K: Key;
  bpm: number;
  prog: readonly Ch[];
  progB: readonly Ch[];
  shadow: number;
  bass: 'pulse' | 'high' | 'none';
  kit: Kit;
  /** Drum parts that join above an intensity, as [level, pattern]. */
  more: ReadonlyArray<readonly [number, Kit]>;
  lead: Voice;
  leadOct: number;
  riff: Fig;
  counter: Fig;
  counterVoice: Voice;
  counterOct: number;
  /** The Back: every melodic part waits for a lamp. */
  unlit?: boolean;
  /** Scales every note, for a color that measures quieter than the rest. */
  gain?: number;
  tex?: (b: B, c: Ctx, K: Key, beats: number) => void;
}

const LAMP = 0.375;

const RIFF_LONG: Fig = [[0, 0.5], [0, 0.25], [0, 0.25], [2, 0.5], [3, 0.5], [4, 1], [3, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [6, 0.5], [5, 0.5], [4, 1], [2, 1]];
const RIFF_MARKET: Fig = [[0, 0.75], [2, 0.25], [4, 0.5], [6, 0.5], [5, 0.5], [4, 0.5], [2, 1], [3, 0.5], [2, 0.25], [3, 0.25], [4, 0.5], [6, 0.5], [4, 2]];
const RIFF_FACE: Fig = [[4, 0.5], [7, 0.5], [6, 0.5], [4, 0.5], [2, 1], [4, 1], [5, 0.5], [4, 0.5], [2, 0.5], [1, 0.5], [0, 2]];
const RIFF_GLASS: Fig = [[0, 1], [2, 0.5], [4, 0.5], [3, 1], [2, 1], [1, 0.5], [2, 0.5], [4, 1], [0, 2]];
const RIFF_OVER: Fig = [[4, 0.25], [4, 0.25], [5, 0.5], [7, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [4, 1], [6, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [3, 1], [1, 1]];
const RIFF_BACK: Fig = [[0, 0.5], [0, 0.5], [3, 1], [2, 0.5], [1, 0.5], [0, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 2]];
const RIFF_SQUARE: Fig = [[0, 1], [0, 1], [4, 1], [4, 1], [3, 1], [3, 1], [1, 1], [null, 1]];

const DRIVE: Kit = { kick: '9.....5.9.......', taiko: '7.......5.......' };
const DRIVE_MORE: ReadonlyArray<readonly [number, Kit]> = [[0.3, { hat: '3.3.3.3.3.3.3.3.' }], [0.55, { snare: '....7.......7...' }], [0.75, { kick: '......4.....4...' }]];

/** The heat of the Face: very quiet repeated notes high up. */
function shimmer(b: B, K: Key, beats: number, g: number, x: X = {}): void {
  const n = K(7) + 12;
  for (let t = 0; t < beats; t += 0.125) b.n('blip', t, n, 0.08, g * (0.5 + 0.5 * Math.sin(t * 1.7)), { pan: Math.sin(t) * 0.6, ...x });
}

export const COLORS: Record<Region, Color> = {
  long: {
    K: key(57, MODE.dor), bpm: 120, prog: [[0, 'add9'], [3], [6, 'add9'], [0, 'sus4']], progB: [[2, 'add9'], [3], [4, 'sev'], [0]], shadow: 0.5,
    bass: 'pulse', kit: DRIVE, more: DRIVE_MORE, lead: 'lead', leadOct: 0, riff: RIFF_LONG, counter: NODUS, counterVoice: 'cold', counterOct: 1,
    tex: (b) => groove(b, 0, 4, { tick: '2.2.2.2.2.2.2.2.' }, 0.3, { lay: 0.4 }),
  },
  market: {
    K: key(60, MODE.mix), bpm: 126, prog: [[0], [6], [3], [4, 'sus4']], progB: [[5, 'sev'], [3], [1, 'sev'], [4, 'sus4']], shadow: 0.5,
    bass: 'pulse', kit: { kick: '9.......8.......', clap: '....7.......7...' }, more: [[0.3, { hat: '4.3.4.3.4.3.4.3.' }], [0.6, { shaker: '2222222222222222' }]],
    lead: 'cold', leadOct: 0, riff: RIFF_MARKET, counter: LOT, counterVoice: 'cold', counterOct: 1,
    tex: (b, c, K) => {
      for (let bar = 0; bar < 4; bar++) for (const off of [1, 3]) for (const n of tones(K, c.r.pick([[0], [3]] as Ch[]), 55, 3)) b.n('brass', bar * 4 + off, n, 0.3, 0.12, { cut: 1000, lay: 0.2 });
    },
  },
  face: {
    K: key(64, MODE.mix), bpm: 132, prog: [[0], [6], [3], [0]], progB: [[5, 'sev'], [3], [6], [4, 'sus4']], shadow: 0.25,
    bass: 'high', kit: { kick: '7.......6.......', clap: '....6.......6...', hat: '4.3.4.3.4.3.4.3.' }, more: [[0.4, { tick: '2222222222222222' }]],
    lead: 'cold', leadOct: 1, riff: RIFF_FACE, counter: UMB, counterVoice: 'lead', counterOct: 1,
    tex: (b, c, K, beats) => { shimmer(b, K, beats, 0.05, { lay: 0.3 }); if (c.r.chance(0.4)) b.hit(c.r.int(beats), 'scan', 0.1, 3, { n: 76, lay: 0.5 }); },
  },
  glass: {
    K: key(61, MODE.aeo), bpm: 116, prog: [[0, 'add9'], [5, 'add9'], [6, 'add9'], [4, 'sev']], progB: [[3, 'sev'], [5, 'add9'], [2, 'add9'], [4, 'sev']], shadow: 0.25,
    bass: 'pulse', kit: { kick: '8.......7.......', snare: '....6.......6...' }, more: [[0.3, { hat: '3.3.3.3.3.3.3.3.' }]],
    lead: 'lead', leadOct: 0, riff: RIFF_GLASS, counter: MINIM, counterVoice: 'glass', counterOct: 1,
    tex: (b, c, K) => { for (let bar = 1; bar < 4; bar++) for (const n of tones(K, c.r.pick([[0, 'add9'], [5, 'add9']] as Ch[]), 64, 3)) b.n('rev', bar * 4 - 1, n, 1, 0.1, { lay: 0.2 }); },
  },
  overhead: {
    K: key(67, MODE.mix), bpm: 138, prog: [[0, 'add9'], [6, 'add9'], [3, 'add9'], [0, 'add9']], progB: [[5, 'sev'], [3, 'add9'], [1, 'sev'], [4, 'sus4']], shadow: 0,
    bass: 'none', gain: 1.5, kit: { clap: '....8.......8...', shaker: '3232323232323232', wood: '..5...5..5....5.' }, more: [[0.3, { hat: '4.4.4.4.4.4.4.4.' }], [0.6, { clap: '..........4.....' }]],
    lead: 'cold', leadOct: 0, riff: RIFF_OVER, counter: PARH, counterVoice: 'lead', counterOct: 0,
    tex: (b, c, K) => { for (let k = 0; k < 4; k++) b.n('blip', k * 4 + 3.5, K(c.r.pick([4, 7, 9])) + 12, 0.25, 0.14, { lay: 0.4 }); },
  },
  back: {
    K: key(66, MODE.aeo), bpm: 112, prog: [[0, 'add9'], [5, 'add9'], [6, 'add9'], [0, 'add9']], progB: [[3, 'sev'], [5, 'add9'], [4, 'sev'], [0, 'add9']], shadow: 0,
    bass: 'pulse', kit: { kick: '9.....6.9.......', taiko: '....7.......5...', click: '..3...3...3..3..' }, more: [[0.5, { taiko: '..........4.....' }]],
    lead: 'cold', leadOct: 0, riff: RIFF_BACK, counter: TIK, counterVoice: 'lead', counterOct: 0, unlit: true,
    tex: (b, c) => { if (c.r.chance(0.5)) b.hit(c.r.int(16), 'boom', 0.22, 1); },
  },
  lamp: {
    K: key(62, MODE.aeo), bpm: 120, prog: [[0], [5], [6], [4]], progB: [[3], [0], [5], [4]], shadow: 0.5,
    bass: 'pulse', kit: { kick: '9...9...9...9...', clank: '....6.......6...' }, more: [[0.3, { tick: '3.3.3.3.3.3.3.3.' }], [0.6, { snare: '..........5.....' }]],
    lead: 'sq', leadOct: 1, riff: RIFF_SQUARE, counter: ANTH, counterVoice: 'cold', counterOct: 0,
    tex: (b, c) => { b.hit(0, 'hum', 0.24, 16, { n: 38, a: 1 }); if (c.r.chance(0.5)) b.hit(8, 'scan', 0.12, 4, { n: 62 }); },
  },
};

/** Applies a color's gain to a finished section's notes. */
function lift(b: B, col: Color): void {
  if (col.gain) for (const e of b.ev) e.g = Math.min(1, e.g * col.gain);
}

/** Marks every melodic note of a Back battle so it sounds only under a lamp. */
function lit(col: Color, x: X = {}): X {
  return col.unlit ? { when: 'lamp', ...x } : x;
}

/** One section of the band: bass, chords that arrive with the danger, drums, the lamp layer, and a heartbeat at low HP. */
function band(b: B, c: Ctx, col: Color, prog: readonly Ch[], g = 1): void {
  const K = col.K;
  prog.forEach((ch, i) => {
    const t = i * 4;
    if (col.bass === 'pulse') { pulse(b, K, t, ch, 4, 0.46 * g, 0.5, { cut: 340 }); sub(b, K, t, ch, 4, 0.26 * g); }
    else if (col.bass === 'high') for (let k = 0; k < 8; k++) b.n('pluck', t + k * 0.5, rootOf(K, ch, 48) + (k % 4 === 3 ? 12 : 0), 0.35, (k % 2 ? 0.2 : 0.28) * g);
    arp(b, K, t, ch, 4, 0.25, 0.17 * g, [0, 1, 2, 3, 4, 3, 2, 1], lit(col, { lay: 0.3, cut: 1800 }), 'arp', col.bass === 'none' ? 67 : 57);
    brass(b, K, t, ch, 0.75, 0.24 * g, lit(col, { lay: 0.5 }), col.bass === 'none' ? 60 : 50);
    choir(b, K, t, ch, 3.8, 0.2 * g, 1, lit(col, { lay: 0.75 }), 55);
    // A lit lamp adds warm chords.
    pad(b, K, t, ch, 4, 0.2 * g, { when: 'lamp', a: 0.2 }, col.bass === 'none' ? 60 : 53);
    b.hit(t, col.bass === 'none' ? 'wood' : 'kick', 0.32, 0.25, { when: 'low' });
    b.hit(t + 0.5, col.bass === 'none' ? 'wood' : 'kick', 0.22, 0.25, { when: 'low' });
  });
  groove(b, 0, prog.length, col.kit, 0.5 * g);
  for (const [lay, kit] of col.more) groove(b, 0, prog.length, kit, 0.46 * g, { lay });
  if (c.int > 0.85) for (let k = 0; k < 16; k++) b.n('blip', k + c.r.int(2) * 0.5, fold(col.K(c.r.int(5) * 2), 82), 0.2, 0.16, lit(col, { pan: c.r.range(-0.8, 0.8) }));
  col.tex?.(b, c, K, prog.length * 4);
}

function counterAt(b: B, col: Color, t: number, g: number, x: X = {}): void {
  const early = col.counter === LOT ? LOT_EARLY : 0;
  const nos = col.counter === TIK ? { nos: 1 as const } : {};
  motif(b, col.counterVoice, t + early, col.counter, col.K, col.counterOct, g, lit(col, { ...nos, ...x }));
}

function battleTrack(): TrackDef {
  const pick = (c: Ctx) => COLORS[c.region] ?? COLORS.long;
  const out = (b: B, col: Color, extra: Partial<Section> = {}) => { lift(b, col); return b.out({ key: col.K, shadow: col.shadow, ...extra }); };
  return {
    kind: 'battle', key: COLORS.long.K, shadow: 0.5, litShadow: LAMP, bpm: 120, start: 'intro', vary: 0.4, wrong: 0.03, echo: 0.4, verb: 0.75, level: 0.95,
    graph: { intro: [['a', 1]], a: [['a', 2], ['b', 2]], b: [['a', 2], ['break', 1]], break: [['a', 1]] },
    secs: {
      intro: (c) => {
        const col = pick(c);
        const b = new B(8, 4, col.bpm);
        if (col.bass !== 'none') { b.n('drone', 0, rootOf(col.K, [0], 38), 8, 0.36, { a: 0.8 }); sub(b, col.K, 0, col.prog[0], 8, 0.36); }
        else pad(b, col.K, 0, col.prog[0], 8, 0.18, {}, 60);
        arp(b, col.K, 4, col.prog[0], 4, 0.25, 0.2, [0, 1, 2, 3], lit(col, { cut: 900 }), 'arp', col.bass === 'none' ? 67 : 57);
        b.hit(6, 'swell', 0.2, 2);
        groove(b, 4, 1, col.kit, 0.4);
        return out(b, col, { still: true, bpm: col.bpm });
      },
      a: (c) => {
        const col = pick(c);
        const b = new B(16, 4, col.bpm);
        band(b, c, col, col.prog);
        motif(b, col.lead, 0, col.riff, col.K, col.leadOct, 0.34, lit(col));
        motif(b, col.lead, 8, c.visit % 2 ? shift(col.riff, 2) : col.riff, col.K, col.leadOct, 0.32, lit(col));
        counterAt(b, col, 8, 0.24, { lay: 0.25 });
        return out(b, col, { bpm: col.bpm });
      },
      b: (c) => {
        const col = pick(c);
        const b = new B(16, 4, col.bpm);
        band(b, c, col, col.progB);
        // The leads trade: the region's companion motif first, then the riff, then both at once.
        counterAt(b, col, 0, 0.3);
        motif(b, col.lead, 8, col.riff, col.K, col.leadOct, 0.32, lit(col));
        if (col === COLORS.glass) motif(b, 'glass', 12, col.riff.slice(0, 4), col.K, 1, 0.14, { lay: 0.2, nos: 1 });
        ticks(b, c, 16, 10, 0.16, lit(col, { lay: 0.6 }));
        b.ev = b.ev.filter((e) => e.t < 15.5 || e.v === 'drone' || e.v === 'sub' || e.v === 'pad');
        return out(b, col, { bpm: col.bpm });
      },
      break: (c) => {
        const col = pick(c);
        const b = new B(16, 4, col.bpm);
        const low = col.bass === 'none' ? 60 : 55;
        if (col.bass !== 'none') { b.n('drone', 0, rootOf(col.K, [0], 38), 16, 0.4, { a: 0.5 }); sub(b, col.K, 0, col.prog[0], 16, 0.32); }
        choir(b, col.K, 0, col.prog[0], 8, 0.22, 0, lit(col), low);
        choir(b, col.K, 8, col.prog[2], 8, 0.22, 0.4, lit(col), low);
        pad(b, col.K, 0, col.prog[0], 16, 0.16, { when: 'lamp', a: 0.3 }, col.bass === 'none' ? 60 : 53);
        // The companion's figure alone on a bell, slow or at speed, and a far answer that changes every time.
        if (c.visit % 2) motif(b, 'bell', 2, aug(col.counter, 2), col.K, 1, 0.26, lit(col, { nos: 1 }));
        else { motif(b, 'bell', 1, col.counter, col.K, 1, 0.26, lit(col, { nos: 1 })); motif(b, 'bell', 9, col.counter, col.K, 1, 0.2, lit(col, { nos: 1, pan: 0.4 })); }
        for (let k = 0; k < 2; k++) b.n('glass', 6 + k * 6 + c.r.int(3), col.K(c.r.pick([2, 4, 6])) + 12, 1.5, 0.12, lit(col, { pan: c.r.range(-0.7, 0.7) }));
        groove(b, 0, 4, col.bass === 'none' ? { clap: c.r.pick(['....6.......6...', '....6.....4.6...']) } : { taiko: '7...............', kick: c.r.pick(['........5.......', '......4.5.......']) }, 0.4);
        if (c.int > 0.4) arp(b, col.K, 12, col.prog[0], 4, 0.25, 0.16, [0, 1, 2, 3], lit(col, { cut: 1200 }), 'arp', col.bass === 'none' ? 67 : 57);
        return out(b, col, { bpm: col.bpm });
      },
    },
  };
}

// ---------------------------------------------------------------- bosses

/**
 * One boss per region, each acting out its mechanic. Grisaille's lantern turns leads, so pre-notes come after their
 * notes until a lamp is lit. The Painter paints false pre-notes with a hard edge. The Heliotrope turns every figure
 * upward toward the light. The Warden's panes replay the riff a bar and two bars late, and only the real one casts a
 * pre-note. The Keeper snuffs bars of the music. The Lampeater eats bright notes, and its last phase is total dark.
 */
const BOSS: Record<Region, Color & { tempo: number; key2: Key }> = {
  long: { ...COLORS.long, K: key(62, MODE.dor), key2: key(62, MODE.dor), tempo: 126, bpm: 126, riff: RIFF_LONG, counter: RULE, counterVoice: 'cold', counterOct: 1,
    kit: { kick: '9.......8.......', snare: '....7..3....7.33' }, more: [[0.3, { hat: '3.3.3.3.3.3.3.3.' }], [0.6, { kick: '......5.......5.' }]] },
  market: { ...COLORS.market, K: key(58, MODE.dor), key2: key(58, MODE.dor), tempo: 116, bpm: 116, prog: [[0, 'sev'], [3, 'add9'], [6, 'add9'], [0, 'sev']], progB: [[2, 'add9'], [3, 'add9'], [4, 'sev'], [0, 'sev']] },
  face: { ...COLORS.face, K: key(64, MODE.lyd), key2: key(64, MODE.lyd), tempo: 132, bpm: 132, riff: inv(RIFF_FACE, 4), counter: inv(UMB, 4) },
  glass: { ...COLORS.glass, key2: COLORS.glass.K, tempo: 116 },
  overhead: { ...COLORS.overhead, K: key(71, MODE.lyd), key2: key(71, MODE.lyd), tempo: 132, bpm: 132 },
  back: { ...COLORS.back, key2: COLORS.back.K, tempo: 104, bpm: 104 },
  lamp: { ...COLORS.lamp, key2: COLORS.lamp.K, tempo: 120 },
};

function bossSection(c: Ctx, which: 'a' | 'b'): Section {
  const region = c.region;
  const col = BOSS[region] ?? BOSS.long;
  const K = col.K;
  const b = new B(16, 4, col.bpm);
  const prog = which === 'a' ? col.prog : col.progB;
  const extra: Partial<Section> = { key: K, shadow: col.shadow, bpm: col.bpm };
  const dark = region === 'back' && c.phase >= 2;
  if (dark) {
    // The last phase is fought in total dark: the bass, the clicks of Tik listening, and the thing moving somewhere.
    prog.forEach((ch, i) => {
      const r = rootOf(K, ch, 38);
      for (let k = 0; k < 8; k++) if (k % 2 === 0 || c.r.chance(0.4)) b.n('bass', i * 4 + k * 0.5, k === 7 && c.r.chance(0.5) ? r + 12 : r, 0.4, k % 2 ? 0.32 : 0.44, { cut: 300 });
      sub(b, K, i * 4, ch, 4, 0.28);
    });
    groove(b, 0, 4, { kick: c.r.pick(['9.....6.9.......', '9.......9.6.....', '9..6....9.......']) }, 0.48);
    ticks(b, c, 16, 10, 0.32, {}, 'click');
    if (c.r.chance(0.5)) b.hit(c.r.int(16), 'boom', 0.3, 1);
    lift(b, col);
    return b.out(extra);
  }
  band(b, c, col, prog, 1);
  const riff = which === 'b' ? shift(col.riff, 2) : col.riff;
  motif(b, col.lead, 0, riff, K, col.leadOct, 0.36, lit(col));
  motif(b, col.lead, 8, col.riff, K, col.leadOct, 0.34, lit(col));
  counterAt(b, col, 4, 0.26, { lay: 0.2 });
  if (c.phase >= 1) brass(b, K, 0, prog[0], 2, 0.26, lit(col), col.bass === 'none' ? 60 : 50);
  switch (region) {
    case 'long':
      extra.turn = true;
      break;
    case 'market':
      extra.paint = 0.45;
      for (const e of b.ev) if (e.v === col.lead && e.d >= 0.9 && c.r.chance(0.5)) e.bend = c.r.pick([1, -1, 2]);
      break;
    case 'face':
      // Under a lamp the figures turn back down onto their own roots.
      motif(b, 'cold', 0, inv(riff, 4), K, 0, 0.26, { when: 'lamp' });
      b.hit(c.r.int(4) * 4, 'scan', 0.14, 3, { n: 76, lay: 0.3 });
      break;
    case 'glass':
      motif(b, 'glass', 4, riff.slice(0, 6), K, 1, 0.18, { nos: 1 });
      motif(b, 'rev', 8, riff.slice(0, 5), K, 1, 0.14, { nos: 1 });
      break;
    case 'overhead': {
      // It snuffs a bar: everything melodic in it goes, the lamp layer included, and only the drums keep going.
      const bar = c.r.int(4);
      const gaps = c.phase >= 1 ? [bar, (bar + 2) % 4] : [bar];
      b.ev = b.ev.filter((e) => e.v === 'nz' || !gaps.some((k) => e.t >= k * 4 && e.t < k * 4 + 4));
      break;
    }
    case 'back': {
      // It eats the lamp's light: a bright figure appears, gets cut off, and is swallowed.
      const at = 4 + c.r.int(3) * 4;
      for (let k = 0; k < 3; k++) b.n('glass', at + k * 0.25, K(4 + k) + 12, k === 2 ? 0.1 : 0.22, 0.22, { pan: 0.3, when: 'lamp' });
      b.hit(at + 0.75, 'boom', 0.36, 1);
      b.n('bass', at + 0.75, rootOf(K, [0], 40), 1.5, 0.34, { cut: 300, bend: -5, x: 1 });
      break;
    }
    case 'lamp':
      break;
  }
  lift(b, col);
  return b.out(extra);
}

const boss: TrackDef = {
  kind: 'battle', key: BOSS.long.K, shadow: 0.5, litShadow: LAMP, bpm: 126, start: 'a', vary: 0.35, wrong: 0.03, echo: 0.4, verb: 0.8, level: 1,
  graph: { a: [['a', 1], ['b', 2]], b: [['a', 2], ['b', 1]], phase: [['a', 1]] },
  secs: {
    a: (c) => bossSection(c, 'a'),
    b: (c) => bossSection(c, 'b'),
    phase: (c) => {
      const col = BOSS[c.region] ?? BOSS.long;
      const b = new B(8, 4, col.bpm);
      if (col.bass !== 'none') { b.n('drone', 0, rootOf(col.K, [0], 38), 8, 0.4, { a: 0.3 }); sub(b, col.K, 0, col.prog[0], 8, 0.34); }
      brass(b, col.K, 0, col.prog[0], 3.5, 0.3, lit(col), col.bass === 'none' ? 60 : 50);
      motif(b, col.counterVoice, 4, col.counter.slice(0, 4), col.K, col.counterOct, 0.32, lit(col));
      b.hit(0, 'crash', 0.4, 1);
      b.hit(4, 'roll', 0.34, 4);
      b.hit(4, 'swell', 0.22, 4);
      lift(b, col);
      return b.out({ still: true, key: col.K, shadow: col.shadow, bpm: col.bpm });
    },
  },
};

// ---------------------------------------------------------------- boss_final

const D_AEO = key(62, MODE.aeo);
const D_ION = key(62, MODE.ion);

/** The Great Lamp: Anthelion's square rhythm under its beam, then every motif at once, then the siblings together. */
const bossFinal: TrackDef = {
  kind: 'battle', key: D_AEO, shadow: 0.5, litShadow: LAMP, bpm: 116, start: 'anth', vary: 0.3, wrong: 0.02, echo: 0.4, verb: 0.85, level: 0.96,
  next: (cur, c) => {
    if (c.phase <= 0) return 'anth';
    if (c.phase === 1) return 'gather';
    return 'together';
  },
  secs: {
    anth: (c) => {
      const b = new B(16, 4, 116);
      const prog: Ch[] = [[0], [5], [6], [4]];
      prog.forEach((ch, i) => {
        for (let k = 0; k < 4; k++) b.n('bass', i * 4 + k, rootOf(D_AEO, ch, 38), 0.7, 0.42, { cut: 320 });
        sub(b, D_AEO, i * 4, ch, 4, 0.26);
        pad(b, D_AEO, i * 4, ch, 4, 0.18);
        brass(b, D_AEO, i * 4, ch, 0.5, 0.22, { lay: 0.4 });
        choir(b, D_AEO, i * 4, ch, 3.8, 0.18, 0.6, { lay: 0.7 });
        pad(b, D_AEO, i * 4, ch, 4, 0.18, { when: 'lamp', a: 0.2 });
      });
      groove(b, 0, 4, { kick: '9...9...9...9...', clank: '....6.......6...' }, 0.5);
      groove(b, 0, 4, { tick: '3.3.3.3.3.3.3.3.' }, 0.44, { lay: 0.3 });
      b.hit(0, 'hum', 0.3, 16, { n: 38, a: 0.5 });
      // The beam sweeps the arena and turns every lead: in alternate sections the pre-notes fall after their notes.
      b.hit(1 + c.r.int(3), 'scan', 0.16, 6, { n: 62 });
      b.hit(9 + c.r.int(3), 'scan', 0.14, 6, { n: 66 });
      motif(b, 'sq', 0, ANTH, D_AEO, 1, 0.36);
      motif(b, 'sq', 8, shift(ANTH, [-2, -3, -1][c.visit % 3]), D_AEO, 1, 0.34);
      // The party answers under him: a different figure each time.
      const answer = [NODUS, PARH.slice(0, 2), UMB, MINIM.slice(0, 4)][c.visit % 4];
      motif(b, answer === NODUS ? 'lead' : 'cold', 8, answer, D_AEO, 0, 0.26, { lay: 0.3 });
      return b.out({ shadow: c.visit % 2 ? -0.5 : 0.5 });
    },
    gather: (c) => {
      // Every motif, two by two, over the full band.
      const b = new B(32, 4, 116);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [2, 'add9'], [6, 'add9'], [3, 'sev'], [0, 'add9'], [5, 'add9'], [4, 'sev']];
      prog.forEach((ch, i) => {
        pulse(b, D_AEO, i * 4, ch, 4, 0.46, 0.5, { cut: 340 });
        sub(b, D_AEO, i * 4, ch, 4, 0.26);
        arp(b, D_AEO, i * 4, ch, 4, 0.25, 0.15, [0, 1, 2, 3, 4, 3, 2, 1], { lay: 0.3 });
        choir(b, D_AEO, i * 4, ch, 3.8, 0.18, 1, { lay: 0.65 });
        pad(b, D_AEO, i * 4, ch, 4, 0.2, { when: 'lamp', a: 0.2 });
        b.hit(i * 4, 'kick', 0.3, 0.25, { when: 'low' });
      });
      groove(b, 0, 8, DRIVE, 0.5);
      for (const [lay, kit] of DRIVE_MORE) groove(b, 0, 8, kit, 0.46, { lay });
      b.hit(0, 'hum', 0.2, 32, { n: 38, a: 1 });
      motif(b, 'lead', 3.5, NODUS, D_AEO, 0, 0.34);
      b.fig('brass', 0, UMB, D_AEO, -1, 0.24, { cut: 1600 }, 0.9);
      motif(b, 'lead', 11.5, PARH, D_AEO, 0, 0.34);
      b.fig('glass', 8, MINIM, D_AEO, 1, 0.2, {}, 0.95);
      motif(b, 'cold', 16 + LOT_EARLY, LOT, D_AEO, 1, 0.3);
      b.fig('bell', 20, TIK, D_AEO, 1, 0.24, { nos: 1 }, 0.95);
      motif(b, 'sq', 24, ANTH, D_AEO, 1, 0.32);
      b.fig('sub', 24, BIG, D_AEO, -2, 0.34, {}, 0.98);
      b.fig('brass', 24, BIG, D_AEO, -1, 0.24, { cut: 1200 }, 0.98);
      if (c.int > 0.8) for (let k = 0; k < 16; k++) b.n('blip', k * 2 + c.r.int(2) * 0.5, D_AEO(c.r.int(5) * 2) + 24, 0.2, 0.14, { pan: c.r.range(-0.8, 0.8) });
      return b.out();
    },
    together: (c) => {
      // Parhelia and Anthelion hold the last mirror together: her bent note over his square stamps, in the major.
      const b = new B(32, 4, 116);
      const prog: Ch[] = [[0, 'add9'], [4, 'sus4'], [5, 'sev'], [3, 'add9'], [0, 'add9'], [4, 'sev'], [3, 'add9'], [0, 'add9']];
      prog.forEach((ch, i) => {
        pulse(b, D_ION, i * 4, ch, 4, 0.44, 0.5, { cut: 360 });
        sub(b, D_ION, i * 4, ch, 4, 0.26);
        pad(b, D_ION, i * 4, ch, 4, 0.2);
        brass(b, D_ION, i * 4, ch, 1, 0.24, { lay: 0.3 });
        choir(b, D_ION, i * 4, ch, 3.8, 0.2, 1, { lay: 0.5 });
        arp(b, D_ION, i * 4, ch, 4, 0.25, 0.14, [0, 1, 2, 3, 4, 3, 2, 1], { lay: 0.4 });
        b.hit(i * 4, 'kick', 0.3, 0.25, { when: 'low' });
      });
      groove(b, 0, 8, DRIVE, 0.5);
      for (const [lay, kit] of DRIVE_MORE) groove(b, 0, 8, kit, 0.46, { lay });
      motif(b, 'lead', 3.5, PARH, D_ION, 0, 0.36);
      motif(b, 'sq', 4, ANTH, D_ION, 0, 0.26);
      motif(b, 'lead', 19.5, PARH, D_ION, 0, 0.36);
      motif(b, 'sq', 20, shift(ANTH, -2), D_ION, 0, 0.26);
      b.fig('sub', 12, BIG, D_ION, -2, 0.34, {}, 0.98);
      b.fig('brass', 12, BIG, D_ION, -1, 0.26, { cut: 1600 }, 0.98);
      motif(b, 'cold', 28, NODUS_HEAD, D_ION, 1, 0.28);
      if (c.int > 0.7) b.hit(0, 'crash', 0.36, 1);
      return b.out({ key: D_ION });
    },
    phase: (c) => {
      const b = new B(8, 4, 116);
      const K = c.phase >= 2 ? D_ION : D_AEO;
      b.n('drone', 0, 38, 8, 0.42, { a: 0.3 });
      sub(b, K, 0, [0], 8, 0.34);
      brass(b, K, 0, [0, 'add9'], 3.5, 0.3);
      b.fig('brass', 4, BIG, K, -1, 0.3, { cut: 1600 }, 0.98);
      b.hit(0, 'crash', 0.42, 1);
      b.hit(4, 'roll', 0.36, 4);
      b.hit(4, 'swell', 0.24, 4);
      return b.out({ still: true, key: K });
    },
  },
};

// ---------------------------------------------------------------- victory and defeat

/** The win sting is in the key of the track it melts back into, so the melt lands on a shared tonic. */
const victory: TrackDef = {
  kind: 'sting', key: D_ION, shadow: 0.5, bpm: 120, start: 'win', vary: 0, wrong: 0, echo: 0.45, level: 1,
  graph: {},
  secs: {
    win: (c) => {
      const lyd = c.ret && c.ret.mode.length === 7 && c.ret.mode[3] === 6;
      const mixo = c.ret && c.ret.mode.length === 7 && c.ret.mode[2] === 4 && c.ret.mode[6] === 10;
      const K = c.ret ? key(c.ret.root, lyd ? MODE.lyd : mixo ? MODE.mix : MODE.ion) : D_ION;
      const b = new B(10, 4, 120);
      // Nodus's first notes, then a leap up to the fifth where the blank would be.
      motif(b, 'lead', 0, [[-3, 0.5], [0, 0.5], [1, 0.5], [4, 2.5]], K, 0, 0.4);
      b.fig('arp', 0, [[-3, 0.5], [0, 0.5], [1, 0.5], [4, 0.5], [7, 2]], K, 1, 0.2, {}, 0.8);
      brass(b, K, 1.5, [0, 'add9'], 3, 0.3, { cut: 2600 });
      chordOn(b, 'bell', K, 1.5, [0, 'add9'], 3, 0.18, {}, 72, 3);
      b.n('sub', 1.5, rootOf(K, [0], 31), 7, 0.36);
      pad(b, K, 1.5, [0, 'add9'], 8.5, 0.22);
      b.hit(1.5, 'crash', 0.36, 1);
      b.hit(1.5, 'taiko', 0.5, 0.5);
      b.hit(0, 'snare', 0.24, 0.25);
      b.hit(0.5, 'snare', 0.26, 0.25);
      b.hit(1, 'snare', 0.3, 0.25);
      return b.out({ still: true, end: true, key: K });
    },
  },
};

const A_AEO = key(57, MODE.aeo);

const defeat: TrackDef = {
  kind: 'scene', key: A_AEO, shadow: 0.5, bpm: 60, start: 'fall', vary: 0, wrong: 0, echo: 0.6, level: 0.95,
  graph: { fall: [['hold', 1]], hold: [['hold', 1]] },
  secs: {
    fall: () => {
      // Nodus's line, each time a step lower and quieter, over a choir that will not resolve.
      const b = new B(16, 4, 60);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'sev'], [4, 'sus4']];
      b.n('drone', 0, 45, 16, 0.42, { a: 1 });
      prog.forEach((ch, i) => { choir(b, A_AEO, i * 4, ch, 4, 0.2, 0.5); sub(b, A_AEO, i * 4, ch, 4, 0.3); });
      for (let k = 0; k < 3; k++) motif(b, 'lead', k * 4 + 1, shift(NODUS, -k), A_AEO, 0, 0.32 - k * 0.06);
      return b.out({ still: true });
    },
    hold: () => {
      const b = new B(16, 4, 60);
      b.n('drone', 0, 45, 16, 0.38, { a: 0.5 });
      choir(b, A_AEO, 0, [0, 'add9'], 16, 0.14, 0);
      sub(b, A_AEO, 0, [0], 16, 0.26);
      b.n('glass', 6, A_AEO(4) + 12, 3, 0.12, { pan: 0.4 });
      return b.out({ still: true });
    },
  },
};

export const BATTLE_TRACKS: Record<string, TrackDef> = {
  battle: battleTrack(), boss, boss_final: bossFinal, victory, defeat,
};
