import { PALETTE_RGB, type ColorName, type Rgb } from "./palette";
import type { Cells } from "./sprites";
import { glyph, FONT_W, FONT_H } from "./font";

export const W = 192;
export const H = 192;
export const TILE = 8;

export interface SpriteDrawOpts {
  flipX?: boolean;
  scale?: number;
  /** Replaces every non transparent cell with one color (hit flashes, silhouettes). */
  tint?: ColorName;
  /** Overrides the black cells (used for ghosts and outlines). */
  black?: ColorName;
}

/** Software framebuffer. All drawing writes RGBA bytes, then present() scales to the canvas. */
export class Screen {
  readonly buf = new Uint8ClampedArray(W * H * 4);
  private img: ImageData;
  private off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private ctx: CanvasRenderingContext2D;
  shakeX = 0;
  shakeY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.off = document.createElement("canvas");
    this.off.width = W;
    this.off.height = H;
    this.offCtx = this.off.getContext("2d")!;
    this.img = this.offCtx.createImageData(W, H);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color: ColorName = "black"): void {
    const c = PALETTE_RGB[color];
    for (let i = 0; i < this.buf.length; i += 4) {
      this.buf[i] = c.r; this.buf[i + 1] = c.g; this.buf[i + 2] = c.b; this.buf[i + 3] = 255;
    }
  }

  px(x: number, y: number, c: Rgb): void {
    x += this.shakeX; y += this.shakeY;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    this.buf[i] = c.r; this.buf[i + 1] = c.g; this.buf[i + 2] = c.b; this.buf[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, color: ColorName): void {
    const c = PALETTE_RGB[color];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx | 0, yy | 0, c);
  }

  frame(x: number, y: number, w: number, h: number, color: ColorName): void {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  /** Window: filled box with a one pixel border and a one pixel inner gap. */
  panel(x: number, y: number, w: number, h: number, fill: ColorName = "dark", border: ColorName = "white"): void {
    this.rect(x, y, w, h, fill);
    this.frame(x, y, w, h, border);
  }

  sprite(cells: Cells, x: number, y: number, a: ColorName, b: ColorName, o: SpriteDrawOpts = {}): void {
    const s = o.scale ?? 1;
    const ca = PALETTE_RGB[a], cb = PALETTE_RGB[b];
    const black = PALETTE_RGB[o.black ?? "black"];
    const tint = o.tint ? PALETTE_RGB[o.tint] : null;
    for (let yy = 0; yy < 8; yy++) {
      for (let xx = 0; xx < 8; xx++) {
        const v = cells[yy * 8 + xx];
        if (v === 0) continue;
        const c = tint ?? (v === 1 ? black : v === 2 ? ca : cb);
        const dx = o.flipX ? 7 - xx : xx;
        if (s === 1) this.px(x + dx, y + yy, c);
        else for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) this.px(x + dx * s + sx, y + yy * s + sy, c);
      }
    }
  }

  text(str: string, x: number, y: number, color: ColorName = "white", shadow?: ColorName): number {
    const c = PALETTE_RGB[color];
    const sh = shadow ? PALETTE_RGB[shadow] : null;
    let cx = x;
    for (const ch of str) {
      if (ch === "\n") { cx = x; y += FONT_H + 1; continue; }
      const g = glyph(ch);
      for (let yy = 0; yy < FONT_H; yy++) {
        const row = g[yy];
        if (!row) continue;
        for (let xx = 0; xx < FONT_W; xx++) {
          if (row & (1 << (FONT_W - 1 - xx))) {
            if (sh) this.px(cx + xx + 1, y + yy + 1, sh);
            this.px(cx + xx, y + yy, c);
          }
        }
      }
      cx += FONT_W;
    }
    return cx;
  }

  textCenter(str: string, cx: number, y: number, color: ColorName = "white", shadow?: ColorName): void {
    this.text(str, Math.floor(cx - (str.length * FONT_W) / 2), y, color, shadow);
  }

  textRight(str: string, rx: number, y: number, color: ColorName = "white"): void {
    this.text(str, rx - str.length * FONT_W, y, color);
  }

  /** Horizontal gauge with a border. */
  bar(x: number, y: number, w: number, h: number, frac: number, fill: ColorName, back: ColorName = "dark"): void {
    this.rect(x, y, w, h, back);
    const f = Math.max(0, Math.min(1, frac));
    const fw = Math.round((w - 2) * f);
    if (fw > 0) this.rect(x + 1, y + 1, fw, h - 2, fill);
    this.frame(x, y, w, h, "white");
  }

  /** Darkens everything already drawn. */
  dim(amount = 0.5): void {
    const k = 1 - amount;
    for (let i = 0; i < this.buf.length; i += 4) {
      this.buf[i] *= k; this.buf[i + 1] *= k; this.buf[i + 2] *= k;
    }
  }

  present(): void {
    this.img.data.set(this.buf);
    this.offCtx.putImageData(this.img, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.off, 0, 0, this.canvas.width, this.canvas.height);
  }
}
