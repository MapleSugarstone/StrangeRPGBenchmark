export const W = 192;
export const H = 192;
export const INK = '#0b0a10';

export const canvas = document.getElementById('screen') as HTMLCanvasElement;
const main = canvas.getContext('2d')!;
main.imageSmoothingEnabled = false;
/** The drawing target. Normally the screen. `layer` points it at an offscreen canvas for a while. */
export let ctx = main;

const layers = new Map<string, HTMLCanvasElement>();

/**
 * Draws `fn` into a w by h offscreen layer with every primitive at 1x, then copies it to the screen at x, y scaled by `scale`.
 * Everything in the layer shares one coarse pixel grid, so nothing drawn there can be a mixel.
 */
export function layer(key: string, w: number, h: number, x: number, y: number, scale: number, fn: () => void, readable = false): void {
  let cv = layers.get(key);
  if (!cv || cv.width !== w || cv.height !== h) {
    cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    layers.set(key, cv);
  }
  // A layer whose pixels get read back each frame stays in memory, where reading it is cheap.
  const g = cv.getContext('2d', readable ? { willReadFrequently: true } : undefined)!;
  g.imageSmoothingEnabled = false;
  const prev = ctx;
  ctx = g;
  try { fn(); } finally { ctx = prev; }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, 0, 0, w, h, x, y, w * scale, h * scale);
}

let fadeCv: HTMLCanvasElement | null = null;
const fadeMasks = new Map<number, CanvasPattern>();

/**
 * Draws `fn` with its origin at x, y, keeping only `level` (0 to 1) of its pixels in a fixed 4 by 4 dither, for fades.
 * `fn` draws in local coordinates inside a w by h box.
 */
export function faded(w: number, h: number, x: number, y: number, level: number, fn: () => void): void {
  if (level <= 0 || w <= 0 || h <= 0) return;
  const prev = ctx;
  if (level >= 1) {
    prev.save(); prev.translate(Math.round(x), Math.round(y));
    try { fn(); } finally { prev.restore(); }
    return;
  }
  if (!fadeCv || fadeCv.width < w || fadeCv.height < h) { fadeCv = document.createElement('canvas'); fadeCv.width = Math.max(w, 64); fadeCv.height = Math.max(h, 64); }
  const g = fadeCv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, fadeCv.width, fadeCv.height);
  ctx = g;
  try { fn(); } finally { ctx = prev; }
  const steps = Math.max(1, Math.min(15, Math.round(level * 16)));
  let mask = fadeMasks.get(steps);
  if (!mask) {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const m = cv.getContext('2d')!;
    for (let k = 0; k < 16; k++) if (BAYER[k] < steps) m.fillRect(k & 3, k >> 2, 1, 1);
    mask = g.createPattern(cv, 'repeat')!;
    fadeMasks.set(steps, mask);
  }
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  prev.drawImage(fadeCv, 0, 0, w, h, Math.round(x), Math.round(y), w, h);
}

export function fit(): void {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
window.addEventListener('resize', fit);
fit();

export function rect(x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frame(x: number, y: number, w: number, h: number, fill: string, edge: string): void {
  rect(x, y, w, h, edge);
  rect(x + 1, y + 1, w - 2, h - 2, fill);
}

export function px(x: number, y: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function clear(c = INK): void {
  rect(0, 0, W, H, c);
}

/** Mixes two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patterns = new Map<string, CanvasPattern>();

/** A 4 by 4 ordered-dither tile of one color at one of 17 coverage steps, anchored to the target's origin. */
function bayerPattern(c: string, steps: number): CanvasPattern {
  const key = c + steps;
  let p = patterns.get(key);
  if (!p) {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const g = cv.getContext('2d')!;
    g.fillStyle = c;
    for (let k = 0; k < 16; k++) if (BAYER[k] < steps) g.fillRect(k & 3, k >> 2, 1, 1);
    p = main.createPattern(cv, 'repeat')!;
    patterns.set(key, p);
  }
  return p;
}

/** Ordered dither: covers `level` (0 to 1) of the area with color c, in a fixed 4 by 4 pattern. */
export function dither(x: number, y: number, w: number, h: number, c: string, level: number): void {
  const steps = Math.max(0, Math.min(16, Math.ceil(level * 16)));
  if (steps === 0 || w <= 0 || h <= 0) return;
  ctx.fillStyle = steps === 16 ? c : bayerPattern(c, steps);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
