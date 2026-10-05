// ITEMS — mending, splicing, and the things that grow in your pocket.
// Weapons are needles and blades; armor is wrap and skin; trinkets carry
// the story's small mercies. Shop stock per chapter lives in maps.ts.

import type { EffectDef, ItemDef, PassiveDef } from "./types.js";

export const PASSIVES: Record<string, PassiveDef> = {
  p_bloom: {
    id: "p_bloom",
    name: "Bloom-Blooded",
    desc: "Bloom skills deal 20% more. You feel it choosing you back.",
  },
  p_tear: {
    id: "p_tear",
    name: "Tear of the Eye",
    desc: "Starts every battle with 4 extra thread/flux. One drop of the god's memory, humming.",
  },
  p_hand: {
    id: "p_hand",
    name: "Clockwork Mercy",
    desc: "At battle start you carry a shield of 8% max HP. The hand lets go gently.",
  },
  p_other: {
    id: "p_other",
    name: "The Other Way",
    desc: "+10% attack for every ally who is down. The needle works different.",
  },
};

// ------------------------------------------------------------------ weapons
const W = (id: string, name: string, desc: string, atk: number, extra: Partial<ItemDef> = {}): ItemDef => ({
  id, name, kind: "weapon", desc, atk, ...extra,
});

export const WEAPONS: ItemDef[] = [
  W("w_spare", "Spare Thread Needle", "Your own. A good needle in an ordinary hand.", 3),
  W("w_patchblade", "Patch-Blade", "A mender's knife that learned to cut patterns.", 5),
  W("w_lattice", "Lattice Shard Edge", "Chewed crystal. It thinks a little, mostly in your favor.", 8, { wit: 2 }),
  W("w_static", "Static-Lashed Needle", "Wrapped in the storm's own wire. It hums a warning.", 12, { spd: 2 }),
  W("w_other", "The Other Needle", "The needle in your hand, in the other way.", 16, { wit: 4, passive: "p_other" }),
];

// ---- armor ------------------------------------------------------------
function A(id: string, name: string, desc: string, def: number, extra: { hp?: number; spd?: number; wit?: number } = {}): ItemDef {
  return { id, name, kind: "armor", desc, def, ...extra };
}

export const ARMOR: ItemDef[] = [
  A("a_frayed", "Frayed Wrack", "Held together by hope and a few good stitches.", 2, { hp: 8 }),
  A("a_homespun", "Homespun Wrap", "Woven by hands that are already quieter.", 4, { hp: 12 }),
  A("a_glass", "Glass Weave", "The drowned city's best work. Rings when you hum.", 7, { hp: 10, spd: 1 }),
  A("a_clock", "Clockwork Lattice", "Dead metal, still warm somewhere in the middle.", 10, { hp: 20 }),
  A("a_seamskin", "Seam-Skin", "You are the Last Patch. This is what the last patch wears.", 13, { hp: 16, wit: 2 }),
];

// ---- trinkets ---------------------------------------------------------
function T(id: string, name: string, desc: string, extra: { hp?: number; passive?: string }): ItemDef {
  return { id, name, kind: "trinket", desc, ...extra };
}

export const TRINKETS: ItemDef[] = [
  T("t_bead", "Loom Bead", "A single bead of the old pattern. It remembers being a song.", { hp: 10 }),
  T("t_seed", "Bloom Seed", "It wants to be a garden. It is very patient.", { passive: "p_bloom" }),
  T("t_tear", "Tear of the Eye", "One drop of the god's memory. It hums against your pulse.", { passive: "p_tear" }),
  T("t_finger", "Marrow's Finger", "The clockwork hand's smallest joint. It still knows how to hold on.", { passive: "p_hand" }),
];

// ---- consumables ------------------------------------------------------
function C(id: string, name: string, desc: string, heal: number, effect?: EffectDef): ItemDef {
  return { id, name, kind: "consumable", desc, use: { heal, effect } };
}

export const CONSUMABLES: ItemDef[] = [
  C("c_mend", "Mending Salve", "Smells like the village. Works like the village used to.", 40),
  C("c_stitch", "Stitch Kit", "The whole kit. Thread, needle, and the argument you had to carry it.", 90),
  C("c_spool", "Spool of Thread", "A full spool. Heavy in a way that is not about weight.", 150),
  C("c_tonic", "Bloom Tonic", "Tastes like a question. The Bloom approves.", 60, { kind: "haste", chance: 1, power: 2 }),
  C("c_tincture", "Void Tincture", "The polite deletion, diluted. For when you want a piece of you back.", 110),
];

export const ALL_ITEMS: ItemDef[] = [...WEAPONS, ...ARMOR, ...TRINKETS, ...CONSUMABLES];

export function itemById(id: string): ItemDef {
  const it = ALL_ITEMS.find((x) => x.id === id);
  if (it) return it;
  throw new Error(`unknown item: ${id}`);
}
