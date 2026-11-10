// Shared parts of the hacking minigames: the overlay contract, who plays, the glyph art, and the result box.
import { img, rect, box, blitUI, upx, type Img } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { W, H } from '../engine/screen';
import { partyMembers, pool } from '../rules/stats';
import type { Glyph } from '../content/undertow_puzzles';

export interface Minigame {
  update(dt: number): void;
  render(): void;
  done: boolean;
  won: boolean;
  /** Flags to set for bonus targets reached. */
  bonus: string[];
  /** Packets or other counted pickups. */
  count: number;
}

/** The party member with the biggest Hack pool plays every hacking minigame. */
export function hacker(): { name: string; pool: number } {
  let best = { name: 'You', pool: 3 };
  for (const m of partyMembers()) {
    if (m.id === 'port') continue;
    const p = pool(m, 'hack');
    if (p > best.pool || best.name === 'You') best = { name: m.id === 'hero' ? 'You' : m.name, pool: p };
  }
  return best;
}

const G7: Record<Glyph, string[]> = {
  anger: ['...1...', '..1.1..', '..1.1..', '.1...1.', '.1...1.', '1.....1', '1111111'],
  fear: ['...1...', '..1.1..', '.1...1.', '1.....1', '.1...1.', '..1.1..', '...1...'],
  calm: ['.......', '.11..11', '1..11..', '.......', '.11..11', '1..11..', '.......'],
  joy: ['...1...', '.1.1.1.', '..111..', '1111111', '..111..', '.1.1.1.', '...1...'],
  grief: ['...1...', '...1...', '..111..', '.11111.', '.11111.', '.11111.', '..111..'],
  hush: ['1..1..1', '.1.1.1.', '..111..', '111.111', '..111..', '.1.1.1.', '1..1..1'],
};
export const GLYPH_COLOR: Record<Glyph, number> = { anger: C.mag3, fear: C.vio3, calm: C.cyan3, joy: C.amb3, grief: C.steel3, hush: C.pale };
const GLYPH_IMG = new Map<string, Img>();
export function glyphImg(g: Glyph, color: number): Img {
  const k = `${g}:${color}`;
  let im = GLYPH_IMG.get(k);
  if (!im) { im = img(G7[g], [color]); GLYPH_IMG.set(k, im); }
  return im;
}
export function drawGlyph(g: Glyph, x: number, y: number, color = GLYPH_COLOR[g]) { blitUI(glyphImg(g, color), x, y); }

/** The dark net backdrop every minigame draws first: ink with a faint cyan grid, set pixel by pixel so the layout audit treats it as background. */
export function netBackdrop(t: number) {
  rect(0, 0, W, H, C.black);
  for (let y = 0; y < H; y += 10) for (let x = 0; x < W; x++) if (((x + Math.floor(t * 4)) & 3) === 0) upx(x, y, C.cyan0);
  for (let x = 0; x < W; x += 10) for (let y = 0; y < H; y++) if (((y + Math.floor(t * 4)) & 3) === 0) upx(x, y, C.cyan0);
}

/** A title strip across the top with the player's name on the right. */
export function titleBar(title: string, who: string) {
  box(2, 2, W - 4, 12, C.ink, C.cyan1);
  drawText(title, 6, 4, C.cyan4);
  const w = textWidth(who);
  drawText(who, W - 6 - w, 4, C.gray);
}

/** The hint strip at the bottom. */
export function hintBar(text: string) {
  box(2, H - 14, W - 4, 12, C.ink, C.slate);
  drawText(text, 6, H - 12, C.gray);
}

/** The closing box: a headline and lines, then Z to go on. */
export function resultBox(head: string, good: boolean, lines: { t: string; c: number }[]) {
  const h = 22 + lines.length * 9 + 10;
  const y = Math.round((H - h) / 2);
  box(24, y, W - 48, h, C.ink, good ? C.cyan3 : C.mag2);
  drawText(head, Math.round(W / 2 - textWidth(head) / 2), y + 4, good ? C.cyan4 : C.mag3);
  lines.forEach((l, i) => drawText(l.t, 30, y + 16 + i * 9, l.c, W - 60));
  drawText('Z: go on', Math.round(W / 2 - textWidth('Z: go on') / 2), y + h - 11, C.gray);
}
