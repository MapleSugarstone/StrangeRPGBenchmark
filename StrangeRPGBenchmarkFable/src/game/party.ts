import type { MechId, PartyMember, Passive, Stats, StatKey } from "./types";
import { CHARACTERS, CLASSES, xpForLevel } from "./data/classes";
import { ITEMS } from "./data/items";
import { STAT_KEYS } from "./types";

const STARTING_GEAR: Record<string, { weapon?: string; armor?: string }> = {
  pell: { weapon: "salt_hook", armor: "salt_coat" },
  oxbow: { weapon: "rust_arm", armor: "rust_plate" },
  vane: { weapon: "coin_rod", armor: "habit" },
  mim: { weapon: "moth_wing" },
  quill: { weapon: "coin_rod", armor: "paper_robe" },
  fold: { weapon: "folding_knife", armor: "map_cloak" },
  uhtred: { weapon: "issue_rifle", armor: "ledger_vest" },
  dust: { weapon: "hour_hand", armor: "glass_mail" },
  choir: { weapon: "hymn_rod", armor: "paper_robe" },
};

export function newMember(charId: string, level: number): PartyMember {
  const m: PartyMember = { charId, level, xp: 0, hp: 1, st: 1, equip: { ...STARTING_GEAR[charId] }, memories: [], extraSkills: [] };
  const s = memberStats(m);
  m.hp = s.hp;
  m.st = s.st;
  return m;
}

export function baseStats(m: PartyMember): Stats {
  const cls = CLASSES[CHARACTERS[m.charId].classId];
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = Math.round(cls.base[k] + cls.growth[k] * (m.level - 1));
  return out;
}

export function memberStats(m: PartyMember): Stats {
  const out = baseStats(m);
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const id = m.equip[slot];
    if (!id) continue;
    const it = ITEMS[id];
    if (it?.stats) for (const k of Object.keys(it.stats) as StatKey[]) out[k] += it.stats[k] ?? 0;
  }
  for (const p of memberPassives(m)) {
    if (p.stats) for (const k of Object.keys(p.stats) as StatKey[]) out[k] += p.stats[k] ?? 0;
    if (p.hpPct) out.hp = Math.round(out.hp * (1 + p.hpPct / 100));
  }
  for (const k of STAT_KEYS) out[k] = Math.max(1, out[k]);
  return out;
}

export function memberPassives(m: PartyMember): Passive[] {
  const out: Passive[] = [];
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const id = m.equip[slot];
    if (id && ITEMS[id]?.passive) out.push(ITEMS[id].passive!);
  }
  for (const id of m.memories) if (ITEMS[id]?.passive) out.push(ITEMS[id].passive!);
  return out;
}

/** Everything the member can do in battle, including mechanic actions that the battle may hide. */
export function memberSkills(m: PartyMember, mechanics: Set<MechId>): string[] {
  const cls = CLASSES[CHARACTERS[m.charId].classId];
  const out = ["attack"];
  for (const l of cls.learn) if (l.level <= m.level && !out.includes(l.skill)) out.push(l.skill);
  for (const s of m.extraSkills) if (!out.includes(s)) out.push(s);
  out.push("guard");
  if (mechanics.has("tempo")) out.push("delay");
  if (mechanics.has("rows")) out.push("swaprow");
  if (mechanics.has("debt")) out.push("borrow");
  if (mechanics.has("rewind")) out.push("rewind");
  if (mechanics.has("fusion")) out.push("fuse");
  return out;
}

export function learnedSkills(m: PartyMember): string[] {
  return memberSkills(m, new Set()).filter((s) => s !== "attack" && s !== "guard");
}

export interface LevelUp { from: number; to: number; newSkills: string[]; gains: Partial<Stats> }

/** Adds XP and levels the member. Heals by the stat gain, not fully. */
export function gainXp(m: PartyMember, xp: number): LevelUp | null {
  m.xp += xp;
  const from = m.level;
  const before = memberStats(m);
  const skillsBefore = learnedSkills(m);
  while (m.level < 40 && m.xp >= xpForLevel(m.level)) {
    m.xp -= xpForLevel(m.level);
    m.level++;
  }
  if (m.level === from) return null;
  const after = memberStats(m);
  const gains: Partial<Stats> = {};
  for (const k of STAT_KEYS) gains[k] = after[k] - before[k];
  m.hp = Math.min(after.hp, m.hp + (gains.hp ?? 0));
  m.st = Math.min(after.st, m.st + (gains.st ?? 0));
  const newSkills = learnedSkills(m).filter((s) => !skillsBefore.includes(s));
  return { from, to: m.level, newSkills, gains };
}

export function canEquip(m: PartyMember, itemId: string): boolean {
  const it = ITEMS[itemId];
  if (!it) return false;
  if (it.kind === "weapon") {
    const cls = CLASSES[CHARACTERS[m.charId].classId];
    return !!it.weaponKind && cls.weaponKinds.includes(it.weaponKind);
  }
  return it.kind === "armor" || it.kind === "accessory";
}

export function fullHeal(m: PartyMember): void {
  const s = memberStats(m);
  m.hp = s.hp;
  m.st = s.st;
}

export function clampVitals(m: PartyMember): void {
  const s = memberStats(m);
  m.hp = Math.max(0, Math.min(m.hp, s.hp));
  m.st = Math.max(0, Math.min(m.st, s.st));
}
