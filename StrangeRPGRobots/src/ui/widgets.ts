// Small interface helpers shared by menus: panels, lists, and name entry.
import { box, rect, hline } from '../engine/gfx';
import { drawText, textWidth, wrap, LINE_H } from '../engine/font';
import { C } from '../engine/palette';
import { pressed, repeat, MOUSE, mouseActive, takeTyped, setTextMode } from '../engine/input';
import { W } from '../engine/screen';
import { LAYOUT, wrapClipped } from '../engine/layout';
import { blip } from '../audio/sfx';

export function panel(x: number, y: number, w: number, h: number, title?: string) {
  box(x, y, w, h, C.ink, C.slate);
  if (title) {
    drawText(title, x + 4, y + 3, C.amb3);
    hline(x + 2, y + 12, w - 4, C.night);
  }
}

/** A vertical list with keyboard and mouse. Returns the new selection and whether it was confirmed. */
export function listInput(sel: number, n: number, x: number, y: number, w: number, rowH = LINE_H, rowItem?: (row: number) => number): { sel: number; ok: boolean } {
  if (n <= 0) return { sel: 0, ok: false };
  let s = Math.min(sel, n - 1);
  if (repeat('up')) { s = (s + n - 1) % n; blip(); }
  if (repeat('down')) { s = (s + 1) % n; blip(); }
  let ok = pressed('a');
  if (mouseActive() && MOUSE.x >= x && MOUSE.x < x + w) {
    const row = Math.floor((MOUSE.y - y) / rowH);
    const i = rowItem ? (row >= 0 ? rowItem(row) : -1) : row;
    if (i >= 0 && i < n) {
      if (MOUSE.moved && i !== s) s = i;
      if (MOUSE.left) { s = i; ok = true; }
    }
  }
  return { sel: s, ok };
}

/** How far the later lines of a wrapped entry sit in from its first line. */
export const INDENT = 6;

export interface ListItem { text: string; color?: number; right?: string; dim?: boolean }
export interface ListRow { i: number; text: string; first: boolean }

/** The visible rows of a list whose long entries wrap, scrolled so the selected entry shows in full. */
export function listRows(items: ListItem[], sel: number, w: number, vis: number): ListRow[] {
  const rows: ListRow[] = [];
  items.forEach((it, i) => {
    const lines = wrap(it.text, w - (it.right ? textWidth(it.right) + 3 : 0) - 3 - INDENT);
    (lines.length ? lines : ['']).forEach((text, k) => rows.push({ i, text, first: k === 0 }));
  });
  const a = Math.max(0, rows.findIndex((r) => r.i === sel));
  let b = a;
  while (b + 1 < rows.length && rows[b + 1].i === sel) b++;
  let start = Math.max(0, Math.min(a - Math.floor(vis / 2), rows.length - vis));
  if (b >= start + vis) start = b - vis + 1;
  return rows.slice(start, start + vis);
}

/** Draws rows from listRows. The highlight covers every row of the selected entry. */
export function drawListRows(rows: ListRow[], items: ListItem[], sel: number, x: number, y: number, w: number) {
  rows.forEach((r, k) => {
    const it = items[r.i], yy = y + k * LINE_H;
    if (r.i === sel) { rect(x - 2, yy - 1, w + 4, LINE_H, C.vio0); if (r.first) rect(x - 1, yy + 2, 1, 3, C.cyan3); }
    drawText(r.text, x + 2 + (r.first ? 0 : INDENT), yy, it.dim ? C.slate : it.color ?? (r.i === sel ? C.white : C.pale));
    if (r.first && it.right) drawText(it.right, x + w - textWidth(it.right) - 2, yy, it.dim ? C.slate : C.gray);
  });
}

export function drawList(items: ListItem[], sel: number, x: number, y: number, w: number, rowH = LINE_H) {
  items.forEach((it, i) => {
    const yy = y + i * rowH;
    if (i === sel) { rect(x - 2, yy - 1, w + 4, rowH, C.vio0); rect(x - 1, yy + 2, 1, 3, C.cyan3); }
    const col = it.dim ? C.slate : it.color ?? (i === sel ? C.white : C.pale);
    const rw = it.right ? textWidth(it.right) + 3 : 0;
    drawText(it.text, x + 2, yy, col, w - rw - 3);
    if (it.right) drawText(it.right, x + w - rw + 1, yy, it.dim ? C.slate : C.gray);
  });
}

export function drawWrapped(s: string, x: number, y: number, w: number, color: number = C.pale, maxLines = 99): number {
  const all = wrap(s, w), lines = all.slice(0, maxLines);
  if (LAYOUT.on && all.length > maxLines) wrapClipped(s, x, y);
  lines.forEach((l, i) => drawText(l, x, y + i * LINE_H, color));
  return lines.length * LINE_H;
}

/** A one-line text entry. Returns the text when Enter is pressed. */
export class NameEntry {
  text: string;
  done: string | null = null;
  t = 0;
  constructor(public title: string, init: string, public max = 12) { this.text = init; setTextMode(true); }
  update(dt: number) {
    this.t += dt;
    for (const ch of takeTyped()) {
      if (ch === '\b') this.text = this.text.slice(0, -1);
      else if (ch === '\n') { if (this.text.trim()) { this.done = this.text.trim(); setTextMode(false); } }
      else if (this.text.length < this.max && /[A-Za-z0-9 '.-]/.test(ch)) this.text += ch;
    }
  }
  render() {
    const w = 140, x = (W - w) / 2, y = 80;
    panel(x, y, w, 42, this.title);
    rect(x + 6, y + 17, w - 12, 12, C.black);
    drawText(this.text, x + 9, y + 19, C.white);
    rect(x + 9 + textWidth(this.text) + 1, y + 19, 1, 8, C.cyan3);
    drawText('Type, Enter', x + 6, y + 31, C.gray);
  }
}
