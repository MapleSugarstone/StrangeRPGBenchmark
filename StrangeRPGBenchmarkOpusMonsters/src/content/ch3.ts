import { defMap, defScript, SPAWNS } from '../game/world';
import { stash } from './areakit';
import { giveKeyItem } from './ring';
import { G, flag, setFlag } from '../game/state';
import { battle } from '../game/battleView';
import { act, bell, emote, face, faceToward, field, fightTrainer, giveScale, goal, hint, morphTo, moveNpc, narr, notice, npcAt, offstage, pan, panBack, say, tannery, wait, walkIn, walkOff } from '../game/api';
import { fitterMenu } from '../game/fitter';
import { music } from '../engine/music';
import { makeMon } from '../data/species';
import { sfx } from '../engine/audio';
import { PEOPLE } from '../engine/sprites';
import { fitted } from '../game/wildfit';

const has = (s: string) => G.scales.includes(s);

/** Tack's conjoined whorl. Its look is drawn by hand in src/engine/sprites.ts rather than conjoined, so the review page can redraw it. */
export function brack(level: number) {
  const m = fitted('tackle', 'brine', level, ['shove', 'pickle', 'rush', 'evaporate'], ['tally', 'salt'], 'Brack', 1, 2);
  if (PEOPLE.brack) m.sprite = PEOPLE.brack;
  return m;
}

defMap({
  id: 'route3', name: 'The salt marsh', region: 3, music: 'marsh',
  rows: [
    '####################=#######################',
    '#,,,,,,,,,,,,,,,,,,,=,,,,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,=,,...,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,=,.....,,,,,,,,,,,,,,,,#',
    '#,,,,,,~~~,,,,,,,,,,=.......,,,,,,,,,,,,,,,#',
    '#,,,~~~~~~~~~,,,,,,,=,.....,,,,,,,,,,,,,,,,#',
    '#,,~~~~~~~~~~~,,,,,,=,,...,,,,,,,~~~,,,,,,,#',
    '#,,~~~~...~~~~,,,,,,=,,,,,,,,,~~~~~~~~~,,,,#',
    '#,~~~~....:::::::::,=,,,,,,,~~~~~~~~~~~~~,,#',
    '#,,~~~~...~~~~,,,,,,========~~~~~~~...~~~,,#',
    '#,,~~~~~~~~~~~,,,,.,,,,,,::=::::::.....~~~,#',
    '#,,,~~~~~~~~~,,,,...,,,,,,,=~~~~~~~...~~~,,#',
    '#,,,,,,~~~,,,,,,.....,,,,,,=~~~~~~~~~~~~~,,#',
    '#,,,,,,,,,,,,,,,.....,,,,,,=,,~~~~~~~~~,,,,#',
    '#,,,,,,,,,,,,,,,.....~~~,,,=,,,,,~~~,,,,,,,#',
    '#,,,,,,,,,,,,,,,,...~~~~~~,=,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,.~~~~~~~~=,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,~~~~~~~,=,,,,,,,,,,,,,,,#',
    '#:::::,,,,,,,,,,,,,,,~~~,,,=,,,,,,,,,,,,,,,#',
    '#:::::,,,,,,,,,,,,,,,,,,,,,=,,,,,,,,,,,,,,,#',
    ':s::::..........============,,,,,,,,,,,,,,,#',
    '#:::::~~~~~~~~~,=,,,,,,,,,,,,,,,,,,,,,,,,,,#',
    '#:::::~~~~~~~~~~=,,,,,,,,,,,,,,,,,,,,,,,,,,#',
    '#,,,~~~~~~~~~~~~=,,,,,,,,,,,,,,,,~,,,,,,,,,#',
    '#,,~~~~~...~~~~~=~,,,,,,,,,,,~~~~~~~~~,,,,,#',
    '#,,,~~~....:::::=::,,,,,,,,,~~~~~~~~~~~,,,,#',
    '#,,,~~~~...~~~~~=,,,,,,,,,,~~~~~~~~~~~~~,,,#',
    '#,,,,,~~~~~~~~~,=,,,,,,,,,,~~~~~~~~~~~~~,,,#',
    '#,,,,,,,,~~~,,,,=,,,,,,,,,~~~~~~~~~~~~~~~,,#',
    '#,,,,,,,,,,,,,,,=,,,,,,,,,,~~~~~~~~~~~~~,,,#',
    '#,,,,,,,,,,,,,,,=======,,,,~~~~~~~~~~~~~,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,=,,,,,~~~~~~~~~~~,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,...,,,,,~~~~~~~~~,,,,,#',
    '#,,,,,,,,,,,,,,,,,,.......,,,,,,,~,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,.........,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,.......,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,...,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,=,,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,=,,,,,,,,,,,,,,,,,,,,#',
    '######################=#####################',
  ],
  warps: [
    { x: 22, y: 39, to: 'mast', tx: 30, ty: 1, dir: 0 },
    { x: 20, y: 0, to: 'spire', tx: 20, ty: 30, dir: 2 },
    { x: 0, y: 20, to: 'saltings', tx: 38, ty: 15, dir: 3 },
  ],
  zone: { kinds: [['fogbank', 3], ['undertow', 3], ['leech', 2], ['mycel', 2], ['grotesque', 2], ['siren', 2], ['brine', 1]], lv: [14, 18], n: 16, area: 'marsh' },
  npcs: [
    { id: 'reeve', x: 17, y: 26, sprite: 'villager2', name: 'Reeve', dir: 3, trainer: { name: 'Reeve', team: [['fogbank', 16], ['undertow', 16]], intro: 'Each morning I conduct the Official Measurement of the marsh, and it is a whole foot bigger!!', defeat: 'Two foot.', sight: 4 } },
    { id: 'eelboy', x: 26, y: 14, sprite: 'boy', name: 'Eel boy', dir: 1, trainer: { name: 'Eel boy', team: [['leech', 16], ['mycel', 16], ['siren', 17]], intro: 'Found a leech cast! That\'s good luck. A leech is the other kind.', defeat: 'Oh. Bad luck for you, then.', sight: 4 } },
    { id: 'cutter', x: 21, y: 6, sprite: 'tanner', name: 'Cutter', dir: 3, trainer: { name: 'Cutter', team: [['grotesque', 17], ['brine', 16]], intro: 'I cut reeds for Spire. They stuff \'em in the bells so the bells shut up.', defeat: 'Yeah, mine are quiet now.', sight: 3 } },
  ],
  spots: [
    stash('rm_islet1', 8, 8, 'On a reed islet, in a heron\'s old nest, a cake of salt wrapped in a leaf.', { items: [['saltcake', 2]] }),
    stash('rm_islet2', 36, 10, 'On the far islet, a heap of drift with nacre caught in it.', { tan: 2, items: [['beachglass', 1]] }),
    stash('rm_islet3', 8, 25, 'On the west islet, a reed plug cut for a bell, and never used.', { notion: 'reedplug' }),
  ],
  enter: 'route3Enter',
});

defMap({
  id: 'spire', name: 'Spire', region: 3, music: 'spire', oldShells: true,
  rows: [
    '####################=###################',
    '#...................=..................#',
    '#...................=..................#',
    '===rrrrrrrrr........=..................#',
    '#.=rrrrrrrrr........=.......rrrrr......#',
    '#.=rrrrrrrrr........=.......rrrrr......#',
    '#.=hhhhdhhhh........=.......hhqhh......#',
    '#.=....=............=.........=........#',
    '#.=....=............=.........=........#',
    '#.=....========================........#',
    '#.=============...........=............#',
    '#.............=...........=............#',
    '#.............=...BBBBB...=......rrrrr.#',
    '#..rrrrr......=....BBB....=......rrrrr.#',
    '#..rrrrr......=.....B.....=......hhdhh.#',
    '#..hhhhh......=...........=............#',
    '#.............=...........=.......rrr..#',
    '#.......ccc...=...........=.......rrr..#',
    '#.............=============.......hhh..#',
    '#...................=..................#',
    '#...................=..................#',
    '#...................=..................#',
    '========================================',
    '#...................=..................#',
    '#...rrrrr.rrr.......=.......rrrrrr.....#',
    '#...rrrrr.rrr.......=.......rrrrrr.....#',
    '#...hhdhh.hhh..,....=,....,.hhdhhh.....#',
    '#...,.........,,....=,........,...,....#',
    '#,................,.=,.................#',
    '#....,............,.=...,....,.,,,,....#',
    '#......,........,...=,,............,...#',
    '####################=###################',
  ],
  tileTalk: { B: 'spireStay', d: 'shutDoor' },
  warps: [
    { x: 20, y: 31, to: 'route3', tx: 20, ty: 1, dir: 0 },
    { x: 7, y: 6, to: 'spiregym', tx: 7, ty: 14, dir: 2 },
    { x: 30, y: 6, to: 'spirecrypt', tx: 3, ty: 6, dir: 2 },
    { x: 30, y: 26, to: 'ledgerroom', tx: 4, ty: 6, dir: 2 },
    { x: 0, y: 22, to: 'saltings', tx: 30, ty: 1, dir: 3 },
    { x: 39, y: 22, to: 'shoutwood', tx: 1, ty: 20, dir: 1 },
    { x: 20, y: 0, to: 'route4', tx: 20, ty: 38, dir: 2, when: () => has('spire') },
    { x: 0, y: 3, to: 'kelpbeds', tx: 30, ty: 28, dir: 3, when: () => has('spire') },
  ],
  npcs: [
    { id: 'tanner', x: 9, y: 16, sprite: 'tanner', name: 'Shellwright', talk: 'spireTannery' },
    { id: 's1', x: 17, y: 20, sprite: 'ringer', name: 'Woman', lines: ['Don\'t shout. They ring if you shout, and then the Verger gets involved.'] },
    { id: 's2', x: 4, y: 17, sprite: 'villager2', name: 'Man', lines: ['Grandad turned in the nave and his cast\'s been in there singing the same song for sixty years.'] },
    { id: 's3', x: 24, y: 28, sprite: 'child', name: 'Child', wander: true, lines: ['I tried to make them ring on purpose and it doesn\'t work on purpose! It\'s so unfair.'] },
    { id: 's4', x: 28, y: 8, sprite: 'oldwoman', name: 'Old woman', lines: ['Conjoiner\'s down the crypt steps, dear. Mind your head. The crypt\'s on the ceiling.'] },
    { id: 'tackspire', x: 6, y: 8, sprite: 'tack', name: 'Tack', dir: 1, when: () => has('mast') && !flag('tack3') && !flag('tackGone3') },
    { id: 'brackspire', x: 30, y: 6, sprite: 'tack', img: () => brack(1).sprite, name: 'Brack', when: () => !!flag('brackOut') && !flag('tack3') },
    { id: 'sguard', blocks: true, x: 21, y: 1, dir: 3, sprite: 'ringer', name: 'Ringer', when: () => !has('spire'), lines: ['bole road\'s closed if you don\'t have the spire pearl. verger\'s rule. not mine.'] },
  ],
  triggers: [{ x: 3, y: 7, w: 5, h: 2, script: 'tack3', when: () => has('mast') && !flag('tack3') }],
  enter: 'spireEnter',
});
SPAWNS.spire = [20, 20];

defMap({
  id: 'spirecrypt', name: 'The crypt', region: 3, indoor: true, music: 'home',
  rows: [
    '##########',
    '#________#',
    '#________#',
    '#__p__p__#',
    '#________#',
    '#________#',
    '#________#',
    '###q######',
  ],
  warps: [{ x: 3, y: 7, to: 'spire', tx: 30, ty: 7, dir: 0 }],
  npcs: [{ id: 'fitter', x: 4, y: 2, sprite: 'fitter', name: 'Conjoiner', talk: 'fitter' }],
});

defMap({
  id: 'spiregym', name: 'The nave', region: 3, indoor: true, music: 'gym',
  rows: [
    '################',
    '#______________#',
    '#__p________p__#',
    '#______________#',
    '#__p________p__#',
    '#______________#',
    '#mmmmmmmmmmmmmm#',
    '#______________#',
    '#_K____________#',
    '#______________#',
    '#_K____________#',
    '#______________#',
    '#_K____________#',
    '#______________#',
    '#______________#',
    '#######dd#######',
  ],
  mods: [{ x: 1, y: 6, w: 14, ch: '_', when: () => !!flag('spireGate') }],
  warps: [{ x: 7, y: 15, to: 'spire', tx: 7, ty: 7, dir: 0 }, { x: 8, y: 15, to: 'spire', tx: 7, ty: 7, dir: 0 }],
  tileTalk: { K: 'bellRope' },
  npcs: [
    { id: 'verger', x: 7, y: 1, sprite: 'verger', name: 'Verger', talk: 'verger' },
    { id: 'ring1', x: 10, y: 9, sprite: 'ringer', name: 'Ringer', dir: 3, trainer: { name: 'Ringer', team: [['siren', 18], ['grotesque', 18]], intro: 'hear that? yeah that\'s a wind-up. stop it or eat it.', defeat: 'huh. i didn\'t stop it.', sight: 4 } },
    { id: 'ring2', x: 12, y: 12, sprite: 'ringer', name: 'Ringer', dir: 2, trainer: { name: 'Ringer', team: [['flare', 18], ['fogbank', 18], ['mycel', 19]], intro: 'some big ones can\'t be stopped though. the line on top tells you which.', defeat: 'the line did tell me. i just didn\'t read it.', sight: 3 } },
    { id: 'note', x: 13, y: 13, sprite: 'sign', name: null as any, lines: ['A card pinned to the pew: "top. bottom. middle. softly." Under it, in other ink: "SOFTER"'] },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route3Enter', async () => {
  if (!flag('ch3start')) { setFlag('ch3start'); goal('Follow the boardwalk north to Spire.'); }
});

defScript('spireEnter', async () => {
  G.flags.visited_spire = 1;
  if (!flag('spireSeen')) {
    setFlag('spireSeen');
    // A church driven into the ground point-first, its tower underground. Bells ring under the town.
    await pan(20, 12);
    bell(0);
    await wait(30);
    bell(7);
    await emote('ouro', 'music');
    await panBack();
  }
});

defScript('spireStay', async () => { await emote('ouro', 'silence'); });

defScript('spireTannery', async () => { setFlag('fitter_spire'); await tannery('spire', ['twig', 'brass']); });

defScript('fitter', async () => {
  if (!flag('fitting')) {
    await say('Conjoiner', 'So. Two whorls. You put one in the other, they kinda settle, and then one comes out.');
    await say('Conjoiner', 'You get to pick what it keeps. Four moves, two habits, its look, its name. Go nuts.');
    await say('Conjoiner', 'People ask if it comes apart. It doesn\'t. Then they ask again. Still doesn\'t.');
    await say('Conjoiner', 'And a person\'s second cast won\'t join with anything. I\'ve tried. It won\'t take.');
    await say('Conjoiner', 'Ten cowries a level.');
    setFlag('fitting');
    setFlag('fitter_spire');
    await hint('(Conjoining cannot be undone. You pick what the new whorl keeps. Every grotto now has a Conjoiner.)');
  }
  await fitterMenu();
});

defScript('tack3', async () => {
  faceToward('tackspire', 'ouro');
  await say('Tack', '3rd time. I\'ve got 2 pearls, you\'ve got 2. Even. I hate even.');
  await say('Tack', 'Hang on. 1 minute.');
  // Tack walks across town and down the crypt steps, and comes back up with Brack beside him.
  await walkOff('tackspire', 30, 6);
  setFlag('tackGone3');
  await wait(40);
  sfx('fit');
  await wait(30);
  setFlag('tackGone3', 0);
  offstage('tackspire', 'brackspire');
  setFlag('brackOut');
  await Promise.all([walkIn('tackspire', 30, 6), (async () => { await wait(12); await walkIn('brackspire', 30, 6, 6, 9); })()]);
  faceToward('tackspire', 'ouro');
  faceToward('brackspire', 'ouro');
  await say('Tack', 'It\'s fine. It\'s Brack now. 2 of Tackle\'s moves, 2 of a salt pan\'s.');
  const r = await battle({ enemy: [brack(18), makeMon('hare', 17), makeMon('paring', 17), makeMon('eddy', 17)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival' });
  music.play('spire');
  if (r.result === 'win') {
    G.flags.tackWins = (G.flags.tackWins || 0) + 1;
    await say('Tack', `${G.flags.tackWins} loss${G.flags.tackWins === 1 ? '' : 'es'}.`);
    await act('tackspire', 'nod');
    faceToward('brackspire', 'tackspire');
    await say('Tack', 'Still even. 2 pearls each. Ugh.');
  } else {
    await say('Tack', '2 to 1.');
    faceToward('brackspire', 'tackspire');
    await emote('brackspire', 'question');
  }
  // Tack and Brack walk off round the church and out of the south gate.
  await Promise.all([walkOff('tackspire', 16, 24), (async () => { await wait(10); await walkOff('brackspire', 16, 24); })()]);
  setFlag('tack3');
  bell(-5);
  await emote('ouro', 'music');
});

const ROPE_ORDER = [8, 12, 10];
defScript('bellRope', async () => {
  if (flag('spireGate')) { await emote('ouro', 'silence'); return; }
  const [, y] = field.facing();
  sfx('ok');
  const step = flag('bellStep');
  // The three ropes ring a high, a middle, and a low bell far down.
  bell(y === 8 ? 12 : y === 10 ? 7 : 0);
  await emote('ouro', 'music');
  if (ROPE_ORDER[step] === y) {
    setFlag('bellStep', step + 1);
    if (step + 1 === 3) {
      sfx('fit');
      await morphTo('spireGate', 7, 6);
    }
  } else {
    setFlag('bellStep', 0);
    bell(1); bell(6);
    await wait(20);
    await emote('ouro', 'sweat');
  }
});

defScript('verger', async () => {
  if (has('spire')) { await say('Verger', 'the bole lies north, through the understory. half a day\'s perambulation. eleven bells.'); return; }
  await say('Verger', 'you belled two late. that is entirely forgivable');
  await say('Verger', 'when someone above speaks too loudly the bells ring, and i enter them in my ledger of loudnesses.');
  await say('Verger', 'in a fight, a wind-up is a bell you can hear coming. stop it, or get out from under it.');
  await hint('(A ! over a whorl is a wind-up. Stun, Silence, Sleep, Taunt, or forcing it out cuts it off.)');
  const r = await fightTrainer({ name: 'Verger', team: [['grotesque', 19], ['siren', 19], ['fogbank', 20], ['flare', 20]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Verger', 'it belled three!! the spire pearl is most rightfully yours');
  giveScale('spire');
  await notice('Ouro gets the Spire pearl.');
  if (flag('tack3')) await say('Verger', 'the bell for your friend was the wind.');
  await say('Verger', 'take this jingle. it belled for the old ones asleep across the roads, and wakes them still');
  await giveKeyItem('jingle', 'Ouro gets the jingle.');
  await say('Verger', 'north to the bole, through the understory. half a day. eleven bells, should you not dawdle.');
  goal('Go north from Spire through the understory to the Bole.');
});
