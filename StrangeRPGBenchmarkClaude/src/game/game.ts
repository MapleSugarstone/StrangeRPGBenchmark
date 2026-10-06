import { Gfx } from '../core/gfx';
import { Input } from '../core/input';
import { Audio } from '../core/audio';
import type { Col } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';
import { Rng } from '../core/rng';
import { GameState, Dir, save as saveState } from './state';
import { Ctx, Script, BattleOpts, BattleResult } from './script';
import { World, TINT_MAPS } from './world';
import { MAPS } from '../maps';
import { DialogScene, ChoiceScene } from '../scenes/dialog';
import { BattleScene } from '../scenes/battle';
import { FieldScene } from '../scenes/field';
import { ShopScene } from '../scenes/shop';
import { CardScene } from '../scenes/card';
import { EndingScene } from '../scenes/ending';
import { GameOverScene } from '../scenes/gameover';

export interface Scene {
  update(): void;
  draw(g: Gfx): void;
  overlay?: boolean;
}

export class Abort extends Error {}

export class Game {
  gfx: Gfx;
  input = new Input();
  audio = new Audio();
  st!: GameState;
  stack: Scene[] = [];
  world: World | null = null;
  field: FieldScene | null = null;
  frame = 0;
  fadeA = 0;
  private fadeTarget = 0;
  private fadeDone: (() => void) | null = null;
  shakeT = 0;
  busy = 0;
  greyAll = false;
  rng = new Rng();
  banner = { text: '', t: 0 };
  onTitle: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.gfx = new Gfx(canvas);
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(s: Scene) {
    this.stack.push(s);
  }

  pop(s?: Scene) {
    if (s) this.stack = this.stack.filter(x => x !== s);
    else this.stack.pop();
  }

  replaceAll(s: Scene) {
    this.stack = [s];
  }

  update() {
    this.input.tick();
    if (this.input.pressed('mute')) this.audio.toggleMute();
    this.top?.update();
    if (this.fadeA !== this.fadeTarget) {
      const d = this.fadeTarget > this.fadeA ? 0.1 : -0.1;
      this.fadeA = Math.max(0, Math.min(1, this.fadeA + d));
      if (Math.abs(this.fadeA - this.fadeTarget) < 0.01) {
        this.fadeA = this.fadeTarget;
        const f = this.fadeDone;
        this.fadeDone = null;
        f?.();
      }
    }
    if (this.shakeT > 0) this.shakeT--;
    if (this.banner.t > 0) this.banner.t--;
    if (this.st) this.st.frames++;
    this.frame++;
  }

  draw() {
    const g = this.gfx;
    g.ox = this.shakeT > 0 ? Math.round(Math.sin(this.frame * 1.7) * 2) : 0;
    g.oy = 0;
    let base = this.stack.length - 1;
    while (base > 0 && this.stack[base].overlay) base--;
    g.clear('k');
    for (let i = Math.max(0, base); i < this.stack.length; i++) this.stack[i].draw(g);
    g.ox = 0;
    g.overlay('k', this.fadeA);
  }

  fadeTo(a: number): Promise<void> {
    return new Promise(res => {
      this.fadeTarget = a;
      if (Math.abs(this.fadeA - a) < 0.01) { this.fadeA = a; res(); return; }
      this.fadeDone = res;
    });
  }

  wait(frames: number): Promise<void> {
    return new Promise(res => {
      let n = frames;
      const tick: Scene = {
        overlay: true,
        update: () => { if (--n <= 0) { this.pop(tick); res(); } },
        draw: () => {},
      };
      this.push(tick);
    });
  }

  /** Loads a map and places the player on a marker. */
  loadMap(id: string, marker: string | [number, number], dir?: Dir) {
    const def = MAPS[id];
    if (!def) throw new Error('Unknown map ' + id);
    this.world = new World(def, this.st);
    const [x, y] = typeof marker === 'string' ? this.world.marker(marker) : marker;
    this.st.map = id;
    this.st.x = x;
    this.st.y = y;
    if (dir) this.st.facing = dir;
    this.gfx.grey = !!def.grey || this.greyAll;
    if (!this.field) this.field = new FieldScene(this);
    this.field.onMapLoaded();
    this.audio.play(def.music);
    this.banner = { text: def.name, t: 110 };
    if (this.st.tint && !TINT_MAPS.has(id)) {
      this.st.tint = '';
      this.banner = { text: 'The paint washes off', t: 110 };
    }
  }

  async run(script: Script) {
    this.busy++;
    try {
      await script(new GameCtx(this));
    } catch (e) {
      if (!(e instanceof Abort)) console.error(e);
    } finally {
      this.busy--;
    }
  }

  async enterMap() {
    const def = this.world?.def;
    if (def?.enter) await this.run(def.enter);
  }

  goTitle() {
    this.field = null;
    this.world = null;
    this.onTitle?.();
  }
}

export class GameCtx extends Ctx {
  constructor(public g: Game) {
    super(g.st);
  }

  say(who: string, text: string, spr?: SpriteSpec): Promise<void> {
    return new Promise(res => this.g.push(new DialogScene(this.g, who, text, spr, res)));
  }

  ask(q: string, opts: string[]): Promise<number> {
    return new Promise(res => this.g.push(new ChoiceScene(this.g, q, opts, res)));
  }

  async battle(group: string, o: BattleOpts = {}): Promise<BattleResult> {
    for (;;) {
      const snapshot = JSON.stringify(this.st);
      const result = await new Promise<BattleResult>(res => this.g.push(new BattleScene(this.g, group, o, res)));
      if (result !== 'lose' || o.canLose) {
        this.g.audio.play(this.g.world?.def.music ?? 'village');
        return result;
      }
      const choice = await new Promise<number>(res => this.g.push(new GameOverScene(this.g, res)));
      if (choice === 0) {
        Object.assign(this.st, JSON.parse(snapshot));
        continue;
      }
      throw new Abort();
    }
  }

  async warp(map: string, marker: string, dir?: Dir) {
    await this.g.fadeTo(1);
    this.g.loadMap(map, marker, dir);
    this.g.audio.sfx('door');
    await this.g.fadeTo(0);
    const def = this.g.world?.def;
    if (def?.enter) await def.enter(this);
  }

  fadeOut() { return this.g.fadeTo(1); }
  fadeIn() { return this.g.fadeTo(0); }
  wait(frames: number) { return this.g.wait(frames); }

  shop(id: string): Promise<void> {
    return new Promise(res => this.g.push(new ShopScene(this.g, id, res)));
  }

  card(chapter: number): Promise<void> {
    return new Promise(res => this.g.push(new CardScene(this.g, chapter, res)));
  }

  moveEnt(id: string, path: string): Promise<void> {
    return this.g.field?.moveEnt(id, path) ?? Promise.resolve();
  }

  movePlayer(path: string): Promise<void> {
    return this.g.field?.movePlayer(path) ?? Promise.resolve();
  }

  face(dir: Dir) { this.st.facing = dir; }
  sfx(n: string) { this.g.audio.sfx(n); }
  music(n: string) { this.g.audio.play(n); }
  shake(frames: number) { this.g.shakeT = frames; }

  async flash(c: Col) {
    this.g.field?.flash(c);
    await this.g.wait(12);
  }

  ending(kind: string): Promise<void> {
    return new Promise(res => this.g.push(new EndingScene(this.g, kind, res)));
  }

  refresh() {
    this.g.world?.refresh(this.st);
  }

  setEnt(id: string, patch: { hidden?: boolean; spr?: SpriteSpec }) {
    const w = this.g.world;
    if (!w) return;
    if (patch.hidden !== undefined) this.st.flags[`hide:${w.def.id}:${id}`] = patch.hidden ? true : 'show';
    const e = w.ent(id);
    if (e && patch.spr) e.spr = patch.spr;
    w.refresh(this.st);
  }

  greyWorld(on: boolean) {
    this.g.greyAll = on;
    this.g.gfx.grey = on || !!this.g.world?.def.grey;
  }

  save() {
    saveState(this.st);
  }

  title() {
    this.g.goTitle();
  }
}
