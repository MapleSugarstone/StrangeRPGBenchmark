import type { Type } from '../data/types';
import type { Battle, Fighter, MarkVal, Side, SpriteData, Summon } from './model';

export type Reach = 'single' | 'spread' | 'ally' | 'reserveAlly' | 'team' | 'self' | 'dragin' | 'side';

export interface Ratio { atk?: number; mgk?: number; def?: number; cha?: number; selfHp?: number; tgtHp?: number; tgtMiss?: number; tgtCur?: number; flat?: number }

export interface HitOpts { kind?: 'P' | 'M' | 'T'; noGuard?: boolean; mult?: number; reserve?: boolean; spread?: boolean; noEffects?: boolean }

/** The toolbox a move's run function works with. */
export interface Ctx {
  b: Battle;
  u: Fighter;
  me: Side;
  them: Side;
  move: MoveDef;
  type: Type;
  tgt: Fighter;
  ally: Fighter | null;
  /** The raw target index the player picked, or -1. */
  pick: number;
  preview: boolean;
  /** Damage one fighter. Returns damage dealt to HP and shield. */
  hit(t: Fighter, r: Ratio, o?: HitOpts): number;
  /** Damage the out enemy and splash its reserves. Returns damage to the out enemy. */
  spread(r: Ratio, o?: HitOpts): number;
  /** Apply a status. Returns false if it was resisted. */
  st(t: Fighter, id: string, n: number, v?: number): boolean;
  heal(t: Fighter, amt: number): number;
  shield(t: Fighter, amt: number, turns: number): void;
  cleanse(t: Fighter, max?: number): number;
  delay(t: Fighter, n: number): void;
  hasten(t: Fighter, n: number): void;
  forceOut(): boolean;
  dragIn(idx: number): boolean;
  interrupt(t: Fighter): boolean;
  /** True when a ward on the target ate this move. Checked once per move. */
  blocked(t: Fighter): boolean;
  nerve(side: Side, n: number): void;
  msg(text: string): void;
  cha(mult: number): number;
  /** Add n stacks of a kit mark (defMark) to t for `turns` turns (-1 lasts the battle). A ward on an enemy stops it. */
  mark(t: Fighter, id: string, n?: number, turns?: number, v?: number): boolean;
  /** Stacks of a mark on t, or 0. */
  marked(t: Fighter, id: string): number;
}

export interface MoveDef {
  id: string;
  name: string;
  type: Type;
  owner: string;
  reach: Reach;
  cd: number;
  nerve?: number;
  wu?: number;
  wt?: number;
  unstop?: boolean;
  tag?: boolean;
  noGuard?: boolean;
  /** A form or borrowed move that setMove swaps in during battle. It is never part of a species' four. */
  extra?: boolean;
  /** What kind of move this is, for passives that stop or turn back dashes, projectiles, spells, or channels. */
  tags?: ('dash' | 'projectile' | 'spell' | 'channel')[];
  text: string;
  run: (c: Ctx) => void;
}

export interface DmgInfo {
  kind: 'P' | 'M' | 'T';
  move: MoveDef | null;
  attack: boolean;
  dot: boolean;
  spread: boolean;
  reserve: boolean;
}

/** Passives and notions share one hook interface. Hooks receive the holder first. */
export interface Hooks {
  start?(b: Battle, f: Fighter): void;
  comeOut?(b: Battle, f: Fighter): void;
  leave?(b: Battle, f: Fighter): void;
  turnStart?(b: Battle, f: Fighter): void;
  /** Multiplier on damage the holder deals. */
  outMul?(b: Battle, f: Fighter, tgt: Fighter, d: DmgInfo): number;
  /** Multiplier on damage the holder takes. */
  inMul?(b: Battle, f: Fighter, src: Fighter | null, d: DmgInfo): number;
  /** Reserve aura: multiplier on damage the holder's out ally deals. */
  auraOut?(b: Battle, f: Fighter, out: Fighter, tgt: Fighter, d: DmgInfo): number;
  /** Reserve aura: multiplier on damage the holder's out ally takes. */
  auraIn?(b: Battle, f: Fighter, out: Fighter, src: Fighter | null, d: DmgInfo): number;
  /** Extra raw added to the holder's damage before mitigation. */
  addRaw?(b: Battle, f: Fighter, tgt: Fighter, d: DmgInfo): number;
  afterDeal?(b: Battle, f: Fighter, tgt: Fighter, dealt: number, d: DmgInfo): void;
  afterTake?(b: Battle, f: Fighter, src: Fighter | null, dealt: number, d: DmgInfo): void;
  afterMove?(b: Battle, f: Fighter, m: MoveDef, c: Ctx): void;
  afterAttack?(b: Battle, f: Fighter, tgt: Fighter): void;
  /** Any slough on either side was KO'd. Called for every standing holder, out or in reserve. */
  anyKO?(b: Battle, f: Fighter, victim: Fighter, killer: Fighter | null): void;
  /** Return true to stop the KO. The hook sets HP itself. */
  wouldKO?(b: Battle, f: Fighter, src: Fighter | null): boolean;
  /** Reserve hook: the holder's out ally would be KO'd. */
  allyWouldKO?(b: Battle, f: Fighter, out: Fighter, src: Fighter | null, dmg: number): number;
  afterGuard?(b: Battle, f: Fighter): void;
  statusImmune?(f: Fighter, id: string): boolean;
  immovable?(f: Fighter): boolean;
  noDelay?(f: Fighter): boolean;
  /** Weight override for guard and switch. */
  quickWeight?(f: Fighter, act: 'guard' | 'switch'): number | null;
  /** Extra MGK or ATK computed from the fighter. */
  statBonus?(f: Fighter, stat: 'atk' | 'mgk' | 'def' | 'res' | 'agi' | 'cha'): number;
  /** Whether this move is free of cooldown this time. */
  freeCooldown?(b: Battle, f: Fighter, m: MoveDef): boolean;
  /** Multiplier on healing the holder gives. */
  healMul?(b: Battle, f: Fighter, tgt: Fighter): number;
  afterHeal?(b: Battle, f: Fighter, tgt: Fighter, amt: number, over: number): void;
  /** Final say on damage the holder takes, after every multiplier and before shields. Return the new amount. */
  beforeTake?(b: Battle, f: Fighter, src: Fighter | null, amt: number, d: DmgInfo): number;
  /** A foe's move aimed at the holder's side is about to run. Return 'block' to stop it or 'reflect' to turn it back on its user. */
  intercept?(b: Battle, f: Fighter, user: Fighter, m: MoveDef): 'block' | 'reflect' | null;
  /** A fighter the holder banished has come back. */
  banishEnd?(b: Battle, f: Fighter, back: Fighter): void;
  /** Any slough on either side came out. Called for every standing holder. */
  anyOut?(b: Battle, f: Fighter, who: Fighter): void;
  /** The holder's side starts a turn while the holder sits in reserve. */
  reserveTurn?(b: Battle, f: Fighter): void;
  /** The holder ends its own turn as the out slough. `action` is attack, guard, switch, move, windup, peg, notion, or skip. */
  turnEnd?(b: Battle, f: Fighter, action: string): void;
  /** Any slough used a move (m) or attacked (m is null). Called for every standing holder after it resolves. */
  anyMove?(b: Battle, f: Fighter, user: Fighter, m: MoveDef | null): void;
  /** The holder put a status on t. */
  afterApply?(b: Battle, f: Fighter, t: Fighter, id: string): void;
  /** The holder received a status. */
  afterGet?(b: Battle, f: Fighter, src: Fighter | null, id: string): void;
  /** Return a short reason to forbid the holder an action this turn, or null. */
  forbid?(b: Battle, f: Fighter, what: 'attack' | 'guard' | 'switch' | MoveDef): string | null;
  /** Adjust the cooldown the holder's move is about to get. */
  cooldown?(b: Battle, f: Fighter, m: MoveDef, cd: number): number;
  /** Marks only: the mark ran out on the holder (not cleansed or removed by code). */
  expire?(b: Battle, f: Fighter, mk: MarkVal): void;
}

/** A named, timed, stackable state that a kit puts on any fighter. Its hooks run for the fighter that carries it. */
export interface MarkDef extends Hooks {
  id: string;
  /** Shown in the battle readout. Leave empty to hide the mark. */
  name: string;
  text?: string;
  /** Highest stack count. */
  max?: number;
  /** 'own': counts down at the end of the holder's own turns (default). 'side': at the end of every turn its side takes. 'any': at the end of every turn. */
  clock?: 'own' | 'side' | 'any';
  /** Cleared when the holder leaves the field. */
  volatile?: boolean;
  /** Counts as a negative effect: cleanse removes it. */
  negative?: boolean;
  /** How much the AI values one stack for the holder, on the scale where a stun is 0.35. Negative means it hurts the holder. */
  value?: number;
  /** The holder's move that spends this mark. The AI prices the mark at part of what that move would do if used now. */
  spend?: string;
  /** The color of the mark's icon in the battle readout. Defaults by whether the mark is negative. */
  color?: string;
}

export interface PassiveDef extends Hooks {
  id: string;
  name: string;
  owner: string;
  text: string;
}

export interface NotionDef extends Hooks {
  id: string;
  name: string;
  text: string;
  price: number;
  flat?: Partial<Record<'hp' | 'atk' | 'mgk' | 'def' | 'res' | 'agi' | 'cha', number>>;
  /** Stat bonuses as a share of the stat, so they keep their worth at every level. */
  pct?: Partial<Record<'hp' | 'atk' | 'mgk' | 'def' | 'res' | 'agi' | 'cha', number>>;
  action?: { name: string; run: (b: Battle, f: Fighter) => void };
  /** A spent notion: its action works once, even with the Pylon charm, and the holder loses it after a battle where it was used. */
  spent?: boolean;
}

/** A kind of summoned unit. A kit makes one with `summon` from the engine. */
export interface SummonDef {
  id: string;
  name: string;
  owner: string;
  text: string;
  /** Its look on the battle screen. Without one it draws as a small token in its owner's colors. */
  sprite?: SpriteData;
  /** Ticks between its actions. 100 is one ordinary turn. Leave out `act` for a unit that never acts on its own. */
  every?: number;
  act?(b: Battle, s: Summon, owner: Fighter): void;
  /** Takes single-target hits aimed at its side's out whorl until it falls: a wall, a bodyguard. */
  guard?: boolean;
  /** Runs when a whorl on the other side comes out. Return true to be used up: a trap or a mine. */
  trap?(b: Battle, s: Summon, foe: Fighter): boolean;
  /** Runs when the unit leaves for any reason. */
  gone?(b: Battle, s: Summon, owner: Fighter): void;
  /** The other side can aim single-target moves and attacks at it. Twins always can. */
  aimable?: boolean;
  /** Runs when it falls to 0 HP, before it leaves. */
  fall?(b: Battle, s: Summon, owner: Fighter): void;
  /** Stays after its owner is knocked out. */
  lasting?: boolean;
  /** A guard that breaks passes the rest of the hit on to the whorl it guards. */
  spill?: boolean;
}

export const MOVES: Record<string, MoveDef> = {};
export const PASSIVES: Record<string, PassiveDef> = {};
export const NOTIONS: Record<string, NotionDef> = {};
export const MARKS: Record<string, MarkDef> = {};
export const SUMMONS: Record<string, SummonDef> = {};

export function defSummon(d: SummonDef): void {
  if (SUMMONS[d.id]) throw new Error(`duplicate summon ${d.id}`);
  SUMMONS[d.id] = d;
}

export function defMark(m: MarkDef): void {
  if (MARKS[m.id]) throw new Error(`duplicate mark ${m.id}`);
  MARKS[m.id] = m;
}

export function defMove(m: MoveDef): void {
  if (MOVES[m.id]) throw new Error(`duplicate move ${m.id}`);
  MOVES[m.id] = m;
}
export function defPassive(p: PassiveDef): void {
  if (PASSIVES[p.id]) throw new Error(`duplicate passive ${p.id}`);
  PASSIVES[p.id] = p;
}
export function defNotion(n: NotionDef): void {
  NOTIONS[n.id] = n;
}
