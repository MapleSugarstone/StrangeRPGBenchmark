import type { Hue } from '../core/palette';

export interface ItemUse {
  target: 'ally' | 'allies' | 'ko' | 'foe' | 'foes';
  heal?: number;
  ink?: number;
  revive?: number;
  cure?: boolean;
  dmg?: number;
  hue?: Hue | 'rand';
  fx?: string;
}

export interface Equip {
  slot: 'weapon' | 'charm';
  type?: string;
  str?: number;
  mnd?: number;
  def?: number;
  spd?: number;
  hp?: number;
  ink?: number;
  hue?: Hue;
  trait?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  use?: ItemUse;
  battle?: boolean;
  field?: boolean;
  equip?: Equip;
  key?: boolean;
}

const I: ItemDef[] = [
  { id: 'tallow', name: 'Tallow Drop', desc: 'Mends 45 HP.', price: 12, use: { target: 'ally', heal: 45 }, battle: true, field: true },
  { id: 'candle', name: 'Wax Candle', desc: 'Mends 120 HP.', price: 40, use: { target: 'ally', heal: 120 }, battle: true, field: true },
  { id: 'honey', name: 'Moth Honey', desc: 'Mends 300 HP.', price: 110, use: { target: 'ally', heal: 300 }, battle: true, field: true },
  { id: 'chorus', name: 'Chorus Tin', desc: 'Mends 90 HP to every ally.', price: 150, use: { target: 'allies', heal: 90 }, battle: true, field: true },
  { id: 'ink_vial', name: 'Ink Vial', desc: 'Restores 12 ink.', price: 28, use: { target: 'ally', ink: 12 }, battle: true, field: true },
  { id: 'ink_well', name: 'Ink Well', desc: 'Restores 40 ink.', price: 95, use: { target: 'ally', ink: 40 }, battle: true, field: true },
  { id: 'relight', name: 'Relight', desc: 'Revives a fallen ally with 40% HP.', price: 70, use: { target: 'ko', revive: 0.4 }, battle: true, field: true },
  { id: 'pin', name: 'Grounding Pin', desc: 'Clears ailments from one ally.', price: 15, use: { target: 'ally', cure: true }, battle: true, field: true },
  { id: 'prism', name: 'Prism Shard', desc: 'Throw a random hue at every foe.', price: 45, use: { target: 'foes', dmg: 38, hue: 'rand' }, battle: true },
  { id: 'paint_bomb', name: 'Paint Bomb', desc: 'Violet splash on every foe.', price: 80, use: { target: 'foes', dmg: 70, hue: 'M' }, battle: true },
  { id: 'clock_tea', name: 'Clock Tea', desc: 'The drinker acts next.', price: 60, use: { target: 'ally', fx: 'hasten' }, battle: true },

  // Key items
  { id: 'lampsap', name: 'Lampsap', desc: 'Glowing sap from the Antenna Tree.', price: 0, key: true },
  { id: 'lens_shard', name: 'Lens Shard', desc: 'A piece of the Prismouth Lens. It points at the sky.', price: 0, key: true },
  { id: 'seal', name: 'Pilgrim Seal', desc: 'Grants passage to the Tether gate.', price: 0, key: true },
  { id: 'sundial', name: 'Pocket Sundial', desc: 'Press C to shift between past and present.', price: 0, key: true },
  { id: 'ticket', name: 'Lift Ticket', desc: 'One ride up the Tether. Non-refundable.', price: 0, key: true },
  { id: 'ninth_spool', name: 'Ninth Spool', desc: 'Nona\'s last tail. It holds the Ninth Ink.', price: 0, key: true },
  { id: 'bell_clapper', name: 'Bell Clapper', desc: 'A clapper from a silenced bell.', price: 0, key: true },
  { id: 'gran_jar', name: 'Jar of Umber', desc: 'A glass jar of warm brown light, labeled UMBER, EDGEWICK. It is Gran.', price: 0, key: true },
  { id: 'feed_horn', name: 'Feed Horn', desc: 'A dented metal cone. It hums when you point it at the sky.', price: 0, key: true },
];

// Weapons by type and tier.
const WEAPON_TYPES: Record<string, { stat: 'str' | 'mnd'; names: string[] }> = {
  pole: { stat: 'str', names: ['Lamp Pole', 'Iron Hook', 'Brass Crook', 'Signal Pole', 'Beacon Staff', 'Neon Crook', 'Edge Pole'] },
  claw: { stat: 'mnd', names: ['Claw Caps', 'Solder Claws', 'Diode Claws', 'Relay Claws', 'Servo Claws', 'Quartz Claws', 'Loom Claws'] },
  brush: { stat: 'mnd', names: ['Twig Brush', 'Sable Brush', 'Chrome Brush', 'Prism Brush', 'Comet Brush', 'Aurora Brush', 'Palette Knife'] },
  blade: { stat: 'str', names: ['Rust Blade', 'Pew Blade', 'Chapel Sword', 'Mothsteel', 'Relic Edge', 'Halo Edge', 'Lantern Blade'] },
  hand: { stat: 'str', names: ['Prayer Beads', 'Brass Beads', 'Gear Beads', 'Hour Beads', 'Epoch Beads', 'Aeon Beads', 'Zero Beads'] },
  slot: { stat: 'str', names: ['Tin Slot', 'Copper Slot', 'Silver Slot', 'Gold Slot', 'Platinum Slot', 'Moonstone Slot', 'Jackpot Slot'] },
  glass: { stat: 'mnd', names: ['Hand Mirror', 'Cut Glass', 'Lens Pane', 'Silvered Pane', 'Two-Way Pane', 'Funhouse Pane', 'Infinite Pane'] },
  none: { stat: 'mnd', names: ['Blank Mask', 'Chalk Mask', 'Ash Mask', 'Pale Mask', 'Hollow Mask', 'Null Mask', 'Void Mask'] },
};

export const WEAPON_POWER = [3, 8, 14, 21, 29, 38, 48];
export const WEAPON_PRICE = [0, 90, 260, 560, 1050, 1800, 3000];

for (const [type, w] of Object.entries(WEAPON_TYPES)) {
  w.names.forEach((name, t) => {
    const p = WEAPON_POWER[t];
    const eq: Equip = { slot: 'weapon', type };
    if (w.stat === 'str') eq.str = p; else { eq.mnd = p; eq.str = Math.round(p * 0.4); }
    I.push({ id: `${type}${t}`, name, desc: `${w.stat === 'str' ? 'Strength' : 'Mind'} +${p}.`, price: WEAPON_PRICE[t], equip: eq });
  });
}

// Hued weapons: basic attacks take the weapon's hue.
const HUED: [string, string, number, Hue, string][] = [
  ['blue_wick', 'pole', 2, 'B', 'Blue Wick'],
  ['red_hook', 'pole', 3, 'R', 'Red Hook'],
  ['violet_bristle', 'brush', 2, 'M', 'Violet Bristle'],
  ['cyan_edge', 'blade', 3, 'C', 'Cyan Edge'],
  ['green_hour', 'hand', 4, 'G', 'Green Hour'],
  ['amber_slot', 'slot', 4, 'Y', 'Amber Slot'],
  ['red_pane', 'glass', 5, 'R', 'Red Pane'],
  ['green_mask', 'none', 5, 'G', 'Green Mask'],
];
for (const [id, type, t, hue, name] of HUED) {
  const p = Math.round(WEAPON_POWER[t] * 0.9);
  const stat = WEAPON_TYPES[type].stat;
  const eq: Equip = { slot: 'weapon', type, hue };
  if (stat === 'str') eq.str = p; else { eq.mnd = p; eq.str = Math.round(p * 0.4); }
  I.push({ id, name, desc: `Attacks become ${hue === 'B' ? 'blue' : hue === 'R' ? 'red' : hue === 'M' ? 'violet' : hue === 'C' ? 'cyan' : hue === 'G' ? 'green' : 'amber'}. ${stat === 'str' ? 'Strength' : 'Mind'} +${p}.`, price: Math.round(WEAPON_PRICE[t] * 1.25), equip: eq });
}

// Charms
I.push(
  { id: 'wool_scarf', name: 'Wool Scarf', desc: 'Max HP +15%.', price: 120, equip: { slot: 'charm', trait: 'hp15' } },
  { id: 'ink_ring', name: 'Ink Ring', desc: 'Max ink +10.', price: 150, equip: { slot: 'charm', ink: 10 } },
  { id: 'lucky_button', name: 'Lucky Button', desc: 'Critical hits happen twice as often.', price: 180, equip: { slot: 'charm', trait: 'crit' } },
  { id: 'mothball', name: 'Mothball', desc: 'Immune to static.', price: 140, equip: { slot: 'charm', trait: 'nostatic' } },
  { id: 'grey_ward', name: 'Grey Ward', desc: 'Immune to grey.', price: 300, equip: { slot: 'charm', trait: 'nogrey' } },
  { id: 'hue_lens', name: 'Hue Lens', desc: 'Weakness hits deal 20% more.', price: 400, equip: { slot: 'charm', trait: 'clash' } },
  { id: 'shell_pick', name: 'Shell Pick', desc: 'Weakness hits crack one more shell point.', price: 500, equip: { slot: 'charm', trait: 'breaker' } },
  { id: 'metronome', name: 'Metronome', desc: 'Act first at the start of battle.', price: 600, equip: { slot: 'charm', trait: 'first' } },
  { id: 'piggy', name: 'Coin Pig', desc: 'Gold from battles +25%.', price: 700, equip: { slot: 'charm', trait: 'gold' } },
  { id: 'feather', name: 'Kite Feather', desc: 'Speed +4.', price: 800, equip: { slot: 'charm', spd: 4 } },
  { id: 'spool_charm', name: 'Spare Spool', desc: 'Regenerate 4% HP each turn.', price: 1200, equip: { slot: 'charm', trait: 'regen' } },
  { id: 'iron_rind', name: 'Iron Rind', desc: 'Defense +10.', price: 900, equip: { slot: 'charm', def: 10 } },
);

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(I.map(i => [i.id, i]));

export function item(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error('Unknown item ' + id);
  return it;
}
