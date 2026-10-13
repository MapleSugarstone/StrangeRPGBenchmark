// The Setting puzzles, each with the reference machine the content test runs to prove it can be solved. The twelve
// sketches found in the world open the geode. The twelve sold at Shellwright counters are optional and harder.
import type { ArmPart, Io, Machine, Puzzle, Shape, StationPart, Stone } from './core';

const one = (s: Stone): Shape => ({ atoms: [[0, 0, s]], bonds: [] });
const io = (x: number, y: number, shape: Shape, count?: number): Io => (count === undefined ? { x, y, shape } : { x, y, shape, count });
const arm = (x: number, y: number, dir: number, tape: string): ArmPart => ({ kind: 'arm', x, y, dir, tape });
const st = (kind: StationPart['kind'], x: number, y: number, dir = 0): StationPart => ({ kind, x, y, dir });
const mach = (...parts: Machine['parts']): Machine => ({ parts });
const KEY: Record<string, Stone> = { p: 'pearl', a: 'amber', g: 'glass', s: 'star', n: 'nacre', r: 'resin', b: 'pebble', c: 'chip', x: 'paste' };
/** A shape from rows of letters: p pearl, a amber, g beach glass, s star glass, x paste, and n r b c for the rough stones. */
function shape(rows: string[], bonds: [number, number][]): Shape {
  const atoms: Shape['atoms'] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (KEY[c]) atoms.push([x, y, KEY[c]]); }));
  return { atoms, bonds };
}
/** A shape with a bond between every pair of neighbors. */
function full(rows: string[]): Shape {
  const sh = shape(rows, []);
  sh.atoms.forEach(([x, y], i) => sh.atoms.forEach(([u, v], j) => { if (j > i && Math.abs(x - u) + Math.abs(y - v) === 1) sh.bonds.push([i, j]); }));
  return sh;
}
const lim = (arm: number, polish = 0, set = 0, split = 0, mold = 0, chute = 0) => ({ arm, polish, set, split, mold, chute });

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

/** The sketches sold at Shellwright counters, easiest first. Each brings in a part or a trick the first twelve do not use. */
export const SHOP_PUZZLES: Puzzle[] = [
  {
    id: 's1', name: 'Paste', idea: 'A mold turns paste into a copy of the stone on its other cell. There is only one star.',
    w: 7, h: 5, inputs: [io(2, 3, one('star'), 1), io(3, 1, one('paste'))], outputs: [io(5, 3, one('star'))], need: 4, limit: lim(1, 0, 0, 0, 1),
    ref: mach(arm(3, 3, 2, 'GRDOGRDLIL'), st('mold', 3, 2, 3)),
  },
  {
    id: 's2', name: 'Seconds', idea: 'Pebbles came up bonded to the stones. A chute takes away a whole piece.',
    w: 6, h: 5, inputs: [io(1, 2, full(['pa', 'bb']))], outputs: [io(3, 0, full(['p', 'a']))], need: 4, limit: lim(1, 0, 0, 1, 0, 1),
    ref: mach(arm(3, 2, 2, '.GODGIRDL'), st('split', 1, 2, 1), st('chute', 0, 3)),
  },
  {
    id: 's3', name: 'The Cross', idea: 'Pivot turns what an arm holds about its claw. Build the cross on one setter.',
    w: 8, h: 7, inputs: [io(2, 3, one('pearl')), io(5, 1, one('star'))], outputs: [io(4, 4, full(['.p.', 'psp', '.p.']))], need: 3, limit: lim(2, 0, 1), pivot: true,
    ref: mach(arm(3, 1, 0, 'O.........GRDL'), arm(5, 3, 2, 'G>DG>DG>DGLDRO'), st('set', 2, 3, 0)),
  },
  {
    id: 's4', name: 'Bar Pin', idea: 'The pin is too long to carry. Swing it by one end.',
    w: 11, h: 7, inputs: [io(1, 5, full(['apgs']))], outputs: [io(6, 0, full(['apgs']))], need: 3, limit: lim(2),
    ref: mach(arm(5, 5, 2, 'GRDL'), arm(5, 0, 1, '...GLDR')),
  },
  {
    id: 's5', name: 'Rosary', idea: 'Three nacre on a string, and one polisher for all of them.',
    w: 7, h: 6, inputs: [io(1, 2, full(['nnn']))], outputs: [io(5, 3, full(['p', 'p', 'p']))], need: 3, limit: lim(1, 1), pivot: true,
    ref: mach(arm(5, 2, 2, 'OGIDOG>>DGLDR'), st('polish', 2, 2)),
  },
  {
    id: 's6', name: 'Two Trays', idea: 'Pearls go in one tray and amber in the other.',
    w: 6, h: 5, inputs: [io(2, 1, full(['pa']))], outputs: [io(0, 0, full(['pp'])), io(0, 1, full(['aa']))], need: 3, limit: lim(1, 0, 2, 2),
    ref: mach(arm(2, 0, 1, 'GODGRDLI'), st('set', 2, 1, 1), st('set', 3, 1, 1), st('split', 0, 0, 1), st('split', 1, 0, 1)),
  },
  {
    id: 's7', name: 'The Strand', idea: 'One arm, one setter, and a strand of four.',
    w: 7, h: 6, inputs: [io(1, 1, one('pearl'))], outputs: [io(0, 2, full(['p', 'p', 'p', 'p']))], need: 3, limit: lim(1, 0, 1),
    ref: mach(arm(0, 1, 0, 'GODIGODIGODIGRDL'), st('set', 1, 1, 0)),
  },
  {
    id: 's8', name: 'Mirror Clasp', idea: 'A left-handed customer wants the clasp mirrored.',
    w: 8, h: 6, inputs: [io(1, 2, shape(['ap', 'g.'], [[0, 1], [0, 2]]))], outputs: [io(4, 2, shape(['pa', '.g'], [[0, 1], [1, 2]]))], need: 3, limit: lim(2, 0, 1, 1),
    ref: mach(arm(3, 2, 2, '.GLDGLDRR'), arm(2, 3, 2, '.GLDR'), st('split', 1, 2, 1), st('set', 2, 4, 0)),
  },
  {
    id: 's9', name: 'Chain Letter', idea: 'One amber and three paste. A copy can be a model too.',
    w: 8, h: 7, inputs: [io(3, 2, full(['axxx']))], outputs: [io(0, 3, full(['a', 'a', 'a', 'a']))], need: 3, limit: lim(2, 0, 0, 0, 1),
    ref: mach(arm(7, 2, 2, '.GODI'), arm(0, 2, 0, 'O...GIDGRDLO'), st('mold', 3, 2, 0)),
  },
  {
    id: 's10', name: 'Earrings', idea: 'A left earring and a right one, from one machine.',
    w: 7, h: 5, inputs: [io(1, 1, one('amber')), io(2, 1, one('pearl')), io(3, 2, one('glass'))],
    outputs: [io(0, 0, shape(['ag', 'p.'], [[0, 1], [0, 2]])), io(5, 0, shape(['ga', '.p'], [[0, 1], [1, 2]]))], need: 2, limit: lim(2, 0, 2), pivot: true,
    ref: mach(arm(1, 3, 3, 'OGR<DL.GR>DL'), arm(3, 0, 1, 'O....GRDL..GLDR'), st('set', 1, 1, 0), st('set', 3, 2, 1)),
  },
  {
    id: 's11', name: 'Paste Brooch', idea: 'One nacre and one star chip. Every brooch after that is paste.',
    w: 7, h: 7, inputs: [io(3, 3, full(['xxx'])), io(1, 2, one('nacre'), 1), io(3, 5, one('chip'), 1)], outputs: [io(6, 4, full(['p', 's', 'p']))], need: 3,
    limit: lim(2, 2, 0, 0, 2), pivot: true,
    ref: mach(arm(2, 2, 2, '.GLDR'), arm(4, 5, 2, '.GRRDLOG>>DGRDLL'), st('polish', 1, 2), st('polish', 3, 5), st('mold', 2, 3, 0), st('mold', 5, 5, 0)),
  },
  {
    id: 's12', name: 'Tiara', idea: 'Everything at once, and it has to stand upright.',
    w: 8, h: 7, inputs: [io(4, 4, one('paste')), io(6, 3, one('amber'), 1), io(2, 3, one('nacre')), io(5, 6, one('chip'))], outputs: [io(5, 1, full(['.s.', 'pap']))], need: 2,
    limit: lim(3, 2, 1, 0, 1), pivot: true,
    ref: mach(
      arm(6, 4, 2, 'O....G>DG>DG<RDL'), arm(2, 4, 3, '..GRDL..GRDL'), arm(3, 6, 0, 'O....GLDR'),
      st('set', 3, 4, 0), st('mold', 6, 3, 3), st('polish', 2, 3), st('polish', 5, 6),
    ),
  },
];

export const ALL_PUZZLES: Puzzle[] = [...PUZZLES, ...SHOP_PUZZLES];
export const PUZZLE_BY_ID: Record<string, Puzzle> = Object.fromEntries(ALL_PUZZLES.map(p => [p.id, p]));
const BASE_IDS = new Set(PUZZLES.map(p => p.id));
/** How many of the twelve found sketches are set. The geode counts only these. */
export const baseSolved = (solved: string[]): number => solved.filter(id => BASE_IDS.has(id)).length;
/** Nacre for the first time each sketch is set, 1 to 5 by how hard it is. */
export const FIRST_SET_NACRE: Record<string, number> = {
  g1: 1, g2: 1, g3: 1, g4: 2, g5: 2, g6: 2, g7: 2, g8: 3, g9: 3, g10: 3, g11: 4, g12: 4,
  s1: 2, s2: 2, s3: 3, s4: 3, s5: 3, s6: 3, s7: 4, s8: 4, s9: 4, s10: 4, s11: 5, s12: 5,
};
