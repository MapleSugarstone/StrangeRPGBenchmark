// Maps for chapters 2 to 6.
import { ActorDef, FieldLog, Grid, MapDef, carry, linePost } from './mapkit';

const struck = (n: number) => (l: FieldLog) => (l.verbs.strike ?? 0) >= n;
const used = (verb: string) => (l: FieldLog) => (l.verbs[verb] ?? 0) >= 1;
const tornPage = (n: number, x: number, y: number): ActorDef => ({ id: `once${n}`, x, y, sprite: 'page', kind: 'object', name: 'a torn page', cond: `!once_${n}`, talk: [['*', `once_${n}`]] });
const box = (id: string, x: number, y: number, give: string, extra: Partial<ActorDef> = {}): ActorDef => ({
  id, x, y, sprite: 'box', kind: 'object', name: 'a box',
  puzzle: { rote: '# a box. lazy.\nwhen struck:\n  open', need: struck(1), flag: `box_${id}`, give, stays: true, solvedSprite: 'boxopen' },
  ...extra,
});
const mark = (id: string, x: number, y: number, cond?: string): ActorDef => ({ id, x, y, sprite: 'markstone', kind: 'mark', cond });
const lectern = (id: string, x: number, y: number, cond?: string): ActorDef => ({ id, x, y, sprite: 'lectern', kind: 'lectern', cond });
const foe = (id: string, x: number, y: number, sprite: string, enc: string, extra: Partial<ActorDef> = {}): ActorDef => ({ id, x, y, sprite, kind: 'foe', enc, wander: 2, ...extra });
const halted = (id: string, x: number, y: number, scene: string, sprite = 'halted'): ActorDef => ({ id, x, y, sprite, kind: 'npc', look: 'halted', talk: [['*', scene]] });

/** Soaked, and struck after the soak. */
const soakThenStrike = (l: FieldLog) => {
  const s = l.seq.indexOf('soak');
  return s >= 0 && l.seq.slice(s + 1).includes('strike');
};

// ---------------------------------------------------------------- chapter 2

function riverRows() {
  const g = new Grid(20, 30, ',');
  g.v_(0, 0, 30, '=').v_(19, 0, 30, '=');
  g.h_(1, 29, 18, '=');
  g.h_(1, 0, 18, '=').set(5, 0, 'g');
  g.fill(9, 0, 3, 30, '~');
  g.h_(9, 8, 3, 'b').h_(9, 22, 3, 'b');
  for (const [x, y] of [[7, 3], [13, 5], [8, 12], [14, 18], [6, 25], [15, 27], [3, 15], [17, 9], [2, 4], [16, 2]]) g.set(x, y, 'T');
  g.v_(5, 1, 28, '.');
  g.h_(5, 22, 4, '.').h_(12, 22, 5, '.').v_(16, 10, 13, '.').h_(12, 8, 5, '.');
  return g.rows();
}

function standingRows() {
  const g = new Grid(36, 34, '.');
  g.box(0, 0, 36, 34, '=');
  g.fill(17, 0, 2, 34, '~');
  g.set(17, 27, 'b').set(18, 27, 'b').set(17, 15, 'b').set(18, 15, 'b').set(17, 8, 'b').set(18, 8, 'b');
  g.fill(11, 0, 14, 6, 'H').h_(11, 0, 14, 'R');
  for (const x of [12, 15, 20, 23]) g.set(x, 2, 'W');
  g.set(14, 5, 'g');
  g.house(2, 2, 5, 5, [1, 3]);
  g.house(2, 10, 6, 5, [2, 4]);
  g.house(2, 19, 5, 5, [1, 3]);
  g.house(2, 27, 6, 5, [1, 4]);
  g.house(9, 10, 5, 4, [1, 3]);
  g.house(9, 19, 6, 5, [1, 4]);
  g.house(10, 28, 5, 4, [2]);
  g.house(21, 10, 4, 4, [1, 2]);
  g.house(26, 7, 7, 5, [1, 3, 5]);
  g.house(21, 19, 5, 5, [1, 3]);
  g.house(28, 16, 6, 6, [2, 4]);
  g.house(22, 28, 6, 4, [1, 4]);
  g.house(30, 25, 4, 6, [1]);
  g.fill(27, 13, 5, 2, ':');
  g.set(29, 14, 'F');
  for (const [x, y] of [[16, 3], [19, 3], [16, 20], [19, 20], [16, 31], [19, 31], [7, 8], [25, 15]]) g.set(x, y, 'k');
  g.set(15, 33, 'g');
  return g.rows();
}

function hallRows() {
  const g = new Grid(16, 12, '.');
  g.box(0, 0, 16, 12, '=');
  g.fill(7, 0, 2, 12, '~');
  g.set(7, 8, 'b').set(8, 8, 'b').set(7, 10, 'b').set(8, 10, 'b');
  g.set(4, 11, 'g');
  g.fill(1, 1, 14, 1, 'P');
  return g.rows();
}

// ---------------------------------------------------------------- chapter 3

function twiceRows() {
  const g = new Grid(32, 26, ',');
  g.box(0, 0, 32, 26, '=');
  g.set(0, 12, 'g');
  g.fill(11, 1, 10, 6, 'H').h_(11, 1, 10, 'R');
  for (const x of [12, 14, 17, 19]) g.set(x, 3, 'W');
  g.set(16, 6, 'g');
  for (const [x, y] of [[9, 2], [9, 5], [22, 2], [22, 5], [24, 3], [7, 3]]) g.set(x, y, 'V');
  g.fill(6, 9, 20, 8, '.');
  for (const x of [9, 13, 17, 21]) g.set(x, 9, 'S');
  g.house(2, 2, 4, 5, [1, 2]);
  g.house(26, 6, 4, 5, [1, 2]);
  g.house(2, 18, 5, 5, [1, 3]);
  g.house(10, 19, 6, 5, [1, 4]);
  g.house(19, 19, 5, 5, [1, 3]);
  g.fill(26, 16, 5, 9, '.');
  for (const [x, y] of [[26, 18], [30, 18], [26, 21], [30, 21]]) g.set(x, y, 'V');
  g.h_(28, 25, 1, 'g');
  g.h_(1, 12, 5, '.');
  g.v_(16, 7, 2, '.');
  return g.rows();
}

function pressRows() {
  const p = new Grid(30, 24, '#');
  p.fill(1, 1, 6, 5, 'x').set(2, 1, 's');
  p.h_(7, 3, 4, '.');
  p.fill(11, 1, 8, 6, 'x');
  for (const [x, y] of [[12, 2], [14, 2], [16, 2], [12, 5], [14, 5], [16, 5]]) p.set(x, y, 'V');
  p.v_(15, 7, 3, '.');
  p.fill(10, 10, 11, 6, 'x');
  p.h_(10, 12, 11, 'p');
  p.h_(21, 12, 2, '.');
  p.fill(23, 9, 6, 7, '.');
  p.h_(4, 12, 6, '.');
  p.fill(1, 10, 4, 7, 'x');
  p.v_(15, 16, 2, '.');
  p.fill(6, 18, 19, 5, 'x');
  for (const [x, y] of [[7, 19], [7, 21], [23, 19], [23, 21]]) p.set(x, y, 'V');
  return p.rows();
}

// ---------------------------------------------------------------- chapter 4

function earsRows() {
  const g = new Grid(40, 30, 'm');
  g.box(0, 0, 40, 30, '=');
  g.set(0, 14, 'g');
  const dishes: [number, number][] = [];
  for (let y = 2; y < 28; y += 3) for (let x = 3; x < 38; x += 4) dishes.push([x + ((y / 3) % 2 ? 2 : 0), y]);
  for (const [x, y] of dishes) if (!(x > 14 && x < 25 && y > 7 && y < 19) && !(x > 28 && y > 20) && !(y === 14)) g.set(x, y, 'D');
  g.fill(16, 9, 8, 7, 'H').h_(16, 9, 8, 'R');
  g.v_(19, 0, 9, '|').v_(20, 0, 9, '|');
  g.set(19, 15, 'g');
  g.h_(1, 14, 18, ',');
  g.v_(19, 16, 12, ',');
  g.fill(30, 21, 7, 6, 'r');
  for (const [x, y] of [[30, 21], [36, 21], [30, 26], [36, 26], [33, 21]]) g.set(x, y, 'D');
  for (const [x, y] of [[6, 12], [10, 12], [6, 16], [11, 16], [27, 13], [31, 15]]) g.set(x, y, 'h');
  for (const [x, y] of [[3, 13], [7, 15], [11, 13], [14, 15], [21, 17], [17, 19], [20, 24], [17, 27], [24, 14], [33, 12]]) g.set(x, y, 'e');
  return g.rows();
}

function relayRows() {
  const g = new Grid(20, 16, '#');
  g.fill(1, 1, 18, 14, 'x');
  g.v_(9, 0, 6, '|').v_(10, 0, 6, '|');
  g.fill(3, 7, 2, 2, 'D').fill(15, 7, 2, 2, 'D');
  g.set(9, 15, 'g');
  return g.rows();
}

// ---------------------------------------------------------------- chapter 5

function rungRows(variant: number) {
  const g = new Grid(20, 20, '^');
  g.fill(3, 2, 14, 16, 'x');
  g.box(3, 2, 14, 16, 'L');
  g.v_(9, 0, 20, '|').v_(10, 0, 20, '|');
  g.set(9, 17, 'x').set(10, 17, 'x');
  g.set(9, 2, 'x').set(10, 2, 'x');
  if (variant === 1) { g.fill(5, 6, 3, 1, 'L'); g.fill(12, 11, 3, 1, 'L'); }
  if (variant === 2) { g.fill(5, 10, 4, 1, 'L'); g.fill(12, 6, 3, 3, 'L'); g.set(13, 7, 'x').set(13, 8, 'x'); }
  if (variant === 3) { g.fill(4, 5, 4, 1, 'L'); g.fill(12, 5, 4, 1, 'L'); g.fill(6, 12, 8, 1, 'L'); g.fill(13, 13, 3, 2, '%'); g.set(4, 9, '%').set(5, 9, '%'); }
  for (const [x, y] of [[3, 4 + variant], [3, 13], [16, 8], [16, 3 + variant * 4]]) g.set(x, y, 'v');
  g.set(9, 1, 's').set(10, 1, 's');
  for (const x of [9, 10]) for (const y of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) g.set(x, y, 'x');
  return g.rows();
}

function writingRows() {
  const g = new Grid(22, 26, '^');
  g.fill(4, 13, 14, 12, '.');
  g.box(4, 13, 14, 12, 'P');
  g.set(10, 24, '.').set(11, 24, '.');
  g.set(10, 13, 'g').set(11, 13, 'g');
  g.fill(2, 1, 18, 12, '.');
  g.box(2, 0, 18, 13, 'P');
  g.set(10, 12, 'g').set(11, 12, 'g');
  for (const [x, y] of [[4, 3], [5, 3], [4, 4], [16, 7], [17, 7], [16, 8], [6, 9], [15, 3]]) g.set(x, y, '%');
  for (const [x, y] of [[6, 20], [7, 20], [14, 16], [15, 16]]) g.set(x, y, '%');
  for (const [x, y] of [[8, 1], [13, 1], [3, 10], [12, 22]]) g.set(x, y, 'I');
  return g.rows();
}

// ---------------------------------------------------------------- chapter 6

function nurseryRows() {
  const g = new Grid(16, 13, '.');
  g.box(0, 0, 16, 13, 'P');
  for (let y = 2; y <= 8; y += 2) for (let x = 2; x <= 13; x += 3) g.set(x, y, 'c');
  for (const x of [2, 5, 8, 11]) g.set(x, 1, 'M');
  g.set(14, 3, 'M').set(1, 9, 'M');
  g.set(7, 12, 'g');
  return g.rows();
}

const HALT_ROTE = '# a gate. stops what leaves.\nhalt';

export const MAPS2: Record<string, MapDef> = {
  river: {
    id: 'river', name: 'the river', region: 'river', rows: riverRows(),
    enter: [['!seen_c2_open', 'c2_open']],
    exits: [{ x: 5, y: 0, to: 'standing', tx: 15, ty: 32 }],
    triggers: [],
    actors: [
      carry('carry_r', 6, 24),
      { id: 'reel', x: 7, y: 16, sprite: 'reel', kind: 'npc', stet: 'reel', reel: 'river', tempo: 200, rote: '# fishes. very still.\nwait\nreel', talk: [['seen_npc_reel', 'npc_reel_2'], ['*', 'npc_reel']] },
      tornPage(3, 1, 28),
      foe('fisher1', 6, 20, 'fisher', 'fisher', { copied: true }),
      foe('fisher2', 15, 13, 'fisher', 'fisher2', { copied: true }),
      foe('lull1', 4, 6, 'lull', 'lull'),
      foe('fisher3', 14, 4, 'fisher', 'fisher', { copied: true, respawn: true }),
      lectern('lect_r', 3, 26),
      box('rbox', 17, 2, 'salve'),
      mark('mark_r', 18, 28),
    ],
  },
  standing: {
    id: 'standing', name: 'Standing', region: 'standing', rows: standingRows(),
    enter: [['!seen_c2_standing_gate', 'c2_standing_gate']],
    exits: [{ x: 14, y: 5, to: 'hall', tx: 4, ty: 10 }],
    triggers: [],
    actors: [
      carry('carry_s', 23, 25),
      linePost('post_s', 16, 24, 'standing'),
      { id: 'tally', x: 25, y: 6, sprite: 'tally', kind: 'npc', stet: 'tally', tempo: 60, light: 0.7, rote: '# counts. moves nothing.\ncount the seconds\nwait', talk: [['seen_npc_tally', 'npc_tally_2'], ['*', 'npc_tally']] },
      halted('hop', 6, 16, 'obj_hop', 'hop'),
      { id: 'show', x: 29, y: 13, sprite: 'show', kind: 'npc', look: 'halted', talk: [['has_primer2', 'obj_show_after'], ['*', 'obj_show']] },
      halted('halt_a', 12, 15, 'obj_halted_a'),
      halted('halt_b', 24, 16, 'obj_halted_b'),
      halted('halt_c1', 7, 25, 'obj_halted_c'),
      halted('halt_c2', 8, 25, 'obj_halted_c'),
      halted('halt_d', 31, 24, 'obj_halted_d', 'nip'),
      halted('halt_e', 20, 30, 'obj_halted_wait'),
      {
        id: 'lock', x: 14, y: 6, sprite: 'door', kind: 'object', name: 'a lock',
        puzzle: { rote: '# a lock. old. picky.\nwhen soaked, then struck:\n  open', need: soakThenStrike, flag: 'lock_open', scene: 'obj_lock_open' },
      },
      foe('lull_s1', 8, 17, 'lull', 'lull'),
      foe('lull_s2', 27, 30, 'lull', 'lull'),
      foe('tock_s1', 13, 25, 'tock', 'tock'),
      foe('tock_s2', 25, 24, 'tock', 'tock2'),
      foe('grit_s1', 6, 8, 'grit', 'grit'),
      foe('grit_s2', 31, 3, 'grit', 'gritlull'),
      foe('lull_s3', 33, 12, 'lull', 'lull', { respawn: true }),
      lectern('lect_s', 16, 9),
      box('sbox1', 8, 32, 'bell'),
      box('sbox2', 34, 14, 'inkpot'),
      mark('mark_s', 34, 32),
      {
        id: 'lamp', x: 24, y: 15, sprite: 'lamp', kind: 'object', name: 'a lamp post',
        puzzle: { rote: '# a lamp. waits for the lighter.\n# the lighter is halted.\nwhen listened to:\n  light', need: used('listen'), flag: 'lamp_lit', scene: 'obj_lamp_lit', stays: true, solvedSprite: 'lamplit' },
        talk: [['!seen_obj_lamp', 'obj_lamp']],
      },
    ],
  },
  hall: {
    id: 'hall', name: 'Hold\'s hall', region: 'standing', rows: hallRows(),
    exits: [{ x: 4, y: 11, to: 'standing', tx: 14, ty: 7 }],
    triggers: [{ x: 1, y: 5, w: 14, h: 1, scene: 'c2_hold', cond: '!c2_done', once: 'hold_met' }],
    actors: [
      tornPage(4, 13, 9),
      { id: 'hold', x: 7, y: 2, sprite: 'hold16', kind: 'npc', light: 0.4, rote: '# the first gate. keeps all of it.\nif foe.acted > 2:\n  halt foe\nelse:\n  press foe\nwait', talk: [['*', 'c2_hold']] },
    ],
  },

  twice: {
    id: 'twice', name: 'Twice', region: 'twice', rows: twiceRows(),
    enter: [['!seen_c3_open', 'c3_open']],
    exits: [
      { x: 16, y: 6, to: 'twice', tx: 16, ty: 8, cond: 'never', block: 'npc_press_door' },
      { x: 28, y: 25, to: 'press', tx: 2, ty: 2, cond: 'met_each', block: 'c3_drain_shut' },
    ],
    triggers: [
      { x: 6, y: 9, w: 1, h: 8, scene: 'c3_each_meet', once: 'each_met_t' },
      { x: 26, y: 23, w: 5, h: 2, scene: 'c3_each_join', cond: 'met_each,!lent_each', once: 'each_join_t' },
    ],
    actors: [
      carry('carry_tw', 29, 17),
      linePost('post_tw', 29, 24, 'twice'),
      { id: 'weigh1', x: 9, y: 10, sprite: 'weigh', kind: 'npc', stet: 'weigh', stetShop: true, tempo: 40, rote: '# weighs pages.\nweigh\nwait', talk: [['c3_done', 'npc_weigh_after'], ['has_primer3', 'npc_weigh_2'], ['*', 'npc_weigh_1']] },
      { id: 'weigh2', x: 13, y: 10, sprite: 'weigh', kind: 'npc', tempo: 40, cond: '!c3_done', rote: '# weighs pages.\nweigh\nwait', talk: [['has_primer3', 'npc_weigh_2'], ['*', 'npc_weigh_1']] },
      { id: 'weigh3', x: 17, y: 10, sprite: 'weigh', kind: 'npc', tempo: 40, cond: '!c3_done', rote: '# weighs pages.\nweigh\nwait', talk: [['has_primer3', 'npc_weigh_2'], ['*', 'npc_weigh_1']] },
      { id: 'many_t', x: 21, y: 13, sprite: 'many', kind: 'npc', tempo: 30, cond: '!c3_done', rote: '# a good mayor. fond of himself.\nwelcome foe\nwait', talk: [['*', 'npc_many_1']] },
      { id: 'cust1', x: 8, y: 14, sprite: 'customer', kind: 'npc', tempo: 50, rote: '# a customer.\nbuy\nbuy', talk: [['c3_done', 'npc_twice_after'], ['*', 'npc_twice_a']] },
      { id: 'cust2', x: 24, y: 15, sprite: 'customer', kind: 'npc', tempo: 50, rote: '# a customer.\nbuy\nbuy', talk: [['c3_done', 'npc_twice_after'], ['*', 'npc_twice_b']] },
      { id: 'cust3', x: 4, y: 9, sprite: 'customer', kind: 'npc', tempo: 50, rote: '# a customer.\nbuy\nbuy', talk: [['c3_done', 'npc_twice_after'], ['*', 'npc_twice_c']] },
      { id: 'ph_door', x: 16, y: 7, sprite: 'presshand', kind: 'npc', copied: true, cond: '!c3_done', rote: '# again\nstamp\nwait', talk: [['*', 'npc_press_door']] },
      { id: 'each_t', x: 27, y: 20, sprite: 'each', kind: 'npc', cond: 'met_each,!lent_each', tempo: 20, rote: '# seven. they count differently.\neach f in foes: peck f\nwait', talk: [['*', 'c3_each_story']] },
      foe('clerks_t', 6, 4, 'clerk', 'clerks'),
      { id: 'many_stet', x: 21, y: 13, sprite: 'many', kind: 'npc', cond: 'c3_done', stet: 'many', tempo: 30, rote: '# a great many. one, now.\nsit\nwait', talk: [['*', 'npc_many_after']] },
      { id: 'ph_stet', x: 12, y: 15, sprite: 'presshand', kind: 'npc', cond: 'c3_done', stet: 'presshand', tempo: 50, rote: '# a flat stamp. off duty.\nstamp\nwait', talk: [['*', 'npc_presshand_after']] },
      { id: 'drainsign', x: 27, y: 24, sprite: 'ledger', kind: 'object', name: 'a sign', talk: [['*', 'obj_drain_sign']] },
      tornPage(5, 30, 24),
      {
        id: 'form', x: 21, y: 10, sprite: 'form', kind: 'object', name: 'a form',
        puzzle: { rote: '# a form. two stamps.\n# it has one.\nwhen stamped:\n  file', need: used('stamp'), flag: 'form_filed', scene: 'obj_form_done', stays: true, solvedSprite: 'formdone' },
        talk: [['!seen_obj_form', 'obj_form']],
      },
      lectern('lect_t', 4, 14),
      box('tbox', 30, 2, 'inkpot'),
      mark('mark_t', 1, 24),
    ],
  },
  press: {
    id: 'press', name: 'the Press', region: 'press', rows: pressRows(),
    exits: [{ x: 2, y: 1, to: 'twice', tx: 28, ty: 23 }],
    triggers: [{ x: 6, y: 17, w: 19, h: 1, scene: 'c3_press_core', cond: '!c3_done', once: 'press_core_t' }],
    actors: [
      foe('clerks_p', 13, 3, 'clerk', 'clerks', { wander: 1 }),
      { id: 'ledger', x: 15, y: 8, sprite: 'ledger', kind: 'object', name: 'the ledger door', talk: [['!ledger_open', 'obj_ledger']], puzzle: { rote: '# counts what walks out.\nwhen told how many:\n  open', need: (l) => l.said.includes('77'), flag: 'ledger_open', scene: 'obj_ledger_open' } },
      foe('vat_p', 12, 13, 'vatling', 'vat'),
      foe('split_p', 2, 13, 'split', 'split', { wander: 1 }),
      foe('press_p', 18, 11, 'presshand', 'presshand', { copied: true }),
      foe('press2_p', 25, 13, 'presshand', 'press2', { copied: true, wander: 1 }),
      { id: 'office', x: 27, y: 10, sprite: 'page', kind: 'object', name: 'a desk', cond: '!has_primer3', talk: [['*', 'obj_press_office']] },
      lectern('lect_p', 24, 14),
      box('pbox', 1, 16, 'salve'),
      mark('mark_p', 28, 15),
      { id: 'many_p', x: 15, y: 20, sprite: 'many', kind: 'npc', copied: true, cond: '!c3_done', enc: 'many', talk: [['*', 'c3_press_core']] },
    ],
  },

  ears: {
    id: 'ears', name: 'the Ears', region: 'ears', rows: earsRows(),
    enter: [['!seen_c4_open', 'c4_open']],
    exits: [{ x: 19, y: 15, to: 'relay', tx: 9, ty: 14, cond: 'has_primer4', block: 'npc_heed_first' }],
    triggers: [{ x: 3, y: 13, w: 1, h: 3, scene: 'c4_when', once: 'when_t' }],
    actors: [
      carry('carry_e', 2, 15),
      linePost('post_e', 31, 23, 'ears'),
      { id: 'heed', x: 10, y: 8, sprite: 'heed', kind: 'npc', stet: 'heed', tempo: 80, rote: '# the oldest ear. listens.\nlisten\nwait', talk: [['has_primer4', 'npc_heed_2'], ['*', 'npc_heed']] },
      { id: 'lis1', x: 6, y: 20, sprite: 'listener', kind: 'npc', stet: 'listener', tempo: 70, rote: '# listens up.\nlisten\nwait', talk: [['*', 'npc_listener_a']] },
      { id: 'lis2', x: 28, y: 6, sprite: 'listener', kind: 'npc', tempo: 70, rote: '# listens up.\nlisten\nwait', talk: [['*', 'npc_listener_b']] },
      { id: 'lis3', x: 25, y: 18, sprite: 'listener', kind: 'npc', copied: true, rote: '# again\nlisten\nagain', talk: [['*', 'npc_listener_copied']] },
      { id: 'hand', x: 33, y: 24, sprite: 'hand', kind: 'object', name: 'a hand', cond: '!got_hand', talk: [['*', 'c4_second_hand']] },
      foe('flinch_e', 8, 4, 'flinch', 'flinch'),
      foe('ringer_e', 30, 10, 'ringer', 'ringer'),
      foe('dish_e', 12, 24, 'dish', 'dish'),
      foe('dish2_e', 34, 15, 'dish', 'dish2'),
      foe('static_e', 24, 22, 'listener', 'static', { copied: true }),
      foe('flinch_r', 28, 26, 'flinch', 'flinch', { respawn: true }),
      lectern('lect_e', 16, 17),
      { id: 'slate', x: 8, y: 9, sprite: 'ledger', kind: 'object', name: 'a slate', talk: [['*', 'obj_tally_slate']] },
      {
        id: 'dishdown', x: 24, y: 24, sprite: 'dishdown', kind: 'object', name: 'a dish facing down',
        puzzle: { rote: '# a dish. it turned around.\n# it hears the ground now.\nlisten\nwhen hushed:\n  turn back', need: used('hush'), flag: 'dish_up', scene: 'obj_dish_up', stays: true, solvedSprite: 'dishup' },
        talk: [['!seen_obj_dish_down', 'obj_dish_down']],
      },
      box('ebox', 38, 2, 'bell'),
      mark('mark_e', 1, 1),
    ],
  },
  relay: {
    id: 'relay', name: 'the Relay', region: 'ears', rows: relayRows(),
    exits: [{ x: 9, y: 15, to: 'ears', tx: 19, ty: 16 }],
    triggers: [{ x: 1, y: 6, w: 18, h: 1, scene: 'c4_relay', cond: '!c4_done', once: 'relay_t' }],
    actors: [
      { id: 'relay_b', x: 9, y: 2, sprite: 'relay16', kind: 'npc', light: 0.6, cond: '!c4_done', enc: 'relay', talk: [['*', 'c4_relay']] },
      foe('static_r', 4, 11, 'listener', 'static', { copied: true, wander: 1 }),
      lectern('lect_rel', 15, 12),
    ],
  },

  rung1: {
    id: 'rung1', name: 'the first Rung', region: 'tether', rows: rungRows(1),
    enter: [['!seen_c5_open', 'c5_open']],
    exits: [{ x: 9, y: 1, to: 'rung2', tx: 9, ty: 16 }, { x: 10, y: 1, to: 'rung2', tx: 10, ty: 16 }],
    triggers: [{ x: 3, y: 12, w: 14, h: 1, scene: 'c5_gloss', once: 'gloss_t' }],
    actors: [
      carry('carry_t', 12, 15),
      linePost('post_t', 5, 15, 'tether'),
      { id: 'bucket', x: 9, y: 17, sprite: 'bucket', kind: 'deco', light: 0.5 },
      foe('drift1', 5, 8, 'drift', 'drift'),
      foe('drift2', 14, 4, 'drift', 'drift', { respawn: true }),
      { id: 'gloss5', x: 7, y: 10, sprite: 'gloss', kind: 'npc', stet: 'gloss', cond: 'gloss_with', tempo: 70, rote: 'gloss  # notes things\nwait', talk: [['*', 'c5_gloss_idle']] },
      box('rung1box', 15, 15, 'inkpot'),
    ],
  },
  rung2: {
    id: 'rung2', name: 'the second Rung', region: 'tether', rows: rungRows(2),
    exits: [{ x: 9, y: 1, to: 'rung3', tx: 9, ty: 16 }, { x: 10, y: 1, to: 'rung3', tx: 10, ty: 16 }],
    triggers: [],
    actors: [
      { id: 'keep', x: 6, y: 14, sprite: 'keep', kind: 'npc', stet: 'keep', tempo: 90, rote: '# keeps the rung for them.\nkeep\nwait', talk: [['seen_npc_keep', 'npc_keep_2'], ['*', 'npc_keep']] },
      foe('sentry1', 13, 9, 'sentry', 'sentry'),
      foe('drift3', 5, 4, 'drift', 'drift'),
      lectern('lect_r2', 14, 15),
      { id: 'railnote', x: 4, y: 12, sprite: 'page', kind: 'object', name: 'the rail', talk: [['*', 'obj_rail_note']] },
      mark('mark_r2', 13, 7),
      tornPage(7, 15, 16),
    ],
  },
  rung3: {
    id: 'rung3', name: 'the third Rung', region: 'tether', rows: rungRows(3),
    exits: [{ x: 9, y: 1, to: 'writing', tx: 10, ty: 23 }, { x: 10, y: 1, to: 'writing', tx: 11, ty: 23 }],
    triggers: [{ x: 3, y: 14, w: 14, h: 1, scene: 'c5_copies', once: 'copies_t' }],
    actors: [
      foe('wc1', 5, 9, 'wait', 'waitcopy', { copied: true }),
      foe('wc2', 14, 9, 'wait', 'sentry2', { copied: true }),
      foe('wc3', 7, 3, 'wait', 'waitcopy', { copied: true, respawn: true }),
      box('rung3box', 4, 15, 'salve'),
    ],
  },
  writing: {
    id: 'writing', name: 'the Writing Room', region: 'writing', rows: writingRows(),
    exits: [],
    triggers: [
      { x: 5, y: 18, w: 12, h: 1, scene: 'c5_arm', cond: '!has_notebook', once: 'arm_t' },
      { x: 3, y: 10, w: 16, h: 1, scene: 'c5_again', cond: 'has_notebook', once: 'again_t' },
    ],
    actors: [
      { id: 'arm', x: 10, y: 15, sprite: 'arm16', kind: 'npc', copied: true, cond: '!has_notebook', enc: 'arm', talk: [['*', 'c5_arm']] },
      { id: 'ring', x: 10, y: 3, sprite: 'ring16', kind: 'npc', copied: true, rote: '# again\nagain' },
      lectern('lect_w', 15, 21),
      { id: 'folded', x: 5, y: 15, sprite: 'page', kind: 'object', name: 'a page', talk: [['*', 'obj_folded_page']] },
    ],
  },

  nursery: {
    id: 'nursery', name: 'the Nursery', region: 'nursery', rows: nurseryRows(),
    exits: [{ x: 7, y: 12, to: 'busy', tx: 13, ty: 5 }],
    triggers: [{ x: 1, y: 9, w: 14, h: 1, scene: 'c6_nursery', cond: '!c6_won', once: 'nursery_t' }],
    actors: [
      ...[[2, 2], [5, 2], [8, 2], [11, 2], [2, 4], [5, 4], [8, 4], [11, 4], [2, 6], [5, 6], [8, 6], [11, 6], [2, 8], [5, 8], [8, 8], [11, 8]].map(([x, y], i): ActorDef => ({ id: `u${i}`, x: x + 1, y, sprite: 'unwritten', kind: 'deco', look: 'blank', solid: false })),
      { id: 'u_last', x: 14, y: 8, sprite: 'unwritten', kind: 'deco', look: 'blank', solid: false },
      { id: 'ring6', x: 7, y: 4, sprite: 'ring16', kind: 'npc', copied: true, cond: '!c6_won', enc: 'again', talk: [['*', 'c6_nursery']] },
    ],
  },
};

export const HALT_WALL_ROTE = HALT_ROTE;
