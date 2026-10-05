import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, KNOT, SCRAP_NPC, scrapTalk, hooking } from "./common";

const base: MapDef = {
  id: "stay_base",
  name: "The foot of the Stay",
  theme: "stays",
  music: "under",
  musicSeed: "staybase",
  caption: "The second Stay. It goes up until it is the sky.",
  rows: [
    "uuuuuuuuuuuuuuuuuuuuuuuuuuuu",
    "uuuuuuuuuuuuKKKKuuuuuuuuuuuu",
    "uuuuuuuuuu..KKKK..uuuuuuuuuu",
    "uuuuuuuu....KKKK....uuuuuuuu",
    "uuuuuu......KKKK......uuuuuu",
    "uuuu........KKKK........uuuu",
    "uuu..........SS..........uuu",
    "uuu......................uuu",
    "uu........................uu",
    "uu..,,.......Y............uu",
    "uu..,,......V.............uu",
    "uu........................uu",
    "uuu......................uuu",
    "uuu........w.............uuu",
    "uuuu....................uuuu",
    "uuuuuuuuuu....uuuuuuuuuuuuuu",
    "uuuuuuuuuu....uuuuuuuuuuuuuu",
  ],
  line: [[11, 16], [11, 12], [12, 8], [13, 6]],
  npcs: [
    { id: "bob_npc", x: 16, y: 9, sprite: P("bob", "clay", "amber", "hat"), name: "A surveyor", held: false, talk: "bob_talk", hideIf: "c7_bob" },
    { id: "shear_npc", x: 13, y: 7, sprite: P("shear", "coal", "blood", "slack"), name: "Shear", held: false, talk: "shear_talk", hideIf: "c7_fell" },
    { id: "blade1", x: 11, y: 7, sprite: P("cut_blade", "coal", "blood", "slack"), name: "A Cut blade", held: false, talk: "blade", hideIf: "c7_fell" },
    { id: "blade2", x: 15, y: 7, sprite: P("cut_blade2", "coal", "ash", "slack"), name: "A Cut blade", held: false, talk: "blade", hideIf: "c7_fell" },
    { id: "mourn_burl", x: 12, y: 10, sprite: KNOT("burl", "rust", "gold"), name: "Burl", held: true, talk: "mourning", showIf: "c7_fell", hideIf: "c7_back" },
    { id: "mourn_dulcet", x: 14, y: 10, sprite: P("dulcet", "violet", "bone", "robe"), name: "Dulcet", note: "E", talk: "mourning", showIf: "c7_fell", hideIf: "c7_back" },
    { id: "cook", x: 5, y: 12, sprite: P("cook", "coal", "sand", "slack"), name: "The Cut's cook", held: false, talk: "cook", wander: true },
    SCRAP_NPC(21, 13),
  ],
  triggers: [
    { id: "base_in", x: 11, y: 15, w: 4, h: 2, on: "enter", once: true },
    { id: "base_rungs", x: 13, y: 6, w: 2, h: 1, on: "enter", showIf: "c7_bob", hideIf: "c7_fell" },
    { id: "base_rungs2", x: 13, y: 6, w: 2, h: 1, on: "enter", showIf: "c7_back", hideIf: "c7_boss" },
    { id: "base_well", x: 11, y: 13, on: "interact", showIf: "c7_back" },
    { id: "base_bones", x: 13, y: 9, on: "interact" },
    { id: "base_mark1", x: 4, y: 9, on: "interact" },
    { id: "base_mark2", x: 23, y: 8, on: "interact" },
  ],
  exits: [
    { x: 11, y: 16, w: 4, to: "nursery", tx: 7, ty: 9, facing: "up" },
  ],
  wander: [{ groups: ["c7_blades", "c7_crawler", "c7_ghosts"], count: 2, x: 3, y: 7, w: 22, h: 7, sprite: { kind: "thing", seed: "staycrawler", a: "slate", b: "teal" }, hideIf: "c7_boss" }],
  chests: [{ id: "b_chest1", x: 4, y: 10, item: "w_frostbead", count: 1 }],
};

const well: MapDef = {
  id: "well",
  name: "The well",
  theme: "stays",
  music: "sad",
  musicSeed: "well",
  caption: "The bottom of the well under the Stay",
  dark: true,
  slackOnly: true,
  rows: [
    "uuuuuuuuuuuuuu",
    "uuuuu____uuuuu",
    "uuuu______uuuu",
    "uuu___r____uuu",
    "uuu________uuu",
    "uuu_____r__uuu",
    "uuu________uuu",
    "uuuu______uuuu",
    "uuuuu_C__uuuuu",
    "uuuuuuuuuuuuuu",
  ],
  line: [[6, 8], [6, 5], [7, 2]],
  npcs: [],
  triggers: [
    { id: "well_in", x: 5, y: 2, w: 4, h: 2, on: "enter", once: true },
    { id: "well_coil", x: 6, y: 8, on: "interact" },
    { id: "well_rock", x: 6, y: 3, on: "interact", showIf: "c7_read" },
    { id: "well_water", x: 8, y: 5, on: "interact" },
  ],
  exits: [],
};

const rungs: MapDef = {
  id: "stay_rungs",
  name: "The rungs",
  theme: "stays",
  music: "dungeon",
  musicSeed: "rungs",
  caption: "The maintenance rungs. Nine hundred years of rust.",
  rows: [
    "uuuuuKKKKuuuuu",
    "uuuu......uuuu",
    "uuuu.KKKK.uuuu",
    "uuu..KKKK..uuu",
    "uuu.SKKKKS.uuu",
    "uuu..KKKK..uuu",
    "uuu..KKKK..uuu",
    "uuu.SKKKKS.uuu",
    "uuu..KKKK..uuu",
    "uuu..KKKK..uuu",
    "uuu.SKKKKS.uuu",
    "uuu..KKKK..uuu",
    "uuu..KKKK..uuu",
    "uuu.SKKKKS.uuu",
    "uuu..KKKK..uuu",
    "uuu..KKKK..uuu",
    "uuuu.KKKK.uuuu",
    "uuuu.KKKK.uuuu",
    "uuuuuKKKKuuuuu",
  ],
  line: [[4, 18], [4, 10], [9, 6], [9, 0]],
  npcs: [{ id: "shear_cut", x: 9, y: 2, sprite: P("shear", "coal", "blood", "slack"), name: "Shear", held: false, talk: "shear_fight", hideIf: "c7_boss" }],
  triggers: [
    { id: "rungs_in", x: 4, y: 16, w: 2, h: 2, on: "enter", once: true },
    { id: "rungs_top", x: 4, y: 1, w: 6, h: 2, on: "enter", showIf: "c7_boss" },
    { id: "base_mark3", x: 3, y: 4, on: "interact" },
  ],
  exits: [{ x: 4, y: 17, w: 2, to: "stay_base", tx: 13, ty: 7, facing: "down" }],
  wander: [{ groups: ["c7_shearers", "c7_wight", "c7_crawler"], count: 2, x: 3, y: 3, w: 8, h: 12, sprite: { kind: "knot", seed: "ropewight", variant: "big", a: "coal", b: "plum" }, hideIf: "c7_boss" }],
};

// ---------------------------------------------------------------------------

async function mark(ctx: ScriptContext, n: number, text: string): Promise<void> {
  if (ctx.has(`c7_mark${n}`)) { await ctx.say("Bob's chalk mark. A number, and under it a smaller number, and under that a question mark."); return; }
  ctx.flag(`c7_mark${n}`);
  await ctx.say(text);
  const all = ctx.has("c7_mark1") && ctx.has("c7_mark2") && ctx.has("c7_mark3");
  if (all && ctx.inParty("bob") && !ctx.errandDone("marks")) {
    ctx.errand("marks");
    await ctx.speak("bob", "Three readings. The Stay leans four degrees off true, which over nine hundred miles is a lot of sky somewhere it should not be. The sky is drifting. Somebody up there is not steering. Thank you. I will fall more comfortably knowing that.");
    await ctx.giveSlugs(80);
    await ctx.give("s_fin");
  }
}

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  base_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("The Stay comes down out of the dark into the floor of the biggest shelf on the Drop: a cable so thick the party could not join hands round it, humming one note so low it is a feeling in the teeth. Round its foot the Cut have built a camp, and a saw.");
    await ctx.speak("dulcet", "That note. That is the note under every note I have ever played. Every line on the Drop is tuned to this. This is the string, and we were the knots in it.");
    await ctx.speak("burl", "Shear. There. By the saw. And the surveyor with the weight.");
  },
  base_bones: async (ctx) => { await ctx.say("Bones at the foot of the Stay. Long jaws. Curved teeth. Fish that climbed, or tried to, and fell. Something up there wanted them badly enough that they tried."); },
  base_mark1: async (ctx) => { await mark(ctx, 1, "A chalk mark on the shelf: a number, a smaller number, a question mark. One of three, by the look of it. Somebody has measured the Stay from more than one place and did not like the sum."); },
  base_mark2: async (ctx) => { await mark(ctx, 2, "A second chalk mark, on the far side of the cable. The small number is smaller here."); },
  base_mark3: async (ctx) => { await mark(ctx, 3, "A third chalk mark, high on the rungs, where only a surveyor with no fear and a weight on a string would go. The question mark here is underlined twice."); },
  cook: async (ctx) => { await ctx.speak("cook", "Cook. Forty blades to feed and nothing down here to feed them but what the Fish leave and what falls. We eat scrap too, you know. Everybody does. Shear says after the cut we will eat nothing for a year and then we will eat whatever we are. I have not worked out what that means for the menu."); },
  bob_talk: async (ctx) => {
    ctx.beat(1);
    await ctx.say("A man in a hat is holding a weight on a string against the Stay and squinting. The string hangs straight down. He writes a number in a book.");
    await ctx.speak("bob", "Bob. Surveyor. Underfolk, three hundred years down, twelfth generation. The Cut are paying me to find the point where a cut takes the least sawing. I have found it. I have not told them. I am having what my mother called a think, and she had eleven of them in her life.");
    await ctx.speak("bob", "Not a title, before you ask. Everyone asks. Bob. My father was Bob, and his, eleven back. The weight on the string is also called a bob. We are a simple family with one word.");
    await ctx.speak("bob", "Here is the think. Four cables hold the Drop up under the sky. I have measured this one from three places and I do not like the sum. Cut one and the Drop tips thirty degrees and the sky drifts. Every held thing goes up to the end of its line and hangs there, unless something up there lets the lines run, and the scrap stops. Shear calls that freedom. I have measured a lot of things and I have never measured that.");
    const i = await ctx.choose(["Help us stop them.", "Show us the way up."]);
    if (i === 0) await ctx.speak("bob", "Stop them. Nobody has stopped Shear in forty years. But the rungs go up, and nobody has gone up either, and here you are, which is one more than zero.");
    else await ctx.speak("bob", "Up. The maintenance rungs. They stop three hundred rungs up where the rust won. After that you climb the cable itself. I have measured it. Nine hundred and twelve miles. I would like to see the top of a number that size.");
    await ctx.join("bob");
    ctx.flag("c7_bob");
    ctx.refresh();
    await ctx.say("Bob can Plumb a fight: every weakness shown. From here on, two allies who have talked by the fire can act together. Pair: one big move, both turns.");
    const r = await ctx.battle("c7_crawler", { canFlee: false, loseAllowed: true });
    if (r === "win") await ctx.speak("bob", "A crawler. Maintenance, a thousand years late. Everything up there is late. Shear will want a word before the rungs. Shear's words have edges and take about nine minutes.");
    else await ctx.speak("bob", "Hm. One loss. We will do better. The rungs are by the cable.");
  },
  shear_talk: async (ctx) => {
    await ctx.speak("shear", "The tuner of Hem. I was the tuner of Hem forty years ago, before I was cut, and I tuned beside a girl called Marrow who leaned, did you know that, she always leaned, and I have thought about the choir every day since because I worked out what it was for and nobody up there told me, I had to");
    await ctx.speak("burl", "Tug.");
    await ctx.speak("shear", "...I had to work it out alone, on the shelves, with a Fish looking at me. The sky fishes. We are bait. The Office is shore crew. The Lift is a bite. I am going to cut the Stays so it fishes nothing ever again, and everyone up top will go hungry for a year, and then they will be whatever they are, which is not bait, and");
    await ctx.speak("dulcet", "Yes. We read the file. We know.");
    await ctx.speak("shear", "You read the... then you know I am right. Go up if you like. The rungs are there. Nobody comes back down them. The file says you will climb. The file is always right. That is the one thing I have never been able to stand about it.");
    ctx.flag("c7_shear");
  },
  blade: async (ctx) => { await ctx.speak("blade1", "Forty of us. Cut since birth, down here, and nobody here has looked at me the way they look at you up top, like supper that got away. Shear says cut. We say when."); },
  base_rungs: async (ctx) => {
    ctx.beat(2);
    await ctx.say("The rungs are iron, driven into the Stay's sheath, and they go up into the dark. Bob goes first, then Burl, hooking from rung to rung. The held climb with their lines going up ahead of them, which is the first time a line has ever been useful on a ladder.");
    await ctx.teleport("stay_rungs", 4, 16, "up");
  },
  base_rungs2: async (ctx) => {
    await ctx.say("Up the rungs again. This time nobody is below with a saw.");
    await ctx.teleport("stay_rungs", 4, 16, "up");
  },
  rungs_in: async (ctx) => {
    if (ctx.has("c7_back")) return;
    ctx.beat(3);
    await ctx.say("Three hundred rungs up, the camp is a glow below and the Stay is still the whole world. Then a sound from underneath: a saw, not on the cable. On the rungs.");
    await ctx.speak("gust", "They are cutting the ladder. Behind us. Below us. Fathom, Fathom is the only one without a...");
    await ctx.shake();
    ctx.sfx("fall");
    await ctx.fadeOut();
    await ctx.say("The rungs under Fathom come away from the Stay all at once. The held jerk to a stop on their lines, swinging. Burl catches the cable. Fathom, who is held by nothing, falls.");
    ctx.flag("c7_fell");
    ctx.beat(4);
    await ctx.card("Fathom falls", "a long way, in the dark", { beat: "Find" });
    ctx.g.active = ["fathom"];
    await ctx.teleport("well", 6, 2, "down");
  },
  well_in: async (ctx) => {
    await ctx.say("Fathom lands in water, which is why Fathom lands at all. A well under the Stay, deep and black. Fathom's ribs hurt. Fathom's everything hurts. Fathom is not dead, which the file did not mention either way.");
    await ctx.say("Nobody is coming. The held cannot come down a well. For the first time since the square in Hem, Fathom is alone with it: no line, no hook, no knot, nothing above but dark, and nothing in the dark is listening, because Fathom is not humming.");
    await ctx.say("There is a coil at the bottom of the well. The fallen line. It fell down here too, before Fathom did.");
  },
  well_water: async (ctx) => { await ctx.say("The water Fathom landed in. Black, and still, and something in it has looked at Fathom and decided, for now, not. Fathom does not lower a line into it. Some things you do not ask."); },
  well_coil: async (ctx) => {
    if (ctx.has("c7_read")) { await ctx.say("The coil, read. Fathom has it by heart."); return; }
    await ctx.say("The coil is thick with knots. More than anywhere. Fathom cannot read knot writing. Fathom has watched Ostle and Dulcet read it six times, with their fingers.");
    await ctx.say("Fathom puts a hand on the first knot and starts, slowly, to read.");
    await ctx.knot("m7", "IT WILL COME TO THE DECK", "Fathom");
    ctx.beat(5);
    await ctx.say("It will come to the deck. Not: it will fall down a well. Not: it will drown. The file skipped this part. The file did not think it worth writing down.");
    await ctx.say("Fathom sits at the bottom of the well with nine hundred miles of cable overhead and thinks: whatever is up there is not watching. It is predicting. A watcher would have written down the fall. The file only wrote where Fathom ends up.");
    await ctx.say("A bowline round the rock. A monkey's fist for a hold. Fathom knows ten knots and every one of them is a way up, and none of them is in the file.");
    ctx.flag("c7_read");
    await ctx.poolBonus(3);
    ctx.setGoal("Tie off on the rock at the top of the well and climb.");
  },
  well_rock: async (ctx) => {
    await ctx.say("Fathom ties the fallen line to the rock, and climbs it, and ties it higher, and climbs that. It takes most of a day. Fathom talks to the line the whole way up, which is the first time Fathom has ever talked to it instead of about it.");
    await ctx.fadeOut();
    ctx.g.active = ["fathom", ...ctx.g.roster.filter((id) => id !== "fathom").slice(-3)];
    ctx.flag("c7_back");
    await ctx.teleport("stay_base", 11, 12, "up");
    await ctx.speak("burl", "Tug.");
    await ctx.speak("burl", "Tug tug tug tug tug tug tug.");
    await ctx.speak("dulcet", "We heard you hit the water. We heard you not come up. Lissom has not spoken since. Hale wanted to cut her own lines and go down after you.");
    await ctx.speak("lissom", "You climbed. Out of a well. With nothing. One. Two. I have nothing to count after that.");
    await ctx.say("Fathom shows them the knots. IT WILL COME TO THE DECK. Bob writes it in his book, under a number.");
    ctx.beat(6);
    await ctx.speak("hale", "Shear is on the rungs. Up top, where they stop. Saw at the Stay itself now. Shear says: tell the tuner I am waiting. Then other things. Not worth carrying.");
    ctx.setGoal("Up the rungs. Shear is at the top with the saw.");
  },
  mourning: async (ctx) => { await ctx.say("They are sitting by the well with their lines going up into the dark, not talking, not humming."); },
  base_well: async (ctx) => { await hooking(ctx, "stay_well", { hard: true, intro: "The well Fathom fell into. A line is still tied to the rock at the top. Everything down there has seen Fathom's face now, which makes the fishing worse, or better." }); },

  shear_fight: async (ctx) => {
    ctx.beat(5);
    await ctx.speak("shear", "You came back up. Nobody comes back up. Did the file say you would? It did not say you would fall, did it. It never says the part where it hurts. Forty years I have been reading what comes down and it has never once said the part where it");
    await ctx.speak("bob", "Nine minutes. I timed the last one.");
    await ctx.speak("shear", "...Here is the Stay. Here is the saw. Forty blades and a year's head start and I am cutting it today, with you here, because somebody from Hem should see it.");
    const options = ["People eat the scrap. You would starve them.", "Shear is right. Cut it."];
    if (ctx.inParty("hale")) options.push("There is nobody up there. Hale saw the deck.");
    const i = await ctx.choose(options, { title: "Fathom says" });
    let alone = false;
    if (i === 0) await ctx.speak("shear", "They eat what falls off the thing that eats them. I would rather they ate nothing and knew it. Stand aside or stand in front. Those are the two places.");
    else if (i === 1) { await ctx.speak("shear", "Then why are you standing in front of me? Because the file says so? Say it. Say you are here because you were written here."); await ctx.say("Fathom does not say that. Fathom says: because I want to see it first."); await ctx.speak("shear", "...Then you will have to go through me to get there. I have waited forty years for somebody to want to see it first."); }
    else {
      await ctx.speak("hale", "Rows. Hanging. Humming in their sleep. Rods in holders. Grass on the deck. Nobody walking. Nobody. The sky is not a thing that wants. It is a thing that is left on.");
      await ctx.say("Shear is quiet for a long time.");
      await ctx.speak("shear", "Left on. Nobody. Forty years I have been cutting at something I thought was a hand. Blades. Put the saw down. This is between me and the tuner, and it is not about the Stay anymore.");
      alone = true;
      ctx.flag("c7_persuaded");
    }
    const r = await ctx.battle(alone ? "c7_boss_alone" : "c7_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c7_boss");
    ctx.refresh();
    ctx.beat(6);
    await ctx.say("Shear sits down on the last rung with the saw across both knees and looks at it for a long time. Then drops it. It falls for a count of nine before it hits the camp.");
    await ctx.speak("shear", "Forty years. Every one of them I could have climbed instead of cut. I kept telling myself nobody comes back down. You did not come back down. You came back UP, and the file did not");
    await ctx.speak("burl", "Did not.");
    await ctx.speak("shear", "...Go on, then. If there is nobody up there, go and tell them so. Tell Marrow the tuner from the next bench says she still leans.");
    await ctx.giveSlugs(120);
    await ctx.say("The Cut's war chest, which Shear says they will not be needing, and the saw, which Bob says is a very good saw.");
    await ctx.camp([
      { a: "fathom", b: "bob", lines: [["bob", "I measured the fall. Four hundred feet to the water. People do not survive that. That is not an opinion, it is a number."], ["fathom", "I did."], ["bob", "I know. I am going to have to measure it again. I do not like it when the numbers are wrong. I like it less when they are right and the person is standing there anyway."]] },
      { a: "sump", b: "bob", lines: [["sump", "You carry a weight on a string. It tells you which way is down. Hah."], ["bob", "Yes."], ["sump", "Everyone knows which way is down, bait. It is the way things fall."], ["bob", "Not up there. Up there, down is the one way the hook will not let you go."]] },
      { a: "lissom", b: "fathom", lines: [["lissom", "I did not speak for a day. Not grief. Fury. You went somewhere I could not follow. Three, four."], ["fathom", "I will teach you."], ["lissom", "You will not. You cannot teach falling. But you can teach the other thing, and I am going to make you."]] },
      { a: "hale", b: "fathom", lines: [["hale", "The well. This one thinks: that is what it is like. Up there. Hanging over something you cannot see. Waiting to be wanted."], ["fathom", "And?"], ["hale", "Nothing comes. Not for you either. Whole secret. Nothing comes."]] },
      { a: "burl", b: "dulcet", lines: [["dulcet", "Three notes. I said it in Rafter. You are three notes at once, knot."], ["burl", "Yes."], ["dulcet", "Who were they?"], ["burl", "Soon. Up there. Soon."]] },
    ]);
    ctx.beat(7);
    await ctx.say("Above the last rung there is only cable. The party climbs it. The held go up on their lines like beads on a string, and nothing reels them in. Fathom goes up on knots, one above the other, all the way into the cold.");
    ctx.flag("c7_done");
    await ctx.nextChapter();
  },
  rungs_top: async (ctx) => { await ctx.say("The top of the rungs. Above, the Stay goes on into cold that gets into the teeth."); },
  scrap_talk: scrapTalk,
};

export const ch7: Chapter = {
  n: 7,
  title: "The Stays",
  subtitle: "The ordeal",
  maps: [base, well, rungs],
  scripts,
  beats: ["The second Stay and the Cut's saw", "Shear will cut. Bob has not told them where.", "Up the rungs, with the camp below", "They cut the ladder. Fathom falls.", "The well. The knots. IT WILL COME TO THE DECK.", "Shear at the top of the rungs", "The saw dropped. Go and tell them so.", "Up the cable, into the cold"],
  goal: (g) => {
    const f = g.flags;
    if (f.c7_done) return "Up.";
    if (f.c7_boss) return "Rest, then climb past the last rung.";
    if (f.c7_back) return "Up the rungs. Shear is at the top with the saw.";
    if (f.c7_read) return "Tie off on the rock at the top of the well and climb.";
    if (f.c7_fell) return "Fathom is alone at the bottom of the well. The coil is there.";
    if (f.c7_bob) return "Climb the rungs on the Stay.";
    return "Talk to the surveyor by the cable, and to Shear.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 7", "The Stays", { beat: "Ordeal" });
    await ctx.teleport("stay_base", 12, 15, "up");
  },
  debugStart: { map: "stay_base", x: 12, y: 15, level: 19, flags: { c6_done: true } },
};
