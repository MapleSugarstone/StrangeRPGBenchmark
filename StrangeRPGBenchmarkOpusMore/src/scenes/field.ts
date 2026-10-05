import { Gfx, W, H } from '../core/gfx';
import { ANIMATED_TILES, SpriteSpec, sizeOf, tileCanvas } from '../core/sprites';
import { Mode, setMode } from '../core/palette';
import { Light, LightLayer, Weather } from './fx';
import { hashStr } from '../core/rng';
import type { Game, Scene } from '../game/game';
import { Ctx, ScriptAbort } from '../game/ctx';
import { heroSprite } from '../game/speakers';
import { MAPS } from '../maps';
import type { DigDef, FeralDef, MapDef, NpcDef, Script, TileDef } from '../maps/types';
import { GROUPS, ENEMIES } from '../data/enemies';
import { MenuScene, nextTalk } from './menu';
import { textWidth, wrap } from '../core/font';
import { goal } from '../game/goals';
import { callingScene, pendingCalling } from '../maps/side';

const TINT_MODE: Record<string, string> = { navy: 'night', rose: 'dusk', orange: 'dusk', cream: 'day', lilac: 'cold', grey: 'eerie' };

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
const DIRCH: Record<string, number> = { u: 0, r: 1, d: 2, l: 3 };

export interface Actor {
  id: string;
  x: number; y: number;
  fx: number; fy: number;
  dir: number;
  sprite: SpriteSpec;
  moving: number;
  dur: number;
  path: number[];
  visible: boolean;
  scale: number;
  def?: NpcDef;
  wanderT: number;
  ghost: boolean;
  onDone?: () => void;
}

interface FeralRT extends Actor { fdef: FeralDef; alive: boolean; stun: number; ox: number; oy: number; }

export class FieldScene implements Scene {
  static skipEnter = false;
  map!: MapDef;
  w = 0; h = 0;
  tiles: TileDef[] = [];
  hero!: Actor;
  partner: Actor | null = null;
  controlPartner = false;
  npcs: Actor[] = [];
  ferals: FeralRT[] = [];
  busy = 0;
  ctx: Ctx;
  fade = 1;
  fadeTarget = 0;
  banner = 0;
  listenT = 0;
  revealed = new Set<string>();
  cursor = { x: 96, y: 96, on: false };
  shakeT = 0;
  emotes: { id: string; ch: string; t: number }[] = [];
  flashT = 0;
  flashColor = 'white';
  pendingBattle: { group: string; first: 1 | 0 | -1; feral: FeralRT } | null = null;
  defeatedHere = new Set<number>();
  tint: string | null = null;
  overlayText: { text: string; t: number } | null = null;
  notice: { text: string; t: number } | null = null;
  goalT = 0;
  cam: [number, number] = [0, 0];
  light = new LightLayer();
  weather = new Weather(null);

  constructor(public game: Game, mapId: string, x: number, y: number, dir: number) {
    this.ctx = new Ctx(game, this);
    this.load(mapId, x, y, dir);
  }

  load(mapId: string, x: number, y: number, dir: number) {
    const m = MAPS[mapId];
    if (!m) throw new Error('Unknown map ' + mapId);
    this.map = m;
    this.h = m.rows.length;
    this.w = Math.max(...m.rows.map((r) => r.length));
    this.tiles = [];
    for (let yy = 0; yy < this.h; yy++) for (let xx = 0; xx < this.w; xx++) {
      const ch = m.rows[yy][xx] ?? ' ';
      this.tiles.push(m.legend[ch] ?? m.legend[' '] ?? { k: 'dark', a: 'ink', b: 'ink', solid: true });
    }
    const s = this.game.state!;
    s.map = mapId; s.x = x; s.y = y; s.dir = dir;
    this.hero = this.mkActor('hero', x, y, dir, heroSprite());
    this.npcs = (m.npcs ?? []).map((n) => {
      const a = this.mkActor(n.id, n.x, n.y, n.dir ?? 2, n.sprite);
      a.def = n;
      a.scale = n.scale ?? 1;
      a.ghost = !!n.ghost;
      return a;
    });
    this.ferals = (m.ferals ?? []).map((f, i) => {
      const g = GROUPS[f.group];
      const lead = g ? ENEMIES[g[0]] : undefined;
      const a = this.mkActor('feral' + i, f.x, f.y, 2, f.sprite ?? lead?.sprite ?? { t: 'blob', seed: 1, a: 'red', b: 'paper' }) as FeralRT;
      a.fdef = f; a.alive = true; a.stun = 0; a.ox = f.x; a.oy = f.y;
      a.wanderT = 30 + (i * 17) % 40;
      return a;
    });
    this.defeatedHere.clear();
    this.revealed.clear();
    this.refreshVisibility();
    this.banner = 120;
    this.fade = 1;
    this.fadeTarget = 0;
    this.partner = null;
    this.controlPartner = false;
    this.game.audio.play(m.music ?? null);
    const wk = typeof m.weather === 'function' ? m.weather(this.ctx) : m.weather;
    this.weather = new Weather(wk ?? null);
    // Deferred so a dialogue it opens lands on the stack after the caller has finished swapping scenes.
    if (m.enter && !FieldScene.skipEnter) {
      const enter = m.enter;
      this.busy++;
      Promise.resolve().then(() => { this.busy = Math.max(0, this.busy - 1); if (this.map === m) this.run(enter); });
    }
  }

  mkActor(id: string, x: number, y: number, dir: number, sprite: SpriteSpec): Actor {
    return { id, x, y, fx: x, fy: y, dir, sprite, moving: 0, dur: 6, path: [], visible: true, scale: 1, wanderT: 60, ghost: false };
  }

  refreshVisibility() {
    if (!this.game.state) return;
    for (const n of this.npcs) if (n.def?.show) n.visible = n.def.show(this.ctx);
    for (const f of this.ferals) if (f.fdef.show && !f.fdef.show(this.ctx)) f.alive = false;
  }

  tile(x: number, y: number): TileDef | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.tiles[y * this.w + x];
  }

  actorAt(x: number, y: number, except?: Actor): Actor | null {
    for (const n of this.npcs) if (n !== except && n.visible && !n.ghost && n.x === x && n.y === y) return n;
    if (this.partner && this.partner !== except && this.partner.x === x && this.partner.y === y) return this.partner;
    if (this.hero !== except && this.hero.x === x && this.hero.y === y && this.hero.visible) return this.hero;
    return null;
  }

  feralAt(x: number, y: number): FeralRT | null {
    for (const f of this.ferals) if (f.alive && f.x === x && f.y === y) return f;
    return null;
  }

  blocked(x: number, y: number, who: Actor): boolean {
    const t = this.tile(x, y);
    if (!t || t.solid) return true;
    if (t.needs && !this.game.state!.flags[t.needs]) return true;
    if (this.actorAt(x, y, who)) return true;
    return false;
  }

  run(fn: Script) {
    this.busy++;
    fn(this.ctx).catch((e) => { if (!(e instanceof ScriptAbort)) console.error(e); }).finally(() => { this.busy = Math.max(0, this.busy - 1); this.refreshVisibility(); });
  }

  startMove(a: Actor, dir: number, dur: number) {
    a.dir = dir;
    a.x += DX[dir];
    a.y += DY[dir];
    a.moving = dur;
    a.dur = dur;
  }

  // Walks an actor along a path such as "uurr". Resolves when it arrives.
  walk(a: Actor, path: string, dur = 8): Promise<void> {
    return new Promise((res) => {
      a.path = path.split('').map((c) => DIRCH[c]).filter((d) => d !== undefined);
      a.onDone = res;
      a.dur = dur;
      if (!a.path.length) { a.onDone = undefined; res(); }
    });
  }

  private stepActor(a: Actor) {
    if (a.moving > 0) {
      a.moving--;
      const k = a.moving / a.dur;
      a.fx = a.x - DX[a.dir] * k;
      a.fy = a.y - DY[a.dir] * k;
      if (a.moving === 0) { a.fx = a.x; a.fy = a.y; if (a === this.hero || a === this.partner) this.arrive(a); }
      if (a.moving > 0) return;
    }
    if (a.path.length) { this.startMove(a, a.path.shift()!, a.dur); return; }
    if (a.onDone) { const d = a.onDone; a.onDone = undefined; d(); }
  }

  private arrive(a: Actor) {
    if (a !== this.hero) { this.refreshVisibility(); return; }
    if (this.partner) this.refreshVisibility();
    const s = this.game.state!;
    s.x = a.x; s.y = a.y; s.dir = a.dir;
    s.stats.steps++;
    if (this.busy) return;
    const f = this.feralAt(a.x, a.y);
    if (f) { this.startBattle(f, 1); return; }
    for (const e of this.map.exits ?? []) {
      if (e.show && !e.show(this.ctx)) continue;
      if (a.x >= e.x && a.x < e.x + (e.w ?? 1) && a.y >= e.y && a.y < e.y + (e.h ?? 1)) {
        if (e.blocked) { this.run(e.blocked); return; }
        this.run(async (c) => { await c.goto(e.to, e.tx, e.ty, e.dir ?? a.dir); });
        return;
      }
    }
    for (const tr of this.map.triggers ?? []) {
      if (tr.touch) continue;
      if (a.x >= tr.x && a.x < tr.x + (tr.w ?? 1) && a.y >= tr.y && a.y < tr.y + (tr.h ?? 1)) {
        if (tr.once && s.flags[tr.once]) continue;
        if (tr.show && !tr.show(this.ctx)) continue;
        if (tr.once) s.flags[tr.once] = 1;
        this.run(tr.run);
        return;
      }
    }
    if (this.map.tick) {
      const sc = this.map.tick(this.ctx);
      if (sc) this.run(sc);
    }
  }

  startBattle(f: FeralRT, first: 1 | 0 | -1) {
    if (this.pendingBattle || this.busy) return;
    this.pendingBattle = { group: f.fdef.group, first, feral: f };
    this.run(async (c) => {
      const pb = this.pendingBattle!;
      const r = await c.battle(pb.group, { first: pb.first, feral: true });
      if (r === 'win') { pb.feral.alive = false; }
      else if (r === 'fled') { pb.feral.stun = 150; }
      this.pendingBattle = null;
    });
  }

  private feralThink(f: FeralRT) {
    if (!f.alive || f.moving > 0) return;
    if (f.stun > 0) { f.stun--; return; }
    if (this.busy || this.fade > 0) return;
    f.wanderT--;
    if (f.wanderT > 0) return;
    const h = this.hero;
    const dx = h.x - f.x, dy = h.y - f.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const chase = f.fdef.chase ?? 5;
    let dir = -1;
    if (dist <= chase && !f.fdef.still) {
      const opts = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : 3, dy > 0 ? 2 : 0] : [dy > 0 ? 2 : 0, dx > 0 ? 1 : 3];
      if (dy === 0) opts.pop();
      if (dx === 0) opts.pop();
      for (const d of opts) {
        const nx = f.x + DX[d], ny = f.y + DY[d];
        if (nx === h.x && ny === h.y) { f.dir = d; this.startBattle(f, (h.dir === d) ? -1 : 0); return; }
        if (!this.blocked(nx, ny, f) && !this.feralAt(nx, ny)) { dir = d; break; }
      }
      f.wanderT = 14;
    } else if (!f.fdef.still) {
      const d = Math.floor(Math.random() * 4);
      const nx = f.x + DX[d], ny = f.y + DY[d];
      if (Math.abs(nx - f.ox) <= 3 && Math.abs(ny - f.oy) <= 3 && !this.blocked(nx, ny, f) && !this.feralAt(nx, ny) && !(nx === h.x && ny === h.y)) dir = d;
      f.wanderT = 40 + Math.floor(Math.random() * 50);
    } else {
      f.wanderT = 30;
    }
    if (dir >= 0) this.startMove(f, dir, 9);
  }

  private npcWander(n: Actor) {
    if (!n.def?.wander || n.moving || n.path.length || this.busy) return;
    n.wanderT--;
    if (n.wanderT > 0) return;
    n.wanderT = 60 + Math.floor(Math.random() * 90);
    const d = Math.floor(Math.random() * 4);
    const nx = n.x + DX[d], ny = n.y + DY[d];
    if (Math.abs(nx - n.def.x) <= 2 && Math.abs(ny - n.def.y) <= 2 && !this.blocked(nx, ny, n) && !this.feralAt(nx, ny)) this.startMove(n, d, 12);
    else n.dir = d;
  }

  facing(a: Actor): [number, number] { return [a.x + DX[a.dir], a.y + DY[a.dir]]; }

  private interact() {
    const a = this.controlPartner && this.partner ? this.partner : this.hero;
    const [fx, fy] = this.facing(a);
    const n = this.npcs.find((q) => q.visible && q.x === fx && q.y === fy && q.def?.talk);
    if (n && n.def?.talk) {
      const talk = n.def.talk;
      if (!n.def.wander || true) n.dir = (a.dir + 2) % 4;
      this.run(talk);
      return;
    }
    const s = this.game.state!;
    for (const tr of this.map.triggers ?? []) {
      if (!tr.touch) continue;
      if (fx >= tr.x && fx < tr.x + (tr.w ?? 1) && fy >= tr.y && fy < tr.y + (tr.h ?? 1)) {
        if (tr.once && s.flags[tr.once]) continue;
        if (tr.show && !tr.show(this.ctx)) continue;
        if (tr.once) s.flags[tr.once] = 1;
        this.run(tr.run);
        return;
      }
    }
    const dig = this.digAt(a.x, a.y) ?? this.digAt(fx, fy);
    if (dig && this.revealed.has(dig.id)) this.run((c) => c.dig(dig));
  }

  digAt(x: number, y: number): DigDef | null {
    const s = this.game.state!;
    return (this.map.digs ?? []).find((d) => d.x === x && d.y === y && !s.flags['dig_' + d.id]) ?? null;
  }

  private listen() {
    if (this.map.noListen) return;
    this.listenT = 50;
    this.game.audio.sfx('listen');
    const s = this.game.state!;
    for (const d of this.map.digs ?? []) {
      if (s.flags['dig_' + d.id]) continue;
      if (Math.abs(d.x - this.hero.x) + Math.abs(d.y - this.hero.y) <= 8) this.revealed.add(d.id);
    }
    const [fx, fy] = this.facing(this.hero);
    const n = this.npcs.find((q) => q.visible && q.x === fx && q.y === fy && q.def?.prayer);
    if (n?.def?.prayer) {
      const text = n.def.prayer;
      this.run(async (c) => { await c.say(null, `You listen. Their slip says: "${text}"`); });
    }
  }

  update() {
    const inp = this.game.input;
    const s = this.game.state!;
    if (this.fade !== this.fadeTarget) {
      this.fade += this.fadeTarget > this.fade ? 0.1 : -0.1;
      if (Math.abs(this.fade - this.fadeTarget) < 0.05) this.fade = this.fadeTarget;
    }
    if (this.banner > 0) this.banner--;
    if (this.listenT > 0) this.listenT--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
    if (this.overlayText && this.overlayText.t > 0) this.overlayText.t--;
    if (this.notice && this.notice.t > 0) this.notice.t--;
    if (this.goalT > 0) this.goalT--;
    this.emotes = this.emotes.filter((e) => --e.t > 0);
    const coop = !!this.partner && inp.twoPlayer;
    const ctl = this.controlPartner && this.partner && !coop ? this.partner : this.hero;
    const p1 = 0;
    const steer = (a: Actor, p: number): boolean => {
      if (a.moving !== 0 || a.path.length) return false;
      let dir = -1;
      if (inp.held('up', p)) dir = 0;
      else if (inp.held('down', p)) dir = 2;
      else if (inp.held('left', p)) dir = 3;
      else if (inp.held('right', p)) dir = 1;
      if (dir < 0) return false;
      const nx = a.x + DX[dir], ny = a.y + DY[dir];
      const run = inp.held('run', p) || inp.held('run');
      if (!this.blocked(nx, ny, a)) {
        this.startMove(a, dir, run ? 4 : 7);
        if (s.stats.steps % 2 === 0) this.game.audio.sfx('step');
      } else a.dir = dir;
      return true;
    };
    if (coop && !this.busy && this.fade === 0 && this.partner) steer(this.partner, 1);
    if (!this.busy && this.fade === 0 && ctl.moving === 0 && !ctl.path.length && this.game.top() === this) {
      const pc = pendingCalling(s);
      if (pc) { this.run((c) => callingScene(c, pc)); return; }
    }
    if (!this.busy && this.fade === 0 && ctl.moving === 0 && !ctl.path.length) {
      if (steer(ctl, p1)) {
        // moved or turned
      } else if (inp.pressed('ok', p1)) {
        this.interact();
      } else if (inp.pressed('listen', p1)) {
        this.listen();
      } else if (inp.pressed('menu', p1) || inp.pressed('back', p1)) {
        this.game.push(new MenuScene(this.game));
      } else if (inp.pressed('aux', p1) && this.partner) {
        this.controlPartner = !this.controlPartner;
        this.game.audio.sfx('blip');
      } else if (inp.pressed('aux', p1)) {
        this.goalT = 240;
        this.game.audio.sfx('blip');
      }
    }
    // The second player steers a cursor that can ping hidden things and stun ferals.
    if (inp.twoPlayer && !this.partner) {
      this.cursor.on = true;
      const c = this.cursor;
      if (inp.held('up', 1)) c.y -= 2;
      if (inp.held('down', 1)) c.y += 2;
      if (inp.held('left', 1)) c.x -= 2;
      if (inp.held('right', 1)) c.x += 2;
      c.x = Math.max(0, Math.min(W - 8, c.x));
      c.y = Math.max(0, Math.min(H - 8, c.y));
      if (inp.pressed('ok', 1)) this.ping();
    } else this.cursor.on = false;
    const [wcx, wcy] = this.camera();
    this.weather.update(wcx, wcy);
    this.stepActor(this.hero);
    if (this.partner) this.stepActor(this.partner);
    for (const n of this.npcs) { this.npcWander(n); this.stepActor(n); }
    for (const f of this.ferals) { this.feralThink(f); this.stepActor(f); }
    if (!this.busy && this.hero.moving === 0) {
      for (const f of this.ferals) {
        if (f.alive && f.moving === 0 && f.x === this.hero.x && f.y === this.hero.y) { this.startBattle(f, 0); break; }
      }
    }
  }

  ping() {
    const [cx, cy] = this.camera();
    const tx = Math.floor((this.cursor.x + 4 + cx) / 8), ty = Math.floor((this.cursor.y + 4 + cy) / 8);
    this.game.audio.sfx('ring');
    const s = this.game.state!;
    for (const d of this.map.digs ?? []) {
      if (s.flags['dig_' + d.id]) continue;
      if (Math.abs(d.x - tx) + Math.abs(d.y - ty) <= 2) this.revealed.add(d.id);
    }
    for (const f of this.ferals) if (f.alive && Math.abs(f.x - tx) + Math.abs(f.y - ty) <= 2) f.stun = 180;
    this.emotes.push({ id: '@' + tx + ',' + ty, ch: '\u0003', t: 40 });
  }

  camera(): [number, number] {
    const a = this.controlPartner && this.partner ? this.partner : this.hero;
    let px = a.fx * 8 + 4, py = a.fy * 8 + 4;
    if (this.partner && this.game.input.twoPlayer) {
      px = (this.hero.fx + this.partner.fx) * 4 + 4;
      py = (this.hero.fy + this.partner.fy) * 4 + 4;
    }
    const mw = this.w * 8, mh = this.h * 8;
    const cx = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, px - W / 2));
    const cy = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, py - H / 2));
    return [Math.round(cx), Math.round(cy)];
  }

  worldMode(): Mode {
    const m = this.map.mode?.(this.ctx);
    if (m) return m;
    const tint = this.map.tint ? this.map.tint(this.ctx) : this.tint;
    if (!tint) return 'day';
    return (TINT_MODE[tint] ?? 'dusk') as Mode;
  }

  draw(g: Gfx) {
    const mode = this.worldMode();
    setMode(mode);
    try { this.drawWorld(g, mode); } finally { setMode('day'); g.anchorX = 0; g.anchorY = 0; }
    this.drawUi(g);
  }

  private drawWorld(g: Gfx, mode: Mode) {
    g.clear(this.map.bg ?? 'ink');
    let [cx, cy] = this.camera();
    if (this.shakeT > 0) { cx += (this.shakeT % 4 < 2 ? 1 : -1) * 2; }
    this.cam = [cx, cy];
    g.anchorX = ((-cx % 4) + 4) % 4;
    g.anchorY = ((-cy % 4) + 4) % 4;
    this.drawScene(g, cx, cy, mode);
    const lights = this.lights(g, mode, cx, cy);
    // At night the lit pools show the world in daylight colors, with a dithered edge.
    if (mode !== 'day' && mode !== 'blank' && lights.length && !this.map.dark) {
      g.masked(this.light.mask(lights), () => {
        setMode('day');
        g.clear(this.map.bg ?? 'ink');
        try { this.drawScene(g, cx, cy, mode); } finally { setMode(mode); }
      });
    }
    const amb = this.map.light?.(this.ctx)?.ambient ?? (this.map.dark ? 0.04 : 1);
    if (amb < 1) this.light.draw(g, amb, lights);
  }

  private drawScene(g: Gfx, cx: number, cy: number, mode: Mode) {
    const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
    const frame = Math.floor(g.t / 20) % 4;
    const lit = mode === 'night' || mode === 'dusk';
    for (let ty = y0; ty <= y0 + 24; ty++) for (let tx = x0; tx <= x0 + 24; tx++) {
      let t = this.tile(tx, ty);
      if (!t) continue;
      if (lit && t.k === 'window') t = { ...t, a: 'gold', b: 'cream' };
      const variant = hashStr(tx + ',' + ty) % 4;
      const sx = tx * 8 - cx, sy = ty * 8 - cy;
      g.image(tileCanvas(t, variant, ANIMATED_TILES.has(t.k) ? frame : 0), sx, sy);
      // Walls cast a short dithered shadow onto the floor below them.
      if (!t.solid && !t.water) {
        const up = this.tile(tx, ty - 1);
        if (up && up.solid && !up.water && up.k !== 'void' && up.k !== 'cloud') {
          g.dither(sx, sy, 8, 1, 'ink', 0.5);
          g.dither(sx, sy + 1, 8, 1, 'ink', 0.25);
        }
      }
    }
    // Revealed dig spots sparkle.
    const s = this.game.state!;
    for (const d of this.map.digs ?? []) {
      if (!this.revealed.has(d.id) || s.flags['dig_' + d.id]) continue;
      const sx = d.x * 8 - cx, sy = d.y * 8 - cy;
      const ph = Math.floor(g.t / 8) % 4;
      g.rect(sx + 3, sy + 1 + ph, 2, 2, 'gold');
      g.rect(sx + 1 + (ph % 2) * 5, sy + 4, 1, 1, 'cream');
    }
    if (this.map.draw) this.map.draw(g, cx, cy, this.ctx);
    const actors: Actor[] = [...this.npcs.filter((n) => n.visible), ...this.ferals.filter((f) => f.alive)];
    if (this.hero.visible) actors.push(this.hero);
    if (this.partner) actors.push(this.partner);
    actors.sort((a, b) => a.fy - b.fy);
    for (const a of actors) {
      const walking = a.moving > 0 || a.path.length > 0;
      const fr = walking ? Math.floor(g.t / 6) % 2 : Math.floor(g.t / 40) % 2;
      const size = sizeOf(a.scale);
      const fe = a as FeralRT;
      if (fe.fdef && fe.stun > 0 && Math.floor(g.t / 4) % 2) continue;
      const bx = Math.round(a.fx * 8 - cx), by = Math.round(a.fy * 8 - cy);
      const onWater = (a === this.hero || a === this.partner) && this.tile(Math.round(a.fx), Math.round(a.fy))?.water;
      if (onWater) {
        g.rect(bx - 1, by + 4, 10, 4, 'brown');
        g.rect(bx - 1, by + 5, 10, 1, 'tan');
        g.dither(bx - 1, by + 8, 10, 1, 'ink', 0.5);
      } else if (!a.ghost) g.shadow(bx + 4, by + 6, Math.min(16, size - 1), 0.5);
      if (fe.fdef) g.dither(bx, by + 7, 8, 1, 'maroon', Math.floor(g.t / 10) % 2 ? 0.5 : 0.25);
      g.sprite(a.sprite, bx - (size - 8) / 2, by - (size - 8), size, fr, a.dir === 3);
    }
    if (this.partner) {
      const a = this.controlPartner ? this.partner : this.hero;
      g.text('\u0005', Math.round(a.fx * 8 - cx + 2), Math.round(a.fy * 8 - cy - 9), 'gold');
    }
    this.weather.draw(g, cx, cy, g.t);
  }

  private lights(g: Gfx, mode: Mode, cx: number, cy: number): Light[] {
    const lc = this.map.light?.(this.ctx) ?? (this.map.dark ? { ambient: 0.04 } : mode !== 'day' && mode !== 'blank' ? { ambient: 1 } : null);
    if (!lc) return [];
    const lights: Light[] = [];
    const flick = (k: number) => Math.sin(g.t / 9 + k) * 1.5;
    const hx = this.hero.fx * 8 - cx + 4, hy = this.hero.fy * 8 - cy + 4;
    lights.push({ x: hx, y: hy, r: (this.map.dark ? 34 : 26) + (this.listenT > 0 ? 30 : 0) + flick(0) });
    if (this.partner) lights.push({ x: this.partner.fx * 8 - cx + 4, y: this.partner.fy * 8 - cy + 4, r: 26 });
    for (const [tx, ty, r] of lc.lights ?? []) lights.push({ x: tx * 8 + 4 - cx, y: ty * 8 + 4 - cy, r: r + flick(tx + ty) });
    for (const n of this.npcs) {
      if (!n.visible) continue;
      if (n.id.startsWith('phone')) lights.push({ x: n.fx * 8 + 4 - cx, y: n.fy * 8 + 2 - cy, r: 22 + flick(n.x) });
    }
    const glow = this.map.glow ?? (mode === 'night' || mode === 'dusk' ? { window: 16 } : {});
    if (Object.keys(glow).length) {
      const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
      for (let ty = y0 - 2; ty <= y0 + 26; ty++) for (let tx = x0 - 2; tx <= x0 + 26; tx++) {
        const t = this.tile(tx, ty);
        if (t && glow[t.k]) lights.push({ x: tx * 8 + 4 - cx, y: ty * 8 + 6 - cy, r: glow[t.k] + flick(tx * 3 + ty) });
      }
    }
    const s = this.game.state!;
    for (const d of this.map.digs ?? []) if (this.revealed.has(d.id) && !s.flags['dig_' + d.id]) lights.push({ x: d.x * 8 + 4 - cx, y: d.y * 8 + 4 - cy, r: 12 });
    return lights;
  }

  private drawUi(g: Gfx) {
    const [cx, cy] = this.cam;
    for (const e of this.emotes) {
      let ex = 0, ey = 0;
      if (e.id.startsWith('@')) {
        const [a, b] = e.id.slice(1).split(',').map(Number);
        ex = a * 8 - cx; ey = b * 8 - cy - 8;
      } else {
        const a = e.id === 'hero' ? this.hero : this.npcs.find((n) => n.id === e.id);
        if (!a) continue;
        ex = Math.round(a.fx * 8 - cx); ey = Math.round(a.fy * 8 - cy - 10 - (sizeOf(a.scale) - 8));
      }
      g.box(ex - 1, ey - 1, 10, 11, 'paper', 'paper');
      g.text(e.ch, ex + 2, ey + 1, 'ink');
    }
    if (this.listenT > 0) {
      const r = (50 - this.listenT) * 3;
      const hx = this.hero.fx * 8 - cx + 4, hy = this.hero.fy * 8 - cy + 4;
      g.alpha(this.listenT / 50, () => { g.circle(hx, hy, r, 'plea'); g.circle(hx, hy, r * 0.6, 'plea'); });
    }
    if (this.cursor.on) {
      g.text('\u0003', this.cursor.x, this.cursor.y, Math.floor(g.t / 10) % 2 ? 'gold' : 'cream', 'ink');
    }
    if (this.banner > 0 && this.map.name) {
      const w = textWidth(this.map.name) + 12;
      const a = Math.min(1, this.banner / 20);
      g.alpha(a, () => { g.box(96 - w / 2, 4, w, 15, 'gold'); g.textC(this.map.name, 96, 8, 'gold'); });
    }
    if (this.overlayText && this.overlayText.t > 0) {
      g.alpha(Math.min(1, this.overlayText.t / 20), () => g.textC(this.overlayText!.text, 96, 90, 'paper', 'ink'));
    }
    if (this.notice && this.notice.t > 0) {
      const n = this.notice;
      const w = textWidth(n.text) + 12;
      g.alpha(Math.min(1, n.t / 20), () => { g.box(96 - w / 2, 22, w, 15, 'mint'); g.textC(n.text, 96, 26, 'mint'); });
    }
    if (this.goalT > 0) {
      const lines = wrap('Goal: ' + goal(this.game.state!), 176);
      g.alpha(Math.min(1, this.goalT / 20), () => {
        g.box(2, 160 - lines.length * 10, 188, lines.length * 10 + 8, 'gold');
        lines.forEach((l, i) => g.text(l, 8, 164 - lines.length * 10 + i * 10, 'cream'));
      });
    }
    // A small speech bubble in the corner when the party has something to say. It plays from the Party menu.
    if (!this.busy && this.fade === 0 && nextTalk(this.game.state!)) {
      const by = 177 + (Math.floor(g.t / 40) % 2);
      g.box(174, by, 15, 11, 'mint');
      g.rect(178, by + 5, 1, 1, 'mint'); g.rect(181, by + 5, 1, 1, 'mint'); g.rect(184, by + 5, 1, 1, 'mint');
    }
    if (this.flashT > 0) g.alpha(this.flashT / 10, () => g.rect(0, 0, W, H, this.flashColor));
    g.fade(this.fade);
  }

  emote(id: string, ch: string) { this.emotes.push({ id, ch, t: 60 }); }
}
