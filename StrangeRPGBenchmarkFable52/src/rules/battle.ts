import { FIXED, OPEN } from './types';
import type { Action, Battle, Player, State, Unit } from './types';
import { CREATURES, GUARDIANS, HALVES, LEADERS, PAGE_CHILD, WARDENS } from './data';
import type { Face, FoeDef, Skill } from './data';
import { T } from './tuning';
import { compFace, compName, emit, hasPower, hasRelic, localDef, pcell } from './board';
import { rnd } from './rng';

export function foeDef(id: string): FoeDef {
  if (GUARDIANS[id]) return GUARDIANS[id];
  const c = CREATURES.find((x) => x.id === id);
  if (c) return c;
  for (const w of Object.values(WARDENS)) if (w.id === id) return w;
  throw new Error('unknown foe ' + id);
}

/** The two faces a unit can show. The second is null for a unit with one reading. */
export function unitFaces(s: State, u: Unit): [Face, Face | null] {
  if (u.leader) {
    const d = LEADERS[s.players[u.owner].char];
    const f: Face = { gloss: '', hp: d.hp, atk: d.atk, spd: d.spd, skill: d.skill, power: null };
    return [f, null];
  }
  if (u.comp >= 0) {
    if (u.key === 'page') return [PAGE_CHILD, null];
    const half = HALVES.find((h) => h.id === u.key);
    if (half) return [half.face, null];
    const def = localDef(u.key)!;
    return [def.a, def.b];
  }
  const f = foeDef(u.key);
  return [f.a, f.b];
}

export function unitFace(s: State, u: Unit): Face {
  const [a, b] = unitFaces(s, u);
  return u.r === 2 && b ? b : a;
}

export function unitSkill(s: State, u: Unit): Skill { return unitFace(s, u).skill; }

function mkUnit(side: number, key: string, name: string, f: Face, hpAdd: number, atkAdd: number): Unit {
  return {
    side, key, name, hp: f.hp + hpAdd, max: f.hp + hpAdd, atk: f.atk + atkAdd, spd: f.spd, fixed: true, two: false, r: 1, cd: 0,
    guard: false, cover: false, stun: false, weak: 0, buff: 0, leader: false, comp: -1, half: false, down: false, owner: -1, grow: 0,
  };
}

function partyUnits(s: State, p: Player, side: number): Unit[] {
  const lvl = s.season - 1;
  const d = LEADERS[p.char];
  const lf: Face = { gloss: '', hp: d.hp, atk: d.atk, spd: d.spd, skill: d.skill, power: null };
  const lead = mkUnit(side, p.char, charLabel(p), lf, 2 * lvl + (p.perks.includes('thickskin') ? 5 : 0), Math.floor(lvl / 2));
  lead.leader = true;
  lead.owner = p.idx;
  if (p.char === 'either') { lead.two = true; lead.fixed = false; }
  if (p.canBlur) lead.two = true;
  const out = [lead];
  p.ret.forEach((c, i) => {
    if (c.down) return;
    const f = compFace(c);
    const u = mkUnit(side, c.id, compName(c), f, lvl, Math.floor(lvl / 3));
    u.comp = i;
    u.owner = p.idx;
    u.half = c.half;
    const def = localDef(c.id);
    if (def && !c.half) {
      u.two = true;
      u.fixed = c.fixed > 0;
      u.r = c.fixed || c.active;
    }
    out.push(u);
  });
  return out;
}

function charLabel(p: Player): string { return p.char.charAt(0).toUpperCase() + p.char.slice(1); }

function foeUnits(s: State, def: FoeDef, side: number, hpAdd: number, firstHp: number): Unit[] {
  const lvl = s.season - 1;
  const out: Unit[] = [];
  for (let i = 0; i < def.count; i++) {
    const u = mkUnit(side, def.id, def.name, def.a, hpAdd + lvl, Math.floor(lvl / 2));
    if (def.two) { u.two = true; u.fixed = false; }
    if (i === 0 && firstHp > 0) u.hp = Math.min(u.max, firstHp);
    out.push(u);
  }
  return out;
}

function pool(s: State, b: Battle, side: number): { ink: number; doubt: number } {
  const who = side === 0 ? b.att : b.kind === 'pawn' ? b.def : -1;
  return who >= 0 ? s.players[who] : b.pool[side];
}

function alive(b: Battle, side: number): Unit[] { return b.units.filter((u) => u.side === side && !u.down); }

function setReading(s: State, u: Unit, r: number): void {
  const [a, bf] = unitFaces(s, u);
  if (!bf) return;
  const old = u.r === 2 ? bf : a;
  const nw = r === 2 ? bf : a;
  if (old !== nw) {
    const frac = u.hp / u.max;
    const add = u.max - old.hp;
    u.max = nw.hp + add;
    u.hp = Math.max(1, Math.round(u.max * frac));
    u.atk += nw.atk - old.atk;
    u.spd = nw.spd;
    u.cd = 0;
  }
  u.r = r;
}

export function startBattle(s: State, att: number, kind: 'pawn' | 'peg' | 'den', who: number): void {
  const A = s.players[att];
  const cell = pcell(A);
  const t = s.tiles[cell];
  const b: Battle = {
    att, def: -1, kind, cell, units: partyUnits(s, A, 0), round: 0, queue: [], qi: 0,
    pool: [{ ink: 0, doubt: 0 }, { ink: 0, doubt: 0 }], ratio: 1, boss: null, lastSkill: null,
    bubbleUsed: [false, false], done: false, winner: -1, withdrew: false, log: [], auto: false,
  };
  if (kind === 'pawn') {
    b.def = who;
    b.units.push(...partyUnits(s, s.players[who], 1));
  } else if (kind === 'peg') {
    b.def = t.peg;
    const owner = s.players[t.peg];
    const wk = t.st === OPEN ? (owner.char === 'either' ? 'haze' : 'open') : t.k!;
    const def = WARDENS[wk];
    b.units.push(...foeUnits(s, def, 1, (hasPower(owner, 'guardpegs') ? 8 : 0) + (s.law === 'quiet' ? 8 : 0), 0));
    b.pool[1] = { ink: def.ink, doubt: def.doubt };
  } else {
    const levelHere = s.level && s.level.alive && s.level.x === A.x && s.level.y === A.y && who === -2;
    const id = levelHere ? 'level' : t.den!;
    const def = foeDef(id);
    b.boss = GUARDIANS[id] ? id : null;
    b.units.push(...foeUnits(s, def, 1, 0, levelHere ? 0 : t.denHp));
    b.pool[1] = { ink: def.ink, doubt: def.doubt };
  }
  for (const side of [0, 1]) {
    const pl = side === 0 ? A : b.kind === 'pawn' ? s.players[b.def] : null;
    if (pl && hasRelic(pl, 'ring', 2)) for (const u of alive(b, 1 - side)) if (u.key !== 'level') u.stun = true;
  }
  s.battle = b;
  emit(s, { t: 'fightStart', p: att, q: b.def, c: cell, s: b.boss ?? kind });
  nextRound(s, b);
  advance(s);
}

function nextRound(s: State, b: Battle): void {
  b.round++;
  if (b.round > T.fightRounds) { b.done = true; b.winner = 1; return; }
  if (b.boss === 'scale') b.ratio = b.round % 2 === 1 ? 0.5 : 2;
  for (const u of b.units) {
    if (u.down) continue;
    if (u.comp < 0 && !u.leader && u.two && !u.fixed && b.round > 1) setReading(s, u, u.r === 1 ? 2 : 1);
    if (u.comp >= 0 && unitFace(s, u).power === 'grow') u.grow++;
  }
  const first = [0, 1].map((side) => {
    const pl = side === 0 ? s.players[b.att] : b.kind === 'pawn' ? s.players[b.def] : null;
    return pl && hasRelic(pl, 'match', 1) ? 1 : 0;
  });
  const order = b.units.map((_, i) => i).filter((i) => !b.units[i].down);
  order.sort((x, y) => {
    const ux = b.units[x], uy = b.units[y];
    if (first[ux.side] !== first[uy.side]) return first[uy.side] - first[ux.side];
    if (ux.spd !== uy.spd) return uy.spd - ux.spd;
    return ux.side - uy.side;
  });
  const twice = order.filter((i) => b.units[i].key === 'level' || (b.units[i].comp >= 0 && unitFace(s, b.units[i]).power === 'twice'));
  b.queue = order.concat(twice);
  b.qi = 0;
}

function humanUnit(s: State, b: Battle, u: Unit): boolean {
  return !s.quiet && !b.auto && u.owner >= 0 && s.players[u.owner].human;
}

/** Runs the fight until a human unit must choose or the fight ends. */
export function advance(s: State): void {
  const b = s.battle!;
  for (let guard = 0; guard < 400; guard++) {
    if (b.done) { finish(s, b); return; }
    if (b.qi >= b.queue.length) { nextRound(s, b); continue; }
    const u = b.units[b.queue[b.qi]];
    if (u.down) { b.qi++; continue; }
    if (u.stun) { u.stun = false; b.qi++; note(s, b, u.name + ' loses a turn.'); continue; }
    if (humanUnit(s, b, u)) { s.pending = { t: 'battle', p: u.owner }; return; }
    act(s, b, policy(s, b, b.queue[b.qi]));
  }
  b.done = true;
  b.winner = 1;
  finish(s, b);
}

export function batAct(s: State, a: Action): void {
  const b = s.battle!;
  if (a.t !== 'bat') throw new Error('not a fight action');
  act(s, b, a);
  advance(s);
}

function note(s: State, b: Battle, text: string): void {
  if (s.quiet) return;
  b.log.push(text);
  if (b.log.length > 40) b.log.shift();
  emit(s, { t: 'fightLog', s: text });
}

function coverOf(b: Battle, side: number): Unit | null {
  for (const u of b.units) if (u.side === side && !u.down && u.cover) return u;
  return null;
}

function damage(s: State, b: Battle, from: Unit, to: Unit, m: number, pierce: boolean): number {
  let d = (from.atk + from.buff + from.grow - from.weak) * m;
  if (from.two && !from.fixed) d *= 0.5;
  if (to.two && !to.fixed && !pierce) d *= 0.5;
  if (to.guard) d *= 0.5;
  d *= b.ratio;
  const n = Math.max(1, Math.ceil(d - 1e-9));
  to.hp -= n;
  emit(s, { t: 'hit', n, q: b.units.indexOf(to), p: b.units.indexOf(from) });
  if (to.hp <= 0) {
    to.hp = 0;
    to.down = true;
    note(s, b, to.name + ' falls.');
    if (to.leader) { b.done = true; b.winner = 1 - to.side; }
    else if (!alive(b, to.side).length) { b.done = true; b.winner = 1 - to.side; }
    else if (!alive(b, to.side).some((u) => u.leader) && b.units.some((u) => u.side === to.side && u.leader)) { b.done = true; b.winner = 1 - to.side; }
  }
  return n;
}

function hitTarget(s: State, b: Battle, from: Unit, ti: number, m: number, pierce: boolean): Unit | null {
  let to = b.units[ti];
  const cov = coverOf(b, 1 - from.side);
  if (cov && cov !== to) to = cov;
  if (!to || to.down) to = alive(b, 1 - from.side)[0];
  if (!to) return null;
  damage(s, b, from, to, m, pierce);
  return to;
}

function doPin(s: State, b: Battle, by: Unit, to: Unit, r: number): void {
  const [, bf] = unitFaces(s, to);
  if (bf) setReading(s, to, r === 2 ? 2 : 1);
  to.fixed = true;
  if (to.comp >= 0) s.players[to.owner].ret[to.comp].fixed = to.r;
  note(s, b, by.name + ' pins ' + to.name + (bf ? ' as ' + unitFace(s, to).gloss : '') + '.');
  emit(s, { t: 'pin', p: b.units.indexOf(by), q: b.units.indexOf(to), n: to.r });
}

function doBlur(s: State, b: Battle, by: Unit, to: Unit): void {
  to.fixed = false;
  if (to.comp >= 0) s.players[to.owner].ret[to.comp].fixed = 0;
  note(s, b, by.name + ' blurs ' + to.name + '.');
  emit(s, { t: 'blur', p: b.units.indexOf(by), q: b.units.indexOf(to) });
}

function act(s: State, b: Battle, a: Action): void {
  if (a.t !== 'bat') return;
  const ui = b.queue[b.qi];
  const u = b.units[ui];
  u.guard = false;
  u.cover = false;
  if (u.cd > 0) u.cd--;
  const foes = alive(b, 1 - u.side);
  const pl = pool(s, b, u.side);
  const target = b.units[a.target] && !b.units[a.target].down ? b.units[a.target] : foes[0];
  switch (a.a) {
    case 'strike': {
      if (!foes.length) break;
      const hit = hitTarget(s, b, u, b.units.indexOf(target.side === u.side ? foes[0] : target), 1, false);
      if (u.leader && u.owner >= 0 && hasRelic(s.players[u.owner], 'bow', 1) && !b.done) {
        const other = alive(b, 1 - u.side).find((x) => x !== hit);
        if (other) damage(s, b, u, other, 1, false);
      }
      break;
    }
    case 'skill': {
      const sk = unitSkill(s, u);
      u.cd = sk.cd;
      if (u.side === 1 || u.owner < 0 || !s.players[u.owner].human) b.lastSkill = sk.fx;
      note(s, b, u.name + ': ' + sk.name + '.');
      skill(s, b, u, sk, a, target);
      break;
    }
    case 'pin': {
      if (pl.ink < 1 || !target || !target.two || target.fixed) break;
      pl.ink -= 1;
      doPin(s, b, u, target, a.r);
      break;
    }
    case 'blur': {
      if (!target || !target.two || !target.fixed || target.half) break;
      const mine = u.owner >= 0 ? s.players[u.owner] : null;
      if (mine && hasRelic(mine, 'bubble', 1) && !b.bubbleUsed[u.side]) b.bubbleUsed[u.side] = true;
      else if (target.side !== u.side || pl.doubt < 1) break;
      else pl.doubt -= 1;
      doBlur(s, b, u, target);
      break;
    }
    case 'guard':
      u.guard = true;
      break;
    case 'withdraw':
      if (u.leader) { b.done = true; b.winner = 1 - u.side; b.withdrew = true; note(s, b, u.name + ' withdraws.'); }
      break;
  }
  b.qi++;
}

function skill(s: State, b: Battle, u: Unit, sk: Skill, a: Action & { t: 'bat' }, target: Unit): void {
  const mates = alive(b, u.side);
  const foes = alive(b, 1 - u.side);
  const pl = pool(s, b, u.side);
  const foePool = pool(s, b, 1 - u.side);
  switch (sk.fx) {
    case 'hit': case 'copy': {
      const to = hitTarget(s, b, u, b.units.indexOf(target), sk.m, sk.pierce);
      if (to && sk.stun && !to.down && to.key !== 'level') to.stun = true;
      break;
    }
    case 'hitall':
      for (const f of foes) if (!b.done || !f.down) damage(s, b, u, f, sk.m, sk.pierce);
      break;
    case 'hit2': {
      const first = hitTarget(s, b, u, b.units.indexOf(target), sk.m, sk.pierce);
      const other = alive(b, 1 - u.side).find((x) => x !== first);
      if (other && !b.done) damage(s, b, u, other, sk.m, sk.pierce);
      break;
    }
    case 'drain': {
      const to = hitTarget(s, b, u, b.units.indexOf(target), sk.m, sk.pierce);
      if (to) u.hp = Math.min(u.max, u.hp + 2);
      break;
    }
    case 'weaken': {
      const to = hitTarget(s, b, u, b.units.indexOf(target), sk.m, sk.pierce);
      if (to && !to.down) to.weak = Math.min(3, to.weak + 1);
      break;
    }
    case 'heal': {
      let low = mates[0];
      for (const m of mates) if (m.hp / m.max < low.hp / low.max) low = m;
      low.hp = Math.min(low.max, low.hp + Math.max(1, Math.round(sk.m * b.ratio)));
      break;
    }
    case 'cover':
      u.cover = true;
      u.guard = true;
      break;
    case 'stun': {
      const to = target && target.side !== u.side ? target : foes[0];
      if (to && to.key !== 'level') to.stun = true;
      else if (to) damage(s, b, u, to, 1, false);
      break;
    }
    case 'steal': {
      const to = hitTarget(s, b, u, b.units.indexOf(target), 1, false);
      if (to) {
        const n = Math.min(sk.m, foePool.ink);
        foePool.ink -= n;
        pl.ink += n;
      }
      break;
    }
    case 'buff': {
      let best = mates[0];
      for (const m of mates) if (m !== u && (best === u || m.atk > best.atk)) best = m;
      best.buff = Math.min(4, best.buff + sk.m);
      break;
    }
    case 'pinfree': {
      const to = target && target.two && !target.fixed ? target : foes.find((f) => f.two && !f.fixed);
      if (to) doPin(s, b, u, to, a.r);
      else if (foes.length) hitTarget(s, b, u, b.units.indexOf(foes[0]), 1, false);
      break;
    }
    case 'blurfree': {
      const to = target && target.two && target.fixed && !target.half && target.side === u.side ? target : mates.find((m) => m.two && m.fixed && !m.half);
      if (to) doBlur(s, b, u, to);
      else u.guard = true;
      break;
    }
  }
}

function threat(u: Unit): number {
  return (u.atk + u.buff + u.grow - u.weak) * (u.two && !u.fixed ? 0.5 : 1);
}

/** The fight policy every computer unit uses. */
export function policy(s: State, b: Battle, ui: number): Action & { t: 'bat' } {
  const u = b.units[ui];
  const mates = alive(b, u.side);
  const foes = alive(b, 1 - u.side);
  const pl = pool(s, b, u.side);
  const mk = (a: 'strike' | 'skill' | 'pin' | 'blur' | 'guard' | 'withdraw', to: Unit | null, r = 1): Action & { t: 'bat' } => ({ t: 'bat', a, target: to ? b.units.indexOf(to) : -1, r });
  if (!foes.length) return mk('guard', null);

  if (u.leader && u.owner >= 0) {
    const foeHp = foes.reduce((n, f) => n + f.hp, 0), foeMax = foes.reduce((n, f) => n + f.max, 0);
    const incoming = foes.reduce((n, f) => n + threat(f), 0) * (u.two && !u.fixed ? 0.5 : 1);
    if (u.hp <= incoming && foeHp / foeMax > 0.45 && u.hp / u.max < 0.35) return mk('withdraw', null);
  }
  if (pl.doubt >= 1) {
    const hurt = mates.find((m) => m.two && m.fixed && !m.half && !m.leader && m.hp / m.max < 0.4);
    if (hurt) return mk('blur', hurt);
    if (u.leader && u.two && u.fixed && u.hp / u.max < 0.35) return mk('blur', u);
  }
  const best = bestTarget(b, u, foes);
  const sk = unitSkill(s, u);
  if (u.cd === 0) {
    switch (sk.fx) {
      case 'heal': if (mates.some((m) => m.hp / m.max < 0.55)) return mk('skill', null); break;
      case 'cover': if (mates.some((m) => m !== u && m.hp / m.max < 0.6) && u.hp / u.max > 0.4) return mk('skill', null); break;
      case 'stun': {
        const to = foes.filter((f) => !f.stun && f.key !== 'level').sort((x, y) => threat(y) - threat(x))[0];
        if (to) return mk('skill', to);
        break;
      }
      case 'pinfree': {
        const to = foes.filter((f) => f.two && !f.fixed).sort((x, y) => y.hp - x.hp)[0];
        if (to) return mk('skill', to, weakReading(s, to));
        break;
      }
      case 'blurfree': if (mates.some((m) => m.two && m.fixed && !m.half && m.hp / m.max < 0.6)) return mk('skill', null); break;
      case 'steal': if (pool(s, b, 1 - u.side).ink > 0) return mk('skill', best); break;
      case 'buff': if (b.round <= 3 && mates.length > 1) return mk('skill', null); break;
      default: return mk('skill', best);
    }
  }
  if (pl.ink >= 1) {
    const open = foes.filter((f) => f.two && !f.fixed).sort((x, y) => y.hp - x.hp)[0];
    const hitters = mates.filter((m) => threat(m) >= 3).length;
    if (open && (open.leader || open.hp >= 6) && hitters >= 1 && (pl.ink >= 2 || open.leader || u.owner < 0)) return mk('pin', open, weakReading(s, open));
  }
  if (u.hp / u.max < 0.25 && !u.leader && foes.length > 1) return mk('guard', null);
  return mk('strike', best);
}

function weakReading(s: State, u: Unit): number {
  const [a, bf] = unitFaces(s, u);
  if (!bf) return 1;
  return a.atk + a.hp / 3 <= bf.atk + bf.hp / 3 ? 1 : 2;
}

function bestTarget(b: Battle, u: Unit, foes: Unit[]): Unit {
  const cov = coverOf(b, 1 - u.side);
  if (cov) return cov;
  let best = foes[0], bestScore = -1e9;
  for (const f of foes) {
    let d = threat(u);
    if (f.two && !f.fixed) d *= 0.5;
    if (f.guard) d *= 0.5;
    const kills = f.hp <= Math.ceil(d);
    const score = (kills ? 50 : 0) + (f.leader ? (kills ? 100 : 6) : 0) + threat(f) * 2 - f.hp / Math.max(1, d);
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

function retreat(s: State, p: Player): void {
  let best = p.sy * T.W + p.sx, bd = 99;
  const here = pcell(p);
  for (let c = 0; c < s.tiles.length; c++) {
    if (s.tiles[c].peg === p.idx && c !== here) {
      const d = Math.abs((c % T.W) - p.x) + Math.abs(Math.floor(c / T.W) - p.y);
      if (d < bd) { bd = d; best = c; }
    }
  }
  p.x = best % T.W;
  p.y = Math.floor(best / T.W);
  emit(s, { t: 'retreat', p: p.idx, c: best });
}

function spoils(s: State, from: Player, to: Player | null, n: number): void {
  let left = n;
  const ink = Math.min(left, from.ink);
  from.ink -= ink;
  left -= ink;
  const doubt = Math.min(left, from.doubt);
  from.doubt -= doubt;
  if (to) { to.ink += ink; to.doubt += doubt; }
  emit(s, { t: 'spoils', p: to ? to.idx : -1, q: from.idx, n: ink + doubt });
}

function finish(s: State, b: Battle): void {
  const A = s.players[b.att];
  const D = b.def >= 0 ? s.players[b.def] : null;
  const t = s.tiles[b.cell];
  const struck: string[] = [];
  for (const u of b.units) {
    if (u.comp < 0 || !u.down) continue;
    const owner = s.players[u.owner];
    const c = owner.ret[u.comp];
    if (c.fixed > 0 && !c.half) struck.push(owner.idx + ':' + c.id);
    else c.down = true;
  }
  for (const key of struck) {
    const [pi, id] = key.split(':');
    const owner = s.players[Number(pi)];
    owner.ret = owner.ret.filter((c) => c.id !== id);
    emit(s, { t: 'struckComp', p: owner.idx, s: id });
    if (!s.quiet) s.lost.push(id);
    const other = owner.idx === b.att ? b.def : b.att;
    if (other >= 0 && b.kind === 'pawn') bump(s, owner.idx, other, -2, 'struck');
  }
  const win = b.winner === 0;
  const pen = b.withdrew ? 1 : T.spoils;
  if (!s.quiet) A.stats.contests++;
  if (win) {
    if (!s.quiet) A.stats.contestsWon++;
    if (b.kind === 'pawn' && D) {
      spoils(s, D, A, pen + (hasPower(A, 'steal') ? 1 : 0));
      if (t.peg === D.idx) { t.peg = -1; D.pegs++; s.scripted.freePeg = b.cell; }
      retreat(s, D);
    } else if (b.kind === 'peg' && D) {
      t.peg = -1;
      D.pegs++;
      s.scripted.freePeg = b.cell;
      emit(s, { t: 'uproot', p: A.idx, q: D.idx, c: b.cell });
    } else if (b.kind === 'den') {
      const def = foeDef(b.units.find((u) => u.side === 1)!.key);
      A.ink += def.reward.ink;
      A.doubt += def.reward.doubt;
      if (def.id === 'level') {
        s.level!.alive = false;
        s.pending = { t: 'turn', p: b.att };
        A.relics.push({ id: 'bubble', r: 1 });
        emit(s, { t: 'levelDown', p: A.idx });
      } else {
        t.den = null;
        t.denHp = 0;
        emit(s, { t: 'denDown', p: A.idx, c: b.cell, s: def.id });
        if (t.site) emit(s, { t: 'siteWon', p: A.idx, c: b.cell, s: t.site });
      }
    }
  } else {
    if (D && b.kind === 'pawn') spoils(s, A, D, pen);
    else if (b.kind !== 'pawn') spoils(s, A, D, b.withdrew ? 0 : 1);
    if (b.kind === 'den' && t.den) {
      const first = b.units.find((u) => u.side === 1 && u.key === t.den);
      if (first && !first.down) t.denHp = Math.max(4, first.hp);
    }
    retreat(s, A);
  }
  emit(s, { t: 'fightEnd', p: b.att, q: b.def, n: win ? 1 : 0, s: b.kind });
  s.battle = null;
  s.pending = { t: 'turn', p: b.att };
  s.scripted.lastFightWon = win ? 1 : 0;
  s.scripted.lastFightRounds = b.round;
  const lead = b.units.find((u) => u.side === 0 && u.leader)!;
  s.scripted.lastFightHp = Math.round((100 * lead.hp) / lead.max);
  s.scripted.lastFightStruck = struck.filter((k) => k.startsWith(b.att + ':')).length;
}

function bump(s: State, a: number, b: number, d: number, why: string): void {
  const v = Math.max(T.trustMin, Math.min(T.trustMax, s.trust[a][b] + d));
  s.trust[a][b] = v;
  if (!s.quiet) s.ledger.push({ season: s.season, round: s.round, a, b, d, why });
}

/** Rolls a random float for callers that need fight variance. */
export function fightJitter(s: State): number { return rnd(s); }

export function tileIsFixed(s: State, c: number): boolean { return s.tiles[c].st === FIXED; }
