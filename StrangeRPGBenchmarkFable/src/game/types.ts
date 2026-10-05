import type { SpriteSpec } from "../engine/sprites";
import type { ColorName } from "../engine/palette";

export type Element = "null" | "heat" | "cold" | "volt" | "rot" | "light";
export const ELEMENTS: Element[] = ["heat", "cold", "volt", "rot", "light"];

export interface Stats {
  hp: number;
  st: number;
  atk: number;
  def: number;
  mag: number;
  res: number;
  spd: number;
}
export type StatKey = keyof Stats;
export const STAT_KEYS: StatKey[] = ["hp", "st", "atk", "def", "mag", "res", "spd"];

/** Mechanics unlock one per chapter. */
export type MechId =
  | "brace"
  | "tempo"
  | "links"
  | "memories"
  | "rows"
  | "debt"
  | "rewind"
  | "fusion"
  | "words";

export type StatusId =
  | "poison" | "burn" | "shock" | "freeze" | "blind"
  | "haste" | "slow" | "shield" | "regen" | "taunt" | "doom"
  | "atkup" | "atkdown" | "defup" | "defdown" | "magup" | "magdown"
  | "lit" | "silence" | "brace";

export interface StatusDef {
  id: StatusId;
  name: string;
  short: string;
  color: ColorName;
  good: boolean;
  desc: string;
}

export type TargetKind = "enemy" | "enemies" | "ally" | "allies" | "self" | "deadally" | "any";

export interface StatusApply { id: StatusId; turns: number; chance?: number; self?: boolean }

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  target: TargetKind;
  kind: "phys" | "mag" | "heal" | "support" | "special";
  power?: number;
  element?: Element;
  hits?: number;
  heal?: number;
  revive?: number;
  status?: StatusApply[];
  cure?: StatusId[];
  /** Tempo shift applied to the target. Positive delays, negative rushes. */
  tempo?: number;
  /** Chapter mechanic this skill belongs to. Hidden until unlocked. */
  mech?: MechId;
  /** Row push: "back" shoves the target back, "front" pulls forward. */
  push?: "back" | "front";
  /** Ranged skills ignore the row penalty. */
  ranged?: boolean;
  /** Debt skills borrow this much from the Bank of Teeth. */
  debt?: number;
  /** Named special behavior resolved in the battle core. */
  special?: string;
  /** Accuracy, 1 means always hits. */
  acc?: number;
  crit?: number;
  tags?: string[];
}

export interface ClassDef {
  id: string;
  name: string;
  desc: string;
  base: Stats;
  growth: Stats;
  learn: { level: number; skill: string }[];
  weaponKinds: string[];
}

export interface CharacterDef {
  id: string;
  name: string;
  /** Battle display name when the full name is too long for a row. */
  short?: string;
  classId: string;
  sprite: SpriteSpec;
  bio: string;
  /** One line said when joining. */
  joinLine: string;
  battleLines?: { win?: string[]; hurt?: string[]; kill?: string[] };
}

export type AiKind = "basic" | "caster" | "healer" | "brute" | "trickster" | "boss" | "coward" | "tempo" | "linker" | "banker";

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  sprite: SpriteSpec;
  level: number;
  stats: Stats;
  skills: string[];
  ai: AiKind;
  weak: Element[];
  resist: Element[];
  absorb?: Element[];
  xp: number;
  gold: number;
  drops: { item: string; chance: number }[];
  /** Memory dropped for the chapter four mechanic. */
  memory?: string;
  boss?: boolean;
  row?: "front" | "back";
  tags?: string[];
  /** Spoken lines for boss fights. */
  lines?: { start?: string; half?: string; death?: string };
}

export type ItemKind = "consumable" | "weapon" | "armor" | "accessory" | "key" | "memory" | "word";

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  kind: ItemKind;
  price: number;
  sprite: SpriteSpec;
  stats?: Partial<Stats>;
  weaponKind?: string;
  element?: Element;
  /** Consumable effect. */
  use?: {
    heal?: number;
    healPct?: number;
    st?: number;
    stPct?: number;
    revive?: number;
    cure?: StatusId[];
    status?: StatusApply[];
    target: TargetKind;
    power?: number;
    element?: Element;
    battleOnly?: boolean;
    fieldOnly?: boolean;
  };
  /** Memory passive, used by the chapter four mechanic. */
  passive?: Passive;
}

export interface Passive {
  stats?: Partial<Stats>;
  /** Percent bonuses. */
  atkPct?: number;
  defPct?: number;
  magPct?: number;
  spdPct?: number;
  hpPct?: number;
  elementBoost?: Element;
  resist?: Element[];
  weak?: Element[];
  immune?: StatusId[];
  regen?: number;
  stRegen?: number;
  counter?: number;
  lifesteal?: number;
  critPct?: number;
  /** Named rule evaluated in the battle core. */
  rule?: string;
}

export interface PartyMember {
  charId: string;
  level: number;
  xp: number;
  hp: number;
  st: number;
  equip: { weapon?: string; armor?: string; accessory?: string };
  memories: string[];
  /** Extra skills granted by story or items. */
  extraSkills: string[];
}

export interface GameState {
  version: number;
  chapter: number;
  flags: Record<string, number | boolean | string>;
  party: PartyMember[];
  reserve: PartyMember[];
  inventory: Record<string, number>;
  gold: number;
  /** Debt owed to the Bank of Teeth. */
  debt: number;
  mechanics: MechId[];
  words: string[];
  map: { id: string; x: number; y: number; dir: Dir };
  steps: number;
  playtime: number;
  battles: number;
  seed: number;
}

export type Dir = "up" | "down" | "left" | "right";

export const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
