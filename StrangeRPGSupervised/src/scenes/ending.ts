import { fillRect, drawSprite, present } from "../engine/screen.js";
import { buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { getDirection, isConfirm, isBack, updateInput } from "../engine/input.js";
import {
  COLOR_VOID,
  COLOR_SHADOW,
  COLOR_GROUND,
  COLOR_GROUND_LIGHT,
  COLOR_ASH,
  COLOR_KILN_GLOW,
  COLOR_DREGS_VOID,
  COLOR_STONE_WHITE,
} from "../engine/palette.js";
import { sceneRef } from "../main.js";
import { setScene } from "../engine/scene_manager.js";
import { GameState, saveGame } from "../engine/game_state.js";
import { POSTGAME_END } from "../content/dregs.js";
import { MAPS, landingBeside } from "../engine/maps.js";

/** The map whose gate leads to the ending, and after it into the Dregs. */
const LAST_GATE = Object.keys(MAPS).find((id) => MAPS[id].warps.some((w) => w.destMap === "ending")) ?? "ashen_reach_heart_3";
import chapters from "../../design/chapters.json";

export class EndingScene {
  private state: GameState;
  private endingText: string;

  private postgame: boolean;

  constructor(data?: any) {
    this.state = data?.save || {} as GameState;
    this.postgame = !!data?.postgame;
    // The plan's three moments are catches: the ending counts which of those Ruin the player still holds.
    const held = new Set([...(this.state.party ?? []), ...Object.keys(this.state.bag ?? {})]);
    const moments = ["glass_sentinel", "mud_golem", "heart_weep"].filter((k) => held.has(k)).length;
    this.endingText = this.postgame ? POSTGAME_END : chapters.endings[moments] || chapters.endings[0];
  }

  update(dt: number): void {
    updateInput(dt);
    if (isConfirm() || isBack()) {
      // The game is kept: after the main ending at the last gate, which then leads down into the Dregs; after the
      // postgame, at the Final Rift.
      if (this.state.flags) {
        this.state.flags[this.postgame ? "postgame_done" : "ending_seen"] = true;
        if (!this.postgame) {
          const [x, y] = landingBeside(LAST_GATE, "ending") ?? [2, 12];
          Object.assign(this.state, { mapId: LAST_GATE, playerX: x, playerY: y });
        }
        this.state.partyHp = undefined;
        saveGame(this.state);
      }
      setScene("title");
    }
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    const rows: string[] = [];
    for (const word of this.endingText.split(" ")) {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${word}`) <= 172) rows[rows.length - 1] = `${last} ${word}`;
      else rows.push(word);
    }
    const top = 96 - rows.length * 5;
    drawText(buffer, "The End", 96 - textWidth("The End") / 2, top - 18, COLOR_KILN_GLOW);
    rows.forEach((row, i) => drawText(buffer, row, 10, top + i * 10, COLOR_STONE_WHITE));
    drawText(buffer, "Z: Title", 70, 160, COLOR_ASH);
  }
}
