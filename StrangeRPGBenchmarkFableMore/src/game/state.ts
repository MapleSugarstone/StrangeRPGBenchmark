import { MEMBERS, MEMBER_ORDER, xpForLevel, statsAt, poolAt } from "./data/members";
import { SKILLS } from "./data/skills";
import { ITEMS } from "./data/items";
import type { Facing } from "./world/map";
import type { PartyInput } from "./battle/core";

export interface MemberState {
  id: string;
  level: number;
  xp: number;
  hp: number;
  gear: { glove?: string; line?: string; lure?: string };
  /** Camp talks had, used for bonds. */
  talks: number;
}

export type Difficulty = "slack" | "plumb" | "taut";
export const DIFFICULTY_MULT: Record<Difficulty, number> = { slack: 0.8, plumb: 1, taut: 1.25 };

export interface Options {
  music: boolean;
  sfx: boolean;
  textSpeed: number;
  twoPlayer: boolean;
  /** Show the strip preview and tutorial tips. */
  tips: boolean;
  difficulty: Difficulty;
}

export interface GameState {
  version: number;
  chapter: number;
  /** Story circle step in the current chapter, 0 to 7. */
  beat: number;
  members: Record<string, MemberState>;
  roster: string[];
  active: string[];
  inventory: Record<string, number>;
  slugs: number;
  flags: Record<string, number | string | boolean>;
  map: string;
  x: number;
  y: number;
  facing: Facing;
  /** Extra fathoms of line found in the story. */
  poolBonus: number;
  bonds: [string, string][];
  options: Options;
  playtime: number;
  steps: number;
  battles: number;
  /** Knot messages decoded, by id. */
  knotsRead: string[];
  /** Opened chests by id. */
  opened: string[];
  /** Towns taught to be slack, for the ending. */
  taught: string[];
  /** Name the player typed for the Hand, used by the Hand's lines. */
  handName: string;
  /** The ending reached, if any. */
  ending: string | null;
  seed: number;
  /** Knots Fathom carries rigged for battle, at most four. Empty means the first four known. */
  rig: string[];
  /** Side missions finished, by id. */
  errands: string[];
  /** Things caught by Hooking, for the tally. */
  catches: number;
  /** Wandering enemies beaten per map since the last rest. They stay gone until the party rests. */
  cleared: Record<string, number>;
}

export const SAVE_KEY = "plumb.save";
export const AUTO_KEY = "plumb.auto";
export const META_KEY = "plumb.meta";

export function newMember(id: string, level: number): MemberState {
  const def = MEMBERS[id];
  return { id, level, xp: 0, hp: statsAt(def, level).hp, gear: {}, talks: 0 };
}

export function newGame(): GameState {
  return {
    version: 1,
    chapter: 1,
    beat: 0,
    members: { fathom: newMember("fathom", 1) },
    roster: ["fathom"],
    active: ["fathom"],
    inventory: { flatbread: 2 },
    slugs: 20,
    flags: {},
    map: "hem_home",
    x: 6,
    y: 6,
    facing: "down",
    poolBonus: 0,
    bonds: [],
    options: { music: true, sfx: true, textSpeed: 55, twoPlayer: false, tips: true, difficulty: "plumb" },
    playtime: 0,
    steps: 0,
    battles: 0,
    knotsRead: [],
    opened: [],
    taught: [],
    handName: "",
    ending: null,
    seed: Math.floor(Math.random() * 1e9),
    rig: [],
    errands: [],
    catches: 0,
    cleared: {},
  };
}

/** Fathom's knots for battle: the rigged ones, or the first four known. */
export function riggedKnots(g: GameState): string[] {
  const known = knotsOf(g.members.fathom, g.chapter);
  const rig = g.rig.filter((k) => known.includes(k));
  return rig.length ? rig : known.slice(0, 4);
}

export function maxHpOf(m: MemberState): number {
  const def = MEMBERS[m.id];
  let hp = statsAt(def, m.level).hp;
  for (const id of [m.gear.glove, m.gear.line]) {
    const it = id ? ITEMS[id] : undefined;
    if (it?.stats?.hp) hp += it.stats.hp;
  }
  return hp;
}

export function skillsOf(m: MemberState, chapter: number): string[] {
  const def = MEMBERS[m.id];
  return def.learn.filter((l) => l.level <= m.level).map((l) => l.skill).filter((id) => SKILLS[id] && (SKILLS[id].chapter ?? 1) <= chapter);
}

export function knotsOf(m: MemberState, chapter: number): string[] {
  return skillsOf(m, chapter).filter((id) => SKILLS[id].kind === "knot");
}

export function poolOf(g: GameState, m: MemberState): number {
  const def = MEMBERS[m.id];
  if (def.economy !== "length") return poolAt(def, m.level);
  return poolAt(def, m.level) + g.poolBonus;
}

/** Give experience to every active, living member. Returns the ids that leveled and the skills learned. */
export function grantXp(g: GameState, xp: number): { id: string; from: number; to: number; learned: string[] }[] {
  const out: { id: string; from: number; to: number; learned: string[] }[] = [];
  for (const id of g.active) {
    const m = g.members[id];
    if (!m || m.hp <= 0) continue;
    const from = m.level;
    m.xp += xp;
    const before = skillsOf(m, g.chapter);
    while (m.level < 40 && m.xp >= xpForLevel(m.level)) {
      m.xp -= xpForLevel(m.level);
      m.level++;
      // Level ups heal a little, the way standing up straighter would
      m.hp = Math.min(maxHpOf(m), m.hp + Math.round(maxHpOf(m) * 0.2));
    }
    if (m.level > from) {
      const after = skillsOf(m, g.chapter);
      out.push({ id, from, to: m.level, learned: after.filter((s) => !before.includes(s)) });
    }
  }
  // Reserve members gain half, so swapping is never punished too hard
  for (const id of g.roster) {
    if (g.active.includes(id)) continue;
    const m = g.members[id];
    m.xp += Math.round(xp * 0.5);
    while (m.level < 40 && m.xp >= xpForLevel(m.level)) {
      m.xp -= xpForLevel(m.level);
      m.level++;
      m.hp = maxHpOf(m);
    }
  }
  return out;
}

export function addItem(g: GameState, id: string, n = 1): void {
  g.inventory[id] = (g.inventory[id] ?? 0) + n;
  if (g.inventory[id] <= 0) delete g.inventory[id];
}

export function hasItem(g: GameState, id: string): boolean {
  return (g.inventory[id] ?? 0) > 0;
}

export function join(g: GameState, id: string, level?: number): void {
  if (g.roster.includes(id)) return;
  const lead = g.members.fathom;
  const lv = level ?? Math.max(1, lead.level - 1);
  g.members[id] = newMember(id, lv);
  g.roster.push(id);
  if (g.active.length < 4) g.active.push(id);
  else {
    // Swap out the oldest non-Fathom member
    const idx = g.active.findIndex((a) => a !== "fathom");
    if (idx >= 0) g.active[idx] = id;
  }
}

export function leave(g: GameState, id: string): void {
  g.roster = g.roster.filter((r) => r !== id);
  g.active = g.active.filter((r) => r !== id);
}

export function partyInputs(g: GameState): PartyInput[] {
  const rig = riggedKnots(g);
  return g.active.map((id) => {
    const m = g.members[id];
    const skills = skillsOf(m, g.chapter).filter((s) => SKILLS[s].kind !== "knot" || rig.includes(s));
    return { def: MEMBERS[id], level: m.level, hp: m.hp, gear: m.gear, skills };
  });
}

export function restAll(g: GameState): void {
  for (const id of g.roster) g.members[id].hp = maxHpOf(g.members[id]);
}

export function averageLevel(g: GameState): number {
  return g.active.reduce((a, id) => a + g.members[id].level, 0) / Math.max(1, g.active.length);
}

export function bonded(g: GameState, a: string, b: string): boolean {
  return g.bonds.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function addBond(g: GameState, a: string, b: string): void {
  if (!bonded(g, a, b)) g.bonds.push([a, b]);
}

// ---------------------------------------------------------------------------
// Persistence

export function save(g: GameState, key = SAVE_KEY): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}

export function load(key = SAVE_KEY): GameState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    if (!g || g.version !== 1) return null;
    // Fill fields added later
    const fresh = newGame();
    for (const k of Object.keys(fresh) as (keyof GameState)[]) if ((g as unknown as Record<string, unknown>)[k] === undefined) (g as unknown as Record<string, unknown>)[k] = fresh[k];
    g.options = { ...fresh.options, ...g.options };
    return g;
  } catch {
    return null;
  }
}

export function hasSave(key = SAVE_KEY): boolean {
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

/** Things that persist across games: endings seen, the knot password, visits. */
export interface Meta {
  endings: string[];
  visits: number;
  burlMemory: boolean;
  lastSeen: number;
  slackSeen: boolean;
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    const m = raw ? (JSON.parse(raw) as Partial<Meta>) : {};
    return { endings: m.endings ?? [], visits: m.visits ?? 0, burlMemory: m.burlMemory ?? false, lastSeen: m.lastSeen ?? 0, slackSeen: m.slackSeen ?? false };
  } catch {
    return { endings: [], visits: 0, burlMemory: false, lastSeen: 0, slackSeen: false };
  }
}

export function saveMeta(m: Meta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // storage may be blocked; the game still runs
  }
}

/** Encode a save as a short shareable string of knot letters. */
export function encodeSave(g: GameState): string {
  const json = JSON.stringify(g);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeSave(code: string): GameState | null {
  try {
    const bin = atob(code.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const g = JSON.parse(new TextDecoder().decode(bytes)) as GameState;
    return g.version === 1 ? g : null;
  } catch {
    return null;
  }
}

export const ALL_MEMBERS = MEMBER_ORDER;
