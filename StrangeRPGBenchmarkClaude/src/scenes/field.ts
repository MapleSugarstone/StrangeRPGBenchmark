import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { SW, SH } from '../core/gfx';
import { hash2 } from '../core/rng';
import { Col, HUE_COLOR, Pal3 } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';
import { BASE_THEME } from '../maps/tiles';
import { DIRS, Ent } from '../game/world';
import type { Dir } from '../game/state';
import { save, healAll } from '../game/state';
import { MEMBERS } from '../data/members';
import { MenuScene } from './menu';
import { centerBox } from './ui';
import { textW } from '../core/font';

const PROP_PAL: Record<string, Pal3> = {
  chest: ['k', 'n2', 'y2'],
  lamp: ['k', 'g2', 'y3'],
  lampOff: ['k', 'g2', 'g1'],
  sign: ['k', 'n2', 'n3'],
};

export class FieldScene implements Scene {
  px = 0;
  py = 0;
  moving = 0;
  mdx = 0;
  mdy = 0;
  step = 0;
  encSteps = 0;
  flashC: Col | null = null;
  flashT = 0;
  private scripted: { dir: Dir; left: number; res: () => void } | null = null;
  private entMoves: { e: Ent; path: string[]; res: () => void; t: number }[] = [];

  constructor(private g: Game) {}

  onMapLoaded() {
    this.moving = 0;
    this.encSteps = 0;
    this.px = this.g.st.x * 8;
    this.py = this.g.st.y * 8;
  }

  flash(c: Col) {
    this.flashC = c;
    this.flashT = 12;
  }

  private get w() { return this.g.world!; }

  update() {
    const g = this.g;
    const st = g.st;
    if (!g.world) return;
    this.updateEnts();
    if (this.flashT > 0) this.flashT--;
    if (this.moving > 0) {
      this.moving--;
      this.px += this.mdx;
      this.py += this.mdy;
      if (this.moving === 0) this.arrive();
      return;
    }
    if (this.scripted) {
      const s = this.scripted;
      if (s.left <= 0) { this.scripted = null; s.res(); return; }
      s.left--;
      this.startMove(s.dir, true);
      return;
    }
    if (g.busy > 0 || g.top !== this) return;
    const inp = g.input;
    if (inp.pressed('b')) { g.audio.sfx('ok'); g.push(new MenuScene(g)); return; }
    if (inp.pressed('a')) { this.interact(); return; }
    if (inp.pressed('c')) { this.special(); return; }
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      if (inp.isDown(d)) {
        st.facing = d;
        this.startMove(d, false);
        break;
      }
    }
  }

  private startMove(d: Dir, scripted: boolean) {
    const st = this.g.st;
    st.facing = d;
    const [dx, dy] = DIRS[d];
    const nx = st.x + dx, ny = st.y + dy;
    if (!scripted && !this.w.passable(nx, ny, st)) {
      if (this.g.frame % 16 === 0) this.g.audio.sfx('bump');
      return;
    }
    st.x = nx;
    st.y = ny;
    this.mdx = dx;
    this.mdy = dy;
    this.moving = 8;
  }

  private arrive() {
    const g = this.g;
    const st = g.st;
    st.steps++;
    this.step++;
    if (this.scripted) return;
    const t = this.w.tile(st.x, st.y, st);
    if (t.paint && st.tint !== t.paint) {
      st.tint = t.paint;
      g.audio.sfx('magic');
    }
    const e = this.w.entAt(st.x, st.y);
    if (e && (e.def.kind === 'warp' || e.def.kind === 'trigger')) {
      if (e.def.kind === 'warp' && e.def.to) {
        const [m, mk, dir] = e.def.to;
        g.run(async s => s.warp(m, mk, dir));
        return;
      }
      if (e.def.step) { g.run(e.def.step); return; }
    }
    if (t.belt) {
      const [dx, dy] = DIRS[t.belt];
      if (this.w.passable(st.x + dx, st.y + dy, st)) {
        st.x += dx; st.y += dy;
        this.mdx = dx; this.mdy = dy;
        this.moving = 6;
        this.px = (st.x - dx) * 8;
        this.py = (st.y - dy) * 8;
        return;
      }
    }
    const enc = this.w.def.enc;
    const safe = this.w.def.dark !== undefined && this.lights().slice(1).some(([lx, ly]) => Math.hypot(lx - st.x, ly - st.y) < 3);
    if (t.enc && enc && !st.flags.noEnc && !safe) {
      this.encSteps++;
      const ramp = Math.max(0, Math.min(1, (this.encSteps - 5) / 8));
      if (g.rng.chance(enc.rate * ramp)) {
        this.encSteps = 0;
        const group = g.rng.weighted(enc.groups, x => x[1])[0];
        g.audio.sfx('enc');
        g.run(async s => { await s.battle(group); });
      }
    }
  }

  private interact() {
    const g = this.g;
    const st = g.st;
    const [dx, dy] = DIRS[st.facing];
    const e = this.w.entAt(st.x + dx, st.y + dy) ?? this.w.entAt(st.x, st.y);
    if (!e) return;
    const def = e.def;
    if (def.kind === 'npc' && def.talk) {
      const back: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      e.dir = back[st.facing];
      g.run(def.talk);
      return;
    }
    if (def.talk) { g.run(def.talk); return; }
    const key = `${this.w.def.id}:${def.id}`;
    if (def.kind === 'chest') {
      if (st.flags[`open:${key}`]) { g.run(async s => s.tell('Empty.')); return; }
      st.flags[`open:${key}`] = true;
      g.run(async s => {
        if (def.item) await s.give(def.item, def.n ?? 1);
        if (def.gold) await s.gold(def.gold);
      });
      return;
    }
    if (def.kind === 'sign') { g.run(async s => s.tell(def.text ?? '')); return; }
    if (def.kind === 'lamp') {
      g.run(async s => {
        if (!st.flags[`lit:${key}`]) {
          st.flags[`lit:${key}`] = true;
          s.sfx('save');
          s.flash('y3');
          await s.tell('You light the lamp. The dark steps back.');
        }
        const i = await s.ask('The lamp is warm.', ['Rest and save', 'Leave']);
        if (i === 0) {
          healAll(st);
          const ok = save(st);
          s.sfx('save');
          await s.tell(ok ? 'The party rests. Progress saved.' : 'The party rests. Saving failed in this browser.');
        }
      });
    }
  }

  private special() {
    const g = this.g;
    const st = g.st;
    const def = this.w.def;
    if (def.past && st.items.sundial) {
      st.past = !st.past;
      if (!this.w.passable(st.x, st.y, st) && this.w.tile(st.x, st.y, st).solid) {
        st.past = !st.past;
        g.audio.sfx('bump');
        g.banner = { text: 'Something is in the way then.', t: 70 };
        return;
      }
      g.audio.sfx('shift');
      this.flash('w');
      g.banner = { text: st.past ? 'The past' : 'The present', t: 70 };
      this.w.refresh(st);
      return;
    }
    g.audio.sfx('bump');
  }

  private updateEnts() {
    const st = this.g.st;
    for (const m of this.entMoves.slice()) {
      const e = m.e;
      if (m.t > 0) {
        m.t--;
        const [dx, dy] = DIRS[e.dir];
        e.ox += dx;
        e.oy += dy;
        if (m.t === 0) { e.x += dx; e.y += dy; e.ox = 0; e.oy = 0; }
        continue;
      }
      const c = m.path.shift();
      if (!c) { this.entMoves = this.entMoves.filter(x => x !== m); m.res(); continue; }
      const d: Dir = c === 'u' ? 'up' : c === 'd' ? 'down' : c === 'l' ? 'left' : 'right';
      e.dir = d;
      m.t = 8;
    }
    if (this.g.busy > 0) return;
    for (const e of this.w.ents) {
      if (!e.def.wander || e.hidden || this.entMoves.some(m => m.e === e)) continue;
      if (--e.wanderT > 0) continue;
      e.wanderT = 90 + Math.floor(this.g.rng.next() * 150);
      const d = this.g.rng.pick(['up', 'down', 'left', 'right'] as Dir[]);
      const [dx, dy] = DIRS[d];
      const nx = e.x + dx, ny = e.y + dy;
      if (Math.abs(nx - e.hx) > 2 || Math.abs(ny - e.hy) > 2) continue;
      if (!this.w.passable(nx, ny, st) || (nx === st.x && ny === st.y)) continue;
      e.dir = d;
      this.entMoves.push({ e, path: [], res: () => {}, t: 8 });
    }
  }

  moveEnt(id: string, path: string): Promise<void> {
    const e = this.w.ent(id);
    if (!e) return Promise.resolve();
    return new Promise(res => this.entMoves.push({ e, path: path.split(''), res, t: 0 }));
  }

  movePlayer(path: string): Promise<void> {
    const steps = path.split('');
    return new Promise(res => {
      const next = () => {
        const c = steps.shift();
        if (!c) { res(); return; }
        const d: Dir = c === 'u' ? 'up' : c === 'd' ? 'down' : c === 'l' ? 'left' : 'right';
        this.scripted = { dir: d, left: 1, res: next };
      };
      next();
    });
  }

  camera(): [number, number] {
    const w = this.w.w * 8, h = this.w.h * 8;
    let cx = this.px + 4 - SW / 2;
    let cy = this.py + 4 - SH / 2;
    cx = w <= SW ? (w - SW) / 2 : Math.max(0, Math.min(w - SW, cx));
    cy = h <= SH ? (h - SH) / 2 : Math.max(0, Math.min(h - SH, cy));
    return [Math.round(cx), Math.round(cy)];
  }

  private lights(): [number, number, number][] {
    const st = this.g.st;
    const out: [number, number, number][] = [[this.px / 8, this.py / 8, this.w.def.dark ?? 3]];
    for (const e of this.w.ents) {
      if (e.hidden) continue;
      if (e.def.kind === 'lamp' && st.flags[`lit:${this.w.def.id}:${e.def.id}`]) out.push([e.x, e.y, 3.5]);
      if (e.def.kind === 'prop' && e.def.solid === false && e.def.text === 'light') out.push([e.x, e.y, 2.5]);
    }
    return out;
  }

  private darkness(x: number, y: number, lights: [number, number, number][]): number {
    let best = 99;
    for (const [lx, ly, r] of lights) {
      const d = Math.hypot(x - lx, y - ly) - r;
      if (d < best) best = d;
    }
    return best;
  }

  entSprite(e: Ent): SpriteSpec | undefined {
    const st = this.g.st;
    const key = `${this.w.def.id}:${e.def.id}`;
    switch (e.def.kind) {
      case 'chest': return { g: 'prop', pal: PROP_PAL.chest, o: { kind: st.flags[`open:${key}`] ? 'chestOpen' : 'chest' } };
      case 'lamp': {
        const lit = !!st.flags[`lit:${key}`];
        return { g: 'prop', pal: lit ? PROP_PAL.lamp : PROP_PAL.lampOff, o: { kind: lit ? 'lamp' : 'lampOff' } };
      }
      case 'sign': return e.spr ?? { g: 'prop', pal: PROP_PAL.sign, o: { kind: 'sign' } };
      default: return e.spr;
    }
  }

  playerSprite(): SpriteSpec {
    const st = this.g.st;
    const lead = st.party[0] ?? 'wick';
    const base = MEMBERS[lead].sprite;
    if (st.flags.skiff && this.w.tile(st.x, st.y, st).sea) return { g: 'prop', pal: ['k', 'n2', 'b3'], o: { kind: 'pot' } };
    if (st.tint) return { ...base, pal: [base.pal[0], base.pal[1], HUE_COLOR[st.tint]] };
    if (lead === 'wick' && st.flags.wickHue) return { ...base, pal: [base.pal[0], base.pal[1], String(st.flags.wickHue) as Col] as Pal3 };
    return base;
  }

  draw(g: Gfx) {
    const game = this.g;
    const st = game.st;
    const w = game.world;
    if (!w) return;
    const [cx, cy] = this.camera();
    const theme = w.def.theme ?? {};
    const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
    const frame = Math.floor(game.frame / 20);
    const dark = w.def.dark !== undefined;
    const lights = dark ? this.lights() : [];
    for (let ty = y0; ty <= y0 + 20; ty++) {
      for (let tx = x0; tx <= x0 + 20; tx++) {
        const t = w.tile(tx, ty, st);
        const kind = t.gate ? 'gate' : t.belt ? `belt_${t.belt}` : t.kind;
        let pal = theme[t.belt ? 'belt' : kind] ?? BASE_THEME[t.belt ? 'belt' : kind] ?? BASE_THEME.ground;
        if (t.gate) pal = ['k', HUE_COLOR[t.gate], 'w'];
        if (t.paint) pal = ['k', HUE_COLOR[t.paint], theme.ground?.[1] ?? 'e1'];
        const v = hash2(tx, ty) % 4;
        const sx = tx * 8 - cx, sy = ty * 8 - cy;
        if (t.paint) {
          const gp = theme.ground ?? BASE_THEME.ground;
          g.sprite({ g: 'tile', pal: gp, o: { kind: 'ground', v } }, sx, sy, { frame: 0 });
          g.sprite({ g: 'prop', pal, o: { kind: 'pool' } }, sx, sy);
        } else {
          const animated = !!t.belt || ['water', 'deep', 'static', 'void', 'edge', 'tall', 'antenna', 'gear', 'gate', 'cloud', 'thread', 'machine'].includes(kind);
          g.sprite({ g: 'tile', pal, o: { kind, v } }, sx, sy, { frame: animated ? (t.belt ? game.frame >> 2 : frame) % 8 : 0 });
        }
      }
    }
    const ents = w.ents.filter(e => !e.hidden).sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const spr = this.entSprite(e);
      if (!spr) continue;
      if (dark && this.darkness(e.x, e.y, lights) > 0.5) continue;
      const bob = e.def.kind === 'npc' && Math.floor((game.frame + e.hx * 11) / 30) % 2 === 0 ? 0 : 0;
      g.sprite(spr, e.x * 8 + e.ox - cx, e.y * 8 + e.oy - cy - bob, { flip: e.dir === 'left' });
    }
    const pb = this.moving > 0 && this.step % 2 === 0 ? 1 : 0;
    g.sprite(this.playerSprite(), Math.round(this.px - cx), Math.round(this.py - cy - pb), { flip: st.facing === 'left', grey: false });
    if (dark) this.drawDark(g, cx, cy, lights);
    if (this.flashT > 0 && this.flashC) g.overlay(this.flashC, this.flashT / 16);
    if (st.tint) {
      g.box(2, 2, 13, 11);
      g.rect(5, 5, 7, 5, HUE_COLOR[st.tint]);
    }
    if (w.def.past && st.items.sundial) {
      if (st.past) g.overlay('o3', 0.08);
      g.box(118, 2, 40, 11);
      g.text(st.past ? 'PAST' : 'NOW', 123, 5, st.past ? 'o3' : 'w');
      g.text('C', 150, 5, 'g1');
    }
    if (game.banner.t > 0 && game.banner.text) {
      const a = Math.min(1, game.banner.t / 20);
      g.alpha(a, () => centerBox(g, game.banner.text, 4));
    }
  }

  private drawDark(g: Gfx, cx: number, cy: number, lights: [number, number, number][]) {
    const x0 = Math.floor(cx / 8), y0 = Math.floor(cy / 8);
    for (let ty = y0; ty <= y0 + 20; ty++) {
      for (let tx = x0; tx <= x0 + 20; tx++) {
        const d = this.darkness(tx, ty, lights);
        const sx = tx * 8 - cx, sy = ty * 8 - cy;
        if (d > 0.9) g.rect(sx, sy, 8, 8, 'k', false);
        else if (d > 0.1) {
          for (let py = 0; py < 8; py++) for (let px = (py % 2); px < 8; px += 2) g.rect(sx + px, sy + py, 1, 1, 'k', false);
        } else if (d > -0.6) {
          for (let py = 0; py < 8; py += 2) for (let px = (py % 4 === 0 ? 0 : 2); px < 8; px += 4) g.rect(sx + px, sy + py, 1, 1, 'k', false);
        }
      }
    }
  }
}

export function nameWidth(s: string): number {
  return textW(s);
}
