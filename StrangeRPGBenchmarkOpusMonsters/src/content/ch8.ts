import { defMap, defScript } from '../game/world';
import { G, flag, setFlag, vellumPulls } from '../game/state';
import { battle } from '../game/battleView';
import { act, emote, face, faceToward, field, fightTrainer, giveScale, goal, hint, moveNpc, narr, notice, offstage, pan, panBack, say, tannery, wait, walkIn, walkOff, walkTo } from '../game/api';
import { SPAWNS } from '../game/world';
import { music } from '../engine/music';
import { makeMon } from '../data/species';
import { brack } from './ch3';
import { packGround, stayChoice, STOCK_6 } from './ch6';
import { countTack, tackTally, tackTries, tackWinsLine } from './tack';

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
  zone: { kinds: [['flare', 3], ['tor', 3], ['bramble', 2], ['squall', 2], ['dynamo', 2], ['coma', 1]], lv: [22, 24], n: 14, area: 'slope', fitted: 0.3 },
  npcs: [
    { id: 'rock', x: 18, y: 6, sprite: 'villager2', name: 'Rock walker', dir: 1, trainer: { nacre: 1, name: 'Rock walker', team: [['tor', 23], ['scree', 23]], intro: 'Everything rolls to the Fall. Rocks, carts, me. You\'re rolling now.', defeat: 'Eh. I was heading for the middle anyway.', sight: 4 } },
    { id: 'sky', x: 26, y: 10, sprite: 'starwalker', name: 'Sky watcher', dir: 3, trainer: { name: 'Sky watcher', team: [['flare', 23], ['coma', 23]], intro: 'It fell but stays a star. Just down there now. Doing great.', defeat: 'Go touch it. It\'s warm. Like a mug of tea.', sight: 4 } },
    { id: 'peel8', x: 21, y: 20, sprite: 'peeler', name: 'Hermit', dir: 1, trainer: { name: 'Hermit', team: [['bramble', 23], ['dynamo', 23]], intro: 'This is the last Seal before the Apex. Then she heads up. She\'s laced up her good boots.', defeat: 'Doesn\'t matter. She\'ll go up regardless.', sight: 2 } },
    { id: 'synced', x: 14, y: 22, sprite: 'keeper', name: 'Synced keeper', dir: 1, trainer: { nacre: 1, name: 'Synced keeper', team: [['squall', 25], ['howl', 25], ['orrery', 25]], intro: 'I fight at twenty-five. That\'s when everyone levels out. That\'s when you see who\'s truly talented.', defeat: 'Found out.', sight: 4, sync: true } },
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
    '##.oo...O..#.rrrrr..=.....hhdhhh..hhh..#',
    '##.#oo..#..#.hhhhh..=..................#',
    '###@....#.p#........=..................#',
    '##......O..#........=..................#',
    '##....#.#..#........=..................#',
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
    { id: 'f1', x: 11, y: 14, sprite: 'villager2', name: 'Man', lines: ['Watch the slope. You\'ll end up at the star by supper time whether you like it or not. We all do.'] },
    { id: 'f3', x: 17, y: 13, sprite: 'child', name: 'Child', lines: ['The star is warm, so we do homework on it! Mine got too hot and curled up. That counts as eaten.'] },
    { id: 'f4', x: 25, y: 14, sprite: 'oldwoman', name: 'Old woman', lines: ['Perihel tells you what will happen, and then it happens.', 'Ask her why, and she tells you what will happen next.'] },
    // Tack and Brack stay on screen through the Stay choice until they have walked off south.
    { id: 'tackfall', x: 23, y: 18, sprite: 'tack', name: 'Tack', dir: 3, when: () => !flag('chose_fall') || !!flag('tackFallStay') },
    { id: 'brackfall', x: 24, y: 18, sprite: 'tack', img: () => brack(1).sprite, name: 'Brack', dir: 3, when: () => !flag('chose_fall') || !!flag('tackFallStay') },
    // Perihel and a Hermit by the star after Perihel's fight.
    { id: 'perihelOut', x: 20, y: 18, sprite: 'perihel', name: 'Perihel', when: () => !!flag('fallScene') },
    { id: 'fp1', x: 17, y: 18, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !!flag('fallScene') },
    { id: 'cguard', blocks: true, x: 20, y: 32, sprite: 'keeper', name: 'Fall guard', when: () => !flag('chose_fall'), lines: ['The climb is to the south. Star first, though. That\'s the Keeper\'s order.'] },
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
    { id: 'sw1', x: 3, y: 8, sprite: 'starwalker', name: 'Star walker', dir: 1, trainer: { name: 'Star walker', team: [['orrery', 23], ['curtain', 23]], intro: 'Your turn comes when it comes, alright? So push theirs back. That\'s the trick.', defeat: 'Mine came.', sight: 6 } },
    { id: 'sw2', x: 10, y: 5, sprite: 'starwalker', name: 'Star walker', dir: 2, trainer: { name: 'Star walker', team: [['turbine', 23], ['eddy', 23], ['fulgur', 24]], intro: 'Speed yours up, slow theirs down. That\'s it. That\'s the whole game.', defeat: 'Ugh. I\'m going to be slow tomorrow.', sight: 3 } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route8Enter', async () => {
  if (!flag('ch8start')) { setFlag('ch8start'); goal('Head south across the crater fields to reach Fall.'); }
});

defScript('fallEnter', async () => {
  G.flags.visited_fall = 1;
  if (!flag('fallSeen')) {
    setFlag('fallSeen');
    // A town in a crater, with the Fall in the middle: a star, black now, half in the ground.
    await pan(21, 15);
    await wait(30);
    await panBack();
    await hint('The terrain slopes down toward the star from all directions.');
    await hint('It\'s a quick walk in, but a slow trek back out.');
  }
});

defScript('fallTannery', async () => {
  setFlag('fitter_fall');
  if (!flag('rematches')) {
    await say('Shellwright', 'Rematches are back on. Every keeper is doing them now.');
    await say('Shellwright', 'We\'re synced to level twenty-five, so it\'s fair. Right?');
    setFlag('rematches');
    await hint('(You can challenge a keeper again once you have their pearl. Both teams will fight at level 25.)');
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
  const tries = tackTries('4');
  if (tries) await say('Tack', `Try ${tries + 1}. Still 0 regrets. I'm still keeping track.`);
  else {
    await say('Tack', `it's the 4th round. you've got $${G.scales.length} pearls, I've got $${G.scales.length}. we're tied. i still despise it.`);
    await say('Tack', 'I tallied the cost. I ran it 2 times to verify.');
    await say('Tack', '1 cast, that\'s all you get. Tackle had my walk. Brack\'s got 2 walks. Neither\'s mine.');
    await say('Tack', '0 regrets. That\'s the count, right? bring it on.');
  }
  const r = await battle({ enemy: [brack(22), makeMon('howl', 22), makeMon('turbine', 22), makeMon('quarry', 22)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival' });
  music.play('fall');
  countTack('4', r.result === 'win');
  if (r.result !== 'win') {
    // Tack keeps the star's door until Ouro wins. Ouro steps back out of the trigger.
    await say('Tack', `${tackWinsLine()} I'll take it. I'm backing this star until you win 1.`);
    await walkTo('ouro', 20, 20);
    face('tackfall', 3);
    return;
  }
  const t = tackTally();
  await say('Tack', `${t.ouro} losses. ${t.tack} wins. I track both. The 2nd figure is just shorter.`);
  setFlag('tack4');
});

defScript('perihel', async () => {
  if (has('fall')) { await say('Perihel', 'You will rise. Will you look at its hands? You will have looked.'); return; }
  await say('Perihel', 'You will win this. You will enjoy it less than you expect. Then you will go up.');
  await say('Perihel', 'The Holdfast will still be standing after you are gone. After everyone is gone.');
  await say('Perihel', 'Will you want to look at its hands? You will have wanted to, more than anything.');
  const r = await fightTrainer({ name: 'Perihel', team: [['orrery', 23], ['fulgur', 23], ['dynamo', 23], ['coma', 24]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Perihel', 'You will hold out your hand. You will hold the Fall pearl. You will drop it once, then pick it up.');
  giveScale('fall');
  await notice('Ouro has claimed the Fall pearl.');
  setFlag('fallScene');
  field.warp('fall', 21, 18, 2);
  offstage('perihelOut');
  // The ground round the star is crazed through and the star has tipped. A Hermit waits with a haul.
  await walkIn('perihelOut', 21, 16, 20, 18);
  faceToward('perihelOut', 'ouro');
  await act('fp1', 'nod');
  await stayChoice('fall', async () => {
    await say('Perihel', 'Will it settle? It settles if you set it. It emerges if you pull.');
    await say('Hermit', 'She\'s already at the Apex. So this one is yours. The haul is right here.');
    setFlag('tackFallStay');
    face('tackfall', 3);
    await say('Tack', '8 Seals. Count what remains. I\'ll wait.');
  }, async () => {
    await packGround('perihelOut');
    await say('Perihel', 'It will hold. It\'ll be a bit warmer tomorrow, too.');
  }, async () => {
    await act('ouro', 'shiver');
    await say('Perihel', 'It will be a very long time before it lands again. No one will be standing beneath it.');
  });
  await say('Tack', 'Apex is 1 day ahead. I\'ll have the schedule ready by tomorrow.');
  if (vellumPulls() <= 1) await say('Tack', 'I\'m heading to stand guard at the Operculum. Just 1 day of standing. Simple. See you there.');
  else await say('Tack', 'I\'m taking my place on the Climb. If you come up loose, that\'s 1 more Hermit, and I\'m not having it.');
  const goers = [walkOff('fp1', 20, 33), walkOff('perihelOut', 35, 16)];
  if (flag('tackFallStay')) goers.push(walkOff('tackfall', 20, 33), (async () => { await wait(18); await walkOff('brackfall', 20, 33); })());
  await Promise.all(goers);
  setFlag('tackFallStay', 0);
  setFlag('fallScene', 0);
  goal('The Climb leads south from Fall, ascending to the Apex.');
});
