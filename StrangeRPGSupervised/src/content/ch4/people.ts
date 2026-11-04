import { NPC } from "../../engine/maps";

export const CH4_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Grom",
    sprite: "kest",
    lines: [
      "Stone does not lie.",
      "Stone breaks.",
      "You are a crack in the stone.",
    ],
    battle: "keeper_grom",
    flag: "ch4_grom_defeated",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Gragranit",
    sprite: "kest",
    lines: [
      "The rock is hard.",
      "The pick is soft.",
      "The rock wins.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Heroda",
    sprite: "kest",
    lines: [
      "The door is closed.",
      "The key is broken.",
      "The stone remembers the lock.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Pusteinn",
    sprite: "kest",
    lines: [
      "Granite is old.",
      "It has seen the kiln pour.",
      "It has seen the cracks.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Shegun",
    sprite: "kest",
    lines: [
      "I build walls.",
      "I build towers.",
      "I build graves.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Grom",
    sprite: "kest",
    lines: [
      "The seal is strong.",
      "The stone is permanent.",
      "You are temporary.",
    ],
    battle: "keeper_grom",
  },
];
