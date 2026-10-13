import type { MapDef, Goal } from './types';

export const MAPS: Record<string, MapDef> = {};
export function addMaps(list: MapDef[]): void { for (const m of list) MAPS[m.id] = m; }

let goalFn: () => Goal = () => ({ text: 'Keep going.' });
export function setGoalFn(f: () => Goal): void { goalFn = f; }
export function goal(): Goal { return goalFn(); }

export type Mode = 'title' | 'field' | 'battle' | 'menu' | 'ending' | 'choose';
export const game = { mode: 'title' as Mode, tick: 0, shake: 0, flash: 0, flashColor: '#ffffff', fade: 0, fadeTarget: 0 };
