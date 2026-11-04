import { NPC } from "../../engine/maps";

export const CH2_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Luma",
    sprite: "luma",
    lines: [
      "What does the shadow see that the light ignores?",
      "The stars are wrong. They are too close.",
      "You are a fragment. You remember the shape.",
    ],
    battle: "keeper_nyx",
    flag: "ch2_luma_joins",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Surunme",
    sprite: "brix",
    lines: [
      "Sound bounces off the glass.",
      "It hurts my teeth.",
      "The hollow is singing a bad song.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Aritsun",
    sprite: "shard",
    lines: [
      "Glass cuts. I feel it.",
      "You are loud. You vibrate the air.",
      "I am quiet. I am the crack.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Smime",
    sprite: "vell",
    lines: [
      "Light splits. It does not break.",
      "We are all just angles.",
      "The keeper wants to keep us whole. We are already broken.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Kaysudun",
    sprite: "vell",
    lines: [
      "The mirrors lie.",
      "They show you what you want to see.",
      "I see the dust behind the glass.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Nyx",
    sprite: "vell",
    lines: [
      "Beauty is a function of transparency.",
      "You are opaque. You are ugly.",
      "I will make you clear.",
    ],
    battle: "keeper_nyx",
  },
];
