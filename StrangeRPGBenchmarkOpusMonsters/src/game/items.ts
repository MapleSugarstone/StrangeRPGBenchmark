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

item({ id: 'saltline', name: 'Salt Line', price: 60, sell: 0, text: 'For 150 steps, wild whorls in the grass step away from Ouro.' });
item({ id: 'lure', name: 'Lure Shell', price: 200, sell: 0, text: 'The next wild whorl to come out on this map is its rarest kind.' });
item({ id: 'whistle', name: 'Carter\'s Whistle', price: 80, sell: 0, text: 'The cart comes once, on any road or beach, and takes Ouro to a town Ouro has been to.' });
item({ id: 'beachglass', name: 'Beach Glass', price: 0, sell: 40, text: 'Glass the sea rubbed smooth and green. Grottos buy it.' });
item({ id: 'saltcake', name: 'Salt Cake', price: 0, sell: 60, text: 'A cake of pan salt. Grottos buy it.' });
item({ id: 'ridertin', name: 'Rider Tin', price: 0, sell: 120, text: 'A tin from a Rider machine, still sealed. Grottos buy it.' });
item({ id: 'bellchip', name: 'Bell Chip', price: 0, sell: 150, text: 'A chip off a bell under Spire. It hums when held. Grottos buy it.' });
item({ id: 'rainjar', name: 'Jar of Upward Rain', price: 120, sell: 180, text: 'Rain that fell up near the Bole, corked. The Strandmonger pays more.' });
item({ id: 'moonsilt', name: 'Moon Silt', price: 0, sell: 250, text: 'Silt off the Moonwater\'s bed. It sinks slowly upward. Grottos buy it.' });
item({ id: 'starglass', name: 'Star Glass', price: 0, sell: 400, text: 'Sand the star\'s heat turned to glass. Grottos buy it.' });
item({ id: 'ambergris', name: 'Ambergris', price: 0, sell: 600, text: 'A gray lump off something very big. Smells of the sea. Grottos buy it.' });

/** Field items, in the order a grotto lists them. */
export const FIELD_ITEMS = ['saltline', 'whistle', 'lure'];

export function giveItem(id: string, n = 1): void { G.items[id] = (G.items[id] || 0) + n; }
