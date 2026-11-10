export type Kind = 'road' | 'well' | 'town' | 'peak';
export type Charter = 'acres' | Kind;
export type CharId = 'perch' | 'deed' | 'auger' | 'offset' | 'lot' | 'either';
export type Law = 'none' | 'fees' | 'market' | 'parity' | 'headcount' | 'second' | 'frontier' | 'quiet' | 'witness';
export type AmendId = 'openfull' | 'doubtties' | 'second_kind' | 'binding' | 'peace' | 'deepwells';

export const BLANK = 0, OPEN = 1, FIXED = 2;

export interface Tile {
  st: number;
  a: Kind;
  b: Kind;
  k: Kind | null;
  peg: number;
  official: boolean;
  site: string | null;
  den: string | null;
  denHp: number;
  offer: string[] | null;
  by: number;
}

export interface Draft { a: Kind; b: Kind; den: string | null }

export interface Companion {
  id: string;
  /** 0 undecided, 1 reading A, 2 reading B. */
  fixed: number;
  /** Reading whose board power is active while undecided. */
  active: number;
  down: boolean;
  /** A struck reading: one image, cannot be struck again. */
  half: boolean;
}

export interface RelicHeld { id: string; r: number }

export interface ClaimCard { a: string; b: string }

export interface PlayerStats {
  measures: number; sketches: number; pegs: number; works: number; contests: number; contestsWon: number;
  dealsMade: number; dealsRefused: number; promisesKept: number; promisesBroken: number;
  objections: number; unmeasures: number; actions: Record<string, number>;
}

export interface Player {
  idx: number;
  char: CharId;
  human: boolean;
  x: number; y: number; sx: number; sy: number;
  ink: number; doubt: number; steps: number;
  hand: Draft[];
  pegs: number;
  ret: Companion[];
  cap: number;
  claim: ClaimCard | null;
  filed: number;
  filedOrder: number;
  backs: number;
  worked: number[];
  relics: RelicHeld[];
  perks: string[];
  traits: string[];
  hidden: string | null;
  hiddenShown: boolean;
  whole: boolean;
  mark: number;
  lastAct: string;
  proposals: number;
  usedFreeMove: boolean; usedFreeSketch: boolean; usedFreeMeasure: boolean; usedDraft: boolean; usedPage: boolean;
  amended: boolean;
  startedContest: boolean;
  brokePromise: boolean;
  canBlur: boolean;
  intent: string;
  stats: PlayerStats;
}

export interface PromiseRec {
  id: number;
  type: 'truce' | 'read' | 'leave' | 'back';
  who: number;
  to: number;
  c: number;
  k: Kind | null;
  until: number;
  state: 'open' | 'kept' | 'broken';
}

export interface LedgerEntry { season: number; round: number; a: number; b: number; d: number; why: string }

export interface Deal {
  from: number; to: number;
  /** Index 0 is what `from` gives, index 1 is what `to` gives. */
  ink: [number, number];
  doubt: [number, number];
  draft: [number, number];
  truce: number;
  read: { who: number; c: number; k: Kind } | null;
  leave: { who: number; c: number } | null;
  back: number;
}

export interface Unit {
  side: number;
  key: string;
  name: string;
  hp: number; max: number; atk: number; spd: number;
  fixed: boolean;
  two: boolean;
  r: number;
  cd: number;
  guard: boolean;
  cover: boolean;
  stun: boolean;
  weak: number;
  buff: number;
  leader: boolean;
  comp: number;
  half: boolean;
  down: boolean;
  owner: number;
  grow: number;
}

export interface Battle {
  att: number;
  def: number;
  kind: 'pawn' | 'peg' | 'den';
  cell: number;
  units: Unit[];
  round: number;
  queue: number[];
  qi: number;
  pool: [{ ink: number; doubt: number }, { ink: number; doubt: number }];
  ratio: number;
  boss: string | null;
  lastSkill: string | null;
  bubbleUsed: [boolean, boolean];
  done: boolean;
  winner: number;
  withdrew: boolean;
  log: string[];
  auto: boolean;
}

export type Pending =
  | { t: 'turn'; p: number }
  | { t: 'object'; p: number; m: number; c: number; k: Kind; queue: number[]; peg: boolean; free: boolean }
  | { t: 'insist'; p: number; o: number; c: number; k: Kind; peg: boolean; free: boolean }
  | { t: 'deal'; p: number; deal: Deal }
  | { t: 'battle'; p: number }
  | { t: 'bid'; p: number; bids: number[] }
  | { t: 'steer'; p: number }
  | { t: 'relic'; p: number; id: string }
  | { t: 'done'; p: number };

export type Action =
  | { t: 'move'; d: number }
  | { t: 'sketch'; h: number; c: number }
  | { t: 'measure'; c: number; k: Kind; peg: boolean }
  | { t: 'peg'; c: number }
  | { t: 'work'; c: number; pick: number }
  | { t: 'contest'; target: 'pawn' | 'peg' | 'den'; who: number }
  | { t: 'file'; r: number }
  | { t: 'unmeasure'; c: number }
  | { t: 'propose'; deal: Deal }
  | { t: 'gift'; to: number; ink: number; doubt: number }
  | { t: 'back'; who: number }
  | { t: 'blur'; i: number }
  | { t: 'active'; i: number; r: number }
  | { t: 'dismiss'; i: number }
  | { t: 'buypeg'; c: number }
  | { t: 'amend'; id: AmendId; k: Kind | null }
  | { t: 'sendhalf'; i: number; to: number }
  | { t: 'end' }
  | { t: 'object'; yes: boolean }
  | { t: 'insist'; yes: boolean }
  | { t: 'answer'; yes: boolean }
  | { t: 'bid'; n: number }
  | { t: 'steer'; d: number }
  | { t: 'relic'; r: number }
  | { t: 'bat'; a: 'strike' | 'skill' | 'pin' | 'blur' | 'guard' | 'withdraw'; target: number; r: number };

export interface GameEvent { t: string; p?: number; c?: number; k?: Kind | null; n?: number; s?: string; q?: number; x?: number; y?: number; data?: unknown }

export interface Flags {
  doubt: boolean; locals: boolean; fights: boolean; trades: boolean; promises: boolean; claims: boolean;
  backing: boolean; objection: boolean; unmeasure: boolean; level: boolean; amend: boolean;
}

export interface SeasonResult {
  winner: number;
  by: 'charter' | 'claim';
  claim: string | null;
  counts: number[];
  rank: number[];
  deputies: number[];
}

export interface State {
  rng: number;
  season: number;
  round: number;
  rounds: number;
  turn: number;
  order: number[];
  W: number; H: number;
  tiles: Tile[];
  players: Player[];
  holder: number;
  charter: Charter;
  law: Law;
  amend: { id: AmendId; k: Kind | null; by: number }[];
  pile: Draft[];
  deck: string[];
  halves: Record<string, string>;
  trust: number[][];
  ledger: LedgerEntry[];
  promises: PromiseRec[];
  nextPromise: number;
  pending: Pending;
  battle: Battle | null;
  events: GameEvent[];
  quiet: boolean;
  struck: Record<Kind, number>;
  flags: Flags;
  level: { x: number; y: number; alive: boolean } | null;
  quarry: boolean;
  fileCount: number;
  dealLog: string[];
  lead: number;
  leadChanges: number;
  over: boolean;
  result: SeasonResult | null;
  difficulty: number;
  scripted: Record<string, number>;
  lost: string[];
}
