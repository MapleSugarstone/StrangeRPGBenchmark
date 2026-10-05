import { FONT_H, FONT_W, GLYPHS } from "./fontdata";
import { type ColorName, colorInt, PALETTE_INT, mixInt } from "./palette";

export const W = 224;
export const H = 224;
export const TILE = 8;
export const COLS = W / TILE;
export const ROWS = H / TILE;

export type Cells = Uint8Array; // 64 cells, values 0..3

/**
 * A software framebuffer. Everything draws into a Uint32 buffer and the
 * buffer is blitted to the visible canvas once per frame at an integer scale.
 */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly back: HTMLCanvasElement;
  private readonly bctx: CanvasRenderingContext2D;
  private readonly img: ImageData;
  readonly buf: Uint32Array;
  /** Page pixels per game pixel, used by pointer math and the page lines. */
  scale = 1;
  /** Screen pixels per game pixel: always a whole number, so no game pixel straddles two screen pixels. */
  deviceScale = 1;
  /** Clip rectangle in pixels, inclusive-exclusive. */
  private clip = { x0: 0, y0: 0, x1: W, y1: H };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.back = document.createElement("canvas");
    this.back.width = W;
    this.back.height = H;
    this.bctx = this.back.getContext("2d")!;
    this.img = this.bctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.fit();
    window.addEventListener("resize", () => this.fit());
  }

  fit(): void {
    // Size in screen pixels, not page pixels: on a display scaled 125 or 150 percent a page pixel is a fraction of a screen pixel
    const dpr = window.devicePixelRatio || 1;
    const avail = Math.min(window.innerWidth - 16, window.innerHeight - 24) * dpr;
    const s = Math.max(1, Math.min(Math.round(4 * dpr), Math.floor(avail / W)));
    this.deviceScale = s;
    this.scale = s / dpr;
    this.canvas.width = W * s;
    this.canvas.height = H * s;
    this.canvas.style.width = `${(W * s) / dpr}px`;
    this.canvas.style.height = `${(H * s) / dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  present(): void {
    this.bctx.putImageData(this.img, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.back, 0, 0, W, H, 0, 0, W * this.deviceScale, H * this.deviceScale);
  }

  /** Pixel data of the back buffer as a data URL, for favicons and screenshots. */
  snapshot(): HTMLCanvasElement {
    this.bctx.putImageData(this.img, 0, 0);
    return this.back;
  }

  setClip(x: number, y: number, w: number, h: number): void {
    this.clip = { x0: Math.max(0, x), y0: Math.max(0, y), x1: Math.min(W, x + w), y1: Math.min(H, y + h) };
  }
  resetClip(): void {
    this.clip = { x0: 0, y0: 0, x1: W, y1: H };
  }

  clear(c: ColorName | number = "black"): void {
    this.buf.fill(typeof c === "number" ? c : colorInt(c));
  }

  px(x: number, y: number, c: number): void {
    if (x < this.clip.x0 || y < this.clip.y0 || x >= this.clip.x1 || y >= this.clip.y1) return;
    this.buf[y * W + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: ColorName | number): void {
    const ci = typeof c === "number" ? c : colorInt(c);
    const x0 = Math.max(this.clip.x0, x), y0 = Math.max(this.clip.y0, y);
    const x1 = Math.min(this.clip.x1, x + w), y1 = Math.min(this.clip.y1, y + h);
    for (let yy = y0; yy < y1; yy++) {
      this.buf.fill(ci, yy * W + x0, yy * W + x1);
    }
  }

  frame(x: number, y: number, w: number, h: number, c: ColorName | number): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** A box with a one pixel border and rounded corners, the dialogue style. */
  box(x: number, y: number, w: number, h: number, fill: ColorName | number, border: ColorName | number): void {
    this.rect(x + 1, y, w - 2, h, fill);
    this.rect(x, y + 1, 1, h - 2, fill);
    this.rect(x + w - 1, y + 1, 1, h - 2, fill);
    const b = typeof border === "number" ? border : colorInt(border);
    this.rect(x + 1, y, w - 2, 1, b);
    this.rect(x + 1, y + h - 1, w - 2, 1, b);
    this.rect(x, y + 1, 1, h - 2, b);
    this.rect(x + w - 1, y + 1, 1, h - 2, b);
  }

  vline(x: number, y0: number, y1: number, c: number): void {
    if (x < this.clip.x0 || x >= this.clip.x1) return;
    const a = Math.max(this.clip.y0, Math.min(y0, y1));
    const b = Math.min(this.clip.y1 - 1, Math.max(y0, y1));
    for (let y = a; y <= b; y++) this.buf[y * W + x] = c;
  }

  hline(y: number, x0: number, x1: number, c: number): void {
    if (y < this.clip.y0 || y >= this.clip.y1) return;
    const a = Math.max(this.clip.x0, Math.min(x0, x1));
    const b = Math.min(this.clip.x1 - 1, Math.max(x0, x1));
    this.buf.fill(c, y * W + a, y * W + b + 1);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Blit an 8x8 cell sprite with the given palette for cells 2 and 3. Cell 1 is black. */
  sprite(cells: Cells, x: number, y: number, a: ColorName | number, b: ColorName | number, opts?: { flip?: boolean; scale?: number; tint?: number; alpha?: number }): void {
    const ca = typeof a === "number" ? a : colorInt(a);
    const cb = typeof b === "number" ? b : colorInt(b);
    const black = PALETTE_INT.black;
    const flip = opts?.flip ?? false;
    const s = opts?.scale ?? 1;
    const tint = opts?.tint;
    for (let yy = 0; yy < 8; yy++) {
      for (let xx = 0; xx < 8; xx++) {
        const v = cells[yy * 8 + (flip ? 7 - xx : xx)];
        if (v === 0) continue;
        let c = v === 1 ? black : v === 2 ? ca : cb;
        if (tint !== undefined) c = tint;
        if (s === 1) this.px(x + xx, y + yy, c);
        else this.rect(x + xx * s, y + yy * s, s, s, c);
      }
    }
  }

  /** Blit a square sprite of any size (cells is size*size). */
  spriteN(cells: Cells, size: number, x: number, y: number, a: ColorName | number, b: ColorName | number, opts?: { flip?: boolean; tint?: number }): void {
    const ca = typeof a === "number" ? a : colorInt(a);
    const cb = typeof b === "number" ? b : colorInt(b);
    const black = PALETTE_INT.black;
    const flip = opts?.flip ?? false;
    for (let yy = 0; yy < size; yy++) {
      for (let xx = 0; xx < size; xx++) {
        const v = cells[yy * size + (flip ? size - 1 - xx : xx)];
        if (v === 0) continue;
        const c = opts?.tint !== undefined ? opts.tint : v === 1 ? black : v === 2 ? ca : cb;
        this.px(x + xx, y + yy, c);
      }
    }
  }

  /** Fill a rectangle with a checker dither of two colors. Phase shifts the pattern. */
  dither(x: number, y: number, w: number, h: number, a: ColorName | number, b: ColorName | number, phase = 0): void {
    const ca = typeof a === "number" ? a : colorInt(a);
    const cb = typeof b === "number" ? b : colorInt(b);
    const x0 = Math.max(this.clip.x0, x), y0 = Math.max(this.clip.y0, y);
    const x1 = Math.min(this.clip.x1, x + w), y1 = Math.min(this.clip.y1, y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.buf[yy * W + xx] = ((xx + yy + phase) & 1) === 0 ? ca : cb;
  }

  /** A vertical gradient from color a at the top to b at the bottom using ordered dither in bands. */
  gradient(x: number, y: number, w: number, h: number, a: ColorName | number, b: ColorName | number): void {
    const ca = typeof a === "number" ? a : colorInt(a);
    const cb = typeof b === "number" ? b : colorInt(b);
    const x0 = Math.max(this.clip.x0, x), y0 = Math.max(this.clip.y0, y);
    const x1 = Math.min(this.clip.x1, x + w), y1 = Math.min(this.clip.y1, y + h);
    for (let yy = y0; yy < y1; yy++) {
      const t = (yy - y) / Math.max(1, h - 1);
      // Four band thresholds give a 2x2 ordered dither
      for (let xx = x0; xx < x1; xx++) {
        const m = [[0, 2], [3, 1]][yy & 1][xx & 1] / 4;
        this.buf[yy * W + xx] = t > m ? cb : ca;
      }
    }
  }

  /** Tint a rectangle toward a color by t, for lighting. */
  tint(x: number, y: number, w: number, h: number, c: ColorName | number, t: number): void {
    const ci = typeof c === "number" ? c : colorInt(c);
    const x0 = Math.max(this.clip.x0, x), y0 = Math.max(this.clip.y0, y);
    const x1 = Math.min(this.clip.x1, x + w), y1 = Math.min(this.clip.y1, y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = yy * W + xx;
      this.buf[i] = mixInt(this.buf[i], ci, t);
    }
  }

  /** Draw a sprite dimmed toward black, for things behind a dialogue box. */
  spriteDim(cells: Cells, x: number, y: number, a: ColorName | number, b: ColorName | number, t: number): void {
    const ca = mixInt(typeof a === "number" ? a : colorInt(a), PALETTE_INT.black, t);
    const cb = mixInt(typeof b === "number" ? b : colorInt(b), PALETTE_INT.black, t);
    this.sprite(cells, x, y, ca, cb);
  }

  dimRect(x: number, y: number, w: number, h: number, t: number): void {
    const black = PALETTE_INT.black;
    const x0 = Math.max(this.clip.x0, x), y0 = Math.max(this.clip.y0, y);
    const x1 = Math.min(this.clip.x1, x + w), y1 = Math.min(this.clip.y1, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = yy * W + xx;
        this.buf[i] = mixInt(this.buf[i], black, t);
      }
    }
  }

  /** Measure text width in pixels. */
  textWidth(s: string): number {
    return s.length * FONT_W - 1;
  }

  text(s: string, x: number, y: number, c: ColorName | number = "white", shadow?: ColorName | number): number {
    const ci = typeof c === "number" ? c : colorInt(c);
    const sh = shadow === undefined ? undefined : typeof shadow === "number" ? shadow : colorInt(shadow);
    let cx = x;
    for (const ch of s) {
      const g = GLYPHS[ch] ?? GLYPHS["?"];
      for (let r = 0; r < FONT_H; r++) {
        const row = g[r];
        for (let k = 0; k < 3; k++) {
          if (row[k] === "#") {
            if (sh !== undefined) this.px(cx + k + 1, y + r + 1, sh);
            this.px(cx + k, y + r, ci);
          }
        }
      }
      cx += FONT_W;
    }
    return cx;
  }

  textCenter(s: string, cx: number, y: number, c: ColorName | number = "white", shadow?: ColorName | number): void {
    this.text(s, Math.floor(cx - this.textWidth(s) / 2), y, c, shadow);
  }

  textRight(s: string, rx: number, y: number, c: ColorName | number = "white", shadow?: ColorName | number): void {
    this.text(s, rx - this.textWidth(s), y, c, shadow);
  }
}

/** Word wrap text to a pixel width, honoring explicit newlines. */
export function wrap(s: string, maxPx: number): string[] {
  const maxChars = Math.floor((maxPx + 1) / FONT_W);
  const out: string[] = [];
  for (const para of s.split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      if (line.length === 0) line = w;
      else if (line.length + 1 + w.length <= maxChars) line += " " + w;
      else {
        out.push(line);
        line = w;
      }
      while (line.length > maxChars) {
        out.push(line.slice(0, maxChars));
        line = line.slice(maxChars);
      }
    }
    out.push(line);
  }
  return out;
}
