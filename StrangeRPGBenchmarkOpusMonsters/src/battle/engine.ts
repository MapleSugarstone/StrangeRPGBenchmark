import { statsAt, typeMult, type Stats, type Type } from '../data/types';
import { profileOf } from '../data/profiles';
import type { Action, Battle, Decision, Ev, Fighter, Form, MarkVal, Mon, Pending, Rules, Side, SpriteData, StatusId, Summon } from './model';
import { MARKS, MOVES, NOTIONS, PASSIVES, SUMMONS, type Ctx, type DmgInfo, type HitOpts, type Hooks, type MoveDef, type Ratio } from './registry';

export const SPREAD_SHARE = 0.35;
export const NERVE_MAX = 10;
/** Nacre: a layer adds the same flat points to any stat, TAN_POINTS at the top level and scaled down the shared curve below it. */
export const TAN_POINTS = 2;
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
export const FIT_STAT = 0.99;

const CC: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow'];
const INTERRUPTS: StatusId[] = ['stun', 'silence', 'sleep', 'taunt'];
const VOLATILE: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'haste', 'expose', 'weaken', 'empower', 'fortify', 'guard', 'unstop', 'thorns', 'invuln', 'monument', 'stasis', 'revealed'];
const NEGATIVE: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'burn', 'bleed', 'poison', 'rot', 'expose', 'weaken', 'doom'];
const STACKING: StatusId[] = ['bleed', 'poison'];

export const STATUS_NAME: Record<string, string> = {
  stun: 'stunned', silence: 'silenced', sleep: 'asleep', root: 'rooted', taunt: 'taunted', slow: 'slowed', haste: 'hasted',
  burn: 'burning', bleed: 'bleeding', poison: 'poisoned', rot: 'rotting', expose: 'exposed', weaken: 'weakened',
  fortify: 'fortified', empower: 'empowered', stasis: 'in stasis', unstop: 'unstoppable', ward: 'warded',
  thorns: 'thorned', regen: 'regenerating', invuln: 'untouchable', doom: 'doomed', monument: 'monumental', guard: 'guarding',
  hidden: 'hidden', revealed: 'revealed',
};

/** Hidden has ended. Revealed lasts through the whorl's next turn, so two hiding moves can't chain into hiding for good. */
function reveal(b: Battle, f: Fighter): void {
  delete f.s.hidden;
  f.s.revealed = { n: 1, src: f.turns };
  emit(b, { e: 'status', side: f.side, idx: f.idx, id: 'revealed' });
}

// ---------------------------------------------------------------- setup

// ---------------------------------------------------------------- identity: forms, borrowed bodies, disguises

/** Above 0 while a move plays again at reduced power (Habit, First Showing, Wading). Such a replay never changes a body. */
let replaying = 0;

export const typesOf = (f: Fighter): Type[] => f.form?.types || f.mon.types;
export const passivesOf = (f: Fighter): string[] => f.form?.passives || f.mon.passives;
export const nameOf = (f: Fighter): string => f.form?.name || f.mon.name;
export const basicOf = (f: Fighter): 'P' | 'M' => f.form?.basic || f.mon.basic;
export const spriteOf = (f: Fighter): SpriteData => f.form?.sprite || f.mon.sprite;
/** What the other side sees and hits: the disguise when there is one. */
export const seenTypes = (f: Fighter): Type[] => f.disguise?.types || typesOf(f);
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

/** Takes the look, types, passives, and moves of another fighter, usually one just KO'd. */
export function takeOver(b: Battle, f: Fighter, from: Fighter, tag = 'taken'): void {
  setForm(b, f, { tag, name: nameOf(from), sprite: spriteOf(from), types: typesOf(from).slice(), passives: passivesOf(from).slice(), basic: basicOf(from) }, from.moves.slice());
}

/** Shows the other side `as` instead of `f` (an ally, usually), until called again with null. Hits on `f` use the disguise's types. */
export function disguise(b: Battle, f: Fighter, as: Fighter | null): void {
  if (replaying && as) return;
  f.disguise = as ? { name: nameOf(as), sprite: spriteOf(as), types: typesOf(as).slice(), passives: passivesOf(as).slice(), moves: as.moves.slice() } : null;
  void b;
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
  u.moves = (opts.moves || f.moves).filter(m => MOVES[m] && !MOVES[m].nerve && !MOVES[m].wu && !MOVES[m].tag && MOVES[m].reach !== 'reserveAlly' && MOVES[m].reach !== 'dragin');
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
  emit(b, { e: 'use', side: owner.side, idx: owner.idx, move: m.id, name: m.name });
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
  t.gone = true;
  t.k.banished = turns;
  t.k.banishBy = by ? by.side * 8 + by.idx + 1 : 0;
  b.pend = b.pend.filter(p => !(p.side === t.side && p.idx === t.idx));
  msg(b, `${label(b, t)} is taken off the field.`);
}

/** Counts down banished fighters at the start of their side's turn and brings back any whose time is up. */
function tickBanished(b: Battle, side: 0 | 1): void {
  const s = b.s[side];
  for (const t of s.f) {
    if (!t.gone || !t.k.banished || --t.k.banished > 0) continue;
    t.gone = false;
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

/** Fear and charm: the fighter's next turn is this action instead of a choice. A switch goes to the next in line. */
export function forceAction(b: Battle, t: Fighter, k: 'switch' | 'guard' | 'attack' | 'skip'): void {
  if (t.ko || t.gone || immuneTo(b, t, 'stun')) return;
  t.forced = { k };
}

/** The action a forced fighter takes, or null for a skipped turn. */
function forcedAction(b: Battle, side: 0 | 1, k: 'switch' | 'guard' | 'attack' | 'skip'): Action | null {
  const s = b.s[side];
  if (k === 'switch') { const to = nextInLine(s); if (to >= 0 && to !== s.out) return { k: 'switch', to }; return { k: 'guard' }; }
  if (k === 'guard') return { k: 'guard' };
  if (k === 'attack') return { k: 'attack' };
  return null;
}

export function hooks(f: Fighter): Hooks[] {
  const out: Hooks[] = [];
  for (const p of passivesOf(f)) if (PASSIVES[p]) out.push(PASSIVES[p]);
  if (f.mon.notion && NOTIONS[f.mon.notion]) out.push(NOTIONS[f.mon.notion]);
  for (const id of f.items || []) if (NOTIONS[id]) out.push(NOTIONS[id]);
  for (const id in f.m) if (MARKS[id]) out.push(MARKS[id]);
  return out;
}

/** Every standing fighter on both sides, out sloughs first. */
function everyone(b: Battle): Fighter[] {
  const o = [out(b, 0), out(b, 1)].filter(f => !f.ko && !f.gone);
  return [...o, ...reserves(b.s[0]), ...reserves(b.s[1])];
}

export function has(f: Fighter, passive: string): boolean {
  return passivesOf(f).includes(passive) || f.mon.notion === passive;
}

export function makeFighter(mon: Mon, side: 0 | 1, idx: number, sync: boolean): Fighter {
  const lv = sync ? 25 : mon.level;
  const st: Stats = { ...statsAt(lv, profileOf(mon)) };
  const n = mon.notion ? NOTIONS[mon.notion] : null;
  if (n?.flat) for (const [k, v] of Object.entries(n.flat)) (st as any)[k] += v;
  if (n?.pct) for (const [k, v] of Object.entries(n.pct)) (st as any)[k] = Math.round((st as any)[k] * (1 + (v || 0)));
  if (mon.tan) for (const [k, v] of Object.entries(mon.tan)) (st as any)[k] += tanBonus(lv, k, v || 0);
  if (mon.fitted) for (const k of Object.keys(st)) (st as any)[k] = Math.round((st as any)[k] * FIT_STAT);
  return {
    side, idx, mon, moves: mon.moves.slice(), m: {}, st, maxHp: st.hp, hp: st.hp, shield: 0, shieldTurns: 0, ko: false, gone: false,
    cd: mon.moves.map(() => 0), s: {}, k: { prevTurn: -1, curTurn: -1 }, outAt: -1, turns: 0, movesUsed: 0,
  };
}

export interface SideSpec { mons: Mon[]; name: string; ai: Side['ai']; charm?: string | null; wild?: boolean; player?: boolean }

export function newBattle(a: SideSpec, z: SideSpec, rules: Rules): Battle {
  const mk = (sp: SideSpec, side: 0 | 1): Side => ({
    f: sp.mons.map((m, i) => makeFighter(m, side, i, rules.sync)),
    sum: [], out: 0, nerve: rules.nerve ? 2 + (sp.charm === 'mast' ? 2 : 0) : 0, next: 0, caps: 0,
    name: sp.name, ai: sp.ai, charm: sp.charm ?? null, wild: !!sp.wild, player: !!sp.player,
  });
  const b: Battle = {
    t: 0, s: [mk(a, 0), mk(z, 1)], pend: [], ev: [], quiet: false, rules, over: null, need: null, pid: 1, turnNo: 0,
    acting: null, pegged: [],
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
    s.next = ticks(b, f, 50) + side * 0.5 - (s.charm === 'fall' ? 25 : 0) - (f.k.firstBonus || 0);
    f.k.firstBonus = 0;
  }
  return b;
}

/** Per-side scratch values that are not part of the documented model. */
export function sk(b: Battle, side: 0 | 1): Record<string, number> {
  return (b as any).sk[side];
}

export function clone(b: Battle): Battle {
  const cf = (f: Fighter): Fighter => {
    const m: Fighter['m'] = {};
    for (const id in f.m) m[id] = { ...f.m[id] };
    return { ...f, st: { ...f.st }, cd: f.cd.slice(), moves: f.moves.slice(), m, s: cloneStatus(f.s), k: { ...f.k }, items: f.items?.slice() };
  };
  const cs = (s: Side): Side => ({ ...s, f: s.f.map(cf), sum: s.sum.map(x => ({ ...x, moves: x.moves?.slice(), cd: x.cd?.slice() })) });
  const c: Battle = {
    ...b, s: [cs(b.s[0]), cs(b.s[1])], pend: b.pend.map(p => ({ ...p, data: p.data ? { ...p.data } : undefined })),
    ev: [], quiet: true, need: b.need ? { ...b.need } as Decision : null, pegged: b.pegged.slice(), stats: { ...b.stats, kos: [b.stats.kos[0], b.stats.kos[1]] },
  };
  (c as any).sk = [{ ...(b as any).sk[0] }, { ...(b as any).sk[1] }];
  return c;
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

export function reserves(s: Side): Fighter[] {
  return s.f.filter((f, i) => i !== s.out && !f.ko && !f.gone);
}

export function isOut(b: Battle, f: Fighter): boolean {
  return b.s[f.side].out === f.idx && !f.ko && !f.gone;
}

export function emit(b: Battle, e: Ev): void {
  if (!b.quiet) b.ev.push(e);
}

export function label(b: Battle, f: Fighter): string {
  const s = b.s[f.side];
  if (s.player) return nameOf(f);
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
  if (k === 'agi' && isOut(b, f)) {
    for (const r of reserves(b.s[f.side])) if (has(r, 'tailwind')) v += 5;
  }
  return v;
}

export function moveType(f: Fighter, m: MoveDef): Type {
  if (f.mon.retune && f.mon.retune.move === m.id) return f.mon.retune.type;
  return m.type;
}

/** A move's text as the player reads it. A move that hits every foe says what share its reserves take, unless its text says so already. */
export function moveText(m: MoveDef, passives: string[] = []): string {
  if (m.reach !== 'spread' || !/every foe/i.test(m.text) || /reserve/i.test(m.text)) return m.text;
  return `${m.text} Reserves take ${Math.round((passives.includes('conductive') ? 0.5 : SPREAD_SHARE) * 100)}% of it.`;
}

/** What a move counts as for habits that block or change dashes, projectiles, and spells, such as "Dash. Spell." */
export function moveKinds(m: MoveDef): string {
  const names: Record<string, string> = { dash: 'Dash', projectile: 'Projectile', spell: 'Spell' };
  return (m.tags || []).filter(t => names[t]).map(t => names[t] + '.').join(' ');
}

export function ticks(b: Battle, f: Fighter, weight: number): number {
  let w = weight * 200 / (stat(b, f, 'agi') + 100);
  const slow = f.s.slow && !f.s.unstop && !hooks(f).some(h => h.statusImmune?.(f, 'slow'));
  if (slow) w *= 1.3;
  if (f.s.haste) w *= 0.7;
  return Math.round(w);
}

export function addNerve(b: Battle, side: 0 | 1, n: number): void {
  if (!b.rules.nerve || n === 0) return;
  const s = b.s[side];
  const before = s.nerve;
  s.nerve = Math.max(0, Math.min(NERVE_MAX, s.nerve + n));
  if (s.nerve !== before) emit(b, { e: 'nerve', side, n: s.nerve - before });
}

function rawOf(b: Battle, u: Fighter, t: Fighter, r: Ratio): number {
  let v = r.flat || 0;
  if (r.atk) v += r.atk * stat(b, u, 'atk');
  if (r.mgk) v += r.mgk * stat(b, u, 'mgk');
  if (r.def) v += r.def * stat(b, u, 'def');
  if (r.cha) v += r.cha * stat(b, u, 'cha');
  if (r.selfHp) v += r.selfHp * u.maxHp;
  if (r.tgtHp) v += r.tgtHp * t.maxHp;
  if (r.tgtMiss) v += r.tgtMiss * (t.maxHp - t.hp);
  if (r.tgtCur) v += r.tgtCur * t.hp;
  return v;
}

export function cameOutSince(b: Battle, tgt: Fighter, f: Fighter): boolean {
  return tgt.outAt > (f.k.prevTurn ?? -1);
}

// ---------------------------------------------------------------- damage

export function dealDamage(
  b: Battle, src: Fighter | null, tgt: Fighter, raw: number, info: DmgInfo, mtype: Type | null, mult = 1, noGuard = false,
): number {
  if (tgt.ko || tgt.gone || raw <= 0) return 0;
  if (tgt.s.stasis) return 0;
  // An aimed action sends its single-target hits to the summon it picked.
  if (b.aim && src && src.side === b.aim.side && tgt.side !== src.side && !info.dot && !info.spread && !info.reserve && isOut(b, tgt)) {
    const aimed = b.s[tgt.side].sum.find(u => u.uid === b.aim!.uid);
    if (aimed) return hitSummon(b, aimed, raw * mult * SUMMON_TAKE);
  }
  // A guarding summon takes single-target hits meant for its side's out whorl, and spread hits splash onto every summon there.
  const guard = src && src.side !== tgt.side && !info.dot && !info.spread && !info.reserve && info.kind !== 'T' && isOut(b, tgt)
    ? b.s[tgt.side].sum.find(u => SUMMONS[u.def]?.guard) : undefined;
  if (guard) {
    const amt = raw * mult * SUMMON_TAKE;
    if (!SUMMONS[guard.def]?.spill || amt <= guard.hp) return hitSummon(b, guard, amt);
    // A spilling guard soaks what its HP allows and the rest of the hit carries on to the whorl.
    raw *= 1 - guard.hp / amt;
    hitSummon(b, guard, guard.hp);
  }
  if (src && info.spread && isOut(b, tgt)) for (const u of b.s[tgt.side].sum.slice()) hitSummon(b, u, raw * mult * SPREAD_SHARE * SUMMON_TAKE);
  // Hidden: single-target hits from the other side cannot find it. Its own first hit out of hiding ignores guard and ends the hiding.
  if (tgt.s.hidden && src && src.side !== tgt.side && !info.spread && !info.dot && !info.reserve) { msg(b, `${label(b, src)} can't find ${label(b, tgt)}.`); return 0; }
  if (src && src.s.hidden && src.side !== tgt.side && !info.dot) { noGuard = true; reveal(b, src); }
  let d = raw * mult;
  let kind = info.kind;
  if (src && kind !== 'T' && has(src, 'watch') && tgt.hp < tgt.maxHp * 0.3) kind = 'T';
  if (kind !== 'T') {
    if (mtype && !info.dot) {
      d *= typeMult(mtype, seenTypes(tgt));
      if (src && typesOf(src).includes(mtype)) d *= 1.2;
    }
    const pen = src && has(src, 'bodkin') ? 0.3 : 0;
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
      for (const r of reserves(b.s[src.side])) for (const h of hooks(r)) if (h.auraOut) d *= h.auraOut(b, r, src, tgt, info);
    }
    if (b.s[src.side].charm === 'bole' && src.mon.fitted) d *= 1.08;
  }
  for (const h of hooks(tgt)) if (h.inMul) d *= h.inMul(b, tgt, src, info);
  if (!info.dot) {
    if (tgt.s.guard && !noGuard) d *= 0.5;
    const orbit = src && has(src, 'orbit');
    if (tgt.s.fortify && !orbit) d *= 1 - (tgt.s.fortify.v || 0.25);
    if (tgt.s.expose) d *= 1.25;
    if (tgt.k.illwind && tgt.s.doom) d *= 1.15;
  }
  if (isOut(b, tgt)) {
    for (const r of reserves(b.s[tgt.side])) for (const h of hooks(r)) if (h.auraIn) d *= h.auraIn(b, r, tgt, src, info);
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

  let toShield = 0;
  if (tgt.shield > 0) {
    toShield = Math.min(tgt.shield, amt);
    tgt.shield -= toShield;
    if (tgt.shield <= 0) { tgt.shield = 0; tgt.shieldTurns = 0; }
  }
  const toHp = amt - toShield;
  const before = tgt.hp;
  tgt.hp -= toHp;
  if (src) src.k.dealt = (src.k.dealt || 0) + amt;
  emit(b, { e: 'dmg', side: tgt.side, idx: tgt.idx, amt, kind, eff: mtype && kind !== 'T' && !info.dot ? typeMult(mtype, seenTypes(tgt)) : 1, shield: toShield });
  if (tgt.s.sleep) { delete tgt.s.sleep; msg(b, `${label(b, tgt)} wakes up.`); }
  if (tgt.s.guard && !info.dot && info.move && !tgt.k.guardPaid) {
    tgt.k.guardPaid = 1;
    addNerve(b, tgt.side, 1);
  }
  if (!info.dot && !info.reserve) {
    for (const h of hooks(tgt)) h.afterTake?.(b, tgt, src, amt, info);
    if (src && src !== tgt) {
      if (tgt.s.thorns && !(info as any).reflect && !tgt.ko) {
        reflect(b, tgt, src, amt * (tgt.s.thorns.v || 0.3));
      }
      for (const h of hooks(src)) h.afterDeal?.(b, src, tgt, amt, info);
    }
  }
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
  if (tgt.hp <= 0) handleKO(b, tgt, src, amt);
  return amt;
}

export function reflect(b: Battle, from: Fighter, to: Fighter, raw: number): void {
  if (raw <= 0 || to.ko) return;
  const info: DmgInfo & { reflect: boolean } = { kind: 'M', move: null, attack: false, dot: true, spread: false, reserve: false, reflect: true };
  dealDamage(b, from, to, raw, info, null);
}

export function handleKO(b: Battle, t: Fighter, src: Fighter | null, dmg: number): void {
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
  }
  // Each side gets one second chance a battle. Later saves still spend themselves but do not stop the KO.
  let saved = false;
  for (const h of hooks(t)) if (h.wouldKO && h.wouldKO(b, t, src)) { saved = true; break; }
  if (saved && !sk(b, t.side).saved) { sk(b, t.side).saved = 1; return; }
  if (saved) msg(b, `${label(b, t)} has no second chance left.`);
  t.hp = 0;
  t.ko = true;
  t.shield = 0;
  t.k.diedPoison = t.s.poison?.n || 0;
  t.s = {};
  t.m = {};
  b.pend = b.pend.filter(p => !(p.side === t.side && p.idx === t.idx));
  for (const u of b.s[t.side].sum.filter(x => x.by === t.idx && !SUMMONS[x.def]?.lasting)) dismiss(b, u);
  emit(b, { e: 'ko', side: t.side, idx: t.idx });
  msg(b, `${label(b, t)} is down.`);
  b.stats.kos[t.side]++;
  if (src && src.side !== t.side) addNerve(b, src.side, 2);
  addNerve(b, t.side, 1);
  for (const side of [0, 1] as const) {
    for (const f of b.s[side].f) {
      if (f.ko || f.gone) continue;
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

export function applyStatus(b: Battle, src: Fighter | null, t: Fighter, id: string, n: number, v?: number): boolean {
  if (t.ko || t.gone) return false;
  // An action aimed at a summon spends its statuses on the summon, which carries none.
  if (b.aim && src && src.side === b.aim.side && t.side !== src.side) return false;
  if (immuneTo(b, t, id)) {
    if (!b.quiet && (CC as string[]).includes(id)) msg(b, `${label(b, t)} isn't ${STATUS_NAME[id] || id}.`);
    return false;
  }
  if (id === 'hidden' && (t.s.hidden || t.s.revealed)) {
    if (!b.quiet) msg(b, t.s.hidden ? `${label(b, t)} is already hidden.` : `${label(b, t)} can't hide again yet.`);
    return false;
  }
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
  } else {
    const mine = b.acting === t.side && isOut(b, t);
    t.s[sid] = { n: Math.max(cur?.n || 0, n), v: Math.max(cur?.v || 0, v || 0), src: mine ? t.turns : -1 };
  }
  if (id === 'taunt' && src) t.k.tauntBy = src.side;
  emit(b, { e: 'status', side: t.side, idx: t.idx, id });
  if ((INTERRUPTS as string[]).includes(id)) interrupt(b, t, src);
  if (id === 'stun' && src) {
    if (has(src, 'bedrock')) addNerve(b, src.side, 1);
    if (has(src, 'trample')) trample(b, src);
  }
  if (src) for (const h of hooks(src)) h.afterApply?.(b, src, t, id);
  if (!t.ko) for (const h of hooks(t)) h.afterGet?.(b, t, src, id);
  return true;
}

// ---------------------------------------------------------------- marks

/** Adds stacks of a kit mark. Refreshes its turns to the longer of old and new. */
export function mark(b: Battle, src: Fighter | null, t: Fighter, id: string, n = 1, turns = -1, v = 0): boolean {
  const def = MARKS[id];
  if (!def) throw new Error(`unknown mark ${id}`);
  if (t.ko || t.gone) return false;
  const cur = t.m[id];
  const max = def.max ?? 99;
  const t2 = cur ? (cur.t < 0 || turns < 0 ? -1 : Math.max(cur.t, turns)) : turns;
  t.m[id] = { n: Math.min(max, (cur?.n || 0) + n), v: v || cur?.v || 0, t: t2, by: src ? src.side * 8 + src.idx : -1, at: b.turnNo };
  if (def.name && !b.quiet) emit(b, { e: 'status', side: t.side, idx: t.idx, id });
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
  for (const id of Object.keys(f.m)) {
    const mk = f.m[id];
    const def = MARKS[id];
    if (!mk || !def || mk.t < 0 || mk.at === b.turnNo) continue;
    if (!clocks.includes(def.clock || 'own')) continue;
    mk.t--;
    if (mk.t <= 0) {
      delete f.m[id];
      def.expire?.(b, f, mk);
    }
  }
}

// ---------------------------------------------------------------- move swaps

/** Puts another move in a slot for the rest of this battle. The slot keeps its cooldown. */
export function setMove(b: Battle, f: Fighter, slot: number, id: string): void {
  if (!MOVES[id] || slot < 0 || slot >= f.moves.length) return;
  f.moves[slot] = id;
}

/** Restores the slough's own moves. */
export function resetMoves(f: Fighter): void {
  f.moves = f.mon.moves.slice();
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
  emit(b, { e: 'cut', side: t.side, idx: t.idx });
  msg(b, `${MOVES[hit[0].move]?.name || 'The wind-up'} is cut off.`);
  b.stats.interrupts++;
  return before !== b.pend.length;
}

export function heal(b: Battle, src: Fighter | null, t: Fighter, amt: number): number {
  if (!t || t.ko || t.gone || amt <= 0) return 0;
  if (t.s.doom) return 0;
  let a = amt;
  if (src) for (const h of hooks(src)) if (h.healMul) a *= h.healMul(b, src, t);
  if (t.s.rot && !has(t, 'clot')) a *= 0.5;
  a = Math.round(a);
  const room = t.maxHp - t.hp;
  const got = Math.min(room, a);
  t.hp += got;
  if (got > 0) emit(b, { e: 'heal', side: t.side, idx: t.idx, amt: got });
  if (src) for (const h of hooks(src)) h.afterHeal?.(b, src, t, got, a - got);
  return got;
}

export function giveShield(b: Battle, src: Fighter | null, t: Fighter, amt: number, turns: number): void {
  if (t.ko || t.gone || amt <= 0) return;
  if (src && has(src, 'grace')) turns += 1;
  t.shield += Math.round(amt);
  t.shieldTurns = Math.max(t.shieldTurns, turns);
  t.k.shieldSet = b.acting === t.side && isOut(b, t) ? t.turns : -1;
  emit(b, { e: 'shield', side: t.side, idx: t.idx, amt: Math.round(amt) });
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
  if (t.s.unstop || t.s.stasis) return;
  if (hooks(t).some(h => h.noDelay?.(t))) return;
  b.s[t.side].next += n;
}

export function hastenFighter(b: Battle, t: Fighter, n: number): void {
  if (n <= 0 || t.ko) return;
  if (!isOut(b, t)) { t.k.firstBonus = (t.k.firstBonus || 0) + n; return; }
  const s = b.s[t.side];
  if (b.acting === t.side) { t.k.hastenAfter = (t.k.hastenAfter || 0) + n; return; }
  s.next = Math.max(b.t, s.next - n);
}

// ---------------------------------------------------------------- switching

function clearVolatile(f: Fighter): void {
  for (const id of VOLATILE) delete f.s[id];
  for (const id of Object.keys(f.m)) if (MARKS[id]?.volatile) delete f.m[id];
}

export function comeOut(b: Battle, f: Fighter, start = false): void {
  f.outAt = start ? -1 : b.t;
  f.k.fresh = 1;
  f.k.ribFirst = start ? 1 : 0;
  if (!start) emit(b, { e: 'out', side: f.side, idx: f.idx });
  const s = b.s[f.side];
  const bonus = sk(b, f.side);
  if (bonus.wardNext) { applyStatus(b, null, f, 'ward', 1); bonus.wardNext = 0; }
  if (bonus.healNext) { heal(b, null, f, f.maxHp * 0.2); bonus.healNext = 0; }
  if (bonus.hasteNext) { applyStatus(b, null, f, 'haste', 1); bonus.hasteNext = 0; }
  if (bonus.poisonNext) { applyStatus(b, null, f, 'poison', bonus.poisonNext); bonus.poisonNext = 0; }
  if (bonus.bonusNext) { f.k.firstBonus = (f.k.firstBonus || 0) + bonus.bonusNext; bonus.bonusNext = 0; }
  for (const h of hooks(f)) h.comeOut?.(b, f);
  if (!start) for (const w of everyone(b)) if (!f.ko) for (const h of hooks(w)) h.anyOut?.(b, w, f);
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
  if (f.s.root && !f.s.unstop) return false;
  if (f.s.taunt && !f.s.unstop) return false;
  if (forbidden(b, f, 'switch')) return false;
  return reserves(b.s[f.side]).length > 0;
}

export function doSwitch(b: Battle, side: 0 | 1, to: number, forced = false): void {
  const s = b.s[side];
  const old = s.f[s.out];
  if (!old.ko) {
    b.pend = b.pend.filter(p => !(p.kind === 'windup' && p.side === side && p.idx === old.idx));
    // Leave hooks run before volatile marks clear so a volatile mark's own leave hook can end its form (Make a Frog).
    for (const h of hooks(old)) h.leave?.(b, old);
    clearVolatile(old);
    old.disguise = null;
  }
  s.out = to;
  const nf = s.f[to];
  if (!forced) msg(b, `${s.name} sends out ${label(b, nf)}.`);
  b.stats.switches++;
  comeOut(b, nf);
}

/** Next standing reserve after the out slough, in line order. */
export function nextInLine(s: Side): number {
  for (let k = 1; k < s.f.length; k++) {
    const i = (s.out + k) % s.f.length;
    if (!s.f[i].ko && !s.f[i].gone) return i;
  }
  return -1;
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
  const to = nextInLine(s);
  if (to < 0) return false;
  interrupt(b, t, by);
  const keepNext = s.next;
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
  if (immovable(cur) && cur.s.guard) { msg(b, `${label(b, cur)} holds its ground.`); return false; }
  if (hooks(nf).some(h => h.immovable?.(nf))) { msg(b, `${label(b, nf)} won't come.`); return false; }
  interrupt(b, cur, by);
  const keepNext = s.next;
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

export function usable(b: Battle, f: Fighter, i: number): { ok: boolean; why: string } {
  const m = moveDef(f, i);
  if (!m) return { ok: false, why: '' };
  if (f.s.silence && !hooks(f).some(h => h.statusImmune?.(f, 'silence'))) return { ok: false, why: 'Silenced.' };
  if (f.s.doom) return { ok: false, why: 'Doomed.' };
  if (f.s.taunt) return { ok: false, why: 'Taunted.' };
  if (f.cd[i] > 0) return { ok: false, why: `${f.cd[i]} more turn${f.cd[i] > 1 ? 's' : ''}.` };
  const no = forbidden(b, f, m);
  if (no) return { ok: false, why: no };
  if (m.nerve) {
    if (!b.rules.nerve) return { ok: false, why: 'Crests come later.' };
    if (b.s[f.side].nerve < m.nerve) return { ok: false, why: 'Not enough tide.' };
  }
  if (m.reach === 'reserveAlly' && reserves(b.s[f.side]).length === 0) return { ok: false, why: 'Nobody in reserve.' };
  if (m.reach === 'dragin' && reserves(b.s[1 - f.side]).length === 0) return { ok: false, why: 'Nobody to drag.' };
  if (m.tag && !canSwitch(b, f) && reserves(b.s[f.side]).length === 0) return { ok: true, why: '' };
  return { ok: true, why: '' };
}

/** Targets the player must pick for this move: enemy reserves, own sloughs, or none. */
export function targetKind(f: Fighter, m: MoveDef): 'none' | 'ally' | 'reserveAlly' | 'enemyReserve' | 'enemyAny' {
  if (m.reach === 'ally') return 'ally';
  if (m.reach === 'reserveAlly') return 'reserveAlly';
  if (m.reach === 'dragin') return 'enemyReserve';
  if (m.reach === 'single' && has(f, 'pull')) return 'enemyAny';
  return 'none';
}

function makeCtx(b: Battle, u: Fighter, m: MoveDef, a: { target?: number }, preview: boolean, power = 1): Ctx {
  const me = b.s[u.side];
  const them = b.s[1 - u.side];
  let tgt = them.f[them.out];
  if (m.reach === 'single' && has(u, 'pull') && a.target !== undefined && !them.f[a.target]?.ko && !them.f[a.target]?.gone) tgt = them.f[a.target];
  const ally = (m.reach === 'ally' || m.reach === 'reserveAlly') && a.target !== undefined ? me.f[a.target] : (m.reach === 'self' ? u : null);
  const type = moveType(u, m);
  const wardCache = new Map<Fighter, boolean>();
  const quietEffects = power < 1;
  const c: Ctx = {
    b, u, me, them, move: m, type, tgt, ally, preview, pick: a.target ?? -1,
    hit(t, r, o: HitOpts = {}) {
      if (t.ko || t.gone) return 0;
      if (t.side !== u.side && !o.reserve && c.blocked(t)) return 0;
      const kind = o.kind || (r.atk || r.def ? 'P' : r.mgk ? 'M' : 'P');
      let raw = rawOf(b, u, t, r);
      if (!o.reserve) for (const h of hooks(u)) if (h.addRaw) raw += h.addRaw(b, u, t, { kind, move: m, attack: false, dot: false, spread: !!o.spread, reserve: false });
      return dealDamage(b, u, t, raw, { kind, move: m, attack: false, dot: false, spread: !!o.spread, reserve: !!o.reserve }, kind === 'T' ? null : type, (o.mult || 1) * power, o.noGuard || m.noGuard);
    },
    spread(r, o: HitOpts = {}) {
      const main = c.hit(tgt, r, { ...o, spread: true });
      const share = has(u, 'conductive') ? 0.5 : SPREAD_SHARE;
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
    heal(t, amt) { return heal(b, u, t, amt * (quietEffects ? 0 : 1)); },
    shield(t, amt, turns) { if (!quietEffects) giveShield(b, u, t, amt, turns); },
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
        emit(b, { e: 'blocked', side: t.side, idx: t.idx });
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
export function runMove(b: Battle, u: Fighter, i: number, a: { target?: number; tagTo?: number }, preview = false, power = 1): void {
  if (power >= 1) { runMoveAt(b, u, i, a, preview, power); return; }
  replaying++;
  try { runMoveAt(b, u, i, a, preview, power); } finally { replaying--; }
}

function runMoveAt(b: Battle, u: Fighter, i: number, a: { target?: number; tagTo?: number }, preview: boolean, power: number): void {
  const m = moveDef(u, i)!;
  const c = makeCtx(b, u, m, a, preview, power);
  u.k.dealt = 0;
  if (power === 1) { u.k.moveMul = u.k.nextMoveMul || 0; u.k.nextMoveMul = 0; }
  // Passives on the receiving side may stop or turn back a move aimed at them before it runs.
  let caught: 'block' | 'reflect' | null = null, catcher: Fighter | null = null;
  if (!preview && power === 1 && (m.reach === 'single' || m.reach === 'spread' || m.reach === 'dragin')) {
    for (const w of standing(b.s[1 - u.side])) {
      for (const h of hooks(w)) { caught = h.intercept?.(b, w, u, m) || null; if (caught) { catcher = w; break; } }
      if (caught) break;
    }
  }
  if (caught === 'block') msg(b, `${label(b, catcher!)} stops ${m.name}.`);
  else if (caught === 'reflect') { msg(b, `${label(b, catcher!)} turns ${m.name} back.`); m.run(makeCtx(b, catcher!, m, {}, false, 1)); }
  else if (m.reach === 'single' && c.tgt.s.stasis) {
    msg(b, `${label(b, c.tgt)} can't be touched.`);
  } else {
    m.run(c);
  }
  u.k.moveMul = 0;
  if (power === 1) {
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
  for (const f of standing(s)) f.cd = f.cd.map(c => Math.max(0, c - 1));
  const f = s.f[s.out];
  if (f.gone) return 'down';
  f.turns++;
  f.k.prevTurn = f.k.curTurn;
  f.k.curTurn = b.t;
  delete f.s.guard;
  f.k.guardPaid = 0;
  if (f.k.guardedLast) f.k.guardedLast--;
  const dotInfo = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
  if (f.s.burn) dealDamage(b, null, f, f.s.burn.v || 10, dotInfo('M'), null);
  if (!f.ko && f.s.bleed) {
    dealDamage(b, null, f, (f.s.bleed.v || 5) * f.s.bleed.n, dotInfo('P'), null);
    if (f.s.bleed) { f.s.bleed.n--; if (f.s.bleed.n <= 0) delete f.s.bleed; }
  }
  if (!f.ko && f.s.poison) {
    dealDamage(b, null, f, f.maxHp * 0.03 * f.s.poison.n, dotInfo('T'), null);
    if (f.s.poison) { f.s.poison.n--; if (f.s.poison.n <= 0) delete f.s.poison; }
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
  for (const r of reserves(s)) for (const h of hooks(r)) h.reserveTurn?.(b, r);
  if (!f.ko) turnStartEffects(b, f);
  if (f.ko) return 'down';
  if (b.over !== null) return 'down';
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
    f.k.hemo = 0;
    const them = b.s[1 - f.side];
    let total = 0;
    msg(b, 'The hemorrhage opens.');
    for (const t of standing(them)) {
      const share = t.idx === them.out ? 1 : SPREAD_SHARE;
      total += dealDamage(b, f, t, stat(b, f, 'mgk') * 1.2 * share, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: t.idx !== them.out }, 'BEAST');
    }
    heal(b, f, f, total * 0.25);
  }
}

export function addCharge(b: Battle, src: Fighter, t: Fighter): void {
  if (t.ko || t.gone) return;
  t.k.charge = (t.k.charge || 0) + 1;
  if (t.k.charge >= 3) {
    t.k.charge = 0;
    msg(b, `${label(b, t)} is fully charged.`);
    applyStatus(b, src, t, 'stun', 1);
  }
}

function endTurn(b: Battle, side: 0 | 1, f: Fighter, weight: number, extra = 0, action = ''): void {
  const s = b.s[side];
  const now = s.f[s.out];
  let t = ticks(b, now, weight) + extra;
  t -= now.k.hastenAfter || 0;
  now.k.hastenAfter = 0;
  if (now.k.firstBonus) { t -= now.k.firstBonus; now.k.firstBonus = 0; }
  s.next = b.t + Math.max(10, t);
  if (now.k.again && now.k.again > 0) { now.k.again--; s.next = b.t + 1; }
  if (!f.ko && !f.gone && isOut(b, f)) {
    if (has(f, 'momentum')) f.k.momentum = action === 'guard' ? 0 : Math.min(4, (f.k.momentum || 0) + 1);
    for (const id of Object.keys(f.s) as StatusId[]) {
      const v = f.s[id]!;
      if (id === 'ward') {
        if (v.src === f.turns) continue;
        v.v = (v.v ?? 2) - 1;
        if (v.v <= 0) delete f.s.ward;
        continue;
      }
      if (id === 'guard' || (STACKING as string[]).includes(id)) continue;
      if (v.src === f.turns) continue;
      v.n--;
      if (v.n <= 0) {
        delete f.s[id];
        if (id === 'hidden') reveal(b, f);
        if (id === 'stasis' && f.k.thaw) {
          f.k.thaw = 0;
          f.hp = Math.max(f.hp, Math.round(f.maxHp * (f.k.thawPct || 40) / 100));
          msg(b, `${label(b, f)} thaws.`);
          emit(b, { e: 'heal', side: f.side, idx: f.idx, amt: 0 });
        }
      }
    }
    if (f.shieldTurns > 0 && f.k.shieldSet !== f.turns) {
      f.shieldTurns--;
      if (f.shieldTurns <= 0) f.shield = 0;
    }
  }
  if (action !== 'switch') f.k.escape = 0;
  if (!f.ko && !f.gone && b.over === null) {
    if (isOut(b, f)) for (const h of hooks(f)) h.turnEnd?.(b, f, action || 'skip');
    if (!f.ko) tickMarks(b, f, ['own', 'side', 'any']);
  }
  for (const w of everyone(b)) if (w !== f) tickMarks(b, w, w.side === side ? ['side', 'any'] : ['any']);
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
  const u = b.s[p.side].f[p.idx];
  if (u.ko || u.gone || !isOut(b, u)) return;
  if (p.kind === 'windup') {
    const i = u.moves.indexOf(p.move);
    if (i < 0) return;
    emit(b, { e: 'use', side: p.side, idx: p.idx, move: p.move, name: MOVES[p.move].name });
    msg(b, `${label(b, u)}'s ${MOVES[p.move].name} lands.`);
    const prev = b.acting;
    b.acting = null;
    b.aim = p.data?.aim ? { side: p.side, uid: p.data.aim } : null;
    runMove(b, u, i, { target: p.data?.target });
    b.aim = null;
    b.acting = prev;
    if (u.k.fresh) u.k.fresh = 0;
    for (const w of everyone(b)) for (const h of hooks(w)) h.anyMove?.(b, w, u, MOVES[p.move]);
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

/** Advances time until someone must decide something. */
export function advance(b: Battle, chooseReplace?: (b: Battle, side: 0 | 1) => number): Decision {
  for (let guard = 0; guard < 500; guard++) {
    if (b.over !== null) return { kind: 'over', winner: b.over };
    if (b.need) return b.need;
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
    const pmin = b.pend.length ? Math.min(...b.pend.map(p => p.at)) : Infinity;
    const nxt = Math.min(b.s[0].next, b.s[1].next);
    if (pmin <= nxt) {
      const p = b.pend.find(x => x.at === pmin)!;
      b.t = Math.max(b.t, pmin);
      resolvePending(b, p);
      continue;
    }
    const side: 0 | 1 = b.s[0].next <= b.s[1].next ? 0 : 1;
    b.t = Math.max(b.t, b.s[side].next);
    const round = roundOf(b) + (b.turnNo % 2 === 0 ? 1 : 0);
    if (b.turnNo % 2 === 0 && b.rules.starEvery && round % b.rules.starEvery === 0 && (b.starred || 0) < round) {
      b.starred = round;
      msg(b, 'A star lands on the field.');
      addNerve(b, 0, 2);
      addNerve(b, 1, 2);
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
      const k = f.forced.k;
      f.forced = null;
      const fa = forcedAction(b, side, k);
      msg(b, `${label(b, f)} can't help it.`);
      if (!fa) { endTurn(b, side, f, 50, 0, 'skip'); continue; }
      b.need = { kind: 'act', side };
      act(b, fa);
      continue;
    }
    b.need = { kind: 'act', side };
    return b.need;
  }
  b.over = 1;
  return { kind: 'over', winner: 1 };
}

export function replace(b: Battle, side: 0 | 1, idx: number): void {
  const s = b.s[side];
  if (b.need?.kind === 'replace' && b.need.side === side) b.need = null;
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

/** Applies the acting side's choice. */
export function act(b: Battle, a: Action): void {
  if (!b.need || b.need.kind !== 'act') throw new Error('nobody is acting');
  const side = b.need.side;
  b.need = null;
  b.stats.actions++;
  const s = b.s[side];
  const f = s.f[s.out];
  const foe = foeOf(b, f);
  switch (a.k) {
    case 'attack': {
      const target = foe;
      emit(b, { e: 'use', side, idx: f.idx, move: '', name: 'Attack' });
      msg(b, `${label(b, f)} attacks.`);
      b.aim = a.aim ? { side, uid: a.aim } : null;
      doAttack(b, f, target);
      b.aim = null;
      f.k.fresh = 0;
      for (const w of everyone(b)) for (const h of hooks(w)) h.anyMove?.(b, w, f, null);
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
      const w = quickWeight(b, f, 'switch', b.s[side].charm === 'tusk' ? 40 : 50);
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
      const chance = pegChance(b, f, t, a.peg), s0 = sk(b, 0);
      s0.pegSeed = (Math.imul(s0.pegSeed || 977, 1103515245) + 12345) & 0x7fffffff;
      if (chance >= 1 || s0.pegSeed / 0x7fffffff < chance) {
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
      if (m.nerve) { addNerve(b, side, -m.nerve); b.stats.bigMoves++; }
      if (m.wu) (b.stats as any).windups = ((b.stats as any).windups || 0) + 1;
      const free = hooks(f).some(h => h.freeCooldown?.(b, f, m));
      let cd = m.cd;
      for (const h of hooks(f)) if (h.cooldown) cd = Math.max(0, Math.round(h.cooldown(b, f, m, cd)));
      f.cd[a.i] = free ? 0 : cd + 1;
      f.movesUsed++;
      f.k.lastMove = a.i + 1;
      const unstop = !!m.unstop || (!!f.k.fresh && has(f, 'perihelion'));
      if (m.wu) {
        emit(b, { e: 'wind', side, idx: f.idx, move: m.id });
        msg(b, `${label(b, f)} winds up ${m.name}.`);
        let wu = b.s[side].charm === 'spire' ? Math.round(m.wu * 0.75) : m.wu;
        const aimed = out(b, side ? 0 : 1);
        if (aimed.mon.notion === 'reedplug' && !aimed.k.plug) { aimed.k.plug = 1; wu = Math.round(wu * 1.25); }
        b.pend.push({ id: b.pid++, at: b.t + wu, kind: 'windup', side, idx: f.idx, move: m.id, data: { target: a.target ?? -1, aim: a.aim ?? 0 }, unstop });
        endTurn(b, side, f, m.wt || 100, Math.round(wu / 2), 'windup');
        return;
      }
      emit(b, { e: 'use', side, idx: f.idx, move: m.id, name: m.name });
      msg(b, `${label(b, f)} uses ${m.name}.`);
      b.aim = a.aim ? { side, uid: a.aim } : null;
      runMove(b, f, a.i, a);
      b.aim = null;
      if (f.k.fresh && !f.ko) f.k.fresh = 0;
      for (const w of everyone(b)) for (const h of hooks(w)) h.anyMove?.(b, w, f, m);
      if (m.tag && !f.ko && isOut(b, f) && b.over === null) {
        const to = a.tagTo ?? (m.reach === 'reserveAlly' ? a.target : undefined) ?? nextInLine(s);
        if (to !== undefined && to >= 0 && to !== s.out && !s.f[to].ko && !s.f[to].gone && !(f.s.root || f.s.taunt)) {
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
  const hits = has(f, 'downpour') ? 2 : 1;
  const per = hits === 2 ? 0.5 : 1;
  let landed = false;
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
    for (const hk of hooks(f)) hk.afterAttack?.(b, f, t);
  }
  if (f.k.stroke) { f.k.stroke = 0; hastenFighter(b, f, 20); }
  if (f.k.nextAtkMul) {
    f.k.nextAtkMul = 0;
    if (f.k.nextAtkSlow && !t.ko) applyStatus(b, f, t, 'slow', f.k.nextAtkSlow);
    f.k.nextAtkSlow = 0;
  }
  if (f.k.edge) f.k.edge = 0;
  if (f.k.escape) f.k.escape = 0;
  if (landed && power === 1) addNerve(b, f.side, 1);
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
    else { out.push({ k: 'move', i }); if (m.reach === 'single') for (const aim of aims) out.push({ k: 'move', i, aim }); }
  }
  if (canGuard(f, b)) out.push({ k: 'guard' });
  if (canSwitch(b, f)) for (const r of reserves(s)) out.push({ k: 'switch', to: r.idx });
  const n = f.mon.notion ? NOTIONS[f.mon.notion] : null;
  if (n?.action && (f.k.notionUsed || 0) < (s.charm === 'pylon' && !n.spent ? 2 : 1)) out.push({ k: 'notion' });
  if (out.some(a => a.k !== 'attack') && forbidden(b, f, 'attack')) return out.filter(a => a.k !== 'attack');
  return out;
}

/** Previews an action: returns the battle after the action resolves at once. */
export function preview(b: Battle, a: Action): Battle {
  const c = clone(b);
  if (a.k === 'move') {
    const side = (c.need as { side: 0 | 1 }).side;
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
