// Chapter 1 maps: Stile, the sunward gate, the gully, and the pebble quarry.
import type { MapDef } from '../../game/map';
import { C } from '../../engine/palette';
import { Grid, STILE } from './kit';

const P = {
  plim: [C.black, C.pale, C.umber2] as [number, number, number],
  quarle: [C.black, C.plum2, C.gold3] as [number, number, number],
  hessle: [C.black, C.teal1, C.rust3] as [number, number, number],
  pip: [C.black, C.rust2, C.gold3] as [number, number, number],
  wem: [C.black, C.green2, C.umber2] as [number, number, number],
  walker: [C.black, C.gold1, C.pink2] as [number, number, number],
  walker2: [C.black, C.blue2, C.umber1] as [number, number, number],
  ock: [C.black, C.slate, C.umber2] as [number, number, number],
  registrar: [C.black, C.blue1, C.pale] as [number, number, number],
  brisk: [C.black, C.ink, C.rust3] as [number, number, number],
  fenwold: [C.black, C.umber1, C.gold3] as [number, number, number],
  ochre: [C.black, C.plum2, C.umber1] as [number, number, number],
  dunnet: [C.black, C.umber2, C.gold2] as [number, number, number],
};

// ---- Nodus's house ----
const home = new Grid(12, 8, 'w');
home.hline(0, 0, 12, 'H').set(3, 0, 'W').set(8, 0, 'W');
home.vline(0, 0, 8, 'H').vline(11, 0, 8, 'H').hline(0, 7, 12, 'H').set(5, 7, 'D');
home.set(0, 3, 'W').set(0, 5, 'W');
home.set(1, 1, 'b').set(1, 2, 'd').set(8, 1, 'B').set(9, 1, 'B').set(5, 3, 'T').set(6, 3, 'T').fill(3, 4, 6, 2, 'r');

// ---- The square ----
const sq = new Grid(40, 30, '.');
sq.mix(0, 0, 40, 30, '.', ',', 0.22).scatter(0, 0, 40, 30, '.', '"', 0.05, 3);
sq.mix(9, 5, 22, 20, ':', ';', 0.18);
sq.fill(0, 15, 9, 2, '=').fill(31, 15, 9, 2, '=');
sq.house(12, 1, 16, { roof: 'S', ridge: 'S', door: 7, windows: [2, 4, 11, 13] });
sq.house(2, 9, 5, { door: 2, windows: [0, 4] });
sq.fill(3, 12, 3, 3, '_');
sq.house(32, 12, 5, { door: 2, windows: [0, 4] });
sq.fill(33, 15, 3, 1, ':');
sq.house(3, 18, 6, { door: -1, windows: [1, 4], front: 'h' });
sq.hline(27, 19, 3, 'K');
sq.stamp(22, 20, ['oooo', 'o~~o', 'oooo']);
sq.set(20, 14, 'L').set(21, 14, 'L').set(17, 4, 'N');
sq.hline(1, 24, 7, '%').hline(32, 24, 7, '%').hline(1, 5, 8, '%');
sq.stamp(33, 25, ['ffff', 'ffff', 'ffff']);
sq.stamp(2, 25, ['f.ff', 'ffff']);

// ---- The Office of Bearers ----
const office = new Grid(14, 8, 'n');
office.hline(0, 0, 14, 'H').vline(0, 0, 8, 'H').vline(13, 0, 8, 'H').hline(0, 7, 14, 'H').set(3, 7, 'D');
office.vline(7, 0, 7, 'H').set(7, 3, 'D').set(4, 0, 'W').set(10, 0, 'W');
office.set(1, 1, 'B').set(2, 1, 'B').set(9, 1, 'B').set(11, 1, 'B').set(12, 1, 'B');
office.hline(1, 4, 3, 'K').set(10, 3, 'T').set(11, 3, 'T');

// ---- Mott's house ----
const wake = new Grid(10, 7, 'w');
wake.hline(0, 0, 10, 'H').vline(0, 0, 7, 'H').vline(9, 0, 7, 'H').hline(0, 6, 10, 'H').set(4, 6, 'D').set(2, 0, 'W').set(7, 0, 'W');
wake.hline(3, 2, 3, 'T').fill(2, 4, 6, 1, 'r');

// ---- The sunward gate ----
const gate = new Grid(30, 20, '.');
gate.mix(0, 0, 30, 20, '.', ',', 0.25).scatter(2, 5, 10, 10, '.', '"', 0.3, 7);
gate.vline(18, 0, 20, '#').set(18, 9, 'G').set(18, 10, 'G');
gate.mix(19, 0, 11, 20, ':', ';', 0.2);
gate.fill(8, 9, 10, 2, '=').fill(19, 9, 11, 2, '=');
gate.house(23, 1, 5, { roof: 'S', ridge: 'S', door: -1, windows: [2] });

// ---- The gully ----
const gu = new Grid(32, 24, 'g');
gu.fill(0, 0, 32, 2, 'C').fill(0, 0, 3, 24, 'C').fill(29, 0, 3, 24, 'C').fill(0, 22, 32, 2, 'C');
gu.fill(15, 0, 2, 2, 'g').fill(29, 18, 3, 2, 'g');
gu.stamp(5, 4, ['PPP', 'PP ']).stamp(22, 5, ['QQ ', 'QQQ']).stamp(9, 10, ['PP ', 'PPP', ' P ']);
for (const [x, y] of [[4, 8], [13, 3], [25, 11], [19, 16], [26, 20], [7, 14], [21, 2], [12, 20]]) gu.set(x, y, 'o');
gu.house(4, 17, 5, { door: -1, windows: [1, 3] });
gu.fill(3, 2, 2, 3, 'C').fill(27, 2, 2, 4, 'C').fill(3, 12, 1, 3, 'C');

// ---- The pebble quarry ----
const qu = new Grid(32, 24, 'q');
qu.border('C').fill(0, 17, 1, 2, 'q');
qu.hline(1, 12, 30, 'C').set(3, 12, 'q').set(4, 12, 'q');
qu.vline(11, 12, 11, 'C').set(11, 17, 'o').set(11, 18, 'o');
qu.vline(22, 12, 11, 'C').set(22, 17, 'o').set(22, 18, 'o');
qu.stamp(13, 2, ['ooo', 'o  ']).stamp(24, 6, [' oo', 'ooo']).stamp(6, 8, ['oo']);
qu.fill(27, 1, 3, 3, 'q').fill(26, 1, 1, 2, 'C');

export const CH1: MapDef[] = [
  {
    id: 'home', name: 'Home', region: 'interior', music: 'home', rows: home.rows(), legend: STILE,
    markers: { start: [2, 2], table: [7, 3], door: [5, 6] },
    npcs: [{ id: 'tib', art: 'tib', x: 4, y: 5, dir: 'up', talk: 'talk_tib', cond: '!ch2_started' }],
    props: [{ art: 'flag', x: 6, y: 0, talk: 'home_flag', lead: false }],
    talks: [{ x: 3, y: 0, scene: 'home_window' }, { x: 0, y: 3, scene: 'home_window' }, { x: 0, y: 5, scene: 'home_window' }, { x: 8, y: 1, scene: 'home_shelf' }, { x: 9, y: 1, scene: 'home_shelf' }],
    exits: [{ x: 5, y: 7, to: 'square', at: 'home_door' }],
    shafts: [{ x: 0, y: 3, w: 1, h: 1 }, { x: 0, y: 5, w: 1, h: 1 }],
  },
  {
    id: 'square', name: 'Stile', region: 'stile', music: 'stile', rows: sq.rows(), legend: STILE,
    markers: {
      home_door: [4, 12], from_office: [19, 4], office_door: [19, 3], office_steps: [19, 4], steps_below: [19, 6], notice_board: [17, 5],
      from_wake: [34, 15], west_road: [1, 15], east_road: [38, 15], desk: [20, 15], lead_base: [1, 13], start: [4, 12],
      epilogue: [20, 16], square_center: [22, 12], square_exit: [38, 16],
    },
    npcs: [
      { id: 'plim', art: 't_long_adult', pal: P.plim, x: 6, y: 21, dir: 'down', talk: 'talk_plim' },
      { id: 'quarle', art: 't_long_elder', pal: P.quarle, x: 25, y: 23, dir: 'left', talk: 'talk_quarle', wander: 1, cond: '!ch7_started' },
      { id: 'hessle', art: 't_long_adult', pal: P.hessle, x: 28, y: 18, dir: 'down', talk: 'talk_hessle' },
      { id: 'pip', art: 't_long_child', pal: P.pip, x: 25, y: 17, dir: 'right', talk: 'talk_pip' },
      { id: 'wem', art: 't_long_child', pal: P.wem, x: 27, y: 17, dir: 'left', talk: 'talk_pip' },
      { id: 'walker1', art: 't_long_adult', pal: P.walker, x: 14, y: 9, wander: 3, talk: 'talk_walker1' },
      { id: 'walker2', art: 't_long_hat', pal: P.walker2, x: 26, y: 9, wander: 3, talk: 'talk_walker2' },
    ],
    props: [
      { art: 'town_gnomon', x: 20, y: 11 }, { art: 'sticks_table', x: 26, y: 17 }, { art: 'dial_post', x: 11, y: 17, talk: 'post_generic' },
      { art: 'sign', x: 8, y: 13, talk: 'lead_look' },
      { art: 'tree_gold', x: 2, y: 3 }, { art: 'tree_gold', x: 9, y: 2 }, { art: 'tree_gold', x: 31, y: 2 }, { art: 'tree_gold', x: 37, y: 5 },
      { art: 'tree_gold', x: 1, y: 27 }, { art: 'tree_gold', x: 11, y: 27 }, { art: 'tree_gold', x: 29, y: 27 }, { art: 'tree_gold', x: 37, y: 21 },
      { art: 'lamp_post', x: 9, y: 6, lead: true }, { art: 'lamp_post', x: 30, y: 6 }, { art: 'lamp_post', x: 9, y: 24 }, { art: 'lamp_post', x: 30, y: 24 },
      { art: 'barrel', x: 30, y: 18 }, { art: 'crate', x: 26, y: 19, solid: true, lead: true },
    ],
    talks: [{ x: 20, y: 14, scene: 'ch1_desk' }, { x: 21, y: 14, scene: 'ch1_desk' }, { x: 17, y: 4, scene: 'notice_board' }, { x: 5, y: 20, scene: 'bakery_door' }],
    exits: [
      { x: 4, y: 11, to: 'home', at: 'door' }, { x: 19, y: 3, to: 'office', at: 'door' }, { x: 34, y: 14, to: 'wake', at: 'door' },
      { x: 0, y: 15, h: 2, to: 'gate', at: 'east' }, { x: 39, y: 15, h: 2, to: 'gully', at: 'north', cond: 'ch1_gate_seen', blocked: 'gully_early' },
    ],
    bigLead: { x: -24, y: 11, len: 380 },
    enterScene: 'square_enter',
  },
  {
    id: 'office', name: 'Office of Bearers', region: 'interior', music: 'stile', rows: office.rows(), legend: STILE,
    markers: { door: [3, 6] },
    npcs: [
      { id: 'registrar', art: 't_office', pal: P.registrar, x: 2, y: 3, dir: 'down', talk: 'talk_registrar' },
      { id: 'anthelion', art: 'anthelion', x: 10, y: 2, dir: 'down', talk: 'talk_anthelion', cond: 'ch1_notice&!ch2_started' },
    ],
    props: [{ art: 'stall_lamp', x: 11, y: 3, talk: 'office_lamp', solid: true, lead: false }],
    exits: [{ x: 3, y: 7, to: 'square', at: 'from_office' }],
    shafts: [{ x: 0, y: 2, w: 1, h: 2 }],
  },
  {
    id: 'wake', name: "Mott's house", region: 'interior', music: 'wake', rows: wake.rows(), legend: STILE,
    markers: { door: [4, 5], wake_table: [4, 3] },
    npcs: [
      { id: 'mott', art: 'mott', x: 4, y: 3, dir: 'down', talk: 'ch1_wake', cond: '!ch2_started' },
      { id: 'brisk', art: 't_long_elder', pal: P.brisk, x: 2, y: 3, dir: 'right', talk: 'talk_brisk', cond: '!ch2_started' },
      { id: 'fenwold', art: 't_long_elder', pal: P.fenwold, x: 6, y: 3, dir: 'left', talk: 'talk_fenwold', cond: '!ch2_started' },
    ],
    props: [{ art: 'cake_table', x: 4, y: 2, solid: true, lead: false }],
    exits: [{ x: 4, y: 6, to: 'square', at: 'from_wake' }],
    shafts: [{ x: 0, y: 2, w: 1, h: 2 }],
  },
  {
    id: 'gate', name: 'The sunward gate', region: 'stile', music: 'stile', rows: gate.rows(), legend: STILE,
    markers: {
      east: [28, 9], start: [28, 9], gate_stand: [19, 10], gate_lamp: [21, 10], nodus_lead: [22, 10],
      gate_east: [29, 8], gate_east2: [29, 10], gate_east3: [29, 11], gate_behind: [23, 9], gate_behind2: [24, 10], gate_behind3: [23, 11],
      office_window: [25, 5], wall_ladder: [21, 2], wall_top: [20, 6], gate_out: [13, 10], gate_out2: [13, 9], lead_base: [6, 9],
    },
    npcs: [{ id: 'ock', art: 't_office', pal: P.ock, x: 20, y: 8, dir: 'left', talk: 'ch1_gate_shut', cond: '!ch1_struck' }],
    props: [{ art: 'tree_gold', x: 4, y: 3 }, { art: 'tree_gold', x: 12, y: 15 }, { art: 'tree_gold', x: 2, y: 16 }, { art: 'post', x: 15, y: 8 }],
    triggers: [
      { x: 19, y: 9, h: 2, scene: 'ch1_gate_shut', cond: '!ch1_gate_seen' },
      { x: 20, y: 8, w: 3, h: 4, scene: 'ch1_turning', cond: 'ch1_oil&!ch1_struck' },
    ],
    gates: [{ x: 18, y: 9, flag: 'anim_gate_open', open: 'stile_gate_open' }, { x: 18, y: 10, flag: 'anim_gate_open', open: 'stile_gate_open' }],
    exits: [{ x: 29, y: 9, h: 2, to: 'square', at: 'west_road' }, { x: 0, y: 9, h: 2, to: 'road1', at: 'start', cond: 'ch1_struck' }],
    talks: [{ x: 6, y: 9, scene: 'hill_base' }],
    bigLead: { x: 6, y: 9, len: 380 },
  },
  {
    id: 'gully', name: 'The gully', region: 'stile', music: 'gully', rows: gu.rows(), legend: STILE,
    markers: { north: [15, 2], start: [15, 2], from_quarry: [28, 18] },
    npcs: [
      { id: 'parhelia', art: 'parhelia', x: 9, y: 20, dir: 'up', talk: 'talk_parhelia_early', cond: '!ch1_gate_seen&!ch1_parhelia_met' },
      { id: 'parhelia', art: 'parhelia', x: 9, y: 20, dir: 'up', talk: 'ch1_parhelia_meet', cond: 'ch1_gate_seen&!ch1_parhelia_met' },
      { id: 'ochre', art: 't_long_adult', pal: P.ochre, x: 12, y: 7, wander: 1, talk: 'talk_ochre' },
      { id: 'dunnet', art: 't_long_adult', pal: P.dunnet, x: 18, y: 12, wander: 1, talk: 'owner_1:talk_dunnet' },
    ],
    props: [{ art: 'dial_post', x: 11, y: 19, talk: 'post_generic' }, { art: 'sticks_table', x: 13, y: 18, talk: 'sticks_parhelia' }, { art: 'barrel', x: 3, y: 20 }],
    talks: [{ x: 6, y: 19, scene: 'parhelia_shack' }],
    encounters: [
      { id: 'gu1', group: 'g_tut', art: 'pebbler', x: 16, y: 7, wander: 2, cond: 'ch1_parhelia_met' },
      { id: 'gu2', group: 'g_pebblers', art: 'pebbler', x: 22, y: 13, wander: 2, cond: 'ch1_parhelia_met' },
      { id: 'gu3', group: 'g_hound', art: 'leadhound', x: 7, y: 12, wander: 2, cond: 'ch1_parhelia_met' },
    ],
    exits: [{ x: 15, y: 0, w: 2, to: 'square', at: 'east_road' }, { x: 31, y: 18, h: 2, to: 'quarry', at: 'start' }],
  },
  {
    id: 'quarry', name: 'The pebble quarry', region: 'stile', music: 'gully', rows: qu.rows(), legend: STILE,
    markers: { start: [1, 17], cache: [28, 21] },
    props: [
      { art: 'crate', x: 5, y: 15 }, { art: 'crate', x: 15, y: 14 }, { art: 'crate', x: 14, y: 21 },
      { art: 'barrel', x: 29, y: 21, talk: 'ch1_oil', cond: '!ch1_oil' }, { art: 'pebble_pile', x: 2, y: 20, solid: false, lead: false },
      { art: 'stray', x: 28, y: 2, talk: 'stray_1', cond: '!stray1_carried', solid: false, lead: false },
    ],
    plates: [{ id: 'pa', x: 9, y: 16, flag: 'q_gate_a' }, { id: 'pb1', x: 19, y: 15, flag: 'q_gate_b' }, { id: 'pb2', x: 19, y: 20, flag: 'q_gate_b' }],
    gates: [
      { x: 11, y: 17, flag: 'q_gate_a', open: 'stile_quarry' }, { x: 11, y: 18, flag: 'q_gate_a', open: 'stile_quarry' },
      { x: 22, y: 17, flag: 'q_gate_b', open: 'stile_quarry' }, { x: 22, y: 18, flag: 'q_gate_b', open: 'stile_quarry' },
    ],
    hiddenPits: [[25, 16], [26, 18], [24, 20], [27, 19], [28, 17]],
    talks: [{ x: 9, y: 16, scene: 'quarry_plate' }],
    triggers: [{ x: 2, y: 17, h: 2, scene: 'quarry_plate_hint', cond: 'ch1_parhelia_met&!q_hint' }],
    encounters: [
      { id: 'q1', group: 'g_gnats', art: 'gnat', x: 7, y: 21, wander: 1 },
      { id: 'q2', group: 'g_pebblers', art: 'pebbler', x: 7, y: 5, wander: 2 },
      { id: 'q3', group: 'g_crab', art: 'shalecrab', x: 20, y: 6, wander: 2 },
      { id: 'q4', group: 'g_hound_peb', art: 'leadhound', x: 25, y: 14, wander: 1 },
    ],
    exits: [{ x: 0, y: 17, h: 2, to: 'gully', at: 'from_quarry' }],
  },
];
