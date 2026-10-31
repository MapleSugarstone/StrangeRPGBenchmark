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
  zone: { kinds: [['thicket', 3], ['orchard', 2], ['hemlock', 2], ['stump', 2], ['howl', 2], ['umbra', 1], ['mycel', 1]], lv: [10, 12], n: 16, area: 'brush' },
  npcs: [
    { id: 'forester', x: 17, y: 24, sprite: 'grafter', name: 'Forester', dir: 1, trainer: { name: 'Forester', team: [['thicket', 11], ['stump', 11]], intro: 'Keep your hat low near the Bole. The rain there falls up and carries hats away.', defeat: 'And there goes mine. Up it goes.', sight: 4 } },
    { id: 'peel4a', x: 23, y: 13, sprite: 'peeler', name: 'Hermit', dir: 3, trainer: { nacre: 1, name: 'Hermit', team: [['crane', 11], ['yoke', 11]], intro: 'Kid, you\'re blocking the path. We\'re hauling the Bole.', defeat: 'Whatever. The haul continues.', sight: 4 } },
    { id: 'gatherer', x: 16, y: 33, sprite: 'villager', name: 'Gatherer', dir: 1, trainer: { name: 'Gatherer', team: [['orchard', 11], ['hemlock', 12]], intro: 'Tarhaju whorls drop the same fruit as real orchards. I\'ve sampled plenty myself.', defeat: 'Bruised.', sight: 3 } },
    { id: 'peel4b', x: 24, y: 24, sprite: 'peeler', name: 'Hermit', dir: 3, trainer: { name: 'Hermit', team: [['howl', 11], ['thumb', 11]], intro: 'She says to ease it off, not yank. So we\'re easing. Very slowly. It\'ll take all day.', defeat: 'Eased off.', sight: 4 } },
    { id: 'r4haul', x: 24, y: 14, sprite: 'stone', mon: 'yoke', name: 'Iesbiki', dir: 3, when: () => !pulled(), lines: ['A yoke whorl harnessed and ready to pull. It possesses the patience of a gate.'] },
    { id: 'r4sleep1', x: 10, y: 13, sprite: 'stone', mon: 'stump', name: 'Kankabu', sleeper: { kind: 'stump', lv: 17, flag: 'sl_under1' } },
    { id: 'r4sleep2', x: 27, y: 30, sprite: 'stone', mon: 'howl', name: 'Lupusmi', sleeper: { kind: 'howl', lv: 17, flag: 'sl_under2' } },
  ],
  spots: [
    stash('us_hollow', 3, 13, 'In the hollow past the sleeping stump, a heap of acorns and a notion under them.', { notion: 'warmstone' }),
    stash('us_dell', 38, 30, 'Beyond the sleeping howl in the dell, two nacre wrapped in moss.', { tan: 2, notions: [['pepperkelp', 1]] }),
    stash('us_glade', 33, 7, 'In the glade within the thicket, a sea biscuit rests on a stump. (It is still crisp.)', { notions: [['seabiscuit', 2]], tan: 2 }),
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
    { id: 'b1', x: 5, y: 9, sprite: 'grafter', name: 'Man', lines: ['Rain climbs up the trunk, but out here, it falls. That\'s why we chose this spot.', 'We prefer rain that actually comes down.'] },
    { id: 'b2', x: 17, y: 14, sprite: 'villager', name: 'Woman', lines: ['Grafton conjoins better than the Conjoiner.', 'Don\'t tell either of them, or it\'ll turn into a whole drama.'] },
    { id: 'b3', x: 10, y: 28, sprite: 'child', name: 'Child', wander: true, lines: () => pulled() ? ['It popped out like a loose tooth! A big, wobbly one! Does the earth get a cowrie shell for it?'] : ['There\'s a whole cluster of them at the roots, pulling away, and nobody\'s trying to stop them!'] },
    { id: 'b4', x: 40, y: 27, sprite: 'elder', name: 'Old man', lines: ['My cast went up into the roots fifty years ago and never came down. Stubborn creature.', 'Takes after me, that one.'] },
    { id: 'b5', x: 18, y: 9, sprite: 'basket', name: 'Bole woman', when: () => !!flag('boleAfterSeen'), lines: ['I dropped a stone down the hollow where it used to be. I\'m still listening. Shh. ...Nope.', 'Still listening.'] },
    { id: 'zest', x: 20, y: 13, sprite: 'zest', name: 'Tellin', dir: 1, when: haulersHere },
    { id: 'haul1', x: 19, y: 11, sprite: 'stone', mon: 'crane', name: 'Notsuru', when: haulersHere },
    { id: 'haul2', x: 23, y: 11, sprite: 'stone', mon: 'yoke', name: 'Iesbiki', when: haulersHere },
    { id: 'haul3', x: 23, y: 13, sprite: 'stone', mon: 'thumb', name: 'Peubi', when: haulersHere },
    { id: 'pb1', x: 18, y: 12, sprite: 'peeler', name: 'Hermit', dir: 1, when: haulersHere, lines: ['Gentle. Easy now! Don\'t yank it. She\'ll know if you pull too hard.'] },
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
    { id: 'graft1', x: 8, y: 5, sprite: 'grafter', name: 'Grafter', dir: 3, trainer: { nacre: 1, name: 'Grafter', sight: 4, intro: 'I made four out of eight. I\'m missing two. Which two changes every day.', defeat: 'Alright, now I\'m missing three.',
      team: () => [fitted('hemlock', 'mycel', 12, ['dose', 'spore', 'wilt', 'mycorrhiza'], ['tincture', 'fruiting'], 'Mycelock'), fitted('stump', 'orchard', 12, ['splinter', 'pick', 'sap', 'harvest'], ['rings', 'overripe'], 'Stumpchard')] } },
    { id: 'graft2', x: 3, y: 9, sprite: 'grafter', name: 'Grafter', dir: 1, trainer: { name: 'Grafter', sight: 4, intro: 'Sure, the Conjoiner is in Spire. But Grafton is right here, and Grafton is better. Ask anyone.', defeat: 'Grafton is better than me, too. Obviously.',
      team: () => [fitted('howl', 'thicket', 12, ['bite', 'snag', 'tangle', 'pindown'], ['bloodscent', 'thorned'], 'Howlet'), fitted('umbra', 'hemlock', 12, ['shade', 'dose', 'wilt', 'paranoia'], ['corona', 'cup'], 'Umblock')] } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route4Enter', async () => {
  if (!flag('ch4start')) { setFlag('ch4start'); goal('Head north through the understory to reach the Bole.'); }
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
    goal('Grafton retains possession of the Bole. The gym is located within the trunk.');
  }
});

defScript('boleTannery', async () => {
  setFlag('fitter_bole');
  if (!flag('notions')) {
    await say('Shellwright', 'Oh really? The new notions just arrived.');
    await say('Shellwright', 'They\'re small accessories, but they alter how a whorl approaches combat. Only one per whorl, though.');
    setFlag('notions');
    await hint('(To equip a notion, press X and select Team. Each whorl can carry one notion.)');
  }
  await tannery('bole', [...STOCK_4, 'graftwax']);
});

defScript('zestBole', async () => {
  setFlag('zestBole');
  await Promise.all([act('haul1', 'shiver'), act('haul2', 'shiver'), act('haul3', 'shiver')]);
  faceToward('zest', 'ouro');
  await say('Tellin', 'Alright, alright, I\'m pulling while you observe. That\'s the routine.');
  await say('Tellin', 'nothing\'s changed, so keep your eyes on it, yeah?');
  await say('Tellin', 'No no no, I\'m not stopping. Not for a late one, not for anyone.');
  await say('Tellin', 'We\'re on a tight schedule, understand?');
  const r = await fightTrainer({ name: 'Tellin', team: [['crane', 14], ['yoke', 14], ['thumb', 14]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') { setFlag('zestBole', 0); return; }
  await say('Tellin', 'Fine, fine. I\'ll head to the trunk, you head to the gym. We\'re both busy, so it works out.');
});

defScript('boleStay', async () => {
  await emote('ouro', pulled() ? 'silence' : 'music');
});
defScript('boleHole', async () => { await act('ouro', 'shiver'); });

defScript('grafton', async () => {
  if (has('bole')) { await say('Grafton', 'The pearl remains yours, and the Seal still lies across the street! (We step over it.)'); return; }
  await say('Grafton', 'You have entered the trunk, and I am thoroughly delighted by the development.');
  await say('Grafton', 'Each of my four was two whorls, and now each is singular and magnificent. (Do not ask which halves.)');
  await say('Grafton', 'Fight them, and you will witness the doubled magnificence of what two can achieve.');
  const r = await fightTrainer({ name: 'Grafton', team: () => graftonTeam(14), intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Grafton', 'You have triumphed, and now I present you with the Bole\'s pearl, which is,');
  sound('boom');
  field.shakeT = 40;
  await wait(40);
  await emote('grafton', 'surprise');
  await say('Grafton', 'They are hauling away the Bole, and we are standing inconveniently inside it!! (Run.)');
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
  await say('Tellin', 'And we\'re off! We\'re off! You\'re still kind of arriving. It\'s coming loose.');
  await say('Tellin', 'it\'s loose. great job, everyone. bye!');
  // Tellin, the Hermit, and the hauling team walk off north past the hole, and out of town.
  const later = (n: number, id: string, x: number) => (async () => { await wait(n); await walkOff(id, x, 1); })();
  await Promise.all([later(0, 'zest', 21), later(8, 'pb1', 22), later(16, 'haul1', 20), later(24, 'haul2', 23), later(32, 'haul3', 19)]);
  setFlag('boleScene', 0);
  await say('Grafton', 'Regardless, the pearl is yours, the Seal is gone, and both my heads agree on this.');
  giveScale('bole');
  await notice('Ouro receives the Bole pearl.');
  await act('ouro', 'shiver');
  await say('Grafton', 'Please stop scratching. It\'s highly unwise for someone your age! (Stop that.)');
  goal('The Hermits moved north toward the machine fields and Hum.');
});

defScript('graftonAfter', async () => {
  await say('Grafton', 'The tree has fallen, but I\'m pleased to say the town remains intact!');
  await say('Grafton', 'The Hermits have marched north and taken all the large units with them, quite rudely, I might add.');
});

void evening;
