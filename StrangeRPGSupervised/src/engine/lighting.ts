// Field lighting. Light is hard-edged: walls, pillars, and people cast solid shadows from every source. Lit ground
// keeps its color (pulled toward a colored light's hue), half-lit ground steps one shade down its own hue, and dark
// ground becomes void crossed by diagonal hatch lines of its darkest shade. Glowing tiles keep their color, and
// sprites only ever step one shade down, so people stay readable. Every color stays in PALETTE.
import { buffer } from "./screen.js";
import { PALETTE } from "./palette.js";
import { MapData, TILE_SIZE, tileInfo } from "./maps.js";
import { Sprite } from "./sprite.js";

export type Light = { x: number; y: number; r: number; color: [number, number, number]; power: number };

const W = 192, H = 192, CELL = 4;
const MARGIN = 8; // Tiles beyond the screen whose lights still reach it.

const rgb = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const luma = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const dist = (a: number[], b: number[]) => {
  const rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
};
const nearest = (c: number[], among: number[]) => among.reduce((best, i) => (dist(c, rgb[i]) < dist(c, rgb[best]) ? i : best), among[0]);
const ALL = rgb.map((_, i) => i);
// One shade down a color's own hue: the nearest darker palette color to it at 60% brightness, or the void.
const DOWN = rgb.map((c, i) => {
  const darker = ALL.filter((j) => j !== i && luma(rgb[j]) < luma(c) * 0.85);
  return darker.length ? nearest(c.map((v) => v * 0.6), darker) : 0;
});
const VOID = 0;
const indexOf = new Map<number, number>();
rgb.forEach((c, i) => { const k = (c[0] << 16) | (c[1] << 8) | c[2]; if (!indexOf.has(k)) indexOf.set(k, i); });
const LUT = new Uint8Array(32 * 32 * 32);
for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++)
  LUT[(r << 10) | (g << 5) | b] = nearest([r * 8 + 4, g * 8 + 4, b * 8 + 4], ALL);
const snap = (r: number, g: number, b: number) =>
  LUT[(Math.min(255, Math.max(0, r)) >> 3 << 10) | (Math.min(255, Math.max(0, g)) >> 3 << 5) | (Math.min(255, Math.max(0, b)) >> 3)];

/** The light each glowing tile gives, by its TILES glow name. */
const GLOWS: Record<string, { r: number; color: [number, number, number]; power: number }> = {
  dregs: { r: 3.2, color: [1.0, 0.55, 0.25], power: 0.95 },
  crack: { r: 1.6, color: [1.0, 0.6, 0.3], power: 0.55 },
  lamp: { r: 5.0, color: [1.0, 0.85, 0.6], power: 1.0 },
  glass: { r: 2.6, color: [0.55, 0.95, 1.0], power: 0.8 },
  void: { r: 2.8, color: [0.75, 0.45, 1.0], power: 0.85 },
  ember: { r: 2.4, color: [1.0, 0.4, 0.2], power: 0.8 },
  moss: { r: 2.2, color: [0.55, 1.0, 0.55], power: 0.7 },
};

/** The light a glowing tile of this kind gives at a screen point, or null for an unknown kind. */
export function glowLight(glow: string, x: number, y: number): Light | null {
  const g = GLOWS[glow];
  return g ? { x, y, r: g.r * TILE_SIZE, color: g.color, power: g.power } : null;
}

/** The color of the light the lead Ruin carries, by its first type. */
export const TYPE_LIGHT: Record<string, [number, number, number]> = {
  Stone: [1.0, 0.95, 0.85], Metal: [0.75, 0.85, 1.0], Aether: [0.6, 1.0, 1.0],
  Wood: [0.7, 1.0, 0.6], Fire: [1.0, 0.7, 0.35], Void: [0.8, 0.55, 1.0],
};

/** How much light reaches a map with no source nearby, by the map name's start. */
const AMBIENT: [string, number, [number, number, number]][] = [
  ["ashen_reach_heart", 0.33, [0.9, 0.8, 1.0]],
  ["ashen_reach", 0.36, [0.85, 0.85, 1.0]],
  ["silica_hollow", 0.34, [0.75, 0.9, 1.0]],
  // The Dregs are darker; Shard's lead Ruin carries the light.
  // Night in the Abyssal Trench, where Starfall comes down.
  ["the_dregs_trench", 0.28, [0.65, 0.7, 1.0]],
  ["the_dregs", 0.3, [0.85, 0.75, 1.0]],
  ["", 0.4, [1, 1, 1]],
];

const blocksLight = (map: MapData, tx: number, ty: number) => {
  const t = tileInfo(map, tx, ty);
  return !t || (!t.walk && !t.glow);
};

export type LightField = { level: Float32Array; hue: Float32Array; camX: number; camY: number };

/** Computes the light over the screen for a map seen from camX, camY, with the given moving lights and occluders. */
export function computeLight(map: MapData, camX: number, camY: number, movers: Light[], occluders: [number, number][], t: number): LightField {
  const amb = AMBIENT.find(([p]) => p === "" || mapIdOf(map).startsWith(p))!;
  const level = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { level[i * 3] = amb[1] * amb[2][0]; level[i * 3 + 1] = amb[1] * amb[2][1]; level[i * 3 + 2] = amb[1] * amb[2][2]; }
  const tx0 = Math.floor(camX / TILE_SIZE) - MARGIN, ty0 = Math.floor(camY / TILE_SIZE) - MARGIN;
  const tw = 24 + MARGIN * 2 + 1, th = 24 + MARGIN * 2 + 1;
  const solid = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) solid[y * tw + x] = blocksLight(map, tx0 + x, ty0 + y) ? 1 : 0;
  for (const [ox, oy] of occluders) { const x = ox - tx0, y = oy - ty0; if (x >= 0 && y >= 0 && x < tw && y < th) solid[y * tw + x] = 2; }
  const lights: Light[] = [...movers];
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const glow = tileInfo(map, tx0 + x, ty0 + y)?.glow;
    if (!glow || !GLOWS[glow]) continue;
    // Only the edge of a pool shines, so a lake is not a hundred lights.
    const same = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => tileInfo(map, tx0 + x + dx, ty0 + y + dy)?.glow === glow);
    if (same) continue;
    const g = GLOWS[glow];
    const breathe = 0.9 + 0.1 * Math.cos(t * 1.3 + (tx0 + x) * 0.7 + (ty0 + y) * 1.1);
    lights.push({ x: (tx0 + x + 0.5) * TILE_SIZE, y: (ty0 + y + 0.5) * TILE_SIZE, r: g.r * TILE_SIZE, color: g.color, power: g.power * breathe });
  }
  // Every exit gives off a pale light that breathes, so the way on shows in the dark.
  for (const w of map.warps ?? []) {
    lights.push({ x: (w.x + 0.5) * TILE_SIZE, y: (w.y + 0.5) * TILE_SIZE, r: 2.6 * TILE_SIZE, color: [0.8, 0.9, 1.0], power: 0.85 + 0.15 * Math.cos(t * 2.2) });
  }
  for (const L of lights) {
    const ltx = Math.floor(L.x / TILE_SIZE) - tx0, lty = Math.floor(L.y / TILE_SIZE) - ty0;
    const x0 = Math.max(0, Math.floor((L.x - L.r - camX) / CELL)), x1 = Math.min(W / CELL - 1, Math.floor((L.x + L.r - camX) / CELL));
    const y0 = Math.max(0, Math.floor((L.y - L.r - camY) / CELL)), y1 = Math.min(H / CELL - 1, Math.floor((L.y + L.r - camY) / CELL));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const px = camX + cx * CELL + CELL / 2, py = camY + cy * CELL + CELL / 2;
      const dx = px - L.x, dy = py - L.y, d2 = dx * dx + dy * dy;
      if (d2 > L.r * L.r) continue;
      // Hard shadow: step along the line in half tiles and stop at the first solid tile that is not the target's own.
      const ttx = Math.floor(px / TILE_SIZE) - tx0, tty = Math.floor(py / TILE_SIZE) - ty0;
      const steps = Math.ceil(Math.sqrt(d2) / (CELL));
      let lit = true;
      for (let s = 1; s < steps; s++) {
        const sx = Math.floor((L.x + (dx * s) / steps) / TILE_SIZE) - tx0, sy = Math.floor((L.y + (dy * s) / steps) / TILE_SIZE) - ty0;
        if ((sx === ltx && sy === lty) || (sx === ttx && sy === tty)) continue;
        if (sx >= 0 && sy >= 0 && sx < tw && sy < th && solid[sy * tw + sx]) { lit = false; break; }
      }
      if (!lit) continue;
      const f = 1 - d2 / (L.r * L.r), k = f * f * L.power;
      for (let yy = 0; yy < CELL; yy++) for (let xx = 0; xx < CELL; xx++) {
        const i = ((cy * CELL + yy) * W + cx * CELL + xx) * 3;
        level[i] += k * L.color[0]; level[i + 1] += k * L.color[1]; level[i + 2] += k * L.color[2];
      }
    }
  }
  return { level, hue: level, camX, camY };
}

let mapIds = new WeakMap<MapData, string>();
/** Records each map's name, since MapData does not carry it. */
export function nameMaps(maps: Record<string, MapData>): void {
  for (const [id, m] of Object.entries(maps)) mapIds.set(m, id);
}
const mapIdOf = (m: MapData) => mapIds.get(m) ?? "";

/** Shades the ground already drawn in the buffer. Glowing tiles keep their color. */
export function shadeWorld(field: LightField, map: MapData): void {
  shadeRows(field, 0, H, (x, y) => !!tileInfo(map, Math.floor((field.camX + x) / TILE_SIZE), Math.floor((field.camY + y) / TILE_SIZE))?.glow);
}

/** A battle's light: the island's ambient light plus each Ruin's own light, with nothing to cast shadows. */
export function battleLight(mapId: string, lights: Light[]): LightField {
  const amb = AMBIENT.find(([p]) => p === "" || mapId.startsWith(p))!;
  const level = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    let r = amb[1] * amb[2][0], g = amb[1] * amb[2][1], b = amb[1] * amb[2][2];
    for (const L of lights) {
      const d2 = (x - L.x) ** 2 + (y - L.y) ** 2;
      if (d2 >= L.r * L.r) continue;
      const f = 1 - d2 / (L.r * L.r), k = f * f * L.power;
      r += k * L.color[0]; g += k * L.color[1]; b += k * L.color[2];
    }
    level[i] = r; level[i + 1] = g; level[i + 2] = b;
  }
  return { level, hue: level, camX: 0, camY: 0 };
}

/** Shades screen rows y0 to y1 of the buffer by the light field, leaving pixels that keep reports true for. */
export function shadeRows(field: LightField, y0: number, y1: number, keep: (x: number, y: number) => boolean = () => false): void {
  const d = buffer.data, lv = field.level;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (keep(x, y)) continue;
    const p = (y * W + x) * 4, i = (y * W + x) * 3;
    const r = lv[i], g = lv[i + 1], b = lv[i + 2], m = Math.max(r, g, b);
    const k = indexOf.get((d[p] << 16) | (d[p + 1] << 8) | d[p + 2]) ?? snap(d[p], d[p + 1], d[p + 2]);
    let out: number;
    if (m >= 0.62) {
      // Lit: a colored light pulls the color toward its hue.
      const hr = r / m, hg = g / m, hb = b / m, sat = 1 - Math.min(hr, hg, hb);
      if (sat > 0.2) {
        const c = rgb[k], lift = luma(c) * 1.1 + 30, mix = Math.min(0.65, sat * 0.9);
        out = snap(c[0] + (lift * hr - c[0]) * mix, c[1] + (lift * hg - c[1]) * mix, c[2] + (lift * hb - c[2]) * mix);
      } else out = k;
    } else if (m >= 0.3) {
      // A color already near black keeps itself rather than vanishing.
      const base = DOWN[k] || k;
      out = ((x + y) & 3) === 0 ? DOWN[base] || base : base;
    } else {
      out = ((x - y) & 3) === 0 && m >= 0.1 ? DOWN[k] || k : VOID;
    }
    const c = rgb[out];
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2];
  }
}

/** The light level at a world point, for shading a sprite drawn there. */
export function lightAt(field: LightField, wx: number, wy: number): number {
  const x = Math.round(wx - field.camX), y = Math.round(wy - field.camY);
  if (x < 0 || y < 0 || x >= W || y >= H) return 1;
  const i = (y * W + x) * 3;
  return Math.max(field.level[i], field.level[i + 1], field.level[i + 2]);
}

const shaded = new Map<Sprite, Sprite>();
/** The sprite one shade darker, for people standing in shadow. They never go darker than that. */
export function inShadow(s: Sprite): Sprite {
  let out = shaded.get(s);
  if (!out) {
    out = { ...s, colors: s.colors.map((h) => { const k = indexOf.get(parseInt(h.slice(1), 16)); return k === undefined ? h : PALETTE[DOWN[k] || k]; }) };
    shaded.set(s, out);
  }
  return out;
}
