// Chapter 3 maps: the road onto the Face, Solehold, and the Relay tower.
import type { MapDef, PropDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE, legend } from './kit';

const pal = (a: number, b: number) => [C.black, a, b] as [number, number, number];

export const BRIGHT = legend(STILE, {
  '.': { t: 'bright_sand', step: 'sand' }, ',': { t: 'bright_sand2', step: 'sand' }, _: { t: 'bright_path', step: 'dirt' },
  x: { t: 'bright_cracked', step: 'sand' }, h: { t: 'bright_heat', heat: true, step: 'sand' }, o: { t: 'bright_rock', solid: true },
  '#': { t: 'bright_adobe_wall', solid: true, wall: 8 }, R: { t: 'bright_adobe_roof', solid: true, wall: 12 },
  W: { t: 'bright_window', solid: true, wall: 8 }, D: { t: 'bright_door', step: 'wood' }, d: { t: 'bright_door', solid: true, wall: 8 },
  F: { t: 'bright_scaffold', solid: true, wall: 10 }, q: { t: 'bright_orchard', step: 'grass' },
  w: { t: 'bright_well', solid: true }, y: { t: 'bright_well_dry', solid: true }, p: { t: 'bright_planks', step: 'wood' },
  X: { t: 'bright_gap', pit: true }, s: { t: 'stile_stairs', step: 'stone' }, A: { t: 'market_awning_b', solid: true, wall: 5 },
  K: { t: 'market_counter', solid: true }, n: { t: 'under_floor', step: 'stone' }, N: { t: 'under_wall', solid: true },
  G: { t: 'stile_gate_closed', solid: true }, m: { t: 'bright_mirror_bed', solid: true },
  r: { t: 'bright_ripple', step: 'sand' }, u: { t: 'bright_furrow', step: 'dirt' }, T: { t: 'bright_footing', solid: true },
  // The ground two tiles north of a relay mast's footing. Its height is the mast's, so its lead starts just above the mirror.
  L: { t: 'bright_sand', wall: 56, step: 'sand' }, l: { t: 'bright_path', wall: 56, step: 'dirt' },
  // Walls with no height. edgeWalls puts them where a wall's lead would fall only on the same building.
  a: { t: 'bright_adobe_roof', solid: true }, c: { t: 'bright_adobe_wall', solid: true }, v: { t: 'bright_window', solid: true },
  k: { t: 'bright_door', solid: true }, z: { t: 'market_awning_b', solid: true }, j: { t: 'bright_scaffold', solid: true },
});
const BRIGHT_FLAT = { R: 'a', '#': 'c', W: 'v', d: 'k', A: 'z' };

/** Keeps a wall height only on wall tiles whose lead falls on open ground. */
export function edgeWalls(g: Grid, flat: Record<string, string>, dx: number, dy: number) {
  // Every wall tile shades itself and the tiles past it, so a building with a height on every tile draws as one block of shade.
  const walls = new Set([...Object.keys(flat), ...Object.values(flat)]);
  const src = g.rows();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const ch = src[y][x];
    const n = src[y + dy]?.[x + dx];
    if (ch in flat && n !== undefined && walls.has(n)) g.set(x, y, flat[ch]);
  }
}

/** An adobe hut: two rows of flat roof and a front with windows and an optional door. */
function hut(g: Grid, x: number, y: number, w: number, o: { door?: number; doorCh?: string; windows?: number[] } = {}) {
  g.hline(x, y, w, 'R').hline(x, y + 1, w, 'R').hline(x, y + 2, w, '#');
  for (const wx of o.windows ?? []) g.set(x + wx, y + 2, 'W');
  if (o.door !== undefined && o.door >= 0) g.set(x + o.door, y + 2, o.doorCh ?? 'd');
}

/** Orchard trees that lose their leaves when the tower's mirror falls on them. */
function orchardTrees(at: [number, number][]): PropDef[] {
  return at.flatMap(([x, y]) => [
    { art: 'tree_orchard', x, y, cond: '!anim_orchard_bare' },
    { art: 'tree_orchard_bare', x, y, cond: 'anim_orchard_bare' },
  ]);
}

// ---- The road onto the Face ----
const br = new Grid(46, 26, '.');
// Wind ripples in long bands.
for (const [x, y, n] of [[13, 1, 33], [30, 3, 16], [18, 10, 12], [32, 18, 5], [31, 21, 15], [31, 24, 15], [0, 25, 17], [17, 25, 14]]) br.hline(x, y, n, 'r');
// The Office nursery: furrows of Heliotrope seedlings between sand walks.
for (const y of [2, 4, 6, 8]) br.hline(2, y, 12, 'u');
// Two heat pans with cracked rims on either side of the road.
br.stamp(17, 3, [
  '   xxxxxx   ',
  ' xxhhhhhhxx ',
  'xhhhhhhhhhhx',
  'xhhhhhhhhhhx',
  ' xxhhhhhhxx ',
  '   xxxxxx   ',
]);
br.stamp(1, 17, [
  '  xxxxxxxxxx  ',
  ' xhhhhhhhhhhx ',
  'xhhhhhhhhhhhhx',
  'xhhhhhhhhhhhhx',
  'xhhhhhhhhhhhhx',
  ' xhhhhhhhhhhx ',
  '  xxxxxxxxxx  ',
]);
br.fill(30, 12, 16, 2, '_').fill(16, 14, 16, 2, '_').fill(30, 12, 2, 4, '_').fill(0, 12, 18, 2, '_').fill(16, 12, 2, 4, '_');
hut(br, 35, 5, 6, { door: 2, windows: [0, 4] });
// A ruined yard around a dry well.
br.fill(23, 19, 7, 5, 'x').hline(22, 18, 4, '#').hline(28, 18, 3, '#').vline(22, 18, 7, '#').vline(30, 18, 7, '#').hline(22, 24, 9, '#');
br.set(25, 24, 'x').set(26, 21, 'y');
// Rock outcrops with loose stones around them.
for (const [x, y] of [
  [0, 8], [0, 9], [1, 9], [31, 5], [32, 5], [32, 6], [44, 6], [45, 6], [45, 7],
  [42, 18], [43, 18], [43, 19], [44, 19], [41, 23], [42, 23], [18, 20], [18, 21], [19, 21],
  [15, 20], [15, 21], [16, 21], [0, 18], [0, 19], [5, 20], [11, 19],
]) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ('.r'.includes(br.get(x + dx, y + dy))) br.set(x + dx, y + dy, ',');
  br.set(x, y, 'o');
}
// The relay line: Office masts on footings south of the road. Each lead starts two tiles north of its footing.
const masts: [number, number][] = [[4, 16], [10, 16], [16, 17], [21, 17], [27, 17], [34, 16], [40, 16]];
for (const [x, y] of masts) br.set(x, y, 'T').set(x, y - 2, br.get(x, y - 2) === '_' ? 'l' : 'L');
// The last mast still stands in its scaffold.
br.set(39, 16, 'j').set(41, 16, 'j');
edgeWalls(br, BRIGHT_FLAT, 0, -1);
// Seedlings stand on every other tile of each furrow and alternate columns from row to row.
const nursery: PropDef[] = [2, 4, 6, 8].flatMap((y, i) => [0, 2, 4, 6, 8, 10].map((k) => ({ art: 'mirror_stalk', x: 2 + k + (i % 2 ? 0 : 1), y })));

// ---- Solehold ----
const so = new Grid(44, 30, '.');
so.mix(0, 0, 44, 30, '.', ',', 0.15);
so.vline(5, 0, 30, '#').vline(38, 0, 30, '#').hline(5, 2, 34, '#');
so.fill(0, 14, 44, 2, '_').fill(5, 13, 1, 4, '_').fill(38, 13, 1, 4, '_').fill(20, 2, 4, 1, '_').fill(21, 0, 2, 13, '_');
so.mix(17, 10, 14, 8, '_', 'x', 0.3).set(24, 12, 'w');
// The shade-goods stall: awning, the seller's row, and the counter.
so.hline(22, 7, 5, 'A').hline(22, 8, 5, '_').hline(22, 9, 5, 'K');
hut(so, 7, 8, 7, { door: 3, windows: [1, 5] });
hut(so, 31, 8, 6, { door: 3, windows: [1, 5] });
hut(so, 13, 4, 5, { door: 2 });
hut(so, 26, 3, 7, { door: 4, windows: [1, 6] });
// Lord Umbraculum's house, the biggest in town, with shade canopies on its front corners.
hut(so, 20, 19, 9, { door: 4, windows: [1, 2, 6, 7] });
so.set(20, 22, 'A').set(21, 22, 'A').set(27, 22, 'A').set(28, 22, 'A');
hut(so, 31, 23, 6, { door: 2, windows: [4] });
so.hline(30, 17, 4, 'A');
// The orchard, walled, with its gate onto the street.
so.fill(6, 19, 12, 9, 'q').hline(6, 18, 13, '#').vline(18, 18, 11, '#').hline(6, 28, 13, '#').set(12, 18, 'q');
edgeWalls(so, BRIGHT_FLAT, 0, -1);
const orchardAt: [number, number][] = [];
for (const x of [7, 10, 13, 16]) for (const y of [20, 23, 26]) orchardAt.push([x, y]);

// ---- The Relay tower ----
// One tall map: the orchard yard at the bottom, then the ground floor, two scaffold floors, and the open top.
const tw = new Grid(40, 32, '.');
tw.mix(0, 0, 40, 32, '.', ',', 0.2);
tw.fill(4, 0, 32, 27, 'p').vline(4, 0, 27, 'F').vline(35, 0, 27, 'F').hline(4, 0, 32, 'F');
tw.hline(4, 8, 32, 'F').hline(4, 14, 32, 'F').hline(4, 20, 32, 'F').hline(4, 26, 32, 'F');
tw.set(19, 26, 'p').set(20, 26, 'p');
tw.fill(0, 27, 16, 5, 'q');
// The cellar: a dark storeroom off the ground floor with stairs down at its door.
tw.fill(5, 21, 6, 5, 'n').vline(11, 21, 5, 'N').set(11, 24, 's');
// Floor 3: two gaps in the planks below the plates.
tw.set(19, 12, 'X').set(25, 12, 'X');
// The east gallery on floor 3, off the path.
tw.vline(28, 9, 5, 'F').set(28, 11, 'p');
// The open top: sun-baked planks and two beds of mirror flowers.
tw.mix(8, 1, 24, 4, 'p', 'h', 0.3).set(8, 3, 'm').set(31, 3, 'm');
tw.set(24, 20, 'G').set(8, 14, 'G').set(22, 8, 'G');
// Scaffold posts that hold the floors up.
for (const [x, y] of [[15, 22], [29, 22], [20, 16], [27, 18], [12, 10], [15, 12]]) tw.set(x, y, 'F');

export const CH3: MapDef[] = [
  {
    id: 'bright_road', name: 'The road onto the Face', region: 'bright', music: 'bright', rows: br.rows(), legend: BRIGHT,
    markers: { start: [44, 12], west: [1, 12], well: [26, 20] },
    npcs: [
      { id: 'linesman', art: 't_office', pal: pal(C.slate, C.umber2), x: 37, y: 10, dir: 'down', talk: 'owner_6:talk_linesman' },
      { id: 'trader', art: 't_face_adult', pal: pal(C.pale, C.rust3), x: 9, y: 11, dir: 'right', talk: 'talk_salt_trader' },
    ],
    props: [
      { art: 'mirror_tower', x: 1, y: 1 }, { art: 'mirror_tower', x: 11, y: 1 }, { art: 'mirror_tower', x: 29, y: 1 },
      { art: 'mirror_tower', x: 42, y: 10, talk: 'bright_tower_far' },
      ...masts.map(([x, y]) => ({ art: 'relay_mast', x, y, lead: false })),
      ...nursery,
      { art: 'crate', x: 34, y: 9, lead: false, solid: true }, { art: 'barrel', x: 41, y: 8, lead: false }, { art: 'barrel', x: 34, y: 7, lead: false },
      { art: 'barrel', x: 8, y: 10, lead: false }, { art: 'barrel', x: 10, y: 10, lead: false },
      { art: 'sign', x: 33, y: 11, talk: 'sign_relay' },
      { art: 'stray', x: 26, y: 21, talk: 'stray_5', cond: '!stray5_carried', solid: false, lead: false },
    ],
    talks: [{ x: 26, y: 21, scene: 'bright_well_dry' }],
    lights: [{ x: 42, y: 9, r: 22, i: 0.35, color: 0xfffff0 }],
    triggers: [
      { x: 43, y: 12, h: 2, scene: 'ch3_open', cond: '!ch3_started' },
      { x: 37, y: 0, h: 26, scene: 'ch3_linesman', cond: 'ch3_started&!ch3_linesman' },
    ],
    encounters: [
      { id: 'br1', group: 'g_ticks', art: 'suntick', x: 11, y: 5, wander: 2 },
      { id: 'br2', group: 'g_glarebacks', art: 'glareback', x: 38, y: 19, wander: 2 },
      { id: 'br3', group: 'g_wisps', art: 'heatwisp', x: 8, y: 19, wander: 2 },
    ],
    exits: [{ x: 0, y: 12, h: 2, to: 'solehold', at: 'east' }],
  },
  {
    id: 'solehold', name: 'Solehold', region: 'bright', music: 'solehold', rows: so.rows(), legend: BRIGHT,
    markers: {
      east: [42, 14], from_tower: [21, 3], orchard: [11, 22], orchard_gate: [12, 19], orchard_front: [12, 17],
      tower_line: [2, 8], road_glass: [2, 14], road_glass2: [3, 15], west: [1, 15],
    },
    npcs: [
      { id: 'umbraculum', art: 'umbraculum', x: 12, y: 19, dir: 'down', talk: 'talk_umbraculum_village', cond: '!ch3_umbra_joined' },
      { id: 'solechild', art: 't_sciapod', pal: pal(C.teal2, C.umber2), x: 15, y: 17, wander: 1, talk: 'owner_5:talk_sole_child' },
      { id: 'elder', art: 't_sciapod', pal: pal(C.pale, C.umber1), x: 29, y: 20, dir: 'left', talk: 'talk_sole_elder' },
      { id: 'pellucid', art: 't_sciapod', pal: pal(C.gold1, C.rust3), x: 31, y: 18, dir: 'right', talk: 'talk_sticks_solehold' },
      { id: 'shopkeep', art: 't_sciapod', pal: pal(C.rust2, C.gold3), x: 24, y: 8, dir: 'down', talk: 'talk_solehold_shop' },
      { id: 'renter', art: 't_face_adult', pal: pal(C.teal3, C.umber1), x: 34, y: 15, wander: 2, talk: 'talk_solehold_renter' },
    ],
    props: [
      ...orchardTrees(orchardAt),
      { art: 'mirror_shards', x: 9, y: 21, solid: false, lead: false, cond: 'anim_mirror_fall' },
      { art: 'mirror_shards', x: 14, y: 24, solid: false, lead: false, cond: 'anim_mirror_fall' },
      { art: 'mirror_shards', x: 11, y: 27, solid: false, lead: false, cond: 'anim_mirror_fall' },
      { art: 'dial_post', x: 27, y: 11, talk: 'post_solehold' }, { art: 'sticks_table', x: 32, y: 18, talk: 'talk_sticks_solehold' },
      { art: 'mirror_tower', x: 2, y: 4 }, { art: 'mirror_tower', x: 1, y: 8 }, { art: 'mirror_tower', x: 3, y: 11 },
      { art: 'mirror_tower', x: 30, y: 0 },
      { art: 'barrel', x: 37, y: 27, talk: 'solehold_cache', cond: '!solehold_cache', lead: false },
      { art: 'barrel', x: 14, y: 11, lead: false }, { art: 'barrel', x: 36, y: 11, lead: false },
    ],
    lights: [
      { x: 11, y: 23, r: 46, i: 0.9, color: 0xffffff, cond: 'anim_glare_sweep&!ch3_done' },
      { x: 24, y: 12, r: 14, i: 0.25, color: 0xa9e4d6 },
    ],
    triggers: [
      { x: 39, y: 13, h: 4, scene: 'ch3_solehold_arrive', cond: '!ch3_met_umbra' },
      { x: 30, y: 3, h: 26, scene: 'ch3_glare', cond: 'ch3_met_umbra&!ch3_umbra_joined' },
      { x: 20, y: 4, w: 4, scene: 'umbra_shade_lesson', cond: 'ch3_umbra_joined&!ch3_shade_lesson' },
      { x: 6, y: 13, h: 4, scene: 'ch3_towers_on', cond: 'ch3_done&!ch3_towers_seen' },
      { x: 2, y: 13, h: 4, scene: 'ch3_leave', cond: 'ch3_done&!ch4_started' },
    ],
    exits: [
      { x: 43, y: 13, h: 4, to: 'bright_road', at: 'west' },
      { x: 20, y: 0, w: 4, to: 'relay_tower', at: 'start', cond: 'ch3_umbra_joined', blocked: 'tower_road_early' },
      { x: 0, y: 13, h: 4, to: 'glass_flats', at: 'start', cond: 'ch4_started', blocked: 'glass_road_early' },
    ],
  },
  {
    id: 'relay_tower', name: 'The Relay tower', region: 'bright', music: 'relay_tower', rows: tw.rows(), legend: BRIGHT,
    markers: { start: [20, 29], orchard: [8, 29], heliotrope: [22, 2], hall: [20, 24], floor2: [24, 19], floor3: [8, 13], top: [22, 7] },
    props: [
      ...orchardTrees([[2, 28], [5, 28], [8, 28], [11, 28], [14, 28], [3, 31], [9, 31], [13, 31]]),
      { art: 'mirror_shards', x: 6, y: 29, solid: false, lead: false, cond: 'anim_mirror_fall' },
      { art: 'mirror_shards', x: 10, y: 30, solid: false, lead: false, cond: 'anim_mirror_fall' },
      { art: 'mirror_shards', x: 12, y: 29, solid: false, lead: false, cond: 'anim_mirror_fall' },
      { art: 'heliotrope_stalk', x: 22, y: 2, cond: '!ch3_done', lead: false },
      { art: 'mirror_tower', x: 18, y: 2, cond: '!anim_mirror_fall', lead: false }, { art: 'mirror_tower', x: 26, y: 2, cond: '!anim_mirror_fall', lead: false },
      { art: 'mirror_tower', x: 1, y: 6 }, { art: 'mirror_tower', x: 38, y: 12 }, { art: 'mirror_tower', x: 37, y: 24 },
      // Ground floor puzzle.
      { art: 'crate', x: 19, y: 24 },
      // Floor 2 puzzle.
      { art: 'crate', x: 15, y: 17 },
      // Floor 3 puzzle.
      { art: 'crate', x: 21, y: 12 }, { art: 'crate', x: 23, y: 10 },
      { art: 'barrel', x: 33, y: 25, lead: false }, { art: 'barrel', x: 6, y: 18, lead: false }, { art: 'barrel', x: 33, y: 9, lead: false },
      { art: 'stray', x: 6, y: 22, talk: 'stray_6', cond: '!stray6_carried', solid: false, lead: false },
    ],
    // Ground floor. Insight: out here a crate's lead reaches one tile, straight north.
    // Solution: push the crate east five times and north once, so it stands just south of the plate.
    // Floor 2. Insight: the plate sits against the south wall where the sun never sends a lead, so the lamp sends one south.
    // Solution: push the crate west three times, then set the lamp two tiles north of it.
    // Floor 3. Insight: the lamp sends every nearby lead away from itself, so it belongs between the two crates.
    // Solution: push the lower crate north and the upper crate south into the plates' row, then set the lamp between them.
    plates: [
      { id: 'rt1', x: 24, y: 22, flag: 'rt_gate1' },
      { id: 'rt2', x: 12, y: 19, flag: 'rt_gate2' },
      { id: 'rt3a', x: 19, y: 11, flag: 'rt_gate3' }, { id: 'rt3b', x: 25, y: 11, flag: 'rt_gate3' },
    ],
    gates: [
      { x: 24, y: 20, flag: 'rt_gate1', open: 'stile_stairs' },
      { x: 8, y: 14, flag: 'rt_gate2', open: 'stile_stairs' },
      { x: 22, y: 8, flag: 'rt_gate3', open: 'stile_stairs' },
    ],
    lights: [{ x: 22, y: 2, r: 44, i: 0.6, color: 0xffffff, cond: '!anim_mirror_fall' }],
    talks: [{ x: 18, y: 26, scene: 'tower_door' }, { x: 21, y: 26, scene: 'tower_door' }, { x: 8, y: 3, scene: 'tower_flower' }, { x: 31, y: 3, scene: 'tower_flower' }],
    triggers: [
      { x: 19, y: 25, w: 2, scene: 'relay_stub_hint', cond: '!relay_hint' },
      { x: 5, y: 5, w: 30, scene: 'ch3_heliotrope', cond: '!ch3_done' },
    ],
    encounters: [
      { id: 'rt_a', group: 'g_linesmen', art: 't_office', x: 31, y: 23, wander: 1 },
      { id: 'rt_b', group: 'g_tower_mix', art: 'glareback', x: 31, y: 17, wander: 1 },
      { id: 'rt_tall', group: 'g_tallman', art: 'tallman', x: 32, y: 11, wander: 1 },
    ],
    exits: [{ x: 19, y: 31, w: 3, to: 'solehold', at: 'from_tower' }],
  },
];
