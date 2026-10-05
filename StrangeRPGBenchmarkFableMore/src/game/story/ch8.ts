import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, THING, SCRAP_NPC, scrapTalk } from "./common";

const HOOK = (seed: string, a: "frost" | "lilac" | "white" | "sea", b: "frost" | "lilac" | "indigo" | "sea" | "slate") => THING(seed, a, b, "hand");

const deck: MapDef = {
  id: "loft_edge",
  name: "The deck",
  theme: "loft",
  music: "loft",
  musicSeed: "deck",
  caption: "The deck. Grass. Rods in holders. Nobody.",
  noLines: true,
  rows: [
    "                            ",
    "   GGGGGGGGGGGGGGGGGGGGGG   ",
    "   GFFFFFFFFFFFFFFFFFFFFG   ",
    "   GFFRFFFFFFFFFFFFFRFFFG   ",
    "   GFFFggFFFJJFFFFFggFFFG   ",
    "   GFFFFFFFFJJFFFFFFFFFFG   ",
    "   GFFRFFFFFFFFFFFFFRFFFG   ",
    "   GFFFFFFFFFFFFFFFFFFFFG   ",
    "   GFFFFFFFF  FFFFFFFFFFG   ",
    "   GFFFFFFFF  FFFFFFFFFFG   ",
    "   GFFFFFFFFGGFFFFFFFFFFG   ",
    "   GFFFFFFFFGGFFFFFFFFFFG   ",
    "   GGGGGGGGGGGGGGGGGGGGGG   ",
    "            KK              ",
  ],
  line: [[12, 13], [12, 9], [12, 6], [12, 3]],
  npcs: [
    { id: "drone1", x: 6, y: 5, sprite: THING("custody_drone", "frost", "amber"), name: "A baiting drone", held: false, talk: "drone", wander: true },
    { id: "sleeper1", x: 19, y: 7, sprite: P("sleeper1", "bone", "lilac", "slack"), name: "Someone walking in their sleep", held: false, talk: "sleepwalker", wander: true },
  ],
  triggers: [
    { id: "edge_in", x: 11, y: 10, w: 3, h: 2, on: "enter", once: true },
    { id: "deck_chair", x: 12, y: 5, w: 2, on: "interact" },
    { id: "deck_rod1", x: 6, y: 3, on: "interact" },
    { id: "deck_rod2", x: 19, y: 6, on: "interact" },
    { id: "deck_grass", x: 7, y: 9, on: "interact" },
  ],
  exits: [{ x: 12, y: 2, w: 1, to: "hands_hall", tx: 10, ty: 16, facing: "up" }],
  wander: [{ groups: ["c8_fingers", "c8_frost", "c8_drones"], count: 2, x: 5, y: 3, w: 16, h: 8, sprite: THING("grip_finger", "frost", "slate", "pillar") }],
  chests: [{ id: "e_chest1", x: 5, y: 3, item: "coldash", count: 2, slugs: 80 }],
};

const hold: MapDef = {
  id: "hands_hall",
  name: "The hold",
  theme: "loft",
  music: "loft",
  musicSeed: "hold",
  caption: "The hold. The catch hangs in rows and hums in its sleep.",
  noLines: true,
  rows: [
    "GGGGGGGGGGGGGGGGGGGGG",
    "GFFFFFFFFDFFFFFFFFFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFHFFHFFHFFHFFHFFHFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFHFFHFFHFFHFFHFFHFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFHFFHFFHFFHFFHFFHFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFHFFHFFHFFHFFHFFHFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFFFFFFFFFVFFFFFFFFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GFFFFFFFFFFFFFFFFFFFG",
    "GGGGGGGGGGGGGGGGGGGGG",
  ],
  line: [[10, 17], [10, 10], [10, 5], [10, 2]],
  npcs: [
    { id: "marrow_hang", x: 10, y: 5, sprite: P("marrow_sleep", "frost", "lilac", "robe"), name: "A sleeper", held: true, talk: "marrow_talk", hideIf: "c8_marrow" },
    { id: "mell_hang", x: 4, y: 8, sprite: P("singer2", "bone", "plum"), name: "A sleeper", held: true, talk: "mell_hang" },
    { id: "sleep_b", x: 16, y: 8, sprite: P("sleep_b", "bone", "sea"), name: "A sleeper", held: true, talk: "sleep_b" },
    { id: "sleep_c", x: 7, y: 13, sprite: P("sleep_c", "bone", "indigo"), name: "A sleeper", held: true, talk: "sleep_c" },
    { id: "sleep_d", x: 13, y: 13, sprite: P("sleep_d", "bone", "lilac", "robe"), name: "A sleeper", held: true, talk: "sleep_d" },
    { id: "first_hook_npc", x: 10, y: 2, sprite: HOOK("first_hand", "white", "indigo"), name: "The First Hook", held: false, talk: "firsthook", showIf: "c8_marrow", hideIf: "c8_boss" },
    SCRAP_NPC(2, 15),
  ],
  triggers: [
    { id: "hall_in", x: 9, y: 15, w: 3, h: 2, on: "enter", once: true },
    { id: "hall_gate", x: 9, y: 1, w: 3, h: 1, on: "enter", showIf: "c8_boss", hideIf: "c8_done" },
    { id: "hold_log", x: 18, y: 2, on: "interact" },
  ],
  exits: [
    { x: 10, y: 17, to: "loft_edge", tx: 12, ty: 3, facing: "down" },
  ],
  wander: [{ groups: ["c8_sentry", "c8_tired", "c8_frost"], count: 2, x: 2, y: 3, w: 17, h: 11, sprite: THING("lattice_sentry", "slate", "gold"), hideIf: "c8_boss" }],
  chests: [{ id: "h_chest1", x: 2, y: 16, item: "w_frostbead", count: 1 }],
};

// ---------------------------------------------------------------------------

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  edge_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("The Stay ends in a deck. Grass on it, long and gray, bending in a wind that is not Gust. Rods, taller than the Spindle, standing in holders along the rail. Chairs the size of houses. Through gaps in the planking, lines go down. Thousands. Millions. Every line on the Drop goes down through this floor.");
    await ctx.speak("hale", "Here before. In a box, on a drone. The grass. Nobody. This one remembers.");
    await ctx.say("Nobody. The chairs are empty. The rods stand in their holders with their lines run out. Whoever sat here stood up a very long time ago and did not come back, and the rods have been fishing without them.");
    await ctx.speak("burl", "Home. Three hooks. Home.");
    await ctx.say("Here the lines do not go up. They go down. The held party stands on the thing that holds them and it feels, Lissom says, like standing on your own hand, if your hand were a boat.");
  },
  drone: async (ctx) => { await ctx.speak("drone1", "WELCOME ABOARD. YOU ARE NOT CATCH. THE NEXT LIFT IS IN NINE MONTHS. PLEASE RETURN TO YOUR TOWN AND HUM. THANK YOU FOR YOUR TENSION."); },
  sleepwalker: async (ctx) => { await ctx.say("Somebody from the hold, walking the deck in their sleep, humming a note from a town Fathom has never heard of, eyes shut, hook still in. They walk to the rail, and back, and to the rail. They have done this for a long time."); },
  deck_chair: async (ctx) => {
    await ctx.say("A chair the size of a house, facing the rail. Its cushion is grass. On the arm, where a hand would rest, there is no wear at all. Nobody has ever sat in it. It was built for somebody and the somebody never came.");
    if (!ctx.has("c8_chair")) { ctx.flag("c8_chair"); await ctx.say("Under the chair, where the grass is thin, a hook the size of a plough, polished, never set."); await ctx.give("l_hook"); }
  },
  deck_rod1: async (ctx) => { await ctx.say("A rod in its holder. The line runs down through the deck and hums: a whole town's hum, up through one rod. Carved into the butt, in knot-shapes: RAFTER. A bell is wired to the tip. It has not rung."); },
  deck_rod2: async (ctx) => { await ctx.say("A rod. HEM, says the butt. The line hums two hundred and eleven notes. The bell on the tip is swinging, very slightly. Somebody in Hem is leaning."); },
  deck_grass: async (ctx) => { await ctx.say("Grass. Gray, long, seeded from nowhere Fathom knows. In it, a cup. A cup for a hand the size of a door, with a tide mark inside where something was drunk nine hundred years ago and never refilled."); },

  hall_in: async (ctx) => {
    ctx.beat(1);
    await ctx.say("The hold. Rows of them, each one hanging by the hook in the back, each one humming the note of the town they were bitten in, asleep. Fish hang among them, hooked through the jaw, also asleep, also humming, if a Fish can hum. Nothing is tending them. A drone goes by now and then and straightens one.");
    await ctx.speak("dulcet", "I can hear Hem. There. That row. I tuned beside those lines for a week, Fathom. Every Lift since the first is hanging in this room, alive, waiting to be re-baited. One of these is yours.");
  },
  mell_hang: async (ctx) => {
    await ctx.say("Mell. From the choir. Hanging by the hook, eyes shut, humming her E. There is frost in her hair already. She leaned, in the end, and the sky took the lean.");
    if (ctx.has("c8_marrow") && !ctx.errandDone("mell")) {
      const i = await ctx.choose(["Unhook her", "Leave her sleeping"], { cancel: true });
      if (i === 0) { ctx.errand("mell"); await ctx.say("Fathom works the hook out the way Marrow showed. Mell opens her eyes, says 'Dace was looking at me,' and sits down on the deck of a boat the size of the sky and does not ask where she is, because she is from Hem, and Hem does not ask."); await ctx.speak("singer2", "Fathom. Did I win? Did I rise? Everyone had money on me."); await ctx.say("Fathom tells her yes."); await ctx.giveSlugs(50); }
    }
  },
  sleep_b: async (ctx) => { await ctx.say("A man from the Snarl, by the note. The only person ever bitten out of the nest, sixty-one years ago, the spring before the wedding. He is humming a D. He is also, faintly, keeping time with one foot."); },
  sleep_c: async (ctx) => { await ctx.say("Somebody very old, from a town with no name Fathom knows, humming a note no choir uses anymore. The first Lift. Nine hundred years asleep on a hook. There is grass growing on their shoulders."); },
  sleep_d: async (ctx) => { await ctx.say("A Leveler, in robes, hanging like the rest. Shore crew get Chosen too. The sky does not read uniforms. Pinned to the robe, a note in knots that Fathom can almost read: RETURN IN SPRING. BRACK."); },
  hold_log: async (ctx) => {
    if (ctx.has("c8_log")) { await ctx.say("The log. Pages and pages of knots. Fathom's own page is near the end and stops where Fathom is standing."); return; }
    ctx.flag("c8_log");
    await ctx.say("A book the size of a door, open on a stand, written in knots. The file. Every town, every year, every bite. It writes itself. A pen on a wire moves while Fathom watches, tying a knot that says, as near as Fathom can read it, HOLD: 4. DECK.");
    await ctx.say("Fathom turns to the party's pages. BURL: KNOT. THREE HOOKS. NO BITE ON RECORD. DULCET: RAFTER 4. CUT. LURE-HANDLER. LISSOM: NEST. NO BITE. HALE: BRACK 60. RETURNED. GUST: WIND. HOOKED IN ERROR. SUMP: NOT CATCH. BOB: SHELVES. NO BITE ON RECORD.");
    await ctx.say("No bite on record. Burl and Bob have never hung from a rod, so the file has nothing to tally for them. It knew their names anyway. Fathom tears the page out. The pen keeps writing on the stand where the page was.");
    await ctx.give("k_letter");
  },
  marrow_talk: async (ctx) => {
    ctx.beat(2);
    await ctx.say("One sleeper is awake. Or nearly. Hanging by the hook in the Hem row, frost on her, humming nothing, eyes open a crack and looking at Fathom with no surprise at all.");
    await ctx.say("'Fathom,' she says. 'You lean.'", { speaker: "A sleeper" });
    await ctx.say("Fathom does not say anything for a long time.");
    await ctx.say("'Hold still. Let me look at you. Fourteen years. You tune the choir, don't you. You tune it the way I did, with slugs. I can hear it from here, every Lift, two hundred and twelve notes and one of them is you making them louder. Stop that, when you get home.'", { speaker: "The sleeper" });
    await ctx.speak("marrow", "I was bitten when you were six. I have hung here since. I am awake because this hook is loose and I have been working it looser for fourteen years with my shoulder, which is a long time to do one thing. Take it out. Gently. There is a trick to it.");
    ctx.beat(3);
    await ctx.say("Fathom works the hook out the way she says. She comes down onto the deck on her own feet, which have not touched anything in fourteen years, and does not fall.");
    await ctx.speak("marrow", "Now. Listen. Nobody is fishing. The Reel is behind that door and it turns because it turns. The file writes because a pen is on a wire. The rods fish because they were left in holders. This is a boat that somebody walked away from, and we have been its bait for nine hundred years out of habit. Its habit.");
    await ctx.speak("marrow", "I can walk for one day. The hook was in a long time. Let me come as far as the Reel. There is a thing I know how to do to a hook, and I want to do it to that one.");
    await ctx.join("marrow");
    ctx.flag("c8_marrow");
    ctx.refresh();
    await ctx.say("Marrow can let go of an ally's line in a fight. Their tension becomes healing, and for the rest of that fight they are slack: no Pluck, no Lift, and they can Duck. Any held member can Let Go on their own from now on.");
    await ctx.speak("burl", "Marrow. Three hooks. One knot. Came down the Hem rod with the scrap. Three Lifts of cut line. Hooks still in. You plucked us. Six, you were. In the square. You said: three.");
    await ctx.speak("marrow", "Oh. The knot by the well. The one that sounded like three. I thought I had made you up. Come here. No. Stay there, you have hooks in you, I know what those do.");
    ctx.setGoal("The First Hook stands at the north door. The Reel is beyond it.");
  },
  firsthook: async (ctx) => {
    ctx.beat(5);
    await ctx.say("At the north door stands the First Hook: the first hook the Reel ever set, polished by nine hundred years of catch sliding down it. It has caught more than anything that has ever existed and nothing has caught it. It does not speak. It is a hook.");
    await ctx.speak("marrow", "Stand behind me. It is set, and nothing it caught was ever awake to unset it. We are awake. Pull.");
    const r = await ctx.battle("c8_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c8_boss");
    ctx.refresh();
    ctx.beat(6);
    await ctx.say("The First Hook comes out of the door the way a hook comes out of a fish: not at all for a long time, and then with a sound. It falls on the deck and lies there, in nothing.");
    await ctx.say("Where it stood there is a stretch of line with knots in it: Fathom's line, the end of it, the part that was tied first.");
    await ctx.knot("m8", "FATHOM BURL DULCET LISSOM HALE GUST SUMP BOB", "Marrow");
    await ctx.speak("marrow", "Look. Everyone, in order. Written before Hem. Written before you were cut. It knew who you would bring.");
    await ctx.say("Marrow's fingers go on down the line past the last name. They stop. They go on. There is nothing there. Plain line, all the way to the end.");
    await ctx.speak("marrow", "Nothing. Feel it. Blank past here. It wrote everything up to this door and it has not written what you do next. For the first time in nine hundred years, something on this boat does not know.");
    await ctx.camp([
      { a: "marrow", b: "fathom", lines: [["marrow", "You lean. You still lean. Stand up straight. No. Don't. I only said that because I was told to say it. Lean."], ["fathom", "I know."], ["marrow", "Then lean. It is the last thing I will ask. I am going to ask several more things."]] },
      { a: "marrow", b: "burl", lines: [["burl", "Three Lifts. Three hooks. Who were we?"], ["marrow", "I do not know. The hooks are from before the ledgers. Does it matter?"], ["burl", "No. One knot now. It suits. Three hooks, one knot, one Marrow, one Fathom."]] },
      { a: "marrow", b: "hale", lines: [["hale", "One of the hooks let go of this one. On purpose?"], ["marrow", "Nothing up here does anything on purpose. The hook was tired. Hooks get tired. That is all it was."], ["hale", "...Good. Mercy would be worse."]] },
      { a: "dulcet", b: "marrow", lines: [["dulcet", "I am blind. What does the deck look like?"], ["marrow", "Like somebody's garden, after they died. Grass, and chairs, and the rods still out."], ["dulcet", "That is what it sounds like."]] },
      { a: "bob", b: "marrow", lines: [["bob", "How far is it to the Drop from here? I would like a number."], ["marrow", "Nine hundred and twelve miles of line."], ["bob", "Thank you. I measured nine hundred and twelve from the bottom. It is good to have it from both ends."]] },
    ]);
    ctx.beat(7);
    await ctx.say("Beyond the door, the Reel is turning. The party's lines, every one, are about to go slack for good. Marrow goes first, because she knows the trick with hooks.");
    ctx.flag("c8_done");
    await ctx.nextChapter();
  },
  hall_gate: async (ctx) => { await ctx.say("The north door. Beyond it, the Reel."); },
  scrap_talk: scrapTalk,
};

export const ch8: Chapter = {
  n: 8,
  title: "The Deck",
  subtitle: "Reward, and the road back",
  maps: [deck, hold],
  scripts,
  beats: ["The deck. Grass. Rods. Nobody.", "The hold, where the catch hangs and hums", "A sleeper with her eyes open", "Marrow, unhooked for one day", "The log: everyone in the party, by name. Then blank.", "The First Hook at the door", "Marrow reads the last names. Past them, nothing.", "Beyond the door, the Reel"],
  goal: (g) => {
    const f = g.flags;
    if (f.c8_done) return "Through the north door.";
    if (f.c8_boss) return "Rest, then go through the north door.";
    if (f.c8_marrow) return "The First Hook stands at the north door. The Reel is beyond it.";
    return "Find the sleeper who is awake, in the hold to the north.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 8", "The Deck", { beat: "Reward" });
    await ctx.teleport("loft_edge", 12, 11, "up");
  },
  debugStart: { map: "loft_edge", x: 12, y: 11, level: 22, flags: { c7_done: true } },
};
