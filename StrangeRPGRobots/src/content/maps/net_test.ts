import type { MapDef } from '../../world/map';
import { C, LIGHT } from '../../engine/palette';

// A test pocket of the net: every net tile, the net props, and a small fight with Desk ICE and a drift.
export const net_test: MapDef = {
  id: 'net_test',
  name: 'Test Pocket',
  district: 'net',
  net: true,
  ambient: 0x3ef0e8,
  ambientLevel: 0.45,
  music: 'net',
  rows: [
    '                              ',
    ' BBBBBBBBBBBBBBBBBBBBBBBBBBBB ',
    ' BAAAAAAAAAAAABBAAAAAAAAAAAAB ',
    ' BAAAAAAAAAAAAAAAAAAAAAAAAAAB ',
    ' BAA+AAAAAAAAAAAAAAAAAAAaaaAB ',
    ' BAAAAAAddddddAAAAAAAAAaaaaaE ',
    ' BAAAAAAddddddAAAABBAAAaaaaaE ',
    ' BAAAAAAAAAAAAAAAABBAAAAaaaAE ',
    ' BBBBBBBBAAAABBBBBBBBAAAAAAAE ',
    '         -  -          E+AAAE ',
    '         ----          EEEEEE ',
    '                              ',
  ],
  props: [
    { kind: 'node', x: 6, y: 3, id: 'tnode', scene: 'test_node' },
    { kind: 'cache', x: 15, y: 2, id: 'tcache', scene: 'test_cache' },
    { kind: 'packet', x: 11, y: 4, id: 'tpacket', loot: 'net_small' },
    { kind: 'gate', x: 17, y: 3, id: 'tgate', hideIf: 'test_gate_open' },
  ],
  lights: [
    { x: 4, y: 4, r: 40, i: 0.7, color: LIGHT.cyan },
    { x: 25, y: 5, r: 40, i: 0.6, color: LIGHT.cold },
  ],
  signs: [{ x: 9, y: 1.3, text: 'SHALLOWS', color: C.cyan3, light: LIGHT.cyan }],
  markers: { start: [4, 4], out: [24, 9] },
  exits: [],
  encounters: [
    {
      id: 'test_ice', start: 'sight', sightRange: 6, radius: 8,
      units: [{ kind: 'sentry', at: [25, 4] }, { kind: 'icehound', at: [23, 6] }, { kind: 'drift_grief', at: [21, 3] }],
      simParty: ['quaye', 'tova'], simLevel: 4,
    },
  ],
};
