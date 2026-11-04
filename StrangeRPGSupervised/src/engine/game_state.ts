import type { FusedSpecies } from "./fusion.js";
import type { PuzzleState } from "./puzzles.js";
export type GameState = {
  chapter: number;
  flags: Record<string, boolean>;
  party: string[];
  partyLevels: number[];
  partyExp?: number[];
  partyHp?: number[];
  /** Quench layers per team member: how many times each stat was raised. */
  partyQuench?: Quench[];
  /** Ruin caught while the party was full, each with its level, experience, quench layers, and own name. */
  storage?: { key: string; level: number; exp: number; quench?: Quench; name?: string }[];
  /** Each team member's own name, or empty for its species name. */
  partyNames?: string[];
  /** Field puzzles in progress, by map. */
  puzzles?: Record<string, PuzzleState>;
  /** Species met in battle and species ever held, for the Register. */
  seen?: string[];
  caught?: string[];
  /** Lines to show when the field next opens, such as a beaten companion's gift line or a Keeper's Resonance. */
  pending?: { speaker: string; line: string } | { speaker: string; line: string }[];
  /** Ruin made at the Forge, by their species key (fusion_1, fusion_2, ...). */
  fusions?: Record<string, FusedSpecies>;
  /** The Resonances won from Keepers (by Keeper name) and the one worn. */
  resonance?: { owned: string[]; worn?: string };
  bag: Record<string, number>;
  mapId: string;
  playerX: number;
  playerY: number;
  playerDir: "up" | "down" | "left" | "right";
  encounterStepCount: number;
  lastBattleWon: boolean;
};

export function newGameState(): GameState {
  return {
    chapter: 1,
    flags: {},
    party: ["glass_sentinel"],
    partyLevels: [5],
    partyExp: [0],
    bag: { cinder: 100 },
    mapId: "ashen_reach_1",
    playerX: 15,
    playerY: 10,
    playerDir: "down",
    encounterStepCount: 0,
    lastBattleWon: false,
  };
}

export function saveGame(state: GameState): void {
  localStorage.setItem("ruin_save", JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const data = localStorage.getItem("ruin_save");
  if (!data) return null;
  try {
    return JSON.parse(data) as GameState;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return !!localStorage.getItem("ruin_save");
}

/** Adds a Ruin to the party, or to storage in the bag when the party holds four. */
/** Marks a species as met in battle, for the Register. */
export function noteSeen(state: GameState, species: string): void {
  if (!(state.seen ??= []).includes(species)) state.seen.push(species);
}

export function addToParty(state: GameState, species: string, level: number, hp?: number): void {
  noteSeen(state, species);
  if (!(state.caught ??= []).includes(species)) state.caught.push(species);
  if (state.party.length < 4) {
    state.party.push(species);
    state.partyLevels.push(level);
    (state.partyExp ??= state.party.map(() => 0)).push(0);
    if (state.partyHp) state.partyHp.push(hp ?? 9999);
    if (state.partyQuench) state.partyQuench[state.party.length - 1] = {};
    if (state.partyNames) state.partyNames[state.party.length - 1] = "";
  } else {
    (state.storage ??= []).push({ key: species, level, exp: 0 });
  }
}

/** Moves Ruin that older saves kept as bag counts into storage, at the level of the party's lowest member. */
export function settleStorage(state: GameState, isSpecies: (key: string) => boolean): void {
  const level = Math.min(...(state.partyLevels.length ? state.partyLevels : [5]));
  for (const [key, count] of Object.entries(state.bag ?? {})) {
    if (!isSpecies(key)) continue;
    for (let i = 0; i < count; i++) (state.storage ??= []).push({ key, level, exp: 0 });
    delete state.bag[key];
  }
}

/** Swaps two team members' places, with their levels, experience, HP, and quench layers. The first place leads. */
export function swapInParty(state: GameState, a: number, b: number): void {
  const n = state.party.length;
  if (a < 0 || b < 0 || a >= n || b >= n) return;
  const lists = [state.party, state.partyLevels, state.partyExp, state.partyHp, state.partyQuench, state.partyNames] as (unknown[] | undefined)[];
  for (const list of lists) {
    if (list) [list[a], list[b]] = [list[b], list[a]];
  }
}

/** Swaps a party Ruin with a stored one; the one going into storage keeps its level, experience, and quench layers,
 * and rests. */
export function swapWithStorage(state: GameState, slot: number, stored: number): boolean {
  const box = state.storage?.[stored];
  if (!box || slot < 0 || slot >= state.party.length) return false;
  const layers = state.partyQuench?.[slot];
  const own = state.partyNames?.[slot];
  const out = { key: state.party[slot], level: state.partyLevels[slot] ?? 5, exp: state.partyExp?.[slot] ?? 0, ...(quenchLayers(layers) ? { quench: layers } : {}), ...(own ? { name: own } : {}) };
  state.party[slot] = box.key;
  state.partyLevels[slot] = box.level;
  (state.partyExp ??= state.party.map(() => 0))[slot] = box.exp;
  if (state.partyHp) state.partyHp[slot] = 9999;
  if (state.partyQuench || box.quench) (state.partyQuench ??= state.party.map(() => ({})))[slot] = box.quench ?? {};
  if (state.partyNames || box.name) (state.partyNames ??= state.party.map(() => ""))[slot] = box.name ?? "";
  state.storage![stored] = out;
  return true;
}

/** The stats quenching can raise, each layer by 2% (design/systems.md, section 4). */
export const QUENCH_STATS = ["atk", "def", "res", "mgk", "agi"] as const;
export type QuenchStat = (typeof QUENCH_STATS)[number];
export type Quench = Partial<Record<QuenchStat, number>>;
export const QUENCH_PRICE = 100;
export const QUENCH_MAX = 10;
export const QUENCH_STEP = 0.02;

export function quenchLayers(q: Quench | undefined): number {
  return QUENCH_STATS.reduce((sum, s) => sum + (q?.[s] ?? 0), 0);
}

/** Buys one layer on a team member's stat. Returns what stopped it, or null when it was bought. */
export function quench(state: GameState, slot: number, stat: QuenchStat): "full" | "poor" | null {
  const list: Quench[] = (state.partyQuench ??= state.party.map(() => ({})));
  while (list.length < state.party.length) list.push({});
  const q: Quench = (list[slot] ??= {});
  if (quenchLayers(q) >= QUENCH_MAX) return "full";
  if ((state.bag.cinder ?? 0) < QUENCH_PRICE) return "poor";
  state.bag.cinder -= QUENCH_PRICE;
  q[stat] = (q[stat] ?? 0) + 1;
  return null;
}
