import type { ItemDef } from "../types";

const I: ItemDef[] = [
  // consumables
  { id: "flatbread", name: "Flatbread", desc: "Baked on an open grill, like everything. Heals 30 and a fifth of max HP.", kind: "consumable", price: 12, heal: 30, healPct: 0.2, target: "ally", sprite: "bread" },
  { id: "underbread", name: "Underbread", desc: "Cave bread. The Office sells a stamped copy. Heals 60 and a third of max HP.", kind: "consumable", price: 40, heal: 60, healPct: 0.34, target: "ally", sprite: "bread" },
  { id: "slattea", name: "Slat Tea", desc: "Brewed under an open roof. Heals the whole party 25 and a fifth of max HP.", kind: "consumable", price: 70, heal: 25, healPct: 0.2, target: "allAllies", sprite: "flask" },
  { id: "leaddrop", name: "Lead Drop", desc: "A weight on a thread. Stands a fallen ally back up at half HP.", kind: "consumable", price: 90, revive: true, healPct: 0.5, target: "ally", sprite: "weight" },
  { id: "slugpouch", name: "Slug Pouch", desc: "Pocket weights. +2 tension to one held ally.", kind: "consumable", price: 25, tension: 2, target: "ally", sprite: "slug" },
  { id: "spool", name: "Spool", desc: "Three fathoms of spare line. Refills Fathom's length by 3, or a slack ally's points.", kind: "consumable", price: 35, pool: 3, target: "ally", sprite: "line" },
  { id: "salve", name: "Chalk Salve", desc: "Cures every ill, including falling over.", kind: "consumable", price: 30, cure: true, target: "ally", sprite: "flask" },
  { id: "firepot", name: "Fire Pot", desc: "Coals in a clay pot, thrown. Heat damage to all foes.", kind: "consumable", price: 60, power: 110, element: "heat", target: "enemy", sprite: "flask" },
  { id: "coldash", name: "Cold Ash", desc: "Ash from the Loft, still cold. Heavy cold damage to one foe.", kind: "consumable", price: 60, power: 150, element: "cold", target: "enemy", sprite: "flask" },

  // weights: hang on a held line
  { id: "w_sinker", name: "Sinker", desc: "Weight. Defense up a little. Hang gives one more tension.", kind: "weight", price: 60, stats: { def: 2 }, passive: "hangPlus", sprite: "weight" },
  { id: "w_bob", name: "Light Bob", desc: "Weight. Speed up.", kind: "weight", price: 80, stats: { spd: 2 }, sprite: "weight" },
  { id: "w_ballast", name: "Ballast", desc: "Weight. Defense up. You cannot be knocked down.", kind: "weight", price: 150, stats: { def: 4, spd: -1 }, passive: "noDown", sprite: "weight" },
  { id: "w_tuningslug", name: "Tuning Slug", desc: "Weight. Magic up. Your note is always in tune: plucks against you do a third less.", kind: "weight", price: 170, stats: { mag: 3 }, passive: "pluckGuard", sprite: "slug" },
  { id: "w_anchor", name: "Anchor Stone", desc: "Weight. Lifted later: you need 6 tension to lift instead of 5.", kind: "weight", price: 220, stats: { def: 3, atk: 2 }, passive: "liftSix", sprite: "weight" },
  { id: "w_frostbead", name: "Frost Bead", desc: "Weight from the Loft. Magic and defense up, and cold cannot slow you.", kind: "weight", price: 300, stats: { mag: 4, def: 3 }, passive: "noFrost", sprite: "slug" },

  // soles: for the slack, who touch the ground
  { id: "s_grip", name: "Grip Soles", desc: "Soles. Speed up. Slack only.", kind: "sole", price: 60, stats: { spd: 2 }, sprite: "boot" },
  { id: "s_felt", name: "Felt Soles", desc: "Soles. Duck also heals a tenth of max HP.", kind: "sole", price: 110, stats: { spd: 1 }, passive: "duckHeal", sprite: "boot" },
  { id: "s_iron", name: "Iron Soles", desc: "Soles. Defense up. You cannot be knocked down.", kind: "sole", price: 160, stats: { def: 4 }, passive: "noDown", sprite: "boot" },
  { id: "s_climbing", name: "Climbing Soles", desc: "Soles. Attack up. Climb's drop deals half again as much.", kind: "sole", price: 240, stats: { atk: 3, spd: 1 }, passive: "climbPlus", sprite: "boot" },
  { id: "s_cave", name: "Cave Soles", desc: "Soles from the Under. Defense and attack up, and heat cannot touch you.", kind: "sole", price: 320, stats: { def: 3, atk: 3 }, passive: "heatResist", sprite: "boot" },

  // lures: hung on a held member's line. They retune the line and change how it hums.
  { id: "l_brass", name: "Brass Lure", desc: "Lure. Your line sounds C. Attack up a little.", kind: "lure", price: 90, note: "C", stats: { atk: 2 }, sprite: "bell" },
  { id: "l_bone", name: "Bone Lure", desc: "Lure. Your line sounds E. Magic up a little.", kind: "lure", price: 90, note: "E", stats: { mag: 2 }, sprite: "bell" },
  { id: "l_glass", name: "Glass Lure", desc: "Lure. Your line sounds G. Speed up a little.", kind: "lure", price: 90, note: "G", stats: { spd: 2 }, sprite: "bell" },
  { id: "l_mute", name: "Mute", desc: "Lure. A wad of felt on the line. You gain one less tension when hit, so the Bite hears you less.", kind: "lure", price: 160, passive: "quiet", stats: { def: 1 }, sprite: "slug" },
  { id: "l_bell", name: "Bell Lure", desc: "Lure. Your line sounds A, loud. Attacks give two tension. The Bite hears you.", kind: "lure", price: 160, note: "A", passive: "loud", stats: { atk: 3 }, sprite: "bell" },
  { id: "l_echo", name: "Echo Lure", desc: "Lure. Your line sounds D. Chords you complete hit half again as hard.", kind: "lure", price: 220, note: "D", passive: "chordPlus", stats: { mag: 3 }, sprite: "bell" },
  { id: "l_hook", name: "Old Hook", desc: "Lure. A hook from the Hull, re-set. Your line sounds B. When you are bitten you take half.", kind: "lure", price: 320, note: "B", passive: "biteGuard", stats: { def: 3, hp: 10 }, sprite: "key" },
  { id: "l_spoon", name: "Spoon Lure", desc: "Lure. Your line sounds F. Your plucks drain two more tension and the Bite comes faster.", kind: "lure", price: 320, note: "F", passive: "pluckPlus", stats: { mag: 4 }, sprite: "bell" },

  // Scrap Market: expensive gear for anyone willing to grind slugs for it
  { id: "w_lead", name: "Lead Heart", desc: "Weight. Scrap from the Hull. Defense and HP up well. Lifted later: six tension to lift.", kind: "weight", price: 600, stats: { def: 6, hp: 25 }, passive: "liftSix", sprite: "weight" },
  { id: "g_scale", name: "Scale Gloves", desc: "Gloves of Fish scale from the Scrap Market. Attack and magic up well.", kind: "glove", price: 700, stats: { atk: 6, mag: 6 }, sprite: "glove" },
  { id: "s_fin", name: "Fin Soles", desc: "Soles cut from something that swam. Speed and attack up well. Duck heals a tenth.", kind: "sole", price: 650, stats: { spd: 4, atk: 4 }, passive: "duckHeal", sprite: "boot" },
  { id: "l_jaw", name: "Jaw Lure", desc: "Lure. A tooth from the Under on the line. Your line sounds G. The Bite bites foes first while you wear it.", kind: "lure", price: 900, note: "G", passive: "biteFoes", stats: { atk: 4, def: 2 }, sprite: "key" },

  // gloves: for everyone
  { id: "g_hemp", name: "Hemp Gloves", desc: "Gloves. Attack up a little.", kind: "glove", price: 50, stats: { atk: 2 }, sprite: "glove" },
  { id: "g_pluck", name: "Pluck Gloves", desc: "Gloves. Magic up. Your plucks drain one more tension.", kind: "glove", price: 120, stats: { mag: 3 }, passive: "pluckPlus", sprite: "glove" },
  { id: "g_frame", name: "Frame Gloves", desc: "Gloves from the Trues. Defense up. Attack down a little.", kind: "glove", price: 130, stats: { def: 4, atk: -1 }, sprite: "glove" },
  { id: "g_courier", name: "Courier Gloves", desc: "Gloves from the Steppe. Speed up and crits more often.", kind: "glove", price: 180, stats: { spd: 2, atk: 1 }, passive: "critPlus", sprite: "glove" },
  { id: "g_cut", name: "Cut Gloves", desc: "Gloves with blades sewn in. Attack up well.", kind: "glove", price: 260, stats: { atk: 5 }, sprite: "glove" },
  { id: "g_hand", name: "Angler's Glove", desc: "A glove from the deck, made for a hand that holds a rod. Every stat up.", kind: "glove", price: 500, stats: { atk: 3, mag: 3, def: 3, spd: 1, hp: 10 }, sprite: "glove" },

  // key items
  { id: "k_message", name: "The Fallen Line", desc: "Your own line, coiled. There are knots in it. They are words.", kind: "key", price: 0, sprite: "line" },
  { id: "k_kite", name: "Kite Permit", desc: "A permit from the Reknotter. It says you are held. It is a lie.", kind: "key", price: 0, sprite: "letter" },
  { id: "k_wedding", name: "Wedding Favor", desc: "A ribbon from the Snarl. Everyone there is married to everyone.", kind: "key", price: 0, sprite: "star" },
  { id: "k_wheel", name: "Wall Wheel", desc: "A wheel from a Steppe wall. Walls there roll with the wind.", kind: "key", price: 0, sprite: "gear" },
  { id: "k_token", name: "Length Token", desc: "Good for one let-out at the Spindle.", kind: "key", price: 0, sprite: "slug" },
  { id: "k_lamp", name: "Cave Chalk", desc: "The Under is dark. Chalk marks the way back.", kind: "key", price: 0, sprite: "slug" },
  { id: "k_plumb", name: "Bob's Plumb", desc: "A weight on a line. It always knows which way is down. Bob lent it.", kind: "key", price: 0, sprite: "weight" },
  { id: "k_frost", name: "Loft Frost", desc: "It does not melt.", kind: "key", price: 0, sprite: "star" },
  { id: "k_bell", name: "Hem Bell", desc: "The bell that calls the choir. You took it with you.", kind: "key", price: 0, sprite: "bell" },
  { id: "k_letter", name: "The Torn Page", desc: "A page from the log on the deck. Everyone in the party, in knots. Two of them say UNRECORDED.", kind: "key", price: 0, sprite: "letter" },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(I.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`unknown item ${id}`);
  return it;
}
