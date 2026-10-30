// Chapter 5 data: quests, the flood shop, camp scenes, and the key items the story hands out.
import { addQuests } from './quests';
import { addShops } from './shops';
import { addCamp } from './camp';
import { addItems } from '../rules/data';

addItems([
  { id: 'hands', name: 'Bailing Hands', kind: 'key', price: 0, desc: 'Everyone who came out to the Pumpline with a bucket.' },
  { id: 'sumpmotor', name: 'Sump Motor', kind: 'key', price: 0, desc: "A Board drainage motor from the bottom of the garage. Ninety kilos. Quaye says it's enough." },
  { id: 'lease', name: 'Lease 7713-K', kind: 'key', price: 0, desc: 'A Bodywell lease. Two arms, one knee, a reflex booster, one eye. Signed over to A. Kwarteng.' },
  { id: 'docbox', name: 'Doc Seo\'s Box', kind: 'key', price: 0, desc: 'A sealed Board Medical crate retrieved from underwater. Still dry inside.' },
]);

addQuests([
  {
    id: 'highwater',
    title: 'High Water',
    kind: 'main',
    xp: 900,
    stages: {
      '1': "Marit is dying aboard the Clement. The port has gone quiet, and Courtesy is slowing. Marit asked about Tram Fourteen. Take Gus's boat to the Pound and ask Tilly why she never stopped.",
      '2': 'Tilly says a woken thing keeps going once it wants something its witch never felt. Go to the Pumpline at the Wall, where Hendrik fell.',
      '3': "Moss wants the whole Deeps on the Pumpline tonight, bailing beside the Bailers. Bring people. Talk to Moss when you're ready. Bailer Night runs till morning.",
      '4': 'Bailer Night is over. Return to the Clement.',
      '5': "The Board has Marit. Climb Hendrik's knee to reach the maintenance hatch in the Wall.",
      done: 'The crew scaled the outside of the Wall.',
    },
    where: {
      '1': ['pound', 'tilly_stop'],
      '2': ['pumpline', 'quay'],
      '3': ['pumpline', 'moss'],
      '4': ['camp', 'marit_bed'],
      '5': ['pumpline', 'knee_foot'],
    },
  },
  {
    id: 'reasons',
    title: 'Reasons',
    kind: 'companion',
    stages: {
      '1': 'Your port went silent upon reaching Marit. Tilly says it needs a desire of its own.',
      done: 'Your port answered Tilly\'s question.',
    },
    where: { '1': ['pound', 'tilly_stop'] },
  },
  {
    id: 'crossing',
    title: 'Children Crossing',
    kind: 'companion',
    stages: {
      '1': 'Courtesy is moving slowly. The school in Pell Market is inaccessible on its top floor, and the children on the container roof across the road cannot reach it. Take Courtesy to the crossing.',
      done: 'Courtesy took position at the crossing.',
    },
    where: { '1': ['market_flood', 'crossing'] },
  },
  {
    id: 'dryplan',
    title: 'The Dry Plan',
    kind: 'companion',
    stages: {
      '1': "Quaye says Hendrik is still a pump, lying down. She needs a drainage motor. The Cutters' garage had a Board sump pump on its lowest level.",
      '2': 'You have the sump motor. On Bailer Night, with enough hands to haul it, Quaye can wire it into Hendrik.',
      done: 'Hendrik pumps again, without a witch inside him.',
    },
    where: { '1': ['garage', 'sump'], '2': ['pumpline', 'coupling'] },
  },
  {
    id: 'velt',
    title: 'The Household',
    kind: 'companion',
    stages: {
      '1': 'Archdeacon Velt came down to bless the flood from the soup kitchen roof in Pell Market. Ignace has the ledger page. Take Ignace to him.',
      done: 'Ignace has settled the Archdeacon.',
    },
    where: { '1': ['market_flood', 'soup_front'] },
  },
  {
    id: 'roofclinic',
    title: 'Roof Clinic',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': 'Doc Seo runs a clinic on the container roof above her drowned shop. Her Board Medical crate is still in the clinic, submerged underwater.',
      done: 'Doc Seo has retrieved her crate.',
    },
    where: { '1': ['market_flood', 'clinic_door'] },
  },
  {
    id: 'roofs',
    title: 'Roofs',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': 'Bep and Piet are stranded on their roofs south of the canal, where the water continues to rise. Get them down to the boardwalk.',
      done: 'Bep and Piet have safely left their roofs.',
    },
    where: { '1': ['market_flood', 'bep_roof'] },
  },
  {
    id: 'looters',
    title: 'Wet Money',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': "Joost and a boat of red masks are stripping Fenna's gear shop.",
      done: 'The gear shop has been secured.',
    },
    where: { '1': ['market_flood', 'loot_view'] },
  },
  {
    id: 'goingup',
    title: 'Going Up',
    kind: 'side',
    expires: 5,
    xp: 250,
    stages: {
      '1': "The floodwaters lifted Oma Joke's bed, carrying her toward the Wall while she slept. Her grandson, Teo, is in the water below.",
      done: "Oma Joke's bed has settled.",
    },
    where: { '1': ['market_flood', 'teo'] },
  },
]);

addShops([
  { id: 'fenna5', name: 'Fenna\'s Crates', items: ['stim', 'bigstim', 'frag', 'shockgren', 'smokegren', 'vest', 'rifle', 'shotgun', 'riot', 'hush'] },
]);

addCamp([
  { scene: 'camp5_clement', when: 'tilly_reasons', priority: 99 },
  { scene: 'camp5_kees', when: 'chapter>=5&kees_taken&roster:tova', priority: 98 },
  { scene: 'camp5_bird', when: 'chapter>=5&kees_bird&roster:tova', priority: 98 },
  { scene: 'camp5_port', when: 'port_want', priority: 97 },
  { scene: 'camp5_fading', when: 'port_fading', priority: 97 },
  { scene: 'camp5_courtesy', when: 'courtesy_want', priority: 96 },
  { scene: 'camp5_brink', when: 'chapter>=5&brink_aboard', priority: 90 },
]);
