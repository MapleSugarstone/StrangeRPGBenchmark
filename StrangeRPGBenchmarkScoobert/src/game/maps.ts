// MAPS — one MapDef per chapter. Layouts, palettes, enemy pools, per-floor
// bosses (last is the chapter boss), shop stock, and the intro/outro
// dialogue graph ids. `unlock` is the mechanic granted on completion.

import type { MapDef } from "./types.js";

export const MAPS: Record<string, MapDef> = {
  m1: {
    id: "m1", name: "The Labyrinth of Frays", w: 16, h: 16, seed: 11, floors: 2,
    palette: ["#141216", "#c8b898", "#7a6f58"],
    tileFloor: "floor", tileWall: "wall",
    enemies: ["fray_mote", "bad_pattern", "frayed_kin", "hollow_hanger", "loom_whisk"],
    elite: "loom_whisk",
    bosses: ["seam_gaunt", "frayed_warden"],
    shops: [
      {
        items: ["c_mend", "w_patchblade", "a_homespun", "t_bead"],
        prices: { c_mend: 8, w_patchblade: 30, a_homespun: 25, t_bead: 15 },
      },
    ],
    intro: "d1_intro", outro: "d1_outro",
    unlock: "thread",
    layout: "labyrinth",
    encounters: 5,
  },
  m2: {
    id: "m2", name: "The Sporefall", w: 16, h: 16, seed: 22, floors: 2,
    palette: ["#141216", "#6fae62", "#c9b892"],
    tileFloor: "floor", tileWall: "wall",
    enemies: ["sporeling", "firewall_flower", "gardener_drone", "shearling", "riddle_root"],
    elite: "riddle_root",
    bosses: ["shearer", "head_gardener"],
    shops: [
      {
        items: ["c_mend", "c_stitch", "w_lattice", "a_glass", "t_seed"],
        prices: { c_mend: 8, c_stitch: 20, w_lattice: 60, a_glass: 50, t_seed: 40 },
      },
    ],
    intro: "d2_intro", outro: "d2_outro",
    unlock: "sporefall",
    layout: "rooms",
    encounters: 6,
  },
  m3: {
    id: "m3", name: "The Static Sea", w: 18, h: 18, seed: 33, floors: 2,
    palette: ["#101418", "#4a7a8c", "#8cb8c9"],
    tileFloor: "water", tileWall: "wall",
    enemies: ["glass_echo", "drowned_clock", "mirror_you", "static_jelly", "deep_reflection"],
    elite: "mirror_you",
    bosses: ["needles_door", "seas_eye"],
    shops: [
      {
        items: ["c_stitch", "c_tonic", "w_static", "a_clock", "t_tear"],
        prices: { c_stitch: 20, c_tonic: 25, w_static: 90, a_clock: 80, t_tear: 150 },
      },
    ],
    intro: "d3_intro", outro: "d3_outro",
    unlock: "bloomskin",
    layout: "spiral",
    encounters: 7,
  },
  m4: {
    id: "m4", name: "The Needle's Eye", w: 18, h: 18, seed: 44, floors: 2,
    palette: ["#141216", "#8c82a8", "#c8c2d8"],
    tileFloor: "floor", tileWall: "void",
    enemies: ["static_howl", "clockwork_kin", "seam_widow", "pattern_eater"],
    elite: "seam_widow",
    bosses: ["culls_proxy", "culls_hand"],
    shops: [
      {
        items: ["c_stitch", "c_tincture", "a_seamskin", "t_finger", "c_spool"],
        prices: { c_stitch: 20, c_tincture: 40, a_seamskin: 120, t_finger: 100, c_spool: 30 },
      },
    ],
    intro: "d4_intro", outro: "d4_outro",
    unlock: "static_storm",
    layout: "hollow",
    encounters: 8,
  },
  m5: {
    id: "m5", name: "The Loom", w: 20, h: 20, seed: 55, floors: 2,
    palette: ["#100e12", "#9c92b8", "#e8e2f0"],
    tileFloor: "void", tileWall: "wall",
    enemies: ["cull_agent", "deleted_one", "thread_reeve", "last_pattern"],
    elite: "cull_agent",
    bosses: ["culls_proxy", "the_cull"],
    shops: [
      {
        items: ["c_spool", "c_tincture", "w_other", "a_seamskin"],
        prices: { c_spool: 30, c_tincture: 40, w_other: 200, a_seamskin: 120 },
      },
    ],
    intro: "d5_intro", outro: "d5_outro",
    unlock: "unweaving",
    layout: "needle",
    encounters: 8,
  },
};

export const MAP_BY_CHAPTER: Record<number, MapDef> = {
  1: MAPS.m1,
  2: MAPS.m2,
  3: MAPS.m3,
  4: MAPS.m4,
  5: MAPS.m5,
};
