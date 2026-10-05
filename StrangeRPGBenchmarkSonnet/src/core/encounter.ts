import { Battle } from './battle';
import { activeMembers, mechsFor, toUnit, type GameState } from './party';
import { Rng } from './rng';
import { BOSS_FIELD, buildFoe, CHAPTER_FIELDS, ENCOUNTERS, ENEMIES, FIELDS, foeGold, foeLevel, foeXp } from '../data/enemies';
import type { Field } from '../data/types';

export function fieldFor(ch: number, rng: Rng, boss: boolean): Field | undefined {
  if (ch < 7) return undefined;
  const f = FIELDS[boss ? BOSS_FIELD[ch] ?? 'none' : rng.pick(CHAPTER_FIELDS[ch] ?? ['none'])];
  return f.id === 'none' ? undefined : f;
}

/** Foes follow the chapter curve but never sit far above a party that has fallen behind it. */
export function scaledFoeLevel(s: GameState, id: string, pos: number, boss: boolean): number {
  const act = activeMembers(s);
  const avg = act.reduce((a, m) => a + m.lvl, 0) / Math.max(1, act.length);
  const byChapter = foeLevel(s.chapter, ENEMIES[id], pos);
  return Math.max(1, Math.min(byChapter, Math.round(avg + (boss ? 1.5 : 1.0))));
}

export interface Planned {
  battle: Battle;
  xp: number;
  gold: number;
  foeIds: string[];
  boss: boolean;
}

export function planBattle(s: GameState, foeIds: string[], boss: boolean, rng: Rng, pos = 0.5, manualStart = false, mercy = 0): Planned {
  const ch = s.chapter;
  const foes = foeIds.map((id, i) => buildFoe(id, scaledFoeLevel(s, id, Math.min(1, pos + (boss ? 0.15 : 0) + i * 0.01), boss), ch));
  if (mercy > 0) for (const f of foes) { const k = 1 - 0.12 * Math.min(4, mercy); f.st.atk *= k; f.st.mag *= k; }
  const party = activeMembers(s).map(toUnit);
  const inv = { ...s.inv };
  const battle = new Battle({ party, foes, inv, mech: mechsFor(ch), field: fieldFor(ch, rng, boss), seed: rng.int(1e9) + 1, boss, noStart: manualStart });
  let xp = 0, gold = 0;
  for (const f of foes) { xp += foeXp(ENEMIES[f.defId!], f.lvl); gold += foeGold(ENEMIES[f.defId!], f.lvl); }
  return { battle, xp, gold, foeIds, boss };
}

export function randomEncounter(s: GameState, rng: Rng, room: number): string[] {
  void room;
  const foes = rng.weighted(ENCOUNTERS[s.chapter], (e) => e.w).foes;
  return capFoes(foes, s.active.length);
}

/** A small party never faces more foes than it has members. */
export function capFoes(foes: string[], partySize: number): string[] {
  return foes.slice(0, Math.max(1, partySize));
}
