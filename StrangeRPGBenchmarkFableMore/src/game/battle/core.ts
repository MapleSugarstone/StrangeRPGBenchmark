import { Rng } from "../../engine/rng";
import { NOTE_NAMES, NOTE_SEMITONES, type NoteName } from "../../engine/audio";
import type {
  BattleState, Combatant, Element, EncounterGroup, Lane, LockIcon, MemberDef, Mechanics, Skill, Status, StatusId, Wind,
} from "../types";
import { SKILLS, PAIRS, skill as getSkill } from "../data/skills";
import { ENEMIES } from "../data/enemies";
import { ITEMS } from "../data/items";
import { statsAt, poolAt } from "../data/members";

// ---------------------------------------------------------------------------
// Public types

export interface PartyInput {
  def: MemberDef;
  level: number;
  hp?: number;
  gear: { glove?: string; line?: string; lure?: string };
  skills: string[];
}

export type Action =
  | { type: "attack"; actor: string; target: string }
  | { type: "skill"; actor: string; skill: string; target?: string; target2?: string; note?: NoteName; wind?: Wind }
  | { type: "item"; actor: string; item: string; target?: string }
  | { type: "untie"; actor: string; knot: number }
  | { type: "pair"; actor: string; partner: string; skill: string; target?: string }
  | { type: "flee"; actor: string }
  | { type: "hand"; kind: "tug" | "steady" | "pinch"; target: string };

export type BattleEvent =
  | { t: "turn"; who: string }
  | { t: "use"; who: string; skill: string; target?: string; pair?: string }
  | { t: "damage"; who: string; target: string; amount: number; element?: Element; crit?: boolean; weak?: boolean; resist?: boolean; pluck?: boolean; mirrored?: boolean }
  | { t: "heal"; who: string; target: string; amount: number }
  | { t: "evade"; target: string }
  | { t: "hold"; target: string }
  | { t: "swallow"; who: string; target: string }
  | { t: "status"; target: string; status: StatusId; on: boolean }
  | { t: "tension"; target: string; delta: number; now: number }
  | { t: "pool"; target: string; delta: number; now: number }
  | { t: "note"; note: NoteName; phrase: NoteName[] }
  | { t: "chord"; kind: ChordKind; notes: NoteName[] }
  | { t: "lift"; who: string; rise?: boolean }
  | { t: "descent"; who: string; target: string }
  | { t: "taken"; who: string }
  | { t: "knot"; who: string; skill: string; targets: string[] }
  | { t: "untie"; who: string; skill: string; refund: number }
  | { t: "tangle"; a: string; b: string; on: boolean }
  | { t: "wind"; wind: Wind; set?: boolean }
  | { t: "lane"; who: string; lane: Lane }
  | { t: "charge"; who: string; skill: string; locks: LockIcon[] }
  | { t: "lock"; who: string; index: number }
  | { t: "cancel"; who: string }
  | { t: "ko"; who: string }
  | { t: "down"; who: string }
  | { t: "climb"; who: string; target: string }
  | { t: "drop"; who: string; target: string }
  | { t: "letgo"; who: string; by?: string }
  | { t: "rehold"; who: string }
  | { t: "freed"; who: string }
  | { t: "enrage"; who: string }
  | { t: "summon"; who: string }
  | { t: "flee"; ok: boolean }
  | { t: "item"; who: string; item: string; target?: string }
  | { t: "hand"; kind: "tug" | "steady" | "pinch"; target: string }
  | { t: "bite"; target: string; amount: number }
  | { t: "text"; text: string }
  | { t: "win" }
  | { t: "lose" };

export type ChordKind = "major" | "minor" | "dim" | "sus" | "aug";

export const LIFT_AT = 5;
export const MAX_TENSION = 5;
export const MAX_SLACK = 5;
/** Timeline length of one round, in tempo units at speed 10 (one action). */
const ROUND_LEN = 100;

// ---------------------------------------------------------------------------
// Creation

export function mechanicsFor(chapter: number): Mechanics {
  return {
    tension: true,
    notes: chapter >= 2,
    tangle: chapter >= 3,
    lift: chapter >= 4,
    lanes: chapter >= 5,
    locks: chapter >= 6,
    pairs: chapter >= 7,
    letgo: chapter >= 8,
    allSlack: chapter >= 9,
  };
}

export function enemyStats(level: number) {
  return {
    hp: Math.round(38 + 13 * level + 0.38 * level * level),
    atk: Math.round(5 + 1.7 * level),
    mag: Math.round(4 + 1.6 * level),
    def: Math.round(3 + 1.3 * level),
    spd: Math.round(8 + 0.5 * level),
  };
}

let uid = 0;

function gearStats(gear: { glove?: string; line?: string; lure?: string }) {
  const out = { hp: 0, atk: 0, mag: 0, def: 0, spd: 0 };
  const passives: string[] = [];
  for (const id of [gear.glove, gear.line, gear.lure]) {
    if (!id) continue;
    const it = ITEMS[id];
    if (!it) continue;
    if (it.stats) for (const k of Object.keys(it.stats) as (keyof typeof out)[]) out[k] += it.stats[k] ?? 0;
    if (it.passive) passives.push(it.passive);
  }
  return { out, passives };
}

export function makePartyCombatant(p: PartyInput, chapter: number, index: number, mech: Mechanics): Combatant {
  const st = statsAt(p.def, p.level);
  const g = gearStats(p.gear);
  const maxHp = st.hp + g.out.hp;
  const held = p.def.held;
  const c: Combatant = {
    id: p.def.id,
    defId: p.def.id,
    name: p.def.name,
    side: "party",
    level: p.level,
    hp: Math.min(maxHp, p.hp ?? maxHp),
    maxHp,
    atk: st.atk + g.out.atk,
    mag: st.mag + g.out.mag,
    def: st.def + g.out.def,
    spd: st.spd + g.out.spd,
    baseSpd: st.spd + g.out.spd,
    held,
    tension: 0,
    note: (p.gear.lure && ITEMS[p.gear.lure]?.note ? (ITEMS[p.gear.lure].note as NoteName) : p.def.note),
    economy: p.def.economy,
    pool: p.def.economy === "length" ? poolAt(p.def, p.level) : p.def.economy === "slack" ? 2 : 0,
    maxPool: p.def.economy === "length" ? poolAt(p.def, p.level) : p.def.economy === "slack" ? MAX_SLACK : 0,
    knots: [],
    lane: mech.lanes ? ([1, 0, 2, 1][index % 4] as Lane) : 1,
    tempo: 0,
    statuses: [],
    weak: [...p.def.weak],
    resist: [...p.def.resist],
    revealed: [],
    skills: p.skills.filter((s) => SKILLS[s] && (SKILLS[s].chapter ?? 1) <= chapter),
    alive: (p.hp ?? maxHp) > 0,
    lifted: 0,
    tangledWith: null,
    charging: null,
    ai: p.def.ai,
    boss: false,
    enraged: false,
    climbing: null,
    letGo: false,
    reheld: false,
    sprite: p.def.sprite,
    xp: 0,
    slugs: 0,
    turns: 0,
    taken: false,
    cooldowns: {},
  };
  (c as unknown as { passives: string[] }).passives = g.passives;
  if (mech.allSlack && held) applyLetGo(c);
  return c;
}

export function passivesOf(c: Combatant): string[] {
  return (c as unknown as { passives?: string[] }).passives ?? [];
}

export function makeEnemyCombatant(defId: string, level: number | undefined, mech: Mechanics, index: number, rng: Rng, chapter: number, difficulty = 1): Combatant {
  const d = ENEMIES[defId];
  if (!d) throw new Error(`unknown enemy ${defId}`);
  const L = level ?? d.level;
  const st = enemyStats(L);
  st.hp = Math.round(st.hp * difficulty);
  st.atk = Math.round(st.atk * difficulty);
  st.mag = Math.round(st.mag * difficulty);
  const bossHp = d.boss ? 3.3 : 1;
  const bossSpd = d.boss ? 1.4 : 1;
  const maxHp = Math.round(st.hp * (d.hpMul ?? 1) * bossHp);
  uid++;
  const c: Combatant = {
    id: `${defId}#${uid}`,
    defId,
    name: d.name,
    side: "enemy",
    level: L,
    hp: maxHp,
    maxHp,
    atk: Math.round(st.atk * (d.atkMul ?? 1) * (d.boss ? 1.5 : 1)),
    mag: Math.round(st.mag * (d.magMul ?? 1) * (d.boss ? 1.5 : 1)),
    def: Math.round(st.def * (d.defMul ?? 1)),
    spd: Math.round(st.spd * (d.spdMul ?? 1) * bossSpd),
    baseSpd: Math.round(st.spd * (d.spdMul ?? 1) * bossSpd),
    held: d.held,
    tension: d.held ? rng.int(2) : 0,
    note: d.held ? (d.note ?? NOTE_NAMES[rng.int(7)]) : null,
    economy: d.economy,
    pool: d.economy === "slack" ? 2 : 0,
    maxPool: d.economy === "slack" ? MAX_SLACK : 0,
    knots: [],
    lane: mech.lanes ? ([1, 0, 2, 1, 0][index % 5] as Lane) : 1,
    tempo: 0,
    statuses: [],
    weak: [...d.weak],
    resist: [...d.resist],
    revealed: [],
    skills: d.skills.filter((s) => SKILLS[s] && (SKILLS[s].chapter ?? 1) <= chapter),
    alive: true,
    lifted: 0,
    tangledWith: null,
    charging: null,
    ai: d.ai,
    boss: !!d.boss,
    enraged: false,
    climbing: null,
    letGo: false,
    reheld: false,
    sprite: d.sprite,
    xp: Math.round((10 * L + 10) * (d.xpMul ?? 1) * (d.boss ? 4 : 1)),
    slugs: d.slugs ?? Math.round(3 + L * 1.5),
    drop: d.drop,
    turns: 0,
    taken: false,
    cooldowns: {},
  };
  return c;
}

export function createBattle(opts: {
  chapter: number;
  party: PartyInput[];
  group: EncounterGroup;
  seed: number;
  bonds?: [string, string][];
  canFlee?: boolean;
  items?: Record<string, number>;
  levelOverride?: number;
  mech?: Partial<Mechanics>;
  difficulty?: number;
}): BattleState {
  const rng = new Rng(opts.seed);
  const mech = { ...mechanicsFor(opts.chapter), ...(opts.mech ?? {}) };
  const party = opts.party.map((p, i) => makePartyCombatant(p, opts.chapter, i, mech));
  const enemies = opts.group.enemies.map((e, i) => makeEnemyCombatant(e, opts.levelOverride, mech, i, rng, opts.chapter, opts.difficulty ?? 1));
  const all = [...party, ...enemies];
  for (const c of all) c.tempo = Math.round((1000 / Math.max(1, c.spd)) * (0.6 + rng.next() * 0.4));
  // Snarlhounds and constituents start tangled in pairs
  if (mech.tangle) {
    const hounds = enemies.filter((e) => e.defId === "snarlhound" || e.defId === "constituent");
    for (let i = 0; i + 1 < hounds.length; i += 2) {
      hounds[i].tangledWith = hounds[i + 1].id;
      hounds[i + 1].tangledWith = hounds[i].id;
    }
  }
  const state: BattleState = {
    chapter: opts.chapter,
    mech,
    bite: 0,
    bites: 0,
    difficulty: opts.difficulty ?? 1,
    combatants: all,
    phrase: [],
    wind: 0,
    windNext: (rng.int(2) === 0 ? -1 : 1) as Wind,
    windTempo: ROUND_LEN,
    round: 0,
    actions: 0,
    over: null,
    hand: { tug: 0, steady: 0, pinch: 0, uses: 0 },
    bonds: opts.bonds ?? [],
    canFlee: opts.canFlee ?? !opts.group.boss,
    seed: opts.seed,
    partyLeadHistory: [],
    bossName: enemies.find((e) => e.boss)?.name,
    phase: 0,
  };
  (state as unknown as { rng: Rng }).rng = rng;
  (state as unknown as { items: Record<string, number> }).items = opts.items ?? {};
  return state;
}

export function rngOf(s: BattleState): Rng {
  return (s as unknown as { rng: Rng }).rng;
}
export function itemsOf(s: BattleState): Record<string, number> {
  return (s as unknown as { items: Record<string, number> }).items;
}

// ---------------------------------------------------------------------------
// Queries

export function byId(s: BattleState, id: string): Combatant {
  const c = s.combatants.find((x) => x.id === id);
  if (!c) throw new Error(`no combatant ${id}`);
  return c;
}

export function party(s: BattleState): Combatant[] {
  return s.combatants.filter((c) => c.side === "party");
}
export function enemies(s: BattleState): Combatant[] {
  return s.combatants.filter((c) => c.side === "enemy");
}
export function alive(cs: Combatant[]): Combatant[] {
  return cs.filter((c) => c.alive && !c.taken);
}
/** On the field: alive, not lifted, not climbing. */
export function targetable(cs: Combatant[]): Combatant[] {
  return cs.filter((c) => c.alive && !c.taken && c.lifted === 0 && !c.climbing);
}

export function has(c: Combatant, id: StatusId): Status | undefined {
  return c.statuses.find((s) => s.id === id);
}

export function effSpd(c: Combatant): number {
  let s = c.spd;
  if (has(c, "haste")) s *= 1.4;
  if (has(c, "slow") || has(c, "frost") || has(c, "hitch")) s *= 0.7;
  return Math.max(1, s);
}

export function actionDelay(c: Combatant, weight = 1): number {
  return (1000 / effSpd(c)) * weight;
}

/** Where an action of this weight would put the actor on the strip. */
export function previewTempo(s: BattleState, c: Combatant, weight = 1): number {
  return c.tempo + actionDelay(c, weight);
}

/** The next n actors in tempo order, for the strip. Includes the wind when lanes are on. */
export function upcoming(s: BattleState, n = 8): { id: string; tempo: number }[] {
  const sim: { id: string; tempo: number; spd: number }[] = alive(s.combatants).map((c) => ({ id: c.id, tempo: c.tempo, spd: effSpd(c) }));
  let wind = s.mech.lanes ? s.windTempo : Infinity;
  const out: { id: string; tempo: number }[] = [];
  while (out.length < n && sim.length) {
    sim.sort((a, b) => a.tempo - b.tempo || a.id.localeCompare(b.id));
    const first = sim[0];
    if (wind <= first.tempo) {
      out.push({ id: "wind", tempo: wind });
      wind += ROUND_LEN;
      continue;
    }
    out.push({ id: first.id, tempo: first.tempo });
    first.tempo += 1000 / first.spd;
  }
  return out;
}

export function liftThreshold(c: Combatant): number {
  return passivesOf(c).includes("liftSix") ? 6 : LIFT_AT;
}

export function maxTension(c: Combatant): number {
  return passivesOf(c).includes("liftSix") ? 6 : MAX_TENSION;
}

/** Is a skill affordable right now. */
export function canAfford(c: Combatant, sk: Skill): boolean {
  if (sk.cost === 0) return true;
  if (c.economy === "tension") return c.tension >= sk.cost;
  return c.pool >= sk.cost;
}

export function usableSkills(s: BattleState, c: Combatant): Skill[] {
  const out: Skill[] = [];
  const silenced = !!has(c, "silence") || !!has(c, "clove");
  for (const id of c.skills) {
    const sk = SKILLS[id];
    if (!sk) continue;
    if ((sk.chapter ?? 1) > s.chapter) continue;
    if (sk.kind === "attack" && sk.cost === 0) continue; // basic attack is its own command
    if (silenced && sk.cost > 0) continue;
    if (sk.kind === "hang" && (c.letGo || !c.held)) continue;
    if (sk.kind === "duck" && c.held && !c.letGo && sk.id === "duck") continue;
    if (sk.kind === "rise" && (!s.mech.lift || !c.held || c.letGo)) continue;
    if (sk.kind === "letgo" && sk.id === "letgo" && (!s.mech.letgo || !c.held || c.letGo)) continue;
    if (sk.kind === "letgo" && sk.id === "release" && !s.mech.letgo) continue;
    if (sk.kind === "tune" && !s.mech.notes) continue;
    if (sk.kind === "tangle" && !s.mech.tangle) continue;
    if (sk.kind === "wind" && !s.mech.lanes) continue;
    if (sk.effect === "pullToLane" && !s.mech.lanes) continue;
    if (sk.effect === "pullMiddle" && !s.mech.lanes) continue;
    if (sk.effect === "timber" && !s.mech.lanes) continue;
    if (sk.shape && (sk.shape === "lane" || sk.shape === "adjacent") && !s.mech.lanes && c.side === "party") {
      // Still allowed, it just hits everyone in the single lane.
    }
    if (sk.kind === "climb" && c.climbing) continue;
    out.push(sk);
  }
  // The let go and slack get Duck even if they never learned it
  if ((c.letGo || (!c.held && c.economy !== "length")) && !out.some((k) => k.id === "duck") && !c.skills.includes("burrow")) out.push(SKILLS.duck);
  return out;
}

/** The basic attack skill for a combatant. */
export function basicOf(c: Combatant): Skill {
  for (const id of c.skills) {
    const sk = SKILLS[id];
    if (sk && sk.kind === "attack" && sk.cost === 0) return sk;
  }
  return SKILLS.e_bite;
}

export function pairSkillsFor(s: BattleState, c: Combatant): { partner: Combatant; skill: Skill }[] {
  if (!s.mech.pairs) return [];
  const out: { partner: Combatant; skill: Skill }[] = [];
  for (const p of PAIRS) {
    if (!p.members.includes(c.defId)) continue;
    const otherId = p.members[0] === c.defId ? p.members[1] : p.members[0];
    const partner = s.combatants.find((x) => x.defId === otherId && x.side === "party");
    if (!partner || !partner.alive || partner.lifted || partner.climbing || partner.reheld) continue;
    const bonded = s.bonds.some(([a, b]) => (a === c.defId && b === otherId) || (b === c.defId && a === otherId));
    if (!bonded) continue;
    const sk = SKILLS[p.skill];
    if ((sk.chapter ?? 1) > s.chapter) continue;
    if (!canAfford(c, sk) || !canAfford(partner, sk)) continue;
    out.push({ partner, skill: sk });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Turn flow

export interface TurnResult {
  actor: Combatant | null;
  events: BattleEvent[];
}

/**
 * Advance the timeline to the next actor that needs a decision. Automatic
 * things (wind, descents, knocked down turns, charged moves resolving,
 * re-held allies) happen here and produce events.
 */
export function nextTurn(s: BattleState): TurnResult {
  const ev: BattleEvent[] = [];
  for (let guard = 0; guard < 200; guard++) {
    if (checkOver(s, ev)) return { actor: null, events: ev };
    const live = alive(s.combatants);
    if (live.length === 0) return { actor: null, events: ev };
    live.sort((a, b) => a.tempo - b.tempo || a.id.localeCompare(b.id));
    const c = live[0];
    if (s.mech.lanes && s.windTempo <= c.tempo) {
      windPush(s, ev);
      continue;
    }
    // Start of this actor's turn
    c.turns++;
    s.actions++;
    tickHand(s);
    tickStatuses(s, c, ev);
    if (c.economy === "slack" && c.alive && !c.reheld) {
      if (c.pool < c.maxPool) {
        c.pool++;
        ev.push({ t: "pool", target: c.id, delta: 1, now: c.pool });
      }
    }
    if (!c.alive) continue;
    // Coming down from a Lift
    if (c.lifted > 0) {
      c.lifted = 0;
      descent(s, c, ev);
      c.tempo += actionDelay(c);
      continue;
    }
    // Dropping from a Climb
    if (c.climbing) {
      drop(s, c, ev);
      c.tempo += actionDelay(c);
      continue;
    }
    // Lift at max tension
    if (s.mech.lift && c.held && !c.letGo && c.tension >= liftThreshold(c) && !has(c, "stopper") && !has(c, "clove")) {
      if (c.side === "enemy") {
        if (c.boss) {
          c.tension = 0;
          ev.push({ t: "text", text: `${c.name} is too heavy to lift.` });
        } else {
          c.taken = true;
          c.alive = false;
          untieAllOn(s, c, ev);
          untangle(s, c, ev);
          ev.push({ t: "taken", who: c.id });
          continue;
        }
      } else {
        c.lifted = 1;
        c.tension = 0;
        ev.push({ t: "lift", who: c.id });
        c.tempo += actionDelay(c, 1);
        continue;
      }
    }
    if (has(c, "down")) {
      removeStatus(c, "down");
      ev.push({ t: "down", who: c.id });
      c.tempo += actionDelay(c, 0.8);
      continue;
    }
    if (c.charging) {
      c.charging.turns--;
      if (c.charging.turns <= 0) {
        const ch = c.charging;
        c.charging = null;
        if (ch.matched.every(Boolean) && ch.locks.length > 0 && s.mech.locks) {
          ev.push({ t: "cancel", who: c.id });
        } else {
          ev.push({ t: "turn", who: c.id });
          ev.push({ t: "use", who: c.id, skill: ch.skill });
          resolveSkill(s, c, SKILLS[ch.skill], pickEnemyTarget(s, c, SKILLS[ch.skill]) ?? undefined, { resolving: true }, ev);
        }
        c.tempo += actionDelay(c);
        continue;
      }
    }
    if (c.side === "party" && c.reheld) {
      // Acts for the Grip
      ev.push({ t: "turn", who: c.id });
      const tg = pickWeakest(targetable(party(s)).filter((p) => p.id !== c.id && !p.reheld), rngOf(s));
      if (tg) resolveSkill(s, c, basicOf(c), tg, undefined, ev);
      c.tempo += actionDelay(c);
      continue;
    }
    ev.push({ t: "turn", who: c.id });
    return { actor: c, events: ev };
  }
  return { actor: null, events: ev };
}

function tickHand(s: BattleState): void {
  s.hand.tug = Math.max(0, s.hand.tug - 1);
  s.hand.steady = Math.max(0, s.hand.steady - 1);
  s.hand.pinch = Math.max(0, s.hand.pinch - 1);
}

function tickStatuses(s: BattleState, c: Combatant, ev: BattleEvent[]): void {
  const keep: Status[] = [];
  for (const st of c.statuses) {
    if (st.id === "bleed" && c.alive) {
      const by = s.combatants.find((x) => x.id === st.by);
      const dmg = Math.max(1, Math.round((by ? by.atk : 10) * 0.9 + c.level * 0.4));
      c.hp = Math.max(0, c.hp - dmg);
      ev.push({ t: "damage", who: st.by ?? c.id, target: c.id, amount: dmg, element: "blunt" });
      if (c.hp <= 0) {
        kill(s, c, ev);
        return;
      }
    }
    if (st.turns >= 99) {
      keep.push(st);
      continue;
    }
    st.turns--;
    if (st.turns > 0) keep.push(st);
    else ev.push({ t: "status", target: c.id, status: st.id, on: false });
  }
  c.statuses = keep;
  for (const k of Object.keys(c.cooldowns)) c.cooldowns[k] = Math.max(0, c.cooldowns[k] - 1);
}

function windPush(s: BattleState, ev: BattleEvent[]): void {
  s.wind = s.windNext;
  s.windTempo += ROUND_LEN;
  s.round++;
  const rng = rngOf(s);
  // The wind never blows the same way twice running, so nobody gets pinned in an edge lane
  const next = (rng.int(3) - 1) as Wind;
  s.windNext = next !== 0 && next === s.wind ? 0 : next;
  if (s.wind !== 0) {
    for (const c of alive(s.combatants)) {
      if (has(c, "hitch") || c.statuses.some((st) => st.id === "defDown" && st.by?.startsWith("timber"))) continue;
      const nl = Math.max(0, Math.min(2, c.lane + s.wind)) as Lane;
      if (nl !== c.lane) {
        c.lane = nl;
        ev.push({ t: "lane", who: c.id, lane: nl });
      }
    }
  }
  ev.push({ t: "wind", wind: s.wind });
}

function checkOver(s: BattleState, ev: BattleEvent[]): boolean {
  if (s.over) return true;
  const p = alive(party(s)).filter((c) => !c.reheld);
  const e = alive(enemies(s));
  if (p.length === 0) {
    s.over = "lose";
    ev.push({ t: "lose" });
    return true;
  }
  if (e.length === 0) {
    s.over = "win";
    // Re-held allies are freed when the Reel's drums are gone
    for (const c of party(s)) if (c.reheld) { c.reheld = false; c.letGo = true; }
    ev.push({ t: "win" });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Performing actions

export function perform(s: BattleState, a: Action): BattleEvent[] {
  const ev: BattleEvent[] = [];
  if (a.type === "hand") {
    handAct(s, a.kind, a.target, ev);
    return ev;
  }
  const actor = byId(s, a.actor);
  let weight = 1;
  switch (a.type) {
    case "attack": {
      const sk = basicOf(actor);
      ev.push({ t: "use", who: actor.id, skill: sk.id, target: a.target });
      const tg = byId(s, a.target);
      if (tg.side === actor.side && tg.reheld) {
        // A slap on a re-held ally's line: a weak pluck that frees them
        const slap: Skill = { ...sk, kind: "pluck", power: 30, element: "hum" };
        dealDamage(s, actor, tg, slap, 1, ev);
        break;
      }
      resolveSkill(s, actor, sk, tg, undefined, ev);
      if (actor.held && !actor.letGo && sk.kind === "attack") addTension(s, actor, passivesOf(actor).includes("loud") ? 2 : 1, ev);
      break;
    }
    case "skill": {
      const sk = getSkill(a.skill);
      if (!canAfford(actor, sk)) {
        ev.push({ t: "text", text: `${actor.name} cannot afford that.` });
        break;
      }
      weight = sk.weight ?? 1;
      ev.push({ t: "use", who: actor.id, skill: sk.id, target: a.target });
      const tg = a.target ? byId(s, a.target) : undefined;
      const tg2 = a.target2 ? byId(s, a.target2) : undefined;
      if (sk.kind === "knot") {
        tieKnot(s, actor, sk, tg, tg2, ev);
      } else {
        spend(s, actor, sk, ev);
        const wasCharging = !!actor.charging;
        resolveSkill(s, actor, sk, tg, { tg2, note: a.note, wind: a.wind }, ev);
        // Winding up takes a full turn, so the party gets a round to answer the locks
        if (!wasCharging && actor.charging) weight = 1.0;
      }
      break;
    }
    case "item": {
      useItem(s, actor, a.item, a.target, ev);
      weight = 0.8;
      break;
    }
    case "untie": {
      untie(s, actor, a.knot, ev);
      weight = 0.4;
      break;
    }
    case "pair": {
      const sk = getSkill(a.skill);
      const partner = byId(s, a.partner);
      ev.push({ t: "use", who: actor.id, skill: sk.id, target: a.target, pair: partner.id });
      spend(s, actor, sk, ev);
      spend(s, partner, sk, ev);
      const tg = a.target ? byId(s, a.target) : undefined;
      resolveSkill(s, actor, sk, tg, { partner }, ev);
      partner.tempo += actionDelay(partner, 1);
      weight = 1;
      break;
    }
    case "flee": {
      const rng = rngOf(s);
      const ok = s.canFlee && rng.chance(0.65);
      ev.push({ t: "flee", ok });
      if (ok) s.over = "flee";
      break;
    }
  }
  actor.tempo += actionDelay(actor, weight);
  // Tangled partners delay each other
  if (actor.tangledWith) {
    const other = s.combatants.find((c) => c.id === actor.tangledWith);
    if (other && other.alive) other.tempo += actionDelay(other, 0.4);
  }
  biteTick(s, ev);
  recordLead(s);
  checkOver(s, ev);
  return ev;
}

/**
 * The Bite. Every line under tension hums, and something in the Under is
 * listening. The meter rises with the tension on the whole field. When it
 * fills, the loudest line on either side is bitten: heavy damage and its
 * tension gone. A quiet party is safe. A loud boss is a target.
 */
/** The line the Bite would take if it filled now, or undefined when every line is quiet. */
export function biteTarget(s: BattleState): Combatant | undefined {
  const held = alive(s.combatants).filter((c) => c.held && !c.letGo && c.lifted === 0 && !c.climbing);
  const jaw = s.combatants.some((c) => c.side === "party" && c.alive && passivesOf(c).includes("biteFoes"));
  const pool = jaw && held.some((c) => c.side === "enemy" && c.tension > 0) ? held.filter((c) => c.side === "enemy") : held;
  const loud = [...pool].sort((a, b) => b.tension - a.tension || a.id.localeCompare(b.id))[0];
  return loud && loud.tension > 0 ? loud : undefined;
}

function biteTick(s: BattleState, ev: BattleEvent[]): void {
  const held = alive(s.combatants).filter((c) => c.held && !c.letGo && c.lifted === 0 && !c.climbing);
  const hum = held.reduce((a, c) => a + c.tension, 0);
  const spoon = s.combatants.some((c) => c.side === "party" && c.alive && passivesOf(c).includes("pluckPlus") && c.held);
  s.bite = Math.min(100, s.bite + 1 + hum * (spoon ? 1.6 : 1.2));
  if (s.bite < 100) return;
  s.bite = 0;
  const loud = biteTarget(s);
  if (!loud) return;
  let amount = Math.max(1, Math.round(loud.boss ? loud.maxHp * 0.12 + loud.level * 4 : loud.maxHp * 0.2 + loud.level * 1.5));
  if (passivesOf(loud).includes("biteGuard")) amount = Math.round(amount / 2);
  if (has(loud, "duck")) { ev.push({ t: "text", text: `${loud.name} is flat on the ground. The bite misses.` }); return; }
  loud.hp = Math.max(0, loud.hp - amount);
  s.bites++;
  ev.push({ t: "bite", target: loud.id, amount });
  loud.tension = 0;
  ev.push({ t: "tension", target: loud.id, delta: 0, now: 0 });
  if (loud.hp <= 0) kill(s, loud, ev);
  else if (loud.boss && !loud.enraged && loud.hp <= loud.maxHp * 0.5) { loud.enraged = true; addStatus(s, loud, "haste", 99, ev); ev.push({ t: "enrage", who: loud.id }); }
}

function recordLead(s: BattleState): void {
  const p = party(s), e = enemies(s);
  const pp = p.reduce((a, c) => a + c.hp, 0) / Math.max(1, p.reduce((a, c) => a + c.maxHp, 0));
  const ee = e.reduce((a, c) => a + (c.taken ? 0 : c.hp), 0) / Math.max(1, e.reduce((a, c) => a + c.maxHp, 0));
  s.partyLeadHistory.push(pp - ee);
}

function spend(s: BattleState, c: Combatant, sk: Skill, ev: BattleEvent[]): void {
  if (sk.cost === 0) return;
  if (c.economy === "tension") {
    c.tension = Math.max(0, c.tension - sk.cost);
    ev.push({ t: "tension", target: c.id, delta: -sk.cost, now: c.tension });
  } else {
    c.pool = Math.max(0, c.pool - sk.cost);
    ev.push({ t: "pool", target: c.id, delta: -sk.cost, now: c.pool });
  }
}

export function addTension(s: BattleState, c: Combatant, n: number, ev: BattleEvent[]): void {
  if (!c.held || c.letGo || !c.alive) return;
  if (has(c, "clove") || has(c, "unhanded")) return;
  const before = c.tension;
  c.tension = Math.max(0, Math.min(maxTension(c), c.tension + n));
  if (c.tension !== before) ev.push({ t: "tension", target: c.id, delta: c.tension - before, now: c.tension });
}

function addStatus(s: BattleState, c: Combatant, id: StatusId, turns: number, ev: BattleEvent[], power?: number, by?: string, link?: string): boolean {
  if (!c.alive) return false;
  if (id === "down") {
    if (c.boss || has(c, "steady") || passivesOf(c).includes("noDown")) return false;
    if (has(c, "steady")) return false;
  }
  if (id === "frost" && passivesOf(c).includes("noFrost")) return false;
  if (id === "slow" && has(c, "haste")) { removeStatus(c, "haste"); }
  if (id === "haste" && has(c, "slow")) { removeStatus(c, "slow"); }
  const ex = c.statuses.find((st) => st.id === id);
  if (ex) {
    ex.turns = Math.max(ex.turns, turns);
    if (power !== undefined) ex.power = power;
    return true;
  }
  c.statuses.push({ id, turns, power, by, link });
  ev.push({ t: "status", target: c.id, status: id, on: true });
  // Statuses spread through tangles
  if (c.tangledWith && id !== "taunt" && id !== "swallow" && id !== "hold") {
    const other = s.combatants.find((x) => x.id === c.tangledWith);
    if (other && other.alive && !other.statuses.some((st) => st.id === id)) {
      other.statuses.push({ id, turns, power, by, link });
      ev.push({ t: "status", target: other.id, status: id, on: true });
    }
  }
  return true;
}

export function removeStatus(c: Combatant, id: StatusId): void {
  c.statuses = c.statuses.filter((st) => st.id !== id);
}

// ---------------------------------------------------------------------------
// Skill resolution

interface Extra {
  tg2?: Combatant;
  note?: NoteName;
  wind?: Wind;
  partner?: Combatant;
  /** True when a charged move is landing, so it is not wound up again. */
  resolving?: boolean;
}

function foesOf(s: BattleState, c: Combatant): Combatant[] {
  return targetable(s.combatants.filter((x) => x.side !== c.side));
}
function friendsOf(s: BattleState, c: Combatant): Combatant[] {
  return targetable(s.combatants.filter((x) => x.side === c.side));
}

function shapeTargets(s: BattleState, actor: Combatant, sk: Skill, tg: Combatant | undefined): { target: Combatant; mult: number }[] {
  const pool = sk.target === "allEnemies" ? foesOf(s, actor) : sk.target === "allAllies" ? friendsOf(s, actor) : tg ? [tg] : [];
  if (sk.target === "allEnemies" || sk.target === "allAllies") return pool.map((t) => ({ target: t, mult: 1 }));
  if (!tg) return [];
  const shape = sk.shape ?? "one";
  if (shape === "one") return [{ target: tg, mult: 1 }];
  const side = foesOf(s, actor).includes(tg) ? foesOf(s, actor) : friendsOf(s, actor);
  if (shape === "all") return side.map((t) => ({ target: t, mult: 1 }));
  if (shape === "lane") return side.filter((t) => t.lane === tg.lane).map((t) => ({ target: t, mult: 1 }));
  // adjacent: full in the lane, half in the lanes beside it
  return side.filter((t) => Math.abs(t.lane - tg.lane) <= 1).map((t) => ({ target: t, mult: t.lane === tg.lane ? 1 : 0.5 }));
}

/** Whether an action carrying `given` answers a lock icon. A pluck and a hum song answer each other's locks. */
export function locksMatch(given: string, lock: string): boolean {
  const hum = (l: string) => l === "hum" || l === "pluck";
  return given === lock || (hum(given) && hum(lock));
}

/** Marks one unmatched lock on each charging foe that this action answers, and cancels a move whose locks are all matched. */
function matchLocks(s: BattleState, actor: Combatant, lock: string, victims: Combatant[], ev: BattleEvent[]): void {
  if (!s.mech.locks) return;
  for (const v of victims) {
    if (!v.charging || v.side === actor.side) continue;
    const i = v.charging.locks.findIndex((l, k) => locksMatch(lock, l) && !v.charging!.matched[k]);
    if (i < 0) continue;
    v.charging.matched[i] = true;
    ev.push({ t: "lock", who: v.id, index: i });
    if (v.charging.matched.every(Boolean)) {
      v.charging = null;
      ev.push({ t: "cancel", who: v.id });
    }
  }
}

function resolveSkill(s: BattleState, actor: Combatant, sk: Skill, tg: Combatant | undefined, extra: Extra | undefined, ev: BattleEvent[]): void {
  const rng = rngOf(s);
  // Charged enemy moves: announce instead of acting
  const d = ENEMIES[actor.defId];
  if (actor.side === "enemy" && d?.charges?.[sk.id] && !actor.charging && !extra?.resolving) {
    const locks = d.charges[sk.id];
    actor.charging = { skill: sk.id, locks, matched: locks.map(() => false), turns: 1 };
    ev.push({ t: "charge", who: actor.id, skill: sk.id, locks });
    return;
  }
  // Lock matching on charging foes. A move with no foe target (Duck, a wind) answers every charging foe.
  if (sk.lock) {
    const victims = sk.target === "allEnemies" || !tg || tg.side === actor.side ? foesOf(s, actor) : [tg];
    matchLocks(s, actor, sk.lock, victims, ev);
  }
  switch (sk.kind) {
    case "attack":
    case "pluck": {
      const targets = shapeTargets(s, actor, sk, tg);
      if (targets.length === 0 && tg) targets.push({ target: tg, mult: 1 });
      for (const { target, mult } of targets) {
        if (!target.alive) continue;
        const hit = dealDamage(s, actor, target, sk, mult, ev);
        if (hit && sk.status && target.alive) {
          const applied = addStatus(s, target, sk.status, sk.statusTurns ?? 2, ev, sk.statusPower, actor.id);
          if (sk.status === "down" && !applied && target.boss) ev.push({ t: "text", text: `${target.name} does not fall.` });
        }
        if (hit && target.alive) applyEffect(s, actor, sk, target, extra, ev);
      }
      if (sk.effect === "pairTaunt" && extra?.partner) addStatus(s, extra.partner, "taunt", 2, ev);
      if (sk.effect === "pullMiddle") for (const { target } of targets) if (target.alive && target.lane !== 1 && !has(target, "hitch")) { target.lane = 1; ev.push({ t: "lane", who: target.id, lane: 1 }); }
      break;
    }
    case "heal": {
      const targets = sk.target === "allAllies" ? friendsOf(s, actor) : sk.target === "self" ? [actor] : tg ? [tg] : [];
      for (const t of targets) {
        if (!t.alive) continue;
        let amount = (sk.heal ?? 20) + 1.2 * actor.mag;
        if (sk.effect === "phraseHeal" && s.phrase.length >= 3) amount *= 1.5;
        if (sk.heal && sk.heal >= 999) amount = t.maxHp;
        heal(s, actor, t, Math.round(amount), ev);
      }
      if (sk.effect === "drainAllTension") {
        for (const p of alive(party(s))) if (p.tension > 0) { const n = p.tension; addTension(s, p, -n, ev); heal(s, actor, actor, n * 12, ev); }
      }
      if (sk.effect === "fillPhrase" && s.mech.notes) {
        s.phrase = ["C", "E", "G"];
        ev.push({ t: "note", note: "G", phrase: [...s.phrase] });
        applyChord(s, actor, "major", ["C", "E", "G"], ev);
        s.phrase = [];
      }
      if (sk.effect === "refillPool" && tg) { tg.pool = tg.maxPool; ev.push({ t: "pool", target: tg.id, delta: tg.maxPool, now: tg.pool }); }
      break;
    }
    case "buff": {
      const targets = sk.target === "allAllies" ? friendsOf(s, actor) : sk.target === "self" ? [actor] : tg ? [tg] : [];
      for (const t of targets) {
        if (sk.status) addStatus(s, t, sk.status, sk.statusTurns ?? 2, ev, sk.statusPower, actor.id);
        if (sk.effect === "defUp") addStatus(s, t, "defUp", 2, ev, 0.3, actor.id);
        if (sk.effect === "giveTension") {
          if (t.economy === "tension" && !t.letGo) addTension(s, t, sk.statusPower ?? 2, ev);
          else if (t.economy !== "tension" || t.letGo) { t.pool = Math.min(t.maxPool, t.pool + 1); ev.push({ t: "pool", target: t.id, delta: 1, now: t.pool }); }
        }
      }
      break;
    }
    case "debuff": {
      const targets = sk.target === "allEnemies" ? foesOf(s, actor) : tg ? [tg] : [];
      for (const t of targets) {
        if (!t.alive) continue;
        if (sk.element && sk.power) dealDamage(s, actor, t, sk, 1, ev);
        if (sk.status) addStatus(s, t, sk.status, sk.statusTurns ?? 2, ev, sk.statusPower, actor.id);
        applyEffect(s, actor, sk, t, extra, ev);
      }
      if (sk.effect === "tangleTwo") {
        const f = foesOf(s, actor).filter((x) => !x.tangledWith);
        if (f.length >= 2) doTangle(s, f[0], f[1], ev);
      }
      break;
    }
    case "hang": {
      addStatus(s, actor, "guard", 1, ev);
      addTension(s, actor, passivesOf(actor).includes("hangPlus") ? 3 : 2, ev);
      break;
    }
    case "duck": {
      addStatus(s, actor, "duck", 1, ev);
      if (sk.effect === "healSmall") heal(s, actor, actor, Math.round(actor.maxHp * 0.15), ev);
      if (passivesOf(actor).includes("duckHeal")) heal(s, actor, actor, Math.round(actor.maxHp * 0.1), ev);
      break;
    }
    case "climb": {
      if (!tg || !tg.held || tg.letGo) {
        ev.push({ t: "text", text: "There is no line to climb." });
        break;
      }
      actor.climbing = tg.id;
      ev.push({ t: "climb", who: actor.id, target: tg.id });
      break;
    }
    case "tune": {
      if (tg && tg.held && extra?.note) {
        tg.note = extra.note;
        ev.push({ t: "text", text: `${tg.name}'s line now sounds ${extra.note}.` });
      }
      break;
    }
    case "tangle": {
      const a = tg, b = extra?.tg2;
      if (a && b && a !== b) doTangle(s, a, b, ev);
      break;
    }
    case "wind": {
      s.windNext = extra?.wind ?? (rng.int(3) - 1) as Wind;
      ev.push({ t: "wind", wind: s.windNext, set: true });
      break;
    }
    case "rise": {
      actor.lifted = 1;
      actor.tension = 0;
      (actor as unknown as { rose: boolean }).rose = true;
      ev.push({ t: "lift", who: actor.id, rise: true });
      break;
    }
    case "letgo": {
      if (sk.effect === "releaseAlly" && tg) {
        if (!tg.held || tg.letGo) { ev.push({ t: "text", text: `${tg.name} is already slack.` }); break; }
        const n = tg.tension;
        applyLetGo(tg);
        heal(s, actor, tg, Math.round(tg.maxHp * 0.12 * n + actor.mag), ev);
        ev.push({ t: "letgo", who: tg.id, by: actor.id });
      } else {
        applyLetGo(actor);
        ev.push({ t: "letgo", who: actor.id });
      }
      break;
    }
    case "special": {
      if (sk.effect === "survey") {
        for (const f of alive(enemies(s))) f.revealed = [...f.weak];
        addStatus(s, actor, "focus", 2, ev);
        ev.push({ t: "text", text: "Bob calls the weaknesses." });
      }
      if (sk.effect === "summon") {
        const minion = actor.defId === "the_lint" ? "lintling" : actor.defId === "the_mayoralty" ? "constituent" : actor.defId === "the_grip" ? "grip_hand" : null;
        const minions = alive(enemies(s)).filter((e) => e.defId === minion);
        if (minion && minions.length < 2) {
          const m = makeEnemyCombatant(minion, undefined, s.mech, enemies(s).length, rng, s.chapter);
          m.tempo = actor.tempo + actionDelay(m, 0.5);
          m.xp = Math.round(m.xp * 0.5);
          s.combatants.push(m);
          ev.push({ t: "summon", who: actor.id });
        } else {
          resolveSkill(s, actor, basicOf(actor), pickWeakest(foesOf(s, actor), rng) ?? undefined, undefined, ev);
        }
      }
      if (sk.effect === "rehold" && tg) {
        if (tg.side === "party" && tg.letGo && !tg.reheld && tg.alive) {
          tg.reheld = true;
          tg.letGo = false;
          tg.tension = 0;
          ev.push({ t: "rehold", who: tg.id });
        } else {
          resolveSkill(s, actor, SKILLS.e_grip, tg, undefined, ev);
        }
      }
      break;
    }
    case "knot":
      break;
  }
}

function applyEffect(s: BattleState, actor: Combatant, sk: Skill, t: Combatant, extra: Extra | undefined, ev: BattleEvent[]): void {
  switch (sk.effect) {
    case "giveTension":
      if (t.held && !t.letGo) addTension(s, t, sk.statusPower ?? 2, ev);
      break;
    case "stealTension":
      if (t.held && !t.letGo && t.tension > 0) {
        const n = Math.min(2, t.tension);
        addTension(s, t, -n, ev);
        addTension(s, actor, n, ev);
      }
      break;
    case "cancelCharge":
      if (t.charging) { t.charging = null; ev.push({ t: "cancel", who: t.id }); }
      break;
    case "pullToLane":
      if (s.mech.lanes && !has(t, "hitch") && t.lane !== actor.lane) { t.lane = actor.lane; ev.push({ t: "lane", who: t.id, lane: t.lane }); }
      break;
    case "unravel":
      t.statuses = t.statuses.filter((st) => !["atkUp", "defUp", "haste", "taunt", "focus", "guard"].includes(st.id));
      untangle(s, t, ev);
      break;
    case "cutKnots": {
      const fathom = s.combatants.find((c) => c.economy === "length" && c.side !== actor.side);
      if (fathom && fathom.knots.length) {
        const k = fathom.knots.find((kn) => kn.targets.includes(t.id)) ?? fathom.knots[fathom.knots.length - 1];
        const idx = fathom.knots.indexOf(k);
        // Cut knots are lost, not refunded
        fathom.knots.splice(idx, 1);
        for (const id of k.targets) {
          const tc = s.combatants.find((c) => c.id === id);
          if (tc) tc.statuses = tc.statuses.filter((st) => !(st.turns >= 99 && st.by === fathom.id && (SKILLS[k.skill].status === st.id || st.id === "reef" || st.id === "defDown")));
        }
        ev.push({ t: "text", text: `${actor.name} cuts the ${SKILLS[k.skill].name}.` });
      }
      break;
    }
    case "eatPool":
      if (t.economy !== "tension" && t.pool > 0) { t.pool = Math.max(0, t.pool - 2); ev.push({ t: "pool", target: t.id, delta: -2, now: t.pool }); }
      break;
    case "downIfSlack":
      if (!t.held || t.letGo || t.tension === 0 || has(t, "unhanded")) addStatus(s, t, "down", 1, ev);
      break;
  }
}

export function applyLetGo(c: Combatant): void {
  c.letGo = true;
  c.economy = "slack";
  c.pool = Math.min(MAX_SLACK, Math.max(3, c.tension));
  c.maxPool = MAX_SLACK;
  c.tension = 0;
  c.lifted = 0;
}

function doTangle(s: BattleState, a: Combatant, b: Combatant, ev: BattleEvent[]): void {
  if (a.tangledWith) untangle(s, a, ev);
  if (b.tangledWith) untangle(s, b, ev);
  a.tangledWith = b.id;
  b.tangledWith = a.id;
  ev.push({ t: "tangle", a: a.id, b: b.id, on: true });
}

function untangle(s: BattleState, c: Combatant, ev: BattleEvent[]): void {
  if (!c.tangledWith) return;
  const other = s.combatants.find((x) => x.id === c.tangledWith);
  if (other) {
    other.tangledWith = null;
    ev.push({ t: "tangle", a: c.id, b: other.id, on: false });
  }
  c.tangledWith = null;
}

// ---------------------------------------------------------------------------
// Damage and healing

function dealDamage(s: BattleState, src: Combatant, tgt: Combatant, sk: Skill, mult: number, ev: BattleEvent[], mirrored = false): boolean {
  const rng = rngOf(s);
  if (!tgt.alive || tgt.lifted > 0 || tgt.climbing) return false;
  if (has(tgt, "duck")) {
    ev.push({ t: "evade", target: tgt.id });
    return false;
  }
  const holdSt = has(tgt, "hold");
  if (holdSt) {
    removeStatus(tgt, "hold");
    ev.push({ t: "hold", target: tgt.id });
    return false;
  }
  // Swallow: an ally intercepts
  if (!mirrored) {
    const swallower = s.combatants.find((c) => c.side === tgt.side && c.id !== tgt.id && c.alive && has(c, "swallow"));
    if (swallower && sk.target !== "allEnemies") {
      removeStatus(swallower, "swallow");
      ev.push({ t: "swallow", who: swallower.id, target: tgt.id });
      return dealDamage(s, src, swallower, sk, mult * 0.5, ev, true);
    }
  }
  // Accuracy
  const isPluck = sk.kind === "pluck";
  const magic = !!sk.magic;
  if (!magic && sk.element !== "wind" && !mirrored && rng.chance(0.05)) {
    ev.push({ t: "evade", target: tgt.id });
    return false;
  }
  if (isPluck && (!tgt.held || tgt.letGo)) {
    // A pluck on a slack target is just a weak hit
    mult *= 0.6;
  }
  const stat = magic ? src.mag : src.atk;
  let defv = tgt.def;
  if (sk.effect === "pierce") defv *= 0.5;
  const defUp = has(tgt, "defUp"), defDown = has(tgt, "defDown");
  if (defUp) defv *= 1 + (defUp.power ?? 0.3);
  if (defDown) defv *= 1 - (defDown.power ?? 0.25);
  let dmg = ((sk.power ?? 100) / 100) * ((stat * stat) / (stat + Math.max(1, defv))) * 1.6 * mult;
  // Element
  let weak = false, resist = false;
  if (sk.element) {
    if (tgt.weak.includes(sk.element)) { dmg *= 1.5; weak = true; }
    if (tgt.resist.includes(sk.element)) { dmg *= 0.5; resist = true; }
    if (sk.element === "heat" && has(tgt, "frost")) { dmg *= 1.5; weak = true; }
    if (sk.element === "heat" && passivesOf(tgt).includes("heatResist")) dmg *= 0.5;
    if (!tgt.revealed.includes(sk.element) && (weak || resist)) tgt.revealed.push(sk.element);
  }
  // Attacker tension
  if (src.held && !src.letGo) dmg *= 1 + 0.06 * src.tension;
  const atkUp = has(src, "atkUp"), atkDown = has(src, "atkDown");
  if (atkUp) dmg *= 1 + (atkUp.power ?? 0.3);
  if (atkDown) dmg *= 1 - (atkDown.power ?? 0.25);
  if (src.enraged) dmg *= 1.35;
  // Pluck
  let plucked = false;
  if (isPluck && tgt.held && !tgt.letGo) {
    plucked = true;
    dmg *= 1 + 0.4 * tgt.tension;
    if (passivesOf(tgt).includes("pluckGuard")) dmg *= 0.67;
  }
  // Guard and shields
  if (has(tgt, "guard")) dmg *= 0.5;
  const shield = has(tgt, "shield");
  if (shield) dmg *= 1 - (shield.power ?? 0.4);
  if (has(tgt, "unhanded")) dmg *= 1.2;
  // Brace: Cat's Paw doubles the next hit and unties
  const brace = has(src, "brace");
  if (brace) {
    dmg *= 2;
    removeStatus(src, "brace");
    autoUntie(s, src, "k_cat", ev);
  }
  // Crit
  let critChance = 0.05;
  if (has(src, "focus")) critChance += 0.12;
  if (passivesOf(src).includes("critPlus")) critChance += 0.08;
  const crit = rng.chance(critChance);
  if (crit) dmg *= 1.5;
  dmg *= 0.9 + rng.next() * 0.2;
  let amount = Math.max(1, Math.round(dmg));
  // Reef: split with the partner
  const reef = has(tgt, "reef");
  if (reef && reef.link) {
    const partner = s.combatants.find((c) => c.id === reef.link);
    if (partner && partner.alive && partner.id !== tgt.id) {
      const half = Math.floor(amount / 2);
      amount -= half;
      partner.hp = Math.max(0, partner.hp - half);
      ev.push({ t: "damage", who: src.id, target: partner.id, amount: half, element: sk.element, mirrored: true });
      if (partner.hp <= 0) kill(s, partner, ev);
    }
  }
  tgt.hp = Math.max(0, tgt.hp - amount);
  ev.push({ t: "damage", who: src.id, target: tgt.id, amount, element: sk.element, crit, weak, resist, pluck: plucked, mirrored });
  if (plucked) {
    const drained = passivesOf(src).includes("pluckPlus") ? tgt.tension + 1 : tgt.tension;
    if (tgt.tension > 0) addTension(s, tgt, -drained, ev);
    if (tgt.charging) { tgt.charging = null; ev.push({ t: "cancel", who: tgt.id }); }
    tgt.tempo += actionDelay(tgt, 0.3);
    if (tgt.note && s.mech.notes && src.side === "party") pushNote(s, src, tgt.note, ev);
    // Plucking a re-held ally frees them
    if (tgt.side === "party" && tgt.reheld) {
      tgt.reheld = false;
      applyLetGo(tgt);
      ev.push({ t: "freed", who: tgt.id });
    }
  } else if (tgt.held && !tgt.letGo && !mirrored && !passivesOf(tgt).includes("quiet")) {
    addTension(s, tgt, 1, ev);
  }
  // Snare: trips on the target's next action, handled as down when it acts
  if (tgt.hp <= 0) {
    kill(s, tgt, ev);
  } else if (tgt.tangledWith && !mirrored) {
    const other = s.combatants.find((c) => c.id === tgt.tangledWith);
    if (other && other.alive && other.lifted === 0) {
      const m = Math.max(1, Math.round(amount * 0.6));
      other.hp = Math.max(0, other.hp - m);
      ev.push({ t: "damage", who: src.id, target: other.id, amount: m, element: sk.element, mirrored: true });
      if (other.hp <= 0) kill(s, other, ev);
    }
  }
  // Boss enrage
  if (tgt.alive && tgt.boss && !tgt.enraged && tgt.hp <= tgt.maxHp * 0.5) {
    tgt.enraged = true;
    addStatus(s, tgt, "haste", 99, ev);
    ev.push({ t: "enrage", who: tgt.id });
  }
  return true;
}

function heal(s: BattleState, src: Combatant, tgt: Combatant, amount: number, ev: BattleEvent[]): void {
  if (!tgt.alive) return;
  const before = tgt.hp;
  tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount);
  const healed = tgt.hp - before;
  ev.push({ t: "heal", who: src.id, target: tgt.id, amount: healed });
  if (tgt.tangledWith) {
    const other = s.combatants.find((c) => c.id === tgt.tangledWith);
    if (other && other.alive) {
      const b = other.hp;
      other.hp = Math.min(other.maxHp, other.hp + Math.round(amount * 0.6));
      ev.push({ t: "heal", who: src.id, target: other.id, amount: other.hp - b });
    }
  }
}

function kill(s: BattleState, c: Combatant, ev: BattleEvent[]): void {
  if (!c.alive) return;
  c.alive = false;
  c.hp = 0;
  c.statuses = [];
  c.charging = null;
  c.climbing = null;
  c.lifted = 0;
  c.reheld = false;
  untangle(s, c, ev);
  untieAllOn(s, c, ev);
  // Anyone climbing this line falls
  for (const o of s.combatants) if (o.climbing === c.id) { o.climbing = null; ev.push({ t: "text", text: `${o.name} slides down.` }); }
  ev.push({ t: "ko", who: c.id });
}

function descent(s: BattleState, c: Combatant, ev: BattleEvent[]): void {
  const rose = (c as unknown as { rose?: boolean }).rose;
  (c as unknown as { rose?: boolean }).rose = false;
  const foes = foesOf(s, c);
  const tg = pickWeakest(foes, rngOf(s));
  if (!tg) return;
  ev.push({ t: "descent", who: c.id, target: tg.id });
  const base = basicOf(c);
  const sk: Skill = { ...base, power: (base.power ?? 100) * (rose ? 2.5 : 1.3), kind: "attack" };
  dealDamage(s, c, tg, sk, 1, ev);
}

function drop(s: BattleState, c: Combatant, ev: BattleEvent[]): void {
  const tg = s.combatants.find((x) => x.id === c.climbing);
  c.climbing = null;
  if (!tg || !tg.alive) {
    ev.push({ t: "text", text: `${c.name} drops to the ground.` });
    return;
  }
  ev.push({ t: "drop", who: c.id, target: tg.id });
  const base = basicOf(c);
  const sk: Skill = { ...base, power: (base.power ?? 100) * (passivesOf(c).includes("climbPlus") ? 3.3 : 2.2), kind: "attack" };
  dealDamage(s, c, tg, sk, 1, ev);
  if (tg.alive && tg.held) {
    tg.tension = 0;
    addStatus(s, tg, "unhanded", 3, ev);
    if (tg.charging) { tg.charging = null; ev.push({ t: "cancel", who: tg.id }); }
  }
}

// ---------------------------------------------------------------------------
// Notes and chords

function pushNote(s: BattleState, who: Combatant, note: NoteName, ev: BattleEvent[]): void {
  s.phrase.push(note);
  while (s.phrase.length > 3) s.phrase.shift();
  ev.push({ t: "note", note, phrase: [...s.phrase] });
  if (s.phrase.length === 3) {
    const kind = chordOf(s.phrase);
    if (kind) {
      applyChord(s, who, kind, [...s.phrase], ev);
      s.phrase = [];
    }
  }
}

export function chordOf(notes: NoteName[]): ChordKind | null {
  if (notes.length !== 3) return null;
  if (new Set(notes).size !== 3) return null;
  const semis = notes.map((n) => NOTE_SEMITONES[n]);
  for (let r = 0; r < 3; r++) {
    const root = semis[r];
    const rel = semis.map((x) => ((x - root) % 12 + 12) % 12).sort((a, b) => a - b);
    const key = rel.join(",");
    if (key === "0,4,7") return "major";
    if (key === "0,3,7") return "minor";
    if (key === "0,3,6") return "dim";
    if (key === "0,5,7" || key === "0,2,7") return "sus";
    if (key === "0,4,8") return "aug";
  }
  return null;
}

function applyChord(s: BattleState, who: Combatant, kind: ChordKind, notes: NoteName[], ev: BattleEvent[]): void {
  ev.push({ t: "chord", kind, notes });
  const friends = alive(s.combatants.filter((c) => c.side === who.side));
  const foes = targetable(s.combatants.filter((c) => c.side !== who.side));
  const plus = friends.some((f) => passivesOf(f).includes("chordPlus")) ? 1.5 : 1;
  switch (kind) {
    case "major":
      for (const f of friends) { heal(s, who, f, Math.round(f.maxHp * 0.2 * plus), ev); removeStatus(f, "down"); }
      break;
    case "minor":
      for (const f of foes) addStatus(s, f, "slow", plus > 1 ? 3 : 2, ev);
      break;
    case "dim": {
      const sk: Skill = { id: "chord", name: "Diminished", desc: "", kind: "attack", cost: 0, target: "allEnemies", element: "hum", power: 110 * plus, magic: true };
      for (const f of foes) dealDamage(s, who, f, sk, 1, ev);
      break;
    }
    case "sus":
      for (const f of friends) {
        if (f.economy === "tension") addTension(s, f, 1, ev);
        else if (f.pool < f.maxPool) { f.pool++; ev.push({ t: "pool", target: f.id, delta: 1, now: f.pool }); }
      }
      break;
    case "aug":
      for (const f of foes) if (f.held) addTension(s, f, -2, ev);
      break;
  }
}

// ---------------------------------------------------------------------------
// Knots

function tieKnot(s: BattleState, actor: Combatant, sk: Skill, tg: Combatant | undefined, tg2: Combatant | undefined, ev: BattleEvent[]): void {
  if (actor.pool < sk.cost) {
    ev.push({ t: "text", text: "Not enough line." });
    return;
  }
  const targets: Combatant[] = [];
  if (sk.effect === "reef") {
    if (!tg || !tg2 || tg === tg2) { ev.push({ t: "text", text: "Reef needs two allies." }); return; }
    targets.push(tg, tg2);
  } else if (tg) targets.push(tg);
  else { ev.push({ t: "text", text: "No target." }); return; }
  actor.pool -= sk.cost;
  ev.push({ t: "pool", target: actor.id, delta: -sk.cost, now: actor.pool });
  actor.knots.push({ skill: sk.id, targets: targets.map((t) => t.id), cost: sk.cost });
  ev.push({ t: "knot", who: actor.id, skill: sk.id, targets: targets.map((t) => t.id) });
  // Any knot tied answers a knot lock on every foe winding up
  if (sk.lock) matchLocks(s, actor, sk.lock, foesOf(s, actor), ev);
  if (sk.effect === "reef") {
    targets[0].statuses.push({ id: "reef", turns: 99, by: actor.id, link: targets[1].id });
    targets[1].statuses.push({ id: "reef", turns: 99, by: actor.id, link: targets[0].id });
    ev.push({ t: "status", target: targets[0].id, status: "reef", on: true });
    ev.push({ t: "status", target: targets[1].id, status: "reef", on: true });
    return;
  }
  const t = targets[0];
  if (sk.effect === "timber") {
    if (s.mech.lanes && t.lane !== actor.lane) { t.lane = actor.lane; ev.push({ t: "lane", who: t.id, lane: t.lane }); }
    t.statuses.push({ id: "defDown", turns: 99, power: sk.statusPower ?? 0.25, by: `timber:${actor.id}` });
    t.statuses.push({ id: "hitch", turns: 99, by: actor.id });
    ev.push({ t: "status", target: t.id, status: "defDown", on: true });
    return;
  }
  if (sk.status) {
    if (sk.status === "clove" && t.boss) {
      // Bosses shrug it off but still take the knot's weight: slow instead
      t.statuses.push({ id: "slow", turns: 99, by: actor.id });
      ev.push({ t: "status", target: t.id, status: "slow", on: true });
      ev.push({ t: "text", text: `${t.name} is too strong to freeze, but it slows.` });
      return;
    }
    t.statuses.push({ id: sk.status, turns: 99, power: sk.statusPower, by: actor.id });
    ev.push({ t: "status", target: t.id, status: sk.status, on: true });
    if (sk.status === "clove" && t.charging) { t.charging = null; ev.push({ t: "cancel", who: t.id }); }
  }
}

function untie(s: BattleState, actor: Combatant, index: number, ev: BattleEvent[]): void {
  const k = actor.knots[index];
  if (!k) return;
  actor.knots.splice(index, 1);
  removeKnotStatuses(s, actor, k);
  actor.pool = Math.min(actor.maxPool, actor.pool + k.cost);
  ev.push({ t: "untie", who: actor.id, skill: k.skill, refund: k.cost });
  ev.push({ t: "pool", target: actor.id, delta: k.cost, now: actor.pool });
}

function removeKnotStatuses(s: BattleState, actor: Combatant, k: { skill: string; targets: string[] }): void {
  const sk = SKILLS[k.skill];
  for (const id of k.targets) {
    const t = s.combatants.find((c) => c.id === id);
    if (!t) continue;
    t.statuses = t.statuses.filter((st) => {
      if (st.turns < 99) return true;
      if (st.by === actor.id && (st.id === sk.status || st.id === "reef" || (sk.id === "k_timber" && st.id === "hitch") || (sk.id === "k_clove" && st.id === "slow"))) return false;
      if (st.by === `timber:${actor.id}` && sk.id === "k_timber") return false;
      return true;
    });
  }
}

function autoUntie(s: BattleState, target: Combatant, skillId: string, ev: BattleEvent[]): void {
  const fathom = s.combatants.find((c) => c.economy === "length");
  if (!fathom) return;
  const i = fathom.knots.findIndex((k) => k.skill === skillId && k.targets.includes(target.id));
  if (i < 0) return;
  const k = fathom.knots[i];
  fathom.knots.splice(i, 1);
  removeKnotStatuses(s, fathom, k);
  fathom.pool = Math.min(fathom.maxPool, fathom.pool + k.cost);
  ev.push({ t: "untie", who: fathom.id, skill: k.skill, refund: k.cost });
  ev.push({ t: "pool", target: fathom.id, delta: k.cost, now: fathom.pool });
}

function untieAllOn(s: BattleState, dead: Combatant, ev: BattleEvent[]): void {
  for (const f of s.combatants) {
    if (f.economy !== "length" && !f.knots.length) continue;
    for (let i = f.knots.length - 1; i >= 0; i--) {
      const k = f.knots[i];
      if (k.targets.includes(dead.id)) {
        f.knots.splice(i, 1);
        removeKnotStatuses(s, f, k);
        f.pool = Math.min(f.maxPool, f.pool + k.cost);
        ev.push({ t: "untie", who: f.id, skill: k.skill, refund: k.cost });
      }
    }
  }
}

/** Called by the game after a battle: untie everything and refund. */
export function untieAll(s: BattleState): void {
  for (const f of s.combatants) {
    for (const k of f.knots) f.pool = Math.min(f.maxPool, f.pool + k.cost);
    f.knots = [];
  }
}

// ---------------------------------------------------------------------------
// Snare check: a snared combatant trips when it tries to act

export function checkSnare(s: BattleState, actor: Combatant, ev: BattleEvent[]): boolean {
  const sn = has(actor, "snare");
  if (!sn) return false;
  removeStatus(actor, "snare");
  autoUntie(s, actor, "k_snare", ev);
  ev.push({ t: "down", who: actor.id });
  actor.tempo += actionDelay(actor, 0.8);
  return true;
}

// ---------------------------------------------------------------------------
// Items

function useItem(s: BattleState, actor: Combatant, itemId: string, targetId: string | undefined, ev: BattleEvent[]): void {
  const inv = itemsOf(s);
  const it = ITEMS[itemId];
  if (!it || (inv[itemId] ?? 0) <= 0) { ev.push({ t: "text", text: "None left." }); return; }
  inv[itemId]--;
  ev.push({ t: "item", who: actor.id, item: itemId, target: targetId });
  const rng = rngOf(s);
  if (it.target === "enemy") {
    const sk: Skill = { id: itemId, name: it.name, desc: "", kind: "attack", cost: 0, target: it.id === "firepot" ? "allEnemies" : "enemy", element: it.element, power: it.power, magic: true };
    const targets = sk.target === "allEnemies" ? foesOf(s, actor) : targetId ? [byId(s, targetId)] : [];
    const thrower: Combatant = { ...actor, mag: 14 + actor.level * 1.5, statuses: [] };
    // A thrown element answers that element's lock
    if (it.element) matchLocks(s, actor, it.element, targets, ev);
    for (const t of targets) dealDamage(s, thrower, t, sk, 1, ev);
    return;
  }
  const targets = it.target === "allAllies" ? alive(party(s)) : targetId ? [byId(s, targetId)] : [actor];
  for (const t of targets) {
    if (it.revive) {
      if (!t.alive && !t.taken) {
        t.alive = true;
        t.hp = Math.max(1, Math.round(t.maxHp * (it.healPct ?? 0.5)));
        t.tempo = Math.max(...alive(s.combatants).map((c) => c.tempo)) + actionDelay(t, 0.5);
        ev.push({ t: "heal", who: actor.id, target: t.id, amount: t.hp });
      }
      continue;
    }
    if (!t.alive) continue;
    if (it.heal !== undefined) heal(s, actor, t, Math.round(it.heal + (it.healPct ?? 0) * t.maxHp), ev);
    if (it.tension) addTension(s, t, it.tension, ev);
    if (it.pool && t.economy !== "tension") { t.pool = Math.min(t.maxPool, t.pool + it.pool); ev.push({ t: "pool", target: t.id, delta: it.pool, now: t.pool }); }
    if (it.cure) { t.statuses = t.statuses.filter((st) => st.turns >= 99 || ["guard", "duck", "haste", "atkUp", "defUp", "focus", "steady", "shield", "hold", "swallow", "brace", "taunt"].includes(st.id)); ev.push({ t: "status", target: t.id, status: "down", on: false }); }
  }
  void rng;
}

// ---------------------------------------------------------------------------
// The Hand (player two)

function handAct(s: BattleState, kind: "tug" | "steady" | "pinch", targetId: string, ev: BattleEvent[]): void {
  const t = s.combatants.find((c) => c.id === targetId);
  if (!t || !t.alive) return;
  if (s.hand[kind] > 0) return;
  s.hand.uses++;
  ev.push({ t: "hand", kind, target: t.id });
  if (kind === "tug") {
    if (t.economy === "tension" && !t.letGo) addTension(s, t, 1, ev);
    else if (t.pool < t.maxPool) { t.pool++; ev.push({ t: "pool", target: t.id, delta: 1, now: t.pool }); }
    s.hand.tug = 4;
  } else if (kind === "steady") {
    addStatus(s, t, "steady", 2, ev);
    s.hand.steady = 5;
  } else {
    if (t.held && !t.letGo) addTension(s, t, -1, ev);
    t.tempo += actionDelay(t, 0.3);
    s.hand.pinch = 4;
  }
}

// ---------------------------------------------------------------------------
// Target helpers shared with the AI

export function pickWeakest(cs: Combatant[], rng: Rng): Combatant | null {
  if (!cs.length) return null;
  const taunters = cs.filter((c) => has(c, "taunt"));
  const pool = taunters.length ? taunters : cs;
  // Prefer low HP but with some randomness so fights are not fully deterministic
  const sorted = [...pool].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  return rng.chance(0.7) ? sorted[0] : rng.pick(pool);
}

export function pickEnemyTarget(s: BattleState, actor: Combatant, sk: Skill): Combatant | null {
  const foes = foesOf(s, actor);
  if (!foes.length) return null;
  const rng = rngOf(s);
  if (sk.kind === "pluck") {
    const held = foes.filter((f) => f.held && !f.letGo);
    if (!held.length) return pickWeakest(foes, rng);
    return [...held].sort((a, b) => b.tension - a.tension)[0];
  }
  if (sk.effect === "giveTension" || sk.effect === "stealTension") {
    const held = foes.filter((f) => f.held && !f.letGo);
    if (!held.length) return null;
    return [...held].sort((a, b) => b.tension - a.tension)[0];
  }
  if (sk.effect === "rehold") {
    const lg = foes.filter((f) => f.letGo && !f.reheld);
    return lg.length ? rng.pick(lg) : pickWeakest(foes, rng);
  }
  if (sk.effect === "cutKnots" || sk.effect === "eatPool") {
    const f = foes.find((x) => x.economy === "length");
    if (f && (f.knots.length || sk.effect === "eatPool")) return f;
  }
  if (sk.shape === "lane" || sk.shape === "adjacent") {
    // The lane with the most foes
    const counts = [0, 1, 2].map((l) => foes.filter((f) => f.lane === l).length);
    const best = counts.indexOf(Math.max(...counts));
    const inLane = foes.filter((f) => f.lane === best);
    return pickWeakest(inLane.length ? inLane : foes, rng);
  }
  return pickWeakest(foes, rng);
}

export function partyAverageLevel(s: BattleState): number {
  const p = party(s);
  return p.reduce((a, c) => a + c.level, 0) / Math.max(1, p.length);
}
