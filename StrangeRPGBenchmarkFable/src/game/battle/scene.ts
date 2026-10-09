import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import { getSprite } from "../../engine/sprites";
import type { ColorName } from "../../engine/palette";
import { wrap, textWidth, LINE_H } from "../../engine/font";
import { audio, type Sfx } from "../../engine/audio";
import type { Game, BattleOpts } from "../game";
import type { EnemyDef, StatusId, TargetKind } from "../types";
import { SKILLS } from "../data/skills";
import { ITEMS, WORDS } from "../data/items";
import { STATUSES } from "../data/statuses";
import { CHARACTERS } from "../data/classes";
import { gainXp } from "../party";
import {
  createBattle, RANDOM_FIGHT_REWARD, nextActor, performAction, enemyAction, usableSkills, canPay, validTargets, needsTarget, forecast, rewards, active, has, wordSpell,
  type BattleState, type Combatant, type BattleEvent, type Action,
} from "./core";

export type BattleResult = "win" | "lose" | "flee";

type Menu = "main" | "skill" | "item" | "target" | "words";

interface Floater { uid: number; text: string; color: ColorName; t: number }

/** Seconds a floater stays up. The next one on the same combatant waits until this one ends. */
const FLOAT_LIFE = 0.8;

const MAIN_ORDER = ["attack", "skill", "item", "guard", "swaprow", "delay", "borrow", "rewind", "fuse", "cast", "flee"];
const MAIN_LABEL: Record<string, string> = { attack: "Attack", skill: "Skill", item: "Item", guard: "Guard", swaprow: "Row", delay: "Delay", borrow: "Borrow", rewind: "Rewind", fuse: "Fuse", cast: "Cast", flee: "Flee" };

// Screen layout, top to bottom. Each band keeps text 1 px clear of the next band.
const TOP_BAR_H = 10;
const ENEMY_BACK_Y = 12;
const ENEMY_Y = 26;
const PARTY_Y = 71;
const PARTY_BACK_Y = 78;
const STRIP_Y = 88;
const ROWS_Y = 99;
const ROWS_PITCH = 9;
const BOX_Y = 136;
const BOX_H = 56;
/** Skill, item and word lists open a taller panel from here, over the party rows. */
const PANEL_Y = 98;
const TEXT_X = 4;
/** Columns of text that fit between TEXT_X and the right border. */
const BOX_COLS = 31;
const MSG_LINES = 5;
const MAIN_ROWS = 3;
const MAIN_COL_W = 46;
const LIST_ROWS = 5;
const WORD_ROWS = 4;
const ROW_H = 10;

export class BattleScene implements Scene {
  overlay = false;
  state: BattleState;
  private t = 0;
  private menu: Menu = "main";
  private mainItems: string[] = [];
  private mainCursor = 0;
  private skillCursor = 0;
  private itemCursor = 0;
  private targetCursor = 0;
  private wordCursor: [number, number, number] = [0, 0, 0];
  private wordCol = 0;
  private targets: Combatant[] = [];
  private pending: { skillId?: string; itemId?: string; words?: [string, string, string]; target: TargetKind } | null = null;
  private actor: Combatant | null = null;
  private choosing: ((a: Action) => void) | null = null;
  private messages: string[] = [];
  private floaters: Floater[] = [];
  private flashes = new Map<number, number>();
  private dying = new Map<number, number>();
  private shake = 0;
  private waiting: { resolve: () => void; until: number } | null = null;
  private linkFlash: { name: string; t: number } | null = null;
  private done = false;
  private started = false;
  private lastMain = 0;

  constructor(private game: Game, private defs: EnemyDef[], private opts: BattleOpts, private resolve: (r: BattleResult) => void) {
    const st = game.state;
    this.state = createBattle({
      party: st.party, enemies: defs, mechanics: st.mechanics, seed: game.rng.int(0, 0x7fffffff),
      inventory: st.inventory, gold: st.gold, debt: st.debt, words: st.words, fleeable: opts.fleeable,
    });
  }

  enter(): void {
    if (!this.started) {
      this.started = true;
      audio.music(this.defs.some((d) => d.boss) ? "boss" : "battle", this.game.chapter().n * 13 + (this.defs.some((d) => d.boss) ? 1 : 0));
      void this.run();
    }
  }

  // ---------- Async battle loop ----------

  private wait(ms: number): Promise<void> {
    const fast = this.game.fastHeld();
    return new Promise((resolve) => { this.waiting = { resolve, until: this.t + (fast ? ms / 5 : ms) / 1000 }; });
  }

  private async run(): Promise<void> {
    const s = this.state;
    const names = this.defs.map((d) => d.name);
    this.say(this.opts.intro ?? (names.length === 1 ? `${names[0]} appears.` : `${[...new Set(names)].join(", ")} appear.`));
    await this.wait(600);
    for (const ev of s.log) if (ev.type === "line") await this.game.say([{ speaker: ev.speaker, text: ev.text }], BOX_Y);
    s.log = [];
    while (!s.over && !this.done) {
      const actor = nextActor(s);
      this.actor = actor;
      s.round++;
      let action: Action;
      if (actor.side === "enemy") {
        await this.wait(250);
        action = enemyAction(s, actor);
      } else {
        action = await this.choose(actor);
      }
      const ev = performAction(s, action);
      await this.play(ev);
      // Sync inventory and gold to the game state as they change.
      this.game.state.inventory = s.inventory;
      this.game.state.gold = s.gold;
      this.game.state.debt = s.debt;
    }
    if (this.done) return;
    this.actor = null;
    if (s.over === "win") { audio.music("victory", 3); await this.victory(); }
    else if (s.over === "lose") { audio.music("none"); this.say("The party falls."); await this.wait(900); }
    else { audio.sfx("flee"); this.say("Got away."); await this.wait(500); }
    this.syncParty();
    this.game.stack.pop();
    if (s.over !== "lose") this.game.playMapMusic();
    this.resolve(s.over!);
  }

  private syncParty(): void {
    for (const c of this.state.combatants) {
      if (c.side !== "party" || !c.member) continue;
      c.member.hp = Math.max(0, c.hp);
      c.member.st = c.st;
      if (c.member.hp === 0) c.member.hp = 1;
    }
    // Everyone gets at least 1 HP after any battle so the overworld never has a dead leader.
  }

  private async victory(): Promise<void> {
    const s = this.state;
    const r = rewards(s, this.opts.ambush ? RANDOM_FIGHT_REWARD : 1);
    this.say(`Won. ${r.xp} XP, ${r.gold} salt.`);
    this.game.state.gold += r.gold;
    s.gold = this.game.state.gold;
    await this.wait(700);
    for (const it of r.items) { this.game.addItem(it); this.say(`Found ${ITEMS[it].name}.`); await this.wait(500); }
    for (const m of r.memories) { this.game.addItem(m); this.say(`A Memory drifts loose: ${ITEMS[m].name}.`); await this.wait(600); }
    const alivers = s.combatants.filter((c) => c.side === "party" && c.member && !(c.fuseTurns < 0));
    const share = r.xp;
    for (const c of alivers) {
      if (!c.member) continue;
      const lv = gainXp(c.member, c.hp > 0 ? share : Math.round(share / 2));
      if (lv) {
        audio.sfx("levelup");
        this.say(`${c.name} is now level ${lv.to}.`);
        await this.wait(600);
        for (const sk of lv.newSkills) { this.say(`${c.name} learned ${SKILLS[sk].name}.`); await this.wait(600); }
      }
    }
    // Reserve members get half.
    for (const m of this.game.state.reserve) gainXp(m, Math.round(share / 2));
    await this.wait(300);
  }

  private choose(actor: Combatant): Promise<Action> {
    this.menu = "main";
    this.mainItems = this.buildMain(actor);
    this.mainCursor = Math.min(this.lastMain, this.mainItems.length - 1);
    this.pending = null;
    this.say(`${actor.name}'s turn.`);
    return new Promise((resolve) => { this.choosing = resolve; });
  }

  private buildMain(actor: Combatant): string[] {
    const s = this.state;
    const usable = usableSkills(s, actor);
    const out: string[] = [];
    for (const id of MAIN_ORDER) {
      if (id === "attack" || id === "guard") out.push(id);
      else if (id === "skill") { if (usable.some((u) => !MAIN_ORDER.includes(u))) out.push(id); }
      else if (id === "item") { if (Object.keys(s.inventory).some((k) => (s.inventory[k] ?? 0) > 0 && ITEMS[k]?.use && !ITEMS[k].use!.fieldOnly)) out.push(id); }
      else if (id === "cast") { if (s.mechanics.has("words") && s.words.length >= 3) out.push(id); }
      else if (id === "flee") { if (s.fleeable) out.push(id); }
      else if (usable.includes(id)) out.push(id);
    }
    return out;
  }

  private commit(action: Action): void {
    const r = this.choosing;
    this.choosing = null;
    this.menu = "main";
    this.pending = null;
    r?.(action);
  }

  // ---------- Event playback ----------

  private say(text: string): void {
    for (const line of wrap(text, BOX_COLS)) this.messages.push(line);
    while (this.messages.length > MSG_LINES) this.messages.shift();
  }

  /** Queues a floater. One on the same combatant waits until the one before it has moved clear. */
  private float(uid: number, text: string, color: ColorName): void {
    const party = this.state.combatants.find((x) => x.uid === uid)?.side === "party";
    const mine = this.floaters.filter((f) => f.uid === uid);
    const t = mine.length ? Math.min(...mine.map((f) => f.t)) - (party ? FLOAT_LIFE : 0.65) : 0;
    this.floaters.push({ uid, text, color, t: Math.min(0, t) });
  }

  private name(uid: number): string {
    return this.state.combatants.find((c) => c.uid === uid)?.name ?? "?";
  }

  private sound(ev: BattleEvent): void {
    const map: Partial<Record<BattleEvent["type"], Sfx>> = {
      heal: "heal", miss: "miss", status: "status", death: "death", revive: "heal", link: "link", tempo: "status",
      debt: "coin", rewind: "rewind", fuse: "fuse", gold: "coin", row: "cursor", st: "heal",
    };
    if (ev.type === "damage") audio.sfx(ev.amount < 0 ? "heal" : ev.crit || ev.weak ? "crit" : "hit");
    else if (ev.type === "act" && ev.skillId?.startsWith("word:")) audio.sfx("word");
    else if (ev.type === "status" && !ev.on) return;
    else if (ev.type === "heal" && ev.amount <= 0) return;
    else { const s = map[ev.type]; if (s) audio.sfx(s); }
  }

  private async play(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      this.sound(ev);
      switch (ev.type) {
        case "act": {
          const who = this.name(ev.actor);
          this.say(ev.name === "Attack" ? `${who} attacks.` : ev.name.startsWith("is ") ? `${who} ${ev.name}.` : `${who}: ${ev.name}`);
          await this.wait(ev.name === "Attack" ? 260 : 420);
          break;
        }
        case "damage": {
          const c = this.state.combatants.find((x) => x.uid === ev.target)!;
          if (ev.amount < 0) { this.float(ev.target, `+${-ev.amount}`, "green"); this.say(`${c.name} absorbs it.`); }
          else {
            this.flashes.set(ev.target, 0.12);
            this.float(ev.target, `${ev.amount}`, ev.crit ? "yellow" : ev.weak ? "orange" : ev.resist ? "gray" : "white");
            if (ev.crit) { this.shake = 0.2; }
            if (ev.weak) this.say(`Weak! ${ev.amount} to ${c.name}.`);
            else if (ev.resist) this.say(`Resisted. ${ev.amount} to ${c.name}.`);
            else if (ev.crit) this.say(`Critical! ${ev.amount} to ${c.name}.`);
          }
          await this.wait(ev.amount < 0 ? 350 : 300);
          break;
        }
        case "heal": if (ev.amount > 0) { this.float(ev.target, `+${ev.amount}`, "green"); await this.wait(280); } break;
        case "st": if (ev.amount > 0) { this.float(ev.target, `+${ev.amount}st`, "teal"); await this.wait(220); } break;
        case "miss": this.float(ev.target, "miss", "gray"); this.say(`${this.name(ev.target)} dodges.`); await this.wait(300); break;
        case "status": {
          const d = STATUSES[ev.id];
          if (ev.id === "brace" && !ev.on) break;
          this.float(ev.target, ev.on ? d.short : `-${d.short}`, ev.on ? d.color : "gray");
          if (ev.on) this.say(`${this.name(ev.target)}: ${d.name}.`);
          await this.wait(ev.on ? 320 : 120);
          break;
        }
        case "death": this.dying.set(ev.target, 0.5); this.say(`${this.name(ev.target)} falls.`); await this.wait(450); break;
        case "revive": this.dying.delete(ev.target); this.say(`${this.name(ev.target)} returns.`); await this.wait(400); break;
        case "text": this.say(ev.text); await this.wait(420); break;
        case "line": await this.game.say([{ speaker: ev.speaker, text: ev.text }], BOX_Y); break;
        case "link": this.linkFlash = { name: ev.name, t: 0.9 }; this.shake = 0.25; this.say(`LINK: ${ev.name}!`); await this.wait(600); break;
        case "tempo": this.float(ev.target, ev.amount > 0 ? "later" : "early", ev.amount > 0 ? "blue" : "lime"); await this.wait(300); break;
        case "row": this.say(`${this.name(ev.target)} moves to the ${ev.row} row.`); await this.wait(300); break;
        case "debt": this.say(ev.amount > 0 ? `Debt +${ev.amount} (now ${ev.total}).` : `Debt paid ${-ev.amount} (now ${ev.total}).`); await this.wait(350); break;
        case "rewind": this.shake = 0.4; this.dying.clear(); await this.wait(500); break;
        case "fuse": this.say(ev.on ? `${this.name(ev.a)} is born.` : `${this.name(ev.a)} and ${this.name(ev.b)} split.`); this.shake = 0.3; await this.wait(600); break;
        case "flee": this.say(ev.ok ? "The party slips away." : "Can't get away."); await this.wait(400); break;
        case "gold": this.say(ev.amount > 0 ? `Took ${ev.amount} salt.` : `Lost ${-ev.amount} salt.`); await this.wait(300); break;
        case "turn": break;
      }
    }
  }

  // ---------- Update ----------

  update(dt: number): void {
    this.t += dt;
    if (this.shake > 0) this.shake -= dt;
    for (const [k, v] of this.flashes) { if (v - dt <= 0) this.flashes.delete(k); else this.flashes.set(k, v - dt); }
    for (const [k, v] of this.dying) { this.dying.set(k, Math.max(0, v - dt)); }
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < FLOAT_LIFE);
    if (this.linkFlash) { this.linkFlash.t -= dt; if (this.linkFlash.t <= 0) this.linkFlash = null; }
    if (this.waiting && this.t >= this.waiting.until) { const w = this.waiting; this.waiting = null; w.resolve(); }
  }

  // ---------- Input ----------

  key(k: Key): void {
    if (!this.choosing || !this.actor) return;
    const s = this.state;
    const actor = this.actor;
    if (k === "up" || k === "down" || k === "left" || k === "right") audio.sfx("cursor");
    else if (k === "ok") audio.sfx("confirm");
    else if (k === "cancel") audio.sfx("cancel");
    if (this.menu === "main") {
      const n = this.mainItems.length;
      const cols = Math.ceil(n / MAIN_ROWS);
      if (k === "up") this.mainCursor = (this.mainCursor + n - 1) % n;
      else if (k === "down") this.mainCursor = (this.mainCursor + 1) % n;
      else if ((k === "left" || k === "right") && cols > 1) {
        const col = (Math.floor(this.mainCursor / MAIN_ROWS) + (k === "right" ? 1 : cols - 1)) % cols;
        this.mainCursor = Math.min(n - 1, col * MAIN_ROWS + (this.mainCursor % MAIN_ROWS));
      }
      else if (k === "ok") {
        const id = this.mainItems[this.mainCursor];
        this.lastMain = this.mainCursor;
        if (id === "skill") { this.menu = "skill"; this.skillCursor = 0; }
        else if (id === "item") { this.menu = "item"; this.itemCursor = 0; }
        else if (id === "cast") { this.menu = "words"; this.wordCol = 0; }
        else if (id === "flee") this.commit({ type: "flee", actor: actor.uid });
        else this.beginSkill(id);
      }
      return;
    }
    if (this.menu === "skill") {
      const list = this.skillList(actor);
      if (list.length === 0) { this.menu = "main"; return; }
      if (k === "up") this.skillCursor = (this.skillCursor + list.length - 1) % list.length;
      else if (k === "down") this.skillCursor = (this.skillCursor + 1) % list.length;
      else if (k === "cancel") this.menu = "main";
      else if (k === "ok") {
        const id = list[this.skillCursor];
        if (!canPay(s, actor, SKILLS[id])) { this.say(has(actor, "silence") ? "Silenced." : "Not enough Static."); return; }
        this.beginSkill(id);
      }
      return;
    }
    if (this.menu === "item") {
      const list = this.itemList();
      if (list.length === 0) { this.menu = "main"; return; }
      if (k === "up") this.itemCursor = (this.itemCursor + list.length - 1) % list.length;
      else if (k === "down") this.itemCursor = (this.itemCursor + 1) % list.length;
      else if (k === "cancel") this.menu = "main";
      else if (k === "ok") {
        const id = list[this.itemCursor];
        const use = ITEMS[id].use!;
        this.pending = { itemId: id, target: use.target };
        this.beginTarget(use.target);
      }
      return;
    }
    if (this.menu === "words") {
      const cols = this.wordColumns();
      if (k === "cancel") { this.menu = "main"; return; }
      if (k === "left") this.wordCol = (this.wordCol + 2) % 3;
      else if (k === "right") this.wordCol = (this.wordCol + 1) % 3;
      else if (k === "up" || k === "down") {
        const list = cols[this.wordCol];
        if (list.length) this.wordCursor[this.wordCol] = (this.wordCursor[this.wordCol] + (k === "up" ? list.length - 1 : 1)) % list.length;
      } else if (k === "ok") {
        const words: [string, string, string] = [cols[0][this.wordCursor[0]], cols[1][this.wordCursor[1]], cols[2][this.wordCursor[2]]];
        if (words.some((w) => !w)) { this.say("Need a verb, a noun and a shape."); return; }
        const sk = wordSpell(words);
        if (!sk) { this.say("Those words do not go together."); return; }
        if (!canPay(s, actor, sk)) { this.say(`Costs ${sk.cost} Static.`); return; }
        this.pending = { words, target: sk.target };
        this.beginTarget(sk.target);
      }
      return;
    }
    if (this.menu === "target") {
      const n = this.targets.length;
      if (k === "cancel") { this.menu = this.pending?.itemId ? "item" : this.pending?.words ? "words" : this.pending?.skillId && !MAIN_ORDER.includes(this.pending.skillId) ? "skill" : "main"; return; }
      if (k === "left" || k === "up") this.targetCursor = (this.targetCursor + n - 1) % n;
      else if (k === "right" || k === "down") this.targetCursor = (this.targetCursor + 1) % n;
      else if (k === "ok") this.finishTarget(this.targets[this.targetCursor].uid);
    }
  }

  private beginSkill(id: string): void {
    const sk = SKILLS[id];
    this.pending = { skillId: id, target: sk.target };
    this.beginTarget(sk.target);
  }

  private beginTarget(kind: TargetKind): void {
    const actor = this.actor!;
    if (!needsTarget(kind)) { this.finishTarget(null); return; }
    this.targets = validTargets(this.state, actor, kind);
    if (kind === "ally" && this.pending?.skillId === "fuse") this.targets = this.targets.filter((t) => t.uid !== actor.uid);
    if (this.targets.length === 0) { this.say("No valid target."); this.menu = "main"; return; }
    this.targetCursor = 0;
    this.menu = "target";
  }

  private finishTarget(uid: number | null): void {
    const p = this.pending!;
    const actor = this.actor!;
    if (p.itemId) this.commit({ type: "item", itemId: p.itemId, actor: actor.uid, target: uid });
    else if (p.words) this.commit({ type: "word", words: p.words, actor: actor.uid, target: uid });
    else this.commit({ type: "skill", skillId: p.skillId!, actor: actor.uid, target: uid });
  }

  private skillList(actor: Combatant): string[] {
    return usableSkills(this.state, actor).filter((id) => !MAIN_ORDER.includes(id));
  }

  private itemList(): string[] {
    return Object.keys(this.state.inventory).filter((k) => (this.state.inventory[k] ?? 0) > 0 && ITEMS[k]?.use && !ITEMS[k].use!.fieldOnly);
  }

  private wordColumns(): [string[], string[], string[]] {
    const w = this.state.words;
    const by = (slot: string) => WORDS.filter((x) => x.slot === slot && w.includes(x.id)).map((x) => x.id);
    return [by("verb"), by("noun"), by("shape")];
  }

  // ---------- Drawing ----------

  private enemyPos(c: Combatant): { x: number; y: number; scale: number } {
    const foes = this.state.combatants.filter((x) => x.side === "enemy");
    const i = foes.indexOf(c);
    const n = foes.length;
    const scale = c.boss ? 4 : 3;
    const spacing = n > 3 ? 40 : 48;
    const x = Math.round(96 + (i - (n - 1) / 2) * spacing - scale * 4);
    const y = c.row === "back" && this.state.mechanics.has("rows") ? ENEMY_BACK_Y : ENEMY_Y;
    return { x, y, scale };
  }

  private partyPos(c: Combatant): { x: number; y: number } {
    const ps = this.state.combatants.filter((x) => x.side === "party" && !(x.fuseTurns < 0));
    const i = ps.indexOf(c);
    const n = ps.length;
    const x = Math.round(96 + (i - (n - 1) / 2) * 30 - 8);
    const y = c.row === "back" && this.state.mechanics.has("rows") ? PARTY_BACK_Y : PARTY_Y;
    return { x, y };
  }

  /** One status short at a time, cycling, so a busy combatant never needs more than three letters of room. */
  private statusShort(c: Combatant): StatusId | null {
    if (c.statuses.length === 0) return null;
    return c.statuses[Math.floor(this.t / 1.2) % c.statuses.length].id;
  }

  draw(s: Screen): void {
    const st = this.state;
    s.clear("black");
    if (this.shake > 0) { s.shakeX = Math.round((Math.random() - 0.5) * 4); s.shakeY = Math.round((Math.random() - 0.5) * 4); }
    // Arena floor at the feet of the front row, 1 px below the back row's status line.
    const chapter = this.game.chapter();
    const back: ColorName = ["dark", "indigo", "teal", "brown", "green", "gray", "dark", "purple", "orange"][Math.max(0, chapter.n - 1)] as ColorName;
    for (let x = 0; x < 192; x += 8) s.rect(x, ENEMY_Y + 23 + ((x / 8) % 2), 8, 1, back);
    // Top bar.
    s.text(`R${st.round}`, 2, 1, "gray");
    const mechs: string[] = [];
    if (st.mechanics.has("debt")) mechs.push(`debt ${st.debt}`);
    if (st.mechanics.has("rewind")) mechs.push(`rw ${st.rewindsLeft}`);
    if (st.mechanics.has("rows")) mechs.push("rows");
    s.textRight(mechs.join(" "), 190, 1, st.debt >= 40 ? "red" : "gray");

    const targeting = this.menu === "target" && this.choosing ? this.targets[this.targetCursor] : null;
    // Enemies.
    for (const c of st.combatants) {
      if (c.side !== "enemy") continue;
      const dying = this.dying.get(c.uid);
      if (c.hp <= 0 && (dying === undefined || dying <= 0)) continue;
      const { x, y, scale } = this.enemyPos(c);
      const bounce = this.actor === c ? Math.floor(this.t * 8) % 2 : 0;
      const tint: ColorName | undefined = this.flashes.has(c.uid) ? "white" : dying !== undefined && c.hp <= 0 ? "dark" : undefined;
      s.sprite(getSprite(c.sprite), x, y - bounce, c.sprite.a, c.sprite.b, { scale, tint });
      const w = scale * 8;
      s.bar(x, y + w + 1, w, 3, c.hp / c.max.hp, c.boss ? "purple" : "red");
      if (c.charge) s.rect(x + w - 3, y - 2, 3, 3, elementColor(c.charge));
      // The ally target arrow sits where a front row boss shows its status.
      const short = this.statusShort(c);
      if (short && targeting?.side !== "party") s.text(STATUSES[short].short, x, y + w + 5, "yellow");
    }
    // Party sprites in the arena.
    for (const c of st.combatants) {
      if (c.side !== "party" || c.fuseTurns < 0) continue;
      const { x, y } = this.partyPos(c);
      if (c.hp <= 0) { s.sprite(getSprite(c.sprite), x, y + 4, c.sprite.a, c.sprite.b, { scale: 2, tint: "dark" }); continue; }
      const bounce = this.actor === c && this.choosing ? Math.floor(this.t * 6) % 2 : 0;
      const tint: ColorName | undefined = this.flashes.has(c.uid) ? "white" : c.guarding ? "salt" : undefined;
      s.sprite(getSprite(c.sprite), x, y - bounce, c.sprite.a, c.sprite.b, { scale: 2, tint });
      // The fuse count gives way to this member's floaters, which pass over the same spot.
      if (c.fusedWith !== null && !this.floaters.some((f) => f.uid === c.uid && f.t >= 0)) s.text(`${c.fuseTurns}`, x + 17, y + 4, "pink");
    }
    // Target cursor, kept below the top bar.
    if (targeting) {
      const p = targeting.side === "enemy" ? this.enemyPos(targeting) : { ...this.partyPos(targeting), scale: 2 };
      const cur = getSprite({ kind: "shape", seed: "cursor", a: "yellow", b: "white", variant: "arrowdown" });
      s.sprite(cur, p.x + (p.scale * 8) / 2 - 4, Math.max(TOP_BAR_H, p.y - 9) + (Math.floor(this.t * 6) % 2), "yellow", "white");
    }
    // Floaters.
    for (const f of this.floaters) {
      if (f.t < 0) continue;
      const c = st.combatants.find((x) => x.uid === f.uid)!;
      const p = c.side === "enemy" ? this.enemyPos(c) : { ...this.partyPos(c), scale: 2 };
      // Party floaters rise over the sprite and stop short of the enemy status line.
      const yy = c.side === "enemy" ? Math.max(TOP_BAR_H, p.y - 2 - Math.round(f.t * 14)) : PARTY_Y + 6 - Math.round(f.t * 8);
      s.textCenter(f.text, p.x + (p.scale * 8) / 2, yy, f.color, "black");
    }
    if (this.linkFlash) {
      const w = textWidth(this.linkFlash.name) + 14;
      s.panel(96 - Math.floor(w / 2), 40, w, 14, "dark", "white");
      s.textCenter(this.linkFlash.name, 96, 43, Math.floor(this.linkFlash.t * 10) % 2 ? "yellow" : "white");
    }
    // Tempo strip.
    if (st.mechanics.has("tempo")) {
      const order = forecast(st, 10);
      s.rect(0, STRIP_Y, 192, 10, "dark");
      s.text("next", 2, STRIP_Y + 1, "gray");
      order.forEach((c, i) => {
        const x = 30 + i * 16;
        s.rect(x - 1, STRIP_Y, 10, 10, c.side === "party" ? "blue" : "red");
        s.sprite(getSprite(c.sprite), x, STRIP_Y + 1, c.sprite.a, c.sprite.b);
      });
    }
    // Party status rows: name, HP bar, HP, ST, one status, row.
    const rows = st.combatants.filter((c) => c.side === "party" && c.fuseTurns >= 0);
    rows.forEach((c, i) => {
      const y = ROWS_Y + i * ROWS_PITCH;
      const isActor = this.actor === c && !!this.choosing;
      const dead = c.hp <= 0;
      s.sprite(getSprite(c.sprite), 2, y, c.sprite.a, c.sprite.b, { tint: dead ? "dark" : undefined });
      s.text(c.name, 12, y, isActor ? "yellow" : dead ? "gray" : "white");
      s.bar(86, y + 1, 26, 6, c.hp / c.max.hp, c.hp < c.max.hp * 0.25 ? "red" : "green");
      s.textRight(`${c.hp}`, 132, y, dead ? "red" : "white");
      s.textRight(`${c.st}`, 154, y, "teal");
      const short = this.statusShort(c);
      if (short) s.text(STATUSES[short].short, 158, y, "yellow");
      if (st.mechanics.has("rows")) s.text(c.row === "back" ? "b" : "f", 182, y, "gray");
    });
    // Bottom box.
    s.panel(0, BOX_Y, 192, BOX_H, "dark", "white");
    if (this.choosing && this.actor) this.drawMenu(s);
    else {
      this.messages.forEach((m, i) => s.text(m, TEXT_X, BOX_Y + 4 + i * LINE_H, i === this.messages.length - 1 ? "white" : "gray"));
    }
    s.shakeX = 0; s.shakeY = 0;
  }

  private drawMenu(s: Screen): void {
    const st = this.state;
    const actor = this.actor!;
    const y0 = BOX_Y + 4;
    if (this.menu === "target") { this.drawTarget(s); return; }
    if (this.menu === "main") {
      this.mainItems.forEach((id, i) => {
        const x = 10 + Math.floor(i / MAIN_ROWS) * MAIN_COL_W, y = y0 + (i % MAIN_ROWS) * LINE_H;
        let label = MAIN_LABEL[id];
        if (id === "guard" && st.mechanics.has("brace")) label = "Brace";
        const sel = i === this.mainCursor;
        s.text(label, x, y, sel ? "yellow" : "white");
        if (sel) s.text(">", x - 7, y, "yellow");
      });
      const id = this.mainItems[this.mainCursor];
      const desc = id === "skill" ? "Use a skill." : id === "item" ? "Use an item." : id === "cast" ? "Build a spell from words." : id === "flee" ? "Run from the fight."
        : id === "guard" ? (st.mechanics.has("brace") ? "Halve damage this round. Your next attack deals double." : "Halve damage this round.")
        : SKILLS[id]?.desc ?? "";
      s.rect(1, BOX_Y + 31, 190, 1, "gray");
      wrap(desc, BOX_COLS).slice(0, 2).forEach((l, i) => s.text(l, TEXT_X, BOX_Y + 34 + i * LINE_H, "salt"));
      return;
    }
    // Skill, item and word lists cover the party rows with a taller panel.
    s.panel(0, PANEL_Y, 192, 192 - PANEL_Y, "dark", "white");
    s.text(actor.name, TEXT_X, PANEL_Y + 3, "yellow");
    s.textRight(`ST ${actor.st}/${actor.max.st}`, 188, PANEL_Y + 3, "teal");
    s.rect(1, PANEL_Y + 12, 190, 1, "gray");
    const ly = PANEL_Y + 15;
    let desc = "";
    if (this.menu === "skill") {
      const list = this.skillList(actor);
      const top = this.listTop(this.skillCursor, list.length);
      list.slice(top, top + LIST_ROWS).forEach((id, i) => {
        const sk = SKILLS[id];
        const y = ly + i * ROW_H;
        const ok = canPay(st, actor, sk);
        const sel = top + i === this.skillCursor;
        s.text(sk.name, 10, y, sel ? "yellow" : ok ? "white" : "gray");
        s.textRight(`${sk.cost}`, 132, y, ok ? "teal" : "gray");
        if (sk.element) s.rect(136, y + 2, 4, 4, elementColor(sk.element));
        if (sk.debt) s.text(`d${sk.debt}`, 144, y, "red");
        if (sel) s.text(">", 3, y, "yellow");
      });
      this.drawScroll(s, top, list.length);
      desc = SKILLS[list[this.skillCursor]]?.desc ?? "";
    } else if (this.menu === "item") {
      const list = this.itemList();
      const top = this.listTop(this.itemCursor, list.length);
      list.slice(top, top + LIST_ROWS).forEach((id, i) => {
        const it = ITEMS[id];
        const y = ly + i * ROW_H;
        const sel = top + i === this.itemCursor;
        s.sprite(getSprite(it.sprite), 10, y - 1, it.sprite.a, it.sprite.b);
        s.text(it.name, 20, y, sel ? "yellow" : "white");
        s.textRight(`x${st.inventory[id]}`, 150, y, "gray");
        if (sel) s.text(">", 3, y, "yellow");
      });
      this.drawScroll(s, top, list.length);
      desc = ITEMS[list[this.itemCursor]]?.desc ?? "";
    } else if (this.menu === "words") {
      const cols = this.wordColumns();
      const heads = ["verb", "noun", "shape"];
      cols.forEach((list, ci) => {
        const x = 6 + ci * 62;
        s.text(heads[ci], x + 7, ly, ci === this.wordCol ? "yellow" : "gray");
        const cur = this.wordCursor[ci];
        const top = Math.max(0, Math.min(cur - 1, list.length - WORD_ROWS));
        list.slice(top, top + WORD_ROWS).forEach((id, i) => {
          const w = WORDS.find((x) => x.id === id)!;
          const sel = top + i === cur;
          const y = ly + ROW_H + i * ROW_H;
          s.text(w.word, x + 7, y, sel ? (ci === this.wordCol ? "yellow" : "white") : "gray");
          if (sel) s.text(">", x, y, ci === this.wordCol ? "yellow" : "gray");
        });
      });
      const words: [string, string, string] = [cols[0][this.wordCursor[0]], cols[1][this.wordCursor[1]], cols[2][this.wordCursor[2]]];
      const sk = words.every(Boolean) ? wordSpell(words) : null;
      desc = sk ? `${sk.name}: ${sk.cost} st${sk.power ? `, pow ${sk.power}` : ""}${sk.heal ? `, heal ${sk.heal}` : ""}${sk.hits ? `, x${sk.hits}` : ""}` : "Pick three words that fit.";
    }
    s.rect(1, PANEL_Y + 64, 190, 1, "gray");
    wrap(desc, BOX_COLS).slice(0, 3).forEach((l, i) => s.text(l, TEXT_X, PANEL_Y + 66 + i * LINE_H, "salt"));
  }

  private listTop(cursor: number, n: number): number {
    return Math.max(0, Math.min(cursor - 2, n - LIST_ROWS));
  }

  private drawScroll(s: Screen, top: number, n: number): void {
    if (top > 0) s.text("^", 182, PANEL_Y + 15, "gray");
    if (top + LIST_ROWS < n) s.text("v", 182, PANEL_Y + 15 + (LIST_ROWS - 1) * ROW_H, "gray");
  }

  /** The action being aimed, the target, and what is known about it. */
  private drawTarget(s: Screen): void {
    const p = this.pending;
    const tgt = this.targets[this.targetCursor];
    if (!p || !tgt) return;
    const y0 = BOX_Y + 4;
    const action = p.itemId ? ITEMS[p.itemId].name : p.words ? wordSpell(p.words)?.name ?? "Spell" : SKILLS[p.skillId!]?.name ?? "";
    s.text(action, TEXT_X, y0, "white");
    s.text(`> ${tgt.name}`, TEXT_X, y0 + LINE_H, "yellow");
    const info = tgt.side === "enemy"
      ? (tgt.revealed ? `weak: ${tgt.weak.join(", ") || "none"}` : "weak: unknown")
      : `HP ${tgt.hp}/${tgt.max.hp}  ST ${tgt.st}/${tgt.max.st}`;
    s.text(info, TEXT_X, y0 + LINE_H * 2, "salt");
    if (tgt.statuses.length === 0) return;
    s.rect(1, BOX_Y + 31, 190, 1, "gray");
    const names = tgt.statuses.map((x) => STATUSES[x.id].name).join(", ");
    const lines = wrap(names, BOX_COLS);
    const shown = lines.length <= 2 ? lines : wrap(tgt.statuses.map((x) => STATUSES[x.id].short).join(" "), BOX_COLS);
    shown.slice(0, 2).forEach((l, i) => s.text(l, TEXT_X, BOX_Y + 34 + i * LINE_H, "yellow"));
  }
}

export function elementColor(e: string): ColorName {
  return ({ heat: "orange", cold: "teal", volt: "yellow", rot: "purple", light: "white", null: "gray" } as Record<string, ColorName>)[e] ?? "gray";
}
