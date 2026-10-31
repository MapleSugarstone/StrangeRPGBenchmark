import { defMap, defScript, SPAWNS } from '../game/world';
import { stash } from './areakit';
import { giveKeyItem } from './ring';
import { G, flag, setFlag } from '../game/state';
import { battle } from '../game/battleView';
import { act, bell, emote, face, faceToward, field, fightTrainer, giveScale, goal, hint, morphTo, moveNpc, narr, notice, npcAt, offstage, pan, panBack, say, tannery, wait, walkIn, walkOff, walkTo } from '../game/api';
import { fitterMenu } from '../game/fitter';
import { music } from '../engine/music';
import { makeMon } from '../data/species';
import { sfx } from '../engine/audio';
import { PEOPLE } from '../engine/sprites';
import { fitted } from '../game/wildfit';
import { countTack, tackLosesLine, tackTries, tackWinsLine } from './tack';

const has = (s: string) => G.scales.includes(s);

/** Tack's conjoined whorl. Its look is drawn by hand in src/engine/sprites.ts rather than conjoined, so the review page can redraw it. */
export function brack(level: number) {
  const m = fitted('tackle', 'brine', level, ['shove', 'pickle', 'rush', 'evaporate'], ['tally', 'salt'], 'Brack', 1, 2);
  if (PEOPLE.brack) { m.sprite = PEOPLE.brack; m.art = 'brack'; }
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
  zone: { kinds: [['fogbank', 3], ['undertow', 3], ['leech', 2], ['mycel', 2], ['grotesque', 2], ['siren', 2], ['brine', 1]], lv: [7, 9], n: 16, area: 'marsh' },
  npcs: [
    { id: 'reeve', x: 17, y: 26, sprite: 'villager2', name: 'Reeve', dir: 3, trainer: { nacre: 1, name: 'Reeve', team: [['fogbank', 8], ['undertow', 8]], intro: 'Every morning I perform the Official Measurement of the marsh, and it\'s grown by a full foot!', defeat: 'Two foot.', sight: 4 } },
    { id: 'eelboy', x: 26, y: 14, sprite: 'boy', name: 'Eel boy', dir: 1, trainer: { name: 'Eel boy', team: [['leech', 8], ['mycel', 8], ['siren', 9]], intro: 'I found a leech cast! That\'s a sign of good luck. A live leech is the other sort.', defeat: 'Oh. Then it\'s bad luck for you.', sight: 4 } },
    { id: 'cutter', x: 21, y: 6, sprite: 'tanner', name: 'Cutter', dir: 3, trainer: { name: 'Cutter', team: [['grotesque', 9], ['brine', 8]], intro: 'I trim reeds for the Spire. They pack them into the bells to muffle the sound.', defeat: 'Yes, mine are silent now.', sight: 3 } },
  ],
  spots: [
    stash('rm_islet1', 8, 8, 'On a reed-covered islet, within an abandoned heron\'s nest, lies a block of salt wrapped in a leaf.', { items: [['saltcake', 2]] }),
    stash('rm_islet2', 36, 10, 'On the distant islet, a pile of driftwood with nacre caught in it.', { tan: 2, items: [['beachglass', 1]] }),
    stash('rm_islet3', 8, 25, 'On the west islet, a reed plug trimmed for a bell, left unused.', { notion: 'reedplug' }),
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
    { id: 's1', x: 17, y: 20, sprite: 'ringer', name: 'Woman', lines: ['Keep your voice down. If you shout, they ring, and then the Verger gets involved.'] },
    { id: 's2', x: 4, y: 17, sprite: 'villager2', name: 'Man', lines: ['Grandad shed in the nave, and his cast has been in there singing the same song for sixty years.'] },
    { id: 's3', x: 24, y: 28, sprite: 'child', name: 'Child', wander: true, lines: ['I tried to make them ring on purpose, but it won\'t work if I try! It\'s so unfair.'] },
    { id: 's4', x: 28, y: 8, sprite: 'oldwoman', name: 'Old woman', lines: ['The Conjoiner is down the crypt steps, dear. Mind your head. The crypt is actually on the ceiling.'] },
    { id: 'tackspire', x: 6, y: 8, sprite: 'tack', name: 'Tack', dir: 1, when: () => has('mast') && !flag('tack3') && !flag('tackGone3') },
    { id: 'brackspire', x: 30, y: 6, sprite: 'tack', img: () => brack(1).sprite, name: 'Brack', when: () => !!flag('brackOut') && !flag('tack3') },
    { id: 'sguard', blocks: true, x: 21, y: 1, dir: 3, sprite: 'ringer', name: 'Ringer', when: () => !has('spire'), lines: ['you can\'t use the bole road without the spire pearl. it\'s the verger\'s rule, not mine.'] },
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
    { id: 'ring1', x: 10, y: 9, sprite: 'ringer', name: 'Ringer', dir: 3, trainer: { nacre: 1, name: 'Ringer', team: [['siren', 9], ['grotesque', 9]], intro: 'hear that? yeah, that\'s a wind-up. stop it or take it.', defeat: 'huh. i guess i didn\'t.', sight: 4 } },
    { id: 'ring2', x: 12, y: 12, sprite: 'ringer', name: 'Ringer', dir: 2, trainer: { name: 'Ringer', team: [['flare', 9], ['fogbank', 9], ['mycel', 10]], intro: 'some big ones can\'t be stopped, though. the line at the top tells you which ones they are.', defeat: 'it did tell me. i just ignored it.', sight: 3 } },
    { id: 'note', x: 13, y: 13, sprite: 'sign', name: null as any, lines: ['A card pinned to the pew reads: "Top. Bottom. Middle. Softly." Beneath it, in different ink: "SOFTER'] },
  ],
});

// ---------------------------------------------------------------- scripts

defScript('route3Enter', async () => {
  if (!flag('ch3start')) { setFlag('ch3start'); goal('Head north along the boardwalk to reach Spire.'); }
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
    await say('Conjoiner', 'So. Two whorls. You nestle one inside the other, they settle in, and then one emerges.');
    await say('Conjoiner', 'You get to choose what it retains. Four moves, two habits, its appearance, its name. Have at it.');
    await say('Conjoiner', 'People ask if it comes apart. It doesn\'t. Then they ask again. Still doesn\'t.');
    await say('Conjoiner', 'A person\'s second cast won\'t join with anything. I\'ve tried. It won\'t stick.');
    await say('Conjoiner', 'Ten cowries per level.');
    setFlag('fitting');
    setFlag('fitter_spire');
    await hint('(Conjoining is permanent. You decide what the new whorl keeps. Every grotto now has a Conjoiner.)');
  }
  await fitterMenu();
});

defScript('tack3', async () => {
  faceToward('tackspire', 'ouro');
  // A rematch skips the walk to the crypt: Brack is already out.
  if (flag('brackOut')) {
    faceToward('brackspire', 'ouro');
    await say('Tack', `Try ${tackTries('3') + 1}. Brack is ready. That makes 1 of us.`);
    await tack3Battle();
    return;
  }
  await say('Tack', 'this is the 3rd try. I have 2 pearls, and you have 2. it\'s tied. I despise ties.');
  await say('Tack', 'Hold on. 1 minute.');
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
  await say('Tack', 'It\'s all right. It\'s Brack now. 2 moves from Tackle, 2 from a salt pan.');
  await tack3Battle();
});

/** Tack and Brack fight until Ouro wins. After a loss they stay by the crypt steps, and Ouro steps back out of the trigger. */
async function tack3Battle(): Promise<void> {
  const r = await battle({ enemy: [brack(9), makeMon('hare', 9), makeMon('paring', 9), makeMon('eddy', 9)], name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival' });
  music.play('spire');
  countTack('3', r.result === 'win');
  if (r.result !== 'win') {
    await say('Tack', `${tackWinsLine()} I'm staying put. 1 more, anytime.`);
    faceToward('brackspire', 'tackspire');
    await emote('brackspire', 'question');
    await walkTo('ouro', 4, 10);
    faceToward('tackspire', 'ouro');
    faceToward('brackspire', 'ouro');
    return;
  }
  await say('Tack', tackLosesLine());
  await act('tackspire', 'nod');
  faceToward('brackspire', 'tackspire');
  await say('Tack', 'Still tied. 2 pearls apiece. Ugh.');
  // Tack and Brack walk off round the church and out of the south gate.
  await Promise.all([walkOff('tackspire', 16, 24), (async () => { await wait(10); await walkOff('brackspire', 16, 24); })()]);
  setFlag('tack3');
  bell(-5);
  await emote('ouro', 'music');
}

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
  if (has('spire')) { await say('Verger', 'the bole lies to the north, threading through the understory. it\'s a half-day\'s walk. eleven bells.'); return; }
  await say('Verger', 'you rang two late. that\'s entirely understandable.');
  await say('Verger', 'when someone above speaks too loudly, the bells ring, and i record them in my ledger of loudnesses.');
  await say('Verger', 'in a fight, a wind-up is a bell you can hear approaching. stop it, or move out of its path.');
  await hint('(A ! over a whorl indicates a wind-up.');
  await hint('Stun, Silence, Sleep, Taunt, or forcing it out interrupts it.)');
  const r = await fightTrainer({ name: 'Verger', team: [['grotesque', 10], ['siren', 10], ['fogbank', 10], ['flare', 10]], intro: '', defeat: '', ai: 'keeper' });
  if (r.result !== 'win') return;
  await say('Verger', 'it rang three!! the spire pearl is rightfully yours.');
  giveScale('spire');
  await notice('Ouro receives the Spire pearl.');
  if (flag('tack3')) await say('Verger', 'the bell for your friend was the wind.');
  await say('Verger', 'take this jingle. it rang for the old ones sleeping across the roads, and still wakes them.');
  await giveKeyItem('jingle', 'Ouro receives the jingle.');
  await say('Verger', 'north to the bole, through the undergrowth. half a day. eleven bells if you hurry.');
  goal('Travel north from the Spire, crossing the understory to reach the Bole.');
});
