// Every foe and companion, with its rote written in the Cant. The # asides are the Scrivener's notes.

export interface FoeDef {
  key: string;
  name: string;
  hp: number;
  armor: number;
  xp: number;
  rote: string;
  sprite: string;
  /** Who the foe aims at when its rote says foe. */
  target?: 'random' | 'wait';
  /** Lines hidden until read or run once. */
  smudge?: number[];
  boss?: boolean;
  /** Drawn in the copied style: lime, doubled, on the shared beat. */
  copied?: boolean;
  tags?: string[];
  /** Scene that plays if the foe is emptied with erase instead of beaten. */
  freeScene?: string;
  /** The page it drops the first time it is beaten. Defaults to its rote. */
  page?: { name: string; src: string };
  /** Rote changes when health drops to the given fraction. */
  phases?: { at: number; rote: string; log: string }[];
  /** Nothing can be written into it. */
  noWrite?: boolean;
    /** Erase does nothing to it. */
  noErase?: boolean;
  /** Added to every harm it does. */
  power?: number;
}

export const FOES: Record<string, FoeDef> = {
  // Chapter 1
  straw: {
    key: 'straw', name: 'Straw', hp: 9, armor: 0, xp: 3, sprite: 'straw',
    rote: 'stand  # it stands',
    page: { name: 'straw', src: '# from straw\nstrike foe' },
  },
  nip: {
    key: 'nip', name: 'Nip', hp: 7, armor: 0, xp: 4, sprite: 'nip',
    rote: '# small. hungry. good at it.\nbite foe\nwait',
  },
  chaff: {
    key: 'chaff', name: 'Chaff', hp: 10, armor: 0, xp: 5, sprite: 'chaff',
    rote: '# a puff. it hides in itself.\nward me\nwait\nstrike foe\nwait',
  },
  spoke: {
    key: 'spoke', name: 'Spoke', hp: 13, armor: 1, xp: 7, sprite: 'spoke',
    rote: '# off the wheel. counts to three.\nstrike foe\nwait\nstrike foe\nwait\nstrike foe\nstrike foe\nwait',
  },
  copynip: {
    key: 'copynip', name: 'Nip', hp: 8, armor: 0, xp: 5, sprite: 'nip', copied: true,
    rote: '# again\nbite foe\nwait\nspread foe\nwait',
  },
  grind: {
    key: 'grind', name: 'Grind', hp: 46, armor: 1, xp: 30, sprite: 'grind', boss: true, copied: true, target: 'wait',
    rote: [
      '# miller. steady. likes flour.',
      'grind foe   # again',
      'wait',
      'grind foe   # again',
      'wait',
      'spread foe  # again',
      'grind foe   # again',
      'wait',
      'rest        # again',
      'wait',
    ].join('\n'),
    page: { name: 'grind', src: '# from grind. likes flour.\ngrind foe' },
  },

  // Chapter 2
  fisher: {
    key: 'fisher', name: 'Fisher', hp: 22, armor: 0, power: 2, xp: 8, sprite: 'fisher', copied: true,
    rote: '# again\nstrike foe\nwait\nspread foe\nstrike foe\nwait',
  },
  lull: {
    key: 'lull', name: 'Lull', hp: 16, armor: 0, power: 2, xp: 7, sprite: 'lull', target: 'wait',
    rote: '# soft. eats what glows.\ndrink foe\nwait',
  },
  tock: {
    key: 'tock', name: 'Tock', hp: 14, armor: 2, power: 2, xp: 7, sprite: 'tock',
    rote: '# a clock that got loose.\ntick\nwait\ntick\nwait\nburst foes',
  },
  grit: {
    key: 'grit', name: 'Grit', hp: 26, armor: 2, power: 2, xp: 10, sprite: 'grit',
    rote: '# sand. will not be moved.\nstrike foe\nwait\nward me\nwait',
  },
  hold: {
    key: 'hold', name: 'Hold', hp: 64, armor: 2, xp: 70, sprite: 'hold', boss: true, target: 'wait',
    rote: [
      '# the first gate. keeps all of it.',
      'if foe.acted > 2:',
      '  halt foe',
      'else:',
      '  press foe',
      'wait',
    ].join('\n'),
    page: { name: 'hold', src: '# from hold.\nif foe.acted > 2:\n  halt foe\nelse:\n  strike foe' },
  },

  // Chapter 3
  clerk: {
    key: 'clerk', name: 'Clerk', hp: 12, armor: 0, power: 3, xp: 5, sprite: 'clerk',
    rote: '# one of many. neat.\nstamp foe\nwait',
  },
  vatling: {
    key: 'vatling', name: 'Vatling', hp: 18, armor: 0, power: 1, xp: 7, sprite: 'vatling',
    rote: '# half made. kind.\nmend weakest(allies)\nwait',
  },
  split: {
    key: 'split', name: 'Split', hp: 26, armor: 0, power: 2, xp: 9, sprite: 'split',
    rote: '# the press got it twice.\nwhen hurt:\n  split\nstrike foe\nwait',
  },
  presshand: {
    key: 'presshand', name: 'Presshand', hp: 30, armor: 1, power: 3, xp: 11, sprite: 'presshand', copied: true,
    rote: '# again\nspread foe\nstrike foe\nwait\nstrike foe\nwait',
  },
  manycopy: {
    key: 'manycopy', name: 'Many', hp: 20, armor: 0, xp: 12, sprite: 'many', copied: true, tags: ['copy'],
    rote: '# a good mayor. fond of himself.\nstrike foe\nwait\nstrike foe\nwait',
    page: { name: 'many', src: '# from many.\nstrike foe\nwait\nstrike foe' },
  },
  many: {
    key: 'many', name: 'Many', hp: 38, armor: 0, power: 1, xp: 40, sprite: 'many', copied: true, boss: true, tags: ['original'],
    rote: '# a good mayor. fond of himself.\nstrike foe\nwait\nstrike foe\nwait\npress allies',
    page: { name: 'mayor', src: '# from many. the one who presses.\nstrike foe\nwait\nstrike foe\nwait\npress allies' },
  },

  // Chapter 4
  flinch: {
    key: 'flinch', name: 'Flinch', hp: 24, armor: 0, power: 3, xp: 10, sprite: 'flinch',
    rote: '# jumpy.\nwhen hurt:\n  strike by\nstrike foe\nwait',
  },
  ringer: {
    key: 'ringer', name: 'Ringer', hp: 22, armor: 0, power: 3, xp: 10, sprite: 'ringer',
    rote: '# a bell that heard too much.\nwhen foe casts:\n  copy who\nstrike foe\nwait',
  },
  dish: {
    key: 'dish', name: 'Dish', hp: 24, armor: 1, power: 3, xp: 11, sprite: 'dish',
    rote: '# listens for hurt.\nwhen ally hurt:\n  if who.hp < 9: mend who\nlisten\nwait',
  },
  static: {
    key: 'static', name: 'Static', hp: 32, armor: 0, power: 3, xp: 13, sprite: 'listener', copied: true,
    rote: '# again\nspread foe\nwait\nshout\nwait',
  },
  relay: {
    key: 'relay', name: 'the Relay', hp: 104, armor: 1, power: 2, xp: 130, sprite: 'relay', boss: true,
    rote: [
      '# the big ear. it was for the sky.',
      'when foe casts:',
      '  copy who',
      'when hurt 3 times:',
      '  shout',
      'listen',
      'wait',
      'strike foe',
      'wait',
    ].join('\n'),
    page: { name: 'relay', src: '# from the relay.\nshout' },
  },

  // Chapter 5
  drift: {
    key: 'drift', name: 'Drift', hp: 26, armor: 0, power: 4, xp: 11, sprite: 'drift',
    rote: '# loose.\nstrike random(foes)\nwait\nstrike random(foes)\nstrike random(foes)\nwait',
    smudge: [4, 5],
  },
  sentry: {
    key: 'sentry', name: 'Sentry', hp: 32, armor: 2, power: 2, xp: 15, sprite: 'sentry',
    rote: '# kept the rungs. still does.\nwhen foe casts:\n  mark who\nstrike foe\nwait\nstrike foe\nwait',
  },
  waitcopy: {
    key: 'waitcopy', name: 'Wait?', hp: 28, armor: 0, power: 4, xp: 13, sprite: 'wait', copied: true,
    rote: '# again\nwait\nwait\nstrike foe\nstrike foe\nstrike foe',
  },
  arm: {
    key: 'arm', name: 'the Arm', hp: 150, armor: 1, power: 2, xp: 170, sprite: 'arm', boss: true, copied: true, target: 'wait',
    rote: [
      '# the hand that writes.',
      'write foe',
      'wait',
      'strike foe',
      'strike foe',
      'strike foe',
      'wait',
      'ward me',
      'press random(foes)',
      'wait',
    ].join('\n'),
    smudge: [8, 9],
    page: { name: 'arm', src: '# from the arm.\nstrike foe\nstrike foe\nwait\nward me' },
  },


  // ---------------------------------------------------------------- Act 2: what the light writes

  // Chapter 7
  tidy: {
    key: 'tidy', name: 'Tidy', hp: 18, armor: 0, xp: 14, sprite: 'tidy', target: 'wait',
    rote: '# picks things up. puts them away.\nclose foe\nwait\nstrike foe\nwait',
  },
  blot: {
    key: 'blot', name: 'Blot', hp: 15, armor: 0, xp: 12, sprite: 'blot',
    rote: '# spilled. spreading.\nsoak foe\nstrike foe\nwait',
  },
  closer: {
    key: 'closer', name: 'the Closer', hp: 50, armor: 1, power: 0, xp: 60, sprite: 'closer', boss: true, target: 'wait',
    rote: '# two hands. one book.\nstrike foe\nwait\nclose foe\nstrike foe\nwait',
    phases: [{ at: 0.5, rote: '# the book is nearly shut.\nclose foe\nstrike foe\nstrike foe\nwait', log: 'The Closer turns to the last page.' }],
    page: { name: 'closer', src: '# from the closer.\nstrike foe\nstrike foe\nwait' },
  },

  // Chapter 8
  stopper: {
    key: 'stopper', name: 'Stopper', hp: 30, armor: 2, power: 1, xp: 22, sprite: 'stopper',
    rote: '# a cork, for rivers.\nward me\nwait\nstrike foe\nstrike foe\nwait',
  },
  footnote: {
    key: 'footnote', name: 'Footnote', hp: 20, armor: 0, xp: 18, sprite: 'footnote',
    rote: '# small writing, under the rest.\ninto weakest(allies): mend me\nwait\nstrike foe\nwait',
  },
  proof: {
    key: 'proof', name: 'Proof', hp: 26, armor: 0, power: 1, xp: 22, sprite: 'proof', target: 'wait',
    rote: '# reads for mistakes.\nread foe\ncorrect foe\nwait\nstrike foe\nwait',
  },
  corrector: {
    key: 'corrector', name: 'the Corrector', hp: 96, armor: 1, power: 1, xp: 140, sprite: 'corrector', boss: true, target: 'wait',
    rote: '# a strip. it crosses out.\ncorrect foe\nstrike foe\nwait\nward me\nstrike foe\nwait',
    phases: [{ at: 0.5, rote: '# it reads faster now.\ncorrect foe\ncorrect foe\nwait\nstrike foe\nstrike foe\nstrike foe\nwait', log: 'The Corrector reads faster.' }],
    page: { name: 'corrector', src: '# from the corrector.\nward me\nstrike foe\nwait' },
  },

  // Chapter 9
  loose: {
    key: 'loose', name: 'an Aside', hp: 30, armor: 0, power: 2, xp: 26, sprite: 'loose',
    rote: '# small. kind.\nmark foe\nstrike foe\nwait\nward me\nwait',
  },
  caret: {
    key: 'caret', name: 'Caret', hp: 24, armor: 0, power: 1, xp: 26, sprite: 'caret', target: 'wait',
    rote: '# means: something goes in here.\ninto foe: halt\nwait\nstrike foe\nstrike foe\nwait',
  },
  dele: {
    key: 'dele', name: 'Dele', hp: 34, armor: 1, power: 2, xp: 30, sprite: 'dele',
    rote: '# takes things out.\nwhen ally written: stet who\nstrike foe\nwait\nstrike foe\nstrike foe\nwait',
  },
  firstline: {
    key: 'firstline', name: 'a First Line', hp: 38, armor: 0, power: 2, xp: 30, sprite: 'firstline',
    rote: '# the start of something.\nmend me\nstrike foe\nstrike foe\nwait',
  },
  over: {
    key: 'over', name: 'Over', hp: 132, armor: 1, power: 2, xp: 220, sprite: 'over', boss: true,
    rote: '# a word, struck through.\ncorrect foe\nstrike foe\nstrike foe\nwait\nclose foe\nshout\nwait',
    phases: [{ at: 0.5, rote: '# struck through twice.\nclose foe\ncorrect foe\nwait\nshout\nshout\nwait', log: 'Over writes over itself.' }],
    page: { name: 'over', src: '# from over.\nshout\nwait\nshout' },
  },

  // Chapter 10
  filer: {
    key: 'filer', name: 'Filer', hp: 44, armor: 1, power: 3, xp: 36, sprite: 'filer', target: 'wait',
    rote: '# files things where they go.\nclose foe\nwait\nstrike foe\nstrike foe\nwait',
  },
  quillmite: {
    key: 'quillmite', name: 'Quillmite', hp: 36, armor: 0, power: 3, xp: 32, sprite: 'quillmite',
    rote: '# a speck off the pen.\nburst foe\nwait\nwait',
  },
  gloss: {
    key: 'gloss', name: 'Gloss', hp: 220, armor: 1, power: 2, xp: 0, sprite: 'glossboss', boss: true, target: 'wait', noErase: true,
    rote: '# a margin.\n# notes what is written.\nwhen foe casts:\n  stet me\nnote foe\nclose foe\nwait\nstrike foe\nstrike foe\nwait',
    phases: [
      { at: 0.6, rote: '# a margin. tired.\nclose foe\nclose foe\nwait\nshout\nwait', log: 'Gloss stops crossing out what is written into it.' },
      { at: 0.3, rote: '# the fifth primer.\nhalt foe\nclose foe\ncorrect foe\nwait\nshout\nshout\nwait', log: 'Gloss starts to write the Primer into the party.' },
    ],
  },

  // Optional: behind a wall in the Millrace, once Wait can erase.
  erratum: {
    key: 'erratum', name: 'the Erratum', hp: 96, armor: 1, power: 2, xp: 45, sprite: 'erratum', boss: true, noErase: true,
    rote: '# a correction.\nstrike foe\nstrike foe\nwait\nward me\nwait',
    phases: [
      { at: 0.75, rote: '# a correction to the correction.\nsear foe\nwait\nsear foe\nmend me\nwait', log: 'The Erratum crosses out its rote and writes another under it.' },
      { at: 0.5, rote: '# corrected again.\nhush foe\nstrike foe\nstrike foe\nwait', log: 'The Erratum crosses that out too.' },
      { at: 0.25, rote: '# this one is right.\nmark foe\nstrike foe\nstrike foe\nstrike foe\nwait\nmend me\nmend me\nwait', log: 'The Erratum writes very small, in the last space left.' },
    ],
    page: { name: 'erratum', src: '# from the erratum. it was right.\nstrike foe\nstrike foe\nwait\nward me' },
  },

  // Chapter 6
  loopling: {
    key: 'loopling', name: 'Loop', hp: 32, armor: 0, power: 4, xp: 14, sprite: 'loop', copied: true,
    rote: '# again\nstrike foe\nstrike foe\nwait\nagain',
    page: { name: 'loop', src: '# from a loop. it does not stop.\nstrike foe\nstrike foe\nwait\nagain' },
  },
  csweep: {
    key: 'csweep', name: 'Sweep', hp: 40, armor: 0, power: 4, xp: 15, sprite: 'sweep', copied: true, freeScene: 'c6_free_sweep',
    rote: '# again\npress foe    # again\nspread foe  # again\nwait',
  },
  ccount: {
    key: 'ccount', name: 'Count', hp: 40, armor: 1, power: 4, xp: 15, sprite: 'count', copied: true, freeScene: 'c6_free_count',
    rote: '# again\npress foe    # again\nstrike foe  # again\nwait',
  },
  cstack: {
    key: 'cstack', name: 'Stack', hp: 42, armor: 0, power: 4, xp: 15, sprite: 'stack', copied: true, freeScene: 'c6_free_stack',
    rote: '# again\nward me     # again\npress foe   # again\nwait',
  },
  cpour: {
    key: 'cpour', name: 'Pour', hp: 40, armor: 0, power: 4, xp: 15, sprite: 'pour', copied: true, freeScene: 'c6_free_pour',
    rote: '# again\nsoak foe    # again\npress foe   # again\nwait',
  },
  cmind: {
    key: 'cmind', name: 'Mind', hp: 44, armor: 1, power: 4, xp: 25, sprite: 'mind', copied: true, freeScene: 'c6_free_mind',
    rote: '# again\npress foe    # again\nspread foe  # again\nwait\npress foe   # again\nwait',
  },
  again: {
    key: 'again', name: 'Again', hp: 240, armor: 0, xp: 0, sprite: 'again', boss: true, copied: true, target: 'wait', noErase: true,
    rote: '# again\nplay random(me.pages)\nwait',
    phases: [{
      at: 0.5,
      log: 'Again\'s rote changes. Read it.',
      rote: '# again\nlet s = foe.last\ncast s\nwait\nagain',
    }],
  },
};

export interface AllyDef {
  key: string;
  name: string;
  hp: number;
  hpPerLevel: number;
  armor: number;
  rote: string;
  sprite: string;
  /** The word this companion lends Wait. */
  lends?: string;
}

export const ALLIES: Record<string, AllyDef> = {
  halt: {
    key: 'halt', name: 'Halt', hp: 30, hpPerLevel: 4, armor: 1, sprite: 'halt', lends: 'halt',
    rote: '# a gate. stops what leaves.\nguard weakest(allies)\nwait\nbash foe\nwait',
  },
  each: {
    key: 'each', name: 'Each', hp: 18, hpPerLevel: 3, armor: 0, sprite: 'each', lends: 'each',
    rote: '# seven. they count differently.\neach f in foes: peck f\nwait',
  },
  room: {
    key: 'room', name: 'Room', hp: 16, hpPerLevel: 3, armor: 0, sprite: 'room',
    rote: '# one line and then room.\ninto weakest(allies): ward me\nwait',
  },
  every: {
    key: 'every', name: 'Every', hp: 26, hpPerLevel: 4, armor: 0, sprite: 'every', lends: 'each',
    rote: '# one. was seven.\neach f in foes: peck f\nstrike foe\nwait',
  },
  when: {
    key: 'when', name: 'When', hp: 22, hpPerLevel: 3, armor: 0, sprite: 'when', lends: 'when',
    rote: '# when wait comes, go with wait.\nwhen ally hurt:\n  mend who\nstrike foe\nwait',
  },
};

export interface Encounter {
  foes: string[];
  boss?: boolean;
  /** Scene to play when the fight is won. */
  after?: string;
  noFlee?: boolean;
}

export const ENCOUNTERS: Record<string, Encounter> = {
  straw: { foes: ['straw'], after: 'c1_straw_after', noFlee: true },
  nip: { foes: ['nip'] },
  nip2: { foes: ['nip', 'nip'] },
  chaff: { foes: ['chaff'] },
  chaffnip: { foes: ['chaff', 'nip'] },
  spoke: { foes: ['spoke'] },
  spokenip: { foes: ['spoke', 'copynip'] },
  copynip2: { foes: ['copynip', 'copynip'] },
  grind: { foes: ['grind'], boss: true, after: 'c1_grind_after', noFlee: true },

  fisher: { foes: ['fisher'] },
  fisher2: { foes: ['fisher', 'fisher'] },
  lull: { foes: ['lull', 'lull'] },
  tock: { foes: ['tock', 'lull'] },
  tock2: { foes: ['tock', 'tock'] },
  grit: { foes: ['grit'] },
  gritlull: { foes: ['grit', 'lull'] },
  hold: { foes: ['hold'], boss: true, after: 'c2_hold_after', noFlee: true },

  clerks: { foes: ['clerk', 'clerk', 'clerk'] },
  vat: { foes: ['vatling', 'clerk', 'clerk'] },
  split: { foes: ['split'] },
  presshand: { foes: ['presshand', 'vatling'] },
  press2: { foes: ['presshand', 'split'] },
  many: { foes: ['manycopy', 'manycopy', 'many', 'manycopy', 'manycopy'], boss: true, after: 'c3_after', noFlee: true },

  flinch: { foes: ['flinch', 'flinch'] },
  ringer: { foes: ['ringer', 'flinch'] },
  dish: { foes: ['dish', 'flinch'] },
  dish2: { foes: ['dish', 'ringer', 'flinch'] },
  static: { foes: ['static', 'static'] },
  relay: { foes: ['relay'], boss: true, after: 'c4_after', noFlee: true },

  drift: { foes: ['drift', 'drift'] },
  sentry: { foes: ['sentry', 'drift'] },
  waitcopy: { foes: ['waitcopy', 'waitcopy'] },
  sentry2: { foes: ['sentry', 'waitcopy'] },
  arm: { foes: ['arm'], boss: true, after: 'c5_notebook', noFlee: true },

  loop: { foes: ['loopling', 'loopling'] },
  csweep: { foes: ['csweep'], noFlee: true },
  ccount: { foes: ['ccount'], noFlee: true },
  cstack: { foes: ['cstack'], noFlee: true },
  cpour: { foes: ['cpour'], noFlee: true },
  cmind: { foes: ['cmind', 'loopling'], noFlee: true },
  again: { foes: ['again'], boss: true, after: 'c6_end', noFlee: true },
  erratum: { foes: ['erratum'], boss: true, noFlee: true },
  tidy: { foes: ['tidy'] },
  tidyblot: { foes: ['tidy', 'blot'] },
  blot2: { foes: ['blot', 'blot'] },
  closer: { foes: ['closer'], boss: true, after: 'c7_closer_after', noFlee: true },
  stopper: { foes: ['stopper', 'blot'] },
  proof: { foes: ['proof', 'tidy'] },
  proof2: { foes: ['proof', 'stopper'] },
  footstop: { foes: ['footnote', 'stopper'] },
  footproof: { foes: ['proof', 'footnote'] },
  corrector: { foes: ['corrector'], boss: true, after: 'c8_corrector_after', noFlee: true },
  loose: { foes: ['loose', 'loose'] },
  firstline: { foes: ['firstline', 'loose'] },
  caret: { foes: ['caret', 'loose'] },
  caret2: { foes: ['firstline', 'caret'] },
  dele: { foes: ['loose', 'dele', 'loose'] },
  over: { foes: ['over'], boss: true, after: 'c9_over_after', noFlee: true },
  filer: { foes: ['filer', 'quillmite'] },
  filer2: { foes: ['filer', 'filer'] },
  delefiler: { foes: ['dele', 'filer'] },
  gloss: { foes: ['gloss'], boss: true, after: 'c10_gloss_after', noFlee: true },
};
