// Field puzzles in front of a seal, from Qwen's island ideas (Notes/qwen/asks/*-mechanics.md): weights pushed onto
// plates (Heavy Weight, Weep Helper) and a wire walked unbroken from one node to the other (Power Line). Solving one
// lets the seal open for a party that holds its type. Unsolved progress resets when Shard leaves the map, so a weight
// pushed into a corner never locks the way.
import type { MapData } from './maps.js';
import type { GameState } from './game_state.js';

export type Puzzle =
  | { kind: 'plates'; blocks: [number, number][]; plates: [number, number][] }
  | { kind: 'wire'; from: [number, number]; to: [number, number]; wire: [number, number][] };

/** The puzzle's live state in the save: where the weights are, or how far along the wire Shard has walked. */
export interface PuzzleState { blocks?: [number, number][]; walked?: [number, number][] }

const key = (x: number, y: number) => `${x},${y}`;

export function puzzleSolved(save: GameState, mapId: string): boolean {
  return !!save.flags[`puzzle_${mapId}`];
}

export function puzzleState(save: GameState, mapId: string, map: MapData): PuzzleState {
  const all = (save.puzzles ??= {});
  if (!all[mapId] && map.puzzle?.kind === 'plates') all[mapId] = { blocks: map.puzzle.blocks.map(([x, y]) => [x, y]) };
  return (all[mapId] ??= {});
}

/** Starts an unsolved puzzle over (on leaving its map). */
export function resetPuzzle(save: GameState, mapId: string): void {
  if (save.puzzles?.[mapId] && !puzzleSolved(save, mapId)) delete save.puzzles[mapId];
}

/** Whether a weight stands on this tile. */
export function blockAt(save: GameState, mapId: string, map: MapData, x: number, y: number): boolean {
  if (map.puzzle?.kind !== 'plates') return false;
  return (puzzleState(save, mapId, map).blocks ?? []).some(([bx, by]) => bx === x && by === y);
}

/** Pushes the weight at (x, y) one tile in the direction (dx, dy) if the tile beyond is free. Returns whether it moved. */
export function push(save: GameState, mapId: string, map: MapData, x: number, y: number, dx: number, dy: number,
  free: (x: number, y: number) => boolean): boolean {
  const st = puzzleState(save, mapId, map);
  const b = (st.blocks ?? []).find(([bx, by]) => bx === x && by === y);
  if (!b || !free(x + dx, y + dy) || blockAt(save, mapId, map, x + dx, y + dy)) return false;
  b[0] += dx;
  b[1] += dy;
  if (map.puzzle?.kind === 'plates') {
    const on = new Set((st.blocks ?? []).map(([bx, by]) => key(bx, by)));
    if (map.puzzle.plates.every(([px, py]) => on.has(key(px, py)))) save.flags[`puzzle_${mapId}`] = true;
  }
  return true;
}

/** After each step on a wire puzzle's map: starting on the first node lights the wire, stepping off it breaks the
 * line, and reaching the far node with the line whole solves it. */
export function stepWire(save: GameState, mapId: string, map: MapData, x: number, y: number): void {
  const p = map.puzzle;
  if (p?.kind !== 'wire' || puzzleSolved(save, mapId)) return;
  const st = puzzleState(save, mapId, map);
  const onWire = p.wire.some(([wx, wy]) => wx === x && wy === y);
  if (x === p.from[0] && y === p.from[1]) { st.walked = [[x, y]]; return; }
  if (!st.walked?.length) return;
  if (!onWire && !(x === p.to[0] && y === p.to[1])) { st.walked = []; return; }
  st.walked.push([x, y]);
  if (x === p.to[0] && y === p.to[1]) {
    const walked = new Set(st.walked.map(([a, b]) => key(a, b)));
    if (p.wire.every(([wx, wy]) => walked.has(key(wx, wy)))) save.flags[`puzzle_${mapId}`] = true;
    else st.walked = [];
  }
}
