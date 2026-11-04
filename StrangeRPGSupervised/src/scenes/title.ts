import { fillRect, drawSprite, dither, present } from "../engine/screen.js";
import { buffer } from "../engine/screen.js";
import { drawText, textWidth, drawScaledGlyph, GLYPHS } from "../engine/font.js";
import { getDirection, isConfirm, isBack, updateInput } from "../engine/input.js";
import { SPRITES } from "../art/sprites.js";
import {
  COLOR_VOID,
  COLOR_SHADOW,
  COLOR_GROUND,
  COLOR_GROUND_LIGHT,
  COLOR_ASH,
  COLOR_KILN_GLOW,
  COLOR_STONE_LIGHT,
  COLOR_DREGS_VOID,
} from "../engine/palette.js";
import { sceneRef } from "../main.js";
import { setScene, startGame } from "../engine/scene_manager.js";
import { hasSave, loadGame } from "../engine/game_state.js";

export class TitleScene {
  update(dt: number): void {
    if (isConfirm()) {
      setScene("field");
    }
    if (isBack() && hasSave()) {
      setScene("field", { save: loadGame() });
    }
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    const title = "RUIN";
    const scale = 4;
    const charW = 5 * scale;
    const totalW = title.length * charW;
    const titleX = (192 - totalW) / 2;
    const titleY = 60;
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      const glyph = GLYPHS[ch];
      if (!glyph) continue;
      const charX = titleX + i * charW;
      drawScaledGlyph(buffer, glyph, charX, titleY, scale, COLOR_STONE_LIGHT);
    }
    const studio = "Scoobert Studios";
    const studioWidth = textWidth(studio);
    const studioX = (192 - studioWidth) / 2;
    const studioY = 100;
    drawText(buffer, studio, studioX, studioY, COLOR_ASH);
    drawSprite(SPRITES.shard, 60, 120, 1);
    drawSprite(SPRITES.glass_sentinel, 100, 120, 1);
    drawSprite(SPRITES.rust_crawler, 140, 120, 1);
    const start = "Z: start";
    const startWidth = textWidth(start);
    const startX = (192 - startWidth) / 2;
    const startY = 160;
    drawText(buffer, start, startX, startY, COLOR_KILN_GLOW);
    if (hasSave()) {
      const cont = "X: continue";
      const contWidth = textWidth(cont);
      const contX = (192 - contWidth) / 2;
      const contY = 170;
      drawText(buffer, cont, contX, contY, COLOR_ASH);
    }
  }
}
