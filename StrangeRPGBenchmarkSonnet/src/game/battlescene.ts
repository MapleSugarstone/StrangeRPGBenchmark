import type { Action, Ev, Unit } from '../core/battle';
import type { Planned } from '../core/encounter';
import { applyResult, learnedSkills, member } from '../core/party';
import { CHAR } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { skill } from '../data/skills';
import { ELEM_ABBR, ELEM_COLOR, type Elem, type Status } from '../data/types';
import { chapter } from '../story/chapters';
import { C, rgb, type Screen } from '../gfx/screen';
import { bossSprites, monsterSprite, partySprite, tile } from '../gfx/sprites';
import type { BattleResult } from '../core/script';
import type { Game, Scene } from './game';
import { COL, hpColor, ListMenu, panel, starfield, type ListItem } from './ui';

interface Vis { hp: number; dead: boolean; flash: number; shake: number; status: Set<Status>; mark?: Elem }
interface Float { x: number; y: number; text: string; color: number; t: number }

const STATUS_TAG: Record<Status, [string, number]> = {
  burn: ['B', C.orange], chill: ['C', C.cyan], shock: ['Z', C.yellow], regen: ['+', C.green], sleep: ['S', C.purple], hex: ['X', rgb('#ff7ac0')],
  weak: ['W', rgb('#c0a070')], ward: ['D', C.blue], haste: ['H', C.gold], stun: ['!', C.red], focus: ['F', C.white], taunt: ['T', C.orange],
};
const STANCE_ABBR = { steady: 'STD', fierce: 'FRC', swift: 'SWF' } as const;

type Mode = 'play' | 'cmd' | 'skill' | 'item' | 'target' | 'result' | 'defeat';

export class BattleScene implements Scene {
  get musicKind() { return this.plan.boss ? ('boss' as const) : ('battle' as const); }
  b;
  vis = new Map<number, Vis>();
  queue: Ev[] = [];
  wait = 0;
  log: string[] = [];
  banner = '';
  bannerT = 0;
  floats: Float[] = [];
  mode: Mode = 'play';
  cmd = new ListMenu([], 5, 2);
  sub = new ListMenu([], 5);
  cmdKeys: string[] = [];
  subKeys: string[] = [];
  targetList: Unit[] = [];
  targetIdx = 0;
  pendingAction: ((t?: number) => Action) | null = null;
  result: string[] = [];
  resolved = false;
  stars: [number, number][] = [];
  theme;
  seenWeak: Set<string>;
  t = 0;
  ended = false;

  constructor(private g: Game, private plan: Planned, private done: (r: BattleResult) => void) {
    this.b = plan.battle;
    this.theme = chapter(g.state.chapter).theme;
    for (const u of this.b.units) this.vis.set(u.uid, { hp: u.hp, dead: false, flash: 0, shake: 0, status: new Set() });
    this.seenWeak = new Set(Object.keys(g.state.flags).filter((k) => k.startsWith('weak:')));
    this.stars = starfield(36, g.state.chapter * 13 + 5, 128, 26, 12);
    this.queue = this.b.start();
    this.log = this.plan.boss ? [`${this.b.foes[0].name} appears!`] : [`${this.b.foes.map((f) => f.name).join(', ')}!`];
    g.audio.sfx('encounter');
    this.mode = 'play';
  }

  // -------------------------------------------------------------------------- helpers
  private unitPos(u: Unit): { x: number; y: number } {
    if (u.side === 'party') {
      const idx = this.b.party.indexOf(u);
      const back = u.row === 1 && this.b.has('rows');
      return { x: back ? 108 : 94, y: 20 + idx * 11 };
    }
    const foes = this.b.foes;
    const idx = foes.indexOf(u);
    const hasBoss = foes.some((f) => f.boss);
    if (hasBoss) {
      if (u.boss && foes.filter((f) => f.boss).indexOf(u) === 0) return { x: 26, y: 20 };
      const others = foes.filter((f, i) => !(f.boss && foes.filter((x) => x.boss).indexOf(f) === 0) && i >= 0);
      const k = others.indexOf(u);
      return [{ x: 4, y: 46 }, { x: 52, y: 46 }, { x: 4, y: 14 }, { x: 52, y: 14 }][k % 4];
    }
    return [{ x: 18, y: 26 }, { x: 44, y: 16 }, { x: 18, y: 46 }, { x: 44, y: 38 }, { x: 66, y: 28 }][idx % 5];
  }

  private spriteFor(u: Unit) {
    if (u.side === 'party') return partySprite(u.id);
    const d = ENEMIES[u.defId!];
    return monsterSprite(d.arch, d.seed, d.colors);
  }

  private say(text: string) {
    this.log.push(text);
    if (this.log.length > 4) this.log.shift();
  }

  private float(u: Unit, text: string, color: number) {
    const p = this.unitPos(u);
    this.floats.push({ x: p.x + (u.boss ? 8 : 0), y: p.y - 2, text, color, t: 0 });
  }

  private syncVis() {
    for (const u of this.b.units) {
      const v = this.vis.get(u.uid)!;
      v.hp = u.hp;
      v.dead = u.hp <= 0 && !u.gasp;
      v.status = new Set(Object.keys(u.status) as Status[]);
    }
  }

  // -------------------------------------------------------------------------- event playback
  private playNext() {
    const e = this.queue.shift();
    if (!e) return;
    const g = this.g;
    const u = (id: number) => this.b.units[id];
    switch (e.t) {
      case 'msg': this.say(e.text); this.wait = 22; break;
      case 'act': this.banner = e.name; this.bannerT = 38; this.wait = 18; if (u(e.u).side === 'foe') this.say(`${u(e.u).name}: ${e.name}`); break;
      case 'dmg': {
        const v = this.vis.get(e.u)!;
        v.hp = Math.max(0, v.hp - e.n);
        v.flash = 6; v.shake = 6;
        this.float(u(e.u), (e.weak ? '*' : '') + String(e.n) + (e.crit ? '!' : ''), e.weak ? C.yellow : e.resist ? C.gray : u(e.u).side === 'party' ? C.red : C.white);
        g.audio.sfx(e.crit ? 'crit' : 'hit');
        if (e.weak && u(e.u).side === 'foe' && u(e.u).defId && e.e) {
          const k = `weak:${u(e.u).defId}:${e.e}`;
          if (!this.g.state.flags[k]) { this.g.state.flags[k] = true; this.seenWeak.add(k); }
        }
        this.wait = 12;
        break;
      }
      case 'heal': { const v = this.vis.get(e.u)!; v.hp = Math.min(u(e.u).maxHp, v.hp + e.n); this.float(u(e.u), '+' + e.n, C.green); g.audio.sfx('heal'); this.wait = 10; break; }
      case 'mp': this.float(u(e.u), '+' + e.n + 'MP', C.blue); this.wait = 6; break;
      case 'status': {
        const v = this.vis.get(e.u)!;
        if (e.on) { v.status.add(e.st); this.float(u(e.u), STATUS_TAG[e.st][0], STATUS_TAG[e.st][1]); this.wait = 6; } else v.status.delete(e.st);
        break;
      }
      case 'ko': { const v = this.vis.get(e.u)!; v.dead = true; v.hp = 0; g.audio.sfx('ko'); this.wait = 16; break; }
      case 'revive': { const v = this.vis.get(e.u)!; v.dead = false; v.hp = Math.max(v.hp, u(e.u).hp); this.float(u(e.u), 'UP', C.green); this.wait = 10; break; }
      case 'react': this.banner = e.name.toUpperCase() + '!'; this.bannerT = 40; g.audio.sfx('magic'); g.shake = 4; this.wait = 24; break;
      case 'opening': this.float(u(e.u), 'OPENING', C.yellow); this.wait = 8; break;
      case 'mark': this.vis.get(e.u)!.mark = e.e; break;
      case 'shift': this.syncVis(); this.wait = 10; break;
    }
  }

  // -------------------------------------------------------------------------- commands
  private enterCmd() {
    const b = this.b;
    const u = b.actor;
    if (!u) return;
    this.syncVis();
    const legal = b.legal();
    const has = (k: Action['k']) => legal.some((a) => a.k === k);
    const items: ListItem[] = [];
    this.cmdKeys = [];
    const add = (key: string, label: string, disabled = false, color?: number) => { this.cmdKeys.push(key); items.push({ label, disabled, color }); };
    add('attack', 'ATTACK');
    add('skill', 'SKILL', !u.skills.length);
    add('item', 'ITEM', !has('item'));
    add('guard', 'GUARD');
    if (!b.noFlee) add('flee', 'RUN');
    if (b.has('nerve') && u.limit) add('limit', 'LIMIT' + (u.nerve >= 100 ? '!' : ''), u.nerve < 100, u.nerve >= 100 ? C.gold : undefined);
    if (b.has('ascend')) add('ascend', 'ASCEND', u.nerve < 100 || u.asc > 0);
    if (b.has('stance')) add('stance', 'STANCE ' + STANCE_ABBR[u.stance]);
    if (b.has('gasp')) add('pact', u.pact ? 'PACT ON' : 'PACT', !has('pact'));
    if (b.has('rewind')) add('rewind', 'REWIND', !has('rewind'));
    if (b.has('dusk')) add('dusk', 'DUSK', !has('dusk'));
    if (u.gasp) { this.cmdKeys = ['attack', 'skill']; items.length = 0; items.push({ label: 'ATTACK' }, { label: 'SKILL' }); }
    this.cmd = new ListMenu(items, 5, 2);
    this.mode = 'cmd';
  }

  private openSkills() {
    const u = this.b.actor!;
    const items: ListItem[] = u.skills.map((id) => {
      const s = skill(id);
      const cost = this.b.mpCost(u, s);
      return { label: s.name.toUpperCase(), right: cost ? String(cost) : '-', disabled: u.mp < cost };
    });
    this.subKeys = [...u.skills];
    this.sub = new ListMenu(items, 4);
    this.mode = 'skill';
  }

  private openItems() {
    const items: ListItem[] = [];
    this.subKeys = [];
    for (const id of Object.keys(this.b.inv)) {
      const n = this.b.inv[id];
      if (n > 0 && ITEMS[id]) { items.push({ label: ITEMS[id].name.toUpperCase(), right: 'x' + n }); this.subKeys.push(id); }
    }
    this.sub = new ListMenu(items, 4);
    this.mode = 'item';
  }

  private startTarget(kind: 'foe' | 'ally' | 'fallen', make: (t?: number) => Action) {
    const b = this.b;
    this.targetList = kind === 'foe' ? b.livingFoes() : kind === 'ally' ? b.livingParty() : b.party.filter((x) => x.hp <= 0 && !x.gasp);
    if (!this.targetList.length) { this.g.audio.sfx('cancel'); return; }
    this.targetIdx = 0;
    if (kind === 'foe') { const a = this.b.actor!; this.targetIdx = 0; void a; }
    this.pendingAction = make;
    this.mode = 'target';
  }

  private commit(a: Action) {
    this.syncVis();
    this.queue = this.b.act(a);
    this.mode = 'play';
    this.wait = 4;
    if (a.k === 'stance' || a.k === 'pact') { this.queue = this.queue.filter((e) => e.t === 'msg').slice(0, 1); }
  }

  private chooseSkillTarget(id: string, asLimit = false) {
    const s = skill(id);
    const mk = (t?: number): Action => (asLimit ? { k: 'limit', t } : { k: 'skill', id, t });
    if (s.tgt === 'foe') this.startTarget('foe', mk);
    else if (s.tgt === 'ally') this.startTarget('ally', mk);
    else if (s.tgt === 'fallen') this.startTarget('fallen', mk);
    else this.commit(mk());
  }

  // -------------------------------------------------------------------------- update
  update(g: Game) {
    this.t++;
    for (const v of this.vis.values()) { if (v.flash > 0) v.flash--; if (v.shake > 0) v.shake--; }
    for (const f of this.floats) f.t++;
    this.floats = this.floats.filter((f) => f.t < 34);
    if (this.bannerT > 0) this.bannerT--;
    const inp = g.input;

    if (this.mode === 'play') {
      if (this.wait > 0) { this.wait -= inp.held.has('a') ? 3 : 1; return; }
      if (this.queue.length) { this.playNext(); return; }
      if (this.b.over) { this.finish(); return; }
      this.enterCmd();
      return;
    }
    if (this.mode === 'result' || this.mode === 'defeat') {
      if (inp.was('a') && this.t > 20) this.close();
      return;
    }
    const b = this.b;
    if (this.mode === 'cmd') {
      const r = this.cmd.update(g);
      if (r !== 'ok') return;
      const key = this.cmdKeys[this.cmd.cursor];
      const u = b.actor!;
      switch (key) {
        case 'attack': this.startTarget('foe', (t) => ({ k: 'attack', t: t! })); break;
        case 'skill': this.openSkills(); break;
        case 'item': this.openItems(); break;
        case 'guard': this.commit({ k: 'guard' }); break;
        case 'flee': this.commit({ k: 'flee' }); break;
        case 'limit': this.chooseSkillTarget(u.limit!, true); break;
        case 'ascend': this.commit({ k: 'ascend' }); break;
        case 'stance': {
          const order = ['steady', 'fierce', 'swift'] as const;
          const next = order[(order.indexOf(u.stance) + 1) % 3];
          this.commit({ k: 'stance', st: next });
          this.queue = [];
          this.enterCmd();
          break;
        }
        case 'pact': this.commit({ k: 'pact' }); this.queue = []; this.enterCmd(); break;
        case 'rewind': this.commit({ k: 'rewind' }); this.syncVis(); break;
        case 'dusk': this.startTarget('foe', (t) => ({ k: 'dusk', t: t! })); this.targetList = b.livingFoes().filter((f) => b.duskable(f)); this.targetIdx = 0; break;
      }
      return;
    }
    if (this.mode === 'skill' || this.mode === 'item') {
      const r = this.sub.update(g);
      if (r === 'cancel') { this.mode = 'cmd'; return; }
      if (r !== 'ok') return;
      const id = this.subKeys[this.sub.cursor];
      if (this.mode === 'skill') this.chooseSkillTarget(id);
      else {
        const it = ITEMS[id];
        const mk = (t?: number): Action => ({ k: 'item', id, t });
        if (it.tgt === 'ally') this.startTarget('ally', mk);
        else if (it.tgt === 'fallen') this.startTarget('fallen', mk);
        else this.commit(mk());
      }
      return;
    }
    if (this.mode === 'target') {
      const n = this.targetList.length;
      if (inp.was('left') || inp.was('up')) { this.targetIdx = (this.targetIdx + n - 1) % n; g.audio.sfx('cursor'); }
      if (inp.was('right') || inp.was('down')) { this.targetIdx = (this.targetIdx + 1) % n; g.audio.sfx('cursor'); }
      if (inp.was('b')) { g.audio.sfx('cancel'); this.mode = 'cmd'; return; }
      if (inp.was('a')) { g.audio.sfx('ok'); this.commit(this.pendingAction!(this.targetList[this.targetIdx].uid)); }
    }
  }

  // -------------------------------------------------------------------------- end of battle
  private finish() {
    const g = this.g;
    const b = this.b;
    this.syncVis();
    if (b.over === 'win') {
      g.audio.sfx('win');
      const before = new Map(g.state.roster.map((m) => [m.id, learnedSkills(m)]));
      const res = applyResult(g.state, b, this.plan.xp, this.plan.gold);
      this.result = ['VICTORY!', `XP ${res.xp}  GOLD ${res.gold}`];
      for (const l of res.levelUps) {
        g.audio.sfx('levelup');
        const m = member(g.state, l.id);
        this.result.push(`${CHAR[l.id].name.toUpperCase()} REACHES LV${l.to}!`);
        for (const sid of learnedSkills(m)) if (!before.get(l.id)!.includes(sid)) this.result.push(`  LEARNED ${skill(sid).name.toUpperCase()}`);
      }
      const drop = this.drop();
      if (drop) this.result.push(`FOUND ${ITEMS[drop].name.toUpperCase()}`);
      this.mode = 'result';
    } else if (b.over === 'flee') {
      applyResult(g.state, b, 0, 0);
      this.result = ['GOT AWAY!'];
      this.mode = 'result';
    } else {
      g.audio.sfx('lose');
      this.result = ['THE PARTY FALLS...'];
      this.mode = 'defeat';
    }
    this.t = 0;
  }

  private drop(): string | null {
    const g = this.g;
    if (this.plan.boss || !g.rng.chance(0.22)) return null;
    const ch = g.state.chapter;
    const pool = ch < 4 ? ['dew', 'ink'] : ch < 8 ? ['jar', 'ink', 'salt'] : ch < 11 ? ['flask', 'ink2', 'jar'] : ['starwater', 'ink3', 'flask'];
    const id = g.rng.pick(pool);
    g.state.inv[id] = Math.min(9, (g.state.inv[id] ?? 0) + 1);
    return id;
  }

  private close() {
    if (this.ended) return;
    this.ended = true;
    this.g.pop();
    this.done(this.b.over === 'win' ? 'win' : this.b.over === 'flee' ? 'flee' : 'lose');
  }

  // -------------------------------------------------------------------------- drawing
  draw(g: Game, s: Screen) {
    s.clear();
    const th = this.theme;
    const col = rgb(th.b);
    for (const [x, y] of this.stars) if (((x + y + Math.floor(this.t / 40)) % 5) !== 0) s.px(x, y, (this.t + x) % 97 < 3 ? C.white : 0xff303040);
    const ground = tile(th, 'floor');
    for (let gy = 40; gy < 66; gy += 8) for (let gx = 0; gx < 128; gx += 8) s.sprite(ground, gx, gy, { dim: true });
    s.line(0, 39, 127, 39, rgb(th.a));
    void col;

    this.drawTimeline(s);
    if (this.b.field && this.b.has('field')) s.textR(126, 12, this.b.field.name.toUpperCase(), rgb(th.b));

    // Foes
    for (const u of this.b.foes) {
      const v = this.vis.get(u.uid)!;
      if (v.dead && v.flash === 0) continue;
      const p = this.unitPos(u);
      const bob = Math.floor((this.t + u.uid * 7) / 24) % 2;
      const sx = p.x + (v.shake ? (v.shake % 2 ? 1 : -1) : 0);
      if (u.boss && ENEMIES[u.defId!].boss && this.b.foes.filter((f) => f.boss).indexOf(u) === 0) {
        const d = ENEMIES[u.defId!];
        const parts = bossSprites(d.arch, d.seed, d.colors);
        parts.forEach((sp, i) => s.sprite(sp, sx + (i % 2) * 8, p.y + Math.floor(i / 2) * 8 + bob, { flash: v.flash > 0 ? 1 : 0 }));
      } else s.sprite(this.spriteFor(u), sx, p.y + bob, { flash: v.flash > 0 ? 1 : 0 });
      if (v.mark && this.b.has('reaction')) s.text(p.x + (u.boss ? 16 : 7), p.y - 3, '*', ELEM_HEX(v.mark));
      let k = 0;
      for (const st of v.status) { s.text(p.x + k * 4, p.y + (u.boss ? 17 : 9), STATUS_TAG[st][0], STATUS_TAG[st][1]); k++; }
    }
    // Party
    for (const u of this.b.party) {
      const v = this.vis.get(u.uid)!;
      const p = this.unitPos(u);
      const isActor = this.b.actor === u && this.mode !== 'play';
      const bob = Math.floor((this.t + u.uid * 11) / 26) % 2;
      const dead = v.dead;
      const sx = p.x + (isActor ? -3 : 0) + (v.shake ? (v.shake % 2 ? 1 : -1) : 0);
      if (dead) s.sprite(partySprite(u.id), p.x, p.y + 4, { dim: true });
      else s.sprite(partySprite(u.id), sx, p.y + bob, { flash: v.flash > 0 ? 1 : 0, flipX: true });
      if (u.asc > 0 && !dead) s.frame(sx - 1, p.y - 1, 10, 10, C.gold);
    }
    // Floats
    for (const f of this.floats) s.text(f.x, f.y - Math.floor(f.t / 3), f.text, f.color);
    if (this.bannerT > 0) { s.rect(0, 12, 128, 7, 0xd0000000); s.textC(64, 13, this.banner.toUpperCase(), COL.hi); }

    // Target cursor and info
    if (this.mode === 'target') {
      const t = this.targetList[this.targetIdx];
      const p = this.unitPos(t);
      if (Math.floor(this.t / 8) % 2 === 0) s.text(t.side === 'foe' ? p.x + 3 : p.x - 6, t.side === 'foe' ? p.y - 8 : p.y + 1, t.side === 'foe' ? 'v' : '>', COL.hi);
      this.drawInfo(s, t);
    }

    this.drawParty(s);
    this.drawPanel(s);
    if (this.mode === 'result' || this.mode === 'defeat') this.drawResult(s);
    void g;
  }

  private drawTimeline(s: Screen) {
    const tl = this.b.timeline(10);
    s.rect(0, 0, 128, 11, 0xff08081a);
    tl.forEach((e, i) => {
      const x = 2 + i * 12;
      const sp = this.spriteFor(e.u);
      s.sprite(sp, x, 1, { dim: i > 0 });
      s.rect(x, 10, 8, 1, e.u.side === 'party' ? C.cyan : C.red);
    });
  }

  private drawInfo(s: Screen, t: Unit) {
    panel(s, 2, 20, 62, 17);
    s.text(5, 23, t.name.toUpperCase(), C.white);
    if (t.side === 'foe') {
      s.bar(5, 30, 40, t.hp / t.maxHp, hpColor(t.hp / t.maxHp));
      s.text(47, 29, `${Math.round((100 * t.hp) / t.maxHp)}%`, C.gray);
      if (this.b.has('weakness')) {
        let x = 5;
        for (const e of Object.keys(t.aff) as Elem[]) {
          const a = t.aff[e]!;
          if (a > 1 && this.seenWeak.has(`weak:${t.defId}:${e}`)) { s.text(x, 33, ELEM_ABBR2[e], ELEM_HEX(e)); x += 14; }
        }
        if (x === 5) s.text(5, 33, '???', C.gray);
      }
    } else {
      s.bar(5, 30, 40, t.hp / t.maxHp, hpColor(t.hp / t.maxHp));
      s.text(47, 29, `${t.hp}`, C.gray);
    }
  }

  private drawParty(s: Screen) {
    const b = this.b;
    s.rect(0, 66, 128, 31, 0xff06060f);
    s.line(0, 66, 127, 66, COL.dim);
    b.party.forEach((u, i) => {
      const y = 68 + i * 7;
      const v = this.vis.get(u.uid)!;
      const isAct = b.actor === u && this.mode !== 'play';
      s.text(2, y, u.name.slice(0, 6).toUpperCase(), v.dead ? COL.dim : isAct ? COL.hi : C.white);
      s.bar(28, y + 1, 24, v.hp / u.maxHp, hpColor(v.hp / u.maxHp));
      s.text(54, y, String(Math.max(0, Math.round(v.hp))), v.dead ? COL.dim : hpColor(v.hp / u.maxHp));
      s.text(76, y, 'M' + Math.round(u.mp), COL.mp);
      if (b.has('nerve')) {
        const full = u.nerve >= 100;
        s.rect(2, y + 6, 22, 1, C.dark);
        s.rect(2, y + 6, Math.round((u.nerve / 100) * 22), 1, full && Math.floor(this.t / 6) % 2 ? C.white : COL.nerve);
      }
      let k = 0;
      for (const st of v.status) { if (k > 6) break; s.text(96 + k * 4, y, STATUS_TAG[st][0], STATUS_TAG[st][1]); k++; }
      if (u.asc > 0) s.text(122, y, '^', C.gold);
    });
  }

  private drawPanel(s: Screen) {
    const y0 = 98;
    panel(s, 0, y0, 128, 30);
    const b = this.b;
    if (this.mode === 'cmd' && b.actor) {
      this.cmd.draw(s, 3, y0 + 3, 100);
      const hints: Record<string, string> = {
        attack: 'A plain strike.', skill: 'Spend MP.', item: 'Use a supply.', guard: 'Half damage, act sooner.', flee: 'Run away.',
        limit: 'Full NERVE unleashes it.', ascend: 'Transform for 4 turns.', stance: 'Free. Changes your stance.', pact: 'Spend 30% HP for a stronger hit.',
        rewind: 'Undo the last round.', dusk: 'End a foe under 35% HP.',
      };
      s.text(3, y0 + 23, (hints[this.cmdKeys[this.cmd.cursor]] ?? '').toUpperCase(), C.gray);
      s.textR(125, y0 + 3, b.actor.name.toUpperCase(), COL.hi);
    } else if (this.mode === 'skill' || this.mode === 'item') {
      this.sub.draw(s, 3, y0 + 3, 122);
      const k = this.subKeys[this.sub.cursor];
      const desc = this.mode === 'skill' ? (k ? skill(k).desc : '') : k ? ITEMS[k].desc : '';
      if (this.mode === 'skill' && k) { const sk = skill(k); const fx = sk.fx.find((f) => f.k === 'dmg') as { e?: Elem } | undefined; if (fx?.e) s.textR(125, y0 + 23, ELEM_ABBR2[fx.e], ELEM_HEX(fx.e)); }
      s.text(3, y0 + 23, desc.toUpperCase().slice(0, 28), C.gray);
      if (!this.subKeys.length) s.text(8, y0 + 4, 'NOTHING HERE', COL.dim);
    } else if (this.mode === 'target') {
      s.text(4, y0 + 4, 'CHOOSE A TARGET', C.white);
      s.text(4, y0 + 12, 'Z OK  X BACK', C.gray);
    } else {
      this.log.forEach((l, i) => s.text(4, y0 + 3 + i * 6, l.toUpperCase().slice(0, 30), i === this.log.length - 1 ? C.white : C.gray));
    }
    if (b.over === null && this.mode === 'play' && b.has('timeline') === false) s.text(2, 2, '', C.white);
  }

  private drawResult(s: Screen) {
    const h = this.result.length * 7 + 8;
    panel(s, 8, 64 - h / 2 - 10, 112, h);
    this.result.forEach((l, i) => s.textC(64, 64 - h / 2 - 10 + 5 + i * 7, l, i === 0 ? (this.mode === 'defeat' ? COL.bad : COL.hi) : C.white));
  }
}

const ELEM_ABBR2 = ELEM_ABBR;
function ELEM_HEX(e: Elem): number { return rgb(ELEM_COLOR[e]); }
