import { defMap, defScript } from '../game/world';
import { G, flag, setFlag, vellumPulls, loosened, save } from '../game/state';
import { battle } from '../game/battleView';
import { act, choose, emote, evening, face, faceToward, field, fightTrainer, giveMon, goal, hint, joinOuro, liftOff, mon, narr, offstage, pan, panBack, prop, say, sound, stayComesLoose, tint, unprop, wait, walkIn, walkOff, walkTo, walkUp, warp } from '../game/api';
import { music } from '../engine/music';
import { sfx } from '../engine/audio';
import { makeMon, SPECIES, WILD_KINDS, nextUid } from '../data/species';
import { MOVES, PASSIVES } from '../battle/registry';
import { TYPES, type Type } from '../data/types';
import { brack } from './ch3';
import { fitted } from '../game/wildfit';
import { listMenu } from '../game/menus';
import { vellumSprite } from '../engine/sprites';
import { smallGranLine } from './ch1';
import { credits } from './credits';
import type { Mon } from '../battle/model';

const hold = () => vellumPulls() <= 1;
const ROW = (inner: string) => '#' + inner + '#';

function withNotion(m: Mon, n: string): Mon { m.notion = n; return m; }

export function bareFinal(): Mon[] {
  return [makeMon('carrion', 44), makeMon('undertow', 44), makeMon('hemlock', 44),
    fitted('quarry', 'carrion', 45, ['cut', 'peck', 'mob', 'excavate'], ['dugout', 'gather'], 'Quarrion')];
}
export function tackFinal(): Mon[] { return [brack(48), makeMon('howl', 47), makeMon('turbine', 47), makeMon('quarry', 48)]; }
export function cinchTeam(): Mon[] { return [makeMon('knot', 74), makeMon('menhir', 58), makeMon('halo', 58), makeMon('orrery', 58)]; }
export function purchaseTeam(): Mon[] {
  return [
    withNotion(fitted('perigee', 'hemlock', 54, ['ping', 'fix', 'wilt', 'lastcup'], ['telemetry', 'cup'], 'Perilock'), 'bodkin'),
    withNotion(fitted('stoat', 'umbra', 54, ['nip', 'shade', 'blot', 'dance'], ['weasel', 'corona'], 'Stombra'), 'edgecharm'),
    withNotion(fitted('welling', 'halo', 54, ['bucket', 'brim', 'smite', 'intervention'], ['deepwater', 'grace'], 'Welhalo'), 'ribbon'),
    withNotion(fitted('flare', 'dynamo', 55, ['sear', 'spark', 'arc', 'supernova'], ['ignite', 'charge'], 'Flaremo'), 'crownofhorn'),
  ];
}

const climbRows: string[] = ['#######==#######'];
for (let i = 1; i < 39; i++) climbRows.push(i % 4 === 2 ? ROW('.#....==....#.') : ROW('......==......'));
climbRows.push('#######==#######');

defMap({
  id: 'climb', name: 'The Climb', region: 9, music: 'climb',
  rows: climbRows,
  warps: [
    { x: 7, y: 39, to: 'fall', tx: 20, ty: 32, dir: 2 }, { x: 8, y: 39, to: 'fall', tx: 20, ty: 32, dir: 2 },
    { x: 7, y: 0, to: 'crown', tx: 12, ty: 18, dir: 2, when: () => !!flag('climbDone') }, { x: 8, y: 0, to: 'crown', tx: 12, ty: 18, dir: 2, when: () => !!flag('climbDone') },
  ],
  npcs: [
    { id: 'climbBare', x: 7, y: 18, sprite: 'bare', name: 'Bare', dir: 0, when: () => hold() && !flag('climbDone') },
    { id: 'climbTack', x: 8, y: 18, sprite: 'tack', name: 'Tack', dir: 0, when: () => !hold() && !flag('climbDone') },
    { id: 'climbBareSit', x: 5, y: 17, sprite: 'bare', name: 'Bare', when: () => hold() && !!flag('climbDone') && !flag('ending'), lines: ['Bare sits on the Climb and looks down at the Volute.'] },
  ],
  triggers: [{ x: 1, y: 19, w: 14, h: 2, script: 'climbBlock', when: () => !flag('climbDone') }],
  enter: 'climbEnter',
});

defMap({
  id: 'crown', name: 'The Apex', region: 9, music: 'crown',
  rows: [
    '########################',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#..........jj..........#',
    '#..........jj..........#',
    '#..........jj..........#',
    '#......jjjjBBjjjj......#',
    '#......jjjjBBjjjj......#',
    '#......................#',
    '#..........jj..........#',
    '#..........jj..........#',
    '#..........jj..........#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '############==##########',
  ],
  warps: [{ x: 12, y: 19, to: 'climb', tx: 7, ty: 1, dir: 2 }, { x: 13, y: 19, to: 'climb', tx: 8, ty: 1, dir: 2 }],
  tileTalk: { B: 'theKey', j: 'theKey' },
  npcs: [
    { id: 'fid', x: 11, y: 5, sprite: 'fid', name: 'Fid', talk: 'fid', dir: 0 },
    { id: 'lug', x: 17, y: 9, sprite: 'lug', name: 'Lug', talk: 'lug', dir: 3 },
    { id: 'hasp', x: 11, y: 15, sprite: 'hasp', name: 'Hasp', talk: 'hasp', dir: 0 },
    { id: 'purchase', x: 6, y: 9, sprite: 'purchase', name: 'Purchase', talk: 'purchase', dir: 1 },
    { id: 'cinch', x: 12, y: 11, sprite: 'cinch', name: 'Cinch', talk: 'cinch', dir: 2, when: () => !flag('endHold') && !flag('endRelease') },
    // People who come up the Climb or lift off Ouro in the endings.
    { id: 'barecrown', x: 12, y: 16, sprite: 'bare', name: 'Bare', movable: true, when: () => hold() && !!flag('ending') && !flag('endHold') },
    { id: 'tackcrown2', x: 12, y: 16, sprite: 'tack', name: 'Tack', movable: true, when: () => !hold() && !!flag('ending') && !flag('endRelease') },
    { id: 'ouroslip', x: 13, y: 11, sprite: 'vellum', name: 'Ouro\'s cast', movable: true, when: () => !!flag('slipOut') && !flag('endRelease') },
    { id: 'tackcrown', x: 16, y: 16, sprite: 'tack', name: 'Tack', when: () => hold() && !flag('endHold'), lines: ['1 day up. 0 days off. I\'m standing with the Hands now. Feet are fine. Totally fine.'] },
  ],
  enter: 'crownEnter',
});

// ---------------------------------------------------------------- scripts

defScript('climbEnter', async () => {
  if (!flag('ch9start')) {
    setFlag('ch9start');
    sound('wind');
    await narr('Wind comes down from the top. It smells of salt.');
    goal('Climb to the Apex.');
  }
});

defScript('climbBlock', async () => {
  if (hold()) {
    await say('Bare', 'Stop.');
    await say('Bare', 'Look back down. Go on.');
    await say('Bare', 'Count the Stays still standing.');
    await say('Bare', 'Okay. Now let me past.');
    const r = await fightTrainer({ name: 'Bare', team: bareFinal, intro: '', defeat: '', ai: 'champion' });
    if (r.result !== 'win') return;
    await say('Bare', 'Go up, then.');
    await say('Bare', 'Go up and turn it.');
    await walkTo('climbBare', 5, 17);
    face('climbBare', 0);
    await act('climbBare', 'bow');
  } else {
    await say('Tack', '5th time. You\'re loose. I can see it from ten steps up.');
    await say('Tack', `Your back's crazed ${loosened()} fingers long. I counted. Then I counted again.`);
    await say('Tack', 'No loose ones up to the Operculum. That\'s my 1 rule. I\'ve only got the one.');
    const r = await battle({ enemy: tackFinal(), name: 'Tack', ai: 'keeper', wild: false, bg: field.bg(), music: 'rival' });
    music.play('climb');
    if (r.result !== 'win') { await say('Tack', '1 more for me. Go count, then come back up.'); return; }
    G.flags.tackWins = (G.flags.tackWins || 0) + 1;
    await say('Tack', `${G.flags.tackWins} losses. Fine. That's fine.`);
    await say('Tack', 'Go on up. 1 at a time. Me first.');
    await walkOff('climbTack', 8, 6);
  }
  setFlag('climbDone');
});

defScript('crownEnter', async () => {
  if (!flag('crownSeen')) {
    setFlag('crownSeen');
    // A flat round top with the Operculum in the middle, a black post with four arms, a Hand at each arm and Cinch at the post.
    await pan(12, 10);
    await wait(40);
    await panBack();
    goal('The four Hands first: Fid, Lug, Hasp, Purchase.');
  }
});

defScript('theKey', async () => { await emote('ouro', 'silence'); });

async function hand(id: string, before: string | null, intro: string[], team: () => Mon[], outro: string, who: string): Promise<void> {
  if (flag('beat_' + id)) { await say(who, outro); return; }
  if (before && !flag('beat_' + before)) { await emote(id, 'silence'); await hint('The Hands go in order: Fid, Lug, Hasp, Purchase.'); return; }
  for (const l of intro) await say(who, l);
  const r = await fightTrainer({ name: who, team, intro: '', defeat: '', ai: 'champion' });
  if (r.result !== 'win') return;
  setFlag('beat_' + id);
  await say(who, outro);
}

defScript('fid', () => hand('fid', null, ['You span four tall, young person, and one span short of a Hand.', 'The Operculum is nineteen spans round, by official measure. Walk it. Count aloud.'],
  () => [makeMon('menhir', 47), makeMon('tor', 47), makeMon('gore', 47), makeMon('thumb', 48)], 'That fell one hand\'s width short, by my rule. Go round.', 'Fid'));
defScript('lug', () => hand('lug', 'fid', ['Close in here. Storm by supper, inside. Rain in the soup.', 'Soup on the stairs. Stairs going up into cloud.', 'Damp up the walls already. Fight it out of the damp. Wipe your feet first.'],
  () => [makeMon('welling', 56), makeMon('curtain', 56), makeMon('floe', 56), makeMon('halo', 57)], 'Clearing, indoors.', 'Lug'));
defScript('hasp', () => hand('hasp', 'lug', ['Do they hold still?? When nobody watches?? Your hands??', 'Did you wash them before you came up? Under the nails?', 'Can you hold on with those? For a day? For a year?'],
  () => [makeMon('siren', 57), makeMon('grotto', 57), makeMon('fulgur', 57), makeMon('fogbank', 58)], 'Shaking?? Now?? Your hands??', 'Hasp'));
defScript('purchase', () => hand('purchase', 'hasp', ['My brother sold you your first stray. Cheaply!! I would have charged thrice that, and the sandwich.', 'A Hand is worth eight pearls and a Climb. You have owed that much. Now owe it all again.'],
  purchaseTeam, 'Precisely the price, to the last cowrie. Go on to the post. Do mind the hat.', 'Purchase'));

defScript('cinch', async () => {
  if (!flag('beat_purchase')) { await say('Cinch', 'YOU HAVE TO GO ROUND THE HANDS FIRST AND ALL FOUR HAVE TO LET YOU AND THEN YOU HAVE TO-'); return; }
  // Cinch stands at the post with both hands on it and does not move. Up close there is a clear gap at the side of its neck.
  await wait(30);
  await emote('ouro', 'question');
  await say('Cinch', 'You have to stop there. Both feet.');
  await say('Cinch', 'Someone has to stand here.');
  await say('Cinch', 'THE VOLUTE HAS TO HOLD AND SOMEONE HAS TO STAND HERE AND THE HANDS HAVE TO STAY ON AND');
  await say('Cinch', 'THE POST HAS TO TURN ONCE A DAY AND IT HAS TO BE TODAY AND IT HAS TO BE EVERY DAY AND-');
  await say('Cinch', 'You will have to make me take my hands off it.');
  const r = await fightTrainer({ name: 'Cinch', team: cinchTeam, intro: '', defeat: '', ai: 'champion' });
  if (r.result !== 'win') return;
  setFlag('cinchBeaten');
  // Cinch's hands come off the post. Cinch does not fall, and its hands stay up at the height of the post, holding nothing.
  sound('back');
  await act('cinch', 'shiver');
  await emote('cinch', 'silence');
  await say('Purchase', 'There. There it is!! Forty years, and not one cowrie\'s change in what it is worth.');
  await say('Purchase', 'Cinch turned HERE, at this very post, forty years back. A second turning!! Most unrefundable.');
  await say('Purchase', 'The cast stayed at the post and kept at it. Cinch strolled off over the Lip and never collected.');
  await say('Purchase', 'We have taken our orders from a habit. Cheap orders. And we owed full price for every one.');
  await say('Fid', 'The post spans four from your hand. I have measured it twice.');
  await say('Hasp', 'Are you going to put them on it? Both? Now?');
  await say('Lug', 'Very still in here. Still as a held breath.');
  await say('Lug', 'A breath held forty years. Years with no weather in them.');
  setFlag('ending');
  offstage('barecrown', 'tackcrown2');
  if (hold()) await holdEnding(); else await releaseEnding();
});

async function holdEnding(): Promise<void> {
  // The Operculum starts to turn on its own, slowly, loose.
  sound('wind');
  field.shakeT = 40;
  await emote('ouro', 'surprise');
  await say('Cinch', 'Someone has to.');
  // Ouro puts both hands on the post, and the Operculum stops.
  await walkTo('ouro', 11, 11);
  face('ouro', 2);
  await act('ouro', 'bow');
  sound('guard');
  field.shakeT = 0;
  // The crazes in the ground under the Apex close into a fine grid, and the craze down Ouro's back closes over, smooth.
  await tint('#f8f4e8', 0.5, 20);
  setFlag('seamClosed');
  sound('heal');
  await tint('#f8f4e8', 0, 40);
  await act('ouro', 'shiver');
  // Bare comes up the last of the Climb, stops at the edge to look at Ouro's hands, and sits down on the ground.
  await walkIn('barecrown', 12, 19, 12, 16);
  faceToward('barecrown', 'ouro');
  await wait(40);
  await act('barecrown', 'bow');
  await say('Bare', 'I wanted you to have it.');
  // Cinch lowers its hands, comes round, and stands by Ouro the way a whorl stands by its keeper.
  faceToward('cinch', 'ouro');
  await act('cinch', 'bow');
  await joinOuro('cinch');
  await giveMon(mon('knot', 61));
  await walkUp('tackcrown');
  await say('Tack', '1 Holdfast. 0 days off. You\'re gonna want a chair.');
  setFlag('endHold');
  await epilogue();
}

async function releaseEnding(): Promise<void> {
  // The Operculum starts to turn on its own, loose, then fast.
  sound('wind');
  field.shakeT = 90;
  await say('Cinch', 'IT HAS TO');
  await emote('cinch', 'silence');
  const all = ['rib', 'mast', 'spire', 'bole', 'pylon', 'tusk', 'hilt', 'fall'];
  const fullHere = G.party.some(m => m.kind === 'full');
  // Every Stay still standing comes out down at the Lip, one boom after another. With Full in the four, Full comes
  // out of its horn unasked and rises over the Apex, and the last Stay comes up toward it.
  const hands = ['fid', 'lug', 'hasp', 'purchase'];
  for (const [i, id] of all.entries()) {
    if (G.pulled.includes(id)) continue;
    if (fullHere && id === all.filter(s => !G.pulled.includes(s)).slice(-1)[0]) {
      sound('shield');
      await prop('fullrise', 'mon:full', field.x, field.y - 1, 30);
      for (let k = 2; k <= 5; k++) { await prop('fullrise', 'mon:full', field.x, field.y - k, 0); await wait(10); }
    }
    void emote(hands[i % 4], 'surprise');
    await stayComesLoose(id, false);
  }
  void unprop('fullrise', 40);
  // The ground under everyone lifts in one curved piece, and under it is new shell, wet, pearly, and pink at the edges.
  sound('boom');
  field.shakeT = 90;
  await tint('#f4c8d8', 0.5, 90);
  await Promise.all(['ouro', 'whorl', ...hands, 'cinch'].map(w => act(w, 'hop')));
  await tint('#f4c8d8', 0, 60);
  await narr('The old shell of the Volute gets up and walks north, with its towns drawn on it in crazes.');
  // Ouro's back opens along the craze, and something pale lifts off Ouro in one piece: Ouro's cast.
  await act('ouro', 'shiver');
  sfx('fit');
  field.flashT = 30;
  setFlag('slipOut');
  offstage('ouroslip');
  const sx = field.freeFor('ouroslip', field.x + 1, field.y) ? field.x + 1 : field.x - 1;
  await liftOff('ouroslip', 'ouro', sx, field.y);
  faceToward('ouroslip', 'ouro');
  faceToward('ouro', 'ouroslip');
  const slip = await makeVellumSlip();
  await joinOuro('ouroslip');
  await giveMon(slip);
  await walkIn('tackcrown2', 12, 19);
  await walkUp('tackcrown2');
  await say('Tack', '1. Yeah. That\'s 1, for you.');
  setFlag('endRelease');
  await epilogue();
}

/** The player builds Ouro's cast from any kind in the Register. */
async function makeVellumSlip(): Promise<Mon> {
  await hint('(Ouro\'s cast can keep any four moves and any two habits from kinds in the Register.)');
  const kinds = WILD_KINDS.concat(['full', 'mundane', 'knot']).filter(k => G.register[k] === 2);
  const moves: string[] = [];
  let bigs = 0;
  while (moves.length < 4) {
    const ki = await listMenu(`Move ${moves.length + 1} of 4: from which kind?`, kinds.map(k => SPECIES[k].name), { w: 150 });
    if (ki < 0) continue;
    const opts = SPECIES[kinds[ki]].moves.filter(m => !moves.includes(m) && !(MOVES[m].nerve && bigs >= 2));
    const mi = await listMenu('Which move?', opts.map(m => MOVES[m].name + (MOVES[m].nerve ? ' (big)' : '')), { w: 150 });
    if (mi < 0) continue;
    moves.push(opts[mi]);
    if (MOVES[opts[mi]].nerve) bigs++;
  }
  const passives: string[] = [];
  while (passives.length < 2) {
    const ki = await listMenu(`Habit ${passives.length + 1} of 2: from which kind?`, kinds.map(k => SPECIES[k].name), { w: 150 });
    if (ki < 0) continue;
    const opts = SPECIES[kinds[ki]].passives.filter(p => !passives.includes(p));
    const pi = await listMenu('Which habit?', opts.map(p => PASSIVES[p].name), { w: 150 });
    if (pi < 0) continue;
    passives.push(opts[pi]);
  }
  const ti = await listMenu('Which type?', TYPES as string[], { w: 100 });
  const types: Type[] = ['BEAST'];
  if (ti >= 0 && TYPES[ti] !== 'BEAST') types.push(TYPES[ti]);
  const level = Math.max(...G.party.map(m => m.level));
  const sp = vellumSprite(0);
  return {
    uid: nextUid(), kind: 'vellumslip', name: 'Ouro\'s cast', types, basic: 'P', moves, passives, level, xp: 0, notion: null,
    sprite: { px: sp.px.map((r, y) => (y === 4 ? r.slice(0, 4) + '.' + r.slice(5) : r)), c: ['#e8dcc8', '#c8c0b0'] },
    person: true, entry: 'Off Ouro, in one piece, a bit lighter. No price. Which you know what it cost. Not writing that in.',
  };
}

async function epilogue(): Promise<void> {
  save();
  await wait(30);
  await warp('home', 4, 4, 2);
  evening(false);
  await narr('A week later.');
  if (flag('endHold')) {
    await smallGranLine();
    await say('Gran', 'Tell my little turnip still my little turnip.');
    await say('Gran', 'Tell my little turnip that this is quite all right.');
    await say('Gran', 'Tell my little turnip to come home of a Sunday, for soup.');
  } else {
    await say('Small Gran', 'There. Now you.');
    faceToward('gran', 'smallgran');
    await emote('gran', 'surprise');
    await say('Gran', 'Tell my little turnip she said a new one.');
  }
  const wellFull = !!flag('wellingHome') || !flag('wellingGone');
  if (flag('endHold')) await say('Man at the well', wellFull ? 'She\'s up. Right to the top. Hasn\'t been frightened in a good while.' : 'Still dust. We carry from Rib now, it\'s not far. I still come and wait on her.');
  else await say('Man at the well', wellFull ? 'She came with us. Onto the new ground and everything. Stubborn old girl.' : 'New ground. Maybe new water under it. I\'ll dig and see if she\'s down there.');
  if (flag('endHold')) {
    await narr('The Operculum turns once a day, by Ouro\'s hands. Ouro does it sitting down.');
    await narr('THE VOLUTE HOLDS.');
  } else {
    await narr('Two old shells lie side by side far off to the north, on the edge of the world.');
    await narr('THE VOLUTE TURNS.');
  }
  await credits();
  setFlag('postgame');
  save();
  goal('The Shallows lie north of Hum, past the Lip. The Stack stands east of Fall.');
  await hint('(The Shallows are open north of Hum. The Stack is in Fall. Keepers take rematches.)');
}

void choose; void TYPES;
