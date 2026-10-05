import type { Gfx } from '../core/gfx';
import type { Input } from '../core/input';
import type { Audio } from '../core/audio';
import { Col, Hue, HUE_COLOR } from '../core/palette';
import { LINE_H, textW } from '../core/font';

export interface MenuItem {
  label: string;
  right?: string;
  enabled?: boolean;
  color?: Col;
  desc?: string;
  hue?: Hue;
  id?: string;
}

export class Menu {
  idx = 0;
  top = 0;
  constructor(public items: MenuItem[], public rows = 6, public cols = 1) {}

  get cur(): MenuItem | undefined {
    return this.items[this.idx];
  }

  setItems(items: MenuItem[]) {
    this.items = items;
    this.idx = Math.min(this.idx, Math.max(0, items.length - 1));
    this.clampTop();
  }

  private clampTop() {
    const perPage = this.rows * this.cols;
    const row = Math.floor(this.idx / this.cols);
    if (row < this.top) this.top = row;
    if (row >= this.top + this.rows) this.top = row - this.rows + 1;
    this.top = Math.max(0, Math.min(this.top, Math.ceil(this.items.length / this.cols) - this.rows));
    if (this.items.length <= perPage) this.top = 0;
  }

  update(input: Input, audio: Audio): 'ok' | 'back' | null {
    const n = this.items.length;
    if (n > 0) {
      let moved = false;
      if (input.repeat('down')) { this.idx = (this.idx + this.cols) % (Math.ceil(n / this.cols) * this.cols); if (this.idx >= n) this.idx = this.idx % this.cols; moved = true; }
      if (input.repeat('up')) { this.idx -= this.cols; if (this.idx < 0) { this.idx += Math.ceil(n / this.cols) * this.cols; while (this.idx >= n) this.idx -= this.cols; } moved = true; }
      if (this.cols > 1 && input.repeat('right')) { this.idx = Math.min(n - 1, this.idx + 1); moved = true; }
      if (this.cols > 1 && input.repeat('left')) { this.idx = Math.max(0, this.idx - 1); moved = true; }
      if (moved) { audio.sfx('move'); this.clampTop(); }
    }
    if (input.pressed('a')) {
      if (n && this.cur?.enabled !== false) { audio.sfx('ok'); return 'ok'; }
      audio.sfx('bump');
    }
    if (input.pressed('b')) { audio.sfx('back'); return 'back'; }
    return null;
  }

  draw(g: Gfx, x: number, y: number, w: number, t: number, active = true, box = true) {
    const colW = (w - 12) / this.cols;
    const h = this.rows * LINE_H + 6;
    if (box) g.box(x, y, w, h);
    const start = this.top * this.cols;
    for (let i = 0; i < this.rows * this.cols; i++) {
      const it = this.items[start + i];
      if (!it) break;
      const cx = x + 9 + (i % this.cols) * colW;
      const cy = y + 4 + Math.floor(i / this.cols) * LINE_H;
      const col: Col = it.enabled === false ? 'g1' : it.color ?? 'w';
      if (it.hue) { g.rect(cx, cy + 1, 3, 3, HUE_COLOR[it.hue]); g.text(it.label, cx + 5, cy, col); }
      else g.text(it.label, cx, cy, col);
      if (it.right) g.textR(it.right, cx + colW - 4, cy, it.enabled === false ? 'g1' : 'g2');
      if (start + i === this.idx && active) g.cursor(cx - 6, cy, t);
      else if (start + i === this.idx) g.text('`', cx - 5, cy, 'g1');
    }
    const totalRows = Math.ceil(this.items.length / this.cols);
    if (this.top > 0) g.rect(x + w - 5, y + 2, 3, 1, 'g2');
    if (this.top + this.rows < totalRows) g.rect(x + w - 5, y + h - 4, 3, 1, 'g2');
  }
}

export function hueChips(g: Gfx, hues: Hue[], x: number, y: number) {
  hues.forEach((h, i) => {
    g.rect(x + i * 4, y, 3, 3, h === 'N' ? 'g2' : HUE_COLOR[h]);
  });
}

export function wrapBox(g: Gfx, lines: string[], x: number, y: number, w: number) {
  g.box(x, y, w, lines.length * LINE_H + 5);
  lines.forEach((l, i) => g.text(l, x + 4, y + 3 + i * LINE_H));
}

export function centerBox(g: Gfx, text: string, y: number, col: Col = 'w') {
  const w = textW(text) + 10;
  g.box(80 - Math.ceil(w / 2), y, w, 11);
  g.textC(text, 80, y + 3, col);
}
