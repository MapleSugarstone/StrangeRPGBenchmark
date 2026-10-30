// Battle rules. Pure and deterministic given a seed, so the simulator runs exactly what the player plays.
import { SKILLS, entrySkill, type SkillDef, type Shape } from './skills';
import type { BattleState, BEvent, Intent, Lamp, Pos, Unit, Vec } from './types';
import { FOES } from '../content/foes';
import { foeUnit } from './units';

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIR8: Vec[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const DIR4: Vec[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function quantize(vx: number, vy: number): Vec {
  if (vx === 0 && vy === 0) return [0, 0];
  const a = Math.atan2(vy, vx);
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return DIR8[i];
}

export const inBounds = (st: BattleState, x: number, y: number) => x >= 0 && y >= 0 && x < st.w && y < st.h;
export const isSolid = (st: BattleState, x: number, y: number) => !inBounds(st, x, y) || !!st.solid[y * st.w + x];
export const living = (st: BattleState) => st.units.filter((u) => u.alive);
export const foes = (st: BattleState) => st.units.filter((u) => u.alive && u.side === 'foe');
export const party = (st: BattleState) => st.units.filter((u) => u.alive && u.side === 'party');
export function unitAt(st: BattleState, x: number, y: number): Unit | undefined {
  return st.units.find((u) => u.alive && u.x === x && u.y === y);
}
const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function emit(st: BattleState, e: BEvent) { st.events.push(e); }

// ---- Light and leads ----

/** All lights that shine on a tile: carried lanterns and placed lamps. */
function lampsFor(st: BattleState): Lamp[] {
  const out = st.lamps.slice();
  for (const u of st.units) if (u.alive && u.lantern && u.lantern.off <= 0) out.push({ x: u.x, y: u.y, r: u.lantern.r, lowness: u.lantern.lowness, owner: u.uid, kind: 'lantern' });
  return out;
}

/** Where the beam points next round: 45 degrees toward the party member nearest the lamp, or still if it already points at them. */
export function nextBeamAngle(st: BattleState): number {
  const b = st.beam!;
  const ps = st.units.filter((u) => u.side === 'party' && u.alive);
  if (!ps.length) return b.angle;
  const t = ps.reduce((a, u) => (Math.hypot(u.x - b.x, u.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? u : a));
  let d = Math.atan2(t.y - b.y, t.x - b.x) - b.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) < Math.PI / 8) return b.angle;
  return b.angle + Math.sign(d) * Math.PI / 4;
}

export function beamCovers(st: BattleState, x: number, y: number): boolean {
  const b = st.beam;
  if (!b) return false;
  const dx = x - b.x, dy = y - b.y;
  if (dx === 0 && dy === 0) return false;
  const a = Math.atan2(dy, dx);
  let d = Math.abs(a - b.angle) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d <= Math.PI / 5 && Math.hypot(dx, dy) <= 9;
}

/** The light a tile takes its lead from: the nearest lamp within reach, then the beam, then the sun. */
export function lightAt(st: BattleState, x: number, y: number, self?: number): { dir: Vec; lowness: number } | null {
  let best: Lamp | null = null;
  let bestD = 1e9;
  // A placed lamp beats a carried lantern anywhere it reaches.
  const placed = st.lamps.filter((l) => Math.hypot(x - l.x, y - l.y) <= l.r + 0.5);
  for (const l of placed.length ? placed : lampsFor(st)) {
    // A carrier's lead comes from the other lights, never from the lantern in its own hand.
    if (l.kind === 'lantern' && l.owner === self) continue;
    const d = Math.hypot(x - l.x, y - l.y);
    if (d <= l.r + 0.5 && d < bestD) { best = l; bestD = d; }
  }
  if (best) {
    if (bestD === 0) return null;
    return { dir: quantize(x - best.x, y - best.y), lowness: best.lowness };
  }
  if (st.beam && beamCovers(st, x, y)) return { dir: quantize(x - st.beam.x, y - st.beam.y), lowness: st.beam.lowness };
  if (st.sun && st.sun.lowness > 0 && !st.dark) return st.sun;
  return null;
}

export function lit(st: BattleState, x: number, y: number): boolean {
  if (!st.dark) return true;
  for (const l of lampsFor(st)) if (Math.hypot(x - l.x, y - l.y) <= l.r + 0.5) return true;
  return false;
}

export function inShadeZone(st: BattleState, x: number, y: number): boolean {
  return st.shades.some((s) => Math.abs(x - s.x) <= s.r && Math.abs(y - s.y) <= s.r);
}

/** A unit's lead: direction and length, or null when it has none (Unled, dazzled, in shade, or no light). */
export function leadOf(st: BattleState, u: Unit, at?: Pos): { dir: Vec; len: number } | null {
  if (u.unled || u.height <= 0) return null;
  if ((u.status.dazzled ?? 0) > 0) return null;
  const p = at ?? u;
  if (inShadeZone(st, p.x, p.y)) return null;
  const l = lightAt(st, p.x, p.y, u.uid);
  if (!l) return null;
  const len = Math.min(4, Math.round(u.height * l.lowness));
  if (len <= 0) return null;
  return { dir: l.dir, len };
}

/** Tiles a lead lies on, stopping at walls and at shade. */
export function rayTiles(st: BattleState, from: Pos, dir: Vec, len: number): Pos[] {
  const out: Pos[] = [];
  for (let k = 1; k <= len; k++) {
    const x = from.x + dir[0] * k, y = from.y + dir[1] * k;
    if (isSolid(st, x, y)) break;
    if (inShadeZone(st, x, y)) break;
    out.push({ x, y });
  }
  return out;
}

/** Every shaded tile: leads of every unit, shade patches, and the dark. Lot can stand on these. */
export function shadeTiles(st: BattleState): Set<number> {
  const s = new Set<number>();
  for (const u of st.units) {
    if (!u.alive || u.shadeOnly) continue;
    const l = leadOf(st, u);
    if (l) for (const p of rayTiles(st, u, l.dir, l.len)) s.add(p.y * st.w + p.x);
  }
  for (const z of st.shades) for (let y = z.y - z.r; y <= z.y + z.r; y++) for (let x = z.x - z.r; x <= z.x + z.r; x++) if (inBounds(st, x, y)) s.add(y * st.w + x);
  if (st.sun && !st.dark) {
    // Walls cast leads too.
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      if (!st.solid[y * st.w + x]) continue;
      const nx = x + st.sun.dir[0], ny = y + st.sun.dir[1];
      for (let k = 1; k <= st.sun.lowness; k++) {
        const tx = x + st.sun.dir[0] * k, ty = y + st.sun.dir[1] * k;
        if (isSolid(st, tx, ty)) break;
        s.add(ty * st.w + tx);
      }
      void nx; void ny;
    }
  }
  if (st.dark) for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) if (!lit(st, x, y)) s.add(y * st.w + x);
  return s;
}

// ---- Shapes ----

function perp(d: Vec): [Vec, Vec] { return [[-d[1], d[0]], [d[1], -d[0]]]; }

export function projectShape(st: BattleState, origin: Pos, dir: Vec, len: number, shape: Shape): Pos[] {
  const ray = rayTiles(st, origin, dir, len);
  if (!ray.length) return [];
  const end = ray[ray.length - 1];
  const reachedFull = ray.length === len;
  switch (shape) {
    case 'reach': return reachedFull ? [end] : [];
    case 'line': return ray;
    case 'spread': {
      if (!reachedFull) return [];
      const out = [end];
      for (const p of perp(dir)) { const x = end.x + p[0], y = end.y + p[1]; if (!isSolid(st, x, y) && !inShadeZone(st, x, y)) out.push({ x, y }); }
      return out;
    }
    case 'burst': {
      if (!reachedFull) return [];
      const out: Pos[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = end.x + dx, y = end.y + dy; if (!isSolid(st, x, y) && !inShadeZone(st, x, y)) out.push({ x, y }); }
      return out;
    }
    case 'pounce': {
      // Runs along the lead to the last open tile, then hits the tile beyond it.
      let stop = origin;
      for (const p of ray) { if (unitAt(st, p.x, p.y)) return [p]; stop = p; }
      const nx = stop.x + dir[0], ny = stop.y + dir[1];
      return isSolid(st, nx, ny) ? [stop] : [{ x: nx, y: ny }];
    }
  }
}

/** The tiles a skill would hit if used from `origin`. Empty when it has no lead to follow. */
export function skillTiles(st: BattleState, u: Unit, sk: SkillDef, origin: Pos, aim?: Vec): Pos[] {
  if (sk.kind === 'lead' || sk.kind === 'upsun') {
    // The Great Lamp's flare goes down its beam rather than along its lead, and bursts twice: 3 and 6 tiles out.
    if (sk.id === 'flare_beam' && st.beam) {
      const dir = quantize(Math.cos(st.beam.angle), Math.sin(st.beam.angle));
      const out = [...projectShape(st, origin, dir, 3, 'burst'), ...projectShape(st, origin, dir, 6, 'burst')];
      return out.filter((p, i) => out.findIndex((q) => q.x === p.x && q.y === p.y) === i);
    }
    const l = leadOf(st, u, origin);
    if (!l) return [];
    const dir: Vec = sk.kind === 'upsun' ? [-l.dir[0], -l.dir[1]] : l.dir;
    const len = Math.max(l.len, sk.minLen ?? 0);
    return projectShape(st, origin, dir, len, sk.shape ?? 'reach');
  }
  if (sk.kind === 'touch') {
    if (!aim) return [];
    const x = origin.x + aim[0], y = origin.y + aim[1];
    return isSolid(st, x, y) ? [] : [{ x, y }];
  }
  if (sk.kind === 'any') {
    if (!aim) return [];
    return projectShape(st, origin, aim, sk.range ?? 1, sk.shape ?? 'reach');
  }
  if (sk.id === 'chomp' || sk.id === 'flare_beam_all') {
    const out: Pos[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const x = origin.x + dx, y = origin.y + dy; if (!isSolid(st, x, y)) out.push({ x, y }); }
    return out;
  }
  return [];
}

// ---- Movement ----

export function reachable(st: BattleState, u: Unit): Pos[] {
  const move = Math.max(0, u.move - ((u.status.pinned ?? 0) > 0 ? 99 : 0));
  const out: Pos[] = [{ x: u.x, y: u.y }];
  if (move <= 0) return out;
  const shade = u.shadeOnly ? shadeTiles(st) : null;
  const ok = (x: number, y: number) => !isSolid(st, x, y) && !(unitAt(st, x, y) && !(unitAt(st, x, y)!.side === u.side)) && (!shade || shade.has(y * st.w + x));
  if (u.straight) {
    for (const d of DIR4) for (let k = 1; k <= move; k++) {
      const x = u.x + d[0] * k, y = u.y + d[1] * k;
      if (!ok(x, y)) break;
      if (!unitAt(st, x, y)) out.push({ x, y });
    }
    return out;
  }
  const dist = new Map<number, number>([[u.y * st.w + u.x, 0]]);
  const q: Pos[] = [{ x: u.x, y: u.y }];
  while (q.length) {
    const c = q.shift()!;
    const d0 = dist.get(c.y * st.w + c.x)!;
    if (d0 >= move) continue;
    for (const d of DIR4) {
      const x = c.x + d[0], y = c.y + d[1];
      const k = y * st.w + x;
      if (dist.has(k) || !ok(x, y)) continue;
      dist.set(k, d0 + 1);
      q.push({ x, y });
      if (!unitAt(st, x, y)) out.push({ x, y });
    }
  }
  return out;
}

export function moveUnit(st: BattleState, u: Unit, to: Pos) {
  if (u.x === to.x && u.y === to.y) return;
  emit(st, { k: 'move', uid: u.uid, path: [{ x: u.x, y: u.y }, to] });
  u.x = to.x; u.y = to.y;
  u.moved = true;
  u.lastMoved = st.round * 100 + st.events.length;
  if (u.side === 'party') afterLightChange(st);
}

export function undoMove(st: BattleState, u: Unit) {
  if (u.acted) return;
  u.x = u.startX; u.y = u.startY; u.moved = false;
  afterLightChange(st);
}

// ---- Damage ----

function strength(st: BattleState, u: Unit, sk: SkillDef): number {
  if (sk.id === 'touch') return 1;
  let p = (sk.power ?? 0) + u.pow;
  if (sk.id === 'dice') p = 1 + Math.floor(st.rng() * 4) + u.pow;
  return p;
}

export function damage(st: BattleState, target: Unit, amount: number, by: Unit | null, turned = false) {
  if (!target.alive) return;
  if (target.darkOnly && !lit(st, target.x, target.y)) { emit(st, { k: 'miss', uid: target.uid }); return; }
  if (target.shield && target.shield > 0) { target.shield--; emit(st, { k: 'miss', uid: target.uid }); return; }
  if (target.decoyOf !== undefined) { target.alive = false; emit(st, { k: 'down', uid: target.uid }); return; }
  const dmg = Math.max(1, amount - target.guard);
  const def = FOES[target.id];
  if (def?.rootOf) {
    const host = st.units.find((x) => x.alive && x.id === def.rootOf);
    target.hp -= dmg;
    emit(st, { k: 'hit', uid: target.uid, by: by?.uid ?? -1, dmg, turned });
    if (host) damage(st, host, dmg * 2 + host.guard, by, turned);
  } else {
    target.hp -= dmg;
    emit(st, { k: 'hit', uid: target.uid, by: by?.uid ?? -1, dmg, turned });
  }
  if (target.mirage) target.mirage = undefined;
  if (turned) st.turnedHits++;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.queue = [];
    emit(st, { k: 'down', uid: target.uid });
    if (target.boss) for (const d of st.units) if (d.decoyOf === target.uid) d.alive = false;
  }
}

function applyStatus(st: BattleState, t: Unit, s: keyof Unit['status'], turns: number) {
  if (s === 'pinned' && (t.status.pinGuard ?? 0) > 0) return;
  const n = t.boss ? Math.ceil(turns / 2) : turns;
  t.status[s] = Math.max(t.status[s] ?? 0, n);
  emit(st, { k: 'status', uid: t.uid, status: s });
}

/** Hits every unit on the tiles. Party attacks never hurt the party. Foe attacks hurt anyone. */
function hitTiles(st: BattleState, user: Unit, sk: SkillDef, tiles: Pos[], fromSide: 'party' | 'foe'): number {
  let foesHit = 0;
  const amount = strength(st, user, sk);
  for (const p of tiles) {
    const t = st.units.find((x) => x.alive && x.x === p.x && x.y === p.y);
    if (!t || t === user) continue;
    if (fromSide === 'party' && t.side === 'party') continue;
    const turned = fromSide === 'foe' && t.side === 'foe';
    if (t.side === 'foe') foesHit++;
    damage(st, t, amount, user, turned);
    if (sk.status && t.alive) applyStatus(st, t, sk.status.s, sk.status.turns);
    if (sk.id === 'snatch' && t.side === 'party') emit(st, { k: 'say', text: 'mites' });
  }
  // Panes send an attack back out a round later.
  for (const pn of st.panes) {
    if (!tiles.some((p) => p.x === pn.x && p.y === pn.y)) continue;
    const l = sk.kind === 'any' ? null : leadOf(st, user);
    const dir: Vec = l ? (sk.kind === 'upsun' ? l.dir : [-l.dir[0], -l.dir[1]]) : [1, 0];
    st.replays.push({ skill: sk.id, x: pn.x, y: pn.y, dir, len: Math.max(2, l?.len ?? 2), owner: user.uid });
    pn.ttl = 0;
    emit(st, { k: 'replay', x: pn.x, y: pn.y });
  }
  st.panes = st.panes.filter((p) => p.ttl > 0);
  return foesHit;
}

// ---- Party actions ----

export interface Target { pos?: Pos; aim?: Vec; uid?: number }

/** A lead strike needs set feet: one step is fine, more is not. */
export function movedFar(u: Unit): boolean { return Math.abs(u.x - u.startX) + Math.abs(u.y - u.startY) > 1; }

export function partySkills(st: BattleState, u: Unit): string[] {
  return u.skills.filter((s) => SKILLS[s] || entrySkill(s));
}

/** Why a skill can't be used right now, or null if it can. */
export function cantUse(st: BattleState, u: Unit, id: string): string | null {
  const sk = SKILLS[id];
  if (!sk) return 'Unknown';
  if ((sk.kind === 'lead' || sk.kind === 'upsun') && !leadOf(st, u)) return 'No shadow here';
  if ((sk.kind === 'lead' || sk.kind === 'upsun') && movedFar(u)) return 'Moved too far to strike';
  if ((id === 'raise' || id === 'hood' || id === 'flare') && (u.status.hooded ?? 0) > 0) return 'Hooded';
  if (id === 'hood' && !st.lamps.some((l) => l.owner === u.uid || l.owner === null)) return 'No lamp up';
  if (id === 'flare' && !st.lamps.length) return 'No lamp up';
  if (id === 'tug' || id === 'drag') { if (u.shadeOnly && !shadeTiles(st).has(u.y * st.w + u.x)) return 'Not in shade'; }
  return null;
}

export function validTargets(st: BattleState, u: Unit, id: string): Target[] {
  const sk = SKILLS[id];
  const out: Target[] = [];
  if (!sk) return out;
  if (sk.kind === 'lead' || sk.kind === 'upsun' || sk.kind === 'self') return [{}];
  if (sk.kind === 'touch') return DIR8.filter((d) => !isSolid(st, u.x + d[0], u.y + d[1])).map((aim) => ({ aim }));
  if (sk.kind === 'any') return DIR8.map((aim) => ({ aim }));
  if (sk.kind === 'place') {
    const shade = id === 'slip' ? shadeTiles(st) : null;
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      if (cheb({ x, y }, u) > (sk.range ?? 1)) continue;
      if (id === 'shade') { out.push({ pos: { x, y } }); continue; }
      if (isSolid(st, x, y)) continue;
      if (id === 'snuff') { if (lampsFor(st).some((l) => l.x === x && l.y === y)) out.push({ pos: { x, y } }); continue; }
      if (unitAt(st, x, y) && id !== 'raise') continue;
      if (id === 'slip' && !shade!.has(y * st.w + x)) continue;
      out.push({ pos: { x, y } });
    }
    return out;
  }
  if (sk.kind === 'ally') return party(st).filter((t) => cheb(t, u) <= (sk.range ?? 1)).map((t) => ({ uid: t.uid }));
  if (sk.kind === 'foe') {
    return foes(st).filter((t) => {
      if (id === 'note' || id === 'tug' || id === 'drag') return visibleIntents(st, t).length > 0 && cheb(t, u) <= (sk.range ?? 9);
      if (id === 'stab') return stabOk(st, u, t);
      return cheb(t, u) <= (sk.range ?? 9);
    }).map((t) => ({ uid: t.uid }));
  }
  return out;
}

function stabOk(st: BattleState, u: Unit, t: Unit): boolean {
  const l = leadOf(st, t);
  if (!l) return false;
  return rayTiles(st, t, l.dir, l.len).some((p) => cheb(p, u) <= 1);
}

/** Tiles a party skill would affect, for the preview. */
export function previewTiles(st: BattleState, u: Unit, id: string, t: Target): Pos[] {
  const sk = SKILLS[id];
  if (!sk) return [];
  if (sk.kind === 'lead' || sk.kind === 'upsun' || sk.kind === 'touch' || sk.kind === 'any') return skillTiles(st, u, sk, u, t.aim);
  if (sk.kind === 'place' && t.pos) {
    if (id === 'shade' || id === 'great_shade') { const out: Pos[] = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: t.pos.x + dx, y: t.pos.y + dy }); return out; }
    return [t.pos];
  }
  if (t.uid !== undefined) { const tu = st.units.find((x) => x.uid === t.uid); return tu ? [{ x: tu.x, y: tu.y }] : []; }
  return [];
}

export function useSkill(st: BattleState, u: Unit, id: string, t: Target): boolean {
  const sk = SKILLS[id];
  if (!sk || cantUse(st, u, id)) return false;
  u.acted = true;
  const tiles = previewTiles(st, u, id, t);
  emit(st, { k: 'skill', uid: u.uid, skill: id, tiles });
  switch (id) {
    case 'note': { const f = st.units.find((x) => x.uid === t.uid); if (f) f.noted = 1; break; }
    case 'raise': {
      st.lamps = st.lamps.filter((l) => l.owner !== u.uid);
      if (t.pos) st.lamps.push({ x: t.pos.x, y: t.pos.y, r: 3, lowness: 2, owner: u.uid, kind: 'lamp' });
      emit(st, { k: 'lamp', on: true });
      afterLightChange(st);
      break;
    }
    case 'hood': st.lamps = st.lamps.filter((l) => l.owner !== u.uid); emit(st, { k: 'lamp', on: false }); afterLightChange(st); break;
    case 'flare': {
      for (const l of st.lamps) for (const f of foes(st)) if (Math.hypot(f.x - l.x, f.y - l.y) <= l.r + 0.5) applyStatus(st, f, 'dazzled', 1);
      afterLightChange(st);
      break;
    }
    case 'warm': case 'recall': {
      const a = st.units.find((x) => x.uid === t.uid);
      if (a && a.alive) {
        const before = a.hp;
        if (id === 'warm') a.hp = Math.min(a.maxHp, a.hp + (sk.heal ?? 0) + u.pow);
        else a.hp = Math.min(a.maxHp, Math.max(a.hp, a.hpHistory[a.hpHistory.length - 2] ?? a.hp));
        emit(st, { k: 'heal', uid: a.uid, amt: a.hp - before });
      }
      break;
    }
    case 'license': for (const a of party(st)) { const b = a.hp; a.hp = Math.min(a.maxHp, a.hp + (sk.heal ?? 2)); a.status = {}; emit(st, { k: 'heal', uid: a.uid, amt: a.hp - b }); } break;
    case 'tug': case 'drag': {
      const f = st.units.find((x) => x.uid === t.uid);
      if (f) tugIntent(st, f, id === 'drag' ? 2 : 1, u);
      break;
    }
    case 'stab': {
      const f = st.units.find((x) => x.uid === t.uid);
      if (f) damage(st, f, strength(st, u, sk), u);
      break;
    }
    case 'slip': if (t.pos) { u.x = t.pos.x; u.y = t.pos.y; emit(st, { k: 'move', uid: u.uid, path: [t.pos] }); } break;
    case 'shade': case 'great_shade':
      st.shades = st.shades.filter((s) => s.owner !== u.uid);
      if (t.pos) st.shades.push({ x: t.pos.x, y: t.pos.y, r: 1, owner: u.uid, ttl: id === 'great_shade' ? 2 : 1 });
      afterLightChange(st);
      break;
    case 'pane': if (t.pos) st.panes.push({ x: t.pos.x, y: t.pos.y, owner: u.uid, ttl: 3 }); break;
    case 'listen': for (const f of foes(st)) if (cheb(f, u) <= 3) { f.status.revealed = 2; } ensurePlans(st); break;
    case 'snuff': {
      if (t.pos) {
        st.lamps = st.lamps.filter((l) => !(l.x === t.pos!.x && l.y === t.pos!.y && l.owner !== u.uid));
        for (const f of st.units) if (f.lantern && f.x === t.pos.x && f.y === t.pos.y) f.lantern.off = 2;
      }
      afterLightChange(st);
      break;
    }
    case 'wait': break;
    default: {
      if (sk.power !== undefined || entrySkill(id)) {
        hitTiles(st, u, sk, tiles, 'party');
        if (id === 'mirror_rule' && tiles.length) { const e = tiles[tiles.length - 1]; if (!unitAt(st, e.x, e.y)) st.panes.push({ x: e.x, y: e.y, owner: u.uid, ttl: 3 }); }
      }
    }
  }
  checkEnd(st);
  return true;
}

export function useItem(st: BattleState, u: Unit, use: { target: string; heal?: number; revive?: number; power?: number }, t: Target): boolean {
  u.acted = true;
  if (use.target === 'party') { for (const a of party(st)) { const b = a.hp; a.hp = Math.min(a.maxHp, a.hp + (use.heal ?? 0)); emit(st, { k: 'heal', uid: a.uid, amt: a.hp - b }); } }
  else if (use.target === 'adjacent' || use.target === 'self') {
    const a = st.units.find((x) => x.uid === (t.uid ?? u.uid));
    if (a && a.alive) { const b = a.hp; a.hp = Math.min(a.maxHp, a.hp + (use.heal ?? 0)); emit(st, { k: 'heal', uid: a.uid, amt: a.hp - b }); }
  } else if (use.target === 'down') {
    const a = st.units.find((x) => x.uid === t.uid);
    if (a && !a.alive && a.side === 'party') { a.alive = true; a.hp = use.revive ?? 4; emit(st, { k: 'heal', uid: a.uid, amt: a.hp }); }
  } else if (use.target === 'lead') {
    const l = leadOf(st, u);
    if (l) { const tiles = projectShape(st, u, l.dir, l.len, 'reach'); hitTiles(st, u, { ...SKILLS.toss, power: use.power }, tiles, 'party'); }
  }
  checkEnd(st);
  return true;
}

function tugIntent(st: BattleState, f: Unit, n: number, by: Unit) {
  if (f.fakes.length) { f.fakes = []; emit(st, { k: 'say', text: 'painted' }); return; }
  const it = f.queue[0];
  if (!it) return;
  // Drag away from Lot, the way a lead slides when its light moves.
  const dir = quantize(it.dest.x - by.x, it.dest.y - by.y);
  for (let k = 0; k < n; k++) {
    const x = it.dest.x + dir[0], y = it.dest.y + dir[1];
    if (isSolid(st, x, y) || (unitAt(st, x, y) && unitAt(st, x, y) !== f)) break;
    it.dest = { x, y };
  }
}

// ---- Foe intents ----

/** How many of a foe's planned moves the player can see: its lead length, at most 3. */
export function depthOf(st: BattleState, f: Unit): number {
  if ((f.status.revealed ?? 0) > 0) return Math.max(1, Math.min(3, leadOf(st, f)?.len ?? 1));
  if (st.dark && !lit(st, f.x, f.y)) return 0;
  const l = leadOf(st, f);
  if (!l) return 0;
  return Math.min(2, l.len);
}

export function visibleIntents(st: BattleState, f: Unit): Intent[] {
  if (!f.alive) return [];
  const d = depthOf(st, f);
  return f.queue.slice(0, d);
}

/** Recomputes plans after a light changes: newly visible moves get planned and shown. */
export function afterLightChange(st: BattleState) { ensurePlans(st); }

export function ensurePlans(st: BattleState) {
  for (const f of foes(st)) {
    if (f.decoyOf !== undefined || !f.skills.length) continue;
    const d = depthOf(st, f);
    if (d === 0) { f.queue = []; continue; }
    // A foe shows its next strike from where it stands. Once shown it is a promise and does not change.
    if (!f.queue[0] || !f.queue[0].skill) f.queue[0] = aimFrom(st, f, { x: f.x, y: f.y });
    // A long lead also shows where the foe will stand after that strike.
    if (d >= 2 && !f.queue[1] && f.move > 0) f.queue[1] = { dest: nextSpot(st, f, f.queue[0].dest), skill: '' };
    if (d < 2 && f.queue.length > 1) f.queue.length = 1;
  }
}

/** The tile within reach that brings a foe closest to striking a party member. */
function nextSpot(st: BattleState, f: Unit, from: Pos): Pos {
  const taken = claimed(st, f);
  const field = strikeField(st, f);
  const ps = party(st);
  let best = from, bestV = 1e9;
  // Simple critters walk straight at the nearest member. The rest work toward the tiles their strikes can reach from.
  const simple = f.ai === 'simple';
  for (const d of reachableFrom(st, f, from)) {
    if (taken.has(d.y * st.w + d.x) && (d.x !== from.x || d.y !== from.y)) continue;
    const near = Math.min(...ps.map((q) => Math.abs(q.x - d.x) + Math.abs(q.y - d.y)), 99);
    const v = simple
      ? near + (field[d.y * st.w + d.x] === 0 ? -0.5 : 0) + st.rng() * 0.6
      : field[d.y * st.w + d.x] * 3 + near * 0.2 + st.rng() * 0.3 - bestCover(st, f, d) * 0.8;
    if (v < bestV) { bestV = v; best = d; }
  }
  return best;
}

/**
 * How much of the party's set-feet room a strike covers: a member's own tile and the tiles one step away, from which
 * the member could still strike along its lead. Covering all of them means the member must take the hit or give up its strike.
 */
function coverage(st: BattleState, tiles: Pos[]): number {
  if (!tiles.length) return 0;
  const hit = new Set(tiles.map((p) => p.y * st.w + p.x));
  let v = 0;
  for (const q of party(st)) {
    let room = 0, n = 0;
    for (const d of DIR4) {
      const x = q.x + d[0], y = q.y + d[1];
      if (isSolid(st, x, y) || unitAt(st, x, y)) continue;
      room++;
      if (hit.has(y * st.w + x)) n++;
    }
    v += hit.has(q.y * st.w + q.x) ? 2 + n + (n === room ? 2 : 0) : n * 0.5;
  }
  return v;
}

/** The most set-feet room any of the foe's ranged strikes would cover from a tile. */
function bestCover(st: BattleState, f: Unit, at: Pos): number {
  const ghost: Unit = { ...f, x: at.x, y: at.y };
  let best = 0;
  for (const sid of f.skills) {
    const sk = SKILLS[sid];
    if (!sk || sk.power === undefined || (sk.kind !== 'lead' && sk.kind !== 'upsun' && sk.kind !== 'any')) continue;
    for (const aim of sk.kind === 'any' ? DIR8 : [undefined]) best = Math.max(best, coverage(st, skillTiles(st, ghost, sk, at, aim)));
  }
  return best;
}

/** Tiles other foes have already claimed as places to stand. */
function claimed(st: BattleState, except: Unit): Set<number> {
  const s = new Set<number>();
  for (const o of foes(st)) if (o !== except) for (const it of o.queue) s.add(it.dest.y * st.w + it.dest.x);
  return s;
}

/** The best attack from a fixed spot, for a move whose place was promised earlier. */
function aimFrom(st: BattleState, f: Unit, dest: Pos): Intent {
  const ghost: Unit = { ...f, x: dest.x, y: dest.y };
  let best: Intent = { dest, skill: f.skills[0] ?? 'wait' };
  let bestScore = -1e9;
  for (const sid of usableSkills(st, f)) {
    const sk = SKILLS[sid];
    if (!sk || sk.kind === 'self') continue;
    const aims: (Vec | undefined)[] = sk.kind === 'touch' || sk.kind === 'any' ? DIR8 : [undefined];
    for (const aim of aims) {
      let s = 0;
      const tiles = skillTiles(st, ghost, sk, dest, aim);
      for (const p of tiles) {
        const t = st.units.find((x) => x.alive && x.x === p.x && x.y === p.y && x !== f);
        if (!t) continue;
        const dmg = Math.max(1, (sk.power ?? 0) + f.pow - t.guard);
        s += t.side === 'party' ? dmg + (t.hp <= dmg ? 3 : 0) : -dmg * 0.6;
      }
      if (sk.kind !== 'touch' && sk.power !== undefined) s += coverage(st, tiles) * 0.5;
      if (s > bestScore) {
        bestScore = s;
        const tgt = sk.kind === 'touch' && aim ? unitAt(st, dest.x + aim[0], dest.y + aim[1]) : undefined;
        best = { dest, skill: sid, aim, target: tgt && tgt.side === 'party' ? tgt.uid : undefined };
      }
    }
  }
  return best;
}

function usableSkills(st: BattleState, f: Unit): string[] {
  return f.skills.filter((s) => {
    if (s === 'douse' || s === 'put_out' || s === 'sip') return st.lamps.length > 0;
    if (s === 'chomp') return true;
    return !!SKILLS[s];
  });
}

/** Walking distance from each tile to the nearest tile this foe could strike a party member from. */
function strikeField(st: BattleState, f: Unit): Int16Array {
  const dist = new Int16Array(st.w * st.h).fill(999);
  const q: number[] = [];
  const skills = f.skills.map((s) => SKILLS[s]).filter((s) => s && s.kind !== 'self' && s.kind !== 'foe' && s.kind !== 'ally' && s.kind !== 'place');
  for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
    if (isSolid(st, x, y)) continue;
    const ghost: Unit = { ...f, x, y };
    let hit = false;
    for (const sk of skills) {
      const aims: (Vec | undefined)[] = sk.kind === 'touch' || sk.kind === 'any' ? DIR8 : [undefined];
      for (const aim of aims) {
        for (const p of skillTiles(st, ghost, sk, { x, y }, aim)) { const t = unitAt(st, p.x, p.y); if (t && t.side === 'party') { hit = true; break; } }
        if (hit) break;
      }
      if (hit) break;
    }
    if (hit) { dist[y * st.w + x] = 0; q.push(y * st.w + x); }
  }
  while (q.length) {
    const c = q.shift()!;
    const cx = c % st.w, cy = (c / st.w) | 0;
    for (const d of DIR4) {
      const x = cx + d[0], y = cy + d[1];
      if (isSolid(st, x, y)) continue;
      const i = y * st.w + x;
      if (dist[i] <= dist[c] + 1) continue;
      dist[i] = dist[c] + 1;
      q.push(i);
    }
  }
  return dist;
}

/** Picks where a foe goes and what it does, scored against where the party stands now. */
function planIntent(st: BattleState, f: Unit, from: Pos, k = 0): Intent {
  const ps = party(st);
  const ghost: Unit = { ...f, x: from.x, y: from.y };
  const taken = claimed(st, f);
  const dests = reachableFrom(st, f, from).filter((d) => !taken.has(d.y * st.w + d.x) || (d.x === from.x && d.y === from.y));
  const skills = usableSkills(st, f);
  const field = strikeField(st, f);
  if (k >= 1) {
    // A later move promises only where the foe will stand. Its attack is chosen when it comes up next.
    let bestD = dests[0] ?? from, bestV = 1e9;
    for (const d of dests) {
      const v = field[d.y * st.w + d.x] * 3 + Math.min(...ps.map((p) => Math.abs(p.x - d.x) + Math.abs(p.y - d.y)), 99) * 0.2 + st.rng() * 0.3;
      if (v < bestV) { bestV = v; bestD = d; }
    }
    return { dest: bestD, skill: '' };
  }
  let best: { score: number; it: Intent }[] = [];
  const consider = (score: number, it: Intent) => { best.push({ score, it }); };
  for (const d of dests) {
    const sd = field[d.y * st.w + d.x];
    const near = sd >= 999 ? Math.min(...ps.map((p) => Math.abs(p.x - d.x) + Math.abs(p.y - d.y)), 99) : sd * 2.5;
    for (const sid of skills) {
      const sk = SKILLS[sid];
      if (!sk) continue;
      if (sk.kind === 'self') {
        let s = -1;
        if ((sid === 'douse' || sid === 'put_out' || sid === 'sip') && st.lamps.some((l) => cheb(l, d) <= 3)) s = 6;
        if (sid === 'chomp') s = st.lamps.some((l) => cheb(l, d) <= 3) ? 9 : adjacentParty(st, d) * 3;
        consider(s - near * 0.1, { dest: d, skill: sid });
        continue;
      }
      const aims: (Vec | undefined)[] = sk.kind === 'touch' || sk.kind === 'any' ? DIR8 : [undefined];
      for (const aim of aims) {
        const tiles = skillTiles(st, ghost, sk, d, aim);
        let s = 0;
        for (const p of tiles) {
          const t = st.units.find((x) => x.alive && x.x === p.x && x.y === p.y && x !== f);
          if (!t) continue;
          const dmg = Math.max(1, (sk.power ?? 0) + f.pow - t.guard);
          if (t.side === 'party') s += dmg + (t.hp <= dmg ? 3 : 0);
          else s -= dmg * 0.6;
        }
        if (sid === 'grab') {
          const last = ps.slice().sort((a, b) => (b.lastMoved ?? 0) - (a.lastMoved ?? 0))[0];
          if (last && tiles.some((p) => p.x === last.x && p.y === last.y)) s += 3;
        }
        consider(s * (k === 0 ? 1 : 0.85) - near * 0.12, { dest: d, skill: sid, aim });
      }
    }
  }
  if (!best.length) return { dest: from, skill: f.skills[0] ?? 'wait' };
  best.sort((a, b) => b.score - a.score);
  if (f.ai === 'wild' && best.length > 2 && st.rng() < 0.3) return best[Math.floor(st.rng() * Math.min(3, best.length))].it;
  return best[0].it;
}

function adjacentParty(st: BattleState, p: Pos): number { return party(st).filter((u) => cheb(u, p) <= 1).length; }

function reachableFrom(st: BattleState, f: Unit, from: Pos): Pos[] {
  if (f.move <= 0) return [from];
  const out: Pos[] = [from];
  const dist = new Map<number, number>([[from.y * st.w + from.x, 0]]);
  const q: Pos[] = [from];
  while (q.length) {
    const c = q.shift()!;
    const d0 = dist.get(c.y * st.w + c.x)!;
    if (d0 >= f.move) continue;
    for (const d of DIR4) {
      const x = c.x + d[0], y = c.y + d[1];
      const key = y * st.w + x;
      if (dist.has(key) || isSolid(st, x, y)) continue;
      const occ = unitAt(st, x, y);
      if (occ && occ !== f && occ.side === 'party') continue;
      dist.set(key, d0 + 1);
      q.push({ x, y });
      if (!occ || occ === f) out.push({ x, y });
    }
  }
  return out;
}

function paintFakes(st: BattleState) {
  for (const f of foes(st)) {
    if (!f.painter) continue;
    f.fakes = [];
    const ps = party(st);
    for (let i = 0; i < f.painter; i++) {
      const target = ps[Math.floor(st.rng() * ps.length)];
      if (!target) break;
      const dx = Math.floor(st.rng() * 3) - 1, dy = Math.floor(st.rng() * 3) - 1;
      f.fakes.push({ dest: { x: target.x + dx, y: target.y + dy }, skill: 'brushstroke', fake: true });
    }
  }
}

// ---- Rounds ----

export function startPartyPhase(st: BattleState) {
  for (const u of st.units) {
    u.acted = false; u.moved = false; u.startX = u.x; u.startY = u.y;
    u.hpHistory.push(u.hp);
    if (u.hpHistory.length > 4) u.hpHistory.shift();
  }
  paintFakes(st);
  ensurePlans(st);
}

/** Runs the foes' strikes, then their moves, then panes, heat, and statuses, and opens the next round. */
export function runFoePhase(st: BattleState) {
  emit(st, { k: 'phase', name: 'foes' });
  const reps = st.replays;
  st.replays = [];
  for (const r of reps) {
    const owner = st.units.find((x) => x.uid === r.owner);
    const sk = SKILLS[r.skill];
    if (!owner || !sk) continue;
    const tiles = projectShape(st, { x: r.x, y: r.y }, r.dir, r.len, sk.shape ?? 'line');
    emit(st, { k: 'skill', uid: owner.uid, skill: r.skill, tiles });
    hitTiles(st, owner, sk, tiles, owner.side);
  }
  const order = foes(st).filter((f) => f.decoyOf === undefined).sort((a, b) => a.order - b.order);
  const resting = (f: Unit) => !!f.slow && st.round % 2 === 0;
  // 1. Every shown strike lands, from wherever its lead now points.
  for (const f of order) {
    if (!f.alive || st.result) continue;
    if (f.lateNext) {
      const prev = f.lateNext;
      f.lateNext = null;
      const sk = SKILLS[prev.skill];
      if (sk) { const tiles = skillTiles(st, f, sk, f, prev.aim); emit(st, { k: 'skill', uid: f.uid, skill: prev.skill, tiles }); hitTiles(st, f, sk, tiles, 'foe'); }
      if (!f.alive || st.result) continue;
    }
    if (resting(f) || !f.skills.length) continue;
    const it = f.queue[0];
    if (it && it.skill) {
      strike(st, f, it);
      if (f.lateCopy && f.alive) f.lateNext = it;
    } else if (!it) {
      // Unforeseen: it moves and strikes in one go, with nothing shown ahead.
      const full = planIntent(st, f, { x: f.x, y: f.y });
      stepTo(st, f, full.dest);
      strike(st, f, { ...full, dest: { x: f.x, y: f.y } });
    }
    checkEnd(st);
  }
  // 2. Foes with leads walk into position. Their next strikes are chosen when the party's turn opens.
  for (const f of order) {
    if (!f.alive || st.result) continue;
    const ghost = f.queue[1];
    f.queue = [];
    f.committed = 0;
    if (resting(f) || f.move <= 0) continue;
    if (ghost) stepTo(st, f, ghost.dest);
    else if (depthOf(st, f) > 0) stepTo(st, f, nextSpot(st, f, { x: f.x, y: f.y }));
  }
  // The Great Lamp's beam burns the party members still standing in it.
  if (st.beam) for (const u of party(st)) if (beamCovers(st, u.x, u.y)) damage(st, u, 6 + u.guard, null);
  // Heat burns anyone standing on it in the open.
  for (const u of living(st)) if (st.heat[u.y * st.w + u.x] && !inShadeZone(st, u.x, u.y)) damage(st, u, 1 + u.guard, null);
  for (const u of st.units) {
    for (const k of Object.keys(u.status) as (keyof Unit['status'])[]) {
      const v = (u.status[k] ?? 0) - 1;
      if (v <= 0) {
        delete u.status[k];
        if (k === 'pinned') u.status.pinGuard = 1;
      } else u.status[k] = v;
    }
    if (u.lantern && u.lantern.off > 0) u.lantern.off--;
  }
  st.shades = st.shades.map((z) => ({ ...z, ttl: z.ttl - 1 })).filter((z) => z.ttl > 0);
  st.panes = st.panes.map((q) => ({ ...q, ttl: q.ttl - 1 })).filter((q) => q.ttl > 0);
  for (const b of foes(st)) if (b.boss && FOES[b.id]?.decoys) respawnDecoys(st, b);
  for (const b of foes(st)) if (b.boss && !b.addsDone && FOES[b.id]?.adds && b.hp <= b.maxHp / 2) callAdds(st, b);
  if (st.beam) st.beam.angle = nextBeamAngle(st);
  if (party(st).some((u) => u.hp <= u.maxHp / 3)) st.lowRounds++;
  checkEnd(st);
  st.round++;
  if (!st.result) startPartyPhase(st);
}

function stepTo(st: BattleState, f: Unit, to: Pos) {
  if (to.x === f.x && to.y === f.y) return;
  if (unitAt(st, to.x, to.y) || isSolid(st, to.x, to.y) || (f.status.pinned ?? 0) > 0) return;
  emit(st, { k: 'move', uid: f.uid, path: [{ x: f.x, y: f.y }, to] });
  f.x = to.x; f.y = to.y;
}

/** A foe's strike. Its origin is the intent's tile: the foe's own, unless Lot dragged it. */
function strike(st: BattleState, f: Unit, it: Intent) {
  const sk = SKILLS[it.skill];
  if (!sk) return;
  if (sk.kind === 'self') {
    if (it.skill === 'douse' || it.skill === 'put_out') {
      const l = st.lamps.slice().sort((a, b) => cheb(a, f) - cheb(b, f))[0];
      if (l && (it.skill === 'put_out' || cheb(l, f) <= 3)) { st.lamps = st.lamps.filter((x) => x !== l); emit(st, { k: 'lamp', on: false }); }
    } else if (it.skill === 'sip') {
      const l = st.lamps.slice().sort((a, b) => cheb(a, f) - cheb(b, f))[0];
      if (l && cheb(l, f) <= 3) l.r = Math.max(2, l.r - 1);
    } else if (it.skill === 'chomp') {
      const l = st.lamps.slice().sort((a, b) => cheb(a, f) - cheb(b, f))[0];
      if (l && cheb(l, f) <= 3) {
        st.lamps = st.lamps.filter((x) => x !== l);
        emit(st, { k: 'lamp', on: false });
        emit(st, { k: 'say', text: 'chomp' });
        f.slow = true;
        f.guard = Math.max(0, f.guard - 1);
      } else {
        const tiles = skillTiles(st, f, sk, f);
        emit(st, { k: 'skill', uid: f.uid, skill: it.skill, tiles });
        hitTiles(st, f, sk, tiles, 'foe');
      }
    }
    return;
  }
  const origin: Unit = { ...f, x: it.dest.x, y: it.dest.y };
  let tiles = skillTiles(st, origin, sk, it.dest, it.aim);
  if (sk.kind === 'touch' && it.target !== undefined) {
    const tgt = st.units.find((x) => x.uid === it.target && x.alive);
    if (tgt && cheb(tgt, origin) <= 1) tiles = [{ x: tgt.x, y: tgt.y }];
  }
  emit(st, { k: 'skill', uid: f.uid, skill: it.skill, tiles });
  const hit = hitTiles(st, f, sk, tiles, 'foe');
  if (f.noted && hit > 0 && sk.entry && !st.learned.includes(sk.id)) { st.learned.push(sk.id); emit(st, { k: 'note', skill: sk.id }); }
  f.noted = undefined;
}

/** A boss under half its HP calls the foes its sheet lists, once. They arrive near it and act from the next round. */
function callAdds(st: BattleState, b: Unit) {
  b.addsDone = true;
  const def = FOES[b.id];
  for (const id of def.adds ?? []) {
    const spots = reachableFrom(st, { ...b, move: 3 }, b).filter((p) => !unitAt(st, p.x, p.y) && (p.x !== b.x || p.y !== b.y));
    const s = spots[Math.floor(st.rng() * spots.length)];
    if (!s) break;
    const u = foeUnit(id, st.nextUid++, st.units.length + 1, st.difficulty);
    u.x = s.x; u.y = s.y;
    st.units.push(u);
  }
  if (def.addsText) emit(st, { k: 'say', text: def.addsText });
}

function respawnDecoys(st: BattleState, b: Unit) {
  const want = FOES[b.id]?.decoys ?? 0;
  const have = st.units.filter((d) => d.alive && d.decoyOf === b.uid).length;
  for (let i = have; i < want; i++) {
    const spots = reachableFrom(st, b, b).filter((p) => !unitAt(st, p.x, p.y) && (p.x !== b.x || p.y !== b.y));
    const s = spots[Math.floor(st.rng() * spots.length)];
    if (!s) break;
    st.units.push({ ...b, uid: st.nextUid++, x: s.x, y: s.y, hp: 1, maxHp: 1, decoyOf: b.uid, queue: [], fakes: [], boss: false, status: {}, hpHistory: [], height: 0, lantern: undefined });
  }
}

export function checkEnd(st: BattleState) {
  if (st.result) return;
  const fs = foes(st).filter((f) => f.decoyOf === undefined && !FOES[f.id]?.rootOf);
  if (!fs.length) { st.result = 'win'; return; }
  if (!party(st).filter((u) => !u.guest).length) st.result = 'lose';
}
