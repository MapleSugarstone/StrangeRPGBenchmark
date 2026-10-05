import type { Game, Scene } from '../game/game';
import type { Gfx } from '../core/gfx';
import { Battle, Ev, Unit, Action, STATUS_NAME, goldUnit } from '../battle/engine';
import { partyUnit, enemyUnit, writeBack } from '../battle/units';
import { enemyAction } from '../battle/ai';
import { GROUPS, ENEMIES } from '../data/enemies';
import { SKILLS, SkillDef } from '../data/skills';
import { ITEMS } from '../data/items';
import { grantXp, addItem } from '../game/state';
import type { BattleOpts, BattleResult } from '../game/script';
import { Col, Hue, HUE_COLOR, HUE_NAME, WHEEL, hueMult } from '../core/palette';
import { Menu, MenuItem, hueChips } from './ui';
import { wrap, textW, LINE_H } from '../core/font';
import { BASE_THEME } from '../maps/tiles';

type Mode = 'intro' | 'next' | 'events' | 'command' | 'skill' | 'item' | 'target' | 'hue' | 'partner' | 'victory' | 'done';

interface Floater { x: number; y: number; text: string; col: Col; t: number }
interface Pending { kind: 'skill' | 'item'; id: string; hue?: Hue; partner?: number }

const MSG_Y = 77;
const PARTY_Y = 91;
const ROW_H = 15;

const STATUS_COL: Record<string, Col> = {
  static: 'c3', stun: 'y2', grey: 'g2', hush: 'b3', regen: 'e3', taunt: 'y3', mirror: 'b3', primed: 'o3', painted: 'm3', charge: 'r3',
};

export class BattleScene implements Scene {
  b: Battle;
  mode: Mode = 'intro';
  t = 0;
  modeT = 0;
  queue: Ev[] = [];
  evT = 0;
  cur: Ev | null = null;
  actor: Unit | null = null;
  banner = '';
  bannerHue: Hue | undefined;
  message = '';
  floaters: Floater[] = [];
  flashUid = 0;
  flashT = 0;
  lungeUid = 0;
  lungeT = 0;
  dying = new Map<number, number>();
  menu = new Menu([], 6);
  sub = new Menu([], 8);
  targetMenuIdx = 0;
  pending: Pending | null = null;
  targets: Unit[] = [];
  targetAll = false;
  victoryLines: string[] = [];
  reels: Hue[] | null = null;
  scanUid = 0;
  partyTurns = 0;
  result: BattleResult | null = null;
  bgPal: [string, string, string];
  private group: string;

  constructor(private g: Game, group: string, private o: BattleOpts, private done: (r: BattleResult) => void) {
    this.group = group;
    const st = g.st;
    const grp = GROUPS[group];
    if (!grp) throw new Error('Unknown group ' + group);
    const party = st.party.map(id => partyUnit(st.members[id], st.mech));
    const enemies = grp.enemies.map(id => enemyUnit(id));
    const tile = g.world?.tile(st.x, st.y, st);
    this.b = new Battle({
      party, enemies, mech: new Set(st.mech), canFlee: grp.flee !== false,
      gold: st.gold, items: { ...st.items }, makeEnemy: enemyUnit, greyField: !!tile?.greyzone,
    });
    const theme = g.world?.def.theme ?? {};
    this.bgPal = (theme.ground ?? BASE_THEME.ground) as [string, string, string];
    g.audio.play(o.music ?? grp.music ?? 'battle');
    const names = enemies.map(e => e.name);
    this.message = names.length === 1 ? `${names[0]} appears!` : `${names[0]} and ${names.length - 1 === 1 ? names[1] : 'friends'} appear!`;
  }

  // ---------- Layout ----------

  enemyLayout(): Map<number, { x: number; y: number; s: number }> {
    const es = this.b.units.filter(u => u.side === 1 && !u.gone && (u.alive || this.dying.has(u.uid)));
    const sizes = es.map(u => (u.spec.n ?? 1) * 8 * scaleOf(u));
    const gap = 6;
    const total = sizes.reduce((a, s) => a + s, 0) + gap * Math.max(0, es.length - 1);
    let x = Math.round(80 - total / 2);
    const top = this.b.mech.has('tempo') ? 12 : 4;
    const out = new Map<number, { x: number; y: number; s: number }>();
    es.forEach((u, i) => {
      const s = sizes[i];
      out.set(u.uid, { x, y: Math.max(top + 6, 66 - s), s });
      x += s + gap;
    });
    return out;
  }

  // ---------- Flow ----------

  update() {
    this.t++;
    this.modeT++;
    if (this.flashT > 0) this.flashT--;
    if (this.lungeT > 0) this.lungeT--;
    for (const f of this.floaters) { f.t--; f.y -= 0.35; }
    this.floaters = this.floaters.filter(f => f.t > 0);
    for (const [uid, t] of this.dying) { if (t <= 1) this.dying.delete(uid); else this.dying.set(uid, t - 1); }

    switch (this.mode) {
      case 'intro':
        if (this.modeT > 40 || (this.modeT > 10 && this.g.input.pressed('a'))) this.setMode('next');
        break;
      case 'next': this.nextTurn(); break;
      case 'events': this.playEvents(); break;
      case 'command': this.updateCommand(); break;
      case 'skill': this.updateSkill(); break;
      case 'item': this.updateItem(); break;
      case 'hue': this.updateHue(); break;
      case 'partner': this.updatePartner(); break;
      case 'target': this.updateTarget(); break;
      case 'victory': this.updateVictory(); break;
      case 'done': break;
    }
  }

  setMode(m: Mode) {
    this.mode = m;
    this.modeT = 0;
  }

  nextTurn() {
    if (this.b.result) { this.finish(); return; }
    if (this.o.survive && this.partyTurns >= this.o.survive) {
      this.b.result = 'win';
      this.finish();
      return;
    }
    const { u, ev, skip } = this.b.beginTurn();
    this.actor = u;
    this.queue.push(...ev);
    if (skip) { this.setMode('events'); return; }
    if (u.side === 0) {
      this.partyTurns++;
      this.afterEvents = () => this.openCommand();
    } else {
      const a = enemyAction(this.b, u);
      this.lungeUid = u.uid;
      this.lungeT = 10;
      this.queue.push(...this.b.act(u, a));
    }
    this.setMode('events');
  }

  private afterEvents: (() => void) | null = null;

  playEvents() {
    const fast = this.g.input.isDown('a') || this.g.input.isDown('b');
    if (this.cur) {
      this.evT -= fast ? 3 : 1;
      if (this.cur.k === 'msg' && this.g.input.pressed('a')) this.evT = 0;
      if (this.evT > 0) return;
      this.cur = null;
    }
    const ev = this.queue.shift();
    if (!ev) {
      this.banner = '';
      const f = this.afterEvents;
      this.afterEvents = null;
      if (this.b.result) { this.finish(); return; }
      if (f) f(); else this.setMode('next');
      return;
    }
    this.cur = ev;
    this.evT = this.startEvent(ev);
  }

  private pos(uid: number): [number, number] {
    const u = this.b.byUid(uid);
    if (!u) return [80, 60];
    if (u.side === 1) {
      const l = this.enemyLayout().get(uid);
      return l ? [l.x + l.s / 2, l.y + 2] : [80, 40];
    }
    const i = this.b.party.indexOf(u);
    return [50, PARTY_Y + i * ROW_H + 2];
  }

  private startEvent(ev: Ev): number {
    const a = this.g.audio;
    switch (ev.k) {
      case 'msg': this.message = ev.text; return 55;
      case 'act': {
        const u = this.b.byUid(ev.uid);
        this.banner = `${u?.name ?? ''}: ${ev.name}`;
        this.bannerHue = ev.hue && ev.hue !== 'N' ? ev.hue : undefined;
        a.sfx(ev.name === 'Guard' ? 'buff' : SKILLS_BY_NAME[ev.name]?.kind === 'mag' ? 'magic' : 'ok');
        return 22;
      }
      case 'dmg': {
        const u = this.b.byUid(ev.uid);
        const [x, y] = this.pos(ev.uid);
        const clash = (ev.mult ?? 1) > 1;
        const blend = (ev.mult ?? 1) < 1;
        this.floaters.push({ x, y, text: `${ev.n}${clash ? '!' : ''}`, col: clash ? 'y3' : blend ? 'g2' : ev.crit ? 'r3' : 'w', t: 40 });
        if (clash) this.floaters.push({ x, y: y - 7, text: 'CLASH', col: HUE_LIGHT[ev.hue ?? 'N'], t: 34 });
        if (blend) this.floaters.push({ x, y: y - 7, text: 'blend', col: 'g2', t: 30 });
        if (ev.crit) this.floaters.push({ x, y: y - 14, text: 'CRIT', col: 'r3', t: 30 });
        this.flashUid = ev.uid;
        this.flashT = 10;
        if (u?.side === 0) this.g.shakeT = 6;
        if (ev.crit) this.g.shakeT = 10;
        a.sfx(clash ? 'clash' : blend ? 'blend' : ev.crit ? 'crit' : 'hit');
        return 12;
      }
      case 'heal': {
        const [x, y] = this.pos(ev.uid);
        if (ev.n > 0) this.floaters.push({ x, y, text: `+${ev.n}`, col: ev.ink ? 'c3' : 'e3', t: 36 });
        a.sfx('heal');
        return 10;
      }
      case 'miss': return 10;
      case 'die': {
        const u = this.b.byUid(ev.uid);
        if (u?.side === 1) this.dying.set(ev.uid, 28);
        this.message = u?.side === 1 ? `${u.name} fades.` : `${u?.name} falls.`;
        a.sfx('die');
        return 24;
      }
      case 'revive': {
        const u = this.b.byUid(ev.uid);
        this.message = `${u?.name} is back on their feet.`;
        a.sfx('heal');
        return 20;
      }
      case 'status': {
        const u = this.b.byUid(ev.uid);
        if (ev.on && u && ev.s !== 'charge') {
          const [x, y] = this.pos(ev.uid);
          this.floaters.push({ x, y: y - 4, text: STATUS_NAME[ev.s] ?? ev.s, col: STATUS_COL[ev.s] ?? 'w', t: 32 });
        }
        return ev.on ? 10 : 2;
      }
      case 'stage': {
        const [x, y] = this.pos(ev.uid);
        this.floaters.push({ x, y: y - 4, text: `${ev.stat.toUpperCase()}${ev.d > 0 ? '+' : '-'}`, col: ev.d > 0 ? 'e3' : 'r3', t: 30 });
        a.sfx(ev.d > 0 ? 'buff' : 'debuff');
        return 10;
      }
      case 'break': {
        const [x, y] = this.pos(ev.uid);
        this.floaters.push({ x, y: y - 10, text: 'BREAK', col: 'y3', t: 44 });
        this.g.shakeT = 12;
        a.sfx('break');
        return 24;
      }
      case 'recover': return 10;
      case 'hues': return 6;
      case 'summon': {
        const u = this.b.byUid(ev.uid);
        this.message = `${u?.name} joins the fight!`;
        return 24;
      }
      case 'leave': {
        this.dying.set(ev.uid, 20);
        return 20;
      }
      case 'gold': {
        if (ev.n !== 0) this.floaters.push({ x: 140, y: 150, text: `${ev.n > 0 ? '+' : ''}${ev.n}g`, col: 'y2', t: 36 });
        a.sfx('coin');
        return 8;
      }
      case 'reels': this.reels = ev.hues; a.sfx('tick'); return 50;
      case 'scan': this.scanUid = ev.uid; return 100;
      case 'push': {
        const [x, y] = this.pos(ev.uid);
        this.floaters.push({ x, y: y - 4, text: 'LATER', col: 'e3', t: 28 });
        return 8;
      }
      case 'link': return 0;
      case 'end': return 0;
    }
  }

  // ---------- Commands ----------

  openCommand() {
    const u = this.actor!;
    const items: MenuItem[] = [
      { label: 'Attack', id: 'attack' },
      { label: 'Skill', id: 'skill', enabled: !u.st.hush },
      { label: 'Item', id: 'item', enabled: Object.entries(this.b.items).some(([id, n]) => n > 0 && ITEMS[id]?.battle) },
      { label: 'Guard', id: 'guard' },
    ];
    if (this.b.mech.has('link')) items.push({ label: 'Link', id: 'link', enabled: this.b.canUse(u, 'link'), color: this.b.link >= 100 ? 'y3' : undefined });
    items.push({ label: 'Flee', id: 'flee', enabled: this.b.canFlee });
    this.menu = new Menu(items, items.length);
    this.message = `${u.name}'s turn.`;
    this.reels = null;
    this.scanUid = 0;
    this.setMode('command');
  }

  updateCommand() {
    const r = this.menu.update(this.g.input, this.g.audio);
    if (r !== 'ok') return;
    const id = this.menu.cur!.id!;
    const u = this.actor!;
    if (id === 'attack') this.chooseTarget({ kind: 'skill', id: 'attack' });
    else if (id === 'guard') this.commit({ t: 'guard' });
    else if (id === 'flee') this.commit({ t: 'flee' });
    else if (id === 'skill') this.openSkills();
    else if (id === 'item') this.openItems();
    else if (id === 'link') {
      this.pending = { kind: 'skill', id: 'link' };
      const others = this.b.alive(0).filter(x => x !== u);
      this.sub = new Menu(others.map(x => ({ label: x.name, id: String(x.uid) })), Math.max(1, others.length));
      this.setMode('partner');
    }
  }

  openSkills() {
    const u = this.actor!;
    const items: MenuItem[] = u.skills.filter(s => s !== 'attack' && s !== 'link').map(id => {
      const sk = SKILLS[id];
      const c = this.b.skillCost(u, sk);
      const right = c.gold ? `${c.gold}g` : c.tails ? `${c.ink}+T` : c.ink ? `${c.ink}` : '';
      const hue = typeof sk.hue === 'string' && sk.hue.length === 1 && sk.hue !== 'N' ? sk.hue as Hue : sk.hue === 'loaded' ? u.loaded : undefined;
      return { label: sk.name, right, enabled: this.b.canUse(u, id), id, desc: sk.desc || 'Echoed from a foe.', hue };
    });
    if (!items.length) { this.g.audio.sfx('bump'); return; }
    this.sub = new Menu(items, 8);
    this.setMode('skill');
  }

  updateSkill() {
    const r = this.sub.update(this.g.input, this.g.audio);
    this.message = this.sub.cur?.desc ?? '';
    if (r === 'back') { this.openCommand(); return; }
    if (r !== 'ok') return;
    const id = this.sub.cur!.id!;
    const sk = SKILLS[id];
    if (sk.fx === 'load' || sk.fx === 'tricolor') {
      this.pending = { kind: 'skill', id };
      this.sub = new Menu(WHEEL.map(h => ({ label: HUE_NAME[h], hue: h, id: h })), 6);
      this.setMode('hue');
      return;
    }
    this.chooseTarget({ kind: 'skill', id });
  }

  openItems() {
    const items: MenuItem[] = Object.entries(this.b.items)
      .filter(([id, n]) => n > 0 && ITEMS[id]?.battle)
      .map(([id, n]) => ({ label: ITEMS[id].name, right: `x${n}`, id, desc: ITEMS[id].desc }));
    this.sub = new Menu(items, 8);
    this.setMode('item');
  }

  updateItem() {
    const r = this.sub.update(this.g.input, this.g.audio);
    this.message = this.sub.cur?.desc ?? '';
    if (r === 'back') { this.openCommand(); return; }
    if (r === 'ok') this.chooseTarget({ kind: 'item', id: this.sub.cur!.id! });
  }

  updateHue() {
    const r = this.sub.update(this.g.input, this.g.audio);
    const h = this.sub.cur?.id as Hue;
    const foe = this.b.alive(1)[0];
    this.message = foe ? `${HUE_NAME[h]} against ${foe.name}: x${hueMult(h, this.b.defHues(foe)).toFixed(2)}` : '';
    if (r === 'back') { this.openSkills(); return; }
    if (r === 'ok' && this.pending) {
      this.pending.hue = h;
      this.commit({ t: 'skill', skill: this.pending.id, hue: h });
    }
  }

  updatePartner() {
    const r = this.sub.update(this.g.input, this.g.audio);
    this.message = 'Choose a partner for the link.';
    if (r === 'back') { this.openCommand(); return; }
    if (r === 'ok') this.commit({ t: 'skill', skill: 'link', partner: +this.sub.cur!.id! });
  }

  chooseTarget(p: Pending) {
    const u = this.actor!;
    this.pending = p;
    let tgt: string;
    if (p.kind === 'skill') tgt = SKILLS[p.id].target;
    else tgt = ITEMS[p.id].use!.target;
    this.targetAll = tgt === 'foes' || tgt === 'allies' || tgt === 'rand';
    if (tgt === 'self') { this.commit({ t: 'skill', skill: p.id, target: u.uid }); return; }
    if (tgt === 'foe' || tgt === 'foes' || tgt === 'rand') this.targets = this.b.alive(1);
    else if (tgt === 'ko') this.targets = this.b.party.filter(x => !x.alive);
    else this.targets = this.b.alive(0);
    if (!this.targets.length) { this.g.audio.sfx('bump'); return; }
    this.targetMenuIdx = tgt === 'ally' ? Math.max(0, this.targets.indexOf(u)) : 0;
    this.setMode('target');
  }

  updateTarget() {
    const inp = this.g.input;
    const a = this.g.audio;
    const n = this.targets.length;
    if (!this.targetAll) {
      const horiz = this.targets[0]?.side === 1;
      if (inp.repeat(horiz ? 'right' : 'down')) { this.targetMenuIdx = (this.targetMenuIdx + 1) % n; a.sfx('move'); }
      if (inp.repeat(horiz ? 'left' : 'up')) { this.targetMenuIdx = (this.targetMenuIdx - 1 + n) % n; a.sfx('move'); }
    }
    const t = this.targets[this.targetMenuIdx];
    this.message = this.targetInfo(t);
    if (inp.pressed('b')) {
      a.sfx('back');
      if (this.pending?.kind === 'item') this.openItems();
      else if (this.pending?.id === 'attack') this.openCommand();
      else this.openSkills();
      return;
    }
    if (inp.pressed('a')) {
      a.sfx('ok');
      const p = this.pending!;
      if (p.kind === 'item') this.commit({ t: 'item', item: p.id, target: t.uid });
      else this.commit({ t: 'skill', skill: p.id, target: t.uid, hue: p.hue });
    }
  }

  private targetInfo(t: Unit): string {
    if (this.targetAll) return this.targets[0]?.side === 1 ? 'Every foe.' : 'Every ally.';
    if (t.side === 0) return `${t.name}  ${t.hp}/${t.maxHp}`;
    const p = this.pending;
    if (p?.kind === 'skill') {
      const sk = SKILLS[p.id];
      if (sk.kind === 'phys' || sk.kind === 'mag') {
        const h = this.b.atkHue(this.actor!, sk, t);
        const m = hueMult(h, this.b.defHues(t));
        const tag = m > 1 ? `^yx${m.toFixed(2)}^0` : m < 1 ? `^nx${m.toFixed(2)}^0` : '';
        return `${t.name} ${tag}`;
      }
    }
    return t.name;
  }

  commit(a: Action) {
    const u = this.actor!;
    this.queue.push(...this.b.act(u, a));
    this.message = '';
    this.setMode('events');
  }

  // ---------- End ----------

  finish() {
    if (this.mode === 'victory' || this.mode === 'done') return;
    const st = this.g.st;
    const r = this.b.result ?? 'win';
    this.result = r;
    writeBack(this.b.units, st.members);
    st.gold = Math.max(0, this.b.gold);
    st.items = Object.fromEntries(Object.entries(this.b.items).filter(([, n]) => n > 0));
    st.log.push({ ch: st.chapter, group: this.group, result: r, turns: this.b.turn, minFrac: +this.b.stats.minPartyFrac.toFixed(2), lvl: st.members[st.party[0]]?.lvl ?? 1 });
    if (st.log.length > 400) st.log.shift();
    if (r === 'win') {
      const rw = this.b.rewards();
      const goldMul = this.b.party.some(p => p.traits.has('gold')) ? 1.25 : 1;
      const gold = Math.round(rw.gold * goldMul);
      st.gold += gold;
      const lines: string[] = [];
      if (rw.xp || gold) lines.push(`Victory! ${rw.xp} XP and ${gold} gold.`);
      else lines.push('It is over.');
      for (const d of rw.drops) { addItem(st, d); lines.push(`Found ${ITEMS[d]?.name ?? d}.`); }
      for (const m of this.g.st.party.concat(this.g.st.reserve)) if (st.members[m].hp <= 0 && !this.o.canLose) st.members[m].hp = 1;
      const ups = grantXp(st, rw.xp);
      lines.push(...ups);
      this.victoryLines = lines;
      if (!this.o.survive) this.g.audio.play('victory');
      if (ups.length) this.g.audio.sfx('lvl');
      this.setMode('victory');
    } else {
      this.setMode('done');
      this.close(r);
    }
  }

  updateVictory() {
    if (this.modeT < 20) return;
    if (this.g.input.pressed('a') || this.g.input.pressed('b')) {
      this.victoryLines.shift();
      if (!this.victoryLines.length) this.close('win');
      else this.modeT = 10;
    }
  }

  close(r: BattleResult) {
    this.mode = 'done';
    this.g.pop(this);
    this.done(r);
  }

  // ---------- Drawing ----------

  draw(g: Gfx) {
    g.clear('k');
    const b = this.b;
    const floorY = 66;
    const bg = this.bgPal as never;
    const def = this.g.world?.def;
    const theme = def?.theme ?? {};
    const backKind = def?.bg ?? 'tree';
    const backPal = (theme[backKind] ?? BASE_THEME[backKind] ?? BASE_THEME.tree) as never;
    for (let i = 0; i < 40; i++) {
      const sx = (i * 73 + 11) % 160, sy = 12 + (i * 37) % 36;
      if ((i + Math.floor(this.t / 40)) % 7 !== 0) g.rect(sx, sy, 1, 1, i % 3 ? 'g1' : 'g2');
    }
    for (let x = 0; x < 160; x += 8) {
      g.sprite({ g: 'tile', pal: backPal, o: { kind: backKind, v: (x / 8) % 4 } }, x, floorY - 8, { frame: Math.floor(this.t / 20) % 8 });
      g.sprite({ g: 'tile', pal: bg, o: { kind: 'ground', v: (x / 8) % 4 } }, x, floorY, {});
      g.sprite({ g: 'tile', pal: bg, o: { kind: 'ground', v: (x / 8 + 2) % 4 } }, x, floorY + 8, {});
    }
    g.alpha(0.5, () => g.rect(0, floorY - 8, 160, 8, 'k'));
    g.alpha(0.35, () => g.rect(0, floorY, 160, 2, 'k'));
    if (b.mech.has('tempo')) this.drawTimeline(g);
    this.drawEnemies(g);
    this.drawMessage(g);
    this.drawParty(g);
    if (this.mode === 'command') this.menu.draw(g, 104, PARTY_Y, 56, this.t);
    if (this.mode === 'skill' || this.mode === 'item' || this.mode === 'hue' || this.mode === 'partner') this.sub.draw(g, 0, PARTY_Y, 160, this.t);
    if (this.reels && this.cur?.k === 'reels') this.drawReels(g);
    if (this.scanUid && this.cur?.k === 'scan') this.drawScan(g);
    for (const f of this.floaters) {
      const w = textW(f.text);
      g.text(f.text, Math.round(f.x - w / 2) + 1, Math.round(f.y) + 1, 'k');
      g.text(f.text, Math.round(f.x - w / 2), Math.round(f.y), f.col);
    }
    if (this.mode === 'intro') this.drawIntro(g);
    if (this.mode === 'victory') this.drawVictory(g);
  }

  private drawIntro(g: Gfx) {
    const p = 1 - this.modeT / 24;
    if (p <= 0) return;
    for (let y = 0; y < 160; y += 8) for (let x = 0; x < 160; x += 8) {
      const d = ((x + y) / 320);
      if (d < p) g.rect(x, y, 8, 8, 'k');
    }
  }

  private drawTimeline(g: Gfx) {
    const order = this.b.forecast(9);
    g.rect(0, 0, 160, 10, 'ink');
    g.text('NEXT', 2, 2, 'g2');
    order.forEach((u, i) => {
      const x = 22 + i * 15;
      if (i === 0) g.rectO(x - 2, 0, 12, 10, 'w');
      g.sprite({ ...u.spec, pal: this.b.displayPal(u) }, x, 1, { grey: false });
      g.rect(x, 9, 8, 1, u.side === 0 ? 'c2' : 'r2');
    });
  }

  private drawEnemies(g: Gfx) {
    const b = this.b;
    const lay = this.enemyLayout();
    for (const u of b.units) {
      if (u.side !== 1) continue;
      const l = lay.get(u.uid);
      if (!l) continue;
      const scale = scaleOf(u);
      const bob = u.alive ? Math.round(Math.sin((this.t + u.uid * 20) / 18)) : 0;
      let y = l.y + bob;
      if (this.lungeUid === u.uid && this.lungeT > 0) y += this.lungeT > 5 ? 10 - this.lungeT : this.lungeT;
      const spec = { ...u.spec, pal: b.displayPal(u) };
      const dissolve = this.dying.has(u.uid) ? 1 - (this.dying.get(u.uid)! / 28) : 0;
      if (!u.alive && !this.dying.has(u.uid)) continue;
      const flash = this.flashUid === u.uid && this.flashT > 0 && Math.floor(this.flashT / 2) % 2 === 0;
      g.sprite(spec, l.x, y, { scale, flash: flash ? 'w' : undefined, dissolve: dissolve > 0 ? dissolve : undefined, seed: u.uid, grey: false });
      if (!u.alive) continue;
      const bw = l.s;
      g.bar(l.x, l.y + l.s + 2, bw, 2, u.hp / u.maxHp, u.hp / u.maxHp < 0.3 ? 'r2' : 'e2', 'ink');
      if (b.mech.has('break') && u.maxShell > 0) {
        if (u.broken) g.text('BRK', l.x + bw / 2 - 5, l.y - 7, 'y3');
        else for (let i = 0; i < u.maxShell; i++) g.rect(l.x + i * 3, l.y - 4, 2, 2, i < u.shell ? 'w' : 'g1');
      }
      let sx = l.x;
      for (const s of Object.keys(u.st)) {
        g.rect(sx, l.y + l.s + 5, 2, 2, STATUS_COL[s] ?? 'w');
        sx += 3;
      }
      if (this.mode === 'target' && (this.targetAll ? this.targets.includes(u) : this.targets[this.targetMenuIdx] === u)) {
        if (Math.floor(this.t / 8) % 2 === 0) {
          const cx = l.x + l.s / 2;
          g.rect(cx - 2, l.y - 10, 5, 1, 'w');
          g.rect(cx - 1, l.y - 9, 3, 1, 'w');
          g.rect(cx, l.y - 8, 1, 1, 'w');
        }
        hueChips(g, b.defHues(u), l.x, l.y + l.s + 5);
      }
      if (this.actor === u && this.mode === 'events') g.rect(l.x + l.s / 2 - 1, l.y - 3, 3, 1, 'r3');
    }
  }

  private drawMessage(g: Gfx) {
    g.box(0, MSG_Y, 160, 12);
    if (this.banner && this.mode === 'events') {
      if (this.bannerHue) g.rect(4, MSG_Y + 4, 3, 3, HUE_COLOR[this.bannerHue]);
      g.text(this.banner, this.bannerHue ? 10 : 5, MSG_Y + 3, 'y3');
    } else {
      const line = wrap(this.message, 150)[0] ?? '';
      g.text(line, 5, MSG_Y + 3, 'w');
    }
  }

  private drawParty(g: Gfx) {
    const b = this.b;
    g.box(0, PARTY_Y - 1, 160, 69);
    b.party.forEach((u, i) => {
      const y = PARTY_Y + i * ROW_H;
      const active = this.actor === u && (this.mode === 'command' || this.mode === 'target' || this.mode === 'skill');
      if (active) g.rect(1, y, 158, ROW_H - 1, 'ink');
      if (this.mode === 'target' && !this.targets[0]?.side && (this.targetAll ? this.targets.includes(u) : this.targets[this.targetMenuIdx] === u)) {
        if (Math.floor(this.t / 8) % 2 === 0) g.cursor(2, y + 4, 0);
      }
      const flash = this.flashUid === u.uid && this.flashT > 0 && Math.floor(this.flashT / 2) % 2 === 0;
      const spec = { ...u.spec, pal: b.displayPal(u) };
      g.sprite(spec, 8, y + 3, { grey: !u.alive, flash: flash ? 'r2' : undefined });
      g.text(u.name, 19, y + 2, u.alive ? 'w' : 'g1');
      const hpCol: Col = !u.alive ? 'g1' : u.hp / u.maxHp < 0.25 ? 'r3' : u.hp / u.maxHp < 0.5 ? 'y2' : 'w';
      g.textR(`${u.hp}`, 76, y + 2, hpCol);
      g.text(`/${u.maxHp}`, 77, y + 2, 'g1');
      g.bar(19, y + 9, 80, 2, u.hp / u.maxHp, u.hp / u.maxHp < 0.25 ? 'r2' : 'e2');
      g.bar(19, y + 12, 80 * Math.min(1, u.maxInk / 60), 1, u.ink / Math.max(1, u.maxInk), 'c2');
      if (this.mode !== 'command') {
        if (u.maxInk > 0 && u.id !== 'vend') g.text(`^c${u.ink}^0 ink`, 104, y + 2, 'g2');
        if (u.id === 'nona') g.text(`${u.tails}T`, 140, y + 2, 'w');
        if (u.id === 'tint') { g.rect(140, y + 3, 5, 4, HUE_COLOR[u.loaded]); }
        let sx = 104;
        for (const s of Object.keys(u.st)) {
          g.text(STATUS_NAME[s]?.[0] ?? '?', sx, y + 8, STATUS_COL[s] ?? 'w');
          sx += 5;
        }
        if (u.guard) g.text('G', sx, y + 8, 'b3');
      }
    });
    const bottom = PARTY_Y + 4 * ROW_H;
    if (b.mech.has('link')) {
      g.text('LINK', 4, bottom, b.link >= 100 ? 'y3' : 'g2');
      g.bar(24, bottom + 2, 60, 2, b.link / 100, b.link >= 100 ? 'y2' : 'm2');
    }
    if (b.party.some(p => p.id === 'vend')) g.textR(`${b.gold}g`, 156, bottom, 'y2');
  }

  private drawReels(g: Gfx) {
    g.box(50, 30, 60, 22);
    this.reels!.forEach((h, i) => {
      const show = this.evT < 40 - i * 10 ? h : WHEEL[(Math.floor(this.t / 3) + i) % 6];
      g.rect(56 + i * 17, 35, 12, 12, HUE_COLOR[show]);
    });
  }

  private drawScan(g: Gfx) {
    const u = this.b.byUid(this.scanUid);
    if (!u) return;
    const d = ENEMIES[u.id];
    const lines = [`${u.name}  Lv${u.lvl}`, `HP ${u.hp}/${u.maxHp}`, ...wrap(d?.desc ?? '', 140)];
    const hues = this.b.defHues(u);
    const weak = WHEEL.filter(h => hueMult(h, hues) > 1).map(h => HUE_NAME[h]);
    lines.push(weak.length ? `Weak to ${weak.join(', ')}.` : 'No weakness.');
    g.box(6, 8, 148, lines.length * LINE_H + 6);
    lines.forEach((l, i) => g.text(l, 10, 11 + i * LINE_H, i === 0 ? 'y3' : 'w'));
  }

  private drawVictory(g: Gfx) {
    const line = this.victoryLines[0];
    if (!line) return;
    const lines = wrap(line, 140);
    g.box(6, 30, 148, lines.length * LINE_H + 8);
    lines.forEach((l, i) => g.text(l, 11, 34 + i * LINE_H, 'w'));
  }
}

const HUE_LIGHT: Record<Hue, Col> = { R: 'r3', Y: 'y3', G: 'e3', C: 'c3', B: 'b3', M: 'm3', N: 'g3' };
const SKILLS_BY_NAME: Record<string, SkillDef> = Object.fromEntries(Object.values(SKILLS).map(s => [s.name, s]));
export { goldUnit };

function scaleOf(u: Unit): number {
  return (u.spec.n ?? 1) >= 3 ? 2 : 3;
}
