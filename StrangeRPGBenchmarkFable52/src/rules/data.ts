import type { CharId, Charter, ClaimCard, Kind, Law, AmendId } from './types';

export const KINDS: Kind[] = ['road', 'well', 'town', 'peak'];
export const KIND_NAME: Record<Kind, string> = { road: 'Road', well: 'Well', town: 'Town', peak: 'Peak' };
export const CHARTER_NAME: Record<Charter, string> = { acres: 'Acres', road: 'Roads', well: 'Wells', town: 'Towns', peak: 'Peaks' };
export const CHARS: CharId[] = ['perch', 'deed', 'auger', 'offset', 'lot', 'either'];
export const CHAR_NAME: Record<CharId, string> = { perch: 'Perch', deed: 'Deed', auger: 'Auger', offset: 'Offset', lot: 'Lot', either: 'Either' };

export type Fx = 'hit' | 'hitall' | 'hit2' | 'heal' | 'cover' | 'stun' | 'steal' | 'buff' | 'pinfree' | 'blurfree' | 'drain' | 'weaken' | 'copy';
export interface Skill { name: string; cd: number; fx: Fx; m: number; pierce: boolean; stun: boolean }
export type Power =
  | 'freemove' | 'freesketch' | 'freemeasure' | 'inkturn' | 'doubtturn' | 'wellplus' | 'reach' | 'cheapcontest'
  | 'guardpegs' | 'cheaprecruit' | 'see' | 'steal' | 'draft' | 'pegunder' | 'slot' | 'foresight' | 'twice' | 'grow';

export const POWER_TEXT: Record<Power, string> = {
  freemove: 'Your first move each turn is free.',
  freesketch: 'Your first sketch each turn is free.',
  freemeasure: 'Your first measure each turn costs no ink.',
  inkturn: 'Gain 1 ink at the start of your turn.',
  doubtturn: 'Gain 1 doubt at the start of your turn.',
  wellplus: 'Working a Well gives 1 more ink.',
  reach: 'Measure and peg tiles next to you.',
  cheapcontest: 'Contest costs 1 step.',
  guardpegs: 'Wardens on your pegs have 8 more health.',
  cheaprecruit: 'Locals cost you 1 less.',
  see: 'See every rival hand and claim.',
  steal: 'Take 1 more from a rival you beat.',
  draft: 'Once a round, Work also draws a draft.',
  pegunder: 'Counts as your peg on the tile you stand on.',
  slot: 'One more companion. You can Blur yourself.',
  foresight: 'See each rival\'s first planned action.',
  twice: 'Acts twice in a fight.',
  grow: 'Attack grows by 1 each round of a fight.',
};

export interface Face { gloss: string; hp: number; atk: number; spd: number; skill: Skill; power: Power | null }
export interface LocalDef { id: string; name: string; kind: Kind; cost: number; a: Face; b: Face; reserve: boolean }

function sk(name: string, fx: Fx, m = 1, cd = 2, pierce = false, stun = false): Skill {
  return { name, cd, fx, m, pierce, stun };
}
function face(gloss: string, hp: number, atk: number, spd: number, skill: Skill, power: Power | null): Face {
  return { gloss, hp, atk, spd, skill, power };
}
function local(id: string, name: string, kind: Kind, cost: number, a: Face, b: Face, reserve = false): LocalDef {
  return { id, name, kind, cost, a, b, reserve };
}

export const LOCALS: LocalDef[] = [
  local('rook', 'Rook', 'peak', 2,
    face('bird', 7, 4, 8, sk('Dive', 'hit', 1.5), 'freemove'),
    face('tower', 14, 2, 2, sk('Wall', 'cover', 1, 2), 'guardpegs')),
  local('kite', 'Kite', 'peak', 2,
    face('bird of prey', 6, 5, 9, sk('Stoop', 'hit', 1.25, 3, true), 'cheapcontest'),
    face('paper kite', 6, 2, 6, sk('Tangle', 'stun', 1, 3), 'doubtturn')),
  local('crane', 'Crane', 'well', 2,
    face('wading bird', 8, 3, 6, sk('Spear', 'hit', 1.5), 'wellplus'),
    face('hoist', 12, 6, 1, sk('Drop', 'hit', 2, 3), 'freesketch')),
  local('seal', 'Seal', 'well', 2,
    face('sea animal', 10, 3, 5, sk('Bark', 'heal', 4), 'doubtturn'),
    face('stamp', 8, 3, 4, sk('Stamp', 'pinfree', 1, 2), 'freemeasure')),
  local('hawk', 'Hawk', 'town', 2,
    face('bird', 6, 5, 9, sk('Strike', 'hit', 1.5), 'reach'),
    face('peddler', 8, 2, 5, sk('Haggle', 'steal', 2, 3), 'inkturn')),
  local('pitcher', 'Pitcher', 'town', 2,
    face('jug', 10, 2, 3, sk('Pour', 'heal', 5), 'wellplus'),
    face('thrower', 7, 5, 7, sk('Fastball', 'hit', 1.5, 3, true), 'cheapcontest')),
  local('ram', 'Ram', 'road', 2,
    face('sheep', 10, 4, 5, sk('Butt', 'hit', 1, 3, false, true), 'freemove'),
    face('beam', 12, 6, 2, sk('Breach', 'hit', 2, 3), 'cheapcontest')),
  local('drone', 'Drone', 'road', 2,
    face('bee', 5, 3, 8, sk('Sting', 'weaken', 1, 2), 'inkturn'),
    face('flying machine', 7, 4, 7, sk('Strafe', 'hitall', 0.75, 3), 'reach')),
  local('mole', 'Mole', 'well', 2,
    face('digger', 9, 3, 4, sk('Undermine', 'hit', 1.5, 2, true), 'wellplus'),
    face('spy', 6, 3, 7, sk('Expose', 'pinfree', 1, 3), 'see'), true),
  local('fence', 'Fence', 'town', 2,
    face('barrier', 15, 1, 1, sk('Bar the way', 'cover', 1, 2), 'guardpegs'),
    face('dealer', 7, 3, 6, sk('Lift', 'steal', 2, 3), 'steal'), true),
  local('monitor', 'Monitor', 'peak', 3,
    face('lizard', 12, 4, 3, sk('Bite', 'drain', 1), 'guardpegs'),
    face('watch screen', 7, 2, 5, sk('Focus', 'buff', 2), 'see'), true),
  local('buck', 'Buck', 'road', 2,
    face('stag', 9, 5, 7, sk('Charge', 'hit', 1.5), 'freemove'),
    face('coin', 6, 2, 5, sk('Flip', 'blurfree', 1, 2), 'inkturn'), true),
  local('sage', 'Sage', 'town', 3,
    face('herb', 7, 1, 4, sk('Poultice', 'heal', 6), 'cheaprecruit'),
    face('elder', 8, 2, 3, sk('Counsel', 'buff', 2), 'doubtturn'), true),
  local('bolt', 'Bolt', 'peak', 3,
    face('lightning', 5, 7, 10, sk('Flash', 'hit', 1.5, 3, true), 'cheapcontest'),
    face('fastener', 10, 3, 3, sk('Hold fast', 'stun', 1, 2), 'guardpegs'), true),
  local('conductor', 'Conductor', 'road', 3,
    face('train guide', 8, 3, 6, sk('Whistle', 'buff', 2), 'freemove'),
    face('wire', 7, 5, 6, sk('Arc', 'hit2', 1, 2), 'reach'), true),
  local('jack', 'Jack', 'road', 2,
    face('lifting tool', 11, 4, 3, sk('Heave', 'hit', 1.5), 'freesketch'),
    face('knave', 7, 4, 8, sk('Cheat', 'steal', 2, 3), 'steal'), true),
  local('tender', 'Tender', 'well', 2,
    face('caretaker', 9, 2, 4, sk('Mend', 'heal', 5), 'cheaprecruit'),
    face('supply boat', 10, 3, 5, sk('Ferry', 'blurfree', 1, 2), 'wellplus'), true),
];

/** Struck readings. One face each. `of` names the rival the reading belongs to. */
export interface HalfDef { id: string; name: string; gloss: string; of: CharId; face: Face; season: number }
export const HALVES: HalfDef[] = [
  { id: 'parcel', name: 'Lot', gloss: 'a parcel of ground', of: 'lot', season: 2, face: face('parcel of ground', 18, 2, 1, sk('Edge', 'cover', 1, 2), 'pegunder') },
  { id: 'act', name: 'Deed', gloss: 'an act', of: 'deed', season: 3, face: face('act', 10, 4, 8, sk('Do', 'hit', 1.5, 2), 'twice') },
  { id: 'roost', name: 'Perch', gloss: 'a roost', of: 'perch', season: 4, face: face('roost', 16, 1, 1, sk('Rest', 'heal', 5, 2), 'slot') },
  { id: 'augur', name: 'Augur', gloss: 'a seer', of: 'auger', season: 5, face: face('seer', 9, 3, 7, sk('Foretell', 'stun', 1, 2), 'foresight') },
  { id: 'offshoot', name: 'Offset', gloss: 'an offshoot', of: 'offset', season: 6, face: face('offshoot', 12, 3, 5, sk('Lean', 'hit', 1.25, 2), 'grow') },
];

/** Page, kept from season 1. Both are single readings. */
export const PAGE_CHILD: Face = face('serving child', 6, 2, 7, sk('Fetch', 'buff', 2, 2), 'draft');

export interface LeaderDef { hp: number; atk: number; spd: number; skill: Skill }
export const LEADERS: Record<CharId, LeaderDef> = {
  perch: { hp: 16, atk: 4, spd: 6, skill: sk('Sight', 'pinfree', 1, 3) },
  deed: { hp: 20, atk: 3, spd: 3, skill: sk('Injunction', 'stun', 1, 3) },
  auger: { hp: 14, atk: 6, spd: 5, skill: sk('Bore', 'hit', 2, 3) },
  offset: { hp: 15, atk: 4, spd: 7, skill: sk('Copy', 'copy', 1.5, 2) },
  lot: { hp: 22, atk: 4, spd: 4, skill: sk('Crowd', 'hitall', 0.75, 2) },
  either: { hp: 16, atk: 4, spd: 6, skill: sk('Unsay', 'blurfree', 1, 2) },
};

export interface FoeDef { id: string; name: string; two: boolean; a: Face; b: Face | null; ink: number; doubt: number; reward: { ink: number; doubt: number }; count: number }
function foe(id: string, name: string, a: Face, b: Face | null, ink: number, doubt: number, rInk: number, rDoubt: number, count = 1): FoeDef {
  return { id, name, two: b !== null, a, b, ink, doubt, reward: { ink: rInk, doubt: rDoubt }, count };
}

export const WARDENS: Record<Kind | 'open' | 'haze', FoeDef> = {
  road: foe('tollkeeper', 'Tollkeeper', face('warden', 26, 5, 4, sk('Toll', 'steal', 1, 2), null), null, 1, 0, 0, 0),
  well: foe('wellwarden', 'Wellwarden', face('warden', 30, 5, 3, sk('Draw', 'drain', 1, 2), null), null, 1, 0, 0, 0),
  town: foe('militia', 'Militia', face('warden', 15, 4, 5, sk('Rally', 'buff', 1, 3), null), null, 1, 0, 0, 0, 2),
  peak: foe('lookout', 'Lookout', face('warden', 20, 6, 9, sk('Loose', 'hit', 1.25, 2, true), null), null, 1, 0, 0, 0),
  open: foe('stray', 'Stray', face('this', 14, 4, 5, sk('Dodge', 'blurfree', 1, 3), null), face('that', 14, 4, 5, sk('Dodge', 'blurfree', 1, 3), null), 0, 1, 0, 0),
  haze: foe('haze', 'Haze', face('this', 18, 5, 6, sk('Thicken', 'blurfree', 1, 2), null), face('that', 18, 5, 6, sk('Thicken', 'blurfree', 1, 2), null), 0, 2, 0, 0),
};

export const CREATURES: FoeDef[] = [
  foe('pike', 'Pike', face('fish', 14, 4, 6, sk('Snap', 'hit', 1.5), null), face('spear', 11, 6, 5, sk('Thrust', 'hit', 1.25, 2, true), null), 0, 1, 3, 2),
  foe('ray', 'Ray', face('flat fish', 16, 3, 4, sk('Lie flat', 'cover', 1, 2), null), face('beam', 11, 5, 6, sk('Sweep', 'hitall', 0.75, 3), null), 0, 1, 3, 2),
  foe('skate', 'Skate', face('fish', 12, 4, 7, sk('Glide', 'blurfree', 1, 3), null), face('bladed shoe', 11, 6, 8, sk('Slice', 'hit', 1.5), null), 0, 1, 3, 2),
  foe('bass', 'Bass', face('fish', 15, 4, 4, sk('Gulp', 'drain', 1), null), face('low note', 12, 4, 3, sk('Drone', 'stun', 1, 3), null), 0, 1, 3, 2),
  foe('sole', 'Sole', face('flat fish', 14, 3, 5, sk('Settle', 'heal', 4), null), face('the only one', 14, 6, 5, sk('Alone', 'buff', 2), null), 0, 2, 3, 2),
  foe('gull', 'Gull', face('bird', 11, 5, 8, sk('Snatch', 'steal', 1, 2), null), face('trick', 11, 4, 7, sk('Fool', 'blurfree', 1, 2), null), 0, 2, 3, 2),
  foe('bat', 'Bat', face('flier', 10, 4, 9, sk('Flit', 'blurfree', 1, 3), null), face('club', 14, 7, 3, sk('Swing', 'hit', 2, 3), null), 0, 1, 3, 2),
  foe('bug', 'Bug', face('insect', 10, 4, 8, sk('Bite', 'weaken', 1, 2), null), face('fault', 12, 4, 6, sk('Crash', 'stun', 1, 3), null), 0, 1, 3, 2),
];

export const GUARDIANS: Record<string, FoeDef> = {
  teller: foe('teller', 'Teller', face('teller of tales', 30, 8, 5, sk('Spin', 'stun', 1, 3), null), face('counter of money', 30, 8, 5, sk('Sign here', 'pinfree', 1, 2), null), 2, 1, 3, 2),
  bar: foe('bar', 'Bar', face('iron rod', 40, 9, 4, sk('Crack', 'hit', 1.5, 2), null), face('court rail', 40, 6, 2, sk('Nothing passes', 'cover', 1, 2), null), 2, 2, 3, 3),
  quarry: foe('quarry', 'Quarry', face('pit', 40, 6, 3, sk('Swallow', 'drain', 1, 2), null), face('hunted animal', 40, 6, 9, sk('Bolt', 'blurfree', 1, 2), null), 0, 4, 2, 4),
  level: foe('level', 'The Level', face('instrument', 48, 5, 5, sk('Enter', 'pinfree', 1, 1), null), null, 9, 0, 4, 0),
  scale: foe('scale', 'Scale', face('fish plate', 60, 9, 5, sk('Shed', 'cover', 1, 3), null), face('map ratio', 60, 9, 5, sk('Reduce', 'hitall', 0.75, 2), null), 2, 3, 4, 4),
};

export interface SiteDef { id: string; name: string; season: number; a: Kind; b: Kind; guardian: string; half: string | null; relic: string | null; moves: boolean }
export const SITES: SiteDef[] = [
  { id: 'bank', name: 'The Bank', season: 2, a: 'well', b: 'town', guardian: 'teller', half: 'parcel', relic: 'glass', moves: false },
  { id: 'court', name: 'The Court', season: 3, a: 'town', b: 'road', guardian: 'bar', half: 'act', relic: 'ring', moves: false },
  { id: 'quarry', name: 'The Quarry', season: 4, a: 'well', b: 'peak', guardian: 'quarry', half: 'roost', relic: 'spring', moves: true },
  { id: 'pass', name: 'The Pass', season: 5, a: 'peak', b: 'road', guardian: 'bat', half: 'augur', relic: 'match', moves: false },
  { id: 'legend', name: 'The Legend', season: 6, a: 'town', b: 'peak', guardian: 'scale', half: 'offshoot', relic: 'table', moves: false },
];

export interface RelicDef { id: string; name: string; a: string; b: string; ta: string; tb: string }
export const RELICS: RelicDef[] = [
  { id: 'glass', name: 'Glass', a: 'lens', b: 'cup', ta: 'Measure and peg tiles next to you.', tb: 'Start each sheet with 2 more ink.' },
  { id: 'spring', name: 'Spring', a: 'coil', b: 'source', ta: 'Your first move each turn is free.', tb: 'Gain 1 more ink each turn.' },
  { id: 'match', name: 'Match', a: 'flame', b: 'equal', ta: 'Your side acts first in every fight.', tb: 'Charter ties go to you.' },
  { id: 'ring', name: 'Ring', a: 'band', b: 'peal', ta: 'Your truces last 1 more round.', tb: 'Enemies lose their first turn in a fight.' },
  { id: 'bow', name: 'Bow', a: 'weapon', b: 'knot', ta: 'Your leader\'s strike hits 2 targets.', tb: 'Contesting your peg costs 1 more step.' },
  { id: 'table', name: 'Table', a: 'board', b: 'figures', ta: 'One more companion.', tb: 'See every hand and claim.' },
  { id: 'bubble', name: 'Bubble', a: 'vial', b: 'vial', ta: 'Once a fight, Blur any unit for nothing.', tb: 'Once a fight, Blur any unit for nothing.' },
];

export const CLAIM_TEXT: Record<string, { name: string; text: string }> = {
  longline: { name: 'Long line', text: '5 of your pegs touch in one group.' },
  fourkinds: { name: 'Four kinds', text: 'A peg on fixed ground of each kind, and 5 pegs.' },
  deeppockets: { name: 'Deep pockets', text: 'Hold 10 ink and 2 pegged Wells.' },
  opencountry: { name: 'Open country', text: 'Hold 6 doubt and 3 pegs on undecided ground.' },
  highground: { name: 'High ground', text: '3 pegged Peaks.' },
  fullhouse: { name: 'Full house', text: '2 companions and 2 pegged Towns.' },
  farfield: { name: 'Far field', text: '3 pegs in the top two rows.' },
  cleanhands: { name: 'Clean hands', text: '4 pegs, no contest started, no promise broken.' },
};
export const CLAIM_CARDS: ClaimCard[] = [
  { a: 'longline', b: 'highground' },
  { a: 'fourkinds', b: 'deeppockets' },
  { a: 'opencountry', b: 'fullhouse' },
  { a: 'farfield', b: 'cleanhands' },
];

export const LAW_OF: Record<CharId, Law> = { perch: 'none', deed: 'fees', auger: 'market', offset: 'parity', lot: 'headcount', either: 'second' };
export const PERCH_LAWS: Law[] = ['frontier', 'quiet', 'witness'];
export const LAW_TEXT: Record<Law, { name: string; text: string }> = {
  none: { name: 'No law', text: 'The holder adds no law.' },
  fees: { name: 'Fees', text: 'A broken promise costs the breaker 2 ink, paid to the holder.' },
  market: { name: 'Open market', text: 'Stand on a rival peg and pay its owner 3 ink to replace it.' },
  parity: { name: 'Parity', text: 'Each round the party with the fewest pegs takes 1 ink from the party with the most.' },
  headcount: { name: 'Head count', text: 'Pegged Towns count 1 more toward the Charter.' },
  second: { name: 'Second reading', text: 'An objection costs 1 doubt.' },
  frontier: { name: 'Frontier', text: 'Pegs in the top two rows count 1 more toward the Charter.' },
  quiet: { name: 'Quiet', text: 'Wardens have 8 more health.' },
  witness: { name: 'Witness', text: 'A party that breaks a promise pays the wronged party 2 ink.' },
};

export const AMEND_TEXT: Record<AmendId, string> = {
  openfull: 'Pegs on undecided ground count 1.',
  doubtties: 'Charter ties go to the party with the most doubt.',
  second_kind: 'The Charter also counts a second kind.',
  binding: 'A party that breaks a promise loses a peg.',
  peace: 'No contests on Towns.',
  deepwells: 'Wells give 1 more ink.',
};

export interface RivalDef {
  wants: Kind[];
  inkVal: number;
  doubtVal: number;
  margin: number;
  aggression: number;
  honor: number;
  rules: [string, string];
  power: string;
  wantsText: string;
}
export const RIVALS: Record<CharId, RivalDef> = {
  perch: { wants: [], inkVal: 1, doubtVal: 1, margin: 0.5, aggression: 1, honor: 0.7, rules: ['', ''], power: '', wantsText: '' },
  deed: {
    wants: ['road'], inkVal: 1, doubtVal: 0.5, margin: 0.3, aggression: 0.8, honor: 1,
    rules: ['To the letter: never breaks a promise.', 'Needs cause: contests only a party that wronged her or leads the count.'],
    power: 'Salary: 1 more ink each turn. Contesting her peg costs 1 ink first.', wantsText: 'Roads, and a peg on every measured tile.',
  },
  auger: {
    wants: ['well'], inkVal: 1.4, doubtVal: 0.6, margin: 0.9, aggression: 1.1, honor: 0.35,
    rules: ['No tomorrow: goods now count for more, promises for little.', 'Has a price: every 2 ink you give him mends 1 trust. He breaks a truce for enough gain.'],
    power: 'Sink: works his own pegged Well for 1 more. Measures a next-door tile with a Well reading.', wantsText: 'Wells, and ink in hand.',
  },
  offset: {
    wants: [], inkVal: 1, doubtVal: 0.9, margin: 0.6, aggression: 1.2, honor: 0.5,
    rules: ['Measures against a mark: he tries to stay ahead of one chosen party.', 'Copies: he favors the action his mark took last.'],
    power: 'No tool of his own. He watches what his mark does.', wantsText: 'Whatever his mark has, plus one.',
  },
  lot: {
    wants: ['town'], inkVal: 1, doubtVal: 0.8, margin: 0.5, aggression: 1, honor: 0.6,
    rules: ['Puts it to a vote: nine members vote on every deal.', 'Long memory: its trust in you never mends on its own.'],
    power: 'Many hands: a fourth step while it has 2 companions.', wantsText: 'Towns, and acres.',
  },
  either: {
    wants: [], inkVal: 0, doubtVal: 1.1, margin: 0.1, aggression: 0.7, honor: 0.6,
    rules: ['Takes no ink: ink is worth nothing to her. She gains 2 doubt a turn instead.', 'Will not be held: her promises last 1 round. She gives doubt to the party with the fewest pegs.'],
    power: 'Unsay: unmeasures for 2 doubt. Her pegs on undecided ground count 1 and block measuring.', wantsText: 'Ground left undecided.',
  },
};

export const HIDDEN_TRAITS: Record<string, string> = {
  sore: 'Sore loser: contests again the party that last beat it.',
  soft: 'Soft touch: takes any fair deal from the party in last place.',
  collector: 'Collector: pays 1 more for a draft with a kind it wants.',
  homebody: 'Homebody: stays within 3 tiles of its start.',
  gambler: 'Gambler: files its claim as early as it can.',
  bookkeeper: 'Bookkeeper: never spends its last 2 ink.',
  nightowl: 'Night owl: takes 1 more step in the last round.',
};
export const EVOLVED_TRAITS: Record<string, string> = {
  wary: 'Wary: wants payment up front after two broken promises.',
  proud: 'Proud: refuses deals from parties with fewer pegs.',
  hungry: 'Hungry: sat out a sheet and contests more.',
  fond: 'Fond: will not contest you first.',
};

export const PERKS: Record<string, { name: string; text: string }> = {
  chain: { name: 'Steel chain', text: 'Your first move each turn is free.' },
  inkhorn: { name: 'Inkhorn', text: 'Start each sheet with 3 more ink.' },
  goodname: { name: 'Good name', text: 'Every rival starts each sheet with 1 more trust in you.' },
  thickskin: { name: 'Thick skin', text: '5 more health in fights.' },
  longsight: { name: 'Long sight', text: 'Measure and peg tiles next to you.' },
  countersign: { name: 'Countersign', text: 'Objecting to your measurements costs 1 more doubt.' },
  satchel: { name: 'Satchel', text: 'Hold 1 more draft.' },
  quickhand: { name: 'Quick hand', text: 'Your first sketch each turn is free.' },
};
