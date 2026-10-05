import type { SpriteSpec } from '../core/sprites';

export type Elem = 'blunt' | 'edge' | 'spark' | 'chill' | 'loud' | 'hush';
export const ELEMS: Elem[] = ['blunt', 'edge', 'spark', 'chill', 'loud', 'hush'];

export type Verb = 'feed' | 'play' | 'pet' | 'praise' | 'listen' | 'promise' | 'forgive' | 'letgo' | 'remember' | 'hello';
export const VERBS: Verb[] = ['feed', 'play', 'pet', 'praise', 'listen', 'promise', 'forgive', 'letgo', 'remember', 'hello'];
export const VERB_NAME: Record<Verb, string> = {
  feed: 'Feed', play: 'Play', pet: 'Pet', praise: 'Praise', listen: 'Listen',
  promise: 'Promise', forgive: 'Forgive', letgo: 'Let go', remember: 'Remember', hello: 'Hello',
};

export interface Stats { hp: number; vp: number; pow: number; wit: number; grd: number; spd: number; }
export const STAT_KEYS: (keyof Stats)[] = ['hp', 'vp', 'pow', 'wit', 'grd', 'spd'];

export type StatusId =
  | 'guard' | 'sleep' | 'mute' | 'tangled' | 'static' | 'weak' | 'haste' | 'slow' | 'shield'
  | 'taunt' | 'return' | 'offended' | 'regen' | 'powup' | 'grdup' | 'dejavu' | 'cover' | 'lastword' | 'tomorrow' | 'focus';

export interface StatusDef { name: string; good: boolean; }
export const STATUS: Record<StatusId, StatusDef> = {
  guard: { name: 'Guard', good: true },
  sleep: { name: 'Asleep', good: false },
  mute: { name: 'Muted', good: false },
  tangled: { name: 'Tangled', good: false },
  static: { name: 'Static', good: false },
  weak: { name: 'Weakened', good: false },
  haste: { name: 'Quick', good: true },
  slow: { name: 'Slowed', good: false },
  shield: { name: 'Shielded', good: true },
  taunt: { name: 'Taunting', good: true },
  return: { name: 'Returning', good: false },
  offended: { name: 'Offended', good: false },
  regen: { name: 'Mending', good: true },
  powup: { name: 'Fired up', good: true },
  grdup: { name: 'Steady', good: true },
  dejavu: { name: 'Deja vu', good: true },
  cover: { name: 'Covering', good: true },
  lastword: { name: 'Last word', good: true },
  tomorrow: { name: 'Due', good: false },
  focus: { name: 'Focused', good: true },
};

export type Target = 'foe' | 'foes' | 'ally' | 'allies' | 'self' | 'dead' | 'any' | 'other';

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cost?: number;
  tgt: Target;
  voice?: boolean;
  kind?: 'phys' | 'wit';
  power?: number;
  heal?: number;
  healVp?: number;
  elem?: Elem;
  hits?: number;
  status?: { id: StatusId; turns: number; chance?: number; pow?: number };
  push?: number;
  speed?: number;
  fx?: string;
  drain?: number;
  revive?: number;
  acc?: number;
  crit?: number;
}

export interface Move { skill: string; w: number; if?: string; }

export interface Kept {
  name: string;
  desc: string;
  mods?: Partial<Stats>;
  resist?: Elem;
  skill?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: SpriteSpec;
  scale?: number;
  lvl: number;
  stats: Stats;
  weak?: Elem[];
  resist?: Elem[];
  immune?: Elem[];
  atkElem?: Elem;
  moves: Move[];
  ai?: string;
  prayer: string;
  ask: Verb;
  askNeed?: 'none' | 'listened' | 'low' | 'alone' | 'late';
  needItem?: string;
  answered?: string;
  xp: number;
  pleas: number;
  drop?: { item: string; chance: number };
  kept?: Kept;
  boss?: boolean;
  noAnswer?: boolean;
  mustAnswer?: boolean;
  noFlee?: boolean;
  lastWord?: string;
  desc?: string;
}

export interface MemberDef {
  id: string;
  name: string;
  cls: string;
  sprite: SpriteSpec;
  prayer: string;
  bio: string;
  base: Stats;
  growth: Stats;
  learn: [number, string][];
  atkElem: Elem;
  weapons: string;
  twin?: boolean;
  learn2?: [number, string][];
}

export interface Unit {
  uid: number;
  side: 0 | 1;
  id: string;
  name: string;
  lvl: number;
  hp: number; mhp: number;
  vp: number; mvp: number;
  pow: number; wit: number; grd: number; spd: number;
  weak: Elem[]; resist: Elem[]; immune: Elem[];
  atkElem: Elem;
  skills: string[];
  skills2?: string[];
  status: { id: StatusId; turns: number; pow?: number }[];
  ct: number;
  alive: boolean;
  bench?: boolean;
  listened?: boolean;
  gone?: 'answered' | 'fled' | 'returned';
  grow?: number;
  lastWordUsed?: boolean;
  pushed?: boolean;
  windup?: { skill: string; breakElem: Elem[]; need: number; got: number; text: string };
  phase?: number;
  turns?: number;
  tookLast?: number;
  tookThis?: number;
  offended?: number;
  twin?: boolean;
  mask?: string;
  answerTries?: number;
  boss?: boolean;
  scale?: number;
}

export type Action =
  | { t: 'attack'; target: number }
  | { t: 'skill'; skill: string; target: number }
  | { t: 'item'; item: string; target: number }
  | { t: 'guard' }
  | { t: 'answer'; verb: Verb; target: number }
  | { t: 'line'; partner: number; tech: string; target: number }
  | { t: 'flee' }
  | { t: 'call'; kept: string; target: number }
  | { t: 'twin'; a: Action; b: Action }
  | { t: 'mask'; kept: string }
  | { t: 'swap'; out: number; inn: number }
  | { t: 'pass' };

export type BEvent =
  | { k: 'msg'; text: string }
  | { k: 'act'; uid: number; name: string }
  | { k: 'dmg'; uid: number; n: number; crit?: boolean; weak?: boolean; resist?: boolean; clean?: boolean; braced?: boolean }
  | { k: 'miss'; uid: number }
  | { k: 'heal'; uid: number; n: number; vp?: boolean }
  | { k: 'status'; uid: number; id: StatusId; on: boolean }
  | { k: 'ko'; uid: number }
  | { k: 'revive'; uid: number }
  | { k: 'answer'; uid: number; ok: boolean }
  | { k: 'leave'; uid: number }
  | { k: 'push'; uid: number }
  | { k: 'windup'; uid: number; text: string }
  | { k: 'break'; uid: number }
  | { k: 'grow'; uid: number }
  | { k: 'swap'; out: number; inn: number }
  | { k: 'summon'; name: string }
  | { k: 'spawn'; uid: number }
  | { k: 'lastword'; uid: number }
  | { k: 'listen'; uid: number };

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: 'use' | 'key' | 'weapon' | 'coat' | 'charm';
  battle?: boolean;
  field?: boolean;
  tgt?: Target;
  heal?: number;
  healPct?: number;
  vp?: number;
  revive?: number;
  cure?: boolean;
  dmg?: number;
  elem?: Elem;
  status?: { id: StatusId; turns: number };
  who?: string;
  atk?: number;
  mods?: Partial<Stats>;
  resist?: Elem;
}
