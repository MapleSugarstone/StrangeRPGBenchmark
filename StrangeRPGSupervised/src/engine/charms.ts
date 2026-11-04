// What the save carries into battle besides the team: the worn Resonance, the Magnet's strength, and the island's
// Field State; and what beating a Keeper gives.
import type { GameState } from './game_state.js';
import type { Rule } from '../battle/rules.js';
import { RESONANCE, RESONANCE_GOT, MAGNET_LINES, MAGNET_KEEPERS } from '../content/resonance.js';
import { FIELD_STATES } from '../content/field_states.js';
import { islandOf } from './music_director.js';

/** The Magnet starts at strength 2 and grows with the Keepers in MAGNET_KEEPERS. */
export function magnetOf(save: GameState): number {
  return Math.max(2, ...(save.resonance?.owned ?? []).map((k) => MAGNET_KEEPERS[k] ?? 2));
}

/** The worn Resonance's rule, named for battle lines. */
export function wornRules(save: GameState): Rule[] {
  const worn = save.resonance?.worn;
  return worn && RESONANCE[worn] ? [RESONANCE[worn]] : [];
}

/** The Field State a battle on this map happens in, if its island has one. */
export function fieldFor(mapId: string): { name: string; text: string; opens: string } | undefined {
  const island = islandOf(mapId) + 1;
  for (const [name, f] of Object.entries(FIELD_STATES)) if (f.islands.includes(island)) return { name, text: f.text, opens: f.opens };
  return undefined;
}

/** After beating a big fight with this Ruin: the Keeper's Resonance (worn at once) and any growth of the Magnet.
 * Returns the lines to show on the field. */
export function rewardKeeper(save: GameState, bossSpecies: string): { speaker: string; line: string }[] {
  const keeper = Object.keys(RESONANCE).find((k) => bossSpecies === `keeper_${k.toLowerCase()}`);
  if (!keeper) return [];
  const res = (save.resonance ??= { owned: [] });
  if (res.owned.includes(keeper)) return [];
  const before = magnetOf(save);
  res.owned.push(keeper);
  res.worn = keeper;
  const out = [{ speaker: RESONANCE[keeper].name, line: RESONANCE_GOT.replace('{resonance}', RESONANCE[keeper].name) }];
  const after = magnetOf(save);
  if (after > before && MAGNET_LINES[after]) out.push({ speaker: 'Magnet', line: MAGNET_LINES[after] });
  return out;
}
