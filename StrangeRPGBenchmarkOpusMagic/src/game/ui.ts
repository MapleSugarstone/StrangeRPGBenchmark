// Shared interface pieces: panels, menus, colors.
import { sfx } from '../engine/audio';
import { CW, LH, text } from '../engine/font';
import { pressed } from '../engine/input';
import { frame, rect } from '../engine/screen';

export const C = {
  bg: 0x0e0c14,
  panel: 0x15121c,
  edge: 0x6a6478,
  text: 0xe6d8bc,
  dim: 0x7a7488,
  faint: 0x3a3646,
  hi: 0x6fe3e0,
  bad: 0xff5a5a,
  good: 0x9fd88a,
  gold: 0xf2d25a,
  again: 0xc8ff2e,
  kw: 0xa99ad8,
  num: 0xf2f25a,
  str: 0x9fd88a,
  fn: 0x6fe3e0,
  prop: 0xb8c8e0,
  aside: 0x6a6478,
  sel: 0x2a2440,
};

export function panel(x: number, y: number, w: number, h: number, edge = C.edge) {
  rect(x, y, w, h, C.panel);
  frame(x, y, w, h, edge);
}

export interface MenuItem { label: string; disabled?: boolean; color?: number; right?: string; rightColor?: number }

/** A vertical list with a cursor. */
export class Menu {
  i = 0;
  top = 0;
  constructor(public items: MenuItem[], public rows = 8) {}

  set(items: MenuItem[]) {
    this.items = items;
    this.i = Math.min(this.i, Math.max(0, items.length - 1));
  }

  /** Returns the chosen index, -2 on back, or -1 while nothing is chosen. */
  update(back = true): number {
    const n = this.items.length;
    if (n && pressed('up')) { this.i = (this.i + n - 1) % n; sfx.move(); }
    if (n && pressed('down')) { this.i = (this.i + 1) % n; sfx.move(); }
    if (this.i < this.top) this.top = this.i;
    if (this.i >= this.top + this.rows) this.top = this.i - this.rows + 1;
    if (pressed('ok') && n) {
      if (this.items[this.i].disabled) { sfx.error(); return -1; }
      sfx.ok();
      return this.i;
    }
    if (back && pressed('back')) { sfx.back(); return -2; }
    return -1;
  }

  draw(x: number, y: number, w: number, active = true) {
    const end = Math.min(this.items.length, this.top + this.rows);
    for (let k = this.top; k < end; k++) {
      const it = this.items[k];
      const yy = y + (k - this.top) * LH;
      if (k === this.i && active) rect(x - 1, yy - 1, w + 2, LH, C.sel);
      const col = it.disabled ? C.faint : it.color ?? C.text;
      if (k === this.i && active) text('\x01', x, yy, C.hi);
      text(it.label, x + 6, yy, col);
      if (it.right) text(it.right, x + w - it.right.length * CW, yy, it.rightColor ?? C.dim);
    }
    if (this.top > 0) text('\x04', x + w - 4, y - 7, C.dim);
    if (end < this.items.length) text('\x03', x + w - 4, y + this.rows * LH - 2, C.dim);
  }
}

export function bar(x: number, y: number, w: number, v: number, max: number, col: number, back = C.faint) {
  rect(x, y, w, 2, back);
  const f = max > 0 ? Math.max(0, Math.min(w, Math.round((w * v) / max))) : 0;
  rect(x, y, f, 2, col);
}
