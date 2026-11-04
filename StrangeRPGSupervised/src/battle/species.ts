import { Type } from './types.js';
import { MoveData } from './moves.js';
import { MoveKind, Reach, AttackKind } from './moves.js';
import { CH1_SPECIES } from '../content/ch1/species.js';
import { CH2_SPECIES } from '../content/ch2/species.js';
import { CH3_SPECIES } from '../content/ch3/species.js';
import { CH4_SPECIES } from '../content/ch4/species.js';
import { CH5_SPECIES } from '../content/ch5/species.js';
import { CH6_SPECIES } from '../content/ch6/species.js';
import { CH7_SPECIES } from '../content/ch7/species.js';
import { CH8_SPECIES } from '../content/ch8/species.js';
import { CH9_SPECIES } from '../content/ch9/species.js';
import { CH10_SPECIES } from '../content/ch10/species.js';
import { CH11_SPECIES } from '../content/ch11/species.js';
import { CH12_SPECIES } from '../content/ch12/species.js';
import { CH13_SPECIES } from '../content/ch13/species.js';
import { CH14_SPECIES } from '../content/ch14/species.js';
// Dregs imports (tools/build_dregs.mjs)
import { CH15_SPECIES } from '../content/ch15/species.js';
import { CH16_SPECIES } from '../content/ch16/species.js';
import { CH17_SPECIES } from '../content/ch17/species.js';
import { CH18_SPECIES } from '../content/ch18/species.js';
import { CH19_SPECIES } from '../content/ch19/species.js';
import { CH20_SPECIES } from '../content/ch20/species.js';
// End of Dregs imports

/**
 * A Ruin species definition.
 */
export interface SpeciesData {
  name: string;
  types: Type[];
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    res: number;
    mgk: number;
    agi: number;
    cha: number;
  };
  moves: string[]; // Move keys
  passive: string; // Passive name
  attackKind: AttackKind;
  description: string;
  /** A fused Ruin: the species whose passives it carries. */
  passiveOf?: string[];
}

/**
 * The complete list of species for Ruin.
 */
export const SPECIES: Record<string, SpeciesData> = {
  // --- CHAPTER 1 SPECIES ---
  'glass_sentinel': {
    name: 'Glass Sentinel',
    types: [Type.Stone],
    baseStats: { hp: 25, atk: 12, def: 15, res: 8, mgk: 5, agi: 6, cha: 5 },
    moves: ['glass_slam', 'glaze_shield', 'shard_spray', 'crack_step'],
    passive: 'Glass Armor',
    attackKind: AttackKind.Physical,
    description: 'A stoic guardian of the Kiln.',
  },
  'rust_crawler': {
    name: 'Rust Crawler',
    types: [Type.Metal],
    baseStats: { hp: 22, atk: 14, def: 12, res: 10, mgk: 6, agi: 8, cha: 4 },
    moves: ['rust_grind', 'metal_bulwark', 'spark_burst', 'iron_claw'],
    passive: 'Rust Touch',
    attackKind: AttackKind.Physical,
    description: 'A relentless scavenger of metal.',
  },
  'ash_wisp': {
    name: 'Ash Wisp',
    types: [Type.Aether],
    baseStats: { hp: 18, atk: 10, def: 8, res: 12, mgk: 14, agi: 10, cha: 8 },
    moves: ['ash_drift', 'void_whisper', 'ember_gale', 'stasis_field'],
    passive: 'Ethereal Form',
    attackKind: AttackKind.Magic,
    description: 'A drifting remnant of the Ancients.',
  },
  'kiln_imp': {
    name: 'Kiln Imp',
    types: [Type.Fire],
    baseStats: { hp: 20, atk: 13, def: 9, res: 7, mgk: 11, agi: 12, cha: 6 },
    moves: ['flame_tongue', 'heat_wave', 'inferno_pillar', 'smoke_screen'],
    passive: 'Kiln Born',
    attackKind: AttackKind.Magic,
    description: 'A fiery spirit of the forge.',
  },
  'stone_golem': {
    name: 'Stone Golem',
    types: [Type.Stone],
    baseStats: { hp: 35, atk: 15, def: 18, res: 6, mgk: 4, agi: 3, cha: 5 },
    moves: ['stone_fist', 'rock_throw', 'earthquake', 'fortify_stance'],
    passive: 'Stone Heart',
    attackKind: AttackKind.Physical,
    description: 'An unyielding wall of stone.',
  },
  'keeper_nyx_scout': {
    name: 'Nyx Scout',
    types: [Type.Aether],
    baseStats: { hp: 30, atk: 12, def: 10, res: 14, mgk: 16, agi: 10, cha: 8 },
    moves: ['ash_drift', 'void_whisper', 'ember_gale', 'stasis_field'],
    passive: 'Glass Form',
    attackKind: AttackKind.Magic,
    description: 'A scout for Keeper Nyx.',
  },
  'keeper_nyx': {
    name: 'Keeper Nyx',
    types: [Type.Aether],
    baseStats: { hp: 60, atk: 18, def: 14, res: 20, mgk: 24, agi: 14, cha: 12 },
    moves: ['ash_drift', 'void_whisper', 'ember_gale', 'stasis_field', 'prism_beam', 'glass_shatter'],
    passive: 'Glass Form',
    attackKind: AttackKind.Magic,
    description: 'Keeper of the Aether Seal.',
  },
  'keeper_bram': {
    name: 'Keeper Bram',
    types: [Type.Wood],
    baseStats: { hp: 70, atk: 20, def: 18, res: 16, mgk: 22, agi: 10, cha: 14 },
    moves: ['mud_slap', 'vine_whip', 'thorn_barrage', 'regrowth', 'clay_pound', 'mud_burrow'],
    passive: 'Muddy',
    attackKind: AttackKind.Physical,
    description: 'Keeper of the Wood Seal.',
  },
  'keeper_grom': {
    name: 'Keeper Grom',
    types: [Type.Stone],
    baseStats: { hp: 80, atk: 24, def: 22, res: 14, mgk: 10, agi: 8, cha: 10 },
    moves: ['stone_fist', 'rock_throw', 'earthquake', 'fortify_stance', 'granite_slam', 'stone_wall'],
    passive: 'Stone Heart',
    attackKind: AttackKind.Physical,
    description: 'Keeper of the Stone Seal.',
  },
  'keeper_kyr': {
    name: 'Keeper Kyr',
    types: [Type.Aether],
    baseStats: { hp: 60, atk: 18, def: 14, res: 20, mgk: 24, agi: 14, cha: 12 },
    moves: ['ash_drift', 'void_whisper', 'ember_gale', 'stasis_field', 'prism_beam', 'glass_shatter'],
    passive: 'Glass Form',
    attackKind: AttackKind.Magic,
    description: 'Keeper of the Void Seal.',
  },
  'keeper_tor': {
    name: 'Keeper Tor',
    types: [Type.Fire],
    baseStats: { hp: 90, atk: 28, def: 20, res: 18, mgk: 16, agi: 12, cha: 14 },
    moves: ['flame_tongue', 'heat_wave', 'inferno_pillar', 'smoke_screen', 'scorch', 'fire_tail'],
    passive: 'Magma Core',
    attackKind: AttackKind.Magic,
    description: 'Keeper of the Fire Seal.',
  },
  'keeper_vex': {
    name: 'Keeper Vex',
    types: [Type.Metal],
    baseStats: { hp: 85, atk: 26, def: 24, res: 16, mgk: 18, agi: 14, cha: 12 },
    moves: ['rust_grind', 'metal_bulwark', 'spark_burst', 'iron_claw', 'metal_spray', 'iron_bite'],
    passive: 'Rust Touch',
    attackKind: AttackKind.Physical,
    description: 'Keeper of the Metal Seal.',
  },
  'keeper_syl': {
    name: 'Keeper Syl',
    types: [Type.Metal],
    baseStats: { hp: 80, atk: 24, def: 22, res: 18, mgk: 20, agi: 16, cha: 14 },
    moves: ['iron_bite', 'metal_bulwark', 'spark_burst', 'iron_claw', 'metal_spray', 'rust_grind'],
    passive: 'Iron Shell',
    attackKind: AttackKind.Physical,
    description: 'Keeper of the Metal Seal.',
  },
  'keeper_dun': {
    name: 'Keeper Dun',
    types: [Type.Void],
    baseStats: { hp: 95, atk: 22, def: 20, res: 22, mgk: 24, agi: 18, cha: 16 },
    moves: ['void_bite', 'dark_web', 'shadow_strike', 'abyssal_gaze', 'corrode', 'void_burst'],
    passive: 'Void Walker',
    attackKind: AttackKind.Magic,
    description: 'Keeper of the Void Seal.',
  },
  'keeper_grom_lieutenant': {
    name: 'Grom Lieutenant',
    types: [Type.Stone],
    baseStats: { hp: 75, atk: 22, def: 20, res: 14, mgk: 10, agi: 8, cha: 10 },
    moves: ['stone_fist', 'rock_throw', 'earthquake', 'fortify_stance', 'granite_slam', 'stone_wall'],
    passive: 'Stone Heart',
    attackKind: AttackKind.Physical,
    description: 'A lieutenant of Keeper Grom.',
  },
  ...CH1_SPECIES,
  ...CH2_SPECIES,
  ...CH3_SPECIES,
  ...CH4_SPECIES,
  ...CH5_SPECIES,
  ...CH6_SPECIES,
  ...CH7_SPECIES,
  ...CH8_SPECIES,
  ...CH9_SPECIES,
  ...CH10_SPECIES,
  ...CH11_SPECIES,
  ...CH12_SPECIES,
  ...CH13_SPECIES,
  ...CH14_SPECIES,
  // Dregs species (tools/build_dregs.mjs)
  ...CH15_SPECIES,
  ...CH16_SPECIES,
  ...CH17_SPECIES,
  ...CH18_SPECIES,
  ...CH19_SPECIES,
  ...CH20_SPECIES,
  // End of Dregs species
};
