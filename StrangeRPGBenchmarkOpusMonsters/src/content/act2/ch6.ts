// Act 2, chapter 6: the Conch, the gift, the epilogue, the Act 2 credits, and After Act 2. See Notes/act2-script.md.
// Maps: the Conch's lip, the Pink, the Turn, the Roar, and the mouth. The end of the file adds Act 2's later lines
// to people on maps from chapters 1 to 3 by wrapping their talk scripts.
import { sfx } from '../../engine/audio';
import { bigText, bigWidth, textCenter } from '../../engine/font';
import { input } from '../../engine/input';
import { music } from '../../engine/music';
import { clear } from '../../engine/screen';
import { drawSprite, PEOPLE } from '../../engine/sprites';
import type { Mon, SpriteData } from '../../battle/model';
import { makeMon, SPECIES, WILD_KINDS } from '../../data/species';
import { act, bell, choose, emote, evening, face, faceToward, fadeWho, field, fightWild, giveMon, goal, hint, liftOff, mon, morphTo, narr, notice, npcAt, offstage, pan, panBack, prop, say, shake, sound, tint, unprop, wait, walkIn, walkTo, walkUp, warp } from '../../game/api';
import { battle } from '../../game/battleView';
import { listMenu, monLine } from '../../game/menus';
import { close, run, type Mode } from '../../game/modes';
import { G, flag, loosened, save, setFlag } from '../../game/state';
import { isSolid } from '../../game/tiles';
import { strandFx } from '../../game/strandfx';
import { DIM, PAPER, SEL } from '../../game/ui';
import { defMap, defScript, MAPS, SCRIPTS, type MapDef, type NpcDef } from '../../game/world';
import { Canvas, highTide, kinds, look, reward, stash, tideMods } from '../areakit';
import { SMALL_GRAN, smallGranLine } from '../ch1';
import { shellTune } from './ch5';
import { playShellboard } from '../minigames';
import { tideHooks } from './kit';
import {
  afterLow, cinch, cornerText, DX, DY, drawHook, frameHook, granNext, granSpeaks, grainLine, hold, kindSprite, lowWater, release, setTide,
  SMALL_GRAN_KIND, smallGranOut, startFrameHook, strandRematch, type Mod,
} from './ch4';

/** Moves Ouro for a cutscene without running the new map's enter script. */
async function sceneWarp(map: string, x: number, y: number, dir: number): Promise<void> {
  field.fade = 12;
  field.load(map, x, y, dir);
  save();
  await wait(10);
}

const awake = () => !!flag('gleanerAwake');
const sat = () => !!flag('gleanerSat');
const giftName = () => ((G as any).a2gift?.name as string) || 'the whorl';

// ---------------------------------------------------------------- the Conch's lip

const cl = new Canvas(30, 18, '.').border('#');
cl.put(0, 9, '.').put(0, 10, '.');
cl.rect(1, 15, 28, 2, '~');
cl.rect(14, 1, 15, 7, '#').rect(11, 8, 10, 4, '_');
for (const [x, y] of [[16, 2], [20, 1], [24, 3], [27, 5], [18, 5], [22, 6]]) cl.put(x, y, 'T');
cl.put(16, 7, 'q').put(19, 11, 'P');
cl.rect(2, 2, 6, 3, ',').rect(3, 12, 6, 2, ',').rect(9, 5, 3, 2, ',');
for (const [x, y] of [[3, 7], [9, 2], [6, 14], [12, 14], [10, 6]]) cl.put(x, y, 'p');
const CL_LABELS: [number, number, string][] = [[3, 7, 'KEEP THE SHELL'], [9, 2, 'KEEP THE SPIRE'], [6, 14, 'KEEP THE MOUTH'], [12, 14, 'KEEP THE LIP'], [10, 6, 'KEEP THE ROAR']];
// The mouth is sand at low tide and sea at high. The beach floods to the lip's foot at high tide.
const clTide = cl.rows().map((r, y) => [...r].map((c, x) => ((x >= 21 && x <= 28 && y >= 8 && y <= 14) || (y >= 12 && y <= 14 && x >= 1 && x <= 28)) && '.,'.includes(c) ? 'A' : ' ').join(''));
const MOUTH_CELLS: [number, number][] = [];
for (let y = 7; y <= 12; y++) for (let x = 21; x <= 28; x++) MOUTH_CELLS.push([x, y]);

defMap({
  id: 'conchlip', name: 'The Conch\'s lip', region: 31, music: 'conch', strand: true,
  rows: cl.rows(),
  mods: [
    // Once it sits, the great child fills the mouth at every tide.
    ...MOUTH_CELLS.map(([x, y]) => ({ x, y, ch: '#', when: sat })),
    ...tideMods(clTide, 0, 0),
  ],
  props: [
    { x: 21, y: 8, pic: 'gleanerBack', when: () => highTide() && !sat() && !awake() },
    { x: 21, y: 6, pic: 'gleanerChild', when: () => sat() && !flag('gleanerCaught') },
    ...CL_LABELS.map(([x, y]) => ({ x, y: y - 1, pic: 'labelPost' })),
  ],
  warps: [
    { x: 0, y: 9, to: 'tray', tx: 44, ty: 16, dir: 3 }, { x: 0, y: 10, to: 'tray', tx: 44, ty: 17, dir: 3 },
    { x: 16, y: 7, to: 'conchpink', tx: 1, ty: 4, dir: 1 },
  ],
  enter: 'lipEnter',
  zone: {
    kinds: kinds([['flood', 3], ['surf', 3], ['strombus', 3], ['sanderling', 3], ['fleur', 3], ['madrepore', 3]]), lv: [54, 66], n: 10, area: 'conch',
    tideKinds: {
      high: kinds([['flood', 3], ['surf', 3], ['strombus', 2]]),
      low: kinds([['sanderling', 3], ['fleur', 3], ['madrepore', 2], ['strombus', 2]]),
    },
  },
  npcs: [
    { id: 'lipcinch', x: 18, y: 9, sprite: 'realcinch', name: 'Cinch', dir: 1, talk: 'lipCinch', when: () => !!flag('cinchToLip') && !sat() },
    { id: 'conchdiver', x: 8, y: 9, sprite: 'beach2', name: 'Conch-diver', dir: 1,
      trainer: { name: 'Conch-diver', team: [['strombus', 58], ['fleur', 58]], intro: 'I dive in the mouth at low, while it\'s out walking. Pearls in there! Big pink ones.', defeat: 'Ugh. No pink ones today.', sight: 3 } },
  ],
  spots: [
    look(14, 9, 'Letters pressed into the pink of the lip itself.', 'KEEP THE PINK.'),
    look(14, 5, 'Knobs on every turn of the spire, worn smooth on top.', 'Something has held this shell, often, by the knobs.'),
    { x: 19, y: 11, when: lowWater, script: async () => { await emote('ouro', 'heart'); } },
    stash('cl_lip', 11, 12, 'Under the lip\'s edge, where the pink curls back, a nautilus horn.', { pegs: ['iron', 1] }),
    ...CL_LABELS.map(([x, y, t]) => look(x, y, 'A label stuck in the sand by the great pink shell.', `${t}.`)),
    ...MOUTH_CELLS.filter(([, y]) => y >= 11).map(([x, y]) => ({ x, y, when: sat, script: gleanerHolds })),
  ],
});

async function gleanerHolds(): Promise<void> {
  void giftName;
  await emote('ouro', 'silence');
  if (!flag('a2done') || flag('gleanerCaught')) return;
  if (await choose(['Call to it', 'Leave it'], true) !== 0) return;
  // After the credits the great child still sits listening. Called, it sets the whorl down and gets up.
  await act('ouro', 'bow');
  bell(0);
  await wait(40);
  sound('boom');
  await shake(20);
  const r = await fightWild(mon('gleaner', 70), { canRun: true, bossHp: 2.4, ai: 'champion', area: 'conch', music: 'collector' });
  if (r.pegged.length) {
    setFlag('gleanerCaught');
    await giveMon(r.pegged[0]);
    sound('boom');
    await shake(30);
  }
}

defScript('lipEnter', async () => {
  setFlag('trayCinchLeft');
  if (!flag('lipSeen')) {
    setFlag('lipSeen');
    setFlag('a2c6');
    // The beach ends at a great pink shell: its lip spread flat on the sand, a knobbed spire behind, and a mouth as big
    // as a hill's side. At high tide something very large lies curled in the mouth, its back going up and down.
    await pan(20, 7);
    await wait(60);
    await panBack();
    await say('Label', 'KEEP THE PINK.');
    // Cinch climbs onto the lip and sits near its edge, facing the mouth.
    setFlag('cinchToLip');
    offstage('lipcinch');
    await walkIn('lipcinch', 0, 9, 18, 9);
    face('lipcinch', 1);
    await act('lipcinch', 'bow');
    await cinch('Sit. This is as far as I go. Good lip, this. Made for sitting.');
    await cinch('From here you can hear it breathe. Or the sea. One of the two.');
    goal('Go in at the lip, round the inside of the spiral.');
    save();
  }
});

defScript('lipCinch', async () => {
  if (flag('ringRead') && !flag('cinchWade')) { setFlag('cinchWade'); await cinch('Wade. Been saying it over. Small sort of name.'); return; }
  await cinch('Lip\'s still good. Haven\'t moved off it once. Plenty of room.');
  await cinch('Breathing, or the sea. Haven\'t decided. Sit and help me.');
});

// ---------------------------------------------------------------- the Pink: don't scratch

// A corridor whose walls stand in and out. Brushing a wall at high tide (stepping through a gap one tile wide)
// rings it, and three rings bring the sea up the spiral to wash Ouro back to the lip. The count resets only then.
// 'A' cells stand in at high tide, 'B' cells pinch shut at low, and the door to the Turn opens only at high tide.
// Solved with scratchpad pink.mjs: all at high tide fails (four gaps in the first half), all at low fails (the
// second half pinches shut). Shortest: walk the first half at low, ring high past the wide place, then the second
// half at high (32 moves with the bell). The first half at high costs a ring at every gap.
const PK_W = 34, PK_H = 9;
const pk = new Canvas(PK_W, PK_H, '#');
pk.rect(1, 3, 30, 3, '.').rect(14, 1, 3, 7, ',').put(0, 4, '.');
for (const [x, y] of [[8, 3], [10, 5], [27, 3], [24, 5]]) pk.put(x, y, ',');
const PK_A: [number, number][] = [], PK_B: [number, number][] = [];
for (const x of [3, 6, 9, 12]) for (const y of [3, 5]) { PK_A.push([x, y]); pk.put(x, y, '#'); }
for (const x of [19, 25]) for (let y = 3; y <= 5; y++) { PK_B.push([x, y]); pk.put(x, y, '#'); }
for (const x of [22, 28]) { pk.put(x, 3, '#'); pk.put(x, 5, '#'); }
pk.put(31, 4, 'j');
const PK_DOOR = { x: 31, y: 4 };
const rings = () => flag('pinkRings');

defMap({
  id: 'conchpink', name: 'The Pink', region: 31, music: 'conch', strand: true, indoor: true,
  rows: pk.rows(),
  mods: [
    ...PK_A.map(([x, y]) => ({ x, y, ch: '.', when: lowWater })),
    ...PK_B.map(([x, y]) => ({ x, y, ch: '.', when: highTide })),
    { x: PK_DOOR.x, y: PK_DOOR.y, ch: '_', when: highTide },
  ],
  warps: [
    { x: 0, y: 4, to: 'conchlip', tx: 16, ty: 8, dir: 0 },
    { x: PK_DOOR.x, y: PK_DOOR.y, to: 'conchturn', tx: 4, ty: 17, dir: 2, when: highTide },
  ],
  enter: 'pinkEnter',
  zone: { kinds: kinds([['blush', 3], ['cochlea', 3], ['samphire', 3], ['gimbal', 2]]), lv: [54, 66], n: 6, area: 'conch' },
  npcs: [],
  spots: [look(PK_DOOR.x, PK_DOOR.y, 'A round door in the pink. It is shut. Beyond it the spiral goes on up.')],
});

const solidAt = (x: number, y: number) => isSolid(field.tile(x, y));
field.stepHooks.push(f => {
  if (f.map.id !== 'conchpink' || !highTide() || f.lastStep < 0) return;
  const d = f.lastStep;
  if (solidAt(f.x + DY[d], f.y + DX[d]) && solidAt(f.x - DY[d], f.y - DX[d])) void f.runBusy(brush);
});
tideHooks.push(async high => {
  if (field.map?.id !== 'conchpink' || !solidAt(field.x, field.y)) return;
  // The wall closes on Ouro, and Ouro squeezes out to the nearest open tile.
  const out = [0, 1, 2, 3].find(d => !solidAt(field.x + DX[d], field.y + DY[d]));
  if (out !== undefined) { await act('ouro', 'shiver'); field.stepWho('ouro', out); await wait(9); }
  if (high) await brush();
});

async function brush(): Promise<void> {
  setFlag('pinkRings', rings() + 1);
  sfx('nerve');
  field.flashT = 6;
  if (!flag('pinkTold')) {
    setFlag('pinkTold');
    bell(19);
    await emote('ouro', 'surprise');
    if (smallGranOut() && granNext() === 1) await smallGranLine();
    await hint('(Brushing a wall makes it ring. At high tide, three rings and the sea washes you back.)');
    await hint('(At low tide nothing listens, and the walls stand wider. The way on opens only at high tide.)');
  }
  if (rings() < 3) return;
  // The third ring wakes the sea far below. It comes up the Conch in a surge and carries Ouro round and out onto the lip.
  bell(19); bell(24);
  await shake(30);
  sound('hitBig');
  await tint('#3060a0', 0.8, 20);
  await act('ouro', 'shiver');
  setFlag('pinkRings', 0);
  await warp('conchlip', 16, 8, 0);
}

drawHook('conchpink', () => { if (rings() > 0) cornerText(`rings ${rings()} of 3`); });

defScript('pinkEnter', async () => {
  startFrameHook('conchpink');
  setFlag('pinkRings', 0);
  if (!flag('pinkSeen')) {
    setFlag('pinkSeen');
    await tint('#f4a0b8', 0.25, 30);
    await tint('#f4a0b8', 0, 60);
  }
});

// ---------------------------------------------------------------- the Turn: don't look

// A door is shut while Ouro can see it: ahead in a cone as wide as it is deep, or reflected in the polished wall
// Ouro faces. It rolls open once it has been unseen for a moment. Holding the face button walks Ouro backward,
// so Ouro looks the other way. Solved with scratchpad turn.mjs (25 moves): room 1 needs walking backward (its far
// wall is dull), room 2 needs standing side-on facing its one dull wall, room 3 walking backward again, and room 4
// (polished on three sides) needs the one tile beside the exit, facing the dull wall. Forward only, there is no way.
type TRoom = { id: number; x: number; y: number; w: number; h: number; N: string; E: string; S: string; W: string };
const T_ROOMS: TRoom[] = [
  { id: 1, x: 2, y: 13, w: 5, h: 5, N: 'X', E: 'X', S: '#', W: 'X' },
  { id: 2, x: 2, y: 7, w: 5, h: 5, N: 'X', E: 'X', S: 'X', W: '#' },
  { id: 3, x: 2, y: 1, w: 5, h: 5, N: 'X', E: 'X', S: 'X', W: '#' },
  { id: 4, x: 8, y: 1, w: 5, h: 5, N: 'X', E: 'X', S: '#', W: 'X' },
];
type TDoor = { id: number; x: number; y: number; rooms: number[] };
const T_DOORS: TDoor[] = [
  { id: 1, x: 4, y: 12, rooms: [1, 2] }, { id: 2, x: 4, y: 6, rooms: [2, 3] }, { id: 3, x: 7, y: 3, rooms: [3, 4] }, { id: 4, x: 13, y: 3, rooms: [4] },
];
const tRoomAt = (x: number, y: number) => T_ROOMS.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
function tSees(ox: number, oy: number, lookDir: number, d: TDoor): boolean {
  const r = tRoomAt(ox, oy);
  if (!r || !d.rooms.includes(r.id)) return false;
  const fl = [[d.y - oy, d.x - ox], [d.x - ox, d.y - oy], [oy - d.y, d.x - ox], [ox - d.x, d.y - oy]][lookDir];
  const [f, l] = fl;
  if (f >= 1 && Math.abs(l) <= f) return true;
  const wall = (['S', 'E', 'N', 'W'] as const)[lookDir];
  if (r[wall] !== 'X') return false;
  const a = [r.y + r.h - oy, r.x + r.w - ox, oy - (r.y - 1), ox - (r.x - 1)][lookDir];
  if (f >= a) return false;
  const fi = 2 * a - f;
  return fi >= 1 && Math.abs(l) <= fi;
}
const tn = new Canvas(14, 19, '#');
for (const r of T_ROOMS) {
  tn.rect(r.x, r.y, r.w, r.h, '_');
  tn.rect(r.x, r.y - 1, r.w, 1, r.N).rect(r.x + r.w, r.y, 1, r.h, r.E).rect(r.x, r.y + r.h, r.w, 1, r.S).rect(r.x - 1, r.y, 1, r.h, r.W);
}
for (const d of T_DOORS) tn.put(d.x, d.y, 'j');
tn.put(4, 18, 'q');
for (const [x, y] of [[2, 9], [6, 10], [2, 2], [3, 2], [11, 5]]) tn.put(x, y, ',');
const OPEN_DELAY = 20;
const tOpen: Record<number, boolean> = {};
const tTimer: Record<number, number> = {};

frameHook('conchturn', () => {
  const lookDir = input.held('ok') ? (field.dir + 2) % 4 : field.dir;
  for (const d of T_DOORS) {
    if (field.x === d.x && field.y === d.y) continue;
    if (tSees(field.x, field.y, lookDir, d)) {
      if (tOpen[d.id]) sfx('back');
      tOpen[d.id] = false; tTimer[d.id] = 0;
      continue;
    }
    tTimer[d.id] = (tTimer[d.id] || 0) + 1;
    if (!tOpen[d.id] && tTimer[d.id] >= OPEN_DELAY) { tOpen[d.id] = true; sfx('blip'); }
  }
});

defMap({
  id: 'conchturn', name: 'The Turn', region: 31, music: 'conch', strand: true, indoor: true,
  rows: tn.rows(),
  mods: T_DOORS.map(d => ({ x: d.x, y: d.y, ch: '_', when: () => !!tOpen[d.id] })),
  warps: [
    { x: 4, y: 18, to: 'conchpink', tx: 30, ty: 4, dir: 3 },
    { x: 13, y: 3, to: 'conchroar', tx: 10, ty: 20, dir: 2, when: () => !!tOpen[4] },
  ],
  enter: 'turnEnter',
  zone: { kinds: kinds([['lull', 3], ['flange', 3], ['pleiad', 3]]), lv: [54, 66], n: 4, area: 'conch' },
  npcs: [],
  spots: [],
});

defScript('turnEnter', async () => {
  startFrameHook('conchturn');
  for (const d of T_DOORS) { tOpen[d.id] = false; tTimer[d.id] = 0; }
  if (flag('turnSeen')) return;
  setFlag('turnSeen');
  if (smallGranOut() && granNext() === 3) await smallGranLine();
  await hint('(A door here is shut while you can see it, ahead or in a polished wall.)');
  await hint('(Hold the face button to walk backward.)');
});

// ---------------------------------------------------------------- the Roar: the lines

// Four doors up the spiral. An opening beside each door, one at the bottom, and one out sideways to the sea.
// At high tide a line Small Gran says at an opening comes out of the next opening up, beside the next door.
// Door 1 opens for line 1, door 2 for line 2, door 3 for line 3, door 4 for line 4. The fifth line, said beside
// door 4, comes out in the mouth. The sea opening spends a line without it reaching a door.
const RO_W = 20, RO_H = 22;
const ro = new Canvas(RO_W, RO_H, '#');
for (const y0 of [2, 7, 12, 17]) ro.rect(1, y0, 18, 4, '_');
const R_DOORS = [{ x: 16, y: 16 }, { x: 3, y: 11 }, { x: 16, y: 6 }, { x: 3, y: 1 }];
// Openings 0 to 4: the bottom, then beside doors 1 to 4. Opening 0 is in the floor by the way in.
const R_OPEN: [number, number, number, number][] = [[8, 21, 8, 20], [15, 16, 15, 17], [4, 11, 4, 12], [15, 6, 15, 7], [4, 1, 4, 2]];
const R_SEA = { x: 19, y: 18 };
for (const d of R_DOORS) ro.put(d.x, d.y, 'j');
for (const [x, y] of R_OPEN) ro.put(x, y, 'O');
ro.put(R_SEA.x, R_SEA.y, 'O').put(10, 21, 'q');
ro.rect(1, 14, 2, 2, '~');
for (const [x, y, w] of [[6, 18, 4], [11, 13, 4], [6, 8, 4], [11, 3, 3]]) ro.rect(x, y, w, 1, ',');
const roarOpen = (k: number) => !!flag('roarDoor' + k);
const DOOR_MARKS = ['a curl shaped like a question mark', 'a scratched hand', 'a crack', 'a shut eye'];

async function opening(k: number): Promise<void> {
  if (!smallGranOut()) { sound('wind'); await hint('(Small Gran\'s lines open the way here. She is not in your team.)'); return; }
  const line = granNext();
  await smallGranLine();
  if (lowWater()) { await wait(30); await emote('ouro', 'silence'); return; }
  if (k === 4) {
    if (line !== 4 || flag('gleanerWoken') || sat()) return;
    await warp('conchmouth', 10, 12, 2);
    await lastLine();
    return;
  }
  // The Conch is quiet. Then, out of the next opening up, very loud, her line comes again and goes out over the beach.
  await wait(40);
  const up = R_OPEN[k + 1];
  await pan(up[0], up[1]);
  field.shakeT = 30;
  await say('Small Gran', SMALL_GRAN[line].toUpperCase());
  setFlag('roarHeard');
  if (line === k && !roarOpen(k + 1)) {
    sfx('switch');
    await shake(12);
    await morphTo('roarDoor' + (k + 1), R_DOORS[k].x, R_DOORS[k].y);
  } else if (!roarOpen(k + 1)) { sound('bump'); await emote('ouro', 'sweat'); }
  await panBack();
}

defMap({
  id: 'conchroar', name: 'The Roar', region: 31, music: 'conch', strand: true, indoor: true,
  rows: ro.rows(),
  mods: R_DOORS.map((d, i) => ({ x: d.x, y: d.y, ch: '_', when: () => roarOpen(i + 1) })),
  warps: [
    { x: 10, y: 21, to: 'conchturn', tx: 12, ty: 3, dir: 2 },
    { x: 3, y: 1, to: 'conchmouth', tx: 10, ty: 12, dir: 2, when: () => roarOpen(4) },
  ],
  enter: 'roarEnter',
  // The Halophile grows in the pink pool and is listed only for the Register's check.
  zone: {
    kinds: kinds([['aphelion', 3], ['surf', 3], ['halophile', 1]]), lv: [54, 66], n: 6, area: 'conch',
    tideKinds: { high: kinds([['aphelion', 3], ['surf', 3]]), low: kinds([['aphelion', 3], ['surf', 3]]) },
  },
  npcs: [
    { id: 'halophile', x: 3, y: 15, sprite: 'stone', name: 'Rusumo', dir: 3, img: kindSprite('halophile'), talk: 'halophile', when: () => !flag('halophileDone') },
  ],
  spots: [
    ...R_OPEN.map(([x, y], k) => ({ x, y, script: () => opening(k) })),
    { x: R_SEA.x, y: R_SEA.y, script: async () => {
      if (!smallGranOut()) { sound('wind'); await emote('ouro', 'silence'); return; }
      await smallGranLine();
      sound('wind');
      await emote('ouro', 'silence');
    } },
    ...R_DOORS.map((d, i) => ({ x: d.x, y: d.y, when: () => !roarOpen(i + 1), script: async () => { await say('Carving', `A round shut door, carved with ${DOOR_MARKS[i]}.`); } })),
    look(2, 14, 'A pink pool off the second opening. The water in it is the color of the lip.'),
  ],
});

defScript('roarEnter', async () => {
  if (flag('roarSeen')) return;
  setFlag('roarSeen');
  // The deep turns of the Conch, with the sea's sound coming up loud and going round, and an opening beside each door.
  sound('wind');
  await pan(10, 4);
  await wait(30);
  await panBack();
  await hint('(Talk to Small Gran at an opening, and her next line comes out of the next opening up, louder.)');
  await hint('(Each door waits for one of her lines.)');
});

defScript('halophile', async () => {
  await emote('ouro', 'heart');
  const r = await fightWild(mon('halophile', 60), { canRun: true, area: 'conch' });
  if (r.pegged.length) { setFlag('halophileDone'); await giveMon(r.pegged[0]); }
  else if (r.result === 'win') { await fadeWho('halophile', false, 40); setFlag('halophileDone'); }
});

// ---------------------------------------------------------------- the mouth: the Gleaner

const mo = new Canvas(20, 14, '#');
mo.rect(1, 1, 18, 12, '_').rect(6, 0, 8, 6, '#').put(10, 13, 'q').put(14, 4, 'O');
for (const [x, y] of [[1, 11], [2, 12], [18, 11], [17, 12], [1, 1], [18, 1]]) mo.put(x, y, '~');
let mouthScene: Record<string, boolean> = {};
const ms = (k: string) => () => !!mouthScene[k];

defMap({
  id: 'conchmouth', name: 'The mouth', region: 31, music: 'conch', strand: true, indoor: true,
  rows: mo.rows(),
  props: [
    { x: 6, y: 1, pic: 'gleanerBack', when: () => highTide() && !awake() && !sat() },
    { x: 6, y: 0, pic: 'gleanerChild', when: () => (awake() || sat()) && !flag('gleanerCaught') },
    { x: 9, y: 2, pic: 'gleanerFinger', when: ms('finger') },
    { x: 10, y: 7, pic: 'labelPost', when: () => (awake() || sat()) && !!flag('keepFour') },
    { x: 15, y: 6, pic: 'labelPost', when: sat },
    { x: 13, y: 10, pic: 'labelPost', when: ms('granLabel') },
  ],
  warps: [{ x: 10, y: 13, to: 'conchroar', tx: 3, ty: 2, dir: 0 }],
  enter: 'mouthEnter',
  npcs: [
    { id: 'mouthgran', x: 12, y: 10, sprite: 'smallgran', name: 'Small Gran', dir: 2, when: ms('gran') },
    { id: 'mouthcinch', x: 4, y: 10, sprite: 'realcinch', name: 'Cinch', dir: 1, when: ms('cinch') },
  ],
  spots: [
    ...[8, 9, 10, 11].map(x => ({ x, y: 5, script: aperture })),
    { x: 14, y: 4, script: async () => { sound('wind'); await emote('ouro', 'question'); } },
    look(10, 7, 'KEEP THE FOUR.'),
  ],
});

defScript('mouthEnter', async () => {
  if (sat()) return;
  if (!highTide()) { await emote('ouro', 'question'); return; }
  if (flag('mouthSeen')) return;
  setFlag('mouthSeen');
  // Inside the mouth, with the sea to the ankle: a pale curled back going up into the dark, and a clear place at its nape.
  await pan(10, 3);
  await wait(60);
  await panBack();
});

async function aperture(): Promise<void> {
  if (sat()) { await gleanerHolds(); return; }
  if (!highTide()) { await emote('ouro', 'silence'); return; }
  if (awake()) return;
  if (flag('gleanerWoken')) {
    if (await choose(['Wake it', 'Not yet'], true) !== 0) return;
    // Ouro calls into the clear place. The call goes in and in, and the back moves.
    await act('ouro', 'bow');
    bell(0);
    await wait(80);
    await wake();
    return;
  }
  // Ouro looks in at the clear place. Inside it is empty and pale, and goes on a long way.
  await act('ouro', 'bow');
  await emote('ouro', 'silence');
  const gran = smallGranOut();
  if (!gran) { await hint('(Small Gran\'s last line wakes it. She is not in your team.)'); return; }
  // Small Gran comes out of her horn by the opening beside the great neck.
  mouthScene.gran = true;
  offstage('mouthgran');
  await liftOff('mouthgran', 'ouro', 12, 10);
  face('mouthgran', 2);
  if (granNext() === 4) await hint('Her next line is her last one.');
  await choose(['Talk to her.']);
  const line = granNext();
  await smallGranLine();
  if (line !== 4) { await wait(40); await emote('ouro', 'silence'); return; }
  await lastLine();
}

/** Small Gran's fifth line comes out at the back of the great neck and wakes it. */
async function lastLine(): Promise<void> {
  // Her voice booms out of the opening at the back of the great neck and out across the whole beach. The back moves.
  field.shakeT = 40;
  await say('Small Gran', SMALL_GRAN[4].toUpperCase());
  setFlag('roarHeard');
  await shake(30);
  await wake();
}

/** The Gleaner, the last fight. Strand level 65. */
export const gleanerTeam = (): Mon[] => [mon('ammonite', 62), mon('lodestar', 63), mon('heirloom', 64), mon('gleaner', 65)];
/** The Gleaner's four are a giant's: each has this much more HP than its level gives. */
export const GLEANER_HP = 1.15;

async function wake(): Promise<void> {
  const first = !flag('gleanerWoken');
  setFlag('gleanerWoken');
  setFlag('gleanerAwake');
  if (first) {
    // The back uncurls, and a great child sits up out of the sea, pale the way every cast is, eyes open on nothing.
    // Then the eyes come down to Ouro.
    await shake(40);
    await pan(10, 3);
    await wait(60);
    await panBack();
    await emote('ouro', 'surprise');
    // One finger comes down and pushes a driftwood post into the sand between them, and presses letters into it.
    mouthScene.finger = true;
    const fp = field.map.props?.find(q => q.pic === 'gleanerFinger');
    for (let y = -3; y <= 4; y++) { if (fp) fp.y = y; await wait(6); }
    for (let i = 0; i < 4; i++) { sound('cut'); await wait(14); }
    setFlag('keepFour');
    for (let y = 4; y >= -3; y--) { if (fp) fp.y = y; await wait(6); }
    mouthScene.finger = false;
    if (fp) fp.y = 2;
    await say('Label', 'KEEP THE FOUR.');
  } else {
    await shake(30);
    await emote('ouro', 'surprise');
  }
  // The sea is up in the mouth for the fight.
  if (!highTide()) setTide(true);
  G.flags.seaBattles = 1;
  await hint('(The tide here is high. Both sides start with 3 tide.)');
  const r = await battle({ enemy: gleanerTeam(), name: 'The Gleaner', ai: 'champion', wild: false, bg: field.bg(), music: 'collector', bossHp: GLEANER_HP });
  field.playMapMusic();
  if (r.result !== 'win') {
    // The hand lifts Ouro's lead whorl, holds it up to listen, sets it down very carefully, and curls back up in the mouth.
    await act('whorl', 'lift');
    await wait(60);
    await act('whorl', 'hop');
    setFlag('gleanerAwake', 0);
    mouthScene = {};
    await shake(20);
    await hint('(The Conch lets you out at the lip. Come back at high tide.)');
    await warp('conchlip', 16, 8, 0);
    return;
  }
  // The Gleaner sits very still. Then its hand comes up, palm up and empty, held out at the height of Ouro's head.
  await wait(60);
  await prop('palm', 'gleanerHand', 7, 6, 40);
  await wait(60);
  await theGift();
}

/** What the Gleaner hears when it holds the gift to its ear. */
async function hears(m: Mon): Promise<void> {
  const k = m.kind;
  if (k === SMALL_GRAN_KIND) { await smallGranLine(); return; }
  const lines: Record<string, string> = {
    knot: 'Something in Knot turns, once. ... A long creak.',
    vellumslip: 'It turns over in the hand. ... Once.',
    welling: 'Water moves in Kaivodo. ... A long way down.',
    full: 'The tide in Full comes up. ... And goes down.',
    bramble: 'It rustles.',
    squall: 'Rain comes out of it, sideways. A little. ... Onto the great hand.',
    dynamo: 'It hums. ... The same note the old pump hummed.',
    mundane: 'It beats. ... Once. ... Very slowly.',
  };
  await narr(lines[k] || 'It does what it always does. The hand holds still for it.');
}

/** Ouro chooses one whorl to give. The four keep at least one. */
async function chooseGift(): Promise<Mon> {
  for (;;) {
    const all = [...G.party, ...G.rack];
    const i = await listMenu('Give which whorl?', all.map(monLine), { w: 160 });
    if (i < 0) continue;
    const m = all[i];
    if (G.party.length === 1 && G.party[0] === m && all.length > 1) { await hint('(Your team must keep at least one whorl.)'); continue; }
    if (await choose(['Give it.', 'Choose again.'], false, `${m.name}. It will not come back.`) !== 0) continue;
    G.party = G.party.filter(x => x !== m);
    G.rack = G.rack.filter(x => x !== m);
    G.flags.gaveUid = m.uid;
    (G as any).gift = { name: m.name, kind: m.kind };
    (G as any).a2gift = { name: m.name, kind: m.kind, sprite: m.sprite };
    save();
    return m;
  }
}

async function theGift(): Promise<void> {
  // Cinch comes in through the last door, slowly, wet to the knee, and sits in a fold of the pink floor.
  mouthScene.cinch = true;
  offstage('mouthcinch');
  await walkIn('mouthcinch', 10, 13, 4, 10);
  await act('mouthcinch', 'bow');
  await cinch('Sit. You can see its hand from down here. Empty.');
  await cinch('Picked up every shell on the beach, that one. Looks like it only ever wanted one.');
  await hint('(Choose one whorl to give it. It will not come back.)');
  const m = await chooseGift();
  const labeled = G.flags.labeledUid === m.uid;
  const labeledMon = [...G.party, ...G.rack].find(x => x.uid === G.flags.labeledUid);
  // Ouro lifts the whorl into the open hand. The hand closes round it without squeezing and lifts it up beside its ear.
  await act('ouro', 'bow');
  await prop('gift', 'mon:' + m.kind, 8, 7, 20);
  await unprop('palm', 30);
  for (let y = 7; y >= 2; y--) { await prop('gift', 'mon:' + m.kind, 8, y, 0); await wait(10); }
  await unprop('gift', 30);
  // It listens.
  await wait(60);
  await hears(m);
  // The great child sits back against the inside of the Conch with its knees up, the whorl at its ear, and does not move.
  setFlag('gleanerAwake', 0);
  setFlag('gleanerSat');
  await shake(10);
  await wait(60);
  // One finger pushes a last driftwood post into the sand beside it and presses letters into it, with a long gap after each.
  mouthScene.finger = true;
  const fp = field.map.props?.find(q => q.pic === 'gleanerFinger');
  for (let y = -3; y <= 4; y++) { if (fp) fp.y = y; await wait(6); }
  for (let i = 0; i < 5; i++) { await wait(40); sfx('cut'); }
  for (let y = 4; y >= -3; y--) { if (fp) fp.y = y; await wait(6); }
  mouthScene.finger = false;
  if (fp) fp.y = 2;
  await say('Label', 'WADE\'S.');
  if (!labeled && labeledMon) {
    // The label by the one it marked tips over in the sand, and nobody picks it up.
    await prop('oldlabel', 'labelPost', 13, 10, 0);
    sound('bump');
    await unprop('oldlabel', 40);
  }
  if (m.kind === 'knot') await cinch('Sit. It\'s holding still now. Always was good at that, the old thing.');
  if (m.kind === SMALL_GRAN_KIND) await cinch('Sit a minute. She\'s got the best seat on the beach.');
  delete (G as any).a2label;
  G.flags.labeledUid = 0;
  // The sixth grain falls by itself.
  // A star comes down over the Conch, small and slow, and lands in Ouro's held-out hand, and goes out, warm.
  await act('ouro', 'bow');
  strandFx.landings.push({ x: field.x, y: field.y, t: 0 });
  await wait(40);
  G.flags.a2pearls = Math.max(6, (G.flags.a2pearls || 0) + 1);
  sfx('level');
  await notice('Ouro gets a star grain. Six now.');
  await grainLine();
  save();
  await lowWaterAfter();
}

// ---------------------------------------------------------------- the Return

async function lowWaterAfter(): Promise<void> {
  setFlag('sweepOver');
  setTide(false);
  mouthScene = {};
  // The tide goes out, and the Gleaner does not get up. No footsteps, no shaking ground, no line of stars.
  await wait(120);
  await cinch('Sit, if you like. Nothing\'s coming.');
  // Ouro walks back up the beach all night, past every place that kept still at low water and does not now:
  // the Mudlark standing up in the Tray, the Nautilus's pumps stopped, the climbers sitting on the stair,
  // nobody stamping in the Polish, and the Sand Dollar's people standing on the bar.
  const stops: [string, number, number, string, 'hop' | 'look' | 'nod'][] = [
    ['tray', 21, 17, 'traymud', 'hop'], ['livingchamber', 12, 9, 'lcgoat', 'look'], ['augermouth', 10, 8, 'a2ClWoman', 'nod'],
    ['polish', 16, 12, 'a2PoMan', 'look'], ['sanddollar', 19, 28, 'a2SdOldMan', 'nod'],
  ];
  for (const [map, x, y, who, how] of stops) {
    if (!MAPS[map]) continue;
    await tint('#0b0a10', 1, 20);
    await sceneWarp(map, x, y, 0);
    evening(true);
    await tint('#0b0a10', 0, 20);
    faceToward(who, 'ouro');
    await act(who, how);
    await wait(40);
  }
  await tint('#0b0a10', 1, 30);
  await theVolute();
}

async function theVolute(): Promise<void> {
  if (MAPS.outerwhorl) await sceneWarp('outerwhorl', 3, 22, 2);
  evening(false);
  await tint('#0b0a10', 0, 40);
  // Ouro puts an ear to the Volute. Its tune plays, all of it, no gaps, as low as the Stays left it.
  await shellTune(false, !hold(), loosened());
  if (hold()) sound('guard');
  // Behind, far out over the sea, a star comes down. Ouro turns round.
  strandFx.landings.push({ x: 26, y: 26, t: 0 });
  await wait(40);
  face('ouro', 0);
  await narr('Far down the beach, the Gleaner sits in the pink shell with something held to its ear.');
  for (const x of [20, 14, 8]) { strandFx.landings.push({ x, y: 26, t: 0 }); await wait(24); }
  // Ouro climbs back up the ridges to the hole in the Volute's side, and goes in.
  face('ouro', 2);
  await tint('#0b0a10', 1, 40);
  if (hold()) await epilogueApex(); else await epilogueLip();
  await kitchen();
}

// ---------------------------------------------------------------- the epilogue

const epi = (k: string) => () => !!flag('epi' + k);
MAPS.crown?.npcs.push(
  { id: 'epitack', x: 10, y: 11, sprite: 'tack', name: 'Tack', dir: 2, when: () => hold() && !!flag('epiApex'),
    lines: () => [flag('a2done') ? '0 turns today. 3 of us, sitting. Writing that down.' : 'Day 41. That\'s 41 turns. Your go, I said.'] },
  { id: 'epibare', x: 4, y: 16, sprite: 'bare', name: 'Bare', dir: 1, when: () => hold() && !!flag('epiApex'), lines: ['Sit, if you want. Leave the post be.'] },
);
const HERMITS: [number, number][] = [[12, 25], [14, 25], [16, 25], [21, 25], [23, 25], [25, 25]];
MAPS.slack?.npcs.push(
  ...HERMITS.map(([x, y], i): NpcDef => ({ id: 'epihermit' + i, x, y, sprite: 'peeler', name: 'Hermit', dir: 0, when: () => release() && !!flag('epiLip'),
    lines: ['(A Hermit sits on the hard new edge with a haul team asleep beside them.)'] })),
  { id: 'epibare2', x: 10, y: 24, sprite: 'bare', name: 'Bare', dir: 1, when: () => release() && !!flag('epiLip'), lines: ['Go on home. Your gran will have soup on.'] },
);

async function epilogueApex(): Promise<void> {
  setFlag('epiApex');
  await sceneWarp('crown', 13, 11, 2);
  evening(false);
  await tint('#0b0a10', 0, 30);
  // At the top, Tack stands at the Operculum with both hands on the post, and Bare sits near the edge with her knees up.
  face('epitack', 1);
  await say('Tack', 'Day 41. 41 turns. Your go.');
  // Ouro puts both hands on the post, and does not turn it. Ouro takes them off and sits down beside it, legs out.
  await walkTo('epitack', 10, 12);
  await walkTo('ouro', 11, 11);
  face('ouro', 2);
  await act('ouro', 'bow');
  await wait(90);
  await act('ouro', 'back');
  await act('ouro', 'bow');
  await say('Tack', '0 turns today. That\'s still a number.');
  await say('Bare', 'Leave it. Let it come when it comes.');
  setFlag('seamClosed', 0);
  G.flags.seamExtra = Math.max(0, 1 - loosened());
  // The craze down Ouro's back, closed since the Apex, opens one pixel at the nape.
  sfx('fit');
  await act('ouro', 'shiver');
  await granSpeaks();
  // Tack sits down too, on the other side of the post.
  await walkTo('epitack', 13, 11);
  await act('epitack', 'bow');
  await say('Tack', '3 of us sitting. Fine. I\'ll count the days instead.');
}

async function epilogueLip(): Promise<void> {
  setFlag('epiLip');
  await sceneWarp('slack', 18, 26, 2);
  offstage('epibare2');
  await tint('#0b0a10', 0, 30);
  // At the hard pale edge of the new shell, the Hermits sit in a long row with their haul teams asleep beside them.
  await pan(18, 24);
  await wait(40);
  // Bare walks along the row, slowly, looking at each of them.
  await walkIn('epibare2', 28, 24, 27, 24);
  for (const x of [25, 23, 21]) { await walkTo('epibare2', x, 24, 14); face('epibare2', 0); await wait(30); }
  await say('Bare', 'Sit down. All of you. Rest.');
  await say('Bare', 'Put the haul away. Go eat something.');
  await panBack();
  // Bare stops at Ouro.
  await walkUp('epibare2');
  await say('Bare', 'Go home. Eat at your gran\'s.');
}

/** Takes Small Gran out of the four, the Midden, or a shell. */
function smallGranHome(): boolean {
  let found = false;
  for (const list of [G.party, G.rack]) {
    const i = list.findIndex(m => m.kind === SMALL_GRAN_KIND);
    if (i >= 0) { list.splice(i, 1); found = true; }
  }
  for (const [k, m] of Object.entries(G.shellMons)) if (m.kind === SMALL_GRAN_KIND) { delete G.shellMons[k]; found = true; }
  return found;
}

async function kitchen(): Promise<void> {
  await sceneWarp('home', 4, 4, 2);
  evening(false);
  const gift = (G as any).a2gift as { name: string; kind: string } | undefined;
  const gave = (k: string) => gift?.kind === k;
  const boot = G.keys.includes('granboot');
  await tint('#0b0a10', 0, 30);
  // The boot goes on the table by the good bowl, and sand runs out of it.
  const putBoot = async () => { await walkTo('ouro', 5, 3); face('ouro', 3); await act('ouro', 'bow'); sound('step'); await prop('boot', 'mon:brogue', 4, 3, 20); };
  if (gave(SMALL_GRAN_KIND)) {
    // Gran turns toward the empty place by the window, and stops, and turns to Ouro.
    face('gran', 1);
    await say('Gran', 'Tell my little turnip');
    await wait(40);
    await emote('gran', 'silence');
    faceToward('gran', 'ouro');
    await say('Gran', 'You gave her to a child.');
    await say('Gran', 'She will like that. She was always fond of the beach.');
    if (boot) {
      await putBoot();
      await wait(120);
      await say('Gran', 'That is my left.');
    }
  } else if (flag('smallGranOut') && smallGranHome()) {
    // Small Gran walks in past Ouro and goes to her place by the window, facing the wall.
    setFlag('smallGranOut', 0);
    offstage('smallgran');
    await walkIn('smallgran', 4, 7, 7, 2);
    face('smallgran', 2);
    await smallGranLine();
    await say('Gran', 'Tell my little turnip she has come home, then.');
    await say('Gran', 'Tell my little turnip she is redolent of salt.');
    if (boot) {
      await putBoot();
      await say('Gran', 'Tell my little turnip that my boot.');
      await smallGranLine();
      await say('Gran', 'Tell my little turnip it was the left one. I hopped home, the entire distance.');
    }
  }
  if (gave('vellumslip') && release()) {
    faceToward('gran', 'ouro');
    await wait(30);
    await say('Gran', 'Tell my little turnip it looks a good deal lighter.');
  }
  const wellFull = !!flag('wellingHome') || !flag('wellingGone');
  if (gave('welling')) await say('Man at the well', 'Dry. They say she\'s gone to the beach. She always did frighten easy.');
  else await say('Man at the well', wellFull ? 'She\'s up! Water\'s right up. She\'s heard something she liked.' : 'She\'s still dust. We carry, it\'s not far. I tell her about it every trip.');
  if (gave('bramble') || gave('squall') || gave('dynamo')) {
    await say('Strandmonger', 'Which that stray cost me two cowries and a sandwich. I still miss the sandwich.');
    await say('Strandmonger', 'You got the best of that trade twice. I\'ve never once managed it.');
  }
  if (gave('mundane')) await narr('North past the Lip, the Exuvia settles lower in the sand, and lies still.');
  if (gave('full')) await narr('That night the moon comes up full, and stays full.');
  // Ouro goes to bed. Through the wall, very faint, the Volute plays its tune.
  await tint('#0b0a10', 0.8, 60);
  await shellTune(false, false, loosened());
  await wait(40);
  await narr(hold() ? 'THE VOLUTE RESTS.' : 'THE VOLUTE HARDENS.');
  await tint('#0b0a10', 0, 0);
  await credits2();
  setFlag('a2done');
  save();
  goal('The Strand stays open, through the Margin or the gray at the Shoreline.');
  await hint('(The Strand stays open. Keepers on the Strand take rematches at Strand level 35.)');
}

// ---------------------------------------------------------------- the Act 2 credits

function credits2(): Promise<void> {
  const lines: { s: string; c: string; big?: boolean; spr?: SpriteData }[] = [];
  const add = (s: string, c = PAPER) => lines.push({ s, c });
  const gift = (G as any).a2gift as { name: string; sprite?: SpriteData } | undefined;
  add('');
  lines.push({ s: 'WHORL', c: PAPER, big: true });
  add('The Strand', DIM);
  add(''); add('');
  add('Kept by WADE', SEL);
  add('');
  lines.push({ s: gift?.name || 'nothing', c: PAPER, spr: gift?.sprite });
  add(''); add('');
  add(`Star grains: ${Math.min(6, G.flags.a2pearls || 0)}`);
  const best = Math.max(0, ...Object.entries(G.flags).filter(([k]) => /^starfall[A-Z]|^starfallBest$/.test(k)).map(([, v]) => v));
  add(`Starfall best: ${best}`);
  const owned = WILD_KINDS.filter(k => G.register[k] === 2).length;
  add(`Register: ${owned} of ${WILD_KINDS.length}`);
  add(hold() ? 'Turns at the post, Tack: 41' : 'Teams hauled, Bare: all');
  add(''); add(''); add('');
  add(hold() ? 'The Volute rests.' : 'The Volute hardens.', SEL);
  add(''); add(''); add('');
  add('The end.');
  let y = 200;
  const total = lines.length * 11 + 60;
  music.play('credits2');
  const m: Mode = {
    opaque: true,
    update() {
      y -= input.held('ok') || input.held('fast') ? 2 : 0.4;
      const done = y < -total + 96;
      if (done) y = -total + 96;
      if (done && (music.finished() || input.hit('ok') || input.hit('back'))) close(m);
    },
    draw() {
      clear('#07061a');
      lines.forEach((l, i) => {
        const yy = Math.round(y + i * 11);
        if (yy < -24 || yy > 200) return;
        if (l.big) { bigText(l.s, 96 - bigWidth(l.s, 3) / 2, yy - 8, 3, l.c); return; }
        textCenter(l.s, 96, yy, l.c);
        if (l.spr) drawSprite(l.spr, 20, yy - 4, 2);
      });
    },
  };
  return run(m);
}

// ---------------------------------------------------------------- hooks into chapters 1 to 3, and After Act 2

/** Wraps a talk script so a later line can come first. The wrapper returns true when it has spoken. */
function wrapTalk(id: string, first: () => Promise<boolean>): void {
  const before = SCRIPTS[id];
  if (!before) return;
  defScript(id, async () => { if (await first()) return; await before(); });
}
/** Finds a person on a map by name. */
const personOn = (map: string, name: string) => MAPS[map]?.npcs.find(n => n.name === name);
/** Wraps a person's talk by map and name, giving them a script of their own if they have none. */
function wrapPerson(map: string, name: string, first: () => Promise<boolean>): void {
  const n = personOn(map, name);
  if (n) wrapNpc(map, n, first);
}
function wrapNpc(map: string, n: NpcDef, first: () => Promise<boolean>): void {
  if (n.trainer) return;
  if (!n.talk) {
    const id = `a2late_${map}_${n.id}`;
    const lines = n.lines;
    defScript(id, async () => { for (const l of (typeof lines === 'function' ? lines() : lines) || []) await say(n.name || null, l); });
    n.talk = id;
  }
  wrapTalk(n.talk, first);
}
const once = async (who: string, ls: string[], cond: () => boolean): Promise<boolean> => {
  if (!cond()) return false;
  for (const l of ls) await say(who, l);
  return true;
};
const roarNow = () => !!flag('roarHeard') && !flag('sweepOver');

// The Sand Dollar: the spring high's letters, chapter 6's lines, the ring, the boot, and After Act 2.
const sdCinch = MAPS.sanddollar?.npcs.find(n => n.id === 'a2CinchFire');
if (sdCinch) {
  const was = sdCinch.when;
  sdCinch.when = () => (flag('springHigh') ? (!flag('cinchToLip') || !!flag('a2done')) : !was || was());
}
wrapTalk('a2CinchFire', async () => {
  if (flag('a2done')) {
    if (flag('ringRead') && !flag('cinchWade')) { setFlag('cinchWade'); await cinch('Sit down. Wade. That\'s a small somebody\'s name.'); return true; }
    await cinch('Staying out here, me. They\'ve got a good fire, and a log my shape.');
    return true;
  }
  if (!flag('springHigh')) return false;
  if (!flag('ringAsked')) {
    setFlag('ringAsked');
    await cinch('Sit. Your world\'s got a hand in it, lying palm up. I sat on its thumb once, a whole afternoon.');
    await cinch('From the thumb you could see a ring on it. Writing round the inside.');
  }
  await cinch('Hang on. I\'m coming too. Got a lip to sit on.');
  setFlag('cinchToLip');
  return true;
});

wrapTalk('a2PostShell', async () => {
  if (!flag('springHigh') || flag('letterSpring')) return false;
  setFlag('letterSpring');
  if (hold()) {
    G.rind = Math.max(0, G.rind - 3);
    await say('Strandmonger', 'A thick one! Three cowries. He wrote on both sides, which is free, which I regret.');
    await say('Letter', 'Day 30. 30 turns. At low something lifted us. Whole Volute tipped. Lug fell over.');
    await say('Letter', 'Turned post anyway. 1 turn, hard as could. Got put down. Fid says 4 spans down.');
    await say('Letter', 'Hasp asked if hands steady. Were not. 0 days off. Tack.');
  } else {
    await say('Strandmonger', 'From Bare. Wouldn\'t pay postage. Which I carried it anyway, at a loss of a cowrie and my good name.');
    await say('Letter', 'Haul every low. All teams, all at once, in time. Keep moving.');
    await say('Letter', 'Mend two cracked teams. Haul again. Come home when you can. Bare.');
  }
  return true;
});

wrapTalk('a2Strandmonger', () => once('Strandmonger', ['Going to the pink one, aren\'t you. I can see it on you. That\'s a ten-cowrie face, easy.',
  'Plus your Midden I\'ll keep for nothing while you\'re down there. Once. Free. I feel ill.'], () => !!flag('springHigh') && !flag('sweepOver') && !flag('smPink') && (setFlag('smPink'), true)));

wrapTalk('a2Eldest', async () => {
  if (G.keys.includes('granboot') && !flag('eldestBoot')) {
    setFlag('eldestBoot');
    await say('Eldest', 'Yesterday that boot was on her foot. This morning I\'d know it in the dark.');
    await say('Eldest', 'Yesterday she\'d have wanted it back. This morning I think she still would.');
    await reward({ tan: 3 });
    return true;
  }
  if (flag('springHigh') && !flag('sweepOver')) { await say('Eldest', '(yesterday that girl goes home. this morning she will be old)'); return true; }
  return false;
});

wrapTalk('a2SdOldMan', () => once('Old man', ['Big low\'s done. Went right past us twice! We kicked our feet like anything.'], () => !!flag('springHigh') && !flag('sweepOver') && !roarNow()));
wrapTalk('a2SdWoman', () => once('Woman', ['Everybody\'s house stayed! Except one on the far bar. He\'s in with his sister now.'], () => !!flag('springHigh') && !flag('sweepOver')));
wrapTalk('a2SdBoy', () => once('Boy', ['A girl\'s voice came out of the pink one! Everybody stopped sweeping. I stopped first.'], roarNow));
wrapTalk('a2SifterFire', () => once('The Sifter', ['Two lows a day, every day, and one house restored. A most equitable measure!!'], () => !!flag('springHigh') && !!flag('sifterHome')));
wrapTalk('a2SifterHouse', () => once('The Sifter', ['Two lows a day, every day, and one house. Fair measure. A thimble, a barrow, a flannock.'], () => !!flag('springHigh') && !flag('sweepOver')));
wrapTalk('a2SifterTop', () => strandRematch('The Sifter', ['kipper', 'mote', 'halite', 'columba'], 'sifter'));

// The Roar's voice heard in the Polish and on the Auger's stair, and the keepers of chapters 2 and 3.
wrapPerson('polish', 'Girl', () => once('Girl', ['Somebody said "Don\'t look" really loud. So Gloss looked. Gloss always does.'], roarNow));
for (const m of ['augermouth', 'augerstair']) for (const name of ['Woman', 'Man', 'Girl', 'Boy', 'Old man']) {
  if (personOn(m, name)) { wrapPerson(m, name, () => once(name, ['Heard it on the stair. It said it twice! Second time was louder.'], roarNow)); break; }
}
for (const [map, name, team, who] of [
  ['glosshall', 'Gloss', ['laggard', 'tain', 'luster', 'macula'], 'gloss'],
  ['turnwisegym', 'Turnwise', ['crimp', 'chamois', 'zenith', 'gyre'], 'turnwise'],
] as [string, string, string[], string][]) wrapPerson(map, name, () => strandRematch(name, team, who));

// The Strand Boardmaster sits at the Sand Dollar fire after Act 2 and plays the five strongest Strand cards.
const ACT2_KINDS = [
  'acorn varix mew halite skitter fucus flotsam mote seaglass kipper actinia lacuna columba lobworm',
  'razor annulet macula pallium seiche scud enamel porcella specie emery faience denticle diastema',
  'furl laggard tain luster gyre lichen groundswell chalk saltline tumbleweed riser columella crimp',
  'chamois swift torr plummet zenith bourdon laminaria eelgrass grenadier asterias cirrus hyponome',
  'slackwater brinicle transit ballast sluice septum vacuole evaporite hood spoor bolide marram',
  'saltwort albedo cuttle medusa bollard docket vacancy trochus hopper crabwise magpie cache strombus',
  'sanderling flood surf fleur madrepore blush cochlea samphire gimbal lull flange pleiad aphelion',
  'ostium gimlet albatross protoconch astrolabe pallasite halophile heirloom lodestar ammonite',
].join(' ').split(' ');
async function strandBoardmaster(): Promise<void> {
  const { cardOf } = await import('../../game/minigames/pegboard');
  const sum = (k: string) => cardOf(k).e.reduce((a: number, b: number) => a + b, 0);
  const deck = ACT2_KINDS.filter(k => SPECIES[k]).sort((a, z) => sum(z) - sum(a)).slice(0, 5);
  await playShellboard({ id: 'a2pegmaster', name: 'The Strand Boardmaster', deck, look: true, tier: 10, prize: 'spareskin', strand: true,
    lines: ['Every Strand card has been through my hands, damp or dry. Five stayed, most loyally!!'] });
}
defScript('a2Boardmaster', strandBoardmaster);
MAPS.sanddollar?.npcs.push({ id: 'a2Boardmaster', x: 17, y: 13, sprite: 'keeper', name: 'The Strand Boardmaster', dir: 1, talk: 'a2Boardmaster', when: () => !!flag('a2done') });

// After Act 2, townsfolk everywhere on the Strand say one of three things at low water.
const MINE = new Set(['lowline', 'livingchamber', 'oldchambers', 'tidechamber', 'siphuncle', 'springlow', 'longstrand', 'tray', 'hollowtop', 'mudlarkyard', 'oldapex', 'conchlip', 'conchpink', 'conchturn', 'conchroar', 'conchmouth']);
const FOLK = /^(beach|cowrie|climber|nautilus)/;
let folkN = 0;
for (const m of Object.values(MAPS)) {
  if (!m.strand || MINE.has(m.id)) continue;
  for (const n of m.npcs) {
    if (n.trainer || !FOLK.test(n.sprite)) continue;
    const i = folkN++;
    wrapNpc(m.id, n, () => once(n.name || '', [afterLow(i)], () => !!flag('sweepOver') && lowWater()));
  }
}


void makeMon; void PEOPLE; void (null as unknown as MapDef);
