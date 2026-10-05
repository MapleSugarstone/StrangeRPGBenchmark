import type { SpriteSpec } from "../../engine/sprites";
import type { ColorName } from "../../engine/palette";
import type { Entity, MapDef } from "../world/map";
import { generateCave, openCells } from "../world/map";
import type { Rng } from "../../engine/rng";

export const npc = (seed: string, a: ColorName, b: ColorName): SpriteSpec => ({ kind: "humanoid", seed, a, b });
export const creature = (seed: string, a: ColorName, b: ColorName): SpriteSpec => ({ kind: "creature", seed, a, b });
export const prop = (seed: string, a: ColorName, b: ColorName, variant = "gem"): SpriteSpec => ({ kind: "item", seed, a, b, variant });
export const shape = (seed: string, a: ColorName, b: ColorName, variant: string): SpriteSpec => ({ kind: "shape", seed, a, b, variant });
export const chest = (): SpriteSpec => ({ kind: "shape", seed: "chest", a: "brown", b: "yellow", variant: "box" });
export const lampSprite = (): SpriteSpec => ({ kind: "item", seed: "rest-lamp", a: "yellow", b: "orange", variant: "tool" });
export const stairsSprite = (dark = false): SpriteSpec => ({ kind: "tile", seed: "stairs", a: dark ? "dark" : "gray", b: "salt", variant: "stairs" });

/** One legend for every authored map so the ASCII art reads the same everywhere. */
export const LEGEND: Record<string, string> = {
  " ": "void", ".": "floor", "#": "wall", "X": "darkwall", "x": "cellar", "T": "tree", "t": "deadtree", ",": "field", "g": "grass",
  "=": "saltpath", "p": "path", "s": "salt", "~": "water", "W": "deep", "D": "door", "L": "lamp", "b": "bed", "c": "counter",
  "S": "stairs", "P": "pillar", "C": "crystal", "r": "rock", "G": "glass", "H": "glasswall", "k": "circuit", "K": "circuitwall",
  "q": "grid", "o": "bone", "l": "lava", "e": "ember", "a": "carpet", "u": "church", "n": "paper", "N": "shelf", "m": "map", "M": "mapwall",
  "w": "marble", "V": "toothwall", "h": "hour", "I": "hourwall", "j": "stage", "J": "stagewall", "y": "loom", "Y": "loomwall", "B": "bridge",
};

export interface CaveOpts {
  id: string; name: string; chapter: number; floor: string; wall: string; w?: number; h?: number; fill?: number;
  encounters?: string; encounterRate?: number; outside?: ColorName; decor?: string; decorCount?: number;
  /** Builds entities from the open cells. Cells are sorted by distance from the entrance. */
  place: (cells: [number, number][], rng: Rng) => Entity[];
}

/** Generated cave with an entrance at the top left and entities placed by distance. */
export function cave(o: CaveOpts): MapDef {
  return {
    id: o.id, name: o.name, chapter: o.chapter, outside: o.outside ?? "black", legend: LEGEND,
    encounters: o.encounters, encounterRate: o.encounterRate ?? 0.09, grid: [], entities: [],
    generate(rng) {
      const w = o.w ?? 30, h = o.h ?? 22;
      const grid = generateCave(rng, w, h, o.floor, o.wall, o.fill ?? 0.44);
      const rows = grid.map((r) => r.split(""));
      for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) rows[y][x] = o.floor;
      let cells = openCells(rows.map((r) => r.join("")), o.floor, 2, 2);
      if (o.decor) {
        let n = 0;
        for (const [x, y] of rng.shuffle([...cells])) {
          if (n >= (o.decorCount ?? 10)) break;
          if (Math.hypot(x - 2, y - 2) < 4) continue;
          const nearWall = rows[y - 1]?.[x] === o.wall || rows[y + 1]?.[x] === o.wall;
          if (nearWall && rng.chance(0.3)) { rows[y][x] = o.decor; n++; }
        }
        cells = openCells(rows.map((r) => r.join("")), o.floor, 2, 2);
      }
      return { grid: rows.map((r) => r.join("")), entities: o.place(cells, rng) };
    },
  };
}

export function at(cells: [number, number][], frac: number): [number, number] {
  return cells[Math.max(0, Math.min(cells.length - 1, Math.floor(cells.length * frac)))];
}
