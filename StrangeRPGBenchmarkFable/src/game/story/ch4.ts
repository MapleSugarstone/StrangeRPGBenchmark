import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature, shape } from "./common";

const library: MapDef = {
  id: "library", name: "The Library of Moths", chapter: 4, outside: "black", legend: LEGEND,
  grid: [
    "NNNNNNNNNNNNNNNNNNNNNNNN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NnNNNnnNNNnnnnNNNnnNNNnN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NnNNNnnNNNnnnnNNNnnNNNnN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NnNNNnnNNNnnnnNNNnnNNNnN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NnnnnnnnnncccnnnnnnnnnnN",
    "NnnnnnnnnnnLnnnnnnnnnnnN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NnNNNnnNNNnnnnNNNnnNNNnN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NnNNNnnNNNnnnnNNNnnNNNnN",
    "NnnnnnnnnnnnnnnnnnnnnnnN",
    "NNNNNNNNNNNDDNNNNNNNNNNN",
    "           DD           ",
  ],
  entities: [
    { id: "out", kind: "trigger", x: 11, y: 16, script: "library.out" },
    { id: "out2", kind: "trigger", x: 12, y: 16, script: "library.out" },
    { id: "quill", kind: "npc", x: 11, y: 7, dir: "down", sprite: npc("quill-paper", "white", "red"), script: "library.quill", hideIf: "ch4.quillJoined", name: "Quill" },
    { id: "lamp", kind: "lamp", x: 11, y: 9, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "shop", kind: "shop", x: 2, y: 1, sprite: npc("page-clerk", "white", "salt"), name: "Returns Desk", stock: ["brine", "lamp_wick", "antidote", "moth_dust", "candle", "tonic", "paper_robe", "hymn_rod", "clean_bandage", "ember_ring"] },
    { id: "moth1", kind: "npc", x: 20, y: 3, dir: "left", sprite: shape("libmoth1", "salt", "pink", "moth"), script: "library.moth", wander: true, name: "Moth" },
    { id: "moth2", kind: "npc", x: 5, y: 12, dir: "right", sprite: shape("libmoth2", "white", "purple", "moth"), script: "library.moth", wander: true, name: "Moth" },
    { id: "reader", kind: "npc", x: 17, y: 12, dir: "left", sprite: npc("reader-old", "gray", "white"), script: "library.reader", name: "Reader" },
    { id: "stacks", kind: "door", x: 1, y: 1, to: { map: "library_stacks", x: 2, y: 2, dir: "down" }, showIf: "ch4.hasCard" },
    { id: "stackslocked", kind: "trigger", x: 1, y: 1, script: "library.locked", hideIf: "ch4.hasCard" },
    { id: "chest1", kind: "chest", x: 22, y: 14, sprite: chest(), items: ["candle", "brine"] },
    { id: "foldgate", kind: "trigger", x: 22, y: 1, script: "library.foldgate" },
  ],
};

const stacks = cave({
  id: "library_stacks", name: "The Deep Stacks", chapter: 4, floor: "n", wall: "N", w: 34, h: 24, fill: 0.42, encounters: "library", encounterRate: 0.09, decor: "P", decorCount: 10, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "library", x: 1, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "gray", b: "white", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.3)[0], y: at(cells, 0.3)[1], sprite: chest(), items: ["mem_page", "brine"] },
      { id: "chestB", kind: "chest", x: at(cells, 0.55)[0], y: at(cells, 0.55)[1], sprite: chest(), items: ["paper_robe"] },
      { id: "footnote", kind: "npc", x: at(cells, 0.45)[0], y: at(cells, 0.45)[1], sprite: creature("footnote", "white", "red"), script: "stacks.footnote", name: "Footnote" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.78)[0], y: at(cells, 0.78)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "down", kind: "door", x: far[0], y: far[1], to: { map: "library_deep", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "white", variant: "stairs" } },
    ];
  },
});

const deepStacks = cave({
  id: "library_deep", name: "The Unread Shelves", chapter: 4, floor: "n", wall: "N", w: 28, h: 22, fill: 0.46, encounters: "library_deep", encounterRate: 0.1, decor: "P", decorCount: 6, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "library_stacks", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "gray", b: "white", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.4)[0], y: at(cells, 0.4)[1], sprite: chest(), items: ["mem_wraith", "moth_dust"] },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "unread", kind: "boss", x: far[0], y: far[1], sprite: creature("the_unread", "dark", "white"), script: "deep.unread", hideIf: "ch4.unreadBeaten", solid: true },
      { id: "map", kind: "prop", x: far[0], y: far[1], sprite: { kind: "item", seed: "blankmap", a: "salt", b: "green", variant: "gem" }, script: "deep.map", showIf: "ch4.unreadBeaten", hideIf: "ch4.hasMap", solid: true },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch4.intro": async (c) => {
    c.step(1);
    await c.narrate("The Library of Moths. Every moth on the Shell brings what it eats off lamps here, and the librarians shelve it. Memories, mostly. Some of them bite.");
    await c.say("Mim", "I was born here. Shelf nine. I am not going back to shelf nine.", "mim");
  },
  "library.out": async (c) => { await c.narrate("Back across the Steppe? Not now. The Library has what you came for."); c.state.map.y = 14; c.game.overworld?.resetTrail(); },
  "library.moth": async (c) => { const l = ["(It smells of lamp oil and someone's childhood.)", "(It is carrying a memory of rain. It does not know where to shelve it.)", "(It lands on Mim for a moment, and they both go still.)"]; await c.narrate(l[c.state.steps % l.length]); },
  "library.reader": async (c) => { await c.say("Reader", "I came to read one book. That was forty years ago. The book moved. I am still looking. It is a good library."); },
  "library.locked": async (c) => { await c.narrate("The Deep Stacks. A sign: READERS WITH CARDS ONLY. Quill, at the desk, is coughing ink."); c.state.map.x = 2; c.game.overworld?.resetTrail(); },
  "library.quill": async (c) => {
    if (c.get("ch4.unreadBeaten")) {
      c.step(7);
      await c.say("Quill", "You read it. Nobody read it. I can feel the shelves settle from here.");
      await c.say("Quill", "The map to the Crown goes through the Fold and the Bank and the Backward Hour. I have read every book about every one of those. I have never been. I would like to see how the story ends. Take me.");
      await c.say("Pell", "You're made of paper.", "pell");
      await c.say("Quill", "Everything I know about paper suggests it burns well. Keep me away from Mim. Otherwise I will be fine.");
      await c.join("quill");
      c.flag("ch4.quillJoined");
      await c.narrate("(The gate to the Fold is in the top right corner of the Library.)");
      return;
    }
    if (c.get("ch4.hasCard")) { await c.say("Quill", "The Stacks are through the door at the top left. The Unread is at the bottom of them. Wear what you kill."); return; }
    c.flag("ch4.hasCard");
    c.step(2);
    await c.say("Quill", "A reader. Four readers. I would stand but I am mostly glue today.");
    await c.say("Pell", "We need the way to the Moth Crown. The Sister says there's a map here.", "pell");
    await c.say("Quill", "There is. The Blank Map. It is in the Deep Stacks, and the Deep Stacks are being eaten by the Unread. Every book nobody opened, all together, very upset.");
    await c.say("Quill", "The moths bring Memories here. Slot them on yourselves. It is not disrespectful. It is what they are for.");
    await c.unlock("memories");
    await c.say("Quill", "Three to a person. Foes drop them sometimes. Wear a slug's patience and a rat's hunger and see what you become. Here is a card. Try not to return it.");
    await c.give("library_card");
    await c.give("mem_saltlick");
    await c.give("mem_rat");
    c.step(3);
  },
  "library_stacks.enter": async (c) => {
    if (c.get("ch4.stacksEntered")) return;
    c.flag("ch4.stacksEntered");
    c.step(4);
    await c.narrate("The Deep Stacks. The shelves lean. The books whisper the first line of themselves when you pass, hoping.");
  },
  "stacks.footnote": async (c) => {
    if (!c.get("ch4.footnote")) { c.flag("ch4.footnote"); await c.say("Footnote", "1. See also: the thing at the bottom. 2. Do not see also. 3. Here, a memory of a hare. It knows how to be elsewhere."); await c.give("mem_hare"); return; }
    await c.say("Footnote", "4. You again. 5. Good.");
  },
  "library_deep.enter": async (c) => {
    if (c.get("ch4.deepEntered")) return;
    c.flag("ch4.deepEntered");
    c.step(5);
    await c.narrate("The Unread Shelves. No whispering here. The books have given up on first lines.");
  },
  "deep.unread": async (c) => {
    c.step(5);
    await c.narrate("A shape made of spines and covers, taller than the shelves, with ten thousand closed mouths.");
    await c.say("The Unread", "You never opened me. Nobody did. I waited. I am very good at waiting now.");
    await c.say("Mim", "It is cold. It is the coldest thing in here. Heat and light. Heat and light.", "mim");
    const r = await c.battle(["the_unread"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch4.unreadBeaten");
    c.step(6);
    await c.narrate("The shape comes apart into books, and the books fall open, and for a moment the whole shelf is reading itself aloud at once. Then quiet. Then one book, left, with no title.");
    await c.give("mem_ghost");
  },
  "deep.map": async (c) => {
    c.flag("ch4.hasMap");
    await c.give("blank_map");
    await c.narrate("The Blank Map. It shows nothing until you stop looking at it. Then, at the edge of your eye, the Fold.");
    await c.say("Oxbow", "A map with nothing on it. The ideal map. No wrong turns.", "oxbow");
  },
  "library.foldgate": async (c) => {
    if (!c.get("ch4.quillJoined")) { await c.narrate("A reading room door, painted with a border of countries you do not recognize. Quill would know."); c.state.map.x = 21; c.game.overworld?.resetTrail(); return; }
    const i = await c.ask("The Fold is through here. Go?", ["Go", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.x = 21; c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.say("Quill", "Before we go. The Crown is not a crown. It is what the Builders put on to talk to the Loom, and the Loom is what talks to the Ember.", "quill");
    await c.say("Quill", "The last person to wear it asked the Ember to burn forever. The Ember said no. That was ten thousand years ago. It has been saying no ever since.", "quill");
    await c.say("Pell", "Then I'll ask it something else.", "pell");
    await c.narrate("Chapter 4 ends. The door opens onto a country that is three countries.");
    await c.endChapter();
  },
};

export const chapter4: ChapterDef = {
  n: 4,
  title: "Memories",
  journey: "Tests, allies, enemies",
  mechanic: "memories",
  maps: [library, stacks, deepStacks],
  scripts,
  start: { map: "library", x: 11, y: 13, dir: "up" },
  intro: scripts["ch4.intro"],
  circle: ["Shelves taller than trees", "A map, and a librarian made of glue", "Into the Stacks", "Books that whisper", "The Unread", "A book with no title", "Quill wants the ending", "What the Crown is"],
};
