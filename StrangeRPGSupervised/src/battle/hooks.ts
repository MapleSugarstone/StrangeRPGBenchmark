// Hooks for passives written as code (src/content/passive_code.ts): each species' passive is a small object whose
// methods the battle, the field, the traders, and catching call at their moments. A method that does not apply
// is left out. Qwen wrote what each passive does; Claude wrote the code that does it.
import type { BattleState, RuinState } from './engine.js';
import type { MoveData } from './moves.js';
import type { StatusInstance } from './statuses.js';
import type { GameState } from '../engine/game_state.js';

/** What a passive sees in battle and can change. */
export interface Ctx {
  state: BattleState;
  /** The Ruin holding the passive. */
  self: RuinState;
  /** The Ruin it faces, or the other Ruin in the event. */
  foe: RuinState;
  /** Whether the holder is on the player's side. */
  mine: boolean;
  /** Its team and the other team. */
  team: RuinState[];
  foes: RuinState[];
  /** Adds a battle line that names the holder and its passive, with an optional message after it. */
  say(after?: string): void;
  /** The passive's name, for messages. */
  passive: string;
  /** Per-battle memory for this holder's passive. */
  mem: Record<string, any>;
  /** Whether the code acting is the battle's Field State rather than a passive. */
  field?: boolean;
}

export interface HitInfo { damage: number; move: MoveData; basic: boolean; mult: number; landing?: boolean }

export interface PassiveCode {
  /** Battle start for the lead, or when switched in. */
  enter?(c: Ctx): void;
  /** Start of each turn, before anyone acts, while it fights. */
  turnStart?(c: Ctx): void;
  /** Multiplies the damage of its hits (return 1 for none). */
  damageOut?(c: Ctx, move: MoveData, basic: boolean): number;
  /** Multiplies the damage it takes. */
  damageIn?(c: Ctx, move: MoveData, basic: boolean): number;
  /** After it hits a foe. */
  hit?(c: Ctx, info: HitInfo): void;
  /** After a hit lands on it; c.foe is the attacker. */
  hurt?(c: Ctx, info: HitInfo): void;
  /** After it uses any move or the basic Attack, hit or not (a wind-up move when it winds up). */
  acted?(c: Ctx, move: MoveData, basic: boolean): void;
  /** After the Ruin it faces uses a move or the basic Attack (a wind-up move when it winds up). c.foe is that Ruin. */
  foeActed?(c: Ctx, move: MoveData, basic: boolean): void;
  /** When it Guards. */
  guard?(c: Ctx): void;
  /** End of each turn while it fights. */
  turnEnd?(c: Ctx): void;
  /** End of each turn while it waits in reserve. */
  reserve?(c: Ctx): void;
  /** When it knocks out a foe; c.foe is the fallen one. */
  ko?(c: Ctx): void;
  /** When it faints; c.foe is the one that did it, when known. */
  fainted?(c: Ctx): void;
  /** When a status would land on it. Return false to stop it. */
  status?(c: Ctx, status: string): boolean | void;
  /** Changes the damage a status on an enemy deals at the end of a turn. c.foe is that enemy, and reserves are asked too. */
  foeTick?(c: Ctx, held: StatusInstance, n: number): number;
  /** Changes the damage the battle's Field State deals it outside of a hit. */
  fieldDamage?(c: Ctx, n: number): number;
  /** Multiplies its speed. */
  speed?(c: Ctx): number;
  /** Changes a move's Boost cost for it. */
  cost?(c: Ctx, move: MoveData, cost: number): number;
  /** Changes the Boost cost of a teammate's move while it stands. */
  allyCost?(c: Ctx, move: MoveData, cost: number): number;
  /** Changes the cooldown a move gets when it uses it. */
  cooldown?(c: Ctx, move: MoveData, turns: number): number;
  /** When the battle ends, from the holder's side; won is the player's result. */
  battleEnd?(c: Ctx, won: boolean, reward: { exp: number; cinder: number }): void;
  /** Changes the HP share at or below which a foe can be caught while it leads (0.5 is normal). */
  catchLine?(c: Ctx, line: number): number;
  /** Field: while it leads the party, multiplies the chance of meeting wild Ruin each grass step. */
  encounter?(save: GameState, rate: number): number;
  /** Field: after each step while in the party; slot is its place in the party. */
  step?(save: GameState, slot: number): string | void;
  /** Traders: changes an item's price while it is in the party. */
  price?(save: GameState, itemKey: string, price: number): number;
}
