import { rect, W, dither } from '../engine/screen';
import { text, textWidth, wrap, LINE } from '../engine/font';
import { UI } from './palette';

/** A panel: one-pixel edge, dark fill, and a one-pixel inner shadow line. Text sits at least 3 px inside. */
export function panel(x: number, y: number, w: number, h: number, edge: string = UI.edge, fill: string = UI.panel): void {
  rect(x, y, w, h, UI.ink);
  rect(x + 1, y + 1, w - 2, h - 2, edge);
  rect(x + 2, y + 2, w - 4, h - 4, fill);
}

export interface ListItem { label: string; ok?: boolean; right?: string; color?: string }

/** Draws a vertical list with a pointer. Returns the row height used. */
export function list(items: ListItem[], cursor: number, x: number, y: number, w: number, top = 0, rows = 99): void {
  for (let i = top; i < Math.min(items.length, top + rows); i++) {
    const it = items[i];
    const yy = y + (i - top) * LINE;
    const col = it.ok === false ? UI.dim : it.color || UI.paper;
    if (i === cursor) text('\u0001', x, yy, UI.gold);
    text(it.label, x + 7, yy, i === cursor && it.ok !== false ? UI.white : col);
    if (it.right) text(it.right, x + w - textWidth(it.right), yy, it.ok === false ? UI.dim : UI.dim);
  }
  if (top > 0) text('\u0005', x + w - 5, y - 6, UI.dim);
  if (top + rows < items.length) text('\u0002', x + w - 5, y + rows * LINE - 2, UI.dim);
}

/** Moves a cursor through a list with up and down, skipping nothing. Returns the new cursor. */
export function scrollTop(cursor: number, top: number, rows: number): number {
  if (cursor < top) return cursor;
  if (cursor >= top + rows) return cursor - rows + 1;
  return top;
}

/** Wrapped text inside a width. Returns lines drawn. */
export function para(s: string, x: number, y: number, w: number, color: string = UI.paper, maxLines = 99): number {
  const lines = wrap(s, w).slice(0, maxLines);
  lines.forEach((l, i) => text(l, x, y + i * LINE, color));
  return lines.length;
}

/** A horizontal meter with hard color bands. */
export function bar(x: number, y: number, w: number, h: number, frac: number, color: string, back: string = UI.faint): void {
  rect(x, y, w, h, back);
  const fw = Math.max(0, Math.min(w, Math.round(w * frac)));
  rect(x, y, fw, h, color);
}

/** The Fragility meter: the middle band is safe, both ends are dangerous. */
export function fragBar(x: number, y: number, w: number, f: number, fmax: number, fadeAt: number, overAt: number, t: number): void {
  rect(x - 1, y - 1, w + 2, 6, UI.ink);
  rect(x, y, w, 4, UI.faint);
  const fx = (v: number) => x + Math.round((w * v) / fmax);
  dither(x, y, fx(fadeAt) - x, 4, '#5a3a8a', 0.5);
  dither(fx(overAt), y, x + w - fx(overAt), 4, '#8a3a2a', 0.5);
  const over = f > overAt, fade = f < fadeAt;
  const col = over ? ((t >> 3) & 1 ? UI.red : UI.gold) : fade ? '#8a7ab8' : UI.paper;
  rect(x, y, Math.max(0, fx(Math.min(f, fmax)) - x), 4, col);
  rect(fx(fadeAt), y - 1, 1, 6, UI.dim);
  rect(fx(overAt), y - 1, 1, 6, UI.dim);
}

export function center(s: string, y: number, color: string = UI.paper): void {
  text(s, Math.round((W - textWidth(s)) / 2), y, color);
}

/** Short messages that rise in the top-left of the field. */
const toasts: { text: string; t: number; color: string }[] = [];
export function toast(s: string, color: string = UI.paper): void {
  toasts.push({ text: s, t: 150, color });
  while (toasts.length > 3) toasts.shift();
}
export function drawToasts(top = 3): void {
  let y = top;
  for (const m of toasts) {
    const lines = wrap(m.text, 208);
    const w = Math.max(...lines.map(l => textWidth(l))) + 9;
    const h = lines.length * LINE + 5;
    panel(2, y, w, h);
    lines.forEach((l, i) => text(l, 6, y + 3 + i * LINE, m.color));
    y += h + 1;
    m.t--;
  }
  for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].t <= 0) toasts.splice(i, 1);
}
export function clearToasts(): void { toasts.length = 0; }
