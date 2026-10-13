// Fun and balance playtest: four scripted players play every chapter in story order and the report flags fights that are
// impossible, toothless, grindy, or stale. Usage: node dist-tools/playtest.js [runs] [--out file.md]
import {
  newBattle, doMove, doAction, doVorn, doLb, enemyPhase, endRound, pilgrimSkips, overloaded, faded, result,
  pilgrimActions, moveOptions, targetsFor, liveFoes, adjacent, total, maxTotal, vornActions, vornTargets,
  type Battle, type Act, type MoveOpt, type Ev,
} from '../battle/engine';
import { pilgrimMove, pilgrimAct, vornChoice, lbChoice } from '../battle/policy';
import { GROUPS, ENEMIES } from '../battle/enemies';
import { STAGES, CHAPTER_NAME, SCRIPTED, party, fmaxAt, type Stage } from '../battle/campaign';
import { Rng } from '../battle/rng';
import type { ActionId, PartyIn } from '../battle/model';

declare const process: { argv: string[]; hrtime: { bigint(): bigint } };
interface Plan { move: MoveOpt | null; actFn: () => Act }

type Profile = 'novice' | 'competent' | 'expert' | 'spam';
const PROFILES: Profile[] = ['novice', 'competent', 'expert', 'spam'];

// ---------- Players ----------

function okAct(b: Battle, id: ActionId): boolean { return !!pilgrimActions(b).find(a => a.id === id && a.ok); }

/** Walks at the nearest enemy and hits the first one it can reach. Absorbs a memory only when nearly gone. */
function novice(b: Battle): Plan {
  const live = liveFoes(b);
  let move: MoveOpt | null = null;
  if (live.length && !live.some(f => adjacent(b, f))) {
    const near = live.reduce((a, c) => (Math.abs(c.cell - b.p.cell) < Math.abs(a.cell - b.p.cell) ? c : a));
    move = moveOptions(b).filter(m => m.kind === 'walk').sort((x, y) => Math.abs(near.cell - x.to) - Math.abs(near.cell - y.to))[0] || null;
  }
  const after = () => {
    const mem = b.p.hand.findIndex(c => c.layer === 'memory');
    if (b.p.f < b.p.fmax * 0.2 && mem >= 0 && okAct(b, 'absorb')) return { id: 'absorb', concept: mem } as Act;
    for (const id of ['strip', 'extract_memory', 'extract_emotion', 'extract_name', 'unmake'] as ActionId[]) {
      if (!okAct(b, id)) continue;
      const t = targetsFor(b, id).sort((x, y) => x.cell - y.cell)[0];
      if (t && (id !== 'unmake' || t.def.boss)) return { id, target: t.uid };
    }
    return { id: 'hold' } as Act;
  };
  return { move, actFn: after };
}

/** Strips the nearest enemy every turn and never does anything else: the dominant-strategy check. */
function spam(b: Battle): Plan {
  const live = liveFoes(b);
  let move: MoveOpt | null = null;
  if (live.length && !live.some(f => adjacent(b, f))) {
    const near = live.reduce((a, c) => (Math.abs(c.cell - b.p.cell) < Math.abs(a.cell - b.p.cell) ? c : a));
    move = moveOptions(b).filter(m => m.kind === 'walk').sort((x, y) => Math.abs(near.cell - x.to) - Math.abs(near.cell - y.to))[0] || null;
  }
  const after = () => {
    if (okAct(b, 'strip')) return { id: 'strip', target: targetsFor(b, 'strip')[0].uid } as Act;
    if (okAct(b, 'unmake')) { const t = targetsFor(b, 'unmake').find(f => f.def.boss); if (t) return { id: 'unmake', target: t.uid } as Act; }
    for (const id of ['extract_memory', 'extract_emotion', 'extract_name'] as ActionId[]) if (okAct(b, id)) return { id, target: targetsFor(b, id)[0].uid } as Act;
    return { id: 'hold' } as Act;
  };
  return { move, actFn: after };
}

// The expert looks one round ahead: it tries every move and action on copies of the battle with fresh dice.
const SHARED = new Set(['def', 'worn', 'move', 'shell']);
function clone<T>(v: T, seen = new Map<unknown, unknown>()): T {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v) as T;
  if (v instanceof Map) { const m = new Map(); seen.set(v, m); for (const [k, x] of v) m.set(k, clone(x, seen)); return m as T; }
  if (v instanceof Set) { const s = new Set(); seen.set(v, s); for (const x of v) s.add(clone(x, seen)); return s as T; }
  if (Array.isArray(v)) { const a: unknown[] = []; seen.set(v, a); for (const x of v) a.push(clone(x, seen)); return a as T; }
  const o = Object.create(Object.getPrototypeOf(v)) as Record<string, unknown>;
  seen.set(v, o);
  for (const k of Object.keys(v as object)) o[k] = SHARED.has(k) ? (v as Record<string, unknown>)[k] : clone((v as Record<string, unknown>)[k], seen);
  return o as T;
}

function band(fr: number): number {
  if (fr <= 0) return -1000;
  if (fr < 0.25) return -200 + fr * 800;
  if (fr <= 0.78) return fr * 80;
  return 62 - (fr - 0.78) * 400;
}

function score(b: Battle): number {
  if (b.outcome === 'win' || b.outcome === 'choice') return 1e6 + b.p.f;
  if (b.outcome === 'lose') return -1e6;
  let s = 0;
  for (const f of b.foes) s += f.gone ? 130 : (1 - total(f) / Math.max(1, maxTotal(f))) * 100;
  s += band(b.p.f / b.p.fmax) * 1.5;
  if (b.vorn) s += b.vorn.down ? -60 : (b.vorn.hp / b.vorn.max) * 20;
  if (b.lb) s += b.lb.down ? -30 : 0;
  s += b.p.hand.length * 4;
  return s;
}

function actsFor(b: Battle): Act[] {
  const out: Act[] = [];
  for (const a of pilgrimActions(b)) {
    if (!a.ok) continue;
    if (a.target === 'adj' || a.target === 'any') for (const t of targetsFor(b, a.id)) out.push({ id: a.id, target: t.uid });
    else if (a.target === 'concept') b.p.hand.forEach((c, i) => { out.push({ id: 'absorb', concept: i }); if (c.layer !== 'name') for (const t of liveFoes(b)) out.push({ id: 'absorb', concept: i, target: t.uid, push: true }); });
    else if (a.target === 'two') {
      const t = liveFoes(b)[0];
      for (let i = 0; i < b.p.hand.length; i++) for (let j = i + 1; j < Math.min(b.p.hand.length, 4); j++) out.push({ id: 'weave', concepts: [i, j], target: t?.uid });
    } else out.push({ id: a.id });
  }
  return out;
}

function restOfRound(b: Battle): void {
  if (!b.outcome && b.vorn && !b.vorn.down) { const c = vornChoice(b); doVorn(b, c.id, c.target); }
  if (!b.outcome && b.lb && !b.lb.down) { const c = lbChoice(b); doLb(b, c.id, { dish: c.dish, target: (c as { target?: number }).target }); }
  if (!b.outcome) enemyPhase(b);
  if (!b.outcome) endRound(b);
}

let lookSeed = 1;
function expert(b: Battle): { move: MoveOpt | null; act: Act } {
  let best: { move: MoveOpt | null; act: Act; s: number } | null = null;
  const moves: (MoveOpt | null)[] = [null, ...moveOptions(b)];
  for (const m of moves) {
    const base = clone(b);
    if (m) doMove(base, m);
    if (base.outcome) continue;
    for (const act of actsFor(base)) {
      let s = 0;
      for (let k = 0; k < 2; k++) {
        const c = clone(base);
        c.rng = new Rng(lookSeed++ * 2654435761);
        doAction(c, act);
        restOfRound(c);
        s += score(c);
      }
      if (!best || s > best.s) best = { move: m, act, s };
    }
  }
  return best ? { move: best.move, act: best.act } : { move: null, act: { id: 'hold' } };
}

// ---------- One fight ----------

interface FightStats {
  win: boolean; rounds: number; minF: number; startF: number; endF: number; over: number; faded: number;
  acts: Map<string, number>; moves: number; breadth: number; turns: number; taken: number; vtaken: number; foeMoves: Set<string>; vornDown: boolean;
}

function play(b: Battle, who: Profile): FightStats {
  const st: FightStats = {
    win: false, rounds: 0, minF: b.p.f / b.p.fmax, startF: b.p.f / b.p.fmax, endF: 0, over: 0, faded: 0,
    acts: new Map(), moves: 0, breadth: 0, turns: 0, taken: 0, vtaken: 0, foeMoves: new Set(), vornDown: false,
  };
  const note = (evs: Ev[]) => {
    for (const e of evs) {
      if (e.t === 'hurt' && e.who === 'pilgrim') st.taken += e.amount;
      if (e.t === 'hurt' && e.who === 'vorn' && b.vorn) st.vtaken += e.amount / b.vorn.max;
      if (e.t === 'act' && typeof e.who === 'number') st.foeMoves.add(e.name);
    }
    st.minF = Math.min(st.minF, b.p.f / b.p.fmax);
  };
  while (!b.outcome && b.round < 60) {
    if (!pilgrimSkips(b)) {
      st.turns++;
      st.breadth += pilgrimActions(b).filter(a => a.ok && a.id !== 'hold').length;
      let move: MoveOpt | null, act: Act;
      if (who === 'competent') { move = pilgrimMove(b); if (move) note(doMove(b, move)); act = pilgrimAct(b); }
      else if (who === 'expert') { const c = expert(b); move = c.move; if (move) note(doMove(b, move)); act = c.act; }
      else {
        const c = who === 'novice' ? novice(b) : spam(b);
        move = c.move; if (move) note(doMove(b, move)); act = c.actFn();
      }
      if (move) { st.moves++; st.acts.set('move:' + move.kind, (st.acts.get('move:' + move.kind) || 0) + 1); }
      st.acts.set(act.id, (st.acts.get(act.id) || 0) + 1);
      note(doAction(b, act));
    }
    if (!b.outcome && b.vorn && !b.vorn.down) {
      const c = who === 'novice' || who === 'spam'
        ? (vornActions(b).find(a => a.id === 'cleave' && a.ok) ? { id: 'cleave' as const, target: vornTargets(b, 'cleave')[0]?.uid } : { id: 'guard' as const })
        : vornChoice(b);
      note(doVorn(b, c.id, c.target));
    }
    if (!b.outcome && b.lb && !b.lb.down) {
      const c = who === 'novice' || who === 'spam'
        ? (b.p.f < b.p.fmax * 0.3 && b.lb.pantry.ravioli > 0 ? { id: 'cook' as const, dish: 'ravioli' as const } : { id: 'cheer' as const, dish: undefined })
        : lbChoice(b);
      note(doLb(b, c.id, { dish: c.dish, target: (c as { target?: number }).target }));
    }
    if (!b.outcome) note(enemyPhase(b));
    if (!b.outcome) note(endRound(b));
    if (overloaded(b)) st.over++;
    if (faded(b)) st.faded++;
    if (b.vorn?.down) st.vornDown = true;
  }
  st.win = b.outcome === 'win' || b.outcome === 'choice';
  st.rounds = b.round;
  st.endF = b.p.f / b.p.fmax;
  return st;
}

// ---------- The campaign ----------

interface Row {
  stage: Stage; group: string; boss: boolean; mini: boolean; firstWin: number; pass: number; tries: number; rounds: number;
  drop: number; minF: number; over: number; faded: number; distinct: number; entropy: number; moves: number; breadth: number;
  taken: number; vtaken: number; foeMoves: number; vornDown: number; acts: Map<string, number>; n: number;
}

function entropy(m: Map<string, number>): number {
  const tot = [...m.values()].reduce((a, c) => a + c, 0);
  let h = 0;
  for (const v of m.values()) { const p = v / tot; h -= p * Math.log2(p); }
  return h;
}

function campaign(who: Profile, runs: number): Row[] {
  const rows = new Map<string, Row>();
  for (let r = 0; r < runs; r++) {
    let seed = 1000 + r * 7919;
    for (const st of STAGES) {
      const base = party(st);
      let f = base.f, vornHp = base.vorn?.hp ?? 0, lbHp = base.lb?.hp ?? 0, pantry = base.lb ? { ...base.lb.pantry } : null, memories = 0;
      const fm = fmaxAt(st);
      for (const g of st.groups) {
        const key = st.name + ':' + g;
        let row = rows.get(key);
        if (!row) {
          const defs = GROUPS[g].map(id => ENEMIES[id.split('@')[0]]);
          row = { stage: st, group: g, boss: defs.some(d => d.boss), mini: defs.some(d => d.up && !d.boss), firstWin: 0, pass: 0, tries: 0, rounds: 0, drop: 0, minF: 0, over: 0, faded: 0, distinct: 0, entropy: 0, moves: 0, breadth: 0, taken: 0, vtaken: 0, foeMoves: 0, vornDown: 0, acts: new Map(), n: 0 };
          rows.set(key, row);
        }
        const heal = who === 'novice' ? 0.2 : 0.35;
        while (memories > 0 && f < fm * heal) { f = Math.min(fm, f + Math.round(fm * 0.25)); memories--; }
        let won = false, tries = 0, last: FightStats | null = null;
        while (!won && tries < 3) {
          tries++;
          const p: PartyIn = { ...base, f, vorn: base.vorn ? { ...base.vorn, hp: vornHp } : null, lb: base.lb ? { ...base.lb, hp: lbHp, pantry: { ...pantry! } } : null };
          const b = newBattle(GROUPS[g], p, { seed: seed++, scripted: SCRIPTED[g] });
          last = play(b, who);
          if (tries === 1) {
            row.n++;
            if (last.win) row.firstWin++;
            row.rounds += last.rounds; row.drop += Math.max(0, last.startF - last.minF); row.minF += last.minF;
            row.over += last.over; row.faded += last.faded; const verbs = new Map([...last.acts].filter(([k]) => !k.startsWith('move:'))); row.distinct += verbs.size; row.entropy += entropy(verbs);
            row.moves += last.moves; row.breadth += last.breadth / Math.max(1, last.turns); row.taken += last.taken / Math.max(1, last.rounds) / fm; row.vtaken += last.vtaken / Math.max(1, last.rounds);
            row.foeMoves += last.foeMoves.size; row.vornDown += last.vornDown ? 1 : 0;
            for (const [k, v] of last.acts) row.acts.set(k, (row.acts.get(k) || 0) + v);
          }
          if (last.win) {
            won = true;
            const res = result(b);
            f = Math.min(res.f, fm);
            memories += res.collected.filter(c => c.layer === 'memory').length;
            if (base.vorn) vornHp = Math.min(base.vorn.max, Math.max(1, res.vornHp) + Math.round(base.vorn.max * 0.3));
            if (base.lb) { lbHp = Math.min(base.lb.max, Math.max(1, res.lbHp) + Math.round(base.lb.max * 0.3)); pantry = res.pantry ? { ...res.pantry } : pantry; }
          } else {
            f = base.f; vornHp = base.vorn?.hp ?? 0; lbHp = base.lb?.hp ?? 0; pantry = base.lb ? { ...base.lb.pantry } : null;
          }
        }
        if (won) row.pass++;
        row.tries += tries;
      }
    }
  }
  return [...rows.values()];
}

// ---------- Report ----------

const args = process.argv.slice(2);
const runs = Number(args.find(a => /^\d+$/.test(a))) || 30;
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

const t0 = process.hrtime.bigint();
const data = {} as Record<Profile, Row[]>;
for (const p of PROFILES) data[p] = campaign(p, p === 'expert' ? Math.max(6, Math.round(runs / 3)) : runs);
const secs = Number(process.hrtime.bigint() - t0) / 1e9;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const lines: string[] = [];
const out = (s = '') => lines.push(s);
const flags: string[] = [];

out('# Playtest report');
out();
out(`Runs per profile: ${runs} (expert ${Math.max(6, Math.round(runs / 3))}). Time: ${secs.toFixed(1)} s.`);
out();
out('Profiles: the novice walks at the nearest enemy and hits the first thing it reaches. The competent player uses the shared policy. The expert tries every move and action one round ahead. The spammer only strips.');
out();
out('Columns: first-try win, rounds, Fragility drop from the start of the fight to its lowest point, rounds Overloaded or Faded, distinct actions, and damage taken per round as a share of the maximum.');

// Novelty, in story order: enemies not met before, enemy behaviors absent from the last three fights,
// and how far the expert's way of winning (actions and moves) sits from everything that came before.
interface Novelty { enemies: number; tags: string[]; play: number }
const novelty = new Map<string, Novelty>();
{
  const tagsOf = (g: string): Set<string> => {
    const t = new Set<string>();
    for (const key of GROUPS[g]) {
      const [id, role] = key.split('@');
      const d = ENEMIES[id];
      if (role) t.add('role:' + role);
      t.add('category:' + d.category); t.add('ai:' + d.ai);
      if (d.floats) t.add('floats'); if (d.liar) t.add('liar'); if (d.peaceful) t.add('peaceful'); if ((d.size || 1) > 1) t.add('large');
      for (const m of d.moves) {
        t.add(`attack:${m.kind}/${m.range}${m.all ? '/all' : ''}`);
        if (m.effect) t.add('effect:' + m.effect);
        if (m.heavy) t.add('windup:' + m.heavy);
        for (const k of Object.keys(m)) if (!['name', 'kind', 'power', 'range', 'reach', 'weight', 'line', 'all', 'effect', 'phases'].includes(k)) t.add('move:' + k);
      }
      for (const k of Object.keys(d)) if (!['id', 'name', 'category', 'layers', 'shellKind', 'memory', 'emotion', 'trueName', 'concept', 'moves', 'ai', 'speed', 'size', 'floats', 'liar', 'peaceful', 'art', 'c1', 'c2', 'up', 'boss', 'intro', 'phases'].includes(k)) t.add('trait:' + k);
    }
    if (GROUPS[g].length > 1) t.add(GROUPS[g].length > 2 ? 'crowd' : 'pair');
    return t;
  };
  const seen = new Set<string>();
  const recent: Set<string>[] = [];
  const cum = new Map<string, number>();
  for (const r of data.expert) {
    const ids = GROUPS[r.group].map(k => k.split('@')[0]);
    const enemies = ids.filter(id => !seen.has(id)).length / ids.length;
    const tags = tagsOf(r.group);
    const newTags = [...tags].filter(t => !recent.some(s => s.has(t)) && !/^(category|ai):|^(pair|crowd)$/.test(t));
    let dot = 0, na = 0, nb = 0;
    const keys = new Set([...r.acts.keys(), ...cum.keys()]);
    for (const k of keys) { const a = r.acts.get(k) || 0, b2 = cum.get(k) || 0; dot += a * b2; na += a * a; nb += b2 * b2; }
    const play = cum.size ? 1 - dot / Math.max(1e-9, Math.sqrt(na * nb)) : 1;
    novelty.set(r.stage.name + ':' + r.group, { enemies, tags: newTags, play });
    ids.forEach(id => seen.add(id));
    recent.push(tags); if (recent.length > 3) recent.shift();
    for (const [k, v] of r.acts) cum.set(k, (cum.get(k) || 0) + v / Math.max(1, r.n));
  }
}

for (let ch = 1; ch <= 5; ch++) {
  out();
  out(`## Chapter ${ch}: ${CHAPTER_NAME[ch]}`);
  out();
  out('| Fight | Novice | Competent | Expert | Spam | Rounds (C) | Drop N/C/E | Over/Faded (C) | Actions C/E | Hit/round P/V (C) | Novelty |');
  out('|---|---|---|---|---|---|---|---|---|---|---|');
  const comp = data.competent.filter(r => r.stage.chapter === ch);
  for (const rc of comp) {
    const get = (p: Profile) => data[p].find(r => r.stage.name === rc.stage.name && r.group === rc.group)!;
    const [n, c, e, s] = [get('novice'), get('competent'), get('expert'), get('spam')];
    const avg = (r: Row, k: keyof Row) => (r[k] as number) / Math.max(1, r.n);
    const tag = rc.boss ? ' (boss)' : rc.mini ? ' (mini)' : '';
    const nv = novelty.get(rc.stage.name + ':' + rc.group);
    out(`| ${rc.group}${tag} | ${pct(n.firstWin / n.n)} | ${pct(c.firstWin / c.n)} | ${pct(e.firstWin / e.n)} | ${pct(s.firstWin / s.n)} | ${avg(c, 'rounds').toFixed(1)} | ${pct(avg(n, 'drop'))}/${pct(avg(c, 'drop'))}/${pct(avg(e, 'drop'))} | ${avg(c, 'over').toFixed(1)}/${avg(c, 'faded').toFixed(1)} | ${avg(c, 'distinct').toFixed(1)}/${avg(e, 'distinct').toFixed(1)} | ${pct(avg(c, 'taken'))}/${pct(avg(c, 'vtaken'))} | ${nv ? `${pct(nv.enemies)} new, ${nv.tags.length} new behaviors, play ${nv.play.toFixed(2)}` : ''} |`);

    const big = rc.boss || rc.mini;
    const name = `${rc.stage.name} ${rc.group}`;
    if (nv && nv.enemies === 0 && nv.tags.length === 0 && nv.play < 0.15)
      flags.push(`SAME AS BEFORE: ${name}: no new enemy, no behavior missing from the last three fights, and the expert wins it the way it won the earlier fights (play ${nv.play.toFixed(2)}).`);
    if (n.pass < n.n) flags.push(`IMPOSSIBLE for the novice: ${name} is still lost after three tries in ${n.n - n.pass} of ${n.n} runs.`);
    if (rc.boss && n.firstWin / n.n < 0.8) flags.push(`HARD boss: ${name}: the novice wins ${pct(n.firstWin / n.n)} on the first try (target 80% or more).`);
    if (!big && c.firstWin / c.n < 0.95) flags.push(`HARD fight: ${name}: the competent player wins ${pct(c.firstWin / c.n)} (target near 100%).`);
    if (!big && !GROUPS[rc.group].some(k => ENEMIES[k.split('@')[0]].peaceful) && avg(c, 'drop') < 0.04 && avg(c, 'taken') < 0.03 && avg(c, 'vtaken') < 0.05) flags.push(`NO THREAT: ${name}: the party loses ${pct(avg(c, 'drop'))} Fragility at most and Vorn ${pct(avg(c, 'vtaken'))} a round. The fight asks nothing.`);
    if (!big && avg(n, 'drop') > 0.45) flags.push(`PUNISHING: ${name}: the novice drops ${pct(avg(n, 'drop'))} of the meter in an ordinary fight.`);
    if (!big && avg(c, 'rounds') > 6) flags.push(`GRIND: ${name} takes ${avg(c, 'rounds').toFixed(1)} rounds (target under 6).`);
    if (!big && avg(c, 'rounds') < 1.6 && !GROUPS[rc.group].every(k => ENEMIES[k.split('@')[0]].peaceful)) flags.push(`OVER TOO FAST: ${name} ends in ${avg(c, 'rounds').toFixed(1)} rounds, before the enemy acts twice.`);
    if (rc.boss && (avg(c, 'rounds') > 20 || avg(c, 'rounds') < 6)) flags.push(`BOSS LENGTH: ${name} takes ${avg(c, 'rounds').toFixed(1)} rounds (target 8 to 20).`);
    if (big && s.firstWin / s.n >= c.firstWin / c.n - 0.02 && avg(s, 'rounds') <= avg(c, 'rounds') * 1.15 && avg(s, 'drop') <= avg(c, 'drop') + 0.05)
      flags.push(`STALE: ${name}: stripping alone does as well as playing properly (spam ${pct(s.firstWin / s.n)} in ${avg(s, 'rounds').toFixed(1)} rounds).`);
    if (rc.boss && e.firstWin / e.n - n.firstWin / n.n < 0.1 && Math.abs(avg(e, 'minF') - avg(n, 'minF')) < 0.1)
      flags.push(`NO SKILL GAP: ${name}: novice and expert end up within 10 points on wins and lowest Fragility.`);
    if (avg(c, 'rounds') >= 59) flags.push(`STALEMATE: ${name} reaches the round cap.`);
  }

  // Chapter-wide checks.
  const fights = comp.reduce((a, r) => a + r.n, 0);
  const tense = comp.reduce((a, r) => a + Math.min(r.n, r.over > 0 || r.faded > 0 ? r.n * Math.min(1, (r.over + r.faded) / r.n) : 0), 0);
  const ex = data.expert.filter(r => r.stage.chapter === ch);
  const exActs = new Map<string, number>();
  for (const r of ex) for (const [k, v] of r.acts) if (!k.startsWith('move:')) exActs.set(k, (exActs.get(k) || 0) + v);
  const exTotal = [...exActs.values()].reduce((a, c) => a + c, 0);
  const enemies = comp.flatMap(r => GROUPS[r.group].map(k => k.split('@')[0]));
  const distinctEnemies = new Set(enemies).size;
  out();
  out(`Fragility bands touched (competent): ${pct(tense / Math.max(1, fights))} of fights. Distinct enemies: ${distinctEnemies} across ${comp.length} fights. Expert action mix: ${[...exActs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / exTotal)}`).join(', ')}.`);
  if (tense / Math.max(1, fights) < 0.05) flags.push(`CHAPTER ${ch}: the Fragility bands almost never come into play (${pct(tense / Math.max(1, fights))} of fights). The core risk of the meter is missing.`);
  if (tense / Math.max(1, fights) > 0.75) flags.push(`CHAPTER ${ch}: the meter is out of the safe band in ${pct(tense / Math.max(1, fights))} of fights. It may read as chaos.`);
  if (distinctEnemies < comp.length * 0.6) flags.push(`CHAPTER ${ch}: ${distinctEnemies} distinct enemies over ${comp.length} fights. Enemies repeat a lot.`);
  const top = [...exActs].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] / exTotal > 0.7) flags.push(`CHAPTER ${ch}: the expert spends ${pct(top[1] / exTotal)} of its turns on ${top[0]}. One action dominates.`);
  for (const st of STAGES.filter(s => s.chapter === ch && s.teaches)) {
    const uses = ex.filter(r => r.stage.chapter === ch && STAGES.indexOf(r.stage) >= STAGES.indexOf(st))
      .reduce((a, r) => a + st.teaches!.reduce((x, id) => x + (r.acts.get(id) || 0), 0), 0);
    const turns = ex.filter(r => r.stage.chapter === ch && STAGES.indexOf(r.stage) >= STAGES.indexOf(st)).reduce((a, r) => a + [...r.acts].filter(([k]) => !k.startsWith('move:')).reduce((x, [, y]) => x + y, 0), 0);
    out(`New in ${st.name}: ${st.teaches!.join(', ')}. The expert uses it on ${pct(uses / Math.max(1, turns))} of its turns from here to the end of the chapter.`);
    if (uses / Math.max(1, turns) < 0.05) flags.push(`MECHANIC UNUSED: ${st.teaches!.join(', ')} (new in ${st.name}) is ${pct(uses / Math.max(1, turns))} of the expert's turns. The chapter does not make it pay off.`);
  }
}

// Lesson checks: a fight that should go worse when the player ignores what the game told them.
out();
out('## Lesson checks');
out();
function lesson(label: string, stageName: string, group: string, tweak: (p: PartyIn) => void, n = runs): void {
  const st = STAGES.find(s => s.name === stageName)!;
  let wa = 0, wb = 0, da = 0, db = 0, ra = 0, rb = 0;
  for (let i = 0; i < n; i++) {
    const a = play(newBattle(GROUPS[group], party(st), { seed: 50 + i, scripted: SCRIPTED[group] }), 'competent');
    const pb = party(st); tweak(pb);
    const b2 = play(newBattle(GROUPS[group], pb, { seed: 50 + i, scripted: SCRIPTED[group] }), 'competent');
    if (a.win) wa++; if (b2.win) wb++; da += a.startF - a.minF; db += b2.startF - b2.minF; ra += a.rounds; rb += b2.rounds;
  }
  const worse = wb < wa || db > da + 0.05 || rb > ra * 1.2;
  out(`- ${label}: ${pct(wa / n)} wins and ${pct(da / n)} drop in ${(ra / n).toFixed(1)} rounds as taught, ${pct(wb / n)} wins and ${pct(db / n)} drop in ${(rb / n).toFixed(1)} rounds without. ${worse ? 'The lesson matters.' : 'Ignoring it costs nothing.'}`);
  if (!worse) flags.push(`LESSON: ${label} makes no difference.`);
}
lesson('Wear a shell that resists the Void against the Void-Walker', 'void', 'mini_voidwalker', p => { p.worn = null; });
lesson('Bring Vorn to the Watchman', 'watchman', 'boss_watchman', p => { p.vorn = null; });
lesson('Light-Bound #123 cooks through the Archive', 'archive', 'boss_archive', p => { p.lb = null; });
lesson('Concepts slotted for the Guardian', 'guardian', 'boss_guardian', p => { p.slots = []; });
lesson('A worn shell and slotted concepts for the Guardian', 'guardian', 'boss_guardian', p => { p.slots = []; p.worn = null; });

out();
out('## Flags');
out();
if (!flags.length) out('Nothing flagged.');
for (const f of flags) out(`- ${f}`);
out();
out('The simulator cannot judge whether an action feels good, whether field puzzles are fair, or whether the story lands.');

const text = lines.join('\n') + '\n';
const nodeFs = 'node:fs';
if (outFile) ((await import(nodeFs)) as { writeFileSync(p: string, s: string): void }).writeFileSync(outFile, text);
console.log(text);
