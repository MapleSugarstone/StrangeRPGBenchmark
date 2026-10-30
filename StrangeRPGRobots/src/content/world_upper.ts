// The Stair and the Brim for the replay systems: travel destinations, world events, and the choir and vein
// background quests. Scenes: src/script/events_upper.txt. Notes: Notes/replay-b-notes.md.
import './crew';
import { addTravel, addEvents, type Destination, type WorldEvent } from './replay';
import { addQuests } from './quests';
import { addItems } from '../rules/data';

addItems([
  { id: 'file4471', name: 'File 4471', kind: 'key', price: 0, desc: 'Your personal Census file. Found in a cellar on Canal Two. Guardian: None known. Note: Watch.' },
]);

const stair = (id: string, name: string, map: string, marker: string, when = 'chapter>=3'): Destination => ({ id, name, district: 'stair', map, marker, when });
const brim = (id: string, name: string, map: string, marker: string, when: string): Destination => ({ id, name, district: 'brim', map, marker, when });

addTravel([
  stair('steps', 'The Lantern Steps', 'steps', 'plaza_in'),
  stair('plaza', 'Plaza of the Raised Hand', 'plaza', 'steps_in'),
  stair('church', 'Church of the Raised Hand', 'church', 'door_in'),
  stair('census', 'The Census Office', 'census', 'door_in'),
  stair('terraces', 'The Terraces', 'terraces', 'steps_in'),
  stair('spirebase', 'Mercy Spire, the gate', 'spirebase', 'plaza_in'),
  stair('spire', 'Mercy Spire', 'spire', 'lift_out', 'chapter>=4'),
  stair('lostprop', 'Lost Property', 'lostprop', 'van', 'chapter>=4'),
  stair('sunny', 'Sunny Steps', 'sunny', 'van', 'chapter>=4'),
  stair('overlook', 'The Overlook', 'overlook', 'terrace'),
  stair('rooftop', 'A Terrace Roof', 'rooftop', 'roof_in'),
  stair('violet', 'Club Violet', 'violet', 'door_in'),
  brim('seawall', 'The Sea Face', 'seawall', 'top', 'chapter>=6'),
  brim('boardplaza', 'Board Plaza', 'boardplaza', 'wall_in', 'chapter>=6'),
  brim('crown', 'The Crown', 'crown', 'lobby_in', 'plaza6_done'),
  brim('pumphall', 'Pump Hall', 'pumphall', 'lift_out', 'hall_done'),
  brim('seawalk', 'The Seawalk', 'seawalk', 'hall_door', 'hall_done'),
]);

// Every Stair event waits until Tova has joined, so none of them lands on a first-visit story scene.
const S = 'tova_joined&chapter>=3';
const B = 'plaza6_done&chapter>=6';
const ev = (id: string, o: Omit<WorldEvent, 'id' | 'scene'>): WorldEvent => ({ id, scene: id, ...o });

addEvents([
  ev('evu_census_pa', { district: 'stair', when: S, chance: 0.2, repeat: 8 }),
  ev('evu_choir_far', { district: 'stair', when: `${S}&met_choir`, chance: 0.2 }),
  ev('evu_curfew', { district: 'stair', when: S, chance: 0.15, repeat: 10 }),
  ev('evu_vein_chalk', { district: 'stair', when: `${S}&bg:vein`, chance: 0.25, repeat: 12 }),
  ev('evu_recovery', { district: 'stair', when: `${S}&chapter>=4`, chance: 0.15 }),
  ev('evu_checkpoint', { maps: ['steps'], when: S, chance: 0.25, repeat: 10 }),
  ev('evu_abduction', { maps: ['terraces'], when: S, chance: 0.3 }),
  ev('evu_pilgrims', { maps: ['plaza'], when: `${S}&ignace_joined`, chance: 0.25, repeat: 8 }),
  ev('evu_spire_sunday', { maps: ['spirebase'], when: `${S}&ignace_joined&chapter<6`, chance: 0.3 }),
  ev('evu_bailer_rest', { maps: ['overlook'], when: 'chapter>=4', chance: 0.4 }),
  ev('evu_brim_pa', { district: 'brim', when: B, chance: 0.3, repeat: 6 }),
  ev('evu_wind', { district: 'brim', when: B, chance: 0.25, repeat: 5 }),
  ev('evu_board_news', { district: 'brim', when: B, chance: 0.25 }),
  ev('evu_courier', { maps: ['boardplaza'], when: B, chance: 0.3, repeat: 6 }),
]);

addQuests([
  {
    id: 'bgchoir', title: 'Linnet', kind: 'side', xp: 200,
    stages: {
      '1': 'The Elder still calls you Linnet. Wren and Pip ran off last night, hiding by the east lamps. She wants them home for Nine Verses.',
      done: 'Wren and Pip have made their choice, with your help.',
    },
    where: { '1': ['terraces', 'choirkids'] },
  },
  {
    id: 'bgvein', title: 'File 4471', kind: 'side', xp: 200,
    stages: {
      '1': 'The Census has kept a file on you since your time in the cellars. Number 4471, cellar intake. It is stored on the shelves in the Census Office records room.',
      done: "File 4471 is no longer under the Census's control.",
    },
    where: { '1': ['census', 'records_in'] },
  },
]);
