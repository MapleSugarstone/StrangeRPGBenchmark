// Chapter 1 data: quests, shops, loot tables, camp scenes, and the key items the story hands out.
import { addQuests } from './quests';
import { addShops } from './shops';
import { addLoot } from './loot';
import { addCamp } from './camp';
import { addItems } from '../rules/data';

addItems([
  { id: 'ledger', name: "Opal's Ledger", kind: 'key', price: 0, desc: "Opal's job book, written in pencil. The final page reads \"CLEMENT.", read: 'CLEMENT. 4000 EACH. J. H. S. IF WET, FERRIES.' },
  { id: 'flag', name: 'Your Flag', kind: 'key', price: 0, desc: 'Blue, pink, and white. It hung above your bed.' },
  { id: 'parcel', name: 'Parcel for M. Oud', kind: 'key', price: 0, desc: 'Soft. Addressed to No. 9, Pell Market. She lives on the stairs now.' },
  { id: 'worklamp', name: 'Work Lamp', kind: 'junk', price: 30, desc: 'A clamp lamp. One charge lasts a week.' },
]);

addQuests([
  {
    id: 'canal9',
    title: 'Canal Nine',
    kind: 'main',
    xp: 300,
    stages: {
      '1': 'Opal called with a job offer. Her noodle boat is docked at the pier on the market canal, south of the road.',
      '2': "Opal's job: A sealed case in the Board barge Clement's hold. Take Gus's water taxi from the east dock to Canal Nine. Jory and Hanne wait on the bridge.",
      '3': 'You are aboard the Clement. The hatch to the hold is in the center of the deck, past the containers. Retrieve the case.',
      '4': "You woke up in Doc Seo's clinic. Doc can't pull the port. Go home. Your house is on the south boardwalk, across the canal.",
      '5': 'Opal is gone, and her boat has been burned. Moss says Opal hid a tin box under her pier. Your house is sealed with Board tape, and a drone is watching the door. Sneak in and take your flag.',
      '6': "You have Opal's ledger and your flag. Return to Doc Seo's clinic, located on the road north of the canal.",
      '7': "Doc thinks Tilly might know about the port. Tilly is a tram at the Pound. Take Gus's taxi from the east dock.",
      '8': "Tilly saw the Clement run aground at the Ferry Graveyard. Opal's ledger notes that the crew meets there if a job goes south. Take Gus's taxi there.",
      '9': "Sallis, the Clement's pilot, is hiding aboard the barge. Lockjaws are closing in.",
      '10': 'Rest on the Clement.',
      done: 'The Clement is your camp now. Someone sold the job to the Board, and Sallis intends to find out who.',
    },
    where: {
      '1': ['market', 'opal_pier'],
      '2': ['market', 'taxi'],
      '3': ['canal9', 'hatch_top'],
      '4': ['market', 'home_door'],
      '5': ['market', 'pier_tin'],
      '6': ['market', 'clinic_door'],
      '7': ['pound', 'tilly_stop'],
      '8': ['ferries', 'gang_bottom'],
      '9': ['ferries', 'sallis'],
      '10': ['ferries', 'sallis'],
    },
  },
  {
    id: 'port',
    title: 'The Thing in Your Neck',
    kind: 'companion',
    stages: {
      '1': 'Something in your neck woke up in the hold of the Clement. It spoke one word: her.',
      '2': 'You named your port. It speaks only to you, using words it has heard. Your head keeps turning north, toward the Wall.',
      '3': "Tilly says sleep is for things that have already arrived. If the port gets where it's going, maybe it stops.",
      '4': 'You let the port stay, for now. It still pulls north, toward the Brim.',
      '5': 'The port speaks in full sentences now, in your own words. It still pulls upward, toward the Wall.',
      '6': 'Quaye read the code on the case steel: Line 1. The port calls Line 1 her.',
      '7': 'You came up through the Grand Lock. The port says your feet are dry.',
      done: 'The port reached Marit on the overlook. Line 1 was her.',
    },
    where: {
      '1': ['clinic', 'doc'],
      '2': ['market', 'pull'],
      '3': ['pound', 'pull'],
      '4': ['camp', 'camp_bow'],
      '5': ['market', 'pull'],
      '6': ['market', 'pull'],
      '7': ['lock', 'gate_top'],
    },
  },
  {
    id: 'toll',
    title: "Moss's Canal",
    kind: 'side',
    xp: 120,
    stages: {
      '1': 'Two Lockjaws demand 100 gilt for the canal toll. Moss claims Rina Moll charges 50. Pay, talk Dek down, or run them off.',
      done: "The toll at Moss's is settled.",
    },
    where: { '1': ['market', 'dek_talk'] },
  },
  {
    id: 'bear',
    title: 'Tuesday',
    kind: 'side',
    xp: 100,
    stages: {
      '1': "Pim's woken bear, Tuesday, is slowing down. Joost, at the counter on the west side of the market, sells cut Line 2. Alternatively, you can sit with Pim by the school.",
      '2': 'You have a drop of Line 2. Give it to Pim at the school crossing.',
      done: "Tuesday's wake is settled.",
    },
    where: { '1': ['market', 'kids'], '2': ['market', 'kids'] },
  },
  {
    id: 'census',
    title: 'The Census Van',
    kind: 'side',
    xp: 150,
    stages: {
      '1': 'Ilse is hiding her daughter, Noor, behind the containers east of the Census van. Noor once woke her cup. You can talk the tester down, pay his fee, get Noor away, or fight.',
      done: "Noor's test is settled.",
    },
    where: { '1': ['market', 'ilse_spot'] },
  },
  {
    id: 'parcel',
    title: 'Parcel for M. Oud',
    kind: 'side',
    xp: 100,
    stages: {
      '1': 'A woken delivery drone keeps bringing a parcel to No. 9 on the south boardwalk. Mevrouw Oud has moved to the Stair. You can catch the drone on its route or use the delivery terminal by the canal.',
      '2': "You have Mevrouw Oud's parcel. Bep, next door to No. 9, can send it up via the Church post.",
      done: 'The parcel for Mevrouw Oud is settled.',
    },
    where: { '1': ['market', 'oud_door'], '2': ['market', 'bep'] },
  },
  {
    id: 'door',
    title: 'The Angry Door',
    kind: 'side',
    xp: 80,
    stages: {
      '1': "Bas's ex splashed his door with cut Line 4, and it slams at him. Hush at the Cutter counter would put it to sleep. Or hold it open, take it off its hinges, or kick it in.",
      done: "Bas's door is now settled.",
    },
    where: { '1': ['market', 'bas_spot'] },
  },
  {
    id: 'loop',
    title: "Tilly's Loop",
    kind: 'side',
    xp: 120,
    stages: {
      '1': "A frightened, empty bin sits on Tilly's rail at the corner by the fence, under the lamp. Tilly won't run over it. Move it off the rail.",
      '2': 'The rail is clear. Speak with Tilly at her stop to ride the entire loop.',
      done: "You have completed Tilly's full loop.",
    },
    where: { '1': ['pound', 'corner_view'], '2': ['pound', 'tilly_stop'] },
  },
]);

addShops([
  { id: 'pell_gear', name: "Fenna's Gear", items: ['knife', 'pipe', 'machete', 'slingshot', 'pistol', 'revolver', 'raincoat', 'poncho', 'jacket', 'stim', 'frag', 'smokegren', 'worklamp'] },
  { id: 'moss_noodles', name: "Moss's Noodles", items: ['noodles', 'krill', 'eel', 'loaf'] },
  { id: 'moss_friend', name: "Moss's Noodles", items: ['noodles', 'krill', 'eel', 'loaf'], rate: 0.6 },
  { id: 'opal_noodles', name: "Opal's Boat", items: ['noodles', 'eel', 'plumcake'] },
  { id: 'cutter_counter', name: 'Lines', items: ['line4', 'line9', 'line6', 'line2', 'line11', 'hush'] },
  { id: 'doc_seo', name: "Doc Seo's", items: ['stim', 'bigstim'] },
  { id: 'pound_vend', name: 'Vending machine', items: ['krill', 'plumcake', 'chip'], rate: 0.8 },
]);

addLoot({
  home_shelf: { items: [['stim', 1, 1], ['krill', 2, 1]], gilt: [5, 15] },
  ferry_locker: { items: [['scrap', 2, 0.8], ['stim', 1, 0.5], ['firegren', 1, 0.3]], gilt: [5, 30] },
  wheelhouse: { items: [['ration', 2, 1], ['stim', 1, 0.7]] },
});

addCamp([
  { scene: 'camp_ch1', when: 'ch1_rest', priority: 100 },
  { scene: 'camp_courtesy_1', when: 'ch1_done&roster:courtesy', priority: 50 },
  { scene: 'camp_sallis_1', when: 'ch1_done&roster:sallis', priority: 40 },
  { scene: 'camp_port_rain', when: 'ch1_done', priority: 30 },
  { scene: 'camp_clement', when: 'ch1_done&roster:sallis', priority: 20 },
]);
