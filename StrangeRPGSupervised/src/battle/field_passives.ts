// Passives that act outside battle: on grass encounters, on each field step, and at the traders.
import { PASSIVE_CODE } from '../content/passive_code.js';
import { SPECIES } from './species.js';
import type { PassiveCode } from './hooks.js';
import type { GameState } from '../engine/game_state.js';

/** Each party Ruin's passive code with its slot, a fused Ruin carrying its parents'. */
function partyCodes(save: GameState): { slot: number; key: string; code: PassiveCode }[] {
  const out: { slot: number; key: string; code: PassiveCode }[] = [];
  save.party.forEach((species, slot) => {
    const keys: string[] = (SPECIES[species] as any)?.passiveOf ?? [species];
    for (const key of keys) if (PASSIVE_CODE[key]) out.push({ slot, key, code: PASSIVE_CODE[key] });
  });
  return out;
}

/** The chance of meeting a wild Ruin on a grass step, after the lead's passives. */
export function encounterRate(save: GameState, rate: number): number {
  let r = rate;
  for (const { slot, code } of partyCodes(save)) if (slot === 0 && code.encounter) r = code.encounter(save, r);
  return Math.max(0, Math.min(1, r));
}

/** Runs each party Ruin's step passive; returns what any of them says, with the Ruin's name. */
export function afterStep(save: GameState): { speaker: string; text: string }[] {
  const said: { speaker: string; text: string }[] = [];
  for (const { slot, code } of partyCodes(save)) {
    const text = code.step?.(save, slot);
    if (text) said.push({ speaker: SPECIES[save.party[slot]]?.name ?? save.party[slot], text });
  }
  return said;
}

/** An item's price at a trader, after the party's passives. */
export function priceFor(save: GameState, itemKey: string, price: number): number {
  let p = price;
  for (const { code } of partyCodes(save)) if (code.price) p = code.price(save, itemKey, p);
  return Math.max(0, Math.round(p));
}
