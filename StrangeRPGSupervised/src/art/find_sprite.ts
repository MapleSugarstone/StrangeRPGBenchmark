// The find on the ground in side maps, drawn by Qwen (Notes/qwen/finds.json). Written by tools/import_finds.mjs.
import { COLOR_VOID, COLOR_KILN_BRIGHT, COLOR_GLAZE_LIGHT } from "../engine/palette.js";
import { Sprite } from "../engine/sprite.js";

export const FIND_SPRITES: Record<string, Sprite> = {
  find: { colors: [COLOR_VOID, COLOR_KILN_BRIGHT, COLOR_GLAZE_LIGHT], rows: ["........", "........", "....11..", "...121..", "..12321.", "...121..", "....11..", "........"] },
};
