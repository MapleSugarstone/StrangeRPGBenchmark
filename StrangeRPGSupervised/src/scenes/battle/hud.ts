import { fillRect } from "../../engine/screen.js";
import { drawText } from "../../engine/font.js";
import { COLOR_SHADOW, COLOR_GLAZE_RED, COLOR_GLAZE_RED_BRIGHT, COLOR_KILN_GLOW, COLOR_STONE_WHITE } from "../../engine/palette.js";
import { BattleState } from "../../battle/engine.js";
import { SPECIES } from "../../battle/species.js";

export function drawBattleHud(state: BattleState, buffer: ImageData, catchLine: number | null): void {
  const playerRuin = state.playerTeam[0];
  const opponentRuin = state.opponentTeam[0];

  // Opponent HUD
  if (opponentRuin) {
    const species = SPECIES[opponentRuin.speciesKey];
    drawText(buffer, species.name, 10, 20, COLOR_STONE_WHITE);
    drawText(buffer, `L${opponentRuin.level}`, 160, 20, COLOR_STONE_WHITE);

    const hpPercent = opponentRuin.hp / opponentRuin.maxHp;
    const hpWidth = Math.floor(hpPercent * 80);
    fillRect(10, 35, 80, 4, COLOR_SHADOW);
    fillRect(10, 35, hpWidth, 4, hpPercent > 0.5 ? COLOR_GLAZE_RED_BRIGHT : COLOR_GLAZE_RED);

    // Catch line
    if (catchLine !== null) {
      const catchWidth = Math.floor(catchLine * 80);
      fillRect(10, 35, catchWidth, 4, COLOR_SHADOW);
    }

    drawText(buffer, `${opponentRuin.hp}/${opponentRuin.maxHp}`, 10, 42, COLOR_STONE_WHITE);

    let statusX = 10;
    for (const status of opponentRuin.statuses) {
      drawText(buffer, status.status[0], statusX, 50, COLOR_GLAZE_RED_BRIGHT);
      statusX += 8;
    }
  }

  // Player HUD
  if (playerRuin) {
    const species = SPECIES[playerRuin.speciesKey];
    drawText(buffer, species.name, 10, 140, COLOR_STONE_WHITE);
    drawText(buffer, `L${playerRuin.level}`, 160, 140, COLOR_STONE_WHITE);

    const hpPercent = playerRuin.hp / playerRuin.maxHp;
    const hpWidth = Math.floor(hpPercent * 80);
    fillRect(10, 155, 80, 4, COLOR_SHADOW);
    fillRect(10, 155, hpWidth, 4, hpPercent > 0.5 ? COLOR_GLAZE_RED_BRIGHT : COLOR_GLAZE_RED);

    drawText(buffer, `${playerRuin.hp}/${playerRuin.maxHp}`, 10, 162, COLOR_STONE_WHITE);

    let statusX = 10;
    for (const status of playerRuin.statuses) {
      drawText(buffer, status.status[0], statusX, 170, COLOR_GLAZE_RED_BRIGHT);
      statusX += 8;
    }
  }

  // Boost pool
  drawText(buffer, `Boost: ${state.boost}`, 100, 140, COLOR_KILN_GLOW);
}
