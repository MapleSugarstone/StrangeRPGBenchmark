// Gnomon's leitmotifs as scale-degree figures, so any track can place them in any key and transform them.
// Degrees are 0-based scale steps (0 is the tonic, -3 the fifth below). See Notes/music.md for how they connect.
import type { Fig } from './score-core';

/** The giant lead: a low rising fourth, the fifth below up to the tonic. It is the first two notes of Nodus's line. */
export const BIG: Fig = [[-3, 2], [0, 4]];

/** Nodus: a pickup a fourth below, then a ruled line up the scale with one blank where the third belongs. */
export const NODUS: Fig = [[-3, 0.5], [0, 0.5], [1, 0.5], [null, 0.5], [3, 0.5], [4, 1.5]];
/** The entry written: the same line with the blank filled. Only the epilogue and the credits play it. */
export const NODUS_FULL: Fig = [[-3, 0.5], [0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 1.5]];
/** The first notes, played when Nodus records an attack. The blank stays blank. */
export const NODUS_HEAD: Fig = [[-3, 0.5], [0, 0.5], [1, 1]];

/** Parhelia: a warm held note that bends up a step and settles, her lamp turning a lead. */
export const PARH: Fig = [[0, 0.5], [4, 2.5, 0, 1], [3, 0.5], [2, 1.5]];
/** Parhelia's parenthesis: a dry aside an octave down, quieter and more honest than the line before it. */
export const PARH_ASIDE: Fig = [[2, 0.25], [1, 0.25], [null, 0.25], [0, 0.75]];

/** Tik: three notes stepping down toward home that stop one step short. */
export const TIK: Fig = [[4, 1], [3, 1], [1, 2]];
/** The step Tik never takes until the epilogue: up into the third, the note Nodus's line leaves blank. */
export const TIK_HOME: Fig = [[4, 1], [3, 1], [1, 1], [2, 3]];

/**
 * Lot: Tik's three notes and a flick back up. Every onset sits on the eighth grid, and tracks place the figure a
 * sixteenth early, so each note lands a sixteenth before its beat. Lot is Tik's lead, so its notes are Tik's, early.
 */
export const LOT: Fig = [[4, 0.5], [3, 0.5], [1, 1], [3, 0.5], [4, 1]];
/** Places Lot's figures a sixteenth ahead of the beat. */
export const LOT_EARLY = -0.25;

/** Umbraculum: a pompous dotted march that climbs to the octave and ends on two stamps. */
export const UMB: Fig = [[0, 0.75], [0, 0.25], [4, 0.75], [4, 0.25], [7, 1.5], [7, 0.25], [7, 0.25]];

/** Minim: a line that reads the same forward and backward, in pitch and in rhythm. */
export const MINIM: Fig = [[2, 0.5], [4, 1], [3, 0.5], [6, 1], [3, 0.5], [4, 1], [2, 0.5]];
/** Minim after the crack: one word of her reversal gone. */
export const MINIM_CRACKED: Fig = [[2, 0.5], [4, 1], [3, 0.5], [6, 1], [null, 0.5], [4, 1], [2, 0.5]];

/** Anthelion: his sister's held note made square. The same pitch stamped four times, then down by rule, never bent. */
export const ANTH: Fig = [[4, 1], [4, 1], [4, 1], [4, 1], [3, 1], [null, 1], [1, 1], [null, 1]];

/** Stile's square: long warm tones over I, vi, IV, V, two bars each. */
export const STILE: Fig = [
  [2, 2], [1, 1], [0, 1], [4, 4],
  [5, 2], [4, 1], [2, 1], [0, 4],
  [3, 2], [2, 1], [1, 1], [3, 4],
  [4, 3], [3, 1], [1, 4],
];

/** Grisaille cites rule numbers: quick repeated notes in counts of three and five. */
export const RULE: Fig = [[0, 0.25], [0, 0.25], [0, 0.5], [1, 0.25], [1, 0.25], [1, 0.25], [1, 0.25], [1, 0.5], [-1, 1]];

/** The pebble: two notes falling a fourth. Its lead lands first, so tracks give it a pre-note like any lead note. */
export const PEBBLE: Fig = [[4, 0.5], [1, 1.5]];
