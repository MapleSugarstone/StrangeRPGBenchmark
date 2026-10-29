// The battle screen. The arena is the map around the encounter. Foe plans lie on the ground as leads,
// and moving a light re-aims every one of them before the player commits.
import { blit, blitUI, box, rect, stampLead, ditherRect, type Img } from '../engine/gfx';
import { drawText, drawTextOutlined, textWidth, wrap, LINE_H, centerX } from '../engine/font';
import { C } from '../engine/palette';
import { H, W, shd } from '../engine/screen';
import { isDown, pressed, repeat } from '../engine/input';
import { F, TILE, renderMapBase, drawProps, lightScene } from '../game/field';
import { charImgs, charFrame, monImgs, icon, propImgs } from '../game/art';
import { SKILLS, entrySkill } from './skills';
import { FOES } from '../content/foes';
import { ITEMS } from '../content/items';
import type { BattleState, BEvent, Pos, Unit, Vec } from './types';
import {
  DIR8, cantUse, depthOf, foes, leadOf, party, previewTiles, reachable, moveUnit, undoMove, useSkill, useItem, runFoePhase,
  skillTiles, validTargets, visibleIntents, beamCovers, nextBeamAngle, lit, type Target,
} from './rules';
import { G, flag, setFlag } from '../game/state';
import { say, closeBox } from '../game/dialogue';
import { SCENES } from '../game/script';
import { sfx, playMusic, battleEvent, setBattleIntensity } from '../audio';
import { shake } from '../game/fx';

type Mode = 'intro' | 'select' | 'move' | 'act' | 'target' | 'item' | 'anim' | 'done' | 'tutorial';

interface Disp { x: number; y: number; px: number; py: number; lx: number; ly: number; hp: number; alive: boolean; fade: number; dying: number }
interface Float { x: number; y: number; text: string; color: number; t: number }

const AW = 18, AH = 13;
const PANEL_Y = 146;

export class BattleScreen {
  st: BattleState;
  ox: number;
  oy: number;
  camX: number;
  camY: number;
  mode: Mode = 'intro';
  cursor: Pos;
  sel: Unit | null = null;
  menu: string[] = [];
  menuI = 0;
  skill = '';
  targets: Target[] = [];
  targetI = 0;
  aimI = 0;
  reach: Pos[] = [];
  disp = new Map<number, Disp>();
  floats: Float[] = [];
  queue: BEvent[] = [];
  anim: { e: BEvent; t: number; dur: number } | null = null;
  flash: { tiles: Pos[]; t: number; color: number } | null = null;
  banner: { text: string; t: number } | null = null;
  time = 0;
  boss: boolean;
  resolve: (r: 'win' | 'lose' | 'run') => void = () => {};
  endBox: { lines: string[]; t: number } | null = null;
  loseChoice = 0;
  partyIdsAtStart: { id: string; hp: number }[] = [];
  lastSkill = new Map<string, number>();
  tutQueue: string[] = [];
  bannerShown = false;
  phased = false;
  wasLow = false;

  constructor(st: BattleState, ox: number, oy: number, boss: boolean) {
    this.st = st;
    this.ox = ox; this.oy = oy;
    this.boss = boss;
    const cxp = (ox + st.w / 2) * TILE, cyp = (oy + st.h / 2) * TILE;
    this.camX = Math.round(cxp - W / 2);
    this.camY = Math.round(cyp - (PANEL_Y - 12) / 2 - 6);
    const p0 = party(st)[0];
    this.cursor = { x: p0.x, y: p0.y };
    for (const u of st.units) this.disp.set(u.uid, this.mkDisp(u));
    this.partyIdsAtStart = party(st).map((u) => ({ id: u.id, hp: u.hp }));
  }

  mkDisp(u: Unit): Disp {
    const px = (this.ox + u.x) * TILE, py = (this.oy + u.y) * TILE;
    return { x: u.x, y: u.y, px, py, lx: px, ly: py, hp: u.hp, alive: u.alive, fade: 0, dying: 0 };
  }

  start(): Promise<'win' | 'lose' | 'run'> {
    sfx('battle_start');
    playMusic(this.boss ? (this.st.group === 'ch7_boss' ? 'boss_final' : 'boss') : 'battle');
    // The Great Lamp fight opens with the lamp already out of control, so its score starts one phase in.
    if (this.st.group === 'ch7_boss') battleEvent('boss_phase');
    if (this.st.lamps.length && this.st.dark) battleEvent('lamp_on');
    this.tutQueue = this.tutorials();
    this.mode = this.tutQueue.length ? 'tutorial' : 'select';
    if (this.mode === 'tutorial') this.runTutorials();
    return new Promise((r) => { this.resolve = r; });
  }

  // ---- Tutorials on first sight ----

  tutorials(): string[] {
    const st = this.st;
    const out: string[] = [];
    const once = (f: string, cond: boolean) => { if (cond && !flag('tut_' + f) && SCENES.has('tut_' + f)) out.push(f); };
    const has = (id: string) => party(st).some((u) => u.id === id);
    once('lead', true);
    once('downlight', true);
    once('touch', flag('tut_downlight'));
    once('depth', foes(st).some((f) => depthOf(st, f) >= 2) && flag('tut_lead'));
    once('pebble', (G.items.pebble ?? 0) > 0 && flag('tut_downlight'));
    once('note', flag('ch1_parhelia_met') && st.units.some((u) => u.side === 'foe') && foes(st).length >= 2);
    once('lamp', has('parhelia') && party(st).find((u) => u.id === 'parhelia')!.skills.includes('raise') && flag('ch2_started'));
    once('lantern', foes(st).some((f) => !!f.lantern));
    once('lot', has('lot'));
    once('painted', foes(st).some((f) => !!f.painter));
    once('short', F.region.id === 'bright');
    once('heat', st.heat.some((v) => v > 0));
    once('shade', has('umbraculum'));
    once('late', F.region.id === 'glass');
    once('pane', has('minim'));
    once('mirage', foes(st).some((f) => !!f.mirage));
    once('noon', F.region.id === 'overhead');
    once('dark', st.dark);
    once('tik', has('tik'));
    once('beam', !!st.beam);
    return out;
  }

  async runTutorials() {
    for (const t of this.tutQueue) {
      setFlag('tut_' + t);
      const sc = SCENES.get('tut_' + t);
      if (!sc) continue;
      for (const c of sc.cmds) {
        if (c.t === 'say') await say(c.speaker, c.text);
        else if (c.t === 'sys') await say(null, c.text);
      }
    }
    closeBox();
    this.tutQueue = [];
    this.mode = 'select';
  }

  // ---- Helpers ----

  unitAtCursor(): Unit | undefined { return this.st.units.find((u) => u.alive && this.drawPos(u).x === this.cursor.x && this.drawPos(u).y === this.cursor.y); }

  /** A mirage stands a tile off from where it is. */
  drawPos(u: Unit): Pos { return u.mirage ? { x: u.x + u.mirage[0], y: u.y + u.mirage[1] } : { x: u.x, y: u.y }; }

  skillList(u: Unit): string[] {
    const out = u.skills.filter((s) => SKILLS[s] || entrySkill(s));
    if (u.side === 'party' && Object.keys(G.items).some((k) => (G.items[k] ?? 0) > 0 && ITEMS[k]?.use)) out.push('item');
    out.push('wait');
    return out;
  }

  usableItems(): string[] { return Object.keys(G.items).filter((k) => (G.items[k] ?? 0) > 0 && ITEMS[k]?.use); }

  // ---- Update ----

  update(dt: number) {
    this.time += dt;
    const speed = isDown('run') ? 2.5 : 1;
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 0.9);
    if (this.flash) { this.flash.t -= dt * speed; if (this.flash.t <= 0) this.flash = null; }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.easeDisp(dt * speed);
    if (this.mode === 'tutorial') return;
    if (this.mode === 'done') { this.updateDone(); return; }
    if (this.anim || this.queue.length) { this.updateAnim(dt * speed); return; }
    if (this.mode === 'anim') {
      this.syncDisp();
      if (this.st.result) { this.finish(); return; }
      this.mode = 'select';
      if (party(this.st).every((u) => u.acted)) this.endRound();
      return;
    }
    switch (this.mode) {
      case 'select': this.updateSelect(); break;
      case 'move': this.updateMove(); break;
      case 'act': this.updateAct(); break;
      case 'target': this.updateTarget(); break;
      case 'item': this.updateItem(); break;
    }
  }

  moveCursor() {
    if (repeat('left')) this.cursor.x = Math.max(0, this.cursor.x - 1);
    if (repeat('right')) this.cursor.x = Math.min(this.st.w - 1, this.cursor.x + 1);
    if (repeat('up')) this.cursor.y = Math.max(0, this.cursor.y - 1);
    if (repeat('down')) this.cursor.y = Math.min(this.st.h - 1, this.cursor.y + 1);
  }

  updateSelect() {
    const before = { ...this.cursor };
    this.moveCursor();
    if (before.x !== this.cursor.x || before.y !== this.cursor.y) sfx('menu_move', { vol: 0.5 });
    if (pressed('a')) {
      const u = this.unitAtCursor();
      if (u && u.side === 'party' && !u.acted) {
        this.sel = u;
        this.reach = reachable(this.st, u);
        this.mode = 'move';
        sfx('menu_ok');
      } else if (!u || u.side === 'foe') {
        // Pressing on nothing selects the next member who still has a turn.
        const next = party(this.st).find((p) => !p.acted);
        if (next) { this.cursor = { x: next.x, y: next.y }; sfx('menu_move'); }
      }
    } else if (pressed('c')) this.endRound();
    else if (pressed('b')) {
      const next = party(this.st).find((p) => !p.acted);
      if (next) this.cursor = { x: next.x, y: next.y };
    }
  }

  updateMove() {
    this.moveCursor();
    const u = this.sel!;
    if (pressed('b')) { this.mode = 'select'; this.sel = null; sfx('menu_back'); return; }
    if (pressed('a')) {
      if (this.reach.some((p) => p.x === this.cursor.x && p.y === this.cursor.y)) {
        moveUnit(this.st, u, { ...this.cursor });
        this.syncDisp();
        this.openAct(u);
        sfx('menu_ok');
      } else sfx('menu_bad');
    }
  }

  openAct(u: Unit) {
    this.menu = this.skillList(u);
    const last = this.lastSkill.get(u.id);
    this.menuI = last !== undefined && last < this.menu.length ? last : 0;
    this.mode = 'act';
  }

  updateAct() {
    const u = this.sel!;
    if (repeat('up')) { this.menuI = (this.menuI + this.menu.length - 1) % this.menu.length; sfx('menu_move'); }
    if (repeat('down')) { this.menuI = (this.menuI + 1) % this.menu.length; sfx('menu_move'); }
    if (pressed('b')) {
      undoMove(this.st, u);
      this.syncDisp();
      this.reach = reachable(this.st, u);
      this.cursor = { x: u.x, y: u.y };
      this.mode = 'move';
      sfx('menu_back');
      return;
    }
    if (pressed('a')) {
      const id = this.menu[this.menuI];
      this.lastSkill.set(u.id, this.menuI);
      if (id === 'item') { this.mode = 'item'; this.menuI = 0; sfx('menu_ok'); return; }
      if (id === 'wait') { u.acted = true; this.afterAction(); return; }
      const why = cantUse(this.st, u, id);
      if (why) { sfx('menu_bad'); this.banner = { text: why, t: readTime(why) }; return; }
      this.skill = id;
      this.targets = validTargets(this.st, u, id);
      if (!this.targets.length) { sfx('menu_bad'); this.banner = { text: 'Nothing to aim at', t: readTime('Nothing to aim at') }; return; }
      this.targetI = 0;
      const sk = SKILLS[id];
      if (sk.kind === 'place' || sk.kind === 'ally' || sk.kind === 'foe') {
        const t0 = this.targets[0];
        const p = t0.pos ?? this.unitPos(t0.uid);
        if (p) this.cursor = { ...p };
      }
      this.mode = 'target';
      sfx('menu_ok');
    }
  }

  unitPos(uid?: number): Pos | null { const t = this.st.units.find((x) => x.uid === uid); return t ? this.drawPos(t) : null; }

  currentTarget(): Target | null {
    const sk = SKILLS[this.skill];
    if (!sk) return null;
    if (sk.kind === 'place') return this.targets.find((t) => t.pos!.x === this.cursor.x && t.pos!.y === this.cursor.y) ?? null;
    if (sk.kind === 'ally' || sk.kind === 'foe') return this.targets.find((t) => { const p = this.unitPos(t.uid); return p && p.x === this.cursor.x && p.y === this.cursor.y; }) ?? null;
    return this.targets[this.targetI] ?? null;
  }

  updateTarget() {
    const u = this.sel!;
    const sk = SKILLS[this.skill];
    if (pressed('b')) { this.mode = 'act'; sfx('menu_back'); return; }
    if (sk.kind === 'touch' || sk.kind === 'any') {
      const dirKey: [string, Vec][] = [['right', [1, 0]], ['down', [0, 1]], ['left', [-1, 0]], ['up', [0, -1]]];
      for (const [k, v] of dirKey) {
        if (pressed(k as 'up')) {
          // Two presses in a row make a diagonal.
          const cur = this.targets[this.targetI]?.aim ?? [0, 0];
          let want: Vec = v;
          if (cur[0] !== 0 && v[0] === 0 && cur[1] === 0) want = [cur[0], v[1]];
          else if (cur[1] !== 0 && v[1] === 0 && cur[0] === 0) want = [v[0], cur[1]];
          const i = this.targets.findIndex((t) => t.aim && t.aim[0] === want[0] && t.aim[1] === want[1]);
          const j = i >= 0 ? i : this.targets.findIndex((t) => t.aim && t.aim[0] === v[0] && t.aim[1] === v[1]);
          if (j >= 0) { this.targetI = j; sfx('menu_move'); }
        }
      }
    } else if (sk.kind === 'place' || sk.kind === 'ally' || sk.kind === 'foe') {
      this.moveCursor();
    }
    if (pressed('a')) {
      const t = this.currentTarget();
      if (!t) { sfx('menu_bad'); return; }
      const ok = useSkill(this.st, u, this.skill, t);
      if (!ok) { sfx('menu_bad'); return; }
      this.afterAction();
    }
  }

  updateItem() {
    const items = this.usableItems();
    if (!items.length) { this.mode = 'act'; return; }
    if (repeat('up')) { this.menuI = (this.menuI + items.length - 1) % items.length; sfx('menu_move'); }
    if (repeat('down')) { this.menuI = (this.menuI + 1) % items.length; sfx('menu_move'); }
    if (pressed('b')) { this.mode = 'act'; this.menuI = this.menu.indexOf('item'); sfx('menu_back'); return; }
    if (pressed('a')) {
      const u = this.sel!;
      const it = ITEMS[items[this.menuI]];
      const use = it.use!;
      let t: Target = { uid: u.uid };
      if (use.target === 'adjacent') {
        const hurt = party(this.st).filter((p) => Math.max(Math.abs(p.x - u.x), Math.abs(p.y - u.y)) <= 1).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        t = { uid: (hurt ?? u).uid };
      } else if (use.target === 'down') {
        const down = this.st.units.find((p) => p.side === 'party' && !p.alive && Math.max(Math.abs(p.x - u.x), Math.abs(p.y - u.y)) <= 1);
        if (!down) { sfx('menu_bad'); this.banner = { text: 'Nobody down nearby', t: readTime('Nobody down nearby') }; return; }
        t = { uid: down.uid };
      } else if (use.target === 'lead' && !leadOf(this.st, u)) { sfx('menu_bad'); this.banner = { text: 'No lead here', t: readTime('No lead here') }; return; }
      G.items[it.id] = (G.items[it.id] ?? 1) - 1;
      if (G.items[it.id] <= 0) delete G.items[it.id];
      useItem(this.st, u, use, t);
      this.afterAction();
    }
  }

  afterAction() {
    this.sel = null;
    this.queue.push(...this.st.events);
    this.st.events = [];
    this.mode = 'anim';
  }

  endRound() {
    this.sel = null;
    runFoePhase(this.st);
    this.queue.push(...this.st.events);
    this.st.events = [];
    this.mode = 'anim';
    const low = party(this.st).some((u) => u.hp <= u.maxHp / 3);
    setBattleIntensity(Math.min(1, 0.3 + this.st.round * 0.07 + (low ? 0.3 : 0)));
    if (low && !this.wasLow) battleEvent('low_hp');
    else if (!low && this.wasLow) battleEvent('calm');
    this.wasLow = low;
  }

  // ---- Animation ----

  updateAnim(dt: number) {
    if (!this.anim) {
      const e = this.queue.shift();
      if (!e) return;
      this.anim = { e, t: 0, dur: this.beginEvent(e) };
    }
    this.anim.t += dt;
    if (this.anim.t >= this.anim.dur) { this.anim = null; }
  }

  beginEvent(e: BEvent): number {
    const st = this.st;
    switch (e.k) {
      case 'move': {
        const d = this.disp.get(e.uid);
        const to = e.path[e.path.length - 1];
        if (d) { d.x = to.x; d.y = to.y; }
        sfx('step_' + F.region.step, { vol: 0.5 });
        return 0.22;
      }
      case 'skill': {
        const u = st.units.find((x) => x.uid === e.uid);
        this.flash = { tiles: e.tiles, t: 0.3, color: u?.side === 'foe' ? C.rust3 : C.gold3 };
        sfx(e.skill === 'raise' ? 'lamp_light' : e.skill === 'shade' || e.skill === 'great_shade' ? 'shade_raise' : e.skill === 'pane' ? 'pane_set' : e.skill === 'tug' || e.skill === 'drag' ? 'tug' : e.skill === 'slip' ? 'slip' : e.skill === 'note' ? 'note_mark' : 'lead_swing');
        return e.tiles.length ? 0.3 : 0.12;
      }
      case 'hit': {
        const d = this.disp.get(e.uid);
        const u = st.units.find((x) => x.uid === e.uid);
        if (d && u) {
          d.hp = Math.max(0, d.hp - e.dmg);
          this.floats.push({ x: d.px + 4, y: d.py - 2, text: String(e.dmg), color: u.side === 'party' ? C.rust3 : C.white, t: 0 });
        }
        const strong = e.dmg >= 4;
        sfx(strong ? 'strong_hit' : 'hit');
        if (strong) shake(1, 0.2);
        if (e.turned) { battleEvent('turned_hit'); this.floats.push({ x: (d?.px ?? 0) + 4, y: (d?.py ?? 0) - 10, text: 'turned', color: C.gold3, t: 0 }); }
        // The score steps up once when a boss falls under half its HP.
        if (u?.boss && d && !this.phased && d.hp <= u.maxHp / 2) { this.phased = true; battleEvent('boss_phase'); }
        return 0.28;
      }
      case 'heal': {
        const d = this.disp.get(e.uid);
        if (d) { d.hp += e.amt; d.alive = true; this.floats.push({ x: d.px + 4, y: d.py - 2, text: '+' + e.amt, color: C.green3, t: 0 }); }
        sfx('heal');
        return 0.25;
      }
      case 'miss': {
        const d = this.disp.get(e.uid);
        if (d) this.floats.push({ x: d.px + 4, y: d.py - 2, text: 'miss', color: C.gray, t: 0 });
        sfx('miss');
        return 0.2;
      }
      case 'down': {
        const d = this.disp.get(e.uid);
        if (d) { d.dying = 0.001; }
        const u = st.units.find((x) => x.uid === e.uid);
        sfx(u?.side === 'party' ? 'party_down' : 'enemy_die');
        return 0.6;
      }
      case 'status': {
        const d = this.disp.get(e.uid);
        if (d) this.floats.push({ x: d.px + 4, y: d.py - 8, text: e.status, color: C.lilac, t: 0 });
        return 0.15;
      }
      case 'lamp': battleEvent(e.on ? 'lamp_on' : 'lamp_off'); sfx(e.on ? 'lamp_light' : 'hood'); return 0.15;
      case 'note': {
        battleEvent('note_recorded');
        sfx('note_record');
        { const text = `New entry: ${SKILLS[e.skill]?.name ?? e.skill}`; this.banner = { text, t: readTime(text) }; }
        return 0.6;
      }
      case 'replay': sfx('pane_replay'); this.flash = { tiles: [{ x: e.x, y: e.y }], t: 0.3, color: C.teal3 }; return 0.25;
      case 'say': { const text = e.text === 'painted' ? 'Painted. Nothing there.' : e.text === 'chomp' ? 'It eats the light.' : e.text === 'mites' ? 'Mites taken' : e.text; this.banner = { text, t: readTime(text) }; return 0.8; }
      case 'phase': this.banner = { text: 'Foes move', t: 0.7 }; return 0.35;
    }
    return 0.1;
  }

  easeDisp(dt: number) {
    for (const u of this.st.units) {
      let d = this.disp.get(u.uid);
      if (!d) { d = this.mkDisp(u); this.disp.set(u.uid, d); }
      const tx = (this.ox + d.x) * TILE, ty = (this.oy + d.y) * TILE;
      // The lead gets there first.
      d.lx += (tx - d.lx) * Math.min(1, dt * 22);
      d.ly += (ty - d.ly) * Math.min(1, dt * 22);
      d.px += (tx - d.px) * Math.min(1, dt * 11);
      d.py += (ty - d.py) * Math.min(1, dt * 11);
      if (Math.abs(tx - d.px) < 0.5) d.px = tx;
      if (Math.abs(ty - d.py) < 0.5) d.py = ty;
      if (d.dying > 0) { d.dying += dt; if (d.dying > 0.6) { d.alive = false; d.dying = 0; } }
    }
  }

  syncDisp() {
    for (const u of this.st.units) {
      const d = this.disp.get(u.uid) ?? this.mkDisp(u);
      const p = this.drawPos(u);
      d.x = p.x; d.y = p.y; d.hp = u.hp;
      if (u.alive) { d.alive = true; d.dying = 0; }
      this.disp.set(u.uid, d);
    }
  }

  // ---- End ----

  finish() {
    this.mode = 'done';
    const st = this.st;
    if (st.result === 'win') {
      battleEvent('victory');
      const xp = foes({ ...st, units: st.units.map((u) => ({ ...u, alive: true })) } as BattleState).filter((f) => f.side === 'foe' && f.decoyOf === undefined).reduce((n, f) => n + f.xp, 0);
      const mites = st.units.filter((u) => u.side === 'foe' && u.decoyOf === undefined).reduce((n, f) => n + f.mites, 0);
      const lines = [`Won.`, `XP +${xp}   Mites +${mites}`];
      this.endBox = { lines, t: 0 };
      this.winXp = xp;
      this.winMites = mites;
      for (const s of st.learned) lines.push(`New entry: ${SKILLS[s]?.name ?? s}`);
    } else {
      battleEvent('defeat');
      this.endBox = { lines: ['The party falls.'], t: 0 };
    }
  }

  winXp = 0;
  winMites = 0;
  levelLines: string[] | null = null;

  updateDone() {
    if (!this.endBox) return;
    this.endBox.t += 1 / 60;
    if (this.endBox.t < 0.4) return;
    if (this.st.result === 'lose') {
      if (repeat('up') || repeat('down')) { this.loseChoice = 1 - this.loseChoice; sfx('menu_move'); }
      if (pressed('a')) this.resolve('lose');
      return;
    }
    if (pressed('a')) this.resolve('win');
  }

  // ---- Drawing ----

  render() {
    const st = this.st;
    const cx = this.camX, cy = this.camY;
    renderMapBase(cx, cy);
    drawProps(cx, cy);
    const ax = this.ox * TILE - cx, ay = this.oy * TILE - cy;
    // Placed lamps and panes.
    for (const l of st.lamps) blit(propImgs('lamp_post')[0], ax + l.x * TILE, ay + l.y * TILE - 8, { kind: 1 });
    for (const p of st.panes) rectWorld(ax + p.x * TILE + 1, ay + p.y * TILE, 6, 8, C.teal3);
    // Units, back to front.
    const order = st.units.slice().sort((a, b) => (this.disp.get(a.uid)?.py ?? 0) - (this.disp.get(b.uid)?.py ?? 0));
    for (const u of order) {
      const d = this.disp.get(u.uid)!;
      if (!d.alive && d.dying <= 0) continue;
      const im = this.unitImg(u);
      const x = Math.round(d.px) - cx, y = Math.round(d.py) - cy - (im.im.h - TILE);
      const fade = d.dying > 0 ? d.dying / 0.6 : u.decoyOf !== undefined ? 0.35 : 0;
      const rise = d.dying > 0 ? Math.round(d.dying * 10) : 0;
      blit(im.im, x, y - rise, { kind: u.side === 'foe' && st.dark && !lit(st, u.x, u.y) ? 2 : 2, flip: im.flip, fade });
      // Its lead, from where its lead has got to.
      if (u.alive && u.decoyOf === undefined) {
        const l = leadOf(st, u);
        if (l) {
          const lx = Math.round(d.lx) - cx, ly = Math.round(d.ly) - cy - (im.im.h - TILE);
          stampLead(im.im, lx, ly, l.dir[0], l.dir[1] * 0.85, l.len * TILE * 0.9, im.flip, 200);
        }
      }
    }
    // Foe plans on the ground.
    for (const f of foes(st)) {
      if (f.hat && !party(st).some((p) => Math.max(Math.abs(p.x - f.x), Math.abs(p.y - f.y)) <= 1)) continue;
      const vis = visibleIntents(st, f);
      vis.forEach((it, i) => {
        if (!it.skill) { stampTile(ax + it.dest.x * TILE + 2, ay + it.dest.y * TILE + 2, 110, false, 4); return; }
        const sk = SKILLS[it.skill];
        if (!sk) return;
        const ghost: Unit = { ...f, x: it.dest.x, y: it.dest.y };
        const tiles = skillTiles(st, ghost, sk, it.dest, it.aim);
        const strength = i === 0 ? 255 : i === 1 ? 160 : 100;
        for (const p of tiles) stampTile(ax + p.x * TILE, ay + p.y * TILE, strength, true);
        if (it.dest.x !== f.x || it.dest.y !== f.y) stampTile(ax + it.dest.x * TILE + 2, ay + it.dest.y * TILE + 2, 120, false, 4);
      });
      for (const it of f.fakes) {
        const tiles = skillTiles(st, { ...f, x: it.dest.x, y: it.dest.y }, SKILLS.brushstroke, it.dest);
        for (const p of tiles) stampTile(ax + p.x * TILE, ay + p.y * TILE, 255, false);
      }
      if (f.lateNext) {
        const sk = SKILLS[f.lateNext.skill];
        if (sk) for (const p of skillTiles(st, f, sk, f, f.lateNext.aim)) stampTile(ax + p.x * TILE, ay + p.y * TILE, 130, true);
      }
    }
    for (const z of st.shades) for (let yy = z.y - z.r; yy <= z.y + z.r; yy++) for (let xx = z.x - z.r; xx <= z.x + z.r; xx++) stampTile(ax + xx * TILE, ay + yy * TILE, 255, false);
    // Light.
    const lamps = st.lamps.map((l) => ({ x: ax + l.x * TILE + 4, y: ay + l.y * TILE + 4, r: (l.r + 0.8) * TILE, i: 1.5, color: 0xffc070 }));
    for (const u of st.units) if (u.alive && u.lantern && u.lantern.off <= 0) lamps.push({ x: ax + u.x * TILE + 4, y: ay + u.y * TILE + 4, r: (u.lantern.r + 0.8) * TILE, i: 1.3, color: 0xfff0b0 });
    const beam = st.beam ? { x: ax + st.beam.x * TILE + 4, y: ay + st.beam.y * TILE + 4, angle: st.beam.angle } : null;
    lightScene(cx, cy, lamps, beam);
    this.renderUI(ax, ay);
  }

  unitImg(u: Unit): { im: Img; flip: boolean } {
    const def = FOES[u.id];
    if (u.side === 'foe') {
      const ims = monImgs(def?.art ?? u.id);
      const n = Math.max(1, ims.length - (ims.length > 2 ? 1 : 0));
      return { im: ims[Math.floor(this.time * 2.5 + u.uid) % n], flip: false };
    }
    const c = charImgs(u.id === 'minim' && flag('ch4_freed') ? 'minim_cracked' : u.id);
    const f = charFrame(c, 'right', Math.floor(this.time * 2 + u.uid) % 2 === 0 || u.acted ? 0 : 0);
    return f;
  }

  renderUI(ax: number, ay: number) {
    const st = this.st;
    // Darken outside the arena a little so the field reads as the frame.
    dimOutside(ax, ay, st.w * TILE, st.h * TILE);
    // Order numbers and marks on foes.
    for (const f of foes(st)) {
      const d = this.disp.get(f.uid)!;
      const x = Math.round(d.px) - this.camX, y = Math.round(d.py) - this.camY;
      if (f.decoyOf !== undefined) continue;
      if (f.hat && !party(st).some((p) => Math.max(Math.abs(p.x - f.x), Math.abs(p.y - f.y)) <= 1)) drawTextOutlined('?', x + 2, y - 10, C.gold3, C.black);
      else if (depthOf(st, f) === 0 && !st.result) drawTextOutlined('?', x + 2, y - 10, C.lilac, C.black);
      else drawTextOutlined(String(f.order), x + 2, y - 10, C.white, C.black);
      if (f.noted) blitUI(icon('note'), x + 6, y - 9);
    }
    // Move range. Solid gold tiles keep the member's feet set for a lead strike, dotted teal ones only move.
    if (this.mode === 'move' && this.sel) {
      const u = this.sel;
      const near = (p: Pos) => Math.abs(p.x - u.startX) + Math.abs(p.y - u.startY) <= 1;
      for (const p of this.reach) outlineTile(ax + p.x * TILE, ay + p.y * TILE, near(p) ? C.gold3 : C.teal3, !near(p));
      // From a strike-ready tile under the cursor, dots show where the member's lead strike would land.
      const lead = u.skills.map((s) => SKILLS[s]).find((s) => s && (s.kind === 'lead' || s.kind === 'upsun') && s.power !== undefined);
      if (lead && near(this.cursor) && this.reach.some((p) => p.x === this.cursor.x && p.y === this.cursor.y)) {
        for (const p of skillTiles(st, { ...u, x: this.cursor.x, y: this.cursor.y }, lead, this.cursor)) rect(ax + p.x * TILE + 3, ay + p.y * TILE + 3, 2, 2, C.gold3);
      }
    }
    // Target preview.
    if ((this.mode === 'target') && this.sel) {
      const t = this.currentTarget();
      const sk = SKILLS[this.skill];
      if (sk.kind === 'place') for (const tt of this.targets) outlineTile(ax + tt.pos!.x * TILE, ay + tt.pos!.y * TILE, C.gold1, true);
      if (t) for (const p of previewTiles(st, this.sel, this.skill, t)) markTile(ax + p.x * TILE, ay + p.y * TILE, C.gold3);
    }
    if (this.flash) for (const p of this.flash.tiles) markTile(ax + p.x * TILE, ay + p.y * TILE, this.flash.color);
    // Beam: where it points next.
    if (st.beam && this.mode !== 'done') {
      const next = { ...st.beam, angle: nextBeamAngle(st) };
      for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
        if (beamCovers({ ...st, beam: next }, x, y) && (x + y + Math.floor(this.time * 2)) % 2 === 0) rect(ax + x * TILE + 3, ay + y * TILE + 3, 2, 2, C.pale);
      }
    }
    // Cursor.
    if (this.mode !== 'anim' && this.mode !== 'done' && this.mode !== 'tutorial' && this.mode !== 'act' && this.mode !== 'item') cornerTile(ax + this.cursor.x * TILE, ay + this.cursor.y * TILE, C.white);
    // Floating numbers.
    for (const f of this.floats) drawTextOutlined(f.text, Math.round(f.x - this.camX - textWidth(f.text) / 2), Math.round(f.y - this.camY - f.t * 12), f.color, C.black);
    // Top bar.
    drawTextOutlined(`Round ${st.round}`, 4, 3, C.pale, C.black);
    if (this.banner) { const w = textWidth(this.banner.text) + 10; box((W - w) / 2, 14, w, 12, C.ink, C.gold2); drawText(this.banner.text, (W - w) / 2 + 5, 16, C.white); }
    this.renderPanel();
    if (this.mode === 'done' && this.endBox) this.renderEnd();
  }

  renderPanel() {
    box(2, PANEL_Y, W - 4, H - PANEL_Y - 2, C.ink, C.slate);
    const st = this.st;
    if (this.mode === 'act' || this.mode === 'item') {
      const items = this.mode === 'item' ? this.usableItems() : this.menu;
      const top = Math.max(0, Math.min(this.menuI - 1, items.length - 4));
      for (let i = 0; i < Math.min(4, items.length); i++) {
        const id = items[top + i];
        const label = this.mode === 'item' ? `${ITEMS[id].name} x${G.items[id]}` : id === 'item' ? 'Item' : SKILLS[id]?.name ?? id;
        const y = PANEL_Y + 4 + i * (LINE_H + 1);
        const bad = this.mode === 'act' && id !== 'item' && id !== 'wait' && this.sel && cantUse(st, this.sel, id);
        if (top + i === this.menuI) blitUI(icon('cursor'), 5, y);
        drawText(label, 13, y, bad ? C.slate : top + i === this.menuI ? C.white : C.gray);
      }
      const id = items[this.menuI];
      const desc = this.mode === 'item' ? ITEMS[id]?.desc : id === 'item' ? 'Use something from the bag.' : SKILLS[id]?.desc;
      if (desc) wrap(desc, 98).slice(0, 4).forEach((l, i) => drawText(l, 88, PANEL_Y + 4 + i * (LINE_H + 1), C.pale));
      return;
    }
    const u = this.unitAtCursor() ?? this.sel;
    if (u) {
      const d = this.disp.get(u.uid)!;
      drawText(u.name, 7, PANEL_Y + 4, u.side === 'party' ? C.gold3 : C.rust3);
      const hp = Math.max(0, Math.round(d.hp));
      const bw = 60;
      rect(7, PANEL_Y + 15, bw, 3, C.black);
      rect(7, PANEL_Y + 15, Math.round((bw * hp) / u.maxHp), 3, hp <= u.maxHp / 3 ? C.rust2 : C.green2);
      drawText(`${hp}/${u.maxHp}`, 70, PANEL_Y + 13, C.pale);
      const tags: string[] = [];
      for (const k of Object.keys(u.status)) if (k !== 'pinGuard') tags.push(k);
      if (u.side === 'foe') {
        const dep = depthOf(st, u);
        tags.push(dep ? `sees ${dep} ahead` : 'unforeseen');
      } else {
        const l = leadOf(st, u);
        tags.push(l ? `lead ${l.len}` : 'no lead');
      }
      drawText(tags.join('  '), 7, PANEL_Y + 23, C.lilac);
    }
    const hint = this.mode === 'select' ? 'Z: pick  C: end round' : this.mode === 'move' ? 'Z: move here  X: back' : this.mode === 'target' ? 'Z: do it  X: back' : '';
    drawText(hint, W - 8 - textWidth(hint), H - 12, C.slate);
  }

  renderEnd() {
    const e = this.endBox!;
    const lines = this.st.result === 'lose' ? [...e.lines] : e.lines;
    const w = 150, h = 18 + lines.length * (LINE_H + 1) + (this.st.result === 'lose' ? 24 : 0);
    const x = (W - w) / 2, y = 40;
    box(x, y, w, h, C.ink, C.gold2);
    lines.forEach((l, i) => drawText(l, centerX(l, W / 2), y + 6 + i * (LINE_H + 1), i === 0 ? C.white : C.pale));
    if (this.st.result === 'lose') {
      const opts = ['Try again', 'Back to the post'];
      opts.forEach((o, i) => {
        const yy = y + h - 22 + i * (LINE_H + 1);
        if (i === this.loseChoice) blitUI(icon('cursor'), x + 30, yy);
        drawText(o, x + 40, yy, i === this.loseChoice ? C.white : C.gray);
      });
    }
  }
}

// ---- Small drawing helpers ----

function stampTile(x: number, y: number, strength: number, softEdge: boolean, size = 8) {
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
    const px = Math.round(x) + xx, py = Math.round(y) + yy;
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const edge = softEdge && (xx === 0 || yy === 0 || xx === size - 1 || yy === size - 1);
    const v = edge ? Math.round(strength * 0.55) : strength;
    const i = py * W + px;
    if (shd[i] < v) shd[i] = v;
  }
}

function rectWorld(x: number, y: number, w: number, h: number, c: number) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1 || (xx + yy) % 3 === 0) rect(x + xx, y + yy, 1, 1, c); }
}

/** Seconds a banner stays up: long enough to read it at a calm pace. */
function readTime(text: string): number { return Math.max(1.4, 0.8 + text.length * 0.06); }

function outlineTile(x: number, y: number, c: number, dotted: boolean) {
  for (let i = 0; i < 8; i++) {
    if (dotted && i % 2) continue;
    rect(x + i, y, 1, 1, c); rect(x + i, y + 7, 1, 1, c); rect(x, y + i, 1, 1, c); rect(x + 7, y + i, 1, 1, c);
  }
}

function markTile(x: number, y: number, c: number) {
  rect(x + 1, y + 1, 2, 1, c); rect(x + 1, y + 1, 1, 2, c);
  rect(x + 5, y + 1, 2, 1, c); rect(x + 6, y + 1, 1, 2, c);
  rect(x + 1, y + 6, 2, 1, c); rect(x + 1, y + 5, 1, 2, c);
  rect(x + 5, y + 6, 2, 1, c); rect(x + 6, y + 5, 1, 2, c);
}

function cornerTile(x: number, y: number, c: number) {
  rect(x - 1, y - 1, 3, 1, c); rect(x - 1, y - 1, 1, 3, c);
  rect(x + 6, y - 1, 3, 1, c); rect(x + 8, y - 1, 1, 3, c);
  rect(x - 1, y + 8, 3, 1, c); rect(x - 1, y + 6, 1, 3, c);
  rect(x + 6, y + 8, 3, 1, c); rect(x + 8, y + 6, 1, 3, c);
}

function dimOutside(ax: number, ay: number, w: number, h: number) {
  ditherRect(0, 0, W, Math.max(0, ay), C.black, C.black, 0);
  const t = 0.5;
  for (const [x, y, ww, hh] of [[0, 0, W, ay], [0, ay + h, W, PANEL_Y - ay - h], [0, ay, ax, h], [ax + w, ay, W - ax - w, h]] as [number, number, number, number][]) {
    if (ww <= 0 || hh <= 0) continue;
    dimRect(x, y, ww, hh, t);
  }
}

import { buf } from '../engine/screen';
import { BAYER } from '../engine/light';
import { PX } from '../engine/palette';
function dimRect(x: number, y: number, w: number, h: number, t: number) {
  const black = PX[C.black];
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
    if (BAYER[((yy & 3) << 2) | (xx & 3)] + 0.5 < t) buf[yy * W + xx] = black;
  }
}

export { DIR8 };
