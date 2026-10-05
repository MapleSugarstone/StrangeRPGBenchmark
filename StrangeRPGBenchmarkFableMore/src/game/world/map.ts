import type { ColorName } from "../../engine/palette";
import type { Mood } from "../../engine/audio";
import type { SpriteRef } from "../types";
import { getSprite, type Cells } from "../../engine/sprites";
import { hash } from "../../engine/rng";

export type Facing = "up" | "down" | "left" | "right";

export interface TileSpec {
  /** Sprite tile variant. */
  variant: string;
  a: ColorName;
  b: ColorName;
  /** Can the party walk here. */
  walk: boolean;
  /** Only the slack can walk here (under a roof, in a cave). */
  slackOnly?: boolean;
  /** Draw this tile over a ground tile. */
  overlay?: boolean;
  /** A ground variant to draw under an overlay. */
  under?: string;
  /** Lines are hidden behind this tile (a solid roof). */
  roof?: boolean;
  /** Number of texture variants to pick from by position. */
  variants?: number;
}

export interface Theme {
  ground: { a: ColorName; b: ColorName; variant: string };
  alt: { a: ColorName; b: ColorName; variant: string };
  wall: { a: ColorName; b: ColorName; variant: string };
  water: { a: ColorName; b: ColorName; variant?: string };
  tree: { a: ColorName; b: ColorName };
  /** Line color for held people on this map. */
  line: ColorName;
  sky: ColorName;
  /** The underside of the Hull shows above the map, with drips. */
  hull?: boolean;
  /** A color wash over the whole map, for light. */
  tint?: { c: ColorName; t: number };
}

export const THEMES: Record<string, Theme> = {
  hem: { ground: { a: "moss", b: "pine", variant: "grassd" }, alt: { a: "clay", b: "sand", variant: "sandd" }, wall: { a: "slate", b: "ash", variant: "wall" }, water: { a: "sea", b: "ink", variant: "waterd" }, tree: { a: "pine", b: "leaf" }, line: "bone", sky: "ink", hull: true, tint: { c: "ink", t: 0.12 } },
  slat: { ground: { a: "olive", b: "moss", variant: "grassd" }, alt: { a: "sand", b: "clay", variant: "sandd" }, wall: { a: "clay", b: "rust", variant: "wall" }, water: { a: "sea", b: "ink", variant: "waterd" }, tree: { a: "olive", b: "leaf" }, line: "bone", sky: "ink", hull: true, tint: { c: "amber", t: 0.08 } },
  snarl: { ground: { a: "plum", b: "ink", variant: "sandd" }, alt: { a: "brick", b: "plum", variant: "plank" }, wall: { a: "brick", b: "rose", variant: "wall" }, water: { a: "plum", b: "ink", variant: "waterd" }, tree: { a: "plum", b: "rose" }, line: "rose", sky: "ink", hull: true, tint: { c: "plum", t: 0.15 } },
  letout: { ground: { a: "clay", b: "sand", variant: "sandd" }, alt: { a: "slate", b: "coal", variant: "plank" }, wall: { a: "slate", b: "gold", variant: "wall" }, water: { a: "sea", b: "ink", variant: "waterd" }, tree: { a: "olive", b: "sand" }, line: "gold", sky: "ink", hull: true, tint: { c: "gold", t: 0.06 } },
  steppe: { ground: { a: "sand", b: "olive", variant: "grassd" }, alt: { a: "clay", b: "sand", variant: "sandd" }, wall: { a: "clay", b: "bone", variant: "wall" }, water: { a: "sea", b: "ink", variant: "waterd" }, tree: { a: "olive", b: "gold" }, line: "bone", sky: "ink", hull: true },
  under: { ground: { a: "coal", b: "ink", variant: "crack" }, alt: { a: "plum", b: "coal", variant: "scrap" }, wall: { a: "slate", b: "coal", variant: "wall" }, water: { a: "ink", b: "sea", variant: "waterd" }, tree: { a: "plum", b: "mint" }, line: "ash", sky: "black", tint: { c: "sea", t: 0.1 } },
  stays: { ground: { a: "slate", b: "coal", variant: "crack" }, alt: { a: "coal", b: "ink", variant: "scrap" }, wall: { a: "ink", b: "teal", variant: "wall" }, water: { a: "ink", b: "teal", variant: "waterd" }, tree: { a: "pine", b: "teal" }, line: "teal", sky: "black", tint: { c: "teal", t: 0.08 } },
  loft: { ground: { a: "moss", b: "frost", variant: "deck" }, alt: { a: "ink", b: "indigo", variant: "lattice" }, wall: { a: "indigo", b: "frost", variant: "wall" }, water: { a: "indigo", b: "ink", variant: "waterd" }, tree: { a: "frost", b: "lilac" }, line: "white", sky: "ink", tint: { c: "frost", t: 0.1 } },
  night: { ground: { a: "moss", b: "ink", variant: "grassd" }, alt: { a: "slate", b: "ink", variant: "sandd" }, wall: { a: "slate", b: "ash", variant: "wall" }, water: { a: "ink", b: "sea", variant: "waterd" }, tree: { a: "pine", b: "moss" }, line: "bone", sky: "black", tint: { c: "indigo", t: 0.22 } },
  indoor: { ground: { a: "clay", b: "sand", variant: "plank" }, alt: { a: "brick", b: "clay", variant: "floor" }, wall: { a: "rust", b: "clay", variant: "wall" }, water: { a: "sea", b: "ink", variant: "waterd" }, tree: { a: "pine", b: "leaf" }, line: "bone", sky: "black", hull: true, tint: { c: "amber", t: 0.1 } },
};

/** Tile codes shared by every map. Themes color the ground, walls, water and trees. */
export function tileSpec(code: string, theme: Theme): TileSpec {
  switch (code) {
    case ".": return { variant: theme.ground.variant, a: theme.ground.a, b: theme.ground.b, walk: true, variants: 4 };
    case ",": return { variant: theme.alt.variant, a: theme.alt.a, b: theme.alt.b, walk: true, variants: 4 };
    case "#": return { variant: theme.wall.variant, a: theme.wall.a, b: theme.wall.b, walk: false };
    case "~": return { variant: theme.water.variant ?? "water", a: theme.water.a, b: theme.water.b, walk: false, variants: 3 };
    case "T": return { variant: "tree", a: theme.tree.a, b: theme.tree.b, walk: false, overlay: true, under: "." };
    case "b": return { variant: "bush", a: theme.tree.a, b: theme.tree.b, walk: false, overlay: true, under: "." };
    case "r": return { variant: "rock", a: "ash", b: "slate", walk: false, overlay: true, under: "." };
    case "=": return { variant: "bridge", a: "clay", b: "sand", walk: true };
    case "D": return { variant: "door", a: theme.wall.a, b: "gold", walk: true };
    case "S": return { variant: "stairs", a: "ash", b: "slate", walk: true };
    case "^": return { variant: "cliff", a: "clay", b: "ash", walk: false };
    case " ": return { variant: "void", a: "black", b: theme.sky, walk: false };
    case "|": return { variant: "slat", a: theme.wall.a, b: theme.wall.b, walk: false, variants: 1 };
    case "/": return { variant: "roofedge", a: theme.wall.a, b: theme.wall.b, walk: false };
    case "f": return { variant: "floor", a: "clay", b: "sand", walk: true };
    case "W": return { variant: "wall", a: "rust", b: "clay", walk: false };
    case "t": return { variant: "table", a: "clay", b: "sand", walk: false, overlay: true, under: "f" };
    case "B": return { variant: "bed", a: "sea", b: "salt", walk: false, overlay: true, under: "f" };
    case "c": return { variant: "counter", a: "clay", b: "bone", walk: false, overlay: true, under: "f" };
    case "s": return { variant: "sign", a: "clay", b: "bone", walk: false, overlay: true, under: "." };
    case "P": return { variant: "pillar", a: "ash", b: "bone", walk: false, overlay: true, under: "," };
    case "C": return { variant: "coil", a: "teal", b: "bone", walk: true, overlay: true, under: "." };
    case "n": return { variant: "net", a: "clay", b: "sand", walk: true, overlay: true, under: "," };
    case "F": return { variant: "frost", a: "frost", b: "salt", walk: true, variants: 4 };
    case "G": return { variant: "lattice", a: "indigo", b: "frost", walk: true, variants: 1 };
    case "g": return { variant: "glass", a: "sky", b: "frost", walk: false };
    case "K": return { variant: "cable", a: "slate", b: "teal", walk: false, overlay: true, under: "," };
    case "M": return { variant: "machine", a: "slate", b: "amber", walk: false };
    case "w": return { variant: "well", a: "ash", b: "sea", walk: false, overlay: true, under: "." };
    case "V": return { variant: "save", a: "gold", b: "white", walk: true, overlay: true, under: "." };
    case "x": return { variant: "flower", a: theme.ground.a, b: "rose", walk: true, variants: 3 };
    case "p": return { variant: "pool", a: theme.water.a, b: theme.water.b, walk: true, variants: 3 };
    case "h": return { variant: "shelf", a: "clay", b: "bone", walk: false, overlay: true, under: "f" };
    case "Z": return { variant: "spindle", a: "slate", b: "gold", walk: false, overlay: true, under: "," };
    case "U": return { variant: "cave", a: "coal", b: "slate", walk: true, slackOnly: true, roof: true, variants: 4 };
    case "u": return { variant: "wall", a: "coal", b: "slate", walk: false, roof: true };
    case "o": return { variant: "fence", a: "clay", b: "bone", walk: false, overlay: true, under: "." };
    case "_": return { variant: theme.ground.variant, a: theme.ground.a, b: theme.ground.b, walk: true, slackOnly: true, roof: true, variants: 4 };
    case "H": return { variant: "hang", a: "bone", b: "lilac", walk: false, overlay: true, under: "G" };
    case "R": return { variant: "rod", a: "bone", b: "gold", walk: false, overlay: true, under: "F" };
    case "J": return { variant: "chair", a: "indigo", b: "frost", walk: false, overlay: true, under: "F" };
    case "Y": return { variant: "bones", a: "coal", b: "bone", walk: true, overlay: true, under: "." };
    default: return { variant: theme.ground.variant, a: theme.ground.a, b: theme.ground.b, walk: true, variants: 4 };
  }
}

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  sprite: SpriteRef;
  name?: string;
  /** Held people have a line. */
  held?: boolean;
  /** Pluck note for the Hand. */
  note?: string;
  /** Script id to run on talk. */
  talk?: string;
  /** Walks around nearby. */
  wander?: boolean;
  /** Hidden until a flag is set, or hidden when a flag is set. */
  showIf?: string;
  hideIf?: string;
  facing?: Facing;
  /** Blocks movement. Default true. */
  solid?: boolean;
}

export interface TriggerDef {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Fires when stepped on, or when interacted with (facing). */
  on: "enter" | "interact";
  once?: boolean;
  showIf?: string;
  hideIf?: string;
}

export interface ExitDef {
  x: number;
  y: number;
  w?: number;
  h?: number;
  to: string;
  tx: number;
  ty: number;
  facing?: Facing;
  /** The exit only works once a flag is set. */
  needs?: string;
  /** Message when blocked. */
  blocked?: string;
}

export interface WanderDef {
  groups: string[];
  count: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Sprite for the field enemy. */
  sprite: SpriteRef;
  hideIf?: string;
}

export interface ChestDef {
  x: number;
  y: number;
  item: string;
  count?: number;
  slugs?: number;
  id: string;
}

export interface MapDef {
  id: string;
  name: string;
  theme: string;
  rows: string[];
  music: Mood;
  /** Seed for the tune. Defaults to the id. */
  musicSeed?: string;
  npcs: NpcDef[];
  triggers: TriggerDef[];
  exits: ExitDef[];
  wander?: WanderDef[];
  chests?: ChestDef[];
  /** The fallen line's path across this map, tile coordinates. */
  line?: [number, number][];
  /** No lines drawn above sprites (a solid roof or the Under). */
  noLines?: boolean;
  /** Where held party members stop. */
  slackOnly?: boolean;
  /** Dark map: only a radius around Fathom is lit. */
  dark?: boolean;
  /** Draw the Loft lattice in the sky instead of plain lines. */
  loft?: boolean;
  /** A short line shown under the chapter card when entering. */
  caption?: string;
  /** Every line on this map runs to one point above the map (tile coordinates), the way a tangle would. */
  converge?: [number, number];
  /** Lasting marks on tiles, such as the crack a Lift leaves in a square. */
  marks?: { kind: "crack"; x: number; y: number; showIf?: string }[];
}

/** Short effects a script can start on a tile. */
export type FieldFx = "crack" | "fall" | "rings" | "bell";

export class GameMap {
  readonly w: number;
  readonly h: number;
  readonly theme: Theme;
  private specs = new Map<string, TileSpec>();
  constructor(readonly def: MapDef) {
    this.h = def.rows.length;
    this.w = Math.max(...def.rows.map((r) => r.length));
    this.theme = THEMES[def.theme] ?? THEMES.hem;
  }
  code(x: number, y: number): string {
    if (x < 0 || y < 0 || y >= this.h) return " ";
    const row = this.def.rows[y];
    return x < row.length ? row[x] : " ";
  }
  spec(x: number, y: number): TileSpec {
    const c = this.code(x, y);
    let s = this.specs.get(c);
    if (!s) {
      s = tileSpec(c, this.theme);
      this.specs.set(c, s);
    }
    return s;
  }
  walkable(x: number, y: number, slack: boolean): boolean {
    const s = this.spec(x, y);
    if (!s.walk) return false;
    if (s.slackOnly && !slack) return false;
    return true;
  }
  /** Cells for the tile at a position, varied by position for texture. */
  cells(x: number, y: number): { cells: Cells; a: ColorName; b: ColorName; under?: { cells: Cells; a: ColorName; b: ColorName } } {
    const s = this.spec(x, y);
    const v = s.variants ?? 1;
    const seed = v > 1 ? `${hash(`${x},${y}`) % v}` : "0";
    const cells = getSprite("tile", seed, s.variant);
    let under: { cells: Cells; a: ColorName; b: ColorName } | undefined;
    if (s.overlay && s.under) {
      const us = tileSpec(s.under, this.theme);
      under = { cells: getSprite("tile", `${hash(`${x},${y}`) % (us.variants ?? 1)}`, us.variant), a: us.a, b: us.b };
    }
    return { cells, a: s.a, b: s.b, under };
  }
}

/** Build map rows from a template, replacing characters. Keeps authoring compact. */
export function rows(...lines: string[]): string[] {
  return lines;
}
