// The scene behind the title screen. Not a playable map.
import type { MapDef } from '../../world/map';
import { C, LIGHT } from '../../engine/palette';

export const titleMap: MapDef = {
  id: '__title',
  name: 'Fathom',
  district: 'deeps',
  ambient: 0x3a4a9a,
  ambientLevel: 0.22,
  rain: 1,
  rows: [
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXX',
    '######KKKK####SSSS####',
    '######KKKK####SSSS####',
    '######KKKK####SSSS####',
    '..L..U....V..L....N...',
    '..........o.......v...',
    '____________________..',
    '~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~',
    '______________________',
    '..l....Y...c.....l....',
    '######GGGG#####GGG####',
    '######GGGG#####GGG####',
  ],
  signs: [
    { x: 4.6, y: 2.9, text: 'KEEP FATHOM DRY', color: C.red2, light: LIGHT.red, r: 50 },
    { x: 1.2, y: 5.2, text: 'NOODLE', color: C.mag3, light: LIGHT.magenta },
    { x: 10.4, y: 4.4, icon: 'eye', color: C.cyan3, light: LIGHT.cyan },
    { x: 15, y: 5.3, text: 'BAR', color: C.amb3, light: LIGHT.amber },
    { x: 18.5, y: 4.2, icon: 'hand', color: C.grn3, light: LIGHT.green, holo: true },
    { x: 7, y: 18.2, text: 'RIPPER', color: C.cyan3, light: LIGHT.cyan },
    { x: 15.5, y: 18.2, icon: 'bowl', color: C.mag3, light: LIGHT.magenta },
  ],
  lights: [
    { x: 6, y: 12, r: 60, i: 0.5, color: LIGHT.violet },
    { x: 17, y: 13, r: 50, i: 0.45, color: LIGHT.magenta },
  ],
  bailers: [{ name: 'Auntie Sloop', path: [[3, 14], [19, 14]], speed: 3 }],
  markers: { start: [10, 8] },
};
