// Rules that act on their own in battle: the worn Resonance (the player's team) and the battle's Field State
// (everyone), in the words of Notes/qwen/rules-vocab.md, which Qwen wrote them in. Passives are code (hooks.ts).
import { Status } from './statuses.js';
import { Type, getTypeMultiplier } from './types.js';
import { SPECIES } from './species.js';
import { line, PACK } from './lines.js';
import type { BattleState, RuinState } from './engine.js';
import { faint, landStatus, harmful } from './engine.js';

export interface Rule {
  when: string;
  if?: string;
  do: string;
  amount?: number;
  stat?: string;
  status?: string;
  /** Resonance and Field States only: acts only for Ruin, or hits of moves, of this type. */
  type?: string;
  name?: string;
  text?: string;
}

/** A rule with where it came from: its name for messages and a key for its meter and stack count. */
interface Held extends Rule { src: string; key: string }

const STAT: Record<string, 'atk' | 'def' | 'res' | 'mgk' | 'agi'> = { ATK: 'atk', DEF: 'def', RES: 'res', MGK: 'mgk', AGI: 'agi' };
const nameOf = (r: RuinState) => r.nick || (SPECIES[r.speciesKey]?.name ?? r.speciesKey);
const typeOf = (r: RuinState) => (SPECIES[r.speciesKey]?.types?.[0] ?? 'Stone') as Type;
const isPlayer = (state: BattleState, r: RuinState) => state.playerTeam.includes(r);
const foeOf = (state: BattleState, r: RuinState) => (isPlayer(state, r) ? state.opponentTeam[0] : state.playerTeam[0]);

function rulesFor(state: BattleState, r: RuinState): Held[] {
  const out: Held[] = [];
  if (isPlayer(state, r)) for (const t of state.teamRules ?? []) out.push({ ...t, src: t.name ?? '', key: `t:${t.name}` });
  for (const f of state.field?.rules ?? []) out.push({ ...f, src: state.field!.name, key: `f:${state.field!.name}:${f.do}` });
  return out;
}

/** Whether a rule's type filter lets it act: the Ruin's type, or the move's type for anything about a hit. */
function typeOk(rule: Rule, r: RuinState, moveType?: string): boolean {
  if (!rule.type) return true;
  return moveType ? moveType === rule.type : typeOf(r) === rule.type;
}

function condition(state: BattleState, rule: Rule, r: RuinState): boolean {
  const foe = foeOf(state, r);
  switch (rule.if) {
    case undefined: case '': return true;
    case 'own_hp_below_half': return r.hp <= r.maxHp / 2;
    case 'foe_hp_below_half': return !!foe && foe.hp <= foe.maxHp / 2;
    case 'foe_has_status': return !!foe && foe.statuses.some((s) => s.turnsLeft > 0 && harmful(s.status));
    case 'bad_matchup': return !!foe && getTypeMultiplier(typeOf(foe), typeOf(r)) > 1;
    case 'first_turn': return state.turn === 1;
    case 'boost_5': return isPlayer(state, r) && state.boost >= 5;
    default: return false;
  }
}

/** Whether a standing modifier (power, shield, pierce, thrift, immune, follow) is on now. */
function standing(state: BattleState, rule: Held, r: RuinState): boolean {
  if (rule.when === 'low') return !!r.lowFired;
  if (rule.when === 'guard') return isPlayer(state, r) && !!state.guard && state.playerTeam[0] === r;
  if (rule.when === 'enter') return r.enteredTurn === state.turn;
  return true;
}

/** The summed amount of a standing modifier on this Ruin, for a hit of this move type where it matters. */
export function modSum(state: BattleState, r: RuinState, kind: string, moveType?: string, stat?: string): number {
  return rulesFor(state, r).filter((x) => x.do === kind && (!x.stat || !stat || x.stat === stat) && typeOk(x, r, moveType) && standing(state, x, r) && condition(state, x, r))
    .reduce((sum, x) => sum + (x.amount ?? 0), 0);
}

export function immuneTo(state: BattleState, r: RuinState, status: string): boolean {
  return rulesFor(state, r).some((x) => x.do === 'immune' && x.status === status && typeOk(x, r));
}

export function thrifty(state: BattleState, r: RuinState): boolean {
  return rulesFor(state, r).some((x) => x.do === 'thrift' && typeOk(x, r) && condition(state, x, r));
}

/** A stat with the raises and drops from rules this battle, at most 60% either way. */
export function statOf(r: RuinState, stat: 'atk' | 'def' | 'res' | 'mgk' | 'agi'): number {
  const m = Math.max(-60, Math.min(60, r.mods?.[stat] ?? 0));
  return r.currentStats[stat] * (1 + m / 100);
}

const passiveLine = (r: RuinState, src: string) => PACK + line('passive', { name: nameOf(r), passive: src });

/** Runs every rule of this Ruin that acts at this moment. */
export function fire(state: BattleState, r: RuinState, when: string, logs: string[], ctx: { damage?: number; other?: RuinState; moveType?: string } = {}): void {
  if (r.isFainted && when !== 'ko') return;
  for (const rule of rulesFor(state, r)) {
    if (rule.when !== when || !typeOk(rule, r, when === 'hit' ? ctx.moveType : undefined) || !condition(state, rule, r)) continue;
    const foe = ctx.other ?? foeOf(state, r);
    const a = rule.amount ?? 0;
    switch (rule.do) {
      case 'heal': case 'drain': {
        const base = rule.do === 'heal' ? r.maxHp * a / 100 : (ctx.damage ?? 0) * a / 100;
        const n = Math.min(r.maxHp - r.hp, Math.max(1, Math.round(base)));
        if (n > 0 && !r.isFainted) { r.hp += n; logs.push(`${passiveLine(r, rule.src)} ${line('regen', { name: nameOf(r), n })}`); }
        break;
      }
      case 'boost':
        if (isPlayer(state, r) && state.boost < 10) { state.boost = Math.min(10, state.boost + a); logs.push(passiveLine(r, rule.src)); }
        break;
      case 'status_self': {
        const said = landStatus(state, r, rule.status as Status);
        if (said) logs.push(`${passiveLine(r, rule.src)}${said}`);
        break;
      }
      case 'status_foe': {
        if (!foe || foe.isFainted) break;
        const meters = (r.meters ??= {});
        meters[rule.key] = (meters[rule.key] ?? 50) + a;
        if (meters[rule.key] < 100) break;
        meters[rule.key] -= 100;
        const said = landStatus(state, foe, rule.status as Status);
        if (said) logs.push(`${passiveLine(r, rule.src)}${said}`);
        break;
      }
      case 'chip': {
        if (!foe || foe.isFainted) break;
        const n = Math.max(1, Math.round(foe.maxHp * a / 100));
        foe.hp -= n;
        let text = `${passiveLine(r, rule.src)} ${line('tick', { name: nameOf(foe), n, status: rule.src })}`;
        if (foe.hp <= 0) text += faint(state, foe);
        logs.push(text);
        break;
      }
      case 'raise': case 'lower': {
        const target = rule.do === 'raise' ? r : foe;
        if (!target || target.isFainted) break;
        const stacks = (r.stacks ??= {});
        if ((stacks[rule.key] ?? 0) >= 3) break;
        stacks[rule.key] = (stacks[rule.key] ?? 0) + 1;
        const s = STAT[rule.stat ?? ''];
        if (!s) break;
        (target.mods ??= {})[s] = (target.mods[s] ?? 0) + (rule.do === 'raise' ? a : -a);
        logs.push(passiveLine(r, rule.src));
        break;
      }
      case 'cleanse': {
        const before = r.statuses.length;
        r.statuses = r.statuses.filter((s) => !harmful(s.status));
        if (r.statuses.length < before) logs.push(passiveLine(r, rule.src));
        break;
      }
      case 'reflect': {
        const attacker = ctx.other;
        if (!attacker || attacker.isFainted || !ctx.damage) break;
        const n = Math.max(1, Math.round(ctx.damage * a / 100));
        attacker.hp -= n;
        let text = `${passiveLine(r, rule.src)} ${line('tick', { name: nameOf(attacker), n, status: rule.src })}`;
        if (attacker.hp <= 0) text += faint(state, attacker);
        logs.push(text);
        break;
      }
      case 'cool':
        if (r.moves.some((m) => m.cooldownLeft > 0)) { r.moves.forEach((m) => (m.cooldownLeft = Math.max(0, m.cooldownLeft - 1))); logs.push(passiveLine(r, rule.src)); }
        break;
    }
  }
}

/** After any loss of HP: the first fall to half HP or less sets off "low" rules once. */
export function checkLow(state: BattleState, r: RuinState, logs: string[]): void {
  if (r.isFainted || r.lowFired || r.hp > r.maxHp / 2) return;
  r.lowFired = true;
  fire(state, r, 'low', logs);
}

/** A Ruin comes onto the field. */
export function enter(state: BattleState, r: RuinState, logs: string[]): void {
  if (r.isFainted) return;
  r.enteredTurn = state.turn;
  fire(state, r, 'enter', logs);
}
