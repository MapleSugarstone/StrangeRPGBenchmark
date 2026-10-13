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
  /** A fit's two kinds. A team counts both as used in practice and online play. */
  parentKinds?: [string, string];
  /** A fit's look, the shape and palette picked when it was made, so it can be drawn again from its parents' current art. */
  fitLook?: { shape: number; palette: number };
  /** A person sprite this whorl wears in place of its own art, by id, such as Brack's hand-drawn look. */
  art?: string;
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
  | 'stasis' | 'unstop' | 'ward' | 'thorns' | 'regen' | 'invuln' | 'guard' | 'doom' | 'monument' | 'hidden' | 'revealed'
  | 'dashing';

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
  /** Set by fear, charm, or a kit: what the fighter does on its next turn instead of choosing. `i` is the move slot for 'move'. */
  forced?: { k: 'switch' | 'guard' | 'attack' | 'skip' | 'move'; i?: number; foe?: boolean } | null;
  /** Types laid over the fighter for some of its turns, or until it leaves the field. */
  retype?: { types: Type[]; turns: number } | null;
  /** Moves put in its slots for some of its turns: the slot, the move to give back, the turns left, and the turn it was put in on. */
  tmp?: { slot: number; back: string; turns: number; src: number }[];
  /** Turns each move slot stays locked. */
  locks?: number[];
  /** Turns each move slot has spores in it: using that move poisons its user. */
  spore?: number[];
  /** Boosts on move slots: each multiplies the slot's hits, heals, and shields for `uses` more uses, or till it leaves the field at -1. */
  boost?: { slot: number; mul: number; uses: number }[];
  /** Types laid over single move slots for some of the holder's own turns, or till it leaves the field at -1. */
  mtype?: { slot: number; type: Type; turns: number; src: number }[];
  /** Cooldown turns the other side added to each slot. The AI counts them as a loss for the holder. */
  cdHit?: number[];
  /** Damage a bankHit hook held back, waiting for a kit to land it with landBank. */
  bank?: number;
  /** Its next moves reach farther or tighter: wide adds the foe's reserves to a one-foe hit, tight puts an every-foe hit on the out foe. */
  reach?: { mode: 'wide' | 'tight'; uses: number } | null;
  /** Passives other whorls lent it for some of its own turns. Their hooks run as its own until the turns run out or it leaves. */
  lent?: { id: string; turns: number }[];
  /** Shots left in each slot whose move has `ammo`. A missing entry is a full load. */
  ammo?: number[];
  /** Marks that carry a channel this fighter started: they end when an interrupt or leaving the field ends the channel. */
  chan?: { side: 0 | 1; idx: number; id: string }[] | null;
  /** The field state's id, copied onto every fighter so hooks reach it on battle copies. */
  fld?: string | null;
  /** The id of the ground under its side, copied onto every fighter on that side so hooks reach it. */
  gnd?: string | null;
  /** Its own turns left up off the ground: dashes from whorls on the ground cannot reach it, and grounds do not touch it. */
  up?: number;
  /** Ticks its next attack or move is taken in for: the turn is spent and the action comes back out that much later. */
  takeIn?: number | null;
  /** While it rides a foe off its own side, that foe as side * 8 + idx + 1. */
  latch?: number;
  /** While it is a flock: the HP of one body, and its own turns left. A one-target hit takes at most the front body. */
  flock?: { body: number; turns: number } | null;
  /** Knocked out but glowing on over its side: its side's turns left, and the share of max HP it heals its side's out whorl at each. */
  glow?: { turns: number; heal: number } | null;
  /** Poise: damage it can still take before a foe's Stun, Sleep, Root, Slow, and delays land on it again. */
  poise?: number;
  /** In cold storage on its own bench: its side's turns left, and the share of max HP it heals at each. */
  stored?: { turns: number; heal: number } | null;
  /** Fractured: heals cannot take it above `cap` of its max HP until its own turns run out. `at` is the turn number it cracked on. */
  fracture?: { cap: number; turns: number; at: number } | null;
  /**
   * In a body trade: its partner as side * 8 + idx + 1, the trader's own turns left (-1 for the partner), the turn number it
   * began, and how many moves it had spent for good then.
   */
  swap?: { with: number; turns: number; at: number; spent?: number } | null;
  /** A mirage: HP the other side sees on it beyond what it has, for some of its own turns. `at` is the turn number it was laid on. */
  mirage?: { hp: number; turns: number; at: number } | null;
  /** Lying in wait: the move it casts first as the other side starts its next action. */
  wait?: { move: string } | null;
  /** A keepsake: a move it kept during this battle, held in a fifth slot after its own four. */
  keepsake?: string | null;
  /** A moment of this whorl sealed earlier: what it goes back to when the moment comes due. */
  kept?: { hp: number; shield: number; shieldTurns: number; s: { [k in StatusId]?: StatusVal }; m: { [id: string]: MarkVal } } | null;
  /** Items made or handed over during this battle: notion ids whose hooks the fighter carries on top of its own notion. */
  items?: string[];
  /** Moves with `once` it has used: each one's slot holds the move's `next` for good, through resets and restored pasts. */
  spent?: string[];
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
  /** The ground under this side: its id, rounds left, the side and index of the whorl that laid it, and the turn number it was laid on. */
  ground?: { id: string; turns: number; from: 0 | 1; by: number; at: number } | null;
  /** While it lasts, tide this side would gain goes to side `to`: rounds left and the turn number it was set on. */
  hold?: { to: 0 | 1; turns: number; at: number } | null;
  /** A shield over the whole side: it takes hits on any of the side's whorls before their own shields, for some rounds. */
  mantle?: { hp: number; turns: number; at: number } | null;
  /** While it lasts, a whorl is wedged between this side's out whorl and its bench: no switching, and no help from the reserves. */
  cut?: { turns: number; at: number } | null;
  /** While it lasts, this side's out whorl goes to the back of the line after each of its turns, and the next one comes out. */
  spin?: { turns: number } | null;
  /** While it lasts, every crest on this side costs `add` more tide, or less when `add` is below 0. */
  price?: { add: number; turns: number; at: number } | null;
  /** Pink tide: n of this side's tide cannot pay for a crest until it runs clear after `turns` rounds. */
  pink?: { n: number; turns: number; at: number } | null;
  /** Bench fog: while it lasts, nothing from the other side reaches this side's reserves. */
  fog?: { turns: number; at: number } | null;
  /** Shut in: while it lasts, this side's switch goes after the other side's action in a joint round. */
  shut?: { turns: number; at: number } | null;
  /** HP held in this side's house: heals past full pour in, and the next whorl to come out drinks it. */
  pool?: number;
  /** Sticky marks left by a whorl that went, waiting for the next whorl this side sends out. */
  stuck?: { id: string; mv: MarkVal }[];
}

export interface Pending {
  id: number;
  at: number;
  /** 'echo' casts `move` again as fighter `idx` of `side` at data.power percent (castMove). */
  /** 'held' is an attack (data.attack 1) or `move` a cave took in. It comes back out at `at`, free, if that whorl is still out. */
  kind: 'windup' | 'hemo' | 'monsoon' | 'storm' | 'summon' | 'echo' | 'held';
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

/** `visit` marks an event about a whorl visiting from the future (Still Minute's rewind) rather than the whorl in its slot. */
export type Ev = { snap?: Snap; past?: boolean; visit?: boolean } & (
  | { e: 'msg'; text: string }
  | { e: 'field'; id: string | null }
  | { e: 'round'; joint: boolean; first: 0 | 1 }
  | { e: 'use'; side: 0 | 1; idx: number; move: string; name: string; opt?: number }
  // The time machine: the caster boards it in the present, it arrives beside its side in the past, and it departs again. At a
  // trade the visitor steps out to stay in the place of the ally in slot idx, and that ally, which looks like `sprite`, boards.
  | { e: 'ship'; side: 0 | 1; idx: number; at: 'board' | 'arrive' | 'trade' | 'depart'; sprite?: SpriteData }
  | { e: 'dmg'; side: 0 | 1; idx: number; amt: number; kind: 'P' | 'M' | 'T'; eff: number; shield: number }
  | { e: 'heal'; side: 0 | 1; idx: number; amt: number }
  // A knocked-out whorl comes back with hp.
  | { e: 'rise'; side: 0 | 1; idx: number; hp: number }
  // The battle went back to an earlier moment: how every whorl stood then, who was out, and the field.
  | { e: 'rewind'; hp: number[][]; shield: number[][]; ko: boolean[][]; gone: boolean[][]; out: [number, number]; field: string | null }
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
  /** The level every whorl fights at when sync is on. Without it, SYNC_LV. */
  syncLv?: number;
  canRun: boolean;
  /** Story battles that always end in a catch (Full). */
  scripted?: string;
  /** The battle is on the Strand. Kits may read strand and tideHigh. */
  strand?: boolean;
  /** On the Strand, whether the tide is in. */
  tideHigh?: boolean;
  /** On the Strand at low tide: a star lands every this many rounds and gives both sides 2 tide. */
  starEvery?: number;
  /** Every turn is a solo turn, as before joint rounds. For comparisons in the tools. */
  solo?: boolean;
}

/**
 * A solo turn asks one side. A joint round asks both at once, and neither sees the other's choice until it resolves. A visit
 * asks the side whose whorl went back in time which of its moves to cast there (Battle.visit).
 */
export type Decision =
  | { kind: 'act'; side: 0 | 1 }
  | { kind: 'joint' }
  | { kind: 'replace'; side: 0 | 1 }
  | { kind: 'visit'; side: 0 | 1 }
  | { kind: 'over'; winner: 0 | 1 | 'run' | 'peg' };

/**
 * An action chosen in a joint round, waiting for its turn on the timeline. `at` is when it resolves, `sched` the side's
 * own turn time that its weight counts from, `tier` its order class (2 run, switch, and guard, 1 quick, 0 plain, -1 late),
 * and `who` the fighter that chose it, so a choice dies with a whorl that left.
 */
export interface Queued { side: 0 | 1; a: Action | null; at: number; sched: number; tier: number; who: number; rank: number; kind: 'act' | 'skip' | 'forced' }

/** The round in progress: its number, whether both sides chose, each side's choice, and which sides have acted. */
export interface Round { n: number; joint: boolean; commits: [Action | null, Action | null]; done: [boolean, boolean]; first: 0 | 1 }

/** One decision point of a real battle: the battle as it stood, the decision waiting, and what each side chose there. */
export interface PastStep { snap: Battle; need: Decision; acts: [Action | null, Action | null]; turnNo: number }

/**
 * A rewind waiting on its visitor's choice. `side` and `idx` name the caster, `crest` the crest it cast, and `body` the caster
 * as it stood when it left. `steps` are the recorded decisions to play again from the moment it arrived at, up to `until`, the
 * battle time it left at. `present` is the battle it left, kept in case the replay fails, and `back` the rounds it went back.
 * With `here` set there was no past to go to, so the choice is cast in the present.
 */
export interface Visit {
  side: 0 | 1; idx: number; crest: string; body: Fighter;
  steps: PastStep[]; until: number; present: Battle | null; back: number; here: boolean;
}

export interface Battle {
  t: number;
  s: [Side, Side];
  pend: Pending[];
  ev: Ev[];
  quiet: boolean;
  /** Set by the battle screen: every event then carries a Snap of what the screen shows. */
  lanes?: boolean;
  /** The side that reads the events and snaps as its own and that defaults to the side marked `player`. */
  view?: 0 | 1;
  rules: Rules;
  over: null | 0 | 1 | 'run' | 'peg';
  /** True when `advance` gave up after 500 steps with no decision and named side 1 the winner, so the result is not a real one. */
  stalled?: boolean;
  need: Decision | null;
  pid: number;
  turnNo: number;
  /** The last round that fatigue has already struck. */
  fatigued?: number;
  /** The last round a star landed on the field. */
  starred?: number;
  /** Stars a kit called down off their schedule. */
  starsCalled?: number;
  /** While it lasts the sea is out: a star falls every round, and attacks gain no tide. */
  lowWater?: { turns: number; at: number } | null;
  /** The last round whose round start hooks have run. */
  roundSeen?: number;
  /** The range between the two out whorls, Near or Far, and which whorls were out when it was set. A switch ends it. */
  range?: { at: 'near' | 'far'; o0: number; o1: number } | null;
  /** A bout between two out whorls: who is in it on each side, rounds won, damage each dealt the other this round, and rounds left. */
  bout?: { f0: number; f1: number; score: [number, number]; dealt: [number, number]; left: number } | null;
  /** Wind across the field toward side `to`, for some rounds on the field state's clock. Projectiles thrown with it hit harder. */
  wind?: { to: 0 | 1; turns: number; at: number } | null;
  /** The swell: turns counted toward the ninth wave, which breaks over both out whorls at 9. `at` is the turn number it last rose on. */
  swell?: { n: number; at: number } | null;
  /** The real battle's last decision points, newest last, for a rewind. AI copies never carry them. */
  past?: PastStep[] | null;
  /** A rewind that starts as soon as the action in hand resolves: who asked, the crest that asked, its slot, and the battle time it asked at. */
  rewindReq?: { side: 0 | 1; idx: number; crest: string; slot: number; at: number } | null;
  /** A rewind in the past, waiting on its visitor's choice. */
  visit?: Visit | null;
  /** Set while a side's turn is in progress (between startTurn and endTurn). */
  acting: 0 | 1 | null;
  /** While an aimed action runs: the side aiming and the summon its single-target hits go to. */
  aim?: { side: 0 | 1; uid: number } | null;
  /** Joint-round choices waiting for their turn, earliest first. */
  queue: Queued[];
  /** The current round, or null before the first one. */
  rnd: Round | null;
  /** Which side wins the next exact tie in a round. It alternates. */
  tie: 0 | 1;
  /** While a queued choice resolves: the side's own turn time, which its next turn counts from. */
  turnBase?: number | null;
  /** The side choosing its measured action in the middle of a round, after the foe's action. */
  waited?: 0 | 1 | null;
  /** True while a joint round reopens because both sides measured: Measure is not offered again. */
  measureOff?: boolean;
  /** The field state: its id, rounds left, the side that set it (-1 for neither), and the turn number it was set on. */
  field: { id: string; turns: number; by: 0 | 1 | -1; at: number } | null;
  /** The battle clock in minutes after midnight, once a whorl that keeps time has started it. Each turn moves it on 10 minutes. */
  clock?: number | null;
  /** Drops lying on the field for either side to take: the drop's id, a uid, rounds left, and the turn number it fell on. */
  drops?: { id: string; uid: number; turns: number; at: number }[];
  pegged: number[];
  stats: { kos: [number, number]; interrupts: number; bigMoves: number; switches: number; leadChanges: number; lastLead: number; actions: number };
}

export type Action =
  | { k: 'attack'; aim?: number }
  | { k: 'move'; i: number; target?: number; tagTo?: number; aim?: number; opt?: number }
  | { k: 'guard' }
  | { k: 'switch'; to: number }
  | { k: 'peg'; peg: string }
  | { k: 'run' }
  | { k: 'notion' }
  // Takes the drop whose uid is i off the field.
  | { k: 'take'; i: number }
  // Measure: waits for the foe's action in a joint round, then chooses.
  | { k: 'wait' };
