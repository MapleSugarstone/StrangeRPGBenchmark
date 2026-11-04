// Items and the trader's lines. Names, descriptions, and lines are Qwen's (Notes/qwen/asks/*-items.md); prices and
// effects are the programmer's.
export interface Item { key: string; name: string; description: string; price: number; use: "heal" | "full" | "revive" | "grip" }

export const ITEMS: Item[] = [
  { key: "slag_paste", name: "Slag Paste", description: "Patches the Weep. Restores health.", price: 30, use: "heal" },
  { key: "glaze_seal", name: "Glaze Seal", description: "Closes the crack. Full health.", price: 90, use: "full" },
  { key: "ash_rite", name: "Ash Rite", description: "Reknits dust. Half health return.", price: 120, use: "revive" },
  { key: "heavy_grip", name: "Heavy Grip", description: "Magnet holds tighter. Keeps more HP.", price: 60, use: "grip" },
];

export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.key, i])) as Record<string, Item>;

export const TRADER = {
  open: "Cracks bleed. Powder pays. What do you need?",
  poor: "Empty hands. Empty hands. Go away.",
};

/** How much a Slag Paste restores, as a share of max HP. */
export const PASTE = 0.4;
