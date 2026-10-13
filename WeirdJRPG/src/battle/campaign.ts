// Every fight in story order, with the party the story gives the player at that point. Shared by the simulators.
import { type PartyIn, DISH_STOCK, STATE_FMAX } from './model';

export interface Stage {
  name: string; chapter: number; groups: string[]; state: number; up: number; vorn: number; lb: boolean;
  senses: PartyIn['senses']; worn?: string; slots?: string[];
  /** The mechanic this stage introduces, as the action ids that use it. */
  teaches?: string[];
}

const S1 = { sight: 1, touch: 1 };
const S2 = { sight: 1, touch: 1, hearing: 1, taste: 1 };
const S3 = { ...S2, smell: 1, thought: 1 };
const S4 = { sight: 2, touch: 1, hearing: 2, taste: 1, smell: 1, thought: 1 };

export const STAGES: Stage[] = [
  { name: 'plaza', chapter: 1, groups: ['tut_bird', 'plaza_mites'], state: 0, up: 0, vorn: 0, lb: true, senses: S1, teaches: ['strip'] },
  { name: 'tower', chapter: 1, groups: ['tower_golem', 'tower_beasts', 'tower_mix', 'tower_birds'], state: 0, up: 10, vorn: 1, lb: true, senses: { ...S1, hearing: 1 } },
  { name: 'library', chapter: 1, groups: ['lib_moths', 'lib_mix', 'lib_child', 'lib_soldier'], state: 1, up: 25, vorn: 1, lb: true, senses: { ...S1, hearing: 1 }, teaches: ['extract_memory', 'absorb'] },
  { name: 'gardens', chapter: 1, groups: ['garden_wisps', 'garden_blades', 'garden_mix', 'storm_brass', 'storm_brass2', 'storm_brass3'], state: 1, up: 40, vorn: 1, lb: true, senses: S2, worn: 'brass' },
  { name: 'rage', chapter: 1, groups: ['garden_rage'], state: 1, up: 55, vorn: 1, lb: true, senses: S2, worn: 'brass' },
  { name: 'watchman', chapter: 1, groups: ['boss_watchman'], state: 2, up: 70, vorn: 1, lb: true, senses: S2, worn: 'brass', slots: ['Protection'], teaches: ['extract_emotion'] },
  { name: 'sea', chapter: 2, groups: ['sea_crabs', 'sea_gulls', 'sea_walker', 'light_child', 'light_mix'], state: 2, up: 90, vorn: 2, lb: true, senses: S2, worn: 'brass', slots: ['Protection'] },
  { name: 'reef', chapter: 2, groups: ['reef_coral', 'reef_fish', 'reef_mix', 'storm_names'], state: 3, up: 120, vorn: 2, lb: true, senses: S3, worn: 'coral', slots: ['Protection'], teaches: ['extract_name'] },
  { name: 'current', chapter: 2, groups: ['current_nothing', 'current_mix', 'current_child'], state: 3, up: 140, vorn: 2, lb: true, senses: S3, worn: 'coral', slots: ['Protection'] },
  { name: 'archive', chapter: 2, groups: ['archive_paper', 'archive_collect', 'archive_mix', 'boss_archive'], state: 3, up: 160, vorn: 2, lb: true, senses: S3, worn: 'coral', slots: ['Protection'] },
  { name: 'year', chapter: 3, groups: ['year_teeth', 'year_meat', 'year_drones', 'year_symbol', 'boss_despair'], state: 3, up: 200, vorn: 3, lb: false, senses: S3, worn: 'coral', slots: ['Protection'] },
  { name: 'stone', chapter: 4, groups: ['stone_shards', 'stone_silence', 'stone_eater', 'stone_motes', 'vault_beings', 'vault_mix'], state: 4, up: 240, vorn: 4, lb: false, senses: S3, worn: 'crystal', slots: ['Protection', 'Order'], teaches: ['weave', 'unmake'] },
  { name: 'void', chapter: 4, groups: ['void_eaters', 'void_fragment', 'mini_voidwalker'], state: 4, up: 280, vorn: 4, lb: false, senses: S3, worn: 'crystal', slots: ['Protection', 'Order'] },
  { name: 'lbend', chapter: 4, groups: ['boss_lbend'], state: 4, up: 320, vorn: 4, lb: false, senses: S3, worn: 'crystal', slots: ['Protection', 'Order'] },
  { name: 'guardian', chapter: 5, groups: ['boss_guardian'], state: 5, up: 360, vorn: 5, lb: false, senses: S4, worn: 'own', slots: ['Protection', 'Order', 'Hope'], teaches: ['unseeing', 'embrace', 'silence', 'devour', 'oblivion', 'awakening'] },
];

/** Story fights that unlock an action early, as the field script passes it to the battle. */
export const SCRIPTED: Record<string, string[]> = { garden_rage: ['emotion'] };

export const CHAPTER_NAME = ['', 'The Brass Dreamscape', 'The Between-Sea', 'The Year 1977', 'The Stone-Deep', 'The Final Choice'];

export function fmaxAt(st: Stage): number { return STATE_FMAX[st.state] + Math.floor(st.up / 10); }

/** The party at a stage, steadied (Fragility at 60 percent) and fully mended. */
export function party(st: Stage): PartyIn {
  const fmax = fmaxAt(st);
  const vmax = 60 + st.vorn * 25, vatk = 32 + st.vorn * 14;
  return {
    f: Math.round(fmax * 0.6), state: st.state, up: st.up, senses: st.senses, worn: st.worn || null, slots: st.slots || [],
    vorn: st.vorn ? { hp: vmax, max: vmax, atk: vatk, lastStand: st.vorn >= 4 } : null,
    lb: st.lb ? { hp: 26 + 16, max: 26 + 16, pantry: { ...DISH_STOCK } } : null,
    avatar: 'snake', weaveKnown: st.state >= 1,
  };
}
