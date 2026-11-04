// Written by tools/apply_sprites.py from design/sprites/*.json: each creature as Qwen drew it, part by part.
import { Sprite } from "../engine/sprite.js";
import * as P from "../engine/palette.js";

export const CREATURES: Record<string, Sprite> = {
  abyssal_mirror: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_GLASS, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...12...",
      "..1221..", "..11.1..",
      "..1321..", "..11.1..",
      "...123..", "....2...",
    ],
  },
  aether_fracture: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_GLASS, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...33...",
      "..1212..", ".223322.",
      "..1212..", "..2121..",
      "..2..2..", "...22...",
    ],
  },
  aether_spitter: {
    colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "1.1212.1", ".222312.",
      "..1312..", "..2221..",
      "..1..1..", "........",
    ],
  },
  anchor_barnacle: {
    colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", ".3.....3",
      "..311.3.", "..1313..",
      ".113131.", ".112221.",
      "..1.111.", "........",
    ],
  },
  ash_crawler: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW, P.COLOR_VOID],
    rows: [
      "........", "........",
      "211111.2", "2112112.",
      "2112112.", ".22.22..",
      ".11.11..", "........",
    ],
  },
  ash_knee: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "..3.....", "..1333..",
      "..31113.", ".332213.",
      "..322133", "..32213.",
      "..33333.", ".....3..",
    ],
  },
  ash_lung: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "..3..3..",
      "..1222..", "..2331..",
      "..1212..", "..23.1..",
      "..1..1..", ".1....1.",
    ],
  },
  ash_shard: {
    colors: [P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STAR, P.COLOR_STAR_GLOW],
    rows: [
      "...11...", "..1111..",
      ".131313.", "13132313",
      ".113231.", "..31313.",
      "...11...", "........",
    ],
  },
  ash_spitter: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "...13...", "..2121..",
      "11112111", "11111111",
      ".111111.", ".111111.",
      "..1111..", "........",
    ],
  },
  ash_vein: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID, P.COLOR_GLAZE_RED_BRIGHT],
    rows: [
      "...3....", "...3....",
      "..1312..", ".22321..",
      "..12322.", "..2131..",
      "....3...", "....3...",
    ],
  },
  ash_weaver: {
    colors: [P.COLOR_GROUND, P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "2.......",
      ".2...3.2", "..21312.",
      "..1..3..", "..21212.",
      ".2.....2", "2.......",
    ],
  },
  ash_wisp: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_SHADOW, P.COLOR_KILN_GLOW],
    rows: [
      "........", "..22....",
      ".212122.", "..2331..",
      "..1332..", "..212222",
      "..222222", "........",
    ],
  },
  ash_wisp_2: {
    colors: [P.COLOR_DREGS_DUST, P.COLOR_ASH, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..2222..", ".12.321.",
      ".133.33.", "..2222..",
      "...3.3..", "........",
    ],
  },
  basalt_cyst: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..1332..", ".11..11.",
      ".113311.", ".1111111",
      ".1....1.", "..1....1",
    ],
  },
  basalt_golem: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...11...",
      ".1.3.31.", ".113111.",
      ".111.11.", ".111131.",
      "..1111..", "........",
    ],
  },
  basalt_vent: {
    colors: [P.COLOR_GROUND, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "..1121..", "..1221..",
      "1....21.", "1....33.",
      "1111123.", "1111111.",
      "1111111.", "........",
    ],
  },
  blind_coral: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...1111.",
      "..113111", ".1111111",
      ".212122.", "11222111",
      "11111211", "........",
    ],
  },
  bone_clay: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_GLASS_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      ".222121.", ".122212.",
      ".21.1211", "11222113",
      "11121113", "........",
    ],
  },
  brine_bulb: {
    colors: [P.COLOR_GLAZE_LIGHT, P.COLOR_GLAZE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...33...", "..2221..",
      ".31212..", "..21213.",
      "...22...", "..2..2..",
    ],
  },
  cinder_ankle: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      ".212131.", ".321213.",
      ".212121.", ".122222.",
      "..2232..", "...2333.",
    ],
  },
  cinder_wisp: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "...1....", "..1111..",
      "..13311.", ".1133111",
      "..1..11.", "....1...",
      "........", "........",
    ],
  },
  clay_golem: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...3..2.",
      "..1311..", "212221..",
      "111312..", "..2221..",
      "..13....", "...31...",
    ],
  },
  clay_rat: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_GLOW, P.COLOR_KILN_DARK],
    rows: [
      ".....2..", "..112...",
      ".122111.", "11....11",
      "11131311", "1231312.",
      "........", "........",
    ],
  },
  clay_strider: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_GLAZE_RED],
    rows: [
      "........", "...33...",
      "..1212..", "..2331..",
      "..1..2..", "..2123..",
      "..1..1..", ".2....2.",
    ],
  },
  clay_vein: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_GROUND, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", "...22...",
      "........", ".221212.",
      ".21..22.", "..2321..",
      "..2222..", "........",
    ],
  },
  clay_worm: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_RED, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..11111.", ".2233311",
      ".1112111", ".111111.",
      "...111..", "........",
    ],
  },
  copper_wisp: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", ".2....2.",
      "3.2112.3", ".213312.",
      ".213312.", "..1111..",
      "........", "........",
    ],
  },
  corrupt_vessel: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "...11...", "...11...",
      "..1111..", "..1121..",
      ".111231.", ".113211.",
      "..2.3.2.", "........",
    ],
  },
  damp_whisper: {
    colors: [P.COLOR_STONE_LIGHT, P.COLOR_STONE_DARK, P.COLOR_VOID],
    rows: [
      "........", "...22...",
      "..1111..", ".212212.",
      "..1331..", "..1111..",
      "..2222..", "..2..2..",
    ],
  },
  deep_clay: {
    colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "........", "..2121..",
      ".112121.", ".12331..",
      "......33", ".......1",
    ],
  },
  dreg_mold: {
    colors: [P.COLOR_RUST, P.COLOR_STONE_DARK, P.COLOR_STAR],
    rows: [
      "........", "........",
      "........", ".223232.",
      "..1211..", ".211312.",
      "..1112..", "..1..1..",
    ],
  },
  dreg_spore: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW, P.COLOR_VOID],
    rows: [
      "........", "........",
      ".222222.", "22.22.2.",
      ".2.22.22", ".231312.",
      ".222222.", "........",
    ],
  },
  dust_mite: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_DREGS_DUST],
    rows: [
      "........", "........",
      "........", ".3.12.3.",
      "..1331..", ".112111.",
      "311..113", ".1....1.",
    ],
  },
  earth_mover: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_SHADOW],
    rows: [
      "........", "...21...",
      ".2...2..", "..111231",
      "31222113", "........",
      "........", "........",
    ],
  },
  echo_shard: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...32.2.",
      "..2313..", "...13...",
      "...33...", "..21332.",
      "...213..", "........",
    ],
  },
  edge_golem: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "......12", ".....121",
      ".213121.", "11332121",
      "121.1211", ".123212.",
      ".1.3..1.", ".11..11.",
    ],
  },
  edge_stone: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...22...",
      "...33.12", "...22..1",
      ".11131..", "22113122",
      "22113122", "........",
    ],
  },
  ember_core: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "..22322.", "..2323..",
      "..32323.", "..2323..",
      "..2.3.2.", "........",
    ],
  },
  ember_flyer: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID],
    rows: [
      "........", "...22...",
      "2.1212.2", ".232232.",
      ".232232.", "2.2221.2",
      "...22...", "........",
    ],
  },
  ember_mite: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_GLOW, P.COLOR_SHADOW],
    rows: [
      "........", "...2....",
      ".211111.", "21221112",
      ".121221.", "......2.",
      "....2...", "........",
    ],
  },
  fire_spitter: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID],
    rows: [
      "........", "...222..",
      "..22222.", ".122221.",
      "1212112.", ".111112.",
      "..11111.", "........",
    ],
  },
  fire_weep: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "..1311..", ".22331..",
      "..11322.", "..1331..",
      "........", "........",
    ],
  },
  forge_spitter: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID],
    rows: [
      "........", "........",
      ".....22.", "222121..",
      "113311..", "2222111.",
      ".11..11.", "........",
    ],
  },
  fracture_crab: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_GLASS, P.COLOR_VOID],
    rows: [
      "........", "........",
      "........", ".121312.",
      "12.332.1", "11213121",
      "12123332", "...232..",
    ],
  },
  glass_echo: {
    colors: [P.COLOR_GLASS, P.COLOR_SHADOW, P.COLOR_GLASS_LIGHT],
    rows: [
      "........", "..1111..",
      ".2111113", ".1231.3.",
      ".11..11.", ".133132.",
      ".31111.2", "........",
    ],
  },
  glass_mire: {
    colors: [P.COLOR_GLASS, P.COLOR_KILN_GLOW, P.COLOR_VOID],
    rows: [
      "........", "...2....",
      "..2121..", "1112211.",
      ".122.31.", ".13.1231",
      ".311112.", "........",
    ],
  },
  glass_mirror: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_VOID],
    rows: [
      "........", "..322...",
      "2.3123..", "3133231.",
      "2131231.", "...11...",
      "...11...", "...33...",
    ],
  },
  glass_mite: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_GLASS, P.COLOR_KILN_DARK],
    rows: [
      "........", "....3...",
      "....3...", "..3131..",
      ".21..32.", ".231312.",
      "2...3..2", "........",
    ],
  },
  glass_moth: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_STAR_GLOW, P.COLOR_VOID],
    rows: [
      "1......1", ".1.22.1.",
      ".3.11.3.", ".111311.",
      ".131131.", "1..11..1",
      "...22...", "........",
    ],
  },
  glass_sentinel: {
    colors: [P.COLOR_GLASS, P.COLOR_KILN_GLOW, P.COLOR_VOID],
    rows: [
      "...22...", "...12...",
      "..1121..", "..1121..",
      "..1121..", "..1121..",
      "..1121..", "........",
    ],
  },
  glass_shard: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_VOID],
    rows: [
      "........", "...11...",
      "..22121.", ".111311.",
      ".111122.", "..1211..",
      "....1...", "........",
    ],
  },
  glass_throat: {
    colors: [P.COLOR_GLASS, P.COLOR_VOID, P.COLOR_KILN_GLOW],
    rows: [
      "...11...", "...12...",
      "...23...", ".112321.",
      ".122322.", "...232..",
      "...232..", "...11...",
    ],
  },
  glass_vine: {
    colors: [P.COLOR_GLASS, P.COLOR_STONE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      ".2..2322", ".2.222.2",
      ".122222.", ".221212.",
      "21111112", "........",
    ],
  },
  glass_wisp: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...11...", "..13211.",
      ".1.11..1", "...111..",
      "..1...1.", "..1...1.",
    ],
  },
  granite_warden: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "...11...", "...33...",
      "..1311..", "21.31.21",
      "11131111", "..1311..",
      "...31...", "..1111..",
    ],
  },
  gravity_well: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_STAR_GLOW],
    rows: [
      "........", "........",
      "..3..3..", ".221212.",
      "..1332..", "...33...",
      ".23..32.", "........",
    ],
  },
  heart_fire: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "...222..", "...22...",
      "...22...", "..3131..",
      "..1..31.", "..1.311.",
      ".1.....1", "........",
    ],
  },
  heart_golem: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_GROUND_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...11...",
      "..1111..", ".113311.",
      ".113311.", "..1331..",
      "..1111..", "........",
    ],
  },
  heart_stone: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", ".111111.",
      "12221212", "21332113",
      "22221211", "21212121",
      ".111111.", "........",
    ],
  },
  heart_weep: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_GLAZE_RED],
    rows: [
      "........", "...3....",
      ".1121211", "113333.1",
      "113333.1", ".1112111",
      "....3...", "........",
    ],
  },
  heat_blur: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_RED, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..3..33.", "..2321.3",
      ".2131211", ".2232111",
      "...3....", "........",
    ],
  },
  heat_moth: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_RED, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...22...",
      "22211222", "13233231",
      "22133122", "........",
      "........", "........",
    ],
  },
  hull_moth: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "2......2", "1..33..1",
      ".1.33.1.", ".221212.",
      "..1212..", "..2331..",
      "..2332..", "........",
    ],
  },
  iron_bulb: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...33...", "..2112..",
      ".113311.", ".111111.",
      "11211211", "..11.11.",
    ],
  },
  iron_lung: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_GLOW, P.COLOR_SHADOW],
    rows: [
      "........", ".2....3.",
      "31....13", ".3111113",
      ".113211.", ".111211.",
      ".1..2.1.", "...33...",
    ],
  },
  iron_rhizome: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_SHADOW],
    rows: [
      "........", "........",
      "........", ".2....2.",
      ".212121.", "21313122",
      "..3123..", "........",
    ],
  },
  iron_spitter: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...12...", "..12213.",
      ".1212323", "11121213",
      "21.....2", "........",
    ],
  },
  keeper_bram: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GROUND, P.COLOR_KILN_DARK],
    rows: [
      "........", "........",
      "........", "..3332..",
      ".13..13.", ".2222222",
      ".111111.", "..1....1",
    ],
  },
  keeper_dun: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...212..",
      "..211.2.", "..211.2.",
      "..211.2.", "..211.2.",
      "...212..", "....2...",
    ],
  },
  keeper_grom: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_GLAZE_RED_BRIGHT],
    rows: [
      "........", "2.....2.",
      "1.....1.", "1121311.",
      ".21..31.", "1122211.",
      "1212321.", "........",
    ],
  },
  keeper_grom_lieutenant: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...11...",
      "..1111..", ".1.33.1.",
      "11131211", "..2131..",
      "..1..1..", "..1..1..",
    ],
  },
  keeper_kyr: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_LIGHT, P.COLOR_VOID],
    rows: [
      "...111..", "..2111..",
      "..1333..", ".221312.",
      ".212322.", "..2131..",
      "..1111..", "..1111..",
    ],
  },
  keeper_nyx: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_GLAZE_RED_BRIGHT],
    rows: [
      "........", "...1....",
      "..123.1.", "..113.1.",
      "..123.1.", "...13...",
      "...2....", "...11...",
    ],
  },
  keeper_nyx_scout: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "..2...2.", "..1111..",
      "..1312..", ".21332.2",
      "..1212..", "..1111..",
      "...2.2..", "........",
    ],
  },
  keeper_syl: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..1332..", ".12..31.",
      "31133213", ".121311.",
      "..1111..", "..1..1..",
    ],
  },
  keeper_tor: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_RED, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..121223", "..2332..",
      "..2212..", ".221212.",
      "2.....22", "........",
    ],
  },
  keeper_vex: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "..1212..",
      "2.232322", "21123212",
      "21133112", "11111111",
      ".11...11", "........",
    ],
  },
  kelp_knuckle: {
    colors: [P.COLOR_STONE_LIGHT, P.COLOR_GLAZE_RED, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", "...22...",
      "3.2312.3", ".331313.",
      ".3....3.", ".332213.",
      "..1311..", "........",
    ],
  },
  kiln_cage: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...33...",
      ".33113..", "..3221..",
      ".212121.", ".121211.",
      ".122121.", "........",
    ],
  },
  kiln_fire: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "..1111..",
      "..1211..", ".113131.",
      ".11..11.", ".122312.",
      ".111111.", "........",
    ],
  },
  kiln_golem: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "..122.1.",
      "..1111..", ".12.311.",
      ".123321.", "..2121..",
      "..1111..", "..1..1..",
    ],
  },
  kiln_imp: {
    colors: [P.COLOR_GLAZE_RED, P.COLOR_KILN_BRIGHT, P.COLOR_SHADOW],
    rows: [
      "........", "...22...",
      "...22...", "..1132..",
      ".113311.", ".111111.",
      "........", "........",
    ],
  },
  kiln_marrow: {
    colors: [P.COLOR_RUST, P.COLOR_STONE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "...22...", ".2....2.",
      "..3113..", "11133111",
      "..1331..", "..1331..",
      "..1111..", "...11...",
    ],
  },
  kiln_mite: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...22...", "..322...",
      ".212121.", ".121211.",
      ".212121.", "........",
    ],
  },
  kiln_mouth: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", ".131313.",
      ".333331.", ".333313.",
      ".333133.", ".1....3.",
      ".332233.", "..3..3..",
    ],
  },
  kiln_rat: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "........", "1121212.",
      "2232121.", ".231212.",
      ".11...11", "........",
    ],
  },
  kiln_sigh: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID],
    rows: [
      "........", ".1...1..",
      ".11311..", "1132211.",
      ".11221..", ".13131..",
      "..1..1..", "........",
    ],
  },
  magma_slug: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_GROUND],
    rows: [
      "...11...", "..1121..",
      "...222..", "32.2...3",
      "32111123", "31222223",
      "33111133", "3.3..3.3",
    ],
  },
  magnetic_drifter: {
    colors: [P.COLOR_RUST, P.COLOR_METAL, P.COLOR_VOID],
    rows: [
      "..2...2.", "..21212.",
      "..1332..", ".22..122",
      "..1312..", "..2121..",
      "...11...", "...11...",
    ],
  },
  metal_rust: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", "...2.2..",
      "..1313..", "..22.12.",
      ".112311.", ".211312.",
      ".122122.", "..2..2..",
    ],
  },
  metal_scraper: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "3......3",
      "22.3..22", "22231122",
      "11211211", ".1....1.",
      "........", "........",
    ],
  },
  metal_shriek: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "...33...", "..1313..",
      "..1313..", ".213312.",
      ".211112.", ".221322.",
      "..2..2..", "........",
    ],
  },
  mire_bone: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_GROUND, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...22...",
      "...21...", "..2331..",
      ".233332.", ".222222.",
      "..1212..", "...2.2..",
    ],
  },
  mire_echo: {
    colors: [P.COLOR_GLAZE_LIGHT, P.COLOR_GLAZE_RED, P.COLOR_VOID_PURPLE_LIGHT],
    rows: [
      "........", "........",
      ".....3..", "..1111..",
      ".32.132.", ".232322.",
      "2.2...2.", "2......2",
    ],
  },
  mire_hinge: {
    colors: [P.COLOR_RUST, P.COLOR_METAL, P.COLOR_GROUND],
    rows: [
      "........", "........",
      "..1121..", ".123232.",
      ".211311.", "..1131..",
      "...2.2..", "...1.1..",
    ],
  },
  mire_silica: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_GROUND, P.COLOR_SHADOW],
    rows: [
      "........", "........",
      "..1212..", "..2111..",
      "..2111..", "..1111..",
      "..1122..", "..1..1..",
    ],
  },
  mire_worm: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...3....",
      "..1212..", "223..322",
      ".23..32.", "..2121..",
      "....3...", "........",
    ],
  },
  mirror_fly: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_GLASS, P.COLOR_KILN_GLOW],
    rows: [
      "...11...", "1......1",
      ".112121.", "1.1121.1",
      ".112111.", "..2122..",
      ".22...2.", ".2....2.",
    ],
  },
  mirror_stalker: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_GLASS_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...12...",
      "..1231..", "..1323..",
      "..1221..", "..1121..",
      "..1323..", "..1.21..",
    ],
  },
  mud_golem: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_RED, P.COLOR_GLAZE_RED_BRIGHT],
    rows: [
      "........", ".133331.",
      "..1211..", ".112211.",
      ".111111.", "11111111",
      "........", "........",
    ],
  },
  mud_slug: {
    colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_GLAZE_DARK],
    rows: [
      ".....22.", "....33..",
      "...2....", ".31133..",
      ".311111.", "21311132",
      "...333..", "........",
    ],
  },
  obsidian_moth: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_KILN_GLOW, P.COLOR_SHADOW],
    rows: [
      "...22...", "...22...",
      "..2113..", "..3223..",
      "...3....", "..3112..",
      "...22...", "........",
    ],
  },
  obsidian_shard: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_GLASS, P.COLOR_KILN_GLOW],
    rows: [
      "........", "..1311..",
      ".123121.", ".123121.",
      ".113111.", ".113111.",
      "..1311..", "...3....",
    ],
  },
  oxide_drip: {
    colors: [P.COLOR_RUST, P.COLOR_DREGS_VOID, P.COLOR_SHADOW],
    rows: [
      "........", "...11...",
      "..1..1..", ".112213.",
      ".322221.", "...22...",
      "........", "........",
    ],
  },
  oxide_fern: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "1.3....1",
      ".123211.", ".212121.",
      ".12..12.", ".112321.",
      "1....3.1", "........",
    ],
  },
  oxide_hulk: {
    colors: [P.COLOR_RUST, P.COLOR_SHADOW, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "..1211..", ".112111.",
      "11123111", "11122211",
      ".211212.", "..2..2..",
    ],
  },
  oxide_mite: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      ".112211.", ".112211.",
      "12311321", ".111111.",
      "........", "........",
    ],
  },
  oxide_spire: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "...3....", "..3213..",
      "..1311..", "..2312..",
      ".223122.", ".213112.",
      "...21...", "........",
    ],
  },
  oxide_tether: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_DARK],
    rows: [
      "........", "..2112..",
      "..1221..", "..2..2..",
      "..1331..", "..3213..",
      "..22.2..", ".2....2.",
    ],
  },
  prism_wisp: {
    colors: [P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_GLASS, P.COLOR_STAR_GLOW],
    rows: [
      "...22...", "..2222..",
      ".233332.", "..3333..",
      "...22...", "........",
      "........", "........",
    ],
  },
  pyre_beetle: {
    colors: [P.COLOR_GLAZE_RED, P.COLOR_GLAZE_RED_BRIGHT, P.COLOR_DREGS_VOID],
    rows: [
      "........", "..111...",
      "..133...", "221111..",
      "131333..", ".11111..",
      "..2..23.", ".2....3.",
    ],
  },
  quartz_specter: {
    colors: [P.COLOR_STONE_WHITE, P.COLOR_GLASS_LIGHT, P.COLOR_VOID_PURPLE_LIGHT],
    rows: [
      "........", "...11...",
      "..1221..", ".1123111",
      "..1111..", "..111.1.",
      "........", "........",
    ],
  },
  quartz_witch: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_GLASS, P.COLOR_STAR_GLOW],
    rows: [
      "........", "..1111..",
      ".212321.", "22233322",
      ".212321.", ".121312.",
      "..2..2..", "........",
    ],
  },
  resonant_shard: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID, P.COLOR_KILN_GLOW],
    rows: [
      "...3....", "..33.3..",
      "..1211..", ".112211.",
      "..1221..", "..1211..",
      "..32.3..", "...3....",
    ],
  },
  rock_spitter: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_GROUND],
    rows: [
      "........", "........",
      "..2222..", "22212122",
      "21221112", "221.1112",
      ".11..11.", ".22..22.",
    ],
  },
  rust_crawler: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "3......3", ".....3.2",
      "2....222", "2..33222",
      "22333222", "22212122",
      ".232123.", "........",
    ],
  },
  rust_echo: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "..2121..",
      "..1111..", "..21.12.",
      "..23.32.", "..23.32.",
      "....2...", "........",
    ],
  },
  rust_fern: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "..2..2..",
      "..311...", "1..11..1",
      "21111112", ".111111.",
      ".1.22.1.", ".2....2.",
    ],
  },
  rust_fungus: {
    colors: [P.COLOR_RUST, P.COLOR_METAL, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "...1....", "..1312..",
      ".131113.", "11111111",
      "11111111", "........",
    ],
  },
  rust_knuckle: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "...11...", "...11..2",
      ".1131112", "21232222",
      "21223212", ".1233212",
      "..2112..", "........",
    ],
  },
  rust_vein: {
    colors: [P.COLOR_RUST, P.COLOR_DREGS_VOID, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...1....",
      "...21...", ".113111.",
      "1.1131.1", "...32...",
      "....1...", "........",
    ],
  },
  rust_worm: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      ".2.2....", "233..22.",
      "3.21222.", "2333222.",
      "2212111.", "........",
    ],
  },
  salt_spitter: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...33...", "1.2222.1",
      "13111131", "11111111",
      "1.1..1.1", "..1..1..",
    ],
  },
  schist_crag: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", "........",
      "........", "........",
      "12123212", "21213121",
      "12123222", "....3...",
    ],
  },
  schist_flyer: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_STAR],
    rows: [
      "........", "........",
      "..231.2.", "..12121.",
      "..12111.", ".1.21..1",
      "........", "........",
    ],
  },
  scrap_bat: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "12....21",
      "113...11", "..1111..",
      ".212121.", "..1111..",
      "...22...", "........",
    ],
  },
  shard_hollow: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID, P.COLOR_SHADOW],
    rows: [
      "..1..1..", "..1331..",
      ".332233.", ".322223.",
      ".322223.", ".332233.",
      ".311113.", "..1..1..",
    ],
  },
  shatter_spitter: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_GLAZE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..3333..", ".133331.",
      ".113321.", ".113311.",
      "11....11", "........",
    ],
  },
  silica_hag: {
    colors: [P.COLOR_STONE_LIGHT, P.COLOR_STONE_DARK, P.COLOR_GLASS_LIGHT],
    rows: [
      "..33.3..", "..333...",
      "...21...", "..1221..",
      "..1221..", "...22...",
      "........", "........",
    ],
  },
  silica_hum: {
    colors: [P.COLOR_STONE_LIGHT, P.COLOR_STONE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", ".2.3...2",
      "..21212.", "..1332..",
      "..2331..", "..1212..",
      "..2.3.2.", ".2.....2",
    ],
  },
  silica_husk: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID],
    rows: [
      "........", "........",
      "..1212..", ".22.222.",
      ".22.122.", "..2221..",
      "........", "........",
    ],
  },
  silica_lung: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..1111..", ".113121.",
      ".213312.", ".111311.",
      "..1111..", "........",
    ],
  },
  silica_mite: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_DREGS_VOID],
    rows: [
      "........", "........",
      "...11...", "3..33..3",
      "..22112.", ".2112122",
      "........", "........",
    ],
  },
  silica_spider: {
    colors: [P.COLOR_GLASS, P.COLOR_SHADOW, P.COLOR_DREGS_VOID],
    rows: [
      "........", "........",
      "........", "2.2121.2",
      ".213322.", ".2....2.",
      "2.2..2.2", ".2....2.",
    ],
  },
  slag_ankle: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..1212..", ".223232.",
      ".213332.", ".22222..",
      "..1111..", "........",
    ],
  },
  slag_biter: {
    colors: [P.COLOR_RUST, P.COLOR_METAL, P.COLOR_KILN_BRIGHT],
    rows: [
      "...33...", "...11...",
      "........", ".223312.",
      "..2332..", "..2121..",
      "..1..1..", "........",
    ],
  },
  slag_choir: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_KILN_GLOW, P.COLOR_VOID],
    rows: [
      "....2...", "...11...",
      "...22.1.", "..2..11.",
      ".112121.", ".12221..",
      "..2212..", "........",
    ],
  },
  slag_drifter: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_VOID],
    rows: [
      "...11...", "..1111..",
      "1.2332.1", ".111111.",
      ".122221.", ".111111.",
      ".1.....1", ".1.....1",
    ],
  },
  slag_echo: {
    colors: [P.COLOR_VOID, P.COLOR_KILN_GLOW, P.COLOR_SHADOW],
    rows: [
      "........", "........",
      "..1..1..", ".112211.",
      ".212212.", "..2222..",
      "........", "........",
    ],
  },
  slag_hinge: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", ".1.22.1.",
      ".133331.", ".2322322",
      ".112221.", ".222222.",
      ".122221.", "........",
    ],
  },
  slag_kneeler: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "...33...", "..2332..",
      "..2332..", "..3332..",
      "21233221", ".113311.",
      ".1.33.1.", ".2.33.2.",
    ],
  },
  slag_mite: {
    colors: [P.COLOR_GROUND, P.COLOR_RUST, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...33...",
      "..1111..", "..11211.",
      ".11221.1", "1..3.1..",
      "..1...1.", "........",
    ],
  },
  slag_singer: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "...11...",
      "..1131..", ".112.21.",
      ".133333.", "..1333..",
      "..1222..", "........",
    ],
  },
  slag_tether: {
    colors: [P.COLOR_METAL, P.COLOR_SHADOW, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      ".11111..", ".13312..",
      ".112311.", "222112..",
      "22...2..", ".2...2..",
    ],
  },
  slag_urn: {
    colors: [P.COLOR_RUST, P.COLOR_SHADOW, P.COLOR_DREGS_DUST],
    rows: [
      "........", "...12...",
      "..1121..", ".112221.",
      ".122221.", "..11312.",
      "....3...", "....3...",
    ],
  },
  slag_vein: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..13.31.", ".2213122",
      ".2222212", "..22222.",
      "........", "........",
    ],
  },
  slag_vent: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", ".3......",
      "..3212..", "..2.31..",
      "..13.2..", "..21212.",
      ".2....32", ".......3",
    ],
  },
  slag_warden: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID],
    rows: [
      "........", "........",
      "......2.", "......2.",
      "..11112.", ".11..112",
      ".1111112", "........",
    ],
  },
  slag_worm: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_DARK],
    rows: [
      "........", "........",
      "........", ".....331",
      "...33111", "12111111",
      "1.....1.", "........",
    ],
  },
  steam_wisp: {
    colors: [P.COLOR_GLAZE_LIGHT, P.COLOR_VOID, P.COLOR_KILN_GLOW],
    rows: [
      "..1131..", ".111311.",
      "11121111", ".111311.",
      "..1313..", "...111..",
      "..1...1.", "........",
    ],
  },
  steel_flyer: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      ".1..3.2.", ".211111.",
      ".123232.", ".211111.",
      "...22...", "...222..",
    ],
  },
  stone_echo: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", "..2331..",
      "..3213..", "..3333..",
      "..3..3..", "..3123..",
      "..3213..", "........",
    ],
  },
  stone_flyer: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "...22...", "...22...",
      "...11...", "..1111..",
      ".111111.", ".111111.",
      ".2.1..2.", "..1221..",
    ],
  },
  stone_golem: {
    colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_SHADOW],
    rows: [
      "........", "........",
      ".222322.", "21213121",
      "12133312", "11213111",
      "11..3.11", "........",
    ],
  },
  tide_mite: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_GLAZE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "..3..3..", "..3..3..",
      "1.3..3.1", "11221211",
      "..1111..", ".113311.",
      "12211221", "........",
    ],
  },
  time_tick: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "...33...", ".1.3..1.",
      ".111311.", ".221212.",
      ".111111.", ".11...1.",
      "..1...1.", ".1.....1",
    ],
  },
  trench_leviathan: {
    colors: [P.COLOR_SHADOW, P.COLOR_STONE_DARK, P.COLOR_VOID],
    rows: [
      "........", "...22...",
      "..2112..", ".223322.",
      "12211221", "..2332..",
      "........", "........",
    ],
  },
  vein_glass: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      ".1....1.", "..1..1..",
      "..1232..", "1.2331.1",
      ".123321.", "..2321..",
      "........", "........",
    ],
  },
  vein_walker: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "........", "..1311..",
      ".223312.", ".221312.",
      "..2..32.", "........",
    ],
  },
  vex_mirror: {
    colors: [P.COLOR_GLASS, P.COLOR_VOID, P.COLOR_STAR_GLOW],
    rows: [
      "..3333..", "........",
      "..1222..", "33322333",
      "..1212..", "..2221..",
      "........", "........",
    ],
  },
  vex_shard: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "..1.12..", "..2331..",
      ".1123211", "..2331..",
      "........", "........",
    ],
  },
  vibration_shroom: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_GLOW, P.COLOR_SHADOW],
    rows: [
      "........", "........",
      "....1...", "...2221.",
      "...2221.", "..11211.",
      ".1111111", "1......1",
    ],
  },
  vitreous_wisp: {
    colors: [P.COLOR_GLASS, P.COLOR_KILN_GLOW, P.COLOR_VOID],
    rows: [
      "........", "...222..",
      "..1.....", "..3232..",
      "..13231.", ".13131.1",
      ".1.....1", "........",
    ],
  },
  void_bulb: {
    colors: [P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_VOID_PURPLE_DARK, P.COLOR_SHADOW],
    rows: [
      "........", "..1111..",
      ".213112.", ".211312.",
      ".221112.", "..2112..",
      "..12....", "........",
    ],
  },
  void_cleft: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_VOID],
    rows: [
      "........", "..3.....",
      "..1222..", ".22331..",
      "..13322.", "..2221..",
      ".....3..", "........",
    ],
  },
  void_glass: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "........", "........",
      ".112121.", ".123211.",
      ".112121.", ".121211.",
      "........", "........",
    ],
  },
  void_glaze: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STAR],
    rows: [
      "........", "....3...",
      "...11...", "..1221..",
      "..3113..", "..1221..",
      "..1.31..", "........",
    ],
  },
  void_leak: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_VOID],
    rows: [
      "........", "..3..3..",
      ".1.2121.", "..1121..",
      "31111113", "1.3..3.1",
      ".3.33.3.", "........",
    ],
  },
  void_marrow: {
    colors: [P.COLOR_METAL, P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID],
    rows: [
      "........", "..1..1..",
      "..12121.", ".123311.",
      ".112221.", "..2111..",
      "...11...", "........",
    ],
  },
  void_moth: {
    colors: [P.COLOR_VOID, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "1.2..2..", ".1.22..1",
      "11111111", "..13311.",
      ".1133111", "1.1111..",
      "........", "........",
    ],
  },
  void_rib: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...11...",
      ".221122.", ".2233122",
      ".21..21.", ".123312.",
      ".2.11..2", "........",
    ],
  },
  void_rust: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_METAL, P.COLOR_RUST],
    rows: [
      ".2....2.", "2.2..2.2",
      ".2213122", "..13332.",
      "..3131..", "..233322",
      "2222.222", ".2....2.",
    ],
  },
  void_shell: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID],
    rows: [
      "..1331..", "...22...",
      "..1..1..", ".123312.",
      ".133321.", "..1111..",
      "..1111..", "........",
    ],
  },
  void_vein: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_GLAZE_RED],
    rows: [
      "...2....", "..12.1..",
      "..1212..", "12332121",
      ".112321.", "..2123..",
      "..12.1..", "...2....",
    ],
  },
  waste_spitter: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "........",
      "...11...", "..3..3..",
      ".112.11.", "11222121",
      "12132211", "........",
    ],
  },
  weep_matriarch: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_VOID, P.COLOR_SHADOW],
    rows: [
      "........", "...2.2..",
      "...12...", "..1222..",
      "..2122..", "...11...",
      "...222..", "....2...",
    ],
  },
  weep_weaver: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_VOID_PURPLE_DARK],
    rows: [
      "........", "........",
      "3.1212..", ".32222.3",
      "..32223.", "..31223.",
      ".3.....3", "3.......",
    ],
  },
  weep_wisp: {
    colors: [P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_VOID_PURPLE_DARK, P.COLOR_VOID],
    rows: [
      "........", "..1311..",
      ".233132.", ".212112.",
      ".212112.", ".213112.",
      "..1311..", "...3....",
    ],
  },
  weep_worm: {
    colors: [P.COLOR_VOID, P.COLOR_VOID_PURPLE_LIGHT, P.COLOR_STONE_DARK],
    rows: [
      "........", "...311..",
      ".33211..", "322.31..",
      "3323.3..", "2.3...3.",
      ".3..3.3.", "3....3..",
    ],
  },
  wet_echo: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_VOID_PURPLE_DARK, P.COLOR_STAR_GLOW],
    rows: [
      "........", "...22...",
      "...1....", "..1313..",
      "11111111", ".111111.",
      ".111111.", "........",
    ],
  },
  wind_wisp: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_GROUND_LIGHT, P.COLOR_KILN_BRIGHT],
    rows: [
      "....2...", ".111111.",
      ".121311.", ".113322.",
      ".223231.", ".132121.",
      ".131111.", "...2....",
    ],
  },
  brix: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "..1111..", ".111111.",
      ".313311.", ".31212..",
      ".321211.", "11233211",
      "31222213", "1......1",
    ],
  },
  kael: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...11...",
      "..2331..", "11233211",
      "3311233.", ".112211.",
      ".113311.", "........",
    ],
  },
  kest: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...11...",
      "..1111..", "..1231..",
      "21132112", "2.1111.2",
      "2.1111.2", "..1111..",
    ],
  },
  luma: {
    colors: [P.COLOR_GLASS, P.COLOR_GLASS_LIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "...11...", "..1111..",
      ".111111.", "11233121",
      ".111111.", "..2121..",
      "...11...", "........",
    ],
  },
  osm: {
    colors: [P.COLOR_GLAZE_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_DARK],
    rows: [
      "........", "..1212..",
      "...12...", "...222..",
      ".213232.", "22312122",
      ".212122.", "........",
    ],
  },
  shard: {
    colors: [P.COLOR_GLAZE_RED, P.COLOR_KILN_GLOW, P.COLOR_KILN_DARK],
    rows: [
      "........", "...11...",
      "..1211..", ".131213.",
      "..1313..", "...11...",
      "...33...", "........",
    ],
  },
  slag_ash: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_STONE_LIGHT, P.COLOR_SHADOW],
    rows: [
      "........", "...11...",
      "...22...", "11111111",
      "11311311", "11111111",
      "..1331..", "..1..1..",
    ],
  },
  slag_climber: {
    colors: [P.COLOR_VOID_PURPLE_DARK, P.COLOR_METAL, P.COLOR_KILN_GLOW],
    rows: [
      "..1111..", "..1331..",
      ".111111.", "11111111",
      "11122111", "..1..1..",
      "..1..1..", "........",
    ],
  },
  slag_farmer: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT, P.COLOR_GROUND],
    rows: [
      "........", "...11...",
      "..1323..", "..31213.",
      ".21121.2", ".23333.2",
      "32322132", "3.222...",
    ],
  },
  slag_glass: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_GLASS, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...11...",
      "..1331..", ".212123.",
      ".331213.", ".331111.",
      ".33111..", "...11...",
    ],
  },
  slag_mechanic: {
    colors: [P.COLOR_KILN_DARK, P.COLOR_RUST, P.COLOR_GROUND_LIGHT],
    rows: [
      "...33...", "2..33...",
      "2.1212..", "2123311.",
      "2111121.", "2.2121..",
      "..1..1..", "........",
    ],
  },
  slag_miner: {
    colors: [P.COLOR_STONE_DARK, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "...11...", "...11...",
      "..13212.", ".1133121",
      ".111311.", "..1131..",
      "..1..1..", "..1..1..",
    ],
  },
  slag_potter: {
    colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_SHADOW],
    rows: [
      "........", "...22...",
      "..1321..", ".131311.",
      ".133131.", ".331313.",
      "..1313..", "..1331..",
    ],
  },
  slag_sailor: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_DARK, P.COLOR_KILN_BRIGHT],
    rows: [
      "........", "........",
      "..1212..", "..2221..",
      "..12221.", "..212111",
      "......1.", "......31",
    ],
  },
  slag_scavenger: {
    colors: [P.COLOR_METAL, P.COLOR_RUST, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...22...",
      "...22...", "...33...",
      "..1331..", ".213312.",
      ".212212.", "..1111..",
    ],
  },
  slag_smith: {
    colors: [P.COLOR_RUST, P.COLOR_KILN_BRIGHT, P.COLOR_KILN_GLOW],
    rows: [
      "..1111..", ".111111.",
      "11.22.12", "11122112",
      "11123112", ".1113112",
      ".111111.", "........",
    ],
  },
  vell: {
    colors: [P.COLOR_GLASS_LIGHT, P.COLOR_GLASS, P.COLOR_KILN_GLOW],
    rows: [
      "........", "...11...",
      "...21...", "..1131..",
      "..3233..", "...22...",
      "...11...", "...11...",
    ],
  },
  vraal: {
    colors: [P.COLOR_STONE_LIGHT, P.COLOR_STONE_DARK, P.COLOR_KILN_GLOW],
    rows: [
      "...11...", ".2.22.2.",
      ".2.22.2.", ".213312.",
      ".211123.", ".211121.",
      ".211131.", "......3.",
    ],
  },
};
