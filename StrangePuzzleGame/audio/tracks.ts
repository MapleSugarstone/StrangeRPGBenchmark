// The score of Checksum: leitmotifs as scale-degree figures, and every track as a small seeded generator.
// Pitches are MIDI numbers. Times and lengths are in quarter-note beats. See Notes/music.md for the design.
// The puzzles are quiet and turn-based, so every track is slow and sparse and leaves the upper middle to the effects.
import { B, MODE, aug, figLen, fold, inv, key, retro, shift, type Ctx, type Ev, type Fig, type Key, type Section, type TrackDef, type Voice } from './score-core.ts';

// ---------------------------------------------------------------- leitmotifs

/** Tilde: a soft wave up to the leading tone and back down to the second degree. It never lands on the tonic. */
export const TILDE: Fig = [[2, 0.5], [4, 0.5], [6, 1], [5, 0.5], [4, 0.5], [2, 0.5], [3, 0.5], [1, 2]];
/** Tilde patched: the same wave, but at the end the leading tone rises to the tonic an octave up. */
export const TILDE_HOME: Fig = [...TILDE.slice(0, -1), [6, 0.5], [7, 2]];
/** Pilcrow's square half: a repeated tonic and a fifth in even eighths, played on the pulse lead. */
export const PIL_SQ: Fig = [[0, 0.5], [0, 0.5], [4, 1]];
/** Pilcrow's round half: a turn that curls back to the fifth, played on the triangle. */
export const PIL_RO: Fig = [[5, 0.5], [4, 0.25], [3, 0.25], [4, 1]];

/** The office's easy-listening tune, and the same phrase landing home. */
const LOUNGE_A: Fig = [[4, 1.5], [5, 0.5], [4, 1], [2, 1], [3, 1.5], [2, 0.5], [1, 2]];
const LOUNGE_B: Fig = [[4, 1.5], [5, 0.5], [4, 1], [2, 1], [1, 1.5], [0, 0.5], [0, 2]];

/** The sales floor's jingle: it climbs to the octave, drops back like a price, and comes home on the last bar. */
const SALE_A: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [7, 1], [6, 0.5], [4, 1]];
const SALE_B: Fig = [[5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5], [1, 1.5], [null, 0.5]];
const SALE_C: Fig = [[5, 0.5], [4, 0.5], [3, 0.5], [1, 0.5], [0, 1.5], [null, 0.5]];

/** A torn note returns once the mend reaches its threshold. A full mend (nine chips of nine) brings Tilde home. */
const HOME = 0.95;

// ---------------------------------------------------------------- harmony

/** Chord shapes in semitones above the root. */
const SH = {
  m9: [0, 3, 7, 10, 14], madd9: [0, 3, 7, 14], maj9: [0, 4, 7, 11, 14], maj7s11: [0, 4, 7, 11, 18],
  add9: [0, 4, 7, 14], sus4: [0, 5, 7, 10], sus2: [0, 2, 7, 14], maj: [0, 4, 7], min: [0, 3, 7],
  six: [0, 4, 7, 9], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
} as const;
type Shape = keyof typeof SH;
/** A chord: its root in semitones above the key's root, and its shape. Quality comes from the shape, never the key. */
type Ch = readonly [number, Shape];

const rootOf = (K: Key, c: Ch, lo: number) => fold(K.root + c[0], lo);
/** Close voicing above `lo`. Five-note shapes leave their root to the bass. */
function tones(K: Key, c: Ch, lo = 53): number[] {
  const base = rootOf(K, c, lo);
  const all = SH[c[1]].map((s) => base + s);
  return all.length >= 5 ? all.slice(1) : all;
}

// ---------------------------------------------------------------- parts

type X = Partial<Ev>;
const PATS: readonly (readonly number[])[] = [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 1], [0, 1, 2, 3, 4, 3, 2, 1]];

function fig(b: B, v: Voice, t: number, f: Fig, K: Key, oct: number, g: number, x: X = {}, leg = 0.98): number {
  return b.fig(v, t, f, K, oct, g, { m: 1, ...x }, leg);
}

/** Tilde's figure with some notes torn: each torn note sounds at or above a mend threshold and is static below it. */
function torn(b: B, c: Ctx, v: Voice, t: number, f: Fig, K: Key, oct: number, g: number, tear: number, x: X = {}): number {
  for (const [d, len, acc] of f) {
    if (d !== null) {
      const n = K(d) + 12 * oct + (acc ?? 0);
      if (c.r.chance(tear)) {
        const thr = c.r.range(0.15, 0.9);
        b.n(v, t, n, len * 0.98, g, { m: 1, mo: 'tilde', ...x, lay: thr });
        b.hit(t, 'glitch', 0.07, len * 0.8, { top: thr, pan: x.pan ?? 0 });
      } else b.n(v, t, n, len * 0.98, g, { m: 1, mo: 'tilde', ...x });
    }
    t += len;
  }
  return t;
}

/** Pilcrow's whole figure: the square half on the pulse lead, then the round half on the triangle, panned apart. */
function pilcrow(b: B, t: number, K: Key, oct: number, g: number, stretch = 1, x: X = {}): number {
  const end = fig(b, 'cold', t, aug(PIL_SQ, stretch), K, oct, g, { mo: 'pilcrow', ...x }, 0.85);
  return fig(b, 'blip', end, aug(PIL_RO, stretch), K, oct + 1, g * 0.9, { mo: 'pilcrow', pan: 0.45, ...x });
}

function strings(b: B, K: Key, t: number, c: Ch, d: number, g: number, lo = 53, x: X = {}): void {
  for (const n of tones(K, c, lo)) b.n('pad', t, n, d, g, x);
}

function sub(b: B, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}): void {
  b.n('sub', t, rootOf(K, c, 33), d, g, x);
}

function brass(b: B, K: Key, t: number, c: Ch, d: number, g: number, x: X = {}): void {
  for (const n of tones(K, c, 50).slice(0, 4)) b.n('brass', t, n, d, g, x);
}

/** An arpeggio over the chord: `pat` indexes the chord's tones from the bottom, two octaves deep. */
function arpeggio(b: B, K: Key, t: number, c: Ch, d: number, step: number, g: number, pat: readonly number[], x: X = {}, v: Voice = 'arp'): void {
  const base = rootOf(K, c, 57);
  const sh = SH[c[1]];
  const ladder = [...sh, ...sh.map((s) => s + 12)].sort((a, z) => a - z).map((s) => base + s);
  const n = Math.round(d / step);
  for (let k = 0; k < n; k++) b.n(v, t + k * step, ladder[pat[k % pat.length] % ladder.length], step * 0.8, g * (k % 4 === 0 ? 1 : 0.72), x);
}

/** Dead ticks scattered across `beats`, about `n` of them. */
function ticks(b: B, c: Ctx, beats: number, n: number, g: number, x: X = {}): void {
  for (let k = 0; k < n; k++) b.hit(c.r.next() * beats, 'tick', g * c.r.range(0.5, 1), 0.04, { pan: c.r.range(-0.7, 0.7), ...x });
}

// ---------------------------------------------------------------- title: Tilde's theme

const D_ION = key(62, MODE.ion);
const TITLE_A: readonly Ch[] = [[0, 'maj9'], [9, 'm9'], [5, 'maj7s11'], [5, 'madd9']];
const TITLE_B: readonly Ch[] = [[0, 'add9'], [5, 'maj7s11'], [9, 'm9'], [7, 'sus4']];

/** Tilde's theme for the title and the level map. Her wave on a soft bell over a slow music-box arpeggio. */
const title: TrackDef = {
  bpm: 66, start: 'wake', vary: 0.35, wrong: 0.03, echo: 0.55, verb: 0.9, level: 0.7,
  graph: {
    wake: [['theme', 1]],
    theme: [['theme', 2], ['pilcrow', 2], ['hush', 1]],
    pilcrow: [['theme', 2], ['hush', 1]],
    hush: [['theme', 1], ['pilcrow', 1]],
  },
  secs: {
    wake: (c: Ctx) => {
      const b = new B(16, 4, 66);
      b.n('drone', 0, 38, 16, 0.4, { a: 4 });
      b.n('sub', 0, 38, 16, 0.24, { a: 4 });
      b.hit(0, 'hiss', 0.12, 16, { a: 3 });
      torn(b, c, 'glass', 3, aug(TILDE, 2), D_ION, 1, 0.2, 0.4, { pan: 0.3 });
      return b.out({ still: true });
    },
    theme: (c: Ctx) => {
      const b = new B(32, 4, 66);
      const step = c.r.chance(0.3) ? 0.5 : 1;
      b.n('drone', 0, 38, 32, 0.26);
      TITLE_A.forEach((ch, i) => {
        strings(b, D_ION, i * 8, ch, 8, 0.12);
        sub(b, D_ION, i * 8, ch, 8, 0.3);
        arpeggio(b, D_ION, i * 8, ch, 8, step, step < 1 ? 0.08 : 0.1, c.r.pick(PATS), { cut: 900 });
      });
      torn(b, c, 'bell', 2, TILDE, D_ION, 1, 0.3, 0.25);
      // The second statement ends on the second degree until the mend is full, and then it rises home instead.
      const end = torn(b, c, 'bell', 18, TILDE.slice(0, -1), D_ION, 1, 0.28, 0.2);
      fig(b, 'bell', end, TILDE.slice(-1), D_ION, 1, 0.28, { mo: 'tilde', top: HOME });
      fig(b, 'bell', end, TILDE_HOME.slice(-2), D_ION, 1, 0.3, { mo: 'tilde', lay: HOME });
      if (c.r.chance(0.5)) b.n('glass', 27 + c.r.int(3), fold(D_ION(c.r.pick([4, 6, 8])), 79), 2, 0.14, { pan: -0.4 });
      return b.out();
    },
    pilcrow: (c: Ctx) => {
      const b = new B(32, 4, 66);
      b.n('drone', 0, 38, 32, 0.24);
      TITLE_B.forEach((ch, i) => {
        strings(b, D_ION, i * 8, ch, 8, 0.11);
        sub(b, D_ION, i * 8, ch, 8, 0.3);
        arpeggio(b, D_ION, i * 8, ch, 8, 1, 0.1, c.r.pick(PATS), { cut: 1000 });
      });
      // Tilde asks, and Pilcrow answers from the tonic she never reaches.
      torn(b, c, 'bell', 1, TILDE, D_ION, 1, 0.3, 0.25);
      pilcrow(b, 8, D_ION, 0, 0.24);
      torn(b, c, 'bell', 17, shift(TILDE, c.r.pick([0, 2])), D_ION, 1, 0.26, 0.2);
      pilcrow(b, 24, D_ION, 0, 0.22);
      return b.out();
    },
    hush: (c: Ctx) => {
      const b = new B(16, 4, 66);
      b.n('drone', 0, 38, 16, 0.34);
      b.n('drone', 0, 39, 16, 0.12, { a: 5 });
      for (const n of tones(D_ION, [0, 'maj9'], 55).slice(0, 3)) b.n('choir', 1, n, 13, 0.14, { ah: 0 });
      torn(b, c, 'glass', 6, TILDE.slice(0, 3), D_ION, 1, 0.16, 0.6, { pan: -0.3 });
      ticks(b, c, 16, 6, 0.1);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 0: the Lobby

const BB_ION = key(58, MODE.ion);
const LOBBY: readonly Ch[] = [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'sus4']];

/** The office piano: ratio-one bells, a little flat, never quite together. */
function piano(b: B, c: Ctx, t: number, ch: Ch, g: number, sag: number, K: Key = BB_ION): void {
  tones(K, ch, 53).slice(0, 4).forEach((n, i) => b.n('bell', t + i * 0.04, n, 2.4, g * (i ? 0.8 : 1), { ratio: 1, det: sag + c.r.range(-12, 4) }));
  if (c.r.chance(0.5)) tones(K, ch, 53).slice(2, 4).forEach((n) => b.n('bell', t + 2.5, n, 1.2, g * 0.5, { ratio: 1, det: sag - 6 }));
}

/** A slow bossa bass on the sine: root, a fifth below, and the fifth held. */
function bossa(b: B, t: number, ch: Ch, g: number): void {
  const r = rootOf(BB_ION, ch, 36);
  b.n('sub', t, r, 1.4, g);
  b.n('sub', t + 1.5, r - 5, 0.4, g * 0.8);
  b.n('sub', t + 2, r - 5, 1.8, g * 0.9);
}

/** One bar of the lobby's band: piano, bass, and a brush on two and four. */
function lobbyBar(b: B, c: Ctx, t: number, ch: Ch, sag = 0, bass = true): void {
  piano(b, c, t, ch, 0.12, sag);
  if (bass) bossa(b, t, ch, 0.34);
  b.hit(t + 1, 'tick', 0.07, 0.05, { pan: 0.2 });
  b.hit(t + 3, 'tick', 0.06, 0.05, { pan: 0.2 });
}

/** The Lobby: dead-office elevator music. Sparse, slightly flat, and the tape drags while the call is on hold. */
const area0: TrackDef = {
  bpm: 72, start: 'ding', vary: 0.45, wrong: 0.05, echo: 0.35, verb: 0.6, wobble: 7, level: 0.7,
  graph: {
    ding: [['lounge', 1]],
    lounge: [['lounge', 1], ['pilcrow', 2], ['hold', 1]],
    pilcrow: [['lounge', 2], ['hold', 1]],
    hold: [['lounge', 2], ['pilcrow', 1], ['ding', 0.4]],
  },
  secs: {
    ding: () => {
      const b = new B(8, 4, 72);
      b.n('glass', 0, 86, 1.5, 0.18, { ratio: 3 });
      b.n('glass', 1, 82, 3, 0.16, { ratio: 3 });
      b.hit(0, 'hiss', 0.08, 8, { a: 2 });
      tones(BB_ION, LOBBY[0], 53).slice(0, 4).forEach((n, i) => b.n('bell', 4 + i * 0.05, n, 3.5, 0.1, { ratio: 1, det: -8 }));
      b.n('sub', 4, rootOf(BB_ION, LOBBY[0], 36), 3.5, 0.3);
      return b.out({ still: true });
    },
    lounge: (c: Ctx) => {
      const b = new B(32, 4, 72);
      for (let i = 0; i < 8; i++) lobbyBar(b, c, i * 4, LOBBY[i % 4]);
      fig(b, 'lead', 0, LOUNGE_A, BB_ION, 0, 0.2, { cut: 1100 });
      fig(b, 'lead', 8, LOUNGE_B, BB_ION, 0, 0.2, { cut: 1100 });
      // The second half has no tune most of the time. Sometimes a far bell remembers its first notes.
      if (c.r.chance(0.4)) fig(b, 'glass', 18, LOUNGE_A.slice(0, 3), BB_ION, 1, 0.12, { pan: -0.4, det: -10 });
      return b.out();
    },
    pilcrow: (c: Ctx) => {
      const b = new B(32, 4, 72);
      for (let i = 0; i < 8; i++) lobbyBar(b, c, i * 4, LOBBY[i % 4]);
      // Pilcrow's figure, slowed into easy listening.
      pilcrow(b, 4, BB_ION, 0, 0.2, 2);
      if (c.r.chance(0.6)) pilcrow(b, 20, BB_ION, 0, 0.18, 2, { det: -8 });
      else fig(b, 'lead', 20, LOUNGE_B.slice(0, 4), BB_ION, 0, 0.18, { cut: 1100 });
      return b.out();
    },
    hold: (c: Ctx) => {
      const b = new B(16, 4, 66);
      for (let i = 0; i < 4; i++) lobbyBar(b, c, i * 4, LOBBY[i], -22, i === 0 || i === 3);
      for (let i = 0; i < 4; i++) b.n('glass', i * 4 + 0.5, fold(BB_ION(4), 74), 0.5, 0.08, { pan: 0.5 });
      b.hit(0, 'hiss', 0.1, 16, { a: 1 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 1: the Sales Floor

const C_HMIN = key(60, MODE.hmin);
const I: Ch = [0, 'min'], IV: Ch = [5, 'min'], V: Ch = [7, 'maj'], VI: Ch = [8, 'maj'];
/** The jingle's harmony as [start, length, chord]. */
const SALE_CH: readonly (readonly [number, number, Ch])[] = [[0, 4, I], [4, 4, V], [8, 4, I], [12, 2, IV], [14, 2, I]];

/** Oom-pah: the root and a low fifth on one and three, the chord's third on two and its fifth on four. */
function bounce(b: B, t: number, ch: Ch, d: number, g: number): void {
  const r = rootOf(C_HMIN, ch, 36);
  const [, third, fifth] = tones(C_HMIN, ch, 60);
  for (let k = 0; k < d; k += 2) {
    b.n('bass', t + k, k % 4 === 0 ? r : r - 5, 0.6, g, { cut: 380 });
    b.n('arp', t + k + 1, k % 4 === 0 ? third : fifth, 0.35, g * 0.6, { cut: 1300 });
  }
}

/** Plays a jingle figure. The note at `stick` skips like a scratched disc, repeating in sixteenths. */
function jingleLine(b: B, v: Voice, t: number, f: Fig, oct: number, g: number, stick = -1): number {
  f.forEach(([d, len], i) => {
    if (d !== null) {
      const n = C_HMIN(d) + 12 * oct;
      if (i === stick && len >= 1) {
        for (let k = 0; k < len / 0.25; k++) b.n(v, t + k * 0.25, n, 0.18, g * (1 - k * 0.12), { m: 1 });
        b.hit(t + len - 0.25, 'tick', 0.06, 0.05);
      } else b.n(v, t, n, len * 0.9, g, { m: 1 });
    }
    t += len;
  });
  return t;
}

/** The Sales Floor: a bouncy sales jingle in a minor key that sticks, cuts out, and closes for the night. */
const area1: TrackDef = {
  bpm: 90, start: 'aisle', vary: 0.45, wrong: 0.08, echo: 0.3, verb: 0.5, wobble: 4, level: 0.62,
  graph: {
    pitch: [['pitch', 2], ['skip', 1], ['aisle', 2]],
    skip: [['pitch', 1], ['aisle', 1]],
    aisle: [['pitch', 2], ['closing', 1]],
    closing: [['aisle', 1], ['pitch', 1]],
  },
  secs: {
    pitch: (c: Ctx) => {
      const b = new B(16, 4, 90);
      for (const [t, d, ch] of SALE_CH) bounce(b, t, ch, d, 0.27);
      for (let bar = 0; bar < 4; bar++) b.hit(bar * 4, 'kick', 0.14, 0.25);
      const v: Voice = c.visit % 3 === 2 ? 'bell' : 'cold';
      // At most one stutter a pass, in the first or the third bar.
      const stick = c.r.chance(0.4) ? c.r.pick([3, 5]) : -1;
      const late = c.r.chance(0.5);
      let t = jingleLine(b, v, 0, SALE_A, 0, 0.31, late ? -1 : stick);
      t = jingleLine(b, v, t, SALE_B, 0, 0.29);
      t = jingleLine(b, v, t, SALE_A, 0, 0.31, late ? stick : -1);
      // Sometimes the jingle never gets its last note.
      jingleLine(b, v, t, c.r.chance(0.3) ? SALE_C.slice(0, 4) : SALE_C, 0, 0.29);
      return b.out();
    },
    skip: (c: Ctx) => {
      const b = new B(16, 4, 90);
      // The disc sticks on the first half bar three times, cuts out, and then the jingle picks up again.
      bounce(b, 0, I, 2, 0.27);
      b.hit(0, 'kick', 0.14, 0.25);
      jingleLine(b, 'cold', 0, SALE_A.slice(0, 3), 0, 0.31);
      b.n('cold', 1.5, C_HMIN(7), 0.45, 0.31, { m: 1 });
      const first = b.ev.slice();
      for (const e of first) b.ev.push({ ...e, t: e.t + 2 }, { ...e, t: e.t + 4, det: (e.det ?? 0) - 20 });
      b.hit(6, 'glitch', 0.12, 0.5);
      for (const [t, d, ch] of SALE_CH.slice(2)) bounce(b, t, ch, d, 0.27);
      b.hit(8, 'kick', 0.14, 0.25);
      b.hit(12, 'kick', 0.14, 0.25);
      const t = jingleLine(b, 'cold', 8, SALE_A, 0, 0.31, c.r.chance(0.3) ? 3 : -1);
      jingleLine(b, 'cold', t, SALE_C, 0, 0.29);
      return b.out();
    },
    aisle: (c: Ctx) => {
      const b = new B(16, 4, 90);
      [I, VI, IV, V].forEach((ch, bar) => {
        const r = rootOf(C_HMIN, ch, 36);
        b.n('bass', bar * 4, r, 1.5, 0.3, { cut: 340 });
        b.n('bass', bar * 4 + 2, r - 5, 1, 0.24, { cut: 340 });
        for (const n of tones(C_HMIN, ch, 60).slice(1, 3)) b.n('arp', bar * 4 + 3, n, 0.35, 0.09, { cut: 1200 });
      });
      // Pilcrow walks the aisle between the displays.
      pilcrow(b, 2, C_HMIN, 0, 0.22);
      if (c.r.chance(0.7)) pilcrow(b, 10, C_HMIN, 0, 0.2);
      else b.n('glass', 11, fold(C_HMIN(6), 74), 3, 0.12, { pan: -0.5 });
      return b.out();
    },
    closing: (c: Ctx) => {
      const b = new B(16, 4, 90);
      b.n('drone', 0, 36, 16, 0.3, { a: 2 });
      b.n('drone', 4, 37, 12, 0.1, { a: 4 });
      b.n('sub', 0, 36, 8, 0.24);
      b.n('sub', 8, rootOf(C_HMIN, IV, 33), 4, 0.22);
      b.n('sub', 12, 36, 4, 0.24);
      // Closing time: the jingle at half speed on the cold bell, with nothing under it.
      fig(b, 'glass', 0, aug(SALE_A, 2), C_HMIN, 1, 0.16, { pan: 0.3 });
      fig(b, 'glass', 8, aug(SALE_C, 2), C_HMIN, 1, 0.15, { pan: 0.3 });
      ticks(b, c, 16, 4, 0.08);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 2: the Back Rooms

const CS_PHR = key(61, MODE.phr);
const BACK: readonly Ch[] = [[0, 'madd9'], [1, 'maj7s11'], [0, 'madd9'], [10, 'sus2']];

/** The Back Rooms: a low drone, a slow pulse, a hum a half step off, and Tilde buried under the hiss. */
const area2: TrackDef = {
  bpm: 54, start: 'dark', vary: 0.5, wrong: 0.06, echo: 0.5, verb: 1, wobble: 5, level: 0.75,
  graph: {
    dark: [['buried', 2], ['hum', 1], ['steps', 1]],
    buried: [['dark', 1], ['hum', 1], ['steps', 1]],
    hum: [['dark', 1], ['buried', 1], ['steps', 1]],
    steps: [['dark', 1], ['buried', 1]],
  },
  secs: {
    dark: (c: Ctx) => {
      const b = new B(16, 4, 54);
      b.n('drone', 0, 37, 16, 0.42);
      b.n('sub', 0, 37, 16, 0.2, { a: 3 });
      b.hit(0, 'hiss', 0.1, 16, { a: 3 });
      for (let bar = 0; bar < 4; bar += 2) {
        b.hit(bar * 4, 'taiko', 0.1, 0.5);
        b.hit(bar * 4 + 0.75, 'taiko', 0.07, 0.5);
      }
      ticks(b, c, 16, 6, 0.1);
      for (let k = 0; k < 2; k++) {
        b.n('glass', 4 + k * 6 + c.r.int(3), fold(CS_PHR(c.r.pick([0, 1, 4, 6])), 76), 3, 0.13, { pan: c.r.range(-0.7, 0.7), det: -15 });
      }
      return b.out();
    },
    buried: (c: Ctx) => {
      const b = new B(32, 4, 54);
      b.n('drone', 0, 37, 32, 0.36);
      BACK.forEach((ch, i) => {
        strings(b, CS_PHR, i * 8, ch, 8, 0.1, 49);
        sub(b, CS_PHR, i * 8, ch, 8, 0.24);
      });
      b.hit(0, 'hiss', 0.12, 32, { a: 4 });
      // Tilde's wave on the low choir at half speed, inside the strings and under the hiss.
      torn(b, c, 'choir', 4 + c.r.int(3) * 2, aug(TILDE, 2), CS_PHR, -1, 0.26, 0.4, { a: 0.25, ah: 0 });
      ticks(b, c, 32, 8, 0.1);
      return b.out();
    },
    hum: (c: Ctx) => {
      const b = new B(16, 4, 54);
      b.n('drone', 0, 37, 16, 0.34);
      b.n('drone', 0, 38, 16, 0.14, { a: 5 });
      b.hit(4 + c.r.int(4), 'scan', 0.1, 6, { n: 61 });
      ticks(b, c, 16, 5, 0.1);
      // Pilcrow's square half, low and alone. The round half answers late and far away.
      fig(b, 'cold', 2, PIL_SQ, CS_PHR, -1, 0.2, { mo: 'pilcrow' }, 0.85);
      fig(b, 'glass', 5.5, PIL_RO, CS_PHR, 1, 0.12, { mo: 'pilcrow', pan: 0.6, det: -12 });
      return b.out();
    },
    steps: (c: Ctx) => {
      const b = new B(16, 4, 54);
      b.n('drone', 0, 37, 16, 0.34);
      for (let k = 0; k < 8; k++) b.n('bass', k * 2, k % 4 === 3 ? 38 : 37, 1.2, 0.22, { cut: 220 });
      strings(b, CS_PHR, 8, BACK[1], 8, 0.09, 49);
      pilcrow(b, 4, CS_PHR, 0, 0.18);
      torn(b, c, 'glass', 10, TILDE.slice(0, 3), CS_PHR, 1, 0.12, 0.5, { pan: -0.5, det: -10 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 3: the Display Hall

const E_LYD = key(64, MODE.lyd);
const HALL: readonly Ch[] = [[0, 'maj7s11'], [2, 'add9'], [9, 'm9'], [7, 'maj9']];
/** The showroom's demo loop: up to the octave through the raised fourth, and back to the fifth. */
const DEMO: Fig = [[0, 0.5], [4, 0.5], [3, 0.5], [4, 0.5], [7, 1.5], [6, 0.5], [4, 2]];

/** A wall of screens: the root hums, and the fifth above it hums quieter. */
function screens(b: B, beats: number, g: number): void {
  b.n('drone', 0, 40, beats, g);
  b.n('drone', 0, 47, beats, g * 0.4, { a: 3 });
}

/** The Display Hall: an electronics showroom. Screens hum, a cold bell runs the screen saver, and the demo loop plays. */
const area3: TrackDef = {
  bpm: 76, start: 'standby', vary: 0.4, wrong: 0.04, echo: 0.55, verb: 0.9, wobble: 3, level: 0.7,
  graph: {
    standby: [['showroom', 2], ['demo', 1]],
    showroom: [['showroom', 1], ['demo', 2], ['standby', 1]],
    demo: [['showroom', 2], ['static', 1]],
    static: [['showroom', 1], ['standby', 1]],
  },
  secs: {
    standby: (c: Ctx) => {
      const b = new B(16, 4, 76);
      screens(b, 16, 0.3);
      b.hit(0, 'hiss', 0.08, 16, { a: 2 });
      // A standby light, one blink every two beats.
      for (let k = 0; k < 8; k++) b.n('blip', k * 2 + 1, 83, 0.15, 0.07, { pan: 0.4 });
      if (c.r.chance(0.6)) b.n('glass', 9 + c.r.int(4), fold(E_LYD(c.r.pick([3, 6, 8])), 79), 3, 0.12, { pan: -0.4 });
      return b.out();
    },
    showroom: (c: Ctx) => {
      const b = new B(32, 4, 76);
      screens(b, 32, 0.24);
      HALL.forEach((ch, i) => {
        strings(b, E_LYD, i * 8, ch, 8, 0.1);
        sub(b, E_LYD, i * 8, ch, 8, 0.26);
        arpeggio(b, E_LYD, i * 8, ch, 8, 1, 0.09, c.r.pick(PATS), {}, 'glass');
      });
      fig(b, 'bell', 2, DEMO, E_LYD, 1, 0.26);
      fig(b, 'bell', 18, c.r.chance(0.5) ? DEMO : shift(DEMO, 2), E_LYD, 1, 0.24);
      return b.out();
    },
    demo: (c: Ctx) => {
      const b = new B(32, 4, 76);
      screens(b, 32, 0.24);
      HALL.forEach((ch, i) => {
        strings(b, E_LYD, i * 8, ch, 8, 0.1);
        sub(b, E_LYD, i * 8, ch, 8, 0.26);
        arpeggio(b, E_LYD, i * 8, ch, 8, 1, 0.08, c.r.pick(PATS), {}, 'glass');
      });
      // Pilcrow walks past the demo screens.
      pilcrow(b, 4, E_LYD, 0, 0.2);
      fig(b, 'bell', 12, DEMO.slice(0, 5), E_LYD, 1, 0.22);
      pilcrow(b, 20, E_LYD, 0, 0.18, c.r.chance(0.5) ? 2 : 1);
      return b.out();
    },
    static: (c: Ctx) => {
      const b = new B(16, 4, 76);
      screens(b, 16, 0.26);
      b.hit(0, 'hiss', 0.14, 16, { a: 0.5 });
      // Every screen shows the same static, and Tilde flickers through it.
      torn(b, c, 'glass', 2, TILDE, E_LYD, 1, 0.16, 0.5, { pan: 0.3 });
      ticks(b, c, 16, 6, 0.08);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 4: Loss Prevention

const FS_AEO = key(66, MODE.aeo);
const GUARD: readonly Ch[] = [[0, 'm9'], [8, 'maj7s11'], [5, 'm9'], [7, 'min']];
/** The camera: a half step up and back, a lens panning across the room and returning. */
const WATCH: Fig = [[4, 1], [5, 1], [4, 2]];

/** The monitor beeps once a bar, on the same note. */
function monitor(b: B, beats: number, g: number): void {
  for (let t = 0; t < beats; t += 4) b.n('blip', t, 73, 0.12, g, { pan: -0.4 });
}

/** Loss Prevention: security. A low drone with a tritone under it, a monitor's beep, cameras panning and sweeping. */
const area4: TrackDef = {
  bpm: 70, start: 'watch', vary: 0.45, wrong: 0.05, echo: 0.5, verb: 0.9, wobble: 3, level: 0.72,
  graph: {
    watch: [['watch', 1], ['patrol', 2], ['camera', 1]],
    patrol: [['watch', 2], ['camera', 1]],
    camera: [['watch', 1], ['patrol', 1]],
  },
  secs: {
    watch: (c: Ctx) => {
      const b = new B(32, 4, 70);
      b.n('drone', 0, 42, 32, 0.3);
      b.n('drone', 0, 48, 32, 0.08, { a: 6 });
      GUARD.forEach((ch, i) => {
        strings(b, FS_AEO, i * 8, ch, 8, 0.08);
        sub(b, FS_AEO, i * 8, ch, 8, 0.26);
      });
      monitor(b, 32, 0.07);
      fig(b, 'cold', 6, WATCH, FS_AEO, -1, 0.18);
      fig(b, 'cold', 22, WATCH, FS_AEO, -1, 0.16);
      b.hit(12 + c.r.int(8), 'scan', 0.09, 6, { n: 66 });
      return b.out();
    },
    patrol: (c: Ctx) => {
      const b = new B(32, 4, 70);
      b.n('drone', 0, 42, 32, 0.28);
      GUARD.forEach((ch, i) => {
        const r = rootOf(FS_AEO, ch, 36);
        b.n('bass', i * 8, r, 1.5, 0.26, { cut: 300 });
        b.n('bass', i * 8 + 3, r, 1, 0.2, { cut: 300 });
        sub(b, FS_AEO, i * 8, ch, 8, 0.2);
      });
      monitor(b, 32, 0.06);
      // Pilcrow sneaks past: every note held back, and a long pause between the two halves.
      const end = fig(b, 'cold', 4, aug(PIL_SQ, 1.5), FS_AEO, 0, 0.18, { mo: 'pilcrow' }, 0.6);
      fig(b, 'blip', end + 2, aug(PIL_RO, 1.5), FS_AEO, 1, 0.16, { mo: 'pilcrow', pan: 0.45 });
      ticks(b, c, 32, 6, 0.07);
      return b.out();
    },
    camera: (c: Ctx) => {
      const b = new B(16, 4, 70);
      b.n('drone', 0, 42, 16, 0.3);
      b.n('drone', 0, 48, 16, 0.1, { a: 4 });
      // The servo turns in three quick ticks, then the lens sweeps the room.
      for (const t of [1, 7, 13]) for (let k = 0; k < 3; k++) b.hit(t + k * 0.25, 'tick', 0.08, 0.04, { pan: 0.5 });
      b.hit(2, 'scan', 0.1, 4, { n: 66 });
      b.hit(8, 'scan', 0.09, 4, { n: 61 });
      for (const n of tones(FS_AEO, [0, 'm9'], 55).slice(0, 2)) b.n('choir', 0, n, 14, 0.12, { ah: 0 });
      b.n('glass', 11 + c.r.int(3), fold(FS_AEO(c.r.pick([1, 4, 5])), 78), 3, 0.12, { pan: -0.5, det: -10 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 5: Shipping

const D_DOR = key(62, MODE.dor);
const DOCK: readonly Ch[] = [[0, 'm9'], [5, 'add9'], [10, 'add9'], [7, 'min']];
/** A bar of seven eighths, counted two, two, three. */
const BAR7 = 3.5;

/** One bar of the line: bass on each count, a soft kick on one, and clacks on the long count. */
function line(b: B, t: number, ch: Ch, g: number): void {
  const r = rootOf(D_DOR, ch, 36);
  b.n('bass', t, r, 0.8, g, { cut: 320 });
  b.n('bass', t + 1, r, 0.8, g * 0.8, { cut: 320 });
  b.n('bass', t + 2, r + 7, 1.2, g * 0.9, { cut: 320 });
  b.hit(t, 'kick', 0.12, 0.25);
  b.hit(t + 2, 'tick', 0.07, 0.05, { pan: 0.3 });
  b.hit(t + 3, 'tick', 0.05, 0.05, { pan: -0.3 });
}

/** A forklift backing up somewhere in the aisles. */
function beeper(b: B, t: number, n: number): void {
  for (let k = 0; k < n; k++) b.n('blip', t + k, 81, 0.4, 0.05, { pan: -0.6 });
}

/** Shipping: a warehouse in seven. The line runs, crates pass, a forklift beeps, and the belts stop for breaks. */
const area5: TrackDef = {
  bpm: 84, start: 'line', vary: 0.4, wrong: 0.04, echo: 0.3, verb: 0.55, wobble: 3, level: 0.68,
  graph: {
    line: [['line', 1], ['crate', 2], ['break', 1]],
    crate: [['line', 2], ['break', 1]],
    break: [['line', 1], ['crate', 1]],
  },
  secs: {
    line: (c: Ctx) => {
      const b = new B(8 * BAR7, BAR7, 84);
      for (let i = 0; i < 8; i++) {
        const ch = DOCK[Math.floor(i / 2)], [, mid, top] = tones(D_DOR, ch, 60);
        line(b, i * BAR7, ch, 0.3);
        if (i % 2 === 0) strings(b, D_DOR, i * BAR7, ch, BAR7 * 2, 0.08);
        b.n('arp', i * BAR7 + 0.5, mid, 0.3, 0.08, { cut: 900 });
        b.n('arp', i * BAR7 + 1.5, top, 0.3, 0.07, { cut: 900 });
      }
      if (c.r.chance(0.5)) beeper(b, 4 + c.r.int(4) * BAR7, 4);
      return b.out();
    },
    crate: (c: Ctx) => {
      const b = new B(8 * BAR7, BAR7, 84);
      for (let i = 0; i < 8; i++) {
        const ch = DOCK[Math.floor(i / 2)];
        line(b, i * BAR7, ch, 0.28);
        if (i % 2 === 0) strings(b, D_DOR, i * BAR7, ch, BAR7 * 2, 0.08);
      }
      // Pilcrow's figure is four beats long over bars of three and a half, so it lands somewhere new each time.
      pilcrow(b, BAR7, D_DOR, 0, 0.2);
      pilcrow(b, BAR7 * 4 + (c.r.chance(0.5) ? 1 : 0.5), D_DOR, 0, 0.18);
      return b.out();
    },
    break: (c: Ctx) => {
      const b = new B(4 * BAR7, BAR7, 84);
      b.n('drone', 0, 38, 4 * BAR7, 0.3, { a: 1 });
      b.n('sub', 0, 38, 4 * BAR7, 0.2, { a: 1 });
      b.hit(0, 'hiss', 0.08, 4 * BAR7, { a: 1 });
      beeper(b, 1, 6);
      ticks(b, c, 4 * BAR7, 4, 0.08);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 6: Head Office

const EB_ION = key(63, MODE.ion);
const OFFICE: readonly Ch[] = [[0, 'maj9'], [5, 'maj7s11'], [9, 'm9'], [7, 'sus4']];
/** The company fanfare: a leap to the octave that steps back down to the fifth. */
const FANFARE: Fig = [[0, 1], [4, 0.5], [4, 0.5], [7, 2], [6, 0.5], [5, 0.5], [4, 2]];

/** Head Office: corporate and grand. Brass swells and the company fanfare, and a sour chord a half step above. */
const area6: TrackDef = {
  bpm: 72, start: 'atrium', vary: 0.35, wrong: 0.05, echo: 0.45, verb: 1, wobble: 4, level: 0.7,
  graph: {
    atrium: [['atrium', 1], ['memo', 2], ['sour', 1]],
    memo: [['atrium', 2], ['sour', 1]],
    sour: [['atrium', 1], ['memo', 1]],
  },
  secs: {
    atrium: (c: Ctx) => {
      const b = new B(32, 4, 72);
      b.n('drone', 0, 39, 32, 0.28);
      const cs = c.visit % 2 ? [...OFFICE.slice(2), ...OFFICE.slice(0, 2)] : OFFICE;
      cs.forEach((ch, i) => {
        brass(b, EB_ION, i * 8, ch, 7, 0.12, { a: c.r.pick([0.5, 0.8, 1.2]) });
        sub(b, EB_ION, i * 8, ch, 8, 0.28);
        strings(b, EB_ION, i * 8, ch, 8, 0.08);
      });
      if (c.r.chance(0.5)) b.n('glass', 13 + c.r.int(4), fold(EB_ION(c.r.pick([2, 4, 6])), 79), 3, 0.1, { pan: 0.4 });
      // The company fanfare is never ornamented or moved an octave. The second may start a fourth lower, and some days
      // its last note sags flat.
      const fixed = { m: undefined, cut: 1400 };
      fig(b, 'lead', c.r.pick([2, 4, 5]), FANFARE, EB_ION, 0, 0.22, fixed);
      const lift = c.r.pick([0, 0, -3]), sour = c.r.chance(0.4), again = shift(FANFARE, lift), head = again.slice(0, -1);
      fig(b, 'lead', 20, sour ? head : again, EB_ION, 0, 0.2, fixed);
      if (sour) b.n('lead', 20 + figLen(head), EB_ION(4 + lift), 2, 0.2, { ...fixed, bend: -1 });
      return b.out();
    },
    memo: (c: Ctx) => {
      const b = new B(32, 4, 72);
      b.n('drone', 0, 39, 32, 0.24);
      // The Lobby's office piano, upstairs, while Pilcrow crosses the carpet.
      for (let i = 0; i < 8; i++) piano(b, c, i * 4, OFFICE[Math.floor(i / 2)], 0.1, 0, EB_ION);
      OFFICE.forEach((ch, i) => sub(b, EB_ION, i * 8, ch, 8, 0.26));
      pilcrow(b, 4, EB_ION, 0, 0.2);
      fig(b, 'bell', 14, FANFARE.slice(0, 4), EB_ION, 1, 0.16, { pan: -0.3 });
      pilcrow(b, 20, EB_ION, 0, 0.18, c.r.chance(0.4) ? 2 : 1);
      return b.out();
    },
    sour: (c: Ctx) => {
      const b = new B(16, 4, 72);
      b.n('drone', 0, 39, 16, 0.3);
      // The chord a half step above the key, held under the company's own fanfare on the cold bell.
      brass(b, EB_ION, 0, [1, 'maj'], 8, 0.1, { a: 1.5 });
      brass(b, EB_ION, 8, [0, 'maj9'], 8, 0.1, { a: 1.5 });
      fig(b, 'glass', 2, aug(FANFARE.slice(0, 4), 2), EB_ION, 1, 0.12, { det: -20, pan: 0.4 });
      ticks(b, c, 16, 4, 0.06);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 7: Overtime

const AB_ION = key(68, MODE.ion);
const LATE: readonly Ch[] = [[0, 'maj9'], [9, 'm9'], [5, 'maj7s11'], [7, 'sus4']];
/** Tilde nearly home: her wave climbs back to the leading tone and holds it, one step short of the tonic. */
const TILDE_NEAR: Fig = [...TILDE.slice(0, -1), [6, 2.5]];

/** Overtime: the office after hours. A clock, lights on a timer, and Tilde one step from home. */
const area7: TrackDef = {
  bpm: 58, start: 'clock', vary: 0.35, wrong: 0.03, echo: 0.6, verb: 1, wobble: 4, level: 0.72,
  graph: {
    clock: [['desk', 2], ['timer', 1]],
    desk: [['desk', 1], ['clock', 1], ['timer', 1]],
    timer: [['desk', 2], ['clock', 1]],
  },
  secs: {
    clock: (c: Ctx) => {
      const b = new B(16, 4, 58);
      b.n('drone', 0, 44, 16, 0.32, { a: 3 });
      b.hit(0, 'hiss', 0.07, 16, { a: 2 });
      // The office clock, once a beat.
      for (let k = 0; k < 16; k++) b.hit(k, 'tick', k % 4 ? 0.035 : 0.05, 0.04, { pan: 0.5 });
      for (const n of tones(AB_ION, c.r.pick(LATE), 55).slice(0, 3)) b.n('choir', 2, n, 12, 0.1, { ah: 0 });
      pilcrow(b, c.r.pick([5, 6, 7]), AB_ION, 0, 0.16);
      if (c.r.chance(0.6)) b.n('glass', 12 + c.r.int(3), fold(AB_ION(c.r.pick([2, 4, 6])), 76), 3, 0.1, { pan: -0.4 });
      return b.out();
    },
    desk: (c: Ctx) => {
      const b = new B(32, 4, 58);
      b.n('drone', 0, 44, 32, 0.26);
      LATE.forEach((ch, i) => {
        strings(b, AB_ION, i * 8, ch, 8, 0.1);
        sub(b, AB_ION, i * 8, ch, 8, 0.26);
        arpeggio(b, AB_ION, i * 8, ch, 8, 1, 0.08, c.r.pick(PATS), { cut: 900 });
      });
      // Hardly any static is left in Tilde, and her wave ends one step short of home.
      torn(b, c, 'bell', 2, TILDE_NEAR, AB_ION, 0, 0.28, 0.12);
      pilcrow(b, 18, AB_ION, 0, 0.2, c.r.chance(0.5) ? 2 : 1);
      if (c.r.chance(0.5)) b.n('glass', 27 + c.r.int(3), fold(AB_ION(c.r.pick([4, 6, 8])), 79), 3, 0.12, { pan: -0.4 });
      return b.out();
    },
    timer: (c: Ctx) => {
      const b = new B(16, 4, 58);
      const ch = c.r.pick(LATE);
      b.n('drone', 0, 44, 16, 0.28);
      strings(b, AB_ION, 0, ch, 8, 0.1);
      sub(b, AB_ION, 0, ch, 8, 0.24);
      fig(b, 'bell', 1, TILDE.slice(0, 3), AB_ION, 0, 0.22, { mo: 'tilde' });
      // The lights' timer runs out: a click, a bar of only the drone, and the lights come back on a soft swell.
      b.hit(8, 'tick', 0.12, 0.05);
      b.hit(11, 'swell', 0.05, 1);
      strings(b, AB_ION, 12, LATE[0], 4, 0.1);
      b.n('glass', 12 + c.r.pick([0, 0.5, 1]), fold(AB_ION(c.r.pick([0, 2, 4])), 76), 3, 0.12, { pan: 0.3 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 8: the Food Court

const F_ION = key(65, MODE.ion);
/** The stall's changes, one a bar: the tonic with an added sixth, then sevenths on the sixth, second, and fifth degrees. */
const STALL: readonly Ch[] = [[0, 'six'], [9, 'm7'], [2, 'm7'], [7, 'dom7']];
/** The food stall's jingle: a call that hops round the fifth and lands on the third, and an answer left open on the fifth chord. */
const STALL_A: Fig = [[4, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [2, 1], [0, 0.5], [2, 0.5], [5, 1.5], [4, 0.5], [2, 1], [null, 1]];
const STALL_B: Fig = [[3, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [3, 1], [5, 0.5], [4, 0.5], [1, 0.5], [2, 0.5], [1, 0.5], [-1, 0.5], [1, 1.5], [null, 0.5]];
/** The held third of STALL_A, which slides up into its pitch from a half step under it. */
const SMEAR = 4;
/** A slow lick over the cold grills. Its second note slides into the third the same way. */
const LICK: Fig = [[4, 1], [2, 1.5], [1, 0.5], [0, 3]];
/** The microwave's turntable: three chords, one a bar, coming round the way a bit comes round the color wheel. */
const TURN: readonly Ch[] = [[0, 'maj9'], [5, 'maj7s11'], [9, 'm9']];

/** Swung time in beats: the second eighth of each beat lands two thirds of the way through it. */
function sw(t: number): number {
  const w = Math.floor(t + 1e-6), f = Math.max(0, t - w);
  return w + (f <= 0.5 ? f * (4 / 3) : 2 / 3 + (f - 0.5) * (2 / 3));
}

/**
 * Plays a figure in swung eighths and returns its straight end time. The note at `smear` starts a half step flat and
 * slides up into its pitch, and each note sags `sag` cents further than the one before.
 */
function swing(b: B, v: Voice, t: number, f: Fig, K: Key, oct: number, g: number, x: X = {}, smear = -1, sag = 0, leg = 0.9): number {
  f.forEach(([d, len, acc], i) => {
    if (d !== null) {
      const at = sw(t), n = K(d) + 12 * oct + (acc ?? 0);
      const y: X = { m: 1, ...x };
      if (sag) y.det = (x.det ?? 0) - sag * i;
      if (i === smear) y.bend = 1;
      b.n(v, at, i === smear ? n - 1 : n, (sw(t + len) - at) * leg, g, y);
    }
    t += len;
  });
  return t;
}

/** Pilcrow's whole figure in swung eighths, the square half on the pulse lead and the round half on the triangle. */
function pilcrowSwung(b: B, t: number, K: Key, oct: number, g: number, x: X = {}): number {
  const end = swing(b, 'cold', t, PIL_SQ, K, oct, g, { mo: 'pilcrow', ...x }, -1, 0, 0.85);
  return swing(b, 'blip', end, PIL_RO, K, oct + 1, g * 0.9, { mo: 'pilcrow', pan: 0.45, ...x });
}

/** The order bell at the pass: two quick dings on the fifth. */
function orderUp(b: B, t: number, K: Key, g: number, x: X = {}): void {
  for (const k of [0, 0.5]) b.n('glass', t + k, fold(K(4), 79), 0.4, g, { ratio: 3, ...x });
}

/**
 * One bar of the stall's band: a two-beat bass with a pickup a half step under the next root, a ride on two and four,
 * and two chord tones pushed ahead of beat three.
 */
function shuffle(b: B, t: number, ch: Ch, next: Ch, pickup: boolean): void {
  const r = rootOf(F_ION, ch, 36);
  b.n('bass', t, r, 1.3, 0.28, { cut: 360 });
  b.n('bass', t + 2, r - 5, pickup ? 1.4 : 1.8, 0.24, { cut: 360 });
  if (pickup) b.n('bass', t + sw(3.5), rootOf(F_ION, next, 36) - 1, 0.3, 0.2, { cut: 360 });
  b.hit(t + 1, 'tick', 0.07, 0.05);
  b.hit(t + 3, 'tick', 0.07, 0.05);
  if (!pickup) b.hit(t + sw(1.5), 'tick', 0.04, 0.04);
  for (const n of tones(F_ION, ch, 60).slice(1, 3)) b.n('arp', t + sw(1.5), n, 0.3, 0.09, { cut: 1200 });
}

/** The Food Court: a dead food stall's jingle in a greasy swing, grills gone cold, and a microwave humming on its own. */
const area8: TrackDef = {
  bpm: 80, start: 'counter', vary: 0.4, wrong: 0.03, echo: 0.35, verb: 0.6, wobble: 5, level: 0.68,
  graph: {
    counter: [['stall', 1]],
    stall: [['stall', 1], ['order', 2], ['microwave', 1], ['grill', 1]],
    order: [['stall', 2], ['microwave', 1]],
    microwave: [['stall', 1], ['order', 1], ['grill', 1]],
    grill: [['stall', 2], ['order', 1]],
  },
  secs: {
    counter: () => {
      const b = new B(8, 4, 80);
      // The microwave's hum comes on, a grill sputters once, and far off an order bell rings twice.
      b.n('drone', 0, 41, 8, 0.3, { a: 1 });
      b.n('drone', 0, 48, 8, 0.08, { a: 2 });
      b.hit(0, 'hiss', 0.06, 8, { a: 2 });
      b.hit(0.5, 'sizzle', 0.05, 2.5);
      orderUp(b, 4, F_ION, 0.12, { pan: -0.4, det: -10 });
      b.n('sub', 4, 41, 4, 0.24);
      return b.out({ still: true });
    },
    stall: (c: Ctx) => {
      const b = new B(32, 4, 80);
      for (let i = 0; i < 8; i++) shuffle(b, i * 4, STALL[i % 4], STALL[(i + 1) % 4], i % 2 === 1);
      // The jingle plays on a bright bell, and every third pass on a pluck, which cannot slide.
      const pluck = c.visit % 3 === 2, v: Voice = pluck ? 'arp' : 'bell', x: X = pluck ? { cut: 1500 } : { ratio: 3 };
      const smear = pluck ? -1 : SMEAR;
      swing(b, v, 0, STALL_A, F_ION, 0, 0.26, x, smear);
      swing(b, v, 8, STALL_B, F_ION, 0, 0.24, x);
      swing(b, v, 16, STALL_A, F_ION, 0, 0.26, x, c.r.chance(0.6) ? smear : -1);
      // Some passes the last phrase runs down like a toy on a low battery, each note flatter, and stops.
      if (c.r.chance(0.3)) swing(b, v, 24, STALL_B.slice(0, 5 + c.r.int(3)), F_ION, 0, 0.22, x, -1, 9);
      else swing(b, v, 24, STALL_B, F_ION, 0, 0.24, x);
      return b.out();
    },
    order: (c: Ctx) => {
      const b = new B(16, 4, 80);
      for (let i = 0; i < 4; i++) shuffle(b, i * 4, STALL[i], STALL[(i + 1) % 4], i % 2 === 1);
      // Pilcrow steps up to the counter, the stall answers with its jingle's last bar, and the order comes up.
      pilcrowSwung(b, 1, F_ION, 0, 0.22);
      swing(b, 'bell', 6, STALL_A.slice(7), F_ION, 0, 0.2, { ratio: 3, pan: -0.3 });
      pilcrowSwung(b, 9, F_ION, 0, 0.2, c.r.chance(0.5) ? {} : { det: -8 });
      orderUp(b, c.r.pick([14, 14.5]), F_ION, 0.12, { pan: 0.4 });
      return b.out();
    },
    microwave: (c: Ctx) => {
      const b = new B(16, 4, 80);
      // The hum comes on and a timer counts the beats while the turntable brings three chords round. Tilde's wave turns
      // with them, nearly whole now, and the ding ends the hum just as she holds one step short of home.
      b.n('drone', 0, 41, 12.5, 0.32, { a: 0.4 });
      b.n('drone', 0, 48, 12.5, 0.1, { a: 0.6 });
      for (let k = 0; k < 12; k++) b.hit(k, 'tick', k % 4 ? 0.035 : 0.05, 0.04);
      const from = c.r.int(3);
      for (let i = 0; i < 3; i++) {
        const ch = TURN[(from + i) % 3];
        strings(b, F_ION, i * 4, ch, 4, 0.08);
        sub(b, F_ION, i * 4, ch, 4, 0.22);
      }
      torn(b, c, 'bell', c.r.pick([5.5, 6]), TILDE_NEAR, F_ION, 1, 0.26, 0.08);
      b.n('glass', 12.5, fold(F_ION(4), 79), 2.5, 0.16, { ratio: 3 });
      b.n('glass', 12.5, fold(F_ION(9), 79), 1.5, 0.05, { ratio: 3, pan: 0.3 });
      return b.out();
    },
    grill: (c: Ctx) => {
      const b = new B(16, 4, 80);
      // The grills have gone cold: each sizzle is weaker than the one before, and the metal ticks as it cools.
      [0.07, 0.05, 0.035, 0.02].forEach((g, i) => b.hit(i * 3.5, 'sizzle', g, 3 - i * 0.5, { pan: c.r.range(-0.5, 0.5) }));
      strings(b, F_ION, 0, [0, 'six'], 8, 0.09);
      strings(b, F_ION, 8, [5, 'dom7'], 8, 0.09);
      sub(b, F_ION, 0, [0, 'six'], 8, 0.26);
      sub(b, F_ION, 8, [5, 'dom7'], 8, 0.24);
      // A slow greasy lick on the warm lead, then again a fourth higher over the fourth degree's seventh.
      swing(b, 'lead', 2, LICK, F_ION, -1, 0.2, { cut: 1100 }, 1);
      swing(b, 'lead', 10, shift(LICK, 3), F_ION, -1, 0.18, { cut: 1100 }, c.r.chance(0.5) ? 1 : -1);
      ticks(b, c, 16, 5, 0.07);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 9: the Arcade

const A_DOR = key(69, MODE.dor);
/** The arcade's changes: the tonic minor, the major fourth that makes the mode dorian, the flat seventh, and the fifth. */
const ARC: readonly Ch[] = [[0, 'm9'], [5, 'add9'], [10, 'add9'], [7, 'm7']];
/** The attract loop as steps up the chord's ladder: up to its sixth tone and back down. */
const LOOP = [0, 2, 4, 5, 4, 2] as const;
/** The high-score fanfare. It climbs past the octave and turns back toward it, and its last note never sounds. */
const HISCORE: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [6, 1], [4, 0.5], [6, 0.5], [8, 1.5], [6, 0.5], [7, 2]];
/** Tilde nearly home in a minor mode: her wave held on the raised seventh, a half step under the tonic. */
const TILDE_LEAD: Fig = [...TILDE.slice(0, -1), [6, 2.5, 1]];

/** One cabinet's attract loop over a chord: `n` steps of LOOP, `step` beats apart. */
function attract(b: B, t: number, ch: Ch, g: number, x: X = {}, n = 6, step = 0.5, v: Voice = 'arp', up = 0): void {
  const base = rootOf(A_DOR, ch, 57) + up, sh = SH[ch[1]];
  const ladder = [...sh, ...sh.map((s) => s + 12)].sort((a, z) => a - z).map((s) => base + s);
  for (let k = 0; k < n; k++) b.n(v, t + k * step, ladder[LOOP[k % LOOP.length]], step * 0.8, g * (k ? 0.8 : 1), { cut: 1800, ...x });
}

/** A coin dropping into a cabinet somewhere: a chime up a fourth, and a counter ticking it in. */
function coin(b: B, t: number, pan: number): void {
  b.n('glass', t, fold(A_DOR(4), 72), 0.25, 0.1, { ratio: 3, pan });
  b.n('glass', t + 0.25, fold(A_DOR(7), 72), 0.6, 0.1, { ratio: 3, pan });
  for (let k = 0; k < 2; k++) b.hit(t + 0.75 + k * 0.25, 'tick', 0.05, 0.04, { pan });
}

/** The Arcade: dead cabinets humming, attract loops out of step, coins dropping, and a high-score fanfare that never ends. */
const area9: TrackDef = {
  bpm: 88, start: 'powerup', vary: 0.4, wrong: 0.04, echo: 0.4, verb: 0.7, wobble: 4, level: 0.66,
  graph: {
    powerup: [['attract', 1]],
    attract: [['attract', 1], ['coins', 2], ['hiscore', 1], ['dead', 1]],
    coins: [['attract', 2], ['hiscore', 1], ['dead', 1]],
    hiscore: [['attract', 1], ['coins', 1], ['dead', 1]],
    dead: [['attract', 1], ['coins', 1], ['powerup', 0.3]],
  },
  secs: {
    powerup: () => {
      const b = new B(8, 4, 88);
      // A cabinet powers up: the tube warms, the hum starts with a thunk, the self-test beeps up the chord, and a coin drops.
      b.hit(0, 'swell', 0.06, 2);
      b.hit(2, 'kick', 0.1, 0.25);
      b.n('drone', 2, 45, 6, 0.26, { a: 0.5 });
      [0, 2, 4].forEach((d, i) => b.n('blip', 3 + i * 0.5, A_DOR(d) + 12, 0.15, 0.08));
      coin(b, 6, 0.3);
      return b.out({ still: true });
    },
    attract: (c: Ctx) => {
      const b = new B(16, 4, 88);
      b.n('drone', 0, 45, 16, 0.24);
      b.hit(0, 'hiss', 0.06, 16, { a: 2 });
      // The nearest cabinet's attract loop. Once in a while it loses power for the rest of a bar.
      const from = c.r.pick([0, 2]), dropout = c.r.chance(0.35) ? c.r.int(4) : -1;
      for (let i = 0; i < 4; i++) {
        const ch = ARC[(from + i) % 4], r = rootOf(A_DOR, ch, 33);
        attract(b, i * 4, ch, 0.26, {}, i === dropout ? 3 : 6);
        if (i === dropout) b.hit(i * 4 + 1.5, 'tick', 0.1, 0.05);
        b.n('bass', i * 4, r, 1.6, 0.26, { cut: 300 });
        b.n('bass', i * 4 + 2, r + 7, 1.6, 0.22, { cut: 300 });
      }
      // A second cabinet across the room runs its own loop every five beats, out of step with the first.
      for (let t = c.r.int(3); t < 16; t += 5) {
        b.n('glass', t, fold(A_DOR(4), 72), 0.6, 0.1, { pan: -0.5, det: -14 });
        b.n('glass', t + 1.5, fold(A_DOR(0), 72), 0.8, 0.08, { pan: -0.5, det: -14 });
      }
      return b.out();
    },
    coins: (c: Ctx) => {
      const b = new B(16, 4, 88);
      b.n('drone', 0, 45, 16, 0.22);
      for (const i of [0, 2]) strings(b, A_DOR, i * 4, ARC[i], 8, 0.08);
      ARC.forEach((ch, i) => sub(b, A_DOR, i * 4, ch, 4, 0.24));
      // Pilcrow's square half, a repeated note and the fifth above, sounds like a coin going in. Coins drop elsewhere in
      // the room, and a counter ticks each one in.
      pilcrow(b, 1, A_DOR, 0, 0.2);
      pilcrow(b, 9, A_DOR, 0, 0.18, c.r.chance(0.4) ? 2 : 1);
      for (let k = 0; k < 3; k++) coin(b, 5 + k * 4 + c.r.pick([0, 0.5, 1]), c.r.range(-0.6, 0.6));
      return b.out();
    },
    hiscore: (c: Ctx) => {
      const b = new B(16, 4, 88);
      b.n('drone', 0, 45, 16, 0.22);
      strings(b, A_DOR, 0, ARC[0], 4, 0.09);
      strings(b, A_DOR, 4, ARC[2], 4, 0.09);
      sub(b, A_DOR, 0, ARC[0], 4, 0.24);
      sub(b, A_DOR, 4, ARC[2], 4, 0.24);
      // The high-score fanfare never gets its last note. Some passes the screen freezes earlier still, on a tick.
      const stop = c.r.chance(0.35) ? 5 + c.r.int(4) : HISCORE.length - 1;
      const end = fig(b, 'cold', 0.5, HISCORE.slice(0, stop), A_DOR, 0, 0.2, { m: undefined, mo: 'hiscore', cut: 2400 }, 0.9);
      b.hit(end, 'tick', 0.1, 0.05);
      // The name entry: a cursor blinks while Tilde's wave spells her name, nearly whole and held a half step short of home.
      for (let k = 9; k < 16; k++) b.n('blip', k, fold(A_DOR(4), 84), 0.1, 0.05, { pan: 0.4 });
      strings(b, A_DOR, 9, [0, 'm9'], 4, 0.08);
      strings(b, A_DOR, 13, [7, 'dom7'], 3, 0.08);
      torn(b, c, 'bell', 9, TILDE_LEAD, A_DOR, 0, 0.26, 0.05);
      return b.out();
    },
    dead: (c: Ctx) => {
      const b = new B(16, 4, 88);
      // Rows of dead cabinets. A transformer hums a half step off, a scanline crawls up one screen, a failing board plays
      // its loop at half speed and flat, and Pilcrow walks the aisle between them.
      b.n('drone', 0, 45, 16, 0.3);
      b.n('drone', 0, 46, 16, 0.08, { a: 5 });
      b.hit(0, 'hiss', 0.1, 16, { a: 2 });
      b.hit(2 + c.r.int(4), 'scan', 0.07, 5, { n: 69 });
      attract(b, 1, c.r.pick(ARC), 0.12, { pan: 0.5, det: -30 }, 6, 1, 'glass', 12);
      pilcrow(b, 8, A_DOR, 0, 0.18, 2);
      ticks(b, c, 16, 5, 0.07);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 10: the Garden Center

const B_MIX = key(71, MODE.mix);
/** The garden's changes: the tonic, the fourth, the flat seventh that makes the mode mixolydian, and the tonic left open. */
const GARDEN_CH: readonly Ch[] = [[0, 'add9'], [5, 'maj9'], [10, 'add9'], [0, 'sus2']];
const T3 = 1 / 3;
/** The meadow tune in a lilting twelve-eight, where most beats split into a long note and a short one. */
const MEADOW_A: Fig = [[4, 2 * T3], [5, T3], [4, 2 * T3], [2, T3], [0, 1], [1, 2 * T3], [2, T3], [3, 2 * T3], [2, T3], [1, 1], [-1, 2 * T3], [0, 4 * T3]];
const MEADOW_B: Fig = [[6, 2 * T3], [5, T3], [4, 2 * T3], [3, T3], [4, 1], [6, 2 * T3], [7, T3], [7, 2 * T3], [6, T3], [4, 1], [2, 2 * T3], [4, 4 * T3]];
/** Pilcrow's figure in the same lilt. */
const PIL_SQ_LILT: Fig = [[0, 2 * T3], [0, T3], [4, 1]];
const PIL_RO_LILT: Fig = [[5, 2 * T3], [4, T3 / 2], [3, T3 / 2], [4, 1]];

/** Pilcrow's whole figure in the garden's lilt, the square half on the pulse lead and the round half on the triangle. */
function pilcrowLilt(b: B, t: number, K: Key, oct: number, g: number, stretch = 1): number {
  const end = fig(b, 'cold', t, aug(PIL_SQ_LILT, stretch), K, oct, g, { mo: 'pilcrow' }, 0.85);
  return fig(b, 'blip', end, aug(PIL_RO_LILT, stretch), K, oct + 1, g * 0.9, { mo: 'pilcrow', pan: 0.45 });
}

/** Crickets under the night: one at the tonic three octaves up, and often a second a step above it. */
function crickets(b: B, c: Ctx, beats: number, g: number): void {
  b.hit(0, 'cricket', g, beats, { n: 107, pan: -0.5 });
  if (c.r.chance(0.6)) {
    const t = c.r.int(4);
    b.hit(t, 'cricket', g * 0.7, beats - t, { n: 109, pan: 0.6 });
  }
}

/** A greenhouse pane ringing somewhere in the dark. */
function pane(b: B, c: Ctx, t: number): void {
  b.n('glass', t, fold(B_MIX(c.r.pick([0, 2, 4, 6])), 83), 3, 0.08, { pan: c.r.range(-0.7, 0.7) });
}

/** An impact sprinkler ticking round across the beds in steps of two thirds of a beat, then ratcheting back. */
function sprinkler(b: B, t: number, steps: number, pan: number): void {
  const len = steps * 2 * T3;
  b.hit(t, 'hiss', 0.04, len, { a: 0.3, pan });
  for (let k = 0; k < steps; k++) b.hit(t + k * 2 * T3, 'tick', 0.06, 0.04, { pan: pan - k * 0.08 });
  b.hit(t + len, 'ratchet', 0.05, 1.2, { pan: pan - steps * 0.08 });
}

/** The Garden Center at night: drones on the fifth, a lilting tune, crickets, sprinklers, and greenhouse panes ringing. */
const area10: TrackDef = {
  bpm: 66, start: 'dusk', vary: 0.35, wrong: 0.03, echo: 0.5, verb: 0.9, wobble: 4, level: 0.62,
  graph: {
    dusk: [['meadow', 1]],
    meadow: [['meadow', 1], ['sprinkler', 2], ['greenhouse', 1], ['night', 1]],
    sprinkler: [['meadow', 2], ['greenhouse', 1], ['night', 1]],
    greenhouse: [['meadow', 1], ['sprinkler', 1], ['night', 1]],
    night: [['meadow', 1], ['greenhouse', 1], ['dusk', 0.3]],
  },
  secs: {
    dusk: () => {
      const b = new B(8, 4, 66);
      // Night comes down on the garden: the drones open on the fifth, one cricket starts, and a greenhouse pane rings.
      b.n('drone', 0, 47, 8, 0.24, { a: 3 });
      b.n('drone', 2, 42, 6, 0.1, { a: 3 });
      b.hit(1, 'cricket', 0.06, 7, { n: 107, pan: -0.5 });
      b.n('glass', 4, fold(B_MIX(4), 83), 3, 0.09, { pan: 0.5 });
      return b.out({ still: true });
    },
    meadow: (c: Ctx) => {
      const b = new B(32, 4, 66);
      b.n('drone', 0, 47, 32, 0.22);
      b.n('drone', 0, 42, 32, 0.1);
      GARDEN_CH.forEach((ch, i) => {
        strings(b, B_MIX, i * 8, ch, 7.9, 0.08);
        sub(b, B_MIX, i * 8, ch, 7.9, 0.22);
      });
      // The tune on a soft bell. On some passes its second statement drifts off to a far pane.
      fig(b, 'bell', 0, MEADOW_A, B_MIX, 0, 0.24);
      fig(b, 'bell', 8, MEADOW_B, B_MIX, 0, 0.22);
      const far = c.r.chance(0.4), v: Voice = far ? 'glass' : 'bell', x: X = far ? { pan: -0.4 } : {};
      fig(b, v, 16, MEADOW_A, B_MIX, far ? 1 : 0, far ? 0.12 : 0.22, x);
      fig(b, v, 24, c.r.chance(0.5) ? MEADOW_B : shift(MEADOW_B, -2), B_MIX, far ? 1 : 0, far ? 0.11 : 0.2, x);
      crickets(b, c, 32, 0.05);
      if (c.r.chance(0.5)) pane(b, c, 12 + c.r.int(8));
      return b.out();
    },
    sprinkler: (c: Ctx) => {
      const b = new B(16, 4, 66);
      b.n('drone', 0, 47, 16, 0.22);
      for (const i of [0, 1]) {
        strings(b, B_MIX, i * 8, GARDEN_CH[i], 7.9, 0.08);
        sub(b, B_MIX, i * 8, GARDEN_CH[i], 7.9, 0.22);
      }
      // A sprinkler ticks round across the beds and ratchets back, and Pilcrow walks the rows in the same lilt.
      sprinkler(b, c.r.pick([0, 1]), 12, 0.5);
      pilcrowLilt(b, 2, B_MIX, 0, 0.18);
      pilcrowLilt(b, 10, B_MIX, 0, 0.16, c.r.chance(0.4) ? 1.5 : 1);
      b.hit(8, 'cricket', 0.04, 8, { n: 109, pan: -0.6 });
      return b.out();
    },
    greenhouse: (c: Ctx) => {
      const b = new B(16, 4, 66);
      // Inside the greenhouse the panes ring a slow arpeggio and the night air hums on a low choir. Tilde's wave comes
      // through nearly whole, held a half step short of home.
      b.n('drone', 0, 47, 16, 0.2);
      sub(b, B_MIX, 0, GARDEN_CH[0], 16, 0.2);
      for (const n of tones(B_MIX, GARDEN_CH[0], 55).slice(0, 3)) b.n('choir', 0, n, 15, 0.1, { ah: 0 });
      [0, 2, 4, 7, 6, 4, 2, 4].forEach((d, k) => b.n('glass', k * 2, B_MIX(d) + 12, 2.5, 0.07, { pan: k % 2 ? 0.5 : -0.5 }));
      torn(b, c, 'bell', c.r.pick([4, 5]), TILDE_LEAD, B_MIX, 0, 0.26, 0.03);
      crickets(b, c, 16, 0.04);
      return b.out();
    },
    night: (c: Ctx) => {
      const b = new B(16, 4, 66);
      // The deep of the night: the drones and the crickets, the tune's first bar on a far pane at half speed, another
      // pane, and a sprinkler somewhere ticking a few times.
      b.n('drone', 0, 47, 16, 0.24);
      b.n('drone', 0, 42, 16, 0.1, { a: 4 });
      crickets(b, c, 16, 0.06);
      fig(b, 'glass', 2, aug(MEADOW_A.slice(0, 7), 2), B_MIX, 1, 0.1, { pan: -0.5, det: -8 });
      pane(b, c, 10 + c.r.int(4));
      for (let k = 0; k < 4; k++) b.hit(12 + k * 2 * T3, 'tick', 0.03, 0.04, { pan: 0.7 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 11: the Server Room

const G_HMIN = key(67, MODE.hmin);
/** The room's changes: the tonic minor, the sixth degree's major, the fourth's minor, and the fifth's major. */
const RACK: readonly Ch[] = [[0, 'madd9'], [8, 'maj9'], [5, 'm9'], [7, 'maj']];
/** Every note in the Server Room is rigid, so no ornament or displacement moves it off the sixteenth-note grid. */
const EXACT: X = { m: undefined };

/** The fans: the root and the fifth humming low, and the air moving through the racks. */
function fans(b: B, beats: number, g: number): void {
  b.n('drone', 0, 43, beats, g);
  b.n('drone', 0, 50, beats, g * 0.35, { a: 2 });
  b.hit(0, 'hiss', 0.05, beats, { a: 1 });
}

/** One job over a chord: four eighths up its tones. */
function job(b: B, t: number, ch: Ch, g: number): void {
  const base = rootOf(G_HMIN, ch, 60), sh = SH[ch[1]];
  for (let k = 0; k < 4; k++) b.n('arp', t + k * 0.5, base + sh[k % sh.length], 0.4, g * (k ? 0.8 : 1), { cut: 1500 });
}

/** Error beeps on the pulse lead, an eighth apart. */
function beeps(b: B, t: number, n: number): void {
  for (let k = 0; k < n; k++) b.n('cold', t + k * 0.5, 86, 0.3, 0.12, { cut: 3000 });
}

/** The two-beat bass of the racks: the root on one and the fifth on three. */
function rackBass(b: B, t: number, ch: Ch, g: number): void {
  const r = rootOf(G_HMIN, ch, 33);
  b.n('bass', t, r, 0.9, g, { cut: 300 });
  b.n('bass', t + 2, r + 7, 0.9, g * 0.85, { cut: 300 });
}

/** The Server Room: fans, seeking drives, error beeps, and a modem's handshake, every note exactly on the sixteenths. */
const area11: TrackDef = {
  bpm: 90, start: 'boot', vary: 0.15, wrong: 0.02, echo: 0.25, verb: 0.45, wobble: 1, level: 0.66,
  graph: {
    boot: [['rack', 1]],
    rack: [['rack', 1], ['process', 2], ['archive', 1], ['error', 1]],
    process: [['rack', 2], ['archive', 1], ['error', 1]],
    archive: [['rack', 1], ['process', 1]],
    error: [['rack', 2], ['process', 1], ['boot', 0.3]],
  },
  secs: {
    boot: () => {
      const b = new B(8, 4, 90);
      // The room powers on: the fans spin up, a self-test beeps once, a drive seeks, and a modem starts its handshake.
      b.hit(0, 'swell', 0.05, 2);
      b.n('drone', 1.5, 43, 6.5, 0.26, { a: 1 });
      b.n('drone', 2, 50, 6, 0.09, { a: 1.5 });
      beeps(b, 3, 1);
      b.hit(4, 'seek', 0.08, 0.25);
      b.hit(5, 'modem', 0.05, 3, { n: 86 });
      return b.out({ still: true });
    },
    rack: (c: Ctx) => {
      const b = new B(16, 4, 90);
      fans(b, 16, 0.26);
      // A job runs on each chord for half a bar, the clock ticks every beat, and the drives seek on the eighths.
      const at = c.r.pick([0, 2]);
      RACK.forEach((ch, i) => {
        job(b, i * 4 + at, ch, 0.2);
        rackBass(b, i * 4, ch, 0.26);
      });
      for (let k = 0; k < 16; k++) b.hit(k, 'tick', k % 2 ? 0.04 : 0.06, 0.04);
      for (let k = 0; k < 2; k++) b.hit(c.r.int(32) / 2, 'seek', 0.08, 0.25);
      // Now and then a process fails, and three error beeps sound.
      if (c.r.chance(0.3)) beeps(b, c.r.pick([6.5, 14]), 3);
      return b.out();
    },
    process: (c: Ctx) => {
      const b = new B(16, 4, 90);
      fans(b, 16, 0.24);
      RACK.forEach((ch, i) => {
        rackBass(b, i * 4, ch, 0.24);
        if (i % 2 === 0) job(b, i * 4 + 2, ch, 0.16);
      });
      for (let k = 1; k < 16; k += 2) b.hit(k, 'tick', 0.05, 0.04);
      // Pilcrow passes the racks in exact time, the same figure twice.
      pilcrow(b, 1, G_HMIN, 0, 0.2, 1, EXACT);
      pilcrow(b, 9, G_HMIN, 0, 0.18, c.r.chance(0.5) ? 1 : 2, EXACT);
      b.hit(c.r.int(32) / 2, 'seek', 0.07, 0.25);
      if (c.r.chance(0.5)) b.hit(c.r.pick([6, 7]), 'data', 0.04, 1.5, { n: 86, pan: -0.4 });
      return b.out();
    },
    error: (c: Ctx) => {
      const b = new B(8, 4, 90);
      // A fault: the clock stops, the fans cut out for a beat, the drives seek over and over, and the beeps repeat until
      // the room recovers.
      b.n('drone', 0, 43, 2, 0.26);
      b.n('drone', 3, 43, 5, 0.26, { a: 0.5 });
      for (let k = 0; k < 2; k++) b.hit(k, 'tick', 0.06, 0.04);
      beeps(b, 0.5, 3);
      beeps(b, 4.5, 3);
      for (let k = 0; k < 3; k++) b.hit(2 + k + c.r.pick([0, 0.5]), 'seek', 0.09, 0.25);
      return b.out();
    },
    archive: (c: Ctx) => {
      const b = new B(16, 4, 90);
      fans(b, 16, 0.22);
      // In the archive Tilde is restored to the last bit, every note in place, and only her final tonic is missing. The
      // room resolves to the tonic under her held leading tone, and a modem hands the data on.
      for (const [t, d, ch] of [[0, 6, RACK[0]], [6, 6, RACK[3]], [12, 4, RACK[0]]] as const) {
        strings(b, G_HMIN, t, ch, d - 0.1, 0.08);
        sub(b, G_HMIN, t, ch, d - 0.1, 0.22);
      }
      fig(b, 'bell', 2, TILDE_NEAR, G_HMIN, 0, 0.26, { mo: 'tilde', ...EXACT });
      b.hit(c.r.pick([12, 13]), 'modem', 0.04, 3, { n: 86, pan: 0.4 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- Tilde healed (areas 12 to 14)

/** Tilde healed: her wave climbs to the leading tone and comes home at last, softly. The home note is rigid, so variation never drops it. */
function tildeHome(b: B, t: number, K: Key, oct: number, g: number, raise = 0, x: X = {}): number {
  let end = fig(b, 'bell', t, TILDE.slice(0, -1), K, oct, g, { mo: 'tilde', ...x });
  end = fig(b, 'bell', end, [[6, 0.5, raise]], K, oct, g * 0.85, { mo: 'tilde', ...x });
  return fig(b, 'bell', end, [[7, 2]], K, oct, g * 0.5, { mo: 'tilde', m: undefined, ...x });
}

/** Footsteps a beat apart, each a little quieter. */
function steps(b: B, t: number, n: number, pan: number): void {
  for (let k = 0; k < n; k++) b.hit(t + k, 'tick', 0.06 - k * 0.008, 0.04, { pan: pan + k * 0.15 });
}

// ---------------------------------------------------------------- area 12: the Parking Garage

const EB_AEO = key(63, MODE.aeo);
/** The garage's changes, held long: the tonic minor, the sixth degree's major, the fourth's minor, and the tonic again. */
const DECK: readonly Ch[] = [[0, 'm9'], [8, 'maj9'], [5, 'm9'], [0, 'madd9']];
/** A slow figure on a far bell across the deck. */
const SPACE: Fig = [[4, 2], [3, 1], [2, 1], [0, 4]];
/** A car alarm's first two parts: a two-tone whoop and three beeps. Its third part, a rising wail, never sounds. */
const ALARM_A: Fig = [[7, 0.5], [4, 0.5], [7, 0.5], [4, 0.5], [7, 0.5], [4, 0.5]];
const ALARM_B: Fig = [[5, 0.5], [null, 0.5], [5, 0.5], [null, 0.5], [5, 0.5], [null, 0.5]];

/** The ticket barrier: two beeps on the fifth, then the arm lifts with a click and a soft thunk. */
function barrier(b: B, t: number): void {
  const n = fold(EB_AEO(4), 79);
  b.n('blip', t, n, 0.2, 0.09, { pan: 0.3 });
  b.n('blip', t + 0.5, n, 0.2, 0.09, { pan: 0.3 });
  b.hit(t + 1, 'tick', 0.08, 0.04, { pan: 0.3 });
  b.hit(t + 1.25, 'kick', 0.05, 0.25);
}

/** A car alarm on another level: it starts its pattern and stops before the wail, sometimes after the first part. */
function carAlarm(b: B, c: Ctx, t: number): void {
  const x = rigid('alarm', { pan: c.r.pick([-0.7, 0.7]), det: -12 });
  const end = fig(b, 'blip', t, ALARM_A, EB_AEO, 1, 0.07, x);
  if (c.r.chance(0.6)) fig(b, 'blip', end, ALARM_B, EB_AEO, 1, 0.07, x);
}

/** The garage's air: the ventilation's drone on the tonic and fifth, and a faint hiss. */
function ventilation(b: B, beats: number, g: number): void {
  b.n('drone', 0, 39, beats, g);
  b.n('drone', 0, 46, beats, g * 0.33, { a: 4 });
  b.hit(0, 'hiss', 0.05, beats, { a: 3 });
}

/** The Parking Garage: cold concrete, footsteps that echo, a ticket barrier, and a car alarm that never finishes. */
const area12: TrackDef = {
  bpm: 66, start: 'entry', vary: 0.3, wrong: 0.03, echo: 0.75, verb: 1, wobble: 2, level: 0.64,
  graph: {
    entry: [['deck', 1]],
    deck: [['deck', 1], ['alarm', 1], ['barrier', 2], ['level', 1]],
    alarm: [['deck', 2], ['barrier', 1], ['level', 1]],
    barrier: [['deck', 2], ['alarm', 1], ['level', 1]],
    level: [['deck', 1], ['barrier', 1], ['entry', 0.3]],
  },
  secs: {
    entry: () => {
      const b = new B(8, 4, 66);
      // A ticket barrier lets you in, and the ventilation's drone comes up behind it.
      barrier(b, 1);
      b.n('drone', 2, 39, 6, 0.24, { a: 3 });
      b.hit(0, 'hiss', 0.05, 8, { a: 3 });
      steps(b, 4, 3, -0.3);
      return b.out({ still: true });
    },
    deck: (c: Ctx) => {
      const b = new B(32, 4, 66);
      ventilation(b, 32, 0.24);
      DECK.forEach((ch, i) => {
        strings(b, EB_AEO, i * 8, ch, 7.9, 0.07);
        sub(b, EB_AEO, i * 8, ch, 7.9, 0.2);
      });
      // Footsteps echo off the concrete, and a cold bell answers from across the deck.
      steps(b, c.r.int(4) * 2, 4, -0.5);
      fig(b, 'glass', 6, SPACE, EB_AEO, 1, 0.11, { pan: 0.5 });
      fig(b, 'glass', 22, c.r.chance(0.5) ? SPACE : shift(SPACE, -2), EB_AEO, 1, 0.1, { pan: -0.5 });
      if (c.r.chance(0.5)) carAlarm(b, c, 14 + c.r.int(3));
      return b.out();
    },
    alarm: (c: Ctx) => {
      const b = new B(16, 4, 66);
      ventilation(b, 16, 0.26);
      sub(b, EB_AEO, 0, DECK[0], 16, 0.2);
      // A car alarm goes off on another level, twice, and never gets as far as its wail.
      carAlarm(b, c, 1);
      carAlarm(b, c, 9);
      steps(b, 6 + c.r.int(2), 3, 0.4);
      return b.out();
    },
    barrier: (c: Ctx) => {
      const b = new B(16, 4, 66);
      ventilation(b, 16, 0.24);
      for (const i of [0, 1]) {
        strings(b, EB_AEO, i * 8, DECK[i * 2], 7.9, 0.07);
        sub(b, EB_AEO, i * 8, DECK[i * 2], 7.9, 0.2);
      }
      // Pilcrow walks up to the barrier, it beeps and lifts, and Pilcrow walks on.
      pilcrow(b, 1, EB_AEO, 0, 0.2);
      barrier(b, 6);
      pilcrow(b, 10, EB_AEO, 0, 0.18, c.r.chance(0.5) ? 1 : 1.5);
      return b.out();
    },
    level: (c: Ctx) => {
      const b = new B(16, 4, 66);
      ventilation(b, 16, 0.22);
      // On the quietest level Tilde's wave comes home at last, softly, over the fifth's chord with its raised third.
      strings(b, EB_AEO, 0, DECK[0], 3.9, 0.07);
      strings(b, EB_AEO, 4, DECK[2], 3.9, 0.07);
      strings(b, EB_AEO, 8, [7, 'maj'], 1.9, 0.07);
      strings(b, EB_AEO, 10, DECK[0], 5.9, 0.07);
      sub(b, EB_AEO, 0, DECK[0], 16, 0.2);
      tildeHome(b, c.r.pick([3, 3.5]), EB_AEO, 0, 0.24, 1);
      steps(b, 13, 2, 0.5);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 13: the Cinema

const D_HMIN = key(62, MODE.hmin);
/** The organ's changes: the tonic minor, the fourth's minor, the fifth's major, and home. */
const REEL: readonly Ch[] = [[0, 'min'], [5, 'min'], [7, 'maj'], [0, 'min']];
/** The organ's interlude: a phrase that climbs and falls to the leading tone, and an answer that goes home. */
const ORGAN_A: Fig = [[4, 1.5], [5, 0.5], [4, 1], [2, 1], [3, 1.5], [2, 0.5], [1, 1], [-1, 1]];
const ORGAN_B: Fig = [[0, 1.5], [1, 0.5], [2, 1], [4, 1], [5, 1.5], [4, 0.5], [2, 1], [0, 1]];
/** The silent film's piano: the root low, then two chord tones, once a bar. */
function filmPiano(b: B, t: number, ch: Ch, g: number): void {
  b.n('bell', t, rootOf(D_HMIN, ch, 50), 0.9, g, { ratio: 1, det: -6 });
  for (const n of tones(D_HMIN, ch, 62).slice(1, 3)) b.n('bell', t + 1, n, 0.9, g * 0.7, { ratio: 1, det: -6 });
}
/** The projector's rattle, a click every 40 ms, with a dropout where the worn film skips. */
function projector(b: B, beats: number, g: number, skip: number): void {
  b.hit(0, 'ratchet', g, skip);
  b.hit(skip + 0.5, 'ratchet', g, beats - skip - 0.5);
}

/** The Cinema: a worn projector rattling, a silent film's piano, an organ interlude, and a reel that runs out and slaps. */
const area13: TrackDef = {
  bpm: 76, start: 'lights', vary: 0.35, wrong: 0.03, echo: 0.35, verb: 0.9, wobble: 6, level: 0.64,
  graph: {
    lights: [['feature', 1]],
    feature: [['feature', 1], ['organ', 2], ['reelend', 1], ['credits', 1]],
    organ: [['feature', 2], ['credits', 1], ['reelend', 1]],
    reelend: [['lights', 1], ['organ', 1]],
    credits: [['feature', 1], ['organ', 1]],
  },
  secs: {
    lights: (c: Ctx) => {
      const b = new B(8, 4, 76);
      // The house lights go down, the projector starts, and the organ holds one chord.
      const at = c.r.pick([1.5, 2, 2.5]);
      b.hit(0, 'swell', 0.05, at);
      b.hit(at, 'ratchet', 0.025, 8 - at);
      for (const n of tones(D_HMIN, c.r.pick([REEL[0], REEL[1]]), 50)) b.n('pad', at, n, 8 - at, 0.08, { a: 1 });
      b.n('drone', at, 38, 8 - at, 0.2, { a: 1 });
      return b.out();
    },
    feature: (c: Ctx) => {
      const b = new B(32, 4, 76);
      projector(b, 32, 0.025, 8 + c.r.int(16));
      b.n('drone', 0, 38, 32, 0.16);
      // The film's piano plays the changes, and Pilcrow's figure is the hero's theme on screen.
      for (let i = 0; i < 8; i++) filmPiano(b, i * 4, REEL[i % 4], 0.11);
      pilcrow(b, 2, D_HMIN, 0, 0.2);
      pilcrow(b, 18, D_HMIN, 0, 0.18, c.r.chance(0.5) ? 1 : 2);
      return b.out();
    },
    organ: (c: Ctx) => {
      const b = new B(16, 4, 76);
      // The interlude: the organ's pedal, its chords, and a reed line that climbs, falls, and goes home.
      b.n('drone', 0, 38, 16, 0.26);
      REEL.forEach((ch, i) => {
        for (const n of tones(D_HMIN, ch, 50)) b.n('pad', i * 4, n, 3.9, 0.09, { a: 0.3 });
      });
      fig(b, 'lead', 0, ORGAN_A, D_HMIN, -1, 0.18, { cut: 1800 });
      fig(b, 'lead', 8, c.r.chance(0.7) ? ORGAN_B : ORGAN_A, D_HMIN, -1, 0.17, { cut: 1800 });
      return b.out();
    },
    reelend: (c: Ctx) => {
      const b = new B(16, 4, 76);
      // The reel runs out: the rattle stops, and the film's loose end slaps the projector once a beat as the reel spins down.
      const stop = 3 + c.r.int(3);
      b.hit(0, 'ratchet', 0.025, stop);
      b.n('drone', 0, 38, 16, 0.18);
      for (let k = 0; k < 8; k++) b.hit(stop + 0.5 + k * (1 + k * 0.1), 'tick', 0.09 - k * 0.008, 0.05, { mo: 'slap', pan: 0.2 });
      return b.out();
    },
    credits: (c: Ctx) => {
      const b = new B(16, 4, 76);
      b.hit(0, 'ratchet', 0.018, 16);
      b.n('drone', 0, 38, 16, 0.22);
      // Over the credits Tilde's wave comes home at last, softly, as the organ resolves under her.
      for (const [t, d, ch] of [[0, 4, REEL[0]], [4, 4, REEL[1]], [8, 2, REEL[2]], [10, 6, REEL[3]]] as const) {
        for (const n of tones(D_HMIN, ch, 50)) b.n('pad', t, n, d - 0.1, 0.08, { a: 0.5 });
      }
      tildeHome(b, c.r.pick([3, 3.5]), D_HMIN, 1, 0.24);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 14: the Toy Store

const DB_ION = key(73, MODE.ion);
/** The toy store's changes: the tonic, the fourth, the sixth's minor, and the fifth, sweet and plain. */
const TOYS: readonly Ch[] = [[0, 'add9'], [5, 'maj'], [9, 'min'], [7, 'sus4']];
/** The music box's tune: a hop up to the octave that turns back, and an answer that steps home. */
const BOX_A: Fig = [[4, 0.5], [2, 0.5], [4, 0.5], [7, 0.5], [6, 1], [4, 1]];
const BOX_B: Fig = [[5, 0.5], [4, 0.5], [2, 0.5], [3, 0.5], [1, 1], [0, 1]];

/** The clockwork ticking once a beat, tick and tock. */
function clockwork(b: B, t: number, n: number, g: number): void {
  for (let k = 0; k < n; k++) b.hit(t + k, 'tick', k % 2 ? g * 0.7 : g, 0.04, { pan: 0.35 });
}

/** The Toy Store: music boxes and wind-up clockwork that runs down and is wound again. */
const area14: TrackDef = {
  bpm: 84, start: 'open', vary: 0.3, wrong: 0.02, echo: 0.4, verb: 0.6, wobble: 3, level: 0.9,
  graph: {
    open: [['musicbox', 1]],
    musicbox: [['musicbox', 1], ['rundown', 2], ['shelf', 1], ['nursery', 1]],
    rundown: [['windup', 1]],
    windup: [['musicbox', 2], ['shelf', 1]],
    shelf: [['musicbox', 1], ['nursery', 1], ['rundown', 1]],
    nursery: [['musicbox', 1], ['shelf', 1]],
  },
  secs: {
    open: () => {
      const b = new B(8, 4, 84);
      // The shop door's bell, a crank, and the music box's first notes.
      b.n('glass', 0, fold(DB_ION(4), 84), 1.5, 0.12, { ratio: 3 });
      b.n('glass', 0.5, fold(DB_ION(2), 84), 2, 0.1, { ratio: 3 });
      b.hit(2.5, 'ratchet', 0.04, 1);
      fig(b, 'glass', 4, BOX_A, DB_ION, 0, 0.16);
      return b.out({ still: true });
    },
    musicbox: (c: Ctx) => {
      const b = new B(32, 4, 84);
      // The music box plays its tune twice over a soft bass, and the clockwork ticks under it.
      for (let i = 0; i < 8; i++) sub(b, DB_ION, i * 4, TOYS[i % 4], 3.9, 0.18);
      clockwork(b, 0, 32, 0.05);
      const v: Voice = c.visit % 2 ? 'blip' : 'glass';
      fig(b, v, 0, BOX_A, DB_ION, 0, 0.18);
      fig(b, v, 4, BOX_B, DB_ION, 0, 0.17);
      fig(b, 'glass', 16, c.r.chance(0.5) ? BOX_A : shift(BOX_A, 2), DB_ION, 0, 0.16);
      fig(b, 'glass', 20, BOX_B, DB_ION, 0, 0.16);
      return b.out();
    },
    rundown: (c: Ctx) => {
      const b = new B(16, 4, 84);
      // The spring runs down: the tune slows and sags flat, and the ticks come further and further apart until they stop.
      [0, 1, 2, 3, 4.5, 6, 8, 10.5, 13.5].forEach((at) => b.hit(at, 'tick', 0.05, 0.04, { mo: 'clock', pan: 0.35 }));
      const t = fig(b, 'glass', 0, aug(BOX_A, 1.5), DB_ION, 0, 0.16, { det: -8 });
      fig(b, 'glass', t, aug(BOX_B.slice(0, c.r.pick([3, 4, 5])), 2.2), DB_ION, 0, 0.14, { det: -25 });
      sub(b, DB_ION, 0, TOYS[0], 8, 0.16);
      return b.out({ still: true });
    },
    windup: (c: Ctx) => {
      const b = new B(8, 4, 84);
      // A hand winds the key two or three times, the spring catches with a ping, and the clockwork starts again.
      const turns = c.r.pick([2, 3]);
      for (let k = 0; k < turns; k++) b.hit(k * 1.5, 'ratchet', 0.05, 0.75, { mo: 'wind' });
      b.n('blip', turns * 1.5, fold(DB_ION(c.r.pick([4, 7])), 84), 0.4, 0.1);
      clockwork(b, 6, 2, 0.05);
      return b.out({ still: true });
    },
    shelf: (c: Ctx) => {
      const b = new B(16, 4, 84);
      // Pilcrow walks the shelves while toys chirp from either side.
      for (let i = 0; i < 4; i++) sub(b, DB_ION, i * 4, TOYS[i], 3.9, 0.16);
      clockwork(b, 0, 16, 0.035);
      pilcrow(b, 1, DB_ION, 0, 0.18);
      pilcrow(b, 9, DB_ION, 0, 0.17, c.r.chance(0.5) ? 1 : 1.5);
      for (let k = 0; k < 3; k++) b.n('glass', 5 + k * 1.5 + c.r.pick([0, 0.5]), fold(DB_ION(c.r.pick([7, 9, 11])), 86), 0.4, 0.07, { pan: c.r.range(-0.7, 0.7) });
      return b.out();
    },
    nursery: (c: Ctx) => {
      const b = new B(16, 4, 84);
      // A lullaby: a slow music-box arpeggio, and Tilde's wave coming home at last, softly.
      for (let i = 0; i < 4; i++) {
        const ch = TOYS[i];
        sub(b, DB_ION, i * 4, ch, 3.9, 0.16);
        arpeggio(b, DB_ION, i * 4, ch, 4, 1, 0.07, PATS[0], {}, 'glass');
      }
      tildeHome(b, c.r.pick([3, 3.5]), DB_ION, 0, 0.22);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- the Manager

const C_AEO = key(60, MODE.aeo);
/** C minor uses Head Office's notes, so the Manager's jingle can stay in E-flat major over it. */
const BOSS_CH: readonly Ch[] = [[0, 'madd9'], [8, 'maj9'], [5, 'm9'], [7, 'sus4']];
/** The fight speeds up once the Manager drops to half HP, which the game reports as intensity 0.5. */
const bossBpm = (c: Ctx) => (c.int >= 0.5 ? 112 : 100);

/** The fight's bass: root, root, and fifth in a three, three, two pattern of eighths, with one more as the fight turns. */
function drive(b: B, t: number, ch: Ch, g: number, fill = true): void {
  const r = rootOf(C_AEO, ch, 33);
  [0, 1.5, 3].forEach((k, i) => b.n('bass', t + k, i === 2 ? r + 7 : r, 0.6, g, { cut: 420 }));
  if (fill) b.n('bass', t + 2.5, r, 0.4, g * 0.8, { cut: 420, lay: 0.5 });
}

/** Taiko on one and three-and, a half-time snare, and a kick that arrives late in the fight. */
function fightDrums(b: B, t: number, g: number): void {
  b.hit(t, 'taiko', g, 0.5);
  b.hit(t + 2.5, 'taiko', g * 0.7, 0.5);
  b.hit(t + 2, 'snare', g * 0.5, 0.25, { lay: 0.3 });
  b.hit(t, 'kick', g * 0.6, 0.25, { lay: 0.6 });
}

/** The Foreman: a working man's tune, stomped out in quarter notes on the low brass. */
const FOREMAN: Fig = [[0, 1], [0, 1], [4, 1], [3, 0.5], [2, 0.5], [0, 2]];
/** The Warden: a siren, two notes a fourth apart that slide into each other. */
const SIREN: Fig = [[4, 1], [7, 1], [4, 1], [7, 1]];
/** The Forklift: two short beeps and a long one, a vehicle backing up. Shipping's beeper, grown into a figure. */
const BEEPER: Fig = [[4, 0.5], [null, 0.5], [4, 0.5], [null, 0.5], [4, 1.5], [null, 0.5]];

/** The Fry Cook: a pancake tossed up an octave, a beat in the air, and a landing down the triad. */
const FLIP: Fig = [[0, 0.5], [7, 0.5], [null, 0.5], [7, 0.25], [6, 0.25], [4, 0.5], [2, 0.5], [0, 1]];

/** The griddle under the Fry Cook's fight: a sizzle that comes in as the fight turns and flares hotter late in it. */
function griddle(b: B, beats: number): void {
  b.hit(0, 'sizzle', 0.05, beats, { lay: 0.25 });
  b.hit(beats / 2, 'sizzle', 0.06, beats / 2, { lay: 0.75 });
}

/** The High Score: an attract-mode arpeggio up the triad to the tenth and back down. */
const ATTRACT: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [7, 0.5], [9, 0.5], [7, 0.5], [4, 0.5], [2, 0.5]];

/** A game pausing: a high blip and the fourth below it. */
function pauseBlip(b: B, t: number, g: number, x: X = {}): void {
  b.n('blip', t, 84, 0.12, g, { mo: 'arcade', ...x });
  b.n('blip', t + 0.25, 79, 0.2, g * 0.9, { mo: 'arcade', ...x });
}

/** The Gardener: a lazy waltz, a long note, a turn around it, and a sigh down to the third. */
const GARDEN: Fig = [[4, 2], [5, 0.5], [4, 0.5], [2, 1.5], [3, 0.5], [2, 1]];

/** The Gardener's watering can: a soft hiss and four drops falling down the scale. */
function can(b: B, t: number, g: number, x: X = {}): void {
  b.hit(t, 'hiss', 0.06, 1.2, { a: 0.2, ...x });
  [11, 9, 8, 7].forEach((d, i) => b.n('glass', t + 0.1 + i * 0.25, C_AEO(d) + 12, 0.5, g * (1 - i * 0.15), { mo: 'gardener', pan: 0.3 - i * 0.2, ...x }));
}

/** The Mainframe: a clockwork arpeggio, the octave struck between each step up the triad like an escapement. */
const CLOCK: Fig = [[0, 0.5], [7, 0.5], [2, 0.5], [7, 0.5], [4, 0.5], [7, 0.5], [2, 0.5], [7, 0.5]];

/** A burst of data from the Mainframe, high and quick. */
function burst(b: B, t: number, x: X = {}): void {
  b.hit(t, 'data', 0.06, 1, { n: 84, mo: 'mainframe', ...x });
}

/** The Valet: a shuffling walk up to the fifth and back, in swung eighths. */
const VALET: Fig = [[0, 0.5], [2, 0.5], [3, 0.5], [4, 0.5], [4, 0.5], [2, 0.5], [0, 1]];
/** The Valet's key ring: two quick high jingles. */
function keyRing(b: B, t: number, g: number, x: X = {}): void {
  b.n('glass', t, 96, 0.2, g, { mo: 'valet', pan: 0.4, ...x });
  b.n('glass', t + 0.25, 91, 0.2, g * 0.8, { mo: 'valet', pan: 0.4, ...x });
}

/** The Usher: a hushed march down the aisle, falling a step at a time and resting on the tonic. */
const USHER: Fig = [[4, 1.5], [3, 0.5], [2, 1], [1, 1], [0, 1.5], [-1, 0.5], [0, 2]];
/** The Usher's flashlight clicking on or off. */
function flashClick(b: B, t: number, x: X = {}): void {
  b.hit(t, 'tick', 0.1, 0.03, { mo: 'usher', ...x });
}

/** The Jack: a crank turning in long-short steps for three beats, then the clown springs up on the fourth. */
const JACK: Fig = [[0, 2 * T3], [2, T3], [4, 2 * T3], [2, T3], [0, 2 * T3], [2, T3], [11, 1]];
/** One wind of the Jack's tune on the music-box bell, `lift` degrees up, with a thump under the spring from intensity 0.6. */
function jackTune(b: B, t: number, lift: number, g: number): void {
  const fs = shift(JACK, lift);
  fig(b, 'glass', t, fs.slice(0, -1), C_AEO, 1, g, rigid('jack'));
  // The spring rings past the bar, and a held note is one that variation never moves an octave.
  b.n('glass', t + 3, C_AEO(11 + lift) + 12, 1.6, g * 1.1, rigid('jack', { bend: 1 }));
  b.hit(t + 3, 'kick', 0.1, 0.25, { lay: 0.6 });
}

/** What each boss brings to the fight's frame: its figure in the pitch, the duel, and after its big attack, plus its bass and drums. */
interface BossPart {
  call(b: B, c: Ctx): void;
  duel(b: B, c: Ctx): void;
  tail(b: B, c: Ctx, t: number): void;
  bass(b: B, t: number, ch: Ch, g: number, fill: boolean): void;
  drums(b: B, t: number, g: number): void;
}

/** A figure that is never ornamented or moved an octave, for machines and sirens. */
const rigid = (mo: string, x: X = {}): X => ({ m: undefined, mo, ...x });

const BOSSES: Record<string, BossPart> = {
  manager: {
    call: (b, c) => {
      const t = fig(b, 'brass', 0, SALE_A, EB_ION, -1, 0.3, { mo: 'sale', cut: 2600 });
      fig(b, 'brass', t, c.r.pick([SALE_B, SALE_C]), EB_ION, -1, 0.28, { mo: 'sale', cut: 2600 });
    },
    duel: (b) => {
      const t = fig(b, 'brass', 0, aug(SALE_A, 2), EB_ION, -1, 0.28, { mo: 'sale', cut: 2200 });
      fig(b, 'brass', t, aug(SALE_C, 2), EB_ION, -1, 0.26, { mo: 'sale', cut: 2200 });
    },
    tail: (b, c, t) => { fig(b, 'brass', t, SALE_A.slice(0, 3), EB_ION, -1, 0.2, { mo: 'sale' }); },
    bass: drive,
    drums: fightDrums,
  },
  foreman: {
    call: (b, c) => { fig(b, 'brass', c.r.pick([0, 1]), FOREMAN, C_AEO, -1, 0.32, { mo: 'foreman', cut: 1800 }); },
    // Each statement starts a third higher, like another crate on the stack.
    duel: (b, c) => {
      const lift = c.r.pick([1, 2]);
      fig(b, 'brass', 0, FOREMAN, C_AEO, -1, 0.3, { mo: 'foreman', cut: 1800 });
      fig(b, 'brass', 8, shift(FOREMAN, lift), C_AEO, -1, 0.3, { mo: 'foreman', cut: 1800 });
    },
    tail: (b, c, t) => { fig(b, 'brass', t, FOREMAN.slice(0, 3), C_AEO, -1, 0.22, { mo: 'foreman' }); },
    bass: drive,
    // A stomp on every beat.
    drums: (b, t, g) => {
      for (let k = 0; k < 4; k++) b.hit(t + k, 'taiko', g * (k % 2 ? 0.7 : 1), 0.5);
      b.hit(t, 'kick', g * 0.6, 0.25, { lay: 0.6 });
    },
  },
  warden: {
    call: (b) => {
      fig(b, 'lead', 0.5, SIREN, C_AEO, 0, 0.17, rigid('warden', { cut: 2600 }), 1);
      fig(b, 'lead', 4.5, SIREN, C_AEO, 0, 0.16, rigid('warden', { cut: 2600 }), 1);
    },
    // The siren slows, and its second wail is a step higher.
    duel: (b, c) => {
      fig(b, 'lead', 0.5, aug(SIREN, 2), C_AEO, 0, 0.16, rigid('warden', { cut: 2400 }), 1);
      fig(b, 'lead', 8.5, aug(shift(SIREN, c.r.pick([1, 1, 2])), 2), C_AEO, 0, 0.16, rigid('warden', { cut: 2400 }), 1);
    },
    // Its big attack ends in the beam sweeping the room, and the siren's first wail.
    tail: (b, c, t) => {
      b.hit(t - 0.5, 'scan', 0.06, 2.5, { n: 72 });
      fig(b, 'lead', t, SIREN.slice(0, 2), C_AEO, 0, 0.14, rigid('warden', { cut: 2600 }), 1);
    },
    bass: drive,
    drums: fightDrums,
  },
  forklift: {
    call: (b, c) => {
      fig(b, 'blip', 0, BEEPER, C_AEO, 1, 0.2, rigid('forklift', { pan: -0.4 }));
      fig(b, 'blip', 4, BEEPER, C_AEO, 1, 0.18, rigid('forklift', { pan: -0.4 }));
      if (c.r.chance(0.5)) fig(b, 'brass', 6, [[0, 1], [-3, 1]], C_AEO, -1, 0.2, rigid('forklift'));
    },
    // The beeper twice, each answered by the horn: the tonic, then down to the fifth below.
    duel: (b) => {
      for (const t of [0, 8]) {
        fig(b, 'blip', t, BEEPER, C_AEO, 1, 0.18, rigid('forklift', { pan: -0.4 }));
        fig(b, 'brass', t + 4, [[0, 1.5], [-3, 2]], C_AEO, -1, 0.22, rigid('forklift'));
      }
    },
    tail: (b, c, t) => { fig(b, 'blip', t, BEEPER, C_AEO, 1, 0.18, rigid('forklift', { pan: -0.4 })); },
    // Diesel: the root in quarter notes, roughened by detuning, with an off-beat chug on one and three as the fight turns.
    bass: (b, t, ch, g) => {
      const r = rootOf(C_AEO, ch, 33);
      for (let k = 0; k < 4; k++) b.n('bass', t + k, r, 0.42, g, { cut: 220, det: k % 2 ? 12 : -12 });
      for (const k of [0.5, 2.5]) b.n('bass', t + k, r, 0.42, g * 0.75, { cut: 220, det: 8, lay: 0.5 });
    },
    drums: (b, t, g) => {
      b.hit(t, 'taiko', g, 0.5);
      b.hit(t + 2, 'snare', g * 0.5, 0.25, { lay: 0.3 });
    },
  },
  cook: {
    call: (b, c) => {
      fig(b, 'arp', 0, FLIP, C_AEO, 0, 0.26, { mo: 'cook', cut: 2200 });
      // Orders pile up as the fight turns, and the second toss goes a third higher.
      fig(b, 'arp', 4, c.int >= 0.5 ? shift(FLIP, 2) : FLIP, C_AEO, 0, 0.24, { mo: 'cook', cut: 2200 });
      orderUp(b, c.r.pick([13.5, 14]), C_AEO, 0.13, { mo: 'cook' });
      griddle(b, 16);
    },
    // The spatula turns the figure over, so the second toss drops first and climbs back up.
    duel: (b) => {
      fig(b, 'arp', 0, FLIP, C_AEO, 0, 0.26, { mo: 'cook', cut: 2000 });
      fig(b, 'arp', 8, inv(FLIP, 3.5), C_AEO, 0, 0.24, { mo: 'cook', cut: 2000 });
      griddle(b, 16);
    },
    // Its charge ends in a skid across its own grease: the sizzle flares, and a held note slides down a fourth.
    tail: (b, c, t) => {
      b.hit(t - 0.5, 'sizzle', 0.08, 2.5);
      fig(b, 'arp', t, FLIP.slice(0, 2), C_AEO, 0, 0.22, { mo: 'cook', cut: 2200 });
      b.n('lead', t + 1, C_AEO(4), 1.5, 0.15, { mo: 'cook', bend: -5, cut: 1800 });
    },
    // A bouncing bass: the root, the fifth off the beat, the root again, and one more bounce as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 33);
      b.n('bass', t, r, 0.45, g, { cut: 460 });
      b.n('bass', t + 1.5, r + 7, 0.3, g * 0.8, { cut: 520 });
      b.n('bass', t + 2, r, 0.45, g * 0.9, { cut: 460 });
      if (fill) b.n('bass', t + 3.5, r + 7, 0.3, g * 0.7, { cut: 520, lay: 0.5 });
    },
    // Taiko on one, a snare on three as the fight turns, and a spatula's clack on four.
    drums: (b, t, g) => {
      b.hit(t, 'taiko', g, 0.5);
      b.hit(t + 2, 'snare', g * 0.5, 0.25, { lay: 0.3 });
      b.hit(t + 3, 'tick', g * 0.5, 0.05);
    },
  },
  arcade: {
    // The attract loop over the first two chords. From intensity 0.6 the second loop pauses halfway, and the pause blip
    // takes its place. Another pause blip arrives at 0.3 near the section's end.
    call: (b, c) => {
      const loop = shift(ATTRACT, -2);
      fig(b, 'arp', 0, ATTRACT, C_AEO, 0, 0.27, rigid('arcade', { cut: 3000 }));
      fig(b, 'arp', 4, loop.slice(0, 4), C_AEO, 0, 0.25, rigid('arcade', { cut: 3000 }));
      fig(b, 'arp', 6, loop.slice(4, 6), C_AEO, 0, 0.25, rigid('arcade', { cut: 3000, top: 0.6 }));
      pauseBlip(b, 6, 0.12, { lay: 0.6 });
      pauseBlip(b, c.r.pick([14, 14.5]), 0.1, { lay: 0.3 });
    },
    // The cabinet warps to the spot mirrored across the room, and its loop comes back mirrored.
    duel: (b) => {
      fig(b, 'arp', 0, ATTRACT, C_AEO, 0, 0.27, rigid('arcade', { cut: 2600 }));
      fig(b, 'arp', 8, inv(ATTRACT, 4.5), C_AEO, 0, 0.25, rigid('arcade', { cut: 2600 }));
      pauseBlip(b, 15, 0.1, { lay: 0.3 });
    },
    // Its big attack ends in a warp: a beam crosses the room, and the loop starts again mirrored.
    tail: (b, c, t) => {
      b.hit(t - 0.5, 'scan', 0.05, 2, { n: 72 });
      fig(b, 'arp', t, inv(ATTRACT, 4.5).slice(0, 3), C_AEO, 0, 0.25, rigid('arcade', { cut: 3000 }));
    },
    // A chip bass: the root twice, the fifth on three, and the fifth again before the next bar as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 33);
      b.n('bass', t, r, 0.4, g, { cut: 500 });
      b.n('bass', t + 0.5, r, 0.4, g * 0.8, { cut: 500 });
      b.n('bass', t + 2, r + 7, 0.8, g * 0.9, { cut: 500 });
      if (fill) b.n('bass', t + 3.5, r + 7, 0.3, g * 0.7, { cut: 500, lay: 0.5 });
    },
    // A kick on one, a snare on three as the fight turns, and a second kick after it from 0.6.
    drums: (b, t, g) => {
      b.hit(t, 'kick', g * 0.8, 0.25);
      b.hit(t + 2, 'snare', g * 0.5, 0.25, { lay: 0.3 });
      b.hit(t + 2.5, 'kick', g * 0.5, 0.25, { lay: 0.6 });
    },
  },
  gardener: {
    // The waltz, then the watering can. Another can pours near the end from intensity 0.4.
    call: (b, c) => {
      fig(b, 'lead', 0, GARDEN, C_AEO, 0, 0.24, { mo: 'gardener', cut: 1400 }, 0.98);
      can(b, 6, 0.15);
      can(b, c.r.pick([14, 14.5]), 0.13, { lay: 0.4 });
    },
    // The Gardener answers itself a third lower, the way it sows one lane and then the other.
    duel: (b) => {
      fig(b, 'lead', 0, GARDEN, C_AEO, 0, 0.24, { mo: 'gardener', cut: 1300 }, 0.98);
      fig(b, 'lead', 9, shift(GARDEN, -2), C_AEO, 0, 0.23, { mo: 'gardener', cut: 1300 }, 0.98);
      can(b, 15, 0.13, { lay: 0.4 });
    },
    // Its big attack ends in a spray: the can pours, and the waltz starts again.
    tail: (b, c, t) => {
      can(b, t - 0.5, 0.15);
      fig(b, 'lead', t + 0.5, GARDEN.slice(0, 2), C_AEO, 0, 0.22, { mo: 'gardener', cut: 1400 }, 0.98);
    },
    // A waltz across the fight's four-beat bars: the bass on every third beat of the section, the root and the fifth by
    // turns, with a pickup before each as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 33);
      for (let k = t; k < t + 4; k++) {
        if (k % 3 === 0) b.n('bass', k, k % 6 === 0 ? r : r + 7, 1.2, g, { cut: 380 });
        else if (fill && k % 3 === 2) b.n('bass', k + 0.5, r + 7, 0.3, g * 0.6, { cut: 380, lay: 0.5 });
      }
    },
    // The oom on a soft taiko, and the pah-pah on brushed ticks from intensity 0.3.
    drums: (b, t, g) => {
      for (let k = t; k < t + 4; k++) {
        if (k % 3 === 0) b.hit(k, 'taiko', g * 0.8, 0.5);
        else b.hit(k, 'tick', g * 0.45, 0.04, { lay: 0.3 });
      }
    },
  },
  mainframe: {
    // The clock over the first two chords. Data bursts thicken as the fight turns: one from intensity 0.25, another
    // from 0.5, and a third from 0.75.
    call: (b, c) => {
      fig(b, 'blip', 0, CLOCK, C_AEO, 1, 0.27, rigid('mainframe'));
      fig(b, 'blip', 4, shift(CLOCK, -2), C_AEO, 1, 0.26, rigid('mainframe'));
      burst(b, c.r.pick([6, 6.5, 7]), { lay: 0.25 });
      burst(b, 13, { lay: 0.5 });
      burst(b, 14.5, { lay: 0.75 });
    },
    // In the duel the clock runs forward and then backward.
    duel: (b) => {
      fig(b, 'blip', 0, CLOCK, C_AEO, 1, 0.27, rigid('mainframe'));
      fig(b, 'blip', 8, retro(CLOCK), C_AEO, 1, 0.26, rigid('mainframe'));
      burst(b, 5, { lay: 0.25 });
      burst(b, 13, { lay: 0.5 });
      burst(b, 15, { lay: 0.75 });
    },
    // Its big attack ends in a burst of data and the clock starting again.
    tail: (b, c, t) => {
      burst(b, t - c.r.pick([0.5, 1]));
      fig(b, 'blip', t + 0.5, CLOCK.slice(0, c.r.pick([3, 4, 5])), C_AEO, 1, 0.24, rigid('mainframe'));
    },
    // A machine's pulse: the root on one and the fifth on three, and the root again before three as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 33);
      b.n('bass', t, r, 0.45, g, { cut: 420 });
      b.n('bass', t + 2, r + 7, 0.45, g * 0.85, { cut: 420 });
      if (fill) b.n('bass', t + 1.5, r, 0.3, g * 0.7, { cut: 420, lay: 0.5 });
    },
    // A kick on one, and a clock's tick on two and four from intensity 0.3.
    drums: (b, t, g) => {
      b.hit(t, 'kick', g * 0.8, 0.25);
      b.hit(t + 1, 'tick', g * 0.5, 0.04, { lay: 0.3 });
      b.hit(t + 3, 'tick', g * 0.5, 0.04, { lay: 0.3 });
    },
  },
  valet: {
    // The shuffle, then again a step lower over the second chord. From intensity 0.4 its keys jingle near the end.
    call: (b, c) => {
      swing(b, 'lead', 0, VALET, C_AEO, 0, 0.26, { mo: 'valet', cut: 1500 });
      swing(b, 'lead', 4, shift(VALET, -2), C_AEO, 0, 0.25, { mo: 'valet', cut: 1500 });
      keyRing(b, c.r.pick([13.5, 14]), 0.1, { lay: 0.4 });
    },
    // The Valet walks the lot and back: the shuffle, then the same steps in reverse.
    duel: (b) => {
      swing(b, 'lead', 0, VALET, C_AEO, 0, 0.26, { mo: 'valet', cut: 1400 });
      swing(b, 'lead', 8, retro(VALET), C_AEO, 0, 0.25, { mo: 'valet', cut: 1400 });
      keyRing(b, 15, 0.1, { lay: 0.4 });
    },
    // After its big attack a car horn honks twice and the shuffle sets off again.
    tail: (b, c, t) => {
      for (const k of [0, 0.5]) b.n('brass', t + k, C_AEO(4) - 12, 0.3, 0.2, { mo: 'valet', cut: 1600 });
      swing(b, 'lead', t + 1, VALET.slice(0, 3), C_AEO, 0, 0.18, { mo: 'valet', cut: 1500 });
    },
    // A boogie bass on the beats: the root, the fifth, the sixth, and the fifth, with a swung pickup as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 28);
      [r, r + 7, r + 9, r + 7].forEach((n, k) => b.n('bass', t + k, n, 0.6, g * (k % 2 ? 0.8 : 1), { cut: 420 }));
      if (fill) b.n('bass', t + sw(3.5), r + 10, 0.25, g * 0.6, { cut: 420, lay: 0.5 });
    },
    // A kick on one and a brush on three as the fight turns.
    drums: (b, t, g) => {
      b.hit(t, 'kick', g * 0.7, 0.25);
      b.hit(t + 2, 'tick', g * 0.5, 0.04, { lay: 0.3 });
    },
  },
  usher: {
    // The march on muted brass, quiet. Its flashlight clicks arrive as the fight turns: one from 0.3, two more from 0.6.
    call: (b) => {
      fig(b, 'brass', 0, USHER, C_AEO, -1, 0.18, { mo: 'usher', cut: 900 });
      flashClick(b, 12, { lay: 0.3 });
      flashClick(b, 13.5, { lay: 0.6 });
      flashClick(b, 14, { lay: 0.6 });
    },
    // The march again, then a step lower, as the Usher walks the aisle and turns back.
    duel: (b) => {
      fig(b, 'brass', 0, USHER, C_AEO, -1, 0.17, { mo: 'usher', cut: 850 });
      fig(b, 'brass', 8, shift(USHER, -2), C_AEO, -1, 0.16, { mo: 'usher', cut: 850 });
      flashClick(b, 7.5, { lay: 0.3 });
      flashClick(b, 15, { lay: 0.6 });
    },
    // After its big attack the flashlight sweeps the aisle, clicks twice, and the march resumes.
    tail: (b, c, t) => {
      b.hit(t - 0.5, 'scan', 0.05, 2, { n: 70 });
      flashClick(b, t);
      flashClick(b, t + 0.5);
      fig(b, 'brass', t + 1, USHER.slice(0, 2), C_AEO, -1, 0.15, { mo: 'usher', cut: 900 });
    },
    // A march bass: the root on one and three, and the fifth before the next bar as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 33);
      b.n('bass', t, r, 0.8, g * 0.8, { cut: 300 });
      b.n('bass', t + 2, r, 0.8, g * 0.7, { cut: 300 });
      if (fill) b.n('bass', t + 3, r + 7, 0.6, g * 0.5, { cut: 300, lay: 0.5 });
    },
    // A soft taiko on one and brushed snares on two and four, all hushed.
    drums: (b, t, g) => {
      b.hit(t, 'taiko', g * 0.5, 0.5);
      b.hit(t + 1, 'snare', g * 0.3, 0.25);
      b.hit(t + 3, 'snare', g * 0.3, 0.25);
    },
  },
  jack: {
    // The crank turns and the clown springs on the last beat, then a second wind springs a step higher. A crank's
    // ratchet runs under it from intensity 0.3.
    call: (b, c) => {
      jackTune(b, 0, 0, 0.22);
      jackTune(b, 4, c.r.pick([1, 2]), 0.21);
      b.hit(0, 'ratchet', 0.03, 7, { mo: 'jack', lay: 0.3 });
    },
    // The box is wound tighter: the tune, then again two steps up.
    duel: (b, c) => {
      jackTune(b, 0, 0, 0.22);
      jackTune(b, 8, c.r.pick([2, 3]), 0.21);
      b.hit(8, 'ratchet', 0.03, 3, { mo: 'jack', lay: 0.3 });
    },
    // Its big attack ends in a spring that wobbles as it settles.
    tail: (b, c, t) => {
      b.hit(t - 0.5, 'swell', 0.05, 0.5);
      b.n('glass', t, C_AEO(11) + 12, 1.5, 0.15, rigid('jack', { bend: -1 }));
    },
    // A wind-up bounce: the root on one and the fifth on three, with the fifth again as the fight turns.
    bass: (b, t, ch, g, fill) => {
      const r = rootOf(C_AEO, ch, 33);
      b.n('bass', t, r, 0.5, g, { cut: 450 });
      b.n('bass', t + 2, r + 7, 0.5, g * 0.85, { cut: 450 });
      if (fill) b.n('bass', t + 3, r + 7, 0.3, g * 0.6, { cut: 450, lay: 0.5 });
    },
    // A taiko on one and two clockwork ticks on the triplets of beat two.
    drums: (b, t, g) => {
      b.hit(t, 'taiko', g * 0.8, 0.5);
      b.hit(t + 1 + T3, 'tick', g * 0.5, 0.04);
      b.hit(t + 1 + 2 * T3, 'tick', g * 0.4, 0.04);
    },
  },
};

/** The boss the fight is against. Sections read it as they are generated, so a change lands at the next section. */
let bossKind = 'manager';
/** The boss the Static copies in the finale, or 'true' for its own face. */
let finalForm = 'true';
export const BOSS_KINDS = Object.keys(BOSSES);
export const FINAL_FORMS = ['manager', 'cook', 'gardener', 'valet', 'true'];
export function setBossKind(kind: string): void {
  if (Object.prototype.hasOwnProperty.call(BOSSES, kind)) bossKind = kind;
  if (FINAL_FORMS.includes(kind)) finalForm = kind;
}
const part = () => BOSSES[bossKind];

/** Every boss fight shares one frame: the drive, the drums, the choir as the fight turns, and Pilcrow answering the boss's figure. */
const boss: TrackDef = {
  bpm: 100, start: 'intro', vary: 0.35, wrong: 0.03, echo: 0.35, verb: 0.7, wobble: 3, level: 0.6,
  graph: {
    intro: [['pitch', 1]],
    pitch: [['pitch', 1], ['duel', 2], ['slam', 1]],
    duel: [['pitch', 2], ['slam', 1]],
    slam: [['pitch', 1], ['duel', 1]],
  },
  secs: {
    // The entrance belongs to no boss, so Music.setBoss can follow Music.play before any boss's figure sounds.
    intro: () => {
      const b = new B(8, 4, 100);
      b.n('drone', 0, 36, 8, 0.22, { a: 1 });
      b.n('sub', 0, 36, 8, 0.3, { a: 1 });
      [0, 2, 4, 5, 6, 6.5, 7, 7.5].forEach((t, i) => b.hit(t, 'taiko', 0.07 + i * 0.012, 0.5));
      b.hit(6, 'swell', 0.1, 2);
      return b.out({ still: true });
    },
    pitch: (c: Ctx) => {
      const b = new B(16, 4, bossBpm(c)), p = part();
      b.n('drone', 0, 36, 16, 0.2);
      BOSS_CH.forEach((ch, i) => {
        p.bass(b, i * 4, ch, 0.26, true);
        p.drums(b, i * 4, 0.16);
      });
      for (const i of [0, 2]) for (const n of tones(C_AEO, BOSS_CH[i], 55).slice(0, 3)) b.n('choir', i * 4, n, 7.8, 0.16, { ah: 1, lay: 0.75 });
      // The boss's figure, and Pilcrow's answer.
      p.call(b, c);
      pilcrow(b, c.r.pick([8, 8.5, 9]), C_AEO, c.int >= 0.5 && c.r.chance(0.5) ? 1 : 0, 0.24);
      return b.out();
    },
    duel: (c: Ctx) => {
      const b = new B(16, 4, bossBpm(c)), p = part();
      b.n('drone', 0, 36, 16, 0.18);
      BOSS_CH.forEach((ch, i) => {
        p.bass(b, i * 4, ch, 0.24, false);
        p.drums(b, i * 4, 0.15);
      });
      // The boss's figure, slowed or stacked, and Pilcrow's against it twice, an octave up once the fight turns.
      p.duel(b, c);
      pilcrow(b, 1, C_AEO, 0, 0.24);
      pilcrow(b, 9, C_AEO, c.int >= 0.5 ? 1 : 0, 0.22);
      return b.out();
    },
    slam: (c: Ctx) => {
      const b = new B(8, 4, bossBpm(c));
      // The boss winds up over a held chord, the fourth beat has only the drone, and its big attack lands.
      const hold = c.r.pick(BOSS_CH), land = c.r.pick([BOSS_CH[0], BOSS_CH[1]]), rise = c.r.pick([1, 1.5]);
      b.n('drone', 0, 36, 8, 0.2);
      brass(b, C_AEO, 0, hold, 3, 0.16, { a: 0.3 });
      b.hit(rise, 'swell', 0.1, 3 - rise);
      b.hit(4, 'boom', 0.11, 1);
      b.hit(4, 'taiko', 0.19, 0.5);
      b.hit(5.5, 'taiko', 0.13, 0.5);
      b.n('sub', 4, 36, 3.5, 0.26);
      brass(b, C_AEO, 4, land, 2.5, 0.2, { cut: 1600 });
      part().tail(b, c, c.r.pick([5.5, 6]));
      return b.out();
    },
  },
};

/** The Overtime rematch: the same fight with more tape drift and more room. */
const postboss: TrackDef = { ...boss, wobble: 7, echo: 0.5, verb: 1 };


// ---------------------------------------------------------------- the Static (area 15's fight)

/** The Static: Tilde's wave turned upside down, as if the noise had learned her song from the inside. */
const STATIC: Fig = inv(TILDE, 3.5);

/** The Static's line on the narrow lead, each note pulled sharp or flat and every third note torn by a glitch. */
function staticLine(b: B, c: Ctx, t: number, f: Fig, oct: number, g: number, x: X = {}): number {
  f.forEach(([d, len], i) => {
    if (d !== null) {
      b.n('cold', t, C_AEO(d) + 12 * oct, len * 0.9, g, { mo: 'static', det: i % 2 ? 38 : -38, cut: 1900, ...x });
      if (i % 3 === 0) b.hit(t, 'glitch', 0.06, len * 0.6, { pan: c.r.range(-0.6, 0.6) });
    }
    t += len;
  });
  return t;
}

/** The final fight runs faster than any boss before it, and faster again once a stage is half won. */
const finalBpm = (c: Ctx) => (c.int >= 0.5 ? 128 : 116);
/** The four bosses the Static copies before it shows its own face. */
const COPIED = ['manager', 'cook', 'gardener', 'valet'];

/** The fight's percussion over the copied boss's own: a kick on one and three once a stage turns, and the channel crackling. */
function staticDrums(b: B, c: Ctx, t: number, g: number): void {
  for (const k of [0, 2]) b.hit(t + k, 'kick', g * 0.7, 0.25, { lay: 0.6 });
  if (c.r.chance(0.5)) b.hit(t + c.r.pick([1.5, 3.5]), 'glitch', g * 0.4, 0.3, { pan: c.r.range(-0.7, 0.7) });
}

/** In the copied stages the fight wears that boss's figures, and in the last stage it borrows one at random each time. */
function copied(c: Ctx): BossPart {
  return BOSSES[finalForm === 'true' ? c.r.pick(COPIED) : finalForm] ?? BOSSES.manager;
}

/** The finale: one fight across five stages. Each stage wears the boss the Static copies, and the Static plays its own
 * inverted Tilde against it. Her real wave comes back torn and mends as each stage is won. */
const final: TrackDef = {
  bpm: 116, start: 'intro', vary: 0.35, wrong: 0.06, echo: 0.4, verb: 0.8, wobble: 9, level: 0.48,
  next: (cur: string, c: Ctx) => {
    if (cur === 'intro') return 'pitch';
    const rift = finalForm === 'true' ? 3 : 1;
    if (cur === 'slam') return c.r.weighted([['pitch', 2], ['rift', rift]]);
    if (cur === 'rift') return c.r.weighted([['pitch', 2], ['duel', 1]]);
    return c.r.weighted([['pitch', 1], ['duel', 2], ['slam', 1], ['rift', rift]]);
  },
  secs: {
    // The channel tears open: noise rises, the drums gather, and the Static's first three notes cut through.
    intro: (c: Ctx) => {
      const b = new B(8, 4, 116);
      b.n('drone', 0, 36, 8, 0.24, { a: 1, det: -20 });
      b.n('sub', 0, 36, 8, 0.3, { a: 1 });
      b.hit(0, 'hiss', 0.1, 8, { a: 2 });
      [0, 2, 4, 5, 6, 6.5, 7, 7.25, 7.5, 7.75].forEach((t, i) => b.hit(t, 'taiko', 0.07 + i * 0.01, 0.5));
      staticLine(b, c, 4, STATIC.slice(0, 3), 0, 0.2);
      b.hit(6, 'swell', 0.1, 2);
      return b.out({ still: true });
    },
    pitch: (c: Ctx) => {
      const b = new B(16, 4, finalBpm(c)), p = copied(c);
      b.n('drone', 0, 36, 16, 0.2, { det: -15 });
      BOSS_CH.forEach((ch, i) => {
        p.bass(b, i * 4, ch, 0.26, true);
        p.drums(b, i * 4, 0.16);
      });
      for (const i of [0, 2]) for (const n of tones(C_AEO, BOSS_CH[i], 55).slice(0, 3)) b.n('choir', i * 4, n, 7.8, 0.15, { ah: 1, lay: 0.5 });
      // The copied figure, and the Static answering it in its own voice.
      p.call(b, c);
      staticLine(b, c, c.r.pick([8, 8.5]), STATIC, 0, 0.17);
      return b.out();
    },
    duel: (c: Ctx) => {
      const b = new B(16, 4, finalBpm(c)), p = copied(c);
      b.n('drone', 0, 36, 16, 0.18, { det: -15 });
      BOSS_CH.forEach((ch, i) => {
        p.bass(b, i * 4, ch, 0.24, false);
        p.drums(b, i * 4, 0.15);
        if (i % 2) staticDrums(b, c, i * 4, 0.15);
      });
      // The copied figure slowed or stacked, and Pilcrow against it, then against the Static.
      p.duel(b, c);
      pilcrow(b, 1, C_AEO, 0, 0.23);
      pilcrow(b, 9, C_AEO, c.int >= 0.5 ? 1 : 0, 0.21);
      return b.out();
    },
    slam: (c: Ctx) => {
      const b = new B(8, 4, finalBpm(c));
      const hold = c.r.pick(BOSS_CH), land = c.r.pick([BOSS_CH[0], BOSS_CH[1]]), rise = c.r.pick([1, 1.5]);
      b.n('drone', 0, 36, 8, 0.2, { det: -15 });
      brass(b, C_AEO, 0, hold, 3, 0.16, { a: 0.3, det: 20 });
      b.hit(rise, 'swell', 0.1, 3 - rise);
      b.hit(3, 'glitch', 0.1, 1);
      b.hit(4, 'boom', 0.11, 1);
      b.hit(4, 'taiko', 0.19, 0.5);
      b.hit(5.5, 'taiko', 0.13, 0.5);
      b.n('sub', 4, 36, 3.5, 0.26);
      brass(b, C_AEO, 4, land, 2.5, 0.2, { cut: 1600 });
      copied(c).tail(b, c, c.r.pick([5.5, 6]));
      return b.out();
    },
    // The Static's own face: its inverted wave twice, low and then high, while Tilde's wave comes back through it torn.
    // Her torn notes return as the stage is won, the way they return in the title as the chips come home.
    rift: (c: Ctx) => {
      const b = new B(16, 4, finalBpm(c));
      b.n('drone', 0, 36, 16, 0.22, { det: -25 });
      b.n('drone', 0, 43, 16, 0.1, { det: 25, a: 2 });
      b.hit(0, 'hiss', 0.06, 16, { a: 1 });
      BOSS_CH.forEach((ch, i) => {
        drive(b, i * 4, ch, 0.24, true);
        b.hit(i * 4, 'taiko', 0.15, 0.5);
        staticDrums(b, c, i * 4, 0.15);
      });
      for (const n of tones(C_AEO, BOSS_CH[c.r.pick([0, 2])], 55).slice(0, 3)) b.n('choir', 0, n, 15.5, 0.14, { ah: 0.3, det: c.r.pick([-30, 30]) });
      staticLine(b, c, 0, STATIC, -1, 0.2);
      staticLine(b, c, 8, STATIC, 0, 0.18);
      torn(b, c, 'glass', 4, TILDE.slice(0, 4), C_AEO, 1, 0.15, 0.6, { pan: -0.35 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 15: the Atrium

const D_PHR = key(62, MODE.phr);
/** The Atrium's changes: the tonic minor, the flat second's major seventh, the tonic again, and the flat seventh suspended. */
const ATRIUM: readonly Ch[] = [[0, 'madd9'], [1, 'maj7s11'], [0, 'm7'], [10, 'sus4']];

/** A dead channel: two copies of each chord pulled apart in tune, so they beat against each other like a bad signal. */
function deadPad(b: B, t: number, c: Ch, d: number, g: number): void {
  tones(D_PHR, c, 53).slice(0, 3).forEach((n, i) => {
    b.n('pad', t, n, d - 0.5, g, { det: -22, a: 1.5 });
    if (i) b.n('pad', t, n, d - 0.5, g * 0.7, { det: 19, a: 2 });
  });
}

/** Tilde's wave with the static still in it: whatever the mend, two of its notes are always lost in the noise. */
function stuck(b: B, c: Ctx, t: number, f: Fig, K: Key, oct: number, g: number, x: X = {}): number {
  const lost = new Set([c.r.int(f.length), c.r.int(f.length)]);
  f.forEach(([d, len], i) => {
    if (d !== null) {
      if (lost.has(i)) b.hit(t, 'glitch', 0.08, len * 0.8, { pan: x.pan ?? 0 });
      else b.n('glass', t, K(d) + 12 * oct, len * 0.95, g, { m: 1, mo: 'tilde', det: c.r.range(-25, 10), ...x });
    }
    t += len;
  });
  return t;
}

/** The Atrium: the mall's center, where the static has pooled. A dead channel's hiss, detuned chords, and Tilde's wave
 * heard through the noise. */
const area15: TrackDef = {
  bpm: 58, start: 'tune', vary: 0.3, wrong: 0.05, echo: 0.6, verb: 1, wobble: 12, level: 0.64,
  graph: {
    tune: [['hall', 1]],
    hall: [['hall', 1], ['tilde', 2], ['hush', 1]],
    tilde: [['hall', 2], ['hush', 1]],
    hush: [['hall', 2], ['tilde', 1]],
  },
  secs: {
    // Tuning in: the hiss rises, the drive head seeks, and the first chord drifts in out of tune.
    tune: (c: Ctx) => {
      const b = new B(16, 4, 58);
      b.hit(0, 'hiss', 0.1, 16, { a: 4 });
      b.n('drone', 0, 38, 16, 0.32, { a: 4, det: -18 });
      [3, 6.5, 11].forEach((t) => b.hit(t, 'seek', 0.05, 0.4, { pan: c.r.range(-0.5, 0.5) }));
      deadPad(b, 8, ATRIUM[0], 8, 0.07);
      return b.out({ still: true });
    },
    hall: (c: Ctx) => {
      const b = new B(32, 4, 58);
      b.n('drone', 0, 38, 32, 0.26, { det: -12 });
      b.hit(0, 'hiss', 0.05, 32, { a: 3 });
      ATRIUM.forEach((ch, i) => {
        deadPad(b, i * 8, ch, 8, 0.065);
        sub(b, D_PHR, i * 8, ch, 8, 0.24);
      });
      // A far bell now and then, and Pilcrow walking through the hall.
      for (let k = 0; k < 3; k++) b.n('glass', 2 + k * 9 + c.r.int(3), fold(D_PHR(c.r.pick([4, 6, 8, 9])), 74), 2.5, 0.1, { pan: c.r.range(-0.5, 0.5), det: -15 });
      if (c.r.chance(0.6)) pilcrow(b, c.r.pick([16, 17]), D_PHR, 0, 0.18);
      ticks(b, c, 32, 5, 0.07);
      if (c.r.chance(0.5)) b.hit(c.r.range(4, 28), 'seek', 0.04, 0.4);
      return b.out();
    },
    // A short quote of Tilde's theme, the static still in it, and the chords holding their breath around it.
    tilde: (c: Ctx) => {
      const b = new B(16, 4, 58);
      b.n('drone', 0, 38, 16, 0.28, { det: -12 });
      b.hit(0, 'hiss', 0.06, 16, { a: 2 });
      deadPad(b, 0, ATRIUM[0], 8, 0.06);
      deadPad(b, 8, ATRIUM[c.r.pick([1, 3])], 8, 0.06);
      sub(b, D_PHR, 0, ATRIUM[0], 16, 0.22);
      stuck(b, c, 2, TILDE.slice(0, 6), D_PHR, 0, 0.2, { pan: 0.2 });
      ticks(b, c, 16, 3, 0.06);
      return b.out();
    },
    hush: (c: Ctx) => {
      const b = new B(16, 4, 58);
      b.n('drone', 0, 38, 16, 0.3, { det: -18 });
      b.n('drone', 0, 39, 16, 0.08, { a: 6 });
      b.hit(0, 'hiss', 0.08, 16, { a: 2 });
      for (const n of tones(D_PHR, ATRIUM[0], 55).slice(0, 3)) b.n('choir', 2, n, 12, 0.11, { ah: 0, det: -20 });
      b.hit(c.r.range(4, 12), 'glitch', 0.07, 0.5);
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- the ending

/** The ending: Tilde's theme with the static gone. It starts soft at the nest, and opens up as she floats out, 2.4 s in. */
const ending: TrackDef = {
  bpm: 75, start: 'nest', vary: 0.25, wrong: 0, echo: 0.55, verb: 0.9, wobble: 2, level: 0.7,
  graph: {
    nest: [['rise', 1]],
    rise: [['together', 1]],
    together: [['together', 1], ['float', 1]],
    float: [['together', 2], ['rise', 1]],
  },
  secs: {
    // Three beats at 75 bpm: the 2.4 s before Tilde rises, with only the drone and her first note.
    nest: () => {
      const b = new B(3, 3, 75);
      b.n('drone', 0, 38, 3, 0.26, { a: 1.5 });
      b.n('glass', 1, D_ION(2) + 12, 2, 0.1, { mo: 'tilde' });
      return b.out({ still: true });
    },
    // She floats out: the chords open and her wave comes home in full.
    rise: (c: Ctx) => {
      const b = new B(16, 4, 75);
      b.n('drone', 0, 38, 16, 0.26);
      TITLE_A.slice(0, 2).forEach((ch, i) => {
        strings(b, D_ION, i * 8, ch, 8, 0.13, 53, { a: 0.4 });
        sub(b, D_ION, i * 8, ch, 8, 0.32);
        arpeggio(b, D_ION, i * 8, ch, 8, 0.5, 0.08, c.r.pick(PATS), { cut: 1100 });
      });
      for (const n of tones(D_ION, [0, 'maj9'], 55).slice(0, 3)) b.n('choir', 0, n, 7.5, 0.12, { ah: 0.8 });
      fig(b, 'bell', 1, TILDE_HOME, D_ION, 1, 0.3, { mo: 'tilde' });
      return b.out();
    },
    // Tilde and Pilcrow together: her wave, his answer, and then both at once.
    together: (c: Ctx) => {
      const b = new B(32, 4, 75);
      b.n('drone', 0, 38, 32, 0.24);
      const chs = c.r.chance(0.5) ? TITLE_A : TITLE_B;
      chs.forEach((ch, i) => {
        strings(b, D_ION, i * 8, ch, 8, 0.11);
        sub(b, D_ION, i * 8, ch, 8, 0.3);
        arpeggio(b, D_ION, i * 8, ch, 8, 1, 0.09, c.r.pick(PATS), { cut: 1000 });
      });
      fig(b, 'bell', 1, TILDE_HOME, D_ION, 1, 0.28, { mo: 'tilde' });
      pilcrow(b, 9, D_ION, 0, 0.22);
      fig(b, 'bell', 17, TILDE_HOME, D_ION, 1, 0.26, { mo: 'tilde' });
      pilcrow(b, 18, D_ION, 1, 0.18);
      return b.out();
    },
    float: (c: Ctx) => {
      const b = new B(16, 4, 75);
      b.n('drone', 0, 38, 16, 0.28);
      strings(b, D_ION, 0, [0, 'maj9'], 16, 0.1, 53, { a: 2 });
      sub(b, D_ION, 0, [0, 'maj9'], 16, 0.26);
      for (const n of tones(D_ION, [0, 'maj9'], 55).slice(0, 3)) b.n('choir', 4, n, 11.5, 0.1, { ah: 0 });
      fig(b, 'glass', 2, aug(TILDE_HOME, c.r.pick([1, 1.5])), D_ION, 1, 0.16, { mo: 'tilde', pan: 0.3 });
      return b.out();
    },
  },
};

// ---------------------------------------------------------------- area 16: After Hours

const G_ION = key(67, MODE.ion);
/** Dawn over the mall: the tonic, the third's minor seventh, the sixth's minor ninth, and the fourth with an added ninth. */
const DAWN: readonly Ch[] = [[0, 'maj9'], [4, 'm7'], [9, 'm9'], [5, 'add9']];

/** After Hours: the mall at dawn, after the game. Warm chords, a slow piano, and Tilde's wave at home. */
const area16: TrackDef = {
  bpm: 72, start: 'dawn', vary: 0.3, wrong: 0.02, echo: 0.5, verb: 0.9, wobble: 3, level: 0.64,
  graph: {
    dawn: [['shop', 1]],
    shop: [['shop', 1], ['tilde', 2], ['still', 1]],
    tilde: [['shop', 2], ['still', 1]],
    still: [['shop', 1], ['tilde', 1]],
  },
  secs: {
    // First light: a swell, the tonic chord rising in, and one bell.
    dawn: () => {
      const b = new B(16, 4, 72);
      b.hit(0, 'swell', 0.05, 6);
      b.n('drone', 0, 43, 16, 0.24, { a: 4 });
      strings(b, G_ION, 4, DAWN[0], 12, 0.1, 53, { a: 3 });
      sub(b, G_ION, 4, DAWN[0], 12, 0.26);
      b.n('bell', 9, G_ION(4), 3, 0.18, { pan: 0.3 });
      return b.out({ still: true });
    },
    shop: (c: Ctx) => {
      const b = new B(32, 4, 72);
      b.n('drone', 0, 43, 32, 0.2);
      DAWN.forEach((ch, i) => {
        strings(b, G_ION, i * 8, ch, 8, 0.1);
        sub(b, G_ION, i * 8, ch, 8, 0.28);
        // A slow piano: the chord on one, its upper notes again on three.
        tones(G_ION, ch, 55).slice(0, 4).forEach((n, k) => b.n('bell', i * 8 + k * 0.05, n, 2.5, 0.08, { ratio: 1 }));
        tones(G_ION, ch, 55).slice(2, 4).forEach((n) => b.n('bell', i * 8 + 4, n, 2, 0.06, { ratio: 1 }));
        b.hit(i * 8 + 2, 'tick', 0.05, 0.05, { pan: 0.2 });
        b.hit(i * 8 + 6, 'tick', 0.05, 0.05, { pan: 0.2 });
      });
      if (c.r.chance(0.7)) pilcrow(b, c.r.pick([16, 17]), G_ION, 0, 0.18);
      return b.out();
    },
    // Tilde at home: her wave reaches the tonic, and Pilcrow answers.
    tilde: (c: Ctx) => {
      const b = new B(32, 4, 72);
      b.n('drone', 0, 43, 32, 0.2);
      DAWN.forEach((ch, i) => {
        strings(b, G_ION, i * 8, ch, 8, 0.1);
        sub(b, G_ION, i * 8, ch, 8, 0.28);
        arpeggio(b, G_ION, i * 8, ch, 8, 1, 0.07, c.r.pick(PATS), { cut: 900 });
      });
      tildeHome(b, 2, G_ION, 0, 0.24);
      pilcrow(b, c.r.pick([20, 21]), G_ION, 0, 0.18);
      return b.out();
    },
    still: (c: Ctx) => {
      const b = new B(16, 4, 72);
      b.n('drone', 0, 43, 16, 0.24);
      strings(b, G_ION, 0, DAWN[c.r.pick([0, 3])], 16, 0.09, 53, { a: 2 });
      sub(b, G_ION, 0, DAWN[0], 16, 0.24);
      for (const n of tones(G_ION, DAWN[0], 55).slice(0, 3)) b.n('choir', 2, n, 12, 0.09, { ah: 0 });
      b.n('glass', c.r.pick([5, 6]), fold(G_ION(c.r.pick([2, 4, 6])), 79), 3, 0.1, { pan: -0.3 });
      return b.out();
    },
  },
};

export const TRACK_DEFS = { title, area0, area1, area2, area3, area4, area5, area6, area7, area8, area9, area10, area11, area12, area13, area14, area15, area16, boss, postboss, final, ending };

// ---------------------------------------------------------------- jingles

const C_ION = key(60, MODE.ion);

export const STINGER_DEFS: Record<string, () => Section> = {
  /** A datachip recovered: Tilde's wave at double speed, and this time the leading tone rises home. */
  clear: () => {
    const b = new B(4.5, 4, 120);
    const end = fig(b, 'bell', 0, aug(TILDE_HOME, 0.5), C_ION, 1, 0.36, { mo: 'tilde' }, 0.95);
    const home = end - 1;
    b.n('sub', 0, 36, 4.2, 0.28);
    for (const n of tones(C_ION, [0, 'maj9'], 60)) b.n('pad', home, n, 2, 0.1, { a: 0.05 });
    [72, 76, 79, 84].forEach((n, i) => b.n('blip', home + i * 0.125, n, 0.4, 0.12, { pan: 0.3 }));
    return b.out({ still: true });
  },
  /** Pilcrow goes down: their repeated tonic, then a fall of a fifth that sags flat. */
  lose: () => {
    const b = new B(2, 4, 100);
    b.n('bell', 0, 74, 0.22, 0.24, { mo: 'pilcrow' });
    b.n('bell', 0.25, 74, 0.22, 0.22, { mo: 'pilcrow' });
    b.n('bell', 0.5, 67, 1.2, 0.24, { mo: 'pilcrow', bend: -1 });
    b.n('sub', 0, 38, 1.6, 0.22);
    return b.out({ still: true });
  },
};
