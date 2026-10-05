// BATTLE ENGINE — deterministic, headless turn-based combat.
//
// The UI and the balance harness both drive this: queue an action per
// living ally with command()/commands(), then loop step() — it returns one
// event per action (enemy actions included) and the UI animates them.
// Turn order is by spd (haste grants a free extra turn), statuses tick at
// the top of a unit's turn, shields absorb before hp, splitters divide on
// death, and bosses wind up a big strike every few turns.

import type {
  EnemyDef, Element, EffectKind, Skill, Unit,
} from "../game/types.js";
import { RNG } from "../core/rng.js";
import { enemyById } from "../game/enemies.js";
import { itemById } from "../game/items.js";

// ---------------------------------------------------------------- config
export type Currency = "thread" | "flux";

export interface BattleOptions {
  rngSeed?: number;
  currency?: Currency;   // thread (ch1-3) or flux (ch4-5)
  boss?: boolean;
  pool?: number;         // starting thread/flux per ally; defaults to items.currency
}

export type BattleEventKind =
  | "battle-start"
  | "action"          // a skill was used (or a basic attack)
  | "hit"             // damage landed
  | "miss"
  | "heal"
  | "item"            // an item was used
  | "shield-gain"
  | "status-gain"
  | "status-tick"     // poison/burn damage
  | "status-fall"
  | "skip"            // stun/sleep/frail
  | "split"           // splitter divided
  | "kill"
  | "round"           // a new round begins
  | "battle-end";

export interface BattleEvent {
  kind: BattleEventKind;
  actor?: number;        // party index
  target?: number;       // party index (for ally-targeted)
  enemy?: number;        // enemy index (for enemy-targeted)
  enemyNew?: number;     // split children
  text: string;
  power?: number;        // damage / heal amount
  skillId?: string;
  element?: Element;
  effect?: EffectKind;
  result?: "win" | "lose";
  rewards?: BattleRewards;
  quote?: string;        // boss flavor line
}

export interface BattleRewards {
  xp: number;
  credits: number;
}

// Enemy skill ids (the enemy side of getSkill).
export const ENEMY_SKILL_IDS: Record<string, string> = {
  basic: "e_skill_basic",
  brute: "e_skill_brute",
  caster: "e_skill_caster",
  boss: "e_skill_boss",
};

export function enemySkillFor(def: EnemyDef): Skill {
  const element: Element = def.element === "null" ? "null" : def.element;
  if (def.ai === "caster") {
    // each element's cast carries its own hindrance
    const riders: Record<Element, { name: string; kind: EffectKind; power: number }> = {
      static: { name: "Static Snap", kind: "spdDown", power: 2 },
      bloom: { name: "Spore Cloud", kind: "poison", power: 3 },
      void: { name: "Unmake", kind: "frail", power: 2 },
      steel: { name: "Rust", kind: "defDown", power: 2 },
      null: { name: "Sap", kind: "atkDown", power: 2 },
    };
    const r = riders[element];
    return {
      id: "e_skill_caster", name: r.name, desc: "The enemy casts.",
      power: 30, element, target: "enemy", cost: 0, accuracy: 0.9, unlockChapter: 1,
      effect: { kind: r.kind, chance: 0.35, power: r.power },
    };
  }
  if (def.ai === "boss") {
    return {
      id: "e_skill_boss", name: "Strain", desc: "The boss strains.",
      power: 36, element, target: "enemy", cost: 0, accuracy: 0.95, unlockChapter: 1,
    };
  }
  if (def.ai === "brute") {
    return {
      id: "e_skill_brute", name: "Lunge", desc: "The enemy lunges.",
      power: 28, element, target: "enemy", cost: 0, accuracy: 0.9, unlockChapter: 1,
    };
  }
  return {
    id: "e_skill_basic", name: "Nip", desc: "The enemy nips.",
    power: 18, element, target: "enemy", cost: 0, accuracy: 0.9, unlockChapter: 1,
  };
}

// ---------------------------------------------------------------- units
export interface PartyMember {
  id: string;
  unit: Unit;
  skills: string[];      // known skill ids (basic first)
  weapon: string;
  armor: string;
  trinket: string;
  items: Record<string, number>;
}

export interface PartyItem { id: string; qty: number }

export interface BattleUnit extends Unit {
  kind: "ally" | "enemy";
  enemyId?: string;
  ai?: EnemyDef["ai"];
  splitsInto?: string;
  element: Element;      // innate element (used by basic attacks)
  level: number;         // enemy level (allies: party level)
  xp: number;
  // battle-private
  shieldPool: number;
  shieldTurns: number;
  stunned: boolean;
  sleeping: boolean;
  hasteTurns: number;
  guarding: boolean;     // halves damage taken until the unit acts again
  // enemy AI private
  charge: number;        // boss wind-up
  enraged: boolean;
  buffed: boolean;
}

// ---------------------------------------------------------------- helpers
const BUFF_PCT = 0.3;   // each atkUp/defUp/etc. step is ±30% of the base stat
const FRAIL_PCT = 1.5;  // frail: 150% damage taken
const ENEMY_LEVEL_MULT = 1 + 0.14;  // per enemy level above 1

export function effStat(u: BattleUnit, key: "atk" | "def" | "spd" | "wit"): number {
  let v = u[key];
  if (key === "atk") {
    const up = u.buffs.atkUp; if (up) v += v * BUFF_PCT * up.power;
    const down = u.buffs.atkDown; if (down) v -= v * BUFF_PCT * down.power;
  } else if (key === "def") {
    const up = u.buffs.defUp; if (up) v += v * BUFF_PCT * up.power;
    const down = u.buffs.defDown; if (down) v -= v * BUFF_PCT * down.power;
  } else if (key === "spd") {
    const up = u.buffs.spdUp; if (up) v += v * BUFF_PCT * up.power;
    const down = u.buffs.spdDown; if (down) v -= v * BUFF_PCT * down.power;
  } else {
    const up = u.buffs.witUp; if (up) v += v * BUFF_PCT * up.power;
    const down = u.buffs.witDown; if (down) v -= v * BUFF_PCT * down.power;
  }
  return Math.max(1, Math.round(v));
}

/** True when any equipped item carries the passive. */
export function hasPassive(p: PartyMember, passive: string): boolean {
  return [p.weapon, p.armor, p.trinket].some((id) => !!id && itemById(id).passive === passive);
}

export function makeAlly(p: PartyMember): BattleUnit {
  const u = p.unit;
  const w = p.weapon ? itemById(p.weapon) : null;
  const a = p.armor ? itemById(p.armor) : null;
  const t = p.trinket ? itemById(p.trinket) : null;
  const stats = { ...u };
  stats.atk += w?.atk ?? 0;
  stats.def += a?.def ?? 0;
  stats.spd += (w?.spd ?? 0) + (a?.spd ?? 0);
  stats.wit += (w?.wit ?? 0) + (a?.wit ?? 0);
  // u.hp is current hp; u.maxHp excludes gear, so gear hp is added on top
  const maxHp = u.maxHp + (w?.hp ?? 0) + (a?.hp ?? 0) + (t?.hp ?? 0);
  return {
    ...stats,
    maxHp,
    hp: Math.min(u.hp, maxHp),
    alive: u.alive,
    statuses: [...u.statuses],
    buffs: { ...u.buffs },
    kind: "ally",
    element: "null",
    level: 1,
    xp: 0,
    shieldPool: 0,
    shieldTurns: 0,
    stunned: false,
    sleeping: false,
    hasteTurns: 0,
    guarding: false,
    charge: 0,
    enraged: false,
    buffed: false,
  };
}

export function makeEnemy(id: string, level: number, seed: number): BattleUnit {
  const def = enemyById(id);
  const m = Math.pow(ENEMY_LEVEL_MULT, level - 1);
  const hp = Math.max(1, Math.round(def.hp * m));
  void seed;
  return {
    name: def.name,
    title: def.cls,
    cls: def.cls,
    hp, atk: Math.round(def.atk * m), def: Math.round(def.def * m),
    spd: def.spd, wit: def.wit,
    spriteSeed: def.spriteSeed,
    spriteStyle: def.spriteStyle,
    colors: def.colors,
    maxHp: hp,
    alive: true,
    statuses: [],
    buffs: {},
    kind: "enemy",
    enemyId: def.id,
    ai: def.ai,
    splitsInto: def.splitsInto,
    element: def.element,
    level,
    xp: Math.round(def.xp * (1 + 0.25 * (level - 1))),
    shieldPool: 0,
    shieldTurns: 0,
    stunned: false,
    sleeping: false,
    hasteTurns: 0,
    guarding: false,
    charge: 0,
    enraged: false,
    buffed: false,
  };
}

// ---------------------------------------------------------------- action
export type BattleActionKind = "skill" | "item" | "guard" | "wait";

export interface BattleAction {
  kind: BattleActionKind;
  skill?: Skill;
  itemId?: string;
  target?: "enemy" | "ally" | "all-enemies" | "all-allies" | "self";
  enemyIndex?: number;
  allyIndex?: number;
}

// ---------------------------------------------------------------- the battle
export class Battle {
  readonly party: BattleUnit[];
  readonly enemyUnits: BattleUnit[];
  private readonly partyMembers: PartyMember[];
  readonly currency: Currency;
  private readonly rng: RNG;
  private readonly enemyLevel: number;
  private readonly boss: boolean;

  private queue: (BattleAction | null)[] = [];
  private pools: number[] = [];         // thread/flux per ally for this battle
  private turnOrder: number[] = [];     // party indices, by spd
  private phase: "ally" | "enemy" = "ally";
  private enemyOrder: number[] = [];    // enemy indices, by spd
  private enemyStep = 0;
  private lastDamage = 0;               // last full (pre-shield) hit, for drain
  private round: number = 1;
  private stepIndex = 0;
  private pendingHaste = new Set<number>();
  done = false;
  result: "win" | "lose" | null = null;
  turns = 0;
  events: BattleEvent[] = [];           // full log (harness reads this)
  rewards: BattleRewards | null = null;

  constructor(
    party: PartyMember[],
    enemyIds: string[],   // enemy ids (boss id for boss fights)
    level = 1,            // enemy level (chapter's enemyLevel)
    opts: BattleOptions = {},
  ) {
    this.partyMembers = party;
    this.currency = opts.currency ?? "thread";
    this.enemyLevel = level;
    this.boss = !!opts.boss;
    this.rng = new RNG(opts.rngSeed ?? 1);
    this.party = party.map((p) => makeAlly(p));
    this.enemyUnits = enemyIds.map((id) => makeEnemy(id, this.enemyLevel, this.rng.int(1, 0x7fffffff)));

    // passive: Tear of the Eye adds 4 thread/flux at battle start
    this.pools = party.map((p) => (opts.pool ?? p.items["currency"] ?? 0) + (hasPassive(p, "p_tear") ? 4 : 0));

    // passive: Clockwork Mercy — a shield at battle start
    for (const u of this.party) {
      const pm = this.partyMembers[this.party.indexOf(u)];
      if (hasPassive(pm, "p_hand")) {
        const pool = Math.max(1, Math.round(u.maxHp * 0.08));
        u.shieldPool = pool;
        u.shieldTurns = 99;
      }
    }

    const ev: BattleEvent[] = [];
    ev.push({
      kind: "battle-start",
      text: this.boss
        ? `${this.enemyUnits[0].name} rises.`
        : `A ${this.enemyUnits.map((e) => e.name).join(" and ")} ${this.enemyUnits.length > 1 ? "appear" : "appears"}.`,
    });
    this.events = ev;
  }

  // ---- commands --------------------------------------------------------
  private aliveAllies(): number[] {
    return this.party.map((u, i) => (u.alive ? i : -1)).filter((i) => i >= 0);
  }

  command(i: number, a: BattleAction | null): void {
    if (this.done) return;
    if (i < 0 || i >= this.party.length || !this.party[i].alive) return;
    if (a && a.kind === "skill" && a.skill) {
      const cost = a.skill.cost;
      if (cost > this.pools[i]) return; // not enough thread/flux
    }
    this.queue[i] = a;
  }

  /** Thread/flux the ally at index i has left this battle. */
  pool(i: number): number {
    return this.pools[i] ?? 0;
  }

  /** Queue actions for every living ally (harness convenience). */
  commands(actions: (BattleAction | null)[]): void {
    for (let i = 0; i < this.party.length; i++) this.command(i, actions[i] ?? null);
  }

  get pendingCommands(): number {
    return this.queue.filter((a, i) => a !== null && this.party[i]?.alive).length;
  }

  // ---- main loop -------------------------------------------------------
  /** Append to the full log and return the event. */
  private log(ev: BattleEvent): BattleEvent {
    this.events.push(ev);
    return ev;
  }

  /** Advance one step; returns the events for the action just taken. */
  step(): BattleEvent {
    if (this.done) throw new Error("step() on a finished battle");
    // enemy phase: one enemy acts per step() call
    while (this.phase === "enemy") {
      while (this.enemyStep < this.enemyOrder.length) {
        const e = this.enemyOrder[this.enemyStep++];
        if (!this.enemyUnits[e].alive) continue;
        const evs = this.performEnemyAction(e);
        for (const ev of evs) this.events.push(ev);
        if (this.checkEnd()) return evs[0];
        return evs[0];
      }
      // all living enemies have acted; next round
      this.round += 1;
      this.phase = "ally";
      if (this.aliveAllies().length === 0) this.finish("lose");
      return this.log({ kind: "round", power: this.round, text: `Round ${this.round}.` });
    }
    if (this.turnOrder.length === 0) this.buildOrder();
    while (true) {
      if (this.turnOrder.length === 0) return this.step();
      const i = this.turnOrder[this.stepIndex];
      const unit = this.party[i];
      // stale: died since the order was built
      if (!unit.alive) { this.advance(); continue; }
      const action = this.queue[i] ?? null;
      this.queue[i] = null;
      const evs = this.performAction(unit, i, action);
      for (const ev of evs) this.events.push(ev);
      const ev = evs[0];
      if (this.checkEnd()) return ev;
      this.advance();
      // haste: the actor takes another turn before anyone else
      if (this.pendingHaste.has(i)) {
        this.pendingHaste.delete(i);
        if (unit.alive) {
          this.turnOrder.splice(0, 0, i);
          this.phase = "ally";
        }
      }
      return ev;
    }
  }

  /** Run steps until every queued ally and every enemy has acted once. */
  runRound(): BattleEvent[] {
    const start = this.events.length;
    while (!this.done) {
      const ev = this.step();
      if (ev.kind === "round") break;
    }
    return this.events.slice(start);
  }

  private advance(): void {
    this.turnOrder.splice(this.stepIndex, 1);
    if (this.turnOrder.length === 0) {
      // ally actions are done for this round; enemies take their turn
      this.phase = "enemy";
      this.enemyOrder = this.enemyUnits
        .map((u, i) => (u.alive ? i : -1))
        .filter((i) => i >= 0)
        .sort((a, b) => this.enemyUnits[b].spd - this.enemyUnits[a].spd || a - b);
      this.enemyStep = 0;
    }
  }

  private buildOrder(): void {
    this.turnOrder = this.aliveAllies()
      .sort((a, b) => this.party[b].spd - this.party[a].spd || a - b);
    this.stepIndex = 0;
  }

  // ---- actions ---------------------------------------------------------
  private performAction(unit: BattleUnit, i: number, action: BattleAction | null): BattleEvent[] {
    const evs: BattleEvent[] = [];
    unit.guarding = false;
    this.tickStatuses(unit, i, evs);
    this.turns += 1;
    if (!unit.alive) return evs;

    if (unit.stunned) {
      unit.stunned = false;
      evs.push({ kind: "skip", actor: i, text: `${unit.name} is stunned and cannot act.` });
      this.tickBuffs(unit, i, evs);
      return evs;
    }
    if (unit.sleeping) {
      evs.push({ kind: "skip", actor: i, text: `${unit.name} is asleep.` });
      const s = unit.statuses.find((x) => x.kind === "sleep");
      if (s) {
        s.turns -= 1;
        if (s.turns <= 0) {
          unit.statuses = unit.statuses.filter((x) => x !== s);
          unit.sleeping = false;
          evs.push({ kind: "status-fall", actor: i, text: `${unit.name} wakes.` });
        }
      }
      this.tickBuffs(unit, i, evs);
      return evs;
    }

    if (!action) {
      evs.push({ kind: "action", actor: i, skillId: "wait", text: `${unit.name} waits.` });
      this.tickBuffs(unit, i, evs);
      return evs;
    }

    switch (action.kind) {
      case "skill": {
        if (!action.skill) { this.tickBuffs(unit, i, evs); break; }
        const s = action.skill;
        this.pools[i] = Math.max(0, this.pools[i] - s.cost);
        const targets = this.resolveTargets(unit, i, s, action);
        if (s.power > 0) {
          for (const t of targets) {
            this.dealDamage(unit, i, s, t, evs);
          }
        } else {
          for (const t of targets) {
            this.applyEffect(unit, i, s, t, evs);
          }
        }
        evs.unshift({ kind: "action", actor: i, skillId: s.id, element: s.element, text: `${unit.name} uses ${s.name}.` });
        break;
      }
      case "item": {
        const item = action.itemId ? itemById(action.itemId) : null;
        if (item && item.use && this.partyMembers[i].items[action.itemId!] > 0) {
          const heal = item.use.heal;
          const targetIdx = action.allyIndex ?? i;
          const target = this.party[targetIdx];
          if (!target.alive) {
            evs.push({ kind: "action", actor: i, text: `${unit.name} reaches for ${target.name}, but too late.` });
            break;
          }
          this.partyMembers[i].items[action.itemId!] -= 1;
          const amount = Math.min(target.maxHp - target.hp, heal);
          target.hp += amount;
          evs.push({ kind: "item", actor: i, target: targetIdx, power: amount, text: `${unit.name} uses ${item.name}. ${target.name} recovers ${amount}.` });
          if (item.use.effect) this.applyEffect(unit, i, { effect: item.use.effect }, target, evs);
        }
        break;
      }
      case "guard":
        unit.guarding = true;
        evs.push({ kind: "action", actor: i, skillId: "guard", text: `${unit.name} braces and guards.` });
        break;
      case "wait":
        evs.push({ kind: "action", actor: i, skillId: "wait", text: `${unit.name} waits.` });
        break;
    }

    this.tickBuffs(unit, i, evs);
    return evs.length ? evs : [{ kind: "action", actor: i, text: `${unit.name} acts.` }];
  }

  private performEnemyAction(e: number): BattleEvent[] {
    const u = this.enemyUnits[e];
    const evs: BattleEvent[] = [];
    this.tickStatuses(u, e, evs);
    this.turns += 1;
    if (!u.alive) return [...evs, { kind: "status-fall", actor: e, text: `${u.name} perishes.` }];
    if (u.stunned) {
      u.stunned = false;
      this.tickBuffs(u, e, evs);
      return [...evs, { kind: "skip", actor: e, text: `${u.name} is stunned and cannot act.` }];
    }
    if (u.sleeping) {
      evs.push({ kind: "skip", actor: e, text: `${u.name} is asleep.` });
      const s = u.statuses.find((x) => x.kind === "sleep");
      if (s) {
        s.turns -= 1;
        if (s.turns <= 0) {
          u.statuses = u.statuses.filter((x) => x !== s);
          u.sleeping = false;
          evs.push({ kind: "status-fall", actor: e, text: `${u.name} wakes.` });
        }
      }
      this.tickBuffs(u, e, evs);
      return evs;
    }

    const def = u.enemyId ? enemyById(u.enemyId) : null;
    let s = def ? enemySkillFor(def) : null;
    // boss AI: wind up (weaker blow) on every turn but the third
    if (def?.ai === "boss") {
      u.charge += 1;
      if (u.charge % 3 !== 0 && s) s = { ...s, power: Math.round(s.power * 0.55), name: "Wind Up" };
    }
    // brutes hit the sturdiest ally, bosses the weakest, everyone else at random
    const alive = this.aliveAllies();
    let target: number | undefined;
    if (def?.ai === "brute") target = [...alive].sort((a, b) => this.party[b].hp - this.party[a].hp || a - b)[0];
    else if (def?.ai === "boss") target = [...alive].sort((a, b) => this.party[a].hp - this.party[b].hp || a - b)[0];
    else if (alive.length) target = alive[this.rng.int(0, alive.length - 1)];

    if (target === undefined || !s) {
      evs.push({ kind: "action", actor: e, text: `${u.name} lingers.` });
    } else {
      if (def?.ai === "boss" && u.charge % 3 === 0) {
        evs.unshift({ kind: "action", actor: e, skillId: s.id, element: s.element, quote: `${u.name}'s threads begin to sing.`, text: `${u.name} strains with gathered force.` });
      } else {
        evs.unshift({ kind: "action", actor: e, skillId: s.id, element: s.element, text: `${u.name} uses ${s.name}.` });
      }
      this.dealDamage(u, -1, s, this.party[target], evs);
      if (def?.ai === "boss" && u.charge % 3 === 2) {
        evs.push({ kind: "action", actor: e, text: `${u.name} gathers its threads. A heavy blow is coming.` });
      }
    }
    if (def?.ai === "boss" && !u.enraged && u.alive && u.hp <= u.maxHp / 2) {
      u.enraged = true;
      u.buffs.atkUp = { turns: 99, power: 1 };
      evs.push({ kind: "status-gain", enemy: e, effect: "atkUp", text: `${u.name} tears open. Its attack rises.` });
    }
    this.tickBuffs(u, e, evs);
    return evs;
  }

  private resolveTargets(unit: BattleUnit, i: number, s: Skill, action: BattleAction): BattleUnit[] {
    const out: BattleUnit[] = [];
    if (s.target === "enemy") {
      const idx = this.pickEnemyTarget(unit, action);
      const t = this.enemyUnits[idx];
      if (t?.alive) out.push(t);
    } else if (s.target === "all-enemies") {
      for (const e of this.enemyUnits) if (e.alive) out.push(e);
    } else if (s.target === "ally") {
      const idx = action.allyIndex ?? i;
      const t = this.party[idx];
      if (t?.alive) out.push(t);
    } else if (s.target === "all-allies") {
      for (const p of this.party) if (p.alive) out.push(p);
    } else if (s.target === "self") {
      out.push(unit);
    }
    return out;
  }

  private aliveEnemies(): BattleUnit[] {
    return this.enemyUnits.filter((e) => e.alive);
  }

  private pickEnemyTarget(unit: BattleUnit, action: BattleAction): number {
    if (action.enemyIndex !== undefined && this.enemyUnits[action.enemyIndex]?.alive) return action.enemyIndex;
    const alive = this.aliveEnemies();
    if (alive.length === 0) return -1;
    // allies target the first alive enemy by default; AI picks smarter
    return this.enemyUnits.indexOf(alive[0]);
  }

  private dealDamage(attacker: BattleUnit, attackerIdx: number, s: Skill, target: BattleUnit, evs: BattleEvent[]): void {
    const atk = effStat(attacker, "atk");
    const def = effStat(target, "def");
    let base = s.power * (atk / (atk * 0.5 + def * 0.5 + 1));
    const elem = s.element;
    let mult = elementMultiplier(elem, target.kind === "enemy" ? target.element : "null");
    // frail: 150%
    if (target.buffs.frail) mult *= FRAIL_PCT;
    // Bloom-Blooded passive
    if (attacker.kind === "ally") {
      const pm = this.partyMembers[this.party.indexOf(attacker)];
      if (hasPassive(pm, "p_bloom") && elem === "bloom") mult *= 1.2;
      if (hasPassive(pm, "p_other")) {
        const down = this.party.filter((u) => !u.alive).length;
        if (down > 0) mult *= 1 + 0.1 * down;
      }
    }
    base *= mult;
    if (!this.rng.chance(s.accuracy)) {
      evs.push({ kind: "miss", actor: attackerIdx, enemy: this.enemyUnits.indexOf(target), target: this.party.indexOf(target), skillId: s.id, text: `${attacker.name} misses ${target.name}.` });
      return;
    }
    const variance = 0.9 + this.rng.next() * 0.2;
    const dmg = Math.max(1, Math.round(base * variance));
    this.lastDamage = dmg;
    evs.push({ kind: "hit", actor: attackerIdx, enemy: this.enemyUnits.indexOf(target), target: this.party.indexOf(target), power: dmg, skillId: s.id, element: elem, text: `${attacker.name} hits ${target.name} for ${dmg}.` });
    this.applyDamage(target, dmg, evs, attackerIdx, attacker.name);
    if (s.effect && this.rng.chance(s.effect.chance)) {
      // beneficial riders on an attack (heal, buffs) land on the attacker
      const selfKinds: EffectKind[] = ["heal", "atkUp", "defUp", "spdUp", "witUp", "haste", "shield"];
      const onSelf = selfKinds.includes(s.effect.kind);
      if (onSelf || target.alive || s.effect.kind === "drain") {
        this.applyEffect(attacker, attackerIdx, s, onSelf ? attacker : target, evs);
      }
    }
  }

  private applyDamage(target: BattleUnit, dmg: number, evs: BattleEvent[], fromIdx: number, fromName: string): void {
    if (target.guarding) dmg = Math.ceil(dmg / 2);
    if (target.shieldPool > 0) {
      const absorbed = Math.min(target.shieldPool, dmg);
      target.shieldPool -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) evs.push({ kind: "shield-gain", actor: this.party.indexOf(target), enemy: this.enemyUnits.indexOf(target), power: absorbed, text: `${target.name}'s shield absorbs ${absorbed}.` } as BattleEvent);
    }
    target.hp = Math.max(0, target.hp - dmg);
    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      evs.push({ kind: "kill", actor: fromIdx, enemy: this.enemyUnits.indexOf(target), target: this.party.indexOf(target), text: `${target.name} is ${target.kind === "enemy" ? "destroyed" : "down"}.` });
      if (target.kind === "enemy" && target.splitsInto) {
        const children = [makeEnemy(target.splitsInto, this.enemyLevel, this.rng.int(1, 0x7fffffff)), makeEnemy(target.splitsInto, this.enemyLevel, this.rng.int(1, 0x7fffffff))];
        const base = this.enemyUnits.length;
        this.enemyUnits.push(...children);
        evs.push({ kind: "split", enemy: this.enemyUnits.indexOf(target), enemyNew: base, text: `${target.name} splits into ${children[0].name} and ${children[1].name}!` });
      }
    }
  }

  private applyEffect(attacker: BattleUnit, attackerIdx: number, s: Skill | { effect?: { kind: EffectKind; chance: number; power: number } }, target: BattleUnit, evs: BattleEvent[]): void {
    const eff = (s as Skill).effect ?? (s as { effect?: { kind: EffectKind; chance: number; power: number } }).effect;
    if (!eff) return;
    const { kind, power } = eff;
    const tIdx = this.party.indexOf(target);
    const eIdx = this.enemyUnits.indexOf(target);
    switch (kind) {
      case "heal": {
        const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * (power / 100)));
        target.hp += amount;
        if (amount > 0) evs.push({ kind: "heal", actor: attackerIdx, target: tIdx >= 0 ? tIdx : eIdx, power: amount, text: `${target.name} recovers ${amount}.` });
        break;
      }
      case "drain": {
        const amount = Math.max(1, Math.round(this.lastDamage * power));
        const healed = Math.min(attacker.maxHp - attacker.hp, amount);
        attacker.hp += healed;
        if (healed > 0) evs.push({ kind: "heal", actor: this.party.indexOf(attacker), power: healed, text: `${attacker.name} draws ${healed} back into itself.` });
        break;
      }
      case "shield": {
        const pool = Math.max(1, Math.round(target.maxHp * power));
        target.shieldPool = Math.max(target.shieldPool, pool);
        target.shieldTurns = 2;
        evs.push({ kind: "shield-gain", actor: attackerIdx, target: tIdx, power: pool, text: `${target.name} is wrapped in a shield of ${pool}.` });
        break;
      }
      case "poison":
      case "burn": {
        const st = target.statuses.find((x) => x.kind === kind);
        if (st) st.turns = Math.max(st.turns, power);
        else {
          target.statuses.push({ kind, turns: power, power: 1 });
          evs.push({ kind: "status-gain", actor: attackerIdx, target: tIdx, enemy: eIdx, effect: kind, power, text: `${target.name} is ${kind === "poison" ? "poisoned" : "set alight"}.` });
        }
        break;
      }
      case "stun":
      case "sleep": {
        if (kind === "stun") target.stunned = true;
        else {
          target.sleeping = true;
          const prev = target.statuses.find((x) => x.kind === "sleep");
          if (prev) prev.turns = Math.max(prev.turns, power);
          else target.statuses.push({ kind, turns: power, power: 1 });
        }
        evs.push({ kind: "status-gain", actor: attackerIdx, target: tIdx, enemy: eIdx, effect: kind, power, text: `${target.name} is ${kind === "stun" ? "stunned" : "asleep"}.` });
        break;
      }
      case "haste": {
        target.hasteTurns += power;
        evs.push({ kind: "status-gain", actor: attackerIdx, target: tIdx, enemy: eIdx, effect: "haste", power, text: `${target.name} moves with extra haste.` });
        break;
      }
      case "frail": {
        const prev = target.buffs.frail;
        if (prev) prev.turns = Math.max(prev.turns, power);
        else target.buffs.frail = { turns: power, power: 1 };
        evs.push({ kind: "status-gain", actor: attackerIdx, target: tIdx, enemy: eIdx, effect: "frail", power, text: `${target.name} is made frail.` });
        break;
      }
      case "atkUp": case "defUp": case "spdUp": case "witUp":
      case "atkDown": case "defDown": case "spdDown": case "witDown": {
        const prev = target.buffs[kind];
        if (prev) prev.turns = Math.max(prev.turns, power);
        else target.buffs[kind] = { turns: power, power: 1 };
        const stat = kind.slice(0, kind.indexOf("Up") >= 0 ? kind.indexOf("Up") : kind.indexOf("Down"));
        evs.push({ kind: "status-gain", actor: attackerIdx, target: tIdx, enemy: eIdx, effect: kind, power, text: `${target.name}'s ${stat} ${kind.endsWith("Up") ? "rises" : "drops"}.` });
        break;
      }
    }
  }

  // ---- status ticks ----------------------------------------------------
  private tickStatuses(u: BattleUnit, i: number, evs: BattleEvent[]): void {
    const tIdx = this.party.indexOf(u);
    const eIdx = this.enemyUnits.indexOf(u);
    const where = (e: BattleEvent) => { if (tIdx >= 0) e.actor = tIdx; if (eIdx >= 0) e.enemy = eIdx; };

    for (const st of [...u.statuses]) {
      if (st.kind === "poison" || st.kind === "burn") {
        const dmg = Math.max(1, Math.round(u.maxHp * (st.kind === "poison" ? 0.12 : 0.08) * st.power));
        const alive = u.alive;
        this.applyDamage(u, dmg, evs, i, "the " + st.kind);
        evs.push({ kind: "status-tick", effect: st.kind, power: dmg, text: `${u.name} takes ${dmg} from ${st.kind}.` });
        where(evs[evs.length - 1]);
        if (!alive) return; // died to the tick
      }
    }
    if (u.shieldPool > 0 && --u.shieldTurns <= 0) {
      const left = u.shieldPool;
      u.shieldPool = 0;
      evs.push({ kind: "status-fall", actor: tIdx, enemy: eIdx, power: left, text: `${u.name}'s shield fades.` });
    }
    if (u.kind === "ally" && u.hasteTurns > 0) {
      u.hasteTurns -= 1;
      if (u.hasteTurns > 0) this.pendingHaste.add(i);
    }
  }

  private tickBuffs(u: BattleUnit, i: number, evs: BattleEvent[]): void {
    for (const k of Object.keys(u.buffs) as (keyof typeof u.buffs)[]) {
      const b = u.buffs[k];
      if (!b) continue;
      b.turns -= 1;
      if (b.turns <= 0) {
        delete u.buffs[k];
        evs.push({ kind: "status-fall", actor: this.party.indexOf(u) >= 0 ? this.party.indexOf(u) : undefined, enemy: this.enemyUnits.indexOf(u) >= 0 ? this.enemyUnits.indexOf(u) : undefined, text: `${u.name}'s ${k} wears off.` });
      }
    }
    const fall = (kind: "poison" | "burn") => {
      const st = u.statuses.find((x) => x.kind === kind);
      if (st) {
        st.turns -= 1;
        if (st.turns <= 0) {
          u.statuses = u.statuses.filter((x) => x.kind !== kind);
          evs.push({ kind: "status-fall", text: `${u.name} is no longer ${kind}.` });
        }
      }
    };
    if (u.statuses.some((x) => x.kind === "poison")) fall("poison");
    if (u.statuses.some((x) => x.kind === "burn")) fall("burn");
  }

  // ---- ending ----------------------------------------------------------
  private checkEnd(): boolean {
    if (this.enemyUnits.every((e) => !e.alive)) { this.finish("win"); return true; }
    if (this.party.every((u) => !u.alive)) { this.finish("lose"); return true; }
    return false;
  }

  private finish(result: "win" | "lose"): void {
    if (this.done) return;
    this.done = true;
    this.result = result;
    const ev: BattleEvent = { kind: "battle-end", result, text: result === "win" ? "The battle is over." : "The party is down." };
    if (result === "win") {
      const xp = this.enemyUnits.reduce((a, e) => a + e.xp, 0);
      const credits = this.boss ? 60 + 40 * this.enemyLevel : 12 + 8 * this.enemyLevel;
      this.rewards = { xp, credits };
      ev.rewards = this.rewards;
      ev.text = `The battle is over. (+${xp} xp, +${credits} credits)`;
    }
    this.events.push(ev);
  }

  /** Convenience: is the battle over? */
  get isOver(): boolean { return this.done; }
  /** Convenience: current outcome (null while running). */
  get outcome(): "win" | "lose" | null { return this.result; }
}

// ---------------------------------------------------------------- element chart
// Multiplier of attacker element vs target element. null is neutral.
const CHART: Partial<Record<Element, Partial<Record<Element, number>>>> = {
  static: { bloom: 1.3, steel: 1.3, null: 0.8 },
  bloom: { static: 1.3, null: 0.8 },
  void: { null: 1.3, steel: 1.3 },
  steel: { void: 1.3, bloom: 1.3 },
};

export function elementMultiplier(att: Element, def: Element): number {
  if (att === "null") return 1;
  return CHART[att]?.[def] ?? 1;
}
