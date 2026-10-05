import type { SpriteSpec } from "../../engine/sprites";

export interface TileDef {
  id: string;
  sprite: SpriteSpec;
  solid: boolean;
  /** Number of seeded variants so floors do not tile as an obvious grid. */
  variants: number;
  /** Random encounters can happen here. */
  wild: boolean;
}

const t = (id: string, variant: string, a: SpriteSpec["a"], b: SpriteSpec["b"], solid = false, wild = false, variants = 3): TileDef => ({
  id, sprite: { kind: "tile", seed: id, a, b, variant }, solid, variants, wild,
});

export const TILES: Record<string, TileDef> = Object.fromEntries(
  [
    t("grass", "grass", "green", "lime", false, true),
    t("field", "grass", "lime", "green", false, true),
    t("sand", "sand", "yellow", "orange", false, true),
    t("salt", "salt", "salt", "white", false, true),
    t("saltpath", "sand", "salt", "gray", false, false),
    t("path", "sand", "brown", "gray", false, false),
    t("floor", "stone", "gray", "dark", false, false),
    t("cellar", "stone", "dark", "gray", false, true),
    t("wall", "wall", "gray", "dark", true),
    t("rock", "stone", "brown", "dark", true),
    t("darkwall", "wall", "dark", "gray", true),
    t("water", "water", "blue", "salt", true),
    t("deep", "water", "indigo", "blue", true),
    t("void", "void", "black", "dark", true, false, 4),
    t("tree", "tree", "green", "lime", true),
    t("deadtree", "tree", "brown", "orange", true),
    t("pillar", "pillar", "gray", "salt", true, false, 1),
    t("stairs", "stairs", "gray", "salt", false, false, 1),
    t("door", "door", "brown", "yellow", false, false, 1),
    t("crystal", "crystal", "dark", "teal", true),
    t("glass", "glass", "salt", "teal", false, true),
    t("glasswall", "glass", "teal", "white", true),
    t("circuit", "circuit", "dark", "teal", false, true),
    t("circuitwall", "circuit", "gray", "teal", true),
    t("grid", "grid", "dark", "indigo", false, false),
    t("bone", "bone", "salt", "gray", false, true),
    t("lava", "lava", "red", "orange", true),
    t("ember", "lava", "orange", "yellow", false, true),
    t("carpet", "noise", "purple", "indigo", false, false),
    t("church", "stone", "salt", "purple", false, true),
    t("paper", "noise", "white", "salt", false, true),
    t("shelf", "wall", "brown", "white", true),
    t("map", "grid", "salt", "green", false, true),
    t("mapwall", "wall", "green", "salt", true),
    t("marble", "stone", "white", "gray", false, true),
    t("toothwall", "wall", "white", "gray", true),
    t("hour", "grid", "dark", "teal", false, true),
    t("hourwall", "crystal", "dark", "teal", true),
    t("stage", "noise", "indigo", "purple", false, true),
    t("stagewall", "wall", "indigo", "white", true),
    t("loom", "circuit", "white", "yellow", false, true),
    t("loomwall", "circuit", "yellow", "white", true),
    t("counter", "wall", "brown", "yellow", true),
    t("bed", "noise", "red", "salt", true, false, 1),
    t("lamp", "crystal", "dark", "yellow", true, false, 1),
    t("bridge", "wall", "brown", "brown", false, false, 1),
  ].map((d) => [d.id, d]),
);

export function tile(id: string): TileDef {
  const d = TILES[id];
  if (!d) throw new Error(`unknown tile ${id}`);
  return d;
}
