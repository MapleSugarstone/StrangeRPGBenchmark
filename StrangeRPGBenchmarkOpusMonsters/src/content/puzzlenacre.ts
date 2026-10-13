// Nacre for the field puzzles whose solve pays none of its own. It pays once, on the first free step after the solve, so
// a file saved before this existed collects it too.
import { field, flag, setFlag } from '../game/api';
import { reward } from './areakit';
import { hasKey } from './ring';

/** Each puzzle's nacre and how to tell it is solved: its key item taken, its door open, or the place past it reached. */
const PUZZLE_NACRE: { id: string; n: number; done: () => boolean }[] = [
  // The Islander's eight things, one for each world puzzle.
  ...([['kettle', 2], ['door', 2], ['window', 3], ['chair', 3], ['vane', 3], ['tub', 4], ['step', 4], ['gate', 4]] as const)
    .map(([k, n]) => ({ id: 'lore_' + k, n, done: () => hasKey('lore_' + k) || !!flag('back_lore_' + k) })),
  { id: 'stones', n: 2, done: () => !!flag('stonesCrossed') },
  { id: 'ford', n: 4, done: () => !!flag('fordCrossed') },
  { id: 'stakes', n: 5, done: () => !!flag('holmHere') },
  { id: 'gzA', n: 4, done: () => !!flag('gzAOpen') },
  { id: 'gzB', n: 4, done: () => !!flag('gzBOpen') },
  { id: 'gzC', n: 4, done: () => !!flag('gzCOpen') },
  { id: 'gap', n: 2, done: () => !!flag('sdSeen') },
  { id: 'starRings', n: 2, done: () => !!flag('cbSeen') },
  { id: 'teeth', n: 3, done: () => !!flag('mouthOpen') },
  { id: 'reflection', n: 3, done: () => !!flag('glossSeen') },
  { id: 'roll', n: 3, done: () => field.map?.id === 'augerstair' || !!flag('tipOpen') },
  { id: 'vents', n: 3, done: () => !!flag('tipOpen') },
  { id: 'ballast', n: 4, done: () => !!flag('tcSeen') },
  { id: 'marks', n: 4, done: () => !!flag('marksDone') },
  { id: 'mudlark', n: 4, done: () => !!flag('mudlarkFound') },
  { id: 'pink', n: 5, done: () => !!flag('turnSeen') },
  { id: 'turn', n: 5, done: () => !!flag('roarSeen') },
  { id: 'roar', n: 5, done: () => !!flag('mouthSeen') },
];

field.stepHooks.push(f => {
  if (f.busy) return;
  const due = PUZZLE_NACRE.filter(p => !flag('nacre_' + p.id) && p.done());
  if (!due.length) return;
  for (const p of due) setFlag('nacre_' + p.id);
  void f.runBusy(() => reward({ tan: due.reduce((n, p) => n + p.n, 0) }));
});
