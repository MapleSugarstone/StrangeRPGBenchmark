import type { CharDef, Stats } from './types';

const st = (hp: number, mp: number, atk: number, mag: number, def: number, res: number, spd: number): Stats => ({ hp, mp, atk, mag, def, res, spd });

export const CHARS: CharDef[] = [
  {
    id: 'wick', name: 'Wick', cls: 'Lamplighter', joinChapter: 1, row: 1, weak: 'frost', resist: 'ember', stance: 'steady',
    blurb: 'Apprentice winder of the Lamp. Wants one quiet evening.',
    base: st(38, 14, 7, 10, 5, 7, 10), grow: st(11, 2.2, 1.6, 2.7, 1.6, 2.0, 0.85),
    learn: [[0, 'flare'], [0, 'windup'], [0.08, 'glow'], [0.2, 'gutter'], [0.4, 'sunset'], [0.65, 'lampfall']], limit: 'noon',
    colors: ['#ffb02e', '#fff2b0'],
  },
  {
    id: 'pocket', name: 'Pocket', cls: 'Vendor', joinChapter: 1, row: 0, weak: 'volt', resist: 'frost', stance: 'swift',
    blurb: 'A vending machine that learned to walk. Sells truths at cost.',
    base: st(44, 12, 8, 7, 7, 6, 9), grow: st(12, 2, 2.2, 1.8, 2.0, 1.6, 0.8),
    learn: [[0, 'dispense'], [0, 'exact'], [0.1, 'pricehike'], [0.3, 'refill'], [0.55, 'clearance'], [0.75, 'refund']], limit: 'goob',
    colors: ['#58c8ff', '#ff5a7a'],
  },
  {
    id: 'thistle', name: 'Thistle', cls: 'Mothwright', joinChapter: 2, row: 1, weak: 'ember', resist: 'bloom', stance: 'steady',
    blurb: 'A moth nun who delivers the last letters. Gentle, tired, very funny.',
    base: st(34, 18, 4, 11, 4, 9, 11), grow: st(9.5, 2.8, 1.0, 2.9, 1.3, 2.3, 0.9),
    learn: [[0, 'mend'], [0, 'lullaby'], [0.15, 'wingdust'], [0.3, 'cocoon'], [0.55, 'softrain'], [0.75, 'moonmoth']], limit: 'grace',
    colors: ['#d9c6ff', '#7a5cff'],
  },
  {
    id: 'ajar', name: 'Sir Ajar', cls: 'Knight', joinChapter: 3, row: 0, weak: 'volt', resist: 'frost', stance: 'steady',
    blurb: 'A suit of armor that is also a half-open door. Afraid of what is inside.',
    base: st(56, 8, 10, 3, 10, 5, 7), grow: st(15, 1.4, 2.6, 0.8, 2.7, 1.4, 0.6),
    learn: [[0, 'slam'], [0, 'knock'], [0.2, 'swingwide'], [0.35, 'draft'], [0.6, 'hold'], [0.8, 'opensesame']], limit: 'threshold',
    colors: ['#9aa7b8', '#ff9a3c'],
  },
  {
    id: 'ledger', name: 'Ledger', cls: 'Auditor', joinChapter: 4, row: 1, weak: 'lumen', resist: 'umbra', stance: 'fierce',
    blurb: 'A retired dragon accountant. Believes every debt can be paid in time.',
    base: st(36, 16, 5, 11, 5, 8, 9), grow: st(10, 2.5, 1.2, 2.8, 1.5, 2.2, 0.75),
    learn: [[0, 'audit'], [0, 'interest'], [0.15, 'writeoff'], [0.3, 'deduct'], [0.5, 'bonus'], [0.75, 'bankrupt']], limit: 'liquidate',
    colors: ['#e8403a', '#f2e6c9'],
  },
  {
    id: 'route9', name: 'Route 9', cls: 'Spectre Driver', joinChapter: 5, row: 0, weak: 'lumen', resist: 'umbra', stance: 'swift',
    blurb: 'A ghost bus that misses its last passengers. Drives itself, mostly.',
    base: st(42, 10, 10, 4, 6, 5, 13), grow: st(11.5, 1.7, 2.7, 1.0, 1.7, 1.5, 1.05),
    learn: [[0, 'express'], [0, 'brakecheck'], [0.15, 'horn'], [0.35, 'laststop'], [0.55, 'nightbus'], [0.75, 'transfer']], limit: 'finalroute',
    colors: ['#6ef0c0', '#2a6b7a'],
  },
  {
    id: 'zug', name: 'Zug', cls: 'Gambit Witch', joinChapter: 6, row: 1, weak: 'bloom', resist: 'volt', stance: 'fierce',
    blurb: 'A witch assembled from chess pieces. Always three moves ahead, often wrong.',
    base: st(33, 18, 4, 12, 4, 8, 11), grow: st(9, 2.8, 1.0, 3.1, 1.2, 2.1, 0.9),
    learn: [[0, 'fork'], [0, 'pawnstorm'], [0.15, 'castle'], [0.3, 'enpassant'], [0.5, 'gambit'], [0.75, 'checkmate']], limit: 'stalemate',
    colors: ['#f4f0e0', '#8a3cff'],
  },
  {
    id: 'kiln', name: 'Kiln', cls: 'Star Smith', joinChapter: 7, row: 0, weak: 'frost', resist: 'ember', stance: 'steady',
    blurb: 'A smith who works inside a fallen star. Fixes things by making them hotter.',
    base: st(54, 9, 11, 4, 9, 6, 7), grow: st(14.5, 1.5, 2.8, 1.0, 2.4, 1.6, 0.6),
    learn: [[0, 'hammer'], [0, 'quench'], [0.15, 'slag'], [0.35, 'temper'], [0.55, 'anvil'], [0.8, 'foundry']], limit: 'starforge',
    colors: ['#ff7a1e', '#ffd84a'],
  },
  {
    id: 'ampere', name: 'Ampere', cls: 'Stormbound', joinChapter: 8, row: 1, weak: 'bloom', resist: 'volt', stance: 'fierce',
    blurb: 'A saint struck by lightning every dawn. Has started to enjoy it.',
    base: st(34, 14, 5, 12, 4, 6, 12), grow: st(9.5, 2.2, 1.2, 3.2, 1.2, 1.7, 1.0),
    learn: [[0, 'zap'], [0, 'arc'], [0.15, 'ground'], [0.3, 'surge'], [0.55, 'thunderhead'], [0.8, 'dawnstrike']], limit: 'tempest',
    colors: ['#ffe94a', '#3a4cff'],
  },
  {
    id: 'fennel', name: 'Fennel', cls: 'Pruner', joinChapter: 9, row: 0, weak: 'ember', resist: 'bloom', stance: 'fierce',
    blurb: 'The Archivist\'s gardener. Trims what will not stop growing.',
    base: st(40, 12, 10, 8, 6, 7, 11), grow: st(11, 2, 2.5, 2.0, 1.8, 1.9, 0.9),
    learn: [[0, 'snip'], [0, 'graft'], [0.15, 'thornwall'], [0.3, 'prune'], [0.5, 'compost'], [0.75, 'overgrow']], limit: 'harvest',
    colors: ['#58d66a', '#2a4a2a'],
  },
  {
    id: 'tick', name: 'Tick', cls: 'Chronomancer', joinChapter: 10, row: 1, weak: 'umbra', resist: 'lumen', stance: 'swift',
    blurb: 'A clockwork rabbit who is always slightly early and never on time.',
    base: st(34, 17, 5, 10, 4, 7, 15), grow: st(9.5, 2.6, 1.3, 2.6, 1.3, 1.9, 1.15),
    learn: [[0, 'tock'], [0, 'stall'], [0.15, 'minutehand'], [0.35, 'overtime'], [0.55, 'hourglass'], [0.8, 'lastsecond']], limit: 'stopclock',
    colors: ['#c8d0d8', '#ff5a9a'],
  },
  {
    id: 'ash', name: 'Ash', cls: 'Fledgling Phoenix', joinChapter: 11, row: 1, weak: 'frost', resist: 'ember', stance: 'steady',
    blurb: 'A phoenix egg that hatched early. Has only ever known endings, and is not bothered.',
    base: st(40, 15, 8, 11, 5, 8, 10), grow: st(11.5, 2.4, 2.4, 3.3, 1.6, 2.1, 0.9),
    learn: [[0, 'cinder'], [0, 'warmth'], [0.15, 'rekindle'], [0.3, 'ashfall'], [0.5, 'plume'], [0.75, 'fledge']], limit: 'pyre',
    colors: ['#ff8a3a', '#4a2a2a'],
  },
  {
    id: 'dusk', name: 'Dusk', cls: 'The Evening', joinChapter: 12, row: 1, weak: 'lumen', resist: 'umbra', stance: 'steady',
    blurb: 'The sunset itself, exiled for three hundred years. Tired. Kind. Overdue.',
    base: st(42, 16, 6, 12, 6, 8, 11), grow: st(11, 2.5, 1.6, 3.0, 1.7, 2.2, 0.9),
    learn: [[0, 'nightfall'], [0, 'lastlight'], [0.1, 'cooldown'], [0.25, 'embers2'], [0.5, 'eventide'], [0.75, 'curtain']], limit: 'theend',
    colors: ['#ff6a5a', '#3a1a5a'],
  },
];

export const CHAR: Record<string, CharDef> = Object.fromEntries(CHARS.map((c) => [c.id, c]));

/** Expected average party level at the start of each chapter (index 1..12). */
export const CHAPTER_LEVEL = [0, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
export const MAX_LEVEL = 40;
export const XP_NEED = (lvl: number) => Math.round(14 * Math.pow(lvl, 1.45));
