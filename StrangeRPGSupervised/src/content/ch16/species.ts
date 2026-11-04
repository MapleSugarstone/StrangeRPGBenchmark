// Area 16, trench: Qwen's Ruin (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH16_SPECIES: Record<string, SpeciesData> = {
  'damp_whisper': {
    name: "Damp Whisper",
    types: [Type.Void],
    baseStats: { hp: 28, atk: 12, def: 14, res: 12, mgk: 8, agi: 6, cha: 4 },
    moves: ['void_bite', 'dark_web', 'abyssal_gaze', 'corrode'],
    passive: "Echo Trap",
    attackKind: AttackKind.Physical,
    description: "A hollow shell that echoes the last sound it heard, now deafened by the trench's pressure.",
  },
  'blind_coral': {
    name: "Blind Coral",
    types: [Type.Stone],
    baseStats: { hp: 34, atk: 10, def: 18, res: 8, mgk: 6, agi: 4, cha: 4 },
    moves: ['stone_fist', 'stone_wall', 'rock_barrage', 'fortify_stance'],
    passive: "Light Eater",
    attackKind: AttackKind.Physical,
    description: "Pale, porous rock that grows rapidly when touched by light, forming jagged barricades.",
  },
  'vibration_shroom': {
    name: "Tremor Fungus",
    types: [Type.Wood],
    baseStats: { hp: 26, atk: 14, def: 10, res: 10, mgk: 12, agi: 8, cha: 6 },
    moves: ['mud_slap', 'root_snare', 'ash_cloud', 'regrowth'],
    passive: "Tremor Sense",
    attackKind: AttackKind.Physical,
    description: "Fungal clusters that pulse with the trench's tremors, releasing spores when shaken.",
  },
  'slag_urn': {
    name: "Slag Urn",
    types: [Type.Metal],
    baseStats: { hp: 30, atk: 12, def: 16, res: 14, mgk: 10, agi: 4, cha: 8 },
    moves: ['rust_grind', 'rust_shield', 'oxide_bite', 'metal_spray'],
    passive: "Memory Leak",
    attackKind: AttackKind.Physical,
    description: "Rusted vessels containing the preserved memories of drowned Slag, leaking cold fluid.",
  },
  'glass_moth': {
    name: "Glass Moth",
    types: [Type.Aether],
    baseStats: { hp: 22, atk: 16, def: 8, res: 12, mgk: 14, agi: 12, cha: 10 },
    moves: ['prism_beam', 'mirror_reflect', 'glass_shatter', 'silica_drain'],
    passive: "Shard Refraction",
    attackKind: AttackKind.Physical,
    description: "Fragile, translucent insects that refract Shard's light into blinding shards.",
  },
  'trench_leviathan': {
    name: "Weep Sentinel",
    types: [Type.Void],
    baseStats: { hp: 34, atk: 18, def: 16, res: 14, mgk: 16, agi: 12, cha: 10 },
    moves: ['void_bite', 'abyssal_gaze', 'corrode', 'void_burst'],
    passive: "Pressure Crush",
    attackKind: AttackKind.Physical,
    description: "A massive, blind weep with skin like wet slate, hunting by sensing the heartbeat of light.",
  },
};
