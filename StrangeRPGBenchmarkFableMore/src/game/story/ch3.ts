import type { Chapter, ScriptContext } from "./types";
import type { MapDef } from "../world/map";
import { P, SCRAP_NPC, scrapTalk, hooking, bounty } from "./common";

const approach: MapDef = {
  id: "snarl_road",
  name: "The road to the Snarl",
  theme: "snarl",
  music: "road",
  musicSeed: "snarlroad",
  caption: "The walls are moving. All of them. Together.",
  rows: [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T.........r....................T",
    "T...b..................b.......T",
    "T..............x...............T",
    "T........T.............r.......T",
    "T........T.....................T",
    "................................",
    "T.......b..............x.......#",
    "T..................T...........#",
    "T...x..............T.....b.....T",
    "T.............r.......w........T",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ],
  line: [[0, 6], [8, 6], [14, 7], [20, 6], [26, 6], [31, 6]],
  npcs: [
    { id: "gatekeep", x: 29, y: 6, sprite: P("gatekeep", "brick", "rose", "hat"), name: "Gate warden", note: "D", talk: "gatekeep", hideIf: "c3_in" },
    { id: "leveler_snarl", x: 6, y: 3, sprite: P("leveler_snarl", "white", "gold", "robe"), name: "A bored Leveler", note: "G", talk: "leveler_snarl", wander: true },
  ],
  triggers: [
    { id: "snarl_road_in", x: 1, y: 5, w: 2, h: 3, on: "enter", once: true },
    { id: "snarl_road_well", x: 22, y: 10, on: "interact" },
  ],
  exits: [
    { x: 0, y: 6, to: "kite_hill", tx: 18, ty: 8, facing: "left", needs: "never", blocked: "Back west is the Slatlands. The line goes east." },
    { x: 31, y: 6, to: "snarl", tx: 1, ty: 14, facing: "right", needs: "c3_in", blocked: "The gate warden has not finished." },
  ],
  wander: [{ groups: ["c3_hounds", "c3_guests"], count: 2, x: 4, y: 1, w: 24, h: 9, sprite: { kind: "creature", seed: "snarlhound", variant: "beast", a: "brick", b: "sand" } }],
  chests: [{ id: "s_chest1", x: 22, y: 9, item: "underbread", count: 2 }],
};

const snarl: MapDef = {
  id: "snarl",
  name: "The Snarl",
  theme: "snarl",
  music: "town",
  musicSeed: "snarl",
  caption: "The Snarl. Everyone here is married to everyone.",
  converge: [14, -6],
  rows: [
    "############################",
    "#..........................#",
    "#..|||....|||....|||....|||#",
    "#..|D|....|D|....|D|....|D|#",
    "#..........................#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#......,,,,,,,,,,,,,,......#",
    "#..........................#",
    "............................",
    "#..........V...............#",
    "#..|||....|||||||....|||...#",
    "#..|D|....||||D||....|D|...#",
    "#..........................#",
    "#...w.............x........#",
    "#..........................#",
    "############################",
  ],
  line: [[0, 14], [6, 14], [10, 13], [14, 10], [18, 13], [22, 14], [27, 14]],
  npcs: [
    { id: "mayoralty", x: 14, y: 8, sprite: { kind: "knot", seed: "mayoralty", variant: "big", a: "rose", b: "gold" }, name: "The Mayoralty", held: true, talk: "mayoralty", hideIf: "c3_boss" },
    { id: "lissom_npc", x: 11, y: 11, sprite: P("lissom", "rose", "salt", "tall"), name: "The dancer", note: "D", talk: "lissom_talk", hideIf: "c3_lissom" },
    { id: "looser", x: 6, y: 19, sprite: P("looser", "rose", "bone"), name: "A Looser", note: "A", talk: "looser", wander: true },
    { id: "knotter", x: 23, y: 19, sprite: P("knotter", "brick", "bone", "hat"), name: "A Knot", note: "G", talk: "knotter", wander: true },
    { id: "bride", x: 20, y: 4, sprite: P("bride", "salt", "rose", "robe"), name: "The Bride", note: "C", talk: "bride" },
    { id: "groom", x: 5, y: 4, sprite: P("groom", "salt", "plum", "hat"), name: "The Groom", note: "E", talk: "groom" },
    { id: "vendor", x: 21, y: 18, sprite: P("vendor", "clay", "rose"), name: "Vendor", note: "F", talk: "vendor" },
    { id: "elder", x: 8, y: 13, sprite: P("elder", "bone", "plum", "robe"), name: "An elder", note: "B", talk: "elder", wander: true },
    { id: "child3", x: 18, y: 19, sprite: P("child3", "sand", "rose", "small"), name: "Twine", note: "D", talk: "child3", wander: true },
    { id: "catcher3", x: 24, y: 13, sprite: P("catcher3", "moss", "bone", "hat"), name: "Knot-catcher", note: "F", talk: "catcher3" },
    { id: "fisher", x: 3, y: 18, sprite: P("fisher", "sea", "bone", "hat"), name: "The cistern keeper", note: "E", talk: "fisher" },
    SCRAP_NPC(25, 19),
  ],
  triggers: [
    { id: "snarl_in", x: 1, y: 13, w: 2, h: 3, on: "enter", once: true },
    { id: "snarl_gate_east", x: 26, y: 14, on: "enter", hideIf: "c3_boss" },
    { id: "snarl_house", x: 4, y: 3, on: "interact" },
    { id: "snarl_house2", x: 11, y: 3, on: "interact" },
    { id: "snarl_shop", x: 22, y: 17, on: "interact" },
    { id: "snarl_hall_door", x: 14, y: 17, on: "interact" },
    { id: "snarl_cistern", x: 4, y: 19, on: "interact" },
  ],
  exits: [
    { x: 0, y: 14, to: "snarl_road", tx: 30, ty: 6, facing: "left" },
    { x: 27, y: 14, to: "letout_road", tx: 1, ty: 6, facing: "right", needs: "c3_boss", blocked: "The Eastgate is pinned shut under the weight of the tangle." },
    { x: 14, y: 17, to: "snarl_hall", tx: 7, ty: 11, facing: "up", needs: "c3_trial", blocked: "The wedding hall. Closed except on the day of the dance." },
  ],
};

const hall: MapDef = {
  id: "snarl_hall",
  name: "The wedding hall",
  theme: "snarl",
  music: "dungeon",
  musicSeed: "hall",
  caption: "The wedding hall. The dance has not stopped in sixty years.",
  converge: [7, -4],
  rows: [
    "WWWWWWWWWWWWWWW",
    "WfffffffffffffW",
    "WfPfffffffffPfW",
    "WfffffffffffffW",
    "Wffff,,,,,ffffW",
    "Wffff,,,,,ffffW",
    "Wffff,,,,,ffffW",
    "Wffff,,,,,ffffW",
    "WfffffffffffffW",
    "WfPfffffffffPfW",
    "WfffffffffffffW",
    "WWWWWWWDWWWWWWW",
  ],
  npcs: [
    { id: "fiddler", x: 2, y: 5, sprite: P("fiddler", "brick", "gold"), name: "The fiddler", note: "A", talk: "fiddler" },
    { id: "guest1", x: 12, y: 3, sprite: P("guest1", "rose", "white", "robe"), name: "A guest", note: "D", talk: "guest" },
    { id: "guest2", x: 12, y: 8, sprite: P("guest2", "rose", "salt", "robe"), name: "A guest", note: "F", talk: "guest" },
  ],
  triggers: [
    { id: "hall_floor", x: 5, y: 4, w: 5, h: 4, on: "enter", once: true, hideIf: "c3_boss" },
    { id: "hall_cake", x: 12, y: 10, on: "interact" },
  ],
  exits: [{ x: 7, y: 11, to: "snarl", tx: 14, ty: 18, facing: "down" }],
};

// ---------------------------------------------------------------------------

async function theDance(ctx: ScriptContext): Promise<boolean> {
  const steps = ["Left", "Right", "Turn", "Hold"];
  const figures = [[0, 1, 2], [2, 0, 1, 3], [1, 1, 2, 0, 3]];
  let wrong = 0;
  for (let f = 0; f < figures.length; f++) {
    const seq = figures[f];
    await ctx.say(f === 0 ? "Figure one. Lissom dances it once. Watch the steps, then dance them back with the arrows. The steps are hidden while you dance: the Knots among the guests see to that." : `Figure ${f + 1}. Lissom dances it once.`, { speaker: "The dance" });
    const r = await ctx.minigame("knot", { knot: `figure${f + 1}`, seq, steps, keys: ["left", "right", "up", "down"], hide: true, title: `The Wedding, figure ${f + 1} of 3`, done: "Clean. Not one line crossed.", slip: "A stumble. Two lines brush. From the top." });
    const slips = Math.max(0, 3 - r.score);
    if (slips > 0) {
      wrong += slips;
      await ctx.say(r.won ? "A stumble, caught. Two guests' lines brushed and the fiddler did not stop. The fiddle has not stopped since the wedding." : "Fathom loses the figure. The guests' lines knot above the floor and the Knots among the guests pull them tighter.");
    }
  }
  if (wrong === 0) await ctx.say("Three figures, clean. The hall holds its breath. The guests sway together and not one line crosses another.");
  else await ctx.say(`${wrong} stumble${wrong > 1 ? "s" : ""}. The tangle overhead tightens a turn. The Knots among the guests look pleased.`);
  ctx.flag("c3_stumbles", wrong);
  return wrong === 0;
}

const scripts: Record<string, (ctx: ScriptContext) => Promise<void>> = {
  snarl_road_in: async (ctx) => {
    ctx.beat(0);
    await ctx.say("Ahead, a city. Its walls lean. All at once, slowly, left, then right, like a crowd listening. Above it the sky is not striped with lines. It is one thing. A mat. A knot a mile wide.");
    await ctx.speak("dulcet", "The Snarl. Sixty years ago there was a wedding and they danced. Every line in the city, one night. Nobody has left since. Listen to it. Two hundred notes at once and not one chord among them. A chord calls. Noise like this does not, and a Fish cannot find one line in it to bite. The Office calls it a nest. A nest is a place the sky has given up on.");
    await ctx.speak("burl", "Big knot. Bigger than me. Hello, big knot.");
  },
  snarl_road_well: async (ctx) => { await hooking(ctx, "snarl_road_well", { intro: "A sink by the road. The water in it leans the same way the city does." }); },
  leveler_snarl: async (ctx) => { await ctx.speak("leveler_snarl", "Posted to the Snarl. Nothing ever rises from the Snarl. I write 'nest, no bite' once a year and send it up the road and nobody reads it. Shore crew for a stretch of shore nothing comes to. I have a stamp. I have never used the stamp."); },
  gatekeep: async (ctx) => {
    if (ctx.inParty("dulcet") && ctx.inParty("burl") && !ctx.has("c3_in")) {
      await ctx.say("Before the gate Dulcet hauls her kite down, cuts it loose, and ties the end of her line into Burl's, above the knot, with a hitch Fathom does not know.");
      await ctx.speak("dulcet", "A kite will not get through a mat. Burl's line goes all the way up. Now so does mine.");
      await ctx.speak("burl", "Heavy.");
    }
    await ctx.speak("gatekeep", "Hold still. I need to see your lines go up into the mat before I open. Yours. Yours. Yours goes... nowhere. Nowhere! A cut one!");
    await ctx.say("The gate warden takes three fast steps back and the whole wall leans with him. Inside, two hundred people feel the tug and look up.");
    await ctx.speak("gatekeep", "The Mayoralty will want to see you. Or it will want you gone. Both, probably. In you go. Do not touch anything that is holding anything.");
    ctx.flag("c3_in");
    ctx.refresh();
  },
  snarl_in: async (ctx) => {
    ctx.beat(1);
    await ctx.say("Inside the Snarl every line leans toward the center. Walk ten steps and the whole city turns its head. The fallen line runs straight across the square, under a knot the size of a house, and out a gate on the far side that the weight above has pressed shut.");
    await ctx.speak("dulcet", "The gate will not open while the tangle is this tight. And the tangle is in the middle of the square, listening. Go and talk to it. I mean that.");
  },
  snarl_gate_east: async (ctx) => { await ctx.say("The Eastgate. The tangle above has pulled it shut like a drawstring. It has not opened in Lissom's lifetime."); },
  mayoralty: async (ctx) => {
    if (ctx.has("c3_trial")) { await ctx.say("The Mayoralty sways. Two hundred lines creak. 'DANCE,' it says, in two hundred voices one at a time."); return; }
    ctx.beat(2);
    await ctx.say("The knot in the square is as big as a house and made of two hundred lines going up. When Fathom stands near it, it moves. Not a wind. A vote.");
    await ctx.say("'CUT,' it says. It is not a voice. It is two hundred people pulling the same word at once, and the word comes down the lines like weather.", { speaker: "The Mayoralty" });
    await ctx.say("'A CUT ONE COULD UNTIE US. HALF OF US WANT THAT. HALF OF US WOULD RATHER BE A NEST FOREVER THAN BE BAIT AGAIN. THE GATE STAYS SHUT UNTIL WE KNOW WHICH HALF YOU ARE.'", { speaker: "The Mayoralty" });
    await ctx.say("'DANCE THE WEDDING. THE DANCER WILL SHOW YOU. DANCE IT WITHOUT TANGLING AND THE EASTGATE OPENS. TANGLE, AND YOU STAY, AND YOU ARE MARRIED TO ALL OF US, AND NOTHING WILL EVER BITE YOU AGAIN.'", { speaker: "The Mayoralty" });
    await ctx.speak("burl", "That is a bad deal.");
    await ctx.speak("dulcet", "It is a good deal. They dance in a circle. You cannot tangle. You have nothing to tangle with. Find the dancer.");
    ctx.flag("c3_asked");
  },
  lissom_talk: async (ctx) => {
    if (!ctx.has("c3_asked")) { await ctx.say("A tall woman is dancing by herself at the edge of the square, very slowly, in a circle one step wide, counting under her breath. Her line goes up into the mat like everyone's. She does not stop to talk."); return; }
    ctx.beat(3);
    await ctx.speak("lissom", "One, two, three, and. You are the cut one. Good. Four, five. I have danced the Wedding alone every year for twenty years because nobody else is allowed to move that much. Six. My left knee knows all three figures. My right knee has opinions.");
    await ctx.speak("lissom", "Three figures. I teach you, we dance them in the hall, the Knots try to make you stumble, and if you do not, the gate opens. And then I leave with you. That is my price. I want to dance in a straight line before something eats me.");
    await ctx.say("Lissom shows Fathom how two lines can be made to cross on purpose. Tangle: tie two foes together. What one takes, the other takes. When one moves, the other is late.");
    await ctx.join("lissom");
    ctx.flag("c3_lissom");
    ctx.refresh();
    const r = await ctx.battle("c3_hounds", { canFlee: false, loseAllowed: true });
    if (r === "win") await ctx.speak("lissom", "The hounds here are born in pairs, tangled. They never learned to be one thing. Neither did this city. One, two.");
    ctx.flag("c3_trial");
    await ctx.speak("lissom", "The hall is on the south side of the square. The fiddle has not stopped since the wedding. Come when you are ready. Bring the knot. Knots make the Knots nervous.");
  },
  hall_floor: async (ctx) => {
    ctx.beat(4);
    await ctx.say("The wedding hall. The guests stand round the floor in the clothes they were married in, mended and mended. The fiddler plays. The fiddler is very old and does not look up.");
    await ctx.speak("lissom", "Three figures. Watch, then follow. The Knots among the guests will pull on the mat to throw you. Ignore them. Watch me. And one, and two.");
    const clean = await theDance(ctx);
    await ctx.say("The last figure ends. For one breath nothing in the hall moves. Then the mat above the city pulls, hard, all at once.");
    ctx.beat(5);
    await ctx.say("'NO,' says half the Snarl, and the other half says 'YES,' and the Mayoralty comes down through the roof on two hundred lines, a knot with two hundred minds, to settle it the way it settles everything.", { speaker: "The Mayoralty" });
    await ctx.speak("lissom", clean ? "You did not tangle. Remember that. Whatever it does, it cannot say you tangled." : "You stumbled. It felt that. It is a turn tighter than it was. Dance anyway. Five, six.");
    const r = await ctx.battle(clean ? "c3_boss" : "c3_boss_tight", { canFlee: false });
    if (r !== "win") return;
    ctx.flag("c3_boss");
    ctx.refresh();
    ctx.beat(6);
    await ctx.say("The Mayoralty sags. Not untied. Loosened, one turn, for the first time in sixty years. Over the square the Eastgate groans and lifts a hand's width off the ground.");
    await ctx.say("Inside the loosened knot, pressed flat, is a stretch of Fathom's line with knots tied in it. The tangle had been chewing the words for a week.");
    await ctx.knot("m3", "IT WILL CROSS THE NEST", "Dulcet");
    await ctx.speak("dulcet", "Cross the nest. Written before you were cut. Fathom, it does not say if. It never says if.");
    await ctx.speak("lissom", "Then it has not met me. Seven, eight. I will come back and teach them to dance it loose, a figure a year, and it will take a hundred years and nothing in that file knows I decided that just now.");
    ctx.taught("snarl");
    await ctx.camp([
      { a: "fathom", b: "lissom", lines: [["lissom", "Does it hurt? Being cut."], ["fathom", "It does not. I keep waiting for it to."], ["lissom", "I have felt like a clock for twenty years. I would take waiting. One, two."]] },
      { a: "dulcet", b: "lissom", lines: [["dulcet", "Your line is a D. A good one. The Fish would like it. You are lucky it is in a nest."], ["lissom", "Lucky. Three, four. Nothing has ever bitten me and I have never left the square. Which of us is lucky, harpist?"], ["dulcet", "Neither. You are kept and I am hidden. Same price, different shelf."]] },
      { a: "burl", b: "lissom", lines: [["burl", "You dance. I roll. Same."], ["lissom", "It is not the same."], ["burl", "Both go round. Both come back. Same."]] },
      { a: "fathom", b: "burl", lines: [["burl", "Big knot could talk. I talk. Am I a city?"], ["fathom", "You are a Burl."], ["burl", "Three hooks. One Burl. Good."]] },
    ]);
    ctx.beat(7);
    await ctx.say("Fathom crawls under the Eastgate through the gap and hauls on the gate chain from the far side. The gate rises the rest of the way, for the first time in Lissom's life.");
    await ctx.speak("lissom", "One turn looser is one line free. Mine. Nine.");
    await ctx.say("Lissom's line slides out of the mat as she walks, and runs straight up, and does not lean. Beyond the gate the country is flat and the air is dry. On the horizon something tall turns, slowly, and lets out line.");
    ctx.flag("c3_done");
    await ctx.nextChapter();
  },
  hall_cake: async (ctx) => { await ctx.say("The wedding cake. Sixty years old and rebaked every morning around the original, which is in the middle somewhere, like a stone in a fruit. Somebody has written on the icing: STILL GOING."); },
  fiddler: async (ctx) => {
    if (ctx.has("c3_fiddle")) { await ctx.speak("fiddler", "The bridge. Yes. Eight bars. My father said it came down a line, in knots, the spring of the wedding, and the Office wrote it out for fiddle. I just keep it going."); return; }
    ctx.flag("c3_fiddle");
    await ctx.speak("fiddler", "Sixty years. The same tune. My father played the wedding and handed me the bow in the middle of a bar, and I have not put it down. If I stop, the dance stops, and if the dance stops the tangle sets like glue. Would you like to hear the bridge?");
    await ctx.say("The fiddler plays the bridge. Eight bars. Fathom has a tuner's ear, and the bridge is the choir's chord, the one the Office pays for, played backward, slowly, as if something were being called away instead of toward.");
    ctx.sfx("note:G"); await ctx.wait(0.3); ctx.sfx("note:E"); await ctx.wait(0.3); ctx.sfx("note:C"); await ctx.wait(0.5);
    await ctx.say("Nobody in the hall seems to hear it. Dulcet does. Dulcet has gone very still.");
    await ctx.speak("dulcet", "The choir chord, backward. A chord calls. That one sends away. Something up there does not want a bite out of a knot this size. It would pull the whole city up on one hook.");
  },
  guest: async (ctx) => { await ctx.speak("guest1", "I was eleven at the wedding. I had cake. I have been standing here since. I am seventy-one and nothing has ever bitten me, and I would like, very much, to sit down."); },
  looser: async (ctx) => { await ctx.speak("looser", "Untie us. Please. One turn. I would take one turn. I have a cousin in Rafter I have never met and she is seventy, and she hums, and I do not know how to tell her to stop."); },
  knotter: async (ctx) => { await ctx.speak("knotter", "We are one thing. One city, one line, one vote, and nothing has bitten one of us in sixty years. Untie that and what is left? Two hundred strangers in a square, humming. Go home, cut one."); },
  bride: async (ctx) => {
    if (ctx.errandDone("groom")) { await ctx.speak("bride", "He said my name. Across the square. I heard it come down the line. Sixty years and I had forgotten what it sounded like in his mouth."); return; }
    await ctx.speak("bride", "I said I do, and then everyone danced, and then everyone was married. To everyone. It was a lovely wedding. It is still going. He is right there, across the square, and our lines cross forty times and I cannot reach him.");
    if (ctx.has("c3_lissom")) {
      const i = await ctx.choose(["Carry a word to him", "Not now"], { cancel: true });
      if (i !== 0) return;
      await ctx.speak("bride", "Tell him: the cake was dry. He will know. Only he would know.");
      ctx.flag("c3_bridemsg");
    }
  },
  groom: async (ctx) => {
    if (ctx.errandDone("groom")) { await ctx.speak("groom", "The cake was dry. It was. I have said nothing for sixty years because it was dry and she made it. Thank you. Here. I kept this for the honeymoon."); return; }
    if (ctx.has("c3_bridemsg")) {
      await ctx.speak("groom", "A word from her? Say it.");
      await ctx.say("Fathom says it. The cake was dry.");
      await ctx.speak("groom", "...It was. It was. I have said nothing for sixty years because it was dry and she made it. Her name is Linnet. I am going to say it. LINNET.");
      await ctx.say("The groom says it loud enough to go up his line and down forty others. Across the square, the Bride puts a hand to her chest.");
      ctx.errand("groom");
      await ctx.giveSlugs(60);
      await ctx.give("l_echo");
      return;
    }
    await ctx.speak("groom", "She is right there and I have not reached her in sixty years. Our lines cross forty times above the square. I can feel her lean. I have never been bitten, and I would trade that to touch her hand.");
  },
  vendor: async (ctx) => { await ctx.speak("vendor", "Wedding cake, sixty years old and rebaked every morning. Also bread. Also sinkers, for when the mat pulls. Also lures, though nobody here needs lures, nothing comes for a nest."); await ctx.shop(["flatbread", "underbread", "slugpouch", "salve", "spool", "w_sinker", "w_bob", "g_hemp", "g_pluck", "s_felt", "l_brass", "l_mute"], "The wedding table"); },
  elder: async (ctx) => { await ctx.speak("elder", "The mat thinks. Do not let anyone tell you it does not. Two hundred people pulling the same way for sixty years is a thought. It is just a slow one. Its thought is: nothing can bite a knot. It is correct. It is also a knot."); },
  child3: async (ctx) => {
    if (ctx.errandDone("twine")) { await ctx.speak("child3", "You opened it! You opened it and I saw OUT and it was brown. Twine saw out. Outside is brown."); return; }
    await ctx.speak("child3", "I was born here so I am married to everyone too. I am Twine. I want to see the Eastgate open. Nobody has. Will you do it? Do it. I will give you my best thing.");
    if (ctx.has("c3_boss")) { ctx.errand("twine"); await ctx.say("Twine's best thing is a slug with a hole through it that whistles when you swing it on a string. Something up there would love it. Fathom takes it."); await ctx.give("l_bell"); }
  },
  catcher3: async (ctx) => { await bounty(ctx, "mats", "catcher3", "Knot-catcher. The Snarl sheds mats, floor-knots that get up and walk, and the Knots pay me to bag them. Sixty slugs a mat if you bring me the loose ends.", "c3_mat", 60, "A mat. Bagged. The Knots will be pleased. The Loosers will not. I get paid either way."); },
  fisher: async (ctx) => { await ctx.speak("fisher", "The cistern. Nothing bites in a nest, so nothing hunts in a nest, so the water under the Snarl is the only water on the Drop that is full. I keep it. Nobody drinks it. Everyone is afraid of what is in it. What is in it is fat and slow and delicious."); },
  snarl_cistern: async (ctx) => { await hooking(ctx, "snarl_cistern", { hard: false, intro: "The cistern under the Snarl. Nothing hunts here, so the water is full, and whatever is in it has never learned to be afraid of a line." }); },
  snarl_house: async (ctx) => { await ctx.say("A house with no roof at all. Why would it have one? The mat above keeps the rain off the whole city, and the mat is why nothing comes up through the floor."); },
  snarl_house2: async (ctx) => { await ctx.say("Inside, a man is leaning left on purpose, very slowly, to see if the city will lean with him. It does. He grins. He has been doing this for forty years and it is still the best thing he knows."); },
  snarl_shop: async (ctx) => { await scripts.vendor(ctx); },
  snarl_hall_door: async (ctx) => { if (!ctx.has("c3_trial")) await ctx.say("The hall is shut. Fiddle music comes through the door, the same eight bars, over and over, and then a bridge Fathom cannot quite hear."); },
  scrap_talk: scrapTalk,
};

export const ch3: Chapter = {
  n: 3,
  title: "The Snarl",
  subtitle: "Crossing the threshold",
  maps: [approach, snarl, hall],
  scripts,
  beats: ["A city under one knot, leaning as one. A nest.", "The Eastgate is pinned shut. The city votes.", "Dance the Wedding, the Mayoralty says", "Lissom, the only one allowed to move", "The hall, the fiddler, three figures", "The Mayoralty comes down to settle it", "Dulcet reads: IT WILL CROSS THE NEST", "Through the gate, into a country that does not lean"],
  goal: (g) => {
    const f = g.flags;
    if (f.c3_done) return "East, into the Let-Out.";
    if (f.c3_boss) return "Rest, then leave by the Eastgate.";
    if (f.c3_trial) return "Go to the wedding hall on the south side of the square and dance.";
    if (f.c3_asked) return "Find the dancer at the edge of the square.";
    if (f.c3_in) return "Talk to the Mayoralty, the knot in the middle of the square.";
    return "Follow the line east to the Snarl's gate.";
  },
  start: async (ctx) => {
    await ctx.card("Chapter 3", "The Snarl", { beat: "Crossing" });
    await ctx.teleport("snarl_road", 1, 6, "right");
  },
  debugStart: { map: "snarl_road", x: 1, y: 6, level: 7, flags: { c2_done: true } },
};
