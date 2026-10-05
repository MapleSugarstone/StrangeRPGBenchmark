import type { ChapterDef, Script } from "./chapters";
import type { MapDef, Entity } from "../world/map";
import { generateCave, openCells } from "../world/map";
import type { SpriteSpec } from "../../engine/sprites";

const npc = (seed: string, a: SpriteSpec["a"], b: SpriteSpec["b"]): SpriteSpec => ({ kind: "humanoid", seed, a, b });
const prop = (seed: string, a: SpriteSpec["a"], b: SpriteSpec["b"], variant = "gem"): SpriteSpec => ({ kind: "item", seed, a, b, variant });
const chestSprite = (): SpriteSpec => ({ kind: "shape", seed: "chest", a: "brown", b: "yellow", variant: "box" });

const LEGEND = { T: "tree", ",": "field", "=": "saltpath", "#": "wall", ".": "floor", D: "door", L: "lamp", s: "salt", " ": "void", "~": "water", b: "bed", c: "counter", S: "stairs", P: "pillar", x: "cellar", X: "darkwall", C: "crystal", g: "grass", r: "rock", p: "path" };

const rimward: MapDef = {
  id: "rimward", name: "Rimward", chapter: 1, outside: "black", legend: LEGEND,
  grid: [
    "TTTTTTTTTTTT=TTTTTTTTTTT",
    "T,,,,,,,,,,,=,,,,,,,,,,T",
    "T,,###,,,,,,=,,,,###,,,T",
    "T,,#.#,,,,,,=,,,,#.#,,,T",
    "T,,#D#,,,,,,=,,,,#D#,,,T",
    "T,,,,,,,,,,,=,,,,,,,,,,T",
    "T,,,,,,,,====L====,,,,,T",
    "T,,,,,,,,=,,,,,,,=,,,,,T",
    "T,,###,,,=,,,,,,,=,###,T",
    "T,,#.#,,,=,,,,,,,=,#.#,T",
    "T,,#D#,,,=,,,,,,,=,#D#,T",
    "T,,,,,,,,=========,,,,,T",
    "T,,,,,,,,,,,=,,,,,,,,,,T",
    "T,,,,,,,,,,,=,,,,,,,,,,T",
    "Tsssssssssss=ssssssssssT",
    "Tsssssssssss=ssssssssss=",
    "Tssssssssssssssssssssss=",
    "ssssssssssssssssssssssss",
    "  s   ss    s  ss   s   ",
    "                        ",
  ],
  entities: [
    { id: "elder", kind: "npc", x: 4, y: 5, dir: "down", sprite: npc("elder-marrow", "gray", "salt"), script: "rimward.elder", name: "Elder Marrow" },
    { id: "tansy", kind: "shop", x: 18, y: 5, dir: "down", sprite: npc("tansy-trader", "orange", "salt"), name: "Tansy's Salt & Sundry", stock: ["salt_biscuit", "antidote", "lamp_wick", "oil_bomb", "brine_hook", "rust_plate"] },
    { id: "bit", kind: "npc", x: 13, y: 9, dir: "left", sprite: npc("bit-kid", "lime", "salt"), script: "rimward.bit", wander: true, name: "Bit" },
    { id: "hob", kind: "npc", x: 8, y: 15, dir: "right", sprite: npc("old-hob", "brown", "salt"), script: "rimward.hob", name: "Old Hob" },
    { id: "pellhouse", kind: "trigger", x: 4, y: 4, script: "rimward.home" },
    { id: "elderhouse", kind: "trigger", x: 18, y: 4, script: "rimward.elderhouse" },
    { id: "hobhouse", kind: "trigger", x: 4, y: 10, script: "rimward.hobhouse" },
    { id: "store", kind: "trigger", x: 20, y: 10, script: "rimward.storeroom" },
    { id: "lamp", kind: "prop", x: 13, y: 6, script: "rimward.lamp", solid: true },
    { id: "moth", kind: "boss", x: 11, y: 12, dir: "down", sprite: { kind: "shape", seed: "bigmoth", a: "salt", b: "pink", variant: "moth" }, script: "rimward.moth", showIf: "ch1.mothLanded", hideIf: "ch1.mothGone" },
    { id: "northgate", kind: "trigger", x: 12, y: 0, script: "rimward.north" },
    { id: "eastgate", kind: "door", x: 23, y: 15, to: { map: "rim_field", x: 1, y: 8, dir: "right" } },
    { id: "eastgate2", kind: "door", x: 23, y: 16, to: { map: "rim_field", x: 1, y: 9, dir: "right" } },
    { id: "sign", kind: "sign", x: 12, y: 13, sprite: prop("sign-rim", "brown", "salt", "tool"), script: "rimward.sign" },
    { id: "chest1", kind: "chest", x: 21, y: 2, sprite: chestSprite(), items: ["salt_biscuit", "salt_biscuit"] },
  ],
};

const rimField: MapDef = {
  id: "rim_field", name: "The Rim", chapter: 1, outside: "black", legend: LEGEND, encounters: "rim_field", encounterRate: 0.07,
  grid: [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T,,,,,,,,,,,,,,,,,T,,,,,,,,,,,,T",
    "T,,,,,T,,,,,,,,,,,,,,,,,T,,,,,,T",
    "T,,,,,,,,,,,,,T,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,T,,,,,,,,,,,,,,,,,,rrT",
    "T,,,,,,,,,,,,,,,,,,,,,,,,,,,,rrrT",
    "T,,,,,,,,,,,,,,,,,,,,,,,,,,,rr#rT",
    "=,,,,,,,,,,,,,,,,,,,,,,,,,,,rrSrT",
    "=,,,,,,,,,,,,,,,,,,,,,,,,,,,,rrrT",
    "T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,rT",
    "Tss,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T",
    "Tsssss,,,,,,,,,,,,,,,,,,,,,,,,,,T",
    "Tsssssssssss,,,,,,,,,,,,,,,,,,,,T",
    "Tsssssssssssssssssssssssss,,,,,,T",
    "ssssssssssssssssssssssssssssssssT",
    "ss  sss   ss   s ss  sss  ss  ss",
    "                                ",
  ],
  entities: [
    { id: "westgate", kind: "door", x: 0, y: 8, to: { map: "rimward", x: 22, y: 15, dir: "left" } },
    { id: "westgate2", kind: "door", x: 0, y: 9, to: { map: "rimward", x: 22, y: 16, dir: "left" } },
    { id: "cellar", kind: "door", x: 30, y: 8, to: { map: "salt_cellar_1", x: 2, y: 2, dir: "down" } },
    { id: "chest1", kind: "chest", x: 24, y: 2, sprite: chestSprite(), items: ["brine"] },
    { id: "chest2", kind: "chest", x: 2, y: 13, sprite: chestSprite(), gold: 15 },
    { id: "scraper", kind: "npc", x: 10, y: 13, dir: "down", sprite: npc("scraper-nell", "teal", "salt"), script: "rim.nell", name: "Nell" },
  ],
};

function cellar(id: string, name: string, depth: number): MapDef {
  return {
    id, name, chapter: 1, outside: "black", legend: LEGEND, encounters: "salt_cellar", encounterRate: 0.09,
    grid: [],
    entities: [],
    generate(rng) {
      const grid = generateCave(rng, 30, 22, "x", "X", 0.44);
      const rows = grid.map((r) => r.split(""));
      // Carve the entrance.
      for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) rows[y][x] = "x";
      const cells = openCells(rows.map((r) => r.join("")), "x", 2, 2);
      const far = cells[cells.length - 1];
      const mid = cells[Math.floor(cells.length * 0.55)];
      const mid2 = cells[Math.floor(cells.length * 0.35)];
      // Crystal decorations on a few open cells next to walls.
      let crystals = 0;
      for (const [x, y] of rng.shuffle([...cells])) {
        if (crystals >= 12) break;
        if (Math.hypot(x - 2, y - 2) < 4 || (x === far[0] && y === far[1])) continue;
        const nearWall = rows[y - 1]?.[x] === "X" || rows[y + 1]?.[x] === "X";
        if (nearWall && rng.chance(0.3)) { rows[y][x] = "C"; crystals++; }
      }
      const entities: Entity[] = [
        { id: "up", kind: "door", x: 2, y: 1, to: depth === 1 ? { map: "rim_field", x: 29, y: 8, dir: "left" } : { map: "salt_cellar_1", x: 0, y: 0, dir: "down", atEntity: "down" }, sprite: { kind: "tile", seed: "stairs", a: "gray", b: "salt", variant: "stairs" } },
        { id: "chestA", kind: "chest", x: mid2[0], y: mid2[1], sprite: chestSprite(), items: depth === 1 ? ["lamp_wick", "salt_biscuit"] : ["brine", "oil_bomb"] },
      ];
      if (depth === 1) {
        entities.push({ id: "down", kind: "door", x: far[0], y: far[1], to: { map: "salt_cellar_2", x: 2, y: 2, dir: "down" }, sprite: { kind: "tile", seed: "stairs", a: "dark", b: "salt", variant: "stairs" } });
        entities.push({ id: "chestB", kind: "chest", x: mid[0], y: mid[1], sprite: chestSprite(), gold: 25 });
        entities.push({ id: "ghost", kind: "npc", x: cells[Math.floor(cells.length * 0.2)][0], y: cells[Math.floor(cells.length * 0.2)][1], sprite: npc("cellar-ghost", "dark", "salt"), script: "cellar.ghost", name: "Something" });
      } else {
        entities.push({ id: "warden", kind: "boss", x: far[0], y: far[1], sprite: { kind: "humanoid", seed: "rust_warden", a: "brown", b: "orange" }, script: "cellar.warden", hideIf: "ch1.wardenBeaten", solid: true });
        const lampCell = cells[Math.floor(cells.length * 0.8)];
        entities.push({ id: "cellarlamp", kind: "lamp", x: lampCell[0], y: lampCell[1], sprite: prop("cellar-lamp", "yellow", "orange", "tool"), name: "Lamp", solid: true });
        entities.push({ id: "wick", kind: "prop", x: far[0], y: far[1], sprite: prop("rimwick", "orange", "white", "tool"), script: "cellar.wick", showIf: "ch1.wardenBeaten", hideIf: "ch1.hasWick", solid: true });
        entities.push({ id: "chestC", kind: "chest", x: mid[0], y: mid[1], sprite: chestSprite(), items: ["brine_hook"] });
      }
      return { grid: rows.map((r) => r.join("")), entities };
    },
  };
}

const scripts: Record<string, Script> = {
  "ch1.intro": async (c) => {
    c.step(1);
    await c.narrate("The Shell is a curve of land around a dying star. The star is called the Ember. It has been going out for ten thousand years.");
    await c.narrate("Rimward is the last village before the edge. It scrapes salt off the rim and sells it inland. It has one Lamp. The Lamp has always been lit.");
    await c.say("Pell", "Morning, Hob. Morning, Lamp.", "pell");
    await c.narrate("(Walk with the arrows. Z talks. C opens the menu. The Lamp in the square heals and saves.)");
  },
  "rimward.elder": async (c) => {
    const step = Number(c.get("ch1.step") ?? 1);
    if (c.get("ch1.hasWick")) {
      await c.say("Elder Marrow", "You have it. You actually have it. Put it in the Lamp, Pell, before I cry in front of the child.");
      return;
    }
    if (c.get("ch1.mothLanded")) {
      await c.say("Elder Marrow", "A moth that size does not land for nothing. The Lamp's wick is spent, Pell. There is another in the Salt Cellar past the rim.");
      await c.say("Elder Marrow", "Nobody goes down there. That is why the wick is still there. Take biscuits.");
      if (!c.get("ch1.braceTaught")) {
        c.flag("ch1.braceTaught");
        await c.say("Elder Marrow", "And listen. When something big winds up to hit you, do not swing. Brace. Guard first, and your next blow lands half again as hard. That is how we scrape the hard crust.");
        await c.unlock("brace");
        await c.give("salt_biscuit", 2);
      }
      c.step(3);
      return;
    }
    if (step <= 1) {
      await c.say("Elder Marrow", "Pell. The Lamp flickered last night. Did you see it?");
      await c.say("Pell", "Lamps flicker.", "pell");
      await c.say("Elder Marrow", "Ours does not. Go look at it. Then come back and tell me I am old.");
      c.step(2);
    } else {
      await c.say("Elder Marrow", "The moths are gathering on the roofs. They only come to light that is leaving.");
    }
  },
  "rimward.lamp": async (c) => {
    if (c.get("ch1.hasWick") && !c.get("ch1.relit")) {
      c.flag("ch1.relit");
      c.step(8);
      await c.narrate("Pell lifts the old wick out. It crumbles. The new one slides in warm, and the Lamp takes it like a breath.");
      await c.narrate("Light. The square goes gold. The moths on the roofs open their wings all at once, and it sounds like applause.");
      await c.say("Oxbow", "A quest completed. I will compose a ballad. It will be long.", "oxbow");
      await c.narrate("The big moth drops into the square and folds its wings.");
      c.flag("ch1.mothLanded");
      c.flag("ch1.mothFinal");
      await c.say("The Moth", "Pell. The wick is a wick. The Ember is going out, and every lamp on the Shell is going out with it.");
      await c.say("The Moth", "There is a Crown at the center of the Shell. Whoever wears it can speak to the Ember. Come to the Crown.");
      await c.say("Pell", "No.", "pell");
      await c.say("The Moth", "...No?");
      await c.say("Pell", "I scrape salt. I relit the Lamp. That is what I do. Find someone who goes places.", "pell");
      await c.say("Oxbow", "A knight requires a quest, Pell. You are refusing a quest. In front of a knight.", "oxbow");
      await c.say("Pell", "I know what I am doing.", "pell");
      await c.narrate("The Moth does not argue. It climbs into the dark on wings the color of salt and is gone.");
      await c.say("Elder Marrow", "...It will last a season, that wick. Maybe two. Then you will have to decide again.");
      await c.narrate("Chapter 1 ends. Pell said no. The Lamp is lit, for now.");
      c.flag("ch1.mothGone");
      await c.endChapter();
      return;
    }
    if (c.get("ch1.hasWick")) { await c.narrate("The Lamp burns steady on the new wick."); await c.game.useLamp(c.entity!); return; }
    if (!c.get("ch1.sawFlicker")) {
      c.flag("ch1.sawFlicker");
      c.step(2);
      await c.narrate("The Lamp is a Builder thing. Glass and brass, taller than a man, lit since before there was a village. Tonight it stutters.");
      await c.narrate("A moth the size of a cart lands on the roof of the storehouse. Then another. Then the square goes quiet, and the biggest one you have ever seen settles on the salt road.");
      c.flag("ch1.mothLanded");
      await c.say("The Moth", "Pell.");
      await c.say("Pell", "...How do you know my name?", "pell");
      await c.say("The Moth", "I ate it off a lamp once. Your Lamp is dying, Pell. Fix it. Then we will talk about the rest.");
      await c.narrate("The Elder is waving at you from the north side of the square.");
      return;
    }
    await c.narrate("The Lamp stutters. Between stutters the square is very dark.");
    await c.game.useLamp(c.entity!);
  },
  "rimward.moth": async (c) => {
    if (c.get("ch1.hasWick")) { await c.say("The Moth", "Put it in. I want to see."); return; }
    await c.say("The Moth", "The Cellar is east, past the rim field. I would go myself, but I do not fit, and I would eat the wick.");
  },
  "rimward.bit": async (c) => {
    const lines = ["Hob says the edge of the world is just more salt. I think it's teeth.", "The moths taste like dust. I licked one.", "If the Lamp goes out can I have a candle?", "The Elder has a book about knights. It's mostly pictures."];
    await c.say("Bit", lines[c.state.steps % lines.length]);
  },
  "rimward.hob": async (c) => {
    if (c.get("ch1.hasWick")) { await c.say("Old Hob", "A tin knight. You went down for a wick and came back with a tin knight."); return; }
    await c.say("Old Hob", "Scrape away from the edge, never toward it. The rim does not want you, but it will take you.");
    if (!c.get("ch1.hobTip")) { c.flag("ch1.hobTip"); await c.say("Old Hob", "Rats are fast. Slugs are slow. Hit the rat first, is my advice. That is all my advice."); }
  },
  "rimward.home": async (c) => {
    await c.narrate("Your house. One bed, one pot, one window facing the dark. It smells like salt because everything does.");
    if (!c.get("ch1.homeChest")) { c.flag("ch1.homeChest"); await c.narrate("Under the bed: a few coins you were saving for nothing in particular."); await c.gold(10); }
  },
  "rimward.elderhouse": async (c) => {
    await c.narrate("The Elder's house. Shelves of jars. One book, open to a picture of a knight. Someone has drawn a moustache on the knight.");
  },
  "rimward.hobhouse": async (c) => {
    await c.narrate("Hob's house. Salt hooks on every wall, a hundred of them, all slightly different. He says each one was the best he ever made.");
  },
  "rimward.storeroom": async (c) => {
    await c.narrate("The storehouse. Sacks of salt stacked to the roof. A moth is asleep on the top sack with its wings folded like a letter.");
  },
  "rimward.sign": async (c) => {
    await c.narrate("A sign. 'RIMWARD. Population: enough. Edge of the world: that way.' Someone added 'DON'T' in salt.");
  },
  "rimward.north": async (c) => {
    if (c.state.chapter >= 2) return;
    await c.narrate("The road north goes to the Vending Church and then to everywhere else. Nobody from Rimward has walked it in years.");
    await c.say("Pell", "Not today.", "pell");
    c.state.map.y = 1;
    c.game.overworld?.resetTrail();
  },
  "rim.nell": async (c) => {
    await c.say("Nell", "The Cellar door is up in the rocks, east. It hums at night. I don't go in. I have a whole life of not going in planned.");
  },
  "cellar.ghost": async (c) => {
    c.step(4);
    await c.say("Something", "...scrape, scrape, scrape... I scraped too close... the rim took my hands first...");
    await c.say("Something", "...the wick is below. The knight sleeps on it. Do not wake him... wake him... do not...");
  },
  "cellar.warden": async (c) => {
    c.step(5);
    await c.narrate("A figure of rust and brass sits against the far wall with its arms crossed over a glowing coil. The Rimward Wick.");
    await c.narrate("Its eyes open one at a time.");
    await c.say("Rust Warden", "INTRUDER. THIS WICK IS UNDER MY PROTECTION. STATE YOUR QUEST.");
    const i = await c.ask("Say what?", ["The Lamp is dying", "Give me the wick", "Run"], "Pell");
    if (i === 2) { await c.say("Rust Warden", "COWARDICE NOTED."); c.state.map.y = Math.max(1, c.state.map.y - 1); c.game.overworld?.resetTrail(); return; }
    if (i === 0) await c.say("Rust Warden", "A LAMP. A VILLAGE. A QUEST. ...ACCEPTABLE. BUT A QUEST MUST BE TESTED.");
    else await c.say("Rust Warden", "DEMANDS ARE NOT QUESTS. STAND AND BE TESTED.");
    await c.narrate("(Brace before its big swing. Guard, then hit.)");
    const r = await c.battle(["rust_warden"], { boss: true, fleeable: false });
    if (r !== "win") return;
    c.flag("ch1.wardenBeaten");
    c.step(6);
    await c.narrate("The Warden slumps. Something inside it clicks, whirs, and reboots.");
    await c.say("Rust Warden", "...SYSTEMS. CHECKING. I HAVE BEEN ASLEEP FOR... A LONG NUMBER.");
    await c.say("Rust Warden", "You struck well. You braced. I have read about this. In the book. The book about knights.");
    await c.say("Pell", "You're a Builder machine. You guard wicks.", "pell");
    await c.say("Rust Warden", "I WAS a Builder machine. I have decided to be a knight. My name is Oxbow. It is the name of a river bend. I chose it. Take the wick.");
    await c.join("oxbow");
    await c.narrate("The wick lies where Oxbow sat, glowing like something that wants to be picked up.");
  },
  "cellar.wick": async (c) => {
    c.flag("ch1.hasWick");
    c.step(7);
    await c.give("wick_of_rimward");
    await c.say("Oxbow", "Now we return it. Victoriously. I will walk behind you so that your victory is visible.", "oxbow");
    await c.narrate("(Head back up. The stairs are where you came in.)");
  },
  "salt_cellar_1.enter": async (c) => {
    if (c.get("ch1.cellarEntered")) return;
    c.flag("ch1.cellarEntered");
    c.step(3);
    await c.narrate("The Salt Cellar. The walls are salt grown over Builder pipes. Something below is humming a note you can feel in your teeth.");
  },
  "salt_cellar_2.enter": async (c) => {
    if (c.get("ch1.cellar2Entered")) return;
    c.flag("ch1.cellar2Entered");
    await c.narrate("Deeper. The hum is louder, and the crystals are lit from inside. The wick is close.");
  },
};

export const chapter1: ChapterDef = {
  n: 1,
  title: "Salt",
  journey: "Ordinary world, and the call",
  mechanic: "brace",
  maps: [rimward, rimField, cellar("salt_cellar_1", "Salt Cellar", 1), cellar("salt_cellar_2", "Salt Cellar, deeper", 2)],
  scripts,
  start: { map: "rimward", x: 12, y: 12, dir: "up" },
  intro: scripts["ch1.intro"],
  circle: ["Scraping salt", "The Lamp flickers", "Into the Cellar", "The hum below", "The Rust Warden", "The wick, and a knight", "Climbing home", "Pell says no"],
};
