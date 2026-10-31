// Act 2, chapter 3: the Auger. Its dune, the mouth room, the rolling rooms, the stair and the vents,
// Turnwise's landing, and the point. The Take slides the Auger down to the low-water line.
// Side missions: the voice over the beach (begins), and Tack's count (release). See Notes/act2-script.md.
import { sfx } from '../../engine/audio';
import { text } from '../../engine/font';
import { rect } from '../../engine/screen';
import { PEOPLE } from '../../engine/sprites';
import { SPECIES } from '../../data/species';
import { act, choose, emote, face, faceToward, field, fightWild, giveKey, giveMon, goal, hint, mon, narr, notice, offstage, pan, panBack, prop, say, sound, tint, unprop, wait, walkIn, walkOff, walkTo } from '../../game/api';
import { starfall } from '../../game/minigames/starfall';
import { G, flag, setFlag } from '../../game/state';
import { bell as ringBell } from '../../game/api';
import { DIM, SEL } from '../../game/ui';
import { defMap, defScript, MAPS, type MapDef } from '../../game/world';
import { GRAPH_PUZZLES, type Move } from '../../tools/worldcheck';
import { Canvas, highTide, kinds, look, reward, stash } from '../areakit';
import { smallGranLine } from '../ch1';
import { hallTop } from '../puzzlekit';
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
    kinds: kinds([['gyre', 3], ['lichen', 3], ['groundswell', 2], ['skitter', 2]]), lv: [12, 15], n: 9, area: 'strand',
    tideKinds: { high: kinds([['groundswell', 3], ['gyre', 2]]), low: kinds([['lichen', 3], ['gyre', 2], ['skitter', 2]]) },
  },
  npcs: [
    person('a2OutsideClimber', 19, 9, 'climber1', 'Climber on the outside', 1, { when: () => !slid() }),
    person('a2DuneSitter', 26, 13, 'beach4', 'Dune-sitter', 3, { trainer: { name: 'Dune-sitter', team: [['lichen', 14], ['groundswell', 15]], intro: 'The dune shifts a foot with every tide, so I move my chair a foot. We\'re square.', defeat: 'I\'ll slide my chair back a foot. Square again.', sight: 3 } }),
  ],
  spots: [
    { x: 14, y: 14, script: 'a2RollTally' },
    { x: 30, y: 5, script: 'a2PointBelow' },
    stash('ad_point', 31, 6, 'Tucked in the sand beneath the overhang, near the drop-off, lies a nautilus horn.', { pegs: ['iron', 1] }),
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
  await say('Climber on the outside', 'Don\'t try this route! Enter at the base and climb the inner face. Do it like a sensible person.');
  await say('Climber on the outside', 'We tally our rolls out here. That\'s the only use for the outside: keeping count.');
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
  zone: { kinds: kinds([['chalk', 3], ['saltline', 3]]), lv: [12, 15], n: 4, area: 'auger' },
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
    look(15, 3, 'A rack of small, shell-carved bells hangs nearby. Each one bears a unique chip along its rim.'),
    { x: BOWLS_LOW[0], y: BOWLS_LOW[1], script: 'a2Bowls' }, { x: BOWLS_HIGH[0], y: BOWLS_HIGH[1], script: 'a2Bowls' },
    look(2, 6, 'Wall-mounted bunks stacked one above the other. Some are equipped with straps.'),
    look(17, 6, 'Bunks line this wall as well, with blankets neatly folded on both sides.'),
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
  await cinch('Phew. Take a seat here for a moment. That was quite a climb.');
  await cinch('The bottom step offers the best acoustics. You can hear every one of them scrambling up there.');
  goal('Ascend the Auger from the interior.');
});

defScript('a2Bowls', async () => { await emote('ouro', 'silence'); });

defScript('a2CinchStep', async () => {
  if (slid()) { await cinch('Step up. The water\'s at my knees, but it\'s moving.'); await cinch('I felt every jolt from this step. Number seven. Solid step.'); return; }
  await cinch('The stairs will still be here if you take a seat. They always are.');
  await cinch('Hear that? Sit on the lowest step and you can hear them all climbing.');
});

// Climbers, deadpan. When the tide rolls the Auger, the floor's the wall and their lines change.
function climber(id: string, name: string, l: { low: string[]; high?: string[]; slid?: string[] }): void {
  defScript(id, async () => { await sayAll(name, (slid() && l.slid) || (highTide() && l.high) || l.low); });
}
climber('a2ClWoman', 'Woman', { low: ['We climb all day. Then we sleep on the stairs at night, facing upward. Facing up matters.'], high: ['We rolled over again. Up is still up, at least. Everything else shifted.'], slid: ['We\'ll climb every low now. Even Gran. She\'s furious.'] });
climber('a2ClMan', 'Man', { low: ['When the tide rolls the Auger over, the floor becomes the wall. You learn to sleep on both.'], high: ['We rolled. My bunk is now the ceiling. Move over. I\'m sleeping in yours.'] });
climber('a2ClOldMan', 'Old man', { low: ['No one has ever reached the point. It\'s too narrow for any grown person.', 'Definitely too narrow for me.', 'Low water, so climb. Climbing keeps the water down. That\'s what my dad said.'], slid: ['It\'s never been down here before. There\'s the sea. Right there.'] });
climber('a2ClGirl', 'Girl', { low: ['My bowl is on the low side. Everyone\'s bowl is on the low side. Bowls roll.', 'Everybody up the stairs. And down. And up. My legs!!'] });
climber('a2ClBoy', 'Boy', { low: ['We all climb at once and the whole Auger shakes. It\'s the best part of the low.'], high: ['High water. Hear that hum in the stairs? That\'s the air. Hmmmmm.'] });

defScript('a2BellKeeper', async () => {
  if (G.keys.includes('handbell')) { await say('Bell-keeper', 'We ring the bell from in here to start the tide. Saves a trek to the posts.');
  await say('Bell-keeper', 'It\'s lazy, but effective.'); return; }
  await say('Bell-keeper', 'We call the tide from in here when it\'s time to go. Beats walking out to the posts.');
  await say('Bell-keeper', 'Here, take a spare. It rings the tide no matter where you stand on the beach. Don\'t lose it.');
  giveKey('handbell');
  sfx('level');
  await notice('(Ouro takes the hand bell. Ring it anywhere on the Strand to turn the tide.)');
});

defScript('a2RungSkipper', async () => {
  await strandBoard({
    id: 'a2peg3', name: 'Rung-skipper', deck: ['crimp', 'chamois', 'riser', 'tumbleweed', 'zenith'], tier: 7, prize: 'climbingchalk',
    lines: ['I take every other step. It\'s faster. It ruins my knees.', 'The wet row is always the lowest one, no matter which way we\'ve rolled.'],
  });
});

// Tack says a number in every line. Release only.
defScript('a2TackStep', async () => {
  if (flag('tackCount')) { await say('Tack', '4,000 steps. And 1 of them\'s mine. I\'m keeping it.'); return; }
  if (flag('pointView')) {
    await say('Tack', '3,909 for me. you climbed the last 91 without me. Too narrow. Rude.');
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
  await say('Tack', 'Climbers say it\'s 4,000 to the point. Nobody\'s actually counted. So, I did.');
});

defScript('a2TurnwiseMouth', async () => { await say('Turnwise', 'Climb. We\'re climbing. Everyone climbs now. It puts climbers back down.'); });

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
    person('a2Tumbler', 13, 2, 'climber2', 'Tumbler', 2, { trainer: { nacre: 1, name: 'Tumbler', team: [['tumbleweed', 15], ['riser', 15]], intro: 'Every roll I end up on the other wall. My lunch too. My lunch gets there first.', defeat: 'Rolled. Over.', sight: 2 } }),
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

// The lower stair winds up to Turnwise's landing. The upper stair, past the landing, has six vents in its walls, counted
// up from the bottom. The west wall is the floor at low tide and the east wall at high tide, so Ouro reaches the west
// vents at low water and the east vents at high water. When the tide comes in, and whenever a plug goes in or out at high
// water, the air leaves by the first open vent and sounds it. Ouro has three plugs. The tip opens when the vents sound
// the groove's notches in a row: four, two, four, one, four. A wrong note starts the groove over.
// The insight: with plugs in west vents one and three, the plug in east vent two alone moves the note between two and
// four at high water, so one tide plays the first three notches. Vent one's plug comes out at low water for the fourth
// notch and goes back for the fifth.
// Fewest moves: 12, counting each plug, pull, and turn of the tide ('The vents' in worldcheck).
const as = new Canvas(24, 20, '#');
as.rect(1, 17, 22, 2, '_').rect(20, 16, 2, 1, '_').rect(1, 15, 22, 1, '_').rect(1, 14, 2, 1, '_').rect(1, 13, 22, 1, '_');
as.put(2, 19, 'q').put(21, 12, 'q');
as.rect(10, 2, 4, 9, '_').put(12, 1, 'q');
for (const [x, y, w, h] of [[6, 17, 4, 2], [14, 13, 4, 1], [11, 9, 2, 1]]) as.rect(x, y, w, h, ',');
// A tide bell at the foot of the vents, so the tide can be turned where the notes are heard.
const VENT_BELL = { x: 13, y: 10 };
as.put(VENT_BELL.x, VENT_BELL.y, 'U');
// vent k: its wall tile, and whether its wall is the floor at high tide (east) or low tide (west)
const VENTS: { x: number; y: number; high: boolean }[] = [
  { x: 9, y: 9, high: false }, { x: 14, y: 8, high: true }, { x: 9, y: 7, high: false },
  { x: 14, y: 6, high: true }, { x: 9, y: 5, high: false }, { x: 14, y: 4, high: true },
];
const SONG = [3, 1, 3, 0, 3];
const PLUGS = 3;
const ventPlugged = (k: number) => !!flag('vent' + k);
const plugsLeft = () => (flag('plugsGot') ? PLUGS - VENTS.filter((_, k) => ventPlugged(k)).length : 0);
const VENT_WORD = ['one', 'two', 'three', 'four', 'five', 'six'];
const firstOpen = (plugged: (k: number) => boolean) => VENTS.findIndex((_, k) => !plugged(k));
/** The groove's progress after vent `note` sounds with `p` notches already played in a row. */
const sing = (p: number, note: number) => (note === SONG[p] ? p + 1 : note === SONG[0] ? 1 : 0);
defMap({
  id: 'augerstair', name: 'The Stair', region: 28, music: 'auger', strand: true,
  rows: as.rows(),
  warps: [
    { x: 2, y: 19, to: 'augerroll', tx: ROLL_EXIT, ty: 1, dir: 2 },
    { x: 21, y: 12, to: 'turnwisegym', tx: 6, ty: 10, dir: 2 },
    { x: 12, y: 1, to: 'augerpoint', tx: 6, ty: 14, dir: 2 },
  ],
  enter: 'a2StairEnter',
  zone: { kinds: kinds([['crimp', 3], ['chamois', 3], ['swift', 2], ['torr', 2], ['tumbleweed', 1], ['riser', 1], ['columella', 1]]), lv: [13, 16], n: 7, area: 'auger' },
  npcs: [
    person('a2StairSleeper', 12, 18, 'climber2', 'Stair-sleeper', 2, { trainer: { name: 'Stair-sleeper', team: [['columella', 15], ['chalk', 16]], intro: 'Huh? I nap on the stairs, face-up. It\'s perfect for my neck. Buzz off.', defeat: 'Back to snoozing. Face up. Goodnight.', sight: 2 } }),
    person('a2SwiftKeeper', 9, 15, 'climber1', 'Swift-keeper', 1, { trainer: { name: 'Swift-keeper', team: [['swift', 15], ['gyre', 15]], intro: 'My swift never comes down. Same here. I spend most of my time up here.', defeat: 'We both made it down. Weird.', sight: 3 } }),
    person('a2SaltScraper', 12, 7, 'climber2', 'Salt-scraper', 3, { trainer: { nacre: 1, name: 'Salt-scraper', team: [['saltline', 15], ['groundswell', 15]], intro: 'The tide marks the wall. I scrape it off, but it returns higher. Again!', defeat: 'Higher with every wave. So annoying.', sight: 2 } }),
    person('a2PointWatcher', 11, 2, 'climber1', 'Point-watcher', 0, { talk: 'a2PointWatcher', trainer: { name: 'Point-watcher', team: [['zenith', 16], ['bourdon', 16]], intro: 'I remain below the point, listening to its steadfast refusal to open.', defeat: 'It might open yet. Perhaps when the tide is low, three quavelings past the turn.', sight: 2 } }),
  ],
  spots: [...VENTS.map((v, k) => ({ x: v.x, y: v.y, script: () => ventScript(k) })), bell(VENT_BELL.x, VENT_BELL.y)],
});

/** The vents in the walls, with their plugs, and the groove's notches in the corner as they are played. */
function ventOverlay(f: typeof field): void {
  if (f.map.id !== 'augerstair' || flag('tipOpen')) return;
  const [cx, cy] = f.cam;
  VENTS.forEach((v, k) => {
    const x = v.x * 8 - cx, y = v.y * 8 - cy;
    rect(x + 2, y + 2, 4, 4, '#1a1008');
    if (ventPlugged(k)) { rect(x + 2, y + 2, 4, 4, '#3a6a2a'); rect(x + 3, y + 3, 2, 1, '#6aa84a'); }
  });
  if (!flag('plugsGot')) return;
  const p = flag('ventSong');
  SONG.forEach((n, i) => text(String(n + 1), 3 + i * 7, 3, i < p ? SEL : DIM, '#0b0a10'));
}

// A loaded game skips the enter script, so the first step puts the vents back on the walls.
field.stepHooks.push(f => { if (f.map.id === 'augerstair' && f.overlay !== ventOverlay) f.overlay = ventOverlay; });

defScript('a2StairEnter', async () => {
  // Walking out and back starts the groove over.
  setFlag('ventSong', 0);
  field.overlay = ventOverlay;
  if (highTide() && field.y < 11 && !flag('humTold')) { setFlag('humTold'); sound('wind'); await emote('ouro', 'music'); }
});

async function ventScript(k: number): Promise<void> {
  const v = VENTS[k];
  if (v.high !== highTide()) {
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
    if (await choose([`Remove the plug from vent ${k + 1}`, 'Leave it alone'], true) !== 0) return;
    setFlag('vent' + k, 0);
  } else {
    if (!plugsLeft()) { sound('wind'); await emote('ouro', flag('plugsGot') ? 'sweat' : 'question'); return; }
    if (await choose([`Plug vent ${k + 1} (${plugsLeft()} remaining)`, 'Leave it alone'], true) !== 0) return;
    setFlag('vent' + k);
  }
  sfx('switch');
  if (highTide()) await playVent();
}

/** At high tide the air leaves by the first open vent, the Auger plays that vent's note, and the groove counts it. */
async function playVent(): Promise<void> {
  if (flag('tipOpen')) return;
  const first = firstOpen(ventPlugged);
  if (first < 0) return;
  const was = flag('ventSong'), p = sing(was, first);
  setFlag('ventSong', p);
  if (p === SONG.length) {
    setFlag('tipOpen');
    field.shakeT = 40;
    sfx('boom');
    // The whole Auger plays one long low note, and up the narrow way something cracks.
    ringBell(-12);
    await wait(60);
    sound('hitBig');
    await emote('a2PointWatcher', 'surprise');
    await say('Point-watcher', 'That\'s the one! Climb up. You\'ll fit. I, unfortunately, do not.');
    goal('Ascend the narrow passage to the point.');
    return;
  }
  field.shakeT = 8;
  sfx('wind');
  ringBell(first * 2);
  await emote('ouro', 'music');
  const word = VENT_WORD[first];
  if (p > was || p === 1) await say('Point-watcher', `Vent ${word}!! Notch ${p} of five. Onward, with melody.`);
  else if (was) await say('Point-watcher', `Vent ${word}. That groove holds no notch there. Not from the beginning.`);
  else await say('Point-watcher', `Vent ${word}. Not the groove's first notch, off by about two grumbles.`);
}
tideWatch.push(async () => { if (field.map.id === 'augerstair' && highTide() && field.y < 11) await playVent(); });

// The vents for the puzzle checks: which vents hold plugs (a bit each), the tide, and the notches sounded in a row.
type VentState = { pl: number; t: number; p: number };
function ventMoves(s: VentState): Move<VentState>[] {
  if (s.p === SONG.length) return [];
  const sounds = (pl: number) => sing(s.p, firstOpen(k => !!(pl >> k & 1)));
  const out: Move<VentState>[] = [{ to: { pl: s.pl, t: 1 - s.t, p: s.t ? s.p : sounds(s.pl) }, cost: 1 }];
  const used = VENTS.filter((_, k) => s.pl >> k & 1).length;
  VENTS.forEach((v, k) => {
    if (v.high !== !!s.t) return;
    const on = s.pl >> k & 1;
    if (!on && used >= PLUGS) return;
    const pl = s.pl ^ (1 << k);
    out.push({ to: { pl, t: s.t, p: s.t ? sounds(pl) : s.p }, cost: 1 });
  });
  return out;
}
GRAPH_PUZZLES.push({
  name: 'The vents', floor: 10,
  start: { pl: 0, t: 0, p: 0 },
  key: (s: VentState) => (s.pl * 2 + s.t) * (SONG.length + 1) + s.p,
  moves: ventMoves,
  goal: (s: VentState) => s.p === SONG.length,
  exit: () => true,
  show: (s: VentState) => `plugs ${s.pl.toString(2)} ${s.t ? 'high' : 'low'} notches ${s.p}`,
  prize: { map: 'augerstair', at: [12, 1], view: [11, 10], named: 'a2PointWatcher' },
});

defScript('a2PointWatcher', async () => {
  if (flag('tipOpen')) { await say('Point-watcher', 'Up you go! You fit. I exceed the narrow way by six and one-quarter shoulders.'); return; }
  await say('Point-watcher', 'Three plugs. Six vents, counted from the bottom. The tip above features a notched groove.');
  await say('Point-watcher', 'The notches read four, two, four, one, four. Sound them in that order, and the tip opens.');
  await say('Point-watcher', 'When the tide rises, air escapes through the first open vent, creating a sound. Ventistics.');
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
  spots: [look(11, 0, 'The staircase continues upward past the landing, winding around a corner.')],
});

function strideReset(): void { run = 1; runLeft = 0; runDir = -1; runsDone = 0; }
defScript('a2StrideEnter', async () => {
  strideReset();
  if (flag('turnwiseSeen')) return;
  setFlag('turnwiseSeen');
  await act('a2Turnwise', 'look');
  faceToward('a2Turnwise', 'ouro');
  // Every line of Turnwise's climbs: each sentence one word longer than the one before.
  await say('Turnwise', 'Oh. You\'re climbing? Climb with me. I\'m just catching my...');
  await say('Turnwise', 'Turnwise. That\'s my name. I maintain this. I climb it every day. Never quite made it to the top.');
  await say('Turnwise', 'Got close, once.');
  await say('Turnwise', 'Stride. Then go longer. Each ascent gets bigger. One more tile than the last.');
  await hint('(Each straight run carries you one tile further than the last. You turn only when a run ends.)');
});

async function strideFail(): Promise<void> {
  sfx('bump');
  field.shakeT = 6;
  await say('Turnwise', 'No. Start over. The stairs reset. Back to a single step.');
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
  if (f.x === GOAL.x && f.y === GOAL.y && runsDone === 6) { setFlag('strideDone'); void f.runBusy(hallTop('turnwise', 'a2Turnwise')); return; }
  if (runsDone >= 6) void f.runBusy(strideFail);
});

/** Turnwise's four. Ouro arrives with the Strand cap at 18. */
export const TURNWISE_TEAM: [string, number][] = [['crimp', 14], ['chamois', 14], ['zenith', 14], ['gyre', 15]];
defScript('a2Turnwise', async () => {
  if (flag('turnwiseGrain')) {
    await say('Turnwise', 'Higher. Go on, higher. The Auger\'s tip is up there. Only small ones fit. You\'re small.');
    await say('Turnwise', 'Tell me. Tell me. What\'s up there? I\'ve climbed for sixty years. I\'d like to... know.');
    return;
  }
  if (!flag('strideDone')) { await say('Turnwise', 'Stride. Longer. Each run, one more. Than the previous. Phew.'); return; }
  await say('Turnwise', 'Fight. Fight me first. Then go higher. My four climb too. They\'re very... fit.');
  await say('Turnwise', 'Tide. Sea tide. It joins the fray. High water fills the pool. Low water drops stars in instead.');
  if (!flag('seaBattles')) {
    G.flags.seaBattles = 1;
    await hint('(On the Strand at high tide, both sides start a battle with 3 tide.)');
    await hint('(At low tide both sides start with 0. Every 4th round a star lands and gives each side 2.)');
  }
  if (!(await keeperFight('Turnwise', TURNWISE_TEAM, 'Down. Go back down. Climb later. Everyone falls. I did, often.'))) return;
  setFlag('turnwiseGrain');
  await say('Turnwise', 'Yes. You climbed. Take this grain. It fell down here. Years ago. Hff.');
  await giveGrain('Turnwise');
  await hint('(With three grains your Whorls can reach Strand level 23.)');
  await say('Turnwise', 'Upward. Keep going up. The summit is above us. Only the smaller figures can make the ascent.');
  await say('Turnwise', 'There it is.');
  await say('Turnwise', 'Proceed. Then, describe it to me. What is the view like from the top?');
  await say('Turnwise', 'I have been scaling this structure for six decades.');
  goal('The ventilation shafts are located on the upper staircase, beyond the landing.');
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
    kinds: kinds([['plummet', 3], ['zenith', 3], ['bourdon', 2], ['albatross', 1]]), lv: [14, 17], n: 3, area: 'auger',
    tideKinds: { high: kinds([['plummet', 3], ['zenith', 3], ['bourdon', 2]]), low: kinds([['plummet', 3], ['zenith', 3], ['bourdon', 2]]) },
  },
  // Turnwise comes up the narrow way when the Auger starts to slide.
  npcs: [person('a2TurnwisePoint', 6, 4, 'turnwise', 'Turnwise', 2, { when: () => !!flag('slideScene'), talk: undefined, movable: true })],
  spots: [
    { x: TIP.x, y: TIP.y, when: () => !flag('tipOpen'), script: async () => {
      await say('Groove', 'A circular groove encircles the sealed tip, featuring notches in a sequence of four, two, four,');
      await say('Groove', 'one, and four.');
    } },
    { x: 7, y: 1, script: 'a2PointBoard' },
    { x: 5, y: 1, script: 'a2Albatross' },
  ],
});

defScript('a2PointEnter', async () => {
  field.wearing = false;
  if (!flag('pointTold')) {
    setFlag('pointTold');
    await hint('(The space is too narrow for a Whorl. Your team remains within its horns.)');
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
  await narr('To the west along the beach lies the Volute, a pale spiral etched into the sand.');
  await narr('Further down the beach, the line of hollows runs to the sea,');
  await narr('then turns east along the low-water line.');
  await narr('Midway along this line, the pattern halts, circles twice in a small loop, and then resumes.');
  await narr('Far off to the east, on the upper beach, rows of squares are visible in the sand.');
  await narr('Beyond these rows, at the beach\'s end, a massive pink shell rests with its opening facing the sea.');
  await narr('The sky seems immense from this height. A faint seam spirals around it.');
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
  await say('Turnwise', 'Water. It has entered. The sea is inside. The point allowed it in.');
  field.shakeT = 40;
  sfx('boom');
  await say('Turnwise', 'Steady! Hold fast! We are descending. The entire Auger is sliding off the dune.');
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
  await cinch('Sit up on the step beside me. The water is at my knees, and it is moving.');
  await cinch('I felt every single impact from this spot. Seven of them.');
  // Turnwise comes down last, out of breath.
  await walkIn('a2TurnwiseMouth', 10, 0, 12, 2);
  await act('a2TurnwiseMouth', 'shiver');
  faceToward('a2TurnwiseMouth', 'ouro');
  await say('Turnwise', 'Here. We\'re here. At the edge now. Right where the Gleaner walks.');
  await say('Turnwise', 'We\'ll climb every single low water.');
  goal('Emerge at the mouth.');
}

// Starfall at the point: stars fall faster and pay double. The climbers keep a board of best scores.
defScript('a2PointBoard', async () => {
  if (!flag('pointView')) { await say('Slate', 'Top marks. Leader: 48.'); return; }
  const tack = release() && flag('tackCount') ? 66 : 0;
  await say('Slate', `Top marks. Climbers: 48.${tack ? ' TACK: 66.' : ''} Ouro: ${G.flags.starfallPoint || 0}.`);
  if (await choose(['Catch stars', 'Not now'], true) !== 0) return;
  const score = await starfall({ speed: 1.5, pay: 2, bestKey: 'starfallPoint' });
  field.playMapMusic();
  if (tack && score > tack && !flag('tackPointBeat')) { setFlag('tackPointBeat'); await say('Tack', `${score}. That's over my 66. Fine. I'm scratching it in.`); }
});

defScript('a2Albatross', async () => {
  if (!flag('pointView') || flag('albatrossDone')) { sound('wind'); await emote('ouro', 'silence'); return; }
  // Something huge and white goes over the point, low, and lands on the shell beside the hole.
  sound('wind');
  await prop('albatross', 'mon:albatross', 5, 1, 12);
  await emote('ouro', 'surprise');
  await unprop('albatross', 0);
  if (!SPECIES.albatross) return;
  const r = await fightWild(mon('albatross', 16), { canRun: true, area: 'auger' });
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
    await say('Eldest', '(yesterday everything drifts east, as all things do)');
    return true;
  }
  setFlag('eldestBoot');
  await say('Eldest', 'Yesterday, a voice drifted down from somewhere high up across the beach. It was a girl\'s voice.');
  await say('Eldest', 'I\'ll hear that voice on the bar this morning. This morning was seventy years ago.');
  await say('Eldest', '(yesterday, a girl walked down the beach, accompanied by a pale figure of equal size)');
  await say('Eldest', 'Yesterday, the girl spoke to the pale one.');
  await say('Eldest', 'The pale one replied incorrectly, with excessive politeness.');
  await say('Eldest', 'This morning, she\'ll pull off one boot on the bar to shake out the sand. It\'s low water.');
  await say('Eldest', '(yesterday, the Gleaner passed by, and the boot was lost. she hopped home)');
  await choose(['Which boot?']);
  await say('Eldest', 'Yesterday, the left. This morning, I\'ll claim it was the right.');
  await say('Eldest', 'Do not trust what I say this morning.');
  await say('Eldest', 'Yesterday, it moved east, with all the rest that drift eastward.');
  await reward({ tan: 2 });
  return true;
};

void grains;
