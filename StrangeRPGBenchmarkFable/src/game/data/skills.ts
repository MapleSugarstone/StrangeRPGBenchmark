import type { SkillDef } from "../types";

const list: SkillDef[] = [
  // Universal actions.
  { id: "attack", name: "Attack", desc: "A plain strike.", cost: 0, target: "enemy", kind: "phys", power: 100 },
  { id: "guard", name: "Guard", desc: "Halve damage this round. With Brace, the next attack deals double.", cost: 0, target: "self", kind: "support", special: "guard" },
  { id: "delay", name: "Delay", desc: "Wait. Pushes your turn later and restores a little Static.", cost: 0, target: "self", kind: "support", special: "delay", mech: "tempo" },
  { id: "borrow", name: "Borrow", desc: "Take Static from the Bank of Teeth. Interest is due.", cost: 0, target: "self", kind: "support", special: "borrow", mech: "debt" },
  { id: "rewind", name: "Rewind", desc: "Undo the last turn. Once per battle.", cost: 0, target: "self", kind: "support", special: "rewind", mech: "rewind" },
  { id: "fuse", name: "Fuse", desc: "Merge with an ally for three turns.", cost: 0, target: "ally", kind: "support", special: "fuse", mech: "fusion" },
  { id: "swaprow", name: "Row", desc: "Step to the other row. Quick.", cost: 0, target: "self", kind: "support", special: "swaprow", mech: "rows" },

  // Pell, the Scraper.
  { id: "scrape", name: "Scrape", desc: "Rake the target. Lowers its defense.", cost: 3, target: "enemy", kind: "phys", power: 130, status: [{ id: "defdown", turns: 2 }] },
  { id: "salt_throw", name: "Salt Throw", desc: "A fistful of salt in the eyes.", cost: 3, target: "enemy", kind: "phys", power: 60, ranged: true, status: [{ id: "blind", turns: 3, chance: 0.8 }] },
  { id: "lamp_oil", name: "Lamp Oil", desc: "Throw and light it. Burns.", cost: 5, target: "enemy", kind: "mag", power: 95, element: "heat", ranged: true, status: [{ id: "burn", turns: 3, chance: 0.7 }] },
  { id: "brine_wall", name: "Brine Wall", desc: "Salt water hardens around the party.", cost: 5, target: "allies", kind: "support", status: [{ id: "shield", turns: 2 }] },
  { id: "rimward_cut", name: "Rimward Cut", desc: "A cut that remembers the edge of the world.", cost: 8, target: "enemy", kind: "phys", power: 165, crit: 0.25 },
  { id: "lamplight", name: "Lamplight", desc: "The village lamp, remembered. Light on all foes.", cost: 10, target: "enemies", kind: "mag", power: 110, element: "light", ranged: true },
  { id: "elixir_sun", name: "Small Sun", desc: "What you carried back. Light on all foes, lit on all friends.", cost: 16, target: "enemies", kind: "mag", power: 180, element: "light", ranged: true, status: [{ id: "lit", turns: 3, self: true }] },

  // Oxbow, the rust knight.
  { id: "bash", name: "Bash", desc: "Hit with the whole arm. May shock.", cost: 4, target: "enemy", kind: "phys", power: 130, status: [{ id: "shock", turns: 1, chance: 0.3 }] },
  { id: "taunt", name: "Taunt", desc: "Draw every eye. Raises defense.", cost: 2, target: "self", kind: "support", status: [{ id: "taunt", turns: 2 }, { id: "defup", turns: 2 }] },
  { id: "overclock", name: "Overclock", desc: "Run hot. Haste, but it costs HP.", cost: 3, target: "self", kind: "support", status: [{ id: "haste", turns: 3 }], special: "selfhurt10" },
  { id: "ironhide", name: "Ironhide", desc: "Share the rust. Party defense up.", cost: 5, target: "allies", kind: "support", status: [{ id: "defup", turns: 3 }] },
  { id: "rust_cloud", name: "Rust Cloud", desc: "Shed oxide on all foes. Rot damage, lowers defense.", cost: 7, target: "enemies", kind: "mag", power: 90, element: "rot", status: [{ id: "defdown", turns: 2, chance: 0.6 }] },
  { id: "siege_mode", name: "Siege Mode", desc: "Lock the joints and swing. Slows you after.", cost: 11, target: "enemy", kind: "phys", power: 230, status: [{ id: "slow", turns: 2, self: true }] },

  // Sister Vane, the dispenser.
  { id: "prayer", name: "Prayer", desc: "Ask the Vendor for mercy. Heals.", cost: 3, target: "ally", kind: "heal", heal: 32 },
  { id: "coin_toss", name: "Coin Toss", desc: "Volt damage. Heads doubles it, tails halves it.", cost: 3, target: "enemy", kind: "mag", power: 95, element: "volt", ranged: true, special: "gamble" },
  { id: "dispense", name: "Dispense", desc: "The Vendor drops something. Random blessing on an ally.", cost: 4, target: "ally", kind: "support", special: "dispense" },
  { id: "jingle", name: "Jingle", desc: "A coin on the metronome. Delays the target.", cost: 3, target: "enemy", kind: "support", tempo: 40, mech: "tempo", ranged: true, acc: 1 },
  { id: "refund", name: "Refund", desc: "Return a fallen ally, half full.", cost: 8, target: "deadally", kind: "heal", revive: 0.5 },
  { id: "mass_prayer", name: "Mass Prayer", desc: "Everyone kneels. Heals the party.", cost: 8, target: "allies", kind: "heal", heal: 26 },
  { id: "jackpot", name: "Jackpot", desc: "Every coin at once. Light damage to all.", cost: 16, target: "enemies", kind: "mag", power: 150, element: "light", ranged: true },

  // Mim, the lightfeeder.
  { id: "flutter", name: "Flutter", desc: "Wing static. Volt damage.", cost: 4, target: "enemy", kind: "mag", power: 100, element: "volt", ranged: true },
  { id: "frostdust", name: "Frostdust", desc: "Cold wing dust. May freeze.", cost: 4, target: "enemy", kind: "mag", power: 95, element: "cold", ranged: true, status: [{ id: "freeze", turns: 2, chance: 0.5 }] },
  { id: "hearthbreath", name: "Hearthbreath", desc: "A warm breath that burns.", cost: 4, target: "enemy", kind: "mag", power: 95, element: "heat", ranged: true, status: [{ id: "burn", turns: 2, chance: 0.5 }] },
  { id: "powder", name: "Powder", desc: "Dust in every eye. Blinds all foes.", cost: 4, target: "enemies", kind: "support", status: [{ id: "blind", turns: 2, chance: 0.75 }], ranged: true },
  { id: "eat_light", name: "Eat Light", desc: "Swallow your own buffs. Light damage per buff eaten.", cost: 2, target: "enemy", kind: "mag", power: 70, element: "light", ranged: true, special: "eatlight" },
  { id: "lightstorm", name: "Lightstorm", desc: "Every moth at once. Light on all foes.", cost: 14, target: "enemies", kind: "mag", power: 125, element: "light", ranged: true },
  { id: "moonmoth", name: "Moonmoth", desc: "The moon is an egg. This is what hatches. Cold.", cost: 16, target: "enemy", kind: "mag", power: 210, element: "cold", ranged: true },

  // Quill, the archivist.
  { id: "recite", name: "Recite", desc: "Read aloud. Stronger for each Memory the party wears.", cost: 4, target: "enemy", kind: "mag", power: 80, ranged: true, special: "recite" },
  { id: "index", name: "Index", desc: "File the foe. Reveals weakness, lowers magic and defense.", cost: 2, target: "enemy", kind: "support", ranged: true, status: [{ id: "magdown", turns: 3 }, { id: "defdown", turns: 3 }], special: "reveal" },
  { id: "errata", name: "Errata", desc: "Correct an ally. Cures and heals a little.", cost: 3, target: "ally", kind: "heal", heal: 14, cure: ["poison", "burn", "shock", "freeze", "blind", "slow", "silence", "doom"] },
  { id: "footnote", name: "Footnote", desc: "A small ongoing note. Regen on an ally.", cost: 4, target: "ally", kind: "support", status: [{ id: "regen", turns: 4 }] },
  { id: "redaction", name: "Redaction", desc: "Black out the foe. Rot damage, silence.", cost: 7, target: "enemy", kind: "mag", power: 110, element: "rot", ranged: true, status: [{ id: "silence", turns: 2, chance: 0.6 }] },
  { id: "bibliomancy", name: "Bibliomancy", desc: "Open a random page. Something happens.", cost: 8, target: "any", kind: "special", special: "bibliomancy", ranged: true },

  // Fold, the cartographer.
  { id: "redraw", name: "Redraw", desc: "Erase the foe's footing. Shoves it to the back row.", cost: 2, target: "enemy", kind: "phys", power: 90, push: "back" },
  { id: "shortcut", name: "Shortcut", desc: "Pull an ally to the front and hurry them.", cost: 2, target: "ally", kind: "support", push: "front", status: [{ id: "haste", turns: 1 }] },
  { id: "contour", name: "Contour", desc: "Draw hills around the party. Defense up.", cost: 4, target: "allies", kind: "support", status: [{ id: "defup", turns: 2 }] },
  { id: "blank_spot", name: "Blank Spot", desc: "Here be nothing. Blinds and weakens the foe's magic.", cost: 4, target: "enemy", kind: "support", ranged: true, status: [{ id: "blind", turns: 3 }, { id: "magdown", turns: 3 }] },
  { id: "survey", name: "Survey", desc: "Measure every foe. Shoves them all back.", cost: 6, target: "enemies", kind: "phys", power: 60, push: "back", ranged: true },
  { id: "terra_incognita", name: "Terra Incognita", desc: "Draw a place that does not exist and drop them in it.", cost: 12, target: "enemies", kind: "phys", power: 150, ranged: true },

  // Uhtred-7, the debtor.
  { id: "loan_strike", name: "Loan Strike", desc: "Borrowed strength. Big hit, six teeth of debt.", cost: 0, target: "enemy", kind: "phys", power: 210, debt: 6, mech: "debt" },
  { id: "collateral", name: "Collateral", desc: "Pledge your bones. Shield, four teeth of debt.", cost: 0, target: "self", kind: "support", status: [{ id: "shield", turns: 2 }], debt: 4, mech: "debt" },
  { id: "interest", name: "Interest", desc: "Pass the debt on. Heavy poison, three teeth.", cost: 0, target: "enemy", kind: "support", status: [{ id: "poison", turns: 5 }], debt: 3, mech: "debt", ranged: true },
  { id: "garnish", name: "Garnish", desc: "Take what they owe. Damage and steal gold.", cost: 2, target: "enemy", kind: "phys", power: 90, special: "steal" },
  { id: "default", name: "Default", desc: "Refuse to pay. Enormous damage, you drop to 1 HP, ten teeth.", cost: 0, target: "enemy", kind: "phys", power: 420, debt: 10, mech: "debt", special: "selfto1" },

  // Dust, the echo.
  { id: "foreshadow", name: "Foreshadow", desc: "Tell an ally what they will do. Attack and magic up.", cost: 3, target: "ally", kind: "support", status: [{ id: "atkup", turns: 2 }, { id: "magup", turns: 2 }] },
  { id: "hindsight", name: "Hindsight", desc: "Heal an ally by what they lost last turn.", cost: 4, target: "ally", kind: "heal", special: "hindsight" },
  { id: "unhappen", name: "Unhappen", desc: "Strip the foe's buffs and hurt it.", cost: 4, target: "enemy", kind: "mag", power: 90, ranged: true, special: "dispel" },
  { id: "echo_strike", name: "Echo Strike", desc: "Hit twice, once now and once a moment ago.", cost: 7, target: "enemy", kind: "phys", power: 95, hits: 2 },
  { id: "already_dead", name: "Already Dead", desc: "It was always going to end this way. Doom in three turns.", cost: 10, target: "enemy", kind: "support", status: [{ id: "doom", turns: 3, chance: 0.7 }], ranged: true },

  // Choir, the crowd.
  { id: "harmony", name: "Harmony", desc: "Everyone sings the same note. Heals and raises attack.", cost: 5, target: "allies", kind: "heal", heal: 20, status: [{ id: "atkup", turns: 2 }] },
  { id: "dissonance", name: "Dissonance", desc: "Everyone sings a different note. Damage to all foes.", cost: 8, target: "enemies", kind: "mag", power: 105, ranged: true },
  { id: "crescendo", name: "Crescendo", desc: "Louder. Party haste.", cost: 8, target: "allies", kind: "support", status: [{ id: "haste", turns: 2 }] },
  { id: "round", name: "Round", desc: "The same line, three times, at three foes.", cost: 7, target: "enemies", kind: "phys", power: 70, hits: 3, special: "randomtargets" },

  // Enemy skills.
  { id: "bite", name: "Bite", desc: "", cost: 0, target: "enemy", kind: "phys", power: 110 },
  { id: "sting", name: "Sting", desc: "", cost: 0, target: "enemy", kind: "phys", power: 80, status: [{ id: "poison", turns: 3, chance: 0.6 }] },
  { id: "spit", name: "Spit", desc: "", cost: 0, target: "enemy", kind: "mag", power: 90, element: "rot", ranged: true },
  { id: "lick", name: "Lick", desc: "", cost: 0, target: "self", kind: "heal", heal: 20 },
  { id: "howl", name: "Howl", desc: "", cost: 0, target: "allies", kind: "support", status: [{ id: "atkup", turns: 2 }] },
  { id: "ember", name: "Ember", desc: "", cost: 0, target: "enemy", kind: "mag", power: 100, element: "heat", ranged: true, status: [{ id: "burn", turns: 2, chance: 0.5 }] },
  { id: "chill", name: "Chill", desc: "", cost: 0, target: "enemy", kind: "mag", power: 100, element: "cold", ranged: true, status: [{ id: "freeze", turns: 2, chance: 0.4 }] },
  { id: "zap", name: "Zap", desc: "", cost: 0, target: "enemy", kind: "mag", power: 100, element: "volt", ranged: true, status: [{ id: "shock", turns: 1, chance: 0.4 }] },
  { id: "gust", name: "Gust", desc: "", cost: 0, target: "enemies", kind: "mag", power: 70, ranged: true },
  { id: "tick", name: "Tick", desc: "", cost: 0, target: "enemy", kind: "support", tempo: 35, ranged: true, acc: 1 },
  { id: "tock", name: "Tock", desc: "", cost: 0, target: "self", kind: "support", tempo: -40 },
  { id: "flare", name: "Flare", desc: "", cost: 0, target: "enemies", kind: "mag", power: 90, element: "light", ranged: true, status: [{ id: "blind", turns: 2, chance: 0.4 }] },
  { id: "crush", name: "Crush", desc: "", cost: 0, target: "enemy", kind: "phys", power: 170 },
  { id: "drain", name: "Drain", desc: "", cost: 0, target: "enemy", kind: "mag", power: 80, element: "rot", ranged: true, special: "lifesteal" },
  { id: "shatter", name: "Shatter", desc: "", cost: 0, target: "enemies", kind: "mag", power: 85, element: "cold", ranged: true },
  { id: "hymn", name: "Hymn", desc: "", cost: 0, target: "allies", kind: "heal", heal: 24 },
  { id: "tithe", name: "Tithe", desc: "", cost: 0, target: "enemy", kind: "phys", power: 70, special: "steal" },
  { id: "repo", name: "Repossess", desc: "", cost: 0, target: "enemy", kind: "support", special: "dispel", ranged: true },
  { id: "lend", name: "Lend", desc: "", cost: 0, target: "enemy", kind: "support", special: "forcedebt", ranged: true },
  { id: "unwind", name: "Unwind", desc: "", cost: 0, target: "self", kind: "heal", special: "hindsight" },
  { id: "prism", name: "Prism", desc: "", cost: 0, target: "enemies", kind: "mag", power: 80, element: "light", ranged: true },
  { id: "shove", name: "Shove", desc: "", cost: 0, target: "enemy", kind: "phys", power: 80, push: "back" },
  { id: "hook", name: "Hook", desc: "", cost: 0, target: "enemy", kind: "phys", power: 80, push: "front" },
  { id: "verse", name: "Verse", desc: "", cost: 0, target: "enemies", kind: "mag", power: 95, ranged: true },
  { id: "loom", name: "Loom", desc: "", cost: 0, target: "enemies", kind: "mag", power: 120, element: "light", ranged: true },
  { id: "unmake", name: "Unmake", desc: "", cost: 0, target: "enemy", kind: "mag", power: 150, element: "rot", ranged: true, status: [{ id: "doom", turns: 4, chance: 0.5 }] },
  { id: "eclipse", name: "Eclipse", desc: "", cost: 0, target: "enemies", kind: "support", ranged: true, status: [{ id: "blind", turns: 2 }, { id: "slow", turns: 2 }] },
  { id: "crescendo_e", name: "Crescendo", desc: "", cost: 0, target: "allies", kind: "support", status: [{ id: "haste", turns: 2 }, { id: "atkup", turns: 2 }] },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]));

export function skill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}
