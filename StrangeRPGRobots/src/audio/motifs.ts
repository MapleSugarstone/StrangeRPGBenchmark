// Fathom's leitmotifs as scale-degree figures, so any track can place them in any key and transform them.
// Degrees are 0-based scale steps (0 is the tonic, 7 the octave, -3 the fifth below). See Notes/music.md.
import type { Fig } from './score-core';

/**
 * The port: a newborn that longs for one person. A small figure rises up the scale and stops on the seventh, one step
 * short of the octave. The octave it never reaches is the first note of Marit's lullaby.
 */
export const PORT: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [6, 2]];
/** The port's first three notes, for quick quotes in battle and in effects. */
export const PORT_HEAD: Fig = [[0, 0.5], [2, 0.5], [4, 1]];
/** The figure resolved: it reaches the octave at last. Only the ending and the credits play it. */
export const PORT_HOME: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [6, 1], [7, 3]];

/**
 * Marit: an old lullaby in three, rocking down by thirds from the octave. Like her sentences it stops partway when
 * she tires, rests, and ends with a short phrase that does come home.
 */
export const MARIT: Fig = [[7, 1], [5, 0.5], [7, 1], [5, 0.5], [4, 1], [5, 0.5], [3, 1], [2, 0.5], [null, 1.5], [1, 0.5], [0, 1]];
/** The lullaby's first bar, the rocking third. */
export const MARIT_HEAD: Fig = [[7, 1], [5, 0.5], [7, 1], [5, 0.5]];

/**
 * The Bailers: Marit's rocking third two octaves down at half speed, on low brass. Her blood woke them, so they walk
 * to her song. Tracks put a stomp under every second beat, a steady gait against the song's long and short notes.
 */
export const BAILER: Fig = [[0, 2], [-2, 1], [0, 2], [-2, 1], [-3, 2]];
/** After Hendrik falls, one Bailer is gone: the last step of the figure never lands. */
export const BAILER_FALLEN: Fig = [[0, 2], [-2, 1], [0, 2], [-2, 1], [null, 2]];

/**
 * The Board: KEEP FATHOM DRY in four cold notes, high, low, step, and down below the tonic. Teun never says "I", so
 * the Board's figure never lands on the tonic.
 */
export const BOARD: Fig = [[4, 1], [1, 0.5], [2, 0.5], [-1, 2]];
/** The one time it does. Teun's last scene says "I" once, and the last boss phase plays this once. */
export const BOARD_I: Fig = [[4, 1], [1, 0.5], [2, 0.5], [0, 2]];

/** Tilly's loop: eight even notes that run round and lead back into their own start, like forty meters of track. */
export const TILLY: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [3, 0.5], [1, 0.5], [3, 0.5], [2, 0.5], [-1, 0.5]];
