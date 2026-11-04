// Area 20, rift: Qwen's Ruin (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH20_SPECIES: Record<string, SpeciesData> = {
  'dreg_spore': {
    name: "Dreg Spore",
    types: [Type.Aether],
    baseStats: { hp: 24, atk: 10, def: 14, res: 12, mgk: 16, agi: 8, cha: 4 },
    moves: ['void_whisper', 'ash_drift', 'stasis_field', 'silica_drain'],
    passive: "Heavy Breath",
    attackKind: AttackKind.Magic,
    description: "A floating mold that breathes in silence and exhales heavy air.",
  },
  'glass_mite': {
    name: "Glass Mite",
    types: [Type.Stone],
    baseStats: { hp: 22, atk: 18, def: 8, res: 6, mgk: 8, agi: 16, cha: 4 },
    moves: ['glass_slam', 'shard_spray', 'crack_step', 'stone_fist'],
    passive: "Sharp Trail",
    attackKind: AttackKind.Physical,
    description: "A tiny shard-beast that cuts the ground where it walks.",
  },
  'ash_crawler': {
    name: "Ash Crawler",
    types: [Type.Fire],
    baseStats: { hp: 28, atk: 16, def: 10, res: 8, mgk: 10, agi: 12, cha: 4 },
    moves: ['flame_tongue', 'heat_wave', 'smoke_screen', 'scorch'],
    passive: "Cold Ash",
    attackKind: AttackKind.Physical,
    description: "A burning insect that leaves cold ash behind it.",
  },
  'void_moth': {
    name: "Void Moth",
    types: [Type.Void],
    baseStats: { hp: 26, atk: 12, def: 10, res: 14, mgk: 18, agi: 14, cha: 6 },
    moves: ['void_bite', 'dark_web', 'abyssal_gaze', 'void_burst'],
    passive: "Light Eater",
    attackKind: AttackKind.Magic,
    description: "A pale butterfly that drinks light from the air.",
  },
  'rust_worm': {
    name: "Rust Worm",
    types: [Type.Metal],
    baseStats: { hp: 30, atk: 14, def: 16, res: 8, mgk: 6, agi: 6, cha: 4 },
    moves: ['rust_grind', 'metal_bulwark', 'oxide_bite', 'rust_shield'],
    passive: "Corrode Touch",
    attackKind: AttackKind.Physical,
    description: "A corroded snake that eats metal and spits rust.",
  },
  'weep_matriarch': {
    name: "Weep Matriarch",
    types: [Type.Void],
    baseStats: { hp: 34, atk: 20, def: 18, res: 16, mgk: 20, agi: 12, cha: 10 },
    moves: ['void_burst', 'abyssal_gaze', 'corrode', 'void_whisper'],
    passive: "World Decay",
    attackKind: AttackKind.Magic,
    description: "The source of all decay, a weeping eye of pure void.",
  },
};
