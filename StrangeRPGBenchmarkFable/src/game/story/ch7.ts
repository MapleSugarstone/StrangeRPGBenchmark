import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature } from "./common";

const hourGate: MapDef = {
  id: "hour_gate", name: "The Backward Hour", chapter: 7, outside: "black", legend: LEGEND,
  grid: [
    "IIIIIIIIIIIIIIIIII",
    "IhhhhhhhhhhhhhhhhI",
    "IhhIIhhhhhhhhIIhhI",
    "IhhhhhhhLhhhhhhhhI",
    "IhhhhhhhhhhhhhhhhI",
    "IhhhhhhhhhhhhhhhhI",
    "IhhIIhhhhhhhhIIhhI",
    "IhhhhhhhhhhhhhhhhI",
    "IIIIIIIIDDIIIIIIII",
    "        DD        ",
  ],
  entities: [
    { id: "back", kind: "trigger", x: 8, y: 9, script: "hour.back" },
    { id: "back2", kind: "trigger", x: 9, y: 9, script: "hour.back" },
    { id: "lamp", kind: "lamp", x: 8, y: 3, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "dust", kind: "npc", x: 9, y: 4, dir: "down", sprite: npc("dust-echo", "dark", "teal"), script: "hour.dust", hideIf: "ch7.dustJoined", name: "???" },
    { id: "shop", kind: "shop", x: 14, y: 4, sprite: npc("yesterday-trader", "dark", "salt"), name: "Yesterday's Goods", stock: ["brine", "lamp_wick", "antidote", "moth_dust", "tonic", "candle", "hour_hand", "glass_mail", "metronome", "ember_ring", "frost_ring"] },
    { id: "chest1", kind: "chest", x: 2, y: 7, sprite: chest(), items: ["tonic", "moth_dust"] },
    { id: "deepgate", kind: "trigger", x: 1, y: 1, script: "hour.deepgate" },
  ],
};

const hourInner = cave({
  id: "hour_inner", name: "The Hour, Running Back", chapter: 7, floor: "h", wall: "I", w: 32, h: 24, fill: 0.43, encounters: "hour", encounterRate: 0.08, decor: "C", decorCount: 10, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "hour_gate", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "teal", b: "dark", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.3)[0], y: at(cells, 0.3)[1], sprite: chest(), items: ["mem_ghost", "brine"] },
      { id: "wolf", kind: "npc", x: at(cells, 0.5)[0], y: at(cells, 0.5)[1], sprite: creature("unwolf-pup", "gray", "teal"), script: "inner.pup", name: "Pup" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "down", kind: "door", x: far[0], y: far[1], to: { map: "hour_deep", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "teal", variant: "stairs" } },
    ];
  },
});

const hourDeep = cave({
  id: "hour_deep", name: "The Last Minute", chapter: 7, floor: "h", wall: "I", w: 28, h: 22, fill: 0.46, encounters: "hour_deep", encounterRate: 0.1, decor: "C", decorCount: 8, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "hour_inner", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "teal", b: "dark", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.4)[0], y: at(cells, 0.4)[1], sprite: chest(), items: ["hour_glass"] },
      { id: "lamp", kind: "lamp", x: at(cells, 0.78)[0], y: at(cells, 0.78)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "death", kind: "boss", x: far[0], y: far[1], sprite: npc("pells_death", "dark", "salt"), script: "deep.death", hideIf: "ch7.deathBeaten", solid: true },
      { id: "exit", kind: "trigger", x: far[0], y: far[1], script: "deep.exit", showIf: "ch7.deathBeaten" },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch7.intro": async (c) => {
    c.step(1);
    await c.narrate("The Backward Hour. A cave where the Builders tried to make time run the other way, so the Ember would un-burn. It worked on the cave. Water falls up. Wounds close before they open. Nobody who goes in comes out older.");
    await c.say("Quill", "Every book about this place was written before the author went in. None after.", "quill");
  },
  "hour.back": async (c) => { await c.narrate("The Bank door closes behind you. It is already closed. It was always closed."); c.state.map.y = 7; c.game.overworld?.resetTrail(); },
  "hour.dust": async (c) => {
    if (c.get("ch7.rewindTaught")) { await c.say("Dust", "Through the top left. I will be waiting at the bottom. I am always waiting at the bottom."); return; }
    c.step(2);
    await c.narrate("A figure in the dark with your face. Older. Dust on the shoulders, salt in the lines around the eyes.");
    await c.say("???", "Hello, Pell.");
    await c.say("Pell", "...Who are you?", "pell");
    await c.say("???", "You. Later. I came back through the Hour to the only place it lets you come back to. My name is Dust now. Yours is still Pell. Keep it as long as you can.");
    await c.say("Dust", "Down there is the thing that happens to you. You are going to lose to it. I did. Then I learned this.");
    await c.unlock("rewind");
    await c.say("Dust", "Once per fight, Rewind puts you back one turn. The dice roll again. The Hour runs on it, and so do its monsters, so watch them do it too.");
    c.flag("ch7.rewindTaught");
    c.step(3);
    await c.say("Dust", "Go. I will be at the bottom. I remember this part. You said no. Say yes this time.");
    await c.say("Pell", "I didn't say anything.", "pell");
    await c.say("Dust", "You will.");
  },
  "hour.deepgate": async (c) => {
    if (!c.get("ch7.rewindTaught")) { await c.narrate("The way down. Something in the dark says your name in your own voice."); c.state.map.x = 2; c.game.overworld?.resetTrail(); return; }
    await c.goto("hour_inner", 2, 2, "down");
  },
  "hour_inner.enter": async (c) => {
    if (c.get("ch7.innerEntered")) return;
    c.flag("ch7.innerEntered");
    c.step(4);
    await c.narrate("The Hour, running back. Your footprints appear ahead of you and you walk into them.");
  },
  "inner.pup": async (c) => { await c.say("Pup", "(An un-wolf, very young. It gets younger as you watch.) ...yip. ...yi. ...y."); await c.say("Mim", "Oh. Oh, no. Let's go.", "mim"); },
  "hour_deep.enter": async (c) => {
    if (c.get("ch7.deepEntered")) return;
    c.flag("ch7.deepEntered");
    c.step(5);
    await c.narrate("The Last Minute. The cave is very quiet, the way a room is quiet when someone has just stopped talking.");
  },
  "deep.death": async (c) => {
    c.step(5);
    if (!c.get("ch7.firstDeath")) {
      await c.narrate("It is Pell. It is you, with the light gone out of you, sitting on the floor the way you will sit when it happens.");
      await c.say("Pell's Death", "I am what you are for. Sit down.");
      await c.say("Pell", "No.", "pell");
      await c.say("Pell's Death", "You always say that first.");
      await c.narrate("(This fight cannot be won. Lose it well.)");
      const first = await c.battle(["pells_death"], { boss: true, fleeable: false, canLose: true, intro: "Pell's Death stands up." });
      c.flag("ch7.firstDeath");
      c.step(6);
      if (first === "win") {
        c.flag("ch7.deathBeaten");
        await c.narrate("It sits down before it can finish standing. That is not how this went. That is not how this ever went.");
        await c.say("Dust", "...Huh. I did not do that. Fine. Then I am just coming with you.");
        await c.join("dust");
        c.flag("ch7.dustJoined");
        await c.give("hour_hand");
        return;
      }
      await c.narrate("The light goes out. You feel it go. It is not loud.");
      await c.narrate("...");
      await c.say("Dust", "There. That is the part I remember. Now the part I came back for.");
      await c.narrate("Dust puts a hand on the floor and the floor runs backward. Your blood goes back in. Your friends stand up. The last minute un-happens.");
      c.heal();
      c.flag("ch7.rewound");
      await c.say("Dust", "I rewound it. Once. That is all the Hour gives anyone. The next one is yours to win.");
      await c.say("Pell", "...Yes.", "pell");
      await c.say("Dust", "Told you.");
      await c.join("dust");
      c.flag("ch7.dustJoined");
      await c.narrate("(Pell's Death is waiting. Your Rewind is ready. Hindsight heals by what was lost. Foreshadow doubles a friend. Go.)");
      return;
    }
    await c.say("Pell's Death", "Again. Everyone does it again.");
    const r = await c.battle(["pells_death"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch7.deathBeaten");
    c.step(6);
    await c.narrate("It sits down. Not defeated. Postponed. It looks up at you with your own face and nods, once, the way you nod at Hob in the mornings.");
    await c.say("Pell's Death", "...later, then.");
    await c.give("hour_hand");
    await c.say("Dust", "Later. That is the whole gift. I have had it for years. Spend it.", "dust");
  },
  "deep.exit": async (c) => {
    c.step(7);
    const i = await c.ask("Past the Last Minute, the Choir Steps climb to the Crown. Go?", ["Go", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.say("Oxbow", "You died. I watched it. Then you didn't. I have written both down and I am keeping both.", "oxbow");
    await c.say("Pell", "I'm not scared of it anymore. That's strange. It's still coming.", "pell");
    await c.say("Dust", "Everything is still coming. That was never the problem.", "dust");
    await c.narrate("Chapter 7 ends. Ahead, stairs, and singing.");
    await c.endChapter();
  },
};

export const chapter7: ChapterDef = {
  n: 7,
  title: "Rewind",
  journey: "The ordeal",
  mechanic: "rewind",
  maps: [hourGate, hourInner, hourDeep],
  scripts,
  start: { map: "hour_gate", x: 9, y: 7, dir: "up" },
  intro: scripts["ch7.intro"],
  circle: ["Water falls up", "You, later", "Into the Hour", "Footprints ahead of you", "The Last Minute", "The light goes out, and back in", "Dust spends it", "Still coming"],
};
