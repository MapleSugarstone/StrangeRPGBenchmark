// Leitmotifs as scale-degree figures, so any track can place one in its own key and transform it.
import { Rng, padTo, realize } from './lib';
import type { Fig, Key, Line, MemLine, MotifName } from './lib';
import type { TrackId } from '../audio';

/**
 * The Pilgrim rises by thirds toward the octave and stops on the seventh degree. The tonic that would answer never arrives
 * until the credits. Higher story progress adds hesitations, rests in odd places, a chromatic note, and a second phrase.
 */
const PILGRIM_LEVELS: Fig[] = [
  [[2, 1], [4, 1], [6, 2]],
  [[2, 1], [4, 1], [3, 0.5], [4, 0.5], [6, 2]],
  [[2, 0.5], [4, 0.5], [6, 1], [null, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [null, 1], [3, 0.5], [5, 0.5], [6, 1.5]],
  [[null, 0.5], [2, 0.5], [4, 0.5], [6, 0.5], [null, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [3, 1], [null, 0.5], [5, 0.5], [7, 0.5], [6, 1.5]],
  [[2, 0.5], [3, 0.25], [4, 0.25], [6, 0.5], [5, 0.5], [7, 0.5], [6, 0.5], [4, 0.5], [null, 0.5], [3, 0.5], [5, 0.5], [4, 0.25, -1], [3, 0.25], [2, 0.5], [4, 0.5], [6, 0.5], [8, 1.5]],
];

/** How many levels the Pilgrim's figure has. */
export const PILGRIM_COUNT = PILGRIM_LEVELS.length;

/** The Pilgrim's figure at a story progress, with a seeded variation on its second half. */
export function pilgrim(p: number, r: Rng): Fig {
  const lv = Math.min(PILGRIM_COUNT - 1, Math.floor(Math.max(0, Math.min(1, p)) * (PILGRIM_COUNT - 0.001)));
  const base = PILGRIM_LEVELS[lv];
  if (lv < 2 || !r.chance(0.5)) return padTo(base, 4);
  const mid = Math.floor(base.length / 2);
  const k = r.pick([-1, 1, 2]);
  return padTo(base.map((x, i) => (i >= mid && x[0] !== null && x[0] < 7 ? [x[0] + k, x[1], x[2]] as const : x)), 4);
}

/** Just the first two notes of the figure, for tracks that show the Pilgrim only in pieces. */
export const PILGRIM_HEAD: Fig = [[2, 1], [4, 1.5]];
/** The Pilgrim's last note on its own: the seventh degree, held, with nothing after it. */
export const PILGRIM_TAIL: Fig = [[6, 2.5]];
/** The credits finally play the tonic. */
export const PILGRIM_RESOLVED: Fig = [[2, 1], [4, 1], [6, 1], [7, 4]];

/** The Unraveling: a tight eight-note cog that other voices pile onto. */
export const UNRAVEL: Fig = [[0, 0.5], [0, 0.5], [4, 0.5], [3, 0.5], [0, 0.5], [0, 0.5], [5, 0.5], [4, 0.5]];
/** The Void: a low tone, a long rest, a lower fifth, a longer rest. */
export const VOID: Fig = [[0, 4], [null, 6], [-3, 3], [null, 5]];
/** The Stone: stacked thirds up to the ninth and back, to be doubled a quarter tone off. */
export const STONE: Fig = [[0, 0.5], [2, 0.5], [4, 0.5], [6, 0.5], [8, 0.5], [6, 0.5], [4, 0.5], [2, 0.5]];
/** The Year: a disco bass that hops the octave, and the sad line that sings over it. */
export const YEAR_BASS: Fig = [[0, 0.5], [7, 0.5], [0, 0.5], [7, 0.5], [0, 0.5], [7, 0.5], [5, 0.5], [6, 0.5]];
export const YEAR_LEAD: Fig = [[4, 1], [3, 0.5], [2, 0.5], [3, 1], [1, 1], [0, 2], [null, 2]];
/** The Choice: one note, held. */
export const CHOICE: Fig = [[0, 12], [null, 4]];
/** The Seer: wide leaps, phrased like sentences with a pause after each clause. */
export const SEER: Fig = [[0, 1.5], [5, 1], [2, 0.5], [7, 1.5], [null, 1], [4, 1], [9, 0.5], [7, 1], [null, 2]];
/** Light-Bound #123: a bouncing kitchen tune. */
export const LIGHTBOUND: Fig = [[0, 0.5], [2, 0.25], [4, 0.25], [2, 0.5], [4, 0.5], [7, 1], [6, 0.25], [7, 0.25], [5, 0.5], [4, 0.5], [2, 0.5], [3, 0.25], [4, 0.25], [2, 0.5], [0, 1], [null, 1]];
/** Vorn: a march in fourths with a stumble. */
export const VORN: Fig = [[0, 1], [3, 1], [0, 0.5], [null, 0.5], [3, 1], [6, 0.5, -1], [3, 0.5], [0, 1.5], [null, 0.5]];
/** The Keeper: one note, struck like a typewriter key, and a step at the end of the line. */
export const KEEPER: Fig = [[4, 0.25], [4, 0.25], [4, 0.25], [4, 0.5], [4, 0.25], [4, 0.25], [4, 0.25], [4, 0.5], [5, 0.5], [4, 0.5], [null, 0.5]];

export const MOTIF_FIG: Record<Exclude<MotifName, 'pilgrim'>, Fig> = {
  unravel: UNRAVEL, void: VOID, stone: STONE, year: YEAR_LEAD, choice: CHOICE, seer: SEER, lightbound: LIGHTBOUND, vorn: VORN, keeper: KEEPER,
};

/** The motif as a remembered phrase in a track's home key. */
export function memoryOf(name: MotifName, from: TrackId, K: Key, prog: number): MemLine {
  const fig = name === 'pilgrim' ? pilgrim(prog, new Rng(7)) : MOTIF_FIG[name];
  const line: Line = realize(fig, K, 0);
  return { from, motif: name, line };
}
