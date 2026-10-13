// Combat numbers and formulas. No DOM access, so tools/sim.ts can import this file.

import { story } from './story';

export type Rng = () => number;

export const roll = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export type Effect = 'wall' | 'counter' | 'well' | 'all';

export interface Ability {
  cost: number;
  effect?: Effect;
  hit?: (atk: number, def: number, rng: Rng) => number;
}

export const ABILITIES: Record<string, Ability> = {
  'Attack':        { cost: 0, hit: (a, d, r) => Math.floor(a * 0.8) - Math.floor(d * 0.2) + roll(r, 0, 4) },
  'Dream Slash':   { cost: 0, hit: (a, d) => a - Math.floor(d / 2) },
  'Starlight':     { cost: 5, hit: (a, d, r) => Math.floor(a * 1.5) - Math.floor(d / 2) + roll(r, 0, 3) },
  'Reality Tear':  { cost: 12, hit: (a, _d, r) => roll(r, Math.floor(a * 0.5), a * 3) },
  'Shield Bash':   { cost: 3, hit: (a, d, r) => Math.floor(a * 1.5) - Math.floor(d / 2) + roll(r, 0, 3) },
  'Iron Wall':     { cost: 4, effect: 'wall' },
  'Counterstrike': { cost: 5, effect: 'counter', hit: (a, d) => a - Math.floor(d / 2) },
  'Nova Burst':    { cost: 4, effect: 'all', hit: (a, _d, r) => 8 + a + roll(r, 0, 4) },
  'Moonbeam':      { cost: 8, hit: (a, _d, r) => 12 + Math.floor(a * 1.6) + roll(r, 0, 6) },
  'Gravity Well':  { cost: 6, effect: 'well', hit: (a) => a },
};

/** Damage to an enemy, with Gravity Well's bonus applied. */
export function heroDamage(ability: string, atk: number, def: number, well: boolean, rng: Rng): number {
  const a = ABILITIES[ability];
  if (!a?.hit) return 0;
  const dmg = Math.max(1, a.hit(atk, def, rng));
  return well ? Math.floor(dmg * 1.5) : dmg;
}

/** Damage to a party member, with Iron Wall's halving applied. */
export function enemyDamage(atk: number, def: number, wall: boolean, rng: Rng): number {
  const dmg = Math.max(2, Math.floor(atk * 0.7) - Math.floor(def * 0.3) + roll(rng, -1, 2));
  return wall ? Math.max(1, Math.floor(dmg / 2)) : dmg;
}

export interface EnemyTemplate { name: string; hp: number; atk: number; def: number; speed: number; sprite: string; quote?: string }

export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  shadow_wolf:   { name: 'Shadow Wolf', hp: 30, atk: 8, def: 2, speed: 5, sprite: 'ghost', quote: 'You smell like home.' },
  void_spider:   { name: 'Void Spider', hp: 25, atk: 12, def: 1, speed: 3, sprite: 'void', quote: 'Tick tick tick.' },
  crystal_golem: { name: 'Crystal Golem', hp: 50, atk: 6, def: 4, speed: 2, sprite: 'crystal', quote: 'The forest remembers you.' },
  steam_rat:     { name: 'Steam Rat', hp: 20, atk: 10, def: 1, speed: 8, sprite: 'robot', quote: 'Tick tock tick tock.' },
  nightmare_fish:{ name: 'Nightmare Fish', hp: 35, atk: 7, def: 2, speed: 4, sprite: 'slime', quote: 'Dream me a better dream.' },
  star_vampire:  { name: 'Star Vampire', hp: 40, atk: 15, def: 3, speed: 6, sprite: 'dragon', quote: 'You taste like home.' },
};

/** Enemy types that appear in each chapter's rooms. */
export const ENEMY_POOLS: string[][] = [
  ['shadow_wolf', 'void_spider'],
  ['crystal_golem', 'void_spider'],
  ['steam_rat', 'crystal_golem'],
  ['nightmare_fish', 'steam_rat'],
  ['star_vampire', 'nightmare_fish'],
  Object.keys(ENEMY_TEMPLATES),
];

export interface Foe {
  name: string; hp: number; maxHp: number; atk: number; def: number; speed: number;
  spriteType: string; quote: string; boss: boolean; xp: number;
}

export function makeEnemy(type: string, chapter: number): Foe {
  const t = ENEMY_TEMPLATES[type];
  const hp = Math.floor(t.hp * (1.2 + chapter * 0.8));
  return {
    name: t.name, hp, maxHp: hp,
    atk: Math.floor(t.atk * (1.3 + chapter * 0.8)), def: Math.floor(t.def * (1 + chapter * 0.6)), speed: t.speed,
    spriteType: t.sprite, quote: t.quote || '', boss: false, xp: 5 + chapter * 3,
  };
}

const BOSS_STATS = [
  { hp: 120, atk: 13, def: 4, speed: 3, sprite: 'door' },
  { hp: 440, atk: 31, def: 7, speed: 4, sprite: 'ghost' },
  { hp: 1100, atk: 48, def: 10, speed: 5, sprite: 'robot' },
  { hp: 1300, atk: 57, def: 12, speed: 6, sprite: 'slime' },
  { hp: 1450, atk: 61, def: 14, speed: 7, sprite: 'void' },
  { hp: 1700, atk: 70, def: 16, speed: 8, sprite: 'hero' },
];

export function bossSprite(chapter: number): string {
  return BOSS_STATS[Math.min(chapter, BOSS_STATS.length - 1)].sprite;
}

// Party level each boss is tuned for. Bosses move part of the way toward the party's real level.
const BOSS_LEVEL = [1, 3, 5, 7, 9, 10];

export function makeBoss(chapter: number, partyLevel: number): Foe {
  const i = Math.min(chapter, BOSS_STATS.length - 1);
  const b = BOSS_STATS[i];
  const info = story.bosses[i];
  const f = Math.max(0.55, Math.min(1.4, 1 + 0.08 * (partyLevel - BOSS_LEVEL[i])));
  const hp = Math.round(b.hp * f);
  return {
    name: info.name, hp, maxHp: hp, atk: Math.round(b.atk * f), def: b.def, speed: b.speed,
    spriteType: b.sprite, quote: info.quote, boss: true, xp: 20 + chapter * 12,
  };
}

/** A random group for one encounter. Groups grow with the party. */
export function makeEncounter(chapter: number, partySize: number, rng: Rng): Foe[] {
  const pool = ENEMY_POOLS[Math.min(chapter, ENEMY_POOLS.length - 1)];
  const count = chapter === 0 ? 1 : 1 + Math.floor(rng() * Math.min(partySize, 3));
  const foes: Foe[] = [];
  for (let i = 0; i < count; i++) foes.push(makeEnemy(pool[Math.floor(rng() * pool.length)], chapter));
  return foes;
}

/** The lowest party level at the start of each chapter, so a party that skips fights can still win. */
export const LEVEL_FLOOR = [1, 2, 4, 5, 7, 8];

export function fleeChance(partySpeed: number, enemySpeed: number): number {
  return Math.max(0.25, Math.min(0.9, 0.55 + (partySpeed - enemySpeed) * 0.04));
}
