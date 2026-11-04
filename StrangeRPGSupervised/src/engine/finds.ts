// Side-map finds: one thing on the ground per side map, taken once by stepping on it.
import type { MapData } from "./maps.js";
import { addToParty, type GameState } from "./game_state.js";
import { FINDS, type Find } from "../content/finds.js";

/** The tile of the map's find while it is still there. */
export function findAt(save: GameState, mapId: string, map: MapData): [number, number] | null {
  return map.find && FINDS[mapId] && !save.flags[`find_${mapId}`] ? map.find : null;
}

/** Takes the find under Shard, if there is one: gives what it holds and returns it, once. */
export function pickUp(save: GameState, mapId: string, map: MapData, x: number, y: number): Find | null {
  const at = findAt(save, mapId, map), f = FINDS[mapId];
  if (!at || at[0] !== x || at[1] !== y) return null;
  save.flags[`find_${mapId}`] = true;
  if (f.kind === "items" && f.what) save.bag[f.what] = (save.bag[f.what] ?? 0) + (f.count ?? 1);
  else if (f.kind === "cinder") save.bag.cinder = (save.bag.cinder ?? 0) + (f.cinder ?? 0);
  else if (f.kind === "ruin" && f.what) addToParty(save, f.what, f.level ?? 5);
  return f;
}
