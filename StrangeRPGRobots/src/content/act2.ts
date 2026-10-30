// Chapter 2 data: quests, shops, camp scenes, and the key items the story hands out.
import { addQuests } from './quests';
import { addShops } from './shops';
import { addCamp } from './camp';
import { addItems } from '../rules/data';

addItems([
  { id: 'portkey', name: 'Board Port Key', kind: 'key', price: 0, desc: 'A port key belonging to a Board officer. The tag reads "WOUTERS.' },
  { id: 'lockpass', name: 'Lock Pass', kind: 'key', price: 0, desc: "A forged Board pass granting one night's passage through the Grand Lock. Do not fold it." },
  { id: 'mrbutton', name: 'Mister Button', kind: 'key', price: 0, desc: 'A sock rabbit with button eyes. It breathes.' },
]);

addQuests([
  {
    id: 'arrears',
    title: 'Arrears',
    kind: 'main',
    xp: 500,
    stages: {
      '1': 'The Board has sealed the bridges and put up posters with your face. The only way up is the Grand Lock, but it scans ports. Find Quaye at the Spin, on Canal Four. Gus can take you.',
      '2': "Quaye can hide your port at the Lock. Before crossing, you need three things: a way through the Lock, Sallis's contact behind the fish market on Canal Six, and Ambrose from the Pit. Each has its own entry.",
      '3': 'Everything is ready. Take Gus\'s taxi to the Grand Lock tonight.',
      '4': 'The Lock was a trap. The water is rising. Get to the upper gate.',
      done: 'The Lock carried you up. You are now on the Stair, dry and wanted.',
    },
    where: {
      '1': ['spin', 'throne'],
      '2': ['market', 'taxi'],
      '3': ['lock', 'taxi'],
      '4': ['lock', 'gate_top'],
    },
  },
  {
    id: 'route',
    title: 'A Way Through the Lock',
    kind: 'main',
    stages: {
      '1': "Three ways through the Lock. A forged pass: Quaye needs a Board officer's port key, and Officer Wouters is at the west bridge checkpoint. The Lockjaws' run: Rina Moll at the east dock. The Cutters' route: ask Joost at the Cutter counter about Mother Sieve.",
      done: 'You have a way through the Lock.',
    },
    where: { '1': ['market', 'wouters_talk'] },
  },
  {
    id: 'quaye',
    title: 'Forty Years Retired',
    kind: 'companion',
    expires: 5,
    stages: {
      '1': 'Hester Quaye joined you after the Board Recovery raid on the Spin. She read Line 1 on the case steel and confirmed it was retired forty years ago, but she refuses to say more.',
      '2': 'Quaye says she signed four hundred forms the year Line 1 was retired, and she remembers one.',
      '4': 'Marit is aboard the Clement. Quaye has something to tell her.',
      done: 'Quaye told Marit about the form.',
    },
    where: { '1': ['camp', 'camp_quaye'], '2': ['camp', 'camp_quaye'], '4': ['camp', 'marit_bed'] },
  },
  {
    id: 'ambrose',
    title: 'Rented Arms',
    kind: 'companion',
    stages: {
      '1': 'Ambrose Kwarteng is fighting at the Pit tonight. He owes Bodywell four hundred gilt for his chrome. The bookie, Kroon, has made him an offer.',
      '2': "Ambrose is with you, four hundred gilt in debt on his lease. Pay it off at the Bodywell kiosk on the market's north road before you head up, or they'll repossess his eye.",
      '3': 'Ambrose\'s debt is paid. For now.',
      '4': "Bodywell has put Ambrose's eye into arrears. It is now displaying ads.",
      '6': "Bodywell has moved its Deeps repossession office to the dry top floor of the Cutters' garage. Ambrose's lease is filed there, on paper.",
      done: 'Ambrose\'s lease is settled.',
    },
    where: { '1': ['pit', 'ambrose'], '2': ['market', 'bodywell_front'], '3': ['camp', 'camp_ambrose'], '4': ['camp', 'camp_ambrose'], '6': ['garage', 'tea_seat'] },
  },
  {
    id: 'vein',
    title: 'Cell Nine',
    kind: 'companion',
    stages: {
      '1': 'Sallis wants to check on her Vein contact behind the fish market on Canal Six. Take Sallis with you.',
      '2': "The Dowser has left Sallis's safehouse. Board Recovery is still inside. Sneak in or fight your way through.",
      '3': "Two of Sallis's people are dead, and her cell has moved without her. A note found in a dead man's hand mentions H.V. Sallis reads it as Hanne Vroom, who fled the Clement.",
      '5': 'Hanne Vroom is in Pell Market with a Recovery team, searching the eastern rooftops for wild children. Take Sallis.',
      done: 'Sallis has dealt with Hanne.',
    },
    where: { '1': ['vein', 'street'], '2': ['vein', 'dead2'], '3': ['camp', 'camp_sallis'], '5': ['market_flood', 'hanne_view'] },
  },
  {
    id: 'opal',
    title: 'Opal',
    kind: 'main',
    stages: {
      '1': "Joost reports that Mother Sieve has Opal locked up at the Cutters' garage. She wants to meet you there for tea. Gus knows the way.",
      '2': "Mother Sieve wants your port in exchange for Opal and passage up the Wall. Opal is being held on the garage's lower level.",
      done: 'Opal is free and now selling from the Clement.',
    },
    where: { '1': ['garage', 'tea_door'], '2': ['garage', 'opal'] },
  },
  {
    id: 'button',
    title: 'Mister Button',
    kind: 'side',
    expires: 2,
    xp: 100,
    stages: {
      '1': "Officer Wouters at the west bridge checkpoint confiscated Dita's woken sock rabbit, Mister Button. He sells such toys for fifty gilt. Retrieve him from the school and return him to Dita.",
      done: 'Mister Button has been returned.',
    },
    where: { '1': ['market', 'wouters_talk'] },
  },
  {
    id: 'jukebox',
    title: 'The Jukebox',
    kind: 'side',
    expires: 2,
    xp: 100,
    stages: {
      '1': "The woken jukebox outside the bar on the market's north road owes the Cutters protection money, but it can only pay in songs. Settle its debt, negotiate with the collector, or drive him off.",
      done: "The jukebox's debt is settled.",
    },
    where: { '1': ['market', 'jukebox_front'] },
  },
  {
    id: 'choir',
    title: 'Two Yeses',
    kind: 'side',
    expires: 2,
    xp: 150,
    stages: {
      '1': 'Henk says gray-robed monks took Doc Seo toward the Ferry Graveyard.',
      '2': 'The Choir wants Doc to strip the chrome from a willing woman by the mud near the beached ferries. Doc refuses.',
      done: 'Doc Seo has returned to her clinic.',
    },
    where: { '1': ['ferries', 'choir_view'], '2': ['ferries', 'choir_view'] },
  },
  {
    id: 'floathouse',
    title: 'A House on Floats',
    kind: 'side',
    expires: 2,
    xp: 150,
    stages: {
      '1': "The Bosmans plan to float their stilt house up through the Grand Lock. Pay the Board's three-hundred fee, ask Bram, or have Quaye list it as cargo. Rina will run your crew free if you do.",
      done: "The Bosmans' house has moved up through the Lock.",
    },
    where: { '1': ['lock', 'grille'] },
  },
  {
    id: 'umbrella',
    title: 'Forty Years Dry',
    kind: 'side',
    expires: 2,
    xp: 120,
    stages: {
      '1': "Old Piet's umbrella follows him around, keeping him dry. His wife, Fem, woke it at their wedding but never registered it. He wants it deactivated before the Census takes notice.",
      done: "Piet's umbrella has been settled.",
    },
    where: { '1': ['market', 'piet_home'] },
  },
]);

addShops([
  { id: 'opal_camp', name: "Opal's Stall", items: ['noodles', 'eel', 'plumcake', 'stim', 'bigstim', 'pistol', 'jacket', 'smokegren', 'frag'] },
  { id: 'bar', name: "Lotte's Bar", items: ['krill', 'noodles', 'plumcake'] },
  { id: 'fish', name: 'Fish Market', items: ['eel', 'krill'] },
]);

addCamp([
  { scene: 'camp2_opal', when: 'opal_free', priority: 90 },
  { scene: 'camp2_quaye', when: 'quaye_joined', priority: 85 },
  { scene: 'camp2_ambrose', when: 'ambrose_joined', priority: 80 },
  { scene: 'camp2_sallis', when: 'vein_done&roster:sallis', priority: 75 },
  { scene: 'camp2_port', when: 'line1_read', priority: 70 },
  { scene: 'camp2_courtesy', when: 'chapter>=2&roster:courtesy', priority: 88 },
]);
