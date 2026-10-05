import type { ColorName } from "../engine/palette";
import type { SpriteKind } from "../engine/sprites";
import type { NoteName } from "../engine/audio";

export type Element = "blunt" | "cut" | "cold" | "heat" | "wind" | "hum";
export const ELEMENTS: Element[] = ["blunt", "cut", "cold", "heat", "wind", "hum"];

export type Lane = 0 | 1 | 2;
export type Side = "party" | "enemy";

export interface SpriteRef {
  kind: SpriteKind;
  seed: string;
  variant?: string;
  a: ColorName;
  b: ColorName;
}

/** Which resource a combatant spends. Held people spend tension. */
export type Economy = "tension" | "length" | "slack";

export type TargetKind = "enemy" | "ally" | "self" | "allEnemies" | "allAllies" | "twoEnemies" | "none" | "anyone";
export type Shape = "one" | "lane" | "adjacent" | "all";

export type SkillKind =
  | "attack" // plain damage
  | "pluck" // hits the line
  | "heal"
  | "buff"
  | "debuff"
  | "hang" // guard
  | "duck"
  | "knot" // Fathom's persistent spells
  | "climb"
  | "tune" // change a note
  | "tangle"
  | "wind" // set the wind
  | "rise"
  | "letgo"
  | "special";

export interface Skill {
  id: string;
  name: string;
  desc: string;
  kind: SkillKind;
  cost: number;
  target: TargetKind;
  element?: Element;
  power?: number;
  /** Uses magic instead of attack for damage. */
  magic?: boolean;
  shape?: Shape;
  weight?: number;
  status?: StatusId;
  statusTurns?: number;
  /** Status power, for example shield fraction or stat change. */
  statusPower?: number;
  /** Extra effect handled by name in the core. */
  effect?: string;
  /** Heal base. */
  heal?: number;
  /** Lock icon this skill satisfies, for charged enemy moves. */
  lock?: LockIcon;
  /** For knots: the knot stays until untied. */
  persistent?: boolean;
  /** Minimum chapter before an enemy or member can use it. */
  chapter?: number;
}

export type LockIcon = Element | "pluck" | "tangle" | "knot" | "duck";

export type StatusId =
  | "guard" // Hang: half damage until the next turn
  | "duck" // evade everything until the next turn
  | "shield" // absorbs a fraction of damage (knot)
  | "slow"
  | "haste"
  | "down" // knocked down: skip the next turn
  | "taunt" // enemies prefer this target
  | "atkUp"
  | "atkDown"
  | "defUp"
  | "defDown"
  | "bleed" // damage each turn (Monkey's Fist)
  | "stopper" // cannot be lifted
  | "clove" // tension frozen, no skills
  | "hitch" // cannot change lane, slowed
  | "snare" // next action trips
  | "brace" // next hit deals double
  | "unhanded" // enemy made slack by Climb: no tension gain, can be knocked down
  | "hold" // Marrow: next hit is nullified
  | "frost" // slowed and takes extra heat
  | "silence" // cannot use skills
  | "steady" // Hand: ignore the next knockdown
  | "focus" // crit up
  | "swallow" // Sump intercepts the next attack on an ally
  | "reef" // Fathom's Reef knot: split damage with the linked ally
  | "charge"; // winding up a big move

export interface Status {
  id: StatusId;
  turns: number;
  power?: number;
  /** Who applied it, for knots. */
  by?: string;
  /** Linked target for Reef and Swallow. */
  link?: string;
}

export interface ActiveKnot {
  skill: string;
  /** Target combatant ids. */
  targets: string[];
  cost: number;
}

export interface Charging {
  skill: string;
  locks: LockIcon[];
  matched: boolean[];
  /** Turns of warning before it resolves (counts down on the actor's turns). */
  turns: number;
}

export interface Combatant {
  id: string;
  defId: string;
  name: string;
  side: Side;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  mag: number;
  def: number;
  spd: number;
  /** Held people have a line and tension. */
  held: boolean;
  tension: number;
  note: NoteName | null;
  economy: Economy;
  /** Fathom's fathoms of line, or a slack native's slack points. */
  pool: number;
  maxPool: number;
  knots: ActiveKnot[];
  lane: Lane;
  tempo: number;
  statuses: Status[];
  weak: Element[];
  resist: Element[];
  revealed: Element[];
  skills: string[];
  alive: boolean;
  /** Turns remaining off the field after a Lift. 0 means on the field. */
  lifted: number;
  tangledWith: string | null;
  charging: Charging | null;
  ai: string;
  boss: boolean;
  enraged: boolean;
  /** Up the enemy's line after Climb. Holds the target id. */
  climbing: string | null;
  /** Released from the Hand in chapter 8 or 9. */
  letGo: boolean;
  /** Re-held by the Grip in chapter 9: acts for the enemy until plucked. */
  reheld: boolean;
  sprite: SpriteRef;
  xp: number;
  slugs: number;
  drop?: string;
  /** Count of turns taken, for metrics. */
  turns: number;
  /** Taken Up (removed, no reward). */
  taken: boolean;
  /** Per-battle cooldowns for slack natives. */
  cooldowns: Record<string, number>;
  /** Base speed before statuses. */
  baseSpd: number;
}

export type Wind = -1 | 0 | 1;

export interface Mechanics {
  tension: boolean;
  notes: boolean;
  tangle: boolean;
  lanes: boolean;
  lift: boolean;
  locks: boolean;
  pairs: boolean;
  letgo: boolean;
  allSlack: boolean;
}

export interface HandState {
  /** Cooldown in actor turns for each Hand action. */
  tug: number;
  steady: number;
  pinch: number;
  /** Uses this battle, for metrics. */
  uses: number;
}

export interface BattleState {
  chapter: number;
  mech: Mechanics;
  /** The Bite meter, 0 to 100. Rises with the tension on the field. Something below is listening. */
  bite: number;
  /** How many Bites have happened this fight, for metrics. */
  bites: number;
  /** Enemy stat multiplier from the difficulty option. */
  difficulty: number;
  combatants: Combatant[];
  phrase: NoteName[];
  wind: Wind;
  windNext: Wind;
  /** Timeline position of the next wind push. */
  windTempo: number;
  round: number;
  actions: number;
  over: "win" | "lose" | "flee" | null;
  hand: HandState;
  /** Pairs that have a bond. */
  bonds: [string, string][];
  canFlee: boolean;
  seed: number;
  /** Lead changes and other drama counters for metrics. */
  partyLeadHistory: number[];
  bossName?: string;
  /** Script hooks: id of a scripted phase change. */
  phase: number;
}

// ---------------------------------------------------------------------------
// Definitions

export interface MemberDef {
  id: string;
  name: string;
  title: string;
  held: boolean;
  economy: Economy;
  note: NoteName | null;
  sprite: SpriteRef;
  base: { hp: number; atk: number; mag: number; def: number; spd: number };
  growth: { hp: number; atk: number; mag: number; def: number; spd: number };
  /** Skill ids and the level they are learned at. */
  learn: { skill: string; level: number }[];
  weak: Element[];
  resist: Element[];
  ai: string;
  color: ColorName;
  joinChapter: number;
  /** For Fathom: base pool and growth. */
  pool?: { base: number; perLevel: number };
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Short line shown when Bob or the Hand looks at it. */
  about: string;
  level: number;
  held: boolean;
  economy: Economy;
  note?: NoteName;
  sprite: SpriteRef;
  skills: string[];
  weak: Element[];
  resist: Element[];
  ai: string;
  boss?: boolean;
  /** Multipliers on the level curve. */
  hpMul?: number;
  atkMul?: number;
  magMul?: number;
  defMul?: number;
  spdMul?: number;
  xpMul?: number;
  drop?: string;
  slugs?: number;
  /** Charged moves: skill id to locks. */
  charges?: Record<string, LockIcon[]>;
  /** Chapter the enemy belongs to, for the simulator. */
  chapter: number;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  kind: "consumable" | "weight" | "glove" | "sole" | "lure" | "key";
  /** Lures retune a held member's line to this note. */
  note?: string;
  price: number;
  /** Consumables. */
  heal?: number;
  healPct?: number;
  revive?: boolean;
  tension?: number;
  pool?: number;
  cure?: boolean;
  target?: "ally" | "allAllies" | "enemy";
  power?: number;
  element?: Element;
  /** Gear stat changes. */
  stats?: Partial<{ hp: number; atk: number; mag: number; def: number; spd: number }>;
  /** Gear passive tags handled by the core. */
  passive?: string;
  sprite: string;
}

export interface EncounterGroup {
  id: string;
  enemies: string[];
  chapter: number;
  boss?: boolean;
  /** Music seed override. */
  music?: string;
}
