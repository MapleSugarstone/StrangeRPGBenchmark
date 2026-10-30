// The frame: a 200 by 200 pixel buffer with per-pixel normals, light class, floor class, and palette index.

import { LAYOUT, endFrame } from './layout';

export const W = 200;
export const H = 200;

/** Canvas pixels, ABGR in memory. */
export const buf = new Uint32Array(W * H);
/** Surface normal per pixel, x and y scaled to plus or minus 100. Zero means flat. */
export const nrm = new Int8Array(W * H * 2);
/** Light class: 0 world, 1 emissive (keeps its color), 2 sprite (never goes black). */
export const emi = new Uint8Array(W * H);
/** Floor class: 0 not floor (walls, props, actors), 1 dry floor, 2 wet floor, 3 puddle, 4 water. */
export const flo = new Uint8Array(W * H);
/** Palette index of each pixel after the composite, for passes that step colors along ramps. */
export const ibuf = new Uint8Array(W * H);
/** Albedo palette index of each world pixel before lighting. */
export const alb = new Uint8Array(W * H);
/** Roof tops, which catch the sky haze that streets do not. */
export const roof = new Uint8Array(W * H);

let ctx: CanvasRenderingContext2D | null = null;
let image: ImageData | null = null;
let canvasEl: HTMLCanvasElement | null = null;

export function attach(canvas: HTMLCanvasElement) {
  canvasEl = canvas;
  ctx = canvas.getContext('2d');
  if (!ctx) return;
  image = ctx.createImageData(W, H);
}

export function present() {
  if (LAYOUT.on) endFrame();
  if (!ctx || !image) return;
  new Uint32Array(image.data.buffer).set(buf);
  ctx.putImageData(image, 0, 0);
}

export function clearLayers() {
  nrm.fill(0);
  emi.fill(0);
  flo.fill(0);
  roof.fill(0);
}

/** Converts a page position to a frame pixel, or null outside the canvas. */
export function toFrame(clientX: number, clientY: number): [number, number] | null {
  if (!canvasEl) return null;
  const r = canvasEl.getBoundingClientRect();
  const x = Math.floor(((clientX - r.left) / r.width) * W);
  const y = Math.floor(((clientY - r.top) / r.height) * H);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  return [x, y];
}
