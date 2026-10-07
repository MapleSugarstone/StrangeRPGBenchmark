// Regions and maps. Layouts are painted with the Grid builder so coordinates stay readable.
import { ActorDef, FieldLog, Grid, MapDef, Region, carry, linePost } from './mapkit';
import { MAPS2 } from './maps2';
import { MAPS3, applyAct2 } from './maps3';
import { MAPS4, applyPuzzleRooms } from './maps4';

export const REGIONS: Record<string, Region> = {
  busy: { name: 'Busy', amb: 0xffd8b0, windowLight: 0xffb070, dark: 0x1a1216, ambient: 0.3, floor: [0x241c1e, 0x3a2e2c, 0xc25a3a], wall: [0x3a1e1a, 0x8a3e2a, 0xe6d8bc], accent: [0x123a3c, 0x6fe3e0, 0xe6d8bc], drone: [0, 7], specks: 'up', legend: { H: 'claywall', W: 'eyewin' } },
  busyAgain: { name: 'Busy', amb: 0xd8ffa0, windowLight: 0xc8ff2e, dark: 0x101a08, ambient: 0.22, floor: [0x1a1c14, 0x2a3020, 0x7a9a2a], wall: [0x1a2010, 0x4a5a2a, 0xc8ff2e], accent: [0x1a2a0a, 0xc8ff2e, 0xe6ffa0], drone: [0, 1], specks: 'up', legend: { H: 'claywall', W: 'eyewin' } },
  millrace: { name: 'the Millrace', amb: 0x6080c0, dark: 0x1a2a3a, ambient: 0.12, floor: [0x0e1216, 0x161c22, 0x3e5a74], wall: [0x2a323c, 0x52606e, 0x7a8a9a], accent: [0x0c2a30, 0x6fe3e0, 0xc8fff8], drone: [-5, 2], specks: 'up' },
  river: { name: 'the river', amb: 0x70a0d0, dark: 0x070b12, ambient: 0.12, floor: [0x10161e, 0x1c2632, 0x3e5a74], wall: [0x161c26, 0x2c3a4c, 0x4a6a8a], accent: [0x0a2a34, 0x6fe3e0, 0xd8ffff], drone: [-3, 4], specks: 'up' },
  standing: { name: 'Standing', amb: 0x3050a0, windowLight: 0x6fe3e0, dark: 0x060a12, ambient: 0, floor: [0x0e131c, 0x1a2230, 0x3e5a74], wall: [0x141a26, 0x2a3648, 0x4a5e78], accent: [0x0a2a34, 0x6fe3e0, 0xd8ffff], drone: [-7, 0], specks: 'up', legend: { H: 'slate', W: 'archwin', R: 'slateroof' } },
  twice: { name: 'Twice', amb: 0xffc0d8, windowLight: 0xa0ffa0, dark: 0x140a12, ambient: 0.32, floor: [0x24161e, 0x3a2430, 0xe07aa0], wall: [0x3a1a2a, 0x8a3a5a, 0xe07aa0], accent: [0x1a3a1a, 0x9fd88a, 0xe6ffd8], drone: [2, 9], specks: 'up', legend: { H: 'stampwall', W: 'twinwin' } },
  press: { name: 'the Press', amb: 0xd080b0, dark: 0x100810, ambient: 0.1, floor: [0x1a1218, 0x2a1e28, 0x6a3a5a], wall: [0x2a1424, 0x5a2a4a, 0xa04a7a], accent: [0x143a14, 0x9fd88a, 0xe6ffd8], drone: [-2, 5], specks: 'up' },
  ears: { name: 'the Ears', amb: 0xb0a0ff, dark: 0x0d0c14, ambient: 0.14, floor: [0x14161a, 0x1e2a1c, 0x6c8f4a], wall: [0x1e1a2a, 0x4a3e6a, 0xa99ad8], accent: [0x2a2440, 0xa99ad8, 0xe07aa0], drone: [4, 11], specks: 'up' },
  tether: { name: 'the Tether', amb: 0x8090ff, dark: 0x05060a, ambient: 0.12, floor: [0x0a0c14, 0x1e2440, 0x6f8cff], wall: [0x10141e, 0x3a4462, 0xf2f2f2], accent: [0x1a2240, 0x6f8cff, 0xf2f2f2], drone: [-12, -5], specks: 'down', windowLight: 0x8fe08a },
  writing: { name: 'the Writing Room', amb: 0xe8e0d0, dark: 0x0a0a0a, ambient: 0.22, floor: [0x141414, 0x262626, 0xe6dfd0], wall: [0x202020, 0xe6dfd0, 0xc8ff2e], accent: [0x1a2a0a, 0xc8ff2e, 0xf2f2f2], drone: [0, 0.3], specks: 'down', legend: { P: 'textwall' } },
  busy7: { name: 'Busy', amb: 0xb8c8e0, windowLight: 0xffb070, dark: 0x0e0c14, ambient: 0.2, floor: [0x1c1820, 0x2e2830, 0x8a3e2a], wall: [0x2a1a1e, 0x6a3a2a, 0xe6d8bc], accent: [0x123a3c, 0x6fe3e0, 0xe6d8bc], drone: [0, 7], specks: 'up', legend: { H: 'claywall', W: 'eyewin' } },
  river7: { name: 'the river', amb: 0x5070a0, dark: 0x05080e, ambient: 0.1, floor: [0x0e131c, 0x1a2230, 0x3e5a74], wall: [0x141a26, 0x2a3648, 0x3e5a74], accent: [0x07161a, 0x2a8a8a, 0x6fe3e0], drone: [-3, 4], specks: 'down' },
  line: { name: 'the Line', amb: 0xd8d0ff, dark: 0x05060a, ambient: 0.3, floor: [0x1e2440, 0x6a5a98, 0xe6dfd0], wall: [0x15121c, 0x4e4a5c, 0xaaa4ba], accent: [0x1e2440, 0xf2d25a, 0xffffff], drone: [5, 12], specks: 'down' },
  scriv: { name: 'the Scrivener', amb: 0xfff2a0, windowLight: 0x8fe08a, dark: 0x0b0a10, ambient: 0.36, floor: [0x2a2833, 0x4e4a5c, 0xc2a05a], wall: [0x2a2833, 0x7a7488, 0xf2d25a], accent: [0x2e1e4a, 0xa99ad8, 0xffffff], drone: [-7, 5], specks: 'up', legend: { H: 'panel', W: 'drop' } },
  nursery: { name: 'the Nursery', amb: 0xc8e0a0, windowLight: 0xe6ffa0, dark: 0x101a08, ambient: 0.1, floor: [0x1a1814, 0x2a2620, 0xd8d4cc], wall: [0x2a2418, 0x5a4a30, 0xd8d4cc], accent: [0x1a2a0a, 0xc8ff2e, 0xe6ffa0], drone: [0, 1], specks: 'up' },
};

const struck = (n: number) => (l: FieldLog) => (l.verbs.strike ?? 0) >= n;
const used = (verb: string) => (l: FieldLog) => (l.verbs[verb] ?? 0) >= 1;
const box = (id: string, x: number, y: number, give: string, extra: Partial<ActorDef> = {}): ActorDef => ({
  id, x, y, sprite: 'box', kind: 'object', name: 'a box',
  puzzle: { rote: '# a box. lazy.\nwhen struck:\n  open', need: struck(1), flag: `box_${id}`, give, stays: true, solvedSprite: 'boxopen' },
  ...extra,
});

// ---------------------------------------------------------------- chapter 1: Busy

function busyRows(): string[] {
  const g = new Grid(30, 24, ',');
  g.box(0, 0, 30, 24, '=');
  g.v_(26, 0, 24, '~').v_(27, 0, 24, '~');
  g.set(26, 17, 'b').set(27, 17, 'b');
  g.house(11, 1, 6, 4, [1, 4], 2);
  g.house(2, 2, 3, 4, [1], 1);
  g.house(21, 7, 4, 4, [1, 2], 2);
  g.house(2, 15, 4, 4, [1]);
  g.house(10, 17, 5, 4, [1, 3]);
  g.house(18, 16, 4, 4, [1, 2]);
  for (const [x, y] of [[15, 1], [2, 2], [24, 7], [4, 15], [13, 17], [21, 16]]) g.set(x, y, 'C');
  g.h_(12, 5, 3, 'A');
  g.fill(9, 8, 11, 7, '.');
  g.set(14, 11, '*').set(13, 11, ':').set(15, 11, ':').set(14, 10, ':').set(14, 12, ':');
  g.v_(13, 5, 3, '.');
  g.v_(3, 6, 2, '.').h_(3, 7, 6, '.').set(8, 8, '.');
  g.h_(20, 11, 4, '.');
  g.h_(1, 11, 8, '.').set(0, 11, 'g');
  g.h_(19, 15, 6, '.').v_(25, 12, 6, '.').set(28, 17, ',');
  g.set(7, 9, 'o');
  for (const [x, y, c] of [[6, 2, 'T'], [19, 3, 'T'], [8, 14, 't'], [1, 20, 'T'], [16, 22, 't'], [23, 21, 'T'], [24, 5, 't'], [7, 20, 't']] as [number, number, string][]) g.set(x, y, c);
  return g.rows();
}

const VILLAGER_ROTES = {
  sweep: '# sweeps. twice a day.\nsweep square\nsweep square\nrest',
  count: '# counts what happens at once.\ncount\nwait',
  stack: '# makes bowls. stacks them.\nmake bowl\nstack bowl\nwait',
  pour: '# carries water.\nfill\ncarry\npour\nwait',
  mind: '# minds the sleepers.\nmind them\nwait',
};

export const MAPS: Record<string, MapDef> = {
  busy: {
    id: 'busy', name: 'Busy', region: 'busy', rows: busyRows(),
    enter: [['c<2,!seen_c1_open', 'c1_open'], ['grind_done,!c1_returned', 'c1_return']],
    altRegion: ['c=6,!c6_won', 'busyAgain'],
    exits: [
      { x: 23, y: 10, to: 'millrace', tx: 3, ty: 2, cond: 'straw_done', block: 'c1_mill_shut' },
      { x: 13, y: 4, to: 'nursery', tx: 6, ty: 9, cond: 'c=6,halt_found', block: 'door_nursery' },
    ],
    triggers: [],
    actors: [
      carry('carry_b', 19, 13),
      // Chapter 1 to 5 villagers.
      { id: 'sweep', x: 15, y: 12, sprite: 'sweep', kind: 'npc', cond: 'c<6', syncFlag: 'sync', tempo: 50, rote: VILLAGER_ROTES.sweep, talk: [['c>=4', 'npc_sweep_far'], ['c>=2', 'npc_sweep_away'], ['c1_returned', 'npc_sweep_2'], ['met_gloss', 'npc_sweep_1'], ['*', 'npc_sweep_1']] },
      { id: 'count', x: 17, y: 9, sprite: 'count', kind: 'npc', stet: 'count', cond: 'c<6', syncFlag: 'sync', tempo: 36, rote: VILLAGER_ROTES.count, talk: [['c>=4', 'npc_count_far'], ['c>=2', 'npc_count_away'], ['c1_returned', 'npc_count_2'], ['*', 'npc_count_1']] },
      { id: 'stack', x: 11, y: 14, sprite: 'stack', kind: 'npc', stet: 'stack', cond: 'c<6', syncFlag: 'sync', tempo: 60, rote: VILLAGER_ROTES.stack, talk: [['c>=4', 'npc_stack_far'], ['c>=2', 'npc_stack_away'], ['c1_returned', 'npc_stack_2'], ['*', 'npc_stack_1']] },
      { id: 'pour', x: 25, y: 13, sprite: 'pour', kind: 'npc', cond: 'c<6', syncFlag: 'sync', tempo: 44, rote: VILLAGER_ROTES.pour, talk: [['bowl_full', 'npc_pour_full'], ['c>=2', 'npc_pour_away'], ['c1_returned', 'npc_pour_2'], ['*', 'npc_pour_1']] },
      { id: 'mind', x: 13, y: 5, sprite: 'mind', kind: 'npc', cond: 'c<6', tempo: 90, rote: VILLAGER_ROTES.mind, talk: [['c>=4', 'npc_mind_far'], ['c>=2', 'npc_mind_away'], ['c1_returned', 'npc_mind_2'], ['*', 'npc_mind_1']] },
      { id: 'gloss_a', x: 12, y: 10, sprite: 'gloss', kind: 'npc', cond: 'met_gloss,!straw_done', tempo: 70, rote: 'gloss  # notes things\nwait', talk: [['*', 'c1_gloss_idle']] },
      { id: 'gloss_b', x: 22, y: 12, sprite: 'gloss', kind: 'npc', cond: 'straw_done,!grind_done', tempo: 70, rote: 'gloss  # notes things\nwait', talk: [['*', 'c1_gloss_mill']] },
      { id: 'gloss_c', x: 2, y: 12, sprite: 'gloss', kind: 'npc', cond: 'c1_returned,c<2', tempo: 70, rote: 'gloss  # notes things\nwait', talk: [['*', 'c1_gloss_gate']] },
      { id: 'straw', x: 8, y: 10, sprite: 'straw', kind: 'npc', cond: 'c<6', tempo: 120, rote: 'stand  # it stands', talk: [['straw_done', 'obj_straw_after'], ['met_gloss', 'c1_straw'], ['*', 'obj_straw_before']] },
      { id: 'halt', x: 1, y: 11, sprite: 'halt', kind: 'npc', cond: 'c<2', tempo: 100, rote: '# a gate. stops what leaves.\nhalt', talk: [['c1_returned', 'c1_gate'], ['*', 'npc_halt_1']] },
      { id: 'spot', x: 14, y: 11, sprite: 'none', kind: 'object', solid: false, name: 'the spot', talk: [['c1_returned', 'obj_spot_after'], ['*', 'obj_spot']] },
      { id: 'well', x: 7, y: 9, sprite: 'none', kind: 'deco', name: 'the well', talk: [['*', 'obj_well']] },
      { id: 'wheel', x: 26, y: 9, sprite: 'wheel', kind: 'deco', syncFlag: 'sync', tempo: 30, light: 0.4, cond: '!grind_done' },
      { id: 'lectern', x: 5, y: 8, sprite: 'lectern', kind: 'lectern', cond: 'c<6' },
      { id: 'tend', x: 20, y: 4, sprite: 'tend', kind: 'npc', cond: 'c<6', tempo: 80, rote: '# cuts the tops off the stalks.\ncut\nwait', talk: [['*', 'npc_tend']] },
      box('busybox', 28, 21, 'inkpot', { cond: 'c<6' }),
      { id: 'mark_busy', x: 28, y: 2, sprite: 'markstone', kind: 'mark', cond: 'c<6' },
      {
        id: 'bowl', x: 23, y: 14, sprite: 'bowl', kind: 'object', name: 'Pour\'s bowl', cond: 'c<6', tempo: 40,
        puzzle: { rote: '# a bowl. pour fills it.\n# it has a hole. nobody said.\nwhen wet:\n  hold water', need: used('soak'), flag: 'bowl_full', scene: 'obj_bowl_full', stays: true, solvedSprite: 'bowlfull' },
        talk: [['bowl_full', 'npc_pour_full'], ['!seen_obj_bowl', 'obj_bowl']],
      },
      { id: 'once1', x: 1, y: 1, sprite: 'page', kind: 'object', name: 'a torn page', cond: '!once_1', talk: [['*', 'once_1']] },
      // Chapter 6: copied villagers.
      { id: 'c_sweep', x: 15, y: 12, sprite: 'sweep', kind: 'foe', copied: true, enc: 'csweep', cond: 'c=6,!freed_sweep,!beat_csweep' },
      { id: 'c_count', x: 17, y: 9, sprite: 'count', kind: 'foe', copied: true, enc: 'ccount', cond: 'c=6,!freed_count,!beat_ccount' },
      { id: 'c_stack', x: 11, y: 14, sprite: 'stack', kind: 'foe', copied: true, enc: 'cstack', cond: 'c=6,!freed_stack,!beat_cstack' },
      { id: 'c_pour', x: 24, y: 12, sprite: 'pour', kind: 'foe', copied: true, enc: 'cpour', cond: 'c=6,!freed_pour,!beat_cpour' },
      { id: 'c_mind', x: 13, y: 5, sprite: 'mind', kind: 'foe', copied: true, enc: 'cmind', cond: 'c=6,!freed_mind,!beat_cmind' },
      { id: 'f_sweep', x: 16, y: 13, sprite: 'sweep', kind: 'npc', stet: 'sweep', cond: 'c=6,freed_sweep', tempo: 50, rote: VILLAGER_ROTES.sweep, talk: [['*', 'c6_free_sweep']] },
      { id: 'f_count', x: 18, y: 9, sprite: 'count', kind: 'npc', cond: 'c=6,freed_count', tempo: 36, rote: VILLAGER_ROTES.count, talk: [['*', 'c6_free_count']] },
      { id: 'f_stack', x: 10, y: 14, sprite: 'stack', kind: 'npc', cond: 'c=6,freed_stack', tempo: 60, rote: VILLAGER_ROTES.stack, talk: [['*', 'c6_free_stack']] },
      { id: 'f_pour', x: 25, y: 14, sprite: 'pour', kind: 'npc', cond: 'c=6,freed_pour', tempo: 44, rote: VILLAGER_ROTES.pour, talk: [['*', 'c6_free_pour']] },
      { id: 'f_mind', x: 14, y: 5, sprite: 'mind', kind: 'npc', cond: 'c=6,freed_mind', tempo: 90, rote: VILLAGER_ROTES.mind, talk: [['*', 'c6_free_mind']] },
      { id: 'loop1', x: 5, y: 12, sprite: 'loop', kind: 'foe', copied: true, enc: 'loop', cond: 'c=6', wander: 3 },
      { id: 'loop2', x: 20, y: 21, sprite: 'loop', kind: 'foe', copied: true, enc: 'loop', cond: 'c=6', wander: 3 },
      { id: 'halt_wall', x: 0, y: 11, sprite: 'halt', kind: 'npc', look: 'halted', cond: 'c=6', rote: '# a gate. stops what leaves.\nhalt   # again\nhalt   # again\nhalt', talk: [['halt_found', 'obj_halt_wall'], ['*', 'c6_halt']] },
      { id: 'lectern6', x: 5, y: 8, sprite: 'lectern', kind: 'lectern', cond: 'c=6' },
      { id: 'gloss6', x: 4, y: 10, sprite: 'gloss', kind: 'npc', stet: 'gloss', cond: 'c=6', tempo: 70, rote: 'gloss  # notes things\nwait', talk: [['*', 'c6_gloss_idle']] },
    ],
  },

  millrace: {
    id: 'millrace', name: 'the Millrace', region: 'millrace',
    rows: (() => {
      const m = new Grid(26, 22, '#');
      m.fill(1, 1, 6, 5, '.').set(2, 1, 's');
      m.h_(7, 3, 3, '.');
      m.fill(10, 1, 6, 6, '.');
      m.v_(12, 7, 3, '.');
      m.fill(9, 10, 8, 5, '.');
      m.h_(17, 12, 1, '.');
      m.fill(18, 10, 6, 4, '.');
      m.set(7, 15, '.').set(9, 15, '.');
      m.fill(1, 14, 6, 6, '.');
      m.set(4, 13, '.').set(4, 12, '.');
      m.h_(7, 19, 7, '.');
      m.fill(14, 16, 11, 5, '.');
      m.v_(8, 0, 22, '~');
      m.set(8, 3, 'b').set(8, 19, 'b');
      m.set(23, 16, 's');
      m.v_(21, 16, 5, '~');
      m.set(21, 18, 'b');
      return m.rows();
    })(),
    enter: [['c<6,!seen_c1_mill_door', 'c1_mill_door'], ['c=6,!seen_c6_open', 'c6_open']],
    exits: [
      { x: 2, y: 1, to: 'busy', tx: 23, ty: 11 },
      { x: 23, y: 16, to: 'busy', tx: 23, ty: 11, cond: 'grind_done', block: 'c1_stairs_shut' },
      { x: 2, y: 1, to: 'busy', tx: 23, ty: 11, cond: 'c=6' },
    ],
    triggers: [{ x: 16, y: 16, h: 5, scene: 'c1_grind', cond: '!grind_done', once: 'grind_met' }],
    actors: [
      carry('carry_m', 4, 17),
      linePost('post_m', 9, 11, 'millrace'),
      { id: 'nip_b', x: 13, y: 3, sprite: 'nip', kind: 'foe', enc: 'nip', respawn: true, wander: 2 },
      {
        id: 'sluice', x: 12, y: 8, sprite: 'sluice', kind: 'object', name: 'the sluice',
        puzzle: { rote: '# sluice. lazy.\nwhen struck 3 times:\n  open', need: struck(3), flag: 'sluice_open', scene: 'obj_sluice_open' },
      },
      { id: 'chaffnip', x: 14, y: 12, sprite: 'chaff', kind: 'foe', enc: 'chaffnip', wander: 2 },
      { id: 'spoke_d', x: 20, y: 12, sprite: 'spoke', kind: 'foe', enc: 'spoke', wander: 1 },
      { id: 'tornpage', x: 22, y: 11, sprite: 'page', kind: 'object', name: 'a torn page', cond: '!got_repeat', talk: [['*', 'c1_torn_page']] },
      {
        id: 'plank', x: 8, y: 15, sprite: 'plank', kind: 'object', name: 'a plank',
        puzzle: { rote: '# plank. fell in.\nwhen mended:\n  lie flat', need: used('mend'), flag: 'plank_fixed', becomes: 'b', scene: 'obj_plank_fixed' },
      },
      { id: 'lectern_m', x: 2, y: 15, sprite: 'lectern', kind: 'lectern' },
      { id: 'copynip2', x: 5, y: 18, sprite: 'nip', kind: 'foe', copied: true, enc: 'copynip2', wander: 1 },
      {
        id: 'crack', x: 4, y: 13, sprite: 'crack', kind: 'object', name: 'a cracked wall',
        puzzle: { rote: '# a weak place.\nwhen struck 5 times:\n  crumble', need: struck(5), flag: 'crack_open', scene: 'obj_crack_open' },
      },
      { id: 'mark_mill', x: 4, y: 12, sprite: 'markstone', kind: 'mark' },
      {
        id: 'errata', x: 7, y: 17, sprite: 'errata', kind: 'object', name: 'a wall written twice',
        puzzle: { rote: '# corrected.\n# corrected again.\nstand\nwhen erased:\n  get up', need: used('erase'), flag: 'errata_open', scene: 'side_erratum', stays: true, solvedSprite: 'none' },
        talk: [['erratum_done', 'obj_erratum_after'], ['!seen_obj_errata', 'obj_errata']],
      },
      { id: 'once2', x: 1, y: 19, sprite: 'page', kind: 'object', name: 'a torn page', cond: '!once_2', talk: [['*', 'once_2']] },
      { id: 'spokenip', x: 11, y: 19, sprite: 'spoke', kind: 'foe', copied: true, enc: 'spokenip', wander: 1 },
      { id: 'grind', x: 19, y: 18, sprite: 'grind', kind: 'npc', copied: true, cond: '!grind_done', enc: 'grind', talk: [['*', 'c1_grind']] },
      { id: 'bigwheel', x: 21, y: 17, sprite: 'wheel', kind: 'deco', copied: true, cond: '!grind_done', light: 0.5 },
      { id: 'bigwheel_s', x: 21, y: 17, sprite: 'wheel', kind: 'deco', cond: 'grind_done' },
      box('millbox', 23, 20, 'inkpot'),
      { id: 'loop_m1', x: 12, y: 12, sprite: 'loop', kind: 'foe', copied: true, enc: 'loop', cond: 'c=6', wander: 2 },
      { id: 'bucket6', x: 18, y: 19, sprite: 'bucket', kind: 'deco', cond: 'c=6', light: 0.4 },
    ],
  },
  ...MAPS2,
  ...MAPS3,
  ...MAPS4,
};

applyAct2(MAPS);
applyPuzzleRooms(MAPS);
