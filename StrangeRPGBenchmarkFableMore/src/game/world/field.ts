import type { Input } from "../../engine/input";
import { type Screen, W, H, TILE, COLS, ROWS } from "../../engine/screen";
import type { Scene } from "../../engine/scene";
import { getSprite } from "../../engine/sprites";
import { colorInt, mixInt, PALETTE_INT, type ColorName } from "../../engine/palette";
import { Rng, hash } from "../../engine/rng";
import type { Audio, NoteName } from "../../engine/audio";
import { GameMap, type MapDef, type Facing, type NpcDef, type WanderDef, type FieldFx } from "./map";
import type { GameState } from "../state";
import { MEMBERS } from "../data/members";
import { GROUP_BY_ID, ENEMIES } from "../data/enemies";
import type { SpriteRef } from "../types";
import { FONT_H } from "../../engine/fontdata";
import { drawBox } from "../../engine/dialogue";

/** What the field needs from the game. */
export interface FieldHost {
  g: GameState;
  audio: Audio;
  /** Run a trigger or talk script. The field waits for it. */
  runScript(id: string): Promise<void>;
  /** A wandering enemy was touched. */
  encounter(groupId: string, instant: boolean): Promise<void>;
  openMenu(): Promise<void>;
  changeMap(to: string, x: number, y: number, facing?: Facing): Promise<void>;
  /** Flag lookup for showIf and hideIf. */
  has(flag: string): boolean;
  goalText(): string;
  /** Called after every step for autosave and counters. */
  onStep(): void;
  openChest(id: string, item: string, count: number, slugs: number): Promise<void>;
  twoPlayer(): boolean;
  /** Member ids that follow Fathom. */
  followers(): string[];
  isSlack(): boolean;
}

interface Mover {
  x: number;
  y: number;
  /** Pixel offsets while moving between tiles. */
  px: number;
  py: number;
  facing: Facing;
  moving: boolean;
  from: { x: number; y: number };
  t: number;
  sprite: SpriteRef;
  held: boolean;
}

interface FieldEnemy extends Mover {
  def: WanderDef;
  group: string;
  timer: number;
  frozen: number;
  fleeing: boolean;
  dead: boolean;
}

interface Npc extends Mover {
  def: NpcDef;
  timer: number;
}

const STEP_TIME = 0.16;
const RUN_TIME = 0.09;

const DIRS: Record<Facing, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * The field: a scrolling tile map with the party, people, wandering enemies,
 * and lines rising from every held thing to the top of the screen.
 */
export class FieldScene implements Scene {
  opaque = true;
  map: GameMap;
  private player: Mover;
  private trail: { x: number; y: number; facing: Facing }[] = [];
  private npcs: Npc[] = [];
  private enemies: FieldEnemy[] = [];
  private camX = 0;
  private camY = 0;
  private busy = false;
  private time = 0;
  private rng: Rng;
  private shakeT = 0;
  private flashT = 0;
  private toast: { lines: string[]; t: number } | null = null;
  private goalShown = false;
  private firedOnce = new Set<string>();
  private hoverName: { text: string; x: number; y: number; t: number } | null = null;
  private stepSound = 0;
  /** Script-driven movers walk with this queue. */
  private scriptMoves: { who: Mover; steps: Facing[]; run: boolean; resolve: () => void } | null = null;
  /** True while the page is showing a dialogue so lines should dim. */
  dimmed = false;
  /** Effects on tiles. A crack stays until the map unloads. */
  private fxList: { kind: FieldFx; x: number; y: number; t: number }[] = [];

  constructor(private host: FieldHost, def: MapDef, x: number, y: number, facing: Facing) {
    this.map = new GameMap(def);
    this.rng = new Rng(hash(def.id) ^ host.g.seed);
    this.player = this.mover(x, y, facing, MEMBERS.fathom.sprite, !host.isSlack());
    this.trail = [];
    for (let i = 0; i < 6; i++) this.trail.push({ x, y, facing });
    this.spawnNpcs();
    this.spawnEnemies();
    for (const m of def.marks ?? []) if (!m.showIf || host.has(m.showIf)) this.fxList.push({ kind: m.kind, x: m.x, y: m.y, t: 9 });
    this.centerCamera(true);
    this.firedOnce = new Set(((host.g.flags[`fired:${def.id}`] as string) ?? "").split(",").filter(Boolean));
  }

  private mover(x: number, y: number, facing: Facing, sprite: SpriteRef, held: boolean): Mover {
    return { x, y, px: 0, py: 0, facing, moving: false, from: { x, y }, t: 0, sprite, held };
  }

  get def(): MapDef {
    return this.map.def;
  }

  refresh(): void {
    this.player.held = !this.host.isSlack();
    this.player.sprite = this.host.isSlack() ? MEMBERS.fathom.sprite : { ...MEMBERS.fathom.sprite, variant: "" };
    this.spawnNpcs(true);
  }

  private spawnNpcs(keepPositions = false): void {
    const old = new Map(this.npcs.map((n) => [n.def.id, n]));
    this.npcs = [];
    for (const d of this.def.npcs) {
      if (d.showIf && !this.host.has(d.showIf)) continue;
      if (d.hideIf && this.host.has(d.hideIf)) continue;
      const prev = keepPositions ? old.get(d.id) : undefined;
      const n: Npc = { ...this.mover(prev?.x ?? d.x, prev?.y ?? d.y, d.facing ?? "down", d.sprite, d.held ?? true), def: d, timer: this.rng.next() * 2 };
      this.npcs.push(n);
      // A scripted walk in progress follows the npc across a refresh
      if (this.scriptMoves && prev && this.scriptMoves.who === prev) this.scriptMoves.who = n;
    }
  }

  private spawnEnemies(): void {
    this.enemies = [];
    // Enemies beaten on this map stay gone until the party rests
    let budget = (this.def.wander ?? []).reduce((a, w) => a + w.count, 0) - (this.host.g.cleared[this.def.id] ?? 0);
    for (const w of this.def.wander ?? []) {
      if (w.hideIf && this.host.has(w.hideIf)) continue;
      const n = Math.max(0, Math.min(w.count, budget));
      budget -= n;
      for (let i = 0; i < n; i++) {
        let x = w.x + this.rng.int(w.w), y = w.y + this.rng.int(w.h);
        for (let tries = 0; tries < 20 && (!this.map.walkable(x, y, false) || (Math.abs(x - this.player.x) + Math.abs(y - this.player.y)) < 4); tries++) {
          x = w.x + this.rng.int(w.w);
          y = w.y + this.rng.int(w.h);
        }
        const group = w.groups[this.rng.int(w.groups.length)];
        const gdef = GROUP_BY_ID[group];
        const first = gdef ? ENEMIES[gdef.enemies[0]] : undefined;
        const e: FieldEnemy = { ...this.mover(x, y, "down", first ? first.sprite : w.sprite, !!first?.held), def: w, group, timer: this.rng.next() * 1.5, frozen: 0, fleeing: false, dead: false };
        this.enemies.push(e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Script API

  playerPos(): { x: number; y: number; facing: Facing } {
    return { x: this.player.x, y: this.player.y, facing: this.player.facing };
  }

  setPlayer(x: number, y: number, facing?: Facing): void {
    this.player.x = x;
    this.player.y = y;
    this.player.moving = false;
    this.player.px = this.player.py = 0;
    if (facing) this.player.facing = facing;
    this.trail = [];
    for (let i = 0; i < 6; i++) this.trail.push({ x, y, facing: this.player.facing });
    this.centerCamera(true);
  }

  setBusy(b: boolean): void {
    this.busy = b;
  }

  walk(who: string, steps: Facing[], run = false): Promise<void> {
    const m = who === "player" || who === "fathom" ? this.player : this.npcs.find((n) => n.def.id === who);
    if (!m) return Promise.resolve();
    return new Promise((resolve) => {
      this.scriptMoves = { who: m, steps: [...steps], run, resolve };
    });
  }

  face(who: string, facing: Facing): void {
    const m = who === "player" || who === "fathom" ? this.player : this.npcs.find((n) => n.def.id === who);
    if (m) m.facing = facing;
  }

  moveNpc(id: string, x: number, y: number): void {
    const n = this.npcs.find((p) => p.def.id === id);
    if (n) {
      n.x = x;
      n.y = y;
      n.moving = false;
    }
  }

  shake(): void {
    this.shakeT = 0.4;
  }
  flash(): void {
    this.flashT = 0.25;
  }
  showToast(text: string): void {
    const lines = wrapText(text, 50).slice(0, 3);
    this.toast = { lines, t: 2.8 + (lines.length - 1) * 0.8 };
  }

  /** Start an effect on a tile. Returns how many seconds its main motion takes. */
  fx(kind: FieldFx, x: number, y: number): number {
    this.fxList.push({ kind, x, y, t: 0 });
    return kind === "crack" ? 0.7 : kind === "fall" ? 0.5 : kind === "rings" ? 1 : 0.8;
  }

  /** Wobble an npc's line, as if plucked. */
  pluckNpc(id: string, strength = 0.5): void {
    const n = this.npcs.find((p) => p.def.id === id);
    if (n) (n as unknown as { pluckT: number }).pluckT = strength;
  }
  removeEnemiesNear(x: number, y: number): void {
    for (const e of this.enemies) if (Math.abs(e.x - x) + Math.abs(e.y - y) <= 1) e.dead = true;
  }

  // -------------------------------------------------------------------------
  // Update

  update(dt: number, input: Input): void {
    this.time += dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    for (const f of this.fxList) f.t += dt;
    this.fxList = this.fxList.filter((f) => f.kind === "crack" || f.t < 1.4);
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.hoverName) { this.hoverName.t -= dt; if (this.hoverName.t <= 0) this.hoverName = null; }
    this.goalShown = input.held("goal");
    // Script walking
    if (this.scriptMoves) {
      const sm = this.scriptMoves;
      this.advance(sm.who, dt, sm.run ? RUN_TIME : STEP_TIME, sm.who === this.player);
      if (!sm.who.moving) {
        const step = sm.steps.shift();
        if (step === undefined) {
          this.scriptMoves = null;
          sm.resolve();
        } else {
          sm.who.facing = step;
          const [dx, dy] = DIRS[step];
          this.beginMove(sm.who, sm.who.x + dx, sm.who.y + dy, true);
        }
      }
    }
    this.updateNpcs(dt);
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.updateHand(input);
    if (this.busy || this.scriptMoves) {
      this.centerCamera(false, dt);
      return;
    }
    // Player
    const run = input.held("run");
    this.advance(this.player, dt, run ? RUN_TIME : STEP_TIME, true);
    if (!this.player.moving) {
      if (input.pressed("menu")) {
        input.consume("menu");
        this.busy = true;
        void this.host.openMenu().then(() => (this.busy = false));
        return;
      }
      if (input.pressed("ok")) {
        input.consume("ok");
        void this.interact();
        return;
      }
      const dx = input.dirX(), dy = input.dirY();
      if (dx !== 0 || dy !== 0) {
        const f: Facing = dx !== 0 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        this.player.facing = f;
        const nx = this.player.x + (dx !== 0 ? dx : 0);
        const ny = this.player.y + (dx !== 0 ? 0 : dy);
        if (this.canEnter(nx, ny, true)) {
          this.beginMove(this.player, nx, ny, false);
        } else if (dx !== 0 && dy !== 0 && this.canEnter(this.player.x, this.player.y + dy, true)) {
          this.player.facing = dy > 0 ? "down" : "up";
          this.beginMove(this.player, this.player.x, this.player.y + dy, false);
        }
      }
    }
    this.centerCamera(false, dt);
  }

  private canEnter(x: number, y: number, isPlayer: boolean): boolean {
    // A door is a wall unless an exit goes through it. Nothing wandering steps onto a still spot.
    if (this.map.code(x, y) === "D" && !(isPlayer && this.exitAt(x, y))) return false;
    if (!isPlayer && this.map.code(x, y) === "V") return false;
    if (!this.map.walkable(x, y, isPlayer ? this.host.isSlack() || !this.player.held : false)) {
      // Held party members cannot go under. Fathom can only when slack.
      if (isPlayer && this.map.spec(x, y).slackOnly && this.map.spec(x, y).walk && this.host.isSlack()) return !this.blockedBy(x, y);
      return false;
    }
    return !this.blockedBy(x, y);
  }

  private blockedBy(x: number, y: number): boolean {
    for (const n of this.npcs) if ((n.def.solid ?? true) && n.x === x && n.y === y) return true;
    for (const e of this.enemies) if (!e.dead && e.x === x && e.y === y) return true;
    if (this.player.x === x && this.player.y === y) return true;
    for (const c of this.def.chests ?? []) if (c.x === x && c.y === y && !this.host.g.opened.includes(c.id)) return true;
    return false;
  }

  private exitAt(x: number, y: number): boolean {
    return this.def.exits.some((ex) => x >= ex.x && x < ex.x + (ex.w ?? 1) && y >= ex.y && y < ex.y + (ex.h ?? 1));
  }

  private beginMove(m: Mover, nx: number, ny: number, scripted: boolean): void {
    m.from = { x: m.x, y: m.y };
    m.x = nx;
    m.y = ny;
    m.moving = true;
    m.t = 0;
    if (m === this.player) {
      this.trail.unshift({ x: m.from.x, y: m.from.y, facing: m.facing });
      if (this.trail.length > 8) this.trail.pop();
    }
    void scripted;
  }

  private advance(m: Mover, dt: number, stepTime: number, isPlayer: boolean): void {
    if (!m.moving) return;
    m.t += dt / stepTime;
    if (m.t >= 1) {
      m.t = 0;
      m.moving = false;
      m.px = m.py = 0;
      if (isPlayer && m === this.player) void this.arrived();
    } else {
      const k = 1 - m.t;
      m.px = Math.round((m.from.x - m.x) * TILE * k);
      m.py = Math.round((m.from.y - m.y) * TILE * k);
    }
  }

  private async arrived(): Promise<void> {
    this.host.onStep();
    this.stepSound++;
    if (this.stepSound % 2 === 0) this.host.audio.sfx("step");
    const p = this.player;
    // Exits
    for (const ex of this.def.exits) {
      const w = ex.w ?? 1, h = ex.h ?? 1;
      if (p.x >= ex.x && p.x < ex.x + w && p.y >= ex.y && p.y < ex.y + h) {
        if (ex.needs && !this.host.has(ex.needs)) {
          if (ex.blocked) { this.busy = true; await this.host.runScript(`__text:${ex.blocked}`); this.busy = false; }
          this.stepBack();
          return;
        }
        this.busy = true;
        await this.host.changeMap(ex.to, ex.tx, ex.ty, ex.facing ?? p.facing);
        return;
      }
    }
    if (await this.checkEnterTriggers()) return;
    // Enemies on the same tile
    for (const e of this.enemies) {
      if (!e.dead && e.x === p.x && e.y === p.y) {
        await this.touch(e);
        return;
      }
    }
  }

  /** Runs the first enter trigger under the player. Also called on arrival, so a trigger on an exit's landing tile fires. */
  async checkEnterTriggers(): Promise<boolean> {
    const p = this.player;
    for (const tr of this.def.triggers) {
      if (tr.on !== "enter") continue;
      if (tr.showIf && !this.host.has(tr.showIf)) continue;
      if (tr.hideIf && this.host.has(tr.hideIf)) continue;
      if (tr.once && this.firedOnce.has(tr.id)) continue;
      const w = tr.w ?? 1, h = tr.h ?? 1;
      if (p.x >= tr.x && p.x < tr.x + w && p.y >= tr.y && p.y < tr.y + h) {
        if (tr.once) this.markFired(tr.id);
        this.busy = true;
        await this.host.runScript(tr.id);
        this.busy = false;
        return true;
      }
    }
    return false;
  }

  private markFired(id: string): void {
    this.firedOnce.add(id);
    this.host.g.flags[`fired:${this.def.id}`] = Array.from(this.firedOnce).join(",");
  }

  private stepBack(): void {
    const p = this.player;
    const [dx, dy] = DIRS[p.facing];
    p.x -= dx;
    p.y -= dy;
  }

  private async touch(e: FieldEnemy): Promise<void> {
    e.dead = true;
    this.busy = true;
    await this.host.encounter(e.group, e.fleeing);
    this.host.g.cleared[this.def.id] = (this.host.g.cleared[this.def.id] ?? 0) + 1;
    // A breath after a fight: nothing nearby closes in for a moment
    for (const o of this.enemies) if (!o.dead && Math.abs(o.x - this.player.x) + Math.abs(o.y - this.player.y) <= 5) o.frozen = Math.max(o.frozen, 2.5);
    this.busy = false;
  }

  private async interact(): Promise<void> {
    const [dx, dy] = DIRS[this.player.facing];
    const tx = this.player.x + dx, ty = this.player.y + dy;
    // Talk
    for (const n of this.npcs) {
      if (n.x === tx && n.y === ty) {
        n.facing = opposite(this.player.facing);
        if (n.def.talk) {
          this.busy = true;
          await this.host.runScript(n.def.talk);
          this.busy = false;
        }
        return;
      }
    }
    // Chests
    for (const c of this.def.chests ?? []) {
      if (c.x === tx && c.y === ty && !this.host.g.opened.includes(c.id)) {
        this.busy = true;
        await this.host.openChest(c.id, c.item, c.count ?? 1, c.slugs ?? 0);
        this.busy = false;
        return;
      }
    }
    // Interact triggers at the facing tile or under the player
    for (const tr of this.def.triggers) {
      if (tr.on !== "interact") continue;
      if (tr.showIf && !this.host.has(tr.showIf)) continue;
      if (tr.hideIf && this.host.has(tr.hideIf)) continue;
      if (tr.once && this.firedOnce.has(tr.id)) continue;
      const w = tr.w ?? 1, h = tr.h ?? 1;
      const inside = (x: number, y: number) => x >= tr.x && x < tr.x + w && y >= tr.y && y < tr.y + h;
      if (inside(tx, ty) || inside(this.player.x, this.player.y)) {
        if (tr.once) this.markFired(tr.id);
        this.busy = true;
        await this.host.runScript(tr.id);
        this.busy = false;
        return;
      }
    }
    // Save points
    if (this.map.code(tx, ty) === "V" || this.map.code(this.player.x, this.player.y) === "V") {
      this.busy = true;
      await this.host.runScript("__save");
      this.busy = false;
    }
  }

  private updateNpcs(dt: number): void {
    for (const n of this.npcs) {
      this.advance(n, dt, STEP_TIME * 1.6, false);
      if (!n.def.wander || n.moving || this.busy) continue;
      // Stand still while the player is close, so a wanderer can be caught
      if (Math.abs(n.x - this.player.x) + Math.abs(n.y - this.player.y) <= 2) continue;
      n.timer -= dt;
      if (n.timer <= 0) {
        n.timer = 1.2 + this.rng.next() * 2.5;
        const f = (["up", "down", "left", "right"] as Facing[])[this.rng.int(4)];
        const [dx, dy] = DIRS[f];
        const nx = n.x + dx, ny = n.y + dy;
        if (Math.abs(nx - n.def.x) <= 2 && Math.abs(ny - n.def.y) <= 2 && this.canEnter(nx, ny, false) && !(nx === this.player.x && ny === this.player.y)) {
          n.facing = f;
          this.beginMove(n, nx, ny, false);
        } else n.facing = f;
      }
    }
  }

  private updateEnemies(dt: number): void {
    const avgLevel = this.host.g.active.reduce((a, id) => a + this.host.g.members[id].level, 0) / Math.max(1, this.host.g.active.length);
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.advance(e, dt, STEP_TIME * 1.3, false);
      if (e.frozen > 0) { e.frozen -= dt; continue; }
      if (e.moving || this.busy) continue;
      const gdef = GROUP_BY_ID[e.group];
      const lvl = gdef ? Math.max(...gdef.enemies.map((id) => ENEMIES[id]?.level ?? 1)) : 1;
      e.fleeing = avgLevel >= lvl + 4;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = e.fleeing ? 0.5 : 1.0 + this.rng.next() * 1.2;
        const dxp = this.player.x - e.x, dyp = this.player.y - e.y;
        const dist = Math.abs(dxp) + Math.abs(dyp);
        let f: Facing;
        if (e.fleeing && dist < 6) {
          f = Math.abs(dxp) > Math.abs(dyp) ? (dxp > 0 ? "left" : "right") : dyp > 0 ? "up" : "down";
        } else if (dist < 4 && this.rng.chance(0.5)) {
          f = Math.abs(dxp) > Math.abs(dyp) ? (dxp > 0 ? "right" : "left") : dyp > 0 ? "down" : "up";
        } else f = (["up", "down", "left", "right"] as Facing[])[this.rng.int(4)];
        const [dx, dy] = DIRS[f];
        const nx = e.x + dx, ny = e.y + dy;
        const inArea = nx >= e.def.x - 1 && nx < e.def.x + e.def.w + 1 && ny >= e.def.y - 1 && ny < e.def.y + e.def.h + 1;
        e.facing = f;
        if (nx === this.player.x && ny === this.player.y && !this.player.moving) {
          // A still spot is safe ground
          if (this.map.code(this.player.x, this.player.y) === "V") continue;
          void this.touch(e);
          return;
        }
        if (inArea && this.canEnter(nx, ny, false)) this.beginMove(e, nx, ny, false);
      }
    }
  }

  // Player two: the Hand. Hover shows names, click plucks a line or freezes an enemy.
  private updateHand(input: Input): void {
    if (!this.host.twoPlayer() || !input.pointer.over) return;
    const px = input.pointer.x + this.camX, py = input.pointer.y + this.camY;
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (input.pointer.clicks > 0) {
      // Anything whose line passes above the pointer counts: lines are vertical
      const held = [...this.npcs.filter((n) => n.held), ...(this.player.held ? [this.player] : [])];
      const hit = held.find((m) => m.x === tx && m.y <= ty) ?? held.find((m) => m.x === tx);
      const en = this.enemies.find((e) => !e.dead && e.x === tx && (e.y === ty || e.y <= ty));
      if (en) {
        en.frozen = 2.2;
        this.host.audio.sfx("hand");
        this.hoverName = { text: ENEMIES[GROUP_BY_ID[en.group]?.enemies[0] ?? ""]?.name ?? "something", x: en.x * TILE, y: en.y * TILE - 8, t: 1.2 };
      } else if (hit) {
        const npc = hit as Npc;
        const note = (npc.def?.note ?? "ABCDEFG"[hash(npc.def?.id ?? "fathom") % 7]) as NoteName;
        this.host.audio.playNote(note, 0, 0.5);
        const name = npc.def?.name ?? (hit === this.player ? "Fathom" : "someone");
        this.hoverName = { text: `${name} (${note})`, x: hit.x * TILE, y: hit.y * TILE - 8, t: 1.6 };
        (hit as unknown as { pluckT: number }).pluckT = 0.5;
      }
    }
  }

  private centerCamera(snap: boolean, dt = 0): void {
    const mw = this.map.w * TILE, mh = this.map.h * TILE;
    const tx = this.player.x * TILE + this.player.px + TILE / 2 - W / 2;
    const ty = this.player.y * TILE + this.player.py + TILE / 2 - H / 2;
    const cx = mw <= W ? -(W - mw) / 2 : Math.max(0, Math.min(mw - W, tx));
    const cy = mh <= H ? -(H - mh) / 2 : Math.max(0, Math.min(mh - H, ty));
    if (snap) { this.camX = cx; this.camY = cy; return; }
    const k = Math.min(1, dt * 10);
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    if (Math.abs(cx - this.camX) < 0.6) this.camX = cx;
    if (Math.abs(cy - this.camY) < 0.6) this.camY = cy;
  }

  // -------------------------------------------------------------------------
  // Draw

  draw(s: Screen): void {
    const ox = Math.round(this.camX) + (this.shakeT > 0 ? (Math.floor(this.time * 40) % 2 ? 2 : -2) : 0);
    const oy = Math.round(this.camY);
    const theme = this.map.theme;
    s.clear(theme.sky);
    const x0 = Math.floor(ox / TILE) - 1, y0 = Math.floor(oy / TILE) - 1;
    // The Hull: wherever the map ends, the underside of the sky shows
    if (theme.hull) {
      for (let ty = y0; ty <= y0 + ROWS + 2; ty++) {
        for (let tx = x0; tx <= x0 + COLS + 2; tx++) {
          const inside = tx >= 0 && ty >= 0 && tx < this.map.w && ty < this.map.h && this.map.code(tx, ty) !== " ";
          if (inside) continue;
          const sx = tx * TILE - ox, sy = ty * TILE - oy;
          if (sx < -TILE || sy < -TILE || sx >= W || sy >= H) continue;
          s.sprite(getSprite("tile", `${hash(`${tx},${ty}`) % 5}`, "hull"), sx, sy, "coal", "slate");
        }
      }
    }
    // Tiles
    for (let ty = y0; ty <= y0 + ROWS + 2; ty++) {
      for (let tx = x0; tx <= x0 + COLS + 2; tx++) {
        const sx = tx * TILE - ox, sy = ty * TILE - oy;
        if (sx < -TILE || sy < -TILE || sx >= W || sy >= H) continue;
        if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) continue;
        const t = this.map.cells(tx, ty);
        if (t.under) s.sprite(t.under.cells, sx, sy, t.under.a, t.under.b);
        s.sprite(t.cells, sx, sy, t.a, t.b);
      }
    }
    this.drawParticles(s, ox, oy);
    this.drawFx(s, ox, oy, false);
    // The fallen line across the ground
    if (this.def.line && this.def.line.length > 1 && this.host.isSlack()) {
      const c = colorInt("teal");
      const pts = this.def.line;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        s.line(ax * TILE + 3 - ox, ay * TILE + 4 - oy, bx * TILE + 3 - ox, by * TILE + 4 - oy, c);
        s.line(ax * TILE + 4 - ox, ay * TILE + 4 - oy, bx * TILE + 4 - ox, by * TILE + 4 - oy, c);
      }
    }
    // Chests
    for (const c of this.def.chests ?? []) {
      if (this.host.g.opened.includes(c.id)) s.spriteDim(getSprite("item", "chest", "chest"), c.x * TILE - ox, c.y * TILE - oy, "clay", "gold", 0.5);
      else s.sprite(getSprite("item", "chest", "chest"), c.x * TILE - ox, c.y * TILE - oy, "clay", "gold");
    }
    // Sprites sorted by y
    const drawList: { y: number; draw: () => void; lineX?: number; lineY?: number; lineColor?: number; pluck?: number }[] = [];
    const lineColor = colorInt(theme.line);
    const dimLine = mixInt(lineColor, PALETTE_INT.black, this.dimmed ? 0.75 : 0.45);
    for (const n of this.npcs) {
      const sx = n.x * TILE + n.px - ox, sy = n.y * TILE + n.py - oy;
      if (sx < -8 || sy < -8 || sx >= W || sy >= H) continue;
      const pl = (n as unknown as { pluckT?: number });
      drawList.push({ y: sy, draw: () => this.drawMover(s, n, sx, sy), lineX: n.held ? sx + 4 : undefined, lineY: sy, lineColor: dimLine, pluck: pl.pluckT });
      if (pl.pluckT) pl.pluckT = Math.max(0, pl.pluckT - 1 / 60);
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sx = e.x * TILE + e.px - ox, sy = e.y * TILE + e.py - oy;
      if (sx < -8 || sy < -8 || sx >= W || sy >= H) continue;
      drawList.push({ y: sy, draw: () => { this.drawMover(s, e, sx, sy, e.frozen > 0 ? colorInt("frost") : undefined); if (e.fleeing) s.text("!", sx + 3, sy - 6, "gold"); }, lineX: e.held ? sx + 4 : undefined, lineY: sy, lineColor: mixInt(dimLine, PALETTE_INT.black, 0.3) });
    }
    // Followers walk the trail
    const followers = this.host.followers();
    followers.forEach((id, i) => {
      const def = MEMBERS[id];
      const tp = this.trail[Math.min(this.trail.length - 1, i * 2 + 1)];
      const prev = this.trail[Math.min(this.trail.length - 1, i * 2)];
      if (!tp) return;
      // The held wait at the mouth of a passage only the slack can enter
      if (this.map.spec(tp.x, tp.y).slackOnly && def.held) return;
      // interpolate toward the next trail point when the player is moving
      const k = this.player.moving ? 1 - this.player.t : 0;
      const fx = tp.x * TILE + (prev.x - tp.x) * TILE * (1 - k) - ox;
      const fy = tp.y * TILE + (prev.y - tp.y) * TILE * (1 - k) - oy;
      const sx = Math.round(fx), sy = Math.round(fy);
      const face = prev.facing;
      drawList.push({ y: sy, draw: () => s.sprite(getSprite(def.sprite.kind, def.sprite.seed, def.sprite.variant), sx, sy, def.sprite.a, def.sprite.b, { flip: face === "left" }), lineX: def.held ? sx + 4 : undefined, lineY: sy, lineColor: dimLine });
    });
    const psx = this.player.x * TILE + this.player.px - ox, psy = this.player.y * TILE + this.player.py - oy;
    const pl = this.player as unknown as { pluckT?: number };
    drawList.push({ y: psy, draw: () => this.drawMover(s, this.player, psx, psy), lineX: this.player.held ? psx + 4 : undefined, lineY: psy, lineColor: lineColor, pluck: pl.pluckT });
    if (pl.pluckT) pl.pluckT = Math.max(0, pl.pluckT - 1 / 60);
    drawList.sort((a, b) => a.y - b.y);
    // Lines first so sprites sit over them, except each line rises from its own sprite
    if (!this.def.noLines) {
      for (const d of drawList) {
        if (d.lineX === undefined || d.lineY === undefined) continue;
        this.drawLine(s, d.lineX, d.lineY, d.lineColor ?? dimLine, d.pluck ?? 0, ox, oy);
      }
    }
    for (const d of drawList) d.draw();
    this.drawFx(s, ox, oy, true);
    // Light: a wash of the theme's color, then darkness in the Under
    if (theme.tint && !this.def.dark) s.tint(0, 0, W, H, theme.tint.c, theme.tint.t);
    if (this.def.dark) this.drawDark(s, psx + 4, psy + 4);
    // Flash
    if (this.flashT > 0) s.dimRect(0, 0, W, H, -0.0), this.whiteFlash(s, this.flashT);
    // Hover names from the Hand
    if (this.hoverName) {
      const hx = Math.max(2, Math.min(W - s.textWidth(this.hoverName.text) - 2, this.hoverName.x - ox + 4 - s.textWidth(this.hoverName.text) / 2));
      s.text(this.hoverName.text, Math.round(hx), Math.max(2, this.hoverName.y - oy), "white", "black");
    }
    // Hand cursor
    if (this.host.twoPlayer()) this.drawHand(s);
    // Toast and goal
    if (this.toast) {
      const tw = Math.min(W - 4, Math.max(...this.toast.lines.map((l) => s.textWidth(l))) + 10);
      drawBox(s, Math.floor((W - tw) / 2), 4, tw, this.toast.lines.length * (FONT_H + 1) + 7);
      this.toast.lines.forEach((l, i) => s.textCenter(l, W / 2, 8 + i * (FONT_H + 1), "gold"));
    }
    if (this.goalShown) {
      const text = this.host.goalText();
      const lines = wrapText(text, 48);
      const bh = lines.length * (FONT_H + 1) + 10;
      drawBox(s, 6, 6, W - 12, bh);
      lines.forEach((l, i) => s.text(l, 11, 11 + i * (FONT_H + 1), "white"));
    }
  }

  // Particles: drips from the Hull, motes in the Under, frost on the Deck
  private particles: { x: number; y: number; vy: number; life: number; c: number }[] = [];
  private updateParticles(dt: number): void {
    const theme = this.map.theme;
    const kind = theme.hull ? "drip" : this.def.theme === "under" || this.def.theme === "stays" ? "mote" : this.def.theme === "loft" ? "frost" : null;
    if (!kind) return;
    const rate = kind === "drip" ? 0.5 : kind === "mote" ? 2 : 3;
    if (this.rng.next() < dt * rate) {
      const x = this.camX + this.rng.int(W), y = kind === "drip" ? this.camY - 2 : this.camY + this.rng.int(H);
      this.particles.push({ x, y, vy: kind === "drip" ? 60 + this.rng.int(40) : kind === "frost" ? 8 : -4, life: kind === "drip" ? 4 : 3, c: colorInt(kind === "drip" ? "sea" : kind === "mote" ? "teal" : "white") });
    }
    for (const p of this.particles) { p.y += p.vy * dt; p.x += Math.sin(p.y * 0.1) * (kind === "frost" ? 0.4 : 0); p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < this.camY + H + 8 && p.y > this.camY - 8);
  }
  private drawParticles(s: Screen, ox: number, oy: number): void {
    for (const p of this.particles) {
      const x = Math.round(p.x - ox), y = Math.round(p.y - oy);
      s.px(x, y, p.c);
      if (p.vy > 30) s.px(x, y - 1, mixInt(p.c, PALETTE_INT.black, 0.5));
    }
  }

  /** Tile effects. A fall draws over sprites, the rest under them. */
  private drawFx(s: Screen, ox: number, oy: number, over: boolean): void {
    for (const f of this.fxList) {
      if ((f.kind === "fall") !== over) continue;
      const cx = f.x * TILE + 4 - ox, cy = f.y * TILE + 4 - oy;
      if (f.kind === "crack") this.drawCrack(s, cx, cy, f.t);
      else if (f.kind === "fall") this.drawFall(s, cx, cy, f.t);
      else if (f.kind === "rings") this.drawRings(s, cx, cy, f.t, colorInt("mint"), 3, 14);
      else this.drawRings(s, cx, cy, f.t, colorInt("gold"), 2, 24);
    }
  }

  private static readonly CRACK: [number, number][] = [[-3, -2], [-2, -2], [-2, -1], [-1, -1], [0, 0], [1, 0], [1, 1], [2, 2], [3, 2], [0, 1], [-1, 2], [-1, 3], [1, -1], [2, -2]];

  private drawCrack(s: Screen, cx: number, cy: number, t: number): void {
    for (const [dx, dy] of FieldScene.CRACK) s.px(cx + dx, cy + dy, PALETTE_INT.black);
    if (t < 0.7) this.ring(s, cx, cy, Math.round(2 + (t / 0.7) * 10), mixInt(PALETTE_INT.black, colorInt("ink"), 0.4));
    // A drip from the Hull lands in the crack every few seconds
    const sea = colorInt("sea");
    const p = (t % 2.6) / 0.5;
    if (t > 1 && p < 1) {
      const y = Math.round(p * cy);
      s.px(cx, y, sea);
      s.px(cx, y - 1, mixInt(sea, PALETTE_INT.black, 0.5));
    } else if (t > 1 && p < 1.25) {
      s.px(cx - 1, cy - 1, sea);
      s.px(cx + 1, cy - 1, sea);
    }
  }

  private drawFall(s: Screen, cx: number, cy: number, t: number): void {
    const yEnd = Math.round(Math.min(1, t / 0.35) * (cy - 3));
    s.vline(cx - 1, 0, yEnd, colorInt("frost"));
    s.vline(cx + 1, 0, yEnd, colorInt("white"));
    if (t < 0.35) return;
    const d = 2 + (t - 0.35) * 30;
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4) + 0.3;
      s.px(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.7), colorInt("white"));
    }
  }

  private drawRings(s: Screen, cx: number, cy: number, t: number, c: number, count: number, maxR: number): void {
    for (let i = 0; i < count; i++) {
      const lt = t - i * 0.25;
      if (lt < 0 || lt > 0.9) continue;
      const r = Math.round(2 + (lt / 0.9) * (maxR - 2));
      this.ring(s, cx, cy, r, lt > 0.6 ? mixInt(c, PALETTE_INT.black, 0.5) : c);
    }
  }

  private ring(s: Screen, cx: number, cy: number, r: number, c: number): void {
    const n = Math.max(8, r * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s.px(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
    }
  }

  private drawMover(s: Screen, m: Mover, sx: number, sy: number, tint?: number): void {
    const cells = getSprite(m.sprite.kind, m.sprite.seed, m.sprite.variant);
    const bob = m.moving && Math.floor(m.t * 4) % 2 === 1 ? -1 : 0;
    s.sprite(cells, sx, sy + bob, m.sprite.a, m.sprite.b, { flip: m.facing === "left", tint });
  }

  /** A held thing's line: straight up to the top, hidden behind roofs, humming when plucked. */
  private drawLine(s: Screen, x: number, y: number, color: number, pluck: number, ox: number, oy: number): void {
    if (x < 0 || x >= W) return;
    if (this.def.converge) {
      // A tangle: every line leans toward one point above the city
      const cx = this.def.converge[0] * TILE - ox, cy = this.def.converge[1] * TILE - oy;
      const steps = Math.max(1, Math.abs(y - cy));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const lx = Math.round(x + (cx - x) * t);
        const ly = Math.round(y - 1 + (cy - (y - 1)) * t);
        if (ly < 0) break;
        if (pluck > 0 && i % 2 === 0) continue;
        s.px(lx, ly, pluck > 0 ? colorInt("white") : color);
      }
      return;
    }
    const tx = Math.floor((x + ox) / TILE);
    for (let yy = y - 1; yy >= 0; yy--) {
      const ty = Math.floor((yy + oy) / TILE);
      if (ty >= 0 && ty < this.map.h && this.map.spec(tx, ty).roof) continue;
      let dx = 0;
      if (pluck > 0) dx = Math.round(Math.sin((y - yy) * 0.6 + this.time * 60) * pluck * 2.5);
      s.px(x + dx, yy, pluck > 0 ? colorInt("white") : color);
    }
  }

  private drawDark(s: Screen, cx: number, cy: number): void {
    const r = 56;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < r) continue;
        const t = Math.min(1, (d - r) / 40);
        const i = y * W + x;
        s.buf[i] = mixInt(s.buf[i], PALETTE_INT.black, 0.55 + 0.45 * t);
      }
    }
  }

  private whiteFlash(s: Screen, t: number): void {
    const k = Math.min(1, t / 0.25);
    const white = PALETTE_INT.white;
    for (let i = 0; i < s.buf.length; i += 1) s.buf[i] = mixInt(s.buf[i], white, k * 0.8);
  }

  private drawHand(s: Screen): void {
    const inp = (this as unknown as { lastPointer?: { x: number; y: number } }).lastPointer;
    void inp;
  }

  /** Screen x of every held party line, for the page lines above the canvas. */
  heldLineXs(): { x: number; color: string; slack: boolean }[] {
    const out: { x: number; color: string; slack: boolean }[] = [];
    const ox = Math.round(this.camX), oy = Math.round(this.camY);
    const psx = this.player.x * TILE + this.player.px - ox + 4;
    out.push({ x: psx, color: "#d8cfb8", slack: !this.player.held || !!this.def.noLines });
    const followers = this.host.followers();
    followers.forEach((id, i) => {
      const def = MEMBERS[id];
      const tp = this.trail[Math.min(this.trail.length - 1, i * 2 + 1)];
      if (!tp) return;
      out.push({ x: tp.x * TILE - ox + 4, color: "#8e8a92", slack: !def.held || !!this.def.noLines });
    });
    void oy;
    return out;
  }

  /** Called by the game each frame with the pointer, so the hand draws on top of everything. */
  drawPointer(s: Screen, px: number, py: number): void {
    if (!this.host.twoPlayer()) return;
    const cells = getSprite("hand", "hand");
    // The Hand reaches down from the top of the screen
    const c = mixInt(colorInt("frost"), PALETTE_INT.black, 0.5);
    s.vline(px + 3, 0, Math.max(0, py - 1), c);
    s.sprite(cells, px, py, "frost", "white");
  }
}

function opposite(f: Facing): Facing {
  return f === "up" ? "down" : f === "down" ? "up" : f === "left" ? "right" : "left";
}

function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line.length + w.length + 1 > maxChars && line) { out.push(line); line = w; }
    else line = line ? line + " " + w : w;
  }
  if (line) out.push(line);
  return out;
}

export type { ColorName };
