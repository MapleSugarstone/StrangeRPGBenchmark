import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, SCRAP_NPC, scrapTalk, hooking, inn, bounty } from "./common";

const road: MapDef = {
  id: "letout_road",
  name: "The dry road",
  theme: "letout",
  music: "road",
  musicSeed: "dryroad",
  caption: "Dry country. Something tall turns on the horizon.",
  rows: [
    "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "T....r.......................T",
    "T..........b.........r.......T",
    "T......x.....................T",
    "T.............r.........b....T",
    "T............................T",
    "..............................",
    "T.......b.........x..........T",
    "T...r........................T",
    "T..........r.........b...w...T",
    "T............................T",
    "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
  ],
  line: [[0, 6], [7, 6], [12, 5], [18, 6], [24, 7], [29, 6]],
  npcs: [
    { id: "peddler", x: 15, y: 3, sprite: P("peddler", "gold", "ink", "hat"), name: "A peddler", note: "F", talk: "peddler", wander: true },
    { id: "cairn", x: 5, y: 8, sprite: { kind: "tile", seed: "cairn", variant: "bones", a: "bone", b: "ash" }, name: "A cairn", held: false, talk: "cairn", solid: true },
  ],
  triggers: [
    { id: "dry_in", x: 1, y: 5, w: 2, h: 3, on: "enter", once: true },
    { id: "dry_well", x: 25, y: 9, on: "interact" },
  ],
  exits: [
    { x: 0, y: 6, to: "snarl", tx: 26, ty: 14, facing: "left", needs: "never", blocked: "The Eastgate has settled shut again behind you." },
    { x: 29, y: 6, to: "letout", tx: 1, ty: 20, facing: "right" },
  ],
  wander: [{ groups: ["c4_brokers", "c4_crows"], count: 2, x: 4, y: 1, w: 22, h: 9, sprite: { kind: "creature", seed: "marketcrow", variant: "flyer", a: "coal", b: "gold" } }],
  chests: [{ id: "d_chest1", x: 25, y: 2, item: "slattea", count: 1 }],
};

const letout: MapDef = {
  id: "letout",
  name: "The Let-Out",
  theme: "letout",
  music: "town",
  musicSeed: "letout",
  caption: "The Let-Out. Line is sold here by the fathom.",
  rows: [
    "##############################",
    "#......ZZZZZZZZZZZZZZZZ......#",
    "#......Z,,,,,,,,,,,,,,Z......#",
    "#......Z,,,,,,D,,,,,,,Z......#",
    "#......ZZZZZZZ,ZZZZZZZZ......#",
    "#............................#",
    "#..c..c..c.........c..c..c...#",
    "#..,__,__,.........,__,__,...#",
    "#..c..c..c.........c..c..c...#",
    "#............................#",
    "#......nnnnnnnnnnnnnnnn......#",
    "#......nnnnnnnnnnnnnnnn......#",
    "#......nnnnnnnnnnnnnnnn......#",
    "#............................#",
    "#..c..c..c.........c..c..c...#",
    "#..,__,__,.........,__,__,...#",
    "#..c..c..c.........c..c..c...#",
    "#............................#",
    "#..|||||...........V.....w...#",
    "#..|||D|.....................#",
    "..............................",
    "#............................#",
    "##############################",
  ],
  line: [[0, 20], [8, 20], [12, 17], [14, 13], [14, 9], [14, 5], [14, 3]],
  npcs: [
    { id: "broker1", x: 4, y: 9, sprite: P("broker", "gold", "ink", "hat"), name: "Length-broker", note: "F", talk: "broker" },
    { id: "broker2", x: 24, y: 17, sprite: P("broker2", "gold", "coal", "hat"), name: "Length-broker", note: "A", talk: "broker2" },
    { id: "sentinel1", x: 13, y: 5, sprite: P("sentinel1", "white", "rust", "frame"), name: "True Sentinel", note: "C", talk: "sentinel", hideIf: "c4_fell" },
    { id: "sentinel2", x: 15, y: 5, sprite: P("sentinel2", "white", "rust", "frame"), name: "True Sentinel", note: "C", talk: "sentinel", hideIf: "c4_fell" },
    { id: "sentinel1_net", x: 13, y: 7, sprite: P("sentinel1", "white", "rust", "frame"), name: "True Sentinel", note: "C", talk: "sentinel", showIf: "c4_fell", hideIf: "c4_hale" },
    { id: "sentinel2_net", x: 15, y: 7, sprite: P("sentinel2", "white", "rust", "frame"), name: "True Sentinel", note: "C", talk: "sentinel", showIf: "c4_fell", hideIf: "c4_hale" },
    { id: "netman", x: 6, y: 13, sprite: P("netman", "clay", "sand"), name: "Net-tender", note: "D", talk: "netman", wander: true },
    { id: "traveler", x: 20, y: 9, sprite: P("traveler", "olive", "sky", "hat"), name: "A traveler", note: "G", talk: "traveler", wander: true },
    { id: "hale_npc", x: 14, y: 11, sprite: P("hale", "frost", "indigo", "hat"), name: "A woman in the net", note: "C", talk: "hale_talk", showIf: "c4_fell", hideIf: "c4_hale", solid: true },
    { id: "innkeep2", x: 8, y: 20, sprite: P("innkeep2", "clay", "gold"), name: "Innkeeper", note: "E", talk: "inn2" },
    { id: "crier", x: 22, y: 20, sprite: P("crier", "white", "slate", "frame"), name: "A True crier", note: "B", talk: "crier", hideIf: "c4_hale" },
    { id: "stallkid", x: 9, y: 13, sprite: P("stallkid", "sand", "gold", "small"), name: "Moss", note: "F", talk: "stallkid", wander: true },
    { id: "scalewife", x: 20, y: 13, sprite: P("scalewife", "frost", "clay"), name: "The scale-wife", note: "D", talk: "scalewife" },
    { id: "clerk4", x: 25, y: 5, sprite: P("clerk4", "white", "gold", "robe"), name: "Office clerk", note: "G", talk: "clerk4" },
    SCRAP_NPC(26, 20),
  ],
  triggers: [
    { id: "letout_in", x: 1, y: 19, w: 2, h: 3, on: "enter", once: true },
    { id: "letout_net", x: 7, y: 10, w: 16, h: 3, on: "enter", once: true, showIf: "c4_in" },
    { id: "letout_spindle_door", x: 14, y: 4, on: "enter", hideIf: "c4_hale" },
    { id: "letout_stall", x: 3, y: 6, on: "interact" },
    { id: "letout_stall2", x: 19, y: 14, on: "interact" },
    { id: "letout_house", x: 6, y: 19, on: "interact" },
    { id: "letout_well", x: 25, y: 18, on: "interact" },
  ],
  exits: [
    { x: 0, y: 20, to: "letout_road", tx: 28, ty: 6, facing: "left" },
    { x: 14, y: 3, to: "spindle", tx: 7, ty: 12, facing: "up", needs: "c4_hale", blocked: "Two True Sentinels stand at the Spindle door and do not bend." },
    { x: 29, y: 20, to: "steppe", tx: 1, ty: 9, facing: "right", needs: "c4_boss", blocked: "East is the Steppe. The wind there has not been asked yet." },
  ],
  wander: [{ groups: ["c4_takers", "c4_crows", "c4_sentinels"], count: 2, x: 2, y: 5, w: 26, h: 13, sprite: { kind: "humanoid", seed: "slacktaker", a: "coal", b: "teal" } }],
  chests: [{ id: "l_chest1", x: 26, y: 2, item: "w_tuningslug", count: 1 }, { id: "l_chest2", x: 2, y: 2, item: "leaddrop", count: 1, slugs: 40 }],
};

const spindle: MapDef = {
  id: "spindle",
  name: "The Spindle",
  theme: "letout",
  music: "dungeon",
  musicSeed: "spindle",
  caption: "Inside the Spindle. It is older than anyone.",
  rows: [
    "###############",
    "#KKKK.....KKKK#",
    "#K...MMMMM...K#",
    "#K..M,,,,,M..K#",
    "#K..M,,Z,,M..K#",
    "#K..M,,,,,M..K#",
    "#K...MM,MM...K#",
    "#K...........K#",
    "#KK.........KK#",
    "#..g.......g..#",
    "#.............#",
    "#......V......#",
    "#......D......#",
    "###############",
  ],
  line: [[7, 12], [7, 8], [7, 5]],
  npcs: [{ id: "warden", x: 7, y: 5, sprite: { kind: "thing", seed: "spindle_warden", variant: "pillar", a: "slate", b: "gold" }, name: "The Spindle Warden", held: false, talk: "warden", hideIf: "c4_boss" }],
  triggers: [
    { id: "spindle_in", x: 6, y: 11, w: 3, h: 1, on: "enter", once: true },
    { id: "spindle_drum", x: 7, y: 4, on: "interact", showIf: "c4_boss" },
    { id: "spindle_cable", x: 1, y: 7, on: "interact" },
    { id: "spindle_glass", x: 3, y: 9, on: "interact" },
  ],
  exits: [{ x: 7, y: 12, to: "letout", tx: 14, ty: 5, facing: "down" }],
};

// ---------------------------------------------------------------------------

async function lengthTrade(ctx: ScriptContext): Promise<void> {
  // Buy fathoms from the child, sell to the traveler. Three rounds, the prices drift.
  let slugs = 0;
  let held = 0;
  const prices = [[1, 4], [2, 3], [1, 5]];
  for (let r = 0; r < 3; r++) {
    const [buy, sell] = prices[r];
    await ctx.say(`Round ${r + 1}. Fen sells at ${buy} a fathom. The traveler buys at ${sell}. You hold ${held} fathoms and ${slugs} slugs of profit.`, { speaker: "Brokering" });
    const i = await ctx.choose(["Buy ten", "Sell what you hold", "Wait"], { title: "Broker" });
    if (i === 0) { if (ctx.g.slugs >= buy * 10) { ctx.g.slugs -= buy * 10; slugs -= buy * 10; held += 10; } else await ctx.say("Not enough slugs."); }
    else if (i === 1) { ctx.g.slugs += sell * held; slugs += sell * held; held = 0; }
  }
  if (held > 0) { ctx.g.slugs += 2 * held; slugs += 2 * held; }
  await ctx.say(slugs > 0 ? `Done. ${slugs} slugs made on line that was never yours. The brokers nod. You are one of them now, a little.` : `Done. ${-slugs} slugs lost. The brokers nod. Everyone loses the first time.`);
}

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  dry_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("East of the Snarl the ground stops leaning and starts cracking. Every mile the tall thing on the horizon is taller. It turns. A line runs up out of it into the cloud, thick as a tree.");
    await ctx.speak("lissom", "Everything is so far apart. Nine, ten. I keep waiting for the ground to pull.");
    await ctx.speak("dulcet", "The Let-Out. Listen to it. A thousand lines, every one paid for by the fathom. If you want to go far, this is where you buy the length. The brokers are the flat ones. Under the tower is a net, and whatever the sky drops into it, this town eats.");
  },
  peddler: async (ctx) => { await ctx.speak("peddler", "Going to the Let-Out? Word is the Office is looking for a cut tuner from the west. Big word. The crier has it from the Spring Line. I would wear a hat."); },
  cairn: async (ctx) => { await ctx.say("A cairn of bones by the road, bleached. Not people. Long jaws, curved teeth. Whoever piled them laid every jaw pointing at the ground."); },
  dry_well: async (ctx) => { await hooking(ctx, "dry_well", { intro: "A crack in the dry ground, wide as a hand. Cold comes out of it, and a smell like the stream in Hem." }); },

  letout_in: async (ctx) => {
    ctx.beat(1);
    await ctx.say("The Let-Out is a ring of stalls round a great net, and above the net the Spindle: a tower that turns, slowly, letting line out through a slot at the top. The fallen line runs across the square, under the net, and into the Spindle's door.");
    await ctx.speak("burl", "Trues. Two at the door. Frames. They do not bend. We do not go in.");
    await ctx.speak("dulcet", "And the crier is saying your name, Fathom. 'A cut tuner of Hem, wanted by the Office for walking under things.' He is reading it off a line. Somebody sent it down.");
    ctx.flag("c4_in");
  },
  letout_net: async (ctx) => {
    ctx.beat(2);
    await ctx.say("Fathom is halfway across the net when the sky makes the sound it made at the Lift. A long hum, getting closer. The net-tender looks up and starts to run.");
    await ctx.fx("fall", 14, 11);
    await ctx.shake();
    ctx.sfx("fall");
    await ctx.say("Something comes down out of the cloud on two lines, fast, and hits the net so hard the whole square bounces. Frost scatters. The something is a woman. She has ice in her hair and two lines going up from her back, and she is laughing, or crying, in a way that is mostly teeth.");
    ctx.flag("c4_fell");
    ctx.refresh();
    await ctx.say("The Sentinels at the Spindle door have left the door. They are walking toward the net with the stiffness of men who cannot bend and are about to arrest somebody.");
  },
  hale_talk: async (ctx) => {
    ctx.beat(3);
    await ctx.say("Cold. Cold cold cold. No line on you. Good. Good! Stand between here and the men in frames. Up there is cold. Not going back.", { speaker: "The woman in the net" });
    await ctx.say("Two lines. Fathom has never seen a person with two. They go up from her back side by side, humming at slightly different notes, pulling slightly different ways.");
    await ctx.speak("hale", "Hale. Brack, east of here. Lift day. Something has the hip. Up, fast. Up there: cold. Rows. Everyone hanging and humming in their sleep. Nobody walking the rows. Nobody. Then a hook in the other shoulder and down, over a town that is not Brack.");
    await ctx.speak("hale", "Two lines because the first is fraying. Spare bait gets a spare line. Understand? Hung. Re-baited. Dropped over the loudest square on the Drop. Spare bait goes where the hum is.");
    const i = await ctx.choose(["Come with us.", "Why should we help you?"]);
    if (i === 1) await ctx.speak("hale", "Because this one knows where the line goes, and remembers some, and the frames are forty feet away.");
    else await ctx.speak("hale", "Yes. Anywhere that is down.");
    await ctx.join("hale");
    ctx.flag("c4_hale");
    ctx.refresh();
    await ctx.say("Hale gains tension twice as fast as anyone: two lines, two pulls. At five tension the sky takes up a held person's line and lifts them out of the fight for a turn, then lets them down. From now on you can ask for it on purpose: Rise. And the louder she hums, the sooner the Bite comes.");
    const r = await ctx.battle("c4_sentinels", { canFlee: false, loseAllowed: true });
    if (r === "win") await ctx.speak("hale", "Frames fall over so well. Now. Spindle door, open. In there, on the drum: line from this back. Can feel it.");
    else await ctx.speak("hale", "Frames. Hateful. The door is open, at least.");
    ctx.setGoal("The Spindle door at the north end of the square is unguarded. Go in.");
  },
  sentinel: async (ctx) => { await ctx.speak("sentinel1", "The Spindle is Office ground. Levelers and let-out clerks only. Move along. Stand up straight while you do it. Hum, if you can. You cannot. Move along."); },
  broker: async (ctx) => {
    await ctx.speak("broker1", "Buying or selling length? A traveler needs three hundred fathoms to reach the Steppe. A homebody needs none. I match them, and the Spindle lets the fathoms out on one line and takes them in on the other. For you, cut one, I have nothing. You are all length and no line.");
    await ctx.shop(["flatbread", "underbread", "slattea", "slugpouch", "spool", "salve", "firepot", "w_sinker", "w_ballast", "g_pluck", "g_frame", "s_iron", "l_glass", "l_mute"], "Length-broker");
  },
  broker2: async (ctx) => {
    if (ctx.errandDone("trade")) { await ctx.speak("broker2", "The market remembers you. Buy low, sell high, stand off the net. That is the whole trade."); return; }
    await ctx.speak("broker2", "Want to learn the trade? Fen sells her gran's slack cheap. The traveler over there buys dear. The prices move. Three rounds. Keep what you make.");
    const i = await ctx.choose(["Try it", "No"], { cancel: true });
    if (i !== 0) return;
    await lengthTrade(ctx);
    ctx.errand("trade");
    await ctx.speak("broker2", "Not bad. Here. A broker's weight. Every one of us carries one. It says how much you are worth. It says that to the sky, mostly.");
    await ctx.give("w_tuningslug");
  },
  netman: async (ctx) => {
    if (ctx.has("c4_fell")) { await ctx.speak("netman", "Thirty years I have tended that net. Scale, bone, lead, a boot every spring. Never a person. Never a person with two."); if (ctx.has("hooked:letout_well") && !ctx.errandDone("boot")) { await ctx.speak("netman", "You have been fishing my well. Did a boot come up? One will. Every spring one boot. I have thirty of them. Thirty left boots. I would like to know, before I die, whose right foot is up there. Here. For listening to an old man count boots."); ctx.errand("boot"); await ctx.giveSlugs(35); } return; }
    await ctx.speak("netman", "The net catches what the sky drops. Scale, mostly. Sometimes frost in a lump, cold enough to burn. Sometimes a boot. We sell all of it. Stand off the net, the Spindle is letting out.");
  },
  traveler: async (ctx) => { await ctx.speak("traveler", "I bought four hundred fathoms to see the edge. I got there. The land stops. Under it is dark, all the way down, and out of the dark a cable wider than a house goes up past the edge into the cloud. Now I am selling three hundred back at a loss. I kept the last hundred. I might want to look again."); },
  inn2: async (ctx) => { await inn(ctx, "innkeep2", "Beds, eight slugs. The Office has been asking after a cut tuner. I have not seen one. I am not looking at your back, I am looking at your coin.", ctx.inParty("hale") ? "A bed under a wide gap. Hale sleeps with both lines wrapped round her arm like a child with a blanket, and hums in her sleep, and stops when Fathom touches her shoulder." : "A bed under a wide gap. Something drips through it in the night, and Fathom, who has no line to catch the drip, sleeps through it."); },
  crier: async (ctx) => { await ctx.speak("crier", "HEAR THIS. FROM THE SPRING LINE. A CUT TUNER OF HEM, LOOSE, WALKING UNDER ROOFS AND BRIDGES, IS SOUGHT BY THE OFFICE. ALSO: A LINE CAME DOWN AT HEM WITH WORDS IN IT. I do not know what that means. It is on the line. I read what is on the line."); },
  stallkid: async (ctx) => { await ctx.speak("stallkid", "I sell slack. Not mine. My gran's. She does not go anywhere so she does not need it. A slug a fathom. You do not need any! You have the most of anyone! You have ALL of it!"); },
  scalewife: async (ctx) => { await ctx.speak("scalewife", "Scale. By the sheet. It comes down off the net wet and I dry it on the roof and it is the roof, mostly, by now. Have you ever looked at a scale close? Look. It is bigger than your hand. What do you think it came off?"); },
  clerk4: async (ctx) => { await bounty(ctx, "crows", "clerk4", "The Office pays for market crows. They steal slugs and the Office does not like slugs going anywhere it did not send them. Fifty a brace.", "c4_crows", 50, "Received. The Office thanks you and notes that you are, yourself, a line item."); },
  letout_stall: async (ctx) => { await ctx.say("A stall. Under the counter, in the dark, a gap a cut person could crawl through. The Let-Out's back lanes run under every stall in the square. Nobody held can use them, so nobody held has looked."); },
  letout_stall2: async (ctx) => { await ctx.say("Sacks of frost, glittering, sold by the lump. A sign: DO NOT TOUCH. DO NOT LICK. DO NOT HUM NEAR."); },
  letout_house: async (ctx) => { await ctx.say("A tall house with one wide gap in the roof. A broker lives here. Brokers keep their lines long and their roofs open. A broker may need to leave fast, or be taken."); },
  letout_well: async (ctx) => { await hooking(ctx, "letout_well", { intro: "The net's drain, where what the net catches and nobody buys goes back down. Fathom has a weighted knot." }); },
  letout_spindle_door: async (ctx) => { await ctx.say(ctx.has("c4_fell") ? "The Spindle door. The Sentinels are elsewhere. The line goes in under the sill." : "The Spindle door. Two Sentinels stand either side of it in rusted frames and do not look at Fathom. They are looking up. The line goes in under the sill."); },

  spindle_in: async (ctx) => {
    ctx.beat(4);
    await ctx.say("Inside, the Spindle is a machine. Not a building with a machine in it. A machine. Cables as thick as a body go up the walls and into the dark. In the middle a drum turns, and wound on the drum, in with a hundred travelers' lines, is Fathom's.");
    await ctx.speak("hale", "Reels anything that comes down. These two as well, look. Frost on them. Nine hundred years of reeling. No hand on the crank. Same as up there.");
    await ctx.speak("dulcet", "I can hear the knots on the drum. Dozens, Fathom. The file is wound up in there.");
  },
  spindle_cable: async (ctx) => { await ctx.say("A cable, older than the Office, older than Hem. Stamped into its sheath, half worn away: STAY. Below it, smaller: 2 OF 4. Below that, scratched by hand: THEY ARE NOT UP THERE."); },
  spindle_glass: async (ctx) => { await ctx.say("A glass panel in the floor. Under it, nothing, then far down a faint moving dark like water, and in the water something with a long jaw turns over, slowly, and the glass is suddenly very thin."); },
  warden: async (ctx) => {
    ctx.beat(5);
    await ctx.say("The drum stops turning. On top of it something unfolds that was part of the machine a moment ago: arms, a lens, a reel. The lens turns to each of them in turn, and clicks.");
    await ctx.say("'LOOSE MATERIAL DETECTED,' it says. 'REELING.'", { speaker: "The Spindle Warden" });
    await ctx.speak("burl", "Winds us up. Taut. Loud. Bitten. Stay quiet.");
    const r = await ctx.battle("c4_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c4_boss");
    ctx.refresh();
    ctx.beat(6);
    await ctx.say("The Warden folds back into the drum with a sound like a sigh and the drum begins, slowly, to turn the other way. Line unwinds. A hundred travelers' lines, Hale's two, and Fathom's, knotted every arm's length.");
    await ctx.knot("m4", "IT WILL TAKE THE RETURNED ONE", "Dulcet");
    await ctx.speak("hale", "Returned. The word for this one. Written before the net. Written before the fall. Dropped here on purpose. Dropped here for you.");
    await ctx.speak("dulcet", "The crier had Hem's line this morning, off what the Office calls the Spring Line. The Office gets its orders in knots, Fathom. From up there. From whatever is not there.");
    await ctx.poolBonus(2);
    await ctx.camp([
      { a: "fathom", b: "hale", lines: [["hale", "Up there there is a word. The cables say it. The cold says it. HOLD. Nobody says it. There is nobody."], ["fathom", "Then who reeled you up?"], ["hale", "The Reel."]] },
      { a: "lissom", b: "hale", lines: [["lissom", "Two lines. Does it feel like being pulled in two?"], ["hale", "Feels like being argued over by two things that are not there."], ["lissom", "In the Snarl that is called a marriage."]] },
      { a: "dulcet", b: "hale", lines: [["dulcet", "Your lines are C and C sharp. They beat against each other. I could tune one."], ["hale", "Leave them. The beat is how this one knows it is still down here."]] },
      { a: "burl", b: "hale", lines: [["burl", "You went up. Were there knots?"], ["hale", "Everywhere. On every cable. Old ones. Sad ones. Three hooks in some."], ["burl", "Hm."]] },
    ]);
    ctx.beat(7);
    await ctx.say("Outside, the crier has a new cry. The Office is sending a Leveler with a column. Rigor, who does not bend. The party goes east before dawn, into country where the wind decides which way you lean.");
    ctx.flag("c4_done");
    await ctx.nextChapter();
  },
  spindle_drum: async (ctx) => { await ctx.say("The drum turns backward, unwinding. It will take a year to let out everything it reeled in. Out in the square, travelers who could not walk past the net are walking past it."); },
  scrap_talk: scrapTalk,
};

export const ch4: Chapter = {
  n: 4,
  title: "The Let-Out",
  subtitle: "Tests, allies, enemies",
  maps: [road, letout, spindle],
  scripts,
  beats: ["A market that sells line by the fathom and eats what the sky drops", "The Trues hold the Spindle door. The crier has Fathom's name.", "Something falls out of the sky into the net", "Hale, reeled up, hung, thrown back", "Inside the Spindle: the drum, the file", "The Warden reels. Everyone loud.", "Dulcet reads: IT WILL TAKE THE RETURNED ONE", "Rigor is coming. East, into the wind."],
  goal: (g) => {
    const f = g.flags;
    if (f.c4_done) return "East, onto the Steppe.";
    if (f.c4_boss) return "Rest, then leave the Let-Out by the east road.";
    if (f.c4_hale) return "The Spindle door at the north end of the square is unguarded. Go in.";
    if (f.c4_fell) return "Someone fell into the net. Talk to her before the Sentinels reach her.";
    if (f.c4_in) return "The line runs under the great net to the Spindle. Cross the net.";
    return "Follow the line east along the dry road.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 4", "The Let-Out", { beat: "Tests" });
    await ctx.teleport("letout_road", 1, 6, "right");
  },
  debugStart: { map: "letout_road", x: 1, y: 6, level: 10, flags: { c3_done: true } },
};
