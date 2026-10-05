import { Rng, hash } from "./rng";
import type { ColorName } from "./palette";

/**
 * Every sprite in the game is an 8x8 grid generated from a spec.
 * Cell values: 0 transparent, 1 black, 2 color a, 3 color b.
 */
export type SpriteKind = "creature" | "humanoid" | "item" | "tile" | "shape";

export interface SpriteSpec {
  kind: SpriteKind;
  seed: string;
  a: ColorName;
  b: ColorName;
  /** Tile pattern, item style or shape name. */
  variant?: string;
}

export type Cells = Uint8Array;

const cache = new Map<string, Cells>();

export function specKey(s: SpriteSpec): string {
  return `${s.kind}|${s.seed}|${s.a}|${s.b}|${s.variant ?? ""}`;
}

export function getSprite(spec: SpriteSpec): Cells {
  const key = specKey(spec);
  let c = cache.get(key);
  if (!c) {
    c = generate(spec);
    cache.set(key, c);
  }
  return c;
}

export function generate(spec: SpriteSpec): Cells {
  const rng = new Rng(hash(`${spec.kind}:${spec.seed}:${spec.variant ?? ""}`));
  switch (spec.kind) {
    case "creature": return creature(rng, spec);
    case "humanoid": return humanoid(rng, spec);
    case "item": return item(rng, spec);
    case "tile": return tile(rng, spec);
    case "shape": return shape(spec);
  }
}

const at = (c: Cells, x: number, y: number) => (x < 0 || y < 0 || x > 7 || y > 7 ? 0 : c[y * 8 + x]);
const set = (c: Cells, x: number, y: number, v: number) => {
  if (x >= 0 && y >= 0 && x < 8 && y < 8) c[y * 8 + x] = v;
};

function outline(c: Cells): void {
  const src = Uint8Array.from(c);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (src[y * 8 + x] !== 0) continue;
      const n = at(src, x - 1, y) || at(src, x + 1, y) || at(src, x, y - 1) || at(src, x, y + 1);
      if (n > 1) c[y * 8 + x] = 1;
    }
  }
}

function neighbors(c: Cells, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && at(c, x + dx, y + dy) > 1) n++;
  return n;
}

/**
 * Silhouette templates for creatures. Each is the left half (4 columns) of an 8x8 grid,
 * giving the chance that a cell is body. The right half mirrors it.
 */
const CREATURE_SHAPES: Record<string, number[][]> = {
  blob: [
    [0, 0, 0, 0], [0, 0.3, 0.7, 0.8], [0.2, 0.7, 0.9, 0.95], [0.3, 0.8, 0.95, 1], [0.3, 0.8, 0.95, 1], [0.2, 0.7, 0.9, 0.95], [0, 0.3, 0.7, 0.8], [0, 0, 0, 0],
  ],
  tall: [
    [0, 0, 0.5, 0.8], [0, 0.2, 0.8, 0.95], [0, 0.4, 0.9, 1], [0, 0.4, 0.9, 1], [0, 0.4, 0.9, 1], [0, 0.4, 0.9, 1], [0, 0.3, 0.8, 0.95], [0, 0, 0.6, 0.8],
  ],
  flat: [
    [0, 0, 0, 0], [0, 0, 0, 0.3], [0, 0.2, 0.5, 0.8], [0.6, 0.9, 1, 1], [0.8, 0.95, 1, 1], [0.6, 0.9, 1, 1], [0.2, 0.4, 0.5, 0.6], [0, 0, 0, 0],
  ],
  winged: [
    [0, 0, 0, 0.4], [0.4, 0.7, 0.3, 0.9], [0.8, 0.9, 0.7, 1], [0.8, 0.9, 0.8, 1], [0.5, 0.7, 0.8, 1], [0.2, 0.3, 0.8, 1], [0, 0, 0.6, 0.9], [0, 0, 0, 0.3],
  ],
  legged: [
    [0, 0, 0, 0], [0, 0.4, 0.8, 0.9], [0.2, 0.8, 0.95, 1], [0.3, 0.9, 1, 1], [0.3, 0.9, 1, 1], [0.1, 0.6, 0.8, 0.9], [0, 0.9, 0.1, 0.9], [0, 0.9, 0, 0.9],
  ],
  spiky: [
    [0, 0, 0.6, 0.2], [0, 0.3, 0.8, 0.9], [0.6, 0.6, 0.95, 1], [0, 0.8, 1, 1], [0.6, 0.6, 1, 1], [0, 0.8, 0.95, 1], [0.5, 0.3, 0.8, 0.9], [0, 0, 0.3, 0.6],
  ],
  orb: [
    [0, 0, 0.4, 0.7], [0, 0.5, 0.9, 1], [0.4, 0.9, 1, 1], [0.7, 1, 1, 1], [0.7, 1, 1, 1], [0.4, 0.9, 1, 1], [0, 0.5, 0.9, 1], [0, 0, 0.4, 0.7],
  ],
  stalk: [
    [0, 0.5, 0.9, 1], [0, 0.6, 1, 1], [0, 0.4, 0.9, 1], [0, 0, 0.3, 1], [0, 0, 0.3, 1], [0, 0, 0.3, 1], [0, 0.3, 0.6, 1], [0, 0.5, 0.8, 1],
  ],
};

/** Mirrored silhouette with noise, markings, eyes and an outline. */
function creature(rng: Rng, spec: SpriteSpec): Cells {
  const c = new Uint8Array(64);
  const shapeName = spec.variant && CREATURE_SHAPES[spec.variant] ? spec.variant : rng.pick(Object.keys(CREATURE_SHAPES));
  const tpl = CREATURE_SHAPES[shapeName];
  const jitter = rng.next() * 0.25;
  for (let attempt = 0; attempt < 6; attempt++) {
    c.fill(0);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 4; x++) {
        const p = tpl[y][x];
        if (p > 0 && rng.chance(Math.min(1, p + jitter - 0.1))) { set(c, x, y, 2); set(c, 7 - x, y, 2); }
      }
    // Remove lonely cells and fill tight gaps, but leave thin legs and spikes alone.
    const snap = Uint8Array.from(c);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const n = neighbors(snap, x, y);
        if (snap[y * 8 + x] > 1 && n === 0) c[y * 8 + x] = 0;
        if (snap[y * 8 + x] === 0 && n >= 6) c[y * 8 + x] = 2;
      }
    let count = 0;
    for (let i = 0; i < 64; i++) if (c[i] > 1) count++;
    if (count >= 12) break;
  }
  // Markings in color b.
  const style = rng.pick(["spots", "stripes", "belly", "core", "crown", "bands", "none"]);
  let top = 8;
  for (let y = 0; y < 8; y++) if (c.subarray(y * 8, y * 8 + 8).some((v) => v > 1)) { top = y; break; }
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++) {
      if (at(c, x, y) !== 2) continue;
      let mark = false;
      if (style === "spots") mark = rng.chance(0.3);
      else if (style === "stripes") mark = y % 2 === 0;
      else if (style === "belly") mark = y >= 4 && x >= 2;
      else if (style === "core") mark = y >= 3 && y <= 4 && x === 3;
      else if (style === "crown") mark = y <= top;
      else if (style === "bands") mark = x === 1 || x === 2 ? y % 3 === 0 : false;
      if (mark) { set(c, x, y, 3); set(c, 7 - x, y, 3); }
    }
  // Eyes: a symmetric pair on the upper body, or one eye in the middle.
  const eyeStyle = rng.pick(["pair", "pair", "wide", "one", "three"]);
  const cols = eyeStyle === "wide" ? [1, 6] : eyeStyle === "one" ? [3, 4] : [2, 5];
  let placed = false;
  for (let y = top; y <= 5 && !placed; y++) {
    if (at(c, cols[0], y) > 1 && at(c, cols[1], y) > 1) {
      set(c, cols[0], y, 1); set(c, cols[1], y, 1);
      if (eyeStyle === "three" && at(c, 3, y + 1) > 1 && at(c, 4, y + 1) > 1) { set(c, 3, y + 1, 1); set(c, 4, y + 1, 1); }
      placed = true;
    }
  }
  if (!placed) { set(c, 3, top + 1, 1); set(c, 4, top + 1, 1); }
  outline(c);
  return c;
}

/** Chibi figure: hat/hair, head (color b), torso (color a), legs. */
function humanoid(rng: Rng, spec: SpriteSpec): Cells {
  const c = new Uint8Array(64);
  const hat = rng.pick(["none", "cap", "horns", "crown", "hood", "hair", "antenna", "halo"]);
  const wide = rng.chance(0.5);
  const bodyTop = 3;
  // Head rows 1..2 (b), row 0 is headgear.
  set(c, 3, 1, 3); set(c, 4, 1, 3);
  set(c, 2, 2, 3); set(c, 3, 2, 3); set(c, 4, 2, 3); set(c, 5, 2, 3);
  if (rng.chance(0.6)) { set(c, 2, 1, 3); set(c, 5, 1, 3); }
  // Eyes.
  set(c, 3, 2, 1); set(c, 4, 2, 1);
  if (rng.chance(0.3)) { set(c, 2, 2, 1); set(c, 5, 2, 1); set(c, 3, 2, 3); set(c, 4, 2, 3); }
  switch (hat) {
    case "cap": set(c, 2, 0, 2); set(c, 3, 0, 2); set(c, 4, 0, 2); set(c, 5, 0, 2); break;
    case "horns": set(c, 2, 0, 1); set(c, 5, 0, 1); set(c, 1, 0, 2); set(c, 6, 0, 2); break;
    case "crown": set(c, 2, 0, 2); set(c, 4, 0, 2); set(c, 6, 0, 2); set(c, 3, 0, 1); set(c, 5, 0, 1); break;
    case "hood": set(c, 2, 0, 2); set(c, 3, 0, 2); set(c, 4, 0, 2); set(c, 5, 0, 2); set(c, 2, 1, 2); set(c, 5, 1, 2); break;
    case "hair": set(c, 3, 0, 1); set(c, 4, 0, 1); set(c, 2, 1, 1); set(c, 5, 1, 1); break;
    case "antenna": set(c, 3, 0, 1); set(c, 4, 0, 3); break;
    case "halo": set(c, 2, 0, 3); set(c, 5, 0, 3); set(c, 3, 0, 1); set(c, 4, 0, 1); break;
  }
  // Torso rows 3..5.
  for (let y = bodyTop; y <= 5; y++) {
    set(c, 3, y, 2); set(c, 4, y, 2);
    if (wide || y > bodyTop) { set(c, 2, y, 2); set(c, 5, y, 2); }
  }
  // Arms.
  const armPose = rng.pick(["down", "out", "up", "one"]);
  if (armPose === "down") { set(c, 1, 4, 2); set(c, 6, 4, 2); set(c, 1, 5, 1); set(c, 6, 5, 1); }
  else if (armPose === "out") { set(c, 1, 3, 2); set(c, 6, 3, 2); set(c, 0, 3, 1); set(c, 7, 3, 1); }
  else if (armPose === "up") { set(c, 1, 3, 2); set(c, 6, 3, 2); set(c, 1, 2, 1); set(c, 6, 2, 1); }
  else { set(c, 1, 4, 2); set(c, 6, 3, 2); set(c, 7, 2, 1); set(c, 1, 5, 1); }
  // Chest mark.
  const mark = rng.pick(["none", "dot", "bar", "v"]);
  if (mark === "dot") set(c, rng.int(3, 4), 4, 3);
  else if (mark === "bar") { set(c, 3, 4, 3); set(c, 4, 4, 3); }
  else if (mark === "v") { set(c, 3, 3, 1); set(c, 4, 3, 1); set(c, 3, 5, 3); set(c, 4, 5, 3); }
  // Legs rows 6..7.
  const legs = rng.pick(["two", "wide", "one", "skirt"]);
  if (legs === "two") { set(c, 3, 6, 1); set(c, 4, 6, 1); set(c, 3, 7, 1); set(c, 4, 7, 1); }
  else if (legs === "wide") { set(c, 2, 6, 1); set(c, 5, 6, 1); set(c, 2, 7, 1); set(c, 5, 7, 1); }
  else if (legs === "one") { set(c, 3, 6, 1); set(c, 4, 6, 1); set(c, 3, 7, 2); set(c, 4, 7, 2); }
  else { for (let x = 2; x <= 5; x++) { set(c, x, 6, 2); set(c, x, 7, 1); } }
  return c;
}

/** Small symmetric object: gems are 4-way symmetric, tools mirror left to right. */
function item(rng: Rng, spec: SpriteSpec): Cells {
  const c = new Uint8Array(64);
  const style = spec.variant ?? rng.pick(["gem", "tool", "gem", "orb"]);
  if (style === "gem" || style === "orb") {
    // Fill a 3x3 quadrant, mirror to 6x6 inside the 8x8.
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const dist = Math.abs(x - 2) + Math.abs(y - 2);
        const p = style === "orb" ? (dist <= 2 ? 0.95 : 0.3) : 0.55 + (2 - dist) * 0.15;
        if (rng.chance(p)) {
          const v = rng.chance(0.3) ? 3 : 2;
          set(c, 1 + x, 1 + y, v); set(c, 6 - x, 1 + y, v);
          set(c, 1 + x, 6 - y, v); set(c, 6 - x, 6 - y, v);
        }
      }
    set(c, 3, 3, 3); set(c, 4, 3, 3); set(c, 3, 4, 3); set(c, 4, 4, 3);
    if (rng.chance(0.5)) set(c, 3, 3, 2);
  } else {
    // Tool: vertical shaft plus a head, mirrored left to right.
    const headTop = rng.int(1, 2);
    const headH = rng.int(1, 3);
    for (let y = headTop; y < headTop + headH; y++) {
      const w = rng.int(1, 3);
      for (let x = 3 - w + 1; x <= 3; x++) { set(c, x, y, 3); set(c, 7 - x, y, 3); }
    }
    for (let y = headTop + headH; y <= 6; y++) { set(c, 3, y, 2); set(c, 4, y, 2); }
    if (rng.chance(0.6)) { set(c, 2, 5, 1); set(c, 5, 5, 1); }
  }
  outline(c);
  return c;
}

/** Terrain patterns. Variant chooses the rule; the seed varies the details. */
function tile(rng: Rng, spec: SpriteSpec): Cells {
  const c = new Uint8Array(64);
  const v = spec.variant ?? "noise";
  const fill = (val: number) => c.fill(val);
  switch (v) {
    case "noise":
      fill(2);
      for (let i = 0; i < 64; i++) if (rng.chance(0.15)) c[i] = 3;
      break;
    case "grass":
      fill(2);
      for (let i = 0; i < 5; i++) {
        const x = rng.int(0, 7), y = rng.int(0, 6);
        set(c, x, y, 3); set(c, x, y + 1, 3);
      }
      break;
    case "sand":
      fill(2);
      for (let i = 0; i < 4; i++) set(c, rng.int(0, 7), rng.int(0, 7), 3);
      break;
    case "wall":
      fill(2);
      for (let y = 0; y < 8; y += 4) {
        for (let x = 0; x < 8; x++) set(c, x, y + 3, 1);
        const off = y === 0 ? 0 : 4;
        for (let yy = y; yy < y + 3; yy++) set(c, (off + 3) % 8, yy, 1);
        for (let yy = y; yy < y + 3; yy++) set(c, (off + 7) % 8, yy, 1);
      }
      for (let i = 0; i < 4; i++) { const x = rng.int(0, 7), y = rng.int(0, 7); if (at(c, x, y) === 2) set(c, x, y, 3); }
      break;
    case "stone":
      fill(2);
      for (let i = 0; i < 3; i++) {
        const x = rng.int(0, 6), y = rng.int(0, 6);
        set(c, x, y, 3); set(c, x + 1, y, 3); set(c, x, y + 1, 3);
      }
      for (let i = 0; i < 3; i++) set(c, rng.int(0, 7), rng.int(0, 7), 1);
      break;
    case "water":
      fill(2);
      for (let k = 0; k < 2; k++) {
        const y = k * 4 + rng.int(0, 2);
        const x0 = rng.int(0, 4);
        set(c, x0, y, 3); set(c, x0 + 1, y, 3); set(c, x0 + 2, y + 1, 3); set(c, x0 + 3, y + 1, 3);
      }
      break;
    case "void":
      fill(1);
      if (rng.chance(0.5)) set(c, rng.int(0, 7), rng.int(0, 7), 3);
      break;
    case "circuit":
      fill(2);
      {
        const y = rng.int(1, 6), x = rng.int(1, 6);
        for (let i = 0; i < 8; i++) set(c, i, y, 3);
        for (let i = 0; i < 8; i++) if (rng.chance(0.4)) set(c, x, i, 3);
        set(c, x, y, 1);
      }
      break;
    case "salt":
      fill(2);
      for (let i = 0; i < 6; i++) set(c, rng.int(0, 7), rng.int(0, 7), 3);
      for (let i = 0; i < 2; i++) set(c, rng.int(0, 7), rng.int(0, 7), 1);
      break;
    case "tree":
      for (let y = 0; y < 6; y++)
        for (let x = 0; x < 8; x++) {
          const dx = x - 3.5, dy = y - 2.5;
          if (dx * dx + dy * dy <= 10) set(c, x, y, rng.chance(0.25) ? 3 : 2);
        }
      set(c, 3, 6, 1); set(c, 4, 6, 1); set(c, 3, 7, 1); set(c, 4, 7, 1);
      outline(c);
      break;
    case "pillar":
      for (let y = 0; y < 8; y++) { set(c, 2, y, 1); set(c, 3, y, 2); set(c, 4, y, 3); set(c, 5, y, 1); }
      set(c, 1, 0, 1); set(c, 6, 0, 1); set(c, 1, 7, 1); set(c, 6, 7, 1);
      break;
    case "stairs":
      fill(2);
      for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x++) set(c, x, y, 1);
      for (let y = 1; y < 8; y += 2) for (let x = 0; x < 8; x++) if (x < y) set(c, x, y, 3);
      break;
    case "door":
      fill(1);
      for (let y = 1; y < 8; y++) for (let x = 2; x <= 5; x++) set(c, x, y, 2);
      set(c, 3, 0, 2); set(c, 4, 0, 2); set(c, 5, 4, 3);
      break;
    case "crystal":
      fill(2);
      for (let y = 1; y < 7; y++) { set(c, 3, y, 3); set(c, 4, y, 3); }
      set(c, 2, 3, 3); set(c, 5, 4, 3); set(c, 3, 0, 1); set(c, 4, 7, 1);
      outline(c);
      break;
    case "glass":
      fill(2);
      for (let i = 0; i < 8; i++) set(c, i, (i + rng.int(0, 7)) % 8, 3);
      break;
    case "grid":
      fill(2);
      for (let i = 0; i < 8; i++) { set(c, i, 0, 3); set(c, 0, i, 3); }
      break;
    case "bone":
      fill(2);
      { const x = rng.int(0, 5), y = rng.int(0, 7); for (let i = 0; i < 3; i++) set(c, x + i, y, 3); set(c, x, (y + 1) % 8, 1); }
      break;
    case "lava":
      fill(2);
      for (let i = 0; i < 10; i++) set(c, rng.int(0, 7), rng.int(0, 7), 3);
      for (let i = 0; i < 3; i++) set(c, rng.int(0, 7), rng.int(0, 7), 1);
      break;
    default:
      fill(2);
  }
  return c;
}

/** Rule drawn glyphs for the interface. */
function shape(spec: SpriteSpec): Cells {
  const c = new Uint8Array(64);
  switch (spec.variant) {
    case "cursor":
      for (let y = 0; y < 7; y++) {
        const w = y < 4 ? y + 1 : 7 - y;
        for (let x = 0; x < w; x++) set(c, 1 + x, y, x === w - 1 ? 3 : 2);
      }
      outline(c);
      break;
    case "heart":
      [[1, 1], [2, 1], [5, 1], [6, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3], [3, 4], [4, 4]]
        .forEach(([x, y]) => set(c, x, y + 1, 2));
      set(c, 2, 2, 3);
      outline(c);
      break;
    case "skull":
      for (let y = 1; y <= 4; y++) for (let x = 2; x <= 5; x++) set(c, x, y, 2);
      set(c, 3, 2, 1); set(c, 4, 2, 1); set(c, 3, 5, 2); set(c, 4, 5, 2); set(c, 2, 6, 3); set(c, 5, 6, 3);
      outline(c);
      break;
    case "star":
      set(c, 3, 1, 2); set(c, 4, 1, 2);
      for (let x = 1; x <= 6; x++) set(c, x, 3, 2);
      for (let x = 2; x <= 5; x++) set(c, x, 2, 2);
      for (let x = 2; x <= 5; x++) set(c, x, 4, 2);
      set(c, 2, 5, 2); set(c, 5, 5, 2); set(c, 1, 6, 2); set(c, 6, 6, 2); set(c, 3, 3, 3); set(c, 4, 3, 3);
      outline(c);
      break;
    case "box":
      for (let i = 0; i < 8; i++) { set(c, i, 0, 1); set(c, i, 7, 1); set(c, 0, i, 1); set(c, 7, i, 1); }
      break;
    case "dot":
      set(c, 3, 3, 2); set(c, 4, 3, 2); set(c, 3, 4, 2); set(c, 4, 4, 2);
      break;
    case "arrowdown":
      for (let x = 1; x <= 6; x++) set(c, x, 2, 2);
      for (let x = 2; x <= 5; x++) set(c, x, 3, 2);
      set(c, 3, 4, 2); set(c, 4, 4, 2);
      break;
    case "check":
      set(c, 1, 4, 2); set(c, 2, 5, 2); set(c, 3, 6, 2); set(c, 4, 5, 2); set(c, 5, 4, 2); set(c, 6, 3, 2); set(c, 7, 2, 2);
      break;
    case "clock":
      for (let x = 2; x <= 5; x++) { set(c, x, 0, 2); set(c, x, 7, 2); }
      for (let y = 2; y <= 5; y++) { set(c, 0, y, 2); set(c, 7, y, 2); }
      set(c, 1, 1, 2); set(c, 6, 1, 2); set(c, 1, 6, 2); set(c, 6, 6, 2);
      set(c, 3, 2, 3); set(c, 3, 3, 3); set(c, 3, 4, 3); set(c, 4, 4, 3);
      break;
    case "link":
      for (let x = 0; x <= 3; x++) { set(c, x, 2, 2); set(c, x, 5, 2); }
      for (let x = 4; x <= 7; x++) { set(c, x, 2, 3); set(c, x, 5, 3); }
      set(c, 0, 3, 2); set(c, 0, 4, 2); set(c, 7, 3, 3); set(c, 7, 4, 3); set(c, 3, 3, 2); set(c, 4, 4, 3);
      break;
    case "shield":
      for (let y = 0; y <= 4; y++) for (let x = 1; x <= 6; x++) set(c, x, y, 2);
      for (let x = 2; x <= 5; x++) set(c, x, 5, 2);
      set(c, 3, 6, 2); set(c, 4, 6, 2);
      set(c, 3, 2, 3); set(c, 4, 2, 3); set(c, 3, 3, 3); set(c, 4, 3, 3);
      outline(c);
      break;
    case "coin":
      for (let y = 1; y <= 6; y++) for (let x = 1; x <= 6; x++) {
        const dx = x - 3.5, dy = y - 3.5;
        if (dx * dx + dy * dy <= 7) set(c, x, y, 2);
      }
      set(c, 3, 3, 3); set(c, 4, 3, 3); set(c, 3, 4, 3); set(c, 4, 4, 3);
      outline(c);
      break;
    case "moth":
      for (let x = 0; x <= 2; x++) { set(c, x, 1, 2); set(c, 7 - x, 1, 2); set(c, x, 2, 2); set(c, 7 - x, 2, 2); }
      for (let x = 0; x <= 2; x++) { set(c, x, 4, 2); set(c, 7 - x, 4, 2); set(c, x, 5, 2); set(c, 7 - x, 5, 2); }
      set(c, 1, 2, 3); set(c, 6, 2, 3); set(c, 1, 5, 3); set(c, 6, 5, 3);
      for (let y = 1; y <= 6; y++) { set(c, 3, y, 1); set(c, 4, y, 1); }
      set(c, 2, 0, 1); set(c, 5, 0, 1);
      break;
    default:
      for (let i = 0; i < 64; i++) c[i] = 2;
  }
  return c;
}

/** Deterministic variants of a tile so a floor does not repeat as a perfect grid. */
export function tileVariant(spec: SpriteSpec, x: number, y: number, count = 3): SpriteSpec {
  const i = (hash(`${x},${y}`) % count) + 1;
  return { ...spec, seed: `${spec.seed}#${i}` };
}
