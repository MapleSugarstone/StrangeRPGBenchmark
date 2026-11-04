// Area 15, undercroft: Qwen's Ruin (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH15_SPECIES: Record<string, SpeciesData> = {
  'slag_mite': {
    name: "Slag Mite",
    types: [Type.Stone],
    baseStats: { hp: 28, atk: 16, def: 14, res: 8, mgk: 6, agi: 12, cha: 4 },
    moves: ['granite_slam', 'rock_throw', 'stone_wall', 'earth_shake'],
    passive: "Molten Drip",
    attackKind: AttackKind.Physical,
    description: "A jagged crust-crab that leaves molten trails.",
  },
  'weep_wisp': {
    name: "Weep Wisp",
    types: [Type.Void],
    baseStats: { hp: 24, atk: 12, def: 8, res: 14, mgk: 16, agi: 18, cha: 8 },
    moves: ['void_bite', 'dark_web', 'abyssal_gaze', 'corrode'],
    passive: "Silence",
    attackKind: AttackKind.Magic,
    description: "A tear in reality that screams silently.",
  },
  'rust_fungus': {
    name: "Rust Fungus",
    types: [Type.Metal],
    baseStats: { hp: 30, atk: 10, def: 16, res: 10, mgk: 8, agi: 6, cha: 4 },
    moves: ['oxide_bite', 'rust_shield', 'metal_spray', 'iron_bite'],
    passive: "Oxidize",
    attackKind: AttackKind.Physical,
    description: "A metallic bloom that eats iron.",
  },
  'ash_shard': {
    name: "Ash Shard",
    types: [Type.Aether],
    baseStats: { hp: 26, atk: 14, def: 10, res: 12, mgk: 14, agi: 16, cha: 10 },
    moves: ['schist_dive', 'wind_shear', 'aether_burst', 'mirror_reflect'],
    passive: "Drift",
    attackKind: AttackKind.Magic,
    description: "A floating fragment of dead starlight.",
  },
  'dreg_mold': {
    name: "Dreg Mold",
    types: [Type.Wood],
    baseStats: { hp: 32, atk: 12, def: 12, res: 10, mgk: 12, agi: 8, cha: 6 },
    moves: ['mud_slap', 'root_snare', 'mud_burrow', 'regrowth'],
    passive: "Spore",
    attackKind: AttackKind.Physical,
    description: "Rot that grows on broken glass.",
  },
  'weep_worm': {
    name: "Weep Worm",
    types: [Type.Void],
    baseStats: { hp: 34, atk: 18, def: 12, res: 16, mgk: 18, agi: 14, cha: 4 },
    moves: ['void_bite', 'corrode', 'abyssal_gaze', 'void_burst'],
    passive: "Decay",
    attackKind: AttackKind.Magic,
    description: "A long, twisting tear in the floor.",
  },
};
