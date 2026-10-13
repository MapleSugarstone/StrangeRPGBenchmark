// Battle data types. Pure data, no DOM, so the simulator runs in Node.

export type Layer = 'shell' | 'memory' | 'emotion' | 'name';
export const LAYERS: Layer[] = ['shell', 'memory', 'emotion', 'name'];

/** The bible's five enemy categories. Each sets which action hits hardest. */
export type Category = 'shell' | 'memory' | 'emotion' | 'concept' | 'void';
export const CATEGORY_NAME: Record<Category, string> = {
  shell: 'Shell-Bound', memory: 'Memory-Struck', emotion: 'Emotion-Fed', concept: 'Conceptual', void: 'Void-Touched',
};

export type Emotion = 'rage' | 'sorrow' | 'fear' | 'joy' | 'pride' | 'longing' | 'confusion' | 'despair' | 'misery' | 'dread';

/** ground: a wave along the floor that Float dodges. air: anything. mind: hurts the Pilgrim most. void: a worn Shell resists it. strip: takes a Shell. */
export type AttackKind = 'ground' | 'air' | 'mind' | 'void' | 'strip';

export interface EnemyMove {
  name: string;
  kind: AttackKind;
  /** Damage as a fraction of the target's maximum (Fragility for the Pilgrim, health for allies). */
  power: number;
  /** melee: next cell only. any: anywhere. wave: every grounded party member within `reach` cells. */
  range: 'melee' | 'any' | 'wave';
  reach?: number;
  all?: boolean;
  /** Extra effect on a hit. */
  effect?: 'confuse' | 'forget' | 'stun' | 'paperwork' | 'drain' | 'push' | 'heal_self' | 'summon' | 'shell_self' | 'silence_senses' | 'heal_ally';
  /** A heavy move winds up for a round and shows this many locks. */
  heavy?: number;
  /** Line shown when the move is used. */
  line?: string;
  weight?: number;
  /** Only chosen in these boss phases (1-based). */
  phases?: number[];
  summon?: string;
}

export type AiKind = 'brute' | 'caster' | 'skitter' | 'still' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  category: Category;
  /** Fragility in each layer. A missing layer is absent. Every enemy keeps a Name at its core. */
  layers: Partial<Record<Layer, number>>;
  /** What each layer drops when removed. */
  shellKind?: string;
  memory?: string;
  emotion?: Emotion;
  trueName?: string;
  /** The idea that defines it, given when it is unmade. */
  concept: string;
  moves: EnemyMove[];
  ai: AiKind;
  /** Cells it may move per turn. */
  speed?: number;
  /** Cells wide on the battle track. */
  size?: number;
  /** Shows a false next move unless the party can see lies. */
  liar?: boolean;
  /** Handshake can calm it, ending its part of the fight peacefully. */
  peaceful?: boolean;
  /** A guard takes ranged actions aimed at allies behind it. A mender restores its allies. Groups can set it with id@role. */
  role?: 'guard' | 'mender';
  floats?: boolean;
  /** Boss phases: thresholds of remaining Fragility (fractions), with a line on entering each. */
  phases?: { at: number; speaker?: string; text?: string }[];
  boss?: boolean;
  /** Lines spoken at the start and at the end of the fight. */
  intro?: { speaker: string; text: string }[];
  outro?: { speaker: string; text: string }[];
  /** Art id and colors. */
  art: string;
  c1: string;
  c2: string;
  /** Reward of Unraveling points on top of the layers. */
  up?: number;
}

export type ActionId = 'strip' | 'extract_memory' | 'extract_emotion' | 'extract_name' | 'absorb' | 'weave' | 'unmake'
  | 'true_sight' | 'handshake' | 'echo' | 'savor' | 'scent' | 'insight'
  | 'unseeing' | 'embrace' | 'silence' | 'devour' | 'oblivion' | 'awakening' | 'hold';

export type MoveKind = 'walk' | 'slide' | 'float' | 'weave';

export type SenseId = 'sight' | 'touch' | 'hearing' | 'taste' | 'smell' | 'thought';
export const SENSES: SenseId[] = ['sight', 'touch', 'hearing', 'taste', 'smell', 'thought'];
export const SENSE_NAME: Record<SenseId, string> = { sight: 'Sight', touch: 'Touch', hearing: 'Hearing', taste: 'Taste', smell: 'Smell', thought: 'Thought' };
export const SENSE_ACTIVE: Record<SenseId, ActionId> = { sight: 'true_sight', touch: 'handshake', hearing: 'echo', taste: 'savor', smell: 'scent', thought: 'insight' };
export const SENSE_ULT: Record<SenseId, ActionId> = { sight: 'unseeing', touch: 'embrace', hearing: 'silence', taste: 'devour', smell: 'oblivion', thought: 'awakening' };

/** The Unraveling states, from the bible's progression system. */
export const STATES = ['Shell-Thin', 'Memory-Light', 'Emotion-Deep', 'Name-Bound', 'Concept-Walker', 'Void-Touched'] as const;
export const STATE_FMAX = [40, 55, 70, 85, 100, 120];
export const STATE_POW = [60, 72, 86, 102, 120, 140];

export interface HeldConcept { layer: Layer; label: string; emotion?: Emotion; from: string }

export type Dish = 'ravioli' | 'toast' | 'quiche' | 'cake';
export const DISH_NAME: Record<Dish, string> = { ravioli: 'Quasar Ravioli', toast: 'Thousand Smile Sugar Toast', quiche: 'Quiche', cake: 'Sunset Cake' };
export const DISH_STOCK: Record<Dish, number> = { ravioli: 3, toast: 2, quiche: 2, cake: 1 };

/** What the battle needs from the save, and what it hands back. */
export interface PartyIn {
  f: number;
  state: number;
  up: number;
  senses: Partial<Record<SenseId, number>>; // 1: active learned, 2: ultimate learned
  worn: string | null;
  slots: string[];
  vorn: { hp: number; max: number; atk: number; lastStand: boolean } | null;
  lb: { hp: number; max: number; pantry: Record<Dish, number> } | null;
  avatar: string;
  weaveKnown: boolean;
  /** Rules the player has already been told about. */
  taught?: string[];
}

export interface ShellDef { id: string; name: string; text: string; armor: number; voidRes: number; bonus?: 'speed' | 'pow' | 'gain' | 'lies' | 'float' | 'strip' }
export interface ConceptDef { id: string; name: string; text: string }

/** Emotion families: the same family feeds, Bright against Dark overwhelms, Wild against anything else unbalances. */
export const FAMILY: Record<Emotion, 'bright' | 'dark' | 'wild'> = {
  joy: 'bright', pride: 'bright', longing: 'bright',
  sorrow: 'dark', despair: 'dark', misery: 'dark', dread: 'dark',
  rage: 'wild', fear: 'wild', confusion: 'wild',
};

export type Reaction = 'feed' | 'overwhelm' | 'unbalance';
export function reaction(a: Emotion, b: Emotion): Reaction {
  const fa = FAMILY[a], fb = FAMILY[b];
  if (fa === fb) return 'feed';
  if (fa === 'wild' || fb === 'wild') return 'unbalance';
  return 'overwhelm';
}
