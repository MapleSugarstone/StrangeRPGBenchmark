import type { Stats, Type } from '../data/types';

export interface SpriteData {
  /** Eight rows of eight characters: '.' clear, '1' black, '2' first color, '3' second color, '4' hair color. */
  px: string[];
  /** The hair color is optional. Without it, '4' draws in the second color. */
  c: [string, string, string?];
}

/** A slough the player or a keeper owns, outside of battle. */
export interface Mon {
  uid: number;
  kind: string;
  name: string;
  types: Type[];
  basic: 'P' | 'M';
  moves: string[];
  passives: string[];
  retune?: { move: string; type: Type } | null;
  level: number;
  xp: number;
  notion?: string | null;
  sprite: SpriteData;
  fitted?: boolean;
  /** A rare look: paler colors, small star marks, and a faint glow (src/data/starborn.ts). */
  starborn?: boolean;
  parents?: [string, string];
  entry?: string;
  legendary?: boolean;
  person?: boolean;
  fitOrder?: number;
  /** A whorl from the Volute has a separate level on the Strand, where it is small. Strand-born whorls have none. */
  strand?: { level: number; xp: number };
  /** Caught on the Strand: its own level counts everywhere. */
  strandBorn?: boolean;
  /** Tanned points per stat. Each point adds 2% to that stat. */
  tan?: Partial<Record<'hp' | 'atk' | 'def' | 'res' | 'mgk' | 'agi' | 'cha', number>>;
  /** The name it had before the player first renamed it. Clearing a name brings this back. */
  baseName?: string;
  /** Carcanet's Tape: four stone letters (p pearl, a amber, g beach glass, s star glass) it sets in a loop, chosen on the Setting board. */
  tape?: string;
}

export type StatusId =
  | 'stun' | 'silence' | 'sleep' | 'root' | 'taunt' | 'slow' | 'haste'
  | 'burn' | 'bleed' | 'poison' | 'rot' | 'expose' | 'weaken' | 'fortify' | 'empower'
  | 'stasis' | 'unstop' | 'ward' | 'thorns' | 'regen' | 'invuln' | 'guard' | 'doom' | 'monument' | 'hidden' | 'revealed';

export interface StatusVal { n: number; v?: number; src?: number }

/** A kit-defined mark on a fighter: stacks, a value, turns left (-1 lasts the battle), who placed it (side*8+idx, or -1), and the turn number it was placed on. */
export interface MarkVal { n: number; v: number; t: number; by: number; at: number }

/** An identity laid over a fighter for the rest of a battle: a second form, or the body of a fallen whorl. Unset fields keep the whorl's own. */
export interface Form {
  /** The kit's own name for this form, for its hooks to check. */
  tag: string;
  name?: string;
  sprite?: SpriteData;
  types?: Type[];
  passives?: string[];
  basic?: 'P' | 'M';
  /** Multipliers on stats while the form holds, such as { def: 1.3, agi: 0.8 }. */
  statMul?: Partial<Record<'atk' | 'mgk' | 'def' | 'res' | 'agi' | 'cha', number>>;
}

/** What the other side sees instead of the fighter: its name, look, types, and habits. Incoming hits use the disguise's types. */
export interface Disguise { name: string; sprite: SpriteData; types: Type[]; passives: string[]; moves?: string[]; agi?: number }

export interface Fighter {
  side: 0 | 1;
  idx: number;
  mon: Mon;
  /** This battle's move list. Starts as a copy of mon.moves and may be swapped by setMove. */
  moves: string[];
  form?: Form | null;
  disguise?: Disguise | null;
  /** Set by fear or charm: what the fighter does on its next turn instead of choosing. */
  forced?: { k: 'switch' | 'guard' | 'attack' | 'skip' } | null;
  /** Items made or handed over during this battle: notion ids whose hooks the fighter carries on top of its own notion. */
  items?: string[];
  /** Kit-defined marks, keyed by mark id. */
  m: Record<string, MarkVal>;
  st: Stats;
  maxHp: number;
  hp: number;
  shield: number;
  shieldTurns: number;
  ko: boolean;
  gone: boolean;
  cd: number[];
  s: Partial<Record<StatusId, StatusVal>>;
  /** Passive counters and once-per-battle flags. */
  k: Record<string, number>;
  outAt: number;
  turns: number;
  movesUsed: number;
}

export type AiLevel = 'wild' | 'trainer' | 'keeper' | 'champion';

/** A summoned unit on a side: a minion, turret, ward, clone, wall, or trap. Its behavior lives in its SummonDef. */
export interface Summon {
  /** Unique within the battle. */
  uid: number;
  def: string;
  side: 0 | 1;
  /** The index of the fighter that summoned it. */
  by: number;
  hp: number;
  maxHp: number;
  /** Actions left before it leaves on its own, or -1 to stay until destroyed. */
  turns: number;
  /** A free number for the kit: power, stacks, a stored amount. */
  v: number;
  /** A twin: the owner's moves it uses on its own clock, its own cooldowns, and the share of the owner's max HP lost when it falls. */
  moves?: string[];
  cd?: number[];
  link?: number;
}

export interface Side {
  f: Fighter[];
  /** Summons on this side, oldest first. */
  sum: Summon[];
  out: number;
  nerve: number;
  next: number;
  caps: number;
  name: string;
  ai: AiLevel;
  charm: string | null;
  wild: boolean;
  player: boolean;
}

export interface Pending {
  id: number;
  at: number;
  kind: 'windup' | 'hemo' | 'monsoon' | 'storm' | 'summon';
  side: 0 | 1;
  idx: number;
  move: string;
  data?: Record<string, number>;
  unstop?: boolean;
}

/** An out whorl as the screen shows it: its name, types, and look as the player sees them, and its statuses and marks with their counts. */
export interface SnapFighter { idx: number; hp: number; name: string; types: string[]; sprite: SpriteData; s: Record<string, number>; m: Record<string, number> }

/** A side as the screen shows it: tide, caps laid under it, summons, and its out whorl. */
export interface SnapSide { nerve: number; caps: number; sum: Summon[]; out: SnapFighter | null }

/**
 * The battle as the screen shows it at one event, so the screen follows events as they play rather than the end of a turn.
 * The clock part feeds the speed lanes: each out whorl, its next turn, and the time between its plain turns.
 */
export interface Snap { t: number; out: [number, number]; next: [number, number]; step: [number, number]; side: [SnapSide, SnapSide]; wind: Pending[] }

export type Ev = { snap?: Snap } & (
  | { e: 'msg'; text: string }
  | { e: 'use'; side: 0 | 1; idx: number; move: string; name: string }
  | { e: 'dmg'; side: 0 | 1; idx: number; amt: number; kind: 'P' | 'M' | 'T'; eff: number; shield: number }
  | { e: 'heal'; side: 0 | 1; idx: number; amt: number }
  | { e: 'shield'; side: 0 | 1; idx: number; amt: number }
  | { e: 'status'; side: 0 | 1; idx: number; id: string }
  | { e: 'out'; side: 0 | 1; idx: number }
  | { e: 'ko'; side: 0 | 1; idx: number }
  | { e: 'nerve'; side: 0 | 1; n: number }
  | { e: 'wind'; side: 0 | 1; idx: number; move: string }
  | { e: 'cut'; side: 0 | 1; idx: number }
  | { e: 'peg'; idx: number }
  | { e: 'guard'; side: 0 | 1; idx: number }
  | { e: 'blocked'; side: 0 | 1; idx: number });

export interface Rules {
  nerve: boolean;
  wild: boolean;
  sync: boolean;
  canRun: boolean;
  /** Story battles that always end in a catch (Full). */
  scripted?: string;
  /** The battle is on the Strand. Kits may read strand and tideHigh. */
  strand?: boolean;
  /** On the Strand, whether the tide is in. */
  tideHigh?: boolean;
  /** On the Strand at low tide: a star lands every this many rounds and gives both sides 2 tide. */
  starEvery?: number;
}

export type Decision =
  | { kind: 'act'; side: 0 | 1 }
  | { kind: 'replace'; side: 0 | 1 }
  | { kind: 'over'; winner: 0 | 1 | 'run' | 'peg' };

export interface Battle {
  t: number;
  s: [Side, Side];
  pend: Pending[];
  ev: Ev[];
  quiet: boolean;
  /** Set by the battle screen: every event then carries a Snap of what the screen shows. */
  lanes?: boolean;
  rules: Rules;
  over: null | 0 | 1 | 'run' | 'peg';
  need: Decision | null;
  pid: number;
  turnNo: number;
  /** The last round that fatigue has already struck. */
  fatigued?: number;
  /** The last round a star landed on the field. */
  starred?: number;
  /** Set while a side's turn is in progress (between startTurn and endTurn). */
  acting: 0 | 1 | null;
  /** While an aimed action runs: the side aiming and the summon its single-target hits go to. */
  aim?: { side: 0 | 1; uid: number } | null;
  pegged: number[];
  stats: { kos: [number, number]; interrupts: number; bigMoves: number; switches: number; leadChanges: number; lastLead: number; actions: number };
}

export type Action =
  | { k: 'attack'; aim?: number }
  | { k: 'move'; i: number; target?: number; tagTo?: number; aim?: number }
  | { k: 'guard' }
  | { k: 'switch'; to: number }
  | { k: 'peg'; peg: string }
  | { k: 'run' }
  | { k: 'notion' };
