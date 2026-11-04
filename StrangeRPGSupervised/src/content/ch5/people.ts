import { NPC } from "../../engine/maps";

export const CH5_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Kest",
    sprite: "kest",
    lines: [
      "Stone does not lie.",
      "Stone breaks.",
      "The wind is loud.",
    ],
    battle: "keeper_kyr",
    flag: "ch5_kest_joins",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Vingar",
    sprite: "shard",
    lines: [
      "The air moves.",
      "The stone stays.",
      "The air wins.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Skugge",
    sprite: "kest",
    lines: [
      "The peak is high.",
      "The drop is deep.",
      "The fall is fast.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Hraunyen",
    sprite: "kest",
    lines: [
      "Schist splits.",
      "It splits along the grain.",
      "The grain is the history.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Tikaplan",
    sprite: "kest",
    lines: [
      "I climb up.",
      "I climb down.",
      "I do not look at the drop.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Kyr",
    sprite: "luma",
    lines: [
      "The stars are wrong.",
      "The sky is a shell.",
      "The void is inside.",
    ],
    battle: "keeper_kyr",
  },
];
