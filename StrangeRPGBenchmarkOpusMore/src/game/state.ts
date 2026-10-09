import { MEMBERS, xpNext, callingOf } from '../data/members';
import { ITEMS } from '../data/items';
import { ENEMIES } from '../data/enemies';
import type { Elem, Stats, Unit } from '../battle/types';
import { hashStr, Rng } from '../core/rng';

export interface MemberState {
  id: string;
  lvl: number;
  xp: number;
  hp: number;
  vp: number;
  weapon: string;
  coat: string;
  charms: (string | null)[];
  calling?: string;
}

export interface Stats2 {
  battles: number; wins: number; answered: number; defeated: number; rewinds: number; lines: number;
  clean: number; braced: number; losses: number; flees: number; steps: number; calls: number;
}

export interface GameState {
  v: number;
  wish: string;
  chapter: number;
  map: string;
  x: number; y: number; dir: number;
  party: string[];
  roster: Record<string, MemberState>;
  inv: Record<string, number>;
  pleas: number;
  flags: Record<string, number | string | boolean>;
  kept: string[];
  seen: string[];
  slips: string[];
  stakes: number;
  playtime: number;
  timed: boolean;
  textSpeed: number;
  stats: Stats2;
  letters: string[];
  lastSave: number;
  saveMap?: string;
}

export const SAVE_KEY = 'pleasehold.save.v1';
export const META_KEY = 'pleasehold.meta.v1';

export function newState(wish: string): GameState {
  return {
    v: 1, wish, chapter: 1, map: 'hut', x: 3, y: 3, dir: 2,
    party: ['hello'],
    roster: { hello: newMember('hello', 1) },
    inv: { soup: 3 },
    pleas: 20, flags: {}, kept: [], seen: [], slips: [], stakes: 0, playtime: 0, timed: true, textSpeed: 2,
    stats: { battles: 0, wins: 0, answered: 0, defeated: 0, rewinds: 0, lines: 0, clean: 0, braced: 0, losses: 0, flees: 0, steps: 0, calls: 0 },
    letters: [], lastSave: 0,
  };
}

export function newMember(id: string, lvl: number, chapter = 1): MemberState {
  const tier = Math.max(1, Math.min(6, Math.round(chapter * 0.62)));
  const coat = Math.max(1, Math.min(8, chapter - 1));
  const m: MemberState = { id, lvl, xp: 0, hp: 1, vp: 1, weapon: `${id}_w${tier}`, coat: `coat${coat}`, charms: [null, null] };
  const s = memberStats(m);
  m.hp = s.hp; m.vp = s.vp;
  return m;
}

export function baseStats(id: string, lvl: number, calling?: string): Stats {
  const d = MEMBERS[id];
  const L = lvl - 1;
  const k = callingOf(id, calling)?.mods ?? {};
  const st = (s: keyof Stats) => Math.round(d.base[s] + (d.growth[s] + (k[s] ?? 0)) * L);
  return { hp: st('hp'), vp: st('vp'), pow: st('pow'), wit: st('wit'), grd: st('grd'), spd: st('spd') };
}

export function gearMods(ids: (string | null)[]): { mods: Partial<Stats>; resist: Elem[] } {
  const mods: Partial<Stats> = {};
  const resist: Elem[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (id.startsWith('kept:')) {
      const k = ENEMIES[id.slice(5)]?.kept;
      if (!k) continue;
      for (const [s, v] of Object.entries(k.mods ?? {})) mods[s as keyof Stats] = (mods[s as keyof Stats] ?? 0) + (v as number);
      if (k.resist) resist.push(k.resist);
      continue;
    }
    const it = ITEMS[id];
    if (!it) continue;
    if (it.atk) mods.pow = (mods.pow ?? 0) + it.atk;
    for (const [s, v] of Object.entries(it.mods ?? {})) mods[s as keyof Stats] = (mods[s as keyof Stats] ?? 0) + (v as number);
    if (it.resist) resist.push(it.resist);
  }
  return { mods, resist };
}

export function memberStats(m: MemberState): Stats & { resist: Elem[] } {
  const b = baseStats(m.id, m.lvl, m.calling);
  const g = gearMods([m.weapon, m.coat, ...m.charms]);
  const out = { ...b, resist: g.resist };
  for (const k of Object.keys(g.mods) as (keyof Stats)[]) out[k] += g.mods[k] ?? 0;
  return out;
}

export function learned(id: string, lvl: number, second = false, calling?: string): string[] {
  const d = MEMBERS[id];
  const k = callingOf(id, calling);
  const list = [...(second ? d.learn2 ?? [] : d.learn), ...((second ? k?.learn2 : k?.learn) ?? [])];
  return list.filter(([l]) => l <= lvl).map(([, s]) => s);
}

export function buildUnit(m: MemberState, bench = false): Unit {
  const d = MEMBERS[m.id];
  const s = memberStats(m);
  return {
    uid: 0, side: 0, id: m.id, name: d.name, lvl: m.lvl,
    hp: Math.min(m.hp, s.hp), mhp: s.hp, vp: Math.min(m.vp, s.vp), mvp: s.vp,
    pow: s.pow, wit: s.wit, grd: s.grd, spd: s.spd,
    weak: [], resist: s.resist, immune: [], atkElem: d.atkElem,
    skills: learned(m.id, m.lvl, false, m.calling), skills2: d.twin ? learned(m.id, m.lvl, true, m.calling) : undefined,
    status: [], ct: 0, alive: m.hp > 0, bench, twin: d.twin,
  };
}

// Applies end-of-battle HP and VP back to the roster.
export function writeBack(s: GameState, units: Unit[]) {
  for (const u of units) {
    if (u.side !== 0) continue;
    const m = s.roster[u.id];
    if (!m) continue;
    m.hp = u.alive ? Math.max(1, u.hp) : 0;
    m.vp = u.vp;
  }
}

export function gainXp(s: GameState, amount: number): string[] {
  const msgs: string[] = [];
  const active = new Set(s.party);
  for (const m of Object.values(s.roster)) {
    const got = active.has(m.id) ? amount : Math.round(amount * 0.6);
    m.xp += got;
    while (m.xp >= xpNext(m.lvl)) {
      m.xp -= xpNext(m.lvl);
      const before = memberStats(m);
      const oldSkills = learned(m.id, m.lvl, false, m.calling).concat(learned(m.id, m.lvl, true, m.calling));
      m.lvl++;
      const after = memberStats(m);
      m.hp += after.hp - before.hp;
      m.vp += after.vp - before.vp;
      if (active.has(m.id)) msgs.push(`${MEMBERS[m.id].name} is now level ${m.lvl}.`);
      const nu = learned(m.id, m.lvl, false, m.calling).concat(learned(m.id, m.lvl, true, m.calling)).filter((x) => !oldSkills.includes(x));
      for (const sk of nu) msgs.push(`${MEMBERS[m.id].name} learned a new skill.`.replace('a new skill', skillName(sk)));
    }
  }
  return msgs;
}

let skillNameFn: (id: string) => string = (id) => id;
export function setSkillNamer(fn: (id: string) => string) { skillNameFn = fn; }
function skillName(id: string) { return skillNameFn(id); }

export function healAll(s: GameState) {
  for (const m of Object.values(s.roster)) {
    const st = memberStats(m);
    m.hp = st.hp;
    m.vp = st.vp;
  }
}

export function addItem(s: GameState, id: string, n = 1) {
  s.inv[id] = (s.inv[id] ?? 0) + n;
  if (s.inv[id] <= 0) delete s.inv[id];
}

export function slipLevel(s: GameState): number { return Number(s.flags.slip ?? 0); }

// The wish reveals more letters at story beats. Level runs 0 to 10. Spaces always show.
export function slipText(wish: string, level: number, full = false): string {
  const w = wish || 'please';
  if (full || level >= 10) return w;
  const idx: number[] = [];
  for (let i = 0; i < w.length; i++) if (w[i] !== ' ') idx.push(i);
  new Rng(hashStr('slip:' + w)).shuffle(idx);
  const frac = Math.min(1, Math.max(0, level / 10));
  const show = new Set(idx.slice(0, Math.round(idx.length * frac)));
  let out = '';
  for (let i = 0; i < w.length; i++) out += w[i] === ' ' || show.has(i) ? w[i] : '\u0001';
  return out;
}

export function heroSprite(wish: string) {
  const pairs: [string, string][] = [
    ['paper', 'teal'], ['cream', 'violet'], ['paper', 'rust'], ['ice', 'blue'], ['cream', 'green'],
    ['paper', 'rose'], ['tan', 'navy'], ['cream', 'sea'], ['white', 'plum'], ['plea', 'moss'],
  ];
  const h = hashStr('hero:' + (wish || 'please'));
  const [a, b] = pairs[h % pairs.length];
  return { t: 'hero', seed: h, a, b };
}

export function saveGame(s: GameState) {
  s.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.v !== 1) return null;
    repairSave(s);
    return s;
  } catch { return null; }
}

// Older builds let the Cloister gates open before Anyone joined. Anyone departs by story at the end of chapter 7.
export function repairSave(s: GameState) {
  const f = s.flags;
  const pastAnyone = f.c3_anyone || f.pz_inner || f.pz_vault || f.c3_supev || f.c3_sup || s.chapter >= 4;
  if (s.roster.anyone || !pastAnyone || f.c7_fall) return;
  const ms = Object.values(s.roster);
  const avg = Math.round(ms.reduce((a, m) => a + m.lvl, 0) / Math.max(1, ms.length));
  const carried = f.ngplus ? Number(f.lvl_anyone ?? 0) : 0;
  s.roster.anyone = newMember('anyone', Math.max(avg, 10, carried), Math.max(3, s.chapter));
  if (f.calling_anyone) s.roster.anyone.calling = String(f.calling_anyone);
  if (s.party.length < 4 && !s.party.includes('anyone')) s.party.push('anyone');
  f.c3_anyone = 1;
  f.c3_anyone_seen = 1;
  f.mech_line = 1;
}

// What a finished game hands to the next one in Again mode.
export interface Carry { runs: number; lvl: Record<string, number>; calling: Record<string, string>; inv: Record<string, number>; pleas: number; kept: string[]; pages: number[]; }

export interface Meta { endings: string[]; delivered: boolean; firstSeen: number; letters: string[]; wish?: string; carry?: Carry; }

export function makeCarry(s: GameState, prev?: Carry): Carry {
  const inv: Record<string, number> = {};
  for (const [k, n] of Object.entries(s.inv)) if (n > 0 && ITEMS[k] && ITEMS[k].kind !== 'key') inv[k] = n;
  for (const m of Object.values(s.roster)) for (const g of [m.weapon, m.coat, ...m.charms]) if (g && !g.startsWith('kept:') && ITEMS[g]) inv[g] = (inv[g] ?? 0) + 1;
  return {
    runs: (prev?.runs ?? 0) + 1,
    lvl: Object.fromEntries(Object.values(s.roster).map((m) => [m.id, m.lvl])),
    calling: Object.fromEntries(Object.values(s.roster).filter((m) => m.calling).map((m) => [m.id, m.calling!])),
    inv, pleas: s.pleas, kept: [...s.kept],
    pages: Array.from({ length: 12 }, (_, i) => i + 1).filter((i) => s.flags['page_' + i]),
  };
}

// A new game in Again mode: Hello keeps their level, the party's gear and kept prayers carry over, and every foe is tougher.
export function againState(wish: string, meta: Meta): GameState {
  const s = newState(wish);
  const k = meta.carry;
  if (!k) return s;
  s.flags.ngplus = k.runs;
  s.roster.hello = newMember('hello', k.lvl.hello ?? 1);
  if (k.calling.hello) s.roster.hello.calling = k.calling.hello;
  healAll(s);
  for (const [id, n] of Object.entries(k.lvl)) if (id !== 'hello') s.flags['lvl_' + id] = n;
  for (const [id, c] of Object.entries(k.calling)) s.flags['calling_' + id] = c;
  for (const [it, n] of Object.entries(k.inv)) addItem(s, it, n);
  s.pleas += k.pleas;
  s.kept = [...k.kept];
  for (const p of k.pages) { s.flags['page_' + p] = 1; addItem(s, 'ledgerpage', 1); }
  return s;
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as Meta;
  } catch { /* storage may be unavailable */ }
  return { endings: [], delivered: false, firstSeen: Date.now(), letters: [] };
}

export function saveMeta(m: Meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* storage may be unavailable */ }
}
