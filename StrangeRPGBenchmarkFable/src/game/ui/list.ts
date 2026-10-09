import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import type { ColorName } from "../../engine/palette";
import { getSprite, type SpriteSpec } from "../../engine/sprites";
import { FONT_W } from "../../engine/font";
import { audio } from "../../engine/audio";

export interface ListItem {
  label: string;
  right?: string;
  desc?: string;
  disabled?: boolean;
  /** A heading or continuation row the cursor never stops on. */
  skip?: boolean;
  sprite?: SpriteSpec;
  color?: ColorName;
  value?: unknown;
}

/** Distance between rows. An 8 px icon sits one pixel above the text, so rows keep 2 px apart. */
export const ROW_H = 10;

/** Scrolling list with a cursor. The owner draws the frame and feeds keys. */
export class ListMenu {
  cursor = 0;
  constructor(public items: ListItem[], public rows = 6, public onOk?: (item: ListItem, index: number) => void, public onCancel?: () => void) {
    const first = items.findIndex((it) => !it.skip);
    this.cursor = Math.max(0, first);
  }

  get current(): ListItem | undefined {
    const it = this.items[this.cursor];
    return it && !it.skip ? it : undefined;
  }

  private step(dir: 1 | -1): void {
    const n = this.items.length;
    for (let i = 1; i <= n; i++) {
      const idx = (this.cursor + dir * i + n * n) % n;
      if (!this.items[idx].skip) { this.cursor = idx; return; }
    }
  }

  key(k: Key): boolean {
    const n = this.items.length;
    if (k === "up" && n) { this.step(-1); audio.sfx("cursor"); return true; }
    if (k === "down" && n) { this.step(1); audio.sfx("cursor"); return true; }
    if (k === "ok" && n) { const it = this.current; if (it && !it.disabled) { audio.sfx("confirm"); this.onOk?.(it, this.cursor); } else audio.sfx("cancel"); return true; }
    if (k === "cancel") { audio.sfx("cancel"); this.onCancel?.(); return true; }
    return false;
  }

  /** Rows run from y down by ROW_H. Labels start at x + 8, and right text ends at x + w - 2. */
  draw(s: Screen, x: number, y: number, w: number): void {
    const top = Math.max(0, Math.min(this.cursor - Math.floor(this.rows / 2), this.items.length - this.rows));
    const slice = this.items.slice(top, top + this.rows);
    const scrolls = this.items.length > this.rows;
    // Scroll arrows take the last column, so right aligned text moves left to keep clear of them.
    const right = scrolls ? x + w - 2 - FONT_W - 2 : x + w - 2;
    if (this.items.length === 0) s.text("(nothing)", x + 8, y, "gray");
    slice.forEach((it, i) => {
      const idx = top + i;
      const yy = y + i * ROW_H;
      const sel = idx === this.cursor && !it.skip;
      let lx = x + 8;
      if (it.sprite) { s.sprite(getSprite(it.sprite), lx, yy - 1, it.sprite.a, it.sprite.b); lx += 10; }
      s.text(it.label, lx, yy, sel ? "yellow" : it.disabled ? "gray" : it.color ?? "white");
      if (it.right) s.textRight(it.right, right, yy, sel ? "yellow" : "gray");
      if (sel) s.text(">", x + 1, yy, "yellow");
    });
    if (scrolls && top > 0) s.text("^", x + w - FONT_W - 1, y, "gray");
    if (scrolls && top + this.rows < this.items.length) s.text("v", x + w - FONT_W - 1, y + (this.rows - 1) * ROW_H, "gray");
  }
}
