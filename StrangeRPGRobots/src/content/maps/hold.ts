import type { MapDef } from '../../world/map';
import { C, LIGHT } from '../../engine/palette';

// The hold of the Board freight barge Clement, where the case bursts.
export const hold: MapDef = {
  id: 'hold',
  name: 'The Clement Hold',
  district: 'inside',
  inside: true,
  ambient: 0x4a5aa8,
  ambientLevel: 0.3,
  music: 'tense',
  flow: [0, 4],
  rows: [
    'IIIIIIIIIIIIIIIIIIIIII',
    'IIIIIIIIIIIIIIIIIIIIII',
    'InKKKnnnnnHHnnnnKKKnnI',
    'InKKKnccnnnnnncnKKKnnI',
    'InnnnnnnnnnnnnnnnnnnnI',
    'InnnnnnnnnnnnnnnnnnnnI',
    'Innnnnbnn====nnnnnnnnI',
    'Innnnnnnn==n=nnnnnnnJI',
    'Innnnnnnn====nnnnnnniI',
    'InnnnnnnnnnnnnnnnnnniI',
    'InKKKncnnnnnnnnnKKKnnI',
    'InKKKnnnbnnnnccnKKKnnI',
    'InnnnnnnnnnnnnnnnnnnnI',
    'IIIIIIIIIIIIIIIIIIIIII',
  ],
  props: [
    { kind: 'case', x: 11, y: 7, id: 'case', scene: 'hold_case', hideIf: 'spill' },
    { kind: 'terminal', x: 20, y: 6, id: 'controls', scene: 'hold_terminal' },
  ],
  signs: [
    { x: 7.5, y: 1.3, text: 'BOARD', color: C.red2, light: LIGHT.red },
  ],
  lights: [
    { x: 4.5, y: 7.5, r: 44, i: 0.8, color: LIGHT.amber },
    { x: 15.5, y: 7.5, r: 44, i: 0.8, color: LIGHT.amber },
    { x: 10.5, y: 2.5, r: 30, i: 0.5, color: LIGHT.cold },
    { x: 11, y: 7, r: 40, i: 0.8, color: LIGHT.amber },
    { x: 20, y: 7, r: 24, i: 0.6, color: LIGHT.red },
  ],
  npcs: [
    { id: 'jory', at: [13, 5], look: 'jory', dir: 'left', hideIf: 'spill' },
    { id: 'hanne', at: [8, 5], look: 'hanne', dir: 'right', hideIf: 'spill' },
    { id: 'p6', at: [15, 5], look: 'patrol', dir: 'left', hideIf: 'spill' },
  ],
  markers: { ladder: [10, 3], case_front: [11, 8], jory_case: [12, 7], hanne_back: [10, 4], p6_swing: [12, 8], shield: [10, 7] },
  exits: [{ x: 10, y: 2, w: 2, h: 1, to: 'canal9', at: 'hatch_top', dir: 'down', hideIf: 'spill' }],
};
