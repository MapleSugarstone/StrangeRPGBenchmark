// Act 2, chapter 3: the Auger. Its dune, the mouth room, the rolling rooms, the stair and the vents,
// Turnwise's landing, and the point. The Take slides the Auger down to the low-water line.
// Side missions: the voice over the beach (begins), and Tack's count (release). See Notes/act2-script.md.
import { sfx } from '../../engine/audio';
import { PEOPLE } from '../../engine/sprites';
import { SPECIES } from '../../data/species';
import { act, choose, emote, face, faceToward, field, fightWild, giveKey, giveMon, goal, hint, mon, narr, notice, offstage, pan, panBack, prop, say, sound, tint, unprop, wait, walkIn, walkOff, walkTo } from '../../game/api';
import { starfall } from '../../game/minigames/starfall';
import { G, flag, setFlag } from '../../game/state';
import { bell as ringBell } from '../../game/api';
import { defMap, defScript, MAPS, type MapDef } from '../../game/world';
import { Canvas, highTide, kinds, look, reward, stash } from '../areakit';
import { smallGranLine } from '../ch1';
import { FOOTPRINTS, giveGrain } from './kit';
import { bell, cinch, eldestHooks, grains, keeperFight, low, person, release, sayAll, strandBoard, tideRuns, tideWatch } from './ch1';

type Mod = NonNullable<MapDef['mods']>[number];
const slid = () => !!flag('augerSlid');
const smallGranHere = () => G.party.some(m => m.kind === 'smallgranw');
const weedImg = () => (SPECIES.tumbleweed ? { px: SPECIES.tumbleweed.sprite, c: SPECIES.tumbleweed.c } : { px: PEOPLE.stone.px, c: PEOPLE.stone.c });

// ---------------------------------------------------------------- the Auger's dune

// A high dune with the Auger lying up its side: the mouth at the foot, the point out over the beach.
const AD_W = 40, AD_H = 24;
const ad = new Canvas(AD_W, AD_H, '.').border('#');
ad.rect(1, 1, AD_W - 2, 4, ',').rect(1, 22, AD_W - 2, 1, '~').put(0, 17, '=');
const AUGER: [number, number][] = [];
for (let t = 0; t <= 22; t++) {
  const x = 8 + t, y = 16 - Math.round(t / 2);
  AUGER.push([x, y]);
  if (t < 12) AUGER.push([x, y + 1]);
}
for (const [x, y] of AUGER) ad.put(x, y, 'h');
ad.rect(30, 3, 2, 3, 'h');
for (const [x, y] of [[30, 3], [31, 3], [30, 4], [31, 4], [31, 5]]) AUGER.push([x, y]);
const MOUTH = { x: 8, y: 17 };
ad.put(MOUTH.x, MOUTH.y, 'd');
for (const [x, y, w, h] of [[3, 8, 5, 3], [24, 14, 6, 2], [33, 9, 5, 3]]) ad.rect(x, y, w, h, ',');
const AD_TIDE = ['..' + 'A'.repeat(AD_W - 4) + '.', '..' + 'A'.repeat(AD_W - 4) + '.', '..' + 'A'.repeat(AD_W - 4) + '.'];
FOOTPRINTS.augerdune = [[4, 20], [10, 20], [16, 20], [22, 20], [28, 20], [34, 20]];
const adMods: Mod[] = [
  ...AUGER.map(([x, y]) => ({ x, y, ch: 'b', when: slid })),
  { x: MOUTH.x, y: MOUTH.y, ch: 'b', when: slid },
  ...tideRuns(AD_TIDE, 0, 19),
];
defMap({
  id: 'augerdune', name: 'The Auger\'s Dune', region: 25, music: 'strand', strand: true,
  rows: ad.rows(),
  mods: adMods,
  props: [{ x: 30, y: 3, pic: 'augerPoint', when: () => !slid() }],
  warps: [
    { x: 0, y: 17, to: 'cowrieback', tx: 38, ty: 16, dir: 3 },
    { x: MOUTH.x, y: MOUTH.y, to: 'augermouth', tx: 10, ty: 14, dir: 2, when: () => !slid() },
  ],
  enter: 'a2DuneEnter',
  zone: {
    kinds: kinds([['gyre', 3], ['lichen', 3], ['groundswell', 2], ['skitter', 2]]), lv: [24, 30], n: 9, area: 'strand',
    tideKinds: { high: kinds([['groundswell', 3], ['gyre', 2]]), low: kinds([['lichen', 3], ['gyre', 2], ['skitter', 2]]) },
  },
  npcs: [
    person('a2OutsideClimber', 19, 9, 'climber1', 'Climber on the outside', 1, { when: () => !slid() }),
    person('a2DuneSitter', 26, 13, 'beach4', 'Dune-sitter', 3, { trainer: { name: 'Dune-sitter', team: [['lichen', 28], ['groundswell', 29]], intro: 'The dune moves a foot every tide. So I move my chair a foot. We\'re even.', defeat: 'I\'ll move my chair back a foot. Even again.', sight: 3 } }),
  ],
  spots: [
    { x: 14, y: 14, script: 'a2RollTally' },
    { x: 30, y: 5, script: 'a2PointBelow' },
    stash('ad_point', 31, 6, 'In the sand under the point, where things fall off it, a nautilus horn.', { pegs: ['iron', 1] }),
    ...[[12, 14], [20, 10], [26, 7]].map(([x, y]) => ({ x, y, when: slid, script: 'a2DuneHollow' })),
  ],
});

defScript('a2DuneEnter', async () => {
  if (flag('duneSeen')) return;
  setFlag('duneSeen');
  // A long narrow shell lies up the side of a high dune, its point out over the beach, and a climber goes up its outside.
  await pan(20, 10);
  await act('a2OutsideClimber', 'hop');
  await wait(20);
  await panBack();
});
defScript('a2OutsideClimber', async () => {
  await say('Climber on the outside', 'Don\'t come up this way! Go in at the bottom and climb the inside. Like a normal person.');
  await say('Climber on the outside', 'We count rolls out here. That\'s all the outside\'s good for, counting.');
});
defScript('a2RollTally', async () => {
  if (slid()) { await runDuneHollow(); return; }
  await emote('ouro', 'question');
});
defScript('a2PointBelow', async () => {
  if (slid()) { await runDuneHollow(); return; }
  face('ouro', 2);
  await emote('ouro', 'silence');
});
async function runDuneHollow(): Promise<void> {
  await emote('ouro', 'silence');
}
defScript('a2DuneHollow', runDuneHollow);

// ---------------------------------------------------------------- the mouth room

// The lowest whorl, where the climbers live. Bunks on both walls, because either wall can be the floor.
const am = new Canvas(20, 16, '_').border('#');
am.put(10, 0, 'q').put(10, 1, 'q').put(9, 15, 'd').put(10, 15, 'd');
am.rect(1, 3, 2, 10, 'c').rect(17, 3, 2, 10, 'c');
am.put(15, 3, 'U').put(16, 3, 'U');
for (const [x, y, w, h] of [[5, 10, 3, 2], [12, 10, 3, 2]]) am.rect(x, y, w, h, ',');
const BOWLS_LOW: [number, number] = [3, 13], BOWLS_HIGH: [number, number] = [16, 13];
defMap({
  id: 'augermouth', name: 'The Mouth Room', region: 28, music: 'auger', strand: true,
  rows: am.rows(),
  mods: [{ x: BOWLS_LOW[0], y: BOWLS_LOW[1], ch: 'x', when: low }, { x: BOWLS_HIGH[0], y: BOWLS_HIGH[1], ch: 'x', when: highTide }],
  warps: [
    { x: 10, y: 0, to: 'augerroll', tx: 1, ty: 7, dir: 2 },
    ...[9, 10].map(x => ({ x, y: 15, to: 'augerdune', tx: MOUTH.x, ty: MOUTH.y + 1, dir: 0, when: () => !slid() })),
    ...[9, 10].map(x => ({ x, y: 15, to: 'lowline', tx: 6, ty: 12, dir: 0, when: () => slid() && !!flag('ch3Return') })),
  ],
  triggers: [{ x: 9, y: 15, w: 2, h: 1, script: 'a2Ch3Return', when: () => slid() && !flag('ch3Return') }],
  enter: 'a2MouthEnter',
  zone: { kinds: kinds([['chalk', 3], ['saltline', 3]]), lv: [24, 30], n: 4, area: 'auger' },
  npcs: [
    person('a2CinchStep', 9, 1, 'realcinch', 'Cinch', 0, { when: () => !!flag('augerEntered') && !flag('cinchNautilus') }),
    person('a2TackStep', 11, 2, 'tack', 'Tack', 3, { when: () => release() && !flag('cinchNautilus') }),
    person('a2BellKeeper', 14, 4, 'climber2', 'Bell-keeper', 1),
    person('a2RungSkipper', 5, 5, 'climber1', 'Rung-skipper', 0),
    person('a2ClWoman', 4, 8, 'climber1', 'Woman', 1),
    person('a2ClMan', 15, 8, 'climber2', 'Man', 3),
    person('a2ClOldMan', 4, 12, 'climber2', 'Old man', 1),
    person('a2ClGirl', 15, 12, 'climber1', 'Girl', 3),
    person('a2ClBoy', 8, 6, 'climber1', 'Boy', 0, { wander: true }),
    person('a2TurnwiseMouth', 12, 2, 'turnwise', 'Turnwise', 0, { when: slid }),
  ],
  spots: [
    look(15, 3, 'A rack of small bells cut from shell. Each has a different chip out of its rim.'),
    { x: BOWLS_LOW[0], y: BOWLS_LOW[1], script: 'a2Bowls' }, { x: BOWLS_HIGH[0], y: BOWLS_HIGH[1], script: 'a2Bowls' },
    look(2, 6, 'Bunks on the wall, one above the other. Some have straps.'),
    look(17, 6, 'Bunks on this wall too. The blankets are folded on both sides.'),
  ],
});

defScript('a2MouthEnter', async () => {
  if (flag('augerEntered')) return;
  setFlag('augerEntered');
  // Cinch comes in behind Ouro, looks up the stair, and sits on the lowest step.
  offstage('a2CinchStep');
  await walkTo('ouro', 11, 12);
  await walkIn('a2CinchStep', 10, 15, 9, 1);
  face('a2CinchStep', 2);
  await act('a2CinchStep', 'look');
  await act('a2CinchStep', 'bow');
  await cinch('Oof. Sit down here a minute. That\'s a lot of stair.');
  await cinch('Bottom step\'s best for hearing. You can hear them all climbing up there.');
  goal('Climb the Auger from the inside.');
});

defScript('a2Bowls', async () => { await emote('ouro', 'silence'); });

defScript('a2CinchStep', async () => {
  if (slid()) { await cinch('Come up on the step. Water\'s at my knees, but it\'s going.'); await cinch('Felt every bump from this step. Seven. Good step.'); return; }
  await cinch('Stair\'ll still be there after a sit. Always is.');
  await cinch('Hear that? Sit on the bottom step and you hear every one of them climbing.');
});

// Climbers, deadpan. When the tide rolls the Auger, the floor's the wall and their lines change.
function climber(id: string, name: string, l: { low: string[]; high?: string[]; slid?: string[] }): void {
  defScript(id, async () => { await sayAll(name, (slid() && l.slid) || (highTide() && l.high) || l.low); });
}
climber('a2ClWoman', 'Woman', { low: ['We climb all day. Then at night we sleep on the stair, facing up. Facing up\'s important.'], high: ['Rolled again. Up\'s still up, at least. Everything else moved.'], slid: ['We\'ll climb every low now. Even Gran. Gran\'s furious.'] });
climber('a2ClMan', 'Man', { low: ['When the tide rolls us the floor turns into the wall. You learn to sleep on both.'], high: ['Rolled. My bunk\'s the ceiling now. Scoot over, I\'m sleeping in yours.'] });
climber('a2ClOldMan', 'Old man', { low: ['Nobody\'s been to the point. Too narrow for anyone grown. Too narrow for me, that\'s for sure.', 'Low water, so climb. Climbing keeps it down. That\'s what my dad said.'], slid: ['It\'s never been down here before. There\'s the sea. Right there.'] });
climber('a2ClGirl', 'Girl', { low: ['My bowl\'s on the low side. Everyone\'s bowl\'s on the low side. Bowls roll.', 'Everybody up the stair. And down. And up. My legs!!'] });
climber('a2ClBoy', 'Boy', { low: ['We all climb at once and the whole Auger shakes. Best part of the low.'], high: ['High water. Hear that hum in the stair? That\'s the air. Hmmmmm.'] });

defScript('a2BellKeeper', async () => {
  if (G.keys.includes('handbell')) { await say('Bell-keeper', 'We ring the tide from in here when we want to roll. Saves a walk to the posts. Lazy, but.'); return; }
  await say('Bell-keeper', 'We ring the tide from in here when we wanna roll. Beats walking out to the posts.');
  await say('Bell-keeper', 'Here, have a spare. It rings the tide wherever you\'re standing on the beach. Don\'t lose it.');
  giveKey('handbell');
  sfx('level');
  await notice('(Ouro gets the hand bell. Ring it anywhere on the Strand to turn the tide.)');
});

defScript('a2RungSkipper', async () => {
  await strandBoard({
    id: 'a2peg3', name: 'Rung-skipper', deck: ['crimp', 'chamois', 'riser', 'tumbleweed', 'zenith'], tier: 7, prize: 'climbingchalk',
    lines: ['Every other step, that\'s how I go. Saves time. Costs knees.', 'Wet row\'s always the bottom one, whichever way we\'ve rolled.'],
  });
});

// Tack says a number in every line. Release only.
defScript('a2TackStep', async () => {
  if (flag('tackCount')) { await say('Tack', '4,000 steps. And 1 of them\'s mine. I\'m keeping it.'); return; }
  if (flag('pointView')) {
    await say('Tack', '3,909 for me. The last 91 you went up without me. Too narrow. Rude.');
    if (await choose(['It was 91.', 'I didn\'t count.']) === 0) {
      setFlag('tackCount');
      await say('Tack', '91? Then it\'s 4,000. Exactly 4,000! Here, 1 stone. Number\'s on it.');
      await reward({ notion: 'tallystone' });
      await say('Tack', 'Oh, 1 more thing. My score\'s on the board at the point. 66. Beat that.');
    }
    return;
  }
  await act('a2TackStep', 'nod');
  faceToward('a2TackStep', 'ouro');
  await say('Tack', '1,412 steps so far. 0 of them the same height. Who built this?');
  await say('Tack', 'Climbers say 4,000 to the point. Nobody\'s actually counted. So, me.');
});

defScript('a2TurnwiseMouth', async () => { await say('Turnwise', 'Climb. We climb. Everyone climbs now. It puts climbers back down.'); });

// The Return: Ouro climbs out at the mouth onto the low-water line.
defScript('a2Ch3Return', async () => {
  setFlag('ch3Return');
  setFlag('ch3ReturnScene');
  // The Low Line's own first-visit scene would run alongside this one, so this one stands in for it.
  setFlag('a2ret3');
  setFlag('a2c4');
  field.warp('lowline', 6, 12, 0);
  offstage('llClimberOld', 'llClimberWoman');
  await wait(12);
  // The Auger lies on wet sand at the sea's edge, and a little way along lies a flat striped shell with a hooded mouth.
  await walkTo('ouro', 6, 14);
  await pan(41, 9);
  await wait(40);
  await panBack();
  // The climbers come out and stand on the sand, looking up at the Auger.
  await Promise.all([walkIn('llClimberOld', 6, 11, 5, 13), (async () => { await wait(16); await walkIn('llClimberWoman', 6, 11, 7, 13); })()]);
  face('llClimberOld', 2);
  face('llClimberWoman', 2);
  await say('Old man', 'Never been down here. We\'re on the low line now. I can touch the sea from my bunk.');
  await say('Woman', 'We climb every low from now on. All of us.');
  await Promise.all([walkOff('llClimberOld', 6, 11), (async () => { await wait(16); await walkOff('llClimberWoman', 6, 11); })()]);
  setFlag('ch3ReturnScene', 0);
  goal('Go in at the striped shell\'s hood.');
});

// ---------------------------------------------------------------- the rolling rooms: the roll

// Gravity runs across each room: toward the bottom at low tide, toward the top at high tide, when the Auger rolls.
// 'l' is floor only at low tide and 'h' only at high. Unless Ouro stands on a stair or in a doorway, a roll drops
// Ouro to the new floor. Checked with scratchpad roll.mjs (no state is stuck). Fewest rolls: rooms 1 to 4 one
// each, room 5 three, all in its doorways: in the first ring high, in the second ring low, in the third ring high.
const ROOMS = [
  ['.......', '.......', '.......', 'hhhhhhh', '.......', '.......', 'q......'],
  ['.......', '.......', '.......', 'lllllll', '.......', '.......', '.......'],
  ['......h', '.....##', 'lllll##', '.....##', '.....##', '.....##', '.....##'],
  ['...l...', '...#...', 'hhh#...', '...#...', '...#...', '...#...', '...#...'],
  ['..#..#..#...q', '..#.hdl.#....', '..#..#..#....', '.ldh.#..#....', '..#..#..#....', '..#..#.ldh...', '..#..#..#....'],
  ['....h', '....h', '....h', 'lllll', '.....', '.....', '.....'],
];
const ROLL_DOORS = [2, 6, 1, 7, 7];
const ROLL: string[] = [];
for (let y = 0; y < 9; y++) {
  let r = '#';
  ROOMS.forEach((room, k) => {
    r += y === 0 || y === 8 ? '#'.repeat(room[0].length) : room[y - 1];
    r += k < ROLL_DOORS.length && ROLL_DOORS[k] === y ? 'd' : '#';
  });
  ROLL.push(r);
}
const RW = ROLL[0].length;
const RUBBLE = { x: 23, y: 1 }, WEED = { x: 28, y: 1 }, ROLL_EXIT = ROLL[1].indexOf('q');
const rollAt = (x: number, y: number) => ROLL[y]?.[x] ?? '#';
const rollOpen = (c: string, high: boolean) => c === '.' || c === 'q' || c === 'd' || (c === 'l' && !high) || (c === 'h' && high);
const rr = new Canvas(RW, 9, '#');
ROLL.forEach((r, y) => [...r].forEach((c, x) => rr.put(x, y, c === 'l' || c === 'h' ? '#' : c === '.' ? '_' : c)));
rr.put(1, 8, 'q').put(ROLL_EXIT, 0, 'q');
// Ledges are wall in their base rows and open by mods, so the validator sees every ledge open.
rr.put(RUBBLE.x, RUBBLE.y, 'O').put(WEED.x, WEED.y, '_');
const rollMods: Mod[] = [{ x: RUBBLE.x, y: RUBBLE.y, ch: 'x', when: highTide }];
ROLL.forEach((r, y) => [...r].forEach((c, x) => {
  if (x === RUBBLE.x && y === RUBBLE.y) return;
  if (c === 'l') rollMods.push({ x, y, ch: '_', when: low });
  if (c === 'h') rollMods.push({ x, y, ch: '_', when: highTide });
}));
defMap({
  id: 'augerroll', name: 'The Rolling Rooms', region: 28, music: 'auger', strand: true,
  rows: rr.rows(),
  mods: rollMods,
  warps: [
    { x: 1, y: 8, to: 'augermouth', tx: 10, ty: 1, dir: 0 },
    { x: ROLL_EXIT, y: 0, to: 'augerstair', tx: 2, ty: 18, dir: 2 },
  ],
  enter: 'a2RollEnter',
  npcs: [
    { id: 'a2Weed', x: WEED.x, y: WEED.y, sprite: 'stone', name: 'Kokieri', img: weedImg, when: highTide, lines: ['A Kokieri has rolled into the gap and fills it.'] },
    person('a2Tumbler', 13, 2, 'climber2', 'Tumbler', 2, { trainer: { name: 'Tumbler', team: [['tumbleweed', 30], ['riser', 30]], intro: 'Every roll I end up on the other wall. My lunch too. My lunch gets there first.', defeat: 'Rolled. Over.', sight: 2 } }),
  ],
  spots: [
    bell(2, 8), bell(8, 1), bell(16, 5), bell(22, 2), bell(24, 2), bell(35, 3), bell(38, 1), bell(41, 5), bell(46, 6),
    { x: 51, y: 0, when: () => !flag('found_ar_ledge'), script: async () => {
      if (low()) { await emote('ouro', 'question'); return; }
      setFlag('found_ar_ledge');
      await reward({ notion: 'crownofhorn' });
    } },
    look(RUBBLE.x, RUBBLE.y + 1, 'A shaft in the wall. Rubble rattles in it whenever the Auger rolls.'),
  ],
});

defScript('a2RollEnter', async () => {
  if (flag('rollSeen')) return;
  setFlag('rollSeen');
  await hint('(At low tide the Auger lies on its left side. At high tide it floats and rolls onto its right.)');
  await hint('(Whatever is loose falls to the new floor. Stand on a stair or in a doorway when it rolls.)');
  if (!G.keys.includes('handbell')) await hint('A bell hangs on the wall by every doorway, for rolling the rooms.');
});

tideWatch.push(async () => {
  if (field.map.id !== 'augerroll') return;
  const high = highTide();
  const x = field.x;
  let y = field.y;
  if ('qd'.includes(rollAt(x, y))) return;
  const dy = high ? -1 : 1;
  const y0 = y;
  while (rollOpen(rollAt(x, y + dy), high) && !(x === WEED.x && y + dy === WEED.y && high)) y += dy;
  if (y === y0) return;
  // The Auger rolls, and Ouro falls to the new floor, which was a wall just now.
  field.shakeT = 10;
  const face0 = field.dir;
  while (field.y !== y) { field.stepWho('ouro', high ? 2 : 0, face0); await wait(5); }
  await wait(8);
  sound('bump');
  await act('ouro', 'shiver');
});

// ---------------------------------------------------------------- the stair, and the vents

// The lower stair winds up to Turnwise's landing. The upper stair, past the landing, has six vents in its walls.
const as = new Canvas(24, 20, '#');
as.rect(1, 17, 22, 2, '_').rect(20, 16, 2, 1, '_').rect(1, 15, 22, 1, '_').rect(1, 14, 2, 1, '_').rect(1, 13, 22, 1, '_');
as.put(2, 19, 'q').put(21, 12, 'q');
as.rect(10, 2, 4, 9, '_').put(12, 1, 'q');
for (const [x, y, w, h] of [[6, 17, 4, 2], [14, 13, 4, 1], [11, 9, 2, 1]]) as.rect(x, y, w, h, ',');
// vent k: wall tile, and the tide its wall is the floor at (null for out of reach)
const VENTS: { x: number; y: number; high: boolean | null }[] = [
  { x: 9, y: 9, high: false }, { x: 14, y: 8, high: true }, { x: 9, y: 7, high: false },
  { x: 14, y: 6, high: null }, { x: 9, y: 5, high: true }, { x: 14, y: 4, high: null },
];
const ventPlugged = (k: number) => !!flag('vent' + k);
const plugsLeft = () => (flag('plugsGot') ? 3 - [0, 1, 2, 3, 4, 5].filter(k => k !== 4 && ventPlugged(k)).length : 0);
defMap({
  id: 'augerstair', name: 'The Stair', region: 28, music: 'auger', strand: true,
  rows: as.rows(),
  warps: [
    { x: 2, y: 19, to: 'augerroll', tx: ROLL_EXIT, ty: 1, dir: 2 },
    { x: 21, y: 12, to: 'turnwisegym', tx: 6, ty: 10, dir: 2 },
    { x: 12, y: 1, to: 'augerpoint', tx: 6, ty: 14, dir: 2 },
  ],
  enter: 'a2StairEnter',
  zone: { kinds: kinds([['crimp', 3], ['chamois', 3], ['swift', 2], ['torr', 2], ['tumbleweed', 1], ['riser', 1], ['columella', 1]]), lv: [26, 32], n: 7, area: 'auger' },
  npcs: [
    person('a2StairSleeper', 12, 18, 'climber2', 'Stair-sleeper', 2, { trainer: { name: 'Stair-sleeper', team: [['columella', 30], ['chalk', 31]], intro: 'Wha. I sleep on the stair facing up. Great for the neck. Go away.', defeat: 'Back to sleep. Facing up. Night.', sight: 2 } }),
    person('a2SwiftKeeper', 9, 15, 'climber1', 'Swift-keeper', 1, { trainer: { name: 'Swift-keeper', team: [['swift', 29], ['gyre', 29]], intro: 'My swift never lands. Me neither, really. I\'m up here a lot.', defeat: 'We landed. Both of us. Huh.', sight: 3 } }),
    person('a2SaltScraper', 12, 7, 'climber2', 'Salt-scraper', 3, { trainer: { name: 'Salt-scraper', team: [['saltline', 30], ['groundswell', 30]], intro: 'The tide leaves a line on the wall. I scrape it off and it comes back higher. Every time!', defeat: 'Higher every roll. Ugh.', sight: 2 } }),
    person('a2PointWatcher', 11, 2, 'climber1', 'Point-watcher', 0, { talk: 'a2PointWatcher', trainer: { name: 'Point-watcher', team: [['zenith', 32], ['bourdon', 31]], intro: 'I sit beneath the point and listen to it not open. It does so with great consistency.', defeat: 'It might open. Some low, at three quavelings past the turn.', sight: 2 } }),
  ],
  spots: VENTS.map((v, k) => ({ x: v.x, y: v.y, script: () => ventScript(k) })),
});

defScript('a2StairEnter', async () => {
  if (highTide() && field.y < 11 && !flag('humTold')) { setFlag('humTold'); sound('wind'); await emote('ouro', 'music'); }
});

async function ventScript(k: number): Promise<void> {
  const v = VENTS[k];
  if (v.high === null || v.high !== highTide()) {
    face('ouro', 2);
    await emote('ouro', 'question');
    return;
  }
  if (k === 4 && !flag('found_as_vent')) {
    setFlag('found_as_vent');
    await act('ouro', 'shiver');
    sound('cut');
    await reward({ tan: 3 });
    return;
  }
  if (ventPlugged(k)) {
    if (await choose([`Pull the plug from vent ${k + 1}`, 'Leave it'], true) !== 0) return;
    setFlag('vent' + k, 0);
  } else {
    if (!plugsLeft()) { sound('wind'); await emote('ouro', flag('plugsGot') ? 'sweat' : 'question'); return; }
    if (await choose([`Plug vent ${k + 1} (${plugsLeft()} left)`, 'Leave it'], true) !== 0) return;
    setFlag('vent' + k);
  }
  sfx('switch');
  if (highTide()) await playVent();
}

/** At high tide the air leaves by the first open vent, and the Auger plays that vent's note. */
async function playVent(): Promise<void> {
  if (flag('tipOpen')) return;
  const first = [0, 1, 2, 3, 4, 5].find(k => !ventPlugged(k));
  if (first === undefined) return;
  if (first === 3) {
    setFlag('tipOpen');
    field.shakeT = 40;
    sfx('boom');
    // The whole Auger plays one long low note, and up the narrow way something cracks.
    ringBell(-12);
    await wait(60);
    sound('hitBig');
    await emote('a2PointWatcher', 'surprise');
    await say('Point-watcher', 'That is the one!! Go on, go up. You fit. I, regrettably, do not.');
    goal('Go up the narrow way to the point.');
    return;
  }
  field.shakeT = 8;
  sfx('wind');
  ringBell(first * 2);
  await emote('ouro', 'music');
  const word = ['one', 'two', 'three', 'four', 'five', 'six'][first];
  await say('Point-watcher', `That was hole ${word}. Low, but not low enough, by some two grumbles.`);
}
tideWatch.push(async () => { if (field.map.id === 'augerstair' && highTide() && field.y < 11) await playVent(); });

defScript('a2PointWatcher', async () => {
  if (flag('tipOpen')) { await say('Point-watcher', 'Up you go!! You fit. I exceed the narrow way by six and one quarter shoulders.'); return; }
  await say('Point-watcher', 'Three plugs. Six holes. The tip bears a groove four holes long, the apical furrow.');
  await say('Point-watcher', 'Air leaves by the first open hole. That hole is the note it plays. Elementary ventistics.');
  if (!flag('plugsGot')) { setFlag('plugsGot'); await notice('(The point-watcher hands Ouro three plugs of packed weed.)'); }
});

// ---------------------------------------------------------------- Turnwise's landing: the stride

// Each straight run carries Ouro one tile further than the last, starting at one. A run that stops early sends
// Ouro back to the edge. After the sixth run Ouro must stand at Turnwise. Checked with scratchpad stride.mjs:
// the only route is up 1, right 2, up 3, left 4, up 5, right 6, and five routes dead-end after five runs.
const STRIDE = [
  '#############',
  '#.........._#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#........p..#',
  '#...........#',
  '#......p....#',
  '#...........#',
  '#...........#',
  '#...p.......#',
  '######d######',
];
const GOAL = { x: 10, y: 1 }, EDGE = { x: 6, y: 10 };
let run = 1, runLeft = 0, runDir = -1, runsDone = 0;
const strideOn = () => !flag('strideDone');
defMap({
  id: 'turnwisegym', name: 'Turnwise\'s Landing', region: 28, music: 'auger', strand: true, indoor: true,
  rows: STRIDE.map(r => r.replace(/\./g, '_')),
  mods: [{ x: 10, y: 0, ch: 'q', when: () => !!flag('turnwiseGrain') }],
  warps: [
    { x: 6, y: 11, to: 'augerstair', tx: 21, ty: 13, dir: 2 },
    { x: 10, y: 0, to: 'augerstair', tx: 11, ty: 10, dir: 2, when: () => !!flag('turnwiseGrain') },
  ],
  enter: 'a2StrideEnter',
  npcs: [person('a2Turnwise', 11, 1, 'turnwise', 'Turnwise', 3, { when: () => !slid() })],
  spots: [look(11, 0, 'The stair goes on up past the landing, turning.')],
});

function strideReset(): void { run = 1; runLeft = 0; runDir = -1; runsDone = 0; }
defScript('a2StrideEnter', async () => {
  strideReset();
  if (flag('turnwiseSeen')) return;
  setFlag('turnwiseSeen');
  await act('a2Turnwise', 'look');
  faceToward('a2Turnwise', 'ouro');
  // Every line of Turnwise's climbs: each sentence one word longer than the one before.
  await say('Turnwise', 'Oh. You climb? Climb with me. I\'m just catching my.');
  await say('Turnwise', 'Turnwise. That\'s me. I keep this. I climb it every day. Never got to the top. Close, once.');
  await say('Turnwise', 'Stride. Then longer. Each run grows. One more tile than the one before.');
  await hint('(Each straight run carries you one tile further than the last. You turn only when a run ends.)');
});

async function strideFail(): Promise<void> {
  sfx('bump');
  field.shakeT = 6;
  await say('Turnwise', 'Nope. Start again. The stair resets. Back to one step.');
  await walkTo('ouro', EDGE.x, EDGE.y);
  face('ouro', 2);
  strideReset();
}

field.stepHooks.push(f => {
  if (f.map.id !== 'turnwisegym' || !strideOn() || f.busy) return;
  if (runLeft === 0) { runDir = f.dir; runLeft = run; }
  runLeft--;
  if (runLeft > 0) {
    const nx = f.x + [0, 1, 0, -1][runDir], ny = f.y + [1, 0, -1, 0][runDir];
    if (!f.passable(nx, ny)) { void f.runBusy(strideFail); return; }
    f.dir = runDir; f.x = nx; f.y = ny; f.moving = 8; f.uphill = false;
    return;
  }
  runsDone++;
  run++;
  if (f.x === GOAL.x && f.y === GOAL.y && runsDone === 6) { setFlag('strideDone'); sfx('level'); return; }
  if (runsDone >= 6) void f.runBusy(strideFail);
});

/** Turnwise's four. Ouro arrives with the Strand cap at 35. */
export const TURNWISE_TEAM: [string, number][] = [['crimp', 27], ['chamois', 27], ['zenith', 28], ['gyre', 29]];
defScript('a2Turnwise', async () => {
  if (flag('turnwiseGrain')) {
    await say('Turnwise', 'Higher. Go on, higher. The point\'s up there. Only small ones fit. You\'re small.');
    await say('Turnwise', 'Tell. Tell me. What\'s up there? Sixty years I\'ve climbed. I\'d like to. Know.');
    return;
  }
  if (!flag('strideDone')) { await say('Turnwise', 'Stride. Longer. Each run, one more. Than the last one. Phew.'); return; }
  await say('Turnwise', 'Fight. Fight me first. Then go higher. My four climb too. They\'re very. Fit.');
  await say('Turnwise', 'Tide. Sea tide. It gets in fights. High water fills the pool. Low water drops stars in instead.');
  if (!flag('seaBattles')) {
    G.flags.seaBattles = 1;
    await hint('(On the Strand at high tide, both sides start a battle with 3 tide.)');
    await hint('(At low tide both sides start with 0. Every 4th round a star lands and gives each side 2.)');
  }
  if (!(await keeperFight('Turnwise', TURNWISE_TEAM, 'Down. Back down you go. Climb again later. Everyone falls at first. I did. Lots.'))) return;
  setFlag('turnwiseGrain');
  await say('Turnwise', 'Yes. You climbed. Take this grain. It fell down here. Years back. Hff.');
  await giveGrain('Turnwise');
  await hint('(With three grains your whorls can reach Strand level 23.)');
  await say('Turnwise', 'Up. Go up. The point\'s above us. Only small ones fit up. There.');
  await say('Turnwise', 'Go on. Then tell me. What\'s it like up there? I\'ve been climbing it for sixty years.');
  goal('The vents are on the upper stair, past the landing.');
});

// ---------------------------------------------------------------- the point

// The last whorls, too narrow for anything grown. No wearing up here.
const ap = new Canvas(12, 16, '#');
for (const [x, y] of [[6, 15], [6, 14], [6, 13], [5, 13], [4, 13], [4, 12], [4, 11], [4, 10], [5, 10], [6, 10], [7, 10], [7, 9], [7, 8], [7, 7], [6, 7], [5, 7], [5, 6], [5, 5], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1]]) ap.put(x, y, '_');
ap.put(6, 15, 'q').put(6, 2, 'O').put(3, 12, ',').put(3, 11, ',').put(8, 8, ',').put(8, 9, ',').put(4, 6, ',');
const TIP = { x: 6, y: 2 };
defMap({
  id: 'augerpoint', name: 'The Point', region: 28, music: 'auger', strand: true,
  rows: ap.rows(),
  mods: [{ x: TIP.x, y: TIP.y, ch: '_', when: () => !!flag('tipOpen') }],
  warps: [{ x: 6, y: 15, to: 'augerstair', tx: 12, ty: 2, dir: 2 }],
  triggers: [{ x: 6, y: 1, w: 1, h: 1, script: 'a2PointView', when: () => !flag('pointView') }],
  enter: 'a2PointEnter',
  // Albatross is found only at the open point.
  zone: {
    kinds: kinds([['plummet', 3], ['zenith', 3], ['bourdon', 2], ['albatross', 1]]), lv: [28, 33], n: 3, area: 'auger',
    tideKinds: { high: kinds([['plummet', 3], ['zenith', 3], ['bourdon', 2]]), low: kinds([['plummet', 3], ['zenith', 3], ['bourdon', 2]]) },
  },
  // Turnwise comes up the narrow way when the Auger starts to slide.
  npcs: [person('a2TurnwisePoint', 6, 4, 'turnwise', 'Turnwise', 2, { when: () => !!flag('slideScene'), talk: undefined, movable: true })],
  spots: [
    { x: TIP.x, y: TIP.y, when: () => !flag('tipOpen'), script: async () => {
      await say('Groove', 'A groove round the sealed tip, as long as four vents.');
    } },
    { x: 7, y: 1, script: 'a2PointBoard' },
    { x: 5, y: 1, script: 'a2Albatross' },
  ],
});

defScript('a2PointEnter', async () => {
  field.wearing = false;
  if (!flag('pointTold')) {
    setFlag('pointTold');
    await hint('(Too narrow to wear a whorl. Your team stays in its horns.)');
  }
});
field.stepHooks.push(f => { if (f.map.id === 'augerpoint') f.wearing = false; });

defScript('a2PointView', async () => {
  setFlag('pointView');
  // Ouro puts head and shoulders out of the cracked tip into the night, and the whole Strand is below.
  sound('wind');
  face('ouro', 2);
  await act('ouro', 'hop');
  await tint('#0b0a10', 0.7, 40);
  await narr('Up the beach to the west lies the Volute, a pale spiral in the sand.');
  await narr('Down the beach the line of hollows runs to the sea, then turns east along the low-water line.');
  await narr('Partway along, the line stops, goes round twice in a small circle, and goes on.');
  await narr('Far off east, on the upper beach, there are rows of squares in the sand.');
  await narr('Past the rows, at the end of the beach, a great pink shell lies with its mouth to the sea.');
  await narr('The sky is very big up here. A faint seam runs round it in a spiral.');
  await tint('#0b0a10', 0, 40);
  if (smallGranHere()) {
    // Small Gran's next line comes out of her horn anyway, and the wind carries it out over the beach.
    await smallGranLine();
    sound('wind');
    setFlag('voiceOverBeach');
  }
  await slideTake();
});

// The Take: opening the point lets out the air that kept the Auger afloat. It slides off its dune.
async function slideTake(): Promise<void> {
  // Ouro starts back down. The air that kept the Auger up goes out through the point, whistling, and the floor tilts.
  face('ouro', 0);
  sound('wind');
  await wait(30);
  field.shakeT = 20;
  await act('ouro', 'shiver');
  // Turnwise comes up the narrow way fast, on hands and feet.
  setFlag('slideScene');
  offstage('a2TurnwisePoint');
  await walkIn('a2TurnwisePoint', 6, 14, 6, 3, 5);
  await act('a2TurnwisePoint', 'shiver');
  await say('Turnwise', 'Water. It\'s in. The sea\'s in. The point let it. In.');
  field.shakeT = 40;
  sfx('boom');
  await say('Turnwise', 'Hold. Hold on! We\'re going down. The whole Auger\'s sliding off the dune.');
  // Everything slides toward the mouth. The Auger slides off the dune into the sea, turns over once, and floats.
  await Promise.all([act('ouro', 'shiver'), act('a2TurnwisePoint', 'shiver')]);
  field.shakeT = 60;
  sfx('boom');
  await tint('#3060a0', 0.5, 30);
  for (let i = 0; i < 4; i++) { field.shakeT = 8; await wait(30); }
  // The ebb carries it along the beach until it grounds on sand with a long scrape.
  sound('guard');
  field.shakeT = 30;
  await tint('#3060a0', 0, 30);
  setFlag('augerSlid');
  setFlag('slideScene', 0);
  field.warp('augermouth', 10, 3, 0);
  offstage('a2TurnwiseMouth');
  await tint('#3060a0', 0.3, 0);
  await wait(16);
  // In the mouth room the water is knee deep and going out. Cinch never got up off the bottom step.
  await tint('#3060a0', 0, 60);
  faceToward('a2CinchStep', 'ouro');
  await cinch('Sit up on the step with me. Water\'s at my knees, and going.');
  await cinch('Felt every bump from here. Seven.');
  // Turnwise comes down last, out of breath.
  await walkIn('a2TurnwiseMouth', 10, 0, 12, 2);
  await act('a2TurnwiseMouth', 'shiver');
  faceToward('a2TurnwiseMouth', 'ouro');
  await say('Turnwise', 'Here. We\'re here. At the edge now. Right where the Gleaner walks. We\'ll climb every single low.');
  goal('Climb out at the mouth.');
}

// Starfall at the point: stars fall faster and pay double. The climbers keep a board of best scores.
defScript('a2PointBoard', async () => {
  if (!flag('pointView')) { await say('Slate', 'Best scores. Top: 48.'); return; }
  const tack = release() && flag('tackCount') ? 66 : 0;
  await say('Slate', `Best scores. Climbers: 48.${tack ? ' TACK: 66.' : ''} Ouro: ${G.flags.starfallPoint || 0}.`);
  if (await choose(['Catch stars', 'Not now'], true) !== 0) return;
  const score = await starfall({ speed: 1.5, pay: 2, bestKey: 'starfallPoint' });
  field.playMapMusic();
  if (tack && score > tack && !flag('tackPointBeat')) { setFlag('tackPointBeat'); await say('Tack', `${score}. That's over my 66. Fine. Scratching it in.`); }
});

defScript('a2Albatross', async () => {
  if (!flag('pointView') || flag('albatrossDone')) { sound('wind'); await emote('ouro', 'silence'); return; }
  // Something huge and white goes over the point, low, and lands on the shell beside the hole.
  sound('wind');
  await prop('albatross', 'mon:albatross', 5, 1, 12);
  await emote('ouro', 'surprise');
  await unprop('albatross', 0);
  if (!SPECIES.albatross) return;
  const r = await fightWild(mon('albatross', 32), { canRun: true, area: 'auger' });
  if (r.pegged.length) { r.pegged[0].strandBorn = true; setFlag('albatrossDone'); await giveMon(r.pegged[0]); }
  else if (r.result === 'win') setFlag('albatrossDone');
});

// ---------------------------------------------------------------- the voice over the beach (begins)

// The Eldest says "yesterday" or "this morning" in every line.
const eldestBefore = eldestHooks.later;
eldestHooks.later = async () => {
  if (await eldestBefore()) return true;
  if (!slid()) return false;
  if (flag('eldestBoot')) {
    await say('Eldest', '(yesterday it goes east, with everything else that goes)');
    return true;
  }
  setFlag('eldestBoot');
  await say('Eldest', 'Yesterday a voice comes over the beach from somewhere high up. A girl\'s.');
  await say('Eldest', 'This morning I will hear that voice on the bar. Seventy years ago, this morning.');
  await say('Eldest', '(yesterday a girl comes down the beach with a pale one the same size beside her)');
  await say('Eldest', 'Yesterday the girl talks to the pale one. The pale one answers her wrong, very politely.');
  await say('Eldest', 'This morning she will take one boot off on the bar to tip the sand out. It will be low water.');
  await say('Eldest', '(yesterday the Gleaner comes by, and the boot goes. she goes home hopping)');
  await choose(['Which boot?']);
  await say('Eldest', 'The left, yesterday. This morning I\'ll say the right. Don\'t trust this morning.');
  await say('Eldest', 'Yesterday it goes east, with everything else that goes east.');
  await reward({ tan: 2 });
  return true;
};

void grains;
