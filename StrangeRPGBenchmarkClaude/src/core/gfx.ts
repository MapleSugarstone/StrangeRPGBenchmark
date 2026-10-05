import { COLORS, Col, greyHex } from './palette';
import { GLYPHS, textW } from './font';
import { genSprite, specKey, SpriteSpec, Pix } from './sprites';

export const SW = 160;
export const SH = 160;

const TEXT_CODES: Record<string, Col> = {
  r: 'r3', y: 'y2', o: 'o3', g: 'e3', c: 'c3', b: 'b3', m: 'm3', w: 'w', n: 'g2', k: 'k', d: 'g1',
};

export function hexOf(c: Col | string): string {
  return c[0] === '#' ? c : COLORS[c as Col];
}

type Canvas = HTMLCanvasElement;

function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export interface SpriteOpts {
  scale?: number;
  frame?: number;
  flip?: boolean;
  grey?: boolean;
  /** Draws the sprite as a solid silhouette of this color. */
  flash?: Col;
  /** 0..1 fraction of pixels removed, for dissolve effects. */
  dissolve?: number;
  seed?: number;
}

export class Gfx {
  ctx: CanvasRenderingContext2D;
  grey = false;
  private spriteCache = new Map<string, Canvas[]>();
  private glyphCache = new Map<string, Canvas>();
  ox = 0;
  oy = 0;

  constructor(public canvas: Canvas) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  col(c: Col | string, grey = this.grey): string {
    const h = hexOf(c);
    return grey ? greyHex(h) : h;
  }

  clear(c: Col | string = 'k') {
    this.ctx.fillStyle = hexOf(c);
    this.ctx.fillRect(0, 0, SW, SH);
  }

  rect(x: number, y: number, w: number, h: number, c: Col | string, grey = false) {
    this.ctx.fillStyle = this.col(c, grey);
    this.ctx.fillRect(Math.round(x + this.ox), Math.round(y + this.oy), Math.round(w), Math.round(h));
  }

  rectO(x: number, y: number, w: number, h: number, c: Col | string) {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  box(x: number, y: number, w: number, h: number, border: Col = 'g3', fill: Col = 'k') {
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
    this.rect(x + 1, y, w - 2, 1, border);
    this.rect(x + 1, y + h - 1, w - 2, 1, border);
    this.rect(x, y + 1, 1, h - 2, border);
    this.rect(x + w - 1, y + 1, 1, h - 2, border);
  }

  bar(x: number, y: number, w: number, h: number, frac: number, c: Col, bg: Col = 'ink') {
    this.rect(x, y, w, h, bg);
    const fw = Math.max(0, Math.min(w, Math.round(w * frac)));
    if (fw > 0) this.rect(x, y, fw, h, c);
  }

  alpha(a: number, fn: () => void) {
    const prev = this.ctx.globalAlpha;
    this.ctx.globalAlpha = a;
    fn();
    this.ctx.globalAlpha = prev;
  }

  overlay(c: Col | string, a: number) {
    if (a <= 0) return;
    this.alpha(Math.min(1, a), () => {
      this.ctx.fillStyle = hexOf(c);
      this.ctx.fillRect(0, 0, SW, SH);
    });
  }

  private renderPix(p: Pix, pal: string[]): Canvas {
    const c = makeCanvas(8, 8);
    const x = c.getContext('2d')!;
    const img = x.createImageData(8, 8);
    for (let i = 0; i < 64; i++) {
      const v = p[i];
      if (!v) continue;
      const n = parseInt(pal[v - 1].slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255;
      img.data[i * 4 + 1] = (n >> 8) & 255;
      img.data[i * 4 + 2] = n & 255;
      img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  tiles(spec: SpriteSpec, frame = 0, grey = false, flash?: Col): Canvas[] {
    const key = specKey(spec) + '#' + frame + (grey ? 'g' : '') + (flash ?? '');
    let t = this.spriteCache.get(key);
    if (!t) {
      const pal = spec.pal.map(c => {
        const h = hexOf(flash ?? c);
        return grey ? greyHex(h) : h;
      });
      t = genSprite(spec, frame).map(p => this.renderPix(p, pal));
      this.spriteCache.set(key, t);
    }
    return t;
  }

  sprite(spec: SpriteSpec, x: number, y: number, o: SpriteOpts = {}) {
    const n = spec.n ?? 1;
    const s = o.scale ?? 1;
    const grey = o.grey ?? this.grey;
    if (o.dissolve && o.dissolve > 0) {
      this.dissolveSprite(spec, x, y, s, o.dissolve, grey, o.seed ?? 1);
      return;
    }
    const t = this.tiles(spec, o.frame ?? 0, grey, o.flash);
    const ctx = this.ctx;
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const c = t[ty * n + tx];
      const dx = Math.round(x + this.ox + tx * 8 * s);
      const dy = Math.round(y + this.oy + ty * 8 * s);
      if (o.flip) {
        ctx.save();
        ctx.translate(dx + 8 * s, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(c, 0, 0, 8 * s, 8 * s);
        ctx.restore();
      } else ctx.drawImage(c, dx, dy, 8 * s, 8 * s);
    }
  }

  private dissolveSprite(spec: SpriteSpec, x: number, y: number, s: number, amount: number, grey: boolean, seed: number) {
    const n = spec.n ?? 1;
    const grids = genSprite(spec, 0);
    const pal = spec.pal.map(c => (grey ? greyHex(hexOf(c)) : hexOf(c)));
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const p = grids[ty * n + tx];
      for (let i = 0; i < 64; i++) {
        if (!p[i]) continue;
        const h = ((i * 2654435761 + seed * 97 + tx * 13 + ty * 7) >>> 0) % 1000 / 1000;
        if (h < amount) continue;
        const px = x + (tx * 8 + (i % 8)) * s;
        const py = y + (ty * 8 + Math.floor(i / 8)) * s - (h < amount + 0.2 ? amount * 6 : 0);
        this.ctx.fillStyle = pal[p[i] - 1];
        this.ctx.fillRect(Math.round(px + this.ox), Math.round(py + this.oy), s, s);
      }
    }
  }

  private glyph(ch: string, color: string): Canvas | null {
    const key = ch + color;
    let c = this.glyphCache.get(key);
    if (c) return c;
    const g = GLYPHS.get(ch) ?? GLYPHS.get('?');
    if (!g) return null;
    c = makeCanvas(Math.max(1, g.w), 6);
    const x = c.getContext('2d')!;
    x.fillStyle = color;
    g.rows.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') x.fillRect(i, y, 1, 1);
    });
    this.glyphCache.set(key, c);
    return c;
  }

  /** Draws text. '^' plus a code letter switches color. Returns the end x. */
  text(s: string, x: number, y: number, color: Col | string = 'w', maxChars = Infinity): number {
    let cx = x;
    let col = hexOf(color);
    const base = col;
    let drawn = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '^') {
        const code = s[i + 1];
        col = code === '0' ? base : hexOf(TEXT_CODES[code] ?? 'w');
        i++;
        continue;
      }
      if (drawn >= maxChars) break;
      drawn++;
      if (ch === ' ') { cx += 3; continue; }
      const g = this.glyph(ch, col);
      if (g) this.ctx.drawImage(g, Math.round(cx + this.ox), Math.round(y + this.oy));
      cx += (GLYPHS.get(ch)?.w ?? 3) + 1;
    }
    return cx;
  }

  textC(s: string, cx: number, y: number, color: Col | string = 'w') {
    this.text(s, Math.round(cx - textW(s) / 2), y, color);
  }

  textR(s: string, rx: number, y: number, color: Col | string = 'w') {
    this.text(s, rx - textW(s), y, color);
  }

  /** Draws the right-pointing menu cursor. */
  cursor(x: number, y: number, t = 0) {
    const bob = Math.floor(t / 12) % 2;
    this.text('`', x - bob, y, 'w');
  }
}
