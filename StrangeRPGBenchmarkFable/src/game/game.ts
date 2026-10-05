import { Screen } from "../engine/screen";
import { Input } from "../engine/input";
import { SceneStack } from "../engine/scene";
import { say, type Page } from "../engine/dialogue";
import { Rng, hash } from "../engine/rng";
import { audio } from "../engine/audio";
import type { SpriteSpec } from "../engine/sprites";
import type { Dir, GameState, MechId, PartyMember } from "./types";
import { GameMap, type Entity, type MapDef } from "./world/map";
import { OverworldScene } from "./world/overworld";
import { BattleScene, type BattleResult } from "./battle/scene";
import { ENEMIES } from "./data/enemies";
import { ITEMS } from "./data/items";
import { CHARACTERS } from "./data/classes";
import { newMember, fullHeal, clampVitals } from "./party";
import { CHAPTERS, type ChapterDef, type Script } from "./story/chapters";
import { MenuScene } from "./ui/menu";
import { ShopScene } from "./ui/shop";
import { FadeScene, TitleCardScene } from "./ui/transitions";
import { MECHANIC_INFO } from "./story/mechanics";

const SAVE_KEY = "mothcrown.save";
export const SAVE_VERSION = 1;

export interface ScriptCtx {
  game: Game;
  state: GameState;
  entity?: Entity;
  say(speaker: string, text: string, portrait?: SpriteSpec | string): Promise<void>;
  narrate(text: string): Promise<void>;
  ask(text: string, choices: string[], speaker?: string): Promise<number>;
  battle(ids: string[], opts?: BattleOpts): Promise<BattleResult>;
  give(itemId: string, n?: number, silent?: boolean): Promise<void>;
  take(itemId: string, n?: number): void;
  has(itemId: string): boolean;
  gold(n: number): Promise<void>;
  flag(key: string, value?: number | boolean | string): void;
  get(key: string): number | boolean | string | undefined;
  join(charId: string): Promise<void>;
  leave(charId: string): void;
  heal(): void;
  goto(map: string, x: number, y: number, dir?: Dir): Promise<void>;
  unlock(mech: MechId): Promise<void>;
  title(text: string, sub: string): Promise<void>;
  endChapter(): Promise<void>;
  step(n: number): void;
  wait(ms: number): Promise<void>;
  banner(text: string): void;
  entityById(id: string): Entity | undefined;
  portrait(charId: string): SpriteSpec;
}

export interface BattleOpts {
  ambush?: boolean;
  boss?: boolean;
  fleeable?: boolean;
  /** Lose means game over unless this is set. */
  canLose?: boolean;
  intro?: string;
}

export class Game {
  state!: GameState;
  stack: SceneStack;
  map: GameMap | null = null;
  overworld: OverworldScene | null = null;
  rng = new Rng(Date.now());
  maps: Record<string, MapDef> = {};
  scripts: Record<string, Script> = {};

  constructor(public screen: Screen, public input: Input) {
    this.stack = new SceneStack(input);
    for (const ch of CHAPTERS) {
      for (const m of ch.maps) this.maps[m.id] = m;
      Object.assign(this.scripts, ch.scripts);
    }
  }

  fastHeld = (): boolean => this.input.held("fast");

  // ---------- State ----------

  newState(): GameState {
    return {
      version: SAVE_VERSION, chapter: 0, flags: {}, party: [newMember("pell", 1)], reserve: [], inventory: { salt_biscuit: 3 },
      gold: 20, debt: 0, mechanics: [], words: [], map: { id: "rimward", x: 10, y: 12, dir: "down" }, steps: 0, playtime: 0, battles: 0,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
  }

  hasSave(): boolean {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  save(): boolean {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); return true; } catch { return false; }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw) as GameState;
      if (s.version !== SAVE_VERSION) return false;
      this.state = s;
      return true;
    } catch { return false; }
  }

  async newGame(): Promise<void> {
    this.state = this.newState();
    this.rng = new Rng(this.state.seed);
    await this.startChapter(1);
  }

  /** True when started from a #chN hash: never autosaves over a real save, and a game over restarts the chapter. */
  debugMode = false;

  /** Starts a fresh game at a chapter with a party that fits it. Used by the #chN URL hash for progress checks. */
  async debugStart(n: number): Promise<void> {
    this.debugMode = true;
    const roster = ["pell", "oxbow", "vane", "mim", "quill", "fold", "uhtred", "dust", "choir"];
    const joined = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const mechs: MechId[] = ["brace", "tempo", "links", "memories", "rows", "debt", "rewind", "fusion", "words"];
    const level = Math.max(1, 1 + (n - 1) * 3);
    this.state = this.newState();
    this.rng = new Rng(this.state.seed);
    const members = roster.filter((_, i) => joined[i] < n).map((id) => newMember(id, level));
    this.state.party = members.slice(0, 4);
    this.state.reserve = members.slice(4);
    this.state.mechanics = mechs.slice(0, Math.max(0, n - 1));
    this.state.inventory = { salt_biscuit: 4, brine: 4, lamp_wick: 3, antidote: 2, moth_dust: 1, tonic: 1 };
    this.state.gold = 60 + n * 60;
    if (n >= 5) this.state.inventory.mem_rat = 1, this.state.inventory.mem_hare = 1, this.state.inventory.mem_golem = 1;
    if (n >= 9) this.state.words = ["w_burn", "w_foe", "w_quiet"];
    for (let i = 1; i < n; i++) this.state.flags[`ch${i}.done`] = true;
    await this.startChapter(n);
  }

  async continueGame(): Promise<void> {
    this.rng = new Rng(this.state.seed ^ (this.state.steps * 7919));
    this.stack.clear();
    await this.loadMap(this.state.map.id);
    this.overworld = new OverworldScene(this);
    this.stack.push(this.overworld);
    this.overworld.showBanner(this.map!.def.name);
  }

  // ---------- Chapters ----------

  chapter(): ChapterDef {
    return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, this.state.chapter - 1))];
  }

  async startChapter(n: number): Promise<void> {
    const ch = CHAPTERS[n - 1];
    if (!ch) { await this.credits(); return; }
    this.state.chapter = n;
    this.state.flags[`ch${n}.step`] = 1;
    const st = ch.start;
    this.state.map = { id: st.map, x: st.x, y: st.y, dir: st.dir ?? "down" };
    this.stack.clear();
    await this.loadMap(st.map);
    this.overworld = new OverworldScene(this);
    this.stack.push(this.overworld);
    await this.titleCard(`Chapter ${n}`, ch.title);
    if (!this.debugMode) this.save();
    await ch.intro(this.ctx());
  }

  async credits(): Promise<void> {
    const c = this.ctx();
    audio.music("credits", 11);
    await c.title("The Moth Crown", "and the Small Sun");
    await c.narrate("You carried the Ember home in your hands. It fit. Rimward has a sun now, small and close, and the moths come to it every evening to remember.");
    await c.narrate(`Steps: ${this.state.steps}. Battles: ${this.state.battles}. Debt: ${this.state.debt}.`);
    await c.narrate("Thank you for playing.");
    this.stack.clear();
    const { TitleScene } = await import("./ui/title");
    this.stack.push(new TitleScene(this));
  }

  // ---------- Maps ----------

  async loadMap(id: string): Promise<void> {
    const def = this.maps[id];
    if (!def) throw new Error(`unknown map ${id}`);
    this.map = new GameMap(def, this.state.seed ^ def.id.length);
    this.playMapMusic();
  }

  /** Towns and hubs get a calm theme, anywhere with random encounters gets a dungeon theme. Each map has its own tune. */
  playMapMusic(): void {
    const def = this.map?.def;
    if (!def) return;
    audio.music(def.encounters ? "dungeon" : "town", hash(def.id));
  }

  async gotoMap(id: string, x: number, y: number, dir: Dir = "down", atEntity?: string): Promise<void> {
    await this.fade(true);
    await this.loadMap(id);
    if (atEntity) {
      const e = this.map!.entities.find((en) => en.id === atEntity);
      if (e) { x = e.x; y = e.y + 1; if (this.map!.solidAt(x, y, this.state.flags)) { y = e.y - 1; } if (this.map!.solidAt(x, y, this.state.flags)) { x = e.x + 1; y = e.y; } }
    }
    this.state.map = { id, x, y, dir };
    if (this.overworld) this.overworld.resetTrail();
    await this.fade(false);
    this.overworld?.showBanner(this.map!.def.name);
    const enter = this.scripts[`${id}.enter`];
    if (enter) await enter(this.ctx());
  }

  fade(out: boolean): Promise<void> {
    return new Promise((resolve) => this.stack.push(new FadeScene(this.stack, out, resolve)));
  }

  titleCard(text: string, sub: string): Promise<void> {
    return new Promise((resolve) => this.stack.push(new TitleCardScene(this.stack, text, sub, resolve)));
  }

  // ---------- Dialogue ----------

  say(pages: Page[]): Promise<number> {
    return say(this.stack, this.fastHeld, pages);
  }

  portrait(charId: string): SpriteSpec {
    return CHARACTERS[charId]?.sprite ?? { kind: "creature", seed: charId, a: "gray", b: "white" };
  }

  // ---------- Scripts ----------

  async runScript(key: string, entity?: Entity): Promise<void> {
    // A later chapter can override an earlier chapter's script by suffixing the chapter number.
    const s = this.scripts[`${key}.ch${this.state.chapter}`] ?? this.scripts[key];
    if (!s) { await this.say([{ text: `(missing script ${key})` }]); return; }
    await s(this.ctx(entity));
  }

  ctx(entity?: Entity): ScriptCtx {
    const g = this;
    const ctx: ScriptCtx = {
      game: g,
      state: g.state,
      entity,
      portrait: (id) => g.portrait(id),
      async say(speaker, text, portrait) {
        const p = typeof portrait === "string" ? g.portrait(portrait) : portrait ?? (CHARACTERS[speaker.toLowerCase()] ? g.portrait(speaker.toLowerCase()) : undefined);
        await g.say([{ speaker, text, portrait: p }]);
      },
      async narrate(text) { await g.say([{ text, color: "salt" }]); },
      async ask(text, choices, speaker) { return g.say([{ speaker, text, choices }]); },
      battle: (ids, opts) => g.battle(ids, opts),
      async give(itemId, n = 1, silent = false) {
        g.state.inventory[itemId] = (g.state.inventory[itemId] ?? 0) + n;
        if (!silent) await g.say([{ text: `Got ${ITEMS[itemId].name}${n > 1 ? ` x${n}` : ""}.`, color: "yellow" }]);
      },
      take(itemId, n = 1) {
        g.state.inventory[itemId] = Math.max(0, (g.state.inventory[itemId] ?? 0) - n);
        if (g.state.inventory[itemId] === 0) delete g.state.inventory[itemId];
      },
      has: (itemId) => (g.state.inventory[itemId] ?? 0) > 0,
      async gold(n) { g.state.gold += n; await g.say([{ text: n >= 0 ? `Got ${n} salt.` : `Paid ${-n} salt.`, color: "yellow" }]); },
      flag(key, value = true) { g.state.flags[key] = value; },
      get: (key) => g.state.flags[key],
      async join(charId) {
        if (g.state.party.some((m) => m.charId === charId) || g.state.reserve.some((m) => m.charId === charId)) return;
        const lead = g.state.party[0];
        const m = newMember(charId, Math.max(1, lead.level - 1));
        if (g.state.party.length < 4) g.state.party.push(m); else g.state.reserve.push(m);
        const c = CHARACTERS[charId];
        await g.say([{ speaker: c.name, text: c.joinLine, portrait: c.sprite }, { text: `${c.name} joins the party.`, color: "yellow" }]);
        g.overworld?.resetTrail();
      },
      leave(charId) {
        const i = g.state.party.findIndex((m) => m.charId === charId);
        if (i > 0) g.state.reserve.push(g.state.party.splice(i, 1)[0]);
        g.overworld?.resetTrail();
      },
      heal() { for (const m of [...g.state.party, ...g.state.reserve]) fullHeal(m); },
      goto: (map, x, y, dir) => g.gotoMap(map, x, y, dir),
      async unlock(mech) {
        if (!g.state.mechanics.includes(mech)) g.state.mechanics.push(mech);
        const info = MECHANIC_INFO[mech];
        await g.titleCard("New mechanic", info.name);
        await g.say([{ speaker: info.name, text: info.desc, color: "white" }]);
      },
      title: (text, sub) => g.titleCard(text, sub),
      async endChapter() {
        g.state.flags[`ch${g.state.chapter}.done`] = true;
        await g.fade(true);
        await g.startChapter(g.state.chapter + 1);
        await g.fade(false);
      },
      step(n) { g.state.flags[`ch${g.state.chapter}.step`] = n; },
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      banner: (text) => g.overworld?.showBanner(text),
      entityById: (id) => g.map?.entities.find((e) => e.id === id),
    };
    return ctx;
  }

  // ---------- Battles ----------

  async battle(ids: string[], opts: BattleOpts = {}): Promise<BattleResult> {
    const defs = ids.map((id) => { const e = ENEMIES[id]; if (!e) throw new Error(`unknown enemy ${id}`); return e; });
    this.state.battles++;
    const result = await new Promise<BattleResult>((resolve) => {
      this.stack.push(new BattleScene(this, defs, opts, resolve));
    });
    for (const m of this.state.party) clampVitals(m);
    if (result === "lose" && !opts.canLose) {
      await this.gameOver();
    }
    return result;
  }

  async gameOver(): Promise<void> {
    audio.music("none");
    audio.sfx("death");
    await this.say([{ text: "The light goes out.", color: "red" }]);
    await this.fade(true);
    // Return to the last save, or restart the chapter if there is none.
    if (this.debugMode) {
      await this.debugStart(this.state.chapter);
    } else if (this.load()) {
      await this.continueGame();
    } else {
      await this.newGame();
    }
    await this.fade(false);
  }

  // ---------- Entities ----------

  async openChest(e: Entity): Promise<void> {
    const key = `chest.${this.map!.def.id}.${e.id}`;
    if (this.state.flags[key]) { await this.say([{ text: "Empty." }]); return; }
    this.state.flags[key] = true;
    audio.sfx("chest");
    const c = this.ctx(e);
    if (e.gold) await c.gold(e.gold);
    for (const it of e.items ?? []) await c.give(it);
    if (e.script) await this.runScript(e.script, e);
  }

  async useLamp(e: Entity): Promise<void> {
    const i = await this.say([{ text: "A Lamp. Its light is thin but warm. Rest here?", choices: ["Rest and save", "Just rest", "Leave"] }]);
    if (i === 2) return;
    for (const m of [...this.state.party, ...this.state.reserve]) fullHeal(m);
    if (i === 0) {
      const ok = this.save();
      await this.say([{ text: ok ? "The party rests. The lamp remembers you." : "The party rests. Saving failed (storage blocked)." }]);
    } else await this.say([{ text: "The party rests." }]);
  }

  async openShop(e: Entity): Promise<void> {
    await new Promise<void>((resolve) => this.stack.push(new ShopScene(this, e.stock ?? [], e.name ?? "Shop", resolve)));
  }

  openMenu(): void {
    this.stack.push(new MenuScene(this));
  }

  addItem(id: string, n = 1): void {
    this.state.inventory[id] = (this.state.inventory[id] ?? 0) + n;
  }

  removeItem(id: string, n = 1): void {
    this.state.inventory[id] = Math.max(0, (this.state.inventory[id] ?? 0) - n);
    if (this.state.inventory[id] === 0) delete this.state.inventory[id];
  }

  membersAll(): PartyMember[] {
    return [...this.state.party, ...this.state.reserve];
  }
}
