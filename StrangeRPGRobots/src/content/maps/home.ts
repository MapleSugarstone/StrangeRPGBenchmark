import type { MapDef } from '../../world/map';
import { C, LIGHT } from '../../engine/palette';

// The hero's stilt house on the south boardwalk of Pell Market.
export const home: MapDef = {
  id: 'home',
  name: 'Your Place',
  district: 'inside',
  inside: true,
  ambient: 0x4a5aa8,
  ambientLevel: 0.35,
  music: 'home',
  rows: [
    'IIIIIIIIIIII',
    'IIIIGIIIIIII',
    'IttttttttpZI',
    'IttttjhtpptI',
    'IttttttttttI',
    'IttttppttttI',
    'IitttppttttI',
    'ItttttttttOI',
    'IIIIItIIIIII',
  ],
  props: [
    { kind: 'shelf', x: 1, y: 2, id: 'shelf', loot: 'home_shelf' },
    { kind: 'jar', x: 2, y: 2, id: 'jar', scene: 'home_jar', hideIf: 'spill' },
    { kind: 'flag', x: 9, y: 1, id: 'flag', scene: 'home_flag', hideIf: 'got_flag' },
    { kind: 'door', x: 5, y: 8, id: 'door' },
  ],
  signs: [
    { x: 7.5, y: 1.3, icon: 'wave', color: C.cyan2 },
  ],
  lights: [
    { x: 4.5, y: 2.2, r: 30, i: 0.8, color: LIGHT.magenta },
    { x: 7, y: 4, r: 40, i: 0.6, color: LIGHT.amber },
    { x: 9.5, y: 2.5, r: 18, i: 0.5, color: LIGHT.cyan },
  ],
  markers: { start: [9, 2], door: [5, 7], window: [4, 2], jar_spot: [2, 3], pull: [4, 1] },
  exits: [{ x: 5, y: 8, to: 'market', at: 'home_door', dir: 'down' }],
  enter: 'home_enter',
};
