// CHAPTERS — the five chapters of PATCHWORK, tying maps, companions, and
// mechanics together. heroStage is the Hero's Journey beat each chapter
// lives on (see story.ts HERO_JOURNEY); circle is the STORY_CIRCLES key
// whose 8 beats dialogue.ts follows. `companions` are the companion ids
// that may be in the party during the chapter (velvet leaves after ch3);
// partyCap is the max number of companions, Mender excluded.

import type { ChapterDef } from "./types.js";
import { MAP_BY_CHAPTER } from "./maps.js";

export const CHAPTERS: ChapterDef[] = [
  {
    id: "ch1",
    name: "The First Seam",
    tagline: "A maze of abandoned patterns, and the wound that opens it.",
    circle: "ch1",
    heroStage: "The Call to Adventure",
    map: MAP_BY_CHAPTER[1],
    companions: ["ochre"],
    partyCap: 1,
    mechanics: ["thread"],
    enemyLevel: 1,
    reward: { xp: 60, thread: 20, credits: 40 },
  },
  {
    id: "ch2",
    name: "The Orchard",
    tagline: "Spores the size of doors, and a garden that is a factory with a pretty sign.",
    circle: "ch2",
    heroStage: "Tests, Allies, Enemies",
    map: MAP_BY_CHAPTER[2],
    companions: ["ochre", "velvet"],
    partyCap: 2,
    mechanics: ["sporefall"],
    enemyLevel: 2.6,
    reward: { xp: 120, thread: 35, credits: 70 },
  },
  {
    id: "ch3",
    name: "The Drowned Square",
    tagline: "A city of glass under water that isn't water. It is very quiet here.",
    circle: "ch3",
    heroStage: "The Ordeal",
    map: MAP_BY_CHAPTER[3],
    companions: ["ochre", "velvet"], // velvet leaves at the chapter's end
    partyCap: 2,
    mechanics: ["bloomskin"],
    enemyLevel: 3.8,
    reward: { xp: 200, thread: 50, credits: 110 },
  },
  {
    id: "ch4",
    name: "The Crossing",
    tagline: "A storm that eats patterns, and a dead hand that offers to carry you.",
    circle: "ch4",
    heroStage: "The Reward",
    map: MAP_BY_CHAPTER[4],
    companions: ["ochre", "marrow"],
    partyCap: 3,
    mechanics: ["static_storm"],
    enemyLevel: 4,
    reward: { xp: 320, thread: 70, credits: 160 },
  },
  {
    id: "ch5",
    name: "The Loom",
    tagline: "The center of the world. The Cull at the door. The Dream, waking.",
    circle: "ch5",
    heroStage: "Return with the Elixir",
    map: MAP_BY_CHAPTER[5],
    companions: ["ochre", "marrow"],
    partyCap: 3,
    mechanics: ["unweaving"],
    enemyLevel: 4.6,
    reward: { xp: 500, thread: 100, credits: 250 },
  },
];

export const CHAPTER_BY_NUMBER: Record<number, ChapterDef> = Object.fromEntries(
  CHAPTERS.map((c, i) => [i + 1, c]),
);

export function chapterById(id: string): ChapterDef {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown chapter: ${id}`);
  return c;
}
