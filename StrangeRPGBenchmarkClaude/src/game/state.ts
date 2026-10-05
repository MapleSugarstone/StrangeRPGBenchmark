import { MEMBERS, statsAt, xpToNext, skillsAt, Stats } from '../data/members';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import type { Hue } from '../core/palette';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface MemberState {
  id: string;
  lvl: number;
  xp: number;
  hp: number;
  ink: number;
  tails: number;
  weapon: string;
  charm: string;
  echo: string[];
  lost?: string[];
}

export interface GameState {
  v: 1;
  chapter: number;
  map: string;
  x: number;
  y: number;
  facing: Dir;
  party: string[];
  reserve: string[];
  members: Record<string, MemberState>;
  items: Record<string, number>;
  gold: number;
  flags: Record<string, number | string | boolean>;
  mech: string[];
  steps: number;
  frames: number;
  tint: Hue | '';
  past: boolean;
  log: BattleLog[];
}

export interface BattleLog {
  ch: number;
  group: string;
  result: string;
  turns: number;
  minFrac: number;
  lvl: number;
}

export const MAX_PARTY = 4;

export function newMember(id: string, lvl: number): MemberState {
  const s = statsAt(id, lvl);
  const weapon = `${MEMBERS[id].weapon}0`;
  return { id, lvl, xp: 0, hp: s.hp, ink: s.ink, tails: id === 'nona' ? 9 : 0, weapon, charm: '', echo: [] };
}

export function newGame(): GameState {
  return {
    v: 1, chapter: 1, map: 'edgewick', x: 12, y: 9, facing: 'down',
    party: ['wick'], reserve: [],
    members: { wick: newMember('wick', 1) },
    items: { tallow: 3 },
    gold: 20, flags: {}, mech: [], steps: 0, frames: 0, tint: '', past: false, log: [],
  };
}

/** Stats with gear applied. */
export function fullStats(m: MemberState): Stats & { traits: string[]; hue: Hue } {
  const s = statsAt(m.id, m.lvl);
  const traits: string[] = [];
  let hue: Hue = 'N';
  for (const id of [m.weapon, m.charm]) {
    const e = ITEMS[id]?.equip;
    if (!e) continue;
    s.str += e.str ?? 0;
    s.mnd += e.mnd ?? 0;
    s.def += e.def ?? 0;
    s.spd += e.spd ?? 0;
    s.hp += e.hp ?? 0;
    s.ink += e.ink ?? 0;
    if (e.hue) hue = e.hue;
    if (e.trait) traits.push(e.trait);
  }
  if (traits.includes('hp15')) s.hp = Math.round(s.hp * 1.15);
  return { ...s, traits, hue };
}

export function avgLevel(st: GameState): number {
  const ids = [...st.party, ...st.reserve];
  return Math.round(ids.reduce((a, id) => a + st.members[id].lvl, 0) / Math.max(1, ids.length));
}

export function join(st: GameState, id: string, lvl?: number) {
  if (st.party.includes(id) || st.reserve.includes(id)) return;
  const m = st.members[id] ?? newMember(id, lvl ?? avgLevel(st));
  if (lvl !== undefined && m.lvl < lvl) Object.assign(m, newMember(id, lvl));
  st.members[id] = m;
  if (st.party.length < MAX_PARTY) st.party.push(id); else st.reserve.push(id);
}

export function leave(st: GameState, id: string) {
  st.party = st.party.filter(p => p !== id);
  st.reserve = st.reserve.filter(p => p !== id);
  while (st.party.length < MAX_PARTY && st.reserve.length) st.party.push(st.reserve.shift()!);
}

/** Grants XP to every member. Returns lines describing level-ups and new skills. */
export function grantXp(st: GameState, xp: number): string[] {
  const lines: string[] = [];
  for (const id of [...st.party, ...st.reserve]) {
    const m = st.members[id];
    m.xp += xp;
    while (m.xp >= xpToNext(m.lvl)) {
      m.xp -= xpToNext(m.lvl);
      const before = fullStats(m);
      const beforeSkills = skillsAt(id, m.lvl);
      m.lvl++;
      const after = fullStats(m);
      m.hp += after.hp - before.hp;
      m.ink += after.ink - before.ink;
      lines.push(`${MEMBERS[id].name} reached level ${m.lvl}.`);
      for (const s of skillsAt(id, m.lvl)) if (!beforeSkills.includes(s)) lines.push(`${MEMBERS[id].name} learned ^y${SKILLS[s]?.name ?? s}^0.`);
    }
  }
  return lines;
}

export function healAll(st: GameState) {
  for (const id of [...st.party, ...st.reserve]) {
    const m = st.members[id];
    const f = fullStats(m);
    m.hp = f.hp;
    m.ink = f.ink;
    if (id === 'nona') m.tails = Math.max(m.tails, st.flags.nonaGone ? 0 : 9);
  }
}

export function addItem(st: GameState, id: string, n = 1) {
  st.items[id] = (st.items[id] ?? 0) + n;
  if (st.items[id] <= 0) delete st.items[id];
}

export function hasMech(st: GameState, m: string): boolean {
  return st.mech.includes(m);
}

const SAVE_KEY = 'duotone.save';

export function save(st: GameState, slot = SAVE_KEY): boolean {
  try {
    localStorage.setItem(slot, JSON.stringify(st));
    return true;
  } catch {
    return false;
  }
}

export function load(slot = SAVE_KEY): GameState | null {
  try {
    const raw = localStorage.getItem(slot);
    if (!raw) return null;
    const st = JSON.parse(raw) as GameState;
    return st.v === 1 ? st : null;
  } catch {
    return null;
  }
}
