// Act 2, chapter 4: the Nautilus. See Notes/act2-script.md.
// Maps: the Low Line, the living chamber, the old chambers, the Tide-reader's chamber, and the siphuncle.
// The top of this file also holds helpers that chapters 5 and 6 share.
import { sfx } from '../../engine/audio';
import { text } from '../../engine/font';
import { PEOPLE } from '../../engine/sprites';
import type { Mon, SpriteData } from '../../battle/model';
import { makeMon, SPECIES } from '../../data/species';
import { act, choose, emote, face, faceToward, fadeWho, field, fightWild, giveKey, giveMon, goal, hint, mon, moveNpc, movePlayer, narr, notice, npcAt, offstage, pan, panBack, say, shake, sound, tint, wait, walkIn, walkOff, walkTo, warp } from '../../game/api';
import { battle } from '../../game/battleView';
import { PORTRAIT } from '../../game/dialogue';
import { KEY_NAMES, listMenu, menuExtras } from '../../game/menus';
import { G, flag, save, scaleNow, setFlag } from '../../game/state';
import { SEL } from '../../game/ui';
import { defMap, defScript, MAPS, type MapDef, type NpcDef } from '../../game/world';
import { Canvas, highTide, kinds, link, look, reward, stash, tideMods } from '../areakit';
import { brack } from '../ch3';
import { smallGranLine } from '../ch1';
import { playShellboard } from '../minigames';
import { FOOTPRINTS, defineShells, giveGrain, tideHooks, washAll } from './kit';

// ---------------------------------------------------------------- shared by chapters 4 to 6

type Spot = NonNullable<MapDef['spots']>[number];
type Mod = NonNullable<MapDef['mods']>[number];
export type { Spot, Mod };

export const DX = [0, 1, 0, -1];
export const DY = [1, 0, -1, 0];

/** The real Cinch, who sits. */
export const cinch = (line: string) => say('Cinch', line, PEOPLE.realcinch);
/** Hold: 0 or 1 Stays pulled at the end of Act 1. Release: 2 or 3. */
export const hold = () => !flag('endRelease');
export const release = () => !!flag('endRelease');
export const lowWater = () => !highTide();
export const SMALL_GRAN = ['Is it today?', 'Mum says don\'t scratch.', 'I can feel it starting.', 'Don\'t look. Don\'t look yet.', 'There. There it goes.'];
export const SMALL_GRAN_KIND = 'smallgranw';
/** Small Gran, if she is in the four. */
export const smallGranOut = (): Mon | undefined => G.party.find(m => m.kind === SMALL_GRAN_KIND);
/** The index of the line Small Gran says next. */
export const granNext = () => flag('sg') % 5;
/** Small Gran says her next line if she is in the four. */
export async function granSpeaks(): Promise<void> { if (smallGranOut()) await smallGranLine(); }
/** A whorl of a kind in the four or the Midden. */
export const ownsKind = (kind: string) => [...G.party, ...G.rack].some(m => m.kind === kind);
export const STRAND_CAP_LINE = ['', 'Strand level 13', 'Strand level 18', 'Strand level 23', 'Strand level 28', 'Strand level 35', 'Strand level 50'];
/** The system line after a grain. */
export async function grainLine(): Promise<void> {
  const n = G.flags.a2pearls || 0;
  await hint(`(With ${['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] || n} grains your whorls can reach ${STRAND_CAP_LINE[n] || 'Strand level 50'}.)`);
}
/** Sets the tide without the bell's lines or the walk. */
export function setTide(high: boolean): void {
  const was = highTide();
  setFlag('tide', high ? 1 : 0);
  if (high && !was) washAll();
  field.spawnWanderers();
  field.playMapMusic();
}
/** A pale cast of a person sprite. */
export const pale = (id: string, c: [string, string] = ['#ece6d6', '#c8c2b4']) => (): SpriteData => ({ px: (PEOPLE[id] || PEOPLE.villager).px, c });
/** A whorl drawn as a person in the field, with a plain stand-in until its kind exists. */
export const kindSprite = (kind: string) => (): SpriteData => SPECIES[kind] ? { px: SPECIES[kind].sprite, c: SPECIES[kind].c } : { px: PEOPLE.stone.px, c: ['#c8c0d8', '#8a84a0'] };
/** Runs a fight without the field's walk back to the grotto on a loss. Resolves true on a win. */
export async function keeperFight(name: string, team: () => Mon[], ai: 'keeper' | 'champion' = 'keeper', music = 'keeperStrand'): Promise<boolean> {
  const r = await battle({ enemy: team(), name, ai, wild: false, bg: field.bg(), music });
  field.playMapMusic();
  return r.result === 'win';
}
/** Strand keepers take rematches at Strand level 70 once Act 2 is over. */
export async function strandRematch(name: string, kindsList: string[], who: string): Promise<boolean> {
  if (!flag('a2done')) return false;
  const c = await choose(['Fight again at 35', 'Talk'], true, `${name} will fight again, all four at level 35.`);
  if (c !== 0) return c < 0;
  if (await keeperFight(name, () => kindsList.map(k => makeMon(k, 70)))) {
    G.rind += 500;
    G.flags['a2rematch_' + who] = (G.flags['a2rematch_' + who] || 0) + 1;
    await notice('(500 cowries.)');
    save();
  }
  return true;
}
const TICK_HOOKS: Record<string, () => void> = {};
const DRAW_HOOKS: Record<string, () => void> = {};
// The field's tick runs once per fixed step even while a text box is up, so real-time puzzles count steps, not frames drawn.
const fieldTick = field.tick.bind(field);
field.tick = () => {
  fieldTick();
  const fn = field.map && TICK_HOOKS[field.map.id];
  if (fn && !field.busy) fn();
};
/** Keeps a real-time puzzle running on one map: the hook runs every fixed step while that map is up and the field is free. */
export function frameHook(mapId: string, fn: () => void): void { TICK_HOOKS[mapId] = fn; }
/** Draws something over one map every frame, such as a count in the corner. */
export function drawHook(mapId: string, fn: () => void): void {
  DRAW_HOOKS[mapId] = () => { if (field.map.id === mapId) fn(); };
  field.stepHooks.push(() => startFrameHook(mapId));
}
/** Call from a map's enter script so its draw hook is in place before the first step. */
export function startFrameHook(mapId: string): void {
  const fn = DRAW_HOOKS[mapId];
  if (fn && field.map?.id === mapId && field.overlay !== fn) field.overlay = fn;
}

for (const [name, id] of [['Siphon', 'siphon'], ['Tide-reader', 'tidereader'], ['Mudlark', 'mudlark'], ['Cinch\'s cast', 'cinch']] as const) PORTRAIT[name] = PEOPLE[id];
Object.assign(KEY_NAMES, { tidetable: 'Tide table', sbowl: 'Siphon\'s first bowl', smat: 'Siphon\'s old mat', sdrawing: 'A drawing on a shell', granboot: 'Gran\'s boot', hollowkey: 'The Hollow Top\'s key' });

// ---------------------------------------------------------------- the tide table

/** Notches for each low in the round, as the Tide-reader's wall has them. The spring low is the first four. */
const ROUND = [1, 2, 3, 4, 4, 3, 2, 1];
// Counts lows after the spring high, for the tide table.
tideHooks.push(high => { if (!high && flag('springHigh')) G.flags.a2lows = (G.flags.a2lows || 0) + 1; });
const notches = (n: number) => ['', 'one notch', 'two notches', 'three notches', 'four notches'][n];
menuExtras.push({
  label: 'Tide table', when: () => scaleNow.strand && G.keys.includes('tidetable'),
  run: async () => {
    if (flag('springLow') && !flag('springHigh')) { await say('Tide table', 'Now. The spring low. Four notches, and a star.'); return; }
    if (!flag('springLow')) { await say('Tide table', 'The next low goes out four notches, with a star. A spring low.'); return; }
    const n = ROUND[(4 + (G.flags.a2lows || 0)) % ROUND.length];
    const walk = flag('sweepOver') ? ' No walk.' : n === 4 ? ' A spring low.' : '';
    await say('Tide table', `The next low goes out ${notches(n)}${n === 4 ? ', with a star' : ''}.${walk}`);
  },
});

// ---------------------------------------------------------------- the Low Line

const LL_W = 56, LL_H = 20;
const ll = new Canvas(LL_W, LL_H, '.').border('#');
ll.put(0, 2, '.').put(0, 3, '.');
ll.rect(1, 16, LL_W - 2, 3, '~');
ll.rect(14, 1, 6, 2, ',').rect(46, 1, 6, 2, ',');
ll.rect(20, 9, 8, 3, ',').rect(28, 12, 6, 3, ',').rect(47, 12, 7, 4, ',');
// The Auger, grounded at the west end with its mouth to the sea.
ll.rect(4, 7, 12, 1, 'r').rect(3, 8, 15, 1, 'r').rect(2, 9, 16, 1, 'h').rect(2, 10, 15, 1, 'h').rect(3, 11, 7, 1, 'h').put(6, 11, 'd');
ll.rect(5, 12, 3, 1, 'x');
// The Nautilus, coiled flat, half in the sea, its hood to the sea.
ll.rect(39, 5, 5, 1, 'r').rect(37, 6, 9, 1, 'r').rect(36, 7, 11, 1, 'r').rect(36, 8, 11, 1, 'h').rect(36, 9, 11, 1, 'h').rect(37, 10, 9, 1, 'h').rect(39, 11, 5, 1, 'h').put(41, 11, 'd');
ll.rect(40, 12, 3, 1, 'x');
ll.put(30, 6, 'p').put(24, 14, 'x');
for (const x of [52, 40, 28, 18, 10]) ll.put(x, 15, 'b');
const LL_DRY = new Set(['5,12', '6,12', '7,12', '40,12', '41,12', '42,12', '30,6']);
const llTide: string[] = ll.rows().map((r, y) => [...r].map((c, x) => (y >= 4 && y <= 15 && '.,xb'.includes(c) && !LL_DRY.has(`${x},${y}`) ? 'A' : ' ')).join(''));
// The way east opens after the spring high.
const eastOpen = () => !!flag('springHigh');

FOOTPRINTS.lowline = [52, 46, 40, 34, 28, 22, 16, 10, 4].map(x => [x, 14] as [number, number]);

/** The Nautilus folk's goat. */
export const GOAT: SpriteData = { px: ['......11', '.....121', '1111111.', '12222221', '12222221', '.122221.', '.1.11.1.', '.1.1..1.'], c: ['#d8d0c0', '#8a7a68'] };

const AFTER_LOW = ['I\'m just out on the sand, at low! Feels weird. Good weird.', 'Nobody\'s kicking anymore. My legs don\'t know what to do.', 'Low water. Would you look at all of it.'];
/** After Act 2 every townsperson on the Strand says one of three things at low water. */
export const afterLow = (i: number) => AFTER_LOW[i % 3];

/** Tack on the Low Line, release only. Strand level 43. */
export const tackTeam = () => [brack(43), mon('razor', 42), mon('asterias', 42), mon('swift', 42)];

defMap({
  id: 'lowline', name: 'The Low Line', region: 25, music: 'strand', strand: true,
  rows: ll.rows(),
  mods: [
    ...tideMods(llTide, 0, 0),
    { x: LL_W - 1, y: 2, ch: '.', when: eastOpen }, { x: LL_W - 1, y: 3, ch: '.', when: eastOpen },
  ],
  warps: [
    { x: 6, y: 11, to: 'augermouth', tx: 10, ty: 14, dir: 2 },
    { x: 41, y: 11, to: 'livingchamber', tx: 11, ty: 12, dir: 2 },
    { x: LL_W - 1, y: 2, to: 'longstrand', tx: 1, ty: 3, dir: 1, when: eastOpen },
    { x: LL_W - 1, y: 3, to: 'longstrand', tx: 1, ty: 4, dir: 1, when: eastOpen },
  ],
  enter: 'lowlineEnter',
  zone: {
    // The Astrolabe is listed for the Register's check. It walks only in the side mission, never with the tide's kinds.
    kinds: kinds([['laminaria', 3], ['eelgrass', 3], ['grenadier', 2], ['asterias', 2], ['cirrus', 2], ['transit', 2], ['hyponome', 3], ['slackwater', 3], ['brinicle', 3], ['astrolabe', 1]]),
    lv: [34, 42], n: 12, area: 'strand',
    tideKinds: {
      low: kinds([['laminaria', 3], ['eelgrass', 3], ['grenadier', 2], ['asterias', 2], ['cirrus', 2], ['transit', 2]]),
      high: kinds([['hyponome', 3], ['slackwater', 3], ['brinicle', 3]]),
    },
  },
  npcs: [
    { id: 'llclimber1', onSolid: true, x: 9, y: 7, sprite: 'climber2', name: 'Woman (climbing)', dir: 0, when: lowWater,
      lines: () => (flag('sweepOver') ? [afterLow(0)] : ['Up and down. Up and down. My whole life is stairs now.']) },
    { id: 'llclimber2', onSolid: true, x: 13, y: 7, sprite: 'climber1', name: 'Old man (climbing)', dir: 0, when: lowWater,
      lines: () => (flag('sweepOver') ? [afterLow(1)] : ['Long shell, lots of stair. Good thing, I suppose.']) },
    // Two climbers who come out of the Auger's mouth after it slides.
    { id: 'llClimberOld', x: 5, y: 13, sprite: 'climber2', name: 'Old man', when: () => !!flag('ch3ReturnScene') },
    { id: 'llClimberWoman', x: 7, y: 13, sprite: 'climber1', name: 'Woman', when: () => !!flag('ch3ReturnScene') },
    { id: 'llfisher1', x: 22, y: 3, sprite: 'nautilus1', name: 'Nautilus fisher', dir: 0, lines: () => (flag('sweepOver') && lowWater() ? [afterLow(0)] : ['The Auger\'s come down to live by us. They\'re so loud at low. We pump quiet.']) },
    { id: 'llfisher2', x: 34, y: 2, sprite: 'nautilus2', name: 'Nautilus fisher', dir: 0, lines: () => (flag('sweepOver') && lowWater() ? [afterLow(2)] : ['We pump, they climb. Same thing, really. They\'d say different.']) },
    { id: 'kelpcutter', x: 24, y: 10, sprite: 'beach2', name: 'Kelp-cutter', dir: 3, when: lowWater,
      trainer: { name: 'Kelp-cutter', team: [['laminaria', 38], ['eelgrass', 38]], intro: 'I cut kelp at low. It stands right up when the sea goes out. Very polite of it.', defeat: 'Alright. Lie down, then.', sight: 3 } },
    { id: 'deepfisher', x: 31, y: 15, sprite: 'nautilus2', name: 'Deep-fisher', dir: 1, when: lowWater,
      trainer: { name: 'Deep-fisher', team: [['grenadier', 39], ['cirrus', 39]], intro: 'Deep ones come up at low. I wait right at the edge. Very patient. Very wet.', defeat: 'Back down deep, then. Bye.', sight: 3 } },
    { id: 'starpicker', x: 50, y: 8, sprite: 'beach3', name: 'Star-picker', dir: 3, when: lowWater,
      trainer: { name: 'Star-picker', team: [['asterias', 39], ['transit', 40]], intro: 'My gran says starfish fell out of the sky. I pick them up anyway. They don\'t mind.', defeat: 'Fell again.', sight: 3 } },
    { id: 'brinediver', x: 27, y: 7, sprite: 'beach2', name: 'Brine-diver', dir: 0, when: highTide,
      trainer: { name: 'Brine-diver', team: [['brinicle', 40], ['slackwater', 40]], intro: 'I dive at high water. Cold down there. Colder every year.', defeat: 'Up for air.', sight: 3 } },
    { id: 'lltack', x: 19, y: 4, sprite: 'tack', name: 'Tack', dir: 0, talk: 'llTack', when: () => release() && !!flag('a2c4') && !flag('sweepOver') },
    { id: 'astrolabe', x: 50, y: 13, sprite: 'stone', name: 'Astrolabe', dir: 0, img: kindSprite('astrolabe'), talk: 'astrolabe', when: () => lowWater() && !!flag('astroAsked') && !flag('astroDone') },
    { id: 'llgoat', x: 40, y: 13, sprite: 'stone', name: 'A goat', dir: 3, img: () => GOAT, when: () => !!flag('a2done'), lines: ['(The Nautilus folk\'s goat, out on the sand. It looks at Ouro and chews.)'] },
  ],
  spots: [
    { x: 24, y: 14, when: lowWater, script: async () => { await emote('ouro', 'question'); } },
    stash('ll_anchor', 30, 6, 'Under the anchor stone, pressed into the wet sand, a notion.', { notion: 'lodestone' }),
    look(30, 6, 'A flat stone with a round hole drilled through it. Somebody\'s anchor. Nobody\'s boat.'),
    look(18, 15, 'A hollow in the wet sand where something lay until last low. A few small crabs walk round the rim.'),
    { ...stash('ll_eelgrass', 52, 15, 'Down in the eelgrass, where it lies flat at low water, a nautilus horn.', { pegs: ['iron', 1] }), when: () => lowWater() && !flag('found_ll_eelgrass') },
  ],
  shells: [{ id: 'll1', x: 26, y: 5 }, { id: 'll2', x: 49, y: 10 }],
});
defineShells('lowline');

defScript('lowlineEnter', async () => {
  if (!flag('a2ret3')) {
    setFlag('a2ret3');
    // The Auger lies on wet sand at the sea's edge. Two climbers come out of its mouth to talk.
    setFlag('ch3ReturnScene');
    offstage('llClimberOld', 'llClimberWoman');
    await Promise.all([walkIn('llClimberOld', 6, 11, 5, 13), (async () => { await wait(16); await walkIn('llClimberWoman', 6, 11, 7, 13); })()]);
    faceToward('llClimberOld', 'ouro');
    faceToward('llClimberWoman', 'ouro');
    await say('Old man', 'Never been down here. Low line now. Still getting used to it.');
    await say('Woman', 'Every low, we climb. Babies too. Carried, but still.');
    await Promise.all([walkOff('llClimberOld', 6, 11), (async () => { await wait(16); await walkOff('llClimberWoman', 6, 11); })()]);
    setFlag('ch3ReturnScene', 0);
  }
  if (!flag('a2c4')) {
    setFlag('a2c4');
    // The striped shell lies along the sea's edge, coiled flat, as big as a hill, its mouth shut with a thick brown hood.
    await pan(41, 9);
    await wait(40);
    await panBack();
    goal('Go in at the striped shell\'s hood.');
    save();
  }
});

defScript('llTack', async () => {
  if (flag('tackLow')) { await say('Tack', '1 hollow, 1 slate. Crabs on the rim now. 11. Hold still, crabs.'); return; }
  await act('lltack', 'nod');
  faceToward('lltack', 'ouro');
  await say('Tack', '3 lows since we came down. 3 times it walked right past the Auger. Right past.');
  await say('Tack', 'Battle 3 out here. After this I\'m counting something else. Something that holds still.');
  const won = await keeperFight('Tack', tackTeam, 'keeper', 'rival');
  setFlag('tackLow');
  if (won) {
    G.flags.tackWins = (G.flags.tackWins || 0) + 1;
    await say('Tack', `${G.flags.tackWins}. I'll count them on the Auger stair. 4,000 steps, 1 per loss. Plenty of room.`);
  } else await say('Tack', '1 back! I\'m counting that twice.');
  save();
});

defScript('astrolabe', async () => {
  await act('astrolabe', 'look');
  const r = await fightWild(mon('astrolabe', 44), { canRun: true, area: 'strand' });
  if (r.pegged.length) {
    setFlag('astroDone');
    await giveMon(r.pegged[0]);
  } else if (r.result === 'win') {
    await act('astrolabe', 'shiver');
    await Promise.all([walkTo('astrolabe', 53, 13, 14), fadeWho('astrolabe', false, 60)]);
  }
});

// ---------------------------------------------------------------- the living chamber

const lc = new Canvas(24, 14, '#');
lc.rect(1, 3, 22, 8, '_').rect(2, 2, 20, 1, '_').rect(2, 11, 20, 1, '_').rect(9, 12, 6, 1, '_');
lc.put(11, 13, 'd').put(12, 13, 'd').put(9, 1, 'q').put(16, 1, 'j');
lc.put(4, 2, 'K').put(19, 2, 'K').rect(19, 4, 2, 1, 'c').rect(2, 4, 2, 1, 'c').put(11, 7, 'w');
lc.put(2, 9, 'x').put(6, 11, 'x').put(21, 10, 'x').put(18, 3, 'x');

const taken = () => !!flag('discTaken');
const sealedNow = () => !!flag('springLow') && !flag('springHigh');
const hoodShut = () => taken() && !flag('siphonBeaten');
const toSpringLow = () => !!flag('siphonBeaten') && !flag('springHigh');

/** A townsperson in the living chamber: lines by the tide, and later lines once things have happened. */
function folk(id: string, x: number, y: number, sprite: string, name: string, high: string, low: string, later?: () => string | null): NpcDef {
  return {
    id, x, y, sprite, name, dir: 0, wander: true,
    lines: () => {
      const l = later?.();
      if (l) return [l];
      if (flag('sweepOver') && lowWater()) return [afterLow(id.length)];
      return [lowWater() ? low : high];
    },
  };
}

defMap({
  id: 'livingchamber', name: 'The living chamber', region: 29, music: 'nautilus', strand: true, indoor: true,
  rows: lc.rows(),
  mods: [
    { x: 9, y: 1, ch: '#', when: sealedNow },
    { x: 16, y: 1, ch: '_', when: () => !!flag('springHigh') },
    { x: 11, y: 13, ch: 'h', when: hoodShut }, { x: 12, y: 13, ch: 'h', when: hoodShut },
    { x: 10, y: 12, ch: '~', when: highTide }, { x: 13, y: 12, ch: '~', when: highTide },
  ],
  warps: [
    { x: 11, y: 13, to: 'springlow', tx: 41, ty: 12, dir: 0, when: toSpringLow },
    { x: 12, y: 13, to: 'springlow', tx: 41, ty: 12, dir: 0, when: toSpringLow },
    { x: 11, y: 13, to: 'lowline', tx: 41, ty: 12, dir: 0 },
    { x: 12, y: 13, to: 'lowline', tx: 41, ty: 12, dir: 0 },
    { x: 9, y: 1, to: 'oldchambers', tx: 5, ty: 17, dir: 2, when: () => !sealedNow() },
    { x: 16, y: 1, to: 'siphuncle', tx: 20, ty: 9, dir: 2, when: () => !!flag('springHigh') },
  ],
  enter: 'livingEnter',
  npcs: [
    { id: 'siphon0', x: 10, y: 2, sprite: 'siphon', name: 'Siphon', dir: 0, talk: 'siphonBack', when: () => !taken() },
    { id: 'siphon1', x: 12, y: 7, sprite: 'siphon', name: 'Siphon', dir: 3, talk: 'siphonFire', when: taken },
    { id: 'lccinch', blocks: true, x: 14, y: 11, sprite: 'realcinch', name: 'Cinch', dir: 2, talk: 'lcCinch', when: () => !!flag('cinchNautilus') && !flag('cinchFollow') },
    { id: 'lcwindow', onSolid: true, x: 16, y: 1, sprite: 'realcinch', name: 'Cinch', dir: 0, talk: 'cinchWindow', when: () => taken() && !flag('springHigh') },
    { id: 'ballastgirl', x: 19, y: 5, sprite: 'nautilus1', name: 'Ballast-girl', dir: 2, talk: 'ballastgirl' },
    { id: 'pumper', x: 4, y: 3, sprite: 'nautilus2', name: 'Pumper', dir: 0,
      trainer: { name: 'Pumper', team: [['ballast', 40], ['sluice', 40]], intro: 'I pump the siphon at low. One of my arms is huge now. The other one\'s fine.', defeat: 'Other arm next time, then.', sight: 2 } },
    { id: 'doorkeeper', x: 10, y: 11, sprite: 'nautilus2', name: 'Nautilus doorkeeper', dir: 1,
      lines: () => (hoodShut() ? ['Hood\'s shut for the big low. Only Siphon opens it. Sorry.'] : lowWater() ? ['Low water, hood\'s shut. Knock and I\'ll open it. Knock nice.'] : ['High water. Hood\'s up. Mind your feet, it\'s wet.']) },
    folk('lcwoman', 3, 6, 'nautilus1', 'Woman', 'We all live in the big room now. The small rooms are where we grew up. Cozy, back then.', 'Pump, pump. Pump, pump.',
      () => (flag('roarHeard') && !flag('sweepOver') ? 'The goat lay down when it heard that. Goats know.' : null)),
    folk('lcman', 7, 9, 'nautilus2', 'Man', 'Every few years we build a new wall behind us and move up a room. Moving day\'s the best.', 'Low water. Pump and bob. Pump and bob. Bob\'s my favorite part.'),
    folk('lcold', 17, 9, 'nautilus1', 'Old woman', 'Nan\'s old room is three walls back. She says it\'s cozy. She can\'t get in, though.', 'Low water! Pump!',
      () => (taken() && !flag('springHigh') ? 'Sealed in five, at spring? He\'s out at spring high. Bring him soup then. Hot soup.' : null)),
    folk('lcboy', 14, 4, 'nautilus2', 'Boy', 'Sea comes in at the hood at high water. We like our feet wet. You get used to it.', 'I\'m on the pump with Gran. She\'s faster than me. Way faster.',
      () => (taken() && !flag('springHigh') ? 'There\'s a man in the wall. He waved at me! I waved back.' : null)),
    folk('lcgirl', 20, 8, 'nautilus1', 'Girl', 'Tide-reader lives back there, in five. Only comes out at spring high. Bit odd.', 'Pumping. Yep. Still pumping.'),
    folk('lcnet', 3, 10, 'nautilus2', 'Man with a net', 'We tell the climbers the tides. They tell us about stairs. Fair trade, I think.', 'Shh, I\'m pumping.'),
    { id: 'lcgoat', x: 16, y: 6, sprite: 'stone', name: 'A goat', dir: 3, img: () => GOAT, wander: true, when: () => !flag('a2done'),
      lines: () => [flag('roarHeard') ? '(The goat is lying down.)' : '(A goat. It looks at Ouro and chews something it found.)'] },
  ],
  spots: [
    look(4, 2, 'A siphon pump, a long handle of shell on a pipe that goes into the floor.', 'The handle is worn bright in two places.'),
    look(19, 2, 'A siphon pump. Someone has tied a rag round the handle.'),
    look(11, 7, 'The fire. A pot of kelp soup hangs over it, and nobody is watching it.'),
    { x: 9, y: 1, when: sealedNow, script: async () => { sound('bump'); await emote('ouro', 'silence'); } },
  ],
});

defScript('livingEnter', async () => {
  if (lowWater() && !flag('knocked') && !flag('nautSeen')) {
    setFlag('knocked');
    // The hood is shut at low water. Ouro knocks, and it opens a crack.
    sound('bump'); await wait(12); sound('bump');
    await wait(20);
    faceToward('doorkeeper', 'ouro');
    await emote('doorkeeper', 'surprise');
    await say('Nautilus doorkeeper', 'In, in, quick. We\'re about to pump.');
  }
  if (!flag('nautSeen')) {
    setFlag('nautSeen');
    // Inside is one big striped room with everyone's things in it at once, and a goat. Cinch comes in under the hood.
    setFlag('cinchNautilus');
    offstage('lccinch');
    await walkTo('ouro', 12, 10);
    await walkIn('lccinch', 12, 13, 14, 11);
    await act('lccinch', 'bow');
    await cinch('Grab a pot and sit. They\'ve got plenty of pots.');
    goal('Talk to the round one by the back wall.');
    save();
  }
});

defScript('lcCinch', async () => {
  await cinch('Have a pot. They don\'t mind. They\'ve got loads.');
  await cinch('Sit by the door and you see the whole room at once. Everything they own.');
});

defScript('cinchWindow', async () => {
  if (flag('ringRead')) { await cinch('Sit a minute. Not a lot to see from in here. I\'m seeing all of it, though.'); return; }
  await cinch('Not much to see in here. Seeing it anyway. Pull up some floor.');
});

// Siphon speaks only about the room Siphon is standing in.
defScript('siphonBack', async () => {
  await say('Siphon', 'WELCOME to this room!! This room is the biggest one. This room is where we all live now.');
  await say('Siphon', 'This room\'s door is a hood. It shuts at the low, with tremendous decorum.');
  await say('Siphon', 'This room is a hole in its back wall. That is all this room will say on the matter.');
  if (!flag('siphonTold')) {
    setFlag('siphonTold');
    await hint('(Siphon will fight you here, when you come back out through the back.)');
    goal('Go in at the hole in the back wall.');
  }
});

/** Siphon, the fourth keeper. Strand level 42. */
export const siphonTeam = () => [mon('hood', 38), mon('septum', 38), mon('hyponome', 39), mon('vacuole', 40)];
const SIPHON_THINGS: [string, string, string][] = [
  ['sbowl', 'siphonBowl', 'This room is my first bowl now!! This room is a great deal bigger than that bowl was.'],
  ['smat', 'siphonMat', 'This room has my old mat in it. This room smells most powerfully of being four.'],
  ['sdrawing', 'siphonDrawing', 'This room now holds a drawing of this room. Drawn small, by a smaller me.'],
];

defScript('siphonFire', async () => {
  if (!flag('siphonBeaten')) {
    await say('Siphon', 'This room is amply wide for a fight!! This room is four of mine, at the ready.');
    await say('Siphon', 'This room\'s floor is wet at the hood end. This room recommends the dry end.');
    if (!await keeperFight('Siphon', siphonTeam)) {
      await say('Siphon', 'This room is a fire for beaten people, until they are warm.');
      return;
    }
    setFlag('siphonBeaten');
    await say('Siphon', 'This room bestows a grain upon whoever wins in it. This one. Here.');
    await giveGrain('Siphon');
    await grainLine();
    await say('Siphon', 'This room\'s hood is opening!! The sea is departing this room, as is customary.');
    goal('Go out under the hood.');
    save();
    return;
  }
  // The old things: Siphon talks about each only once it is in this room.
  let said = false;
  for (const [key, f, line] of SIPHON_THINGS) {
    if (G.keys.includes(key) && !flag(f)) {
      await act('ouro', 'bow');
      sound('ok');
      await say('Siphon', line);
      setFlag(f);
      G.keys = G.keys.filter(k => k !== key);
      said = true;
    }
  }
  if (said && SIPHON_THINGS.every(([, f]) => flag(f)) && !flag('siphonThings')) {
    setFlag('siphonThings');
    await say('Siphon', 'This room is in your debt. This room settles its debts in nacre.');
    await reward({ tan: 4, notion: 'siphonhood' });
    return;
  }
  if (said) return;
  if (await strandRematch('Siphon', ['hood', 'septum', 'hyponome', 'vacuole'], 'siphon')) return;
  await say('Siphon', 'This room is warmest by the fire, and kelp-scented, as ever.');
});

defScript('ballastgirl', () => playShellboard({
  id: 'a2peg4', name: 'Ballast-girl', deck: ['hood', 'septum', 'ballast', 'sluice', 'hyponome'], look: true, tier: 6, prize: 'siphoncup', strand: true,
  lines: ['Wet row\'s the hood end. Always the hood end in here. Wanna play?'],
}));

// ---------------------------------------------------------------- the old chambers: the ballast

// Rooms 8 (the newest sealed room) in to 1 (the first). Room 5 is the Tide-reader's chamber, a map of its own.
// At low tide the shell sits level. At high tide it tips toward the heavier end: rooms 6, 7, and 8 against rooms 1 to 5.
// Each septum has a valve on both sides of its hole, and a valve moves one measure through that septum either way.
// A room holds two measures, and a room with two is flooded: only a worn TIDE whorl crosses it.
// Start: room 1 has 1, room 4 has 1, room 5 has 1, room 7 has 2. Checked with a solver over every reachable state
// (scratchpad ballast3/verify4): none is stuck, and the shortest way to room 5 is 7 moves:
// into room 8, pump room 7 down into room 8, into room 7 at low, ring high (point down), into room 6,
// pump room 5 up into room 6 (mouth down), into room 5. With a TIDE whorl worn through the flooded room 7 it is 6.
// Room 1 is 13 moves: from room 5 at low, pump room 6 back into room 5, walk 5 to 2, ring high (point down), into room 1.
type Tilt = 'L' | 'P' | 'M';
const START_WATER: Record<number, number> = { 1: 1, 4: 1, 5: 1, 7: 2 };
export const water = (r: number): number => {
  if (!flag('bwInit')) { for (let i = 1; i <= 8; i++) G.flags['bw' + i] = START_WATER[i] || 0; setFlag('bwInit'); }
  return G.flags['bw' + r] || 0;
};
export function tilt(): Tilt {
  if (!highTide()) return 'L';
  const out = water(6) + water(7) + water(8);
  let inn = 0;
  for (let r = 1; r <= 5; r++) inn += water(r);
  return out > inn ? 'M' : inn > out ? 'P' : 'L';
}
/** The tilt each septum's hole lines up at, by the outer room's number. */
const HOLE_TILT: Record<number, Tilt> = { 8: 'L', 7: 'P', 6: 'M', 5: 'L', 4: 'L', 3: 'L', 2: 'P' };
export const holeOpen = (outer: number) => HOLE_TILT[outer] === tilt();
const TILT_WORDS: Record<Tilt, string> = { L: 'The shell is level.', P: 'The point end is down.', M: 'The mouth end is down.' };
const wearingTide = () => field.wearing && field.leadTypes().includes('TIDE');
const level = (w: number) => (w >= 2 ? 'full' : w === 1 ? 'wet' : 'dry');

/** A valve on one side of the septum between room `outer` and room `outer - 1`. `mine` is the room Ouro stands in. */
export async function valve(outer: number, mine: number): Promise<void> {
  const inner = outer - 1;
  const here = mine === outer ? 'in' : 'out';
  const prompt = `${TILT_WORDS[tilt()]} This room is ${level(water(mine))}. The room ${here} is ${level(water(mine === outer ? inner : outer))}.`;
  const c = await choose(['Pump inward', 'Pump outward', 'Leave it'], true, prompt);
  if (c < 0 || c === 2) return;
  const [from, to] = c === 0 ? [outer, inner] : [inner, outer];
  if (water(from) < 1) { sfx('switch'); await emote('ouro', 'question'); return; }
  if (water(to) >= 2) { sound('bump'); await emote('ouro', 'sweat'); return; }
  if (to === mine && water(to) >= 1 && !wearingTide()) { await act('ouro', 'back'); await emote('ouro', 'sweat'); return; }
  const before = tilt();
  G.flags['bw' + from] = water(from) - 1;
  G.flags['bw' + to] = water(to) + 1;
  sfx('switch');
  await act('ouro', 'nod');
  sound('wind');
  const after = tilt();
  if (after !== before) { await shake(20); await act('ouro', 'shiver'); }
  if (!flag('ballastTold2')) { setFlag('ballastTold2'); await hint('(The holes line up only at certain tilts. Pump water from room to room at the valves.)'); }
  save();
}

export const plumb = (x: number, y: number): Spot => ({ x, y, script: async () => {
  await say('Plumb line', TILT_WORDS[tilt()]);
} });

/** Tiles where the holes set Ouro down. They stay dry so a warp never lands in water. */
const LANDINGS = new Set(['oldchambers:5,17', 'oldchambers:15,10', 'oldchambers:23,15', 'tidechamber:1,5', 'tidechamber:11,5', 'tidechamber:9,9']);

/** Water on a room's floor: one measure wets the cells listed, two fills the room. */
export function roomWater(r: number, floor: [number, number][], puddle: [number, number][], map = r === 5 ? 'tidechamber' : 'oldchambers'): Mod[] {
  const mods: Mod[] = [];
  for (const [x, y] of floor) if (!LANDINGS.has(`${map}:${x},${y}`)) mods.push({ x, y, ch: '~', when: () => water(r) >= 2 });
  for (const [x, y] of puddle) mods.push({ x, y, ch: '~', when: () => water(r) === 1 });
  return mods;
}
const rectCells = (x: number, y: number, w: number, h: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j]);
  return out;
};

const ROOMS: Record<number, [number, number, number, number]> = {
  8: [2, 12, 7, 6], 7: [2, 6, 9, 5], 6: [12, 4, 6, 7], 4: [21, 12, 6, 4], 3: [28, 10, 4, 6], 2: [26, 5, 6, 4], 1: [22, 5, 3, 3],
};
const PUDDLES: Record<number, [number, number][]> = {
  8: [[6, 17], [7, 17], [8, 17]], 7: [[6, 6], [7, 6], [8, 6], [9, 6], [10, 6]], 6: [[14, 4], [15, 4], [16, 4], [17, 4]],
  4: [[21, 12], [22, 12], [23, 12]], 3: [[30, 15], [31, 15]], 2: [[28, 5], [29, 5], [30, 5], [31, 5]], 1: [[22, 7], [23, 7]],
};
// Valve tiles by septum (outer room) and side.
const VALVES: [number, number, number, number][] = [
  [8, 8, 4, 12], [8, 7, 4, 10], [7, 7, 10, 9], [7, 6, 12, 9], [6, 6, 16, 10], [5, 4, 24, 15],
  [4, 4, 26, 14], [4, 3, 28, 14], [3, 3, 30, 10], [3, 2, 30, 8], [2, 2, 26, 7], [2, 1, 24, 7],
];
// Holes inside this map, by septum: the hole tile.
const HOLES: [number, number, number][] = [[8, 3, 11], [7, 11, 8], [4, 27, 13], [3, 29, 9], [2, 25, 6]];

const OC_KINDS = kinds([['septum', 2], ['vacuole', 2], ['evaporite', 2], ['ballast', 2], ['sluice', 2], ['hood', 2]]);
const oc = new Canvas(33, 19, '#');
for (const [x, y, w, h] of Object.values(ROOMS)) oc.rect(x, y, w, h, '_');
oc.put(5, 18, 'q');
for (const [, x, y] of HOLES) oc.put(x, y, 'O');
oc.put(15, 11, 'O').put(23, 16, 'O');
for (const [, , x, y] of VALVES) oc.put(x, y, 'K');
oc.rect(2, 16, 2, 2, ',').rect(7, 8, 3, 1, ',').rect(13, 7, 2, 2, ',').rect(29, 12, 2, 2, ',');

const ocMods: Mod[] = [];
for (const [r, rect] of Object.entries(ROOMS)) {
  const n = Number(r);
  const floor = rectCells(...rect).filter(([x, y]) => oc.at(x, y) === '_' || oc.at(x, y) === ',');
  ocMods.push(...roomWater(n, floor, PUDDLES[n]));
}
// Holes: shut unless their septum lines up. The open mod comes last so the validator's flood sees the hole open.
for (const [outer, x, y] of HOLES) ocMods.push({ x, y, ch: '_', when: () => holeOpen(outer) });
ocMods.push({ x: 15, y: 11, ch: '~', when: () => holeOpen(6) && water(5) >= 2 }, { x: 15, y: 11, ch: 'q', when: () => holeOpen(6) });
ocMods.push({ x: 23, y: 16, ch: '~', when: () => holeOpen(5) && water(5) >= 2 }, { x: 23, y: 16, ch: 'q', when: () => holeOpen(5) });

defMap({
  id: 'oldchambers', name: 'The old chambers', region: 29, music: 'nautilus', strand: true, indoor: true,
  rows: oc.rows(),
  mods: ocMods,
  warps: [
    { x: 5, y: 18, to: 'livingchamber', tx: 9, ty: 2, dir: 0 },
    { x: 15, y: 11, to: 'tidechamber', tx: 1, ty: 5, dir: 1, when: () => holeOpen(6) },
    { x: 23, y: 16, to: 'tidechamber', tx: 11, ty: 5, dir: 3, when: () => holeOpen(5) },
  ],
  enter: 'oldEnter',
  // The Protoconch sits in room 1 and is listed only for the Register's check. Both tides spawn the rest.
  zone: {
    kinds: kinds([['septum', 2], ['vacuole', 2], ['evaporite', 2], ['ballast', 2], ['sluice', 2], ['hood', 2], ['protoconch', 1]]), lv: [34, 42], n: 6, area: 'nautilus',
    tideKinds: { high: OC_KINDS, low: OC_KINDS },
  },
  npcs: [
    { id: 'roomsitter', x: 8, y: 8, sprite: 'nautilus1', name: 'Room-sitter', dir: 3,
      trainer: { name: 'Room-sitter', team: [['evaporite', 41], ['vacuole', 41]], intro: 'I sat in an old room when it sealed. Liked it. So I stayed. It\'s nice in here.', defeat: 'Stay a while. It opens again at spring. I\'ve got snacks.', sight: 3 } },
    { id: 'protoconch', x: 23, y: 5, sprite: 'stone', name: 'Alkume', dir: 0, img: kindSprite('protoconch'), talk: 'protoconch', when: () => !flag('protoconchDone') },
  ],
  spots: [
    ...VALVES.map(([outer, side, x, y]) => ({ x, y, script: () => valve(outer, side) })),
    plumb(9, 14), plumb(18, 8), plumb(32, 13),
    { x: 1, y: 7, when: () => !flag('siphonBowl') && !G.keys.includes('sbowl'), script: async () => {
      giveKey('sbowl'); sfx('level'); await notice('Ouro takes a child\'s bowl, very small, with a crack mended in gum.');
    } },
    { x: 20, y: 14, when: () => !flag('siphonMat') && !G.keys.includes('smat'), script: async () => {
      giveKey('smat'); sfx('level'); await notice('Ouro takes a sleeping mat of kelp, the size of a small child.');
    } },
    { x: 21, y: 6, when: () => !flag('siphonDrawing') && !G.keys.includes('sdrawing'), script: async () => {
      giveKey('sdrawing'); sfx('level'); await notice('Ouro takes a shell with a drawing on it: a round room, and a round person.');
    } },
    stash('oc_nacre', 18, 6, 'In a crack where the septum meets the floor, three grains of nacre.', { tan: 3 }),
    stash('oc_triton', 32, 12, 'Wedged in the wall of the little room, a triton horn.', { pegs: ['bone', 1] }),
  ],
});

defScript('oldEnter', async () => {
  water(1);
  if (!flag('ballastTold')) {
    setFlag('ballastTold');
    await hint('(At high tide the Nautilus tips toward whichever end holds more water.)');
    await hint('(The holes line up only at certain tilts. Pump water from room to room at the valves.)');
  }
});

defScript('protoconch', async () => {
  await emote('ouro', 'surprise');
  const r = await fightWild(mon('protoconch', 42), { canRun: true, area: 'nautilus' });
  if (r.pegged.length) { setFlag('protoconchDone'); await giveMon(r.pegged[0]); }
  else if (r.result === 'win') { await fadeWho('protoconch', false, 40); setFlag('protoconchDone'); }
});

// ---------------------------------------------------------------- the Tide-reader's chamber (room 5)

// The scraped marks. The wall reads, oldest first: 2, 1, 1, 2, 3, 4*, 4*, 3, 2, 1, then three blanks, then the
// next low. The round goes up by one to four, stays one more, comes down to one, stays one more. The blanks
// sit on the stay at one, so counting up and down without the stay gives 2, 3, 4. The answer is 1, 2, 3.
const MARKS_ANSWER = [1, 2, 3];

const tc = new Canvas(13, 11, '#');
tc.rect(1, 1, 11, 9, '_').put(1, 1, '#').put(11, 1, '#').put(1, 9, '#').put(11, 9, '#');
tc.put(0, 5, 'O').put(12, 5, 'O').put(9, 10, 'O');
tc.put(1, 4, 'K').put(11, 4, 'K');
tc.put(6, 5, 'P');
const TC_FLOOR = rectCells(1, 1, 11, 9).filter(([x, y]) => tc.at(x, y) === '_');

defMap({
  id: 'tidechamber', name: 'The Tide-reader\'s room', region: 29, music: 'nautilus', strand: true, indoor: true,
  rows: tc.rows(),
  mods: [
    ...roomWater(5, TC_FLOOR, [[2, 9], [3, 9], [4, 9], [2, 8]]),
    { x: 0, y: 5, ch: '~', when: () => holeOpen(6) && water(6) >= 2 }, { x: 0, y: 5, ch: 'q', when: () => holeOpen(6) },
    { x: 12, y: 5, ch: '~', when: () => holeOpen(5) && water(4) >= 2 }, { x: 12, y: 5, ch: 'q', when: () => holeOpen(5) },
    { x: 9, y: 10, ch: 'q', when: () => !!flag('marksDone') && (!taken() || !!flag('springHigh')) },
  ],
  warps: [
    { x: 0, y: 5, to: 'oldchambers', tx: 15, ty: 10, dir: 2, when: () => holeOpen(6) },
    { x: 12, y: 5, to: 'oldchambers', tx: 23, ty: 15, dir: 2, when: () => holeOpen(5) },
    { x: 9, y: 10, to: 'siphuncle', tx: 5, ty: 9, dir: 3, when: () => !!flag('marksDone') && (!taken() || !!flag('springHigh')) },
  ],
  enter: 'tideEnter',
  npcs: [
    { id: 'tidereader', x: 6, y: 5, sprite: 'tidereader', name: 'Tide-reader', dir: 0, talk: 'tidereader' },
    { id: 'tccinch', x: 9, y: 3, sprite: 'realcinch', name: 'Cinch', dir: 3, talk: 'tcCinch', when: () => !!flag('cinchFollow') && !taken() },
  ],
  spots: [
    { x: 1, y: 4, script: () => valve(6, 5) },
    { x: 11, y: 4, script: () => valve(5, 5) },
    plumb(12, 2),
    { x: 6, y: 0, script: () => marks() },
    look(3, 0, 'Marks cut in the wall, one to four notches each, in rows that go round and up.'),
    look(9, 0, 'Marks in rows going round and up to a point in the ceiling. The lowest rows are pale with age.'),
  ],
});

defScript('tideEnter', async () => {
  if (!flag('tcSeen')) {
    setFlag('tcSeen');
    // A small round room with marks cut round and up every wall, and the Tide-reader slowly turning on a stool.
    for (const d of [1, 0, 3, 2]) { face('tidereader', d); await wait(16); }
  }
  if (flag('cinchNautilus') && !flag('cinchFollow') && !taken()) {
    // Cinch comes in through the hole behind Ouro and stands by the wall, standing for once.
    setFlag('cinchFollow');
    offstage('tccinch');
    const [hx, hy] = [field.x, field.y];
    await walkTo('ouro', 6, 7);
    await walkIn('tccinch', hx, hy, 9, 3);
  }
});

defScript('tcCinch', async () => {
  if (flag('marksDone')) { await cinch('Floor\'s good in here. Ears work better sitting down.'); return; }
  await cinch('Sit on the floor and the low ones are right there to read. They go back a long way.');
});

// The Tide-reader opens every line on a point of the tide.
defScript('tidereader', async () => {
  if (flag('astroDone') && !flag('astroThanked')) {
    setFlag('astroThanked');
    await say('Tide-reader', 'At high water, it was my gran\'s, most cherishedly. At low, it is yours, most deservedly.');
    return;
  }
  if (flag('marksDone')) {
    if (!flag('astroAsked')) {
      setFlag('astroAsked');
      await say('Tide-reader', 'At low, look in the eelgrass for a brass thing with rings in it. A walking instrument.');
      await say('Tide-reader', 'At my gran\'s low, it fell out the hood. At some low since, it got up. Unprecedented!!');
      return;
    }
    if (taken() && !flag('springHigh')) { await say('Tide-reader', 'At the spring high, the old rooms open. At this one they\'re shut, as at the last, and the one befo-'); return; }
    await say('Tide-reader', 'At this tide, there\'s time to get out through the siphon. Go round. Not back. Round.');
    return;
  }
  if (!flag('knifeGiven')) {
    await say('Tide-reader', 'At half tide, you came in through the back!! Nobody does. Nobody ever has.');
    await say('Tide-reader', 'At high water, soup. At low, the wall. At flood, at ebb, at slack, at neap, at spr-');
    await say('Tide-reader', 'At every low since this room was the big room, I have cut one mark. Faithfully.');
    await say('Tide-reader', 'At some high water, a pot hit the top three marks. Scraped clean off!! A calamitous pot.');
    await say('Tide-reader', 'At any tide you like, cut them back for me. Here\'s the knife, my second-best.');
    await hint('(One to four notches for how far the sea went out. Find the pattern and cut the three blanks.)');
    setFlag('knifeGiven');
    return;
  }
  await say('Tide-reader', 'At the top, near the point. Three blank places. The knife\'s yours till they\'re cut.');
});

async function marks(): Promise<void> {
  await say('Marks', 'Newest, near the point, oldest first: two notches. One. One. Two. Three.');
  await say('Marks', 'Four, and a star. Four, and a star. Three. Two. One.');
  if (flag('marksDone')) { await say('Marks', 'Then one, two, three, cut fresh. Then a place for the next.'); return; }
  await say('Marks', 'Then three places scraped smooth.');
  if (!flag('knifeGiven')) return;
  const cut: number[] = [];
  for (let i = 0; i < 3; i++) {
    const k = await listMenu(`Scraped place ${i + 1} of 3`, ['One notch', 'Two notches', 'Three notches', 'Four notches'], { w: 120 });
    if (k < 0) return;
    cut.push(k + 1);
    sfx('cut');
  }
  if (cut.join() !== MARKS_ANSWER.join()) {
    faceToward('tidereader', 'ouro');
    await act('tidereader', 'look');
    await say('Tide-reader', 'At low, the sea never went like that!! Never!! Scrape them and cut again.');
    return;
  }
  await reading();
}

async function reading(): Promise<void> {
  setFlag('marksDone');
  for (const d of [1, 0, 3, 2, 1]) { face('tidereader', d); await wait(20); }
  await say('Tide-reader', 'At the next low, the sea goes out as far as it ever goes. A spring low, greatest of lows!!');
  await say('Tide-reader', 'At a spring low, the Gleaner walks the whole beach.');
  await say('Tide-reader', 'At the first of the ebb, it comes out of the pink shell at the end of the beach.');
  await say('Tide-reader', 'At half ebb, it\'s at the shut one, up the beach. It lifts it, and puts it down.');
  await say('Tide-reader', 'At dead low, it\'s back at the rows. It sets something in a row.');
  await say('Tide-reader', 'At the turn, it goes back into the pink shell and lies down.');
  await say('Tide-reader', 'At every spring low for three hundred years, that has been the walk. So say the marks.');
  // Low on the wall the marks are older and paler, and one has a star cut deeper than the rest.
  face('ouro', 2);
  await wait(20);
  await emote('ouro', 'surprise');
  await say('Tide-reader', 'At the low after the shut one last turned, it was soft. It reached in.');
  await say('Tide-reader', 'At the low after that, it walked with one hand. It\'s walked with one since.');
  if (flag('cinchFollow')) {
    await act('tccinch', 'bow');
    await cinch('Sit. That\'s a lot to hear standing up.');
  }
  await say('Tide-reader', 'At the spring low, the old rooms seal. At the spring high, they open, and seal, and ope-');
  await say('Tide-reader', 'At this tide, you\'ve still time to get out through the siphon. Go round, not back.');
  giveKey('tidetable');
  sfx('level');
  await notice('(The tide table: the menu now shows how far the next low goes, and marks spring lows.)');
  await hint('(At low water, footprint marks show on the sand before the stars land.)');
  goal('Go out through the siphon, by the hole low in the wall.');
  save();
}

// ---------------------------------------------------------------- the siphuncle: the sealing rooms

// Seven rooms in a ring, 0 to 6, with cross-holes 1 to 4 and 2 to 5. Ouro comes in at room 0 from room 5.
// Room 3 holds the disc and the last door and has no valve. Every room Ouro leaves seals.
// Exactly two routes visit all seven and end in room 3 (scratchpad siph.mjs): 0 6 5 4 1 2 3 and 0 6 5 2 1 4 3.
// Eight other walks dead-end.
const SR: [number, number, number, number][] = [
  [3, 8, 3, 3], [5, 3, 3, 3], [14, 3, 3, 3], [18, 8, 3, 3], [16, 13, 3, 3], [10, 13, 3, 3], [4, 14, 3, 2],
];
const SR_EDGES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 4], [2, 5]];
// Hole tiles that belong to each room, and the corridor tiles between rooms.
const SR_HOLES: [number, number, number][] = [
  [0, 5, 7], [1, 5, 6], [1, 8, 4], [2, 13, 4], [2, 17, 4], [3, 19, 7], [3, 18, 11], [4, 18, 12], [4, 15, 14], [5, 13, 14],
  [5, 9, 14], [6, 7, 14], [6, 4, 13], [0, 4, 11], [1, 6, 2], [4, 17, 16], [2, 15, 6], [5, 11, 12],
];
const SR_CORRIDORS: [number, number][] = [
  [9, 4], [10, 4], [11, 4], [12, 4], [18, 4], [19, 4], [19, 5], [19, 6], [14, 14], [8, 14], [4, 12],
  ...Array.from({ length: 6 }, (_, i) => [6 - i, 1] as [number, number]),
  ...Array.from({ length: 16 }, (_, i) => [1, 2 + i] as [number, number]),
  ...Array.from({ length: 16 }, (_, i) => [2 + i, 17] as [number, number]),
  [15, 7], [15, 8], [15, 9], [15, 10], [15, 11], [14, 11], [13, 11], [12, 11], [11, 11],
];
const SR_VALVES: [number, number, number][] = [[0, 3, 8], [1, 7, 5], [2, 14, 3], [4, 16, 15], [5, 12, 15], [6, 4, 15]];
const DISC = { x: 20, y: 9 }, LAST_DOOR = { x: 21, y: 9 };
const SIPHON_LINES: Record<number, string[]> = {
  0: ['This room is a valve on the left. It seals behind you, and means it.'],
  1: ['Two holes out, this room. This room was my room when I was six, and a fine room.'],
  2: ['This room is still my mother\'s cooking, to the nose, and a valve.'],
  4: ['This room is two holes out and a valve. Eggs were kept in it, in rows.'],
  5: ['This room is where the pipe bends, ever so gracefully. Two holes out.'],
  6: ['This room is the small one. This room is a valve and a hole and nothing else.'],
};

const sc = new Canvas(23, 19, '#');
for (const [x, y, w, h] of SR) sc.rect(x, y, w, h, '_');
for (const [x, y] of SR_CORRIDORS) sc.put(x, y, '_');
for (const [, x, y] of SR_VALVES) sc.put(x, y, 'K');
sc.put(6, 9, 'q').put(DISC.x, DISC.y, 'P');

const roomAt = (x: number, y: number) => SR.findIndex(([rx, ry, w, h]) => x >= rx && x < rx + w && y >= ry && y < ry + h);
const puzzleOn = () => !taken();
const sealed = (r: number) => puzzleOn() && ((G.flags.siphSeal || 0) & (1 << r)) !== 0;
const visited = (r: number) => ((G.flags.siphVis || 0) & (1 << r)) !== 0;
const valvesOpen = () => SR_VALVES.filter(([r]) => visited(r)).length;

function siphReset(): void { G.flags.siphSeal = 0; G.flags.siphVis = 0; G.flags.siphCur = -1; }
/** Whether the rooms left unvisited still make a route from room `cur` through all of them to room 3. */
function routeLeft(cur: number): boolean {
  const left = new Set<number>();
  for (let r = 0; r < 7; r++) if (!visited(r)) left.add(r);
  const walk = (r: number): boolean => {
    if (!left.size) return r === 3;
    if (r === 3) return false;
    for (const [a, b] of SR_EDGES) {
      const n = a === r ? b : b === r ? a : -1;
      if (n < 0 || !left.has(n)) continue;
      left.delete(n);
      const ok = walk(n);
      left.add(n);
      if (ok) return true;
    }
    return false;
  };
  return walk(cur);
}

field.stepHooks.push(f => {
  if (f.map.id !== 'siphuncle' || !puzzleOn()) return;
  const r = roomAt(f.x, f.y);
  const cur = G.flags.siphCur ?? -1;
  if (r < 0 || r === cur) return;
  if (cur >= 0) G.flags.siphSeal = (G.flags.siphSeal || 0) | (1 << cur);
  G.flags.siphCur = r;
  if (visited(r)) return;
  G.flags.siphVis = (G.flags.siphVis || 0) | (1 << r);
  void f.runBusy(() => siphEnter(r));
});

async function siphEnter(r: number): Promise<void> {
  if (r === 3) await emote('ouro', 'question');
  for (const l of SIPHON_LINES[r] || []) await say('Siphon', l);
  if (SR_VALVES.some(([v]) => v === r)) {
    sfx('switch');
    await notice(`A ring of the siphon opens. ${valvesOpen()} of 6.`);
  }
  if (r === 0 && !flag('siphTold')) {
    setFlag('siphTold');
    await hint('(Every room you leave seals behind you. Pass through all six valve rooms and finish at the door.)');
  }
  if (!routeLeft(r)) await siphFail();
}

async function siphFail(): Promise<void> {
  await say('Siphon', 'This room is sealed now. This room reopens at the next high water, without fail.');
  // Ouro sits down in the small room and waits until the sea comes in and the rooms open with a sigh.
  await act('ouro', 'bow');
  await tint('#0b0a10', 1, 40);
  sound('wind');
  setTide(true);
  siphReset();
  await warp('tidechamber', 9, 9, 0);
}

defMap({
  id: 'siphuncle', name: 'The siphuncle', region: 29, music: 'nautilus', strand: true, indoor: true,
  rows: sc.rows(),
  mods: [
    // Holes are shut in the rows and open in the mods, so a sealed room closes and the validator still sees the way.
    ...SR_HOLES.map(([r, x, y]) => ({ x, y, ch: '_', when: () => !sealed(r) })),
    { x: LAST_DOOR.x, y: LAST_DOOR.y, ch: '_', when: () => !!flag('springHigh') },
  ],
  warps: [
    { x: 6, y: 9, to: 'tidechamber', tx: 9, ty: 9, dir: 0 },
    { x: LAST_DOOR.x, y: LAST_DOOR.y, to: 'livingchamber', tx: 16, ty: 2, dir: 0, when: () => !!flag('springHigh') },
  ],
  enter: 'siphEnterMap',
  triggers: [{ x: DISC.x, y: DISC.y, w: 1, h: 1, script: 'disc', when: () => !taken() }],
  npcs: [
    { id: 'disccinch', x: DISC.x, y: DISC.y + 1, sprite: 'realcinch', name: 'Cinch', dir: 2, when: () => !!flag('discScene') && !flag('springHigh') },
  ],
  spots: [
    ...SR_VALVES.map(([r, x, y]) => ({ x, y, script: async () => { await emote('ouro', visited(r) && puzzleOn() ? 'music' : 'silence'); } })),
  ],
});

defScript('siphEnterMap', async () => {
  if (!puzzleOn() || field.x !== 5 || field.y !== 9) return;
  siphReset();
  if (!flag('siphSeen')) {
    setFlag('siphSeen');
    await emote('ouro', 'question');
  }
  G.flags.siphCur = 0;
  G.flags.siphVis = 1;
  await siphEnter(0);
});

defScript('disc', async () => {
  if (valvesOpen() < 6) { sound('bump'); await emote('ouro', 'question'); return; }
  // The disc opens the door while someone stands on it: Ouro steps on, and the door slides open; Ouro steps off, and it shuts.
  const door = MAPS.siphuncle.mods!.find(m => m.x === LAST_DOOR.x && m.y === LAST_DOOR.y)!;
  const shut = door.when;
  door.when = () => true;
  sfx('switch');
  await wait(30);
  await walkTo('ouro', DISC.x - 1, DISC.y);
  door.when = shut;
  sfx('switch');
  await say('Siphon', 'This room is on the far side of the door. This room is waiting for you, with great patience.');
  await walkTo('ouro', DISC.x, DISC.y);
  door.when = () => true; sfx('switch'); await wait(20);
  await walkTo('ouro', DISC.x - 1, DISC.y);
  door.when = shut; sfx('switch');
  await granSpeaks();
  await wait(12);
  // Cinch comes in behind, looks at the disc and at Ouro, and sits down on it. The door slides open and stays open.
  setFlag('discScene');
  offstage('disccinch');
  await walkIn('disccinch', 18, 11, DISC.x, DISC.y + 1);
  face('disccinch', 2);
  await wait(20);
  faceToward('disccinch', 'ouro');
  await wait(20);
  await walkTo('disccinch', DISC.x, DISC.y);
  await act('disccinch', 'bow');
  door.when = () => true;
  sfx('switch');
  await cinch('Ha. This is a sitting job. My favorite kind.');
  await choose(['Get up.', 'Come with me.']);
  await cinch('I\'ll sit. Can see you through the door from here. That\'s plenty.');
  // Ouro squeezes past Cinch on the disc and goes through.
  field.stepWho('ouro', 1); await wait(9);
  field.stepWho('ouro', 1); await wait(9);
  door.when = shut;
  setFlag('discTaken');
  setFlag('springLow');
  // The spring low: the sea goes out and stays out until the spring high, and the hand bell will not turn it.
  setTide(false);
  if (G.keys.includes('handbell')) { G.keys = G.keys.filter(k => k !== 'handbell'); setFlag('bellHeld'); }
  (G as any).a2lastTannery = G.lastTannery;
  G.lastTannery = { map: 'livingchamber', x: 12, y: 9 };
  await warp('livingchamber', 16, 2, 0);
  // The floor shudders as the sea goes out past the hood, and new shell grows across the door from all sides,
  // pale and wet, until it is a wall with a small round window in it, and Cinch's face in the window.
  await shake(30);
  sound('heal');
  face('ouro', 2);
  await emote('ouro', 'surprise');
  await cinch('Sit there, where I can see you through the window.');
  await act('ouro', 'bow');
  await wait(120);
  // Then Cinch lifts one hand off a knee, an inch, and puts it back.
  await act('lcwindow', 'nod');
  await wait(40);
  goal('Siphon waits by the fire.');
  save();
});

// While the overlay draws, keep a count of rings left on screen for puzzles that use it.
export function cornerText(s: string): void { text(s, 3, 3, SEL, '#0b0a10'); }

void SPECIES;
