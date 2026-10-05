import { Screen, W, H } from "../engine/screen";
import { Input } from "../engine/input";
import { Audio, type Mood } from "../engine/audio";
import { SceneStack, deferred } from "../engine/scene";
import { DialogueScene, ChoiceScene, FadeScene, type Portrait } from "../engine/dialogue";
import { getSprite } from "../engine/sprites";
import { PALETTE, type ColorName } from "../engine/palette";
import { FieldScene, type FieldHost } from "./world/field";
import type { MapDef, Facing } from "./world/map";
import { BattleScene, type BattleHost } from "./battle/scene";
import { createBattle, untieAll } from "./battle/core";
import type { BattleState } from "./types";
import { MenuScene, type MenuHost } from "./ui/menu";
import { TitleScene } from "./ui/title";
import { SplashScene } from "./ui/splash";
import { CardScene, KnotScene, ShopScene, CampScene, knotLetterPng } from "./ui/cards";
import { Meta } from "./meta";
import {
  type GameState, newGame, save, load, AUTO_KEY, SAVE_KEY, grantXp, addItem, partyInputs, join, leave, maxHpOf, loadMeta, saveMeta, decodeSave, poolOf, averageLevel, skillsOf, DIFFICULTY_MULT,
} from "./state";
import { HookScene, KnotTieScene, SwingScene, PluckScene } from "./ui/minigames";
import { MEMBERS } from "./data/members";
import { GROUP_BY_ID, ENEMIES } from "./data/enemies";
import { ITEMS } from "./data/items";
import { SKILLS } from "./data/skills";
import { KNOT_MESSAGES } from "./knots";
import { CHAPTERS } from "./story/index";
import type { Chapter, ScriptContext, SayOpts, CampTalk } from "./story/types";

/** Portraits and name colors for anyone who speaks. */
const SPEAKERS: Record<string, { name: string; sprite: { kind: "humanoid" | "creature" | "knot" | "thing" | "wind"; seed: string; variant?: string; a: ColorName; b: ColorName }; color: ColorName }> = {};
for (const m of Object.values(MEMBERS)) SPEAKERS[m.id] = { name: m.name, sprite: m.sprite as never, color: m.color };

/** Thrown out of a script after a lost story fight, so the script stops where the game over began. */
class ScriptAbort extends Error {}

export class Game implements FieldHost, BattleHost, MenuHost {
  g: GameState = newGame();
  readonly screen: Screen;
  readonly input: Input;
  readonly audio = new Audio();
  readonly scenes = new SceneStack();
  readonly meta: Meta;
  field: FieldScene | null = null;
  private maps: Record<string, MapDef> = {};
  private chapter: Chapter = CHAPTERS[0];
  private last = 0;
  private inBattle: BattleState | null = null;
  private goal = "";
  private running = false;
  private chapterDone: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.screen = new Screen(canvas);
    this.input = new Input(canvas, () => this.screen.scale);
    this.meta = new Meta(canvas);
    for (const ch of CHAPTERS) for (const m of ch.maps) this.maps[m.id] = m;
    this.input.onAny = () => { this.audio.unlock(); };
    window.addEventListener("keydown", (e) => { if (e.code === "KeyM" && !this.input.captureText) { this.g.options.music = !this.g.options.music; this.audio.setMuted(!this.g.options.music); } });
    (window as unknown as { plumb: unknown }).plumb = this.debugApi();
    const raf = (t: number) => { this.frame(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // Browsers throttle animation frames in hidden tabs and panes. A timer keeps the game ticking.
    setInterval(() => {
      if (performance.now() - this.last > 60) this.frame(performance.now());
    }, 20);
  }

  // -------------------------------------------------------------------------
  // Frame loop

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.last) / 1000 || 0.016);
    this.last = t;
    this.input.poll(dt);
    this.scenes.update(dt, this.input);
    if (this.running && !this.inBattle) this.g.playtime += dt;
    this.scenes.draw(this.screen);
    // The Hand, player two, drawn over everything
    if (this.g.options.twoPlayer && this.input.pointer.over) {
      const p = this.input.pointer;
      const cells = getSprite("hand", "hand", this.input.pointer.down ? "pinch" : "");
      const c = 0xff8a7a60;
      this.screen.vline(p.x + 3, 0, Math.max(0, p.y - 1), c);
      this.screen.sprite(cells, p.x, p.y, "frost", "white");
    }
    document.body.classList.toggle("oneplayer", !this.g.options.twoPlayer);
    this.screen.present();
    // Lines above the canvas
    if (this.field && this.scenes.has(this.field) && !this.inBattle) {
      this.meta.lineXs = this.field.heldLineXs();
      if (this.field) this.field.dimmed = this.scenes.top !== this.field;
    } else if (this.inBattle) {
      this.meta.lineXs = [];
    } else this.meta.lineXs = [];
    this.meta.drawLines(dt, this.screen.scale);
    if (this.inBattle) {
      const p = this.inBattle.combatants.filter((c) => c.side === "party");
      this.meta.faviconBar(p.reduce((a, c) => a + c.hp, 0) / Math.max(1, p.reduce((a, c) => a + c.maxHp, 0)));
    } else this.meta.faviconHero();
    this.input.endFrame();
  }

  // -------------------------------------------------------------------------
  // Title and starting

  async start(): Promise<void> {
    const meta = loadMeta();
    meta.visits++;
    saveMeta(meta);
    const hash = location.hash.match(/#ch(\d)/);
    if (hash) {
      const n = Number(hash[1]);
      if (n >= 1 && n <= CHAPTERS.length) {
        await this.debugChapter(n);
        return;
      }
    }
    if (!location.hash.includes("nosplash")) {
      const splash = new SplashScene(this.audio);
      this.scenes.replace(splash);
      await splash.promise;
    }
    await this.title();
  }

  async title(): Promise<void> {
    this.running = false;
    this.inBattle = null;
    this.field = null;
    this.meta.resetLines();
    this.meta.setTitle("Plumb");
    this.audio.play("title", "plumb");
    const title = new TitleScene(this.audio, this.input);
    this.scenes.replace(title);
    const choice = await title.promise;
    if (choice.kind === "new") {
      await this.newGame();
    } else if (choice.kind === "continue") {
      const g = load(SAVE_KEY) ?? load(AUTO_KEY);
      if (g) await this.continueGame(g);
      else await this.newGame();
    } else if (choice.kind === "code") {
      const g = decodeSave(choice.code);
      if (g) await this.continueGame(g);
      else { await this.say("That code did not untie into anything."); await this.title(); }
    } else if (choice.kind === "password") {
      const word = choice.word.toUpperCase().replace(/\s+/g, " ").trim();
      if (word === KNOT_MESSAGES.password) {
        const m = loadMeta();
        if (!m.endings.includes("bait")) m.endings.push("bait");
        saveMeta(m);
        await this.baitEnding();
      } else if (word === KNOT_MESSAGES.secret_burl) {
        const m = loadMeta();
        m.burlMemory = true;
        saveMeta(m);
        await this.burlMemory();
      } else if (word === KNOT_MESSAGES.secret_title) {
        await this.say("The hill agrees with you. Everything is bait for something. The trick is knowing what you are bait for, and whether it is hungry.");
      } else if (word === KNOT_MESSAGES.secret_grip) {
        await this.say("Nobody is fishing. The rods are in holders. Somebody walked away a very long time ago and the boat kept the habit. You have read the deck. Good.");
      } else {
        await this.say("The knots do not say that.");
      }
      await this.title();
    } else if (choice.kind === "chapter") {
      await this.debugChapter(choice.n);
    }
  }

  private async burlMemory(): Promise<void> {
    this.audio.play("sad", "burl-memory");
    await this.card("Burl's memory", "What a knot remembers", { beat: "a secret" });
    await this.say("Three of us were bitten out of Hem, one a year, three years running, a long time before the ledgers. We were reeled. We were hung. The hooks were old even then and they tore, and we fell, with the hooks still in, and the lines wound round us as we fell.", { who: "burl" });
    await this.say("We landed on a roof in Hem as a tangle. Three hooks. One knot. We did not know we were a thing until a child plucked us in the square and we rang.", { who: "burl" });
    await this.say("She said: you sound like three. Her name was Marrow. She leaned. When she was bitten we rolled after the Lift for a mile. Knots cannot climb. We waited.", { who: "burl" });
    await this.say("Then her child's line came down out of the sky and lay in the square, and we were there. That is all a knot is. Something that was there, with hooks in it, that did not come loose.", { who: "burl" });
    await this.fadeOut();
    await this.fadeIn();
  }

  /** The secret third ending: what is above the deck. */
  private async baitEnding(): Promise<void> {
    this.audio.play("loft", "bait");
    await this.card("Bait", "What the file could not write", { beat: "a secret" });
    await this.say("Pull up. Past the chair, past the rods, past the grass on the deck. The boat is small from here. It is a boat on a black sea with no far side, and the sea is full of boats, each one with a Drop hanging under it on four cables, each one humming.");
    await this.say("Something very large is above the boats. It has a line down to each of them. The line to this one goes into the hold, where the catch hangs, and the catch is the bait, and the boat is the bait, and the thing above is waiting for a bite.");
    await this.say("It has been waiting nine hundred years. It is patient. It is, itself, on a line.");
    await this.say("Everything is bait for something.", { speaker: "Plumb" });
    await this.fadeOut();
    await this.fadeIn();
  }

  async newGame(): Promise<void> {
    this.g = newGame();
    this.running = true;
    this.audio.stop();
    await this.beginChapter(1);
  }

  async continueGame(g: GameState): Promise<void> {
    this.g = g;
    this.running = true;
    this.audio.setMuted(!g.options.music);
    this.chapter = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, g.chapter - 1))];
    this.goal = this.chapter.goal(this.g);
    await this.enterMap(g.map, g.x, g.y, g.facing, true);
    void this.runChapterLoop();
  }

  async debugChapter(n: number): Promise<void> {
    const ch = CHAPTERS[n - 1];
    this.g = newGame();
    this.g.chapter = n;
    const ds = ch.debugStart;
    this.g.members.fathom.level = ds.level;
    this.g.members.fathom.hp = maxHpOf(this.g.members.fathom);
    for (const id of Object.keys(MEMBERS)) {
      const m = MEMBERS[id];
      if (m.joinChapter < n && id !== "fathom") join(this.g, id, ds.level);
    }
    // The three most recent recruits ride along
    const others = this.g.roster.filter((id) => id !== "fathom");
    this.g.active = ["fathom", ...others.slice(-3)];
    this.g.flags.slack = n > 1 || !!ds.flags?.slack;
    for (const [k, v] of Object.entries(ds.flags ?? {})) this.g.flags[k] = v;
    this.g.slugs = 40 + n * 60;
    this.g.inventory = { flatbread: 4, underbread: n >= 3 ? 3 : 0, leaddrop: 1, slattea: n >= 4 ? 1 : 0 };
    if (n >= 2) for (const id of this.g.roster) {
      const m = this.g.members[id];
      m.gear.glove = n >= 5 ? "g_courier" : "g_hemp";
      m.gear.line = MEMBERS[id].held ? (n >= 5 ? "w_ballast" : "w_sinker") : (n >= 5 ? "s_iron" : "s_grip");
    }
    if (n >= 7) for (const p of [["fathom", "burl"], ["fathom", "dulcet"], ["dulcet", "lissom"], ["lissom", "gust"], ["gust", "hale"], ["hale", "sump"], ["sump", "bob"], ["bob", "fathom"], ["marrow", "fathom"]] as [string, string][]) this.g.bonds.push(p);
    this.g.poolBonus = Math.min(8, (n - 1) * 1);
    this.running = true;
    await this.beginChapter(n);
  }

  private async beginChapter(n: number): Promise<void> {
    this.chapter = CHAPTERS[n - 1];
    this.g.chapter = n;
    this.g.beat = 0;
    this.g.cleared = {};
    this.goal = this.chapter.goal(this.g);
    this.meta.setTitle(`Plumb: ${this.chapter.title}`);
    try {
      await this.chapter.start(this.ctx);
      await this.field?.checkEnterTriggers();
    } catch (e) {
      if (e instanceof ScriptAbort) return;
      throw e;
    }
    void this.runChapterLoop();
  }

  /** Waits for the chapter to end, then begins the next or the ending. */
  private async runChapterLoop(): Promise<void> {
    const d = deferred<void>();
    this.chapterDone = d.resolve;
    await d.promise;
    this.chapterDone = null;
    const n = this.g.chapter + 1;
    if (n <= CHAPTERS.length) await this.beginChapter(n);
    else await this.title();
  }

  // -------------------------------------------------------------------------
  // Maps

  private async enterMap(id: string, x: number, y: number, facing: Facing = "down", instant = false): Promise<void> {
    const def = this.maps[id];
    if (!def) throw new Error(`no map ${id}`);
    if (!instant) await this.fadeOut();
    if (this.field) this.scenes.remove(this.field);
    this.field = new FieldScene(this, def, x, y, facing);
    this.g.map = id;
    this.g.x = x;
    this.g.y = y;
    this.g.facing = facing;
    // Put the field at the bottom of the stack, under any dialogue the script has open
    const top = this.scenes.top;
    this.scenes.replace(this.field);
    if (top && top !== this.field && !(top instanceof FieldScene) && !(top instanceof TitleScene) && !(top instanceof CardScene)) this.scenes.push(top);
    this.audio.play(def.music, def.musicSeed ?? def.id);
    if (def.caption) this.field.showToast(def.caption);
    save(this.g, AUTO_KEY);
    if (!instant) await this.fadeIn();
  }

  async changeMap(to: string, x: number, y: number, facing?: Facing): Promise<void> {
    await this.enterMap(to, x, y, facing ?? "down");
    await this.field?.checkEnterTriggers();
  }

  has(flag: string): boolean {
    const v = this.g.flags[flag];
    return v !== undefined && v !== false && v !== 0 && v !== "";
  }

  goalText(): string {
    return this.goal || this.chapter.goal(this.g);
  }

  onStep(): void {
    this.g.steps++;
    if (this.field) {
      const p = this.field.playerPos();
      this.g.x = p.x;
      this.g.y = p.y;
      this.g.facing = p.facing;
    }
  }

  twoPlayer(): boolean {
    return this.g.options.twoPlayer;
  }

  followers(): string[] {
    if (!this.field) return [];
    if (this.field.def.slackOnly) return this.g.active.filter((id) => id !== "fathom" && !MEMBERS[id].held);
    return this.g.active.filter((id) => id !== "fathom");
  }

  isSlack(): boolean {
    return this.has("slack");
  }

  hurry(): boolean {
    return this.input.held("run");
  }

  tips(): boolean {
    return this.g.options.tips;
  }

  theme(): string {
    return this.field?.def.theme ?? "hem";
  }

  async openChest(id: string, item: string, count: number, slugs: number): Promise<void> {
    this.g.opened.push(id);
    this.audio.sfx("item");
    if (slugs > 0) { this.g.slugs += slugs; await this.say(`Found ${slugs} slugs.`); }
    if (item) {
      addItem(this.g, item, count);
      await this.say(`Found ${ITEMS[item].name}${count > 1 ? ` x${count}` : ""}.`);
    }
  }

  // -------------------------------------------------------------------------
  // Scripts

  async runScript(id: string): Promise<void> {
    if (id === "__save") {
      const i = await this.choose(["Save", "Rest", "Nothing"], { cancel: true, title: "A still spot." });
      if (i === 0) { if (save(this.g)) { this.audio.sfx("save"); await this.say("Saved. The line holds here."); } else await this.say("Could not save here."); }
      // A rest on the ground heals half. A bed heals all.
      if (i === 1) { for (const m of this.g.roster) { const mem = this.g.members[m]; mem.hp = Math.min(maxHpOf(mem), mem.hp + Math.round(maxHpOf(mem) / 2)); } this.g.cleared = {}; this.audio.sfx("heal"); await this.say("Everyone sits. Lines go a little slack. Half better. A bed would do the rest."); }
      return;
    }
    if (id.startsWith("__text:")) { await this.say(id.slice(7)); return; }
    // Scripts from other chapters are allowed for shared maps
    const fn = this.chapter.scripts[id] ?? CHAPTERS.find((ch) => ch.scripts[id])?.scripts[id];
    if (!fn) return;
    try {
      await fn(this.ctx);
    } catch (e) {
      if (e instanceof ScriptAbort) return;
      throw e;
    }
    this.goal = this.chapter.goal(this.g);
  }

  async encounter(groupId: string, instant: boolean): Promise<void> {
    if (instant) {
      const g = GROUP_BY_ID[groupId];
      let xp = 0, slugs = 0;
      for (const e of g.enemies) { const d = ENEMIES[e]; xp += 10 * d.level + 10; slugs += d.slugs ?? Math.round(3 + d.level * 1.5); }
      this.g.slugs += slugs;
      const ups = grantXp(this.g, xp);
      this.audio.sfx("win");
      this.g.battles++;
      this.field?.showToast(`They scatter. ${xp} xp, ${slugs} slugs.`);
      for (const u of ups) await this.say(`${MEMBERS[u.id].name} is now level ${u.to}.${u.learned.length ? ` Learned ${u.learned.map((s) => SKILLS[s].name).join(", ")}.` : ""}`);
      return;
    }
    const r = await this.battle(groupId, {});
    if (r === "lose") await this.gameOver();
  }

  async battle(groupId: string, opts: { canFlee?: boolean; loseAllowed?: boolean; music?: string }): Promise<"win" | "lose" | "flee"> {
    const group = GROUP_BY_ID[groupId];
    if (!group) throw new Error(`no group ${groupId}`);
    const state = createBattle({
      chapter: this.g.chapter,
      party: partyInputs(this.g).map((p) => ({ ...p })),
      group,
      seed: (this.g.seed + this.g.battles * 7919 + this.g.steps) >>> 0,
      bonds: this.g.bonds,
      canFlee: opts.canFlee ?? !group.boss,
      items: this.g.inventory,
      difficulty: DIFFICULTY_MULT[this.g.options.difficulty ?? "plumb"],
    });
    // Fathom's story length bonus
    for (const c of state.combatants) if (c.economy === "length" && c.side === "party") { c.maxPool = poolOf(this.g, this.g.members.fathom); c.pool = c.maxPool; }
    this.inBattle = state;
    const prevMood = this.field?.def.music ?? "town";
    const prevSeed = this.field?.def.musicSeed ?? this.field?.def.id ?? "x";
    this.audio.play(group.boss ? "boss" : "battle", opts.music ?? groupId);
    this.meta.flashTitle(group.boss ? `Plumb: ${state.bossName}` : "Plumb: a fight");
    const scene = new BattleScene(this, state);
    this.scenes.push(scene);
    const out = await scene.promise;
    this.scenes.remove(scene);
    this.inBattle = null;
    untieAll(state);
    // Sync HP
    for (const c of state.combatants) {
      if (c.side !== "party") continue;
      const m = this.g.members[c.defId];
      if (!m) continue;
      m.hp = c.alive ? c.hp : out.outcome === "lose" ? 0 : Math.max(1, Math.round(c.maxHp * 0.1));
    }
    this.g.battles++;
    if (out.outcome !== "lose" || opts.loseAllowed) this.audio.play(prevMood as Mood, prevSeed);
    if (out.outcome === "lose" && !opts.loseAllowed) return "lose";
    if (out.outcome === "lose") for (const id of this.g.active) this.g.members[id].hp = Math.max(1, this.g.members[id].hp);
    return out.outcome;
  }

  onWin(s: BattleState): string[] {
    const dead = s.combatants.filter((c) => c.side === "enemy" && !c.alive && !c.taken);
    const taken = s.combatants.filter((c) => c.side === "enemy" && c.taken);
    // A foe Taken Up by the Loft is worth half
    const xp = dead.reduce((a, c) => a + c.xp, 0) + Math.round(taken.reduce((a, c) => a + c.xp, 0) / 2);
    const slugs = dead.reduce((a, c) => a + c.slugs, 0) + Math.round(taken.reduce((a, c) => a + c.slugs, 0) / 2);
    this.g.slugs += slugs;
    const lines = [`Won. ${xp} xp, ${slugs} slugs.`];
    if (taken.length) lines.push(`${taken.length} Taken Up: half reward from them.`);
    const rng = Math.random;
    for (const c of dead) {
      if (!c.drop) continue;
      if (c.boss || rng() < 0.35) {
        addItem(this.g, c.drop, 1);
        lines.push(`${c.name} dropped ${ITEMS[c.drop].name}.`);
      }
    }
    if (s.hand.uses > 0) lines.push(`The Hand helped ${s.hand.uses} times.`);
    // Sync HP before leveling so level heals apply to the battle result
    for (const c of s.combatants) if (c.side === "party" && this.g.members[c.defId]) this.g.members[c.defId].hp = c.alive ? c.hp : 0;
    const ups = grantXp(this.g, xp);
    for (const u of ups) {
      lines.push(`${MEMBERS[u.id].name}: level ${u.to}.`);
      for (const sk of u.learned) lines.push(`  learned ${SKILLS[sk].name}`);
      if (ups.length) this.audio.sfx("level");
    }
    return lines;
  }

  private async gameOver(): Promise<void> {
    this.audio.stop();
    const i = await this.choose(["Back to the last save", "Title"], { title: "Everyone is down." });
    if (i === 0) {
      const a = load(SAVE_KEY), b = load(AUTO_KEY);
      const g = a && b ? (b.playtime > a.playtime ? b : a) : a ?? b;
      if (g) { for (const id of g.roster) g.members[id].hp = Math.max(1, g.members[id].hp); await this.continueGame(g); return; }
    }
    await this.title();
  }

  async openMenu(): Promise<void> {
    const m = new MenuScene(this);
    this.scenes.push(m);
    await m.promise;
    this.scenes.remove(m);
    this.field?.refresh();
  }

  chapterTitle(): string {
    return `Ch. ${this.g.chapter}: ${this.chapter.title}`;
  }
  beats(): string[] {
    return this.chapter.beats;
  }
  save(): boolean {
    if (this.field) { const p = this.field.playerPos(); this.g.x = p.x; this.g.y = p.y; }
    return save(this.g);
  }
  setMuted(m: boolean): void {
    this.audio.setMuted(m);
  }
  toTitle(): void {
    void this.title();
  }

  // -------------------------------------------------------------------------
  // Dialogue helpers

  /** A speaker: a party member, or a person on the current map. */
  private speaker(who?: string): { name: string; sprite: { kind: string; seed: string; variant?: string; a: ColorName; b: ColorName }; color: ColorName } | undefined {
    if (!who) return undefined;
    if (SPEAKERS[who]) return SPEAKERS[who];
    const npc = this.field?.def.npcs.find((n) => n.id === who) ?? Object.values(this.maps).flatMap((m) => m.npcs).find((n) => n.id === who);
    if (npc) return { name: npc.name ?? who, sprite: npc.sprite, color: "bone" };
    return undefined;
  }

  private portraitFor(who?: string): Portrait | undefined {
    const sp = this.speaker(who);
    if (!sp) return undefined;
    return { cells: getSprite(sp.sprite.kind as never, sp.sprite.seed, sp.sprite.variant ?? ""), a: sp.sprite.a, b: sp.sprite.b };
  }

  async say(text: string, opts: SayOpts = {}): Promise<void> {
    const sp = this.speaker(opts.who);
    const scene = new DialogueScene(text, { speaker: opts.speaker ?? sp?.name, portrait: this.portraitFor(opts.who), color: sp?.color ?? "gold", top: opts.top, auto: opts.auto, speed: this.g.options.textSpeed }, this.audio, () => this.hurry());
    this.scenes.push(scene);
    await scene.promise;
    this.scenes.remove(scene);
  }

  async choose(items: string[], opts: { cancel?: boolean; title?: string } = {}): Promise<number> {
    const scene = new ChoiceScene(items, opts, this.audio);
    this.scenes.push(scene);
    const i = await scene.promise;
    this.scenes.remove(scene);
    return i;
  }

  async fadeOut(): Promise<void> {
    const f = new FadeScene("out");
    this.scenes.push(f);
    await f.promise;
    this.scenes.remove(f);
    this.screen.clear();
  }

  async fadeIn(): Promise<void> {
    const f = new FadeScene("in");
    this.scenes.push(f);
    await f.promise;
    this.scenes.remove(f);
  }

  async card(title: string, subtitle = "", opts: { beat?: string } = {}): Promise<void> {
    const c = new CardScene(title, subtitle, opts.beat, this.audio);
    this.scenes.push(c);
    await c.promise;
    this.scenes.remove(c);
  }

  // -------------------------------------------------------------------------
  // The script context

  readonly ctx: ScriptContext = {
    get g() { return game.g; },
    say: (text, opts) => this.say(text, opts),
    speak: (who, text) => this.say(text, { who, speaker: this.speaker(who)?.name ?? who }),
    hand: (text) => this.say(text, { speaker: "the Hand", top: true }),
    choose: (items, opts) => this.choose(items, opts),
    battle: async (groupId, opts) => {
      const r = await this.battle(groupId, opts ?? {});
      // A lost story fight ends the run here; the rest of the script must not run
      if (r === "lose" && !opts?.loseAllowed) { await this.gameOver(); throw new ScriptAbort(); }
      return r;
    },
    give: async (item, n = 1) => { addItem(this.g, item, n); this.audio.sfx("item"); await this.say(`Got ${ITEMS[item].name}${n > 1 ? ` x${n}` : ""}.`); },
    giveSlugs: async (n) => { this.g.slugs += n; this.audio.sfx("slug"); await this.say(`Got ${n} slugs.`); },
    flag: (key, value = true) => { this.g.flags[key] = value; this.goal = this.chapter.goal(this.g); this.field?.refresh(); },
    has: (key) => this.has(key),
    get: (key) => this.g.flags[key],
    join: async (id) => {
      const before = [...this.g.active];
      join(this.g, id, Math.max(1, this.g.members.fathom.level));
      // Recruits arrive with plain gear so nobody joins naked
      const m = this.g.members[id];
      const def = MEMBERS[id];
      if (!m.gear.glove) m.gear.glove = this.g.chapter >= 5 ? "g_courier" : "g_hemp";
      if (!m.gear.line) m.gear.line = def.held ? (this.g.chapter >= 5 ? "w_ballast" : "w_sinker") : (this.g.chapter >= 5 ? "s_iron" : "s_grip");
      this.audio.sfx("level");
      await this.card(`${def.name} joins`, def.title);
      const benched = before.find((b) => !this.g.active.includes(b));
      if (benched) await this.say(`${MEMBERS[benched].name} steps back to make room. Swap positions from the Party menu.`);
      this.field?.refresh();
    },
    leave: (id) => { leave(this.g, id); this.field?.refresh(); },
    teleport: async (map, x, y, facing) => { await this.enterMap(map, x, y, facing); await this.field?.checkEnterTriggers(); },
    walk: async (who, steps, opts) => { if (this.field) await this.field.walk(who, steps, opts?.run); },
    face: (who, facing) => this.field?.face(who, facing),
    moveNpc: (id, x, y) => this.field?.moveNpc(id, x, y),
    wait: (sec) => new Promise((r) => setTimeout(r, sec * 1000 / (this.hurry() ? 3 : 1))),
    fadeOut: () => this.fadeOut(),
    fadeIn: () => this.fadeIn(),
    shake: async () => { this.field?.shake(); this.audio.sfx("hit2"); await new Promise((r) => setTimeout(r, 400)); },
    flash: async () => { this.field?.flash(); this.audio.sfx("snap"); await new Promise((r) => setTimeout(r, 250)); },
    music: (mood, seed) => this.audio.play(mood, seed ?? mood),
    stopMusic: () => this.audio.fadeOut(),
    sfx: (name) => {
      // "note:C" plucks a named note, "sour:C" plucks it a little flat.
      if (name.startsWith("note:")) this.audio.playNote(name.slice(5) as never, 0, 0.5);
      else if (name.startsWith("sour:")) this.audio.pluck(this.audio.noteFreq(name.slice(5) as never) * 0.955, 0.9, 0.5, 0, undefined, 0.7);
      else this.audio.sfx(name);
    },
    card: (title, subtitle, opts) => this.card(title, subtitle, opts),
    beat: (n) => { this.g.beat = n; this.goal = this.chapter.goal(this.g); },
    knot: async (id, text, reader = "Fathom") => {
      const k = new KnotScene(text, reader, this.audio);
      this.scenes.push(k);
      await k.promise;
      this.scenes.remove(k);
      if (!this.g.knotsRead.includes(id)) this.g.knotsRead.push(id);
    },
    rest: () => { for (const m of this.g.roster) this.g.members[m].hp = maxHpOf(this.g.members[m]); this.g.cleared = {}; this.audio.sfx("heal"); },
    shop: async (items, keeper = "Shop") => {
      const sh = new ShopScene(this.g, items, keeper, this.audio);
      this.scenes.push(sh);
      await sh.promise;
      this.scenes.remove(sh);
    },
    camp: async (talks: CampTalk[]) => {
      this.audio.play("sad", `camp${this.g.chapter}`);
      for (;;) {
        const c = new CampScene(this.g, talks, this.audio);
        this.scenes.push(c);
        const t = await c.promise;
        this.scenes.remove(c);
        if (!t) break;
        for (const [who, line] of t.lines) await this.say(line, { who, speaker: MEMBERS[who]?.name ?? who });
        talks = talks.filter((x) => x !== t);
        if (!talks.length) break;
      }
      for (const m of this.g.roster) this.g.members[m].hp = maxHpOf(this.g.members[m]);
      this.g.cleared = {};
      if (this.field) this.audio.play(this.field.def.music, this.field.def.musicSeed ?? this.field.def.id);
    },
    setGoal: (text) => { this.goal = text; },
    poolBonus: async (n) => { this.g.poolBonus += n; this.audio.sfx("knot"); await this.say(`Fathom can carry ${n} more fathom${n === 1 ? "" : "s"} of line. ${poolOf(this.g, this.g.members.fathom)} in all.`); },
    taught: (town) => { if (!this.g.taught.includes(town)) this.g.taught.push(town); },
    ending: async (id) => {
      this.g.ending = id;
      const m = loadMeta();
      if (!m.endings.includes(id)) m.endings.push(id);
      saveMeta(m);
      save(this.g);
    },
    save: () => { save(this.g, AUTO_KEY); },
    refresh: () => this.field?.refresh(),
    twoPlayer: () => this.twoPlayer(),
    inParty: (id) => this.g.roster.includes(id),
    length: () => poolOf(this.g, this.g.members.fathom),
    nextChapter: async () => {
      save(this.g, AUTO_KEY);
      this.chapterDone?.();
    },
    level: () => averageLevel(this.g),
    learnKnot: async (skillId) => {
      const m = this.g.members.fathom;
      const known = skillsOf(m, this.g.chapter);
      if (known.includes(skillId)) return;
      // Story learned knots are recorded as a flag and merged in by skillsOf via the learn table level; here we lower the level requirement
      const entry = MEMBERS.fathom.learn.find((l) => l.skill === skillId);
      if (entry) entry.level = Math.min(entry.level, m.level);
      this.audio.sfx("knot");
      await this.say(`Fathom learned the ${SKILLS[skillId].name}.`);
    },
    pageLetGo: () => this.meta.letGo(),
    tabTitle: (text) => this.meta.setTitle(text),
    pageTight: () => this.meta.tighten(),
    letter: (lines) => this.meta.download("a-line-from-plumb.png", knotLetterPng(lines)),
    minigame: async (kind, opts = {}) => {
      const scene = kind === "hook" ? new HookScene(this.audio, opts) : kind === "knot" ? new KnotTieScene(this.audio, opts.knot ?? "knot", opts) : kind === "swing" ? new SwingScene(this.audio, opts) : new PluckScene(this.audio, opts);
      this.scenes.push(scene);
      const r = await scene.promise;
      this.scenes.remove(scene);
      return r;
    },
    errand: (id) => { if (this.g.errands.includes(id)) return false; this.g.errands.push(id); return true; },
    errandDone: (id) => this.g.errands.includes(id),
    caught: () => { this.g.catches++; },
    toast: (text) => this.field?.showToast(text),
    pluck: (id, strength) => this.field?.pluckNpc(id, strength),
    fx: async (kind, x, y) => {
      const d = this.field?.fx(kind, x, y) ?? 0;
      await new Promise((r) => setTimeout(r, d * 1000 / (this.hurry() ? 3 : 1)));
    },
    take: (item, n = 1) => { addItem(this.g, item, -n); },
  };

  // -------------------------------------------------------------------------
  // Debug API in the console

  private debugApi() {
    return {
      get g() { return game.g; },
      jump: (map: string, x: number, y: number) => void this.enterMap(map, x, y),
      battle: (group: string) => void this.battle(group, {}),
      chapter: (n: number) => void this.debugChapter(n),
      give: (item: string, n = 1) => addItem(this.g, item, n),
      flag: (k: string, v: boolean | number | string = true) => { this.g.flags[k] = v; },
      slugs: (n: number) => { this.g.slugs += n; },
      level: (n: number) => { for (const id of this.g.roster) { this.g.members[id].level = n; this.g.members[id].hp = maxHpOf(this.g.members[id]); } },
      maps: () => Object.keys(this.maps),
      knots: KNOT_MESSAGES,
      screen: this.screen,
    };
  }
}

// The context getters need a stable reference to the single game.
let game: Game;
export function createGame(canvas: HTMLCanvasElement): Game {
  game = new Game(canvas);
  return game;
}

export { W, H, PALETTE };
