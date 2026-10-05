// SKILLS — every move a party member can make.
//
// COST CURRENCY: "thread" in ch1-2, "flux" in ch3+ (same number, different name).
// The party gains thread/flux each battle and a trickle on the map.
// power: damage skills = base damage before element/buffs; "heal" = % of max hp.

import type { Skill } from "./types.js";

export const SKILLS: Skill[] = [
  // ------------------------------------------------ MENDER (the player) ----
  {
    id: "stitch", name: "Stitch",
    desc: "One clean pull of the needle. Reliable, honest work.",
    power: 20, element: "null", target: "enemy", cost: 1, accuracy: 0.95,
    unlockChapter: 1,
  },
  {
    id: "mend", name: "Mend",
    desc: "Knot a companion back together. 40% of their max hp.",
    power: 0, element: "null", target: "ally", cost: 4, accuracy: 1,
    effect: { kind: "heal", chance: 1, power: 40 },
    unlockChapter: 1,
  },
  {
    id: "fray", name: "Fray",
    desc: "Loosen the threads of a foe until they rot. Often poisons.",
    power: 18, element: "null", target: "enemy", cost: 3, accuracy: 0.9,
    effect: { kind: "poison", chance: 0.6, power: 3 },
    unlockChapter: 1,
  },
  {
    id: "weave", name: "Weave",
    desc: "A spreading pattern that hits every enemy at once.",
    power: 26, element: "bloom", target: "all-enemies", cost: 6, accuracy: 0.85,
    unlockChapter: 2,
  },
  {
    id: "reroute", name: "Reroute",
    desc: "Redirect a thread so the damage comes back to you. Drains.",
    power: 45, element: "bloom", target: "enemy", cost: 8, accuracy: 0.9,
    effect: { kind: "drain", chance: 1, power: 0.6 },
    unlockChapter: 3,
  },
  {
    id: "seamguard", name: "Seamguard",
    desc: "Hem the party in. Everyone's defense rises for 3 turns.",
    power: 0, element: "null", target: "all-allies", cost: 7, accuracy: 1,
    effect: { kind: "defUp", chance: 1, power: 3 },
    unlockChapter: 4,
  },
  {
    id: "laststitch", name: "Last Stitch",
    desc: "The whole pattern, all at once. Every living ally heals 80%.",
    power: 0, element: "null", target: "all-allies", cost: 12, accuracy: 1,
    effect: { kind: "heal", chance: 1, power: 80 },
    unlockChapter: 5,
  },
  {
    id: "otherway", name: "The Other Way",
    desc: "Hold the needle in your hand in the other way. Devastating, and the target grows frail.",
    power: 60, element: "void", target: "enemy", cost: 10, accuracy: 0.9,
    effect: { kind: "frail", chance: 0.5, power: 3 },
    unlockChapter: 5,
  },

  // ------------------------------------------------ OCHRE (mentor, ch1) ----
  {
    id: "prayer", name: "Prayer",
    desc: "An old prayer, worn smooth. Heals one ally for 35% of max hp.",
    power: 0, element: "null", target: "ally", cost: 4, accuracy: 1,
    effect: { kind: "heal", chance: 1, power: 35 },
    unlockChapter: 1,
  },
  {
    id: "grace", name: "Godling's Grace",
    desc: "She folds herself around you like a coat. Defense up 3 turns.",
    power: 0, element: "null", target: "self", cost: 4, accuracy: 1,
    effect: { kind: "defUp", chance: 1, power: 3 },
    unlockChapter: 1,
  },
  {
    id: "hymn", name: "Hymn for the Fray",
    desc: "A small song for the badly mended. All living allies heal 25%.",
    power: 0, element: "null", target: "all-allies", cost: 9, accuracy: 1,
    effect: { kind: "heal", chance: 1, power: 25 },
    unlockChapter: 2,
  },
  {
    id: "lantern", name: "Lantern",
    desc: "A soft light that hits everyone and often puts them to sleep.",
    power: 22, element: "bloom", target: "all-enemies", cost: 7, accuracy: 0.85,
    effect: { kind: "sleep", chance: 0.4, power: 2 },
    unlockChapter: 3,
  },
  {
    id: "covenant", name: "Covenant",
    desc: "A promise with teeth. Ochre's attack rises for 3 turns.",
    power: 0, element: "null", target: "self", cost: 8, accuracy: 1,
    effect: { kind: "atkUp", chance: 1, power: 3 },
    unlockChapter: 4,
  },
  {
    id: "lastprayer", name: "Last Prayer",
    desc: "The one she was afraid to use. Every living ally heals 70%.",
    power: 0, element: "null", target: "all-allies", cost: 12, accuracy: 1,
    effect: { kind: "heal", chance: 1, power: 70 },
    unlockChapter: 5,
  },

  // ------------------------------------------------ VELVET (rogue, ch2) ----
  {
    id: "pick", name: "Pick",
    desc: "A lockpick to the joint. Fast, and it slows the target.",
    power: 28, element: "null", target: "enemy", cost: 3, accuracy: 0.95,
    effect: { kind: "spdDown", chance: 0.7, power: 2 },
    unlockChapter: 2,
  },
  {
    id: "smirk", name: "Smirk",
    desc: "She grins just before it lands. A static hit that can stun.",
    power: 22, element: "static", target: "enemy", cost: 5, accuracy: 0.85,
    effect: { kind: "stun", chance: 0.3, power: 1 },
    unlockChapter: 2,
  },
  {
    id: "longlock", name: "Long Lock",
    desc: "A long, patient lock. Heavy static hit; the target's speed collapses.",
    power: 38, element: "static", target: "enemy", cost: 6, accuracy: 0.9,
    effect: { kind: "spdDown", chance: 1, power: 4 },
    unlockChapter: 3,
  },
  {
    id: "unravel", name: "Unravel",
    desc: "Pick the seams out of everyone at once. Hits all enemies; often makes them frail.",
    power: 18, element: "void", target: "all-enemies", cost: 8, accuracy: 0.85,
    effect: { kind: "frail", chance: 0.6, power: 2 },
    unlockChapter: 3,
  },

  // ------------------------------------------------ MARROW (hand, ch4) ----
  {
    id: "clutch", name: "Clutch",
    desc: "The hand grips. Marrow's attack rises for 3 turns.",
    power: 0, element: "null", target: "self", cost: 4, accuracy: 1,
    effect: { kind: "atkUp", chance: 1, power: 3 },
    unlockChapter: 4,
  },
  {
    id: "winding", name: "Winding",
    desc: "It winds itself up, and you can hear it doing so. Heals itself 35% of max hp.",
    power: 0, element: "null", target: "self", cost: 5, accuracy: 1,
    effect: { kind: "heal", chance: 1, power: 35 },
    unlockChapter: 4,
  },
  {
    id: "takeblow", name: "Take the Blow",
    desc: "The clockwork takes the hit that was meant for you. A shield of 100% max hp for 2 turns.",
    power: 0, element: "null", target: "ally", cost: 8, accuracy: 1,
    effect: { kind: "shield", chance: 1, power: 1.0 },
    unlockChapter: 4,
  },
  {
    id: "overwound", name: "Overwound",
    desc: "It was only ever meant to carry. It carries anyway. Marrow's attack rises for 4 turns.",
    power: 0, element: "null", target: "self", cost: 9, accuracy: 1,
    effect: { kind: "atkUp", chance: 1, power: 4 },
    unlockChapter: 5,
  },
];

// Basic attack everyone gets for free (cost 0): the class's default swing.
export const BASIC_SKILLS: Record<string, Skill> = {
  mender: {
    id: "basic-mender", name: "Pull",
    desc: "Pull the thread. No cost, no fuss.",
    power: 14, element: "null", target: "enemy", cost: 0, accuracy: 1,
    unlockChapter: 1,
  },
  ochre: {
    id: "basic-ochre", name: "Pat",
    desc: "A small, warm pat. Sometimes it heals a little.",
    power: 10, element: "null", target: "enemy", cost: 0, accuracy: 1,
    effect: { kind: "heal", chance: 0.25, power: 10 },
    unlockChapter: 1,
  },
  velvet: {
    id: "basic-velvet", name: "Nudge",
    desc: "A nudge in a bad direction.",
    power: 14, element: "null", target: "enemy", cost: 0, accuracy: 1,
    unlockChapter: 2,
  },
  marrow: {
    id: "basic-marrow", name: "Press",
    desc: "The hand presses. It has done a great deal of pressing.",
    power: 18, element: "null", target: "enemy", cost: 0, accuracy: 1,
    unlockChapter: 4,
  },
};

export function getSkill(id: string): Skill {
  const s = SKILLS.find((x) => x.id === id) ?? BASIC_SKILLS[Object.keys(BASIC_SKILLS).find((k) => BASIC_SKILLS[k] && BASIC_SKILLS[k].id === id) ?? ""];
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}

export function skillsFor(cls: string, chapter: number): Skill[] {
  const all = [BASIC_SKILLS[cls], ...SKILLS.filter((s) => classOfSkill(s) === cls && s.unlockChapter <= chapter)];
  return all.filter((s): s is Skill => !!s);
}

function classOfSkill(s: Skill): string | undefined {
  // skills are grouped by file order; map id prefix -> class
  const table: Record<string, string> = {
    stitch: "mender", mend: "mender", fray: "mender", weave: "mender",
    reroute: "mender", seamguard: "mender", laststitch: "mender", otherway: "mender",
    prayer: "ochre", grace: "ochre", hymn: "ochre", lantern: "ochre",
    covenant: "ochre", lastprayer: "ochre",
    pick: "velvet", smirk: "velvet", longlock: "velvet", unravel: "velvet",
    clutch: "marrow", winding: "marrow", takeblow: "marrow", overwound: "marrow",
  };
  return table[s.id];
}

export function allSkillIds(cls: string): string[] {
  return [BASIC_SKILLS[cls].id, ...SKILLS.filter((s) => classOfSkill(s) === cls).map((s) => s.id)];
}
