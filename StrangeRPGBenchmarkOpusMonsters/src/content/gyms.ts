// Puzzle halls: every Stay keeper's hall now has a puzzle between the door and the keeper.
// The Spire's nave keeps its bell ropes. The layouts below were checked with solvers for their shortest solutions.
import { sfx } from '../engine/audio';
import { text } from '../engine/font';
import { INK, rect } from '../engine/screen';
import { act, bell, choose, emote, field, hint, morph, morphTo, narr, say, shake, sound } from '../game/api';
import { defProp } from '../game/props';
import { G, flag, setFlag } from '../game/state';
import { defScript, MAPS, SCRIPTS } from '../game/world';
import { crossable, fieldPress, GRAPH_PUZZLES, WALK_PUZZLES, type Move } from '../tools/worldcheck';
import { Canvas } from './areakit';
import { atReset, hallTop, payoff } from './puzzlekit';

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

// ---------------------------------------------------------------- Rib: polished bone

// Polished bone ('I') slides Ouro on until a bone ('u') or plain floor stops the slide. The one way onto the bone is a
// slide that shows the rule alone. The patch of plain floor in the middle is the only stop under the gap to Knuckle.
// Fewest moves: 7. See Notes/puzzle-design.md and Notes/puzzle-log.md.
const RIB_FLOOR = [
  '______________',
  '______________',
  'uuuuuuuIuuuuuu',
  'uIIIIIIIIuIIII',
  'uuIIIIuIIIIIII',
  'IIIIIIIIIIIIII',
  'IuIuuIIIIIIIII',
  'IIIIIIuIIIIuII',
  'IIIIIIIIIIIIIu',
  'IIuIIII_IIIIII',
  'IIIIIIIIIIIIII',
  'IIIIIuIIIIIuIu',
  'uuuuIuuuuuuuuu',
  '______________',
  '______________',
];
const rib = new Canvas(16, 17, '_').border('#');
stamp(rib, 1, 1, RIB_FLOOR, {});
rebuild('ribgym', rib, 7);
moveNpc('ribgym', 'knuckle', 7, 1);
moveNpc('ribgym', 'help1', 3, 14, 1);
moveNpc('ribgym', 'help2', 12, 14, 3);
MAPS.ribgym.npcs.push({ id: 'ribsign', x: 2, y: 15, sprite: 'sign', name: undefined, lines: ['Knuckle polished the floor. Knuckle enjoys watching people attempt it. Signed, Knuckle.'] });
(MAPS.ribgym.triggers ||= []).push({ x: 1, y: 2, w: 14, h: 1, script: 'ribTop', when: () => !flag('top_rib') });
defScript('ribTop', hallTop('rib', 'knuckle'));
WALK_PUZZLES.push({ name: 'Rib hall', map: 'ribgym', start: [7, 15], goal: (x, y) => y <= 2, floor: 6, exits: [[7, 15]], needs: ['ice'], prize: { at: [7, 1], view: [7, 15] } });

// ---------------------------------------------------------------- Mast: gusts through the rails, and the vane that turns them

// Rails of hull cross the deck, and only gusts get Ouro through their gaps. A vane ('V') turns every gust round.
// The lift by the door shows a gust alone, and the door's vane shows the turn. The middle strip has no vane, so Ouro
// must come in with the wind already set. Fewest moves: 8 (6 rides, 2 vane turns). See Notes/puzzle-design.md.
const MAST_DECK = [
  '___________V__',
  '______________',
  'eeeeeeeeNeeeee',
  '_____EEE______',
  '____V_________',
  'eSeeeeeeeeeeee',
  '______________',
  'EE_pWWWW_p___p',
  'eeeeSeeeeSeeee',
  '________EEEpV_',
  '____EEp__W____',
  'eeeeeeeeeeNeee',
  '_V____________',
  '______________',
  '______________',
];
const TURNED: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const mast = new Canvas(16, 17, '_').border('#');
stamp(mast, 1, 1, MAST_DECK, {});
rebuild('mastgym', mast, 7);
const mastTiles = (want: (c: string) => boolean) => MAST_DECK.flatMap((r, j) => [...r].flatMap((c, i) => (want(c) ? [[i + 1, j + 1, c] as [number, number, string]] : [])));
const MAST_VANES = mastTiles(c => c === 'V').map(([x, y]) => [x, y] as [number, number]);
const mastTurned = () => !!flag('mastWind');
MAPS.mastgym.mods = mastTiles(c => !!TURNED[c]).map(([x, y, c]) => ({ x, y, ch: TURNED[c], when: mastTurned }));
(MAPS.mastgym.spots ||= []).push(...MAST_VANES.map(([x, y]) => ({ x, y, script: 'mastVane' })));
defScript('mastVane', async () => {
  setFlag('mastWind', mastTurned() ? 0 : 1);
  sfx('wind');
  field.shakeT = 4;
  await act('ouro', 'nod');
});
// Leeward keeps the deck's wind one way. Walking out of the door and back in finds it that way again.
const MAST_DOOR: [number, number][] = [[7, 15], [8, 15]];
const mastEnter = MAPS.mastgym.enter;
MAPS.mastgym.enter = 'mastDeckEnter';
defScript('mastDeckEnter', async () => {
  if (atReset(MAST_DOOR)) setFlag('mastWind', 0);
  if (mastEnter && SCRIPTS[mastEnter]) await SCRIPTS[mastEnter]();
});
moveNpc('mastgym', 'leeward', 7, 1);
moveNpc('mastgym', 'deck1', 3, 14, 1);
moveNpc('mastgym', 'deck2', 12, 14, 3);
MAPS.mastgym.npcs.push({ id: 'mastsign', x: 2, y: 15, sprite: 'sign', name: undefined, lines: ['Wind: Toward the deck!!', 'Leeward reminds us that a good sailor reads the sign before stepping into it.'] });
(MAPS.mastgym.triggers ||= []).push({ x: 1, y: 2, w: 14, h: 1, script: 'mastTop', when: () => !flag('top_mast') });
defScript('mastTop', hallTop('mast', 'leeward'));
WALK_PUZZLES.push({
  name: 'Mast hall', map: 'mastgym', start: [7, 15], goal: (x, y) => y <= 2, floor: 6,
  switches: [{ flag: 'mastWind', at: MAST_VANES }], resets: MAST_DOOR, exits: [[7, 15]], needs: ['gusts', 'switches'],
  prize: { at: [7, 1], view: [7, 15] },
});

// ---------------------------------------------------------------- Spire: bells that ring late

// A rope ('K') rings its bell a set number of moves later, and the gate ('f') under that bell stands open while it rings.
// Each rope shows its count. The rope by the door teaches the rule alone. Past the first gate, the quick bell's gate can
// be reached in time only on the draft ('W'), and the slow bell must be set going before the quick one. A ledge (';')
// drops back from each part of the nave, and walking out of the door stops every bell. Fewest moves: 24.
const SPIRE_NAVE = [
  '################',
  '#______________#',
  '#____p_____p___#',
  '###f;###########',
  '###__###########',
  '###f;###########',
  '#___WWWWWWWWWW_#',
  '#______________#',
  '#_________K__K_#',
  '#______________#',
  '#______________#',
  '#______________#',
  '#;######f#######',
  '#___K__________#',
  '#______________#',
  '################',
];
interface NaveBell { rope: [number, number]; gate: [number, number]; delay: number; ring: number; tone: number }
const NAVE_BELLS: NaveBell[] = [
  { rope: [4, 13], gate: [8, 12], delay: 2, ring: 2, tone: 12 },
  { rope: [13, 8], gate: [3, 5], delay: 1, ring: 2, tone: 7 },
  { rope: [10, 8], gate: [3, 3], delay: 6, ring: 2, tone: 0 },
];
/** Each bell: 0 silent, 1 to its delay counting down, and above its delay ringing. */
const naveBells = NAVE_BELLS.map(() => 0);
const naveRinging = (st: number[], i: number) => st[i] > NAVE_BELLS[i].delay;
const naveTick = (st: number[]) => st.map((v, i) => {
  const b = NAVE_BELLS[i];
  if (!v) return 0;
  if (v <= b.delay) return v === 1 ? b.delay + b.ring : v - 1;
  return v === b.delay + 1 ? 0 : v - 1;
});
const nave = new Canvas(16, 16, '_');
stamp(nave, 0, 0, SPIRE_NAVE, {});
rebuild('spiregym', nave, 7);
MAPS.spiregym.mods = NAVE_BELLS.map((b, i) => ({ x: b.gate[0], y: b.gate[1], ch: '_', when: () => naveRinging(naveBells, i) || (field.x === b.gate[0] && field.y === b.gate[1]) }));
MAPS.spiregym.tileTalk = { K: 'naveRope' };
defScript('naveRope', async () => {
  const [fx, fy] = field.facing();
  const i = NAVE_BELLS.findIndex(b => b.rope[0] === fx && b.rope[1] === fy);
  if (i < 0) return;
  // The rope stays taut while its bell is counting or ringing.
  if (naveBells[i]) { sound('bump'); return; }
  naveBells[i] = NAVE_BELLS[i].delay;
  sfx('ok');
  await act('ouro', 'nod');
});
field.stepHooks.push(f => {
  if (f.map.id !== 'spiregym') return;
  const was = NAVE_BELLS.map((_, i) => naveRinging(naveBells, i));
  naveTick(naveBells).forEach((v, i) => { naveBells[i] = v; });
  const rings = NAVE_BELLS.map((b, i) => (naveRinging(naveBells, i) ? b.tone : -99)).filter(t => t > -99);
  for (const t of rings) bell(t);
  if (!rings.length && naveBells.some(v => v)) sfx('blip');
  if (NAVE_BELLS.some((_, i) => naveRinging(naveBells, i) && !was[i])) f.shakeT = 4;
  if (!f.overlay) f.overlay = naveOverlay;
});
/** The count on each rope: its delay while silent, the moves left while counting, and the moves left ringing in white. */
function naveOverlay(f: typeof field): void {
  if (f.map.id !== 'spiregym') return;
  NAVE_BELLS.forEach((b, i) => {
    const x = b.rope[0] * 8 - f.cam[0], y = b.rope[1] * 8 - f.cam[1], v = naveBells[i], ring = naveRinging(naveBells, i);
    rect(x + 1, y, 7, 7, INK);
    text(String(!v ? b.delay : ring ? v - b.delay : v), x + 2, y, ring ? '#ffffff' : v ? '#f0c040' : '#8a8aa8');
  });
}
const naveEnter = MAPS.spiregym.enter;
MAPS.spiregym.enter = 'naveEnter';
defScript('naveEnter', async () => {
  naveBells.fill(0);
  field.overlay = naveOverlay;
  if (naveEnter && SCRIPTS[naveEnter]) await SCRIPTS[naveEnter]();
});
moveNpc('spiregym', 'verger', 7, 1);
moveNpc('spiregym', 'ring1', 12, 13, 3);
moveNpc('spiregym', 'ring2', 14, 11, 3);
moveNpc('spiregym', 'note', 1, 14);
{
  const note = MAPS.spiregym.npcs.find(n => n.id === 'note');
  if (note) note.lines = ['A card on the pew: "The bells hang far below and ring late. I count them. You might too.'];
}
(MAPS.spiregym.triggers ||= []).push({ x: 1, y: 1, w: 14, h: 2, script: 'spireTop', when: () => !flag('top_spire') });
defScript('spireTop', hallTop('spire', 'verger'));
{
  type NaveS = { x: number; y: number; b: number[] };
  const grid = SPIRE_NAVE.map(r => r.split(''));
  const blocked = (x: number, y: number) => MAPS.spiregym.npcs.some(n => (!n.when || n.when()) && !n.ghost && n.x === x && n.y === y);
  const moves = (s: NaveS, draft: boolean): Move<NaveS>[] => {
    const pass = (x: number, y: number) => {
      const g = NAVE_BELLS.findIndex(b => b.gate[0] === x && b.gate[1] === y);
      if (g >= 0) return naveRinging(s.b, g);
      if (!draft && 'NESW'.includes(grid[y]?.[x] ?? '#')) return false;
      return crossable(grid[y]?.[x] ?? '#', new Set()) && !blocked(x, y);
    };
    const out: Move<NaveS>[] = [];
    for (let d = 0; d < 4; d++) { const r = fieldPress(grid, s.x, s.y, d, pass); if (r) out.push({ to: { x: r[0], y: r[1], b: naveTick(s.b) }, cost: 1 }); }
    NAVE_BELLS.forEach((b, i) => {
      if (!s.b[i] && Math.abs(b.rope[0] - s.x) + Math.abs(b.rope[1] - s.y) === 1) out.push({ to: { x: s.x, y: s.y, b: s.b.map((v, k) => (k === i ? b.delay : v)) }, cost: 1 });
    });
    if (s.y === 14 && (s.x === 7 || s.x === 8)) out.push({ to: { x: 7, y: 14, b: NAVE_BELLS.map(() => 0) }, cost: 0, reset: true });
    return out;
  };
  GRAPH_PUZZLES.push({
    name: 'Spire nave', floor: 8, start: { x: 7, y: 14, b: NAVE_BELLS.map(() => 0) } as NaveS,
    key: s => `${s.x},${s.y},${s.b.join('.')}`, moves: s => moves(s, true), goal: s => s.y <= 2,
    exit: s => s.y === 14 && (s.x === 7 || s.x === 8), without: [['without the draft', s => moves(s, false)]],
    show: s => `${s.x},${s.y} bells ${s.b.join(' ')}`, prize: { map: 'spiregym', at: [7, 1], view: [7, 14] },
  });
}

// ---------------------------------------------------------------- Bole: saplings that put out roots across waxed heartwood

// Waxed heartwood ('I') slides Ouro like the Rib's bone, and posts ('p') stop a slide. Touching a sapling ('i') grows its
// root along the groove beside it, and touching it again takes the root back. A grown root stops a slide. The first slide
// stops beside a sapling, and its root is the stop that later brings Ouro round to the sapling's far side. The last slide
// runs where that root lay, so Ouro has to take it back first. Fewest moves: 15.
const BOLE_FLOOR = [
  '______________',
  '______________',
  '#########I####',
  'pIIIIIIIIIIIII',
  'IIIIIIIIIIIIII',
  'IIIIIIIIIIIIII',
  'IIIIIIpIIIIIII',
  'IIIIIIIIIIpIII',
  'IIIIIIIIIIIIII',
  'IpIIIIIIpIIIII',
  'IIIIIIIiIIIpII',
  'IIIIIIIIIiIIII',
  '########I#####',
  '______________',
  '______________',
];
interface BoleSapling { flag: string; at: [number, number]; root: [number, number][]; groove: string }
const BOLE_SAPLINGS: BoleSapling[] = [
  { flag: 'boleRoot0', at: [8, 11], root: [[8, 10], [8, 9], [8, 8]], groove: 'boleGrooveV' },
  { flag: 'boleRoot1', at: [10, 12], root: [[9, 12], [8, 12], [7, 12]], groove: 'boleGrooveH' },
];
const bole = new Canvas(16, 17, '_').border('#');
stamp(bole, 1, 1, BOLE_FLOOR, {});
rebuild('bolegym', bole, 7);
MAPS.bolegym.mods = BOLE_SAPLINGS.flatMap(s => s.root.map(([x, y]) => ({ x, y, ch: 'j', when: () => !!flag(s.flag) })));
// The groove shows where a root will grow while the root is taken back.
MAPS.bolegym.props = [...(MAPS.bolegym.props || []), ...BOLE_SAPLINGS.flatMap(s => s.root.map(([x, y]) => ({ x, y, pic: s.groove, when: () => !flag(s.flag) })))];
const groove = (down: boolean) => ({
  w: 1, h: 1,
  paint(x: number, y: number) {
    for (let k = 0; k < 8; k += 2) {
      if (down) { rect(x + 3, y + k, 2, 1, '#38180c'); rect(x + 3, y + k + 1, 2, 1, '#a8743e'); }
      else { rect(x + k, y + 3, 1, 2, '#38180c'); rect(x + k + 1, y + 3, 1, 2, '#a8743e'); }
    }
  },
});
defProp('boleGrooveV', groove(true));
defProp('boleGrooveH', groove(false));
MAPS.bolegym.tileTalk = { i: 'boleSapling' };
defScript('boleSapling', async () => {
  const [fx, fy] = field.facing();
  const s = BOLE_SAPLINGS.find(s => s.at[0] === fx && s.at[1] === fy);
  if (!s) return;
  const grown = !!flag(s.flag);
  // A root never grows through the tile Ouro stands on.
  if (!grown && s.root.some(([x, y]) => x === field.x && y === field.y)) { sound('bump'); await act('ouro', 'shiver'); return; }
  sfx('switch');
  await morph(on => { G.flags[s.flag] = (on ? !grown : grown) ? 1 : 0; }, grown ? s.root[s.root.length - 1] : s.at, 4, false);
});
const boleHallWas = MAPS.bolegym.enter;
MAPS.bolegym.enter = 'boleHallEnter';
defScript('boleHallEnter', async () => {
  for (const s of BOLE_SAPLINGS) G.flags[s.flag] = 0;
  if (boleHallWas && SCRIPTS[boleHallWas]) await SCRIPTS[boleHallWas]();
});
moveNpc('bolegym', 'grafton', 7, 1);
moveNpc('bolegym', 'graft1', 2, 14, 1);
moveNpc('bolegym', 'graft2', 13, 14, 3);
MAPS.bolegym.npcs.push({ id: 'bolesign', x: 7, y: 14, sprite: 'sign', name: undefined, lines: ['Grafton\'s note: Waxed heartwood and saplings grafted to respond to a touch! (Mind your feet.)'] });
(MAPS.bolegym.triggers ||= []).push({ x: 1, y: 2, w: 14, h: 1, script: 'boleTop', when: () => !flag('top_bole') });
defScript('boleTop', hallTop('bole', 'grafton'));
WALK_PUZZLES.push({
  name: 'Bole hall', map: 'bolegym', start: [7, 15], goal: (x, y) => y <= 2, floor: 8,
  switches: BOLE_SAPLINGS.map(s => ({ flag: s.flag, at: [s.at] })), resets: [[7, 15], [8, 15]], exits: [[7, 15]],
  needs: ['ice', 'switches'], prize: { at: [7, 1], view: [7, 15] },
});

// ---------------------------------------------------------------- Hum: current that blocks the floor it crosses

// Current runs from the socket in the west wall ('O') in straight lines, and each switching post turns it ('R' slants
// like a slash, 'Q' like a backslash). Live current ('L') blocks the floor it crosses, and a post never sends it through
// Ouro. While the current reaches the coil (the socket in the top wall), Ohm's gate ('j') stands open. The post under the
// coil turns the current north only when it arrives from the east, so the current has to run down, across, and back up
// through the doorway, and Ouro turns the corner that closes the loop from the north side. Fewest moves: 8.
const HUM_HALL = [
  '################',
  '#______________#',
  '#______________#',
  '####O#######j###',
  '#______________#',
  '#______________#',
  '#______________#',
  '####R__Q########',
  'O___R__________#',
  '#______________#',
  '#______________#',
  '#______________#',
  '#___R__Q_______#',
  '#______________#',
  '################',
];
const HUM_COIL: [number, number] = [4, 3], HUM_GATE: [number, number] = [12, 3];
const HUM_POSTS: [number, number][] = [[4, 7], [7, 7], [4, 8], [4, 12], [7, 12]];
const hum = new Canvas(16, 15, '_');
stamp(hum, 0, 0, HUM_HALL, {});
rebuild('humgym', hum, 7);
/** Whether a post slants like a slash now: its starting slant, flipped while its flag is set. */
const humSlash = (i: number) => (HUM_HALL[HUM_POSTS[i][1]][HUM_POSTS[i][0]] === 'R') !== !!flag('humPost' + i);
let humKey = '', humLive = { tiles: new Set<number>(), lit: false };
/** The tiles the current crosses for the posts as they stand, and whether it reaches the coil. */
function humCurrent(): { tiles: Set<number>; lit: boolean } {
  const key = HUM_POSTS.map((_, i) => flag('humPost' + i)).join('');
  if (key === humKey) return humLive;
  const tiles = new Set<number>();
  let x = 0, y = 8, dx = 1, dy = 0, lit = false;
  for (let n = 0; n < 200; n++) {
    x += dx; y += dy;
    if (x === HUM_COIL[0] && y === HUM_COIL[1]) { lit = true; break; }
    const p = HUM_POSTS.findIndex(([px, py]) => px === x && py === y);
    if (p >= 0) { [dx, dy] = humSlash(p) ? [-dy, -dx] : [dy, dx]; continue; }
    if (HUM_HALL[y]?.[x] !== '_') break;
    tiles.add(y * 16 + x);
  }
  humKey = key; humLive = { tiles, lit };
  return humLive;
}
MAPS.humgym.mods = [
  ...HUM_HALL.flatMap((r, y) => [...r].flatMap((c, x) => (c === '_' && y >= 4 ? [{ x, y, ch: 'L', when: () => humCurrent().tiles.has(y * 16 + x) }] : []))),
  ...HUM_POSTS.map(([x, y], i) => ({ x, y, ch: HUM_HALL[y][x] === 'R' ? 'Q' : 'R', when: () => !!flag('humPost' + i) })),
  { x: HUM_GATE[0], y: HUM_GATE[1], ch: '_', when: () => humCurrent().lit },
];
field.passHooks.push((f, _x, _y, ch) => (f.map.id === 'humgym' && ch === 'L' ? false : null));
MAPS.humgym.tileTalk = { R: 'humPost', Q: 'humPost' };
defScript('humPost', async () => {
  const [fx, fy] = field.facing();
  const i = HUM_POSTS.findIndex(([x, y]) => x === fx && y === fy);
  if (i < 0) return;
  const k = 'humPost' + i, old = G.flags[k] || 0, was = humCurrent().lit;
  G.flags[k] = 1 - old;
  const through = humCurrent().tiles.has(field.y * 16 + field.x);
  G.flags[k] = old;
  // A post never sends the current through Ouro.
  if (through) { sound('bump'); await act('ouro', 'shiver'); return; }
  sfx('switch');
  await morph(on => { G.flags[k] = on ? 1 - old : old; }, [fx, fy], 2, false);
  if (!was && humCurrent().lit) { sound('fit'); await payoff(HUM_GATE); }
});
const HUM_DOOR: [number, number][] = [[7, 13], [8, 13]];
const humWas = MAPS.humgym.enter;
MAPS.humgym.enter = 'humHallEnter';
defScript('humHallEnter', async () => {
  if (atReset(HUM_DOOR)) HUM_POSTS.forEach((_, i) => { G.flags['humPost' + i] = 0; });
  if (humWas && SCRIPTS[humWas]) await SCRIPTS[humWas]();
});
moveNpc('humgym', 'ohm', 7, 1);
moveNpc('humgym', 'ohm1', 2, 10, 1);
moveNpc('humgym', 'ohm2', 13, 10, 3);
MAPS.humgym.npcs.push({ id: 'humsign', x: 10, y: 13, sprite: 'sign', name: undefined, lines: ['Tinker\'s chalk: The posts divert the current. Do not stand in it.', 'Ohm\'s gate opens while the coil hums.'] });
(MAPS.humgym.triggers ||= []).push({ x: 1, y: 2, w: 14, h: 1, script: 'humTop', when: () => !flag('top_hum') });
defScript('humTop', hallTop('hum', 'ohm'));
WALK_PUZZLES.push({
  name: 'Hum hall', map: 'humgym', start: [7, 13], goal: (x, y) => y <= 2, floor: 8,
  switches: HUM_POSTS.map((p, i) => ({ flag: 'humPost' + i, at: [p] })), solid: 'L', resets: HUM_DOOR, exits: [[7, 13]],
  needs: ['switches'], prize: { at: [7, 1], view: [7, 13] },
});

// ---------------------------------------------------------------- Tusk: young Amber walks the other way, and two plates

// Ouro walks the left pen, and young Amber copies each step in the right pen, mirrored left to right. A plate holds the
// door of its color in the other pen open while someone stands on it: her gold plate opens Ouro's gold door, and his blue
// plate opens her blue door. A door also stays open while someone stands in it. Her mark ('m') lies behind her door, and
// his plate behind his. A wall that stops her while Ouro walks on puts her out of step with him. The route walks her into
// a wall to bring her onto her plate as Ouro reaches his door, and into another to keep her there as he steps through.
// Then Ouro steps onto his plate in the same step that she steps into her door. Fewest moves: 12.
const TUSK_L = ['__#__', '__#_p', '___d#', '_____', '_____'];
const TUSK_R = ['m#___', 'd__#_', '#p#_#', '_____', '_____'];
const TL = { x: 2, y: 6 }, TR = { x: 10, y: 6 }, YOUNG0 = { x: 12, y: 10 }, TUSK_GATE: [number, number] = [12, 3];
const penAt = (pen: string[], b: { x: number; y: number }, x: number, y: number) => pen[y - b.y]?.[x - b.x];
const tuskFind = (pen: string[], b: { x: number; y: number }, ch: string): [number, number] => {
  const y = pen.findIndex(r => r.includes(ch));
  return [b.x + pen[y].indexOf(ch), b.y + y];
};
const OURO_PLATE = tuskFind(TUSK_L, TL, 'p'), OURO_DOOR = tuskFind(TUSK_L, TL, 'd');
const AMBER_PLATE = tuskFind(TUSK_R, TR, 'p'), AMBER_DOOR = tuskFind(TUSK_R, TR, 'd');
const tusk = new Canvas(18, 15, '_').border('#');
tusk.rect(1, 3, 16, 1, 'c');
tusk.frame(1, 5, 7, 7, '#').put(4, 11, '_');
tusk.frame(9, 5, 7, 7, '#');
stamp(tusk, TL.x, TL.y, TUSK_L, { d: 'j', p: '_' });
stamp(tusk, TR.x, TR.y, TUSK_R, { d: 'j', p: '_', m: 'b' });
rebuild('tuskgym', tusk, 8);
const youngNow = () => field.npcs?.find(n => n.def.id === 'youngtallow');
const amberOn = ([x, y]: [number, number]) => { const s = youngNow(); return !!s && s.x === x && s.y === y; };
const ouroOn = ([x, y]: [number, number]) => field.map?.id === 'tuskgym' && field.x === x && field.y === y;
MAPS.tuskgym.mods = [
  { x: TUSK_GATE[0], y: TUSK_GATE[1], ch: '_', when: () => !!flag('youngTallow') },
  // Once she is home, both doors stay open, so Ouro can walk out of the nook.
  { x: OURO_DOOR[0], y: OURO_DOOR[1], ch: '_', when: () => !!flag('youngTallow') || amberOn(AMBER_PLATE) || ouroOn(OURO_DOOR) },
  { x: AMBER_DOOR[0], y: AMBER_DOOR[1], ch: '_', when: () => !!flag('youngTallow') || ouroOn(OURO_PLATE) || amberOn(AMBER_DOOR) },
];
/** A plate set in the floor, its color the color of the door it opens, pressed down while someone stands on it. */
const tuskPlate = (rim: string, top: string, weighed: () => boolean) => ({
  w: 1, h: 1,
  paint(x: number, y: number) {
    const down = weighed() ? 1 : 0;
    rect(x, y, 8, 8, INK);
    rect(x + 1, y + down, 6, 7 - down, rim);
    rect(x + 2, y + 1 + down, 4, 4 - down, top);
  },
});
/** The stud on a door, in the color of the plate that opens it. */
const tuskStud = (c: string) => ({ w: 1, h: 1, paint(x: number, y: number) { rect(x + 2, y + 2, 4, 4, INK); rect(x + 3, y + 3, 2, 2, c); } });
defProp('tuskPlateGold', tuskPlate('#a07818', '#e8b828', () => amberOn(AMBER_PLATE)));
defProp('tuskPlateBlue', tuskPlate('#2a5a9a', '#6ab4f4', () => ouroOn(OURO_PLATE)));
defProp('tuskStudGold', tuskStud('#e8b828'));
defProp('tuskStudBlue', tuskStud('#6ab4f4'));
MAPS.tuskgym.props = [
  ...(MAPS.tuskgym.props || []),
  { x: AMBER_PLATE[0], y: AMBER_PLATE[1], pic: 'tuskPlateGold' }, { x: OURO_PLATE[0], y: OURO_PLATE[1], pic: 'tuskPlateBlue' },
  { x: OURO_DOOR[0], y: OURO_DOOR[1], pic: 'tuskStudGold' }, { x: AMBER_DOOR[0], y: AMBER_DOOR[1], pic: 'tuskStudBlue' },
];
moveNpc('tuskgym', 'tallow', 8, 1);
moveNpc('tuskgym', 'tg1', 16, 12, 3);
MAPS.tuskgym.npcs.push({ id: 'youngtallow', x: YOUNG0.x, y: YOUNG0.y, sprite: 'child', name: 'Young Amber', dir: 0, talk: 'youngTallow',
  img: () => ({ px: ['..111...', '.12221..', '.12121..', '..1221..', '.133.31.', '1.3333.1', '..3333..', '..1..1..'], c: ['#ece4d0', '#c8d4e0'] }) });
const TDX = [0, 1, 0, -1], TDY = [1, 0, -1, 0];
/** Whether young Amber can step onto a tile of her pen, with Ouro standing where he now stands. */
const amberCan = (x: number, y: number, ouroOnPlate: boolean) => {
  const c = penAt(TUSK_R, TR, x, y);
  return c === '_' || c === 'p' || c === 'm' || (c === 'd' && ouroOnPlate);
};
field.stepHooks.push(f => {
  if (f.map.id !== 'tuskgym' || flag('youngTallow')) return;
  const s = youngNow();
  if (!s) return;
  if (penAt(TUSK_L, TL, f.x, f.y) === undefined) { s.x = YOUNG0.x; s.y = YOUNG0.y; return; }
  const d = f.lastStep, nx = s.x - TDX[d], ny = s.y + TDY[d];
  // She copies only the steps taken inside the pen, so the step in leaves her where she starts.
  if (penAt(TUSK_L, TL, f.x - TDX[d], f.y - TDY[d]) === undefined) return;
  if (amberCan(nx, ny, ouroOn(OURO_PLATE))) { s.x = nx; s.y = ny; }
  if (penAt(TUSK_R, TR, s.x, s.y) === 'm') void f.runBusy(SCRIPTS.youngTallowHome);
});
defScript('youngTallow', async () => { await act('youngtallow', 'nod'); await hint('Old Amber\'s first shell mimics each of Ouro\'s steps, but in reverse.'); });
defScript('youngTallowHome', async () => {
  // The young cast stops on the worn spot where Amber stood on her Turning Day, and the rail at the top of the hall lifts.
  sfx('heal');
  await act('youngtallow', 'bow');
  await payoff(TUSK_GATE, 'youngTallow');
});
MAPS.tuskgym.npcs.push({ id: 'tusksign', x: 2, y: 12, sprite: 'sign', name: undefined, lines: ['Walk the left pen. She walks the right one. She has always been contrary. (A.)'] });
(MAPS.tuskgym.triggers ||= []).push({ x: 1, y: 2, w: 16, h: 1, script: 'tuskTop', when: () => !flag('top_tusk') });
defScript('tuskTop', hallTop('tusk', 'tallow'));
{
  type TuskS = { ox: number; oy: number; ax: number; ay: number };
  const start: TuskS = { ox: 4, oy: 10, ax: YOUNG0.x, ay: YOUNG0.y };
  const moves = (s: TuskS, plates: boolean): Move<TuskS>[] => {
    const out: Move<TuskS>[] = [];
    for (let d = 0; d < 4; d++) {
      const nx = s.ox + TDX[d], ny = s.oy + TDY[d];
      // Walking out of the pen sends her back to her start.
      if (penAt(TUSK_L, TL, nx, ny) === undefined) { if (s.ox === 4 && s.oy === 10 && d === 0) out.push({ to: start, cost: 0, reset: true }); continue; }
      const c = penAt(TUSK_L, TL, nx, ny);
      if (!(c === '_' || c === 'p' || (c === 'd' && plates && s.ax === AMBER_PLATE[0] && s.ay === AMBER_PLATE[1]))) continue;
      const tx = s.ax - TDX[d], ty = s.ay + TDY[d];
      const on = plates && nx === OURO_PLATE[0] && ny === OURO_PLATE[1];
      out.push({ to: amberCan(tx, ty, on) ? { ox: nx, oy: ny, ax: tx, ay: ty } : { ox: nx, oy: ny, ax: s.ax, ay: s.ay }, cost: 1 });
    }
    return out;
  };
  GRAPH_PUZZLES.push({
    name: 'Tusk pens', floor: 10, start, key: s => `${s.ox},${s.oy},${s.ax},${s.ay}`, moves: s => moves(s, true),
    goal: s => penAt(TUSK_R, TR, s.ax, s.ay) === 'm', exit: s => s.ox === 4 && s.oy === 10,
    without: [['without the plates', s => moves(s, false)]],
    show: s => `Ouro ${s.ox},${s.oy} Amber ${s.ax},${s.ay}`, prize: { map: 'tuskgym', at: TUSK_GATE, view: [4, 10] },
  });
}

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
GUARDS.forEach((g, i) => MAPS.hiltgym.npcs.push({ id: 'guard' + i, blocks: true, x: g.x0, y: g.y, sprite: 'keeper', name: 'Guard on drill', dir: 1, lines: ['Eyes forward. Three paces. Turn.'] }));
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
  await say('Guard on drill', 'Hey. You. Head back to the door.');
  hiltT = 0;
  field.x = 8; field.y = 15; field.px = 64; field.py = 120; field.dir = 2;
  placeGuards();
});
MAPS.hiltgym.npcs.push({ id: 'hiltsign', x: 8, y: 15, sprite: 'sign', name: undefined, lines: ['The drill: three paces of sight. Move only when they turn their backs. If seen, head for the door.'] });
moveNpc('hiltgym', 'hiltsign', 4, 15);
(MAPS.hiltgym.triggers ||= []).push({ x: 1, y: 1, w: 14, h: 1, script: 'hiltTop', when: () => !flag('top_hilt') });
defScript('hiltTop', hallTop('hilt', 'quillon'));

// ---------------------------------------------------------------- Fall: round stones in the dark

// A round stone ('o') rolls until something stops it, and the hole ('O') in the wall under Perihel's floor swallows one
// and becomes ground. A stone that rolls into the hole has to come from right under it, and nothing stops a stone there
// but another stone. Rolled west along the top row, the first stone stops at the wall, the second against the first, and
// the third under the hole. Walking out of the field rolls every stone back. Fewest moves: 11.
const FALL_HALL = [
  '################',
  '#______________#',
  '#______________#',
  '###O############',
  '#______________#',
  '#______o_______#',
  '#______#_______#',
  '#_________#____#',
  '#_____o______#_#',
  '#_____#__o_____#',
  '#________#_____#',
  '#______________#',
  '#______________#',
  '#______________#',
  '####_###########',
  '#______________#',
  '#______________#',
  '################',
];
const fall = new Canvas(16, 18, '_');
stamp(fall, 0, 0, FALL_HALL, {});
rebuild('fallgym', fall, 7);
MAPS.fallgym.dark = true;
MAPS.fallgym.basin = { x: 1, y: 1, w: 14, h: 13, flag: 'fallSolved', done: (_x, y) => y <= 2 };
moveNpc('fallgym', 'perihel', 7, 1);
moveNpc('fallgym', 'sw1', 1, 15, 1);
moveNpc('fallgym', 'sw2', 14, 15, 3);
MAPS.fallgym.npcs.push({ id: 'fallsign', x: 10, y: 16, sprite: 'sign', name: undefined, lines: ['Perihel keeps the hall dark. A star-type whorl worn at the front illuminates it.', 'You will have read this.'] });
(MAPS.fallgym.triggers ||= []).push({ x: 1, y: 2, w: 14, h: 1, script: 'fallTop', when: () => !flag('top_fall') });
defScript('fallTop', hallTop('fall', 'perihel'));
{
  const W = 16, D4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const hole = 3 * W + 3, entry = 16 * W + 7;
  const wall = (i: number) => { const c = FALL_HALL[Math.floor(i / W)]?.[i % W]; return c === undefined || c === '#' || (i === hole); };
  const stones0 = FALL_HALL.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'o' ? [y * W + x] : [])));
  type FallS = { o: number; st: number[]; filled: boolean };
  /** The tiles Ouro can walk to, which joins every state that differs only by walking. */
  const region = (o: number, st: number[], filled: boolean) => {
    const seen = new Set([o]), q = [o];
    while (q.length) {
      const c = q.pop()!;
      for (const [dx, dy] of D4) {
        const n = c + dx + dy * W;
        if (seen.has(n) || st.includes(n) || (wall(n) && !(n === hole && filled))) continue;
        seen.add(n); q.push(n);
      }
    }
    return seen;
  };
  const canon = (o: number, st: number[], filled: boolean): FallS => {
    const reg = region(o, st, filled);
    return { o: Math.min(...reg), st: [...st].sort((a, b) => a - b), filled };
  };
  const start = canon(entry, stones0, false);
  const moves = (s: FallS): Move<FallS>[] => {
    const reg = region(s.o, s.st, s.filled), out: Move<FallS>[] = [];
    s.st.forEach((p, k) => {
      for (const [dx, dy] of D4) {
        const from = p - dx - dy * W;
        if (!reg.has(from)) continue;
        let c = p, into = false;
        for (;;) {
          const n = c + dx + dy * W;
          if (n === hole && !s.filled) { c = n; into = true; break; }
          if ((wall(n) && !(n === hole && s.filled)) || s.st.includes(n) || n === from) break;
          c = n;
        }
        if (c === p) continue;
        const st = into ? s.st.filter((_, j) => j !== k) : s.st.map((v, j) => (j === k ? c : v));
        out.push({ to: canon(from, st, s.filled || into), cost: 1 });
      }
    });
    if (reg.has(entry)) out.push({ to: start, cost: 0, reset: true });
    return out;
  };
  GRAPH_PUZZLES.push({
    name: 'Fall hall', floor: 10, start, key: (s: FallS) => `${s.o}|${s.st.join(',')}|${s.filled ? 1 : 0}`, moves,
    goal: (s: FallS) => [...region(s.o, s.st, s.filled)].some(i => i < 3 * W), exit: (s: FallS) => region(s.o, s.st, s.filled).has(entry),
    without: [['with the stones fixed', (s: FallS) => moves(s).filter(m => m.reset)]],
    show: (s: FallS) => `stones ${s.st.map((i: number) => `${i % W},${Math.floor(i / W)}`).join(' ')}${s.filled ? ', hole filled' : ''}`,
    prize: { map: 'fallgym', at: [7, 1], view: [7, 16] },
  });
}

// ---------------------------------------------------------------- back doors

/**
 * Several halls only solve from the door to the keeper, such as the Rib's slides. Once the hall's pearl is won, a door
 * opens in the back wall two tiles from the keeper and leads out to the town.
 */
const HALL_PEARL: Record<string, [string, string]> = {
  ribgym: ['knuckle', 'rib'], mastgym: ['', 'mast'], bolegym: ['grafton', 'bole'], humgym: ['ohm', 'pylon'],
  tuskgym: ['tallow', 'tusk'], hiltgym: ['', 'hilt'], spiregym: ['verger', 'spire'],
};
for (const [id, [keeperId, pearl]] of Object.entries(HALL_PEARL)) {
  const m = MAPS[id];
  if (!m) continue;
  const keeper = m.npcs.find(n => n.id === keeperId) || m.npcs.find(n => n.y <= 2) || { x: 7 };
  const x = [keeper.x + 2, keeper.x - 2].find(x => m.rows[1]?.[x] === '_');
  if (x === undefined) continue;
  const won = () => G.scales.includes(pearl);
  const out = m.warps[0];
  (m.mods ||= []).push({ x, y: 0, ch: 'd', when: won });
  m.warps.push({ x, y: 0, to: out.to, tx: out.tx, ty: out.ty, dir: out.dir ?? 2, when: won });
}
