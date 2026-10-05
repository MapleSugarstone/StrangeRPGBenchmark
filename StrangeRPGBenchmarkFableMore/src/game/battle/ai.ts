import type { BattleState, Combatant, Skill } from "../types";
import { NOTE_NAMES, type NoteName } from "../../engine/audio";
import {
  type Action, alive, basicOf, canAfford, chordOf, enemies, has, pairSkillsFor, party, pickEnemyTarget, pickWeakest, rngOf, targetable, usableSkills, liftThreshold, itemsOf, locksMatch,
} from "./core";
import { SKILLS } from "../data/skills";
import { ITEMS } from "../data/items";

// ---------------------------------------------------------------------------
// Enemy decisions

export function enemyChoose(s: BattleState, c: Combatant): Action {
  const rng = rngOf(s);
  const foes = targetable(party(s)).filter((p) => !p.reheld);
  const friends = alive(enemies(s));
  const skills = usableSkills(s, c).filter((k) => canAfford(c, k));
  const basic = basicOf(c);
  const attackWeakest = (): Action => {
    const t = pickWeakest(foes, rng);
    return t ? { type: "attack", actor: c.id, target: t.id } : { type: "skill", actor: c.id, skill: "hang" };
  };
  const useSkill = (sk: Skill, target?: Combatant | null): Action => ({ type: "skill", actor: c.id, skill: sk.id, target: target?.id });
  const pick = (ids: string[]): Skill | undefined => skills.find((k) => ids.includes(k.id));
  if (!foes.length) return { type: "skill", actor: c.id, skill: "hang" };

  // Everyone: hang to build tension when nothing else is affordable and tension is low
  const wantsTension = c.economy === "tension" && c.tension <= 1 && skills.some((k) => k.cost > 0) && rng.chance(0.35) && !c.boss;

  switch (c.ai) {
    case "plucker": {
      const pl = pick(["e_pluck"]);
      const held = foes.filter((f) => f.held && !f.letGo);
      const juicy = held.filter((f) => f.tension >= 2 || f.charging);
      if (pl && juicy.length) return useSkill(pl, juicy.sort((a, b) => b.tension - a.tension)[0]);
      const sh = pick(["e_shriek"]);
      if (sh && foes.length >= 2 && rng.chance(0.5)) return useSkill(sh);
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "tugger": {
      const tug = pick(["e_tug"]);
      const held = foes.filter((f) => f.held && !f.letGo);
      if (tug && held.length && rng.chance(s.mech.lift ? 0.7 : 0.4)) {
        // Push the highest tension member toward a Lift, which costs them a turn
        return useSkill(tug, held.sort((a, b) => b.tension - a.tension)[0]);
      }
      return attackWeakest();
    }
    case "elevator": {
      const el = pick(["e_elevate", "e_tug"]);
      const held = foes.filter((f) => f.held && !f.letGo && !has(f, "stopper"));
      const near = held.filter((f) => f.tension >= liftThreshold(f) - 3);
      if (el && near.length && rng.chance(0.75)) return useSkill(el, near.sort((a, b) => b.tension - a.tension)[0]);
      const big = pick(["e_judgment", "e_wail"]);
      if (big && foes.length >= 2 && rng.chance(0.6)) return useSkill(big);
      const pl = pick(["e_pluck"]);
      if (pl && held.some((f) => f.tension >= 3)) return useSkill(pl, held.sort((a, b) => b.tension - a.tension)[0]);
      if (el && held.length && rng.chance(0.5)) return useSkill(el, rng.pick(held));
      const fg = pick(["e_frostgrip"]);
      if (fg && rng.chance(0.5)) return useSkill(fg, pickWeakest(foes, rng));
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "support": {
      const hurt = friends.filter((f) => f.hp < f.maxHp * 0.55 && f.id !== c.id);
      const mend = pick(["e_mend"]);
      if (mend && hurt.length && rng.chance(0.8)) return useSkill(mend, hurt.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]);
      const frame = pick(["e_frame"]);
      if (frame && !friends.some((f) => has(f, "defUp")) && rng.chance(0.6)) return useSkill(frame);
      const el = pick(["e_elevate"]);
      const held = foes.filter((f) => f.held && !f.letGo);
      if (el && held.length && rng.chance(0.4)) return useSkill(el, held.sort((a, b) => b.tension - a.tension)[0]);
      const tug = pick(["e_tug"]);
      if (tug && held.length && rng.chance(0.4)) return useSkill(tug, rng.pick(held));
      const pl = pick(["e_pluck"]);
      if (pl && held.some((f) => f.tension >= 2)) return useSkill(pl, held.sort((a, b) => b.tension - a.tension)[0]);
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "mage": {
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      if (spell.length && rng.chance(0.7)) {
        const sk = rng.pick(spell);
        return useSkill(sk, pickEnemyTarget(s, c, sk));
      }
      const el = pick(["e_elevate"]);
      const held = foes.filter((f) => f.held && !f.letGo);
      if (el && held.length && rng.chance(0.4)) return useSkill(el, held.sort((a, b) => b.tension - a.tension)[0]);
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "windsetter": {
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      if (spell.length && rng.chance(0.75)) {
        const sk = rng.pick(spell);
        return useSkill(sk, pickEnemyTarget(s, c, sk));
      }
      return attackWeakest();
    }
    case "striker": {
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      const howl = pick(["e_howl"]);
      if (howl && !has(c, "atkUp") && rng.chance(0.4)) return useSkill(howl);
      if (spell.length && rng.chance(0.75)) {
        const sk = spell.sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0];
        return useSkill(sk, pickEnemyTarget(s, c, sk));
      }
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "tangler": {
      const tg = pick(["e_tangleup"]);
      const un = foes.filter((f) => !f.tangledWith);
      if (tg && un.length >= 2 && rng.chance(0.7)) {
        const [a, b] = rng.shuffle([...un]);
        return { type: "skill", actor: c.id, skill: tg.id, target: a.id, target2: b.id };
      }
      const dance = pick(["e_dance"]);
      if (dance && !friends.some((f) => has(f, "haste")) && rng.chance(0.5)) return useSkill(dance);
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      if (spell.length && rng.chance(0.5)) { const sk = rng.pick(spell); return useSkill(sk, pickEnemyTarget(s, c, sk)); }
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "hunter": {
      const fathom = foes.find((f) => f.economy === "length");
      const cut = pick(["e_snip", "e_untie", "e_sever"]);
      if (cut && fathom && fathom.knots.length && rng.chance(0.8)) return useSkill(cut, cut.target === "allEnemies" ? undefined : fathom);
      const eat = pick(["e_eat"]);
      if (eat && fathom && fathom.pool >= 2 && rng.chance(0.5)) return useSkill(eat, fathom);
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      if (spell.length && rng.chance(0.6)) { const sk = spell[0]; return useSkill(sk, pickEnemyTarget(s, c, sk)); }
      const cling = pick(["e_cling"]);
      if (cling && !has(c, "taunt") && rng.chance(0.3)) return useSkill(cling);
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
    case "drainer": {
      const dr = pick(["e_drain"]);
      const held = foes.filter((f) => f.held && !f.letGo && f.tension >= 2);
      if (dr && held.length && rng.chance(0.8)) return useSkill(dr, held.sort((a, b) => b.tension - a.tension)[0]);
      const mend = pick(["e_mend"]);
      const hurt = friends.filter((f) => f.hp < f.maxHp * 0.5);
      if (mend && hurt.length && rng.chance(0.6)) return useSkill(mend, hurt[0]);
      return attackWeakest();
    }
    case "reholder": {
      const rh = pick(["e_rehold"]);
      // One hook at a time, so freeing an ally is a choice and not a chore
      const lg = foes.filter((f) => f.letGo && !f.reheld && f.held);
      if (rh && lg.length && !foes.some((f) => f.reheld) && rng.chance(0.45)) return useSkill(rh, rng.pick(lg));
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      if (spell.length && rng.chance(0.6)) { const sk = rng.pick(spell); return useSkill(sk, pickEnemyTarget(s, c, sk)); }
      return attackWeakest();
    }
    case "boss":
      return bossChoose(s, c, skills, foes, friends);
    case "brute":
    default: {
      const cling = pick(["e_cling"]);
      if (cling && !has(c, "taunt") && friends.length > 1 && rng.chance(0.25)) return useSkill(cling);
      const howl = pick(["e_howl"]);
      if (howl && !has(c, "atkUp") && rng.chance(0.3)) return useSkill(howl);
      const spell = skills.filter((k) => k.kind === "attack" && k.cost > 0);
      if (spell.length && rng.chance(0.55)) {
        const sk = rng.pick(spell);
        return useSkill(sk, pickEnemyTarget(s, c, sk));
      }
      if (wantsTension) return useSkill(SKILLS.hang);
      return attackWeakest();
    }
  }
}

function bossChoose(s: BattleState, c: Combatant, skills: Skill[], foes: Combatant[], friends: Combatant[]): Action {
  const rng = rngOf(s);
  const useSkill = (sk: Skill, target?: Combatant | null, target2?: Combatant | null): Action => ({ type: "skill", actor: c.id, skill: sk.id, target: target?.id, target2: target2?.id });
  const pick = (id: string) => skills.find((k) => k.id === id);
  // Summon when minions are down
  const summon = pick("e_summon");
  const minionId = c.defId === "the_lint" ? "lintling" : c.defId === "the_mayoralty" ? "constituent" : c.defId === "the_grip" ? "grip_hand" : null;
  if (summon && minionId && !friends.some((f) => f.defId === minionId) && rng.chance(0.7)) return useSkill(summon);
  // Heal through Absorb when hurt
  const absorb = pick("e_absorb");
  if (absorb && c.hp < c.maxHp * 0.6 && foes.some((f) => f.tension >= 2) && rng.chance(0.6)) return useSkill(absorb);
  // Open Hand heals its own hands
  const open = pick("e_openhand");
  if (open && friends.some((f) => f.id !== c.id && f.hp < f.maxHp * 0.5) && rng.chance(0.5)) return useSkill(open);
  // Re-hold when possible
  const rh = pick("e_rehold");
  const lg = foes.filter((f) => f.letGo && !f.reheld && f.held);
  if (rh && lg.length && !foes.some((f) => f.reheld) && rng.chance(0.35)) return useSkill(rh, rng.pick(lg));
  // Elevate when someone is close to a Lift
  const el = pick("e_elevate") ?? pick("e_reelin");
  const held = foes.filter((f) => f.held && !f.letGo && !has(f, "stopper"));
  if (el && held.length && rng.chance(0.5)) {
    if (el.target === "allEnemies") return useSkill(el);
    return useSkill(el, held.sort((a, b) => b.tension - a.tension)[0]);
  }
  // Tangle
  const tg = pick("e_tangleup");
  const un = foes.filter((f) => !f.tangledWith);
  if (tg && un.length >= 2 && rng.chance(0.5)) { const [a, b] = rng.shuffle([...un]); return useSkill(tg, a, b); }
  // Frame or howl
  const frame = pick("e_frame");
  if (frame && !has(c, "defUp") && rng.chance(0.35)) return useSkill(frame);
  const howl = pick("e_howl");
  if (howl && !has(c, "atkUp") && rng.chance(0.35)) return useSkill(howl);
  // Big attacks, preferring area when the party is many and enraged
  const attacks = skills.filter((k) => (k.kind === "attack" || k.kind === "pluck") && k.cost > 0);
  const area = attacks.filter((k) => k.target === "allEnemies" || k.shape === "lane" || k.shape === "adjacent");
  const single = attacks.filter((k) => !area.includes(k));
  const prefArea = foes.length >= 3 || (c.enraged && foes.length >= 2);
  if (attacks.length && rng.chance(c.enraged ? 0.85 : 0.65)) {
    const pool = prefArea && area.length && rng.chance(0.7) ? area : single.length ? single : attacks;
    const sk = pool.sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[rng.chance(0.6) ? 0 : rng.int(pool.length)];
    return useSkill(sk, sk.target === "allEnemies" ? null : pickEnemyTarget(s, c, sk));
  }
  const cling = pick("e_cling");
  if (cling && !has(c, "taunt") && friends.length > 1 && rng.chance(0.3)) return useSkill(cling);
  if (c.economy === "tension" && c.tension <= 1 && rng.chance(0.3)) return useSkill(SKILLS.hang);
  const t = pickWeakest(foes, rng);
  return t ? { type: "attack", actor: c.id, target: t.id } : useSkill(SKILLS.hang);
}

// ---------------------------------------------------------------------------
// Party policies used by the simulator (and by Auto battle)

export type Policy = (s: BattleState, c: Combatant) => Action;

export const randomPolicy: Policy = (s, c) => {
  const rng = rngOf(s);
  const acts = legalActions(s, c);
  return rng.pick(acts);
};

export const attackOnlyPolicy: Policy = (s, c) => {
  const rng = rngOf(s);
  const foes = targetable(enemies(s));
  const t = pickWeakest(foes, rng);
  if (!t) return { type: "skill", actor: c.id, skill: usableSkills(s, c)[0]?.id ?? "hang" };
  return { type: "attack", actor: c.id, target: t.id };
};

/** Every legal action for an actor, for the random policy and the UI. */
export function legalActions(s: BattleState, c: Combatant): Action[] {
  const out: Action[] = [];
  const foes = targetable(enemies(s));
  const friends = targetable(party(s)).filter((p) => !p.reheld);
  const reheld = party(s).filter((p) => p.reheld && p.alive);
  for (const f of foes) out.push({ type: "attack", actor: c.id, target: f.id });
  for (const r of reheld) out.push({ type: "attack", actor: c.id, target: r.id });
  for (const sk of usableSkills(s, c)) {
    if (!canAfford(c, sk)) continue;
    switch (sk.target) {
      case "self":
      case "none":
        if (sk.kind === "wind") for (const w of [-1, 0, 1] as const) out.push({ type: "skill", actor: c.id, skill: sk.id, wind: w });
        else out.push({ type: "skill", actor: c.id, skill: sk.id });
        break;
      case "enemy":
        for (const f of foes) {
          if (sk.kind === "climb" && (!f.held || f.letGo)) continue;
          if (sk.kind === "tune") { for (const n of NOTE_NAMES) if (f.held && n !== f.note) out.push({ type: "skill", actor: c.id, skill: sk.id, target: f.id, note: n }); continue; }
          out.push({ type: "skill", actor: c.id, skill: sk.id, target: f.id });
        }
        if (sk.kind === "pluck") for (const r of reheld) out.push({ type: "skill", actor: c.id, skill: sk.id, target: r.id });
        break;
      case "ally":
        for (const f of friends) out.push({ type: "skill", actor: c.id, skill: sk.id, target: f.id });
        break;
      case "anyone":
        for (const f of [...friends, ...foes]) out.push({ type: "skill", actor: c.id, skill: sk.id, target: f.id });
        break;
      case "allEnemies":
      case "allAllies":
        if (sk.effect === "reef") {
          for (let i = 0; i < friends.length; i++) for (let j = i + 1; j < friends.length; j++) out.push({ type: "skill", actor: c.id, skill: sk.id, target: friends[i].id, target2: friends[j].id });
        } else out.push({ type: "skill", actor: c.id, skill: sk.id });
        break;
      case "twoEnemies":
        for (let i = 0; i < foes.length; i++) for (let j = i + 1; j < foes.length; j++) out.push({ type: "skill", actor: c.id, skill: sk.id, target: foes[i].id, target2: foes[j].id });
        break;
    }
  }
  c.knots.forEach((_, i) => out.push({ type: "untie", actor: c.id, knot: i }));
  for (const p of pairSkillsFor(s, c)) {
    if (p.skill.target === "enemy") for (const f of foes) out.push({ type: "pair", actor: c.id, partner: p.partner.id, skill: p.skill.id, target: f.id });
    else if (p.skill.target === "ally") for (const f of friends) out.push({ type: "pair", actor: c.id, partner: p.partner.id, skill: p.skill.id, target: f.id });
    else out.push({ type: "pair", actor: c.id, partner: p.partner.id, skill: p.skill.id });
  }
  const inv = itemsOf(s);
  for (const id of Object.keys(inv)) {
    if (inv[id] <= 0) continue;
    const it = ITEMS[id];
    if (!it || it.kind !== "consumable") continue;
    if (it.target === "enemy") { if (it.id === "firepot") out.push({ type: "item", actor: c.id, item: id }); else for (const f of foes) out.push({ type: "item", actor: c.id, item: id, target: f.id }); }
    else if (it.target === "allAllies") out.push({ type: "item", actor: c.id, item: id });
    else for (const f of party(s)) if (it.revive ? !f.alive && !f.taken : f.alive) out.push({ type: "item", actor: c.id, item: id, target: f.id });
  }
  if (out.length === 0) out.push({ type: "skill", actor: c.id, skill: c.held && !c.letGo ? "hang" : "duck" });
  return out;
}

/**
 * The heuristic player: heals when needed, plucks the taut and the charging,
 * completes chords, ties knots early, hits weaknesses, and vents tension
 * before a Lift it does not want.
 */
export const heuristicPolicy: Policy = (s, c) => {
  const rng = rngOf(s);
  const foes = targetable(enemies(s));
  const friends = targetable(party(s)).filter((p) => !p.reheld);
  const reheld = party(s).filter((p) => p.reheld && p.alive);
  const skills = usableSkills(s, c).filter((k) => canAfford(c, k));
  const pick = (id: string) => skills.find((k) => k.id === id);
  const inv = itemsOf(s);
  const sk = (id: string, target?: Combatant, target2?: Combatant, note?: NoteName): Action => ({ type: "skill", actor: c.id, skill: id, target: target?.id, target2: target2?.id, note });
  if (!foes.length) return { type: "skill", actor: c.id, skill: c.held && !c.letGo ? "hang" : "duck" };

  // Free re-held friends first
  const pluck = skills.find((k) => k.kind === "pluck");
  if (reheld.length && pluck) return sk(pluck.id, reheld[0]);
  if (reheld.length) return { type: "attack", actor: c.id, target: reheld[0].id };

  // Revive
  const dead = party(s).filter((p) => !p.alive && !p.taken);
  if (dead.length && (inv.leaddrop ?? 0) > 0) return { type: "item", actor: c.id, item: "leaddrop", target: dead[0].id };

  // Heal
  const hurt = friends.filter((f) => f.hp < f.maxHp * 0.35);
  const anyHurt = friends.filter((f) => f.hp < f.maxHp * 0.55);
  if (hurt.length) {
    const harmonic = pick("harmonic");
    if (harmonic) return sk("harmonic", hurt[0]);
    const openhand = pick("p_held");
    if ((inv.underbread ?? 0) > 0) return { type: "item", actor: c.id, item: "underbread", target: hurt[0].id };
    if ((inv.flatbread ?? 0) > 0) return { type: "item", actor: c.id, item: "flatbread", target: hurt[0].id };
    if ((inv.slattea ?? 0) > 0 && anyHurt.length >= 2) return { type: "item", actor: c.id, item: "slattea" };
    void openhand;
  }
  // Let Go an ally through Marrow when they are hurt and taut
  const release = pick("release");
  if (release) {
    const cand = friends.filter((f) => f.held && !f.letGo && f.tension >= 3 && f.hp < f.maxHp * 0.6);
    if (cand.length) return sk("release", cand[0]);
  }
  const hold = pick("hold");
  if (hold) {
    const cand = friends.filter((f) => f.hp < f.maxHp * 0.4 && !has(f, "hold"));
    if (cand.length) return sk("hold", cand[0]);
  }

  // Duck when fragile and something is charging or you are low
  const charging = foes.filter((f) => f.charging);
  const duck = skills.find((k) => k.kind === "duck");
  if (duck && c.hp < c.maxHp * 0.3 && rng.chance(0.6)) return sk(duck.id);
  if (duck && charging.length && c.hp < c.maxHp * 0.5 && !c.knots.length && rng.chance(0.5)) return sk(duck.id);

  // Break locks on a charging foe
  if (charging.length && s.mech.locks) {
    for (const f of charging) {
      const need = f.charging!.locks.filter((_, i) => !f.charging!.matched[i]);
      const answers = (lock?: string) => !!lock && need.some((l) => locksMatch(lock, l));
      const breaker = skills.find((k) => answers(k.lock) && (k.target === "enemy" || k.target === "allEnemies"));
      if (breaker) return sk(breaker.id, breaker.target === "enemy" ? f : undefined);
      if (answers(basicOf(c).lock)) return { type: "attack", actor: c.id, target: f.id };
    }
  }
  // A big move is coming and nothing here can break it: brace for it
  const bigCharge = charging.some((f) => { const k = SKILLS[f.charging!.skill]; return k.target === "allEnemies" || (k.power ?? 0) >= 150; });
  if (bigCharge && c.held && !c.letGo && !has(c, "guard") && rng.chance(0.7)) return sk("hang");
  if (bigCharge && duck && c.hp < c.maxHp * 0.7 && rng.chance(0.7)) return sk(duck.id);
  // Pluck a taut or charging foe
  if (pluck) {
    const juicy = foes.filter((f) => f.held && !f.letGo && (f.tension >= 3 || f.charging));
    if (juicy.length) return sk(pluck.id, juicy.sort((a, b) => b.tension - a.tension)[0]);
  }
  // Hush a charging foe
  const hush = pick("hush");
  if (hush && charging.length) return sk("hush", charging[0]);
  // Climb the taut
  const climb = pick("climb");
  if (climb) {
    const cand = foes.filter((f) => f.held && !f.letGo && (f.tension >= 2 || f.boss) && f.hp > f.maxHp * 0.4);
    if (cand.length && rng.chance(0.6)) return sk("climb", cand.sort((a, b) => b.hp - a.hp)[0]);
  }
  // Complete a chord with Tune
  const tune = pick("tune");
  if (tune && s.phrase.length === 2) {
    for (const f of foes) {
      if (!f.held) continue;
      for (const n of NOTE_NAMES) {
        const kind = chordOf([...s.phrase, n]);
        if (kind && (kind === "major" ? anyHurt.length > 0 : true)) return sk("tune", f, undefined, n);
      }
    }
  }
  // Tension management: vent before an unwanted Lift unless Rise is better,
  // and go quiet when the Bite is close and you are the loudest line
  const loudest = alive(party(s)).concat(foes).filter((x) => x.held && !x.letGo).sort((a, b) => b.tension - a.tension)[0];
  if (c.held && !c.letGo && s.bite > 65 && loudest?.id === c.id && c.tension >= 2) {
    const spender = skills.filter((k) => k.cost >= 2 && k.kind !== "rise" && k.kind !== "tune");
    if (spender.length) return skillAction(s, c, spender.sort((a, b) => b.cost - a.cost)[0], foes, friends);
  }
  if (c.held && !c.letGo && s.mech.lift && c.tension >= liftThreshold(c) - 1) {
    const rise = pick("rise");
    if (rise && c.hp > c.maxHp * 0.6 && !anyHurt.length && rng.chance(0.4)) return sk("rise");
    const spender = skills.filter((k) => k.cost >= 2 && k.kind !== "rise" && k.kind !== "tune");
    if (spender.length) {
      const best = spender.sort((a, b) => b.cost - a.cost)[0];
      return skillAction(s, c, best, foes, friends);
    }
  }
  // Knots early
  if (c.economy === "length" && c.pool >= 3 && !c.knots.length && s.actions < 6) {
    const bow = pick("k_bowline");
    const tank = friends.find((f) => f.defId === "burl" || f.defId === "sump") ?? friends.find((f) => f.id !== c.id);
    if (bow && tank && !has(tank, "shield")) return sk("k_bowline", tank);
  }
  if (c.economy === "length") {
    const fist = pick("k_fist");
    const big = foes.filter((f) => f.hp > f.maxHp * 0.5 && !has(f, "bleed"));
    if (fist && big.length && c.pool >= 2 && rng.chance(0.5)) return sk("k_fist", big.sort((a, b) => b.maxHp - a.maxHp)[0]);
    const snare = pick("k_snare");
    const chg = foes.find((f) => f.charging && !has(f, "snare"));
    if (snare && chg) return sk("k_snare", chg);
    const clove = pick("k_clove");
    const caster = foes.find((f) => f.held && !f.letGo && !f.boss && f.tension >= 2 && !has(f, "clove"));
    if (clove && caster && c.pool >= 3 && rng.chance(0.5)) return sk("k_clove", caster);
    // Untie a knot whose target is almost dead to get the length back
    for (let i = 0; i < c.knots.length; i++) {
      const k = c.knots[i];
      const ts = k.targets.map((id) => s.combatants.find((x) => x.id === id)).filter(Boolean) as Combatant[];
      if (ts.every((t) => t.side === "enemy" && t.hp < t.maxHp * 0.15) && c.pool < 2) return { type: "untie", actor: c.id, knot: i };
    }
  }
  // Tank: taunt when allies are hurt
  const snarl = pick("snarl");
  if (snarl && !has(c, "taunt") && anyHurt.some((f) => f.id !== c.id) && rng.chance(0.7)) return sk("snarl");
  const swallow = pick("swallow");
  if (swallow && !has(c, "swallow") && anyHurt.some((f) => f.id !== c.id) && rng.chance(0.6)) return sk("swallow");
  // Tangle two untangled foes
  const tangle = pick("tangle");
  const un = foes.filter((f) => !f.tangledWith);
  if (tangle && un.length >= 2 && rng.chance(0.75)) return sk("tangle", un[0], un[1]);
  // Set the wind to line up a lane skill
  const setwind = pick("setwind");
  if (setwind && s.mech.lanes && rng.chance(0.3)) {
    const counts = [0, 1, 2].map((l) => foes.filter((f) => f.lane === l).length);
    const best = counts.indexOf(Math.max(...counts));
    const w = best === 1 ? 0 : best === 0 ? -1 : 1;
    return { type: "skill", actor: c.id, skill: "setwind", wind: w as -1 | 0 | 1 };
  }
  // Pairs when both are ready and the fight is still big
  const pairs = pairSkillsFor(s, c);
  if (pairs.length && foes.reduce((a, f) => a + f.hp, 0) > 120 && rng.chance(0.6)) {
    const p = pairs[0];
    if (p.skill.target === "enemy") return { type: "pair", actor: c.id, partner: p.partner.id, skill: p.skill.id, target: pickWeakest(foes, rng)!.id };
    if (p.skill.target === "ally") { const a = anyHurt[0] ?? friends[0]; return { type: "pair", actor: c.id, partner: p.partner.id, skill: p.skill.id, target: a.id }; }
    return { type: "pair", actor: c.id, partner: p.partner.id, skill: p.skill.id };
  }
  // Survey once, and only when there is more than one thing to learn about
  const plumb = pick("plumb");
  if (plumb && foes.length > 1 && foes.some((f) => f.revealed.length < f.weak.length) && rng.chance(0.8)) return sk("plumb");
  // Best damaging skill
  const dmg = skills.filter((k) => (k.kind === "attack" || k.kind === "pluck") && k.cost > 0);
  if (dmg.length && rng.chance(0.8)) {
    const best = dmg.sort((a, b) => scoreDamage(b, foes) - scoreDamage(a, foes))[0];
    return skillAction(s, c, best, foes, friends);
  }
  // Hang when tension is low and nothing is urgent
  if (c.held && !c.letGo && c.tension <= 1 && skills.some((k) => k.cost >= 2) && rng.chance(0.4)) return sk("hang");
  // Attack something weak to the basic's element, else the weakest
  const basic = basicOf(c);
  const weakTo = basic.element ? foes.filter((f) => f.weak.includes(basic.element!)) : [];
  const t = weakTo.length ? pickWeakest(weakTo, rng)! : pickWeakest(foes, rng)!;
  return { type: "attack", actor: c.id, target: t.id };
};

function scoreDamage(k: Skill, foes: Combatant[]): number {
  const n = k.target === "allEnemies" || k.shape === "all" ? foes.length : k.shape === "lane" || k.shape === "adjacent" ? Math.min(foes.length, 2) : 1;
  const weak = k.element ? foes.filter((f) => f.weak.includes(k.element!)).length : 0;
  return (k.power ?? 0) * n * (1 + weak * 0.3) / Math.max(1, k.cost);
}

function skillAction(s: BattleState, c: Combatant, k: Skill, foes: Combatant[], friends: Combatant[]): Action {
  const rng = rngOf(s);
  if (k.target === "enemy") {
    let pool = foes;
    if (k.element) { const w = foes.filter((f) => f.weak.includes(k.element!)); if (w.length) pool = w; }
    if (k.kind === "pluck") pool = foes.filter((f) => f.held && !f.letGo).length ? foes.filter((f) => f.held && !f.letGo) : foes;
    return { type: "skill", actor: c.id, skill: k.id, target: pickWeakest(pool, rng)!.id };
  }
  if (k.target === "ally") return { type: "skill", actor: c.id, skill: k.id, target: (friends.find((f) => f.hp < f.maxHp * 0.6) ?? friends[0]).id };
  if (k.target === "twoEnemies") { const un = foes.filter((f) => !f.tangledWith); if (un.length >= 2) return { type: "skill", actor: c.id, skill: k.id, target: un[0].id, target2: un[1].id }; return { type: "attack", actor: c.id, target: foes[0].id }; }
  return { type: "skill", actor: c.id, skill: k.id };
}
