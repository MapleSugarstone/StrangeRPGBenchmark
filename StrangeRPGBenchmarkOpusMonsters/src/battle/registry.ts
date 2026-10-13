import type { Type } from '../data/types';
import type { Action, Battle, Fighter, MarkVal, Pending, Side, SpriteData, Summon } from './model';

// 'bench' picks a foe reserve as its target, as 'dragin' does, without dragging it in.
export type Reach = 'single' | 'spread' | 'ally' | 'reserveAlly' | 'team' | 'self' | 'dragin' | 'side' | 'bench';

/**
 * Shares of stats that make a hit's raw power. User stats: atk, mgk, def, res, agi, cha, selfHp (max HP), hp (current HP).
 * Target terms read the target: tgtHp (max), tgtMiss (missing), tgtCur (current), tgtAtk, tgtMgk, tgtDef, tgtRes, tgtAgi.
 * agiGap reads the user's AGI over the target's, never below 0.
 */
export interface Ratio {
  atk?: number; mgk?: number; def?: number; res?: number; agi?: number; cha?: number; selfHp?: number; hp?: number;
  tgtHp?: number; tgtMiss?: number; tgtCur?: number; tgtAtk?: number; tgtMgk?: number; tgtDef?: number; tgtRes?: number; tgtAgi?: number;
  agiGap?: number; flat?: number;
}

export interface HitOpts { kind?: 'P' | 'M' | 'T'; noGuard?: boolean; mult?: number; reserve?: boolean; spread?: boolean; noEffects?: boolean; pierce?: boolean; share?: number; type?: Type }

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
  /** The option the user picked for a move with options, or -1. */
  opt: number;
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
  /** Splash: the share of its spread hit that each foe in reserve and each foe summon takes. Defaults to SPREAD_SHARE. */
  splash?: number;
  /** A form or borrowed move that setMove swaps in during battle. It is never part of a species' four. */
  extra?: boolean;
  /** What kind of move this is. Each kind has a rule in battle (Notes/combat-redesign.md), and passives may stop or turn kinds back. */
  tags?: ('dash' | 'projectile' | 'spell' | 'channel' | 'sound')[];
  /** Resolves before plain actions in a joint round. */
  quick?: boolean;
  /** Resolves after the other side's action in a joint round. */
  late?: boolean;
  /** After it is used, its slot holds this move for the rest of the battle: chains and cycles. */
  next?: string;
  /** Spent for good once cast: its slot keeps `next` through move resets and through a past a rewind restores. */
  once?: boolean;
  /** It sends the battle back in time, so nobody may choose it while a rewind plays the past again. */
  rewinds?: boolean;
  /** The picture the battle screen draws for it. Without one it draws a default from its kinds, reach, and type. */
  fx?: string;
  /** Choices the user makes as it uses the move, by label. The pick reaches run() as Ctx.opt and rides in the Action. */
  options?(b: Battle, f: Fighter): string[];
  /** A picture for each option, in place of `fx`. */
  fxOpts?: string[];
  /** For a move without options: which of `fxOpts` its user's state draws when it is used, or -1 for `fx`. */
  fxPick?(b: Battle, f: Fighter): number;
  /** Shots it holds. Each use spends one with no wait, and spending the last starts its cooldown and refills it. */
  ammo?: number;
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
  /** Goes past shields and mantles straight to HP. */
  pierce?: boolean;
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
  /** Reserve hook: return true to swap in for the out ally that would be KO'd. The ally goes to reserve at 1 HP. */
  rescue?(b: Battle, f: Fighter, out: Fighter, src: Fighter | null): boolean;
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
  /** Multiplier on healing the holder receives. Below 0 the heal deals that much damage instead. */
  healIn?(b: Battle, f: Fighter, src: Fighter | null): number;
  afterHeal?(b: Battle, f: Fighter, tgt: Fighter, amt: number, over: number): void;
  /** Final say on damage the holder takes, after every multiplier and before shields. Return the new amount. */
  beforeTake?(b: Battle, f: Fighter, src: Fighter | null, amt: number, d: DmgInfo): number;
  /** A foe's one-target move aimed at the holder's side is about to run: return true to take it in place of its target. */
  redirect?(b: Battle, f: Fighter, user: Fighter, m: MoveDef): boolean;
  /** Return true while the holder, out, lets its side see the foe's choice in a joint round before choosing its own. */
  foresee?(b: Battle, f: Fighter): boolean;
  /** Return true to bank a hit on the holder in Fighter.bank instead of taking it now. A banked hit wakes nobody. */
  bankHit?(b: Battle, f: Fighter, src: Fighter | null, amt: number, d: DmgInfo): boolean;
  /** Return true for the holder's hit on tgt to go past shields and mantles straight to HP. */
  pierces?(b: Battle, f: Fighter, tgt: Fighter, d: DmgInfo): boolean;
  /** Changes the type multiplier on a hit the holder takes, after the chart. A field's version runs once for each hit. */
  typeIn?(b: Battle, f: Fighter, type: Type, mul: number): number;
  /** Changes the type multiplier on a hit the holder deals, after the chart and the target's own hooks. */
  typeOut?(b: Battle, f: Fighter, tgt: Fighter, type: Type, mul: number): number;
  /** Return true for the holder's hits on tgt to leave it asleep. */
  lulls?(b: Battle, f: Fighter, tgt: Fighter): boolean;
  /** A foe is about to use a move on itself or its own side: return true for the holder to take it, so it lands on the holder's side. */
  snatch?(b: Battle, f: Fighter, user: Fighter, m: MoveDef): boolean;
  /** Return true while the holder may not come out of reserve: switches skip it, and it replaces a fallen ally only when no one else can. */
  barred?(f: Fighter): boolean;
  /** The battle clock reached a new hour (0 to 23). Called for every standing holder, out or in reserve. */
  atHour?(b: Battle, f: Fighter, hour: number): void;
  /** A new round opens, before anyone chooses. Called once a round for every standing holder, out or in reserve. */
  roundStart?(b: Battle, f: Fighter, round: number): void;
  /** Changes the order class of the holder's move in a joint round: 1 is Quick, 0 plain, and -1 Late. */
  order?(b: Battle, f: Fighter, m: MoveDef, tier: number): number;
  /** Makes the holder's plain Attack a volley: `hits` shots, each for `per` of a plain Attack. */
  volley?(b: Battle, f: Fighter, t: Fighter): { hits: number; per: number } | null;
  /** A star is falling on the field: return true for it to land in the holder's keeping, so only its side gets the tide. */
  catchStar?(b: Battle, f: Fighter): boolean;
  /** A foe is putting a status on a whorl other than the holder: return true for the holder to take it instead. */
  drawStatus?(b: Battle, f: Fighter, src: Fighter, t: Fighter, id: string): boolean;
  /** A status landed on another whorl, on either side. Called for every standing holder, out or in reserve, but not for a status a watcher itself sets off. */
  anyStatus?(b: Battle, f: Fighter, src: Fighter | null, t: Fighter, id: string): void;
  /** Return true for the holder's hits to find tgt while it is Hidden. */
  findsHidden?(b: Battle, f: Fighter, tgt: Fighter): boolean;
  /** In reserve: a foe is about to use move m. Return true for the holder to roll out in front of it before it runs. */
  rollsIn?(b: Battle, f: Fighter, user: Fighter, m: MoveDef): boolean;
  /** While the holder is out: return true to make w, a whorl on the other side, deaf. */
  deafens?(b: Battle, f: Fighter, w: Fighter): boolean;
  /** While the holder is out in a joint round: return true to let its side Measure, choosing after the foe's action. */
  waits?(b: Battle, f: Fighter): boolean;
  /** Return a foe for the holder's one-target moves to land on in place of the out foe, wherever that foe stands. */
  aims?(b: Battle, f: Fighter): Fighter | null;
  /** In reserve: the share of a hit on its side's out whorl `out` that the holder takes in its place, at most 0.5. */
  bears?(b: Battle, f: Fighter, out: Fighter, d: DmgInfo): number;
  /** Another whorl has just started winding up move m, waiting as pending p. Called for every other standing whorl. */
  anyWindup?(b: Battle, f: Fighter, user: Fighter, m: MoveDef, p: Pending): void;
  /** The holder's hit knocked `victim` out with `over` damage to spare. */
  overflow?(b: Battle, f: Fighter, victim: Fighter, over: number, d: DmgInfo): void;
  /** The move slot that comes out when the holder picks slot i, or i itself. */
  spins?(b: Battle, f: Fighter, i: number): number;
  /** A star has just landed. Called for every standing holder, out or in reserve. */
  starLanded?(b: Battle, f: Fighter): void;
  /** A foe's move aimed at the holder's side is about to run. Return 'block' to stop it, 'reflect' to turn it back on its user, or 'through' to send a one-target move on to the user's own next reserve. */
  intercept?(b: Battle, f: Fighter, user: Fighter, m: MoveDef): 'block' | 'reflect' | 'through' | null;
  /** A fighter the holder banished has come back. */
  banishEnd?(b: Battle, f: Fighter, back: Fighter): void;
  /** Any slough on either side came out. Called for every standing holder. */
  anyOut?(b: Battle, f: Fighter, who: Fighter): void;
  /** A whorl on either side is about to leave the field by a switch, forced or chosen. Called for every other standing holder. */
  anyLeave?(b: Battle, f: Fighter, who: Fighter): void;
  /** The holder's side starts a turn while the holder sits in reserve. */
  reserveTurn?(b: Battle, f: Fighter): void;
  /** The holder ends its own turn as the out slough. `action` is attack, guard, switch, move, windup, peg, notion, or skip. */
  turnEnd?(b: Battle, f: Fighter, action: string): void;
  /** Any slough used a move (m) or attacked (m is null). Called for every standing holder after it resolves. */
  anyMove?(b: Battle, f: Fighter, user: Fighter, m: MoveDef | null): void;
  /** Any side's action resolved, whatever it was: an attack, a move, a guard, a switch, a notion. Called for every standing holder. */
  anyAct?(b: Battle, f: Fighter, side: 0 | 1, a: Action): void;
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
  /** Multiplier on the gaps between the holder's turns: below 1 is quicker. */
  speedMul?(b: Battle, f: Fighter): number;
  /** When the holder is knocked out it glows on: for `turns` of its side's turns its reserve auras still work, and it heals its side's out whorl `heal` of that whorl's max HP at each. */
  glows?(b: Battle, f: Fighter): { turns: number; heal: number } | null;
  /** Overdrive: the share of its max HP the holder pays for each turn of cooldown left to use move m before it is ready, or 0. */
  overdrive?(b: Battle, f: Fighter, m: MoveDef): number;
  /** Cover: while the holder is out, return true for it to take a foe's hit meant for its side's reserve r in r's place. */
  covers?(b: Battle, f: Fighter, r: Fighter): boolean;
  /** Credit: the tide the holder's side may run into debt to pay for a crest while the holder stands, out or in reserve. */
  credit?(b: Battle, f: Fighter): number;
  /** Silent: while true, no other whorl's hooks hear what the holder does, as if each of them were deaf to it alone. */
  silent?(b: Battle, f: Fighter): boolean;
  /** Drink: while the holder is out, return true to take a heal meant for t, a whorl of the other side, in t's place. */
  drinks?(b: Battle, f: Fighter, t: Fighter): boolean;
  /** Watch over: in reserve, the holder's out ally `out` has just taken a hit from `src` on the other side. */
  watchOver?(b: Battle, f: Fighter, out: Fighter, src: Fighter, dealt: number, d: DmgInfo): void;
  /** House: the HP its side's house can hold while the holder stands, out or in reserve. */
  pools?(b: Battle, f: Fighter): number;
  /** Telegraph: the effects the holder will set off on its own, next first, as both sides see them. */
  foretell?(b: Battle, f: Fighter): { name: string; color: string; text: string }[];
}

/** A state of the whole field for some rounds: fog, a gale, high tide. Its hooks run for every whorl on both sides. */
export interface FieldDef extends Hooks {
  id: string;
  name: string;
  text: string;
  /** The color the battle screen tints the field state's banner and picture with. */
  color?: string;
  /** How much the field is worth to `side`, for the AI, on the scale where a stun is 0.35. */
  value?(b: Battle, side: 0 | 1): number;
  /** A share of max HP the battle screen marks on the HP bars of the side this ground lies under. */
  line?(b: Battle, side: 0 | 1): number | null;
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
  /** While the holder carries this mark, its own and lent passives do nothing. */
  mutes?: boolean;
  /** While the holder carries this mark, it is deaf: its hooks that answer what other whorls do stay silent. */
  deaf?: boolean;
  /** When the holder leaves the field, by a switch or a knockout, this mark moves to the next whorl its side sends out. */
  sticks?: boolean;
  /** While the holder carries this mark, its statuses and its other marks stop counting down. */
  preserves?: boolean;
  /** While the holder sits in reserve, it is the whorl its side sends out next: switches, tag moves, and replacements take it. */
  calls?: boolean;
  /** Each time the side that set it ends a turn, the mark moves one whorl along its holder's line, wrapping round, and its turns count down by one. */
  orbit?: boolean;
  /** When a dash or a plain Attack lands between the holder and a whorl of the other side, the mark jumps across to that whorl. */
  contact?: boolean;
  /** Orbiting and contact marks only: runs as the mark arrives on a whorl. */
  arrive?(b: Battle, f: Fighter, mk: MarkVal): void;
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

/** Something lying on the field that either side's out whorl may spend a turn to take, such as a fallen pear. */
export interface DropDef {
  id: string;
  name: string;
  text: string;
  /** Its look on the field. Without one it draws as a small token. */
  sprite?: SpriteData;
  /** What it does to the whorl that takes it. */
  take(b: Battle, f: Fighter): void;
}

export const MOVES: Record<string, MoveDef> = {};
export const PASSIVES: Record<string, PassiveDef> = {};
export const NOTIONS: Record<string, NotionDef> = {};
export const MARKS: Record<string, MarkDef> = {};
export const SUMMONS: Record<string, SummonDef> = {};
export const FIELDS: Record<string, FieldDef> = {};
export const DROPS: Record<string, DropDef> = {};
/** Grounds laid under one side: a field state whose hooks run only for the whorls on that side. */
export const GROUNDS: Record<string, FieldDef> = {};

export function defGround(d: FieldDef): void {
  if (GROUNDS[d.id]) throw new Error(`duplicate ground ${d.id}`);
  GROUNDS[d.id] = d;
}

export function defDrop(d: DropDef): void {
  if (DROPS[d.id]) throw new Error(`duplicate drop ${d.id}`);
  DROPS[d.id] = d;
}

export function defField(d: FieldDef): void {
  if (FIELDS[d.id]) throw new Error(`duplicate field ${d.id}`);
  FIELDS[d.id] = d;
}

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
