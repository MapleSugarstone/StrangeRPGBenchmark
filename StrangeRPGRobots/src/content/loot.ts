// Loot tables for containers and fallen enemies: items with a count and a chance, plus a gilt range.

export interface LootTable { items: [string, number, number][]; gilt?: [number, number] }
export const LOOT = new Map<string, LootTable>();
export function addLoot(t: Record<string, LootTable>) { for (const [k, v] of Object.entries(t)) LOOT.set(k, v); }

addLoot({
  junk: { items: [['scrap', 2, 0.7], ['krill', 1, 0.4]], gilt: [2, 12] },
  street: { items: [['stim', 1, 0.3], ['krill', 1, 0.5], ['scrap', 1, 0.5]], gilt: [5, 25] },
  med: { items: [['stim', 2, 0.9], ['bigstim', 1, 0.3]] },
  food: { items: [['noodles', 2, 0.8], ['loaf', 1, 0.5], ['eel', 1, 0.3]] },
  gang: { items: [['frag', 1, 0.4], ['stim', 1, 0.6], ['line4', 1, 0.2]], gilt: [20, 60] },
  board: { items: [['stim', 1, 0.7], ['shockgren', 1, 0.4], ['ration', 2, 0.6], ['hush', 1, 0.2]], gilt: [30, 80] },
  tech: { items: [['chip', 2, 0.7], ['scrap', 3, 0.8]], gilt: [10, 40] },
});
