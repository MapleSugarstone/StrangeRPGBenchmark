// Act 2, chapter 5: the Tray. See Notes/act2-script.md.
// Maps: the spring low, the Long Strand, the Tray, the Mudlark's yard, the Hollow Top, and the old Apex (release).
import { sfx } from '../../engine/audio';
import { music } from '../../engine/music';
import { PEOPLE } from '../../engine/sprites';
import type { Mon, SpriteData } from '../../battle/model';
import { SPECIES } from '../../data/species';
import { act, bell, choose, emote, evening, face, faceToward, fadeWho, field, fightWild, giveKey, giveMon, goal, hint, liftOff, mon, morphTo, moveNpc, narr, notice, npcAt, offstage, pan, panBack, prop, say, shake, sound, tint, unprop, wait, walkIn, walkOff, walkTo, warp } from '../../game/api';
import { starfall } from '../../game/minigames/starfall';
import { G, flag, save, setFlag } from '../../game/state';
import { strandFx } from '../../game/strandfx';
import { defMap, defScript, MAPS, SCRIPTS, type NpcDef } from '../../game/world';
import { Canvas, highTide, kinds, look, reward, stash, tideMods } from '../areakit';
import { FOOTPRINTS, giveGrain, sweepAll } from './kit';
import {
  cinch, frameHook, granSpeaks, grainLine, hold, keeperFight, kindSprite, lowWater, ownsKind, pale, release, setTide,
  smallGranOut, startFrameHook, strandRematch, type Mod, type Spot,
} from './ch4';

const inSpringLow = () => !!flag('springLow') && !flag('springHigh');
/** During the spring low the sea stays out. A post bell rung somewhere else does not reach this far. */
function keepSpringLow(): void { if (inSpringLow() && highTide()) setTide(false); }

/** Moves a prop by name on the map Ouro is on. */
function propAt(pic: string, x: number, y: number, tag?: string): void {
  const p = field.map.props?.find(q => q.pic === pic && (!tag || (q as any).tag === tag));
  if (p) { p.x = x; p.y = y; }
}
let scene: Record<string, boolean> = {};
const shown = (k: string) => () => !!scene[k];

/** The notes of the tune a world-shell plays when Ouro puts an ear to it. */
const TUNE = [0, 4, 7, 9, 7, 4, 2, 0];
/** Plays a shell's tune on far bells: with `gaps`, some notes are missing, and with `steps`, small footsteps run under it. */
export async function shellTune(gaps: boolean, steps = false, low = 0): Promise<void> {
  await act('ouro', 'bow');
  for (const [i, n] of TUNE.entries()) {
    if (!gaps || i % 3 !== 1) bell(n - low);
    if (steps && i % 2 === 0) sound('step');
    await wait(16);
  }
  await emote('ouro', gaps ? 'question' : 'music');
}

/** Slides a map prop from one row to another, a row every few frames, as a hand coming down or going up. */
async function slideProp(pic: string, x: number, fromY: number, toY: number, frames = 6): Promise<void> {
  const p = field.map.props?.find(q => q.pic === pic && q.x === x);
  const step = toY > fromY ? 1 : -1;
  for (let y = fromY; y !== toY + step; y += step) { if (p) p.y = y; await wait(frames); }
}

/** Stars land one after another along a line, each with a slow step of the ground. */
async function starLine(points: [number, number][], gap = 20): Promise<void> {
  for (const [x, y] of points) {
    field.shakeT = 8;
    sfx('boom');
    strandFx.landings.push({ x, y, t: 0 });
    await wait(gap);
  }
}

// ---------------------------------------------------------------- the spring low

// The Low Line at the lowest tide of the year: the same ground with the sea gone out past the wreck.
const sl = new Canvas(56, 20, '.').border('#');
sl.rect(1, 16, 54, 3, '.').rect(22, 15, 9, 2, 'e').rect(24, 17, 4, 1, 'e');
sl.rect(14, 1, 6, 2, ',').rect(46, 1, 6, 2, ',').rect(4, 16, 12, 2, ',').rect(36, 17, 10, 1, ',');
for (const y of [13, 17]) for (let x = 2; x < 54; x += 3) if (sl.at(x, y) === '.') sl.put(x, y, 'x');
sl.rect(4, 7, 12, 1, 'r').rect(3, 8, 15, 1, 'r').rect(2, 9, 16, 1, 'h').rect(2, 10, 15, 1, 'h').rect(3, 11, 7, 1, 'h').put(6, 11, 'd');
sl.rect(39, 5, 5, 1, 'r').rect(37, 6, 9, 1, 'r').rect(36, 7, 11, 1, 'r').rect(36, 8, 11, 1, 'h').rect(36, 9, 11, 1, 'h').rect(37, 10, 9, 1, 'h').rect(39, 11, 5, 1, 'h').put(41, 11, 'd');
sl.put(30, 6, 'p').put(55, 2, '.').put(55, 3, '.');
for (const x of [52, 46, 40, 34, 28, 22, 16, 10, 4]) sl.put(x, 15, sl.at(x, 15) === 'e' ? 'e' : 'b');
FOOTPRINTS.springlow = [52, 46, 40, 34, 28, 22, 16, 10, 4].map(x => [x, 14] as [number, number]);

defMap({
  id: 'springlow', name: 'The spring low', region: 25, music: 'strand', strand: true,
  rows: sl.rows(),
  warps: [
    { x: 41, y: 11, to: 'livingchamber', tx: 11, ty: 12, dir: 2 },
    { x: 55, y: 2, to: 'longstrand', tx: 1, ty: 3, dir: 1 }, { x: 55, y: 3, to: 'longstrand', tx: 1, ty: 4, dir: 1 },
  ],
  enter: 'springEnter',
  props: [
    { x: 50, y: 13, pic: 'gleanerFoot', when: shown('footL') },
    { x: 50, y: 15, pic: 'gleanerFoot', when: shown('footR') },
    { x: 6, y: 5, pic: 'gleanerHand', when: shown('hand') },
  ],
  zone: { kinds: kinds([['cuttle', 3], ['medusa', 3], ['grenadier', 2]]), lv: [44, 52], n: 10, area: 'strand' },
  npcs: [
    { id: 'slgran', x: 42, y: 13, sprite: 'smallgran', name: 'Small Gran', dir: 2, when: shown('gran') },
    { id: 'slclimber', onSolid: true, x: 9, y: 7, sprite: 'climber2', name: 'Woman (climbing)', dir: 0, lines: ['Up. And down. Up. And down. My knees have opinions about the big low.'] },
  ],
  spots: [
    look(6, 11, 'Inside, every climber is climbing at once. The stair is full. (someone is going down the up side)'),
    look(26, 14, 'A whole wreck, lying on its side on sand nobody here has seen dry.', 'Weed lies flat over it. Something in the hold is breathing slowly.'),
    look(30, 6, 'The anchor stone. The sea is so far out that its hole is full of stars.'),
  ],
});

defScript('springEnter', async () => {
  keepSpringLow();
  if (flag('springScene')) return;
  setFlag('springScene');
  scene = {};
  // Chapter 4 ends as Ouro comes out under the hood. The sea goes out further than anyone has seen, past a whole wreck,
  // and far off at the east end of the beach something moves at the pink shell.
  await pan(26, 15);
  await wait(30);
  await pan(50, 12);
  await shake(20);
  await panBack();
  // Chapter 5 begins. A long while later the ground shakes again, and stars come down from the east, getting closer.
  await wait(40);
  await shake(14);
  music.play('collector');
  await starLine(FOOTPRINTS.springlow.slice(0, 3), 30);
  // Behind Ouro the climbers go up and down the Auger all at once, and in the Nautilus everyone pumps.
  for (let i = 0; i < 6; i++) { sound('step'); field.shakeT = 3; await wait(8); }
  if (smallGranOut()) {
    // Small Gran comes out of her horn and stands beside Ouro, facing the other way.
    scene.gran = true;
    offstage('slgran');
    await liftOff('slgran', 'ouro', field.x + 1, field.y);
    face('slgran', 0);
  }
  // Two feet as long as houses come along the water's edge. Above the ankles it is dark.
  scene.footL = true; scene.footR = true;
  propAt('gleanerFoot', 50, 13); field.map.props![1].x = 46; field.map.props![1].y = 15;
  await emote('ouro', 'surprise');
  const feet = field.map.props!;
  let left = true;
  for (let x = 44; x >= 14; x -= 6) {
    const p = feet[left ? 0 : 1];
    p.x = x; p.y = left ? 13 : 15;
    field.shakeT = 10; sfx('boom');
    strandFx.landings.push({ x: x + 6 + 1, y: 14, t: 0 });
    left = !left;
    await wait(26);
  }
  // The feet stop by the Auger. A hand comes down out of the dark and lifts one end of it a little,
  // with every climber's feet drumming inside, then sets it down.
  scene.hand = true;
  await pan(9, 8);
  await slideProp('gleanerHand', 6, -4, 5);
  await shake(20);
  for (let i = 0; i < 10; i++) { sound('step'); await wait(5); }
  await shake(14);
  await slideProp('gleanerHand', 6, 5, -4);
  scene.hand = false;
  await panBack();
  // The feet go on, west, and up the beach.
  for (let i = 0; i < 3; i++) { feet[i % 2].x -= 8; field.shakeT = 8; sfx('boom'); await wait(24); }
  scene.footL = false; scene.footR = false;
  // Far up the beach the hand lifts the Volute out of the sand and holds it to where an ear would be,
  // and the Volute's tune comes across the beach, lower than Ouro remembers it.
  face('ouro', 3);
  await wait(40);
  await narr('Far up the beach, a hand lifts the Volute out of the sand.');
  await narr('The hand holds the Volute up to where an ear would be.');
  await wait(30);
  await shellTune(false, false, 2);
  if (hold()) sound('guard');
  else for (let i = 0; i < 3; i++) { sound('step'); await wait(10); }
  await wait(30);
  // The feet come back down the beach and turn east along the upper beach, with stars landing in their new footprints.
  await starLine([[20, 2], [28, 2], [36, 2], [44, 2], [52, 2]], 22);
  // The whole beach is walked, so every empty shell on it is taken.
  sweepAll();
  scene = {};
  field.playMapMusic();
  goal('Follow the footprints east, along the upper beach.');
  save();
});

// ---------------------------------------------------------------- the Long Strand

const ls = new Canvas(50, 18, '.').border('#');
ls.put(0, 3, '.').put(0, 4, '.').put(49, 9, '.').put(49, 10, '.');
ls.rect(1, 16, 48, 1, '~');
ls.rect(3, 1, 7, 3, ',').rect(18, 2, 8, 3, ',').rect(36, 1, 9, 3, ',').rect(10, 6, 5, 2, ',').rect(28, 6, 6, 2, ',').rect(14, 12, 6, 2, ',').rect(34, 13, 7, 2, ',');
for (const [x, y] of [[2, 6], [16, 1], [26, 2], [31, 1], [46, 5], [42, 7], [22, 7]]) ls.put(x, y, '#');
const LABELS: [number, number][] = [[8, 3], [24, 14], [33, 4], [5, 7], [13, 4], [19, 7], [27, 4], [38, 6], [43, 3], [45, 13], [11, 14], [30, 13]];
for (const [x, y] of LABELS) ls.put(x, y, 'p');
ls.put(40, 6, 'x').put(15, 7, 'x');
const lsTide = ls.rows().map((r, y) => [...r].map((c, x) => (y >= 12 && y <= 15 && '.,x'.includes(c) ? 'A' : ' ')).join(''));
FOOTPRINTS.longstrand = [2, 7, 12, 17, 22, 27, 32, 37, 42, 47].map(x => [x, 10] as [number, number]);
// Starfall at low water: stars fall only in the footprint columns, in the same order every night.
const FOOT_COLS = [1, 3, 5, 2, 4, 6, 0, 3, 5, 1];
const toWestLow = () => inSpringLow();

defMap({
  id: 'longstrand', name: 'The Long Strand', region: 25, music: 'strand', strand: true,
  rows: ls.rows(),
  mods: tideMods(lsTide, 0, 0),
  props: LABELS.map(([x, y]) => ({ x, y: y - 1, pic: 'labelPost' })),
  warps: [
    { x: 0, y: 3, to: 'springlow', tx: 54, ty: 2, dir: 3, when: toWestLow }, { x: 0, y: 4, to: 'springlow', tx: 54, ty: 3, dir: 3, when: toWestLow },
    { x: 0, y: 3, to: 'lowline', tx: 54, ty: 2, dir: 3 }, { x: 0, y: 4, to: 'lowline', tx: 54, ty: 3, dir: 3 },
    { x: 49, y: 9, to: 'tray', tx: 1, ty: 16, dir: 1 }, { x: 49, y: 10, to: 'tray', tx: 1, ty: 17, dir: 1 },
  ],
  enter: 'longEnter',
  zone: {
    kinds: kinds([['spoor', 3], ['bolide', 3], ['saltwort', 3], ['marram', 3], ['cuttle', 3], ['medusa', 3], ['albedo', 3]]),
    lv: [44, 52], n: 12, area: 'strand',
    tideKinds: {
      low: kinds([['spoor', 3], ['bolide', 2], ['saltwort', 3], ['marram', 3]]),
      high: kinds([['cuttle', 3], ['medusa', 3], ['albedo', 2], ['marram', 2]]),
    },
  },
  npcs: [
    { id: 'labelreader', x: 20, y: 9, sprite: 'beach4', name: 'Label-reader', dir: 0, wander: true, talk: 'labelReader' },
    { id: 'marramcutter', x: 12, y: 5, sprite: 'beach2', name: 'Marram-cutter', dir: 1,
      trainer: { name: 'Marram-cutter', team: [['marram', 48], ['saltwort', 48]], intro: 'Cutting dune grass for thatch. I go round the labels. Feels rude to cut a label.', defeat: 'Eh. Thatch\'ll keep.', sight: 3 } },
    { id: 'starchaser', x: 30, y: 10, sprite: 'beach3', name: 'Star-chaser', dir: 3, when: lowWater,
      trainer: { name: 'Star-chaser', team: [['bolide', 49], ['spoor', 49]], intro: 'Big low! Once a year you get to run right behind the stars! Come on, come on!', defeat: 'Aw. Fine, you win. Now run!', sight: 3 } },
    { id: 'jellyturner', x: 38, y: 13, sprite: 'beach1', name: 'Jelly-turner', dir: 3, when: lowWater,
      trainer: { name: 'Jelly-turner', team: [['medusa', 49], ['cuttle', 49]], intro: 'I turn the jellies over so they don\'t dry out. Do they say thanks? They do not.', defeat: 'Yeah, they\'re not gonna thank you either.', sight: 3 } },
  ],
  spots: [
    look(8, 3, 'A label stuck in a dune, driftwood, pressed with big letters that lean and grow toward the end.', 'KEEP THE SAND.'),
    { x: 24, y: 14, script: async () => {
      await say('Label', 'KEEP THE SEA.');
    } },
    look(33, 4, 'A label on a tall post, its top cut to point upward.', 'KEEP THE SKY.'),
    look(40, 6, 'A label lying on its side where the wind blew it over. Nobody has stood it back up.', 'KEEP THE WIND.'),
    look(15, 7, 'A label half buried, the letters smaller and neater, very old.', 'KEEP THE TIDE.'),
    look(5, 7, 'A label in the marram, with the grass grown up round it.', 'KEEP THE DUNE.'),
    look(13, 4, 'A label leaning on another label. (the other one leans back)', 'KEEP THE NIGHT.'),
    look(19, 7, 'A label with a crab living under it. The crab comes out, sees Ouro, and goes back in.', 'KEEP THE FOAM.'),
    look(27, 4, 'A label stuck in the sand in no order with the others.', 'KEEP THE STARS.'),
    look(38, 6, 'A label with sand drifted up to the K.', 'KEEP THE SHORE.'),
    look(43, 3, 'A new label. The letters are the biggest yet.', 'KEEP THE DARK.'),
    look(45, 13, 'A label in the wet sand, leaning toward the sea.', 'KEEP THE WAVES.'),
    look(11, 14, 'A label at the edge of the water. Each small wave comes up to it and goes back.', 'KEEP THE EDGE.'),
    look(30, 13, 'A label. Something has scratched under the letters, small: "not this one".'),
    stash('ls_dune', 46, 5, 'Dug into the lee of a dune, out of the wind, a nautilus horn and a notion.', { pegs: ['iron', 1], notion: 'warmstone' }),
  ],
});

defScript('longEnter', async () => {
  keepSpringLow();
  if (flag('springHigh')) setFlag('trayCinchLeft');
  if (!flag('longSeen')) {
    setFlag('longSeen');
    await pan(25, 8);
    await wait(30);
    await panBack();
  }
});

// The label-reader reads labels and does nothing else.
defScript('labelReader', async () => {
  if (flag('sweepOver') && lowWater()) await say('Label-reader', 'Low water. Look at all that sand. Nothing\'s coming to take any of it.');
  else if (highTide()) { await say('Label-reader', 'High water. KEEP THE SEA\'s under the sea now. Only one out here that got what it asked for.'); return; }
  else {
    await say('Label-reader', 'I read \'em, that\'s all I do. First word\'s always KEEP. After THE it gets tricky.');
    await say('Label-reader', 'Old ones are neat and small. New ones are huge. Hurts my neck, honestly.');
  }
  await say('Label-reader', 'Got a shell for catching, if you want it. Stars land in the same holes here every year. Same holes!');
  if (!flag('lsStarfallTold')) { setFlag('lsStarfallTold'); await hint('(Starfall on the Long Strand: stars fall only in the footprint columns. Learn the order.)'); }
  if (await choose(['Catch stars', 'Not now'], true) !== 0) return;
  const score = await starfall({ fixed: FOOT_COLS, bestKey: 'starfallLong' });
  field.playMapMusic();
  await say('Label-reader', score >= 40 ? `${score}! Clean night. I'll write that on a label. A small one, not like theirs.` : `${score}. Watch the holes. They always pick the same holes.`);
  save();
});

// ---------------------------------------------------------------- the Tray

const TW = 46, TH = 34;
const SQ_X = [4, 9, 14, 19, 24, 29, 34, 39], SQ_Y = [3, 8, 13, 18, 23, 28];
const EMPTY = { x: 24, y: 13 }, TOP = { x: 9, y: 8 }, CRAZED = { x: 24, y: 3 }, HOLLOW = { x: 4, y: 23 }, BOOT = { x: 40, y: 29 };
const MUD_SHELLS = [5, 8, 11, 14, 17];
const tr = new Canvas(TW, TH, '.').border('#');
const squares: [number, number][] = [];
for (const y of SQ_Y) for (const x of SQ_X) {
  if (x === 39 && y === 28) continue;
  squares.push([x, y]);
  tr.rect(x, y, 3, 3, 'D');
}
tr.rect(7, 13, 2, 8, ',').rect(32, 3, 2, 12, ',').rect(12, 26, 12, 2, ',').rect(37, 11, 2, 7, ',').rect(17, 21, 2, 2, ',');
for (const x of MUD_SHELLS) tr.put(x, 1, 'C');
tr.put(0, 16, '.').put(0, 17, '.').put(10, 11, 'q');
for (const [x, y] of [[39, 28], [41, 28], [39, 30], [41, 30]]) tr.put(x, y, 'x');
const TRAY_DRY = new Set(['44,16', '44,17', '43,16', '43,17', '42,16', '42,17', '42,26', '43,26', '44,26']);
const trTide = tr.rows().map((r, y) => [...r].map((c, x) => ((y >= 31 && y <= 32 && x >= 1 && x <= 44) || (x >= 42 && x <= 44 && y >= 1 && y <= 32)) && '.,x'.includes(c) && !TRAY_DRY.has(`${x},${y}`) ? 'A' : ' ').join(''));
FOOTPRINTS.tray = SQ_X.map(x => [x + 1, 9] as [number, number]).reverse();

const WORLD_LABELS: Record<string, string> = {
  [`${TOP.x},${TOP.y}`]: 'KEEP THE TOP', '4,8': 'KEEP THE CONE', '4,13': 'KEEP THE OLIVE', '9,13': 'KEEP THE HARP', '4,18': 'KEEP THE WENTLETRAP',
};
const crazedHere = () => release();
const hollowHere = () => !!flag('mundaneCaught');

/** Listening to a collected shell: its tune has gaps. */
async function listenShell(label: string | null): Promise<void> {
  if (label) await say('Label', `${label}.`);
  if (!flag('mudlarkFound')) { await emote('ouro', 'silence'); return; }
  await shellTune(true);
}
function squareSpots(x0: number, y0: number, script: () => Promise<void>, when?: () => boolean): Spot[] {
  const out: Spot[] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (i !== 1 || j !== 1) out.push({ x: x0 + i, y: y0 + j, script, when });
  return out;
}

// Finding the Mudlark. She hides in one of five shells and moves to a shell next to hers after every listen.
// Ouro finds her by listening to the shell she is in. The sure order is 2, 3, 4, 4, 3, 2. She plays it as hard as
// she can: the game keeps every shell she could be in and only gives her up when no other shell is left.
function mudCanBe(): Set<number> {
  const raw = G.flags.mudSet;
  if (raw === undefined) return new Set([0, 1, 2, 3, 4]);
  return new Set([0, 1, 2, 3, 4].filter(i => raw & (1 << i)));
}
async function listenMud(i: number): Promise<void> {
  if (flag('mudlarkFound')) { await emote('ouro', 'silence'); return; }
  if (!flag('mudlarkHeard')) {
    setFlag('mudlarkHeard');
    // A voice comes out of one of the five small shells in a row, and Ouro cannot tell which.
    await act('ouro', 'look');
    await say('Mudlark', 'Nope. Not coming out. Not at dead low, and not for just anybody.');
    await say('Mudlark', 'I never stay in the same shell. Never skip past one, either. Always next door.');
    await say('Mudlark', 'And I don\'t grab a shell I haven\'t had my ear on first.');
    await hint('(Put your ear to a shell to listen. An empty shell plays with notes missing.)');
    await hint('(A shell with someone moving in it plays with footsteps in it.)');
    return;
  }
  const can = mudCanBe();
  can.delete(i);
  if (!can.size) { await foundMud(); return; }
  await shellTune(true);
  let next = 0;
  for (const k of can) { if (k > 0) next |= 1 << (k - 1); if (k < 4) next |= 1 << (k + 1); }
  G.flags.mudSet = next;
}
async function foundMud(): Promise<void> {
  setFlag('mudlarkFound');
  offstage('traymud');
  await shellTune(true, true);
  sfx('spot');
  // The Mudlark crawls out of the shell's mouth on her elbows, very muddy and very flat to the ground.
  const [sx, sy] = field.facing();
  offstage('traymudout');
  await walkIn('traymudout', sx, sy, sx === field.x ? sx + 1 : sx, sy + 1);
  faceToward('traymudout', 'ouro');
  await say('Mudlark', 'Huh. Don\'t usually lose that one. Don\'t mind, though. Much.');
  await say('Mudlark', 'Rules, if you\'re sticking round. No labeled ones. No standing up at dead low.');
  await say('Mudlark', 'And I never look up at it. Don\'t need to. You learn the feet, you don\'t forget the feet.');
  // She crawls off to her place by the rows, where she stays.
  await walkOff('traymudout', 22, 17);
  const tm = field.npc('traymud');
  if (tm) tm.hidden = false;
  setFlag('mudlarkHome');
  goal('Look at the big square in the middle of the Tray.');
  save();
}

async function emptySquare(): Promise<void> {
  await say('Label', 'KEEP THE VOLUTE.');
  await choose(['Four white posts.']);
  await narr('The posts are white and round on top. They are as tall as the posts at the corners of the Margin.');
  if (!flag('mudlarkFound') || flag('squareHeard')) return;
  setFlag('squareHeard');
  // The empty square's sand is silent. The next squares play with gaps. Then, faint, from far up the beach to the
  // west, the Volute's tune comes through the sand, all of it.
  await act('ouro', 'bow');
  await emote('ouro', 'silence');
  await shellTune(true);
  await shellTune(true);
  face('ouro', 3);
  await wait(30);
  await shellTune(false);
  await say('Mudlark', 'I stay off the big square. Never seen a thing in it. Not once.');
  await say('Mudlark', 'Listened down every row. Once. Not doing it twice. Not one whole tune in the lot.');
  await say('Mudlark', 'Never heard one play the whole thing. Except yours, way up the beach.');
  goal(flag('mudlarkBeaten') ? 'Stand by the big empty square.' : 'Talk to the Mudlark.');
  save();
}

async function bootSquare(): Promise<void> {
  await say('Label', 'KEEP THE BOOT.');
  if (await choose(['Take the boot.', 'Leave it.']) !== 0) return;
  if (flag('mudlarkFound')) await say('Mudlark', 'Labeled. I wouldn\'t. Wouldn\'t stop you, though.');
  setFlag('bootTaken');
  giveKey('granboot');
  sfx('level');
  await notice('Ouro gets Gran\'s boot, full of sand seventy years old.');
  await granSpeaks();
  save();
}

async function crazedShell(): Promise<void> {
  await narr('The gray shell is drawn all over with crazes. In the crazes are the shapes of towns.');
  await say('Label', 'KEEP THE CRAZES.');
  if (!flag('springHigh')) await hint('(The old Apex. Cinch would want to see it, when the sea has been in.)');
}

async function hollowOne(): Promise<void> {
  await say('Label', 'KEEP THE HOLLOW ONE.');
  await emote('ouro', 'silence');
}

const trayMods: Mod[] = [
  ...tideMods(trTide, 0, 0),
  { x: TW - 1, y: 16, ch: '.', when: () => !!flag('springHigh') }, { x: TW - 1, y: 17, ch: '.', when: () => !!flag('springHigh') },
  { x: 25, y: 6, ch: 'q', when: crazedHere },
  { x: 44, y: 26, ch: 'q', when: () => !!flag('mudlarkFound') },
];
const trayLabel = () => (G as any).a2label as string | undefined;

defMap({
  id: 'tray', name: 'The Tray', region: 30, music: 'tray', strand: true,
  rows: tr.rows(),
  mods: trayMods,
  props: [
    ...squares.filter(([x, y]) => !(x === EMPTY.x && y === EMPTY.y)).map(([x, y]) => ({ x, y, pic: 'trayShell' })),
    { x: EMPTY.x, y: EMPTY.y, pic: 'emptySquare' },
    { x: 27, y: 11, pic: 'labelPost', when: shown('label') },
    { x: 40, y: 2, pic: 'gleanerFoot', when: shown('trayFootA') },
    { x: 36, y: 6, pic: 'gleanerFoot', when: shown('trayFootB') },
    { x: 34, y: 2, pic: 'gleanerHand', when: shown('trayHand') },
    { x: 23, y: 8, pic: 'gleanerHand', when: shown('takeHand') },
  ],
  warps: [
    { x: 0, y: 16, to: 'longstrand', tx: 48, ty: 9, dir: 3 }, { x: 0, y: 17, to: 'longstrand', tx: 48, ty: 10, dir: 3 },
    { x: TW - 1, y: 16, to: 'conchlip', tx: 1, ty: 9, dir: 1, when: () => !!flag('springHigh') },
    { x: TW - 1, y: 17, to: 'conchlip', tx: 1, ty: 10, dir: 1, when: () => !!flag('springHigh') },
    { x: 10, y: 11, to: 'hollowtop', tx: 15, ty: 22, dir: 2 },
    { x: 25, y: 6, to: 'oldapex', tx: 11, ty: 15, dir: 2, when: () => crazedHere() && !!flag('springHigh') },
    { x: 44, y: 26, to: 'mudlarkyard', tx: 1, ty: 4, dir: 1, when: () => !!flag('mudlarkFound') },
  ],
  enter: 'trayEnter',
  triggers: [{ x: EMPTY.x - 1, y: EMPTY.y - 1, w: 5, h: 5, script: 'trayTake', when: () => !!flag('mudlarkBeaten') && !!flag('squareHeard') && !flag('labelTaken') }],
  tileTalk: { D: 'trayListen' },
  zone: {
    kinds: kinds([['bollard', 3], ['docket', 3], ['vacancy', 3], ['trochus', 3], ['hopper', 3], ['crabwise', 3], ['magpie', 3], ['cache', 3], ['heirloom', 1], ['lodestar', 1], ['ammonite', 1]]),
    lv: [44, 52], n: 12, area: 'tray',
    tideKinds: {
      high: kinds([['bollard', 3], ['docket', 3], ['vacancy', 3], ['trochus', 3], ['hopper', 2], ['crabwise', 2], ['magpie', 2], ['cache', 2]]),
      get low() {
        const base = kinds([['bollard', 3], ['docket', 3], ['vacancy', 3], ['trochus', 3], ['hopper', 2], ['crabwise', 2], ['magpie', 2], ['cache', 2]]);
        return flag('a2done') ? [...base, ...kinds([['heirloom', 1], ['lodestar', 1], ['ammonite', 1]])] : base;
      },
    },
  },
  npcs: [
    { id: 'traytack', x: 2, y: 20, sprite: 'tack', name: 'Tack', dir: 1, talk: 'trayTack', when: () => release() && !flag('sweepOver') },
    // The Mudlark coming out of her shell at the north edge, on her elbows.
    { id: 'traymudout', x: 11, y: 2, sprite: 'mudlark', name: 'Mudlark', dir: 0, when: () => !!flag('mudlarkFound') && !flag('mudlarkHome'), talk: undefined, movable: true },
    { id: 'traymud', x: 22, y: 17, sprite: 'mudlark', name: 'Mudlark', dir: 1, talk: 'trayMudlark', when: () => !!flag('mudlarkFound') && !flag('a2done') },
    { id: 'traymudup', x: 22, y: 17, sprite: 'beach1', name: 'Mudlark', dir: 1, talk: 'trayMudlark', when: () => !!flag('a2done') },
    { id: 'traycinch', x: 23, y: 12, sprite: 'realcinch', name: 'Cinch', dir: 1, talk: 'trayCinch', when: () => !!flag('springHigh') && !flag('trayCinchLeft') },
    { id: 'traygran', x: 26, y: 12, sprite: 'smallgran', name: 'Small Gran', dir: 0, when: shown('gran') },
    { id: 'trayknot', x: 24, y: 12, sprite: 'stone', name: 'Knot', dir: 1, img: kindSprite('knot'), when: () => !!flag('knotSat') && !flag('trayCinchLeft') },
    { id: 'trayboot', x: BOOT.x, y: BOOT.y, sprite: 'stone', name: 'A boot', dir: 0, img: () => BOOT_SPRITE, talk: 'trayBoot', when: () => !flag('bootTaken') },
  ],
  spots: [
    ...MUD_SHELLS.map((x, i) => ({ x, y: 1, script: () => listenMud(i) })),
    ...squareSpots(EMPTY.x, EMPTY.y, emptySquare),
    ...squareSpots(CRAZED.x, CRAZED.y, crazedShell, crazedHere),
    ...squareSpots(HOLLOW.x, HOLLOW.y, hollowOne, hollowHere),
    ...Object.entries(WORLD_LABELS).flatMap(([k, label]) => { const [x, y] = k.split(',').map(Number); return squareSpots(x, y, () => listenShell(label)); }),
  ],
});

const BOOT_SPRITE: SpriteData = { px: ['........', '...111..', '...121..', '...121..', '...1211.', '..122221', '.1222221', '.1111111'], c: ['#8a5a3a', '#5a3a2a'] };

defScript('trayListen', () => listenShell(null));
defScript('trayBoot', bootSquare);

defScript('trayEnter', async () => {
  keepSpringLow();
  if (!flag('traySeen')) {
    setFlag('traySeen');
    scene = {};
    // Rows of squares marked by white posts, a still shell as big as a hill in each, a label in front of each.
    await pan(20, 12);
    await wait(30);
    // At the end of a far row the feet stand among the shells, and a hand lifts each shell, holds it up, and sets it back.
    scene.trayFootA = true; scene.trayFootB = true;
    await pan(36, 5);
    await shake(14);
    scene.trayHand = true;
    for (let k = 0; k < 3; k++) {
      await slideProp('gleanerHand', 34, 2, -2);
      await wait(30);
      await slideProp('gleanerHand', 34, -2, 2);
      await shake(10);
    }
    await starLine(FOOTPRINTS.tray.slice(0, 4), 24);
    scene = {};
    await panBack();
    await hint('(At dead low the Gleaner works in the Tray. Its feet are dangerous. Keep out of the rows it is in.)');
    goal('Something moves in one of the small shells at the north edge of the Tray.');
    save();
  }
});

defScript('trayTack', async () => {
  if (flag('springHigh')) { await say('Tack', '312 squares. Still 1 empty. 1 of us sat by it all night, and it wasn\'t me.'); return; }
  await act('traytack', 'nod');
  faceToward('traytack', 'ouro');
  await say('Tack', 'Counted 312 squares. Twice. 1 empty. The big 1, in the middle.');
  await say('Tack', 'It picked up 40 in a row and put every one back in order. Showoff.');
});

// The Mudlark says only what she does not do.
defScript('trayMudlark', async () => {
  if (flag('a2done')) {
    if (!flag('htKeyGiven')) {
      setFlag('htKeyGiven');
      await act('traymudup', 'hop');
      await say('Mudlark', 'No labels. Don\'t need \'em. Don\'t need anybody doing it for me, either.');
      await say('Mudlark', 'Here. I don\'t keep keys I can\'t use. Opens the last room in the top one.');
      giveKey('hollowkey');
      sfx('level');
      await notice('(Ouro gets the Hollow Top\'s key.)');
      save();
      return;
    }
    if (await strandRematch('The Mudlark', ['magpie', 'cache', 'docket', 'crabwise'], 'mudlark')) return;
    await say('Mudlark', 'No more lying flat at low. Don\'t miss it. Well. My elbows don\'t.');
    return;
  }
  if (flag('labelTaken')) {
    await say('Mudlark', 'Don\'t bother pulling it. I\'ve tried. They don\'t stay off.');
    await say('Mudlark', 'Mine never stand still at low. Never. You saw why.');
    return;
  }
  if (flag('mudlarkBeaten')) { await say('Mudlark', 'Can\'t carry it flat, I don\'t keep it. That\'s the whole rule.'); return; }
  if (!flag('squareHeard')) {
    await say('Mudlark', 'Told you. No labeled ones. No standing up at dead low.');
    await say('Mudlark', 'Big square\'s in the middle. Go look. I\'m not going near it.');
    return;
  }
  await leadToYard();
});

async function leadToYard(): Promise<void> {
  // The Mudlark leads Ouro along the edge of the Tray, flat on her elbows the whole way.
  await say('Mudlark', 'Don\'t live in the rows. Don\'t live far off, either. This way.');
  await Promise.all([walkTo('traymud', 44, 25), (async () => { await wait(24); await walkTo('ouro', 43, 25); })()]);
  await say('Mudlark', 'Wouldn\'t put my door anywhere its feet don\'t come. Nobody looks where they step.');
  await warp('mudlarkyard', 1, 4, 1);
}

defScript('trayCinch', async () => {
  if (flag('ringRead')) { await cinch('Sit. Wade, huh. That\'s a name for somebody small.'); return; }
  await cinch('Still sitting with that one. Room here if you want to sit with it too.');
});

// ---------------------------------------------------------------- the Take: the label, and the Return: the spring high

defScript('trayTake', async () => {
  setFlag('labelTaken');
  await walkTo('ouro', 25, 12);
  face('ouro', 0);
  // The sea turns far out. The feet stop in the rows, then come along the row toward the empty square.
  scene.trayFootA = true;
  await shake(16);
  const gran = smallGranOut();
  const lifted: Mon | undefined = gran || G.party[0];
  // Small Gran comes out of her horn and stands beside Ouro by the empty square, very still. Without her, the lead whorl stands there.
  const who = gran ? 'traygran' : 'whorl';
  if (gran) {
    scene.gran = true;
    offstage('traygran');
    await liftOff('traygran', 'ouro', 26, 12);
    face('traygran', 0);
  }
  // A hand comes down out of the dark, its knuckles each the size of a cart, and its fingers close round them.
  scene.takeHand = true;
  await slideProp('gleanerHand', 23, -4, 8, 8);
  await shake(20);
  await act('ouro', 'shiver');
  await narr('The hand lifts them both, high, up beside the dark where an ear would be.');
  await Promise.all([act('ouro', 'lift'), act(who, 'lift'), tint('#0b0a10', 0.8, 30)]);
  // It is very quiet up there, and the hand creaks.
  sound('guard');
  await wait(30);
  if (gran) await granSpeaks();
  await wait(90);
  // Then the hand comes down slowly and sets them on the sand.
  await tint('#0b0a10', 0, 40);
  await slideProp('gleanerHand', 23, 8, -4, 8);
  scene.takeHand = false;
  // One finger pushes a driftwood post into the sand beside them and presses letters into it, one at a time.
  await prop('newlabel', 'labelPost', 27, 11, 30);
  for (let i = 0; i < 5; i++) { sound('cut'); await wait(12); }
  scene.label = true;
  await unprop('newlabel', 0);
  const text = gran ? 'KEEP THE SMALL ONE' : `KEEP THE ${(SPECIES[lifted?.kind || '']?.name || lifted?.name || 'FOUR').toUpperCase()}`;
  (G as any).a2label = text;
  if (lifted) G.flags.labeledUid = lifted.uid;
  await say('Label', `${text}.`);
  // The feet go away east, toward the pink shell at the end of the beach.
  scene.trayFootA = false;
  await shake(10);
  await hint(gran ? '(Small Gran is marked. The label goes where she goes.)' : `(${lifted?.name} is marked. The label goes where it goes.)`);
  await springHigh(!!gran);
});

async function springHigh(gran: boolean): Promise<void> {
  await wait(30);
  // Night. The tide comes in round the Tray until it is an island, and Ouro sits by the empty square.
  await tint('#0b0a10', 0.4, 40);
  evening(true);
  await tint('#0b0a10', 0, 30);
  await morphTo('tide', 25, 30, 0, 1);
  setFlag('tide', 0);
  setTide(true);
  face('ouro', 3);
  await act('ouro', 'bow');
  // Along the upper beach from the west, Cinch comes very slowly with a pot of soup, and sits down twice on the way.
  setFlag('springHigh');
  setFlag('cinchFree');
  offstage('traycinch');
  await walkIn('traycinch', 1, 16, 12, 16);
  await act('traycinch', 'bow');
  await walkTo('traycinch', 18, 13);
  await act('traycinch', 'bow');
  await walkTo('traycinch', 23, 12);
  face('traycinch', 1);
  await cinch('Sit. They let me out at the high. Sent soup.');
  // Cinch sits at the corner of the empty square by a white post with the pot between them, and looks at the post,
  // then the new label, then the post again.
  await act('traycinch', 'bow');
  sound('ok');
  for (const d of [2, 1, 2]) { face('traycinch', d); await wait(30); }
  await cinch('Sit here by me. You can see the pink one from here, down the beach.');
  face('ouro', 1);
  await narr('Down the beach, something very large lies curled in the mouth of the great pink shell.');
  await cinch('Sit and watch it a while. Same thing, every time.');
  await cinch('Seen that before. Left one at a post myself. Did the same thing every day.');
  await cinch('From here it looks like a cast. Somebody\'s. Somebody big.');
  await cinch('Sit. Nobody\'s in it.');
  await choose(['Whose is it?']);
  await cinch('Sit with that one a while. I would.');
  // They eat the soup.
  for (let i = 0; i < 3; i++) { await Promise.all([act('ouro', 'nod'), act('traycinch', 'nod')]); }
  await emote('traycinch', 'heart');
  const knot = G.party.find(m => m.kind === 'knot');
  if (hold() && knot) {
    // Knot comes out of its horn with its hands up at the height of a post. Cinch looks at it a long time.
    setFlag('knotSat');
    offstage('trayknot');
    await liftOff('trayknot', 'ouro', 24, 12);
    faceToward('trayknot', 'traycinch');
    faceToward('traycinch', 'trayknot');
    await wait(90);
    await cinch('Sit.');
    // Knot's hands come down slowly from the height of the post, and it sits on the sand next to Cinch.
    await act('trayknot', 'shiver');
    await act('trayknot', 'bow');
    await cinch('From down here we look alike. Got my nose, see.');
    await wait(90);
  }
  scene = {};
  evening(false);
  // The sea is back, the old rooms open, and the hand bell rings again.
  if (flag('bellHeld')) { setFlag('bellHeld', 0); giveKey('handbell'); }
  const lt = (G as any).a2lastTannery;
  if (lt) { G.lastTannery = lt; delete (G as any).a2lastTannery; }
  goal('Letters wait at the Sand Dollar post. The pink shell lies at the east end of the beach.');
  save();
}

// ---------------------------------------------------------------- the Mudlark's yard: the feet

// At dead low the Gleaner's feet come down in the yard in a round of six, one per step Ouro takes.
// The foot that just landed and the one before it are down. The next landing shows as marks first.
// A foot that lands on Ouro knocks Ouro back to the gate. Solved with scratchpad feet.mjs: from the gate the
// shortest crossing is 23 steps, RRRRRDRRUURRRLDURDRRRRR, with no knock. A straight dash along the middle is stepped on.
const FEET: [number, number, number, number][] = [[3, 1, 3, 3], [7, 1, 3, 3], [11, 1, 3, 3], [11, 4, 3, 3], [7, 4, 3, 3], [3, 4, 3, 3]];
const YARD = [
  '##################',
  '#.......p........#',
  '#................#',
  '#...p.......p....#',
  '................P#',
  '#.........p......#',
  '#....p...........#',
  '##################',
];
let yardT = 0;
const feetOn = () => (inSpringLow() || lowWater()) && !flag('gleanerSat');
const inFoot = (k: number, x: number, y: number) => { const [bx, by, w, h] = FEET[((k % 6) + 6) % 6]; return x >= bx && x < bx + w && y >= by && y < by + h; };
const footDown = (k: number) => feetOn() && (yardT % 6 === k || (yardT + 5) % 6 === k);
const footNext = (k: number) => feetOn() && (yardT + 1) % 6 === k && G.keys.includes('tidetable');

const yardMods: Mod[] = [];
FEET.forEach(([bx, by, w, h], k) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = bx + i, y = by + j;
    if (YARD[y][x] !== '.') continue;
    yardMods.push({ x, y, ch: 'K', when: () => footDown(k) }, { x, y, ch: 'b', when: () => footNext(k) });
  }
});

defMap({
  id: 'mudlarkyard', name: 'The Mudlark\'s yard', region: 30, music: 'tray', strand: true,
  rows: YARD,
  mods: yardMods,
  props: [
    ...FEET.map(([bx, by], k) => ({ x: bx - 0.5, y: by, pic: 'gleanerFoot', when: () => footDown(k) })),
    ...[[8, 1], [4, 3], [12, 3], [10, 5], [5, 6]].map(([x, y]) => ({ x, y: y - 1, pic: 'labelPost' })),
  ],
  warps: [{ x: 0, y: 4, to: 'tray', tx: 43, ty: 26, dir: 3 }],
  enter: 'yardEnter',
  triggers: [{ x: 16, y: 4, w: 1, h: 1, script: 'yardDoor', when: () => !flag('mudlarkBeaten') }],
  npcs: [{ id: 'yardmud', x: 16, y: 5, sprite: 'mudlark', name: 'Mudlark', dir: 2, talk: 'yardMudlark' }],
  spots: [
    ...[[8, 1, 'not this one'], [4, 3, 'not this one either'], [12, 3, 'no'], [10, 5, 'not this one'], [5, 6, 'no']].map(([x, y, s]) =>
      look(x as number, y as number, `One of the Mudlark's own labels, scratched small in a different hand: "${s}".`)),
  ],
});

field.stepHooks.push(f => {
  if (f.map.id !== 'mudlarkyard' || !feetOn()) return;
  yardT++;
  if (FEET.some((_, k) => yardT % 6 === k && inFoot(k, f.x, f.y))) void f.runBusy(knocked);
  else { field.shakeT = 6; }
});

async function knocked(): Promise<void> {
  // A foot comes down, and Ouro goes rolling back to the yard's edge, not hurt, just sandy.
  sfx('hitBig');
  await shake(16);
  await act('ouro', 'shiver');
  await walkTo('ouro', 1, 4, 4);
  face('ouro', 1);
  await emote('ouro', 'sweat');
}

defScript('yardEnter', async () => {
  keepSpringLow();
  yardT = 0;
  if (!flag('yardSeen')) {
    setFlag('yardSeen');
    await hint('(The Gleaner\'s feet come down in the yard in the same round of six steps.)');
    await hint('(With the tide table, a mark shows where the next foot lands.)');
  }
});

/** The Mudlark, the fifth keeper. Strand level 51. */
export const mudTeam = () => [mon('magpie', 49), mon('cache', 49), mon('docket', 50), mon('crabwise', 51)];
defScript('yardDoor', async () => {
  await say('Mudlark', 'Don\'t fight fair. Don\'t fight long. Get down here.');
  if (!await keeperFight('The Mudlark', mudTeam)) {
    await say('Mudlark', 'Keep it. Never keep what I win anyway.');
    return;
  }
  setFlag('mudlarkBeaten');
  await say('Mudlark', 'There. Don\'t give these out much. Don\'t have much to give.');
  await giveGrain('The Mudlark');
  await grainLine();
  await say('Mudlark', 'Go on, then. I don\'t keep anything I can\'t carry flat.');
  goal(flag('squareHeard') ? 'Stand by the big empty square.' : 'Listen at the big empty square.');
  save();
});
defScript('yardMudlark', async () => {
  if (!flag('mudlarkBeaten')) { await say('Mudlark', 'Not coming out to the gate. I\'ll wait at the door. Mind the feet.'); return; }
  await say('Mudlark', 'Back again? I don\'t keep anything I can\'t carry flat. You included.');
});

// ---------------------------------------------------------------- the Hollow Top: stillness

// A door opens when no whorl is within three tiles of it and Ouro has not moved within three tiles of it for
// five counts (a count is half a second). Wild whorls that see Ouro move (within five tiles) follow at half
// Ouro's pace. One that sees Ouro stand still for two counts, or loses sight of Ouro, wanders near where it stopped.
// The last door has two whorls at it. The layout gives a loop of streets so Ouro can lead them east along the top
// street to the far end, outpace them, and come back by the middle street. Fighting or sounding a whorl clears it.
const ht = new Canvas(32, 25, '#');
ht.rect(10, 1, 10, 3, '.').rect(13, 2, 4, 1, 'b').put(11, 1, 'x').put(18, 3, 'x').put(12, 3, 'x');
ht.put(15, 4, 'j');
for (const y of [5, 11, 17]) ht.rect(1, y, 30, 1, '.');
for (const x of [1, 8, 15, 22, 30]) ht.rect(x, 5, 1, 13, '.');
for (const [x0, w] of [[2, 6], [9, 6], [16, 6], [23, 7]]) for (const y0 of [6, 12]) { ht.rect(x0, y0, w, 5, 'h'); ht.rect(x0, y0, w, 1, 'r'); }
ht.rect(9, 19, 14, 4, '.').put(15, 18, 'j').put(15, 23, '.').put(15, 24, 'q');
ht.put(12, 20, 'w').rect(19, 21, 2, 1, 'e');
// Rooms: the kitchen (door K), the child's room (door R), and the last room (locked, the key after Act 2).
ht.rect(10, 13, 4, 3, '_').put(11, 16, 'j').rect(11, 14, 2, 1, 'c');
ht.rect(17, 7, 4, 3, '_').put(18, 10, 'j');
ht.rect(24, 13, 5, 3, '_').put(26, 16, 'j');
type Door = { id: string; x: number; y: number; last?: boolean };
const HT_DOORS: Door[] = [{ id: 'A', x: 15, y: 18 }, { id: 'K', x: 11, y: 16 }, { id: 'R', x: 18, y: 10 }, { id: 'C', x: 15, y: 4, last: true }];
const HT_LOCKED = { x: 26, y: 16 };
type Whorl = { id: string; kind: string; home: [number, number] };
const HT_WHORLS: Whorl[] = [
  { id: 'htw0', kind: 'trochus', home: [17, 20] }, { id: 'htw1', kind: 'vacancy', home: [10, 17] },
  { id: 'htw2', kind: 'trochus', home: [13, 5] }, { id: 'htw3', kind: 'vacancy', home: [17, 5] },
];
const htOpen = (d: Door) => !!flag('htDoor' + d.id);
const STREET = (x: number, y: number) => ht.at(x, y) === '.' || ht.at(x, y) === 'x' || ht.at(x, y) === 'b';
type HtState = { follow: boolean; home: [number, number]; next: number };
const htState: Record<string, HtState> = {};
let htLastX = -1, htLastY = -1, htMovedAt = 0;
const htTimers: Record<string, number> = {};

function htActive(w: Whorl): boolean { return !flag(w.id + 'gone'); }
function htStep(n: { x: number; y: number }, tx: number, ty: number): [number, number] | null {
  // One step toward the target along the streets, by breadth-first search.
  const key = (x: number, y: number) => y * 32 + x;
  const prev = new Map<number, number>([[key(n.x, n.y), -1]]);
  const q: [number, number][] = [[n.x, n.y]];
  for (let i = 0; i < q.length && i < 900; i++) {
    const [x, y] = q[i];
    if (Math.abs(x - tx) + Math.abs(y - ty) <= 1) {
      let k = key(x, y), p = prev.get(k)!;
      if (p === -1) return null;
      while (prev.get(p)! !== -1) { k = p; p = prev.get(p)!; }
      return [k % 32, Math.floor(k / 32)];
    }
    for (let d = 0; d < 4; d++) {
      const nx = x + [0, 1, 0, -1][d], ny = y + [1, 0, -1, 0][d];
      if (!STREET(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      q.push([nx, ny]);
    }
  }
  return null;
}
function htFree(x: number, y: number): boolean {
  if (!STREET(x, y)) return false;
  if (field.x === x && field.y === y) return false;
  return !field.npcs.some(n => n.x === x && n.y === y && field.npcVisible(n));
}

frameHook('hollowtop', () => {
  const t = field.t;
  if (field.x !== htLastX || field.y !== htLastY || field.moving > 0) { htMovedAt = t; htLastX = field.x; htLastY = field.y; }
  const ouroStill = t - htMovedAt;
  for (const w of HT_WHORLS) {
    if (!htActive(w)) continue;
    const n = field.npc(w.id);
    if (!n) continue;
    const s = htState[w.id] ||= { follow: false, home: [...w.home] as [number, number], next: t + 60 };
    const dist = Math.abs(n.x - field.x) + Math.abs(n.y - field.y);
    const sees = dist <= 5;
    if (sees && ouroStill < 8) s.follow = true;
    if (s.follow && (!sees || ouroStill > 60)) { s.follow = false; s.home = [n.x, n.y]; s.next = t + 40; }
    if (t < s.next) continue;
    if (s.follow) {
      s.next = t + 16;
      if (dist <= 1) continue;
      const st = htStep(n, field.x, field.y);
      if (st && htFree(st[0], st[1])) { n.dir = st[0] > n.x ? 1 : st[0] < n.x ? 3 : st[1] > n.y ? 0 : 2; n.x = st[0]; n.y = st[1]; }
    } else {
      s.next = t + 60 + ((t * 7 + w.id.length * 13) % 50);
      const d = (t + n.x * 3 + n.y) % 4;
      const nx = n.x + [0, 1, 0, -1][d], ny = n.y + [1, 0, -1, 0][d];
      if (Math.abs(nx - s.home[0]) + Math.abs(ny - s.home[1]) <= 2 && htFree(nx, ny)) { n.x = nx; n.y = ny; n.dir = d; }
    }
  }
  for (const d of HT_DOORS) {
    if (htOpen(d)) continue;
    const near = (x: number, y: number) => Math.abs(x - d.x) + Math.abs(y - d.y) <= 3;
    const blocked = HT_WHORLS.some(w => { const n = field.npc(w.id); return htActive(w) && n && near(n.x, n.y); });
    if (blocked || (near(field.x, field.y) && ouroStill < 2)) { htTimers[d.id] = 0; continue; }
    htTimers[d.id] = (htTimers[d.id] || 0) + 1;
    if (htTimers[d.id] >= 150) {
      setFlag('htDoor' + d.id);
      sfx('switch');
      if (d.last) void field.runBusy(async () => { await pan(d.x, d.y); await wait(30); await panBack(); });
    }
  }
});

defMap({
  id: 'hollowtop', name: 'The Hollow Top', region: 30, music: 'tray', strand: true,
  rows: ht.rows(),
  mods: [
    ...HT_DOORS.map(d => ({ x: d.x, y: d.y, ch: '.', when: () => htOpen(d) })),
    { x: HT_LOCKED.x, y: HT_LOCKED.y, ch: '.', when: () => !!flag('htLastOpen') },
  ],
  warps: [{ x: 15, y: 24, to: 'tray', tx: 10, ty: 12, dir: 0 }],
  enter: 'htEnter',
  npcs: HT_WHORLS.map((w): NpcDef => ({
    id: w.id, x: w.home[0], y: w.home[1], sprite: 'stone', name: SPECIES[w.kind]?.name || 'A whorl', dir: 0,
    img: kindSprite(w.kind), talk: w.id, when: () => htActive(w),
  })),
  spots: [
    look(14, 1, 'In the square the ground is crazed all over.', 'In the middle is a shell-shaped hollow, and nothing in it.'),
    look(13, 12, 'On a kitchen wall, children\'s heights scratched in the plaster.', 'The top mark is a little higher than the rest.'),
    { x: 11, y: 14, script: async () => {
      if (!flag('found_ht_bowl')) { setFlag('found_ht_bowl'); await reward({ notion: 'quickstone' }); }
      else await emote('ouro', 'silence');
    } },
    stash('ht_well', 12, 20, 'Down the well, on a ledge above the dry bottom, a nautilus horn.', { pegs: ['iron', 1] }),
    stash('ht_child', 21, 8, 'In the child\'s room, in a box under the bed, five grains of nacre.', { tan: 5 }),
    look(19, 21, 'A cart with its shafts down. Nothing is between the shafts.'),
    look(2, 10, 'A row of washing over a wall, dry for years. It does not move.'),
    look(HT_LOCKED.x, HT_LOCKED.y, 'A door with a lock. Every other door here opens for stillness. This one wants a key.'),
    { x: HT_LOCKED.x, y: HT_LOCKED.y - 1, when: () => !!flag('htLastOpen'), script: async () => {
      if (flag('htLast')) { await emote('ouro', 'silence'); return; }
      setFlag('htLast');
      // On the pillow, a shell. Ouro listens: footsteps, once, then none.
      await act('ouro', 'bow');
      sound('step');
      await wait(60);
      await emote('ouro', 'silence');
      await reward({ pegs: ['iron', 2], tan: 4 });
    } },
  ],
});
// The locked door: a spot on its outside face.
MAPS.hollowtop.spots!.unshift({ x: HT_LOCKED.x, y: HT_LOCKED.y, when: () => G.keys.includes('hollowkey') && !flag('htLastOpen'), script: async () => {
  setFlag('htLastOpen');
  sfx('switch');
  await morphTo('htLastOpen', HT_LOCKED.x, HT_LOCKED.y);
} });

for (const w of HT_WHORLS) defScript(w.id, async () => {
  const r = await fightWild(mon(w.kind, 48), { canRun: true, area: 'tray' });
  if (r.pegged.length) { setFlag(w.id + 'gone'); await giveMon(r.pegged[0]); }
  else if (r.result === 'win') { await fadeWho(w.id, false, 40); setFlag(w.id + 'gone'); }
});

defScript('htEnter', async () => {
  startFrameHook('hollowtop');
  htMovedAt = field.t; htLastX = field.x; htLastY = field.y;
  for (const k of Object.keys(htState)) delete htState[k];
  for (const k of Object.keys(htTimers)) delete htTimers[k];
  if (!flag('htSeen')) {
    setFlag('htSeen');
    // A whole small country lies still in the dusk inside the shell: streets, open doors, a cart, washing that does not move.
    evening(true);
    await pan(15, 10);
    await wait(40);
    await panBack();
    await hint('(Doors here open only when nothing moves near them.)');
  }
});

// ---------------------------------------------------------------- the old Apex (release)

const oa = new Canvas(24, 18, '#');
oa.rect(2, 2, 20, 14, '.').rect(1, 4, 1, 10, '.').rect(22, 4, 1, 10, '.');
for (const [x, y] of [[4, 4], [8, 3], [15, 5], [19, 9], [6, 12], [17, 13], [10, 14], [13, 7]]) oa.put(x, y, 'x');
oa.rect(11, 6, 2, 2, 'j').rect(9, 8, 6, 1, 'j').rect(11, 8, 2, 1, 'B').rect(11, 9, 2, 2, 'j');
oa.put(11, 16, '.').put(11, 17, 'q');

defMap({
  id: 'oldapex', name: 'The old Apex', region: 32, music: 'cinchReal', strand: true,
  rows: oa.rows(),
  warps: [{ x: 11, y: 17, to: 'tray', tx: 25, ty: 7, dir: 0 }],
  enter: 'oaEnter',
  tileTalk: { B: 'oaPost', j: 'oaPost' },
  npcs: [
    { id: 'oacast', x: 11, y: 11, sprite: 'cinch', name: 'Cinch\'s cast', dir: 0, img: pale('cinch'), talk: 'oaCast', when: () => !flag('castBeaten') },
    { id: 'oacinch', x: 3, y: 13, sprite: 'realcinch', name: 'Cinch', dir: 1, talk: 'oaCinch' },
  ],
  spots: [look(5, 2, 'The flat round place, crazed all over. Through the crazes, far below, the Tray\'s rows.')],
});

defScript('oaEnter', async () => {
  if (flag('oaSeen')) return;
  setFlag('oaSeen');
  // The old Apex: the flat round place, crazed all over, and Cinch's cast at the Operculum with its hands in the air,
  // holding nothing. Cinch comes along behind and sits on the edge.
  offstage('oacinch');
  await pan(11, 9);
  await wait(40);
  await panBack();
  await walkIn('oacinch', 11, 16, 3, 13);
  await act('oacinch', 'bow');
  await cinch('Sit. That\'s me, there. Still at it.');
});
defScript('oaPost', async () => { await emote('ouro', 'silence'); });
defScript('oaCinch', async () => {
  if (flag('castBeaten')) { await cinch('There. Both of us sitting. Only took forty years.'); return; }
  await cinch('Sit and watch me a while. Funny. Never stops, does it.');
});
/** Cinch's cast in the old Apex, release only. Strand level 48. */
export const castTeam = () => [mon('knot', 62), mon('menhir', 47), mon('halo', 47), mon('orrery', 47)];
defScript('oaCast', async () => {
  await say('Cinch\'s cast', 'THE VOLUTE HAS TO HOLD AND SOMEONE HAS TO STAND HERE AND THE POST HAS TO TURN ONCE A DAY');
  await say('Cinch\'s cast', 'AND ONCE A DAY AND ONCE A DAY AND ONCE A-');
  await say('Cinch\'s cast', 'YOU WILL HAVE TO MAKE ME PUT MY HANDS DOWN AND THEY WILL NOT COME DOWN');
  await say('Cinch\'s cast', 'AND THEY HAVE TO STAY AT THE HEIGHT OF THE ARMS AND YOU WILL HAVE TO MAKE ME AND-');
  if (!await keeperFight('Cinch\'s cast', castTeam, 'champion', 'battleCinch')) return;
  setFlag('castBeaten');
  // The cast's hands come down to its sides for the first time.
  await act('oacast', 'shiver');
  await cinch('Sit down by me, then. You\'ve stood long enough.');
  await walkTo('oacast', 4, 13);
  await wait(30);
  await act('oacast', 'bow');
  const knot = mon('knot', 61);
  knot.strand = { level: 55, xp: 0 };
  await giveMon(knot);
  save();
});

// ---------------------------------------------------------------- the ring (the Knucklebones, after chapter 5)

const kb = MAPS.knucklebones;
if (kb) {
  const rp = kb.npcs.find(n => n.id === 'ringpolish');
  if (rp) rp.talk = 'ringPolisher';
  (kb.spots ||= []).unshift({ x: 26, y: 10, when: () => !!flag('ringAsked') && !flag('ringRead'), script: ringNight });
  const counter = SCRIPTS.counter;
  defScript('counter', async () => {
    if (flag('ringRead')) { await say('Counter', 'Four. W, A, D, E. Still four. Only count I\'ve ever been sure of.'); return; }
    if (flag('ringAsked') && flag('springHigh')) {
      await say('Counter', 'Four. Letters, I think, in the shine on the far knuckle. Can\'t read backward, me.');
      await say('Counter', 'One. Star, that\'s what it takes. Maybe two. Stand on the far knuckle at night and wait.');
      return;
    }
    await counter();
  });
}
// The Ring polisher talks only about how the ring shines.
defScript('ringPolisher', async () => {
  if (flag('ringAsked') && !flag('ringRead')) {
    await say('Ring polisher', 'It shines now! Forty years of rubbing, and look at it go :-]');
    await say('Ring polisher', 'When a star falls at night, it shines right across to the far knuckle. All the way!');
    return;
  }
  await say('Ring polisher', 'Mind the shine on your way out. It gets in your eyes, the good way.');
});
async function ringNight(): Promise<void> {
  // Ouro waits on the far knuckle for night. A star lands in the dust beyond the thumb, and its light goes through
  // the ring and across the knuckle in a band with four letters in it, backward.
  await tint('#0b0a10', 0.5, 40);
  evening(true);
  await tint('#0b0a10', 0, 30);
  strandFx.landings.push({ x: 34, y: 9, t: 0 });
  await wait(20);
  field.flashT = 14;
  await say('Band of light', 'EDAW');
  await act('ouro', 'look');
  await emote('ouro', 'surprise');
  setFlag('ringRead');
  await say('Counter', 'Four. W, A, D, E. Four, and I\'m sure. Had the ring down as a knuckle for years. It\'s a name.');
  evening(false);
  await reward({ tan: 4, notion: 'polishedring' });
}

void ownsKind; void PEOPLE;
