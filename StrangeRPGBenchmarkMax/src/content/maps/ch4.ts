// Chapter 4 maps: the glass flats, the oasis well, and the Relay quarry.
import type { MapDef, NpcDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE, legend } from './kit';

const pal = (a: number, b: number) => [C.black, a, b] as [number, number, number];
/** Mirages wear the colors of something very old: faded teal and white. */
const FADED: [number, number, number] = [C.teal1, C.teal3, C.white];

export const GLASS = legend(STILE, {
  '.': { t: 'glass_floor', step: 'glass' }, ',': { t: 'glass_floor2', step: 'glass' }, c: { t: 'glass_cracked', step: 'glass' },
  u: { t: 'glass_dune', step: 'glass' }, '#': { t: 'glass_wall', solid: true, wall: 10 }, q: { t: 'glass_quarry', step: 'stone' },
  w: { t: 'glass_well', solid: true }, v: { t: 'glass_cave_floor', step: 'glass' }, V: { t: 'glass_cave_floor', solid: true },
  o: { t: 'glass_rock', solid: true }, X: { t: 'glass_pit', pit: true }, g: { t: 'bright_orchard', step: 'grass' },
  '~': { t: 'stile_water', water: true }, G: { t: 'stile_gate_closed', solid: true },
  O: { t: 'office_floor', step: 'stone' }, F: { t: 'bright_scaffold', solid: true, wall: 10 },
  B: { t: 'office_wall', solid: true, wall: 12 }, N: { t: 'office_window', solid: true, wall: 12 },
});

/** A shelter of glass blocks with a dark doorway. */
function shelter(g: Grid, x: number, y: number, w: number, door: number) {
  g.fill(x, y, w, 3, '#').set(x + door, y + 2, 'V');
}

/** A row of Silvered standing in the quarry. They face the sun until the Warden falls, then turn their backs on it. */
function rows(at: [number, number][]): NpcDef[] {
  return at.flatMap(([x, y], i) => [
    { id: `row${i}`, art: 't_silvered', x, y, dir: 'down', talk: 'quarry_rows', ghost: true, cond: '!anim_rows_wake' },
    { id: `row${i}w`, art: 't_silvered', x, y, dir: 'up', talk: 'quarry_rows', ghost: true, cond: 'anim_rows_wake' },
  ] as NpcDef[]);
}

// ---- The glass flats ----
const gf = new Grid(46, 28, '.');
gf.mix(0, 0, 46, 28, '.', ',', 0.25);
gf.mix(2, 2, 20, 3, 'u', '.', 0.2).mix(8, 22, 26, 3, 'u', ',', 0.2).mix(26, 12, 12, 2, 'u', '.', 0.3);
gf.mix(14, 9, 7, 5, 'c', '.', 0.4).mix(30, 20, 6, 4, 'c', ',', 0.4);
// A cave in a ridge of glass, its floor smooth and dark.
gf.fill(29, 0, 17, 9, '#').fill(30, 1, 15, 7, 'v').set(37, 8, 'v');
gf.set(33, 3, '#').set(33, 4, '#').set(40, 1, '#').set(41, 6, '#').fill(29, 7, 3, 2, '.').fill(43, 7, 3, 2, '.').set(29, 6, '.').set(45, 6, '.');
// Ridges of fused glass out on the flats.
gf.stamp(2, 13, ['  ##', '#####', ' ##']).stamp(24, 7, ['###', ' ##']).stamp(40, 23, [' ###', '####']).stamp(9, 18, ['##', '###']);
for (const [x, y] of [[9, 7], [14, 6], [7, 11], [16, 11], [13, 13], [20, 17], [24, 21], [17, 20], [33, 17], [39, 16], [38, 21], [42, 19], [4, 24], [19, 23], [23, 18], [18, 17], [25, 23]]) gf.set(x, y, 'o');

// ---- The oasis well ----
const gw = new Grid(36, 24, '.');
gw.mix(0, 0, 36, 24, '.', ',', 0.25).fill(10, 6, 16, 12, 'g').fill(9, 8, 1, 8, 'g').fill(26, 8, 1, 8, 'g').fill(12, 5, 12, 1, 'g').fill(12, 18, 12, 1, 'g');
// Sand the water kept from fusing: the only soft ground in the Glass.
for (const [x, y] of [[10, 6], [25, 6], [10, 17], [25, 17]]) gw.set(x, y, '.');
gw.set(18, 11, 'w').stamp(21, 13, ['~~~', '~~~~', ' ~~']);
shelter(gw, 3, 3, 6, 2);
shelter(gw, 27, 3, 6, 3);
shelter(gw, 4, 17, 5, 2);
shelter(gw, 28, 17, 5, 2);
gw.fill(0, 11, 10, 2, 'c').fill(26, 11, 10, 2, 'c');

// ---- The Relay quarry ----
const gq = new Grid(46, 30, '.');
gq.mix(0, 0, 46, 30, '.', ',', 0.25);
gq.hline(0, 0, 46, '#').hline(0, 29, 46, '#').vline(0, 1, 28, '#').fill(0, 19, 1, 4, '.');
gq.vline(29, 1, 28, '#').set(29, 14, 'G');
gq.vline(13, 1, 28, '#').set(13, 21, 'G');
gq.fill(14, 2, 15, 10, 'q').hline(14, 2, 15, 'F').set(20, 2, 'q').set(21, 2, 'q');
// The island plate inside a field of pits.
gq.fill(19, 19, 5, 5, 'X').set(21, 21, '.');
// The Warden's yard: Office flagstones and a records hut.
gq.fill(1, 8, 12, 15, 'O').hline(1, 7, 6, 'B').hline(1, 6, 6, 'B').set(3, 7, 'N');
// The outer quarry: an Office hut by the road and rocks.
gq.fill(38, 11, 5, 2, 'B').set(40, 12, 'N');
for (const [x, y] of [[37, 3], [42, 6], [38, 7], [43, 2], [37, 22], [42, 25], [39, 27], [44, 21], [33, 20], [34, 5]]) gq.set(x, y, 'o');
gq.set(31, 12, 'o');

const silvered: [number, number][] = [];
for (const y of [4, 8]) for (const x of [15, 17, 19, 21, 23, 25, 27]) silvered.push([x, y]);

export const CH4: MapDef[] = [
  {
    id: 'glass_flats', name: 'The glass flats', region: 'glass', music: 'glass', rows: gf.rows(), legend: GLASS,
    markers: { start: [44, 14], west: [1, 13], cave: [37, 9] },
    npcs: [
      { id: 'mirage_c1', art: 't_long_hat', pal: FADED, x: 6, y: 3, dir: 'down', talk: 'mirage_caravan', ghost: true },
      { id: 'mirage_c2', art: 't_long_hat', pal: FADED, x: 8, y: 3, dir: 'down', talk: 'mirage_caravan', ghost: true },
      { id: 'mirage_c3', art: 't_long_adult', pal: FADED, x: 10, y: 4, dir: 'down', talk: 'mirage_caravan', ghost: true },
      { id: 'mirage_b1', art: 't_office', pal: FADED, x: 14, y: 17, dir: 'right', talk: 'mirage_bearers', ghost: true },
      { id: 'mirage_b2', art: 't_office', pal: FADED, x: 15, y: 17, dir: 'left', talk: 'mirage_bearers', ghost: true },
      { id: 'mirage_k1', art: 't_long_adult', pal: FADED, x: 26, y: 15, dir: 'right', talk: 'mirage_cart', ghost: true },
    ],
    props: [
      { art: 'frame_cart', x: 27, y: 15, talk: 'mirage_cart', solid: false, lead: false },
      { art: 'mirror_old', x: 22, y: 6, talk: 'glass_old_mirror' },
      { art: 'mirror_old', x: 4, y: 19, talk: 'glass_old_mirror' },
      { art: 'stray', x: 42, y: 2, talk: 'stray_7', cond: '!stray7_carried', solid: false, lead: false },
    ],
    // The cave. Insight: the cave floor looks the same everywhere, so a pebble's lead has to find the holes before your feet do.
    // Solution: throw a pebble ahead before each stretch and walk the tiles where it lands on floor, to the stray at the back.
    hiddenPits: [[37, 6], [38, 5], [36, 4], [39, 3], [35, 2], [40, 6], [34, 5], [41, 4], [38, 2], [42, 3]],
    talks: [{ x: 36, y: 8, scene: 'glass_cave_mouth' }, { x: 38, y: 8, scene: 'glass_cave_mouth' }],
    lights: [{ x: 22, y: 5, r: 18, i: 0.3, color: 0xa9e4d6 }, { x: 15, y: 16, r: 16, i: 0.25, color: 0xa9e4d6 }],
    triggers: [{ x: 43, y: 13, h: 3, scene: 'ch4_open', cond: '!ch4_started' }],
    encounters: [
      { id: 'gf1', group: 'g_cats', art: 'miragecat', x: 11, y: 9, wander: 2 },
      { id: 'gf2', group: 'g_fish', art: 'silverfish', x: 21, y: 20, wander: 2 },
      { id: 'gf3', group: 'g_cats', art: 'miragecat', x: 37, y: 19, wander: 2 },
    ],
    exits: [{ x: 0, y: 13, h: 2, to: 'glass_well', at: 'east' }, { x: 45, y: 13, h: 3, to: 'solehold', at: 'west' }],
  },
  {
    id: 'glass_well', name: 'The oasis well', region: 'glass', music: 'minim', rows: gw.rows(), legend: GLASS,
    markers: { east: [34, 11], west: [1, 11] },
    npcs: [
      { id: 'minim', art: 'minim', x: 17, y: 12, dir: 'down', talk: 'ch4_minim_meet', cond: '!ch4_minim_joined' },
      { id: 'reviver', art: 't_silvered', pal: pal(C.gray, C.white), x: 7, y: 7, dir: 'down', talk: 'owner_7:talk_silvered_reviver' },
      { id: 'sees', art: 't_silvered', pal: pal(C.teal1, C.pale), x: 11, y: 15, wander: 1, talk: 'talk_silvered_sees' },
      { id: 'laval', art: 't_silvered', pal: pal(C.slate, C.teal3), x: 29, y: 8, dir: 'down', talk: 'owner_8:talk_sticks_glass' },
      { id: 'glazier', art: 't_face_adult', pal: pal(C.green2, C.umber2), x: 14, y: 19, dir: 'up', talk: 'talk_glass_shop' },
    ],
    props: [
      { art: 'dial_post', x: 20, y: 8, talk: 'post_glass' }, { art: 'sticks_table', x: 30, y: 8, talk: 'talk_sticks_glass' },
      { art: 'tree_orchard', x: 11, y: 7 }, { art: 'tree_orchard', x: 25, y: 7 }, { art: 'tree_orchard', x: 12, y: 16 },
      { art: 'tree_orchard', x: 24, y: 17 }, { art: 'tree_orchard', x: 15, y: 6 },
      { art: 'mirror_old', x: 33, y: 20, talk: 'glass_old_mirror' }, { art: 'barrel', x: 13, y: 19, lead: false },
    ],
    talks: [{ x: 18, y: 11, scene: 'glass_well_look' }],
    lights: [{ x: 18, y: 11, r: 18, i: 0.3, color: 0xa9e4d6 }, { x: 22, y: 14, r: 16, i: 0.2, color: 0xa9e4d6 }],
    triggers: [{ x: 24, y: 0, h: 24, scene: 'ch4_minim_meet', cond: '!ch4_minim_joined' }],
    exits: [
      { x: 35, y: 11, h: 2, to: 'glass_flats', at: 'west' },
      { x: 0, y: 11, h: 2, to: 'glass_quarry', at: 'east', cond: 'ch4_minim_joined', blocked: 'quarry_road_early' },
    ],
  },
  {
    id: 'glass_quarry', name: 'The Relay quarry', region: 'glass', music: 'glass_quarry', rows: gq.rows(), legend: GLASS,
    markers: {
      east: [44, 14], warden: [6, 12], warden_front: [6, 14], oldest_mirror: [3, 4], road_overhead: [1, 20], road_overhead2: [1, 21],
      rows: [21, 6], west: [1, 20],
    },
    npcs: rows(silvered),
    props: [
      { art: 'warden_frame', x: 6, y: 12, cond: '!anim_warden_last', lead: false },
      { art: 'mirror_old', x: 3, y: 4, lead: false },
      { art: 'stray', x: 3, y: 2, talk: 'stray_8', cond: '!stray8_carried', solid: false, lead: false },
      // Gate 1.
      { art: 'post', x: 34, y: 10 }, { art: 'crate', x: 32, y: 13 },
      // Gate 2: the tall mirror, and a crate whose lead falls short of the island.
      { art: 'mirror_old', x: 21, y: 17 }, { art: 'crate', x: 25, y: 18 },
      { art: 'barrel', x: 39, y: 13, lead: false }, { art: 'barrel', x: 8, y: 9, lead: false }, { art: 'barrel', x: 27, y: 25, lead: false },
    ],
    // Gate 1. Insight: the lamp turns every lead near it, so it has to stay out of reach of the post that already lights a plate.
    // Solution: push the crate east once and set the lamp on the tile diagonally south-east of it. The crate's lead swings north-west onto
    // the plate, and the lamp stands four tiles from the post, too far to turn it.
    // Gate 2. Insight: a tall thing's lead runs twice as far as a crate's, so only the tall mirror reaches the island across the pits.
    // Solution: set the lamp north of the tall mirror. Its lead swings south four tiles onto the island plate.
    plates: [
      { id: 'gq1a', x: 34, y: 8, flag: 'gq_gate1' }, { id: 'gq1b', x: 31, y: 11, flag: 'gq_gate1' },
      { id: 'gq2', x: 21, y: 21, flag: 'gq_gate2' },
    ],
    gates: [{ x: 29, y: 14, flag: 'gq_gate1', open: 'stile_gate_open' }, { x: 13, y: 21, flag: 'gq_gate2', open: 'stile_gate_open' }],
    lights: [
      { x: 3, y: 3, r: 26, i: 0.6, color: 0xa9e4d6, cond: 'anim_oldest_vision&!ch4_done' },
      { x: 21, y: 16, r: 16, i: 0.25, color: 0xa9e4d6 },
    ],
    triggers: [
      { x: 11, y: 1, h: 28, scene: 'ch4_warden', cond: '!ch4_freed' },
      { x: 10, y: 1, h: 28, scene: 'ch4_oldest_mirror', cond: 'ch4_freed&!ch4_done' },
      { x: 2, y: 19, h: 4, scene: 'ch4_leave', cond: 'ch4_done&!ch5_started' },
    ],
    encounters: [
      { id: 'gq_a', group: 'g_hounds_glass', art: 'panehound', x: 40, y: 4, wander: 2 },
      { id: 'gq_b', group: 'g_hulk', art: 'fusehulk', x: 40, y: 24, wander: 2 },
    ],
    exits: [
      { x: 45, y: 13, h: 3, to: 'glass_well', at: 'west' },
      { x: 0, y: 19, h: 4, to: 'overhead_gate', at: 'start', cond: 'ch5_started', blocked: 'overhead_road_early' },
    ],
  },
];
