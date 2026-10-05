import { Foe, pl, st, xp } from './util';

// Optional foes from side calls.
export const EXTRA: Foe[] = [
  {
    id: 'beeling', name: 'Spelling Bee', sprite: { t: 'bug', seed: 'beeling', a: 'gold', b: 'ink' }, lvl: 18,
    stats: st(18, { hp: 0.6, spd: 1.35 }), weak: ['chill', 'loud'], resist: ['edge'],
    moves: [{ skill: 'e_sting', w: 2 }, { skill: 'attack', w: 1 }],
    prayer: 'Please let me spell it right. B-E... B-E-E...',
    desc: 'A bee that grew from a child asking to win a spelling bee. It knows every word and says each one letter by letter.',
    ask: 'praise', xp: xp(18), pleas: pl(18, 0.5),
    kept: { name: 'Honeyed Word', desc: '+12 voice.', mods: { vp: 12 }, skill: 'e_sting' },
  },
  {
    id: 'queenbee', name: 'The Queen Bee', sprite: { t: 'flyer', seed: 'queenbee', a: 'gold', b: 'red' }, lvl: 20, scale: 3,
    stats: st(20, { hp: 3.6, pow: 1.35, wit: 1.3, grd: 1.1, spd: 1.2 }), weak: ['chill'], resist: ['edge', 'loud'],
    moves: [{ skill: 'e_swarm', w: 2 }, { skill: 'e_sting', w: 2 }, { skill: 'e_hasteself', w: 1, if: 'odd' }],
    prayer: 'Please let me win. Let me win every one. Let nobody ever beat me at anything.',
    desc: 'The prayer behind the bee kid, with a crown on. It has won every bee for three hundred years and has started quizzing people in the street.',
    ask: 'praise', askNeed: 'low', boss: true, xp: 1400, pleas: 160,
    answered: 'You tell her it was spelled perfectly. She buzzes, very pleased, and finally lets someone else have a turn.',
    kept: { name: 'Spelling Crown', desc: '+8 wit, +8 power.', mods: { wit: 8, pow: 8 }, skill: 'e_swarm' },
  },
  {
    id: 'ledger412', name: 'Four Hundred and Twelve', sprite: { t: 'mouth', seed: 'ledger412', a: 'paper', b: 'slate' }, lvl: 34, scale: 5,
    stats: st(34, { hp: 9.5, pow: 2.0, wit: 2.1, grd: 1.3, spd: 1.35, vp: 3 }), weak: ['loud', 'spark'], resist: ['hush', 'edge'],
    moves: [{ skill: 'e_roll', w: 2 }, { skill: 'e_rung', w: 2 }, { skill: 'e_massreturn', w: 1 }, { skill: 'e_quota', w: 1, if: 'odd' }],
    prayer: 'please was it worth it please did we arrive please tell her we arrived',
    desc: 'Every name one Lineman ever carried up the Line, written down, torn out, and fallen back. They are not angry. They want to know.',
    ask: 'remember', askNeed: 'low', mustAnswer: true, boss: true,
    answered: 'You read the names from the twelve pages, every one, and the margin notes too. The pile listens all the way to the end, then lies down flat, like paper does.',
    xp: 9000, pleas: 0,
    kept: { name: 'The Margin', desc: '+60 HP, +10 wit.', mods: { hp: 60, wit: 10 }, skill: 'e_roll' },
  },
];
