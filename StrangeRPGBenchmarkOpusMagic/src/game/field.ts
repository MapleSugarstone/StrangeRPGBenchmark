// Walking around: tiles, actors, light, ink specks, encounters, reading things, and casting at them.
import { BodyRef, Val, isBody, show } from '../cant/ast';
import { CantError, DryError, Proc, World, compile, run } from '../cant/interp';
import { parse } from '../cant/parser';
import { VERBS } from '../cant/vocab';
import { sfx } from '../engine/audio';
import { music } from '../engine/music';
import { mapTrack } from './tunes';
import { MoverState, MoverWorld, answer, groupDone, moverRote, parseMover, stepAll, stepOne, writeInto } from './movers';
import { intoInk } from '../cant/analyze';
import { ASIDES, SPEAKER_COLOR, SPEAKER_NAME, Speaker } from './asides';
import { CW, text, textShadow, wrap } from '../engine/font';
import { down, pressed, tapped } from '../engine/input';
import { LightOpts, addLight, beginLight, blockLight, composite, rgbf, tint } from '../engine/light';
import { H, W, clearAux, ditherRect, rect } from '../engine/screen';
import { LIME, Look, TILES, TileDef, drawCopied, drawSprite, drawTile, dropShadow, spritePal } from '../engine/sprites';
import { ENCOUNTERS, FOES } from './enemies';
import { Scene, app } from './app';
import { ActorDef, FieldLog, LEGEND, MapDef, Region, check } from './mapkit';
const SPEAKER_COLOR_ROOM = 0xe6dfd0;
import { MAPS, REGIONS } from './maps';
import { canSay, lineLimit, pageLimit, maxHp, maxInk, saveGame, ticks, lastPage } from './state';
import { C, Menu, panel } from './ui';
import { markCount } from './dialogue';
import { game } from './game';
import { ChoiceMenu } from './screens';
import { openStetShop, opponentsFor, startStet } from './stet';
import { Reeling } from './reeling';

interface Actor {
  def: ActorDef;
  x: number;
  y: number;
  ox: number;
  oy: number;
  homeX: number;
  homeY: number;
  move: { fx: number; fy: number; t: number } | null;
  pulse: number;
  /** Where the pulse is heading. The pulse eases toward it so lights swell rather than blink. */
  kick: number;
  phase: number;
  stun: number;
  gone: boolean;
  /** A mover's running state. */
  mv?: MoverState;
}

interface Pulse { x: number; y: number; r: number; i: number; life: number; max: number; color: number }
interface Floater { s: string; x: number; y: number; life: number; color: number; vy: number }
interface Speck { x: number; y: number; vy: number; life: number; color: number }

const DIRS: [number, number][] = [[0, 1], [0, -1], [-1, 0], [1, 0]];

/** Tiles that block light. Thin things like fences, stalks, and cables let it through. */
const OPAQUE = new Set(['wall', 'wallTop', 'tower', 'window', 'roof', 'stall', 'pagewall', 'well',
  'claywall', 'eyewin', 'chimney', 'slate', 'archwin', 'slateroof', 'stampwall', 'twinwin', 'hut', 'panel', 'drop', 'textwall']);
const WINDOWS = new Set(['window', 'eyewin', 'archwin', 'twinwin', 'drop']);
const SWEPT = new Set(['Busy', 'the river', 'Twice']);

export class Field implements Scene {
  opaque = true;
  map!: MapDef;
  region!: Region;
  tiles: TileDef[][] = [];
  keys: string[][] = [];
  w = 0;
  h = 0;
  x = 0;
  y = 0;
  dir = 0;
  move: { fx: number; fy: number; t: number; speed: number } | null = null;
  trail: { x: number; y: number }[] = [];
  private followFlip: boolean[] = [];
  actors: Actor[] = [];
  camX = 0;
  camY = 0;
  locked = false;
  lockPresses = 0;
  lockTimer = 0;
  pulses: Pulse[] = [];
  floaters: Floater[] = [];
  specks: Speck[] = [];
  steps = 0;
  banner = 0;
  castMenu: Menu | null = null;
  readPanel: { title: string; lines: string[] } | null = null;
  fade = 0;
  hum = 0;
  stillFrames = 0;
  private readSweep = -1;
  removedThisVisit = new Set<string>();

  load(id: string, x: number, y: number, dir = 0) {
    const m = MAPS[id];
    if (!m) throw new Error(`no map ${id}`);
    this.map = m;
    const alts = [...(m.altRegions ?? []), ...(m.altRegion ? [m.altRegion] : [])];
    const alt = alts.find(([c]) => check(c, (fl) => !!app.s.flags[fl], app.s.chapter));
    this.region = REGIONS[alt ? alt[1] : m.region];
    this.h = m.rows.length;
    this.w = m.rows[0].length;
    const rl = this.region.legend ?? REGIONS[m.region].legend;
    this.keys = m.rows.map((r) => r.split('').map((ch) => (m.legend?.[ch] ?? rl?.[ch] ?? LEGEND[ch] ?? 'void')));
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.move = null;
    this.trail = [];
    this.removedThisVisit.clear();
    this.applyBecomes();
    this.refreshTiles();
    this.spawnActors();
    this.trail = this.startTrail();
    this.followFlip = app.s.party.map(() => dir === 2);
    this.banner = 150;
    this.fade = 16;
    this.hum = 0;
    const s = app.s;
    s.map = id; s.x = x; s.y = y;
    s.flags[`visited_${m.region}`] = true;
    music.play(mapTrack(id, s.chapter, s.flags));
    this.centerCamera();
  }

  private applyBecomes() {
    for (const a of this.map.actors) {
      if (a.puzzle?.becomes && app.s.flags[a.puzzle.flag]) this.keys[a.y][a.x] = LEGEND[a.puzzle.becomes] ?? a.puzzle.becomes;
    }
    const pre = `m_${this.map.id}_`;
    for (const k of Object.keys(app.s.flags)) {
      if (!k.startsWith(pre)) continue;
      const m = k.slice(pre.length).match(/^(fill|grow)_(\d+)_(\d+)$/);
      if (m) this.keys[+m[3]][+m[2]] = m[1] === 'fill' ? 'filled' : 'bridge';
    }
    for (const g of this.map.groups ?? []) {
      if (app.s.flags[g.flag]) for (const [x, y, t] of g.opens ?? []) this.keys[y][x] = LEGEND[t] ?? t;
    }
  }

  /** The view of this map the mover rules work on. */
  private moverWorld(): MoverWorld {
    return {
      w: this.w, h: this.h, keys: this.keys, actors: this.actors, px: this.x, py: this.y,
      solidAt: (x, y, ig) => this.solidAt(x, y, ig as Actor | undefined),
      retile: () => this.refreshTiles(),
      remember: (k) => { app.s.flags[`m_${this.map.id}_${k}`] = true; },
      spawnCopy: (a, x, y) => {
        const src = a as Actor;
        this.actors.push({ ...src, def: { ...src.def, id: `${src.def.id}_copy${this.actors.length}` }, x, y, move: { fx: src.x, fy: src.y, t: 0 },
          mv: { ...src.mv!, lines: [...src.mv!.lines], handlers: new Map(src.mv!.handlers) } });
      },
    };
  }

  /** Sets the flag of any mover group that has just come to rest on its plates. */
  private checkGroups() {
    const w = this.moverWorld();
    for (const g of this.map.groups ?? []) {
      if (app.s.flags[g.flag] || !groupDone(w, g.group)) continue;
      app.s.flags[g.flag] = true;
      for (const [x, y, t] of g.opens ?? []) this.keys[y][x] = LEGEND[t] ?? t;
      this.refreshTiles();
      sfx.door();
      music.stinger('secret');
      if (g.scene) this.later(20, () => game.play(g.scene!));
    }
  }

  private refreshTiles() {
    this.tiles = this.keys.map((r) => r.map((k) => TILES[k] ?? TILES.void));
  }

  cond(c: string | undefined) { return check(c, (f) => !!app.s.flags[f], app.s.chapter); }

  spawnActors() {
    const old = new Map(this.actors.map((a) => [a.def.id, a]));
    this.actors = [];
    for (const d of this.map.actors) {
      if (!this.cond(d.cond)) continue;
      if (d.kind === 'foe' && (app.s.done.includes(`${this.map.id}:${d.id}`) || this.removedThisVisit.has(d.id))) continue;
      if (d.kind === 'mark' && app.s.done.includes(`${this.map.id}:${d.id}`)) continue;
      if (d.puzzle && app.s.flags[d.puzzle.flag] && !d.puzzle.stays) continue;
      if (d.mover && app.s.flags[`m_${this.map.id}_used_${d.id}`]) continue;
      const prev = old.get(d.id);
      this.actors.push(prev ?? {
        def: d, x: d.x, y: d.y, ox: 0, oy: 0, homeX: d.x, homeY: d.y, move: null,
        pulse: 0, kick: 0, phase: Math.floor(Math.random() * 60), stun: 0, gone: false,
        mv: d.mover ? parseMover(d.mover) : undefined,
      });
    }
    for (const a of old.values()) if (a.def.id.includes('_copy') && !a.gone) this.actors.push(a);
  }

  enter() { this.runEnterScenes(); }
  background() { this.tick(); }
  resume() {
    this.spawnActors();
    music.play(mapTrack(this.map.id, app.s.chapter, app.s.flags));
  }

  runEnterScenes() {
    const map = this.map.id;
    const token = ++this.asideToken;
    this.later(60, () => { if (token === this.asideToken) this.aside(map, 20); });
    for (const [c, scene] of this.map.enter ?? []) {
      if (app.s.flags[`seen_${scene}`]) continue;
      if (!this.cond(c)) continue;
      app.s.flags[`seen_${scene}`] = true;
      game.play(scene);
      return;
    }
  }

  private asideToken = 0;

  /** One companion remarks on the place, the first time they are here. Waits out dialogue, then gives up. */
  private aside(map: string, tries: number) {
    if (this.map.id !== map) return;
    if (this.busy() || this.locked || this.move) { if (tries > 0) this.later(30, () => this.aside(map, tries - 1)); return; }
    const s = app.s;
    const along = (w: Speaker) => (w === 'gloss' ? !!s.flags.gloss_with : s.party.includes(w));
    const pick = (ASIDES[map] ?? []).find(([w]) => along(w) && !s.flags[`aside_${map}_${w}`]);
    if (!pick) return;
    const [w, line] = pick;
    s.flags[`aside_${map}_${w}`] = true;
    const rows = wrap(`${SPEAKER_NAME[w]}: ${line}`, 36);
    rows.forEach((r, k) => {
      const x = Math.max(2, Math.min(W - r.length * CW - 2, this.x * 8 - this.camX + 4 - (r.length * CW) / 2)) + this.camX;
      this.floaters.push({ s: r, x, y: this.y * 8 - 14 - (rows.length - 1 - k) * 8, life: 240, color: SPEAKER_COLOR[w], vy: -0.04 });
    });
  }

  /** Places followers in a line behind Wait on arrival, or under Wait where there is no room. */
  private startTrail(): { x: number; y: number }[] {
    const [dx, dy] = DIRS[this.dir];
    const out: { x: number; y: number }[] = [];
    let last = { x: this.x, y: this.y };
    for (let n = 1; n <= app.s.party.length + 1; n++) {
      const bx = this.x - dx * n, by = this.y - dy * n;
      const open = bx >= 0 && by >= 0 && bx < this.w && by < this.h && !this.tiles[by][bx].solid && !this.map.exits.some((e) => e.x === bx && e.y === by);
      if (open && last.x === this.x - dx * (n - 1) && last.y === this.y - dy * (n - 1)) last = { x: bx, y: by };
      out.push(last);
    }
    return out;
  }

  // ---------------------------------------------------------------- queries

  solidAt(x: number, y: number, ignore?: Actor): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    if (this.tiles[y][x].solid) return true;
    for (const a of this.actors) {
      if (a === ignore || a.gone) continue;
      if (a.def.solid === false || a.def.kind === 'deco' && a.def.light === undefined && a.def.sprite === 'page') continue;
      if (a.x === x && a.y === y) return true;
    }
    return false;
  }

  actorAt(x: number, y: number): Actor | null {
    return this.actors.find((a) => !a.gone && a.x === x && a.y === y) ?? null;
  }

  facing(): { x: number; y: number } {
    const [dx, dy] = DIRS[this.dir];
    return { x: this.x + dx, y: this.y + dy };
  }

  busy(): boolean { return app.top() !== this; }

  // ---------------------------------------------------------------- update

  update() {
    this.tick();
    if (this.fade > 0) return;
    if (this.castMenu) { this.updateCastMenu(); return; }
    if (this.readPanel) {
      if (tapped('ok') || tapped('back') || tapped('page')) { this.readPanel = null; sfx.back(); }
      return;
    }
    if (this.locked) { this.updateLocked(); return; }
    if (this.move) return;
    if (tapped('back')) { sfx.ok(); game.openMenu(); return; }
    if (tapped('cast')) { this.openCast(); return; }
    if (tapped('tab')) { game.showGoal(); return; }
    if (tapped('ok')) { this.interact(); return; }
    if (tapped('page')) { this.readFacing(); return; }
    for (let d = 0; d < 4; d++) {
      const a = (['down', 'up', 'left', 'right'] as const)[d];
      if (down(a)) { this.tryMove(d); break; }
    }
  }

  private timers: { at: number; fn: () => void }[] = [];
  private clock = 0;

  /** Runs a function a number of frames from now, in game time. */
  later(frames: number, fn: () => void) { this.timers.push({ at: this.clock + frames, fn }); }

  /** Animation and world simulation that runs even while a dialogue box is open. */
  tick() {
    const s = app.s;
    this.clock++;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.clock);
      this.timers = this.timers.filter((t) => t.at > this.clock);
      for (const t of due) t.fn();
    }
    s.time += 1 / 60;
    if (this.fade > 0) this.fade--;
    if (this.banner > 0) this.banner--;
    if (this.move) {
      this.move.t += this.move.speed;
      if (this.move.t >= 8) { this.move = null; this.arrive(); }
    }
    for (const a of this.actors) this.tickActor(a);
    this.pulses = this.pulses.filter((p) => --p.life > 0);
    for (const f of this.floaters) { f.life--; f.y += f.vy; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const sp of this.specks) { sp.y += sp.vy; sp.life--; }
    this.specks = this.specks.filter((sp) => sp.life > 0);
    this.spawnSpecks();
    const sw = this.sweepAt();
    if (sw && sw[2] > 0.5 && this.readSweep !== Math.floor(app.frame / 1500) && Math.hypot(sw[0] - this.x * 8 - 4, sw[1] - this.y * 8 - 4) < 22) {
      this.readSweep = Math.floor(app.frame / 1500);
      this.floaters.push({ s: 'read', x: this.x * 8 - 6, y: this.y * 8 - 10, life: 90, color: 0xd8d0ff, vy: -0.12 });
    }
    this.centerCamera();
    if (this.region === REGIONS.ears && !this.busy() && !this.move && !this.locked) {
      this.stillFrames++;
      if (this.stillFrames > 240) { this.hum = Math.min(100, this.hum + 0.4); }
    } else if (this.move) { this.stillFrames = 0; this.hum = Math.max(0, this.hum - 0.15); }
    if (this.hum >= 100) { this.hum = 0; this.stillFrames = 0; game.battle('static', null); }
  }

  private tickActor(a: Actor) {
    const d = a.def;
    if (a.move) {
      a.move.t += 1;
      if (a.move.t >= 8) {
        a.move = null;
        if (d.kind === 'foe' && a.x === this.x && a.y === this.y) this.touchFoe(a);
      }
    }
    const tempo = d.tempo ?? 60;
    const synced = d.copied || (d.syncFlag && app.s.flags[d.syncFlag]);
    if (synced) {
      a.pulse = 0.5 + 0.5 * Math.cos(app.beatPhase() * Math.PI * 2);
    } else if (d.look !== 'halted') {
      a.phase++;
      if (a.phase >= tempo) { a.phase = 0; a.kick = 1; }
      a.pulse += (a.kick - a.pulse) * 0.08;
      a.kick *= 0.97;
    }
    if (d.kind !== 'foe' || this.busy() || this.locked) return;
    if (a.stun > 0) { a.stun--; return; }
    if (a.move || (app.frame + a.phase) % 26 !== 0) return;
    const dx = this.x - a.x, dy = this.y - a.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    let step: [number, number] | null = null;
    if (dist <= 5) {
      const opts: [number, number][] = Math.abs(dx) > Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      for (const o of opts) {
        if (!o[0] && !o[1]) continue;
        const nx = a.x + o[0], ny = a.y + o[1];
        if (nx === this.x && ny === this.y) { step = o; break; }
        if (!this.solidAt(nx, ny, a)) { step = o; break; }
      }
    } else if (Math.random() < 0.4) {
      const o = DIRS[Math.floor(Math.random() * 4)];
      const nx = a.x + o[0], ny = a.y + o[1];
      const r = d.wander ?? 2;
      if (Math.abs(nx - a.homeX) <= r && Math.abs(ny - a.homeY) <= r && !this.solidAt(nx, ny, a) && !(nx === this.x && ny === this.y)) step = o;
    }
    if (step) {
      a.move = { fx: a.x, fy: a.y, t: 0 };
      a.x += step[0];
      a.y += step[1];
    }
  }

  private spawnSpecks() {
    const up = this.region.specks !== 'down';
    for (let n = 0; n < 3; n++) {
      const tx = Math.floor(this.camX / 8) + Math.floor(Math.random() * 25);
      const ty = Math.floor(this.camY / 8) + Math.floor(Math.random() * 25);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
      const t = this.tiles[ty][tx];
      if (!t.ink && !(this.region.specks === 'down' && Math.random() < 0.08)) continue;
      this.specks.push({
        x: tx * 8 + Math.random() * 8, y: ty * 8 + Math.random() * 8, vy: up ? -0.15 - Math.random() * 0.25 : 0.2 + Math.random() * 0.2,
        life: 60 + Math.floor(Math.random() * 80), color: t.ink ? this.region.accent[1] : this.region.accent[2],
      });
    }
  }

  private centerCamera() {
    let px = this.x * 8, py = this.y * 8;
    if (this.move) {
      const k = this.move.t / 8;
      px = (this.move.fx + (this.x - this.move.fx) * k) * 8;
      py = (this.move.fy + (this.y - this.move.fy) * k) * 8;
    }
    const mw = this.w * 8, mh = this.h * 8;
    this.camX = mw <= W ? (mw - W) / 2 : Math.max(0, Math.min(mw - W, px + 4 - W / 2));
    this.camY = mh <= H ? (mh - H) / 2 : Math.max(0, Math.min(mh - H, py + 4 - H / 2));
    this.camX = Math.round(this.camX);
    this.camY = Math.round(this.camY);
  }

  private tryMove(d: number) {
    this.dir = d;
    const [dx, dy] = DIRS[d];
    const nx = this.x + dx, ny = this.y + dy;
    const foe = this.actors.find((a) => !a.gone && a.def.kind === 'foe' && a.x === nx && a.y === ny);
    if (foe) { this.touchFoe(foe); return; }
    if (this.solidAt(nx, ny)) {
      const ex = this.map.exits.find((e) => e.x === nx && e.y === ny);
      if (!ex) return;
    }
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 9) this.trail.pop();
    this.move = { fx: this.x, fy: this.y, t: 0, speed: down('run') ? 2 : 1 };
    this.x = nx;
    this.y = ny;
    if (app.frame % 2 === 0) sfx.step();
  }

  private arrive() {
    const s = app.s;
    s.x = this.x; s.y = this.y;
    this.steps++;
    if (this.actors.some((a) => a.mv)) { stepAll(this.moverWorld()); this.checkGroups(); }
    if (this.steps % 6 === 0 && s.ink < maxInk(s)) s.ink++;
    const ex = this.map.exits.find((e) => e.x === this.x && e.y === this.y);
    if (ex) {
      if (this.cond(ex.cond)) {
        sfx.door();
        game.goto(ex.to, ex.tx, ex.ty, this.dir);
        return;
      }
      const back = this.trail.shift();
      if (back) { this.x = back.x; this.y = back.y; }
      if (ex.block) game.play(ex.block);
      return;
    }
    for (const tr of this.map.triggers) {
      const w = tr.w ?? 1, h = tr.h ?? 1;
      if (this.x < tr.x || this.y < tr.y || this.x >= tr.x + w || this.y >= tr.y + h) continue;
      if (s.flags[tr.once] || !this.cond(tr.cond)) continue;
      s.flags[tr.once] = true;
      game.play(tr.scene);
      return;
    }
    const foe = this.actors.find((a) => !a.gone && a.def.kind === 'foe' && a.x === this.x && a.y === this.y);
    if (foe) this.touchFoe(foe);
  }

  private touchFoe(a: Actor) {
    if (this.busy() || a.gone || a.stun > 0) return;
    const enc = a.def.enc;
    if (!enc) return;
    game.battle(enc, (result) => {
      if (result === 'win') {
        if (a.def.respawn) this.removedThisVisit.add(a.def.id);
        else app.s.done.push(`${this.map.id}:${a.def.id}`);
        a.gone = true;
        this.spawnActors();
      } else if (result === 'fled') {
        a.stun = 180;
        const back = this.trail[0];
        if (back && !this.solidAt(back.x, back.y)) { this.x = back.x; this.y = back.y; }
      }
    });
  }

  private updateLocked() {
    this.lockTimer++;
    let push = false;
    for (const a of ['up', 'down', 'left', 'right'] as const) if (tapped(a)) push = true;
    if (push) {
      this.lockPresses++;
      this.floaters.push({ s: 'wait', x: this.x * 8 - 6, y: this.y * 8 - 6, life: 50, color: 0x6a6478, vy: -0.3 });
      sfx.mute();
    }
    if (this.lockPresses >= 3 || this.lockTimer > 420) {
      this.lockPresses = -100;
      this.lockTimer = -100000;
      game.play('c1_sweep');
    }
  }

  // ---------------------------------------------------------------- interacting

  private interact() {
    const f = this.facing();
    const a = this.actorAt(f.x, f.y) ?? this.actorAt(this.x, this.y);
    if (!a) return;
    this.dir = this.dir;
    this.useActor(a);
  }

  private useActor(a: Actor) {
    const d = a.def;
    if (d.kind === 'lectern') { sfx.ok(); game.lectern(); return; }
    if (d.kind === 'mark') {
      app.s.marks++;
      app.s.done.push(`${this.map.id}:${d.id}`);
      sfx.get();
      this.say('A mark. +1 mark for the Grammar.', LIME);
      this.spawnActors();
      return;
    }
    const talkScene = d.talk?.find(([c]) => this.cond(c))?.[1];
    const plays = d.stet && opponentsFor(app.s.chapter, this.map.region).includes(d.stet) ? d.stet : null;
    if ((plays || d.reel) && !(talkScene && !app.s.flags[`seen_${talkScene}`])) {
      const opts: [string, () => void][] = [];
      if (talkScene) opts.push(['Talk', () => game.play(talkScene)]);
      if (d.reel) opts.push(['Take a line', () => app.push(new Reeling(d.reel!, () => saveGame(app.s)))]);
      if (plays) opts.push(['Play Stet', () => startStet(plays, () => this.spawnActors())]);
      if (d.stetShop) opts.push(['Stet cards', () => openStetShop()]);
      opts.push(['Leave', () => undefined]);
      sfx.ok();
      app.push(new ChoiceMenu(d.name ?? '', opts));
      return;
    }
    if (talkScene) { game.play(talkScene); return; }
    if (d.puzzle) {
      if (app.s.flags[d.puzzle.flag]) { this.say('It is open.', C.dim); return; }
      this.showRote(d.name ?? d.sprite, d.puzzle.rote, true);
      return;
    }
    if (d.rote || d.enc) this.readActor(a);
  }

  private readFacing() {
    const f = this.facing();
    const a = this.actorAt(f.x, f.y);
    if (!a) return;
    this.readActor(a);
  }

  private readActor(a: Actor) {
    const d = a.def;
    const foeKey = d.enc ? ENCOUNTERS[d.enc]?.foes[0] : undefined;
    const rote = a.mv && d.mover ? moverRote(d.mover, a.mv) : d.puzzle?.rote ?? d.rote ?? (foeKey ? FOES[foeKey]?.rote : undefined);
    if (rote === undefined) return;
    this.showRote(d.name ?? (foeKey ? FOES[foeKey]?.name : null) ?? d.sprite, rote || '(empty)', !!d.puzzle || !!a.mv);
  }

  showRote(title: string, rote: string, castable: boolean) {
    sfx.ok();
    const lines = rote.split('\n');
    if (castable) lines.push('', '(C casts a page at it.)');
    this.readPanel = { title: title.charAt(0).toUpperCase() + title.slice(1), lines };
  }

  say(s: string, color: number = C.text) {
    this.floaters.push({ s, x: Math.max(2, Math.min(W - s.length * CW - 2, this.x * 8 - this.camX + 4 - (s.length * CW) / 2)) + this.camX, y: this.y * 8 - 10, life: 120, color, vy: -0.15 });
  }

  // ---------------------------------------------------------------- casting in the field

  private openCast() {
    const pages = app.s.pages;
    this.castMenu = new Menu(pages.map((p) => ({ label: p.name, right: p.fixed ? '' : '' })), 8);
    this.castMenu.i = Math.max(0, pages.findIndex((p) => p.name === lastPage.name));
    sfx.ok();
  }

  private updateCastMenu() {
    const m = this.castMenu!;
    const r = m.update();
    if (r === -2) { this.castMenu = null; return; }
    if (r >= 0) {
      this.castMenu = null;
      lastPage.name = app.s.pages[r]?.name ?? '';
      this.castField(r);
    }
  }

  castField(i: number) {
    const s = app.s;
    const page = s.pages[i];
    const prog = parse(page.src);
    if (prog.diags.some((d) => d.sev === 'error')) { sfx.error(); this.say('That page has mistakes.', C.bad); return; }
    if (!page.fixed && prog.codeLines > pageLimit(s, page)) { sfx.error(); this.say('That page is too long.', C.bad); return; }
    const f = this.facing();
    const target = this.actorAt(f.x, f.y);
    const log: FieldLog = { verbs: {}, seq: [], said: [], lines: 0, written: [] };
    let refused = false;
    const meRef: BodyRef = { __body: true, id: 'wait', name: 'Wait' };
    const tRef: BodyRef | null = target ? { __body: true, id: target.def.id, name: target.def.name ?? target.def.sprite } : null;
    const lines = page.src.split('\n');
    let delay = 0;
    const queue: { s: string; mute: boolean }[] = [];
    const world: World = {
      name: (_p, n) => {
        if (n === 'me') return meRef;
        if (n === 'foe') return tRef;
        if (n === 'foes') return tRef ? [tRef] : [];
        if (n === 'allies') return [meRef];
        if (n === 'round') return 1;
        if (n === 'who' || n === 'by') return null;
        return undefined;
      },
      prop: (_p, obj: Val, name) => {
        if (!isBody(obj)) throw new CantError(`${show(obj)} has no ${name}`);
        const isMe = obj.id === 'wait';
        switch (name) {
          case 'hp': return isMe ? s.hp : 9;
          case 'max': return isMe ? maxHp(s) : 9;
          case 'ink': return isMe ? s.ink : 0;
          case 'name': return obj.name.toLowerCase();
          case 'up': return true;
          case 'next': return 'nothing';
          case 'pages': return isMe ? s.pages.map((p) => p.name) : [];
          case 'last': return 'nothing';
          case 'copied': return false;
          default: return 0;
        }
      },
      hpOf: () => 9,
      rand: (n) => Math.floor(Math.random() * n),
      canSay: (_p, w) => canSay(s, w),
      verb: (_p, v, t) => {
        const def = VERBS[v];
        if (!def) throw new CantError(`unknown verb ${v}`);
        if (s.ink < def.ink) throw new DryError(`not enough ink for ${v}`);
        s.ink -= def.ink;
        const tb = t === undefined ? (def.kind === 'harm' ? tRef : meRef) : t;
        if (Array.isArray(tb)) throw new CantError(`${v} needs one, not a list`);
        if (tb && isBody(tb) && tb.id === 'wait') {
          if (v === 'mend') s.hp = Math.min(maxHp(s), s.hp + 4);
          if (v === 'listen') {
            s.ink = Math.min(maxInk(s), s.ink + 2);
            if (target) { log.verbs.listen = (log.verbs.listen ?? 0) + 1; log.seq.push('listen'); }
            return true;
          }
        } else if (tb && target) {
          log.verbs[v] = (log.verbs[v] ?? 0) + 1;
          log.seq.push(v);
        }
        return false;
      },
      say: (_p, t) => { log.said.push(t); queue.push({ s: `"${t}"`, mute: false }); },
      into: (_p, t, body, text) => {
        if (Array.isArray(t)) throw new CantError('into needs one, not a list');
        if (!isBody(t)) throw new CantError(`into needs a body, not ${show(t)}`);
        if (t.id === 'wait') throw new CantError('Wait does not write into Wait');
        if (!target || t.id !== target.def.id) return;
        if (target.def.kind === 'npc' || target.def.kind === 'lectern') { refused = true; return; }
        const k = intoInk(body);
        if (s.ink < k) throw new DryError('not enough ink for into');
        s.ink -= k;
        log.written.push(text);
        if (target.mv) {
          const why = writeInto(target, text);
          queue.push({ s: why ?? `into ${target.def.name ?? target.def.sprite}: ${text}`, mute: !!why });
          if (!why) music.stinger('write');
        }
      },
      halt: (_p, t) => { if (s.ink < 3) throw new DryError('not enough ink for halt'); s.ink -= 3; if (isBody(t) && target && t.id === target.def.id) { log.verbs.halt = (log.verbs.halt ?? 0) + 1; log.seq.push('halt'); } },
      page: (_p, name) => {
        const pg = s.pages.find((x) => x.name === name);
        if (!pg) return null;
        const pr = parse(pg.src);
        return pr.diags.some((d) => d.sev === 'error') ? null : compile(pr.stmts);
      },
      line: (p, n, mute) => {
        log.lines++;
        const src = p.frameName === page.name ? lines[n - 1] : s.pages.find((x) => x.name === p.frameName)?.src.split('\n')[n - 1];
        queue.push({ s: (src ?? '').trim(), mute });
      },
    };
    const proc = new Proc(meRef, tRef, page.name, compile(prog.stmts));
    const r = run(proc, world, ticks(s), 1);
    for (const q of queue) {
      const at = delay;
      delay += 7;
      this.later(at, () => {
        this.floaters.push({ s: q.s, x: this.x * 8 + 4 - (q.s.length * CW) / 2, y: this.y * 8 - 8, life: 44, color: q.mute ? C.faint : C.hi, vy: -1 });
        if (!q.mute) {
          const w = q.s.split(/[\s(]/)[0];
          this.pulses.push({ x: this.x * 8 + 4, y: this.y * 8 + 4, r: 46 + Math.min(40, log.lines * 2), i: 0.9, life: 90, max: 90, color: tint(VERBS[w]?.color ?? 0xd8d0ff, 0.3) });
          sfx.line(VERBS[w]?.pitch ?? 5);
        }
      });
    }
    if (r.reason === 'dry') this.later(delay + 3, () => this.say('dry. not enough ink.', C.bad));
    else if (r.reason === 'tangled') this.later(delay + 3, () => this.say('tangled.', C.bad));
    else if (r.reason === 'error') this.later(delay + 3, () => this.say(r.msg ?? 'error', C.bad));
    if (refused && target) {
      this.later(delay + 3, () => this.say(`${(target.def.name ?? 'It').toUpperCase()}: No.`, C.bad));
      if (app.s.party.includes('room')) this.later(delay + 40, () => this.say('ROOM: Did you ask?', SPEAKER_COLOR_ROOM));
    }
    if (target?.mv) {
      const mw = this.moverWorld();
      const facing = this.dir;
      this.later(delay + 6, () => {
        for (const v of log.seq) { const note = answer(mw, target, v, facing); if (note) this.say(`It ${note}.`, C.dim); }
        // A line written in runs straight away: for a mover, now is its next turn.
        if (log.written.length) { const note = stepOne(mw, target); if (note) this.say(`It ${note}.`, C.dim); }
        this.checkGroups();
      });
    }
    if (target?.def.puzzle) {
      const pz = target.def.puzzle;
      this.later(delay + 8, () => {
        if (s.flags[pz.flag]) return;
        if (pz.need(log)) {
          s.flags[pz.flag] = true;
          sfx.door();
          if (pz.becomes) { this.keys[target.y][target.x] = LEGEND[pz.becomes] ?? pz.becomes; this.refreshTiles(); }
          if (pz.give) game.give(pz.give);
          this.spawnActors();
          if (pz.scene) game.play(pz.scene);
        } else {
          this.say('Nothing happens.', C.dim);
        }
      });
    }
  }

  // ---------------------------------------------------------------- drawing

  /** In Act 2 the Scrivener's light crosses the lower towns now and then: map position and strength, or null. */
  sweepAt(): [number, number, number] | null {
    if (app.s.chapter < 7 || !SWEPT.has(this.region.name)) return null;
    const k = (app.frame % 1500) / 640;
    if (k >= 1) return null;
    const mx = this.w * 8, my = this.h * 8;
    return [-70 + (mx + 140) * k, my * (0.2 + 0.6 * k) + Math.sin(k * Math.PI * 2) * 24, Math.sin(k * Math.PI)];
  }

  draw() {
    rect(0, 0, W, H, 0);
    clearAux();
    const reg = this.region;
    const frame = Math.floor(app.frame / 32) % 2;
    const tx0 = Math.floor(this.camX / 8), ty0 = Math.floor(this.camY / 8);
    const lights: [number, number, number, number, number, LightOpts?][] = [];
    const hushes: [number, number][] = [];
    for (let ty = ty0; ty <= ty0 + 24; ty++) {
      for (let tx = tx0; tx <= tx0 + 24; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const t = this.tiles[ty][tx];
        const key = this.keys[ty][tx];
        const sx = tx * 8 - this.camX, sy = ty * 8 - this.camY;
        if (t.hush) { hushes.push([sx, sy]); continue; }
        if (key === 'void') continue;
        const pal = t.pal ?? (t.tone === 1 ? reg.wall : t.tone === 2 ? reg.accent : reg.floor);
        if (key !== 'water' && key !== 'stars') rect(sx, sy, 8, 8, reg.floor[0]);
        drawTile(t, sx, sy, pal, frame);
        if (t.light) {
          const win = WINDOWS.has(key);
          const flick = win && app.s.chapter === 6 && reg.name === 'Busy' ? 0.8 + 0.1 * Math.cos(app.beatPhase() * Math.PI * 2) : 0.9;
          const col = win ? (reg.windowLight ?? 0xffb070) : key === 'water' || key === 'cable' ? reg.accent[1] : reg.accent[2];
          if (((tx * 7 + ty * 13) & 1) === 0 || key !== 'water') lights.push([sx + 4, sy + 4, t.light * 44, t.light * flick * 0.9, tint(col, 0.25)]);
        }
      }
    }
    const drawList: { y: number; fn: () => void }[] = [];
    for (const a of this.actors) {
      if (a.gone) continue;
      const [ax, ay] = this.actorPos(a);
      const sx = ax - this.camX, sy = ay - this.camY;
      if (sx < -32 || sy < -32 || sx > W + 32 || sy > H + 32) continue;
      const d = a.def;
      drawList.push({ y: ay, fn: () => this.drawActor(a, sx, sy) });
      const [lc, li, neg] = this.actorLight(a);
      if (li > 0) lights.push([sx + 4, sy + 4, (neg ? 34 : 46) + 4 * a.pulse, li, lc, { negative: neg, z: 10 }]);
      void d;
    }
    const party = app.s.party;
    for (let i = party.length - 1; i >= 0; i--) {
      const to = this.trail[Math.min(this.trail.length - 1, i)];
      if (!to) continue;
      const from = this.trail[Math.min(this.trail.length - 1, i + 1)];
      const k = this.move ? this.move.t / 8 : 1;
      if (to.x !== from.x) this.followFlip[i] = to.x < from.x;
      const fx = Math.round((from.x + (to.x - from.x) * k) * 8), fy = Math.round((from.y + (to.y - from.y) * k) * 8);
      const kind = party[i];
      const flip = this.followFlip[i] ?? false;
      const sx = fx - this.camX, sy = fy - this.camY;
      drawList.push({ y: fy - 0.5, fn: () => { dropShadow(sx + 1, sy + 7); drawSprite(kind, sx, sy, { frame: Math.floor(app.frame / 20) % 2, flip }); } });
      lights.push([sx + 4, sy + 4, 26, 0.4, tint(spritePal(kind)[2], 0.5), { z: 10 }]);
    }
    const [wx, wy] = this.playerPos();
    const marks = markCount();
    const unopened = !app.s.flags.rote_opened;
    drawList.push({
      y: wy + 0.1,
      fn: () => {
        dropShadow(wx - this.camX + 1, wy - this.camY + 7);
        drawSprite('wait', wx - this.camX, wy - this.camY, { frame: this.move ? Math.floor(this.move.t / 4) % 2 : 0, marks, flip: this.dir === 2, pal: unopened ? [0, 0x050406, 0] : undefined });
      },
    });
    if (!unopened) lights.push([wx - this.camX + 4, wy - this.camY + 2, 18 + Math.min(26, marks * 2), 0.35 + Math.min(0.45, marks * 0.04), 0xd8d0ff, { z: 8 }]);
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.fn();
    for (const p of this.pulses) lights.push([p.x - this.camX, p.y - this.camY, p.r * (0.6 + 0.4 * (p.life / p.max)), p.i * (p.life / p.max), p.color, { z: 10 }]);
    const sweep = this.sweepAt();
    if (sweep) lights.push([sweep[0] - this.camX, sweep[1] - this.camY, 74, 0.8 * sweep[2], 0xd8d0ff, { z: 36 }]);
    const amb = rgbf(reg.amb ?? 0xffffff);
    const a = reg.ambient * 1.5;
    beginLight([amb[0] * a, amb[1] * a, amb[2] * a], (px, py) => this.opaqueAt(px + this.camX, py + this.camY));
    for (const [x, y, r, i, c, o] of lights) addLight(x, y, r, i, c, o);
    for (const [hx, hy] of hushes) blockLight(hx - 2, hy - 2, 12, 12);
    if (!(globalThis as { noLight?: boolean }).noLight) composite();
    for (const [hx, hy] of hushes) { rect(hx, hy, 8, 8, 0); ditherRect(hx, hy, 8, 8, 0x2a2836, (app.frame >> 4) & 1); }
    for (const sp of this.specks) {
      const sx = Math.round(sp.x - this.camX), sy = Math.round(sp.y - this.camY);
      if (sx >= 0 && sy >= 0 && sx < W && sy < H) rect(sx, sy, 1, 1, sp.color);
    }
    for (const f of this.floaters) {
      const alpha = f.life > 12 || Math.floor(f.life / 2) % 2;
      if (alpha) textShadow(f.s, Math.round(f.x - this.camX), Math.round(f.y - this.camY), f.color);
    }
    this.drawHud();
    if (this.castMenu) this.drawCastMenu();
    if (this.readPanel) this.drawReadPanel();
    if (this.fade > 0) ditherRect(0, 0, W, H, 0, this.fade & 1);
  }

  /** Whether a map pixel lies inside something that blocks light. */
  private opaqueAt(mx: number, my: number): boolean {
    const tx = Math.floor(mx / 8), ty = Math.floor(my / 8);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    return OPAQUE.has(this.keys[ty][tx]);
  }

  /** The color and strength of an actor's light. A rote's light has the color of its first verb. */
  private actorLight(a: Actor): [number, number, boolean] {
    const d = a.def;
    if (d.look === 'halted' || d.sprite === 'none') return [0, 0, false];
    if (d.sprite === 'lull') return [0xffffff, 0.6, true];
    if (d.copied || (d.syncFlag && app.s.flags[d.syncFlag])) return [LIME, 0.55 + 0.15 * a.pulse, false];
    const base = d.light ?? (d.kind === 'npc' ? 0.95 : d.kind === 'foe' ? 0.6 : d.kind === 'lectern' ? 0.8 : d.kind === 'mark' ? 0.6 : d.kind === 'object' ? 0.2 : 0);
    if (base <= 0) return [0, 0, false];
    const first = (d.rote ?? (d.enc ? FOES[ENCOUNTERS[d.enc]?.foes[0] ?? '']?.rote : '') ?? '').split('\n').find((l) => l.trim() && !l.trim().startsWith('#'))?.trim().split(/\s/)[0] ?? '';
    const col = VERBS[first]?.color ?? spritePal(d.sprite)[2];
    return [tint(col, 0.12), base * (0.88 + 0.12 * a.pulse), false];
  }

  private drawActor(a: Actor, sx: number, sy: number) {
    const d = a.def;
    const frame = Math.floor((app.frame + a.phase) / 24) % 2;
    if (d.puzzle && app.s.flags[d.puzzle.flag] && d.puzzle.solvedSprite) { drawSprite(d.puzzle.solvedSprite, sx, sy); return; }
    if (d.sprite === 'none' || (d.sprite === 'page' && d.kind !== 'object')) return;
    if (d.copied || (d.syncFlag && app.s.flags[d.syncFlag])) {
      if (d.copied) drawCopied(d.sprite, sx, sy, { frame: app.beat(), flip: d.flip }, app.beat());
      else { drawSprite(d.sprite, sx - 1, sy, { look: 'copied', dither: 0, frame: app.beat() }); drawSprite(d.sprite, sx, sy, { frame: app.beat(), flip: d.flip }); }
      return;
    }
    const big = d.sprite.endsWith('16') || d.sprite.endsWith('32');
    if (!big && d.kind !== 'object' && d.kind !== 'deco') dropShadow(sx + 1, sy + 7);
    drawSprite(d.sprite, sx - (big ? 4 : 0), sy - (big ? 8 : 0), { frame: d.look === 'halted' ? 0 : frame, look: d.look as Look | undefined, flip: d.flip });
    if (d.look === 'halted') rect(sx, sy + 4, 8, 1, 0xff3a3a);
  }

  private actorPos(a: Actor): [number, number] {
    if (!a.move) return [a.x * 8, a.y * 8];
    const k = a.move.t / 8;
    return [(a.move.fx + (a.x - a.move.fx) * k) * 8, (a.move.fy + (a.y - a.move.fy) * k) * 8];
  }

  playerPos(): [number, number] {
    if (!this.move) return [this.x * 8, this.y * 8];
    const k = this.move.t / 8;
    return [Math.round((this.move.fx + (this.x - this.move.fx) * k) * 8), Math.round((this.move.fy + (this.y - this.move.fy) * k) * 8)];
  }

  private drawHud() {
    if (this.banner > 0 && this.banner < 140) {
      const name = this.region.name;
      if (this.banner > 20 || this.banner % 4 < 2) textShadow(name, 4, 4, C.text);
    }
    if (this.region === REGIONS.ears && this.hum > 0) {
      text('hum', 4, H - 10, C.kw);
      rect(22, H - 8, 50, 2, C.faint);
      rect(22, H - 8, Math.round(this.hum / 2), 2, LIME);
    }
  }

  private drawCastMenu() {
    const m = this.castMenu!;
    const h = Math.min(8, m.items.length) * 8 + 16;
    panel(110, 8, 78, h, C.hi);
    text('cast', 114, 11, C.dim);
    text(`ink ${app.s.ink}`, 150, 11, C.hi);
    m.draw(114, 21, 70);
  }

  private drawReadPanel() {
    const p = this.readPanel!;
    const h = p.lines.length * 8 + 18;
    const y = Math.max(4, 120 - h);
    panel(4, y, 184, h, C.kw);
    text(p.title, 9, y + 4, C.hi);
    p.lines.forEach((l, i) => {
      const isAside = l.trim().startsWith('#');
      const isHint = l.startsWith('(');
      text(l.slice(0, 35), 9, y + 14 + i * 8, isAside ? C.aside : isHint ? C.dim : C.text);
    });
  }
}
