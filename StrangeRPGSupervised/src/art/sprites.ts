import { ISLAND_TILES } from "./island_tiles.js";
import { DREGS_TILES } from "./dregs_tiles.js";
import { FIND_SPRITES } from "./find_sprite.js";
import { CREATURES } from "./creatures.js";
import { HOUSE_TILES } from "./house_tiles.js";
import { Sprite } from "../engine/sprite.js";
import {
  COLOR_VOID,
  COLOR_SHADOW,
  COLOR_GROUND,
  COLOR_GROUND_LIGHT,
  COLOR_ASH,
  COLOR_GLAZE_DARK,
  COLOR_GLAZE_LIGHT,
  COLOR_KILN_DARK,
  COLOR_KILN_BRIGHT,
  COLOR_KILN_GLOW,
  COLOR_VOID_PURPLE_DARK,
  COLOR_VOID_PURPLE_LIGHT,
  COLOR_RUST,
  COLOR_METAL,
  COLOR_GLASS,
  COLOR_GLASS_LIGHT,
  COLOR_GLAZE_RED,
  COLOR_GLAZE_RED_BRIGHT,
  COLOR_STONE_WHITE,
  COLOR_STONE_DARK,
  COLOR_DREGS_VOID,
  COLOR_DREGS_DUST,
  COLOR_STAR,
  COLOR_STAR_GLOW,
} from "../engine/palette.js";

export const SPRITES: Record<string, Sprite> = {
  // --- PLAYER ---
  // Tall lantern head, small body, one glowing crack on the chest
  shard: {
    colors: [COLOR_STONE_DARK, COLOR_STONE_WHITE, COLOR_KILN_GLOW],
    rows: [
      "..1111..", ".122221.",
      ".123221.", ".122221.",
      "..1111..", "..1111..",
      ".1111111", ".1111111",
    ],
  },

  // --- SLAG PEOPLE ---
  // 1. Brix - Tinkerer, big head, small body, small horns, odd detail: one eye is a gear
  brix: {
    colors: [COLOR_RUST, COLOR_STONE_DARK, COLOR_METAL],
    rows: [
      "..1111..", ".111111.",
      ".131111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", "..1111..",
    ],
  },

  // 2. Vell - Glassblower, big head, small body, pointed ears, odd detail: translucent body
  vell: {
    colors: [COLOR_GLASS, COLOR_STONE_DARK, COLOR_GLASS_LIGHT],
    rows: [
      "..1111..", ".111111.",
      ".121111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", "..1111..",
    ],
  },

  // 3. Osm - Potter, big head, small body, round ears, odd detail: clay smudges
  osm: {
    colors: [COLOR_ASH, COLOR_STONE_DARK, COLOR_GLAZE_DARK],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 4. Kest - Mason, big head, small body, square head, odd detail: stone cracks
  kest: {
    colors: [COLOR_STONE_DARK, COLOR_STONE_WHITE, COLOR_SHADOW],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // Vraal, the travelling quencher: the people's shape in the colors of the quench liquid.
  vraal: {
    colors: [COLOR_METAL, COLOR_GLASS_LIGHT, COLOR_GLASS],
    rows: [
      "..1111..", ".111111.",
      ".121121.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 5. Luma - Astronomer, big head, small body, long hair, odd detail: star in hair
  luma: {
    colors: [COLOR_VOID_PURPLE_DARK, COLOR_VOID_PURPLE_LIGHT, COLOR_STAR],
    rows: [
      "..1111..", ".111111.",
      ".121111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // --- RUIN SPECIES (Chapter 1) ---
  // 1. Glass Sentinel - Stone and glaze, one clear pixel crack
  glass_sentinel: {
    colors: [COLOR_GLASS, COLOR_STONE_DARK, COLOR_GLASS_LIGHT],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 2. Rust Crawler - Metal and rust, one clear pixel crack
  rust_crawler: {
    colors: [COLOR_RUST, COLOR_STONE_DARK, COLOR_METAL],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 3. Ash Wisp - Stone and ash, one clear pixel crack
  ash_wisp: {
    colors: [COLOR_ASH, COLOR_STONE_DARK, COLOR_KILN_DARK],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 4. Kiln Imp - Fire and glaze, one clear pixel crack
  kiln_imp: {
    colors: [COLOR_KILN_DARK, COLOR_STONE_DARK, COLOR_KILN_BRIGHT],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 5. Ash Spitter - Stone and ash, small
  ash_spitter: {
    colors: [COLOR_ASH, COLOR_SHADOW, COLOR_GROUND],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 6. Dust Mite - Stone and shadow, tiny
  dust_mite: {
    colors: [COLOR_SHADOW, COLOR_VOID, COLOR_GROUND],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 7. Silica Husk - Aether and glass, hollow
  silica_husk: {
    colors: [COLOR_GLASS_LIGHT, COLOR_VOID_PURPLE_DARK, COLOR_GLASS],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 8. Oxide Mite - Metal and rust, small
  oxide_mite: {
    colors: [COLOR_RUST, COLOR_METAL, COLOR_SHADOW],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 9. Clay Strider - Wood and ash, muddy
  clay_strider: {
    colors: [COLOR_ASH, COLOR_GLAZE_DARK, COLOR_SHADOW],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 10. Kiln Rat - Fire and ash, small
  kiln_rat: {
    colors: [COLOR_KILN_DARK, COLOR_ASH, COLOR_KILN_BRIGHT],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 11. Granite Warden - Stone and shadow, large
  granite_warden: {
    colors: [COLOR_STONE_DARK, COLOR_SHADOW, COLOR_GROUND],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // 12. Schist Flyer - Aether and stone, small
  schist_flyer: {
    colors: [COLOR_GLASS_LIGHT, COLOR_STONE_DARK, COLOR_ASH],
    rows: [
      "..1111..", ".111111.",
      ".111111.", ".111111.",
      "..1111..", "..1111..",
      ".111111.", ".111111.",
    ],
  },

  // --- FIELD TILES ---
  // 1. Ash ground
  tile_ash_ground: {
    colors: [COLOR_ASH, COLOR_SHADOW],
    rows: [
      "11211211", "21121121",
      "11211211", "21121121",
      "11211211", "21121121",
      "11211211", "21121121",
    ],
  },

  // 2. Second ash ground (darker)
  tile_ash_ground_dark: {
    colors: [COLOR_SHADOW, COLOR_VOID],
    rows: [
      "11211211", "21121121",
      "11211211", "21121121",
      "11211211", "21121121",
      "11211211", "21121121",
    ],
  },

  // 3. Cracked ground with glowing Weep
  tile_cracked_ground: {
    colors: [COLOR_SHADOW, COLOR_KILN_GLOW],
    rows: [
      "11111111", "11111111",
      "11211211", "11111111",
      "11111111", "11211211",
      "11111111", "11111111",
    ],
  },

  // 4. Wall
  tile_wall: {
    colors: [COLOR_SHADOW, COLOR_GROUND, COLOR_GROUND_LIGHT],
    rows: [
      "11111111", // 0
      "12111121", // 1
      "11111111", // 2
      "11211211", // 3
      "11111111", // 4
      "12111121", // 5
      "11111111", // 6
      "11111111", // 7
    ],
  },

  // 5. Pillar
  tile_pillar: {
    colors: [COLOR_SHADOW, COLOR_GLASS, COLOR_GLASS_LIGHT],
    rows: [
      "..1111..", ".111111.",
      ".121111.", ".111111.",
      ".111111.", ".111111.",
      ".111111.", ".111111.",
    ],
  },

  // 6. Lamp post
  tile_lamp_post: {
    colors: [COLOR_SHADOW, COLOR_KILN_GLOW, COLOR_KILN_DARK],
    rows: [
      "....1...", // 0
      "...11...", // 1
      "...12...", // 2
      "...12...", // 3
      "...12...", // 4
      "...12...", // 5
      "...12...", // 6
      "...1111.", // 7
    ],
  },

  // 7. Dregs (void at island's edge)
  tile_dregs: {
    colors: [COLOR_DREGS_VOID, COLOR_DREGS_DUST],
    rows: [
      "11211211", "21121121",
      "11211211", "21121121",
      "11211211", "21121121",
      "11211211", "21121121",
    ],
  },
  // 8. Grass (tall ash with cracks)
  tile_grass: {
    colors: [COLOR_ASH, COLOR_GROUND_LIGHT, COLOR_SHADOW],
    rows: [
      "..1111..", ".1121121",
      "11121121", "12112112",
      "11121121", ".1121121",
      "..1111..", "......1.",
    ],
  },
  // Hand-drawn creatures replace any earlier sprite with the same key.
  ...CREATURES,
  ...HOUSE_TILES,
  ...ISLAND_TILES,
  ...DREGS_TILES,
  ...FIND_SPRITES,
};
