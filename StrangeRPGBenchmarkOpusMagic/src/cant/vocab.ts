// Every word of the Cant: verbs, keywords, names, functions, properties, and events, with their manual text.

export type VerbKind = 'harm' | 'help';

export interface VerbDef {
  name: string;
  ink: number;
  kind: VerbKind;
  /** Armor reduces this verb's harm. */
  physical?: boolean;
  /** Only enemies and companions can say it. */
  only?: string;
  /** Pitch of the note the verb plays, in semitones above A3. */
  pitch: number;
  color: number;
  doc: string;
}

// Colors are 0xRRGGBB.
export const VERBS: Record<string, VerbDef> = {
  strike: { name: 'strike', ink: 1, kind: 'harm', physical: true, pitch: 0, color: 0xe6d8bc, doc: 'strike X: 3 harm to X. Armor takes some. 1 ink.' },
  mend: { name: 'mend', ink: 2, kind: 'help', pitch: 7, color: 0x8fe08a, doc: 'mend X: heals X by 4. 2 ink.' },
  ward: { name: 'ward', ink: 2, kind: 'help', pitch: 4, color: 0x9ab8ff, doc: 'ward X: the next 4 harm to X is taken by the ward. It lasts until X\'s next turn. 2 ink.' },
  soak: { name: 'soak', ink: 1, kind: 'harm', pitch: 2, color: 0x4fb8e0, doc: 'soak X: X is wet for 2 rounds. Puts out burn. 1 ink.' },
  jolt: { name: 'jolt', ink: 2, kind: 'harm', pitch: 11, color: 0xf2f25a, doc: 'jolt X: 2 harm through armor. 6 if X is wet, and X dries. 2 ink.' },
  sear: { name: 'sear', ink: 2, kind: 'harm', pitch: 9, color: 0xff7a3a, doc: 'sear X: 1 harm and 3 burn. Burn harms at the end of each round and drops by 1. Does nothing to wet things but dry them. 2 ink.' },
  mark: { name: 'mark', ink: 1, kind: 'harm', pitch: 5, color: 0xff5a8a, doc: 'mark X: the next harm X takes is 3 higher. 1 ink.' },
  read: { name: 'read', ink: 1, kind: 'harm', pitch: 12, color: 0xd8d0ff, doc: 'read X: shows every smudged line of X\'s rote. 1 ink.' },
  drain: { name: 'drain', ink: 3, kind: 'harm', physical: true, pitch: 3, color: 0xb05ad8, doc: 'drain X: 2 harm, and you heal by the harm done. Armor takes some. 3 ink.' },
  rust: { name: 'rust', ink: 2, kind: 'harm', pitch: 1, color: 0xc0703a, doc: 'rust X: X\'s armor drops by 1 for the rest of the fight. 2 ink.' },
  hush: { name: 'hush', ink: 3, kind: 'harm', pitch: 14, color: 0x7a7a9a, doc: 'hush X: the next verb X says does nothing. 3 ink.' },
  step: { name: 'step', ink: 0, kind: 'help', only: 'things that move', pitch: -1, color: 0xc2a05a, doc: 'step: moves one tile the way it faces.' },
  turn: { name: 'turn', ink: 0, kind: 'help', only: 'things that move', pitch: 3, color: 0xc2a05a, doc: 'turn: faces to the right of where it faced. turn left: to the left.' },
  roll: { name: 'roll', ink: 0, kind: 'help', only: 'things that move', pitch: -4, color: 0xc2a05a, doc: 'roll: rolls the way it faces until something stops it.' },
  grow: { name: 'grow', ink: 0, kind: 'help', only: 'things that grow', pitch: 9, color: 0x8fe08a, doc: 'grow: grows across ink or sky the way it faces.' },
  stop: { name: 'stop', ink: 0, kind: 'help', only: 'things that move', pitch: -6, color: 0xc2a05a, doc: 'stop: stops where it is and runs nothing more.' },
  fall: { name: 'fall', ink: 0, kind: 'help', only: 'things that move', pitch: -8, color: 0xc2a05a, doc: 'fall: falls one tile.' },
  close: { name: 'close', ink: 0, kind: 'harm', only: 'what the light writes', pitch: -14, color: 0xd8d0ff, doc: 'close X: writes halt into the top of one of X\'s pages. The next cast of it stops there.' },
  correct: { name: 'correct', ink: 0, kind: 'harm', only: 'what the light writes', pitch: -13, color: 0xd8d0ff, doc: 'correct X: rewrites one of X\'s pages so its next cast harms X.' },
  stet: { name: 'stet', ink: 2, kind: 'help', pitch: 16, color: 0xe6dfd0, doc: 'stet X: crosses out every line someone else wrote into X. On you, it clears what was written into your pages. 2 ink. (Stet\'s word.)' },
  erase: { name: 'erase', ink: 5, kind: 'harm', pitch: -5, color: 0xff3a3a, doc: 'erase X: takes out the next line X would run, for the rest of the fight. A rote with nothing left in it stops. 5 ink.' },
  // Foreign verbs, learned from enemy pages.
  bite: { name: 'bite', ink: 1, kind: 'harm', physical: true, pitch: -2, color: 0xe08a6a, doc: 'bite X: 2 harm, or 4 if X is at half health or less. Armor takes some. 1 ink. (From a Nip.)' },
  grind: { name: 'grind', ink: 2, kind: 'harm', physical: true, pitch: -7, color: 0xc2a07a, doc: 'grind X: 2 harm, plus 1 for every grind you said earlier this fight, up to 8. Armor takes some. 2 ink. (From Grind.)' },
  drink: { name: 'drink', ink: 1, kind: 'harm', pitch: -9, color: 0x5a5ac8, doc: 'drink X: 1 harm through armor, and you gain 2 ink. 1 ink. (From a Lull.)' },
  burst: { name: 'burst', ink: 4, kind: 'harm', pitch: 16, color: 0xffb03a, doc: 'burst X: 6 harm through armor. You take 2. 4 ink. (From a Tock.)' },
  stamp: { name: 'stamp', ink: 1, kind: 'harm', physical: true, pitch: 6, color: 0xe07aa0, doc: 'stamp X: 1 harm, plus 1 for every stamp already on X. Armor takes some. 1 ink. (From a Clerk.)' },
  listen: { name: 'listen', ink: 0, kind: 'help', pitch: 19, color: 0xa99ad8, doc: 'listen: you gain 2 ink, then the spell waits. 0 ink. (From a Dish.)' },
  shout: { name: 'shout', ink: 4, kind: 'harm', pitch: 17, color: 0xc8ff2e, doc: 'shout: 2 harm through armor to every foe. 4 ink. (From the Relay.)' },
  // Enemy and companion verbs.
  rest: { name: 'rest', ink: 0, kind: 'help', only: 'Grind', pitch: -12, color: 0x8a7a6a, doc: 'rest: does nothing, and grinding starts over.' },
  stand: { name: 'stand', ink: 0, kind: 'help', only: 'Straw', pitch: -12, color: 0xc2a05a, doc: 'stand: stands.' },
  spread: { name: 'spread', ink: 0, kind: 'harm', only: 'Again', pitch: 24, color: 0xc8ff2e, doc: 'spread X: X is copied. On its next turn it does its last thing again.' },
  write: { name: 'write', ink: 0, kind: 'harm', only: 'the Arm', pitch: 24, color: 0xc8ff2e, doc: 'write X: X is copied, and takes 2 harm.' },
  press: { name: 'press', ink: 0, kind: 'harm', physical: true, only: 'Hold, Many, and the copied', pitch: -10, color: 0x6f8cff, doc: 'press X: 5 harm. Armor takes some. Many presses a fallen copy back up instead.' },
  split: { name: 'split', ink: 0, kind: 'help', only: 'Splits', pitch: 8, color: 0x9fd88a, doc: 'split: becomes two, each with half the health.' },
  guard: { name: 'guard', ink: 0, kind: 'help', only: 'Halt', pitch: -3, color: 0x9a9aa8, doc: 'guard X: harm meant for X goes to the guard instead, until the guard\'s next turn.' },
  bash: { name: 'bash', ink: 0, kind: 'harm', physical: true, only: 'Halt', pitch: -8, color: 0x9a9aa8, doc: 'bash X: 4 harm. Armor takes some.' },
  peck: { name: 'peck', ink: 0, kind: 'harm', only: 'Each', pitch: 13, color: 0xe6d8bc, doc: 'peck X: 1 harm through armor.' },
  note: { name: 'note', ink: 0, kind: 'harm', only: 'Gloss', pitch: 10, color: 0xd8d0ff, doc: 'note X: marks X and shows its smudged lines.' },
  play: { name: 'play', ink: 0, kind: 'harm', only: 'Again', pitch: 24, color: 0xc8ff2e, doc: 'play X: runs one of your pages, as if it were its own.' },
  tick: { name: 'tick', ink: 0, kind: 'help', only: 'Tocks', pitch: 15, color: 0xffb03a, doc: 'tick: counts.' },
  copy: { name: 'copy', ink: 0, kind: 'harm', only: 'Ringers', pitch: 21, color: 0xc8ff2e, doc: 'copy X: says X\'s last verb back at X.' },
};

export interface WordDoc { word: string; kind: 'keyword' | 'name' | 'function' | 'property' | 'event'; doc: string }

export const KEYWORDS: Record<string, string> = {
  wait: 'wait: the spell stops here until your next turn, then goes on from the next line.',
  say: 'say X: writes X in the log. Costs nothing. Several things can be said at once: say "hp", foe.hp',
  repeat: 'repeat N: runs the lines under it N times, up to 12. They are pushed in two spaces.',
  if: 'if X: runs the lines under it only when X is true.',
  else: 'else: under an if, at the same depth. Runs when the if did not.',
  let: 'let n = X: gives the name n to X. Use n after.',
  each: 'each f in L: runs the lines under it once for every one in the list L, with f standing for it. (Each\'s word.)',
  in: 'in: part of each.',
  when: 'when EVENT: does nothing now. When the event happens, the lines under it run. Once a round at most. (When\'s word.)',
  halt: 'halt: ends this spell now. halt X: ends X\'s turn. Alone it is free. With a name it costs 3 ink. (Halt\'s word.)',
  cast: 'cast NAME: runs another page of your rote, by its name.',
  into: 'into X: LINE writes the line into the top of X\'s rote. X runs it first thing on its next turn, as its own, with its own me and foe. Costs the line\'s ink plus 3. People must say yes first.',
  again: 'again',
  and: 'X and Y: true when both are.',
  or: 'X or Y: true when either is.',
  not: 'not X: true when X is not.',
  is: 'X is Y: the same as X == Y. X is not Y: the same as X != Y.',
  yes: 'yes: true.',
  no: 'no: false.',
  times: 'when hurt 3 times: runs every third time.',
};

export const NAMES: Record<string, string> = {
  me: 'me: the one saying the spell.',
  foe: 'foe: the one you pointed at when you cast.',
  foes: 'foes: a list of every foe still up.',
  allies: 'allies: a list of you and yours, still up.',
  round: 'round: which round of the fight it is, starting at 1.',
  who: 'who: inside a when, the one it happened to.',
  by: 'by: inside a when, the one who did it.',
};

export const FUNCTIONS: Record<string, string> = {
  count: 'count(L): how many are in the list L.',
  first: 'first(L): the first in the list L.',
  last: 'last(L): the last in the list L.',
  weakest: 'weakest(L): the one in L with the least health left.',
  strongest: 'strongest(L): the one in L with the most health left.',
  random: 'random(L): any one in L.',
  min: 'min(a, b): the smaller number.',
  max: 'max(a, b): the larger number.',
};

export const PROPS: Record<string, string> = {
  hp: '.hp: health left.',
  max: '.max: the most health it can have.',
  ward: '.ward: ward on it.',
  wet: '.wet: rounds of wet left.',
  burn: '.burn: burn on it.',
  armor: '.armor: how much of each strike it shrugs off.',
  next: '.next: the next verb it will say, as a word in quotes.',
  acted: '.acted: how many verbs it has said this round.',
  ink: '.ink: ink it has. Only you have ink.',
  name: '.name: its name.',
  up: '.up: yes while it is still up.',
  copied: '.copied: yes if it has been copied.',
  last: '.last: the name of the last page it cast.',
  pages: '.pages: the names of its pages.',
  written: '.written: how many lines others wrote into it that have not run yet.',
};

export const EVENTS: Record<string, string> = {
  'hurt': 'when hurt: you take harm.',
  'ally hurt': 'when ally hurt: you or one of yours takes harm.',
  'written': 'when written: someone writes a line into you. who is you, by is the writer. The line has not run yet.',
  'ally written': 'when ally written: someone writes a line into you or one of yours.',
  'foe acts': 'when foe acts: a foe is about to take its turn.',
  'foe casts': 'when foe casts: a foe casts a spell.',
  'foe falls': 'when foe falls: a foe goes down.',
  'round ends': 'when round ends: the round is over.',
};

export function docFor(word: string): string | null {
  if (VERBS[word]) return VERBS[word].doc;
  if (KEYWORDS[word]) return KEYWORDS[word];
  if (NAMES[word]) return NAMES[word];
  if (FUNCTIONS[word]) return FUNCTIONS[word];
  if (PROPS[word]) return PROPS[word];
  return null;
}

/** Every word the parser recognizes, for autocomplete and spelling suggestions. */
export function allWords(): string[] {
  return [
    ...Object.keys(VERBS), ...Object.keys(KEYWORDS), ...Object.keys(NAMES),
    ...Object.keys(FUNCTIONS), ...Object.keys(PROPS), 'hurt', 'ally', 'acts', 'casts', 'falls', 'ends', 'written',
  ];
}

export function editDistance(a: string, b: string): number {
  const d: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

export function suggest(word: string, pool: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const w of pool) {
    const dist = editDistance(word, w);
    if (dist < bestD) { best = w; bestD = dist; }
  }
  return best !== null && bestD <= Math.max(1, Math.ceil(word.length / 3)) ? best : null;
}
