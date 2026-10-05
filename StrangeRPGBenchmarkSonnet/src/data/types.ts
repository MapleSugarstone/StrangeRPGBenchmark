export type Elem = 'ember' | 'frost' | 'volt' | 'lumen' | 'umbra' | 'bloom';
export const ELEMS: Elem[] = ['ember', 'frost', 'volt', 'lumen', 'umbra', 'bloom'];
export const ELEM_ABBR: Record<Elem, string> = { ember: 'EMB', frost: 'FRO', volt: 'VLT', lumen: 'LUM', umbra: 'UMB', bloom: 'BLM' };
export const ELEM_COLOR: Record<Elem, string> = {
  ember: '#ff6a2a', frost: '#6fe0ff', volt: '#ffe34a', lumen: '#fff4c8', umbra: '#b070ff', bloom: '#6fdc5a',
};

export type StatKey = 'hp' | 'mp' | 'atk' | 'mag' | 'def' | 'res' | 'spd';
export type Stats = Record<StatKey, number>;

export type Status =
  | 'burn' | 'chill' | 'shock' | 'regen' | 'sleep' | 'hex' | 'weak'
  | 'ward' | 'haste' | 'stun' | 'focus' | 'taunt';

export type Mech =
  | 'timeline' | 'weakness' | 'nerve' | 'stance' | 'rows' | 'reaction'
  | 'field' | 'gasp' | 'runes' | 'rewind' | 'ascend' | 'dusk';
export const MECH_ORDER: Mech[] = [
  'timeline', 'weakness', 'nerve', 'stance', 'rows', 'reaction',
  'field', 'gasp', 'runes', 'rewind', 'ascend', 'dusk',
];

export type Fx =
  | { k: 'dmg'; s: 'atk' | 'mag'; p: number; e?: Elem; hits?: number; pierce?: number }
  | { k: 'dmgFlat'; n: number; e?: Elem }
  | { k: 'heal'; p: number }
  | { k: 'healFlat'; n: number }
  | { k: 'healPct'; p: number; to?: 'allies' }
  | { k: 'mpFlat'; n: number }
  | { k: 'status'; st: Status; turns: number; chance?: number; to?: 'self' | 'allies' }
  | { k: 'cleanse' }
  | { k: 'revive'; p: number }
  | { k: 'delay'; p: number }
  | { k: 'quicken'; p: number }
  | { k: 'nerve'; n: number }
  | { k: 'selfHp'; p: number }
  | { k: 'drain'; p: number }
  | { k: 'dispense' }
  | { k: 'end' };

export type Target = 'foe' | 'foes' | 'ally' | 'allies' | 'self' | 'fallen';

export interface Skill {
  id: string;
  name: string;
  mp: number;
  tgt: Target;
  fx: Fx[];
  desc: string;
  spd?: number;
  windup?: string;
}

export interface CharDef {
  id: string;
  name: string;
  cls: string;
  blurb: string;
  base: Stats;
  grow: Stats;
  learn: [number, string][];
  limit: string;
  row: 0 | 1;
  weak: Elem;
  resist: Elem;
  joinChapter: number;
  stance: 'steady' | 'fierce' | 'swift';
  colors: [string, string];
}

export interface Item {
  id: string;
  name: string;
  price: number;
  tgt: 'ally' | 'fallen' | 'allies' | 'foe' | 'foes';
  fx: Fx[];
  desc: string;
  tier: number;
}

export interface Gear {
  id: string;
  name: string;
  slot: 'weapon' | 'armor' | 'charm';
  tier: number;
  price: number;
  bonus: Partial<Stats>;
  elem?: Elem;
  desc: string;
}

export interface Rune {
  id: string;
  name: string;
  price: number;
  desc: string;
  mods: Mods;
}

export interface Mods {
  dmgElem?: Partial<Record<Elem, number>>;
  dmgAll?: number;
  lifesteal?: number;
  spdPct?: number;
  defPct?: number;
  mpCut?: number;
  crit?: number;
  thorns?: number;
  nerveGain?: number;
  hpPct?: number;
}

export type Role = 'brute' | 'caster' | 'skirmisher' | 'tank' | 'support';

export interface ScriptEntry {
  s: string;
  n?: string;
  w?: number;
  hp?: [number, number];
  every?: number;
  first?: boolean;
  windup?: string;
  when?: 'partyHurt' | 'selfHurt' | 'allyDown';
}

export interface EnemyDef {
  id: string;
  name: string;
  role: Role;
  arch: string;
  seed: number;
  colors: [string, string];
  weak: Elem[];
  resist: Elem[];
  script: ScriptEntry[];
  boss?: boolean;
  hpMul?: number;
  atkMul?: number;
  spdMul?: number;
  lvlOff?: number;
  immune?: Status[];
  blurb?: string;
}

export interface EncounterDef {
  foes: string[];
  w: number;
}

export interface Field {
  id: string;
  name: string;
  boost?: Elem;
  dampen?: Elem;
  spdMul?: number;
  desc: string;
}
