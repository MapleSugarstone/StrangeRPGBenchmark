import { Sprite } from "./sprite.js";
import { PALETTE } from "./palette.js";
import { GLYPHS } from "./font.js";

export let buffer: ImageData;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let scale: number = 1;

/**
 * Initialize the screen with the given canvas element.
 */
export function initScreen(c: HTMLCanvasElement): void {
  canvas = c;
  ctx = c.getContext("2d")!;
  buffer = ctx.createImageData(192, 192);
  resize();
  window.addEventListener("resize", resize);
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  scale = Math.min(Math.floor(w / 192), Math.floor(h / 192));
  if (scale < 1) scale = 1;
  canvas.width = 192;
  canvas.height = 192;
  canvas.style.width = `${192 * scale}px`;
  canvas.style.height = `${192 * scale}px`;
  canvas.style.imageRendering = "pixelated";
  canvas.style.position = "absolute";
  canvas.style.top = "50%";
  canvas.style.left = "50%";
  canvas.style.transform = "translate(-50%, -50%)";
  ctx.imageSmoothingEnabled = false;
}

/**
 * Draw a sprite at the given position.
 */
export function drawSprite(
  sprite: Sprite,
  x: number,
  y: number,
  s: 1 | 2 = 1
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  for (let row = 0; row < 8; row++) {
    const line = sprite.rows[row];
    for (let col = 0; col < 8; col++) {
      const ch = line[col];
      if (ch === "." || ch === " ") continue;
      const colorIdx = parseInt(ch, 10) - 1;
      if (colorIdx < 0 || colorIdx >= sprite.colors.length) continue;
      const color = sprite.colors[colorIdx];
      const idx = (py + row) * 192 + (px + col);
      const rgba = hexToRgba(color);
      for (let dy = 0; dy < s; dy++) {
        for (let dx = 0; dx < s; dx++) {
          // Clipped, so a sprite at the screen edge never wraps into the next row.
          const sx = px + col * s + dx, sy = py + row * s + dy;
          if (sx < 0 || sy < 0 || sx >= 192 || sy >= 192) continue;
          const bidx = (sy * 192 + sx) * 4;
          buffer.data[bidx] = rgba[0];
          buffer.data[bidx + 1] = rgba[1];
          buffer.data[bidx + 2] = rgba[2];
          buffer.data[bidx + 3] = rgba[3];
        }
      }
    }
  }
}

/**
 * Fill a rectangle with a solid color.
 */
export function fillRect(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const rgba = hexToRgba(color);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (px + col < 0 || py + row < 0 || px + col >= 192 || py + row >= 192) continue;
      const idx = (py + row) * 192 * 4 + (px + col) * 4;
      buffer.data[idx] = rgba[0];
      buffer.data[idx + 1] = rgba[1];
      buffer.data[idx + 2] = rgba[2];
      buffer.data[idx + 3] = rgba[3];
    }
  }
}

/**
 * Ordered 4x4 Bayer dithering between two colors.
 */
export function dither(
  x: number,
  y: number,
  w: number,
  h: number,
  colorA: string,
  colorB: string,
  level: number
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const rgbaA = hexToRgba(colorA);
  const rgbaB = hexToRgba(colorB);
  const bayer: number[][] = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const bayerVal = bayer[row % 4][col % 4];
      const threshold = (bayerVal / 16) * level;
      const blend = threshold < 0.5 ? rgbaA : rgbaB;
      const idx = (py + row) * 192 * 4 + (px + col) * 4;
      buffer.data[idx] = blend[0];
      buffer.data[idx + 1] = blend[1];
      buffer.data[idx + 2] = blend[2];
      buffer.data[idx + 3] = blend[3];
    }
  }
}

/**
 * Present the buffer to the canvas.
 */
export function present(): void {
  ctx.putImageData(buffer, 0, 0);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}
