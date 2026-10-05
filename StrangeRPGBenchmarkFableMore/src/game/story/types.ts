import type { GameState } from "../state";
import type { MapDef, Facing, FieldFx } from "../world/map";
import type { Mood } from "../../engine/audio";

export interface SayOpts {
  /** Speaker name shown above the text. */
  speaker?: string;
  /** Member or npc id for a portrait and name color. */
  who?: string;
  top?: boolean;
  auto?: boolean;
}

/** Everything a story script can do. The game implements this. */
export interface ScriptContext {
  readonly g: GameState;
  say(text: string, opts?: SayOpts): Promise<void>;
  /** Shorthand: speaker by member or npc id, with portrait. */
  speak(who: string, text: string): Promise<void>;
  /** The Hand's voice: a frost colored box at the top. */
  hand(text: string): Promise<void>;
  choose(items: string[], opts?: { cancel?: boolean; title?: string }): Promise<number>;
  battle(groupId: string, opts?: { canFlee?: boolean; loseAllowed?: boolean; music?: string }): Promise<"win" | "lose" | "flee">;
  give(item: string, n?: number): Promise<void>;
  giveSlugs(n: number): Promise<void>;
  flag(key: string, value?: number | string | boolean): void;
  has(key: string): boolean;
  get(key: string): number | string | boolean | undefined;
  join(memberId: string): Promise<void>;
  leave(memberId: string): void;
  teleport(map: string, x: number, y: number, facing?: Facing): Promise<void>;
  /** Walk the player or an npc along a path of steps. */
  walk(who: string, steps: Facing[], opts?: { run?: boolean }): Promise<void>;
  face(who: string, facing: Facing): void;
  moveNpc(id: string, x: number, y: number): void;
  wait(seconds: number): Promise<void>;
  fadeOut(): Promise<void>;
  fadeIn(): Promise<void>;
  shake(): Promise<void>;
  flash(): Promise<void>;
  music(mood: Mood, seed?: string): void;
  stopMusic(): void;
  sfx(name: string): void;
  /** A full screen chapter or scene card. */
  card(title: string, subtitle?: string, opts?: { beat?: string }): Promise<void>;
  beat(n: number): void;
  /** Show a knot message being read. Records it. */
  knot(id: string, text: string, reader?: string): Promise<void>;
  rest(): void;
  shop(items: string[], keeper?: string): Promise<void>;
  /** Camp: the party talks. Pairs that talk gain a bond. */
  camp(talks: CampTalk[]): Promise<void>;
  setGoal(text: string): void;
  poolBonus(n: number): Promise<void>;
  taught(town: string): void;
  ending(id: string): Promise<void>;
  save(): void;
  /** Redraw the map and lines, after a flag changed what is shown. */
  refresh(): void;
  /** Player two is present. */
  twoPlayer(): boolean;
  /** Which members are in the roster. */
  inParty(id: string): boolean;
  /** Fathom's current line length in fathoms, for dialogue. */
  length(): number;
  /** Finish this chapter and begin the next. */
  nextChapter(): Promise<void>;
  /** Average party level, for dialogue that reacts to grinding. */
  level(): number;
  /** Add a knot to Fathom's known list outside of leveling. */
  learnKnot(skillId: string): Promise<void>;
  /** The page outside the square: lines fall. */
  pageLetGo(): void;
  /** Set the browser tab title until the next chapter or the title screen. */
  tabTitle(text: string): void;
  /** The page outside the square: every line pulls tight for a moment. */
  pageTight(): void;
  /** Offer the ending letter as a download. */
  letter(lines: string[]): void;
  /** A minigame. Resolves with a score and whether the player did well. */
  minigame(kind: "hook" | "knot" | "swing" | "pluck", opts?: { rounds?: number; hard?: boolean; knot?: string; seq?: number[]; steps?: string[]; keys?: string[]; hide?: boolean; title?: string; done?: string; slip?: string }): Promise<{ score: number; won: boolean }>;
  /** Mark an errand done. Returns false if it already was. */
  errand(id: string): boolean;
  /** Has this errand been done. */
  errandDone(id: string): boolean;
  /** Fathom hooked something: count it. */
  caught(): void;
  /** A short line at the top of the field, without stopping play. */
  toast(text: string): void;
  /** Wobble an npc's line as if plucked. Strength is seconds of wobble. */
  pluck(npcId: string, strength?: number): void;
  /** Play an effect on a tile and wait for its main motion. A crack stays until the map unloads. */
  fx(kind: FieldFx, x: number, y: number): Promise<void>;
  /** Remove an item from the pack. */
  take(item: string, n?: number): void;
}

export interface CampTalk {
  a: string;
  b: string;
  lines: [string, string][];
}

export interface Chapter {
  n: number;
  title: string;
  subtitle: string;
  maps: MapDef[];
  /** Scripts by id. Trigger ids, npc talk ids, and the chapter's own start script. */
  scripts: Record<string, (ctx: ScriptContext) => Promise<void>>;
  /** Called when the chapter starts. */
  start: (ctx: ScriptContext) => Promise<void>;
  /** Eight story circle beat names. */
  beats: string[];
  /** Goal text for the current state. */
  goal: (g: GameState) => string;
  /** Default starting position when debugging into the chapter. */
  debugStart: { map: string; x: number; y: number; level: number; flags?: Record<string, boolean | number | string> };
}
