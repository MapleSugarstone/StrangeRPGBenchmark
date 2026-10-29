// Emote bubbles over people's heads.
import { box, rect, blitUI } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { C } from '../engine/palette';
import { F, TILE } from './field';
import { icon } from './art';
import { ICONS } from '../content/art/icons';

const TEXT: Record<string, string> = { '!': '!', '?': '?', '...': '...', angry: '#', sweat: ';', note: '~' };

export function renderEmotes() {
  const all = [F.player, ...F.actors];
  for (const a of all) {
    if (!a || !a.emote || !a.visible) continue;
    const x = Math.round(a.px) - F.camX + 4, y = Math.round(a.py) - F.camY - 12;
    const k = a.emote.kind;
    if (ICONS['emote_' + k]) { blitUI(icon('emote_' + k), x - 4, y - 2); continue; }
    if (k === 'heart') {
      box(x - 5, y - 3, 10, 9, C.white, C.white);
      const h = ['.11.11.', '1111111', '.11111.', '..111..', '...1...'];
      h.forEach((r, yy) => { for (let xx = 0; xx < r.length; xx++) if (r[xx] === '1') rect(x - 3 + xx, y - 1 + yy, 1, 1, C.rust2); });
      continue;
    }
    const t = TEXT[k] ?? k;
    const w = textWidth(t) + 5;
    box(x - Math.ceil(w / 2), y - 3, w, 11, C.white, C.white);
    drawText(t, x - Math.ceil(w / 2) + 3, y - 1, C.ink);
  }
  void TILE;
}
