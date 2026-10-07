// Act 1 puzzle rooms: small places off the main maps where movers answer Wait's verbs.
import { ActorDef, MapDef } from './mapkit';

const box = (id: string, x: number, y: number, give: string): ActorDef => ({
  id, x, y, sprite: 'box', kind: 'object', name: 'a box', behind: true,
  puzzle: { rote: '# a box. lazy.\nwhen struck:\n  open', need: (l) => (l.verbs.strike ?? 0) >= 1, flag: `box_${id}`, give, stays: true, solvedSprite: 'boxopen' },
});

const LUMP = '# a lump of clay. it rolls.\nwhen struck: roll';
const SEED = '# a seed. thirsty.\n# it grows the way it faces.\nwhen struck: turn\nwhen wet: grow';
const HALTED = '# halted mid-step.\nhalt\nwhen struck: step';
const PRESSED = '# a lump. made in the Press.\nwhen struck: roll\nwhen stamped: copy';
const YOUNG = '# a young listener. it walks in circles.\nstep\nturn\nwhen listened to: stop';

export const MAPS4: Record<string, MapDef> = {
  yard: {
    id: 'yard', name: 'Stack\'s clay yard', region: 'busy',
    rows: [
      '============',
      '=....=.....=',
      '=....O.....=',
      '=..T.=.....=',
      '=....O.....=',
      '=....=.....=',
      '=....=.....=',
      '=....=.....=',
      '==g=========',
    ],
    enter: [['!seen_obj_yard', 'obj_yard']],
    exits: [{ x: 2, y: 8, to: 'busy', tx: 1, ty: 5 }],
    triggers: [],
    actors: [
      { id: 'lump1', x: 2, y: 2, sprite: 'lump', kind: 'object', name: 'a lump', mover: { rote: LUMP } },
      { id: 'lump2', x: 3, y: 6, sprite: 'lump', kind: 'object', name: 'a lump', mover: { rote: LUMP } },
      box('yardbox', 8, 2, 'mark'),
    ],
  },
  reeds: {
    id: 'reeds', name: 'the seed bed', region: 'river',
    rows: [
      '============',
      '=....~~~...=',
      '=....~~~...=',
      '=....~~~...=',
      '=....~~~...=',
      '=....~~~...=',
      '=....~~~...=',
      '=....~~~...=',
      '==g=========',
    ],
    enter: [['!seen_obj_reeds', 'obj_reeds']],
    exits: [{ x: 2, y: 8, to: 'river', tx: 1, ty: 14 }],
    triggers: [],
    actors: [
      { id: 'seed1', x: 4, y: 3, sprite: 'seed', kind: 'object', name: 'a seed', mover: { rote: SEED, dir: 0 } },
      box('reedbox', 9, 3, 'thick'),
    ],
  },
  plaza: {
    id: 'plaza', name: 'the stopped plaza', region: 'standing',
    rows: [
      '============',
      '=....=.....=',
      '=....=.....=',
      '=....#.....=',
      '=....=.....=',
      '=.....======',
      '=..........=',
      '=..........=',
      '=.._....._.=',
      '==g=========',
    ],
    enter: [['!seen_obj_plaza', 'obj_plaza']],
    exits: [{ x: 2, y: 9, to: 'standing', tx: 1, ty: 24 }],
    triggers: [],
    groups: [{ group: 'plaza', flag: 'plaza_open', opens: [[5, 3, '.']], scene: 'obj_plaza_open' }],
    actors: [
      { id: 'stopA', x: 3, y: 6, sprite: 'halted', kind: 'object', name: 'someone halted', look: 'halted', mover: { rote: HALTED, group: 'plaza' } },
      { id: 'stopB', x: 7, y: 7, sprite: 'halted', kind: 'object', name: 'someone halted', look: 'halted', mover: { rote: HALTED, group: 'plaza' } },
      box('plazabox', 8, 2, 'mark'),
    ],
  },
  stamproom: {
    id: 'stamproom', name: 'the stamp room', region: 'twice',
    rows: [
      '============',
      '=.T..=.....=',
      '=....O.....=',
      '=....=.....=',
      '=....O.....=',
      '=....=.....=',
      '=....=.....=',
      '=....=.....=',
      '==g=========',
    ],
    enter: [['!seen_obj_stamproom', 'obj_stamproom']],
    exits: [{ x: 2, y: 8, to: 'twice', tx: 5, ty: 24 }],
    triggers: [],
    actors: [
      { id: 'plump', x: 2, y: 4, sprite: 'lump', kind: 'object', name: 'a pressed lump', mover: { rote: PRESSED, dir: 1 } },
      box('stampbox', 8, 2, 'deep'),
    ],
  },
  ring: {
    id: 'ring', name: 'the listening ring', region: 'ears',
    rows: [
      '============',
      '=..........=',
      '=..........=',
      '======#=====',
      '=..........=',
      '=.._...._..=',
      '=..........=',
      '=..........=',
      '==g=========',
    ],
    enter: [['!seen_obj_ring', 'obj_ring']],
    exits: [{ x: 2, y: 8, to: 'ears', tx: 30, ty: 1 }],
    triggers: [],
    groups: [{ group: 'ring', flag: 'ring_open', opens: [[6, 3, '.']], scene: 'obj_ring_open' }],
    actors: [
      { id: 'youngA', x: 2, y: 4, sprite: 'listener', kind: 'object', name: 'a young listener', mover: { rote: YOUNG, dir: 3, group: 'ring', needStop: true } },
      { id: 'youngB', x: 7, y: 4, sprite: 'listener', kind: 'object', name: 'a young listener', mover: { rote: YOUNG, dir: 3, group: 'ring', needStop: true } },
      box('ringbox', 8, 2, 'mark'),
    ],
  },
};

/** Opens the doors from the main maps into the puzzle rooms. */
export function applyPuzzleRooms(MAPS: Record<string, MapDef>) {
  const door = (id: string, x: number, y: number, to: string, tx: number, ty: number, cond?: string, block?: string) => {
    const m = MAPS[id];
    m.rows = m.rows.map((r, yy) => (yy === y ? `${r.slice(0, x)}g${r.slice(x + 1)}` : r));
    m.exits.push({ x, y, to, tx, ty, cond, block });
  };
  door('busy', 0, 5, 'yard', 2, 7);
  door('river', 0, 14, 'reeds', 2, 7);
  door('standing', 0, 24, 'plaza', 2, 8);
  door('twice', 5, 25, 'stamproom', 2, 7);
  door('ears', 30, 0, 'ring', 2, 7);
}
