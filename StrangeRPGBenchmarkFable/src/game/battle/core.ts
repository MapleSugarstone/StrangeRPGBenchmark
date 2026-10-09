import { Rng } from "../../engine/rng";
import type { SpriteSpec } from "../../engine/sprites";
import type { Element, MechId, Stats, StatusId, SkillDef, EnemyDef, PartyMember, Passive, TargetKind } from "../types";
import { SKILLS, skill } from "../data/skills";
import { ITEMS } from "../data/items";
import { CHARACTERS, CLASSES } from "../data/classes";
import { memberStats, memberSkills, memberPassives } from "../party";

export interface Status { id: StatusId; turns: number }

export interface Combatant {
  uid: number;
  id: string;
  name: string;
  side: "party" | "enemy";
  sprite: SpriteSpec;
  level: number;
  max: Stats;
  hp: number;
  st: number;
  statuses: Status[];
  skills: string[];
  passives: Passive[];
  weak: Element[];
  resist: Element[];
  absorb: Element[];
  row: "front" | "back";
  /** Timeline position. Lowest acts next. */
  tempo: number;
  /** Elemental charge left by the last elemental hit, for Links. */
  charge: Element | null;
  /** Damage taken during the previous full round, for Hindsight. */
  lastTaken: number;
  takenThisTurn: number;
  guarding: boolean;
  /** Pending survive from the Yesterday memory. */
  surviveUsed: boolean;
  /** Fusion: uid of the partner absorbed into this one. */
  fusedWith: number | null;
  fuseTurns: number;
  enemyDef?: EnemyDef;
  member?: PartyMember;
  revealed: boolean;
  ai: EnemyDef["ai"];
  boss: boolean;
  acted: number;
}

export type Action =
  | { type: "skill"; skillId: string; actor: number; target: number | null }
  | { type: "item"; itemId: string; actor: number; target: number | null }
  | { type: "flee"; actor: number }
  | { type: "word"; actor: number; words: [string, string, string]; target: number | null };

export type BattleEvent =
  | { type: "act"; actor: number; name: string; skillId?: string }
  | { type: "damage"; target: number; amount: number; element: Element; crit: boolean; weak: boolean; resist: boolean; absorb: boolean; source: number }
  | { type: "heal"; target: number; amount: number }
  | { type: "st"; target: number; amount: number }
  | { type: "miss"; target: number }
  | { type: "status"; target: number; id: StatusId; on: boolean }
  | { type: "death"; target: number }
  | { type: "revive"; target: number }
  | { type: "text"; text: string }
  | { type: "link"; name: string; target: number }
  | { type: "tempo"; target: number; amount: number }
  | { type: "row"; target: number; row: "front" | "back" }
  | { type: "debt"; amount: number; total: number }
  | { type: "rewind" }
  | { type: "fuse"; a: number; b: number; on: boolean }
  | { type: "flee"; ok: boolean }
  | { type: "line"; speaker: string; text: string }
  | { type: "turn"; actor: number }
  | { type: "gold"; amount: number };

export interface BattleState {
  combatants: Combatant[];
  mechanics: Set<MechId>;
  rng: Rng;
  turn: number;
  round: number;
  debt: number;
  gold: number;
  words: string[];
  rewindsLeft: number;
  snapshot: string | null;
  over: "win" | "lose" | "flee" | null;
  inventory: Record<string, number>;
  fleeable: boolean;
  bossHalfSaid: boolean;
  log: BattleEvent[];
  /** Counts of each skill id used by the party, for the balance tools. */
  usage: Record<string, number>;
  nextUid: number;
}

export const TEMPO_BASE = 1000;
let uidCounter = 1;

export function makePartyCombatant(m: PartyMember, mechanics: Set<MechId>): Combatant {
  const c = CHARACTERS[m.charId];
  const stats = memberStats(m);
  const passives = memberPassives(m);
  const weak: Element[] = [];
  const resist: Element[] = [];
  for (const p of passives) { if (p.resist) resist.push(...p.resist); if (p.weak) weak.push(...p.weak); }
  return {
    uid: uidCounter++, id: m.charId, name: c.short ?? c.name, side: "party", sprite: c.sprite, level: m.level,
    max: stats, hp: Math.min(m.hp, stats.hp), st: Math.min(m.st, stats.st), statuses: [],
    skills: memberSkills(m, mechanics), passives, weak, resist, absorb: [],
    row: "front", tempo: 0, charge: null, lastTaken: 0, takenThisTurn: 0, guarding: false,
    surviveUsed: false, fusedWith: null, fuseTurns: 0, member: m, revealed: true, ai: "basic", boss: false, acted: 0,
  };
}

export function makeEnemyCombatant(def: EnemyDef): Combatant {
  return {
    uid: uidCounter++, id: def.id, name: def.name, side: "enemy", sprite: def.sprite,
    level: def.level, max: { ...def.stats }, hp: def.stats.hp, st: def.stats.st, statuses: [],
    skills: def.skills, passives: [], weak: def.weak, resist: def.resist, absorb: def.absorb ?? [],
    row: def.row ?? "front", tempo: 0, charge: null, lastTaken: 0, takenThisTurn: 0, guarding: false,
    surviveUsed: false, fusedWith: null, fuseTurns: 0, enemyDef: def, revealed: false, ai: def.ai, boss: !!def.boss, acted: 0,
  };
}

export interface BattleSetup {
  party: PartyMember[];
  enemies: EnemyDef[];
  mechanics: MechId[];
  seed: number;
  inventory: Record<string, number>;
  gold: number;
  debt: number;
  words: string[];
  fleeable?: boolean;
}

export function createBattle(setup: BattleSetup): BattleState {
  const mech = new Set(setup.mechanics);
  const rng = new Rng(setup.seed);
  const combatants = [
    ...setup.party.map((m) => makePartyCombatant(m, mech)),
    ...setup.enemies.map((e) => makeEnemyCombatant(e)),
  ];
  // Enemies with duplicate names get letters.
  const seen: Record<string, number> = {};
  for (const c of combatants) {
    if (c.side !== "enemy") continue;
    const n = seen[c.id] ?? 0;
    seen[c.id] = n + 1;
    const total = setup.enemies.filter((x) => x.id === c.id).length;
    c.name = total > 1 ? `${c.enemyDef!.name} ${String.fromCharCode(65 + n)}` : c.enemyDef!.name;
  }
  // Rows: with the rows mechanic, enemies after the second stand in back.
  if (mech.has("rows")) {
    let i = 0;
    for (const c of combatants) if (c.side === "enemy") { if (!c.enemyDef?.row) c.row = i >= 2 ? "back" : "front"; i++; }
  }
  for (const c of combatants) c.tempo = Math.round(TEMPO_BASE / effSpd(c) * (0.6 + rng.next() * 0.4));
  const state: BattleState = {
    combatants, mechanics: mech, rng, turn: 0, round: 0, debt: setup.debt, gold: setup.gold, words: setup.words,
    rewindsLeft: mech.has("rewind") ? 1 : 0, snapshot: null, over: null, inventory: { ...setup.inventory },
    fleeable: setup.fleeable ?? !setup.enemies.some((e) => e.boss), bossHalfSaid: false, log: [], usage: {}, nextUid: uidCounter,
  };
  for (const c of combatants) if (c.boss && c.enemyDef?.lines?.start) state.log.push({ type: "line", speaker: c.name, text: c.enemyDef.lines.start });
  return state;
}

// ---------- Stat helpers ----------

export function has(c: Combatant, id: StatusId): boolean {
  return c.statuses.some((s) => s.id === id);
}

function passiveSum(c: Combatant, key: keyof Passive): number {
  let n = 0;
  for (const p of c.passives) { const v = p[key]; if (typeof v === "number") n += v; }
  return n;
}

function passiveRule(c: Combatant, rule: string): boolean {
  return c.passives.some((p) => p.rule === rule);
}

export function effAtk(c: Combatant): number {
  let v = c.max.atk * (1 + passiveSum(c, "atkPct") / 100);
  if (has(c, "atkup")) v *= 1.3;
  if (has(c, "atkdown")) v *= 0.7;
  return v;
}
export function effMag(c: Combatant): number {
  let v = c.max.mag * (1 + passiveSum(c, "magPct") / 100);
  if (has(c, "magup")) v *= 1.3;
  if (has(c, "magdown")) v *= 0.7;
  return v;
}
export function effDef(c: Combatant): number {
  let v = c.max.def * (1 + passiveSum(c, "defPct") / 100);
  if (has(c, "defup")) v *= 1.3;
  if (has(c, "defdown")) v *= 0.7;
  if (has(c, "burn")) v *= 0.85;
  return v;
}
export function effRes(c: Combatant): number {
  let v = c.max.res;
  if (has(c, "magup")) v *= 1.15;
  if (has(c, "magdown")) v *= 0.85;
  return v;
}
export function effSpd(c: Combatant): number {
  let v = c.max.spd * (1 + passiveSum(c, "spdPct") / 100);
  if (has(c, "haste")) v *= 1.5;
  if (has(c, "slow")) v *= 0.66;
  if (has(c, "freeze")) v *= 0.75;
  return Math.max(1, v);
}

/** A combatant that can act: alive and not absorbed into a fusion. */
export function active(c: Combatant): boolean {
  return c.hp > 0 && !isAbsorbed(c);
}

function isAbsorbed(c: Combatant): boolean {
  return c.fuseTurns < 0;
}

export function party(s: BattleState): Combatant[] {
  return s.combatants.filter((c) => c.side === "party");
}
export function enemies(s: BattleState): Combatant[] {
  return s.combatants.filter((c) => c.side === "enemy");
}
export function byUid(s: BattleState, uid: number): Combatant {
  return s.combatants.find((c) => c.uid === uid)!;
}

// ---------- Turn order ----------

export function nextActor(s: BattleState): Combatant {
  const pool = s.combatants.filter(active);
  pool.sort((a, b) => a.tempo - b.tempo || a.uid - b.uid);
  const next = pool[0];
  const shift = next.tempo;
  if (shift > 0) for (const c of pool) c.tempo -= shift;
  return next;
}

/** Predicted order of the next n turns, for the Tempo display. */
export function forecast(s: BattleState, n: number): Combatant[] {
  const sim = s.combatants.filter(active).map((c) => ({ c, t: c.tempo }));
  const out: Combatant[] = [];
  for (let i = 0; i < n && sim.length; i++) {
    sim.sort((a, b) => a.t - b.t || a.c.uid - b.c.uid);
    out.push(sim[0].c);
    sim[0].t += TEMPO_BASE / effSpd(sim[0].c);
  }
  return out;
}

function spendTurn(c: Combatant, weight = 1): void {
  c.tempo += Math.round((TEMPO_BASE / effSpd(c)) * weight);
  c.acted++;
}

// ---------- Legal actions ----------

export function usableSkills(s: BattleState, c: Combatant): string[] {
  const out: string[] = [];
  for (const id of c.skills) {
    const sk = SKILLS[id];
    if (!sk) continue;
    if (sk.mech && !s.mechanics.has(sk.mech)) continue;
    if (id === "rewind" && (s.rewindsLeft <= 0 || !s.snapshot)) continue;
    if (id === "fuse" && (c.fusedWith !== null || party(s).filter((p) => active(p) && p.uid !== c.uid).length === 0)) continue;
    out.push(id);
  }
  return out;
}

export function canPay(s: BattleState, c: Combatant, sk: SkillDef): boolean {
  if (sk.kind !== "support" && sk.kind !== "heal" && sk.kind !== "special" && has(c, "silence") && sk.id !== "attack") return false;
  if (has(c, "silence") && sk.cost > 0) return false;
  return c.st >= sk.cost;
}

export function validTargets(s: BattleState, actor: Combatant, target: TargetKind): Combatant[] {
  const foes = s.combatants.filter((c) => c.side !== actor.side && active(c));
  const friends = s.combatants.filter((c) => c.side === actor.side && active(c));
  switch (target) {
    case "enemy": {
      const taunters = foes.filter((f) => has(f, "taunt"));
      return taunters.length ? taunters : foes;
    }
    case "enemies": return foes;
    case "ally": return friends;
    case "allies": return friends;
    case "self": return [actor];
    case "deadally": return s.combatants.filter((c) => c.side === actor.side && c.hp <= 0 && !isAbsorbed(c));
    case "any": return [...foes, ...friends];
  }
}

export function needsTarget(target: TargetKind): boolean {
  return target === "enemy" || target === "ally" || target === "deadally" || target === "any";
}

// ---------- Damage ----------

export interface DamageOpts {
  power: number;
  element: Element;
  kind: "phys" | "mag";
  crit?: number;
  ranged?: boolean;
  acc?: number;
}

export function elementMult(target: Combatant, el: Element): { mult: number; weak: boolean; resist: boolean; absorb: boolean } {
  if (el === "null") return { mult: 1, weak: false, resist: false, absorb: false };
  if (target.absorb.includes(el)) return { mult: -0.5, weak: false, resist: false, absorb: true };
  const w = target.weak.includes(el) || (el === "heat" && has(target, "freeze"));
  const r = target.resist.includes(el) || target.passives.some((p) => p.resist?.includes(el));
  if (w && !r) return { mult: 1.5, weak: true, resist: false, absorb: false };
  if (r && !w) return { mult: 0.5, weak: false, resist: true, absorb: false };
  return { mult: 1, weak: false, resist: false, absorb: false };
}

export function computeDamage(s: BattleState, actor: Combatant, target: Combatant, o: DamageOpts): { amount: number; crit: boolean; weak: boolean; resist: boolean; absorb: boolean; miss: boolean } {
  const rng = s.rng;
  // Accuracy.
  let acc = o.acc ?? 0.95;
  if (has(actor, "blind")) acc *= 0.5;
  if (o.kind === "mag") acc = Math.max(acc, 0.9);
  if (o.acc !== 1 && !rng.chance(acc)) return { amount: 0, crit: false, weak: false, resist: false, absorb: false, miss: true };
  const atk = o.kind === "phys" ? effAtk(actor) : effMag(actor);
  const def = o.kind === "phys" ? effDef(target) : effRes(target);
  let dmg = (o.power / 100) * atk * (atk / (atk + def)) * 1.6;
  const em = elementMult(target, o.element);
  dmg *= Math.abs(em.mult);
  // Element boosts from passives.
  if (o.element !== "null" && actor.passives.some((p) => p.elementBoost === o.element)) dmg *= 1.25;
  if (o.element === "light" && has(target, "lit")) dmg *= 1.3;
  // Rows.
  if (s.mechanics.has("rows") && !o.ranged && o.kind === "phys") {
    if (actor.row === "back" && !passiveRule(actor, "anyrow")) dmg *= 0.6;
    if (target.row === "back") dmg *= 0.6;
  }
  // Guard, brace, shield.
  if (target.guarding) dmg *= 0.5;
  if (has(target, "shield")) dmg *= 0.5;
  if (has(actor, "brace")) dmg *= 2;
  // Crit.
  const critChance = (o.crit ?? 0.05) + passiveSum(actor, "critPct") / 100;
  const crit = rng.chance(critChance);
  if (crit) dmg *= 1.6;
  dmg *= 0.9 + rng.next() * 0.2;
  let amount = Math.max(1, Math.round(dmg));
  if (em.absorb) amount = -Math.round(dmg);
  return { amount, crit, weak: em.weak, resist: em.resist, absorb: em.absorb, miss: false };
}

function applyDamage(s: BattleState, ev: BattleEvent[], target: Combatant, amount: number, source: Combatant | null, element: Element, meta: { crit: boolean; weak: boolean; resist: boolean; absorb: boolean }): number {
  if (amount < 0) {
    const h = Math.min(-amount, target.max.hp - target.hp);
    target.hp += h;
    ev.push({ type: "damage", target: target.uid, amount, element, source: source?.uid ?? -1, ...meta });
    return 0;
  }
  let dealt = Math.min(amount, target.hp);
  target.hp -= amount;
  target.takenThisTurn += dealt;
  if (target.hp <= 0 && passiveRule(target, "survive") && !target.surviveUsed) {
    target.hp = 1;
    target.surviveUsed = true;
    ev.push({ type: "damage", target: target.uid, amount, element, source: source?.uid ?? -1, ...meta });
    ev.push({ type: "text", text: `${target.name} remembers yesterday and survives.` });
    return dealt;
  }
  ev.push({ type: "damage", target: target.uid, amount, element, source: source?.uid ?? -1, ...meta });
  if (target.hp <= 0) {
    target.hp = 0;
    target.statuses = [];
    target.guarding = false;
    ev.push({ type: "death", target: target.uid });
    if (target.boss && target.enemyDef?.lines?.death) ev.push({ type: "line", speaker: target.name, text: target.enemyDef.lines.death });
    if (target.fusedWith !== null) unfuse(s, ev, target);
  } else if (target.boss && !s.bossHalfSaid && target.hp <= target.max.hp / 2) {
    // Second phase: every boss gets faster and hits harder once it is bleeding.
    s.bossHalfSaid = true;
    if (target.enemyDef?.lines?.half) ev.push({ type: "line", speaker: target.name, text: target.enemyDef.lines.half });
    ev.push({ type: "text", text: `${target.name} is enraged.` });
    for (const id of ["atkup", "magup", "haste"] as StatusId[]) {
      const ex = target.statuses.find((x) => x.id === id);
      if (ex) ex.turns = 99; else target.statuses.push({ id, turns: 99 });
      ev.push({ type: "status", target: target.uid, id, on: true });
    }
    for (const id of ["atkdown", "magdown", "slow"] as StatusId[]) removeStatus(ev, target, id);
  }
  // Lifesteal and counters.
  if (source && dealt > 0 && source.hp > 0) {
    const ls = passiveSum(source, "lifesteal");
    if (ls > 0) {
      const h = Math.min(Math.round((dealt * ls) / 100), source.max.hp - source.hp);
      if (h > 0) { source.hp += h; ev.push({ type: "heal", target: source.uid, amount: h }); }
    }
    const ct = passiveSum(target, "counter");
    if (ct > 0 && target.hp > 0 && s.rng.chance(ct / 100)) {
      ev.push({ type: "text", text: `${target.name} counters!` });
      const r = computeDamage(s, target, source, { power: 70, element: "null", kind: "phys", acc: 1 });
      applyDamage(s, ev, source, r.amount, null, "null", r);
    }
  }
  return dealt;
}

export function addStatus(s: BattleState, ev: BattleEvent[], target: Combatant, id: StatusId, turns: number): boolean {
  if (target.hp <= 0) return false;
  if (target.passives.some((p) => p.immune?.includes(id))) { ev.push({ type: "text", text: `${target.name} is immune.` }); return false; }
  if (target.boss && (id === "doom" || id === "shock" || id === "freeze") && s.rng.chance(0.6)) { ev.push({ type: "text", text: `${target.name} shrugs it off.` }); return false; }
  // Opposed buffs cancel.
  const opposed: Partial<Record<StatusId, StatusId>> = { atkup: "atkdown", atkdown: "atkup", defup: "defdown", defdown: "defup", magup: "magdown", magdown: "magup", haste: "slow", slow: "haste" };
  const opp = opposed[id];
  if (opp && has(target, opp)) { removeStatus(ev, target, opp); return true; }
  const ex = target.statuses.find((x) => x.id === id);
  if (ex) ex.turns = Math.max(ex.turns, turns);
  else target.statuses.push({ id, turns });
  ev.push({ type: "status", target: target.uid, id, on: true });
  return true;
}

export function removeStatus(ev: BattleEvent[], target: Combatant, id: StatusId): void {
  const i = target.statuses.findIndex((x) => x.id === id);
  if (i >= 0) { target.statuses.splice(i, 1); ev.push({ type: "status", target: target.uid, id, on: false }); }
}

function heal(ev: BattleEvent[], target: Combatant, amount: number): void {
  if (target.hp <= 0) return;
  const h = Math.max(0, Math.min(Math.round(amount), target.max.hp - target.hp));
  target.hp += h;
  ev.push({ type: "heal", target: target.uid, amount: h });
}

// ---------- Links (chapter three) ----------

const LINKS: Record<string, { name: string; mult: number; aoe?: boolean; status?: StatusId; tempo?: number }> = {
  "heat+cold": { name: "SHATTER", mult: 1.8 },
  "cold+heat": { name: "SHATTER", mult: 1.8 },
  "heat+volt": { name: "OVERLOAD", mult: 1.2, aoe: true },
  "volt+heat": { name: "OVERLOAD", mult: 1.2, aoe: true },
  "rot+volt": { name: "BLIGHT", mult: 1.1, status: "poison" },
  "volt+rot": { name: "BLIGHT", mult: 1.1, status: "poison" },
  "cold+rot": { name: "STALL", mult: 1.2, tempo: 50 },
  "rot+cold": { name: "STALL", mult: 1.2, tempo: 50 },
  "light+heat": { name: "FLASHFIRE", mult: 1.5, status: "blind" },
  "heat+light": { name: "FLASHFIRE", mult: 1.5, status: "blind" },
  "light+cold": { name: "GLARE", mult: 1.4, status: "freeze" },
  "cold+light": { name: "GLARE", mult: 1.4, status: "freeze" },
  "light+volt": { name: "ARC", mult: 1.3, aoe: true },
  "volt+light": { name: "ARC", mult: 1.3, aoe: true },
  "light+rot": { name: "WITHER", mult: 1.3, status: "defdown" },
  "rot+light": { name: "WITHER", mult: 1.3, status: "defdown" },
};

function applyLink(s: BattleState, ev: BattleEvent[], actor: Combatant, target: Combatant, el: Element, baseAmount: number): void {
  if (!s.mechanics.has("links") || el === "null") return;
  if (target.charge && target.charge !== el) {
    const link = LINKS[`${target.charge}+${el}`];
    if (link) {
      ev.push({ type: "link", name: link.name, target: target.uid });
      const extra = Math.max(1, Math.round(baseAmount * (link.mult - 1) + baseAmount * 0.5));
      const victims = link.aoe ? s.combatants.filter((c) => c.side === target.side && active(c)) : [target];
      for (const v of victims) {
        applyDamage(s, ev, v, extra, actor, "null", { crit: false, weak: false, resist: false, absorb: false });
        if (link.status) addStatus(s, ev, v, link.status, 2);
        if (link.tempo) { v.tempo += link.tempo * 10; ev.push({ type: "tempo", target: v.uid, amount: link.tempo }); }
      }
      target.charge = null;
      return;
    }
  }
  target.charge = el;
}

// ---------- Fusion (chapter eight) ----------

function fuse(s: BattleState, ev: BattleEvent[], a: Combatant, b: Combatant): void {
  a.fusedWith = b.uid;
  a.fuseTurns = 3;
  b.fuseTurns = -1;
  b.fusedWith = a.uid;
  const merged: Stats = { ...a.max };
  for (const k of Object.keys(merged) as (keyof Stats)[]) merged[k] = Math.round(Math.max(a.max[k], b.max[k]) * 1.15 + Math.min(a.max[k], b.max[k]) * 0.35);
  a.max = merged;
  a.hp = Math.min(merged.hp, a.hp + b.hp);
  a.st = Math.min(merged.st, a.st + b.st);
  a.skills = Array.from(new Set([...a.skills, ...b.skills])).filter((x) => x !== "fuse");
  a.passives = [...a.passives, ...b.passives];
  a.name = `${a.name.split("+")[0]}+${b.name}`;
  ev.push({ type: "fuse", a: a.uid, b: b.uid, on: true });
}

function unfuse(s: BattleState, ev: BattleEvent[], a: Combatant): void {
  const b = byUid(s, a.fusedWith!);
  const half = Math.max(1, Math.floor(a.hp / 2));
  const stHalf = Math.floor(a.st / 2);
  // Restore both from their member definitions.
  const ra = a.member ? makePartyCombatant(a.member, s.mechanics) : null;
  const rb = b.member ? makePartyCombatant(b.member, s.mechanics) : null;
  if (ra) { a.max = ra.max; a.skills = ra.skills; a.passives = ra.passives; a.name = ra.name; }
  if (rb) { b.max = rb.max; b.skills = rb.skills; b.passives = rb.passives; b.name = rb.name; }
  a.hp = a.hp <= 0 ? 0 : Math.min(a.max.hp, half);
  b.hp = a.hp <= 0 ? 0 : Math.min(b.max.hp, half);
  a.st = Math.min(a.max.st, stHalf);
  b.st = Math.min(b.max.st, stHalf);
  a.fusedWith = null; b.fusedWith = null; a.fuseTurns = 0; b.fuseTurns = 0;
  b.tempo = a.tempo + 100;
  ev.push({ type: "fuse", a: a.uid, b: b.uid, on: false });
}

// ---------- Words (chapter nine) ----------

export function wordSpell(words: [string, string, string]): SkillDef | null {
  const verb = words[0], noun = words[1], shape = words[2];
  const el: Record<string, Element> = { w_burn: "heat", w_freeze: "cold", w_shock: "volt", w_rot: "rot", w_shine: "light" };
  const targets: Record<string, TargetKind> = { w_foe: "enemy", w_foes: "enemies", w_friend: "ally", w_friends: "allies", w_self: "self" };
  if (!targets[noun]) return null;
  const sk: SkillDef = { id: `word:${words.join(",")}`, name: words.map((w) => w.slice(2).toUpperCase()).join(" "), desc: "", cost: 6, target: targets[noun], kind: "mag", power: 120, ranged: true };
  if (verb === "w_mend") { sk.kind = "heal"; sk.heal = 40; delete sk.power; }
  else if (el[verb]) sk.element = el[verb];
  else return null;
  if (sk.kind === "mag" && (sk.target === "ally" || sk.target === "allies" || sk.target === "self")) return null;
  if (sk.kind === "heal" && (sk.target === "enemy" || sk.target === "enemies")) return null;
  if (sk.target === "enemies" || sk.target === "allies") { sk.cost += 4; if (sk.power) sk.power = Math.round(sk.power * 0.8); if (sk.heal) sk.heal = Math.round(sk.heal * 0.7); }
  if (shape === "w_twice") { sk.hits = 2; sk.cost += 4; if (sk.power) sk.power = Math.round(sk.power * 0.7); if (sk.heal) sk.heal = Math.round(sk.heal * 0.7); }
  else if (shape === "w_slow") { sk.cost += 2; if (sk.element === "heat") sk.status = [{ id: "burn", turns: 3 }]; else if (sk.element === "rot") sk.status = [{ id: "poison", turns: 3 }]; else if (sk.heal) sk.status = [{ id: "regen", turns: 3 }]; else if (sk.element === "cold") sk.status = [{ id: "freeze", turns: 2 }]; else if (sk.element === "volt") sk.status = [{ id: "shock", turns: 1 }]; else sk.status = [{ id: "lit", turns: 3 }]; }
  else if (shape === "w_loud") { sk.cost = Math.round(sk.cost * 2.2); if (sk.power) sk.power = Math.round(sk.power * 1.9); if (sk.heal) sk.heal = Math.round(sk.heal * 2); }
  else if (shape === "w_quiet") { sk.cost = Math.max(1, Math.round(sk.cost * 0.4)); if (sk.power) sk.power = Math.round(sk.power * 0.55); if (sk.heal) sk.heal = Math.round(sk.heal * 0.5); }
  else return null;
  return sk;
}

// ---------- Resolving actions ----------

export function performAction(s: BattleState, action: Action): BattleEvent[] {
  const ev: BattleEvent[] = [];
  const actor = byUid(s, action.actor);
  if (!active(actor)) return ev;
  const isRewind = action.type === "skill" && action.skillId === "rewind";
  if (s.mechanics.has("rewind") && actor.side === "party" && !isRewind) s.snapshot = serialize(s);
  s.turn++;
  actor.guarding = false;
  // Shock may cost the turn.
  if (has(actor, "shock") && s.rng.chance(0.5)) {
    ev.push({ type: "act", actor: actor.uid, name: "is shocked" });
    ev.push({ type: "text", text: `${actor.name} twitches and loses the turn.` });
    spendTurn(actor);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (action.type === "flee") {
    const avg = (arr: Combatant[]) => arr.reduce((a, c) => a + effSpd(c), 0) / Math.max(1, arr.length);
    const ok = s.fleeable && s.rng.chance(Math.min(0.9, 0.5 + (avg(party(s).filter(active)) - avg(enemies(s).filter(active))) * 0.05));
    ev.push({ type: "act", actor: actor.uid, name: "Flee" });
    ev.push({ type: "flee", ok });
    if (ok) s.over = "flee";
    else { spendTurn(actor); endOfTurn(s, ev, actor); }
    return ev;
  }
  if (action.type === "item") {
    const it = ITEMS[action.itemId];
    if (!it?.use || (s.inventory[it.id] ?? 0) <= 0) return ev;
    s.inventory[it.id]--;
    ev.push({ type: "act", actor: actor.uid, name: it.name });
    const targets = pickTargets(s, actor, it.use.target, action.target);
    for (const t of targets) {
      if (it.use.heal) heal(ev, t, it.use.heal);
      if (it.use.healPct) heal(ev, t, t.max.hp * it.use.healPct);
      if (it.use.st || it.use.stPct) { const g = Math.min((it.use.st ?? 0) + Math.round(t.max.st * (it.use.stPct ?? 0)), t.max.st - t.st); t.st += g; ev.push({ type: "st", target: t.uid, amount: g }); }
      if (it.use.revive && t.hp <= 0) { t.hp = Math.max(1, Math.round(t.max.hp * it.use.revive)); ev.push({ type: "revive", target: t.uid }); t.tempo = Math.max(...s.combatants.map((c) => c.tempo)); }
      if (it.use.cure) for (const id of it.use.cure) removeStatus(ev, t, id);
      if (it.use.status) for (const st of it.use.status) addStatus(s, ev, t, st.id, st.turns);
      if (it.use.power) {
        const r = computeDamage(s, actor, t, { power: it.use.power, element: it.use.element ?? "null", kind: "mag", acc: 1, ranged: true });
        applyDamage(s, ev, t, r.amount, actor, it.use.element ?? "null", r);
        if (it.use.element) applyLink(s, ev, actor, t, it.use.element, Math.abs(r.amount));
      }
      if (it.id === "tooth") { const p = Math.min(5, s.debt); s.debt -= p; ev.push({ type: "debt", amount: -p, total: s.debt }); }
    }
    s.usage[`item:${it.id}`] = (s.usage[`item:${it.id}`] ?? 0) + 1;
    spendTurn(actor);
    endOfTurn(s, ev, actor);
    return ev;
  }
  let sk: SkillDef | null;
  if (action.type === "word") {
    sk = wordSpell(action.words);
    if (!sk) return ev;
  } else {
    sk = skill(action.skillId);
  }
  if (!canPay(s, actor, sk)) { ev.push({ type: "text", text: `${actor.name} cannot use ${sk.name}.` }); return ev; }
  if (actor.side === "party") s.usage[sk.id.startsWith("word:") ? "word" : sk.id] = (s.usage[sk.id.startsWith("word:") ? "word" : sk.id] ?? 0) + 1;
  actor.st -= sk.cost;
  ev.push({ type: "act", actor: actor.uid, name: sk.name, skillId: sk.id });
  let weight = 1;

  // Specials that replace normal resolution.
  if (sk.special === "guard") {
    actor.guarding = true;
    if (s.mechanics.has("brace")) addStatus(s, ev, actor, "brace", 2);
    spendTurn(actor, 0.7);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "delay") {
    const g = Math.min(3, actor.max.st - actor.st);
    actor.st += g;
    ev.push({ type: "st", target: actor.uid, amount: g });
    spendTurn(actor, 0.5);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "borrow") {
    const g = Math.min(8, actor.max.st - actor.st);
    actor.st += g;
    ev.push({ type: "st", target: actor.uid, amount: g });
    s.debt += 4;
    ev.push({ type: "debt", amount: 4, total: s.debt });
    spendTurn(actor, 0.5);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "rewind") {
    if (!s.snapshot || s.rewindsLeft <= 0) return ev;
    const snap = s.snapshot;
    const left = s.rewindsLeft - 1;
    restore(s, snap);
    s.rewindsLeft = left;
    s.snapshot = null;
    ev.push({ type: "rewind" });
    ev.push({ type: "text", text: "The last turn unhappens." });
    return ev;
  }
  if (sk.special === "swaprow") {
    actor.row = actor.row === "front" ? "back" : "front";
    ev.push({ type: "row", target: actor.uid, row: actor.row });
    spendTurn(actor, 0.3);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "fuse") {
    const t = action.target !== null ? byUid(s, action.target) : null;
    if (!t || t.side !== actor.side || !active(t) || t.uid === actor.uid) return ev;
    fuse(s, ev, actor, t);
    spendTurn(actor, 0.3);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.debt) { s.debt += sk.debt; ev.push({ type: "debt", amount: sk.debt, total: s.debt }); }

  let targets = pickTargets(s, actor, sk.target, action.target);
  if (sk.special === "randomtargets") {
    const foes = validTargets(s, actor, "enemies");
    targets = [];
    for (let i = 0; i < (sk.hits ?? 1); i++) targets.push(s.rng.pick(foes));
  }
  if (targets.length === 0) { ev.push({ type: "text", text: "No target." }); spendTurn(actor); endOfTurn(s, ev, actor); return ev; }

  let power = sk.power ?? 0;
  if (sk.special === "eatlight") {
    const buffs = actor.statuses.filter((x) => ["haste", "shield", "regen", "atkup", "defup", "magup", "lit", "brace"].includes(x.id));
    power += 60 * buffs.length + (has(actor, "lit") ? 40 : 0);
    for (const b of buffs) removeStatus(ev, actor, b.id);
    if (buffs.length) ev.push({ type: "text", text: `${actor.name} eats ${buffs.length} light${buffs.length > 1 ? "s" : ""}.` });
  }
  if (sk.special === "recite") {
    const mem = party(s).reduce((n, p) => n + (p.member?.memories.length ?? 0), 0);
    power += 15 * mem;
  }
  if (sk.special === "gamble") {
    const heads = s.rng.chance(0.5);
    power = heads ? power * 2 : power * 0.5;
    ev.push({ type: "text", text: heads ? "Heads!" : "Tails." });
  }
  if (sk.special === "bibliomancy") {
    const roll = s.rng.int(0, 5);
    const foes = validTargets(s, actor, "enemies"), friends = validTargets(s, actor, "allies");
    ev.push({ type: "text", text: ["Page 1: fire.", "Page 7: a lullaby.", "Page 12: rain.", "Page 40: an apology.", "Page 99: the ending.", "Page 0: blank."][roll] });
    if (roll === 0) for (const f of foes) { const r = computeDamage(s, actor, f, { power: 120, element: "heat", kind: "mag", acc: 1, ranged: true }); applyDamage(s, ev, f, r.amount, actor, "heat", r); applyLink(s, ev, actor, f, "heat", Math.abs(r.amount)); }
    else if (roll === 1) for (const f of foes) addStatus(s, ev, f, "slow", 2);
    else if (roll === 2) for (const f of friends) heal(ev, f, 30);
    else if (roll === 3) for (const f of friends) for (const st of ["poison", "burn", "blind", "shock", "freeze", "silence"] as StatusId[]) removeStatus(ev, f, st);
    else if (roll === 4) { const f = s.rng.pick(foes); addStatus(s, ev, f, "doom", 3); }
    spendTurn(actor);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "dispense") {
    const t = targets[0];
    const roll = s.rng.int(0, 4);
    const names = ["a Brine Flask", "a Lamp Wick", "a Lit Candle", "a Sugar Pill", "a Rust Tonic"];
    ev.push({ type: "text", text: `The Vendor drops ${names[roll]}.` });
    if (roll === 0) heal(ev, t, 45);
    else if (roll === 1) { const g = Math.min(8, t.max.st - t.st); t.st += g; ev.push({ type: "st", target: t.uid, amount: g }); }
    else if (roll === 2) addStatus(s, ev, t, "lit", 3);
    else if (roll === 3) { addStatus(s, ev, t, "haste", 2); }
    else { addStatus(s, ev, t, "defup", 3); addStatus(s, ev, t, "atkup", 2); }
    spendTurn(actor);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "hindsight") {
    for (const t of targets) heal(ev, t, Math.max(10, t.lastTaken * 0.8));
    spendTurn(actor);
    endOfTurn(s, ev, actor);
    return ev;
  }
  if (sk.special === "selfhurt10") { const d = Math.max(1, Math.round(actor.max.hp * 0.1)); actor.hp = Math.max(1, actor.hp - d); ev.push({ type: "damage", target: actor.uid, amount: d, element: "null", crit: false, weak: false, resist: false, absorb: false, source: actor.uid }); }
  if (sk.special === "selfto1") { const d = actor.hp - 1; if (d > 0) { actor.hp = 1; ev.push({ type: "damage", target: actor.uid, amount: d, element: "null", crit: false, weak: false, resist: false, absorb: false, source: actor.uid }); } }

  const hits = sk.hits ?? 1;
  for (const t of targets) {
    if (t.hp <= 0 && sk.target !== "deadally") continue;
    for (let h = 0; h < hits; h++) {
      if (t.hp <= 0 && sk.target !== "deadally") break;
      if (sk.special === "reveal") t.revealed = true;
      if (sk.special === "dispel") {
        const buffs = t.statuses.filter((x) => ["haste", "shield", "regen", "atkup", "defup", "magup", "lit", "brace", "taunt"].includes(x.id));
        for (const b of buffs) removeStatus(ev, t, b.id);
      }
      if (sk.special === "forcedebt") { s.debt += 3; ev.push({ type: "debt", amount: 3, total: s.debt }); ev.push({ type: "text", text: `${t.name} is handed a loan.` }); }
      if (power > 0 && (sk.kind === "phys" || sk.kind === "mag")) {
        const r = computeDamage(s, actor, t, { power, element: sk.element ?? "null", kind: sk.kind, crit: sk.crit, ranged: sk.ranged, acc: sk.acc });
        if (r.miss) { ev.push({ type: "miss", target: t.uid }); continue; }
        const dealt = applyDamage(s, ev, t, r.amount, actor, sk.element ?? "null", r);
        if (sk.special === "lifesteal") heal(ev, actor, dealt * 0.5);
        if (sk.special === "steal" && t.side === "enemy") { const g = Math.min(t.enemyDef?.gold ?? 0, 5 + actor.level); s.gold += g; ev.push({ type: "gold", amount: g }); }
        if (sk.special === "steal" && t.side === "party") { const g = Math.min(s.gold, 10); s.gold -= g; ev.push({ type: "gold", amount: -g }); }
        if (sk.element) applyLink(s, ev, actor, t, sk.element, Math.abs(r.amount));
        if (t.hp <= 0) break;
      }
      if (sk.heal) heal(ev, t, sk.heal + effMag(actor) * 1.2);
      if (sk.revive && t.hp <= 0) { t.hp = Math.max(1, Math.round(t.max.hp * sk.revive)); ev.push({ type: "revive", target: t.uid }); t.tempo = Math.max(...s.combatants.map((c) => c.tempo)); }
      if (sk.cure) for (const id of sk.cure) removeStatus(ev, t, id);
      if (sk.status) for (const st of sk.status) {
        const who = st.self ? actor : t;
        if (who.hp <= 0) continue;
        if (st.chance === undefined || s.rng.chance(st.chance * (who.side !== actor.side && who.boss ? 0.7 : 1))) addStatus(s, ev, who, st.id, st.turns);
      }
      if (sk.tempo && s.mechanics.has("tempo") || sk.tempo && actor.side === "enemy") {
        const amt = sk.tempo! * 10;
        t.tempo = Math.max(0, t.tempo + amt);
        ev.push({ type: "tempo", target: t.uid, amount: sk.tempo! });
      }
      if (sk.push && s.mechanics.has("rows")) {
        if (t.row !== sk.push) { t.row = sk.push; ev.push({ type: "row", target: t.uid, row: sk.push }); }
      }
    }
  }
  if (has(actor, "brace") && (sk.kind === "phys" || sk.kind === "mag")) removeStatus(ev, actor, "brace");
  spendTurn(actor, weight);
  endOfTurn(s, ev, actor);
  return ev;
}

function pickTargets(s: BattleState, actor: Combatant, kind: TargetKind, chosen: number | null): Combatant[] {
  const valid = validTargets(s, actor, kind);
  if (!needsTarget(kind)) return valid;
  if (chosen !== null) {
    const c = valid.find((x) => x.uid === chosen);
    if (c) return [c];
  }
  return valid.length ? [valid[0]] : [];
}

/** Status ticks, regen, poison, doom, debt interest. Runs after the actor's action. */
function endOfTurn(s: BattleState, ev: BattleEvent[], actor: Combatant): void {
  if (actor.hp > 0) {
    if (has(actor, "poison")) { const d = Math.max(1, Math.round(actor.max.hp * 0.06)); applyDamage(s, ev, actor, d, null, "rot", { crit: false, weak: false, resist: false, absorb: false }); }
    if (has(actor, "burn")) { const d = Math.max(1, Math.round(actor.max.hp * 0.05)); applyDamage(s, ev, actor, d, null, "heat", { crit: false, weak: false, resist: false, absorb: false }); }
    if (has(actor, "regen")) heal(ev, actor, actor.max.hp * 0.08);
    const rg = passiveSum(actor, "regen"); if (rg > 0) heal(ev, actor, rg);
    const sr = passiveSum(actor, "stRegen"); if (sr > 0) { const g = Math.min(sr, actor.max.st - actor.st); if (g > 0) { actor.st += g; ev.push({ type: "st", target: actor.uid, amount: g }); } }
  }
  // Tick statuses for the actor.
  for (const st of [...actor.statuses]) {
    if (st.id === "brace") continue;
    st.turns--;
    if (st.id === "doom" && st.turns <= 0 && actor.hp > 0) {
      ev.push({ type: "text", text: `${actor.name}'s count runs out.` });
      applyDamage(s, ev, actor, actor.hp, null, "null", { crit: false, weak: false, resist: false, absorb: false });
      continue;
    }
    if (st.turns <= 0) removeStatus(ev, actor, st.id);
  }
  if (actor.fusedWith !== null && actor.fuseTurns > 0) {
    actor.fuseTurns--;
    if (actor.fuseTurns === 0) { ev.push({ type: "text", text: `${actor.name} comes apart.` }); unfuse(s, ev, actor); }
  }
  // Debt interest accrues on party turns.
  if (actor.side === "party" && s.mechanics.has("debt") && s.debt > 0) {
    const half = party(s).some((p) => passiveRule(p, "halfinterest"));
    const interest = Math.max(1, Math.round(s.debt * (half ? 0.04 : 0.08)));
    s.debt += interest;
    if (s.debt >= 40) {
      const d = Math.max(1, Math.round(actor.max.hp * 0.06));
      ev.push({ type: "text", text: "The Bank takes its teeth." });
      applyDamage(s, ev, actor, d, null, "null", { crit: false, weak: false, resist: false, absorb: false });
    }
  }
  // Round bookkeeping: lastTaken rolls over when the first party member acts.
  actor.lastTaken = actor.takenThisTurn;
  actor.takenThisTurn = 0;
  checkOver(s, ev);
}

export function checkOver(s: BattleState, ev: BattleEvent[]): void {
  if (s.over) return;
  if (!enemies(s).some((e) => e.hp > 0)) s.over = "win";
  else if (!party(s).some((p) => p.hp > 0)) s.over = "lose";
}

// ---------- Enemy AI ----------

export function enemyAction(s: BattleState, actor: Combatant): Action {
  const rng = s.rng;
  const foes = validTargets(s, actor, "enemy");
  const friends = validTargets(s, actor, "allies");
  const usable = usableSkills(s, actor).filter((id) => canPay(s, actor, SKILLS[id]));
  const pickFoe = (): Combatant => {
    if (actor.ai === "trickster" || actor.ai === "boss") {
      // Prefer the weakest by HP fraction. An enraged boss hunts.
      const sorted = [...foes].sort((a, b) => a.hp / a.max.hp - b.hp / b.max.hp);
      const focus = actor.boss && s.bossHalfSaid ? 0.85 : 0.6;
      return rng.chance(focus) ? sorted[0] : rng.pick(foes);
    }
    if (actor.ai === "brute") {
      const sorted = [...foes].sort((a, b) => effDef(a) - effDef(b));
      return rng.chance(0.5) ? sorted[0] : rng.pick(foes);
    }
    return rng.pick(foes);
  };
  const weights = usable.map((id) => {
    const sk = SKILLS[id];
    let w = id === "attack" ? 2 : 3;
    if (sk.kind === "heal" && sk.target === "self") w = actor.hp < actor.max.hp * 0.5 ? 6 : 0;
    else if (sk.kind === "heal") { const hurt = friends.filter((f) => f.hp < f.max.hp * 0.6); w = hurt.length ? 5 : 0; }
    else if (sk.status && sk.target === "allies" && sk.kind === "support") w = friends.every((f) => has(f, sk.status![0].id)) ? 0 : 3;
    else if (sk.id === "taunt") w = has(actor, "taunt") ? 0 : 2;
    else if (sk.id === "tock") w = actor.tempo > 0 ? 3 : 0;
    else if (sk.id === "tick" || sk.id === "lend" || sk.id === "repo") w = 3;
    else if (sk.target === "enemies") w = foes.length >= 2 ? (actor.boss && s.bossHalfSaid ? 7 : 4) : 2;
    if (actor.ai === "caster" && sk.kind === "mag") w += 2;
    if (actor.ai === "brute" && sk.kind === "phys" && id !== "attack") w += 2;
    if (actor.ai === "coward" && sk.kind === "heal") w += 3;
    if (actor.ai === "boss" && id !== "attack") w += 1;
    if (actor.ai === "tempo" && (sk.id === "tick" || sk.id === "tock")) w += 3;
    if (actor.ai === "banker" && (sk.id === "lend" || sk.id === "repo" || sk.id === "tithe")) w += 2;
    if (actor.ai === "linker" && sk.element) w += 2;
    // Bosses lean on their big attack at low HP.
    if (actor.boss && actor.hp < actor.max.hp * 0.4 && (sk.power ?? 0) >= 150) w += 4;
    return Math.max(0, w);
  });
  if (weights.every((w) => w === 0)) return { type: "skill", skillId: "attack", actor: actor.uid, target: foes[0]?.uid ?? null };
  const id = rng.weighted(usable, weights);
  const sk = SKILLS[id];
  let target: number | null = null;
  if (sk.target === "enemy") target = pickFoe()?.uid ?? null;
  else if (sk.target === "ally") { const hurt = [...friends].sort((a, b) => a.hp / a.max.hp - b.hp / b.max.hp); target = hurt[0]?.uid ?? actor.uid; }
  else if (sk.target === "self") target = actor.uid;
  return { type: "skill", skillId: id, actor: actor.uid, target };
}

// ---------- Snapshots for Rewind ----------

export function serialize(s: BattleState): string {
  return JSON.stringify({
    combatants: s.combatants.map((c) => ({ ...c, enemyDef: undefined, member: undefined, passives: undefined, sprite: undefined })),
    turn: s.turn, round: s.round, debt: s.debt, gold: s.gold, inventory: s.inventory, over: s.over, bossHalfSaid: s.bossHalfSaid,
    rngState: null,
  });
}

export function restore(s: BattleState, snap: string): void {
  const d = JSON.parse(snap);
  for (const cd of d.combatants) {
    const c = s.combatants.find((x) => x.uid === cd.uid)!;
    const keep = { enemyDef: c.enemyDef, member: c.member, passives: c.passives, sprite: c.sprite };
    Object.assign(c, cd, keep);
  }
  s.turn = d.turn; s.round = d.round; s.debt = d.debt; s.gold = d.gold; s.inventory = d.inventory; s.over = d.over; s.bossHalfSaid = d.bossHalfSaid;
}

// ---------- Rewards ----------

export interface Rewards { xp: number; gold: number; items: string[]; memories: string[] }

/** Random fights pay this many times an enemy's XP and salt, because they come about a third as often as they used to. */
export const RANDOM_FIGHT_REWARD = 3;

export function rewards(s: BattleState, mult = 1): Rewards {
  const r: Rewards = { xp: 0, gold: 0, items: [], memories: [] };
  for (const e of enemies(s)) {
    const d = e.enemyDef!;
    r.xp += Math.round(d.xp * mult);
    r.gold += Math.round(d.gold * mult);
    for (const drop of d.drops) if (s.rng.chance(drop.chance)) r.items.push(drop.item);
    if (d.memory && s.mechanics.has("memories") && s.rng.chance(d.boss ? 1 : 0.35)) r.memories.push(d.memory);
  }
  return r;
}
