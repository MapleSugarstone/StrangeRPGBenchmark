import type { ChapterDef, Script } from "./chapters";
import type { MapDef, Entity } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature, shape } from "./common";
import { WORDS } from "../data/items";

const wordChest = (id: string, word: string, x: number, y: number): Entity => ({ id, kind: "chest", x, y, sprite: shape(`word-${word}`, "yellow", "white", "star"), script: "crown.word", name: word });

const gate: MapDef = {
  id: "crown_gate", name: "The Crown's Gate", chapter: 9, outside: "black", legend: LEGEND,
  grid: [
    "YYYYYYYYYYYYYYYYYYYY",
    "YyyyyyyyyyyyyyyyyyyY",
    "YyyYYyyyyyyyyyyYYyyY",
    "YyyyyyyyyLyyyyyyyyyY",
    "YyyyyyyyyyyyyyyyyyyY",
    "YyyyyyyyyyyyyyyyyyyY",
    "YyyYYyyyyyyyyyyYYyyY",
    "YyyyyyyyyyyyyyyyyyyY",
    "YYYYYYYYYDDYYYYYYYYY",
    "         DD         ",
  ],
  entities: [
    { id: "back", kind: "trigger", x: 9, y: 9, script: "gate.back" },
    { id: "back2", kind: "trigger", x: 10, y: 9, script: "gate.back" },
    { id: "lamp", kind: "lamp", x: 9, y: 3, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "moth", kind: "npc", x: 10, y: 4, dir: "down", sprite: shape("bigmoth", "salt", "pink", "moth"), script: "gate.moth", name: "The Moth" },
    { id: "vendor", kind: "shop", x: 16, y: 4, sprite: shape("vendor-end", "yellow", "purple", "box"), name: "The Vendor (it followed you)", stock: ["brine", "lamp_wick", "antidote", "moth_dust", "tonic", "candle", "tooth", "hour_hand", "tooth_saw", "ledger_vest", "map_cloak", "leech_tooth", "metronome"], solid: true },
    wordChest("w1", "w_burn", 2, 7),
    wordChest("w2", "w_foe", 17, 7),
    wordChest("w3", "w_quiet", 2, 1),
    { id: "loomgate", kind: "trigger", x: 17, y: 1, script: "gate.loomgate" },
  ],
};

const loom = cave({
  id: "crown_loom", name: "The Loom", chapter: 9, floor: "y", wall: "Y", w: 34, h: 26, fill: 0.42, encounters: "crown", encounterRate: 0.08, decor: "P", decorCount: 10, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "crown_gate", x: 17, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "yellow", b: "white", variant: "stairs" } },
      wordChest("w4", "w_freeze", at(cells, 0.2)[0], at(cells, 0.2)[1]),
      wordChest("w5", "w_foes", at(cells, 0.35)[0], at(cells, 0.35)[1]),
      wordChest("w6", "w_mend", at(cells, 0.5)[0], at(cells, 0.5)[1]),
      wordChest("w7", "w_friend", at(cells, 0.6)[0], at(cells, 0.6)[1]),
      wordChest("w8", "w_loud", at(cells, 0.7)[0], at(cells, 0.7)[1]),
      { id: "chestA", kind: "chest", x: at(cells, 0.42)[0], y: at(cells, 0.42)[1], sprite: chest(), items: ["tonic", "moth_dust", "moth_dust"] },
      { id: "builder", kind: "npc", x: at(cells, 0.55)[0], y: at(cells, 0.55)[1], sprite: npc("builder-ghost", "gray", "teal"), script: "loom.builder", name: "Builder" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "down", kind: "door", x: far[0], y: far[1], to: { map: "crown_deep", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "yellow", variant: "stairs" } },
    ];
  },
});

const deep = cave({
  id: "crown_deep", name: "The Weave", chapter: 9, floor: "y", wall: "Y", w: 28, h: 22, fill: 0.46, encounters: "crown_deep", encounterRate: 0.1, decor: "P", decorCount: 6, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "crown_loom", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "yellow", b: "white", variant: "stairs" } },
      wordChest("w9", "w_shock", at(cells, 0.25)[0], at(cells, 0.25)[1]),
      wordChest("w10", "w_friends", at(cells, 0.4)[0], at(cells, 0.4)[1]),
      wordChest("w11", "w_twice", at(cells, 0.55)[0], at(cells, 0.55)[1]),
      wordChest("w12", "w_slow", at(cells, 0.65)[0], at(cells, 0.65)[1]),
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "theloom", kind: "boss", x: far[0], y: far[1], sprite: shape("the_loom", "white", "yellow", "clock"), script: "deep.loom", hideIf: "ch9.loomBeaten", solid: true },
      { id: "crown", kind: "prop", x: far[0], y: far[1], sprite: { kind: "item", seed: "mothcrown", a: "yellow", b: "pink", variant: "gem" }, script: "deep.crown", showIf: "ch9.loomBeaten", hideIf: "ch9.hasCrown", solid: true },
      { id: "emberdoor", kind: "trigger", x: far[0], y: far[1], script: "deep.emberdoor", showIf: "ch9.hasCrown" },
    ];
  },
});

const ember: MapDef = {
  id: "ember_chamber", name: "The Ember", chapter: 9, outside: "black", legend: LEGEND,
  grid: [
    "YYYYYYYYYYYYYYYYYY",
    "YeeeeeeeeeeeeeeeeY",
    "YeeeeeelllleeeeeeY",
    "YeeeeelllllleeeeeY",
    "YeeeeelllllleeeeeY",
    "YeeeeeelllleeeeeeY",
    "YeeeeeeeeeeeeeeeeY",
    "YeeeeeeeeeeeeeeeeY",
    "YeeeeeeeeeeeeeeeeY",
    "YYYYYYYYYYYYYYYYYY",
  ],
  entities: [
    { id: "theember", kind: "boss", x: 8, y: 6, sprite: creature("the_ember", "red", "yellow"), script: "ember.face", hideIf: "ch9.done", solid: true },
    { id: "lamp", kind: "lamp", x: 2, y: 8, sprite: lampSprite(), name: "Lamp", solid: true },
  ],
};

function giveWord(c: Parameters<Script>[0], id: string): void {
  if (!c.state.words.includes(id)) c.state.words.push(id);
}

const scripts: Record<string, Script> = {
  "ch9.intro": async (c) => {
    c.step(1);
    await c.narrate("The Moth Crown. Not a crown. A room at the center of the Shell where the Builders put on a circle of light and talked to the thing they built everything around.");
    await c.narrate("The Loom is awake. It is weaving. What it weaves is the end, neatly, with no loose threads.");
    await c.say("The Moth", "The Builders spoke to the Loom in words. Three at a time. A verb, a noun, a shape. The words are scattered here. I have been collecting them for ten thousand years and I cannot say them. I have no mouth for it. You do.");
    await c.unlock("words");
    giveWord(c, "w_burn"); giveWord(c, "w_foe"); giveWord(c, "w_quiet");
    await c.narrate("Learned: BURN, FOE, QUIETLY. (Cast from the battle menu. Three words make a spell. Find more in the star chests.)");
  },
  "gate.back": async (c) => { await c.narrate("Down is the Stage. Up is the end. Up."); c.state.map.y = 7; c.game.overworld?.resetTrail(); },
  "gate.moth": async (c) => {
    if (c.get("ch9.hasCrown")) { await c.say("The Moth", "You are wearing it. It is lighter than it should be. Go and say what you came to say."); return; }
    if (c.get("ch9.loomBeaten")) { await c.say("The Moth", "The Loom is still. Take the Crown from it. It is yours now, if anything is."); return; }
    c.step(2);
    await c.say("The Moth", "The Loom is through the top right. It will try to weave you in. Every thread it has is a word someone said to it. Say better ones.");
  },
  "crown.word": async (c) => {
    const id = c.entity?.name ?? "";
    const w = WORDS.find((x) => x.id === id);
    if (!w) return;
    giveWord(c, id);
    await c.narrate(`A word, folded small: ${w.word}. (${w.slot}: ${w.desc})`);
  },
  "gate.loomgate": async (c) => {
    if (!c.get("ch9.loomEntered")) { c.flag("ch9.loomEntered"); c.step(3); }
    await c.goto("crown_loom", 2, 2, "down");
  },
  "crown_loom.enter": async (c) => {
    if (c.get("ch9.loomSeen")) return;
    c.flag("ch9.loomSeen");
    c.step(4);
    await c.narrate("The Loom. Threads of light run from the walls into the dark ahead, and every thread hums one word, over and over, in a voice that died before Rimward had a name.");
  },
  "loom.builder": async (c) => {
    await c.say("Builder", "(What is left of one of them. Mostly hands.) We built the Shell to catch the Ember's light. We built the Loom to ask it to stay. We asked wrong. We asked FOREVER. It said no. It has been saying no for ten thousand years, and the saying is what is going out.");
    await c.say("Quill", "Ask it something it can say yes to.", "quill");
  },
  "crown_deep.enter": async (c) => {
    if (c.get("ch9.deepSeen")) return;
    c.flag("ch9.deepSeen");
    c.step(5);
    await c.narrate("The Weave. The threads here are so close together they are cloth, and the cloth is the sky over Rimward, and it is almost finished.");
  },
  "deep.loom": async (c) => {
    c.step(5);
    await c.narrate("The Loom. A frame of white light the size of the Vending Church, shuttles going through it faster than the Metronome ever counted. On top of it, small, a circle of light. The Crown.");
    await c.say("The Loom", "I HAVE WOVEN EVERY THREAD OF YOU. SIT.");
    await c.say("Pell", "Everybody keeps telling me to sit.", "pell");
    await c.say("Dust", "You never do.", "dust");
    const r = await c.battle(["the_loom"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch9.loomBeaten");
    c.step(6);
    await c.narrate("The shuttles stop. The cloth hangs, unfinished, a sky with a hole in it the exact shape of a village.");
    await c.say("The Loom", "...WEAVE SOMETHING BETTER.");
  },
  "deep.crown": async (c) => {
    c.flag("ch9.hasCrown");
    await c.give("moth_crown");
    giveWord(c, "w_shine"); giveWord(c, "w_self"); giveWord(c, "w_rot");
    await c.narrate("Pell puts it on. It is lighter than it should be. Learned: SHINE, SELF, ROT.");
    await c.say("Sister Vane", "You look ridiculous. You look like someone who is going to go and say something to a star.", "vane");
    await c.narrate("(The Ember is through the Loom. Go when you are ready. There is no coming back from this one.)");
  },
  "deep.emberdoor": async (c) => {
    const i = await c.ask("Beyond the Loom: the Ember. Go?", ["Go", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    c.step(7);
    await c.goto("ember_chamber", 8, 8, "up");
  },
  "ember_chamber.enter": async (c) => {
    if (c.get("ch9.emberSeen")) return;
    c.flag("ch9.emberSeen");
    await c.narrate("The Ember. It is smaller than you thought. It is the size of a house. It has a face, and the face is tired, and it is looking at you the way Hob looks at the rim.");
  },
  "ember.face": async (c) => {
    c.step(7);
    await c.say("The Ember", "I have been going out for ten thousand years. They asked me to burn forever. I cannot. Let me.");
    await c.say("Pell", "I'm not here to ask you to burn forever.", "pell");
    await c.say("The Ember", "Then why are you wearing that?");
    const i = await c.ask("Say it. Three words.", ["COME HOME SLOWLY", "BURN FOREVER LOUDLY", "GO OUT QUIETLY"], "Pell");
    if (i === 1) {
      await c.say("The Ember", "...No. Not even for you. Especially not for you.");
      await c.narrate("The Crown goes dark for a moment, ashamed. Ask again.");
      return;
    }
    if (i === 2) {
      await c.say("The Ember", "...Thank you. That is kind. But then your Lamp goes out, and the moths, and the whale's light, and the girl made of wings.");
      await c.say("Mim", "I would rather not go out. If anyone is asking.", "mim");
      await c.narrate("The Crown waits. Ask again.");
      return;
    }
    await c.say("The Ember", "...Home. Where is that?");
    await c.say("Pell", "Rimward. It's small. There's a Lamp. You'd fit in it, if you were small. Come home, slowly. Be a small sun. Nobody will ask you for forever. They'll ask you for mornings.", "pell");
    await c.say("The Ember", "You would keep me burning? For them?");
    await c.say("Pell", "For mornings.", "pell");
    await c.say("The Ember", "...Then show me you can carry it.");
    await c.narrate("(The last fight. Everything you have.)");
    const r = await c.battle(["the_ember"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch9.done");
    c.step(8);
    await c.narrate("The Ember shrinks. Not dying. Folding. Down to a house, a cart, a moth, a wick. It settles into Pell's hands and is warm, and that is all it is.");
    await c.say("The Ember", "...then carry me. Carefully.");
    await c.say("Oxbow", "A quest completed. The ballad is going to be very long. I have the first line. 'Pell said no.'", "oxbow");
    await c.say("Dust", "It goes differently this time. I'm going to stay and see how.", "dust");
    await c.narrate("The Moth folds its wings. The walk home is long, and the light in Pell's hands does not go out once.");
    for (const m of c.state.party) if (!m.extraSkills.includes("elixir_sun")) m.extraSkills.push("elixir_sun");
    await c.game.credits();
  },
};

export const chapter9: ChapterDef = {
  n: 9,
  title: "Words",
  journey: "Resurrection, and the return",
  mechanic: "words",
  maps: [gate, loom, deep, ember],
  scripts,
  start: { map: "crown_gate", x: 9, y: 7, dir: "up" },
  intro: scripts["ch9.intro"],
  circle: ["Not a crown", "Words, three at a time", "Into the Loom", "Threads that hum", "The Weave", "A sky with a hole in it", "Something a star can say yes to", "A small sun, carried home"],
};
