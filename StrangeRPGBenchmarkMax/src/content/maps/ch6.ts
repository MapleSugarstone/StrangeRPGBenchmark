// Chapter 6 maps: the dusk road, the dark road, Burrow, and the Lampeater's den.
import type { MapDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE, legend } from './kit';
import { edgeWalls } from './ch3';

const pal = (a: number, b: number) => [C.black, a, b] as [number, number, number];

export const DUSK = legend(STILE, {
  z: { t: 'back_ground', step: 'dirt' }, Z: { t: 'back_ground2', step: 'dirt' }, y: { t: 'back_roots', step: 'dirt' },
  E: { t: 'back_edge', step: 'dirt' },
  // House tiles with no height. edgeWalls puts them where a tile's lead would fall only on the same house.
  J: { t: 'stile_roof', solid: true }, I: { t: 'stile_roof_ridge', solid: true }, U: { t: 'stile_house', solid: true },
  V: { t: 'stile_window', solid: true },
});
/** The flat twin of each house tile. */
export const HOUSE_FLAT = { R: 'J', '^': 'I', H: 'U', W: 'V' };

/** Puts an edge tile on a boundary column given per row and dark earth in diagonal bands east of it. */
function darkEdge(g: Grid, edgeAt: (y: number) => number) {
  for (let y = 0; y < g.h; y++) {
    const e = edgeAt(y);
    for (let x = e; x < g.w; x++) g.set(x, y, (x + y) % 3 ? 'z' : 'Z');
    g.set(e - 1, y, 'E');
  }
}

export const BACK = legend(STILE, {
  z: { t: 'back_ground', step: 'dirt' }, Z: { t: 'back_ground2', step: 'dirt' }, y: { t: 'back_roots', step: 'dirt' },
  w: { t: 'back_burrow_wall', solid: true, wall: 12 }, u: { t: 'back_burrow_floor', step: 'dirt' },
  D: { t: 'back_burrow_door', step: 'wood' }, d: { t: 'back_burrow_door', solid: true, wall: 12 },
  G: { t: 'stile_gate_closed', solid: true },
});

/** Lilac marks the Unled rub as they pass. They are the only things in the dark that show at all. */
function stones(at: [number, number][]) {
  return {
    props: at.map(([x, y]) => ({ art: 'glow_stone', x, y, talk: 'dark_stone', lead: false })),
    lights: at.map(([x, y]) => ({ x, y, r: 10, i: 0.22, color: 0xb3a8e4 })),
  };
}

// ---- The dusk road ----
const du = new Grid(48, 24, '.');
// The dark comes in from the east. The lit road runs out into it as a wedge, so the dark reaches furthest west far from the road.
darkEdge(du, (y) => 40 - Math.min(6, Math.round(Math.abs(y - 11.5) * 0.6)));
du.fill(0, 11, 48, 2, '=');
du.fill(41, 14, 4, 5, 'y').fill(42, 3, 3, 4, 'y');
// Two cut fields and flowers along the farmhouse front.
du.fill(1, 1, 9, 4, 'f').fill(19, 15, 9, 4, 'f');
du.hline(11, 6, 8, '"').hline(12, 7, 6, '"');
du.house(12, 3, 6, { door: -1, windows: [1, 4] });
// A fenced pen with a gate on its north side.
du.hline(3, 16, 9, '-').hline(3, 21, 9, '-').vline(3, 16, 6, '|').vline(11, 16, 6, '|').set(7, 16, 'G');
// Stones on the grass at the rim of the dark.
for (const [x, y] of [[32, 2], [35, 6], [35, 17], [33, 20]]) du.set(x, y, 'o');
edgeWalls(du, HOUSE_FLAT, 1, 0);
// Sheaves stand in rows on the cut fields. In the dusk each one lays a lead five tiles long across the stubble.
const sheaves = [1, 3].flatMap((y) => [2, 4, 6, 8].map((x) => ({ art: 'sheaf', x, y })))
  .concat([15, 17].flatMap((y) => [20, 22, 24, 26].map((x) => ({ art: 'sheaf', x, y }))));
// Dead trees stand along the rim of the dark.
const deadTrees = [[36, 3], [38, 7], [43, 9], [38, 17], [44, 14], [39, 21], [35, 1], [36, 22]].map(([x, y]) => ({ art: 'tree_orchard_bare', x, y }));
const roadLamps: [number, number][] = [[2, 13], [14, 13], [26, 13], [35, 13]];

// ---- The dark road ----
const bk = new Grid(44, 26, 'w');
const floor = (x: number, y: number, w: number, h: number) => bk.mix(x, y, w, h, 'z', 'Z', 0.25);
floor(0, 11, 15, 4);
floor(12, 12, 12, 6);
floor(16, 3, 5, 10);
floor(22, 14, 22, 7);
floor(9, 15, 3, 2);
floor(7, 17, 7, 6);
floor(24, 21, 6, 4);
floor(23, 8, 6, 6);
floor(33, 8, 7, 6);
floor(32, 1, 10, 6);
bk.set(18, 2, 'D').set(36, 7, 'G');
bk.mix(12, 12, 12, 6, 'z', 'y', 0.12).mix(22, 14, 22, 7, 'Z', 'y', 0.1);
for (const [x, y] of [[20, 16], [30, 17], [9, 20], [26, 23], [25, 10], [38, 3]]) bk.set(x, y, 'w');
const darkStones = stones([[10, 11], [21, 13], [17, 6], [31, 15], [41, 17]]);

// ---- Burrow ----
const bu = new Grid(34, 24, 'w');
bu.mix(2, 3, 30, 19, 'u', 'z', 0.15).fill(15, 22, 4, 2, 'u');
// Homes dug into the walls, each with a round door.
bu.fill(2, 3, 30, 2, 'w').fill(2, 5, 5, 4, 'w').fill(27, 5, 5, 5, 'w').fill(2, 19, 6, 3, 'w').fill(26, 19, 6, 3, 'w');
bu.fill(8, 5, 5, 3, 'w').set(10, 7, 'D');
bu.set(4, 8, 'd').set(29, 9, 'd').set(5, 19, 'd').set(28, 19, 'd').set(20, 4, 'd');

// ---- The Lampeater's den ----
const dn = new Grid(36, 22, 'w');
dn.mix(1, 4, 34, 14, 'z', 'y', 0.18).fill(0, 9, 2, 3, 'z').fill(34, 9, 2, 3, 'z');
dn.fill(1, 4, 5, 3, 'w').fill(1, 15, 5, 3, 'w').fill(29, 4, 6, 3, 'w').fill(29, 15, 6, 3, 'w');
for (const [x, y] of [[10, 6], [11, 15], [22, 5], [24, 16], [18, 9], [27, 11]]) dn.set(x, y, 'w');

export const CH6: MapDef[] = [
  {
    id: 'dusk_road', name: 'The dusk road', region: 'dusk', music: 'dusk', rows: du.rows(), legend: DUSK,
    markers: { start: [1, 11], dark_edge: [40, 11], east: [46, 11] },
    props: [
      ...[8, 16, 24, 32].map((x) => ({ art: 'post', x, y: 9 })),
      { art: 'dial_post', x: 20, y: 13, talk: 'post_dusk' }, { art: 'tree_gold', x: 27, y: 2 }, { art: 'tree_gold', x: 6, y: 7 },
      { art: 'stray', x: 41, y: 7, talk: 'stray_9', cond: '!stray9_carried', solid: false, lead: false },
      { art: 'stray', x: 43, y: 17, talk: 'stray_10', cond: '!stray10_carried', solid: false, lead: false },
      // The pen's lock, and a cache inside.
      { art: 'crate', x: 10, y: 14 }, { art: 'barrel', x: 7, y: 19, talk: 'dusk_pen_cache', cond: '!dusk_pen_cache', lead: false },
      ...sheaves, ...deadTrees,
      ...roadLamps.map(([x, y]) => ({ art: 'lamp_post', x, y, lead: false })),
      { art: 'lamp_fallen', x: 42, y: 13, lead: false, solid: false },
      // The Unled have rubbed lilac marks on two stones where the dark begins.
      { art: 'glow_stone', x: 39, y: 9, talk: 'dark_stone', lead: false }, { art: 'glow_stone', x: 39, y: 14, talk: 'dark_stone', lead: false },
    ],
    lights: [
      // A low light in the west stands for the last of the sun. Ground nearer the dark gets less of it and more dither.
      { x: -4, y: 11, r: 300, i: 0.3, color: 0xff9a6a },
      ...roadLamps.map(([x, y]) => ({ x, y: y - 1, r: 24, i: 0.45, color: 0xffc070 })),
      { x: 13, y: 6, r: 14, i: 0.35, color: 0xffc070 }, { x: 16, y: 6, r: 14, i: 0.35, color: 0xffc070 },
      { x: 39, y: 9, r: 12, i: 0.25, color: 0xb3a8e4 }, { x: 39, y: 14, r: 12, i: 0.25, color: 0xb3a8e4 },
    ],
    // The pen. Insight: at dusk a crate's lead runs three tiles east, long enough to lie across both plates at once.
    // Solution: push the crate west until it stands on the tile just before the first plate.
    plates: [{ id: 'dp1', x: 6, y: 14, flag: 'dusk_pen' }, { id: 'dp2', x: 8, y: 14, flag: 'dusk_pen' }],
    gates: [{ x: 7, y: 16, flag: 'dusk_pen', open: 'stile_gate_open' }],
    encounters: [
      { id: 'du1', group: 'g_feelers', art: 'feeler', x: 37, y: 4, wander: 2 },
      { id: 'du2', group: 'g_dark_mix', art: 'lightdrinker', x: 37, y: 19, wander: 2 },
    ],
    exits: [{ x: 47, y: 10, h: 4, to: 'back_road', at: 'west' }, { x: 0, y: 11, h: 2, to: 'overhead', at: 'north_road' }],
    enterScene: 'dusk_enter',
  },
  {
    id: 'back_road', name: 'The dark road', region: 'back', music: 'back_road', rows: bk.rows(), legend: BACK,
    markers: {
      west: [1, 12], dark_side: [14, 16], lantern_edge: [8, 12], burrow_out: [18, 4], light_edge: [18, 11], light_rim: [18, 9],
      east: [42, 18], hollow: [36, 4],
    },
    props: [
      ...darkStones.props,
      { art: 'crate', x: 34, y: 12 }, { art: 'lamp_fallen', x: 27, y: 18, lead: false, solid: false },
    ],
    // The hollow. Insight: in the dark only the lantern gives anything a lead, and the lead points away from it.
    // Solution: set the lantern on the tile diagonally south-west of the crate. Its lead swings north-east two tiles onto the plate.
    plates: [{ id: 'bh', x: 36, y: 10, flag: 'back_hollow' }],
    gates: [{ x: 36, y: 7, flag: 'back_hollow', open: 'back_burrow_floor' }],
    lights: darkStones.lights,
    triggers: [
      { x: 6, y: 11, h: 4, scene: 'ch6_tik_meet', cond: '!ch6_tik_joined' },
      { x: 16, y: 7, w: 5, scene: 'ch6_lot_return', cond: 'ch6_burrow&!ch6_lot_back' },
    ],
    encounters: [
      { id: 'bk1', group: 'g_dark_mix', art: 'feeler', x: 10, y: 20, wander: 1 },
      { id: 'bk2', group: 'g_drinkers', art: 'lightdrinker', x: 25, y: 11, wander: 1 },
      { id: 'bk3', group: 'g_feelers', art: 'crawler', x: 27, y: 22, wander: 1 },
      { id: 'bk4', group: 'g_oldstray', art: 'oldstray', x: 37, y: 3, wander: 1 },
    ],
    exits: [
      { x: 0, y: 11, h: 4, to: 'dusk_road', at: 'east' }, { x: 18, y: 2, to: 'burrow', at: 'south' },
      { x: 43, y: 14, h: 7, to: 'lampeater_den', at: 'west', cond: 'ch6_remembers', blocked: 'den_early' },
    ],
  },
  {
    id: 'burrow', name: 'Burrow', region: 'back', music: 'burrow', rows: bu.rows(), legend: BACK,
    markers: { south: [17, 21], burrow_door: [10, 7], burrow_front: [16, 16] },
    npcs: [
      { id: 'hum', art: 'hum', x: 10, y: 7, dir: 'down', talk: 'talk_hum' },
      { id: 'drip', art: 't_unled', pal: pal(C.ink, C.pale), x: 6, y: 14, wander: 1, talk: 'owner_9:talk_drip' },
      { id: 'scuff', art: 't_unled', pal: pal(C.plum1, C.lilac), x: 25, y: 12, dir: 'right', talk: 'owner_10:talk_scuff' },
      { id: 'pantry', art: 't_unled', pal: pal(C.slate, C.pale), x: 23, y: 18, dir: 'up', talk: 'talk_burrow_shop' },
      { id: 'burrow_folk', art: 't_unled', pal: pal(C.blue1, C.lilac), x: 12, y: 12, wander: 2, talk: 'talk_burrow_folk' },
    ],
    props: [
      { art: 'soup_pot', x: 17, y: 11, talk: 'burrow_soup' }, { art: 'sticks_table', x: 26, y: 12, talk: 'talk_sticks_burrow' },
      { art: 'dial_post', x: 14, y: 10, talk: 'post_generic' }, { art: 'barrel', x: 22, y: 17, lead: false },
    ],
    triggers: [
      { x: 12, y: 19, w: 10, scene: 'ch6_burrow_arrive', cond: '!ch6_burrow' },
      { x: 12, y: 19, w: 10, scene: 'ch6_remembers', cond: 'ch6_lot_back&!ch6_remembers' },
    ],
    exits: [{ x: 15, y: 23, w: 4, to: 'back_road', at: 'burrow_out' }],
  },
  {
    id: 'lampeater_den', name: "The Lampeater's den", region: 'back', music: 'lampeater_den', rows: dn.rows(), legend: BACK,
    markers: { west: [1, 10], nest: [20, 11], far: [34, 10] },
    props: [
      ...[[8, 9], [13, 12], [15, 7], [21, 14], [25, 8], [19, 12]].map(([x, y]) => ({ art: 'lamp_fallen', x, y, lead: false, solid: false })),
    ],
    triggers: [
      { x: 6, y: 4, h: 14, scene: 'ch6_lampeater_sign', cond: '!ch6_lampeater_sign' },
      { x: 16, y: 4, h: 14, scene: 'ch6_lampeater', cond: '!ch6_done' },
      { x: 32, y: 7, h: 8, scene: 'ch6_leave', cond: 'ch6_done&!ch7_started' },
    ],
    exits: [
      { x: 0, y: 9, h: 3, to: 'back_road', at: 'east' },
      { x: 35, y: 9, h: 3, to: 'stile_night', at: 'start', cond: 'ch7_started', blocked: 'den_far_early' },
    ],
  },
];
