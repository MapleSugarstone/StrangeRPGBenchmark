// The town huts' tiles, drawn by Qwen (Notes/qwen/asks/20261103-145340-house-tiles.md).
import type { Sprite } from "../engine/sprite.js";
import * as P from "../engine/palette.js";

export const HOUSE_TILES: Record<string, Sprite> = {
  tile_hut_roof: { colors: [P.COLOR_ASH, P.COLOR_GROUND, P.COLOR_GLAZE_DARK], rows: ["11111111","12222221","12333321","12311321","12311321","12333321","12222221","11111111"] },
  tile_hut_wall: { colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_ASH], rows: ["22222222","22222222","22322322","22222222","22222222","22222222","22222222","22222222"] },
  tile_hut_door: { colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_ASH], rows: ["22222222","22222222","22222222","22211222","22211222","22222222","22222222","22222222"] },
  tile_room_floor: { colors: [P.COLOR_GROUND_LIGHT, P.COLOR_ASH], rows: ["11111111","12121212","11111111","12121212","11111111","12121212","11111111","12121212"] },
  tile_room_wall: { colors: [P.COLOR_GROUND, P.COLOR_GROUND_LIGHT, P.COLOR_ASH], rows: ["22222222","21111112","21222212","21211212","21211212","21222212","21111112","22222222"] },
};
