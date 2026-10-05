// GAME — the rules of one playthrough, with no DOM: screens, party, chapter
// flow, shop, and the battle command menu. ui.ts draws a Game and turns key
// presses into input(); the headless playthrough test drives the same calls.

import { RNG, hashStr } from "../core/rng.js";
import { CHAPTER_BY_NUMBER } from "../game/chapters.js";
import { COMPANIONS, PLAYER_BASE, PLAYER_GROWTH, applyLevelGrowth, xpForLevel } from "../game/characters.js";
import { GRAPH_START, getNode } from "../game/dialogue.js";
import { itemById } from "../game/items.js";
import { getSkill, skillsFor } from "../game/skills.js";
import { ENDINGS } from "../game/story.js";
import type { DialogueNode, PlayerSave, SaveData, StatKey, Stats, UnitBase, Unit } from "../game/types.js";
import { Battle, type BattleAction, type BattleEvent, type PartyMember } from "./battle.js";
import { createMap, movePlayer, movePlayerTo, type MapState } from "./map.js";

export type Screen = "title" | "chapter" | "dialogue" | "map" | "party" | "battle" | "shop" | "gameover" | "ending";
export type Key = "up" | "down" | "left" | "right" | "ok" | "back" | "new" | "save" | "menu";

export interface SaveStore {
  load(): SaveData | null;
  save(data: SaveData): void;
  clear(): void;
}

export type MenuStage = "skill" | "item" | "enemy" | "ally" | "result";

export interface BattleMenu {
  actor: number;            // party index choosing a command
  stage: MenuStage;
  cursor: number;
  pending: BattleAction | null;
  log: BattleEvent[];       // events from the last round
  notes: string[];          // rewards and level-ups shown on the result page
}

export interface MenuOption {
  label: string;
  detail: string;
  enabled: boolean;
}

export interface Game {
  screen: Screen;
  chapter: number;
  map: MapState | null;
  player: PlayerSave;       // player.items is the party's shared bag
  party: PlayerSave[];      // companions
  credits: number;
  flags: Record<string, boolean>;
  battles: number;
  wins: number;
  dialogue: { node: string; line: number; cursor: number; queue: string[]; then: "map" | "advance" };
  battle: Battle | null;
  bossFight: boolean;
  menu: BattleMenu;
  shopCursor: number;
  partyCursor: number;
  partyTarget: number | null; // member chosen for an item on the party screen
  message: string;
  ending: { title: string; text: string };
  runSeed: number;
  retries: number;          // losses on this save, mixed into battle seeds so a retry plays out differently
  store: SaveStore;
}

const HP_PER_LEVEL = 4;     // on top of the +1 hp applyLevelGrowth may give
const STARTING_BAG: Record<string, number> = { c_mend: 2 };

// ---- party helpers -----------------------------------------------------

function baseOf(cls: string): UnitBase {
  return COMPANIONS[cls] ? COMPANIONS[cls].base : PLAYER_BASE;
}

function growthOf(cls: string): Partial<Record<StatKey, number>> {
  return COMPANIONS[cls] ? COMPANIONS[cls].statGrowth : PLAYER_GROWTH;
}

function grow(stats: Stats, cls: string): void {
  applyLevelGrowth(stats, growthOf(cls));
  stats.hp += HP_PER_LEVEL;
}

function skillIds(cls: string, chapter: number): string[] {
  return skillsFor(cls, chapter).map((s) => s.id);
}

export function makeMember(cls: string, level: number, chapter: number): PlayerSave {
  const b = baseOf(cls);
  const stats: Stats = { hp: b.hp, atk: b.atk, def: b.def, spd: b.spd, wit: b.wit };
  for (let l = 1; l < level; l++) grow(stats, cls);
  return {
    id: cls, name: b.name, cls, level, xp: 0, stats, hp: stats.hp,
    skills: skillIds(cls, chapter),
    weapon: cls === "mender" ? "w_spare" : "", armor: "", trinket: "",
    items: {},
  };
}

export function members(g: Game): PlayerSave[] {
  return [g.player, ...g.party];
}

export function maxHpOf(m: PlayerSave): number {
  let hp = m.stats.hp;
  for (const id of [m.weapon, m.armor, m.trinket]) if (id) hp += itemById(id).hp ?? 0;
  return hp;
}

function healAll(g: Game): void {
  for (const m of members(g)) m.hp = maxHpOf(m);
}

function toUnit(m: PlayerSave): Unit {
  return {
    ...baseOf(m.cls),
    name: m.name,
    atk: m.stats.atk, def: m.stats.def, spd: m.stats.spd, wit: m.stats.wit,
    hp: m.hp,
    maxHp: m.stats.hp,
    alive: m.hp > 0,
    statuses: [],
    buffs: {},
  };
}

// ---- lifecycle ---------------------------------------------------------

export function createGame(store: SaveStore, runSeed = Date.now() >>> 0): Game {
  return {
    screen: "title",
    chapter: 1,
    map: null,
    player: makeMember("mender", 1, 1),
    party: [],
    credits: 50,
    flags: {},
    battles: 0,
    wins: 0,
    dialogue: { node: "", line: 0, cursor: 0, queue: [], then: "map" },
    battle: null,
    bossFight: false,
    menu: { actor: 0, stage: "skill", cursor: 0, pending: null, log: [], notes: [] },
    shopCursor: 0,
    partyCursor: 0,
    partyTarget: null,
    message: "",
    ending: { title: "", text: "" },
    runSeed,
    retries: 0,
    store,
  };
}

function startNewRun(g: Game): void {
  const fresh = createGame(g.store, g.runSeed);
  Object.assign(g, fresh);
  g.player.items = { ...STARTING_BAG };
  enterChapter(g, 1);
}

function continueRun(g: Game, data: SaveData): void {
  const fresh = createGame(g.store, g.runSeed);
  Object.assign(g, fresh);
  g.chapter = data.chapter;
  g.player = data.player;
  g.party = data.party;
  g.credits = data.credits;
  g.flags = data.flags;
  g.battles = data.battles;
  g.wins = data.wins;
  g.runSeed = data.rngSeed;
  g.retries = data.retries ?? 0;
  g.map = createMap(CHAPTER_BY_NUMBER[g.chapter].map, data.floor);
  if (data.spot && g.map.tiles[data.spot.y]?.[data.spot.x]?.type !== "wall") {
    movePlayerTo(g.map, data.spot.x, data.spot.y);
    g.map.encountersLeft = data.spot.encountersLeft;
  }
  g.screen = "map";
  g.message = `Continued: chapter ${g.chapter}, floor ${data.floor + 1}.`;
}

export function toSave(g: Game): SaveData {
  return {
    version: 2,
    chapter: g.chapter,
    floor: g.map?.floor ?? 0,
    player: g.player,
    party: g.party,
    flags: g.flags,
    seen: [],
    playTimeMs: 0,
    battles: g.battles,
    wins: g.wins,
    credits: g.credits,
    rngSeed: g.runSeed,
    retries: g.retries,
    spot: g.map ? { x: g.map.playerX, y: g.map.playerY, encountersLeft: g.map.encountersLeft } : undefined,
  };
}

/** Set up chapter n: party joins and leaves, skills unlock, intro plays. */
function enterChapter(g: Game, n: number): void {
  const ch = CHAPTER_BY_NUMBER[n];
  g.chapter = n;
  const joined: string[] = [];
  g.party = g.party.filter((m) => ch.companions.includes(m.id));
  for (const id of ch.companions) {
    if (g.party.length >= ch.partyCap) break;
    if (!g.party.some((m) => m.id === id)) {
      g.party.push(makeMember(id, g.player.level, n));
      joined.push(id);
    }
  }
  for (const m of members(g)) m.skills = skillIds(m.cls, n);
  healAll(g);
  g.map = createMap(ch.map, 0);
  g.store.save(toSave(g));
  g.dialogue = { node: "", line: 0, cursor: 0, queue: [ch.map.intro, ...joined.map((id) => COMPANIONS[id].intro)], then: "map" };
  g.screen = "chapter";
}

// ---- dialogue ----------------------------------------------------------

function playDialogue(g: Game, graphs: string[], then: "map" | "advance"): void {
  const [first, ...rest] = graphs;
  g.dialogue = { node: GRAPH_START[first], line: 0, cursor: 0, queue: rest, then };
  g.screen = "dialogue";
}

export function currentNode(g: Game): DialogueNode {
  return getNode(g.dialogue.node);
}

/** True when the last line of the node is showing and it offers choices. */
export function choosing(g: Game): boolean {
  const n = currentNode(g);
  return !!n.choices?.length && g.dialogue.line >= n.lines.length - 1;
}

function dialogueInput(g: Game, key: Key): void {
  const d = g.dialogue;
  const n = currentNode(g);
  if (choosing(g)) {
    const count = n.choices!.length;
    if (key === "up") d.cursor = (d.cursor + count - 1) % count;
    if (key === "down") d.cursor = (d.cursor + 1) % count;
    if (key !== "ok") return;
    const c = n.choices![d.cursor];
    if (c.effect) g.flags[c.effect] = true;
    d.node = c.next;
    d.line = 0;
    d.cursor = 0;
    return;
  }
  if (key !== "ok") return;
  if (d.line < n.lines.length - 1) { d.line++; return; }
  if (n.end === "game") { finishGame(g); return; }
  if (n.next) { d.node = n.next; d.line = 0; return; }
  if (d.queue.length) { playDialogue(g, d.queue, d.then); return; }
  if (d.then === "advance") enterChapter(g, g.chapter + 1);
  else g.screen = "map";
}

function finishGame(g: Game): void {
  const key = Object.keys(ENDINGS).find((k) => g.flags[`ending_${k}`]) ?? "dream";
  g.ending = { title: ENDINGS[key].name, text: ENDINGS[key].text };
  g.screen = "ending";
  g.store.clear();
}

// ---- map ---------------------------------------------------------------

function mapInput(g: Game, key: Key): void {
  const map = g.map!;
  if (key === "save") {
    g.store.save(toSave(g));
    g.message = "Game saved.";
    return;
  }
  if (key === "menu") {
    g.screen = "party";
    g.partyCursor = 0;
    g.partyTarget = null;
    g.message = "";
    return;
  }
  const delta: Partial<Record<Key, [number, number]>> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const d = delta[key];
  if (!d) return;
  const ev = movePlayer(map, d[0], d[1]);
  if (ev.kind === "nothing") return;
  g.message = "";
  if (ev.kind === "encounter") {
    startBattle(g, encounterGroup(g), false);
    if (map.encountersLeft === 0) g.message = "The stair to the guardian is open.";
  } else if (ev.kind === "boss-stair") {
    const data = ev.data as { boss: string; locked: boolean };
    if (data.locked) g.message = `The stair is sealed. Win ${map.encountersLeft} more fight${map.encountersLeft === 1 ? "" : "s"} first.`;
    else startBattle(g, [data.boss], true);
  } else if (ev.kind === "shop") {
    g.screen = "shop";
    g.shopCursor = 0;
  }
}

function encounterGroup(g: Game): string[] {
  const def = g.map!.def;
  const rng = new RNG(hashStr(`group:${g.runSeed}:${g.chapter}:${g.battles}:${g.retries}`));
  const size = rng.int(1, g.chapter === 1 ? 2 : 3);
  const pool = def.enemies.filter((id) => id !== def.elite);
  const group: string[] = [];
  for (let i = 0; i < size; i++) group.push(rng.pick(pool));
  if (def.elite && rng.chance(0.12)) group[0] = def.elite;
  return group;
}

// ---- shop --------------------------------------------------------------

function shopStock(g: Game): { id: string; price: number }[] {
  const shops = g.map!.def.shops;
  const s = shops[Math.min(g.map!.floor, shops.length - 1)];
  return s ? s.items.map((id) => ({ id, price: s.prices[id] })) : [];
}

/** The member who would wear a piece of gear, or null if nobody gains from it. */
function gearTarget(g: Game, id: string): PlayerSave | null {
  const item = itemById(id);
  const score = (itemId: string) => {
    if (!itemId) return -1;
    const it = itemById(itemId);
    return (it.atk ?? 0) + (it.def ?? 0) + (it.hp ?? 0) / 4 + (it.passive ? 5 : 0);
  };
  const slot = item.kind as "weapon" | "armor" | "trinket";
  let best: PlayerSave | null = null;
  let bestGain = 0;
  for (const m of members(g)) {
    const gain = score(id) - score(m[slot]);
    if (m[slot] !== id && gain > bestGain) { best = m; bestGain = gain; }
  }
  return best;
}

export function shopOptions(g: Game): MenuOption[] {
  const opts = shopStock(g).map(({ id, price }) => {
    const it = itemById(id);
    if (it.kind === "consumable") {
      return { label: `${it.name}  ${price}c`, detail: `${it.desc} Heals ${it.use!.heal}. You have ${g.player.items[id] ?? 0}.`, enabled: g.credits >= price };
    }
    const who = gearTarget(g, id);
    const stats = (["atk", "def", "spd", "wit", "hp"] as const).filter((k) => it[k]).map((k) => `${k}+${it[k]}`).join(" ");
    return {
      label: `${it.name}  ${price}c`,
      detail: `${it.desc} ${stats}${who ? `. For ${who.name}.` : ". Nobody needs it."}`,
      enabled: g.credits >= price && !!who,
    };
  });
  opts.push({ label: "Leave", detail: "Back to the map.", enabled: true });
  return opts;
}

function shopInput(g: Game, key: Key): void {
  const opts = shopOptions(g);
  if (key === "up") g.shopCursor = (g.shopCursor + opts.length - 1) % opts.length;
  if (key === "down") g.shopCursor = (g.shopCursor + 1) % opts.length;
  if (key === "back" || (key === "ok" && g.shopCursor === opts.length - 1)) {
    g.screen = "map";
    g.message = "";
    return;
  }
  if (key !== "ok" || !opts[g.shopCursor].enabled) return;
  const { id, price } = shopStock(g)[g.shopCursor];
  const it = itemById(id);
  g.credits -= price;
  if (it.kind === "consumable") {
    g.player.items[id] = (g.player.items[id] ?? 0) + 1;
    g.message = `Bought ${it.name}.`;
  } else {
    const who = gearTarget(g, id)!;
    const slot = it.kind as Slot;
    const old = who[slot];
    g.player.items[id] = (g.player.items[id] ?? 0) + 1;
    equip(g, who, slot, id);
    g.message = `${who.name} equips ${it.name}.${old ? ` ${itemById(old).name} goes in the bag.` : ""}`;
  }
}

// ---- party screen ------------------------------------------------------

export type Slot = "weapon" | "armor" | "trinket";
const SLOTS: Slot[] = ["weapon", "armor", "trinket"];

export type PartyRow =
  | { kind: "slot"; member: number; slot: Slot }
  | { kind: "use"; id: string };

/** Move `id` from the bag into the member's slot; whatever was there goes back in the bag. */
function equip(g: Game, m: PlayerSave, slot: Slot, id: string): void {
  const bag = g.player.items;
  const before = maxHpOf(m);
  if (m[slot]) bag[m[slot]] = (bag[m[slot]] ?? 0) + 1;
  if (id) bag[id] -= 1;
  m[slot] = id;
  m.hp = Math.min(maxHpOf(m), Math.max(1, m.hp + maxHpOf(m) - before));
}

/** Spare gear of one kind in the bag, sorted by id. */
export function spareGear(g: Game, kind: Slot): string[] {
  const bag = g.player.items;
  return Object.keys(bag).filter((id) => bag[id] > 0 && itemById(id).kind === kind).sort();
}

export function partyRows(g: Game): PartyRow[] {
  const rows: PartyRow[] = [];
  members(g).forEach((_, i) => SLOTS.forEach((slot) => rows.push({ kind: "slot", member: i, slot })));
  for (const id of consumables(g)) rows.push({ kind: "use", id });
  return rows;
}

function partyInput(g: Game, key: Key): void {
  const ms = members(g);
  if (g.partyTarget !== null) {
    if (key === "up") g.partyTarget = (g.partyTarget + ms.length - 1) % ms.length;
    if (key === "down") g.partyTarget = (g.partyTarget + 1) % ms.length;
    if (key === "back") { g.partyTarget = null; return; }
    if (key !== "ok") return;
    const row = partyRows(g)[g.partyCursor];
    const m = ms[g.partyTarget];
    if (row?.kind === "use") {
      const it = itemById(row.id);
      const amount = Math.min(maxHpOf(m) - m.hp, it.use!.heal);
      if (amount <= 0) { g.message = `${m.name} is already at full hp.`; return; }
      m.hp += amount;
      g.player.items[row.id] -= 1;
      g.message = `${m.name} recovers ${amount} hp.`;
    }
    g.partyTarget = null;
    g.partyCursor = Math.min(g.partyCursor, partyRows(g).length - 1);
    return;
  }
  const rows = partyRows(g);
  if (key === "up") g.partyCursor = (g.partyCursor + rows.length - 1) % rows.length;
  if (key === "down") g.partyCursor = (g.partyCursor + 1) % rows.length;
  if (key === "back" || key === "menu") { g.screen = "map"; g.message = ""; return; }
  if (key !== "ok") return;
  const row = rows[g.partyCursor];
  if (row.kind === "use") {
    g.partyTarget = ms.reduce((best, m, i) => (m.hp / maxHpOf(m) < ms[best].hp / maxHpOf(ms[best]) ? i : best), 0);
    return;
  }
  // cycle the slot: empty, then each spare piece in id order, then empty again
  const m = ms[row.member];
  const cur = m[row.slot];
  const spare = spareGear(g, row.slot);
  const next = cur ? spare.find((id) => id > cur) ?? "" : spare[0] ?? "";
  if (next === cur) { g.message = "No spare gear for that slot."; return; }
  equip(g, m, row.slot, next);
  g.message = next ? `${m.name} equips ${itemById(next).name}.` : `${m.name} takes off ${itemById(cur).name}.`;
}

// ---- battle ------------------------------------------------------------

function startBattle(g: Game, enemyIds: string[], boss: boolean): void {
  const ms = members(g);
  const party: PartyMember[] = ms.map((m) => ({
    id: m.id, unit: toUnit(m), skills: m.skills,
    weapon: m.weapon, armor: m.armor, trinket: m.trinket,
    items: g.player.items,
  }));
  g.battle = new Battle(party, enemyIds, CHAPTER_BY_NUMBER[g.chapter].enemyLevel, {
    rngSeed: hashStr(`battle:${g.runSeed}:${g.chapter}:${g.map?.floor}:${g.battles}:${g.retries}`),
    currency: g.chapter <= 3 ? "thread" : "flux",
    boss,
    pool: 10 + 5 * g.chapter,
  });
  g.bossFight = boss;
  g.menu = { actor: 0, stage: "skill", cursor: 0, pending: null, log: [g.battle.events[0]], notes: [] };
  firstActor(g);
  g.screen = "battle";
}

function firstActor(g: Game): void {
  const b = g.battle!;
  g.menu.actor = b.party.findIndex((u) => u.alive);
  g.menu.stage = "skill";
  g.menu.cursor = 0;
  g.menu.pending = null;
}

export function consumables(g: Game): string[] {
  return Object.keys(g.player.items).filter((id) => (g.player.items[id] ?? 0) > 0 && itemById(id).kind === "consumable");
}

export function battleOptions(g: Game): MenuOption[] {
  const b = g.battle!;
  const m = g.menu;
  if (m.stage === "skill") {
    const actor = members(g)[m.actor];
    const opts = actor.skills.map((id) => {
      const s = getSkill(id);
      return { label: s.cost ? `${s.name} (${s.cost})` : s.name, detail: s.desc, enabled: s.cost <= b.pool(m.actor) };
    });
    opts.push({ label: "Guard", detail: "Brace. Damage taken is halved until this character acts again.", enabled: true });
    opts.push({ label: "Item", detail: "Use something from the bag.", enabled: consumables(g).length > 0 });
    return opts;
  }
  if (m.stage === "item") {
    return consumables(g).map((id) => {
      const it = itemById(id);
      return { label: `${it.name} x${g.player.items[id]}`, detail: it.desc, enabled: true };
    });
  }
  if (m.stage === "enemy") {
    return b.enemyUnits.map((e) => ({ label: e.name, detail: `${e.hp}/${e.maxHp} hp`, enabled: e.alive }));
  }
  if (m.stage === "ally") {
    return b.party.map((u) => ({ label: u.name, detail: `${u.hp}/${u.maxHp} hp`, enabled: u.alive }));
  }
  return [{ label: "Continue", detail: "", enabled: true }];
}

function moveCursor(g: Game, dir: number): void {
  const opts = battleOptions(g);
  if (!opts.some((o) => o.enabled)) return;
  let c = g.menu.cursor;
  do c = (c + dir + opts.length) % opts.length; while (!opts[c].enabled);
  g.menu.cursor = c;
}

function firstEnabled(g: Game): void {
  g.menu.cursor = Math.max(0, battleOptions(g).findIndex((o) => o.enabled));
}

function battleInput(g: Game, key: Key): void {
  const b = g.battle!;
  const m = g.menu;
  if (m.stage === "result") {
    if (key === "ok") resolveBattle(g);
    return;
  }
  if (key === "up") return moveCursor(g, -1);
  if (key === "down") return moveCursor(g, 1);
  if (key === "back") {
    if (m.stage !== "skill") { m.stage = "skill"; m.pending = null; m.cursor = 0; }
    return;
  }
  if (key !== "ok") return;
  const opts = battleOptions(g);
  if (!opts[m.cursor]?.enabled) return;

  if (m.stage === "skill") {
    const actor = members(g)[m.actor];
    if (m.cursor === actor.skills.length) {
      b.command(m.actor, { kind: "guard" });
      nextActor(g);
      return;
    }
    if (m.cursor === actor.skills.length + 1) { m.stage = "item"; m.cursor = 0; return; }
    const skill = getSkill(actor.skills[m.cursor]);
    m.pending = { kind: "skill", skill };
    if (skill.target === "enemy") {
      const alive = b.enemyUnits.filter((e) => e.alive);
      if (alive.length === 1) m.pending.enemyIndex = b.enemyUnits.indexOf(alive[0]);
      else { m.stage = "enemy"; firstEnabled(g); return; }
    } else if (skill.target === "ally") {
      m.stage = "ally"; m.cursor = m.actor; return;
    }
  } else if (m.stage === "item") {
    m.pending = { kind: "item", itemId: consumables(g)[m.cursor] };
    m.stage = "ally"; m.cursor = m.actor; return;
  } else if (m.stage === "enemy") {
    m.pending!.enemyIndex = m.cursor;
  } else if (m.stage === "ally") {
    m.pending!.allyIndex = m.cursor;
  }
  b.command(m.actor, m.pending);
  nextActor(g);
}

function nextActor(g: Game): void {
  const b = g.battle!;
  const m = g.menu;
  const next = b.party.findIndex((u, i) => i > m.actor && u.alive);
  if (next >= 0) {
    m.actor = next;
    m.stage = "skill";
    m.cursor = 0;
    m.pending = null;
    return;
  }
  m.log = b.runRound();
  if (b.done) {
    m.stage = "result";
    m.cursor = 0;
    m.notes = b.result === "win" ? collectRewards(g) : [];
  } else {
    firstActor(g);
  }
}

function collectRewards(g: Game): string[] {
  const b = g.battle!;
  const r = b.rewards!;
  const notes = [`+${r.xp} xp, +${r.credits} credits.`];
  g.credits += r.credits;
  members(g).forEach((m, i) => {
    m.hp = Math.max(1, b.party[i].hp);
    m.xp += r.xp;
    while (m.xp >= xpForLevel(m.level)) {
      m.xp -= xpForLevel(m.level);
      m.level++;
      const before = m.stats.hp;
      grow(m.stats, m.cls);
      m.hp += m.stats.hp - before;
      notes.push(`${m.name} reaches level ${m.level}.`);
    }
  });
  return notes;
}

function resolveBattle(g: Game): void {
  const b = g.battle!;
  g.battles++;
  g.battle = null;
  if (b.result === "lose") {
    const data = g.store.load();
    if (data) g.store.save({ ...data, retries: (data.retries ?? 0) + 1 });
    g.screen = "gameover";
    return;
  }
  g.wins++;
  if (!g.bossFight) {
    g.screen = "map";
    g.store.save(toSave(g));
    return;
  }
  const map = g.map!;
  const def = map.def;
  if (map.floor + 1 < def.floors) {
    g.map = createMap(def, map.floor + 1);
    healAll(g);
    g.store.save(toSave(g));
    g.screen = "map";
    g.message = `Floor ${map.floor + 2}. The party rests and recovers.`;
  } else {
    playDialogue(g, [def.outro], "advance");
  }
}

// ---- input -------------------------------------------------------------

export function input(g: Game, key: Key): void {
  switch (g.screen) {
    case "title": {
      const data = g.store.load();
      if (key === "new" || (key === "ok" && !data)) startNewRun(g);
      else if (key === "ok" && data) continueRun(g, data);
      break;
    }
    case "chapter":
      if (key === "ok") playDialogue(g, g.dialogue.queue, "map");
      break;
    case "dialogue": dialogueInput(g, key); break;
    case "map": mapInput(g, key); break;
    case "party": partyInput(g, key); break;
    case "shop": shopInput(g, key); break;
    case "battle": battleInput(g, key); break;
    case "gameover":
    case "ending":
      if (key === "ok") g.screen = "title";
      break;
  }
}
