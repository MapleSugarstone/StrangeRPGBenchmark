import { Rng } from './rng';
import { skill } from '../data/skills';
import { ITEMS } from '../data/items';
import type { Elem, Field, Fx, Item, Mech, Mods, ScriptEntry, Skill, Stats, Status } from '../data/types';

export type Stance = 'steady' | 'fierce' | 'swift';
type CombatStat = 'atk' | 'mag' | 'def' | 'res' | 'spd';

export interface Unit {
  uid: number;
  id: string;
  name: string;
  side: 'party' | 'foe';
  lvl: number;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  st: Record<CombatStat, number>;
  aff: Partial<Record<Elem, number>>;
  status: Partial<Record<Status, number>>;
  t: number;
  row: 0 | 1;
  stance: Stance;
  nerve: number;
  guard: boolean;
  skills: string[];
  limit?: string;
  mods: Mods;
  boss: boolean;
  defId?: string;
  script?: ScriptEntry[];
  turns: number;
  queued?: { skill: string; name?: string };
  mark?: { e: Elem; ttl: number };
  gasp: boolean;
  gaspUsed: boolean;
  asc: number;
  pact: boolean;
  immune: Status[];
  role?: string;
}

export type Action =
  | { k: 'attack'; t: number }
  | { k: 'skill'; id: string; t?: number }
  | { k: 'item'; id: string; t?: number }
  | { k: 'guard' }
  | { k: 'flee' }
  | { k: 'limit'; t?: number }
  | { k: 'ascend' }
  | { k: 'stance'; st: Stance }
  | { k: 'pact' }
  | { k: 'rewind' }
  | { k: 'dusk'; t: number };

export type Ev =
  | { t: 'msg'; text: string }
  | { t: 'act'; u: number; name: string }
  | { t: 'dmg'; u: number; n: number; weak?: boolean; resist?: boolean; crit?: boolean; e?: Elem }
  | { t: 'heal'; u: number; n: number }
  | { t: 'mp'; u: number; n: number }
  | { t: 'status'; u: number; st: Status; on: boolean }
  | { t: 'ko'; u: number }
  | { t: 'revive'; u: number }
  | { t: 'react'; u: number; name: string }
  | { t: 'opening'; u: number }
  | { t: 'mark'; u: number; e: Elem }
  | { t: 'shift' };

export interface BattleStats {
  dmgBy: Record<number, number>;
  healBy: Record<number, number>;
  actions: Record<string, number>;
  partyTurns: number;
  foeTurns: number;
  minHpFrac: number;
  koCount: number;
  itemsUsed: number;
  mpSpent: number;
  openings: number;
  reactions: number;
  gasps: number;
  rewinds: number;
  ascends: number;
  limits: number;
  dusks: number;
  rebirths: number;
  crossedLow: boolean;
  mpStart: number;
  hpStart: number;
}

export interface BattleOpts {
  party: Unit[];
  foes: Unit[];
  inv: Record<string, number>;
  mech: Set<Mech>;
  field?: Field;
  seed?: number;
  boss?: boolean;
  noFlee?: boolean;
  noStart?: boolean;
}

const REACTIONS: Record<string, { name: string; mult: number; st?: Status; turns?: number; delay?: number }> = {
  'bloom+ember': { name: 'Wildfire', mult: 1.3, st: 'burn', turns: 3 },
  'bloom+frost': { name: 'Rime', mult: 1.25, st: 'chill', turns: 3 },
  'bloom+lumen': { name: 'Sprout', mult: 1.2, st: 'weak', turns: 3 },
  'bloom+umbra': { name: 'Rot', mult: 1.3, st: 'weak', turns: 3 },
  'bloom+volt': { name: 'Spark Bloom', mult: 1.3, st: 'shock', turns: 2 },
  'ember+frost': { name: 'Steam', mult: 1.35, delay: 0.3 },
  'ember+lumen': { name: 'Solar', mult: 1.5 },
  'ember+umbra': { name: 'Smolder', mult: 1.3, st: 'hex', turns: 3 },
  'ember+volt': { name: 'Overload', mult: 1.3, st: 'stun', turns: 1 },
  'frost+lumen': { name: 'Prism', mult: 1.4 },
  'frost+umbra': { name: 'Gloom', mult: 1.25, st: 'sleep', turns: 2 },
  'frost+volt': { name: 'Superconduct', mult: 1.3, st: 'hex', turns: 3 },
  'lumen+umbra': { name: 'Eclipse', mult: 1.6 },
  'lumen+volt': { name: 'Flash', mult: 1.3, delay: 0.4 },
  'umbra+volt': { name: 'Blackout', mult: 1.3, st: 'stun', turns: 1 },
};
export const REACTION_LIST = REACTIONS;

const BUFFS: Status[] = ['regen', 'ward', 'haste', 'focus', 'taunt'];

export function newStats(): BattleStats {
  return {
    dmgBy: {}, healBy: {}, actions: {}, partyTurns: 0, foeTurns: 0, minHpFrac: 1, koCount: 0, itemsUsed: 0, mpSpent: 0,
    openings: 0, reactions: 0, gasps: 0, rewinds: 0, ascends: 0, limits: 0, dusks: 0, rebirths: 0, crossedLow: false, mpStart: 0, hpStart: 0,
  };
}

export class Battle {
  units: Unit[];
  inv: Record<string, number>;
  mech: Set<Mech>;
  field?: Field;
  rng: Rng;
  time = 0;
  over: null | 'win' | 'lose' | 'flee' = null;
  actor: Unit | null = null;
  ev: Ev[] = [];
  costMul = 1;
  stanceDone = false;
  pactDone = false;
  history: string[] = [];
  rewindsLeft = 0;
  duskLeft = 0;
  rebirthLeft = 0;
  boss: boolean;
  noFlee: boolean;
  stats: BattleStats = newStats();
  round = 0;
  cur: Unit | null = null;

  constructor(o: BattleOpts) {
    this.units = [...o.party, ...o.foes];
    this.units.forEach((u, i) => (u.uid = i));
    this.inv = o.inv;
    this.mech = o.mech;
    this.field = o.field;
    this.rng = new Rng(o.seed ?? 1);
    this.boss = !!o.boss;
    this.noFlee = !!o.noFlee || this.boss;
    if (this.has('rewind')) this.rewindsLeft = 1;
    if (this.has('dusk')) this.duskLeft = 2;
    if (this.has('ascend') && this.boss) this.rebirthLeft = 1;
    for (const u of this.units) u.t = this.interval(u) * this.rng.range(0.55, 1.0);
    this.stats.hpStart = this.party.reduce((a, u) => a + u.hp, 0);
    this.stats.mpStart = this.party.reduce((a, u) => a + u.mp, 0);
    if (!o.noStart) this.advance();
  }

  /** Runs opening foe turns when constructed with noStart. */
  start(): Ev[] {
    this.ev = [];
    this.advance();
    return this.ev;
  }

  get party(): Unit[] { return this.units.filter((u) => u.side === 'party'); }
  get foes(): Unit[] { return this.units.filter((u) => u.side === 'foe'); }
  has(m: Mech): boolean { return this.mech.has(m); }
  alive(u: Unit): boolean { return u.hp > 0; }
  livingParty(): Unit[] { return this.party.filter((u) => u.hp > 0); }
  livingFoes(): Unit[] { return this.foes.filter((u) => u.hp > 0); }
  opp(u: Unit): Unit[] { return u.side === 'party' ? this.livingFoes() : this.livingParty(); }
  ally(u: Unit): Unit[] { return u.side === 'party' ? this.livingParty() : this.livingFoes(); }
  msg(text: string) { this.ev.push({ t: 'msg', text }); }

  // ---------- stats ----------
  stat(u: Unit, k: CombatStat): number {
    let v = u.st[k];
    if (this.has('stance') && u.side === 'party') {
      if (u.stance === 'steady' && (k === 'def' || k === 'res')) v *= 1.25;
      if (u.stance === 'fierce') { if (k === 'atk' || k === 'mag') v *= 1.2; if (k === 'def' || k === 'res') v *= 0.85; }
      if (u.stance === 'swift' && k === 'spd') v *= 1.25;
    }
    const s = u.status;
    if ((k === 'atk' || k === 'mag') && s.weak) v *= 0.75;
    if ((k === 'def' || k === 'res')) { if (s.hex) v *= 0.75; if (s.ward) v *= 1.35; if (u.mods.defPct) v *= 1 + u.mods.defPct; }
    if (k === 'spd') {
      if (s.chill) v *= 0.7;
      if (s.haste) v *= 1.4;
      if (u.mods.spdPct) v *= 1 + u.mods.spdPct;
      if (this.field?.spdMul && this.has('field')) v *= this.field.spdMul;
    }
    if (u.asc > 0) v *= k === 'def' || k === 'res' ? 1.15 : 1.3;
    return Math.max(1, v);
  }
  interval(u: Unit): number { return 1000 / this.stat(u, 'spd'); }

  timeline(n = 8): { u: Unit }[] {
    const ts = this.units.filter((u) => u.hp > 0 || u.gasp).map((u) => ({ u, t: u.t, iv: this.interval(u) }));
    const out: { u: Unit }[] = [];
    for (let i = 0; i < n && ts.length; i++) {
      ts.sort((a, b) => a.t - b.t || (a.u.side === 'party' ? -1 : 1));
      const x = ts[0];
      out.push({ u: x.u });
      x.t += x.iv;
    }
    return out;
  }

  // ---------- flow ----------
  private nextUnit(): Unit | null {
    let best: Unit | null = null;
    for (const u of this.units) {
      if (u.hp <= 0 && !u.gasp) continue;
      if (!best || u.t < best.t - 1e-9 || (Math.abs(u.t - best.t) < 1e-9 && u.side === 'party' && best.side !== 'party')) best = u;
    }
    return best;
  }

  advance() {
    let guard = 0;
    while (!this.over && guard++ < 10000) {
      if (this.checkEnd()) return;
      const u = this.nextUnit();
      if (!u) { this.over = 'lose'; return; }
      this.time = Math.max(this.time, u.t);
      this.costMul = 1;
      this.cur = u;
      if (!this.startTurn(u)) { this.endTurn(u); continue; }
      if (u.side === 'party') {
        this.actor = u;
        this.stanceDone = false;
        this.pactDone = false;
        this.history.push(this.snapshot());
        if (this.history.length > 4) this.history.shift();
        this.stats.partyTurns++;
        return;
      }
      this.stats.foeTurns++;
      this.foeAct(u);
      this.endTurn(u);
    }
  }

  /** Returns false when the unit loses its turn. */
  private startTurn(u: Unit): boolean {
    u.guard = false;
    if (u.side === 'party' && u.gasp) { this.msg(`${u.name} rises for a last breath!`); return true; }
    if (u.status.burn) {
      const d = Math.max(1, Math.round(u.maxHp * 0.06));
      this.hurt(u, d, undefined, undefined, true);
      if (u.hp <= 0) return false;
    }
    if (u.status.regen) this.healUnit(u, Math.max(1, Math.round(u.maxHp * 0.08)), null);
    if (u.status.sleep) { this.msg(`${u.name} is asleep.`); return false; }
    if (u.status.stun) { delete u.status.stun; this.ev.push({ t: 'status', u: u.uid, st: 'stun', on: false }); this.msg(`${u.name} is stunned.`); return false; }
    if (u.status.shock && this.rng.chance(0.25)) { this.msg(`${u.name} fizzles!`); return false; }
    return true;
  }

  private endTurn(u: Unit) {
    const cost = this.costMul;
    u.turns++;
    if (u.gasp) { u.gasp = false; u.gaspUsed = true; this.ev.push({ t: 'ko', u: u.uid }); this.stats.koCount++; }
    for (const k of Object.keys(u.status) as Status[]) {
      if (k === 'stun') continue;
      const left = (u.status[k] ?? 0) - 1;
      if (left <= 0) { delete u.status[k]; this.ev.push({ t: 'status', u: u.uid, st: k, on: false }); } else u.status[k] = left;
    }
    if (u.mark && --u.mark.ttl <= 0) u.mark = undefined;
    if (u.asc > 0 && --u.asc === 0) this.msg(`${u.name}'s glow fades.`);
    u.t += this.interval(u) * cost;
    this.round++;
    this.actor = null;
  }

  private checkEnd(): boolean {
    if (this.livingFoes().length === 0) { this.over = 'win'; return true; }
    if (this.party.every((u) => u.hp <= 0 && !u.gasp)) {
      if (this.rebirthLeft > 0) {
        this.rebirthLeft--;
        this.stats.rebirths++;
        this.msg('The party is reborn!');
        for (const u of this.party) {
          u.hp = Math.round(u.maxHp * 0.5); u.nerve = 100; u.gasp = false; u.status = {};
          u.t = this.time + this.interval(u) * 0.5;
          this.ev.push({ t: 'revive', u: u.uid });
        }
        return false;
      }
      this.over = 'lose';
      return true;
    }
    return false;
  }

  // ---------- snapshots ----------
  snapshot(): string {
    return JSON.stringify({ units: this.units, time: this.time, inv: this.inv, actor: this.actor?.uid ?? -1 });
  }

  private restore(s: string) {
    const o = JSON.parse(s);
    this.units = o.units;
    this.time = o.time;
    for (const k of Object.keys(this.inv)) delete this.inv[k];
    Object.assign(this.inv, o.inv);
    this.actor = o.actor >= 0 ? this.units[o.actor] : null;
  }

  // ---------- legal actions ----------
  mpCost(u: Unit, s: Skill): number {
    if (u.asc > 0 || u.gasp) return 0;
    return Math.ceil(s.mp * (1 - (u.mods.mpCut ?? 0)));
  }

  legal(): Action[] {
    const u = this.actor;
    if (!u) return [];
    const out: Action[] = [];
    const foes = this.livingFoes();
    const allies = this.livingParty();
    const fallen = this.party.filter((x) => x.hp <= 0 && !x.gasp);
    const addSkill = (s: Skill, mk: (t?: number) => Action) => {
      switch (s.tgt) {
        case 'foe': foes.forEach((f) => out.push(mk(f.uid))); break;
        case 'ally': allies.forEach((a) => out.push(mk(a.uid))); break;
        case 'fallen': fallen.forEach((a) => out.push(mk(a.uid))); break;
        default: out.push(mk());
      }
    };
    for (const f of foes) out.push({ k: 'attack', t: f.uid });
    for (const id of u.skills) {
      const s = skill(id);
      if (u.mp >= this.mpCost(u, s)) addSkill(s, (t) => ({ k: 'skill', id, t }));
    }
    if (u.gasp) return out;
    if (this.has('nerve') && u.nerve >= 100 && u.limit) addSkill(skill(u.limit), (t) => ({ k: 'limit', t }));
    if (this.has('ascend') && u.nerve >= 100 && u.asc === 0) out.push({ k: 'ascend' });
    for (const id of Object.keys(this.inv)) {
      if ((this.inv[id] ?? 0) <= 0) continue;
      const it = ITEMS[id];
      if (!it) continue;
      if (it.tgt === 'ally') allies.forEach((a) => out.push({ k: 'item', id, t: a.uid }));
      else if (it.tgt === 'fallen') fallen.forEach((a) => out.push({ k: 'item', id, t: a.uid }));
      else out.push({ k: 'item', id });
    }
    out.push({ k: 'guard' });
    if (!this.noFlee) out.push({ k: 'flee' });
    if (this.has('stance') && !this.stanceDone) (['steady', 'fierce', 'swift'] as Stance[]).filter((s) => s !== u.stance).forEach((s) => out.push({ k: 'stance', st: s }));
    if (this.has('gasp') && !this.pactDone && !u.pact && u.hp > u.maxHp * 0.4) out.push({ k: 'pact' });
    if (this.has('rewind') && this.rewindsLeft > 0 && this.history.length >= 2) out.push({ k: 'rewind' });
    if (this.has('dusk') && this.duskLeft > 0) foes.filter((f) => this.duskable(f)).forEach((f) => out.push({ k: 'dusk', t: f.uid }));
    return out;
  }

  duskable(f: Unit): boolean { return f.hp / f.maxHp <= (f.boss ? 0.18 : 0.35); }

  // ---------- performing ----------
  act(a: Action): Ev[] {
    this.ev = [];
    const u = this.actor;
    if (!u || this.over) return this.ev;
    const tgt = (id?: number) => (id === undefined ? undefined : this.units[id]);
    const count = (k: string) => (this.stats.actions[k] = (this.stats.actions[k] ?? 0) + 1);
    let free = false;

    switch (a.k) {
      case 'attack': {
        count('attack');
        const t = this.retarget(u, tgt(a.t));
        if (t) this.ev.push({ t: 'act', u: u.uid, name: 'Attack' });
        if (t) this.resolveFx(u, [{ k: 'dmg', s: 'atk', p: 1.0 }], [t], undefined);
        break;
      }
      case 'skill': case 'limit': {
        const s = skill(a.k === 'limit' ? u.limit! : a.id);
        count(s.id);
        if (a.k === 'limit') { u.nerve = 0; this.stats.limits++; }
        else { const c = this.mpCost(u, s); u.mp -= c; this.stats.mpSpent += c; }
        this.ev.push({ t: 'act', u: u.uid, name: s.name });
        this.castSkill(u, s, tgt(a.t));
        if (s.spd) this.costMul *= s.spd;
        break;
      }
      case 'item': {
        count('item');
        this.stats.itemsUsed++;
        this.inv[a.id]--;
        const it = ITEMS[a.id] as Item;
        this.ev.push({ t: 'act', u: u.uid, name: it.name });
        const targets = it.tgt === 'foes' ? this.livingFoes() : it.tgt === 'allies' ? this.livingParty() : [tgt(a.t)!];
        this.resolveFx(u, it.fx, targets.filter(Boolean), undefined, true);
        this.costMul = 0.7;
        break;
      }
      case 'guard':
        count('guard');
        u.guard = true;
        if (this.has('nerve')) u.nerve = Math.min(100, u.nerve + 12);
        this.ev.push({ t: 'act', u: u.uid, name: 'Guard' });
        this.costMul = 0.6;
        break;
      case 'flee': {
        count('flee');
        this.ev.push({ t: 'act', u: u.uid, name: 'Flee' });
        const foeSpd = Math.max(...this.livingFoes().map((f) => this.stat(f, 'spd')));
        if (this.rng.chance(Math.min(0.9, 0.35 + 0.5 * (this.stat(u, 'spd') / foeSpd - 0.6)))) { this.over = 'flee'; this.msg('Got away!'); }
        else this.msg('Could not escape!');
        break;
      }
      case 'ascend':
        count('ascend');
        u.nerve = 0; u.asc = 4; this.stats.ascends++;
        this.ev.push({ t: 'act', u: u.uid, name: 'ASCEND' });
        this.msg(`${u.name} ascends!`);
        this.ev.push({ t: 'shift' });
        free = true;
        break;
      case 'stance':
        count('stance');
        u.stance = a.st; this.stanceDone = true; free = true;
        this.msg(`${u.name}: ${a.st} stance.`);
        break;
      case 'pact':
        count('pact');
        u.pact = true; this.pactDone = true; free = true;
        this.msg(`${u.name} signs a pact.`);
        break;
      case 'rewind': {
        count('rewind');
        this.rewindsLeft--;
        this.stats.rewinds++;
        const prev = this.history[this.history.length - 2];
        this.history = this.history.slice(0, -2);
        this.restore(prev);
        this.history.push(this.snapshot());
        this.stanceDone = false; this.pactDone = false;
        this.msg('Time folds back.');
        this.ev.push({ t: 'shift' });
        return this.ev;
      }
      case 'dusk': {
        count('dusk');
        this.duskLeft--;
        this.stats.dusks++;
        const t = tgt(a.t)!;
        this.ev.push({ t: 'act', u: u.uid, name: 'DUSK' });
        this.msg(`${t.name} is let go.`);
        t.hp = 0;
        this.ev.push({ t: 'ko', u: t.uid });
        for (const p of this.livingParty()) { this.healUnit(p, Math.round(p.maxHp * 0.08), u); p.nerve = Math.min(100, p.nerve + 25); }
        break;
      }
    }

    if (free) { this.checkEndAfter(); return this.ev; }
    if (u.pact && a.k !== 'guard') u.pact = false;
    this.endTurn(u);
    this.advance();
    return this.ev;
  }

  private checkEndAfter() { if (this.livingFoes().length === 0) this.over = 'win'; }

  private castSkill(u: Unit, s: Skill, target?: Unit) {
    let targets: Unit[] = [];
    switch (s.tgt) {
      case 'foe': { const t = this.retarget(u, target); if (t) targets = [t]; break; }
      case 'foes': targets = this.opp(u); break;
      case 'ally': targets = target && target.hp > 0 ? [target] : [u]; break;
      case 'allies': targets = this.ally(u); break;
      case 'self': targets = [u]; break;
      case 'fallen': targets = target && target.hp <= 0 ? [target] : []; break;
    }
    this.resolveFx(u, s.fx, targets, s);
  }

  private retarget(u: Unit, t?: Unit): Unit | undefined {
    if (t && t.hp > 0) return t;
    const o = this.opp(u);
    return o.length ? o[0] : undefined;
  }

  private resolveFx(u: Unit, fx: Fx[], targets: Unit[], s?: Skill, isItem = false) {
    const selfCost = fx.find((f) => f.k === 'selfHp') as Extract<Fx, { k: 'selfHp' }> | undefined;
    if (selfCost) this.hurt(u, Math.max(1, Math.round(u.maxHp * selfCost.p)), undefined, undefined, true, true);
    for (const t of targets) {
      let dealt = 0;
      for (const f of fx) {
        switch (f.k) {
          case 'dmg': {
            const hits = f.hits ?? 1;
            for (let i = 0; i < hits; i++) { if (t.hp <= 0) break; dealt += this.strike(u, t, f, s); }
            break;
          }
          case 'dmgFlat': { const n = Math.round(f.n); dealt += this.hurt(t, n, f.e, u); break; }
          case 'heal': this.healUnit(t, Math.max(1, Math.round(f.p * 2 * this.stat(u, 'mag'))), u); break;
          case 'healFlat': this.healUnit(t, f.n, u); break;
          case 'healPct':
            if (f.to === 'allies') { if (t === targets[0]) for (const a of this.ally(u)) this.healUnit(a, Math.round(a.maxHp * f.p), u); } else this.healUnit(t, Math.round(t.maxHp * f.p), u);
            break;
          case 'mpFlat': t.mp = Math.min(t.maxMp, t.mp + f.n); this.ev.push({ t: 'mp', u: t.uid, n: f.n }); break;
          case 'status':
            if (f.to === 'allies') { if (t === targets[0]) for (const a of this.ally(u)) this.addStatus(a, f.st, f.turns, f.chance ?? 1, u); }
            else if (f.to === 'self') { if (t === targets[0]) this.addStatus(u, f.st, f.turns, f.chance ?? 1, u); }
            else this.addStatus(t, f.st, f.turns, f.chance ?? 1, u);
            break;
          case 'cleanse':
            for (const k of ['burn', 'chill', 'shock', 'sleep', 'hex', 'weak', 'stun'] as Status[]) if (t.status[k]) { delete t.status[k]; this.ev.push({ t: 'status', u: t.uid, st: k, on: false }); }
            break;
          case 'revive':
            if (t.hp <= 0) { t.hp = Math.max(1, Math.round(t.maxHp * f.p)); t.gasp = false; t.t = Math.max(this.time, t.t); this.ev.push({ t: 'revive', u: t.uid }); }
            break;
          case 'delay': if (t.hp > 0) t.t += this.interval(t) * f.p * (t.boss ? 0.5 : 1); break;
          case 'quicken': if (t.hp > 0) t.t = Math.max(this.time + 1, t.t - this.interval(t) * f.p); break;
          case 'nerve': if (this.has('nerve') && t.side === 'party') t.nerve = Math.min(100, t.nerve + f.n); break;
          case 'drain': if (dealt > 0) this.healUnit(u, Math.round(dealt * f.p), u); break;
          case 'dispense': {
            const r = this.rng.int(6);
            if (r === 0) this.healUnit(t, Math.max(1, Math.round(1.6 * 2 * this.stat(u, 'mag'))), u);
            else if (r === 1) { const n = 12 + Math.round(this.stat(u, 'mag') * 0.4); t.mp = Math.min(t.maxMp, t.mp + n); this.ev.push({ t: 'mp', u: t.uid, n }); }
            else if (r === 2) this.addStatus(t, 'ward', 3, 1);
            else if (r === 3) this.addStatus(t, 'haste', 3, 1);
            else if (r === 4) this.addStatus(t, 'focus', 3, 1);
            else this.addStatus(t, 'regen', 4, 1);
            break;
          }
          case 'end':
            if (t.hp > 0 && this.duskable(t)) { t.hp = 0; this.ev.push({ t: 'ko', u: t.uid }); this.msg(`${t.name} ends.`); }
            break;
          case 'selfHp': break;
        }
      }
    }
    void isItem;
  }

  // ---------- damage ----------
  estimate(u: Unit, t: Unit, f: Extract<Fx, { k: 'dmg' }>): number {
    return this.calc(u, t, f, true).n * (f.hits ?? 1);
  }

  private elemMult(t: Unit, e?: Elem): number {
    if (!e) return 1;
    const a = t.aff[e];
    return a === undefined ? 1 : a;
  }

  private calc(u: Unit, t: Unit, f: Extract<Fx, { k: 'dmg' }>, expect: boolean): { n: number; weak: boolean; resist: boolean; crit: boolean; react?: string } {
    const A = this.stat(u, f.s);
    const D = this.stat(t, f.s === 'atk' ? 'def' : 'res') * (1 - (f.pierce ?? 0));
    let n = f.p * 2 * A * A / (A + D);
    const em = this.elemMult(t, f.e);
    n *= em;
    let react: string | undefined;
    if (f.e && this.has('reaction') && t.mark && t.mark.e !== f.e) {
      const key = [t.mark.e, f.e].sort().join('+');
      const r = REACTIONS[key];
      if (r) { n *= r.mult; react = r.name; }
    }
    if (f.s === 'atk' && this.has('rows')) { if (u.row === 1) n *= 0.75; if (t.row === 1) n *= 0.6; }
    if (t.guard) n *= 0.5;
    if (u.status.focus) n *= 1.5;
    if (u.pact) n *= 1.8;
    if (u.gasp) n *= 2;
    const m = u.mods;
    if (m.dmgAll) n *= 1 + m.dmgAll;
    if (f.e && m.dmgElem?.[f.e]) n *= 1 + m.dmgElem[f.e]!;
    if (f.e && this.has('field') && this.field) { if (this.field.boost === f.e) n *= 1.3; if (this.field.dampen === f.e) n *= 0.75; }
    let crit = false;
    if (!expect) {
      n *= this.rng.range(0.92, 1.08);
      if (this.rng.chance(0.06 + (m.crit ?? 0))) { n *= 1.5; crit = true; }
    } else n *= 1 + (0.06 + (m.crit ?? 0)) * 0.5;
    return { n: Math.max(1, n), weak: em > 1, resist: em < 1, crit, react };
  }

  private strike(u: Unit, t: Unit, f: Extract<Fx, { k: 'dmg' }>, s?: Skill): number {
    const r = this.calc(u, t, f, false);
    let n = Math.round(r.n);
    if (u.status.focus) { delete u.status.focus; this.ev.push({ t: 'status', u: u.uid, st: 'focus', on: false }); }
    if (r.react) {
      this.ev.push({ t: 'react', u: t.uid, name: r.react });
      this.stats.reactions++;
      const key = [t.mark!.e, f.e!].sort().join('+');
      const rx = REACTIONS[key];
      t.mark = undefined;
      if (rx.st) this.addStatus(t, rx.st, rx.turns ?? 2, 1);
      if (rx.delay) t.t += this.interval(t) * rx.delay * (t.boss ? 0.5 : 1);
    } else if (f.e && this.has('reaction') && t.side === 'foe') {
      t.mark = { e: f.e, ttl: 3 };
      this.ev.push({ t: 'mark', u: t.uid, e: f.e });
    }
    if (r.weak && this.has('weakness') && u.side === 'party') {
      this.costMul = Math.min(this.costMul, 0.6);
      this.stats.openings++;
      this.ev.push({ t: 'opening', u: u.uid });
    } else if (r.weak && this.has('weakness')) this.costMul = Math.min(this.costMul, 0.75);
    n = this.hurt(t, n, f.e, u, false, false, r.weak, r.resist, r.crit);
    if (u.mods.lifesteal && n > 0) this.healUnit(u, Math.max(1, Math.round(n * u.mods.lifesteal)), u);
    if (t.mods.thorns && f.s === 'atk' && n > 0 && u.hp > 0) this.hurt(u, Math.max(1, Math.round(n * t.mods.thorns)), undefined, undefined, true);
    void s;
    return n;
  }

  /** Applies damage, handles KO. Returns damage dealt. */
  hurt(t: Unit, n: number, e?: Elem, src?: Unit, silent = false, selfCost = false, weak = false, resist = false, crit = false): number {
    if (t.hp <= 0) return 0;
    n = Math.max(1, Math.round(n));
    if (selfCost) n = Math.min(n, t.hp - 1);
    if (selfCost && n <= 0) return 0;
    const dealt = Math.min(n, t.hp);
    t.hp -= dealt;
    if (t.status.sleep) { delete t.status.sleep; this.ev.push({ t: 'status', u: t.uid, st: 'sleep', on: false }); }
    this.ev.push({ t: 'dmg', u: t.uid, n: dealt, weak, resist, crit, e });
    if (src && src !== t) this.stats.dmgBy[src.uid] = (this.stats.dmgBy[src.uid] ?? 0) + dealt;
    if (t.side === 'party') {
      const frac = this.party.reduce((a, x) => a + x.hp, 0) / Math.max(1, this.party.reduce((a, x) => a + x.maxHp, 0));
      this.stats.minHpFrac = Math.min(this.stats.minHpFrac, frac);
      if (frac < 0.3) this.stats.crossedLow = true;
      if (this.has('nerve') && !selfCost) t.nerve = Math.min(100, t.nerve + Math.min(40, (dealt / t.maxHp) * 100 * 0.9) * (1 + (t.mods.nerveGain ?? 0)));
    } else if (src && this.has('nerve') && src.side === 'party') {
      src.nerve = Math.min(100, src.nerve + 3 + (weak ? 5 : 0));
    }
    if (t.hp <= 0) this.ko(t);
    void silent;
    return dealt;
  }

  private ko(t: Unit) {
    t.status = {};
    t.queued = undefined;
    if (t.side === 'party' && this.has('gasp') && !t.gaspUsed && !t.gasp && this.livingFoes().length > 0) {
      t.gasp = true;
      t.t = this.time;
      this.stats.gasps++;
      this.msg(`${t.name} is falling...`);
      return;
    }
    this.stats.koCount += t.side === 'party' ? 1 : 0;
    this.ev.push({ t: 'ko', u: t.uid });
  }

  healUnit(t: Unit, n: number, src: Unit | null) {
    if (t.hp <= 0) return;
    n = Math.min(n, t.maxHp - t.hp);
    if (n <= 0) return;
    t.hp += n;
    this.ev.push({ t: 'heal', u: t.uid, n });
    if (src) this.stats.healBy[src.uid] = (this.stats.healBy[src.uid] ?? 0) + n;
  }

  addStatus(t: Unit, st: Status, turns: number, chance: number, src?: Unit) {
    if (t.hp <= 0) return;
    const isBuff = BUFFS.includes(st);
    if (!isBuff) {
      if (t.immune.includes(st)) return;
      if (t.boss && (st === 'stun' || st === 'sleep')) chance *= 0.35;
      if (src && src.side !== t.side && chance < 1) { const res = this.stat(t, 'res'); chance *= 1 - 0.6 * (res / (res + this.stat(src, 'mag'))); }
      if (t.side === 'foe' && st === 'stun' && t.status.stun) return;
    }
    if (chance < 1 && !this.rng.chance(chance)) return;
    const cur = t.status[st] ?? 0;
    t.status[st] = Math.max(cur, st === 'stun' ? 1 : turns + (t === this.cur ? 1 : 0));
    this.ev.push({ t: 'status', u: t.uid, st, on: true });
  }

  // ---------- enemy AI ----------
  private foeAct(u: Unit) {
    let s: Skill;
    let name: string | undefined;
    if (u.queued) {
      s = skill(u.queued.skill); name = u.queued.name; u.queued = undefined;
    } else {
      const e = this.chooseScript(u);
      s = skill(e.s); name = e.n;
      if ((e.windup || s.windup) && this.livingParty().length) {
        u.queued = { skill: e.s, name: e.n };
        this.ev.push({ t: 'act', u: u.uid, name: name ?? s.name });
        this.msg(`${u.name} ${e.windup ?? s.windup}`);
        return;
      }
    }
    this.ev.push({ t: 'act', u: u.uid, name: name ?? s.name });
    const targets = this.aiTargets(u, s);
    if (!targets.length && s.tgt !== 'self' && s.tgt !== 'allies') return;
    this.resolveFx(u, s.fx, targets, s);
  }

  private chooseScript(u: Unit): ScriptEntry {
    const frac = u.hp / u.maxHp;
    const party = this.party;
    const partyHurt = party.some((p) => p.hp > 0 && p.hp / p.maxHp < 0.4);
    const allyDown = this.foes.some((f) => f !== u && f.hp <= 0);
    const c = (u.script ?? []).filter((e) => {
      if (e.hp && (frac < e.hp[0] || frac > e.hp[1])) return false;
      if (e.first && u.turns !== 0) return false;
      if (e.every && u.turns % e.every !== e.every - 1) return false;
      if (e.when === 'partyHurt' && !partyHurt) return false;
      if (e.when === 'selfHurt' && frac > 0.5) return false;
      if (e.when === 'allyDown' && !allyDown) return false;
      const sk = skill(e.s);
      if (sk.tgt === 'ally' || sk.tgt === 'allies') {
        if (sk.fx.some((f) => f.k === 'heal') && this.ally(u).every((a) => a.hp / a.maxHp > 0.75)) return false;
      }
      return true;
    });
    const special = c.filter((e) => e.first || e.every || e.hp || e.when);
    const pool = special.length && this.rng.chance(0.6) ? special : c;
    if (!pool.length) return { s: 'e_hit' };
    return this.rng.weighted(pool, (e) => e.w ?? 1);
  }

  private aiTargets(u: Unit, s: Skill): Unit[] {
    const enemies = this.opp(u);
    switch (s.tgt) {
      case 'foes': return enemies;
      case 'allies': return this.ally(u);
      case 'self': return [u];
      case 'ally': {
        const a = this.ally(u);
        return [a.reduce((m, x) => (x.hp / x.maxHp < m.hp / m.maxHp ? x : m), a[0])];
      }
      case 'fallen': return [];
      case 'foe': {
        if (!enemies.length) return [];
        const phys = s.fx.some((f) => f.k === 'dmg' && f.s === 'atk');
        const elem = s.fx.find((f) => f.k === 'dmg') as Extract<Fx, { k: 'dmg' }> | undefined;
        const taunt = enemies.filter((e) => e.status.taunt);
        const pool = taunt.length ? taunt : enemies;
        return [this.rng.weighted(pool, (e) => {
          let w = 1;
          if (phys && this.has('rows')) w *= e.row === 0 ? 2.2 : 1;
          if (elem?.e && (e.aff[elem.e] ?? 1) > 1) w *= 1.6;
          if (e.hp / e.maxHp < 0.35) w *= 1.25;
          return w;
        })];
      }
    }
  }
}

export function makeUnitBase(): Pick<Unit, 'status' | 'guard' | 'turns' | 'gasp' | 'gaspUsed' | 'asc' | 'pact' | 'nerve' | 'uid' | 't' | 'immune' | 'mods' | 'skills'> {
  return { status: {}, guard: false, turns: 0, gasp: false, gaspUsed: false, asc: 0, pact: false, nerve: 0, uid: 0, t: 0, immune: [], mods: {}, skills: [] };
}

export type { Stats };
