import type { EnemyDef, EncounterGroup } from "../types";

const E: EnemyDef[] = [
  // ------------------------------------------------------------ chapter 1: Hem
  { id: "cordmouse", name: "Cordmouse", about: "Nests in the slack under eaves. Its line is thinner than a hair and twice as rude.", level: 1, held: true, economy: "tension", note: "G", sprite: { kind: "creature", seed: "cordmouse", a: "clay", b: "bone" }, skills: ["e_bite", "e_tug"], weak: ["cut"], resist: [], ai: "tugger", chapter: 1, drop: "flatbread" },
  { id: "slatmite", name: "Slatmite", about: "Clings to roof slats and chews the gaps wider. Roofers hate it. It hates roofers.", level: 1, held: true, economy: "tension", note: "E", sprite: { kind: "creature", seed: "slatmite", a: "olive", b: "sand" }, skills: ["e_bite", "e_cling"], weak: ["heat"], resist: ["blunt"], ai: "brute", hpMul: 0.8, chapter: 1, defMul: 1.2 },
  { id: "hummer", name: "Hummer", about: "A beetle that plucks lines for the sound. It prefers tight ones.", level: 2, held: true, economy: "tension", note: "C", sprite: { kind: "creature", seed: "hummer", variant: "flyer", a: "teal", b: "gold" }, skills: ["e_nip", "e_pluck"], weak: ["wind"], resist: ["hum"], ai: "plucker", hpMul: 0.8, chapter: 1 },
  { id: "lintling", name: "Lintling", about: "Gray fluff with an opinion. It came down the line with the Lint.", level: 2, held: false, economy: "slack", sprite: { kind: "creature", seed: "lintling", a: "ash", b: "salt" }, skills: ["e_bite", "e_cling"], weak: ["heat", "wind"], resist: ["cut"], ai: "brute", chapter: 1, hpMul: 0.8 },
  { id: "the_lint", name: "The Lint", about: "Scale, offal and nine hundred years of what the Hull scrapes off its catch, packed on your line like a bead. It has eyes now.", level: 3, held: false, economy: "slack", sprite: { kind: "creature", seed: "the_lint", variant: "tall", a: "ash", b: "frost" }, skills: ["e_bite", "e_crush", "e_cling", "e_summon"], weak: ["heat", "wind"], resist: ["cut"], ai: "boss", boss: true, hpMul: 0.8, chapter: 1, slugs: 60, drop: "spool" },

  // ------------------------------------------------------------ chapter 2: Slatlands
  { id: "tugbird", name: "Tugbird", about: "It pulls on lines to see what falls out. Its own line is a yard long.", level: 4, held: true, economy: "tension", note: "D", sprite: { kind: "creature", seed: "tugbird", variant: "flyer", a: "sky", b: "white" }, skills: ["e_nip", "e_tug", "e_tug"], weak: ["wind"], resist: [], ai: "tugger", hpMul: 0.8, chapter: 2, spdMul: 1.2 },
  { id: "choirgrub", name: "Choirgrub", about: "A larva raised in the Slatlands choirs. It can hold a note and a grudge.", level: 4, held: true, economy: "tension", note: "F", sprite: { kind: "creature", seed: "choirgrub", a: "gold", b: "rust" }, skills: ["e_pluck", "e_shriek"], weak: ["cold"], resist: ["hum"], ai: "plucker", chapter: 2 },
  { id: "slatwolf", name: "Slatwolf", about: "Wolves here walk the roofs. The slats are their streets.", level: 5, held: true, economy: "tension", note: "B", sprite: { kind: "creature", seed: "slatwolf", variant: "beast", a: "slate", b: "bone" }, skills: ["e_bite", "e_howl", "e_slash"], weak: ["heat"], resist: [], ai: "brute", chapter: 2, atkMul: 1.15 },
  { id: "kiteling", name: "Kiteling", about: "A paper thing the Reknotter flies. Nothing holds it. That is the point.", level: 5, held: false, economy: "slack", sprite: { kind: "wind", seed: "kiteling", a: "salt", b: "rose" }, skills: ["e_nip", "e_gust"], weak: ["heat"], resist: [], ai: "mage", chapter: 2, hpMul: 0.7, drop: "slugpouch" },
  { id: "reknotter", name: "Reknotter Vell", about: "Sells false lines to the slack. Charges by the fathom. Has never been slack.", level: 6, held: true, economy: "tension", note: "A", sprite: { kind: "humanoid", seed: "reknotter", variant: "hat", a: "plum", b: "gold" }, skills: ["e_tug", "e_pluck", "e_mend", "e_elevate"], weak: ["blunt"], resist: [], ai: "support", chapter: 2, hpMul: 1.0, slugs: 80 },
  { id: "the_kite", name: "The Great Kite", about: "A kite the size of a barn that holds up every false line Vell ever sold. Cut it and twenty liars fall over.", level: 6, held: false, economy: "slack", sprite: { kind: "thing", seed: "the_kite", a: "salt", b: "blood" }, skills: ["e_gust", "e_sweep", "e_spin", "e_tug"], weak: ["heat", "cut"], resist: ["hum"], ai: "boss", boss: true, chapter: 2, hpMul: 0.65, slugs: 120, drop: "w_bob" },

  // ------------------------------------------------------------ chapter 3: Snarl
  { id: "snarlhound", name: "Snarlhound", about: "Dogs of the Snarl are born tangled in pairs. They do everything twice.", level: 7, held: true, economy: "tension", note: "G", sprite: { kind: "creature", seed: "snarlhound", variant: "beast", a: "brick", b: "sand" }, skills: ["e_bite", "e_howl"], weak: ["cold"], resist: [], ai: "brute", chapter: 3 },
  { id: "guest", name: "Wedding Guest", about: "Still at the wedding. Sixty years in and still dancing. Will tangle you into it.", level: 7, held: true, economy: "tension", note: "D", sprite: { kind: "humanoid", seed: "guest", variant: "robe", a: "rose", b: "white" }, skills: ["e_nip", "e_tangleup", "e_dance"], weak: ["hum"], resist: [], ai: "tangler", chapter: 3 },
  { id: "knotcatcher", name: "Knot-catcher", about: "Paid by the knot. Carries a sack. Does not ask whether the knot was talking.", level: 8, held: true, economy: "tension", note: "F", sprite: { kind: "humanoid", seed: "knotcatcher", variant: "hat", a: "moss", b: "bone" }, skills: ["e_slash", "e_untie", "e_cling"], weak: ["wind"], resist: ["blunt"], ai: "hunter", chapter: 3, drop: "underbread" },
  { id: "mat", name: "Mat", about: "A floor of the Snarl that got up. Lines so knotted they stopped being anyone's.", level: 8, held: false, economy: "slack", sprite: { kind: "knot", seed: "mat", variant: "big", a: "brick", b: "rose" }, skills: ["e_sweep", "e_crush", "e_cling"], weak: ["cut", "heat"], resist: ["blunt", "wind"], ai: "brute", chapter: 3, hpMul: 1.3, spdMul: 0.8 },
  { id: "the_mayoralty", name: "The Mayoralty", about: "The Snarl's whole will, pulling on one line. It does not want to be untied. It also does.", level: 9, held: true, economy: "tension", note: "D", sprite: { kind: "knot", seed: "mayoralty", variant: "big", a: "rose", b: "gold" }, skills: ["e_sweep", "e_tangleup", "e_howl", "e_quake", "e_summon"], weak: ["cut"], resist: ["blunt"], ai: "boss", boss: true, hpMul: 0.75, chapter: 3, slugs: 180, drop: "g_pluck" },
  // The same knot, pulled a turn tighter by a stumbled dance
  { id: "the_mayoralty_tight", name: "The Mayoralty", about: "The Snarl's whole will, pulling on one line. You stumbled, and it has not forgotten.", level: 9, held: true, economy: "tension", note: "D", sprite: { kind: "knot", seed: "mayoralty", variant: "big", a: "rose", b: "gold" }, skills: ["e_sweep", "e_tangleup", "e_howl", "e_quake", "e_summon"], weak: ["cut"], resist: ["blunt"], ai: "boss", boss: true, hpMul: 0.9, atkMul: 1.1, chapter: 3, slugs: 180, drop: "g_pluck" },
  { id: "constituent", name: "Constituent", about: "One of the Snarl, voting with its feet.", level: 8, held: true, economy: "tension", note: "A", sprite: { kind: "humanoid", seed: "constituent", a: "rose", b: "bone" }, skills: ["e_nip", "e_tug"], weak: ["cut"], resist: [], ai: "tugger", chapter: 3, hpMul: 0.6, xpMul: 0.4 },

  // ------------------------------------------------------------ chapter 5: Pendulum Steppe
  { id: "swinger", name: "Swinger", about: "Steppe courier. Travels by letting the wind swing them. Delivers kicks.", level: 13, held: true, economy: "tension", note: "E", sprite: { kind: "humanoid", seed: "swinger", variant: "tall", a: "amber", b: "ink" }, skills: ["e_nip", "e_sweep", "e_howl"], weak: ["hum"], resist: ["wind"], ai: "striker", chapter: 5, spdMul: 1.25 },
  { id: "galeram", name: "Gale-ram", about: "A ram that has learned to charge downwind. Only hits what is in its lane.", level: 13, held: true, economy: "tension", note: "C", sprite: { kind: "creature", seed: "galeram", variant: "beast", a: "bone", b: "rust" }, skills: ["e_bite", "e_square"], weak: ["cut"], resist: ["blunt"], ai: "brute", chapter: 5, atkMul: 1.2 },
  { id: "draft", name: "Draft", about: "A wind too small to be weather. It sets the bigger wind and bites.", level: 14, held: false, economy: "slack", sprite: { kind: "wind", seed: "draft", a: "frost", b: "salt" }, skills: ["e_gust", "e_spin"], weak: ["cold"], resist: ["blunt", "cut"], ai: "windsetter", chapter: 5, hpMul: 0.7 },
  { id: "true_novice", name: "True Novice", about: "New to the frame. Still learning not to bend. Lends the frame to friends.", level: 14, held: true, economy: "tension", note: "B", sprite: { kind: "humanoid", seed: "true_novice", variant: "frame", a: "white", b: "slate" }, skills: ["e_bite", "e_frame", "e_tug"], weak: ["blunt"], resist: ["cut"], ai: "support", chapter: 5 },
  { id: "true_leveler", name: "True Leveler", about: "Shore crew, in a frame. Winds you tight until something bites. Calls that a good hum.", level: 15, held: true, economy: "tension", note: "G", sprite: { kind: "humanoid", seed: "true_leveler", variant: "frame", a: "white", b: "gold" }, skills: ["e_elevate", "e_pluck", "e_judgment"], weak: ["blunt"], resist: ["hum"], ai: "elevator", chapter: 5, magMul: 1.15 },
  { id: "leveler_rigor", name: "Leveler Rigor", about: "Has not bent in forty years. The frame is welded. Hums on purpose and calls it an Economy.", level: 15, held: true, economy: "tension", note: "G", sprite: { kind: "humanoid", seed: "rigor", variant: "frame", a: "white", b: "blood" }, skills: ["e_elevate", "e_judgment", "e_square", "e_frame", "e_pluck"], weak: ["blunt"], resist: ["cut", "hum"], ai: "boss", boss: true, hpMul: 0.75, chapter: 5, slugs: 260, drop: "g_frame" },

  // ------------------------------------------------------------ chapter 4: Let-Out
  { id: "broker", name: "Length-broker", about: "Buys slack from people who stay and sells it to people who leave. Takes tension as a fee.", level: 10, held: true, economy: "tension", note: "F", sprite: { kind: "humanoid", seed: "broker", variant: "hat", a: "gold", b: "ink" }, skills: ["e_drain", "e_nip", "e_mend"], weak: ["cut"], resist: [], ai: "drainer", chapter: 4, drop: "slugpouch" },
  { id: "spooler", name: "Spooler", about: "Shore gear from before anyone was hooked. It winds things in. It is not fussy about which things.", level: 10, held: false, economy: "slack", sprite: { kind: "thing", seed: "spooler", a: "slate", b: "amber" }, skills: ["e_crush", "e_tug", "e_sweep"], weak: ["heat", "wind"], resist: ["cut", "cold"], ai: "brute", chapter: 4, defMul: 1.3, charges: { e_crush: ["heat", "pluck"] } },
  { id: "marketcrow", name: "Market Crow", about: "Steals slugs. Steals them back. Has a stall.", level: 11, held: true, economy: "tension", note: "A", sprite: { kind: "creature", seed: "marketcrow", variant: "flyer", a: "coal", b: "gold" }, skills: ["e_nip", "e_pluck", "e_eat"], weak: ["wind"], resist: [], ai: "plucker", chapter: 4, spdMul: 1.2 },
  { id: "true_sentinel", name: "True Sentinel", about: "Stands at the Spindle so nobody slack gets let out. Has stood for six years. Frame is rusted.", level: 11, held: true, economy: "tension", note: "C", sprite: { kind: "humanoid", seed: "true_sentinel", variant: "frame", a: "white", b: "rust" }, skills: ["e_slash", "e_frame", "e_elevate"], weak: ["blunt"], resist: ["cut"], ai: "elevator", chapter: 4, hpMul: 1.2 },
  { id: "slacktaker", name: "Slack-taker", about: "Cuts fathoms off slack people's fallen lines and sells them. You are carrying inventory.", level: 12, held: true, economy: "tension", note: "E", sprite: { kind: "humanoid", seed: "slacktaker", a: "coal", b: "teal" }, skills: ["e_eat", "e_slash", "e_untie"], weak: ["hum"], resist: [], ai: "hunter", chapter: 4 },
  { id: "spindle_warden", name: "The Spindle Warden", about: "The machine that lets line out and reels it in. It reels anything that comes down. It is nine hundred years into a shift.", level: 12, held: false, economy: "slack", sprite: { kind: "thing", seed: "spindle_warden", variant: "pillar", a: "slate", b: "gold" }, skills: ["e_reelin", "e_crush", "e_sweep", "e_tug", "e_quake"], weak: ["heat", "wind", "cut"], resist: ["cold"], ai: "boss", boss: true, atkMul: 0.8, hpMul: 0.75, chapter: 4, slugs: 340, drop: "w_anchor", charges: { e_quake: ["heat", "knot", "pluck"], e_crush: ["wind", "blunt"] } },

  // ------------------------------------------------------------ chapter 6: Under
  { id: "lobe", name: "Lobe", about: "Sump's kin. Round, soft, many legged, and sure that being held is a joke you are telling.", level: 16, held: false, economy: "slack", sprite: { kind: "creature", seed: "lobe", variant: "beast", a: "plum", b: "sand" }, skills: ["e_bite", "e_cling", "e_crush"], weak: ["cold"], resist: ["heat", "blunt"], ai: "brute", chapter: 6, hpMul: 0.8, charges: { e_crush: ["cold", "cut"] } },
  { id: "blindpike", name: "Blind Pike", about: "A fish of the Under's pools. It has never seen a line and attacks by sound.", level: 16, held: false, economy: "slack", sprite: { kind: "creature", seed: "blindpike", a: "sea", b: "frost" }, skills: ["e_nip", "e_slash", "e_undertow"], weak: ["heat"], resist: ["cold"], ai: "striker", hpMul: 0.75, chapter: 6, spdMul: 1.2 },
  { id: "rootmite", name: "Rootmite", about: "Eats the sheathing off the Stays. Nine hundred years of that is why the Stays creak.", level: 17, held: false, economy: "slack", sprite: { kind: "creature", seed: "rootmite", a: "rust", b: "ash" }, skills: ["e_eat", "e_bite", "e_cling"], weak: ["heat", "blunt"], resist: ["cut"], ai: "hunter", hpMul: 0.8, chapter: 6, defMul: 1.3 },
  { id: "cut_scout", name: "Cut Scout", about: "Slack since birth, down here. Shear's eyes. Carries shears.", level: 17, held: false, economy: "slack", sprite: { kind: "humanoid", seed: "cut_scout", variant: "slack", a: "coal", b: "blood" }, skills: ["e_slash", "e_snip", "e_untie"], weak: ["hum"], resist: [], ai: "hunter", hpMul: 0.85, chapter: 6 },
  { id: "dripper", name: "Dripper", about: "Cold water given a shape and a bad temper. Drips on you from above, which is new.", level: 18, held: false, economy: "slack", sprite: { kind: "creature", seed: "dripper", variant: "tall", a: "frost", b: "sea" }, skills: ["e_chill", "e_wail"], weak: ["heat"], resist: ["cold", "cut"], ai: "mage", hpMul: 0.8, chapter: 6, charges: { e_wail: ["heat", "duck"] } },
  { id: "never_held", name: "The Thing That Was Never Held", about: "The oldest Fish on the shelves. It has never bitten anything it could not see, which is why it is still here.", level: 18, held: false, economy: "slack", sprite: { kind: "creature", seed: "never_held", variant: "tall", a: "plum", b: "mint" }, skills: ["e_swallowwhole", "e_undertow", "e_crush", "e_bite", "e_cling"], weak: ["cold", "hum"], resist: ["blunt", "heat"], ai: "boss", boss: true, hpMul: 1, atkMul: 1.2, chapter: 6, slugs: 420, drop: "s_cave", charges: { e_swallowwhole: ["cold", "pluck", "duck"], e_undertow: ["hum", "knot"] } },

  // ------------------------------------------------------------ chapter 7: Stays
  { id: "cut_blade", name: "Cut Blade", about: "Shear's soldiers. Every one of them has cut a line that was still holding someone.", level: 19, held: false, economy: "slack", sprite: { kind: "humanoid", seed: "cut_blade", variant: "slack", a: "coal", b: "blood" }, skills: ["e_slash", "e_snip", "e_howl"], weak: ["hum", "blunt"], resist: ["cut"], ai: "striker", chapter: 7, atkMul: 1.05 },
  { id: "cut_shearer", name: "Cut Shearer", about: "Carries shears taller than Fathom. Specializes in knots.", level: 19, held: false, economy: "slack", sprite: { kind: "humanoid", seed: "cut_shearer", variant: "tall", a: "coal", b: "ash" }, skills: ["e_sever", "e_untie", "e_slash"], weak: ["hum"], resist: ["cut"], ai: "hunter", hpMul: 0.85, chapter: 7, charges: { e_sever: ["blunt", "tangle"] } },
  { id: "staycrawler", name: "Stay-crawler", about: "Maintenance for the Stays, a thousand years overdue on its own maintenance.", level: 20, held: false, economy: "slack", sprite: { kind: "thing", seed: "staycrawler", a: "slate", b: "teal" }, skills: ["e_crush", "e_scorch", "e_sweep"], weak: ["cold", "wind"], resist: ["cut", "heat"], ai: "brute", atkMul: 1, chapter: 7, defMul: 1.3, charges: { e_crush: ["cold", "knot"] } },
  { id: "tension_ghost", name: "Tension Ghost", about: "What a line remembers after the bait is gone. Still hums. Still pulls.", level: 20, held: true, economy: "tension", note: "B", sprite: { kind: "wind", seed: "tension_ghost", variant: "face", a: "lilac", b: "frost" }, skills: ["e_tug", "e_pluck", "e_wail", "e_drain"], weak: ["hum", "heat"], resist: ["blunt", "cut"], ai: "elevator", chapter: 7, hpMul: 0.7 },
  { id: "ropewight", name: "Rope-wight", about: "A knot that fell to the shelves with the hook still in it and learned the wrong things.", level: 21, held: false, economy: "slack", sprite: { kind: "knot", seed: "ropewight", variant: "big", a: "coal", b: "plum" }, skills: ["e_sweep", "e_tangleup", "e_crush"], weak: ["heat", "cut"], resist: ["blunt"], ai: "tangler", chapter: 7, hpMul: 0.9 },
  { id: "shear", name: "Shear", about: "A tuner from Hem forty years ago, cut bait like you. Went down instead of along. Has been cutting since.", level: 21, held: false, economy: "slack", sprite: { kind: "humanoid", seed: "shear", variant: "slack", a: "coal", b: "blood" }, skills: ["e_sever", "e_drop", "e_slash", "e_snip", "e_howl"], weak: ["hum", "heat"], resist: ["cut"], ai: "boss", boss: true, hpMul: 0.55, atkMul: 1, chapter: 7, slugs: 520, drop: "g_cut", charges: { e_sever: ["hum", "blunt", "tangle"], e_drop: ["duck", "knot"] } },

  // ------------------------------------------------------------ chapter 8: Loft
  { id: "grip_finger", name: "Reel Pawl", about: "A pawl of the Reel. It lets line out and never lets it back.", level: 22, held: false, economy: "slack", sprite: { kind: "thing", seed: "grip_finger", variant: "pillar", a: "frost", b: "slate" }, skills: ["e_grip", "e_tug", "e_crush"], weak: ["heat", "hum"], resist: ["cold", "cut"], ai: "brute", chapter: 8, charges: { e_crush: ["heat", "knot"] } },
  { id: "frost_hand", name: "Cold Hook", about: "A hook from the cold side of the hold. It is still set. It does not know in what.", level: 22, held: false, economy: "slack", sprite: { kind: "thing", seed: "frost_hand", variant: "hand", a: "frost", b: "sea" }, skills: ["e_frostgrip", "e_wail", "e_elevate"], weak: ["heat"], resist: ["cold"], ai: "mage", chapter: 8 },
  { id: "lattice_sentry", name: "Deck Sentry", about: "Keeps the deck clear of anything that climbed up. Nothing has, until now.", level: 23, held: false, economy: "slack", sprite: { kind: "thing", seed: "lattice_sentry", a: "slate", b: "gold" }, skills: ["e_grip", "e_scorch", "e_quake"], weak: ["wind", "hum"], resist: ["cold", "blunt"], ai: "striker", hpMul: 0.8, chapter: 8, defMul: 1.2, charges: { e_quake: ["wind", "pluck", "duck"] } },
  { id: "tired_hand", name: "Sleeper", about: "Someone from the hold, walking in their sleep, humming. They were bait for three hundred years. Can be unhooked.", level: 23, held: true, economy: "tension", note: "F", sprite: { kind: "thing", seed: "tired_hand", variant: "hand", a: "lilac", b: "frost" }, skills: ["e_grip", "e_mend", "e_tug"], weak: ["hum"], resist: ["cold"], ai: "support", chapter: 8, hpMul: 1.1 },
  { id: "custody_drone", name: "Baiting Drone", about: "Takes the catch off the hook and hangs it in the hold. Polite about it. Re-baits in spring.", level: 24, held: false, economy: "slack", sprite: { kind: "thing", seed: "custody_drone", a: "frost", b: "amber" }, skills: ["e_elevate", "e_grip", "e_frostgrip"], weak: ["heat", "wind"], resist: ["cold"], ai: "elevator", hpMul: 0.75, chapter: 8, spdMul: 1.2 },
  { id: "first_hand", name: "The First Hook", about: "The first hook the Reel ever set. It has caught more than anything and has never once been caught.", level: 24, held: false, economy: "slack", sprite: { kind: "thing", seed: "first_hand", variant: "hand", a: "white", b: "indigo" }, skills: ["e_clench", "e_frostgrip", "e_elevate", "e_absorb", "e_grip"], weak: ["heat", "hum"], resist: ["cold"], ai: "boss", boss: true, hpMul: 0.9, atkMul: 1, magMul: 1, chapter: 8, slugs: 700, drop: "g_hand", charges: { e_clench: ["heat", "hum", "knot"], e_absorb: ["pluck", "duck"] } },

  // ------------------------------------------------------------ chapter 9: the Letting Go
  { id: "grip_hand", name: "Reel Hook", about: "The Reel, setting a hook in something that was cut loose.", level: 25, held: false, economy: "slack", sprite: { kind: "thing", seed: "grip_hand", variant: "hand", a: "frost", b: "blood" }, skills: ["e_rehold", "e_grip", "e_frostgrip"], weak: ["heat", "hum"], resist: ["cold"], ai: "reholder", hpMul: 0.85, chapter: 9 },
  { id: "grip_knuckle", name: "Reel Ratchet", about: "A tooth of the Reel. It only turns one way.", level: 25, held: false, economy: "slack", sprite: { kind: "thing", seed: "grip_knuckle", a: "slate", b: "blood" }, skills: ["e_clench", "e_grip", "e_crush"], weak: ["heat", "hum"], resist: ["cold"], ai: "brute", hpMul: 0.8, chapter: 9, atkMul: 1, charges: { e_clench: ["blunt", "knot", "duck"] } },
  { id: "grip_palm", name: "Reel Drum", about: "The drum every line on the Drop is wound on. It is turning.", level: 26, held: false, economy: "slack", sprite: { kind: "thing", seed: "grip_palm", variant: "hand", a: "white", b: "slate" }, skills: ["e_quake", "e_rehold", "e_absorb"], weak: ["hum", "wind", "heat"], resist: ["cold"], ai: "reholder", chapter: 9, hpMul: 0.8 },
  { id: "the_grip", name: "The Reel", about: "The machine that fishes. It has no one to fish for and has not noticed.", level: 28, held: false, economy: "slack", sprite: { kind: "thing", seed: "the_grip", variant: "hand", a: "white", b: "blood" }, skills: ["e_clench", "e_rehold", "e_frostgrip", "e_absorb", "e_quake", "e_grip", "e_openhand"], weak: ["heat", "hum"], resist: ["cold"], ai: "boss", boss: true, atkMul: 1, magMul: 1, chapter: 9, slugs: 0, hpMul: 0.72, charges: { e_clench: ["blunt", "knot", "duck"], e_quake: ["duck", "knot", "blunt"] } },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(E.map((e) => [e.id, e]));

export function enemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`unknown enemy ${id}`);
  return e;
}

export const GROUPS: EncounterGroup[] = [
  // chapter 1
  { id: "c1_mice", enemies: ["cordmouse", "cordmouse"], chapter: 1 },
  { id: "c1_mite", enemies: ["slatmite", "cordmouse"], chapter: 1 },
  { id: "c1_hummer", enemies: ["hummer", "cordmouse"], chapter: 1 },
  { id: "c1_lint", enemies: ["lintling", "lintling"], chapter: 1 },
  { id: "c1_mix", enemies: ["hummer", "slatmite", "cordmouse"], chapter: 1 },
  { id: "c1_boss", enemies: ["the_lint"], chapter: 1, boss: true },
  // chapter 2
  { id: "c2_birds", enemies: ["tugbird", "tugbird"], chapter: 2 },
  { id: "c2_grub", enemies: ["choirgrub", "tugbird"], chapter: 2 },
  { id: "c2_wolf", enemies: ["slatwolf", "choirgrub"], chapter: 2 },
  { id: "c2_kites", enemies: ["kiteling", "kiteling", "tugbird"], chapter: 2 },
  { id: "c2_pack", enemies: ["slatwolf", "slatwolf"], chapter: 2 },
  { id: "c2_boss", enemies: ["the_kite", "reknotter"], chapter: 2, boss: true },
  // chapter 3
  { id: "c3_hounds", enemies: ["snarlhound", "snarlhound"], chapter: 3 },
  { id: "c3_guests", enemies: ["guest", "guest", "snarlhound"], chapter: 3 },
  { id: "c3_catcher", enemies: ["knotcatcher", "guest"], chapter: 3 },
  { id: "c3_mat", enemies: ["mat", "snarlhound"], chapter: 3 },
  { id: "c3_party", enemies: ["guest", "knotcatcher", "guest"], chapter: 3 },
  { id: "c3_boss", enemies: ["the_mayoralty", "constituent", "constituent"], chapter: 3, boss: true },
  { id: "c3_boss_tight", enemies: ["the_mayoralty_tight", "constituent", "constituent"], chapter: 3, boss: true },
  // chapter 5
  { id: "c5_swingers", enemies: ["swinger", "swinger"], chapter: 5 },
  { id: "c5_rams", enemies: ["galeram", "draft"], chapter: 5 },
  { id: "c5_drafts", enemies: ["draft", "draft", "swinger"], chapter: 5 },
  { id: "c5_novices", enemies: ["true_novice", "true_novice", "true_leveler"], chapter: 5 },
  { id: "c5_leveler", enemies: ["true_leveler", "galeram"], chapter: 5 },
  { id: "c5_boss", enemies: ["leveler_rigor", "true_novice", "true_novice"], chapter: 5, boss: true },
  // chapter 4
  { id: "c4_brokers", enemies: ["broker", "marketcrow"], chapter: 4 },
  { id: "c4_spooler", enemies: ["spooler", "broker"], chapter: 4 },
  { id: "c4_crows", enemies: ["marketcrow", "marketcrow", "slacktaker"], chapter: 4 },
  { id: "c4_sentinels", enemies: ["true_sentinel", "true_sentinel"], chapter: 4 },
  { id: "c4_takers", enemies: ["slacktaker", "spooler"], chapter: 4 },
  { id: "c4_boss", enemies: ["spindle_warden", "true_sentinel"], chapter: 4, boss: true },
  // chapter 6
  { id: "c6_lobes", enemies: ["lobe", "lobe"], chapter: 6 },
  { id: "c6_pike", enemies: ["blindpike", "blindpike", "rootmite"], chapter: 6 },
  { id: "c6_scouts", enemies: ["cut_scout", "cut_scout"], chapter: 6 },
  { id: "c6_drip", enemies: ["dripper", "rootmite"], chapter: 6 },
  { id: "c6_mix", enemies: ["lobe", "dripper", "cut_scout"], chapter: 6 },
  { id: "c6_boss", enemies: ["never_held"], chapter: 6, boss: true },
  // chapter 7
  { id: "c7_blades", enemies: ["cut_blade", "cut_blade"], chapter: 7 },
  { id: "c7_shearers", enemies: ["cut_shearer", "cut_blade"], chapter: 7 },
  { id: "c7_crawler", enemies: ["staycrawler", "tension_ghost"], chapter: 7 },
  { id: "c7_ghosts", enemies: ["tension_ghost", "tension_ghost", "ropewight"], chapter: 7 },
  { id: "c7_wight", enemies: ["ropewight", "cut_shearer"], chapter: 7 },
  { id: "c7_boss", enemies: ["shear", "cut_blade"], chapter: 7, boss: true },
  { id: "c7_boss_alone", enemies: ["shear"], chapter: 7, boss: true },
  // chapter 8
  { id: "c8_fingers", enemies: ["grip_finger", "grip_finger"], chapter: 8 },
  { id: "c8_frost", enemies: ["frost_hand", "custody_drone"], chapter: 8 },
  { id: "c8_sentry", enemies: ["lattice_sentry", "grip_finger"], chapter: 8 },
  { id: "c8_tired", enemies: ["tired_hand", "frost_hand"], chapter: 8 },
  { id: "c8_drones", enemies: ["custody_drone", "custody_drone", "lattice_sentry"], chapter: 8 },
  { id: "c8_boss", enemies: ["first_hand", "grip_finger"], chapter: 8, boss: true },
  // chapter 9
  { id: "c9_hands", enemies: ["grip_hand", "grip_knuckle"], chapter: 9 },
  { id: "c9_palm", enemies: ["grip_palm", "grip_hand"], chapter: 9 },
  { id: "c9_knuckles", enemies: ["grip_knuckle", "grip_knuckle", "grip_hand"], chapter: 9 },
  { id: "c9_boss", enemies: ["the_grip"], chapter: 9, boss: true },
];

export const GROUP_BY_ID: Record<string, EncounterGroup> = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

export function groupsForChapter(ch: number, boss = false): EncounterGroup[] {
  return GROUPS.filter((g) => g.chapter === ch && !!g.boss === boss);
}
