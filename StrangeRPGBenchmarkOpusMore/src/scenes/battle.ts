import { BAYER, Gfx, W } from '../core/gfx';
import { textWidth, wrap } from '../core/font';
import { SpriteSpec, sizeOf } from '../core/sprites';
import type { Game, Scene } from '../game/game';
import { Battle } from '../battle/engine';
import { Action, BEvent, SkillDef, STATUS, Unit, Verb, VERBS, VERB_NAME } from '../battle/types';
import { SKILLS, describeSkill } from '../data/skills';
import { ENEMIES, GROUPS } from '../data/enemies';
import { ITEMS } from '../data/items';
import { MEMBERS } from '../data/members';
import { duoFor } from '../data/duos';
import { buildUnit, gainXp, writeBack } from '../game/state';
import { heroSprite } from '../game/speakers';
import type { MapDef } from '../maps/types';
import { battleBg } from './bgs';

export interface BattleOpts2 {
  first?: 1 | 0 | -1;
  feral?: boolean;
  canLose?: boolean;
  music?: string;
  noFlee?: boolean;
  intro?: string;
  enemies?: string[];
  stakes?: number;
  scene?: string;
}

type MenuKind = 'cmd' | 'skill' | 'item' | 'answer' | 'target' | 'call' | 'mask' | 'bench';
interface Opt { label: string; right?: string; ok: boolean; val: string; desc?: string; }
interface Menu { kind: MenuKind; opts: Opt[]; idx: number; scroll: number; title?: string; }
interface Pending { kind: 'attack' | 'skill' | 'item' | 'answer' | 'line' | 'call' | 'swapout' | 'swapin'; id?: string; verb?: Verb; tgt?: SkillDef['tgt']; out?: number; }

interface Float { uid: number; text: string; color: string; t: number; dy: number; }

const MAX_LOG = 4;

export class BattleScene implements Scene {
  b: Battle;
  phase: 'intro' | 'next' | 'play' | 'menu' | 'ring' | 'brace' | 'end' | 'done' | 'listen' = 'intro';
  queue: BEvent[] = [];
  evT = 0;
  actor: Unit | null = null;
  menus: Menu[] = [];
  pending: Pending | null = null;
  tsel = 0;
  tpool: Unit[] = [];
  tall = false;
  twinA: Action | null = null;
  log: string[] = [];
  floats: Float[] = [];
  flash = new Map<number, number>();
  step = new Map<number, number>();
  fadeOut = new Map<number, number>();
  banner: { text: string; t: number; color: string } | null = null;
  bigText: { text: string; t: number } | null = null;
  snaps: { snap: string; uid: number }[] = [];
  introT = 40;
  ringT = 0;
  ringTarget = 0;
  ringAction: Action | null = null;
  ringHit = false;
  braceT = 0;
  braceAt = 0;
  braceTargets: number[] = [];
  braced = new Set<number>();
  braceLocked = false;
  enemyAction: Action | null = null;
  endT = 0;
  endLines: string[] = [];
  listenUnit: Unit | null = null;
  shakeT = 0;
  rewindFx = 0;
  newKept: string[] = [];
  bg: (g: Gfx, t: number) => void;
  // The field as it looked when the battle began, for the transition.
  snapIn: HTMLCanvasElement | null = null;
  introLen = 50;

  constructor(public game: Game, group: string, public o: BattleOpts2, private resolve: (r: 'win' | 'lose' | 'fled') => void, map?: MapDef) {
    const s = game.state!;
    const mech = new Set<string>();
    if (s.flags.mech_answer) mech.add('answer');
    if (s.flags.mech_line) mech.add('line');
    if (s.flags.mech_rewind && s.roster.again) mech.add('rewind');
    if (s.flags.mech_lastword) mech.add('lastword');
    if ((s.inv.receiver ?? 0) > 0) mech.add('call');
    const hushed = !!map?.hush && !s.flags[map.hush];
    if (hushed) mech.add('hush');
    const party = s.party.map((id) => buildUnit(s.roster[id]));
    const bench = Object.values(s.roster).filter((m) => !s.party.includes(m.id)).map((m) => buildUnit(m, true));
    const enemies = o.enemies ?? GROUPS[group] ?? [group];
    const boss = enemies.some((e) => ENEMIES[e]?.boss);
    this.b = new Battle([...party, ...bench], enemies, {
      seed: (Date.now() ^ (s.stats.battles * 7919)) >>> 0,
      inv: { ...s.inv },
      mech,
      stakes: o.stakes ?? (s.flags.mech_stakes ? s.stakes : 0),
      canFlee: !o.noFlee,
      first: o.first ?? 0,
      kept: s.kept,
      rewinds: mech.has('rewind') ? 1 + ((s.roster.again?.lvl ?? 0) >= 15 ? 1 : 0) : 0,
    });
    // Again mode: every foe is tougher, by a third per finished run, up to three runs.
    const ng = Math.min(3, Number(s.flags.ngplus ?? 0));
    if (ng) for (const f of this.b.foesAll()) {
      const k = 1 + ng / 3;
      f.mhp = Math.round(f.mhp * k); f.hp = f.mhp;
      f.pow = Math.round(f.pow * (1 + ng * 0.2)); f.wit = Math.round(f.wit * (1 + ng * 0.2));
    }
    // The Gentle option in Options: foes have a quarter less health and hit a fifth softer.
    if (s.flags.gentle) for (const f of this.b.foesAll()) {
      f.mhp = Math.max(1, Math.round(f.mhp * 0.75)); f.hp = f.mhp;
      f.pow = Math.round(f.pow * 0.8); f.wit = Math.round(f.wit * 0.8);
    }
    for (const id of enemies) if (!s.seen.includes(id)) s.seen.push(id);
    if (enemies.includes('amen2')) this.b.extra.finalPhase = 1;
    this.bg = battleBg(map, o.scene);
    this.snapIn = document.createElement('canvas');
    this.snapIn.width = W; this.snapIn.height = 192;
    this.snapIn.getContext('2d')!.drawImage(game.gfx.canvas, 0, 0);
    this.introT = this.introLen;
    s.stats.battles++;
    game.audio.play(o.music ?? (hushed ? 'quiet' : boss ? 'boss' : 'battle'));
    game.audio.sfx('encounter');
    const names = this.b.foes().map((f) => f.name);
    this.addLog(o.intro ?? (names.length === 1 ? `${names[0]} blocks the way.` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} appear.`));
    if (o.first === 1) this.addLog('You caught them off guard.');
    if (o.first === -1) this.addLog('They caught you off guard!');
  }

  // ---- helpers ----
  owner(u: Unit): number {
    if (!this.game.input.twoPlayer) return 0;
    const i = this.game.state!.party.indexOf(u.id);
    return i < 0 ? 0 : i % 2;
  }
  addLog(t: string) {
    for (const l of wrap(t, 176)) this.log.push(l);
    while (this.log.length > MAX_LOG) this.log.shift();
  }
  sprite(u: Unit): SpriteSpec {
    if (u.side === 0) return u.id === 'hello' ? heroSprite() : MEMBERS[u.id].sprite;
    return ENEMIES[u.id]?.sprite ?? { t: 'blob', seed: 1, a: 'red', b: 'paper' };
  }
  // Sprite size in screen pixels. Metasprites are drawn at native size, never scaled.
  sizeOfUnit(u: Unit): number {
    if (u.side === 0) {
      if (u.id === 'bigger') return sizeOf(2 + Math.floor((u.grow ?? 0) / 2));
      return 16;
    }
    return sizeOf(u.scale ?? 2);
  }
  pos(u: Unit): [number, number] {
    if (u.side === 0) {
      const ps = this.b.partyAll();
      const i = ps.indexOf(u);
      const n = Math.max(1, ps.length);
      const x = Math.round(W / (n + 1) * (i + 1)) - 8;
      const sz = this.sizeOfUnit(u);
      return [x - (sz - 16) / 2, 90 - sz];
    }
    const fs = this.b.foesAll().filter((f) => f.alive || this.fadeOut.has(f.uid));
    const widths = fs.map((f) => this.sizeOfUnit(f));
    const total = widths.reduce((a, b) => a + b, 0) + (fs.length - 1) * 8;
    let x = 96 - total / 2;
    for (let i = 0; i < fs.length; i++) {
      if (fs[i] === u) return [Math.round(x), 66 - widths[i]];
      x += widths[i] + 8;
    }
    return [96, 40];
  }
  mechs(): Set<string> { return this.b.mech; }

  // ---- flow ----
  update() {
    const inp = this.game.input;
    for (const f of this.floats) { f.t--; f.dy -= 0.4; }
    this.floats = this.floats.filter((f) => f.t > 0);
    for (const m of [this.flash, this.step]) for (const [k, v] of m) { if (v <= 1) m.delete(k); else m.set(k, v - 1); }
    for (const [k, v] of this.fadeOut) { if (v <= 1) this.fadeOut.delete(k); else this.fadeOut.set(k, v - 1); }
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    if (this.bigText && --this.bigText.t <= 0) this.bigText = null;
    if (this.shakeT > 0) this.shakeT--;
    if (this.rewindFx > 0) this.rewindFx--;

    switch (this.phase) {
      case 'intro':
        if (--this.introT <= 0 || (this.introT < this.introLen - 12 && inp.pressed('ok'))) this.phase = 'next';
        break;
      case 'next': this.nextTurn(); break;
      case 'play': this.playEvents(); break;
      case 'listen':
        if (inp.pressed('ok') || inp.pressed('back')) { this.listenUnit = null; this.phase = 'play'; }
        break;
      case 'menu': this.menuInput(); break;
      case 'ring': this.ringUpdate(); break;
      case 'brace': this.braceUpdate(); break;
      case 'end': this.endUpdate(); break;
    }
  }

  nextTurn() {
    if (this.b.outcome) { this.finish(); return; }
    const r = this.b.beginTurn();
    this.queue.push(...r.events);
    this.actor = r.actor;
    if (!r.actor) { this.finish(); return; }
    if (!r.canAct) { this.phase = 'play'; this.afterPlay = () => { this.phase = 'next'; }; return; }
    const a = r.actor;
    if (a.side === 0) {
      this.afterPlay = () => {
        this.snaps.push({ snap: this.b.snapshot(), uid: a.uid });
        if (this.snaps.length > 30) this.snaps.shift();
        this.openCommands();
      };
      this.phase = 'play';
    } else {
      this.afterPlay = () => this.enemyTurn(a);
      this.phase = 'play';
    }
  }

  afterPlay: (() => void) | null = null;

  playEvents() {
    const inp = this.game.input;
    if (this.evT > 0) {
      this.evT--;
      if (inp.pressed('ok') && this.evT > 6) this.evT = 6;
      return;
    }
    const ev = this.queue.shift();
    if (!ev) {
      const f = this.afterPlay;
      this.afterPlay = null;
      if (this.b.outcome) { this.finish(); return; }
      if (f) f(); else this.phase = 'next';
      return;
    }
    this.showEvent(ev);
  }

  showEvent(ev: BEvent) {
    const au = this.game.audio;
    const name = (uid: number) => this.b.get(uid)?.name ?? '';
    switch (ev.k) {
      case 'msg': this.addLog(ev.text); this.evT = 34; break;
      case 'act': {
        const u = this.b.get(ev.uid);
        if (u) this.step.set(u.uid, 14);
        if (ev.name !== 'Attack') this.banner = { text: ev.name, t: 40, color: u?.side === 0 ? 'gold' : 'pink' };
        this.evT = 12;
        break;
      }
      case 'dmg': {
        const u = this.b.get(ev.uid);
        if (!u) break;
        this.flash.set(u.uid, 14);
        const col = ev.crit ? 'gold' : ev.weak ? 'orange' : ev.resist ? 'grey' : 'white';
        this.floats.push({ uid: u.uid, text: String(ev.n), color: col, t: 36, dy: 0 });
        if (ev.weak) this.floats.push({ uid: u.uid, text: 'WEAK', color: 'orange', t: 36, dy: -9 });
        if (ev.clean) this.floats.push({ uid: u.uid, text: 'CLEAN', color: 'mint', t: 36, dy: -18 });
        if (ev.braced) this.floats.push({ uid: u.uid, text: 'BRACED', color: 'sky', t: 36, dy: -9 });
        au.sfx(ev.crit ? 'crit' : ev.weak ? 'weak' : 'hit');
        if (ev.crit || (u.side === 0 && ev.n > u.mhp * 0.3)) this.shakeT = 8;
        this.evT = 16;
        break;
      }
      case 'miss': this.floats.push({ uid: ev.uid, text: 'miss', color: 'grey', t: 30, dy: 0 }); au.sfx('miss'); this.evT = 12; break;
      case 'heal': {
        if (ev.n <= 0) break;
        this.floats.push({ uid: ev.uid, text: (ev.vp ? 'VP+' : '+') + ev.n, color: ev.vp ? 'lime' : 'mint', t: 34, dy: 0 });
        au.sfx('heal');
        this.evT = 12;
        break;
      }
      case 'status': {
        const def = STATUS[ev.id];
        if (ev.on && ev.id !== 'guard') {
          this.floats.push({ uid: ev.uid, text: def.name, color: def.good ? 'sky' : 'pink', t: 34, dy: -6 });
          au.sfx(def.good ? 'buff' : 'debuff');
          this.evT = 12;
        }
        break;
      }
      case 'ko': {
        const u = this.b.get(ev.uid);
        if (u?.side === 1) { this.fadeOut.set(ev.uid, 24); this.addLog(`${u.name} is defeated.`); }
        au.sfx('ko');
        this.evT = 22;
        break;
      }
      case 'revive': this.addLog(`${name(ev.uid)} is back up.`); au.sfx('heal'); this.evT = 20; break;
      case 'answer': {
        if (ev.ok) { au.sfx('answer'); this.bigText = { text: 'ANSWERED', t: 50 }; this.evT = 40; }
        else { au.sfx('wrong'); this.evT = 16; }
        break;
      }
      case 'leave': this.fadeOut.set(ev.uid, 30); this.evT = 20; break;
      case 'push': this.floats.push({ uid: ev.uid, text: '\u0004\u0004', color: 'sky', t: 24, dy: -14 }); this.evT = 6; break;
      case 'windup': this.addLog(ev.text); this.banner = { text: 'WINDING UP', t: 60, color: 'red' }; au.sfx('debuff'); this.evT = 50; break;
      case 'break': this.bigText = { text: 'BREAK!', t: 45 }; au.sfx('crit'); this.shakeT = 10; this.evT = 30; break;
      case 'grow': au.sfx('buff'); this.evT = 10; break;
      case 'swap': au.sfx('door'); this.evT = 20; break;
      case 'summon': this.bigText = { text: ev.name.toUpperCase(), t: 50 }; au.sfx('ring'); this.evT = 36; break;
      case 'spawn': this.flash.set(ev.uid, 20); this.evT = 14; break;
      case 'lastword': this.bigText = { text: 'LAST WORD', t: 50 }; au.sfx('rewind'); this.evT = 34; break;
      case 'listen': {
        const u = this.b.get(ev.uid);
        if (u) { this.listenUnit = u; this.phase = 'listen'; au.sfx('listen'); }
        break;
      }
    }
  }

  // ---- enemy ----
  enemyTurn(u: Unit) {
    const act = this.b.planEnemy(u);
    this.enemyAction = act;
    const sk = act.t === 'skill' ? SKILLS[act.skill] : act.t === 'attack' ? SKILLS.attack : null;
    const harmful = sk && (sk.power || sk.fx === 'drainvp' || sk.fx === 'returnto') && (sk.tgt === 'foe' || sk.tgt === 'foes');
    if (this.game.state!.timed && harmful) {
      this.braceTargets = sk!.tgt === 'foes' ? this.b.party().map((p) => p.uid) : [(act as { target: number }).target];
      this.braceT = 0;
      this.braceAt = 16 + Math.floor(Math.random() * 22);
      this.braced.clear();
      this.braceLocked = false;
      this.step.set(u.uid, 30);
      this.phase = 'brace';
      return;
    }
    this.execEnemy(u, act);
  }

  braceUpdate() {
    const inp = this.game.input;
    this.braceT++;
    const open = this.braceT >= this.braceAt && this.braceT < this.braceAt + 13;
    if (inp.pressed('ok') && !this.braceLocked) {
      if (open) { for (const t of this.braceTargets) this.braced.add(t); this.game.audio.sfx('clean'); this.game.state!.stats.braced++; }
      this.braceLocked = true;
    }
    if (this.braceT >= this.braceAt + 16) this.execEnemy(this.actor!, this.enemyAction!);
  }

  execEnemy(u: Unit, act: Action) {
    const evs = this.b.perform(u, act, { braced: this.braced });
    this.braced = new Set();
    this.queue.push(...evs);
    this.afterPlay = () => { this.phase = 'next'; };
    this.phase = 'play';
  }

  // ---- party commands ----
  openCommands() {
    const a = this.actor!;
    this.menus = [];
    this.pending = null;
    this.twinA = null;
    this.menus.push(this.cmdMenu(a, false));
    this.phase = 'menu';
  }

  cmdMenu(a: Unit, second: boolean): Menu {
    const s = this.game.state!;
    const opts: Opt[] = [];
    const lw = this.b.has(a, 'lastword');
    opts.push({ label: 'Attack', ok: true, val: 'attack' });
    opts.push({ label: 'Skill', ok: true, val: 'skill' });
    if (this.mechs().has('answer')) opts.push({ label: 'Answer', ok: true, val: 'answer' });
    opts.push({ label: 'Item', ok: Object.keys(this.b.inv).some((k) => ITEMS[k]?.battle && this.b.inv[k] > 0), val: 'item' });
    if (!lw) opts.push({ label: 'Guard', ok: true, val: 'guard' });
    if (!second && !a.twin) {
      const p = this.b.linePartner(a);
      if (p) {
        const tech = duoFor(a.id, p.id);
        opts.push({ label: 'Line', right: p.name.split(' ')[0], ok: a.vp >= (tech.cost ?? 0) && p.vp >= (tech.cost ?? 0), val: 'line', desc: `${tech.name} with ${p.name}: ${tech.desc} (${tech.cost} VP each)` });
      }
    }
    if (a.id === 'hello' && this.mechs().has('call') && s.kept.length) opts.push({ label: 'Call', ok: !this.b.callUsed && a.vp >= 6, val: 'call' });
    if (a.id === 'someone' && s.kept.length) opts.push({ label: 'Face', ok: true, val: 'mask' });
    if (this.mechs().has('rewind') && !second) opts.push({ label: 'Rewind', right: String(this.b.rewinds), ok: this.b.rewinds > 0 && this.snaps.length >= 2, val: 'rewind' });
    if (!second && !lw) opts.push({ label: 'Run', ok: this.b.canFlee, val: 'flee' });
    return { kind: 'cmd', opts, idx: 0, scroll: 0, title: a.twin ? (second ? 'Firster' : 'First') : undefined };
  }

  skillMenu(a: Unit, second: boolean): Menu {
    const ids = second ? a.skills2 ?? [] : a.skills;
    const opts: Opt[] = ids.map((id) => {
      const sk = SKILLS[id];
      const blockedByHush = sk.voice && this.mechs().has('hush');
      return { label: sk.name, right: sk.cost ? String(sk.cost) : '', ok: this.b.canUse(a, sk) && !(id === 'evacuate' && !this.b.bench().some((x) => x.alive)), val: id, desc: blockedByHush ? 'No sound carries here.' : describeSkill(sk) };
    });
    return { kind: 'skill', opts, idx: 0, scroll: 0 };
  }

  menuInput() {
    const inp = this.game.input;
    const a = this.actor!;
    const pl = !this.game.input.twoPlayer ? 0 : a.twin ? (this.twinA ? 1 : 0) : this.owner(a);
    const m = this.menus[this.menus.length - 1];
    if (m.kind === 'target') return this.targetInput(pl);
    const cols = m.kind === 'cmd' ? 2 : 1;
    const n = m.opts.length;
    if (inp.pressed('up', pl)) { m.idx = (m.idx - cols + n) % n; this.game.audio.sfx('move'); }
    if (inp.pressed('down', pl)) { m.idx = (m.idx + cols) % n; this.game.audio.sfx('move'); }
    if (cols === 2 && (inp.pressed('left', pl) || inp.pressed('right', pl))) { m.idx = m.idx ^ 1; if (m.idx >= n) m.idx = n - 1; this.game.audio.sfx('move'); }
    const rows = 4;
    if (m.idx < m.scroll) m.scroll = m.idx;
    if (m.idx >= m.scroll + rows) m.scroll = m.idx - rows + 1;
    if (inp.pressed('back', pl)) {
      if (this.menus.length > 1) { this.menus.pop(); this.game.audio.sfx('back'); }
      else if (a.twin && this.twinA) { this.twinA = null; this.menus = [this.cmdMenu(a, false)]; this.game.audio.sfx('back'); }
      return;
    }
    if (!inp.pressed('ok', pl)) return;
    const o = m.opts[m.idx];
    if (!o) return;
    if (!o.ok) { this.game.audio.sfx('buzz'); return; }
    this.game.audio.sfx('ok');
    const second = !!(a.twin && this.twinA);
    switch (m.kind) {
      case 'cmd': this.chooseCmd(a, o.val, second); break;
      case 'skill': {
        if (o.val === 'evacuate') {
          this.pending = { kind: 'swapout', id: 'evacuate' };
          this.openTargets('ally');
          break;
        }
        const sk = SKILLS[o.val];
        this.pending = { kind: 'skill', id: o.val, tgt: sk.tgt };
        this.openTargets(sk.tgt);
        break;
      }
      case 'item': {
        const it = ITEMS[o.val];
        this.pending = { kind: 'item', id: o.val, tgt: it.tgt ?? 'ally' };
        this.openTargets(it.tgt ?? 'ally');
        break;
      }
      case 'answer': {
        this.pending = { kind: 'answer', verb: o.val as Verb };
        this.openTargets('foe');
        break;
      }
      case 'call': {
        const sk = SKILLS[ENEMIES[o.val]?.kept?.skill ?? 'attack'];
        this.pending = { kind: 'call', id: o.val, tgt: sk?.tgt };
        const tg = sk?.tgt === 'ally' || sk?.tgt === 'other' || sk?.tgt === 'allies' || sk?.tgt === 'self' ? 'allies' : 'foes';
        this.openTargets(tg);
        break;
      }
      case 'mask': this.commit({ t: 'mask', kept: o.val }); break;
      case 'bench': {
        this.commit({ t: 'swap', out: this.pending!.out!, inn: Number(o.val) });
        break;
      }
    }
  }

  chooseCmd(a: Unit, v: string, second: boolean) {
    const s = this.game.state!;
    switch (v) {
      case 'attack': this.pending = { kind: 'attack' }; this.openTargets('foe'); break;
      case 'skill': this.menus.push(this.skillMenu(a, second)); break;
      case 'answer': this.menus.push({ kind: 'answer', idx: 0, scroll: 0, opts: VERBS.filter((vb) => (vb !== 'remember' || s.flags.verb_remember) && (vb !== 'hello' || this.b.extra.finalPhase)).map((vb) => ({ label: VERB_NAME[vb], ok: true, val: vb, desc: this.verbHint(vb) })) }); break;
      case 'item': {
        const opts: Opt[] = Object.keys(this.b.inv).filter((k) => ITEMS[k]?.battle && this.b.inv[k] > 0).map((k) => ({ label: ITEMS[k].name, right: 'x' + this.b.inv[k], ok: true, val: k, desc: ITEMS[k].desc }));
        this.menus.push({ kind: 'item', opts, idx: 0, scroll: 0 });
        break;
      }
      case 'guard': this.commit({ t: 'guard' }); break;
      case 'line': {
        const p = this.b.linePartner(a)!;
        const tech = duoFor(a.id, p.id);
        this.pending = { kind: 'line', id: tech.id, tgt: tech.tgt };
        this.openTargets(tech.tgt);
        break;
      }
      case 'call': {
        const opts: Opt[] = s.kept.map((k) => {
          const sk = SKILLS[ENEMIES[k]?.kept?.skill ?? ''];
          return { label: ENEMIES[k]?.name ?? k, right: sk?.name ?? '', ok: !!sk, val: k, desc: `${ENEMIES[k]?.kept?.name}: calls ${sk?.name ?? 'nothing'} with Hello's voice behind it.` };
        });
        this.menus.push({ kind: 'call', opts, idx: 0, scroll: 0 });
        break;
      }
      case 'mask': {
        const opts: Opt[] = s.kept.map((k) => {
          const sk = SKILLS[ENEMIES[k]?.kept?.skill ?? ''];
          return { label: ENEMIES[k]?.name ?? k, right: sk?.name ?? '', ok: !!sk && a.mask !== k, val: k, desc: `Wear this face to use ${sk?.name ?? 'nothing'}.` };
        });
        this.menus.push({ kind: 'mask', opts, idx: 0, scroll: 0 });
        break;
      }
      case 'rewind': this.rewind(); break;
      case 'flee': this.commit({ t: 'flee' }); break;
    }
  }

  verbHint(v: Verb): string {
    const h: Record<Verb, string> = {
      feed: 'Give it something to eat.', play: 'Play with it.', pet: 'A gentle hand.', praise: 'Tell it it did well.',
      listen: 'Really listen to it.', promise: 'Promise it what it wants.', forgive: 'Forgive it.', letgo: 'Tell it it can stop now.',
      remember: 'Say its name. Remember it.',
      hello: 'The first word, instead of the last one.',
    };
    return h[v];
  }

  openTargets(tgt: SkillDef['tgt']) {
    const a = this.actor!;
    this.tall = tgt === 'foes' || tgt === 'allies';
    if (tgt === 'self') { this.finishTarget(a.uid); return; }
    if (tgt === 'foe' || tgt === 'foes') this.tpool = this.b.foes();
    else if (tgt === 'dead') this.tpool = this.b.partyAll().filter((u) => !u.alive && !u.gone);
    else if (tgt === 'other') this.tpool = this.b.party().filter((u) => u.uid !== a.uid);
    else this.tpool = this.b.party();
    if (!this.tpool.length) { this.game.audio.sfx('buzz'); return; }
    this.tsel = 0;
    if (tgt === 'ally' || tgt === 'dead' || tgt === 'other') {
      const i = this.tpool.indexOf(a);
      this.tsel = i >= 0 && tgt !== 'other' ? i : 0;
    }
    this.menus.push({ kind: 'target', opts: [], idx: 0, scroll: 0 });
  }

  targetInput(pl: number) {
    const inp = this.game.input;
    const n = this.tpool.length;
    if (!this.tall) {
      if (inp.pressed('left', pl) || inp.pressed('up', pl)) { this.tsel = (this.tsel + n - 1) % n; this.game.audio.sfx('move'); }
      if (inp.pressed('right', pl) || inp.pressed('down', pl)) { this.tsel = (this.tsel + 1) % n; this.game.audio.sfx('move'); }
    }
    if (inp.pressed('back', pl)) { this.menus.pop(); this.game.audio.sfx('back'); return; }
    if (inp.pressed('ok', pl)) { this.game.audio.sfx('ok'); this.finishTarget(this.tpool[this.tsel].uid); }
  }

  finishTarget(uid: number) {
    const p = this.pending;
    const a = this.actor!;
    if (!p) return;
    switch (p.kind) {
      case 'attack': this.commit({ t: 'attack', target: uid }); break;
      case 'skill': this.commit({ t: 'skill', skill: p.id!, target: uid }); break;
      case 'item': this.commit({ t: 'item', item: p.id!, target: uid }); break;
      case 'answer': this.commit({ t: 'answer', verb: p.verb!, target: uid }); break;
      case 'line': this.commit({ t: 'line', partner: this.b.linePartner(a)!.uid, tech: p.id!, target: uid }); break;
      case 'call': this.commit({ t: 'call', kept: p.id!, target: uid }); break;
      case 'swapout': {
        this.pending = { kind: 'swapin', out: uid };
        const opts: Opt[] = this.b.bench().filter((x) => x.alive).map((x) => ({ label: x.name, right: `${x.hp}/${x.mhp}`, ok: true, val: String(x.uid) }));
        this.menus.push({ kind: 'bench', opts, idx: 0, scroll: 0 });
        break;
      }
      default: break;
    }
  }

  commit(act: Action) {
    const a = this.actor!;
    if (a.twin && !this.twinA && act.t !== 'flee') {
      this.twinA = act;
      this.menus = [this.cmdMenu(a, true)];
      return;
    }
    let final: Action = act;
    if (a.twin && this.twinA) { final = { t: 'twin', a: this.twinA, b: act }; this.twinA = null; }
    this.menus = [];
    const s = this.game.state!;
    if (final.t === 'line') s.stats.lines++;
    if (final.t === 'call') s.stats.calls++;
    const physSingle = (x: Action): number | null => {
      if (x.t === 'attack') return x.target;
      if (x.t === 'skill' && SKILLS[x.skill]?.kind === 'phys' && SKILLS[x.skill]?.tgt === 'foe') return x.target;
      if (x.t === 'line') return x.target;
      if (x.t === 'twin') return physSingle(x.a) ?? physSingle(x.b);
      return null;
    };
    const tgt = physSingle(final);
    if (s.timed && tgt !== null && this.b.get(tgt)?.side === 1) {
      this.ringAction = final;
      this.ringTarget = tgt;
      this.ringT = 0;
      this.ringHit = false;
      this.phase = 'ring';
      return;
    }
    this.exec(final, false);
  }

  ringUpdate() {
    const inp = this.game.input;
    this.ringT++;
    const a = this.actor!;
    if (inp.pressed('ok', this.owner(a)) || (this.game.input.twoPlayer && inp.pressed('ok'))) {
      const win = this.ringT >= 26 && this.ringT <= 34;
      this.ringHit = win;
      if (win) { this.game.audio.sfx('clean'); this.game.state!.stats.clean++; }
      this.exec(this.ringAction!, win);
      return;
    }
    if (this.ringT > 40) this.exec(this.ringAction!, false);
  }

  exec(act: Action, clean: boolean) {
    const evs = this.b.perform(this.actor!, act, { clean });
    this.queue.push(...evs);
    this.afterPlay = () => { this.phase = 'next'; };
    this.phase = 'play';
  }

  rewind() {
    if (this.snaps.length < 2 || this.b.rewinds <= 0) return;
    this.snaps.pop();
    const prev = this.snaps[this.snaps.length - 1];
    const left = this.b.rewinds - 1;
    this.b.restore(prev.snap);
    this.b.rewinds = left;
    this.game.state!.stats.rewinds++;
    this.actor = this.b.get(prev.uid) ?? null;
    this.floats = [];
    this.fadeOut.clear();
    this.queue = [];
    this.rewindFx = 30;
    this.game.audio.sfx('rewind');
    this.addLog('Again! The last turn happens again.');
    this.menus = [this.cmdMenu(this.actor!, false)];
    this.phase = 'menu';
  }

  // ---- end ----
  finish() {
    if (this.phase === 'end' || this.phase === 'done') return;
    const s = this.game.state!;
    const out = this.b.outcome ?? 'lose';
    this.phase = 'end';
    this.endT = 0;
    this.endLines = [];
    s.inv = { ...this.b.inv };
    for (const k of Object.keys(s.inv)) if (s.inv[k] <= 0) delete s.inv[k];
    writeBack(s, this.b.units);
    if (this.b.extra.scripted) {
      this.endLines.push('...');
      this.game.audio.play(null);
      return;
    }
    if (out === 'win') {
      s.stats.wins++;
      s.stats.answered += this.b.answered.length;
      s.stats.defeated += this.b.defeated.length;
      const r = this.b.rewards();
      s.pleas += r.pleas;
      this.endLines.push(`Won! ${r.xp} XP${r.pleas ? `, ${r.pleas} pleas` : ''}.`);
      for (const d of r.drops) { s.inv[d] = (s.inv[d] ?? 0) + 1; this.endLines.push(`Found ${ITEMS[d]?.name}.`); }
      for (const id of this.b.answered) {
        if (!s.kept.includes(id) && ENEMIES[id]?.kept) {
          s.kept.push(id);
          this.endLines.push(`Kept prayer: ${ENEMIES[id].kept!.name}.`);
        }
      }
      for (const u of this.b.partyAll()) if (!u.alive) { const m = s.roster[u.id]; if (m) m.hp = 1; }
      this.endLines.push(...gainXp(s, r.xp));
      this.game.audio.play('victory');
    } else if (out === 'fled') {
      s.stats.flees++;
      this.endLines.push('You got away.');
    } else {
      this.endLines.push('The party falls.');
      this.game.audio.play(null);
    }
  }

  endUpdate() {
    this.endT++;
    if (this.endT > 20 && (this.game.input.pressed('ok') || this.game.input.pressed('back'))) {
      this.phase = 'done';
      this.game.pop(this);
      this.game.input.clearAll();
      this.resolve(this.b.outcome === 'win' ? 'win' : this.b.outcome === 'fled' ? 'fled' : 'lose');
    }
  }

  // ---- drawing ----
  draw(g: Gfx) {
    const sx = this.shakeT > 0 ? (this.shakeT % 2 ? 2 : -2) : 0;
    g.ctx.save();
    g.ctx.translate(sx, 0);
    this.drawField(g);
    g.ctx.restore();
    this.drawTimeline(g);
    this.drawParty(g);
    this.drawBottom(g);
    if (this.rewindFx > 0) g.alpha(this.rewindFx / 60, () => g.rect(0, 0, W, 192, 'lilac'));
    if (this.phase === 'intro') this.drawIntro(g);
  }

  // The field breaks into blocks and goes dark, then the battle opens from the center in 8-pixel cells.
  drawIntro(g: Gfx) {
    const k = this.introLen - this.introT;
    if (k < 20 && this.snapIn) {
      const b = [1, 2, 4, 8, 16][Math.min(4, Math.floor(k / 4))];
      if (b === 1) g.image(this.snapIn, 0, 0);
      else {
        const small = document.createElement('canvas');
        small.width = W / b; small.height = 192 / b;
        const c = small.getContext('2d')!;
        c.imageSmoothingEnabled = false;
        c.drawImage(this.snapIn, 0, 0, small.width, small.height);
        g.ctx.imageSmoothingEnabled = false;
        g.ctx.drawImage(small, 0, 0, W, 192);
      }
      g.fade(k / 18);
      return;
    }
    const p = (k - 20) / (this.introLen - 20);
    for (let by = 0; by < 24; by++) for (let bx = 0; bx < 24; bx++) {
      const v = (Math.abs(bx - 11.5) + Math.abs(by - 11.5)) / 23 + (BAYER[(by & 3) * 4 + (bx & 3)] / 16) * 0.3;
      if (v > p * 1.3) g.rect(bx * 8, by * 8, 8, 8, 'ink');
    }
  }

  drawField(g: Gfx) {
    g.ctx.save();
    g.ctx.beginPath();
    g.ctx.rect(0, 11, W, 81);
    g.ctx.clip();
    this.bg(g, g.t);
    g.ctx.restore();
    const units = [...this.b.foesAll().filter((u) => u.alive || this.fadeOut.has(u.uid)), ...this.b.partyAll()];
    for (const u of units) {
      const [x, y] = this.pos(u);
      const sz = this.sizeOfUnit(u);
      const fl = this.flash.get(u.uid) ?? 0;
      const st = this.step.get(u.uid) ?? 0;
      const dy = st ? (u.side === 0 ? -4 : 4) : 0;
      const fo = this.fadeOut.get(u.uid);
      const alpha = fo !== undefined ? fo / 30 : 1;
      let yy = y + dy;
      let frame = Math.floor((g.t + u.uid * 13) / 30) % 2;
      if (u.windup) yy += Math.round(Math.sin(g.t / 3) * 2);
      if (u.side === 0 && !u.alive) { frame = 0; }
      if (u.alive) g.shadow(x + sz / 2, y + sz - 2, Math.max(8, Math.round(sz * 0.75)), 0.5);
      if (fl && Math.floor(fl / 2) % 2) g.silhouette(this.sprite(u), x, yy, sz, 'white');
      else g.alpha(u.side === 0 && !u.alive ? 0.35 : alpha, () => g.sprite(this.sprite(u), x, yy, sz, frame, false));
      if (u.side === 0 && this.b.has(u, 'lastword')) g.text('!', x + sz / 2 - 1, yy - 9, 'gold');
      if (u.side === 1 && u.alive) {
        const w = sz;
        g.bar(x, y + w + 2, w, 2, u.hp / u.mhp, u.listened ? 'lime' : 'red', 'ink');
        let ix = x;
        for (const s of u.status.slice(0, 3)) {
          g.rect(ix, y - 4, 3, 3, STATUS[s.id].good ? 'sky' : 'pink');
          ix += 4;
        }
      }
    }
    // Targeting cursor.
    const m = this.menus[this.menus.length - 1];
    if (this.phase === 'menu' && m?.kind === 'target') {
      const ts = this.tall ? this.tpool : [this.tpool[this.tsel]];
      for (const t of ts) {
        if (!t) continue;
        const [x, y] = this.pos(t);
        const sz = this.sizeOfUnit(t);
        g.text('\u0005', x + sz / 2 - 2, y - 8 + (Math.floor(g.t / 8) % 2), 'gold');
      }
    }
    if (this.phase === 'ring') {
      const t = this.b.get(this.ringTarget);
      if (t) {
        const [x, y] = this.pos(t);
        const sz = this.sizeOfUnit(t);
        const cx = x + sz / 2, cy = y + sz / 2;
        const r = Math.max(1, 30 - this.ringT * 0.85);
        const inWin = this.ringT >= 26 && this.ringT <= 34;
        g.circle(cx, cy, 5, 'gold');
        g.circle(cx, cy, r, inWin ? 'mint' : 'paper');
        if (inWin) g.circle(cx, cy, r + 1, 'mint');
      }
    }
    if (this.phase === 'brace' && this.braceT >= this.braceAt && this.braceT < this.braceAt + 13) {
      for (const uid of this.braceTargets) {
        const u = this.b.get(uid);
        if (!u) continue;
        const [x, y] = this.pos(u);
        g.box(x + 3, y - 13, 10, 11, 'gold', 'gold');
        g.text('!', x + 7, y - 11, 'ink');
      }
    }
    for (const f of this.floats) {
      const u = this.b.get(f.uid);
      if (!u) continue;
      const [x, y] = this.pos(u);
      g.textC(f.text, x + this.sizeOfUnit(u) / 2, y - 4 + f.dy, f.color, 'ink');
    }
    if (this.banner) {
      const w = textWidth(this.banner.text) + 12;
      g.box(96 - w / 2, 12, w, 14, this.banner.color);
      g.textC(this.banner.text, 96, 15, this.banner.color);
    }
    if (this.bigText) {
      const s = 1 + Math.max(0, (this.bigText.t - 40) / 10);
      void s;
      g.textC(this.bigText.text, 96, 34, Math.floor(g.t / 4) % 2 ? 'gold' : 'cream', 'ink');
    }
  }

  drawTimeline(g: Gfx) {
    g.rect(0, 0, W, 11, 'ink');
    const order = this.b.predict(11);
    let x = 2;
    order.forEach((uid, i) => {
      const u = this.b.get(uid);
      if (!u) return;
      if (i === 0 && (this.phase === 'menu' || this.phase === 'ring')) g.rect(x - 1, 0, 10, 11, 'gold');
      g.sprite(this.sprite(u), x, 1, 8, 0, false);
      g.rect(x, 9, 8, 1, u.side === 0 ? 'sky' : 'red');
      x += 11;
      if (i === 0) x += 3;
    });
    if (this.mechs().has('rewind')) g.textR('\u0006' + this.b.rewinds, 190, 2, 'lilac');
  }

  drawParty(g: Gfx) {
    g.rect(0, 92, W, 41, 'ink');
    g.rect(0, 92, W, 1, 'slate');
    const ps = this.b.partyAll();
    ps.forEach((u, i) => {
      const y = 95 + i * 9;
      const active = this.actor === u && (this.phase === 'menu' || this.phase === 'ring');
      if (active) g.rect(0, y - 1, W, 9, 'dusk');
      const nm = u.name.split(' ')[0];
      g.text(nm, 4, y, !u.alive ? 'grey' : active ? 'gold' : 'paper');
      if (this.game.input.twoPlayer) g.text(this.owner(u) ? '2' : '1', 44, y, this.owner(u) ? 'pink' : 'sky');
      g.bar(52, y + 3, 40, 3, u.hp / u.mhp, u.hp < u.mhp * 0.25 ? 'red' : 'mint', 'slate');
      g.textR(`${Math.max(0, u.hp)}`, 122, y, u.hp < u.mhp * 0.25 ? 'red' : 'paper');
      g.text(`/${u.mhp}`, 123, y, 'grey');
      g.textR(`${u.vp}`, 172, y, 'lime');
      let sx = 175;
      for (const s of u.status.slice(0, 3)) { g.rect(sx, y + 2, 3, 3, STATUS[s.id].good ? 'sky' : 'pink'); sx += 4; }
      if (u.grow) g.text('+' + u.grow, 183, y, 'gold');
    });
  }

  drawBottom(g: Gfx) {
    g.box(0, 133, W, 59, 'paper');
    const m = this.menus[this.menus.length - 1];
    if (this.phase === 'listen' && this.listenUnit) {
      const u = this.listenUnit;
      const def = ENEMIES[u.id];
      const lines = wrap(`"${def?.prayer ?? '...'}"`, 176);
      g.text(`${u.name} was asked for:`, 8, 138, 'gold');
      lines.slice(0, 2).forEach((l, i) => g.text(l, 8, 149 + i * 10, 'cream'));
      const info = `Weak: ${u.weak.join(', ') || 'none'}   Resists: ${[...u.resist, ...u.immune].join(', ') || 'none'}`;
      g.text(info.slice(0, 44), 8, 171, 'sky');
      g.text(`HP ${u.hp}/${u.mhp}`, 8, 180, 'grey');
      return;
    }
    if (this.phase === 'end') {
      this.endLines.slice(-5).forEach((l, i) => g.text(l, 8, 138 + i * 10, i === 0 ? 'gold' : 'paper'));
      return;
    }
    if (this.phase === 'menu' && m) {
      const a = this.actor!;
      if (m.kind === 'target') {
        const t = this.tall ? null : this.tpool[this.tsel];
        const label = this.tall ? (this.tpool[0]?.side === 1 ? 'All foes' : 'Whole party') : t?.name ?? '';
        g.text(label, 8, 138, 'gold');
        if (t && t.side === 1) {
          g.text(`HP ${t.hp}/${t.mhp}`, 8, 149, 'paper');
          if (t.listened) g.text(`Weak: ${t.weak.join(', ') || 'none'}`, 8, 159, 'sky');
          else g.text('Listen to learn its weak spots.', 8, 159, 'grey');
          if (t.windup) g.text(`Break with: ${t.windup.breakElem.join(' or ')} (${t.windup.got}/${t.windup.need})`, 8, 169, 'orange');
          const def = ENEMIES[t.id];
          if (this.game.state!.kept.includes(t.id) && def) g.text(`Wants: ${VERB_NAME[def.ask]}`, 8, 179, 'mint');
        } else if (t) g.text(`HP ${Math.max(0, t.hp)}/${t.mhp}  VP ${t.vp}/${t.mvp}`, 8, 149, 'paper');
        return;
      }
      if (m.kind === 'cmd') {
        g.text(m.title ? `${a.name}: ${m.title}` : a.name, 8, 137, 'gold');
        if (this.game.input.twoPlayer) g.textR(`P${(a.twin && this.twinA ? 1 : this.owner(a)) + 1}`, 186, 137, 'pink');
        m.opts.forEach((o, i) => {
          const col = i % 2, row = Math.floor(i / 2);
          const x = 16 + col * 88, y = 148 + row * 9;
          if (row > 4) return;
          g.text(o.label, x, y, !o.ok ? 'slate' : i === m.idx ? 'gold' : 'paper');
          if (o.right) g.text(o.right, x + textWidth(o.label) + 4, y, 'grey');
          if (i === m.idx) g.cursor(x - 9, y);
        });
        const cur = m.opts[m.idx];
        if (cur?.desc) this.descBox(g, cur.desc);
        return;
      }
      // List menus.
      const rows = 4;
      const vis = m.opts.slice(m.scroll, m.scroll + rows);
      g.text(m.kind === 'skill' ? 'Skills' : m.kind === 'item' ? 'Items' : m.kind === 'answer' ? 'Answer with...' : m.kind === 'call' ? 'Call which kept prayer?' : m.kind === 'mask' ? 'Wear which face?' : 'Send in who?', 8, 137, 'gold');
      if (m.kind === 'skill' || m.kind === 'call') g.textR(`VP ${a.vp}`, 186, 137, 'lime');
      vis.forEach((o, i) => {
        const idx = m.scroll + i;
        const y = 148 + i * 10;
        g.text(o.label, 18, y, !o.ok ? 'slate' : idx === m.idx ? 'gold' : 'paper');
        if (o.right) g.textR(o.right, 186, y, o.ok ? 'lime' : 'slate');
        if (idx === m.idx) g.cursor(9, y);
      });
      if (m.scroll > 0) g.text('\u0006', 182, 144, 'grey');
      if (m.scroll + rows < m.opts.length) g.text('\u0005', 182, 182, 'grey');
      const cur = m.opts[m.idx];
      if (!m.opts.length) g.text('Nothing here.', 18, 148, 'grey');
      if (cur?.desc) this.descBox(g, cur.desc);
      return;
    }
    if (this.phase === 'ring') {
      g.text('Press when the ring closes!', 8, 140, 'gold');
      return;
    }
    if (this.phase === 'brace') {
      this.log.forEach((l, i) => g.text(l, 8, 138 + i * 10, 'paper'));
      g.textR('Brace on !', 186, 180, 'grey');
      return;
    }
    this.log.forEach((l, i) => g.text(l, 8, 138 + i * 10, i === this.log.length - 1 ? 'paper' : 'grey'));
  }

  descBox(g: Gfx, text: string) {
    const lines = wrap(text, 176).slice(0, 3);
    const h = lines.length * 10 + 7;
    g.box(0, 92 - h + 1, W, h, 'grey');
    lines.forEach((l, i) => g.text(l, 8, 92 - h + 5 + i * 10, 'cream'));
  }
}
