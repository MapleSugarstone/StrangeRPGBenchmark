import { NPC } from "../../engine/maps.js";

export const CH9_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Brix",
    sprite: "brix",
    lines: [
      "The machine is broken.",
      "I can fix it.",
      "The Weep is loud.",
    ],
    battle: "keeper_dun",
    flag: "ch9_brix_talked",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Slagruf",
    sprite: "brix",
    lines: [
      "The slag is hot.",
      "The heat is bad.",
      "The heat is good.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Skoma",
    sprite: "osm",
    lines: [
      "The scoria is sharp.",
      "The sharpness cuts.",
      "The cut is deep.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Pusteinn",
    sprite: "brix",
    lines: [
      "The pumice floats.",
      "The floating is good.",
      "The floating is safe.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Hraunyen",
    sprite: "vell",
    lines: [
      "The obsidian is black.",
      "The black is dark.",
      "The dark is cold.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Bazaltsalt",
    sprite: "kest",
    lines: [
      "The basalt is hard.",
      "The hardness is strong.",
      "The strong is good.",
    ],
  },
];
