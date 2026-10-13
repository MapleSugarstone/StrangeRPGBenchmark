import { rect, W, H, faded } from '../engine/screen';
import { text, textWidth, wrap, LINE } from '../engine/font';
import { input } from '../engine/input';
import { UI } from './palette';
import type { Script } from './types';
import { drawPoly } from './title';

/** Full-screen text on black, for the opening and the endings. Lines appear one at a time. */
export const CARD = { lines: [] as string[], color: UI.paper as string, active: false, t: 0, poly: false };

export function* card(lines: string[], color: string = UI.paper, poly = false): Script {
  CARD.lines = lines; CARD.color = color; CARD.active = true; CARD.t = 0; CARD.poly = poly;
  while (CARD.active) yield;
}

export function cardUpdate(): void {
  if (!CARD.active) return;
  CARD.t++;
  const need = CARD.lines.length * 40;
  if (input.hit('ok')) { if (CARD.t < need) CARD.t = need; else CARD.active = false; }
}

export function cardDraw(tick: number): void {
  if (!CARD.active) return;
  rect(0, 0, W, H, UI.ink);
  if (CARD.poly) drawPoly(112, 40, 18, tick, '#5a5470', '#2a2440');
  const wrapped = CARD.lines.map(l => wrap(l, 196));
  const total = wrapped.reduce((s, w) => s + w.length, 0) + CARD.lines.length - 1;
  let y = Math.round((H - total * LINE) / 2) + (CARD.poly ? 14 : 0);
  wrapped.forEach((ls, i) => {
    const lvl = Math.max(0, Math.min(1, (CARD.t - i * 40) / 30));
    for (const l of ls) {
      const w = textWidth(l);
      faded(w + 1, 9, Math.round((W - w) / 2), y, lvl, () => text(l, 0, 0, CARD.color));
      y += LINE;
    }
    y += LINE;
  });
  if (CARD.t > CARD.lines.length * 40 && (tick >> 4) & 1) text('\u0002', W - 12, H - 12, UI.dim);
}
