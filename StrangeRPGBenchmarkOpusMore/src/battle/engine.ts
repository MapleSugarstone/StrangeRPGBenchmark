import { Rng } from '../core/rng';
import { SKILLS } from '../data/skills';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { DUOS, duoFor } from '../data/duos';
import { BOSS_AI } from './bossai';
import {
  Action, BEvent, Elem, EnemyDef, SkillDef, StatusId, STATUS, Unit, Verb, VERB_NAME,
} from './types';

export interface BattleOpts {
  seed: number;
  inv: Record<string, number>;
  mech: Set<string>;
  stakes?: number;
  canFlee?: boolean;
  first?: 1 | 0 | -1;
  kept?: string[];
  rewinds?: number;
  bossTag?: string;
}

export interface TraceRow { side: 0 | 1; p: number; e: number; uid: number; act: string; }

export const STAKE_MULT = [1, 1.3, 1.65];
export const STAKE_REWARD = [1, 2, 3];

// Callings at level 10 make the party much stronger, so foes past level 8 scale up faster, and bosses faster still.
export function curve(def: EnemyDef): { hp: number; atk: number } {
  const L = Math.max(0, def.lvl - 8);
  const hp = (1 + 0.004 * L) * (def.boss ? 1 + 0.022 * Math.max(0, def.lvl - 10) : 1);
  const atk = 1 + 0.008 * L;
  return { hp, atk };
}

export function makeEnemyUnit(def: EnemyDef, uid: number, stakes = 0): Unit {
  const k = curve(def);
  const m = STAKE_MULT[stakes] ?? 1;
  const s = def.stats;
  const hp = Math.round(s.hp * m * k.hp);
  return {
    uid, side: 1, id: def.id, name: def.name, lvl: def.lvl,
    hp, mhp: hp, vp: s.vp, mvp: s.vp,
    pow: Math.round(s.pow * k.atk * (1 + (m - 1) * 0.6)), wit: Math.round(s.wit * k.atk * (1 + (m - 1) * 0.6)), grd: s.grd, spd: s.spd,
    weak: def.weak ?? [], resist: def.resist ?? [], immune: def.immune ?? [],
    atkElem: def.atkElem ?? 'blunt',
    skills: def.moves.map((mv) => mv.skill),
    status: [], ct: 0, alive: true, turns: 0, phase: 0, boss: def.boss, scale: def.scale,
  };
}

export class Battle {
  units: Unit[] = [];
  rng: Rng;
  inv: Record<string, number>;
  mech: Set<string>;
  stakes: number;
  canFlee: boolean;
  outcome: null | 'win' | 'lose' | 'fled' = null;
  round = 0;
  answered: string[] = [];
  defeated: string[] = [];
  callUsed = false;
  rewinds: number;
  nextUid = 1;
  kept: string[];
  trace: TraceRow[] = [];
  ev: BEvent[] = [];
  bossTag?: string;
  extra: Record<string, number> = {};

  constructor(party: Unit[], enemies: string[], opts: BattleOpts) {
    this.rng = new Rng(opts.seed);
    this.inv = opts.inv;
    this.mech = opts.mech;
    this.stakes = opts.stakes ?? 0;
    this.canFlee = opts.canFlee ?? true;
    this.kept = opts.kept ?? [];
    this.rewinds = opts.rewinds ?? 0;
    this.bossTag = opts.bossTag;
    for (const p of party) { p.uid = this.nextUid++; p.side = 0; this.units.push(p); }
    for (const id of enemies) this.spawn(id);
    const first = opts.first ?? 0;
    for (const u of this.units) {
      const d = this.delay(u, 1);
      u.ct = Math.round(d * this.rng.range(0.25, 0.9));
      if (first === 1) u.ct = u.side === 0 ? Math.round(u.ct * 0.2) : u.ct + Math.round(d * 0.6);
      if (first === -1) u.ct = u.side === 1 ? Math.round(u.ct * 0.2) : u.ct + Math.round(d * 0.6);
    }
    if (enemies.some((id) => ENEMIES[id]?.noFlee || ENEMIES[id]?.boss)) this.canFlee = false;
  }

  spawn(id: string): Unit {
    const def = ENEMIES[id];
    if (!def) throw new Error('Unknown enemy ' + id);
    const u = makeEnemyUnit(def, this.nextUid++, this.stakes);
    u.ct = Math.round(this.delay(u, 1) * 0.6);
    this.units.push(u);
    return u;
  }

  // ---- queries ----
  get(uid: number): Unit | undefined { return this.units.find((u) => u.uid === uid); }
  party(): Unit[] { return this.units.filter((u) => u.side === 0 && !u.bench && u.alive); }
  partyAll(): Unit[] { return this.units.filter((u) => u.side === 0 && !u.bench); }
  bench(): Unit[] { return this.units.filter((u) => u.side === 0 && u.bench); }
  foes(): Unit[] { return this.units.filter((u) => u.side === 1 && u.alive); }
  foesAll(): Unit[] { return this.units.filter((u) => u.side === 1 && !u.gone); }
  sideOf(u: Unit, same: boolean): Unit[] { return (u.side === 0) === same ? this.party() : this.foes(); }
  has(u: Unit, id: StatusId): boolean { return u.status.some((s) => s.id === id); }
  st(u: Unit, id: StatusId) { return u.status.find((s) => s.id === id); }
  skill(id: string): SkillDef { return SKILLS[id] ?? DUOS[id] ?? SKILLS.attack; }

  effPow(u: Unit): number {
    let v = u.pow;
    if (this.has(u, 'powup')) v *= 1.3;
    if (this.has(u, 'weak')) v *= 0.7;
    if (this.has(u, 'offended')) v *= 1.3;
    if (u.grow) v *= 1 + u.grow * 0.12;
    return v;
  }
  effWit(u: Unit): number {
    let v = u.wit;
    if (this.has(u, 'powup')) v *= 1.3;
    if (this.has(u, 'weak')) v *= 0.7;
    if (this.has(u, 'offended')) v *= 1.3;
    return v;
  }
  effGrd(u: Unit): number {
    let v = u.grd;
    if (this.has(u, 'grdup')) v *= 1.4;
    if (u.grow) v *= 1 + u.grow * 0.1;
    return v;
  }
  effSpd(u: Unit): number {
    let v = u.spd;
    if (this.has(u, 'haste')) v *= 1.45;
    if (this.has(u, 'slow')) v *= 0.7;
    if (u.grow) v *= 1 - u.grow * 0.05;
    return v;
  }
  delay(u: Unit, w: number): number {
    return Math.max(4, Math.round((w * 1000) / (this.effSpd(u) + 12)));
  }

  // Predicts the next n turns in order, starting with whoever acts next.
  predict(n: number): number[] {
    const live = this.units.filter((u) => u.alive && !u.bench);
    const ct = new Map(live.map((u) => [u.uid, u.ct] as [number, number]));
    const lw = live.find((u) => this.has(u, 'lastword'));
    const out: number[] = [];
    if (lw) out.push(lw.uid);
    while (out.length < n && live.length) {
      let best = live[0];
      for (const u of live) {
        const a = ct.get(u.uid)!, b = ct.get(best.uid)!;
        if (a < b || (a === b && (u.side < best.side || (u.side === best.side && u.uid < best.uid)))) best = u;
      }
      out.push(best.uid);
      ct.set(best.uid, ct.get(best.uid)! + this.delay(best, 1));
    }
    return out;
  }

  // ---- turn flow ----
  beginTurn(): { actor: Unit | null; events: BEvent[]; canAct: boolean } {
    this.ev = [];
    if (this.outcome) return { actor: null, events: [], canAct: false };
    const lw = this.units.find((u) => u.alive && !u.bench && this.has(u, 'lastword'));
    if (lw) return { actor: lw, events: [{ k: 'lastword', uid: lw.uid }], canAct: true };
    const live = this.units.filter((u) => u.alive && !u.bench);
    if (!live.length) return { actor: null, events: [], canAct: false };
    let actor = live[0];
    for (const u of live) {
      if (u.ct < actor.ct || (u.ct === actor.ct && (u.side < actor.side || (u.side === actor.side && u.uid < actor.uid)))) actor = u;
    }
    const dt = actor.ct;
    for (const u of live) u.ct -= dt;
    this.round++;
    actor.turns = (actor.turns ?? 0) + 1;
    actor.pushed = false;
    actor.tookLast = actor.tookThis ?? 0;
    actor.tookThis = 0;
    let canAct = true;
    // Status upkeep happens at the start of the owner's turn.
    const keep: Unit['status'] = [];
    for (const s of actor.status) {
      if (s.id === 'static') {
        const n = Math.max(1, Math.round(actor.mhp * 0.06));
        this.damage(actor, n, {});
        this.ev.push({ k: 'msg', text: `${actor.name} crackles with static.` });
      }
      if (s.id === 'regen') {
        const n = Math.max(1, Math.round(actor.mhp * 0.08));
        this.healUnit(actor, n);
      }
      if (s.id === 'sleep') { canAct = false; this.ev.push({ k: 'msg', text: `${actor.name} is asleep.` }); }
      if (s.id === 'tomorrow' && s.turns <= 1) {
        this.ev.push({ k: 'msg', text: `Tomorrow comes due for ${actor.name}.` });
        this.damage(actor, s.pow ?? 10, {});
      }
      if (s.id === 'return' && s.turns <= 1) {
        actor.hp = 0;
        actor.alive = false;
        actor.gone = 'returned';
        this.ev.push({ k: 'msg', text: `${actor.name} is Returned to Sender.` });
        this.ev.push({ k: 'ko', uid: actor.uid });
        canAct = false;
        continue;
      }
      if (s.id === 'guard' || s.id === 'cover' || s.id === 'taunt') continue;
      s.turns--;
      if (s.turns > 0) keep.push(s);
      else if (s.id !== 'tomorrow' && s.id !== 'return') this.ev.push({ k: 'status', uid: actor.uid, id: s.id, on: false });
    }
    actor.status = keep;
    if (actor.id === 'bigger' && actor.alive && (actor.grow ?? 0) < 4) {
      actor.grow = (actor.grow ?? 0) + 1;
      this.ev.push({ k: 'grow', uid: actor.uid });
    }
    if (actor.side === 1 && actor.offended) actor.offended--;
    if (!actor.alive) canAct = false;
    this.checkEnd();
    if (this.outcome) canAct = false;
    if (!canAct && actor.alive) actor.ct = this.delay(actor, 1);
    return { actor, events: this.ev, canAct };
  }

  // ---- legal actions (used by the UI and the bots) ----
  canUse(u: Unit, sk: SkillDef): boolean {
    if ((sk.cost ?? 0) > u.vp) return false;
    if (sk.voice && (this.has(u, 'mute') || (this.mech.has('hush') && u.side === 0))) return false;
    if (sk.tgt === 'dead' && !this.partyAll().some((p) => !p.alive && !p.gone)) return false;
    return true;
  }

  linePartner(u: Unit): Unit | null {
    if (!this.mech.has('line') || u.side !== 0 || this.has(u, 'lastword')) return null;
    const order = this.predict(3);
    const nextUid = order[0] === u.uid ? order[1] : order[0];
    const p = this.get(nextUid);
    if (!p || p.side !== 0 || p.uid === u.uid || !p.alive || this.has(p, 'sleep')) return null;
    return p;
  }

  // ---- performing actions ----
  perform(actor: Unit, a: Action, timing: { clean?: boolean; braced?: Set<number> } = {}): BEvent[] {
    this.ev = [];
    if (this.outcome) return this.ev;
    const pBefore = this.hpFrac(0), eBefore = this.hpFrac(1);
    let w = 1;
    switch (a.t) {
      case 'attack': {
        const t = this.retarget(actor, this.get(a.target), 'foe');
        this.ev.push({ k: 'act', uid: actor.uid, name: 'Attack' });
        if (t) this.strike(actor, t, { power: 1, kind: 'phys', elem: actor.atkElem, name: 'Attack' }, timing);
        break;
      }
      case 'skill': {
        const sk = this.skill(a.skill);
        w = sk.speed ?? 1;
        this.useSkill(actor, sk, a.target, timing);
        break;
      }
      case 'item': {
        w = 0.8;
        this.useItem(actor, a.item, a.target);
        break;
      }
      case 'guard': {
        this.addStatus(actor, 'guard', 1);
        const back = Math.max(1, Math.round(actor.mvp * 0.1));
        actor.vp = Math.min(actor.mvp, actor.vp + back);
        this.ev.push({ k: 'act', uid: actor.uid, name: 'Guard' });
        this.ev.push({ k: 'heal', uid: actor.uid, n: back, vp: true });
        w = 0.8;
        break;
      }
      case 'answer': {
        w = 0.8;
        this.answer(actor, this.get(a.target), a.verb);
        break;
      }
      case 'line': {
        const p = this.get(a.partner);
        if (p) {
          const tech = DUOS[a.tech] ?? duoFor(actor.id, p.id);
          this.useLine(actor, p, tech, a.target, timing);
          p.ct = this.delay(p, 1);
        }
        break;
      }
      case 'flee': {
        const ps = this.party(), fs = this.foes();
        const avg = (us: Unit[]) => us.reduce((s, u) => s + this.effSpd(u), 0) / Math.max(1, us.length);
        const chance = Math.max(0.25, Math.min(0.95, 0.55 + (avg(ps) - avg(fs)) * 0.03));
        this.ev.push({ k: 'act', uid: actor.uid, name: 'Run' });
        if (this.canFlee && this.rng.chance(chance)) {
          this.outcome = 'fled';
          this.ev.push({ k: 'msg', text: 'The party gets away.' });
        } else {
          this.ev.push({ k: 'msg', text: this.canFlee ? 'Could not get away!' : 'There is nowhere to run.' });
        }
        break;
      }
      case 'call': {
        this.callKept(actor, a.kept, a.target, timing);
        break;
      }
      case 'twin': {
        const ta = this.targetOf(a.a), tb = this.targetOf(a.b);
        const harmony = ta !== null && ta === tb && this.get(ta)?.side === 1;
        if (harmony) this.ev.push({ k: 'msg', text: 'First and Firster strike as one!' });
        this.extra.harmony = harmony ? 1 : 0;
        this.performInner(actor, a.a, timing, 'First');
        this.checkEnd();
        if (!this.outcome && actor.alive) this.performInner(actor, a.b, timing, 'Firster');
        this.extra.harmony = 0;
        w = 1.15;
        break;
      }
      case 'mask': {
        const k = ENEMIES[a.kept]?.kept;
        this.ev.push({ k: 'act', uid: actor.uid, name: 'Change face' });
        this.ev.push({ k: 'msg', text: `${actor.name} wears the face of ${ENEMIES[a.kept]?.name ?? 'someone'}.` });
        const prev = actor.mask ? ENEMIES[actor.mask]?.kept?.skill : undefined;
        actor.mask = a.kept;
        actor.skills = actor.skills.filter((s) => s !== prev);
        if (k?.skill && !actor.skills.includes(k.skill)) actor.skills = [...actor.skills, k.skill];
        w = 0.5;
        break;
      }
      case 'swap': {
        const out = this.get(a.out), inn = this.get(a.inn);
        const sk = SKILLS.evacuate;
        if (out && inn && inn.bench) {
          actor.vp -= sk.cost ?? 0;
          out.bench = true;
          inn.bench = false;
          this.removeStatus(out, 'lastword');
          inn.ct = Math.round(this.delay(inn, 1) * 0.3);
          this.ev.push({ k: 'act', uid: actor.uid, name: 'Evacuate' });
          this.ev.push({ k: 'swap', out: out.uid, inn: inn.uid });
          this.ev.push({ k: 'msg', text: `${out.name} is pulled to safety. ${inn.name} steps in.` });
        }
        w = 0.7;
        break;
      }
      case 'pass': {
        w = 1;
        break;
      }
    }
    if (actor.side === 0 && this.has(actor, 'lastword')) {
      this.removeStatus(actor, 'lastword');
      if (actor.hp <= 0) {
        actor.alive = false;
        this.ev.push({ k: 'ko', uid: actor.uid });
        this.ev.push({ k: 'msg', text: `${actor.name} falls.` });
      }
    }
    if (actor.alive) actor.ct = this.delay(actor, w);
    this.trace.push({ side: actor.side, p: this.hpFrac(0), e: this.hpFrac(1), uid: actor.uid, act: a.t === 'skill' ? a.skill : a.t });
    void pBefore; void eBefore;
    this.checkEnd();
    return this.ev;
  }

  private performInner(actor: Unit, a: Action, timing: { clean?: boolean; braced?: Set<number> }, head: string) {
    if (a.t === 'attack') {
      const t = this.retarget(actor, this.get(a.target), 'foe');
      this.ev.push({ k: 'act', uid: actor.uid, name: head });
      if (t) this.strike(actor, t, { power: 0.75, kind: 'phys', elem: actor.atkElem, name: head }, timing);
    } else if (a.t === 'skill') {
      this.useSkill(actor, this.skill(a.skill), a.target, timing);
    } else if (a.t === 'guard') {
      this.addStatus(actor, 'guard', 1);
      this.ev.push({ k: 'act', uid: actor.uid, name: head + ' guards' });
    } else if (a.t === 'item') {
      this.useItem(actor, a.item, a.target);
    } else if (a.t === 'answer') {
      this.answer(actor, this.get(a.target), a.verb);
    }
  }

  private targetOf(a: Action): number | null {
    if (a.t === 'attack' || a.t === 'skill') return a.target;
    return null;
  }

  // Redirects a single target if it died, or randomly when the actor is tangled.
  retarget(actor: Unit, t: Unit | undefined, kind: 'foe' | 'ally'): Unit | null {
    if (this.has(actor, 'tangled') && this.rng.chance(0.5)) {
      const pool = [...this.party(), ...this.foes()].filter((u) => u.uid !== actor.uid);
      if (pool.length) {
        const r = this.rng.pick(pool);
        this.ev.push({ k: 'msg', text: `${actor.name} is tangled up!` });
        return r;
      }
    }
    if (t && t.alive && !t.bench) return t;
    const pool = kind === 'foe' ? this.sideOf(actor, false) : this.sideOf(actor, true);
    return pool.length ? pool[0] : null;
  }

  private targets(actor: Unit, sk: SkillDef, target: number): Unit[] {
    switch (sk.tgt) {
      case 'foe': { const t = this.retarget(actor, this.get(target), 'foe'); return t ? [t] : []; }
      case 'foes': return this.sideOf(actor, false);
      case 'ally': { const t = this.get(target); return t && t.alive ? [t] : this.sideOf(actor, true).slice(0, 1); }
      case 'other': { const t = this.get(target); return t && t.alive && t.uid !== actor.uid ? [t] : []; }
      case 'allies': return this.sideOf(actor, true);
      case 'self': return [actor];
      case 'dead': { const t = this.get(target); return t && !t.alive && !t.gone ? [t] : []; }
      case 'any': { const t = this.get(target); return t && t.alive ? [t] : []; }
    }
  }

  useSkill(actor: Unit, sk: SkillDef, target: number, timing: { clean?: boolean; braced?: Set<number> }, scale = 1) {
    actor.vp = Math.max(0, actor.vp - (sk.cost ?? 0));
    this.ev.push({ k: 'act', uid: actor.uid, name: sk.name });
    if (sk.fx && this.special(actor, sk, target, timing)) return;
    const ts = this.targets(actor, sk, target);
    if (!ts.length) { this.ev.push({ k: 'msg', text: 'But there is no one there.' }); return; }
    for (const t of ts) {
      if (sk.revive) {
        if (!t.alive && !t.gone) {
          t.alive = true;
          t.hp = Math.max(1, Math.round(t.mhp * sk.revive));
          t.ct = this.delay(t, 1);
          this.ev.push({ k: 'revive', uid: t.uid });
        }
        continue;
      }
      if (sk.power) {
        const hits = sk.hits ?? 1;
        for (let i = 0; i < hits && t.alive; i++) {
          this.strike(actor, t, { power: (sk.power * scale) / (sk.tgt === 'foes' ? 1.25 : 1), kind: sk.kind ?? 'phys', elem: sk.elem ?? (sk.kind === 'wit' ? undefined : actor.atkElem), name: sk.name, drain: sk.drain, crit: sk.crit, acc: sk.acc }, timing);
        }
      }
      if (sk.heal) {
        const n = Math.round(sk.heal * scale * (8 + this.effWit(actor) * 1.1) * this.rng.range(0.95, 1.05));
        this.healUnit(t, n);
      }
      if (sk.healVp) {
        const n = Math.round(sk.healVp);
        t.vp = Math.min(t.mvp, t.vp + n);
        this.ev.push({ k: 'heal', uid: t.uid, n, vp: true });
      }
      if (sk.status && t.alive) {
        const chance = sk.status.chance ?? 1;
        if (t.boss && !STATUS[sk.status.id].good && (sk.status.id === 'sleep' || sk.status.id === 'tangled')) {
          this.ev.push({ k: 'msg', text: `${t.name} shrugs it off.` });
        } else if (this.rng.chance(chance)) {
          this.addStatus(t, sk.status.id, sk.status.turns, sk.status.pow);
        } else if (!STATUS[sk.status.id].good) {
          this.ev.push({ k: 'miss', uid: t.uid });
        }
      }
      if (sk.push && t.alive) this.pushBack(t, sk.push);
    }
  }

  // Handles skills whose effect is not plain damage, healing, or a status. Returns true when fully handled.
  special(actor: Unit, sk: SkillDef, target: number, timing: { clean?: boolean; braced?: Set<number> }): boolean {
    const t = this.get(target);
    switch (sk.fx) {
      case 'listen': {
        const ts = sk.tgt === 'foes' ? this.foes() : t ? [t] : [];
        for (const x of ts) {
          x.listened = true;
          this.ev.push({ k: 'listen', uid: x.uid });
        }
        return true;
      }
      case 'grow': {
        actor.grow = Math.min(5, (actor.grow ?? 0) + 2);
        this.ev.push({ k: 'grow', uid: actor.uid });
        this.ev.push({ k: 'msg', text: `${actor.name} gets bigger.` });
        return true;
      }
      case 'hold': {
        if (t && t.alive) {
          this.pushBack(t, 0.7, true);
          this.ev.push({ k: 'msg', text: `${t.name} is put on hold.` });
        }
        return true;
      }
      case 'transfer': {
        if (t && t.alive && t.uid !== actor.uid) {
          t.ct = 0;
          this.ev.push({ k: 'msg', text: `${t.name} is patched through. They act next.` });
        }
        return true;
      }
      case 'encore': {
        if (t && t.alive && t.uid !== actor.uid) {
          t.ct = -1;
          this.ev.push({ k: 'msg', text: `Again! ${t.name} goes again.` });
        }
        return true;
      }
      case 'cover': {
        this.addStatus(actor, 'cover', 1);
        this.addStatus(actor, 'guard', 1);
        this.ev.push({ k: 'msg', text: `${actor.name} lies down over everyone.` });
        return true;
      }
      case 'taunt': {
        this.addStatus(actor, 'taunt', 1);
        this.ev.push({ k: 'msg', text: `${actor.name} draws every eye.` });
        return false;
      }
      case 'fetch': {
        if (t && t.alive) {
          this.strike(actor, t, { power: sk.power ?? 0.8, kind: 'phys', elem: actor.atkElem, name: sk.name }, timing);
          const def = ENEMIES[t.id];
          const key = 'fetched' + t.uid;
          if (def?.drop && !this.extra[key]) {
            this.extra[key] = 1;
            this.inv[def.drop.item] = (this.inv[def.drop.item] ?? 0) + 1;
            this.ev.push({ k: 'msg', text: `${actor.name} fetches ${ITEMS[def.drop.item]?.name ?? 'something'}!` });
          }
        }
        return true;
      }
      case 'cleanse': {
        for (const x of this.sideOf(actor, true)) {
          const bad = x.status.filter((s) => !STATUS[s.id].good && s.id !== 'tomorrow');
          for (const b of bad) this.removeStatus(x, b.id);
        }
        this.ev.push({ k: 'msg', text: 'Everyone shakes off what was clinging to them.' });
        return false;
      }
      case 'stay': {
        for (const x of this.sideOf(actor, true)) this.removeStatus(x, 'return');
        this.ev.push({ k: 'msg', text: 'Nobody is going anywhere.' });
        return false;
      }
      case 'yesterday': {
        if (t && t.alive) {
          const base = Math.max(actor.tookLast ?? 0, actor.tookThis ?? 0);
          const n = Math.max(4, Math.round(base * 1.5 + this.effWit(actor)));
          this.ev.push({ k: 'msg', text: `Yesterday's hurt comes back around.` });
          this.damage(t, n, {});
        }
        return true;
      }
      case 'tomorrow': {
        if (t && t.alive) {
          const n = Math.round((sk.power ?? 2.5) * this.effWit(actor) * this.rng.range(0.9, 1.1));
          this.addStatus(t, 'tomorrow', 2, n);
          this.ev.push({ k: 'msg', text: `${t.name} will have a very bad tomorrow.` });
        }
        return true;
      }
      case 'multiply': {
        if (this.foes().length < 4) {
          const u = this.spawn(actor.id);
          this.ev.push({ k: 'spawn', uid: u.uid });
          this.ev.push({ k: 'msg', text: `${actor.name} forwards itself. There are more of them now.` });
        } else this.ev.push({ k: 'msg', text: `${actor.name} tries to forward itself. Nobody is listening.` });
        return true;
      }
      case 'summon': {
        const id = sk.id.replace(/^e_summon_/, '');
        for (let i = 0; i < (sk.hits ?? 1); i++) {
          if (this.foes().length < 4 && ENEMIES[id]) {
            const u = this.spawn(id);
            this.ev.push({ k: 'spawn', uid: u.uid });
            this.ev.push({ k: 'msg', text: `${u.name} shows up.` });
          }
        }
        return true;
      }
      case 'returnto': {
        if (t && t.alive && !this.has(t, 'return')) {
          this.addStatus(t, 'return', 3);
          this.ev.push({ k: 'msg', text: `${t.name} is addressed for Return. Three turns.` });
        } else if (t) this.ev.push({ k: 'msg', text: `${t.name} is already addressed.` });
        return true;
      }
      case 'drainvp': {
        if (t && t.alive) {
          const n = Math.min(t.vp, 3 + Math.round(this.effWit(actor) * 0.15));
          t.vp -= n;
          actor.vp = Math.min(actor.mvp, actor.vp + n);
          this.ev.push({ k: 'msg', text: `${actor.name} takes ${n} voice from ${t.name}.` });
        }
        return true;
      }
      case 'gamble': {
        const roll = this.rng.int(6) + 1;
        this.ev.push({ k: 'msg', text: `The dice say ${roll}.` });
        const ts = this.sideOf(actor, false);
        for (const x of ts) this.strike(actor, x, { power: 0.35 * roll, kind: 'phys', elem: 'blunt', name: sk.name }, timing);
        if (roll === 1) this.damage(actor, Math.round(actor.mhp * 0.15), {});
        return true;
      }
      case 'impersonate': {
        if (t && t.alive) {
          this.addStatus(t, 'tangled', 2);
          this.ev.push({ k: 'msg', text: `${t.name} cannot tell friend from foe.` });
        }
        return true;
      }
      case 'double': {
        const last = [...this.trace].reverse().find((r) => r.side === 0 && r.uid !== actor.uid && SKILLS[r.act] && !SKILLS[r.act].fx);
        if (last) {
          const sk2 = SKILLS[last.act];
          this.ev.push({ k: 'msg', text: `${actor.name} does it too: ${sk2.name}.` });
          const tgt = sk2.tgt === 'foe' ? (this.foes()[0]?.uid ?? 0) : sk2.tgt === 'ally' ? actor.uid : target;
          this.useSkill(actor, { ...sk2, cost: 0 }, tgt, timing);
        } else this.ev.push({ k: 'msg', text: 'There is nothing to copy yet.' });
        return true;
      }
      case 'holdall': {
        for (const p of this.sideOf(actor, false)) this.pushBack(p, 0.6, true);
        this.ev.push({ k: 'msg', text: 'Thank you for your patience. Everyone is put on hold.' });
        return true;
      }
      case 'returnhello': {
        const h = this.units.find((x) => x.side === 0 && x.id === 'hello' && x.alive);
        if (h) {
          h.hp = 0;
          h.alive = false;
          h.gone = 'returned';
          this.ev.push({ k: 'ko', uid: h.uid });
          this.ev.push({ k: 'msg', text: 'Amen reaches past everyone else, very gently, and Returns Hello to Sender.' });
          this.extra.scripted = 1;
          this.outcome = 'win';
        }
        return true;
      }
      case 'say': {
        this.ev.push({ k: 'msg', text: sk.desc });
        return false;
      }
      case 'shield': {
        const x = sk.tgt === 'self' ? actor : t && t.alive ? t : actor;
        const pow = Math.round(actor.side === 0 ? this.effWit(actor) * 2.5 + 12 : this.effWit(actor) * 0.8 + 10);
        this.removeStatus(x, 'shield');
        this.addStatus(x, 'shield', 4, pow);
        this.ev.push({ k: 'msg', text: `${x.name} is shielded for ${pow}.` });
        return true;
      }
      case 'cleanse_foe': {
        if (t && t.alive) {
          const good = t.status.filter((s) => STATUS[s.id].good);
          for (const g of good) this.removeStatus(t, g.id);
          if (t.grow) { t.grow = 0; this.ev.push({ k: 'grow', uid: t.uid }); }
          this.ev.push({ k: 'msg', text: good.length ? `${t.name} is tidied. Every advantage is swept away.` : `${t.name} is already tidy.` });
        }
        return true;
      }
      case 'wait': {
        if (sk.id === 'e_windup' && actor.windup) this.ev.push({ k: 'windup', uid: actor.uid, text: actor.windup.text });
        else this.ev.push({ k: 'msg', text: sk.desc });
        return true;
      }
    }
    return false;
  }

  strike(src: Unit, dst: Unit, o: { power: number; kind: 'phys' | 'wit'; elem?: Elem; name: string; drain?: number; crit?: number; acc?: number }, timing: { clean?: boolean; braced?: Set<number> }) {
    const bracedOrig = !!timing.braced?.has(dst.uid);
    // Covering: single-target hits on the cover unit's allies land on it instead.
    if (src.side !== dst.side) {
      const cover = this.sideOf(dst, true).find((u) => u.uid !== dst.uid && this.has(u, 'cover'));
      if (cover && cover.alive) dst = cover;
    }
    if (this.has(dst, 'dejavu') && src.side !== dst.side) {
      this.removeStatus(dst, 'dejavu');
      this.ev.push({ k: 'miss', uid: dst.uid });
      this.ev.push({ k: 'msg', text: `${dst.name} saw that coming.` });
      return;
    }
    if (o.acc !== undefined && !this.rng.chance(o.acc)) {
      this.ev.push({ k: 'miss', uid: dst.uid });
      return;
    }
    const A = o.kind === 'wit' ? this.effWit(src) : this.effPow(src);
    const D = o.kind === 'wit' ? (this.effGrd(dst) + this.effWit(dst)) / 2 : this.effGrd(dst);
    let n = (o.power * A * A) / (A + D + 1);
    let weak = false, resist = false, crit = false;
    if (o.elem) {
      if (dst.immune.includes(o.elem)) {
        this.ev.push({ k: 'msg', text: `${dst.name} does not feel ${o.elem}.` });
        this.ev.push({ k: 'dmg', uid: dst.uid, n: 0, resist: true });
        return;
      }
      if (dst.weak.includes(o.elem)) { n *= 1.5; weak = true; }
      if (dst.resist.includes(o.elem)) { n *= 0.5; resist = true; }
    }
    if (o.kind === 'phys' && this.rng.chance(o.crit ?? 0.06)) { n *= 1.5; crit = true; }
    n *= this.rng.range(0.9, 1.1);
    if (this.has(src, 'focus')) { n *= 1.5; this.removeStatus(src, 'focus'); }
    if (src.twin && this.extra.harmony) n *= 1.3;
    if (this.has(dst, 'guard')) n *= 0.6;
    if (this.has(dst, 'cover')) n *= 0.7;
    const clean = !!timing.clean && src.side === 0;
    const braced = (bracedOrig || !!timing.braced?.has(dst.uid)) && src.side === 1;
    if (clean) n *= 1.25;
    if (braced) n *= 0.7;
    let dmg = Math.max(1, Math.round(n));
    const sh = this.st(dst, 'shield');
    if (sh) {
      const absorb = Math.min(dmg, sh.pow ?? 0);
      dmg -= absorb;
      sh.pow = (sh.pow ?? 0) - absorb;
      if ((sh.pow ?? 0) <= 0) this.removeStatus(dst, 'shield');
      if (absorb) this.ev.push({ k: 'msg', text: `The shield takes ${absorb}.` });
    }
    this.ev.push({ k: 'dmg', uid: dst.uid, n: dmg, crit, weak, resist, clean, braced });
    this.damage(dst, dmg, { silent: true });
    if (weak && dst.alive && src.side !== dst.side) this.pushBack(dst, 0.25);
    if (o.drain && dmg > 0) this.healUnit(src, Math.round(dmg * o.drain));
    // Wind-ups break when hit by the listed elements enough times.
    if (dst.windup && o.elem && dst.windup.breakElem.includes(o.elem) && dst.alive) {
      dst.windup.got++;
      if (dst.windup.got >= dst.windup.need) {
        this.ev.push({ k: 'break', uid: dst.uid });
        this.ev.push({ k: 'msg', text: `${dst.name}'s ${this.skill(dst.windup.skill).name} is broken!` });
        dst.windup = undefined;
        this.pushBack(dst, 0.6, true);
      } else {
        this.ev.push({ k: 'msg', text: `${dst.name} wavers. (${dst.windup.got}/${dst.windup.need})` });
      }
    }
  }

  damage(u: Unit, n: number, o: { silent?: boolean }) {
    if (!u.alive) return;
    if (!o.silent) this.ev.push({ k: 'dmg', uid: u.uid, n });
    u.hp -= n;
    u.tookThis = (u.tookThis ?? 0) + n;
    if (this.has(u, 'sleep') && n > 0) this.removeStatus(u, 'sleep');
    if (u.hp <= 0) this.onZero(u);
  }

  private onZero(u: Unit) {
    u.hp = 0;
    const def = u.side === 1 ? ENEMIES[u.id] : undefined;
    if (def?.mustAnswer) {
      u.hp = 1;
      if (def.ai === 'amen1') return;
      if (!this.extra['calm' + u.uid]) {
        this.extra['calm' + u.uid] = 1;
        this.ev.push({ k: 'msg', text: def.answered ? `${u.name} will not fight anymore. It is still waiting for something.` : `${u.name} stops fighting.` });
      }
      return;
    }
    if (u.side === 0 && this.mech.has('lastword') && !u.lastWordUsed && !this.has(u, 'lastword')) {
      u.lastWordUsed = true;
      u.status = u.status.filter((s) => STATUS[s.id].good);
      this.addStatus(u, 'lastword', 1);
      u.ct = -1;
      this.ev.push({ k: 'lastword', uid: u.uid });
      this.ev.push({ k: 'msg', text: `${u.name} has one last word.` });
      return;
    }
    if (u.side === 0 && this.has(u, 'lastword')) return;
    u.alive = false;
    u.status = [];
    u.windup = undefined;
    this.ev.push({ k: 'ko', uid: u.uid });
    if (u.side === 1) {
      this.defeated.push(u.id);
      if (def?.lastWord) {
        const sk = this.skill(def.lastWord);
        this.ev.push({ k: 'msg', text: `${u.name}'s last word: ${sk.name}!` });
        u.alive = true;
        this.useSkill(u, sk, this.party()[0]?.uid ?? 0, {});
        u.alive = false;
      }
    } else {
      this.ev.push({ k: 'msg', text: `${u.name} is down.` });
    }
  }

  healUnit(u: Unit, n: number) {
    if (!u.alive) return;
    const before = u.hp;
    u.hp = Math.min(u.mhp, u.hp + n);
    this.ev.push({ k: 'heal', uid: u.uid, n: u.hp - before });
  }

  addStatus(u: Unit, id: StatusId, turns: number, pow?: number) {
    const s = this.st(u, id);
    if (s) { s.turns = Math.max(s.turns, turns); if (pow !== undefined) s.pow = pow; return; }
    u.status.push({ id, turns, pow });
    this.ev.push({ k: 'status', uid: u.uid, id, on: true });
  }

  removeStatus(u: Unit, id: StatusId) {
    if (!this.has(u, id)) return;
    u.status = u.status.filter((s) => s.id !== id);
    this.ev.push({ k: 'status', uid: u.uid, id, on: false });
  }

  // Delays a unit's next turn. A weakness knock-back only lands once between the target's own turns.
  pushBack(u: Unit, frac: number, force = false) {
    if (u.pushed && !force) return;
    u.pushed = true;
    u.ct += Math.round(this.delay(u, 1) * frac);
    this.ev.push({ k: 'push', uid: u.uid });
  }

  useItem(actor: Unit, id: string, target: number) {
    const it = ITEMS[id];
    if (!it || !(this.inv[id] > 0)) { this.ev.push({ k: 'msg', text: 'Nothing left.' }); return; }
    this.inv[id]--;
    this.ev.push({ k: 'act', uid: actor.uid, name: it.name });
    const t = this.get(target);
    const ts = it.tgt === 'allies' ? this.party() : it.tgt === 'foes' ? this.foes() : t ? [t] : [];
    for (const x of ts) {
      if (it.revive) {
        if (!x.alive && !x.gone) {
          x.alive = true;
          x.hp = Math.max(1, Math.round(x.mhp * it.revive));
          x.ct = this.delay(x, 1);
          this.ev.push({ k: 'revive', uid: x.uid });
        } else this.ev.push({ k: 'msg', text: 'It has no effect.' });
        continue;
      }
      if (!x.alive) continue;
      if (it.heal || it.healPct) this.healUnit(x, (it.heal ?? 0) + Math.round(x.mhp * (it.healPct ?? 0)));
      if (it.vp) { const n = Math.min(x.mvp - x.vp, it.vp); x.vp += n; this.ev.push({ k: 'heal', uid: x.uid, n, vp: true }); }
      if (it.cure) for (const s of [...x.status]) if (!STATUS[s.id].good && s.id !== 'tomorrow') this.removeStatus(x, s.id);
      if (it.dmg) this.damage(x, Math.round(it.dmg * (it.elem && x.weak.includes(it.elem) ? 1.5 : 1)), {});
      if (it.status) this.addStatus(x, it.status.id, it.status.turns);
    }
  }

  answer(actor: Unit, t: Unit | undefined, verb: Verb) {
    this.ev.push({ k: 'act', uid: actor.uid, name: VERB_NAME[verb] });
    if (!t || !t.alive || t.side !== 1) return;
    const def = ENEMIES[t.id];
    if (!def || def.noAnswer) {
      this.ev.push({ k: 'msg', text: `${t.name} cannot hear anything over itself.` });
      return;
    }
    t.answerTries = (t.answerTries ?? 0) + 1;
    if (def.ask !== verb) {
      this.ev.push({ k: 'answer', uid: t.uid, ok: false });
      this.ev.push({ k: 'msg', text: `That is not what ${t.name} asked for. It is offended.` });
      this.addStatus(t, 'offended', 2);
      t.offended = 2;
      return;
    }
    if (verb === 'hello' && !this.extra.finalPhase) {
      this.ev.push({ k: 'msg', text: 'Not yet. It is not listening yet.' });
      return;
    }
    if (def.needItem && !(this.inv[def.needItem] > 0)) {
      this.ev.push({ k: 'msg', text: `${t.name} wants that, but you have nothing to do it with.` });
      return;
    }
    const need = def.askNeed ?? 'none';
    const ready =
      need === 'none' ||
      (need === 'listened' && t.listened) ||
      (need === 'low' && t.hp <= t.mhp * 0.5) ||
      (need === 'alone' && this.foes().length === 1) ||
      (need === 'late' && (t.turns ?? 0) >= 2);
    if (!ready) {
      const hint = need === 'listened' ? 'It wants to be heard first.' : need === 'low' ? 'It is still too sure of itself.' : need === 'alone' ? 'Not in front of the others.' : 'Not yet. Give it a moment.';
      this.ev.push({ k: 'msg', text: `${t.name} almost listens. ${hint}` });
      return;
    }
    t.alive = false;
    t.gone = 'answered';
    t.windup = undefined;
    this.answered.push(t.id);
    this.ev.push({ k: 'answer', uid: t.uid, ok: true });
    this.ev.push({ k: 'msg', text: def.answered ?? `${t.name} has what it asked for. It leaves in peace.` });
    this.ev.push({ k: 'leave', uid: t.uid });
  }

  useLine(a: Unit, b: Unit, tech: SkillDef, target: number, timing: { clean?: boolean; braced?: Set<number> }) {
    const cost = tech.cost ?? 0;
    a.vp = Math.max(0, a.vp - cost);
    b.vp = Math.max(0, b.vp - cost);
    this.ev.push({ k: 'act', uid: a.uid, name: tech.name });
    this.ev.push({ k: 'msg', text: `${a.name} and ${b.name} share the line.` });
    // A duo tech acts with the pair's combined stats.
    const pair: Unit = { ...a, pow: (a.pow + b.pow) * 0.62, wit: (a.wit + b.wit) * 0.62, status: a.status };
    const before = this.ev.length;
    this.useSkill(pair, { ...tech, cost: 0 }, target, timing);
    // Remove the duplicate act event that useSkill pushed.
    this.ev.splice(before, 1);
    a.hp = pair.hp;
  }

  callKept(actor: Unit, keptId: string, target: number, timing: { clean?: boolean; braced?: Set<number> }) {
    const def = ENEMIES[keptId];
    const skId = def?.kept?.skill;
    actor.vp = Math.max(0, actor.vp - 6);
    this.callUsed = true;
    this.ev.push({ k: 'summon', name: def?.name ?? '?' });
    this.ev.push({ k: 'msg', text: `${actor.name} calls ${def?.name ?? 'someone'}. It picks up.` });
    if (!skId) return;
    const sk = this.skill(skId);
    // A called prayer hits every foe, and its helpful effects reach the whole party.
    const helpful = sk.tgt === 'self' || sk.tgt === 'ally' || sk.tgt === 'other' || sk.tgt === 'allies';
    const caller: Unit = { ...actor, pow: actor.pow * 1.5 + 6, wit: actor.wit * 1.5 + 6, status: [] };
    const before = this.ev.length;
    this.useSkill(caller, { ...sk, cost: 0, tgt: helpful ? 'allies' : sk.tgt === 'foe' ? 'foes' : sk.tgt }, target, timing, 1.1);
    this.ev.splice(before, 1);
  }

  // ---- enemy decisions ----
  planEnemy(u: Unit): Action {
    const def = ENEMIES[u.id];
    if (def?.mustAnswer && this.extra['calm' + u.uid]) return { t: 'skill', skill: 'e_wait', target: u.uid };
    if (u.windup) {
      const sk = u.windup.skill;
      u.windup = undefined;
      return { t: 'skill', skill: sk, target: this.pickTarget(u, this.skill(sk)) };
    }
    if (def?.ai && BOSS_AI[def.ai]) {
      const a = BOSS_AI[def.ai](this, u);
      if (a) return a;
    }
    const opts = def ? def.moves.filter((m) => this.cond(u, m.if)) : [];
    const usable = opts.filter((m) => this.canUse(u, this.skill(m.skill)));
    if (!usable.length) return { t: 'attack', target: this.pickTarget(u, SKILLS.attack) };
    const total = usable.reduce((s, m) => s + m.w, 0);
    let r = this.rng.next() * total;
    let pick = usable[0];
    for (const m of usable) { r -= m.w; if (r <= 0) { pick = m; break; } }
    if (pick.skill === 'attack') return { t: 'attack', target: this.pickTarget(u, SKILLS.attack) };
    const sk = this.skill(pick.skill);
    return { t: 'skill', skill: pick.skill, target: this.pickTarget(u, sk) };
  }

  windup(u: Unit, skill: string, breakElem: Elem[], need: number, text: string): Action {
    u.windup = { skill, breakElem, need, got: 0, text };
    return { t: 'skill', skill: 'e_windup', target: u.uid };
  }

  cond(u: Unit, c?: string): boolean {
    if (!c) return true;
    switch (c) {
      case 'low': return u.hp < u.mhp * 0.5;
      case 'high': return u.hp >= u.mhp * 0.5;
      case 'first': return (u.turns ?? 0) <= 1;
      case 'later': return (u.turns ?? 0) > 1;
      case 'alone': return this.foes().length === 1;
      case 'crowd': return this.foes().length > 1;
      case 'even': return (u.turns ?? 0) % 2 === 0;
      case 'odd': return (u.turns ?? 0) % 2 === 1;
      case 'allyhurt': return this.foes().some((f) => f.hp < f.mhp * 0.6);
      case 'partyhurt': return this.party().some((p) => p.hp < p.mhp * 0.5);
      case 'offended': return !!u.offended;
      case 'third': return (u.turns ?? 0) % 3 === 0;
      case 'rare': return this.rng.chance(0.3);
      case 'nostatus': return this.party().some((p) => !p.status.some((s) => !STATUS[s.id].good));
    }
    return true;
  }

  pickTarget(u: Unit, sk: SkillDef): number {
    if (sk.tgt === 'self') return u.uid;
    if (sk.tgt === 'ally' || sk.tgt === 'allies' || sk.tgt === 'other') {
      const allies = this.sideOf(u, true);
      const hurt = allies.slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp);
      const pool = sk.tgt === 'other' ? hurt.filter((x) => x.uid !== u.uid) : hurt;
      return (pool[0] ?? u).uid;
    }
    const foes = this.sideOf(u, false);
    if (!foes.length) return 0;
    const taunt = foes.find((f) => this.has(f, 'taunt'));
    if (taunt && this.rng.chance(0.8)) return taunt.uid;
    // Mild preference for wounded targets.
    const weights = foes.map((f) => 1 + (1 - f.hp / f.mhp) * 0.8);
    let r = this.rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < foes.length; i++) { r -= weights[i]; if (r <= 0) return foes[i].uid; }
    return foes[0].uid;
  }

  // ---- end, snapshots ----
  hpFrac(side: 0 | 1): number {
    const us = this.units.filter((u) => u.side === side && !u.bench);
    const m = us.reduce((s, u) => s + u.mhp, 0);
    const h = us.reduce((s, u) => s + (u.alive ? Math.max(0, u.hp) : 0), 0);
    return m ? h / m : 0;
  }

  checkEnd() {
    if (this.outcome) return;
    if (!this.foes().length) { this.outcome = 'win'; return; }
    if (!this.party().length) this.outcome = 'lose';
  }

  snapshot(): string {
    return JSON.stringify({
      units: this.units, s: this.rng.s, inv: this.inv, outcome: this.outcome, round: this.round,
      answered: this.answered, defeated: this.defeated, callUsed: this.callUsed, nextUid: this.nextUid, extra: this.extra, tl: this.trace.length,
    });
  }

  restore(snap: string) {
    const o = JSON.parse(snap);
    this.units = o.units;
    this.rng.s = o.s;
    for (const k of Object.keys(this.inv)) delete this.inv[k];
    Object.assign(this.inv, o.inv);
    this.outcome = o.outcome;
    this.round = o.round;
    this.answered = o.answered;
    this.defeated = o.defeated;
    this.callUsed = o.callUsed;
    this.nextUid = o.nextUid;
    this.extra = o.extra;
    this.trace.length = o.tl;
  }

  rewards(): { xp: number; pleas: number; drops: string[] } {
    let xp = 0, pleas = 0;
    const drops: string[] = [];
    const mult = STAKE_REWARD[this.stakes] ?? 1;
    for (const id of this.defeated) {
      const d = ENEMIES[id];
      if (!d) continue;
      xp += d.xp; pleas += d.pleas;
      if (d.drop && this.rng.chance(d.drop.chance)) drops.push(d.drop.item);
    }
    for (const id of this.answered) {
      const d = ENEMIES[id];
      if (!d) continue;
      xp += d.xp;
      pleas += Math.round(d.pleas * 0.3);
    }
    return { xp: Math.round(xp * mult), pleas: Math.round(pleas * mult), drops };
  }
}
