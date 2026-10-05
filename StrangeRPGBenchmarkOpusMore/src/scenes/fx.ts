// World effects drawn over the field: dithered lighting and weather particles.
import { BAYER, Gfx, W, H } from '../core/gfx';
import { col } from '../core/palette';

export interface Light { x: number; y: number; r: number; }

const CELL = 2;
const GW = W / CELL, GH = H / CELL;

// Darkness by ordered dither. Each 2x2 cell gets a brightness from the ambient level and nearby lights,
// quantized to eighths, and each pixel compares it against the Bayer threshold.
export class LightLayer {
  private cv = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private buf: Uint32Array;
  private bright = new Float32Array(GW * GH);
  constructor() {
    this.cv.width = W; this.cv.height = H;
    this.ctx = this.cv.getContext('2d')!;
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  // A canvas that is opaque where the lights reach, for drawing lit pools in another palette.
  mask(lights: Light[]): HTMLCanvasElement {
    this.fill(0, lights);
    const b = this.bright, buf = this.buf;
    for (let py = 0; py < H; py++) {
      const row = (py / CELL) | 0;
      for (let px = 0; px < W; px++) {
        const v = Math.round(b[row * GW + ((px / CELL) | 0)] * 8) / 8;
        buf[py * W + px] = v > (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16 ? 0xff000000 : 0;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    return this.cv;
  }

  draw(g: Gfx, ambient: number, lights: Light[], color = 'ink') {
    if (ambient >= 1) return;
    this.fill(ambient, lights);
    const b = this.bright;
    const hex = col(color);
    const n = parseInt(hex.slice(1), 16);
    const ink = (0xff << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255);
    const buf = this.buf;
    for (let py = 0; py < H; py++) {
      const row = (py / CELL) | 0;
      for (let px = 0; px < W; px++) {
        const dark = 1 - Math.round(b[row * GW + ((px / CELL) | 0)] * 8) / 8;
        const th = (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16;
        buf[py * W + px] = dark > th ? ink : 0;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    g.ctx.drawImage(this.cv, 0, 0);
  }

  private fill(ambient: number, lights: Light[]) {
    const b = this.bright;
    b.fill(ambient);
    for (const l of lights) {
      if (l.r <= 0) continue;
      const cx = l.x / CELL, cy = l.y / CELL, rr = l.r / CELL;
      const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(GW - 1, Math.ceil(cx + rr));
      const y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(GH - 1, Math.ceil(cy + rr));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rr;
        if (d >= 1) continue;
        const v = (1 - d) * (1 - d) * 1.6;
        b[y * GW + x] = Math.min(1, b[y * GW + x] + v);
      }
    }
  }
}

export type WeatherKind = 'slips' | 'dust' | 'pages' | 'sparks' | 'confetti' | 'glints' | 'letters' | 'wind' | 'rising' | 'foam' | 'drips' | 'ash' | 'motes' | 'static';

interface P { x: number; y: number; vx: number; vy: number; life: number; c: string; w: number; h: number; ph: number; }

interface Spec { n: number; colors: string[]; vx: [number, number]; vy: [number, number]; w: number; h: number; sway: number; life: number; flicker?: boolean; }

const SPECS: Record<WeatherKind, Spec> = {
  slips: { n: 40, colors: ['plea', 'paper', 'bone'], vx: [-0.08, 0.08], vy: [0.18, 0.35], w: 2, h: 1, sway: 0.25, life: 900 },
  dust: { n: 22, colors: ['siltdk', 'tan'], vx: [-0.04, 0.04], vy: [-0.03, 0.05], w: 1, h: 1, sway: 0.1, life: 500 },
  pages: { n: 10, colors: ['cream', 'lilac'], vx: [-0.15, 0.15], vy: [0.2, 0.35], w: 2, h: 2, sway: 0.4, life: 700 },
  sparks: { n: 16, colors: ['gold', 'cream', 'sky'], vx: [-0.5, 0.5], vy: [0.4, 1.2], w: 1, h: 1, sway: 0, life: 50, flicker: true },
  confetti: { n: 30, colors: ['pink', 'sky', 'gold', 'mint', 'lilac'], vx: [-0.2, 0.2], vy: [0.25, 0.5], w: 1, h: 2, sway: 0.5, life: 600 },
  glints: { n: 18, colors: ['cream', 'gold', 'white'], vx: [0, 0], vy: [-0.05, 0], w: 1, h: 1, sway: 0, life: 40, flicker: true },
  letters: { n: 14, colors: ['paper', 'bone', 'rose'], vx: [-0.12, 0.05], vy: [0.06, 0.16], w: 2, h: 1, sway: 0.3, life: 1200 },
  wind: { n: 24, colors: ['white', 'ice'], vx: [1.6, 2.6], vy: [-0.1, 0.1], w: 4, h: 1, sway: 0, life: 120 },
  rising: { n: 34, colors: ['plea', 'paper', 'ghost'], vx: [-0.1, 0.1], vy: [-0.45, -0.2], w: 2, h: 1, sway: 0.3, life: 800 },
  foam: { n: 16, colors: ['white', 'ice'], vx: [-0.08, 0.08], vy: [-0.02, 0.02], w: 2, h: 1, sway: 0.2, life: 160, flicker: true },
  drips: { n: 10, colors: ['ice', 'teal'], vx: [0, 0], vy: [0.9, 1.4], w: 1, h: 2, sway: 0, life: 200 },
  ash: { n: 28, colors: ['grey', 'ash', 'bone'], vx: [-0.1, 0.12], vy: [0.1, 0.25], w: 1, h: 1, sway: 0.35, life: 900 },
  motes: { n: 20, colors: ['mint', 'ghost', 'lime'], vx: [-0.06, 0.06], vy: [-0.08, 0.02], w: 1, h: 1, sway: 0.4, life: 300, flicker: true },
  static: { n: 26, colors: ['grey', 'white', 'slate'], vx: [0, 0], vy: [0, 0], w: 1, h: 1, sway: 0, life: 6, flicker: true },
};

// Particles live in world pixels so they stay put while the camera moves.
export class Weather {
  ps: P[] = [];
  constructor(public kind: WeatherKind | null) {}

  private spawn(cx: number, cy: number, anywhere: boolean): P {
    const s = SPECS[this.kind!];
    const r = Math.random;
    const x = cx + r() * (W + 40) - 20;
    const y = anywhere ? cy + r() * H : s.vy[0] < 0 ? cy + H + 4 : s.vx[0] > 1 ? cy + r() * H : cy - 4;
    const xx = s.vx[0] > 1 && !anywhere ? cx - 10 : x;
    return {
      x: xx, y, vx: s.vx[0] + r() * (s.vx[1] - s.vx[0]), vy: s.vy[0] + r() * (s.vy[1] - s.vy[0]),
      life: Math.floor(s.life * (0.5 + r() * 0.5)), c: s.colors[Math.floor(r() * s.colors.length)], w: s.w, h: s.h, ph: r() * 6.28,
    };
  }

  update(cx: number, cy: number) {
    if (!this.kind) return;
    const s = SPECS[this.kind];
    while (this.ps.length < s.n) this.ps.push(this.spawn(cx, cy, this.ps.length < s.n / 2 && Math.random() < 0.9));
    for (const p of this.ps) {
      p.ph += 0.03;
      p.x += p.vx + Math.sin(p.ph) * s.sway * 0.3;
      p.y += p.vy;
      p.life--;
    }
    this.ps = this.ps.filter((p) => p.life > 0 && p.x > cx - 30 && p.x < cx + W + 30 && p.y > cy - 30 && p.y < cy + H + 30);
  }

  draw(g: Gfx, cx: number, cy: number, t: number) {
    if (!this.kind) return;
    const s = SPECS[this.kind];
    for (const p of this.ps) {
      if (s.flicker && (Math.floor(p.ph * 3 + t / 3) % 3 === 0)) continue;
      g.rect(Math.round(p.x - cx), Math.round(p.y - cy), p.w, p.h, p.c);
    }
  }
}
