// 8x8 procedural sprite generator.
// Rule: every sprite is 8x8, abstract, and uses AT MOST 3 colors,
// usually [black, colorA, colorB]. Deterministic from a seed.

import { RNG, hashStr } from "./rng.js";

export const SPRITE_SIZE = 8;

export type SpriteStyle =
  | "sym"    // mirrored blob creature
  | "glyph"  // abstract rune made of bars/dots/diagonals
  | "gear"   // mechanical ring with teeth
  | "shard"  // crystal triangle
  | "eye"    // a ring with a pupil (machines that watch)
  | "floor"  // full-tile ground dither
  | "wall"   // full-tile structure
  | "water"  // rippling dither
  | "void"   // dark tile with drifting specks
  | "door";  // doorway tile

export interface Sprite {
  cells: Uint8Array; // length 64, 0 = transparent, 1..3 = palette slot
  colors: string[];  // [c0, c1, c2]; c0 is usually black
}

interface GenCfg {
  outline: boolean;   // black (slot 1) outline around the mass
  body: 2 | 3;       // cell value of the body (colorA or colorB)
  accent: 2 | 3;     // cell value of accent specks
  accentRate: number;
}

export function generateSprite(seed: number, style: SpriteStyle, colors: string[]): Sprite {
  const rng = new RNG((hashStr(`${style}:${seed}`) ^ seed) >>> 0);
  const c = new Uint8Array(64);
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) c[y * 8 + x] = v;
  };
  if (style === "floor" || style === "wall" || style === "water" || style === "void" || style === "door") {
    genTile(c, style, rng);
    return { cells: c, colors };
  }

  // ---- creature / object styles -------------------------------------
  // Which palette slots? usually black + color + color, sometimes black + color.
  const twoColor = rng.chance(0.18);
  // cell value 1 is black, so the body and accent take values 2 and 3
  const body: 2 | 3 = rng.chance(0.5) ? 2 : 3;
  const accent: 2 | 3 = body === 2 ? 3 : 2;
  const useOutline = !twoColor && rng.chance(0.85);
  const cfg: GenCfg = {
    outline: useOutline,
    body,
    accent,
    accentRate: twoColor ? 0.25 : 0.15,
  };

  switch (style) {
    case "sym":
    case "eye": {
      genBlob(c, rng, cfg, style === "eye");
      break;
    }
    case "glyph": {
      genGlyph(c, rng, cfg);
      break;
    }
    case "gear": {
      genGear(c, rng, cfg);
      break;
    }
    case "shard": {
      genShard(c, rng, cfg);
      break;
    }
  }

  // Outline pass: black rim around the mass, read from a snapshot so the rim does not spread.
  if (cfg.outline) {
    const mass = c.slice();
    const at = (x: number, y: number) => (x < 0 || x > 7 || y < 0 || y > 7 ? 0 : mass[y * 8 + x]);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if (at(x, y) === 0 && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) put(x, y, 1);
  }
  // Remove empty sprites (all transparent) by stamping a fallback dot.
  let any = false;
  for (let i = 0; i < 64; i++) if (c[i]) any = true;
  if (!any) {
    put(3, 3, cfg.body); put(4, 4, cfg.body); put(4, 3, cfg.accent);
  }
  return { cells: c, colors };
}

function genBlob(c: Uint8Array, rng: RNG, cfg: GenCfg, eye: boolean): void {
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) c[y * 8 + x] = v;
  };
  const get = (x: number, y: number) => (x < 0 || x > 7 || y < 0 || y > 7 ? 0 : c[y * 8 + x]);
  const cx = 3.5;
  const cy = 3.5;
  const r = 2.1 + rng.next() * 1.4;
  const wob = [0, 1, 2, 3].map(() => (rng.next() - 0.5) * 1.6);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const ang = Math.atan2(dy, dx);
      const w = wob[Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 4) % 4];
      if (dx * dx + dy * dy <= (r + w * 0.35) * (r + w * 0.35)) put(x, y, cfg.body);
    }
  // Symmetrize horizontally (classic abstract sprite).
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++) {
      const a = get(x, y);
      const b = get(7 - x, y);
      const v = a || b;
      put(x, y, v); put(7 - x, y, v);
    }
  // Accent specks inside the mass.
  for (let i = 0; i < 6; i++) {
    const x = rng.int(1, 6);
    const y = rng.int(1, 6);
    if (get(x, y) === cfg.body && rng.chance(0.5)) put(x, y, cfg.accent);
  }
  if (eye) {
    // A ring with a pupil: punch a hole and re-stamp a pupil in the accent color.
    put(3, 3, 0); put(4, 3, 0); put(3, 4, 0); put(4, 4, 0);
    put(3, 3, cfg.accent); put(4, 3, cfg.accent);
    // rim the hole
    if (get(2, 3) === 0) put(2, 3, cfg.body);
    if (get(5, 3) === 0) put(5, 3, cfg.body);
    if (get(3, 2) === 0) put(3, 2, cfg.body);
    if (get(4, 5) === 0) put(4, 5, cfg.body);
  }
}

function genGlyph(c: Uint8Array, rng: RNG, cfg: GenCfg): void {
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) c[y * 8 + x] = v;
  };
  const strokes = rng.int(2, 4);
  for (let s = 0; s < strokes; s++) {
    const col = s % 2 === 0 ? cfg.body : cfg.accent;
    const kind = rng.int(0, 3);
    if (kind === 0) {
      const y = rng.int(1, 6);
      const x = rng.int(0, 5);
      for (let i = 0; i < rng.int(2, 3); i++) put(x + i, y, col);
    } else if (kind === 1) {
      const x = rng.int(1, 6);
      const y = rng.int(0, 5);
      for (let i = 0; i < rng.int(2, 3); i++) put(x, y + i, col);
    } else if (kind === 2) {
      const x = rng.int(1, 6);
      const y = rng.int(1, 6);
      put(x, y, col);
      if (rng.chance(0.5)) put(x + 1, y + 1, col);
    } else {
      const x = rng.int(0, 4);
      const y = rng.int(0, 4);
      const len = rng.int(3, 4);
      for (let i = 0; i < len; i++) put(x + i, y + i, col);
    }
  }
}

function genGear(c: Uint8Array, rng: RNG, cfg: GenCfg): void {
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) c[y * 8 + x] = v;
  };
  const get = (x: number, y: number) => (x < 0 || x > 7 || y < 0 || y > 7 ? 0 : c[y * 8 + x]);
  const cx = 3.5;
  const cy = 3.5;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const ang = (Math.atan2(y - cy, x - cx) / Math.PI) * 4; // 8 teeth
      const tooth = Math.abs(Math.sin(ang)) < 0.42;
      if (d >= 1.6 && d <= (tooth ? 3.6 : 3.0)) put(x, y, cfg.body);
      if (d < 1.1) put(x, y, cfg.accent);
    }
  if (get(3, 3) === 0) put(3, 3, cfg.accent);
}

function genShard(c: Uint8Array, rng: RNG, cfg: GenCfg): void {
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) c[y * 8 + x] = v;
  };
  const tilt = rng.chance(0.5) ? 1 : -1;
  const top = rng.int(0, 1);
  const bot = rng.int(6, 7);
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / Math.max(1, bot - top);
    const half = Math.max(1, Math.round(3 * (1 - t)));
    const mid = 3 + Math.round(tilt * (y - top) * 0.3);
    for (let x = mid - half + 1; x <= mid + half - 1; x++) put(x, y, cfg.body);
  }
  // facet line
  for (let y = top + 1; y <= bot - 1; y += 2) {
    const mid = 3 + Math.round(tilt * (y - top) * 0.3);
    put(mid, y, cfg.accent);
  }
}

function genTile(c: Uint8Array, style: SpriteStyle, rng: RNG): void {
  switch (style) {
    case "floor": {
      // base body + dither specks + rare dark speck
      for (let i = 0; i < 64; i++) c[i] = 2;
      for (let i = 0; i < 6; i++) c[rng.int(0, 63)] = 3;
      if (rng.chance(0.3)) c[rng.int(0, 63)] = 1;
      break;
    }
    case "wall": {
      const horizontal = rng.chance(0.5);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const stripe = horizontal ? y % 3 === 0 : x % 3 === 0;
          c[y * 8 + x] = stripe ? 1 : 2;
        }
      if (rng.chance(0.4)) c[rng.int(0, 63)] = 3;
      break;
    }
    case "water": {
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const wave = (x + Math.floor(y / 2) * 2 + y * y) % 7 === 0;
          c[y * 8 + x] = wave ? 3 : 2;
        }
      break;
    }
    case "void": {
      for (let i = 0; i < 64; i++) c[i] = 1;
      for (let i = 0; i < 4; i++) c[rng.int(0, 63)] = 2;
      for (let i = 0; i < 2; i++) c[rng.int(0, 63)] = 3;
      break;
    }
    case "door": {
      for (let i = 0; i < 64; i++) c[i] = 1;
      for (let y = 0; y < 8; y++) {
        c[y * 8 + 3] = 3;
        c[y * 8 + 4] = 3;
      }
      break;
    }
  }
}

export function drawSpriteTo(ctx: CanvasRenderingContext2D, spr: Sprite, x: number, y: number, scale = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  scale = Math.max(1, Math.round(scale));
  for (let py = 0; py < 8; py++)
    for (let px = 0; px < 8; px++) {
      const v = spr.cells[py * 8 + px];
      if (v === 0) continue;
      ctx.fillStyle = spr.colors[v - 1];
      ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
    }
}
