// Builds a battle from an arena, the party, and a foe group. The game and the simulator share this.
import type { BattleState, Pos, Unit, Vec } from './types';
import { makeRng, startPartyPhase, isSolid, unitAt } from './rules';
import { GROUPS } from '../content/foes';
import { MEMBERS, statsAt, skillsAt } from '../content/party';
import { ITEMS } from '../content/items';
import { foeUnit } from './units';

export { foeUnit };

export interface ArenaSpec {
  w: number;
  h: number;
  solid: Uint8Array;
  heat: Uint8Array;
  sun: { dir: Vec; lowness: number } | null;
  dark: boolean;
  partyAt: Pos;
  foeAt: Pos;
}

export interface PartyEntry { id: string; level: number; hp: number; gear: string | null; entries?: string[]; guest?: boolean }

export function memberUnit(p: PartyEntry, uid: number): Unit {
  const s = statsAt(p.id, p.level);
  const g = p.gear ? ITEMS[p.gear]?.gear : undefined;
  const maxHp = s.maxHp + (g?.hp ?? 0);
  const skills = skillsAt(p.id, p.level);
  if (p.id === 'nodus' && p.entries) skills.push(...p.entries);
  return {
    uid, id: p.id, side: 'party', name: MEMBERS[p.id]?.name ?? p.id, x: 0, y: 0,
    hp: Math.max(1, Math.min(maxHp, p.hp)), maxHp,
    pow: s.pow + (g?.pow ?? 0), guard: s.guard + (g?.guard ?? 0), move: Math.max(1, s.move + (g?.move ?? 0)), height: Math.max(0, s.height + (g?.height ?? 0)),
    skills, status: {}, queue: [], fakes: [], acted: false, moved: false, startX: 0, startY: 0, alive: true, order: 0, ai: 'player', xp: 0, mites: 0, hpHistory: [],
    unled: p.id === 'tik', shadeOnly: p.id === 'lot', straight: p.id === 'umbraculum', guest: p.guest,
  };
}

function freeNear(st: BattleState, at: Pos, taken: Set<number>, side: 'party' | 'foe'): Pos {
  const seen = new Set<number>();
  const q: Pos[] = [at];
  while (q.length) {
    const c = q.shift()!;
    const k = c.y * st.w + c.x;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!isSolid(st, c.x, c.y) && !taken.has(k) && !unitAt(st, c.x, c.y)) return c;
    const dirs: Vec[] = side === 'party' ? [[-1, 0], [0, 1], [0, -1], [1, 0]] : [[1, 0], [0, -1], [0, 1], [-1, 0]];
    for (const d of dirs) { const x = c.x + d[0], y = c.y + d[1]; if (x >= 0 && y >= 0 && x < st.w && y < st.h) q.push({ x, y }); }
  }
  return at;
}

export function buildBattle(arena: ArenaSpec, members: PartyEntry[], group: string, seed: number, difficulty: number): BattleState {
  const g = GROUPS[group] ?? { foes: ['pebbler'] };
  const st: BattleState = {
    w: arena.w, h: arena.h, solid: arena.solid, heat: arena.heat, dark: arena.dark || g.light === 'dark',
    sun: g.light === 'dark' ? null : arena.sun, beam: null, lamps: [], panes: [], shades: [], replays: [], units: [], round: 1,
    rng: makeRng(seed), events: [], result: null, group, learned: [], turnedHits: 0, lowRounds: 0, difficulty, nextUid: 1,
  };
  const taken = new Set<number>();
  for (const m of members) {
    const u = memberUnit(m, st.nextUid++);
    const p = freeNear(st, arena.partyAt, taken, 'party');
    u.x = p.x; u.y = p.y;
    taken.add(p.y * st.w + p.x);
    st.units.push(u);
  }
  g.foes.forEach((id, i) => {
    const u = foeUnit(id, st.nextUid++, i + 1, difficulty);
    const p = freeNear(st, arena.foeAt, taken, 'foe');
    u.x = p.x; u.y = p.y;
    taken.add(p.y * st.w + p.x);
    st.units.push(u);
  });
  // The Heliotrope's roots sit beside it.
  const helio = st.units.find((u) => u.id === 'heliotrope');
  if (helio) {
    const roots = st.units.filter((u) => u.id === 'heliroot');
    const spots: Vec[] = [[-1, 1], [1, 1], [0, 1], [-1, 0]];
    roots.forEach((r, i) => {
      for (let j = i; j < spots.length; j++) {
        const x = helio.x + spots[j][0], y = helio.y + spots[j][1];
        if (!isSolid(st, x, y) && !unitAt(st, x, y)) { r.x = x; r.y = y; break; }
      }
    });
  }
  // The Great Lamp's beam starts pointing at the party.
  const lamp = st.units.find((u) => u.id === 'greatlamp');
  if (lamp && g.light === 'beam') {
    st.beam = { x: lamp.x, y: lamp.y, angle: Math.atan2(arena.partyAt.y - lamp.y, arena.partyAt.x - lamp.x), lowness: 3 };
  }
  // In the dark the party carries one light, set beside them.
  if (st.dark && members.some((m) => m.id === 'nodus') && arena.dark) {
    const n = st.units.find((u) => u.id === 'nodus');
    if (n) st.lamps.push({ x: n.x, y: n.y, r: 3, lowness: 2, owner: n.uid, kind: 'lamp' });
  }
  startPartyPhase(st);
  return st;
}
