import { NPC } from '../../engine/maps.js';

export const CH12_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Pusteinn",
    sprite: "brix",
    lines: [
      "The stone is soft here.",
      "It yields to the pick.",
      "We dig deeper.",
    ],
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Hraunyen",
    sprite: "osm",
    lines: [
      "Obsidian cuts.",
      "This clay does not.",
      "It only holds.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Bazaltsalt",
    sprite: "brix",
    lines: [
      "Basalt is heavy.",
      "It sinks.",
      "We must lift it.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Gragranit",
    sprite: "brix",
    lines: [
      "Granite does not break.",
      "This clay does.",
      "It crumbles.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Steygla",
    sprite: "brix",
    lines: [
      "Bricks are fired.",
      "This clay is not.",
      "It is weak.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Krukzan",
    sprite: "brix",
    lines: [
      "Pots hold water.",
      "This clay holds nothing.",
      "It leaks.",
    ],
  },
];
