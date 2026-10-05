import type { ChapterDef, Script } from "./chapters";
import type { MapDef } from "../world/map";
import { LEGEND, npc, chest, lampSprite, cave, at, creature } from "./common";

const steps: MapDef = {
  id: "choir_steps", name: "The Choir Steps", chapter: 8, outside: "black", legend: LEGEND,
  grid: [
    "JJJJJJJJJJJJJJJJJJJJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JjjjjjjjjjLjjjjjjjjJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JJJJJJJJjjjjJJJJJJJJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JjjPjjjjjjjjjjjjPjjJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JJJJJJJJjjjjJJJJJJJJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JjjPjjjjjjjjjjjjPjjJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JJJJJJJJjjjjJJJJJJJJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JjjPjjjjjjjjjjjjPjjJ",
    "JjjjjjjjjjjjjjjjjjjJ",
    "JJJJJJJJDDJJJJJJJJJJ",
    "        DD          ",
  ],
  entities: [
    { id: "back", kind: "trigger", x: 8, y: 17, script: "steps.back" },
    { id: "back2", kind: "trigger", x: 9, y: 17, script: "steps.back" },
    { id: "lamp", kind: "lamp", x: 10, y: 2, sprite: lampSprite(), name: "Lamp", solid: true },
    { id: "shop", kind: "shop", x: 16, y: 14, sprite: npc("usher", "indigo", "white"), name: "The Usher", stock: ["brine", "lamp_wick", "antidote", "moth_dust", "tonic", "candle", "hour_hand", "ledger_vest", "leech_tooth", "metronome"] },
    { id: "choir", kind: "npc", x: 10, y: 14, dir: "down", sprite: npc("choir-forty", "indigo", "white"), script: "steps.choir", hideIf: "ch8.choirJoined", name: "Choir" },
    { id: "singer1", kind: "npc", x: 3, y: 10, dir: "right", sprite: npc("singer-alto", "indigo", "pink"), script: "steps.singer", wander: true, name: "Singer" },
    { id: "singer2", kind: "npc", x: 16, y: 6, dir: "left", sprite: npc("singer-bass", "indigo", "teal"), script: "steps.singer", wander: true, name: "Singer" },
    { id: "chest1", kind: "chest", x: 2, y: 5, sprite: chest(), items: ["tonic", "candle"] },
    { id: "chest2", kind: "chest", x: 17, y: 9, sprite: chest(), items: ["moth_dust", "brine"] },
    { id: "gate1", kind: "trigger", x: 9, y: 12, script: "steps.gate1", hideIf: "ch8.fusionTaught" },
    { id: "gate1b", kind: "trigger", x: 10, y: 12, script: "steps.gate1", hideIf: "ch8.fusionTaught" },
    { id: "stage", kind: "door", x: 9, y: 4, to: { map: "choir_stage", x: 2, y: 2, dir: "down" } },
    { id: "stage2", kind: "door", x: 10, y: 4, to: { map: "choir_stage", x: 2, y: 2, dir: "down" } },
  ],
  encounters: "choir",
  encounterRate: 0.05,
};

const stage = cave({
  id: "choir_stage", name: "The Stage", chapter: 8, floor: "j", wall: "J", w: 30, h: 22, fill: 0.44, encounters: "choir_deep", encounterRate: 0.1, decor: "P", decorCount: 8, outside: "dark",
  place(cells) {
    const far = cells[cells.length - 1];
    return [
      { id: "up", kind: "door", x: 2, y: 1, to: { map: "choir_steps", x: 9, y: 5, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "indigo", b: "white", variant: "stairs" } },
      { id: "chestA", kind: "chest", x: at(cells, 0.35)[0], y: at(cells, 0.35)[1], sprite: chest(), items: ["mem_monk", "tonic"] },
      { id: "critic", kind: "npc", x: at(cells, 0.5)[0], y: at(cells, 0.5)[1], sprite: creature("critic", "dark", "pink"), script: "stage.critic", name: "Critic" },
      { id: "lamp", kind: "lamp", x: at(cells, 0.8)[0], y: at(cells, 0.8)[1], sprite: lampSprite(), name: "Lamp", solid: true },
      { id: "conductor", kind: "boss", x: far[0], y: far[1], sprite: npc("the_conductor", "indigo", "yellow"), script: "stage.conductor", hideIf: "ch8.conductorBeaten", solid: true },
      { id: "exit", kind: "trigger", x: far[0], y: far[1], script: "stage.exit", showIf: "ch8.conductorBeaten" },
    ];
  },
});

const scripts: Record<string, Script> = {
  "ch8.intro": async (c) => {
    c.step(1);
    await c.narrate("The Choir Steps. Three hundred stairs to the Crown, and on every one of them a singer. Forty of them agreed, a long time ago, to be one person so they would never be out of tune. They are called Choir. They are a they and a you.");
    await c.say("Dust", "I never got past the Steps. The Conductor kept me a week. Nobody is out of tune when he is done.", "dust");
  },
  "steps.back": async (c) => { await c.narrate("Back down into the Hour? It would un-happen you. Up."); c.state.map.y = 15; c.game.overworld?.resetTrail(); },
  "steps.singer": async (c) => { const l = ["(Singing one note, perfectly, forever.)", "We were forty. We are one. We are also still forty. It is complicated and it sounds wonderful.", "The Conductor keeps time. Keeps it. Does not give it back."]; await c.say("Singer", l[c.state.steps % l.length]); },
  "steps.gate1": async (c) => { await c.narrate("The stair narrows to one voice wide. Choir, below, is watching you try to squeeze four people into one."); c.state.map.y = 13; c.game.overworld?.resetTrail(); },
  "steps.choir": async (c) => {
    if (c.get("ch8.conductorBeaten")) {
      c.step(7);
      await c.say("Choir", "He is quiet. We are loud. We will come. We are one person. We will take one bed, one bowl, and one turn.");
      await c.join("choir");
      c.flag("ch8.choirJoined");
      await c.narrate("(The Stage door is at the top of the Steps. Beyond the Stage, the Crown.)");
      return;
    }
    if (c.get("ch8.fusionTaught")) { await c.say("Choir", "The Stage is at the top. He is on it. He is always on it."); return; }
    c.step(2);
    await c.say("Choir", "Four. Four voices. The Steps let one voice through at a time, and the Conductor decides what one voice is.");
    await c.say("Pell", "We're four people.", "pell");
    await c.say("Choir", "We were forty. Here. We will show you the trick. It is not a trick. It is a terrible decision made with love.");
    await c.unlock("fusion");
    await c.say("Choir", "Fuse with a friend. For three turns you are one fighter with both skill lists and one pool of HP. Then you come apart and share what is left. Do it when it is worth it. It is not always worth it.");
    c.flag("ch8.fusionTaught");
    c.step(3);
    await c.say("Choir", "Go up. Sing badly. He hates that most.");
  },
  "choir_stage.enter": async (c) => {
    if (c.get("ch8.stageEntered")) return;
    c.flag("ch8.stageEntered");
    c.step(4);
    await c.narrate("The Stage. Every step of it is a riser, every riser is full, every singer is facing the same way. Toward him.");
  },
  "stage.critic": async (c) => { await c.say("Critic", "(A pair of folded arms with a mouth.) Flat. Sharp. Flat. Late. Early. You are the worst thing that has walked up here. Keep going, it is refreshing."); },
  "stage.conductor": async (c) => {
    c.step(5);
    await c.narrate("The Conductor. A tall figure in a coat the color of a held breath, a baton in each of six hands. When he raises them, the whole Stage inhales.");
    await c.say("The Conductor", "You are flat. All of you. We will fix that. One voice. Mine.");
    await c.say("Oxbow", "I am a knight. I sing like a knight, which is to say loudly and in the wrong key. On purpose.", "oxbow");
    const r = await c.battle(["the_conductor"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch8.conductorBeaten");
    c.step(6);
    await c.narrate("The batons drop. The Stage exhales, and for the first time in three hundred years the singers stop on different notes, and it is a chord, and it is beautiful, and it is wrong, and nobody fixes it.");
    await c.say("The Conductor", "...rest.");
    await c.give("tuning_fork");
    await c.narrate("(Choir is at the bottom of the Steps.)");
  },
  "stage.exit": async (c) => {
    if (!c.get("ch8.choirJoined")) { await c.narrate("The top of the Stage. Beyond it, the Crown. Choir is still at the bottom of the Steps, waiting to be asked."); c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    c.step(7);
    const i = await c.ask("The Moth Crown is beyond the Stage. Go?", ["Go", "Not yet"], "Pell");
    if (i !== 0) { c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    c.step(8);
    await c.narrate("At the top of the Stage, something the size of a cart folds its wings and waits.");
    await c.say("The Moth", "Pell. You came.");
    await c.say("Pell", "You said come to the Crown. I'm here. I brought everyone.", "pell");
    await c.say("The Moth", "I see that. I ate your name off a lamp a long time ago, and I did not know what it would do when I said it back. Come. The Loom is awake, and it is weaving the end.");
    await c.narrate("Chapter 8 ends. Above, light, and the sound of a very large machine deciding something.");
    await c.endChapter();
  },
};

export const chapter8: ChapterDef = {
  n: 8,
  title: "Fusion",
  journey: "Reward, and the road back",
  mechanic: "fusion",
  maps: [steps, stage],
  scripts,
  start: { map: "choir_steps", x: 9, y: 15, dir: "up" },
  intro: scripts["ch8.intro"],
  circle: ["Three hundred stairs", "One voice wide", "A terrible decision made with love", "Every riser full", "The Conductor", "A chord, wrong, kept", "Choir takes one bed", "You came"],
};
