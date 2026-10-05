import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature } from "./common";

const foldEdge: MapDef = {
  id: "fold_edge", name: "The Border Post", chapter: 5, outside: "black", legend: LEGEND,
  grid: [
    "MMMMMMMMMMMMMMMMMMMMMM",
    "MmmmmmmmmmmmmmmmmmmmmM",
    "MmMMMmmmmmmmmmmmMMMmmM",
    "MmMmMmmmmLmmmmmmMmMmmM",
    "MmMDMmmmmmmmmmmmMDMmmM",
    "MmmmmmmmmmmmmmmmmmmmmM",
    "Mmmmmmmmm====mmmmmmmmM",
    "Mmmmmmmmm====mmmmmmmmM",
    "Mmmmmmmmm====mmmmmmmmM",
    "MmmmmmmmmmmmmmmmmmmmmM",
    "MmmmmmmmmmmmmmmmmmmmmM",
    "MMMMMMMMMMDDMMMMMMMMMM",
    "          DD          ",
  ],
  entities: [
    { id: "back", kind: "trigger", x: 10, y: 12, script: "edge.back" },
    { id: "back2", kind: "trigger", x: 11, y: 12, script: "edge.back" },
    { id: "clerk", kind: "npc", x: 3, y: 5, dir: "down", sprite: npc("border-clerk", "green", "white"), script: "edge.clerk", name: "Border Clerk" },
    { id: "shop", kind: "shop", x: 17, y: 5, sprite: npc("border-trader", "green", "yellow"), name: "Duty Free", stock: ["brine", "lamp_wick", "antidote", "moth_dust", "tonic", "candle", "map_cloak", "folding_knife", "glass_mail", "metronome", "leech_tooth"] },
    { id: "lamp", kind: "lamp", x: 9, y: 3, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "fold", kind: "npc", x: 10, y: 2, dir: "down", sprite: npc("fold-maps", "green", "salt"), script: "edge.fold", hideIf: "ch5.foldGone", name: "The Cartographer" },
    { id: "gate", kind: "trigger", x: 10, y: 1, script: "edge.gate", showIf: "ch5.foldGone" },
    { id: "gate2", kind: "trigger", x: 11, y: 1, script: "edge.gate", showIf: "ch5.foldGone" },
    { id: "chest1", kind: "chest", x: 20, y: 9, sprite: chest(), items: ["tonic"] },
    { id: "refugee", kind: "npc", x: 6, y: 9, dir: "right", sprite: npc("refugee-two", "gray", "green"), script: "edge.refugee", wander: true, name: "Refugee" },
  ],
};

const foldInner = cave({
  id: "fold_inner", name: "The Fold", chapter: 5, floor: "m", wall: "M", w: 34, h: 24, fill: 0.42, encounters: "fold", encounterRate: 0.08, decor: "P", decorCount: 8,
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "fold_edge", x: 10, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "green", b: "salt", variant: "stairs" } },
      { id: "foldtest", kind: "npc", x: at(cells, 0.35)[0], y: at(cells, 0.35)[1], sprite: npc("fold-maps", "green", "salt"), script: "fold.test", hideIf: "ch5.rowsTaught", name: "The Cartographer" },
      { id: "chestA", kind: "chest", x: at(cells, 0.5)[0], y: at(cells, 0.5)[1], sprite: chest(), items: ["mem_snake", "brine"] },
      { id: "legend", kind: "npc", x: at(cells, 0.62)[0], y: at(cells, 0.62)[1], sprite: creature("legend-npc", "salt", "green"), script: "fold.legend", name: "Legend" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "down", kind: "door", x: far[0], y: far[1], to: { map: "fold_deep", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "green", variant: "stairs" } },
    ];
  },
});

const foldDeep = cave({
  id: "fold_deep", name: "The Unmapped", chapter: 5, floor: "m", wall: "M", w: 28, h: 22, fill: 0.47, encounters: "fold_deep", encounterRate: 0.1, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "fold_inner", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "green", b: "salt", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.4)[0], y: at(cells, 0.4)[1], sprite: chest(), items: ["moth_dust", "tonic"] },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "foldcaught", kind: "npc", x: far[0] - 1, y: far[1], sprite: npc("fold-maps", "green", "salt"), script: "deep.blank", hideIf: "ch5.blankBeaten", name: "The Cartographer" },
      { id: "blank", kind: "boss", x: far[0], y: far[1], sprite: creature("blank_spot_boss", "salt", "dark"), script: "deep.blank", hideIf: "ch5.blankBeaten", solid: true },
      { id: "exit", kind: "trigger", x: far[0], y: far[1], script: "deep.exit", showIf: "ch5.blankBeaten" },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch5.intro": async (c) => {
    c.step(1);
    await c.narrate("The Fold. Three countries that stopped existing got folded into the same place. The roads cross each other at angles roads do not have. Border posts guard borders between nothing and nothing.");
    await c.say("Quill", "The maps of this place disagree with each other. Which is normal. Here the maps are also the place.", "quill");
  },
  "edge.back": async (c) => { await c.narrate("Back to the Library? The Blank Map twitches in your pack. Forward."); c.state.map.y = 10; c.game.overworld?.resetTrail(); },
  "edge.clerk": async (c) => {
    if (c.get("ch5.foldGone")) { await c.say("Border Clerk", "Passports. Ha. No. Go on through. The Cartographer says you are a country now."); return; }
    c.step(2);
    await c.say("Border Clerk", "Passports? No? Then you cannot cross. Nobody can cross. The Cartographer keeps redrawing the road to the Bank so it goes nowhere. She says it is for our own good.");
    await c.say("Border Clerk", "She is up by the gate. Being folded.");
  },
  "edge.refugee": async (c) => { await c.say("Refugee", "I was from the second country. Then the third. I have not moved. The borders did."); },
  "edge.fold": async (c) => {
    if (c.get("ch5.foldMet")) { await c.say("The Cartographer", "The Fold is through the gate behind me. Come find me where the road bends. I will show you how to stand."); c.state.map.y = 3; c.game.overworld?.resetTrail(); await c.goto("fold_inner", 2, 2, "down"); return; }
    c.flag("ch5.foldMet");
    c.step(3);
    await c.narrate("A person made of folded maps, creased at every joint, leaning on the gatepost. The maps shift when she moves. Rivers go the wrong way.");
    await c.say("The Cartographer", "Four travelers and a Blank Map. You want the Bank. Everyone wants the Bank. The road goes through the Unmapped, and the Unmapped is eating my work.");
    await c.say("The Cartographer", "I keep redrawing the road so nobody walks into it. You are going to walk into it anyway. Fine. Then you walk in how I draw you. Come.");
    await c.narrate("She folds herself through the gate. It opens behind her.");
    await c.goto("fold_inner", 2, 2, "down");
  },
  "fold.test": async (c) => {
    c.step(4);
    await c.say("The Cartographer", "Stop. Stand where I draw you. Front row takes the hits. Back row throws things over them. Knives in the back row are a waste of a knife.");
    await c.unlock("rows");
    await c.say("The Cartographer", "Melee from the back row does less, and melee into the back row does less. Spells and thrown things do not care. Shove a foe back and your knife is worth half. Pull it forward and it is worth a knife.");
    await c.say("The Cartographer", "Now. Two of my border guards and a legend. They will shove you. Shove back.");
    const r = await c.battle(["border_guard", "legend"], { fleeable: false, intro: "The Cartographer draws a line. Two shapes step over it." });
    if (r !== "win") return;
    c.flag("ch5.rowsTaught");
    await c.say("The Cartographer", "Good. You can stand. I am going ahead to the Unmapped. If I am not back, I am in it.");
    await c.give("folding_knife");
    c.step(5);
  },
  "fold.legend": async (c) => { await c.say("Legend", "(A map key with a face.) THIS SYMBOL MEANS CHURCH. THIS ONE MEANS WELL. THIS ONE MEANS YOU ARE HERE. I am lying about one of them."); },
  "fold_inner.enter": async (c) => {
    if (c.get("ch5.innerEntered")) return;
    c.flag("ch5.innerEntered");
    await c.narrate("The Fold. The ground is paper and the paper is a map of itself. Where you step, the ink spreads.");
  },
  "fold_deep.enter": async (c) => {
    if (c.get("ch5.deepEntered")) return;
    c.flag("ch5.deepEntered");
    c.step(5);
    await c.narrate("The Unmapped. The map here is white. Not blank. White, like something has been scrubbed out and is still wet.");
  },
  "deep.blank": async (c) => {
    c.step(5);
    await c.narrate("The Cartographer is half gone. Her left side is white. Where the Blank Spot touches her, the maps are unprinted.");
    await c.say("The Cartographer", "It was never drawn. It wants everything else to be never drawn too. I thought I could survey it. You cannot survey a hole.");
    await c.say("Blank Spot", "Here be nothing. Go back.");
    await c.say("Sister Vane", "Front row, the people with armor. Back row, me. Mim, you are a spell, you go where you like.", "vane");
    const r = await c.battle(["blank_spot_boss"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch5.blankBeaten");
    c.step(6);
    await c.narrate("The white shrinks to a dot and the dot shrinks to a point and the point is a place on a map, finally, with a name nobody has said yet.");
    await c.say("The Cartographer", "You drew it. By standing in it. That is not how surveying works, and it worked.");
    await c.say("The Cartographer", "My name is Fold. I owe you a country. I will walk it off.");
    await c.join("fold");
    c.flag("ch5.foldGone");
    await c.give("map_cloak");
  },
  "deep.exit": async (c) => {
    c.step(7);
    const i = await c.ask("The road to the Bank of Teeth is drawn now. Take it?", ["Take it", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.say("Oxbow", "Pell. I have been walking behind you so your victory is visible. I am going to walk beside you now. The victory is visible enough.", "oxbow");
    await c.say("Pell", "...Okay.", "pell");
    await c.say("Fold", "Nobody noticed, but the Blank Map just drew a road. It goes to a building full of teeth.", "fold");
    await c.narrate("Chapter 5 ends. The road is straight for the first time since Rimward.");
    await c.endChapter();
  },
  "edge.gate": async (c) => { await c.goto("fold_inner", 2, 2, "down"); },
};

export const chapter5: ChapterDef = {
  n: 5,
  title: "Rows",
  journey: "Tests, allies, enemies",
  mechanic: "rows",
  maps: [foldEdge, foldInner, foldDeep],
  scripts,
  start: { map: "fold_edge", x: 10, y: 9, dir: "up" },
  intro: scripts["ch5.intro"],
  circle: ["Three countries, one place", "A road that goes nowhere", "Through the gate", "Stand where she draws you", "The Unmapped", "A place with a name", "Fold walks it off", "Oxbow walks beside"],
};
