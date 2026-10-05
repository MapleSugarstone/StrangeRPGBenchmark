import { Battle, TraceRow } from '../battle/engine';
import { Action, BEvent, Unit } from '../battle/types';
import { hashStr, Rng } from '../core/rng';
import { ENEMIES, GROUPS } from '../data/enemies';
import { ITEMS } from '../data/items';
import { CALLINGS, CALLING_LVL, MEMBERS } from '../data/members';
import { addItem, buildUnit, GameState, gainXp, healAll, newMember, newState, writeBack } from '../game/state';
import { CAMPAIGN, ChapterPlan } from './campaign';
import { keyOf } from './legal';
import type { BattleRec } from './metrics';
import { braceSet, cleanHit, Ctx, Policy, POLICIES, Snap } from './policies';

const MAX_ACTIONS = 200;

export interface Result extends BattleRec { b: Battle; }
export interface Setup {
  units: Unit[]; enemies: string[]; seed: number; inv: Record<string, number>; mech: Set<string>;
  kept: string[]; known: Set<string>; pol: Policy; rewinds: number;
}

const names = (x: Action): string[] => (x.t === 'twin' ? [...names(x.a), ...names(x.b)] : [x.t === 'skill' ? x.skill : x.t]);

// Runs one battle the way the battle scene does: snapshots per party command, Rewind restores the previous one.
export function playBattle(s: Setup): Result {
  const b = new Battle(s.units, s.enemies, { seed: s.seed, inv: s.inv, mech: s.mech, kept: s.kept, rewinds: s.rewinds, canFlee: false });
  const ctx: Ctx = { kept: s.kept, known: s.known, rng: new Rng(s.seed ^ 0x9e3779b1), snaps: [], avoid: new Set() };
  const counts: Record<string, number> = {};
  let kos = 0, rewound = 0, resume: number | null = null;
  const tally = (evs: BEvent[]) => { for (const e of evs) if (e.k === 'ko' && b.get(e.uid)?.side === 0) kos++; };
  for (let g = 0; g < 4000 && !b.outcome && b.trace.length < MAX_ACTIONS; g++) {
    const resumed = resume !== null;
    let uid: number;
    if (resume !== null) { uid = resume; resume = null; } else {
      const r = b.beginTurn();
      tally(r.events);
      if (!r.actor) break;
      if (!r.canAct) continue;
      uid = r.actor.uid;
    }
    const a = b.get(uid)!;
    if (a.side === 1) {
      const act = b.planEnemy(a);
      tally(b.perform(a, act, { braced: braceSet(b, act, s.pol.rate, ctx.rng) }));
      continue;
    }
    let snap: Snap;
    if (resumed) snap = ctx.snaps[ctx.snaps.length - 1];
    else {
      snap = { snap: b.snapshot(), uid, p: b.hpFrac(0), alive: b.party().length, kos, tried: new Set() };
      ctx.snaps.push(snap);
      if (ctx.snaps.length > 30) ctx.snaps.shift();
    }
    ctx.avoid = snap.tried;
    let ch = s.pol.choose(b, a, ctx);
    if (ch.t === 'rewind') {
      if (ctx.snaps.length >= 2 && b.rewinds > 0) {
        ctx.snaps.pop();
        const prev = ctx.snaps[ctx.snaps.length - 1];
        const left = b.rewinds - 1;
        b.restore(prev.snap);
        b.rewinds = left;
        kos = prev.kos;
        resume = prev.uid;
        rewound++;
        continue;
      }
      ch = { t: 'attack', target: b.foes()[0].uid };
    }
    snap.tried.add(keyOf(ch));
    for (const n of names(ch)) counts[n] = (counts[n] ?? 0) + 1;
    tally(b.perform(b.get(uid)!, ch, { clean: cleanHit(b, ch, s.pol.rate, ctx.rng) }));
  }
  return { b, win: b.outcome === 'win', trace: b.trace.slice() as TraceRow[], kos, counts, rewinds: rewound };
}

export const unitsOf = (st: GameState): Unit[] => [
  ...st.party.map((id) => buildUnit(st.roster[id])),
  ...Object.values(st.roster).filter((m) => !st.party.includes(m.id)).map((m) => buildUnit(m, true)),
];

// Number of distinct action types the active party can choose from, for entropy normalization.
export function kindsOf(sv: Saved): number {
  const st: GameState = JSON.parse(sv.state);
  const ids = new Set(['attack', 'guard']);
  for (const u of unitsOf(st)) if (!u.bench) for (const k of [...u.skills, ...(u.skills2 ?? [])]) ids.add(k);
  for (const m of ['answer', 'line']) if (sv.mech.includes(m)) ids.add(m);
  if (Object.keys(st.inv).some((k) => ITEMS[k]?.battle && st.inv[k] > 0)) ids.add('item');
  return ids.size;
}

export interface Saved { state: string; kept: string[]; known: string[]; mech: string[]; }
export interface BossRun { group: string; enemies: string[]; saved: Saved; lvl: number; bossLvl: number; }
export interface ChapterRun {
  plan: ChapterPlan; fights: BattleRec[]; retries: number; stuck: number; bosses: BossRun[];
  actions: number; count: number; newEnemies: number; newMembers: number;
}

const rewindsOf = (st: GameState, m: Set<string>) => (m.has('rewind') ? 1 + ((st.roster.again?.lvl ?? 0) >= 15 ? 1 : 0) : 0);
const coatScore = (id: string) => (ITEMS[id]?.mods?.grd ?? 0) * 2 + (ITEMS[id]?.mods?.hp ?? 0) / 4;

// Buys in list order what is affordable and useful. Returns the ids left unbought.
function shop(st: GameState, list: string[], warn: (m: string) => void): string[] {
  const left: string[] = [];
  for (const id of list) {
    const it = ITEMS[id];
    if (!it) { warn(`Shop item "${id}" is not defined and was skipped.`); continue; }
    if (it.kind === 'key') continue;
    let ok = false;
    if (st.pleas >= it.price) {
      const party = st.party.map((p) => st.roster[p]).filter(Boolean);
      if (it.kind === 'use') { addItem(st, id); ok = true; }
      else if (it.kind === 'weapon') {
        const m = it.who ? st.roster[it.who] : undefined;
        if (m && (it.atk ?? 0) > (ITEMS[m.weapon]?.atk ?? 0)) { m.weapon = id; ok = true; }
      } else if (it.kind === 'coat') {
        const w = party.reduce((a, c) => (coatScore(c.coat) < coatScore(a.coat) ? c : a));
        if (coatScore(id) > coatScore(w.coat)) { w.coat = id; ok = true; }
      } else if (it.kind === 'charm') {
        const m = party.find((c) => c.charms.includes(null));
        if (m) { m.charms[m.charms.indexOf(null)] = id; ok = true; }
      }
    }
    if (ok) st.pleas -= it.price; else left.push(id);
  }
  return left;
}

function applyWin(st: GameState, b: Battle) {
  st.inv = { ...b.inv };
  for (const k of Object.keys(st.inv)) if (st.inv[k] <= 0) delete st.inv[k];
  writeBack(st, b.units);
  const r = b.rewards();
  st.pleas += r.pleas;
  for (const d of r.drops) addItem(st, d);
  for (const id of b.answered) if (!st.kept.includes(id) && ENEMIES[id]?.kept) st.kept.push(id);
  for (const u of b.partyAll()) if (!u.alive && st.roster[u.id]) st.roster[u.id].hp = 1;
  gainXp(st, r.xp);
  // Members pick a Calling as soon as they reach it, half one way and half the other across members.
  for (const m of Object.values(st.roster)) if (!m.calling && m.lvl >= CALLING_LVL && CALLINGS[m.id]) m.calling = CALLINGS[m.id][hashStr(m.id + st.wish) % 2].id;
  const worn = new Set(Object.values(st.roster).flatMap((m) => m.charms));
  for (const id of st.kept) {
    const k = ENEMIES[id].kept;
    const m = Object.values(st.roster).find((x) => st.party.includes(x.id) && x.charms.includes(null));
    if (m && (k?.mods || k?.resist) && !worn.has('kept:' + id)) m.charms[m.charms.indexOf(null)] = 'kept:' + id;
  }
}

function mechFor(plan: ChapterPlan, st: GameState, extra: string[] = []): Set<string> {
  const m = new Set([...plan.mech, ...extra]);
  if (plan.hush) m.add('hush');
  if (!st.roster.again) m.delete('rewind');
  return m;
}

// Plays the whole campaign with the casual policy and saves the state in front of every boss.
export function walk(seed: number, warn: (m: string) => void): ChapterRun[] {
  const rng = new Rng(seed);
  let st = newState('walker');
  const known = new Set<string>(), seenE = new Set<string>(), seenM = new Set(['hello']), warned = new Set<string>();
  const out: ChapterRun[] = [];
  const avg = () => Math.max(1, Math.round(Object.values(st.roster).reduce((s, m) => s + m.lvl, 0) / Math.max(1, Object.keys(st.roster).length)));
  const partyLvl = () => st.party.reduce((s, id) => s + st.roster[id].lvl, 0) / st.party.length;
  const groupOf = (g: string): string[] | null => {
    const e = GROUPS[g] ?? [g];
    if (e.every((id) => ENEMIES[id])) return e;
    if (!warned.has(g)) { warned.add(g); warn(`Group or enemy "${g}" is missing from GROUPS or ENEMIES and was skipped.`); }
    return null;
  };
  for (const plan of CAMPAIGN) {
    const leaves = plan.leaves ?? [];
    for (const id of leaves) delete st.roster[id];
    const want = [...plan.party, ...Object.keys(plan.joins ?? {})].filter((id, i, a) => a.indexOf(id) === i && !leaves.includes(id));
    for (const id of want) {
      if (!MEMBERS[id]) { if (!warned.has(id)) { warned.add(id); warn(`Member "${id}" is not defined and was skipped.`); } continue; }
      if (!st.roster[id]) st.roster[id] = newMember(id, plan.joins?.[id] || avg(), plan.n);
    }
    st.party = want.filter((id) => st.roster[id]).slice(0, 4);
    if (!st.party.length) st.party = ['hello'];
    const fresh = st.party.filter((id) => !seenM.has(id));
    fresh.forEach((id) => seenM.add(id));
    healAll(st);
    let left = shop(st, plan.shop, warn);
    const run: ChapterRun = { plan, fights: [], retries: 0, stuck: 0, bosses: [], actions: 0, count: 0, newEnemies: 0, newMembers: fresh.length };
    const novel = (e: string[]) => { for (const id of e) if (!seenE.has(id)) { seenE.add(id); run.newEnemies++; } };
    const go = (enemies: string[], m: Set<string>): BattleRec | null => {
      for (let t = 0; t < 5; t++) {
        const pre = JSON.stringify(st);
        const r = playBattle({ units: unitsOf(st), enemies, seed: rng.int(0x7fffffff), inv: { ...st.inv }, mech: m, kept: st.kept, known, pol: POLICIES.casual, rewinds: rewindsOf(st, m) });
        for (const u of r.b.units) if (u.side === 1 && u.listened) known.add(u.id);
        if (r.win) { applyWin(st, r.b); run.actions += r.trace.length; run.count++; return r; }
        st = JSON.parse(pre);
        run.retries++;
      }
      run.stuck++;
      st.pleas += enemies.reduce((s, id) => s + ENEMIES[id].pleas, 0);
      gainXp(st, enemies.reduce((s, id) => s + ENEMIES[id].xp, 0));
      return null;
    };
    const groups = plan.fights.flatMap((f) => { const e = groupOf(f.group); return e ? Array.from({ length: f.n }, () => e) : []; });
    rng.shuffle(groups);
    const rests = new Set(Array.from({ length: plan.rests }, (_, i) => Math.floor((groups.length * (i + 1)) / (plan.rests + 1))));
    groups.forEach((e, i) => {
      novel(e);
      if (i > 0 && rests.has(i)) healAll(st);
      const r = go(e, mechFor(plan, st));
      if (r) run.fights.push(r);
    });
    for (const bs of plan.bosses) {
      const e = groupOf(bs.group);
      if (!e) continue;
      novel(e);
      healAll(st);
      left = shop(st, left, warn);
      for (const id of e) { const n = ENEMIES[id].needItem; if (n && !st.inv[n]) st.inv[n] = 1; }
      const m = mechFor(plan, st, bs.mech);
      const saved: Saved = { state: JSON.stringify(st), kept: [...st.kept], known: [...known], mech: [...m] };
      run.bosses.push({ group: bs.group, enemies: e, saved, lvl: partyLvl(), bossLvl: Math.max(...e.map((id) => ENEMIES[id].lvl)) });
      go(e, m);
    }
    out.push(run);
  }
  return out;
}

export interface Variant { name: string; pol: Policy; drop?: string; }

// One Monte Carlo trial from a saved boss state. `drop` removes a mechanic flag or, failing that, a skill.
export function trial(sv: Saved, enemies: string[], v: Variant, seed: number): Result {
  const st: GameState = JSON.parse(sv.state);
  const mech = new Set(sv.mech), known = new Set(sv.known);
  const units = unitsOf(st);
  if (v.drop) {
    if (mech.has(v.drop)) mech.delete(v.drop);
    else {
      for (const u of units) { u.skills = u.skills.filter((k) => k !== v.drop); u.skills2 = u.skills2?.filter((k) => k !== v.drop); }
      known.clear();
    }
  }
  return playBattle({ units, enemies, seed, inv: { ...st.inv }, mech, kept: st.kept, known, pol: v.pol, rewinds: rewindsOf(st, mech) });
}

export function variantsFor(plan: ChapterPlan): Variant[] {
  const P = POLICIES;
  return [
    { name: 'smart', pol: P.smart }, { name: 'casual', pol: P.casual }, { name: 'mash', pol: P.mash },
    { name: 'random', pol: P.random }, { name: 'attack', pol: P.attack },
    { name: 'smart-noMech', pol: P.smart, drop: plan.newMechanic }, { name: 'casual-noMech', pol: P.casual, drop: plan.newMechanic }, { name: 'smart-noTiming', pol: P.smart, drop: 'timed' },
  ];
}

export const trialSeed = (base: number, ch: number, boss: number, v: string, i: number) => hashStr(`${base}:${ch}:${boss}:${v}:${i}`);
