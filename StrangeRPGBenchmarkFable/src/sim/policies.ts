import type { BattleState, Combatant, Action } from "../game/battle/core";
import { usableSkills, canPay, validTargets, needsTarget, elementMult, has, effAtk, effMag, effDef, effRes, wordSpell } from "../game/battle/core";
import { SKILLS } from "../game/data/skills";
import { ITEMS, WORDS } from "../game/data/items";
import type { Rng } from "../engine/rng";
import type { Element, SkillDef } from "../game/types";

export type Policy = (s: BattleState, actor: Combatant, rng: Rng) => Action;

/** Every legal action for the actor, with every legal target. */
export function legalActions(s: BattleState, actor: Combatant): Action[] {
  const out: Action[] = [];
  for (const id of usableSkills(s, actor)) {
    const sk = SKILLS[id];
    if (!canPay(s, actor, sk)) continue;
    if (needsTarget(sk.target)) {
      let ts = validTargets(s, actor, sk.target);
      if (id === "fuse") ts = ts.filter((t) => t.uid !== actor.uid);
      for (const t of ts) out.push({ type: "skill", skillId: id, actor: actor.uid, target: t.uid });
    } else out.push({ type: "skill", skillId: id, actor: actor.uid, target: null });
  }
  for (const itemId of Object.keys(s.inventory)) {
    const it = ITEMS[itemId];
    if (!it?.use || (s.inventory[itemId] ?? 0) <= 0 || it.use.fieldOnly) continue;
    if (needsTarget(it.use.target)) for (const t of validTargets(s, actor, it.use.target)) out.push({ type: "item", itemId, actor: actor.uid, target: t.uid });
    else out.push({ type: "item", itemId, actor: actor.uid, target: null });
  }
  if (s.mechanics.has("words") && s.words.length >= 3) {
    const verbs = WORDS.filter((w) => w.slot === "verb" && s.words.includes(w.id)).map((w) => w.id);
    const nouns = WORDS.filter((w) => w.slot === "noun" && s.words.includes(w.id)).map((w) => w.id);
    const shapes = WORDS.filter((w) => w.slot === "shape" && s.words.includes(w.id)).map((w) => w.id);
    for (const v of verbs) for (const n of nouns) for (const sh of shapes) {
      const sk = wordSpell([v, n, sh]);
      if (!sk || !canPay(s, actor, sk)) continue;
      if (needsTarget(sk.target)) for (const t of validTargets(s, actor, sk.target)) out.push({ type: "word", words: [v, n, sh], actor: actor.uid, target: t.uid });
      else out.push({ type: "word", words: [v, n, sh], actor: actor.uid, target: null });
    }
  }
  return out;
}

export const randomPolicy: Policy = (s, actor, rng) => {
  const acts = legalActions(s, actor).filter((a) => a.type !== "flee" && !(a.type === "skill" && a.skillId === "rewind"));
  return rng.pick(acts);
};

export const attackOnlyPolicy: Policy = (s, actor, rng) => {
  const foes = validTargets(s, actor, "enemy");
  return { type: "skill", skillId: "attack", actor: actor.uid, target: rng.pick(foes).uid };
};

/** Expected damage of a damaging skill against a target, ignoring variance. */
export function expectedDamage(s: BattleState, actor: Combatant, target: Combatant, sk: SkillDef): number {
  if (!sk.power || (sk.kind !== "phys" && sk.kind !== "mag")) return 0;
  const atk = sk.kind === "phys" ? effAtk(actor) : effMag(actor);
  const def = sk.kind === "phys" ? effDef(target) : effRes(target);
  let dmg = (sk.power / 100) * atk * (atk / (atk + def)) * 1.6;
  const em = elementMult(target, sk.element ?? "null");
  dmg *= em.mult;
  if (has(target, "shield")) dmg *= 0.5;
  if (has(actor, "brace")) dmg *= 1.5;
  if (s.mechanics.has("rows") && !sk.ranged && sk.kind === "phys") { if (actor.row === "back") dmg *= 0.6; if (target.row === "back") dmg *= 0.6; }
  dmg *= sk.hits ?? 1;
  if (sk.special === "gamble") dmg *= 1.25;
  // Link bonus for a different element on a charged target.
  if (s.mechanics.has("links") && sk.element && target.charge && target.charge !== sk.element) dmg *= 1.6;
  return dmg;
}

/**
 * Heuristic player: heal when low, revive when down, exploit weaknesses, use mechanics sensibly,
 * and otherwise pick the highest expected damage per Static against the most killable foe.
 */
export const greedyPolicy: Policy = (s, actor, rng) => {
  const foes = validTargets(s, actor, "enemy");
  const friends = validTargets(s, actor, "allies");
  const usable = usableSkills(s, actor).filter((id) => canPay(s, actor, SKILLS[id]));
  const dead = s.combatants.filter((c) => c.side === "party" && c.hp <= 0 && c.fuseTurns >= 0);
  const low = friends.filter((f) => f.hp < f.max.hp * 0.35).sort((a, b) => a.hp / a.max.hp - b.hp / b.max.hp);
  const items = Object.keys(s.inventory).filter((k) => (s.inventory[k] ?? 0) > 0 && ITEMS[k]?.use);

  // Rewind if someone died since the snapshot.
  if (usable.includes("rewind") && dead.length > 0 && s.rewindsLeft > 0) return { type: "skill", skillId: "rewind", actor: actor.uid, target: null };
  // Revive.
  if (dead.length) {
    const rev = usable.find((id) => SKILLS[id].revive);
    if (rev) return { type: "skill", skillId: rev, actor: actor.uid, target: dead[0].uid };
    const it = items.find((k) => ITEMS[k].use!.revive);
    if (it) return { type: "item", itemId: it, actor: actor.uid, target: dead[0].uid };
  }
  // Heal.
  if (low.length) {
    const heals = usable.filter((id) => SKILLS[id].heal && SKILLS[id].kind === "heal").sort((a, b) => (SKILLS[b].heal ?? 0) - (SKILLS[a].heal ?? 0));
    const multi = heals.find((id) => SKILLS[id].target === "allies");
    if (low.length >= 2 && multi) return { type: "skill", skillId: multi, actor: actor.uid, target: null };
    const single = heals.find((id) => SKILLS[id].target === "ally");
    if (single) return { type: "skill", skillId: single, actor: actor.uid, target: low[0].uid };
    const hind = usable.find((id) => SKILLS[id].special === "hindsight");
    if (hind && low[0].lastTaken > 15) return { type: "skill", skillId: hind, actor: actor.uid, target: low[0].uid };
    const healOf = (k: string) => (ITEMS[k].use!.heal ?? 0) + (ITEMS[k].use!.healPct ?? 0) * low[0].max.hp;
    const potion = items.filter((k) => (ITEMS[k].use!.heal || ITEMS[k].use!.healPct) && ITEMS[k].use!.target === "ally").sort((a, b) => healOf(a) - healOf(b));
    const need = low[0].max.hp - low[0].hp;
    const pick = potion.find((k) => healOf(k) >= need * 0.6) ?? potion[potion.length - 1];
    if (pick) return { type: "item", itemId: pick, actor: actor.uid, target: low[0].uid };
    if (low[0].uid === actor.uid && foes.length >= 2 && usable.includes("guard") && rng.chance(0.5)) return { type: "skill", skillId: "guard", actor: actor.uid, target: null };
  }
  // Cure nasty statuses on allies.
  for (const f of friends) {
    if (has(f, "poison") || has(f, "silence") || has(f, "doom")) {
      const cure = usable.find((id) => SKILLS[id].cure?.some((c) => has(f, c)));
      if (cure) return { type: "skill", skillId: cure, actor: actor.uid, target: f.uid };
      const it = items.find((k) => ITEMS[k].use!.cure?.some((c) => has(f, c)));
      if (it) return { type: "item", itemId: it, actor: actor.uid, target: f.uid };
    }
  }
  // Tank behavior: taunt when allies are frail and taunt is off.
  if (usable.includes("taunt") && !has(actor, "taunt") && friends.length >= 2 && foes.length >= 2 && rng.chance(0.6)) return { type: "skill", skillId: "taunt", actor: actor.uid, target: null };
  // Party buffs early in a fight.
  const buffs = usable.filter((id) => SKILLS[id].kind === "support" && SKILLS[id].target === "allies" && SKILLS[id].status && !SKILLS[id].push);
  for (const id of buffs) {
    const st = SKILLS[id].status![0].id;
    if (foes.length >= 2 && !friends.every((f) => has(f, st)) && rng.chance(0.5)) return { type: "skill", skillId: id, actor: actor.uid, target: null };
  }
  // Rows: squishy casters stand back, once, early in the fight.
  if (usable.includes("swaprow") && actor.acted < 2) {
    const caster = actor.max.mag > actor.max.atk * 1.3;
    if (caster && actor.row === "front") return { type: "skill", skillId: "swaprow", actor: actor.uid, target: null };
    if (!caster && actor.row === "back" && !actor.passives.some((p) => p.rule === "anyrow")) return { type: "skill", skillId: "swaprow", actor: actor.uid, target: null };
  }
  // Debt: borrow when dry and nothing cheap is useful.
  if (usable.includes("borrow") && actor.st < 3 && s.debt < 30 && rng.chance(0.7)) return { type: "skill", skillId: "borrow", actor: actor.uid, target: null };
  // Fusion: fuse when two members are healthy and the fight is big.
  if (usable.includes("fuse") && foes.some((f) => f.boss) && actor.fusedWith === null) {
    const partner = friends.find((f) => f.uid !== actor.uid && f.hp > f.max.hp * 0.5 && f.fusedWith === null);
    if (partner && rng.chance(0.5)) return { type: "skill", skillId: "fuse", actor: actor.uid, target: partner.uid };
  }
  // Brace: worth it when a hit is coming and a strong follow up is affordable.
  if (s.mechanics.has("brace") && !has(actor, "brace") && usable.includes("guard") && !actor.guarding) {
    const threat = foes.length >= 2 || foes.some((f) => f.boss);
    const strong = usable.some((id) => (SKILLS[id].power ?? 0) >= 110);
    if (threat && strong && actor.hp < actor.max.hp * 0.8 && rng.chance(0.45)) return { type: "skill", skillId: "guard", actor: actor.uid, target: null };
  }
  // Damage: best expected damage per point of Static, with a kill bonus.
  let best: { score: number; action: Action } | null = null;
  const consider = (sk: SkillDef, make: (t: Combatant | null) => Action) => {
    if (sk.kind !== "phys" && sk.kind !== "mag") return;
    const ts = sk.target === "enemies" ? foes : foes;
    const multi = sk.target === "enemies";
    let total = 0, killBonus = 0, bestT: Combatant | null = null, bestD = -1;
    for (const t of ts) {
      const d = expectedDamage(s, actor, t, sk);
      total += d;
      if (d >= t.hp) killBonus += t.boss ? 5 : 2;
      if (!multi && d > bestD) { bestD = d; bestT = t; }
    }
    const dmg = multi ? total : bestD;
    const costW = sk.cost > 0 ? 1 + sk.cost * 0.05 : 1;
    const debtW = sk.debt ? 1 + sk.debt * 0.15 + (s.debt > 25 ? 2 : 0) : 1;
    // Spend Static freely in boss fights, carefully otherwise.
    const spendBias = foes.some((f) => f.boss) ? 1.2 : 0.8;
    const costPenalty = sk.cost > 0 ? (sk.cost / Math.max(1, actor.max.st)) * (1 - spendBias) * 20 : 0;
    const score = dmg / costW / debtW + killBonus - costPenalty + rng.next() * 2;
    if (!best || score > best.score) best = { score, action: make(multi ? null : bestT) };
  };
  for (const id of usable) consider(SKILLS[id], (t) => ({ type: "skill", skillId: id, actor: actor.uid, target: t?.uid ?? null }));
  if (s.mechanics.has("words") && s.words.length >= 3 && actor.st >= 6) {
    for (const a of legalActions(s, actor)) if (a.type === "word") { const sk = wordSpell(a.words)!; consider(sk, () => a); }
  }
  // Debuffs on bosses are worth a turn now and then.
  if (foes.some((f) => f.boss) && rng.chance(0.2)) {
    const deb = usable.find((id) => SKILLS[id].kind === "support" && SKILLS[id].target === "enemy" && SKILLS[id].status && !foes[0].statuses.some((x) => x.id === SKILLS[id].status![0].id));
    if (deb) return { type: "skill", skillId: deb, actor: actor.uid, target: foes.find((f) => f.boss)!.uid };
  }
  // Elemental items on weak foes when Static is gone.
  if (actor.st < 3) {
    for (const k of items) {
      const u = ITEMS[k].use!;
      if (!u.power || !u.element) continue;
      const weak = foes.find((f) => f.weak.includes(u.element as Element));
      if (weak) return { type: "item", itemId: k, actor: actor.uid, target: weak.uid };
    }
  }
  if (best) return (best as { action: Action }).action;
  return { type: "skill", skillId: "attack", actor: actor.uid, target: foes[0].uid };
};
