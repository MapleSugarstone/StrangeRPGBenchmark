// Region 6 of the ring: the Floes and puzzle 8, the rememberer's house and puzzle 9 (the grandmother's way) in Tusk's snowfield.
import { sfx } from '../engine/audio';
import { rect } from '../engine/screen';
import { field, flag, say, setFlag, wait } from '../game/api';
import { defProp } from '../game/props';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { PUZZLE_DATA } from '../tools/worldcheck';
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
    '#~~~~~~~~~~~~~~~#~~~~.~~~~#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~#~~~~~~~#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~~*~~*~~~#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~~~~*#~#~#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~~#~~~~~~#~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~#~~~~~~~~~#~~~~~~~~~~~~~~~~#',
    '#IIIIIIIIIIIIIII#~*~~~~~~~#IIIIIIIIIIIIIIII#',
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
    { id: 'icefisher2', x: 12, y: 14, sprite: 'veryold', name: 'Floe-watcher', dir: 1, lines: ['Step on a floe and it goes where you stepped till it hits something. Then it stays. Then it\'s a floor.'] },
    { id: 'floetrainer', x: 31, y: 19, sprite: 'villager2', name: 'Sealer', dir: 2, trainer: { name: 'Sealer', team: [['selkie', 35], ['walrus', 35]], intro: 'I count seals. These ones are casts. They count too, I reckon. Mostly they count me.', defeat: 'Seventeen, then. And you.', sight: 3 } },
  ],
  spots: [
    { x: 21, y: 3, when: () => !hasKey('lore_tub') && !flag('back_lore_tub'), script: async () => { sfx('cut'); field.shakeT = 6; await wait(20); await giveKeyItem('lore_tub', 'Ouro chips a washtub out of the ice. The washing in it is fine.'); } },
    stash('fl_grey', 40, 25, 'Under a snowed-over boat, a gray lump that smells of a very big afternoon.', { items: [['ambergris', 1]] }),
    look(10, 11, 'The ice creaks underfoot. Past it, the Lipwater, and past that, the Lip.'),
  ],
});
SPAWNS.floes = [1, 18];

defProp('frozentub', {
  w: 1, h: 1,
  paint(x, y) { rect(x + 1, y + 3, 6, 4, '#a8b8c8'); rect(x + 1, y + 3, 6, 1, '#e8f0f8'); rect(x + 3, y + 2, 2, 1, '#f4f4f4'); rect(x, y + 6, 8, 2, '#dcecf8'); },
});

PUZZLE_DATA.extra.push(() => {
  // Ouro starts anywhere on the shore under the field and must stand on the tub's rock. Breadth first over Ouro and the floes.
  const m = MAPS.floes;
  const X0 = 16, Y0 = 3, rock = [21, 4], shoreY = 11;
  const water = (x: number, y: number) => m.rows[y]?.[x] === '~' || m.rows[y]?.[x] === '*';
  const land = (x: number, y: number) => m.rows[y]?.[x] === '.';
  const floes0: [number, number][] = [];
  m.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '*') floes0.push([x, y]); });
  const solve = (start: [number, number]) => {
    const key = (o: number[], fl: number[][]) => o.join() + '|' + fl.map(p => p.join()).sort().join(';');
    const seen = new Set([key(start, floes0)]);
    let frontier: [number[], number[][]][] = [[start, floes0]];
    for (let d = 0; frontier.length && d < 40; d++) {
      const next: [number[], number[][]][] = [];
      for (const [o, fl] of frontier) {
        if (o[0] === rock[0] && o[1] === rock[1]) return d;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = o[0] + dx, ny = o[1] + dy, f2 = fl;
          const fi = fl.findIndex(p => p[0] === nx && p[1] === ny);
          if (fi >= 0) {
            f2 = fl.map(p => p.slice());
            while (water(nx + dx, ny + dy) && !f2.some(p => p[0] === nx + dx && p[1] === ny + dy)) { nx += dx; ny += dy; }
            f2[fi] = [nx, ny];
          } else if (!land(nx, ny) || ny > shoreY || nx < X0 || nx > X0 + 10 || ny < Y0) continue;
          const k = key([nx, ny], f2);
          if (seen.has(k)) continue;
          seen.add(k); next.push([[nx, ny], f2]);
        }
      }
      frontier = next;
    }
    return -1;
  };
  for (let x = X0 + 1; x < X0 + 10; x++) if (solve([x, shoreY]) < 0) return `puzzle 8: the tub's rock cannot be reached from the shore at ${x},${shoreY}`;
  return null;
});

// ---------------------------------------------------------------- Tusk's snowfield and puzzle 9

/** The grandmother's way: north from the edge of town, east along the drift with the stick, past the capped stone, on to the second dead pine. */
const WAY: [number, number][] = [[20, 16], [20, 15], [20, 14], [20, 13], [20, 12], [20, 11], [20, 10], [21, 10], [22, 10], [23, 10], [24, 10], [25, 10], [26, 10],
  [27, 10], [28, 10], [29, 10], [30, 10], [31, 10], [31, 9], [31, 8], [31, 7], [31, 6], [31, 5], [32, 5]];
const onWay = (x: number, y: number) => WAY.some(([a, b]) => a === x && b === y);

// A wrong turn in the drifts walks Ouro back to the edge of town, under a fade.
field.stepHooks.push(f => {
  if (f.map.id !== 'tusk' || f.y > 16 || f.y < 1 || onWay(f.x, f.y)) return;
  void f.runBusy(async () => {
    sfx('wind');
    f.fade = 12;
    f.x = 20; f.y = 18; f.px = 160; f.py = 144; f.dir = 2; f.placeFollower();
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
  { x: 33, y: 5, when: () => !flag('found_tusk_spoons'), script: async () => { setFlag('found_tusk_spoons'); sfx('cut'); await wait(20); await reward({ notion: 'riderspoon', items: [['ambergris', 1]] }); } },
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
