// Chapter 5 maps: the noon gate, the festival city of Overhead, and the First Mirror.
import type { MapDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE, legend } from './kit';

const pal = (a: number, b: number) => [C.black, a, b] as [number, number, number];

export const OVERHEAD = legend(STILE, {
  '.': { t: 'overhead_stone', step: 'stone' }, ',': { t: 'overhead_stone2', step: 'stone' }, f: { t: 'overhead_festival', step: 'stone' },
  b: { t: 'overhead_bunting', solid: true, wall: 8 }, M: { t: 'overhead_mirror_wall', solid: true, wall: 12 },
  R: { t: 'overhead_roof', solid: true, wall: 14 }, '#': { t: 'overhead_wall', solid: true, wall: 8 },
  W: { t: 'overhead_window', solid: true, wall: 8 }, D: { t: 'overhead_door', step: 'wood' }, d: { t: 'overhead_door', solid: true, wall: 8 },
  A: { t: 'overhead_awning', solid: true, wall: 5 }, K: { t: 'market_counter', solid: true }, '~': { t: 'stile_water', water: true },
  m: { t: 'first_mirror', solid: true }, G: { t: 'stile_gate_closed', solid: true },
  g: { t: 'glass_floor', step: 'glass' }, h: { t: 'glass_floor2', step: 'glass' },
  k: { t: 'overhead_slate', step: 'stone' }, i: { t: 'overhead_chalk_a', step: 'stone' }, j: { t: 'overhead_chalk_b', step: 'stone' },
  u: { t: 'overhead_chalk_c', step: 'stone' }, v: { t: 'overhead_chalk_d', step: 'stone' },
  U: { t: 'overhead_dial', step: 'stone' }, I: { t: 'overhead_dial_ring', step: 'stone' }, J: { t: 'overhead_hour', step: 'stone' },
  x: { t: 'overhead_streamer_a', under: 'overhead_stone', step: 'stone' }, y: { t: 'overhead_streamer_b', under: 'overhead_stone', step: 'stone' },
  a: { t: 'overhead_awning_b', solid: true }, c: { t: 'overhead_awning_c', solid: true },
});

/** A pennant string along a street in two alternating colors. */
function garland(g: Grid, x: number, y: number, n: number) {
  for (let k = 0; k < n; k++) g.set(x + k, y, (x + k) % 2 ? 'x' : 'y');
}

/** A market stall three rows deep: awning, the keeper's row between two posts, and the counter. */
function stall(g: Grid, x: number, y: number, w: number, awning: string) {
  g.hline(x, y, w, awning).hline(x, y + 1, w, ',').set(x, y + 1, awning).set(x + w - 1, y + 1, awning).hline(x, y + 2, w, 'K');
}

/** Draws the noon dial around (cx, cy): a gold face inside a pink ring with twelve white hour marks. */
function noonDial(g: Grid, cx: number, cy: number) {
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 3.6) g.set(x, y, 'U');
    else if (d <= 5) g.set(x, y, 'I');
  }
  for (let k = 0; k < 12; k++) g.set(Math.round(cx + 4.3 * Math.cos(k * Math.PI / 6)), Math.round(cy + 4.3 * Math.sin(k * Math.PI / 6)), 'J');
}

/** A white house with a pink roof. */
function house(g: Grid, x: number, y: number, w: number, o: { door?: number; windows?: number[] } = {}) {
  g.hline(x, y, w, 'R').hline(x, y + 1, w, 'R').hline(x, y + 2, w, '#');
  for (const wx of o.windows ?? []) g.set(x + wx, y + 2, 'W');
  if (o.door !== undefined && o.door >= 0) g.set(x + o.door, y + 2, 'd');
}

// ---- The noon gate ----
const og = new Grid(36, 22, '.');
// The Glass ends in a stepped edge at the city. Its streaked panes lie in diagonal bands.
for (let y = 0; y < 22; y++) for (let x = 27 + [0, 1, 1, 0][y % 4]; x < 36; x++) og.set(x, y, (x + y) % 5 ? 'g' : 'h');
og.vline(24, 0, 22, 'f');
// Slate just inside the noon line. Children chalk the outlines of people who have just lost their leads here.
og.fill(18, 3, 6, 16, 'k');
for (const [x, y, ch] of [
  [19, 4, 'i'], [21, 4, 'j'], [23, 4, 'i'], [20, 6, 'j'], [22, 6, 'i'], [19, 8, 'i'], [22, 8, 'j'],
  [19, 13, 'j'], [21, 13, 'i'], [23, 14, 'j'], [20, 15, 'i'], [22, 16, 'i'], [19, 17, 'j'], [21, 17, 'v'],
] as [number, number, string][]) og.set(x, y, ch);
og.vline(6, 0, 22, 'b').fill(6, 9, 1, 4, '.');
// The festival lanterns hang on pennant strings along both sides of the road.
garland(og, 7, 8, 11);
garland(og, 7, 13, 11);
house(og, 0, 1, 6, { windows: [2] });
house(og, 0, 15, 6, { windows: [1, 4] });
og.fill(0, 19, 6, 3, 'f');

// ---- Overhead ----
const oh = new Grid(48, 32, '.');
oh.hline(0, 0, 48, 'b').set(38, 0, '.').set(39, 0, '.');
// The festival square holds the noon dial. Pink tiles lead to it from the east road and from the mirror house door.
oh.fill(17, 11, 15, 11, 'f');
noonDial(oh, 24, 16);
oh.hline(32, 15, 16, 'f').vline(24, 9, 2, 'f');
// The chalk court south of the square: slate where the children draw people.
oh.fill(16, 22, 14, 5, 'k');
for (const [x, y, ch] of [[17, 23, 'i'], [18, 25, 'j'], [24, 25, 'i'], [25, 23, 'j'], [26, 25, 'i'], [16, 25, 'v']] as [number, number, string][]) oh.set(x, y, ch);
oh.vline(28, 22, 5, 'u');
// The mirror house: a pink roof over a front of mirrors, with one door.
oh.fill(16, 1, 17, 3, 'R').fill(16, 4, 17, 5, 'M').set(24, 8, 'D');
// The back alley along the mirror house's west side.
oh.vline(13, 1, 9, 'b');
house(oh, 2, 2, 7, { door: 3, windows: [1, 5] });
house(oh, 2, 7, 8, { door: 2, windows: [5] });
house(oh, 35, 2, 7, { door: 4, windows: [1, 2] });
house(oh, 42, 6, 6, { door: 2, windows: [4] });
house(oh, 2, 19, 7, { door: 3, windows: [1, 5] });
house(oh, 9, 25, 6, { door: 2, windows: [4] });
house(oh, 1, 27, 6, { windows: [2] });
// The lantern seller's stall on the avenue and two more stalls under paper suns.
stall(oh, 34, 11, 5, 'A');
stall(oh, 40, 10, 5, 'a');
stall(oh, 10, 12, 4, 'c');
// Bunting strung between houses and pennant strings along the house fronts.
oh.hline(9, 4, 4, 'b').hline(42, 2, 6, 'b').hline(2, 24, 6, 'b').hline(16, 27, 14, 'b');
garland(oh, 1, 10, 12);
garland(oh, 33, 5, 9);
garland(oh, 42, 9, 6);
// The festival storeroom and its courtyard.
oh.fill(43, 19, 5, 5, '#').hline(43, 18, 5, 'R').fill(44, 20, 3, 3, ',').set(43, 21, 'G');
oh.vline(32, 18, 14, 'b').hline(32, 31, 16, 'b').hline(32, 17, 11, 'b').set(36, 17, '.').set(37, 17, '.');

// ---- The First Mirror ----
const fm = new Grid(24, 20, '.');
fm.mix(0, 0, 24, 20, '.', ',', 0.25).border('M').fill(8, 1, 8, 3, 'm');
fm.set(11, 19, '.').set(12, 19, '.').set(0, 7, 'd');
// Four mirror pillars, so the Keeper's room has something to stand behind.
fm.set(5, 9, 'M').set(18, 9, 'M').set(5, 15, 'M').set(18, 15, 'M');

const chalkOutline = [19, 20, 21, 22].map((x) => ({ art: 'chalk_mark', x, y: 26, solid: false, lead: false, cond: 'anim_chalk_outline' }));

export const CH5: MapDef[] = [
  {
    id: 'overhead_gate', name: 'The noon line', region: 'overhead', music: 'overhead', rows: og.rows(), legend: OVERHEAD,
    markers: { start: [34, 10], gate_line: [24, 10], west: [1, 10] },
    props: [
      { art: 'sign', x: 25, y: 8, talk: 'noon_line' },
      ...[10, 14, 18].flatMap((x) => [{ art: 'festival_lantern', x, y: 8, lead: false }, { art: 'festival_lantern', x, y: 13, lead: false }]),
      { art: 'paper_sun', x: 6, y: 8 }, { art: 'paper_sun', x: 6, y: 13 },
      { art: 'mirror_tower', x: 31, y: 3 }, { art: 'mirror_tower', x: 33, y: 17 },
    ],
    lights: [{ x: 12, y: 10, r: 30, i: 0.25, color: 0xf6bfd0 }],
    triggers: [{ x: 33, y: 0, h: 22, scene: 'ch5_open', cond: '!ch5_started' }],
    exits: [{ x: 0, y: 9, h: 4, to: 'overhead', at: 'east' }, { x: 35, y: 9, h: 4, to: 'glass_quarry', at: 'west' }],
  },
  {
    id: 'overhead', name: 'Overhead', region: 'overhead', music: 'overhead', rows: oh.rows(), legend: OVERHEAD,
    markers: {
      east: [46, 15], mirror_out: [24, 9], chalk_stand: [19, 24], chalk_stand2: [20, 24], chalk_stand3: [21, 24], chalk_stand4: [22, 24],
      chalk_outline: [20, 26], back_alley: [15, 8], alley_mid: [15, 5], alley_end: [14, 1], north_road: [38, 1],
    },
    npcs: [
      { id: 'gambler', art: 't_overhead', pal: pal(C.pink0, C.rust3), x: 10, y: 17, dir: 'right', talk: 'talk_overhead_gambler' },
      { id: 'dancer', art: 't_overhead', pal: pal(C.pink2, C.umber1), x: 21, y: 18, wander: 2, talk: 'talk_overhead_dancer' },
      { id: 'seller', art: 't_overhead', pal: pal(C.gold2, C.pink2), x: 36, y: 12, dir: 'down', talk: 'talk_overhead_seller' },
      { id: 'guard', art: 't_office', pal: pal(C.blue1, C.umber2), x: 26, y: 9, dir: 'down', talk: 'talk_overhead_guard' },
      { id: 'whim', art: 't_overhead', pal: pal(C.teal2, C.gold3), x: 28, y: 20, dir: 'right', talk: 'talk_sticks_overhead' },
      { id: 'chalkchild', art: 't_long_child', pal: pal(C.pink1, C.umber2), x: 20, y: 22, dir: 'down', talk: 'ch5_chalk', cond: '!ch5_reveal' },
      { id: 'chalkchild', art: 't_long_child', pal: pal(C.pink1, C.umber2), x: 20, y: 22, dir: 'down', talk: 'talk_chalk_child_after', cond: 'ch5_reveal' },
    ],
    props: [
      { art: 'dial_post', x: 16, y: 13, talk: 'post_overhead' }, { art: 'sticks_table', x: 29, y: 20, talk: 'talk_sticks_overhead' },
      ...chalkOutline,
      { art: 'ribbon_gnomon', x: 24, y: 16 },
      ...[[33, 11], [39, 11], [45, 11], [14, 13]].map(([x, y]) => ({ art: 'paper_sun', x, y })),
      ...[[17, 11], [31, 11], [17, 21], [31, 21], [12, 15], [41, 13], [8, 12], [44, 16], [27, 24], [11, 22]].map(([x, y]) => ({ art: 'festival_lantern', x, y, lead: false })),
      { art: 'barrel', x: 46, y: 20, talk: 'overhead_cache', cond: '!overhead_cache', lead: false },
      // The storeroom puzzle.
      { art: 'crate', x: 38, y: 21 }, { art: 'crate', x: 40, y: 27 }, { art: 'crate', x: 34, y: 26 },
    ],
    // Storeroom. Insight: nothing here casts a lead, so one lamp in the middle has to send three crates' leads three ways at once.
    // Solution: push the north crate south twice, the west crate east three times, and the south crate north twice, then set
    // the lamp on the open tile they surround. Its three leads fall north, east, and south-west onto the three plates.
    plates: [{ id: 'os1', x: 38, y: 22, flag: 'oh_store' }, { id: 'os2', x: 41, y: 25, flag: 'oh_store' }, { id: 'os3', x: 35, y: 28, flag: 'oh_store' }],
    gates: [{ x: 43, y: 21, flag: 'oh_store', open: 'overhead_stone' }],
    talks: [{ x: 24, y: 8, scene: 'mirror_house_door' }, { x: 20, y: 8, scene: 'mirror_house_wall' }, { x: 28, y: 8, scene: 'mirror_house_wall' }],
    lights: [{ x: 24, y: 6, r: 34, i: 0.3, color: 0xfff0f4 }],
    triggers: [{ x: 38, y: 1, w: 2, scene: 'ch5_leave', cond: 'ch5_done&!ch6_started' }],
    encounters: [
      { id: 'oh1', group: 'g_gamblers', art: 't_overhead', x: 7, y: 13, wander: 2 },
      { id: 'oh2', group: 'g_birds', art: 'noonbird', x: 26, y: 29, wander: 2 },
      { id: 'oh3', group: 'g_bearers', art: 't_office', x: 9, y: 22, wander: 1 },
    ],
    exits: [
      { x: 47, y: 15, h: 2, to: 'overhead_gate', at: 'west' },
      { x: 24, y: 8, to: 'first_mirror', at: 'door', cond: 'ch5_plan_known', blocked: 'mirror_house_door' },
      { x: 38, y: 0, w: 2, to: 'dusk_road', at: 'start', cond: 'ch6_started', blocked: 'dusk_road_early' },
    ],
  },
  {
    id: 'first_mirror', name: 'The First Mirror', region: 'overhead', music: 'first_mirror', rows: fm.rows(), legend: OVERHEAD,
    markers: {
      door: [12, 17], keeper: [12, 6], mirror_door: [11, 18], mirror_door2: [12, 18], mirror_door3: [13, 18],
      mirror_inside: [11, 16], mirror_inside2: [12, 16], mirror_inside3: [13, 16], between: [12, 14], parhelia_side: [13, 14],
      back_way: [2, 7], back_way2: [3, 7], back_way3: [2, 8],
    },
    npcs: [
      { id: 'bearer1', art: 't_office', pal: pal(C.blue1, C.rust3), x: 11, y: 18, cond: 'cast_only' },
      { id: 'bearer2', art: 't_office', pal: pal(C.blue1, C.umber1), x: 13, y: 18, cond: 'cast_only' },
    ],
    props: [{ art: 'keeper_robe', x: 12, y: 6, cond: '!ch5_parhelia_taken', lead: false }],
    lights: [{ x: 12, y: 2, r: 64, i: 0.8, color: 0xfff0f4 }],
    talks: [{ x: 0, y: 7, scene: 'locked_door' }],
    triggers: [{ x: 1, y: 11, w: 22, scene: 'ch5_keeper', cond: '!ch5_parhelia_taken' }],
    exits: [{ x: 11, y: 19, w: 2, to: 'overhead', at: 'mirror_out' }],
  },
];
