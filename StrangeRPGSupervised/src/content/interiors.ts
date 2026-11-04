// Hut rooms, one per town, written by tools/build_towns.mjs.
import type { MapData } from "../engine/maps.js";

export const INTERIORS: Record<string, MapData> = {
  "ashen_reach_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "ashen_reach_1", destX: 14, destY: 8 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Ashen Reach. The sand drinks the heat. Pay to cool the stone.",
        ],
        quench: true,
      },
    ],
  },
  "silica_hollow_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "silica_hollow_1", destX: 6, destY: 8 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Silica Hollow. Glass cracks if cooled too fast. I am careful.",
        ],
        quench: true,
      },
    ],
  },
  "mud_mound_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "mud_mound_1", destX: 9, destY: 13 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Mud Mound. The clay needs binding. Cinder buys the binding.",
        ],
        quench: true,
      },
    ],
  },
  "granite_vault_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "granite_vault_1", destX: 26, destY: 18 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Granite Vault. Hard rock needs patience. 100 for a layer.",
        ],
        quench: true,
      },
    ],
  },
  "schist_spire_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "schist_spire_1", destX: 17, destY: 24 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Schist Spire. The wind strips heat. I add the rest.",
        ],
        quench: true,
      },
    ],
  },
  "basalt_forge_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "basalt_forge_1", destX: 7, destY: 10 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Kael",
        sprite: "kael",
        lines: [
          "Bring your heat.",
          "Leave your weak parts.",
        ],
        forge: true,
      },
      {
        x: 14,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Basalt Forge. Fire fears the liquid. Pay to quench the flame.",
        ],
        quench: true,
      },
    ],
  },
  "oxide_belt_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "oxide_belt_1", destX: 27, destY: 5 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Oxide Belt. Rust needs dry cold. 100 for the dry cold.",
        ],
        quench: true,
      },
    ],
  },
  "rust_anchor_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "rust_anchor_1", destX: 7, destY: 11 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Rust Anchor. The tide brings the cold. I sell the depth.",
        ],
        quench: true,
      },
    ],
  },
  "slag_heap_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "slag_heap_1", destX: 26, destY: 8 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Slag Heap. Waste turns to value. 100 for the transformation.",
        ],
        quench: true,
      },
    ],
  },
  "vitreous_reach_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "vitreous_reach_1", destX: 13, destY: 5 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Vitreous Reach. Clear minds need clear cooling. Pay the fee.",
        ],
        quench: true,
      },
    ],
  },
  "pug_mire_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "pug_mire_1", destX: 23, destY: 15 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Pug Mire. The mud hardens. 100 to make it strong.",
        ],
        quench: true,
      },
    ],
  },
  "clay_deep_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "clay_deep_1", destX: 14, destY: 6 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Clay Deep. Darkness holds heat. I take the heat away.",
        ],
        quench: true,
      },
    ],
  },
  "kiln_edge_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "kiln_edge_1", destX: 30, destY: 11 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Kael",
        sprite: "kael",
        lines: [
          "Bring your heat.",
          "Leave your weak parts.",
        ],
        forge: true,
      },
      {
        x: 14,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "The Kiln's Edge. The center burns. Cool it. Pay me.",
        ],
        quench: true,
      },
    ],
  },
  "ashen_reach_heart_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "ashen_reach_heart_1", destX: 21, destY: 16 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Ashen Reach. You return to the start. The heat remains.",
        ],
        quench: true,
      },
    ],
  },
  "the_dregs_undercroft_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "the_dregs_undercroft_1", destX: 34, destY: 7 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "The vessel rots. The void feeds.",
        ],
        quench: true,
      },
    ],
  },
  "the_dregs_trench_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "the_dregs_trench_1", destX: 19, destY: 16 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "The quencher drinks the light here. There is nothing left to burn.",
        ],
        quench: true,
      },
    ],
  },
  "the_dregs_core_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "the_dregs_core_1", destX: 11, destY: 9 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "The Vessel bleeds void. We must stitch it shut.",
        ],
        quench: true,
      },
    ],
  },
  "the_dregs_depths_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "the_dregs_depths_1", destX: 12, destY: 21 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "Quench the flame, or become the ash.",
        ],
        quench: true,
      },
    ],
  },
  "the_dregs_glass_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "the_dregs_glass_1", destX: 5, destY: 5 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "The vessel bleeds light.",
        ],
        quench: true,
      },
    ],
  },
  "the_dregs_rift_1_hut": {
    width: 24,
    height: 24,
    rows: [
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 0
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 1
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 2
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 3
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 4
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 5
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 6
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 7
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 8
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 9
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 10
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 11
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 12
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 13
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 14
      "QQQQQQFFFFFFFFFFFFQQQQQQ", // 15
      "QQQQQQQQQQQEQQQQQQQQQQQQ", // 16
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 17
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 18
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 19
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 20
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 21
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 22
      "QQQQQQQQQQQQQQQQQQQQQQQQ", // 23
    ],
    warps: [
      { x: 11, y: 16, destMap: "the_dregs_rift_1", destX: 26, destY: 24 },
    ],
    encounters: [
    ],
    npcs: [
      {
        x: 8,
        y: 9,
        dir: "down",
        name: "Vraal",
        sprite: "vraal",
        lines: [
          "The vessel leaks. We must seal it.",
        ],
        quench: true,
      },
    ],
  },
};
