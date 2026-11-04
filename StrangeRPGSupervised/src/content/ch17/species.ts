// Area 17, core: Qwen's Ruin (Notes/qwen/dregs.json), written by tools/build_dregs.mjs.
import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH17_SPECIES: Record<string, SpeciesData> = {
  'time_tick': {
    name: "Tick Tock",
    types: [Type.Stone],
    baseStats: { hp: 28, atk: 12, def: 14, res: 8, mgk: 6, agi: 18, cha: 4 },
    moves: ['stone_fist', 'rock_throw', 'crack_step', 'fortify_stance'],
    passive: "Skip Turn",
    attackKind: AttackKind.Physical,
    description: "A stone crab that ticks forward in time, skipping turns but aging rapidly.",
  },
  'gravity_well': {
    name: "Heavy Rock",
    types: [Type.Stone],
    baseStats: { hp: 34, atk: 10, def: 18, res: 6, mgk: 4, agi: 4, cha: 4 },
    moves: ['granite_slam', 'stone_wall', 'earthquake', 'rock_barrage'],
    passive: "Pull",
    attackKind: AttackKind.Physical,
    description: "A dense boulder that pulls enemies closer and increases their weight.",
  },
  'echo_shard': {
    name: "Echo Stone",
    types: [Type.Aether],
    baseStats: { hp: 24, atk: 14, def: 8, res: 12, mgk: 14, agi: 12, cha: 8 },
    moves: ['schist_dive', 'mirror_reflect', 'prism_beam', 'glass_shatter'],
    passive: "Repeat",
    attackKind: AttackKind.Magic,
    description: "A hollow crystal that repeats the last move used against it.",
  },
  'void_leak': {
    name: "Void Puddle",
    types: [Type.Void],
    baseStats: { hp: 22, atk: 8, def: 10, res: 14, mgk: 16, agi: 6, cha: 10 },
    moves: ['void_bite', 'abyssal_gaze', 'corrode', 'void_burst'],
    passive: "Drain",
    attackKind: AttackKind.Magic,
    description: "A stain of darkness that drains stats from anything standing on it.",
  },
  'ash_wisp_2': {
    name: "Ash Ghost",
    types: [Type.Fire],
    baseStats: { hp: 26, atk: 16, def: 6, res: 10, mgk: 12, agi: 16, cha: 6 },
    moves: ['flame_tongue', 'scorch', 'ash_cloud', 'ember_throw'],
    passive: "Burn",
    attackKind: AttackKind.Magic,
    description: "A floating ember that leaves a trail of fire when it moves.",
  },
  'corrupt_vessel': {
    name: "Broken Vessel",
    types: [Type.Stone],
    baseStats: { hp: 34, atk: 20, def: 18, res: 16, mgk: 18, agi: 8, cha: 10 },
    moves: ['glass_shatter', 'void_burst', 'earthquake', 'mirror_reflect'],
    passive: "Hollow Core",
    attackKind: AttackKind.Magic,
    description: "The Great Vessel, shattered and weeping void energy.",
  },
};
