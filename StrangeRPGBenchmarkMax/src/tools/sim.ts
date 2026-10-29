// Balance and fun simulator. Runs every chapter's fights headless with four player profiles.
// Usage: node dist-tools/sim.js [battlesPerFight=120] [chapter]
// Progress: Notes/sim-progress.txt every few seconds. Stop early: create Notes/sim.stop. Report: Notes/balance-report.md.
import fs from 'node:fs';
import { buildBattle, type ArenaSpec, type PartyEntry } from '../battle/setup';
import {
  makeRng, lit, beamCovers, party, foes, reachable, moveUnit, useSkill, runFoePhase, validTargets, previewTiles, cantUse, leadOf, visibleIntents,
  skillTiles, unitAt, DIR8, depthOf, isSolid,
} from '../battle/rules';
import { SKILLS } from '../battle/skills';
import { GROUPS, FOES } from '../content/foes';
import type { BattleState, Unit, Pos } from '../battle/types';
import type { Target } from '../battle/rules';

type Profile = 'novice' | 'casual' | 'competent' | 'expert' | 'spammer';
const PROFILES: Profile[] = ['novice', 'casual', 'competent', 'expert', 'spammer'];

interface Chapter {
  n: number;
  name: string;
  level: number;
  party: string[];
  entries: string[];
  light: { sun: { dir: [number, number]; lowness: number } | null; dark: boolean };
  fights: { group: string; level?: number; party?: string[]; boss?: boolean; optional?: boolean }[];
  noLamp?: boolean;
}

const LONG = { sun: { dir: [1, 0] as [number, number], lowness: 3 }, dark: false };
const CHAPTERS: Chapter[] = [
  { n: 1, name: 'The Long Lead', level: 2, party: ['nodus', 'parhelia'], entries: [], light: LONG, noLamp: true,
    fights: [{ group: 'g_tut' }, { group: 'g_pebblers' }, { group: 'g_hound' }, { group: 'g_hound_peb' }, { group: 'g_gnats' }, { group: 'g_crab' }, { group: 'ch1_boss', level: 3, boss: true }] },
  { n: 2, name: 'Lot Nine', level: 4, party: ['nodus', 'parhelia', 'lot'], entries: ['toss', 'pounce'], light: LONG,
    fights: [{ group: 'g_road_hounds' }, { group: 'g_road_mix' }, { group: 'g_cutpurses' }, { group: 'g_hatmen' }, { group: 'g_inkmites' }, { group: 'g_lampthief' }, { group: 'ch2_boss', level: 5, boss: true }] },
  { n: 3, name: 'Shade Rights', level: 7, party: ['nodus', 'parhelia', 'umbraculum'], entries: ['toss', 'pounce', 'pinch', 'daub'], light: { sun: { dir: [0, -1], lowness: 1 }, dark: false },
    fights: [{ group: 'g_ticks' }, { group: 'g_glarebacks' }, { group: 'g_wisps' }, { group: 'g_linesmen' }, { group: 'g_tower_mix' }, { group: 'g_tallman', level: 8, boss: true, optional: true }, { group: 'ch3_boss', level: 8, boss: true }] },
  { n: 4, name: 'Late Glass', level: 10, party: ['nodus', 'minim', 'parhelia'], entries: ['toss', 'pounce', 'pinch', 'glare'], light: { sun: { dir: [0, -1], lowness: 1 }, dark: false },
    fights: [{ group: 'g_cats' }, { group: 'g_fish' }, { group: 'g_hounds_glass' }, { group: 'g_hulk' }, { group: 'ch4_boss', level: 11, boss: true }] },
  { n: 5, name: 'Overhead', level: 12, party: ['nodus', 'parhelia', 'minim'], entries: ['toss', 'pounce', 'shard', 'glare'], light: { sun: null, dark: false },
    fights: [{ group: 'g_gamblers' }, { group: 'g_birds' }, { group: 'g_bearers' }, { group: 'ch5_boss', level: 13, boss: true }] },
  { n: 6, name: 'The Unled', level: 14, party: ['nodus', 'tik', 'umbraculum'], entries: ['pounce', 'shard', 'glare', 'panelash'], light: { sun: null, dark: true },
    fights: [{ group: 'g_feelers' }, { group: 'g_drinkers' }, { group: 'g_dark_mix' }, { group: 'g_oldstray', level: 15, boss: true, optional: true }, { group: 'ch6_boss', level: 15, boss: true }] },
  { n: 7, name: 'Stile', level: 16, party: ['nodus', 'parhelia', 'tik'], entries: ['pounce', 'shard', 'panelash', 'lunge'], light: LONG,
    fights: [{ group: 'g_bearers7' }, { group: 'g_painted' }, { group: 'ch7_boss', level: 17, boss: true, party: ['nodus', 'parhelia', 'tik', 'anthelion'] }] },
];

function arena(rng: () => number, light: Chapter['light']): ArenaSpec {
  const w = 14, h = 10;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < 6; i++) {
    const x = 4 + Math.floor(rng() * 6), y = 1 + Math.floor(rng() * 8);
    solid[y * w + x] = 1;
  }
  const west = rng() < 0.5;
  return { w, h, solid, heat: new Uint8Array(w * h), sun: light.sun, dark: light.dark, partyAt: { x: west ? 4 : 9, y: 5 }, foeAt: { x: west ? 9 : 4, y: 4 } };
}

// ---- Party players ----

interface Option { dest: Pos; skill: string; target: Target; score: number }

/** Damage the visible foe plans would do to the party, and to other foes, with the board as it is now. */
function threat(st: BattleState): { toParty: number; toFoes: number } {
  let toParty = 0, toFoes = 0;
  if (st.beam) for (const p of party(st)) if (beamCovers(st, p.x, p.y)) toParty += 6;
  for (const f of foes(st)) {
    const vis = visibleIntents(st, f);
    const it = vis[0];
    if (!it) {
      // Unforeseen: assume it reaches someone close.
      const near = party(st).filter((p) => Math.abs(p.x - f.x) + Math.abs(p.y - f.y) <= f.move + 1);
      if (near.length) toParty += (SKILLS[f.skills[0]]?.power ?? 2) + f.pow;
      continue;
    }
    const sk = SKILLS[it.skill];
    if (!sk) continue;
    const ghost: Unit = { ...f, x: it.dest.x, y: it.dest.y };
    for (const p of skillTiles(st, ghost, sk, it.dest, it.aim)) {
      const t = unitAt(st, p.x, p.y);
      if (!t || t === f) continue;
      const dmg = Math.max(1, (sk.power ?? 0) + f.pow - t.guard);
      if (t.side === 'party') toParty += dmg + (t.hp <= dmg ? 4 : 0);
      else toFoes += dmg + (t.hp <= dmg ? 3 : 0);
    }
  }
  return { toParty, toFoes };
}

/** A decoy, or a dark-only foe out of the light, is worth nothing as a target. */
const unseen = (st: BattleState, t: Unit) => t.decoyOf !== undefined || (!!t.darkOnly && !lit(st, t.x, t.y));

/** The best lead strikes the members who have not acted yet could make, each moving at most one tile. */
function followUp(st: BattleState, u: Unit, acted: Set<number>): number {
  let total = 0;
  for (const m of party(st)) {
    if (m === u || acted.has(m.uid) || !m.alive) continue;
    let best = 0;
    const ox = m.x, oy = m.y;
    for (const d of reachable(st, m)) {
      if (Math.abs(d.x - m.startX) + Math.abs(d.y - m.startY) > 1) continue;
      m.x = d.x; m.y = d.y;
      for (const sid of m.skills) {
        const sk = SKILLS[sid];
        if (!sk || sk.power === undefined || (sk.kind !== 'lead' && sk.kind !== 'upsun') || cantUse(st, m, sid)) continue;
        let v = 0;
        for (const p of previewTiles(st, m, sid, {})) {
          const t = unitAt(st, p.x, p.y);
          if (!t || t.side !== 'foe' || unseen(st, t)) continue;
          const dmg = Math.max(1, sk.power + m.pow - t.guard);
          v += Math.min(dmg, t.hp) + (t.hp <= dmg ? 5 : 0);
        }
        best = Math.max(best, v);
      }
      m.x = ox; m.y = oy;
    }
    total += best;
  }
  return total;
}

function evalOption(st: BattleState, u: Unit, dest: Pos, skill: string, target: Target, acted: Set<number>, base: number): number {
  const ox = u.x, oy = u.y;
  u.x = dest.x; u.y = dest.y;
  let score = 0;
  const sk = SKILLS[skill];
  const tiles = previewTiles(st, u, skill, target);
  if (sk.power !== undefined && sk.kind !== 'foe') {
    for (const p of tiles) {
      const t = unitAt(st, p.x, p.y);
      if (!t || t.side !== 'foe' || unseen(st, t)) continue;
      const dmg = Math.max(1, sk.power + u.pow - t.guard);
      score += Math.min(dmg, t.hp) + (t.hp <= dmg ? 5 : 0);
    }
  }
  if (skill === 'stab' && target.uid !== undefined) { const t = st.units.find((x) => x.uid === target.uid)!; const d = Math.max(1, 3 + u.pow - t.guard); score += Math.min(d, t.hp) + (t.hp <= d ? 5 : 0); }
  const saved = { lamps: st.lamps.slice(), shades: st.shades.slice(), panes: st.panes.slice() };
  if (skill === 'raise' && target.pos) { st.lamps = st.lamps.filter((l) => l.owner !== u.uid); st.lamps.push({ x: target.pos.x, y: target.pos.y, r: 3, lowness: 2, owner: u.uid, kind: 'lamp' }); }
  if (skill === 'hood') st.lamps = st.lamps.filter((l) => l.owner !== u.uid);
  if ((skill === 'shade' || skill === 'great_shade') && target.pos) st.shades = [...st.shades, { x: target.pos.x, y: target.pos.y, r: 1, owner: u.uid, ttl: 1 }];
  let tugBack: (() => void) | null = null;
  if ((skill === 'tug' || skill === 'drag') && target.uid !== undefined) {
    const f = st.units.find((x) => x.uid === target.uid)!;
    const it = f.queue[0];
    if (it) {
      const old = { ...it.dest };
      const dir = [Math.sign(it.dest.x - u.x), Math.sign(it.dest.y - u.y)];
      const nx = it.dest.x + dir[0], ny = it.dest.y + dir[1];
      if (!isSolid(st, nx, ny) && !unitAt(st, nx, ny)) it.dest = { x: nx, y: ny };
      tugBack = () => { it.dest = old; };
    }
  }
  const th = threat(st);
  score += th.toFoes * 0.9 - th.toParty * 1.1;
  // A change to the light or the board is worth the strikes it opens for the rest of the party.
  if (SUPPORT.has(skill)) score += (followUp(st, u, acted) - base) * 0.9;
  // A place to strike from next turn is worth something even if nothing is hit now. Only the best skill counts.
  let next = 0;
  for (const sid of u.skills) {
    const ps = SKILLS[sid];
    if (!ps || (ps.kind !== 'lead' && ps.kind !== 'upsun') || ps.power === undefined) continue;
    let v = 0;
    for (const p2 of skillTiles(st, u, ps, u)) { const t = unitAt(st, p2.x, p2.y); if (t && t.side === 'foe' && !unseen(st, t)) v += Math.min(t.hp, ps.power + u.pow - t.guard); }
    next = Math.max(next, v);
  }
  score += 0.45 * next;
  if (skill === 'warm' || skill === 'recall' || skill === 'license') {
    const t = target.uid !== undefined ? st.units.find((x) => x.uid === target.uid) : u;
    const missing = t ? t.maxHp - t.hp : 0;
    score += missing <= 0 ? -1 : Math.min(4 + u.pow, missing) * (t!.hp < t!.maxHp * 0.5 ? 1.2 : 0.4);
  }
  if (skill === 'note') score += 0.3;
  if (skill === 'listen') score += foes(st).filter((f) => depthOf(st, f) === 0).length * 0.8;
  if (skill === 'pane' && target.pos) {
    // A pane on a foe's attack sends it back next round.
    for (const f of foes(st)) {
      const it = visibleIntents(st, f)[0];
      if (!it) continue;
      const tiles2 = skillTiles(st, { ...f, x: it.dest.x, y: it.dest.y }, SKILLS[it.skill], it.dest, it.aim);
      if (tiles2.some((p) => p.x === target.pos!.x && p.y === target.pos!.y)) score += 2;
    }
  }
  st.lamps = saved.lamps; st.shades = saved.shades; st.panes = saved.panes;
  tugBack?.();
  u.x = ox; u.y = oy;
  return score;
}

function options(st: BattleState, u: Unit, acted: Set<number>): Option[] {
  const out: Option[] = [];
  const dests = reachable(st, u);
  for (const d of dests) {
    const ox = u.x, oy = u.y;
    u.x = d.x; u.y = d.y;
    for (const s of u.skills) {
      if (!SKILLS[s] || cantUse(st, u, s)) continue;
      const ts = validTargets(st, u, s);
      const cap = s === 'raise' ? 24 : 12;
      const sample = ts.length > cap ? ts.filter((_, i) => i % Math.ceil(ts.length / cap) === 0) : ts;
      for (const t of sample) out.push({ dest: d, skill: s, target: t, score: 0 });
    }
    u.x = ox; u.y = oy;
  }
  const base = u.skills.some((s) => SUPPORT.has(s)) ? followUp(st, u, acted) : 0;
  for (const o of out) o.score = evalOption(st, u, o.dest, o.skill, o.target, acted, base);
  return out;
}

/** A novice who has the lamp sets it behind themself, so their lead points at the nearest foe. */
function noviceLamp(st: BattleState, u: Unit, usage: Map<string, number>): boolean {
  if (!u.skills.includes('raise') || cantUse(st, u, 'raise')) return false;
  const ids = new Set(party(st).map((p) => p.uid));
  if (st.lamps.some((l) => l.owner !== null && ids.has(l.owner))) return false;
  const near = foes(st).sort((a, b) => Math.abs(a.x - u.x) + Math.abs(a.y - u.y) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
  if (!near) return false;
  const at = { x: u.x - Math.sign(near.x - u.x), y: u.y - Math.sign(near.y - u.y) };
  const ok = validTargets(st, u, 'raise').find((t) => t.pos && t.pos.x === at.x && t.pos.y === at.y);
  if (!ok) return false;
  useSkill(st, u, 'raise', ok);
  usage.set('raise', (usage.get('raise') ?? 0) + 1);
  return true;
}

let TRACE = false;
const tpos = (p: { x: number; y: number }) => `${p.x},${p.y}`;
function traceBoard(st: BattleState) {
  console.log(`ROUND ${st.round}${st.lamps.length ? `  lamps ${st.lamps.map((l) => `${tpos(l)} r${l.r}`).join(' ')}` : ''}`);
  for (const u of st.units.filter((x) => x.alive)) {
    const plan = u.side === 'foe' ? ` plan[${visibleIntents(st, u).map((i) => `${i.skill || 'step'}@${tpos(i.dest)}`).join(' ')}]${u.darkOnly && !lit(st, u.x, u.y) ? ' unseen' : ''}` : '';
    const l = leadOf(st, u);
    console.log(`  ${u.side === 'foe' ? 'F' : 'P'} ${u.id}@${tpos(u)} hp${u.hp}/${u.maxHp} lead${l ? `${l.dir.join(',')}x${l.len}` : '-'}${plan}`);
  }
}

function act(st: BattleState, u: Unit, o: Option, usage: Map<string, number>) {
  if (TRACE) console.log(`  > ${u.id} ${tpos(u)} -> ${tpos(o.dest)} ${o.skill}${o.target.pos ? ' at ' + tpos(o.target.pos) : o.target.aim ? ' aim ' + o.target.aim.join(',') : o.target.uid !== undefined ? ' on ' + st.units.find((x) => x.uid === o.target.uid)?.id : ''} (score ${o.score.toFixed(1)})`);
  moveUnit(st, u, o.dest);
  useSkill(st, u, o.skill, o.target);
  usage.set(o.skill, (usage.get(o.skill) ?? 0) + 1);
}

const SUPPORT = new Set(['raise', 'shade', 'great_shade', 'pane', 'tug', 'drag', 'listen', 'snuff', 'flare']);
/** Per battle: decisions made and options near the best one at each, a proxy for meaningful choice. */
const CHOICE = { turns: 0, near: 0 };

function playRound(st: BattleState, profile: Profile, usage: Map<string, number>, rng: () => number) {
  const ps = party(st);
  // People who change the light or the board go first, so the strikers can use it.
  if (profile !== 'novice' && profile !== 'spammer') ps.sort((a, b) => Number(b.skills.some((k) => SUPPORT.has(k))) - Number(a.skills.some((k) => SUPPORT.has(k))));
  const acted = new Set<number>();
  for (const u of ps) {
    acted.add(u.uid);
    if (st.result || !u.alive) continue;
    if (profile === 'spammer') {
      const s = u.skills.find((k) => SKILLS[k]?.power !== undefined && !cantUse(st, u, k)) ?? 'wait';
      const t = validTargets(st, u, s)[0] ?? {};
      useSkill(st, u, s, t);
      usage.set(s, (usage.get(s) ?? 0) + 1);
      continue;
    }
    if (profile === 'novice') {
      // Walks at the nearest foe and uses whatever hits. Ignores the plans on the ground.
      const fs = foes(st);
      if (!fs.length) break;
      if (noviceLamp(st, u, usage)) continue;
      const near = fs.slice().sort((a, b) => Math.abs(a.x - u.x) + Math.abs(a.y - u.y) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
      const dests = reachable(st, u).sort((a, b) => Math.abs(a.x - near.x) + Math.abs(a.y - near.y) - (Math.abs(b.x - near.x) + Math.abs(b.y - near.y)));
      let done = false;
      for (const d of dests.slice(0, 4)) {
        const ox = u.x, oy = u.y;
        u.x = d.x; u.y = d.y;
        for (const s of u.skills) {
          const sk = SKILLS[s];
          if (!sk || sk.power === undefined || cantUse(st, u, s)) continue;
          for (const t of validTargets(st, u, s)) {
            if (previewTiles(st, u, s, t).some((p) => { const f = unitAt(st, p.x, p.y); return f?.side === 'foe' && !unseen(st, f); })) {
              u.x = ox; u.y = oy;
              act(st, u, { dest: d, skill: s, target: t, score: 0 }, usage);
              done = true;
              break;
            }
          }
          if (done) break;
        }
        if (done) break;
        u.x = ox; u.y = oy;
      }
      if (!done) { moveUnit(st, u, dests[0] ?? u); useSkill(st, u, 'wait', {}); usage.set('wait', (usage.get('wait') ?? 0) + 1); }
      continue;
    }
    let opts = options(st, u, acted);
    if (profile === 'casual') {
      // Half the time a casual player does not think of the lamp or the other board tricks, and it misjudges every option a little.
      const plain = opts.filter((o) => !SUPPORT.has(o.skill));
      if (plain.length && rng() < 0.5) opts = plain;
      for (const o of opts) o.score += (rng() + rng() + rng() - 1.5) * 4;
    }
    if (!opts.length) { useSkill(st, u, 'wait', {}); continue; }
    opts.sort((a, b) => b.score - a.score);
    if (profile === 'competent') { CHOICE.turns++; CHOICE.near += new Set(opts.filter((o) => o.score >= opts[0].score - 2).map((o) => o.skill)).size; }
    let pick = opts[0];
    if (profile === 'competent' && opts.length > 1 && rng() < 0.12) pick = opts[1];
    act(st, u, pick, usage);
  }
}

function playBattle(ch: Chapter, fight: Chapter['fights'][number], profile: Profile, seed: number, carry: Record<string, number> = {}) {
  const rng = makeRng(seed * 7 + 3);
  const level = fight.level ?? ch.level;
  const ids = fight.party ?? ch.party;
  const members: PartyEntry[] = ids.map((id) => ({ id, level: id === 'anthelion' ? 15 : level, hp: carry[id] ?? 999, gear: null, entries: id === 'nodus' ? ch.entries : undefined, guest: id === 'anthelion' }));
  const st = buildBattle(arena(rng, ch.light), members, fight.group, seed, 0);
  if (ch.noLamp && !fight.boss) { const p = st.units.find((u) => u.id === 'parhelia'); if (p) p.skills = p.skills.filter((s) => s !== 'raise' && s !== 'hood' && s !== 'flare'); }
  if (ch.light.dark) { const n = st.units.find((u) => u.id === 'nodus'); if (n && !n.skills.includes('raise')) n.skills.push('raise'); }
  if (ch.n === 5) { const n = st.units.find((u) => u.id === 'nodus'); if (n && !n.skills.includes('raise')) n.skills.push('raise'); }
  const usage = new Map<string, number>();
  CHOICE.turns = 0; CHOICE.near = 0;
  let minHpFrac = 1;
  const startHp = party(st).reduce((n, u) => n + u.maxHp, 0);
  while (!st.result && st.round <= 30) {
    if (TRACE) traceBoard(st);
    playRound(st, profile, usage, rng);
    if (st.result) break;
    runFoePhase(st);
    if (TRACE) for (const e of st.events) if (e.k === 'hit') console.log(`  hit ${st.units.find((x) => x.uid === e.uid)?.id} for ${e.dmg}${e.turned ? ' (turned)' : ''}`); else if (e.k === 'miss') console.log(`  miss ${st.units.find((x) => x.uid === e.uid)?.id}`);
    st.events = [];
    for (const u of st.units) if (u.side === 'party') minHpFrac = Math.min(minHpFrac, u.alive ? u.hp / u.maxHp : 0);
  }
  const endHp = party(st).reduce((n, u) => n + u.hp, 0);
  // As in the game, a member who fell comes out of a won fight with 1 HP.
  const hp: Record<string, number> = {};
  for (const u of st.units) if (u.side === 'party' && !u.guest) hp[u.id] = u.alive ? u.hp : 1;
  const frac = st.units.filter((u) => u.side === 'party' && !u.guest).reduce((n, u) => n + u.hp / u.maxHp, 0) / Math.max(1, ids.length);
  return { win: st.result === 'win', rounds: st.round, hpLost: 1 - endHp / startHp, minHpFrac, turned: st.turnedHits, usage, learned: st.learned.length, hp, startFrac: frac, choiceTurns: CHOICE.turns, choiceNear: CHOICE.near };
}

/** Every required fight of a chapter in a row with HP carried over and no rest, then the boss. */
function gauntlet(ch: Chapter, profile: Profile, seed: number) {
  let carry: Record<string, number> = {};
  const fights = ch.fights.filter((f) => !f.optional);
  for (let i = 0; i < fights.length; i++) {
    const last = i === fights.length - 1;
    let enter = 1;
    if (last) {
      const probe = buildBattle(arena(makeRng(1), ch.light), (fights[i].party ?? ch.party).map((id) => ({ id, level: fights[i].level ?? ch.level, hp: carry[id] ?? 999, gear: null })), fights[i].group, 1, 0);
      const ps = party(probe).filter((u) => !u.guest);
      enter = ps.reduce((n, u) => n + u.hp / u.maxHp, 0) / Math.max(1, ps.length);
    }
    const b = playBattle(ch, fights[i], profile, seed + i * 31, carry);
    if (!b.win) return { cleared: false, reached: i, enterBoss: last ? enter : 0 };
    carry = b.hp;
    if (last) return { cleared: true, reached: i + 1, enterBoss: enter };
  }
  return { cleared: true, reached: fights.length, enterBoss: 1 };
}

// ---- Run ----

// node dist-tools/sim.js trace <chapter> <group> [profile=competent] [seed=1] prints one battle round by round.
if (process.argv[2] === 'trace') {
  TRACE = true;
  const ch = CHAPTERS.find((c) => c.n === Number(process.argv[3]))!;
  const fight = ch.fights.find((f) => f.group === process.argv[4]) ?? { group: process.argv[4] };
  const r = playBattle(ch, fight, (process.argv[5] as Profile) ?? 'competent', Number(process.argv[6] ?? 1));
  console.log(`RESULT ${r.win ? 'win' : 'loss'} in ${r.rounds} rounds, HP lost ${Math.round(r.hpLost * 100)}%`);
  process.exit(0);
}

const per = Number(process.argv[2] ?? 120);
const onlyCh = process.argv[3] ? Number(process.argv[3]) : 0;
// A fourth argument "bosses" runs only the boss fights and skips the gauntlets.
const bossesOnly = process.argv[4] === 'bosses';
fs.mkdirSync('Notes', { recursive: true });
const STOP = 'Notes/sim.stop';
if (fs.existsSync(STOP)) fs.unlinkSync(STOP);
const t0 = Date.now();
let lastProg = 0;
const totalWork = CHAPTERS.filter((c) => !onlyCh || c.n === onlyCh).reduce((n, c) => n + c.fights.length, 0) * PROFILES.length * per;
let done = 0;
let stopped = false;
const lines: string[] = [];
const summary: string[] = [];

lines.push('# Balance report', '', `Battles per fight per profile: ${per}. Generated by \`node dist-tools/sim.js\`.`, '');
lines.push('Profiles: the novice walks at the nearest foe and uses whatever hits, ignoring plans on the ground (it does set the lamp behind itself when it has one). The competent player scores every move by damage dealt, damage dodged, attacks turned onto foes, and the strikes a lamp or tug opens for the rest of the party. It takes its second choice 12% of the time. The casual player thinks of the lamp and the other board tricks only half the time and misjudges every option by a few points. The expert never deviates. The spammer repeats its first attack and never moves.', '');
lines.push('Fun measures: close calls are won fights in which someone fell under 35% HP. Turned hits are foe attacks the light sent into other foes. Choices is the average number of different actions within 2 points of the best at each decision the competent player makes, so 1 means one obvious action. Variety is the spread of actions the expert uses, from 0 (the same action every turn) to 1 (an even spread).', '');

outer: for (const ch of CHAPTERS) {
  if (onlyCh && ch.n !== onlyCh) continue;
  lines.push(`## Chapter ${ch.n}: ${ch.name} (party level ${ch.level})`, '');
  lines.push('| Fight | Novice | Casual | Competent | Expert | Spammer | Rounds (C) | HP lost (Ca) | HP lost (C) | Close calls (Ca) | Turned hits (C) | Choices (C) | Variety (E) | Top actions (E) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const fight of ch.fights.filter((f) => !bossesOnly || f.boss)) {
    const res: Record<string, { wins: number; rounds: number; hp: number; close: number; turned: number; n: number; usage: Map<string, number>; turns: number; near: number }> = {};
    for (const p of PROFILES) {
      const r = { wins: 0, rounds: 0, hp: 0, close: 0, turned: 0, n: 0, usage: new Map<string, number>(), turns: 0, near: 0 };
      const count = p === 'expert' ? Math.max(10, Math.round(per / 3)) : per;
      for (let i = 0; i < count; i++) {
        if (fs.existsSync(STOP)) { stopped = true; break outer; }
        const b = playBattle(ch, fight, p, 1000 + i * 17 + ch.n * 101);
        r.n++;
        if (b.win) r.wins++;
        r.rounds += b.rounds;
        r.hp += b.hpLost;
        if (b.win && b.minHpFrac < 0.35) r.close++;
        r.turned += b.turned;
        r.turns += b.choiceTurns;
        r.near += b.choiceNear;
        for (const [k, v] of b.usage) r.usage.set(k, (r.usage.get(k) ?? 0) + v);
        done += p === 'expert' ? per / count : 1;
        if (Date.now() - lastProg > 2000) {
          lastProg = Date.now();
          const el = (Date.now() - t0) / 1000;
          const eta = done ? (el / done) * (totalWork - done) : 0;
          fs.writeFileSync('Notes/sim-progress.txt', `${Math.round(done)}/${totalWork} battles, ${el.toFixed(0)} s elapsed, about ${eta.toFixed(0)} s left. Chapter ${ch.n}, ${fight.group}, ${p}.\n${summary.join('\n')}\n`);
        }
      }
      res[p] = r;
    }
    const pct = (p: Profile) => `${Math.round((100 * res[p].wins) / Math.max(1, res[p].n))}%`;
    const c = res.competent;
    const top = [...res.expert.usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${Math.round((100 * v) / [...res.expert.usage.values()].reduce((a, b) => a + b, 0))}%`).join(', ');
    const ca = res.casual;
    const counts = [...res.expert.usage.values()];
    const tot = counts.reduce((a, b) => a + b, 0);
    const ent = counts.length > 1 ? -counts.reduce((a, v) => a + (v / tot) * Math.log(v / tot), 0) / Math.log(counts.length) : 0;
    const row = `| ${fight.group}${fight.boss ? ' (boss)' : ''} | ${pct('novice')} | ${pct('casual')} | ${pct('competent')} | ${pct('expert')} | ${pct('spammer')} | ${(c.rounds / c.n).toFixed(1)} | ${Math.round((100 * ca.hp) / ca.n)}% | ${Math.round((100 * c.hp) / c.n)}% | ${Math.round((100 * ca.close) / Math.max(1, ca.wins))}% | ${(c.turned / c.n).toFixed(1)} | ${(c.near / Math.max(1, c.turns)).toFixed(1)} | ${ent.toFixed(2)} | ${top} |`;
    lines.push(row);
    summary.push(`ch${ch.n} ${fight.group}: N ${pct('novice')} Ca ${pct('casual')} C ${pct('competent')} E ${pct('expert')} S ${pct('spammer')} rounds ${(c.rounds / c.n).toFixed(1)} hpCa ${Math.round((100 * ca.hp) / ca.n)}% hpC ${Math.round((100 * c.hp) / c.n)}%`);
  }
  lines.push('');
}

if (!stopped && !bossesOnly) {
  lines.push('## Gauntlets', '', 'Each run fights every required fight of a chapter in order with HP carried over and no rest or items, then the boss. A member who fell comes back with 1 HP after a won fight. Players rest at dial posts and carry items, so this is the hardest case.', '');
  lines.push('| Chapter | Casual clears | Competent clears | Casual reaches boss | Casual HP entering boss | Competent HP entering boss |');
  lines.push('|---|---|---|---|---|---|');
  gl: for (const ch of CHAPTERS) {
    if (onlyCh && ch.n !== onlyCh) continue;
    const res: Record<string, { clears: number; enter: number; reached: number; n: number }> = {};
    for (const p of ['casual', 'competent'] as Profile[]) {
      const s = { clears: 0, enter: 0, reached: 0, n: 0 };
      for (let i = 0; i < per; i++) {
        if (fs.existsSync(STOP)) { stopped = true; break gl; }
        const r = gauntlet(ch, p, 5000 + i * 13 + ch.n * 101);
        s.n++;
        if (r.cleared) s.clears++;
        if (r.enterBoss > 0) { s.enter += r.enterBoss; s.reached++; }
        if (Date.now() - lastProg > 2000) {
          lastProg = Date.now();
          fs.writeFileSync('Notes/sim-progress.txt', `Gauntlets: chapter ${ch.n}, ${p}, run ${i + 1} of ${per}. ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed.\n${summary.join('\n')}\n`);
        }
      }
      res[p] = s;
    }
    const pc = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;
    const ca = res.casual, co = res.competent;
    lines.push(`| ${ch.n}. ${ch.name} | ${pc(ca.clears, ca.n)} | ${pc(co.clears, co.n)} | ${pc(ca.reached, ca.n)} | ${pc(ca.enter, ca.reached)} | ${pc(co.enter, co.reached)} |`);
    summary.push(`gauntlet ch${ch.n}: Ca clears ${pc(ca.clears, ca.n)} C clears ${pc(co.clears, co.n)} Ca enters boss at ${pc(ca.enter, ca.reached)} HP`);
  }
  lines.push('');
}

if (stopped) lines.splice(2, 0, `**Partial run:** stopped early after ${Math.round(done)} of ${totalWork} battles.`, '');
fs.writeFileSync('Notes/balance-report.md', lines.join('\n') + '\n');
fs.writeFileSync('Notes/sim-progress.txt', `${stopped ? 'Stopped' : 'Done'}: ${Math.round(done)}/${totalWork} battles in ${((Date.now() - t0) / 1000).toFixed(0)} s.\n${summary.join('\n')}\n`);
console.log(summary.join('\n'));
void DIR8; void leadOf; void FOES; void GROUPS;
