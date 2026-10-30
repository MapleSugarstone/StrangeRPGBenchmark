// The saved game: hero, party, flags, items, quests, and position. Plus settings, which live apart from saves.
import type { Attr, ClassId, Skill, Feeling } from '../rules/data';
import type { Dir } from '../world/map';
import type { Look } from '../art/people';

export type Difficulty = 'story' | 'runner' | 'flatline';

export interface Member {
  id: string;
  name: string;
  cls: Exclude<ClassId, 'enemy'>;
  level: number;
  xp: number;
  attr: Record<Attr, number>;
  skills: Record<Skill, number>;
  hp: number;
  gear: { melee?: string; ranged?: string; armor?: string; chrome: string[] };
  perks: string[];
  /** Uses spent per ability since the matching rest. */
  spent: Record<string, number>;
  edge: number;
  approval: number;
  mood?: Feeling;
  /** Points to spend: perks waiting, attribute raises waiting. */
  pendingPerks: number;
  pendingAttr: number;
  look?: Look;
  /** The member is downed after a fight and gets up at 1 HP. */
  downed?: boolean;
  /** Lost for good (died in a story event). */
  dead?: boolean;
}

export interface QuestState { stage: number; done?: boolean; failed?: boolean; log: string[]; seen?: boolean }

export interface Save {
  version: number;
  heroName: string;
  look: Look;
  cls: Exclude<ClassId, 'enemy' | 'unit' | 'witch'>;
  chapter: number;
  map: string;
  x: number;
  y: number;
  dir: Dir;
  party: string[];
  roster: Record<string, Member>;
  flags: Record<string, number>;
  gilt: number;
  items: Record<string, number>;
  quests: Record<string, QuestState>;
  port: { name: string; hold: number; self: number };
  difficulty: Difficulty;
  defeated: string[];
  looted: string[];
  shortRests: number;
  playtime: number;
  created: number;
  saved: number;
  /** Map and tile to return to after a camp visit. */
  campReturn?: { map: string; x: number; y: number };
  menu: Record<string, number>;
  district: string;
  /** The camp map, when it is not the barge. */
  campMap?: string;
  /** Sluice cards owned, by card id. */
  cards?: Record<string, number>;
  /** The hero's background id. */
  bg?: string;
  /** Faction standing, -10 to 10. */
  rep?: Record<string, number>;
  /** Relationships between companions, keyed by the two ids sorted and joined with a dash. */
  rel?: Record<string, number>;
  /** Seeds the world events, so each playthrough differs. */
  seed?: number;
  /** Lore entries found, in the order found. */
  lore?: string[];
}

export function blankSave(): Save {
  return {
    version: 1,
    heroName: 'Vos',
    look: { skin: 0, hair: 0, coat: 0, accent: 0, hairStyle: 'short' },
    cls: 'blade',
    chapter: 1,
    map: 'home',
    x: 0,
    y: 0,
    dir: 'down',
    party: ['hero'],
    roster: {},
    flags: {},
    gilt: 120,
    bg: 'runner',
    rep: {},
    rel: {},
    seed: (Math.random() * 2 ** 31) >>> 0,
    items: {},
    quests: {},
    port: { name: 'Lode', hold: 0, self: 0 },
    difficulty: 'runner',
    defeated: [],
    looted: [],
    shortRests: 2,
    playtime: 0,
    created: Date.now(),
    saved: 0,
    menu: {},
    district: 'The Deeps',
  };
}

/** The live save. Replaced wholesale on load. */
export let G: Save = blankSave();
export function setSave(s: Save) { G = s; }

export function flag(f: string): boolean {
  if (f.includes('|')) return f.split('|').some(flag);
  if (f.includes('&')) return f.split('&').every(flag);
  if (f.startsWith('!')) return !flag(f.slice(1));
  if (f.startsWith('party:')) return G.party.includes(f.slice(6));
  if (f.startsWith('roster:')) return !!G.roster[f.slice(7)] && !G.roster[f.slice(7)].dead;
  if (f.startsWith('class:')) return G.cls === f.slice(6);
  if (f.startsWith('bg:')) return (G.bg ?? 'runner') === f.slice(3);
  if (f.startsWith('rep:') || f.startsWith('rel:')) {
    const m = f.slice(4).match(/^([a-z-]+)(>=|<)(-?\d+)$/);
    if (!m) return false;
    const key = f.startsWith('rel:') ? m[1].split('-').sort().join('-') : m[1];
    const v = (f.startsWith('rel:') ? G.rel : G.rep)?.[key] ?? 0;
    return m[2] === '>=' ? v >= Number(m[3]) : v < Number(m[3]);
  }
  if (f.startsWith('approval:')) {
    const m = f.slice(9).match(/^([a-z]+)(>=|<)(-?\d+)$/);
    const a = m ? G.roster[m[1]]?.approval : undefined;
    if (!m || a === undefined) return false;
    return m[2] === '>=' ? a >= Number(m[3]) : a < Number(m[3]);
  }
  if (f.startsWith('chapter>=')) return G.chapter >= Number(f.slice(9));
  if (f.startsWith('chapter<')) return G.chapter < Number(f.slice(8));
  if (f.startsWith('quest:')) { const [id, st] = f.slice(6).split('='); const q = G.quests[id]; if (!q) return false; if (st === undefined) return true; if (st === 'done') return !!q.done; return q.stage >= Number(st); }
  if (f.startsWith('item:')) return (G.items[f.slice(5)] ?? 0) > 0;
  return !!G.flags[f];
}
export function setFlag(f: string, v = 1) { G.flags[f] = v; }
export function clearFlag(f: string) { delete G.flags[f]; }

export interface Settings { music: number; sfx: number; voice: number; textSpeed: number; slot: number; reduceShake: boolean }
export const SETTINGS: Settings = { music: 7, sfx: 8, voice: 7, textSpeed: 2, slot: 1, reduceShake: false };
const SKEY = 'fathom-settings';
export function loadSettings() {
  try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch { /* defaults */ }
}
export function saveSettings() {
  try { localStorage.setItem(SKEY, JSON.stringify(SETTINGS)); } catch { /* storage blocked */ }
}
