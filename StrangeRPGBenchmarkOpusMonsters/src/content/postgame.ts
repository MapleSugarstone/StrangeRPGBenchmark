import { defMap, defScript, MAPS } from '../game/world';
import { G, flag, setFlag, save } from '../game/state';
import { battle } from '../game/battleView';
import { act, choose, face, field, fightWild, giveMon, goal, hint, liftOff, mon, narr, offstage, pan, panBack, say, shake, sound, wait, walkTo } from '../game/api';
import { music } from '../engine/music';
import { PEOPLE } from '../engine/sprites';
import { WILD_KINDS } from '../data/species';
import { randomFit } from '../game/wildfit';

const post = () => !!flag('postgame');
const V = (inner: string) => 'v' + inner + 'v';
const A = '..,,,,..,,,,....,,,,..,,,,....,,,,..,,';
const B = '......................................';
const C = ',,,,,,..........,,,,,,..........,,,,,,';
const Z1 = 'zzzzzz....zzzzzzzz....zzzzzz....zzzzzz';
const Z2 = '...zzzzzzzz....zzzzzz....zzzzzzzz.....';

defMap({
  id: 'slack', name: 'The Shallows', region: 10, music: 'slack',
  rows: [
    'vvvvvvvvvvvvvvvvvv==vvvvvvvvvvvvvvvvvvvv',
    V(B), V(A), V(A), V(B), V(Z1), V(C), V(C), V(B), V(A), V(B), V(Z2), V(C), V(C), V(B),
    V(A), V(B), V(Z1), V(C), V(A), V(B), V(Z2), V(C), V(C), V(B), V(A), V(A), V(B), V(B),
    'vvvvvvvvvvvvvvvvvv==vvvvvvvvvvvvvvvvvvvv',
  ],
  warps: [
    { x: 18, y: 29, to: 'hum', tx: 22, ty: 1, dir: 2 }, { x: 19, y: 29, to: 'hum', tx: 22, ty: 1, dir: 2 },
    { x: 18, y: 0, to: 'oldrind', tx: 12, ty: 22, dir: 2, when: () => G.keys.includes('riderslip') },
    { x: 19, y: 0, to: 'oldrind', tx: 13, ty: 22, dir: 2, when: () => G.keys.includes('riderslip') },
  ],
  zone: { kinds: WILD_KINDS.map(k => [k, 1] as [string, number]), lv: [55, 68], n: 18, area: 'wrinkle', fitted: 0.4 },
  npcs: [
    { id: 'realcinch', x: 20, y: 14, sprite: 'realcinch', name: 'Cinch', talk: 'realCinch' },
    { id: 'slacksign', x: 20, y: 27, sprite: 'sign', name: null as any, lines: ['Past the Lip. Nothing is held here. Mind your hat.'] },
  ],
  enter: 'slackEnter',
});

defMap({
  id: 'oldrind', name: 'The Exuvia', region: 10, music: 'oldrind',
  rows: [
    'vvvvvvvvvvvvvvvvvvvvvvvv',
    'v......................v',
    'v..hhhh....hhhh..hhhh..v',
    'v..h__h....h__h..h__h..v',
    'v..hh.h....hh.h..hh.h..v',
    'v......................v',
    'v......................v',
    'v.........mmmm.........v',
    'v.........m..m.........v',
    'v.........m..m.........v',
    'v.........mm.m.........v',
    'v......................v',
    'v..hhhh..........hhhh..v',
    'v..h__h..........h__h..v',
    'v..hh.h..........hh.h..v',
    'v......................v',
    'v......................v',
    'v......................v',
    'v......................v',
    'v......................v',
    'v......................v',
    'v......................v',
    'v......................v',
    'vvvvvvvvvvvv==vvvvvvvvvv',
  ],
  warps: [{ x: 12, y: 23, to: 'slack', tx: 18, ty: 1, dir: 0 }, { x: 13, y: 23, to: 'slack', tx: 19, ty: 1, dir: 0 }],
  npcs: [
    { id: 'r1', x: 5, y: 5, blocks: true, sprite: 'rider', name: null as any, lines: ['A Rider\'s cast, sitting where it sat.'] },
    { id: 'r2', x: 17, y: 5, sprite: 'rider', name: null as any, lines: ['A Rider\'s cast. It faces south.'] },
    { id: 'r3', x: 6, y: 16, sprite: 'rider', name: null as any, lines: ['Two Rider casts, one sitting in the other\'s lap. Neither is a child.'] },
    { id: 'r4', x: 18, y: 16, sprite: 'riderhand', name: null as any, lines: ['A Rider\'s cast with its hand out, palm up.'] },
    { id: 'tallowslip', x: 7, y: 16, sprite: 'rider', name: null as any, when: () => !!flag('riderHome'), lines: ['Old Amber\'s grandmother\'s grandmother\'s cast, sitting beside the others.'] },
    { id: 'mundane', blocks: true, x: 12, y: 9, sprite: 'stone', mon: 'mundane', name: 'Mundane', talk: 'mundane', when: () => !flag('mundaneCaught') },
  ],
  enter: 'oldRindEnter',
});

defMap({
  id: 'stack', name: 'The Stack', region: 11, indoor: true, music: 'stack',
  rows: [
    '############',
    '#__________#',
    '#__________#',
    '#_p______p_#',
    '#__________#',
    '#__________#',
    '#_p______p_#',
    '#__________#',
    '#__________#',
    '#####dd#####',
  ],
  warps: [{ x: 5, y: 9, to: 'fall', tx: 6, ty: 31, dir: 0 }, { x: 6, y: 9, to: 'fall', tx: 6, ty: 31, dir: 0 }],
  npcs: [{ id: 'stackkeeper', x: 5, y: 2, sprite: 'stackkeeper', name: 'Stackkeeper', talk: 'stack' }],
});

// Openings that appear after the credits.
MAPS.hum.mods = [...(MAPS.hum.mods || []), { x: 22, y: 6, ch: '=', when: post }];
MAPS.hum.warps.push({ x: 22, y: 0, to: 'slack', tx: 18, ty: 28, dir: 0, when: post });
MAPS.fall.mods = [...(MAPS.fall.mods || []), { x: 6, y: 30, ch: 'd', when: post }];
MAPS.fall.warps.push({ x: 6, y: 30, to: 'stack', tx: 5, ty: 8, dir: 2, when: post });

// ---------------------------------------------------------------- scripts

defScript('slackEnter', async () => {
  if (!flag('slackSeen')) {
    setFlag('slackSeen');
    await hint('The crazes out here move when you are not looking at them.');
  }
});

defScript('realCinch', async () => {
  if (!flag('metCinch')) {
    setFlag('metCinch');
    await say('Cinch', 'Sit down.', PEOPLE.realcinch);
    await choose(['You\'re Cinch.']);
    await say('Cinch', 'Sat down forty years ago. Best thing I ever did.', PEOPLE.realcinch);
    await say('Cinch', 'Somebody\'s at the Operculum, then. Good. Forgot I left one up there.', PEOPLE.realcinch);
    await say('Cinch', 'Sit. Ground goes up and down out here with the tide. You get used to it.', PEOPLE.realcinch);
    return;
  }
  await say('Cinch', 'Sit, if you\'re stopping. The fire\'s for anyone.', PEOPLE.realcinch);
});

defScript('oldRindEnter', async () => {
  if (flag('riderHome')) return;
  // Inside the old shell: a whole country, hollow, in thin gray shell, with the casts of its people sitting where they sat.
  // The Rider's cast comes out of Ouro's four, walks to one of them, and sits down beside it.
  setFlag('riderHome');
  offstage('tallowslip');
  await wait(30);
  await liftOff('tallowslip', 'ouro');
  await walkTo('tallowslip', 7, 16);
  face('tallowslip', 1);
  await act('tallowslip', 'bow');
  G.keys = G.keys.filter(k => k !== 'riderslip');
  G.keys.push('riderslipHome');
  // In the middle, something old gets up.
  await pan(12, 9);
  await act('mundane', 'hop');
  sound('boom');
  await shake(20);
  await panBack();
});

defScript('mundane', async () => {
  const r = await fightWild(mon('mundane', 68), { canRun: true, bossHp: 2.4, ai: 'champion', area: 'wrinkle' });
  if (r.pegged.length) {
    setFlag('mundaneCaught');
    await giveMon(r.pegged[0]);
    sound('boom');
    await shake(30);
  } else if (r.result === 'win') {
    await act('mundane', 'bow');
    await wait(60);
    await act('mundane', 'hop');
  }
});

function stackTeam(floor: number) {
  let s = floor * 7919 + 17;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const team = [];
  for (let i = 0; i < 4; i++) {
    const a = WILD_KINDS[Math.floor(rnd() * WILD_KINDS.length)];
    let b = WILD_KINDS[Math.floor(rnd() * WILD_KINDS.length)];
    if (b === a) b = WILD_KINDS[(WILD_KINDS.indexOf(a) + 7) % WILD_KINDS.length];
    team.push(randomFit(rnd, a, b, 50));
  }
  return team;
}

defScript('stack', async () => {
  await say('Stackkeeper', 'Every floor is a fight!! Your whorls stand at fifty, all of them. Conjoined foes only, up here.');
  await say('Stackkeeper', 'Victory, upward, one floor!! Defeat, downward, the very bottom.');
  await say('Stackkeeper', `The loftiest so far is floor ${G.stackBest}. Where it ends, nobody has ever informed me.`);
  if ((await choose(['Go up', 'Not now'])) !== 0) return;
  let floor = 1;
  for (;;) {
    const r = await battle({ enemy: stackTeam(floor), name: `Floor ${floor}`, ai: floor > 5 ? 'champion' : 'keeper', wild: false, bg: ['#2a2830', '#4a4458'], sync: true, music: 'keeper', noXp: true });
    music.play('stack');
    if (r.result !== 'win') { await say('Stackkeeper', `Floor ${floor}. Down, bottom, again.`); break; }
    if (floor > G.stackBest) G.stackBest = floor;
    save();
    G.rind += 100 * floor;
    if ((await choose([`Floor ${floor + 1}`, 'Come down'], false, `Floor ${floor} done. ${100 * floor} cowries.`)) !== 0) break;
    floor++;
  }
  await say('Stackkeeper', `The loftiest is now ${G.stackBest}!! I shall require a fourth hat.`);
});

void field; void goal;
