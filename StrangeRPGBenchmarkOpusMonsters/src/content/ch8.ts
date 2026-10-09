import { defMap, defScript } from '../game/world';
import { G, flag, setFlag, vellumPulls } from '../game/state';
import { battle } from '../game/battleView';
import { act, emote, face, faceToward, field, fightTrainer, giveScale, goal, hint, moveNpc, narr, notice, offstage, pan, panBack, say, tannery, wait, walkIn, walkOff } from '../game/api';
import { SPAWNS } from '../game/world';
import { music } from '../engine/music';
import { makeMon } from '../data/species';
import { brack } from './ch3';
import { packGround, stayChoice, STOCK_6 } from './ch6';

const has = (s: string) => G.scales.includes(s);
const fallDown = () => G.pulled.includes('fall');

defMap({
  id: 'route8', name: 'The crater fields', region: 8, music: 'crater',
  rows: [
    '######################=#####################',
    '#.....................=....x...............#',
    '#.xx..................=....................#',
    '#.....................=...x......x.........#',
    '#.....#####...........=....................#',
    '#.....#OOO#...........=.........x#####.....#',
    '#.xx..#OOO#...........=...x..x...#OOO#.....#',
    '#....x#####x.,,,....x.=........x.#OOO#.....#',
    '#.........,,,,,,,,,...=..........#####x....#',
    '#........,,,,,,,,,,,..=.......,,,..........#',
    '#.........,,,,,,,,,...=....,,,,,,,,,x......#',
    '#......x.....,,,......=...,,,,,,,,,,,......#',
    '#...................x.=...x,,,,,,,,,.......#',
    '#.....................=.x.....,,,..........#',
    '#.x...................======================',
    '#........x............=.............x......#',
    '#......x..x....x......=..,,,.....x.........#',
    '#.......#####.........=,,,,,,,.............#',
    '#.......#OOO#...x.....=,,,,,,,,....#####...#',
    '#.......#OOO#..x......=,,,,,,,.....#OOO#...#',
    '#.......#####.........=..,,,.......#OOO#...#',
    '#...................x.=.....x......#####...#',
    '#.....x...............=x...................#',
    '#...,,,...............=....................#',
    '#.,,,,,,,.............=....................#',
    '#,,,,,,,,,..x...#####.=.x............,,,...#',
    '#.,,,,,,,.......#OOO#.=......#####..,,,,,..#',
    '#...,,,.........#OOO#.=......#OOO#.,,,,,,,x#',
    '#...............#####.=..x...#OOO#..,,,,,..#',
    '#.....................=.....x#####...,,,..x#',
    '#x....................=....x...............#',
    '######################=#####################',
  ],
  warps: [
    { x: 22, y: 0, to: 'hilt', tx: 12, ty: 28, dir: 2 },
    { x: 22, y: 31, to: 'fall', tx: 20, ty: 1, dir: 0 },
  ],
  zone: { kinds: [['flare', 3], ['tor', 3], ['bramble', 2], ['squall', 2], ['dynamo', 2], ['coma', 1]], lv: [44, 48], n: 14, area: 'slope', fitted: 0.3 },
  npcs: [
    { id: 'rock', x: 18, y: 6, sprite: 'villager2', name: 'Rock walker', dir: 1, trainer: { name: 'Rock walker', team: [['tor', 45], ['scree', 45]], intro: 'Everything out here rolls toward the Fall. Rocks, carts, me. You\'re rolling a bit right now.', defeat: 'Eh. I was rolling to the middle anyway.', sight: 4 } },
    { id: 'sky', x: 26, y: 10, sprite: 'starwalker', name: 'Sky watcher', dir: 3, trainer: { name: 'Sky watcher', team: [['flare', 45], ['coma', 45]], intro: 'The star fell, but it\'s still a star! It\'s just down there now, being one. Doing great.', defeat: 'Go touch it. It\'s warm. Like a mug.', sight: 4 } },
    { id: 'peel8', x: 21, y: 20, sprite: 'peeler', name: 'Hermit', dir: 1, trainer: { name: 'Hermit', team: [['bramble', 46], ['dynamo', 46]], intro: 'Last Stay before the Apex. Then she\'s going up. She\'s got her good boots on.', defeat: 'Doesn\'t matter. She\'ll go up anyway.', sight: 2 } },
    { id: 'synced', x: 14, y: 22, sprite: 'keeper', name: 'Synced keeper', dir: 1, trainer: { name: 'Synced keeper', team: [['squall', 50], ['howl', 50], ['orrery', 50]], intro: 'I fight at fifty. Everybody\'s the same then. That\'s when you find out who\'s actually good.', defeat: 'Found out.', sight: 4, sync: true } },
  ],
  enter: 'route8Enter',
});

defMap({
  id: 'fall', name: 'Fall', region: 8, music: 'fall', slope: [20, 16], oldShells: true,
  rows: [
    '####################=###################',
    '#...................=..................#',
    '#...................=..................#',
    '#...................=.....rrrrrr..rrr..#',
    '############.rrrrr..=.....rrrrrr..rrr..#',
    '##....@.O..#.rrrrr..=.....hhdhhh..hhh..#',
    '##o....@O..#.hhhhh..=..................#',
    '##.....o#.p#........=..................#',
    '##o.....O..#........=..................#',
    '##......#..#........=..................#',
    '###.########........=..................#',
    '#..=................=..................#',
    '#..=................=..................#',
    '#..=................=..................#',
    '#..=................=..................#',
    '#..=...............BBBB................#',
    '#..=...............BBdB=================',
    '#..=..............bbbbbb...............#',
    '#..=................=..................#',
    '#..=................=..................#',
    '#..=....rrrrrr......=..................#',
    '#..=....rrrrrr......=.....rrrrrr..rrr..#',
    '#..=....hhdhhh.ccc..=.....rrrrrr..rrr..#',
    '#..=................=.....hhhdhh..hhh..#',
    '#..=................=..................#',
    '#..=................=..................#',
    '=====================..................#',
    '#...................=..................#',
    '#...rrrrrr..........=.....rrrrr........#',
    '#...rrrrrr..........=.....rrrrr........#',
    '#...hhhhhh.x...x....=.....hhhhh.x.x....#',
    '#.x.................=....x..x..........#',
    '#.................x.=x........x..x.....#',
    '####################=###################',
  ],
  basin: { x: 1, y: 4, w: 11, h: 7, flag: 'leanSolved', done: x => x >= 9 },
  mods: [
    { x: 19, y: 15, w: 4, ch: 'x', when: fallDown }, { x: 19, y: 16, w: 4, ch: 'O', when: fallDown },
    { x: 13, y: 18, w: 4, ch: 'B', when: fallDown },
  ],
  warps: [
    { x: 20, y: 0, to: 'route8', tx: 22, ty: 30, dir: 2 },
    { x: 21, y: 16, to: 'fallgym', tx: 6, ty: 10, dir: 2, when: () => !fallDown() },
    { x: 20, y: 33, to: 'climb', tx: 8, ty: 38, dir: 2, when: () => !!flag('chose_fall') },
    { x: 28, y: 5, to: 'fallhouse', tx: 4, ty: 6, dir: 2 },
    { x: 39, y: 16, to: 'glassdesert', tx: 30, ty: 20, dir: 2 },
    { x: 0, y: 26, to: 'longway', tx: 54, ty: 12, dir: 3 },
  ],
  tileTalk: { B: 'fallStay', O: 'fallHole', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 16, y: 21, sprite: 'tanner', name: 'Shellwright', talk: 'fallTannery' },
    { id: 'f1', x: 11, y: 14, sprite: 'villager2', name: 'Man', lines: ['Mind the slope. You\'ll end up at the star by supper whether you like it or not. Everyone does.'] },
    { id: 'f3', x: 17, y: 13, sprite: 'child', name: 'Child', lines: ['The star\'s warm so we do homework on it! Mine got too hot and curled up. That counts as eaten.'] },
    { id: 'f4', x: 25, y: 14, sprite: 'oldwoman', name: 'Old woman', lines: ['Perihel tells you what\'ll happen and then it happens. Ask her why and she tells you what\'ll happen.'] },
    // Tack and Brack stay on screen through the Stay choice until they have walked off south.
    { id: 'tackfall', x: 23, y: 18, sprite: 'tack', name: 'Tack', dir: 3, when: () => !flag('chose_fall') || !!flag('tackFallStay') },
    { id: 'brackfall', x: 24, y: 18, sprite: 'tack', img: () => brack(1).sprite, name: 'Brack', dir: 3, when: () => !flag('chose_fall') || !!flag('tackFallStay') },
    // Perihel and a Hermit by the star after Perihel's fight.
    { id: 'perihelOut', x: 20, y: 18, sprite: 'perihel', name: 'Perihel', when: () => !!flag('fallScene') },
    { id: 'fp1', x: 17, y: 18, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !!flag('fallScene') },
    { id: 'cguard', blocks: true, x: 20, y: 32, sprite: 'keeper', name: 'Fall guard', when: () => !flag('chose_fall'), lines: ['Climb\'s south. Star first, though. Keeper\'s orders.'] },
  ],
  triggers: [{ x: 19, y: 17, w: 4, h: 3, script: 'tack4', when: () => !flag('tack4') }],
  enter: 'fallEnter',
});
SPAWNS.fall = [20, 20];
SPAWNS.route8 = [22, 1];

defMap({
  id: 'fallgym', name: 'On the star', region: 8, indoor: true, music: 'gym',
  rows: [
    '##############',
    '#____________#',
    '#_B________B_#',
    '#____________#',
    '#____BBBB____#',
    '#____________#',
    '#_B________B_#',
    '#____________#',
    '#____________#',
    '#____________#',
    '#____________#',
    '######dd######',
  ],
  warps: [{ x: 6, y: 11, to: 'fall', tx: 21, ty: 18, dir: 0 }, { x: 7, y: 11, to: 'fall', tx: 21, ty: 18, dir: 0 }],
  npcs: [
    { id: 'perihel', blocks: true, x: 6, y: 1, sprite: 'perihel', name: 'Perihel', talk: 'perihel' },
    { id: 'sw1', x: 3, y: 8, sprite: 'starwalker', name: 'Star walker', dir: 1, trainer: { name: 'Star walker', team: [['orrery', 46], ['curtain', 46]], intro: 'Your turn comes when it comes, okay? So push theirs back. That\'s the trick.', defeat: 'Mine came.', sight: 6 } },
    { id: 'sw2', x: 10, y: 5, sprite: 'starwalker', name: 'Star walker', dir: 2, trainer: { name: 'Star walker', team: [['turbine', 46], ['eddy', 46], ['fulgur', 47]], intro: 'Speed yours up, slow theirs down. That\'s it. That\'s the whole gym.', defeat: 'Ugh. I\'m gonna be slow tomorrow.', sight: 3 } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route8Enter', async () => {
  if (!flag('ch8start')) { setFlag('ch8start'); goal('Go south across the crater fields to Fall.'); }
});

defScript('fallEnter', async () => {
  G.flags.visited_fall = 1;
  if (!flag('fallSeen')) {
    setFlag('fallSeen');
    // A town in a crater, with the Fall in the middle: a star, black now, half in the ground.
    await pan(21, 15);
    await wait(30);
    await panBack();
    await hint('The ground tilts toward the star from every side. Walking in is fast. Walking out is slow.');
  }
});

defScript('fallTannery', async () => {
  setFlag('fitter_fall');
  if (!flag('rematches')) {
    await say('Shellwright', 'Oh, rematches are on. Every keeper\'s taking them now. Synced at fifty, so it\'s fair. Yeah?');
    setFlag('rematches');
    await hint('(You can fight a keeper again once you have their pearl. Both teams fight at level 25.)');
  }
  await tannery('fall', STOCK_6);
});

defScript('fallStay', async () => { await emote('ouro', 'sweat'); });
defScript('fallHole', async () => {
  if (field.facing()[0] < 12) return;
  await act('ouro', 'back');
  await emote('ouro', 'sweat');
});

defScript('tack4', async () => {
  face('tackfall', 3);
  await say('Tack', `4th time. I've got $${G.scales.length} pearls, you've got $${G.scales.length}. Still even. Still hate it.`);
  await say('Tack', 'I counted what it cost. Did it 2 times to be sure.');
  await say('Tack', '1 cast, that\'s all you get. Tackle had my walk. Brack\'s got 2 walks. Neither\'s mine.');
  await say('Tack', '0 regrets. That\'s the number, okay? Fight me.');
  const r = await battle({ enemy: [brack(44), makeMon('howl', 43), makeMon('turbine', 43), makeMon('quarry', 44)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival' });
  music.play('fall');
  if (r.result === 'win') {
    G.flags.tackWins = (G.flags.tackWins || 0) + 1;
    await say('Tack', `${G.flags.tackWins} losses. Stopped counting my wins. Not enough of them to bother.`);
  } else await say('Tack', '1 more than I had. I\'ll take it. I\'m taking it.');
  setFlag('tack4');
});

defScript('perihel', async () => {
  if (has('fall')) { await say('Perihel', 'You will go up. Will you look at its hands? You will have looked.'); return; }
  await say('Perihel', 'You will win this. You will enjoy it less than you will think. Then you will go up.');
  await say('Perihel', 'The Holdfast will still be standing there after you are gone. After everyone.');
  await say('Perihel', 'Will you want to look at its hands? You will have wanted to, very much.');
  const r = await fightTrainer({ name: 'Perihel', team: [['orrery', 41], ['fulgur', 41], ['dynamo', 41], ['coma', 42]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Perihel', 'You will hold out your hand. You will have the Fall pearl. You will drop it once and pick it up.');
  giveScale('fall');
  await notice('Ouro gets the Fall pearl.');
  setFlag('fallScene');
  field.warp('fall', 21, 18, 2);
  offstage('perihelOut');
  // The ground round the star is crazed through and the star has tipped. A Hermit waits with a haul.
  await walkIn('perihelOut', 21, 16, 20, 18);
  faceToward('perihelOut', 'ouro');
  await act('fp1', 'nod');
  await stayChoice('fall', async () => {
    await say('Perihel', 'Will it settle? It will have settled, if you set it. It will have come out, if you pull.');
    await say('Hermit', 'She\'s up at the Apex already. So this one\'s yours. Haul\'s right here.');
    setFlag('tackFallStay');
    face('tackfall', 3);
    await say('Tack', '8 Stays. Count what\'s left. Go on, I\'ll wait.');
  }, async () => {
    await packGround('perihelOut');
    await say('Perihel', 'It will hold. It will be a little warmer tomorrow, too.');
  }, async () => {
    await act('ouro', 'shiver');
    await say('Perihel', 'It will be a very long time before it lands again. Nobody will be standing under it.');
  });
  await say('Tack', 'Apex is 1 day up from here. I\'ll have timed it by tomorrow.');
  if (vellumPulls() <= 1) await say('Tack', 'I\'m gonna go stand by the Operculum. 1 day of standing. Easy. See you up there.');
  else await say('Tack', 'I\'m gonna stand on the Climb. You come up loose, that\'s 1 more Hermit, and I\'m not having it.');
  const goers = [walkOff('fp1', 20, 33), walkOff('perihelOut', 35, 16)];
  if (flag('tackFallStay')) goers.push(walkOff('tackfall', 20, 33), (async () => { await wait(18); await walkOff('brackfall', 20, 33); })());
  await Promise.all(goers);
  setFlag('tackFallStay', 0);
  setFlag('fallScene', 0);
  goal('The Climb goes south from Fall, up to the Apex.');
});
