import { Type, getTypeMultiplier } from './types.js';
import { Stats, getBaseStats } from './stats.js';
import { Status, StatusInstance, applyStatus } from './statuses.js';
import { MoveData, MoveInstance, MOVES, MoveKind, AttackKind, Reach } from './moves.js';
import { SPECIES } from './species.js';
import { line, BASIC_NAMES, PACK } from './lines.js';
import { fire, modSum, statOf, immuneTo, thrifty, checkLow, enter as enterRules, type Rule } from './rules.js';
import { PASSIVE_CODE, PASSIVE_TEXT } from '../content/passive_code.js';
import { FIELD_CODE } from '../content/field_code.js';
import type { Ctx, PassiveCode, HitInfo } from './hooks.js';

/**
 * Represents a Ruin in battle.
 */
export interface RuinState {
  speciesKey: string;
  level: number;
  hp: number;
  maxHp: number;
  currentStats: Stats;
  statuses: StatusInstance[];
  moves: MoveInstance[];
  isLinkActive: boolean;
  linkPartnerKey?: string;
  isReserve: boolean;
  isFainted: boolean;
  /** Status chance built up per move: a status lands each time its meter passes 100, so nothing is left to luck. */
  meters?: Record<string, number>;
  /** Raises and drops in percent from rules this battle, and how many times each rule has stacked. */
  mods?: Partial<Record<'atk' | 'def' | 'res' | 'mgk' | 'agi', number>>;
  stacks?: Record<string, number>;
  /** The first fall to half HP has happened, and the turn it last came onto the field. */
  lowFired?: boolean;
  enteredTurn?: number;
  /** The player's own name for it, if given. */
  nick?: string;
  /** Each passive's memory for this battle, by the species key it came from. */
  mem?: Record<string, Record<string, any>>;
  /** Made during the battle by a passive. A copy leaves the player's team when the battle ends. */
  copy?: boolean;
}

/**
 * Represents the active opponent Ruin for targeting.
 */
export interface OpponentState {
  ruinState: RuinState;
}

/** A Ruin's species name for battle messages. */
const nameOf = (r: { speciesKey: string; nick?: string }) => r.nick || (SPECIES[r.speciesKey]?.name ?? r.speciesKey);

const has = (r: RuinState, s: Status) => r.statuses.some((x) => x.status === s && x.turnsLeft > 0);

/** The Magnet's catch line: a quarter of max HP per strength (it starts at 2), a quarter more with a Heavy Grip, and
 * 10% more while the foe cannot act freely. */
export function catchLine(foe: { statuses?: StatusInstance[] }, grip = false, magnet = 2): number {
  const held = (foe.statuses ?? []).some((s) => s.turnsLeft > 0 && [Status.Stun, Status.Silence, Status.Sleep, Status.Root].includes(s.status));
  return 0.25 * (magnet + (grip ? 1 : 0)) + (held ? 0.1 : 0);
}

/** A catch holds on a Ruin at or below the catch line, or on one five or more levels below the lead at any HP. */
export function canCatch(lead: { level: number }, foe: { hp: number; maxHp: number; level: number; isFainted?: boolean; statuses?: StatusInstance[] }, grip = false, magnet = 2, bar?: number): boolean {
  return !foe.isFainted && (foe.hp / foe.maxHp <= (bar ?? catchLine(foe, grip, magnet)) || foe.level <= lead.level - 5);
}

/** A Ruin's max HP at a level, the same as in battle, for healing on the field. */
export function ruinMaxHp(speciesKey: string, level: number): number {
  return createRuinState(speciesKey, level, false).maxHp;
}

/** A Ruin's battle stats at a level, before quenching, for the Quench Station's screen. */
export function ruinStats(speciesKey: string, level: number): Stats {
  return createRuinState(speciesKey, level, false).currentStats;
}

/** A big move committed now that lands at the end of a later turn. */
export interface WindUp {
  side: 'player' | 'opponent';
  ruinKey: string;
  moveKey: string;
  turnsLeft: number;
  /** Made this turn, so this turn's end does not count down. */
  fresh: boolean;
}

/**
 * Battle state.
 */
export interface BattleState {
  playerTeam: RuinState[];
  opponentTeam: RuinState[];
  /** The player's pool, 0 to 10, earned by acting and spent on moves and the Link. */
  boost: number;
  turn: number;
  windUps: WindUp[];
  log: string[];
  winner: 'player' | 'opponent' | null;
  fled: boolean;
  /** A Heavy Grip readied for the next catch. */
  grip?: boolean;
  /** The player's lead guards this turn and takes half damage. */
  guard?: boolean;
  /** Turns until Link can be used again. */
  linkCooldown?: number;
  /** The player's slot linked to the lead. */
  linkPartner?: number;
  /** The lead has fallen and the player must send out another Ruin before anything else. */
  needSwitch?: boolean;
  /** The opponent weighs its moves instead of taking them in turn (trainers and big fights). */
  smartFoe?: boolean;
  /** The worn Resonance's rule, for the player's team. */
  teamRules?: Rule[];
  /** The Field State the battle happens in. */
  field?: { name: string; text: string; opens: string; rules?: Rule[] };
  /** The Magnet's strength, 2 to 4. */
  magnet?: number;
}

// ---------- passives as code ----------

/** The passive code a Ruin carries: its species' own, or a fused Ruin's parents' (`passiveOf`), then the battle's
 * Field State, which acts for everyone. */
function codesOf(state: BattleState, r: RuinState): [string, PassiveCode][] {
  const keys: string[] = (SPECIES[r.speciesKey] as any)?.passiveOf ?? [r.speciesKey];
  const out: [string, PassiveCode][] = keys.filter((k) => PASSIVE_CODE[k]).map((k) => [k, PASSIVE_CODE[k]]);
  if (state.field && FIELD_CODE[state.field.name]) out.push([`field:${state.field.name}`, FIELD_CODE[state.field.name]]);
  return out;
}

function ctxOf(state: BattleState, r: RuinState, key: string, logs: string[], other?: RuinState): Ctx {
  const mine = state.playerTeam.includes(r);
  const team = mine ? state.playerTeam : state.opponentTeam, foes = mine ? state.opponentTeam : state.playerTeam;
  const mem = ((r.mem ??= {})[key] ??= {});
  return {
    state, self: r, foe: other ?? foes[0], mine, team, foes, mem, passive: PASSIVE_TEXT[key]?.name ?? key.replace(/^field:/, ''),
    field: key.startsWith('field:'),
    // A Field State speaks without naming a Ruin; a passive names its holder first.
    say: (after?: string) => logs.push(PACK + [key.startsWith('field:') ? '' : line('passive', { name: nameOf(r), passive: PASSIVE_TEXT[key]?.name ?? '' }), after ?? '']
      .filter(Boolean).join(' ')),
  };
}

/** Calls a passive hook on a Ruin; the result of each passive's hook is passed to `each`. */
function hook<K extends keyof PassiveCode>(state: BattleState, r: RuinState, name: K, logs: string[], other: RuinState | undefined,
  call: (fn: NonNullable<PassiveCode[K]>, c: Ctx) => unknown): unknown[] {
  const out: unknown[] = [];
  for (const [key, code] of codesOf(state, r)) {
    const fn = code[name];
    if (fn) out.push(call(fn as NonNullable<PassiveCode[K]>, ctxOf(state, r, key, logs, other)));
  }
  return out;
}

/** The product of a multiplier hook's answers, 1 when none. */
function mult<K extends keyof PassiveCode>(state: BattleState, r: RuinState, name: K, other: RuinState | undefined,
  call: (fn: NonNullable<PassiveCode[K]>, c: Ctx) => unknown): number {
  return hook(state, r, name, [], other, call).reduce((p: number, v) => p * (typeof v === 'number' && isFinite(v) ? v : 1), 1);
}

/** The damage the battle's Field State deals a Ruin outside of a hit, after its passives. */
export function fieldDamage(state: BattleState, r: RuinState, n: number): number {
  for (const v of hook(state, r, 'fieldDamage', [], undefined, (fn, c) => fn(c, n))) if (typeof v === 'number') n = Math.max(0, v);
  return n;
}

/** Runs a passive hook and the matching Resonance and Field State rules on a Ruin. */
function event(state: BattleState, r: RuinState, name: 'enter' | 'turnStart' | 'guard' | 'turnEnd' | 'reserve', logs: string[]): void {
  if (r.isFainted) return;
  if (name === 'enter') r.enteredTurn = state.turn;
  hook(state, r, name, logs, undefined, (fn, c) => (fn as (c: Ctx) => void)(c));
  const when = { enter: 'enter', turnStart: '', guard: 'guard', turnEnd: 'turn_end', reserve: 'reserve' }[name];
  if (when === 'enter') enterRules(state, r, logs);
  else if (when) fire(state, r, when, logs);
}

export const BOOST_MAX = 10;
export const LINK_COST = 3;
export const BREAK_COST = 1;
const LINK_COOLDOWN = 3;
/** Magic stats run lower than physical ones, so spells scale up to match. */
const MAGIC = 1.2;
const SELF = new Set<Status>([Status.Fortify, Status.Empower, Status.Haste, Status.Ward, Status.Regen, Status.Stasis, Status.Unstoppable, Status.Thorns]);
const INTERRUPT = new Set<Status>([Status.Stun, Status.Sleep, Status.Silence, Status.Root]);
const DOT: Partial<Record<Status, number>> = { [Status.Burn]: 0.08, [Status.Bleed]: 0.06, [Status.Poison]: 0.06 };
const BASIC = 'glass_slam';

/**
 * Creates a RuinState from a species definition.
 */
function createRuinState(speciesKey: string, level: number, isReserve: boolean): RuinState {
  const species = SPECIES[speciesKey];
  if (!species) {
    throw new Error(`Unknown species: ${speciesKey}`);
  }
  const base = getBaseStats(level);
  // Tuned stat calculation for faster battles
  const hp = Math.round((base.hp + species.baseStats.hp) * 1.5);
  const atk = Math.round((base.atk + species.baseStats.atk) * 1.2);
  const def = Math.round((base.def + species.baseStats.def) * 0.8);
  const res = Math.round((base.res + species.baseStats.res) * 0.8);
  const mgk = Math.round((base.mgk + species.baseStats.mgk) * 1.0);
  const agi = Math.round((base.agi + species.baseStats.agi) * 1.0);
  const cha = Math.round((base.cha + species.baseStats.cha) * 1.0);

  const moves: MoveInstance[] = species.moves.map(moveKey => ({
    data: MOVES[moveKey],
    cooldownLeft: 0,
  }));

  return {
    speciesKey,
    level,
    hp,
    maxHp: hp,
    currentStats: { hp, atk, def, res, mgk, agi, cha },
    statuses: [],
    moves,
    isLinkActive: false,
    isReserve,
    isFainted: false,
  };
}

/**
 * Starts a new battle.
 */
export function startBattle(
  playerSpecies: string[],
  opponentSpecies: string[],
  playerLevel: number | number[] = 10,
  opponentLevel: number = 10
): BattleState {
  // One level for the whole team, or one per Ruin in party order.
  const levelOf = (i: number) => (Array.isArray(playerLevel) ? playerLevel[i] ?? playerLevel[0] ?? 5 : playerLevel);
  const playerTeam: RuinState[] = playerSpecies.map((key, i) =>
    createRuinState(key, levelOf(i), i > 0)
  );
  const opponentTeam: RuinState[] = opponentSpecies.map((key, i) =>
    createRuinState(key, opponentLevel, i > 0)
  );

  return {
    playerTeam,
    opponentTeam,
    boost: 0,
    turn: 1,
    windUps: [],
    log: ['Battle started!'],
    winner: null,
    fled: false,
  };
}

function getPlayerActive(state: BattleState): RuinState {
  return state.playerTeam[0];
}

function getOpponentActive(state: BattleState): RuinState {
  return state.opponentTeam[0];
}

const typeOf = (r: RuinState): Type => (SPECIES[r.speciesKey]?.types[0] as Type) || Type.Stone;
const keyOf = (move: MoveData) => Object.keys(MOVES).find((k) => MOVES[k] === move) ?? BASIC;

/** Speed with Haste, Slow, raises, drops, and passives; the faster side acts first, and the player wins ties. */
export function speedOf(r: RuinState, state?: BattleState): number {
  const own = state ? mult(state, r, 'speed', undefined, (fn, c) => fn(c)) : 1;
  return statOf(r, 'agi') * (has(r, Status.Haste) ? 1.5 : 1) * (has(r, Status.Slow) ? 0.5 : 1) * own;
}

/** Spells and channels strike with MGK against RES; dashes and projectiles with ATK against DEF. The basic Attack
 * follows the species' own kind. */
function isMagic(attacker: RuinState, move: MoveData, basic: boolean): boolean {
  if (basic) return SPECIES[attacker.speciesKey]?.attackKind === AttackKind.Magic;
  return move.kind === MoveKind.Spell || move.kind === MoveKind.Channel;
}

/** The type a hit lands as: a move's own type, or the attacker's type for the basic Attack. */
function hitType(attacker: RuinState, move: MoveData, basic: boolean): Type {
  return basic ? typeOf(attacker) : (move.type as Type);
}

/** The matchup multiplier a move would get, for the move menu. */
export function matchup(attacker: RuinState, defender: RuinState, move: MoveData, basic = false): number {
  return getTypeMultiplier(hitType(attacker, move, basic), typeOf(defender));
}

/**
 * Calculates damage for a move.
 */
export function calculateDamage(state: BattleState, attacker: RuinState, defender: RuinState, move: MoveData, basic: boolean): { damage: number; mult: number } {
  if (move.power === 0) return { damage: 0, mult: 1 };
  const magic = isMagic(attacker, move, basic);
  const up = (has(attacker, Status.Empower) ? 1.2 : 1) * (has(attacker, Status.Weaken) ? 0.8 : 1);
  const guard = (has(defender, Status.Fortify) ? 1.2 : 1) * (has(defender, Status.Rot) || has(defender, Status.Expose) ? 0.8 : 1);
  const type = hitType(attacker, move, basic);
  const pierce = Math.min(60, modSum(state, attacker, 'pierce', type, magic ? 'RES' : 'DEF')) / 100;
  const attackStat = (magic ? statOf(attacker, 'mgk') * MAGIC : statOf(attacker, 'atk')) * up;
  const defenseStat = Math.max(1, (magic ? statOf(defender, 'res') : statOf(defender, 'def')) * guard * (1 - pierce));
  const edge = getTypeMultiplier(type, typeOf(defender));
  const sameTypeBonus = type === typeOf(attacker) ? 1.2 : 1.0;
  // Damage grows with the attacker's level at the rate HP does, so a hit takes the same share at every level and a
  // level gap matters late in the game as much as early.
  const levelScale = (attacker.level + 4) / 9;
  let damage = (attackStat * move.power * 15.0) / defenseStat * edge * sameTypeBonus * levelScale;
  if (state.guard && defender === getPlayerActive(state)) damage *= 0.5;
  if (has(defender, Status.Ward)) damage *= 0.8;
  damage *= (1 + modSum(state, attacker, 'power', type) / 100) * (1 - Math.min(60, modSum(state, defender, 'shield')) / 100);
  const passives = mult(state, attacker, 'damageOut', defender, (fn, c) => fn(c, move, basic)) *
    mult(state, defender, 'damageIn', attacker, (fn, c) => fn(c, move, basic));
  // A passive multiplier of 0 cancels the hit, and any other hit does at least 1.
  damage = passives === 0 ? 0 : Math.max(1, Math.round(damage * passives));
  // No single hit takes more than 45% of a party Ruin's max HP, so a fight is never lost before the player acts.
  if (state.playerTeam.includes(defender)) damage = Math.min(damage, Math.ceil(defender.maxHp * 0.45));
  return { damage, mult: edge };
}

/** Knocks a Ruin out. The one that did it, when known, gets its knockout hooks and rules. Returns the message to add. */
export function faint(state: BattleState, r: RuinState, by?: RuinState): string {
  r.hp = 0;
  r.isFainted = true;
  if (state.opponentTeam.includes(r)) state.boost = Math.min(BOOST_MAX, state.boost + 3);
  const extra: string[] = [];
  hook(state, r, 'fainted', extra, by, (fn, c) => fn(c));
  if (by && !by.isFainted) {
    hook(state, by, 'ko', extra, r, (fn, c) => fn(c));
    fire(state, by, 'ko', extra);
  }
  return ` ${nameOf(r)} fainted!${extra.length ? `\n${extra.join('\n')}` : ''}`;
}

/** Statuses that hurt the one who holds them. */
export const harmful = (s: Status | string) => !SELF.has(s as Status);

let statusDepth = 0;
/** Puts a status on a Ruin unless Stasis, Unstoppable, an immunity, or a passive stops it. Returns the message to add. */
export function landStatus(state: BattleState, target: RuinState, status: Status): string {
  if (target.isFainted) return '';
  if (harmful(status) && has(target, Status.Stasis)) return ` ${line('stasis', { name: nameOf(target), status })}`;
  if (INTERRUPT.has(status) && has(target, Status.Unstoppable)) return '';
  if (immuneTo(state, target, status)) return '';
  const extra: string[] = [];
  if (hook(state, target, 'status', extra, undefined, (fn, c) => fn(c, status)).some((v) => v === false)) return extra.length ? ` ${extra.join(' ')}` : '';
  const fresh = applyStatus(null, status);
  const held = target.statuses.find((s) => s.status === status);
  if (held) held.turnsLeft = fresh.turnsLeft;
  else target.statuses.push(fresh);
  // A status that sets off a rule that lands a status stops there, so two passives cannot loop.
  if (statusDepth < 1) {
    statusDepth++;
    try { fire(state, target, 'status', extra); } finally { statusDepth--; }
  }
  return ` It applied ${status}!${extra.length ? ` ${extra.join(' ')}` : ''}`;
}

/** A move's status, built up on a meter: 100 lands at once, 50 every other use, 30 about one use in three. */
function applyMoveStatus(state: BattleState, attacker: RuinState, defender: RuinState, move: MoveData): string {
  if (!move.status || !move.statusChance) return '';
  const meters = (attacker.meters ??= {});
  meters[move.name] = (meters[move.name] ?? 50) + move.statusChance;
  if (meters[move.name] < 100) return '';
  meters[move.name] -= 100;
  const status = move.status as Status;
  return landStatus(state, SELF.has(status) ? attacker : defender, status);
}

/** Reach: a Spread move also hits each of the foe's standing reserves for half, a Whole Team move for three quarters. */
function splash(state: BattleState, attacker: RuinState, defender: RuinState, move: MoveData, extra: string[]): void {
  const share = move.reach === Reach.Spread ? 0.5 : move.reach === Reach.WholeTeam ? 0.75 : 0;
  if (!share || move.power === 0) return;
  const team = state.playerTeam.includes(defender) ? state.playerTeam : state.opponentTeam;
  for (const r of team) {
    if (r === defender || r.isFainted) continue;
    const n = Math.max(1, Math.round(calculateDamage(state, attacker, r, move, false).damage * share));
    r.hp -= n;
    extra.push(line('tick', { name: nameOf(r), n, status: move.name }) + (r.hp <= 0 ? faint(state, r, attacker) : ''));
  }
}

/** One hit, or a wound-up move landing. Returns its message. */
function strike(state: BattleState, side: 'player' | 'opponent', attacker: RuinState, defender: RuinState, move: MoveData, basic: boolean, landing = false): string {
  let text: string;
  const extra: string[] = [];
  if (move.power > 0) {
    const { damage, mult: edge } = calculateDamage(state, attacker, defender, move, basic);
    defender.hp -= damage;
    const called = basic ? BASIC_NAMES[typeOf(attacker)] ?? move.name : move.name;
    text = landing ? line('land', { name: nameOf(attacker), move: move.name, n: damage }) : `${nameOf(attacker)} used ${called}! It dealt ${damage} damage.`;
    if (edge > 1) text += ` ${line('strong')}`;
    else if (edge < 1) text += ` ${line('weak')}`;
    if (has(defender, Status.Thorns)) {
      const back = Math.max(1, Math.round(damage * 0.2));
      attacker.hp -= back;
      text += ` ${line('thorns', { name: nameOf(attacker), n: back })}`;
    }
    if (defender.hp <= 0 && !defender.isFainted) text += faint(state, defender, attacker);
    // Passives and rules about the hit, from both sides, then the reach of a Spread or Whole Team move.
    const info: HitInfo = { damage, move, basic, mult: edge, landing };
    if (!attacker.isFainted) {
      hook(state, attacker, 'hit', extra, defender, (fn, c) => fn(c, info));
      fire(state, attacker, 'hit', extra, { damage, other: defender, moveType: hitType(attacker, move, basic) });
    }
    if (!defender.isFainted) {
      hook(state, defender, 'hurt', extra, attacker, (fn, c) => fn(c, info));
      fire(state, defender, 'hurt', extra, { damage, other: attacker });
    }
    if (!basic) splash(state, attacker, defender, move, extra);
  } else {
    text = `${nameOf(attacker)} used ${move.name}!`;
  }
  if (side === 'player' && !landing) state.boost = Math.min(BOOST_MAX, state.boost + 1);
  text += applyMoveStatus(state, attacker, defender, move);
  if (!landing) actedHooks(state, attacker, defender, move, basic, extra);
  if (defender.hp <= 0 && !defender.isFainted) text += faint(state, defender, attacker);
  if (attacker.hp <= 0 && !attacker.isFainted) text += faint(state, attacker, defender);
  checkLow(state, defender, extra);
  checkLow(state, attacker, extra);
  return [text, ...extra].join('\n');
}

/** The passives about using a move: the user's own, then those of the Ruin it faces. */
function actedHooks(state: BattleState, attacker: RuinState, defender: RuinState, move: MoveData, basic: boolean, logs: string[]): void {
  if (!attacker.isFainted) hook(state, attacker, 'acted', logs, defender, (fn, c) => fn(c, move, basic));
  if (!defender.isFainted && !attacker.isFainted) hook(state, defender, 'foeActed', logs, attacker, (fn, c) => fn(c, move, basic));
}

/** Uses a move: one with a wind-up commits now and lands at the end of a later turn. */
function useMove(state: BattleState, side: 'player' | 'opponent', attacker: RuinState, defender: RuinState, move: MoveData, basic: boolean): string {
  if (!basic && move.windup > 0) {
    state.windUps.push({ side, ruinKey: attacker.speciesKey, moveKey: keyOf(move), turnsLeft: move.windup, fresh: true });
    if (side === 'player') state.boost = Math.min(BOOST_MAX, state.boost + 1);
    const extra: string[] = [];
    actedHooks(state, attacker, defender, move, basic, extra);
    return [line('windup', { name: nameOf(attacker), move: move.name }), ...extra].join('\n');
  }
  return strike(state, side, attacker, defender, move, basic);
}

function breakWindUps(state: BattleState, side: 'player' | 'opponent', r: RuinState, logs: string[]): void {
  for (const w of state.windUps.filter((w) => w.side === side && w.ruinKey === r.speciesKey)) {
    logs.push(line('broken', { name: nameOf(r), move: MOVES[w.moveKey]?.name ?? w.moveKey }));
  }
  state.windUps = state.windUps.filter((w) => !(w.side === side && w.ruinKey === r.speciesKey));
}

function unlink(state: BattleState, r: RuinState): void {
  r.isLinkActive = false;
  r.linkPartnerKey = undefined;
  state.linkPartner = undefined;
}

/** Stun and Sleep take a Ruin's action; each lost action uses up one turn of them. */
function losesTurn(state: BattleState, side: 'player' | 'opponent', r: RuinState, logs: string[]): boolean {
  const held = r.statuses.find((s) => (s.status === Status.Stun || s.status === Status.Sleep) && s.turnsLeft > 0);
  if (!held) return false;
  held.turnsLeft--;
  r.statuses = r.statuses.filter((s) => s.turnsLeft > 0);
  logs.push(line(held.status === Status.Stun ? 'stunned' : 'asleep', { name: nameOf(r) }));
  breakWindUps(state, side, r, logs);
  if (r.isLinkActive) {
    unlink(state, r);
    logs.push(line('unlink'));
  }
  return true;
}

/** The linked reserve strikes after each of the lead's moves for half its ATK, past DEF and RES. */
function followUp(state: BattleState, logs: string[]): void {
  const lead = getPlayerActive(state), foe = getOpponentActive(state);
  const partner = state.linkPartner !== undefined ? state.playerTeam[state.linkPartner] : undefined;
  if (!lead.isLinkActive || !partner || partner.isFainted || lead.isFainted || foe.isFainted) return;
  const dmg = Math.max(1, Math.floor(statOf(partner, 'atk') * 0.5 * (1 + modSum(state, partner, 'follow') / 100)));
  foe.hp -= dmg;
  let text = `${nameOf(partner)} follows up with ${dmg} damage!`;
  if (foe.hp <= 0) text += faint(state, foe);
  logs.push(text.trim());
}

const silenced = (r: RuinState) => has(r, Status.Silence) || has(r, Status.Taunt);
export const rooted = (r: RuinState) => has(r, Status.Root);

/** A move's Boost cost for this Ruin, after thrift rules and passives. */
export function costOf(state: BattleState, r: RuinState, move: MoveData): number {
  let cost = Math.max(0, (move.boostCost ?? 0) - (thrifty(state, r) ? 1 : 0));
  for (const v of hook(state, r, 'cost', [], undefined, (fn, c) => fn(c, move, cost))) if (typeof v === 'number') cost = Math.max(0, Math.round(v));
  const team = state.playerTeam.includes(r) ? state.playerTeam : state.opponentTeam;
  for (const ally of team) {
    if (ally === r || ally.isFainted) continue;
    for (const v of hook(state, ally, 'allyCost', [], undefined, (fn, c) => fn(c, move, cost))) if (typeof v === 'number') cost = Math.max(0, Math.round(v));
  }
  return cost;
}

/** The cooldown a move gets when this Ruin uses it, after passives. */
function cooldownOf(state: BattleState, r: RuinState, move: MoveData): number {
  let turns = move.cooldown;
  for (const v of hook(state, r, 'cooldown', [], undefined, (fn, c) => fn(c, move, turns))) if (typeof v === 'number') turns = Math.max(0, Math.round(v));
  return turns;
}

/** Why a move cannot be chosen now, or null when it can. */
export function moveBlocked(state: BattleState, move: MoveInstance): 'cooldown' | 'boost' | 'silence' | null {
  if (move.cooldownLeft > 0) return 'cooldown';
  if (silenced(getPlayerActive(state))) return 'silence';
  if (costOf(state, getPlayerActive(state), move.data) > state.boost) return 'boost';
  return null;
}

/** The first standing reserve, the partner a Link takes. */
function reserveIndex(state: BattleState): number {
  return state.playerTeam.findIndex((r, i) => i > 0 && !r.isFainted);
}

export function linkReady(state: BattleState): boolean {
  const lead = getPlayerActive(state);
  return !lead.isLinkActive && state.boost >= LINK_COST && !(state.linkCooldown ?? 0) && reserveIndex(state) > 0;
}

export function breakReady(state: BattleState): boolean {
  return getPlayerActive(state).isLinkActive && state.boost >= BREAK_COST;
}

let weighing = false;
/** True while a trainer weighs its moves, so a passive that looks ahead on its chance meter shows the trainer nothing. */
export function weighingMoves(): boolean { return weighing; }

function weigh(state: BattleState, foe: RuinState, target: RuinState): { move: MoveData; inst?: MoveInstance } {
  weighing = true;
  try { return smartPick(state, foe, target); } finally { weighing = false; }
}

/** A trainer's pick: a finishing blow first, then the hardest hit, with buffs and debuffs that are not already on. */
function smartPick(state: BattleState, foe: RuinState, target: RuinState): { move: MoveData; inst?: MoveInstance } {
  const basicMove = MOVES[BASIC];
  const basicDmg = calculateDamage(state, foe, target, basicMove, true).damage;
  let best: { move: MoveData; inst?: MoveInstance } = { move: basicMove };
  let bestScore = basicDmg + (basicDmg >= target.hp ? 1000 : 0);
  for (const inst of foe.moves) {
    const d = inst.data;
    if (!d || inst.cooldownLeft > 0) continue;
    let score: number;
    if (d.power === 0) {
      const status = d.status as Status | undefined;
      if (!status || d.windup) continue;
      const self = SELF.has(status);
      const holder = self ? foe : target;
      if (has(holder, status) || (!self && has(target, Status.Stasis))) continue;
      score = self ? (foe.hp / foe.maxHp > 0.4 ? basicDmg * 1.1 : -1) : basicDmg * 1.05;
    } else {
      const dmg = calculateDamage(state, foe, target, d, false).damage;
      score = d.windup > 0 ? dmg * 0.75 : dmg + (dmg >= target.hp ? 1000 : 0);
    }
    if (score > bestScore) { bestScore = score; best = { move: d, inst }; }
  }
  return best;
}

function foeAct(state: BattleState, logs: string[], together = false): void {
  const foe = getOpponentActive(state), target = getPlayerActive(state);
  if ((foe.isFainted && !together) || target.isFainted) return;
  if (losesTurn(state, 'opponent', foe, logs)) return;
  let move = MOVES[BASIC];
  let basic = true;
  // A status move that does no damage is skipped when it would wind up or its status is already on.
  const ready = foe.moves.filter((m) => m.data && m.cooldownLeft === 0 && (m.data.power > 0 || (!m.data.windup &&
    !(m.data.status && has(SELF.has(m.data.status as Status) ? foe : target, m.data.status as Status)))));
  if (!silenced(foe) && ready.length) {
    // Wild Ruin take their ready moves in turn; trainers weigh them.
    const pick = state.smartFoe ? weigh(state, foe, target) :{ move: ready[state.turn % ready.length].data, inst: ready[state.turn % ready.length] };
    move = pick.move;
    basic = !pick.inst;
    if (pick.inst) pick.inst.cooldownLeft = cooldownOf(state, foe, pick.inst.data);
  }
  logs.push(useMove(state, 'opponent', foe, target, move, basic));
}

function playerAct(state: BattleState, action: string, logs: string[], moveKey?: string, switchIndex?: number, together = false): void {
  const lead = getPlayerActive(state), foe = getOpponentActive(state);
  if (action === 'guard') {
    state.boost = Math.min(BOOST_MAX, state.boost + 1);
    logs.push(`${nameOf(lead)} guarded!`);
    event(state, lead, 'guard', logs);
  } else if (action === 'switch' && switchIndex !== undefined) {
    const next = state.playerTeam[switchIndex];
    if (lead.isLinkActive) unlink(state, lead);
    state.playerTeam[0] = next;
    state.playerTeam[switchIndex] = lead;
    logs.push(`Switched to ${nameOf(next)}!`);
    event(state, next, 'enter', logs);
  } else if (action === 'item') {
    // The scene applies the item; the turn passes, and the opponent still acts.
    logs.push(`${nameOf(lead)} used ${moveKey ?? 'it'}!`);
  } else if (action === 'run') {
    state.fled = true;
    logs.push('Escaped safely!');
  } else if (action === 'catch') {
    const grip = !!state.grip;
    state.grip = false;
    // The lead's passives may move the catch line.
    let bar = catchLine(foe, grip, state.magnet ?? 2);
    for (const v of hook(state, lead, 'catchLine', logs, foe, (fn, c) => fn(c, bar))) if (typeof v === 'number') bar = v;
    if (canCatch(lead, foe, grip, state.magnet ?? 2, bar)) {
      logs.push(`Caught ${nameOf(foe)}!`);
      state.winner = 'player';
    } else {
      logs.push(`Failed to catch ${nameOf(foe)}.`);
    }
  } else if (action === 'attack' || action === 'move') {
    if ((lead.isFainted && !together) || foe.isFainted) return;
    if (losesTurn(state, 'player', lead, logs)) return;
    let move = MOVES[BASIC];
    let basic = true;
    if (action === 'move' && moveKey) {
      const inst = lead.moves.find((m) => m.data && (m.data.name === moveKey || m.data === MOVES[moveKey]));
      if (inst) {
        move = inst.data;
        basic = false;
        state.boost = Math.max(0, state.boost - costOf(state, lead, move));
        inst.cooldownLeft = cooldownOf(state, lead, move);
      }
    }
    logs.push(useMove(state, 'player', lead, foe, move, basic));
    followUp(state, logs);
  }
}

/** End of a turn: wound-up moves land, statuses tick, cooldowns and the Link's wait count down. */
function endTurn(state: BattleState, logs: string[]): void {
  for (const w of [...state.windUps]) {
    if (w.fresh) { w.fresh = false; continue; }
    if (--w.turnsLeft > 0) continue;
    state.windUps = state.windUps.filter((x) => x !== w);
    const mine = w.side === 'player';
    const owner = mine ? getPlayerActive(state) : getOpponentActive(state);
    const target = mine ? getOpponentActive(state) : getPlayerActive(state);
    const move = MOVES[w.moveKey];
    if (!move || target.isFainted) continue;
    if (owner.speciesKey !== w.ruinKey || owner.isFainted) {
      logs.push(line('broken', { name: SPECIES[w.ruinKey]?.name ?? w.ruinKey, move: move.name }));
      continue;
    }
    logs.push(strike(state, w.side, owner, target, move, false, true));
  }
  for (const r of [getPlayerActive(state), getOpponentActive(state)]) {
    if (r.isFainted) continue;
    for (const s of r.statuses) {
      const rate = DOT[s.status];
      if (rate && s.turnsLeft > 0) {
        let n = Math.max(1, Math.round(r.maxHp * rate));
        for (const e of state.playerTeam.includes(r) ? state.opponentTeam : state.playerTeam) {
          if (e.isFainted) continue;
          for (const v of hook(state, e, 'foeTick', [], r, (fn, c) => fn(c, s, n))) if (typeof v === 'number') n = Math.max(1, Math.round(v));
        }
        r.hp -= n;
        logs.push(line('tick', { name: nameOf(r), n, status: s.status }) + (r.hp <= 0 ? faint(state, r) : ''));
        if (r.hp <= 0) break;
      }
      if (s.status === Status.Regen && s.turnsLeft > 0 && r.hp < r.maxHp) {
        const n = Math.min(r.maxHp - r.hp, Math.max(1, Math.round(r.maxHp * 0.08)));
        r.hp += n;
        logs.push(line('regen', { name: nameOf(r), n }));
      }
    }
    // Stun and Sleep count down as they take actions instead.
    for (const s of r.statuses) if (s.status !== Status.Stun && s.status !== Status.Sleep) s.turnsLeft--;
    r.statuses = r.statuses.filter((s) => s.turnsLeft > 0);
    checkLow(state, r, logs);
    event(state, r, 'turnEnd', logs);
  }
  for (const r of [...state.playerTeam.slice(1), ...state.opponentTeam.slice(1)]) event(state, r, 'reserve', logs);
  for (const r of [...state.playerTeam, ...state.opponentTeam]) {
    if (r.hp <= 0 && !r.isFainted) logs.push(faint(state, r).trim());
  }
  for (const r of [...state.playerTeam, ...state.opponentTeam]) {
    for (const m of r.moves) if (m.cooldownLeft > 0) m.cooldownLeft--;
  }
  if (state.linkCooldown) state.linkCooldown--;
  state.guard = false;
}

/** After a turn: the battle ends, the opponent sends its next Ruin, or the player must replace a fallen lead. */
function settle(state: BattleState, logs: string[]): void {
  if (state.opponentTeam.every((r) => r.isFainted)) {
    state.winner = 'player';
    state.log.push('Player won!');
    return;
  }
  if (getOpponentActive(state).isFainted) {
    const next = state.opponentTeam.findIndex((r) => !r.isFainted);
    [state.opponentTeam[0], state.opponentTeam[next]] = [state.opponentTeam[next], state.opponentTeam[0]];
    logs.push(line("rises", { foe: nameOf(state.opponentTeam[0]) }));
    event(state, state.opponentTeam[0], 'enter', logs);
  }
  if (state.playerTeam.every((r) => r.isFainted)) {
    state.winner = 'opponent';
    state.log.push('Opponent won!');
    return;
  }
  const lead = getPlayerActive(state);
  if (lead.isFainted) {
    if (lead.isLinkActive) {
      unlink(state, lead);
      logs.push(line('unlink'));
    }
    state.needSwitch = true;
    logs.push(line('next'));
  }
}

/**
 * Executes a player action and the opponent's reply. Returns the turn's messages, one per line, or an empty string
 * when the action cannot be taken now.
 */
export function executePlayerAction(
  state: BattleState,
  action: 'attack' | 'move' | 'guard' | 'switch' | 'catch' | 'run' | 'link' | 'breakLink' | 'item',
  moveKey?: string,
  switchIndex?: number
): string {
  if (state.winner) return `Battle already ended. Winner: ${state.winner}`;

  const lead = getPlayerActive(state);
  const foe = getOpponentActive(state);
  const logs: string[] = [];
  const canSwitchTo = (i?: number) => i !== undefined && i > 0 && !!state.playerTeam[i] && !state.playerTeam[i].isFainted;

  // A fallen lead is replaced before anything else, and the opponent waits for it.
  if (state.needSwitch) {
    if (action !== 'switch' || !canSwitchTo(switchIndex)) return '';
    state.needSwitch = false;
    playerAct(state, 'switch', logs, undefined, switchIndex);
    state.log.push(...logs);
    return logs.join('\n');
  }

  // Link and Break Link take no turn.
  if (action === 'link' || action === 'breakLink') {
    if (action === 'link') {
      if (!linkReady(state)) return '';
      const partner = reserveIndex(state);
      state.boost -= LINK_COST;
      state.linkCooldown = LINK_COOLDOWN;
      state.linkPartner = partner;
      lead.isLinkActive = true;
      lead.linkPartnerKey = state.playerTeam[partner].speciesKey;
      logs.push(`${nameOf(lead)} linked with ${nameOf(state.playerTeam[partner])}!`);
    } else {
      if (!breakReady(state)) return '';
      state.boost -= BREAK_COST;
      state.linkCooldown = LINK_COOLDOWN;
      unlink(state, lead);
      logs.push(`${nameOf(lead)} broke the link!`);
    }
    state.log.push(...logs);
    return logs.join('\n');
  }

  if (action === 'move') {
    const inst = lead.moves.find((m) => m.data && (m.data.name === moveKey || m.data === MOVES[moveKey ?? '']));
    if (!inst) return '';
    const blocked = moveBlocked(state, inst);
    if (blocked === 'cooldown') return `${nameOf(lead)} cannot use ${inst.data.name} yet.`;
    if (blocked) return '';
  }
  if ((action === 'run' || action === 'switch') && rooted(lead)) return '';
  if (action === 'switch' && !canSwitchTo(switchIndex)) return `Cannot switch to ${state.playerTeam[switchIndex ?? -1] ? nameOf(state.playerTeam[switchIndex!]) : 'unknown'}.`;

  state.guard = action === 'guard';
  event(state, lead, 'turnStart', logs);
  event(state, foe, 'turnStart', logs);
  // The faster acts first; within 5% of each other the turn is simultaneous, so the second still acts if the first
  // knocks it out.
  const priority = ['guard', 'switch', 'item', 'catch', 'run'].includes(action);
  const ls = speedOf(lead, state), fs = speedOf(foe, state);
  const together = !priority && Math.abs(ls - fs) <= 0.05 * Math.max(ls, fs);
  if (priority || ls >= fs) {
    playerAct(state, action, logs, moveKey, switchIndex);
    if (!state.fled && !state.winner) foeAct(state, logs, together);
  } else {
    foeAct(state, logs);
    playerAct(state, action, logs, moveKey, switchIndex, together);
  }
  if (state.fled || state.winner) {
    state.log.push(...logs);
    return logs.join('\n');
  }
  if (!state.opponentTeam.every((r) => r.isFainted)) endTurn(state, logs);
  state.turn++;
  settle(state, logs);
  state.log.push(...logs);
  return logs.join('\n');
}

/** The battle's opening: the Field State's lines (when asked for), then both leads enter. Returns the lines to show
 * first. */
export function openBattle(state: BattleState, fieldLines = true): string[] {
  const logs: string[] = [];
  if (state.field && fieldLines) logs.push(PACK + state.field.opens, PACK + state.field.text);
  event(state, getPlayerActive(state), 'enter', logs);
  event(state, getOpponentActive(state), 'enter', logs);
  for (const r of [...state.playerTeam, ...state.opponentTeam]) if (r.hp <= 0 && !r.isFainted) logs.push(faint(state, r).trim());
  return logs;
}

/** Sends a fighting Ruin back into reserve and brings out its team's next standing Ruin (a Field State's push). */
export function pushBack(state: BattleState, r: RuinState, logs: string[]): boolean {
  const team = state.playerTeam.includes(r) ? state.playerTeam : state.opponentTeam;
  const next = team.findIndex((x, i) => i > 0 && !x.isFainted);
  if (team[0] !== r || next < 0) return false;
  if (r.isLinkActive) { unlink(state, r); logs.push(line('unlink')); }
  [team[0], team[next]] = [team[next], team[0]];
  logs.push(`Switched to ${nameOf(team[0])}!`);
  event(state, team[0], 'enter', logs);
  return true;
}

/** The end of a battle: passives on the player's standing team may change the EXP and Cinder it pays, and copies made
 * during the battle leave the player's team. */
export function battleRewards(state: BattleState, won: boolean, reward: { exp: number; cinder: number }): string[] {
  const logs: string[] = [];
  for (const r of state.playerTeam) {
    if (!r.isFainted) hook(state, r, 'battleEnd', logs, undefined, (fn, c) => fn(c, won, reward));
  }
  state.playerTeam = state.playerTeam.filter((r) => !r.copy);
  reward.exp = Math.max(0, Math.round(reward.exp));
  reward.cinder = Math.max(0, Math.round(reward.cinder));
  return logs;
}

/**
 * Simulates a full battle in which the player only attacks and sends out the next Ruin when the lead falls.
 */
export function simulateBattle(
  playerSpecies: string[],
  opponentSpecies: string[],
  playerLevel: number = 10,
  opponentLevel: number = 10
): { winner: 'player' | 'opponent', turnCount: number, log: string[] } {
  const state = startBattle(playerSpecies, opponentSpecies, playerLevel, opponentLevel);
  let turnCount = 0;
  while (!state.winner && turnCount < 100) {
    if (state.needSwitch) {
      executePlayerAction(state, 'switch', undefined, state.playerTeam.findIndex((r, i) => i > 0 && !r.isFainted));
      continue;
    }
    turnCount++;
    executePlayerAction(state, 'attack');
  }
  return { winner: state.winner || 'player', turnCount, log: state.log };
}
