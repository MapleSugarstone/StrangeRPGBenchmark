import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import { getSprite } from "../../engine/sprites";
import type { ColorName } from "../../engine/palette";
import { BOX_Y } from "../../engine/dialogue";
import { wrap } from "../../engine/font";
import { audio, type Sfx } from "../../engine/audio";
import type { Game, BattleOpts } from "../game";
import type { EnemyDef, StatusId, TargetKind } from "../types";
import { SKILLS } from "../data/skills";
import { ITEMS, WORDS } from "../data/items";
import { STATUSES } from "../data/statuses";
import { CHARACTERS } from "../data/classes";
import { gainXp } from "../party";
import {
  createBattle, nextActor, performAction, enemyAction, usableSkills, canPay, validTargets, needsTarget, forecast, rewards, active, has, wordSpell,
  type BattleState, type Combatant, type BattleEvent, type Action,
} from "./core";

export type BattleResult = "win" | "lose" | "flee";

type Menu = "main" | "skill" | "item" | "target" | "words";

interface Floater { uid: number; text: string; color: ColorName; t: number }

const MAIN_ORDER = ["attack", "skill", "item", "guard", "swaprow", "delay", "borrow", "rewind", "fuse", "cast", "flee"];
const MAIN_LABEL: Record<string, string> = { attack: "Attack", skill: "Skill", item: "Item", guard: "Guard", swaprow: "Row", delay: "Delay", borrow: "Borrow", rewind: "Rewind", fuse: "Fuse", cast: "Cast", flee: "Flee" };

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
    for (const ev of s.log) if (ev.type === "line") await this.game.say([{ speaker: ev.speaker, text: ev.text }]);
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
    const r = rewards(s);
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
    for (const line of wrap(text, 45)) this.messages.push(line);
    while (this.messages.length > 3) this.messages.shift();
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
          if (ev.amount < 0) { this.floaters.push({ uid: ev.target, text: `+${-ev.amount}`, color: "green", t: 0 }); this.say(`${c.name} absorbs it.`); }
          else {
            this.flashes.set(ev.target, 0.12);
            this.floaters.push({ uid: ev.target, text: `${ev.amount}`, color: ev.crit ? "yellow" : ev.weak ? "orange" : ev.resist ? "gray" : "white", t: 0 });
            if (ev.crit) { this.shake = 0.2; }
            if (ev.weak) this.say(`Weak! ${ev.amount} to ${c.name}.`);
            else if (ev.resist) this.say(`Resisted. ${ev.amount} to ${c.name}.`);
            else if (ev.crit) this.say(`Critical! ${ev.amount} to ${c.name}.`);
          }
          await this.wait(ev.amount < 0 ? 350 : 300);
          break;
        }
        case "heal": if (ev.amount > 0) { this.floaters.push({ uid: ev.target, text: `+${ev.amount}`, color: "green", t: 0 }); await this.wait(280); } break;
        case "st": if (ev.amount > 0) { this.floaters.push({ uid: ev.target, text: `+${ev.amount}st`, color: "teal", t: 0 }); await this.wait(220); } break;
        case "miss": this.floaters.push({ uid: ev.target, text: "miss", color: "gray", t: 0 }); this.say(`${this.name(ev.target)} dodges.`); await this.wait(300); break;
        case "status": {
          const d = STATUSES[ev.id];
          if (ev.id === "brace" && !ev.on) break;
          this.floaters.push({ uid: ev.target, text: ev.on ? d.short : `-${d.short}`, color: ev.on ? d.color : "gray", t: 0 });
          if (ev.on) this.say(`${this.name(ev.target)}: ${d.name}.`);
          await this.wait(ev.on ? 320 : 120);
          break;
        }
        case "death": this.dying.set(ev.target, 0.5); this.say(`${this.name(ev.target)} falls.`); await this.wait(450); break;
        case "revive": this.dying.delete(ev.target); this.say(`${this.name(ev.target)} returns.`); await this.wait(400); break;
        case "text": this.say(ev.text); await this.wait(420); break;
        case "line": await this.game.say([{ speaker: ev.speaker, text: ev.text }]); break;
        case "link": this.linkFlash = { name: ev.name, t: 0.9 }; this.shake = 0.25; this.say(`LINK: ${ev.name}!`); await this.wait(600); break;
        case "tempo": this.floaters.push({ uid: ev.target, text: ev.amount > 0 ? "later" : "sooner", color: ev.amount > 0 ? "blue" : "lime", t: 0 }); await this.wait(300); break;
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
    this.floaters = this.floaters.filter((f) => f.t < 0.8);
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
      const cols = Math.ceil(n / 6);
      if (k === "up") this.mainCursor = (this.mainCursor + n - 1) % n;
      else if (k === "down") this.mainCursor = (this.mainCursor + 1) % n;
      else if ((k === "left" || k === "right") && cols > 1) this.mainCursor = (this.mainCursor + 6) % n < n ? (this.mainCursor + 6) % n : this.mainCursor;
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
    const y = c.row === "back" && this.state.mechanics.has("rows") ? 14 : 30;
    return { x, y, scale };
  }

  private partyPos(c: Combatant): { x: number; y: number } {
    const ps = this.state.combatants.filter((x) => x.side === "party" && !(x.fuseTurns < 0));
    const i = ps.indexOf(c);
    const n = ps.length;
    const x = Math.round(96 + (i - (n - 1) / 2) * 30 - 8);
    const y = c.row === "back" && this.state.mechanics.has("rows") ? 76 : 68;
    return { x, y };
  }

  draw(s: Screen): void {
    const st = this.state;
    s.clear("black");
    if (this.shake > 0) { s.shakeX = Math.round((Math.random() - 0.5) * 4); s.shakeY = Math.round((Math.random() - 0.5) * 4); }
    // Arena backdrop.
    const chapter = this.game.chapter();
    const back: ColorName = ["dark", "indigo", "teal", "brown", "green", "gray", "dark", "purple", "orange"][Math.max(0, chapter.n - 1)] as ColorName;
    s.rect(0, 8, 192, 56, "black");
    for (let x = 0; x < 192; x += 8) s.rect(x, 62 + ((x / 8) % 2), 8, 1, back);
    // Top bar.
    s.text(`R${st.round}`, 2, 1, "gray");
    const mechs: string[] = [];
    if (st.mechanics.has("debt")) mechs.push(`debt ${st.debt}`);
    if (st.mechanics.has("rewind")) mechs.push(`rw ${st.rewindsLeft}`);
    if (st.mechanics.has("rows")) mechs.push("rows");
    s.textRight(mechs.join(" "), 190, 1, st.debt >= 40 ? "red" : "gray");
    if (this.linkFlash) s.textCenter(this.linkFlash.name, 96, 1, Math.floor(this.linkFlash.t * 10) % 2 ? "yellow" : "white");

    // Enemies.
    for (const c of st.combatants) {
      if (c.side !== "enemy") continue;
      const dying = this.dying.get(c.uid);
      if (c.hp <= 0 && (dying === undefined || dying <= 0)) continue;
      const { x, y, scale } = this.enemyPos(c);
      const bounce = this.actor === c ? Math.floor(this.t * 8) % 2 : 0;
      const tint: ColorName | undefined = this.flashes.has(c.uid) ? "white" : dying !== undefined && c.hp <= 0 ? "dark" : undefined;
      s.sprite(getSprite(c.sprite), x, y - bounce, c.sprite.a, c.sprite.b, { scale, tint });
      // HP bar.
      const w = scale * 8;
      s.bar(x, y + w + 1, w, 3, c.hp / c.max.hp, c.boss ? "purple" : "red");
      if (c.charge) s.rect(x + w - 3, y - 2, 3, 3, elementColor(c.charge));
      // Status shorts.
      const shorts = c.statuses.slice(0, 2).map((x) => STATUSES[x.id].short);
      if (shorts.length) s.text(shorts.join(" "), x, y + w + 5, "yellow");
    }
    // Party sprites in the arena.
    for (const c of st.combatants) {
      if (c.side !== "party" || c.fuseTurns < 0) continue;
      const { x, y } = this.partyPos(c);
      if (c.hp <= 0) { s.sprite(getSprite(c.sprite), x, y + 4, c.sprite.a, c.sprite.b, { scale: 2, tint: "dark" }); continue; }
      const bounce = this.actor === c && this.choosing ? Math.floor(this.t * 6) % 2 : 0;
      const tint: ColorName | undefined = this.flashes.has(c.uid) ? "white" : c.guarding ? "salt" : undefined;
      s.sprite(getSprite(c.sprite), x, y - bounce, c.sprite.a, c.sprite.b, { scale: 2, tint });
      if (c.fusedWith !== null) s.text(`${c.fuseTurns}`, x + 14, y - 4, "pink");
    }
    // Target cursor.
    if (this.menu === "target" && this.choosing) {
      const tgt = this.targets[this.targetCursor];
      const p = tgt.side === "enemy" ? this.enemyPos(tgt) : { ...this.partyPos(tgt), scale: 2 };
      const cur = getSprite({ kind: "shape", seed: "cursor", a: "yellow", b: "white", variant: "arrowdown" });
      s.sprite(cur, p.x + (p.scale * 8) / 2 - 4, p.y - 9 + (Math.floor(this.t * 6) % 2), "yellow", "white");
      s.panel(0, BOX_Y - 11, 192, 11, "dark", "white");
      const tag = tgt.side === "enemy" ? (tgt.revealed ? ` weak:${tgt.weak.join("/") || "none"}` : "") : ` ${tgt.hp}/${tgt.max.hp}`;
      s.text(`${tgt.name}${tag}`, 4, BOX_Y - 8, "yellow");
    }
    // Floaters.
    for (const f of this.floaters) {
      const c = st.combatants.find((x) => x.uid === f.uid)!;
      const p = c.side === "enemy" ? this.enemyPos(c) : { ...this.partyPos(c), scale: 2 };
      const yy = p.y - 2 - Math.round(f.t * 14);
      s.textCenter(f.text, p.x + (p.scale * 8) / 2, yy, f.color, "black");
    }
    // Tempo strip.
    if (st.mechanics.has("tempo")) {
      const order = forecast(st, 10);
      s.rect(0, 86, 192, 10, "dark");
      s.text("next", 2, 88, "gray");
      order.forEach((c, i) => {
        const x = 22 + i * 16;
        s.rect(x - 1, 86, 10, 10, c.side === "party" ? "blue" : "red");
        s.sprite(getSprite(c.sprite), x, 87, c.sprite.a, c.sprite.b);
      });
    }
    // Party status rows.
    const rows = st.combatants.filter((c) => c.side === "party" && c.fuseTurns >= 0);
    rows.forEach((c, i) => {
      const y = 98 + i * 10;
      const isActor = this.actor === c && !!this.choosing;
      const dead = c.hp <= 0;
      s.sprite(getSprite(c.sprite), 2, y, c.sprite.a, c.sprite.b, { tint: dead ? "dark" : undefined });
      s.text(c.name.slice(0, 7), 12, y + 1, isActor ? "yellow" : dead ? "gray" : "white");
      s.bar(42, y + 1, 44, 6, c.hp / c.max.hp, c.hp < c.max.hp * 0.25 ? "red" : "green");
      s.text(`${c.hp}`, 88, y + 1, dead ? "red" : "white");
      s.bar(104, y + 1, 28, 6, c.st / c.max.st, "teal");
      s.text(`${c.st}`, 134, y + 1, "teal");
      const shorts = c.statuses.filter((x) => x.id !== "brace" || true).slice(0, 3).map((x) => STATUSES[x.id].short);
      s.text(shorts.join(" "), 148, y + 1, "yellow");
      if (st.mechanics.has("rows")) s.text(c.row === "back" ? "b" : "f", 186, y + 1, "gray");
    });
    // Bottom box.
    s.panel(0, BOX_Y, 192, 56, "dark", "white");
    if (this.choosing && this.actor) this.drawMenu(s);
    else {
      this.messages.forEach((m, i) => s.text(m, 6, BOX_Y + 6 + i * 8, i === this.messages.length - 1 ? "white" : "gray"));
    }
    s.shakeX = 0; s.shakeY = 0;
  }

  private drawMenu(s: Screen): void {
    const st = this.state;
    const actor = this.actor!;
    const y0 = BOX_Y + 4;
    if (this.menu === "main" || this.menu === "target" && !this.pending?.itemId && !this.pending?.words && MAIN_ORDER.includes(this.pending?.skillId ?? "")) {
      this.mainItems.forEach((id, i) => {
        const col = Math.floor(i / 6), row = i % 6;
        const x = 10 + col * 60, y = y0 + row * 8;
        let label = MAIN_LABEL[id];
        if (id === "guard" && st.mechanics.has("brace")) label = "Brace";
        const sel = i === this.mainCursor;
        s.text(label, x, y, sel ? "yellow" : "white");
        if (sel) s.text(">", x - 6, y, "yellow");
      });
      const id = this.mainItems[this.mainCursor];
      const desc = id === "skill" ? "Use a skill." : id === "item" ? "Use an item." : id === "cast" ? "Build a spell from words." : id === "flee" ? "Run from the fight." : SKILLS[id]?.desc ?? "";
      this.drawDesc(s, desc);
      return;
    }
    if (this.menu === "skill" || (this.menu === "target" && this.pending?.skillId && !MAIN_ORDER.includes(this.pending.skillId))) {
      const list = this.skillList(actor);
      const top = Math.max(0, Math.min(this.skillCursor - 2, list.length - 5));
      list.slice(top, top + 5).forEach((id, i) => {
        const sk = SKILLS[id];
        const idx = top + i;
        const y = y0 + i * 8;
        const ok = canPay(st, actor, sk);
        const sel = idx === this.skillCursor;
        s.text(sk.name, 10, y, sel ? "yellow" : ok ? "white" : "gray");
        s.textRight(`${sk.cost}`, 120, y, ok ? "teal" : "gray");
        if (sk.element) s.rect(124, y + 1, 4, 4, elementColor(sk.element));
        if (sk.debt) s.text(`d${sk.debt}`, 130, y, "red");
        if (sel) s.text(">", 4, y, "yellow");
      });
      if (list.length > 5) s.text(top > 0 ? "^" : " ", 186, y0, "gray"), s.text(top + 5 < list.length ? "v" : " ", 186, y0 + 32, "gray");
      this.drawDesc(s, SKILLS[list[this.skillCursor]]?.desc ?? "");
      return;
    }
    if (this.menu === "item" || (this.menu === "target" && this.pending?.itemId)) {
      const list = this.itemList();
      const top = Math.max(0, Math.min(this.itemCursor - 2, list.length - 5));
      list.slice(top, top + 5).forEach((id, i) => {
        const it = ITEMS[id];
        const idx = top + i;
        const y = y0 + i * 8;
        const sel = idx === this.itemCursor;
        s.sprite(getSprite(it.sprite), 10, y - 1, it.sprite.a, it.sprite.b);
        s.text(it.name, 20, y, sel ? "yellow" : "white");
        s.textRight(`x${st.inventory[id]}`, 120, y, "gray");
        if (sel) s.text(">", 4, y, "yellow");
      });
      this.drawDesc(s, ITEMS[list[this.itemCursor]]?.desc ?? "");
      return;
    }
    if (this.menu === "words" || (this.menu === "target" && this.pending?.words)) {
      const cols = this.wordColumns();
      const heads = ["verb", "noun", "shape"];
      cols.forEach((list, ci) => {
        const x = 6 + ci * 62;
        s.text(heads[ci], x, y0, ci === this.wordCol ? "yellow" : "gray");
        const cur = this.wordCursor[ci];
        const top = Math.max(0, Math.min(cur - 1, list.length - 3));
        list.slice(top, top + 3).forEach((id, i) => {
          const w = WORDS.find((x) => x.id === id)!;
          const sel = top + i === cur;
          s.text(w.word, x + 6, y0 + 8 + i * 8, sel ? (ci === this.wordCol ? "yellow" : "white") : "gray");
          if (sel) s.text(">", x, y0 + 8 + i * 8, ci === this.wordCol ? "yellow" : "gray");
        });
      });
      const words: [string, string, string] = [cols[0][this.wordCursor[0]], cols[1][this.wordCursor[1]], cols[2][this.wordCursor[2]]];
      const sk = words.every(Boolean) ? wordSpell(words) : null;
      this.drawDesc(s, sk ? `${sk.name}: ${sk.cost} st${sk.power ? `, pow ${sk.power}` : ""}${sk.heal ? `, heal ${sk.heal}` : ""}${sk.hits ? `, x${sk.hits}` : ""}` : "Pick three words that fit.");
    }
  }

  private drawDesc(s: Screen, desc: string): void {
    s.rect(1, BOX_Y + 45, 190, 1, "gray");
    s.text(desc.length > 46 ? desc.slice(0, 45) + "~" : desc, 4, BOX_Y + 48, "salt");
  }
}

export function elementColor(e: string): ColorName {
  return ({ heat: "orange", cold: "teal", volt: "yellow", rot: "purple", light: "white", null: "gray" } as Record<string, ColorName>)[e] ?? "gray";
}
