import { NPC } from "../../engine/maps";

export const CH3_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Osm",
    sprite: "osm",
    lines: [
      "The clay remembers the water.",
      "The water remembers the sky.",
      "You are dry. You need to be molded.",
    ],
    battle: "keeper_bram",
    flag: "ch3_osm_joins",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Smime",
    sprite: "osm",
    lines: [
      "Mud is soft until it dries.",
      "Then it is hard as bone.",
      "The golem is too dry. It cracks.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Krukzan",
    sprite: "osm",
    lines: [
      "I make bowls. I make jars.",
      "I make cages.",
      "The keeper makes cages for the weeps.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Kiluofn",
    sprite: "brix",
    lines: [
      "Fire is hot.",
      "Mud is wet.",
      "Put them together and you get brick.",
      "Put a weep in the fire and you get dust.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Motunma",
    sprite: "osm",
    lines: [
      "The shape is in the mind.",
      "The mind is in the clay.",
      "The clay is in the mound.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Bram",
    sprite: "osm",
    lines: [
      "Everything has potential.",
      "Even the dust.",
      "Even the golem.",
    ],
    battle: "keeper_bram",
  },
];
