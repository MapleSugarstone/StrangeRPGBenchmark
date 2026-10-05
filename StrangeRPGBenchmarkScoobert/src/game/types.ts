// Core type definitions shared by content, engine, and balance harness.

export type StatKey = "hp" | "atk" | "def" | "spd" | "wit";
export type Stats = Record<StatKey, number>;

export type Element = "static" | "bloom" | "void" | "steel" | "null";

export interface Skill {
  id: string;
  name: string;
  desc: string;
  power: number;        // 0 = non-damage
  element: Element;
  target: "enemy" | "all-enemies" | "ally" | "all-allies" | "self";
  cost: number;        // thread (ch1) / flux (ch3+)
  accuracy: number;     // 0..1
  effect?: EffectDef;
  unlockChapter: number;
}

export type EffectKind =
  | "heal"          // power as % of max hp
  | "drain"         // heal self for damage dealt * rate
  | "atkUp" | "defUp" | "spdUp" | "witUp"   // buffs, power = turns
  | "atkDown" | "defDown" | "spdDown" | "witDown"
  | "poison" | "stun" | "sleep" | "burn" | "frail" | "haste"
  | "shield"; // absorbs power*maxHp damage over `turns` (Marrow's take-the-blow)

export interface EffectDef {
  kind: EffectKind;
  chance: number; // 0..1
  power: number;  // rate or turns
}

export interface StatusEffect {
  kind: EffectKind;
  turns: number;
  power: number;
}

export interface UnitBase {
  name: string;
  title: string;
  cls: string;         // class id
  hp: number;
  atk: number;
  def: number;
  spd: number;
  wit: number;
  spriteSeed: number;
  spriteStyle: import("../core/sprite").SpriteStyle;
  colors: string[];    // 3 colors
}

export interface Unit extends UnitBase {
  maxHp: number;
  hp: number;
  alive: boolean;
  statuses: StatusEffect[];
  buffs: Partial<Record<EffectKind, { turns: number; power: number }>>;
}

export interface EnemyDef {
  id: string;
  name: string;
  cls: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  wit: number;
  element: Element;
  spriteStyle: import("../core/sprite").SpriteStyle;
  colors: string[];
  spriteSeed: number;
  ai: "basic" | "brute" | "caster" | "splitter" | "boss";
  splitsInto?: string; // enemy id on death
  xp: number;
  lore?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: "weapon" | "armor" | "trinket" | "consumable";
  desc: string;
  atk?: number;
  def?: number;
  spd?: number;
  wit?: number;
  hp?: number;
  passive?: string; // passive id
  use?: { heal: number; effect?: EffectDef };
}

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
}

export interface DialogueLine {
  who?: string;        // undefined = narrator
  text: string;
  art?: { seed: number; style: import("../core/sprite").SpriteStyle; colors: string[]; scale?: number };
  sfx?: string;
}

export interface Choice {
  label: string;
  next: string;        // node id
  effect?: string;     // effect id (flag / stat / reward)
  requires?: string;   // flag that must be set
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  next?: string;
  choices?: Choice[];
  end?: "chapter" | "game"; // set the chapter-complete or game-complete flag
}

export interface MapDef {
  id: string;
  name: string;
  w: number;
  h: number;
  seed: number;
  floors: number;
  palette: string[];   // [black, a, b]
  tileFloor: SpriteStyleName;
  tileWall: SpriteStyleName;
  enemies: string[];
  elite?: string;
  bosses: string[];   // one per floor (last is the chapter boss)
  shops: ShopStock[];
  intro: string;      // dialogue graph id
  outro: string;      // dialogue graph id
  unlock?: string;    // mechanic granted on completion
  layout: LayoutKind;
  encounters: number; // expected normal battles before the boss stair
}

export type SpriteStyleName =
  | "sym" | "glyph" | "gear" | "shard" | "eye" | "floor" | "wall" | "water" | "void" | "door";

export type LayoutKind = "rooms" | "labyrinth" | "spiral" | "hollow" | "needle";

export interface ShopStock {
  items: string[];
  prices: Record<string, number>;
}

export interface ChapterDef {
  id: string;
  name: string;
  tagline: string;
  circle: string;      // Dan Harmon story circle summary
  heroStage: string;   // hero's journey stage
  map: MapDef;
  companions: string[]; // ids available after this chapter
  partyCap: number;
  mechanics: string[]; // mechanic ids introduced
  enemyLevel: number;
  reward: { xp: number; thread: number; credits: number };
}

export interface SaveData {
  version: number;
  chapter: number;
  floor: number;
  player: PlayerSave;
  party: PlayerSave[];
  flags: Record<string, boolean>;
  seen: string[];
  playTimeMs: number;
  battles: number;
  wins: number;
  credits: number;
  rngSeed: number;
  spot?: { x: number; y: number; encountersLeft: number }; // position on the saved floor
  retries?: number;    // losses since this save was written
}

export interface PlayerSave {
  id: string;
  name: string;
  cls: string;
  level: number;
  xp: number;
  stats: Stats;
  hp: number;
  skills: string[];
  weapon: string;
  armor: string;
  trinket: string;
  items: Record<string, number>;
}

export interface Telemetry {
  battlesWon: number;
  battlesLost: number;
  turnsTotal: number;
  turnsPerBattle: number[];
  damageDealt: number[];
  damageTaken: number[];
  nearDeath: number;      // times a live unit dipped below 30% hp
  unitsDowned: number;
  skillsUsed: Record<string, number>;
  itemsUsed: Record<string, number>;
  choicesMade: string[];
  deathSaves: number;     // times the party lost after a downed companion
  playTimeMs: number;
}
