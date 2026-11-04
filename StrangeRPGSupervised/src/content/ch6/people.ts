import { NPC } from "../../engine/maps.js";

export const CH6_PEOPLE: NPC[] = [
  {
    x: 14,
    y: 10,
    dir: "right",
    name: "Tor",
    sprite: "brix",
    lines: [
      "The machine is broken.",
      "I can fix it if you bring me five cinders.",
      "The Weep near the forge is hot today.",
    ],
    battle: "keeper_tor",
    flag: "ch6_tor_talked",
  },
  {
    x: 10,
    y: 10,
    dir: "right",
    name: "Smime",
    sprite: "brix",
    lines: [
      "Heat is energy.",
      "Energy is power.",
      "Power is control.",
    ],
  },
  {
    x: 18,
    y: 10,
    dir: "left",
    name: "Kaysudun",
    sprite: "osm",
    lines: [
      "The metal is soft.",
      "The fire is hot.",
      "Put them together and you get steel.",
      "Put a weep in the fire and you get dust.",
    ],
  },
  {
    x: 14,
    y: 14,
    dir: "up",
    name: "Lelodun",
    sprite: "brix",
    lines: [
      "I solder the joints.",
      "I weld the seams.",
      "I hold the world together.",
    ],
  },
  {
    x: 14,
    y: 16,
    dir: "down",
    name: "Parsun",
    sprite: "vell",
    lines: [
      "The surface is smooth.",
      "The inside is rough.",
      "The weep is rough inside.",
    ],
  },
  {
    x: 14,
    y: 18,
    dir: "up",
    name: "Sofnunme",
    sprite: "kest",
    lines: [
      "I grind the ore.",
      "I grind the stone.",
      "I grind the bones.",
    ],
  },
];
