import type { Elem, Gear, Item, Rune } from './types';

const I = (id: string, name: string, price: number, tgt: Item['tgt'], fx: Item['fx'], desc: string, tier: number): Item => ({ id, name, price, tgt, fx, desc, tier });

export const ITEMS: Record<string, Item> = {};
[
  I('dew', 'Dewdrop', 18, 'ally', [{ k: 'healFlat', n: 60 }], 'Heals 60.', 1),
  I('jar', 'Sunjar', 60, 'ally', [{ k: 'healFlat', n: 180 }], 'Heals 180.', 4),
  I('flask', 'Moonflask', 170, 'ally', [{ k: 'healFlat', n: 420 }], 'Heals 420.', 8),
  I('starwater', 'Starwater', 420, 'ally', [{ k: 'healFlat', n: 850 }], 'Heals 850.', 11),
  I('ink', 'Inkwell', 30, 'ally', [{ k: 'mpFlat', n: 18 }], 'Restores 18 MP.', 2),
  I('ink2', 'Deep Inkwell', 110, 'ally', [{ k: 'mpFlat', n: 50 }], 'Restores 50 MP.', 6),
  I('ink3', 'Bottomless Well', 330, 'ally', [{ k: 'mpFlat', n: 120 }], 'Restores 120 MP.', 10),
  I('feather', 'Ember Feather', 70, 'fallen', [{ k: 'revive', p: 0.4 }], 'Revives at 40% HP.', 2),
  I('plume', 'Phoenix Plume', 280, 'fallen', [{ k: 'revive', p: 0.9 }], 'Revives at 90% HP.', 8),
  I('salt', 'Smelling Salt', 25, 'ally', [{ k: 'cleanse' }], 'Clears ailments.', 2),
  I('bomb1', 'Spark Egg', 35, 'foes', [{ k: 'dmgFlat', n: 38, e: 'volt' }], 'Hits all foes for 38.', 1),
  I('bomb2', 'Frost Egg', 95, 'foes', [{ k: 'dmgFlat', n: 130, e: 'frost' }], 'Hits all foes for 130.', 5),
  I('bomb3', 'Nova Egg', 260, 'foes', [{ k: 'dmgFlat', n: 330, e: 'lumen' }], 'Hits all foes for 330.', 9),
].forEach((i) => (ITEMS[i.id] = i));

const TIER_NAMES: [string, string, string, Elem][] = [
  ['Wrench', 'Winder Apron', 'Brass Button', 'ember'],
  ['Letter Opener', 'Post Coat', 'Wax Stamp', 'umbra'],
  ['Bedpost', 'Quilted Vest', 'Night Cap', 'bloom'],
  ['Red Pen', 'Ink Suit', 'Paperweight', 'lumen'],
  ['Ticket Punch', 'Hi-Vis Vest', 'Transfer Slip', 'volt'],
  ['Rook Mace', 'Felt Jacket', 'Loaded Die', 'frost'],
  ['Forge Tongs', 'Slag Plate', 'Ember Clasp', 'ember'],
  ['Bookend', 'Binding Coat', 'Silk Bookmark', 'umbra'],
  ['Hedge Shears', 'Ivy Mail', 'Seed Pearl', 'bloom'],
  ['Seam Ripper', 'Patchwork Mail', 'Thimble', 'volt'],
  ['Quill of Edits', 'Margin Robe', 'Asterisk', 'lumen'],
  ['Sundial Blade', 'Dusk Cloak', 'The Last Hour', 'umbra'],
];

export const GEAR: Record<string, Gear> = {};
export const GEAR_BY_TIER: Gear[][] = [];
TIER_NAMES.forEach(([w, a, c, e], i) => {
  const t = i + 1;
  const list: Gear[] = [
    { id: `w${t}`, name: w, slot: 'weapon', tier: t, price: Math.round(27 * Math.pow(t, 1.6)), bonus: { atk: Math.round(2 + 2.4 * t), mag: Math.round(2 + 2.4 * t) }, desc: `ATK+${Math.round(2 + 2.4 * t)} MAG+${Math.round(2 + 2.4 * t)}` },
    { id: `a${t}`, name: a, slot: 'armor', tier: t, price: Math.round(23 * Math.pow(t, 1.6)), bonus: { def: Math.round(1.5 + 1.9 * t), res: Math.round(1.5 + 1.9 * t), hp: Math.round(6 + 7 * t) }, desc: `DEF/RES+${Math.round(1.5 + 1.9 * t)} HP+${Math.round(6 + 7 * t)}` },
    { id: `c${t}`, name: c, slot: 'charm', tier: t, price: Math.round(19 * Math.pow(t, 1.6)), bonus: { spd: Math.round(0.5 + 0.8 * t), mp: Math.round(2 + 2.5 * t) }, elem: e, desc: `SPD+${Math.round(0.5 + 0.8 * t)} MP+${Math.round(2 + 2.5 * t)} ${e} +10%` },
  ];
  GEAR_BY_TIER.push(list);
  list.forEach((g) => (GEAR[g.id] = g));
});

const R = (r: Rune) => r;
export const RUNES: Record<string, Rune> = {};
[
  R({ id: 'r_ember', name: 'Rune of Embers', price: 300, desc: 'Ember damage +25%.', mods: { dmgElem: { ember: 0.25 } } }),
  R({ id: 'r_frost', name: 'Rune of Rime', price: 300, desc: 'Frost damage +25%.', mods: { dmgElem: { frost: 0.25 } } }),
  R({ id: 'r_volt', name: 'Rune of Sparks', price: 300, desc: 'Volt damage +25%.', mods: { dmgElem: { volt: 0.25 } } }),
  R({ id: 'r_lumen', name: 'Rune of Dawn', price: 300, desc: 'Lumen damage +25%.', mods: { dmgElem: { lumen: 0.25 } } }),
  R({ id: 'r_umbra', name: 'Rune of Dusk', price: 300, desc: 'Umbra damage +25%.', mods: { dmgElem: { umbra: 0.25 } } }),
  R({ id: 'r_bloom', name: 'Rune of Moss', price: 300, desc: 'Bloom damage +25%.', mods: { dmgElem: { bloom: 0.25 } } }),
  R({ id: 'r_siphon', name: 'Rune of Siphon', price: 420, desc: 'Heal 10% of damage dealt.', mods: { lifesteal: 0.1 } }),
  R({ id: 'r_quick', name: 'Rune of Quickening', price: 420, desc: 'Speed +12%.', mods: { spdPct: 0.12 } }),
  R({ id: 'r_bulwark', name: 'Rune of Bulwark', price: 420, desc: 'DEF and RES +15%.', mods: { defPct: 0.15 } }),
  R({ id: 'r_echo', name: 'Rune of Echo', price: 480, desc: 'Skills cost 20% less MP.', mods: { mpCut: 0.2 } }),
  R({ id: 'r_edge', name: 'Rune of Edges', price: 480, desc: 'Critical chance +15%.', mods: { crit: 0.15 } }),
  R({ id: 'r_thorn', name: 'Rune of Thorns', price: 360, desc: 'Reflect 15% of melee damage taken.', mods: { thorns: 0.15 } }),
  R({ id: 'r_nerve', name: 'Rune of Nerve', price: 360, desc: 'Nerve gains +40%.', mods: { nerveGain: 0.4 } }),
  R({ id: 'r_vigor', name: 'Rune of Vigor', price: 420, desc: 'Max HP +12%.', mods: { hpPct: 0.12 } }),
  R({ id: 'r_might', name: 'Rune of Might', price: 600, desc: 'All damage +10%.', mods: { dmgAll: 0.1 } }),
].forEach((r) => (RUNES[r.id] = r));

/** Item ids sold in the shop at a given chapter. */
export function shopStock(chapter: number): { items: string[]; gear: string[]; runes: string[] } {
  const items = Object.values(ITEMS).filter((i) => i.tier <= chapter).map((i) => i.id);
  const gear = [chapter, Math.max(1, chapter - 1)].flatMap((t) => GEAR_BY_TIER[t - 1].map((g) => g.id));
  const runes = chapter >= 9 ? Object.keys(RUNES) : [];
  return { items, gear, runes };
}
