import { NPC } from "../../engine/maps.js";

export const CH10_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Vell",
    sprite: "brix",
    lines: [
      "The glass is clear.",
      "The clarity burns.",
      "The Weep is hot.",
    ],
    battle: "keeper_grom_lieutenant",
    flag: "ch10_vell_talked",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Glanoz",
    sprite: "brix",
    lines: [
      "The jar is empty.",
      "The empty is bad.",
      "The empty is good.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Flashe",
    sprite: "osm",
    lines: [
      "The bottle is full.",
      "The full is heavy.",
      "The heavy is bad.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Tunril",
    sprite: "brix",
    lines: [
      "The barrel is round.",
      "The round is good.",
      "The good is safe.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Sankista",
    sprite: "vell",
    lines: [
      "The chest is locked.",
      "The lock is hard.",
      "The hard is strong.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Kaskutu",
    sprite: "kest",
    lines: [
      "The box is small.",
      "The small is light.",
      "The light is fast.",
    ],
  },
];
