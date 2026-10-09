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
  zone: { kinds: [['scree', 3], ['brine', 3], ['bore', 2], ['carrion', 2], ['coma', 1], ['eddy', 2], ['paring', 1]], lv: [8, 12], n: 14, area: 'sand' },
  npcs: [
    { id: 'salter', x: 16, y: 11, sprite: 'tanner', name: 'Salter', dir: 0, trainer: { name: 'Salter', team: [['brine', 10], ['scree', 10]], intro: 'Sea\'s been gone forty years and I still salt the fish. They\'re already dry. I just like doing it.', defeat: 'Fine. I\'ll go salt a rock.', sight: 3 } },
    { id: 'wrecker', x: 27, y: 14, sprite: 'villager2', name: 'Wrecker', dir: 2, trainer: { name: 'Wrecker', team: [['bore', 11], ['carrion', 10]], intro: 'I live in a boat on the sand. Love it. Never sunk once.', defeat: 'Gonna go sit in my boat now.', sight: 3 } },
    { id: 'shellgirl', x: 40, y: 13, sprite: 'child', name: 'Shell girl', dir: 3, trainer: { name: 'Shell girl', team: [['paring', 10], ['eddy', 11]], intro: 'Every shell out here used to have someone in it. The pink one\'s mine. I called it, okay?', defeat: 'Don\'t step on it.', sight: 4 } },
    { id: 'fisher', x: 20, y: 28, sprite: 'elder', name: 'Old fisher', lines: ['That gray\'s the sea\'s old shell. Every dusk it comes back and stands there, staring at my house.', 'Never comes in. If I were younger I\'d walk out there and have a word with it.'] },
    { id: 'tackds', x: 2, y: 12, sprite: 'tack', name: 'Tack', dir: 1, when: () => !flag('tack2') },
    { id: 'dssleeper', x: 48, y: 24, sprite: 'stone', mon: 'scree', name: 'Jarira', sleeper: { kind: 'scree', lv: 22, flag: 'sl_drysea' } },
    standingWild('grayrare', 42, 30, 'fata', 30),
  ],
  spots: [
    stash('ds_reef', 48, 22, 'Inside the reef ring, where the sleeper lay across the gap, a pepper kelp, still green.', { notions: [['pepperkelp', 1]] }),
    stash('ds_gray', 41, 31, 'In the bay\'s last pool, inside the gray, a gray lump that smells of the sea.', { items: [['ambergris', 1]] }),
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
    { id: 'm1', x: 6, y: 10, sprite: 'stilts', name: 'Man on stilts', lines: ['We built the whole town up for the tide. The tide\'s out forty years. Any day now.'] },
    { id: 'm2', x: 30, y: 10, sprite: 'villager', name: 'Woman', lines: () => fell() ? ['Leeward said wind from the west. Nothing about the Mast falling over. Not one word.'] : ['Leeward says wind from the west, so. Wind from the west.'] },
    { id: 'm3', x: 24, y: 21, sprite: 'child', name: 'Child', wander: true, lines: () => flag('mastDusk') ? ['It came a bit nearer :-( I\'m still gonna wave though.'] : ['The sea comes every night and I wave and it doesn\'t wave back yet!'] },
    { id: 'bare', x: 22, y: 12, sprite: 'bare', name: 'Bare', dir: 3, when: () => !!flag('mastSeen') && !flag('mastDug') },
    { id: 'pl1', x: 19, y: 14, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !flag('mastDug') },
    { id: 'pl2', x: 23, y: 15, sprite: 'peeler', name: 'Hermit', dir: 3, when: () => !flag('mastDug') },
    { id: 'pl3', x: 19, y: 16, sprite: 'peeler', name: 'Hermit', dir: 1, when: () => !flag('mastDug') },
    { id: 'leewardOut', x: 17, y: 17, sprite: 'leeward', name: 'Leeward', when: fell, lines: ['Outlook: Fair. I shall be sleeping outdoors, by meteorological preference.'] },
  ],
  spots: [
    look(21, 30, 'The end of the pier. Below it there is only sand, and past the sand, the gray at dusk.'),
    stash('mast_gray', 22, 30, 'Under the pier\'s end, inside the gray, a tarred box of whelk horns someone meant to come back for.', { pegs: ['brass', 6] }),
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
    { id: 'deck1', x: 8, y: 9, sprite: 'stilts', name: 'Deckhand', dir: 3, trainer: { name: 'Deckhand', team: [['coma', 12], ['scree', 12]], intro: 'Crests cost tide, right? You get tide from the small moves. That\'s the whole thing.', defeat: 'I did the small ones! I did so many!', sight: 4 } },
    { id: 'deck2', x: 7, y: 5, sprite: 'villager2', name: 'Bosun', dir: 0, trainer: { name: 'Bosun', team: [['bore', 12], ['brine', 12], ['eddy', 13]], intro: 'I\'m saving all my tide for the end. Watch this. Watch.', defeat: '...Saved it too long.', sight: 3 } },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route2Enter', async () => {
  if (!flag('ch2start')) { setFlag('ch2start'); goal('Cross the Dry Sea west to Mast.'); }
});

defScript('tack2', async () => {
  // Tack walks up the corridor to meet Ouro, and walks on west to Mast when it is done.
  await emote('tackds', 'surprise');
  await walkUp('tackds');
  await say('Tack', 'Hey, 2nd time. There\'s 11 Hermits at the Mast, I counted.');
  await say('Tack', 'They\'ve dug 3 holes already. Like, big holes.');
  await say('Tack', 'Leeward\'s 1 keeper and there\'s 11 of them. So I\'m gonna help. After I beat you.');
  const r = await battle({ enemy: [makeMon('tackle', 17), makeMon('hare', 16), makeMon('paring', 16)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival', bossHp: 1.15 });
  music.play('drysea');
  if (r.result !== 'win') {
    // Tack keeps the road to the Mast until Ouro wins. He goes back to his spot, and Ouro steps back out of the trigger.
    await say('Tack', '1 more for me. And I\'m still in the road. You don\'t get by till it\'s 1 for you.');
    await Promise.all([walkTo('tackds', 2, 12), walkTo('ouro', 9, 12)]);
    faceToward('tackds', 'ouro');
    return;
  }
  G.flags.tackWins = (G.flags.tackWins || 0) + 1;
  await say('Tack', `${2 - (G.flags.tackWins || 0)} wins for me. ${G.flags.tackWins} for you. 11 Hermits still.`);
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
    await say('Bare', 'Easy. Easy now.');
    await say('Bare', 'Breathe out. Let it lean.');
    await say('Bare', 'North side, okay? Leave the south alone.');
    await walkTo('pl3', 19, 17);
    await say('Bare', 'Hey. Back up from the kid.');
    await act('pl3', 'back');
    await emote('pl3', 'sweat');
    await say('Bare', 'Keep going. You\'re doing great.');
    await panBack();
    goal('Leeward keeps the Mast. Leeward\'s deck is north.');
  }
  if (flag('mastFell') && !flag('mastDusk')) await mastDusk();
});

defScript('mastTannery', async () => { await tannery('mast', ['twig', 'brass']); });
defScript('mastStay', async () => {
  await emote('ouro', 'silence');
});
defScript('mastHole', async () => { await emote('ouro', 'question'); });

defScript('leeward', async () => {
  if (has('mast')) { await say('Leeward', 'A northerly!! Cold, and most Spireward in its disposition.'); return; }
  await say('Leeward', 'Wind: Westerly. Light, and dry by noon, I prognosticate.');
  await say('Leeward', 'GREETINGS, late one!! Clear skies above you. Conditions are fair for a test.');
  await say('Leeward', 'Tide rises with each landed hit and each good guard. After a knockout, a spring tide, most copious.');
  await say('Leeward', 'Pressure: Plummeting!! A crest cometh. Watch the line on top.');
  setFlag('nerve');
  await hint('(A crest is a whorl\'s biggest move. A crest costs tide. Your whole team shares one pool of tide.)');
  await hint('(You get tide when an Attack lands, when a move hits your Guard, and when a whorl is knocked out.)');
  const r = await fightTrainer({ name: 'Leeward', team: [['squall', 17], ['coma', 17], ['brine', 17], ['bore', 18]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Leeward', 'A great calm follows. The Mast pearl is bestowed upon you, under clearing skies.');
  giveScale('mast');
  await notice('Ouro gets the Mast pearl.');
  await say('Leeward', 'Gusts of Hermits at the foot. Thirteen, by the sound.');
  await choose(['Help drive them', 'Not my Stay']);
  await say('Leeward', 'Wind: Turning!! Shovels down. Here they come, from the hermitward quarter!!');
  const r2 = await fightTrainer({ name: 'Hermit', team: [['scree', 14], ['eddy', 14]], intro: '', defeat: '' });
  if (r2.result !== 'win') return;
  field.warp('mast', 21, 18, 2);
  await wait(20);
  await say('Bare', 'Spades down, everyone.');
  await say('Bare', 'Okay. Walk away from the Mast.');
  await say('Bare', 'We\'ll come back when it\'s dark.');
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
  await say('Leeward', 'A storm!! Inside the house!! Most irregular!!');
  await walkTo('leewardOut', 17, 17);
  await panBack();
  faceToward('leewardOut', 'ouro');
  await say('Leeward', 'Fair tonight, outdoors!! A most unroofed and agreeable evening!!');
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
  goal('Go north from Mast, across the salt marsh, to Spire.');
}
