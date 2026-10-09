// Puzzle halls: every Stay keeper's hall now has a puzzle between the door and the keeper.
// The Spire's nave keeps its bell ropes. The layouts below were checked with solvers for their shortest solutions.
import { sfx } from '../engine/audio';
import { act, choose, emote, field, hint, morphTo, narr, say, shake, sound } from '../game/api';
import { flag, setFlag } from '../game/state';
import { defScript, MAPS, SCRIPTS } from '../game/world';
import { Canvas } from './areakit';

/** Replaces a hall's layout, moves its door to the bottom row, and points the town's door at the new entrance. */
function rebuild(id: string, c: Canvas, doorX: number): void {
  const m = MAPS[id];
  const back = m.warps[0];
  c.put(doorX, c.h - 1, 'd').put(doorX + 1, c.h - 1, 'd');
  m.rows = c.rows();
  m.warps = [doorX, doorX + 1].map(x => ({ x, y: c.h - 1, to: back.to, tx: back.tx, ty: back.ty, dir: 0 }));
  for (const t of Object.values(MAPS)) for (const w of t.warps) if (w.to === id) { w.tx = doorX; w.ty = c.h - 2; }
}

function moveNpc(map: string, id: string, x: number, y: number, dir?: number): void {
  const n = MAPS[map].npcs.find(n => n.id === id);
  if (!n) return;
  n.x = x; n.y = y;
  if (dir !== undefined) n.dir = dir;
}

/** Copies a solver layout into a hall. Each character maps to a tile. */
function stamp(c: Canvas, x0: number, y0: number, layout: string[], map: Record<string, string>): void {
  layout.forEach((r, j) => [...r].forEach((ch, i) => c.put(x0 + i, y0 + j, map[ch] ?? ch)));
}

// ---------------------------------------------------------------- Rib: polished bone, 8 slides at best

const rib = new Canvas(16, 17, '_').border('#');
stamp(rib, 2, 3, [
  '............',
  'IIIIII#IIIII',
  'II#IIIIIIIII',
  'IIIIIIIIII#I',
  'II#IIIIII#II',
  'I#IIIII#IIII',
  'IIIIIII##III',
  'IIII#I#II#II',
  'IIIII#IIII#I',
  '#II##IIII#I#',
  '............',
], { '.': '_', '#': 'u' });
rib.rect(1, 4, 1, 9, 'u').rect(14, 4, 1, 9, 'u');
rebuild('ribgym', rib, 7);
moveNpc('ribgym', 'knuckle', 7, 1);
moveNpc('ribgym', 'help1', 3, 14, 1);
moveNpc('ribgym', 'help2', 12, 14, 3);
MAPS.ribgym.npcs.push({ id: 'ribsign', x: 2, y: 15, sprite: 'sign', name: undefined, lines: ['Knuckle had the floor polished. Knuckle likes to watch people try. Signed, Knuckle.'] });

// ---------------------------------------------------------------- Mast: wind across the deck, 16 steps at best

const mast = new Canvas(16, 17, '_').border('#');
stamp(mast, 2, 3, [
  '............',
  '.....v......',
  '.....v.#...v',
  '.#..<<<<<..v',
  '#....v.....>',
  '.......v...v',
  '.......v...v',
  '...v...v>>>>',
  '...v>>>>>#..',
  '..>v>>>v....',
  '............',
], { '.': '_', '#': 'p', '>': 'E', '<': 'W', '^': 'N', v: 'S' });
mast.rect(1, 4, 1, 9, 'e').rect(14, 4, 1, 9, 'e');
rebuild('mastgym', mast, 7);
moveNpc('mastgym', 'leeward', 7, 1);
moveNpc('mastgym', 'deck1', 3, 14, 1);
moveNpc('mastgym', 'deck2', 12, 14, 3);
MAPS.mastgym.npcs.push({ id: 'mastsign', x: 2, y: 15, sprite: 'sign', name: undefined, lines: ['Wind: Deckward!! Leeward says a good sailor reads it before stepping in it.'] });

// ---------------------------------------------------------------- Bole: five saplings, four gates

const bole = new Canvas(16, 17, '_').border('#');
for (const y of [3, 5, 7, 9]) bole.rect(1, y, 14, 1, 'j');
const BOLE_GATES = [[4, 9], [11, 7], [4, 5], [11, 3]];
const BOLE_SAPS = [[2, 12], [5, 12], [8, 12], [11, 12], [13, 12]];
for (const [x, y] of BOLE_SAPS) bole.put(x, y, 'i');
rebuild('bolegym', bole, 7);
// Each sapling, touched, curls back the roots of two or three gates. All four open together is the way up.
const sap = (i: number) => (flag('bsap' + i) ? 1 : 0);
const boleGate = [() => sap(0) ^ sap(3) ^ sap(4), () => sap(0) ^ sap(1), () => sap(1) ^ sap(2) ^ sap(4), () => sap(2) ^ sap(3)];
MAPS.bolegym.mods = BOLE_GATES.map(([x, y], k) => ({ x, y, ch: '_', when: () => boleGate[k]() === 1 }));
moveNpc('bolegym', 'grafton', 7, 1);
moveNpc('bolegym', 'graft1', 2, 14, 1);
moveNpc('bolegym', 'graft2', 13, 14, 3);
(MAPS.bolegym.spots ||= []).push(...BOLE_SAPS.map(([x, y], i) => ({ x, y, script: async () => {
  setFlag('bsap' + i, flag('bsap' + i) ? 0 : 1);
  sfx('switch');
  field.shakeT = 6;
  await act('ouro', 'back');
} })));
MAPS.bolegym.npcs.push({ id: 'bolesign', x: 7, y: 14, sprite: 'sign', name: undefined, lines: ['Grafton\'s note: every sapling here is grafted to more than one gate. Watch which!! (good luck)'] });

// ---------------------------------------------------------------- Hum: route the current to Ohm's door

const hum = new Canvas(16, 15, '_').border('#');
hum.rect(1, 3, 14, 1, '#');
const HUM_SRC = { x: 1, y: 7 }, HUM_DOOR = { x: 12, y: 3 };
const HUM_PRISMS = [[5, 7], [5, 12], [12, 12], [5, 4]];
hum.put(HUM_SRC.x, HUM_SRC.y, 'O').put(HUM_DOOR.x, HUM_DOOR.y, 'j');
for (const [x, y] of HUM_PRISMS) hum.put(x, y, 'R');
rebuild('humgym', hum, 7);
let humKey = '', humLit = false, humTiles = new Set<number>();
function humBeam(): Set<number> {
  const key = HUM_PRISMS.map((_, i) => flag('hprism' + i)).join('');
  if (key === humKey) return humTiles;
  humKey = key; humTiles = new Set(); humLit = false;
  let x = HUM_SRC.x, y = HUM_SRC.y, dx = 1, dy = 0;
  for (let n = 0; n < 200; n++) {
    x += dx; y += dy;
    if (x === HUM_DOOR.x && y === HUM_DOOR.y) { humLit = true; break; }
    const p = HUM_PRISMS.findIndex(([px, py]) => px === x && py === y);
    if (p >= 0) { if (flag('hprism' + p)) [dx, dy] = [dy, dx]; else [dx, dy] = [-dy, -dx]; continue; }
    if (x < 1 || x > 14 || y < 4 || y > 13) break;
    humTiles.add(y * 16 + x);
  }
  return humTiles;
}
MAPS.humgym.mods = [
  ...Array.from({ length: 14 * 10 }, (_, k) => ({ x: 1 + (k % 14), y: 4 + Math.floor(k / 14) })).filter(p => hum.at(p.x, p.y) === '_')
    .map(p => ({ x: p.x, y: p.y, ch: 'L', when: () => humBeam().has(p.y * 16 + p.x) })),
  ...HUM_PRISMS.map(([x, y], i) => ({ x, y, ch: 'Q', when: () => !!flag('hprism' + i) })),
  { x: HUM_DOOR.x, y: HUM_DOOR.y, ch: '_', when: () => { humBeam(); return humLit; } },
];
moveNpc('humgym', 'ohm', 7, 1);
moveNpc('humgym', 'ohm1', 2, 10, 1);
moveNpc('humgym', 'ohm2', 13, 10, 3);
(MAPS.humgym.spots ||= []).push(
  { x: HUM_SRC.x, y: HUM_SRC.y, script: async () => { await act('ouro', 'shiver'); await emote('ouro', 'surprise'); } },
  ...HUM_PRISMS.map(([x, y], i) => ({ x, y, script: async () => {
    if (await choose(['Turn it', 'Leave it'], true, 'A switching post. It sends the current one way or the other.') !== 0) return;
    setFlag('hprism' + i, flag('hprism' + i) ? 0 : 1);
    sfx('switch');
    humBeam();
    if (humLit && !flag('humLit')) { await shake(10); sound('fit'); await morphTo('humLit', 7, 2); }
  } })),
);

// ---------------------------------------------------------------- Tusk: young Amber walks the other way, 12 steps at best

const tusk = new Canvas(18, 14, '_').border('#');
tusk.rect(1, 3, 16, 1, 'c');
tusk.frame(1, 5, 7, 6, 'c').rect(2, 6, 5, 4, '_').put(4, 10, '_');
tusk.frame(8, 5, 7, 6, 'c').rect(9, 6, 5, 4, '_');
const TY = { x: 2, y: 6 }, TS = { x: 9, y: 6 }, YOUNG0 = { x: 11, y: 6 }, MARK = { x: 10, y: 8 };
for (const [x, y] of [[1, 0], [1, 1], [2, 2], [3, 2]]) tusk.put(TS.x + x, TS.y + y, 'c');
tusk.put(MARK.x, MARK.y, 'b');
rebuild('tuskgym', tusk, 8);
const tuskGate = { x: 12, y: 3 };
MAPS.tuskgym.mods = [{ x: tuskGate.x, y: tuskGate.y, ch: '_', when: () => !!flag('youngTallow') }];
moveNpc('tuskgym', 'tallow', 8, 1);
moveNpc('tuskgym', 'tg1', 15, 11, 3);
MAPS.tuskgym.npcs.push({ id: 'youngtallow', x: YOUNG0.x, y: YOUNG0.y, sprite: 'child', name: 'Young Amber', dir: 0, talk: 'youngTallow',
  img: () => ({ px: ['..111...', '.12221..', '.12121..', '..1221..', '.133.31.', '1.3333.1', '..3333..', '..1..1..'], c: ['#ece4d0', '#c8d4e0'] }) });
const inBox = (x: number, y: number, b: { x: number; y: number }, w = 5, h = 4) => x >= b.x && x < b.x + w && y >= b.y && y < b.y + h;
field.stepHooks.push(f => {
  if (f.map.id !== 'tuskgym' || flag('youngTallow')) return;
  const s = f.npcs.find(n => n.def.id === 'youngtallow');
  if (!s) return;
  if (!inBox(f.x, f.y, TY)) { s.x = YOUNG0.x; s.y = YOUNG0.y; return; }
  const d = f.lastStep, DXs = [0, 1, 0, -1], DYs = [1, 0, -1, 0];
  const nx = s.x - DXs[d], ny = s.y + DYs[d];
  if (inBox(nx, ny, TS) && MAPS.tuskgym.rows[ny][nx] !== 'c') { s.x = nx; s.y = ny; }
  if (s.x === MARK.x && s.y === MARK.y) void f.runBusy(SCRIPTS.youngTallowHome);
});
defScript('youngTallow', async () => { await act('youngtallow', 'nod'); await hint('Old Amber\'s first shell copies each step Ouro takes, the wrong way round.'); });
defScript('youngTallowHome', async () => {
  // The young cast stops on the worn spot where Amber stood on her Turning Day, and the rail at the top of the hall lifts.
  sfx('heal');
  await act('youngtallow', 'bow');
  await morphTo('youngTallow', tuskGate.x, tuskGate.y);
});
MAPS.tuskgym.npcs.push({ id: 'tusksign', x: 2, y: 12, sprite: 'sign', name: undefined, lines: ['Walk the left pen. She walks the right one. She had always been contrary. (A.)'] });

// ---------------------------------------------------------------- Hilt: the drill, 21 steps at best unseen

const hilt = new Canvas(16, 17, '_').border('#');
stamp(hilt, 1, 2, [
  '..............',
  '..#.#....#....',
  '.#.#....##....',
  '..............',
  '.#.....#....#.',
  '......#....#..',
  '..............',
  '..#..#.##.....',
  '##.##.#...#...',
  '..............',
  '##...#...#.#..',
  '.#..#..#.....#',
  '..............',
], { '.': '_', '#': 'p' });
rebuild('hiltgym', hilt, 7);
const GUARDS = [{ y: 5, x0: 2, x1: 14 }, { y: 8, x0: 4, x1: 14 }, { y: 11, x0: 3, x1: 14 }];
let hiltT = 0;
function guardAt(g: { y: number; x0: number; x1: number }, t: number): { x: number; dir: number } {
  const span = g.x1 - g.x0, p = t % (2 * span), off = p <= span ? p : 2 * span - p;
  return { x: g.x0 + off, dir: p < span ? 1 : -1 };
}
function placeGuards(): void {
  GUARDS.forEach((g, i) => {
    const n = field.npcs.find(n => n.def.id === 'guard' + i);
    if (!n) return;
    const s = guardAt(g, hiltT);
    n.x = s.x; n.y = g.y; n.dir = s.dir > 0 ? 1 : 3;
  });
}
function spotted(x: number, y: number): boolean {
  return GUARDS.some(g => {
    if (g.y !== y) return false;
    const s = guardAt(g, hiltT);
    if (s.x === x) return true;
    for (let k = 1; k <= 3; k++) { const cx = s.x + s.dir * k; if (MAPS.hiltgym.rows[y][cx] === 'p') break; if (cx === x) return true; }
    return false;
  });
}
GUARDS.forEach((g, i) => MAPS.hiltgym.npcs.push({ id: 'guard' + i, blocks: true, x: g.x0, y: g.y, sprite: 'keeper', name: 'Guard on drill', dir: 1, lines: ['Eyes front. Three paces. Turn.'] }));
moveNpc('hiltgym', 'quillon', 7, 1);
moveNpc('hiltgym', 'drill1', 2, 15, 1);
moveNpc('hiltgym', 'drill2', 13, 15, 3);
const hiltEnter = MAPS.hiltgym.enter;
MAPS.hiltgym.enter = 'hiltDrill';
defScript('hiltDrill', async () => { hiltT = 0; placeGuards(); if (hiltEnter && SCRIPTS[hiltEnter]) await SCRIPTS[hiltEnter](); });
field.stepHooks.push(f => {
  if (f.map.id !== 'hiltgym') return;
  hiltT++;
  placeGuards();
  if (f.y > 1 && f.y < 14 && spotted(f.x, f.y)) void f.runBusy(SCRIPTS.hiltCaught);
});
defScript('hiltCaught', async () => {
  sfx('spot');
  await say('Guard on drill', 'Oi. You. Back to the door.');
  hiltT = 0;
  field.x = 8; field.y = 15; field.px = 64; field.py = 120; field.dir = 2;
  placeGuards();
});
MAPS.hiltgym.npcs.push({ id: 'hiltsign', x: 8, y: 15, sprite: 'sign', name: undefined, lines: ['The drill: three paces of sight. Move when they turn their backs. If seen, then the door.'] });
moveNpc('hiltgym', 'hiltsign', 4, 15);

// ---------------------------------------------------------------- Fall: a maze in the dark

const fall = new Canvas(15, 17, '#');
{
  let s = 20260807;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const seen = new Set<string>();
  const stack: [number, number][] = [[7, 13]];
  fall.put(7, 13, '_');
  seen.add('7,13');
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx > 0 && ny > 0 && nx < 14 && ny < 14 && !seen.has(`${nx},${ny}`);
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[Math.floor(rnd() * opts.length)];
    fall.put(x + dx / 2, y + dy / 2, '_').put(x + dx, y + dy, '_');
    seen.add(`${x + dx},${y + dy}`);
    stack.push([x + dx, y + dy]);
  }
  fall.rect(1, 14, 13, 2, '_');
}
rebuild('fallgym', fall, 6);
MAPS.fallgym.dark = true;
moveNpc('fallgym', 'perihel', 7, 1);
moveNpc('fallgym', 'sw1', 2, 14, 1);
moveNpc('fallgym', 'sw2', 12, 14, 3);
MAPS.fallgym.npcs.push({ id: 'fallsign', x: 7, y: 15, sprite: 'sign', name: undefined, lines: ['Perihel keeps the hall dark. A star-type whorl worn in front lights it. You will have read this.'] });
