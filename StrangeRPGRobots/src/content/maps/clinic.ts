import type { MapDef } from '../../world/map';
import { C, LIGHT } from '../../engine/palette';

// Doc Seo's clinic, behind the DOC sign on the road north of the market canal.
export const clinic: MapDef = {
  id: 'clinic',
  name: "Doc Seo's",
  district: 'inside',
  inside: true,
  ambient: 0x4a5aa8,
  ambientLevel: 0.4,
  music: 'clinic',
  rows: [
    'IIIIIIIIIIIIIIIIII',
    'IIIIIIIIIIIIIIIIII',
    'ItZttZttttttttttFI',
    'IttttttttttttttttI',
    'IttttttttttkkktttI',
    'IttttttttttttttttI',
    'ItthtthttttttttttI',
    'IOtttttttttttttttI',
    'IOtttttppphtttttiI',
    'IttttttppptttttciI',
    'IttttttttttttttttI',
    'IIIIIIIItIIIIIIIII',
  ],
  props: [
    { kind: 'terminal', x: 15, y: 2, id: 'doc_terminal', scene: 'clinic_terminal' },
    { kind: 'shelf', x: 16, y: 3, id: 'doc_shelf', loot: 'med' },
    { kind: 'door', x: 8, y: 11, id: 'door' },
  ],
  signs: [
    { x: 8, y: 1.3, icon: 'cross', color: C.cyan3, light: LIGHT.cyan },
  ],
  lights: [
    { x: 13.5, y: 8.5, r: 44, i: 0.8, color: LIGHT.cold },
    { x: 8, y: 5, r: 60, i: 0.8, color: LIGHT.cold },
    { x: 15, y: 3, r: 24, i: 0.6, color: LIGHT.cyan },
    { x: 3.5, y: 3, r: 30, i: 0.5, color: LIGHT.white },
  ],
  npcs: [
    { id: 'patient', at: [3, 6], look: 'crowd:245', dir: 'down', showIf: 'chapter>=2', bark: ['Doc Seo stitched my hand. Twice.', "Wait your turn. I'm waiting mine."] },
    { id: 'seo', at: '@doc', look: 'seo', dir: 'down', talk: 'seo_talk', hideIf: 'doc_taken' },
    { id: 'seo', at: '@doc', look: 'seo', dir: 'down', talk: 'seo_talk', showIf: 'choir_done' },
  ],
  markers: { bed: [3, 4], doc: [12, 3], doc_bedside: [4, 5], door: [8, 10], pull: [8, 0] },
  exits: [{ x: 8, y: 11, to: 'market', at: 'clinic_door', dir: 'down' }],
};
