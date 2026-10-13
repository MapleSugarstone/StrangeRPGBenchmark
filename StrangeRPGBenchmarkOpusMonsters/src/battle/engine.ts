import { statsAt, typeMult, type Stats, type Type } from '../data/types';
import { profileOf } from '../data/profiles';
import type { Action, Battle, Decision, Ev, Fighter, Form, MarkVal, Mon, PastStep, Pending, Queued, Rules, Side, Snap, SnapFighter, SnapSide, SpriteData, StatusId, Summon, Visit } from './model';
import { defMark, DROPS, FIELDS, GROUNDS, MARKS, MOVES, NOTIONS, PASSIVES, SUMMONS, type Ctx, type DmgInfo, type HitOpts, type Hooks, type MoveDef, type Ratio } from './registry';

/** The Splash a spread move has when it names no share of its own. */
export const SPREAD_SHARE = 0.35;
/** What Wet Sand adds to the Splash of its holder's moves. */
export const WET_SAND = 0.15;
/** The share of a one-foe hit that a wide reach carries on to each foe reserve. */
export const WIDE_SHARE = 0.25;
/** A tight reach puts an every-foe hit on the out foe at this multiplier. */
export const TIGHT_MUL = 1.4;
/** Two turns this close on the timeline, as a share of the faster out whorl's plain turn, make a joint round. */
export const SYNC_SHARE = 0.5;
/** Slow and Haste move a turn by this share of a plain turn. */
export const SPEED_SHIFT = 0.3;
/** A dashing whorl takes this much of each hit until its next turn. */
export const DASH_TAKE = 0.9;
/** What a guard lets through: most hits, projectiles, and dashes. */
export const GUARD_TAKE = 0.5, GUARD_PROJECTILE = 0.25;
/** Range: the kind of hit the distance favors deals RANGE_UP, and the other kind RANGE_DOWN. */
export const RANGE_UP = 1.2, RANGE_DOWN = 0.8;
/** A projectile thrown with the wind, toward the side it blows to, deals WIND_WITH, and one thrown against it WIND_AGAINST. */
export const WIND_WITH = 1.2, WIND_AGAINST = 0.8;
/** A Deaf whorl takes this much from a sound move. */
export const SOUND_DEAF = 0.5;
/** The wait after a switch, against 100 for an attack. A switch goes first in a round, so a short wait made it a haste too. */
export let SWITCH_WEIGHT = 65;
/** For the tools: tries another switch weight. */
export function setSwitchWeight(w: number): void { SWITCH_WEIGHT = w; }
/** How much CHA moves the wait: each 10% of CHA over the plain curve takes SWITCH_CHA times 10% off it. */
export const SWITCH_CHA = 0.6;

/**
 * The wait after a switch for the whorl that comes in. SWITCH_WEIGHT is for a whorl with the plain curve's CHA. More CHA
 * makes it shorter and less makes it longer, so a whorl built on CHA comes in quickly.
 */
export function switchWeight(b: Battle, incoming: Fighter): number {
  const plain = statsAt(fightLevel(b.rules, incoming.mon)).cha;
  const r = stat(b, incoming, 'cha') / Math.max(1, plain);
  return Math.round(Math.max(30, Math.min(100, SWITCH_WEIGHT * (1 - SWITCH_CHA * (r - 1)))));
}
export const NERVE_MAX = 10;
/** Nacre: a layer adds the same flat points to any stat, TAN_POINTS at the top level and scaled down the shared curve below it. */
export const TAN_POINTS = 1;
export const TAN_PER_STAT = 6;
export const TAN_TOTAL = 12;

/** What one layer adds at a level: `stat` for every stat but HP, and `hp` on the curve's larger HP scale. */
export function tanPerLayer(level: number): { stat: number; hp: number } {
  const c = statsAt(level);
  return { stat: TAN_POINTS * c.atk / 100, hp: TAN_POINTS * c.hp / 100 };
}

/** The flat points `layers` of nacre add to one stat at a level. */
export function tanBonus(level: number, key: string, layers: number): number {
  const p = tanPerLayer(level);
  return Math.round((key === 'hp' ? p.hp : p.stat) * Math.min(TAN_PER_STAT, layers || 0));
}

/** A layer's worth for a reader: whole numbers stay whole, the rest keep one decimal. */
export const tanText = (v: number): string => String(Math.round(v * 10) / 10);
/** A conjoined whorl's multiplier on every stat: the drawback that keeps conjoining from being free. */
export const FIT_STAT = 0.95;

const CC: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow'];
const INTERRUPTS: StatusId[] = ['stun', 'silence', 'sleep', 'taunt'];
const VOLATILE: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'haste', 'expose', 'weaken', 'empower', 'fortify', 'guard', 'unstop', 'thorns', 'invuln', 'monument', 'stasis', 'revealed', 'dashing'];
/** Statuses that count down by the turns they move rather than at the end of each turn. */
const PACE: StatusId[] = ['slow', 'haste'];
const NEGATIVE: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'burn', 'bleed', 'poison', 'rot', 'expose', 'weaken', 'doom'];
const STACKING: StatusId[] = ['bleed', 'poison'];

export const STATUS_NAME: Record<string, string> = {
  stun: 'stunned', silence: 'silenced', sleep: 'asleep', root: 'rooted', taunt: 'taunted', slow: 'slowed', haste: 'hasted',
  burn: 'burning', bleed: 'bleeding', poison: 'poisoned', rot: 'rotting', expose: 'exposed', weaken: 'weakened',
  fortify: 'fortified', empower: 'empowered', stasis: 'in stasis', unstop: 'unstoppable', ward: 'warded',
  thorns: 'thorned', regen: 'regenerating', invuln: 'untouchable', doom: 'doomed', monument: 'monumental', guard: 'guarding',
  hidden: 'hidden', revealed: 'revealed', dashing: 'dashing',
};

/** Hidden has ended. Revealed lasts through the whorl's next turn, so hiding can't chain into hiding or Untouchable. */
function reveal(b: Battle, f: Fighter): void {
  delete f.s.hidden;
  f.s.revealed = { n: 1, src: f.turns };
  emit(b, { e: 'status', ...seat(f), id: 'revealed' });
}

/** Untouchable has ended. Seen lasts through the whorl's next turn, so Untouchable can't chain into Untouchable or hiding. */
defMark({ id: 'seen', name: 'seen', color: '#d8c8a0', volatile: true, text: 'It was Untouchable. It cannot become Untouchable or Hidden until after its next turn.' });

// ---------------------------------------------------------------- setup

// ---------------------------------------------------------------- identity: forms, borrowed bodies, disguises

/** Above 0 while a move plays again at reduced power (Habit, First Showing, Wading). Such a replay never changes a body. */
let replaying = 0;
/** The whorl visiting from the future while it casts. It is on no slot of the board, so nothing can reach it. */
let visiting: Fighter | null = null;

export const typesOf = (f: Fighter): Type[] => f.retype?.types || f.form?.types || f.mon.types;
export const passivesOf = (f: Fighter): string[] => f.form?.passives || f.mon.passives;
export const nameOf = (f: Fighter): string => f.form?.name || f.mon.name;
export const basicOf = (f: Fighter): 'P' | 'M' => f.form?.basic || f.mon.basic;
export const spriteOf = (f: Fighter): SpriteData => f.form?.sprite || f.mon.sprite;
/** What the other side sees and hits: the disguise when there is one. */
export const seenTypes = (f: Fighter): Type[] => f.retype?.types || f.disguise?.types || typesOf(f);
export const seenName = (f: Fighter): string => f.disguise?.name || nameOf(f);
export const seenSprite = (f: Fighter): SpriteData => f.disguise?.sprite || spriteOf(f);
export const seenPassives = (f: Fighter): string[] => f.disguise?.passives || passivesOf(f);

/**
 * Lays a form over the fighter for the rest of the battle, or until clearForm. Passives in the form replace its own.
 * `moves`, when given, fills the move slots in order, and each slot keeps its cooldown.
 */
export function setForm(b: Battle, f: Fighter, form: Form, moves?: string[]): void {
  // A replay at reduced power quiets the mark that would time the form, so the form would never end.
  if (replaying) return;
  f.form = form;
  if (moves) moves.forEach((id, i) => setMove(b, f, i, id));
}

/** Returns the fighter to its own name, look, types, passives, and moves. */
export function clearForm(b: Battle, f: Fighter): void {
  f.form = null;
  resetMoves(f);
  void b;
}

/**
 * Trades the bodies of two whorls on opposite sides for `turns` of a's own turns: each takes the other's look, types,
 * passives, basic, moves, and the cooldowns that go with them. Neither may wear a form or be in a trade already.
 */
export function swapBodies(b: Battle, a: Fighter, z: Fighter, turns: number): boolean {
  if (replaying || turns <= 0 || a.side === z.side || a.ko || z.ko || a.gone || z.gone || a.form || z.form || a.swap || z.swap || a.tmp?.length || z.tmp?.length) return false;
  const shape = (f: Fighter) => ({ form: { tag: 'swap', sprite: spriteOf(f), types: typesOf(f).slice(), passives: passivesOf(f).slice(), basic: basicOf(f) } as Form, moves: f.moves.slice(), cd: f.cd.slice() });
  const sa = shape(a), sz = shape(z);
  setForm(b, a, sz.form, sz.moves);
  setForm(b, z, sa.form, sa.moves);
  a.cd = sz.cd; z.cd = sa.cd;
  a.swap = { with: z.side * 8 + z.idx + 1, turns, at: b.turnNo, spent: a.spent?.length || 0 };
  z.swap = { with: a.side * 8 + a.idx + 1, turns: -1, at: b.turnNo, spent: z.spent?.length || 0 };
  msg(b, `${label(b, a)} and ${label(b, z)} trade bodies.`);
  return true;
}

/** Ends f's body trade: f and its partner each take back their own body and the cooldowns of their own moves. */
export function endSwap(b: Battle, f: Fighter): void {
  if (!f.swap) return;
  const code = f.swap.with, o = b.s[Math.floor((code - 1) / 8) as 0 | 1]?.f[(code - 1) % 8];
  // A move spent for good while wearing the other's body was that body's, so it stays spent there.
  const fresh = (x: Fighter) => (x.spent || []).slice(x.swap?.spent ?? x.spent?.length ?? 0);
  if (o) {
    const ff = fresh(f), fo = fresh(o);
    f.spent = [...new Set([...(f.spent || []).slice(0, (f.spent?.length || 0) - ff.length), ...fo])];
    o.spent = [...new Set([...(o.spent || []).slice(0, (o.spent?.length || 0) - fo.length), ...ff])];
  }
  f.swap = null;
  if (o) o.swap = null;
  for (const w of o ? [f, o] : [f]) if (w.form?.tag === 'swap') clearForm(b, w);
  if (o) { const cf = f.cd; f.cd = o.cd; o.cd = cf; }
  msg(b, o ? `${label(b, f)} and ${label(b, o)} take their own bodies back.` : `${label(b, f)} takes its own body back.`);
}

/** The turn count at which the swell's wave breaks. */
export const SWELL_BREAK = 9;

/** Raises the swell by n turns, starting it if it has not started. At SWELL_BREAK the wave breaks and the count starts again. */
export function raiseSwell(b: Battle, n: number): void {
  if (!b.swell) { b.swell = { n: 0, at: b.turnNo }; msg(b, 'The swell starts to build.'); }
  b.swell.n += n;
  if (b.swell.n < SWELL_BREAK) return;
  b.swell.n = 0;
  msg(b, 'The ninth wave breaks.');
  for (const sd of [0, 1] as const) {
    const o = b.s[sd].f[b.s[sd].out];
    if (!o || o.ko || o.gone) continue;
    if (typesOf(o).includes('TIDE')) { applyStatus(b, null, o, 'haste', 1); continue; }
    dealDamage(b, null, o, o.maxHp * 0.12, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
    if (!o.ko) applyStatus(b, null, o, 'slow', 1);
  }
}

/** Sets the wind blowing toward side `to` for some rounds, in place of any wind already blowing. */
export function setWind(b: Battle, to: 0 | 1, turns: number): void {
  if (turns <= 0) return;
  b.wind = { to, turns, at: b.turnNo };
  msg(b, `The wind blows toward ${b.s[to].name}.`);
}

/** The out whorl of `side` while it covers at least one of its reserves, or null. */
export function covering(b: Battle, side: 0 | 1): Fighter | null {
  const o = b.s[side].f[b.s[side].out];
  if (!o || o.ko || o.gone) return null;
  return reserves(b.s[side]).some(r => hooks(o).some(h => h.covers?.(b, o, r))) ? o : null;
}

/** Lays a mirage over f for `turns` of its own turns: the other side sees `share` of its max HP more than it has, up to full. */
export function addMirage(b: Battle, f: Fighter, share: number, turns: number): void {
  if (f.ko || f.gone || share <= 0 || turns <= 0) return;
  const hp = Math.min(Math.round(f.maxHp * 0.6), (f.mirage?.hp || 0) + Math.round(f.maxHp * share));
  f.mirage = { hp, turns: Math.max(turns, f.mirage?.turns || 0), at: b.turnNo };
  msg(b, `${label(b, f)} shimmers.`);
}

/** The HP the other side sees on f: its own, plus any mirage, never above its max HP. */
export const shownHp = (f: Fighter): number => Math.min(f.maxHp, f.hp + (f.mirage?.hp || 0));

/** Takes the look, types, passives, and moves of another fighter, usually one just KO'd. A move used once for good comes as its next. */
export function takeOver(b: Battle, f: Fighter, from: Fighter, tag = 'taken'): void {
  const moves = from.moves.map(id => (MOVES[id]?.once && MOVES[MOVES[id].next || ''] ? MOVES[id].next! : id));
  setForm(b, f, { tag, name: nameOf(from), sprite: spriteOf(from), types: typesOf(from).slice(), passives: passivesOf(from).slice(), basic: basicOf(from) }, moves);
}

/** Shows the other side `as` instead of `f` (an ally, usually), until called again with null. Hits on `f` use the disguise's types. */
export function disguise(b: Battle, f: Fighter, as: Fighter | null): void {
  if (replaying && as) return;
  f.disguise = as ? { name: nameOf(as), sprite: spriteOf(as), types: typesOf(as).slice(), passives: passivesOf(as).slice(), moves: as.moves.slice(), agi: stat(b, as, 'agi') } : null;
}

// ---------------------------------------------------------------- summons and items

/** At most this many summons per side. A new one past the limit pushes out the oldest. */
export const SUMMON_CAP = 4;
/** Summons have no armor of their own: a hit deals this share of its raw power to them. */
export const SUMMON_TAKE = 0.5;

/**
 * Puts a summoned unit on f's side. `hp` is a share of f's max HP (0.2 by default), `turns` its actions before it leaves
 * (-1 stays until destroyed), and `v` a free number for the kit.
 */
export function summon(b: Battle, f: Fighter, id: string, opts: { hp?: number; turns?: number; v?: number } = {}): Summon | null {
  const def = SUMMONS[id];
  if (!def) return null;
  const s = b.s[f.side];
  while (s.sum.length >= SUMMON_CAP) dismiss(b, s.sum[0]);
  const maxHp = Math.max(1, Math.round(f.maxHp * (opts.hp ?? 0.2)));
  const u: Summon = { uid: b.pid++, def: id, side: f.side, by: f.idx, hp: maxHp, maxHp, turns: opts.turns ?? -1, v: opts.v ?? 0 };
  s.sum.push(u);
  if (def.act) b.pend.push({ id: b.pid++, at: b.t + (def.every || 100), kind: 'summon', side: f.side, idx: -1, move: '', data: { uid: u.uid } });
  msg(b, `${label(b, f)} summons ${def.name}.`);
  return u;
}

export function summonsOf(b: Battle, side: 0 | 1, id?: string): Summon[] {
  return b.s[side].sum.filter(u => !id || u.def === id);
}

/** Removes a summon and runs its `gone`. */
export function dismiss(b: Battle, u: Summon): void {
  const s = b.s[u.side];
  if (!s.sum.includes(u)) return;
  s.sum = s.sum.filter(x => x !== u);
  b.pend = b.pend.filter(p => !(p.kind === 'summon' && p.data?.uid === u.uid));
  SUMMONS[u.def]?.gone?.(b, u, s.f[u.by]);
}

/** Pulls summon u over to the side of `to`, which owns it from now on with the HP and turns it has left. Twins and linked summons stay. */
export function stealSummon(b: Battle, u: Summon, to: Fighter): boolean {
  const from = b.s[u.side], s = b.s[to.side];
  if (u.side === to.side || u.moves || u.link !== undefined || !from.sum.includes(u) || to.ko || to.gone) return false;
  while (s.sum.length >= SUMMON_CAP) dismiss(b, s.sum[0]);
  from.sum = from.sum.filter(x => x !== u);
  u.side = to.side;
  u.by = to.idx;
  s.sum.push(u);
  for (const p of b.pend) if (p.kind === 'summon' && p.data?.uid === u.uid) p.side = to.side;
  msg(b, `${label(b, to)} pulls ${SUMMONS[u.def]?.name || 'a summon'} over to its side.`);
  return true;
}

/** Damages a summon, which leaves at 0 HP. Returns the damage dealt. */
export function hitSummon(b: Battle, u: Summon, amt: number): number {
  const d = Math.max(0, Math.min(u.hp, Math.round(amt)));
  if (d <= 0) return 0;
  u.hp -= d;
  if (u.hp <= 0) {
    const owner = b.s[u.side].f[u.by];
    msg(b, `${SUMMONS[u.def]?.name || 'The summon'} falls.`);
    SUMMONS[u.def]?.fall?.(b, u, owner);
    if (u.link && !owner.ko && !owner.gone) dealDamage(b, null, owner, owner.maxHp * u.link, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
    dismiss(b, u);
  }
  return d;
}

/**
 * A twin: a summon that is a second body of `f`. On its own clock it uses the first ready move from `moves` (the owner's
 * small moves by default) as the owner, with the owner's stats, so damage and passives credit the owner. It has its own HP
 * and cooldowns, the other side can aim single-target hits at it, and `link` is the share of the owner's max HP lost when it falls.
 */
export function summonTwin(b: Battle, f: Fighter, id: string, opts: { hp?: number; turns?: number; moves?: string[]; link?: number } = {}): Summon | null {
  const u = summon(b, f, id, { hp: opts.hp ?? 0.5, turns: opts.turns ?? -1 });
  if (!u) return null;
  // A twin cannot switch, pick a reserve ally, or drag a foe in, so those moves stay with the owner.
  u.moves = (opts.moves || f.moves).filter(m => MOVES[m] && !MOVES[m].nerve && !MOVES[m].wu && !MOVES[m].tag && MOVES[m].reach !== 'reserveAlly' && MOVES[m].reach !== 'dragin' && MOVES[m].reach !== 'bench');
  u.cd = u.moves.map(() => 0);
  u.link = opts.link || 0;
  if (!SUMMONS[id].act) b.pend.push({ id: b.pid++, at: b.t + (SUMMONS[id].every || 100), kind: 'summon', side: f.side, idx: -1, move: '', data: { uid: u.uid } });
  return u;
}

function twinAct(b: Battle, u: Summon, owner: Fighter): void {
  if (owner.ko || owner.gone || !u.moves || !u.cd) return;
  u.cd = u.cd.map(c => Math.max(0, c - 1));
  const k = u.cd.findIndex(c => c === 0);
  if (k < 0) return;
  const m = MOVES[u.moves[k]];
  u.cd[k] = m.cd + 1;
  msg(b, `${SUMMONS[u.def]?.name || 'The twin'} uses ${m.name}.`);
  emit(b, { e: 'use', ...seat(owner), move: m.id, name: m.name });
  // A twin's ally moves help its owner.
  m.run(makeCtx(b, owner, m, m.reach === 'ally' ? { target: owner.idx } : {}, false, 1));
}

/** Whether the other side may aim single-target hits at this summon. */
export const aimable = (u: Summon): boolean => !!u.moves || !!SUMMONS[u.def]?.aimable;

function runSummon(b: Battle, p: Pending): void {
  const s = b.s[p.side];
  const u = s.sum.find(x => x.uid === p.data?.uid);
  if (!u) return;
  const def = SUMMONS[u.def];
  if (u.moves && standing(s).length) twinAct(b, u, s.f[u.by]);
  else if (def?.act && standing(s).length) def.act(b, u, s.f[u.by]);
  if (!s.sum.includes(u)) return;
  if (u.turns > 0 && --u.turns === 0) { dismiss(b, u); return; }
  b.pend.push({ id: b.pid++, at: b.t + (def?.every || 100), kind: 'summon', side: p.side, idx: -1, move: '', data: { uid: u.uid } });
}

/** Hands a fighter an item for the rest of this battle: a notion id whose hooks and stat shares it carries on top of its own notion. */
export function giveItem(b: Battle, f: Fighter, id: string): void {
  if (!NOTIONS[id]) return;
  f.items = [...(f.items || []), id];
  msg(b, `${label(b, f)} gets ${NOTIONS[id].name}.`);
}

export function takeItem(b: Battle, f: Fighter, id: string): void {
  const i = (f.items || []).indexOf(id);
  if (i >= 0) f.items = f.items!.filter((_, k) => k !== i);
  void b;
}

// ---------------------------------------------------------------- banish, forced actions, stealth

/**
 * Takes a fighter off the field for `turns` of its side's turns with no KO. If it was out, its side sends a replacement.
 * It comes back to reserve, or out when its side has nobody else standing. As the last whorl standing it is held in stasis instead.
 */
export function banish(b: Battle, t: Fighter, turns: number, by: Fighter | null): void {
  if (t.ko || t.gone || turns <= 0) return;
  if (standing(b.s[t.side]).length <= 1) { applyStatus(b, by, t, 'stasis', turns); return; }
  endChannel(b, t);
  t.gone = true;
  t.k.banished = turns;
  t.k.banishBy = by ? by.side * 8 + by.idx + 1 : 0;
  b.pend = b.pend.filter(p => !(p.side === t.side && p.idx === t.idx));
  b.queue = b.queue.filter(q => !(q.side === t.side && q.who === t.idx));
  msg(b, `${label(b, t)} is taken off the field.`);
}

/** Counts down banished fighters at the start of their side's turn and brings back any whose time is up. */
function tickBanished(b: Battle, side: 0 | 1): void {
  const s = b.s[side];
  for (const t of s.f) {
    if (t.gone && t.latch) drinkLatch(b, t);
    if (!t.gone || !t.k.banished || --t.k.banished > 0) continue;
    t.gone = false;
    t.latch = undefined;
    delete t.k.banished;
    const code = t.k.banishBy || 0;
    delete t.k.banishBy;
    msg(b, `${label(b, t)} comes back.`);
    const o = s.f[s.out];
    if (o.ko || o.gone) { s.out = t.idx; comeOut(b, t); }
    const by = code ? b.s[Math.floor((code - 1) / 8) as 0 | 1].f[(code - 1) % 8] : null;
    if (by) for (const h of hooks(by)) h.banishEnd?.(b, by, t);
  }
}

/** Each fallen whorl glowing on `side` heals its side's out whorl as the side's turn starts, and fades when its turns run out. */
function tickGlow(b: Battle, side: 0 | 1): void {
  const s = b.s[side];
  for (const g of s.f) {
    if (!g.ko || !g.glow) continue;
    const o = s.f[s.out];
    if (o && !o.ko && !o.gone && g.glow.heal > 0) heal(b, null, o, o.maxHp * g.glow.heal);
    if (--g.glow.turns <= 0) { g.glow = null; msg(b, `The glow of ${label(b, g)} fades.`); }
  }
}

/**
 * Puts f, a reserve, in cold storage for `turns` of its side's turns. Nothing from the other side reaches it, it cannot come
 * out unless nobody else can, its cooldowns and marks wait, and it heals `heal` of its max HP at each of its side's turns.
 */
export function storeAway(b: Battle, f: Fighter, turns: number, heal: number): boolean {
  if (f.ko || f.gone || isOut(b, f) || turns <= 0) return false;
  f.stored = { turns: Math.max(turns, f.stored?.turns || 0), heal: Math.max(heal, f.stored?.heal || 0) };
  msg(b, `${label(b, f)} goes into cold storage.`);
  return true;
}

/** Each stored reserve on `side` heals, and comes out of storage when its turns run out. */
function tickStored(b: Battle, side: 0 | 1): void {
  for (const g of b.s[side].f) {
    if (!g.stored || g.ko || g.gone) continue;
    if (g.stored.heal > 0) heal(b, null, g, g.maxHp * g.stored.heal);
    // A heal hook can bring it out or knock it out, and either clears its storage.
    if (!g.stored || g.ko || g.gone) continue;
    if (--g.stored.turns <= 0) { g.stored = null; msg(b, `${label(b, g)} comes out of cold storage.`); }
  }
}

/** Fractures t for `turns` of its own turns: heals cannot take it above the share of max HP it has now. A lower line already there stays. */
export function fracture(b: Battle, src: Fighter | null, t: Fighter, turns: number): boolean {
  if (t.ko || t.gone || turns <= 0 || t.s.stasis || fogged(b, src, t)) return false;
  const cap = Math.min(t.hp / t.maxHp, t.fracture?.cap ?? 1);
  t.fracture = { cap, turns: Math.max(turns, t.fracture?.turns || 0), at: b.turnNo };
  msg(b, `${label(b, t)} cracks: no heal takes it above ${Math.round(t.maxHp * cap)} HP.`);
  return true;
}

/** Shuts `side` in for some rounds: its switch goes after the other side's action in a joint round. A longer shut already there stays. */
export function shutIn(b: Battle, side: 0 | 1, turns: number): void {
  if (turns <= 0) return;
  const cur = b.s[side].shut;
  b.s[side].shut = { turns: Math.max(turns, cur?.turns || 0), at: b.turnNo };
  msg(b, `The door shuts on ${b.s[side].name}: its switches go last.`);
}

/** A latched whorl drinks this share of its host's max HP at each turn its own side takes. */
export const LATCH_DRINK = 0.08;

/**
 * Takes f off its own side to ride `host`, a whorl of the other side, for up to `turns` of its side's turns. It drinks once now.
 * Its side sends a replacement if it was out. It cannot latch as its side's last whorl standing.
 */
export function latchOn(b: Battle, f: Fighter, host: Fighter, turns: number): boolean {
  if (f.ko || f.gone || host.ko || host.gone || host.side === f.side || turns <= 0 || standing(b.s[f.side]).length <= 1) return false;
  endChannel(b, f);
  f.gone = true;
  f.latch = host.side * 8 + host.idx + 1;
  f.k.banished = turns;
  f.k.banishBy = f.side * 8 + f.idx + 1;
  b.pend = b.pend.filter(p => !(p.side === f.side && p.idx === f.idx));
  b.queue = b.queue.filter(q => !(q.side === f.side && q.who === f.idx));
  msg(b, `${label(b, f)} latches onto ${label(b, host)}.`);
  drinkLatch(b, f);
  return true;
}

/** The foe a latched whorl rides, or null. */
export function latchHost(b: Battle, f: Fighter): Fighter | null {
  const code = f.gone ? f.latch || 0 : 0;
  const h = code ? b.s[Math.floor((code - 1) / 8) as 0 | 1]?.f[(code - 1) % 8] : null;
  return h && !h.ko && !h.gone ? h : null;
}

/** The latched whorl drinks from its host, and lets go when it is full, when its host guards, or when its host is gone. */
function drinkLatch(b: Battle, t: Fighter): void {
  const host = latchHost(b, t);
  if (host && !host.s.guard && t.hp < t.maxHp) {
    const got = dealDamage(b, t, host, host.maxHp * LATCH_DRINK, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: !isOut(b, host) }, null);
    t.hp = Math.min(t.maxHp, t.hp + got);
    if (got > 0) msg(b, `${label(b, t)} drinks from ${label(b, host)}.`);
    if (t.hp < t.maxHp && !host.ko) return;
  }
  msg(b, host && !host.ko ? `${label(b, t)} lets go of ${label(b, host)}.` : `${label(b, t)} drops off.`);
  t.k.banished = 1;
}

/** Fear and charm: the fighter's next turn is this action instead of a choice. A switch goes to the next in line. */
export function forceAction(b: Battle, t: Fighter, k: 'switch' | 'guard' | 'attack' | 'skip' | 'move', i?: number, by: Fighter | null = null): void {
  if (t.ko || t.gone || immuneTo(b, t, 'stun')) return;
  // A forced skip or switch costs a turn, so it follows the steady and stalwart rules when a foe forces it. `by` names the
  // source when it may act on the target's own turn, as a trap does.
  const lost = (k === 'skip' || k === 'switch') && (by ? by.side !== t.side : b.acting !== t.side);
  if (lost && turnLossBlocked(b, t, k)) return;
  t.forced = lost ? { k, i, foe: true } : { k, i };
  if (lost) mark(b, null, t, steadyId(k));
}

/** A forced switch tags the whorl it moves and the whorl that comes out in its place, before the newcomer meets any trap. */
function forcedIn(b: Battle, moved: Fighter, comes: Fighter): void {
  mark(b, null, moved, steadyId('switch'));
  cameInForced(b, comes);
}

/** Tags a whorl that a foe's effect brought out as forced in, so no forced switch can move it until it acts. */
export function cameInForced(b: Battle, comes: Fighter): void {
  mark(b, null, comes, steadyId('switch'));
}

/** The action a forced fighter takes, or null for a skipped turn. A forced move it cannot use becomes an attack. */
function forcedAction(b: Battle, side: 0 | 1, k: 'switch' | 'guard' | 'attack' | 'skip' | 'move', i?: number): Action | null {
  const s = b.s[side];
  if (k === 'switch') { const to = nextInLine(s); if (to >= 0 && to !== s.out) return { k: 'switch', to }; return { k: 'guard' }; }
  if (k === 'guard') return { k: 'guard' };
  if (k === 'attack') return { k: 'attack' };
  if (k === 'move') return legal(b, side).find(a => a.k === 'move' && a.i === i && !a.aim) || { k: 'attack' };
  return null;
}

/** Whether a mark on f cures it: its statuses and other marks stop counting down. */
export function cured(f: Fighter): boolean {
  for (const id in f.m) if (MARKS[id]?.preserves) return true;
  return false;
}

/** Whether w is deaf: a deaf mark on it, or the out whorl across with a hook that deafens it. */
export function deaf(b: Battle, w: Fighter): boolean {
  for (const id in w.m) if (MARKS[id]?.deaf) return true;
  const x = b.s[1 - w.side].f[b.s[1 - w.side].out];
  return !!x && !x.ko && !x.gone && hooks(x).some(h => h.deafens?.(b, x, w));
}

/** Whether f is silent now: no other whorl hears what it does. */
export function silent(b: Battle, f: Fighter): boolean {
  return hooks(f).some(h => h.silent?.(b, f));
}

/** Whether w's hooks answer something src did. A deaf whorl hears only itself, and nobody else hears a silent one. */
function hears(b: Battle, w: Fighter, src: Fighter | null): boolean {
  return src === w || (!deaf(b, w) && !(src && silent(b, src)));
}

/** The foe u's own hooks keep its one-target moves on, out or in reserve, or null. */
export function aimOf(b: Battle, u: Fighter): Fighter | null {
  for (const h of hooks(u)) {
    const t = h.aims?.(b, u);
    if (t && !t.ko && !t.gone && t.side !== u.side) return t;
  }
  return null;
}

/** The first reserve whose hook bears the weight takes its share of a hit on its out whorl, down to 1 HP of its own. Returns what is left. */
function bearWeight(b: Battle, tgt: Fighter, amt: number, info: DmgInfo): number {
  if (info.dot || info.reserve || !isOut(b, tgt) || b.s[tgt.side].cut) return amt;
  for (const r of reserves(b.s[tgt.side])) {
    if (r.ko || r.gone || r.hp <= 1) continue;
    let share = 0;
    for (const h of hooks(r)) share = Math.max(share, h.bears?.(b, r, tgt, info) || 0);
    const moved = Math.min(r.hp - 1, Math.round(amt * Math.min(0.5, share)));
    if (moved <= 0) continue;
    r.hp -= moved;
    emit(b, { e: 'dmg', ...seat(r), amt: moved, kind: 'T', eff: 1, shield: 0 });
    msg(b, `${label(b, r)} bears ${moved} of it.`);
    return amt - moved;
  }
  return amt;
}

/** Takes t's next attack or move in for `ticks`: that turn is spent, and the action comes back out later, free. */
export function takeIn(b: Battle, t: Fighter, ticks: number): void {
  if (t.ko || t.gone || ticks <= 0) return;
  t.takeIn = ticks;
}

/** Holds an attack (m null) or a paid move that was taken in, and ends the turn it would have used. */
function holdAction(b: Battle, side: 0 | 1, f: Fighter, a: Action, m: MoveDef | null): void {
  const ticks = f.takeIn || 100;
  f.takeIn = null;
  const at = a as { target?: number; opt?: number };
  b.pend.push({ id: b.pid++, at: b.t + ticks, kind: 'held', side, idx: f.idx, move: m?.id || '', data: { attack: m ? 0 : 1, target: at.target ?? -1, opt: at.opt ?? -1 } });
  msg(b, `${label(b, f)}'s ${m ? m.name : 'Attack'} goes in, and does not come out yet.`);
  endTurn(b, side, f, m?.wt || 100, 0, 'held');
}

/** Pushes a waiting wind-up or other pending effect `ticks` later on the timeline. */
export function delayPending(b: Battle, p: Pending, ticks: number): void {
  if (ticks <= 0 || !b.pend.includes(p)) return;
  p.at += ticks;
}

/** Lays fog over `side`'s bench for `turns` rounds. A longer fog already there stays. */
export function fogBench(b: Battle, side: 0 | 1, turns: number): void {
  if (turns <= 0) return;
  const s = b.s[side];
  s.fog = { turns: Math.max(turns, s.fog?.turns || 0), at: b.turnNo };
  msg(b, `Fog rolls over ${s.name}'s bench.`);
}

/** Whether fog keeps something from the other side off t: t sits in reserve under its side's fog. */
export function fogged(b: Battle, src: Fighter | null, t: Fighter): boolean {
  return !!src && src.side !== t.side && (!!b.s[t.side].fog || !!t.stored) && !isOut(b, t);
}

/** The slot that comes out when f picks move slot i: a hook may spin it to another slot. */
export function spunSlot(b: Battle, f: Fighter, i: number): number {
  for (const h of hooks(f)) {
    const j = h.spins?.(b, f, i);
    const m = j !== undefined && j !== i && j >= 0 && j < f.moves.length ? moveDef(f, j) : null;
    // Only a move that needs no pick of its own can come out in place of another.
    if (m && !m.options && targetKind(f, m) === 'none') return j!;
  }
  return i;
}

/** A dizzy whorl's picked move, spun to the slot that comes out. Any other action stays as it is. */
function dizzied(b: Battle, side: 0 | 1, a: Action): Action {
  if (a.k !== 'move') return a;
  const f = out(b, side), j = spunSlot(b, f, a.i);
  if (j === a.i) return a;
  msg(b, `${label(b, f)} is dizzy, and ${moveDef(f, a.i)?.name || 'its move'} comes out as ${moveDef(f, j)?.name || 'another'}.`);
  return { k: 'move', i: j, aim: a.aim };
}

/** Takes f's sticky marks off it as it leaves the field, to wait for the next whorl its side sends out. */
function carrySticky(b: Battle, f: Fighter): void {
  for (const id of Object.keys(f.m)) {
    if (!MARKS[id]?.sticks) continue;
    (b.s[f.side].stuck ||= []).push({ id, mv: { ...f.m[id] } });
    delete f.m[id];
  }
}

/** Puts the sticky marks waiting on f's side onto f as it comes out. */
function landSticky(b: Battle, f: Fighter): void {
  const st = b.s[f.side].stuck;
  if (!st?.length) return;
  b.s[f.side].stuck = [];
  for (const x of st) {
    const def = MARKS[x.id];
    const cur = f.m[x.id];
    f.m[x.id] = { ...x.mv, n: Math.min(def?.max ?? 99, (cur?.n || 0) + x.mv.n), at: b.turnNo };
    if (def?.name && !b.quiet) emit(b, { e: 'status', ...seat(f), id: x.id });
  }
  msg(b, `What stuck to the last one sticks to ${label(b, f)}.`);
}

/** Puts spores into one of t's move slots for `turns` of its turns: using that move poisons it 2. */
export function sporeMove(b: Battle, t: Fighter, slot: number, turns: number): void {
  if (t.ko || t.gone || slot < 0 || slot >= t.moves.length || turns <= 0) return;
  const sp = (t.spore ||= t.moves.map(() => 0));
  const was = sp[slot] || 0;
  sp[slot] = Math.max(was, turns);
  if (!was) msg(b, `Spores get into ${label(b, t)}'s ${MOVES[t.moves[slot]]?.name || 'move'}.`);
}

/** Whether a mark on f mutes its passives. */
export function muted(f: Fighter): boolean {
  for (const id in f.m) if (MARKS[id]?.mutes) return true;
  return false;
}

export function hooks(f: Fighter): Hooks[] {
  const out: Hooks[] = [];
  if (!muted(f)) {
    for (const p of passivesOf(f)) if (PASSIVES[p]) out.push(PASSIVES[p]);
    for (const x of f.lent || []) if (PASSIVES[x.id] && !passivesOf(f).includes(x.id)) out.push(PASSIVES[x.id]);
  }
  if (f.mon.notion && NOTIONS[f.mon.notion]) out.push(NOTIONS[f.mon.notion]);
  for (const id of f.items || []) if (NOTIONS[id]) out.push(NOTIONS[id]);
  for (const id in f.m) if (MARKS[id]) out.push(MARKS[id]);
  if (f.fld && FIELDS[f.fld]) out.push(FIELDS[f.fld]);
  if (f.gnd && GROUNDS[f.gnd] && !f.up) out.push(GROUNDS[f.gnd]);
  return out;
}

/** Every standing fighter on both sides, out sloughs first. */
function everyone(b: Battle): Fighter[] {
  const o = [out(b, 0), out(b, 1)].filter(f => !f.ko && !f.gone);
  return [...o, ...reserves(b.s[0]), ...reserves(b.s[1])];
}

export function has(f: Fighter, passive: string): boolean {
  return (passivesOf(f).includes(passive) && !muted(f)) || f.mon.notion === passive;
}

/** The level every whorl fights at in a synced battle whose rules name none. */
export const SYNC_LV = 25;
/** The level a whorl's stats use in a battle under these rules. */
export function fightLevel(rules: Rules, mon: Mon): number { return rules.sync ? rules.syncLv || SYNC_LV : mon.level; }

export function makeFighter(mon: Mon, side: 0 | 1, idx: number, lv = mon.level): Fighter {
  const st: Stats = { ...statsAt(lv, profileOf(mon)) };
  const n = mon.notion ? NOTIONS[mon.notion] : null;
  if (n?.flat) for (const [k, v] of Object.entries(n.flat)) (st as any)[k] += v;
  if (n?.pct) for (const [k, v] of Object.entries(n.pct)) (st as any)[k] = Math.round((st as any)[k] * (1 + (v || 0)));
  if (mon.tan) for (const [k, v] of Object.entries(mon.tan)) (st as any)[k] += tanBonus(lv, k, v || 0);
  if (mon.fitted) for (const k of Object.keys(st)) (st as any)[k] = Math.round((st as any)[k] * FIT_STAT);
  return {
    side, idx, mon, moves: mon.moves.slice(), m: {}, st, maxHp: st.hp, hp: st.hp, shield: 0, shieldTurns: 0, ko: false, gone: false,
    cd: mon.moves.map(() => 0), s: {}, k: { prevTurn: -1, curTurn: -1 }, outAt: -1, turns: 0, movesUsed: 0, fld: null,
  };
}

export interface SideSpec { mons: Mon[]; name: string; ai: Side['ai']; charm?: string | null; wild?: boolean; player?: boolean }

export function newBattle(a: SideSpec, z: SideSpec, rules: Rules): Battle {
  const mk = (sp: SideSpec, side: 0 | 1): Side => ({
    f: sp.mons.map((m, i) => makeFighter(m, side, i, fightLevel(rules, m))),
    sum: [], out: 0, nerve: rules.nerve ? 2 + (sp.charm === 'mast' ? 2 : 0) : 0, next: 0, caps: 0,
    name: sp.name, ai: sp.ai, charm: sp.charm ?? null, wild: !!sp.wild, player: !!sp.player,
  });
  const b: Battle = {
    t: 0, s: [mk(a, 0), mk(z, 1)], pend: [], ev: [], quiet: false, rules, over: null, need: null, pid: 1, turnNo: 0,
    acting: null, pegged: [], queue: [], rnd: null, tie: 0, field: null,
    stats: { kos: [0, 0], interrupts: 0, bigMoves: 0, switches: 0, leadChanges: 0, lastLead: 0, actions: 0 },
  };
  (b as any).sk = [{}, {}];
  for (const side of [0, 1] as const) {
    const s = b.s[side];
    s.out = s.f.findIndex(f => !f.ko);
    for (const f of s.f) for (const h of hooks(f)) h.start?.(b, f);
  }
  for (const side of [0, 1] as const) {
    const s = b.s[side];
    const f = s.f[s.out];
    comeOut(b, f, true);
    // Equal speeds start level: a tie inside a round goes to the higher AGI, then alternates.
    s.next = ticks(b, f, 50) - (s.charm === 'fall' ? 25 : 0) - (f.k.firstBonus || 0);
    f.k.firstBonus = 0;
  }
  return b;
}

/** Per-side scratch values that are not part of the documented model. */
export function sk(b: Battle, side: 0 | 1): Record<string, number> {
  return (b as any).sk[side];
}

/** A copy of one fighter that shares nothing with it. */
export function cloneFighter(f: Fighter): Fighter {
  const m: Fighter['m'] = {};
  for (const id in f.m) m[id] = { ...f.m[id] };
  return {
    ...f, st: { ...f.st }, cd: f.cd.slice(), moves: f.moves.slice(), m, s: cloneStatus(f.s), k: { ...f.k }, items: f.items?.slice(), spent: f.spent?.slice(),
    tmp: f.tmp?.map(x => ({ ...x })), locks: f.locks?.slice(), spore: f.spore?.slice(), chan: f.chan?.map(x => ({ ...x })),
    boost: f.boost?.map(x => ({ ...x })), mtype: f.mtype?.map(x => ({ ...x })), cdHit: f.cdHit?.slice(), reach: f.reach ? { ...f.reach } : f.reach,
    lent: f.lent?.map(x => ({ ...x })), ammo: f.ammo?.slice(),
    retype: f.retype ? { types: f.retype.types.slice(), turns: f.retype.turns } : f.retype,
    kept: f.kept ? { ...f.kept, s: cloneStatus(f.kept.s), m: copyMarks(f.kept.m) } : f.kept, flock: f.flock ? { ...f.flock } : f.flock, glow: f.glow ? { ...f.glow } : f.glow, stored: f.stored ? { ...f.stored } : f.stored, fracture: f.fracture ? { ...f.fracture } : f.fracture, swap: f.swap ? { ...f.swap } : f.swap, mirage: f.mirage ? { ...f.mirage } : f.mirage, wait: f.wait ? { ...f.wait } : f.wait, keepsake: f.keepsake,
  };
}

export function clone(b: Battle): Battle {
  const cf = cloneFighter;
  const cs = (s: Side): Side => ({ ...s, f: s.f.map(cf), sum: s.sum.map(x => ({ ...x, moves: x.moves?.slice(), cd: x.cd?.slice() })), ground: s.ground ? { ...s.ground } : s.ground, hold: s.hold ? { ...s.hold } : s.hold, mantle: s.mantle ? { ...s.mantle } : s.mantle, cut: s.cut ? { ...s.cut } : s.cut, spin: s.spin ? { ...s.spin } : s.spin, price: s.price ? { ...s.price } : s.price, pink: s.pink ? { ...s.pink } : s.pink, fog: s.fog ? { ...s.fog } : s.fog, shut: s.shut ? { ...s.shut } : s.shut, stuck: s.stuck?.map(x => ({ id: x.id, mv: { ...x.mv } })) });
  const c: Battle = {
    ...b, s: [cs(b.s[0]), cs(b.s[1])], pend: b.pend.map(p => ({ ...p, data: p.data ? { ...p.data } : undefined })),
    ev: [], quiet: true, need: b.need ? { ...b.need } as Decision : null, pegged: b.pegged.slice(), stats: { ...b.stats, kos: [b.stats.kos[0], b.stats.kos[1]] },
    queue: b.queue.map(q => ({ ...q })),
    rnd: b.rnd ? { ...b.rnd, commits: [b.rnd.commits[0], b.rnd.commits[1]], done: [b.rnd.done[0], b.rnd.done[1]] } : null,
    field: b.field ? { ...b.field } : null,
    drops: b.drops?.map(d => ({ ...d })),
    // The recorded steps and the present a visit keeps are never changed in place, so a copy shares them.
    past: undefined, rewindReq: null, visit: b.visit ? { ...b.visit, body: cf(b.visit.body) } : b.visit,
    lowWater: b.lowWater ? { ...b.lowWater } : b.lowWater, range: b.range ? { ...b.range } : b.range, wind: b.wind ? { ...b.wind } : b.wind, swell: b.swell ? { ...b.swell } : b.swell,
    bout: b.bout ? { ...b.bout, score: [b.bout.score[0], b.bout.score[1]], dealt: [b.bout.dealt[0], b.bout.dealt[1]] } : b.bout,
  };
  (c as any).sk = [{ ...(b as any).sk[0] }, { ...(b as any).sk[1] }];
  return c;
}

function copyMarks(m: Fighter['m']): Fighter['m'] {
  const o: Fighter['m'] = {};
  for (const id in m) o[id] = { ...m[id] };
  return o;
}

/** Seals f's moment now, its HP, shield, statuses, and marks, so it can go back to it later. */
export function keepMoment(f: Fighter): void {
  f.kept = { hp: f.hp, shield: f.shield, shieldTurns: f.shieldTurns, s: cloneStatus(f.s), m: copyMarks(f.m) };
}

/** Puts f back as it stood at its sealed moment and clears the seal. Marks named in `keep` stay as they are now. */
export function returnToMoment(b: Battle, f: Fighter, keep: string[] = []): boolean {
  const k = f.kept;
  if (!k || f.ko || f.gone) return false;
  f.kept = null;
  const now = f.m;
  f.hp = Math.max(1, Math.min(f.maxHp, k.hp));
  f.shield = k.shield;
  f.shieldTurns = k.shieldTurns;
  f.s = cloneStatus(k.s);
  f.m = copyMarks(k.m);
  for (const id of keep) if (now[id]) f.m[id] = now[id];
  msg(b, `${label(b, f)} goes back to how it stood.`);
  emit(b, { e: 'heal', ...seat(f), amt: 0 });
  return true;
}

function cloneStatus(s: Fighter['s']): Fighter['s'] {
  const o: Fighter['s'] = {};
  for (const k in s) o[k as StatusId] = { ...s[k as StatusId]! };
  return o;
}

// ---------------------------------------------------------------- helpers

export function out(b: Battle, side: 0 | 1): Fighter {
  return b.s[side].f[b.s[side].out];
}

export function foeOf(b: Battle, f: Fighter): Fighter {
  return out(b, (1 - f.side) as 0 | 1);
}

export function standing(s: Side): Fighter[] {
  return s.f.filter(f => !f.ko && !f.gone);
}

/** Whorls whose reserve auras reach the out whorl: the reserves, and the fallen that still glow. */
export function auraHolders(s: Side): Fighter[] {
  return s.f.filter((f, i) => i !== s.out && !f.gone && (!f.ko || !!f.glow));
}

export function reserves(s: Side): Fighter[] {
  return s.f.filter((f, i) => i !== s.out && !f.ko && !f.gone);
}

/** Whether f is its side's out whorl. A visitor from the future shares its past self's slot and is never out. */
export function isOut(b: Battle, f: Fighter): boolean {
  return b.s[f.side].out === f.idx && !f.ko && !f.gone && f !== visiting;
}

export function emit(b: Battle, e: Ev): void {
  if (b.quiet) return;
  if (pastDepth) e.past = true;
  // A visitor shares its past self's slot. An event that does not say which of the two it is about is the visitor's.
  if (visiting && e.visit === undefined && 'idx' in e && 'side' in e && e.side === visiting.side && e.idx === visiting.idx) e.visit = true;
  if (b.lanes) e.snap = snapOf(b);
  b.ev.push(e);
}

/** Where an event about f happens: its side and slot, and while a visitor casts, whether f is that visitor. */
export function seat(f: Fighter): { side: 0 | 1; idx: number; visit?: boolean } {
  return visiting ? { side: f.side, idx: f.idx, visit: f === visiting } : { side: f.side, idx: f.idx };
}

/** The battle as the screen shows it now. A disguised whorl shows the disguise, and its lane is spaced by the AGI of the whorl it shows. */
export function snapOf(b: Battle): Snap {
  const clock = (sd: 0 | 1): [number, number] => {
    const s = b.s[sd], f = s.f[s.out];
    // A choice waiting in the round marks the side's next turn where it will resolve.
    const nx = b.queue.find(q => q.side === sd)?.at ?? s.next;
    if (!f || f.ko || f.gone) return [nx, 0];
    const t = ticks(b, f, 100), seen = f.disguise?.agi;
    return [nx, seen === undefined ? t : t * (stat(b, f, 'agi') + 100) / (seen + 100)];
  };
  const counts = (r: Record<string, { n: number } | undefined>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v).map(([k, v]) => [k, v!.n]));
  const side = (sd: 0 | 1): SnapSide => {
    const s = b.s[sd], f = s.f[s.out], own = sd === (b.view ?? 0);
    const out: SnapFighter | null = f ? {
      idx: f.idx, hp: f.hp, name: own ? nameOf(f) : seenName(f), types: (own ? typesOf(f) : seenTypes(f)).slice(),
      sprite: own ? spriteOf(f) : seenSprite(f), s: counts(f.s as Record<string, { n: number } | undefined>), m: counts(f.m),
    } : null;
    return { nerve: s.nerve, caps: s.caps, sum: s.sum.map(u => ({ ...u })), out };
  };
  const a = clock(0), c = clock(1);
  return {
    t: b.t, out: [b.s[0].out, b.s[1].out], next: [a[0], c[0]], step: [a[1], c[1]], side: [side(0), side(1)],
    wind: b.pend.filter(p => p.kind === 'windup').map(p => ({ ...p })),
  };
}

export function label(b: Battle, f: Fighter): string {
  const s = b.s[f.side];
  if (b.view === undefined ? s.player : f.side === b.view) return nameOf(f);
  return (s.wild ? 'Wild ' : 'Foe ') + seenName(f);
}

export function msg(b: Battle, text: string): void {
  emit(b, { e: 'msg', text });
}

export function stat(b: Battle, f: Fighter, k: 'atk' | 'mgk' | 'def' | 'res' | 'agi' | 'cha'): number {
  let v = f.st[k] * (f.form?.statMul?.[k] ?? 1);
  for (const id of f.items || []) v *= 1 + (NOTIONS[id]?.pct?.[k] || 0);
  for (const h of hooks(f)) if (h.statBonus) v += h.statBonus(f, k);
  if (k === 'def') v = Math.max(0, v - (f.k.defLoss || 0) - (f.k.shred || 0) + (f.k.defGain || 0));
  if (k === 'res') v = Math.max(0, v - (f.k.rshred || 0));
  if (k === 'agi' && isOut(b, f)) {
    for (const r of reserves(b.s[f.side])) if (has(r, 'tailwind')) v += 5;
  }
  return v;
}

export function moveType(f: Fighter, m: MoveDef): Type {
  if (f.mtype?.length) {
    const k = f.moves.indexOf(m.id), laid = f.mtype.find(x => x.slot === k);
    if (laid) return laid.type;
  }
  if (f.mon.retune && f.mon.retune.move === m.id) return f.mon.retune.type;
  return m.type;
}

/** A move's text as the player reads it, with its Splash share for this holder. */
export function moveText(m: MoveDef, passives: string[] = []): string {
  const pct = Math.round(Math.min(1, (m.splash ?? SPREAD_SHARE) + (passives.includes('conductive') ? WET_SAND : 0)) * 100);
  if (/Splash \d+%/.test(m.text)) return m.text.replace(/Splash \d+%/, `Splash ${pct}%`);
  // A spread text written before the Splash keyword gets it after its hit. A spread move that deals no damage gets none.
  if (m.reach !== 'spread' || /reserve/i.test(m.text) || !/Hits (every foe )?for /.test(m.text)) return m.text;
  return m.text.replace(/Hits (?:every foe )?for (.*?)\.(?= |$)/, (_, x: string) => `Hits for ${x}. Splash ${pct}%.`);
}

/** What a move counts as for habits that block or change dashes, projectiles, and spells, such as "Dash. Spell." */
export function moveKinds(m: MoveDef): string {
  const names: Record<string, string> = { dash: 'Dash', projectile: 'Projectile', spell: 'Spell', sound: 'Sound' };
  return (m.tags || []).filter(t => names[t]).map(t => names[t] + '.').join(' ');
}

/** The rule each kind of move and each order class brings, one short line each, as the move detail and the Guide show them. */
export const KIND_RULE: Record<string, string> = {
  dash: 'Dash: takes 0.9x till its next turn. Guard can\'t stop it.',
  projectile: 'Projectile: a guarding foe takes 0.25x.',
  spell: 'Spell: passes over walls. Silence stops it.',
  channel: 'Channel: a stun, silence, or switch ends it.',
  sound: 'Sound: guard can\'t stop it, and it finds a Hidden foe. Silence stops it. A Deaf whorl takes 0.5x.',
  quick: 'Quick: goes first in a round.',
  late: 'Late: goes after the foe in a round.',
  splash: 'Splash: each foe in reserve takes that share of the hit.',
};

/** The kind, order, and Splash lines for a move, in a fixed order. */
export function kindLines(m: MoveDef): string[] {
  const out: string[] = [];
  for (const t of ['dash', 'projectile', 'spell', 'channel', 'sound'] as const) if (m.tags?.includes(t)) out.push(KIND_RULE[t]);
  if (m.quick) out.push(KIND_RULE.quick);
  if (m.late) out.push(KIND_RULE.late);
  if (m.reach === 'spread' || /Splash \d+%/.test(m.text)) out.push(KIND_RULE.splash);
  return out;
}

/** The gap an action of this weight leaves before the fighter's next turn, from AGI and pace hooks, with no Slow or Haste. */
export function plainTicks(b: Battle, f: Fighter, weight = 100): number {
  let w = weight * 200 / (stat(b, f, 'agi') + 100);
  for (const h of hooks(f)) if (h.speedMul) w *= h.speedMul(b, f);
  return w;
}

const slowed = (f: Fighter): boolean => !!f.s.slow && !f.s.unstop && !hooks(f).some(h => h.statusImmune?.(f, 'slow'));

/** The fighter's pace for one action as the screen and forecasts show it: Slow stretches it and Haste shortens it. */
export function ticks(b: Battle, f: Fighter, weight: number): number {
  let w = plainTicks(b, f, weight);
  if (slowed(f)) w *= 1.3;
  if (f.s.haste) w *= 0.7;
  return Math.round(w);
}

/**
 * The gap to the fighter's next turn after an action. Slow N and Haste N cover N turns. A turn already moved when the status
 * landed counts as one of them, so the status only stretches or shortens later gaps while turns are left on it.
 */
function gapAfter(b: Battle, f: Fighter, weight: number): number {
  let w = plainTicks(b, f, weight);
  const keep = cured(f);
  for (const id of PACE) {
    const v = f.s[id];
    if (!v) continue;
    if (id === 'slow' && !slowed(f)) continue;
    if (v.v === 1 && !keep && --v.n <= 0) { delete f.s[id]; continue; }
    w *= id === 'slow' ? 1.3 : 0.7;
    v.v = 1;
  }
  return Math.round(w);
}

/** Moves a side's next turn by dt ticks, or the choice it is waiting on in the round. A turn never moves into the past. */
export function shiftTurn(b: Battle, side: 0 | 1, dt: number): void {
  const q = b.queue.find(x => x.side === side);
  if (q) {
    const at = Math.max(b.t, q.at + dt);
    q.sched += at - q.at;
    q.at = at;
    b.queue.sort(queueOrder);
    return;
  }
  b.s[side].next = Math.max(b.t + (dt < 0 ? 1 : 0), b.s[side].next + dt);
}

/** Slow and Haste landing on a whorl between its turns move the turn it is waiting for at once. */
function paceNow(b: Battle, t: Fighter, id: 'slow' | 'haste'): void {
  const v = t.s[id];
  if (!v || v.v === 1 || !isOut(b, t) || b.acting === t.side) return;
  if (id === 'slow' && !slowed(t)) return;
  const p = Math.round(SPEED_SHIFT * plainTicks(b, t));
  shiftTurn(b, t.side, id === 'slow' ? p : -p);
  v.v = 1;
}

export function addNerve(b: Battle, side: 0 | 1, n: number): void {
  if (!b.rules.nerve || n === 0) return;
  // A held side's gains go to the side that holds its tide, once, so two holds cannot pass tide back and forth.
  const held = b.s[side].hold;
  if (n > 0 && held && held.to !== side) { msg(b, `${b.s[side].name}'s tide goes into the hold.`); side = held.to; }
  const s = b.s[side];
  const before = s.nerve;
  // Tide in debt stays below 0 until gains pay it back, and a loss never takes a side deeper into debt.
  s.nerve = Math.max(Math.min(0, s.nerve), Math.min(NERVE_MAX, s.nerve + n));
  if (s.pink && s.pink.n > s.nerve) s.pink = s.nerve > 0 ? { ...s.pink, n: s.nerve } : null;
  if (s.nerve !== before) emit(b, { e: 'nerve', side, n: s.nerve - before });
}

/** The most tide `side` may run into debt for a crest: the largest credit any of its standing whorls gives. */
export function creditOf(b: Battle, side: 0 | 1): number {
  let n = 0;
  for (const f of b.s[side].f) if (!f.ko && !f.gone) for (const h of hooks(f)) n = Math.max(n, h.credit?.(b, f) || 0);
  return n;
}

/** Pays a crest's tide, running the side into debt as far as its credit allows when it holds too little. */
export function payTide(b: Battle, side: 0 | 1, cost: number): void {
  const s = b.s[side];
  if (cost <= 0) return;
  if (s.nerve >= cost || !b.rules.nerve) { addNerve(b, side, -cost); return; }
  const before = s.nerve;
  s.nerve = Math.max(-creditOf(b, side), s.nerve - cost);
  if (s.pink) s.pink = null;
  emit(b, { e: 'nerve', side, n: s.nerve - before });
  msg(b, `${s.name} runs ${-s.nerve} tide into debt.`);
}

function rawOf(b: Battle, u: Fighter, t: Fighter, r: Ratio): number {
  let v = r.flat || 0;
  if (r.atk) v += r.atk * stat(b, u, 'atk');
  if (r.mgk) v += r.mgk * stat(b, u, 'mgk');
  if (r.def) v += r.def * stat(b, u, 'def');
  if (r.cha) v += r.cha * stat(b, u, 'cha');
  if (r.res) v += r.res * stat(b, u, 'res');
  if (r.agi) v += r.agi * stat(b, u, 'agi');
  if (r.selfHp) v += r.selfHp * u.maxHp;
  if (r.hp) v += r.hp * u.hp;
  if (r.tgtHp) v += r.tgtHp * t.maxHp;
  if (r.tgtMiss) v += r.tgtMiss * (t.maxHp - t.hp);
  if (r.tgtCur) v += r.tgtCur * t.hp;
  if (r.tgtAtk) v += r.tgtAtk * stat(b, t, 'atk');
  if (r.tgtMgk) v += r.tgtMgk * stat(b, t, 'mgk');
  if (r.tgtDef) v += r.tgtDef * stat(b, t, 'def');
  if (r.tgtRes) v += r.tgtRes * stat(b, t, 'res');
  if (r.tgtAgi) v += r.tgtAgi * stat(b, t, 'agi');
  if (r.agiGap) v += r.agiGap * Math.max(0, stat(b, u, 'agi') - stat(b, t, 'agi'));
  return v;
}

export function cameOutSince(b: Battle, tgt: Fighter, f: Fighter): boolean {
  return tgt.outAt > (f.k.prevTurn ?? -1);
}

// ---------------------------------------------------------------- damage

/** The type multiplier on a hit of `type` that `t` takes from `src`: the chart, then the target's hooks, then the attacker's. */
export function typeOn(b: Battle, t: Fighter, type: Type, base = typeMult(type, seenTypes(t)), src: Fighter | null = null): number {
  let m = base;
  for (const h of hooks(t)) if (h.typeIn) m = h.typeIn(b, t, type, m);
  if (src) for (const h of hooks(src)) if (h.typeOut) m = h.typeOut(b, src, t, type, m);
  return m;
}

export function dealDamage(
  b: Battle, src: Fighter | null, tgt: Fighter, raw: number, info: DmgInfo, mtype: Type | null, mult = 1, noGuard = false,
): number {
  // A whorl visiting from the future is gone again before anything can reach it.
  if (tgt.ko || tgt.gone || tgt.hp <= 0 || raw <= 0 || tgt === visiting) return 0;
  if (tgt.s.stasis) return 0;
  // An aimed action sends its single-target hits to the summon it picked.
  if (b.aim && src && src.side === b.aim.side && tgt.side !== src.side && !info.dot && !info.spread && !info.reserve && isOut(b, tgt)) {
    const aimed = b.s[tgt.side].sum.find(u => u.uid === b.aim!.uid);
    if (aimed) return hitSummon(b, aimed, raw * mult * SUMMON_TAKE);
  }
  const tags = info.move?.tags;
  const dash = !!tags?.includes('dash'), projectile = !!tags?.includes('projectile'), spell = !!tags?.includes('spell'), sound = !!tags?.includes('sound');
  // A guarding summon takes single-target hits meant for its side's out whorl, and spread hits splash onto every summon there.
  // A spell passes over it.
  const guard = src && src.side !== tgt.side && !info.dot && !info.spread && !info.reserve && info.kind !== 'T' && isOut(b, tgt) && !spell
    ? b.s[tgt.side].sum.find(u => SUMMONS[u.def]?.guard) : undefined;
  if (guard) {
    const amt = raw * mult * SUMMON_TAKE;
    if (!SUMMONS[guard.def]?.spill || amt <= guard.hp) return hitSummon(b, guard, amt);
    // A spilling guard soaks what its HP allows and the rest of the hit carries on to the whorl.
    raw *= 1 - guard.hp / amt;
    hitSummon(b, guard, guard.hp);
  }
  if (src && info.spread && isOut(b, tgt)) for (const u of b.s[tgt.side].sum.slice()) hitSummon(b, u, raw * mult * (info.move?.splash ?? SPREAD_SHARE) * SUMMON_TAKE);
  // Fog over the bench: a reserve under it cannot be reached from the other side.
  if (fogged(b, src, tgt)) return 0;
  // Cover: an out whorl that covers its bench takes the other side's hits meant for its reserves.
  if (src && src.side !== tgt.side && !info.dot && !isOut(b, tgt)) {
    const cov = out(b, tgt.side);
    if (cov && cov !== tgt && !cov.ko && !cov.gone && hooks(cov).some(h => h.covers?.(b, cov, tgt))) {
      msg(b, `${label(b, cov)} takes it for ${label(b, tgt)}.`);
      return dealDamage(b, src, cov, raw, { ...info, reserve: false }, mtype, mult, noGuard);
    }
  }
  // Hidden: single-target hits from the other side cannot find it. Its own first hit out of hiding ignores guard and ends the hiding.
  if (tgt.s.hidden && src && src.side !== tgt.side && !info.spread && !info.dot && !info.reserve && !sound && !hooks(src).some(h => h.findsHidden?.(b, src, tgt))) { msg(b, `${label(b, src)} can't find ${label(b, tgt)}.`); return 0; }
  if (src && src.s.hidden && src.side !== tgt.side && !info.dot) { noGuard = true; reveal(b, src); }
  let d = raw * mult;
  let kind = info.kind;
  if (src && kind !== 'T' && has(src, 'watch') && tgt.hp < tgt.maxHp * 0.3) kind = 'T';
  if (kind !== 'T') {
    if (mtype && !info.dot) {
      d *= typeOn(b, tgt, mtype, undefined, src);
      if (src && typesOf(src).includes(mtype)) d *= 1.2;
    }
    const pen = src && has(src, 'bodkin') ? 0.35 : 0;
    const armor = kind === 'P' ? stat(b, tgt, 'def') : stat(b, tgt, 'res');
    d *= 100 / (100 + armor * (1 - pen));
  }
  if (src && !info.dot) {
    for (const h of hooks(src)) if (h.outMul) d *= h.outMul(b, src, tgt, info);
    if (src.s.empower) d *= 1.25;
    if (src.s.weaken) d *= 0.75;
    if (src.k.escape) d *= 1.1;
    if (info.move && src.k.moveMul) d *= src.k.moveMul;
    if (isOut(b, src)) {
      if (!b.s[src.side].cut) for (const r of auraHolders(b.s[src.side])) for (const h of hooks(r)) if (h.auraOut) d *= h.auraOut(b, r, src, tgt, info);
    }
    if (b.s[src.side].charm === 'bole' && src.mon.fitted) d *= 1.08;
  }
  for (const h of hooks(tgt)) if (h.inMul) d *= h.inMul(b, tgt, src, info);
  let guarded = false;
  if (!info.dot) {
    // A guard stops projectiles best and does nothing against a dash.
    if (tgt.s.guard && !noGuard && !dash && !sound) { d *= projectile ? GUARD_PROJECTILE : GUARD_TAKE; guarded = true; }
    // Sound: a deaf whorl hears only half of it.
    if (sound && src && src.side !== tgt.side && deaf(b, tgt)) d *= SOUND_DEAF;
    if (tgt.s.dashing) d *= DASH_TAKE;
    // Range: at Near a dash lands harder and a thrown thing loses force, and at Far the other way round.
    const rg = rangeOf(b);
    if (rg && src && src.side !== tgt.side && !info.reserve && isOut(b, tgt) && (dash || projectile)) d *= dash === (rg === 'near') ? RANGE_UP : RANGE_DOWN;
    // Wind: a projectile thrown toward the side the wind blows to rides it, and one thrown the other way fights it.
    if (b.wind && src && src.side !== tgt.side && projectile) d *= tgt.side === b.wind.to ? WIND_WITH : WIND_AGAINST;
    const orbit = src && has(src, 'orbit');
    if (tgt.s.fortify && !orbit) d *= 1 - (tgt.s.fortify.v || 0.25);
    if (tgt.s.expose) d *= 1.25;
    if (tgt.k.illwind && tgt.s.doom) d *= 1.15;
  }
  if (isOut(b, tgt)) {
    if (!b.s[tgt.side].cut) for (const r of auraHolders(b.s[tgt.side])) for (const h of hooks(r)) if (h.auraIn) d *= h.auraIn(b, r, tgt, src, info);
    if (b.s[tgt.side].charm === 'rib' && tgt.k.ribFirst) d *= 0.85;
  }
  if (tgt.s.invuln) d = 0;
  let amt = Math.round(d);
  if (amt < 1 && d > 0) amt = 1;
  if (amt <= 0) return 0;
  for (const h of hooks(tgt)) {
    if (!h.beforeTake) continue;
    amt = Math.max(0, Math.round(h.beforeTake(b, tgt, src, amt, info)));
    if (amt <= 0) return 0;
  }
  // A flock: a one-target hit fells the front body at most, and the rest of the flock is untouched.
  if (tgt.flock && !info.spread && !info.dot) amt = Math.min(amt, tgt.shield + flockFront(tgt));
  // A banked hit waits in Fighter.bank: it deals nothing now and wakes nobody.
  if (hooks(tgt).some(h => h.bankHit?.(b, tgt, src, amt, info))) {
    tgt.bank = (tgt.bank || 0) + amt;
    msg(b, `${label(b, tgt)} holds ${amt} back.`);
    return 0;
  }
  amt = bearWeight(b, tgt, amt, info);

  // A side's mantle takes a hit on any of its whorls before their own shields. A piercing hit goes past both.
  const pierce = !!info.pierce || (!!src && hooks(src).some(h => h.pierces?.(b, src, tgt, info)));
  let toShield = 0;
  const mn = b.s[tgt.side].mantle;
  if (pierce && !info.dot && (tgt.shield > 0 || (mn && mn.hp > 0))) msg(b, `The hit goes straight through to ${label(b, tgt)}.`);
  if (mn && mn.hp > 0 && !info.dot && !pierce) {
    toShield = Math.min(mn.hp, amt);
    mn.hp -= toShield;
    if (mn.hp <= 0) { b.s[tgt.side].mantle = null; msg(b, 'The mantle wears through.'); }
  }
  if (tgt.shield > 0 && amt > toShield && !pierce) {
    const own = Math.min(tgt.shield, amt - toShield);
    toShield += own;
    tgt.shield -= own;
    if (tgt.shield <= 0) { tgt.shield = 0; tgt.shieldTurns = 0; }
  }
  const toHp = amt - toShield;
  const before = tgt.hp;
  tgt.hp -= toHp;
  if (src) src.k.dealt = (src.k.dealt || 0) + amt;
  if (!info.dot && b.rnd) tgt.k.hitRound = b.rnd.n;
  emit(b, { e: 'dmg', ...seat(tgt), amt, kind, eff: mtype && kind !== 'T' && !info.dot ? typeOn(b, tgt, mtype, undefined, src) : 1, shield: toShield });
  if (tgt.s.sleep && !(src && hooks(src).some(h => h.lulls?.(b, src, tgt)))) { delete tgt.s.sleep; msg(b, `${label(b, tgt)} wakes up.`); }
  if (guarded && info.move && !tgt.k.guardPaid) {
    tgt.k.guardPaid = 1;
    addNerve(b, tgt.side, 1);
  }
  if (!info.dot && !info.reserve) {
    if (hears(b, tgt, src)) for (const h of hooks(tgt)) h.afterTake?.(b, tgt, src, amt, info);
    if (src && src !== tgt) {
      if (tgt.s.thorns && !(info as any).reflect && !tgt.ko) {
        reflect(b, tgt, src, amt * (tgt.s.thorns.v || 0.3));
      }
      for (const h of hooks(src)) h.afterDeal?.(b, src, tgt, amt, info);
      if (src.side !== tgt.side && (info.attack || dash)) contactJump(b, src, tgt);
      // Watch over: reserves answer a foe's hit on their out ally, unless their side is cut off from its bench.
      if (src.side !== tgt.side && isOut(b, tgt) && !(info as any).reflect && !b.s[tgt.side].cut && !src.ko) for (const r of reserves(b.s[tgt.side])) if (hears(b, r, src)) for (const h of hooks(r)) h.watchOver?.(b, r, tgt, src, amt, info);
    }
  }
  // A bout keeps score of what each boxer deals the other.
  if (b.bout && src && src !== tgt && !info.dot && inBout(b, src) && inBout(b, tgt)) b.bout!.dealt[src.side] += amt;
  if (tgt.poise && !info.dot && tgt.hp > 0) wearPoise(b, src, tgt, amt);
  // Siren's alarm watches the whole side.
  if (tgt.hp > 0 && tgt.hp < tgt.maxHp * 0.3 && before >= tgt.maxHp * 0.3) {
    for (const f of standing(b.s[tgt.side])) {
      if (has(f, 'alarm') && !f.k.alarmUsed) {
        f.k.alarmUsed = 1;
        msg(b, `${label(b, f)} goes off.`);
        addNerve(b, tgt.side, 2);
      }
    }
  }
  if (tgt.hp <= 0) {
    const over = Math.max(0, toHp - before);
    handleKO(b, tgt, src, amt);
    if (tgt.ko && src && src !== tgt && over > 0) for (const h of hooks(src)) h.overflow?.(b, src, tgt, over, info);
  }
  return amt;
}

/**
 * Rolls two whorls over: each takes the other's share of its own max HP, shields aside. Neither falls below 1 HP.
 * Returns how much of a share moved.
 */
export function rollHp(b: Battle, a: Fighter, z: Fighter): number {
  if (a.ko || a.gone || z.ko || z.gone || a === z || a.s.stasis || z.s.stasis) return 0;
  const sa = a.hp / a.maxHp, sz = z.hp / z.maxHp;
  const na = Math.max(1, Math.round(sz * a.maxHp)), nz = Math.max(1, Math.round(sa * z.maxHp));
  for (const [f, n] of [[a, na], [z, nz]] as const) {
    const d = n - f.hp;
    f.hp = n;
    if (d > 0) emit(b, { e: 'heal', ...seat(f), amt: d });
    else if (d < 0) emit(b, { e: 'dmg', ...seat(f), amt: -d, kind: 'T', eff: 1, shield: 0 });
  }
  msg(b, `${label(b, a)} and ${label(b, z)} roll over.`);
  return Math.abs(sa - sz);
}

/** Shots left in f's slot: its move's full load when unspent, or 0 for a move without ammo. */
export function ammoOf(f: Fighter, slot: number): number {
  const m = MOVES[f.moves[slot]];
  if (!m?.ammo) return 0;
  const v = f.ammo?.[slot];
  return v === undefined || v < 0 ? m.ammo : v;
}

/** Lends `to` one of `from`'s passives for `turns` of to's own turns. Its hooks run as to's own, and leaving the field ends it. */
export function lendPassive(b: Battle, from: Fighter, to: Fighter, id: string, turns: number): void {
  if (!PASSIVES[id] || to.ko || to.gone || turns <= 0 || passivesOf(to).includes(id)) return;
  to.lent = [...(to.lent || []).filter(x => x.id !== id), { id, turns }];
  msg(b, `${label(b, from)} lends ${label(b, to)} its ${PASSIVES[id].name}.`);
}

/** f's next `uses` moves that hit reach wide (on to the foe's reserves) or tight (an every-foe hit all on the out foe). */
export function setReach(b: Battle, f: Fighter, mode: 'wide' | 'tight', uses = 1): void {
  if (f.ko || f.gone || uses <= 0) return;
  f.reach = { mode, uses };
  msg(b, `${label(b, f)}'s next ${uses > 1 ? `${uses} moves reach` : 'move reaches'} ${mode}.`);
}

/** Lands what a bankHit hook held back on t, times `mult`, as one true hit from `src`. Returns the damage dealt. */
export function landBank(b: Battle, t: Fighter, mult = 1, src: Fighter | null = null): number {
  const amt = Math.round((t.bank || 0) * mult);
  t.bank = 0;
  if (amt <= 0 || t.ko || t.gone) return 0;
  return dealDamage(b, src && !src.ko ? src : null, t, amt, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: !isOut(b, t) }, null);
}

export function reflect(b: Battle, from: Fighter, to: Fighter, raw: number): void {
  if (raw <= 0 || to.ko) return;
  const info: DmgInfo & { reflect: boolean } = { kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false, reflect: true };
  dealDamage(b, from, to, raw, info, null);
}

export function handleKO(b: Battle, t: Fighter, src: Fighter | null, dmg: number): void {
  if (t === visiting) { t.hp = Math.max(1, t.hp); return; }
  if (t.s.monument) { t.hp = 1; msg(b, `${label(b, t)} stands like a monument.`); return; }
  if (isOut(b, t)) {
    for (const r of reserves(b.s[t.side])) {
      for (const h of hooks(r)) {
        if (h.allyWouldKO && t.hp <= 0) {
          const back = h.allyWouldKO(b, r, t, src, dmg);
          if (back > 0 && !sk(b, t.side).saved) t.hp += back;
        }
      }
    }
    if (t.hp > 0) { sk(b, t.side).saved = 1; return; }
    // A reserve may swap in for the out ally a blow would knock out. The ally goes to reserve at 1 HP.
    for (const r of reserves(b.s[t.side])) {
      if (!hooks(r).some(h => h.rescue?.(b, r, t, src))) continue;
      t.hp = 1;
      doSwitch(b, t.side, r.idx, true);
      msg(b, `${label(b, r)} swaps in for ${label(b, t)}.`);
      return;
    }
  }
  // Each side gets one second chance a battle. Later saves still spend themselves but do not stop the KO.
  let saved = false;
  for (const h of hooks(t)) if (h.wouldKO && h.wouldKO(b, t, src)) { saved = true; break; }
  if (saved && !sk(b, t.side).saved) { sk(b, t.side).saved = 1; return; }
  if (saved) msg(b, `${label(b, t)} has no second chance left.`);
  endChannel(b, t);
  t.hp = 0;
  t.ko = true;
  endSwap(b, t);
  carrySticky(b, t);
  t.shield = 0;
  t.poise = 0;
  t.mirage = null;
  t.wait = null;
  t.stored = null;
  t.fracture = null;
  t.k.diedPoison = t.s.poison?.n || 0;
  // A whorl with an afterglow keeps shining over its side once it is down.
  const gl = hooks(t).map(h => h.glows?.(b, t)).find(x => x && x.turns > 0);
  t.glow = gl ? { ...gl } : null;
  t.s = {};
  t.m = {};
  t.tmp = []; t.locks = []; t.retype = null; t.boost = []; t.mtype = []; t.lent = []; t.reach = null;
  b.pend = b.pend.filter(p => !(p.side === t.side && p.idx === t.idx));
  // A choice dies with the whorl that made it. Its replacement comes out on its own clock.
  b.queue = b.queue.filter(q => !(q.side === t.side && q.who === t.idx));
  for (const u of b.s[t.side].sum.filter(x => x.by === t.idx && !SUMMONS[x.def]?.lasting)) dismiss(b, u);
  emit(b, { e: 'ko', ...seat(t) });
  msg(b, `${label(b, t)} is down.`);
  if (t.glow) msg(b, `${label(b, t)} glows on over its side.`);
  b.stats.kos[t.side]++;
  if (src && src.side !== t.side) addNerve(b, src.side, 2);
  addNerve(b, t.side, 1);
  for (const side of [0, 1] as const) {
    for (const f of b.s[side].f) {
      if (f.ko || f.gone || !hears(b, f, src)) continue;
      for (const h of hooks(f)) h.anyKO?.(b, f, t, src);
    }
  }
  // The fallen slough's own passives hear its KO too, for effects that fire on their holder's fall.
  for (const h of hooks(t)) h.anyKO?.(b, t, t, src);
  if (src && src.side !== t.side && b.s[src.side].charm === 'hilt') {
    src.cd = src.cd.map(c => Math.max(0, c - 1));
  }
  // The KO wiped the marks that time a form, so a revived whorl would otherwise keep the form for good.
  t.form = null;
  t.disguise = null;
  resetMoves(t);
  checkOver(b);
}

function checkOver(b: Battle): void {
  if (b.over !== null) return;
  // A banished whorl still counts: it is coming back.
  const alive = (s: Side) => s.f.filter(f => !f.ko && (!f.gone || f.k.banished)).length;
  const alive0 = alive(b.s[0]);
  const alive1 = alive(b.s[1]);
  if (alive1 === 0) b.over = 0;
  else if (alive0 === 0) b.over = 1;
}

// ---------------------------------------------------------------- statuses

export function immuneTo(b: Battle, f: Fighter, id: string): boolean {
  if (f.s.stasis) return true;
  if (f.s.unstop && (CC as string[]).includes(id)) return true;
  for (const h of hooks(f)) if (h.statusImmune?.(f, id)) return true;
  return false;
}

/** The opposite each status turns into when a whorl hears it backward. */
export const STATUS_TURN: Partial<Record<StatusId, StatusId>> = { empower: 'weaken', weaken: 'empower', haste: 'slow', slow: 'haste', fortify: 'expose', expose: 'fortify' };

/** Turns each of t's statuses that has an opposite into that opposite, keeping its turns. Returns how many turned. */
export function turnStatuses(b: Battle, src: Fighter | null, t: Fighter): number {
  if (t.ko || t.gone) return 0;
  const olds = (Object.keys(t.s) as StatusId[]).filter(id => STATUS_TURN[id]).map(id => ({ id, n: t.s[id]!.n }));
  for (const o of olds) delete t.s[o.id];
  let n = 0;
  for (const o of olds) if (applyStatus(b, src, t, STATUS_TURN[o.id]!, o.n)) n++;
  if (olds.length) msg(b, `${label(b, t)} hears it backward.`);
  return n;
}

/** The damage t's Burn, Bleed, Poison, and Doom would still deal over their turns if left to run. */
export function dueOf(t: Fighter): number {
  const s = t.s, tri = (n: number) => n * (n + 1) / 2;
  return Math.round((s.burn ? (s.burn.v || 10) * s.burn.n : 0) + (s.bleed ? (s.bleed.v || 5) * tri(s.bleed.n) : 0)
    + (s.poison ? t.maxHp * 0.03 * tri(s.poison.n) : 0) + (s.doom ? (s.doom.v || 10) * s.doom.n : 0));
}

/** Coming due: everything waiting on t happens now. Damage and Regen over time land in one go, its timers go off, and its timed marks that end with an effect end. */
export function comeDue(b: Battle, src: Fighter | null, t: Fighter): void {
  if (t.ko || t.gone || fogged(b, src, t)) return;
  msg(b, `Everything on ${label(b, t)} comes due.`);
  const info = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: !isOut(b, t) });
  const s = t.s, tri = (n: number) => n * (n + 1) / 2;
  const { burn, bleed, poison, regen, doom } = s;
  delete s.burn; delete s.bleed; delete s.poison; delete s.regen;
  if (burn) dealDamage(b, null, t, (burn.v || 10) * burn.n, info('M'), null);
  if (!t.ko && bleed) dealDamage(b, null, t, (bleed.v || 5) * tri(bleed.n), info('P'), null);
  if (!t.ko && poison) dealDamage(b, null, t, t.maxHp * 0.03 * tri(poison.n), info('T'), null);
  // Doom still blocks the Regen that comes due with it.
  if (!t.ko && regen) heal(b, null, t, t.maxHp * (regen.v || 0.06) * regen.n);
  if (!t.ko && doom) { delete s.doom; dealDamage(b, null, t, (doom.v || 10) * doom.n, info('M'), null); }
  if (!t.ko && t.k.tick !== undefined && t.k.tick > 0) {
    delete t.k.tick;
    msg(b, `The timer on ${label(b, t)} goes off.`);
    dealDamage(b, null, t, t.k.tickDmg || 40, info('M'), null);
    if (!t.ko) applyStatus(b, null, t, 'stun', 1);
  }
  if (!t.ko && t.k.badnews !== undefined && t.k.badnews > 0) {
    delete t.k.badnews;
    msg(b, `Bad news reaches ${label(b, t)}.`);
    dealDamage(b, null, t, t.k.badnewsDmg || 40, info('M'), null);
  }
  for (const id of Object.keys(t.m)) {
    const mk = t.m[id], def = MARKS[id];
    if (t.ko || !mk || !def?.expire || mk.t < 0 || def.orbit) continue;
    delete t.m[id];
    def.expire(b, t, mk);
  }
}

/** The statuses a foe cannot put on a whorl while its poise holds. Delays fail too. */
export const POISE_STOPS = ['stun', 'sleep', 'root', 'slow'];

/** Adds poise of `share` of f's max HP, up to `cap` of it. */
export function addPoise(b: Battle, f: Fighter, share: number, cap = 1): void {
  if (f.ko || f.gone || share <= 0) return;
  const was = f.poise || 0;
  f.poise = Math.max(was, Math.min(Math.round(f.maxHp * cap), was + Math.round(f.maxHp * share)));
  if (f.poise > was) msg(b, `${label(b, f)} rolls with ${f.poise} poise.`);
}

/** A hit wears f's poise down by its damage. When the poise breaks, f is Stunned 1. */
function wearPoise(b: Battle, src: Fighter | null, f: Fighter, amt: number): void {
  if (!f.poise || amt <= 0) return;
  f.poise -= amt;
  if (f.poise > 0) return;
  f.poise = 0;
  msg(b, `${label(b, f)}'s poise breaks.`);
  applyStatus(b, src, f, 'stun', 1);
}

/** Above 0 while a drawn status lands, so a draw never draws again. */
let drawing = 0;
/** Above 0 while watchers hear a status land, so a status they set off in turn is not heard again. */
let watching = 0;

/** The whorl that draws a status meant for t into itself: out on the other side from src, not t, and with a hook that says so. */
function drawer(b: Battle, src: Fighter, t: Fighter, id: string): Fighter | null {
  const w = out(b, (1 - src.side) as 0 | 1);
  if (!w || w === t || w.ko || w.gone) return null;
  return hears(b, w, src) && hooks(w).some(h => h.drawStatus?.(b, w, src, t, id)) ? w : null;
}

export function applyStatus(b: Battle, src: Fighter | null, t: Fighter, id: string, n: number, v?: number): boolean {
  if (t.ko || t.gone || fogged(b, src, t)) return false;
  const sink = src && !drawing ? drawer(b, src, t, id) : null;
  if (sink) {
    drawing++;
    try { msg(b, `${label(b, sink)} draws it in.`); return applyStatus(b, src, sink, id, n, v); } finally { drawing--; }
  }
  // An action aimed at a summon spends its statuses on the summon, which carries none.
  if (b.aim && src && src.side === b.aim.side && t.side !== src.side) return false;
  if (immuneTo(b, t, id)) {
    if (!b.quiet && (CC as string[]).includes(id)) msg(b, `${label(b, t)} isn't ${STATUS_NAME[id] || id}.`);
    return false;
  }
  // One guard for Hidden and Untouchable: through the turn after either ends, the whorl can go into neither.
  if (id === 'invuln' && (t.m.seen || t.s.revealed)) {
    if (!b.quiet) msg(b, `${label(b, t)} can't become untouchable yet.`);
    return false;
  }
  if (id === 'hidden' && (t.s.hidden || t.s.revealed || t.m.seen)) {
    if (!b.quiet) msg(b, t.s.hidden ? `${label(b, t)} is already hidden.` : `${label(b, t)} can't hide yet.`);
    return false;
  }
  const fromFoe = !src || src.side !== t.side;
  if (fromFoe && t.poise && POISE_STOPS.includes(id)) { msg(b, `${label(b, t)} rolls on through it.`); return false; }
  if (fromFoe && turnLossBlocked(b, t, id)) return false;
  const sid = id as StatusId;
  if (src && src.side !== t.side && src.mon.notion === 'glassbead' && !src.k.bead && (NEGATIVE as string[]).includes(id)) { src.k.bead = 1; n += 1; }
  if (src && id === 'silence' && has(src, 'wail')) n += 1;
  if (src && id === 'taunt' && has(src, 'standing')) n += 1;
  const cur = t.s[sid];
  if ((STACKING as string[]).includes(id)) {
    const cap = id === 'poison' ? 8 : 10;
    t.s[sid] = { n: Math.min(cap, (cur?.n || 0) + n), v: Math.max(cur?.v || 0, v || 0) };
  } else if (id === 'ward') {
    // A ward lasts until it blocks something or until the end of its holder's second turn.
    t.s.ward = { n: (cur?.n || 0) + n, v: 2, src: b.acting === t.side && isOut(b, t) ? t.turns : -1 };
  } else if ((PACE as string[]).includes(id)) {
    // v is 1 once the turn the whorl is waiting for has been moved.
    t.s[sid] = { n: Math.max(cur?.n || 0, n), v: cur?.v === 1 ? 1 : 0, src: -1 };
    paceNow(b, t, id as 'slow' | 'haste');
  } else {
    const mine = b.acting === t.side && isOut(b, t);
    t.s[sid] = { n: Math.max(cur?.n || 0, n), v: Math.max(cur?.v || 0, v || 0), src: id === 'invuln' && cur ? cur.src : mine ? t.turns : -1 };
  }
  if (id === 'taunt' && src) t.k.tauntBy = src.side;
  emit(b, { e: 'status', ...seat(t), id });
  if ((INTERRUPTS as string[]).includes(id)) { interrupt(b, t, src); endChannel(b, t); }
  if (fromFoe && LOSS_NAME[id]) mark(b, null, t, steadyId(id));
  if (id === 'stun' && src) {
    if (has(src, 'trample')) trample(b, src);
  }
  if (src) for (const h of hooks(src)) h.afterApply?.(b, src, t, id);
  if (!t.ko && hears(b, t, src)) for (const h of hooks(t)) h.afterGet?.(b, t, src, id);
  if (!watching) {
    watching++;
    try { for (const w of everyone(b)) if (w !== t && !w.ko && hears(b, w, src)) for (const h of hooks(w)) h.anyStatus?.(b, w, src, t, id); } finally { watching--; }
  }
  return true;
}

// ---------------------------------------------------------------- marks

/**
 * Lost turns never chain. A foe's effect that costs a whorl a turn tags it steady with that effect, and the same effect cannot
 * land again until the whorl acts. One other effect can, and then nothing more lands until both are over. The whorl then
 * turns stalwart, and for 2 of its turns nothing can cost it a turn.
 */
const LOSS_NAME: Record<string, string> = { stun: 'Stun', sleep: 'Sleep', stasis: 'Stasis', skip: 'a forced skip', switch: 'a forced switch' };
const LOSSES = Object.keys(LOSS_NAME);
const steadyId = (id: string): string => `steady_${id}`;
const STALWART = 'stalwart';
for (const id of LOSSES) {
  defMark({ id: steadyId(id), name: `steady: ${id}`, color: '#e0d8a0',
    text: `It lost a turn to ${LOSS_NAME[id]}, which cannot land on it again until it acts. One other effect can.` });
}
defMark({ id: STALWART, name: 'stalwart', color: '#f0c060', text: 'Nothing can cost it a turn. Lasts 2 of its turns.' });

/** How many effects have tagged t steady since it last acted. */
const steadyTags = (t: Fighter): number => LOSSES.filter(id => t.m[steadyId(id)]).length;

/** True when a foe's effect that costs a turn cannot land on t now. Says why unless the battle is quiet. */
function turnLossBlocked(b: Battle, t: Fighter, id: string): boolean {
  if (!LOSS_NAME[id]) return false;
  const why = t.m[STALWART] ? 'is stalwart' : t.m[steadyId(id)] ? `is steady against ${LOSS_NAME[id]}` : steadyTags(t) >= 2 ? 'has lost turns to two effects already' : '';
  if (why && !b.quiet) msg(b, `${label(b, t)} ${why}.`);
  return !!why;
}

/** At the start of f's turn: once both effects of a chain are over, f turns stalwart for this turn and the next. */
function turnRelief(b: Battle, f: Fighter): void {
  if (steadyTags(f) < 2 || f.s.stun || f.s.sleep || f.s.stasis || f.forced?.k === 'skip' || f.forced?.k === 'switch') return;
  for (const id of LOSSES) unmark(f, steadyId(id));
  mark(b, null, f, STALWART, 1, -1, 2);
  if (!b.quiet) msg(b, `${label(b, f)} is stalwart.`);
}

/** Adds stacks of a kit mark. Refreshes its turns to the longer of old and new. */
export function mark(b: Battle, src: Fighter | null, t: Fighter, id: string, n = 1, turns = -1, v = 0): boolean {
  const def = MARKS[id];
  if (!def) throw new Error(`unknown mark ${id}`);
  if (t.ko || t.gone || fogged(b, src, t)) return false;
  const cur = t.m[id];
  const max = def.max ?? 99;
  const t2 = cur ? (cur.t < 0 || turns < 0 ? -1 : Math.max(cur.t, turns)) : turns;
  t.m[id] = { n: Math.min(max, (cur?.n || 0) + n), v: v || cur?.v || 0, t: t2, by: src ? src.side * 8 + src.idx : -1, at: b.turnNo };
  if (def.name && !b.quiet) emit(b, { e: 'status', ...seat(t), id });
  return true;
}

/** Stacks of a mark on t, or 0. */
export function marked(t: Fighter, id: string): number {
  return t.m[id]?.n || 0;
}

/** Removes a mark without firing its expire hook. */
export function unmark(t: Fighter, id: string): MarkVal | undefined {
  const mk = t.m[id];
  delete t.m[id];
  return mk;
}

/** The fighter that placed a mark, if it is still in the battle. */
export function markedBy(b: Battle, mk: MarkVal): Fighter | null {
  if (mk.by < 0) return null;
  return b.s[mk.by >= 8 ? 1 : 0].f[mk.by % 8] || null;
}

function tickMarks(b: Battle, f: Fighter, clocks: string[]): void {
  if (f.stored) return;
  const keep = cured(f);
  for (const id of Object.keys(f.m)) {
    const mk = f.m[id];
    const def = MARKS[id];
    if (!mk || !def || mk.t < 0 || mk.at === b.turnNo || (keep && !def.preserves) || def.orbit) continue;
    if (!clocks.includes(def.clock || 'own')) continue;
    mk.t--;
    if (mk.t <= 0) {
      delete f.m[id];
      def.expire?.(b, f, mk);
    }
  }
}

/** Moves each orbiting mark that `side` set one whorl along its holder's line, wrapping round. A mark set this turn waits unless `force`. */
export function stepOrbits(b: Battle, side: 0 | 1, force = false): void {
  const moving: { w: Fighter; id: string }[] = [];
  for (const sd of [0, 1] as const) for (const w of b.s[sd].f) for (const id of Object.keys(w.m)) {
    const mk = w.m[id];
    if (MARKS[id]?.orbit && mk.by >= 0 && (mk.by >= 8 ? 1 : 0) === side && (force || mk.at !== b.turnNo)) moving.push({ w, id });
  }
  for (const { w, id } of moving) {
    const mk = w.m[id], def = MARKS[id];
    if (!mk || b.over !== null) continue;
    const setter = markedBy(b, mk);
    const line = b.s[w.side].f.filter(x => !x.ko && !x.gone && (x === w || !fogged(b, setter, x)));
    if (!line.length) continue;
    delete w.m[id];
    const to = line.find(x => x.idx > w.idx) || line[0];
    const cur = to.m[id];
    const t = mk.t > 0 ? mk.t - 1 : mk.t;
    to.m[id] = { ...mk, n: Math.min(def.max ?? 99, (cur?.n || 0) + mk.n), t: cur && (cur.t < 0 || cur.t > t) ? cur.t : t };
    if (def.name && !b.quiet) emit(b, { e: 'status', ...seat(to), id });
    def.arrive?.(b, to, to.m[id]);
    const now = to.m[id];
    if (now && now.t === 0) { delete to.m[id]; def.expire?.(b, to, now); }
  }
}

// ---------------------------------------------------------------- move swaps

/** Puts another move in a slot for the rest of this battle. The slot keeps its cooldown. A move f spent for good comes as its next. */
export function setMove(b: Battle, f: Fighter, slot: number, id: string): void {
  if (!MOVES[id] || slot < 0 || slot >= f.moves.length) return;
  f.moves[slot] = f.spent?.includes(id) && MOVES[MOVES[id].next || ''] ? MOVES[id].next! : id;
}

/** Restores the slough's own moves. A move it spent for good stays replaced. */
export function resetMoves(f: Fighter): void {
  f.moves = f.mon.moves.slice();
  if (f.keepsake) f.moves.push(f.keepsake);
  holdSpent(f);
}

/** Puts the `next` of each move f spent for good into that move's slot. */
function holdSpent(f: Fighter): void {
  for (const id of f.spent || []) {
    const k = f.moves.indexOf(id), to = MOVES[id]?.next;
    if (k >= 0 && to && MOVES[to]) f.moves[k] = to;
  }
}

/** Spends f's move `id` for good when it is a `once` move f holds: its slot takes the move's `next` for the rest of the battle. */
export function spendMove(f: Fighter, id: string): void {
  const m = MOVES[id];
  if (!m?.once || !m.next || !f.moves.includes(id)) return;
  if (!(f.spent ||= []).includes(id)) f.spent.push(id);
  holdSpent(f);
}

/** Keeps move `id` for the rest of the battle in a fifth slot after f's own four, ready now. A newer keepsake takes the old one's place. */
export function keepMove(b: Battle, f: Fighter, id: string): boolean {
  const m = MOVES[id];
  if (!m || m.nerve || f.ko || f.gone || f.mon.moves.includes(id)) return false;
  const slot = f.mon.moves.length;
  f.keepsake = id;
  f.moves[slot] = id;
  f.cd[slot] = 0;
  msg(b, `${label(b, f)} keeps ${m.name} in a fifth slot.`);
  return true;
}

// ---------------------------------------------------------------- toolkit: borrowed moves, locks, types, stats, fields, channels, rounds

/** Puts a move in t's slot for `turns` of t's own turns, then gives its own move back. Leaving the field gives it back too. */
export function swapMoveFor(b: Battle, t: Fighter, slot: number, id: string, turns: number): void {
  if (!MOVES[id] || slot < 0 || slot >= t.moves.length || t.ko || t.gone || turns <= 0) return;
  const src = b.acting === t.side && isOut(b, t) ? t.turns : -1;
  const held = (t.tmp ||= []).find(x => x.slot === slot);
  if (held) { held.turns = Math.max(held.turns, turns); held.src = src; } else t.tmp.push({ slot, back: t.moves[slot], turns, src });
  t.moves[slot] = id;
}

/** Locks one of t's move slots for `turns` of its own turns. */
export function lockMove(b: Battle, t: Fighter, slot: number, turns: number): void {
  if (slot < 0 || slot >= t.moves.length || t.ko || t.gone || turns <= 0) return;
  const locks = (t.locks && t.locks.length ? t.locks : (t.locks = t.moves.map(() => 0)));
  locks[slot] = Math.max(locks[slot] || 0, turns);
  msg(b, `${label(b, t)}'s ${MOVES[t.moves[slot]]?.name || 'move'} is locked.`);
}

/** t's types become `types` for `turns` of its own turns, or until it leaves the field. */
export function retype(b: Battle, t: Fighter, types: Type[], turns: number): void {
  if (t.ko || t.gone || !types.length || turns <= 0) return;
  t.retype = { types: types.slice(), turns };
  msg(b, `${label(b, t)} is ${types.join(' and ')} now.`);
}

/** Multiplies the hits, heals, and shields of f's move in a slot by `mul` for its next `uses` uses, or till f leaves the field at 0. */
export function boostMove(b: Battle, f: Fighter, slot: number, mul: number, uses = 0): void {
  if (slot < 0 || slot >= f.moves.length || f.ko || f.gone || mul <= 0 || mul === 1) return;
  (f.boost ||= []).push({ slot, mul, uses: uses > 0 ? uses : -1 });
  msg(b, `${label(b, f)}'s ${MOVES[f.moves[slot]]?.name || 'move'} grows ${mul > 1 ? 'stronger' : 'weaker'}.`);
}

/** What the boosts on f's move slot multiply it by now. */
export function boostOf(f: Fighter, slot: number): number {
  let v = 1;
  for (const x of f.boost || []) if (x.slot === slot) v *= x.mul;
  return v;
}

function spendBoost(f: Fighter, slot: number): void {
  if (!f.boost?.length) return;
  for (const x of f.boost) if (x.slot === slot && x.uses > 0) x.uses--;
  f.boost = f.boost.filter(x => x.uses !== 0);
}

/** f's move in a slot becomes `type` for `turns` of f's own turns, or till f leaves the field at 0. */
export function retypeMove(b: Battle, f: Fighter, slot: number, type: Type, turns = 0): void {
  if (slot < 0 || slot >= f.moves.length || f.ko || f.gone) return;
  const src = b.acting === f.side && isOut(b, f) ? f.turns : -1;
  f.mtype = (f.mtype || []).filter(x => x.slot !== slot);
  f.mtype.push({ slot, type, turns: turns > 0 ? turns : -1, src });
  msg(b, `${label(b, f)}'s ${MOVES[f.moves[slot]]?.name || 'move'} is ${type} now.`);
}

/**
 * Changes the wait on t's move slots by n of t's own turns: longer when n > 0, shorter when n < 0. A ready move then waits n
 * turns. `slot` is one slot, 'all', or 'ready' (only the slots ready now). Returns how many slots changed.
 */
export function shiftCd(b: Battle, t: Fighter, slot: number | 'all' | 'ready', n: number): number {
  if (t.ko || t.gone || !n) return 0;
  const every = t.moves.map((_, i) => i);
  const slots = slot === 'all' ? every : slot === 'ready' ? every.filter(i => t.cd[i] <= 0) : [slot];
  const byFoe = b.acting !== null && b.acting !== t.side;
  let changed = 0;
  for (const i of slots) {
    if (i < 0 || i >= t.cd.length) continue;
    const before = t.cd[i];
    t.cd[i] = n > 0 ? (before > 0 ? before + n : n + 1) : Math.max(0, before + n);
    if (t.cd[i] === before) continue;
    changed++;
    if (n > 0 && byFoe) { const h = (t.cdHit ||= t.moves.map(() => 0)); h[i] = (h[i] || 0) + n; }
  }
  if (changed) {
    const one = slots.length === 1, what = one ? `${label(b, t)}'s ${MOVES[t.moves[slots[0]]]?.name || 'move'}` : `${label(b, t)}'s moves`;
    if (n > 0) msg(b, `${what} wait${one ? 's' : ''} ${n} more turn${n > 1 ? 's' : ''}.`);
    else msg(b, `${what} ${one ? 'is' : 'are'} ready${slots.some(i => t.cd[i] > 0) ? ' sooner' : ''}.`);
  }
  return changed;
}

/** Swaps two of f's stats for the rest of the battle. */
export function swapStats(f: Fighter, a: keyof Stats, z: keyof Stats): void {
  const v = f.st[a];
  f.st[a] = f.st[z];
  f.st[z] = v;
}

/** Lowers t's max HP by a share of it for the battle, never below half its starting max. HP over the new max is lost. */
export function cutMaxHp(b: Battle, t: Fighter, share: number): number {
  if (t.ko || t.gone || share <= 0) return 0;
  const cut = Math.min(Math.round(t.maxHp * share), t.maxHp - Math.round(t.st.hp * 0.5));
  if (cut <= 0) return 0;
  t.maxHp -= cut;
  if (t.hp > t.maxHp) t.hp = t.maxHp;
  msg(b, `${label(b, t)} loses ${cut} max HP.`);
  emit(b, { e: 'heal', ...seat(t), amt: 0 });
  return cut;
}

const GOOD_PASS: StatusId[] = ['empower', 'fortify', 'haste', 'ward', 'regen', 'thorns', 'unstop'];
/** Hands `to` the good statuses and good marks `from` carries. */
export function passOn(b: Battle, from: Fighter, to: Fighter): void {
  for (const id of GOOD_PASS) {
    const v = from.s[id];
    if (v) to.s[id] = { ...v, src: -1, v: (PACE as string[]).includes(id) ? 0 : v.v };
  }
  for (const id of Object.keys(from.m)) {
    const d = MARKS[id];
    if (d && !d.negative && (d.value || 0) > 0) to.m[id] = { ...from.m[id] };
  }
  msg(b, `${label(b, to)} takes on what ${label(b, from)} had.`);
}

/** Drops `id` on the field for `turns` rounds, for either side's out whorl to spend a turn taking. */
export function dropItem(b: Battle, id: string, turns: number): void {
  const d = DROPS[id];
  if (!d || turns <= 0) return;
  (b.drops ||= []).push({ id, uid: b.pid++, turns, at: b.turnNo });
  msg(b, `A ${d.name} drops onto the field.`);
}

/** Lays a field state over the battle for `turns` rounds, replacing any other. Null clears the field. */
export function setField(b: Battle, id: string | null, turns = 5, by: Fighter | null = null): void {
  const def = id ? FIELDS[id] : null;
  if (id && !def) return;
  b.field = def ? { id: def.id, turns, by: by ? by.side : -1, at: b.turnNo } : null;
  for (const s of b.s) for (const f of s.f) f.fld = def ? def.id : null;
  emit(b, { e: 'field', id: def ? def.id : null });
  msg(b, def ? `${def.name} for ${turns} rounds.` : 'The field clears.');
}

/** Spins `side` for its next `turns` turns: after each one, its out whorl goes to the back of the line and the next comes out. */
export function spinSide(b: Battle, side: 0 | 1, turns: number): void {
  if (turns <= 0) return;
  b.s[side].spin = { turns };
  msg(b, `${b.s[side].name}'s side starts to spin.`);
}

/** The end of a spinning side's turn: a whorl that stood its ground or switched by choice stays, and the spin counts down either way. */
function spinOn(b: Battle, side: 0 | 1, f: Fighter, action: string): void {
  const s = b.s[side], sp = s.spin;
  if (!sp) return;
  if (--sp.turns <= 0) s.spin = null;
  if (action !== 'switch' && !f.ko && !f.gone && isOut(b, f)) {
    const to = nextInLine(s);
    if (immovable(f)) msg(b, `${label(b, f)} holds its ground.`);
    else if (to >= 0 && to !== s.out && !turnLossBlocked(b, f, 'switch')) {
      const keep = s.next;
      forcedIn(b, f, s.f[to]);
      doSwitch(b, side, to, true);
      s.next = keep;
      msg(b, `${label(b, f)} goes round, and ${label(b, s.f[to])} comes out.`);
    }
  }
  if (!s.spin) msg(b, `${s.name}'s side stops spinning.`);
}

/**
 * The two sides trade everything on their own side of the field: grounds, summons, Mantles, caps, spins, wedges, prices, and held tide.
 * A twin or a linked summon stays with the whorl it belongs to.
 */
export function swapRooms(b: Battle): void {
  const [x, z] = b.s;
  const t = { ground: x.ground, mantle: x.mantle, caps: x.caps, spin: x.spin, cut: x.cut, price: x.price, fog: x.fog, shut: x.shut };
  x.ground = z.ground; x.mantle = z.mantle; x.caps = z.caps; x.spin = z.spin; x.cut = z.cut; x.price = z.price; x.fog = z.fog; x.shut = z.shut;
  z.ground = t.ground; z.mantle = t.mantle; z.caps = t.caps; z.spin = t.spin; z.cut = t.cut; z.price = t.price; z.fog = t.fog; z.shut = t.shut;
  // A held tide names the side its gains go to, so a traded hold still sends them across.
  const hx = x.hold, hz = z.hold;
  x.hold = hz ? { ...hz, to: 1 } : null;
  z.hold = hx ? { ...hx, to: 0 } : null;
  for (const sd of b.s) for (const f of sd.f) f.gnd = sd.ground ? sd.ground.id : null;
  const moving = (from: Side) => from.sum.filter(u => !u.moves && u.link === undefined);
  const mx = moving(x), mz = moving(z);
  const land = (u: Summon, to: 0 | 1) => {
    const from = b.s[u.side], dest = b.s[to];
    from.sum = from.sum.filter(w => w !== u);
    u.side = to;
    u.by = dest.out;
    dest.sum.push(u);
    for (const p of b.pend) if (p.kind === 'summon' && p.data?.uid === u.uid) p.side = to;
  };
  for (const u of mx) land(u, 1);
  for (const u of mz) land(u, 0);
  for (const sd of b.s) while (sd.sum.length > SUMMON_CAP) dismiss(b, sd.sum[0]);
  msg(b, 'The two rooms trade places.');
}

/** Sends the sea out for `rounds` rounds: Low Water, when a star falls every round and attacks gain no tide. */
export function setLowWater(b: Battle, rounds: number): void {
  if (rounds <= 0) return;
  b.lowWater = { turns: rounds, at: b.turnNo };
  msg(b, 'The sea goes out. Low Water.');
}

/** A star lands on the field: each side gains 2 tide, unless a whorl's hook catches it and its side alone gains 4. `called` counts one a kit called down. */
export function starFall(b: Battle, called = false): void {
  let catcher: Fighter | null = null;
  for (const w of everyone(b)) if (!catcher && hooks(w).some(h => h.catchStar?.(b, w))) catcher = w;
  if (called) b.starsCalled = (b.starsCalled || 0) + 1;
  if (catcher) { msg(b, `A star lands in ${label(b, catcher)}'s keeping.`); addNerve(b, catcher.side, 4); }
  else { msg(b, 'A star lands on the field.'); addNerve(b, 0, 2); addNerve(b, 1, 2); }
  for (const w of everyone(b)) for (const h of hooks(w)) h.starLanded?.(b, w);
}

/** Wedges a whorl between `side`'s out whorl and its bench for `turns` rounds: it cannot switch, and its reserves cannot help it. */
export function wedge(b: Battle, side: 0 | 1, turns: number): void {
  if (turns <= 0) return;
  b.s[side].cut = { turns, at: b.turnNo };
  msg(b, `${b.s[side].name}'s side is cut off from its bench.`);
}

/** Lays a mantle of `hp` over `side` for `turns` rounds, on top of what is left of one already there. */
export function setMantle(b: Battle, side: 0 | 1, hp: number, turns: number): void {
  if (hp <= 0 || turns <= 0) return;
  const old = b.s[side].mantle;
  b.s[side].mantle = { hp: Math.round(hp + (old?.hp || 0)), turns: Math.max(turns, old?.turns || 0), at: b.turnNo };
  msg(b, `A mantle slides over ${b.s[side].name}'s side.`);
}

/** The tide a move costs `f` now: its own cost, changed by any price on f's side, and never below 0. */
export function tideCost(b: Battle, f: Fighter, m: MoveDef): number {
  if (!m.nerve) return 0;
  return Math.max(0, m.nerve + (b.s[f.side].price?.add || 0));
}

/** How much of `side`'s tide is pink: tide it holds that cannot pay for a crest. */
export function pinkOf(b: Battle, side: 0 | 1): number {
  const s = b.s[side];
  return Math.max(0, Math.min(s.pink?.n || 0, s.nerve));
}

/** Turns n more of `side`'s tide pink for `turns` rounds, never more than it holds. The longer of the two clocks stands. */
export function pinkTide(b: Battle, side: 0 | 1, n: number, turns: number): void {
  const s = b.s[side];
  if (!b.rules.nerve || n <= 0 || turns <= 0) return;
  const was = pinkOf(b, side), now = Math.min(s.nerve, was + n);
  if (now <= was) return;
  s.pink = { n: now, turns: Math.max(turns, s.pink?.turns || 0), at: b.turnNo };
  msg(b, `${now - was} of ${s.name}'s tide turns pink.`);
}

/** Lets all of `side`'s pink tide run clear at once. */
export function clearPink(b: Battle, side: 0 | 1): void {
  if (!b.s[side].pink) return;
  b.s[side].pink = null;
  msg(b, `${b.s[side].name}'s tide runs clear.`);
}

/** Changes what every crest on `side` costs by `add` tide for `turns` rounds. A new price takes the place of the old one. */
export function setPrice(b: Battle, side: 0 | 1, add: number, turns: number): void {
  if (!add || turns <= 0) return;
  b.s[side].price = { add, turns, at: b.turnNo };
  msg(b, `${b.s[side].name}'s crests cost ${Math.abs(add)} ${add > 0 ? 'more' : 'less'} tide.`);
}

/** Holds `side`'s tide for `turns` rounds: what it would gain goes to side `to`. */
export function holdTide(b: Battle, side: 0 | 1, to: 0 | 1, turns: number): void {
  if (side === to || turns <= 0) return;
  b.s[side].hold = { to, turns, at: b.turnNo };
  msg(b, `${b.s[side].name}'s tide is nailed in the hold.`);
}

/** Lays ground `id` under `side` for `turns` rounds, replacing what was there. Null clears it. */
export function setGround(b: Battle, side: 0 | 1, id: string | null, turns = 3, by: Fighter | null = null): void {
  const s = b.s[side], def = id ? GROUNDS[id] : null;
  if (id && !def) return;
  const old = s.ground ? GROUNDS[s.ground.id] : null;
  s.ground = def ? { id: def.id, turns, from: by ? by.side : side, by: by ? by.idx : -1, at: b.turnNo } : null;
  for (const f of s.f) f.gnd = def ? def.id : null;
  if (def) msg(b, `The ground under ${s.name}'s side turns to ${def.name}.`);
  else if (old) msg(b, `The ${old.name} under ${s.name}'s side settles.`);
}

/** The whorl that laid the ground under `side`, while it is still standing. */
export function groundBy(b: Battle, side: 0 | 1): Fighter | null {
  const g = b.s[side].ground;
  const f = g && g.by >= 0 ? b.s[g.from].f[g.by] : null;
  return f && !f.ko && !f.gone ? f : null;
}

/** Brings knocked-out `f` back to its side with `share` of its max HP, clean of statuses and marks, with its moves ready. */
export function revive(b: Battle, f: Fighter, share: number): boolean {
  if (!f.ko || f.gone || b.over !== null) return false;
  f.ko = false;
  f.hp = Math.max(1, Math.round(f.maxHp * share));
  f.shield = 0;
  f.s = {};
  f.m = {};
  f.cd = f.cd.map(() => 0);
  b.stats.kos[f.side] = Math.max(0, b.stats.kos[f.side] - 1);
  emit(b, { e: 'rise', ...seat(f), hp: f.hp });
  msg(b, `${label(b, f)} comes back.`);
  return true;
}

/** Starts the battle clock at `at` minutes after midnight, unless it is already running. */
export function startClock(b: Battle, at: number): void {
  if (b.clock == null) b.clock = at;
}

/** Moves the clock to `at`, running every hour it passes, as each turn does. */
export function setClock(b: Battle, at: number): void {
  if (b.clock == null) { b.clock = at; return; }
  const from = Math.floor(b.clock / 60), to = Math.floor(at / 60);
  b.clock = at;
  for (let h = from + 1; h <= to && b.over === null; h++) {
    for (const w of everyone(b)) for (const hk of hooks(w)) hk.atHour?.(b, w, h % 24);
  }
}

/** The field state in play, or null. */
export const fieldOf = (b: Battle) => (b.field ? FIELDS[b.field.id] || null : null);

/** Records the marks that carry a channel f started. A stun, silence, sleep, taunt, knockout, banish, or leaving the field ends them. */
export function startChannel(b: Battle, f: Fighter, parts: { on: Fighter; id: string }[]): void {
  f.chan = [...(f.chan || []), ...parts.map(p => ({ side: p.on.side, idx: p.on.idx, id: p.id }))];
  void b;
}

/** Ends f's channel: every mark that carried it comes off. */
export function endChannel(b: Battle, f: Fighter): void {
  if (!f.chan?.length) return;
  for (const p of f.chan) { const t = b.s[p.side].f[p.idx]; if (t?.m[p.id]) delete t.m[p.id]; }
  f.chan = null;
  msg(b, `${label(b, f)}'s channel breaks.`);
}

/** Above 0 while a drunk heal lands on its drinker, so the drinker's own heal is never drunk in turn. */
let drinkingFrom = 0;

/** The most HP `side`'s house can hold: the largest any of its standing whorls keeps, or 0 when it has no house. */
export function houseCap(b: Battle, side: 0 | 1): number {
  let n = 0;
  for (const f of b.s[side].f) if (!f.ko && !f.gone) for (const h of hooks(f)) n = Math.max(n, h.pools?.(b, f) || 0);
  return Math.round(n);
}

/** Pours a heal's overflow into `side`'s house, up to what the house can hold. */
function pourHouse(b: Battle, side: 0 | 1, amt: number): void {
  const cap = houseCap(b, side);
  if (cap <= 0 || amt <= 0) return;
  const s = b.s[side];
  s.pool = Math.min(cap, (s.pool || 0) + Math.round(amt));
}

/** What f foretells: the effects it will set off on its own, next first, or an empty list. */
export function foretold(b: Battle, f: Fighter): { name: string; color: string; text: string }[] {
  for (const h of hooks(f)) { const l = h.foretell?.(b, f); if (l && l.length) return l; }
  return [];
}

/** The reserves of `side` that watch over its out whorl, while its bench is not cut off. */
export function watchers(b: Battle, side: 0 | 1): Fighter[] {
  if (b.s[side].cut) return [];
  return reserves(b.s[side]).filter(r => hooks(r).some(h => !!h.watchOver));
}

/** The other side's out whorl when it would drink the heals meant for t, or null. */
export function drinkerOf(b: Battle, t: Fighter): Fighter | null {
  const w = b.s[1 - t.side].f[b.s[1 - t.side].out];
  return w && w !== t && !w.ko && !w.gone && !t.ko && hooks(w).some(h => h.drinks?.(b, w, t)) ? w : null;
}

/** Whether `side` sees the other side's choice in a joint round before choosing: its out whorl foresees and the foe's does not. */
export function foresees(b: Battle, side: 0 | 1): boolean {
  const sees = (s: 0 | 1) => { const f = out(b, s); return !!f && !f.ko && !f.gone && hooks(f).some(h => h.foresee?.(b, f)); };
  return sees(side) && !sees((1 - side) as 0 | 1);
}

/** The action f's foe chose this round, or null in a solo turn. Moves read it to punish a guard, a switch, or a crest. */
export function foeChoice(b: Battle, f: Fighter): Action | null {
  return b.rnd?.joint ? b.rnd.commits[1 - f.side] : null;
}

/** True while f's foe has not acted yet this round, and always in a solo turn. */
export function goesFirst(b: Battle, f: Fighter): boolean {
  return !b.rnd?.joint || !b.rnd.done[1 - f.side];
}

/** True once f's foe has acted this round. */
export function foeActed(b: Battle, f: Fighter): boolean {
  return !!b.rnd?.joint && b.rnd.done[1 - f.side];
}

/** True when f took a hit this round. */
export function hitThisRound(b: Battle, f: Fighter): boolean {
  return !!b.rnd && f.k.hitRound === b.rnd.n;
}

/** A dash moves its user in: it takes less damage until its next turn. */
function dashIn(b: Battle, f: Fighter, m: MoveDef): void {
  if (!m.tags?.includes('dash') || f.ko || f.gone) return;
  f.s.dashing = { n: 1, src: f.turns };
  emit(b, { e: 'status', ...seat(f), id: 'dashing' });
}

/** A move with `next` hands its slot to the next move once it has been used. */
function chainOn(b: Battle, f: Fighter, m: MoveDef): void {
  if (!m.next || f.ko) return;
  if (m.once) { spendMove(f, m.id); return; }
  const k = f.moves.indexOf(m.id);
  if (k >= 0) setMove(b, f, k, m.next);
}

/** Borrowed moves, locks, and a changed type count down by the holder's own turns. */
function tickHeld(f: Fighter): void {
  if (f.tmp?.length) {
    for (const x of f.tmp) if (x.src !== f.turns && --x.turns <= 0) f.moves[x.slot] = x.back;
    f.tmp = f.tmp.filter(x => x.turns > 0);
  }
  if (f.locks?.length) f.locks = f.locks.map(n => Math.max(0, n - 1));
  if (f.spore?.length) f.spore = f.spore.map(n => Math.max(0, n - 1));
  if (f.retype && --f.retype.turns <= 0) f.retype = null;
  if (f.lent?.length) { for (const x of f.lent) x.turns--; f.lent = f.lent.filter(x => x.turns > 0); }
  if (f.mtype?.length) {
    for (const x of f.mtype) if (x.turns > 0 && x.src !== f.turns) x.turns--;
    f.mtype = f.mtype.filter(x => x.turns !== 0);
  }
}

export function trample(b: Battle, f: Fighter): void {
  heal(b, f, f, f.maxHp * 0.06);
  for (const r of reserves(b.s[f.side])) heal(b, f, r, r.maxHp * 0.03);
}

export function interrupt(b: Battle, t: Fighter, by: Fighter | null): boolean {
  const before = b.pend.length;
  const hit = b.pend.filter(p => p.kind === 'windup' && p.side === t.side && p.idx === t.idx && !p.unstop);
  if (!hit.length) return false;
  b.pend = b.pend.filter(p => !hit.includes(p));
  emit(b, { e: 'cut', ...seat(t) });
  msg(b, `${MOVES[hit[0].move]?.name || 'The wind-up'} is cut off.`);
  b.stats.interrupts++;
  return before !== b.pend.length;
}

/** Depth of heals being turned into burns. */
let burning = 0;

export function heal(b: Battle, src: Fighter | null, t: Fighter, amt: number): number {
  if (!t || t.ko || t.gone || amt <= 0) return 0;
  // Drink: the other side's out whorl may take a heal meant for t in its place, once, so two drinkers cannot pass it back.
  const w = drinkingFrom ? null : b.s[1 - t.side].f[b.s[1 - t.side].out];
  if (w && w !== t && !w.ko && !w.gone && hooks(w).some(h => h.drinks?.(b, w, t))) {
    msg(b, `${label(b, w)} drinks the heal meant for ${label(b, t)}.`);
    drinkingFrom++;
    try { return heal(b, src, w, amt); } finally { drinkingFrom--; }
  }
  if (t.s.doom) return 0;
  let a = amt;
  if (src) for (const h of hooks(src)) if (h.healMul) a *= h.healMul(b, src, t);
  if (t.s.rot && !has(t, 'clot')) a *= 0.5;
  for (const h of hooks(t)) if (h.healIn) a *= h.healIn(b, t, src);
  // A heal turned below zero burns instead. A heal set off by that burn does nothing, so a hook that turns damage into healing cannot loop.
  if (a < 0) {
    if (burning) return 0;
    burning++;
    try {
      msg(b, `The heal burns ${label(b, t)}.`);
      dealDamage(b, null, t, -a, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: !isOut(b, t) }, null);
    } finally { burning--; }
    return 0;
  }
  a = Math.round(a);
  // A fracture stops heals at its line.
  const room = Math.max(0, (t.fracture ? Math.round(t.maxHp * t.fracture.cap) : t.maxHp) - t.hp);
  const got = Math.min(room, a);
  t.hp += got;
  if (got > 0) emit(b, { e: 'heal', ...seat(t), amt: got });
  if (a > got) pourHouse(b, t.side, a - got);
  if (src) for (const h of hooks(src)) h.afterHeal?.(b, src, t, got, a - got);
  return got;
}

export function giveShield(b: Battle, src: Fighter | null, t: Fighter, amt: number, turns: number): void {
  if (t.ko || t.gone || amt <= 0) return;
  if (src && has(src, 'grace')) turns += 1;
  t.shield += Math.round(amt);
  t.shieldTurns = Math.max(t.shieldTurns, turns);
  t.k.shieldSet = b.acting === t.side && isOut(b, t) ? t.turns : -1;
  emit(b, { e: 'shield', ...seat(t), amt: Math.round(amt) });
}

export function cleanse(b: Battle, t: Fighter, max = 99): number {
  let n = 0;
  for (const id of NEGATIVE) {
    if (n >= max) break;
    if (t.s[id]) { delete t.s[id]; n++; }
  }
  for (const id of Object.keys(t.m)) {
    if (n >= max) break;
    if (MARKS[id]?.negative) { delete t.m[id]; MARKS[id].leave?.(b, t); n++; }
  }
  if (n) msg(b, `${label(b, t)} shakes it off.`);
  return n;
}

export function negatives(t: Fighter): number {
  return NEGATIVE.filter(id => t.s[id]).length + Object.keys(t.m).filter(id => MARKS[id]?.negative).length;
}

export function delayFighter(b: Battle, t: Fighter, n: number): void {
  if (!isOut(b, t) || n <= 0) return;
  if (t.s.unstop || t.s.stasis || t.poise) return;
  if (hooks(t).some(h => h.noDelay?.(t))) return;
  shiftTurn(b, t.side, n);
}

export function hastenFighter(b: Battle, t: Fighter, n: number): void {
  if (n <= 0 || t.ko) return;
  if (!isOut(b, t)) { t.k.firstBonus = (t.k.firstBonus || 0) + n; return; }
  if (b.acting === t.side) { t.k.hastenAfter = (t.k.hastenAfter || 0) + n; return; }
  shiftTurn(b, t.side, -n);
}

// ---------------------------------------------------------------- switching

function clearVolatile(f: Fighter): void {
  for (const id of VOLATILE) delete f.s[id];
  for (const id of Object.keys(f.m)) if (MARKS[id]?.volatile) delete f.m[id];
  // Borrowed moves go back, locks lift, and changed types and move boosts wear off when a whorl leaves the field.
  for (const x of f.tmp || []) f.moves[x.slot] = x.back;
  f.tmp = []; f.locks = []; f.spore = []; f.retype = null; f.boost = []; f.mtype = []; f.reach = null; f.lent = []; f.up = 0; f.takeIn = null; f.flock = null; f.poise = 0; f.mirage = null; f.wait = null;
}

export function comeOut(b: Battle, f: Fighter, start = false): void {
  f.outAt = start ? -1 : b.t;
  f.stored = null;
  f.k.fresh = 1;
  f.k.ribFirst = start ? 1 : 0;
  if (!start) emit(b, { e: 'out', ...seat(f) });
  const s = b.s[f.side];
  const bonus = sk(b, f.side);
  if (bonus.wardNext) { applyStatus(b, null, f, 'ward', 1); bonus.wardNext = 0; }
  if (bonus.healNext) { heal(b, null, f, f.maxHp * 0.2); bonus.healNext = 0; }
  if (bonus.hasteNext) { applyStatus(b, null, f, 'haste', 1); bonus.hasteNext = 0; }
  if (bonus.poisonNext) { applyStatus(b, null, f, 'poison', bonus.poisonNext); bonus.poisonNext = 0; }
  if (bonus.bonusNext) { f.k.firstBonus = (f.k.firstBonus || 0) + bonus.bonusNext; bonus.bonusNext = 0; }
  if (!start) landSticky(b, f);
  // A house drinks: the whorl coming out takes what the house holds, and what it cannot use pours back in.
  if (!start && s.pool && s.pool > 0 && !f.s.doom && houseCap(b, f.side) > 0) {
    const p = s.pool;
    s.pool = 0;
    const got = heal(b, null, f, p);
    if (got > 0) msg(b, `${label(b, f)} drinks ${got} from the house.`);
  }
  for (const h of hooks(f)) h.comeOut?.(b, f);
  if (!start) for (const w of everyone(b)) if (!f.ko && hears(b, w, f)) for (const h of hooks(w)) h.anyOut?.(b, w, f);
  if (!start) for (const u of b.s[1 - f.side].sum.slice()) { const d = SUMMONS[u.def]; if (d?.trap && !f.ko && d.trap(b, u, f)) dismiss(b, u); }
  if (s.caps > 0 && !start) {
    s.caps--;
    const power = bonus.capMgk || 40;
    msg(b, `A cap goes off under ${label(b, f)}.`);
    dealDamage(b, null, f, power * 0.9, { kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
    applyStatus(b, null, f, 'poison', 2);
  }
}

export function canGuard(f: Fighter, b?: Battle): boolean {
  if (b && forbidden(b, f, 'guard')) return false;
  return !f.k.guardedLast;
}

export function canSwitch(b: Battle, f: Fighter): boolean {
  if (inBout(b, f)) return false;
  if (f.s.root && !f.s.unstop) return false;
  if (f.s.taunt && !f.s.unstop) return false;
  if (forbidden(b, f, 'switch')) return false;
  if (b.s[f.side].cut) return false;
  return reserves(b.s[f.side]).some(r => !barred(r));
}

/** The reserve its side must send out next, if a mark calls one. */
export function calledOf(s: Side): Fighter | null {
  for (const f of reserves(s)) if (!barred(f) && Object.keys(f.m).some(id => MARKS[id]?.calls)) return f;
  return null;
}

/** A reserve that may not come out now, such as a buried one. */
export function barred(f: Fighter): boolean {
  return !!f.stored || hooks(f).some(h => h.barred?.(f));
}

export function doSwitch(b: Battle, side: 0 | 1, to: number, forced = false): void {
  const s = b.s[side];
  const old = s.f[s.out];
  b.range = null;
  if (!old.ko) {
    b.pend = b.pend.filter(p => !(p.kind === 'windup' && p.side === side && p.idx === old.idx));
    endChannel(b, old);
    // Leave hooks run before volatile marks clear so a volatile mark's own leave hook can end its form (Make a Frog).
    for (const w of everyone(b)) if (w !== old && !w.ko && hears(b, w, old)) for (const h of hooks(w)) h.anyLeave?.(b, w, old);
    for (const h of hooks(old)) h.leave?.(b, old);
    endSwap(b, old);
    carrySticky(b, old);
    clearVolatile(old);
    old.disguise = null;
  }
  s.out = to;
  const nf = s.f[to];
  if (!forced) msg(b, `${s.name} sends out ${label(b, nf)}.`);
  b.stats.switches++;
  comeOut(b, nf);
}

/** Next standing reserve after the out slough, in line order. A barred reserve comes only when no other can. */
export function nextInLine(s: Side): number {
  const cl = calledOf(s);
  if (cl) return cl.idx;
  let held = -1;
  for (let k = 1; k < s.f.length; k++) {
    const i = (s.out + k) % s.f.length;
    if (s.f[i].ko || s.f[i].gone) continue;
    if (!barred(s.f[i])) return i;
    if (held < 0) held = i;
  }
  return held;
}

export function immovable(f: Fighter): boolean {
  if (f.s.unstop || f.s.guard || f.s.stasis) return true;
  return hooks(f).some(h => h.immovable?.(f));
}

function applyFirstBonus(b: Battle, f: Fighter): void {
  if (!f.k.firstBonus) return;
  const s = b.s[f.side];
  s.next = Math.max(b.t + 1, s.next - f.k.firstBonus);
  f.k.firstBonus = 0;
}

export function forceOut(b: Battle, by: Fighter, side: 0 | 1): boolean {
  const s = b.s[side];
  const t = s.f[s.out];
  if (immovable(t)) { msg(b, `${label(b, t)} holds its ground.`); return false; }
  const foe = by.side !== side;
  if (foe && turnLossBlocked(b, t, 'switch')) return false;
  const to = nextInLine(s);
  if (to < 0) return false;
  interrupt(b, t, by);
  const keepNext = s.next;
  if (foe) forcedIn(b, t, s.f[to]);
  doSwitch(b, side, to, true);
  msg(b, `${label(b, t)} is forced out. ${label(b, s.f[to])} comes out.`);
  spoon(b, t); spoon(b, s.f[to]);
  s.next = keepNext;
  applyFirstBonus(b, s.f[to]);
  if (has(by, 'turnabout')) giveShield(b, by, by, by.maxHp * 0.12, 3);
  if (has(by, 'trample')) trample(b, by);
  return true;
}

/** The Rider Spoon: a whorl moved by a foe's force out or drag in gets Ward 1. */
function spoon(b: Battle, f: Fighter): void {
  if (f.mon.notion === 'riderspoon' && !f.ko) applyStatus(b, null, f, 'ward', 1);
}

export function dragIn(b: Battle, by: Fighter, side: 0 | 1, idx: number): boolean {
  const s = b.s[side];
  if (idx === s.out || idx < 0 || idx >= s.f.length) return false;
  const nf = s.f[idx];
  const cur = s.f[s.out];
  if (nf.ko || nf.gone) return false;
  if (fogged(b, by, nf)) { msg(b, nf.stored ? `${label(b, nf)} is in cold storage.` : `The fog hides ${label(b, nf)}.`); return false; }
  if (immovable(cur) && cur.s.guard) { msg(b, `${label(b, cur)} holds its ground.`); return false; }
  if (hooks(nf).some(h => h.immovable?.(nf))) { msg(b, `${label(b, nf)} won't come.`); return false; }
  const foe = by.side !== side;
  if (foe && (turnLossBlocked(b, cur, 'switch') || turnLossBlocked(b, nf, 'switch'))) return false;
  interrupt(b, cur, by);
  const keepNext = s.next;
  if (foe) forcedIn(b, cur, nf);
  doSwitch(b, side, idx, true);
  msg(b, `${label(b, nf)} is dragged out.`);
  spoon(b, cur); spoon(b, nf);
  s.next = keepNext;
  applyFirstBonus(b, nf);
  if (has(by, 'turnabout')) giveShield(b, by, by, by.maxHp * 0.12, 3);
  return true;
}

// ---------------------------------------------------------------- moves

export function moveDef(f: Fighter, i: number): MoveDef | null {
  return MOVES[f.moves[i]] || null;
}

/** The reason a kit hook forbids this action, or null. */
export function forbidden(b: Battle, f: Fighter, what: 'attack' | 'guard' | 'switch' | MoveDef): string | null {
  for (const h of hooks(f)) {
    const why = h.forbid?.(b, f, what);
    if (why) return why;
  }
  return null;
}

export function isBig(m: MoveDef): boolean {
  return (m.nerve || 0) > 0;
}

/** The HP f pays to use move slot i while it still cools down, through an overdrive hook, or 0 when it cannot. Crests never overdrive. */
export function overdriveCost(b: Battle, f: Fighter, i: number): number {
  const m = moveDef(f, i);
  if (!m || f.cd[i] <= 0 || m.nerve) return 0;
  let share = 0;
  for (const h of hooks(f)) share = Math.max(share, h.overdrive?.(b, f, m) || 0);
  const cost = Math.round(f.maxHp * share * f.cd[i]);
  return share > 0 && f.hp > cost ? cost : 0;
}

export function usable(b: Battle, f: Fighter, i: number): { ok: boolean; why: string } {
  const m = moveDef(f, i);
  if (!m) return { ok: false, why: '' };
  // Silence stops spells and Root stops dashes. Every other kind of move still works.
  if (f.s.silence && (m.tags?.includes('spell') || m.tags?.includes('sound')) && !hooks(f).some(h => h.statusImmune?.(f, 'silence'))) return { ok: false, why: 'Silenced.' };
  if (f.s.root && !f.s.unstop && m.tags?.includes('dash')) return { ok: false, why: 'Rooted.' };
  if (f.s.doom) return { ok: false, why: 'Doomed.' };
  if (f.s.taunt) return { ok: false, why: 'Taunted.' };
  if ((f.locks?.[i] || 0) > 0) return { ok: false, why: `Locked for ${f.locks![i]} more turn${f.locks![i] > 1 ? 's' : ''}.` };
  if (f.cd[i] > 0 && !overdriveCost(b, f, i)) return { ok: false, why: `${f.cd[i]} more turn${f.cd[i] > 1 ? 's' : ''}.` };
  const no = forbidden(b, f, m);
  if (no) return { ok: false, why: no };
  if (m.rewinds && pastDepth) return { ok: false, why: 'Not while the past plays again.' };
  if (m.nerve) {
    if (!b.rules.nerve) return { ok: false, why: 'Crests come later.' };
    const owe = creditOf(b, f.side);
    if (b.s[f.side].nerve + owe < tideCost(b, f, m)) return { ok: false, why: 'Not enough tide.' };
    if (b.s[f.side].nerve - pinkOf(b, f.side) + owe < tideCost(b, f, m)) return { ok: false, why: 'Not enough clear tide.' };
  }
  if (m.reach === 'reserveAlly' && reserves(b.s[f.side]).length === 0) return { ok: false, why: 'Nobody in reserve.' };
  if (m.reach === 'dragin' && reserves(b.s[1 - f.side]).length === 0) return { ok: false, why: 'Nobody to drag.' };
  if (m.reach === 'bench' && reserves(b.s[1 - f.side]).length === 0) return { ok: false, why: 'Nobody in reserve.' };
  if (m.tag && !canSwitch(b, f) && reserves(b.s[f.side]).length === 0) return { ok: true, why: '' };
  return { ok: true, why: '' };
}

/** Targets the player must pick for this move: enemy reserves, own sloughs, or none. */
export function targetKind(f: Fighter, m: MoveDef): 'none' | 'ally' | 'reserveAlly' | 'enemyReserve' | 'enemyAny' {
  if (m.reach === 'ally') return 'ally';
  if (m.reach === 'reserveAlly') return 'reserveAlly';
  if (m.reach === 'dragin' || m.reach === 'bench') return 'enemyReserve';
  if (m.reach === 'single' && has(f, 'pull')) return 'enemyAny';
  return 'none';
}

function makeCtx(b: Battle, u: Fighter, m: MoveDef, a: { target?: number; opt?: number }, preview: boolean, power = 1, scale = 1): Ctx {
  const me = b.s[u.side];
  const them = b.s[1 - u.side];
  let tgt = them.f[them.out];
  if (m.reach === 'single' && has(u, 'pull') && a.target !== undefined && !them.f[a.target]?.ko && !them.f[a.target]?.gone) tgt = them.f[a.target];
  const ally = (m.reach === 'ally' || m.reach === 'reserveAlly') && a.target !== undefined ? me.f[a.target] : (m.reach === 'self' ? u : null);
  const type = moveType(u, m);
  const wardCache = new Map<Fighter, boolean>();
  const quietEffects = power < 1;
  // A reach shift changes only the user's own moves at full power.
  const reach = power === 1 && !preview ? u.reach?.mode : undefined;
  const c: Ctx = {
    b, u, me, them, move: m, type, tgt, ally, preview, pick: a.target ?? -1, opt: a.opt ?? -1,
    hit(t, r, o: HitOpts = {}) {
      if (t.ko || t.gone) return 0;
      if (t.side !== u.side && !o.reserve && c.blocked(t)) return 0;
      const kind = o.kind || (r.atk || r.def ? 'P' : r.mgk ? 'M' : 'P');
      let raw = rawOf(b, u, t, r);
      if (!o.reserve) for (const h of hooks(u)) if (h.addRaw) raw += h.addRaw(b, u, t, { kind, move: m, attack: false, dot: false, spread: !!o.spread, reserve: false });
      const dealt = dealDamage(b, u, t, raw, { kind, move: m, attack: false, dot: false, spread: !!o.spread, reserve: !!o.reserve, pierce: !!o.pierce }, kind === 'T' ? null : o.type ?? type, (o.mult || 1) * power * scale, o.noGuard || m.noGuard);
      if (reach === 'wide' && t === tgt && !o.spread && !o.reserve) for (const rf of reserves(them)) c.hit(rf, r, { ...o, spread: true, reserve: true, mult: (o.mult || 1) * WIDE_SHARE });
      return dealt;
    },
    spread(r, o: HitOpts = {}) {
      // A tight reach puts an every-foe hit all on the out foe.
      if (reach === 'tight') return c.hit(tgt, r, { ...o, mult: (o.mult || 1) * TIGHT_MUL });
      const main = c.hit(tgt, r, { ...o, spread: true });
      const share = o.share ?? Math.min(1, (m.splash ?? SPREAD_SHARE) + (has(u, 'conductive') ? WET_SAND : 0));
      for (const rf of reserves(them)) {
        if (rf === tgt) continue;
        c.hit(rf, r, { ...o, spread: true, reserve: true, mult: (o.mult || 1) * share });
      }
      return main;
    },
    st(t, id, n, v) {
      if (quietEffects) return false;
      if (t.side !== u.side && c.blocked(t)) return false;
      return applyStatus(b, u, t, id, n, v);
    },
    heal(t, amt) { return heal(b, u, t, amt * (quietEffects ? 0 : scale)); },
    shield(t, amt, turns) { if (!quietEffects) giveShield(b, u, t, amt * scale, turns); },
    cleanse(t, max) { return quietEffects ? 0 : cleanse(b, t, max); },
    delay(t, n) {
      if (quietEffects) return;
      if (t.side !== u.side && c.blocked(t)) return;
      delayFighter(b, t, n);
    },
    hasten(t, n) { if (!quietEffects) hastenFighter(b, t, n); },
    forceOut() {
      if (quietEffects) return false;
      if (c.blocked(tgt)) return false;
      if (tgt !== them.f[them.out]) return false;
      return forceOut(b, u, them === b.s[0] ? 0 : 1);
    },
    dragIn(idx) {
      if (quietEffects) return false;
      return dragIn(b, u, them === b.s[0] ? 0 : 1, idx);
    },
    interrupt(t) {
      if (quietEffects) return false;
      if (t.side !== u.side && c.blocked(t)) return false;
      if (t.s.unstop) return false;
      return interrupt(b, t, u);
    },
    blocked(t) {
      if (t.side === u.side) return false;
      if (wardCache.has(t)) return wardCache.get(t)!;
      let blocked = false;
      if (t.s.ward && t.s.ward.n > 0 && !has(u, 'orbit')) {
        t.s.ward.n--;
        if (t.s.ward.n <= 0) delete t.s.ward;
        emit(b, { e: 'blocked', ...seat(t) });
        msg(b, `${label(b, t)}'s ward takes ${m.name}.`);
        blocked = true;
      }
      wardCache.set(t, blocked);
      return blocked;
    },
    nerve(side, n) { if (!quietEffects) addNerve(b, side === b.s[0] ? 0 : 1, n); },
    msg(text) { msg(b, text); },
    cha(mult) { return stat(b, u, 'cha') * mult; },
    mark(t, id, n = 1, turns = -1, v = 0) {
      if (quietEffects) return false;
      if (t.side !== u.side && c.blocked(t)) return false;
      return mark(b, u, t, id, n, turns, v);
    },
    marked(t, id) { return marked(t, id); },
  };
  return c;
}

/** Runs a move's effect now. Used on commit for instant moves and on resolution for wind-ups. */
export function runMove(b: Battle, u: Fighter, i: number, a: { target?: number; tagTo?: number; opt?: number }, preview = false, power = 1): void {
  if (power >= 1) { runMoveAt(b, u, i, a, preview, power); return; }
  replaying++;
  try { runMoveAt(b, u, i, a, preview, power); } finally { replaying--; }
}

/**
 * Casts any move as `u` now, outside its slots and cooldowns, out or in reserve. An ally move lands on u. Below power 1 it
 * deals damage at that share and carries no statuses, heals, or other effects, as replays do.
 */
export function castMove(b: Battle, u: Fighter, id: string, power = 1, a: { target?: number; opt?: number } = {}, last = false): boolean {
  const m = MOVES[id];
  if (!m || u.gone || (u.ko && !last)) return false;
  emit(b, { e: 'use', ...seat(u), move: m.id, name: m.name, opt: a.opt });
  const aa = m.reach === 'ally' || m.reach === 'reserveAlly' ? { ...a, target: a.target ?? u.idx } : a;
  if (power < 1) replaying++;
  try { m.run(makeCtx(b, u, m, aa, false, power)); } catch { msg(b, 'It comes out garbled.'); } finally { if (power < 1) replaying--; }
  return true;
}

/** Sends f up off the ground for `turns` of its own turns. A Rooted whorl stays down. */
export function goUp(b: Battle, f: Fighter, turns: number): boolean {
  if (f.ko || f.gone || turns <= 0 || (f.s.root && !f.s.unstop)) return false;
  f.up = Math.max(f.up || 0, turns);
  f.k.upAt = b.turnNo;
  msg(b, `${label(b, f)} goes up.`);
  return true;
}

/** Starts a bout between two out whorls of opposite sides for `rounds` rounds, unless one is already on. */
export function startBout(b: Battle, a: Fighter, z: Fighter, rounds: number): boolean {
  if (a.side === z.side || !isOut(b, a) || !isOut(b, z) || boutOn(b) || rounds <= 0) return false;
  const [p0, p1] = a.side === 0 ? [a, z] : [z, a];
  b.bout = { f0: p0.idx, f1: p1.idx, score: [0, 0], dealt: [0, 0], left: rounds };
  msg(b, `${label(b, a)} and ${label(b, z)} square up for a bout.`);
  return true;
}

/** Whether a bout is on: both of its whorls are still out. A bout whose whorls are gone ends here. */
export function boutOn(b: Battle): boolean {
  const bt = b.bout;
  if (!bt) return false;
  if (b.s[0].out === bt.f0 && b.s[1].out === bt.f1 && !b.s[0].f[bt.f0].ko && !b.s[1].f[bt.f1].ko) return true;
  b.bout = null;
  return false;
}

/** Whether f is boxing in a bout now. */
export function inBout(b: Battle, f: Fighter): boolean {
  return boutOn(b) && (f.side === 0 ? b.bout!.f0 : b.bout!.f1) === f.idx;
}

/** A new round opens on a bout: the round goes to the whorl that dealt the other more, and 2 rounds win it. */
export function boutRound(b: Battle): void {
  if (!boutOn(b)) return;
  const bt = b.bout!, a = b.s[0].f[bt.f0], z = b.s[1].f[bt.f1];
  if (bt.dealt[0] !== bt.dealt[1]) bt.score[bt.dealt[0] > bt.dealt[1] ? 0 : 1]++;
  bt.dealt = [0, 0];
  bt.left--;
  const w = bt.score[0] >= 2 ? 0 : bt.score[1] >= 2 ? 1 : -1;
  if (w < 0) {
    if (bt.left > 0) { msg(b, `The bout stands ${bt.score[0]} to ${bt.score[1]}.`); return; }
    msg(b, 'The bout ends even.');
    b.bout = null;
    return;
  }
  const win = w === 0 ? a : z, lose = w === 0 ? z : a;
  b.bout = null;
  msg(b, `${label(b, win)} wins the bout.`);
  applyStatus(b, win, win, 'empower', 2);
  heal(b, win, win, win.maxHp * 0.15);
  applyStatus(b, win, lose, 'stun', 1);
}

/** Splits f into a flock of n bodies sharing its HP, for `turns` of its own turns. */
export function setFlock(b: Battle, f: Fighter, n: number, turns: number): void {
  if (f.ko || f.gone || n < 2 || turns <= 0) return;
  f.flock = { body: Math.max(1, Math.ceil(f.hp / n)), turns };
  f.k.flockAt = b.turnNo;
  msg(b, `${label(b, f)} breaks into a flock of ${n}.`);
}

/** The HP left in the front body of a flock. */
export function flockFront(f: Fighter): number {
  if (!f.flock) return f.hp;
  return f.hp - Math.floor((f.hp - 1) / f.flock.body) * f.flock.body;
}

/** The bodies a whorl has: those of its flock, or 1. */
export function bodiesOf(f: Fighter): number {
  return f.flock && f.hp > 0 ? Math.ceil(f.hp / f.flock.body) : 1;
}

/** The range between the two out whorls, Near or Far, or null while it is even. */
export function rangeOf(b: Battle): 'near' | 'far' | null {
  const r = b.range;
  if (!r || b.s[0].out !== r.o0 || b.s[1].out !== r.o1 || b.s[0].f[r.o0]?.ko || b.s[1].f[r.o1]?.ko) return null;
  return r.at;
}

/** Sets the range between the two out whorls until either leaves the field. Null makes it even again. */
export function setRange(b: Battle, at: 'near' | 'far' | null): void {
  if (rangeOf(b) === at) return;
  b.range = at ? { at, o0: b.s[0].out, o1: b.s[1].out } : null;
  msg(b, at === 'near' ? 'They close in to Near.' : at === 'far' ? 'They pull back to Far.' : 'The range is even again.');
}

/** Brings f back down to the ground. */
export function knockDown(b: Battle, f: Fighter): boolean {
  if (!f.up) return false;
  f.up = 0;
  msg(b, `${label(b, f)} is knocked down.`);
  return true;
}

/** The foe up off the ground that m cannot reach, when m is a dash from f on the ground. */
function outOfReach(b: Battle, f: Fighter, m: MoveDef): Fighter | null {
  if (!m.tags?.includes('dash') || f.up || !(m.reach === 'single' || m.reach === 'spread')) return null;
  const t = out(b, (1 - f.side) as 0 | 1);
  return t && !t.ko && !t.gone && t.up ? t : null;
}

/** A reserve across from `user` whose hook says so switches itself in before m runs, unless its side is cut off or its out whorl holds its ground. */
function rollIn(b: Battle, user: Fighter, m: MoveDef): void {
  const side = (1 - user.side) as 0 | 1, s = b.s[side];
  if (s.cut || immovable(out(b, side))) return;
  for (const r of reserves(s)) {
    if (r.ko || r.gone || barred(r) || !hears(b, r, user) || !hooks(r).some(h => h.rollsIn?.(b, r, user, m))) continue;
    const keep = s.next;
    doSwitch(b, side, r.idx, true);
    s.next = keep;
    msg(b, `${label(b, r)} rolls out to meet it.`);
    return;
  }
}

/** The foe's out whorl that takes a move f uses on itself or its own side, when one of its hooks says so. Tag and choice moves stay with f. */
function snatcher(b: Battle, f: Fighter, m: MoveDef): Fighter | null {
  if (m.tag || m.options || !(m.reach === 'self' || m.reach === 'side' || m.reach === 'ally')) return null;
  const w = out(b, (1 - f.side) as 0 | 1);
  return w && !w.ko && !w.gone && hears(b, w, f) && hooks(w).some(h => h.snatch?.(b, w, f, m)) ? w : null;
}

/** A whorl just knocked out uses its first ready plain move once more on its way out, before its side sends the next one. */
export function lastAct(b: Battle, f: Fighter): boolean {
  if (!f.ko || f.gone || b.over !== null) return false;
  const i = f.moves.findIndex((id, k) => { const m = MOVES[id]; return !!m && !m.nerve && !m.tag && !m.wu && !m.options && (f.cd[k] || 0) <= 0 && targetKind(f, m) === 'none'; });
  if (i < 0) return false;
  msg(b, `${label(b, f)} keeps going.`);
  return castMove(b, f, f.moves[i], 1, {}, true);
}

/** Schedules `id` to be cast again as `u` after `ticks`, at `power`: an echo. */
export function echoMove(b: Battle, u: Fighter, id: string, ticks: number, power: number): void {
  if (!MOVES[id] || u.ko) return;
  b.pend.push({ id: b.pid++, at: b.t + Math.max(1, Math.round(ticks)), kind: 'echo', side: u.side, idx: u.idx, move: id, data: { power: Math.round(power * 100) } });
}

/** Whether reserve `f` can use slot `i` from the bench: a ready move with no pick, switch, wind-up, channel, shots, or tide cost. */
export function benchable(b: Battle, f: Fighter, i: number): boolean {
  const m = moveDef(f, i);
  if (!m || f.ko || f.gone || isOut(b, f) || f.cd[i] > 0 || !usable(b, f, i).ok) return false;
  return !m.nerve && !m.wu && !m.tag && !m.options && !m.ammo && !m.tags?.includes('channel') && targetKind(f, m) === 'none';
}

/** Reserve `f` uses slot `i` from the bench at `mul` power without coming out. Its cooldown starts and runs once it is out. */
export function benchMove(b: Battle, f: Fighter, i: number, mul = 1): boolean {
  if (!benchable(b, f, i)) return false;
  const m = moveDef(f, i)!;
  if (mul !== 1) (f.boost ||= []).push({ slot: i, mul, uses: 1 });
  emit(b, { e: 'use', ...seat(f), move: m.id, name: m.name });
  msg(b, `${label(b, f)} uses ${m.name} from the bench.`);
  runMove(b, f, i, {});
  f.cd[i] = Math.max(f.cd[i], m.cd);
  return true;
}

function runMoveAt(b: Battle, u: Fighter, i: number, a: { target?: number; tagTo?: number; opt?: number }, preview: boolean, power: number): void {
  const m = moveDef(u, i)!;
  const c = makeCtx(b, u, m, a, preview, power, boostOf(u, i));
  u.k.dealt = 0;
  if (power === 1) { u.k.moveMul = u.k.nextMoveMul || 0; u.k.nextMoveMul = 0; }
  // The user's own hook may keep a one-target move on one foe wherever it stands, before that side's hooks hear of it.
  if (!preview && power === 1 && m.reach === 'single') {
    const t = aimOf(b, u);
    if (t && t !== c.tgt) { msg(b, `${m.name} keeps its bearing on ${label(b, t)}.`); c.tgt = t; }
  }
  // Passives on the receiving side may stop or turn back a move aimed at them before it runs.
  let caught: 'block' | 'reflect' | 'through' | null = null, catcher: Fighter | null = null;
  if (!preview && power === 1 && (m.reach === 'single' || m.reach === 'spread' || m.reach === 'dragin' || m.reach === 'bench')) {
    for (const w of standing(b.s[1 - u.side])) {
      if (!hears(b, w, u)) continue;
      for (const h of hooks(w)) { caught = h.intercept?.(b, w, u, m) || null; if (caught) { catcher = w; break; } }
      if (caught) break;
    }
  }
  // A whorl on the target's side may pull a one-target move onto itself, from the field or the bench.
  if (!caught && !preview && power === 1 && m.reach === 'single') {
    for (const w of standing(b.s[1 - u.side])) {
      if (w === c.tgt || !hears(b, w, u) || !hooks(w).some(h => h.redirect?.(b, w, u, m))) continue;
      msg(b, `${label(b, w)} pulls ${m.name} in.`);
      c.tgt = w;
      break;
    }
  }
  if (caught === 'block') msg(b, `${label(b, catcher!)} stops ${m.name}.`);
  else if (caught === 'reflect') { msg(b, `${label(b, catcher!)} turns ${m.name} back.`); m.run(makeCtx(b, catcher!, m, {}, false, 1)); }
  else if (caught === 'through') {
    // The move comes out on the user's own side and lands on its next reserve, or nowhere when it has none.
    const back = m.reach === 'single' ? reserves(b.s[u.side]).find(r => !r.ko && !r.gone) : undefined;
    if (back) { msg(b, `${m.name} goes through ${label(b, catcher!)}'s hole and comes out at ${label(b, back)}.`); c.tgt = back; m.run(c); }
    else msg(b, `${m.name} goes through ${label(b, catcher!)}'s hole and is gone.`);
  }
  else if (m.reach === 'single' && c.tgt.s.stasis) {
    msg(b, `${label(b, c.tgt)} can't be touched.`);
  } else {
    m.run(c);
  }
  u.k.moveMul = 0;
  if (power === 1) {
    if (!preview) spendBoost(u, i);
    if (!preview && u.reach && (m.reach === 'single' || m.reach === 'spread') && --u.reach.uses <= 0) u.reach = null;
    for (const h of hooks(u)) h.afterMove?.(b, u, m, c);
    if (u.k.burr && !u.ko) {
      msg(b, `The burr digs into ${label(b, u)}.`);
      const burrer = u.k.burrSide ? out(b, (u.k.burrSide - 1) as 0 | 1) : null;
      dealDamage(b, burrer && burrer !== u ? burrer : null, u, u.k.burr, { kind: 'P', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
    }
  }
}

// ---------------------------------------------------------------- the turn loop

function startTurn(b: Battle, side: 0 | 1): 'act' | 'skip' | 'down' {
  const s = b.s[side];
  b.acting = side;
  b.turnNo++;
  tickBanished(b, side);
  tickGlow(b, side);
  tickStored(b, side);
  for (const f of standing(s)) {
    // Cold storage keeps a whorl's cooldowns where they were.
    if (f.stored) continue;
    f.cd = f.cd.map(c => Math.max(0, c - 1));
    if (f.cdHit) f.cdHit = f.cdHit.map((h, i) => Math.min(h, f.cd[i] || 0));
  }
  const f = s.f[s.out];
  if (f.gone) return 'down';
  f.turns++;
  f.k.prevTurn = f.k.curTurn;
  f.k.curTurn = b.t;
  delete f.s.guard;
  delete f.s.dashing;
  f.k.guardPaid = 0;
  if (f.k.guardedLast) f.k.guardedLast--;
  const dotInfo = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
  if (f.s.burn) dealDamage(b, null, f, f.s.burn.v || 10, dotInfo('M'), null);
  if (!f.ko && f.s.bleed) {
    dealDamage(b, null, f, (f.s.bleed.v || 5) * f.s.bleed.n, dotInfo('P'), null);
    if (f.s.bleed && !cured(f)) { f.s.bleed.n--; if (f.s.bleed.n <= 0) delete f.s.bleed; }
  }
  if (!f.ko && f.s.poison) {
    dealDamage(b, null, f, f.maxHp * 0.03 * f.s.poison.n, dotInfo('T'), null);
    if (f.s.poison && !cured(f)) { f.s.poison.n--; if (f.s.poison.n <= 0) delete f.s.poison; }
  }
  if (!f.ko && f.s.doom) dealDamage(b, null, f, f.s.doom.v || 10, dotInfo('M'), null);
  if (!f.ko && f.s.regen) heal(b, null, f, f.maxHp * (f.s.regen.v || 0.06));
  if (!f.ko && f.k.tick !== undefined && f.k.tick > 0) {
    f.k.tick--;
    if (f.k.tick === 0) {
      msg(b, `The timer on ${label(b, f)} goes off.`);
      dealDamage(b, null, f, f.k.tickDmg || 40, dotInfo('M'), null);
      if (!f.ko) applyStatus(b, null, f, 'stun', 1);
      delete f.k.tick;
    }
  }
  if (!f.ko && f.k.badnews !== undefined && f.k.badnews > 0) {
    f.k.badnews--;
    if (f.k.badnews === 0) {
      msg(b, `Bad news reaches ${label(b, f)}.`);
      dealDamage(b, null, f, f.k.badnewsDmg || 40, dotInfo('M'), null);
      delete f.k.badnews;
    }
  }
  if (!f.ko) for (const h of hooks(f)) h.turnStart?.(b, f);
  if (!s.cut) for (const r of reserves(s)) for (const h of hooks(r)) h.reserveTurn?.(b, r);
  if (!f.ko) turnStartEffects(b, f);
  if (f.ko) return 'down';
  if (b.over !== null) return 'down';
  turnRelief(b, f);
  if (f.s.stasis) return 'skip';
  if (f.s.stun) { msg(b, `${label(b, f)} can't move.`); return 'skip'; }
  if (f.s.sleep) { msg(b, `${label(b, f)} is asleep.`); return 'skip'; }
  return 'act';
}

function turnStartEffects(b: Battle, f: Fighter): void {
  const foe = foeOf(b, f);
  const m = (r: number): DmgInfo => ({ kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false });
  if (f.k.monsoon) {
    f.k.monsoon = 0;
    msg(b, 'The monsoon comes round again.');
    for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.2);
  }
  if (f.k.storm && f.k.storm > 0) {
    f.k.storm--;
    msg(b, `The storm around ${label(b, f)} strikes.`);
    dealDamage(b, f, foe, stat(b, f, 'mgk') * 0.6, m(0), null);
    if (!foe.ko) addCharge(b, f, foe);
  }
  if (f.k.hemo) {
    // Burst Full cast at full HP stores its 1.5x here.
    const hm = f.k.hemo > 1 ? f.k.hemo : 1;
    f.k.hemo = 0;
    const them = b.s[1 - f.side];
    let total = 0;
    msg(b, 'The hemorrhage opens.');
    for (const t of standing(them)) {
      const share = t.idx === them.out ? 1 : SPREAD_SHARE;
      total += dealDamage(b, f, t, stat(b, f, 'mgk') * 1.2 * hm * share, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: t.idx !== them.out }, 'BEAST');
    }
    heal(b, f, f, total * 0.25);
  }
}

export function addCharge(b: Battle, src: Fighter, t: Fighter, n = 1): void {
  if (t.ko || t.gone) return;
  // Virtaki's Charges are a contact mark when its kit defines one.
  if (MARKS.dynamo_charge) { if (mark(b, src, t, 'dynamo_charge', n, -1)) MARKS.dynamo_charge.arrive?.(b, t, t.m.dynamo_charge); return; }
  t.k.charge = (t.k.charge || 0) + n;
  if (t.k.charge >= 3) {
    t.k.charge = 0;
    msg(b, `${label(b, t)} is fully charged.`);
    applyStatus(b, src, t, 'stun', 1);
  }
}

/** Two whorls touched with a dash or an Attack: every contact mark on each jumps across to the other. */
function contactJump(b: Battle, a: Fighter, z: Fighter): void {
  const take = (f: Fighter) => Object.keys(f.m).filter(id => MARKS[id]?.contact).map(id => { const mk = f.m[id]; delete f.m[id]; return { id, mk }; });
  const fromA = take(a), fromZ = take(z);
  const land = (to: Fighter, list: { id: string; mk: MarkVal }[]) => {
    for (const { id, mk } of list) {
      if (to.ko || to.gone) continue;
      const def = MARKS[id], cur = to.m[id];
      to.m[id] = { ...mk, n: Math.min(def.max ?? 99, (cur?.n || 0) + mk.n), at: b.turnNo };
      msg(b, `The ${def.name || 'mark'} jumps to ${label(b, to)}.`);
      if (def.name && !b.quiet) emit(b, { e: 'status', ...seat(to), id });
      if (to.m[id]) def.arrive?.(b, to, to.m[id]);
    }
  };
  land(z, fromA);
  land(a, fromZ);
}

function endTurn(b: Battle, side: 0 | 1, f: Fighter, weight: number, extra = 0, action = ''): void {
  const s = b.s[side];
  const now = s.f[s.out];
  let t = gapAfter(b, now, weight) + extra;
  t -= now.k.hastenAfter || 0;
  now.k.hastenAfter = 0;
  if (now.k.firstBonus) { t -= now.k.firstBonus; now.k.firstBonus = 0; }
  // A choice made in a joint round counts its gap from the side's own turn time, even when it resolved earlier in the round.
  s.next = (b.turnBase ?? b.t) + Math.max(10, t);
  if (now.k.again && now.k.again > 0) { now.k.again--; s.next = b.t + 1; }
  if (!f.ko && !f.gone && isOut(b, f)) {
    if (has(f, 'momentum')) f.k.momentum = action === 'guard' ? 0 : Math.min(4, (f.k.momentum || 0) + 1);
    const keep = cured(f);
    for (const id of Object.keys(f.s) as StatusId[]) {
      const v = f.s[id]!;
      // A cure never holds a lost turn in place: Stun, Sleep, and Stasis still wear off.
      if (keep && !LOSS_NAME[id]) continue;
      if (id === 'ward') {
        if (v.src === f.turns) continue;
        v.v = (v.v ?? 2) - 1;
        if (v.v <= 0) delete f.s.ward;
        continue;
      }
      if (id === 'guard' || id === 'dashing' || (STACKING as string[]).includes(id) || (PACE as string[]).includes(id)) continue;
      if (v.src === f.turns) continue;
      v.n--;
      if (v.n <= 0) {
        delete f.s[id];
        if (id === 'hidden') reveal(b, f);
        if (id === 'invuln') mark(b, null, f, 'seen', 1, 1);
        if (id === 'stasis' && f.k.thaw) {
          f.k.thaw = 0;
          f.hp = Math.max(f.hp, Math.round(f.maxHp * (f.k.thawPct || 40) / 100));
          msg(b, `${label(b, f)} thaws.`);
          emit(b, { e: 'heal', ...seat(f), amt: 0 });
        }
      }
    }
    if (f.shieldTurns > 0 && f.k.shieldSet !== f.turns) {
      f.shieldTurns--;
      if (f.shieldTurns <= 0) f.shield = 0;
    }
    tickHeld(f);
    if (f.up && f.k.upAt !== b.turnNo && --f.up <= 0) { f.up = 0; msg(b, `${label(b, f)} comes down.`); }
    if (f.flock && f.k.flockAt !== b.turnNo && --f.flock.turns <= 0) { f.flock = null; msg(b, `${label(b, f)} gathers back into one.`); }
    if (f.fracture && f.fracture.at !== b.turnNo && --f.fracture.turns <= 0) { f.fracture = null; msg(b, `${label(b, f)}'s bone sets.`); }
    if (f.swap && f.swap.turns > 0 && f.swap.at !== b.turnNo && --f.swap.turns <= 0) endSwap(b, f);
    if (f.mirage && f.mirage.at !== b.turnNo && --f.mirage.turns <= 0) { f.mirage = null; msg(b, `The mirage over ${label(b, f)} fades.`); }
  }
  if (action !== 'switch') f.k.escape = 0;
  // Acting clears a single steady tag. Two tags wait for relief, and stalwart counts down its holder's own turns.
  if (action !== 'skip' && !forcedNow && steadyTags(f) === 1) for (const id of LOSSES) unmark(f, steadyId(id));
  const stal = f.m[STALWART];
  if (stal && --stal.v <= 0) unmark(f, STALWART);
  if (!f.ko && !f.gone && b.over === null) {
    if (isOut(b, f)) for (const h of hooks(f)) h.turnEnd?.(b, f, action || 'skip');
    if (!f.ko) tickMarks(b, f, ['own', 'side', 'any']);
  }
  for (const w of everyone(b)) if (w !== f) tickMarks(b, w, w.side === side ? ['side', 'any'] : ['any']);
  if (b.over === null) stepOrbits(b, side);
  // A field state counts rounds: each turn is half of one.
  if (b.field && b.field.at !== b.turnNo && (b.field.turns -= 0.5) <= 0) setField(b, null);
  if (b.wind && b.wind.at !== b.turnNo && (b.wind.turns -= 0.5) <= 0) { b.wind = null; msg(b, 'The wind drops.'); }
  if (b.swell && b.swell.at !== b.turnNo && b.over === null) { b.swell.at = b.turnNo; raiseSwell(b, 1); }
  if (b.clock != null && b.over === null) setClock(b, b.clock + 10);
  // Grounds and drops wear off on the same clock.
  for (const sd of [0, 1] as const) {
    const g = b.s[sd].ground, h = b.s[sd].hold;
    if (g && g.at !== b.turnNo && (g.turns -= 0.5) <= 0) setGround(b, sd, null);
    if (h && h.at !== b.turnNo && (h.turns -= 0.5) <= 0) { b.s[sd].hold = null; msg(b, `${b.s[sd].name}'s tide comes out of the hold.`); }
    if (sd === 0 && b.lowWater && b.lowWater.at !== b.turnNo && (b.lowWater.turns -= 0.5) <= 0) { b.lowWater = null; msg(b, 'The sea comes back in.'); }
    const pr = b.s[sd].price;
    if (pr && pr.at !== b.turnNo && (pr.turns -= 0.5) <= 0) { b.s[sd].price = null; msg(b, `${b.s[sd].name}'s crests cost what they did.`); }
    const pk = b.s[sd].pink;
    if (pk && pk.at !== b.turnNo && (pk.turns -= 0.5) <= 0) clearPink(b, sd);
    const fg = b.s[sd].fog;
    if (fg && fg.at !== b.turnNo && (fg.turns -= 0.5) <= 0) { b.s[sd].fog = null; msg(b, `The fog lifts off ${b.s[sd].name}'s bench.`); }
    const sh = b.s[sd].shut;
    if (sh && sh.at !== b.turnNo && (sh.turns -= 0.5) <= 0) { b.s[sd].shut = null; msg(b, `The door opens for ${b.s[sd].name}.`); }
    const ct = b.s[sd].cut;
    if (ct && ct.at !== b.turnNo && (ct.turns -= 0.5) <= 0) { b.s[sd].cut = null; msg(b, `${b.s[sd].name}'s bench can reach again.`); }
    const mt = b.s[sd].mantle;
    if (mt && mt.at !== b.turnNo && (mt.turns -= 0.5) <= 0) { b.s[sd].mantle = null; msg(b, `The mantle slides off ${b.s[sd].name}'s side.`); }
  }
  if (b.drops?.length) {
    for (const d of b.drops) if (d.at !== b.turnNo) d.turns -= 0.5;
    for (const d of b.drops) if (d.turns <= 0) msg(b, `The ${DROPS[d.id]?.name || 'drop'} is gone.`);
    b.drops = b.drops.filter(d => d.turns > 0);
  }
  if (s.spin && b.over === null) spinOn(b, side, f, action);
  b.acting = null;
  const lead = Math.sign(hpShare(b, 0) - hpShare(b, 1));
  if (lead !== 0 && lead !== b.stats.lastLead) {
    if (b.stats.lastLead !== 0) b.stats.leadChanges++;
    b.stats.lastLead = lead;
  }
}

export function hpShare(b: Battle, side: 0 | 1): number {
  let a = 0, m = 0;
  for (const f of b.s[side].f) { m += f.maxHp; a += f.ko || f.gone ? 0 : f.hp; }
  return m ? a / m : 0;
}

function resolvePending(b: Battle, p: Pending): void {
  b.pend = b.pend.filter(x => x !== p);
  if (p.kind === 'summon') { runSummon(b, p); return; }
  if (p.kind === 'held') {
    const h = b.s[p.side].f[p.idx], name = p.move ? MOVES[p.move]?.name || 'a move' : 'Attack';
    if (!h || h.ko || h.gone || !isOut(b, h)) { msg(b, `The ${name} never comes back out.`); return; }
    msg(b, `${label(b, h)}'s ${name} comes back out.`);
    const prev = b.acting;
    b.acting = null;
    const t = foeOf(b, h);
    if (p.data?.attack) { if (t && !t.ko && !t.gone) doAttack(b, h, t); }
    else castMove(b, h, p.move, 1, { target: (p.data?.target ?? -1) >= 0 ? p.data!.target : undefined, opt: (p.data?.opt ?? -1) >= 0 ? p.data!.opt : undefined });
    b.acting = prev;
    return;
  }
  if (p.kind === 'echo') {
    const e = b.s[p.side].f[p.idx];
    if (!e || e.ko || e.gone) return;
    msg(b, `The echo of ${MOVES[p.move]?.name || 'a move'} comes back.`);
    const prev = b.acting;
    b.acting = null;
    castMove(b, e, p.move, (p.data?.power ?? 100) / 100);
    b.acting = prev;
    return;
  }
  const u = b.s[p.side].f[p.idx];
  if (u.ko || u.gone || !isOut(b, u)) return;
  if (p.kind === 'windup') {
    const i = u.moves.indexOf(p.move);
    if (i < 0) return;
    emit(b, { e: 'use', side: p.side, idx: p.idx, move: p.move, name: MOVES[p.move].name, opt: p.data?.opt });
    msg(b, `${label(b, u)}'s ${MOVES[p.move].name} lands.`);
    rollIn(b, u, MOVES[p.move]);
    const prev = b.acting;
    b.acting = null;
    b.aim = p.data?.aim ? { side: p.side, uid: p.data.aim } : null;
    dashIn(b, u, MOVES[p.move]);
    const high = outOfReach(b, u, MOVES[p.move]);
    if (high) msg(b, `${label(b, u)} can't reach ${label(b, high)} up there.`);
    else runMove(b, u, i, { target: p.data?.target, opt: p.data?.opt });
    b.aim = null;
    b.acting = prev;
    if (u.k.fresh) u.k.fresh = 0;
    chainOn(b, u, MOVES[p.move]);
    for (const w of everyone(b)) if (hears(b, w, u)) for (const h of hooks(w)) h.anyMove?.(b, w, u, MOVES[p.move]);
  } else if (p.kind === 'hemo') {
    const them = b.s[1 - p.side];
    let total = 0;
    const raw = (p.data?.mgk || 50) * 1.2;
    for (const t of standing(them)) {
      const share = t.idx === them.out ? 1 : SPREAD_SHARE;
      total += dealDamage(b, u, t, raw * share, { kind: 'M', move: MOVES[p.move], attack: false, dot: false, spread: true, reserve: t.idx !== them.out }, MOVES[p.move].type);
    }
    heal(b, u, u, total * 0.25);
  }
}

/** Rounds after this one bring fatigue. */
export const FATIGUE_ROUND = 25;

/** The current round: each side's turn counts as half of one. */
export function roundOf(b: Battle): number {
  return Math.ceil(b.turnNo / 2);
}

/** Share of max HP that fatigue takes in a round. */
export function fatigueShare(round: number): number {
  return 0.05 * (round - FATIGUE_ROUND);
}

/** Fatigue strikes both out sloughs, the slower one first. */
function fatigue(b: Battle, round: number): void {
  const outs = [out(b, 0), out(b, 1)].filter(f => !f.ko && !f.gone);
  outs.sort((x, z) => stat(b, x, 'agi') - stat(b, z, 'agi') || b.s[z.side].next - b.s[x.side].next);
  if (round === FATIGUE_ROUND + 1) msg(b, 'Both sides are tiring.');
  for (const f of outs) {
    if (b.over !== null) return;
    if (f.ko) continue;
    msg(b, `Fatigue takes ${label(b, f)}.`);
    dealDamage(b, null, f, f.maxHp * fatigueShare(round), { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
  }
}

// ---------------------------------------------------------------- the rewind

/** Rounds Still Minute goes back: its visitor arrives as the round this many rounds before the crest's own round opens. */
export const REWIND_ROUNDS = 3;
/** The most decisions the record keeps, whatever the rounds they span. */
const RECORD_MAX = 24;

/** Above 0 while a rewind replays the past: events are flagged as past, and no move that rewinds may be chosen. */
let pastDepth = 0;
/** Above 0 while a forced action resolves: it was nobody's choice, so the record leaves it out. */
let forcing = 0;
/** Above 0 while a forced switch resolves: it is a lost turn, so it clears no steady tag. */
let forcedNow = 0;
/**
 * The AI the rewind asks, set by the AI module so the engine need not import it: a turn the record does not hold, a recorded
 * choice with no move or Attack left to stand in for it, a replacement the record does not hold, and the best of a crest's
 * picks to cast now. `fresh` asks for empty caches, which a battle both copies of an online match play needs.
 */
let pastAi: {
  choose(b: Battle, side: 0 | 1): Action;
  replace(b: Battle, side: 0 | 1): number;
  pick(b: Battle, f: Fighter, picks: Action[], power: number, fresh: boolean): Action;
} | null = null;

export function setPastAi(ai: typeof pastAi): void { pastAi = ai; }

/** A peg, a run, or a notion reaches outside the battle, so a rewind may never cross one. */
export function pastBarrier(a: Action | null): boolean {
  return !!a && (a.k === 'peg' || a.k === 'run' || a.k === 'notion');
}

/** The round a turn number falls in: each side's turn is half of one. */
const roundAt = (turnNo: number): number => Math.ceil(turnNo / 2);

/**
 * Keeps the decision waiting now, and what each side chose, on the real battle: every decision of this round and the
 * REWIND_ROUNDS before it. A replay keeps its own choices too, so after a rewind the record holds the new timeline.
 */
function remember(b: Battle, acts: [Action | null, Action | null]): void {
  if (b.quiet || forcing || b.visit || !b.need) return;
  if (pastBarrier(acts[0]) || pastBarrier(acts[1])) { b.past = []; return; }
  const past = (b.past ||= []);
  past.push({ snap: clone(b), need: { ...b.need } as Decision, acts: [acts[0], acts[1]], turnNo: b.turnNo });
  const keep = roundAt(b.turnNo) - REWIND_ROUNDS;
  let drop = 0;
  while (drop < past.length - 1 && (roundAt(past[drop].turnNo) < keep || past.length - drop > RECORD_MAX)) drop++;
  if (drop) past.splice(0, drop);
}

/**
 * Asks for a rewind as soon as the action in hand resolves: `f` goes back in time as `crest`, cast from `slot`. Returns false
 * where none can run, and while another rewind is waiting to start, so the first crest to resolve is the one that goes back.
 */
export function requestRewind(b: Battle, f: Fighter, crest: string, slot: number): boolean {
  if (b.quiet || pastDepth || b.visit || b.rewindReq) return false;
  b.rewindReq = { side: f.side, idx: f.idx, crest, slot, at: b.t };
  return true;
}

/** Tells the screen how every whorl stands now, so it can redraw them after the battle jumps in time. */
function showRewind(b: Battle): void {
  const g = <T,>(fn: (f: Fighter) => T) => b.s.map(s => s.f.map(fn));
  emit(b, { e: 'rewind', hp: g(f => f.hp), shield: g(f => f.shield), ko: g(f => f.ko), gone: g(f => !!f.gone), out: [b.s[0].out, b.s[1].out], field: b.field?.id || null });
}

/** Puts `src` in place of b's state, keeping the screen's own fields: the event queue, quiet, and lanes. */
function restoreInto(b: Battle, src: Battle, live: Pick<Battle, 'ev' | 'quiet' | 'lanes'>): void {
  for (const key of Object.keys(b)) if (!(key in src)) delete (b as unknown as Record<string, unknown>)[key];
  Object.assign(b, src, live, { rewindReq: null });
}

/** Every move spent for good in `present` stays spent in the past b has gone back to. */
function keepSpent(b: Battle, present: Battle): void {
  for (const sd of [0, 1] as const) b.s[sd].f.forEach((f, i) => {
    const now = present.s[sd].f[i]?.spent;
    if (!now?.length) return;
    f.spent = [...new Set([...(f.spent || []), ...now])];
    holdSpent(f);
  });
}

/**
 * The moves f may cast in a crest's place, each with the target, option, aim, or ally to swap with that it needs on the board
 * as it stands: every move but a crest and a move that rewinds, with no cooldowns. A visitor's swap move may name any ally
 * standing on its side, its past self included.
 */
function castChoices(b: Battle, f: Fighter, visitor: boolean): Action[] {
  const me = b.s[f.side], them = b.s[1 - f.side], list: Action[] = [];
  const aims = them.sum.filter(aimable).map(u => u.uid);
  const allies = standing(me).map(x => x.idx);
  f.moves.forEach((id, i) => {
    const m = MOVES[id];
    if (!m || m.rewinds || isBig(m)) return;
    const tk = targetKind(f, m), swap = visitor && !!m.tag;
    const base: Action[] = [];
    if (tk === 'ally') for (const t of allies) base.push({ k: 'move', i, target: t });
    else if (tk === 'reserveAlly') for (const t of swap ? allies : reserves(me).map(x => x.idx)) base.push({ k: 'move', i, target: t });
    else if (tk === 'enemyReserve') for (const t of reserves(them)) base.push({ k: 'move', i, target: t.idx });
    else if (tk === 'enemyAny') for (const t of standing(them)) base.push({ k: 'move', i, target: t.idx });
    else if (m.options) m.options(b, f).forEach((_, opt) => base.push({ k: 'move', i, opt }));
    else { base.push({ k: 'move', i }); if (m.reach === 'single') for (const aim of aims) base.push({ k: 'move', i, aim }); }
    // A swap move that picks no ally of its own names the ally the visitor takes the place of.
    if (swap && tk !== 'ally' && tk !== 'reserveAlly') { for (const a of base) for (const to of allies) list.push({ ...a, tagTo: to } as Action); }
    else list.push(...base);
  });
  return list;
}

/** The whorl that casts a visit's choice: the visitor, or the caster itself when there was no past to go to. */
export function visitorOf(b: Battle, v: Visit): Fighter {
  return v.here ? b.s[v.side].f[v.idx] : v.body;
}

/** The choices the visitor may make at its decision, or a pass (Measure's action) when it has nothing it can cast. */
export function visitChoices(b: Battle): Action[] {
  const v = b.visit;
  if (!v || b.need?.kind !== 'visit') return [];
  const list = castChoices(b, visitorOf(b, v), !v.here);
  return list.length ? list : [{ k: 'wait' }];
}

/** The visit choice that `a` names, swap ally included, or null. */
export function visitMatch(b: Battle, a: Action): Action | null {
  if (!a || typeof a !== 'object') return null;
  const to = (a as { tagTo?: number }).tagTo;
  return visitChoices(b).find(x => sameAction(x, a) && (x as { tagTo?: number }).tagTo === to) ?? null;
}

/** What the visitor casts when its side runs out of time: its first choice. */
export function passiveVisit(b: Battle): Action {
  return visitChoices(b)[0] ?? { k: 'wait' };
}

/** Casts f's pick `a` at `power`, aimed at the summon it names. A pass casts nothing. */
function castPick(b: Battle, f: Fighter, a: Action, power = 1): void {
  if (a.k !== 'move') { msg(b, `${label(b, f)} casts nothing.`); return; }
  const id = f.moves[a.i];
  if (!MOVES[id]) return;
  const aim = b.aim;
  b.aim = a.aim ? { side: f.side, uid: a.aim } : null;
  try { castMove(b, f, id, power, { target: a.target, opt: a.opt }); } finally { b.aim = aim; }
}

/** Casts the best of f's own moves now at `power`, as the AI judges it, in place of a crest that has no past to go back to. */
export function castBest(b: Battle, f: Fighter, power: number): void {
  if (f.ko || f.gone) return;
  const picks = castChoices(b, f, false);
  if (!picks.length) return;
  castPick(b, f, picks.length > 1 && pastAi ? pastAi.pick(b, f, picks, power, !b.quiet) : picks[0], power);
}

/**
 * The visitor casts its pick from beside its side: it stands on no slot of the board, so its past self stays where it is and
 * may be its target. A swap move then keeps the visitor on the board in the place of the ally it names.
 */
function standIn(b: Battle, v: Visit, a: Action): void {
  const id = a.k === 'move' ? v.body.moves[a.i] : '';
  if (MOVES[id]) msg(b, `${label(b, v.body)} from ${v.back} round${v.back > 1 ? 's' : ''} on uses ${MOVES[id].name}.`);
  visiting = v.body;
  try { castPick(b, v.body, a); } finally { visiting = null; }
  const m = a.k === 'move' ? MOVES[v.body.moves[a.i]] : null;
  if (m?.tag && b.over === null) trade(b, v, a, m);
}

/** A swap move the visitor cast: it stays in the place of the ally the move names, and that ally leaves the battle in its time machine. */
function trade(b: Battle, v: Visit, a: Action, m: MoveDef): void {
  const s = b.s[v.side], body = v.body;
  const to = (a as { tagTo?: number }).tagTo ?? (m.reach === 'reserveAlly' || m.reach === 'ally' ? (a as { target?: number }).target : undefined);
  const ally = to !== undefined ? s.f[to] : null;
  if (to === undefined || !ally || ally.ko || ally.gone || body.ko || body.gone || ((body.s.root || body.s.taunt) && !body.s.unstop)) return;
  const wasOut = s.out === to;
  // The ally takes everything of its own along: its wind-ups, its choice in the round, its channel, and its summons.
  endChannel(b, ally);
  b.pend = b.pend.filter(p => !(p.side === v.side && p.idx === to));
  b.queue = b.queue.filter(q => !(q.side === v.side && q.who === to));
  for (const u of s.sum.filter(x => x.by === to && !SUMMONS[x.def]?.lasting)) dismiss(b, u);
  emit(b, { e: 'ship', side: v.side, idx: to, at: 'trade', sprite: spriteOf(ally) });
  msg(b, ally.mon === body.mon ? `${label(b, ally)}'s past self climbs into the time machine, and ${label(b, body)} stays in its place.`
    : `${label(b, ally)} climbs into the time machine, and ${label(b, body)} stays in its place.`);
  body.idx = to;
  s.f[to] = body;
  if (wasOut) comeOut(b, body);
}

/** The visitor's cast alone, with no replay after it, for the AI to judge each choice on a copy. */
export function visitCast(b: Battle, a: Action): void {
  const v = b.visit;
  if (!v) return;
  if (v.here) castPick(b, visitorOf(b, v), a);
  else standIn(b, v, a);
}

/** Starts the rewind a crest asked for: the battle goes back from the moment the crest resolved, and the visitor's choice waits. */
function beginRewind(b: Battle): void {
  const req = b.rewindReq!;
  b.rewindReq = null;
  if (b.over !== null) return;
  const caster = b.s[req.side].f[req.idx];
  if (!caster) return;
  if (caster.ko || caster.gone) { msg(b, `${label(b, caster)} is not here, so the tide does not turn back.`); caster.k.rewound = 1; return; }
  const steps = b.past || [];
  // The crest's own round is the newest step where the caster chose the crest from its slot.
  let crestK = -1;
  for (let k = steps.length - 1; k >= 0 && crestK < 0; k--) {
    const a = steps[k].acts[req.side], sd = steps[k].snap.s[req.side];
    if (a?.k === 'move' && a.i === req.slot && sd.out === req.idx && sd.f[req.idx].moves[a.i] === req.crest) crestK = k;
  }
  // The visitor arrives as the oldest round in reach opens: at a joint choice or a solo turn, never a replacement or a Measure's second half.
  const crestRound = crestK >= 0 ? roundAt(steps[crestK].turnNo) : 0;
  let at = -1;
  for (let k = 0; k < crestK && at < 0; k++) {
    const st = steps[k], r = roundAt(st.turnNo);
    const opens = st.need.kind === 'joint' || (st.need.kind === 'act' && st.snap.waited == null);
    if (opens && r < crestRound && r >= crestRound - REWIND_ROUNDS) at = k;
  }
  const body = cloneFighter(caster);
  if (at < 0) {
    msg(b, `There is no earlier round to go back to, so ${label(b, caster)} casts here.`);
    b.visit = { side: req.side, idx: req.idx, crest: req.crest, body, steps: [], until: req.at, present: null, back: 0, here: true };
    b.need = { kind: 'visit', side: req.side };
    return;
  }
  // A body trade stays behind in the present: the visitor wears its own body.
  if (body.form?.tag === 'swap') { body.form = null; resetMoves(body); }
  body.swap = null;
  const present = clone(b), live = { ev: b.ev, quiet: b.quiet, lanes: b.lanes }, st = steps[at];
  emit(b, { e: 'ship', side: req.side, idx: req.idx, at: 'board' });
  msg(b, `${label(b, caster)} climbs into its time machine.`);
  pastDepth++;
  try {
    restoreInto(b, clone(st.snap), live);
    keepSpent(b, present);
    b.visit = { side: req.side, idx: req.idx, crest: req.crest, body, steps: steps.slice(at), until: req.at, present, back: crestRound - roundAt(st.turnNo), here: false };
    msg(b, 'The tide turns back.');
    showRewind(b);
    emit(b, { e: 'ship', side: req.side, idx: req.idx, at: 'arrive' });
  } finally { pastDepth--; }
  b.need = { kind: 'visit', side: req.side };
}

/**
 * The visitor's choice: it casts `a` and leaves, the recorded rounds play again from there to the moment it left, and the
 * battle is live again. The past keeps its own tide. A choice the visitor cannot make becomes its first one.
 */
export function visit(b: Battle, a: Action): void {
  const v = b.visit;
  if (!v || b.need?.kind !== 'visit') throw new Error('nobody is visiting');
  const pick = visitMatch(b, a) ?? passiveVisit(b);
  b.need = null;
  b.visit = null;
  if (v.here) {
    const f = b.s[v.side].f[v.idx];
    castPick(b, f, pick);
    f.k.rewound = 1;
    return;
  }
  const live = { ev: b.ev, quiet: b.quiet, lanes: b.lanes };
  let ok = true;
  pastDepth++;
  try {
    b.need = { ...v.steps[0].need } as Decision;
    standIn(b, v, pick);
    emit(b, { e: 'ship', side: v.side, idx: v.idx, at: 'depart' });
    if (b.over === null) {
      settleArrival(b);
      replayPast(b, v.steps, v.until);
    }
  } catch {
    ok = false;
  } finally { pastDepth--; }
  if (!ok) {
    restoreInto(b, clone(v.present!), live);
    b.past = [];
    msg(b, 'The tide will not turn back.');
    showRewind(b);
    const f = b.s[v.side].f[v.idx];
    if (!f.ko && !f.gone) castPick(b, f, pick);
    f.k.rewound = 1;
    return;
  }
  b.s[v.side].f[v.idx].k.rewound = 1;
  msg(b, 'The tide runs on.');
  showRewind(b);
}

/** After the visitor's cast: a whorl it left down loses the turn waiting for it, as when a turn start knocks a whorl out. */
function settleArrival(b: Battle): void {
  const d = b.need;
  if (b.over !== null || !d) return;
  const down = (sd: 0 | 1) => { const o = out(b, sd); return !o || o.ko || o.gone; };
  if (d.kind === 'act') {
    if (!down(d.side)) return;
    b.need = null;
    b.acting = null;
    b.s[d.side].next = b.t + 60;
  } else if (d.kind === 'joint') {
    const dn = ([0, 1] as const).filter(down);
    if (!dn.length) return;
    for (const sd of dn) b.s[sd].next = b.t + 60;
    if (dn.length === 2) { b.need = null; b.acting = null; return; }
    const other = (1 - dn[0]) as 0 | 1;
    b.t = Math.max(b.t, b.s[other].next);
    b.acting = other;
    b.rnd = { n: (b.rnd?.n || 0) + 1, joint: false, commits: [null, null], done: [false, false], first: other };
    b.need = { kind: 'act', side: other };
  }
}

/** A recorded choice and the battle as it stood when the choice was made. */
interface Recorded { a: Action; snap: Battle }

/** The whorl that made a choice on `snap`: its side's out whorl. */
const moverOf = (snap: Battle, side: 0 | 1): Fighter => snap.s[side].f[snap.s[side].out];

/** Whether f is the whorl `was`: the same slot and the same slough. A visitor shares its caster's slough but not its slot. */
const sameWhorl = (f: Fighter | undefined, was: Fighter): boolean => !!f && f.idx === was.idx && f.mon.uid === was.mon.uid;

/** Where a choice is aimed: a summon by its uid, or else a whorl by side, slot, and slough, and whether that whorl is out. */
interface PastAim { sum: number; side: 0 | 1; idx: number; uid: number; out: boolean }

/** Where f's choice `a` on bb is aimed. A choice that names no target is aimed at the foe that is out. */
function pastAim(bb: Battle, f: Fighter, a: Action): PastAim {
  const x = a as { target?: number; aim?: number };
  const reach = a.k === 'move' ? MOVES[f.moves[a.i]]?.reach : undefined;
  const side = (x.target !== undefined && (reach === 'ally' || reach === 'reserveAlly') ? f.side : 1 - f.side) as 0 | 1;
  const s = bb.s[side], idx = x.target ?? s.out;
  return { sum: x.aim || 0, side, idx, uid: s.f[idx]?.mon.uid ?? -1, out: s.out === idx };
}

/** How near aim c is to recorded aim r: 3 the same target, 2 whoever stands in its place, 1 any other. A plain hit takes a summon's place. */
function nearness(r: PastAim, c: PastAim): number {
  if (r.sum || c.sum) return r.sum === c.sum ? 3 : c.sum ? 1 : 2;
  if (c.side !== r.side) return 1;
  if (c.idx === r.idx && c.uid === r.uid) return 3;
  return (r.out ? c.out : c.idx === r.idx) ? 2 : 1;
}

/** Of the choices in `ls` that `keep` allows, the one nearest recorded choice `a` from `snap` in target or option, the first on a tie. */
function nearest(b: Battle, side: 0 | 1, ls: Action[], snap: Battle, a: Action, keep: (x: Action) => boolean): Action | null {
  const r = pastAim(snap, moverOf(snap, side), a), f = out(b, side), opt = (a as { opt?: number }).opt;
  let best: Action | null = null, top = 0;
  for (const x of ls) {
    if (!keep(x)) continue;
    const xo = (x as { opt?: number }).opt;
    const n = xo !== undefined || opt !== undefined ? (xo === opt ? 3 : 1) : nearness(r, pastAim(b, f, x));
    if (n > top) { best = x; top = n; }
  }
  return best;
}

/**
 * The choice `side` plays in a replay for its recorded choice `a`, made on `snap`. A move plays as the same move by id from the
 * same whorl, else as the move in the same slot from the whorl now in its place, each at the same target if it still stands and
 * otherwise at whoever stands in its place. Any other choice plays only as it was made. Failing those a plain Attack plays, and
 * null leaves the choice to the AI. It reads nothing but the two battles, so both copies of an online match play the same choice.
 */
export function pastChoice(b: Battle, side: 0 | 1, snap: Battle, a: Action): Action | null {
  const ls = legal(b, side), was = moverOf(snap, side), f = out(b, side);
  let pick: Action | null = null;
  if (a.k === 'move') {
    const id = was.moves[a.i], j = id && sameWhorl(f, was) ? (f.moves[a.i] === id ? a.i : f.moves.indexOf(id)) : -1;
    if (j >= 0) pick = nearest(b, side, ls, snap, a, x => x.k === 'move' && x.i === j);
    pick ??= nearest(b, side, ls, snap, a, x => x.k === 'move' && x.i === a.i);
  } else pick = ls.find(x => sameAction(x, a)) ?? null;
  pick ??= ls.find(x => x.k === 'attack' && !x.aim) ?? null;
  const to = (a as { tagTo?: number }).tagTo;
  return pick && to !== undefined ? legalMatch(b, side, { ...pick, tagTo: to } as Action) ?? pick : pick;
}

/**
 * Plays the recorded rounds again, each side's choices in the order it made them, up to battle time `until`, when the visitor
 * left. Each recorded choice plays as `pastChoice` finds it. A turn the record does not hold, a choice with nothing left to
 * stand in for it, and a replacement the record does not hold go to the AI. The first decision after `until` is live.
 */
function replayPast(b: Battle, steps: PastStep[], until: number): void {
  if (!pastAi) throw new Error('no AI for the rewind');
  const ai = pastAi;
  const acts: Recorded[][] = [[], []], swaps: number[][] = [[], []];
  for (const st of steps) for (const side of [0, 1] as const) {
    const a = st.acts[side];
    if (!a) continue;
    if (st.need.kind === 'replace') { if (a.k === 'switch') swaps[side].push(a.to); continue; }
    acts[side].push({ a, snap: st.snap });
  }
  const at = [0, 0], swapAt = [0, 0];
  const pickReplace = (bb: Battle, side: 0 | 1): number => {
    if (bb.t > until) return -1;
    if (swapAt[side] < swaps[side].length) { const to = swaps[side][swapAt[side]++]; if (replaceChoices(bb, side).includes(to)) return to; }
    return ai.replace(bb, side);
  };
  // A side's next recorded choice. A Measure stands only for the whorl that made it, and otherwise gives way to the choice it led to.
  const take = (side: 0 | 1): Action => {
    while (at[side] < acts[side].length) {
      const r = acts[side][at[side]++];
      if (r.a.k !== 'wait') return pastChoice(b, side, r.snap, r.a) ?? ai.choose(b, side);
      if (sameWhorl(out(b, side), moverOf(r.snap, side)) && legal(b, side).some(x => x.k === 'wait')) return r.a;
    }
    return ai.choose(b, side);
  };
  const limit = 2 * (acts[0].length + acts[1].length + swaps[0].length + swaps[1].length) + 40;
  for (let guard = 0; ; guard++) {
    if (guard > limit) throw new Error('the rewind ran too long');
    if (b.over !== null) return;
    const d = b.need || advance(b, pickReplace);
    if (d.kind === 'over') return;
    if (b.t > until) {
      // A live replacement goes back to whoever makes the battle's replacements, which reads it again from the board.
      if (d.kind === 'replace') b.need = null;
      return;
    }
    if (d.kind === 'visit') throw new Error('a visit inside a replay');
    if (d.kind === 'replace') {
      const i = pickReplace(b, d.side);
      if (i < 0) return;
      replace(b, d.side, i);
    } else if (d.kind === 'joint') {
      const a0 = take(0), a1 = take(1);
      actJoint(b, a0, a1);
    } else act(b, take(d.side));
  }
}

/** Advances time until someone must decide something. */
export function advance(b: Battle, chooseReplace?: (b: Battle, side: 0 | 1) => number): Decision {
  for (let guard = 0; guard < 500; guard++) {
    if (b.over !== null) return { kind: 'over', winner: b.over };
    if (b.need) return b.need;
    // A crest that rewinds goes back the moment it resolves, before anything else in its round.
    if (b.rewindReq) { beginRewind(b); continue; }
    for (const side of [0, 1] as const) {
      const s = b.s[side];
      const o = s.f[s.out];
      if ((o.ko || o.gone) && standing(s).length > 0) {
        const pick = chooseReplace ? chooseReplace(b, side) : -1;
        if (pick < 0) { b.need = { kind: 'replace', side }; return b.need; }
        replace(b, side, pick);
      }
    }
    if (b.need) return b.need;
    // Pending wind-ups and summons, choices waiting in a joint round, and new turns all take their place by time.
    const pmin = b.pend.length ? Math.min(...b.pend.map(p => p.at)) : Infinity;
    const open = ([0, 1] as const).filter(sd => !b.queue.some(q => q.side === sd));
    const nxt = open.length ? Math.min(...open.map(sd => b.s[sd].next)) : Infinity;
    const q = b.queue[0];
    const qat = q ? q.at : Infinity;
    if (pmin <= qat && pmin <= nxt && pmin < Infinity) {
      const p = b.pend.find(x => x.at === pmin)!;
      b.t = Math.max(b.t, pmin);
      resolvePending(b, p);
      continue;
    }
    if (q && qat <= nxt) {
      b.queue.shift();
      resolveQueued(b, q);
      continue;
    }
    if (!open.length) break;
    const side: 0 | 1 = open.length === 1 ? open[0] : first(b, { side: 0, at: b.s[0].next }, { side: 1, at: b.s[1].next }, false);
    b.t = Math.max(b.t, b.s[side].next);
    const round = roundOf(b) + (b.turnNo % 2 === 0 ? 1 : 0);
    if (b.turnNo % 2 === 0 && (b.roundSeen || 0) < round) {
      b.roundSeen = round;
      for (const w of everyone(b)) if (!w.ko && !w.gone) for (const h of hooks(w)) h.roundStart?.(b, w, round);
      boutRound(b);
      if (b.over !== null || out(b, 0).ko || out(b, 1).ko) continue;
    }
    if (b.turnNo % 2 === 0 && (b.lowWater || (b.rules.starEvery && round % b.rules.starEvery === 0)) && (b.starred || 0) < round) {
      b.starred = round;
      starFall(b);
    }
    if (b.turnNo % 2 === 0 && round > FATIGUE_ROUND && (b.fatigued || 0) < round) {
      b.fatigued = round;
      fatigue(b, round);
      continue;
    }
    const r = startTurn(b, side);
    const f = out(b, side);
    if (r === 'skip') { endTurn(b, side, f, 50, 0, 'skip'); continue; }
    if (r === 'down') { b.acting = null; b.s[side].next = b.t + 60; continue; }
    if (f.forced) {
      const k = f.forced;
      f.forced = null;
      const fa = forcedAction(b, side, k.k, k.i);
      if (k.foe && fa?.k === 'switch') mark(b, null, b.s[side].f[fa.to], steadyId('switch'));
      msg(b, `${label(b, f)} can't help it.`);
      if (!fa) { endTurn(b, side, f, 50, 0, 'skip'); continue; }
      b.rnd = { n: (b.rnd?.n || 0) + 1, joint: false, commits: [null, null], done: [false, false], first: side };
      b.need = { kind: 'act', side };
      forcing++;
      if (k.k === 'switch') forcedNow++;
      try { act(b, fa); } finally { forcing--; if (k.k === 'switch') forcedNow--; }
      continue;
    }
    // The other side's turn inside the window, with no choice of its own waiting, makes this a joint round.
    const other = (1 - side) as 0 | 1;
    if (!b.rules.solo && open.length === 2 && b.s[other].next - b.t <= syncWindow(b)) {
      const r2 = startTurn(b, other);
      const o = out(b, other);
      b.acting = null;
      if (b.over !== null) continue;
      // The other side's turn start can knock out this side's whorl. Its turn is lost and its side sends out a replacement,
      // and the other side acts alone at its own turn time.
      const mine = out(b, side);
      if (mine.ko || mine.gone) {
        b.s[side].next = b.t + 60;
        if (r2 === 'act' && !o.forced) {
          b.t = Math.max(b.t, b.s[other].next);
          b.acting = other;
          b.rnd = { n: (b.rnd?.n || 0) + 1, joint: false, commits: [null, null], done: [false, false], first: other };
          b.need = { kind: 'act', side: other };
          return b.need;
        }
        if (r2 === 'down') b.s[other].next = b.t + 60;
        else b.queue.push({ side: other, a: null, at: b.s[other].next, sched: b.s[other].next, tier: 0, who: o.idx, rank: 1, kind: r2 === 'skip' ? 'skip' : 'forced' });
        continue;
      }
      if (r2 === 'act' && !o.forced) { b.need = { kind: 'joint' }; return b.need; }
      // The other side cannot choose this round. Its turn still plays at its own time, and this side chooses alone.
      if (r2 === 'down') b.s[other].next = b.t + 60;
      else b.queue.push({ side: other, a: null, at: b.s[other].next, sched: b.s[other].next, tier: 0, who: o.idx, rank: 1, kind: r2 === 'skip' ? 'skip' : 'forced' });
      b.acting = side;
    }
    b.rnd = { n: (b.rnd?.n || 0) + 1, joint: false, commits: [null, null], done: [false, false], first: side };
    b.need = { kind: 'act', side };
    return b.need;
  }
  if (b.over === null) { b.over = 1; b.stalled = true; }
  return { kind: 'over', winner: b.over };
}

// ---------------------------------------------------------------- rounds

/** Choices waiting in a round go in time order, and the round's own order breaks a tie in time. */
function queueOrder(x: Queued, z: Queued): number {
  return x.at - z.at || x.rank - z.rank;
}

/** Half the faster out whorl's plain turn. Turns this close make a joint round. */
export function syncWindow(b: Battle): number {
  const a = out(b, 0), z = out(b, 1);
  if (!a || !z || a.ko || a.gone || z.ko || z.gone) return -1;
  return SYNC_SHARE * Math.min(plainTicks(b, a), plainTicks(b, z));
}

/** The side that goes first of two: the earlier time, then the higher AGI, then the side whose turn it is to win a tie. */
function first(b: Battle, x: { side: 0 | 1; at: number }, z: { side: 0 | 1; at: number }, useTie: boolean): 0 | 1 {
  if (x.at !== z.at) return x.at < z.at ? x.side : z.side;
  const ax = stat(b, out(b, x.side), 'agi'), az = stat(b, out(b, z.side), 'agi');
  if (ax !== az) return ax > az ? x.side : z.side;
  const w = b.tie;
  if (useTie) b.tie = (1 - b.tie) as 0 | 1;
  return w;
}

/** The side whose turn opens the next round, as the screen shows it before anyone chooses. */
export function roundLead(b: Battle): 0 | 1 {
  return first(b, { side: 0, at: b.s[0].next }, { side: 1, at: b.s[1].next }, false);
}

/** The order class of an action in a joint round: run, switch, and guard first, quick moves next, late moves last. */
export function tierOf(b: Battle, side: 0 | 1, a: Action): number {
  // A side shut in switches Late, after the other side's action.
  if (a.k === 'switch' && b.s[side].shut) return -1;
  if (a.k === 'switch' || a.k === 'guard' || a.k === 'run') return 2;
  if (a.k === 'wait') return -1;
  if (a.k !== 'move') return 0;
  const f = out(b, side), m = moveDef(f, a.i);
  return m ? orderOf(b, f, m) : 0;
}

/** The order class of f's move in a joint round, 1 Quick, 0 plain, or -1 Late, after any hook that shifts it. */
export function orderOf(b: Battle, f: Fighter, m: MoveDef): number {
  let t = m.quick ? 1 : m.late ? -1 : 0;
  for (const h of hooks(f)) if (h.order) t = h.order(b, f, m, t);
  return t;
}

/**
 * Takes both sides' choices for a joint round. Run, switch, and guard resolve first and quick moves next, at the start of the
 * round. Other choices wait for their own turn on the timeline. A late move waits for the other side's action.
 */
export function actJoint(b: Battle, a0: Action, a1: Action): void {
  if (!b.need || b.need.kind !== 'joint') throw new Error('no joint round');
  remember(b, [a0, a1]);
  // Both sides measuring learn nothing, so the round opens again with Measure left out.
  if (a0.k === 'wait' && a1.k === 'wait') {
    b.measureOff = true;
    msg(b, 'Both sides wait, and neither learns a thing.');
    return;
  }
  b.measureOff = false;
  b.need = null;
  const acts = [a0, a1];
  const items: Queued[] = ([0, 1] as const).map(side => {
    const tier = tierOf(b, side, acts[side]);
    const sched = b.s[side].next;
    return { side, a: acts[side], sched, at: tier > 0 ? b.t : sched, tier, who: out(b, side).idx, rank: 0, kind: 'act' as const };
  });
  const [x, z] = items;
  const lead = x.tier !== z.tier ? (x.tier > z.tier ? 0 : 1) : first(b, { side: 0, at: x.sched }, { side: 1, at: z.sched }, true);
  items[lead].rank = 0;
  items[1 - lead].rank = 1;
  for (const it of items) if (it.tier < 0 && it.a?.k !== 'wait') it.at = Math.max(it.sched, items[1 - it.side].at) + 0.25;
  for (const it of items) if (it.a?.k === 'wait') it.at = Math.max(it.sched, items[1 - it.side].at) + 0.25;
  b.queue = items.sort(queueOrder);
  b.rnd = { n: (b.rnd?.n || 0) + 1, joint: true, commits: [a0, a1], done: [false, false], first: b.queue[0].side };
  emit(b, { e: 'round', joint: true, first: b.queue[0].side });
}

/** Two actions are the same choice when they match in kind, slot, target, switch, aim, and option. A tag-out pick is not compared. */
function sameAction(x: Action, z: Action): boolean {
  if (x.k !== z.k) return false;
  const a = x as { i?: number; target?: number; to?: number; aim?: number; opt?: number }, c = z as typeof a;
  return a.i === c.i && a.target === c.target && a.to === c.to && (a.aim || 0) === (c.aim || 0) && (a.opt ?? -1) === (c.opt ?? -1);
}

/** Whether a choice made at the start of the round can still be taken now. */
function stillLegal(b: Battle, side: 0 | 1, a: Action): boolean {
  if (a.k === 'run') return b.rules.wild;
  if (a.k === 'peg') return b.rules.wild && !out(b, 1).ko && !out(b, 1).gone;
  return legal(b, side).some(x => sameAction(x, a));
}

/** Resolves one choice from a joint round at its turn. A choice the round has overtaken fails or becomes a skip. */
function resolveQueued(b: Battle, q: Queued): void {
  const s = b.s[q.side], f = s.f[s.out];
  b.t = Math.max(b.t, q.at);
  if (f.ko || f.gone) return;
  b.turnBase = q.sched;
  b.acting = q.side;
  const skip = (why: string) => {
    if (why) msg(b, why);
    endTurn(b, q.side, f, 50, 0, 'skip');
    if (b.rnd) b.rnd.done[q.side] = true;
    b.turnBase = null;
  };
  // A whorl the foe moved out or dragged in has no choice of its own this round.
  if (f.idx !== q.who) { skip(`${label(b, f)} has no turn yet.`); return; }
  if (q.kind === 'skip' || f.s.stasis) { skip(''); return; }
  if (f.s.stun) { skip(`${label(b, f)} can't move.`); return; }
  if (f.s.sleep) { skip(`${label(b, f)} is asleep.`); return; }
  let a = q.a, forced = false;
  if (f.forced) {
    const k = f.forced;
    f.forced = null;
    forced = k.k === 'switch';
    a = forcedAction(b, q.side, k.k, k.i);
    if (k.foe && a?.k === 'switch') mark(b, null, s.f[a.to], steadyId('switch'));
    msg(b, `${label(b, f)} can't help it.`);
    if (!a) { skip(''); return; }
  } else if (!a) { skip(''); return; } else if (a.k === 'wait') {
    // Measure: the side chooses now, with the foe's action resolved. turnBase stays until its action resolves.
    b.waited = q.side;
    b.need = { kind: 'act', side: q.side };
    return;
  } else {
    // An aimed hit at a summon that is gone lands on the foe instead.
    if ((a.k === 'attack' || a.k === 'move') && a.aim) {
      const aim = a.aim;
      if (!b.s[1 - q.side].sum.some(u => u.uid === aim)) a = { ...a, aim: undefined };
    }
    if (!stillLegal(b, q.side, a)) { skip(`${label(b, f)} can't do that now.`); return; }
  }
  if (forced) forcedNow++;
  try { doAction(b, q.side, a); } finally { if (forced) forcedNow--; }
  b.turnBase = null;
}

export function replace(b: Battle, side: 0 | 1, idx: number): void {
  const s = b.s[side];
  if (b.need?.kind === 'replace' && b.need.side === side) {
    const pick: Action = { k: 'switch', to: idx };
    remember(b, side === 0 ? [pick, null] : [null, pick]);
    b.need = null;
  }
  const f = s.f[idx];
  if (!f || f.ko || f.gone) return;
  s.out = idx;
  msg(b, `${s.name} sends out ${label(b, f)}.`);
  comeOut(b, f);
  s.next = b.t + Math.max(10, 60 - (f.k.firstBonus || 0));
  f.k.firstBonus = 0;
}

/** Each horn's line, as a share of the target's max HP, and the least chance it has above the line. */
export const HORN_LINE: Record<string, number> = { twig: 0.25, brass: 0.35, bone: 0.5, iron: 1 };
export const HORN_FLOOR: Record<string, number> = { twig: 0.05, brass: 0.08, bone: 0.12 };
/** How far CHA can move a horn's line, how much each point of CHA over the target's moves it, and what a stunned or sleeping target adds. */
export const HORN_CHA_MAX = 0.1, HORN_CHA_STEP = 0.0025, HORN_HELD = 0.1;

export function pegLine(b: Battle, pegger: Fighter, target: Fighter, peg: string): number {
  let line = HORN_LINE[peg] ?? HORN_LINE.twig;
  line += Math.max(-HORN_CHA_MAX, Math.min(HORN_CHA_MAX, (stat(b, pegger, 'cha') - stat(b, target, 'cha')) * HORN_CHA_STEP));
  if (target.s.stun || target.s.sleep) line += HORN_HELD;
  return Math.min(1, line);
}

/**
 * The chance a horn sounds a whorl. At or under the horn's line it always works. Above the line it is a chance that starts
 * small at full health and climbs as the whorl weakens, so a strong team need not stop just short of a knockout.
 */
export function pegChance(b: Battle, pegger: Fighter, target: Fighter, peg: string): number {
  const line = pegLine(b, pegger, target, peg), h = target.hp / target.maxHp;
  if (h <= line) return 1;
  const floor = HORN_FLOOR[peg] ?? HORN_FLOOR.twig;
  return Math.min(1, floor + (1 - floor) * Math.pow(Math.max(0, (1 - h) / (1 - line)), 1.5));
}

/** Applies the choice of the side whose solo turn it is. */
export function act(b: Battle, a: Action): void {
  if (!b.need || b.need.kind !== 'act') throw new Error('nobody is acting');
  const side = b.need.side;
  remember(b, side === 0 ? [a, null] : [null, a]);
  b.need = null;
  const measured = b.waited === side;
  if (measured && b.rnd) b.rnd.commits[side] = a;
  doAction(b, side, a);
  if (measured) { b.waited = null; b.turnBase = null; }
}

/** The mark that shows a whorl lying in wait. */
export const WAITING = 'waiting';
defMark({ id: WAITING, name: 'lying in wait', color: '#c8d8a0', volatile: true, text: 'It strikes first as the foe starts its next action, whatever that action is.' });

/** Sets f to lie in wait: as the other side starts its next action of any kind, f casts move `id` first. */
export function lieInWait(b: Battle, f: Fighter, id: string): void {
  if (f.ko || f.gone || !MOVES[id]) return;
  f.wait = { move: id };
  mark(b, f, f, WAITING, 1, -1);
  msg(b, `${label(b, f)} lies in wait.`);
}

/**
 * A whorl lying in wait strikes as `side` starts any action, a guard or a switch included, so a switch is hit on the whorl going
 * out. Returns true when the actor fell, left, or was stopped, and its action is lost.
 */
function springWait(b: Battle, side: 0 | 1): boolean {
  const w = out(b, (1 - side) as 0 | 1), f = out(b, side);
  if (!w || !w.wait || w.ko || w.gone || !f || f.ko || f.gone) return false;
  const id = w.wait.move;
  w.wait = null;
  unmark(w, WAITING);
  msg(b, `${label(b, w)} strikes as ${label(b, f)} moves.`);
  castMove(b, w, id);
  if (f.ko || f.gone) return true;
  if (out(b, side) !== f || f.s.stun || f.s.sleep) {
    if (out(b, side) === f) msg(b, `${label(b, f)} can't move.`);
    endTurn(b, side, f, 50, 0, 'skip');
    return true;
  }
  return false;
}

/** Resolves one side's action now, in a solo turn or at its place in a joint round. */
function doAction(b: Battle, side: 0 | 1, a: Action): void {
  b.acting = side;
  if (springWait(b, side)) { if (b.rnd) b.rnd.done[side] = true; return; }
  resolveAction(b, side, dizzied(b, side, a));
  if (b.rnd) b.rnd.done[side] = true;
  if (b.over === null) for (const w of everyone(b)) if (hears(b, w, out(b, side))) for (const h of hooks(w)) h.anyAct?.(b, w, side, a);
}

function resolveAction(b: Battle, side: 0 | 1, a: Action): void {
  b.stats.actions++;
  const s = b.s[side];
  const f = s.f[s.out];
  const foe = foeOf(b, f);
  switch (a.k) {
    case 'attack': {
      if (f.takeIn) { holdAction(b, side, f, a, null); return; }
      const target = foe;
      emit(b, { e: 'use', side, idx: f.idx, move: '', name: 'Attack' });
      msg(b, `${label(b, f)} attacks.`);
      b.aim = a.aim ? { side, uid: a.aim } : null;
      doAttack(b, f, target);
      b.aim = null;
      f.k.fresh = 0;
      for (const w of everyone(b)) if (hears(b, w, f)) for (const h of hooks(w)) h.anyMove?.(b, w, f, null);
      if (b.over !== null) { b.acting = null; return; }
      endTurn(b, side, f, 100, 0, 'attack');
      return;
    }
    case 'guard': {
      f.k.guardedLast = 2;
      f.s.guard = { n: 1 };
      f.k.guardPaid = 0;
      emit(b, { e: 'guard', side, idx: f.idx });
      msg(b, `${label(b, f)} guards.`);
      for (const h of hooks(f)) h.afterGuard?.(b, f);
      const w = quickWeight(b, f, 'guard', 80);
      endTurn(b, side, f, w, 0, 'guard');
      return;
    }
    case 'switch': {
      const base = switchWeight(b, s.f[a.to]);
      const w = quickWeight(b, f, 'switch', b.s[side].charm === 'tusk' ? Math.round(base * 0.8) : base);
      const leaving = f;
      if (has(leaving, 'clearing')) sk(b, side).hasteNext = 1;
      doSwitch(b, side, a.to);
      endTurn(b, side, leaving, w, 0, 'switch');
      return;
    }
    case 'run': {
      msg(b, `${b.s[0].name} gets away.`);
      b.over = 'run';
      b.acting = null;
      return;
    }
    case 'peg': {
      const t = foe;
      // Sounding is the one roll in battle. A seed that started the same every battle made the first horn always work.
      const chance = pegChance(b, f, t, a.peg);
      if (chance >= 1 || Math.random() < chance) {
        t.gone = true;
        b.pegged.push(t.idx);
        emit(b, { e: 'peg', idx: t.idx });
        msg(b, `${b.s[0].name} sounds ${t.mon.name}.`);
        if (standing(b.s[1]).length === 0) b.over = 'peg';
      } else {
        msg(b, `${t.mon.name} won't curl into the horn.`);
      }
      endTurn(b, side, f, 100, 0, 'peg');
      return;
    }
    case 'take': {
      const k = (b.drops || []).findIndex(d => d.uid === a.i);
      const d = k >= 0 ? b.drops!.splice(k, 1)[0] : null;
      if (!d || !DROPS[d.id]) msg(b, 'It is gone.');
      else { msg(b, `${label(b, f)} takes the ${DROPS[d.id].name}.`); DROPS[d.id].take(b, f); }
      endTurn(b, side, f, 100, 0, 'take');
      return;
    }
    case 'wait': {
      msg(b, `${label(b, f)} waits.`);
      endTurn(b, side, f, 50, 0, 'skip');
      return;
    }
    case 'notion': {
      const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
      const uses = s.charm === 'pylon' && !n?.spent ? 2 : 1;
      if (n?.action && (f.k.notionUsed || 0) < uses) {
        f.k.notionUsed = (f.k.notionUsed || 0) + 1;
        msg(b, `${label(b, f)} uses its ${n.name}.`);
        n.action.run(b, f);
      }
      endTurn(b, side, f, 50, 0, 'notion');
      return;
    }
    case 'move': {
      const m = moveDef(f, a.i)!;
      const u = usable(b, f, a.i);
      if (!u.ok) { msg(b, u.why); endTurn(b, side, f, 100); return; }
      // Overdrive: a move used while it still cools down costs HP first.
      const od = overdriveCost(b, f, a.i);
      if (od > 0) { f.hp -= od; emit(b, { e: 'dmg', side, idx: f.idx, amt: od, kind: 'T', eff: 1, shield: 0 }); msg(b, `${label(b, f)} overdrives ${m.name}.`); }
      if (m.nerve) { payTide(b, side, tideCost(b, f, m)); b.stats.bigMoves++; }
      if (m.wu) (b.stats as any).windups = ((b.stats as any).windups || 0) + 1;
      const free = hooks(f).some(h => h.freeCooldown?.(b, f, m));
      let cd = m.cd;
      for (const h of hooks(f)) if (h.cooldown) cd = Math.max(0, Math.round(h.cooldown(b, f, m, cd)));
      f.cd[a.i] = free ? 0 : cd + 1;
      // A move with shots fires with no wait until its last shot, which starts the cooldown and refills it.
      if (m.ammo && !free) {
        const left = ammoOf(f, a.i) - 1, am = (f.ammo ||= f.moves.map(() => -1));
        if (left > 0) { am[a.i] = left; f.cd[a.i] = 0; } else am[a.i] = m.ammo;
      }
      f.movesUsed++;
      f.k.lastMove = a.i + 1;
      if ((f.spore?.[a.i] || 0) > 0) { msg(b, `Spores puff out of ${m.name}.`); applyStatus(b, null, f, 'poison', 2); }
      if (f.takeIn) { holdAction(b, side, f, a, m); return; }
      const unstop = !!m.unstop || (!!f.k.fresh && has(f, 'perihelion'));
      if (m.wu) {
        emit(b, { e: 'wind', side, idx: f.idx, move: m.id });
        msg(b, `${label(b, f)} winds up ${m.name}.`);
        let wu = b.s[side].charm === 'spire' ? Math.round(m.wu * 0.75) : m.wu;
        const aimed = out(b, side ? 0 : 1);
        if (aimed.mon.notion === 'reedplug' && !aimed.k.plug) { aimed.k.plug = 1; wu = Math.round(wu * 1.5); }
        b.pend.push({ id: b.pid++, at: b.t + wu, kind: 'windup', side, idx: f.idx, move: m.id, data: { target: a.target ?? -1, aim: a.aim ?? 0, opt: a.opt ?? -1 }, unstop });
        const wp = b.pend[b.pend.length - 1];
        for (const w of everyone(b)) if (w !== f && hears(b, w, f)) for (const h of hooks(w)) h.anyWindup?.(b, w, f, m, wp);
        endTurn(b, side, f, m.wt || 100, Math.round(wu / 2), 'windup');
        return;
      }
      emit(b, { e: 'use', side, idx: f.idx, move: m.id, name: m.name, opt: a.opt ?? m.fxPick?.(b, f) });
      msg(b, `${label(b, f)} uses ${m.name}.`);
      rollIn(b, f, m);
      b.aim = a.aim ? { side, uid: a.aim } : null;
      dashIn(b, f, m);
      const high = outOfReach(b, f, m), thief = high ? null : snatcher(b, f, m);
      if (high) msg(b, `${label(b, f)} can't reach ${label(b, high)} up there.`);
      else if (thief) { msg(b, `${label(b, thief)} rolls off with ${m.name}.`); castMove(b, thief, m.id); }
      else runMove(b, f, a.i, a);
      b.aim = null;
      if (f.k.fresh && !f.ko) f.k.fresh = 0;
      chainOn(b, f, m);
      for (const w of everyone(b)) if (hears(b, w, f)) for (const h of hooks(w)) h.anyMove?.(b, w, f, m);
      if (m.tag && !f.ko && isOut(b, f) && b.over === null) {
        const to = calledOf(s)?.idx ?? a.tagTo ?? (m.reach === 'reserveAlly' ? a.target : undefined) ?? nextInLine(s);
        if (to !== undefined && to >= 0 && to !== s.out && !s.f[to].ko && !s.f[to].gone && !barred(s.f[to]) && !s.cut && !(f.s.root || f.s.taunt)) {
          if (has(f, 'clearing')) sk(b, side).hasteNext = 1;
          doSwitch(b, side, to);
        }
      }
      if (b.over === null) endTurn(b, side, f, m.wt || 100, 0, 'move');
      else b.acting = null;
      return;
    }
  }
}

function quickWeight(b: Battle, f: Fighter, act: 'guard' | 'switch', w: number): number {
  for (const h of hooks(f)) {
    const q = h.quickWeight?.(f, act);
    if (q !== null && q !== undefined) w = Math.min(w, q);
  }
  return w;
}

export function doAttack(b: Battle, f: Fighter, t: Fighter, power = 1): void {
  const kind = basicOf(f);
  const stat0 = kind === 'P' ? stat(b, f, 'atk') : stat(b, f, 'mgk');
  let vol: { hits: number; per: number } | null = null;
  for (const hk of hooks(f)) { vol = hk.volley?.(b, f, t) || null; if (vol) break; }
  const hits = vol ? Math.max(1, vol.hits) : has(f, 'downpour') ? 2 : 1;
  const per = vol ? vol.per : hits === 2 ? 0.5 : 1;
  let landed = false, shots = 0;
  for (let h = 0; h < hits; h++) {
    if (t.ko || t.gone) break;
    if (t.s.stasis) { msg(b, `${label(b, t)} can't be touched.`); break; }
    let raw = stat0 * per;
    const info: DmgInfo = { kind, move: null, attack: true, dot: false, spread: false, reserve: false };
    for (const hk of hooks(f)) if (hk.addRaw) raw += hk.addRaw(b, f, t, info) * per;
    if (f.k.stroke) raw *= 1.5;
    if (f.k.nextAtkMul) raw *= f.k.nextAtkMul;
    const dealt = dealDamage(b, f, t, raw, info, null, power);
    if (dealt > 0) landed = true;
    shots++;
  }
  // Per-attack habits run once for each Attack, however many shots a volley fires.
  if (shots > 0) for (const hk of hooks(f)) hk.afterAttack?.(b, f, t);
  if (f.k.stroke) { f.k.stroke = 0; hastenFighter(b, f, 20); }
  if (f.k.nextAtkMul) {
    f.k.nextAtkMul = 0;
    if (f.k.nextAtkSlow && !t.ko) applyStatus(b, f, t, 'slow', f.k.nextAtkSlow);
    f.k.nextAtkSlow = 0;
  }
  if (f.k.edge) f.k.edge = 0;
  if (f.k.escape) f.k.escape = 0;
  if (landed && power === 1 && !b.lowWater) addNerve(b, f.side, 1);
  if (has(f, 'corona') && !t.ko && !t.gone && landed) {
    dealDamage(b, f, t, stat(b, f, 'mgk') * 0.25, { kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
  }
  if (has(t, 'static') && landed && !f.ko) {
    reflect(b, t, f, stat(b, t, 'mgk') * 0.3);
  }
}

// ---------------------------------------------------------------- choices

export function legal(b: Battle, side: 0 | 1): Action[] {
  const s = b.s[side];
  const f = s.f[s.out];
  // Summons on the other side that single-target attacks and moves may be aimed at.
  const aims = b.s[1 - side].sum.filter(aimable).map(u => u.uid);
  const out: Action[] = [{ k: 'attack' }, ...aims.map(aim => ({ k: 'attack' as const, aim }))];
  if (f.s.taunt && !f.s.unstop) return out.slice(0, 1);
  for (let i = 0; i < f.moves.length; i++) {
    if (!usable(b, f, i).ok) continue;
    const m = moveDef(f, i)!;
    const tk = targetKind(f, m);
    if (tk === 'ally') { for (const a of standing(s)) out.push({ k: 'move', i, target: a.idx }); }
    else if (tk === 'reserveAlly') { for (const a of reserves(s)) out.push({ k: 'move', i, target: a.idx }); }
    else if (tk === 'enemyReserve') { for (const a of reserves(b.s[1 - side])) out.push({ k: 'move', i, target: a.idx }); }
    else if (tk === 'enemyAny') { for (const a of standing(b.s[1 - side])) out.push({ k: 'move', i, target: a.idx }); }
    else if (m.options) { m.options(b, f).forEach((_, opt) => out.push({ k: 'move', i, opt })); }
    else { out.push({ k: 'move', i }); if (m.reach === 'single') for (const aim of aims) out.push({ k: 'move', i, aim }); }
  }
  if (canGuard(f, b)) out.push({ k: 'guard' });
  const called = calledOf(s);
  if (canSwitch(b, f)) for (const r of reserves(s)) if (!barred(r) && (!called || r === called)) out.push({ k: 'switch', to: r.idx });
  const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
  if (n?.action && (f.k.notionUsed || 0) < (s.charm === 'pylon' && !n.spent ? 2 : 1)) out.push({ k: 'notion' });
  for (const d of b.drops || []) out.push({ k: 'take', i: d.uid });
  if (b.need?.kind === 'joint' && !b.measureOff && hooks(f).some(h => h.waits?.(b, f))) out.push({ k: 'wait' });
  if (out.some(a => a.k !== 'attack') && forbidden(b, f, 'attack')) return out.filter(a => a.k !== 'attack');
  return out;
}

/** The legal action that `a` names for `side` now (keeping a tag-out only when it names a reserve the tag can reach) or null. */
export function legalMatch(b: Battle, side: 0 | 1, a: Action): Action | null {
  if (!a || typeof a !== 'object') return null;
  const hit = legal(b, side).find(x => sameAction(x, a));
  const to = (a as { tagTo?: unknown }).tagTo;
  if (!hit || to === undefined) return hit ?? null;
  // `resolveAction` reads s.f[tagTo] with no range check, so a tag-out must name a reserve the tag screen would offer.
  const s = b.s[side], called = calledOf(s);
  const tag = hit.k === 'move' && !!moveDef(out(b, side), hit.i)?.tag;
  return tag && reserves(s).some(r => r.idx === to && !barred(r) && (!called || r === called)) ? { ...hit, tagTo: to as number } : null;
}

/** Whether `side` may make choice `a` at the decision the battle waits on. */
export function isLegal(b: Battle, side: 0 | 1, a: Action): boolean {
  return legalMatch(b, side, a) !== null;
}

/** The indexes `side` may send out in place of its fallen one: the called whorl if one is called and otherwise the standing whorls that are not buried (or the buried ones when no other stands). */
export function replaceChoices(b: Battle, side: 0 | 1): number[] {
  const s = b.s[side], rs = standing(s).filter(f => f.idx !== s.out), called = calledOf(s);
  if (called) return [called.idx];
  const free = rs.filter(f => !barred(f));
  return (free.length ? free : rs).map(f => f.idx);
}

/** Previews an action: returns the battle after the action resolves at once. In a joint round it previews side 0's choice alone. */
export function preview(b: Battle, a: Action, who?: 0 | 1): Battle {
  const c = clone(b);
  const side: 0 | 1 = who ?? (c.need?.kind === 'act' ? c.need.side : 0);
  if (c.need?.kind === 'joint') c.need = { kind: 'act', side };
  if (a.k === 'move') {
    const f = out(c, side);
    const m = moveDef(f, a.i);
    if (m?.wu) {
      c.need = null;
      c.acting = side;
      runMove(c, f, a.i, a, true);
      c.acting = null;
      return c;
    }
  }
  act(c, a);
  return c;
}

/** The next few turns on the timeline, assuming normal actions. */
export function forecast(b: Battle, n: number): { side: 0 | 1; idx: number; at: number; wind?: string }[] {
  const res: { side: 0 | 1; idx: number; at: number; wind?: string }[] = [];
  const nx = [b.s[0].next, b.s[1].next];
  for (const p of b.pend) if (p.kind === 'windup') res.push({ side: p.side, idx: p.idx, at: p.at, wind: p.move });
  for (let k = 0; k < n; k++) {
    const side: 0 | 1 = nx[0] <= nx[1] ? 0 : 1;
    const f = out(b, side);
    res.push({ side, idx: f.idx, at: nx[side] });
    nx[side] += ticks(b, f, 100);
  }
  res.sort((a, z) => a.at - z.at || (a.wind ? -1 : 1));
  return res.slice(0, n);
}
