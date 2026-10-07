// The things in the ink. Each one runs a tiny rote on its own beat, and the rote is the whole tell.

export type Where = 'river' | 'millrace' | 'standing' | 'twice' | 'ears' | 'tether';

export const WHERES: Where[] = ['river', 'millrace', 'standing', 'twice', 'ears', 'tether'];

export const WHERE_NAMES: Record<Where, string> = {
  river: 'the river',
  millrace: 'the millrace',
  standing: 'Standing',
  twice: 'Twice',
  ears: 'the Ears',
  tether: 'the Tether',
};

export interface Catch {
  id: string;
  /** Lowercase, with its article. */
  name: string;
  where: Where;
  /** The first chapter it bites in, 1 to 6. */
  from: number;
  /** Weight in pickCatch. Higher bites more often. */
  rarity: number;
  /** Frames per rote line. 60 frames are one second. */
  tempo: number;
  /** Lines of the Cant. Verbs: pull, rest, dive, still, wait. Also `repeat N:` blocks and `again` at the bottom. */
  rote: string[];
  /** Indexes into rote that show as ~~~~ until the kind has been landed once. */
  smudge: number[];
  /** Shown in the catch log after it is landed. */
  note: string;
  /** Reward for landing it. */
  blanks: number;
  /** A lime variant. It loops with no pause and keeps a faster tempo. */
  copied?: boolean;
  /** Only bites in the Tether, and only when the chapter allows. */
  secret?: boolean;
  /** Sprite key. reeling.ts registers every key used here. */
  sprite: string;
}

export const CATCHES: Catch[] = [
  // The river
  {
    id: 'page_eel', name: 'a page eel', where: 'river', from: 1, rarity: 12, tempo: 44,
    rote: ['# thin. reads as it goes.', 'rest', 'rest', 'pull', 'rest'],
    smudge: [3],
    note: "A line of someone's rote is written on every scale. Put together they do not run.",
    blanks: 2, sprite: 'rl_eel',
  },
  {
    id: 'inkhorn', name: 'an inkhorn', where: 'river', from: 1, rarity: 9, tempo: 42,
    rote: ['# holds ink. is held.', 'repeat 2:', '  rest', '  pull', 'wait'],
    smudge: [3],
    note: 'A horn sealed with a cork of dried page. The ink inside does not move and does not glow.',
    blanks: 3, sprite: 'rl_horn',
  },
  {
    id: 'page_eel_copy', name: 'a copied page eel', where: 'river', from: 2, rarity: 6, tempo: 30, copied: true,
    rote: ['# again', 'rest', 'pull', 'rest', 'still', 'again'],
    smudge: [3],
    note: 'Every scale carries the same line. The line is again.',
    blanks: 5, sprite: 'rl_eel',
  },
  {
    id: 'lost_aside', name: 'a lost aside', where: 'river', from: 2, rarity: 0.6, tempo: 52,
    rote: ['# kind. slow. will not be asked.', 'still', 'rest', 'still', 'wait'],
    smudge: [1, 3],
    note: 'A comment line with no rote under it. It describes a creature the river does not have.',
    blanks: 12, sprite: 'rl_aside',
  },

  // The millrace
  {
    id: 'husk', name: 'a husk', where: 'millrace', from: 1, rarity: 12, tempo: 40,
    rote: ['# empty. light. wants the wheel.', 'pull', 'rest', 'rest', 'wait'],
    smudge: [1],
    note: 'A grain husk. The grain is gone and the husk still runs its rote.',
    blanks: 2, sprite: 'rl_husk',
  },
  {
    id: 'sluice_crab', name: 'a sluice crab', where: 'millrace', from: 1, rarity: 8, tempo: 34,
    rote: ['# sideways. shut. opens last.', 'rest', 'dive', 'rest', 'wait'],
    smudge: [2],
    note: 'A crab that holds the sluice shut. It lets go on the third strike.',
    blanks: 4, sprite: 'rl_crab',
  },
  {
    id: 'husk_copy', name: 'a copied husk', where: 'millrace', from: 2, rarity: 6, tempo: 28, copied: true,
    rote: ['# again', 'rest', 'pull', 'dive', 'rest', 'again'],
    smudge: [3],
    note: 'A husk with two of every line. Every aside says again.',
    blanks: 5, sprite: 'rl_husk',
  },
  {
    id: 'overwritten_page', name: 'an overwritten page', where: 'millrace', from: 2, rarity: 0.6, tempo: 40,
    rote: ['# miller. steady. likes flour.', 'rest', 'pull', 'rest', 'still', '# again'],
    smudge: [4],
    note: "A page from Grind's rote. The first aside is his and the second says again.",
    blanks: 10, sprite: 'rl_page',
  },

  // Standing
  {
    id: 'barred_line', name: 'a barred line', where: 'standing', from: 2, rarity: 10, tempo: 42,
    rote: ['# halted. do not move it.', 'rest', 'still', 'rest', 'still'],
    smudge: [2],
    note: 'A line of a rote, halted in the middle of a word. A red bar is across it.',
    blanks: 4, sprite: 'rl_bar',
  },
  {
    id: 'loose_second', name: 'a loose second', where: 'standing', from: 2, rarity: 8, tempo: 60,
    rote: ['# one second. then another.', 'wait', 'dive', 'rest', 'pull', 'rest'],
    smudge: [2],
    note: 'A single second, loose in the ink. Tally has not counted it.',
    blanks: 5, sprite: 'rl_second',
  },
  {
    id: 'second_hop', name: 'a second hop', where: 'standing', from: 2, rarity: 0.6, tempo: 36,
    rote: ['# hop, hop, land.', 'repeat 2:', '  pull', '  rest', 'still'],
    smudge: [4],
    note: 'A hop with no landing. The red bar is across the second one.',
    blanks: 12, sprite: 'rl_hop',
  },

  // Twice
  {
    id: 'pressmark', name: 'a pressmark', where: 'twice', from: 3, rarity: 12, tempo: 34,
    rote: ['# flat. presses down.', 'wait', 'dive', 'rest', 'rest', 'pull'],
    smudge: [2],
    note: 'A stamp with no paper under it. The same mark is on every wall in Twice.',
    blanks: 5, sprite: 'rl_stamp',
  },
  {
    id: 'pressmark_copy', name: 'a copied pressmark', where: 'twice', from: 3, rarity: 7, tempo: 30, copied: true,
    rote: ['# again', 'rest', 'rest', 'dive', 'pull', 'again'],
    smudge: [3, 4],
    note: 'The same mark twice, one over the other. Neither is the first.',
    blanks: 7, sprite: 'rl_stamp',
  },
  {
    id: 'drained_copy', name: 'a drained copy', where: 'twice', from: 3, rarity: 0.6, tempo: 40,
    rote: ['# careful. counts her hands.', 'still', 'rest', 'pull', 'rest'],
    smudge: [1, 3],
    note: 'A copy from the Press drain. It has the right face and five hands.',
    blanks: 12, sprite: 'rl_hands',
  },

  // The Ears
  {
    id: 'ear_shell', name: 'an ear shell', where: 'ears', from: 4, rarity: 10, tempo: 30,
    rote: ['# hears one thing. says it.', 'rest', 'pull', 'rest', 'dive', 'still'],
    smudge: [4],
    note: 'A shell shaped like a dish. It says the same word every time the line goes slack.',
    blanks: 6, sprite: 'rl_ear',
  },
  {
    id: 'leaning_reed', name: 'a leaning reed', where: 'ears', from: 4, rarity: 8, tempo: 28,
    rote: ['# leans away. rises late.', 'rest', 'rest', 'dive', 'still'],
    smudge: [3],
    note: 'A reed that leans away from the Tether. It is the only one in the Ears that does.',
    blanks: 6, sprite: 'rl_reed',
  },
  {
    id: 'heard_line', name: 'a heard line', where: 'ears', from: 4, rarity: 0.6, tempo: 44,
    rote: ['# said from above.', 'still', 'rest', 'wait', 'pull'],
    smudge: [1, 4],
    note: 'A line of the Cant from the top of the Tether. The Relay says it so often that only ag is left.',
    blanks: 12, sprite: 'rl_heard',
  },

  // The Tether
  {
    id: 'loose_bolt', name: 'a loose bolt', where: 'tether', from: 5, rarity: 12, tempo: 34,
    rote: ['# held a panel. holds nothing.', 'rest', 'dive', 'rest', 'pull'],
    smudge: [2],
    note: 'A bolt from a Tether panel. Dropped, it falls toward the sky.',
    blanks: 7, sprite: 'rl_bolt',
  },
  {
    id: 'worn_nib', name: 'a worn nib', where: 'tether', from: 5, rarity: 0.7, tempo: 38,
    rote: ['# wrote every rote below.', 'wait', 'pull', 'rest', 'still', 'rest'],
    smudge: [2, 4],
    note: 'A pen tip worn flat on one side. Every rote in Busy has this width of stroke.',
    blanks: 12, sprite: 'rl_nib',
  },
  {
    id: 'short_page', name: 'a short page', where: 'tether', from: 5, rarity: 0.25, tempo: 36, secret: true,
    rote: ['# one time.', 'rest', 'pull', 'rest', 'again'],
    smudge: [4],
    note: `In a child's hand: "I let this page down the Tether and it came back up. I let it down again." It is signed Once.`,
    blanks: 12, sprite: 'rl_page_short',
  },
];

const BY_ID = new Map(CATCHES.map((c) => [c.id, c]));

export function catchById(id: string): Catch | undefined {
  return BY_ID.get(id);
}

/** Every kind that bites in a place once the chapter has been reached. */
export function catchesAt(where: string, chapter: number): Catch[] {
  return CATCHES.filter((c) => c.where === where && c.from <= chapter);
}

export type Roll = (() => number) | { next(): number };

/** One kind chosen by weight, or null when nothing bites there yet. */
export function pickCatch(where: string, chapter: number, rng: Roll): Catch | null {
  const pool = catchesAt(where, chapter);
  if (!pool.length) return null;
  const r = typeof rng === 'function' ? rng() : rng.next();
  let at = r * pool.reduce((n, c) => n + c.rarity, 0);
  for (const c of pool) {
    at -= c.rarity;
    if (at < 0) return c;
  }
  return pool[pool.length - 1];
}
