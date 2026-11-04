// Story scenes on the field: a person walks to Shard along a path, they speak in turns, and then the person walks
// back, or, at a gate, the fight starts. Walked positions live only in the runner, so the map data never changes.
import { MapData, NPC, tileInfo, pastSeal } from "./maps.js";
import { startDialogue, updateDialogue, advanceDialogue, isDialogueFinished, DialogueState } from "./dialogue.js";
import { isConfirm } from "./input.js";
import { STORY, type StoryScene } from "../content/story.js";

export interface StoryHost {
  map: MapData;
  mapId: string;
  flags: Record<string, boolean>;
  playerX: number;
  playerY: number;
  dialogue: DialogueState | null;
  /** Whether a person is still on the map (a beaten person who leaves is not). */
  present(npc: NPC): boolean;
  face(dir: "up" | "down" | "left" | "right"): void;
  voice(speaker: string): void;
  fight(npc: NPC): void;
}

const STEP_TIME = 0.24;

export class StoryRunner {
  private at: { x: number; y: number };
  private from: { x: number; y: number };
  private t = 0;
  private path: [number, number][] = [];
  private back: [number, number][] = [];
  private stage: "walk" | "talk" | "back" | "done" = "walk";
  private line = 0;

  private constructor(readonly scene: StoryScene, readonly npc: NPC, host: StoryHost, still = false) {
    this.at = { x: npc.x, y: npc.y };
    this.from = { ...this.at };
    this.path = still ? [] : route(host, npc, [host.playerX, host.playerY]);
    this.back = still ? [] : [...this.path].reverse().slice(1).concat([[npc.x, npc.y]]);
    if (still) this.stage = "talk";
    host.flags[`story_${scene.id}`] = true;
  }

  /** The scene that should start now on this map, if any. */
  static begin(host: StoryHost): StoryRunner | null {
    for (const s of STORY) {
      if (s.map !== host.mapId || host.flags[`story_${s.id}`]) continue;
      if (s.minX !== undefined && host.playerX < s.minX) continue;
      // A gate scene starts two steps past the map's seal line.
      if (s.past && (pastSeal(host.map, host.playerX, host.playerY) ?? -1) < 2) continue;
      // A scene with no walker is only spoken, by those who travel with Shard.
      if (s.walker === "") return new StoryRunner(s, { x: -1, y: -1, dir: "down", name: "", sprite: "", lines: [] } as NPC, host, true);
      // A gate scene is walked by the person in the gap, even when someone else shares their name.
      const npc = s.fight
        ? host.map.npcs.find((n) => n.name === s.walker && n.leaves)
        : host.map.npcs.find((n) => n.name === s.walker) ?? host.map.npcs[0];
      if (!npc || !host.present(npc)) continue;
      return new StoryRunner(s, npc, host);
    }
    return null;
  }

  get done(): boolean { return this.stage === "done"; }

  /** Where the walking person is drawn, in tiles, between steps. */
  drawnAt(npc: NPC): { x: number; y: number } | null {
    if (npc !== this.npc) return null;
    const k = Math.min(1, this.t / STEP_TIME);
    return { x: this.from.x + (this.at.x - this.from.x) * k, y: this.from.y + (this.at.y - this.from.y) * k };
  }

  /** The tile the walking person blocks. */
  tileOf(npc: NPC): { x: number; y: number } | null {
    return npc === this.npc ? this.at : null;
  }

  update(dt: number, host: StoryHost): void {
    if (this.stage === "walk" || this.stage === "back") {
      this.t += dt;
      if (this.t < STEP_TIME) return;
      const list = this.stage === "walk" ? this.path : this.back;
      const next = list.shift();
      if (next) {
        this.from = { ...this.at };
        this.at = { x: next[0], y: next[1] };
        this.t = 0;
        return;
      }
      this.from = { ...this.at };
      if (this.stage === "back") { this.stage = "done"; return; }
      // Shard turns to the person who came.
      const dx = this.at.x - host.playerX, dy = this.at.y - host.playerY;
      host.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      this.stage = "talk";
      return;
    }
    if (this.stage !== "talk") return;
    if (!host.dialogue) {
      if (this.line >= this.scene.lines.length) {
        if (this.scene.fight) { this.stage = "done"; host.fight(this.npc); }
        else { this.stage = "back"; this.t = 0; }
        return;
      }
      const [speaker, text] = this.scene.lines[this.line];
      host.dialogue = startDialogue(speaker, [text]);
    }
    const d = host.dialogue;
    const before = Math.floor(d.charIndex / 3);
    updateDialogue(d, dt);
    if (Math.floor(d.charIndex / 3) > before) host.voice(d.speaker);
    if (isConfirm()) advanceDialogue(d);
    if (isDialogueFinished(d)) { host.dialogue = null; this.line++; }
  }
}

/** A shortest walk from the person to a tile beside the player, around walls and other people. */
function route(host: StoryHost, npc: NPC, [px, py]: [number, number]): [number, number][] {
  const blocked = new Set(host.map.npcs.filter((n) => n !== npc && host.present(n)).map((n) => `${n.x},${n.y}`));
  blocked.add(`${px},${py}`);
  const prev = new Map<string, string | null>([[`${npc.x},${npc.y}`, null]]);
  const queue: [number, number][] = [[npc.x, npc.y]];
  let end: string | null = null;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (Math.abs(x - px) + Math.abs(y - py) === 1) { end = `${x},${y}`; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (prev.has(k) || blocked.has(k) || !tileInfo(host.map, x + dx, y + dy)?.walk || tileInfo(host.map, x + dx, y + dy)?.seal) continue;
      prev.set(k, `${x},${y}`);
      queue.push([x + dx, y + dy]);
    }
  }
  const out: [number, number][] = [];
  for (let k = end; k && prev.get(k); k = prev.get(k)!) out.unshift(k.split(",").map(Number) as [number, number]);
  return out.length > 60 ? [] : out;
}
