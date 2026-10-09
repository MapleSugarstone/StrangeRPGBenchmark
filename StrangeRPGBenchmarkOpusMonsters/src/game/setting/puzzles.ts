// The twelve Setting puzzles, each with the reference machine the content test runs to prove it can be solved.
import type { ArmPart, Io, Machine, Puzzle, Shape, StationPart, Stone } from './core';

const one = (s: Stone): Shape => ({ atoms: [[0, 0, s]], bonds: [] });
const io = (x: number, y: number, shape: Shape): Io => ({ x, y, shape });
const arm = (x: number, y: number, dir: number, tape: string): ArmPart => ({ kind: 'arm', x, y, dir, tape });
const st = (kind: StationPart['kind'], x: number, y: number, dir = 0): StationPart => ({ kind, x, y, dir });
const mach = (...parts: Machine['parts']): Machine => ({ parts });
/** A shape from rows of letters: p pearl, a amber, g beach glass, s star glass. Bonds join every pair of neighbors. */
function shape(rows: string[], bonds: [number, number][]): Shape {
  const key: Record<string, Stone> = { p: 'pearl', a: 'amber', g: 'glass', s: 'star', n: 'nacre', r: 'resin', b: 'pebble', c: 'chip' };
  const atoms: Shape['atoms'] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (key[c]) atoms.push([x, y, key[c]]); }));
  return { atoms, bonds };
}
const lim = (arm: number, polish = 0, set = 0, split = 0) => ({ arm, polish, set, split });

export const PUZZLES: Puzzle[] = [
  {
    id: 'g1', name: 'First Setting', idea: 'Grab a pearl, turn, and drop it in the setting.',
    w: 6, h: 4, inputs: [io(1, 1, one('pearl'))], outputs: [io(3, 1, one('pearl'))], need: 4, limit: lim(1),
    ref: mach(arm(2, 1, 2, 'GRRDLL')),
  },
  {
    id: 'g2', name: 'Polish', idea: 'A polisher turns rough nacre into pearl. Drop it there.',
    w: 6, h: 4, inputs: [io(1, 1, one('nacre'))], outputs: [io(3, 1, one('pearl'))], need: 4, limit: lim(1, 1),
    ref: mach(arm(2, 1, 2, 'GRDGRDLL'), st('polish', 2, 0)),
  },
  {
    id: 'g3', name: 'Long Reach', idea: 'Reach out and pull in to carry a stone two cells.',
    w: 7, h: 5, inputs: [io(1, 2, one('pearl'))], outputs: [io(5, 2, one('pearl'))], need: 3, limit: lim(1),
    ref: mach(arm(3, 2, 2, 'OGIRRODILL')),
  },
  {
    id: 'g4', name: 'Hand to Hand', idea: 'Pass the amber from one arm to the other.',
    w: 9, h: 5, inputs: [io(1, 2, one('amber'))], outputs: [io(7, 2, one('amber'))], need: 3, limit: lim(2),
    ref: mach(arm(2, 2, 2, 'GRRODILL'), arm(6, 2, 2, '....OGIRRDLL')),
  },
  {
    id: 'g5', name: 'A Pair', idea: 'A setter bonds the two stones that rest on it.',
    w: 7, h: 5, inputs: [io(1, 2, one('pearl')), io(4, 2, one('pearl'))], outputs: [io(2, 3, shape(['p', 'p'], [[0, 1]]))], need: 4, limit: lim(1, 0, 1),
    ref: mach(arm(2, 2, 2, 'GRRDGRDR'), st('set', 3, 2)),
  },
  {
    id: 'g6', name: 'Polish, Then Set', idea: 'Polish the nacre first, then set it beside the amber.',
    w: 7, h: 5, inputs: [io(1, 2, one('nacre')), io(4, 2, one('amber'))], outputs: [io(2, 3, shape(['p', 'a'], [[0, 1]]))], need: 3, limit: lim(1, 1, 1),
    ref: mach(arm(2, 2, 2, 'GRDGRDGRDR'), st('polish', 2, 1), st('set', 3, 2)),
  },
  {
    id: 'g7', name: 'Twinned Glass', idea: 'A splitter breaks the bond between the stones on it.',
    w: 7, h: 5, inputs: [io(0, 2, shape(['gg'], [[0, 1]]))], outputs: [io(3, 2, one('glass'))], need: 4, limit: lim(1, 0, 0, 1),
    ref: mach(arm(2, 2, 2, 'GRDGRDLOGIRDLL'), st('split', 2, 1, 3)),
  },
  {
    id: 'g8', name: 'The Bar', idea: 'Set a third stone onto a pair to make a bar.',
    w: 8, h: 6, inputs: [io(1, 2, one('pearl')), io(4, 2, one('amber'))], outputs: [io(6, 3, shape(['a', 'p', 'p'], [[0, 1], [1, 2]]))], need: 2, limit: lim(2, 0, 1),
    ref: mach(arm(2, 2, 2, 'GRRDGODILLGRRDLL'), arm(6, 2, 1, 'DR............GL'), st('set', 3, 2)),
  },
  {
    id: 'g9', name: 'Star and Glass', idea: 'Set two rough stones, then polish the pair together.',
    w: 7, h: 6, inputs: [io(2, 1, one('chip')), io(4, 2, one('pebble'))], outputs: [io(0, 2, shape(['gs'], [[0, 1]]))], need: 3, limit: lim(1, 2, 1),
    ref: mach(arm(2, 2, 3, 'GRDGRDGRDR'), st('set', 3, 2), st('polish', 2, 3), st('polish', 2, 4)),
  },
  {
    id: 'g10', name: 'The Clasp', idea: 'A second setter turns a pair into a clasp.',
    w: 8, h: 6, inputs: [io(1, 2, one('pearl')), io(4, 2, one('amber')), io(6, 3, one('glass'))], outputs: [io(4, 4, shape(['ap', 'g.'], [[0, 1], [0, 2]]))], need: 2, limit: lim(2, 0, 2),
    ref: mach(arm(2, 2, 2, 'GRRDLL'), arm(4, 3, 3, '....GRDGRDLL'), st('set', 3, 2), st('set', 5, 3)),
  },
  {
    id: 'g11', name: 'The Brooch', idea: 'Polish a star chip and set it between two pearls.',
    w: 8, h: 6, inputs: [io(1, 2, one('chip')), io(4, 2, one('pearl')), io(2, 3, one('pearl'))], outputs: [io(6, 3, shape(['p', 's', 'p'], [[0, 1], [1, 2]]))], need: 2, limit: lim(2, 1, 1),
    ref: mach(arm(2, 2, 2, 'GRDGRDGODIRGLDLL'), arm(6, 2, 1, 'DR............GL'), st('polish', 2, 1), st('set', 3, 2)),
  },
  {
    id: 'g12', name: 'The Ring', idea: 'Three arms build a ring of four set stones.',
    w: 9, h: 7, inputs: [io(1, 5, one('pearl')), io(4, 5, one('star')), io(4, 2, shape(['aa'], [[0, 1]]))],
    outputs: [io(6, 3, shape(['ap', 'as'], [[0, 2], [1, 3], [0, 1], [2, 3]]))], need: 2, limit: lim(3, 0, 3),
    ref: mach(arm(2, 5, 2, 'GRRDLL'), arm(4, 4, 1, '....GRRDLL'), arm(6, 2, 2, '........GLDR'), st('set', 3, 5), st('set', 4, 2, 1), st('set', 5, 2, 1)),
  },
];

export const PUZZLE_BY_ID: Record<string, Puzzle> = Object.fromEntries(PUZZLES.map(p => [p.id, p]));
