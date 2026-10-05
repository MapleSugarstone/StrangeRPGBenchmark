import type { ItemDef } from "../types";

const list: ItemDef[] = [
  // Consumables.
  { id: "salt_biscuit", name: "Salt Biscuit", desc: "Hard, salty. Restores 25 HP plus a tenth of max.", kind: "consumable", price: 8, sprite: { kind: "item", seed: "biscuit", a: "yellow", b: "salt", variant: "orb" }, use: { heal: 25, healPct: 0.1, target: "ally" } },
  { id: "brine", name: "Brine Flask", desc: "Restores 40 HP plus a third of max. Tastes like the sea remembering you.", kind: "consumable", price: 24, sprite: { kind: "item", seed: "brine", a: "teal", b: "salt", variant: "orb" }, use: { heal: 40, healPct: 0.33, target: "ally" } },
  { id: "lamp_wick", name: "Lamp Wick", desc: "Restores 12 Static plus a quarter of max.", kind: "consumable", price: 14, sprite: { kind: "item", seed: "wick", a: "orange", b: "yellow", variant: "tool" }, use: { st: 12, stPct: 0.25, target: "ally" } },
  { id: "moth_dust", name: "Moth Dust", desc: "Revives a fallen ally at half HP.", kind: "consumable", price: 45, sprite: { kind: "item", seed: "mothdust", a: "pink", b: "white", variant: "gem" }, use: { revive: 0.5, target: "deadally" } },
  { id: "antidote", name: "Clean Water", desc: "Cures poison, burn, blind, shock.", kind: "consumable", price: 10, sprite: { kind: "item", seed: "cleanwater", a: "blue", b: "salt", variant: "orb" }, use: { cure: ["poison", "burn", "blind", "shock", "freeze", "silence"], target: "ally" } },
  { id: "oil_bomb", name: "Oil Bomb", desc: "Heat damage to one foe.", kind: "consumable", price: 18, sprite: { kind: "item", seed: "oilbomb", a: "red", b: "orange", variant: "orb" }, use: { power: 120, element: "heat", target: "enemy", battleOnly: true } },
  { id: "frost_vial", name: "Frost Vial", desc: "Cold damage to one foe.", kind: "consumable", price: 18, sprite: { kind: "item", seed: "frostvial", a: "teal", b: "white", variant: "orb" }, use: { power: 120, element: "cold", target: "enemy", battleOnly: true } },
  { id: "spark_jar", name: "Spark Jar", desc: "Volt damage to one foe.", kind: "consumable", price: 18, sprite: { kind: "item", seed: "sparkjar", a: "yellow", b: "white", variant: "orb" }, use: { power: 120, element: "volt", target: "enemy", battleOnly: true } },
  { id: "rot_spore", name: "Rot Spore", desc: "Rot damage to one foe.", kind: "consumable", price: 18, sprite: { kind: "item", seed: "rotspore", a: "purple", b: "green", variant: "orb" }, use: { power: 120, element: "rot", target: "enemy", battleOnly: true } },
  { id: "tonic", name: "Vendor Tonic", desc: "Restores 30 HP plus a third of max to the whole party.", kind: "consumable", price: 60, sprite: { kind: "item", seed: "tonic", a: "lime", b: "white", variant: "orb" }, use: { heal: 30, healPct: 0.33, target: "allies" } },
  { id: "candle", name: "Lit Candle", desc: "Makes an ally Lit for 3 turns.", kind: "consumable", price: 20, sprite: { kind: "item", seed: "candle", a: "white", b: "yellow", variant: "tool" }, use: { status: [{ id: "lit", turns: 3 }], target: "ally" } },
  { id: "tooth", name: "Loose Tooth", desc: "Pays off 5 debt when used anywhere.", kind: "consumable", price: 30, sprite: { kind: "item", seed: "tooth", a: "white", b: "gray", variant: "gem" }, use: { target: "self" } },

  // Weapons.
  { id: "salt_hook", name: "Salt Hook", desc: "The scraper's tool. Hook.", kind: "weapon", weaponKind: "hook", price: 0, sprite: { kind: "item", seed: "salthook", a: "gray", b: "salt", variant: "tool" }, stats: { atk: 2 } },
  { id: "brine_hook", name: "Brine Hook", desc: "Hardened in brine. Hook.", kind: "weapon", weaponKind: "hook", price: 60, sprite: { kind: "item", seed: "brinehook", a: "teal", b: "salt", variant: "tool" }, stats: { atk: 5 } },
  { id: "glass_blade", name: "Glass Blade", desc: "Cut from the Steppe. Blade.", kind: "weapon", weaponKind: "blade", price: 140, sprite: { kind: "item", seed: "glassblade", a: "salt", b: "teal", variant: "tool" }, stats: { atk: 8, spd: 1 } },
  { id: "rust_arm", name: "Rust Arm", desc: "Oxbow's own arm. Arm.", kind: "weapon", weaponKind: "arm", price: 0, sprite: { kind: "item", seed: "rustarm", a: "brown", b: "orange", variant: "tool" }, stats: { atk: 3 } },
  { id: "piston_arm", name: "Piston Arm", desc: "Builder surplus. Arm.", kind: "weapon", weaponKind: "arm", price: 120, sprite: { kind: "item", seed: "pistonarm", a: "gray", b: "orange", variant: "tool" }, stats: { atk: 7, def: 1 } },
  { id: "coin_rod", name: "Coin Rod", desc: "A rod with a slot. Rod.", kind: "weapon", weaponKind: "rod", price: 0, sprite: { kind: "item", seed: "coinrod", a: "yellow", b: "purple", variant: "tool" }, stats: { mag: 2 } },
  { id: "hymn_rod", name: "Hymn Rod", desc: "Hums when held. Rod.", kind: "weapon", weaponKind: "rod", price: 110, sprite: { kind: "item", seed: "hymnrod", a: "purple", b: "white", variant: "tool" }, stats: { mag: 6, st: 4 } },
  { id: "moth_wing", name: "Moth Wing", desc: "Mim's own. Wing.", kind: "weapon", weaponKind: "wing", price: 0, sprite: { kind: "item", seed: "mothwing", a: "pink", b: "white", variant: "tool" }, stats: { mag: 3 } },
  { id: "prism_rod", name: "Prism Rod", desc: "Splits light into damage. Rod.", kind: "weapon", weaponKind: "rod", price: 220, sprite: { kind: "item", seed: "prismrod", a: "white", b: "pink", variant: "tool" }, stats: { mag: 10 }, element: "light" },
  { id: "folding_knife", name: "Folding Knife", desc: "Folds to nothing. Blade.", kind: "weapon", weaponKind: "blade", price: 0, sprite: { kind: "item", seed: "foldknife", a: "green", b: "salt", variant: "tool" }, stats: { atk: 5, spd: 2 } },
  { id: "issue_rifle", name: "Issue Blade", desc: "Standard issue for all seven prints. Blade.", kind: "weapon", weaponKind: "blade", price: 0, sprite: { kind: "item", seed: "issueblade", a: "gray", b: "red", variant: "tool" }, stats: { atk: 9 } },
  { id: "tooth_saw", name: "Tooth Saw", desc: "Bank property. Blade.", kind: "weapon", weaponKind: "blade", price: 300, sprite: { kind: "item", seed: "toothsaw", a: "white", b: "red", variant: "tool" }, stats: { atk: 14 } },
  { id: "hour_hand", name: "Hour Hand", desc: "From the clock that runs backward. Hook.", kind: "weapon", weaponKind: "hook", price: 400, sprite: { kind: "item", seed: "hourhand", a: "dark", b: "teal", variant: "tool" }, stats: { atk: 16, spd: 3 } },

  // Armor.
  { id: "salt_coat", name: "Salt Coat", desc: "Crusted work coat.", kind: "armor", price: 0, sprite: { kind: "item", seed: "saltcoat", a: "salt", b: "gray", variant: "gem" }, stats: { def: 2 } },
  { id: "rust_plate", name: "Rust Plate", desc: "Heavy. Oxbow approves.", kind: "armor", price: 70, sprite: { kind: "item", seed: "rustplate", a: "brown", b: "gray", variant: "gem" }, stats: { def: 5, spd: -1 } },
  { id: "habit", name: "Vendor Habit", desc: "Purple, with a coin slot.", kind: "armor", price: 50, sprite: { kind: "item", seed: "habit", a: "purple", b: "yellow", variant: "gem" }, stats: { def: 3, res: 3 } },
  { id: "glass_mail", name: "Glass Mail", desc: "Sings when struck.", kind: "armor", price: 160, sprite: { kind: "item", seed: "glassmail", a: "salt", b: "teal", variant: "gem" }, stats: { def: 7, res: 4 } },
  { id: "paper_robe", name: "Paper Robe", desc: "Printed with warnings.", kind: "armor", price: 180, sprite: { kind: "item", seed: "paperrobe", a: "white", b: "red", variant: "gem" }, stats: { def: 5, res: 9, st: 4 } },
  { id: "map_cloak", name: "Map Cloak", desc: "Shows where you have been.", kind: "armor", price: 240, sprite: { kind: "item", seed: "mapcloak", a: "green", b: "salt", variant: "gem" }, stats: { def: 9, res: 7, spd: 2 } },
  { id: "ledger_vest", name: "Ledger Vest", desc: "Every hit is itemized.", kind: "armor", price: 320, sprite: { kind: "item", seed: "ledgervest", a: "gray", b: "red", variant: "gem" }, stats: { def: 13, res: 9 } },

  // Accessories.
  { id: "moth_charm", name: "Moth Charm", desc: "Resists Light.", kind: "accessory", price: 90, sprite: { kind: "item", seed: "mothcharm", a: "pink", b: "white", variant: "gem" }, passive: { resist: ["light"] } },
  { id: "ember_ring", name: "Ember Ring", desc: "Heat skills deal more.", kind: "accessory", price: 120, sprite: { kind: "item", seed: "emberring", a: "red", b: "orange", variant: "gem" }, passive: { elementBoost: "heat" } },
  { id: "frost_ring", name: "Frost Ring", desc: "Cold skills deal more.", kind: "accessory", price: 120, sprite: { kind: "item", seed: "frostring", a: "teal", b: "white", variant: "gem" }, passive: { elementBoost: "cold" } },
  { id: "metronome", name: "Pocket Metronome", desc: "Speed up by a fifth.", kind: "accessory", price: 150, sprite: { kind: "item", seed: "metronome", a: "yellow", b: "dark", variant: "gem" }, passive: { spdPct: 20 } },
  { id: "clean_bandage", name: "Clean Bandage", desc: "Immune to poison and burn.", kind: "accessory", price: 80, sprite: { kind: "item", seed: "bandage", a: "white", b: "red", variant: "gem" }, passive: { immune: ["poison", "burn"] } },
  { id: "leech_tooth", name: "Leech Tooth", desc: "Attacks heal a tenth of damage dealt.", kind: "accessory", price: 200, sprite: { kind: "item", seed: "leechtooth", a: "white", b: "purple", variant: "gem" }, passive: { lifesteal: 10 } },

  // Key items.
  { id: "wick_of_rimward", name: "Rimward Wick", desc: "The lamp's heart. Warm in the hand.", kind: "key", price: 0, sprite: { kind: "item", seed: "rimwick", a: "orange", b: "white", variant: "tool" } },
  { id: "church_key", name: "Church Key", desc: "Opens the Vending Church's back room.", kind: "key", price: 0, sprite: { kind: "item", seed: "churchkey", a: "yellow", b: "gray", variant: "tool" } },
  { id: "steppe_pass", name: "Glass Pass", desc: "Lets you cross the Glass Steppe gate.", kind: "key", price: 0, sprite: { kind: "item", seed: "glasspass", a: "salt", b: "teal", variant: "gem" } },
  { id: "library_card", name: "Library Card", desc: "Admits one reader and party.", kind: "key", price: 0, sprite: { kind: "item", seed: "librarycard", a: "white", b: "red", variant: "gem" } },
  { id: "blank_map", name: "Blank Map", desc: "Shows the Fold if you stop looking at it.", kind: "key", price: 0, sprite: { kind: "item", seed: "blankmap", a: "salt", b: "green", variant: "gem" } },
  { id: "bank_note", name: "Bank Note", desc: "A promise. The Bank keeps those.", kind: "key", price: 0, sprite: { kind: "item", seed: "banknote", a: "white", b: "gray", variant: "gem" } },
  { id: "hour_glass", name: "Backward Glass", desc: "Sand goes up.", kind: "key", price: 0, sprite: { kind: "item", seed: "hourglass", a: "dark", b: "teal", variant: "gem" } },
  { id: "tuning_fork", name: "Tuning Fork", desc: "Forty voices, one pitch.", kind: "key", price: 0, sprite: { kind: "item", seed: "tuningfork", a: "indigo", b: "white", variant: "tool" } },
  { id: "moth_crown", name: "Moth Crown", desc: "It is lighter than it should be.", kind: "key", price: 0, sprite: { kind: "item", seed: "mothcrown", a: "yellow", b: "pink", variant: "gem" } },

  // Memories (chapter four passives). Dropped by enemies, slotted on party members.
  { id: "mem_saltlick", name: "Mem: Patience", desc: "A slug's memory. Regen 3 per turn.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memslug", a: "salt", b: "gray", variant: "gem" }, passive: { regen: 3 } },
  { id: "mem_rat", name: "Mem: Hunger", desc: "A rat's memory. Attack up 10%.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memrat", a: "brown", b: "pink", variant: "gem" }, passive: { atkPct: 10 } },
  { id: "mem_worm", name: "Mem: Wick", desc: "A worm that was a wick. Heat skills deal more.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memworm", a: "orange", b: "yellow", variant: "gem" }, passive: { elementBoost: "heat" } },
  { id: "mem_mite", name: "Mem: Small", desc: "A mite's memory. Speed up 15%.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memmite", a: "yellow", b: "gray", variant: "gem" }, passive: { spdPct: 15 } },
  { id: "mem_beetle", name: "Mem: Tithe", desc: "A beetle's memory. Static regen 2 per turn.", kind: "memory", price: 0, sprite: { kind: "item", seed: "membeetle", a: "yellow", b: "dark", variant: "gem" }, passive: { stRegen: 2 } },
  { id: "mem_golem", name: "Mem: Weight", desc: "A golem's memory. Defense up 15%.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memgolem", a: "gray", b: "yellow", variant: "gem" }, passive: { defPct: 15 } },
  { id: "mem_hymnal", name: "Mem: Verse", desc: "A book's memory. Magic up 12%.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memhymnal", a: "purple", b: "white", variant: "gem" }, passive: { magPct: 12 } },
  { id: "mem_hare", name: "Mem: Flight", desc: "A hare's memory. Counter 20% of hits.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memhare", a: "salt", b: "teal", variant: "gem" }, passive: { counter: 20 } },
  { id: "mem_jelly", name: "Mem: Static", desc: "A jelly's memory. Resists Volt.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memjelly", a: "yellow", b: "teal", variant: "gem" }, passive: { resist: ["volt"] } },
  { id: "mem_hound", name: "Mem: Glare", desc: "A hound's memory. Crit chance up 15%.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memhound", a: "white", b: "red", variant: "gem" }, passive: { critPct: 15 } },
  { id: "mem_monk", name: "Mem: Stillness", desc: "A monk's memory. Immune to shock and freeze.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memmonk", a: "orange", b: "white", variant: "gem" }, passive: { immune: ["shock", "freeze"] } },
  { id: "mem_page", name: "Mem: Margin", desc: "A page's memory. Max HP up 15%.", kind: "memory", price: 0, sprite: { kind: "item", seed: "mempage", a: "white", b: "red", variant: "gem" }, passive: { hpPct: 15 } },
  { id: "mem_wraith", name: "Mem: Leech", desc: "A wraith's memory. Heal 15% of damage dealt.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memwraith", a: "dark", b: "purple", variant: "gem" }, passive: { lifesteal: 15 } },
  { id: "mem_snake", name: "Mem: Line", desc: "A snake's memory. Back row costs nothing.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memsnake", a: "green", b: "salt", variant: "gem" }, passive: { rule: "anyrow" } },
  { id: "mem_teller", name: "Mem: Account", desc: "A teller's memory. Debt interest halved.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memteller", a: "white", b: "gray", variant: "gem" }, passive: { rule: "halfinterest" } },
  { id: "mem_ghost", name: "Mem: Yesterday", desc: "A ghost's memory. Survive one killing blow per battle.", kind: "memory", price: 0, sprite: { kind: "item", seed: "memghost", a: "dark", b: "teal", variant: "gem" }, passive: { rule: "survive" } },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const i = ITEMS[id];
  if (!i) throw new Error(`unknown item ${id}`);
  return i;
}

/** Word fragments for the chapter nine mechanic. Spells are cast by combining three. */
export interface WordDef { id: string; word: string; slot: "verb" | "noun" | "shape"; desc: string }
export const WORDS: WordDef[] = [
  { id: "w_burn", word: "BURN", slot: "verb", desc: "Heat." },
  { id: "w_freeze", word: "FREEZE", slot: "verb", desc: "Cold." },
  { id: "w_shock", word: "SHOCK", slot: "verb", desc: "Volt." },
  { id: "w_rot", word: "ROT", slot: "verb", desc: "Rot." },
  { id: "w_mend", word: "MEND", slot: "verb", desc: "Heal." },
  { id: "w_shine", word: "SHINE", slot: "verb", desc: "Light." },
  { id: "w_foe", word: "FOE", slot: "noun", desc: "One enemy." },
  { id: "w_foes", word: "FOES", slot: "noun", desc: "Every enemy." },
  { id: "w_friend", word: "FRIEND", slot: "noun", desc: "One ally." },
  { id: "w_friends", word: "FRIENDS", slot: "noun", desc: "Every ally." },
  { id: "w_self", word: "SELF", slot: "noun", desc: "You." },
  { id: "w_twice", word: "TWICE", slot: "shape", desc: "Two hits." },
  { id: "w_slow", word: "SLOWLY", slot: "shape", desc: "Over three turns." },
  { id: "w_loud", word: "LOUDLY", slot: "shape", desc: "Much more, costs much more." },
  { id: "w_quiet", word: "QUIETLY", slot: "shape", desc: "Cheap and small." },
];
