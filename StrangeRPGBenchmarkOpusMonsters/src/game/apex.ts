// The moon over the Apex. Every outdoor Volute map has a place on the world map, and its moon stands toward the Apex from there.
import type { MapDef } from './world';

/** Map positions in the world map's pixels (Notes/shots/world-map.png shown 2000 wide), x east and y south. Maps not listed keep the moon of their sky. */
export const WORLD_POS: Record<string, [number, number]> = {
  fellside: [1065, 1440], cocklecove: [1175, 1595], route1: [928, 1570], brookwood: [958, 1340], rib: [790, 1420], knucklebones: [670, 1575],
  longway: [1283, 1490],
  route2: [565, 1425], highwater: [725, 1285], wrecks: [483, 1500], mast: [548, 1255], shoreline: [375, 1285],
  route3: [608, 1095], saltings: [400, 1125], spire: [490, 950], shoutwood: [668, 975],
  route4: [630, 825], kelpbeds: [440, 715], bole: [635, 640], rootfall: [520, 490],
  route5: [835, 630], gantry: [745, 440], hum: [965, 510], skinfall: [780, 780],
  route6: [1110, 640], floes: [1215, 445], tusk: [1300, 640], iceshelf: [1050, 695],
  route7: [1310, 840], shingle: [1505, 755], moonwater: [1245, 955], hilt: [1440, 985], battlefield: [1130, 840],
  route8: [1315, 1125], glassdesert: [1510, 1205], fall: [1315, 1305], climb: [1240, 1215],
  slack: [965, 210], margin: [1145, 145], oldrind: [800, 130],
  gatering: [965, 985],
};

/** The Apex in the middle of the world map. */
export const APEX: [number, number] = [965, 985];
/** The moon circles a point over the Apex this far out, once every six hours of play, so a return visit casts slightly different shadows. */
const DRIFT = 40, LAP = 6 * 3600;
/** On a map that holds the foot of the Apex, one tile is this many world map pixels. */
const RING_SCALE = 8;

/** Where the moon stands over the world map after this many seconds of play. */
export function moonAt(time: number): [number, number] {
  const a = (time / LAP) * Math.PI * 2;
  return [APEX[0] + Math.cos(a) * DRIFT, APEX[1] + Math.sin(a) * DRIFT];
}

const unit = (x: number, y: number): [number, number] => { const n = Math.hypot(x, y) || 1; return [x / n, y / n]; };

/** The way toward the moon on screen from anywhere on this map, as a unit vector, or null for a map that keeps its sky's moon. */
export function moonToward(m: MapDef, time: number): [number, number] | null {
  const p = WORLD_POS[m.id];
  if (!p || m.indoor || m.dark || m.strand) return null;
  const mo = moonAt(time);
  return unit(mo[0] - p[0], mo[1] - p[1]);
}

/** On a map round the foot of the Apex, the way toward the moon from one tile, since the moon stands over the middle of the map. */
export function moonTowardTile(m: MapDef, time: number, tx: number, ty: number): [number, number] | null {
  if (!m.apexTile) return null;
  const mo = moonAt(time);
  const wx = APEX[0] + (tx - m.apexTile[0]) * RING_SCALE, wy = APEX[1] + (ty - m.apexTile[1]) * RING_SCALE;
  return unit(mo[0] - wx, mo[1] - wy);
}
