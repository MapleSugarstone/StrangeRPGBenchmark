// Small tools for writing passives (src/content/passive_code.ts) against the hooks in hooks.ts.
import type { Ctx } from './hooks.js';
import type { RuinState } from './engine.js';
import { faint, landStatus, harmful, fieldDamage, weighingMoves } from './engine.js';
import { Status } from './statuses.js';
import { SPECIES } from './species.js';
import { line } from './lines.js';

export const nameOf = (r: RuinState) => r.nick || (SPECIES[r.speciesKey]?.name ?? r.speciesKey);
export const typeOf = (r: RuinState) => SPECIES[r.speciesKey]?.types?.[0] ?? 'Stone';
export const hasStatus = (r: RuinState, s: string) => r.statuses.some((x) => x.status === s && x.turnsLeft > 0);
// engine.ts loads this file before it defines harmful, so the call looks harmful up when it runs.
export const isHarmful = (s: string) => harmful(s);

/** Mends a Ruin by n HP (not past its max) and says so. Returns how much it mended. */
export function heal(c: Ctx, target: RuinState, n: number): number {
  if (target.isFainted) return 0;
  const amount = Math.min(target.maxHp - target.hp, Math.max(0, Math.round(n)));
  if (amount > 0) { target.hp += amount; c.say(line('regen', { name: nameOf(target), n: amount })); }
  return amount;
}

/** Takes n HP from a Ruin outside of a hit (a Field State's after the Ruin's passives), says so, and knocks it out at 0. Returns the damage done. */
export function hurt(c: Ctx, target: RuinState, n: number): number {
  if (target.isFainted) return 0;
  if (c.field) { n = fieldDamage(c.state, target, n); if (n <= 0) return 0; }
  const amount = Math.max(1, Math.round(n));
  target.hp -= amount;
  let text = line('tick', { name: nameOf(target), n: amount, status: c.passive });
  if (target.hp <= 0) text += faint(c.state, target, target === c.self ? undefined : c.self);
  c.say(text.trim());
  return amount;
}

/** Puts a status on a Ruin through the usual checks (Stasis, Unstoppable, immunities, passives), and says so. */
export function addStatus(c: Ctx, target: RuinState, status: string, turns?: number): boolean {
  const said = landStatus(c.state, target, status as Status);
  if (!said) return false;
  if (turns !== undefined) { const held = target.statuses.find((s) => s.status === status); if (held) held.turnsLeft = turns; }
  c.say(said.trim());
  return said.includes('applied');
}

/** Removes statuses from a Ruin: all harmful ones, or the named one. */
export function clearStatus(target: RuinState, status?: string): boolean {
  const before = target.statuses.length;
  target.statuses = target.statuses.filter((s) => (status ? s.status !== status : !harmful(s.status)));
  return target.statuses.length < before;
}

/** Raises (or with a negative amount, lowers) a stat by a percent for the rest of the battle, within 60% either way. */
export function raise(target: RuinState, stat: 'atk' | 'def' | 'res' | 'mgk' | 'agi', percent: number): void {
  const mods = (target.mods ??= {});
  mods[stat] = Math.max(-60, Math.min(60, (mods[stat] ?? 0) + percent));
}

/** Gives the player's team Boost (0 to 10). Only the player's side holds Boost. */
export function giveBoost(c: Ctx, n: number): void {
  if (!c.mine) return;
  c.state.boost = Math.max(0, Math.min(10, c.state.boost + n));
}

/** The game has no dice: a chance in percent builds on a meter and comes true each time it passes 100. */
export function chance(c: Ctx, key: string, percent: number): boolean {
  c.mem[`meter:${key}`] = (c.mem[`meter:${key}`] ?? 50) + percent;
  if (c.mem[`meter:${key}`] < 100) return false;
  c.mem[`meter:${key}`] -= 100;
  return true;
}

/** Whether chance(c, key, percent) would come true now, without building the meter. A trainer weighing its moves sees no. */
export function peek(c: Ctx, key: string, percent: number): boolean {
  return !weighingMoves() && (c.mem[`meter:${key}`] ?? 50) + percent >= 100;
}

/** Counts calls under a key and is true on every nth one: every(c, 'hits', 3) is true on the 3rd, 6th, 9th... */
export function every(c: Ctx, key: string, n: number): boolean {
  c.mem[`count:${key}`] = (c.mem[`count:${key}`] ?? 0) + 1;
  return c.mem[`count:${key}`] % n === 0;
}

/** True only the first time it is asked under a key this battle. */
export function once(c: Ctx, key: string): boolean {
  if (c.mem[`once:${key}`]) return false;
  c.mem[`once:${key}`] = true;
  return true;
}

/** The standing Ruin of a team, the active one first. */
export const standing = (team: RuinState[]) => team.filter((r) => !r.isFainted);
