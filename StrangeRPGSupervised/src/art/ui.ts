// Interface marks drawn by the supervisor (Claude), not game art: the arrows that show where a map's exits are.
import { COLOR_STAR, COLOR_STAR_GLOW } from "../engine/palette.js";
import { Sprite } from "../engine/sprite.js";

const arrow = (rows: string[]): Sprite => ({ colors: [COLOR_STAR_GLOW, COLOR_STAR], rows });

export const EXIT_ARROWS: Record<"left" | "right" | "up" | "down", Sprite> = {
  right: arrow(["........", "..1.....", "..21....", "..221...", "..221...", "..21....", "..1.....", "........"]),
  left: arrow(["........", ".....1..", "....12..", "...122..", "...122..", "....12..", ".....1..", "........"]),
  down: arrow(["........", "........", ".122221.", "..1221..", "...11...", "........", "........", "........"]),
  up: arrow(["........", "........", "...11...", "..1221..", ".122221.", "........", "........", "........"]),
};
