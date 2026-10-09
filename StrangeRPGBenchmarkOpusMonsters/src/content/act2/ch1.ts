// Act 2, chapter 1: the Margin opens, the Outer Whorl, the Wrack, the Sand Dollar, the Doves, and the Flats.
// See Notes/act2-script.md. Helpers every Act 2 chapter of mine shares are exported from here.
import { sfx } from '../../engine/audio';
import { text } from '../../engine/font';
import { INK, rect } from '../../engine/screen';
import { PEOPLE } from '../../engine/sprites';
import { makeMon, SPECIES } from '../../data/species';
import { battle } from '../../game/battleView';
import { act, choose, emote, evening, face, faceToward, fadeWho, field, fightWild, giveMon, goal, hint, mon, morphTo, moveNpc, narr, notice, offstage, pan, panBack, prop, say, sound, tannery, tint, unprop, wait, walkIn, walkOff, walkTo } from '../../game/api';
import { listMenu, monLine } from '../../game/menus';
import { starfall } from '../../game/minigames/starfall';
import { G, flag, save, setFlag } from '../../game/state';
import { strandFx } from '../../game/strandfx';
import { defMap, defScript, MAPS, SCRIPTS, type MapDef, type NpcDef } from '../../game/world';
import { Canvas, highTide, kinds, link, look, reward, stash } from '../areakit';
import { smallGranLine } from '../ch1';
import { STOCK_6 } from '../ch6';
import { playShellboard } from '../minigames';
import { FOOTPRINTS, defineShells, giveGrain, gleanerWalk, shellMon, shellThere, sweepAll, tideHooks, turnTide, washAll } from './kit';

type Spot = NonNullable<MapDef['spots']>[number];
type Mod = NonNullable<MapDef['mods']>[number];

// ---------------------------------------------------------------- shared by chapters 1 to 3

export const release = (): boolean => !!flag('endRelease');
export const grains = (): number => G.flags.a2pearls || 0;
export const low = (): boolean => !highTide();
export const cinch = (line: string): Promise<void> => say('Cinch', line, PEOPLE.realcinch);
export async function sayAll(who: string | null, ls: string[]): Promise<void> { for (const l of ls) await say(who, l); }

/** A person who stands and talks through a script of the same id, so later chapters can wrap the script. */
export function person(id: string, x: number, y: number, sprite: string, name: string, dir = 0, extra: Partial<NpcDef> = {}): NpcDef {
  return { id, x, y, sprite, name, dir, talk: extra.trainer ? undefined : id, ...extra };
}

/**
 * Tide cells from a layout, one mod per run of cells: 'A' is sea at high tide, 'B' is sea at low tide.
 * Runs keep the mod list short on big beaches.
 */
export function tideRuns(layout: string[], x0: number, y0: number): Mod[] {
  const mods: Mod[] = [];
  layout.forEach((r, j) => {
    for (let i = 0; i < r.length;) {
      const c = r[i];
      if (c !== 'A' && c !== 'B') { i++; continue; }
      let n = 1;
      while (r[i + n] === c) n++;
      mods.push({ x: x0 + i, y: y0 + j, w: n, ch: '~', when: c === 'A' ? highTide : () => !highTide() });
      i += n;
    }
  });
  return mods;
}

/** A townsperson with one line at high tide and another at low water. */
export function tideTalk(id: string, name: string, high: string[], lowLines: string[]): void {
  defScript(id, async () => { await sayAll(name, highTide() ? high : lowLines); });
}

/** Runs after the tide has turned, by a bell or by a scene. The argument says whether it went out. */
export const tideWatch: ((wentLow: boolean) => void | Promise<void>)[] = [];
async function tideTurned(wasHigh: boolean): Promise<void> {
  const nowHigh = highTide();
  if (wasHigh !== nowHigh) for (const h of tideWatch) await h(!nowHigh);
}
tideHooks.push(high => tideTurned(!high));
/** A tide bell on a post. */
export function bell(x: number, y: number): Spot { return { x, y, script: 'a2Bell' }; }
defScript('a2Bell', turnTide);

/** A scripted low water: the shadow passes, stars land, and the sweep runs. */
export async function scriptedLow(keep: string[] = []): Promise<number> {
  const was = highTide();
  setFlag('tide', 0);
  await gleanerWalk();
  const kept = keep.filter(k => !flag('shell:' + k));
  const gone = flag('sweepOver') ? 0 : sweepAll();
  for (const k of kept) setFlag('shell:' + k, 0);
  await tideTurned(was);
  field.spawnWanderers();
  field.playMapMusic();
  save();
  return gone;
}
/** A scripted high water: the sea comes back and washes up fresh shells. */
export function scriptedHigh(): void {
  const was = highTide();
  setFlag('tide', 1);
  washAll();
  void tideTurned(was);
  field.spawnWanderers();
  field.playMapMusic();
  save();
}

/** A keeper battle that says its own line on a loss before Ouro walks back. Resolves to whether Ouro won. */
export async function keeperFight(name: string, team: [string, number][], loseLine: string): Promise<boolean> {
  const r = await battle({ enemy: team.map(([k, l]) => makeMon(k, l)), name, ai: 'keeper', wild: false, bg: field.bg(), music: 'keeperStrand' });
  field.playMapMusic();
  if (r.result === 'win') return true;
  await say(name, loseLine);
  await field.lose();
  return false;
}

/** A Strand-rule Shellboard match. The first one explains the rule. */
export async function strandBoard(r: { id: string; name: string; deck: string[]; tier: number; prize: string; lines: string[] }): Promise<void> {
  if (!flag('strandRuleTold')) {
    setFlag('strandRuleTold');
    await hint('(Strand rule: the row nearest the sea is wet. A card on a wet row loses 1 on every edge.)');
    await hint('(At high tide the middle row is wet as well.)');
  }
  await playShellboard({ ...r, look: true, strand: true });
}

/** Points the way once a chapter's step is done. */
export function goalOnce(key: string, text: string): void { if (!flag('goal_' + key)) { setFlag('goal_' + key); goal(text); } }

/** A whorl caught on the Strand, given whole. Kinds not written yet wait. */
export async function giveStrandMon(kind: string, level: number): Promise<boolean> {
  if (!SPECIES[kind]) return false;
  const m = makeMon(kind, level);
  m.strandBorn = true;
  await giveMon(m);
  return true;
}

/** Where a lost battle walks Ouro back to on the Strand, until the Sand Dollar's grotto is used. */
function strandHome(map: string, x: number, y: number): void {
  const at = G.lastTannery.map;
  if (!MAPS[at]?.strand || (at === 'outerwhorl' && map !== 'outerwhorl')) G.lastTannery = { map, x, y };
}

// ---------------------------------------------------------------- Gran's kitchen while Small Gran is out

const homeSmallGran = MAPS.home?.npcs.find(n => n.id === 'smallgran');
if (homeSmallGran) { const was = homeSmallGran.when; homeSmallGran.when = () => !flag('smallGranOut') && (!was || was()); }
const granBefore = SCRIPTS.gran;
// Gran tells Small Gran what to tell her little turnip, and Small Gran is not there.
defScript('gran', async () => {
  if (!flag('smallGranOut')) { if (granBefore) await granBefore(); return; }
  if (!flag('granEmpty')) {
    setFlag('granEmpty');
    // Gran talks to the empty place by the window where Small Gran stood.
    face('gran', 1);
    await emote('gran', 'silence');
    await say('Gran', 'Tell my little turnip soup.');
    await say('Gran', 'Tell my little turnip she is to be brought home of a Sunday. Every Sunday.');
    await act('gran', 'look');
    await act('gran', 'nod');
    await act('gran', 'nod');
    return;
  }
  await say('Gran', flag('granEmpty') % 2 ? 'Tell my little turnip there is soup, and that two bowls are laid regardless.' : 'Tell my little turnip Sundays, without exception.');
  setFlag('granEmpty', flag('granEmpty') + 1);
});

// ---------------------------------------------------------------- the Margin: the star's hole

const HOLE = { x: 38, y: 14 };
const marginReady = () => !!flag('metCinch') && !!flag('mapDone');
(MAPS.margin.mods ||= []).push({ x: HOLE.x, y: HOLE.y, ch: 'O', when: () => !!flag('marginOpen') && !flag('a2Dropped') });
link('margin', HOLE.x, HOLE.y, 'q', { to: 'outerwhorl', tx: 16, ty: 1, dir: 0 }, () => !!flag('a2Dropped'));
MAPS.margin.npcs.push(person('a2CinchMargin', HOLE.x, HOLE.y - 1, 'realcinch', 'Cinch', 0, { when: () => !!flag('marginOpen') && !flag('a2Dropped') }));
(MAPS.margin.spots ||= []).push({ x: HOLE.x, y: HOLE.y, when: () => !!flag('marginOpen') && !flag('a2Dropped'), script: 'a2CinchMargin' });
const marginEnter = MAPS.margin.enter;
MAPS.margin.enter = 'a2MarginEnter';
defScript('a2MarginEnter', async () => {
  if (marginEnter && SCRIPTS[marginEnter]) await SCRIPTS[marginEnter]();
  if (flag('marginOpen') || !marginReady()) return;
  // A star drops slow and low over the Margin and lands at the east edge, where the ground stops.
  // The ground goes white, then gold, in rings, and the edge is burned through.
  offstage('a2CinchMargin');
  await pan(HOLE.x - 4, HOLE.y);
  strandFx.landings.push({ x: HOLE.x, y: HOLE.y, t: 0 });
  await wait(14);
  sfx('boom');
  field.flashT = 20;
  field.shakeT = 20;
  await wait(40);
  await morphTo('marginOpen', HOLE.x, HOLE.y);
  await wait(40);
  await panBack();
  // Cinch walks over from the fire while Ouro crosses the Margin, out of sight.
  const c = field.npc('a2CinchMargin');
  if (c) c.hidden = false;
  goal('Go to the east edge of the Margin.');
});

// Every line of Cinch's invites someone to sit, or says what a person sitting down would notice.
defScript('a2CinchMargin', async () => {
  if (!flag('marginTalked')) {
    setFlag('marginTalked');
    await cinch('Sit down, sit down. Saw that one coming from all the way over at the fire.');
    await cinch('Most of a day\'s walk, for me. Sat down four or five times on the way.');
    await cinch('Sit low and the air comes right up in your face. That\'s the beach, that air.');
    if (release()) {
      await cinch('Have a sit first. Your ground\'s gone soft. Can feel it right through the coat.');
      await cinch('New shell gives a bit when you sit on it. Forgot that. Been a while.');
    } else {
      await cinch('Sit a minute before you go. Who\'s turning your post while you\'re out?');
      await choose(['Tack is.']);
      await cinch('Tack. Good. Counting\'s a sitting-down job, mostly. Sit easy, then.');
    }
    await cinch('Sit on the edge with your legs over. That\'s how I went. Then you sort of lean.');
  }
  if (await choose(['Go through', 'Not yet']) !== 0) { await cinch('No rush. Be right here. Forty years of practice, sitting.'); return; }
  // Ouro sits on the edge of the hole with both legs hanging into the cold, and drops.
  face('ouro', 1);
  await act('ouro', 'bow');
  await wait(30);
  await act('ouro', 'hop');
  sound('wind');
  await tint('#0b0a10', 1, 20);
  setFlag('a2Dropped');
  setFlag('a2');
  strandHome('outerwhorl', 16, 1);
  field.warp('outerwhorl', 16, 1, 0);
});

// ---------------------------------------------------------------- the Outer Whorl

// Growth ridges run across the shell. Their gaps switch sides on the way down, so the path is a spiral.
const ow = new Canvas(32, 28, '.').border('#');
for (const [y, gx] of [[4, 27], [8, 3], [12, 27], [16, 3], [20, 27]] as const) ow.rect(1, y, 30, 1, '#').rect(gx, y, 2, 1, '.');
ow.rect(1, 25, 30, 2, '~').put(16, 0, 'q');
for (const [x, y, w, h] of [[6, 5, 6, 2], [19, 9, 7, 2], [5, 13, 6, 2], [18, 17, 7, 2], [8, 1, 4, 2]]) ow.rect(x, y, w, h, ',');
ow.rect(22, 14, 3, 1, 'T').put(2, 21, 'U').put(0, 23, '.').put(0, 24, '.');
const OW_TIDE = ['A'.repeat(31), 'A'.repeat(31)];
// Eight Stay points through the shell, in a ring round its edge.
const STAY_POINTS: [number, number][] = [[5, 4], [10, 4], [15, 4], [21, 4], [8, 8], [13, 8], [18, 8], [24, 8]];
const holes = () => (release() ? 8 : Math.min(8, G.pulled.length));
const owMods: Mod[] = [
  ...tideRuns(OW_TIDE, 0, 23),
  ...STAY_POINTS.flatMap(([x, y], i) => [{ x, y, ch: 'O', when: () => i < holes() }, { x, y, ch: 'B', when: () => true }]),
  { x: 12, y: 22, ch: 'J', when: () => !!flag('cinchInWhelk') },
];
FOOTPRINTS.outerwhorl = [[3, 24], [8, 24], [13, 24], [18, 24], [23, 24], [28, 24]];

defMap({
  id: 'outerwhorl', name: 'The Outer Whorl', region: 32, music: 'strand', strand: true,
  rows: ow.rows(),
  mods: owMods,
  shells: [
    { id: 'foot1', x: 6, y: 22 }, { id: 'foot2', x: 9, y: 22 }, { id: 'cinchwhelk', x: 12, y: 22 }, { id: 'foot3', x: 15, y: 22 },
    { id: 'foot4', x: 19, y: 22 }, { id: 'foot5', x: 23, y: 22 },
  ],
  warps: [
    { x: 16, y: 0, to: 'margin', tx: HOLE.x - 1, ty: HOLE.y, dir: 3 },
    { x: 0, y: 23, to: 'wrack', tx: 48, ty: 5, dir: 3 }, { x: 0, y: 24, to: 'wrack', tx: 48, ty: 6, dir: 3 },
  ],
  enter: 'a2OuterWhorl',
  // Ostium is found only at the star's hole. It is listed here so the Register knows where it lives.
  zone: {
    kinds: kinds([['acorn', 3], ['varix', 3], ['mew', 3], ['halite', 2], ['ostium', 1]]), lv: [5, 9], n: 8, area: 'whorl',
    tideKinds: { high: kinds([['acorn', 3], ['varix', 3], ['mew', 3], ['halite', 2]]), low: kinds([['acorn', 3], ['varix', 3], ['mew', 3], ['halite', 2]]) },
  },
  triggers: [
    { x: 1, y: 21, w: 30, h: 1, script: 'a2FirstLow', when: () => !flag('owLowDone') },
    { x: 1, y: 21, w: 30, h: 2, script: 'a2Ch1Return', when: () => grains() >= 1 && !flag('ch1Return') && !!flag('owLowDone') },
  ],
  npcs: [
    person('a2CinchRidge', 17, 2, 'realcinch', 'Cinch', 3, { when: () => !flag('owLowDone') }),
    person('a2CinchFoot', 11, 21, 'realcinch', 'Cinch', 1, { when: () => !!flag('owCinchFoot') && !flag('owLowDone') }),
  ],
  spots: [
    bell(2, 21),
    look(4, 0, 'The shell curls away under Ouro\'s feet, ridge after ridge, down to the sand.'),
    { x: 9, y: 0, script: 'a2Exuvia' },
    look(12, 12, 'The ridge is worn smooth here in a long dip, the width of a road.', 'Something big has leaned on it, many times.'),
    look(22, 14, 'An old lip of the shell, outgrown one spring long ago. The barnacles moved in after.'),
    stash('ow_lee', 2, 12, 'In the lee of the third ridge, wedged in a growth line, two whelk horns.', { pegs: ['brass', 2] }),
    ...STAY_POINTS.map(([x, y], i) => ({ x, y, script: async () => {
      await emote('ouro', i >= holes() ? 'silence' : 'question');
    } })),
    { x: 15, y: 0, script: 'a2Ostium' },
  ],
});
defineShells('outerwhorl');

defScript('a2OuterWhorl', async () => {
  strandHome('outerwhorl', 16, 1);
  if (flag('owSeen')) return;
  setFlag('owSeen');
  // Ouro comes out on a slope of pale ridged shell. Far below is sand, and past it a long gray sea.
  offstage('a2CinchRidge');
  await tint('#0b0a10', 0, 30);
  await pan(16, 24);
  await wait(40);
  await panBack();
  // Ouro steps down off the lip, and Cinch comes through the hole behind, feet first, and sits on the nearest ridge.
  await walkTo('ouro', 15, 3);
  await walkIn('a2CinchRidge', 16, 0, 17, 2);
  face('a2CinchRidge', 3);
  await act('a2CinchRidge', 'bow');
  await cinch('Here, sit. Best seat there is for seeing what you came out of.');
  // Ouro turns round. The slope curls up and over in one spiral. Eight Stays stick through it in a ring, or leave holes.
  face('ouro', 2);
  await emote('ouro', 'surprise');
  await pan(14, 6);
  await wait(50);
  await narr('It is a shell. It lies on the sand. It is the size of a hill.');
  await panBack();
  await exuviaLines();
  await cinch('Sit and look a while. It\'s bigger from the inside.');
  goal('Walk down the ridges to the sand.');
});

async function exuviaLines(): Promise<void> {
  await narr(flag('mundaneCaught') ? 'North along the beach there is a hollow in the sand, shell-shaped. Nothing is in it.' : 'North along the beach lies another shell, paler and older, half sunk in the sand.');
}
defScript('a2Exuvia', exuviaLines);

defScript('a2CinchRidge', async () => { await cinch('Still looking? Good. Sit and look. It\'s bigger from the inside.'); });
defScript('a2CinchFoot', async () => { await cinch('Pick a shell, any shell, and sit in it with me. It\'s coming low.'); });

// The foot of the Volute, the first low water. The Gleaner passes for the first time.
defScript('a2FirstLow', async () => {
  // The ridges end in wet sand with big empty shells in a line where the sea last stopped. Cinch catches up down the ridges.
  offstage('a2CinchRidge');
  setFlag('owCinchFoot');
  offstage('a2CinchFoot');
  await walkIn('a2CinchFoot', 27, 20, 11, 21);
  await act('a2CinchFoot', 'bow');
  await act('a2CinchFoot', 'hop');
  await cinch('Sit in one of these with me. Quick, now. It\'s coming low.');
  // Cinch climbs into the mouth of a big brown whelk and sits down inside it.
  await walkTo('a2CinchFoot', 12, 21);
  face('a2CinchFoot', 0);
  await fadeWho('a2CinchFoot', false, 16);
  setFlag('cinchInWhelk');
  if (await choose(['Get in', 'Stay out']) === 1) await cinch('Suit yourself. Sit by the door, then, where I can see you.');
  await walkTo('ouro', 12, 21);
  face('ouro', 0);
  await act('ouro', 'bow');
  // The sea goes out, and the ground shakes once, then again much later, closer.
  await morphTo('tide', 12, 24, 0, 0);
  field.shakeT = 12;
  sfx('boom');
  await wait(60);
  await gleanerWalk();
  // Cinch taps one foot on the floor of the shell.
  sound('step'); await wait(16); sound('step');
  await cinch('Always tap my foot in here. Can\'t help it.');
  // A shadow goes over the whelk, the shell tips a little and settles, and the shaking goes off along the beach.
  strandFx.shadow = 120;
  field.shakeT = 20;
  for (let i = 0; i < 4; i++) { sound('step'); await wait(8); }
  await act('ouro', 'shiver');
  for (const n of [10, 6, 3]) { await wait(30); field.shakeT = n; }
  const going = (field.map.shells || []).filter(s => s.id !== 'cinchwhelk' && shellThere('outerwhorl', s.id) && !shellMon('outerwhorl', s.id));
  for (const s of going) void field.prop('sweep' + s.id, 'C', s.x, s.y, 0);
  sweepAll();
  setFlag('shell:outerwhorl:cinchwhelk', 0);
  for (const s of going) void field.unprop('sweep' + s.id, 40);
  await wait(44);
  await act('ouro', 'look');
  setFlag('cinchInWhelk', 0);
  await fadeWho('a2CinchFoot', true, 16);
  await cinch('Stay sat a bit. Here it comes back in.');
  await cinch('See the bell from down here? There, on the post by the weed.');
  await hint('(Ring a tide bell to turn the tide. At high tide the low sand is under water.)');
  await hint('(At low tide the sand is open, and stars fall in a line.)');
  await hint('(At low water a shell with nothing moving in it is gone when the shadow passes.)');
  setFlag('lowTold');
  setFlag('highTold');
  await cinch('Me, I\'m off to sit at whatever fire they\'ve got. West, along the weed.');
  // Cinch walks off west along the wrack line, slowly, sitting down twice on the way.
  await walkTo('a2CinchFoot', 7, 21);
  await act('a2CinchFoot', 'bow');
  await walkTo('a2CinchFoot', 3, 22);
  await act('a2CinchFoot', 'bow');
  await walkOff('a2CinchFoot', 0, 23);
  // The sea comes back in behind Cinch, fills the hollows, and covers the lower sand.
  await morphTo('tide', 12, 24, 0, 1);
  setFlag('tide', 0);
  scriptedHigh();
  setFlag('owLowDone');
  goal('Go west along the Wrack to the Sand Dollar.');
});

// The Return: Ouro walks back to the foot of the Volute at night and puts a hand on it.
defScript('a2Ch1Return', async () => {
  setFlag('ch1Return');
  // Night, at high tide, with the sea up round the bottom ridge.
  if (low()) { await morphTo('tide', field.x, 24, 0, 1); setFlag('tide', 0); scriptedHigh(); }
  await tint('#0b0a10', 0.4, 50);
  evening(true);
  await tint('#0b0a10', 0, 30);
  // Ouro puts a hand flat on the outside of the Volute.
  face('ouro', 2);
  await act('ouro', 'bow');
  if (release()) { field.shakeT = 4; await act('ouro', 'back'); }
  else await emote('ouro', 'silence');
  // A star falls out at sea and goes out on the water, then another beside it, and more in a line.
  for (const x of [8, 13, 18, 23]) { strandFx.landings.push({ x, y: 25, t: 0 }); await wait(30); }
  await wait(40);
  await hint('(The Margin hole stays open. Go back inside any time through the Outer Whorl.)');
  goal('Cinch is at the fire in the Sand Dollar.');
});

defScript('a2Ostium', async () => {
  if (grains() < 1 || flag('ostiumDone')) { await emote('ouro', 'silence'); return; }
  await emote('ouro', 'surprise');
  if (!SPECIES.ostium) return;
  const r = await fightWild(mon('ostium', 15), { canRun: true, area: 'whorl' });
  if (r.pegged.length) { r.pegged[0].strandBorn = true; setFlag('ostiumDone'); await giveMon(r.pegged[0]); }
  else if (r.result === 'win') setFlag('ostiumDone');
});

// ---------------------------------------------------------------- the Wrack

// The high tide line from the foot of the Volute west to the Sand Dollar. The layout matches the gap solver
// (scratchpad gap.mjs). Without wearing, the shortest way west from the east bell at high tide is 55 moves:
// ring low (the gap shells go), walk west through the gap and along the rim to the rock, ring the pool bell high
// (the pool shell washes back), leave a whorl in it, ring low (it stays), climb over it, and call the whorl back.
const WR_W = 50, WR_H = 24;
const wr = new Canvas(WR_W, WR_H, '.');
wr.rect(0, 17, WR_W, 6, '~').border('#').rect(1, 1, WR_W - 2, 1, 'T');
wr.rect(27, 1, 3, 16, 'T').rect(27, 5, 3, 3, '.');
wr.rect(15, 2, 5, 15, '~').put(16, 5, '.').put(16, 6, '.').put(17, 6, '.').put(18, 6, '.').put(19, 6, '.').put(15, 5, 'U');
wr.put(46, 4, 'U').put(0, 5, '=').put(0, 6, '=').put(WR_W - 1, 5, '=').put(WR_W - 1, 6, '=');
// weed rings, the label post, the bottle girl's log, a hollow log, and the gray at the low end
for (const [x, y, w, h] of [[38, 2, 5, 2], [42, 8, 4, 2], [31, 8, 5, 2], [20, 2, 5, 2], [21, 8, 4, 2], [3, 2, 6, 2], [6, 8, 5, 2]]) wr.rect(x, y, w, h, ',');
wr.put(36, 2, 'f').put(36, 3, 'f').put(34, 3, 'e').put(4, 4, 'e').put(1, 9, 'Y').put(0, 9, 'Y');
// the line of hollows down to the sea, and the whelk the family lives in
FOOTPRINTS.wrack = [[38, 5], [39, 9], [40, 13], [41, 17], [42, 21]];
for (const [x, y] of FOOTPRINTS.wrack) if (wr.at(x, y) === '.') wr.put(x, y, 'b');
wr.put(37, 8, 'C');
const WR_TIDE: string[] = [];
for (let y = 10; y <= 16; y++) {
  let r = '';
  for (let x = 0; x < WR_W; x++) r += x > 0 && x < WR_W - 1 && !'T~'.includes(wr.at(x, y)) ? 'A' : '.';
  WR_TIDE.push(r);
}
const RIM = [[17, 6], [18, 6], [19, 6]];
const POOL = { x: 15, y: 6 };
const wrMods: Mod[] = [
  ...tideRuns(WR_TIDE, 0, 10),
  ...RIM.map(([x, y]) => ({ x, y, ch: '~', when: highTide })),
  // A taken pool shell leaves the pool, not a hollow.
  { x: POOL.x, y: POOL.y, ch: '~', when: () => !shellThere('wrack', 'pool') },
  { x: 37, y: 8, ch: 'J', when: low },
  // The Sifter's whelk: plain sand until the house is taken, the Sifter's own house once it has held.
  { x: 44, y: 8, ch: 'J', when: () => !!flag('sifterHome') },
  { x: 44, y: 8, ch: ',', when: () => !flag('sifterTake') },
];
defMap({
  id: 'wrack', name: 'The Wrack', region: 25, music: 'strand', strand: true,
  rows: wr.rows(),
  mods: wrMods,
  props: [{ x: 36, y: 2, pic: 'labelPost' }, { x: 33, y: 4, pic: 'bottle' }],
  shells: [
    { id: 'gap1', x: 28, y: 5, washed: true }, { id: 'gap2', x: 28, y: 6, washed: true }, { id: 'gap3', x: 28, y: 7, washed: true },
    { id: 'pool', x: POOL.x, y: POOL.y, washed: true },
    { id: 'ring1', x: 40, y: 4, washed: true }, { id: 'ring2', x: 22, y: 4, washed: true }, { id: 'ring3', x: 7, y: 4, washed: true },
    { id: 'sifterwhelk', x: 44, y: 8, washed: true },
  ],
  warps: [
    { x: 0, y: 5, to: 'sanddollar', tx: 37, ty: 19, dir: 3 }, { x: 0, y: 6, to: 'sanddollar', tx: 37, ty: 19, dir: 3 },
    { x: WR_W - 1, y: 5, to: 'outerwhorl', tx: 1, ty: 22, dir: 1 }, { x: WR_W - 1, y: 6, to: 'outerwhorl', tx: 1, ty: 22, dir: 1 },
    { x: 0, y: 9, to: 'shoreline', tx: 5, ty: 1, dir: 1 },
  ],
  enter: 'a2WrackEnter',
  zone: {
    kinds: kinds([['skitter', 3], ['mote', 2], ['kipper', 2], ['lacuna', 1], ['fucus', 3], ['flotsam', 2], ['seaglass', 2], ['actinia', 2]]), lv: [5, 12], n: 10, area: 'strand',
    tideKinds: { high: kinds([['fucus', 3], ['flotsam', 2], ['seaglass', 2], ['actinia', 2]]), low: kinds([['skitter', 3], ['mote', 2], ['kipper', 2], ['lacuna', 1]]) },
  },
  npcs: [
    person('a2WrackSign', 45, 3, 'sign', undefined as unknown as string),
    person('a2BottleGirl', 33, 3, 'bottlegirl', 'Bottle girl', 0),
    person('a2Raker', 41, 6, 'beach2', 'Weed-raker', 0, { wander: true }),
    person('a2ShellSitter', 43, 3, 'beach3', 'Shell-sitter', 2, { trainer: { name: 'Shell-sitter', team: [['skitter', 6], ['fucus', 7]], intro: 'Different shell every low, that\'s my rule. Yesterday was a whelk. Drafty.', defeat: 'Fine. This shell\'s taken. Plenty more on the beach.', sight: 3 } }),
    person('a2GrainPicker', 23, 7, 'beach1', 'Grain-picker', 3, { trainer: { name: 'Grain-picker', team: [['mote', 7], ['kipper', 7]], intro: 'Grains go to the Sifter. You\'re going in the sand.', defeat: 'Ugh. The Sifter\'s gonna hear about this. And weigh it.', sight: 3 } }),
    person('a2Driftwood', 9, 8, 'beach3', 'Driftwood boy', 0, { trainer: { name: 'Driftwood boy', team: [['flotsam', 8], ['seaglass', 8]], intro: 'Everything floats in. Some of it floats back out. I wanna see where it goes.', defeat: 'I\'m floating back. Don\'t follow, you\'d sink.', sight: 3 } }),
  ],
  spots: [
    // Climbing over the pool shell comes before the shell's own use, from either bank.
    { x: POOL.x, y: POOL.y, when: () => shellThere('wrack', 'pool') && Math.abs(field.x - POOL.x) === 1 && field.y === POOL.y, script: 'a2PoolShell' },
    bell(46, 4), bell(15, 5),
    { x: 36, y: 3, script: 'a2LabelPost' },
    { x: 36, y: 2, script: 'a2LabelPost' },
    { x: 37, y: 8, script: 'a2WhelkFamily' },
    { x: 38, y: 5, script: 'a2Hollows' },
    { x: 44, y: 8, when: () => !flag('sifterTake'), script: async () => {} },
    { x: 44, y: 8, when: () => !!flag('sifterHome'), script: 'a2SifterHouse' },
    stash('wr_knot', 30, 1, 'In a knot of black weed, dry inside, a notion.', { notion: 'longshin' }),
    stash('wr_oyster', 15, 3, 'An oyster in the pool, as big as a plate. Ouro pries it open. Nacre.', { tan: 2 }),
    stash('wr_log', 4, 4, 'A hollow log. Down inside it, a triton horn.', { pegs: ['bone', 1] }),
    { x: 31, y: 9, when: () => !!flag('drill1'), script: 'a2DrillWrack' },
  ],
});
defineShells('wrack');

defScript('a2WrackEnter', async () => {
  if (!flag('wrackSeen')) {
    setFlag('wrackSeen');
    await pan(field.x - 10, field.y);
    await wait(30);
    await panBack();
  }
});

defScript('a2WrackSign', async () => { await say('Sign', 'The Sand Dollar, west. At low water, get in something. Under it, scratched: and WIGGLE'); });

defScript('a2LabelPost', async () => {
  await say('Label', 'KEEP THE SEA.');
});

defScript('a2WhelkFamily', async () => {
  if (highTide()) { await emote('ouro', 'silence'); return; }
  // Three people sit inside the whelk, rocking it from side to side.
  sound('step'); field.shakeT = 4;
  await say('Woman in a whelk', 'Low water, so we\'re in. Hi. Can\'t stop.');
  await say('Man in a whelk', 'Keep rocking, Mim. Good. Big rocks. That\'s it.');
  await say('Child in a whelk', 'I\'m ROCKING, Dad.');
});

defScript('a2Hollows', async () => {
  // A line of hollows as long as houses goes down into the sea, each with five round dents at one end: footprints.
  await pan(field.x, field.y + 4);
  await emote('ouro', 'question');
  await panBack();
});

defScript('a2PoolShell', async () => {
  const k = 'wrack:pool';
  const sitting = shellMon('wrack', 'pool');
  const opts: string[] = [];
  if (low()) opts.push('Climb over it');
  if (sitting) opts.push(`Call ${sitting.name}`); else if (G.party.length >= 2) opts.push('Leave a whorl in it');
  opts.push('Leave it');
  const c = opts[await choose(opts, true)];
  if (c === 'Climb over it') {
    // Ouro climbs up the shell's back and down the other side.
    const d = field.x === POOL.x + 1 ? 3 : 1;
    void act('ouro', 'hop');
    field.stepWho('ouro', d); await wait(9);
    field.stepWho('ouro', d); await wait(9);
    return;
  }
  if (c === 'Leave a whorl in it') {
    const i = await listMenu('Leave which whorl?', G.party.map(monLine), { w: 140 });
    if (i < 0) return;
    const [m] = G.party.splice(i, 1);
    G.shellMons[k] = m;
    sfx('switch');
    await emote('ouro', 'heart');
    save();
    return;
  }
  if (c && c.startsWith('Call') && sitting) {
    delete G.shellMons[k];
    if (G.party.length < 4) G.party.push(sitting); else G.rack.push(sitting);
    sfx('switch');
    await notice(G.party.includes(sitting) ? `${sitting.name} comes back to your team.` : `${sitting.name} goes to the Midden.`);
    save();
  }
});

// The bottle girl addresses every line to someone who is not there.
defScript('a2BottleGirl', async () => {
  if (flag('bottlesDone')) { await say('Bottle girl', 'Dear inside. Low water, I\'m in the log. Logs used to be trees. Dear trees, what\'s it like up?'); return; }
  await act('a2BottleGirl', 'nod');
  await say('Label', 'KEEP THE STARS.');
  await say('Bottle girl', 'Dear inside. Another one washed up today, under a crab. The crab says hello.');
  await say('Bottle girl', 'Dear whoever reads these. I find them all along the wrack. Sorry about the sand in them.');
  await say('Bottle girl', 'Dear sea. Take this one in under the big shell. Shell, bell, well. Dear well, are you down there?');
  // She corks the bottle and throws it into the shallows, where it turns and goes out.
  sound('ok');
  await act('a2BottleGirl', 'hop');
  await prop('thrown', 'bottle', 33, 6, 10);
  await wait(30);
  await unprop('thrown', 40);
  const opts = flag('shoreBottle') ? ['One got through.', 'Who writes them?'] : ['Who writes them?'];
  const c = opts[await choose(opts)];
  setFlag('bottlesDone');
  if (c === 'One got through.') {
    await say('Bottle girl', 'Dear inside. Somebody read one!! Somebody actually read one of them!!');
    await say('Bottle girl', 'Dear Mum. The good stone isn\'t under my bed anymore. I gave it to someone. Don\'t look.');
    await act('a2BottleGirl', 'bow');
    await reward({ notion: 'seapebble' });
    return;
  }
  await say('Bottle girl', 'Dear whoever writes them. It\'s nobody here. We checked. Your letters are very big.');
  await say('Bottle girl', 'Dear sea. Have them back. You keep bringing them. Bringing\'s for parties. Dear party, I can\'t come.');
});

defScript('a2Raker', async () => {
  if (low()) { await say('Weed-raker', 'Low water. I\'m in my barrow, rocking it. Don\'t watch me.'); return; }
  await say('Weed-raker', 'I rake the weed into nice lines. The sea puts it in lines anyway. Worse lines.');
  await say('Weed-raker', 'See the glints in the weed? Grains. You can see them at night. Leave them be.');
});

// The Shoreline bottle in Act 1 says nothing about who read it. Reading it now leaves a mark for the bottle girl.
const shoreBottle = MAPS.shoreline?.spots?.find(s => s.x === 23 && s.y === 14);
if (shoreBottle && typeof shoreBottle.script === 'function') {
  const read = shoreBottle.script;
  shoreBottle.script = async () => { setFlag('shoreBottle'); await read(); };
}

// ---------------------------------------------------------------- the Sifter's house (side mission)

const WHELK = 'wrack:sifterwhelk';
tideWatch.push(wentLow => {
  if (!wentLow || !flag('sifterAsked') || flag('sifterHome')) return;
  if (shellThere('wrack', 'sifterwhelk') && shellMon('wrack', 'sifterwhelk')) setFlag('whelkLows', flag('whelkLows') + 1);
  else setFlag('whelkLows', 0);
});

defScript('a2SifterHouse', async () => {
  if (low()) { field.shakeT = 4; sound('step'); await say('The Sifter', 'One house. Two lows a day. And a grand, unbroken total of zero grains lost!!'); return; }
  await say('The Sifter', 'One whelk, one fire, one sieve. A sack of sand, a pinch of tea, a thrimble of quiet.');
});

// ---------------------------------------------------------------- the Sand Dollar

// A sand dollar the size of a town on a bar at the west end of the Wrack. Five streets meet at the doves.
const SD_W = 40, SD_H = 38;
const sd = new Canvas(SD_W, SD_H, '~');
sd.rect(3, 6, 34, 29, '.').rect(36, 18, 4, 3, '.').rect(17, 34, 5, 4, '.');
const C0 = { x: 19, y: 20 }, RAD = 10;
for (let y = 0; y < SD_H; y++) for (let x = 0; x < SD_W; x++) {
  const d = Math.hypot(x - C0.x, y - C0.y);
  if (d <= RAD - 0.5) sd.put(x, y, '_');
  else if (d <= RAD + 0.5) sd.put(x, y, '#');
}
// streets to the petals, the east door, the seaward door, and the steps up to the Top
sd.rect(11, 20, 17, 1, '=').rect(19, 11, 1, 18, '=').put(29, 20, 'd').put(19, 30, 'd').rect(19, 31, 1, 3, '=');
sd.rect(13, 1, 13, 5, '#').rect(14, 2, 11, 3, ',').rect(19, 5, 1, 5, '=').put(18, 10, '#').put(19, 10, '=');
for (let y = 6; y <= 9; y++) sd.put(18, y, '#').put(20, y, '#');
// the doves in a ring in the middle with a step down between them, the fire in the north petal,
// two counters, houses in the petals, and the post shell
sd.rect(18, 17, 3, 3, 'p').put(19, 18, 'q').put(19, 19, '=');
sd.put(19, 13, 'x').put(18, 13, 'x').put(20, 13, 'x');
sd.rect(25, 18, 1, 2, 'c').rect(13, 25, 2, 1, 'c');
for (const [x, y] of [[12, 15], [24, 26], [14, 13], [25, 14]]) sd.rect(x, y, 2, 2, 'h');
sd.rect(21, 14, 2, 2, 'p');
sd.put(6, 30, 'C');
const SD_TIDE: string[] = [];
for (let y = 0; y < SD_H; y++) {
  let r = '';
  for (let x = 0; x < SD_W; x++) {
    const edge = sd.at(x, y) === '.' && (x <= 4 || x >= 35 || y >= 33 || y <= 7) && !(x >= 17 && x <= 21 && y >= 33) && !(x >= 34 && y >= 18 && y <= 20) && !(y <= 9 && x >= 17 && x <= 21);
    r += edge || (x === 19 && y === 30) ? 'A' : '.';
  }
  SD_TIDE.push(r);
}
const SD_FIRE = [[18, 13], [19, 13], [20, 13]];
defMap({
  id: 'sanddollar', name: 'The Sand Dollar', region: 26, music: 'sanddollar', strand: true,
  rows: sd.rows(),
  mods: [...tideRuns(SD_TIDE, 0, 0), { x: 6, y: 30, ch: 'b', when: () => !!flag('sifterTake') }],
  props: [{ x: 18, y: 17, pic: 'doves' }, { x: 21, y: 14, pic: 'postShell' }],
  warps: [
    { x: 39, y: 18, to: 'wrack', tx: 1, ty: 5, dir: 1 }, { x: 39, y: 19, to: 'wrack', tx: 1, ty: 5, dir: 1 }, { x: 39, y: 20, to: 'wrack', tx: 1, ty: 6, dir: 1 },
    { x: 19, y: 18, to: 'doves', tx: 4, ty: 7, dir: 2 },
    { x: 19, y: 37, to: 'flats', tx: 1, ty: 10, dir: 1 }, { x: 18, y: 37, to: 'flats', tx: 1, ty: 10, dir: 1 }, { x: 20, y: 37, to: 'flats', tx: 1, ty: 10, dir: 1 },
  ],
  enter: 'a2SandDollarEnter',
  // Pallasite comes only out of Starfall on the Top.
  zone: { kinds: kinds([['columba', 3], ['pallasite', 1]]), lv: [8, 12], n: 3, area: 'dollar', tideKinds: { high: kinds([['columba', 3]]), low: kinds([['columba', 3]]) } },
  npcs: [
    person('a2Strandmonger', 26, 19, 'fellmonger', 'Strandmonger', 3),
    person('a2Shellwright', 13, 26, 'tanner', 'Shellwright', 2),
    person('a2CinchFire', 18, 12, 'realcinch', 'Cinch', 0, { when: () => cinchAtFire() }),
    person('a2SifterFire', 20, 12, 'sifter', 'The Sifter', 0, { when: () => !!flag('sifterTake') && !flag('sifterHome') }),
    person('a2Eldest', 12, 17, 'eldest', 'Eldest', 1),
    person('a2WetDealer', 26, 24, 'beach2', 'Wet-dealer', 3),
    person('a2SdBasin', 15, 18, 'beach1', 'Woman with a basin', 1),
    person('a2SdOldMan', 23, 22, 'beach4', 'Old man', 3),
    person('a2SdBoy', 16, 23, 'beach3', 'Boy', 0, { wander: true }),
    person('a2SdWoman', 27, 21, 'beach1', 'Woman', 2),
    person('a2SdFireMan', 21, 13, 'beach2', 'Man by the fire', 3),
    person('a2SdGirl', 11, 22, 'beach3', 'Girl', 1, { wander: true }),
    // The Sifter and Cinch on the bar when the Sifter's house is taken.
    person('a2SifterBar', 7, 29, 'sifter', 'The Sifter', 3, { when: () => !!flag('sifterBar'), talk: undefined }),
    person('a2CinchBar', 6, 29, 'realcinch', 'Cinch', 0, { when: () => !!flag('sifterBar'), talk: undefined }),
    person('a2SifterTop', 21, 3, 'sifter', 'The Sifter', 0, { when: () => grains() >= 1 }),
    person('a2TackTop', 24, 2, 'tack', 'Tack', 3, { when: () => release() && grains() >= 1 }),
  ],
  spots: [
    { x: 18, y: 17, script: 'a2Doves' }, { x: 20, y: 17, script: 'a2Doves' }, { x: 18, y: 19, script: 'a2Doves' }, { x: 20, y: 19, script: 'a2Doves' },
    { x: 21, y: 15, script: 'a2PostShell' }, { x: 22, y: 15, script: 'a2PostShell' }, { x: 21, y: 14, script: 'a2PostShell' }, { x: 22, y: 14, script: 'a2PostShell' },
    look(9, 20, 'Children have scratched their heights into the wall of the test, with names.', 'The lowest mark is older than the rest, and very small.'),
    look(27, 18, 'A sack of cowries, tied at the neck. A shell tag on the string says STRANDMONGER.'),
    ...SD_FIRE.map(([x, y]) => look(x, y, 'A fire of driftwood on a ring of stones. It smells of salt.')),
    stash('sd_steps', 18, 10, 'Under the steps cut in the test, in a dry hollow, a whelk horn and some cowries.', { pegs: ['brass', 1], rind: 150 }),
    { x: 6, y: 30, script: 'a2SifterWhelkBar' },
  ],
});

const cinchAtFire = () => !!flag('owLowDone') && !flag('augerEntered') && !flag('cinchNautilus');

defScript('a2SandDollarEnter', async () => {
  strandHome('sanddollar', 19, 28);
  if (flag('smallGranOwed') && SPECIES.smallgranw) { setFlag('smallGranOwed', 0); await joinSmallGran(); }
  if (flag('sdSeen')) return;
  setFlag('sdSeen');
  // A flat round shell as big as a town on the sand bar, five streets meeting at five white shell doves in a ring.
  await pan(19, 18);
  await wait(50);
  await panBack();
  goal('The Strandmonger keeps a counter in the east petal.');
});

defScript('a2Doves', async () => {
  await emote('ouro', 'silence');
});

// Townsfolk say strange things flat. At low water they shuffle in place indoors.
tideTalk('a2SdBasin', 'Woman with a basin', ['Five doves in the middle of town. Don\'t go breaking the dollar to get at them. People have tried.'], ['Low water! Shaking my sieve. Sand\'s going in your shoes, sorry.']);
tideTalk('a2SdOldMan', 'Old man', ['We came off the old shell five grandmothers back. Walked the whole way. Feet still hurt.'], ['Low water. Chair, then kick. Kick, kick. Seventy years I\'ve done this.']);
tideTalk('a2SdBoy', 'Boy', ['My house is a whelk! I sweep it every low so it knows I\'m in. It knows.'], ['Low water. Sweep sweep sweep. Can\'t talk.']);
tideTalk('a2SdWoman', 'Woman', ['Your trader buys our cowries by the sack. We just sweep \'em off the wrack. Easiest money there is.'], ['Low water. The Gleaner\'s out on the flats. Hear that? That\'s it.']);
tideTalk('a2SdFireMan', 'Man by the fire', ['Stars come down every low. You get used to the noise. Kinda.'], ['Low water. I\'m turning the fish. Don\'t tell me if it\'s burning.']);
tideTalk('a2SdGirl', 'Girl', ['Don\'t sit still in an empty one at low water. Duh. Babies know that.'], ['Low water. I\'m hopping. Hopping\'s the best one.']);

// The Strandmonger prices everything.
async function joinSmallGran(): Promise<void> {
  setFlag('smallGranOut');
  if (!(await giveStrandMon('smallgranw', 10))) { setFlag('smallGranOwed'); return; }
  await hint('(She says her lines in order. In battle each line is a move, and she can only use the next one.)');
}

defScript('a2Strandmonger', async () => {
  if (!flag('smMet')) {
    setFlag('smMet');
    await say('Strandmonger', 'Well, there you are. Look at that face. Surprised. I\'d give two cowries for it, tops.');
    await say('Strandmonger', 'Twice a year I walk out here for cowries. Cheap off the wrack. Sand cheap.');
    await say('Strandmonger', 'Plus forty cowries a sack out here. Fifty a sack inside. Keep it from your gran, she\'ll want a cut.');
    await say('Strandmonger', 'Speaking of your gran. She sent a parcel. Paid six cowries postage up front. Never happens.');
    // The bundle on his back turns round, and Small Gran is sitting in it, facing the other way.
    face('a2Strandmonger', 1);
    await wait(30);
    await emote('ouro', 'surprise');
    await smallGranLine();
    await say('Strandmonger', 'Your gran said, "Tell my little turnip to take her." She said it to that one, mind. Not to me.');
    await say('Strandmonger', 'Which I carried the message for free. The carrying of her, I charged for. By the pound.');
    // Small Gran climbs down and joins Ouro's four.
    face('a2Strandmonger', 3);
    sound('switch');
    await joinSmallGran();
    await say('Strandmonger', 'I\'m here a while. Register pages are a cowrie each out here. Robbery. I\'m the robber.');
    if (!release()) {
      await say('Strandmonger', 'And a letter, from your friend at the post. One cowrie postage due. I paid. Now you\'re due.');
      await say('Letter', 'Day 1. Turned 1 time. Heavy. You owe 1 chair. Tack.');
      setFlag('letter1');
    }
    await say('Strandmonger', 'Grains, now. The Sifter keeps those. A grain\'s worth more than a pearl on this beach.');
    await say('Strandmonger', 'Not to me. I\'d give you two cowries for one. Two and a button.');
    goal('The Sifter is in the middle of the town, among the doves.');
    return;
  }
  if (flag('grayRoad') && !flag('grayRoadPaid')) { await grayRoadReward(); return; }
  if (await strandmongerDrill()) return;
  await say('Strandmonger', 'Strand kinds, a cowrie a page. Your gran\'s slate. It reaches this far, I checked.');
  await say('Strandmonger', 'Remember? The walk out here is free. The road costs shoes. Told you that for nothing.');
});

/** Chapter 2's side missions talk through the Strandmonger. Chapter 2 fills these in. */
export const strandmongerHooks: { drill: () => Promise<boolean> } = { drill: async () => false };
const strandmongerDrill = () => strandmongerHooks.drill();

async function grayRoadReward(): Promise<void> {
  setFlag('grayRoadPaid');
  await say('Strandmonger', 'You found my road! Toll\'s a cowrie each way. I set it just now.');
  await say('Strandmonger', 'Which I\'ll waive, once. Worth more to you than a cowrie and less to me. We both win. Me more.');
  await say('Strandmonger', 'Don\'t tell your gran. She\'d use it and never pay. She did that with a bridge once.');
  await reward({ tan: 2, notion: 'saltboots' });
}

// The post shell keeps Tack's letters from the Operculum (hold only).
defScript('a2PostShell', async () => {
  if (!release() && grains() >= 1 && !flag('letter2')) {
    setFlag('letter2');
    G.rind = Math.max(0, G.rind - 1);
    await say('Strandmonger', 'And another. Letter, one cowrie postage. Your friend writes tiny. Cheapskate. Respect.');
    await say('Letter', 'Day 9. 9 turns. Lug says close in here. Fid says post 19 spans round. Knew already. Tack.');
    return;
  }
  if (!release() && grains() >= 2 && !flag('letter3')) {
    setFlag('letter3');
    G.rind = Math.max(0, G.rind - 1);
    await say('Strandmonger', 'Letter. A cowrie. He\'s numbering the pages now. Costs me nothing and I hate that.');
    await say('Letter', 'Day 17. 17 turns. Hasp asked about hands 3 times. Purchase charged for 1 chair. Tack.');
    return;
  }
  await emote('ouro', 'silence');
});

defScript('a2Shellwright', async () => {
  if (!flag('sdWright')) {
    setFlag('sdWright');
    await say('Shellwright', 'Yeah? Shop\'s here in the petal. Midden\'s under the floor. Stays dry, mostly.');
    await say('Shellwright', 'Conjoiner\'s out back. Your Volute ones join with ours fine. It takes. Anything else?');
  }
  setFlag('fitter_sanddollar');
  await tannery('sanddollar', STOCK_6);
});

defScript('a2CinchFire', async () => {
  if (grains() >= 2) { await cinch('Hollows go somewhere. Sit up high enough and you\'d see. Nothing\'s higher than that long one.'); return; }
  if (grains() >= 1) { await cinch('Sat on the bar a while today. Hollows go down past that spotted one. Close past it.'); return; }
  await cinch('Pull up a stone. They let anyone sit here. Told them I\'m staying. They said fine.');
  await cinch('Good seat, this. You can see all five doors from it. Everybody goes in at low.');
});

// The Eldest says "yesterday" or "this morning" in every line. Chapter 3 gives her more to say.
export const eldestHooks: { later: () => Promise<boolean> } = { later: async () => false };
defScript('a2Eldest', async () => {
  if (await eldestHooks.later()) return;
  await say('Eldest', '(yesterday the tide comes in over my feet, same as this morning it will)');
  await say('Eldest', 'This morning I\'ll be a girl. Yesterday I\'m a girl with a sieve. Which one are you asking?');
});

defScript('a2WetDealer', async () => {
  await strandBoard({
    id: 'a2peg1', name: 'Wet-dealer', deck: ['skitter', 'fucus', 'kipper', 'actinia', 'mote'], tier: 4, prize: 'salttear',
    lines: ['I deal on the bar. Cards get wet. I deal \'em wet. You\'ll play \'em wet.'],
  });
});

defScript('a2SifterWhelkBar', async () => {
  await emote('ouro', flag('sifterTake') ? 'silence' : 'question');
});

// ---------------------------------------------------------------- Starfall on the Top

// Tack posts a best score on the Top in the release ending and raises it once a chapter.
const TACK_BEST = [41, 41, 47, 53, 58, 64, 70];
const tackBest = () => TACK_BEST[Math.min(TACK_BEST.length - 1, grains())];

// Every sentence of the Sifter's measures an amount of something.
defScript('a2SifterTop', async () => {
  if (!flag('topTold')) {
    setFlag('topTold');
    await say('The Sifter', 'Three cowries per star caught. One shell apiece. A cracked shell is a shell subtracted.');
    await say('The Sifter', 'Thirty stars in a night earns a notion. Sixty earns a thing of wholly unseen kind!!');
    await hint('(Starfall: hold a shell under the falling stars. Gold stars are worth 3. Dark ones crack the shell.)');
  }
  if (await choose(['Catch stars', 'Not now'], true) !== 0) return;
  const score = await starfall({ bestKey: 'starfallTop' });
  field.playMapMusic();
  await say('The Sifter', `${score} stars, duly tallied. ${score * 3} cowries, duly paid.`);
  if (score >= 30 && !flag('topNotion')) { setFlag('topNotion'); await say('The Sifter', 'Thirty and upward!! One notion, presented in full.'); await reward({ notion: 'warmstone' }); }
  if (score >= 60 && !flag('topPallasite')) {
    setFlag('topPallasite');
    sound('heal');
    await emote('ouro', 'surprise');
    if (!(await giveStrandMon('pallasite', 20))) setFlag('topPallasite', 0);
  }
  if (release() && score > tackBest() && flag('tackBeat') < grains() + 1) {
    setFlag('tackBeat', grains() + 1);
    await say('Tack', `${score}. Beats my ${tackBest()}. Okay. You're counted.`);
  }
});

// Tack says a number in every line.
defScript('a2TackTop', async () => {
  if (!flag('tackTopMet')) {
    setFlag('tackTopMet');
    face('a2TackTop', 2);
    await act('a2TackTop', 'nod');
    faceToward('a2TackTop', 'ouro');
    await say('Tack', '39. 40. 41. Hey. 41 stars tonight, and 0 of them hit me.');
    await say('Tack', 'Came through your hole. 1 hole. Thanks for that.');
    await say('Tack', 'Back there it\'s all soft. 0 things to hold. So, stars.');
    await say('Tack', 'My best is 41 in a shell. Beat it and you get counted.');
    return;
  }
  await say('Tack', `${tackBest()} in a shell, my best. You've got ${G.flags.starfallTop || 0}. Just saying.`);
});

// ---------------------------------------------------------------- the Doves: the sandpile

// The floor is five by five cells of sand, 0 to 3 measures each. A cell at 4 spills one measure to each
// neighbor and drops to 0, and sand off the edge is lost. Ouro stands only on 2 or 3.
// Checked with the scratchpad solver (sandpile.mjs): the fewest measures that reach the Sifter is 10. One way:
// two on each of the bottom three middle cells, three on the fourth, then from its left neighbor one on the cell
// above, which spills five times and raises the cell in front of the Sifter to 2. Pouring on that left neighbor
// from the fourth middle cell spills Ouro's own cell.
export const SAND_START = [
  [3, 3, 0, 0, 0],
  [2, 3, 0, 2, 1],
  [0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 1, 2],
];
const GX = 2, GY = 2, DOOR = { x: 4, y: 7 };
let sand = SAND_START.map(r => r.slice());
let sack = 12, refilled = false;
const cellAt = (x: number, y: number) => (x >= GX && x < GX + 5 && y >= GY && y < GY + 5 ? [y - GY, x - GX] : null);
function pourOn(r: number, c: number): number {
  sand[r][c]++;
  let spills = 0;
  for (let any = true; any;) {
    any = false;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (sand[i][j] >= 4) {
      sand[i][j] -= 4; spills++; any = true;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) if (a >= 0 && a < 5 && b >= 0 && b < 5) sand[a][b]++;
    }
  }
  return spills;
}

const dv = new Canvas(9, 10, '#');
dv.put(4, 1, '_').rect(GX, GY, 5, 5, '_').rect(1, 2, 1, 5, 'p').rect(7, 2, 1, 5, 'p').put(DOOR.x, DOOR.y, '_').put(4, 8, '_').put(4, 9, 'd');
const dovesMods: Mod[] = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) dovesMods.push({ x: GX + c, y: GY + r, ch: 'b', when: () => grains() < 1 && sand[r][c] < 2 });
defMap({
  id: 'doves', name: 'The Doves', region: 26, music: 'sanddollar', strand: true, indoor: true,
  rows: dv.rows(),
  mods: dovesMods,
  warps: [{ x: 4, y: 9, to: 'sanddollar', tx: 19, ty: 20, dir: 0 }],
  enter: 'a2DovesEnter',
  npcs: [person('a2Sifter', 4, 1, 'sifter', 'The Sifter', 0, { when: () => grains() < 1 })],
  spots: [
    ...Array.from({ length: 25 }, (_, i) => ({ x: GX + (i % 5), y: GY + Math.floor(i / 5), script: () => pourScript(Math.floor(i / 5), i % 5) })),
    look(1, 4, 'A white dove made of shell, as tall as Ouro. Sand has drifted against its feet.'),
    look(7, 4, 'A white dove made of shell. It faces in, like the others.'),
  ],
});

function drawSand(f: typeof field): void {
  if (f.map.id !== 'doves' || grains() >= 1) return;
  const [cx, cy] = f.cam;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const v = sand[r][c], x = (GX + c) * 8 - cx, y = (GY + r) * 8 - cy;
    rect(x + 1, y, 7, 7, INK);
    text(String(v), x + 2, y, v >= 2 ? '#fff6e6' : '#ff8c3a');
  }
  text(`Sack ${sack}`, 3, 3, '#fff6e6');
}

defScript('a2DovesEnter', async () => {
  sand = SAND_START.map(r => r.slice());
  sack = 12;
  refilled = false;
  field.overlay = drawSand;
  if (flag('dovesSeen') || grains() >= 1) return;
  setFlag('dovesSeen');
  await act('a2Sifter', 'shiver');
  await say('The Sifter', 'Two sacks of sand a day go through this. In each, a pinch of star, a fleck of shell, a glimmock.');
  await say('The Sifter', 'Three grains of star in that last handful, and one of you. Highly irregular.');
  await say('The Sifter', 'One fight, one grain. That is my tariff. Out here one grain is an immensity.');
  await say('The Sifter', 'The floor is twelve measures short of a path. Here is a sack holding precisely twelve.');
  await hint('(Pour sand to make a path. A cell with four measures spills one measure into each cell beside it.)');
  await hint('(You can stand only on cells with two or three measures.)');
});

async function sink(): Promise<void> {
  // Ouro sinks to the knees in soft sand and climbs back out at the door, and the Sifter makes a note.
  sfx('bump');
  await act('ouro', 'shiver');
  await walkTo('ouro', DOOR.x, DOOR.y);
  face('ouro', 2);
  await act('a2Sifter', 'nod');
}

async function pourScript(r: number, c: number): Promise<void> {
  if (grains() >= 1) { await emote('ouro', 'silence'); return; }
  if (sack <= 0) {
    if (!refilled) {
      if (await choose(['Refill it', 'Not yet'], true, 'The Sifter: Twelve more measures. This sackful costs nothing.') !== 0) return;
      refilled = true; sack = 12;
    } else {
      if (await choose(['Pay 12 cowries', 'Not yet'], true, 'The Sifter: A cowrie a measure. Twelve for the sack.') !== 0) return;
      if (G.rind < 12) { await say('The Sifter', 'Twelve cowries, and you are short of them. I extend not one grain of credit.'); return; }
      G.rind -= 12; sack = 12;
    }
    sfx('ok');
    return;
  }
  if (await choose(['Pour a measure', 'Leave it'], true, `${sand[r][c]} measures here. ${sack} in the sack.`) !== 0) return;
  sack--;
  const spills = pourOn(r, c);
  sfx(spills ? 'boom' : 'step');
  if (spills) field.shakeT = Math.min(20, 4 + spills * 2);
  const here = cellAt(field.x, field.y);
  if (here && sand[here[0]][here[1]] < 2) await sink();
}

field.stepHooks.push(f => {
  if (f.map.id !== 'doves' || grains() >= 1) return;
  const here = cellAt(f.x, f.y);
  if (here && sand[here[0]][here[1]] < 2) void f.runBusy(sink);
});

/** The Sifter's four. Ouro arrives with the Strand cap at 15. */
export const SIFTER_TEAM: [string, number][] = [['kipper', 11], ['mote', 12], ['halite', 12], ['columba', 13]];
defScript('a2Sifter', async () => {
  const here = cellAt(field.x, field.y);
  if (!here || here[0] !== 0) { await say('The Sifter', 'Twelve measures. One path. And of help from me: not a pinch, not a dram, not a smidgelet.'); return; }
  const used = 12 - sack + (refilled ? 12 : 0);
  await say('The Sifter', `${used === 10 ? 'Ten' : String(used)} measures used. ${sack} left in the sack. Not a single grain spilled!!`);
  await say('The Sifter', 'Four of mine, one at a time. One grain at the end of it. A fair and measurable contest.');
  await say('The Sifter', 'Two of my four are salt, and salt beats two kinds. Root, and beast. Measure that.');
  await say('The Sifter', 'Salt is beaten by two kinds, tide and void. That is all of salt, to the last pinch.');
  if (!(await keeperFight('The Sifter', SIFTER_TEAM, 'A handful of losses weighs nothing at all. Return with a fuller sack.'))) return;
  await say('The Sifter', 'Four down. One grain up. A most correct and agreeable exchange.');
  await giveGrain('The Sifter');
  await hint('(Star grains raise the cap on Strand levels. With one grain your whorls can reach Strand level 13.)');
  await say('The Sifter', 'One more sackful, and then home for supper. An ample, well-earned supper.');
  await sifterTake();
});

// The Take: the Sifter's house was empty and still through the low water. It is gone.
async function sifterTake(): Promise<void> {
  setFlag('sifterTake');
  field.overlay = null;
  if (!flag('shell:wrack:sifterwhelk')) setFlag('shell:wrack:sifterwhelk', 1);
  setFlag('tide', 0);
  sweepAll();
  // Ouro and the Sifter come out onto the bar at low water. Where the Sifter's whelk lay there is a hollow.
  setFlag('sifterBar');
  field.warp('sanddollar', 19, 31, 0);
  offstage('a2SifterBar', 'a2CinchBar');
  await wait(16);
  await Promise.all([walkIn('a2SifterBar', 19, 30, 8, 29), (async () => { await wait(20); await walkTo('ouro', 9, 29); })()]);
  face('a2SifterBar', 3);
  await wait(30);
  await emote('a2SifterBar', 'surprise');
  await say('The Sifter', 'One house. By my measure, none now.');
  await say('The Sifter', 'Thirty years in it. Two hours out of it, for one grain. A dreadful exchange.');
  await say('The Sifter', 'A sack of sieves in it. A pound of tea. A modest smatterling of spoons.');
  await walkTo('a2SifterBar', 7, 30);
  await act('a2SifterBar', 'shiver');
  // Cinch comes out of the north petal and sits on the bar beside the hollow.
  await walkIn('a2CinchBar', 19, 30, 6, 29);
  await act('a2CinchBar', 'bow');
  await cinch('Come and sit by me. There\'s room at the fire till you find another one.');
  await act('a2SifterBar', 'bow');
  await wait(40);
  // They go in to the fire together, and the sea comes back in over the bar.
  await Promise.all([walkOff('a2SifterBar', 19, 30), (async () => { await wait(20); await walkOff('a2CinchBar', 19, 30); })()]);
  setFlag('sifterBar', 0);
  await morphTo('tide', 6, 34, 0, 1);
  setFlag('tide', 0);
  scriptedHigh();
  goal('Walk back east along the Wrack to the foot of the Volute.');
}

defScript('a2SifterFire', async () => {
  if (flag('whelkLows') >= 2) {
    setFlag('sifterHome');
    const k = WHELK, m = G.shellMons[k];
    if (m) { delete G.shellMons[k]; if (G.party.length < 4) G.party.push(m); else G.rack.push(m); await notice(`${m.name} comes back from the whelk.`); }
    await say('The Sifter', 'Two lows!! One house, restored to a full and proper count of one!!');
    await say('The Sifter', 'Three grains of nacre, a sack of cowries, a glommet of thanks. Fair measure.');
    await reward({ tan: 3, rind: 600, notion: 'sieve' });
    return;
  }
  if (!flag('sifterAsked')) setFlag('sifterAsked');
  await say('The Sifter', 'One whelk, wide at the door, one span longer than myself. That is the requisite size.');
  await say('The Sifter', 'It must stay put two lows in a row. Two!! Anything less, I shan\'t trust it.');
  if (!flag('sifterTold')) { setFlag('sifterTold'); await hint('(A whelk washes up on the farthest weed ring of the Wrack at high tide.)'); }
});

// ---------------------------------------------------------------- the Flats: the star rings

// Wide wet sand, sea at high tide. At low water it is dark, and Ouro sees only inside the rings of landed stars.
// A star lands in the next footprint every four steps. A ring is five tiles across and shrinks one tile every two
// steps. Soft patches show only inside a ring, and stepping in one puts Ouro back at the last lit footprint.
// The safe ground joins the west edge, the drill-hole stone, the razor hole, the runnel, and the east edge
// (checked with scratchpad flats.mjs by a flood over safe tiles). The fewest steps across on safe ground are 49.
const FL_W = 46, FL_H = 20, FL_Y = 10;
export const FLAT_PRINTS: [number, number][] = Array.from({ length: 10 }, (_, k) => [4 + 4 * k, FL_Y]);
FOOTPRINTS.flats = FLAT_PRINTS;
const fl = new Canvas(FL_W, FL_H, '.').border('#');
fl.put(0, FL_Y, '=').put(FL_W - 1, FL_Y, '=');
fl.rect(26, 14, 6, 2, '~');
fl.put(17, 6, 'p').put(35, 6, 'O').put(9, 7, 'g');
for (const [x, y] of FLAT_PRINTS) fl.put(x, y, 'b');
for (const [x, y, w, h] of [[5, 15, 5, 2], [33, 15, 6, 2], [14, 2, 5, 2], [37, 2, 5, 2]]) fl.rect(x, y, w, h, ',');
// Safe ground: the line, a step round each soft tile on it, and a branch to each find.
const SAFE = new Set<string>();
const safe = (x: number, y: number) => SAFE.add(`${x},${y}`);
for (let x = 1; x < FL_W - 1; x++) safe(x, FL_Y);
for (const y of [9, 10, 11]) { safe(1, y); safe(2, y); safe(FL_W - 2, y); safe(FL_W - 3, y); }
for (const [x0, y0, x1, y1] of [[16, 10, 16, 7], [17, 7, 17, 7], [36, 10, 36, 7], [35, 7, 35, 7], [28, 10, 28, 13], [9, 10, 9, 8]]) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) safe(x, y);
}
// Three soft tiles sit on the line itself. Each has a way round, one row up or down.
for (const x of [14, 22, 31]) { SAFE.delete(`${x},${FL_Y}`); for (let k = -1; k <= 1; k++) safe(x + k, FL_Y + (x === 22 ? 1 : -1)); }
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
export const SOFT = new Set<string>();
for (let y = 2; y < FL_H - 2; y++) for (let x = 3; x < FL_W - 3; x++) {
  const k = `${x},${y}`;
  if (SAFE.has(k) || fl.at(x, y) !== '.' && fl.at(x, y) !== ',') continue;
  if (Math.abs(y - FL_Y) <= 1 ? hash(x, y) % 3 !== 0 : hash(x, y) % 5 < 2) SOFT.add(k);
}
for (const x of [14, 22, 31]) SOFT.add(`${x},${FL_Y}`);
const FL_TIDE = Array.from({ length: FL_H }, (_, y) => [...Array(FL_W)].map((_, x) => (x >= 3 && x <= FL_W - 4 && y >= 1 && y <= FL_H - 2 && fl.at(x, y) !== '~' && fl.at(x, y) !== '#' ? 'A' : '.')).join(''));
const inRing = (x: number, y: number) => strandFx.rings.some(r => (x - r.x) ** 2 + (y - r.y) ** 2 <= r.r * r.r);
const flMods: Mod[] = [
  ...tideRuns(FL_TIDE, 0, 0),
  ...[...SOFT].map(k => { const [x, y] = k.split(',').map(Number); return { x, y, ch: 'x', when: () => low() && inRing(x, y) }; }),
];
defMap({
  id: 'flats', name: 'The Flats', region: 25, music: 'strand', strand: true, fogRings: true,
  rows: fl.rows(),
  mods: flMods,
  warps: [
    { x: 0, y: FL_Y, to: 'sanddollar', tx: 19, ty: 36, dir: 0 },
    { x: FL_W - 1, y: FL_Y, to: 'cowrieback', tx: 1, ty: 16, dir: 1 },
  ],
  enter: 'a2FlatsEnter',
  zone: {
    kinds: kinds([['lobworm', 3], ['razor', 2], ['annulet', 2], ['skitter', 2], ['actinia', 2], ['seaglass', 2], ['flotsam', 2]]), lv: [7, 12], n: 8, area: 'strand',
    tideKinds: { low: kinds([['lobworm', 3], ['razor', 2], ['annulet', 2], ['skitter', 2]]), high: kinds([['actinia', 2], ['seaglass', 2], ['flotsam', 2]]) },
  },
  npcs: [],
  spots: [
    { x: 17, y: 6, script: 'a2DrillStone' },
    stash('fl_runnel', 28, 14, 'In the runnel, under an inch of cold water, a nautilus horn.', { pegs: ['iron', 1] }),
    stash('fl_razor', 35, 6, 'A razor hole, straight down. At the bottom, a notion.', { notion: 'coldiron' }),
    stash('fl_curl', 9, 7, 'A worm curl of sand, still curling. Inside it, some nacre.', { tan: 2 }),
  ],
});

let flStar = 0, flSteps = 0, lastLit = { x: 1, y: FL_Y };
function landStar(): void {
  const [x, y] = FLAT_PRINTS[flStar % FLAT_PRINTS.length];
  flStar++;
  strandFx.rings.push({ x, y, r: 2 });
  strandFx.landings.push({ x, y, t: 0 });
  field.shakeT = 6;
  sfx('step');
}
function flatsReset(): void {
  strandFx.rings.length = 0;
  flStar = 0; flSteps = 0;
  MAPS.flats.fogRings = low();
  if (low()) landStar();
}
defScript('a2FlatsEnter', async () => {
  lastLit = { x: field.x, y: field.y };
  flatsReset();
  if (!flag('flatsSeen') && low()) {
    setFlag('flatsSeen');
    await hint('(At low water you see only inside the rings of landed stars. Soft sand shows only in a ring.)');
  }
});
tideWatch.push(() => { if (field.map.id === 'flats') flatsReset(); });
field.stepHooks.push(f => {
  if (f.map.id !== 'flats') return;
  if (!low()) { MAPS.flats.fogRings = false; return; }
  MAPS.flats.fogRings = true;
  flSteps++;
  if (flSteps % 2 === 0) { for (const r of strandFx.rings) r.r--; strandFx.rings = strandFx.rings.filter(r => r.r >= 0); }
  if (flSteps % 4 === 0) landStar();
  if (FLAT_PRINTS.some(([x, y]) => x === f.x && y === f.y) && inRing(f.x, f.y)) lastLit = { x: f.x, y: f.y };
  if (SOFT.has(`${f.x},${f.y}`)) void f.runBusy(async () => {
    // Ouro sinks to the waist in soft sand and climbs back to the last lit footprint.
    sfx('bump');
    await act('ouro', 'shiver');
    await walkTo('ouro', lastLit.x, lastLit.y);
  });
});

defScript('a2DrillStone', async () => {
  await emote('ouro', 'silence');
  if (!flag('drillAsked')) return;
  if (!flag('drill1')) { setFlag('drill1'); sfx('spot'); }
  // The hole is drilled on the side that faces the Wrack, and slants that way. Ouro turns to look along it.
  face('ouro', 1);
  await emote('ouro', 'question');
});

