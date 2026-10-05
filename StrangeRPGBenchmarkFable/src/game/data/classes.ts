import type { ClassDef, CharacterDef } from "../types";

const list: ClassDef[] = [
  {
    id: "scraper", name: "Scraper", desc: "Scrapes salt from the rim. Steady hands, steady hits.",
    base: { hp: 42, st: 12, atk: 11, def: 7, mag: 6, res: 6, spd: 9 },
    growth: { hp: 7, st: 1.4, atk: 1.6, def: 1.1, mag: 0.9, res: 1.0, spd: 0.8 },
    learn: [
      { level: 1, skill: "scrape" }, { level: 2, skill: "salt_throw" }, { level: 4, skill: "lamp_oil" },
      { level: 6, skill: "brine_wall" }, { level: 9, skill: "rimward_cut" }, { level: 13, skill: "lamplight" },
    ],
    weaponKinds: ["hook", "blade"],
  },
  {
    id: "hulk", name: "Hulk", desc: "A maintenance frame that believes it is a knight.",
    base: { hp: 58, st: 8, atk: 12, def: 11, mag: 3, res: 5, spd: 5 },
    growth: { hp: 9, st: 0.9, atk: 1.7, def: 1.6, mag: 0.4, res: 0.8, spd: 0.5 },
    learn: [
      { level: 1, skill: "bash" }, { level: 1, skill: "taunt" }, { level: 4, skill: "overclock" },
      { level: 7, skill: "ironhide" }, { level: 10, skill: "rust_cloud" }, { level: 14, skill: "siege_mode" },
    ],
    weaponKinds: ["arm", "blade"],
  },
  {
    id: "dispenser", name: "Dispenser", desc: "Prays to a vending machine. It usually answers.",
    base: { hp: 34, st: 20, atk: 6, def: 6, mag: 11, res: 10, spd: 8 },
    growth: { hp: 5, st: 2.2, atk: 0.6, def: 0.9, mag: 1.6, res: 1.5, spd: 0.8 },
    learn: [
      { level: 1, skill: "prayer" }, { level: 1, skill: "coin_toss" }, { level: 3, skill: "dispense" },
      { level: 5, skill: "jingle" }, { level: 8, skill: "refund" }, { level: 11, skill: "mass_prayer" }, { level: 15, skill: "jackpot" },
    ],
    weaponKinds: ["rod"],
  },
  {
    id: "lightfeeder", name: "Lightfeeder", desc: "A moth that learned to be a child. Eats light, spits weather.",
    base: { hp: 30, st: 24, atk: 5, def: 5, mag: 14, res: 8, spd: 11 },
    growth: { hp: 4.5, st: 2.4, atk: 0.5, def: 0.7, mag: 2.0, res: 1.2, spd: 1.0 },
    learn: [
      { level: 1, skill: "flutter" }, { level: 1, skill: "frostdust" }, { level: 4, skill: "hearthbreath" },
      { level: 6, skill: "powder" }, { level: 8, skill: "eat_light" }, { level: 12, skill: "lightstorm" }, { level: 16, skill: "moonmoth" },
    ],
    weaponKinds: ["rod", "wing"],
  },
  {
    id: "archivist", name: "Archivist", desc: "Paper skin, ink blood. Remembers for a living.",
    base: { hp: 36, st: 18, atk: 7, def: 7, mag: 12, res: 11, spd: 9 },
    growth: { hp: 5.5, st: 1.9, atk: 0.8, def: 1.0, mag: 1.7, res: 1.6, spd: 0.9 },
    learn: [
      { level: 1, skill: "recite" }, { level: 1, skill: "index" }, { level: 5, skill: "errata" },
      { level: 7, skill: "footnote" }, { level: 10, skill: "redaction" }, { level: 13, skill: "bibliomancy" },
    ],
    weaponKinds: ["rod", "blade"],
  },
  {
    id: "cartographer", name: "Cartographer", desc: "Folded from maps of places that stopped existing.",
    base: { hp: 44, st: 14, atk: 11, def: 9, mag: 8, res: 8, spd: 12 },
    growth: { hp: 6.5, st: 1.6, atk: 1.5, def: 1.2, mag: 1.0, res: 1.1, spd: 1.2 },
    learn: [
      { level: 1, skill: "redraw" }, { level: 1, skill: "shortcut" }, { level: 6, skill: "contour" },
      { level: 9, skill: "blank_spot" }, { level: 12, skill: "survey" }, { level: 15, skill: "terra_incognita" },
    ],
    weaponKinds: ["blade", "hook"],
  },
  {
    id: "debtor", name: "Debtor", desc: "Seventh print of a soldier. Owes for all seven.",
    base: { hp: 50, st: 6, atk: 14, def: 8, mag: 4, res: 6, spd: 9 },
    growth: { hp: 8, st: 0.7, atk: 2.0, def: 1.2, mag: 0.5, res: 0.9, spd: 0.9 },
    learn: [
      { level: 1, skill: "loan_strike" }, { level: 1, skill: "collateral" }, { level: 7, skill: "interest" },
      { level: 10, skill: "garnish" }, { level: 14, skill: "default" },
    ],
    weaponKinds: ["blade", "arm"],
  },
  {
    id: "echo", name: "Echo", desc: "What is left of you after the Backward Hour.",
    base: { hp: 38, st: 16, atk: 10, def: 8, mag: 12, res: 12, spd: 13 },
    growth: { hp: 6, st: 1.8, atk: 1.4, def: 1.1, mag: 1.6, res: 1.5, spd: 1.2 },
    learn: [
      { level: 1, skill: "foreshadow" }, { level: 1, skill: "hindsight" }, { level: 8, skill: "unhappen" },
      { level: 11, skill: "echo_strike" }, { level: 15, skill: "already_dead" },
    ],
    weaponKinds: ["blade", "hook", "rod"],
  },
  {
    id: "chorus", name: "Chorus", desc: "Forty people who agreed to be one.",
    base: { hp: 46, st: 18, atk: 10, def: 9, mag: 12, res: 10, spd: 8 },
    growth: { hp: 7, st: 2.0, atk: 1.3, def: 1.2, mag: 1.6, res: 1.3, spd: 0.8 },
    learn: [
      { level: 1, skill: "harmony" }, { level: 1, skill: "dissonance" }, { level: 12, skill: "crescendo" }, { level: 16, skill: "round" },
    ],
    weaponKinds: ["rod", "blade"],
  },
];

export const CLASSES: Record<string, ClassDef> = Object.fromEntries(list.map((c) => [c.id, c]));

const chars: CharacterDef[] = [
  {
    id: "pell", name: "Pell", classId: "scraper",
    sprite: { kind: "humanoid", seed: "pell", a: "teal", b: "salt" },
    bio: "Scrapes salt off the rim of the world. Has never left Rimward.",
    joinLine: "",
    battleLines: { hurt: ["Ow.", "Still standing."], win: ["Back to scraping.", "That's done."] },
  },
  {
    id: "oxbow", name: "Oxbow", classId: "hulk",
    sprite: { kind: "humanoid", seed: "oxbow-knight", a: "brown", b: "orange" },
    bio: "A Builder maintenance frame. Read one book about knights and never recovered.",
    joinLine: "A knight requires a quest. I accept yours. I accept it loudly.",
    battleLines: { hurt: ["Merely rust.", "A scratch upon my honor."], win: ["Chivalry maintained."] },
  },
  {
    id: "vane", name: "Sister Vane", short: "Vane", classId: "dispenser",
    sprite: { kind: "humanoid", seed: "sister-vane", a: "purple", b: "yellow" },
    bio: "Third Sister of the Vending Church. Prays by inserting coins.",
    joinLine: "The Vendor has a slot for everyone. Even you.",
    battleLines: { hurt: ["Insufficient funds.", "Please try again."], win: ["Thank you for your purchase."] },
  },
  {
    id: "mim", name: "Mim", classId: "lightfeeder",
    sprite: { kind: "humanoid", seed: "mim-moth", a: "white", b: "pink" },
    bio: "A moth that grew a child around itself to fit through doors.",
    joinLine: "You are warm. I will follow you until you go out.",
    battleLines: { hurt: ["Dim.", "Flicker."], win: ["Bright. Bright!"] },
  },
  {
    id: "quill", name: "Quill", classId: "archivist",
    sprite: { kind: "humanoid", seed: "quill-paper", a: "white", b: "red" },
    bio: "Made of paper. Was a person first, then a librarian, then a library.",
    joinLine: "Everything you forget, I keep. Try to forget less.",
    battleLines: { hurt: ["A tear. Literal.", "Mind the ink."], win: ["Filed."] },
  },
  {
    id: "fold", name: "Fold", classId: "cartographer",
    sprite: { kind: "humanoid", seed: "fold-maps", a: "green", b: "salt" },
    bio: "A cartographer folded out of maps of countries that no longer exist.",
    joinLine: "Nothing I draw stays drawn. Let's see if you do.",
    battleLines: { hurt: ["Creased.", "That's a border now."], win: ["Surveyed."] },
  },
  {
    id: "uhtred", name: "Uhtred-7", short: "Uhtred", classId: "debtor",
    sprite: { kind: "humanoid", seed: "uhtred-seven", a: "gray", b: "red" },
    bio: "Seventh clone of a soldier who died owing. The Bank of Teeth prints him until he pays.",
    joinLine: "I'm cheaper up front. You'll see the cost later.",
    battleLines: { hurt: ["Deductible.", "Put it on my tab."], win: ["Paid in full. Not really."] },
  },
  {
    id: "dust", name: "Dust", classId: "echo",
    sprite: { kind: "humanoid", seed: "dust-echo", a: "dark", b: "teal" },
    bio: "Pell, later. Came back through the Backward Hour to make sure it happens differently.",
    joinLine: "I remember this part. You said no. Say yes this time.",
    battleLines: { hurt: ["I've had worse. I will have worse."], win: ["Same as last time."] },
  },
  {
    id: "choir", name: "Choir", classId: "chorus",
    sprite: { kind: "humanoid", seed: "choir-forty", a: "indigo", b: "white" },
    bio: "Forty singers who agreed to be one person so they would fit in the party.",
    joinLine: "We are coming. We are one. We will take one bed.",
    battleLines: { hurt: ["Someone is bleeding. We are checking who."], win: ["Encore."] },
  },
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(chars.map((c) => [c.id, c]));

/** XP needed to go from this level to the next. */
export function xpForLevel(level: number): number {
  return Math.floor(15 * Math.pow(level, 1.4));
}
