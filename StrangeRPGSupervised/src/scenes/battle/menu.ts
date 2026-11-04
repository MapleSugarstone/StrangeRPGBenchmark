import { fillRect } from "../../engine/screen.js";
import { drawText } from "../../engine/font.js";
import { COLOR_SHADOW, COLOR_KILN_GLOW, COLOR_STONE_WHITE, COLOR_ASH } from "../../engine/palette.js";
import { BattleState } from "../../battle/engine.js";
import { SPECIES } from "../../battle/species.js";
import { MenuCursor } from "../../engine/input.js";

export function drawBattleMenu(state: BattleState, cursor: MenuCursor, buffer: ImageData): void {
  fillRect(0, 160, 192, 32, COLOR_SHADOW);

  const items = getMenuItems(state);
  const selected = cursor.get("battleMenu", items.length);

  for (let i = 0; i < items.length; i++) {
    const y = 162 + i * 9;
    if (i === selected) {
      drawText(buffer, "▸", 2, y, COLOR_KILN_GLOW);
      drawText(buffer, items[i], 10, y, COLOR_STONE_WHITE);
    } else {
      drawText(buffer, items[i], 10, y, COLOR_ASH);
    }
  }
}

function getMenuItems(state: BattleState): string[] {
  const items = ["Attack", "Moves", "Guard", "Link"];
  if (state.opponentTeam[0].hp / state.opponentTeam[0].maxHp <= 0.5) {
    items.push("Catch");
  }
  items.push("Switch");
  if (state.opponentTeam[0].hp / state.opponentTeam[0].maxHp <= 0.5) {
    items.push("Run");
  }
  return items;
}

export function drawMoveSelect(state: BattleState, cursor: MenuCursor, buffer: ImageData): void {
  fillRect(0, 160, 192, 32, COLOR_SHADOW);
  const moves = state.playerTeam[0].moves;
  const selected = cursor.get("battleMoves", moves.length);

  for (let i = 0; i < moves.length; i++) {
    const y = 162 + i * 9;
    if (i === selected) {
      drawText(buffer, "▸", 2, y, COLOR_KILN_GLOW);
      drawText(buffer, moves[i].data.name, 10, y, COLOR_STONE_WHITE);
    } else {
      drawText(buffer, moves[i].data.name, 10, y, COLOR_ASH);
    }
  }

  if (moves[selected]) {
    const move = moves[selected].data;
    drawText(buffer, move.description, 10, 185, COLOR_ASH);
  }
}

export function drawSwitchSelect(state: BattleState, cursor: MenuCursor, buffer: ImageData): void {
  fillRect(0, 160, 192, 32, COLOR_SHADOW);
  const switchable = state.playerTeam.filter((r, i) => i !== 0 && !r.isFainted);
  const selected = cursor.get("battleSwitch", switchable.length);

  for (let i = 0; i < switchable.length; i++) {
    const y = 162 + i * 9;
    const species = SPECIES[switchable[i].speciesKey];
    if (i === selected) {
      drawText(buffer, "▸", 2, y, COLOR_KILN_GLOW);
      drawText(buffer, species.name, 10, y, COLOR_STONE_WHITE);
    } else {
      drawText(buffer, species.name, 10, y, COLOR_ASH);
    }
  }
}
