// Chapter 2 maps: the Long road, the Lead Market, the forger alleys, and the Underbridge.
import type { MapDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE, legend } from './kit';

const pal = (a: number, b: number) => [C.black, a, b] as [number, number, number];

export const MARKET = legend(STILE, {
  ':': { t: 'market_cobble', step: 'stone' }, ';': { t: 'market_cobble2', step: 'stone' },
  '~': { t: 'market_canal', water: true }, e: { t: 'market_canal_edge', water: true },
  Y: { t: 'market_bridge', step: 'wood' },
  A: { t: 'market_awning_a', solid: true, wall: 5 }, a: { t: 'market_awning_b', solid: true, wall: 5 },
  K: { t: 'market_counter', solid: true }, F: { t: 'market_felt', step: 'wood' },
  H: { t: 'market_wall', solid: true, wall: 8 }, R: { t: 'market_roof', solid: true, wall: 14 }, '^': { t: 'market_roof', solid: true, wall: 15 },
  W: { t: 'market_window', solid: true, wall: 8 }, D: { t: 'market_door', step: 'wood' }, V: { t: 'market_arch', step: 'stone' },
});

export const UNDER = legend(STILE, {
  u: { t: 'under_floor', step: 'stone' }, v: { t: 'under_floor2', step: 'stone' },
  '#': { t: 'under_wall', solid: true }, I: { t: 'under_pillar', solid: true },
  '~': { t: 'under_water', water: true }, Z: { t: 'under_grate', solid: true },
});

// ---- The Long road ----
const road = new Grid(48, 20, '.');
road.mix(0, 0, 48, 20, '.', ',', 0.25).scatter(0, 0, 48, 20, '.', '"', 0.04, 5);
road.fill(0, 9, 48, 2, '=');
road.stamp(2, 2, ['ffffffff', 'ffffffff', 'ffffffff']).stamp(14, 13, ['ffffffffff', 'ffffffffff', 'ffffffffff', 'ffffffffff']);
road.hline(1, 1, 10, '-').hline(1, 5, 10, '-').hline(13, 12, 12, '-');
// A fenced seed garden with a plate inside and a gate in its fence.
road.hline(32, 2, 7, '-').hline(32, 6, 7, '-').vline(32, 2, 5, '|').vline(38, 2, 5, '|').set(35, 6, 'G');
road.stamp(4, 15, ['~~~', '~~~~', ' ~~']);
for (const [x, y] of [[26, 4], [44, 16], [6, 12], [29, 16]]) road.set(x, y, 'o');

// ---- The Lead Market ----
const mk = new Grid(40, 30, ':');
mk.mix(0, 0, 40, 30, ':', ';', 0.2);
mk.fill(0, 18, 40, 2, '~').fill(0, 17, 40, 1, 'e').fill(19, 17, 3, 3, 'Y');
mk.fill(30, 9, 10, 2, '=');
mk.house(1, 1, 7, { door: 3, windows: [1, 5] }).house(9, 1, 6, { door: -1, windows: [1, 4] }).house(26, 1, 7, { door: 3, windows: [1, 5] }).house(34, 1, 6, { door: -1, windows: [2] });
// Stalls: an awning row, the seller's row under it, and a counter row in front.
for (const [x, y, w] of [[9, 5, 5], [17, 5, 5], [25, 5, 4], [9, 11, 4], [17, 11, 5], [26, 11, 4]] as [number, number, number][]) {
  for (let i = 0; i < w; i++) mk.set(x + i, y, i % 2 ? 'a' : 'A');
  mk.hline(x, y + 1, w, 'F');
  mk.hline(x, y + 2, w, 'K');
}
mk.vline(0, 6, 9, 'H').set(0, 9, 'V').set(0, 10, 'V');
mk.house(2, 22, 8, { door: -1, windows: [2, 5] }).house(28, 22, 9, { door: 4, windows: [1, 7] });
mk.fill(10, 21, 18, 1, 'H').set(20, 21, 'D');
mk.fill(0, 25, 3, 2, '=');

// ---- The alleys ----
const al = new Grid(30, 20, ':');
al.mix(0, 0, 30, 20, ':', ';', 0.25);
al.house(0, 0, 9, { door: -1, windows: [2, 6] }).house(11, 0, 8, { door: -1, windows: [3] }).house(21, 0, 9, { door: -1, windows: [2, 6] });
al.house(0, 6, 6, { door: -1, windows: [2] }).house(9, 6, 7, { door: -1, windows: [1, 5] }).house(19, 6, 7, { door: -1, windows: [3] });
al.house(0, 13, 8, { door: -1, windows: [3] }).house(11, 13, 7, { door: -1, windows: [2] }).house(21, 13, 9, { door: -1, windows: [4] });
al.fill(0, 16, 30, 4, 'H');
al.fill(6, 9, 3, 4, ':').fill(16, 9, 3, 4, ':');

// ---- The Underbridge ----
const ub = new Grid(36, 18, 'u');
ub.mix(0, 0, 36, 18, 'u', 'v', 0.2).border('#');
ub.set(35, 8, 'u').set(35, 9, 'u');
// Room 1: a grate with a plate behind it.
ub.vline(24, 1, 16, '#').set(24, 8, 'Z').set(24, 9, 'Z');
ub.stamp(26, 3, ['~~', '~~~']);
// Room 2: two plates, a crate, and a post.
ub.vline(12, 1, 16, '#').set(12, 8, 'Z').set(12, 9, 'Z');
for (const [x, y] of [[16, 3], [20, 14], [6, 4], [6, 13]]) ub.set(x, y, 'I');
ub.stamp(2, 7, ['~~', '~~~', '~~']);

export const CH2: MapDef[] = [
  {
    id: 'road1', name: 'The Long road', region: 'road', music: 'road', rows: road.rows(), legend: STILE,
    markers: { start: [46, 9], road_side: [44, 10], west_end: [1, 9] },
    npcs: [
      { id: 'drover', art: 't_long_hat', pal: pal(C.umber1, C.gold3), x: 20, y: 11, wander: 2, talk: 'owner_3:talk_drover' },
      { id: 'traveler', art: 't_face_adult', pal: pal(C.teal2, C.umber1), x: 9, y: 8, dir: 'right', talk: 'talk_traveler' },
    ],
    props: [
      { art: 'dial_post', x: 30, y: 8, talk: 'post_road1' }, { art: 'sign', x: 24, y: 8, talk: 'talk_waystone' },
      { art: 'post', x: 35, y: 8 }, { art: 'barrel', x: 35, y: 3, talk: 'road_cache', cond: '!road_cache' },
      { art: 'tree_gold', x: 12, y: 2 }, { art: 'tree_gold', x: 41, y: 4 }, { art: 'tree_gold', x: 46, y: 14 }, { art: 'tree_gold', x: 2, y: 17 },
      { art: 'stray', x: 4, y: 11, talk: 'stray_3', cond: '!stray3_carried', solid: false, lead: false },
    ],
    plates: [{ id: 'r1', x: 35, y: 4, flag: 'r1_gate' }],
    gates: [{ x: 35, y: 6, flag: 'r1_gate', open: 'stile_gate_open' }],
    talks: [{ x: 46, y: 8, scene: 'road_lead' }],
    triggers: [{ x: 33, y: 9, w: 5, h: 2, scene: 'road1_lamp_hint', cond: '!road1_hint' }],
    encounters: [
      { id: 'r1a', group: 'g_road_hounds', art: 'leadhound', x: 14, y: 4, wander: 2 },
      { id: 'r1b', group: 'g_road_mix', art: 'shalecrab', x: 22, y: 16, wander: 2 },
      { id: 'r1c', group: 'g_cutpurses', art: 't_long_adult', x: 6, y: 7, wander: 1 },
    ],
    exits: [{ x: 0, y: 9, h: 2, to: 'market', at: 'east' }],
    enterScene: 'road1_enter',
  },
  {
    id: 'market', name: 'The Shadow Market', region: 'market', music: 'market', rows: mk.rows(), legend: MARKET,
    markers: {
      east: [38, 9], market_gate: [36, 9], lot_board: [10, 6], stall_front: [11, 8], stall_side: [14, 8], alley_far: [2, 9], alley_mid: [6, 9],
      arch_in: [1, 9], under_stairs: [20, 22], market_sun_exit: [1, 25], from_under: [20, 22], west_exit: [1, 25],
    },
    npcs: [
      { id: 'fennick', art: 'fennick', x: 11, y: 6, dir: 'down', talk: 'talk_fennick' },
      { id: 'hatter', art: 't_long_hat', pal: pal(C.plum2, C.gold3), x: 19, y: 6, dir: 'down', talk: 'talk_hatter' },
      { id: 'bearer_stall', art: 't_office', pal: pal(C.blue1, C.umber2), x: 26, y: 6, dir: 'down', talk: 'talk_bearer_stall' },
      { id: 'dicer', art: 't_long_adult', pal: pal(C.rust1, C.pink2), x: 10, y: 12, dir: 'down', talk: 'talk_dicer' },
      { id: 'seller', art: 't_long_adult', pal: pal(C.teal1, C.gold3), x: 19, y: 12, dir: 'down', talk: 'talk_seller' },
      { id: 'kid', art: 't_long_child', pal: pal(C.gold1, C.umber1), x: 6, y: 14, wander: 2, talk: 'talk_market_kid' },
      { id: 'gilder', art: 't_long_hat', pal: pal(C.green1, C.rust3), x: 27, y: 12, dir: 'down', talk: 'talk_sticks_market' },
      { id: 'apprentice', art: 't_long_child', pal: pal(C.plum2, C.pink2), x: 23, y: 8, dir: 'down', wander: 1, talk: 'owner_4:talk_apprentice' },
      { id: 'mfolk1', art: 't_long_hat', pal: pal(C.slate, C.umber2), x: 15, y: 9, wander: 3, talk: 'talk_mfolk1' },
      { id: 'mfolk2', art: 't_long_hat', pal: pal(C.rust2, C.gold3), x: 30, y: 15, wander: 3, talk: 'talk_mfolk2' },
    ],
    props: [
      { art: 'stray', x: 10, y: 6, talk: 'talk_fennick', solid: true, lead: false }, { art: 'stall_lamp', x: 29, y: 8, lead: false, solid: true },
      { art: 'dial_post', x: 8, y: 15, talk: 'post_market' }, { art: 'sticks_table', x: 28, y: 14, talk: 'talk_sticks_market' },
      { art: 'hat_rack', x: 22, y: 7 }, { art: 'barrel', x: 33, y: 15 }, { art: 'crate', x: 4, y: 15, lead: true },
      { art: 'lamp_post', x: 16, y: 16 }, { art: 'lamp_post', x: 24, y: 16 }, { art: 'stray', x: 16, y: 6, talk: 'stray_4', cond: '!stray4_carried', solid: false, lead: false },
    ],
    lights: [{ x: 29, y: 8, r: 26, i: 0.6, color: 0xffd080 }, { x: 16, y: 16, r: 22, i: 0.5, color: 0xffd080 }, { x: 24, y: 16, r: 22, i: 0.5, color: 0xffd080 }],
    triggers: [
      { x: 36, y: 9, h: 2, scene: 'ch2_market_arrive', cond: '!ch2_market' },
      { x: 12, y: 8, w: 4, h: 2, scene: 'ch2_ledger_gone', cond: 'ch2_lot_joined&!ch2_ledger_gone' },
      { x: 1, y: 24, w: 2, h: 3, scene: 'ch2_leave', cond: 'ch2_done&!ch3_started' },
    ],
    exits: [
      { x: 39, y: 9, h: 2, to: 'road1', at: 'west_end' }, { x: 0, y: 9, h: 2, to: 'alleys', at: 'east' },
      { x: 20, y: 21, to: 'underbridge', at: 'east', cond: 'ch2_ledger_gone', blocked: 'underbridge_door' },
      { x: 0, y: 25, h: 2, to: 'market', at: 'west_exit', cond: 'ch2_done', blocked: 'market_west_early' },
    ],
  },
  {
    id: 'alleys', name: 'The alleys', region: 'market', music: 'underbridge', rows: al.rows(), legend: MARKET,
    markers: { east: [28, 10], alley_far: [3, 11], alley_mid: [12, 11], alley_side: [17, 9], painted_end: [7, 11] },
    npcs: [{ id: 'mark', art: 't_long_hat', pal: pal(C.teal1, C.pink2), x: 7, y: 11, dir: 'right', talk: 'talk_mark', cond: 'ch2_painter_known' }],
    painted: [
      { x: 20, y: 11, w: 4, h: 1 }, { x: 13, y: 12, w: 1, h: 3 }, { x: 3, y: 10, w: 3, h: 1 },
      { x: 8, y: 11, w: 4, h: 1, cond: 'anim_painted_lead' },
    ],
    talks: [{ x: 21, y: 10, scene: 'painted_lead_look' }, { x: 13, y: 11, scene: 'painted_lead_look' }],
    triggers: [{ x: 18, y: 10, h: 2, scene: 'ch2_painter_sighting', cond: 'ch2_lot_met&!ch2_painter_known' }],
    encounters: [
      { id: 'al1', group: 'g_inkmites', art: 'inkmite', x: 7, y: 4, wander: 1, cond: 'ch2_painter_known' },
      { id: 'al2', group: 'g_hatmen', art: 't_long_hat', x: 17, y: 12, wander: 1 },
    ],
    exits: [{ x: 29, y: 10, h: 2, to: 'market', at: 'arch_in' }],
  },
  {
    id: 'underbridge', name: 'The Underbridge', region: 'under', music: 'underbridge', rows: ub.rows(), legend: UNDER,
    battleLight: { dir8: [1, 0], lowness: 2 },
    markers: { east: [34, 8], under_exit: [34, 9], boss: [6, 9] },
    npcs: [{ id: 'painter', art: 'painter', x: 6, y: 9, dir: 'right', cond: '!ch2_done' }],
    props: [
      { art: 'post', x: 26, y: 9 }, { art: 'post', x: 17, y: 6 }, { art: 'crate', x: 15, y: 12 },
      { art: 'stall_lamp', x: 33, y: 3, lead: false, solid: true }, { art: 'barrel', x: 30, y: 14 },
    ],
    plates: [{ id: 'u1', x: 22, y: 9, flag: 'u_gate1' }, { id: 'u2a', x: 19, y: 4, flag: 'u_gate2' }, { id: 'u2b', x: 19, y: 11, flag: 'u_gate2' }],
    gates: [
      { x: 24, y: 8, flag: 'u_gate1', open: 'under_floor' }, { x: 24, y: 9, flag: 'u_gate1', open: 'under_floor' },
      { x: 12, y: 8, flag: 'u_gate2', open: 'under_floor' }, { x: 12, y: 9, flag: 'u_gate2', open: 'under_floor' },
    ],
    lights: [{ x: 33, y: 3, r: 30, i: 0.7, color: 0xffd080 }, { x: 34, y: 8, r: 34, i: 0.8, color: 0xfff0c0 }],
    talks: [{ x: 23, y: 8, scene: 'underbridge_wall' }, { x: 4, y: 0, scene: 'underbridge_paint' }],
    painted: [{ x: 2, y: 1, w: 4, h: 1 }],
    triggers: [{ x: 10, y: 7, h: 4, scene: 'ch2_painter_boss', cond: '!ch2_done' }, { x: 30, y: 8, h: 2, scene: 'under_lamp_hint', cond: '!under_hint' }],
    encounters: [
      { id: 'ub1', group: 'g_lampthief', art: 't_long_hat', x: 29, y: 13, wander: 1 },
      { id: 'ub2', group: 'g_inkmites', art: 'inkmite', x: 17, y: 9, wander: 1 },
    ],
    exits: [{ x: 35, y: 8, h: 2, to: 'market', at: 'from_under' }],
  },
];
