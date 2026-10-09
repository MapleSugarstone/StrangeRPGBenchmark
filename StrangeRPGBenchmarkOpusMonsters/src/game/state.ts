import type { Mon } from '../battle/model';
import { setUidFloor, SPECIES } from '../data/species';
import { halveLevel, LEVEL_MAX, xpToNext } from '../data/types';
import { FORMER_NAMES } from '../data/formernames';
import type { Machine } from './setting/core';

export type PegKind = 'twig' | 'brass' | 'bone' | 'iron';

/** The hero's name in every line the game writes itself. */
export const HERO = 'Ouro';
/** Player-facing names for the four horns, weakest first. */
export const HORN_NAME: Record<PegKind, string> = { twig: 'Periwinkle horn', brass: 'Whelk horn', bone: 'Triton horn', iron: 'Nautilus horn' };
/** What a grotto charges for each horn it sells. Nautilus horns are only found. */
export const HORN_PRICE = { twig: 20, brass: 60, bone: 150 } as const;

export interface Save {
  v: number;
  /** The name the player gave the hero. Game text says "Ouro" and the font swaps this in. */
  name: string;
  map: string;
  x: number;
  y: number;
  dir: number;
  party: Mon[];
  rack: Mon[];
  pegs: Record<PegKind, number>;
  notions: Record<string, number>;
  keys: string[];
  /** Things in the Bag that are neither horns, notions, nor key items: field items and things to sell. */
  items: Record<string, number>;
  rind: number;
  /** Tan: spent at a tannery to raise one stat of one slough. */
  tan: number;
  /** Whorls Ouro left sitting in shells on the Strand, by map and shell id. */
  shellMons: Record<string, Mon>;
  flags: Record<string, number>;
  register: Record<string, number>;
  scales: string[];
  charm: string | null;
  pulled: string[];
  fitCount: number;
  fits: { name: string; a: string; b: string }[];
  time: number;
  stackBest: number;
  beaten: Record<string, number>;
  lastTannery: { map: string; x: number; y: number };
  /** difficulty: 0 Normal, 1 Challenge, 2 Hard. Older saves have none and play Normal. */
  opts: { music: number; sfx: number; speed: number; difficulty?: number };
  gem: GemSave;
}

/** The Setting board: sketches found, puzzles solved, best scores, the machine left on each puzzle, and how often Ouro played. */
export interface GemSave {
  found: string[];
  solved: string[];
  /** Best cycles, cost, and area for each solved puzzle. Each is kept on its own. */
  best: Record<string, { c: number; k: number; a: number }>;
  mach: Record<string, Machine>;
  /** Machines Ouro set running. */
  runs: number;
  /** Runs that delivered every piece. */
  wins: number;
}

/** Save files live in numbered slots. The single save from before slots becomes slot 1. */
export const SLOTS = 3;
const LEGACY_KEY = 'slough-save-v1';
const keyOf = (n: number): string => 'whorl-save-' + n;
let slot = 1;
export function useSlot(n: number): void { slot = n; }
export function slotNow(): number { return slot; }

export function fresh(): Save {
  return {
    v: 2, name: HERO, map: 'home', x: 4, y: 4, dir: 0, party: [], rack: [],
    pegs: { twig: 0, brass: 0, bone: 0, iron: 0 }, notions: {}, keys: [], items: {}, rind: 100, tan: 0, shellMons: {},
    flags: {}, register: {}, scales: [], charm: null, pulled: [], fitCount: 0, fits: [], time: 0, stackBest: 0, beaten: {},
    lastTannery: { map: 'home', x: 4, y: 4 }, opts: { music: 0.6, sfx: 0.7, speed: 1 },
    gem: { found: [], solved: [], best: {}, mach: {}, runs: 0, wins: 0 },
  };
}

export let G: Save = fresh();

export function setGame(s: Save): void {
  G = s;
  let max = 0;
  for (const m of [...s.party, ...s.rack]) max = Math.max(max, m.uid);
  setUidFloor(max);
}

export function save(): void {
  try { localStorage.setItem(keyOf(slot), JSON.stringify(G)); } catch { /* storage may be blocked */ }
}

/** Saves from before version 2 hold levels on the old 1 to 100 scale. */
function halveSave(s: Save): void {
  for (const m of [...(s.party || []), ...(s.rack || []), ...Object.values(s.shellMons || {})]) {
    if (!m) continue;
    m.level = halveLevel(m.level); m.xp = 0;
    if (m.strand) { m.strand.level = halveLevel(m.strand.level); m.strand.xp = 0; }
  }
  s.v = 2;
}

/** A whorl that still carries its kind's name from before the rename takes the new one. Names the player gave are kept. */
function renameSave(s: Save): void {
  for (const m of [...(s.party || []), ...(s.rack || []), ...Object.values(s.shellMons || {})]) {
    if (m && !m.fitted && FORMER_NAMES[m.kind] === m.name && SPECIES[m.kind]) m.name = SPECIES[m.kind].name;
  }
}

function migrate(): void {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old && !localStorage.getItem(keyOf(1))) localStorage.setItem(keyOf(1), old);
    if (old) localStorage.removeItem(LEGACY_KEY);
  } catch { /* storage may be blocked */ }
}

export function load(n = slot): Save | null {
  migrate();
  try {
    const raw = localStorage.getItem(keyOf(n));
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if ((s.v || 1) < 2) halveSave(s);
    renameSave(s);
    return { ...fresh(), ...s, opts: { ...fresh().opts, ...(s.opts || {}) }, gem: { ...fresh().gem, ...(s.gem || {}) } };
  } catch { return null; }
}

export function hasSave(): boolean {
  for (let n = 1; n <= SLOTS; n++) if (load(n)) return true;
  return false;
}

/** What a slot shows on the file screen, or null when it is empty. */
export function slotInfo(n: number): { name: string; where: string; time: number; lead: Mon | null } | null {
  const s = load(n);
  if (!s) return null;
  const where = s.flags.a2 ? `The Strand, chapter ${(s.flags.a2pearls || 0) + 1}` : `Chapter ${s.scales.length + 1}`;
  return { name: s.name || HERO, where, time: s.time, lead: s.party[0] || null };
}

export function heroName(): string { return G.name || HERO; }

export function flag(k: string): number { return G.flags[k] || 0; }
export function setFlag(k: string, v = 1): void { G.flags[k] = v; }

export function chapter(): number { return G.scales.length + 1; }

/** Whether Ouro is on the Strand right now. The field sets it on every map load. */
export const scaleNow = { strand: false };
export const STRAND_START = 3;
/** Strand level caps by Act 2 pearls held. */
export const STRAND_CAPS = [8, 13, 18, 23, 28, 35, 50];
export function strandCap(): number { return STRAND_CAPS[Math.min(STRAND_CAPS.length - 1, G.flags.a2pearls || 0)]; }

/** A whorl's level where Ouro is now. */
export function levelOf(m: Mon): number { return scaleNow.strand && m.strand ? m.strand.level : m.level; }

/** Gives experience at the current scale and returns the levels reached. */
export function giveXp(m: Mon, xp: number): number[] {
  const strand = scaleNow.strand && !!m.strand;
  const cap = strand ? strandCap() : levelCap();
  const s = strand ? m.strand! : m;
  const reached: number[] = [];
  if (s.level >= cap) { s.xp = 0; return reached; }
  s.xp += xp;
  while (s.level < cap && s.xp >= xpToNext(s.level)) { s.xp -= xpToNext(s.level); s.level++; reached.push(s.level); }
  if (s.level >= cap) s.xp = 0;
  return reached;
}

/** The cap that applies where Ouro is now. */
export function capHere(): number { return scaleNow.strand ? strandCap() : levelCap(); }

/** The highest level a slough can reach with this many scales. One above the next keeper's strongest slough. */
export const CAPS = [5, 9, 10, 13, 15, 19, 22, 25, 29];
export function levelCap(): number {
  if (G.flags.postgame) return LEVEL_MAX;
  return CAPS[Math.min(CAPS.length - 1, G.scales.length)];
}

export function seen(kind: string): void {
  if (!SPECIES[kind]) return;
  if (!G.register[kind]) G.register[kind] = 1;
}
export function owned(kind: string): void {
  if (!SPECIES[kind]) return;
  G.register[kind] = 2;
}

/** Stays that have come loose, by story or by Vellum. */
export function loosened(): number { return G.pulled.length; }
/** Stays Vellum pulled with their own hands. */
export function vellumPulls(): number { return G.pulled.filter(p => G.flags['pulledBy_' + p]).length; }

export function nerveUnlocked(): boolean { return G.scales.length >= 1 && !!G.flags.nerve; }
export function fittingUnlocked(): boolean { return !!G.flags.fitting; }
export function notionsUnlocked(): boolean { return !!G.flags.notions; }
export function wearingUnlocked(): boolean { return !!G.flags.wearing; }
export function charmsUnlocked(): boolean { return !!G.flags.charms; }

export function addMon(m: Mon): 'party' | 'rack' {
  owned(m.kind);
  if (G.party.length < 4) { G.party.push(m); return 'party'; }
  G.rack.push(m);
  return 'rack';
}

export const DIFFICULTY_NAMES = ['Normal', 'Challenge', 'Hard'];
export const DIFFICULTY_TEXT = [
  'Foes are the levels the story sets.',
  'Every foe is 10% higher in level and fights smarter.',
  'Every foe is 20% higher in level plus 1, and fights as well as a champion.',
];
/** A foe's level on the current difficulty, wild whorls included. */
export function foeLevel(level: number): number {
  const d = G.opts.difficulty || 0;
  return d === 2 ? Math.ceil(level * 1.2) + 1 : d === 1 ? Math.ceil(level * 1.1) : level;
}
