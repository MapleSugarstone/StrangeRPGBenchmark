// Battle tracks: combat, boss, victory, and defeat. A battle takes its color from the district of the last place
// track. Every section writes two leads at once: the party's riff, which sounds on the party's turn, and the enemy's
// figure, which sounds on the enemy's turn. Layers rise with intensity, low HP re-spells everything darker, and each
// district's boss acts out what it does in the fight.
import { B, MODE, aug, fold, key, retro, shift, type Ctx, type Ev, type Fig, type Key, type Nz, type Region, type Section, type TrackDef, type Voice } from './score-core';
import { arp, brass, chordOn, choir, groove, motif, pad, pulse, rootOf, sub, ticks, type Ch } from './parts';
import { BAILER, BOARD, BOARD_I, MARIT_HEAD, PORT, PORT_HEAD } from './motifs';
import { bailer, port } from './weave';

type X = Partial<Ev>;
type Kit = Partial<Record<Nz, string>>;

interface Color {
  K: Key;
  bpm: number;
  prog: readonly Ch[];
  progB: readonly Ch[];
  reflect: number;
  bass: 'pulse' | 'high' | 'heavy';
  kit: Kit;
  /** Drum parts that join above an intensity, as [level, pattern]. */
  more: ReadonlyArray<readonly [number, Kit]>;
  /** Drums that play only on the enemy's turn. */
  foeKit: Kit;
  riff: Fig;
  leadOct: number;
  foe: Fig;
  foeVoice: Voice;
  foeOct: number;
  counter: Fig;
  counterVoice: Voice;
  counterOct: number;
  tex?: (b: B, c: Ctx, K: Key, beats: number) => void;
  /** Scales every note, so each district measures at the same level as the others. */
  gain?: number;
}

/** Applies a color's gain to a finished section's notes. */
function lift(b: B, col: Color): void {
  if (col.gain && col.gain !== 1) for (const e of b.ev) e.g = Math.min(1, e.g * col.gain);
}

const RIFF_DEEPS: Fig = [[4, 0.5], [2, 0.25], [4, 0.25], [7, 0.5], [6, 0.5], [4, 1], [2, 1], [5, 0.5], [4, 0.5], [2, 0.5], [0, 0.5], [1, 1], [-1, 1]];
const FOE_DEEPS: Fig = [[0, 0.5], [0, 0.5], [5, 1], [4, 0.5], [3, 0.5], [4, 1], [0, 0.5], [0, 0.5], [5, 0.5], [6, 0.5], [5, 1], [4, 1]];
const RIFF_STAIR: Fig = [[0, 0.75], [2, 0.25], [4, 0.5], [6, 0.5], [5, 0.5], [4, 0.5], [3, 1], [4, 0.5], [3, 0.25], [4, 0.25], [5, 0.5], [7, 0.5], [4, 2]];
const FOE_STAIR: Fig = [[4, 0.25], [4, 0.25], [3, 0.5], [1, 1], [4, 0.25], [4, 0.25], [3, 0.5], [0, 1], [5, 0.5], [4, 0.5], [3, 0.5], [1, 0.5], [0, 2]];
const RIFF_BRIM: Fig = [[0, 1], [0, 0.5], [2, 0.5], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [2, 0.5], [0, 0.5], [-1, 1], [0, 1]];
const FOE_BRIM: Fig = [...BOARD, ...shift(BOARD, -2)];
const RIFF_FLOOD: Fig = [[0, 1.5], [2, 0.5], [3, 1], [2, 1], [4, 2], [3, 1], [2, 0.5], [0, 0.5]];
const FOE_FLOOD: Fig = [[4, 0.75], [4, 0.25], [1, 0.5], [2, 0.5], [-1, 2], [4, 0.75], [4, 0.25], [1, 0.5], [2, 0.5], [-2, 2]];

const DRIVE_MORE: ReadonlyArray<readonly [number, Kit]> = [[0.3, { hat: '3.3.3.3.3.3.3.3.' }], [0.55, { snare: '....7.......7...' }], [0.75, { kick: '......4.....4...' }]];

export const COLORS: Record<Region, Color> = {
  deeps: {
    K: key(57, MODE.aeo), bpm: 120, prog: [[0, 'add9'], [5, 'add9'], [6, 'add9'], [0, 'sus4']], progB: [[3, 'sev'], [5, 'add9'], [4, 'sev'], [0, 'add9']], reflect: 0.5,
    bass: 'pulse', kit: { kick: '9.....5.9.......', wood: '....6.......6...' }, more: DRIVE_MORE, foeKit: { hat: '.2.2.2.2.2.2.2.2', taiko: '7.......5.......' },
    riff: RIFF_DEEPS, leadOct: 0, foe: FOE_DEEPS, foeVoice: 'cold', foeOct: -1, counter: aug(PORT, 0.5), counterVoice: 'bell', counterOct: 1,
    tex: (b, c, K, beats) => { for (let k = 0; k < 4; k++) b.hit(c.r.next() * beats, 'drip', 0.16, 0.1, { n: K(c.r.pick([0, 2, 4])) + 24, pan: c.r.range(-0.7, 0.7), lay: 0.4 }); },
  },
  stair: {
    K: key(61, MODE.dor), bpm: 126, prog: [[0, 'add9'], [3, 'add9'], [6, 'add9'], [4, 'sev']], progB: [[1, 'sev'], [3, 'add9'], [2, 'sev'], [4, 'sus4']], reflect: 0.25,
    bass: 'high', kit: { kick: '9...8...9...8...', wood: '....6.......6...' }, more: [[0.3, { hat: '..4...4...4...4.' }], [0.55, { clap: '....7.......7...' }], [0.75, { shaker: '2222222222222222' }]],
    foeKit: { hat: '3.3.3.3.3.3.3.3.', clank: '..........5.....' },
    riff: RIFF_STAIR, leadOct: 0, foe: FOE_STAIR, foeVoice: 'cold', foeOct: 0, counter: aug(PORT, 0.5), counterVoice: 'arp', counterOct: 1, gain: 1.15,
  },
  brim: {
    K: key(64, MODE.aeo), bpm: 132, prog: [[0], [5], [6], [4, 'sev']], progB: [[3, 'sev'], [5, 'add9'], [2, 'add9'], [4, 'sus4']], reflect: 0,
    bass: 'pulse', kit: { kick: '9...9...9...9...', clank: '....6.......6...' }, more: [[0.3, { tick: '3.3.3.3.3.3.3.3.' }], [0.55, { snare: '..........5.....' }], [0.75, { kick: '..4...4...4...4.' }]],
    foeKit: { hat: '3232323232323232' },
    riff: RIFF_BRIM, leadOct: 0, foe: FOE_BRIM, foeVoice: 'sq', foeOct: 0, counter: PORT, counterVoice: 'bell', counterOct: 1, gain: 0.96,
    tex: (b, c) => { if (c.r.chance(0.5)) b.hit(c.r.int(12), 'scan', 0.1, 4, { n: 52, lay: 0.3 }); },
  },
  flood: {
    K: key(55, MODE.aeo), bpm: 104, prog: [[0, 'add9'], [5, 'add9'], [2, 'add9'], [6, 'add9']], progB: [[3, 'sev'], [5, 'add9'], [4, 'sev'], [0, 'add9']], reflect: 0.75,
    bass: 'heavy', kit: { taiko: '9.......8.......', snare: '........7.......' }, more: [[0.3, { hat: '3.3.3.3.3.3.3.3.' }], [0.55, { kick: '......5.........' }], [0.75, { taiko: '....5.......5...' }]],
    foeKit: { snare: '....5..3....5.33' },
    riff: RIFF_FLOOD, leadOct: 0, foe: FOE_FLOOD, foeVoice: 'sq', foeOct: 0, counter: aug(MARIT_HEAD, 1), counterVoice: 'glass', counterOct: 1, gain: 0.88,
    tex: (b, c, _K, beats) => { for (let t = 0; t < beats; t += 4) b.hit(t + 2, 'slosh', 0.2, 2, { pan: c.r.range(-0.5, 0.5) }); },
  },
};

/** One section of the band: bass, chords that arrive with the danger, drums, the enemy's layer, and a heartbeat at low HP. */
function band(b: B, c: Ctx, col: Color, prog: readonly Ch[], g = 1): void {
  const K = col.K;
  prog.forEach((ch, i) => {
    const t = i * 4;
    if (col.bass === 'pulse') { pulse(b, K, t, ch, 4, 0.46 * g, 0.5, { cut: 340 }); sub(b, K, t, ch, 4, 0.26 * g); }
    else if (col.bass === 'high') { for (let k = 0; k < 8; k++) b.n('pluck', t + k * 0.5, rootOf(K, ch, 45) + (k % 4 === 3 ? 12 : 0), 0.35, (k % 2 ? 0.2 : 0.28) * g); sub(b, K, t, ch, 4, 0.22 * g); }
    else { pulse(b, K, t, ch, 4, 0.5 * g, 1, { cut: 300 }); sub(b, K, t, ch, 4, 0.34 * g); }
    arp(b, K, t, ch, 4, 0.25, 0.16 * g, [0, 1, 2, 3, 4, 3, 2, 1], { lay: 0.3, cut: 1800 });
    brass(b, K, t, ch, 0.75, 0.24 * g, { lay: 0.5 }, 50);
    choir(b, K, t, ch, 3.8, 0.2 * g, 1, { lay: 0.75 }, 55);
    // The enemy's turn darkens the floor: a low brass swell under every bar.
    brass(b, K, t, ch, 3.6, 0.12 * g, { when: 'enemy', a: 1.2, cut: 900 }, 43);
    // Low HP brings a heartbeat.
    b.hit(t, 'kick', 0.32, 0.25, { when: 'low' });
    b.hit(t + 0.5, 'kick', 0.22, 0.25, { when: 'low' });
  });
  groove(b, 0, prog.length, col.kit, 0.5 * g);
  for (const [lay, kit] of col.more) groove(b, 0, prog.length, kit, 0.46 * g, { lay });
  groove(b, 0, prog.length, col.foeKit, 0.42 * g, { when: 'enemy' });
  if (c.int > 0.85) for (let k = 0; k < 16; k++) b.n('blip', k + c.r.int(2) * 0.5, fold(K(c.r.int(5) * 2), 82), 0.2, 0.16, { pan: c.r.range(-0.8, 0.8) });
  // Each kill adds weight to the party's side: from the second kill the brass doubles the riff's first bar.
  if (c.kills >= 2) b.fig('brass', 0, col.riff.slice(0, 5), K, col.leadOct - 1, 0.16 * g, { when: 'party', cut: 1600 }, 0.9);
  col.tex?.(b, c, K, prog.length * 4);
}

/** The two leads: the party's riff on its turn and the enemy's figure on the enemy's turn, twice each. */
function leads(b: B, c: Ctx, col: Color, riff: Fig, foe: Fig, g = 1, foeLeg = 0.9): void {
  motif(b, 'lead', 0, riff, col.K, col.leadOct, 0.34 * g, { when: 'party' });
  motif(b, 'lead', 8, c.visit % 2 ? shift(riff, 2) : riff, col.K, col.leadOct, 0.32 * g, { when: 'party' });
  b.fig(col.foeVoice, 0, foe, col.K, col.foeOct, 0.3 * g, { when: 'enemy', m: 1, cut: 2000 }, foeLeg);
  b.fig(col.foeVoice, 8, foe, col.K, col.foeOct, 0.3 * g, { when: 'enemy', m: 1, cut: 2000 }, foeLeg);
}

function counterAt(b: B, col: Color, t: number, g: number, x: X = {}): void {
  b.fig(col.counterVoice, t, col.counter, col.K, col.counterOct, g, { nor: 1, ...x }, 0.9);
}

function combatTrack(): TrackDef {
  const pick = (c: Ctx) => COLORS[c.region] ?? COLORS.deeps;
  const out = (b: B, col: Color, extra: Partial<Section> = {}) => { lift(b, col); return b.out({ key: col.K, reflect: col.reflect, bpm: col.bpm, ...extra }); };
  return {
    kind: 'battle', key: COLORS.deeps.K, reflect: 0.5, bpm: 120, start: 'intro', vary: 0.4, wrong: 0.03, echo: 0.4, verb: 0.75, level: 0.95,
    graph: { intro: [['a', 1]], a: [['a', 2], ['b', 2]], b: [['a', 2], ['break', 1]], break: [['a', 1]] },
    secs: {
      intro: (c) => {
        const col = pick(c);
        const b = new B(8, 4, col.bpm);
        b.n('drone', 0, rootOf(col.K, [0], 38), 8, 0.36, { a: 0.8 });
        sub(b, col.K, 0, col.prog[0], 8, 0.36);
        arp(b, col.K, 4, col.prog[0], 4, 0.25, 0.2, [0, 1, 2, 3], { cut: 900 });
        b.hit(6, 'swell', 0.2, 2);
        groove(b, 4, 1, col.kit, 0.4);
        port(b, 'cold', 0.5, col.K, 0, 0.24, {}, PORT_HEAD, 0);
        return out(b, col, { still: true });
      },
      a: (c) => {
        const col = pick(c);
        const b = new B(16, 4, col.bpm);
        band(b, c, col, col.prog);
        leads(b, c, col, col.riff, col.foe);
        counterAt(b, col, 8, 0.2, { lay: 0.25, when: 'party' });
        return out(b, col);
      },
      b: (c) => {
        const col = pick(c);
        const b = new B(16, 4, col.bpm);
        band(b, c, col, col.progB);
        // The leads trade: the counter motif first, then the riff on its turn, the foe's figure an octave down on its.
        counterAt(b, col, 0, 0.26, { when: 'party' });
        motif(b, 'lead', 8, col.riff, col.K, col.leadOct, 0.32, { when: 'party' });
        b.fig(col.foeVoice, 0, col.foe, col.K, col.foeOct - (col.foeVoice === 'cold' && col.foeOct > -1 ? 1 : 0), 0.3, { when: 'enemy', m: 1, cut: 1600 }, 0.9);
        b.fig(col.foeVoice, 8, shift(col.foe, -1), col.K, col.foeOct, 0.3, { when: 'enemy', m: 1, cut: 2000 }, 0.9);
        ticks(b, c, 16, 10, 0.16, { lay: 0.6 });
        b.ev = b.ev.filter((e) => e.t < 15.5 || e.v === 'drone' || e.v === 'sub' || e.v === 'pad');
        return out(b, col);
      },
      break: (c) => {
        const col = pick(c);
        const b = new B(16, 4, col.bpm);
        b.n('drone', 0, rootOf(col.K, [0], 38), 16, 0.4, { a: 0.5 });
        sub(b, col.K, 0, col.prog[0], 16, 0.32);
        choir(b, col.K, 0, col.prog[0], 8, 0.22, 0, {}, 55);
        choir(b, col.K, 8, col.prog[2], 8, 0.22, 0.4, {}, 55);
        brass(b, col.K, 0, col.prog[0], 16, 0.12, { when: 'enemy', a: 2, cut: 800 }, 43);
        // The counter motif alone on a bell, slow or at speed, and a far answer that changes every time.
        if (c.visit % 2) b.fig('bell', 2, aug(col.counter, 2), col.K, 1, 0.24, { nor: 1 }, 0.9);
        else { b.fig('bell', 1, col.counter, col.K, 1, 0.24, { nor: 1 }, 0.9); b.fig('bell', 9, col.counter, col.K, 1, 0.18, { nor: 1, pan: 0.4 }, 0.9); }
        for (let k = 0; k < 2; k++) b.n('glass', 6 + k * 6 + c.r.int(3), col.K(c.r.pick([2, 4, 6])) + 12, 1.5, 0.12, { pan: c.r.range(-0.7, 0.7) });
        groove(b, 0, 4, { taiko: '7...............', kick: c.r.pick(['........5.......', '......4.5.......']) }, 0.4);
        groove(b, 0, 4, col.foeKit, 0.36, { when: 'enemy' });
        if (c.int > 0.4) arp(b, col.K, 12, col.prog[0], 4, 0.25, 0.16, [0, 1, 2, 3], { cut: 1200 });
        return out(b, col);
      },
    },
  };
}

// ---------------------------------------------------------------- bosses

/**
 * One boss per district, each acting out what it does. In the Deeps, Mother Sieve fights at the Grand Lock while it
 * floods, so a pedal under the band climbs a step every pass and her line is cut thinner each time, like her blood.
 * On the Stair the Dowser sees wakes as heat and follows: her line copies the party's riff a beat behind, and the
 * gap closes with each phase. In the flood the Board raids the barge to a march, and a Bailer wades beside the
 * party. On the Brim the Warden fights in Line 4 anger, every other bar of its figure a tritone off, and then Teun
 * takes over: the harmony never touches the tonic chord until the last phase, where it does so once.
 */
const BOSS: Record<Region, Color> = {
  deeps: { ...COLORS.deeps, bpm: 126, kit: { kick: '9.......8.......', snare: '....7..3....7.33' } },
  stair: { ...COLORS.stair, bpm: 120, gain: 1.12 },
  flood: { ...COLORS.flood, bpm: 100, gain: 0.82 },
  brim: { ...COLORS.brim, bpm: 138, gain: 0.82 },
};

// Teun's progression in the Brim key: every chord but the tonic.
const TEUN_PROG: Ch[] = [[5, 'add9'], [6], [3, 'sev'], [4, 'sev']];
const TEUN_B: Ch[] = [[2, 'add9'], [5, 'add9'], [3, 'sev'], [6]];

function bossSection(c: Ctx, which: 'a' | 'b'): Section {
  const region = c.region;
  const col = BOSS[region] ?? BOSS.deeps;
  const K = col.K;
  const b = new B(16, 4, col.bpm);
  const teun = region === 'brim' && c.phase >= 1;
  let prog = which === 'a' ? col.prog : col.progB;
  if (teun) prog = which === 'a' ? TEUN_PROG : TEUN_B;
  const extra: Partial<Section> = { key: K, reflect: col.reflect, bpm: col.bpm };
  band(b, c, col, prog, 1);
  const riff = which === 'b' ? shift(col.riff, 2) : col.riff;
  counterAt(b, col, 4, 0.22, { lay: 0.2, when: 'party' });
  if (c.phase >= 1) brass(b, K, 0, prog[0], 2, 0.26, {}, 50);
  switch (region) {
    case 'deeps': {
      leads(b, c, col, riff, col.foe, 1, Math.max(0.2, 0.9 - c.pass * 0.07));
      // The lock fills: a pedal a step higher every pass, and more water every time.
      const step = c.pass % 8;
      b.n('drone', 0, K(step) - 12, 16, 0.26, { a: 1 });
      for (let k = 0; k < Math.min(8, 2 + c.pass); k++) b.hit(c.r.next() * 16, 'slosh', 0.2, 1.5, { pan: c.r.range(-0.7, 0.7) });
      break;
    }
    case 'stair': {
      motif(b, 'lead', 0, riff, K, col.leadOct, 0.34, { when: 'party' });
      motif(b, 'lead', 8, col.riff, K, col.leadOct, 0.32, { when: 'party' });
      // The Dowser follows the riff on both turns, one beat behind, then half a beat, then a sixteenth.
      const lag = [1, 0.5, 0.25][Math.min(2, c.phase)];
      b.fig('cold', lag, riff, K, col.leadOct - 1, 0.26, { m: 1, cut: 1800 }, 0.9);
      b.fig('cold', 8 + lag, col.riff, K, col.leadOct - 1, 0.24, { m: 1, cut: 1800 }, 0.9);
      // Her eyes sweep the room once a bar.
      for (let k = 0; k < 4; k++) b.hit(k * 4 + 1, 'scan', 0.1, 2.5, { n: 60 + k * 3 });
      break;
    }
    case 'flood':
      leads(b, c, col, riff, col.foe);
      bailer(b, K, 0, 0.42, BAILER, { when: 'party' });
      break;
    case 'brim': {
      if (!teun) {
        // The Warden: the Board's figure in anger, every second bar a tritone away, doubled an octave up.
        leads(b, c, col, riff, col.foe);
        b.fig('cold', 0, col.foe, K, 1, 0.18, { when: 'enemy', cut: 2600 }, 0.8);
        for (const e of b.ev) if (e.when === 'enemy' && (e.v === 'sq' || e.v === 'cold') && Math.floor(e.t / 4) % 2 === 1) { e.n += e.n > 74 ? -6 : 6; e.x = 1; }
        groove(b, 0, 4, { kick: '..5...5...5...5.' }, 0.4);
        break;
      }
      // Teun: the Board's figure on both turns, and the party's riff answering it.
      motif(b, 'lead', 0, riff, K, col.leadOct, 0.32, { when: 'party' });
      for (let k = 0; k < 4; k++) b.fig('sq', k * 4, BOARD, K, 0, 0.26, { m: 1, cut: 2600 }, 0.9);
      if (c.phase >= 2 && !c.st.saidI) {
        // The one time: the figure lands on the tonic, over the tonic chord.
        c.st.saidI = 1;
        b.ev = b.ev.filter((e) => !(e.v === 'sq' && e.t >= 12));
        b.fig('sq', 12, BOARD_I, K, 0, 0.3, { cut: 2600 }, 0.95);
        pad(b, K, 14, [0, 'add9'], 2, 0.24, { a: 0.2 });
        b.n('sub', 14, rootOf(K, [0], 31), 2, 0.34);
        b.hit(14, 'crash', 0.3, 1);
      }
      break;
    }
  }
  lift(b, col);
  return b.out(extra);
}

const boss: TrackDef = {
  kind: 'battle', key: BOSS.deeps.K, reflect: 0.5, bpm: 126, start: 'a', vary: 0.35, wrong: 0.03, echo: 0.4, verb: 0.8, level: 1,
  graph: { a: [['a', 1], ['b', 2]], b: [['a', 2], ['b', 1]], phase: [['a', 1]] },
  secs: {
    a: (c) => bossSection(c, 'a'),
    b: (c) => bossSection(c, 'b'),
    phase: (c) => {
      const col = BOSS[c.region] ?? BOSS.deeps;
      const b = new B(8, 4, col.bpm);
      // Teun's phases never touch the tonic chord, so the Brim's transitions stand on the sixth instead.
      const ch: Ch = c.region === 'brim' && c.phase >= 1 ? TEUN_PROG[0] : col.prog[0];
      b.n('drone', 0, rootOf(col.K, ch, 38), 8, 0.4, { a: 0.3 });
      sub(b, col.K, 0, ch, 8, 0.34);
      brass(b, col.K, 0, ch, 3.5, 0.3, {}, 50);
      b.fig(col.foeVoice, 4, col.foe.slice(0, 4), col.K, col.foeOct, 0.32, { cut: 2000 }, 0.9);
      b.hit(0, 'crash', 0.4, 1);
      b.hit(4, 'roll', 0.34, 4);
      b.hit(4, 'swell', 0.22, 4);
      lift(b, col);
      return b.out({ still: true, key: col.K, reflect: col.reflect, bpm: col.bpm });
    },
  },
};

// ---------------------------------------------------------------- victory and defeat

const D_ION = key(62, MODE.ion);

/** The win sting is in the key of the track it melts back into, so the melt lands on a shared tonic. */
const victory: TrackDef = {
  kind: 'sting', key: D_ION, reflect: 0.5, bpm: 120, start: 'win', vary: 0, wrong: 0, echo: 0.45, level: 1,
  graph: {},
  secs: {
    win: (c) => {
      const lyd = c.ret && c.ret.mode.length === 7 && c.ret.mode[3] === 6;
      const mixo = c.ret && c.ret.mode.length === 7 && c.ret.mode[2] === 4 && c.ret.mode[6] === 10;
      const K = c.ret ? key(c.ret.root, lyd ? MODE.lyd : mixo ? MODE.mix : MODE.ion) : D_ION;
      const b = new B(10, 4, 120);
      // The port's figure at speed, rising past the seventh and leaping over the octave to the fifth above it.
      // Even winning, it never lands on the octave.
      motif(b, 'lead', 0, [[0, 0.25], [2, 0.25], [4, 0.25], [5, 0.25], [6, 0.5], [11, 2.5]], K, 0, 0.4);
      b.fig('arp', 0, [[0, 0.25], [2, 0.25], [4, 0.25], [5, 0.25], [6, 0.5], [9, 2]], K, 1, 0.2, {}, 0.8);
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
  kind: 'scene', key: A_AEO, reflect: 0.75, bpm: 60, start: 'fall', vary: 0, wrong: 0, echo: 0.6, level: 1,
  graph: { fall: [['hold', 1]], hold: [['hold', 1]] },
  secs: {
    fall: () => {
      // The port's figure three times, each a step lower and quieter, over a choir that will not resolve.
      const b = new B(16, 4, 60);
      const prog: Ch[] = [[0, 'add9'], [5, 'add9'], [3, 'sev'], [4, 'sus4']];
      b.n('drone', 0, 45, 16, 0.42, { a: 1 });
      prog.forEach((ch, i) => { choir(b, A_AEO, i * 4, ch, 4, 0.2, 0.5); sub(b, A_AEO, i * 4, ch, 4, 0.3); });
      for (let k = 0; k < 3; k++) port(b, 'lead', k * 4 + 1, A_AEO, 0, 0.32 - k * 0.06, {}, shift(PORT, -k), 0.2);
      return b.out({ still: true });
    },
    hold: () => {
      const b = new B(16, 4, 60);
      b.n('drone', 0, 45, 16, 0.38, { a: 0.5 });
      choir(b, A_AEO, 0, [0, 'add9'], 16, 0.14, 0);
      sub(b, A_AEO, 0, [0], 16, 0.26);
      b.fig('glass', 6, retro(PORT_HEAD), A_AEO, 1, 0.12, { pan: 0.4 }, 0.9);
      return b.out({ still: true });
    },
  },
};

export const BATTLE_TRACKS: Record<string, TrackDef> = { combat: combatTrack(), boss, victory, defeat };

