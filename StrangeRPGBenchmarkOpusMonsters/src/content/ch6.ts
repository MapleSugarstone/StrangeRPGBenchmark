import { defMap, defScript, SPAWNS } from '../game/world';
import { G, flag, setFlag } from '../game/state';
import { act, choose, emote, faceToward, field, fightTrainer, giveKey, giveScale, goal, hint, joinOuro, liftOff, narr, notice, offstage, pan, panBack, say, sound, stayComesLoose, tannery, wait, walkIn, walkOff, warp } from '../game/api';
import { STOCK_5 } from './ch5';

const has = (s: string) => G.scales.includes(s);
const tuskDown = () => G.pulled.includes('tusk');
export const STOCK_6 = [...STOCK_5, 'chrysalis', 'toothnecklace', 'cleaver', 'spareskin', 'crownofhorn', 'quickstone', 'rotknife', 'warmstone'];

export async function stayChoice(id: string, askSet: () => Promise<void>, onSet: () => Promise<void>, onPull: () => Promise<void>): Promise<boolean> {
  await askSet();
  const c = await choose(['Set it', 'Pull it']);
  setFlag('chose_' + id);
  if (c === 0) { setFlag('set_' + id); await onSet(); return false; }
  await stayComesLoose(id, true);
  await onPull();
  return true;
}

/** Ouro and the people helping pack the ground round a Stay with spades. */
export async function packGround(...helpers: string[]): Promise<void> {
  for (let i = 0; i < 4; i++) {
    sound('step');
    field.shakeT = 3;
    await Promise.all([act('ouro', 'nod'), ...helpers.map(h => act(h, 'nod'))]);
  }
}

const ROW = (inner: string) => '#' + inner + '#';

defMap({
  id: 'route6', name: 'The tundra', region: 6, music: 'tundra',
  rows: [
    '######################=#####################',
    '#nnnnnnnnnnnnnnnnTnnTn=nTnnnnnnnnnnnTnnnnnn#',
    '#TTnnnnnnnnnTnnnnnnnnT=nnnnnnnn,,,nnnnnnnnn#',
    '#nnnnnnnnnnnn,,,nnnnnT=nnnnTn,,,,,,,nnTnnnn#',
    '#nnnnnnnnn,,,,,,,,,nnn=Tnnnn,,,,,,,,,nnnnnn#',
    '#nnnnnnnn,,,,,,,,,,,nn=nnnnnn,,,,,,,nnnTnnn#',
    '#nnnnnnTnT,,,,,,,,,nTn=nnnnnnnn,,,nTnnnnnnn#',
    '#nnnTnnnnnnnn,,,nnnnnn=TnnnnnnnnnnTnnIIInnT#',
    '#nTnnIIInnnnnnnnnnnTnn=nnTTnnnnnTTTIIIIIIIT#',
    '#nnIIIIIIInnnnnnnnnnnn=nnnnnnnnnnnnnnIIITnn#',
    '#nTnnIIInnnnnnnnTnnnnn=nnnnnTTnnnnnnnnnnnnn#',
    '#;;;;;;;;;;;;;;;;;;;;n=n;;;;;;;;;;n;;;;;;;;#',
    '#nnnTnnnnnnnnnTnnnTnnn=nnnnnnnnTn,,,nnnTnnn#',
    '#TnnnnTnn,,,nnnnnnnnnn=nnnnnnn,,,,,,,,,nnnn#',
    '#nnnnn,,,,,,,,,nnnnnnT======================',
    '#TnnT,,,,,,,,,,,nnnnnn=nnTnnnn,,,,,,,,,nnnn#',
    '#nnnnn,,,,,,,,,nnnnnnn=nnnnnnnTnn,,,nnnTTnn#',
    '#;;;;;;;;n;;;;;;;;;;;n=n;;;;;;;;;;;;;;;;;;;#',
    '#nnTnnnnnnnnnnnTnnnnnn=nnnnnnnTnnTnnnTnnnnn#',
    '#nnnnnnnnnnnnnnnnnTnnn=nnnnnnnnnnnnnnnTnnnn#',
    '#nnnnnnnnnnnTnnnTnIIII=nnnnnnnnTnnTnnnnTnnn#',
    '#nnnnnnnnnnnnnTnIIIIII=IInnTnnnnnnnnnnnnnnn#',
    '#nnnnnnnnnnnnnTnnnIIII=nnnnnnnnnnnnnnnnnnnn#',
    '#;;;;;;;;;;;;;;;;;;;;n=n;;;;;;;;;;;;;;;;;;;#',
    '#nTnnn,,,,,TnnTTnnnnnT=nnnnn,,,,,nnnnnnnnnn#',
    '#nn,,,,,,,,,,,nnnnnnTn=nn,,,,,,,,,,,nnnnnnn#',
    '#n,,,,,,,,,,,,,nnnnnnn=n,,,,,,,,,,,,,nnTnnn#',
    '#nn,,,,,,,,,,,nnnnnnnn=nn,,,,,,,,,,,nTnnnnn#',
    '=======================nnTnT,,,,,nnnnnnnnnn#',
    '#nnnTnnTnnnnTnnTnnnnnnnnnnnnnnnnnnnnnTnTnnn#',
    '#nTnnnnTnnnnnnnTnnnnnnnnnnnnnnnTnnnTnnnnTnn#',
    '############################################',
  ],
  warps: [
    { x: 0, y: 28, to: 'hum', tx: 42, ty: 18, dir: 3 },
    { x: 22, y: 0, to: 'tusk', tx: 20, ty: 38, dir: 2 },
  ],
  zone: { kinds: [['floe', 3], ['yoke', 3], ['menhir', 2], ['halo', 2], ['curtain', 2], ['squall', 1], ['coma', 1]], lv: [32, 36], n: 16, area: 'snow' },
  npcs: [
    { id: 'trapper', x: 8, y: 27, sprite: 'villager2', name: 'Trapper', dir: 0, trainer: { name: 'Trapper', team: [['floe', 33], ['squall', 33]], intro: 'Hyolau whorls drift down from the north on their own. We wait at the edge. It\'s a lot of waiting.', defeat: 'Right. More waiting.', sight: 4 } },
    { id: 'herder', x: 24, y: 20, sprite: 'villager2', name: 'Herder', dir: 3, trainer: { name: 'Herder', team: [['yoke', 34], ['menhir', 33]], intro: 'An ox cast\'ll pull a sledge forever. I keep meaning to tell it to stop.', defeat: 'Oh. Mine stopped.', sight: 4 } },
    { id: 'peel6', x: 20, y: 13, sprite: 'peeler', name: 'Hermit', dir: 1, trainer: { name: 'Hermit', team: [['quarry', 34], ['carrion', 34]], intro: 'We\'re undercutting the Tusk. Oldest one there is. Should go easy. Probably.', defeat: 'Eh. Doesn\'t matter. Old shells walk off the beach. Nobody sees them again.', sight: 3 } },
    { id: 'pilgrim', x: 24, y: 6, sprite: 'elder', name: 'Pilgrim', dir: 3, trainer: { name: 'Pilgrim', team: [['halo', 34], ['curtain', 34], ['floe', 35]], intro: 'Every year I walk out to the saint\'s halo. The saint\'s still out there somewhere, bareheaded.', defeat: 'Aw. Now the halo\'s somewhere else too.', sight: 4 } },
  ],
  enter: 'route6Enter',
});

defMap({
  id: 'tusk', name: 'Tusk', region: 6, music: 'tusk', oldShells: true,
  rows: [
    '########################################',
    '#nnnnnnnnnininnnnnnnnnniininnnninnnnnni#',
    '#innnninnnnininnnnnnninininnnnninnnnnin#',
    '#nnnninnnnnnnninnnnnnninnnnnnnnnninnnnn#',
    '#nnnninnnnnnnninnnnnnnnnnnninnnnnnninnn#',
    '#innnnnnininnnnnnnnnnnnnninnnnnnnpnnnnn#',
    '#nnnnnnnninnnnininnnnnnnnnnnnnnniinnnnn#',
    '#nnnnnnnninnnnnnnnnnninnnnninnnnnnnnnnn#',
    '#ninnnnnnnnniiinninnnnnnnnnnnninpnnnnnn#',
    '#nninnnnnnininnnnnnnniiiiiiiiinnnnininn#',
    '#innnnnnninninnnnnnnnnnnnnnnnnnnnnnninn#',
    '#nnnnnnnnnninnnnnnnnnnnnninnnpnnnnnnnnn#',
    '#innnnnnninnnnnnnninninnnnnnininninnnin#',
    '#nnnnnnnnninnnnnnnnnnnnnnnnnnnnniinnnnn#',
    '#nnnnnnnnninnnninnnnnnnnninnnnnininniii#',
    '#ninnnnnnnninnnnnnnininiinnnnniinnnnnii#',
    '#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn#',
    '#nnnnnBBBBBBBBBBBBBB=BBBBBBBBBBBBBnnnnn#',
    '#nnnnBnnnnnnnnnnnnnn=nnnnnnnnnnnnnBnnnn#',
    '#nnnbBbnnnnnnnnnnnnn=nnrrrrrrnrrrnnnnnn#',
    '#nnnnnnnnnnnnnnnnnnn=nnrrrrrrnrrrnnnnnn#',
    '#nnnnnnnnrrrrrrrrnnn=nnhhhdhhnhhhnnnnnn#',
    '#nnnnnnnnrrrrrrrrnnn=nnnnnnnnnnnnnnnnnn#',
    '#nnnnnnnnrrrrrrrrnnn=nnnnnnnnnnnnnnnnnn#',
    '#nnnnnnnnhhhhdhhhnnn=nnnrrrrrnnnnnnnnnn#',
    '#nnnnnnnnnnnnnnnnnnn=nnnrrrrrnnnnnnnnnn#',
    '==========nnnnnnnnnn=nnnhhhhhnnnnnnnnnn#',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnnn#',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnnn#',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnnn#',
    '#=======================================',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnn=#',
    '#nnrrrrrnnrrrnnnnnnn=nnnnnnrrrrrrnnrrr=#',
    '#nnrrrrrnnrrrnnnnnnn=nnnnnnrrrrrrnnrrr=#',
    '#nnhhdhhnnhhhnnnnnnn=nnnnnnhhhdhhnnhhh=#',
    '#nnnnnnnnnnnnnnncccn=nnnnnnnnnnnnnnnnn=#',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnn=#',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnn==========',
    '#nnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnnn#',
    '####################=###################',
  ],
  mods: [
    // Pulled, the Tusk's curve comes down, its foot leaves a hole, and it lies along the snow north of the houses.
    { x: 6, y: 17, w: 14, ch: 'n', when: tuskDown }, { x: 21, y: 17, w: 13, ch: 'n', when: tuskDown }, { x: 5, y: 18, ch: 'n', when: tuskDown },
    { x: 34, y: 18, ch: 'n', when: tuskDown }, { x: 5, y: 19, ch: 'O', when: tuskDown }, { x: 7, y: 27, w: 12, ch: 'B', when: tuskDown },
  ],
  warps: [
    { x: 20, y: 39, to: 'route6', tx: 22, ty: 1, dir: 0 },
    { x: 13, y: 24, to: 'tuskgym', tx: 6, ty: 8, dir: 2 },
    { x: 26, y: 21, to: 'tuskhouse', tx: 4, ty: 6, dir: 2 },
    { x: 0, y: 26, to: 'floes', tx: 42, ty: 18, dir: 3 },
    { x: 39, y: 30, to: 'route7', tx: 1, ty: 14, dir: 1, when: () => !!flag('chose_tusk') },
    { x: 39, y: 37, to: 'shingle', tx: 6, ty: 1, dir: 1, when: () => !!flag('chose_tusk') },
  ],
  tileTalk: { B: 'tuskStay', O: 'tuskHole', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 17, y: 34, sprite: 'tanner', name: 'Shellwright', talk: 'tuskTannery' },
    { id: 't1', x: 23, y: 28, sprite: 'veryold', name: 'Very old man', lines: ['My grandmother\'s grandmother walked down off the old shell in these boots. Still good boots.'] },
    { id: 't2', x: 9, y: 36, sprite: 'veryold', name: 'Very old woman', lines: ['We remember things for the young. There aren\'t any young here. We remember anyway, in case.'] },
    { id: 't3', x: 33, y: 28, sprite: 'elder', name: 'Old man', lines: ['My cast\'s ninety, and it\'s twelve. Don\'t ask me how. We\'ve both got bad knees, though.'] },
    { id: 't4', x: 16, y: 19, sprite: 'oldwoman', name: 'Old woman', lines: () => tuskDown() ? ['Went over all in one go. The whole ground jumped. So did I! At my age!'] : ['Amber\'s the keeper. Hundred and three. Don\'t shout at her, she hears fine. She hates that.'] },
    // Old Amber, two Hermits, and the Rider's cast at the Tusk's foot after Old Amber's fight.
    { id: 'amberOut', x: 6, y: 21, sprite: 'tallow', name: 'Old Amber', dir: 3, when: () => !!flag('tuskScene') },
    { id: 'tp1', x: 3, y: 20, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !!flag('tuskScene') },
    { id: 'tp2', x: 7, y: 20, sprite: 'peeler', name: 'Hermit', dir: 3, when: () => !!flag('tuskScene') },
    { id: 'amberslip', x: 6, y: 22, sprite: 'rider', name: 'Rider\'s cast', when: () => !!flag('tuskScene') },
    { id: 'tguard', blocks: true, x: 38, y: 29, dir: 3, sprite: 'elder', name: 'Old guard', when: () => !flag('chose_tusk'), lines: ['East\'s the Hilt road, south-east\'s the Shingle. Amber wants to see you first, though.'] },
  ],
  enter: 'tuskEnter',
});
SPAWNS.tusk = [20, 28];

defMap({
  id: 'tuskgym', name: 'Old Amber\'s hall', region: 6, indoor: true, music: 'tallow',
  rows: [
    '##############',
    '#____________#',
    '#__cc____cc__#',
    '#____________#',
    '#_p________p_#',
    '#____________#',
    '#____________#',
    '#____________#',
    '#____________#',
    '######dd######',
  ],
  warps: [{ x: 6, y: 9, to: 'tusk', tx: 13, ty: 25, dir: 0 }, { x: 7, y: 9, to: 'tusk', tx: 13, ty: 25, dir: 0 }],
  npcs: [
    { id: 'tallow', x: 6, y: 1, sprite: 'tallow', name: 'Old Amber', talk: 'tallow' },
    { id: 'tg1', x: 10, y: 6, sprite: 'veryold', name: 'Hall keeper', dir: 3, trainer: { name: 'Hall keeper', team: [['menhir', 34], ['curtain', 34], ['yoke', 35]], intro: 'Our keeper was a most formidable terror at fights!! She has told us so, at length.', defeat: 'She was, it transpires, entirely and lamentably correct.', sight: 5 } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route6Enter', async () => {
  if (!flag('ch6start')) { setFlag('ch6start'); goal('Go north across the tundra to Tusk.'); }
});

defScript('tuskEnter', async () => {
  G.flags.visited_tusk = 1;
  if (!flag('tuskSeen')) {
    setFlag('tuskSeen');
    // The Tusk curves out of the snow over the houses, black.
    await pan(20, 18);
    await wait(40);
    await panBack();
  }
});

defScript('tuskTannery', async () => {
  setFlag('fitter_tusk');
  if (!flag('charms')) {
    await say('Shellwright', 'Charms, yeah? Wear a pearl and your team fights to it. One pearl at a time. Anything else?');
    setFlag('charms');
    await hint('(Press X and pick Charm to wear one pearl. A charm helps your whole team in battle.)');
  }
  await tannery('tusk', STOCK_6);
});

defScript('tuskStay', async () => { await emote('ouro', 'silence'); });
defScript('tuskHole', async () => { await act('ouro', 'shiver'); await emote('ouro', 'question'); });

defScript('tallow', async () => {
  if (has('tusk')) { await say('Old Amber', 'You should have gone on to the Hilt, dear heart. They had talked of the Moonwater there.'); return; }
  await say('Old Amber', 'You came the long way round. I came that way too, once, in better boots.');
  await say('Old Amber', 'My grandmother\'s grandmother had told my grandmother. My grandmother had told me, at this fire.');
  await say('Old Amber', 'The Volute turned. Its old shell lifted off whole, in one magnificent piece.');
  await say('Old Amber', 'The Riders were upon it. Their houses, their machines, their fours, their good spoons.');
  await say('Old Amber', 'The shell had got up and walked north. Most of them had stayed aboard.');
  await say('Old Amber', 'A few climbed down. They walked back over the new shell. It was still soft.');
  await say('Old Amber', 'The ones who climbed down drove the Stays. They had seen it go, you understand.');
  await choose(['Did the rest choose?']);
  await say('Old Amber', 'My grandmother never said. I asked her eleven times. For the eleventh she pretended to sleep.');
  await say('Old Amber', 'Cinch had come down to the Lip, once. Cinch had gone back up quieter.');
  await say('Old Amber', 'And then Cinch sent me this.');
  await act('tallow', 'bow');
  sound('page');
  await say('Letter', 'The Volute has to hold. You will not be thanked twice. Cinch.');
  await say('Old Amber', 'It had come forty years ago. I had kept it beside the clock.');
  await say('Old Amber', 'You came for a fight. Well. I was a terror at fights, in my day.');
  const r = await fightTrainer({ name: 'Old Amber', team: [['yoke', 30], ['menhir', 30], ['halo', 30], ['floe', 31]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Old Amber', 'I had lost. I had always been going to, one day.');
  giveScale('tusk');
  await notice('Ouro gets the Tusk pearl.');
  setFlag('tuskScene');
  await warp('tusk', 5, 20, 2);
  offstage('amberOut', 'amberslip');
  // The snow at the Tusk's foot is dug away in a deep ring and the Tusk leans. Two Hermits wait with a harness.
  await act('tp1', 'nod');
  await walkIn('amberOut', 13, 24);
  faceToward('amberOut', 'ouro');
  await stayChoice('tusk', async () => {
    await say('Old Amber', 'They cut it in the night. I heard every spadeful. I was always a light sleeper.');
    await say('Old Amber', 'Other years I had set it myself. This year I had hoped you would help me.');
    await say('Hermit', 'Or. You take the haul. It\'s nearly out. One pull\'d do it.');
    await say('Hermit', 'She says the late ones should get a go. Here. Your go.');
  }, async () => {
    await packGround('amberOut');
    await Promise.all([walkOff('tp1', 20, 6), walkOff('tp2', 21, 6)]);
    faceToward('amberOut', 'ouro');
    await say('Old Amber', 'It held. It always did, bless it.');
  }, async () => {
    await act('ouro', 'shiver');
    await say('Hermit', 'That\'s three. Thanks, kid.');
    await Promise.all([walkOff('tp1', 20, 6), walkOff('tp2', 21, 6)]);
    faceToward('amberOut', 'ouro');
    await say('Old Amber', 'So it went. They went too, once. Off north, with their spoons.');
  });
  await say('Old Amber', 'I had something for you. I had kept it a very long time.');
  // A small pale whorl comes out from behind her, very old, very thin, nearly see-through.
  await liftOff('amberslip', 'amberOut', 6, 22);
  faceToward('amberslip', 'ouro');
  await say('Old Amber', 'My grandmother\'s grandmother\'s cast. A Rider\'s. She turned the very day she climbed down.');
  await say('Old Amber', 'It never fought. It had walked a long way. It had wanted north, always north.');
  await joinOuro('amberslip');
  giveKey('riderslip');
  await notice('Ouro gets a Rider\'s cast.');
  await say('Old Amber', 'They were talking of the Moonwater, at the Hilt. I heard them through two walls.');
  await walkOff('amberOut', 13, 24);
  setFlag('tuskScene', 0);
  goal('Go east from Tusk along the Hilt road.');
});
