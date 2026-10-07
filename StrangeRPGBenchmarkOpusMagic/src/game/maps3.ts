// Act 2: the Line across the sky, the inside of the Scrivener, and what changed in the old places in seven years.
import { ActorDef, FieldLog, Grid, MapDef, carry, linePost } from './mapkit';

const foe = (id: string, x: number, y: number, sprite: string, enc: string, cond = 'c>=7'): ActorDef => ({ id, x, y, sprite, kind: 'foe', enc, wander: 2, cond });
const npc = (id: string, x: number, y: number, sprite: string, scene: string, extra: Partial<ActorDef> = {}): ActorDef => ({ id, x, y, sprite, kind: 'npc', tempo: 60, talk: [['*', scene]], ...extra });
const wrote = (word: string) => (l: FieldLog) => l.written.some((t) => t.trim().startsWith(word));

// ---------------------------------------------------------------- chapter 9: the Line

function line1Rows(): string[] {
  const g = new Grid(24, 22, '^');
  g.v_(11, 14, 8, 'w');
  g.v_(11, 3, 8, 'w');
  g.h_(12, 4, 12, 'w');
  g.h_(6, 18, 5, 'w');
  g.fill(4, 16, 3, 3, 'w');
  g.h_(12, 8, 4, 'w');
  g.fill(15, 6, 3, 4, 'w');
  g.set(11, 2, 'y');
  return g.rows();
}

function gutterRows(): string[] {
  const g = new Grid(14, 10, '^');
  g.fill(2, 1, 10, 3, 'y');
  g.v_(7, 4, 6, 'w');
  return g.rows();
}

function line2Rows(): string[] {
  const g = new Grid(24, 22, '^');
  g.h_(0, 4, 11, 'w');
  g.set(6, 3, 'w').set(3, 5, 'w');
  g.v_(10, 4, 13, 'w');
  g.h_(10, 12, 6, 'w');
  g.h_(13, 11, 2, 'w');
  g.set(15, 11, '_');
  g.h_(10, 16, 6, 'w');
  g.h_(18, 16, 6, 'w');
  return g.rows();
}

function line3Rows(): string[] {
  const g = new Grid(24, 20, '^');
  g.h_(0, 10, 9, 'w');
  g.fill(8, 7, 9, 7, 'y');
  g.h_(17, 10, 6, 'y');
  return g.rows();
}

// ---------------------------------------------------------------- chapter 10: the Scrivener

function scriv1Rows(): string[] {
  const g = new Grid(20, 24, 'H');
  g.fill(2, 2, 16, 20, 'q');
  for (const y of [5, 11, 17]) { g.set(1, y, 'W'); g.set(18, y, 'W'); }
  for (const [x, y] of [[5, 7], [14, 7], [5, 14], [14, 14]]) g.set(x, y, 'H');
  g.set(9, 1, 'q').set(9, 0, 'g');
  return g.rows();
}

function scriv2Rows(): string[] {
  const g = new Grid(24, 24, 'H');
  g.fill(1, 4, 22, 19, 'q');
  g.fill(10, 1, 5, 2, 'q');
  g.set(12, 0, 'g');
  for (const x of [6, 12, 18]) g.set(x, 11, '_');
  for (const x of [2, 21]) for (const y of [8, 14, 20]) g.set(x, y, 'W');
  return g.rows();
}

function scriv3Rows(): string[] {
  const g = new Grid(20, 20, 'H');
  g.fill(2, 2, 16, 16, 'q');
  g.set(9, 18, 'q').set(9, 19, 'g');
  for (const x of [1, 18]) for (const y of [5, 10, 15]) g.set(x, y, 'W');
  return g.rows();
}

const ARM_ROTE = (waits: number) => `# files. up the rail, down the rail.\nstep\nstep\nstep\nturn\nturn${'\nwait'.repeat(waits)}`;

export const MAPS3: Record<string, MapDef> = {
  line1: {
    id: 'line1', name: 'the Line', region: 'line', rows: line1Rows(),
    enter: [['!seen_c9_line_open', 'c9_line_open']],
    exits: [{ x: 23, y: 4, to: 'line2', tx: 1, ty: 4 }, { x: 11, y: 2, to: 'gutter', tx: 7, ty: 8 }],
    triggers: [{ x: 11, y: 8, scene: 'c9_asides', once: 'l1_asides' }],
    actors: [
      {
        id: 'word1', x: 11, y: 14, sprite: 'loose', kind: 'object', name: 'a loose word',
        mover: { rote: '# a loose word.\n# it came off something.\nwait', dir: 1 },
      },
      foe('loose_l1', 16, 7, 'loose', 'loose'),
      { id: 'l1box', x: 4, y: 16, sprite: 'box', kind: 'object', name: 'a box', puzzle: { rote: '# a box. lazy.\nwhen struck:\n  open', need: (l) => (l.verbs.strike ?? 0) >= 1, flag: 'box_l1box', give: 'blanks20', stays: true, solvedSprite: 'boxopen' } },
    ],
  },
  gutter: {
    id: 'gutter', name: 'under the Line', region: 'line', rows: gutterRows(),
    enter: [['!seen_gutter_open', 'gutter_open']],
    exits: [{ x: 7, y: 9, to: 'line1', tx: 11, ty: 3 }],
    triggers: [],
    actors: [
      { id: 'gut_a', x: 3, y: 2, sprite: 'page', kind: 'object', name: 'a struck aside', light: 0.55, talk: [['*', 'gutter_a']] },
      { id: 'gut_b', x: 6, y: 1, sprite: 'page', kind: 'object', name: 'a struck aside', light: 0.55, talk: [['*', 'gutter_b']] },
      { id: 'gut_c', x: 9, y: 2, sprite: 'page', kind: 'object', name: 'a struck aside', light: 0.55, talk: [['*', 'gutter_c']] },
      { id: 'gut_d', x: 11, y: 1, sprite: 'page', kind: 'object', name: 'an aside', light: 0.9, talk: [['found_gutter', 'gutter_d_after'], ['*', 'gutter_d']] },
      { id: 'mark_gutter', x: 2, y: 3, sprite: 'markstone', kind: 'mark' },
    ],
  },
  line2: {
    id: 'line2', name: 'the Line', region: 'line', rows: line2Rows(),
    exits: [{ x: 0, y: 4, to: 'line1', tx: 22, ty: 4 }, { x: 23, y: 16, to: 'line3', tx: 1, ty: 10 }],
    triggers: [{ x: 10, y: 9, scene: 'c9_gloss_voice', once: 'l2_gloss' }],
    groups: [{ group: 'l2', flag: 'l2_open', opens: [[16, 16, 'road'], [17, 16, 'road']] }],
    actors: [
      carry('carry_l', 6, 3),
      linePost('post_l', 3, 5, 'tether'),
      {
        id: 'sentence', x: 12, y: 12, sprite: 'firstline', kind: 'object', name: 'a sentence',
        mover: { rote: '# a sentence. it only goes on.\nstep', dir: 3, group: 'l2' },
      },
      foe('first_l2', 20, 16, 'firstline', 'firstline'),
    ],
  },
  line3: {
    id: 'line3', name: 'the Line, struck through', region: 'line', rows: line3Rows(),
    exits: [{ x: 0, y: 10, to: 'line2', tx: 22, ty: 16 }],
    triggers: [{ x: 10, y: 7, h: 7, scene: 'c9_over', cond: '!c9_over_done', once: 'l3_over' }],
    actors: [
      { id: 'over_n', x: 14, y: 10, sprite: 'over', kind: 'deco', cond: '!c9_over_done' },
      { id: 'cart_l3', x: 21, y: 10, sprite: 'carry', kind: 'deco', name: 'Carry\'s cart' },
    ],
  },
  scriv1: {
    id: 'scriv1', name: 'the Scrivener', region: 'scriv', rows: scriv1Rows(),
    enter: [['!seen_c10_open', 'c10_open']],
    exits: [{ x: 9, y: 0, to: 'scriv2', tx: 12, ty: 21 }],
    triggers: [],
    actors: [
      { id: 'hand', x: 9, y: 5, sprite: 'hand2', kind: 'deco', light: 0.6, name: 'the hand' },
      foe('filer_s1', 5, 11, 'filer', 'filer'),
      foe('mite_s1', 14, 10, 'quillmite', 'filer2'),
      { id: 'lect_s1', x: 3, y: 20, sprite: 'lectern', kind: 'lectern' },
      carry('carry_s1', 15, 20),
    ],
  },
  scriv2: {
    id: 'scriv2', name: 'the filing room', region: 'scriv', rows: scriv2Rows(),
    enter: [['!seen_c10_files', 'c10_files']],
    exits: [{ x: 12, y: 0, to: 'scriv3', tx: 9, ty: 17 }, { x: 12, y: 23, to: 'scriv1', tx: 9, ty: 2 }],
    triggers: [],
    groups: [{ group: 'arms', flag: 'arms_done', opens: [[12, 3, 'scrivfloor']], scene: 'c10_arms_done' }],
    actors: [
      { id: 'arm1', x: 6, y: 8, sprite: 'filer', kind: 'object', name: 'a filing arm', mover: { rote: ARM_ROTE(0), dir: 0, group: 'arms', needStop: true } },
      { id: 'arm2', x: 12, y: 8, sprite: 'filer', kind: 'object', name: 'a filing arm', mover: { rote: ARM_ROTE(1), dir: 0, group: 'arms', needStop: true } },
      { id: 'arm3', x: 18, y: 8, sprite: 'filer', kind: 'object', name: 'a filing arm', mover: { rote: ARM_ROTE(2), dir: 0, group: 'arms', needStop: true } },
      { id: 'lastpage', x: 12, y: 6, sprite: 'page', kind: 'object', name: 'the page of last lines', talk: [['*', 'c10_lastpage_read']] },
      npc('once10', 13, 6, 'once', 'c10_lastpage', { talk: [['!seen_c10_lastpage', 'c10_lastpage'], ['*', 'c10_once_idle']] }),
      foe('filer_s2', 8, 18, 'filer', 'filer'),
      foe('dele_s2', 16, 19, 'dele', 'delefiler'),
    ],
  },
  scriv3: {
    id: 'scriv3', name: 'the top room', region: 'scriv', rows: scriv3Rows(),
    enter: [['!seen_c10_quill', 'c10_quill']],
    exits: [{ x: 9, y: 19, to: 'scriv2', tx: 12, ty: 1 }],
    triggers: [],
    actors: [
      { id: 'gloss10', x: 9, y: 6, sprite: 'gloss', kind: 'npc', tempo: 70, name: 'Gloss', talk: [['*', 'c10_gloss_idle']] },
      { id: 'quill', x: 10, y: 5, sprite: 'hand2', kind: 'deco', light: 0.8, name: 'the quill' },
    ],
  },
};

/** Adds what is new in the old places, seven years on. */
export function applyAct2(MAPS: Record<string, MapDef>) {
  const add = (id: string, f: (m: MapDef) => void) => f(MAPS[id]);
  const prependTalk = (m: MapDef, actor: string, cond: string, scene: string) => {
    const a = m.actors.find((x) => x.id === actor);
    if (a) a.talk = [[cond, scene], ...(a.talk ?? [])];
  };

  add('busy', (m) => {
    m.altRegions = [['c>=7', 'busy7']];
    m.enter = [['c=7,!seen_c7_open', 'c7_open'], ...(m.enter ?? [])];
    const door = m.exits.find((e) => e.to === 'nursery');
    if (door) door.cond = 'c=6,halt_found|c>=7';
    m.actors.push(
      {
        id: 'cart7', x: 13, y: 5, sprite: 'cart', kind: 'object', name: 'a cart', cond: 'c=7', tempo: 30,
        puzzle: { rote: '# a cart. lost.\nturn\nturn\nstep', need: (l) => l.written.length > 0, flag: 'c7_cart_done', scene: 'c7_cart_done' },
        talk: [['!seen_c7_tutorial', 'c7_tutorial']],
      },
      npc('sweep7', 15, 12, 'sweep', 'npc_sweep_7', { cond: 'c>=7' }),
      npc('count7', 17, 9, 'count', 'npc_count_7', { cond: 'c>=7', stet: 'count' }),
      npc('stack7', 11, 14, 'stack', 'npc_stack_7', { cond: 'c>=7', stet: 'stack' }),
      npc('pour7', 25, 13, 'pour', 'npc_pour_7', { cond: 'c>=7' }),
      npc('sw1', 9, 12, 'smallwait', 'npc_smallwait_1', { cond: 'c>=7', tempo: 40 }),
      npc('sw2', 19, 11, 'smallwait', 'npc_smallwait_2', { cond: 'c>=7', tempo: 44 }),
      npc('sw3', 6, 13, 'smallwait', 'npc_smallwait_3', { cond: 'c>=7', tempo: 48 }),
      { id: 'sw4', x: 21, y: 13, sprite: 'smallwait', kind: 'deco', cond: 'c>=7', tempo: 52 },
      { id: 'sw5', x: 16, y: 15, sprite: 'smallwait', kind: 'deco', cond: 'c>=7', tempo: 56 },
      npc('straw7', 8, 10, 'strawstill', 'npc_straw_7', {
        cond: 'c>=7,!straw_stands', look: 'halted', kind: 'object', name: 'Straw',
        puzzle: { rote: '# straw.\nstand  # it stands\nhalt  # it stood. that was enough.', need: wrote('stand'), flag: 'straw_stands', scene: 'side_straw_stands', give: 'thick' },
      }),
      npc('straw7b', 8, 10, 'straw', 'npc_straw_7b', { cond: 'c>=7,straw_stands', tempo: 120 }),
      npc('halt7', 1, 11, 'halt', 'npc_halt_7', { cond: 'c=7,!c7_halt_gone', tempo: 100 }),
      { id: 'gate7', x: 1, y: 11, sprite: 'gate', kind: 'deco', cond: 'c7_halt_gone', name: 'Halt' },
      { id: 'board7', x: 18, y: 8, sprite: 'ledger', kind: 'object', name: 'Count\'s board', cond: 'c>=7', talk: [['*', 'obj_count_board']] },
      { id: 'lect7', x: 5, y: 8, sprite: 'lectern', kind: 'lectern', cond: 'c>=7' },
      foe('tidy_b', 21, 20, 'tidy', 'tidy'),
      foe('blot_b', 5, 20, 'blot', 'blot2'),
      foe('tidyblot_b', 16, 21, 'tidy', 'tidyblot'),
    );
  });

  add('nursery', (m) => {
    m.enter = [['c=7,!c7_closer_done', 'c7_mind_end'], ...(m.enter ?? [])];
    for (const a of m.actors) if (a.id.startsWith('u')) a.cond = a.cond ? `${a.cond},c<7` : 'c<7';
    m.actors.push(
      { id: 'mind7', x: 6, y: 5, sprite: 'mind', kind: 'deco', cond: 'c=7,!c7_closer_done' },
      { id: 'closer7', x: 8, y: 4, sprite: 'closer', kind: 'deco', cond: 'c=7,!c7_closer_done' },
      { id: 'chair7', x: 6, y: 5, sprite: 'mind', kind: 'deco', look: 'halted', cond: 'c7_closer_done' },
    );
  });

  add('river', (m) => {
    m.altRegions = [['c>=7', 'river7']];
    m.enter = [['c=8,!seen_c8_open', 'c8_open'], ...(m.enter ?? [])];
    prependTalk(m, 'reel', 'c>=8', 'npc_reel_8');
    m.actors.push(foe('stopper_r', 14, 26, 'stopper', 'stopper', 'c>=8'), foe('proof_r', 3, 10, 'proof', 'proof', 'c>=8'), foe('foot_r', 13, 15, 'footnote', 'footstop', 'c>=8'));
  });

  add('standing', (m) => {
    m.rows = m.rows.map((r, y) => (y === 13 ? `${r.slice(0, 35)}g` : r));
    m.exits.push({ x: 35, y: 13, to: 'twice', tx: 1, ty: 12, cond: 'c>=8', block: 'c8_east_shut' });
    prependTalk(m, 'tally', 'c>=8', 'npc_tally_8');
    prependTalk(m, 'hop', 'c>=8', 'npc_hop_8');
  });

  add('twice', (m) => {
    m.exits.push({ x: 0, y: 12, to: 'standing', tx: 34, ty: 13, cond: 'c>=8' });
    m.enter = [['c=8,!seen_c8_twice', 'c8_twice'], ...(m.enter ?? [])];
    m.triggers.push({ x: 6, y: 11, w: 20, h: 1, scene: 'c8_corrector_seen', cond: 'c=8', once: 'c8_cs' });
    prependTalk(m, 'weigh1', 'c>=7', 'npc_weigh_8');
    for (const c of ['cust1', 'cust2', 'cust3']) prependTalk(m, c, 'c>=7', 'npc_customer_8');
    m.actors.push(
      npc('stet8', 28, 23, 'stet', 'npc_stet_8', { cond: 'c>=8', stet: 'stet', talk: [['!seen_c8_stet', 'c8_stet'], ['c>=9,!seen_npc_stet_9', 'npc_stet_9'], ['*', 'npc_stet_8']] }),
      npc('every8', 29, 21, 'every', 'c8_every', { cond: 'c=8,!every_joined' }),
      foe('proof_t', 20, 13, 'proof', 'proof2', 'c>=8'),
      foe('stopper_t', 8, 14, 'stopper', 'stopper', 'c>=8'),
      foe('foot_t', 14, 16, 'footnote', 'footproof', 'c>=8'),
    );
  });

  add('press', (m) => {
    m.enter = [['c=8,every_joined,c8_has_stet,!c8_corrector_done', 'c8_press'], ...(m.enter ?? [])];
  });

  add('ears', (m) => {
    m.enter = [['c=9,!seen_c9_open', 'c9_open'], ...(m.enter ?? [])];
    prependTalk(m, 'heed', 'c>=9', 'npc_heed_9');
    m.actors.push(foe('loose_e', 12, 20, 'loose', 'loose', 'c>=9'), foe('first_e', 26, 18, 'firstline', 'firstline', 'c>=9'), foe('caret_e', 8, 22, 'caret', 'caret', 'c>=9'), foe('dele_e', 30, 14, 'dele', 'dele', 'c>=9'));
  });

  add('relay', (m) => {
    m.enter = [['c=9,!seen_c9_relay_plan', 'c9_relay_plan'], ...(m.enter ?? [])];
    m.actors.push({
      id: 'relay9', x: 9, y: 2, sprite: 'relay16', kind: 'object', name: 'the Relay', cond: 'c>=9', light: 0.6,
      puzzle: { rote: '# the big ear. quiet seven years.\nlisten\nwait', need: wrote('halt'), flag: 'c9_relay_written', scene: 'c9_relay_done', stays: true },
    });
  });
}
