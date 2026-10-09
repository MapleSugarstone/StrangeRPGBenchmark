import { defMap, defScript } from '../game/world';
import { G, flag, setFlag } from '../game/state';
import { act, emote, evening, faceToward, field, fightTrainer, giveScale, goal, hint, morphTo, moveNpc, narr, notice, offstage, pan, panBack, say, shake, sound, stayComesLoose, tannery, wait, walkIn, walkOff } from '../game/api';
import { stash } from './areakit';
import { SPAWNS } from '../game/world';
import { fitted } from '../game/wildfit';
import { rect, ctx } from '../engine/screen';

const has = (s: string) => G.scales.includes(s);
const pulled = () => !!flag('bolePulled');
/** The Hermits and their hauling team stand round the trunk until the Bole is pulled, and through the scene that follows. */
const haulersHere = () => !pulled() || !!flag('boleScene');

export const STOCK_4 = ['twig', 'brass', 'bone', 'whetstone', 'bitterroot', 'hideplate', 'waxcoat', 'longshin', 'ribbon', 'heartstone', 'coldiron', 'lodestone'];

export function graftonTeam(lv: number) {
  return [
    fitted('thicket', 'undertow', lv, ['snag', 'tangle', 'pullunder', 'rip'], ['thorned', 'riptide'], 'Thicktow'),
    fitted('orchard', 'hemlock', lv, ['pick', 'graft', 'dose', 'lastcup'], ['overripe', 'cup'], 'Hemchard'),
    fitted('stump', 'cairn', lv, ['splinter', 'laystone', 'stubborn', 'landslide'], ['rings', 'stacking'], 'Stumpairn'),
    fitted('howl', 'umbra', lv, ['bite', 'shade', 'blot', 'pindown'], ['bloodscent', 'penumbra'], 'Umbrowl'),
  ];
}

defMap({
  id: 'route4', name: 'The understory', region: 4, music: 'wood',
  rows: [
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT....=....TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT.....=.....TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT......=......TTTkkkkkkkkTTTTTT',
    'TTTTTTTTTTTTTTT.....=.....TTTTkkkkkkkkTTTTTT',
    'TTTTTTTTTTTTTTTT....=....TTTTTkk....kkTTTTTT',
    'TTTTTTTTTTTTTTTTTTT.=.........kk....kkTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTkk....kkTTTTTT',
    'TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTkkkkkkkkTTTTTT',
    'TTTTTTTTTTTTTTT.....=....,TTTTkkkkkkkkTTTTTT',
    'TTTT.TTTTTTTTT,,....=..,,,,TTTTTTTTTTTTTTTTT',
    'TTT...TTTTTTT,,,,,..=.,,,,,,TTTTTTTTTTTTTTTT',
    'TT.....=======,,,,,.=..,,,,,,TTTTTTTTTTTTTTT',
    'TTT...TTTTTTT,,,,,..=....,,,TTTTTTTTTTTTTTTT',
    'TTTT.TTTTTTTTT,,....=......TTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT.....=.....TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT~~~~~=~~~TTTTTTTTTTTTTTTT~~~~',
    '~~~TTTTTTTT~~~~~~~~~=~~~~~~~TTTTTTTT~~~~~~~~',
    '~~~~~~~~~~~~~~~TTTT.=.TT~~~~~~~~~~~~~~~~TTTT',
    'TTT~~~~~~~~TTT......=.....,T~~~~~~~~TTTTTTTT',
    'T::::TTTTTTTT,,.....=...,,,,TTTTTTTTTTTTTTTT',
    'T::::TTTTTTT,,,,,...=..,,,,,,TTTTTTTTTTTTTTT',
    ':s:::........,,,,,..=...,,,,,,TTTTTTTTTTTTTT',
    'T::::TTTTTTT,,,,,...=.....,,,TTTTTTTTTTTTTTT',
    'T::::TTTTTTTT,,.....=.......TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT......=......TTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTT...TTTT',
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTT.....TTT',
    'TTTTTTTTTTTTTTTTTTT.===============..,,,..TT',
    'TTTTTTTTTTTTTTT,....=.....TTTTTTTTTT,,,,,TTT',
    'TTTTTTTTTTTTTT,,,,..=......TTTTTTTTTT,,,TTTT',
    'TTTTTTTTTTTTT,,,,,,.=.....,,TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTT,,,,,,..=...,,,,,TTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTT,,,....=..,,,,,TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT......==================>.....',
    'TTTTTTTTTTTTTTT.....=.....TTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTT.=.TTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 20, y: 39, to: 'spire', tx: 20, ty: 1, dir: 0 },
    { x: 20, y: 0, to: 'bole', tx: 21, ty: 32, dir: 2 },
    { x: 0, y: 24, to: 'kelpbeds', tx: 42, ty: 13, dir: 3 },
    { x: 43, y: 36, to: 'shoutwood', tx: 20, ty: 1, dir: 0 },
  ],
  zone: { kinds: [['thicket', 3], ['orchard', 2], ['hemlock', 2], ['stump', 2], ['howl', 2], ['umbra', 1], ['mycel', 1]], lv: [20, 24], n: 16, area: 'brush' },
  npcs: [
    { id: 'forester', x: 17, y: 24, sprite: 'grafter', name: 'Forester', dir: 1, trainer: { name: 'Forester', team: [['thicket', 22], ['stump', 22]], intro: 'Hold your hat down, near the Bole. Rain falls up there and it takes hats with it.', defeat: 'Aaand there goes my hat. Up.', sight: 4 } },
    { id: 'peel4a', x: 23, y: 13, sprite: 'peeler', name: 'Hermit', dir: 3, trainer: { name: 'Hermit', team: [['crane', 22], ['yoke', 22]], intro: 'Kid, you\'re standing in the haul. We\'re hauling the Bole here.', defeat: 'Whatever. Haul\'s still going.', sight: 4 } },
    { id: 'gatherer', x: 16, y: 33, sprite: 'villager', name: 'Gatherer', dir: 1, trainer: { name: 'Gatherer', team: [['orchard', 22], ['hemlock', 23]], intro: 'Tarhaju whorls drop fruit, same as real orchards. Same fruit too. I\'ve done a lot of tasting.', defeat: 'Bruised.', sight: 3 } },
    { id: 'peel4b', x: 24, y: 24, sprite: 'peeler', name: 'Hermit', dir: 3, trainer: { name: 'Hermit', team: [['howl', 22], ['thumb', 22]], intro: 'She says ease it, don\'t yank it. So we\'re easing. Very slowly. All day.', defeat: 'Eased off.', sight: 4 } },
    { id: 'r4haul', x: 24, y: 14, sprite: 'stone', mon: 'yoke', name: 'Iesbiki', dir: 3, when: () => !pulled(), lines: ['A yoke whorl in harness, waiting to pull. It has the patience of a gate.'] },
    { id: 'r4sleep1', x: 10, y: 13, sprite: 'stone', mon: 'stump', name: 'Kankabu', sleeper: { kind: 'stump', lv: 34, flag: 'sl_under1' } },
    { id: 'r4sleep2', x: 27, y: 30, sprite: 'stone', mon: 'howl', name: 'Lupusmi', sleeper: { kind: 'howl', lv: 34, flag: 'sl_under2' } },
  ],
  spots: [
    stash('us_hollow', 3, 13, 'In the hollow past the sleeping stump, a heap of acorns and a notion under them.', { notion: 'warmstone' }),
    stash('us_dell', 38, 30, 'In the dell past the sleeping howl, two nacre wrapped in moss.', { tan: 2, notions: [['pepperkelp', 1]] }),
    stash('us_glade', 33, 7, 'In the glade inside the thicket, a sea biscuit someone left on a stump. (still crisp)', { notions: [['seabiscuit', 2]], tan: 2 }),
  ],
  enter: 'route4Enter',
});

defMap({
  id: 'bole', name: 'Bole', region: 4, music: 'town', oldShells: true,
  rows: [
    'TTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTT',
    'T....................=.....................T',
    'T.......=............=............=........T',
    'T.......====================================',
    'T.rrrrr.=.rrrr..............rrrrr.=..rrrrr.T',
    'T.rrrrr.=.rrrr..............rrrrr.=..rrrrr.T',
    'T.hhdhh.=.hhhh..j.........j.hhdhh.=..hhhhh.T',
    'T.......=........j.......j........=........T',
    'T.......=.........j.....j.........=........T',
    'T.......=..........j...j..........=........T',
    'T.......=........j..BBB..j........=........T',
    'T.......=.......j...BBB...j.......=........T',
    'T.......=...........BdB...........=........T',
    'T.......=............=............=........T',
    'T.......=............=..ccc.......=........T',
    'T.......=............=............=........T',
    'T==========================================T',
    'T.......=............=............=........T',
    'T.......=............=............=........T',
    'T.rrrrr.=.rrrr.......=............=.rrrrrr.T',
    'T.rrrrr.=.rrrr.......=......rrrr..=.rrrrrr.T',
    'T.hhdhh.=.hhhh.......=......rrrr..=.hhdhhh.T',
    'T.......=............=......hhhh..=........T',
    '=========............=............=........T',
    'T.......=............=............=........T',
    'T.......=...rrrrrr...=...rrrrrr...=........T',
    'T.......=...rrrrrr...=...rrrrrr...=........T',
    'T.......=...hhhdhh..,=...hhdhhh...=.....,..T',
    'T,......=.........,..=............=........T',
    'T....,..=.........,..=..,....,...,=........T',
    '=========.......,....=,...........=,.....,.T',
    'T.......=......,.....=............=...,....T',
    'T....................=.....................T',
    'TTTTTTTTTTTTTTTTTTTTT=TTTTTTTTTTTTTTTTTTTTTT',
  ],
  mods: [
    // Pulled, the trunk leaves a hole and the whole tree lies across three streets.
    { x: 20, y: 10, w: 3, ch: 'O', when: pulled }, { x: 20, y: 11, w: 3, ch: 'O', when: pulled }, { x: 20, y: 12, w: 3, ch: 'O', when: pulled },
    { x: 3, y: 24, w: 38, ch: 'B', when: pulled },
  ],
  warps: [
    { x: 21, y: 33, to: 'route4', tx: 20, ty: 1, dir: 0 },
    { x: 21, y: 12, to: 'bolegym', tx: 5, ty: 12, dir: 2, when: () => !pulled() },
    { x: 30, y: 6, to: 'rainhouse', tx: 4, ty: 6, dir: 2 },
    { x: 0, y: 30, to: 'kelpbeds', tx: 30, ty: 1, dir: 3 },
    { x: 43, y: 3, to: 'route5', tx: 1, ty: 15, dir: 1, when: () => has('bole') },
    { x: 21, y: 0, to: 'gantry', tx: 1, ty: 14, dir: 2, when: () => has('bole') },
  ],
  tileTalk: { B: 'boleStay', O: 'boleHole', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 25, y: 13, sprite: 'tanner', name: 'Shellwright', talk: 'boleTannery' },
    { id: 'b1', x: 5, y: 9, sprite: 'grafter', name: 'Man', lines: ['By the trunk the rain goes up. Out here it comes down. We picked out here. We like regular rain.'] },
    { id: 'b2', x: 17, y: 14, sprite: 'villager', name: 'Woman', lines: ['Grafton conjoins better than the Conjoiner. Don\'t tell either of them. It\'d be a whole thing.'] },
    { id: 'b3', x: 10, y: 28, sprite: 'child', name: 'Child', wander: true, lines: () => pulled() ? ['It came out like a tooth! A big wobbly one! Does the ground get a cowrie for it?'] : ['There\'s a bunch of big ones at the roots and they\'re pulling and nobody\'s stopping them!'] },
    { id: 'b4', x: 40, y: 27, sprite: 'elder', name: 'Old man', lines: ['My cast went up into the roots fifty years ago and never came down. Stubborn. Gets that from me.'] },
    { id: 'b5', x: 18, y: 9, sprite: 'basket', name: 'Bole woman', when: () => !!flag('boleAfterSeen'), lines: ['I dropped a stone down the hole where it was. Still listening. Shh. ...Nope. Still listening.'] },
    { id: 'zest', x: 20, y: 13, sprite: 'zest', name: 'Tellin', dir: 1, when: haulersHere },
    { id: 'haul1', x: 19, y: 11, sprite: 'stone', mon: 'crane', name: 'Notsuru', when: haulersHere },
    { id: 'haul2', x: 23, y: 11, sprite: 'stone', mon: 'yoke', name: 'Iesbiki', when: haulersHere },
    { id: 'haul3', x: 23, y: 13, sprite: 'stone', mon: 'thumb', name: 'Peubi', when: haulersHere },
    { id: 'pb1', x: 18, y: 12, sprite: 'peeler', name: 'Hermit', dir: 1, when: haulersHere, lines: ['Ease it. Ease it! Don\'t yank it. She\'ll know if you yank it.'] },
    { id: 'grafton', x: 22, y: 14, sprite: 'grafton', name: 'Grafton', when: () => pulled() || !!flag('graftonOut'), talk: 'graftonAfter' },
  ],
  triggers: [{ x: 19, y: 14, w: 5, h: 2, script: 'zestBole', when: () => !flag('zestBole') }],
  enter: 'boleEnter',
});
SPAWNS.bole = [21, 17];

defMap({
  id: 'bolegym', name: 'Inside the Bole', region: 4, indoor: true, music: 'gym',
  rows: [
    '############',
    '#__________#',
    '#_j______j_#',
    '#__________#',
    '#____jj____#',
    '#__________#',
    '#_j______j_#',
    '#__________#',
    '#____jj____#',
    '#__________#',
    '#__________#',
    '#__________#',
    '#__________#',
    '#####dd#####',
  ],
  warps: [{ x: 5, y: 13, to: 'bole', tx: 21, ty: 13, dir: 0 }, { x: 6, y: 13, to: 'bole', tx: 21, ty: 13, dir: 0 }],
  npcs: [
    { id: 'grafton', x: 5, y: 1, sprite: 'grafton', name: 'Grafton', talk: 'grafton' },
    { id: 'graft1', x: 8, y: 5, sprite: 'grafter', name: 'Grafter', dir: 3, trainer: { name: 'Grafter', sight: 4, intro: 'Made my four out of eight. I miss two of \'em. Which two changes day to day.', defeat: 'Okay, now I miss three.',
      team: () => [fitted('hemlock', 'mycel', 23, ['dose', 'spore', 'wilt', 'mycorrhiza'], ['tincture', 'fruiting'], 'Mycelock'), fitted('stump', 'orchard', 23, ['splinter', 'pick', 'sap', 'harvest'], ['rings', 'overripe'], 'Stumpchard')] } },
    { id: 'graft2', x: 3, y: 9, sprite: 'grafter', name: 'Grafter', dir: 1, trainer: { name: 'Grafter', sight: 4, intro: 'Sure, there\'s the Conjoiner in Spire. But Grafton\'s here, and Grafton\'s better. Ask anybody.', defeat: 'Grafton\'s better than me too. Obviously.',
      team: () => [fitted('howl', 'thicket', 23, ['bite', 'snag', 'tangle', 'pindown'], ['bloodscent', 'thorned'], 'Howlet'), fitted('umbra', 'hemlock', 24, ['shade', 'dose', 'wilt', 'paranoia'], ['corona', 'cup'], 'Umblock')] } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route4Enter', async () => {
  if (!flag('ch4start')) { setFlag('ch4start'); goal('Go north through the understory to the Bole.'); }
});

function rainUp(): void {
  if (pulled()) { field.overlay = null; return; }
  field.overlay = (f) => {
    const cx = 21 * 8 - f.cam[0] + 4, cy = 9 * 8 - f.cam[1] + 4;
    ctx.fillStyle = '#a8c8e0';
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399, r = 14 + (i * 7) % 40;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.7 - ((f.t * 2 + i * 13) % 50);
      rect(x, y, 1, 3, '#a8c8e0');
    }
  };
}

defScript('boleEnter', async () => {
  if (pulled()) setFlag('boleAfterSeen');
  G.flags.visited_bole = 1;
  rainUp();
  if (!flag('boleSeen')) {
    setFlag('boleSeen');
    // A tree driven in upside down: roots in the sky holding clouds, and rain falling up into them by the trunk.
    await pan(21, 8);
    await wait(60);
    await panBack();
    goal('Grafton keeps the Bole. The gym is inside the trunk.');
  }
});

defScript('boleTannery', async () => {
  setFlag('fitter_bole');
  if (!flag('notions')) {
    await say('Shellwright', 'Yeah? Notions just came in. Little things to hold. Changes how a whorl fights. One each, though.');
    setFlag('notions');
    await hint('(To give a notion, press X and pick Team. Each whorl can hold one notion.)');
  }
  await tannery('bole', [...STOCK_4, 'graftwax']);
});

defScript('zestBole', async () => {
  setFlag('zestBole');
  await Promise.all([act('haul1', 'shiver'), act('haul2', 'shiver'), act('haul3', 'shiver')]);
  faceToward('zest', 'ouro');
  await say('Tellin', 'Okay okay, I\'m pulling, you\'re watching, that\'s how this goes,');
  await say('Tellin', 'nothing\'s changing, so keep watching, yeah?');
  await say('Tellin', 'No no no, I\'m not stopping, not for a late one, not for anybody, we\'re on a schedule here, okay?');
  const r = await fightTrainer({ name: 'Tellin', team: [['crane', 27], ['yoke', 27], ['thumb', 28]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') { setFlag('zestBole', 0); return; }
  await say('Tellin', 'Yeah yeah, fine, I\'m off to the trunk and you\'re off to the gym and we\'re both working so it\'s fine.');
});

defScript('boleStay', async () => {
  await emote('ouro', pulled() ? 'silence' : 'music');
});
defScript('boleHole', async () => { await act('ouro', 'shiver'); });

defScript('grafton', async () => {
  if (has('bole')) { await say('Grafton', 'The pearl remains yours and the Stay remains lying across the street!! (we step over it)'); return; }
  await say('Grafton', 'You have descended into the trunk and I am most thoroughly gladdened by it.');
  await say('Grafton', 'Every one of my four was twain and now each is a singular and splendid one. (don\'t ask which halves)');
  await say('Grafton', 'Engage them and you shall behold the doubled magnificence of what two can do.');
  const r = await fightTrainer({ name: 'Grafton', team: () => graftonTeam(27), intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Grafton', 'You are victorious and now I bestow upon you the pearl of the Bole, which is-');
  sound('boom');
  field.shakeT = 40;
  await wait(40);
  await emote('grafton', 'surprise');
  await say('Grafton', 'They are pulling the Bole and we are standing most inconveniently inside of it!! (run)');
  setFlag('graftonOut');
  setFlag('boleScene');
  field.warp('bole', 21, 16, 2);
  offstage('grafton');
  await walkIn('grafton', 21, 12, 22, 14);
  // Outside, the haulers drag the Bole up out of the earth, and the whole tree goes over across three streets.
  await pan(21, 17);
  await Promise.all([act('haul1', 'shiver'), act('haul2', 'shiver'), act('haul3', 'shiver'), act('zest', 'hop')]);
  sound('boom');
  await shake(30);
  await stayComesLoose('bole', false);
  await morphTo('bolePulled', 21, 11, 2);
  field.overlay = null;
  await panBack();
  await say('Tellin', 'And we\'re off, we\'re off, you\'re still kind of arriving, it\'s coming loose,');
  await say('Tellin', 'it\'s loose, great work everybody, bye!');
  // Tellin, the Hermit, and the hauling team walk off north past the hole, and out of town.
  const later = (n: number, id: string, x: number) => (async () => { await wait(n); await walkOff(id, x, 1); })();
  await Promise.all([later(0, 'zest', 21), later(8, 'pb1', 22), later(16, 'haul1', 20), later(24, 'haul2', 23), later(32, 'haul3', 19)]);
  setFlag('boleScene', 0);
  await say('Grafton', 'Nevertheless the pearl is yours and the Stay is gone, and on this both my heads agree.');
  giveScale('bole');
  await notice('Ouro gets the Bole pearl.');
  await act('ouro', 'shiver');
  await say('Grafton', 'You are scratching and that is most inadvisable for a person of your age!! (quit it)');
  goal('The Hermits went north to the machine fields and Hum.');
});

defScript('graftonAfter', async () => {
  await say('Grafton', 'The tree is down and the town, I am delighted to report, is still here!!');
  await say('Grafton', 'The Hermits have marched north and taken every one of the big ones with them, most discourteously.');
});

void evening;
