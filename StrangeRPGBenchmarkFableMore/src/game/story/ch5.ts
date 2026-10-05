import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, SCRAP_NPC, scrapTalk, hooking, inn, bounty } from "./common";

const steppe: MapDef = {
  id: "steppe",
  name: "The Pendulum Steppe",
  theme: "steppe",
  music: "road",
  musicSeed: "steppe",
  caption: "The Pendulum Steppe. Lean with it or fall.",
  rows: [
    "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "^......................................^",
    "^..r.........x............r............^",
    "^..........................b...........^",
    "^.....b...........P....................^",
    "^..........................r...........^",
    "^..............x.......................^",
    "^...........................b..........^",
    "^.....P..............................P.^",
    "........................................",
    "^...............r......................^",
    "^..b.........................x.........^",
    "^.........P............................^",
    "^..................b...................^",
    "^..........................P...........^",
    "^.....x................................^",
    "^.............r.............w..........^",
    "^..................................b...^",
    "^......................................^",
    "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
  ],
  line: [[0, 9], [6, 10], [10, 8], [14, 11], [18, 8], [22, 11], [26, 8], [30, 10], [34, 9], [39, 9]],
  npcs: [
    { id: "gust_npc", x: 18, y: 7, sprite: { kind: "wind", seed: "gust", variant: "face", a: "frost", b: "sky" }, name: "A small wind", held: true, talk: "gust_talk", hideIf: "c5_gust", solid: true },
    { id: "swinger_npc", x: 8, y: 4, sprite: P("swinger", "amber", "ink", "tall"), name: "A Swinger", note: "E", talk: "swinger", wander: true },
    { id: "hermit", x: 33, y: 15, sprite: P("hermit", "olive", "bone", "robe"), name: "A hermit", note: "B", talk: "hermit" },
  ],
  triggers: [
    { id: "steppe_in", x: 1, y: 8, w: 2, h: 3, on: "enter", once: true },
    { id: "steppe_post", x: 18, y: 8, on: "interact", hideIf: "c5_gust" },
    { id: "steppe_well", x: 28, y: 16, on: "interact" },
  ],
  exits: [
    { x: 0, y: 9, to: "letout", tx: 28, ty: 20, facing: "left" },
    { x: 39, y: 9, to: "wheelstead", tx: 1, ty: 8, facing: "right", needs: "c5_gust", blocked: "Without something to set the wind, the arcs of fallen line lead everywhere and nowhere." },
  ],
  wander: [{ groups: ["c5_swingers", "c5_rams", "c5_drafts"], count: 4, x: 4, y: 2, w: 32, h: 15, sprite: { kind: "creature", seed: "galeram", variant: "beast", a: "bone", b: "rust" } }],
  chests: [{ id: "st_chest1", x: 33, y: 3, item: "g_courier", count: 1 }, { id: "st_chest2", x: 5, y: 16, item: "underbread", count: 2, slugs: 50 }],
};

const wheelstead: MapDef = {
  id: "wheelstead",
  name: "Wheelstead",
  theme: "steppe",
  music: "town",
  musicSeed: "wheelstead",
  caption: "Wheelstead. The walls roll with the wind.",
  rows: [
    "oooooooooooooooooooooooooo",
    "o........................o",
    "o..||||.......||||.......o",
    "o..|||D.......|||D.......o",
    "o........................o",
    "o....,,,,,,,,,,,,,,......o",
    "o....,,,,,,,,,,,,,,......o",
    "o....,,,,,,P,,,,,,,......o",
    "........,,,,,,,,,,,.......",
    "o....,,,,,,,,,,,,,,......o",
    "o........................o",
    "o..||||.......||||....V..o",
    "o..|||D.......|||D.......o",
    "o........................o",
    "o.....x...w......x.......o",
    "o........................o",
    "oooooooooooooooooooooooooo",
  ],
  line: [[0, 8], [6, 9], [11, 10], [16, 9], [20, 8], [25, 8]],
  npcs: [
    { id: "wheelwright", x: 9, y: 13, sprite: P("wheelwright", "clay", "amber", "hat"), name: "Wheelwright", note: "D", talk: "wheelwright", wander: true },
    { id: "guildmaster", x: 11, y: 8, sprite: P("guildmaster", "amber", "ink", "tall"), name: "Swing guildmaster", note: "E", talk: "guildmaster" },
    { id: "steppekid", x: 18, y: 14, sprite: P("steppekid", "sand", "sky", "small"), name: "Reed", note: "A", talk: "steppekid", wander: true },
    { id: "innkeep3", x: 6, y: 12, sprite: P("innkeep3", "clay", "gold"), name: "Innkeeper", note: "G", talk: "inn3" },
    { id: "grocer2", x: 17, y: 3, sprite: P("grocer2", "olive", "sand"), name: "Grocer", note: "C", talk: "grocer2" },
    { id: "scout", x: 22, y: 5, sprite: P("scout", "white", "slate", "frame"), name: "A True scout", note: "B", talk: "scout", hideIf: "c5_anchor" },
    { id: "elder2", x: 4, y: 5, sprite: P("elder2", "bone", "amber", "robe"), name: "An elder", note: "F", talk: "elder2", wander: true },
    { id: "ramherd", x: 20, y: 10, sprite: P("ramherd", "sand", "rust", "hat"), name: "Ram-herd", note: "D", talk: "ramherd" },
    SCRAP_NPC(22, 14),
  ],
  triggers: [
    { id: "wheel_in", x: 1, y: 7, w: 2, h: 3, on: "enter", once: true },
    { id: "wheel_shop", x: 17, y: 3, on: "interact" },
    { id: "wheel_inn", x: 6, y: 12, on: "interact" },
    { id: "wheel_house", x: 6, y: 3, on: "interact" },
    { id: "wheel_house2", x: 17, y: 12, on: "interact" },
    { id: "wheel_well", x: 10, y: 14, on: "interact" },
  ],
  exits: [
    { x: 0, y: 8, to: "steppe", tx: 38, ty: 9, facing: "left" },
    { x: 25, y: 8, to: "anchor", tx: 1, ty: 7, facing: "right" },
  ],
};

const anchor: MapDef = {
  id: "anchor",
  name: "The Anchor",
  theme: "steppe",
  music: "dungeon",
  musicSeed: "anchor",
  caption: "The Anchor. Where the line snagged.",
  rows: [
    "^^^^^^^^^^^^^^^^^^^^^^",
    "^....................^",
    "^..r..............r..^",
    "^........,,,,,.......^",
    "^.......,,,,,,,......^",
    "^.......,,,r,,,......^",
    "^.......,,,,,,,......^",
    ".........,,,,,.......^",
    "^....................^",
    "^..b..........b......^",
    "^.........V..........^",
    "^.......U............^",
    "^......UUU...........^",
    "^^^^^^^^^^^^^^^^^^^^^^",
  ],
  line: [[0, 7], [5, 7], [8, 6], [11, 5], [11, 9], [8, 11], [7, 12]],
  npcs: [{ id: "rigor", x: 11, y: 4, sprite: P("rigor", "white", "blood", "frame"), name: "Leveler Rigor", note: "G", talk: "rigor", showIf: "c5_read", hideIf: "c5_anchor" }],
  triggers: [
    { id: "anchor_in", x: 1, y: 6, w: 2, h: 3, on: "enter", once: true },
    { id: "anchor_rock", x: 11, y: 5, on: "interact", hideIf: "c5_read" },
    { id: "anchor_gap", x: 8, y: 11, on: "interact", hideIf: "c5_anchor" },
  ],
  exits: [
    { x: 0, y: 7, to: "wheelstead", tx: 24, ty: 8, facing: "left" },
    // The way down opens once chapter 5 ends, so the shaft's top exit has a way back
    { x: 7, y: 12, w: 3, to: "shaft", tx: 6, ty: 1, facing: "down", needs: "c5_done", blocked: "The gap under the Anchor. The wind goes down it and does not come back. Not yet." },
  ],
};

// ---------------------------------------------------------------------------

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  steppe_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("The Steppe is flat, and the wind never stops, and everyone on it is a pendulum. Walk ten steps and a gust takes you sideways on your line until the line swings you back. The held do not walk here. They swing.");
    await ctx.speak("lissom", "Oh. OH. Look at them go. That is a dance. One and two and. That is the biggest dance I have ever seen.");
    await ctx.speak("hale", "Rigor's column a day behind. In this wind a frame cannot swing. They walk. Slowly. Hatefully. Humming the whole way so the sky knows where they are.");
    await ctx.say("The fallen line has been dragged into long arcs by the wind. It goes east, and north, and east again, and back. The only way to follow it is to know where the wind is going to push.");
  },
  swinger: async (ctx) => { await ctx.speak("swinger_npc", "Courier of the Swing. Letters, parcels, anything under a stone. You cannot swing, cut one, you would just fall. Though I suppose you could walk. Nobody walks. How strange. How quiet."); },
  hermit: async (ctx) => {
    if (ctx.has("c5_hermit")) { await ctx.speak("hermit", "Still here. Still counting. Four hundred and twelve bites since I sat down. All of them somewhere else."); return; }
    ctx.flag("c5_hermit");
    await ctx.speak("hermit", "I climbed a post nineteen years ago to be nearer the sky. The post fell over. I stayed. The sky did not notice. Then I stopped humming, to see if it would notice that. It did not. Nothing bites a quiet man on the ground. That is my proof, cut one. You are the first who can use it.");
    await ctx.giveSlugs(19);
    await ctx.say("Nineteen slugs. He takes them out of his hat one at a time.");
  },
  steppe_post: async (ctx) => { await ctx.say("A post with a line snagged on it. Something is caught in the line, fluttering: not a bird. Air, in a shape."); },
  steppe_well: async (ctx) => { await hooking(ctx, "steppe_well", { intro: "A sinkhole in the Steppe, where the wind goes down. Fathom has a weighted knot and the wind for company." }); },
  gust_talk: async (ctx) => {
    ctx.beat(2);
    await ctx.say("Tangled in the line that runs from the post is a wind. A small one, no bigger than a dog, going round and round in a knot of its own tail. It has been caught so long it has started to have a face.");
    await ctx.say("'Hello!' says the wind. 'I am HELD. I whistled through a line and it hooked me! Is this what it is like? It is very restful. I used to be everywhere. Now I am at.'", { speaker: "A small wind" });
    await ctx.speak("dulcet", "A draft. The Steppe is full of them. This one whistled a note and something took it for bait. It has a line now. Listen, it hums. Something will come for it, eventually.");
    const i = await ctx.choose(["Cut it loose.", "Ask it to come."]);
    if (i === 0) {
      await ctx.say("Fathom goes to cut the line and the wind squirms away from the edge.");
      await ctx.say("'No! I LIKE it. Everyone else gets held. Why not me? I will come with you. I will set the wind. I am very good from the wind, it is the one thing I am.'", { speaker: "A small wind" });
    } else {
      await ctx.say("'Yes! I will set the wind. Which way do you want it? Left? Right? I can do both. Not at once. Well. Once.'", { speaker: "A small wind" });
    }
    await ctx.join("gust");
    ctx.flag("c5_gust");
    ctx.refresh();
    await ctx.say("The Steppe fights in three lanes, and each round the wind pushes everyone one lane the way the arrow on the strip shows. Now Gust can set that wind for the next round, for nothing. Lane attacks hit everything standing in a lane.");
    const r = await ctx.battle("c5_rams", { canFlee: false, loseAllowed: true });
    if (r === "win") await ctx.speak("gust", "Did you see? I pushed them in a row and then they were in a row! That is the whole trick. That is all wind ever does, and nobody ever says thank you.");
    else await ctx.speak("gust", "I will get better at it. I was only ever a draft.");
    ctx.beat(3);
    await ctx.speak("gust", "The line goes east to the town with the rolling walls. Then east again to a rock. I know the rock. Everything on the Steppe knows the rock, it is the only thing that does not move, and there is a hole under it that goes DOWN, and I have never been down, down is not for wind.");
  },

  wheel_in: async (ctx) => {
    await ctx.say("Wheelstead's walls are on wheels. When the wind turns the whole town rolls a few yards and settles, and nobody inside stops what they are doing.");
    await ctx.speak("gust", "I pushed this town once! Only a little. It rolled at the left and everyone inside kept eating soup.");
  },
  wheelwright: async (ctx) => { await ctx.speak("wheelwright", "Walls on wheels. Houses on wheels. The bell on a wheel. If it does not roll with the wind it breaks. Your knot friend rolls. He would do well here."); await ctx.speak("burl", "I would."); },
  guildmaster: async (ctx) => {
    if (ctx.has("c5_anchor")) { await ctx.speak("guildmaster", "You beat Rigor at the Anchor. The Swing will carry your name east for free, over every stone on the Steppe."); return; }
    if (ctx.errandDone("swing")) { await ctx.speak("guildmaster", "Delivered. A cut courier. The guild has no rule against it because nobody thought to write one. I am thinking of writing one. I am also thinking of not."); return; }
    await ctx.speak("guildmaster", "The Swing does not take cut members. No line, no swing. You would simply fall. But a parcel needs carrying to the far post and every courier I have is sick from the wind. You cannot swing. You could ride one who can, and push.");
    const i = await ctx.choose(["Carry the parcel", "Not now"], { cancel: true });
    if (i !== 0) return;
    const r = await ctx.minigame("swing", { hard: false });
    if (r.won) { ctx.errand("swing"); await ctx.speak("guildmaster", "Delivered. A cut courier. Here, the guild's gloves. They were going to go to someone who could swing, and now they are going to you."); await ctx.give("g_courier"); await ctx.giveSlugs(40); }
    else await ctx.speak("guildmaster", "Short. The parcel is in a hedge. Try again when the wind is kinder.");
  },
  steppekid: async (ctx) => { await ctx.speak("steppekid", "Reed! I can swing all the way to the well and back without touching. Can you? No. You would fall. Can I watch you fall? Just a little one? Nothing bites you when you fall, Mam says. Nothing can hear you."); ctx.taught("wheelstead"); },
  inn3: async (ctx) => { await inn(ctx, "innkeep3", "Beds on wheels, eight slugs. They roll when the wind turns. You get used to it. Guests who do not get used to it get used to the floor.", "The bed rolls three times in the night. Gust sleeps on the ceiling, humming, and the slats sing a little, and far off something answers."); },
  grocer2: async (ctx) => { await ctx.speak("grocer2", "Courier gloves, Steppe bread, ballast for lean days. Lures too, the Swing use them to find each other in the dark. I have a very old pair of soles nobody can explain."); await ctx.shop(["flatbread", "underbread", "slattea", "slugpouch", "spool", "salve", "firepot", "coldash", "w_ballast", "w_tuningslug", "g_courier", "s_iron", "s_climbing", "l_glass", "l_bell"], "Wheelstead grocery"); },
  wheel_shop: async (ctx) => { await scripts.grocer2(ctx); },
  wheel_inn: async (ctx) => { await scripts.inn3(ctx); },
  wheel_well: async (ctx) => { await hooking(ctx, "wheel_well", { intro: "Wheelstead's well, which rolls with the town and is never quite where it was." }); },
  wheel_house: async (ctx) => { await ctx.say("A house on wheels, chocked. Inside, a family at a table bolted to the floor. The soup is in cups with lids. On the wall, a scale the size of a plate, polished, which the family calls the mirror."); },
  wheel_house2: async (ctx) => { await ctx.say("The Swing's guildhall. Hooks on every wall where couriers hang their parcels, and themselves, between runs. Nobody here finds the hooks strange. Fathom does, now."); },
  scout: async (ctx) => { await ctx.speak("scout", "Leveler Rigor is a day out with a column. He will reach the Anchor by nightfall. He wants the tuner and the woman with two lines. He says the Economy wants them. He always says the Economy."); },
  elder2: async (ctx) => { await ctx.speak("elder2", "The Anchor is the one rock on the Steppe that does not move. Under it there is a hole, and in the hole a wind that goes DOWN, and sometimes the hole breathes out and the breath smells of the stream, and the rams will not go near it."); },
  ramherd: async (ctx) => { await bounty(ctx, "rams", "ramherd", "Gale-rams. They charge downwind and they have taken to charging the walls. Forty-five slugs a ram, and whatever is blowing it along is your problem. Bring me the horns, the Office pays extra for horns.", "c5_rams", 45, "Horns. Good. The Office grinds them. I asked once what for. The clerk said lures. I said lures for what. He said hum."); },

  anchor_in: async (ctx) => {
    ctx.beat(4);
    await ctx.say("The Anchor is one rock, alone on the flat, the only thing on the Steppe that does not roll. The fallen line has wrapped it three times and run on, down, into a gap at its foot where the wind goes in and does not come out.");
    await ctx.speak("gust", "That wind goes DOWN! I have never been at down. Nothing ever pushed me that way. Something is pushing that one. Listen! It is breathing.");
  },
  anchor_gap: async (ctx) => { await hooking(ctx, "anchor_gap", { hard: true, intro: "The gap under the Anchor. The breath that comes up smells of the stream in Hem and of something large. Fathom has a weighted knot and should probably not." }); },
  anchor_rock: async (ctx) => {
    await ctx.say("Where the line snagged on the Anchor, it rubbed. Where it rubbed, the knots held. A long cluster of them, pressed into the stone.");
    await ctx.knot("m5", "IT WILL GO DOWN", "Dulcet");
    await ctx.speak("hale", "Down. Written before the Steppe. Before Gust. The gap is right there.");
    await ctx.speak("dulcet", "Every time we read one, we do what it says. Fathom, I want to go anywhere but down, just once, to see what the knots do about it.");
    const i = await ctx.choose(["We go down because the line does.", "We go down because we choose to."]);
    if (i === 0) await ctx.say("Fathom says it plainly. The line goes down. The file knows the line goes down. Knowing the road is not the same as walking it.");
    else await ctx.say("Fathom says it, and Dulcet laughs, once, the first time in the Steppe. 'Fine. We choose. Write that down, whoever you are.'");
    ctx.flag("c5_read");
    ctx.refresh();
    await ctx.say("Behind them, the wind changes. Not Gust. Boots. A column of Trues in frames comes over the rise, walking straight into the wind because they cannot do anything else, humming in unison so loud the rams run.");
    ctx.setGoal("Leveler Rigor is here. There is nowhere to swing to.");
  },
  rigor: async (ctx) => {
    ctx.beat(5);
    await ctx.speak("rigor", "The tuner of Hem. Cut, and walking under things, and dragging a Returned one about like a dog on a rope. Do you know what you are? A leak. The Economy is simple, tuner. The Fish feed the sky. The sky drops scrap. We eat the scrap. We hum. Everything is fed. And you walk about not humming and people SEE you.");
    await ctx.speak("rigor", "I have stood straight for forty years and hummed every morning and I will be Chosen one day and so will my column, and you will not, and I will take you up myself so the sky can look at what it dropped.");
    await ctx.speak("gust", "The wind says no. I am the wind. I am saying it.");
    const r = await ctx.battle("c5_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c5_anchor");
    ctx.refresh();
    ctx.beat(6);
    await ctx.say("Rigor's frame, which does not bend, breaks. He sits down on the Steppe for the first time in forty years and the wind rocks him gently on his line.");
    await ctx.speak("rigor", "Oh. Oh, that is... I had forgotten it moved. Nobody is coming for me, are they. I have hummed every day for forty years and nobody is coming.");
    await ctx.speak("gust", "I did that. The wind did that. Not you. Well. You too. But mostly wind.");
    await ctx.say("The novices take their frames off in the wind, one by one, and swing, and laugh, and one of them is sick, and one of them stops humming and looks up and waits, and nothing comes. Rigor does not stop them.");
    ctx.taught("anchor");
    await ctx.camp([
      { a: "fathom", b: "gust", lines: [["gust", "When I was everywhere I did not know I was anything. Now I am held and I am Gust and something is going to come for me. Is that what a line is for?"], ["fathom", "That is exactly what a line is for."], ["gust", "Oh. Then what are YOU for?"]] },
      { a: "hale", b: "gust", lines: [["hale", "Up there the wind is dead. It does not move. It is cold that has stopped."], ["gust", "I would hate that."], ["hale", "You would. Stay down here, with us, and hum quietly."]] },
      { a: "lissom", b: "gust", lines: [["lissom", "You pushed everything into a row and then I spun through the row. That is choreography."], ["gust", "That is wind."], ["lissom", "Same thing."]] },
      { a: "dulcet", b: "fathom", lines: [["dulcet", "Rigor hummed every day for forty years and was never bitten. Hem's choir hums once a year and loses one. I do not understand the arithmetic."], ["fathom", "Maybe it is not arithmetic."], ["dulcet", "Then it is taste. That is worse."]] },
    ]);
    ctx.beat(7);
    await ctx.say("At dawn the line goes down into the gap under the Anchor and the wind goes with it. Gust is frightened and pretending not to be. Fathom goes first, because the file said so, and because Fathom chose.");
    ctx.flag("c5_done");
    await ctx.nextChapter();
  },
  scrap_talk: scrapTalk,
};

export const ch5: Chapter = {
  n: 5,
  title: "The Pendulum Steppe",
  subtitle: "Tests, allies, enemies",
  maps: [steppe, wheelstead, anchor],
  scripts,
  beats: ["Everyone on the Steppe is a pendulum", "The line is dragged into arcs. Rigor is a day behind.", "A small wind, hooked for whistling", "Gust sets the wind. Lanes, and the rolling town.", "The Anchor, the one rock that does not move", "Leveler Rigor, who hums on purpose", "Dulcet reads: IT WILL GO DOWN", "Down, under the Anchor, where the wind goes"],
  goal: (g) => {
    const f = g.flags;
    if (f.c5_done) return "Down.";
    if (f.c5_anchor) return "Rest, then go down the gap under the Anchor.";
    if (f.c5_read) return "Rigor is at the Anchor. Face him.";
    if (f.c5_gust) return "East to Wheelstead, then east again to the Anchor.";
    return "Something is caught on the post in the middle of the Steppe.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 5", "The Pendulum Steppe", { beat: "Tests" });
    await ctx.teleport("steppe", 1, 9, "right");
  },
  debugStart: { map: "steppe", x: 1, y: 9, level: 13, flags: { c4_done: true } },
};
