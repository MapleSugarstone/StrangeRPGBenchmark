import type { Scene } from "../../engine/scene";
import type { Screen } from "../../engine/screen";
import type { Key } from "../../engine/input";
import { getSprite, tileVariant } from "../../engine/sprites";
import { W, H, TILE } from "../../engine/screen";
import { DIRS, type Dir } from "../types";
import type { Game } from "../game";
import { CHARACTERS } from "../data/classes";
import { visible, type Entity } from "./map";
import { ENCOUNTERS } from "../data/enemies";
import { audio } from "../../engine/audio";
import { textWidth } from "../../engine/font";

const STEP_TIME = 0.11;
/** Wild steps after a fight with no chance of another. */
const QUIET_STEPS = 16;
/** Scales every map's encounterRate. With the ramp, a fight comes about every 37 wild steps instead of every 10. */
const RATE_SCALE = 0.25;
const RAMP_PER_STEP = 0.002;
const RAMP_CAP = 0.06;

/** Tile movement, camera, NPC interaction and random encounters. */
export class OverworldScene implements Scene {
  private moving = 0;
  private fromX = 0;
  private fromY = 0;
  private anim = 0;
  private trail: { x: number; y: number; dir: Dir }[] = [];
  private busy = false;
  private wanderTimer = 0;
  private banner: { text: string; t: number } | null = null;
  private stepsSinceFight = 0;
  private queued: Dir | null = null;

  constructor(private game: Game) {
    const p = game.state.map;
    for (let i = 0; i < 8; i++) this.trail.push({ x: p.x, y: p.y, dir: p.dir });
  }

  get pos() {
    return this.game.state.map;
  }

  showBanner(text: string): void {
    this.banner = { text, t: 2.5 };
  }

  resetTrail(): void {
    const p = this.pos;
    this.trail = [];
    for (let i = 0; i < 8; i++) this.trail.push({ x: p.x, y: p.y, dir: p.dir });
    this.moving = 0;
  }

  update(dt: number): void {
    this.anim += dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.moving > 0) {
      this.moving -= dt;
      if (this.moving <= 0) { this.moving = 0; void this.arrived(); }
    } else if (!this.busy && this.game.stack.top === this) {
      const held = (["up", "down", "left", "right"] as Dir[]).find((d) => this.game.input.held(d));
      const next = this.queued ?? held;
      this.queued = null;
      if (next) this.tryMove(next);
    }
    this.wanderTimer += dt;
    if (this.wanderTimer > 1.2 && !this.busy) {
      this.wanderTimer = 0;
      this.wanderNpcs();
    }
  }

  private wanderNpcs(): void {
    const map = this.game.map!;
    const rng = this.game.rng;
    for (const e of map.entities) {
      if (!e.wander || !visible(e, this.game.state.flags) || !rng.chance(0.4)) continue;
      const d = rng.pick(["up", "down", "left", "right"] as Dir[]);
      const [dx, dy] = DIRS[d];
      const nx = e.x + dx, ny = e.y + dy;
      if (map.solidAt(nx, ny, this.game.state.flags)) continue;
      if (nx === this.pos.x && ny === this.pos.y) continue;
      if (Math.abs(nx - (e.hx ?? nx)) > 2 || Math.abs(ny - (e.hy ?? ny)) > 2) continue;
      e.x = nx; e.y = ny; e.dir = d;
    }
  }

  private tryMove(d: Dir): void {
    const p = this.pos;
    p.dir = d;
    const [dx, dy] = DIRS[d];
    const nx = p.x + dx, ny = p.y + dy;
    const map = this.game.map!;
    if (map.solidAt(nx, ny, this.game.state.flags)) return;
    this.trail.unshift({ x: p.x, y: p.y, dir: d });
    this.trail.length = 8;
    this.fromX = p.x; this.fromY = p.y;
    p.x = nx; p.y = ny;
    this.moving = STEP_TIME;
    this.game.state.steps++;
  }

  private async arrived(): Promise<void> {
    const map = this.game.map!;
    const p = this.pos;
    const e = map.entityAt(p.x, p.y, this.game.state.flags);
    if (e && (e.kind === "door" || e.kind === "trigger")) {
      this.busy = true;
      if (e.to) await this.game.gotoMap(e.to.map, e.to.x, e.to.y, e.to.dir ?? p.dir, e.to.atEntity);
      else if (e.script) await this.game.runScript(e.script, e);
      this.busy = false;
      return;
    }
    const t = map.tileAt(p.x, p.y);
    this.stepsSinceFight++;
    if (t.wild && map.def.encounters && this.stepsSinceFight > QUIET_STEPS) {
      const rate = (map.def.encounterRate ?? 0.08) * RATE_SCALE;
      const bonus = Math.min(RAMP_CAP, (this.stepsSinceFight - QUIET_STEPS - 1) * RAMP_PER_STEP);
      if (this.game.rng.chance(rate + bonus)) {
        this.stepsSinceFight = 0;
        this.busy = true;
        const table = ENCOUNTERS[map.def.encounters];
        const group = this.game.rng.weighted(table, table.map((g) => g.weight));
        audio.sfx("encounter");
        await this.game.battle(group.ids, { ambush: true });
        this.busy = false;
      }
    }
  }

  async interact(): Promise<void> {
    if (this.busy || this.moving > 0) return;
    const p = this.pos;
    const [dx, dy] = DIRS[p.dir];
    const map = this.game.map!;
    let e = map.entityAt(p.x + dx, p.y + dy, this.game.state.flags);
    if (!e) e = map.entityAt(p.x, p.y, this.game.state.flags);
    if (!e) return;
    if (e.kind === "door" || e.kind === "trigger") return;
    this.busy = true;
    if (e.kind === "npc" || e.kind === "boss") e.dir = opposite(p.dir);
    if (e.kind === "chest") await this.game.openChest(e);
    else if (e.kind === "lamp") await this.game.useLamp(e);
    else if (e.kind === "shop") await this.game.openShop(e);
    else if (e.script) await this.game.runScript(e.script, e);
    this.busy = false;
  }

  key(k: Key): void {
    if (this.busy) return;
    if (k === "ok") void this.interact();
    else if (k === "menu" || k === "cancel") this.game.openMenu();
    else if (k === "up" || k === "down" || k === "left" || k === "right") {
      if (this.moving <= 0) this.tryMove(k);
      else this.queued = k;
    }
  }

  draw(s: Screen): void {
    const map = this.game.map!;
    const p = this.pos;
    // Interpolated player pixel position.
    const f = this.moving > 0 ? 1 - this.moving / STEP_TIME : 1;
    const px = (this.fromX + (p.x - this.fromX) * f) * TILE;
    const py = (this.fromY + (p.y - this.fromY) * f) * TILE;
    const camX = Math.round(px - W / 2 + TILE / 2);
    const camY = Math.round(py - H / 2 + TILE / 2);
    s.clear(map.def.outside);
    const x0 = Math.floor(camX / TILE) - 1, y0 = Math.floor(camY / TILE) - 1;
    for (let ty = y0; ty <= y0 + H / TILE + 2; ty++) {
      for (let tx = x0; tx <= x0 + W / TILE + 2; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
        const t = map.tiles[ty][tx];
        const spec = t.variants > 1 ? tileVariant(t.sprite, tx, ty, t.variants) : t.sprite;
        s.sprite(getSprite(spec), tx * TILE - camX, ty * TILE - camY, spec.a, spec.b);
      }
    }
    const flags = this.game.state.flags;
    for (const e of map.entities) {
      if (!visible(e, flags) || !e.sprite) continue;
      const ex = e.x * TILE - camX, ey = e.y * TILE - camY;
      if (ex < -8 || ey < -8 || ex > W || ey > H) continue;
      const bob = e.kind === "npc" || e.kind === "boss" ? (Math.floor(this.anim * 2 + e.x) % 2) : 0;
      s.sprite(getSprite(e.sprite), ex, ey - bob, e.sprite.a, e.sprite.b, { flipX: e.dir === "left" });
    }
    // Followers walk the trail behind the leader.
    const party = this.game.state.party;
    for (let i = party.length - 1; i >= 1; i--) {
      const node = this.trail[i - 1];
      const prev = i === 1 ? { x: this.fromX, y: this.fromY } : this.trail[i - 2];
      const fx = (node.x + (prev.x - node.x) * f) * TILE - camX;
      const fy = (node.y + (prev.y - node.y) * f) * TILE - camY;
      const c = CHARACTERS[party[i].charId];
      const bob = this.moving > 0 ? Math.floor(this.anim * 10) % 2 : 0;
      s.sprite(getSprite(c.sprite), Math.round(fx), Math.round(fy) - bob, c.sprite.a, c.sprite.b, { flipX: node.dir === "left" });
    }
    const lead = CHARACTERS[party[0].charId];
    const bob = this.moving > 0 ? Math.floor(this.anim * 10) % 2 : 0;
    s.sprite(getSprite(lead.sprite), Math.round(px - camX), Math.round(py - camY) - bob, lead.sprite.a, lead.sprite.b, { flipX: p.dir === "left" });
    if (this.banner) {
      const alpha = Math.min(1, this.banner.t);
      const w = Math.max(144, textWidth(this.banner.text) + 12);
      s.panel(96 - w / 2, 20, w, 16, "dark", alpha > 0.5 ? "white" : "gray");
      s.textCenter(this.banner.text, 96, 24, "white");
    }
  }
}

export function opposite(d: Dir): Dir {
  return d === "up" ? "down" : d === "down" ? "up" : d === "left" ? "right" : "left";
}
