// The save file and everything that persists between battles and maps.
import { type Dish, type HeldConcept, type Layer, type SenseId, DISH_STOCK, STATE_FMAX, STATES } from '../battle/model';
import { ENEMIES } from '../battle/enemies';

export type Avatar = 'snake' | 'dice' | 'wire';

export interface Save {
  v: 1;
  avatar: Avatar;
  map: string; x: number; y: number; dir: number;
  f: number;
  state: number;
  up: number;
  flags: Record<string, number>;
  senses: Partial<Record<SenseId, number>>;
  vorn: { hp: number; max: number; atk: number; lastStand: boolean } | null;
  lb: { hp: number; max: number; pantry: Record<Dish, number> } | null;
  /** Kinds of shell held, by count. */
  shells: Record<string, number>;
  /** Memories held for use, by label, and the story memories read. */
  memories: Record<string, number>;
  emotions: Record<string, number>;
  names: Record<string, number>;
  concepts: string[];
  /** Totals ever collected, for the four side quests. */
  totals: Record<Layer, number>;
  worn: string | null;
  slots: string[];
  revealed: Record<string, string>;
  gone: string[];
  steady: { map: string; x: number; y: number };
  time: number;
  lastSense: SenseId | null;
  mood: string;
  cursors: Record<string, number>;
  log: string[];
}

export const SAVE_KEY = 'voidpilgrim.save';

export function fresh(avatar: Avatar): Save {
  return {
    v: 1, avatar, map: 'plaza', x: 16, y: 10, dir: 0, f: 24, state: 0, up: 0, flags: {},
    senses: { sight: 1, touch: 1 }, vorn: null, lb: null,
    shells: {}, memories: {}, emotions: {}, names: {}, concepts: [], totals: { shell: 0, memory: 0, emotion: 0, name: 0 },
    worn: null, slots: [], revealed: {}, gone: [], steady: { map: 'plaza', x: 16, y: 10 }, time: 0, lastSense: null, mood: 'none', cursors: {}, log: [],
  };
}

export let S: Save = fresh('snake');
export function setSave(s: Save): void { S = s; }

export function fmax(): number { return STATE_FMAX[S.state] + Math.floor(S.up / 10); }
export function stateName(): string { return STATES[S.state]; }
export function flag(k: string): number { return S.flags[k] || 0; }
export function setFlag(k: string, v = 1): void { S.flags[k] = v; }

/** Concept slots grow with the Unraveling. */
export function slotCount(): number { return S.state >= 5 ? 3 : S.state >= 4 ? 2 : 1; }

export function vornFull(): { hp: number; max: number; atk: number; lastStand: boolean } {
  const ch = Math.max(1, chapter());
  const max = 60 + ch * 25, atk = 32 + ch * 14;
  return { hp: max, max, atk, lastStand: ch >= 4 };
}
export function lbFull(): { hp: number; max: number; pantry: Record<Dish, number> } {
  const max = 26 + chapter() * 8;
  return { hp: max, max, pantry: { ...DISH_STOCK } };
}

/** Which chapter the save is in, from story flags. */
export function chapter(): number {
  if (flag('ch5')) return 5;
  if (flag('ch4')) return 4;
  if (flag('ch3')) return 3;
  if (flag('ch2')) return 2;
  return 1;
}

/** Adds the concepts a battle removed to the Collector. Returns milestone messages. */
export function collect(items: HeldConcept[]): void {
  for (const c of items) {
    S.totals[c.layer] = (S.totals[c.layer] || 0) + 1;
    if (c.layer === 'shell') { const k = ENEMIES[c.from]?.shellKind; if (k) S.shells[k] = (S.shells[k] || 0) + 1; }
    else if (c.layer === 'memory') S.memories[c.label] = (S.memories[c.label] || 0) + 1;
    else if (c.layer === 'emotion') { const e = c.emotion || c.label; S.emotions[e] = (S.emotions[e] || 0) + 1; }
    else S.names[c.label] = (S.names[c.label] || 0) + 1;
  }
}


/** Sets Fragility to the steady point, as at a steam fountain. */
export function steady(): void {
  const mid = S.slots.includes('Wholeness') ? 0.7 : 0.6;
  S.f = Math.round(fmax() * mid);
  if (S.vorn) { const v = vornFull(); S.vorn = { ...v, hp: v.max }; }
  if (S.lb) S.lb = lbFull();
}

export function writeSave(): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch { return false; }
}

export function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if (s.v !== 1) return null;
    return s;
  } catch { return null; }
}

export function hasSave(): boolean { return readSave() !== null; }
