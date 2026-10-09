// Region 7 of the ring: the Shingle and puzzle 10 (the drag), the smithy in Hilt, and the east gatekeeper at the Moonwater.
import { sfx } from '../engine/audio';
import { field, flag, say, setFlag, wait } from '../game/api';
import { shop } from '../game/menus';
import { save } from '../game/state';
import { defMap, defScript, MAPS, SPAWNS } from '../game/world';
import { PUZZLE_DATA } from '../tools/worldcheck';
import { kinds, look, stash } from './areakit';
import { gatekeeper, giveKeyItem, hasKey, room, roomDoor } from './ring';
import { holmSeen } from './ring3';

// ---------------------------------------------------------------- the Shingle and puzzle 10

defMap({
  id: 'shingle', name: 'The Shingle', region: 41, music: 'shingle',
  rows: [
    'TTTTTT=TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'Tsssss=sssssssssssssssssssssssssssss~~~~~~~T',
    'Tsssus=sssssssssssssssssssssssssssss~~~~~~~T',
    'Tsssss=sssssussussssssssssssssssssss~~~~~~~T',
    'Tsssss=ss,,,ssssssssssssssssssssssss~~~~~~~T',
    'Tsssss=s,,,,,,,sssusssssssssssssssss~~~~~~~T',
    'Tsssss=s,,,,,,,uss###########ssususs~~~~~~~T',
    'Tsssss=s,,,,,,,sss#####O#####sssssss~~~~~~~T',
    'Tsssss=ss,,uusssss#####@#####sssssss~~~~~~~T',
    'Tsssss=sssssssssss#####@#####sssssss~~~~~~~T',
    'Tsssss=sssssssssss#####@#####sssssss~~~~~~~T',
    'Tsssss=sssssssssss##,,...,,##sssssss~~~~~~~T',
    'Tsssss=sssssssssss##,,...,,##sssssss~~~~~~~T',
    'Tssuss=susssssssss##,,,.,,,##sssssss~~~~~~~T',
    'Tsuuss=sssssssssss#####,#####sssssss~~~~~~~T',
    'Tsssss=ssssssssssssssss,sssssussssus~~~~~~~T',
    'Tsssss=ssssssssussssssssssssusssssss~~~~~~~T',
    'Tsssss=sssssssssssssssssssssssssssss~~~~~~~T',
    'Tsssss=sssssssssuusssus,,,ssssssssss~~~~~~~T',
    'Tsusss=sssssssssssss,,,,,,,,,sssssss~~~~~~~T',
    'Tsssss=ssssssssssssu,,u,,,,,,,ssssss~~~~~~~T',
    'Tsssss=ssusssussusss,,,,,,,,,sssssss~~~~~~~T',
    'Tsssss=ssssssssssssssss,,,sssussssss~~~~~~~T',
    'Tsssss=sssssssssssssssssssssssusssss~~~~~~~T',
    'Tsssss=sssssssssssssssssssssssssssss~~~~~~~T',
    'TTTTTT=TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 6, y: 0, to: 'tusk', tx: 38, ty: 37, dir: 2 },
    { x: 6, y: 25, to: 'hilt', tx: 38, ty: 4, dir: 0 },
  ],
  zone: { kinds: kinds([['tang', 3], ['buckler', 2], ['sallet', 2], ['gore', 2], ['quarry', 2]]), lv: [39, 43], n: 10, area: 'shingle' },
  props: [{ x: 38, y: 9, pic: 'holmfar', when: holmSeen(7) }],
  npcs: [
    { id: 'stonesorter', x: 14, y: 17, sprite: 'elder', name: 'Stone-sorter', dir: 1, lines: ['Three stones in the cut and a cave behind. You can\'t push a stone. You walk away and it follows.'] },
    { id: 'shingletrainer', x: 28, y: 18, sprite: 'keeper', name: 'Blade-picker', dir: 3, trainer: { name: 'Blade-picker', team: [['tang', 41], ['buckler', 41], ['sallet', 42]], intro: 'Every stone here\'s the shape of a blade. Not one of them\'s sharp. I check them all. Daily.', defeat: 'Still not sharp. Same as you.', sight: 3 } },
  ],
  spots: [
    { x: 23, y: 7, when: () => !field.objAt(23, 8) && !hasKey('lore_step') && !flag('back_lore_step'), script: async () => { sfx('guard'); await wait(16); await giveKeyItem('lore_step', 'Ouro drags out a flat stone worn into a dip. It is the front step.'); } },
    stash('sh_amber', 33, 22, 'Washed up between two blade-stones, a gray lump that smells of the sea.', { items: [['ambergris', 1]] }),
    look(35, 12, 'The Lipwater, gray. The Lip far across it, gray. Between them, gray stones the shape of blades.'),
  ],
});
SPAWNS.shingle = [6, 1];

PUZZLE_DATA.extra.push(() => {
  // Ouro starts south of the cut and must stand where the first stone was, facing the cave. Stones rest only on sand.
  const m = MAPS.shingle;
  const X0 = 18, Y0 = 6, Wd = 11, Hd = 10, cave = [23, 7], goal = [23, 8];
  const inBox = (x: number, y: number) => x >= X0 && y >= Y0 && x < X0 + Wd && y < Y0 + Hd;
  const tile = (x: number, y: number) => m.rows[y]?.[x] ?? '#';
  const walk = (x: number, y: number) => inBox(x, y) && !['#', 'O', 'T'].includes(tile(x, y)) && !(x === cave[0] && y === cave[1]);
  const rest = (x: number, y: number) => ['s', '.', '@'].includes(tile(x, y));
  const stones0: number[][] = [];
  for (let y = Y0; y < Y0 + Hd; y++) for (let x = X0; x < X0 + Wd; x++) if (tile(x, y) === '@') stones0.push([x, y]);
  const start = [23, 13];
  const key = (o: number[], s: number[][]) => o.join() + '|' + s.map(p => p.join()).sort().join(';');
  const seen = new Set([key(start, stones0)]);
  let frontier: [number[], number[][]][] = [[start, stones0]];
  for (let d = 0; frontier.length && d < 120; d++) {
    const next: [number[], number[][]][] = [];
    for (const [o, s] of frontier) {
      if (o[0] === goal[0] && o[1] === goal[1] && !s.some(p => p[0] === goal[0] && p[1] === goal[1])) return null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = o[0] + dx, ny = o[1] + dy;
        if (!walk(nx, ny) || s.some(p => p[0] === nx && p[1] === ny)) continue;
        const k1 = key([nx, ny], s);
        if (!seen.has(k1)) { seen.add(k1); next.push([[nx, ny], s]); }
        const si = s.findIndex(p => p[0] === o[0] - dx && p[1] === o[1] - dy);
        if (si >= 0 && rest(o[0], o[1])) {
          const s2 = s.map(p => p.slice()); s2[si] = [o[0], o[1]];
          const k2 = key([nx, ny], s2);
          if (!seen.has(k2)) { seen.add(k2); next.push([[nx, ny], s2]); }
        }
      }
    }
    frontier = next;
  }
  return 'puzzle 10: the three stones cannot be dragged out of the cut';
});

// ---------------------------------------------------------------- the smithy

// The smith finishes every sentence with a strike: "Clang."
defMap({
  id: 'smithy', name: 'The smithy', region: 11, indoor: true, music: 'town',
  rows: room(['p_p_____', '________', '_cccc___', '________', '________', '________']),
  warps: roomDoor('hilt', 33, 10),
  npcs: [{ id: 'hiltsmith', x: 3, y: 2, sprite: 'tanner', name: 'Hilt smith', dir: 0, talk: 'hiltsmith' }],
  spots: [look(5, 0, 'An anvil worn into a dip in the middle. Every blade in Hilt was beaten flat here, except the one.')],
});

defScript('hiltsmith', async () => {
  await say('Hilt smith', 'Notions for finishing. A blade shard keeps a low one low. Clang.');
  await shop(['bladeshard', 'coldiron', 'cleaver']);
  save();
});

// The east gatekeeper works for Purchase, and swaps what a thing costs for what it is worth.
defScript('gateE', gatekeeper('e', 'Purchase', {
  shut: 'Shut. The gate is owed a seal. You haven\'t paid one. Come back worth it.',
  read: 'Apex seal. Paid in full, which is to say owed. Through you go.',
  open: 'Open from this side now. The Ring\'s past it. Mind you owe it nothing on the way.',
}));

MAPS.moonwater.spots = [...(MAPS.moonwater.spots || []), stash('mw_silt', 10, 16, 'At the lake\'s edge, in an empty shell, silt the color of the moon.', { items: [['moonsilt', 1]] })];
MAPS.moonbed.spots = [...(MAPS.moonbed.spots || []), stash('mb_silt', 3, 9, 'In a fold of the old lakebed, a handful of silt the color of the moon.', { items: [['moonsilt', 2]] })];

void setFlag;
