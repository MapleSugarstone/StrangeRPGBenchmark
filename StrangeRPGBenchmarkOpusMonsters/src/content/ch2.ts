import { defMap, defScript } from '../game/world';
import { G, flag, setFlag } from '../game/state';
import { battle } from '../game/battleView';
import { act, choose, emote, evening, faceToward, field, fightTrainer, giveScale, goal, hint, morphTo, moveNpc, narr, notice, npcAt, offstage, pan, panBack, say, sound, stayComesLoose, tannery, tint, wait, walkIn, walkOff, walkTo, walkUp } from '../game/api';
import { music } from '../engine/music';
import { look, stash } from './areakit';
import { CHART_HOLLOW, standingWild } from './ring';

import { SPAWNS } from '../game/world';
import { makeMon } from '../data/species';
import { sfx } from '../engine/audio';
import { countTack, tackLosesLine, tackTries, tackWinsLine } from './tack';

const has = (s: string) => G.scales.includes(s);
const fell = () => !!flag('mastFell');
const row = (s: string) => s;

defMap({
  id: 'route2', name: 'The Dry Sea', region: 2, music: 'drysea',
  rows: [
    '##############;###############;#############;###########',
    '#sss,s,sssss,ssss,ssssss,sssssssss,ss,s,ssssss,,,ss,sss#',
    '#sssssssssss,ssssss,ssss,ss,ssss,ssssssssssssss,,ssssss#',
    '#,sss,sss,sss,,s,ss,,sssss,ssssss,ss,ssss,sss,ss#,ss,,s#',
    '#ssssssss########sssssssss,,,,,sssssssssssssssss#ssssss#',
    '#sssssss,,,,,sssssssss,,,,,,,,,,,,,sssssssssssss#ssssss#',
    '#ssss,,,,,,,,,,,sssss,,,,,,,,,,,,,,,ssssssss,,,s#ssssss#',
    '#sss,,,,,,,,,,,,,sssssx,,,,,,,,,,,,ssssss,,,,,,,,,sssss#',
    '#ssss,,,,,,,,,,,ssssssssss,,,,,sssssssss,,,,,,,,,,,ssss#',
    '#########,,,,sssssssssssssssss#######ssss,,,,,,,,,sssss#',
    '#########sssssssssssssssssssssssssssssssssss,,,ssssssss#',
    '#ssssssssssssssssssssssssssssssssssssssssssssssssssssss#',
    '========================================================',
    '#ssssssssssssssssssssssssssssssssssssssssssssssssssssss#',
    '#########ssssssssssssssssssssssssssssssssssssssssssssss#',
    '#########ssssssssssssssseeeeeesssxsssssssssssssssssssss#',
    '#ssssssssssss,,,,,sssssseeeeeessssssssss######sssssssss#',
    '#ssssssss,,,,,,,,,,,,,sssssssssssssssssssssssssssssssss#',
    '#sss#####,,,,,,,,,,,,,,sssssssssss,,,,,ssssssssssssssss#',
    '#ssssssss,,,,,,,,,,,,,sssssssss,,,,,,,,,,,sssssssssssss#',
    '#ssssssssssss,,,,,ssssssssssss,,,,,,,,,,,,,sss#####ssss#',
    '#ssssssssssssssssssssssssssssss,,,,,,,,,,,ssss#sss#ssss#',
    '#sssssssssssssssss#######sssssssss,,,,,sssssss#sss#ssss#',
    '#ssssss,,,ssssssssssssss,,,,,sssssssssssssssss#sss#ssss#',
    '#sss,,,,,,,,,ssssssss,,,,,,,,,,,ssssssssssssss##s##ssss#',
    '#ss,,,,,,,,,,,ssssss,,,,,,,,,,,,,sssssssssssxssssssssss#',
    '#sss,,,,,,,,,ssssssss,,,,,,,,,,,sssssssssssssssssssssss#',
    '#ssssss,,,sssxssssssssss,,,,,ssssssssssssssssssssssssss#',
    '#ssssssssssssssssssssssssssssssssssssssssssssssssssssss#',
    '#YY===YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY#',
    '#YY===YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYss~YYYYYYYYYYY#',
    '#YY===YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYsssYYYYYYYYYYY#',
    '#YY===YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY#',
    '####=###################################################',
  ],
  warps: [
    { x: 55, y: 12, to: 'rib', tx: 1, ty: 16, dir: 1 },
    { x: 0, y: 12, to: 'mast', tx: 42, ty: 12, dir: 3 },
    { x: 4, y: 33, to: 'wrecks', tx: 19, ty: 1, dir: 0 },
  ],
  zone: { kinds: [['scree', 3], ['brine', 3], ['bore', 2], ['carrion', 2], ['coma', 1], ['eddy', 2], ['paring', 1]], lv: [4, 6], n: 14, area: 'sand' },
  npcs: [
    { id: 'salter', x: 16, y: 11, sprite: 'tanner', name: 'Salter', dir: 0, trainer: { name: 'Salter', team: [['brine', 5], ['scree', 5]], intro: 'The sea\'s been gone forty years, yet I still salt the fish. They\'re dry. I just like doing it.', defeat: 'Great. I\'ll go salt a rock, then.', sight: 3 } },
    { id: 'wrecker', x: 27, y: 14, sprite: 'villager2', name: 'Wrecker', dir: 2, trainer: { name: 'Wrecker', team: [['bore', 6], ['carrion', 5]], intro: 'I live in a boat on the sand. I love it. It\'s never sunk, not once.', defeat: 'I\'m going to go sit in my boat now.', sight: 3 } },
    { id: 'shellgirl', x: 40, y: 13, sprite: 'child', name: 'Shell girl', dir: 3, trainer: { nacre: 1, name: 'Shell girl', team: [['paring', 5], ['eddy', 6]], intro: 'Every shell out here used to house a person. The pink one is mine. I claimed it first, okay?', defeat: 'Don\'t step on it.', sight: 4 } },
    { id: 'fisher', x: 20, y: 28, sprite: 'elder', name: 'Old fisher', lines: ['That gray one is the sea\'s old shell. Every dusk, it returns and stands there, staring at my house.', 'It never comes in. If I were younger, I\'d walk out there and speak to it.'] },
    { id: 'tackds', x: 2, y: 12, sprite: 'tack', name: 'Tack', dir: 1, when: () => !flag('tack2') },
    { id: 'dssleeper', x: 48, y: 24, sprite: 'stone', mon: 'scree', name: 'Jarira', sleeper: { kind: 'scree', lv: 11, flag: 'sl_drysea' } },
    standingWild('grayrare', 42, 30, 'fata', 15),
  ],
  spots: [
    stash('ds_reef', 48, 22, 'Inside the reef ring, where the sleeper spanned the gap, grew a pepper kelp, still green.', { notions: [['pepperkelp', 1]] }),
    stash('ds_gray', 41, 31, 'In the bay\'s final pool, within the gray haze, lay a gray lump that smelled of the sea.', { items: [['ambergris', 1]] }),
    { x: CHART_HOLLOW[0], y: CHART_HOLLOW[1], when: () => G.keys.includes('chart') && !flag('doorDug'), script: 'digDoor' },
  ],
  triggers: [{ x: 6, y: 11, w: 2, h: 3, script: 'tack2', when: () => !flag('tack2') }],
  enter: 'route2Enter',
});

defMap({
  id: 'mast', name: 'Mast', region: 2, music: 'town', oldShells: true,
  rows: [
    '##############################=#############',
    '#=ssssss=sssssssrrrrrrrrrrrsss=sss=ssssssss#',
    '#=ssssss=sssssssrrrrrrrrrrrsss=sss=ssssssss#',
    '==ssssss=sssssssrrrrrrrrrrrsss=sss==========',
    '#=rrrrrs=ssssssshhhhhdhhhhhsss=sss=srrrrrrs#',
    '#=rrrrrs=srrrrsssssss=ssrrrrss=sss=srrrrrrs#',
    '#=hhdhhs=srrrrsssssss=ssrrrrss=sss=shhdhhhs#',
    '#=ssssss=shhhhsssssss=sshhhhss=sss=ssssssss#',
    '#==========================================#',
    '#sssssss=ssssssssssssssssss=ssssss=ssssssss#',
    '#sssssss=sxxsssssssssBsssss=ssssss=ssssssss#',
    '#sssssss=ssscccsssssxBsssss=sxxssx=ssssssss#',
    '#sssssss=ssssssssssssBsssss=ssssss==========',
    '#sssssss=ssssssssxsssBsssss=ssssss=ssssssss#',
    '#sssssss=sssssssssxssBsxsss=ssssss=ssssssss#',
    '#srrrrrs=srrrsssssssbBbssss=ssssss=srrrrrss#',
    '#srrrrrs=srrrsssssssbbbssss=ssssss=srrrrrss#',
    '#shhdhhs=shhhsxssssss=sssss=ssssss=shhdhhss#',
    '#sssssss=ssssssssssss=sssss=sssxss=ssssssss#',
    '#==========================================#',
    '#sssssss=sssssssssss===sssssssssss=ssssssss#',
    '#srrrrrs=sssssssssss===sssssssssss=srrrrrss#',
    '#srrrrrs=sxsssssssss===sssssssssss=srrrrrss#',
    '#xhhdhhs=sssssssssss===sssssssxsss=shhdhhss#',
    '#sssssss=sssssssssss===sssssssssss=ssssssss#',
    '#sssssss=ssssssxssss===sssssssssss=ssssssss#',
    '=========ssssssxssss===ssssssssssssssssssss#',
    '#sssssssssssssssssss===ssssssssxsssssssssss#',
    '#sssssssssssssssssss===sssssssssssssssssssx#',
    '#sssssssssssssssssss===ssssssssssssssssssss#',
    '#sssssssssssssssssss===ssssssssssssssssssss#',
    '############################################',
  ],
  mods: [
    // After the fall the Mast lies east along the sand across two boardwalks, and its foot is a hole.
    { x: 21, y: 10, ch: 's', when: fell }, { x: 21, y: 11, ch: 's', when: fell }, { x: 21, y: 12, ch: 's', when: fell },
    { x: 21, y: 13, ch: 's', when: fell }, { x: 21, y: 14, ch: 's', when: fell }, { x: 21, y: 15, ch: 'O', when: fell },
    { x: 22, y: 14, w: 15, ch: 'B', when: fell },
    { x: 1, y: 29, w: 42, ch: 'Y', when: () => !!flag('mastDusk') },
    { x: 1, y: 30, w: 42, ch: 'Y', when: () => !!flag('mastDusk') },
  ],
  warps: [
    { x: 21, y: 4, to: 'mastgym', tx: 7, ty: 12, dir: 2 },
    { x: 4, y: 6, to: 'stilthouse', tx: 4, ty: 6, dir: 2 },
    { x: 38, y: 6, to: 'boathouse', tx: 4, ty: 6, dir: 2 },
    { x: 43, y: 12, to: 'route2', tx: 1, ty: 12, dir: 1 },
    { x: 43, y: 3, to: 'highwater', tx: 1, ty: 10, dir: 1 },
    { x: 30, y: 0, to: 'route3', tx: 22, ty: 38, dir: 2, when: () => has('mast') && fell() },
    { x: 0, y: 26, to: 'shoreline', tx: 34, ty: 13, dir: 3 },
    { x: 0, y: 3, to: 'saltings', tx: 30, ty: 28, dir: 3, when: () => has('mast') && fell() },
  ],
  tileTalk: { B: 'mastStay', O: 'mastHole', d: 'shutDoor' },
  npcs: [
    { id: 'tanner', x: 13, y: 10, sprite: 'tanner', name: 'Shellwright', talk: 'mastTannery' },
    { id: 'm1', x: 6, y: 10, sprite: 'stilts', name: 'Man on stilts', lines: ['We raised the entire town to keep the tide at bay. The water hasn\'t been in for forty years.', 'It\'s only a matter of time.'] },
    { id: 'm2', x: 30, y: 10, sprite: 'villager', name: 'Woman', lines: () => fell() ? ['Leeward meant west wind. Not the Mast toppling. Not a word.'] : ['Leeward called for a west wind. So, there it is. A west wind.'] },
    { id: 'm3', x: 24, y: 21, sprite: 'child', name: 'Child', wander: true, lines: () => flag('mastDusk') ? ['It\'s drawn a little closer :-( I\'m waving anyway.'] : ['The ocean rolls in every night. I wave, but it hasn\'t waved back yet!'] },
    { id: 'bare', x: 22, y: 12, sprite: 'bare', name: 'Bare', dir: 3, when: () => !!flag('mastSeen') && !flag('mastDug') },
    { id: 'pl1', x: 19, y: 14, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !flag('mastDug') },
    { id: 'pl2', x: 23, y: 15, sprite: 'peeler', name: 'Hermit', dir: 3, when: () => !flag('mastDug') },
    { id: 'pl3', x: 19, y: 16, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !flag('mastDug') },
    { id: 'leewardOut', x: 17, y: 17, sprite: 'leeward', name: 'Leeward', when: fell, lines: ['The forecast is fair. I\'ve chosen to sleep outside, strictly for meteorological reasons.'] },
  ],
  spots: [
    look(21, 30, 'The pier\'s end. Beneath it lies only sand, and beyond that, the gray dusk.'),
    stash('mast_gray', 22, 30, 'Beneath the pier, in the gray, lay a tarred box of whelk horns, waiting to be retrieved.', { pegs: ['brass', 6] }),
  ],
  enter: 'mastEnter',
});
SPAWNS.mast = [21, 19];

defMap({
  id: 'mastgym', name: 'Leeward\'s deck', region: 2, indoor: true, music: 'gym',
  rows: [
    '################',
    '#______________#',
    '#__p______p____#',
    '#______________#',
    '#_eeee____eeee_#',
    '#______________#',
    '#____p____p____#',
    '#______________#',
    '#_eeee____eeee_#',
    '#______________#',
    '#______________#',
    '#______________#',
    '#______________#',
    '#######dd#######',
  ],
  warps: [{ x: 7, y: 13, to: 'mast', tx: 21, ty: 5, dir: 0 }, { x: 8, y: 13, to: 'mast', tx: 21, ty: 5, dir: 0 }],
  npcs: [
    { id: 'leeward', x: 7, y: 1, sprite: 'leeward', name: 'Leeward', talk: 'leeward', when: () => !flag('mastFell') },
    { id: 'deck1', x: 8, y: 9, sprite: 'stilts', name: 'Deckhand', dir: 3, trainer: { name: 'Deckhand', team: [['coma', 6], ['scree', 6]], intro: 'Crests require tide, right? You gain tide from the small moves. That\'s the entire mechanism.', defeat: 'I mastered the small ones! I handled countless small ones!', sight: 4 } },
    { id: 'deck2', x: 7, y: 5, sprite: 'villager2', name: 'Bosun', dir: 0, trainer: { name: 'Bosun', team: [['bore', 6], ['brine', 6], ['eddy', 7]], intro: 'I\'m hoarding all my tide for the finale. Watch closely. Watch.', defeat: '...I held onto it too long.', sight: 3 } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route2Enter', async () => {
  if (!flag('ch2start')) { setFlag('ch2start'); goal('Make the passage from the Dry Sea to the west, reaching the Mast.'); }
});

defScript('tack2', async () => {
  // Tack walks up the corridor to meet Ouro, and walks on west to Mast when it is done.
  await emote('tackds', 'surprise');
  await walkUp('tackds');
  const tries = tackTries('2');
  if (tries) await say('Tack', `Try ${tries + 1}. Still 11 Hermits. I'm still in the road.`);
  else {
    await say('Tack', 'Hey, this is round 2. I counted, and there are 11 Hermits at the Mast.');
    await say('Tack', 'They\'ve already dug 3 holes. Like, huge ones.');
    await say('Tack', 'Leeward\'s 1 keeper and there\'s 11 of them. So I\'m gonna help. After I beat you.');
  }
  const r = await battle({ enemy: [makeMon('tackle', 9), makeMon('hare', 8), makeMon('paring', 8)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival', bossHp: 1.15 });
  music.play('drysea');
  countTack('2', r.result === 'win');
  if (r.result !== 'win') {
    // Tack keeps the road to the Mast until Ouro wins. He goes back to his spot, and Ouro steps back out of the trigger.
    await say('Tack', `${tackWinsLine()} I'm still stuck in the road. You get through when it's 1 more for you.`);
    await Promise.all([walkTo('tackds', 2, 12), walkTo('ouro', 9, 12)]);
    faceToward('tackds', 'ouro');
    return;
  }
  await say('Tack', `${tackLosesLine()} The Hermits are still at 11.`);
  await walkOff('tackds', 0, 12);
  setFlag('tack2');
});

defScript('mastEnter', async () => {
  G.flags.visited_mast = 1;
  if (!flag('mastSeen')) {
    setFlag('mastSeen');
    // The Mast stands in the middle of town with Hermits digging round its foot and Bare's palm flat on the wood.
    await pan(21, 12);
    await act('pl1', 'nod');
    await say('Bare', 'Take it easy. Slow down.');
    await say('Bare', 'Breathe out. Let the Mast lean.');
    await say('Bare', 'Aim for the north side. Leave the south alone.');
    await walkTo('pl3', 19, 17);
    await say('Bare', 'Hey. Step back from the child.');
    await act('pl3', 'back');
    await emote('pl3', 'sweat');
    await say('Bare', 'Keep moving. You\'re doing wonderfully.');
    await panBack();
    goal('Leeward keeps the Mast. Leeward\'s deck is to the north.');
  }
  if (flag('mastFell') && !flag('mastDusk')) await mastDusk();
});

defScript('mastTannery', async () => { await tannery('mast', ['twig', 'brass']); });
defScript('mastStay', async () => {
  await emote('ouro', 'silence');
});
defScript('mastHole', async () => { await emote('ouro', 'question'); });

defScript('leeward', async () => {
  if (has('mast')) { await say('Leeward', 'A northerly blast! It\'s freezing, and possesses a distinctly Spireward temper.'); return; }
  await say('Leeward', 'Wind: Westerly. Light, and dry by noon, I predict.');
  await say('Leeward', 'GREETINGS, late one!! Clear skies overhead. Conditions are favorable for a trial.');
  await say('Leeward', 'Tide rises with every landed strike and successful guard.');
  await say('Leeward', 'After a knockout, a spring tide of great abundance.');
  await say('Leeward', 'Pressure: Plummeting!! A crest approaches. Watch the line at the top.');
  setFlag('nerve');
  await hint('(A crest is a Whorl\'s most powerful move. A crest consumes tide.');
  await hint('Your entire team shares a single tide pool.)');
  await hint('(You gain tide when an Attack connects, when a move strikes your Guard,');
  await hint('and when a Whorl is knocked out.)');
  const r = await fightTrainer({ name: 'Leeward', team: [['squall', 9], ['coma', 9], ['brine', 9], ['bore', 9]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Leeward', 'A profound calm ensues. The Mast pearl is bestowed upon you, beneath clearing skies.');
  giveScale('mast');
  await notice('Ouro receives the Mast pearl.');
  await say('Leeward', 'Gusts of Hermits at the base. Thirteen, by the count.');
  await choose(['Help drive them off', 'Not my Seal']);
  await say('Leeward', 'Wind: Shifting!! The shovels are down. They come from the hermitward quarter!!');
  const r2 = await fightTrainer({ name: 'Hermit', team: [['scree', 7], ['eddy', 7]], intro: '', defeat: '' });
  if (r2.result !== 'win') return;
  field.warp('mast', 21, 18, 2);
  await wait(20);
  await say('Bare', 'Spades down, everyone.');
  await say('Bare', 'Alright. Step away from the Mast.');
  await say('Bare', 'We\'ll return when it\'s dark.');
  // The Hermits walk off east along the boardwalk toward the Dry Sea, and Bare goes last without looking at Ouro.
  const later = (n: number, go: () => Promise<void>) => (async () => { await wait(n); await go(); })();
  await Promise.all([
    later(0, () => walkOff('pl1', 35, 8)), later(8, () => walkOff('pl2', 36, 8)), later(16, () => walkOff('pl3', 37, 8)),
    later(60, () => walkOff('bare', 38, 8)),
  ]);
  setFlag('mastDug');
  // Night falls. The Mast creaks, comes loose, and falls east across the boardwalks.
  await tint('#0b0a10', 0.5, 50);
  evening(true);
  await tint('#0b0a10', 0, 30);
  await pan(24, 12);
  sound('bump');
  field.shakeT = 6;
  await wait(30);
  await stayComesLoose('mast', false);
  offstage('leewardOut');
  await morphTo('mastFell', 21, 10);
  // Leeward comes out of the deck with a blanket and lies down on the sand by the fallen Mast.
  await walkIn('leewardOut', 21, 5, 21, 7);
  await act('leewardOut', 'look');
  await say('Leeward', 'A storm! Right inside the house! How utterly irregular!');
  await walkTo('leewardOut', 17, 17);
  await panBack();
  faceToward('leewardOut', 'ouro');
  await say('Leeward', 'Clear skies tonight, outside! Such an open-air, delightful evening!');
  await mastDusk();
});

async function mastDusk(): Promise<void> {
  // Dusk. The gray wall of the sea's old shell stands at the old shore, nearer than last night.
  evening(true);
  await pan(21, 26);
  sfx('wind');
  await morphTo('mastDusk', 21, 29, 1);
  await wait(30);
  await panBack();
  evening(false);
  goal('Head north from the Mast, cross the salt marsh, and reach the Spire.');
}
