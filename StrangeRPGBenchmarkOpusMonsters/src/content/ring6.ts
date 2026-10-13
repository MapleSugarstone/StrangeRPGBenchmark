// Region 6 of the ring: the Floes and puzzle 8, the rememberer's house and puzzle 9 (the grandmother's way) in Tusk's snowfield.
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { field, flag, say, setFlag, wait } from '../game/api';
import { defProp } from '../game/props';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { GRAPH_PUZZLES, type Move } from '../tools/worldcheck';
import { kinds, look, reward, stash } from './areakit';
import { giveKeyItem, hasKey, room, roomDoor } from './ring';
import { holmSeen } from './ring3';

// ---------------------------------------------------------------- the Floes and puzzle 8

defMap({
  id: 'floes', name: 'The Floes', region: 40, music: 'floes',
  rows: [
    '############################################',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#####p#####~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#*~~*.~~*~#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#*~~~~*~~*#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~**#~~~~##~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~~~#*~~**#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~~~~~~#**#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~*~~#*~~~#~~~~~~~~~~~~~~~~#',
    '#IIIIIIIIIIIIIII#~~~~~~*#~#IIIIIIIIIIIIIIII#',
    '#IIIIIIIIIIIIIII#.........#IIIIIIIIIIIIIIII#',
    '#nnnnnnnnnnnnnnnnnnnn=nnnnnnnnnnnnnnnnnnnnn#',
    '#nnnnnnTnnTnnnnnnnnnn=nnnnTTnnnnnnnnnnnnnnn#',
    '#nnnnnnnTnnnnTnnTn,,,=,nnnnnnnnnnnTnnnnnnTn#',
    '#nnnnnnnnnnnTnnn,,,,,=,,,nnnnTnnnnnnnnnnnnn#',
    '#nnnnnnTnnnnnnnnnn,,,=,nnnTnnnnnnnnnnnnnnnn#',
    '#nTnnnnnnnnnnnTnnnnnn=nnnnnnTnTTTnnnnnnnnTn#',
    '============================================',
    '#nnnnTTnnnnnnnnnnnnnnnnnnTnTTnnnnnnnnnnTnnn#',
    '#nnnnT,,,,,nnnTnnTnnnnnnnnnnnT,,,,,Tnnnnnnn#',
    '#nn,,,,,,,,,,,nnnnnnnnnnnnn,,,,,,,,,,,nnnnn#',
    '#n,,,,,,,,,,,,,Tnnnnnnnnnn,,,,,,,,,,,,,nnnn#',
    '#nn,,,,,,,,,,,nnnnnnnnTnnnn,,,,,,,,,,,nnnnT#',
    '#nnnnn,,,,,TnTnnnnnnnnnnnnnnnn,,,,,nnnnTnnn#',
    '#nnnnnTnnnnnnnnnnTnnnnnnnnnnnnnnnnnnnnTTnTn#',
    '#nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn#',
    '############################################',
  ],
  warps: [
    { x: 0, y: 18, to: 'hum', tx: 42, ty: 8, dir: 3 },
    { x: 43, y: 18, to: 'tusk', tx: 1, ty: 26, dir: 1 },
  ],
  zone: { kinds: kinds([['floe', 3], ['selkie', 2], ['walrus', 2], ['auk', 3], ['rime', 1]]), lv: [33, 37], n: 10, area: 'drift' },
  props: [{ x: 21, y: 3, pic: 'frozentub', when: () => !hasKey('lore_tub') && !flag('back_lore_tub') }, { x: 34, y: 4, pic: 'holmfar', when: holmSeen(6) }],
  npcs: [
    { id: 'icefisher2', x: 12, y: 14, sprite: 'veryold', name: 'Floe-watcher', dir: 1, lines: ['Step on a floe and it goes where you stepped till it hits something. Then it stays. Then it\'s a floor.', 'Swim it? That slush? Nothing swims that slush. Not even the ones that swim.'] },
    { id: 'floetrainer', x: 31, y: 19, sprite: 'villager2', name: 'Sealer', dir: 2, trainer: { name: 'Sealer', team: [['selkie', 35], ['walrus', 35]], intro: 'I count seals. These ones are casts. They count too, I reckon. Mostly they count me.', defeat: 'Seventeen, then. And you.', sight: 3 } },
  ],
  spots: [
    { x: 21, y: 3, when: () => !hasKey('lore_tub') && !flag('back_lore_tub'), script: async () => { sfx('cut'); field.shakeT = 6; await wait(20); await giveKeyItem('lore_tub', 'Ouro chips a washtub out of the ice. The washing in it is fine.'); } },
    stash('fl_grey', 40, 25, 'Under a snowed-over boat, a gray lump that smells of a very big afternoon.', { items: [['ambergris', 1]] }),
    look(10, 11, 'The ice creaks underfoot. Past it, the Lipwater, and past that, the Lip.'),
  ],
});
SPAWNS.floes = [1, 18];

// The field's water is slush, so a TIDE whorl worn cannot swim to the tub. Only the floes cross it.
field.passHooks.push((f, x, y, ch) => (f.map.id === 'floes' && ch === '~' && x > 16 && x < 26 && y > 3 && y < 11 ? false : null));

defProp('frozentub', {
  w: 1, h: 1,
  paint(x, y) { rect(x + 1, y + 3, 6, 4, '#a8b8c8'); rect(x + 1, y + 3, 6, 1, '#e8f0f8'); rect(x + 3, y + 2, 2, 1, '#f4f4f4'); rect(x, y + 6, 8, 2, '#dcecf8'); },
});

// The floes for the puzzle checks: where Ouro stands (the lowest tile of the land Ouro is on, or the floe Ouro is on)
// and where each floe lies. A step onto a floe that carries it is a ride and costs a move. Walking out of the map puts
// every floe back, so the shore can always start over.
{
  type FloeState = { o: number; fl: number[] };
  const m = MAPS.floes, W = m.rows[0].length;
  const X0 = 16, Y0 = 3, X1 = 26, SHORE = 11, ROCK = 4 * W + 21;
  const at = (i: number) => m.rows[Math.floor(i / W)]?.[i % W] ?? '#';
  const inField = (i: number) => { const x = i % W, y = Math.floor(i / W); return x >= X0 && x <= X1 && y >= Y0 && y <= SHORE; };
  const water = (i: number) => inField(i) && (at(i) === '~' || at(i) === '*');
  const land = (i: number) => inField(i) && at(i) === '.';
  const fl0: number[] = [];
  for (let i = 0; i < W * m.rows.length; i++) if (at(i) === '*') fl0.push(i);
  const landOf = (i: number) => { const seen = new Set([i]), q = [i]; while (q.length) { const c = q.pop()!; for (const s of [1, -1, W, -W]) if (land(c + s) && !seen.has(c + s)) { seen.add(c + s); q.push(c + s); } } return seen; };
  const place = (o: number) => (land(o) ? Math.min(...landOf(o)) : o);
  const start: FloeState = { o: place(SHORE * W + 21), fl: fl0 };
  const moves = (s: FloeState, ride = true): Move<FloeState>[] => {
    const out: Move<FloeState>[] = [];
    const here = land(s.o) ? [...landOf(s.o)] : [s.o];
    if (here.some(i => Math.floor(i / W) === SHORE)) out.push({ to: start, cost: 0, reset: true });
    for (const c of here) for (const step of [1, -1, W, -W]) {
      const n = c + step, fi = s.fl.indexOf(n);
      if (fi < 0) { if (land(n) && !land(s.o)) out.push({ to: { o: place(n), fl: s.fl }, cost: 0 }); continue; }
      let e = n;
      while (water(e + step) && !s.fl.includes(e + step)) e += step;
      if (e !== n && !ride) continue;
      const fl = s.fl.slice(); fl[fi] = e;
      out.push({ to: { o: e, fl }, cost: e === n ? 0 : 1 });
    }
    return out;
  };
  GRAPH_PUZZLES.push({
    name: 'The Floes', floor: 10, start,
    key: (s: FloeState) => `${s.o}|${[...s.fl].sort((a, b) => a - b).join()}`,
    moves: (s: FloeState) => moves(s),
    goal: (s: FloeState) => s.o === ROCK,
    exit: (s: FloeState) => land(s.o) && [...landOf(s.o)].some(i => Math.floor(i / W) === SHORE),
    without: [['with the floes fixed', (s: FloeState) => moves(s, false)]],
    show: (s: FloeState) => `Ouro ${s.o % W},${Math.floor(s.o / W)} floes ${s.fl.map(i => `${i % W},${Math.floor(i / W)}`).join(' ')}`,
    prize: { map: 'floes', at: [21, 3], view: [21, 11] },
  });
}

// ---------------------------------------------------------------- Tusk's snowfield and puzzle 9

/** The grandmother's way: north from the edge of town, east along the drift with the stick, past the capped stone, on to the second dead pine. */
const WAY: [number, number][] = [[20, 16], [20, 15], [20, 14], [20, 13], [20, 12], [20, 11], [20, 10], [21, 10], [22, 10], [23, 10], [24, 10], [25, 10], [26, 10],
  [27, 10], [28, 10], [29, 10], [30, 10], [31, 10], [31, 9], [31, 8], [31, 7], [31, 6], [31, 5], [32, 5]];
const onWay = (x: number, y: number) => WAY.some(([a, b]) => a === x && b === y);
/** The steps of the way that stand by a landmark the directions name: the turn east, the stick, the capped stone, the first pine. */
const WAY_MARKS = [0, 6, 10, 15, 19];
let wayFar = 0;

// A wrong turn in the drifts takes Ouro back, under a fade, to the last landmark Ouro reached on the way.
field.stepHooks.push(f => {
  if (f.map.id !== 'tusk' || f.y > 16 || f.y < 1) { if (f.map.id === 'tusk' && f.y > 16) wayFar = 0; return; }
  const i = WAY.findIndex(([a, b]) => a === f.x && b === f.y);
  if (i >= 0) { wayFar = Math.max(wayFar, i); return; }
  const mark = WAY_MARKS.filter(k => k <= wayFar).pop() ?? 0, [mx, my] = WAY[mark];
  void f.runBusy(async () => {
    sfx('wind');
    f.fade = 12;
    f.x = mx; f.y = my; f.px = mx * 8; f.py = my * 8; f.placeFollower();
    await wait(14);
  });
});

defProp('tuskway', {
  w: 1, h: 1,
  paint(x, y) {
    // The Tusk's shadow on the snow, lying west of the way at row 10.
    const ox = x - 20 * 8, oy = y - 10 * 8;
    for (let k = 0; k < 4; k++) for (let j = 0; j < 8; j += 2) rect(ox + (15 + k) * 8 + j, oy + 10 * 8 + (k & 1) * 2, 1, 6, '#8aa0c0');
    // The stick in the drift.
    rect(ox + 24 * 8 + 3, oy + 9 * 8 - 4, 1, 9, '#6a4a2a'); rect(ox + 24 * 8 + 2, oy + 9 * 8 - 4, 3, 1, '#6a4a2a');
    // The stone with two caps of snow.
    rect(ox + 29 * 8 + 1, oy + 11 * 8 + 2, 6, 5, '#6a7080'); rect(ox + 29 * 8 + 1, oy + 11 * 8 + 1, 2, 2, '#ffffff'); rect(ox + 29 * 8 + 5, oy + 11 * 8 + 1, 2, 2, '#ffffff');
    // Two dead pines: bare trunks with a few gray branches.
    for (const [px, py] of [[32, 8], [33, 5]]) { rect(ox + px * 8 + 3, oy + py * 8 - 6, 2, 13, '#4a3a30'); for (let b = 0; b < 3; b++) rect(ox + px * 8 + 1 + (b & 1) * 4, oy + py * 8 - 4 + b * 3, 3, 1, '#6a5a50'); }
  },
});
MAPS.tusk.props = [...(MAPS.tusk.props || []), { x: 20, y: 10, pic: 'tuskway' }];
(MAPS.tusk.spots ||= []).push(
  { x: 33, y: 5, when: () => !flag('found_tusk_spoons'), script: async () => { setFlag('found_tusk_spoons'); sfx('cut'); await wait(20); await reward({ notion: 'riderspoon', items: [['ambergris', 1]], tan: 4 }); } },
);

// The rememberer says "and then" between every part of a memory, as if reading it off a list.
defMap({
  id: 'tuskhouse', name: 'The rememberer\'s house', region: 11, indoor: true, music: 'home',
  rows: room(['________', '_cc_____', '________', '________', '________', '________']),
  warps: roomDoor('tusk', 26, 22),
  npcs: [{ id: 'rememberer', x: 5, y: 2, sprite: 'veryold', name: 'Rememberer', dir: 3, talk: 'rememberer' }],
});

defScript('rememberer', async () => {
  if (flag('found_tusk_spoons')) { await say('Rememberer', 'You found the spoons. And then I remembered I never liked the spoons. And then I laughed.'); return; }
  if (!flag('wayTold')) {
    setFlag('wayTold');
    await say('Rememberer', 'My grandmother\'s grandmother hid the good spoons from the Riders. And then she told it down to me.');
  }
  await say('Rememberer', 'North from the last house. And then on, till the Tusk\'s shadow lies to your left.');
  await say('Rememberer', 'Along the drift with the stick in it. And then past the stone with two caps of snow.');
  await say('Rememberer', 'And then on to the second dead pine. Not the first. She was very clear. The second.');
  await say('Rememberer', 'The drifts all look alike out there. Go wrong and you\'re back at the houses. And then ask me again.');
});

void stash;
