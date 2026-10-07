import { CHAR, CHARS, CHAPTER_LEVEL, MAX_LEVEL, XP_NEED } from '../data/characters';
import { GEAR, GEAR_BY_TIER, ITEMS, RUNES } from '../data/items';
import { TRIM } from '../data/trim';
import type { Elem, Mech, Mods, Stats } from '../data/types';
import { MECH_ORDER } from '../data/types';
import type { Battle, Stance, Unit } from './battle';

export interface Member {
  id: string;
  lvl: number;
  xp: number;
  hp: number;
  mp: number;
  joinLvl: number;
  weapon?: string;
  armor?: string;
  charm?: string;
  runeW?: string;
  runeA?: string;
  row: 0 | 1;
  stance: Stance;
}

export interface GameState {
  chapter: number;
  roster: Member[];
  active: string[];
  gold: number;
  inv: Record<string, number>;
  owned: string[];
  runes: Record<string, number>;
  flags: Record<string, number | boolean | string>;
  beat: number;
  map: { x: number; y: number; dir: number };
  steps: number;
  stats: { battles: number; wins: number; wipes: number; flees: number; steps: number; playMs: number };
}

export function mechsFor(chapter: number): Set<Mech> {
  return new Set(MECH_ORDER.slice(0, Math.max(1, chapter)));
}

export function newGame(chapter = 1): GameState {
  const s: GameState = {
    chapter: 1, roster: [], active: [], gold: 40, inv: { dew: 3 }, owned: ['w1', 'a1'], runes: {}, flags: {}, beat: 0,
    map: { x: 0, y: 0, dir: 2 }, steps: 0, stats: { battles: 0, wins: 0, wipes: 0, flees: 0, steps: 0, playMs: 0 },
  };
  joinMember(s, 'wick');
  autoEquip(s);
  if (chapter > 1) setupChapter(s, chapter);
  return s;
}

/** Jump-in state: all earlier partymates at the expected level for the chapter, with gear and supplies. */
export function setupChapter(s: GameState, chapter: number) {
  s.chapter = chapter;
  s.beat = 0;
  s.flags = {};
  const lvl = CHAPTER_LEVEL[chapter];
  s.roster = [];
  s.active = [];
  for (const c of CHARS) if (c.joinChapter < chapter || c.id === 'wick') joinMember(s, c.id, lvl);
  s.owned = [];
  for (let t = 1; t < chapter; t++) for (const g of GEAR_BY_TIER[t - 1]) s.owned.push(g.id);
  if (chapter === 1) s.owned = ['w1', 'a1'];
  s.gold = 60 + chapter * 40;
  s.inv = { dew: 4 };
  if (chapter >= 2) Object.assign(s.inv, { dew: 4, ink: 2 });
  if (chapter >= 4) Object.assign(s.inv, { jar: 4, ink: 3, feather: 2 });
  if (chapter >= 8) Object.assign(s.inv, { flask: 4, ink2: 3, feather: 2, plume: 1 });
  if (chapter >= 11) Object.assign(s.inv, { starwater: 4, ink3: 3, plume: 2 });
  if (chapter >= 9) for (const r of ['r_ember', 'r_siphon', 'r_bulwark', 'r_quick']) s.runes[r] = 1;
  autoEquip(s);
  for (const m of s.roster) { const st = memberStats(m); m.hp = st.hp; m.mp = st.mp; }
}

export function joinMember(s: GameState, id: string, lvl?: number) {
  if (s.roster.some((m) => m.id === id)) return;
  const def = CHAR[id];
  const avg = s.roster.length ? Math.round(s.roster.reduce((a, m) => a + m.lvl, 0) / s.roster.length) : 1;
  const L = lvl ?? Math.max(1, avg);
  const m: Member = { id, lvl: L, xp: 0, hp: 1, mp: 1, joinLvl: lvl !== undefined ? Math.min(L, CHAPTER_LEVEL[def.joinChapter]) : L, row: def.row, stance: def.stance };
  s.roster.push(m);
  const st = memberStats(m);
  m.hp = st.hp;
  m.mp = st.mp;
  if (s.active.length < 4) s.active.push(id);
}

export function member(s: GameState, id: string): Member { return s.roster.find((m) => m.id === id)!; }

export function memberStats(m: Member): Stats {
  const d = CHAR[m.id];
  const out = {} as Stats;
  for (const k of Object.keys(d.base) as (keyof Stats)[]) out[k] = d.base[k] + d.grow[k] * (m.lvl - 1);
  for (const g of [m.weapon, m.armor, m.charm]) {
    if (!g) continue;
    const b = GEAR[g].bonus;
    for (const k of Object.keys(b) as (keyof Stats)[]) out[k] += b[k] ?? 0;
  }
  const trim = TRIM[m.id] ?? 1;
  out.hp *= trim;
  out.atk *= trim;
  out.mag *= trim;
  const mods = memberMods(m);
  out.hp *= 1 + (mods.hpPct ?? 0);
  out.hp = Math.round(out.hp);
  out.mp = Math.round(out.mp);
  return out;
}

export function memberMods(m: Member): Mods {
  const out: Mods = {};
  const add = (x: Mods) => {
    for (const k of Object.keys(x) as (keyof Mods)[]) {
      if (k === 'dmgElem') { out.dmgElem = out.dmgElem ?? {}; for (const e of Object.keys(x.dmgElem!) as Elem[]) out.dmgElem[e] = (out.dmgElem[e] ?? 0) + x.dmgElem![e]!; }
      else (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + (x[k] as number);
    }
  };
  for (const r of [m.runeW, m.runeA]) if (r && RUNES[r]) add(RUNES[r].mods);
  if (m.charm) { const e = GEAR[m.charm].elem; if (e) add({ dmgElem: { [e]: 0.1 } }); }
  return out;
}

export function learnedSkills(m: Member): string[] {
  const d = CHAR[m.id];
  const tenure = (12 - d.joinChapter + 1) * 3;
  const out: string[] = [];
  for (const [frac, id] of d.learn) {
    const at = m.joinLvl + Math.floor(frac * tenure);
    if (m.lvl >= at) out.push(id);
  }
  return out;
}

export function nextSkill(m: Member): { id: string; lvl: number } | null {
  const d = CHAR[m.id];
  const tenure = (12 - d.joinChapter + 1) * 3;
  for (const [frac, id] of d.learn) {
    const at = m.joinLvl + Math.floor(frac * tenure);
    if (m.lvl < at) return { id, lvl: at };
  }
  return null;
}

export function toUnit(m: Member): Unit {
  const d = CHAR[m.id];
  const s = memberStats(m);
  const aff: Partial<Record<Elem, number>> = { [d.weak]: 1.5, [d.resist]: 0.5 };
  return {
    uid: 0, id: m.id, name: d.name, side: 'party', lvl: m.lvl, maxHp: s.hp, hp: Math.min(m.hp, s.hp), maxMp: s.mp, mp: Math.min(m.mp, s.mp),
    st: { atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd }, aff, status: {}, t: 0, row: m.row, stance: m.stance, nerve: 0, guard: false,
    skills: learnedSkills(m), limit: d.limit, mods: memberMods(m), boss: false, turns: 0, gasp: false, gaspUsed: false, asc: 0, pact: false, immune: [],
  };
}

export function activeMembers(s: GameState): Member[] { return s.active.map((id) => member(s, id)); }

export function gainXp(m: Member, xp: number): number {
  if (m.lvl >= MAX_LEVEL) return 0;
  m.xp += xp;
  let gained = 0;
  while (m.lvl < MAX_LEVEL && m.xp >= XP_NEED(m.lvl)) {
    m.xp -= XP_NEED(m.lvl);
    const before = memberStats(m);
    m.lvl++;
    const after = memberStats(m);
    m.hp += after.hp - before.hp;
    m.mp += after.mp - before.mp;
    gained++;
  }
  return gained;
}

/** Rubber band: XP is worth more when the party trails the expected level and less when it leads. */
export function xpMultiplier(s: GameState): number {
  const act = s.active.map((id) => member(s, id));
  const avg = act.reduce((a, m) => a + m.lvl, 0) / Math.max(1, act.length);
  const expected = CHAPTER_LEVEL[s.chapter] + 3 * Math.min(1, s.beat / 7);
  return Math.min(1.9, Math.max(0.5, 1 + 0.28 * (expected - avg)));
}

export interface Rewards { xp: number; gold: number; levelUps: { id: string; to: number }[]; }

/** Copies battle outcome back onto the roster and grants rewards. */
export function applyResult(s: GameState, b: Battle, xp: number, gold: number): Rewards {
  const out: Rewards = { xp, gold, levelUps: [] };
  for (const k of Object.keys(b.inv)) s.inv[k] = b.inv[k];
  for (const u of b.party) {
    const m = member(s, u.id);
    m.hp = u.hp > 0 ? u.hp : Math.max(1, Math.round(u.maxHp * 0.25));
    m.mp = u.mp;
  }
  s.stats.battles++;
  if (b.over === 'win') {
    s.stats.wins++;
    s.gold += gold;
    const mult = xpMultiplier(s);
    for (const m of s.roster) {
      const share = s.active.includes(m.id) ? 1 : 0.75;
      const n = gainXp(m, Math.round(xp * share * mult));
      if (n) out.levelUps.push({ id: m.id, to: m.lvl });
    }
  } else if (b.over === 'lose') s.stats.wipes++;
  else if (b.over === 'flee') s.stats.flees++;
  return out;
}

/** Restores a fraction of max HP and MP to every roster member, as after a won fight. */
export function recover(s: GameState, hpFrac: number, mpFrac: number) {
  for (const m of s.roster) {
    const st = memberStats(m);
    m.hp = Math.min(st.hp, m.hp + Math.round(st.hp * hpFrac));
    m.mp = Math.min(st.mp, m.mp + Math.round(st.mp * mpFrac));
  }
}

export function fullHeal(s: GameState) {
  for (const m of s.roster) { const st = memberStats(m); m.hp = st.hp; m.mp = st.mp; }
}

export function autoEquip(s: GameState) {
  for (const m of s.roster) {
    for (const slot of ['weapon', 'armor', 'charm'] as const) {
      const best = s.owned.map((g) => GEAR[g]).filter((g) => g.slot === slot).sort((a, b) => b.tier - a.tier)[0];
      if (best && (!m[slot] || GEAR[m[slot]!].tier < best.tier)) m[slot] = best.id;
    }
  }
}

export function buyGear(s: GameState, id: string): boolean {
  const g = GEAR[id];
  if (!g || s.owned.includes(id) || s.gold < g.price) return false;
  s.gold -= g.price;
  s.owned.push(id);
  return true;
}
export function buyItem(s: GameState, id: string): boolean {
  const it = ITEMS[id];
  if (!it || s.gold < it.price || (s.inv[id] ?? 0) >= 9) return false;
  s.gold -= it.price;
  s.inv[id] = (s.inv[id] ?? 0) + 1;
  return true;
}
export function buyRune(s: GameState, id: string): boolean {
  const r = RUNES[id];
  if (!r || s.gold < r.price) return false;
  s.gold -= r.price;
  s.runes[id] = (s.runes[id] ?? 0) + 1;
  return true;
}

export function equipRune(s: GameState, m: Member, slot: 'runeW' | 'runeA', id: string | undefined) {
  const cur = m[slot];
  if (cur) s.runes[cur] = (s.runes[cur] ?? 0) + 1;
  if (id) { if ((s.runes[id] ?? 0) <= 0) { m[slot] = undefined; return; } s.runes[id]--; }
  m[slot] = id;
}
