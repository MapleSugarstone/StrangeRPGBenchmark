// Chapter 4 data: quests, camp scenes, and the key items the story hands out.
import { addQuests } from './quests';
import { addCamp } from './camp';
import { addItems } from '../rules/data';

addItems([
  { id: 'maritmeds', name: 'Marit\'s Pills', kind: 'key', price: 0, desc: 'A Board Medical tin. She takes them twice a day, hiding the dose in her cheek.' },
  { id: 'letter', name: 'A Child\'s Letter', kind: 'key', price: 0, desc: 'Folded small, addressed to Pell Market in big, careful letters.' },
]);

addQuests([
  {
    id: 'steps',
    title: 'Sunny Steps',
    kind: 'main',
    xp: 800,
    stages: {
      '1': 'Board Recovery took Courtesy to Lost Property, where it is scheduled for scrapping in three days. Take the Church van to Lost Property to retrieve it.',
      '2': 'Courtesy is back. Kees is at Sunny Steps, and the children there travel to Mercy Spire on Thursdays. Take the van to Sunny Steps.',
      '3': 'You are inside Sunny Steps. Find Kees in the choir room and discover how the Thursday children access Mercy Spire.',
      '4': "You have the code for the Spire's service bay. Take the van to Mercy Spire.",
      '5': "The Dowser is disabled. Take the service lift on the car park's upper level to the top ward.",
      '6': 'Marit has left the ward. Courtesy is escorting her down.',
      done: 'Marit is aboard the Clement. Hendrik has fallen, and the Deeps are underwater.',
    },
    where: {
      '1': ['lostprop', 'press_view'],
      '2': ['sunny', 'gate_in'],
      '3': ['sunny', 'kees'],
      '4': ['spire', 'bay_in'],
      '5': ['spire', 'lift_door'],
      '6': ['overlook', 'rail'],
    },
  },
  {
    id: 'portpower',
    title: 'Our Hand',
    kind: 'companion',
    stages: {
      '1': 'Your port moved your hand and woke Courtesy from Hush. It can now move you in combat: Reflex Step, Second Hands, and Call. Each use strengthens its grip.',
      '2': 'The port went silent on the overlook after reaching Marit.',
      done: 'The port has settled its hold on your hand.',
    },
    where: { '1': ['lostprop', 'press_side'], '2': ['overlook', 'rail'] },
  },
  {
    id: 'lostfriends',
    title: 'Return to Owner',
    kind: 'side',
    expires: 4,
    xp: 200,
    stages: {
      '1': "Lost Property holds the Pound's woken friends, hushed on the shelves. Send them home by releasing orders from a diver, completing the lot sale on the records terminal, or carrying them to the van.",
      done: 'The Pound\'s friends are going home.',
    },
    where: { '1': ['lostprop', 'aisle_view'] },
  },
  {
    id: 'letter',
    title: 'Middle Row',
    kind: 'side',
    expires: 5,
    xp: 150,
    stages: {
      '1': 'A child at Sunny Steps wants a message delivered to the Deeps.',
      '2': "You carry a child's letter. Deliver it in Pell Market once you can get back down.",
      done: "The child's message has been delivered.",
    },
    where: { '1': ['sunny', 'noor'], '2': ['market', 'ilse_safe'] },
  },
  {
    id: 'lamsfile',
    title: 'Ninety-Four',
    kind: 'side',
    expires: 4,
    xp: 200,
    stages: {
      '1': 'Mevrouw Lam keeps a locked file on the compatibility test in her office. Find out what Kees scored ninety-four on.',
      done: 'The Board intends for Kees to become the next Line 1.',
    },
    where: { '1': ['sunny', 'lam'] },
  },
  {
    id: 'brink',
    title: 'The Night Nurse',
    kind: 'side',
    expires: 4,
    xp: 150,
    stages: {
      '1': 'Nurse Brink has looked after Marit through the night for eleven years. When Marit leaves, Brink will be the one they blame.',
      done: "Nurse Brink's night shift is settled.",
    },
    where: { '1': ['spire', 'nurse_front'] },
  },
]);

addCamp([
  { scene: 'camp4_courtesy', when: 'courtesy_freed&!port_quiet', priority: 96 },
  { scene: 'camp4_port', when: 'port_powers&!port_quiet', priority: 95 },
  { scene: 'camp4_tova', when: 'kees_done&roster:tova&!port_quiet', priority: 94 },
]);
