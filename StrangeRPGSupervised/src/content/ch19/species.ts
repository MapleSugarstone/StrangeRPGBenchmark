// Area 19, glass: Qwen's Ruin (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH19_SPECIES: Record<string, SpeciesData> = {
  'prism_wisp': {
    name: "Prism Wisp",
    types: [Type.Aether],
    baseStats: { hp: 24, atk: 12, def: 8, res: 14, mgk: 16, agi: 18, cha: 8 },
    moves: ['prism_beam', 'mirror_reflect', 'glass_shatter', 'silica_drain'],
    passive: "Refraction",
    attackKind: AttackKind.Magic,
    description: "A floating shard of colored light that splits into three when struck.",
  },
  'silica_mite': {
    name: "Silica Mite",
    types: [Type.Stone],
    baseStats: { hp: 22, atk: 16, def: 10, res: 6, mgk: 4, agi: 14, cha: 4 },
    moves: ['shard_spray', 'crack_step', 'glass_shatter', 'silica_drain'],
    passive: "Erosion",
    attackKind: AttackKind.Physical,
    description: "Tiny glass insects that burrow into walls to create weak points.",
  },
  'mirror_stalker': {
    name: "Mirror Stalker",
    types: [Type.Aether],
    baseStats: { hp: 28, atk: 14, def: 12, res: 10, mgk: 12, agi: 12, cha: 10 },
    moves: ['mirror_reflect', 'prism_beam', 'shadow_strike', 'silica_drain'],
    passive: "Echo",
    attackKind: AttackKind.Physical,
    description: "A humanoid figure made of polished obsidian that mimics moves.",
  },
  'fracture_crab': {
    name: "Fracture Crab",
    types: [Type.Stone],
    baseStats: { hp: 30, atk: 18, def: 16, res: 8, mgk: 4, agi: 6, cha: 4 },
    moves: ['glass_shatter', 'shard_spray', 'crack_step', 'stone_fist'],
    passive: "Shatter",
    attackKind: AttackKind.Physical,
    description: "A crab with a shell of cracked glass that explodes on death.",
  },
  'vein_glass': {
    name: "Vein Glass",
    types: [Type.Wood],
    baseStats: { hp: 26, atk: 10, def: 14, res: 12, mgk: 10, agi: 8, cha: 12 },
    moves: ['silica_drain', 'vine_whip', 'regrowth', 'glass_shatter'],
    passive: "Sap Siphon",
    attackKind: AttackKind.Physical,
    description: "Crystalline plants that drain moisture from the air to grow sharp.",
  },
  'abyssal_mirror': {
    name: "Abyssal Mirror",
    types: [Type.Aether],
    baseStats: { hp: 34, atk: 18, def: 16, res: 18, mgk: 20, agi: 14, cha: 10 },
    moves: ['prism_beam', 'mirror_reflect', 'glass_shatter', 'void_burst'],
    passive: "Distortion",
    attackKind: AttackKind.Magic,
    description: "A massive floating pane of black glass that reflects reality wrong.",
  },
};
