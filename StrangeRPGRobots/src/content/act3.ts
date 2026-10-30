// Chapter 3 data: quests, shops, loot tables, camp scenes, and the items the story hands out.
import { addQuests } from './quests';
import { addShops } from './shops';
import { addLoot } from './loot';
import { addCamp } from './camp';
import { addItems } from '../rules/data';

addItems([
  { id: 'ledgerpage', name: 'Archive Ledger Page', kind: 'key', price: 0, desc: "Forty years of monthly entries. F.W.B. TO THE SAINT'S HOUSEHOLD. 4,000 GILT. SIGNED, C. VELT.", read: 'F.W.B. TO THE SAINT\'S HOUSEHOLD. 4,000 GILT. SIGNED, C. VELT.' },
  { id: 'tovabrella', name: 'Woken Umbrella', kind: 'junk', price: 10, desc: 'Crafted by Tova. It follows you home for a week. It breathes.' },
  { id: 'lampeye', name: 'Hendrik\'s Eye', kind: 'key', price: 0, desc: 'An amber Bailer lamp, barrel-sized. It has been twenty years since Hendrik owned it, yet it still breathes.' },
  { id: 'candle', name: 'Plaza Candle', kind: 'junk', price: 2, stack: true, desc: 'Real wax. Lit for her.' },
  { id: 'saintsblood', name: 'Saint\'s Blood', kind: 'vial', price: 40, feeling: 'calm', stack: true, desc: 'Cut Line 9 into a church bottle. Wakes an object for 3 turns. It does what you tell it.' },
]);

addQuests([
  {
    id: 'raisedhand',
    title: 'Raised Hand',
    kind: 'main',
    xp: 600,
    stages: {
      '1': 'The Lock carried you up to the Stair. The port pulls toward Mercy Spire, two terraces up. Climb the Lantern Steps to the Plaza of the Raised Hand.',
      '2': 'Tova Mensah, a wild witch, is with you. The Plaza of the Raised Hand is at the top of the Steps.',
      '3': 'A man in deacon\'s robes sold you to a crowd as a miracle and went round the east side of the church with the bowl. Catch him.',
      '4': 'Ignace has a crypt under the church where nobody looks. The stair down is at the back of the nave, on the east side.',
      '5': 'You have a camp in the crypt. Ignace works the Spire\'s car park. Go and look at Mercy Spire, up the east street from the plaza.',
      '6': 'The Board gate at Mercy Spire is shut. Ask Ignace at the crypt what the Church knows about the Spire.',
      '7': 'The Church sends Mercy Spire something every month, and the church archive keeps the receipts. The Head Verger guards the archive, west of the nave.',
      '8': 'A ledger in the archive shows a Board stipend to the Saint\'s household, signed by Archdeacon Velt. Rest in the crypt.',
      '9': 'Forty years ago Quaye signed a girl of nine into the Board vault under Line 1. Go and look at the Saint\'s statue in the plaza.',
      '10': 'The port said her at the statue. Line 1 is the Saint, and she is alive in Mercy Spire. Rest in the crypt.',
      done: 'Board Recovery tracked Courtesy\'s beacon to the crypt and took it. The port wants her. Now you do too.',
    },
    where: {
      '1': ['steps', 'to_plaza'],
      '2': ['plaza', 'statue_view'],
      '3': ['plaza', 'ignace_door'],
      '4': ['church', 'crypt_door'],
      '5': ['spirebase', 'gate_view'],
      '6': ['crypt', 'camp_ignace'],
      '7': ['church', 'stam_spot'],
      '8': ['crypt', 'camp_hero'],
      '9': ['plaza', 'statue_view'],
      '10': ['crypt', 'camp_hero'],
    },
  },
  {
    id: 'kees',
    title: 'Kees',
    kind: 'companion',
    stages: {
      '1': "The Census took Tova's brother, Kees, when he was six. He is ten now. His file sits in the Census office on the west side of the plaza.",
      '2': "Kees's file lists his yield as HIGH. His placement details are on Form 11, which was sent to the Board Recovery office.",
      '3': "The Dowser told Tova where Kees is: Sunny Steps, the children's home for Board youth. He sings in their choir.",
      done: "The incident at Pump Hall settled Kees's fate. Tova now knows where he sleeps.",
    },
    where: {
      '1': ['census', 'records_term'],
      '2': ['crypt', 'camp_tova'],
      '3': ['crypt', 'camp_tova'],
    },
  },
  {
    id: 'ledger',
    title: 'The Archdeacon\'s Ledger',
    kind: 'companion',
    stages: {
      '1': 'Ignace says Archdeacon Velt bought a second boat this year, and no one earns two boats from candles alone. He wants to know what Velt knows.',
      '2': "You hold the archive ledger page: forty years of Board funds transferred to the Saint's household, signed by Velt. Ignace hasn't decided yet whether to sell it back to Velt or read it to the faithful.",
      done: 'Ignace made his choice regarding the ledger, standing face-to-face with Velt.',
    },
    where: {
      '1': ['church', 'stam_spot'],
      '2': ['crypt', 'camp_ignace'],
    },
  },
  {
    id: 'sadbox',
    title: 'Box 7',
    kind: 'side',
    xp: 120,
    stages: {
      '1': 'The mic in Box 7, the karaoke room on the middle terrace of the Steps, is awake and plays nothing but sad songs. Jet wishes it would stop.',
      done: 'Box 7 is settled.',
    },
    where: { '1': ['steps', 'box7_in'] },
  },
  {
    id: 'saintsblood',
    title: 'Saint\'s Blood',
    kind: 'side',
    xp: 120,
    stages: {
      '1': "Mertens sells Saint's Blood for twenty gilt a vial from a counter on the middle terrace of the Steps. Ask what is in it.",
      done: "The Saint's Blood transaction is complete.",
    },
    where: { '1': ['steps', 'clinic_front'] },
  },
  {
    id: 'pilgrim',
    title: 'Only His Arm',
    kind: 'side',
    xp: 140,
    stages: {
      '1': "Mevrouw Doorn came up from Canal Six to ask the Saint to take over her son's Bodywell lease. Ruud is 240 gilt in arrears. The Bodywell box is on the middle terrace of the Steps.",
      '2': "Ruud Doorn's lease is paid. Speak to his mother at the statue.",
      done: "Mevrouw Doorn's visit is resolved.",
    },
    where: { '1': ['steps', 'kiosk_front'], '2': ['plaza', 'doorn_spot'] },
  },
  {
    id: 'marks',
    title: 'The Dry Ring',
    kind: 'side',
    xp: 120,
    stages: {
      '1': "Baas and Wendel paid Ignace three hundred gilt for a ring to keep their house dry, but it flooded anyway. They want their money back, and they've brought collectors.",
      done: "Ignace's debt is settled.",
    },
    where: { '1': ['plaza', 'marks_front'] },
  },
  {
    id: 'bins',
    title: 'Rocket',
    kind: 'side',
    xp: 100,
    stages: {
      '1': 'Jasper and Fien race woken bins down the ramp on the terraces. Their bin, Rocket, was frightened when woken and is now hiding on the ramp on Terrace Two.',
      '2': 'Rocket is back at the top of the ramp. Speak to Jasper and Fien.',
      done: 'The bin race is resolved.',
    },
    where: { '1': ['terraces', 'rocket_front'], '2': ['terraces', 'kids_top'] },
  },
  {
    id: 'lampeye',
    title: 'Hendrik\'s Eye',
    kind: 'side',
    xp: 120,
    stages: {
      '1': 'Mevrouw Verhoef keeps one of Hendrik\'s lamp eyes on her balcony on Terrace Three. Lost Property collects it on Friday as Board property.',
      done: "Hendrik's eye is secured.",
    },
    where: { '1': ['terraces', 'verhoef_front'] },
  },
]);

addShops([
  { id: 'stair_gear', name: 'Pawn on the Steps', items: ['machete', 'pistol', 'revolver', 'shotgun', 'rifle', 'jacket', 'vest', 'coat', 'stim', 'bigstim', 'frag', 'shockgren', 'smokegren', 'firegren', 'hush', 'reflexwire', 'dermal'] },
  { id: 'steps_noodles', name: 'Dry Noodles', items: ['noodles', 'eel', 'loaf', 'plumcake'], rate: 1.2 },
  { id: 'candles', name: 'Candles', items: ['candle', 'krill', 'plumcake', 'stim'] },
]);

addLoot({
  stair_junk: { items: [['chip', 1, 0.6], ['scrap', 2, 0.6], ['stim', 1, 0.3]], gilt: [10, 40] },
  tova_stash: { items: [['knife', 1, 1], ['krill', 3, 1], ['line2', 1, 0.5]], gilt: [20, 40] },
  velt_locker: { items: [['bigstim', 1, 0.8], ['plumcake', 2, 1]], gilt: [80, 160] },
  church_shelf: { items: [['candle', 4, 1], ['stim', 1, 0.5]], gilt: [5, 20] },
  crypt_bones: { items: [['candle', 2, 1], ['chip', 1, 0.3]] },
  crypt_stash: { items: [['ration', 2, 1], ['stim', 2, 1], ['smokegren', 1, 0.6]], gilt: [15, 30] },
  census_locker: { items: [['hush', 1, 0.7], ['stim', 1, 0.6], ['shockgren', 1, 0.4]], gilt: [20, 50] },
});

addCamp([
  { scene: 'ch3_end', when: 'statue_seen', priority: 100 },
  { scene: 'camp3_quaye', when: 'ledger_found', priority: 99 },
  { scene: 'camp3_tova', when: 'tova_joined&crypt_settled', priority: 95 },
  { scene: 'camp3_ignace', when: 'ignace_joined&crypt_settled', priority: 94 },
  { scene: 'camp3_beacon', when: 'crypt_settled&roster:courtesy&roster:quaye&chapter<4', priority: 92 },
  { scene: 'camp3_argue', when: 'tova_joined&roster:ambrose&crypt_settled', priority: 60 },
  { scene: 'camp3_noodles', when: 'crypt_settled', priority: 55 },
]);
