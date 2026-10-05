import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, SCRAP_NPC, scrapTalk, hooking, bounty } from "./common";

const shaft: MapDef = {
  id: "shaft",
  name: "The shaft under the Anchor",
  theme: "under",
  music: "under",
  musicSeed: "shaft",
  caption: "The shaft. Open to the sky, all the way down.",
  rows: [
    "uuuuu....uuuuu",
    "uuuuu....uuuuu",
    "uuuu......uuuu",
    "uuuu.S....uuuu",
    "uuuu......uuuu",
    "uuu....S...uuu",
    "uuu........uuu",
    "uuu.S......uuu",
    "uuu........uuu",
    "uu......S...uu",
    "uu..........uu",
    "uu.S........uu",
    "uu..........uu",
    "uu.......S..uu",
    "uu..........uu",
    "uu...S......uu",
    "uu..........uu",
    "uu........S.uu",
    "uu..........uu",
    "uu..........uu",
    "uuuuuu..uuuuuu",
  ],
  line: [[6, 0], [6, 5], [7, 10], [6, 15], [7, 20]],
  npcs: [],
  triggers: [{ id: "shaft_in", x: 4, y: 0, w: 4, h: 2, on: "enter", once: true }, { id: "shaft_ledge", x: 3, y: 11, on: "interact" }],
  exits: [
    { x: 6, y: 0, w: 2, to: "anchor", tx: 8, ty: 11, facing: "up" },
    { x: 6, y: 20, w: 2, to: "under", tx: 2, ty: 3, facing: "down" },
  ],
  wander: [{ groups: ["c6_lobes", "c6_drip"], count: 2, x: 3, y: 6, w: 8, h: 12, sprite: { kind: "creature", seed: "dripper", variant: "tall", a: "frost", b: "sea" } }],
};

const under: MapDef = {
  id: "under",
  name: "The shelves",
  theme: "under",
  music: "under",
  musicSeed: "under",
  caption: "The shelves. Where the water starts.",
  dark: true,
  rows: [
    "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
    "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
    "uu....uuuuuu_____uuuuuuuuuuu......uu",
    "uu.......uuu_uuu_uuu.........p....uu",
    "uu..r....uuu_uuu_uuu....p..p......uu",
    "uuuuu....uuu_____uuu..............uu",
    "uuuuuu......_uuuuuuu......uuuu....uu",
    "uuuuuuu...........p.......uuuu....uu",
    "uuuu_______.......p........uu.....uu",
    "uuuu_uuuuu_.......pp.......uu.....uu",
    "uuuu_uuuuu_......ppp..............uu",
    "uuuu_______...............r.......uu",
    "uuuuuu........................uuuuuu",
    "uuuuuu....uuuuuu.........uuuuuuuuuuu",
    "uuuuuu....uuuuuu.........uuuuuuuuuuu",
    "uuuuuu.........uuu......._____uuuuuu",
    "uuuuuuu........uuu.......uuu__uuuuuu",
    "uuuuuuuu.......uuuu......uuu______uu",
    "uuuuuuuuu...........V......uuuuuu_uu",
    "uuuuuuuuuu.................uuuuuu_uu",
    "uuuuuuuuuuuuuuu.......uuuuuuuuuuu_uu",
    "uuuuuuuuuuuuuuu.......uuuuuuuuuuuuuu",
    "uuuuuuuuuuuuuuuuu...uuuuuuuuuuuuuuuu",
    "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
  ],
  line: [[2, 3], [6, 4], [10, 7], [14, 8], [18, 11], [20, 14], [19, 18], [18, 21]],
  npcs: [
    { id: "sump_npc", x: 25, y: 10, sprite: { kind: "creature", seed: "sump", variant: "beast", a: "plum", b: "mint" }, name: "A lobe", held: false, talk: "sump_talk", hideIf: "c6_sump" },
    { id: "cutscout", x: 30, y: 4, sprite: P("cut_scout", "coal", "blood", "slack"), name: "A Cut scout", held: false, talk: "cutscout", wander: true },
    { id: "underfolk1", x: 12, y: 18, sprite: P("underfolk1", "clay", "mint", "slack"), name: "An Underfolk", held: false, talk: "underfolk", wander: true },
    { id: "underfolk2", x: 23, y: 7, sprite: P("underfolk2", "sand", "sea", "slack"), name: "A shelf-baker", held: false, talk: "baker" },
    { id: "lobechild", x: 30, y: 8, sprite: { kind: "creature", seed: "lobechild", a: "plum", b: "sand" }, name: "A small lobe", held: false, talk: "lobechild", wander: true },
    SCRAP_NPC(22, 18),
  ],
  triggers: [
    { id: "under_in", x: 2, y: 2, w: 3, h: 3, on: "enter", once: true },
    { id: "under_side1", x: 14, y: 2, on: "enter", once: true },
    { id: "under_side2", x: 4, y: 9, on: "enter", once: true },
    { id: "under_camp", x: 22, y: 12, w: 3, h: 2, on: "enter", once: true },
    { id: "under_side3", x: 33, y: 19, on: "enter", once: true },
    { id: "under_pool", x: 18, y: 9, on: "interact" },
    { id: "under_post", x: 26, y: 3, on: "interact" },
  ],
  exits: [
    { x: 2, y: 2, to: "shaft", tx: 6, ty: 19, facing: "up" },
    { x: 17, y: 22, w: 3, to: "nursery", tx: 7, ty: 2, facing: "down" },
  ],
  wander: [
    { groups: ["c6_lobes", "c6_pike", "c6_scouts", "c6_mix"], count: 4, x: 8, y: 6, w: 24, h: 14, sprite: { kind: "creature", seed: "blindpike", a: "sea", b: "frost" } },
  ],
  chests: [
    { id: "u_chest1", x: 15, y: 2, item: "s_cave", count: 1 },
    { id: "u_chest2", x: 7, y: 11, item: "coldash", count: 2, slugs: 60 },
    { id: "u_chest3", x: 33, y: 17, item: "leaddrop", count: 1 },
    { id: "u_chest4", x: 33, y: 3, item: "firepot", count: 2 },
  ],
};

const nursery: MapDef = {
  id: "nursery",
  name: "The lobe nursery",
  theme: "under",
  music: "under",
  musicSeed: "nursery",
  caption: "The nursery. The line fell into the pool.",
  dark: true,
  rows: [
    "uuuuuuuuuuuuuuuu",
    "uuuuuu...uuuuuuu",
    "uuuu.........uuu",
    "uuu...........uu",
    "uu....pppp.....u",
    "uu...pppppp....u",
    "uu...pppppp....u",
    "uu....pppp.....u",
    "uuu...........uu",
    "uuuu.........uuu",
    "uuuuu..V....uuuu",
    "uuuuuuuuuuuuuuuu",
  ],
  line: [[7, 1], [7, 3], [8, 5]],
  npcs: [{ id: "neverheld", x: 8, y: 5, sprite: { kind: "creature", seed: "never_held", variant: "tall", a: "plum", b: "mint" }, name: "Something in the pool", held: false, talk: "neverheld", hideIf: "c6_boss" }],
  triggers: [
    { id: "nursery_in", x: 6, y: 1, w: 3, h: 2, on: "enter", once: true },
    { id: "nursery_pool", x: 7, y: 5, on: "interact", showIf: "c6_boss", hideIf: "c6_read" },
    { id: "nursery_out", x: 7, y: 9, w: 3, h: 1, on: "enter", showIf: "c6_read", hideIf: "c6_done" },
  ],
  exits: [{ x: 7, y: 1, to: "under", tx: 18, ty: 21, facing: "up" }],
};

// ---------------------------------------------------------------------------

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  shaft_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("The shaft under the Anchor goes straight down and, above, straight up: the one hole on the Drop with sky at the top. The held can go down it. Their lines run up through the opening and the sky lets out length as they descend, the way it would on a cliff. It is letting them down to the water. It does that for anything that hums.");
    await ctx.speak("burl", "Down. Knots roll down well. Watch.");
    await ctx.speak("gust", "I do not like it. The air here does not move unless I move it. It is like being in a mouth, and the mouth is wet.");
  },
  shaft_ledge: async (ctx) => { await ctx.say("A ledge halfway down. Somebody has sat here. A circle worn in the stone, a pile of fish bones, and scratched into the wall, in knot-shapes copied badly by someone who could not read them: the first cluster of Fathom's file. Somebody down here has been reading what comes down."); },
  under_in: async (ctx) => {
    ctx.beat(1);
    await ctx.say("At the bottom the Under opens out. Not caves. Shelves: ledges of wet rock stepping down into black water that has no far side. Pools. Things moving in the pools. The fallen line lies across the rock like the first road.");
    await ctx.speak("hale", "Office tells children the held do not go under. True. Under is where the teeth are.");
    await ctx.speak("dulcet", "Listen. Nothing is humming. Not one line. I have never been anywhere this quiet. I can hear your heartbeats, and under them I can hear something very large breathing out.");
    await ctx.say("Side passages branch off low and narrow. The held cannot follow Fathom into them: their lines would catch on the rock. Whatever is in them, Fathom finds alone.");
  },
  under_side1: async (ctx) => { await ctx.say("A low crawl. Fathom's shoulders scrape both walls. At the end, a dry shelf, and on it, something left by somebody who could crawl, wrapped in scale."); },
  under_side2: async (ctx) => { await ctx.say("Under a shelf of rock. Fathom lies flat and inches. There is a feeling in Fathom's chest that is not fear and is not far from it. Nobody held has ever been here. On the Drop the Fish rise to a hum, and Fathom has none. Down here, under the rock, something is listening for footsteps."); },
  under_side3: async (ctx) => { await ctx.say("Behind the Cut camp, a crack only a cut body fits through. Somebody has hidden something here from their own people, in a place their own people could reach, and trusted them not to."); },
  under_camp: async (ctx) => {
    ctx.beat(4);
    await ctx.say("A camp: rings of ash where fires were, flattened places where people sleep, and on the wall in chalk a map of the Under with four thick lines going up out of it and a cross on one. Beneath, in a careful hand: 'THE SKY FISHES. CUT THE CABLES AND IT FISHES NOTHING. WHOEVER STARVES, STARVES. - S.'");
    await ctx.speak("hale", "S. Shear. The Cut. Stays go, sky drifts off. Every line on the Drop goes with it. No more scrap. Every town eats scrap.");
    await ctx.speak("burl", "Every line. Every hook. Every knot.");
    await ctx.say("Burl has stopped rolling. Burl is very still.");
    const i = await ctx.choose(["Shear is right. It fishes us.", "Shear is wrong. People eat the scrap."], { title: "Fathom thinks" });
    ctx.flag(i === 0 ? "c6_cut_sympathy" : "c6_cut_against");
    if (i === 0) await ctx.speak("dulcet", "You may be right. Say it to Shear and see how it sounds out loud.");
    else await ctx.speak("hale", "Scrap is what falls off a catch. This one is the catch. Would rather eat nothing.");
    ctx.flag("c6_camp");
  },
  cutscout: async (ctx) => { await ctx.speak("cutscout", "Cut, are you? Welcome to the shelves. Shear is at the Stay. Shear has a saw longer than a street. Come and watch, or come and help, or get out of the way. Those are the three things, and up there you only ever had one."); },
  underfolk: async (ctx) => { await ctx.speak("underfolk1", "Three hundred years we have been down here, the cut and their children. The Cut say cut it all. Most of us want bread that is not baked in a hole, and a day without a Fish looking at us. Both can be true."); ctx.taught("under"); },
  baker: async (ctx) => { await bounty(ctx, "mites", "underfolk2", "Rootmites. They chew the Stay sheaths and the shavings get in my dough, and the blind pike that follow the mites eat my customers. Fifty slugs for a mite and its pike, and I will throw in bread that has never seen the sky.", "c6_pike", 50, "Mites. Thank you. Here. Underbread, the real one. Up there they sell a pressed copy with an Office stamp on it, because the real one proves you went under."); },
  lobechild: async (ctx) => { await ctx.say("A lobe no bigger than a loaf bumps Fathom's ankle, decides Fathom is not food, and bumps it again anyway, for the company."); },
  under_pool: async (ctx) => { await hooking(ctx, "under_pool", { hard: true, intro: "A pool on the shelves. Down here the Fish are not below the line. They are beside it. Lowering a weighted knot into this is less fishing than asking." }); },
  under_post: async (ctx) => {
    if (ctx.has("c6_post")) { await ctx.say("The drowned post. Nothing more to read that is not underwater."); return; }
    ctx.flag("c6_post");
    await ctx.say("An Office post, drowned to the lintel, white paint gone green. Shore crew once worked down here, at the waterline. On the one dry shelf, a ledger that is not about people. It is about Fish. Weights. Lengths. A tally of every Fish the sky has taken.");
    await ctx.say("Down the edge of every page runs one more column, headed OWED. Under it, where a name should be: ABOVE THE SKY. Fathom closes the ledger and puts a stone on it.");
    await ctx.give("l_jaw");
  },

  sump_talk: async (ctx) => {
    ctx.beat(2);
    await ctx.say("Under a rock, something round and soft and many-legged is shaking. Fathom thinks it is afraid. It is not afraid. It is laughing.");
    await ctx.say("'Hah. Hah. LINES. You all have lines. Going UP. Hah. Do you know what a line is? Do you know what is on the other END of a line?'", { speaker: "A lobe" });
    await ctx.speak("hale", "A hook.");
    await ctx.say("'And on the other end of THAT, bait? Hah! And you walked down here, where the teeth are, with your lines ON. Which one of you is the clever one?'", { speaker: "A lobe" });
    await ctx.say("The lobe stops laughing and looks at Fathom with what might be eyes.");
    await ctx.say("'You. No line. Down here on purpose. You are the funny one. Sump. I eat what the Fish leave. I will come. I want to see what the funny one is tied to.'", { speaker: "A lobe" });
    await ctx.join("sump");
    ctx.flag("c6_sump");
    ctx.refresh();
    await ctx.say("Things of the Under have no line and no tension. When one winds up a big move, locks show over its head: icons for elements and tricks. Match every lock before the move lands and it is canceled. The banner says what answers each lock. Pluck interrupts a held foe. Locks are how you interrupt a foe with no line. Sump can Burrow and Swallow a hit meant for a friend, and will learn to Spit.");
    const r = await ctx.battle("c6_lobes", { canFlee: false, loseAllowed: true });
    if (r === "win") await ctx.speak("sump", "My cousins. They will not remember this. Lobes do not remember things, it is restful. Where is your line going? Down? Hah. Good. Everything that matters is wet, bait.");
    else await ctx.speak("sump", "My cousins are rude. Come on, bait.");
    ctx.beat(3);
  },

  nursery_in: async (ctx) => {
    await ctx.say("A cave full of pools, and under the surface of every pool, lobes no bigger than fists, hundreds of them, bumping gently against each other. The nursery. The line runs down into the biggest pool and does not come out.");
    await ctx.speak("sump", "The old one lives in the big pool. She was here before the lobes. She was here before the sky started fishing. She has never once bitten a thing she could not see, and that is why she is still here and the ones that bit the hum are not.");
  },
  neverheld: async (ctx) => {
    ctx.beat(5);
    await ctx.fx("rings", 8, 5);
    await ctx.say("The big pool heaves. Something comes up out of it that is not a lobe and is not anything Fathom has a word for but Fish, and it is the first whole Fish Fathom has seen, and it is the size of the choir barn, and it has Fathom's line wrapped round it like a necklace.");
    await ctx.speak("sump", "Hello, grandmother. We need the string. Yes, that one. No. No, do not eat it. They are not humming, grandmother, listen, they are not humming.");
    if (ctx.inParty("gust")) await ctx.speak("sump", "Quiet, wind. She can hear you.");
    await ctx.say("She looks at the party for a long time with an eye the size of a door. Then she bites anyway, because she can see them.");
    const r = await ctx.battle("c6_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c6_boss");
    ctx.refresh();
    await ctx.fx("rings", 8, 5);
    await ctx.say("The Thing That Was Never Held sinks back into the pool. She does not look at them again. The line slides off her into the shallows. She has not been fished in nine hundred years and she is not going to start being fished now.");
  },
  nursery_pool: async (ctx) => {
    ctx.beat(6);
    await ctx.say("Fathom wades in. The knots are tight and cold and very clear.");
    await ctx.knot("m6", "IT WILL CLIMB", "Dulcet");
    await ctx.speak("hale", "Climb. The Stays. Up from down here, to the deck. The only way up that is not the Lift.");
    await ctx.speak("sump", "Hah. All the way down here to be told up. What waits at the top of a climb, bait? Something with a mouth?");
    await ctx.speak("dulcet", "It will climb. Not 'it may'. Fathom, I have decided I am going to climb and I would like it on record that nobody up there made me.");
    ctx.flag("c6_read");
    await ctx.poolBonus(2);
    await ctx.camp([
      { a: "fathom", b: "sump", lines: [["sump", "What is it like? Being held?"], ["fathom", "I do not remember. It was like breathing."], ["sump", "Hah. Bait that breathes. Every breath you took went up the line, you know. Every one."]] },
      { a: "hale", b: "sump", lines: [["hale", "You swallowed that pike. It was aimed at this one."], ["sump", "You looked cold. I am never cold. Trade."], ["hale", "That is not how trades work."], ["sump", "Down here it is, bait."]] },
      { a: "gust", b: "sump", lines: [["gust", "There is no wind down here. There is only me. I have never been the only wind."], ["sump", "Then you are the weather, bait. Congratulations."], ["gust", "Oh. OH."]] },
      { a: "burl", b: "fathom", lines: [["burl", "Every line. If they cut the Stays. Every hook comes down. Every knot."], ["fathom", "You said that before."], ["burl", "Again. Remember it. Three hooks."]] },
      { a: "dulcet", b: "sump", lines: [["dulcet", "You have no note at all. You are the first thing I have ever met with no note."], ["sump", "I hum when I laugh, bait."], ["dulcet", "That is not a note. I had not heard one of those in twenty years."]] },
    ]);
    ctx.setGoal("Follow the line out of the nursery, south, toward the Stay.");
  },
  nursery_out: async (ctx) => {
    ctx.beat(7);
    await ctx.say("South of the nursery the shelf climbs until there is no roof, only dark, and out of the dark comes a sound Fathom has heard once before: a line, humming, but a line as thick as a town. The Stay. The line leads straight to it, and so does the Cut.");
    ctx.flag("c6_done");
    await ctx.nextChapter();
  },
  scrap_talk: scrapTalk,
};

export const ch6: Chapter = {
  n: 6,
  title: "The Under",
  subtitle: "Approach to the inmost cave",
  maps: [shaft, under, nursery],
  scripts,
  beats: ["Down the shaft, to where the water starts", "The held cannot follow into the side passages", "A lobe laughing under a rock", "Sump, who knows exactly what a line is for", "The Cut's camp: the sky fishes. Cut the cables.", "The Thing That Was Never Held, a Fish", "Dulcet reads: IT WILL CLIMB", "The Stay, humming in the dark"],
  goal: (g) => {
    const f = g.flags;
    if (f.c6_done) return "To the Stay.";
    if (f.c6_read) return "Go to the south end of the nursery, where the line runs on.";
    if (f.c6_boss) return "Wade into the big pool for the knots.";
    if (f.c6_sump) return "Follow the line south across the shelves to the nursery.";
    return "Down the shaft and onto the shelves. Something is laughing under a rock to the east.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 6", "The Under", { beat: "Approach" });
    await ctx.teleport("shaft", 6, 1, "down");
  },
  debugStart: { map: "shaft", x: 6, y: 1, level: 16, flags: { c5_done: true } },
};
