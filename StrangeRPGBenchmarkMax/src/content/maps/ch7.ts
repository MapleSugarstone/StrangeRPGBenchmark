// Chapter 7 maps: Stile's nightward edge, the square under the glare, the Office tower, the Great Lamp, and the hill.
import type { MapDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE, legend } from './kit';
import { CH1 } from './ch1';
import { edgeWalls } from './ch3';
import { HOUSE_FLAT } from './ch6';

const pal = (a: number, b: number) => [C.black, a, b] as [number, number, number];

export const STILE7 = legend(STILE, {
  z: { t: 'back_ground', step: 'dirt' }, Z: { t: 'back_ground2', step: 'dirt' }, y: { t: 'back_roots', step: 'dirt' },
  c: { t: 'lamp_cap', solid: true, wall: 16 }, l: { t: 'lamp_glass', solid: true, wall: 16 }, m: { t: 'lamp_flame', solid: true, wall: 16 },
  E: { t: 'office_lamp_base', solid: true, wall: 6 }, Y: { t: 'back_edge', step: 'dirt' },
  // House, slate, and hedge tiles with no height. edgeWalls puts them where a lead would fall only on the same building or hedge.
  J: { t: 'stile_roof', solid: true }, I: { t: 'stile_roof_ridge', solid: true }, U: { t: 'stile_house', solid: true },
  V: { t: 'stile_window', solid: true }, k: { t: 'stile_roof_slate', solid: true }, j: { t: 'stile_hedge', solid: true },
});
const STILE7_FLAT = { ...HOUSE_FLAT, S: 'k', '%': 'j' };

export const TOWER = legend(STILE, {
  n: { t: 'office_floor', step: 'stone' }, '#': { t: 'office_wall', solid: true }, W: { t: 'office_window', solid: true },
  D: { t: 'office_door', step: 'wood' }, I: { t: 'office_bars', solid: true }, B: { t: 'stile_bookshelf', solid: true },
  T: { t: 'stile_table', solid: true }, s: { t: 'stile_stairs', step: 'stone' }, k: { t: 'stile_floor_stone', step: 'stone' },
  G: { t: 'stile_gate_closed', solid: true }, r: { t: 'stile_rug', step: 'wood' },
});

/** A Grid holding a copy of finished rows. */
function gridOf(rows: string[]): Grid {
  const g = new Grid(rows[0].length, rows.length);
  g.stamp(0, 0, rows);
  return g;
}

// ---- Stile's nightward edge ----
const sn = new Grid(40, 24, '.');
// The dark reaches furthest west far from the road and starts at column 32 along it.
for (let y = 0; y < 24; y++) {
  const e = 32 - Math.min(5, Math.round(Math.abs(y - 11.5) * 0.5));
  for (let x = e; x < 40; x++) sn.set(x, y, (x + y) % 3 ? 'z' : 'Z');
  sn.set(e - 1, y, 'Y');
}
sn.fill(34, 15, 4, 5, 'y').fill(33, 3, 3, 3, 'y');
sn.fill(0, 11, 34, 2, '=');
sn.stamp(14, 3, ['ffffffff', 'ffffffff', 'ffffffff', 'ffffffff']).stamp(16, 15, ['fffffff', 'fffffff', 'fffffff']);
sn.vline(25, 1, 9, '|').vline(25, 14, 9, '|').hline(13, 2, 12, '-').hline(13, 21, 12, '-');
sn.house(1, 1, 7, { door: -1, windows: [1, 3, 5] }).house(1, 16, 8, { door: -1, windows: [2, 5] }).house(8, 5, 5, { door: -1, windows: [1, 3] });
sn.hline(0, 14, 6, '%').hline(9, 14, 3, '%');
for (const [x, y] of [[20, 9], [23, 17], [19, 13], [11, 18]]) sn.set(x, y, 'o');
edgeWalls(sn, STILE7_FLAT, 1, 0);
// Posts stand along the last fence. Each lead runs six tiles east across the rim of the dark.
const fencePosts = [1, 4, 7, 15, 18, 21].map((y) => ({ art: 'post', x: 25, y }));
// Lilac marks the Unled rubbed on the stones along their way in from the dark.
const trail: [number, number][] = [[37, 9], [35, 14], [33, 9], [31, 14]];

// ---- The square under the glare ----
const sqDef = CH1.find((m) => m.id === 'square')!;
const s7 = gridOf(sqDef.rows);
// Quarle's door, on the house with no door in chapter 1.
s7.set(5, 20, 'D');

// ---- The Office tower ----
const ot = new Grid(24, 30, 'n');
ot.border('#').hline(0, 14, 24, '#').hline(0, 15, 24, '#').set(11, 14, 's').set(11, 15, 's').set(12, 14, 's').set(12, 15, 's');
ot.set(11, 29, 'D').set(12, 29, 'D');
ot.set(0, 4, 'W').set(0, 9, 'W').set(0, 20, 'W').set(0, 25, 'W');
// Ground floor: the register room, the guard room, and the cellar behind a gate.
ot.vline(9, 16, 8, '#').set(9, 21, 'n').hline(1, 16, 8, 'B').hline(1, 23, 9, '#');
ot.vline(14, 16, 13, '#').set(14, 19, 'n').hline(15, 22, 8, '#').set(18, 22, 'G');
ot.fill(15, 23, 8, 6, 'k').fill(15, 16, 8, 6, 'n').fill(16, 17, 3, 1, 'r');
// Upper floor: cells along the north wall, the Director's room, and a long hall.
ot.hline(1, 5, 9, '#').vline(4, 1, 5, '#').vline(7, 1, 5, '#').set(2, 5, 'I').set(3, 5, 'I').set(8, 5, 'I').set(5, 5, 'n').set(6, 5, 'n');
ot.vline(14, 1, 13, '#').set(14, 7, 'D').hline(15, 1, 8, 'B').set(18, 4, 'T').set(19, 4, 'T').fill(16, 9, 6, 1, 'r');

// ---- The Great Lamp at the sunward gate ----
const gl = new Grid(36, 24, '.');
gl.mix(0, 0, 36, 24, '.', ',', 0.25).mix(17, 0, 19, 24, ':', ';', 0.2);
gl.vline(16, 0, 24, '#').fill(0, 9, 16, 4, '=').fill(16, 9, 1, 4, ':');
gl.hline(17, 8, 4, 'c').hline(17, 9, 4, 'l').set(18, 9, 'm').set(19, 9, 'm').hline(17, 10, 4, 'l').set(18, 10, 'm').set(19, 10, 'm');
gl.hline(17, 11, 4, 'l').hline(17, 12, 4, 'E');
gl.fill(21, 10, 15, 2, '=').set(16, 18, 'D');
gl.house(26, 1, 6, { roof: 'S', ridge: 'S', door: -1, windows: [2, 4] }).house(27, 17, 6, { door: -1, windows: [1, 4] });
edgeWalls(gl, STILE7_FLAT, 1, 0);

// ---- The hill ----
const hi = new Grid(36, 22, '.');
hi.mix(0, 0, 36, 22, '.', ',', 0.3);
hi.vline(23, 0, 22, '#').set(23, 9, 'G').set(23, 10, 'G').set(23, 15, 'D');
hi.fill(24, 0, 12, 22, ':').house(26, 1, 6, { door: -1, windows: [1, 4] }).house(25, 5, 5, { door: -1, windows: [2] });
hi.house(31, 6, 5, { door: -1, windows: [1, 3] }).house(26, 13, 7, { door: -1, windows: [2, 5] }).house(29, 18, 6, { door: -1, windows: [3] });
hi.vline(16, 2, 6, 'C').vline(17, 12, 7, 'C').set(15, 1, 'C').set(16, 19, 'C');
edgeWalls(hi, STILE7_FLAT, 1, 0);

export const CH7: MapDef[] = [
  {
    id: 'stile_night', name: "Stile's nightward edge", region: 'stile7', music: 'stile_dark', rows: sn.rows(), legend: STILE7,
    markers: { start: [38, 11], town_glow: [6, 6], west: [1, 11] },
    props: [
      { art: 'tree_gold', x: 11, y: 9 }, { art: 'tree_gold', x: 22, y: 2 }, { art: 'post', x: 27, y: 9 }, { art: 'post', x: 27, y: 14 },
      { art: 'sign', x: 24, y: 10, talk: 'stile_last_fence' }, { art: 'lamp_post', x: 3, y: 13, lead: false },
      { art: 'lamp_post', x: 13, y: 10, lead: false }, { art: 'lamp_post', x: 21, y: 13, lead: false },
      ...fencePosts,
      ...trail.map(([x, y]) => ({ art: 'glow_stone', x, y, talk: 'dark_stone', lead: false })),
    ],
    lights: [
      { x: 3, y: 3, r: 18, i: 0.45, color: 0xffd080 }, { x: 4, y: 18, r: 18, i: 0.45, color: 0xffd080 }, { x: 10, y: 7, r: 16, i: 0.4, color: 0xffd080 },
      { x: 3, y: 13, r: 24, i: 0.5, color: 0xffd080 }, { x: 0, y: 11, r: 60, i: 0.35, color: 0xffffff },
      { x: 6, y: 20, r: 14, i: 0.4, color: 0xffd080 }, { x: 13, y: 11, r: 22, i: 0.45, color: 0xffd080 }, { x: 21, y: 12, r: 22, i: 0.45, color: 0xffd080 },
      ...trail.map(([x, y]) => ({ x, y, r: 16, i: 0.35, color: 0xb3a8e4 })),
    ],
    triggers: [{ x: 37, y: 0, h: 24, scene: 'ch7_open', cond: '!ch7_started' }],
    encounters: [
      { id: 'sn1', group: 'g_painted', art: 'paintedlead', x: 20, y: 6, wander: 2 },
      { id: 'sn2', group: 'g_bearers7', art: 't_office', x: 21, y: 18, wander: 2 },
    ],
    exits: [{ x: 0, y: 11, h: 2, to: 'square7', at: 'east_road' }, { x: 39, y: 10, h: 4, to: 'lampeater_den', at: 'far' }],
  },
  {
    id: 'square7', name: 'Stile', region: 'stile7', music: 'stile_dark', rows: s7.rows(), legend: STILE,
    markers: {
      east_road: [38, 15], west_road: [1, 15], office_door: [19, 4], tib_corner: [31, 9], tib_meet: [28, 14], mott_house: [34, 14],
    },
    npcs: [
      { id: 'quarle', art: 't_long_elder', pal: pal(C.plum2, C.gold3), x: 5, y: 21, dir: 'down', talk: 'ch7_painted_folk', cond: '!ch7_quarle_free' },
      { id: 'quarle', art: 't_long_elder', pal: pal(C.plum2, C.gold3), x: 6, y: 22, dir: 'right', talk: 'talk_quarle7', wander: 1, cond: 'ch7_quarle_free' },
      { id: 'mott', art: 'mott', x: 35, y: 17, dir: 'up', talk: 'ch7_mott', cond: '!ch7_mott' },
      { id: 'mott', art: 'mott', x: 35, y: 17, dir: 'up', talk: 'talk_mott7', cond: 'ch7_mott' },
      { id: 'tib', art: 'tib', x: 31, y: 9, dir: 'left', talk: 'ch7_tib', cond: '!ch7_tib' },
      { id: 'tib', art: 'tib', x: 28, y: 14, dir: 'left', talk: 'talk_tib7', cond: 'ch7_tib' },
      { id: 'hessle', art: 't_long_adult', pal: pal(C.teal1, C.rust3), x: 28, y: 18, dir: 'down', talk: 'talk_hessle7' },
      { id: 'pip', art: 't_long_child', pal: pal(C.rust2, C.gold3), x: 25, y: 17, dir: 'right', talk: 'talk_pip' },
      { id: 'wem', art: 't_long_child', pal: pal(C.green2, C.umber2), x: 27, y: 17, dir: 'left', talk: 'talk_pip' },
    ],
    props: [
      { art: 'town_gnomon', x: 20, y: 11 }, { art: 'sticks_table', x: 26, y: 17, talk: 'talk_pip' }, { art: 'dial_post', x: 11, y: 17, talk: 'post_stile' },
      { art: 'tree_gold', x: 2, y: 3 }, { art: 'tree_gold', x: 9, y: 2 }, { art: 'tree_gold', x: 31, y: 2 }, { art: 'tree_gold', x: 37, y: 5 },
      { art: 'tree_gold', x: 1, y: 27 }, { art: 'tree_gold', x: 11, y: 27 }, { art: 'tree_gold', x: 29, y: 27 }, { art: 'tree_gold', x: 37, y: 21 },
      { art: 'lamp_post', x: 9, y: 6, lead: false }, { art: 'lamp_post', x: 30, y: 6, lead: false }, { art: 'lamp_post', x: 9, y: 24, lead: false }, { art: 'lamp_post', x: 30, y: 24, lead: false },
      { art: 'barrel', x: 30, y: 18, lead: false },
      { art: 'crate', x: 16, y: 7 },
    ],
    // The tower lock. Insight: a painted lead can lie right across a plate and press nothing. Only a real thing's lead lights it.
    // Solution: push the crate north once and east four times, so it stands three tiles west of the plate. Stile's low sun
    // lays its lead east across the plate.
    plates: [{ id: 'tl', x: 23, y: 6, flag: 'ch7_tower_plate' }],
    painted: [
      { x: 22, y: 6, w: 3, h: 1, cond: '!ch7_tower_plate' },
      { x: 4, y: 12, w: 1, h: 2 }, { x: 34, y: 15, w: 1, h: 2 }, { x: 5, y: 21, w: 1, h: 2 },
    ],
    talks: [
      { x: 4, y: 12, scene: 'painted_home' }, { x: 4, y: 13, scene: 'painted_home' }, { x: 34, y: 15, scene: 'painted_home' },
      { x: 20, y: 14, scene: 'ledger_desk7' }, { x: 21, y: 14, scene: 'ledger_desk7' },
    ],
    lights: [
      { x: 0, y: 15, r: 90, i: 0.55, color: 0xffffff },
      { x: 9, y: 6, r: 20, i: 0.4, color: 0xffd080 }, { x: 30, y: 6, r: 20, i: 0.4, color: 0xffd080 },
      { x: 9, y: 24, r: 20, i: 0.4, color: 0xffd080 }, { x: 30, y: 24, r: 20, i: 0.4, color: 0xffd080 },
    ],
    triggers: [{ x: 30, y: 5, h: 20, scene: 'ch7_tib', cond: '!ch7_tib' }],
    exits: [
      { x: 39, y: 15, h: 2, to: 'stile_night', at: 'west' },
      { x: 19, y: 3, to: 'office_tower', at: 'door', cond: 'ch7_tib&ch7_tower_plate', blocked: 'tower_gate' },
      { x: 0, y: 15, h: 2, to: 'great_lamp', at: 'east', cond: 'ch7_parhelia_free', blocked: 'lamp_road_early' },
    ],
    bigLead: { x: -24, y: 11, len: 380 },
  },
  {
    id: 'office_tower', name: 'The Office tower', region: 'interior', music: 'office_tower', rows: ot.rows(), legend: TOWER,
    battleLight: { dir8: [1, 0], lowness: 2 },
    markers: { door: [11, 28], upstairs: [11, 13], cells: [5, 6], tik_side: [6, 7], cellar: [18, 25] },
    npcs: [
      { id: 'parhelia', art: 'parhelia', x: 5, y: 3, dir: 'down', talk: 'ch7_parhelia_cell', cond: '!ch7_parhelia_free' },
      { id: 'registrar', art: 't_office', pal: pal(C.blue1, C.pale), x: 5, y: 19, dir: 'down', talk: 'owner_11:talk_registrar' },
      { id: 'grisaille', art: 'grisaille', x: 19, y: 19, dir: 'left', talk: 'owner_12:talk_grisaille7' },
    ],
    props: [
      { art: 'stray', x: 3, y: 17, talk: 'stray_11', cond: '!stray11_carried', solid: false, lead: false },
      { art: 'stray', x: 21, y: 27, talk: 'stray_12', cond: '!stray12_carried', solid: false, lead: false },
      { art: 'crate', x: 21, y: 20 }, { art: 'barrel', x: 16, y: 20, lead: false }, { art: 'barrel', x: 2, y: 22, lead: false },
    ],
    // The trap hall. Insight: the Office laid trapdoors that look like the floor, so a pebble's lead has to find them first.
    // Solution: throw a pebble ahead along the hall and step only where it lands on floor, up to the stairs.
    hiddenPits: [[11, 26], [12, 24], [10, 23], [13, 21], [11, 20], [12, 18], [10, 17], [13, 25]],
    // The cellar gate. Insight: indoors nothing casts a lead, so the gate waits for Parhelia's lamp.
    // Solution: with Parhelia back, push the crate north once and set her lamp just south of it. Its lead falls north two tiles onto the plate.
    plates: [{ id: 'oc', x: 21, y: 17, flag: 'office_cellar' }],
    gates: [{ x: 18, y: 22, flag: 'office_cellar', open: 'stile_stairs' }],
    talks: [{ x: 18, y: 4, scene: 'office_child_lamp' }, { x: 19, y: 4, scene: 'office_child_lamp' }, { x: 18, y: 21, scene: 'office_cellar_door' }, { x: 12, y: 27, scene: 'office_floor_new' }],
    shafts: [{ x: 0, y: 4, w: 1, h: 1 }, { x: 0, y: 9, w: 1, h: 1 }, { x: 0, y: 20, w: 1, h: 1 }, { x: 0, y: 25, w: 1, h: 1 }],
    triggers: [{ x: 1, y: 7, w: 9, scene: 'ch7_parhelia_cell', cond: '!ch7_parhelia_free' }],
    encounters: [
      { id: 'ot1', group: 'g_bearers7', art: 't_office', x: 18, y: 11, wander: 1 },
      { id: 'ot2', group: 'g_painted', art: 'paintedlead', x: 5, y: 11, wander: 1 },
    ],
    exits: [{ x: 11, y: 29, w: 2, to: 'square7', at: 'office_door' }],
  },
  {
    id: 'great_lamp', name: 'The Great Lamp', region: 'stile7', music: 'anthelion', rows: gl.rows(), legend: STILE7,
    markers: { east: [34, 10], great_lamp: [21, 10], anthelion_front: [23, 11], mirror_left: [18, 6], mirror_right: [18, 14], postern: [17, 18] },
    npcs: [{ id: 'anthelion', art: 'anthelion', x: 22, y: 11, dir: 'right', talk: 'ch7_anthelion', cond: '!ch7_beam_turned' }],
    props: [
      { art: 'mirror_tower', x: 17, y: 6, lead: false }, { art: 'mirror_tower', x: 17, y: 14, lead: false },
      { art: 'child_lamp', x: 21, y: 9, lead: false, solid: false }, { art: 'lamp_post', x: 25, y: 8 }, { art: 'lamp_post', x: 25, y: 13 },
      { art: 'crate', x: 29, y: 7, lead: false, solid: true }, { art: 'barrel', x: 30, y: 14, lead: false },
    ],
    lights: [
      { x: 18, y: 10, r: 90, i: 0.9, color: 0xffffff, cond: '!ch7_beam_turned' },
      { x: 18, y: 10, r: 40, i: 0.5, color: 0xfff0e0, cond: 'ch7_beam_turned' },
    ],
    triggers: [{ x: 27, y: 0, h: 24, scene: 'ch7_anthelion', cond: '!ch7_beam_turned' }],
    exits: [
      { x: 35, y: 9, h: 4, to: 'square7', at: 'west_road' },
      { x: 16, y: 18, to: 'hill', at: 'start', cond: 'ch7_beam_turned', blocked: 'hill_early' },
    ],
  },
  {
    id: 'hill', name: 'The hill', region: 'stile7', music: 'lead', rows: hi.rows(), legend: STILE7,
    markers: {
      start: [22, 15], hill_top: [8, 7], hill_p: [8, 8], hill_u: [8, 9], hill_m: [8, 10], hill_t: [8, 11], hill_l: [8, 12], lead_town: [31, 10],
    },
    props: [{ art: 'post', x: 6, y: 4 }, { art: 'tree_gold', x: 3, y: 16 }],
    lights: [{ x: 24, y: 10, r: 40, i: 0.45, color: 0xfff0e0 }, { x: 28, y: 3, r: 14, i: 0.4, color: 0xffd080 }, { x: 28, y: 15, r: 14, i: 0.4, color: 0xffd080 }],
    triggers: [{ x: 21, y: 0, h: 22, scene: 'ch7_hill', cond: 'ch7_beam_turned&!entry_fact&!entry_question&!entry_names&!entry_typed' }],
    exits: [{ x: 23, y: 15, to: 'great_lamp', at: 'postern' }],
    bigLead: { x: 9, y: 7, len: 380 },
    enterScene: 'hill_enter',
  },
];
