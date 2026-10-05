import type { EnemyDef, Stats, Element, AiKind } from "../types";
import type { SpriteSpec } from "../../engine/sprites";
import type { ColorName } from "../../engine/palette";

type Mult = Partial<Record<keyof Stats, number>>;

/**
 * Baseline enemy stats for a level. Multipliers shape each species.
 * HP is sized so a party member at the same level needs about 2 to 3 hits early and 4 to 5 late,
 * when four members share the work. Attack is sized so a trash fight costs about a third of the party's HP.
 */
export function enemyStats(level: number, m: Mult = {}): Stats {
  const f = (v: number, k: keyof Stats) => Math.max(1, Math.round(v * (m[k] ?? 1)));
  return {
    hp: f(30 + 11 * level + 0.35 * level * level, "hp"),
    st: 99,
    atk: f(4 + 1.5 * level, "atk"),
    def: f(3 + 1.2 * level, "def"),
    mag: f(3 + 1.4 * level, "mag"),
    res: f(2 + 1.1 * level, "res"),
    spd: f(6 + 0.7 * level, "spd"),
  };
}

interface Spec {
  id: string; name: string; desc: string; level: number; a: ColorName; b: ColorName;
  kind?: SpriteSpec["kind"]; m?: Mult; skills?: string[]; ai?: AiKind; weak?: Element[]; resist?: Element[]; absorb?: Element[];
  drops?: { item: string; chance: number }[]; memory?: string; boss?: boolean; row?: "front" | "back"; tags?: string[];
  lines?: EnemyDef["lines"]; xp?: number; gold?: number;
}

function mk(s: Spec): EnemyDef {
  const stats = enemyStats(s.level, s.boss ? { hp: 3.6, atk: 1.4, def: 1.1, mag: 1.4, res: 1.1, spd: 1.2, ...s.m } : s.m);
  return {
    id: s.id, name: s.name, desc: s.desc, level: s.level,
    sprite: { kind: s.kind ?? "creature", seed: s.id, a: s.a, b: s.b },
    stats,
    skills: s.skills ?? ["attack"],
    ai: s.ai ?? "basic",
    weak: s.weak ?? [], resist: s.resist ?? [], absorb: s.absorb,
    xp: s.xp ?? Math.round((s.level * 8 + 8) * (s.boss ? 6 : 1)),
    gold: s.gold ?? Math.round((s.level * 3 + 2) * (s.boss ? 6 : 1)),
    drops: s.drops ?? [],
    memory: s.memory, boss: s.boss, row: s.row, tags: s.tags, lines: s.lines,
  };
}

const list: EnemyDef[] = [
  // Chapter 1: Rimward and the Salt Cellar.
  mk({ id: "saltlick", name: "Saltlick", desc: "A slug that licks the rim for a living.", level: 1, a: "salt", b: "gray", m: { hp: 0.9, spd: 0.6 }, skills: ["attack", "lick"], weak: ["heat"], resist: ["cold"], drops: [{ item: "salt_biscuit", chance: 0.3 }], memory: "mem_saltlick" }),
  mk({ id: "brine_rat", name: "Brine Rat", desc: "Fast, wet, bites.", level: 1, a: "brown", b: "pink", m: { hp: 0.7, atk: 1.1, spd: 1.4 }, skills: ["attack", "bite"], weak: ["volt"], drops: [{ item: "salt_biscuit", chance: 0.2 }], memory: "mem_rat" }),
  mk({ id: "wickworm", name: "Wickworm", desc: "A worm that burns at one end.", level: 2, a: "orange", b: "yellow", m: { hp: 0.9, mag: 1.2 }, skills: ["attack", "ember"], ai: "caster", weak: ["cold"], absorb: ["heat"], drops: [{ item: "lamp_wick", chance: 0.3 }], memory: "mem_worm" }),
  mk({ id: "lamp_mite", name: "Lamp Mite", desc: "Drinks lamplight. Tiny, many.", level: 2, a: "yellow", b: "gray", m: { hp: 0.5, atk: 0.8, spd: 1.6 }, skills: ["attack", "zap"], weak: ["rot"], drops: [{ item: "lamp_wick", chance: 0.15 }], memory: "mem_mite" }),
  mk({ id: "cellar_knot", name: "Cellar Knot", desc: "Rope that learned to want.", level: 3, a: "brown", b: "salt", m: { hp: 1.3, def: 1.3, spd: 0.7 }, skills: ["attack", "crush"], ai: "brute", weak: ["heat"], resist: ["rot"], drops: [{ item: "brine", chance: 0.25 }] }),
  mk({ id: "rust_warden", name: "Rust Warden", desc: "A Builder frame guarding the wick. It has been asleep a long time.", level: 3, a: "brown", b: "orange", kind: "humanoid", boss: true, m: { hp: 2.3, def: 1.3, spd: 0.9 }, skills: ["attack", "bash", "taunt", "crush"], ai: "boss", weak: ["volt", "rot"], resist: ["cold"], drops: [{ item: "brine", chance: 1 }], lines: { start: "INTRUDER. STATE YOUR QUEST.", half: "YOUR QUEST IS... ADEQUATE.", death: "A WORTHY... OPPONENT. I AM... AWAKE." } }),

  // Chapter 2: the Vending Church and the Metronome.
  mk({ id: "tithe_beetle", name: "Tithe Beetle", desc: "Collects coins. Keeps them.", level: 4, a: "yellow", b: "dark", m: { def: 1.3 }, skills: ["attack", "tithe"], weak: ["heat"], resist: ["volt"], drops: [{ item: "salt_biscuit", chance: 0.3 }], memory: "mem_beetle" }),
  mk({ id: "coin_golem", name: "Coin Golem", desc: "Loose change that stood up.", level: 5, a: "gray", b: "yellow", m: { hp: 1.5, def: 1.5, spd: 0.5 }, skills: ["attack", "crush"], ai: "brute", weak: ["rot", "volt"], resist: ["cold", "heat"], drops: [{ item: "lamp_wick", chance: 0.3 }], memory: "mem_golem" }),
  mk({ id: "hymnal", name: "Hymnal", desc: "A flying prayer book. Sings off key.", level: 4, a: "purple", b: "white", m: { hp: 0.7, mag: 1.4, res: 1.3 }, skills: ["attack", "hymn", "gust"], ai: "healer", weak: ["heat"], drops: [{ item: "antidote", chance: 0.3 }], memory: "mem_hymnal" }),
  mk({ id: "clerk", name: "Clerk", desc: "Keeps time for the Church. Cheats.", level: 5, a: "dark", b: "yellow", kind: "humanoid", m: { hp: 0.9, spd: 1.3 }, skills: ["attack", "tick", "tock"], ai: "tempo", weak: ["rot"], drops: [{ item: "brine", chance: 0.2 }] }),
  mk({ id: "candle_hound", name: "Candle Hound", desc: "A dog made of wax. Loyal to whoever is burning.", level: 5, a: "white", b: "orange", m: { atk: 1.2, spd: 1.2 }, skills: ["attack", "bite", "ember"], weak: ["cold"], absorb: ["heat"], drops: [{ item: "candle", chance: 0.3 }] }),
  mk({ id: "metronome", name: "The Metronome", desc: "The Church's god. It counts, and the counting is the prayer.", level: 6, a: "dark", b: "yellow", kind: "item", boss: true, m: { hp: 2.8, spd: 1.35, res: 1.3 }, skills: ["attack", "tick", "tock", "gust", "crush"], ai: "boss", weak: ["rot"], resist: ["volt", "light"], drops: [{ item: "metronome", chance: 1 }], lines: { start: "ONE. TWO. ONE. TWO.", half: "ONE. ONE. ONE.", death: "...TWO." } }),

  // Chapter 3: the Glass Steppe.
  mk({ id: "glass_hare", name: "Glass Hare", desc: "Transparent except when it wants you to see it.", level: 7, a: "salt", b: "teal", m: { hp: 0.8, spd: 1.6 }, skills: ["attack", "bite"], weak: ["volt"], resist: ["light"], drops: [{ item: "frost_vial", chance: 0.25 }], memory: "mem_hare" }),
  mk({ id: "static_jelly", name: "Static Jelly", desc: "A jellyfish of leaked star charge.", level: 7, a: "yellow", b: "teal", m: { hp: 1.1, def: 0.7, mag: 1.3 }, skills: ["attack", "zap", "zap"], ai: "caster", weak: ["rot"], absorb: ["volt"], drops: [{ item: "spark_jar", chance: 0.3 }], memory: "mem_jelly" }),
  mk({ id: "prism_hound", name: "Prism Hound", desc: "Hunts in packs. Each one is a different color of the same dog.", level: 8, a: "white", b: "red", m: { atk: 1.2, spd: 1.2 }, skills: ["attack", "howl", "prism"], ai: "trickster", weak: ["rot"], resist: ["light"], drops: [{ item: "brine", chance: 0.25 }], memory: "mem_hound" }),
  mk({ id: "sunburnt_monk", name: "Sunburnt Monk", desc: "Stood in the Ember's last light too long and liked it.", level: 8, a: "orange", b: "white", kind: "humanoid", m: { hp: 1.2, res: 1.3 }, skills: ["attack", "ember", "flare", "lick"], ai: "caster", weak: ["cold"], resist: ["heat"], drops: [{ item: "oil_bomb", chance: 0.3 }], memory: "mem_monk" }),
  mk({ id: "shard_colony", name: "Shard Colony", desc: "Many small glass things that vote.", level: 9, a: "salt", b: "white", m: { hp: 1.4, def: 1.2, spd: 0.8 }, skills: ["attack", "shatter"], ai: "brute", weak: ["heat", "volt"], resist: ["cold"], drops: [{ item: "glass_blade", chance: 0.05 }, { item: "frost_vial", chance: 0.3 }] }),
  mk({ id: "lantern_whale", name: "Lantern Whale", desc: "A whale that swims through the glass with a lamp in its throat.", level: 10, a: "blue", b: "yellow", boss: true, m: { hp: 3.2, atk: 1.3, mag: 1.35 }, skills: ["attack", "flare", "shatter", "crush", "chill"], ai: "boss", weak: ["volt"], resist: ["cold", "light"], drops: [{ item: "prism_rod", chance: 1 }], lines: { start: "The lamp in me is the last one. Take it if you can.", half: "It is going out. Faster now.", death: "Keep it lit. Please." } }),

  // Chapter 4: the Library of Moths.
  mk({ id: "pageant", name: "Pageant", desc: "A moth that is also a page. Reads itself aloud.", level: 11, a: "white", b: "red", m: { hp: 0.8, mag: 1.3, spd: 1.3 }, skills: ["attack", "gust", "flare"], ai: "caster", weak: ["heat"], resist: ["light"], drops: [{ item: "candle", chance: 0.3 }], memory: "mem_page" }),
  mk({ id: "index_wraith", name: "Index Wraith", desc: "Knows where everything is. Takes it.", level: 11, a: "dark", b: "purple", m: { hp: 1.0, mag: 1.4, def: 0.8 }, skills: ["attack", "drain", "eclipse"], ai: "caster", weak: ["light"], resist: ["rot"], drops: [{ item: "moth_dust", chance: 0.2 }], memory: "mem_wraith" }),
  mk({ id: "marginalia", name: "Marginalia", desc: "Notes someone wrote in a book, grown teeth.", level: 12, a: "red", b: "white", m: { atk: 1.3, spd: 1.2, hp: 0.9 }, skills: ["attack", "bite", "sting"], ai: "trickster", weak: ["heat"], drops: [{ item: "antidote", chance: 0.3 }] }),
  mk({ id: "shelf_golem", name: "Shelf Golem", desc: "Shelves full of books that walked away.", level: 13, a: "brown", b: "white", m: { hp: 1.6, def: 1.5, spd: 0.5 }, skills: ["attack", "crush", "shove"], ai: "brute", weak: ["heat"], resist: ["cold"], drops: [{ item: "paper_robe", chance: 0.05 }, { item: "tonic", chance: 0.2 }] }),
  mk({ id: "silverfish", name: "Silverfish King", desc: "Ate a chapter about kings.", level: 12, a: "gray", b: "salt", m: { spd: 1.5, hp: 0.9 }, skills: ["attack", "bite", "howl"], weak: ["heat", "volt"], drops: [{ item: "lamp_wick", chance: 0.3 }] }),
  mk({ id: "the_unread", name: "The Unread", desc: "Every book nobody opened, as one shape. It is very lonely and very angry.", level: 14, a: "dark", b: "white", boss: true, m: { hp: 3.4, mag: 1.55, res: 1.3 }, skills: ["attack", "drain", "eclipse", "verse", "unmake"], ai: "boss", weak: ["heat", "light"], resist: ["rot", "cold"], drops: [{ item: "leech_tooth", chance: 1 }], lines: { start: "You never opened me. Nobody did.", half: "Read me. READ ME.", death: "...oh. That's how it ends." } }),

  // Chapter 5: the Fold.
  mk({ id: "contour_snake", name: "Contour Snake", desc: "A line on a map that is also a snake.", level: 15, a: "green", b: "salt", m: { spd: 1.4, hp: 0.9 }, skills: ["attack", "sting", "hook"], ai: "trickster", weak: ["cold"], drops: [{ item: "antidote", chance: 0.3 }], memory: "mem_snake" }),
  mk({ id: "legend", name: "Legend", desc: "A map key. Each symbol is a tooth.", level: 15, a: "salt", b: "green", kind: "item", m: { def: 1.4, mag: 1.3 }, skills: ["attack", "prism", "shove"], ai: "caster", weak: ["rot"], resist: ["light"], drops: [{ item: "brine", chance: 0.3 }] }),
  mk({ id: "compass_wasp", name: "Compass Wasp", desc: "Always points at you.", level: 16, a: "yellow", b: "dark", m: { atk: 1.3, spd: 1.5, hp: 0.8 }, skills: ["attack", "sting", "sting"], weak: ["cold", "volt"], drops: [{ item: "spark_jar", chance: 0.25 }] }),
  mk({ id: "border_guard", name: "Border Guard", desc: "Guards a border between two places that merged.", level: 17, a: "gray", b: "green", kind: "humanoid", m: { hp: 1.4, def: 1.4, spd: 0.7 }, skills: ["attack", "crush", "shove", "taunt"], ai: "brute", weak: ["volt"], resist: ["rot"], drops: [{ item: "tonic", chance: 0.2 }] }),
  mk({ id: "scale_bar", name: "Scale Bar", desc: "One inch equals however far it wants.", level: 16, a: "white", b: "dark", kind: "item", m: { hp: 1.1, mag: 1.2 }, skills: ["attack", "tick", "shatter", "hook"], ai: "tempo", weak: ["heat"], drops: [{ item: "moth_dust", chance: 0.2 }] }),
  mk({ id: "blank_spot_boss", name: "Blank Spot", desc: "The part of the map that was never drawn. It would like to stay that way.", level: 18, a: "salt", b: "dark", boss: true, m: { hp: 3.6, def: 1.2, spd: 1.4, mag: 1.5 }, skills: ["attack", "shove", "eclipse", "crush", "verse", "hook"], ai: "boss", weak: ["light"], resist: ["rot", "cold"], drops: [{ item: "map_cloak", chance: 1 }], lines: { start: "Here be nothing. Go back.", half: "You are drawing me. Stop.", death: "Fine. Put me on the map." } }),

  // Chapter 6: the Bank of Teeth.
  mk({ id: "teller", name: "Teller", desc: "Smiles with all of them.", level: 19, a: "white", b: "gray", kind: "humanoid", m: { mag: 1.3, res: 1.3 }, skills: ["attack", "lend", "tithe", "hymn"], ai: "banker", weak: ["rot"], resist: ["light"], drops: [{ item: "tooth", chance: 0.4 }], memory: "mem_teller" }),
  mk({ id: "vault_tick", name: "Vault Tick", desc: "Lives in the vault. Eats interest.", level: 19, a: "gray", b: "red", m: { hp: 1.3, def: 1.6, spd: 0.6 }, skills: ["attack", "crush", "drain"], ai: "brute", weak: ["heat"], resist: ["cold", "volt"], drops: [{ item: "tooth", chance: 0.3 }] }),
  mk({ id: "interest_rat", name: "Interest Rat", desc: "Multiplies every turn you do not pay.", level: 20, a: "brown", b: "white", m: { hp: 0.8, spd: 1.6, atk: 1.2 }, skills: ["attack", "bite", "howl"], weak: ["volt"], drops: [{ item: "tooth", chance: 0.3 }] }),
  mk({ id: "repo_man", name: "Repo Man", desc: "Takes what is owed, which is everything.", level: 21, a: "dark", b: "red", kind: "humanoid", m: { atk: 1.4, hp: 1.1 }, skills: ["attack", "repo", "crush", "lend"], ai: "banker", weak: ["light"], resist: ["rot"], drops: [{ item: "tooth_saw", chance: 0.05 }, { item: "brine", chance: 0.3 }] }),
  mk({ id: "ledger", name: "Ledger", desc: "A book that knows your balance. It is not good.", level: 20, a: "white", b: "red", kind: "item", m: { res: 1.4, mag: 1.3 }, skills: ["attack", "verse", "lend", "eclipse"], ai: "caster", weak: ["heat"], drops: [{ item: "tonic", chance: 0.3 }] }),
  mk({ id: "the_lender", name: "The Lender", desc: "Owns the Bank of Teeth. Owns most teeth.", level: 22, a: "white", b: "red", kind: "humanoid", boss: true, m: { hp: 3.8, atk: 1.5, mag: 1.5 }, skills: ["attack", "lend", "repo", "crush", "drain", "unmake", "verse"], ai: "boss", weak: ["light", "volt"], resist: ["rot"], drops: [{ item: "ledger_vest", chance: 1 }], lines: { start: "Everything is owed. I am only the one who counts.", half: "Compounding.", death: "Account... closed." } }),

  // Chapter 7: the Backward Hour.
  mk({ id: "unwolf", name: "Un-wolf", desc: "A wolf that gets younger as it bites.", level: 23, a: "gray", b: "teal", m: { atk: 1.15, spd: 1.25 }, skills: ["attack", "bite", "unwind"], ai: "trickster", weak: ["heat"], resist: ["cold"], drops: [{ item: "brine", chance: 0.3 }] }),
  mk({ id: "yesterday", name: "Yesterday Ghost", desc: "What you did yesterday, hunting you.", level: 23, a: "dark", b: "teal", kind: "humanoid", m: { hp: 0.9, mag: 1.4, res: 1.4 }, skills: ["attack", "drain", "unwind", "eclipse"], ai: "caster", weak: ["light"], resist: ["rot", "cold"], drops: [{ item: "moth_dust", chance: 0.25 }], memory: "mem_ghost" }),
  mk({ id: "clockmoth", name: "Clockmoth", desc: "Its wings are faces. The hands go the wrong way.", level: 24, a: "dark", b: "yellow", m: { spd: 1.5, hp: 0.75, mag: 0.9 }, skills: ["attack", "tick", "tock", "flare"], ai: "tempo", weak: ["rot"], resist: ["light"], drops: [{ item: "lamp_wick", chance: 0.4 }] }),
  mk({ id: "regret", name: "Regret", desc: "It is heavy and it follows.", level: 25, a: "indigo", b: "dark", m: { hp: 1.7, def: 1.4, spd: 0.5 }, skills: ["attack", "crush", "drain"], ai: "brute", weak: ["light", "heat"], resist: ["rot"], drops: [{ item: "tonic", chance: 0.3 }] }),
  mk({ id: "pells_death", name: "Pell's Death", desc: "It is Pell. It is what happens to Pell. It is here early.", level: 26, a: "dark", b: "salt", kind: "humanoid", boss: true, m: { hp: 2.9, atk: 1.3, mag: 1.3, spd: 1.15 }, skills: ["attack", "crush", "unmake", "unwind", "eclipse", "shatter"], ai: "boss", weak: ["light"], resist: ["rot", "cold", "heat"], drops: [{ item: "hour_hand", chance: 1 }], lines: { start: "I am what you are for. Sit down.", half: "You cannot undo this. I am the undoing.", death: "...later, then." } }),

  // Chapter 8: the Choir Steps.
  mk({ id: "crowd", name: "Crowd", desc: "A crowd. It wants to be one thing and cannot agree what.", level: 26, a: "indigo", b: "white", m: { hp: 1.5, def: 0.9 }, skills: ["attack", "verse", "howl"], weak: ["volt"], drops: [{ item: "brine", chance: 0.3 }] }),
  mk({ id: "harmonic", name: "Harmonic", desc: "A note that agrees with itself too much.", level: 26, a: "white", b: "indigo", kind: "item", m: { mag: 1.5, hp: 0.8 }, skills: ["attack", "verse", "hymn"], ai: "healer", weak: ["rot"], resist: ["light"], drops: [{ item: "lamp_wick", chance: 0.3 }] }),
  mk({ id: "dissonant", name: "Dissonant", desc: "A note that disagrees with everything, including you.", level: 27, a: "red", b: "indigo", kind: "item", m: { atk: 1.3, mag: 1.3, spd: 1.3 }, skills: ["attack", "zap", "shatter", "gust"], ai: "caster", weak: ["light"], drops: [{ item: "spark_jar", chance: 0.3 }] }),
  mk({ id: "stage_fright", name: "Stage Fright", desc: "Looks at you. Everyone is looking at you.", level: 27, a: "dark", b: "pink", m: { hp: 1.2, spd: 1.2 }, skills: ["attack", "eclipse", "flare", "drain"], ai: "trickster", weak: ["heat"], resist: ["rot"], drops: [{ item: "antidote", chance: 0.3 }] }),
  mk({ id: "the_conductor", name: "The Conductor", desc: "Keeps forty voices in time. Will keep yours.", level: 29, a: "indigo", b: "yellow", kind: "humanoid", boss: true, m: { hp: 2.8, mag: 1.3, spd: 1.25 }, skills: ["attack", "verse", "tick", "crescendo_e", "loom", "crush"], ai: "boss", weak: ["rot"], resist: ["light", "volt"], drops: [{ item: "tuning_fork", chance: 1 }], lines: { start: "You are flat. All of you. We will fix that.", half: "Louder. LOUDER.", death: "...rest." } }),

  // Chapter 9: the Moth Crown.
  mk({ id: "builder_remnant", name: "Builder Remnant", desc: "What is left of the ones who built the Shell. Mostly hands.", level: 30, a: "gray", b: "teal", kind: "humanoid", m: { hp: 1.1, def: 1.3, mag: 1.1 }, skills: ["attack", "crush", "prism", "repo"], ai: "brute", weak: ["rot", "volt"], resist: ["heat", "cold"], drops: [{ item: "tonic", chance: 0.3 }] }),
  mk({ id: "loom_spider", name: "Loom Spider", desc: "Weaves light into the fabric of the Shell. Bites.", level: 30, a: "white", b: "yellow", m: { spd: 1.4, atk: 1.1, hp: 0.85 }, skills: ["attack", "sting", "prism", "tick"], ai: "trickster", weak: ["rot"], resist: ["light"], drops: [{ item: "moth_dust", chance: 0.3 }] }),
  mk({ id: "ember_moth", name: "Ember Moth", desc: "The moths that came first. They remember the sun.", level: 31, a: "orange", b: "white", m: { mag: 1.25, hp: 0.85 }, skills: ["attack", "ember", "flare", "gust"], ai: "caster", weak: ["cold"], absorb: ["heat", "light"], drops: [{ item: "candle", chance: 0.4 }] }),
  mk({ id: "the_loom", name: "The Loom", desc: "The Builders' last machine. It wove the Shell. It is weaving the end.", level: 33, a: "white", b: "yellow", kind: "item", boss: true, m: { hp: 2.5, atk: 1.15, mag: 1.25, def: 1.2, res: 1.3 }, skills: ["attack", "loom", "unmake", "eclipse", "crush", "repo", "tick"], ai: "boss", weak: ["rot"], resist: ["light", "heat", "cold", "volt"], drops: [], lines: { start: "I HAVE WOVEN EVERY THREAD OF YOU. SIT.", half: "THE PATTERN IS DAMAGED. THE PATTERN WAS ALWAYS DAMAGED.", death: "...WEAVE SOMETHING BETTER." } }),
  mk({ id: "the_ember", name: "The Ember", desc: "The dying star, with a face. It is not angry. It is tired.", level: 32, a: "red", b: "yellow", boss: true, m: { hp: 3.3, atk: 1.2, mag: 1.3, def: 1.1, res: 1.3, spd: 1.1 }, skills: ["attack", "loom", "flare", "ember", "unmake", "crush", "eclipse"], ai: "boss", weak: ["cold", "rot"], absorb: ["heat", "light"], drops: [], lines: { start: "I have been going out for ten thousand years. Let me.", half: "You would keep me burning? For them?", death: "...then carry me. Carefully." } }),
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.id, e]));

export function enemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`unknown enemy ${id}`);
  return e;
}

/** Encounter tables per area. Weights pick the group, groups list enemy ids. */
export interface EncounterGroup { ids: string[]; weight: number }
export const ENCOUNTERS: Record<string, EncounterGroup[]> = {
  rim_field: [
    { ids: ["saltlick"], weight: 3 }, { ids: ["brine_rat"], weight: 3 }, { ids: ["saltlick", "brine_rat"], weight: 2 }, { ids: ["brine_rat", "brine_rat"], weight: 1 },
  ],
  salt_cellar: [
    { ids: ["wickworm"], weight: 3 }, { ids: ["lamp_mite", "lamp_mite"], weight: 3 }, { ids: ["wickworm", "lamp_mite"], weight: 2 }, { ids: ["cellar_knot"], weight: 2 }, { ids: ["saltlick", "wickworm"], weight: 1 },
  ],
  church_road: [
    { ids: ["tithe_beetle"], weight: 3 }, { ids: ["tithe_beetle", "hymnal"], weight: 2 }, { ids: ["candle_hound"], weight: 2 }, { ids: ["clerk"], weight: 2 },
  ],
  church_inner: [
    { ids: ["coin_golem"], weight: 2 }, { ids: ["clerk", "hymnal"], weight: 3 }, { ids: ["candle_hound", "candle_hound"], weight: 2 }, { ids: ["tithe_beetle", "tithe_beetle", "hymnal"], weight: 2 }, { ids: ["coin_golem", "clerk"], weight: 1 },
  ],
  steppe: [
    { ids: ["glass_hare", "glass_hare"], weight: 3 }, { ids: ["static_jelly"], weight: 3 }, { ids: ["prism_hound", "prism_hound"], weight: 2 }, { ids: ["sunburnt_monk"], weight: 2 }, { ids: ["static_jelly", "glass_hare"], weight: 2 },
  ],
  steppe_deep: [
    { ids: ["shard_colony"], weight: 2 }, { ids: ["prism_hound", "prism_hound", "prism_hound"], weight: 2 }, { ids: ["sunburnt_monk", "static_jelly"], weight: 3 }, { ids: ["shard_colony", "glass_hare"], weight: 2 },
  ],
  library: [
    { ids: ["pageant", "pageant"], weight: 3 }, { ids: ["index_wraith"], weight: 3 }, { ids: ["marginalia", "marginalia"], weight: 2 }, { ids: ["silverfish"], weight: 2 }, { ids: ["pageant", "index_wraith"], weight: 2 },
  ],
  library_deep: [
    { ids: ["shelf_golem"], weight: 2 }, { ids: ["index_wraith", "index_wraith"], weight: 2 }, { ids: ["marginalia", "silverfish", "pageant"], weight: 3 }, { ids: ["shelf_golem", "pageant"], weight: 2 },
  ],
  fold: [
    { ids: ["contour_snake", "contour_snake"], weight: 3 }, { ids: ["legend"], weight: 2 }, { ids: ["compass_wasp", "compass_wasp"], weight: 3 }, { ids: ["scale_bar"], weight: 2 }, { ids: ["border_guard"], weight: 2 },
  ],
  fold_deep: [
    { ids: ["border_guard", "legend"], weight: 3 }, { ids: ["compass_wasp", "compass_wasp", "contour_snake"], weight: 2 }, { ids: ["scale_bar", "scale_bar"], weight: 2 }, { ids: ["border_guard", "border_guard"], weight: 1 },
  ],
  bank: [
    { ids: ["teller"], weight: 3 }, { ids: ["vault_tick"], weight: 2 }, { ids: ["interest_rat", "interest_rat"], weight: 3 }, { ids: ["ledger"], weight: 2 }, { ids: ["teller", "interest_rat"], weight: 2 },
  ],
  bank_deep: [
    { ids: ["repo_man"], weight: 3 }, { ids: ["vault_tick", "teller"], weight: 2 }, { ids: ["interest_rat", "interest_rat", "interest_rat"], weight: 2 }, { ids: ["ledger", "repo_man"], weight: 2 },
  ],
  hour: [
    { ids: ["unwolf", "unwolf"], weight: 3 }, { ids: ["yesterday"], weight: 3 }, { ids: ["clockmoth", "clockmoth"], weight: 2 }, { ids: ["regret"], weight: 2 },
  ],
  hour_deep: [
    { ids: ["regret", "yesterday"], weight: 3 }, { ids: ["clockmoth", "unwolf", "unwolf"], weight: 2 }, { ids: ["yesterday", "yesterday"], weight: 2 }, { ids: ["regret", "regret"], weight: 1 },
  ],
  choir: [
    { ids: ["crowd"], weight: 3 }, { ids: ["harmonic", "dissonant"], weight: 3 }, { ids: ["stage_fright"], weight: 2 }, { ids: ["crowd", "harmonic"], weight: 2 },
  ],
  choir_deep: [
    { ids: ["dissonant", "dissonant"], weight: 2 }, { ids: ["stage_fright", "crowd"], weight: 3 }, { ids: ["harmonic", "harmonic", "dissonant"], weight: 2 }, { ids: ["crowd", "crowd"], weight: 1 },
  ],
  crown: [
    { ids: ["builder_remnant"], weight: 3 }, { ids: ["loom_spider", "loom_spider"], weight: 3 }, { ids: ["ember_moth"], weight: 2 }, { ids: ["builder_remnant", "loom_spider"], weight: 2 },
  ],
  crown_deep: [
    { ids: ["ember_moth", "ember_moth"], weight: 2 }, { ids: ["builder_remnant", "builder_remnant"], weight: 2 }, { ids: ["loom_spider", "ember_moth", "builder_remnant"], weight: 1 }, { ids: ["loom_spider", "ember_moth"], weight: 3 },
  ],
};
