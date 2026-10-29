// Battle data. The rules in rules.ts work on these with no drawing, so the simulator can run them headless.

export type Side = 'party' | 'foe';
export interface Pos { x: number; y: number }
export type Vec = [number, number];

export interface Status {
  dazzled?: number;
  pinned?: number;
  /** Set after a Pinned wears off, so pins cannot chain. */
  pinGuard?: number;
  hooded?: number;
  late?: number;
  revealed?: number;
}

export interface Intent {
  dest: Pos;
  skill: string;
  /** For skills aimed in any direction. */
  aim?: Vec;
  /** A painted lead: drawn like an intent, does nothing. */
  fake?: boolean;
  /** Melee follows this unit: it lands on them if they are still next to the foe. */
  target?: number;
}

export interface Unit {
  uid: number;
  id: string;
  side: Side;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  pow: number;
  guard: number;
  move: number;
  height: number;
  skills: string[];
  status: Status;
  queue: Intent[];
  fakes: Intent[];
  acted: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  alive: boolean;
  /** A carried light, centered on the unit (lantern men, Bearers). */
  lantern?: { r: number; lowness: number; off: number };
  /** No lead at all, ever (the Unled). Attacks go any way and are never shown ahead. */
  unled?: boolean;
  /** Can stand only in shade (Lot). */
  shadeOnly?: boolean;
  /** Moves only in straight lines (Umbraculum). */
  straight?: boolean;
  boss?: boolean;
  order: number;
  ai: string;
  xp: number;
  mites: number;
  hpHistory: number[];
  /** Mirage: the body is drawn this far from where the unit really is. */
  mirage?: Vec;
  /** Mirror shield: the first hit on it bounces off. */
  shield?: number;
  /** Faces the brightest light and attacks toward it (the Heliotrope). */
  heliotrope?: boolean;
  /** Acts only every other round. */
  slow?: boolean;
  /** Repeats its last attack the round after (Silverfish). */
  lateCopy?: boolean;
  lateNext?: Intent | null;
  /** How many queued moves are already shown and so fixed. */
  committed?: number;
  /** Hidden in the dark unless lit. */
  darkOnly?: boolean;
  /** Its hat hides its intents unless a party member stands next to it. */
  hat?: boolean;
  /** Paints this many false intents each round. */
  painter?: number;
  /** Decoy reflections of a boss (the Warden). */
  decoyOf?: number;
  noted?: number;
  lastMoved?: number;
  guest?: boolean;
  /** Set once a boss has called its reinforcements. */
  addsDone?: boolean;
}

export interface Lamp { x: number; y: number; r: number; lowness: number; owner: number | null; kind: 'lamp' | 'lantern' | 'beam' }
export interface Pane { x: number; y: number; owner: number; ttl: number }
export interface ShadeZone { x: number; y: number; r: number; owner: number; ttl: number }
export interface Replay { skill: string; x: number; y: number; dir: Vec; len: number; owner: number }

export interface Beam { angle: number; lowness: number; x: number; y: number }

export type BEvent =
  | { k: 'move'; uid: number; path: Pos[] }
  | { k: 'skill'; uid: number; skill: string; tiles: Pos[] }
  | { k: 'hit'; uid: number; by: number; dmg: number; turned: boolean }
  | { k: 'heal'; uid: number; amt: number }
  | { k: 'miss'; uid: number }
  | { k: 'down'; uid: number }
  | { k: 'status'; uid: number; status: string }
  | { k: 'lamp'; on: boolean }
  | { k: 'note'; skill: string }
  | { k: 'replay'; x: number; y: number }
  | { k: 'say'; text: string }
  | { k: 'phase'; name: string };

export interface BattleState {
  w: number;
  h: number;
  /** Arena tiles that block movement and light. */
  solid: Uint8Array;
  /** Heat tiles burn whoever ends a round on them unless shaded. */
  heat: Uint8Array;
  dark: boolean;
  sun: { dir: Vec; lowness: number } | null;
  beam: Beam | null;
  lamps: Lamp[];
  panes: Pane[];
  shades: ShadeZone[];
  replays: Replay[];
  units: Unit[];
  round: number;
  rng: () => number;
  events: BEvent[];
  result: 'win' | 'lose' | null;
  group: string;
  learned: string[];
  turnedHits: number;
  /** Rounds in which the party had at least one member under a third of max HP. */
  lowRounds: number;
  difficulty: number;
  nextUid: number;
}
