// Act 2, chapter 2: the Cowrie. Its back, the Polish, the Under-teeth, the Glaze Halls, and Gloss's hall.
// Side missions: who drills the cowries, and the footprints in the gray. See Notes/act2-script.md.
import { sfx } from '../../engine/audio';
import { text } from '../../engine/font';
import { input } from '../../engine/input';
import { PEOPLE } from '../../engine/sprites';
import { makeMon, SPECIES } from '../../data/species';
import { battle } from '../../game/battleView';
import { act, bell, choose, emote, evening, face, faceToward, field, fightTrainer, fightWild, giveMon, goal, hint, mon, morphTo, narr, pan, panBack, prop, say, sound, tint, unprop, wait, walkTo, walkUp } from '../../game/api';
import { G, flag, save, setFlag } from '../../game/state';
import { strandFx } from '../../game/strandfx';
import { defMap, defScript, MAPS, SCRIPTS, type MapDef } from '../../game/world';
import { Canvas, highTide, kinds, look, reward, stash } from '../areakit';
import { smallGranLine } from '../ch1';
import { brack } from '../ch3';
import { FOOTPRINTS, giveGrain } from './kit';
import {
  cinch, grains, keeperFight, low, person, release, sayAll, scriptedHigh, scriptedLow, strandBoard, strandmongerHooks, tideRuns, tideWatch,
} from './ch1';

type Mod = NonNullable<MapDef['mods']>[number];
const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0];
const marked = () => !!flag('cowrieMarked');
const mouthOpen = () => !!flag('mouthOpen');
const smallGranHere = () => G.party.some(m => m.kind === 'smallgranw');

// ---------------------------------------------------------------- the Flats, release: Tack

MAPS.flats.npcs.push(person('a2TackFlats', 24, 9, 'tack', 'Tack', 0, { when: () => release() && grains() >= 1 && !flag('tackFlats') && low() }));
/** Tack's four on the Flats (release only). Ouro arrives with the Strand cap at 25. */
export const tackFlatsTeam = () => [brack(28), ...([['razor', 27], ['mote', 27], ['skitter', 26]] as const).map(([k, l]) => makeMon(k, l))];
// Tack says a number in every line.
defScript('a2TackFlats', async () => {
  face('a2TackFlats', 0);
  await act('a2TackFlats', 'nod');
  faceToward('a2TackFlats', 'ouro');
  await say('Tack', '47 footprints from the big shell to here. Each 1\'s the size of a pond. Walked round all of them.');
  await say('Tack', '2nd battle out here, 1st real one. Brack\'s at Strand level 14. I checked twice.');
  await say('Tack', '1 of us is going home wet. Not me.');
  const r = await battle({ enemy: tackFlatsTeam(), name: 'Tack', ai: 'trainer', wild: false, bg: field.bg(), music: 'rival' });
  field.playMapMusic();
  if (r.result !== 'win') { await say('Tack', '1 for me. Go on, count it.'); await field.lose(); return; }
  setFlag('tackFlats');
  G.flags.tackWins = (G.flags.tackWins || 0) + 1;
  await say('Tack', `${G.flags.tackWins} losses. Even out here. Great.`);
  await say('Tack', 'Footprints keep going. 1 every 30 steps. I\'m counting the rest. Don\'t wait up.');
});

// ---------------------------------------------------------------- the Cowrie's back

const CB_W = 40, CB_H = 30, DOME = { x: 20, y: 13, rx: 12, ry: 7 };
const inDome = (x: number, y: number) => ((x - DOME.x) / DOME.rx) ** 2 + ((y - DOME.y) / DOME.ry) ** 2 <= 1;
const cb = new Canvas(CB_W, CB_H, '.').border('#');
for (let y = 0; y < CB_H; y++) for (let x = 0; x < CB_W; x++) if (inDome(x, y)) cb.put(x, y, '#');
// footholds up the gloss to the drill hole, the mouth on the seaward side, the sea beyond
cb.rect(20, 6, 1, 7, '=').put(20, 13, 'O');
cb.rect(17, 18, 6, 3, '#').put(0, 16, '=').put(CB_W - 1, 16, '=');
cb.rect(1, 28, CB_W - 2, 1, '~');
for (const [x, y, w, h] of [[5, 3, 5, 2], [28, 3, 6, 2], [2, 22, 4, 2], [34, 21, 4, 2]]) cb.rect(x, y, w, h, ',');
const POSTS: [number, number][] = [[7, 5], [33, 5], [7, 20], [33, 20]];
const MOUTH_DOOR: [number, number][] = [[19, 20], [20, 20]];
// Spots on the dome's edge, one of which is the spot that moves: dome tiles with open sand beside them.
const domeEdge = (x: number, y: number) => inDome(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !inDome(x + a, y + b));
const EDGE = [[9, 12], [31, 13], [14, 19], [27, 18]].map(([x, y]) => {
  for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (domeEdge(x + dx, y + dy)) return [x + dx, y + dy];
  return [x, y];
});
let movingSpot = 0;
const CB_GRAY = Array.from({ length: 2 }, () => '.' + 'Y'.repeat(CB_W - 2));
const CB_SEA = ['.' + 'A'.repeat(CB_W - 2), '.' + 'A'.repeat(CB_W - 2)];
CB_SEA[0] = CB_SEA[0].slice(0, 30) + '..' + CB_SEA[0].slice(32);
const cbMods: Mod[] = [
  ...MOUTH_DOOR.map(([x, y]) => ({ x, y, ch: '_', when: mouthOpen })),
  ...POSTS.flatMap(([x, y]) => [{ x, y, ch: 'f', when: marked }, { x, y: y + 1, ch: 'f', when: marked }]),
  { x: 23, y: 21, ch: 'f', when: marked }, { x: 23, y: 22, ch: 'f', when: marked },
  ...CB_GRAY.flatMap((r, j) => [{ x: 1, y: 24 + j, w: CB_W - 2, ch: 'Y', when: highTide }]),
  ...tideRuns(CB_SEA, 0, 26),
];
FOOTPRINTS.cowrieback = [[4, 25], [10, 25], [16, 25], [22, 25], [28, 25], [34, 25]];

defMap({
  id: 'cowrieback', name: 'The Cowrie\'s Back', region: 27, music: 'cowrie', strand: true,
  rows: cb.rows(),
  mods: cbMods,
  props: [
    { x: 17, y: 18, pic: 'cowrieMouth' },
    ...POSTS.map(([x, y]) => ({ x, y, pic: 'whitePost', when: marked })),
    { x: 23, y: 21, pic: 'labelPost', when: marked },
  ],
  warps: [
    { x: 0, y: 16, to: 'flats', tx: 44, ty: 10, dir: 3 },
    { x: CB_W - 1, y: 16, to: 'augerdune', tx: 1, ty: 18, dir: 1 },
    ...MOUTH_DOOR.map(([x, y]) => ({ x, y, to: 'underteeth', tx: 4, ty: 10, dir: 2, when: mouthOpen })),
  ],
  enter: 'a2CowrieBackEnter',
  zone: {
    kinds: kinds([['macula', 3], ['scud', 3], ['skitter', 2], ['seiche', 2], ['pallium', 2]]), lv: [14, 20], n: 9, area: 'cowrie',
    tideKinds: { high: kinds([['seiche', 3], ['pallium', 2], ['scud', 2]]), low: kinds([['macula', 3], ['scud', 2], ['skitter', 2]]) },
  },
  npcs: [
    person('a2SpotCounter', 30, 6, 'cowrie1', 'Spot-counter', 3, { trainer: { name: 'Spot-counter', team: [['macula', 18], ['pallium', 18]], intro: 'I count the Cowrie\'s spots. They move when I blink. So I don\'t blink. Ow.', defeat: 'Lost count. Blinked. From the top.', sight: 3 } }),
    person('a2SeicheStander', 12, 24, 'cowrie2', 'Seiche-stander', 2, { when: highTide, trainer: { name: 'Seiche-stander', team: [['seiche', 19], ['scud', 19]], intro: 'I stand in the gray at high water. It\'s super warm in there. Nobody believes me.', defeat: 'Back in the gray. It\'s warm in there, I swear.', sight: 2 } }),
    person('a2CinchPosts', 8, 22, 'realcinch', 'Cinch', 3, { when: () => marked() && !flag('cinchLeftPosts') }),
  ],
  spots: [
    { x: 20, y: 13, script: 'a2DrillHole' },
    stash('cb_top', 21, 12, 'On top of the dome, in a dip worn by feet, a triton horn.', { pegs: ['bone', 1] }),
    { x: 31, y: 26, when: () => highTide() && !flag('found_cb_gray'), script: async () => {
      setFlag('found_cb_gray');
      await reward({ notion: 'thornvest' });
    } },
    ...EDGE.map(([x, y], i) => ({ x, y, when: () => movingSpot === i, script: 'a2MovingSpot' })),
    ...[[17, 20], [18, 20], [21, 20], [22, 20]].map(([x, y]) => ({ x, y, script: 'a2MouthOutside' })),
    ...POSTS.flatMap(([x, y]) => [{ x, y: y + 1, when: marked, script: 'a2WhitePost' }, { x, y, when: marked, script: 'a2WhitePost' }]),
    { x: 23, y: 22, when: marked, script: 'a2CowrieLabel' }, { x: 23, y: 21, when: marked, script: 'a2CowrieLabel' },
    ...[[3, 24], [6, 25], [24, 24]].map(([x, y]) => ({ x, y, when: highTide, script: 'a2Gray' })),
    { x: 14, y: 19, when: () => !!flag('drill2'), script: 'a2DrillCowrie' },
  ],
});

defScript('a2CowrieBackEnter', async () => {
  movingSpot = (movingSpot + 1 + Math.floor(G.time % 3)) % EDGE.length;
  if (flag('cbSeen')) return;
  setFlag('cbSeen');
  // The Cowrie's dome rises out of the sand, glossy and spotted, and the line of footprints passes close on its seaward side.
  await pan(20, 16);
  await wait(40);
  await panBack();
});

defScript('a2MovingSpot', async () => {
  await emote('ouro', 'question');
});

defScript('a2Gray', async () => {
  await emote('ouro', 'silence');
  if (!flag('grayTold')) { setFlag('grayTold'); await hint('(A SALT whorl worn in the lead walks you through gray.)'); }
});

defScript('a2MouthOutside', async () => {
  if (mouthOpen()) { await act('ouro', 'shiver'); return; }
  sound('bump');
  await emote('ouro', 'silence');
});

defScript('a2DrillHole', async () => {
  if (await choose(['Climb in the hole', 'Not now']) !== 0) return;
  await act('ouro', 'hop');
  field.warp('polish', 18, 3, 0);
});

defScript('a2WhitePost', async () => {
  await emote('ouro', 'question');
});
defScript('a2CowrieLabel', async () => {
  await say('Label', 'KEEP THE COWRIE.');
});
defScript('a2CinchPosts', async () => {
  await cinch('Still here? Sit. Came down when the stamping started. Heard it from the bar.');
  await cinch('Four posts. White ones.');
  await cinch('From down here they look new.');
});

// ---------------------------------------------------------------- the Polish

// Ouro's reflection in the floor walks Ouro's path three steps late. It lives in the Polish and the Glaze Halls.
let hist: [number, number][] = [];
function resetReflection(): void { hist = [[field.x, field.y], [field.x, field.y], [field.x, field.y], [field.x, field.y]]; placeReflection(); }
function reflection(): [number, number] { return hist.length >= 4 ? hist[hist.length - 4] : hist[0] || [field.x, field.y]; }
function placeReflection(): void {
  const n = field.npcs.find(n => n.def.id === 'a2Refl');
  if (!n) return;
  const [x, y] = reflection();
  n.x = x; n.y = y;
}
const reflectionImg = () => ({ px: PEOPLE.vellum.px, c: ['#e8dcc8', '#b8a890'] as [string, string] });

const PO_W = 36, PO_H = 28;
const po = new Canvas(PO_W, PO_H, '_').border('#');
po.put(18, 0, 'q').rect(17, 2, 3, 2, 'x');
po.rect(1, 8, PO_W - 2, 1, '#').put(5, 8, '_').put(30, 8, '_');
po.rect(1, 15, PO_W - 2, 1, '#').put(10, 15, '_').put(25, 15, '_');
for (const [x, y] of [[4, 4], [28, 4], [8, 10], [22, 10], [5, 17], [27, 17], [12, 4], [21, 4]]) po.rect(x, y, 3, 2, 'h');
po.rect(1, 22, PO_W - 2, 2, 'M').put(18, 26, 'q').put(PO_W - 1, 12, 'd');
po.rect(14, 11, 2, 1, '~').put(24, 18, 'c');
for (const [x, y, w, h] of [[2, 5, 2, 2], [31, 11, 3, 2], [14, 19, 3, 2]]) po.rect(x, y, w, h, ',');
po.put(20, 22, '_');
defMap({
  id: 'polish', name: 'The Polish', region: 27, music: 'cowrie', strand: true,
  rows: po.rows(),
  mods: [{ x: 20, y: 22, ch: 'M', when: () => true }],
  warps: [
    { x: 18, y: 0, to: 'cowrieback', tx: 20, ty: 12, dir: 2 },
    { x: 18, y: 26, to: 'underteeth', tx: 12, ty: 1, dir: 0 },
    { x: PO_W - 1, y: 12, to: 'glazehalls', tx: 8, ty: 22, dir: 2 },
  ],
  enter: 'a2PolishEnter',
  zone: { kinds: kinds([['enamel', 3], ['porcella', 2], ['specie', 2], ['emery', 2], ['faience', 2]]), lv: [15, 21], n: 6, area: 'cowrie' },
  npcs: [
    { id: 'a2Refl', x: 18, y: 3, sprite: 'vellum', ghost: true, img: reflectionImg, when: () => !marked() || field.y < 13 },
    person('a2PoWoman', 9, 6, 'cowrie1', 'Woman', 0),
    person('a2PoOldMan', 16, 6, 'cowrie2', 'Old man', 0),
    person('a2PoGirl', 26, 12, 'cowrie1', 'Girl', 3),
    person('a2PoMan', 6, 12, 'cowrie2', 'Man', 1),
    person('a2PoBowl', 23, 18, 'cowrie1', 'Woman with a bowl', 1),
    person('a2PoBoy', 12, 18, 'cowrie2', 'Boy', 0, { wander: true }),
    person('a2PoOldWoman', 30, 18, 'cowrie1', 'Old woman', 3),
    person('a2Clerk', 18, 12, 'villager2', 'Gloss\'s clerk', 0),
    person('a2Polisher', 32, 5, 'cowrie2', 'Polisher', 3, { trainer: { name: 'Polisher', team: [['enamel', 20], ['emery', 20]], intro: 'I polish the sky. All of it. You\'re next, you\'ve got smudges.', defeat: 'Smudged. Leave it. Don\'t you dare wipe it.', sight: 3 } }),
    person('a2PigKeeper', 3, 19, 'cowrie2', 'Pig-keeper', 1, { trainer: { name: 'Pig-keeper', team: [['porcella', 20], ['specie', 21]], intro: 'My pig\'s glazed. So\'s my purse. So\'s my other pig.', defeat: 'Glaze cracks. Yeah. I knew that.', sight: 3 } }),
    person('a2MaculaChild', 20, 21, 'cowrie1', 'Child', 0),
    { id: 'a2ChildMacula', x: 20, y: 22, sprite: 'stone', name: 'Madaku', mon: SPECIES.macula ? 'macula' : undefined, lines: ['A small dark spot stands on the blank, on nothing at all.'] },
  ],
  spots: [
    look(14, 11, 'A pool of polish. Ouro leans over it. Nothing looks back for three breaths. Then Ouro does.'),
    look(12, 8, 'Small handprints pressed into the polish when it was soft, hundreds of them, at one height.', 'The highest one is a little higher than the rest.'),
    { x: 24, y: 18, script: 'a2Bowl' },
    look(18, 2, 'A heap of cushions under the drill hole. Somebody plumps them after every drop.'),
    ...[3, 10, 27, 33].map(x => ({ x, y: 22, script: 'a2Blank' })),
  ],
});

defScript('a2PolishEnter', async () => {
  resetReflection();
  if (low()) field.shakeT = 10;
  if (flag('polishSeen')) return;
  setFlag('polishSeen');
  // Ouro drops onto a heap of cushions inside the polished dome, and the town's straight-backed people come to look.
  sound('bump');
  await act('ouro', 'hop');
  for (const id of ['a2PoWoman', 'a2PoOldMan', 'a2Clerk']) faceToward(id, 'ouro');
  await walkTo('a2PoOldMan', 17, 5);
  faceToward('a2PoOldMan', 'ouro');
  await emote('a2PoOldMan', 'question');
  goal('Gloss keeps the mouth. The way down is past the blank, at the bottom of town.');
});

field.stepHooks.push(f => {
  if (f.map.id !== 'polish' && f.map.id !== 'glazehalls') return;
  hist.push([f.x, f.y]);
  if (hist.length > 8) hist.shift();
  placeReflection();
});

defScript('a2Blank', async () => {
  await emote('ouro', 'silence');
});

defScript('a2Bowl', async () => {
  if (!flag('found_po_bowl')) {
    setFlag('found_po_bowl');
    await reward({ pegs: ['brass', 1], tan: 2 });
  } else await emote('ouro', 'silence');
});

/** A Cowrie townsperson: the line for the latest thing that has happened, or the tide. */
function cowrieTalk(id: string, name: string, l: { base: string; low?: string; high?: string; open?: string; take?: string }): void {
  defScript(id, async () => {
    const line = (marked() && l.take) || (mouthOpen() && l.open) || (low() && l.low) || (highTide() && l.high) || l.base;
    await say(name, line);
  });
}
cowrieTalk('a2PoWoman', 'Woman', { base: 'We polish the inside every day. You can see your feet in it. A bit late, but you can.', low: 'Low water. Stamp! Come on, stamp.', take: 'Something touched the floor. So we stamped. And it went. That\'s all I know.' });
cowrieTalk('a2PoOldMan', 'Old man', {
  base: 'Your reflection\'s three steps behind. Mine\'s four. I\'m older, so.', low: 'Stamping. My reflection\'s stamping too, eventually.',
  open: 'There\'s a draft from the mouth. Haven\'t felt one since I was three behind.', take: 'Floor\'s crooked now. And I\'m four behind. Give me a year.',
});
cowrieTalk('a2PoGirl', 'Girl', {
  base: 'The mouth\'s been shut since my gran\'s gran. We like it shut. Shut is good.', low: 'You stamp too, okay? Everybody stamps at low.',
  open: 'Who opened the mouth? Was it you? Ugh. Now we\'ll have to stamp more.', take: 'Posts outside now. Gran says they\'re for us. Didn\'t say what for.',
});
cowrieTalk('a2PoMan', 'Man', {
  base: 'At low water we all stamp at once. It\'s the only dance we\'ve got. It\'s a good dance.',
  high: 'High water, and everything\'s rolled to the seaward wall again. Leave it. I do.', take: 'From now on we stamp every low. Harder. Way harder.',
});
cowrieTalk('a2PoBowl', 'Woman with a bowl', { base: 'You lot spend little cowries? Fine by us. They\'re nobody\'s.' });
cowrieTalk('a2PoBoy', 'Boy', { base: 'Gloss lives at the mouth. Gloss says everything twice. We just say it once. Once is plenty.', high: 'High water! Lean or slide. I slide.' });
cowrieTalk('a2PoOldWoman', 'Old woman', { base: 'The spots on the sky go round once a year, dear. That one\'s late. Always is.' });

defScript('a2Clerk', async () => {
  await strandBoard({
    id: 'a2peg2', name: 'Gloss\'s clerk', deck: ['macula', 'laggard', 'enamel', 'porcella', 'luster'], tier: 6, prize: 'glazecoat',
    lines: ['I play Gloss\'s cards. Gloss plays nothing whatsoever, and wins!! Most efficient.', 'We observe the Strand rule. The bottom row is wet. Do mind your edges, lest they soggify.'],
  });
});

defScript('a2MaculaChild', async () => {
  await say('Child', 'That pale bit\'s the blank. It\'s where the Cowrie never finished. You can\'t walk on it.');
  await say('Child', 'My spot can! It came off the sky. It walks on nothing. It\'s so good at it.');
  // The child's Madaku steps onto the blank and stands there, small and dark.
  await prop('madaku', 'mon:macula', 20, 22, 16);
  await wait(30);
  await say('Child', 'Wear one like it and you can walk it too. They\'re on the back, outside. Go catch one!');
  await unprop('madaku', 16);
  if (!flag('blankTold')) { setFlag('blankTold'); await hint('(A VOID whorl worn in the lead walks you across the blank.)'); }
});

// ---------------------------------------------------------------- the Under-teeth: the teeth

// Five teeth along the slit, numbered from the light end. Tooth 1 moves any time. Any other tooth moves only
// when the tooth before it is open and every tooth before that is shut. From all shut, opening teeth 1 to 4
// takes ten moves and opening all five takes twenty-one (scratchpad teeth.mjs).
const TEETH: [number, number][] = [[4, 8], [8, 8], [12, 8], [16, 8], [20, 8]];
const toothOpen = (i: number) => !!flag('tooth' + i);
function canMove(i: number): boolean {
  if (i === 0) return true;
  if (!toothOpen(i - 1)) return false;
  for (let k = 0; k < i - 1; k++) if (toothOpen(k)) return false;
  return true;
}
const ut = new Canvas(24, 13, '_').border('#');
ut.put(12, 0, 'q').rect(1, 8, 22, 1, '#').rect(1, 9, 22, 3, '#');
for (const [x, y] of TEETH) ut.put(x, y, 'T').put(x, y + 1, '_');
ut.rect(20, 9, 3, 1, '_').put(4, 10, 'j').put(4, 11, 'd');
for (const [x, y, w, h] of [[2, 2, 3, 2], [18, 2, 4, 2], [8, 5, 3, 1]]) ut.rect(x, y, w, h, ',');
defMap({
  id: 'underteeth', name: 'The Under-teeth', region: 27, music: 'cowrie', strand: true,
  rows: ut.rows(),
  mods: [
    ...TEETH.map(([x, y], i) => ({ x, y, ch: '_', when: () => toothOpen(i) })),
    { x: 4, y: 10, ch: '_', when: mouthOpen },
  ],
  warps: [
    { x: 12, y: 0, to: 'polish', tx: 18, ty: 25, dir: 2 },
    { x: 4, y: 11, to: 'cowrieback', tx: 19, ty: 21, dir: 0, when: mouthOpen },
  ],
  enter: 'a2TeethEnter',
  // Gimlet is found only at the end of the drill-hole trail.
  zone: {
    kinds: kinds([['denticle', 3], ['diastema', 2], ['furl', 2], ['gimlet', 1]]), lv: [16, 22], n: 5, area: 'cowrie',
    tideKinds: { high: kinds([['denticle', 3], ['diastema', 2], ['furl', 2]]), low: kinds([['denticle', 3], ['diastema', 2], ['furl', 2]]) },
  },
  npcs: [person('a2ToothSitter', 10, 7, 'cowrie1', 'Tooth-sitter', 0)],
  spots: [
    ...TEETH.map(([x, y], i) => ({ x, y, script: () => toothScript(i) })),
    stash('ut_fifth', 22, 9, 'Past the fifth tooth, in the packed sand, a nautilus horn and a notion.', { pegs: ['iron', 1], notion: 'bodkin' }),
    { x: 21, y: 10, when: () => !!flag('drill3') && !flag('gimletDone'), script: 'a2Gimlet' },
    look(4, 10, 'The slit. A line of light comes up through it from outside.'),
  ],
});

defScript('a2TeethEnter', async () => {
  if (flag('teethSeen')) return;
  setFlag('teethSeen');
  await pan(12, 8);
  await wait(30);
  await panBack();
});

async function toothScript(i: number): Promise<void> {
  const open = toothOpen(i);
  if (!flag('teethRule')) { await emote('ouro', 'question'); return; }
  if (!canMove(i)) { sound('bump'); field.shakeT = 2; await emote('ouro', 'sweat'); return; }
  if (await choose([`${open ? 'Shut' : 'Open'} tooth ${i + 1}`, 'Leave it'], true) !== 0) return;
  setFlag('tooth' + i, open ? 0 : 1);
  sfx('switch');
  field.shakeT = 4;
  if (!mouthOpen() && [0, 1, 2, 3].every(toothOpen)) await openMouth();
}

async function openMouth(): Promise<void> {
  // The teeth grind, sand pours out of every gap, and the slit widens into a long low door with cold air coming in.
  field.shakeT = 30;
  sfx('boom');
  await morphTo('mouthOpen', 4, 10);
  sound('wind');
  await act('ouro', 'shiver');
  goal('With the mouth open, starlight crosses the Glaze Halls at low water. The door is in the Polish.');
}

defScript('a2ToothSitter', async () => {
  if (!flag('teethRule')) {
    setFlag('teethRule');
    await say('Tooth-sitter', 'The tooth at the light end moves whenever you like. That one\'s the easy one.');
    await say('Tooth-sitter', 'Any other one moves if the next one lightward\'s open and the rest past it are shut.');
    await hint('(Open the first four teeth to open the mouth.)');
    return;
  }
  const k = 'underteeth:a2ToothSitter';
  if (!G.beaten[k]) {
    await say('Tooth-sitter', 'I sit between the teeth. Only gap in town. I got here first.');
    const r = await fightTrainer({ name: 'Tooth-sitter', team: [['denticle', 21], ['diastema', 21]], intro: '', defeat: '' });
    if (r.result === 'win') { G.beaten[k] = 1; save(); await say('Tooth-sitter', 'Okay, gap\'s yours.'); }
    return;
  }
  await say('Tooth-sitter', 'Gap\'s yours. Mind the sand.');
});

// ---------------------------------------------------------------- the Glaze Halls: the late reflection

// Floor plates hold their doors while Ouro stands on them, and plates under the glaze while the reflection does.
// Halls lit only at low water with the mouth open. Shortest walks, checked with scratchpad glaze.mjs:
// hall 1, 11 steps from the door to the next hall; hall 2, 9; hall 3, 11 (the chamber between its two doors is
// crossed in two steps); hall 4, 7; 38 in all. Each door Ouro has passed stays open while the halls are lit.
const GH = [
  '########d########',
  '########j########',
  '#...............#',
  '#......#........#',
  '#......u........#',
  '#...............#',
  '########j########',
  '#######...#######',
  '#######...#######',
  '########j########',
  '#.......u.....,,#',
  '#.....u.......,,#',
  '#...............#',
  '########j########',
  '#.......P...u.###',
  '#.....u.......#.#',
  '#.............j.#',
  '#.............###',
  '########j########',
  '#....u..........#',
  '#...............#',
  '#.............,,#',
  '#.............,,#',
  '########d########',
];
type Door = { x: number; y: number; open: () => boolean; hall: number };
const at = (x: number, y: number) => field.x === x && field.y === y;
const reflAt = (x: number, y: number) => { const [rx, ry] = reflection(); return rx === x && ry === y; };
const lit = () => low() && mouthOpen();
const passed = (k: string) => !!flag('ghPassed_' + k);
const DOORS: Record<string, Door> = {
  d1: { x: 8, y: 18, hall: 1, open: () => reflAt(5, 19) },
  d2: { x: 8, y: 13, hall: 2, open: () => at(8, 14) && reflAt(6, 15) },
  d3a: { x: 8, y: 9, hall: 3, open: () => reflAt(6, 11) },
  d3b: { x: 8, y: 6, hall: 3, open: () => reflAt(8, 10) },
  d4: { x: 8, y: 1, hall: 4, open: () => reflAt(7, 4) },
  side: { x: 14, y: 16, hall: 2, open: () => reflAt(12, 14) },
};
const cracked = (d: Door) => marked() && d.hall <= 2 && d !== DOORS.side;
function doorOpen(k: string): boolean {
  const d = DOORS[k];
  if (cracked(d)) return true;
  if (!lit()) return false;
  return d.open() || at(d.x, d.y) || (k !== 'side' && passed(k));
}
defMap({
  id: 'glazehalls', name: 'The Glaze Halls', region: 27, music: 'cowrie', strand: true, dark: true,
  rows: GH.map(r => r.replace(/u/g, 'G')),
  mods: Object.keys(DOORS).map(k => ({ x: DOORS[k].x, y: DOORS[k].y, ch: '_', when: () => doorOpen(k) })),
  warps: [
    { x: 8, y: 23, to: 'polish', tx: PO_W - 2, ty: 12, dir: 3 },
    { x: 8, y: 0, to: 'glosshall', tx: 7, ty: 11, dir: 2 },
  ],
  enter: 'a2GlazeEnter',
  zone: { kinds: kinds([['laggard', 3], ['tain', 2], ['luster', 2]]), lv: [17, 22], n: 3, area: 'cowrie' },
  npcs: [
    { id: 'a2Refl', x: 8, y: 22, sprite: 'vellum', ghost: true, img: reflectionImg, when: () => lit() && !(marked() && field.y >= 13) },
    person('a2ReflChaser', 13, 12, 'cowrie2', 'Reflection-chaser', 3, { trainer: { name: 'Reflection-chaser', team: [['laggard', 22], ['luster', 21]], intro: 'I chase my reflection down here! It\'s always three behind. I\'m gonna get it one day.', defeat: 'Whoa. It caught up. That\'s never happened before.', sight: 3 } }),
  ],
  spots: [
    { x: 15, y: 16, when: () => !flag('found_gh_niche'), script: async () => {
      setFlag('found_gh_niche');
      await reward({ tan: 3 });
    } },
    ...Object.keys(DOORS).map(k => ({ x: DOORS[k].x, y: DOORS[k].y, when: () => !doorOpen(k), script: async () => {
      if (cracked(DOORS[k])) return;
      sound('bump');
      await emote('ouro', lit() ? 'question' : 'silence');
    } })),
  ],
});
const updateGlazeLight = () => { MAPS.glazehalls.dark = !lit(); };
tideWatch.push(() => { updateGlazeLight(); if (field.map.id === 'glazehalls') resetReflection(); });

defScript('a2GlazeEnter', async () => {
  updateGlazeLight();
  resetReflection();
  if (marked() && !flag('ghCrackSeen')) {
    setFlag('ghCrackSeen');
    await emote('ouro', 'question');
  }
  if (!lit()) {
    if (!flag('ghDarkSeen')) { setFlag('ghDarkSeen'); await hint('The halls are dark at high tide. At low water, with the mouth open, starlight comes in.'); }
    return;
  }
  if (flag('ghLitSeen')) return;
  setFlag('ghLitSeen');
  // A star lands outside the mouth and rings of light come in across the glaze. Ouro's reflection stands three steps back.
  strandFx.landings.push({ x: 8, y: 1, t: 0 });
  await wait(40);
  await emote('ouro', 'surprise');
  await hint('(Your reflection walks your path three steps behind you.)');
  await hint('(A plate in the glaze opens its door while your reflection stands on it.)');
});

field.stepHooks.push(f => {
  if (f.map.id !== 'glazehalls' || !lit()) return;
  for (const k of Object.keys(DOORS)) if (k !== 'side' && at(DOORS[k].x, DOORS[k].y)) setFlag('ghPassed_' + k);
});

// ---------------------------------------------------------------- Gloss's hall: the walk there and back

// The floor keeps every step since Ouro came in or last bumped a pillar. A door opens when Ouro stands beside it
// and the kept steps number its length and read the same backward. Checked with scratchpad palin.mjs:
// four (two walks, none straight): bump the pillar west of 4,3, then up, left, left, up.
// five (ten walks): bump the pillar below 10,2, then right, up, down, up, right.
// seven (22 walks): from the door, left, left, left, up, left, left, left.
const GL = [
  '###############',
  '#j...........j#',
  '#.............#',
  '#..p......p...#',
  '#.............#',
  '#.....p.p.....#',
  '#.............#',
  '#.............#',
  '#...p.....p...#',
  '#.............#',
  '#....p........#',
  '#j............#',
  '#######d#######',
];
const GDOORS = [{ x: 1, y: 1, n: 4, word: 'Four' }, { x: 13, y: 1, n: 5, word: 'Five' }, { x: 1, y: 11, n: 7, word: 'Seven' }];
const gdOpen = (i: number) => !!flag('glossDoor' + i);
let kept: number[] = [];
let bumpHeld = false;
const ARROW = ['v', '>', '^', '<'];
function glossOverlay(f: typeof field): void {
  if (f.map.id !== 'glosshall' || GDOORS.every((_, i) => gdOpen(i))) return;
  text(`Floor ${kept.slice(-8).map(d => ARROW[d]).join(' ') || '-'}`, 3, 3, '#ffffff');
  if (f.busy || f.moving) return;
  const d = (['down', 'right', 'up', 'left'] as const).findIndex(b => input.held(b));
  const hit = d >= 0 && GL[f.y + DY[d]]?.[f.x + DX[d]] === 'p';
  if (hit && !bumpHeld) { kept = []; sfx('bump'); }
  bumpHeld = hit;
}
FOOTPRINTS.glosshall = [[3, 0], [7, 0], [11, 0]];
defMap({
  id: 'glosshall', name: 'Gloss\'s Hall', region: 27, music: 'cowrie', strand: true, indoor: true,
  rows: GL.map(r => r.replace('G', '.')),
  mods: [
    ...GDOORS.map((d, i) => ({ x: d.x, y: d.y, ch: '_', when: () => gdOpen(i) })),
    { x: 7, y: 0, ch: 'd', when: marked },
  ],
  props: [{ x: 6, y: 0, pic: 'gleanerFinger', when: () => !!flag('fingerIn') }],
  warps: [
    { x: 7, y: 12, to: 'glazehalls', tx: 8, ty: 2, dir: 2 },
    { x: 7, y: 0, to: 'cowrieback', tx: 19, ty: 21, dir: 0, when: marked },
  ],
  enter: 'a2GlossEnter',
  npcs: [person('a2Gloss', 7, 6, 'gloss', 'Gloss', 0)],
  spots: GDOORS.map((d, i) => ({ x: d.x, y: d.y, when: () => !gdOpen(i), script: async () => {
    await say('Door', `${d.word} marks are cut in it, one above the other.`);
  } })),
});

defScript('a2GlossEnter', async () => {
  kept = [];
  field.overlay = glossOverlay;
  if (flag('glossSeen')) return;
  setFlag('glossSeen');
  faceToward('a2Gloss', 'ouro');
  // Every line of Gloss's is two sentences, the second the first with its ends swapped.
  await say('Gloss', 'You arrived by the backwardly entrance. By the backwardly entrance, you arrived.');
  await say('Gloss', 'I keep at the mouth. The mouth keeps at me.');
  await say('Gloss', 'The floor keeps your steps, illustriously. Illustriously, your steps keep the floor.');
  await say('Gloss', 'Walk it there and back. Walk it back and there.');
  await hint('(The floor keeps your last steps. A door opens when they read the same backward as forward.)');
  await hint('(Bumping a pillar clears the floor. Each door wants as many steps as it has marks.)');
});

field.stepHooks.push(f => {
  if (f.map.id !== 'glosshall' || f.lastStep < 0) return;
  kept.push(f.lastStep);
  GDOORS.forEach((d, i) => {
    if (gdOpen(i) || Math.abs(f.x - d.x) + Math.abs(f.y - d.y) !== 1 || kept.length !== d.n) return;
    for (let k = 0; k < d.n; k++) if (kept[k] !== kept[d.n - 1 - k]) return;
    setFlag('glossDoor' + i);
    sfx('level');
    f.shakeT = 6;
  });
});

/** Gloss's four. Ouro arrives with the Strand cap at 25. */
export const GLOSS_TEAM: [string, number][] = [['laggard', 22], ['tain', 22], ['luster', 22], ['macula', 23]];
defScript('a2Gloss', async () => {
  if (grains() >= 2) {
    if (marked()) { await say('Gloss', 'The Cowrie is marked, alas!! Alas, marked is the Cowrie!!'); await say('Gloss', 'At every low, we stamp in unison. In unison, we stamp at every low.'); return; }
    await say('Gloss', 'The light came in at low, most luminously!! Most luminously, at low, the light came in!!');
    return;
  }
  if (!GDOORS.every((_, i) => gdOpen(i))) { await say('Gloss', 'Walk at it there and back. Back and there, walk at it.'); return; }
  await say('Gloss', 'A grain is the prize of a fight. Of a fight, the prize is a grain.');
  await say('Gloss', 'My four are tardy, like your face in the floor. Like your face in the floor, my four are tardy.');
  if (!(await keeperFight('Gloss', GLOSS_TEAM, 'You lost at the light. The light lost at you.'))) return;
  await say('Gloss', 'The grain is yours, bestowed!! Bestowed, the grain is yours!!');
  await giveGrain('Gloss');
  await hint('(With two grains your whorls can reach Strand level 18.)');
  await say('Gloss', 'The light came in at low. At low, the light came in.');
  await fingerTake();
});

// The Take: the next low water, a finger comes in through the mouth Ouro opened.
async function fingerTake(): Promise<void> {
  field.overlay = null;
  // The tide turns, and turns again, and goes out. The ground shakes once, then again much later, closer.
  if (highTide()) { await tint('#0b0a10', 0.6, 30); await wait(30); await tint('#0b0a10', 0, 30); }
  field.shakeT = 12;
  sfx('boom');
  await wait(60);
  await scriptedLow();
  // A shadow covers the slit, and a finger as long as the hall, pale and cold with its nail bitten short, comes in through the mouth.
  strandFx.shadow = 120;
  for (let k = -4; k <= 0; k++) { await prop('finger', 'gleanerFinger', 6, k, 0); await wait(10); }
  await Promise.all([emote('ouro', 'surprise'), act('a2Gloss', 'shiver')]);
  await say('Gloss', 'EVERYONE STAMP. Stamp, everyone!!');
  // Every person in the Cowrie stamps at once, in the town behind.
  for (let i = 0; i < 8; i++) { sfx('step'); field.shakeT = 6; await wait(7); }
  if (smallGranHere()) await smallGranLine();
  // The finger stops, taps the floor twice by Ouro's feet, and goes back out through the mouth.
  await prop('finger', 'gleanerFinger', 6, 1, 0); sfx('step'); await wait(10);
  await prop('finger', 'gleanerFinger', 6, 0, 0); await wait(10);
  await prop('finger', 'gleanerFinger', 6, 1, 0); sfx('step'); await wait(10);
  for (let k = 0; k >= -4; k--) { await prop('finger', 'gleanerFinger', 6, k, 0); await wait(8); }
  await unprop('finger', 0);
  // The whole Cowrie lifts and tips toward the mouth, Ouro slides, and the floor comes down hard and crooked.
  field.shakeT = 40;
  field.flashT = 10;
  sfx('boom');
  await walkTo('ouro', field.x, Math.max(2, field.y - 2), 3);
  await act('ouro', 'shiver');
  // Behind the hall the glaze rings high and long and cracks from wall to wall.
  bell(24);
  await wait(50);
  for (const n of [10, 5, 2]) { field.shakeT = n; await wait(25); }
  await say('Gloss', 'It touched at the floor. The floor touched at it.');
  await say('Gloss', 'You let in the light. The light let in you.');
  setFlag('cowrieMarked');
  scriptedHigh();
  field.warp('cowrieback', 19, 21, 0);
  await wait(16);
  // Four white posts stand at the Cowrie's corners where there were none, and a label post in front of the mouth.
  await pan(20, 13);
  await emote('ouro', 'question');
  await panBack();
  await say('Label', 'KEEP THE COWRIE.');
  await walkUp('a2CinchPosts');
  await act('a2CinchPosts', 'bow');
  await cinch('Sit, sit. Came down when the stamping started. Heard it from the bar.');
  await cinch('Four posts. White ones.');
  await cinch('From down here they look new.');
  goal('Swim back across the Flats to the Sand Dollar at high water.');
}

// Cinch goes back to the fire once Ouro does.
for (const id of ['sanddollar', 'flats']) {
  const m = MAPS[id];
  const before = m.enter;
  m.enter = 'a2Enter_' + id;
  defScript('a2Enter_' + id, async () => {
    if (marked()) setFlag('cinchLeftPosts');
    if (before && SCRIPTS[before]) await SCRIPTS[before]();
  });
}

// ---------------------------------------------------------------- side mission: who drills the cowries

// The Strandmonger prices everything.
strandmongerHooks.drill = async () => {
  if (grains() < 1) return false;
  if (flag('gimletDone') && !flag('drillPaid')) {
    setFlag('drillPaid');
    await say('Strandmonger', 'And that\'s the driller? Looks like a button. A cheap one. I wouldn\'t sew it on a sack.');
    await say('Strandmonger', 'Here\'s three hundred cowries. Keep that thing off my stock. And my shoes.');
    await reward({ rind: 300 });
    return true;
  }
  if (flag('drillAsked')) return false;
  setFlag('drillAsked');
  await say('Strandmonger', 'Somebody\'s drilling holes in my cowries!! A hole halves the price. Two holes, I weep.');
  await say('Strandmonger', 'Find the driller. I\'ll pay you what a sack of whole ones is worth to me, exactly.');
  await say('Strandmonger', 'Which is less than it\'s worth to you. That\'s trade.');
  goal('Round holes are turning up in hard things. The first is in a stone on the Flats.');
  return true;
};

defScript('a2DrillWrack', async () => {
  if (!flag('drill2')) { setFlag('drill2'); sfx('spot'); }
  // A cowrie in the weed with a hole drilled clean through it, facing down the beach toward the spotted dome.
  face('ouro', 3);
  await emote('ouro', 'question');
});
defScript('a2DrillCowrie', async () => {
  if (!flag('drill3')) { setFlag('drill3'); sfx('spot'); }
  // A hole drilled into the Cowrie's own gloss by the mouth, slanting in toward the teeth.
  face('ouro', 1);
  await emote('ouro', 'question');
});
defScript('a2Gimlet', async () => {
  if (!toothOpen(4)) { sound('cut'); field.shakeT = 2; await emote('ouro', 'question'); return; }
  sound('cut');
  await emote('ouro', 'surprise');
  if (!SPECIES.gimlet) return;
  const r = await fightWild(mon('gimlet', 24), { canRun: true, area: 'cowrie' });
  if (r.pegged.length) { r.pegged[0].strandBorn = true; setFlag('gimletDone'); await giveMon(r.pegged[0]); }
});

// ---------------------------------------------------------------- side mission: the footprints in the gray

// With a SALT whorl worn, the gray at the Shoreline leads out to the low end of the Wrack.
const sh = MAPS.shoreline;
const grayOpen = () => grains() >= 1;
const wearingSalt = () => field.wearing && field.leadTypes().includes('SALT');
(sh.triggers ||= []).push({ x: 2, y: 1, w: 1, h: 1, script: 'a2GrayRoad', when: () => grayOpen() && wearingSalt() && !flag('grayRoad') });
sh.warps.push({ x: 1, y: 1, to: 'wrack', tx: 2, ty: 9, dir: 1, when: grayOpen });
MAPS.wrack.warps.find(w => w.to === 'shoreline')!.when = grayOpen;
defScript('a2GrayRoad', async () => {
  setFlag('grayRoad');
  // Ouro walks into the gray: cold, still, gray-green, a fish hanging with its tail bent, and a man's heavy footprints going on ahead.
  await tint('#6a8a7a', 0.7, 40);
  for (let i = 0; i < 4; i++) { sound('step'); await wait(24); }
  await tint('#c8d8d0', 0.7, 40);
  field.warp('wrack', 2, 9, 1);
  evening(true);
  await wait(12);
  // Ouro comes out of a gray wall at the low end of the Wrack at night, and the Strandmonger's footprints go on west.
  await act('ouro', 'look');
  goal('The Strandmonger is at his counter in the Sand Dollar.');
});

void sayAll; void Canvas;
