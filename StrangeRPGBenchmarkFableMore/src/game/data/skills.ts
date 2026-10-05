import type { Skill } from "../types";

const S: Skill[] = [
  // ---------------------------------------------------------------- generic
  { id: "hang", name: "Hang", desc: "Go limp on your line. Half damage until your next turn. +2 tension.", kind: "hang", cost: 0, target: "self", weight: 0.5 },
  { id: "duck", name: "Duck", desc: "Drop flat. Nothing hits you until your next turn, not even from above.", kind: "duck", cost: 0, target: "self", weight: 0.5, lock: "duck" },
  { id: "rise", name: "Rise", desc: "Ask to be lifted now. Leave the field for a turn, then come down hard.", kind: "rise", cost: 3, target: "self", weight: 0.6, chapter: 4 },
  { id: "letgo", name: "Let Go", desc: "Release your own line for this battle. No more tension, no more Lift, no more Pluck. You can Duck.", kind: "letgo", cost: 0, target: "self", weight: 0.5, chapter: 8 },

  // ---------------------------------------------------------------- Fathom
  { id: "swing", name: "Swing", desc: "A weighted end of line, swung.", kind: "attack", cost: 0, target: "enemy", element: "blunt", power: 100, lock: "blunt" },
  { id: "climb", name: "Climb", desc: "Climb an enemy's line. Untouchable for a turn, then drop on it for heavy damage and make it slack.", kind: "climb", cost: 0, target: "enemy", weight: 0.8 },
  { id: "k_bowline", name: "Bowline", desc: "A loop around an ally that does not slip. Absorbs 40% of damage while tied. 3 fathoms.", kind: "knot", cost: 3, target: "ally", status: "shield", statusPower: 0.4, persistent: true, lock: "knot" },
  { id: "k_fist", name: "Monkey's Fist", desc: "A weighted knot that stays wrapped around a foe and bruises it every turn. 2 fathoms.", kind: "knot", cost: 2, target: "enemy", status: "bleed", persistent: true, lock: "knot", element: "blunt" },
  { id: "k_hitch", name: "Hitch", desc: "Tie a foe's line to the ground. It is slow and cannot change lane. 2 fathoms.", kind: "knot", cost: 2, target: "enemy", status: "hitch", persistent: true, lock: "knot" },
  { id: "k_shank", name: "Sheepshank", desc: "Shorten an ally's line. Haste while tied. 2 fathoms.", kind: "knot", cost: 2, target: "ally", status: "haste", persistent: true, lock: "knot" },
  { id: "k_reef", name: "Reef", desc: "Join two allies. They split every hit evenly while tied. 3 fathoms.", kind: "knot", cost: 3, target: "allAllies", effect: "reef", persistent: true, lock: "knot", chapter: 3 },
  { id: "k_stopper", name: "Figure Eight", desc: "A stopper knot. The target cannot be lifted while tied. 1 fathom.", kind: "knot", cost: 1, target: "anyone", status: "stopper", persistent: true, lock: "knot", chapter: 4 },
  { id: "k_clove", name: "Clove Hitch", desc: "Freeze a foe's line. Its tension cannot change and it cannot use skills. 3 fathoms.", kind: "knot", cost: 3, target: "enemy", status: "clove", persistent: true, lock: "knot", chapter: 4 },
  { id: "k_snare", name: "Snare", desc: "A running loop. The foe trips on its next action and falls. Unties itself. 2 fathoms.", kind: "knot", cost: 2, target: "enemy", status: "snare", persistent: true, lock: "knot", chapter: 2 },
  { id: "k_cat", name: "Cat's Paw", desc: "Double an ally's next hit. Unties itself. 2 fathoms.", kind: "knot", cost: 2, target: "ally", status: "brace", persistent: true, lock: "knot", chapter: 2 },
  { id: "k_timber", name: "Timber Hitch", desc: "Drag a foe into your lane and hold it there with its guard down. 3 fathoms.", kind: "knot", cost: 3, target: "enemy", effect: "timber", status: "defDown", statusPower: 0.25, persistent: true, lock: "knot", chapter: 5 },

  // ---------------------------------------------------------------- Burl
  { id: "butt", name: "Butt", desc: "A knot, thrown headfirst.", kind: "attack", cost: 0, target: "enemy", element: "blunt", power: 100, lock: "blunt" },
  { id: "snarl", name: "Snarl", desc: "Knots do not come loose. Foes aim at Burl for 2 turns and Burl's guard goes up.", kind: "buff", cost: 1, target: "self", status: "taunt", statusTurns: 2, effect: "defUp", weight: 0.7 },
  { id: "lash", name: "Lash", desc: "Loose ends whip the target's lane and the ones beside it.", kind: "attack", cost: 2, target: "enemy", element: "blunt", power: 95, shape: "adjacent", lock: "blunt" },
  { id: "bind", name: "Bind", desc: "Wrap a foe's legs. Damage, and it falls over and loses a turn.", kind: "attack", cost: 3, target: "enemy", element: "blunt", power: 80, status: "down", statusTurns: 1, lock: "blunt" },
  { id: "tighten", name: "Tighten", desc: "Pull every loop tight. Defense up for 3 turns.", kind: "buff", cost: 2, target: "self", status: "defUp", statusTurns: 3, statusPower: 0.35, weight: 0.6 },

  // ---------------------------------------------------------------- Dulcet
  { id: "strum", name: "Strum", desc: "Pluck the target's line. Plays its note. Damage grows with its tension and its tension drops to 0.", kind: "pluck", cost: 0, target: "enemy", element: "hum", power: 85, magic: true, lock: "pluck" },
  { id: "tune", name: "Tune", desc: "Retune a foe's line to a note of your choosing. Dulcet acts again sooner.", kind: "tune", cost: 0, target: "enemy", weight: 0.5, chapter: 2 },
  { id: "lullaby", name: "Lullaby", desc: "A slow song along every line. All foes slowed for 2 turns.", kind: "debuff", cost: 2, target: "allEnemies", status: "slow", statusTurns: 2, element: "hum", lock: "hum" },
  { id: "harmonic", name: "Harmonic", desc: "Heal an ally. Heals half again as much when the phrase holds three notes.", kind: "heal", cost: 3, target: "ally", heal: 30, effect: "phraseHeal" },
  { id: "resonate", name: "Resonate", desc: "Every line in earshot rings. Hum damage to all foes.", kind: "attack", cost: 4, target: "allEnemies", element: "hum", power: 110, magic: true, lock: "hum" },

  // ---------------------------------------------------------------- Lissom
  { id: "step", name: "Step", desc: "A dancer's heel, placed exactly.", kind: "attack", cost: 0, target: "enemy", element: "cut", power: 100, lock: "cut" },
  { id: "tangle", name: "Tangle", desc: "Tie two foes' lines together. Damage and statuses to one reach the other, and both act late.", kind: "tangle", cost: 2, target: "twoEnemies", lock: "tangle" },
  { id: "whirl", name: "Whirl", desc: "A turn with blades out. Cut damage to the target's lane and the lanes beside it.", kind: "attack", cost: 3, target: "enemy", element: "cut", power: 95, shape: "adjacent", lock: "cut" },
  { id: "lead", name: "Lead", desc: "Take a foe by the line and lead it into your lane with its guard down.", kind: "debuff", cost: 2, target: "enemy", effect: "pullToLane", status: "defDown", statusTurns: 2, statusPower: 0.3, weight: 0.7 },
  { id: "unravel", name: "Unravel", desc: "Shake a foe loose of its buffs and its tangle.", kind: "debuff", cost: 2, target: "enemy", effect: "unravel", weight: 0.7 },

  // ---------------------------------------------------------------- Gust
  { id: "breeze", name: "Breeze", desc: "A push of air. Never misses.", kind: "attack", cost: 0, target: "enemy", element: "wind", power: 90, magic: true, lock: "wind" },
  { id: "setwind", name: "Set Wind", desc: "Choose which way the wind blows next round. Free, and Gust acts again sooner.", kind: "wind", cost: 0, target: "none", weight: 0.5 },
  { id: "gale", name: "Gale", desc: "Wind damage down a whole lane.", kind: "attack", cost: 3, target: "enemy", element: "wind", power: 105, magic: true, shape: "lane", lock: "wind" },
  { id: "updraft", name: "Updraft", desc: "Lift an ally's line. +2 tension.", kind: "buff", cost: 2, target: "ally", effect: "giveTension", statusPower: 2, weight: 0.6 },
  { id: "hush", name: "Hush", desc: "Still the air around a foe. Cancels what it is winding up and silences it for 2 turns.", kind: "debuff", cost: 2, target: "enemy", status: "silence", statusTurns: 2, effect: "cancelCharge", element: "wind", lock: "wind" },

  // ---------------------------------------------------------------- Hale
  { id: "jab", name: "Jab", desc: "A frost-knuckled jab.", kind: "attack", cost: 0, target: "enemy", element: "cold", power: 100, lock: "cold" },
  { id: "frostbite", name: "Frostbite", desc: "Cold damage. The foe is slowed and takes extra heat.", kind: "attack", cost: 2, target: "enemy", element: "cold", power: 125, status: "frost", statusTurns: 3, lock: "cold" },
  { id: "rime", name: "Rime", desc: "The cold she brought down. Cold damage to all foes.", kind: "attack", cost: 3, target: "allEnemies", element: "cold", power: 90, lock: "cold" },
  { id: "holdfast", name: "Hold Fast", desc: "Steady an ally. For 2 turns it cannot be plucked or knocked down.", kind: "buff", cost: 2, target: "ally", status: "steady", statusTurns: 2, weight: 0.6 },

  // ---------------------------------------------------------------- Sump
  { id: "bump", name: "Bump", desc: "The whole lobe, at speed.", kind: "attack", cost: 0, target: "enemy", element: "blunt", power: 100, lock: "blunt" },
  { id: "burrow", name: "Burrow", desc: "Go under. Nothing hits you until your next turn, and you heal a little.", kind: "duck", cost: 1, target: "self", effect: "healSmall", weight: 0.6, lock: "duck" },
  { id: "swallow", name: "Swallow", desc: "Open wide. The next attack on any ally is swallowed, and Sump takes half of it.", kind: "buff", cost: 2, target: "self", status: "swallow", statusTurns: 3, weight: 0.6 },
  { id: "spit", name: "Spit", desc: "Hot. Heat damage to one foe.", kind: "attack", cost: 3, target: "enemy", element: "heat", power: 165, lock: "heat" },
  { id: "roll", name: "Roll", desc: "Roll down a lane. Blunt damage and guard down to everything in it.", kind: "attack", cost: 2, target: "enemy", element: "blunt", power: 85, shape: "lane", status: "defDown", statusTurns: 2, statusPower: 0.25, lock: "blunt" },

  // ---------------------------------------------------------------- Bob
  { id: "knock", name: "Knock", desc: "A plumb weight on a short line.", kind: "attack", cost: 0, target: "enemy", element: "blunt", power: 100, lock: "blunt" },
  { id: "plumb", name: "Plumb", desc: "Measure the foes. Reveals every weakness and what they are winding up. Bob acts again sooner.", kind: "special", cost: 1, target: "none", effect: "survey", weight: 0.5 },
  { id: "dropweight", name: "Drop Weight", desc: "Heavy blunt damage. A slack or unheld foe, or one at 0 tension, falls over.", kind: "attack", cost: 2, target: "enemy", element: "blunt", power: 135, effect: "downIfSlack", lock: "blunt" },
  { id: "truedown", name: "True Down", desc: "Remind everything which way is down. Foes are pulled to the middle lane and bruised.", kind: "attack", cost: 3, target: "allEnemies", element: "blunt", power: 70, effect: "pullMiddle", lock: "blunt" },
  { id: "measure", name: "Measure", desc: "Call the distances. The party crits more for 3 turns.", kind: "buff", cost: 2, target: "allAllies", status: "focus", statusTurns: 3, weight: 0.6 },

  // ---------------------------------------------------------------- Marrow
  { id: "tap", name: "Tap", desc: "A cold fingertip.", kind: "attack", cost: 0, target: "enemy", element: "cold", power: 90, magic: true, lock: "cold" },
  { id: "hold", name: "Hold", desc: "Hold an ally. The next hit on them does nothing.", kind: "buff", cost: 2, target: "ally", status: "hold", statusTurns: 3, weight: 0.6 },
  { id: "pullup", name: "Pull", desc: "Pull an ally's line. +2 tension. Marrow acts again sooner.", kind: "buff", cost: 1, target: "ally", effect: "giveTension", statusPower: 2, weight: 0.5 },
  { id: "release", name: "Let Go", desc: "Release an ally's line. Their tension heals them. They are slack for the fight: no Pluck, no Lift, can Duck.", kind: "letgo", cost: 0, target: "ally", effect: "releaseAlly", weight: 0.6 },
  { id: "frosthand", name: "Frost Hand", desc: "The cold of the hold. Cold damage, slowed, takes extra heat.", kind: "attack", cost: 3, target: "enemy", element: "cold", power: 120, magic: true, status: "frost", statusTurns: 3, lock: "cold" },

  // ---------------------------------------------------------------- Pairs (chapter 7)
  { id: "p_knotcord", name: "Knot and Cord", desc: "Fathom swings Burl. Blunt damage to all foes and foes aim at Burl.", kind: "attack", cost: 2, target: "allEnemies", element: "blunt", power: 150, effect: "pairTaunt", chapter: 7, lock: "blunt" },
  { id: "p_tunedline", name: "Tuned Line", desc: "Dulcet plays Fathom's fallen line. Heals the party and fills the phrase.", kind: "heal", cost: 2, target: "allAllies", heal: 40, effect: "fillPhrase", chapter: 7 },
  { id: "p_dancehall", name: "Dance Hall", desc: "Dulcet plays, Lissom dances. All foes slowed and two of them tangled.", kind: "debuff", cost: 2, target: "allEnemies", status: "slow", statusTurns: 2, effect: "tangleTwo", chapter: 7, lock: "tangle" },
  { id: "p_whirlwind", name: "Whirlwind", desc: "Lissom spins inside Gust. Cut damage to every lane.", kind: "attack", cost: 2, target: "allEnemies", element: "cut", power: 140, chapter: 7, lock: "cut" },
  { id: "p_blizzard", name: "Blizzard", desc: "Gust carries Hale's cold. Cold damage to all foes, all slowed.", kind: "attack", cost: 2, target: "allEnemies", element: "cold", power: 150, status: "frost", statusTurns: 2, chapter: 7, lock: "cold" },
  { id: "p_coldspit", name: "Cold Spit", desc: "Hale chills what Sump spits. Heavy damage to one foe.", kind: "attack", cost: 2, target: "enemy", element: "heat", power: 260, chapter: 7, lock: "heat" },
  { id: "p_undersurvey", name: "Under Survey", desc: "Bob calls it, Sump rolls it. Blunt damage to all foes and slack ones fall.", kind: "attack", cost: 2, target: "allEnemies", element: "blunt", power: 130, effect: "downIfSlack", chapter: 7, lock: "blunt" },
  { id: "p_plumbline", name: "Plumb Line", desc: "Bob measures, Fathom drops. One foe takes damage that ignores half its guard.", kind: "attack", cost: 2, target: "enemy", element: "blunt", power: 220, effect: "pierce", chapter: 7, lock: "blunt" },
  { id: "p_held", name: "Held", desc: "Marrow holds Fathom one more time. Fathom is fully healed and the line is rewound.", kind: "heal", cost: 2, target: "ally", heal: 999, effect: "refillPool", chapter: 8 },

  // ---------------------------------------------------------------- enemy skills
  { id: "e_bite", name: "Bite", desc: "", kind: "attack", cost: 0, target: "enemy", element: "blunt", power: 95 },
  { id: "e_nip", name: "Nip", desc: "", kind: "attack", cost: 0, target: "enemy", element: "cut", power: 90 },
  { id: "e_slash", name: "Slash", desc: "", kind: "attack", cost: 1, target: "enemy", element: "cut", power: 120 },
  { id: "e_pluck", name: "Pluck", desc: "", kind: "pluck", cost: 1, target: "enemy", element: "hum", power: 85, magic: true },
  { id: "e_tug", name: "Tug", desc: "", kind: "debuff", cost: 0, target: "enemy", effect: "giveTension", statusPower: 2, weight: 0.6 },
  { id: "e_elevate", name: "Elevate", desc: "", kind: "debuff", cost: 1, target: "enemy", effect: "giveTension", statusPower: 2, weight: 0.7, element: "hum", power: 45, magic: true },
  { id: "e_howl", name: "Howl", desc: "", kind: "buff", cost: 1, target: "self", status: "atkUp", statusTurns: 3, statusPower: 0.3 },
  { id: "e_mend", name: "Mend", desc: "", kind: "heal", cost: 2, target: "ally", heal: 25 },
  { id: "e_gust", name: "Gust", desc: "", kind: "attack", cost: 2, target: "enemy", element: "wind", power: 95, magic: true, shape: "lane" },
  { id: "e_chill", name: "Chill", desc: "", kind: "attack", cost: 2, target: "enemy", element: "cold", power: 110, magic: true, status: "frost", statusTurns: 2 },
  { id: "e_scorch", name: "Scorch", desc: "", kind: "attack", cost: 2, target: "enemy", element: "heat", power: 115, magic: true },
  { id: "e_sweep", name: "Sweep", desc: "", kind: "attack", cost: 2, target: "enemy", element: "blunt", power: 85, shape: "adjacent" },
  { id: "e_crush", name: "Crush", desc: "", kind: "attack", cost: 3, target: "enemy", element: "blunt", power: 190 },
  { id: "e_quake", name: "Quake", desc: "", kind: "attack", cost: 3, target: "allEnemies", element: "blunt", power: 85 },
  { id: "e_snip", name: "Snip", desc: "", kind: "attack", cost: 1, target: "enemy", element: "cut", power: 110, effect: "cutKnots" },
  { id: "e_tangleup", name: "Tangle Up", desc: "", kind: "tangle", cost: 2, target: "twoEnemies" },
  { id: "e_frame", name: "Frame", desc: "", kind: "buff", cost: 2, target: "allAllies", status: "defUp", statusTurns: 3, statusPower: 0.3 },
  { id: "e_drain", name: "Drain", desc: "", kind: "debuff", cost: 0, target: "enemy", effect: "stealTension", weight: 0.7 },
  { id: "e_shriek", name: "Shriek", desc: "", kind: "attack", cost: 2, target: "allEnemies", element: "hum", power: 80, magic: true },
  { id: "e_cling", name: "Cling", desc: "", kind: "buff", cost: 1, target: "self", status: "taunt", statusTurns: 2, effect: "defUp" },
  { id: "e_undertow", name: "Undertow", desc: "", kind: "attack", cost: 2, target: "allEnemies", element: "blunt", power: 80, effect: "pullMiddle" },
  { id: "e_sever", name: "Sever", desc: "", kind: "attack", cost: 3, target: "allEnemies", element: "cut", power: 75, effect: "cutKnots" },
  { id: "e_drop", name: "Drop", desc: "", kind: "attack", cost: 3, target: "allEnemies", element: "blunt", power: 65, status: "down", statusTurns: 1 },
  { id: "e_rehold", name: "Re-hold", desc: "", kind: "special", cost: 2, target: "enemy", effect: "rehold", weight: 0.8 },
  { id: "e_grip", name: "Grip", desc: "", kind: "attack", cost: 0, target: "enemy", element: "blunt", power: 105 },
  { id: "e_frostgrip", name: "Frost Grip", desc: "", kind: "attack", cost: 2, target: "enemy", element: "cold", power: 120, status: "frost", statusTurns: 2 },
  { id: "e_clench", name: "Clench", desc: "", kind: "attack", cost: 3, target: "allEnemies", element: "blunt", power: 90 },
  { id: "e_absorb", name: "Absorb", desc: "", kind: "heal", cost: 2, target: "self", heal: 40, effect: "drainAllTension" },
  { id: "e_swallowwhole", name: "Swallow Whole", desc: "", kind: "attack", cost: 3, target: "enemy", element: "blunt", power: 260 },
  { id: "e_reelin", name: "Reel In", desc: "", kind: "debuff", cost: 3, target: "allEnemies", effect: "giveTension", statusPower: 3, element: "blunt", power: 70 },
  { id: "e_judgment", name: "Judgment", desc: "", kind: "attack", cost: 3, target: "allEnemies", element: "hum", power: 105, magic: true },
  { id: "e_square", name: "Square", desc: "", kind: "attack", cost: 2, target: "enemy", element: "blunt", power: 110, shape: "lane", status: "down", statusTurns: 1 },
  { id: "e_untie", name: "Untie", desc: "", kind: "debuff", cost: 1, target: "enemy", effect: "cutKnots", weight: 0.6 },
  { id: "e_wail", name: "Wail", desc: "", kind: "attack", cost: 2, target: "allEnemies", element: "cold", power: 95, magic: true },
  { id: "e_summon", name: "Call", desc: "", kind: "special", cost: 2, target: "none", effect: "summon" },
  { id: "e_dance", name: "Dance", desc: "", kind: "buff", cost: 1, target: "allAllies", status: "haste", statusTurns: 2 },
  { id: "e_spin", name: "Spin", desc: "", kind: "attack", cost: 2, target: "allEnemies", element: "wind", power: 85, magic: true },
  { id: "e_eat", name: "Eat Line", desc: "", kind: "debuff", cost: 1, target: "enemy", effect: "eatPool", element: "cut", power: 60 },
  { id: "e_openhand", name: "Open Hand", desc: "", kind: "heal", cost: 0, target: "allAllies", heal: 60 },
];

export const SKILLS: Record<string, Skill> = Object.fromEntries(S.map((s) => [s.id, s]));

export function skill(id: string): Skill {
  const s = SKILLS[id];
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}

/** Pair skills by the two member ids that perform them. */
export const PAIRS: { members: [string, string]; skill: string }[] = [
  { members: ["fathom", "burl"], skill: "p_knotcord" },
  { members: ["fathom", "dulcet"], skill: "p_tunedline" },
  { members: ["dulcet", "lissom"], skill: "p_dancehall" },
  { members: ["lissom", "gust"], skill: "p_whirlwind" },
  { members: ["gust", "hale"], skill: "p_blizzard" },
  { members: ["hale", "sump"], skill: "p_coldspit" },
  { members: ["sump", "bob"], skill: "p_undersurvey" },
  { members: ["bob", "fathom"], skill: "p_plumbline" },
  { members: ["marrow", "fathom"], skill: "p_held" },
];
