import type { Input } from "../../engine/input";
import { type Screen, W, H, wrap } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { deferred } from "../../engine/scene";
import { getSprite, getLarge, type Cells } from "../../engine/sprites";
import { colorInt, mixInt, PALETTE_INT, type ColorName } from "../../engine/palette";
import { hash } from "../../engine/rng";
import { FONT_H } from "../../engine/fontdata";
import { drawBox, ListCursor } from "../../engine/dialogue";
import type { Audio, NoteName } from "../../engine/audio";
import { NOTE_NAMES } from "../../engine/audio";
import type { BattleState, Combatant, Skill, Lane, LockIcon } from "../types";
import {
  type Action, type BattleEvent, nextTurn, perform, checkSnare, usableSkills, canAfford, basicOf, pairSkillsFor, upcoming, previewTempo, party, enemies, targetable, has, alive, itemsOf, liftThreshold, maxTension, locksMatch, biteTarget,
} from "./core";
import { enemyChoose } from "./ai";
import { SKILLS } from "../data/skills";
import { ITEMS } from "../data/items";
import { ENEMIES } from "../data/enemies";
import { MEMBERS } from "../data/members";
import type { GameState } from "../state";

export interface BattleHost {
  g: GameState;
  audio: Audio;
  twoPlayer(): boolean;
  hurry(): boolean;
  /** Apply rewards and return lines for the result box. Called once on a win. */
  onWin(s: BattleState): string[];
  tips(): boolean;
  /** Theme of the map the fight happens on, for the background. */
  theme(): string;
}

export interface BattleOutcome {
  outcome: "win" | "lose" | "flee";
  state: BattleState;
}

type Phase = "idle" | "command" | "skills" | "knots" | "untie" | "items" | "target" | "target2" | "note" | "wind" | "pairs" | "anim" | "result";

interface Float {
  x: number;
  y: number;
  text: string;
  color: ColorName;
  t: number;
}

const STRIP_Y = 2;
const ENEMY_TOP = 22;
const PARTY_Y = 100;
const PANEL_Y = 134;
const CMD_Y = 176;
const LANE_X = [36, 112, 188];

const COMMANDS_HELP: Record<string, string> = {
  Attack: "A plain hit. Held attackers gain 1 tension.",
  Skills: "Spend tension or points.",
  Knots: "Tie a knot in the fallen line. It stays tied until you untie it.",
  Untie: "Take a knot back and get the length.",
  Items: "Use something from the pack.",
  Hang: "Go limp on the line. Half damage until your next turn, +2 tension.",
  Duck: "Drop flat. Nothing hits you until your next turn.",
  Pair: "Act together with a bonded ally.",
  Flee: "Run. Works about two times in three.",
};

/** Short readable names for statuses in the party panel. */
const STATUS_LABEL: Partial<Record<string, string>> = { shield: "bowline", bleed: "fist", slow: "slow", haste: "haste", down: "down", taunt: "taunt", atkUp: "atk+", atkDown: "atk-", defUp: "def+", defDown: "def-", stopper: "stopper", clove: "frozen", hitch: "hitched", snare: "snared", brace: "braced", unhanded: "slack", frost: "frost", silence: "hushed", steady: "steady", focus: "focus", swallow: "open", reef: "reef", hold: "held" };

/** The battle screen. Runs the core, animates its events, and takes commands. */
export class BattleScene implements Scene {
  opaque = true;
  private done = deferred<BattleOutcome>();
  readonly promise = this.done.promise;
  private phase: Phase = "idle";
  private time = 0;
  private actor: Combatant | null = null;
  private cmdCursor = new ListCursor(0, 6);
  private listCursor = new ListCursor(0, 5);
  private commands: string[] = [];
  private list: { label: string; sub: string; skill?: Skill; item?: string; knot?: number; pair?: { partner: Combatant; skill: Skill }; afford: boolean }[] = [];
  private pending: { skill?: Skill; item?: string; pair?: { partner: Combatant; skill: Skill }; target?: Combatant; note?: NoteName } | null = null;
  private targetList: Combatant[] = [];
  private targetIndex = 0;
  private floats: Float[] = [];
  private flashes = new Map<string, { t: number; color: number }>();
  private offsets = new Map<string, { x: number; y: number }>();
  private pluckT = new Map<string, number>();
  private message: { text: string; t: number } | null = null;
  private banner: { text: string; t: number; color: ColorName } | null = null;
  private waiting: { resolve: () => void; t: number } | null = null;
  private commandWait: ReturnType<typeof deferred<Action>> | null = null;
  private resultLines: string[] = [];
  private resultDone: ReturnType<typeof deferred<void>> | null = null;
  private handPick: "tug" | "steady" | "pinch" | null = null;
  private hover: { text: string; x: number; y: number } | null = null;
  private introT = 0.8;
  private slackToast = 0;
  private tipShown = new Set<string>();
  private biteFlash = 0;
  /** The jaw that rises under a bitten line. */
  private jawSnap: { id: string; t: number } | null = null;
  private sparks: { x: number; y: number; t: number; color: number }[] = [];
  private shakeT = 0;

  constructor(private host: BattleHost, private s: BattleState) {
    void this.run();
  }

  // -------------------------------------------------------------------------
  // Main loop

  private async run(): Promise<void> {
    await this.delay(0.6);
    if (this.s.bossName) {
      this.host.audio.sfx("boss");
      this.banner = { text: this.s.bossName, t: 1.4, color: "blood" };
      await this.delay(1.2);
    }
    if (this.s.mech.allSlack && this.host.tips()) {
      await this.showMessage("All lines slack. The Reel will try to hook you.", 1.6);
    }
    for (let guard = 0; guard < 2000 && !this.s.over; guard++) {
      const { actor, events } = nextTurn(this.s);
      await this.play(events);
      if (!actor || this.s.over) break;
      const snareEv: BattleEvent[] = [];
      if (checkSnare(this.s, actor, snareEv)) { await this.play(snareEv); continue; }
      this.actor = actor;
      let action: Action;
      if (actor.side === "party") {
        action = await this.takeCommand(actor);
      } else {
        await this.delay(0.25);
        action = enemyChoose(this.s, actor);
      }
      const ev = perform(this.s, action);
      this.actor = null;
      await this.play(ev);
    }
    await this.finish();
  }

  private async finish(): Promise<void> {
    const outcome = this.s.over ?? "lose";
    this.phase = "result";
    if (outcome === "win") {
      this.host.audio.fadeOut();
      this.host.audio.sfx("win");
      this.resultLines = this.host.onWin(this.s);
    } else if (outcome === "flee") {
      this.resultLines = ["You got away."];
    } else {
      this.host.audio.fadeOut();
      this.host.audio.sfx("lose");
      this.resultLines = ["Everyone is down."];
    }
    this.resultDone = deferred<void>();
    await this.resultDone.promise;
    this.done.resolve({ outcome, state: this.s });
  }

  private delay(sec: number): Promise<void> {
    return new Promise((resolve) => {
      this.waiting = { resolve, t: sec };
    });
  }

  private showMessage(text: string, sec = 0.9): Promise<void> {
    this.message = { text, t: sec + 0.3 };
    return this.delay(sec);
  }

  // -------------------------------------------------------------------------
  // Commands

  private async takeCommand(actor: Combatant): Promise<Action> {
    this.phase = "command";
    this.buildCommands(actor);
    this.cmdCursor = new ListCursor(this.commands.length, 8);
    this.pending = null;
    await this.maybeTip(actor);
    this.commandWait = deferred<Action>();
    const a = await this.commandWait.promise;
    this.commandWait = null;
    this.phase = "anim";
    return a;
  }

  private async maybeTip(actor: Combatant): Promise<void> {
    if (!this.host.tips()) return;
    const tip = (key: string, text: string) => {
      if (this.tipShown.has(key) || this.host.g.flags[`tip:${key}`]) return false;
      this.tipShown.add(key);
      this.host.g.flags[`tip:${key}`] = true;
      this.banner = { text, t: 3.2, color: "gold" };
      return true;
    };
    if (this.s.mech.lift && enemies(this.s).some((e) => e.alive && e.held && !e.letGo && e.tension >= liftThreshold(e) - 1) && tip("takenwarn", "A foe is one tension from the Lift. Taken Up foes give half reward. Pluck it to drain it, or finish it now.")) return;
    if (this.s.chapter <= 3 && this.host.g.flags["tip:tension"] && tip("strip", "The strip shows who acts next, left first. The gold arrow above it marks where the highlighted command puts you.")) return;
    if (this.s.bite >= 50 && tip("bite", "The seam under the turn strip is the Bite. Every humming line fills it. When it is full, something below bites the loudest line. Past 70 a jaw marks who.")) return;
    if (actor.held && this.s.chapter === 1) tip("tension", "Tension is the fuel. Attack and Hang to gain it, skills spend it. Every pip also hums, and fills the Bite.");
    else if (actor.economy === "length" && this.s.chapter === 1) tip("length", "Fathom ties knots with the fallen line. Untie them to get the length back.");
    else if (this.s.mech.notes && this.s.chapter === 2 && actor.defId === "dulcet") tip("notes", "Every held foe has a note. Three different notes that make a chord do something big.");
    else if (this.s.mech.tangle && this.s.chapter === 3 && actor.defId === "lissom") tip("tangle", "Tangle two foes. What one takes, the other takes too.");
    else if (this.s.mech.lift && this.s.chapter === 4 && actor.held) tip("lift", "At the notch on your pips the sky takes up your line and lifts you out for a turn. Foes that reach it are Taken Up: half reward.");
    else if (this.s.mech.lanes && this.s.chapter === 5) tip("lanes", "Three lanes. The arrow on the strip shows which way the wind pushes next round.");
    else if (this.s.mech.locks && this.s.chapter === 6) tip("locks", "Locks show over a foe winding up. Match every icon to cancel the move. A green mark in your menu answers one. A Pluck cancels a held foe outright.");
    else if (this.s.mech.pairs && this.s.chapter === 7 && pairSkillsFor(this.s, actor).length) tip("pairs", "Pair: two bonded allies spend both turns on one big move.");
    else if (this.s.mech.letgo && this.s.chapter === 8 && actor.held) tip("letgo", "Let Go releases your line. No Pluck, no Lift, and you can Duck.");
  }

  private buildCommands(actor: Combatant): void {
    const cmds = ["Attack"];
    const skills = usableSkills(this.s, actor).filter((k) => k.kind !== "knot" && k.kind !== "hang" && k.id !== "duck" && k.kind !== "letgo" || k.id === "release");
    const knots = usableSkills(this.s, actor).filter((k) => k.kind === "knot");
    if (skills.some((k) => k.id !== "rise") || usableSkills(this.s, actor).some((k) => k.kind === "rise" || (k.kind === "letgo" && k.id === "letgo"))) cmds.push("Skills");
    if (knots.length) cmds.push("Knots");
    if (actor.knots.length) cmds.push("Untie");
    if (Object.values(itemsOf(this.s)).some((n) => n > 0)) cmds.push("Items");
    if (actor.held && !actor.letGo) cmds.push("Hang"); else cmds.push("Duck");
    if (pairSkillsFor(this.s, actor).length) cmds.push("Pair");
    if (this.s.canFlee) cmds.push("Flee");
    this.commands = cmds;
  }

  private submit(a: Action): void {
    this.commandWait?.resolve(a);
    this.host.audio.sfx("ok");
  }

  /** Why a skill has nothing to aim at right now, or null when it does. */
  private noTarget(sk: Skill): string | null {
    const foes = targetable(enemies(this.s));
    const friends = targetable(party(this.s)).filter((p) => !p.reheld);
    if (sk.kind === "climb" && !foes.some((c) => c.held && !c.letGo)) return "No foe has a line to climb.";
    if (sk.effect === "releaseAlly" && !friends.some((c) => c.held && !c.letGo)) return "No ally is held.";
    const kind = this.targetKindFor(sk);
    if (kind === "two" && foes.length < 2) return "Needs two foes.";
    if (kind === "twoAllies" && friends.length < 2) return "Needs two allies.";
    return null;
  }

  /** Open lock icons on every foe that is winding up. */
  private openLocks(): string[] {
    if (!this.s.mech.locks) return [];
    const out: string[] = [];
    for (const e of enemies(this.s)) if (e.alive && e.charging) e.charging.locks.forEach((l, i) => { if (!e.charging!.matched[i]) out.push(l); });
    return out;
  }

  private answers(lock: string | undefined, open = this.openLocks()): boolean {
    return !!lock && open.some((l) => locksMatch(lock, l));
  }

  /** A thrown item answers the lock of its element. */
  private itemLock(id: string | undefined): string | undefined {
    const it = id ? ITEMS[id] : undefined;
    return it?.target === "enemy" ? it.element : undefined;
  }

  /** The lock the action being aimed carries: its skill's, its pair's, its item's, or the plain attack's. */
  private pendingLock(actor: Combatant): string | undefined {
    const p = this.pending;
    if (!p) return undefined;
    if (p.skill) return p.skill.lock;
    if (p.pair) return p.pair.skill.lock;
    if (p.item) return this.itemLock(p.item);
    return basicOf(actor).lock;
  }

  /** Whether a top level command holds something that answers an open lock. */
  private commandAnswers(actor: Combatant, cmd: string, open: string[]): boolean {
    if (!open.length) return false;
    const usable = usableSkills(this.s, actor);
    if (cmd === "Attack") return this.answers(basicOf(actor).lock, open);
    if (cmd === "Skills") return usable.some((k) => k.kind !== "knot" && k.kind !== "hang" && k.id !== "duck" && canAfford(actor, k) && !this.noTarget(k) && this.answers(k.lock, open));
    if (cmd === "Knots") return usable.some((k) => k.kind === "knot" && canAfford(actor, k) && !this.noTarget(k) && this.answers(k.lock, open));
    if (cmd === "Items") { const inv = itemsOf(this.s); return Object.keys(inv).some((id) => inv[id] > 0 && this.answers(this.itemLock(id), open)); }
    if (cmd === "Duck") return this.answers("duck", open);
    if (cmd === "Pair") return pairSkillsFor(this.s, actor).some((p) => this.answers(p.skill.lock, open));
    return false;
  }

  private openSkills(actor: Combatant): void {
    const all = usableSkills(this.s, actor).filter((k) => k.kind !== "knot" && k.kind !== "hang" && k.id !== "duck");
    this.list = all.map((k) => {
      const why = this.noTarget(k);
      return { label: k.name, sub: why ? `${why} ${k.desc}` : k.desc, skill: k, afford: canAfford(actor, k) && !why };
    });
    this.listCursor = new ListCursor(this.list.length, 4);
    this.phase = "skills";
  }

  private openKnots(actor: Combatant): void {
    const all = usableSkills(this.s, actor).filter((k) => k.kind === "knot");
    this.list = all.map((k) => {
      const why = this.noTarget(k);
      return { label: k.name, sub: why ? `${why} ${k.desc}` : k.desc, skill: k, afford: canAfford(actor, k) && !why };
    });
    this.listCursor = new ListCursor(this.list.length, 4);
    this.phase = "knots";
  }

  private openUntie(actor: Combatant): void {
    this.list = actor.knots.map((k, i) => {
      const names = k.targets.map((id) => this.s.combatants.find((c) => c.id === id)?.name ?? "?").join(" & ");
      return { label: SKILLS[k.skill].name, sub: `On ${names}. Returns ${k.cost} fathoms.`, knot: i, afford: true };
    });
    this.listCursor = new ListCursor(this.list.length, 4);
    this.phase = "untie";
  }

  private openItems(): void {
    const inv = itemsOf(this.s);
    this.list = Object.keys(inv).filter((id) => inv[id] > 0 && ITEMS[id]?.kind === "consumable").map((id) => ({ label: `${ITEMS[id].name} x${inv[id]}`, sub: ITEMS[id].desc, item: id, afford: true }));
    this.listCursor = new ListCursor(this.list.length, 4);
    this.phase = "items";
  }

  private openPairs(actor: Combatant): void {
    this.list = pairSkillsFor(this.s, actor).map((p) => ({ label: `${p.skill.name} (${p.partner.name})`, sub: p.skill.desc, pair: p, afford: true }));
    this.listCursor = new ListCursor(this.list.length, 4);
    this.phase = "pairs";
  }

  private beginTarget(kind: "enemy" | "ally" | "anyone" | "dead", second = false): void {
    const foes = targetable(enemies(this.s));
    const friends = targetable(party(this.s)).filter((p) => !p.reheld);
    const reheld = party(this.s).filter((p) => p.reheld && p.alive);
    let list: Combatant[];
    if (kind === "enemy") list = foes;
    else if (kind === "ally") list = friends;
    else if (kind === "dead") list = party(this.s).filter((p) => !p.alive && !p.taken);
    else list = [...friends, ...foes];
    const sk = this.pending?.skill;
    if ((sk?.kind === "pluck" || (!sk && !this.pending?.item && !this.pending?.pair)) && reheld.length && kind === "enemy") list = [...list, ...reheld];
    if (sk?.kind === "climb") list = list.filter((c) => c.held && !c.letGo);
    if (sk?.effect === "releaseAlly") list = list.filter((c) => c.held && !c.letGo && !c.reheld);
    if (second && this.pending?.target) list = list.filter((c) => c.id !== this.pending!.target!.id);
    // Left and right follow the screen
    list = [...list].sort((a, b) => this.pos(a).x - this.pos(b).x);
    if (!list.length) {
      this.message = { text: sk ? `No one to ${sk.name.toLowerCase()}.` : "No target.", t: 1.2 };
      this.phase = "command";
      return;
    }
    this.targetList = list;
    this.targetIndex = 0;
    // Aim first at a foe with an open lock this action answers
    const lock = kind === "enemy" && !second && this.actor && this.s.mech.locks ? this.pendingLock(this.actor) : undefined;
    if (lock) {
      const i = list.findIndex((c) => c.charging?.locks.some((l, k) => !c.charging!.matched[k] && locksMatch(lock, l)));
      if (i >= 0) this.targetIndex = i;
    }
    // Help and heals start on whoever is worst off
    if (kind === "ally") list.forEach((c, i) => { if (c.hp / c.maxHp < list[this.targetIndex].hp / list[this.targetIndex].maxHp) this.targetIndex = i; });
    this.phase = second ? "target2" : "target";
  }

  private targetKindFor(sk: Skill): "enemy" | "ally" | "anyone" | "none" | "two" | "twoAllies" {
    switch (sk.target) {
      case "enemy": return "enemy";
      case "ally": return "ally";
      case "anyone": return "anyone";
      case "twoEnemies": return "two";
      case "allAllies": return sk.effect === "reef" ? "twoAllies" : "none";
      default: return "none";
    }
  }

  private confirmTarget(t: Combatant): void {
    const actor = this.actor!;
    const p = this.pending!;
    if (p.item) {
      this.submit({ type: "item", actor: actor.id, item: p.item, target: t.id });
      return;
    }
    if (p.pair) {
      this.submit({ type: "pair", actor: actor.id, partner: p.pair.partner.id, skill: p.pair.skill.id, target: t.id });
      return;
    }
    if (!p.skill) {
      this.submit({ type: "attack", actor: actor.id, target: t.id });
      return;
    }
    const sk = p.skill;
    const kind = this.targetKindFor(sk);
    if ((kind === "two" || kind === "twoAllies") && this.phase === "target") {
      p.target = t;
      this.beginTarget(kind === "two" ? "enemy" : "ally", true);
      return;
    }
    if (kind === "two" || kind === "twoAllies") {
      this.submit({ type: "skill", actor: actor.id, skill: sk.id, target: p.target!.id, target2: t.id });
      return;
    }
    if (sk.kind === "tune") {
      p.target = t;
      this.listCursor = new ListCursor(7, 7);
      this.phase = "note";
      return;
    }
    this.submit({ type: "skill", actor: actor.id, skill: sk.id, target: t.id });
  }

  private chooseSkill(sk: Skill): void {
    const actor = this.actor!;
    if (!canAfford(actor, sk)) { this.host.audio.sfx("cancel"); this.message = { text: actor.economy === "tension" ? "Not enough tension." : actor.economy === "length" ? "Not enough line." : "Not enough points.", t: 1 }; return; }
    const why = this.noTarget(sk);
    if (why) { this.host.audio.sfx("cancel"); this.message = { text: why, t: 1.2 }; return; }
    this.pending = { skill: sk };
    const kind = this.targetKindFor(sk);
    if (sk.kind === "wind") { this.listCursor = new ListCursor(3, 3); this.phase = "wind"; return; }
    if (kind === "none") { this.submit({ type: "skill", actor: actor.id, skill: sk.id }); return; }
    if (kind === "two") { this.beginTarget("enemy"); return; }
    if (kind === "twoAllies") { this.beginTarget("ally"); return; }
    this.beginTarget(kind);
  }

  // -------------------------------------------------------------------------
  // Update

  update(dt: number, input: Input): void {
    this.time += dt;
    if (this.introT > 0) this.introT -= dt;
    const hurry = this.host.hurry() || input.held("run");
    const speed = hurry ? 3.5 : 1;
    for (const f of this.floats) f.t -= dt * speed;
    this.floats = this.floats.filter((f) => f.t > 0);
    for (const [k, v] of this.flashes) { v.t -= dt * speed; if (v.t <= 0) this.flashes.delete(k); }
    for (const [k, v] of this.pluckT) { const nv = v - dt * speed; if (nv <= 0) this.pluckT.delete(k); else this.pluckT.set(k, nv); }
    for (const [k, o] of this.offsets) { o.x *= 0.8; o.y *= 0.8; if (Math.abs(o.x) < 0.5 && Math.abs(o.y) < 0.5) this.offsets.delete(k); }
    if (this.message) { this.message.t -= dt * speed; if (this.message.t <= 0) this.message = null; }
    if (this.banner) { this.banner.t -= dt * (hurry ? 2 : 1); if (this.banner.t <= 0) this.banner = null; }
    if (this.biteFlash > 0) this.biteFlash -= dt * speed;
    if (this.jawSnap) { this.jawSnap.t -= dt * speed; if (this.jawSnap.t <= 0) this.jawSnap = null; }
    for (const p of this.sparks) p.t -= dt * speed;
    this.sparks = this.sparks.filter((p) => p.t > 0);
    if (this.shakeT > 0) this.shakeT -= dt * speed;
    if (this.waiting) {
      this.waiting.t -= dt * speed;
      if (this.waiting.t <= 0) { const w = this.waiting; this.waiting = null; w.resolve(); }
    }
    this.updateHand(input);
    if (this.phase === "result") {
      if (input.pressed("ok") || input.pressed("cancel")) { input.consume("ok"); input.consume("cancel"); this.resultDone?.resolve(); }
      return;
    }
    const actor = this.actor;
    if (!actor || !this.commandWait) return;
    switch (this.phase) {
      case "command": {
        this.cmdCursor.move(input, this.host.audio);
        // Left and right hop between the two command columns
        if ((input.pressed("left") || input.pressed("right")) && this.commands.length > 4) {
          input.consume("left");
          input.consume("right");
          const i = this.cmdCursor.index;
          this.cmdCursor.index = i >= 4 ? i - 4 : Math.min(this.commands.length - 1, i + 4);
          this.host.audio.sfx("cursor");
        }
        if (input.pressed("ok")) {
          input.consume("ok");
          const cmd = this.commands[this.cmdCursor.index];
          this.host.audio.sfx("cursor");
          switch (cmd) {
            case "Attack": this.pending = {}; this.beginTarget("enemy"); break;
            case "Skills": this.openSkills(actor); break;
            case "Knots": this.openKnots(actor); break;
            case "Untie": this.openUntie(actor); break;
            case "Items": this.openItems(); break;
            case "Hang": this.submit({ type: "skill", actor: actor.id, skill: "hang" }); break;
            case "Duck": this.submit({ type: "skill", actor: actor.id, skill: actor.skills.includes("burrow") && canAfford(actor, SKILLS.burrow) ? "burrow" : "duck" }); break;
            case "Pair": this.openPairs(actor); break;
            case "Flee": this.submit({ type: "flee", actor: actor.id }); break;
          }
        }
        break;
      }
      case "skills":
      case "knots":
      case "untie":
      case "items":
      case "pairs": {
        this.listCursor.move(input, this.host.audio);
        if (input.pressed("cancel")) { input.consume("cancel"); this.host.audio.sfx("cancel"); this.phase = "command"; break; }
        if (input.pressed("ok")) {
          input.consume("ok");
          const it = this.list[this.listCursor.index];
          if (!it) break;
          if (it.skill) this.chooseSkill(it.skill);
          else if (it.knot !== undefined) this.submit({ type: "untie", actor: actor.id, knot: it.knot });
          else if (it.item) {
            const def = ITEMS[it.item];
            this.pending = { item: it.item };
            if (def.target === "enemy") { if (def.id === "firepot") this.submit({ type: "item", actor: actor.id, item: it.item }); else this.beginTarget("enemy"); }
            else if (def.target === "allAllies") this.submit({ type: "item", actor: actor.id, item: it.item });
            else if (def.revive) this.beginTarget("dead");
            else this.beginTarget("ally");
          } else if (it.pair) {
            this.pending = { pair: it.pair };
            if (it.pair.skill.target === "enemy") this.beginTarget("enemy");
            else if (it.pair.skill.target === "ally") this.beginTarget("ally");
            else this.submit({ type: "pair", actor: actor.id, partner: it.pair.partner.id, skill: it.pair.skill.id });
          }
        }
        break;
      }
      case "target":
      case "target2": {
        if (input.pressed("left") || input.pressed("up")) { this.targetIndex = (this.targetIndex + this.targetList.length - 1) % this.targetList.length; this.host.audio.sfx("cursor"); }
        if (input.pressed("right") || input.pressed("down")) { this.targetIndex = (this.targetIndex + 1) % this.targetList.length; this.host.audio.sfx("cursor"); }
        if (input.pressed("cancel")) { input.consume("cancel"); this.host.audio.sfx("cancel"); this.phase = this.pending?.item ? "items" : this.pending?.pair ? "pairs" : this.pending?.skill ? (this.pending.skill.kind === "knot" ? "knots" : "skills") : "command"; break; }
        if (input.pressed("ok")) { input.consume("ok"); this.confirmTarget(this.targetList[this.targetIndex]); }
        break;
      }
      case "note": {
        if (input.pressed("left") || input.pressed("up")) { this.listCursor.index = (this.listCursor.index + 6) % 7; this.host.audio.playNote(NOTE_NAMES[this.listCursor.index], 0, 0.3); }
        if (input.pressed("right") || input.pressed("down")) { this.listCursor.index = (this.listCursor.index + 1) % 7; this.host.audio.playNote(NOTE_NAMES[this.listCursor.index], 0, 0.3); }
        if (input.pressed("cancel")) { input.consume("cancel"); this.phase = "skills"; break; }
        if (input.pressed("ok")) { input.consume("ok"); this.submit({ type: "skill", actor: actor.id, skill: "tune", target: this.pending!.target!.id, note: NOTE_NAMES[this.listCursor.index] }); }
        break;
      }
      case "wind": {
        if (input.pressed("left") || input.pressed("up")) { this.listCursor.index = (this.listCursor.index + 2) % 3; this.host.audio.sfx("cursor"); }
        if (input.pressed("right") || input.pressed("down")) { this.listCursor.index = (this.listCursor.index + 1) % 3; this.host.audio.sfx("cursor"); }
        if (input.pressed("cancel")) { input.consume("cancel"); this.phase = "skills"; break; }
        if (input.pressed("ok")) { input.consume("ok"); this.submit({ type: "skill", actor: actor.id, skill: "setwind", wind: ([-1, 0, 1] as const)[this.listCursor.index] }); }
        break;
      }
    }
  }

  // Player two: the Hand picks an action icon then a target.
  private updateHand(input: Input): void {
    this.hover = null;
    if (!this.host.twoPlayer() || !input.pointer.over) return;
    const px = input.pointer.x, py = input.pointer.y;
    const icons: ("tug" | "steady" | "pinch")[] = ["tug", "steady", "pinch"];
    const names = { tug: "Tug: +1 tension", steady: "Steady: no knockdown", pinch: "Pinch: foe -1 tension, delayed" };
    for (let i = 0; i < 3; i++) {
      const ix = W - 12, iy = ENEMY_TOP + i * 12;
      if (px >= ix - 1 && px < ix + 9 && py >= iy - 1 && py < iy + 9) {
        this.hover = { text: names[icons[i]] + (this.s.hand[icons[i]] > 0 ? ` (${this.s.hand[icons[i]]})` : ""), x: px, y: py };
        if (input.pointer.clicks > 0 && this.s.hand[icons[i]] === 0) { this.handPick = this.handPick === icons[i] ? null : icons[i]; this.host.audio.sfx("hand"); }
        return;
      }
    }
    // Hover a combatant
    for (const c of alive(this.s.combatants)) {
      const p = this.pos(c);
      if (px >= p.x - 8 && px < p.x + 8 && py >= p.y - 8 && py < p.y + 10) {
        const d = ENEMIES[c.defId];
        this.hover = { text: d ? d.about : MEMBERS[c.defId]?.title ?? c.name, x: px, y: py };
        if (input.pointer.clicks > 0 && this.handPick) {
          const kind = this.handPick;
          const ok = (kind === "pinch" && c.side === "enemy") || (kind !== "pinch" && c.side === "party");
          if (ok) {
            const ev = perform(this.s, { type: "hand", kind, target: c.id });
            this.handPick = null;
            void this.play(ev);
          }
        } else if (input.pointer.clicks > 0 && c.held && c.note) {
          this.host.audio.playNote(c.note, 0, 0.4);
          this.pluckT.set(c.id, 0.4);
        }
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Event playback

  private async play(events: BattleEvent[]): Promise<void> {
    for (const e of events) await this.playOne(e);
  }

  private name(id: string): string {
    return this.s.combatants.find((c) => c.id === id)?.name ?? id;
  }

  /** Below the Drop there is no wind, so the lane push is the water's current. */
  private pushName(): string {
    const t = this.host.theme();
    return t === "under" || t === "stays" ? "current" : "wind";
  }

  private float(id: string, text: string, color: ColorName): void {
    const c = this.s.combatants.find((x) => x.id === id);
    if (!c) return;
    const p = this.pos(c);
    if (this.floats.some((f) => f.text === text && Math.abs(f.x - p.x) < 10 && f.t > 0.5)) return;
    this.floats.push({ x: p.x, y: p.y - 10 - this.floats.filter((f) => Math.abs(f.x - p.x) < 10).length * 7, text, color, t: 0.9 });
  }

  private async playOne(e: BattleEvent): Promise<void> {
    const a = this.host.audio;
    switch (e.t) {
      case "turn": return;
      case "use": {
        const sk = SKILLS[e.skill];
        if (sk && (sk.cost > 0 || sk.kind !== "attack")) await this.showMessage(`${this.name(e.who)}: ${sk.name}${e.pair ? ` with ${this.name(e.pair)}` : ""}`, 0.45);
        if (sk?.kind === "knot") a.sfx("knot");
        return;
      }
      case "damage": {
        const c = this.s.combatants.find((x) => x.id === e.target);
        this.flashes.set(e.target, { t: 0.2, color: e.weak ? colorInt("gold") : colorInt("white") });
        // Knockback away from the attacker's side, in whole pixels
        this.offsets.set(e.target, { x: Math.round((Math.random() - 0.5) * 6), y: c?.side === "party" ? 3 : -3 });
        this.float(e.target, `${e.amount}${e.crit ? "!" : ""}`, e.mirrored ? "rose" : e.crit ? "gold" : e.weak ? "orange" : e.resist ? "ash" : "white");
        if (c && (e.crit || e.weak) && !e.mirrored) {
          const p = this.pos(c);
          this.sparks.push({ x: p.x, y: p.y - (c.boss ? 8 : 4), t: 0.3, color: colorInt(e.crit ? "gold" : "orange") });
          if (e.crit) this.shakeT = 0.2;
        }
        if (e.pluck) { a.sfx("pluck"); this.pluckT.set(e.target, 0.5); }
        else a.sfx(e.element === "cold" ? "cold" : e.element === "heat" ? "heat" : e.element === "wind" ? "wind" : e.crit ? "hit2" : "hit");
        if (e.weak && c && !e.mirrored) this.message = { text: `Weak to ${e.element}!`, t: 0.8 };
        if (e.resist && !e.mirrored) this.message = { text: `Resists ${e.element}.`, t: 0.8 };
        await this.delay(e.mirrored ? 0.15 : 0.3);
        return;
      }
      case "heal": this.float(e.target, `+${e.amount}`, "mint"); a.sfx("heal"); await this.delay(0.3); return;
      case "evade": this.float(e.target, "miss", "ash"); a.sfx("miss"); await this.delay(0.25); return;
      case "hold": this.float(e.target, "held", "frost"); a.sfx("hand"); await this.delay(0.3); return;
      case "swallow": await this.showMessage(`${this.name(e.who)} swallows it.`, 0.5); return;
      case "status": {
        if (!e.on) return;
        const names: Partial<Record<string, string>> = { guard: "guard", duck: "duck", shield: "bowline", slow: "slow", haste: "haste", down: "down", taunt: "taunt", atkUp: "atk up", atkDown: "atk down", defUp: "def up", defDown: "def down", bleed: "fist", stopper: "stopper", clove: "frozen", hitch: "hitched", snare: "snared", brace: "braced", unhanded: "slack", frost: "frost", silence: "hushed", steady: "steady", focus: "focus", swallow: "wide open", reef: "reef" };
        this.float(e.target, names[e.status] ?? e.status, e.status === "down" ? "orange" : "lilac");
        if (e.status === "down") a.sfx("fall");
        await this.delay(0.2);
        return;
      }
      case "tension": {
        if (e.delta > 0) { this.pluckT.set(e.target, 0.15); a.sfx("tension"); }
        await this.delay(0.08);
        return;
      }
      case "pool": await this.delay(0.05); return;
      case "note": {
        this.message = { text: `Note ${e.note}. Phrase: ${e.phrase.join(" ")}`, t: 1 };
        await this.delay(0.25);
        return;
      }
      case "chord": {
        const names = { major: "Major chord! The party heals.", minor: "Minor chord! Foes slow down.", dim: "Diminished! Every line rings.", sus: "Suspended! Tension for all.", aug: "Augmented! Foes go slack." };
        a.playChord(e.notes, e.kind !== "dim");
        this.banner = { text: names[e.kind], t: 1.4, color: "gold" };
        await this.delay(1.0);
        return;
      }
      case "lift": {
        a.sfx("lift");
        // The Reel is not named until the party reaches the deck
        this.message = { text: e.rise ? `${this.name(e.who)} rises on the line.` : `The ${this.s.chapter >= 8 ? "Reel" : "sky"} takes up ${this.name(e.who)}'s line.`, t: 1 };
        await this.delay(0.7);
        return;
      }
      case "descent": {
        a.sfx("fall");
        this.message = { text: `${this.name(e.who)} comes down on ${this.name(e.target)}.`, t: 1 };
        this.offsets.set(e.who, { x: 0, y: -40 });
        await this.delay(0.5);
        return;
      }
      case "taken": {
        a.sfx("lift");
        this.banner = { text: `${this.name(e.who)} is Taken Up.`, t: 1.5, color: "frost" };
        await this.delay(1.0);
        return;
      }
      case "knot": {
        a.sfx("knot");
        for (const t of e.targets) this.float(t, SKILLS[e.skill].name, "teal");
        await this.delay(0.4);
        return;
      }
      case "untie": a.sfx("untie"); this.float(e.who, `+${e.refund} fathom`, "teal"); await this.delay(0.3); return;
      case "tangle": {
        if (e.on) { a.sfx("tangle"); await this.showMessage(`${this.name(e.a)} and ${this.name(e.b)} are tangled.`, 0.7); }
        else await this.delay(0.1);
        return;
      }
      case "wind": {
        const push = this.pushName();
        if (e.set) { a.sfx("wind"); await this.showMessage(e.wind === 0 ? `The ${push} will be still.` : `The ${push} will push ${e.wind < 0 ? "left" : "right"}.`, 0.6); }
        else if (e.wind !== 0) { a.sfx("wind"); await this.showMessage(`The ${push} pushes ${e.wind < 0 ? "left" : "right"}.`, 0.5); }
        else await this.delay(0.1);
        return;
      }
      case "lane": await this.delay(0.08); return;
      case "charge": {
        a.sfx("charge");
        const answer = (l: string) => l === "pluck" || l === "hum" ? "a pluck or a song" : l === "knot" ? "a knot" : l === "duck" ? "Duck" : l === "tangle" ? "Tangle" : `a ${l} hit`;
        this.banner = { text: `${this.name(e.who)} winds up ${SKILLS[e.skill].name}! Answer with ${e.locks.map(answer).join(", ")}.`, t: 2.0, color: "orange" };
        await this.delay(1.1);
        return;
      }
      case "lock": a.sfx("unlock"); this.float(e.who, "lock broken", "gold"); await this.delay(0.3); return;
      case "cancel": a.sfx("snap"); this.banner = { text: `${this.name(e.who)}'s move is canceled!`, t: 1, color: "gold" }; await this.delay(0.6); return;
      case "ko": {
        a.sfx("hit2");
        this.flashes.set(e.who, { t: 0.5, color: colorInt("black") });
        await this.delay(0.4);
        return;
      }
      case "down": await this.showMessage(`${this.name(e.who)} is down and loses the turn.`, 0.6); return;
      case "climb": a.sfx("whoosh"); await this.showMessage(`${this.name(e.who)} climbs ${this.name(e.target)}'s line.`, 0.7); return;
      case "drop": a.sfx("fall"); this.offsets.set(e.who, { x: 0, y: -30 }); await this.showMessage(`${this.name(e.who)} drops onto ${this.name(e.target)}. Its line goes slack.`, 0.8); return;
      case "letgo": a.sfx("untie"); this.banner = { text: `${this.name(e.who)} lets go.`, t: 1.2, color: "teal" }; await this.delay(0.8); return;
      case "rehold": a.sfx("lock"); this.banner = { text: `The Reel hooks ${this.name(e.who)} again!`, t: 1.3, color: "blood" }; await this.delay(0.9); return;
      case "freed": a.sfx("snap"); this.banner = { text: `${this.name(e.who)} is free again.`, t: 1.1, color: "teal" }; await this.delay(0.7); return;
      case "enrage": a.sfx("boss"); this.banner = { text: `${this.name(e.who)} pulls tight!`, t: 1.2, color: "blood" }; this.flashes.set(e.who, { t: 0.6, color: colorInt("blood") }); await this.delay(0.8); return;
      case "summon": a.sfx("whoosh"); await this.showMessage(`${this.name(e.who)} calls for more.`, 0.6); return;
      case "flee": await this.showMessage(e.ok ? "You slip away." : "Could not get away.", 0.7); return;
      case "item": a.sfx("item"); await this.showMessage(`${this.name(e.who)} uses ${ITEMS[e.item]?.name ?? e.item}.`, 0.5); return;
      case "hand": a.sfx("hand"); this.float(e.target, e.kind === "tug" ? "tug" : e.kind === "steady" ? "steady" : "pinch", "frost"); await this.delay(0.25); return;
      case "bite": {
        a.sfx("boss");
        this.biteFlash = 0.9;
        this.jawSnap = { id: e.target, t: 0.6 };
        this.shakeT = 0.3;
        this.flashes.set(e.target, { t: 0.5, color: colorInt("blood") });
        this.offsets.set(e.target, { x: 0, y: 6 });
        this.float(e.target, `${e.amount}`, "blood");
        this.banner = { text: `Something below bites ${this.name(e.target)}'s line.`, t: 1.5, color: "blood" };
        await this.delay(1.1);
        return;
      }
      case "text": await this.showMessage(e.text, 0.7); return;
      case "win": return;
      case "lose": return;
    }
  }

  // -------------------------------------------------------------------------
  // Layout

  private pos(c: Combatant): { x: number; y: number } {
    const side = c.side === "enemy" ? enemies(this.s) : party(this.s);
    const o = this.offsets.get(c.id) ?? { x: 0, y: 0 };
    if (this.s.mech.lanes) {
      const inLane = side.filter((x) => x.lane === c.lane && x.alive && !x.taken);
      const idx = Math.max(0, inLane.indexOf(c));
      const n = inLane.length;
      const spread = c.side === "enemy" ? 20 : 14;
      const base = LANE_X[c.lane];
      const x = base + (idx - (n - 1) / 2) * spread;
      const y = c.side === "enemy" ? ENEMY_TOP + 22 + (idx % 2) * 18 : PARTY_Y + 6;
      return { x: Math.round(x + o.x), y: Math.round(y + o.y) };
    }
    const living = side.filter((x) => x.alive || x === c);
    const idx = Math.max(0, living.indexOf(c));
    const n = living.length;
    const x = W / 2 + (idx - (n - 1) / 2) * (c.side === "enemy" ? 36 : 32);
    const y = c.side === "enemy" ? ENEMY_TOP + 30 + (n > 3 ? (idx % 2) * 12 : 0) : PARTY_Y + 6;
    return { x: Math.round(x + o.x), y: Math.round(y + o.y) };
  }

  // -------------------------------------------------------------------------
  // Draw

  draw(s: Screen): void {
    this.drawBackground(s);
    if (this.s.mech.lanes) {
      for (const lx of LANE_X) for (let y = 16; y < PARTY_Y + 22; y += 2) s.px(lx, y, mixInt(colorInt("bone"), PALETTE_INT.ink, 0.6));
    }
    this.drawStrip(s);
    // Lines and sprites
    const partyC = party(this.s), enemyC = enemies(this.s);
    for (const c of [...enemyC, ...partyC]) this.drawCombatantLine(s, c);
    for (const c of [...enemyC, ...partyC]) this.drawTangle(s, c);
    for (const c of enemyC) this.drawCombatant(s, c);
    for (const c of partyC) this.drawCombatant(s, c);
    this.drawBiteMarks(s);
    this.drawSparks(s);
    this.drawPanel(s);
    this.drawCommand(s);
    for (const f of this.floats) {
      const y = f.y - (0.9 - f.t) * 14;
      s.textCenter(f.text, f.x, Math.round(y), f.color, "black");
    }
    if (this.message) {
      const tw = s.textWidth(this.message.text) + 8;
      drawBox(s, Math.floor((W - tw) / 2), PARTY_Y - 20, Math.min(W - 4, tw), FONT_H + 7);
      s.textCenter(this.message.text, W / 2, PARTY_Y - 16, "white");
    }
    if (this.banner) {
      const lines = wrap(this.banner.text, W - 24);
      const tw = Math.min(W - 8, Math.max(...lines.map((l) => s.textWidth(l))) + 12);
      const th = lines.length * (FONT_H + 1) + 9;
      const by = PARTY_Y + 22 - th;
      drawBox(s, Math.floor((W - tw) / 2), by, tw, th);
      lines.forEach((l, i) => s.textCenter(l, W / 2, by + 5 + i * (FONT_H + 1), this.banner!.color));
    }
    if (this.biteFlash > 0) {
      // The ground cracks open under the party band and something dark shows
      const k = Math.min(1, this.biteFlash / 0.9);
      const seed = hash(`${this.s.bites}`);
      for (let i = 0; i < 5; i++) { const x = (seed * (i + 1) * 37) % W; let xx = x; for (let y = PARTY_Y - 6; y < PARTY_Y + 24; y++) { s.px(xx, y, k > 0.5 ? colorInt("black") : colorInt("coal")); if (y % 3 === 0) xx += ((seed >> i) & 1) ? 1 : -1; } }
      if (k > 0.6) s.tint(0, 14, W, PARTY_Y + 10, "blood", (k - 0.6) * 0.5);
    }
    if (this.shakeT > 0) this.shakeScreen(s);
    if (this.phase === "result") this.drawResult(s);
    if (this.host.twoPlayer()) this.drawHandUi(s);
    if (this.introT > 0) s.dimRect(0, 0, W, H, Math.min(1, this.introT / 0.8));
  }

  /** A jaw over the line the Bite would take next, and the jaw that rises when it does. */
  private drawBiteMarks(s: Screen): void {
    const jaw = getSprite("shape", "jaw", "jaw");
    if (this.s.bite > 70 && !this.jawSnap && Math.floor(this.time * 4) % 2 === 0) {
      const t = biteTarget(this.s);
      if (t && !t.taken) {
        const p = this.pos(t);
        s.sprite(jaw, p.x + (t.boss ? 9 : 5), p.y - (t.boss ? 22 : 14), "blood", "white");
      }
    }
    if (this.jawSnap) {
      const c = this.s.combatants.find((x) => x.id === this.jawSnap!.id);
      if (c) {
        const p = this.pos(c);
        const k = Math.min(1, (0.6 - this.jawSnap.t) / 0.25);
        s.sprite(jaw, p.x - 4, Math.round(p.y + 14 - k * 12), "blood", "white");
      }
    }
  }

  private drawSparks(s: Screen): void {
    for (const p of this.sparks) {
      const d = 3 + (0.3 - p.t) * 30;
      for (let i = 0; i < 6; i++) {
        const a = i * (Math.PI / 3) + 0.4;
        s.px(Math.round(p.x + Math.cos(a) * d), Math.round(p.y + Math.sin(a) * d), p.color);
      }
    }
  }

  /** Shift the field above the command box one pixel sideways, alternating each frame. */
  private shakeScreen(s: Screen): void {
    const dx = Math.floor(this.time * 30) % 2 ? 1 : -1;
    for (let y = 0; y < CMD_Y; y++) {
      const row = y * W;
      if (dx > 0) s.buf.copyWithin(row + 1, row, row + W - 1);
      else s.buf.copyWithin(row, row + 1, row + W);
    }
  }

  /** A painted backdrop for the region the fight happens in. Everything on the one pixel grid. */
  private drawBackground(s: Screen): void {
    const theme = this.host.theme();
    const seed = hash(this.s.seed.toString());
    const top = 14, ground = PARTY_Y - 6;
    const ink = colorInt("ink"), coal = colorInt("coal"), slate = colorInt("slate");
    s.clear("ink");
    const ribs = (ribColor: number) => {
      // The Hull: ribs across the top of the sky with a drip or two
      for (let y = top + 2; y < top + 14; y += 4) s.hline(y, 0, W - 1, ribColor);
      for (let i = 0; i < 6; i++) { const x = (seed * (i + 3) * 7) % W; s.px(x, top + 15 + (i % 3), mixInt(colorInt("sea"), ink, 0.4)); }
    };
    const hills = (color: number, base: number, amp: number, k: number) => {
      for (let x = 0; x < W; x++) {
        const h = Math.round(Math.sin(x * k + seed % 7) * amp + Math.sin(x * k * 2.7 + seed % 11) * amp * 0.4);
        s.vline(x, base - h, ground, color);
      }
    };
    const farLines = (color: number, n: number) => {
      // Distant held people: thin lines from the ground up into the ribs
      for (let i = 0; i < n; i++) { const x = (seed * (i + 1) * 13 + i * 31) % W; for (let y = top + 16; y < ground; y += 2) s.px(x, y, color); }
    };
    switch (theme) {
      case "hem": case "night": {
        ribs(coal);
        hills(mixInt(colorInt("pine"), ink, 0.5), ground - 18, 6, 0.05);
        hills(colorInt("pine"), ground - 8, 4, 0.09);
        farLines(mixInt(colorInt("bone"), ink, 0.7), 7);
        s.dither(0, ground, W, 30, "moss", "pine");
        break;
      }
      case "slat": case "indoor": {
        ribs(coal);
        // One roof, forty miles: slats across the middle distance
        for (let x = 0; x < W; x += 2) for (let y = ground - 22; y < ground - 4; y++) s.px(x, y, mixInt(colorInt("clay"), ink, 0.6));
        s.hline(ground - 23, 0, W - 1, colorInt("rust"));
        farLines(mixInt(colorInt("bone"), ink, 0.65), 9);
        s.dither(0, ground, W, 30, "olive", "moss");
        break;
      }
      case "snarl": {
        ribs(mixInt(colorInt("plum"), ink, 0.4));
        // The mat: every line leans to one point above the center
        const cx = W / 2, cy = top - 30;
        for (let i = 0; i < 24; i++) { const x = (i * 9 + seed % 9) % W; s.line(x, ground, Math.round(cx), cy, mixInt(colorInt("rose"), ink, 0.7)); }
        s.dither(0, ground, W, 30, "plum", "ink");
        s.hline(ground, 0, W - 1, colorInt("brick"));
        break;
      }
      case "letout": {
        ribs(coal);
        // The net, and the Spindle behind it
        for (let y = ground - 26; y < ground; y += 4) s.hline(y, 0, W - 1, mixInt(colorInt("clay"), ink, 0.55));
        for (let x = 0; x < W; x += 5) for (let y = ground - 26; y < ground; y++) s.px(x, y, mixInt(colorInt("clay"), ink, 0.55));
        s.rect(W / 2 - 6, top + 14, 12, ground - top - 14, mixInt(slate, ink, 0.3));
        for (let y = top + 16; y < ground; y += 3) s.hline(y, W / 2 - 5, W / 2 + 4, mixInt(colorInt("gold"), ink, 0.6));
        s.dither(0, ground, W, 30, "clay", "sand");
        break;
      }
      case "steppe": {
        ribs(coal);
        hills(mixInt(colorInt("olive"), ink, 0.5), ground - 10, 3, 0.03);
        // Pendulum people far off, leaning the same way
        for (let i = 0; i < 8; i++) { const x = (seed * (i + 2) * 17) % W; s.line(x, ground - 2, x + 6, top + 16, mixInt(colorInt("bone"), ink, 0.65)); }
        s.dither(0, ground, W, 30, "sand", "olive");
        break;
      }
      case "under": case "stays": {
        // Black water. Ripples. In the Stays, the cable.
        s.rect(0, top, W, ground - top, colorInt("black"));
        for (let y = top + 10; y < ground; y += 6) for (let x = 0; x < W; x++) if (((x + y * 3 + seed) >> 2) % 5 === 0) s.px(x, y + ((x >> 3) & 1), mixInt(colorInt("sea"), ink, 0.5));
        if (theme === "stays") { s.rect(W / 2 - 10, top, 20, ground - top, mixInt(slate, ink, 0.2)); for (let y = top; y < ground; y += 2) s.px(W / 2 - 8 + (y % 16), y, colorInt("teal")); }
        s.dither(0, ground, W, 30, "coal", "ink");
        break;
      }
      case "loft": {
        // The deck: grass, rods in holders, a chair the size of a house
        s.gradient(0, top, W, ground - top, "ink", "indigo");
        s.rect(W / 2 + 40, top + 20, 50, ground - top - 20, mixInt(colorInt("indigo"), ink, 0.4));
        s.rect(W / 2 + 40, top + 20, 6, ground - top - 20, mixInt(colorInt("frost"), ink, 0.6));
        for (let i = 0; i < 5; i++) { const x = 20 + i * 36; s.vline(x, top + 10, ground, mixInt(colorInt("frost"), ink, 0.5)); s.px(x, top + 10, colorInt("gold")); }
        s.dither(0, ground, W, 30, "moss", "frost");
        break;
      }
      default: {
        ribs(coal);
        s.dither(0, ground, W, 30, "slate", "coal");
      }
    }
    if (this.s.mech.allSlack) s.tint(0, top, W, H - top, "blood", 0.08);
  }

  private drawStrip(s: Screen): void {
    s.rect(0, 0, W, 14, "coal");
    s.hline(14, 0, W - 1, colorInt("slate"));
    const list = upcoming(this.s, 9);
    let x = 3;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.id === "wind") {
        // The push for next round: an arrow, or the still wind
        const w = this.s.windNext;
        const glyph = w === 0 ? "wind" : w < 0 ? "left" : "right";
        const col = this.pushName() === "current" ? "sea" : "sky";
        s.sprite(getSprite("shape", glyph, glyph), x, STRIP_Y + 1, w === 0 ? "slate" : col, col);
        x += 14;
        continue;
      }
      const c = this.s.combatants.find((k) => k.id === u.id);
      if (!c) continue;
      const cells = getSprite(c.sprite.kind, c.sprite.seed, c.sprite.variant);
      if (i === 0) s.rect(x - 1, STRIP_Y - 1, 10, 12, "slate");
      s.sprite(cells, x, STRIP_Y + 1, c.sprite.a, c.sprite.b);
      if (c.side === "enemy") s.rect(x, STRIP_Y + 10, 8, 1, "blood");
      x += 14;
    }
    // Preview: where the current actor would land with the hovered command
    if (this.actor && this.phase !== "anim" && this.phase !== "result") {
      const weight = this.previewWeight();
      const t = previewTempo(this.s, this.actor, weight);
      const idx = list.findIndex((u) => u.tempo > t && u.id !== this.actor!.id);
      const px = idx < 0 ? x : 3 + idx * 14 - 3;
      s.text("↓", px, STRIP_Y - 1, "gold");
    }
    // The Bite meter: a two pixel seam under the strip that widens as the field hums, with a jaw at its end
    const bw = Math.round((W - 12) * (this.s.bite / 100));
    s.hline(14, 0, W - 1, colorInt("slate"));
    if (bw > 0) {
      const hot = this.s.bite > 70;
      const col = hot && Math.floor(this.time * 6) % 2 === 0 ? colorInt("blood") : colorInt("sea");
      s.hline(14, 2, 2 + bw, col);
      s.hline(15, 2, 2 + bw, mixInt(col, PALETTE_INT.black, 0.4));
      s.sprite(getSprite("shape", "jaw", "jaw"), 2 + bw, 15, hot ? "blood" : "sea", hot ? "white" : "frost");
    }
    // Phrase
    if (this.s.mech.notes) {
      const px = W - 44;
      s.rect(px - 2, 0, 46, 14, "ink");
      s.sprite(getSprite("shape", "note", "note"), px, 3, "gold", "gold");
      for (let i = 0; i < 3; i++) {
        const n = this.s.phrase[i];
        s.frame(px + 10 + i * 10, 2, 9, 10, "slate");
        if (n) s.text(n, px + 13 + i * 10, 4, "gold");
      }
    }
  }

  private previewWeight(): number {
    if (this.phase === "command") {
      const cmd = this.commands[this.cmdCursor.index];
      if (cmd === "Hang" || cmd === "Duck") return 0.5;
      if (cmd === "Untie") return 0.4;
      return 1;
    }
    if (this.pending?.skill) return this.pending.skill.weight ?? 1;
    const it = this.list[this.listCursor.index];
    if (it?.skill) return it.skill.weight ?? 1;
    if (it?.knot !== undefined) return 0.4;
    return 1;
  }

  private drawCombatantLine(s: Screen, c: Combatant): void {
    if (!c.alive || c.taken) return;
    const p = this.pos(c);
    const held = c.held && !c.letGo && !c.reheld;
    if (c.lifted > 0) return;
    if (held || c.reheld) {
      const col = c.reheld ? colorInt("blood") : c.side === "party" ? mixInt(colorInt("bone"), PALETTE_INT.ink, 0.3) : mixInt(colorInt("ash"), PALETTE_INT.ink, 0.35);
      const pl = this.pluckT.get(c.id) ?? 0;
      const top = 15;
      for (let y = p.y - 9; y >= top; y--) {
        const dx = pl > 0 ? Math.round(Math.sin((p.y - y) * 0.5 + this.time * 50) * pl * 3) : 0;
        s.px(p.x + dx, y, pl > 0 ? colorInt("white") : col);
      }
      // Tension pips on the line
      const mt = maxTension(c);
      for (let i = 0; i < mt; i++) {
        const y = p.y - 13 - i * 4;
        const on = i < c.tension;
        const near = c.tension >= liftThreshold(c) - 1 && on && this.s.mech.lift;
        s.rect(p.x - 1, y, 3, 2, on ? (near ? "blood" : "gold") : "slate");
      }
      if (c.note && this.s.mech.notes && c.side === "enemy") s.text(c.note, p.x + 3, p.y - 18, "gold");
    } else if (c.economy === "length") {
      // The coil of fallen line at Fathom's feet
      s.sprite(getSprite("tile", "0", "coil"), p.x + 5, p.y + 2, "teal", "bone");
    } else if (c.letGo) {
      // A limp line pooling on the ground
      s.hline(p.y + 8, p.x - 6, p.x + 6, mixInt(colorInt("bone"), PALETTE_INT.ink, 0.4));
    }
  }

  private drawTangle(s: Screen, c: Combatant): void {
    if (!c.tangledWith || !c.alive) return;
    const o = this.s.combatants.find((x) => x.id === c.tangledWith);
    if (!o || !o.alive || o.id < c.id) return;
    const a = this.pos(c), b = this.pos(o);
    const col = colorInt("rose");
    const mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) - 4;
    s.line(a.x, a.y - 8, Math.round(mx), Math.round(my), col);
    s.line(Math.round(mx), Math.round(my), b.x, b.y - 8, col);
    // Reef lines are teal
    const reef = has(c, "reef");
    if (reef) s.line(a.x, a.y - 6, b.x, b.y - 6, colorInt("teal"));
  }

  private drawCombatant(s: Screen, c: Combatant): void {
    if (c.taken) return;
    const p = this.pos(c);
    const cells: Cells = getSprite(c.sprite.kind, c.sprite.seed, c.sprite.variant);
    const fl = this.flashes.get(c.id);
    const bob = this.actor?.id === c.id && c.side === "party" ? Math.round(Math.sin(this.time * 8)) : 0;
    let y = p.y - 8 + bob;
    if (c.lifted > 0) y = 16;
    if (c.climbing) {
      const t = this.s.combatants.find((x) => x.id === c.climbing);
      if (t) { const tp = this.pos(t); s.sprite(cells, tp.x - 4, 18, c.sprite.a, c.sprite.b); return; }
    }
    if (!c.alive) {
      // Fallen: drawn flat and dim
      s.spriteDim(cells, p.x - 4, y + 3, c.sprite.a, c.sprite.b, 0.6);
      return;
    }
    const tint = fl ? fl.color : c.reheld ? colorInt("blood") : undefined;
    const isTarget = (this.phase === "target" || this.phase === "target2") && this.targetList[this.targetIndex]?.id === c.id;
    // Shadow on the ground, so sprites sit on it
    s.hline(y + (c.boss ? 16 : 8), p.x - (c.boss ? 6 : 3), p.x + (c.boss ? 6 : 3), mixInt(PALETTE_INT.black, colorInt("ink"), 0.4));
    if (c.boss) s.spriteN(getLarge(c.sprite.kind, c.sprite.seed, c.sprite.variant), 16, p.x - 8, y - 8, c.sprite.a, c.sprite.b, { tint, flip: false });
    else s.sprite(cells, p.x - 4, y, c.sprite.a, c.sprite.b, { tint, flip: c.side === "party" ? false : true });
    if (c.enraged) s.text("!!", p.x + 10, y - 4, "blood");
    if (has(c, "guard")) s.frame(p.x - 5, y - 1, 10, 10, "sky");
    if (has(c, "duck")) s.text("v", p.x - 2, y + 9, "mint");
    if (has(c, "shield")) s.frame(p.x - 6, y - 2, 12, 12, "teal");
    if (has(c, "down")) s.text("x", p.x + 5, y + 6, "orange");
    if (has(c, "charge") || c.charging) this.drawLocks(s, c, p.x, y - (c.boss ? 18 : 10));
    if (c.side === "enemy") {
      // Name and HP under the sprite
      const hpw = this.s.mech.lanes && !c.boss ? 16 : 24;
      const hy = y + (c.boss ? 18 : 10);
      s.rect(p.x - hpw / 2, hy, hpw, 2, "coal");
      s.rect(p.x - hpw / 2, hy, Math.round((hpw * c.hp) / c.maxHp), 2, c.hp < c.maxHp * 0.3 ? "blood" : "leaf");
      if (isTarget || (this.actor?.side === "party" && this.phase !== "target" && this.phase !== "target2")) {
        // Only label a foe whose name fits between it and its neighbors; while targeting, only the target is labeled
        const gaps = enemies(this.s).filter((o) => o.id !== c.id && o.alive && !o.taken).map((o) => Math.abs(this.pos(o).x - p.x));
        const room = gaps.length ? Math.min(...gaps) : W;
        const nm = c.name.length > 14 ? c.name.slice(0, 14) : c.name;
        if (isTarget || s.textWidth(nm) + 2 <= room) s.textCenter(nm, p.x, hy + 3, isTarget ? "gold" : "bone");
      }
      // Revealed weaknesses
      const rev = c.revealed.filter((e) => c.weak.includes(e));
      rev.forEach((el, i) => s.sprite(getSprite("shape", el, el), p.x - 12 + i * 9, hy + 10, "orange", "gold"));
      if (!c.held && c.economy === "slack") s.text("○", p.x - 1, y - 7, "ash");
    }
    if (isTarget) {
      s.sprite(getSprite("shape", "cursor", "down"), p.x - 4, y - (c.boss ? 19 : 11) - Math.round(Math.sin(this.time * 6) * 2), "gold", "gold");
    }
    if (c.lifted > 0) s.text("↑", p.x - 1, y - 6, "frost");
  }

  private drawLocks(s: Screen, c: Combatant, x: number, y: number): void {
    if (!c.charging) return;
    const locks = c.charging.locks;
    const w = locks.length * 9;
    // Whole pixels only: a fractional x draws nothing
    const x0 = Math.round(x - w / 2);
    s.rect(x0 - 1, y - 1, w + 2, 10, "coal");
    locks.forEach((l: LockIcon, i) => {
      const matched = c.charging!.matched[i];
      s.sprite(getSprite("shape", l, matched ? "check" : l), x0 + i * 9, y, matched ? "mint" : "orange", matched ? "mint" : "gold");
    });
    if (!this.s.mech.locks) s.text("!", x0 + w + 2, y + 1, "orange");
  }

  private drawPanel(s: Screen): void {
    s.rect(0, PANEL_Y - 2, W, CMD_Y - PANEL_Y + 2, "ink");
    s.hline(PANEL_Y - 2, 0, W - 1, colorInt("slate"));
    const ps = party(this.s);
    ps.forEach((c, i) => {
      const y = PANEL_Y + i * 10;
      const active = this.actor?.id === c.id;
      if (active) s.rect(0, y - 1, W, 10, "slate");
      s.text(c.name, 3, y, !c.alive ? "ash" : c.reheld ? "blood" : active ? "gold" : "white");
      // HP bar
      const bx = 40, bw = 44;
      s.rect(bx, y + 1, bw, 5, "coal");
      const frac = c.hp / c.maxHp;
      s.rect(bx, y + 1, Math.round(bw * frac), 5, frac < 0.3 ? "blood" : frac < 0.6 ? "amber" : "leaf");
      s.textRight(`${c.hp}`, bx + bw + 16, y, "bone");
      // Resource
      const rx = 110;
      if (c.economy === "tension" && !c.letGo) {
        const mt = maxTension(c);
        for (let k = 0; k < mt; k++) s.rect(rx + k * 5, y + 1, 4, 5, k < c.tension ? (c.tension >= liftThreshold(c) - 1 && this.s.mech.lift ? "blood" : "gold") : "coal");
        // A notch over the pip where the Reel takes the line up
        const lt = liftThreshold(c);
        if (this.s.mech.lift && c.held && lt <= mt) s.hline(y, rx + (lt - 1) * 5, rx + (lt - 1) * 5 + 3, colorInt("frost"));
      } else if (c.economy === "length") {
        s.text(`${c.pool}/${c.maxPool} fm`, rx, y, "teal");
      } else {
        for (let k = 0; k < c.maxPool; k++) s.rect(rx + k * 5, y + 1, 4, 5, k < c.pool ? "mint" : "coal");
      }
      // Statuses
      // Whole words only: as many as fit, then a count of the rest
      const words = [c.lifted > 0 ? "up" : "", c.climbing ? "climb" : "", c.letGo ? "slack" : "", c.tangledWith ? "tangle" : ""].filter(Boolean);
      for (const x of c.statuses) if (!["guard", "duck", "charge"].includes(x.id)) words.push(STATUS_LABEL[x.id] ?? x.id);
      let out = "", shown = 0;
      for (const w of words) { const next = out ? `${out} ${w}` : w; if (next.length > 15) break; out = next; shown++; }
      if (shown < words.length) out += ` +${words.length - shown}`;
      s.text(out, 150, y, c.reheld ? "blood" : "lilac");
    });
  }

  private drawCommand(s: Screen): void {
    drawBox(s, 0, CMD_Y, W, H - CMD_Y);
    if (this.phase === "anim" || this.phase === "idle" || this.phase === "result" || !this.actor) {
      if (this.actor && this.actor.side === "enemy") s.text(`${this.actor.name} acts.`, 6, CMD_Y + 5, "bone");
      return;
    }
    const actor = this.actor;
    const left = 6, top = CMD_Y + 4;
    const open = this.openLocks();
    if (this.phase === "command") {
      this.commands.forEach((cmd, i) => {
        const col = Math.floor(i / 4), row = i % 4;
        const x = left + col * 64, y = top + row * 10;
        if (i === this.cmdCursor.index) s.text("▶", x - 1, y, "gold");
        s.text(cmd, x + 8, y, i === this.cmdCursor.index ? "white" : "bone");
        if (this.commandAnswers(actor, cmd, open)) this.answerMark(s, x + 10 + s.textWidth(cmd), y);
      });
      const cmd = this.commands[this.cmdCursor.index];
      const reheld = party(this.s).some((p) => p.reheld && p.alive);
      let help = cmd === "Attack" && reheld ? "A plain hit. Hit a re-held ally to free them. They are last in the target list." : COMMANDS_HELP[cmd] ?? "";
      if (this.commandAnswers(actor, cmd, open)) help = `Answers an open lock. ${help}`;
      this.helpText(s, help, 134, top);
    } else if (["skills", "knots", "untie", "items", "pairs"].includes(this.phase)) {
      const cur = this.listCursor;
      cur.clamp();
      const vis = this.list.slice(cur.top, cur.top + 4);
      vis.forEach((it, i) => {
        const idx = cur.top + i;
        const y = top + i * 10;
        if (idx === cur.index) s.text("▶", left - 1, y, "gold");
        let label = it.label;
        if (it.skill) label += it.skill.cost > 0 ? ` ${it.skill.cost}` : "";
        label = label.slice(0, 22);
        s.text(label, left + 8, y, !it.afford ? "ash" : idx === cur.index ? "white" : "bone");
        if (it.afford && this.answers(this.listLock(it), open)) this.answerMark(s, left + 10 + s.textWidth(label), y);
      });
      if (this.list.length > 4) s.text(cur.top > 0 ? "↑" : " ", 112, top, "ash"), s.text(cur.top + 4 < this.list.length ? "↓" : " ", 112, top + 30, "ash");
      const it = this.list[cur.index];
      if (it) this.helpText(s, it.afford && this.answers(this.listLock(it), open) ? `Answers an open lock. ${it.sub}` : it.sub, 122, top);
      if (!this.list.length) s.text("Nothing here.", left + 8, top, "ash");
    } else if (this.phase === "target" || this.phase === "target2") {
      const t = this.targetList[this.targetIndex];
      s.text(this.phase === "target2" ? "And the second target:" : "Choose a target.", left, top, "bone");
      if (t) {
        s.text(t.name, left, top + 10, "gold");
        const d = ENEMIES[t.defId];
        const about = d ? d.about : MEMBERS[t.defId]?.title ?? "";
        this.helpText(s, about, left, top + 20, W - 12);
      }
    } else if (this.phase === "note") {
      s.text("Tune the line to:", left, top, "bone");
      NOTE_NAMES.forEach((n, i) => s.text(n, left + 8 + i * 14, top + 9, i === this.listCursor.index ? "gold" : "bone"));
      s.text("▶", left + 1 + this.listCursor.index * 14, top + 9, "gold");
      const phrase = this.s.phrase.join(" ");
      s.text(`Phrase so far: ${phrase || "none"}`, left, top + 18, "lilac");
      s.text("Major C E G   Minor A C E   Dim B D F", left, top + 27, "ash");
      s.text("Sus C F G   Aug C E G#", left, top + 34, "ash");
    } else if (this.phase === "wind") {
      s.text(`Set the ${this.pushName()} for next round:`, left, top, "bone");
      ["Left", "Still", "Right"].forEach((n, i) => s.text(n, left + 8 + i * 40, top + 12, i === this.listCursor.index ? "gold" : "bone"));
      s.text("▶", left + 1 + this.listCursor.index * 40, top + 12, "gold");
    }
  }

  private listLock(it: BattleScene["list"][number]): string | undefined {
    return it.skill?.lock ?? it.pair?.skill.lock ?? this.itemLock(it.item);
  }

  /** A small green diamond beside a command or skill that answers an open lock. */
  private answerMark(s: Screen, x: number, y: number): void {
    const c = colorInt("mint");
    s.px(x + 1, y + 1, c);
    s.rect(x, y + 2, 3, 1, c);
    s.px(x + 1, y + 3, c);
  }

  private helpText(s: Screen, text: string, x: number, y: number, width = W - x - 6): void {
    const maxChars = Math.floor(width / 4);
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      if (line.length + w.length + 1 > maxChars && line) { lines.push(line); line = w; }
      else line = line ? line + " " + w : w;
    }
    if (line) lines.push(line);
    lines.slice(0, 5).forEach((l, i) => s.text(l, x, y + i * 7, "bone"));
  }

  private drawResult(s: Screen): void {
    const lines = this.resultLines.flatMap((l, i) => wrap(l, W - 44).map((w) => ({ w, first: i === 0 })));
    const h = Math.min(H - 40, lines.length * 8 + 22);
    const y = Math.floor((H - h) / 2) - 10;
    drawBox(s, 16, y, W - 32, h);
    lines.slice(0, Math.floor((h - 18) / 8)).forEach((l, i) => s.text(l.w, 22, y + 6 + i * 8, l.first ? "gold" : "white"));
    if (Math.floor(this.time * 3) % 2 === 0) s.text("▶", W - 28, y + h - 9, "gold");
  }

  private drawHandUi(s: Screen): void {
    const icons: ("tug" | "steady" | "pinch")[] = ["tug", "steady", "pinch"];
    const glyph = { tug: "up", steady: "lock", pinch: "pluck" };
    icons.forEach((k, i) => {
      const x = W - 12, y = ENEMY_TOP + i * 12;
      const cd = this.s.hand[k];
      s.rect(x - 1, y - 1, 10, 10, this.handPick === k ? "frost" : "coal");
      s.sprite(getSprite("shape", glyph[k], glyph[k]), x, y, cd > 0 ? "slate" : "frost", cd > 0 ? "slate" : "white");
      if (cd > 0) s.text(`${cd}`, x - 5, y + 1, "ash");
    });
    if (this.hover) {
      const lines = this.hover.text.length > 50 ? [this.hover.text.slice(0, 50), this.hover.text.slice(50, 100)] : [this.hover.text];
      const tw = Math.min(W - 8, Math.max(...lines.map((l) => s.textWidth(l))) + 8);
      const hx = Math.max(2, Math.min(W - tw - 2, this.hover.x - tw / 2));
      const hy = this.hover.y > 60 ? this.hover.y - 10 - lines.length * 7 : this.hover.y + 12;
      drawBox(s, Math.round(hx), hy, tw, lines.length * 7 + 6);
      lines.forEach((l, i) => s.text(l, Math.round(hx) + 4, hy + 3 + i * 7, "white"));
    }
  }

  /** The Hand cursor, drawn by the game on top. */
  wantsPointer(): boolean {
    return this.host.twoPlayer();
  }

  get lanes(): Lane[] {
    return [0, 1, 2];
  }
}
