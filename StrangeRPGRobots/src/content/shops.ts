// Shops: what each sells. Prices come from the item data. Shops buy anything at a third of its price.

export interface ShopDef { id: string; name: string; items: string[]; /** Price multiplier. */ rate?: number; showIf?: Record<string, string> }

export const SHOPS = new Map<string, ShopDef>();
export function addShops(list: ShopDef[]) { for (const s of list) SHOPS.set(s.id, s); }

addShops([
  { id: 'vend', name: 'Vending machine', items: ['stim', 'krill', 'noodles'], rate: 1.1 },
  { id: 'noodlevend', name: 'Noodle machine', items: ['noodles', 'eel', 'krill'] },
]);
