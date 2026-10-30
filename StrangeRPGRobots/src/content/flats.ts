// The Flats: an optional district on the sea side of the Wall, open from chapter 2 through Rina Moll's skis.
// Quests, the Wader trader, and the items the Waders and the drowned street hand out.
import { addQuests } from './quests';
import { addShops } from './shops';
import { addItems } from '../rules/data';

addItems([
  { id: 'gaffhook', name: 'Wader Gaff', kind: 'melee', price: 0, dmg: [4, 8], acc: 1, reach: 2, desc: "Saar's salvage hook mounted on a two-meter pole. It reaches across a gully." },
  { id: 'saltcoat', name: 'Salt Coat', kind: 'armor', price: 0, def: 2, bonus: { athletics: 1, sneak: 1 }, desc: 'Wader oilskin, stiffened with salt. There is no metal in it anywhere.' },
  { id: 'tidemark', name: 'Tide Mark', kind: 'key', price: 0, stack: true, desc: 'A knot tied in salt-stiffened rope. Waders tie one for a favor. Three knots mark you as a Wader.' },
  { id: 'jawcrates', name: 'Rina\'s Crates', kind: 'key', price: 0, desc: 'Three sealed crates sitting at the far tide line, awaiting a boat. Standard pay.' },
  { id: 'trampass', name: 'Line 14 Pass', kind: 'key', price: 0, desc: 'A child\'s tram pass from Number 14 Lock Road. LINE 14. SUNDAYS. M. HALSEMA.' },
]);

addQuests([
  {
    id: 'waders',
    title: 'Low Water',
    kind: 'side',
    xp: 300,
    stages: {
      '1': "Rina Moll's skis track out through the sluice under the Grand Lock at low tide. Ask Gus for Rina's dock. The Waders camp on the mud beneath the outer face of the Wall.",
      '2': 'Old Ankie says a favor earns a tide mark, and three marks make you a Wader. Waders come when Waders call.',
      done: 'The Waders will come when you call them, even up the Wall.',
    },
    where: { '1': ['flats_camp', 'ankie'], '2': ['flats_camp', 'ankie'] },
  },
  {
    id: 'goingout',
    title: 'Going Out',
    kind: 'side',
    expires: 5,
    xp: 200,
    stages: {
      '1': 'A woken jukebox walked past the Lock, stuck in mud at the tide line. It tries to go further out every high water.',
      done: 'The jukebox on the mud has settled.',
    },
    where: { '1': ['flats_mud', 'juke_front'] },
  },
  {
    id: 'cinema',
    title: 'Under the Cinema',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': "Lieve's husband, Jelle, went diving into the Star Cinema on Old Lock Road during the last low tide and never came back. The street is located east of the Flats.",
      done: 'Jelle is gone from the cinema.',
    },
    where: { '1': ['drowned', 'booth_front'] },
  },
  {
    id: 'salvage',
    title: 'Salvage Rights',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': 'The Board has tagged the Morgenster, the ferry the Waders have been cutting steel from for nine years. A salvage officer and drones now guard the claim beacon.',
      done: 'The Morgenster is settled.',
    },
    where: { '1': ['flats_mud', 'beacon_front'] },
  },
  {
    id: 'halsema',
    title: 'Fourteen Lock Road',
    kind: 'side',
    expires: 5,
    xp: 200,
    stages: {
      '1': "The Waders call Number 14 Lock Road the Saint's house. It opens at low tide.",
      '2': 'You carry a child\'s tram pass from Number 14 Lock Road. LINE 14. SUNDAYS. M. HALSEMA.',
      done: 'The tram pass from Number 14 is settled.',
    },
    where: { '1': ['drowned', 'house_front'] },
  },
  {
    id: 'salt',
    title: 'Salt',
    kind: 'side',
    expires: 5,
    xp: 200,
    stages: {
      '1': 'Ria is sixteen and wants Doc Zout to take her port before the salt does. Zout will only cut if Old Ankie gives the word.',
      done: 'Ria\'s port is settled.',
    },
    where: { '1': ['flats_camp', 'ankie'] },
  },
  {
    id: 'jawrun',
    title: 'The Lockjaw Run',
    kind: 'side',
    expires: 5,
    xp: 200,
    stages: {
      '1': "Tak needs Rina's three crates carried across the mud to a boat at the far tide line before the turn. Board drones patrol the middle mud.",
      '2': "You've handed off the crates. See Tak at the dock.",
      done: 'Rina\'s run is settled.',
    },
    where: { '1': ['flats_mud', 'buyer_front'], '2': ['flats_camp', 'tak'] },
  },
  {
    id: 'stuck',
    title: 'Before the Tide',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': 'Noud, a Wader boy, is waist-deep in the mud by the west wreck. Wreckers from inside the Wall are stripping the site. The tide is turning.',
      done: 'Noud has gotten out of the mud.',
    },
    where: { '1': ['flats_mud', 'noud_front'] },
  },
]);

addShops([
  { id: 'wader_trade', name: 'Kobus', items: ['krill', 'eel', 'loaf', 'raincoat', 'poncho', 'slingshot', 'pipe', 'stim', 'smokegren'] },
]);
