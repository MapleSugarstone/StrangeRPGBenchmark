// The Dregs' ground tiles drawn by Qwen (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { COLOR_ASH, COLOR_DREGS_DUST, COLOR_DREGS_VOID, COLOR_GLASS, COLOR_GLASS_LIGHT, COLOR_GLAZE_DARK, COLOR_GLAZE_LIGHT, COLOR_GROUND, COLOR_KILN_BRIGHT, COLOR_KILN_DARK, COLOR_KILN_GLOW, COLOR_SHADOW, COLOR_STAR_GLOW, COLOR_STONE_WHITE, COLOR_VOID_PURPLE_DARK, COLOR_VOID_PURPLE_LIGHT } from "../engine/palette.js";
import { Sprite } from "../engine/sprite.js";
import type { TileInfo } from "../engine/maps.js";

export const DREGS_TILES: Record<string, Sprite> = {
  tile_dregs15_floor: { colors: [COLOR_GROUND, COLOR_VOID_PURPLE_DARK, COLOR_SHADOW], rows: ["11111111", "12111121", "11111111", "11211211", "11111111", "12111121", "11111111", "11111111"] },
  tile_dregs15_grass: { colors: [COLOR_DREGS_VOID, COLOR_VOID_PURPLE_DARK, COLOR_VOID_PURPLE_LIGHT], rows: ["22222222", "23232323", "22222222", "23232323", "22222222", "23232323", "22222222", "23232323"] },
  tile_dregs15_block: { colors: [COLOR_SHADOW, COLOR_DREGS_VOID, COLOR_GROUND], rows: ["11111111", "12121212", "11111111", "12121212", "11111111", "12121212", "11111111", "12121212"] },
  tile_dregs15_pool: { colors: [COLOR_VOID_PURPLE_LIGHT, COLOR_VOID_PURPLE_DARK, COLOR_DREGS_VOID], rows: ["11111111", "12121212", "11111111", "12121212", "11111111", "12121212", "11111111", "12121212"] },
  tile_dregs16_floor: { colors: [COLOR_ASH, COLOR_DREGS_DUST, COLOR_VOID_PURPLE_DARK], rows: ["22222222", "23222232", "22222222", "22322322", "22222222", "23222232", "22222222", "22222222"] },
  tile_dregs16_grass: { colors: [COLOR_DREGS_VOID, COLOR_DREGS_DUST, COLOR_VOID_PURPLE_DARK], rows: ["22222222", "21212121", "22222222", "21212121", "22222222", "21212121", "22222222", "21212121"] },
  tile_dregs16_block: { colors: [COLOR_DREGS_VOID, COLOR_SHADOW, COLOR_VOID_PURPLE_DARK], rows: ["23333332", "33323333", "33333323", "33233333", "33333233", "32333333", "33332333", "23333332"] },
  tile_dregs16_pool: { colors: [COLOR_DREGS_VOID, COLOR_VOID_PURPLE_LIGHT, COLOR_STAR_GLOW], rows: ["22222222", "22322322", "22222222", "22322322", "22222222", "22322322", "22222222", "22222222"] },
  tile_dregs17_floor: { colors: [COLOR_GLAZE_DARK, COLOR_VOID_PURPLE_DARK, COLOR_SHADOW], rows: ["11111111", "12111121", "11111111", "11211211", "11111111", "12111121", "11111111", "11111111"] },
  tile_dregs17_grass: { colors: [COLOR_DREGS_VOID, COLOR_VOID_PURPLE_DARK, COLOR_VOID_PURPLE_LIGHT], rows: ["22222222", "23222322", "22222222", "22232222", "22222222", "23222322", "22222222", "22222222"] },
  tile_dregs17_block: { colors: [COLOR_DREGS_VOID, COLOR_SHADOW, COLOR_GROUND], rows: ["33333333", "31333313", "33333333", "33313333", "33333333", "31333313", "33333333", "33333333"] },
  tile_dregs17_pool: { colors: [COLOR_VOID_PURPLE_LIGHT, COLOR_KILN_GLOW, COLOR_DREGS_VOID], rows: ["11111111", "12111121", "11111111", "11121111", "11111111", "12111121", "11111111", "11111111"] },
  tile_dregs18_floor: { colors: [COLOR_KILN_DARK, COLOR_KILN_BRIGHT, COLOR_ASH], rows: ["11111111", "12111121", "11121111", "11111121", "21111111", "11211111", "11112111", "11111111"] },
  tile_dregs18_grass: { colors: [COLOR_KILN_DARK, COLOR_KILN_GLOW, COLOR_VOID_PURPLE_DARK], rows: ["11111111", "12131121", "11121311", "13111121", "21111111", "11213111", "11112111", "11111111"] },
  tile_dregs18_block: { colors: [COLOR_KILN_DARK, COLOR_KILN_BRIGHT, COLOR_VOID_PURPLE_LIGHT], rows: ["22222222", "21222212", "22212222", "22222212", "12222222", "22122222", "22221222", "22222222"] },
  tile_dregs18_pool: { colors: [COLOR_KILN_GLOW, COLOR_KILN_BRIGHT, COLOR_VOID_PURPLE_DARK], rows: ["11111111", "12111211", "11121111", "11112111", "12111111", "11211111", "11121111", "11111111"] },
  tile_dregs19_floor: { colors: [COLOR_GLAZE_DARK, COLOR_GLAZE_LIGHT, COLOR_SHADOW], rows: ["11111111", "12121212", "11111111", "12121212", "11111111", "12121212", "11111111", "12121212"] },
  tile_dregs19_grass: { colors: [COLOR_GLAZE_LIGHT, COLOR_GLAZE_DARK, COLOR_VOID_PURPLE_LIGHT], rows: ["22333322", "23111132", "31111113", "31111113", "31111113", "31111113", "23111132", "22333322"] },
  tile_dregs19_block: { colors: [COLOR_GLAZE_DARK, COLOR_SHADOW, COLOR_VOID_PURPLE_DARK], rows: ["11111111", "12222221", "12111121", "12111121", "12111121", "12111121", "12222221", "11111111"] },
  tile_dregs19_pool: { colors: [COLOR_KILN_GLOW, COLOR_GLASS, COLOR_GLASS_LIGHT], rows: ["33333333", "32222223", "32111123", "32111123", "32111123", "32111123", "32222223", "33333333"] },
  tile_dregs20_floor: { colors: [COLOR_STONE_WHITE, COLOR_GROUND, COLOR_SHADOW], rows: ["11111111", "12111121", "11111111", "11211211", "11111111", "12111121", "11111111", "11111111"] },
  tile_dregs20_grass: { colors: [COLOR_DREGS_DUST, COLOR_VOID_PURPLE_DARK, COLOR_GROUND], rows: ["22222222", "23222322", "22222222", "22322222", "22222222", "32222222", "22222222", "22222222"] },
  tile_dregs20_block: { colors: [COLOR_SHADOW, COLOR_DREGS_VOID, COLOR_GROUND], rows: ["11111111", "12111121", "11111111", "11211111", "11111111", "21111111", "11111111", "11111111"] },
  tile_dregs20_pool: { colors: [COLOR_VOID_PURPLE_LIGHT, COLOR_VOID_PURPLE_DARK, COLOR_DREGS_VOID], rows: ["11111111", "12111121", "11111111", "11211111", "11111111", "21111111", "11111111", "11111111"] },
};

/** Each area's letters by map prefix, as ISLAND_SETS. */
export const DREGS_SETS: Record<string, Record<string, TileInfo>> = {
  the_dregs_undercroft: { ".": { sprite: "tile_dregs15_floor", walk: true }, ",": { sprite: "tile_dregs15_grass", walk: true }, "P": { sprite: "tile_dregs15_block", walk: false, under: "tile_dregs15_floor" }, "~": { sprite: "tile_dregs15_pool", walk: false, glow: "void" } },
  the_dregs_trench: { ".": { sprite: "tile_dregs16_floor", walk: true }, ",": { sprite: "tile_dregs16_grass", walk: true }, "P": { sprite: "tile_dregs16_block", walk: false, under: "tile_dregs16_floor" }, "~": { sprite: "tile_dregs16_pool", walk: false, glow: "glass" } },
  the_dregs_core: { ".": { sprite: "tile_dregs17_floor", walk: true }, ",": { sprite: "tile_dregs17_grass", walk: true }, "P": { sprite: "tile_dregs17_block", walk: false, under: "tile_dregs17_floor" }, "~": { sprite: "tile_dregs17_pool", walk: false, glow: "dregs" } },
  the_dregs_depths: { ".": { sprite: "tile_dregs18_floor", walk: true }, ",": { sprite: "tile_dregs18_grass", walk: true }, "P": { sprite: "tile_dregs18_block", walk: false, under: "tile_dregs18_floor" }, "~": { sprite: "tile_dregs18_pool", walk: false, glow: "dregs" } },
  the_dregs_glass: { ".": { sprite: "tile_dregs19_floor", walk: true }, ",": { sprite: "tile_dregs19_grass", walk: true }, "P": { sprite: "tile_dregs19_block", walk: false, under: "tile_dregs19_floor" }, "~": { sprite: "tile_dregs19_pool", walk: false, glow: "glass" } },
  the_dregs_rift: { ".": { sprite: "tile_dregs20_floor", walk: true }, ",": { sprite: "tile_dregs20_grass", walk: true }, "P": { sprite: "tile_dregs20_block", walk: false, under: "tile_dregs20_floor" }, "~": { sprite: "tile_dregs20_pool", walk: false, glow: "void" } },
};
