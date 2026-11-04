import { NPC } from '../../engine/maps.js';

export const CH11_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Shegun",
    sprite: "brix",
    lines: [
      "The mud is deep today.",
      "It remembers the shape of the last pot.",
      "We must make it forget.",
    ],
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Motunma",
    sprite: "osm",
    lines: [
      "The clay remembers the water.",
      "This mire remembers nothing.",
      "It just holds.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Blasturme",
    sprite: "brix",
    lines: [
      "Blowing the mud dry takes time.",
      "I have no time.",
      "The Weep is loud.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Maltal",
    sprite: "brix",
    lines: [
      "Metal does not rot.",
      "This mud does.",
      "It eats the metal.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Kokir",
    sprite: "brix",
    lines: [
      "Copper is soft.",
      "It bends to the mud.",
      "We must be harder.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Gusilfur",
    sprite: "brix",
    lines: [
      "Silver shines in the dark.",
      "The mire has no dark.",
      "It has only mud.",
    ],
  },
];
