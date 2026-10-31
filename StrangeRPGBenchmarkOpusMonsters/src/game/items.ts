// Things in the Bag that are not horns, notions, or key items: field items Ouro uses from the menu, and finds to sell at a grotto.
import { G } from './state';

export interface ItemDef {
  id: string;
  name: string;
  /** What a grotto charges, or 0 for a thing no grotto sells. */
  price: number;
  /** What a grotto pays for one. */
  sell: number;
  text: string;
  /** Used from the Bag. Returns true when the menu should close, as it does when the cart takes Ouro away. Content fills it in. */
  use?: () => Promise<boolean>;
}

export const ITEMS: Record<string, ItemDef> = {};
function item(d: ItemDef): void { ITEMS[d.id] = d; }

item({ id: 'saltline', name: 'Salt Line', price: 60, sell: 0, text: 'For 150 steps, wild whorls in the grass will avoid Ouro.' });
item({ id: 'lure', name: 'Lure Shell', price: 200, sell: 0, text: 'The next wild whorl that appears on this map will be its rarest species.' });
item({ id: 'whistle', name: 'Carter\'s Whistle', price: 80, sell: 0, text: 'The cart appears once on any road or beach, taking Ouro to a town they have visited.' });
item({ id: 'beachglass', name: 'Beach Glass', price: 0, sell: 40, text: 'Glass smoothed by the sea, green in hue. Grottos purchase it.' });
item({ id: 'saltcake', name: 'Salt Cake', price: 0, sell: 60, text: 'A block of pan salt. Grottos buy it.' });
item({ id: 'ridertin', name: 'Rider Tin', price: 0, sell: 120, text: 'A sealed tin from a Rider machine. Grottos will buy it.' });
item({ id: 'bellchip', name: 'Bell Chip', price: 0, sell: 150, text: 'Shard of Spire-bell. Humming. Grottos buy.' });
item({ id: 'rainjar', name: 'Jar of Upward Rain', price: 120, sell: 180, text: 'Bottled rain from Bole. Strandmonger pays more.' });
item({ id: 'moonsilt', name: 'Moon Silt', price: 0, sell: 250, text: 'Silt from the Moonwater\'s bed. It sinks slowly upward. Grottos will buy it.' });
item({ id: 'starglass', name: 'Star Glass', price: 0, sell: 400, text: 'Sand fused into glass by the star\'s heat. Grottos will buy it.' });
item({ id: 'ambergris', name: 'Ambergris', price: 0, sell: 600, text: 'Sea-smelling chunk. Grottos buy.' });

/** Field items, in the order a grotto lists them. */
export const FIELD_ITEMS = ['saltline', 'whistle', 'lure'];

export function giveItem(id: string, n = 1): void { G.items[id] = (G.items[id] || 0) + n; }
