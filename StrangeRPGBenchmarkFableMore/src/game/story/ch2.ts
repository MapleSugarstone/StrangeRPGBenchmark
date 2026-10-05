import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, SCRAP_NPC, scrapTalk, hooking, inn, bounty } from "./common";

const road: MapDef = {
  id: "slat_road",
  name: "The road into the Slatlands",
  theme: "slat",
  music: "road",
  musicSeed: "slatroad",
  caption: "The Slatlands. One roof, forty miles long.",
  rows: [
    "////////////////////////////////////////",
    "T..........T.........................T.T",
    "T..b....................r..........b...T",
    "T............x.........................T",
    "T.....r.............b.........T........T",
    "T.............................T........T",
    "T......................x...............T",
    "........................................",
    "T...........T..........................T",
    "T...b.......T......r...........b.......T",
    "T..................................x...T",
    "T.......x..............b......w........T",
    "T..........................r...........T",
    "////////////////////////////////////////",
  ],
  line: [[0, 7], [6, 7], [10, 6], [15, 7], [20, 8], [25, 7], [30, 7], [35, 7], [39, 7]],
  npcs: [
    { id: "walker", x: 14, y: 4, sprite: P("walker", "olive", "bone", "hat"), name: "A walker", note: "F", talk: "walker", wander: true },
    { id: "postman", x: 29, y: 5, sprite: P("postman", "white", "slate"), name: "A roof-post man", note: "C", talk: "postman" },
  ],
  triggers: [
    { id: "road_in", x: 1, y: 6, w: 2, h: 3, on: "enter", once: true },
    { id: "road_well", x: 30, y: 11, on: "interact" },
    { id: "road_post", x: 31, y: 4, on: "interact" },
  ],
  exits: [
    { x: 0, y: 7, to: "lint_hollow", tx: 18, ty: 8, facing: "left", needs: "never", blocked: "West is Hem. Hem does not want Fathom." },
    { x: 39, y: 7, to: "rafter", tx: 1, ty: 12, facing: "right" },
  ],
  wander: [
    { groups: ["c2_birds", "c2_grub", "c2_wolf"], count: 3, x: 8, y: 2, w: 26, h: 10, sprite: { kind: "creature", seed: "tugbird", variant: "flyer", a: "sky", b: "white" } },
  ],
  chests: [
    { id: "r_chest1", x: 25, y: 2, item: "flatbread", count: 2 },
    { id: "r_chest2", x: 7, y: 11, item: "salve", count: 1, slugs: 25 },
  ],
};

const rafter: MapDef = {
  id: "rafter",
  name: "Rafter",
  theme: "slat",
  music: "town",
  musicSeed: "rafter",
  caption: "Rafter, where every roof is one roof",
  rows: [
    "///////////////////////////",
    "T.........................T",
    "T..|||||.......|||||......T",
    "T..||||D.......|||D|......T",
    "T.........................T",
    "T.....,,,,,,,,,,,,,,......T",
    "T.....,,,,,,,,,,,,,,......T",
    "T.....,,,,,,P,,,,,,,......T",
    "T.....,,,,,,,,,,,,,,......T",
    "T.........................T",
    "T..|||||.......||||||||...T",
    "T..|||D|.......||||||D|...T",
    "..........................T",
    "T..............V..........T",
    "T.........................T",
    "T...x..........x.....w....T",
    "T.........................T",
    "T..........................",
    "T.........................T",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  line: [[0, 12], [5, 12], [9, 9], [12, 8], [16, 9], [20, 11], [21, 11]],
  npcs: [
    { id: "dulcet_npc", x: 12, y: 8, sprite: P("dulcet", "violet", "bone", "robe"), name: "A harpist", note: "E", talk: "dulcet_talk", hideIf: "c2_dulcet" },
    { id: "agent", x: 7, y: 6, sprite: P("agent", "plum", "gold", "hat"), name: "Vell's man", note: "A", talk: "agent", hideIf: "c2_kite" },
    { id: "innkeep", x: 8, y: 11, sprite: P("innkeep", "clay", "sand"), name: "Innkeeper", note: "C", talk: "rafter_inn" },
    { id: "grocer", x: 17, y: 4, sprite: P("grocer", "olive", "rose"), name: "Grocer", note: "D", talk: "grocer" },
    { id: "quiet1", x: 20, y: 15, sprite: P("quiet1", "sand", "sea"), name: "Tamsin", note: "G", talk: "quiet1", wander: true },
    { id: "quiet2", x: 4, y: 15, sprite: P("quiet2", "bone", "moss", "hat"), name: "Orrin", note: "B", talk: "quiet2", wander: true },
    { id: "quiet3", x: 23, y: 7, sprite: P("quiet3", "clay", "violet"), name: "Hesper", note: "A", talk: "quiet3", wander: true },
    { id: "trueman", x: 24, y: 7, sprite: P("trueman", "white", "slate", "frame"), name: "A True", note: "G", talk: "trueman", showIf: "c2_barn" },
    { id: "kid2", x: 14, y: 16, sprite: P("kid2", "sand", "rose", "small"), name: "Pip", note: "F", talk: "kid2", wander: true },
    { id: "chorister", x: 22, y: 12, sprite: P("chorister", "bone", "gold"), name: "Chorister", note: "E", talk: "chorister" },
    { id: "bountyman", x: 5, y: 4, sprite: P("bountyman", "white", "gold", "robe"), name: "Office clerk", note: "D", talk: "rafter_bounty" },
    { id: "oldwoman", x: 24, y: 17, sprite: P("oldwoman", "bone", "plum", "robe"), name: "Granny Cob", note: "C", talk: "oldwoman" },
    SCRAP_NPC(2, 17),
  ],
  triggers: [
    { id: "rafter_in", x: 1, y: 11, w: 2, h: 3, on: "enter", once: true },
    { id: "rafter_bell", x: 12, y: 7, on: "interact" },
    { id: "rafter_inn", x: 6, y: 11, on: "interact" },
    { id: "rafter_shop", x: 18, y: 3, on: "interact" },
    { id: "rafter_house", x: 7, y: 3, on: "interact" },
    { id: "rafter_well", x: 21, y: 15, on: "interact" },
    { id: "rafter_busk", x: 11, y: 7, on: "interact", showIf: "c2_dulcet" },
  ],
  exits: [
    { x: 0, y: 12, to: "slat_road", tx: 38, ty: 7, facing: "left" },
    { x: 26, y: 17, to: "kite_hill", tx: 1, ty: 8, facing: "right" },
    { x: 21, y: 11, to: "choir_barn", tx: 6, ty: 10, facing: "up", needs: "c2_dulcet", blocked: "The barn is barred. A True stands inside the door and says the choir is Office business, go away." },
  ],
};

const kiteHill: MapDef = {
  id: "kite_hill",
  name: "Kite Hill",
  theme: "slat",
  music: "road",
  musicSeed: "kitehill",
  caption: "Kite Hill. The Reknotter's yard.",
  rows: [
    "TTTTTTTTTTTTTTTTTTTT",
    "T..K.....K.....K...T",
    "T..................T",
    "T......K.......K...T",
    "T.....,,,,,,,......T",
    "T.....,,,,,,,..K...T",
    "T..K..,,,,,,,......T",
    "T.....,,,,,,,......T",
    "......,,,,,,,..K...T",
    "T..K...............T",
    "T..........K.......T",
    "T...K......w.......T",
    "TTTTTTTTTTTTTTTTTTTT",
  ],
  npcs: [
    { id: "vell", x: 9, y: 5, sprite: P("reknotter", "plum", "gold", "hat"), name: "Reknotter Vell", note: "A", talk: "vell", hideIf: "c2_kite" },
    { id: "customer", x: 12, y: 7, sprite: P("customer", "clay", "sky"), name: "A customer", note: "C", talk: "customer", hideIf: "c2_kite" },
    { id: "fallen1", x: 6, y: 9, sprite: P("customer", "clay", "sky", "slack"), name: "A customer", talk: "fallen", held: false, showIf: "c2_kite" },
    { id: "fallen2", x: 13, y: 3, sprite: P("fallen2", "bone", "teal", "slack"), name: "A woman", talk: "fallen", held: false, showIf: "c2_kite" },
  ],
  triggers: [
    { id: "kite_in", x: 1, y: 7, w: 2, h: 3, on: "enter", once: true },
    { id: "kite_fight", x: 8, y: 4, w: 5, h: 4, on: "enter", showIf: "c2_barn", hideIf: "c2_kite" },
    { id: "kite_post", x: 3, y: 1, on: "interact" },
    { id: "kite_well", x: 11, y: 11, on: "interact" },
  ],
  exits: [{ x: 0, y: 8, to: "rafter", tx: 25, ty: 17, facing: "left" }],
};

const barn: MapDef = {
  id: "choir_barn",
  name: "The choir barn",
  theme: "indoor",
  music: "sad",
  musicSeed: "barn",
  caption: "The choir barn. Forty singers, one tangle, one hum.",
  rows: [
    "WWWWWWWWWWWWWW",
    "WffffffffffffW",
    "Wff__ffff__ffW",
    "Wf____ff____fW",
    "Wf____ff____fW",
    "Wff__ffff__ffW",
    "WffffffffffffW",
    "WffffffffffffW",
    "WffffffffffffW",
    "WffffffffffffW",
    "WWWWWWDWWWWWWW",
  ],
  npcs: [
    { id: "tangle1", x: 3, y: 2, sprite: { kind: "knot", seed: "fallchord1", variant: "big", a: "gold", b: "bone" }, name: "The Fall Chord", held: true, talk: "tangle" },
    { id: "tangle2", x: 10, y: 2, sprite: { kind: "knot", seed: "fallchord2", variant: "big", a: "gold", b: "bone" }, name: "The Fall Chord", held: true, talk: "tangle" },
    { id: "singer_a", x: 2, y: 7, sprite: P("singer_a", "bone", "gold"), name: "A singer", note: "C", talk: "barnsinger" },
    { id: "singer_b", x: 11, y: 7, sprite: P("singer_b", "bone", "plum"), name: "A singer", note: "E", talk: "barnsinger" },
    { id: "true_barn", x: 6, y: 8, sprite: P("true_barn", "white", "slate", "frame"), name: "A True", note: "B", talk: "truebarn", hideIf: "c2_barn" },
  ],
  triggers: [
    { id: "barn_in", x: 5, y: 9, w: 4, h: 1, on: "enter", once: true },
    { id: "barn_knots", x: 2, y: 3, w: 4, h: 2, on: "enter", once: true },
    { id: "barn_under", x: 8, y: 3, w: 4, h: 2, on: "enter", once: true },
  ],
  exits: [{ x: 6, y: 10, to: "rafter", tx: 21, ty: 12, facing: "down" }],
};

// ---------------------------------------------------------------------------

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  road_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("East of the Hollow the land flattens and the roof begins. Not a house. A roof, slat after slat, on posts, forty miles of it. The Office built it. Nobody here has ever been rained on. Lines never snag under it. Over the years, they wear.");
    await ctx.speak("burl", "Fence. For bait. Keeps the lines straight.");
    await ctx.say("Fathom's shoulders are cold where the line used to pull. Fathom keeps reaching back to check. There is nothing to check, and there is nothing listening.");
  },
  walker: async (ctx) => { await ctx.speak("walker", "Cut, are you? Vell on Kite Hill past Rafter fixes that. Puts you back on a line. Not a real one. Real enough that you stop getting looked at. Costs. Everything that stops you getting looked at costs."); },
  postman: async (ctx) => { await ctx.speak("postman", "Roof-post man. My family has checked these posts for nine hundred years. Straight is the job. Dry is an accident."); },
  road_post: async (ctx) => { await ctx.say("A roof post. Carved into it at the height of a kneeling person, where only the slack would see: a row of knots. Fathom cannot read them. There are four. Somebody has been writing on the posts for a long time."); },
  road_well: async (ctx) => { await hooking(ctx, "road_well", { intro: "A drain under the roof, where the drips collect and go down. Fathom has a weighted knot." }); },

  rafter_in: async (ctx) => {
    ctx.beat(1);
    await ctx.say("Rafter is a town under a roof the size of the sky. Lines go up through the slats in rows. People look at Fathom's back, and then at Fathom's face, and then at something else.");
    await ctx.speak("burl", "They see no line. They see a hole where a line should be. They see supper that got away.");
    const i = await ctx.choose(["Find this Reknotter.", "Find where the line goes."], { title: "Fathom wants" });
    if (i === 0) await ctx.say("Fathom wants to be held. More than the knots. More than the file. It is not a brave thought and Fathom has it anyway.");
    else await ctx.say("Fathom says the line first. Fathom's feet turn toward Kite Hill anyway. Burl notices, and says nothing.");
    ctx.flag("c2_in");
  },
  rafter_bell: async (ctx) => { await ctx.say("Rafter's bell. A sign beneath it: THE CHOIR BARN IS CLOSED. THE FALL CHORD IS OFFICE BUSINESS. KEEP HUMMING."); },
  rafter_inn: async (ctx) => { await inn(ctx, "innkeep", "A bed is eight slugs. The slats over the beds are wide. We get travelers with thick lines. Yours is thin. Very thin. Eight slugs.", "Fathom sleeps under a gap in the slats. Something drips through it onto the pillow, once an hour, cold."); },
  rafter_shop: async (ctx) => {
    await ctx.speak("grocer", "Flatbread, slugs, weights for the choir, lures for the Office. Soles? No call for soles here. There is one pair. Somebody died in them.");
    await ctx.shop(["flatbread", "slugpouch", "salve", "spool", "w_sinker", "w_bob", "g_hemp", "s_grip", "s_felt", "l_bone", "l_glass"], "Rafter grocery");
  },
  rafter_house: async (ctx) => { await ctx.say("Through the door: a family at a table, all leaning the same way. A lean day. The whole roof creaks when the sky sways, and every line in the house leans with it."); },
  rafter_well: async (ctx) => { await hooking(ctx, "rafter_well", { intro: "Rafter's well, grate loose. Pip has been dropping things down it for a year to hear them land. They do not land." }); },
  rafter_busk: async (ctx) => {
    await ctx.speak("dulcet", "The square pays for plucking. Four lines, four notes, the market crowd walking past. You play, I keep the time, we split it. You will not be as good as me. Nobody is.");
    const i = await ctx.choose(["Play", "Not now"], { cancel: true });
    if (i !== 0) return;
    const r = await ctx.minigame("pluck", { rounds: 16, hard: ctx.has("c2_kite") });
    // The crowd pays well once; after that it has heard the tune
    const busked = Number(ctx.get("busked") ?? 0);
    ctx.flag("busked", busked + 1);
    const slugs = r.score * (busked === 0 ? 3 : 1);
    if (slugs > 0) await ctx.giveSlugs(slugs);
    await ctx.speak("dulcet", r.won ? "Not bad. Every line you plucked rang up into the dark, by the way. Somebody up there got a free concert." : "The crowd kept walking. The crowd is wise.");
  },
  rafter_bounty: async (ctx) => {
    await bounty(ctx, "wolves", "bountyman", "The Office pays for slatwolves. They walk the roof and chew the posts, and a chewed post is a snagged line. Forty slugs a pair, and you leave the heads with me.", "c2_pack", 40, "Heads received. The Office thanks you. The Office also notes you, loose one, in a column I am not allowed to show you.");
  },
  grocer: async (ctx) => { await ctx.speak("grocer", "Buying or looking? Looking is free. Looking at my shelves, I mean. Not at my back. Everyone is looking at backs this week."); },
  agent: async (ctx) => { await ctx.speak("agent", "Vell's yard is east, past the fence. He does not do credit and he does not do questions. Vell's lines pull like real ones and never make a sound. You are paying for the quiet."); },
  quiet1: async (ctx) => {
    if (ctx.has("c2_kite")) { await ctx.speak("quiet1", "Mine came down with the Kite. Twelve years I paid Vell for that line. Twelve years of never sitting down in case it showed. Today I sat on the ground, and nothing bit me, and I cried."); ctx.taught("rafter"); return; }
    if (ctx.has("c2_dulcet") && !ctx.errandDone("quiet")) { await ctx.speak("quiet1", "You sat with the harpist. She plays my line every market day. The saddest E in the Slatlands, she says. She says it to my face."); return; }
    await ctx.speak("quiet1", "Do not stand so close. Not because of you. Because of me. I mean, because of you. Go away.");
  },
  quiet2: async (ctx) => {
    if (ctx.has("c2_kite")) { await ctx.speak("quiet2", "Half this town, cut. Half! Orrin at the mill, cut. The Leveler's own wife. Vell knew every name, and charged every one of us, and never told the Office, and never told the Fish."); return; }
    await ctx.speak("quiet2", "If a person was cut and kept quiet and paid a certain fee, nobody would know. Not that I would know about that. I am humming right now. Listen.");
  },
  quiet3: async (ctx) => {
    if (ctx.has("c2_kite")) { await ctx.speak("quiet3", "Hesper. Cut since I was nineteen. The slats wear them through. A lean day, a bad slat, and one morning you stand up light. I had a kite line thirty years and my husband still does not know. He is held. He is in the file. I am not. I used to think that made me the lucky one."); return; }
    await ctx.speak("quiet3", "Hesper. I keep the roof-post records. Every post, every year, straight or not. Nobody reads them. I write them so that somebody could.");
  },
  trueman: async (ctx) => { await ctx.speak("trueman", "The Office is aware of a loose person in Rafter. The Office will be making an example. Walk true, citizen, and hum."); },
  kid2: async (ctx) => { await ctx.speak("kid2", "Can I touch where it was? Does it hurt? If my line fell could I go under the mill wheel and get the coins that fall in? Would anything come up and get me? What comes up? I am Pip. Mam says do not ask you things."); },
  chorister: async (ctx) => {
    if (ctx.has("c2_barn")) { await ctx.speak("chorister", "You went under the Fall Chord. UNDER it. Forty of us hung there a week, humming, and the Office said keep humming, and you walked under like it was a doorway."); return; }
    await ctx.speak("chorister", "Forty of us were singing when your line came down across the barn. Forty lines in one knot, mid chord. We have been humming ever since. The Office says we are magnificent. The Office keeps coming to listen with a book.");
  },
  oldwoman: async (ctx) => {
    if (ctx.has("c2_kite")) { await ctx.speak("oldwoman", "Granny Cob. My Lift was fifty years ago. I was the one. I went up and something had me by the hip and then I was on a line over Brack with my hair white. The Office said I had been Returned as a blessing. I was nineteen. Nobody here knows but you."); return; }
    await ctx.speak("oldwoman", "Granny Cob. I have stood through forty-nine Lifts in this square. Before every one my left hip aches, low, where nothing has any business holding on. Hum, child.");
  },

  dulcet_talk: async (ctx) => {
    ctx.beat(3);
    await ctx.say("A woman in a dark robe sits with her back to the bell, playing the people walking past. She reaches up without looking, plucks a line as it goes by, and hums the note it gives.");
    await ctx.speak("dulcet", "D. Tired. Owes money. E, flat, pregnant. G, sharp, lying about something. And you.");
    await ctx.say("She reaches for Fathom's line and her hand closes on nothing. She does not look surprised. She looks like someone who has been waiting a long time to stop being surprised.");
    const sit = "Sit. Sit, I said. You are the only person in this square who can sit without a yank.";
    await ctx.speak("dulcet", ctx.has("c2_permit") ? `A kite line. Vell's knot, I know it by the lump. Under it, nothing. ${sit}` : ctx.has("c2_refused") ? `Nothing. You walked down Vell's hill with nothing, too. I heard you not come back. ${sit}` : `Nothing. Not a kite line either, so you have not been to Vell yet. ${sit}`);
    await ctx.speak("dulcet", "Dulcet. Blind. Harpist. And this.");
    await ctx.say("Under the robe, a line goes up from her back like anyone's. She tugs it and it gives: a loop of slack falls out of her sleeve. A kite line, tied on.");
    await ctx.speak("dulcet", "Twenty years. Vell's work the first year, my own after. I play people's lines for a living and nobody ever thought to pluck mine. Do you know what I play, tuner? Lures. The Office pays me to keep the Fall Chord humming. Forty people in a knot, loud as a town. Something is going to come for it. I know that, and I keep playing.");
    await ctx.speak("burl", "Cut. Good.");
    await ctx.speak("dulcet", "The knot talks. Of course it does. Listen. Go up the hill and buy your back back if you like. It is a kite. It is a lie on a string. Or sit, and I will show you what a line does when it is played properly. Those grubs by the fence.");
    await ctx.join("dulcet");
    ctx.flag("c2_dulcet");
    await ctx.say("Every held foe has a note. Plucking its line plays the note into the phrase on the strip. Three different notes that make a chord do something to the whole fight. Dulcet's Tune changes a foe's note to whatever you need.");
    const r = await ctx.battle("c2_grub", { canFlee: false, loseAllowed: true });
    if (r === "win") await ctx.speak("dulcet", "Hear it? Three notes and the whole field answers. I have done that to market squares for twenty years, for Office money. I am going to stop. Now go and see Vell, if you still want to.");
    else await ctx.speak("dulcet", "We will practice. Go and see Vell, if you still want to.");
    ctx.flag("c2_taught");
    await ctx.poolBonus(2);
    await ctx.say("Dulcet cuts Fathom two more fathoms from the heap by the bell, neatly, with a harp string.");
  },

  kite_in: async (ctx) => {
    await ctx.say("Kites. A dozen of them, high over the hill, each on a line that runs down to a post. From the posts, thinner lines run off toward town. Toward backs. The kites are painted to look like the underside of the sky.");
  },
  kite_post: async (ctx) => { await ctx.say("A kite post. Vell's ledger is nailed to it, weather-blurred. Names and fathoms. Thirty-one names. Fathom knows four of them from the square."); },
  kite_well: async (ctx) => { await hooking(ctx, "kite_well", { hard: true, intro: "A sinkhole at the bottom of the hill, where Vell throws his offcuts. Something down there has been eating offcuts for years and is large." }); },
  vell: async (ctx) => {
    if (ctx.has("c2_permit")) { await ctx.speak("vell", "You look wonderful. Held. Nobody would know. Tell your friends, discreetly, and do not go under anything."); return; }
    ctx.beat(2);
    await ctx.speak("vell", "A cut one. Fresh. Still reaching for it, look at that shoulder. I can fix that by sundown. Forty slugs and you walk out of here plumb, and nothing with teeth will know the difference, and nothing with a book will either.");
    await ctx.say("A kite line, tied to Fathom's back, run up to a kite the size of a barn door. From below it would look like a line. From the side it would look like a line. It would pull, a little, when the wind did. It would not hum.");
    const i = await ctx.choose(["Pay forty slugs.", "Walk away."], { title: "Be held again?" });
    if (i === 1) {
      await ctx.speak("vell", "Everyone walks away once. Everyone comes back. The hill is right here.");
      ctx.flag("c2_refused");
      return;
    }
    if (ctx.g.slugs < 40) { await ctx.speak("vell", "That is not forty slugs. Come back with forty."); return; }
    ctx.g.slugs -= 40;
    ctx.sfx("knot");
    await ctx.say("Vell ties it on with a knot Fathom does not know. The kite takes the wind. Something tugs, gently, between Fathom's shoulders, and Fathom nearly cries.");
    await ctx.give("k_kite");
    ctx.flag("c2_permit");
    await ctx.speak("burl", "Fake.");
    await ctx.speak("vell", "Fake is a strong word. Say instead: a line held by the sky, which is where lines are held. Mind the fences. Kites snag.");
  },
  customer: async (ctx) => { await ctx.speak("customer", "I am not here. You did not see me. I am held, I have always been held, my line is right there, look at it. Look at it. Do not pluck it."); },
  fallen: async (ctx) => { await ctx.say("Someone sitting on the grass with twelve years of kite line coiled in their lap, looking at it the way you look at a bill."); },

  truebarn: async (ctx) => { await ctx.speak("truebarn", "The Fall Chord is Office business. Forty held citizens, humming as one. The sky has never heard anything like it. Stand there and do not touch anything and do not sing."); },
  barn_in: async (ctx) => {
    await ctx.say("The barn is tall and open to the slats. In the middle of it forty lines go up into two enormous knots, and under the knots, pressed into the floor by the weight of the tangle, lies a stretch of Fathom's line, thick with knots of its own.");
    await ctx.speak("dulcet", "I can hear yours from here. The knots in your line are a different pitch from the knots in theirs. Yours are tied. Theirs just happened. And listen under it. Listen to the floor.");
    await ctx.say("Under the hum of forty singers, the floor is humming too. Not a note. Water, very far down, moving toward something.");
    await ctx.speak("burl", "Under. You have to go under. Held cannot.");
    if (ctx.has("c2_permit")) {
      ctx.beat(4);
      await ctx.say("Fathom steps toward the tangle and the kite line snags on the first slat and yanks. The permit line. It will not go under anything. That is what a line is.");
      const i = await ctx.choose(["Cut the kite line.", "Keep it. Find another way."], { title: "The file is under there." });
      if (i === 1) { await ctx.speak("dulcet", "There is no other way. That is the whole point of under."); await ctx.say("Fathom stands at the edge of the tangle for a long time."); return; }
      ctx.sfx("snap");
      await ctx.say("Fathom cuts the kite line with the edge of a slug. Somewhere over Kite Hill a kite the size of a barn door jerks and sags. Forty slugs float off east on the wind.");
      await ctx.speak("dulcet", "There. Now you are what you are. Go under.");
      ctx.flag("c2_cut");
    }
  },
  tangle: async (ctx) => { await ctx.say("Forty lines in a knot the size of a cart. Inside, a note is still being held: the singers were mid chord when the line fell. They have been humming for a week. It is beautiful, and it is bait, and the Office knows which."); },
  barnsinger: async (ctx) => { await ctx.speak("singer_a", "Hmmmmmmmm. Hmmmm. Help. Hmmmmm. They said keep going. Hmmmm."); },
  barn_knots: async (ctx) => {
    if (ctx.has("c2_permit") && !ctx.has("c2_cut")) return;
    await ctx.say("Fathom crawls under the Fall Chord with forty people humming overhead and comes out the other side with an arm's length of knotted line. The True at the door does not see. He is not looking under anything.");
    ctx.flag("c2_barn");
    ctx.beat(5);
    ctx.refresh();
    await ctx.speak("dulcet", "Give it here. I read by hand.");
    await ctx.knot("m2", "IT WILL FIND THE OLD BAIT", "Dulcet");
    await ctx.say("Dulcet's fingers stop on the last knot and stay there.");
    await ctx.speak("dulcet", "The old bait. Fathom, twenty years ago in this square a line came down with knots in it and I was nineteen and nobody could read them. RAFTER 4. HARPIST. It said something else after that, and I had Vell tie a kite line on me before I found out what. I have been in the file this whole time. I have been playing lures for the file this whole time.");
    await ctx.say("Fathom does not say anything. Fathom thinks about what the file wrote before any of this happened: it will find the old bait. And here she is.");
    await ctx.speak("burl", "Vell is coming. Angry. Many lines pulling on one kite.");
  },
  barn_under: async (ctx) => { if (!ctx.has("c2_barn")) await ctx.say("Under the second knot. Fathom is under forty people. None of them can look down. None of them has ever looked down."); },

  kite_fight: async (ctx) => {
    ctx.beat(5);
    const cost = "Do you know what that costs me? Every customer on this hill is watching you, and every one of them is wondering what happens to a cut line that nobody is holding, and the answer is NOTHING, and that is bad for business.";
    await ctx.speak("vell", ctx.has("c2_cut") ? `You cut it. You cut a line I tied and walked under the Fall Chord in front of the Office. ${cost}` : `You walked under the Fall Chord in front of the Office with nothing on your back at all. ${cost}`);
    await ctx.speak("vell", "Kite. Take the loose one up. Let the sky see what it dropped.");
    await ctx.say("The Great Kite comes down out of the cloud on twenty lines at once. Every line Vell ever sold runs to it. It is not held by anything. It is held by everyone who paid.");
    const r = await ctx.battle("c2_boss", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c2_kite");
    ctx.refresh();
    ctx.beat(6);
    await ctx.say("The Great Kite comes down across the hill in a long tearing fall. Twenty lines go slack at once. In Rafter, twenty people sit down on the ground for the first time in years and listen for something to come for them, and nothing does, because they are not humming.");
    await ctx.speak("vell", "Thirty years of custom. Thirty years. Do you know how many of them will thank you? None. Not one.");
    await ctx.speak("dulcet", "Three, I think. Maybe four. Tamsin will. I played her line every market day and it was the saddest E in the Slatlands, and now it is nothing, and nothing is the first thing that has ever been safe.");
    await ctx.speak("burl", "Yours. Still up.");
    await ctx.speak("dulcet", "Vell's knot came off the first year. I tie my own, to my own kite. It hums when I play it and not otherwise.");
    await ctx.say("Vell walks down the hill, counting something on his fingers, and does not look back.");
    await ctx.giveSlugs(40);
    await ctx.say("Fathom's forty slugs, found in the grass where the kite fell.");
    await ctx.camp([
      { a: "fathom", b: "dulcet", lines: [["dulcet", "Twenty years under a kite line and nothing ever came for me. I thought it was the kite. It was the silence."], ["fathom", "So the Fish only want the hum."], ["dulcet", "The Fish only want the hum. And I have spent twenty years making people hum louder. Sleep. I am not going to."]] },
      { a: "fathom", b: "burl", lines: [["burl", "You wanted the kite."], ["fathom", "I wanted to stop being looked at."], ["burl", "I am looked at always. Knot. Pest. Scrap. I am still here. Three hooks. Sleep."]] },
      { a: "burl", b: "dulcet", lines: [["dulcet", "What do you sound like, knot? Come here."], ["burl", "No."], ["dulcet", "Three notes. You sound like three notes at once. That is not a thing a knot should sound like. That is a thing three people sound like."]] },
    ]);
    ctx.beat(7);
    await ctx.say("In the morning the line goes on east, over the hill and down toward a city whose walls are moving. Fathom follows it. Dulcet comes, because the file knew she would. Burl comes because Burl does not come loose.");
    ctx.flag("c2_done");
    await ctx.nextChapter();
  },
  scrap_talk: scrapTalk,
};

export const ch2: Chapter = {
  n: 2,
  title: "The Slatlands",
  subtitle: "Refusal, and the mentor",
  maps: [road, rafter, kiteHill, barn],
  scripts,
  beats: ["Under one roof, a tuner without a line", "Fathom wants to be held again, at any price", "Kite Hill: Vell sells a line that does not hum", "Dulcet plays people. She is cut too. She plays lures.", "The file is under the Fall Chord", "Cut the kite line. The Great Kite falls.", "Dulcet reads: IT WILL FIND THE OLD BAIT", "East, toward the moving walls"],
  goal: (g) => {
    const f = g.flags;
    if (f.c2_done) return "East, toward the Snarl.";
    if (f.c2_kite) return "Rest, then follow the line east from Rafter.";
    if (f.c2_barn) return "Vell is coming. Go up to Kite Hill.";
    if (f.c2_dulcet) return "Go under the Fall Chord in the choir barn, east side of Rafter.";
    if (f.c2_in) return "Rafter. Vell's yard is on Kite Hill to the east. A harpist plays by the bell.";
    return "Follow the line east along the road to Rafter.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 2", "The Slatlands", { beat: "Refusal" });
    await ctx.teleport("slat_road", 1, 7, "right");
  },
  debugStart: { map: "slat_road", x: 1, y: 7, level: 4, flags: { c1_done: true } },
};
