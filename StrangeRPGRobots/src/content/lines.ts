// The old Line tunnels: the drowned metro under the Deeps, open from chapter 2 through the Moles' hatch.
// Quests, Sel's stall, and the items the Moles, the tubes, and Platform Zero hand out.
import { addQuests } from './quests';
import { addShops } from './shops';
import { addItems } from '../rules/data';

addItems([
  { id: 'nighteyes', name: 'Night Eyes', kind: 'chrome', price: 0, bonus: { notice: 2, sneak: 1 }, essence: 1, desc: 'Mole chrome. Grown for the tubes, where nothing is lit. Bright places sting.' },
  { id: 'railbar', name: 'Rail Bar', kind: 'melee', price: 0, dmg: [5, 9], acc: 0, knock: 1, desc: 'A length of metro rail wrapped with a grip. It knocks targets back one tile.' },
  { id: 'tokentin', name: 'Tin of Tokens', kind: 'key', price: 0, desc: 'Brass fare tokens from before the Flood. Sel kept them for forty years.' },
  { id: 'bephandbag', name: 'Handbag', kind: 'key', price: 0, desc: 'A handbag from the last train. The tag reads: B. VAN DAM, NO. 11, PELL.' },
  { id: 'donorfile', name: 'Donor File', kind: 'key', price: 0, desc: 'Board Works 1. PRODUCT H. DONOR: ONE. FEELING: NONE RECORDED.' },
]);

addQuests([
  {
    id: 'exactchange',
    title: 'Exact Change',
    kind: 'side',
    expires: 5,
    xp: 200,
    stages: {
      '1': "Three woken fare gates block Tube A, cutting off the Moles' water supply. The gates fire tokens at anyone who hasn't paid.",
      done: 'The fare gates are settled.',
    },
    where: { '1': ['metro_tunnel', 'gates_front'] },
  },
  {
    id: 'points',
    title: 'The Points',
    kind: 'side',
    expires: 4,
    xp: 250,
    stages: {
      '1': 'Cutters ferry cut blood by boat on flooded Tube B. Spoor wants signal room points thrown to block the route. Splint wants them left alone.',
      done: 'The points are settled.',
    },
    where: { '1': ['metro_tunnel', 'signal_front'] },
  },
  {
    id: 'lasttrain',
    title: 'The Last Train',
    kind: 'side',
    expires: 5,
    xp: 200,
    stages: {
      '1': 'A metro car sitting on a siding in the tubes is still breathing. It has guarded the lost property from the night of the Flood for forty years.',
      '2': 'You carry a handbag from the last train. The tag reads: B. VAN DAM, NO. 11, PELL. Bep lives on the south boardwalk in Pell Market.',
      done: 'The last train is settled.',
    },
    where: { '1': ['metro_tunnel', 'train_door'], '2': ['market', 'bep'] },
  },
  {
    id: 'quietwater',
    title: 'Quiet Water',
    kind: 'side',
    expires: 5,
    xp: 350,
    stages: {
      '1': 'The Moles light the station with woken lamps, but the lights are fading. Spoor says the water rising from below tastes of nothing.',
      '2': "Hush is leaking into the Moles' water supply from Board Works 1, down the shaft at the east end of the tubes.",
      done: 'The still at Board Works 1 is settled.',
    },
    where: { '1': ['metro_station', 'spoor'], '2': ['metro_deep', 'still_front'] },
  },
  {
    id: 'producth',
    title: 'Product H',
    kind: 'side',
    expires: 5,
    xp: 150,
    stages: {
      '1': "The donor room at Board Works 1 holds the records of the Board's first Hush.",
      '2': 'You carry the donor file from Board Works 1.',
      done: 'The donor file is settled.',
    },
    where: { '1': ['metro_deep', 'donor_front'] },
  },
]);

addShops([
  { id: 'sel_stall', name: 'Sel\'s Stall', items: ['stim', 'krill', 'loaf', 'noodles', 'smokegren', 'shockgren', 'poncho', 'knife'] },
]);
