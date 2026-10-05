import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import type { ColorName } from "../../engine/palette";
import { getSprite, type SpriteSpec } from "../../engine/sprites";
import { audio } from "../../engine/audio";

export interface ListItem {
  label: string;
  right?: string;
  desc?: string;
  disabled?: boolean;
  sprite?: SpriteSpec;
  color?: ColorName;
  value?: unknown;
}

/** Scrolling list with a cursor. The owner draws the frame and feeds keys. */
export class ListMenu {
  cursor = 0;
  constructor(public items: ListItem[], public rows = 6, public onOk?: (item: ListItem, index: number) => void, public onCancel?: () => void) {}

  get current(): ListItem | undefined {
    return this.items[this.cursor];
  }

  key(k: Key): boolean {
    const n = this.items.length;
    if (k === "up" && n) { this.cursor = (this.cursor + n - 1) % n; audio.sfx("cursor"); return true; }
    if (k === "down" && n) { this.cursor = (this.cursor + 1) % n; audio.sfx("cursor"); return true; }
    if (k === "ok" && n) { const it = this.items[this.cursor]; if (!it.disabled) { audio.sfx("confirm"); this.onOk?.(it, this.cursor); } else audio.sfx("cancel"); return true; }
    if (k === "cancel") { audio.sfx("cancel"); this.onCancel?.(); return true; }
    return false;
  }

  draw(s: Screen, x: number, y: number, w: number): void {
    const top = Math.max(0, Math.min(this.cursor - Math.floor(this.rows / 2), this.items.length - this.rows));
    const slice = this.items.slice(top, top + this.rows);
    if (this.items.length === 0) s.text("(nothing)", x + 8, y, "gray");
    slice.forEach((it, i) => {
      const idx = top + i;
      const yy = y + i * 8;
      const sel = idx === this.cursor;
      let lx = x + 8;
      if (it.sprite) { s.sprite(getSprite(it.sprite), lx, yy - 1, it.sprite.a, it.sprite.b); lx += 10; }
      s.text(it.label, lx, yy, sel ? "yellow" : it.disabled ? "gray" : it.color ?? "white");
      if (it.right) s.textRight(it.right, x + w - 2, yy, sel ? "yellow" : "gray");
      if (sel) s.text(">", x + 2, yy, "yellow");
    });
    if (top > 0) s.text("^", x + w - 4, y - 6, "gray");
    if (top + this.rows < this.items.length) s.text("v", x + w - 4, y + this.rows * 8 - 2, "gray");
  }
}
