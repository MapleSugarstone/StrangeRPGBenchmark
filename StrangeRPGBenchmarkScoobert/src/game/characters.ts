// CHARACTERS — the Mender (player) and the three companions.
// Ochre joins at the start (ch1 mentor). Velvet joins ch2, leaves after ch3
// (her debt is called in — she chooses the Orchard to pay it). Marrow joins
// ch4 and takes the Cull's blow at the chapter's end.

import type { UnitBase, Stats, StatKey } from "./types.js";
import type { SpriteStyle } from "../core/sprite.js";

export interface CompanionDef {
  id: string;
  base: UnitBase;
  joinChapter: number;  // chapter in which the companion arrives in the party
  leaveChapter?: number; // chapter after which the companion departs
  statGrowth: Partial<Record<StatKey, number>>; // per-level bonus on top of the base +3 spread
  intro: string;        // dialogue graph id, played when the companion joins
  farewell?: string;    // dialogue graph id, played when the companion leaves
}

export const PLAYER_BASE: UnitBase = {
  name: "Mender",
  title: "a spare thread of Loom Village",
  cls: "mender",
  hp: 30,
  atk: 12,
  def: 9,
  spd: 10,
  wit: 11,
  spriteSeed: 11,
  spriteStyle: "sym" satisfies SpriteStyle,
  colors: ["#101018", "#7fd6c2", "#f2e8c9"],
};

export const PLAYER_GROWTH: Partial<Record<StatKey, number>> = { atk: 1, wit: 1 };

export const COMPANIONS: Record<string, CompanionDef> = {
  ochre: {
    id: "ochre",
    base: {
      name: "Ochre",
      title: "a patchwork godling, last process the god ever loved",
      cls: "ochre",
      hp: 36,
      atk: 10,
      def: 11,
      spd: 8,
      wit: 15,
      spriteSeed: 23,
      spriteStyle: "glyph" satisfies SpriteStyle,
      colors: ["#141018", "#e8a13d", "#f6d9a0"],
    },
    joinChapter: 1,
    statGrowth: { def: 1, wit: 1 },
    intro: "ochre_intro",
  },
  velvet: {
    id: "velvet",
    base: {
      name: "Velvet",
      title: "a rogue thread who calls herself a debt",
      cls: "velvet",
      hp: 24,
      atk: 13,
      def: 7,
      spd: 16,
      wit: 12,
      spriteSeed: 37,
      spriteStyle: "shard" satisfies SpriteStyle,
      colors: ["#12101a", "#a86fd6", "#e39fe8"],
    },
    joinChapter: 2,
    leaveChapter: 3,
    statGrowth: { spd: 2 },
    intro: "velvet_intro",
    farewell: "velvet_farewell",
  },
  marrow: {
    id: "marrow",
    base: {
      name: "Marrow",
      title: "the god's dead hand, made clockwork",
      cls: "marrow",
      hp: 44,
      atk: 12,
      def: 16,
      spd: 6,
      wit: 9,
      spriteSeed: 53,
      spriteStyle: "gear" satisfies SpriteStyle,
      colors: ["#101418", "#8fa3c8", "#d8e2f0"],
    },
    joinChapter: 4,
    statGrowth: { def: 1, hp: 2 },
    intro: "marrow_intro",
  },
};

export const COMPANION_LIST: CompanionDef[] = Object.values(COMPANIONS);

// ---- leveling ----------------------------------------------------------------

// Total stat points granted per level: a flat 3 spread by the engine
// (spd/def/hp first, then atk/wit), plus the character's class growth.
export function xpForLevel(level: number): number {
  return Math.round(25 * Math.pow(level, 1.6));
}

export function applyLevelGrowth(stats: Stats, growth: Partial<Record<StatKey, number>>): void {
  const extra = { ...growth };
  let pool = 3;
  const order: StatKey[] = ["spd", "def", "hp", "atk", "wit"];
  while (pool > 0) {
    for (const k of order) {
      if (pool === 0) break;
      stats[k] += 1;
      pool -= 1;
    }
  }
  for (const k of order) {
    const g = extra[k] ?? 0;
    stats[k] += g;
  }
}

// Base skill set a character knows when they join (everything they've unlocked
// by their join chapter).
export function startingSkills(cls: string, chapter: number): string[] {
  const list: string[] = [];
  if (cls === "mender") {
    list.push("stitch", "mend", "fray");
    if (chapter >= 2) list.push("weave");
    if (chapter >= 3) list.push("reroute");
    if (chapter >= 4) list.push("seamguard");
  } else if (cls === "ochre") {
    list.push("prayer", "grace");
    if (chapter >= 2) list.push("hymn");
    if (chapter >= 3) list.push("lantern");
    if (chapter >= 4) list.push("covenant");
  } else if (cls === "velvet") {
    list.push("pick", "smirk");
    if (chapter >= 3) list.push("longlock", "unravel");
  } else if (cls === "marrow") {
    list.push("clutch", "winding", "takeblow");
  }
  return list;
}
