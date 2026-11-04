import { fillRect, drawSprite, buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { isConfirm, isBack, updateInput, MenuCursor, menuDirection } from "../engine/input.js";
import { COLOR_VOID, COLOR_SHADOW, COLOR_ASH, COLOR_KILN_GLOW, COLOR_STONE_WHITE, COLOR_GROUND_LIGHT } from "../engine/palette.js";
import { setScene } from "../engine/scene_manager.js";
import { GameState, QUENCH_STATS, QUENCH_MAX, QUENCH_PRICE, QUENCH_STEP, quench, quenchLayers } from "../engine/game_state.js";
import { ruinStats } from "../battle/engine.js";
import { SPECIES } from "../battle/species.js";
import { SPRITES } from "../art/sprites.js";
import { QUENCHER } from "../content/quench.js";
import { pages } from "../engine/dialogue.js";
import { playSfx } from "../engine/audio.js";

const cursor = new MenuCursor();
const LABELS: Record<string, string> = { atk: "ATK", def: "DEF", res: "RES", mgk: "MGK", agi: "AGI" };

/** The quencher's station: pick a team member, then buy layers on its stats for Cinder. */
export class QuenchScene {
  private state: GameState;
  private view: "team" | "stats" = "team";
  private slot = 0;
  /** Seconds left on the refusal line, and which one. */
  private refusal = 0;
  private refused: "poor" | "full" = "poor";
  private bought = 0;

  constructor(data?: any) {
    this.state = data?.save || ({} as GameState);
  }

  update(dt: number): void {
    updateInput(dt);
    this.refusal = Math.max(0, this.refusal - dt);
    this.bought = Math.max(0, this.bought - dt);
    const dir = menuDirection();
    const step = dir === "up" ? -1 : dir === "down" ? 1 : 0;
    if (step) playSfx("menu_move");
    if (this.view === "team") {
      const n = this.state.party.length;
      if (step) cursor.move("quenchTeam", n, step);
      if (isConfirm()) {
        this.slot = cursor.get("quenchTeam", n);
        this.view = "stats";
        playSfx("menu_confirm");
      } else if (isBack()) setScene("field", { save: this.state });
      return;
    }
    if (step) cursor.move("quenchStat", QUENCH_STATS.length, step);
    if (isConfirm()) {
      const why = quench(this.state, this.slot, QUENCH_STATS[cursor.get("quenchStat", QUENCH_STATS.length)]);
      if (why) {
        this.refused = why;
        this.refusal = 2;
        playSfx("ko");
      } else {
        this.bought = 0.4;
        playSfx("level_up");
      }
    } else if (isBack()) this.view = "team";
  }

  private rows(text: string, y: number, color: string): void {
    pages(text, 160, 3)[0].split(" ").reduce<string[]>((rows, w) => {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${w}`) <= 160) rows[rows.length - 1] = `${last} ${w}`; else rows.push(w);
      return rows;
    }, []).slice(0, 3).forEach((row, i) => drawText(buffer, row, 16, y + i * 10, color));
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    fillRect(8, 8, 176, 176, COLOR_SHADOW);
    fillRect(9, 9, 174, 174, COLOR_VOID);
    drawText(buffer, QUENCHER.title, 16, 16, COLOR_KILN_GLOW);
    // The help line, or the quencher's refusal for a moment after one.
    if (this.refusal > 0) this.rows(this.refused === "poor" ? QUENCHER.poor : QUENCHER.full, 30, COLOR_KILN_GLOW);
    else this.rows(QUENCHER.help, 30, COLOR_ASH);
    const layers = this.state.partyQuench ?? [];
    if (this.view === "team") {
      const sel = cursor.get("quenchTeam", this.state.party.length);
      this.state.party.forEach((key, i) => {
        const y = 68 + i * 14;
        if (i === sel) fillRect(13, y + 1, 2, 6, COLOR_KILN_GLOW);
        if (SPRITES[key]) drawSprite(SPRITES[key], 18, y - 1, 1);
        drawText(buffer, SPECIES[key]?.name ?? key, 30, y, i === sel ? COLOR_STONE_WHITE : COLOR_ASH);
        const count = `${quenchLayers(layers[i])}/${QUENCH_MAX}`;
        drawText(buffer, count, 176 - textWidth(count), y, quenchLayers(layers[i]) >= QUENCH_MAX ? COLOR_KILN_GLOW : COLOR_ASH);
      });
    } else {
      const key = this.state.party[this.slot], q = layers[this.slot] ?? {};
      const full = quenchLayers(q) >= QUENCH_MAX, poor = (this.state.bag.cinder ?? 0) < QUENCH_PRICE;
      if (SPRITES[key]) drawSprite(SPRITES[key], 18, 65, 1);
      drawText(buffer, SPECIES[key]?.name ?? key, 30, 66, COLOR_STONE_WHITE);
      const count = `${quenchLayers(q)}/${QUENCH_MAX}`;
      drawText(buffer, count, 176 - textWidth(count), 66, full ? COLOR_KILN_GLOW : COLOR_ASH);
      const base = ruinStats(key, this.state.partyLevels[this.slot] ?? 1);
      const sel = cursor.get("quenchStat", QUENCH_STATS.length);
      QUENCH_STATS.forEach((s, i) => {
        const y = 84 + i * 14;
        if (i === sel) fillRect(13, y + 1, 2, 6, this.bought > 0 ? COLOR_STONE_WHITE : COLOR_KILN_GLOW);
        const value = Math.round(base[s] * (1 + QUENCH_STEP * (q[s] ?? 0)));
        drawText(buffer, LABELS[s], 18, y, full ? COLOR_GROUND_LIGHT : i === sel ? COLOR_STONE_WHITE : COLOR_ASH);
        drawText(buffer, `${value}`, 80 - textWidth(`${value}`), y, full ? COLOR_GROUND_LIGHT : COLOR_ASH);
        if (q[s]) drawText(buffer, `+${q[s]}`, 92, y, COLOR_KILN_GLOW);
        drawText(buffer, `${QUENCH_PRICE}`, 176 - textWidth(`${QUENCH_PRICE}`), y, full || poor ? COLOR_GROUND_LIGHT : COLOR_KILN_GLOW);
      });
    }
    const purse = `Cinder ${this.state.bag.cinder ?? 0}`;
    drawText(buffer, purse, 176 - textWidth(purse), 168, COLOR_KILN_GLOW);
  }
}
