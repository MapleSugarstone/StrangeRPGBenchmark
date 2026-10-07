// A 192x192 pixel buffer drawn to the canvas at an integer scale, snapped to the console palette on the way out.
import { paletteLut, snap } from './palette';

export const W = 192;
export const H = 192;

const canvas = (typeof document !== 'undefined' ? document.getElementById('screen') : null) as HTMLCanvasElement | null;
const ctx = canvas ? canvas.getContext('2d')! : null;
const image = ctx ? ctx.createImageData(W, H) : null;
export const buf = image ? new Uint32Array(image.data.buffer) : new Uint32Array(W * H);

/** Per-pixel surface normals for lighting, two signed bytes per pixel (x and y, scaled by 100). Zero is flat. */
export const nrm = new Int8Array(W * H * 2);
/** Per-pixel light class: 0 world, 1 gives off its own light and is not darkened, 2 sprite. */
export const emi = new Uint8Array(W * H);

/** Converts 0xRRGGBB to the buffer's pixel format. */
export function px(rgb: number): number {
  return (0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)) >>> 0;
}

export function rgbOf(p: number): number {
  return ((p & 0xff) << 16) | (p & 0xff00) | ((p >> 16) & 0xff);
}

export function clear(rgb = 0) {
  buf.fill(px(rgb));
}

/** Resets normals and emissive flags for a lit frame. */
export function clearAux() {
  nrm.fill(0);
  emi.fill(0);
}

export function pset(x: number, y: number, p: number) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = p;
}

export function rect(x: number, y: number, w: number, h: number, rgb: number) {
  const p = px(rgb);
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) buf.fill(p, yy * W + x0, yy * W + x1);
}

/** A rectangle drawn with a checkerboard, so whatever is under it shows through half the pixels. */
export function ditherRect(x: number, y: number, w: number, h: number, rgb: number, phase = 0) {
  const p = px(rgb);
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (((xx + yy + phase) & 1) === 0) buf[yy * W + xx] = p;
}

/** Marks a rectangle as giving off its own light. */
export function glow(x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) emi.fill(1, yy * W + x0, yy * W + x1);
}

export function frame(x: number, y: number, w: number, h: number, rgb: number) {
  rect(x, y, w, 1, rgb);
  rect(x, y + h - 1, w, 1, rgb);
  rect(x, y, 1, h, rgb);
  rect(x + w - 1, y, 1, h, rgb);
}

export function hline(x: number, y: number, w: number, rgb: number) { rect(x, y, w, 1, rgb); }
export function vline(x: number, y: number, h: number, rgb: number) { rect(x, y, 1, h, rgb); }

export function present() {
  if (!ctx || !image) return;
  const t = paletteLut();
  for (let i = 0; i < buf.length; i++) buf[i] = snap(buf[i], t);
  ctx.putImageData(image, 0, 0);
}

export function fit() {
  if (!canvas) return;
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth, window.innerHeight) / W));
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}

export function focusCanvas() { canvas?.focus(); }
