import type { BattleState, Combatant, EncounterGroup } from "../game/types";
import { type Action, type BattleEvent, createBattle, nextTurn, perform, checkSnare, type PartyInput, party, enemies, alive } from "../game/battle/core";
import { enemyChoose, type Policy } from "../game/battle/ai";
import { MEMBERS, MEMBER_ORDER, skillsAt } from "../game/data/members";
import { PAIRS } from "../game/data/skills";

export interface RunResult {
  outcome: "win" | "lose" | "flee" | "draw";
  actions: number;
  partyTurns: number;
  events: BattleEvent[];
  closeCall: boolean;
  leadChanges: number;
  actionKeys: string[];
  mechanicActions: number;
  basicActions: number;
  unwantedLifts: number;
  taken: number;
  endHpPct: number;
  state: BattleState;
}

/** Run a whole battle headlessly. */
export function runBattle(s: BattleState, policy: Policy, opts?: { maxActions?: number; hand?: boolean; keepEvents?: boolean }): RunResult {
  const max = opts?.maxActions ?? 400;
  const events: BattleEvent[] = [];
  const keys: string[] = [];
  let partyTurns = 0, mech = 0, basic = 0, unwanted = 0;
  let closeCall = false;
  const push = (ev: BattleEvent[]) => {
    if (opts?.keepEvents) events.push(...ev);
    for (const e of ev) {
      if (e.t === "lift" && !e.rise) {
        const c = s.combatants.find((x) => x.id === e.who);
        if (c && c.side === "party") unwanted++;
      }
    }
  };
  let guard = 0;
  while (!s.over && guard++ < max) {
    const { actor, events: ev } = nextTurn(s);
    push(ev);
    if (!actor) break;
    const snareEv: BattleEvent[] = [];
    if (checkSnare(s, actor, snareEv)) { push(snareEv); continue; }
    let a: Action;
    if (actor.side === "party") {
      partyTurns++;
      a = policy(s, actor);
      const key = actionKey(a);
      keys.push(key);
      if (a.type === "attack") basic++; else mech++;
      if (opts?.hand) maybeHand(s, push);
    } else {
      a = enemyChoose(s, actor);
    }
    const out = perform(s, a);
    push(out);
    for (const p of party(s)) if (p.alive && p.hp < p.maxHp * 0.3) closeCall = true;
  }
  const outcome = s.over ?? "draw";
  let leadChanges = 0;
  for (let i = 1; i < s.partyLeadHistory.length; i++) {
    if (Math.sign(s.partyLeadHistory[i]) !== Math.sign(s.partyLeadHistory[i - 1]) && s.partyLeadHistory[i] !== 0) leadChanges++;
  }
  const p = party(s);
  const endHpPct = p.reduce((a, c) => a + c.hp, 0) / Math.max(1, p.reduce((a, c) => a + c.maxHp, 0));
  return {
    outcome,
    actions: s.actions,
    partyTurns,
    events,
    closeCall: closeCall && outcome === "win",
    leadChanges,
    actionKeys: keys,
    mechanicActions: mech,
    basicActions: basic,
    unwantedLifts: unwanted,
    taken: enemies(s).filter((e) => e.taken).length,
    endHpPct,
    state: s,
  };
}

/** A simple Hand helper: tugs a member below 3 tension who has an expensive skill, steadies the weakest. */
function maybeHand(s: BattleState, push: (ev: BattleEvent[]) => void): void {
  const p = alive(party(s));
  if (s.hand.tug === 0) {
    const t = p.find((c) => c.economy === "tension" && c.tension >= 1 && c.tension <= 3);
    if (t) push(perform(s, { type: "hand", kind: "tug", target: t.id }));
  }
  if (s.hand.steady === 0) {
    const w = [...p].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (w && w.hp < w.maxHp * 0.5) push(perform(s, { type: "hand", kind: "steady", target: w.id }));
  }
  if (s.hand.pinch === 0) {
    const e = alive(enemies(s)).find((c) => c.held && c.tension >= 3);
    if (e) push(perform(s, { type: "hand", kind: "pinch", target: e.id }));
  }
}

export function actionKey(a: Action): string {
  switch (a.type) {
    case "attack": return "attack";
    case "skill": return a.skill;
    case "item": return `item:${a.item}`;
    case "untie": return "untie";
    case "pair": return a.skill;
    case "flee": return "flee";
    case "hand": return `hand:${a.kind}`;
  }
}

/** Expected party level at the start of a chapter. */
export function chapterLevel(ch: number): number {
  return 1 + (ch - 1) * 3;
}

/** The default formation: Fathom and the three most recent recruits. */
export function formationFor(chapter: number): string[] {
  const avail = MEMBER_ORDER.filter((id) => MEMBERS[id].joinChapter <= chapter);
  const others = avail.filter((id) => id !== "fathom");
  const recent = others.slice(-3);
  return ["fathom", ...recent];
}

export function partyFor(chapter: number, level: number, ids = formationFor(chapter)): PartyInput[] {
  return ids.map((id) => {
    const def = MEMBERS[id];
    return { def, level, gear: {}, skills: skillsAt(def, level, chapter) };
  });
}

export function allBonds(): [string, string][] {
  return PAIRS.map((p) => p.members);
}

export function makeBattle(chapter: number, group: EncounterGroup, level: number, seed: number, opts?: { ids?: string[]; items?: Record<string, number>; levelOverride?: number }): BattleState {
  return createBattle({
    chapter,
    party: partyFor(chapter, level, opts?.ids),
    group,
    seed,
    bonds: chapter >= 7 ? allBonds() : [],
    items: opts?.items ?? {},
    levelOverride: opts?.levelOverride,
  });
}

export function entropy(keys: string[]): number {
  if (!keys.length) return 0;
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / keys.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function combatantSummary(c: Combatant): string {
  return `${c.name} L${c.level} ${c.hp}/${c.maxHp}`;
}
