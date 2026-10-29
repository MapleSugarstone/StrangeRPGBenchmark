// The frame: a 192 by 192 pixel buffer with per-pixel normals, light class, and lead coverage.

export const W = 192;
export const H = 192;

/** Canvas pixels, ABGR in memory. */
export const buf = new Uint32Array(W * H);
/** Surface normal per pixel, x and y scaled to plus or minus 100. Zero means flat. */
export const nrm = new Int8Array(W * H * 2);
/** Light class: 0 world, 1 emissive (keeps its color), 2 sprite (never goes black). */
export const emi = new Uint8Array(W * H);
/** Lead coverage per pixel, 0 to 255. Covered world pixels take the region's shade color. */
export const shd = new Uint8Array(W * H);

let ctx: CanvasRenderingContext2D | null = null;
let image: ImageData | null = null;

export function attach(canvas: HTMLCanvasElement) {
  ctx = canvas.getContext('2d');
  if (!ctx) return;
  image = ctx.createImageData(W, H);
}

export function present() {
  if (!ctx || !image) return;
  new Uint32Array(image.data.buffer).set(buf);
  ctx.putImageData(image, 0, 0);
}

export function clearLayers() {
  nrm.fill(0);
  emi.fill(0);
  shd.fill(0);
}
