import type { Pal3, Hue } from '../core/palette';
import { huesOf } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';

export interface Stats { hp: number; ink: number; str: number; def: number; mnd: number; spd: number }

export interface MemberDef {
  id: string;
  name: string;
  title: string;
  pal: Pal3;
  sprite: SpriteSpec;
  mult: Stats;
  learn: [number, string][];
  weapon: string;
  bio: string;
}

const human = (seed: string, pal: Pal3, o: Record<string, string>): SpriteSpec => ({ g: 'human', seed, pal, o });
const beast = (kind: string, pal: Pal3): SpriteSpec => ({ g: 'beast', pal, o: { kind } });

export const MEMBERS: Record<string, MemberDef> = {
  wick: {
    id: 'wick', name: 'Wick', title: 'Lamplighter',
    pal: ['k', 'o2', 'o2'],
    sprite: human('wick', ['k', 'o2', 'o2'], { head: 'hair', torso: 'arms', legs: 'legs', held: 'lamp' }),
    mult: { hp: 1.0, ink: 1.0, str: 1.05, def: 1.0, mnd: 1.0, spd: 1.0 },
    learn: [[1, 'kindle'], [3, 'lampsweep'], [9, 'wickflare'], [13, 'snuff'], [17, 'beacon'], [23, 'lighthouse']],
    weapon: 'pole',
    bio: 'A Duotone printed with black and amber only. Keeps the Edge Lamps.',
  },
  nona: {
    id: 'nona', name: 'Nona', title: 'Maintenance Cat',
    pal: ['k', 'c2', 'w'],
    sprite: beast('nona', ['k', 'c2', 'w']),
    mult: { hp: 0.9, ink: 1.3, str: 0.8, def: 0.9, mnd: 1.2, spd: 1.15 },
    learn: [[1, 'patch'], [1, 'diagnose'], [1, 'ninth_life'], [5, 'purr_loop'], [8, 'static_claw'], [12, 'firmware'], [16, 'cleanse'], [21, 'overclock']],
    weapon: 'claw',
    bio: 'A nine-tailed drone that fell from the Loom. Each tail is a spool of reserve ink.',
  },
  tint: {
    id: 'tint', name: 'Tint', title: 'Hue-Witch',
    pal: ['k', 'm2', 'e3'],
    sprite: human('tint', ['k', 'm2', 'e3'], { head: 'bubble', torso: 'robe', legs: 'skirt', held: 'brush' }),
    mult: { hp: 0.85, ink: 1.2, str: 0.8, def: 0.85, mnd: 1.25, spd: 1.1 },
    learn: [[1, 'load'], [1, 'daub'], [1, 'splash'], [10, 'primer'], [13, 'wash'], [17, 'gallery'], [24, 'spectrum']],
    weapon: 'brush',
    bio: 'Rides a paintbrush and paints over whatever the grey touches.',
  },
  brask: {
    id: 'brask', name: 'Brask', title: 'Moth Knight',
    pal: ['k', 'b2', 'y3'],
    sprite: human('brask', ['k', 'b2', 'y3'], { head: 'helm', torso: 'armor', legs: 'stance', held: 'sword' }),
    mult: { hp: 1.35, ink: 0.75, str: 1.15, def: 1.35, mnd: 0.6, spd: 0.8 },
    learn: [[1, 'crush'], [1, 'moth_curtain'], [13, 'swarm'], [15, 'carapace'], [19, 'lance'], [24, 'molt']],
    weapon: 'blade',
    bio: 'Empty templar armor full of moths. The moths follow Wick\'s lamp.',
  },
  tock: {
    id: 'tock', name: 'Tock', title: 'Backward Monk',
    pal: ['k', 'e2', 'r3'],
    sprite: beast('monk', ['k', 'e2', 'r3']),
    mult: { hp: 0.95, ink: 1.1, str: 0.95, def: 0.95, mnd: 1.05, spd: 1.3 },
    learn: [[1, 'tick'], [1, 'delay'], [1, 'hasten'], [17, 'rewind'], [21, 'stopwatch'], [25, 'paradox']],
    weapon: 'hand',
    bio: 'A clockwork monk who lives backward. He met you at the end of his life.',
  },
  vend: {
    id: 'vend', name: 'VEND', title: 'Coin Golem',
    pal: ['k', 'r2', 'c3'],
    sprite: beast('vend', ['k', 'r2', 'c3']),
    mult: { hp: 1.2, ink: 0.3, str: 1.1, def: 1.2, mnd: 0.9, spd: 0.85 },
    learn: [[1, 'coin_shot'], [1, 'dispense'], [1, 'jackpot'], [21, 'buyout'], [23, 'restock'], [26, 'tariff']],
    weapon: 'slot',
    bio: 'A vending machine who wants to buy his own freedom. Pays for everything.',
  },
  mirrow: {
    id: 'mirrow', name: 'Mirrow', title: 'Glass Captain',
    pal: ['k', 'b3', 'w'],
    sprite: beast('mirror', ['k', 'b3', 'w']),
    mult: { hp: 1.0, ink: 1.1, str: 1.0, def: 1.0, mnd: 1.1, spd: 1.1 },
    learn: [[1, 'reflect'], [1, 'shard'], [1, 'glass_guard'], [26, 'silver_back'], [28, 'invert']],
    weapon: 'glass',
    bio: 'A reflection that left its mirror. Captains a skiff on the cloud sea.',
  },
  nil: {
    id: 'nil', name: 'Nil', title: 'Blank',
    pal: ['k', 'g2', 'g3'],
    sprite: beast('blank', ['k', 'g2', 'g3']),
    mult: { hp: 1.1, ink: 1.2, str: 1.0, def: 1.0, mnd: 1.05, spd: 1.0 },
    learn: [[1, 'blank_stare'], [1, 'void_touch'], [1, 'nullify'], [30, 'unprint']],
    weapon: 'none',
    bio: 'A Blank who never had a color. Learns what hits it.',
  },
};

export const MEMBER_ORDER = ['wick', 'nona', 'tint', 'brask', 'tock', 'vend', 'mirrow', 'nil'];

export function memberHues(id: string): Hue[] {
  const m = MEMBERS[id];
  if (id === 'wick') return ['Y', 'N'];
  return huesOf(m.pal);
}

/** Base stats before gear for a standard character at `lvl`. */
export function baseStats(lvl: number): Stats {
  const l = lvl - 1;
  return {
    hp: 34 + 8.5 * l,
    ink: 12 + 1.6 * l,
    str: 9 + 1.7 * l,
    def: 7 + 1.35 * l,
    mnd: 9 + 1.7 * l,
    spd: 9 + 0.8 * l,
  };
}

export function statsAt(id: string, lvl: number): Stats {
  const b = baseStats(lvl);
  const m = MEMBERS[id].mult;
  return {
    hp: Math.round(b.hp * m.hp),
    ink: Math.round(b.ink * m.ink),
    str: Math.round(b.str * m.str),
    def: Math.round(b.def * m.def),
    mnd: Math.round(b.mnd * m.mnd),
    spd: Math.round(b.spd * m.spd),
  };
}

export function xpToNext(lvl: number): number {
  return Math.round(12 * Math.pow(lvl, 1.55));
}

export function skillsAt(id: string, lvl: number): string[] {
  return MEMBERS[id].learn.filter(([l]) => l <= lvl).map(([, s]) => s);
}
