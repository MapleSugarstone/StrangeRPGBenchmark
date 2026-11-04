// Companions who travel with Shard once they join, their talks after each island's arrival scene, and the twist scene
// before the last gate. All lines are Qwen's (Notes/qwen/asks/20261103-144817-companions.md).

/** The cast who join, in the order they join, with the flag their joining sets. */
export const COMPANIONS: { name: string; sprite: string }[] = [
  { name: "Luma", sprite: "luma" }, { name: "Osm", sprite: "osm" }, { name: "Kest", sprite: "kest" },
  { name: "Brix", sprite: "brix" }, { name: "Vell", sprite: "vell" },
];

/** By island number: the talk after its arrival scene. */
export const TALKS: Record<number, [string, string][]> = {
  3: [["Luma","The stars drift wrong."],["Shard","They shift with the mud."],["Luma","The world is unspooling."]],
  4: [["Osm","The clay remembers weight."],["Luma","Stone feels heavy too."],["Shard","Something pulls the ground."]],
  5: [["Luma","The air tastes of dust."],["Osm","The rock sings low."],["Kest","The mountain holds its breath."]],
  6: [["Kest","Fire cools to ash."],["Luma","The heat is wrong here."],["Osm","The forge burns inside."]],
  7: [["Osm","Metal bleeds red rust."],["Kest","The gears grind bones."],["Shard","The Weeps hunger for metal."]],
  8: [["Kest","The salt eats the wood."],["Osm","The water is thick."],["Shard","The sea forgets the shore."]],
  9: [["Osm","The heap grows taller."],["Kest","Scavengers pick the bones."],["Shard","Nothing stays still here."]],
  10: [["Brix","The glass sings a note."],["Osm","It cracks in the heat."],["Shard","The cool air bites back."]],
  11: [["Vell","The heat fades slow."],["Brix","The glass shrinks tight."],["Shard","The cracks widen in cold."]],
  12: [["Brix","The dark is deep here."],["Vell","The clay holds its shape."],["Shard","The walls press in."]],
  13: [["Vell","The kiln roars loud."],["Brix","The heat is absolute."],["Shard","The Vessel wakes up."]],
  14: [["Vell","The core is bare."],["Brix","The structure fails."],["Shard","It is all one thing."]],
  // Dregs talks (tools/build_dregs.mjs)
  15: [["Brix","Don't look down."],["Vell","The walls are sweating."],["Shard","We keep moving."]],
  16: [["Kest","It is quiet. Too quiet."],["Vell","Shadows move when we blink."],["Brix","I hate this place."]],
  17: [["Brix","It feels like a throat."],["Vell","Swallow or be swallowed."]],
  18: [["Brix","Where is everyone?"],["Vell","Hiding from the fire."],["Shard","We find the gate."],["Luma","And the Weep."]],
  19: [["Brix","Everything is a lie."],["Vell","Except the pain."],["Shard","We find the source."]],
  20: [["Brix","This place feels... wrong."],["Vell","It is just decay. Nothing more."],["Shard","Let us fix it."]],
  // End of Dregs talks
};

/** The twist, on the last island's last map before the final gate. */
export const TWIST: [string, string][] = [["The Great Vessel","I am the world."],["Luma","You are the sky?"],["The Great Vessel","I am the inside."],["Osm","The cracks are my skin."],["The Great Vessel","The Weeps are my blood."],["Kest","You are leaking out."],["The Great Vessel","Fix me, and stay trapped."],["Shard","The Slag are my guts."],["The Great Vessel","Seal the cracks. End the leak."]];
export const TWIST_MAP = "ashen_reach_heart_3";
/** The twist plays within this many steps before the last map's seal line. */
export const TWIST_NEAR = 6;
