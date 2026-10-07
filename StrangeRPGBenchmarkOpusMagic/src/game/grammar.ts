// The Grammar: the skill tree. Marks buy new words and more room in the rote.

export type Stat = 'lines' | 'pages' | 'ink' | 'regen' | 'hands' | 'ticks' | 'nib';

export interface GNode {
  id: string;
  label: string;
  branch: 'Words' | 'Forms' | 'Room' | 'Margin';
  cost: number;
  chapter: number;
  parent?: string[];
  words?: string[];
  stat?: Partial<Record<Stat, number>>;
  doc: string;
}

export const GRAMMAR: GNode[] = [
  { id: 'sear', label: 'sear', branch: 'Words', cost: 1, chapter: 1, words: ['sear'], doc: 'sear X: 1 harm and 3 burn. Burn ignores armor.' },
  { id: 'read', label: 'read', branch: 'Words', cost: 1, chapter: 2, words: ['read'], doc: 'read X: shows every smudged line of a rote.' },
  { id: 'mark', label: 'mark', branch: 'Words', cost: 1, chapter: 2, words: ['mark'], doc: 'mark X: the next harm X takes is 3 higher.' },
  { id: 'drain', label: 'drain', branch: 'Words', cost: 2, chapter: 3, parent: ['sear'], words: ['drain'], doc: 'drain X: 2 harm, and you heal by the harm done.' },
  { id: 'rust', label: 'rust', branch: 'Words', cost: 2, chapter: 3, parent: ['mark'], words: ['rust'], doc: 'rust X: armor down by 1 for the fight.' },
  { id: 'hush', label: 'hush', branch: 'Words', cost: 2, chapter: 4, parent: ['read'], words: ['hush'], doc: 'hush X: the next verb X says does nothing.' },

  { id: 'weakest', label: 'weakest(L)', branch: 'Forms', cost: 1, chapter: 2, words: ['weakest', 'strongest'], doc: 'weakest(L) and strongest(L): the one in a list with the least or most health.' },
  { id: 'random', label: 'random(L)', branch: 'Forms', cost: 1, chapter: 3, parent: ['weakest'], words: ['random'], doc: 'random(L): any one in a list.' },
  { id: 'minmax', label: 'min, max', branch: 'Forms', cost: 1, chapter: 3, parent: ['weakest'], words: ['min', 'max'], doc: 'min(a, b) and max(a, b): the smaller or larger number.' },
  { id: 'cast', label: 'cast NAME', branch: 'Forms', cost: 2, chapter: 4, parent: ['minmax'], words: ['cast'], doc: 'cast NAME: runs another of your pages from inside this one.' },

  { id: 'lines1', label: 'lines +1', branch: 'Room', cost: 1, chapter: 1, stat: { lines: 1 }, doc: 'Every page holds one more line.' },
  { id: 'pages1', label: 'pages +1', branch: 'Room', cost: 1, chapter: 1, stat: { pages: 1 }, doc: 'One more page in your rote.' },
  { id: 'ink1', label: 'ink +2', branch: 'Room', cost: 1, chapter: 1, stat: { ink: 2 }, doc: 'You can hold 2 more ink.' },
  { id: 'lines2', label: 'lines +1', branch: 'Room', cost: 1, chapter: 2, parent: ['lines1'], stat: { lines: 1 }, doc: 'Every page holds one more line.' },
  { id: 'ink2', label: 'ink +2', branch: 'Room', cost: 1, chapter: 2, parent: ['ink1'], stat: { ink: 2 }, doc: 'You can hold 2 more ink.' },
  { id: 'regen1', label: 'regen +1', branch: 'Room', cost: 2, chapter: 2, parent: ['ink1'], stat: { regen: 1 }, doc: 'You get 1 more ink back each turn.' },
  { id: 'lines3', label: 'lines +1', branch: 'Room', cost: 2, chapter: 3, parent: ['lines2'], stat: { lines: 1 }, doc: 'Every page holds one more line.' },
  { id: 'pages2', label: 'pages +1', branch: 'Room', cost: 2, chapter: 3, parent: ['pages1'], stat: { pages: 1 }, doc: 'One more page in your rote.' },
  { id: 'ticks1', label: 'steps +20', branch: 'Room', cost: 1, chapter: 3, stat: { ticks: 20 }, doc: 'A spell can take 20 more steps in one turn before it tangles.' },
  { id: 'ink3', label: 'ink +3', branch: 'Room', cost: 2, chapter: 4, parent: ['ink2'], stat: { ink: 3 }, doc: 'You can hold 3 more ink.' },
  { id: 'regen2', label: 'regen +1', branch: 'Room', cost: 3, chapter: 4, parent: ['regen1'], stat: { regen: 1 }, doc: 'You get 1 more ink back each turn.' },
  { id: 'lines4', label: 'lines +2', branch: 'Room', cost: 2, chapter: 5, parent: ['lines3'], stat: { lines: 2 }, doc: 'Every page holds two more lines.' },
  { id: 'pages3', label: 'pages +1', branch: 'Room', cost: 2, chapter: 5, parent: ['pages2'], stat: { pages: 1 }, doc: 'One more page in your rote.' },
  { id: 'ink4', label: 'ink +3', branch: 'Room', cost: 2, chapter: 5, parent: ['ink3'], stat: { ink: 3 }, doc: 'You can hold 3 more ink.' },
  { id: 'nib1', label: 'nib +1', branch: 'Margin', cost: 2, chapter: 7, stat: { nib: 1 }, doc: 'One more line can be written into others at the same time.' },
  { id: 'ink5', label: 'ink +3', branch: 'Margin', cost: 2, chapter: 8, parent: ['nib1'], stat: { ink: 3 }, doc: 'You can hold 3 more ink. Writing in is thirsty.' },
  { id: 'nib2', label: 'nib +1', branch: 'Margin', cost: 3, chapter: 9, parent: ['nib1'], stat: { nib: 1 }, doc: 'One more line can be written into others at the same time.' },
  { id: 'regen3', label: 'regen +1', branch: 'Margin', cost: 3, chapter: 9, parent: ['ink5'], stat: { regen: 1 }, doc: 'You get 1 more ink back each turn.' },
  { id: 'hand3', label: 'third hand', branch: 'Room', cost: 3, chapter: 5, parent: ['regen1'], stat: { hands: 1 }, doc: 'One more spell can run at once.' },
];

export const GNODE: Record<string, GNode> = Object.fromEntries(GRAMMAR.map((n) => [n.id, n]));
