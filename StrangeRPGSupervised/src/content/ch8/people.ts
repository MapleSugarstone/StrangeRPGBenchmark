import { NPC } from "../../engine/maps.js";

export const CH8_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Syl",
    sprite: "brix",
    lines: [
      "The tide is coming in.",
      "The ships are ready.",
      "The Weep is restless.",
    ],
    battle: "keeper_syl",
    flag: "ch8_syl_talked",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Hvaligi",
    sprite: "brix",
    lines: [
      "The shark is hungry.",
      "The water is deep.",
      "The anchor is heavy.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Bahvalur",
    sprite: "osm",
    lines: [
      "The whale sings.",
      "The song is old.",
      "The song is sad.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Delnus",
    sprite: "brix",
    lines: [
      "The dolphin jumps.",
      "The jump is high.",
      "The jump is fast.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Semuhur",
    sprite: "vell",
    lines: [
      "The seal sleeps.",
      "The sleep is deep.",
      "The seal is warm.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Raekdes",
    sprite: "kest",
    lines: [
      "The shrimp hides.",
      "The hiding is good.",
      "The hiding is safe.",
    ],
  },
];
