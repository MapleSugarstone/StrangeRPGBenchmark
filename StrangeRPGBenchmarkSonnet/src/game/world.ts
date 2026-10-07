import { planBattle, randomEncounter } from '../core/encounter';
import { generateMap, type MapData, type MapNpc } from '../core/mapgen';
import { fullHeal, activeMembers, recover, setupChapter } from '../core/party';
import { EndChapter, runScript, type BattleResult, type Host } from '../core/script';
import { BOSSES, ENEMIES } from '../data/enemies';
import { GEAR, ITEMS, RUNES } from '../data/items';
import { chapter } from '../story/chapters';
import { C, rgb, type Screen } from '../gfx/screen';
import { icon, npcSprite, partySprite, tile } from '../gfx/sprites';
import { BattleScene } from './battlescene';
import { EndingScene } from './ending';
import type { Game, Scene } from './game';
import { MainMenu, ShopScene } from './menus';
import { CardBox, ChoiceBox, COL, Notify, SayBox, panel } from './ui';

const MOVE_FRAMES = 6;
const ROOM_FIGHT_CAP = 3;
/** Random fights are rarer than they used to be, so each one pays more to keep the party on the level curve. */
const RANDOM_REWARD = 1.8;
const VIEW = 16;

export class WorldScene implements Scene {
  musicKind = 'world' as const;
  map!: MapData;
  x = 0;
  y = 0;
  dx = 0;
  dy = 1;
  prog = 0;
  moving = false;
  trail: [number, number][] = [];
  busy = false;
  steps = 0;
  stepsSince = 0;
  nextEnc = 20;
  roomFights: Record<number, number> = {};
  lastRoom = 0;
  t = 0;
  host: GameHost;

  constructor(private g: Game, resume = false) {
    this.host = new GameHost(g, this);
    this.loadMap();
    if (resume) { this.x = g.state.map.x; this.y = g.state.map.y; this.dy = g.state.map.dir; }
    this.trail = Array.from({ length: 12 }, () => [this.x, this.y] as [number, number]);
    if (!resume) void this.startChapter();
  }

  get ch() { return chapter(this.g.state.chapter); }

  private loadMap() {
    this.map = generateMap(this.ch);
    this.x = this.map.start.x;
    this.y = this.map.start.y;
    this.lastRoom = 1;
    this.roomFights = {};
  }

  async startChapter() {
    const g = this.g;
    this.busy = true;
    this.loadMap();
    this.trail = Array.from({ length: 12 }, () => [this.x, this.y] as [number, number]);
    g.fade = 0;
    await g.overlay<void>((r) => new CardBox(this.ch.intro, r));
    if (!g.state.flags['mech' + g.state.chapter]) {
      g.state.flags['mech' + g.state.chapter] = true;
      await g.overlay<void>((r) => new CardBox(['NEW MECHANIC', this.ch.mechTitle, '', ...this.ch.mechText], r));
    }
    g.save();
    if (g.state.beat === 0) await this.runBeat(0);
    this.busy = false;
  }

  async runBeat(i: number) {
    const g = this.g;
    const b = this.ch.beats[i];
    this.busy = true;
    try {
      await runScript(b.script, this.host);
      g.state.beat = i + 1;
      g.state.flags[`beat${g.state.chapter}_${i + 1}`] = true;
    } catch (e) {
      if (e instanceof EndChapter) { await this.endChapter(); return; }
      throw e;
    } finally {
      this.busy = false;
    }
  }

  async endChapter() {
    const g = this.g;
    const s = g.state;
    if (s.chapter >= 12) { g.scenes = [new EndingScene()]; g.save('ending'); return; }
    s.chapter++;
    s.beat = 0;
    fullHeal(s);
    await this.startChapter();
  }

  jumpToChapter(n: number) {
    setupChapter(this.g.state, n);
    void this.startChapter();
  }

  // ------------------------------------------------------------------------ movement
  private solidAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return true;
    const t = this.map.grid[y][x];
    if (t.k === 'gate') {
      const gate = this.map.gates.find((gg) => gg.x === x && gg.y === y);
      return !(gate && this.g.state.beat >= gate.beat);
    }
    if (t.solid) return true;
    return this.npcAt(x, y) !== null;
  }

  private npcAt(x: number, y: number): MapNpc | null {
    return this.map.npcs.find((n) => n.x === x && n.y === y) ?? null;
  }

  update(g: Game) {
    this.t++;
    if (this.busy) return;
    const inp = g.input;
    if (this.moving) {
      this.prog += 1 / MOVE_FRAMES;
      if (this.prog >= 1) {
        this.prog = 0;
        this.moving = false;
        this.x += this.dx;
        this.y += this.dy;
        this.trail.unshift([this.x, this.y]);
        this.trail.length = 12;
        g.state.map = { x: this.x, y: this.y, dir: this.dy };
        void this.afterStep();
      }
      return;
    }
    if (inp.was('b') || inp.was('menu')) { g.audio.sfx('ok'); g.push(new MainMenu(this)); return; }
    if (inp.was('a')) { void this.interact(); return; }
    const d = inp.dir();
    if (d) {
      this.dx = d.dx; this.dy = d.dy;
      if (!this.solidAt(this.x + d.dx, this.y + d.dy)) { this.moving = true; this.prog = 0; }
    }
  }

  private async afterStep() {
    const g = this.g;
    const room = this.map.roomOf(this.x, this.y);
    if (room !== this.lastRoom && room >= 1 && room <= 8) this.lastRoom = room;
    const b = g.state.beat;
    if (b < 8 && b > 0) {
      const spot = this.map.beatSpot[b];
      if (spot.x === this.x && spot.y === this.y) { await this.runBeat(b); return; }
    }
    // Random encounters stop in a room after ROOM_FIGHT_CAP fights so backtracking is not interrupted.
    const fought = this.roomFights[room] ?? 0;
    if (room >= 2 && room <= 8 && fought < ROOM_FIGHT_CAP && !(g.state.beat === 5 && room === 6) && !(g.state.chapter === 1 && g.state.beat < 3)) {
      this.stepsSince++;
      if (this.stepsSince >= this.nextEnc) {
        this.stepsSince = 0;
        this.nextEnc = 18 + g.rng.int(14);
        this.roomFights[room] = fought + 1;
        await this.randomFight(room);
      }
    }
  }

  async randomFight(room: number) {
    const g = this.g;
    this.busy = true;
    g.flash = 10;
    await new Promise((r) => setTimeout(r, 250));
    const foes = randomEncounter(g.state, g.rng, room);
    const res = await this.host.battle(foes, false, (room - 2) / 5, RANDOM_REWARD);
    if (res === 'win') recover(g.state, 0.3, 0.2);
    this.busy = false;
  }

  async interact() {
    const g = this.g;
    const fx = this.x + this.dx, fy = this.y + this.dy;
    if (fx < 0 || fy < 0 || fx >= this.map.w || fy >= this.map.h) return;
    const t = this.map.grid[fy][fx];
    const npc = this.npcAt(fx, fy);
    this.busy = true;
    try {
      if (npc) {
        const def = this.ch.npcs.find((n) => n.id === npc.id)!;
        const keys = Object.keys(def.lines).map(Number).sort((a, b) => a - b);
        let k = keys[0];
        for (const x of keys) if (x <= g.state.beat) k = x;
        const isSign = def.id.startsWith('sign');
        for (const line of def.lines[k]) await this.host.say(isSign ? '' : def.name.toUpperCase(), line);
      } else if (t.k === 'chest') {
        const idx = this.map.chests.findIndex((c) => c.x === fx && c.y === fy);
        const key = `chest${g.state.chapter}_${idx}`;
        if (g.state.flags[key]) await this.host.notify('The chest is empty.');
        else {
          const def = this.ch.chests[idx];
          if (def.guard) {
            const first = ENEMIES[def.guard[0]].name;
            await this.host.notify(`The lid is held shut by ${first}, who has come back for a rematch.`);
            await this.host.battle(def.guard, true);
          }
          g.state.flags[key] = true;
          g.audio.sfx('chest');
          if (def.gold) { g.state.gold += def.gold; await this.host.notify(`Found ${def.gold} gold!`); }
          if (def.give) await runScript([{ give: def.give, n: def.n }], this.host);
        }
      } else if (t.k === 'shop') {
        g.push(new ShopScene());
      } else if (t.k === 'inn') {
        fullHeal(g.state);
        g.audio.sfx('heal');
        await this.host.notify('A warm spring bubbles up. The party is fully restored.');
      } else if (t.k === 'save') {
        fullHeal(g.state);
        const i = await this.host.choice('A crystal hums. Rest and save here?', ['SAVE AND REST', 'NOT NOW']);
        if (i === 0) {
          g.state.map = { x: this.x, y: this.y, dir: this.dy };
          g.save();
          g.audio.sfx('heal');
          await this.host.notify('Saved. The party is fully restored.');
        }
      } else if (t.k === 'gate') {
        const gate = this.map.gates.find((gg) => gg.x === fx && gg.y === fy);
        if (gate && g.state.beat < gate.beat) await this.host.notify('Sealed. Something must happen first. Check the JOURNAL in the menu.');
      }
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------ drawing
  draw(g: Game, s: Screen) {
    const th = this.ch.theme;
    const px = this.x + (this.moving ? this.dx * this.prog : 0);
    const py = this.y + (this.moving ? this.dy * this.prog : 0);
    const camX = Math.max(0, Math.min(this.map.w - VIEW, px - VIEW / 2 + 0.5));
    const camY = Math.max(0, Math.min(this.map.h - VIEW, py - VIEW / 2 + 0.5));
    const ox = -Math.round(camX * 8), oy = -Math.round(camY * 8);
    const x0 = Math.max(0, Math.floor(camX)), y0 = Math.max(0, Math.floor(camY));
    const gatesOpen = (x: number, y: number) => this.map.gates.some((gg) => gg.x === x && gg.y === y && g.state.beat >= gg.beat);
    for (let y = y0; y <= Math.min(this.map.h - 1, y0 + VIEW); y++) {
      for (let x = x0; x <= Math.min(this.map.w - 1, x0 + VIEW); x++) {
        const t = this.map.grid[y][x];
        let k = t.k;
        if (k === 'gate' && gatesOpen(x, y)) k = 'floor';
        const base = k === 'floor' || k === 'wall' || k === 'gate' ? null : (t.solid || k === 'flower' || k === 'web' || k === 'mark') ? 'floor' : null;
        if (base) s.sprite(tile(th, base), x * 8 + ox, y * 8 + oy);
        s.sprite(tile(th, k), x * 8 + ox, y * 8 + oy);
      }
    }
    // Next beat marker
    const nb = g.state.beat;
    if (nb > 0 && nb < 8) {
      const sp = this.map.beatSpot[nb];
      if (Math.floor(this.t / 20) % 2 === 0) s.sprite(tile(th, 'mark'), sp.x * 8 + ox, sp.y * 8 + oy);
      // Edge arrow toward the next story beat when it is off screen.
      const sx = sp.x * 8 + ox + 4, sy = sp.y * 8 + oy + 4;
      if ((sx < 0 || sx > 127 || sy < 0 || sy > 127) && Math.floor(this.t / 30) % 3 !== 2 && !this.busy) {
        const ax = Math.max(4, Math.min(123, sx)), ay = Math.max(4, Math.min(123, sy));
        const horizontal = Math.abs(sx - 64) > Math.abs(sy - 64);
        const ch = horizontal ? (sx < 0 ? '<' : '>') : sy < 0 ? '^' : 'V';
        s.rect(ax - 2, ay - 2, 7, 8, 0xff000000);
        s.text(ax - 1, ay - 2, ch, COL.hi);
      }
    }
    // NPCs
    for (const n of this.map.npcs) {
      const def = this.ch.npcs.find((d) => d.id === n.id)!;
      if (def.id.startsWith('sign')) { s.sprite(tile(th, 'sign'), n.x * 8 + ox, n.y * 8 + oy); continue; }
      const bob = Math.floor((this.t + n.x * 13) / 30) % 2;
      s.sprite(npcSprite(def.name), n.x * 8 + ox, n.y * 8 + oy - bob);
    }
    // Followers then leader
    const act = activeMembers(g.state);
    for (let i = act.length - 1; i >= 1; i--) {
      const [fx, fy] = this.trail[Math.min(this.trail.length - 1, i * 2)];
      s.sprite(partySprite(act[i].id), fx * 8 + ox, fy * 8 + oy);
    }
    if (act[0]) s.sprite(partySprite(act[0].id), Math.round(px * 8) + ox, Math.round(py * 8) + oy, { flipX: this.dx < 0 });
    if (g.state.beat < 8 && this.t < 240 && !this.busy) { /* objective hint lives in the journal */ }
    void C; void rgb; void icon; void GEAR; void ITEMS; void RUNES; void BOSSES;
  }
}

// ---------------------------------------------------------------------------- host
export class GameHost implements Host {
  losses: Record<string, number> = {};
  constructor(private g: Game, private world: WorldScene) {}
  get state() { return this.g.state; }
  say(who: string, text: string) { return this.g.overlay<void>((r) => new SayBox(who, text, r)); }
  card(lines: string[]) { return this.g.overlay<void>((r) => new CardBox(lines, r)); }
  choice(prompt: string, opts: string[]) { return this.g.overlay<number>((r) => new ChoiceBox(prompt, opts, r)); }
  notify(text: string) { return this.g.overlay<void>((r) => new Notify(text, r)); }
  async fx(kind: 'shake' | 'flash', n: number) {
    if (kind === 'shake') this.g.shake = Math.max(n, 6);
    else this.g.flash = 14;
    await new Promise((r) => setTimeout(r, 400));
  }
  heal() { fullHeal(this.g.state); }

  async battle(foes: string[], boss: boolean, pos = 0.5, reward = 1): Promise<BattleResult> {
    const g = this.g;
    for (;;) {
      g.flash = 8;
      const key = `${g.state.chapter}:${foes.join(",")}`;
      const plan = planBattle(g.state, foes, boss, g.rng, boss ? 0.85 : pos, true, this.losses[key] ?? 0);
      plan.xp = Math.round(plan.xp * reward);
      plan.gold = Math.round(plan.gold * reward);
      const res = await new Promise<BattleResult>((resolve) => g.push(new BattleScene(g, plan, resolve)));
      if (res === 'win' || res === 'flee') return res;
      const i = await this.choice('The party has fallen.', ['TRY AGAIN', 'BACK TO TITLE']);
      if (i === 1) {
        const { TitleScene } = await import('./title');
        g.scenes = [new TitleScene()];
        return new Promise<BattleResult>(() => { /* never resolves: scene replaced */ });
      }
      this.losses[key] = (this.losses[key] ?? 0) + 1;
      fullHeal(g.state);
      if (this.losses[key] >= 2) await this.notify("The foes hesitate. They seem a little weaker now.");
    }
  }
}
