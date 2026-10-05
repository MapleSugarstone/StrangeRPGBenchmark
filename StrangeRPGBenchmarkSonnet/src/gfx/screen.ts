import { ADV, glyph } from './font';

export const W = 128;
export const H = 128;

export function rgb(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

export interface Sprite {
  d: Uint8Array;
  pal: [number, number, number];
}

export interface BlitOpts {
  flipX?: boolean;
  flash?: number;
  dim?: boolean;
  only?: number;
}

export const C = {
  black: rgb('#000000'), white: rgb('#ffffff'), gray: rgb('#8a8a9a'), dark: rgb('#2a2a3a'), mid: rgb('#50506a'),
  red: rgb('#ff5a5a'), green: rgb('#6fdc5a'), blue: rgb('#58a8ff'), yellow: rgb('#ffe34a'), gold: rgb('#ffc83a'),
  purple: rgb('#b070ff'), cyan: rgb('#6fe0ff'), orange: rgb('#ff9a3a'),
};

export class Screen {
  buf = new Uint32Array(W * H);
  clear(c = C.black) { this.buf.fill(c); }
  px(x: number, y: number, c: number) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < W && y < H) this.buf[y * W + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  frame(x: number, y: number, w: number, h: number, c: number) {
    for (let i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); }
  }
  box(x: number, y: number, w: number, h: number, border = C.white, bg = C.black) {
    this.rect(x, y, w, h, bg);
    this.frame(x, y, w, h, border);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  text(x: number, y: number, s: string, c = C.white) {
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i]);
      for (let k = 0; k < 15; k++) if (g[k] === '1') this.px(x + i * ADV + (k % 3), y + ((k / 3) | 0), c);
    }
  }
  textC(cx: number, y: number, s: string, c = C.white) { this.text(cx - Math.floor((s.length * ADV - 1) / 2), y, s, c); }
  textR(rx: number, y: number, s: string, c = C.white) { this.text(rx - (s.length * ADV - 1), y, s, c); }
  sprite(s: Sprite, x: number, y: number, o: BlitOpts = {}) {
    x |= 0; y |= 0;
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        const v = s.d[j * 8 + (o.flipX ? 7 - i : i)];
        if (!v) continue;
        if (o.only !== undefined && v !== o.only) continue;
        let c = s.pal[v - 1];
        if (o.flash) c = C.white;
        else if (o.dim) c = dimColor(c);
        this.px(x + i, y + j, c);
      }
    }
  }
  bar(x: number, y: number, w: number, frac: number, fg: number, bg = C.dark) {
    this.rect(x, y, w, 2, bg);
    this.rect(x, y, Math.max(0, Math.round(w * Math.min(1, Math.max(0, frac)))), 2, fg);
  }
  present(ctx: CanvasRenderingContext2D, img: ImageData) {
    new Uint32Array(img.data.buffer).set(this.buf);
    ctx.putImageData(img, 0, 0);
  }
}

export function dimColor(c: number): number {
  const r = (c & 255) >> 1, g = ((c >> 8) & 255) >> 1, b = ((c >> 16) & 255) >> 1;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
