import { fillRect, buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { isConfirm, isBack, updateInput, menuDirection } from "../engine/input.js";
import { COLOR_VOID, COLOR_SHADOW, COLOR_ASH, COLOR_KILN_GLOW, COLOR_STONE_WHITE, COLOR_GROUND_LIGHT } from "../engine/palette.js";
import { setScene } from "../engine/scene_manager.js";
import type { GameState } from "../engine/game_state.js";
import { BOARD } from "../content/dregs.js";
import { playSfx } from "../engine/audio.js";

/** Stones on the board at the start; the player moves first. */
export const BOARD_STONES = 14;

/** The guardian's take: leave a count one more than a multiple of four, or take one when it cannot. */
export function guardianTake(stones: number): number {
  const t = (stones - 1) % 4;
  return Math.max(1, Math.min(3, t || 1, stones));
}

/** The Undercroft's board game (design/chapters.json, area 15): a row of stones, each side takes one to three in turn,
 * and whoever must take the last stone loses. The guardian steps aside when Shard wins. */
export class BoardScene {
  private state: GameState;
  private flag: string;
  private guardian: string;
  stones = BOARD_STONES;
  /** How many the player will take, 1 to 3. */
  take = 1;
  /** Stones the guardian just took, drawn dim for a moment. */
  private taken = 0;
  private flash = 0;
  result: "won" | "lost" | null = null;

  constructor(data?: any) {
    this.state = data?.save || ({} as GameState);
    this.flag = data?.flag ?? "";
    this.guardian = data?.guardian ?? "";
  }

  update(dt: number): void {
    updateInput(dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.result) {
      if (isConfirm() || isBack()) setScene("field", { save: this.state });
      return;
    }
    if (isBack()) { setScene("field", { save: this.state }); return; }
    const dir = menuDirection();
    if (dir === "left" || dir === "right") {
      this.take = Math.max(1, Math.min(3, Math.min(this.stones, this.take + (dir === "left" ? -1 : 1))));
      playSfx("menu_move");
    }
    if (!isConfirm()) return;
    const mine = Math.min(this.take, this.stones);
    this.stones -= mine;
    playSfx("menu_confirm");
    if (this.stones === 0) { this.end("lost"); return; }
    const theirs = guardianTake(this.stones);
    this.stones -= theirs;
    this.taken = theirs;
    this.flash = 0.8;
    if (this.stones === 0) { this.end("won"); return; }
    this.take = Math.min(this.take, this.stones);
  }

  private end(result: "won" | "lost"): void {
    this.result = result;
    if (result === "won") {
      if (this.flag) this.state.flags[this.flag] = true;
      playSfx("door");
    } else playSfx("ko");
  }

  private rows(text: string, width: number): string[] {
    const rows: string[] = [];
    for (const w of text.split(" ")) {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${w}`) <= width) rows[rows.length - 1] = `${last} ${w}`;
      else rows.push(w);
    }
    return rows;
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    fillRect(8, 8, 176, 176, COLOR_SHADOW);
    fillRect(9, 9, 174, 174, COLOR_VOID);
    drawText(buffer, this.guardian, 16, 16, COLOR_KILN_GLOW);
    this.rows(BOARD.rules, 160).slice(0, 3).forEach((r, i) => drawText(buffer, r, 16, 30 + i * 10, COLOR_ASH));
    // The stones: those left, then the guardian's last take, dim for a moment.
    const total = this.stones + (this.flash > 0 ? this.taken : 0);
    for (let i = 0; i < total; i++) {
      const x = 96 - total * 5 + i * 10, y = 82;
      fillRect(x, y, 7, 7, i < this.stones ? COLOR_STONE_WHITE : COLOR_GROUND_LIGHT);
    }
    if (this.result) {
      this.rows(this.result === "won" ? BOARD.win : BOARD.lose, 160).slice(0, 3)
        .forEach((r, i) => drawText(buffer, r, 16, 112 + i * 10, COLOR_KILN_GLOW));
      return;
    }
    // How many to take: 1, 2, or 3, the chosen one lit, and the stones it would take marked.
    [1, 2, 3].forEach((n) => {
      const x = 72 + (n - 1) * 20;
      const can = n <= this.stones;
      if (n === this.take) fillRect(x - 3, 113, 2, 6, COLOR_KILN_GLOW);
      drawText(buffer, `${n}`, x, 112, !can ? COLOR_GROUND_LIGHT : n === this.take ? COLOR_STONE_WHITE : COLOR_ASH);
    });
    for (let i = this.stones - this.take; i < this.stones; i++) {
      if (i >= 0) fillRect(96 - this.stones * 5 + i * 10, 91, 7, 1, COLOR_KILN_GLOW);
    }
  }
}
