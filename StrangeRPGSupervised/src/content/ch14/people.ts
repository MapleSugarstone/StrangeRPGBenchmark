import { NPC } from '../../engine/maps.js';

export const CH14_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Plabak",
    sprite: "brix",
    lines: [
      "The plate is cracked.",
      "It holds nothing.",
      "We must fix it.",
    ],
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Ditabak",
    sprite: "osm",
    lines: [
      "The dish is empty.",
      "It waits.",
      "We fill it.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Bolcan",
    sprite: "brix",
    lines: [
      "The cup is full.",
      "It spills.",
      "We must catch it.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Mugkupa",
    sprite: "brix",
    lines: [
      "The mug is heavy.",
      "It holds the weight.",
      "We hold it.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Glanoz",
    sprite: "brix",
    lines: [
      "The jar is sealed.",
      "It holds the past.",
      "We open it.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Flashe",
    sprite: "brix",
    lines: [
      "The bottle is broken.",
      "It leaks.",
      "We must stop it.",
    ],
  },
];
