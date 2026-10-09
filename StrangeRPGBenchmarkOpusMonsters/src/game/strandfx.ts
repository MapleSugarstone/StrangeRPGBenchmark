// Shared visual state for the Strand, written by Act 2 content and drawn by the field and its effects.
export interface StarRing { x: number; y: number; r: number }
export interface Landing { x: number; y: number; t: number }

export const strandFx = {
  /** Lit circles on a ring-fogged map, in tiles. Content shrinks and removes them. */
  rings: [] as StarRing[],
  /** Frames left of the Gleaner's shadow crossing the screen at low water. */
  shadow: 0,
  /** Stars landing in a line during the low-water walk, in tiles, with a frame count since landing. */
  landings: [] as Landing[],
  /** Footprints shown before their stars land, once Ouro reads the tide table. In tiles. */
  marks: [] as [number, number][],
};

/** Whether a tile shows on a ring-fogged map: inside a ring, or within one tile of Ouro. */
export function ringLit(tx: number, ty: number, ox: number, oy: number): boolean {
  if (Math.abs(tx - ox) <= 1 && Math.abs(ty - oy) <= 1) return true;
  return strandFx.rings.some(r => (tx - r.x) ** 2 + (ty - r.y) ** 2 <= r.r * r.r);
}
