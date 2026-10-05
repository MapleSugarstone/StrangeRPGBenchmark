import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature, shape } from "./common";

const lastLamp: MapDef = {
  id: "last_lamp", name: "Last Lamp Waystation", chapter: 3, outside: "black", legend: LEGEND,
  grid: [
    "HHHHHHHHHHHHHHHHHH",
    "H................H",
    "H..###..L...###..H",
    "H..#.#......#.#..H",
    "H..#D#......#D#..H",
    "H................H",
    "H................H",
    "H..GGGGGGGGGGGG..H",
    "H..GGGGGGGGGGGG..H",
    "HHHHHHHDDHHHHHHHHH",
    "       DD         ",
  ],
  entities: [
    { id: "back", kind: "door", x: 7, y: 10, to: { map: "church", x: 19, y: 2, dir: "down" } },
    { id: "back2", kind: "door", x: 8, y: 10, to: { map: "church", x: 19, y: 2, dir: "down" } },
    { id: "keeper", kind: "npc", x: 9, y: 3, dir: "down", sprite: npc("keeper-ode", "teal", "salt"), script: "lastlamp.keeper", name: "Keeper Ode" },
    { id: "shop", kind: "shop", x: 13, y: 4, sprite: npc("trader-glass", "orange", "white"), name: "Glass & Sundry", stock: ["salt_biscuit", "brine", "lamp_wick", "antidote", "oil_bomb", "frost_vial", "spark_jar", "glass_blade", "glass_mail", "piston_arm", "moth_charm", "frost_ring"] },
    { id: "lamp", kind: "lamp", x: 8, y: 2, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "gate", kind: "trigger", x: 1, y: 6, script: "lastlamp.gate" },
    { id: "chest1", kind: "chest", x: 16, y: 1, sprite: chest(), items: ["brine", "candle"] },
    { id: "monk", kind: "npc", x: 4, y: 7, dir: "right", sprite: npc("monk-shade", "orange", "white"), script: "lastlamp.monk", name: "Shade Monk" },
  ],
};

const steppe = cave({
  id: "steppe", name: "The Glass Steppe", chapter: 3, floor: "G", wall: "H", w: 36, h: 26, fill: 0.4, encounters: "steppe", encounterRate: 0.08, decor: "C", decorCount: 14,
  place(cells) {
    const far = cells[cells.length - 1];
    const mid = at(cells, 0.5);
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "last_lamp", x: 2, y: 6, dir: "right" }, sprite: { kind: "tile", seed: "stairs", a: "teal", b: "salt", variant: "stairs" } },
      { id: "mim", kind: "npc", x: mid[0], y: mid[1], sprite: npc("mim-moth", "white", "pink"), script: "steppe.mim", hideIf: "ch3.mimJoined", name: "Mim" },
      { id: "whalebones", kind: "prop", x: mid[0] + 1, y: mid[1], sprite: creature("dead-whale", "gray", "salt"), script: "steppe.bones", solid: true },
      { id: "chestA", kind: "chest", x: at(cells, 0.25)[0], y: at(cells, 0.25)[1], sprite: chest(), items: ["frost_vial", "oil_bomb"] },
      { id: "chestB", kind: "chest", x: at(cells, 0.7)[0], y: at(cells, 0.7)[1], sprite: chest(), items: ["glass_mail"] },
      { id: "lamp", kind: "lamp", x: at(cells, 0.85)[0], y: at(cells, 0.85)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "down", kind: "door", x: far[0], y: far[1], to: { map: "steppe_deep", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "teal", variant: "stairs" } },
    ];
  },
});

const steppeDeep = cave({
  id: "steppe_deep", name: "The Deep Glass", chapter: 3, floor: "G", wall: "H", w: 30, h: 22, fill: 0.45, encounters: "steppe_deep", encounterRate: 0.1, decor: "C", decorCount: 10, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "steppe", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "teal", b: "salt", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.4)[0], y: at(cells, 0.4)[1], sprite: chest(), items: ["moth_dust", "brine"] },
      { id: "monk2", kind: "npc", x: at(cells, 0.6)[0], y: at(cells, 0.6)[1], sprite: npc("monk-burnt", "orange", "white"), script: "deep.monk", name: "Burnt Monk" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.82)[0], y: at(cells, 0.82)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "whale", kind: "boss", x: far[0], y: far[1], sprite: creature("lantern_whale", "blue", "yellow"), script: "deep.whale", hideIf: "ch3.whaleBeaten", solid: true },
      { id: "exit", kind: "trigger", x: far[0], y: far[1], script: "deep.exit", showIf: "ch3.whaleBeaten" },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch3.intro": async (c) => {
    c.step(1);
    await c.narrate("Beyond the gate the ground is glass, miles of it, and under the glass the Ember's last light goes down and down. Here is the last Lamp before the Steppe. People live under it like it owes them.");
    await c.say("Sister Vane", "Last Lamp. Keeper Ode runs it. He will tell you nobody crosses the Steppe without a whale. He is right, which is annoying.", "vane");
  },
  "lastlamp.keeper": async (c) => {
    if (c.get("ch3.whaleBeaten")) { await c.say("Keeper Ode", "You carry a whale's lamp now. You could cross anything. Go cross it."); return; }
    if (c.get("ch3.mimJoined")) { await c.say("Keeper Ode", "A moth child. Of course. The Steppe gives you whatever you did not pack."); return; }
    c.step(2);
    await c.say("Keeper Ode", "Crossing? You will walk off an edge in the dark and fall into the Ember. The Lantern Whales used to light the way. There is one left, deep in the glass, and it has gone strange.");
    await c.say("Keeper Ode", "Something out there is eating light. Not drinking it. Eating. Find out what, and if it can be reasoned with, reason with it. If not, you have a knight.");
    await c.say("Oxbow", "I am the knight he means.", "oxbow");
  },
  "lastlamp.monk": async (c) => {
    await c.say("Shade Monk", "The Sunburnt stood in the Ember's light until it loved them. I stand in shade. We disagree about most things, and the glass between us is very thin.");
  },
  "lastlamp.gate": async (c) => {
    if (!c.get("ch3.gateSeen")) { c.flag("ch3.gateSeen"); c.step(3); await c.narrate("The Steppe. Your boots ring on it. Far below, red, the Ember turns over in its sleep."); }
    await c.goto("steppe", 2, 2, "down");
  },
  "steppe.enter": async (c) => {
    if (c.get("ch3.steppeEntered")) return;
    c.flag("ch3.steppeEntered");
    await c.say("Sister Vane", "Watch the crystals. Static jellies hide behind them. Hit them with rot, not volt. Volt feeds them.", "vane");
  },
  "steppe.bones": async (c) => { await c.narrate("A whale's bones, lying on the glass. The lamp that hung in its throat is gone, eaten down to the hook."); },
  "steppe.mim": async (c) => {
    c.step(4);
    await c.narrate("A child sits inside the whale's ribs with a lamp in both hands, chewing on the light. The light goes into the child and comes out as wings.");
    await c.say("Mim", "...You are warm. Are you a lamp?");
    await c.say("Pell", "I'm a person. You're eating that whale's lamp.", "pell");
    await c.say("Mim", "It was already out. I was keeping it company. I am a moth. I grew the child part to fit through doors.");
    await c.say("Sister Vane", "Here is the thing eating light, then. It is four feet tall and it is sorry.", "vane");
    await c.say("Mim", "I am not the one hurting the big whale. The Sunburnt are. They stand in its light until it screams. I can show you how light works, if you let me come. Two colors make a third.");
    await c.unlock("links");
    await c.say("Mim", "Heat on a cold foe, cold on a hot one, SHATTER. Heat and volt OVERLOAD everybody. Rot and volt BLIGHT. Light goes with anything. I am mostly light.");
    await c.join("mim");
    c.flag("ch3.mimJoined");
  },
  "steppe_deep.enter": async (c) => {
    if (c.get("ch3.deepEntered")) return;
    c.flag("ch3.deepEntered");
    c.step(5);
    await c.narrate("Deeper glass. The light from below is close enough to read by. Something very large moves under the surface, slow, with a lamp in its mouth.");
  },
  "deep.monk": async (c) => {
    await c.say("Burnt Monk", "The whale screams and the scream is light and the light is warm. We are not cruel. We are cold. Go back.");
    await c.say("Mim", "That is a lie. They are warm. I can taste it from here.", "mim");
  },
  "deep.whale": async (c) => {
    c.step(5);
    await c.narrate("The Lantern Whale breaches the glass and hangs there, half in, half out, the lamp in its throat so bright it is hard to look at. The glass around it has gone to sand.");
    await c.say("Lantern Whale", "They stood in me until I could not stop shining. Now I cannot stop. Put it out. Put it out or take it.");
    const i = await c.ask("The whale is asking.", ["Take the lamp", "Put it out", "Walk away"], "Pell");
    if (i === 2) { await c.say("Lantern Whale", "Then I will keep screaming."); c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    if (i === 0) await c.say("Pell", "I'll take it. I'll keep it lit.", "pell");
    else await c.say("Pell", "I'll put it out. I'm sorry.", "pell");
    await c.say("Lantern Whale", "Then come and get it.");
    const r = await c.battle(["lantern_whale"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch3.whaleBeaten");
    c.step(6);
    await c.narrate("The whale sinks into the glass. The lamp stays, floating, a rod of light with a hook on the end where the whale held it.");
    await c.say("Mim", "It tastes like being told you did well.", "mim");
    await c.give("prism_rod");
    await c.give("glass_blade");
    await c.say("Sister Vane", "A whale's light. You can cross anything with that. The Library is past the far edge. Go when you are ready.", "vane");
  },
  "deep.exit": async (c) => {
    c.step(7);
    const i = await c.ask("The far edge of the Steppe. Past it, the Library of Moths. Cross?", ["Cross", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.narrate("You cross the dark glass with a whale's lamp held up in front of you. Mim walks under it with their mouth open.");
    await c.say("Pell", "I keep thinking about Rimward. Not missing it. Thinking.", "pell");
    await c.say("Oxbow", "That is what a quest does. It makes a place into a thought you carry. I read that. Then I crossed it out, because it was better than the rest of the book.", "oxbow");
    await c.narrate("Chapter 3 ends. Ahead, shelves taller than trees.");
    await c.endChapter();
  },
};

export const chapter3: ChapterDef = {
  n: 3,
  title: "Links",
  journey: "Crossing the threshold",
  mechanic: "links",
  maps: [lastLamp, steppe, steppeDeep],
  scripts,
  start: { map: "last_lamp", x: 8, y: 8, dir: "up" },
  intro: scripts["ch3.intro"],
  circle: ["The last Lamp", "No whale, no crossing", "Onto the glass", "A child in a ribcage", "The whale that cannot stop", "A lamp with a hook", "Crossing the dark", "A place becomes a thought"],
};
