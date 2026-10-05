import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, KNOT, SCRAP_NPC, scrapTalk, hooking, inn } from "./common";

const home: MapDef = {
  id: "hem_home",
  name: "Fathom's house",
  theme: "indoor",
  music: "town",
  musicSeed: "hem",
  caption: "Hem, the morning of the Lift",
  rows: [
    "WWWWWWWWWWWW",
    "WffffhhffffW",
    "WBfffffftffW",
    "WffffffffffW",
    "WfffffffffsW",
    "WffffffffffW",
    "WWWWWDWWWWWW",
  ],
  npcs: [],
  triggers: [
    { id: "home_shelf", x: 5, y: 1, w: 2, on: "interact" },
    { id: "home_bed", x: 1, y: 2, on: "interact" },
    { id: "home_table", x: 8, y: 2, on: "interact" },
    { id: "home_sign", x: 10, y: 4, on: "interact" },
    { id: "home_floor", x: 3, y: 4, on: "interact", showIf: "slack" },
  ],
  exits: [{ x: 5, y: 6, to: "hem", tx: 7, ty: 4, facing: "down" }],
};

const hem: MapDef = {
  id: "hem",
  name: "Hem",
  theme: "hem",
  music: "town",
  musicSeed: "hem",
  rows: [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T.....x..................x.T",
    "T..||||....||||....||||....T",
    "T..|||D....|||D....|||D....T",
    "T..........................T",
    "T...x.........s............T",
    "T..............w...........T",
    "T....,,,,,,,,,,,,,,,,,.....T",
    "T....,,,,,,,,,,,,,,,,,.....T",
    "T....,,,,,,P,,,,,,,,,,.....T",
    "T....,,,,,,,,,,,,,,,,,.....T",
    "T....,,,,,,,,,,,,,,,,,.....T",
    "T..........................T",
    "T..|||||....||||....||||...T",
    "T..||||D....|||D....|||D...T",
    "T..........................T",
    "T.......x..........x.......T",
    "T..........................T",
    "T.....bb..........bb.......T",
    "T..........................T",
    "T...V......................T",
    "T....................TTTTTTT",
    "T...........................",
    "T..........................T",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  line: [[7, 9], [9, 10], [12, 10], [15, 11], [19, 12], [23, 14], [26, 18], [27, 22]],
  marks: [{ kind: "crack", x: 15, y: 10, showIf: "c1_lift" }],
  npcs: [
    { id: "wren", x: 9, y: 11, sprite: P("wren", "sand", "rose"), name: "Wren", note: "D", talk: "wren" },
    { id: "ansel", x: 11, y: 8, sprite: P("ansel", "white", "gold", "robe"), name: "Leveler Ansel", note: "G", talk: "ansel", hideIf: "slack" },
    { id: "ansel_step", x: 6, y: 15, facing: "right", sprite: P("ansel", "white", "gold", "robe"), name: "Leveler Ansel", note: "G", talk: "ansel", showIf: "slack" },
    { id: "ostle", x: 23, y: 15, sprite: P("ostle", "clay", "violet", "hat"), name: "Grandmother Ostle", note: "A", talk: "ostle" },
    { id: "pim", x: 15, y: 15, sprite: P("pim", "olive", "gold"), name: "Pim", note: "E", talk: "pim" },
    { id: "singer1", x: 13, y: 10, sprite: P("singer1", "bone", "sea"), name: "Hob", note: "C", talk: "singer", hideIf: "slack" },
    { id: "singer2", x: 15, y: 10, sprite: P("singer2", "bone", "plum"), name: "Mell", note: "E", talk: "mell", hideIf: "c1_lift" },
    { id: "singer3", x: 17, y: 10, sprite: P("singer3", "bone", "moss"), name: "Tansy", note: "G", talk: "singer", hideIf: "slack" },
    { id: "singer4", x: 19, y: 10, sprite: P("singer4", "bone", "rust"), name: "Dace", note: "B", talk: "singer", hideIf: "slack" },
    { id: "kid", x: 5, y: 17, sprite: P("kid", "sand", "sky", "small"), name: "Nib", note: "F", talk: "kid", wander: true },
    { id: "roofer", x: 20, y: 4, sprite: P("roofer", "clay", "amber", "hat"), name: "Cask the roofer", note: "D", talk: "roofer", wander: true },
    { id: "measurer", x: 8, y: 5, sprite: P("measurer", "white", "slate", "frame"), name: "The Measurer", note: "B", talk: "measurer", hideIf: "c1_lift" },
    { id: "lurewright", x: 24, y: 9, sprite: P("lurewright", "clay", "gold"), name: "Tolly the lure-wright", note: "C", talk: "lurewright", wander: true },
    { id: "catcher", x: 24, y: 19, sprite: P("catcher", "moss", "bone", "hat"), name: "Knot-catcher", note: "F", talk: "catcher", showIf: "slack", hideIf: "c1_burl" },
    { id: "burl_npc", x: 25, y: 20, sprite: KNOT("burl", "rust", "gold"), name: "a knot", held: true, talk: "burl_talk", showIf: "slack", hideIf: "c1_burl", solid: true },
    { id: "novice1", x: 26, y: 22, sprite: P("novice1", "white", "slate", "frame"), name: "Novice", note: "B", talk: "novice", hideIf: "c1_lift" },
    { id: "mourner", x: 14, y: 9, sprite: P("mourner", "bone", "ash", "robe"), name: "Old Fen", note: "A", talk: "mourner", showIf: "slack", wander: true },
    { id: "dripkid", x: 3, y: 12, sprite: P("dripkid", "sand", "teal", "small"), name: "Sorrel", note: "G", talk: "dripkid" },
    SCRAP_NPC(2, 20),
  ],
  triggers: [
    { id: "hem_square", x: 5, y: 7, w: 17, h: 5, on: "enter", once: true, hideIf: "c1_tuned" },
    { id: "hem_bell", x: 11, y: 9, on: "interact" },
    { id: "hem_sign", x: 14, y: 5, on: "interact" },
    { id: "hem_well", x: 15, y: 6, on: "interact" },
    { id: "hem_office", x: 7, y: 14, on: "interact" },
    { id: "hem_office_back", x: 3, y: 15, on: "interact", showIf: "slack" },
    { id: "hem_shop_door", x: 15, y: 14, on: "interact" },
    { id: "hem_ostle_door", x: 23, y: 14, on: "interact" },
    { id: "hem_house1", x: 6, y: 3, on: "interact" },
    { id: "hem_house2", x: 14, y: 3, on: "interact" },
    { id: "hem_house3", x: 22, y: 3, on: "interact" },
    { id: "hem_bushes", x: 6, y: 18, w: 2, on: "interact" },
    { id: "hem_dawn", x: 26, y: 22, on: "enter", showIf: "c1_read", hideIf: "c1_done" },
  ],
  exits: [
    { x: 27, y: 22, to: "hem_fields", tx: 1, ty: 10, facing: "right", needs: "c1_burl", blocked: "The east road is where the line went. Not yet." },
    { x: 7, y: 3, to: "hem_home", tx: 5, ty: 5, facing: "up" },
    { x: 3, y: 15, to: "office_cellar", tx: 2, ty: 1, facing: "down", needs: "c1_cellar_open", blocked: "" },
  ],
};

const cellar: MapDef = {
  id: "office_cellar",
  name: "Under the Plumb Office",
  theme: "under",
  music: "under",
  musicSeed: "cellar",
  caption: "Under the Office. Nobody held has ever been here.",
  dark: true,
  slackOnly: true,
  noLines: true,
  rows: [
    "uuuuuuuuuuuuu",
    "u___________u",
    "u_hhh___hhh_u",
    "u___________u",
    "u____ttt____u",
    "u___________u",
    "u_______K___u",
    "u___________u",
    "uuuuuuuuuuuuu",
  ],
  npcs: [],
  triggers: [
    { id: "cellar_in", x: 1, y: 1, w: 3, h: 2, on: "enter", once: true },
    { id: "cellar_shelf", x: 2, y: 2, w: 3, on: "interact" },
    { id: "cellar_shelf2", x: 8, y: 2, w: 3, on: "interact" },
    { id: "cellar_table", x: 5, y: 4, w: 3, on: "interact" },
    { id: "cellar_cable", x: 8, y: 6, on: "interact" },
  ],
  exits: [{ x: 2, y: 1, to: "hem", tx: 3, ty: 16, facing: "down" }],
  chests: [{ id: "cellar_chest", x: 11, y: 7, item: "l_mute", count: 1 }],
};

const fields: MapDef = {
  id: "hem_fields",
  name: "The Hem fields",
  theme: "hem",
  music: "road",
  musicSeed: "hemfields",
  caption: "The fields east of Hem",
  rows: [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T.........T......................~~T",
    "T..b......T...........r..........~~T",
    "T.........TT......................~T",
    "T....x............b...............~T",
    "T..........................bb.....~T",
    "T..r...........................~~~~T",
    "T.............x..........~~~~~~~~~~T",
    "T......b................~~~=.......T",
    "T.........................~=.......T",
    "...........................=.......T",
    "T..........r..............~=....r..T",
    "T.....................x..~~~~~~~~~.T",
    "T..b.......................~~~~~~~.T",
    "T..................b..........~~...T",
    "T....TT.................r.....~....T",
    "T....TT........x..............~~...T",
    "T......w......................~~~..T",
    "T..............................~~~..",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  line: [[0, 10], [4, 10], [8, 12], [12, 13], [16, 11], [20, 9], [24, 10], [27, 10], [29, 13], [31, 15], [33, 17], [35, 18]],
  npcs: [
    { id: "goatherd", x: 20, y: 14, sprite: P("goatherd", "olive", "bone", "hat"), name: "A goatherd", note: "E", talk: "goatherd", wander: true },
    { id: "goat", x: 21, y: 15, sprite: { kind: "creature", seed: "goat", variant: "beast", a: "bone", b: "ash" }, name: "The goat", held: true, talk: "goat", wander: true },
  ],
  triggers: [
    { id: "fields_first", x: 3, y: 9, w: 2, h: 3, on: "enter", once: true },
    { id: "fields_bridge", x: 27, y: 8, w: 1, h: 4, on: "enter", once: true },
    { id: "fields_well", x: 7, y: 17, on: "interact" },
    { id: "fields_stile", x: 10, y: 3, on: "interact" },
  ],
  exits: [
    { x: 0, y: 10, to: "hem", tx: 26, ty: 22, facing: "left" },
    { x: 35, y: 18, to: "lint_hollow", tx: 1, ty: 8, facing: "right", needs: "c1_firstfight" },
  ],
  wander: [
    { groups: ["c1_mice", "c1_mite", "c1_hummer"], count: 3, x: 6, y: 2, w: 18, h: 15, sprite: { kind: "creature", seed: "cordmouse", a: "clay", b: "bone" } },
    { groups: ["c1_hummer", "c1_lint", "c1_mix"], count: 2, x: 28, y: 1, w: 7, h: 5, sprite: { kind: "creature", seed: "hummer", a: "teal", b: "gold" } },
  ],
  chests: [
    { id: "f_chest1", x: 23, y: 3, item: "flatbread", count: 2 },
    { id: "f_chest2", x: 32, y: 14, item: "firepot", count: 2, slugs: 30 },
    { id: "f_chest3", x: 2, y: 16, item: "g_hemp", count: 1 },
  ],
};

const hollow: MapDef = {
  id: "lint_hollow",
  name: "The Lint Hollow",
  theme: "night",
  music: "dungeon",
  musicSeed: "hollow",
  caption: "A dell the line fell into",
  rows: [
    "^^^^^^^^^^^^^^^^^^^^",
    "^..................^",
    "^..r..........r....^",
    "^.......,,,,.......^",
    "^......,,,,,,......^",
    "^.....,,,,,,,,.....^",
    "^.....,,,,C,,,.....^",
    "^.....,,,,,,,,.....^",
    "........,,,,.......^",
    "^..................^",
    "^...b.........b....^",
    "^.......V..........^",
    "^..................^",
    "^^^^^^^^^^^^^^^^^^^^",
  ],
  line: [[0, 8], [4, 8], [7, 7], [10, 6]],
  npcs: [
    { id: "lint", x: 10, y: 5, sprite: { kind: "creature", seed: "the_lint", variant: "tall", a: "ash", b: "frost" }, name: "The Lint", held: false, talk: "lint", hideIf: "c1_lint" },
  ],
  triggers: [
    { id: "hollow_enter", x: 1, y: 7, w: 2, h: 3, on: "enter", once: true },
    { id: "hollow_coil", x: 10, y: 6, on: "interact", showIf: "c1_lint" },
    { id: "hollow_rock", x: 14, y: 2, on: "interact", showIf: "c1_lint" },
  ],
  exits: [{ x: 0, y: 8, to: "hem_fields", tx: 34, ty: 18, facing: "left" }],
};

// ---------------------------------------------------------------------------

async function tuneChoir(ctx: ScriptContext): Promise<void> {
  const notes = ["C", "E", "G", "B"] as const;
  const names = ["Hob", "Mell", "Tansy", "Dace"];
  let right = 0;
  for (let round = 0; round < 2; round++) {
    const sour = round === 0 ? 1 : 3;
    await ctx.say(round === 0 ? "Four singers. Four lines. Fathom plucks each one and listens for the sour one. A sour line shakes longer after the pluck, too." : "Again. Somebody drifted while the Levelers were walking past.", { speaker: "Tuning" });
    const ids = ["singer1", "singer2", "singer3", "singer4"];
    for (let i = 0; i < 4; i++) {
      ctx.sfx(i === sour ? `sour:${notes[i]}` : `note:${notes[i]}`);
      ctx.pluck(ids[i], i === sour ? 1.3 : 0.5);
      ctx.toast(`${names[i]}: ${notes[i]}`);
      await ctx.wait(0.7);
    }
    const pick = await ctx.choose(names.map((n, i) => `${n} (${notes[i]})`), { title: "Who is out of tune?" });
    if (pick === sour) {
      right++;
      await ctx.speak("wren", pick === 1 ? "Mell. She leans when she gossips, and she gossips when she breathes." : "Dace. He heard it too. Look at his ears.");
    } else {
      await ctx.say(`${names[pick]} is fine. It was ${names[sour]}. Fathom fixes it anyway: a word, a shift of weight, a slug in the left pocket.`);
    }
  }
  ctx.flag("c1_tuned_well", right);
  await ctx.say("The choir holds one clean chord. Two hundred lines in Hem ring with it, up through the slats, up into the dark. Fathom has never asked who is listening.");
}

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  home_shelf: async (ctx) => { await ctx.say("Tuning weights in a row, a dozen of them. Pocket slugs for singers who lean. A roll of slat tape. A jar with one tooth in it that Fathom found in the fields at nine and never told anyone about."); },
  home_bed: async (ctx) => {
    if (ctx.has("slack")) { await ctx.say("The bed. The line used to go up through the gap in the slats above it. Now a draft comes down through it, and Fathom pulls the blanket up for the first time in twenty years."); return; }
    await ctx.say("Fathom's bed. One gap in the slats above it, the width of a line. Fathom has slept under that gap for twenty years and dreamed, every night, of being pulled up through it.");
  },
  home_table: async (ctx) => { await ctx.say("A note in Fathom's hand: 'Lift day. Choir at the bell before the Levelers. Do not let Mell lean. Do not let Mell talk to Dace. Do not let Dace.'"); },
  home_sign: async (ctx) => { await ctx.say("A rule painted on the wall by Fathom's mother, fourteen years ago: 'A tight line is a loved line.' Under it, smaller, in a child's letters: WHO BY."); },
  home_floor: async (ctx) => { await ctx.say("A loose board. Fathom has walked over it for twenty years without a thought for what was under it, because the held do not think about under. Under it: nothing. A dead beetle. Fathom puts the board back."); },

  hem_square: async (ctx) => {
    ctx.beat(0);
    await ctx.speak("wren", "There you are. The Levelers are at the Office already and the choir is not tuned and Hob says he is in tune. Hob is never in tune.");
    await ctx.say("Fathom walks to the choir. Four singers, four lines, four notes. Tuning them is Fathom's whole job. Once a year the Office pays for it.");
    // Walk to the tile under the choir from wherever Fathom entered the square, without crossing a singer or the bell
    const steps: Parameters<typeof ctx.walk>[1] = [];
    const tx = 14, ty = 11;
    const horizontal = () => { for (let x = ctx.g.x; x !== tx; x += Math.sign(tx - x)) steps.push(tx > x ? "right" : "left"); };
    const vertical = () => { for (let y = ctx.g.y; y !== ty; y += Math.sign(ty - y)) steps.push(ty > y ? "down" : "up"); };
    if ([13, 15, 17, 19].includes(ctx.g.x) && ctx.g.y < 10) { horizontal(); vertical(); } else { vertical(); horizontal(); }
    await ctx.walk("player", steps);
    await tuneChoir(ctx);
    ctx.flag("c1_tuned");
    ctx.beat(1);
    await ctx.speak("wren", "Good. Now stand somewhere and look worth it. The Measurer is going round with the plumb line. Somebody rises today, and Ansel says the sky is hungry this year. He means generous. He always says hungry and then corrects himself.");
    await ctx.say("The square fills. The bell will begin it. Fathom can talk to people first, or ring.");
  },

  singer: async (ctx) => {
    if (ctx.has("c1_tuned")) await ctx.say("The singer hums the note Fathom gave them and keeps their shoulders still. A tuned singer is a still singer. A still singer is a loud line.");
    else await ctx.say("The singer rocks on their heels, warming up. Their line sways. Fathom's teeth hurt.");
  },
  mell: async (ctx) => {
    if (ctx.has("c1_tuned")) { await ctx.speak("singer2", "I was NOT leaning. Dace was looking at me, I was looking back, that is not leaning. Fathom, if I am the one today, you can have my weights. All of them. The good ones."); return; }
    await ctx.speak("singer2", "Dace says the Office picks the loudest line. I say it picks the prettiest. Either way it is me. Hold still, you are making my E wobble.");
  },

  hem_bell: async (ctx) => {
    if (ctx.has("c1_lift")) { await ctx.say("The bell. Fathom rang it every Lift day for six years. Today it called something up through the paving."); return; }
    if (!ctx.has("c1_tuned")) { await ctx.say("The bell waits for a tuned choir. The Office is particular."); return; }
    const i = await ctx.choose(["Ring it", "Not yet"], { title: "Begin the Lift?" });
    if (i !== 0) return;
    await theLift(ctx);
  },

  hem_sign: async (ctx) => { await ctx.say("HEM. Population 212, held. Roof slats to be kept open by order of the Plumb Office. No dancing. No closed ovens. Hum."); },
  hem_well: async (ctx) => {
    if (!ctx.has("slack")) { await ctx.say("The well. A grate is bolted over it, and the bolts are Office bolts. The held do not go under. The well has never been drunk from. Water comes from the stream."); return; }
    await hooking(ctx, "hem_well", { intro: "The well. Somebody has pried the grate up at one corner. Fathom could have done that any day of twenty years, and did not, and does now. Cold comes up. Something, far down, is moving water." });
  },
  hem_office: async (ctx) => {
    if (ctx.has("slack")) { await ctx.say("The Plumb Office. Barred from inside. Ansel, on the step, does not look up from his book: 'Not for the loose. Go round the back like the rest of the scrap.' He means it as an insult. Fathom goes round the back."); ctx.flag("c1_cellar_open"); return; }
    await ctx.say("The Plumb Office. The Levelers measure the children here once a year with a weight on a string, and write a number down, and do not say what for.");
  },
  hem_office_back: async (ctx) => {
    if (!ctx.has("c1_cellar_open")) { await ctx.say("Behind the Office. A hatch in the ground, low, under the eave. A held person could not get under the eave to reach it."); return; }
    await ctx.say("Under the eave, a hatch. Fathom lies flat, which the held do not do, and goes under, which the held do not do, and lifts it.");
  },
  cellar_in: async (ctx) => {
    await ctx.say("A cellar under the Plumb Office. Hem does not have cellars. Hem does not have under. Shelves. A table. A cable as thick as an arm comes down through the ceiling and goes on down through the floor, humming the note the choir hums.");
  },
  cellar_shelf: async (ctx) => { await ctx.say("Ledgers. One per year, nine hundred of them. Each page has a name, a drawing of a line going up, and a drawing of what came up the crack with the name. Teeth, mostly. Sometimes a mouth without teeth."); },
  cellar_shelf2: async (ctx) => {
    await ctx.say("The newest ledger. This year's page is already written. MELL, it says, in Ansel's hand, and beside it, in the same hand, drawn slowly, the way you copy something you do not understand: a jaw.");
    if (ctx.has("c1_lift")) await ctx.say("It was written before the bell rang.");
    else await ctx.say("Fathom has not rung the bell yet.");
    ctx.flag("c1_ledger");
  },
  cellar_table: async (ctx) => { await ctx.say("A plumb line on the table, the one the Measurer uses on the children. It is not a measuring tool. It is a lure. Tolly makes them. Fathom knows the knot."); },
  cellar_cable: async (ctx) => {
    await ctx.say("Knots run down the cable, old and black near the floor, new and pale just under the ceiling. Fathom cannot read them. The newest one has the same shape as the jaw in the ledger.");
    await ctx.say("Below, the cable goes on through the floor into cold. Pressed against it, Fathom can hear two hundred and twelve notes, and under them something slow that is not a note. Breathing, or water.");
  },

  hem_shop_door: async (ctx) => {
    await ctx.speak("pim", ctx.has("slack") ? "Fathom. I will sell to you. Through the door. Quick. Nobody has to see me do it." : "Open grill, flat bread, lead slugs. Soles for the roofers. What do you need?");
    await ctx.shop(["flatbread", "slugpouch", "salve", "firepot", "w_sinker", "g_hemp", "s_grip", "l_brass"], "Pim's grill");
  },
  hem_ostle_door: async (ctx) => { await ctx.say("Ostle's door. Knotted cords hang in it, the old kind, and click in the wind. Children are told the cords are for luck. They are for reading."); },
  hem_house1: async (ctx) => { await ctx.say("Somebody inside is singing, badly, with feeling. Their line twitches at the high notes like a fishing line does when something is interested."); },
  hem_house2: async (ctx) => { await ctx.say("The roofer's house. Slats a hand apart, exactly. He measures them twice a week and has never asked who told his grandfather a hand."); },
  hem_house3: async (ctx) => { await ctx.say("A sign on the door: BACK AFTER THE LIFT. IF IT IS ME, THE GOAT IS NIB'S. Under it, newer: IF IT IS THE GOAT, I AM KEEPING THE HOUSE."); },
  hem_bushes: async (ctx) => {
    if (ctx.has("c1_bush")) { await ctx.say("The bushes. Nothing else in them."); return; }
    ctx.flag("c1_bush");
    await ctx.say("In the bushes, pushed in deep: a frame. A child's size. Office white. Somebody in Hem was meant to wear it and would not.");
    await ctx.give("g_frame");
  },

  wren: async (ctx) => {
    if (ctx.has("c1_read")) { await ctx.speak("wren", "Ostle told me what the knots say. A tally. Fathom, somebody up there has a BOOK on you. On all of us. I have not slept. Take the bell. Ring it when you find the book, and tear the page out."); if (!ctx.has("c1_bell")) { ctx.flag("c1_bell"); await ctx.give("k_bell"); } return; }
    if (ctx.has("c1_lint")) { await ctx.speak("wren", "You came back. Ansel said you would go under a hedge and not come out. I said you have never once left a choir half tuned, and he said that was the problem."); return; }
    if (ctx.has("c1_burl")) { await ctx.speak("wren", "I cannot stand near you. I want to. Ansel says loose is catching, like a cough. He is wrong. I am still standing here. Look how far away I am standing."); return; }
    if (ctx.has("slack")) { await ctx.speak("wren", "Mell went up. Fathom, she went up in the middle of her E, I heard it stop. And then yours came down. Both in one bell. That does not happen."); return; }
    if (ctx.has("c1_tuned")) { await ctx.speak("wren", "Stand straight. The Office watches for leaners on Lift day. A leaning line is a sour line and the sky does not want sour."); return; }
    await ctx.speak("wren", "Tune the choir. Then we can talk about who rises. I have money on Mell. Everybody has money on Mell.");
  },
  ansel: async (ctx) => {
    if (ctx.has("c1_lint")) { await ctx.speak("ansel", "You went where no held thing can follow, and walked out again. The Office has no column for that. Be gone from Hem by morning, before I am asked to make one."); return; }
    if (ctx.has("slack")) { await ctx.speak("ansel", "Cut. On my Lift day. In my square. Do you know what the Office calls a cut line? Spent. Get your spent line out of my square."); return; }
    await ctx.speak("ansel", "Leveler Ansel. Stand true, tuner. Today the sky reaches down and takes the best of us. A good hum is a good life. Be worth hearing.");
  },
  ostle: async (ctx) => {
    if (ctx.has("c1_read")) { await ctx.speak("ostle", "Go on, then. East. Find out what it means to run. And child: whatever is up there ties my grandmother's knots, the old kind she taught me. I would like to know who taught it."); return; }
    if (ctx.has("c1_lint")) {
      ctx.beat(6);
      await ctx.speak("ostle", "You found knots. Show me. Sit, nobody is looking, nobody looks at an old woman's hands.");
      await ctx.knot("m1", "HEM 212. TUNER. NO BITE IN 20 YEARS.", "Ostle");
      await ctx.speak("ostle", "A tally. Two hundred and twelve. That is Hem. Then you: tuner, no bite in twenty years. It is a file, Fathom. Somebody up there keeps a file on you and this is the top of the page.");
      await ctx.say("Ostle's fingers go on along the line. They stop.");
      await ctx.knot("m1b", "CUT IT. SEE IF IT RUNS.", "Ostle");
      await ctx.say("Nobody says anything. Across the square a goat complains.");
      await ctx.speak("ostle", "Cut it. See if it runs. Well. You ran east, to the Hollow, and back. Whatever is up there knows that by now, I should think. Whatever is up there is taking notes.");
      ctx.flag("c1_read");
      await ctx.speak("ostle", "Here. Six fathoms, cut from the part by your back. It is your line. Tie things with it. You know the knots already, tuner, every choir weight hangs on one. You do not know what they are for. Then you will leave before Ansel wakes, because I like you.");
      await ctx.give("k_message");
      await ctx.say("Ostle ties a Bowline and a Monkey's Fist in the cut line and shows Fathom what they do when nobody is holding the other end. A knot costs its length while it is tied. Untie it and the length comes back.");
      await ctx.speak("ostle", "The line goes east. The file says run. I do not think you should do what the file says. I also do not think you should stay.");
      return;
    }
    if (ctx.has("c1_burl")) { await ctx.speak("ostle", "Follow the line into the fields. Where it stops being plain, where it has knots in it, bring me the knots. Knots are words. They always were."); return; }
    if (ctx.has("slack")) {
      ctx.beat(2);
      await ctx.speak("ostle", "Stop shaking. Listen. Your line fell. It is lying in a heap from here to the east road and past it, I walked along a piece of it.");
      await ctx.speak("ostle", "There are knots in it. Not snags. Knots. Somebody tied them, and nobody ties knots a hundred miles up unless they are saying something.");
      await ctx.speak("ostle", "Follow it. Bring me what is tied in it. And take the knot by the south fence, the one that keeps rolling after you. It likes you. Things that like you are rare today.");
      ctx.flag("c1_ostle");
      return;
    }
    await ctx.speak("ostle", "I read knots, when there were knots to read. Now I count slugs for Pim. Stand up straight. You lean like your mother did, and look where that got her.");
  },
  pim: async (ctx) => { await ctx.speak("pim", ctx.has("slack") ? "Grill is hot. Bread is flat. I have coals in pots, if you are going east. The gray heaps in the hollow do not like coals. Do not ask me how I know." : "Grill is hot. Bread is flat. Slugs are lead. I sell lures now too, Tolly makes them, hang one on your line and it sings. The Office buys three a year."); },
  kid: async (ctx) => {
    if (ctx.has("slack")) { await ctx.speak("kid", "Can you go under things? Under the BRIDGE? Under a table? What is under a table? Nib. That is me. Show me how to go under something and I will give you a tooth I found."); ctx.taught("hem"); return; }
    await ctx.speak("kid", "Mam says if I lean I will get tangled with the goat. I leaned once. Nothing happened. The goat is fine. The goat leans all the time.");
  },
  roofer: async (ctx) => { await ctx.speak("roofer", "Slats a hand apart, every roof in Hem. Too close and a line rubs. Too far and the rain gets in. Rain is the Hull dripping, my gran said, and I said what is a hull, and she said eat your bread."); },
  measurer: async (ctx) => { await ctx.speak("measurer", "Stand still. The weight hangs. The line is true. Twenty years, tuner, and not one bite. Twenty springs I have written that down. This spring I was told to write it in red."); },
  lurewright: async (ctx) => {
    if (ctx.has("slack")) { await ctx.speak("lurewright", "A cut line. You know what I make, Fathom? I make the thing on the end of a line that makes a fish want it. Plumb lines, choir bells, the weights in your pocket. I have made them for thirty years and today I found out what they are for."); return; }
    await ctx.speak("lurewright", "Tolly. Lures. The Office orders a plumb line every spring and a bell every Lift, and they pay in slugs that fall out of the sky. Lead, every one, with a hole through the middle for a line. Somebody up there is careless with sinkers.");
  },
  catcher: async (ctx) => { await ctx.speak("catcher", "A knot has been rolling round the square since your line came down. Twelve slugs and I bag it. Fifteen and I bag it where you cannot hear."); },
  novice: async (ctx) => { await ctx.speak("novice", "Stay in the square today. If you are the one, you want to be seen going up. People remember who went up. They do not remember who went where."); },
  mourner: async (ctx) => { await ctx.speak("mourner", "My sister was Chosen the year the stream froze. I was glad. I was told to be glad. I have been glad for forty years and this morning I watched Mell go up in the middle of a note and I was not glad, Fathom, I was something else."); },
  dripkid: async (ctx) => { await ctx.speak("dripkid", "I am counting drips. Four hundred and nine since the bell. Mam says it is rain. Rain does not come from one place. I have been watching the place."); },

  burl_talk: async (ctx) => {
    ctx.beat(2);
    await ctx.say("A knot the size of a dog, made of old gray line, standing on its loose ends. Three hooks are tangled in it, rusted, points out. It has two dark places that are probably eyes. They are pointed at Fathom.");
    await ctx.speak("burl", "Tug.");
    await ctx.say("It says it with a pull, the way a line would. Then it says a second thing.");
    await ctx.speak("burl", "Cut. Good. Cut is good. Everything else here is tied to something. Not you. Me, a little. Three hooks, one knot. Come.");
    const i = await ctx.choose(["Come where?", "Go away."]);
    if (i === 1) await ctx.speak("burl", "No.");
    else await ctx.speak("burl", "Where the line goes. Knots do not come loose. I will not come loose from you.");
    await ctx.join("burl");
    ctx.flag("c1_burl");
    ctx.beat(3);
    await ctx.speak("burl", "Three hooks. One still set.");
    await ctx.say("A line runs up out of the middle of Burl from the hook that is still set. It is taut. Burl gains tension when hit and spends it on skills. Fathom has no tension now, only the fallen line, and knots.");
    await ctx.say("A line under tension hums. The Bite meter under the strip rises with every humming line on the field. When it fills, something below bites the loudest one. Keep quiet, or make the enemy loud.");
  },

  fields_first: async (ctx) => {
    await ctx.say("The fallen line lies along the ground in a long loose curve, through a hedge, over a stile, on toward the stream. Fathom follows it. It is strange to walk beside the thing that held you.");
    await ctx.speak("burl", "Mice. On the line. Chewing it.");
    const r = await ctx.battle("c1_mice", { canFlee: false, loseAllowed: true });
    if (r !== "win") await ctx.say("The mice lose interest. Fathom gets up.");
    ctx.flag("c1_firstfight");
    await ctx.say("Held creatures have lines too, and tension. A foe at high tension hits harder, and its line hums louder, and the Bite listens for the loud.");
  },
  fields_bridge: async (ctx) => {
    await ctx.say("The line runs under the bridge. Burl stops at the water. A held thing cannot go under a bridge. Fathom can. Fathom does, and the underside of the bridge is damp and close and smells of the stream, and nobody in Hem has ever seen it.");
    await ctx.speak("burl", "Show-off.");
    ctx.taught("fields");
  },
  fields_well: async (ctx) => { await hooking(ctx, "fields_well", { intro: "An old well in the field, grate rusted through. Fathom has a weighted knot and nothing holding Fathom back from leaning over." }); },
  fields_stile: async (ctx) => { await ctx.say("The stile. Somebody has carved into it, long ago: THE GOAT KNOWS. Under that, in a different hand: THE GOAT KNOWS WHAT."); },
  goatherd: async (ctx) => {
    if (ctx.errandDone("goat")) { await ctx.speak("goatherd", "She is calmer now. She still looks up. I have started looking up too, and I do not like what I am looking at."); return; }
    await ctx.speak("goatherd", "The goat has been pulling at her line all morning. Hard. Up. Like something has hold of the other end and is thinking about it. You are the tuner. Tune her.");
    const i = await ctx.choose(["Pluck the goat", "Not my job"], { cancel: true });
    if (i !== 0) return;
    await ctx.say("Fathom plucks the goat. The goat's line gives a note that no goat should give, low and long, and far up in the dark something answers it.");
    ctx.sfx("sour:A");
    await ctx.wait(0.8);
    await ctx.say("Fathom puts a slug in the goat's collar. The note drops a tone. The goat sits down. Whatever was interested is not, now.");
    ctx.errand("goat");
    await ctx.speak("goatherd", "Well. Take this. It fell by the hedge last week and I did not know what it was and now I think I do.");
    await ctx.give("w_bob");
  },
  goat: async (ctx) => { await ctx.say("The goat looks up its own line, all the way up, with the attention of something that has heard a sound you have not."); },

  hollow_enter: async (ctx) => {
    ctx.beat(4);
    await ctx.say("A dell under cliffs. The line spirals in to the middle and piles into a coil, and on the coil sits a gray heap the size of a cart, with eyes, chewing.");
    await ctx.speak("burl", "Scale. Scrap. It rode the line down. It is eating the knots.");
  },
  lint: async (ctx) => {
    ctx.beat(5);
    await ctx.say("The Lint is scale and offal and nine hundred years of whatever gets scraped off a catch, packed around Fathom's line like a bead. It smells of the stream and of something that was never in the stream. Under it, dozens of knots. Some are gone.");
    await ctx.speak("burl", "No line. No tension. Blades slide off it. Heat if you have it. A Fist bleeds through anything.");
    const r = await ctx.battle("c1_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c1_lint");
    ctx.refresh();
    await ctx.say("The Lint comes apart into drifts. Under it the line is bare, and knotted: a long row, each one different, each one tied tight and even, the way no hand in Hem ties.");
    await ctx.say("Fathom cannot read them. Ostle can. Fathom coils the knotted length and turns back toward Hem.");
    await ctx.speak("burl", "Slower now. Carrying.");
  },
  hollow_coil: async (ctx) => { await ctx.say("The coil where the Lint sat. The line goes on east from here, over the cliff and out of sight, as far as the eye can follow. Further."); },
  hollow_rock: async (ctx) => {
    if (ctx.has("c1_hair")) { await ctx.say("The rock. Nothing else behind it."); return; }
    ctx.flag("c1_hair");
    await ctx.say("Behind the rock, where the Lint shed as it chewed: a lock of gray hair, tied in a knot. A neat knot, the kind a woman ties in her own hair. It went up on somebody's head and came down with the scrap.");
    await ctx.say("Fathom thinks of Old Fen, who has been glad for forty years.");
    await ctx.give("k_frost");
  },

  hem_dawn: async (ctx) => {
    if (!ctx.has("c1_bell")) { await ctx.say("Wren is still in the square. Fathom should say goodbye. Fathom is not good at that and should do it anyway."); return; }
    ctx.beat(7);
    if (ctx.has("c1_hair") && !ctx.errandDone("fen")) {
      await ctx.say("Old Fen is still in the square. Fathom gives her the knot of gray hair. She holds it for a long time and does not ask where it came from, and then she says: 'That is her knot. She tied her hair like that. She is up there and she is tying knots.'");
      ctx.take("k_frost");
      ctx.errand("fen");
      await ctx.giveSlugs(30);
    }
    await ctx.fadeOut();
    await ctx.card("Dawn", "Fathom leaves Hem", { beat: "Change" });
    await ctx.say("Before the Office wakes, Fathom walks out of Hem along a line that was Fathom's for twenty years. Burl rolls beside. Nobody sees them go. Wren does, from a window, and does not wave, because waving tangles.");
    await ctx.say("Somewhere above the cloud, something notes the time.");
    ctx.flag("c1_done");
    ctx.rest();
    await ctx.nextChapter();
  },
  scrap_talk: scrapTalk,
};

async function theLift(ctx: ScriptContext): Promise<void> {
  ctx.sfx("bell");
  await ctx.fx("bell", 11, 9);
  await ctx.say("Fathom rings the bell. The choir holds its chord. Every line in the square goes still. Two hundred people look up, into the dark, the way they do every year.");
  await ctx.speak("ansel", "Sky above and lines between. Hear us. Take the best of us. We hum for you.");
  await ctx.wait(0.8);
  await ctx.say("The ground in the square moves. Not a shake. A twitch, under the paving, like something turning over.");
  await ctx.shake();
  await ctx.fx("crack", 15, 10);
  await ctx.say("The paving under Mell splits. Something dark and wet comes up through the crack, wider than she is, and closes.");
  await ctx.say("Mell's line goes tight mid-note. Her E stops, and she goes up through the cloud with the dark thing on her, so fast there is a sound, a short one, like a cork.");
  ctx.sfx("snap");
  ctx.flag("c1_lift");
  await ctx.say("Two hundred people breathe out. Nobody looks at the crack. On Lift day nobody looks down. The Office has its one, and Ansel is already writing.");
  await ctx.wait(0.6);
  await ctx.say("Then a second sound, from very high up. A hum, long, coming closer.");
  ctx.music("sad", "fall");
  await ctx.say("Fathom's line goes slack.");
  await ctx.say("It falls. All of it. Above the cloud every line in Hem turns east and runs along the underside of the sky to wherever it is wound, and Fathom's comes down along the whole of that road. A hundred miles of line, in loops, across the square, across the roofs, into the well, over the east road and out of sight. It falls for the rest of the day.");
  await ctx.flash();
  ctx.flag("slack");
  ctx.refresh();
  await ctx.say("Fathom stands in a heap of line. Nothing is on the other end of it. Fathom has never, in twenty years, not been held, and the first thing Fathom feels is not fear. It is quiet. The hum has stopped.");
  await ctx.speak("ansel", "Cut. CUT. Stand back from the loose one. Choir, home. Nobody touch the line, it is spent, it is Office property, nobody TOUCH it.");
  await ctx.speak("wren", "Fathom...");
  await ctx.say("Wren steps forward and the whole square flinches. Wren stops. Nobody in Hem has ever seen a cut person. Everyone knows what you do with one. You stand away from it, and then it goes away.");
  await ctx.say("The square empties. The choir leaves with a gap in it. Ansel takes his book to the Office step and stands on it. At the far end of the square, something small and round rolls out from behind the well and stops, and looks.");
  await ctx.speak("ostle", "Fathom. Here. Now, before you think about it.");
  ctx.setGoal("Talk to Grandmother Ostle, by her house at the south end of the square.");
}

export const ch1: Chapter = {
  n: 1,
  title: "Hem",
  subtitle: "Ordinary world, and the call",
  maps: [home, hem, cellar, fields, hollow],
  scripts,
  beats: ["Fathom tunes the choir for the Lift", "Mell goes up. Fathom's line comes down.", "Ostle says follow it. A knot says come.", "The fields, the first fights, the first knots", "The Lint on the coil, eating the words", "Fight the Lint for the line", "Ostle reads: a tally, and CUT IT. SEE IF IT RUNS.", "Fathom leaves Hem at dawn"],
  goal: (g) => {
    const f = g.flags;
    if (f.c1_done) return "East, along the line.";
    if (f.c1_read) return "Say goodbye to Wren, then leave by the east road at dawn.";
    if (f.c1_lint) return "Take the knotted line back to Grandmother Ostle in Hem.";
    if (f.c1_firstfight) return "Follow the fallen line east through the fields to where it ends.";
    if (f.c1_burl) return "Follow the fallen line east out of Hem.";
    if (f.c1_ostle) return "The knot by the south fence keeps rolling after you. Talk to it.";
    if (f.slack) return "Talk to Grandmother Ostle at the south end of the square.";
    if (f.c1_tuned) return "Ring the bell at the center of the square to begin the Lift.";
    return "Go out to the square and tune the choir.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 1", "Hem", { beat: "You" });
    await ctx.teleport("hem_home", 5, 4, "down");
    await ctx.say("Hem is a village of two hundred and twelve people and two hundred and twelve lines, which rise from the hook in each back, straight up, through the slats of every roof, into the dark, and are held.");
    await ctx.say("Fathom is a tuner. Today is the Lift. Fathom should get up.");
  },
  debugStart: { map: "hem", x: 7, y: 4, level: 1 },
};
