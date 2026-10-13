import { ctx } from './screen';

/**
 * A sprite is rows of characters: '.' is clear, '0' is ink, '1' and '2' are the two colors given at draw time.
 * Rows may be any width, so large figures share the 8x8 pixel grid.
 */
export type Art = readonly string[];

const cache = new WeakMap<Art, Map<string, HTMLCanvasElement>>();
let ink = '#07060b';
export function setInk(c: string): void { ink = c; }

function render(art: Art, c1: string, c2: string, flip: boolean, inkColor: string): HTMLCanvasElement {
  let byKey = cache.get(art);
  if (!byKey) { byKey = new Map(); cache.set(art, byKey); }
  const key = c1 + c2 + inkColor + (flip ? 'f' : '');
  let cv = byKey.get(key);
  if (cv) return cv;
  const h = art.length, w = art[0]?.length || 0;
  cv = document.createElement('canvas');
  cv.width = Math.max(1, w); cv.height = Math.max(1, h);
  const g = cv.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = art[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === undefined || ch === ' ') continue;
      g.fillStyle = ch === '0' ? inkColor : ch === '1' ? c1 : c2;
      g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
  byKey.set(key, cv);
  return cv;
}

export function artW(art: Art): number { return art[0]?.length || 0; }
export function artH(art: Art): number { return art.length; }

/** Draws a sprite with its top-left at x, y. */
export function spr(art: Art, x: number, y: number, c1: string, c2: string, flip = false, inkColor = ink): void {
  ctx.drawImage(render(art, c1, c2, flip, inkColor), Math.round(x), Math.round(y));
}

/** Draws a sprite scaled by an integer factor. */
export function sprScaled(art: Art, x: number, y: number, scale: number, c1: string, c2: string, flip = false, inkColor = ink): void {
  const cv = render(art, c1, c2, flip, inkColor);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x), Math.round(y), cv.width * scale, cv.height * scale);
}

/** Draws every filled pixel of a sprite in one color. */
export function sil(art: Art, x: number, y: number, color: string, flip = false): void {
  spr(art, x, y, color, color, flip, color);
}

const outlineCache = new WeakMap<Art, Map<string, HTMLCanvasElement>>();

/** Draws a one-pixel ring around the sprite's filled pixels, outside its edge. */
export function outline(art: Art, x: number, y: number, color: string, flip = false): void {
  let byKey = outlineCache.get(art);
  if (!byKey) { byKey = new Map(); outlineCache.set(art, byKey); }
  const key = color + (flip ? 'f' : '');
  let cv = byKey.get(key);
  if (!cv) {
    const h = art.length, w = art[0]?.length || 0;
    cv = document.createElement('canvas');
    cv.width = w + 2; cv.height = h + 2;
    const g = cv.getContext('2d')!;
    g.fillStyle = color;
    const filled = (xx: number, yy: number) => yy >= 0 && yy < h && xx >= 0 && xx < w && art[yy][xx] !== '.' && art[yy][xx] !== ' ';
    for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) {
      if (filled(xx, yy)) continue;
      if (filled(xx - 1, yy) || filled(xx + 1, yy) || filled(xx, yy - 1) || filled(xx, yy + 1)) g.fillRect((flip ? w - 1 - xx : xx) + 1, yy + 1, 1, 1);
    }
    byKey.set(key, cv);
  }
  ctx.drawImage(cv, Math.round(x) - 1, Math.round(y) - 1);
}
