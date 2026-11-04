// What lies in each side map, picked up by stepping on it. Names and lines are Qwen's (Notes/qwen/finds.json); kinds
// and amounts are the programmer's. Written by tools/import_finds.mjs.

export interface Find {
  kind: "items" | "cinder" | "ruin";
  /** The item key, or the Ruin's species key. */
  what?: string;
  count?: number;
  cinder?: number;
  level?: number;
  name: string;
  line: string;
}

export const FINDS: Record<string, Find> = {
  "ashen_reach_side": { kind: "items", what: "slag_paste", count: 3, name: "Weep Patch", line: "Found Slag Paste. Patches the Weep. Restores health. x3" },
  "basalt_forge_side": { kind: "cinder", cinder: 480, name: "Forge Dust", line: "Picked up 480 Cinder. The heat clings to your shell." },
  "oxide_belt_side": { kind: "ruin", what: "vex_mirror", level: 24, name: "Cunning Reflection", line: "Found Vex Mirror. Level 24. It watches back." },
  "rust_anchor_side": { kind: "items", what: "glaze_seal", count: 2, name: "Shell Seal", line: "Found Glaze Seal. Closes the crack. Full health. x2" },
  "vitreous_reach_side": { kind: "cinder", cinder: 720, name: "Molten Glass", line: "Picked up 720 Cinder. Sharp and bright." },
  "pug_mire_side": { kind: "ruin", what: "mud_slug", level: 36, name: "Mire Crawler", line: "Found Mud Slug. Level 36. It leaves a trail." },
  "clay_deep_side": { kind: "items", what: "ash_rite", count: 1, name: "Dust Rite", line: "Found Ash Rite. Reknits dust. Half health return. x1" },
  "ashen_reach_heart_side": { kind: "cinder", cinder: 960, name: "Core Heat", line: "Picked up 960 Cinder. It burns with purpose." },
  "the_dregs_undercroft_side": { kind: "items", what: "heavy_grip", count: 2, name: "Magnet Grip", line: "Found Heavy Grip. Magnet holds tighter. Keeps more HP. x2" },
  "the_dregs_trench_side": { kind: "ruin", what: "blind_coral", level: 57, name: "Dark Coral", line: "Found Blind Coral. Level 57. It feels for you." },
  "the_dregs_glass_side": { kind: "cinder", cinder: 1260, name: "Reflected Light", line: "Picked up 1260 Cinder. It shatters in the dark." },
  "the_dregs_rift_side": { kind: "items", what: "slag_paste", count: 3, name: "Final Patch", line: "Found Slag Paste. Patches the Weep. Restores health. x3" },
};
