// Everyone in the world who plays Stet, where, from which chapter, with which deck and rule. Pure data.
import { Level } from './ai';
import { RuleId } from './rules';

export interface OpponentDef {
  id: string;
  name: string;
  /** Sprite key, drawn at 1x. */
  art: string;
  /** Region key, as the maps name them. */
  region: string;
  /** Other regions where the opponent can also be found. */
  also?: string[];
  /** The place name shown before a match. */
  place: string;
  chapter: number;
  rules: RuleId[];
  level: Level;
  slip?: number;
  nodes?: number;
  deck: string[];
  intro: string;
  /** Said when the opponent wins. */
  win: string;
  /** Said when the opponent loses. */
  lose: string;
  draw: string;
  /** Lines shown before the first match anyone plays. */
  lesson?: string[];
  /** Blanks paid to the player for a win. */
  purse: number;
  secret?: boolean;
  /** Opponents that must be beaten first. */
  requires?: string[];
  /** A number shown beside the opponent that rises by one each second of the match. */
  counter?: number;
}

const LIST: OpponentDef[] = [
  {
    id: 'count', name: 'Count', art: 'count', region: 'busy', place: 'Busy', chapter: 1, rules: ['plain'],
    level: 'easy', slip: 0.4, purse: 4,
    deck: ['count', 'straw', 'nip', 'chaff', 'straw'],
    intro: 'Nine places. One card at a time. That way nothing happens at once.',
    win: 'I counted your cards twice. Fewer both times.',
    lose: 'Mine turned to you one at a time. Never two at the same moment. I counted.',
    draw: 'The same number on both sides. That is allowed.',
    lesson: [
      'Put a card next to one of mine. Where your number is higher, my card turns to you.',
      'When all nine places are full, the side with more cards wins.',
      'A card left in a hand counts for whoever holds it.',
    ],
  },
  {
    id: 'stack', name: 'Stack', art: 'stack', region: 'busy', place: 'Busy', chapter: 1, rules: ['plain'],
    level: 'easy', slip: 0.35, purse: 5,
    deck: ['stack', 'chaff', 'spoke', 'nip', 'straw'],
    intro: 'I set a card down the way I set a bowl down. Flat side under.',
    win: 'Leave them where they are. They are still drying.',
    lose: 'You put yours on top. That is where the next one goes.',
    draw: 'Even. Two stacks the same height. I will make another bowl.',
  },
  {
    id: 'reel', name: 'Reel', art: 'reel', region: 'river', place: 'the river', chapter: 2, rules: ['plain'],
    level: 'easy', slip: 0.4, purse: 6,
    deck: ['reel', 'fisher', 'lull', 'nip', 'straw'],
    intro: 'Sit. Not on that side. The river can see that side.',
    win: 'Everything I put down came back to me. It does that now.',
    lose: 'Take one. Pull it slowly. They pull back.',
    draw: 'Nothing caught. I sit here for that too.',
  },
  {
    id: 'tally', name: 'Tally', art: 'tally', region: 'standing', place: 'Standing', chapter: 2, rules: ['still'],
    level: 'medium', slip: 0.3, purse: 8, counter: 412009,
    deck: ['tally', 'tock', 'tock', 'grit', 'lull'],
    intro: 'Four hundred and twelve thousand and nine. Sit. Ten.',
    win: 'You lost on a number I have already said. The next one.',
    lose: 'A card moved. In Standing that is a great deal. I keep counting.',
    draw: 'Even. Neither side moved the other. Standing is used to that.',
  },
  {
    id: 'weigh', name: 'Weigh', art: 'weigh', region: 'twice', place: 'Twice', chapter: 3, rules: ['twin'],
    level: 'easy', slip: 0.1, purse: 10,
    deck: ['weigh', 'clerk', 'vatling', 'lull', 'grit'],
    intro: 'Pages. The other two of me will watch. We play the same.',
    win: 'Light. Your hand was light. I could tell from the stall.',
    lose: 'Heavy. Good. Take one. The other two of me agree.',
    draw: 'Balanced. The scales stop. I do not see that often.',
  },
  {
    id: 'presshand', name: 'Presshand', art: 'presshand', region: 'twice', also: ['press'], place: 'the Press', chapter: 3, rules: ['copied'],
    level: 'easy', slip: 0.3, purse: 10,
    deck: ['presshand', 'manycopy', 'manycopy', 'clerk', 'clerk'],
    intro: 'Customers play at this table. You are one body. Sit anyway.',
    win: 'A fault. It goes down the drain.',
    lose: 'The Press would have made two of you. Take the card.',
    draw: 'Same count. The Press makes things the same count. Again.',
  },
  {
    id: 'many', name: 'Many', art: 'many', region: 'twice', place: 'Twice', chapter: 4, rules: ['twin'],
    level: 'hard', purse: 12,
    deck: ['many', 'many', 'many', 'many', 'many'],
    intro: 'Welcome to the table. Fewer of me now. Enough for one hand.',
    win: 'I won here. And here.',
    lose: 'One of me lost. The rest go on.',
    draw: 'Half of me won. I will go and sit with the other half.',
  },
  {
    id: 'listener', name: 'Listener', art: 'listener', region: 'ears', place: 'the Ears', chapter: 4, rules: ['open'],
    level: 'medium', slip: 0.8, purse: 12,
    deck: ['listener', 'static', 'dish', 'ringer', 'flinch'],
    intro: 'Lay them face up. We hear them anyway.',
    win: 'Your last card made a sound like a leaf turning over.',
    lose: 'My dish was down. I did not hear your last card.',
    draw: 'The field is quiet. Both sides heard the same thing.',
  },
  {
    id: 'heed', name: 'Heed', art: 'heed', region: 'ears', place: 'the Ears', chapter: 4, rules: ['open'],
    level: 'medium', slip: 1, purse: 14,
    deck: ['heed', 'dish', 'ringer', 'flinch', 'static'],
    intro: 'Play quickly. A slow hand in the Ears starts saying what the dishes hear.',
    win: 'I heard your cards before you set them down. Face up helps.',
    lose: 'You played faster than I listened. Keep moving.',
    draw: 'Nothing. Even that is a long word out here.',
  },
  {
    id: 'keep', name: 'Keep', art: 'keep', region: 'tether', place: 'the Tether', chapter: 5, rules: ['fall'],
    level: 'easy', slip: 0.1, purse: 16,
    deck: ['keep', 'sentry', 'drift', 'drift', 'waitcopy'],
    intro: 'Rung table. Air thin. The cards wear down up here. One each turn.',
    win: 'Yours wore down. Mine wore down slower. Noted in the rung book.',
    lose: 'Noted. A card lost on the rung. It will not come back.',
    draw: 'Even. Noted. The rung book has a column for that.',
  },
  {
    id: 'sweep', name: 'Sweep', art: 'sweep', region: 'busy', place: 'Busy', chapter: 6, rules: ['copied'],
    level: 'hard', purse: 16,
    deck: ['sweep', 'csweep', 'cstack', 'cpour', 'cmind'],
    intro: 'Seventeen years I swept around you. Now I sweep around the board.',
    win: 'You stayed where you were. I know the shape of that.',
    lose: 'You moved. I have to learn the new shape.',
    draw: 'The board is swept. Nobody is on the worn spot.',
  },
  {
    id: 'gloss', name: 'Gloss', art: 'gloss', region: 'tether', also: ['busy'], place: 'the Tether', chapter: 5, rules: ['open', 'fall'],
    level: 'medium', slip: 0.5, purse: 25, secret: true,
    requires: ['count', 'stack', 'reel', 'tally', 'weigh', 'presshand', 'many', 'listener', 'heed', 'keep'],
    deck: ['gloss', 'again', 'halt', 'each', 'when'],
    intro: 'One game. Hands face up. (One of my cards is a word I should not have taught.)',
    win: 'That is the game. (You played it the way I would. I taught that too.)',
    lose: 'Take one. (Take the lime one. I have carried it long enough.)',
    draw: 'Even. (I wrote the rule for that. I did not think we would need it.)',
  },
  {
    id: 'stet', name: 'Stet', art: 'stet', region: 'twice', place: 'by the drain', chapter: 8, rules: ['twin', 'still'],
    level: 'hard', purse: 35,
    deck: ['stet', 'weigh', 'many', 'presshand', 'corrector'],
    intro: 'Sit. Nine places. Not eight. Nine.',
    win: 'Mine. Not yours. Mine. Let it stand.',
    lose: 'Yours. Let it stand.',
    draw: 'Even. Not odd. Even.',
  },
  {
    id: 'scrivener', name: 'the Scrivener', art: 'scrivener', region: 'busy', also: ['nursery'], place: 'over the Nursery', chapter: 6,
    rules: ['twin', 'copied'], level: 'medium', purse: 40, secret: true,
    requires: ['count', 'stack', 'reel', 'tally', 'weigh', 'presshand', 'many', 'listener', 'heed', 'keep', 'sweep', 'gloss'],
    deck: ['scrivener', 'once', 'arm', 'relay', 'wait'],
    intro: '# nine places. it has written in all of them.',
    win: '# it wins. it writes that down.',
    lose: '# it loses. it leaves room under that.',
    draw: '# even. it had not written that one.',
  },
];

export const OPPONENTS: Record<string, OpponentDef> = {};
for (const o of LIST) OPPONENTS[o.id] = o;

export const OPPONENT_IDS = LIST.map((o) => o.id);

/** Map regions that count as another region for Stet. */
const ALIAS: Record<string, string> = { millrace: 'busy', nursery: 'busy', hall: 'standing', press: 'twice', relay: 'ears', writing: 'tether' };

export function unlocked(o: OpponentDef, beaten: string[]): boolean {
  return !o.requires || o.requires.every((r) => beaten.includes(r));
}

/** Opponents playing in a region by a chapter, given who has been beaten. */
export function available(chapter: number, region: string, beaten: string[]): string[] {
  const r = ALIAS[region] ?? region;
  return LIST.filter((o) => o.chapter <= chapter && (o.region === region || o.region === r || !!o.also?.includes(region) || !!o.also?.includes(r)) && unlocked(o, beaten)).map((o) => o.id);
}
