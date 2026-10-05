// ENEMIES — the pitting, the fraying, the polite deleting.
// Pools per chapter + one boss per chapter. Enemy levels are implicit:
// the engine applies the chapter's enemyLevel modifier at spawn.

import type { EnemyDef } from "./types.js";

const E = (
  id: string, name: string, cls: string,
  hp: number, atk: number, def: number, spd: number, wit: number,
  element: EnemyDef["element"], spriteStyle: EnemyDef["spriteStyle"],
  colors: string[], seed: number, ai: EnemyDef["ai"], xp: number,
  lore?: string, splitsInto?: string,
): EnemyDef => ({
  id, name, cls, hp, atk, def, spd, wit, element, spriteStyle, colors,
  spriteSeed: seed, ai, xp, lore, splitsInto,
});

// ---------------------------------------------------------------- ch1 — Labyrinth of Frays (null/static)
export const CH1_ENEMIES: EnemyDef[] = [
  E("fray_mote", "Fray Mote", "mote", 14, 8, 3, 9, 5, "null", "sym",
    ["#141216", "#8a8398", "#b8b2c6"], 101, "basic", 10,
    "A knot of dropped-out reality, still trying to be a wall."),
  E("bad_pattern", "Bad Pattern", "pattern", 18, 9, 4, 7, 6, "null", "glyph",
    ["#141216", "#7d7f92", "#a8aab8"], 102, "basic", 12,
    "Someone's abandoned design, now load-bearing."),
  E("frayed_kin", "Frayed Kin", "kin", 22, 10, 4, 8, 7, "null", "sym",
    ["#141216", "#c2b8a8", "#8f8578"], 103, "basic", 14,
    "It used to be a neighbor. It was mid-sentence."),
  E("hollow_hanger", "Hollow Hanger", "caster", 16, 11, 3, 10, 9, "static", "eye",
    ["#141216", "#9fb4c7", "#5c6f85"], 104, "caster", 15,
    "It hung a coat once. Now it hangs things that look at you."),
  E("loom_whisk", "Loom Whisk", "splitter", 24, 9, 4, 9, 6, "null", "gear",
    ["#141216", "#a8988a", "#6f6355"], 105, "splitter", 18,
    "The Loom's cleaning implement. It divides when it breaks.", "fray_mote"),
];

// ---------------------------------------------------------------- ch2 — The Sporefall (bloom)
export const CH2_ENEMIES: EnemyDef[] = [
  E("sporeling", "Sporeling", "spore", 26, 12, 5, 9, 6, "bloom", "sym",
    ["#141216", "#6fae62", "#3e7a4e"], 201, "basic", 20),
  E("firewall_flower", "Firewall Flower", "caster", 28, 13, 5, 8, 10, "bloom", "glyph",
    ["#141216", "#d1855e", "#8c4f36"], 202, "caster", 24,
    "A flower that is a firewall. Petals that check credentials."),
  E("gardener_drone", "Gardener's Drone", "steel", 32, 14, 8, 8, 8, "steel", "gear",
    ["#141216", "#8fa0a8", "#5c6c74"], 203, "basic", 26,
    "It shears. It does not ask what you are before it shears."),
  E("shearling", "Shearling", "splitter", 34, 12, 6, 9, 7, "bloom", "sym",
    ["#141216", "#7dbb77", "#458a52"], 204, "splitter", 28,
    "Farmed to split on command. It splits anyway.", "sporeling"),
  E("riddle_root", "Riddle Root", "brute", 44, 16, 8, 6, 7, "bloom", "glyph",
    ["#141216", "#5d8f82", "#33605a"], 205, "brute", 30,
    "A riddle that grew instead of being answered."),
];

// ---------------------------------------------------------------- ch3 — The Static Sea (static/void)
export const CH3_ENEMIES: EnemyDef[] = [
  E("glass_echo", "Glass Echo", "echo", 40, 16, 9, 10, 10, "static", "shard",
    ["#141216", "#a3c4c9", "#6b8f96"], 301, "basic", 38,
    "Your outline, left behind like a footprint in very old sand."),
  E("drowned_clock", "Drowned Clock", "caster", 36, 17, 8, 8, 12, "static", "gear",
    ["#141216", "#7f9fbf", "#4c6a8c"], 302, "caster", 42,
    "It is still keeping time. The time is not yours."),
  E("mirror_you", "Mirror-You", "brute", 52, 19, 10, 12, 11, "null", "sym",
    ["#141216", "#b0a8c0", "#7a7290"], 303, "brute", 46,
    "A you that is only thread. A you that is only Bloom. Both of you are rude."),
  E("static_jelly", "Static Jelly", "splitter", 44, 15, 8, 9, 9, "static", "sym",
    ["#141216", "#98a8d8", "#64709f"], 304, "splitter", 40,
    "A jelly of the Sea's static. Cut it and it keeps both halves.", "glass_echo"),
  E("deep_reflection", "Deep Reflection", "caster", 48, 18, 9, 10, 13, "void", "eye",
    ["#141216", "#584a72", "#8c78a8"], 305, "caster", 48,
    "The Sea looking back with something it learned from you."),
];

// ---------------------------------------------------------------- ch4 — The Needle's Eye (static/steel)
export const CH4_ENEMIES: EnemyDef[] = [
  E("static_howl", "Static Howl", "static", 56, 20, 10, 13, 11, "static", "glyph",
    ["#141216", "#b8a8d8", "#7d6a9f"], 401, "basic", 58,
    "The storm, shouted. It eats patterns the way weather eats flags."),
  E("clockwork_kin", "Clockwork Kin", "brute", 66, 22, 14, 8, 10, "steel", "gear",
    ["#141216", "#9aa4ad", "#626c75"], 402, "brute", 64,
    "The god's servants, wound tight. Polite about it, even now."),
  E("seam_widow", "Seam Widow", "caster", 54, 21, 11, 9, 14, "void", "eye",
    ["#141216", "#4a4460", "#8c7fa0"], 403, "caster", 68,
    "Every closed seam leaves one of these behind. She has been waiting."),
  E("pattern_eater", "Pattern Eater", "splitter", 60, 19, 12, 10, 12, "static", "sym",
    ["#141216", "#c4b08c", "#8c7a58"], 404, "splitter", 66,
    "It eats a pattern and spits out two smaller storms.", "static_howl"),
];

// ---------------------------------------------------------------- ch5 — The Loom (void)
export const CH5_ENEMIES: EnemyDef[] = [
  E("cull_agent", "Cull's Agent", "agent", 70, 24, 14, 12, 15, "void", "eye",
    ["#141216", "#3c3648", "#7a6f92"], 501, "basic", 88,
    "A subroutine with a kind face. It has been deleting politely for eons."),
  E("deleted_one", "The Deleted", "ghost", 64, 26, 12, 14, 13, "void", "sym",
    ["#141216", "#4a4658", "#94889f"], 502, "basic", 92,
    "It remembers being a fence. It remembers being a word. It is still here, which is not possible."),
  E("last_pattern", "Last Pattern", "brute", 84, 28, 16, 9, 14, "null", "glyph",
    ["#141216", "#c8c0b0", "#8a8272"], 503, "brute", 100,
    "The final design of the world, still holding its breath."),
  E("thread_reeve", "Thread Reeve", "caster", 68, 25, 13, 10, 17, "void", "gear",
    ["#141216", "#585068", "#a89fc0"], 504, "caster", 104,
    "It counts the threads. It has counted them all before."),
];

export const ENEMY_POOLS: Record<number, EnemyDef[]> = {
  1: CH1_ENEMIES,
  2: CH2_ENEMIES,
  3: CH3_ENEMIES,
  4: CH4_ENEMIES,
  5: CH5_ENEMIES,
};

// ---------------------------------------------------------------- bosses
export const BOSSES: Record<string, EnemyDef> = {
  frayed_warden: E("frayed_warden", "Frayed Loom-Warden", "boss", 90, 11, 7, 9, 10,
    "null", "eye", ["#141216", "#c8b898", "#7a6f58"], 1001, "boss", 80,
    "It was a warden. It is mostly frayed now. It keeps its post anyway."),
  head_gardener: E("head_gardener", "Head Gardener", "boss", 150, 18, 10, 9, 12,
    "bloom", "gear", ["#141216", "#6fae62", "#c9b892"], 2001, "boss", 140,
    "It farms the Bloom and calls it gardening. It has opinions about you."),
  seas_eye: E("seas_eye", "The Sea's Eye", "boss", 220, 22, 12, 10, 15,
    "void", "eye", ["#141216", "#4a7a8c", "#8cb8c9"], 3001, "boss", 220,
    "It has always been watching. Now it is watching back, and it is watching you specifically."),
  culls_hand: E("culls_hand", "The Cull's Hand", "boss", 300, 27, 15, 11, 17,
    "void", "shard", ["#141216", "#3a3546", "#8c82a8"], 4001, "boss", 320,
    "The Cull's proxy: a hand that deletes with the courtesy of a butler."),
  the_cull: E("the_cull", "The Cull", "boss", 420, 32, 18, 13, 20,
    "void", "eye", ["#100e12", "#2e2a38", "#9c92b8"], 5001, "boss", 500,
    "The god's immune system. It will ask permission before it deletes you. It will do it anyway."),
  // ---- floor-1 mini-bosses (the last boss on each map's first floor)
  seam_gaunt: E("seam_gaunt", "The First Seam", "miniboss", 60, 9, 8, 8, 10,
    "null", "glyph", ["#141216", "#b8a888", "#6e6248"], 1101, "boss", 40,
    "A wound the size of a name. It does not fight. It resists."),
  shearer: E("shearer", "The Shearer", "miniboss", 100, 15, 9, 8, 10,
    "bloom", "gear", ["#141216", "#5f9e58", "#b8a878"], 2101, "boss", 70,
    "It shears the Bloom and presses it into weather. It is very efficient, and it is not sorry."),
  needles_door: E("needles_door", "The Needle's Door", "miniboss", 140, 18, 11, 9, 12,
    "static", "shard", ["#141216", "#6888a8", "#a8c8d8"], 3101, "boss", 110,
    "The tower in the drowned square. It opens for the right kind of quiet."),
  culls_proxy: E("culls_proxy", "The Cull's Proxy", "miniboss", 190, 22, 13, 10, 14,
    "void", "sym", ["#141216", "#484058", "#786e92"], 4101, "boss", 180,
    "A subroutine with a kind face. It deletes politely. It has been doing this for a long time."),
};

export const BOSS_BY_CHAPTER: Record<number, string> = {
  1: "frayed_warden",
  2: "head_gardener",
  3: "seas_eye",
  4: "culls_hand",
  5: "the_cull",
};

export function enemyById(id: string): EnemyDef {
  for (const pool of Object.values(ENEMY_POOLS)) {
    const e = pool.find((x) => x.id === id);
    if (e) return e;
  }
  const b = BOSSES[id];
  if (b) return b;
  throw new Error(`unknown enemy: ${id}`);
}
