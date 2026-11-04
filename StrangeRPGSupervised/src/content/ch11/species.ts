import { Type } from '../../battle/types.js';
import { AttackKind } from '../../battle/moves.js';
import { SpeciesData } from '../../battle/species.js';

export const CH11_SPECIES: Record<string, SpeciesData> = {
  'mud_slug': {
    name: 'Mud Slug',
    types: [Type.Wood],
    baseStats: { hp: 20, atk: 10, def: 12, res: 8, mgk: 6, agi: 5, cha: 4 },
    moves: ['mud_slap', 'vine_whip', 'thorn_barrage', 'regrowth'],
    passive: 'Muddy',
    attackKind: AttackKind.Physical,
    description: 'A slug that leaves a trail of thick mud.',
  },
  'clay_rat': {
    name: 'Clay Rat',
    types: [Type.Stone],
    baseStats: { hp: 18, atk: 12, def: 10, res: 6, mgk: 4, agi: 10, cha: 3 },
    moves: ['stone_fist', 'rock_throw', 'earthquake', 'fortify_stance'],
    passive: 'Stone Heart',
    attackKind: AttackKind.Physical,
    description: 'A rat made of hardened clay.',
  },
  'mire_worm': {
    name: 'Mire Worm',
    types: [Type.Void],
    baseStats: { hp: 22, atk: 14, def: 8, res: 10, mgk: 12, agi: 8, cha: 5 },
    moves: ['void_bite', 'dark_web', 'shadow_strike', 'abyssal_gaze'],
    passive: 'Void Walker',
    attackKind: AttackKind.Magic,
    description: 'A worm that burrows through the void-mud.',
  },
  'clay_golem': {
    name: 'Clay Golem',
    types: [Type.Stone],
    baseStats: { hp: 30, atk: 15, def: 18, res: 6, mgk: 4, agi: 3, cha: 5 },
    moves: ['stone_fist', 'rock_throw', 'earthquake', 'fortify_stance'],
    passive: 'Stone Heart',
    attackKind: AttackKind.Physical,
    description: 'A golem of wet clay.',
  },
  'mire_hinge': {
    name: 'Mire Hinge',
    types: [Type.Wood, Type.Metal],
    baseStats: { hp: 19, atk: 11, def: 14, res: 7, mgk: 5, agi: 6, cha: 3 },
    moves: ['mud_slap', 'rust_grind', 'vine_whip', 'metal_bulwark'],
    passive: 'groan',
    attackKind: AttackKind.Physical,
    description: 'It holds the swamp together with a rusted iron joint that screams when the tide turns.',
  },
  'void_vein': {
    name: 'Void Vein',
    types: [Type.Void, Type.Aether],
    baseStats: { hp: 16, atk: 10, def: 7, res: 12, mgk: 14, agi: 9, cha: 5 },
    moves: ['void_bite', 'void_whisper', 'corrode', 'prism_beam'],
    passive: 'thin',
    attackKind: AttackKind.Magic,
    description: 'A tear in the world\'s skin that pulses with black blood and whispers the names of things that haven\'t happened yet.',
  },
  'kiln_mouth': {
    name: 'Kiln Mouth',
    types: [Type.Fire, Type.Stone],
    baseStats: { hp: 21, atk: 15, def: 12, res: 5, mgk: 8, agi: 5, cha: 4 },
    moves: ['flame_tongue', 'heat_wave', 'stone_fist', 'ash_cloud'],
    passive: 'hot',
    attackKind: AttackKind.Magic,
    description: 'Its face is a cracked furnace door that exhales superheated air, melting the boots of anyone who stands too close.',
  },
};
