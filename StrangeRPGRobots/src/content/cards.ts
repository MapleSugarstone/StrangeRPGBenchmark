// Sluice: the card game played in bars across Fathom. Each card shows a person or a thing with four
// numbers, one per side. A card placed next to an opponent's card flips it when its facing number is higher.

export interface CardDef { id: string; name: string; look: string; n: number; e: number; s: number; w: number; kind: 'deeps' | 'stair' | 'brim' | 'woken' | 'board' }

const c = (id: string, name: string, look: string, n: number, e: number, s: number, w: number, kind: CardDef['kind']): CardDef => ({ id, name, look, n, e, s, w, kind });

export const CARDS: CardDef[] = [
  // Common: sums 10 to 14.
  c('kid', 'Canal Kid', 'kid', 2, 3, 1, 4, 'deeps'),
  c('ganger', 'Ganger', 'ganger', 3, 2, 4, 2, 'deeps'),
  c('moss', 'Moss', 'moss', 1, 4, 3, 3, 'deeps'),
  c('lockjaw', 'Lockjaw', 'lockjaw', 4, 1, 2, 4, 'deeps'),
  c('cutter', 'Cutter', 'cutter', 2, 4, 4, 1, 'deeps'),
  c('officer', 'Board Officer', 'boardguard', 3, 3, 3, 3, 'board'),
  c('drone', 'Board Drone', 'drone', 5, 1, 1, 4, 'board'),
  c('choir', 'Choir Monk', 'choir', 1, 3, 5, 3, 'deeps'),
  c('deacon', 'Deacon', 'deacon', 2, 2, 5, 3, 'stair'),
  c('dog', 'Gangplank Dog', 'dog', 4, 4, 1, 2, 'deeps'),
  // Uncommon: sums 15 to 18.
  c('nurse', 'Cutter Nurse', 'nurse', 3, 5, 2, 5, 'deeps'),
  c('jawbrute', 'Jaw Brute', 'jawbrute', 6, 2, 5, 3, 'deeps'),
  c('tapper', 'Tapper', 'tapper', 4, 4, 4, 4, 'board'),
  c('patrol', 'Patrol 6', 'patrol', 5, 5, 3, 2, 'board'),
  c('diverfoe', 'Board Diver', 'diverfoe', 2, 6, 3, 5, 'board'),
  c('opal', 'Opal', 'opal', 5, 3, 4, 4, 'deeps'),
  c('seo', 'Doc Seo', 'seo', 4, 2, 6, 4, 'deeps'),
  c('rina', 'Rina Moll', 'rina', 6, 4, 2, 5, 'deeps'),
  c('bram', 'Lockmaster Bram', 'bram', 3, 6, 5, 2, 'deeps'),
  c('lam', 'Mevrouw Lam', 'lam', 5, 3, 3, 6, 'stair'),
  // Rare: sums 19 to 22.
  c('courtesy', 'Courtesy', 'courtesy', 7, 4, 6, 3, 'woken'),
  c('sallis', 'Sallis', 'sallis', 5, 7, 3, 5, 'deeps'),
  c('quaye', 'Quaye', 'quaye', 3, 5, 7, 5, 'deeps'),
  c('ambrose', 'Ambrose', 'ambrose', 7, 3, 5, 6, 'deeps'),
  c('tova', 'Tova', 'tova', 6, 6, 4, 4, 'woken'),
  c('ignace', 'Brother Ignace', 'ignace', 4, 5, 6, 6, 'stair'),
  c('sieve', 'Mother Sieve', 'sieve', 6, 6, 6, 3, 'deeps'),
  c('velt', 'Archdeacon Velt', 'velt', 5, 4, 7, 6, 'stair'),
  c('tilly', 'Tilly', 'tilly', 6, 7, 6, 2, 'woken'),
  // Legendary: sums 24 to 27.
  c('dowser', 'The Dowser', 'dowser', 8, 6, 5, 7, 'board'),
  c('teun', 'Teun Halsema', 'teun', 4, 9, 7, 6, 'board'),
  c('marit', 'Little Marit', 'marit', 9, 6, 3, 8, 'woken'),
  c('hendrik', 'Hendrik', 'patrol_hushed', 8, 8, 8, 3, 'woken'),
  // The Flats.
  c('wader', 'Wader', 'wader', 3, 3, 2, 4, 'deeps'),
  c('mudlark', 'Mudlark', 'mudlark', 1, 4, 4, 2, 'deeps'),
  c('salvdrone', 'Salvage Drone', 'drone', 5, 2, 3, 3, 'board'),
  c('zout', 'Doc Zout', 'zout', 3, 5, 5, 3, 'deeps'),
  c('riek', 'Riek', 'riek', 4, 6, 3, 5, 'deeps'),
  c('ankie', 'Old Ankie', 'ankie', 6, 3, 5, 6, 'deeps'),
  c('dirkje', 'Dirkje Bakx', 'dirkje', 5, 6, 6, 4, 'deeps'),
  // The Line tunnels.
  c('mole', 'Mole', 'mole', 2, 4, 3, 3, 'deeps'),
  c('faregate', 'Fare Gate', 'turret', 5, 1, 4, 2, 'woken'),
  c('trackbot', 'Track Robot', 'patrol', 4, 4, 2, 4, 'board'),
  c('sel', 'Sel', 'sel', 5, 3, 5, 3, 'deeps'),
  c('spoor', 'Stationmaster Spoor', 'spoor', 3, 6, 4, 4, 'deeps'),
  c('stillman', 'The Stillman', 'stillman', 6, 5, 4, 6, 'board'),
];
export const CARD = new Map<string, CardDef>(CARDS.map((x) => [x.id, x]));

export type RuleId = 'wet' | 'same' | 'woken' | 'board' | 'tide';
export const RULE_TEXT: Record<RuleId, string> = {
  wet: 'Wet: Two squares become puddles. A card on a puddle gets plus 1 on every side.',
  same: 'Same: If two or more sides match the cards they touch, those cards flip.',
  woken: 'Woken: Woken cards get plus 1 next to a card you own.',
  board: 'Board: Board cards cannot be flipped by an equal-or-lower card plus 1.',
  tide: 'Tide: After the fourth card, the bottom row floods. Cards there lose 1 on every side.',
};

export interface Opponent { id: string; name: string; look: string; deck: string[]; rules: RuleId[]; prize: string[]; skill: number }

export const OPPONENTS: Opponent[] = [
  { id: 'moss', name: 'Moss', look: 'moss', deck: ['kid', 'ganger', 'moss', 'dog', 'lockjaw'], rules: [], prize: ['moss', 'dog'], skill: 0.4 },
  { id: 'gus', name: 'Gus', look: 'gus', deck: ['lockjaw', 'cutter', 'kid', 'dog', 'rina'], rules: ['wet'], prize: ['rina', 'lockjaw'], skill: 0.6 },
  { id: 'lotte', name: 'Lotte', look: 'lotte', deck: ['nurse', 'cutter', 'choir', 'opal', 'seo'], rules: ['wet', 'same'], prize: ['opal', 'seo'], skill: 0.75 },
  { id: 'bram', name: 'Bram', look: 'bram', deck: ['officer', 'patrol', 'bram', 'tapper', 'drone'], rules: ['tide'], prize: ['bram', 'patrol'], skill: 0.8 },
  { id: 'deacon', name: 'A deacon', look: 'deacon', deck: ['deacon', 'lam', 'velt', 'choir', 'ignace'], rules: ['same', 'woken'], prize: ['velt', 'lam'], skill: 0.85 },
  { id: 'clerk', name: 'A Board clerk', look: 'boardguard', deck: ['dowser', 'teun', 'diverfoe', 'tapper', 'patrol'], rules: ['board', 'same'], prize: ['dowser', 'teun'], skill: 0.95 },
  { id: 'grietje', name: 'Grietje', look: 'grietje', deck: ['mole', 'faregate', 'trackbot', 'sel', 'spoor'], rules: ['same', 'woken'], prize: ['spoor', 'stillman'], skill: 0.7 },
  { id: 'riek', name: 'Riek', look: 'riek', deck: ['wader', 'mudlark', 'salvdrone', 'zout', 'riek'], rules: ['tide', 'wet'], prize: ['ankie', 'dirkje'], skill: 0.75 },
  { id: 'tilly', name: 'Tilly', look: 'tilly', deck: ['tilly', 'courtesy', 'hendrik', 'tova', 'marit'], rules: ['woken', 'tide'], prize: ['hendrik', 'marit'], skill: 0.9 },
];
export const OPPONENT = new Map<string, Opponent>(OPPONENTS.map((o) => [o.id, o]));

export const STARTER = ['kid', 'ganger', 'moss', 'officer', 'cutter', 'choir', 'drone'];
