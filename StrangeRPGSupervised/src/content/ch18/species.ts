// Area 18, depths: Qwen's Ruin (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH18_SPECIES: Record<string, SpeciesData> = {
  'slag_warden': {
    name: "Slag Warden",
    types: [Type.Fire],
    baseStats: { hp: 30, atk: 16, def: 18, res: 14, mgk: 6, agi: 6, cha: 4 },
    moves: ['scorch', 'smoke_screen', 'fire_tail', 'ash_cloud'],
    passive: "Heat Soak",
    attackKind: AttackKind.Physical,
    description: "A fused husk of cooled lava and ash, immune to heat.",
  },
  'ember_mite': {
    name: "Ember Mite",
    types: [Type.Fire],
    baseStats: { hp: 22, atk: 12, def: 6, res: 8, mgk: 14, agi: 18, cha: 4 },
    moves: ['ember_throw', 'ash_drift', 'scorch', 'smoke_screen'],
    passive: "Swarm",
    attackKind: AttackKind.Physical,
    description: "Tiny, swarming insects made of burning dust.",
  },
  'obsidian_shard': {
    name: "Obsidian Shard",
    types: [Type.Stone],
    baseStats: { hp: 26, atk: 18, def: 14, res: 10, mgk: 8, agi: 12, cha: 6 },
    moves: ['scorch', 'stone_fist', 'glass_slam', 'ash_cloud'],
    passive: "Shatter",
    attackKind: AttackKind.Physical,
    description: "Sharp, black glass formed by rapid cooling.",
  },
  'cinder_wisp': {
    name: "Cinder Wisp",
    types: [Type.Aether],
    baseStats: { hp: 24, atk: 10, def: 8, res: 16, mgk: 18, agi: 14, cha: 10 },
    moves: ['ash_drift', 'void_whisper', 'ember_gale', 'stasis_field'],
    passive: "Drift",
    attackKind: AttackKind.Magic,
    description: "A floating spirit of pure, hot smoke.",
  },
  'pyre_beetle': {
    name: "Pyre Beetle",
    types: [Type.Metal],
    baseStats: { hp: 32, atk: 14, def: 20, res: 12, mgk: 6, agi: 8, cha: 4 },
    moves: ['scorch', 'rust_grind', 'iron_claw', 'metal_bulwark'],
    passive: "Burn",
    attackKind: AttackKind.Physical,
    description: "An armored insect that feeds on burning metal.",
  },
  'fire_weep': {
    name: "Fire Weep",
    types: [Type.Fire],
    baseStats: { hp: 34, atk: 20, def: 16, res: 18, mgk: 14, agi: 10, cha: 8 },
    moves: ['scorch', 'lava_flow', 'ash_cloud', 'inferno_pillar'],
    passive: "Molten Core",
    attackKind: AttackKind.Physical,
    description: "A massive, pulsating heart of molten rage.",
  },
};
