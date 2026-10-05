import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, KNOT, THING } from "./common";

const HOOK = (seed: string, a: "frost" | "white", b: "blood" | "slate") => THING(seed, a, b, "hand");

const reel: MapDef = {
  id: "grip",
  name: "The Reel",
  theme: "loft",
  music: "boss",
  musicSeed: "reelmap",
  caption: "The Reel. It turns because it turns.",
  noLines: true,
  rows: [
    "GGGGGGGGGGGGGGGGGGGG",
    "GFFFFFFFFFFFFFFFFFFG",
    "GFFFFFFgggggFFFFFFFG",
    "GFFFFFggFFFggFFFFFFG",
    "GFFFFggFFFFFggFFFFFG",
    "GFFFFgFFFFFFFgFFFFFG",
    "GFFFFgFFFFFFFgFFFFFG",
    "GFFFFggFFFFFggFFFFFG",
    "GFFFFFggFFFggFFFFFFG",
    "GFFFFFFgg.ggFFFFFFFG",
    "GFFFFFFFF.FFFFFFFFFG",
    "GFFFFFFFF.FFFFFFFFFG",
    "GFFFFFFFF.FFFFFFFFFG",
    "GFFFFFFFFDFFFFFFFFFG",
    "GGGGGGGGGGGGGGGGGGGG",
  ],
  npcs: [
    { id: "grip_npc", x: 9, y: 5, sprite: HOOK("the_grip", "white", "blood"), name: "The Reel", held: false, talk: "grip_talk", showIf: "c9_palm2", hideIf: "c9_boss" },
    { id: "palm1", x: 6, y: 10, sprite: HOOK("palm1", "white", "slate"), name: "A drum of the Reel", held: false, talk: "palm", hideIf: "c9_palm1" },
    { id: "palm2", x: 12, y: 10, sprite: HOOK("palm2", "white", "slate"), name: "A drum of the Reel", held: false, talk: "palm2", hideIf: "c9_palm2" },
  ],
  triggers: [
    { id: "grip_in", x: 8, y: 12, w: 3, h: 1, on: "enter", once: true },
    { id: "grip_approach", x: 9, y: 9, on: "enter", once: true, showIf: "c9_palm2" },
    { id: "grip_wall", x: 2, y: 6, on: "interact" },
  ],
  exits: [{ x: 9, y: 13, to: "hands_hall", tx: 10, ty: 2, facing: "down", needs: "never", blocked: "The door behind has closed. The Reel does not let go of rooms either." }],
};

const hemNight: MapDef = {
  id: "hem_night",
  name: "Hem, after",
  theme: "night",
  music: "slack",
  musicSeed: "hemnight",
  caption: "Hem. After.",
  noLines: true,
  marks: [{ kind: "crack", x: 15, y: 10 }],
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
  npcs: [
    { id: "wren2", x: 9, y: 11, sprite: P("wren", "sand", "rose", "slack"), name: "Wren", held: false, talk: "wren2", wander: true },
    { id: "ansel2", x: 11, y: 8, sprite: P("ansel", "white", "gold", "robe"), name: "Ansel", held: false, talk: "ansel2" },
    { id: "ostle2", x: 23, y: 15, sprite: P("ostle", "clay", "violet", "hat"), name: "Grandmother Ostle", held: false, talk: "ostle2" },
    { id: "fen2", x: 14, y: 9, sprite: P("mourner", "bone", "ash", "robe"), name: "Old Fen", held: false, talk: "fen2" },
    { id: "kid3", x: 5, y: 17, sprite: P("kid", "sand", "sky", "small"), name: "Nib", held: false, talk: "kid3", wander: true },
    { id: "singer5", x: 16, y: 11, sprite: P("singer1", "bone", "sea", "slack"), name: "Hob", held: false, talk: "hob2" },
    { id: "returned1", x: 7, y: 5, sprite: P("returned1", "frost", "lilac", "slack"), name: "Someone asleep on the grass", held: false, talk: "returned", showIf: "end_silence" },
    { id: "returned2", x: 20, y: 17, sprite: P("returned2", "frost", "sea", "slack"), name: "Someone asleep on the grass", held: false, talk: "returned", showIf: "end_silence" },
    { id: "lobe_hem", x: 24, y: 5, sprite: { kind: "creature", seed: "lobechild", a: "plum", b: "sand" }, name: "A small lobe", held: false, talk: "lobehem", showIf: "end_silence", wander: true },
    { id: "measurer2", x: 8, y: 5, sprite: P("measurer", "white", "slate", "frame"), name: "The Measurer", held: true, talk: "measurer2", showIf: "end_catch" },
    { id: "marrowknot", x: 11, y: 10, sprite: KNOT("marrow", "frost", "lilac"), name: "A small knot", held: false, talk: "marrowknot", showIf: "end_silence" },
  ],
  triggers: [
    { id: "night_in", x: 10, y: 9, w: 3, h: 3, on: "enter", once: true },
    { id: "night_bell", x: 11, y: 9, on: "interact", showIf: "c9_spoke" },
  ],
  exits: [],
};

// ---------------------------------------------------------------------------

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  grip_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("The door shuts behind them. The room is a drum, turning. Not a room with a reel in it: the floor is the spool and the walls are the pawls and they click, slowly, the way they have been clicking for nine hundred years, letting line out and never letting it back.");
    await ctx.say("Every line in the party goes slack at once. Marrow did it, with the trick. Dulcet, Lissom, Gust, Hale, Burl: their lines lie on the frost like dropped string. Nobody is held. Nobody is humming. Nothing can hear them.");
    await ctx.speak("marrow", "It will try to set a hook in you. One at a time. If it gets one of you, hit their line, hard. A plain blow will do. The hook comes out and they are yours again.");
    if (ctx.twoPlayer()) await ctx.hand("Someone is still holding. Not from the deck. From outside the square. Keep them steady.");
    await ctx.speak("sump", "Everyone is quiet. Everyone is like me. Hah. It took nine hundred years and a boat the size of the sky. Welcome, bait.");
    ctx.setGoal("The Reel is at the center of the room. Its drums stand between.");
  },
  grip_wall: async (ctx) => { await ctx.say("The wall of the drum. Scratched into it from inside, in knots, in a hand that is not the file's: nine hundred years of tally marks. Somebody counted turns. Somebody in here was awake once."); },
  palm: async (ctx) => {
    ctx.beat(2);
    await ctx.say("A drum of the Reel, wide enough to wind a town. It reaches for the nearest slack line on the floor and sets a hook.");
    const r = await ctx.battle("c9_palm", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c9_palm1");
    ctx.refresh();
    await ctx.say("The drum stops. The lines it took lie on the frost again, loose, and nothing is listening to them. The party sits on the stopped drum and breathes.");
    ctx.rest();
  },
  palm2: async (ctx) => {
    await ctx.say("The second drum. It has learned nothing from the first. The Reel does not learn. It turns.");
    const r = await ctx.battle("c9_knuckles", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c9_palm2");
    ctx.refresh();
    await ctx.say("The second drum stops. Between the two stopped drums the floor is still, and the party sits on it, and nothing reaches for them.");
    ctx.rest();
  },
  grip_approach: async (ctx) => {
    ctx.beat(3);
    await ctx.say("The Reel looks down. It is white and it turns and it has one motion, and the motion is coming apart because for the first time, in this room, there is nothing on the line.");
    await ctx.speak("marrow", "It was built to reel. Nobody built the part that stops. We are the part that stops. Go on, Fathom. Nothing has written what you do next. Show it.");
  },
  grip_talk: async (ctx) => {
    ctx.beat(5);
    await ctx.say("The Reel turns.");
    const r = await ctx.battle("c9_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c9_boss");
    ctx.refresh();
    await theChoice(ctx);
  },

  night_in: async (ctx) => {
    ctx.beat(7);
    if (ctx.has("end_silence")) {
      await ctx.say("Hem. The square. Everyone is sitting on the ground, which nobody in Hem has ever done. Nobody is humming. The sky is clear in a way it has never been: no ribs, no drips, no lines. There are stars. Nobody knew there were stars. The Hull hid them.");
      await ctx.say("On the grass by the well, two people Fathom does not know are asleep, with frost in their hair and no hooks in their backs. They came down on their own lines in the night as the deck drifted off, and landed here, in a town that was not theirs, like Hale did. Every town on the Drop woke up to strangers on the grass.");
    } else {
      await ctx.say("Hem. The square. Everyone is standing, humming, lines going up into the dark, the way they always have. Nobody knows anything happened. Something did. The rod marked HEM has a hand on it now.");
    }
    await ctx.speak("wren2", ctx.has("end_silence") ? "Fathom. FATHOM. My line fell in the night and then everyone's did and Ansel sat down in the square and nobody has been bitten and there is a LOBE eating the goat's bread and I do not know what any of it means." : "Fathom. You came back. Nobody comes back. Mell did, this morning, on a fresh line, asleep, over Pim's. She says she won.");
    await ctx.say("Wren runs over and hugs Fathom, which tangles nothing. Wren does not let go for a while. Then does.");
    ctx.flag("c9_spoke");
    ctx.setGoal("Hem, after. Talk to people. Ring the bell when you are ready.");
  },
  wren2: async (ctx) => { await ctx.speak("wren2", ctx.has("end_silence") ? "I rang the bell this morning out of habit. The choir sang. Nobody plucked anyone. Nothing came. It was awful and I loved it. Ring it again, Fathom. For the end." : "I rang the bell this morning. The choir sang. Mell leaned, and nothing came for her, and Ansel looked at you. Ring it again, Fathom. For the end."); },
  ansel2: async (ctx) => { await ctx.speak("ansel2", ctx.has("end_silence") ? "I have stood plumb for sixty years for a boat. I watched it go this morning. Nobody looked over the rail. I sat on the ground after. The ground is cold. I think I will stay a while. The ledgers are in the cellar. Burn them or read them, I do not mind which." : "You went up, and now the line is tighter, tuner. Every Leveler on the Drop can feel it. It is tighter in a direction. Whose hand is on the Hem rod?"); },
  ostle2: async (ctx) => { await ctx.speak("ostle2", ctx.has("end_silence") ? "Cut it, see if it runs, I read. It ran. It ran all the way up and cut the boat loose. Child, the knots on your line were never a leash. They were a dare." : "The knots said it would come to the deck. They did not say it would sit down. Child, whatever you are now, come and tell me what the file looks like from the inside. I would like to read it one more time."); },
  fen2: async (ctx) => { await ctx.speak("fen2", ctx.has("end_silence") ? "My sister came down in the night. On her own line. She is asleep on the grass by the well, forty years older, with frost in her hair. I have been sitting with her. She tied her hair in a knot. She is still my sister." : "I was glad for forty years. I am going to stop. Whoever is on the rod now: if it is you, tuner, send her back. If it is you, you can."); },
  returned: async (ctx) => { await ctx.say("Somebody asleep on the grass, frost in their hair, humming a note from a town Fathom has never heard of. They came down in the night. They will wake up in Hem and not know it, and Hem will feed them.", { speaker: "A sleeper" }); },
  lobehem: async (ctx) => { await ctx.say("A lobe the size of a loaf, in the square in Hem, eating the goat's bread. The goat is watching it. The goat looks, for the first time in its life, at something instead of up."); },
  measurer2: async (ctx) => { await ctx.speak("measurer2", "Stand still. The weight hangs. The line is true. The Office has received the Spring Line and it says: HEM 213. It is in a new hand. The Office does not know whose. The Office is, for the first time, afraid."); },
  kid3: async (ctx) => { await ctx.speak("kid3", ctx.has("end_silence") ? "I went under a TABLE. There is nothing under a table. I am going under EVERYTHING. The lobe says there is bread under things if you know where." : "I leaned today and nothing happened. The goat leaned. Nothing happened to the goat either. Did you do that? Did you do that from up there?"); },
  hob2: async (ctx) => { await ctx.speak("singer5", ctx.has("end_silence") ? "We sang this morning with nobody plucking. Just mouths. Mell leaned. Nothing came. It was in tune anyway. How is that possible?" : "We sang this morning and the line was tight, Fathom. Tighter than Lift day. Something is holding. Something new. It feels like... it feels like being looked at by someone who knows your name."); },
  marrowknot: async (ctx) => {
    await ctx.say("A small knot, frost colored, sitting where the choir used to stand. A hook in it. It is not rolling. It is waiting.");
    await ctx.say("'Lean,' it says.", { speaker: "A small knot" });
    await ctx.say("Fathom sits down on the ground next to it, and leans.");
  },
  night_bell: async (ctx) => {
    ctx.sfx("bell");
    await ctx.fx("bell", 11, 9);
    const silence = ctx.has("end_silence");
    const quietTowns = ctx.g.taught.length;
    if (silence) {
      await ctx.say("Fathom rings the Hem bell. Across the Drop, in Rafter and the Snarl and Wheelstead and on the shelves, people who have been sitting on the ground all morning stand up, because somebody showed them how, once, on a line that went where it led.");
      if (quietTowns >= 4) await ctx.say(`${quietTowns} towns learned to be quiet before the morning came. They stood first. The ones beside them watched, and stood. Nobody hummed. Nothing came.`);
      else if (quietTowns > 0) await ctx.say(`${quietTowns} town${quietTowns === 1 ? "" : "s"} learned to be quiet before the morning came. The rest hummed out of habit, for a while, until they noticed that nothing was listening, and then they stopped, one by one, like a choir after the bell.`);
      else await ctx.say("No town had learned to be quiet before the morning came. They hummed out of habit, for a while, until they noticed that nothing was listening, and then they stopped, one by one, like a choir after the bell.");
      await ctx.say("There is no music. There has never been no music. Fathom listens to it for a long time.");
      ctx.stopMusic();
    } else {
      await ctx.say("Fathom rings the Hem bell. Across the Drop every line goes tight, once, the way a line does when the hand on the rod shifts its grip. Then they ease. The choirs sing. The Lift will come in spring, and this time somebody will choose.");
      await ctx.say("In Hem, in the cellar under the Office, the cable takes a new knot, tied in a new hand. HEM 213. The hand leans.");
    }
    await ctx.say("The last knots in the fallen line were tied at the very end, where the pen stopped. Fathom reads them alone, in the square.");
    await ctx.knot("m9", "", "Fathom");
    await ctx.ending(silence ? "silence" : "catch");
    await ctx.card(silence ? "Silence" : "The Catch", "Plumb", { beat: "Return" });
    await ctx.say(silence ? "Everything is bait for something. Fathom stopped being bait by being quiet, and found out what the quiet was for." : "Everything is bait for something. Fathom stopped being bait by taking the rod, and found out what the rod was for.", { speaker: "Plumb" });
    const i = await ctx.choose(["Keep a line from Fathom", "Just the stars"], { title: "Before you go" });
    if (i === 0) {
      ctx.letter(["TO WHOEVER IS HOLDING THIS", silence ? "NOBODY IS FISHING" : "HEM 213", "FATHOM OF HEM", silence ? "IT CHOSE SILENCE" : "IT CHOSE THE ROD"]);
      await ctx.say("A line from Fathom, in knots, is saved beside the game. The knot key on the title screen reads it. The last thing the file could not write is in your pocket now, if you want to say it at the title. Thank you for playing.");
    } else {
      await ctx.say("The stars, then. They were there the whole time, over the Hull. The last thing the file could not write is a password, and the knots on the title screen know it. Thank you for playing.");
    }
    ctx.flag("c9_done");
    await ctx.nextChapter();
  },
};

async function theChoice(ctx: ScriptContext): Promise<void> {
  ctx.beat(6);
  await ctx.say("The Reel stops.");
  await ctx.say("Not broken. Stopped. Marrow puts her hand, which has not touched anything in fourteen years, on the pawl, and the pawl, which has only ever turned one way, finds that it can also not turn. The whole boat goes quiet. The hum of a million lines fades out of the deck like a tide going out.");
  await ctx.speak("marrow", "Now. Here is the chair. Here is the saw. Here is nobody. Fathom, nothing has written this part. I am going to go and sit down in the hold with the others, because the hook was in a long time and I am tired. Whatever you do, do it with your own hands.");
  await ctx.say("The party stands in the stopped Reel. Through the floor, the Drop hangs on four cables. On the deck, a chair the size of a house faces the rail, with a rod in front of it marked HEM, and nobody has ever sat in it.");
  const i = await ctx.choose(["Cut the Stays. Let the boat drift. Silence.", "Sit in the chair. Take the rod. The Catch."], { title: "Fathom chooses" });
  if (i === 0) {
    ctx.flag("end_silence");
    await ctx.say("Fathom takes Shear's saw to the couplings on the deck, one by one. Bob counts the strokes. Sump laughs the whole time. Marrow comes back from the hold door and puts both hands on the pawl. At the fourth coupling the deck lurches, and Marrow lifts the pawl, and the spool runs free.");
    ctx.tabTitle("slack");
    ctx.pageLetGo();
    await ctx.flash();
    await ctx.say("The sky drifts. Up, away, slow as a cloud, grass and rods and the hold with its doors open. Every line on the Drop runs out behind it and falls slack on the same morning. The sleepers in the hold come down on their own lines as the spool pays out, thousands of them, and land in whatever town is under them, asleep, and nobody is holding anyone.");
    await ctx.say("Far below, the Drop sinks a few feet onto the shelves and stops. For the first time it is resting on something.");
    await ctx.speak("marrow", "I am staying. The hold is going wherever the boat goes and I want to see where that is. I will be small, in the square, a knot with a hook in it. Lean on me.");
    await ctx.speak("burl", "Come down, Marrow. The ground is good. The ground is where everything is.");
    await ctx.speak("marrow", "The ground is where YOU are, knot. That is not the same thing. Look after the leaner.");
  } else {
    ctx.flag("end_catch");
    await ctx.say("Fathom walks out onto the deck and sits in the chair. It fits. The rod marked HEM is in front of it, and Fathom takes it in both hands, and two hundred and eleven lines go tight, once, the way they do when the hand on them shifts.");
    ctx.tabTitle("HEM 213");
    ctx.pageTight();
    await ctx.flash();
    await ctx.say("The Reel starts again, slowly, because Fathom lets it. The pen on the wire starts again, in a new hand. The Lift will come in spring, and somebody will choose who, and it will be a tuner from Hem, who knows every note in the choir and which ones lean.");
    await ctx.speak("marrow", "You chose the rod. I am not going to tell you it was wrong. I am going to go and hang up with the others, and hum, and you are going to hear me every Lift day, and you are going to have to decide. Every spring. I never did, and look at me.");
    await ctx.speak("burl", "Three hooks. One knot. One Fathom on the rod. Hm. I will stay down. Somebody should.");
  }
  ctx.leave("marrow");
  await ctx.say(i === 0 ? "The party rides the second Stay down as it falls, slow as a feather, because nine hundred miles of line are tangled in it and it comes down like a sail. It takes a day." : "A drone takes the party down to Hem on fresh lines, politely, the way it has always done. It takes an hour. Fathom's line hums all the way, for the first time in a year, and Fathom knows exactly what is on the other end of it.");
  await ctx.fadeOut();
  ctx.g.active = ["fathom", ...ctx.g.roster.filter((id) => id !== "fathom" && id !== "marrow").slice(-3)];
  ctx.rest();
  await ctx.teleport("hem_night", 11, 12, "up");
  if (i === 0) ctx.stopMusic();
}

export const ch9: Chapter = {
  n: 9,
  title: "The Reel",
  subtitle: "Resurrection, and the return",
  maps: [reel, hemNight],
  scripts,
  beats: ["In the Reel. Every line slack.", "It sets hooks one at a time", "The drums, then the center", "A machine with one motion, coming apart", "Nothing on the line, for the first time", "The Reel turns", "The Reel stops. The chair. The saw. Fathom chooses.", "Hem, after"],
  goal: (g) => {
    const f = g.flags;
    if (f.c9_done) return "The end.";
    if (f.c9_boss) return "Hem, after. Talk to people. Ring the bell when you are ready.";
    if (f.c9_palm2) return "The Reel is at the center of the room.";
    if (f.c9_palm1) return "The second drum stands to the east.";
    return "The Reel's drums stand between you and the center.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 9", "The Reel", { beat: "Resurrection" });
    await ctx.teleport("grip", 9, 12, "up");
  },
  debugStart: { map: "grip", x: 9, y: 12, level: 25, flags: { c8_done: true } },
};
