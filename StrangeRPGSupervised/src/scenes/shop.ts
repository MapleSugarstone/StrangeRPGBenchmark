import { fillRect } from "../engine/screen.js";
import { buffer } from "../engine/screen.js";
import { drawText, textWidth } from "../engine/font.js";
import { isConfirm, isBack, updateInput, MenuCursor, menuDirection } from "../engine/input.js";
import { COLOR_VOID, COLOR_SHADOW, COLOR_ASH, COLOR_KILN_GLOW, COLOR_STONE_WHITE } from "../engine/palette.js";
import { setScene } from "../engine/scene_manager.js";
import { GameState } from "../engine/game_state.js";
import { ITEMS, TRADER } from "../content/items.js";
import { pages } from "../engine/dialogue.js";
import { playSfx } from "../engine/audio.js";
import { priceFor } from "../battle/field_passives.js";

const cursor = new MenuCursor();

/** A trader's stall: the items with their prices and how many the player holds, and the Cinder to spend. */
export class ShopScene {
  private state: GameState;
  private poor = 0;

  constructor(data?: any) {
    this.state = data?.save || ({} as GameState);
  }

  update(dt: number): void {
    updateInput(dt);
    this.poor = Math.max(0, this.poor - dt);
    const dir = menuDirection();
    if (dir === "up" || dir === "down") { playSfx("menu_move"); cursor.move("shop", ITEMS.length, dir === "up" ? -1 : 1); }
    if (isConfirm()) {
      const item = ITEMS[cursor.get("shop", ITEMS.length)];
      const cinder = this.state.bag.cinder ?? 0;
      const price = priceFor(this.state, item.key, item.price);
      if (cinder >= price) {
        this.state.bag.cinder = cinder - price;
        this.state.bag[item.key] = (this.state.bag[item.key] ?? 0) + 1;
        playSfx("menu_confirm");
      } else {
        this.poor = 2;
        playSfx("ko");
      }
    } else if (isBack()) {
      setScene("field", { save: this.state });
    }
  }

  render(): void {
    fillRect(0, 0, 192, 192, COLOR_VOID);
    fillRect(8, 8, 176, 176, COLOR_SHADOW);
    fillRect(9, 9, 174, 174, COLOR_VOID);
    // The trader's words on top: the greeting, or the refusal for a moment after the player cannot pay.
    pages(this.poor > 0 ? TRADER.poor : TRADER.open, 160, 2)[0].split(" ").reduce<string[]>((rows, w) => {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${w}`) <= 160) rows[rows.length - 1] = `${last} ${w}`; else rows.push(w);
      return rows;
    }, []).slice(0, 2).forEach((row, i) => drawText(buffer, row, 16, 16 + i * 10, this.poor > 0 ? COLOR_KILN_GLOW : COLOR_STONE_WHITE));
    const sel = cursor.get("shop", ITEMS.length);
    ITEMS.forEach((item, i) => {
      const y = 44 + i * 14;
      if (i === sel) fillRect(13, y + 1, 2, 6, COLOR_KILN_GLOW);
      drawText(buffer, item.name, 18, y, i === sel ? COLOR_STONE_WHITE : COLOR_ASH);
      const held = `x${this.state.bag[item.key] ?? 0}`;
      drawText(buffer, held, 118 - textWidth(held), y, COLOR_ASH);
      const price = `${priceFor(this.state, item.key, item.price)}`;
      drawText(buffer, price, 176 - textWidth(price), y, COLOR_KILN_GLOW);
    });
    pages(ITEMS[sel].description, 160, 2)[0].split(" ").reduce<string[]>((rows, w) => {
      const last = rows[rows.length - 1];
      if (last !== undefined && textWidth(`${last} ${w}`) <= 160) rows[rows.length - 1] = `${last} ${w}`; else rows.push(w);
      return rows;
    }, []).slice(0, 2).forEach((row, i) => drawText(buffer, row, 16, 112 + i * 10, COLOR_ASH));
    const purse = `Cinder ${this.state.bag.cinder ?? 0}`;
    drawText(buffer, purse, 176 - textWidth(purse), 168, COLOR_KILN_GLOW);
  }
}
