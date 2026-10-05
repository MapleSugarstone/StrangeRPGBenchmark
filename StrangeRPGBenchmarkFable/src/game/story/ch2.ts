import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, prop, chest, lampSprite, cave, at, shape } from "./common";

const churchRoad: MapDef = {
  id: "church_road", name: "The North Road", chapter: 2, outside: "black", legend: LEGEND, encounters: "church_road", encounterRate: 0.07,
  grid: [
    "TTTTTTTTT=TTTTTTTTTT",
    "T,,,,,,,,=,,,,,,T,,T",
    "T,,T,,,,,=,,,,,,,,,T",
    "T,,,,,,,,=,,,T,,,,,T",
    "T,,,,,,,,=,,,,,,,,,T",
    "T,,,,,,==,,,,,,,,,,T",
    "T,T,,,,=,,,,,,,,T,,T",
    "T,,,,,,=,,,,,,,,,,,T",
    "T,,,,,,=,,,,,,,,,,,T",
    "T,,,,,,,==,,,,,,,,,T",
    "T,,,,,,,,=,,,,,,,,,T",
    "T,,,T,,,,=,,,,T,,,,T",
    "T,,,,,,,,=,,,,,,,,,T",
    "T,,,,,,,,==,,,,,,,,T",
    "T,,,,,,,,,=,,,,,,,,T",
    "T,,,,,,,,,=,,,,,,,,T",
    "T,,T,,,,,,=,,,,T,,,T",
    "T,,,,,,,,,=,,,,,,,,T",
    "T,,,,,,,,,=,,,,,,,,T",
    "T,,,,,,,,,=,,,,,,,,T",
    "T,,,,,,,,==,,,,,,,,T",
    "T,,,,,,,,=,,,,,,,,,T",
    "T,,,T,,,,=,,,T,,,,,T",
    "T,,,,,,,,=,,,,,,,,,T",
    "T,,,,,,,,=,,,,,,,,,T",
    "TTTTTTTTT=TTTTTTTTTT",
  ],
  entities: [
    { id: "south", kind: "door", x: 9, y: 25, to: { map: "rimward", x: 12, y: 1, dir: "down" } },
    { id: "north", kind: "door", x: 9, y: 0, to: { map: "church", x: 10, y: 22, dir: "up" } },
    { id: "chest1", kind: "chest", x: 3, y: 7, sprite: chest(), items: ["brine", "lamp_wick"] },
    { id: "chest2", kind: "chest", x: 16, y: 17, sprite: chest(), gold: 30 },
    { id: "pilgrim", kind: "npc", x: 11, y: 12, dir: "left", sprite: npc("pilgrim-coin", "purple", "salt"), script: "road.pilgrim", name: "Pilgrim" },
    { id: "lamp", kind: "lamp", x: 8, y: 13, sprite: lampSprite(), name: "Lamp", solid: true },
  ],
};

const church: MapDef = {
  id: "church", name: "The Vending Church", chapter: 2, outside: "black", legend: LEGEND,
  grid: [
    "######################",
    "#uuuuuuuuuuuuuuuuuuuu#",
    "#uuuuuuuuSuuuuuuuuuuu#",
    "#uuuPuuuuuuuuuuuPuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuPuuuuaaaauuuuPuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuPuPuuuaaaauuuPuPuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuPuPuuuaaaauuuPuPuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuPuPuuuaaaauuuPuPuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuPuPuuuaaaauuuPuPuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuaaaauuuuuuuu#",
    "#uuuuuuuuuuuuuuuuuuuu#",
    "##########DD##########",
    "          DD          ",
  ],
  entities: [
    { id: "out", kind: "door", x: 10, y: 23, to: { map: "church_road", x: 9, y: 1, dir: "down" } },
    { id: "out2", kind: "door", x: 11, y: 23, to: { map: "church_road", x: 9, y: 1, dir: "down" } },
    { id: "vendor", kind: "shop", x: 10, y: 1, sprite: shape("vendor", "yellow", "purple", "box"), name: "The Vendor (praise it)", stock: ["salt_biscuit", "brine", "lamp_wick", "antidote", "candle", "spark_jar", "habit", "hymn_rod", "glass_blade"], solid: true },
    { id: "vane", kind: "npc", x: 11, y: 4, dir: "down", sprite: npc("sister-vane", "purple", "yellow"), script: "church.vane", hideIf: "ch2.vaneJoined", name: "Sister Vane" },
    { id: "sister1", kind: "npc", x: 5, y: 9, dir: "right", sprite: npc("sister-ash", "purple", "gray"), script: "church.sister1", wander: true, name: "Sister Ash" },
    { id: "sister2", kind: "npc", x: 17, y: 13, dir: "left", sprite: npc("sister-penny", "purple", "white"), script: "church.sister2", wander: true, name: "Sister Penny" },
    { id: "beggar", kind: "npc", x: 3, y: 19, dir: "right", sprite: npc("beggar-coin", "gray", "brown"), script: "church.beggar", name: "Coinless" },
    { id: "backdoor", kind: "door", x: 9, y: 2, to: { map: "church_inner", x: 2, y: 2, dir: "down" }, showIf: "ch2.hasKey" },
    { id: "backdoorlocked", kind: "trigger", x: 9, y: 2, script: "church.locked", hideIf: "ch2.hasKey" },
    { id: "lamp", kind: "lamp", x: 2, y: 2, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "chest1", kind: "chest", x: 19, y: 20, sprite: chest(), items: ["candle", "salt_biscuit"] },
    { id: "northgate", kind: "trigger", x: 20, y: 1, script: "church.northgate" },
  ],
};

const churchInner = cave({
  id: "church_inner", name: "Beneath the Church", chapter: 2, floor: "u", wall: "#", encounters: "church_inner", encounterRate: 0.09, decor: "P", decorCount: 8,
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "church", x: 9, y: 3, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "gray", b: "salt", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.3)[0], y: at(cells, 0.3)[1], sprite: chest(), items: ["brine", "spark_jar"] },
      { id: "chestB", kind: "chest", x: at(cells, 0.55)[0], y: at(cells, 0.55)[1], sprite: chest(), items: ["hymn_rod"] },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "clerkghost", kind: "npc", x: at(cells, 0.45)[0], y: at(cells, 0.45)[1], sprite: npc("clerk-ghost", "dark", "yellow"), script: "inner.clerk", name: "Clerk" },
      { id: "metronome", kind: "boss", x: far[0], y: far[1], sprite: shape("metronome-boss", "dark", "yellow", "clock"), script: "inner.metronome", hideIf: "ch2.metronomeBeaten", solid: true },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch2.intro": async (c) => {
    c.step(1);
    await c.narrate("A season later. The Lamp has held. Oxbow has appointed himself Knight of Rimward and polishes the sign every morning.");
    await c.say("Oxbow", "Pell. The Lamp did a thing. A small thing. It went dark for the length of one blink.", "oxbow");
    await c.say("Pell", "Lamps blink.", "pell");
    await c.say("Oxbow", "That is what you said last time. I have begun writing down the things you say that turn out wrong. It is a short list, but it is a list.", "oxbow");
    await c.narrate("(The Elder is in the square. Talk to her, then the Lamp.)");
  },
  "rimward.elder.ch2": async (c) => {
    if (c.get("ch2.told")) { await c.say("Elder Marrow", "North. Up the road. Ask the Sisters for time. And Pell. Come back."); return; }
    c.flag("ch2.told");
    c.step(2);
    await c.say("Elder Marrow", "A season. I said a season or two, and it was one. The wick is fine. It is the light that is thinner.");
    await c.say("Elder Marrow", "There is a church up the north road. The Vending Church. They keep the Metronome, and the Metronome rations the Ember's light to every Lamp on the Rim.");
    await c.say("Elder Marrow", "Go and ask the Sisters for more time. Take the knight. He is making the children nervous.");
    await c.say("Pell", "Nobody walks the north road.", "pell");
    await c.say("Elder Marrow", "Nobody walked into the Cellar either.");
  },
  "rimward.lamp.ch2": async (c) => {
    if (c.get("ch2.vaneJoined")) {
      await c.narrate("The Lamp burns steady. Steadier than it has in a year.");
      await c.say("Sister Vane", "The Metronome will keep this lit a while. Not forever. Nothing is forever except the Vendor, and even the Vendor needs coins.", "vane");
      await c.game.useLamp(c.entity!);
      return;
    }
    await c.narrate("The Lamp burns, but you can see the glass behind the flame now. Last year you could not.");
    await c.game.useLamp(c.entity!);
  },
  "rimward.north.ch2": async (c) => {
    if (!c.get("ch2.told")) { await c.say("Pell", "The Elder first.", "pell"); c.state.map.y = 1; c.game.overworld?.resetTrail(); return; }
    if (!c.get("ch2.wentNorth")) { c.flag("ch2.wentNorth"); c.step(3); await c.narrate("The north road. Trees on both sides, salt in the ruts. Nobody from Rimward has walked it in years. You walk it."); }
    await c.goto("church_road", 9, 24, "up");
  },
  "rimward.hob.ch2": async (c) => { await c.say("Old Hob", "Church folk pay in coins, not salt. Take some salt anyway. Everyone wants salt once they're far enough from it."); },
  "rimward.bit.ch2": async (c) => { await c.say("Bit", "Oxbow let me hold his arm. The arm came off. He said that was supposed to happen."); },
  "road.pilgrim": async (c) => {
    await c.say("Pilgrim", "Going to the Church? Bring a coin. Any coin. The Vendor takes everything and gives you something back, and the something is the prayer.");
    await c.say("Pilgrim", "I put in my wedding ring. I got a biscuit. I think about that biscuit a lot.");
  },
  "church_road.enter": async (c) => {
    if (c.get("ch2.roadEntered")) return;
    c.flag("ch2.roadEntered");
    await c.say("Oxbow", "A road! A knight on a road. This is the correct configuration.", "oxbow");
  },
  "church.enter": async (c) => {
    if (c.get("ch2.churchEntered")) return;
    c.flag("ch2.churchEntered");
    c.step(4);
    await c.narrate("The Vending Church. A long hall of pews facing a machine the size of a house. Its front is glass, and behind the glass are small things on hooks: biscuits, wicks, candles, a shoe.");
    await c.narrate("Women in purple move between the pews. Each one stops at the machine, puts in a coin, and kneels while it hums.");
  },
  "church.vane": async (c) => {
    if (c.get("ch2.metronomeBeaten")) {
      c.step(7);
      await c.say("Sister Vane", "You stopped it. I felt the count change under my feet. The whole Rim felt it.");
      await c.say("Sister Vane", "Here is the thing I did not tell you, because you would have left. The Metronome rations the light. It does not make any. The Ember is still going out.");
      await c.say("Sister Vane", "The Church has prayed for three hundred years for someone to go to the Crown. We prayed to a vending machine. We are not clever. But you came.");
      await c.say("Pell", "I came for more time for one Lamp.", "pell");
      await c.say("Sister Vane", "And you got it. Now get the rest. I am coming. The Vendor told me to. It gave me a map and a shoe.");
      await c.join("vane");
      c.flag("ch2.vaneJoined");
      await c.give("steppe_pass");
      await c.narrate("(The gate to the Glass Steppe is at the top right of the hall. Rimward's Lamp is safe for now. Go when you are ready.)");
      return;
    }
    if (c.get("ch2.hasKey")) { await c.say("Sister Vane", "Down the stairs behind me. It counts faster the deeper you go. Watch the strip."); return; }
    c.flag("ch2.hasKey");
    c.step(4);
    await c.say("Sister Vane", "You walked up from the Rim. I can tell. Salt in the eyebrows.");
    await c.say("Pell", "Our Lamp is dying. The Elder said to ask for more time.", "pell");
    await c.say("Sister Vane", "Everyone's Lamp is dying. The Metronome is counting too fast. It is under the Church, and it is wrong, and I am the only Sister who will say so out loud.");
    await c.say("Sister Vane", "If you are going down there, you need to see time the way it does. Here. Watch the strip.");
    await c.unlock("tempo");
    await c.say("Sister Vane", "Fast things act more often. Jingle pushes a foe later. Delay gives up your turn to get the next one sooner. The Metronome plays this game better than anyone. Play it anyway.");
    await c.say("Sister Vane", "Take the key. The back room is behind me. There is a Lamp down there, and a Clerk who will try to sell you a watch.");
    await c.give("church_key");
    await c.give("brine", 2);
  },
  "church.sister1": async (c) => { await c.say("Sister Ash", "Sister Vane talks to the Vendor like it talks back. The thing is, sometimes it does."); },
  "church.sister2": async (c) => { await c.say("Sister Penny", "I put in a coin every morning and get a biscuit every morning. That is faith. Or breakfast. The Church says there is no difference."); },
  "church.beggar": async (c) => {
    if (!c.get("ch2.beggar")) { c.flag("ch2.beggar"); await c.say("Coinless", "Spare a coin? No? A biscuit then? No? Then take this. It's a tooth. The Bank wants it. I don't."); await c.give("tooth"); return; }
    await c.say("Coinless", "The Bank of Teeth is past the Steppe, past the Library, past the Fold. Everything is past something.");
  },
  "church.locked": async (c) => { await c.narrate("A door with a coin slot instead of a lock. Sister Vane, by the altar, is watching you try it."); c.state.map.y = 3; c.game.overworld?.resetTrail(); },
  "church.northgate": async (c) => {
    if (!c.get("ch2.vaneJoined")) { await c.narrate("A gate of green glass. Beyond it the ground is glass too, and the light goes down into it forever. It is locked."); c.state.map.x = 19; c.game.overworld?.resetTrail(); return; }
    const i = await c.ask("The Glass Steppe. Go now?", ["Go", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.x = 19; c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.say("Pell", "Last year I said no.", "pell");
    await c.say("Sister Vane", "And this year?", "vane");
    await c.say("Pell", "This year I'm saying it's a long way and we should get going.", "pell");
    await c.say("Oxbow", "That is a yes. I am writing it down as a yes.", "oxbow");
    await c.narrate("Chapter 2 ends. The gate opens onto glass.");
    await c.endChapter();
  },
  "church_inner.enter": async (c) => {
    if (c.get("ch2.innerEntered")) return;
    c.flag("ch2.innerEntered");
    c.step(5);
    await c.narrate("Under the Church. The walls tick. Every pillar is a pendulum that has stopped at a different hour.");
  },
  "inner.clerk": async (c) => {
    if (!c.get("ch2.clerkTalk")) {
      c.flag("ch2.clerkTalk");
      await c.say("Clerk", "Watches! Pocket watches! Each one runs at a different speed, all of them wrong, all of them cheap.");
      await c.say("Clerk", "The big one at the bottom runs fastest. It swallowed a tooth last spring and it has been counting double ever since. Don't tell the Sisters I said so.");
      await c.give("metronome");
      await c.say("Clerk", "That one's free. It's broken. It makes you faster. Those are the same thing.");
      return;
    }
    await c.say("Clerk", "Tick. Tock. Tick. Tick. See? Wrong.");
  },
  "inner.metronome": async (c) => {
    c.step(5);
    await c.narrate("The Metronome. A brass wedge the height of the cave, its arm swinging so fast the air whistles. There is something small and white wedged in its pivot.");
    await c.say("The Metronome", "ONE. TWO. ONE. TWO. ONETWO. ONETWO.");
    await c.say("Sister Vane", "That is not a prayer. That is a seizure. Jingle it when it winds up. Delay when you are empty.", "vane");
    const r = await c.battle(["metronome"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch2.metronomeBeaten");
    c.step(6);
    await c.narrate("The arm slows. Swings. Slows. Pell reaches into the pivot and pulls out a tooth, white and whole, with a tiny number stamped on the root.");
    await c.say("The Metronome", "...one. ...two. ...one. ...two.");
    await c.say("Oxbow", "That is the correct count. I have counted along to verify.", "oxbow");
    await c.give("tooth");
    await c.narrate("(Sister Vane is waiting by the altar upstairs.)");
  },
};

export const chapter2: ChapterDef = {
  n: 2,
  title: "Tempo",
  journey: "Refusal, and the mentor",
  mechanic: "tempo",
  maps: [churchRoad, church, churchInner],
  scripts,
  start: { map: "rimward", x: 12, y: 12, dir: "up" },
  intro: scripts["ch2.intro"],
  circle: ["A season of light", "The blink", "The north road", "Pews and coins", "The count below", "A tooth in the pivot", "A Sister with a shoe", "Pell says it's a long way"],
};
