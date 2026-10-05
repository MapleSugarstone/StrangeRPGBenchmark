import { Rng } from '../core/rng';
import { Hue, Pal3, WHEEL, hueMult, opposite, HUE_COLOR, Col } from '../core/palette';
import type { SpriteSpec } from '../core/sprites';
import { SKILLS, SkillDef, Stat, TELEGRAPH } from '../data/skills';
import { ITEMS } from '../data/items';

export type Side = 0 | 1;

export interface Status { t: number; v?: Hue | number | string }

export interface Unit {
  uid: number;
  side: Side;
  id: string;
  name: string;
  spec: SpriteSpec;
  lvl: number;
  maxHp: number;
  hp: number;
  maxInk: number;
  ink: number;
  str: number;
  def: number;
  mnd: number;
  spd: number;
  baseHues: Hue[];
  skills: string[];
  st: Record<string, Status>;
  stg: Record<Stat, number>;
  shell: number;
  maxShell: number;
  broken: boolean;
  next: number;
  guard: boolean;
  alive: boolean;
  gone: boolean;
  boss: boolean;
  ai?: string;
  mem: Record<string, number | string>;
  weaponHue: Hue;
  traits: Set<string>;
  tails: number;
  loaded: Hue;
  mark: number;
  turns: number;
  xp: number;
  gold: number;
  drops: [string, number][];
  echo: string[];
  extraHue?: Hue;
  summoned?: boolean;
}

export type Action =
  | { t: 'skill'; skill: string; target?: number; hue?: Hue; partner?: number }
  | { t: 'item'; item: string; target?: number }
  | { t: 'guard' }
  | { t: 'flee' };

export type Ev =
  | { k: 'msg'; text: string }
  | { k: 'act'; uid: number; name: string; hue?: Hue }
  | { k: 'dmg'; uid: number; n: number; crit?: boolean; mult?: number; hue?: Hue }
  | { k: 'heal'; uid: number; n: number; ink?: boolean }
  | { k: 'miss'; uid: number }
  | { k: 'die'; uid: number }
  | { k: 'revive'; uid: number }
  | { k: 'status'; uid: number; s: string; on: boolean }
  | { k: 'stage'; uid: number; stat: Stat; d: number }
  | { k: 'break'; uid: number }
  | { k: 'recover'; uid: number }
  | { k: 'hues'; uid: number }
  | { k: 'summon'; uid: number }
  | { k: 'leave'; uid: number }
  | { k: 'gold'; n: number }
  | { k: 'reels'; hues: Hue[] }
  | { k: 'scan'; uid: number }
  | { k: 'push'; uid: number; d: number }
  | { k: 'link'; v: number }
  | { k: 'end'; result: Result };

export type Result = 'win' | 'lose' | 'flee';

export interface BattleCfg {
  party: Unit[];
  enemies: Unit[];
  mech: Set<string>;
  seed?: number;
  canFlee: boolean;
  gold: number;
  items: Record<string, number>;
  makeEnemy?: (id: string) => Unit;
  greyField?: boolean;
}

export const NEGATIVE = ['static', 'stun', 'grey', 'hush'];
export const STATUS_NAME: Record<string, string> = {
  static: 'Static', stun: 'Stun', grey: 'Grey', hush: 'Hush', regen: 'Regen', taunt: 'Taunt',
  mirror: 'Glass', primed: 'Primed', painted: 'Painted', charge: 'Charging',
};

export function stageMult(s: number): number {
  return s >= 0 ? 1 + 0.25 * s : 1 / (1 - 0.25 * s);
}

export function goldUnit(lvl: number): number {
  return 4 + lvl;
}

export interface LastAction { skill: string; side: Side; uid: number }

export class Battle {
  units: Unit[];
  rng: Rng;
  time = 0;
  mech: Set<string>;
  canFlee: boolean;
  gold: number;
  items: Record<string, number>;
  link = 0;
  last: LastAction | null = null;
  result: Result | null = null;
  fleeTries = 0;
  turn = 0;
  nextUid = 1;
  stolen = 0;
  makeEnemy?: (id: string) => Unit;
  greyField = false;
  /** Counters the balance sim reads. */
  stats = { clashes: 0, blends: 0, breaks: 0, crits: 0, dmgToParty: 0, dmgToFoes: 0, healed: 0, minPartyFrac: 1 };

  constructor(cfg: BattleCfg) {
    this.rng = new Rng(cfg.seed ?? Math.floor(Math.random() * 1e9));
    this.mech = cfg.mech;
    this.canFlee = cfg.canFlee;
    this.gold = cfg.gold;
    this.items = cfg.items;
    this.makeEnemy = cfg.makeEnemy;
    this.greyField = !!cfg.greyField;
    this.units = [...cfg.party, ...cfg.enemies];
    for (const u of this.units) {
      u.uid = this.nextUid++;
      u.next = this.interval(u) * this.rng.range(0.15, 1.0);
      if (u.traits.has('first')) u.next = this.rng.range(0.01, 0.1);
      u.mark = u.hp;
      if (u.side === 1) u.loaded = u.loaded ?? u.baseHues[0];
    }
  }

  get party(): Unit[] { return this.units.filter(u => u.side === 0); }
  get enemies(): Unit[] { return this.units.filter(u => u.side === 1 && !u.gone); }
  byUid(uid: number | undefined): Unit | undefined { return this.units.find(u => u.uid === uid); }
  alive(side: Side): Unit[] { return this.units.filter(u => u.side === side && u.alive && !u.gone); }

  eff(u: Unit, s: Stat): number {
    return u[s] * stageMult(u.stg[s]);
  }

  interval(u: Unit): number {
    return 2000 / (this.eff(u, 'spd') + 20);
  }

  defHues(u: Unit): Hue[] {
    if (u.st.grey || this.greyField) return ['N', 'N'];
    const h = [...u.baseHues];
    if (u.st.painted) h[0] = u.st.painted.v as Hue;
    if (u.extraHue) h[1] = u.extraHue;
    return h;
  }

  /** The palette a unit should be drawn with, so its colors always show its current hues. */
  displayPal(u: Unit): Pal3 {
    const p = [...u.spec.pal] as Pal3;
    if (u.st.grey) return ['k', 'g2', 'g3'];
    if (u.st.painted) p[1] = HUE_COLOR[u.st.painted.v as Hue];
    if (u.extraHue) p[2] = HUE_COLOR[u.extraHue];
    return p;
  }

  atkHue(u: Unit, sk: SkillDef, t: Unit | null): Hue {
    if (u.st.grey || this.greyField) return 'N';
    const h = sk.hue;
    if (h === 'wpn') return (u.st.primed?.v as Hue) ?? u.weaponHue;
    if (h === 'loaded') return u.loaded;
    if (h === 'invert') return t ? opposite(this.defHues(t)[0]) : 'N';
    const own: Hue[] = [...u.baseHues.filter(x => x !== 'N'), ...(u.extraHue ? [u.extraHue] : [])];
    if (h === 'best') return this.bestOf(own.length ? own : ['N'], t);
    if (h === 'Y' && u.extraHue && u.id === 'wick') return this.bestOf(['Y', u.extraHue], t);
    return h ?? 'N';
  }

  private bestOf(hues: Hue[], t: Unit | null): Hue {
    if (!t) return hues[0];
    let best = hues[0];
    for (const h of hues) if (hueMult(h, this.defHues(t)) > hueMult(best, this.defHues(t))) best = h;
    return best;
  }

  skillCost(u: Unit, sk: SkillDef): { ink: number; gold: number; tails: number } {
    const ink = u.side === 0 && u.echo.includes(sk.id) ? echoCost(sk) : sk.ink ?? 0;
    return { ink, gold: (sk.gold ?? 0) * goldUnit(u.lvl), tails: sk.tails ?? 0 };
  }

  private echo(from: Unit, sk: SkillDef, targets: Unit[], ev: Ev[]) {
    if (from.side !== 1 || !this.mech.has('echo') || !echoable(sk)) return;
    for (const t of targets) {
      if (t.id !== 'nil' || t.side !== 0 || !t.alive || t.echo.includes(sk.id)) continue;
      t.echo.push(sk.id);
      t.skills.push(sk.id);
      ev.push({ k: 'msg', text: `${t.name} echoes ${sk.name}!` });
    }
  }

  canUse(u: Unit, id: string): boolean {
    const sk = SKILLS[id];
    if (!sk) return false;
    if (sk.mech && !this.mech.has(sk.mech)) return false;
    if (u.st.hush && id !== 'attack') return false;
    const c = this.skillCost(u, sk);
    if (u.ink < c.ink || this.gold < c.gold || u.tails < c.tails) return false;
    if (sk.target === 'ko' && !this.party.some(p => p.side === u.side && !p.alive)) return false;
    if (id === 'link' && this.link < 100) return false;
    if (sk.fx === 'reflect' && !this.last) return false;
    return true;
  }

  /** Units in the order they will act next, ignoring future statuses. */
  forecast(n: number): Unit[] {
    const live = this.units.filter(u => u.alive && !u.gone);
    const times = new Map(live.map(u => [u, u.next]));
    const out: Unit[] = [];
    for (let i = 0; i < n && live.length; i++) {
      let best = live[0];
      for (const u of live) {
        const a = times.get(u)!, b = times.get(best)!;
        if (a < b || (a === b && (u.side < best.side || (u.side === best.side && u.uid < best.uid)))) best = u;
      }
      out.push(best);
      times.set(best, times.get(best)! + this.interval(best));
    }
    return out;
  }

  nextUnit(): Unit {
    let best: Unit | null = null;
    for (const u of this.units) {
      if (!u.alive || u.gone) continue;
      if (!best || u.next < best.next || (u.next === best.next && (u.side < best.side || (u.side === best.side && u.uid < best.uid)))) best = u;
    }
    return best!;
  }

  /** Advances to the next actor and resolves start-of-turn effects. */
  beginTurn(): { u: Unit; ev: Ev[]; skip: boolean } {
    const u = this.nextUnit();
    this.time = u.next;
    this.turn++;
    u.turns++;
    u.guard = false;
    u.mark = u.hp;
    const ev: Ev[] = [];
    let skip = false;
    if (u.st.regen || u.traits.has('regen')) {
      const n = Math.max(1, Math.round(u.maxHp * (u.st.regen ? 0.07 : 0.04)));
      this.heal(u, n, ev);
    }
    if (u.st.static) {
      const n = Math.max(1, Math.round(u.maxHp * (u.boss ? 0.025 : 0.07)));
      ev.push({ k: 'msg', text: `Static crackles on ${u.name}.` });
      this.hurt(u, n, ev);
      if (!u.alive) skip = true;
    }
    if (!skip && u.broken) {
      u.broken = false;
      u.shell = u.maxShell;
      ev.push({ k: 'recover', uid: u.uid });
      ev.push({ k: 'msg', text: `${u.name} pulls itself back together.` });
      skip = true;
    } else if (!skip && u.st.stun) {
      delete u.st.stun;
      ev.push({ k: 'status', uid: u.uid, s: 'stun', on: false });
      ev.push({ k: 'msg', text: `${u.name} is stunned and loses the turn.` });
      skip = true;
    }
    if (skip) {
      if (u.alive) u.next += this.interval(u);
      this.tickStatuses(u, ev);
      this.checkEnd(ev);
    }
    return { u, ev, skip };
  }

  act(u: Unit, a: Action): Ev[] {
    const ev: Ev[] = [];
    let delay = 100;
    let setNext: number | null = null;
    if (a.t === 'guard') {
      u.guard = true;
      const gain = Math.max(1, Math.round(u.maxInk * 0.06));
      u.ink = Math.min(u.maxInk, u.ink + gain);
      ev.push({ k: 'act', uid: u.uid, name: 'Guard' });
      delay = 60;
    } else if (a.t === 'flee') {
      ev.push({ k: 'act', uid: u.uid, name: 'Flee' });
      if (!this.canFlee) {
        ev.push({ k: 'msg', text: 'There is no running from this.' });
      } else {
        const chance = 0.55 + 0.15 * this.fleeTries;
        this.fleeTries++;
        if (this.rng.chance(chance)) {
          this.result = 'flee';
          ev.push({ k: 'end', result: 'flee' });
          return ev;
        }
        ev.push({ k: 'msg', text: 'The way out is blocked.' });
      }
    } else if (a.t === 'item') {
      this.useItem(u, a.item, a.target, ev);
    } else {
      const sk = SKILLS[a.skill];
      delay = sk.delay ?? 100;
      const r = this.useSkill(u, sk, a, ev);
      if (r !== null) setNext = r;
    }
    if (u.alive) u.next = setNext ?? u.next + this.interval(u) * delay / 100;
    this.tickStatuses(u, ev);
    this.checkEnd(ev);
    return ev;
  }

  private tickStatuses(u: Unit, ev: Ev[]) {
    for (const [k, s] of Object.entries(u.st)) {
      if (k === 'charge') continue;
      s.t--;
      if (s.t <= 0) {
        delete u.st[k];
        ev.push({ k: 'status', uid: u.uid, s: k, on: false });
        if (k === 'painted' || k === 'grey') ev.push({ k: 'hues', uid: u.uid });
      }
    }
  }

  checkEnd(ev: Ev[]) {
    if (this.result) return;
    if (this.alive(1).length === 0) {
      this.result = 'win';
      ev.push({ k: 'end', result: 'win' });
    } else if (this.alive(0).length === 0) {
      this.result = 'lose';
      ev.push({ k: 'end', result: 'lose' });
    }
    const p = this.party;
    const frac = p.reduce((s, x) => s + Math.max(0, x.hp), 0) / p.reduce((s, x) => s + x.maxHp, 0);
    this.stats.minPartyFrac = Math.min(this.stats.minPartyFrac, frac);
  }

  hurt(t: Unit, n: number, ev: Ev[], meta: { crit?: boolean; mult?: number; hue?: Hue } = {}) {
    if (!t.alive) return;
    t.hp = Math.max(0, t.hp - n);
    ev.push({ k: 'dmg', uid: t.uid, n, ...meta });
    if (t.side === 0) this.stats.dmgToParty += n; else this.stats.dmgToFoes += n;
    if (t.hp <= 0) this.kill(t, ev);
  }

  kill(t: Unit, ev: Ev[]) {
    t.alive = false;
    t.hp = 0;
    t.broken = false;
    for (const k of Object.keys(t.st)) delete t.st[k];
    t.stg = { str: 0, def: 0, mnd: 0, spd: 0 };
    t.extraHue = t.side === 0 ? t.extraHue : undefined;
    ev.push({ k: 'die', uid: t.uid });
    if (t.side === 1 && t.id === 'coinmite' && this.stolen > 0) {
      this.gold += this.stolen;
      ev.push({ k: 'gold', n: this.stolen });
      ev.push({ k: 'msg', text: `You get back ${this.stolen} gold.` });
      this.stolen = 0;
    }
  }

  heal(t: Unit, n: number, ev: Ev[]) {
    if (!t.alive) return;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + Math.round(n));
    this.stats.healed += t.hp - before;
    ev.push({ k: 'heal', uid: t.uid, n: t.hp - before });
  }

  addStatus(t: Unit, id: string, turns: number, ev: Ev[], v?: Hue | number | string): boolean {
    if (!t.alive) return false;
    if (id === 'static' && t.traits.has('nostatic')) return false;
    if (id === 'grey' && t.traits.has('nogrey')) return false;
    if (id === 'stun' && t.boss) return false;
    if (id === 'hush' && t.boss) return false;
    const had = !!t.st[id];
    t.st[id] = { t: Math.max(turns, t.st[id]?.t ?? 0), v };
    if (!had) ev.push({ k: 'status', uid: t.uid, s: id, on: true });
    if (id === 'grey' || id === 'painted') ev.push({ k: 'hues', uid: t.uid });
    return true;
  }

  addStage(t: Unit, stat: Stat, d: number, ev: Ev[]) {
    const before = t.stg[stat];
    t.stg[stat] = Math.max(-3, Math.min(3, before + d));
    if (t.stg[stat] !== before) ev.push({ k: 'stage', uid: t.uid, stat, d: t.stg[stat] - before });
  }

  push(t: Unit, pct: number, ev: Ev[]) {
    const amt = this.interval(t) * pct / 100 * (t.boss ? 0.6 : 1);
    t.next += amt;
    ev.push({ k: 'push', uid: t.uid, d: amt });
  }

  damage(u: Unit, t: Unit, sk: SkillDef, pmul = 1, hueOverride?: Hue): { n: number; mult: number; crit: boolean; hue: Hue } {
    const mag = sk.kind === 'mag';
    const a = mag ? this.eff(u, 'mnd') : this.eff(u, 'str');
    const d = mag ? this.eff(t, 'mnd') * 0.5 + this.eff(t, 'def') * 0.5 : this.eff(t, 'def');
    let n = a * (sk.power ?? 1) * pmul * a / (a + d);
    n *= this.rng.range(0.9, 1.1);
    const hue = hueOverride ?? this.atkHue(u, sk, t);
    let mult = hueMult(hue, this.defHues(t));
    if (mult > 1 && u.traits.has('clash')) mult += 0.2;
    n *= mult;
    let crit = false;
    if (!mag && this.rng.chance(u.traits.has('crit') ? 0.12 : 0.06)) {
      crit = true;
      n *= 1.5;
    }
    if (t.guard) n *= 0.5;
    if (t.broken) n *= 1.5;
    return { n: Math.max(1, Math.round(n)), mult, crit, hue };
  }

  /** Average damage without randomness, for AI evaluation. */
  expect(u: Unit, t: Unit, sk: SkillDef, pmul = 1, hueOverride?: Hue): { n: number; mult: number } {
    const mag = sk.kind === 'mag';
    const a = mag ? this.eff(u, 'mnd') : this.eff(u, 'str');
    const d = mag ? this.eff(t, 'mnd') * 0.5 + this.eff(t, 'def') * 0.5 : this.eff(t, 'def');
    let n = a * (sk.power ?? 1) * pmul * a / (a + d);
    const hue = hueOverride ?? this.atkHue(u, sk, t);
    let mult = hueMult(hue, this.defHues(t));
    if (mult > 1 && u.traits.has('clash')) mult += 0.2;
    n *= mult * (sk.hits ?? 1);
    if (!mag) n *= 1.03;
    if (t.guard) n *= 0.5;
    if (t.broken) n *= 1.5;
    return { n: Math.max(1, n), mult };
  }

  strike(u: Unit, t: Unit, sk: SkillDef, ev: Ev[], pmul = 1, hueOverride?: Hue): number {
    const r = this.damage(u, t, sk, pmul, hueOverride);
    if (r.mult > 1) this.stats.clashes++;
    if (r.mult < 1) this.stats.blends++;
    if (r.crit) this.stats.crits++;
    this.hurt(t, r.n, ev, { crit: r.crit, mult: r.mult, hue: r.hue });
    if (this.mech.has('link') && u.side === 0) {
      const gain = (r.mult > 1 ? 8 : 2) + (r.crit ? 5 : 0);
      this.link = Math.min(100, this.link + gain);
      ev.push({ k: 'link', v: this.link });
    }
    if (this.mech.has('break') && t.side === 1 && t.maxShell > 0 && t.alive && !t.broken) {
      let crack = 0;
      if (r.mult > 1) crack += 1 + (u.traits.has('breaker') ? 1 : 0);
      crack += sk.breakDmg ?? 0;
      if (crack > 0) {
        t.shell = Math.max(0, t.shell - crack);
        if (t.shell === 0) {
          t.broken = true;
          this.stats.breaks++;
          t.next += this.interval(t) * 0.6;
          ev.push({ k: 'break', uid: t.uid });
          ev.push({ k: 'msg', text: `${t.name}'s shell shatters!` });
          if (this.mech.has('link')) { this.link = Math.min(100, this.link + 20); ev.push({ k: 'link', v: this.link }); }
        }
      }
    }
    return r.n;
  }

  pickFoe(u: Unit, want?: number): Unit | undefined {
    const foes = this.alive(u.side === 0 ? 1 : 0);
    if (!foes.length) return undefined;
    if (u.side === 1) {
      const taunt = foes.find(f => f.st.taunt);
      if (taunt) return taunt;
    }
    const w = this.byUid(want);
    if (w && w.alive && !w.gone && w.side !== u.side) return w;
    return this.rng.pick(foes);
  }

  private targets(u: Unit, sk: SkillDef, want?: number): Unit[] {
    const same = u.side;
    const other: Side = same === 0 ? 1 : 0;
    switch (sk.target) {
      case 'foe': { const f = this.pickFoe(u, want); return f ? [f] : []; }
      case 'foes': return this.alive(other);
      case 'ally': {
        const w = this.byUid(want);
        if (w && w.alive && w.side === same) return [w];
        const al = this.alive(same);
        return al.length ? [al.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))] : [];
      }
      case 'allies': return this.alive(same);
      case 'self': return [u];
      case 'ko': {
        const w = this.byUid(want);
        if (w && !w.alive && w.side === same && !w.gone) return [w];
        const ko = this.units.filter(x => x.side === same && !x.alive && !x.gone);
        return ko.length ? [ko[0]] : [];
      }
      case 'rand': return [];
    }
  }

  /** Returns an explicit next time when the skill sets it, otherwise null. */
  useSkill(u: Unit, sk: SkillDef, a: { target?: number; hue?: Hue; partner?: number }, ev: Ev[], free = false, pmul = 1): number | null {
    if (!free) {
      const c = this.skillCost(u, sk);
      u.ink -= c.ink;
      u.tails -= c.tails;
      if (c.gold) {
        this.gold -= c.gold;
        ev.push({ k: 'gold', n: -c.gold });
      }
    }
    if (sk.id !== 'attack' && sk.fx !== 'reflect' && sk.fx !== 'link' && !free) this.last = { skill: sk.id, side: u.side, uid: u.uid };
    if (sk.id === 'attack' && !free) this.last = { skill: 'attack', side: u.side, uid: u.uid };
    const hueShown = sk.kind === 'phys' || sk.kind === 'mag' ? this.atkHue(u, sk, null) : undefined;
    ev.push({ k: 'act', uid: u.uid, name: sk.name, hue: hueShown });
    let setNext: number | null = null;

    const fx = sk.fx ?? '';
    if (fx === 'reflect') return this.reflect(u, ev);
    if (fx === 'link') { this.doLink(u, a.partner, ev); return null; }
    if (fx === 'jackpot') { this.jackpot(u, sk, ev); return null; }
    if (fx === 'spectrum' || sk.target === 'rand') {
      const hits = sk.hits ?? 1;
      for (let i = 0; i < hits; i++) {
        const foes = this.alive(u.side === 0 ? 1 : 0);
        if (!foes.length) break;
        const t = this.rng.pick(foes);
        this.strike(u, t, sk, ev, pmul, fx === 'spectrum' ? this.rng.pick(WHEEL) : undefined);
      }
      return null;
    }
    if (fx.startsWith('charge:')) {
      u.mem.charged = fx.slice(7);
      u.st.charge = { t: 99 };
      ev.push({ k: 'status', uid: u.uid, s: 'charge', on: true });
      ev.push({ k: 'msg', text: TELEGRAPH[fx.slice(7)] ?? `${u.name} is gathering power.` });
      return null;
    }
    if (fx.startsWith('summon:')) {
      const id = fx.slice(7);
      if (this.makeEnemy && this.alive(1).length < 5) {
        const n = this.makeEnemy(id);
        n.uid = this.nextUid++;
        n.side = 1;
        n.summoned = true;
        n.next = this.time + this.interval(n) * 0.8;
        n.mark = n.hp;
        n.loaded = n.baseHues[0];
        this.units.push(n);
        ev.push({ k: 'summon', uid: n.uid });
      } else ev.push({ k: 'msg', text: 'Nothing answers.' });
      return null;
    }
    if (fx === 'shift_hue') {
      const h1 = this.rng.pick(WHEEL);
      let h2 = this.rng.pick(WHEEL);
      if (this.rng.chance(0.35)) h2 = h1;
      u.baseHues = [h1, h2];
      u.loaded = h1;
      u.spec = { ...u.spec, pal: ['k', HUE_COLOR[h1] as Col, (h2 === h1 ? HUE_LIGHT_OF(h1) : HUE_COLOR[h2]) as Col] };
      ev.push({ k: 'hues', uid: u.uid });
      return null;
    }
    if (fx === 'bribe') {
      const take = Math.min(this.gold, Math.max(10, Math.round(this.gold * 0.08)), 200);
      this.gold -= take;
      ev.push({ k: 'gold', n: -take });
      ev.push({ k: 'msg', text: `${u.name} pockets ${take} of your gold and feels better.` });
      this.heal(u, take * 2 + u.maxHp * 0.03, ev);
      return null;
    }
    if (fx === 'tricolor') {
      u.extraHue = a.hue ?? 'C';
      u.spec = { ...u.spec, pal: [u.spec.pal[0], u.spec.pal[1], HUE_COLOR[u.extraHue]] };
      ev.push({ k: 'hues', uid: u.uid });
      ev.push({ k: 'msg', text: `${u.name} takes a third ink!` });
      return null;
    }
    if (fx === 'load') {
      u.loaded = a.hue ?? u.loaded;
      ev.push({ k: 'hues', uid: u.uid });
      return null;
    }

    const ts = this.targets(u, sk, a.target);
    // Glass Guard bounces the first enemy spell aimed at a single ally.
    if (u.side === 1 && sk.kind === 'mag' && sk.target === 'foe' && ts[0]?.st.mirror) {
      const t = ts[0];
      delete t.st.mirror;
      ev.push({ k: 'status', uid: t.uid, s: 'mirror', on: false });
      ev.push({ k: 'msg', text: 'The glass throws it back!' });
      this.strike(u, u, sk, ev, pmul);
      return null;
    }
    for (const t of ts) {
      const hits = sk.hits ?? 1;
      for (let h = 0; h < hits && t.alive; h++) {
        if ((sk.kind === 'phys' || sk.kind === 'mag' || ((sk.kind === 'debuff') && sk.power)) && t.side !== u.side) {
          const n = this.strike(u, t, sk, ev, pmul);
          if (fx === 'drain') this.heal(u, n * 0.5, ev);
          if (fx === 'steal_gold' && this.gold > 0) {
            const take = Math.min(this.gold, 4 + u.lvl);
            this.gold -= take;
            this.stolen += take;
            ev.push({ k: 'gold', n: -take });
            ev.push({ k: 'msg', text: `${u.name} pilfers ${take} gold!` });
          }
        }
      }
      if (sk.kind === 'heal') {
        if (fx === 'revive') {
          if (!t.alive) {
            t.alive = true;
            t.hp = Math.max(1, Math.round(t.maxHp * (sk.power ?? 0.5)));
            ev.push({ k: 'revive', uid: t.uid });
          }
        } else if (fx === 'rewind') {
          const target = Math.max(t.mark, t.hp + this.eff(u, 'mnd') * (sk.power ?? 0.4));
          this.heal(t, target - t.hp, ev);
        } else if (fx === 'restock') {
          const n = Math.round(t.maxInk * 0.2);
          t.ink = Math.min(t.maxInk, t.ink + n);
          ev.push({ k: 'heal', uid: t.uid, n, ink: true });
        } else if (fx === 'selfrewind') {
          const back = +(u.mem.hpBack ?? u.hp);
          this.heal(t, Math.max(0, back - t.hp), ev);
        } else if (sk.power) {
          this.heal(t, this.eff(u, 'mnd') * sk.power * this.rng.range(0.95, 1.05) + 2, ev);
        }
        if (fx === 'cleanse') this.cleanse(t, ev);
      }
      if (!t.alive) continue;
      if (sk.status) {
        if (this.rng.chance(sk.status.chance)) this.addStatus(t, sk.status.id, sk.status.turns, ev, sk.status.v);
      }
      if (sk.stage) {
        this.addStage(t, sk.stage.stat, sk.stage.d, ev);
        if (fx === 'beacon') this.addStage(t, 'mnd', sk.stage.d, ev);
      }
      if (sk.push && t.side !== u.side) this.push(t, sk.push, ev);
      if (fx === 'scan') ev.push({ k: 'scan', uid: t.uid });
      if (fx === 'paint') this.addStatus(t, 'painted', 3, ev, u.loaded);
      if (fx === 'prime') this.addStatus(t, 'primed', 3, ev, u.loaded);
      if (fx === 'wash') {
        for (const s of ['regen', 'taunt', 'painted', 'primed', 'mirror'] as const) if (t.st[s]) { delete t.st[s]; ev.push({ k: 'status', uid: t.uid, s, on: false }); }
        for (const s of ['str', 'def', 'mnd', 'spd'] as Stat[]) if (t.stg[s] > 0) this.addStage(t, s, -t.stg[s], ev);
        ev.push({ k: 'hues', uid: t.uid });
      }
      if (fx === 'hasten') {
        t.next = this.time + 0.001;
        ev.push({ k: 'msg', text: `${t.name} is up next.` });
        if (t === u) setNext = t.next;
      }
      if (fx === 'buyout') {
        if (t.boss) { ev.push({ k: 'msg', text: `${t.name} is not for sale.` }); continue; }
        const price = Math.round(Math.max(goldUnit(u.lvl) * 2, t.hp * 0.6));
        if (this.gold < price) { ev.push({ k: 'msg', text: `Not enough gold. It wants ${price}.` }); continue; }
        this.gold -= price;
        ev.push({ k: 'gold', n: -price });
        t.alive = false;
        t.hp = 0;
        ev.push({ k: 'leave', uid: t.uid });
        ev.push({ k: 'msg', text: `${t.name} takes ${price} gold and leaves quietly.` });
      }
    }
    this.echo(u, sk, ts, ev);
    return setNext;
  }

  private cleanse(t: Unit, ev: Ev[]) {
    for (const s of NEGATIVE) if (t.st[s]) { delete t.st[s]; ev.push({ k: 'status', uid: t.uid, s, on: false }); }
    for (const s of ['str', 'def', 'mnd', 'spd'] as Stat[]) if (t.stg[s] < 0) this.addStage(t, s, -t.stg[s], ev);
    ev.push({ k: 'hues', uid: t.uid });
  }

  private reflect(u: Unit, ev: Ev[]): number | null {
    const last = this.last;
    if (!last) { ev.push({ k: 'msg', text: 'There is nothing to reflect.' }); return null; }
    const sk = SKILLS[last.skill];
    if (!sk) return null;
    ev.push({ k: 'msg', text: `The glass shows ${sk.name}.` });
    const fromFoe = last.side !== u.side;
    this.useSkill(u, sk, {}, ev, true, fromFoe ? 1.25 : 1.0);
    return null;
  }

  private doLink(u: Unit, partnerUid: number | undefined, ev: Ev[]) {
    const p = this.byUid(partnerUid);
    this.link = 0;
    ev.push({ k: 'link', v: 0 });
    const partner = p && p.alive && p !== u ? p : this.alive(u.side).find(x => x !== u);
    ev.push({ k: 'msg', text: partner ? `${u.name} and ${partner.name} link up!` : `${u.name} links with nobody.` });
    const sk = SKILLS.link;
    const firstHue = (x: Unit): Hue => x.weaponHue !== 'N' ? x.weaponHue : (x.baseHues.find(h => h !== 'N') ?? 'N');
    for (const t of this.alive(u.side === 0 ? 1 : 0)) {
      const phys = this.eff(u, 'str') >= this.eff(u, 'mnd');
      this.strike(u, t, { ...sk, kind: phys ? 'phys' : 'mag', power: 1.15 }, ev, 1, firstHue(u));
      if (partner && t.alive) {
        const pp = this.eff(partner, 'str') >= this.eff(partner, 'mnd');
        this.strike(partner, t, { ...sk, kind: pp ? 'phys' : 'mag', power: 1.15 }, ev, 1, firstHue(partner));
      }
    }
    if (partner) partner.next += this.interval(partner) * 0.5;
  }

  private jackpot(u: Unit, sk: SkillDef, ev: Ev[]) {
    const reels = [this.rng.pick(WHEEL), this.rng.pick(WHEEL), this.rng.pick(WHEEL)];
    // Reels favor a match a little, as slot machines in games tend to.
    if (this.rng.chance(0.3)) reels[1] = reels[0];
    ev.push({ k: 'reels', hues: reels });
    const counts = new Map<Hue, number>();
    for (const r of reels) counts.set(r, (counts.get(r) ?? 0) + 1);
    let best: Hue = reels[0];
    for (const [h, c] of counts) if (c > (counts.get(best) ?? 0)) best = h;
    const n = counts.get(best)!;
    if (n === 3) {
      ev.push({ k: 'msg', text: 'JACKPOT!' });
      for (const t of this.alive((1 - u.side) as Side)) this.strike(u, t, { ...sk, power: 2.6 }, ev, 1, best);
    } else if (n === 2) {
      ev.push({ k: 'msg', text: 'Two of a kind.' });
      for (const t of this.alive((1 - u.side) as Side)) this.strike(u, t, { ...sk, power: 1.2 }, ev, 1, best);
    } else {
      const refund = goldUnit(u.lvl);
      this.gold += refund;
      ev.push({ k: 'gold', n: refund });
      ev.push({ k: 'msg', text: 'No match. Partial refund.' });
      const t = this.pickFoe(u);
      if (t) this.strike(u, t, { ...sk, power: 0.6 }, ev, 1, 'N');
    }
  }

  useItem(u: Unit, id: string, target: number | undefined, ev: Ev[]) {
    const it = ITEMS[id];
    if (!it?.use || (this.items[id] ?? 0) <= 0) { ev.push({ k: 'msg', text: 'Nothing happens.' }); return; }
    this.items[id]--;
    ev.push({ k: 'act', uid: u.uid, name: it.name });
    const use = it.use;
    const side = u.side;
    let ts: Unit[] = [];
    const w = this.byUid(target);
    if (use.target === 'ally') ts = w && w.alive && w.side === side ? [w] : [u];
    else if (use.target === 'allies') ts = this.alive(side);
    else if (use.target === 'ko') ts = w && !w.alive && w.side === side ? [w] : this.units.filter(x => x.side === side && !x.alive && !x.gone).slice(0, 1);
    else if (use.target === 'foe') ts = w && w.alive && w.side !== side ? [w] : this.alive((1 - side) as Side).slice(0, 1);
    else ts = this.alive((1 - side) as Side);
    for (const t of ts) {
      if (use.revive && !t.alive) {
        t.alive = true;
        t.hp = Math.max(1, Math.round(t.maxHp * use.revive));
        ev.push({ k: 'revive', uid: t.uid });
      }
      if (use.heal) this.heal(t, use.heal, ev);
      if (use.ink) {
        const before = t.ink;
        t.ink = Math.min(t.maxInk, t.ink + use.ink);
        ev.push({ k: 'heal', uid: t.uid, n: t.ink - before, ink: true });
      }
      if (use.cure) this.cleanse(t, ev);
      if (use.fx === 'hasten') { t.next = this.time + 0.001; ev.push({ k: 'msg', text: `${t.name} is up next.` }); }
      if (use.dmg) {
        const hue: Hue = use.hue === 'rand' ? this.rng.pick(WHEEL) : (use.hue ?? 'N');
        const mult = hueMult(hue, this.defHues(t));
        const n = Math.max(1, Math.round(use.dmg * mult * this.rng.range(0.9, 1.1) * (t.broken ? 1.5 : 1)));
        this.hurt(t, n, ev, { mult, hue });
      }
    }
  }

  /** Enemies defeated so far, for rewards. */
  rewards(): { xp: number; gold: number; drops: string[] } {
    let xp = 0, gold = 0;
    const drops: string[] = [];
    for (const e of this.units) {
      if (e.side !== 1 || e.alive) continue;
      xp += e.xp;
      gold += e.gold;
      for (const [id, p] of e.drops) if (this.rng.chance(p)) drops.push(id);
    }
    return { xp, gold, drops };
  }
}

/** Enemy skills Nil can copy when hit by them. */
export function echoable(sk: SkillDef): boolean {
  if (sk.id === 'attack' || sk.id === 'link') return false;
  if (sk.fx && sk.fx !== 'drain') return false;
  return sk.kind === 'phys' || sk.kind === 'mag' || sk.kind === 'debuff' || sk.kind === 'heal';
}

export function echoCost(sk: SkillDef): number {
  return Math.round(3 + (sk.power ?? 0.6) * 3 * (sk.target === 'foes' || sk.target === 'allies' ? 1.6 : 1) * (sk.hits ?? 1));
}

function HUE_LIGHT_OF(h: Hue): Col {
  const m: Record<Hue, Col> = { R: 'r3', Y: 'y3', G: 'e3', C: 'c3', B: 'b3', M: 'm3', N: 'g3' };
  return m[h];
}
