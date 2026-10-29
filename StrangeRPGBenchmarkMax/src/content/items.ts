// Items: things used in battle or the field, gear that changes numbers, and key items.

export interface ItemDef {
  id: string;
  name: string;
  /** One plain sentence for the menu. */
  desc: string;
  kind: 'use' | 'gear' | 'key';
  icon: string;
  price?: number;
  use?: { target: 'self' | 'adjacent' | 'party' | 'down' | 'lead'; heal?: number; revive?: number; power?: number };
  gear?: { height?: number; guard?: number; hp?: number; pow?: number; move?: number };
}

export const ITEMS: Record<string, ItemDef> = {
  bandage: { id: 'bandage', name: 'Bandage', desc: 'Heals 6 HP. Use on yourself or someone next to you.', kind: 'use', icon: 'bandage', price: 8, use: { target: 'adjacent', heal: 6 } },
  tonic: { id: 'tonic', name: 'Tonic', desc: 'Heals 4 HP for the whole party.', kind: 'use', icon: 'tonic', price: 22, use: { target: 'party', heal: 4 } },
  salts: { id: 'salts', name: 'Salts', desc: 'Wakes a fallen ally next to you with 5 HP.', kind: 'use', icon: 'salts', price: 30, use: { target: 'down', revive: 5 } },
  pebble: { id: 'pebble', name: 'Pebble', desc: 'Throw it along your lead. 2 damage where it lands.', kind: 'use', icon: 'pebble', price: 1, use: { target: 'lead', power: 2 } },
  hat: { id: 'hat', name: 'Wide hat', desc: 'Keeps your lead private. Guard +1.', kind: 'gear', icon: 'hat', price: 18, gear: { guard: 1 } },
  tall_hat: { id: 'tall_hat', name: 'Tall hat', desc: 'Height +1. A taller lead reaches further.', kind: 'gear', icon: 'hat', price: 40, gear: { height: 1 } },
  stilts: { id: 'stilts', name: 'Stilts', desc: 'Height +1, Move -1.', kind: 'gear', icon: 'stilts', price: 28, gear: { height: 1, move: -1 } },
  coat: { id: 'coat', name: 'Felt coat', desc: 'Guard +1, HP +3.', kind: 'gear', icon: 'coat', price: 34, gear: { guard: 1, hp: 3 } },
  shade_cloak: { id: 'shade_cloak', name: 'Shade cloak', desc: 'Guard +2.', kind: 'gear', icon: 'coat', price: 70, gear: { guard: 2 } },
  lens: { id: 'lens', name: 'Lens', desc: 'Pow +1.', kind: 'gear', icon: 'charm', price: 60, gear: { pow: 1 } },
  charm: { id: 'charm', name: 'Brass charm', desc: 'HP +6.', kind: 'gear', icon: 'charm', price: 45, gear: { hp: 6 } },
  quick_shoes: { id: 'quick_shoes', name: 'Quick shoes', desc: 'Move +1.', kind: 'gear', icon: 'stilts', price: 80, gear: { move: 1 } },
  glass_charm: { id: 'glass_charm', name: 'Glass charm', desc: 'HP +8, Guard +1.', kind: 'gear', icon: 'charm', price: 110, gear: { hp: 8, guard: 1 } },
  ledger: { id: 'ledger', name: 'The Ledger', desc: "Stile's book of leads. Two hundred years of mornings.", kind: 'key', icon: 'ledger' },
  notebook: { id: 'notebook', name: 'Notebook', desc: 'Your own book. The first line says: Lot. Ahead of us.', kind: 'key', icon: 'notebook' },
  oil: { id: 'oil', name: 'Lamp oil', desc: 'Old Bearer stock, still sealed.', kind: 'key', icon: 'oil' },
  lantern: { id: 'lantern', name: 'Festival lantern', desc: 'A light for the dark. It might last.', kind: 'key', icon: 'lantern', price: 2 },
  parhelia_lamp: { id: 'parhelia_lamp', name: "Parhelia's lamp", desc: 'Hooded, on a pole. Nearly dry.', kind: 'key', icon: 'lamp' },
};

export const SHOPS: Record<string, string[]> = {
  stile: ['bandage', 'pebble', 'coat'],
  market_hats: ['hat', 'tall_hat', 'bandage', 'tonic', 'pebble'],
  solehold: ['bandage', 'tonic', 'salts', 'stilts', 'shade_cloak', 'charm'],
  glass: ['tonic', 'salts', 'lens', 'glass_charm'],
  overhead_lanterns: ['lantern', 'tonic', 'salts', 'quick_shoes', 'lens'],
  burrow: ['tonic', 'salts', 'bandage'],
  stile7: ['tonic', 'salts', 'bandage', 'glass_charm', 'quick_shoes'],
};
