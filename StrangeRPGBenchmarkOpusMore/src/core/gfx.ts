import { glyph, LINE_H, SPACE_W, textWidth } from './font';
import { INK, col } from './palette';
import { SpriteSpec, spriteCanvas, silhouette } from './sprites';

export const W = 192;
export const H = 192;

// 4x4 Bayer matrix. Every fade, shadow, and light falloff dithers through it, so nothing blends off the pixel grid.
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const glyphCache = new Map<string, HTMLCanvasElement>();

function glyphCanvas(ch: string, color: string): HTMLCanvasElement | null {
  const key = ch + '|' + color;
  let cv = glyphCache.get(key);
  if (cv) return cv;
  const g = glyph(ch);
  if (!g) return null;
  cv = document.createElement('canvas');
  cv.width = g.w; cv.height = g.rows.length;
  const c = cv.getContext('2d')!;
  c.fillStyle = color;
  g.rows.forEach((bits, y) => {
    for (let x = 0; x < g.w; x++) if (bits & (1 << x)) c.fillRect(x, y, 1, 1);
  });
  glyphCache.set(key, cv);
  return cv;
}

const patCache = new Map<string, CanvasPattern>();

export class Gfx {
  ctx: CanvasRenderingContext2D;
  t = 0;
  // Offset applied to dither patterns, so world dithers stay fixed to the world while the camera scrolls.
  anchorX = 0;
  anchorY = 0;
  private off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.off = document.createElement('canvas');
    this.off.width = W; this.off.height = H;
    this.offCtx = this.off.getContext('2d')!;
    this.offCtx.imageSmoothingEnabled = false;
  }

  clear(color = INK) {
    this.ctx.fillStyle = col(color);
    this.ctx.fillRect(0, 0, W, H);
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = col(color);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x: number, y: number, color: string) { this.rect(x, y, 1, 1, color); }

  // A 4x4 tile with `level` of its 16 pixels set, anchored to the screen so dithers line up across draws.
  pattern(color: string, level: number): CanvasPattern {
    const n = Math.max(0, Math.min(16, Math.round(level)));
    const c = col(color);
    const key = c + n;
    let p = patCache.get(key);
    if (!p) {
      const cv = document.createElement('canvas');
      cv.width = 4; cv.height = 4;
      const g = cv.getContext('2d')!;
      g.fillStyle = c;
      for (let i = 0; i < 16; i++) if (BAYER[i] < n) g.fillRect(i % 4, Math.floor(i / 4), 1, 1);
      p = this.ctx.createPattern(cv, 'repeat')!;
      patCache.set(key, p);
    }
    return p;
  }

  // Fills a rectangle with an ordered dither of `color`. Level runs 0 (nothing) to 1 (solid).
  dither(x: number, y: number, w: number, h: number, color: string, level: number) {
    if (level <= 0) return;
    if (level >= 1) { this.rect(x, y, w, h, color); return; }
    this.ctx.fillStyle = this.pattern(color, level * 16);
    if (this.anchorX || this.anchorY) {
      this.ctx.save();
      this.ctx.translate(this.anchorX, this.anchorY);
      this.ctx.fillRect(Math.round(x) - this.anchorX, Math.round(y) - this.anchorY, Math.round(w), Math.round(h));
      this.ctx.restore();
    } else this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  border(x: number, y: number, w: number, h: number, color: string) {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  // A window: ink fill, a light frame, and corner rivets.
  box(x: number, y: number, w: number, h: number, edge = 'paper', fillColor = 'ink') {
    this.rect(x, y, w, h, fillColor);
    this.border(x + 1, y + 1, w - 2, h - 2, edge);
    this.dither(x + 2, y + 2, w - 4, 1, edge, 0.25);
    this.rect(x + 2, y + 2, 1, 1, edge);
    this.rect(x + w - 3, y + 2, 1, 1, edge);
    this.rect(x + 2, y + h - 3, 1, 1, edge);
    this.rect(x + w - 3, y + h - 3, 1, 1, edge);
  }

  text(s: string, x: number, y: number, color = 'paper', shadow?: string): number {
    const c = col(color);
    let cx = Math.round(x);
    const yy = Math.round(y);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === ' ') { cx += SPACE_W + 1; continue; }
      if (shadow) {
        const sh = glyphCanvas(ch, col(shadow));
        if (sh) this.ctx.drawImage(sh, cx + 1, yy + 1);
      }
      const g = glyphCanvas(ch, c);
      if (g) { this.ctx.drawImage(g, cx, yy); cx += g.width + 1; } else cx += 4;
    }
    return cx;
  }

  // Large lettering built from beveled blocks, one block per font pixel, all on the 1x grid.
  textBig(s: string, cx: number, y: number, block: number, color = 'paper', shadow?: string, hi?: string) {
    const w = textWidth(s) * block;
    let x = Math.round(cx - w / 2);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === ' ') { x += (SPACE_W + 1) * block; continue; }
      const g = glyph(ch);
      if (!g) { x += 4 * block; continue; }
      const on = (rx: number, ry: number) => rx >= 0 && rx < g.w && ry >= 0 && ry < g.rows.length && !!(g.rows[ry] & (1 << rx));
      if (shadow) g.rows.forEach((bits, ry) => {
        for (let rx = 0; rx < g.w; rx++) if (bits & (1 << rx)) this.rect(x + rx * block + 1, y + ry * block + 1, block, block, shadow);
      });
      // Bevel only on the outer edges of each stroke, so letters read as solid shapes.
      g.rows.forEach((bits, ry) => {
        for (let rx = 0; rx < g.w; rx++) {
          if (!(bits & (1 << rx))) continue;
          const bx = x + rx * block, by = y + ry * block;
          this.rect(bx, by, block, block, color);
          if (block >= 3) {
            if (!on(rx, ry - 1)) this.rect(bx, by, block, 1, hi ?? 'white');
            if (!on(rx - 1, ry)) this.rect(bx, by + (on(rx, ry - 1) ? 0 : 1), 1, block - (on(rx, ry - 1) ? 0 : 1), hi ?? 'white');
            if (!on(rx + 1, ry)) this.rect(bx + block - 1, by + 1, 1, block - 1, shadow ?? 'ink');
            if (!on(rx, ry + 1)) this.rect(bx + 1, by + block - 1, block - 1, 1, shadow ?? 'ink');
          }
        }
      });
      x += (g.w + 1) * block;
    }
  }

  textC(s: string, cx: number, y: number, color = 'paper', shadow?: string) {
    this.text(s, Math.round(cx - textWidth(s) / 2), y, color, shadow);
  }

  textR(s: string, rx: number, y: number, color = 'paper', shadow?: string) {
    this.text(s, rx - textWidth(s), y, color, shadow);
  }

  // Draws a sprite at its native size: 8 for field sprites, 16 to 48 for metasprites.
  sprite(spec: SpriteSpec, x: number, y: number, size = 8, frame = 0, flip = false) {
    const cv = spriteCanvas(spec, frame, flip, size);
    this.ctx.drawImage(cv, Math.round(x), Math.round(y));
  }

  silhouette(spec: SpriteSpec, x: number, y: number, size: number, color: string, flip = false) {
    this.ctx.drawImage(silhouette(spec, size, color, flip), Math.round(x), Math.round(y));
  }

  image(cv: CanvasImageSource, x: number, y: number) {
    this.ctx.drawImage(cv, Math.round(x), Math.round(y));
  }

  bar(x: number, y: number, w: number, h: number, frac: number, color: string, back = 'slate') {
    this.rect(x, y, w, h, back);
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) this.rect(x, y, Math.max(1, Math.round(w * f)), h, color);
  }

  cursor(x: number, y: number, color = 'gold') {
    const bob = Math.floor(this.t / 15) % 2;
    this.text('\u0004', x + bob, y, color);
  }

  // Midpoint circle outline.
  circle(cx: number, cy: number, r: number, color: string) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (r <= 0) { this.px(cx, cy, color); return; }
    let x = r, y = 0, err = 1 - r;
    this.ctx.fillStyle = col(color);
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) this.ctx.fillRect(cx + a, cy + b, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }

  // A dithered ellipse shadow under a figure.
  shadow(cx: number, y: number, w: number, level = 0.5) {
    const hw = Math.floor(w / 2);
    this.dither(cx - hw + 1, y, w - 2, 1, 'ink', level);
    this.dither(cx - hw, y + 1, w, 1, 'ink', level);
    this.dither(cx - hw + 1, y + 2, w - 2, 1, 'ink', level * 0.6);
  }

  // Screen fade by ordered dither, so the fade itself is pixel art.
  fade(level: number, color = INK) {
    if (level <= 0) return;
    this.dither(0, 0, W, H, color, Math.min(1, level));
  }

  // Draws `fn` only where `mask` has opaque pixels.
  masked(mask: CanvasImageSource, fn: () => void) {
    if (!this.maskCv) {
      this.maskCv = document.createElement('canvas');
      this.maskCv.width = W; this.maskCv.height = H;
    }
    const mc = this.maskCv.getContext('2d')!;
    mc.imageSmoothingEnabled = false;
    const main = this.ctx;
    mc.globalCompositeOperation = 'source-over';
    mc.clearRect(0, 0, W, H);
    this.ctx = mc;
    try { fn(); } finally { this.ctx = main; }
    mc.globalCompositeOperation = 'destination-in';
    mc.drawImage(mask, 0, 0);
    mc.globalCompositeOperation = 'source-over';
    main.drawImage(this.maskCv, 0, 0);
  }
  private maskCv: HTMLCanvasElement | null = null;

  // Draws `fn` at partial strength by dithering it in, instead of alpha blending.
  alpha(a: number, fn: () => void) {
    if (a >= 1) { fn(); return; }
    if (a <= 0) return;
    const main = this.ctx;
    this.offCtx.globalCompositeOperation = 'source-over';
    this.offCtx.clearRect(0, 0, W, H);
    this.ctx = this.offCtx;
    try { fn(); } finally { this.ctx = main; }
    this.offCtx.globalCompositeOperation = 'destination-in';
    this.offCtx.fillStyle = this.pattern('ink', a * 16);
    this.offCtx.fillRect(0, 0, W, H);
    this.offCtx.globalCompositeOperation = 'source-over';
    main.drawImage(this.off, 0, 0);
  }
}

export { LINE_H };
