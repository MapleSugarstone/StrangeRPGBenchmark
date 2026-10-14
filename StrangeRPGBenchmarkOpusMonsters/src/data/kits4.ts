// Kits for the second half of the species expansion.
import {
  addNerve, applyStatus, basicOf, boostMove, boostOf, canSwitch, cleanse, clearForm, echoMove, foeChoice, forceAction, dealDamage, delayFighter, doSwitch, emit, foeOf, giveShield, has, hastenFighter, heal, isOut, label,
  ammoOf, benchable, setField, groundBy, setGround, stealSummon, muted, dropItem, benchMove, moveType, landBank, lendPassive, lockMove, mark, moveDef, rollHp, setReach, startChannel, marked, markedBy, msg, plainTicks, reserves, setForm, setMove, shiftCd, sk, swapMoveFor, standing, stat, summon, summonsOf, dismiss, takeOver, unmark, SPREAD_SHARE,
} from '../battle/engine';
import type { Battle, Fighter, SpriteData, Summon } from '../battle/model';
import { defDrop, defGround, defMark, defMove, defPassive, defSummon, MOVES, type Ctx, type DmgInfo, type MoveDef } from '../battle/registry';
import type { Type } from './types';

type Kind = 'P' | 'M' | 'T';
const dot = (kind: Kind): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
const under = (t: Fighter, p: number): boolean => t.hp < t.maxHp * p;
const foe = (b: Battle, f: Fighter): Fighter | null => { const t = foeOf(b, f); return t && !t.ko && !t.gone ? t : null; };
const outOf = (b: Battle, f: Fighter): Fighter => b.s[f.side].f[b.s[f.side].out];
const lowestAlly = (c: Ctx): Fighter => standing(c.me).slice().sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0] || c.u;

/** A hit from a passive or mark: typed and mitigated like a move, outside any move. */
function strike(b: Battle, src: Fighter | null, t: Fighter, raw: number, kind: Kind, type: Type | null): number {
  if (!t || t.ko || t.gone || raw <= 0) return 0;
  return dealDamage(b, src && !src.ko ? src : null, t, raw, { kind, move: null, attack: false, dot: false, spread: false, reserve: !isOut(b, t) }, kind === 'T' ? null : type);
}
/** A spread hit from a passive or mark: the out foe in full, each foe reserve at the spread share. */
function splash(b: Battle, u: Fighter, raw: number, kind: 'P' | 'M', type: Type | null, share = SPREAD_SHARE): number {
  const them = b.s[1 - u.side];
  const t = them.f[them.out];
  let dealt = 0;
  if (t && !t.ko && !t.gone) dealt = dealDamage(b, u, t, raw, { kind, move: null, attack: false, dot: false, spread: true, reserve: false }, type);
  for (const r of reserves(them)) dealDamage(b, u, r, raw * share, { kind, move: null, attack: false, dot: false, spread: true, reserve: true }, type);
  return dealt;
}
/** HP paid as a cost. It never drops the payer below 1 HP. */
function payHp(b: Battle, f: Fighter, amt: number): void {
  const a = Math.min(f.hp - 1, Math.round(amt));
  if (a <= 0) return;
  f.hp -= a;
  emit(b, { e: 'dmg', side: f.side, idx: f.idx, amt: a, kind: 'T', eff: 1, shield: 0 });
}
/** The fighter that made a summon, or null once it is down. */
function ownerOf(b: Battle, s: Summon): Fighter | null { const f = b.s[s.side].f[s.by]; return f && !f.ko ? f : null; }
function ready(f: Fighter, id: string): void { const i = f.moves.indexOf(id); if (i >= 0) f.cd[i] = 0; }
/** A stun put on a whorl at the start of its own turn lasts that turn only. */
function stunNow(b: Battle, src: Fighter | null, t: Fighter): boolean {
  if (!applyStatus(b, src, t, 'stun', 1)) return false;
  if (t.s.stun) t.s.stun.src = -1;
  return true;
}
/** Takes n stacks off a mark, removing it at zero. */
function shed(f: Fighter, id: string, n: number): void {
  const mk = f.m[id];
  if (!mk) return;
  mk.n -= n;
  if (mk.n <= 0) delete f.m[id];
}
/** Runs another whorl's move with this move's context at a power multiplier. The caller's own cooldown is kept. */
function borrow(c: Ctx, m: MoveDef, power: number): void {
  const own = c.u.moves.indexOf(c.move.id);
  const keep = own >= 0 ? c.u.cd[own] : 0;
  const c2 = Object.create(c) as Ctx;
  c2.move = m;
  c2.ally = c.ally || (m.reach === 'reserveAlly' ? reserves(c.me)[0] || c.u : c.u);
  const was = c.u.k.moveMul || 0;
  c.u.k.moveMul = power;
  try { m.run(c2); } catch { c.msg('It slips away.'); }
  c.u.k.moveMul = was;
  if (own >= 0) c.u.cd[own] = Math.max(c.u.cd[own], keep);
}
const MOVE_IDS: string[] = [];
const moveIdx = (id: string): number => { if (!MOVE_IDS.length) MOVE_IDS.push(...Object.keys(MOVES)); return MOVE_IDS.indexOf(id) + 1; };
const moveAt = (n: number): MoveDef | null => { if (!MOVE_IDS.length) MOVE_IDS.push(...Object.keys(MOVES)); return n > 0 ? MOVES[MOVE_IDS[n - 1]] || null : null; };

// ================================================================ machines

// kiln: fires its own moves harder, glazes foes so a guard or a dash cracks them, and throws a brick that comes back.
defMark({ id: 'kiln_brittle', name: 'glazed', negative: true, max: 1, value: -0.1,
  afterGuard(b, f) { kilnCrack(b, f, null); },
  afterGet(b, f, src, id) { if (id === 'stun' || id === 'root') kilnCrack(b, f, src); } });
/** A Glazed whorl cracks: 10% of its max HP as true damage, and the glaze ends. */
function kilnCrack(b: Battle, t: Fighter, by: Fighter | null): void {
  if (!marked(t, 'kiln_brittle') || t.ko) return;
  const mk = unmark(t, 'kiln_brittle');
  const src = by || (mk ? markedBy(b, mk) : null);
  msg(b, `The glaze on ${label(b, t)} cracks.`);
  dealDamage(b, src && !src.ko ? src : null, t, t.maxHp * 0.1, dot('T'), null);
}
defMark({ id: 'kiln_return', name: 'brick coming back', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'kiln_return'); const t = foe(b, f); if (!t) return; msg(b, 'The brick comes back.'); strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'GEAR'); if (!t.ko) applyStatus(b, f, t, 'stun', 1); } });
defPassive({ id: 'kiln_glaze', name: 'Glazing', owner: 'kiln', text: 'Glaze cracks for 10% of the foe\'s max HP on a guard, a Stun, a Root, or its dash.',
  afterDeal(b, f, t, dealt, d) { if (d.move?.tags?.includes('dash') && !d.reserve && t.side !== f.side) kilnCrack(b, t, f); } });
defPassive({ id: 'kiln_hearth', name: 'Hearth', owner: 'kiln', text: 'Boosted moves deal 1.15x: its own, and your out whorl\'s while it is in reserve.',
  outMul(b, f, t, d) { const i = d.move ? f.moves.indexOf(d.move.id) : -1; return i >= 0 && boostOf(f, i) > 1 ? 1.15 : 1; },
  auraOut(b, f, o, t, d) { const i = d.move ? o.moves.indexOf(d.move.id) : -1; return i >= 0 && boostOf(o, i) > 1 ? 1.15 : 1; } });
defMove({ id: 'kiln_clinker', name: 'Clinker', type: 'STONE', owner: 'kiln', reach: 'single', tags: ['projectile'], cd: 1, fx: 'hop | pebble*2 arc | crack',
  text: 'Hits for 119% ATK. Slow 1. Glazes the foe for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.19 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'kiln_brittle', 1, 3); } });
/** Kiln's other moves, which Into the Kiln can fire: Q, E, and its crest. */
const KILN_FIRE = [0, 2, 3];
defMove({ id: 'kiln_bellows', name: 'Into the Kiln', type: 'GEAR', owner: 'kiln', reach: 'self', cd: 3, wt: 60, fx: 'flare | ember*3 orbit | cinders self',
  text: 'Fires a move you pick: locked 1 turn, then 1.4x for 2 uses. Unstoppable 1.',
  options(b, f) { return KILN_FIRE.map(i => MOVES[f.moves[i]]?.name || '?'); },
  run(c) {
    const slot = KILN_FIRE[Math.max(0, c.opt)];
    if (slot === undefined || slot >= c.u.moves.length) return;
    lockMove(c.b, c.u, slot, 1);
    boostMove(c.b, c.u, slot, 1.4, 2);
    c.st(c.u, 'unstop', 1);
  } });
defMove({ id: 'kiln_temper', name: 'Pillar Charge', type: 'GEAR', owner: 'kiln', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | shatter crack',
  text: 'Hits for 119% ATK. On a Glazed foe: 1.4x and Stun 1.',
  run(c) { const g = marked(c.tgt, 'kiln_brittle') > 0; c.hit(c.tgt, { atk: 1.19 }, { mult: g ? 1.4 : 1 }); if (g) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'kiln_ram', name: 'Fire Brick', type: 'GEAR', owner: 'kiln', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, fx: 'recoil | pebble*4 arc | crack shatter big tint jolt',
  text: 'Hits for 114% ATK. Splash 35%. Glazes every foe. Its next turn: 50% ATK, Stun 1.',
  run(c) {
    c.spread({ atk: 1.14 });
    for (const e of standing(c.them)) c.mark(e, 'kiln_brittle', 1, 3);
    c.mark(c.u, 'kiln_return', 1, 2);
  } });

// belt: a conveyor belt that couples to one friend so the pair keeps one pace, shares its load, and carries it in.
defMark({ id: 'belt_coupled', name: 'coupled', max: 1, value: 0.08,
  statBonus(f, k) { const mk = f.m.belt_coupled; return k === 'agi' && mk ? Math.max(0, mk.v - f.st.agi) : 0; } });
const coupledOf = (b: Battle, f: Fighter): Fighter | undefined => standing(b.s[f.side]).find(a => a !== f && marked(a, 'belt_coupled'));
function couple(b: Battle, u: Fighter, a: Fighter): void {
  for (const x of b.s[u.side].f) unmark(x, 'belt_coupled');
  if (a !== u) mark(b, u, a, 'belt_coupled', 1, -1, Math.round(stat(b, u, 'agi')));
}
defPassive({ id: 'belt_load', name: 'Same Load', owner: 'belt', text: 'Its heals heal its Coupled ally 50% too. In reserve: it takes 25% of that ally\'s hits.',
  auraIn(b, f, o) { return marked(o, 'belt_coupled') ? 0.75 : 1; },
  afterHeal(b, f, t, amt) { if (amt <= 0) return; const p = coupledOf(b, f); if (p && p !== t) heal(b, null, p, amt * 0.5); } });
defPassive({ id: 'belt_idler', name: 'Idler Wheel', owner: 'belt', text: 'When a Coupled ally comes out: its first turn comes 30% sooner.',
  anyOut(b, f, who) { if (who.side === f.side && who !== f && marked(who, 'belt_coupled')) who.k.firstBonus = (who.k.firstBonus || 0) + 30; } });
defMark({ id: 'belt_share', name: '', value: 0,
  afterTake(b, f, src, dealt, d) {
    if (d.dot || d.reserve || !isOut(b, f) || !marked(f, 'belt_coupled')) return;
    const v = b.s[f.side].f.find(a => a !== f && !a.ko && !a.gone && has(a, 'belt_load') && !isOut(b, a));
    if (v) dealDamage(b, null, v, dealt / 3, dot('T'), null);
  } });
defMove({ id: 'belt_rollers', name: 'Roller Spin', type: 'STONE', owner: 'belt', reach: 'spread', tags: ['spell'], cd: 1, fx: 'spin | sand*3 sweep | puff',
  text: 'Hits for 80% MGK. Splash 35%. Your Coupled ally\'s cooldowns drop 1.',
  run(c) { c.spread({ mgk: 0.8 }); const p = coupledOf(c.b, c.u); if (p) shiftCd(c.b, p, 'all', -1); } });
defMove({ id: 'belt_couple', name: 'Couple Up', type: 'GEAR', owner: 'belt', reach: 'ally', cd: 2, wt: 70, fx: 'sway | cog*2 orbit | ring ally',
  text: 'Couples an ally: both heal 10% max HP. It gets Vyobi\'s AGI if higher. Foe: Slow 1.',
  run(c) { const a = c.ally!; couple(c.b, c.u, a); if (a !== c.u) mark(c.b, c.u, a, 'belt_share', 1, -1); c.heal(c.u, c.u.maxHp * 0.1); if (a !== c.u) c.heal(a, a.maxHp * 0.1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'belt_overdrive', name: 'Belt Speed', type: 'GEAR', owner: 'belt', reach: 'self', cd: 3, wt: 60, fx: 'spin fast | spark*3 orbit | burst self',
  text: 'Haste 2 and Fortify 1 on it and its Coupled ally. Pays 6% max HP.',
  run(c) { payHp(c.b, c.u, c.u.maxHp * 0.06); for (const a of [c.u, coupledOf(c.b, c.u)]) if (a) { c.st(a, 'haste', 2); c.st(a, 'fortify', 1); } } });
defMove({ id: 'belt_trip', name: 'Carry Over', type: 'GEAR', owner: 'belt', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, fx: 'lift | cog*4 orbit | pillar cinders tint ally big',
  text: 'Couples an ally and switches to it: heals 15%, acts at once.',
  run(c) { const a = c.ally!; couple(c.b, c.u, a); mark(c.b, c.u, a, 'belt_share', 1, -1); c.heal(a, a.maxHp * 0.15); a.k.firstBonus = (a.k.firstBonus || 0) + 300; } });

// ================================================================ skinfall

// aerial: a radio mast that picks the band each time it speaks, jams one kind of move off the air, and relays its friends' spells.
const AERIAL_KINDS = ['spell', 'dash', 'projectile'] as const;
defMark({ id: 'aerial_jam', name: 'jammed', clock: 'own', negative: true, value: -0.15,
  forbid(b, f, what) { const mk = f.m.aerial_jam; return mk && typeof what === 'object' && what.tags?.includes(AERIAL_KINDS[mk.v] || 'spell') ? 'Jammed.' : null; } });
defPassive({ id: 'aerial_carrier', name: 'Clear Signal', owner: 'aerial', text: 'Tune In on the same band as last time deals 1.25x, and your team heals 5% of max HP.',
  outMul(b, f, t, d) { return d.move?.id === 'aerial_broadcast' && f.k.bandNow && f.k.bandNow === f.k.bandLast ? 1.25 : 1; },
  afterMove(b, f, m) { if (m.id === 'aerial_broadcast' && f.k.bandNow && f.k.bandNow === f.k.bandLast) for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.05); } });
defPassive({ id: 'aerial_repeater', name: 'Relay', owner: 'aerial', text: 'Deals 1.2x to a Slowed or Stunned foe. In reserve: your out whorl\'s spells add 15% MGK.',
  outMul(b, f, t) { return t.s.slow || t.s.stun ? 1.2 : 1; },
  anyMove(b, f, user, m) {
    if (!m?.tags?.includes('spell') || user.side !== f.side || isOut(b, f) || !isOut(b, user)) return;
    const t = foe(b, user);
    if (t) { msg(b, `${label(b, f)} relays it.`); strike(b, f, t, stat(b, f, 'mgk') * 0.15, 'M', 'STAR'); }
  } });
defMove({ id: 'aerial_reception', name: 'Static Flash', type: 'STAR', owner: 'aerial', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | bolt zigzag | flash',
  text: 'Hits for 111% MGK. Weaken 1. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { mgk: 1.11 }); c.st(c.tgt, 'weaken', 1); c.delay(c.tgt, 20); } });
defMove({ id: 'aerial_broadcast', name: 'Tune In', type: 'STAR', owner: 'aerial', reach: 'single', tags: ['spell'], cd: 3, splash: 1, fx: 'flare | beam | flash',
  fxOpts: ['flare | beam | flash glare', 'sway | spark*4 ray | burst all', 'shake | rune zigzag fast | sigil'],
  text: 'Long: 98% MGK. Mid: 50% MGK, Splash 100%. Short: 35% MGK, Silence 1.',
  options() { return ['Long', 'Mid', 'Short']; },
  run(c) {
    const band = Math.max(0, c.opt);
    c.u.k.bandLast = c.u.k.bandNow || 0;
    c.u.k.bandNow = band + 1;
    if (band === 0) c.hit(c.tgt, { mgk: 0.98 });
    else if (band === 1) c.spread({ mgk: 0.5 });
    else { c.hit(c.tgt, { mgk: 0.35 }); c.st(c.tgt, 'silence', 1); }
  } });
defMove({ id: 'aerial_interference', name: 'Crosstalk', type: 'GEAR', owner: 'aerial', reach: 'single', tags: ['spell'], cd: 3, fx: 'shake | spark*3 wave | fizz',
  text: 'Hits for 75% MGK. The foe\'s ready moves wait 1 more turn. 1 tide.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); if (!c.tgt.ko && !c.blocked(c.tgt)) shiftCd(c.b, c.tgt, 'ready', 1); c.nerve(c.me, 1); } });
defMove({ id: 'aerial_longwave', name: 'Dead Air', type: 'STAR', owner: 'aerial', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'flare | rune*4 converge | sigil vortex big dark',
  text: 'Hits for 60% MGK. Stun 1. Every foe can\'t use the kind you pick for 3 turns.',
  options() { return ['Spells', 'Dashes', 'Projectiles']; },
  run(c) {
    c.hit(c.tgt, { mgk: 0.6 }); c.st(c.tgt, 'stun', 1);
    const k = Math.max(0, c.opt);
    for (const e of standing(c.them)) { unmark(e, 'aerial_jam'); c.mark(e, 'aerial_jam', 1, 3, k); }
    c.msg(`${['Spells', 'Dashes', 'Projectiles'][k]} go off the air.`);
  } });

// vane: a fallen weather vane that points at whichever foe is nearest to falling, throws its arrow there, and lands beside a friend.
/** The foe whorl lowest on HP share, out or in reserve. */
const nearestFall = (b: Battle, f: Fighter): Fighter | null => standing(b.s[1 - f.side]).slice().sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0] || null;
defMark({ id: 'vane_hammer', name: 'arrow out', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'vane_hammer'); const t = foe(b, f); if (t) { msg(b, 'The arrow comes back.'); strike(b, f, t, stat(b, f, 'atk') * 0.19, 'P', 'STAR'); } } });
defPassive({ id: 'vane_landfall', name: 'North Point', owner: 'vane', text: 'Deals 1.2x to the foe lowest on HP. Every 3rd attack heals your team 5% of max HP.',
  outMul(b, f, t) { return nearestFall(b, f) === t ? 1.2 : 1; },
  afterAttack(b, f) { f.k.lum = (f.k.lum || 0) + 1; if (f.k.lum % 3 === 0) for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.05); } });
defPassive({ id: 'vane_fullsail', name: 'Beside You', owner: 'vane', text: 'Once, in reserve: your out whorl below 25% HP heals 20% of max HP. Foe: Stun 1.',
  reserveTurn(b, f) {
    if (f.k.landed) return;
    const o = outOf(b, f);
    if (o.ko || !under(o, 0.25)) return;
    f.k.landed = 1;
    msg(b, `${label(b, f)} comes down beside ${label(b, o)}.`);
    heal(b, f, o, o.maxHp * 0.2);
    const t = foe(b, o);
    if (t) stunNow(b, f, t);
  } });
defMove({ id: 'vane_spar', name: 'Spin on Pin', type: 'STAR', owner: 'vane', reach: 'single', cd: 1, fx: 'spin | slash',
  text: 'Hits 2 times for 35% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.35 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.35 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'vane_jibe', name: 'Throw Arrow', type: 'STAR', owner: 'vane', reach: 'single', tags: ['projectile'], cd: 2, fx: 'recoil | shard line fast | slash',
  text: 'Hits the foe lowest on HP, even in reserve: 34% ATK. Returns: 19% ATK. Haste 1.',
  run(c) {
    const t = nearestFall(c.b, c.u) || c.tgt;
    if (t === c.tgt) c.hit(t, { atk: 0.34 }); else { c.msg(`The arrow flies at ${label(c.b, t)}.`); c.hit(t, { atk: 0.34 }, { reserve: true }); }
    c.mark(c.u, 'vane_hammer', 1, 2);
    c.st(c.u, 'haste', 1);
  } });
defMove({ id: 'vane_halyard', name: 'After It', type: 'GEAR', owner: 'vane', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | claw',
  text: 'Hits for 85% ATK. If its arrow is out: catches it, then 40% ATK and Stun 1.',
  run(c) { const out = marked(c.u, 'vane_hammer') > 0; c.hit(c.tgt, { atk: 0.85 }); if (out && !c.tgt.ko) { unmark(c.u, 'vane_hammer'); c.hit(c.tgt, { atk: 0.4 }); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'vane_touchdown', name: 'Land Beside', type: 'STAR', owner: 'vane', reach: 'spread', cd: 6, nerve: 5, fx: 'lift | star*4 rain | sparkle big jolt',
  text: 'Your lowest-HP whorl heals 30% of max HP. Hits for 80% ATK. Splash 35%. Stun 1.',
  run(c) { const a = lowestAlly(c); c.heal(a, a.maxHp * 0.3); c.spread({ atk: 0.8 }); c.st(c.tgt, 'stun', 1); } });

// capsule: a re-entry capsule that pulls a falling friend inside and takes its place, seals a reserve away, and turns a foe's side on it.
defMark({ id: 'capsule_eject', name: 'eject ready', max: 1, value: 0.3 });
defMark({ id: 'capsule_safe', name: 'pulled clear', clock: 'any', value: 0.05,
  beforeTake(b, f, src, amt) { return isOut(b, f) ? amt : 0; } });
defMark({ id: 'capsule_sealed', name: 'sealed in', clock: 'any', value: 0.12,
  beforeTake(b, f, src, amt) { return isOut(b, f) ? amt : 0; },
  reserveTurn(b, f) { heal(b, null, f, f.maxHp * 0.08); },
  comeOut(b, f) { unmark(f, 'capsule_sealed'); } });
defMark({ id: 'capsule_curse', name: 'turned on', clock: 'own', negative: true, value: -0.3,
  turnStart(b, f) {
    unmark(f, 'capsule_curse');
    stunNow(b, null, f);
    for (const r of reserves(b.s[f.side])) { msg(b, `${label(b, r)} turns on ${label(b, f)}.`); strike(b, r, f, stat(b, r, 'atk') * 0.4, 'P', null); }
  } });
defPassive({ id: 'capsule_coldsoak', name: 'Eject', owner: 'capsule', text: 'Once, in reserve: it swaps in for an out ally about to be KO\'d, which keeps 1 HP.',
  start(b, f) { mark(b, f, f, 'capsule_eject', 1, -1); },
  rescue(b, f, o) {
    if (!marked(f, 'capsule_eject') || f.ko || f.gone) return false;
    unmark(f, 'capsule_eject');
    msg(b, `${label(b, f)} snaps shut round ${label(b, o)}.`);
    mark(b, f, o, 'capsule_safe', 1, 1);
    return true;
  } });
defPassive({ id: 'capsule_drogue', name: 'Drogue Chute', owner: 'capsule', text: 'Takes 0.5x until its first turn out. Deals 1.15x and takes 0.85x against a Slowed foe.',
  comeOut(b, f) { f.k.chute = 1; },
  turnStart(b, f) { f.k.chute = 0; },
  inMul(b, f) { const t = foe(b, f); return (f.k.chute ? 0.5 : 1) * (t && t.s.slow ? 0.85 : 1); },
  outMul(b, f, t) { return t.s.slow ? 1.15 : 1; } });
defMove({ id: 'capsule_reentry', name: 'Hot Drop', type: 'VOID', owner: 'capsule', reach: 'single', tags: ['projectile', 'spell'], cd: 1, splash: 0.4, fx: 'lift | comet arc | flash cinders',
  text: 'Hits for 46% MGK. Splash 40%. Slow 1. Burn 2 (18% MGK each turn).',
  run(c) { c.spread({ mgk: 0.46 }); c.st(c.tgt, 'slow', 1); c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'mgk') * 0.18); } });
defMove({ id: 'capsule_hullburst', name: 'Seal In', type: 'GEAR', owner: 'capsule', reach: 'reserveAlly', cd: 3, wt: 60, fx: 'flare | hoop converge | ring ally',
  text: 'A reserve ally is Sealed In: no damage, heals 8% max HP a turn. Foe: Slow 1.',
  run(c) { const a = c.ally!; if (a !== c.u && !isOut(c.b, a)) c.mark(a, 'capsule_sealed', 1, 6); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'capsule_sealin', name: 'Clam Shut', type: 'GEAR', owner: 'capsule', reach: 'ally', cd: 4, fx: 'sink | shell converge | ring ally',
  text: 'Heals an ally 20% of max HP. If it is out: Stasis 1.',
  run(c) { const a = c.ally!; if (isOut(c.b, a) && a !== c.u) c.st(a, 'stasis', 1); c.heal(a, a.maxHp * 0.2); } });
defMove({ id: 'capsule_mutiny', name: 'Turn Them', type: 'GEAR', owner: 'capsule', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'flare | rune*3 orbit | vortex big dark',
  text: 'Hits for 50% MGK. At its next turn: Stun, and its reserves hit it for 40% ATK.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); if (!c.tgt.ko) c.mark(c.tgt, 'capsule_curse', 1, 2); } });

// booster: a rocket stage that burns its own HP for thrust, drops a burning stage behind it, and falls off the field on purpose.
defSummon({ id: 'booster_chomper', name: 'Clamp', owner: 'booster', text: 'Stays until a foe comes out. Hits it for 60% of Imshin\'s ATK. Burn 2.',
  sprite: { px: ['........', '........', '........', '3.3..3.3', '22222222', '21222212', '22222222', '4......4'], c: ['#81719e', '#f5f1f1', '#f37533'] },
  lasting: true,
  trap(b, s, who) {
    const by = ownerOf(b, s) || b.s[s.side].f[s.by];
    msg(b, `${label(b, who)} lands on a burning stage.`);
    dealDamage(b, null, who, stat(b, by, 'atk') * 0.6, { kind: 'P', move: null, attack: false, dot: false, spread: false, reserve: false }, 'GEAR');
    if (!who.ko) applyStatus(b, null, who, 'burn', 2, stat(b, by, 'atk') * 0.2);
    return true;
  } });
/** Imshin pays HP for thrust, and its passive counts what it has paid. */
function burnHp(b: Battle, f: Fighter, share: number): void { const before = f.hp; payHp(b, f, f.maxHp * share); f.k.paid = (f.k.paid || 0) + Math.round(100 * (before - f.hp) / f.maxHp); }
defPassive({ id: 'booster_stage', name: 'Spent Stage', owner: 'booster', text: 'When a foe is KO\'d while it is out: Haste 2. When it is KO\'d: it leaves a hot Clamp.',
  anyKO(b, f, v) { if (v === f) summon(b, f, 'booster_chomper', { hp: 0.1 }); else if (v.side !== f.side && isOut(b, f)) applyStatus(b, f, f, 'haste', 2); } });
defPassive({ id: 'booster_last', name: 'Burn Rate', owner: 'booster', text: 'Each 10% of its max HP it has paid this battle adds 5% to its damage.',
  outMul(b, f) { return 1 + 0.05 * Math.floor((f.k.paid || 0) / 10); } });
defMove({ id: 'booster_thrust', name: 'Thrust', type: 'GEAR', owner: 'booster', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | burst cinders',
  text: 'Pays 5% of its max HP. Hits for 71% ATK. Its next turn comes 30% sooner.',
  run(c) { burnHp(c.b, c.u, 0.05); c.hit(c.tgt, { atk: 0.71 }); c.hasten(c.u, 30); } });
defMove({ id: 'booster_scatter', name: 'Spark Spray', type: 'VOID', owner: 'booster', reach: 'single', tags: ['projectile'], cd: 2, fx: 'shake | spark*4 wave | burst',
  text: 'Hits for 50% ATK. Slow 2. Burn 2 (15% ATK each turn).',
  run(c) { c.hit(c.tgt, { atk: 0.5 }); c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'atk') * 0.15); } });
defMove({ id: 'booster_fuelleak', name: 'Drop Stage', type: 'GEAR', owner: 'booster', reach: 'single', cd: 4, tag: true, fx: 'hop | ember arc | smoke',
  text: 'Hits for 36% ATK. Root 1. Sets a hot Clamp for the next foe out. Switches out.',
  run(c) { c.hit(c.tgt, { atk: 0.36 }); c.st(c.tgt, 'root', 1); summon(c.b, c.u, 'booster_chomper', { hp: 0.1 }); } });
defMove({ id: 'booster_downrange', name: 'Long Burn', type: 'GEAR', owner: 'booster', reach: 'single', tags: ['projectile'], cd: 6, splash: 0.4, nerve: 4, fx: 'flare | comet line | burst cinders big jolt',
  text: 'Pays 15% max HP. Hits for 81% ATK + 25% foe missing HP. Splash 40%.',
  run(c) { burnHp(c.b, c.u, 0.15); c.spread({ atk: 0.81, tgtMiss: 0.25 }); } });

// dish: a fallen dish that says back louder whatever a foe says: echoes of its moves come back at it, and its crest says the last three.
/** The foe moves Pasara has heard, newest first, as indexes into MOVES. */
const heardMoves = (f: Fighter): MoveDef[] => [f.k.heard1, f.k.heard2, f.k.heard3].map(n => moveAt(n || 0)).filter((m): m is MoveDef => !!m);
defMark({ id: 'dish_listen', name: 'heard', clock: 'own', negative: true, value: -0.12,
  afterMove(b, f, m) {
    const mk = f.m.dish_listen, by = mk ? markedBy(b, mk) : null;
    if (!by || by.ko || by.gone || m.id === 'dish_sidelobe') return;
    msg(b, `${label(b, by)} catches ${m.name}.`);
    echoMove(b, by, m.id, 2 * plainTicks(b, f), 0.5);
  } });
defPassive({ id: 'dish_gain', name: 'Turned Up', owner: 'dish', text: 'Moves it says back (echoes, Say It Back, Loud Hail) deal 1.2x.',
  outMul(b, f, t, d) { return f.k.saying || (d.move && !f.moves.includes(d.move.id)) ? 1.2 : 1; } });
defPassive({ id: 'dish_nullsteer', name: 'Ear Out', owner: 'dish', text: 'It hears every move a foe uses, even from reserve. Takes 0.85x from spells.',
  anyMove(b, f, user, m) { if (!m || user.side === f.side) return; f.k.heard3 = f.k.heard2 || 0; f.k.heard2 = f.k.heard1 || 0; f.k.heard1 = moveIdx(m.id); },
  inMul(b, f, src, d) { return d.move?.tags?.includes('spell') ? 0.85 : 1; } });
defMove({ id: 'dish_downlink', name: 'Ping Back', type: 'GEAR', owner: 'dish', reach: 'single', tags: ['projectile', 'spell'], cd: 1, splash: 0.2, fx: 'flare | orb line fast | flash',
  text: 'Hits for 90% MGK. Splash 20%. Weaken 1.',
  run(c) { c.spread({ mgk: 0.9 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'dish_sidelobe', name: 'Feedback', type: 'STAR', owner: 'dish', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | hoop*2 wave | ring',
  text: 'Hits for 50% MGK. Its cooldowns go up 1. 3 turns: its moves echo 2 turns later.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); if (!c.tgt.ko) { c.mark(c.tgt, 'dish_listen', 1, 3); if (!c.blocked(c.tgt)) shiftCd(c.b, c.tgt, 'all', 1); } } });
defMove({ id: 'dish_intercept', name: 'Say It Back', type: 'STAR', owner: 'dish', reach: 'single', tags: ['spell'], cd: 3, fx: 'flare | orb return | burst',
  text: 'Uses the last move a foe used, as itself.',
  run(c) {
    const m = heardMoves(c.u)[0];
    if (!m || m.id === c.move.id || m.id === 'dish_uplift') { c.hit(c.tgt, { mgk: 0.8 }); return; }
    c.msg(`${label(c.b, c.u)} says ${m.name} back.`);
    c.u.k.saying = 1;
    borrow(c, m, 1);
    c.u.k.saying = 0;
  } });
defMove({ id: 'dish_uplift', name: 'Loud Hail', type: 'STAR', owner: 'dish', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell | hoop*3 line | ring burst big glare',
  text: 'Says back the last 3 moves a foe used, each at 0.6x. Then Stun 1.',
  run(c) {
    const ms = heardMoves(c.u).filter(m => m.id !== c.move.id);
    if (!ms.length) { c.hit(c.tgt, { mgk: 1.2 }); c.st(c.tgt, 'stun', 1); return; }
    c.u.k.saying = 1;
    for (const m of ms) { if (c.tgt.ko) break; c.msg(`${label(c.b, c.u)} says ${m.name} back.`); borrow(c, m, 0.6); }
    c.u.k.saying = 0;
    if (!c.tgt.ko) c.st(c.tgt, 'stun', 1);
  } });

// debris: fused hull scrap that heats with every move, melts armor while hot, and vents its heat as a blast.
const heat = (f: Fighter) => f.k.heat || 0;
function addHeat(b: Battle, f: Fighter, n: number): void {
  f.k.heat = Math.min(100, heat(f) + n);
  if (f.k.heat >= 100) { f.k.heat = 0; msg(b, `${label(b, f)} erupts.`); splash(b, f, stat(b, f, 'atk') * 0.5, 'P', 'STONE', 1); }
}
defMark({ id: 'debris_strafe', name: 'passing low', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.45, 'P', 'STONE'); const t = foe(b, f); if (t) { applyStatus(b, f, t, 'burn', 1, stat(b, f, 'atk') * 0.2); applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'debris_hot', name: 'Burning Up', owner: 'debris', text: '-10 Heat a turn. At 50+: moves deal 1.3x. At 100: erupts for 50% ATK. Splash 100%.',
  outMul(b, f, t, d) { return d.move && heat(f) >= 50 ? 1.3 : 1; },
  turnStart(b, f) { f.k.heat = Math.max(0, heat(f) - 10); } });
defPassive({ id: 'debris_fins', name: 'Heat Sink', owner: 'debris', text: 'At 50+ Heat: a foe whose dash hits it gets Burn 2 (20% of Kuzumen\'s ATK).',
  afterTake(b, f, src, dealt, d) { if (heat(f) >= 50 && src && src.side !== f.side && d.move?.tags?.includes('dash') && !src.ko) applyStatus(b, f, src, 'burn', 2, stat(b, f, 'atk') * 0.2); } });
defMove({ id: 'debris_swarf', name: 'Hot Sparks', type: 'STONE', owner: 'debris', reach: 'single', cd: 1, fx: 'shake | spark*3 wave | cinders',
  text: 'Hits for 90% ATK. Splash 35%. Burn 1 (16% ATK each turn). 25 Heat.',
  run(c) { c.spread({ atk: 0.9 }); c.st(c.tgt, 'burn', 1, stat(c.b, c.u, 'atk') * 0.16); addHeat(c.b, c.u, 25); } });
defMove({ id: 'debris_harpoon', name: 'Hull Hook', type: 'GEAR', owner: 'debris', reach: 'single', tags: ['projectile'], cd: 2, fx: 'recoil | bone line | bite',
  text: 'Hits for 110% ATK. Slow 2. At 50+ Heat: -6 DEF for the battle, up to 18. 25 Heat.',
  run(c) { const hot = heat(c.u) >= 50; c.hit(c.tgt, { atk: 1.1 }); c.st(c.tgt, 'slow', 2); if (hot && !c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.defLoss = Math.min(18, (c.tgt.k.defLoss || 0) + 6); addHeat(c.b, c.u, 25); } });
defMove({ id: 'debris_plating', name: 'Vent', type: 'STONE', owner: 'debris', reach: 'spread', cd: 3, fx: 'swell | puff smoke cinders',
  text: 'Spends its Heat: hits for 2% ATK per Heat. Splash 35%. Shield of 15% max HP.',
  run(c) { const h = heat(c.u); c.u.k.heat = 0; if (h > 0) c.spread({ atk: 0.02 * h }); c.shield(c.u, c.u.maxHp * 0.15, 2); } });
defMove({ id: 'debris_strafe', name: 'Low Pass', type: 'STONE', owner: 'debris', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, fx: 'lift | ember*4 sweep | cinders smoke big jolt',
  text: 'Hits for 90% ATK, then 45% ATK, Burn 1, and Slow 1 for 2 turns. Splash 35%. 50 Heat.',
  run(c) { c.spread({ atk: 0.9 }); c.mark(c.u, 'debris_strafe', 1, 2); addHeat(c.b, c.u, 50); } });

// ================================================================ tundra and ice shelf

// musk: a musk ox that rings its herd: while it is out its wool takes the hits meant for its reserves, and its stare frosts a foe solid.
defMark({ id: 'musk_frost', name: 'frost', max: 4, clock: 'own', negative: true, volatile: true, value: -0.05 });
defMark({ id: 'musk_ring', name: 'ringed in', clock: 'own', volatile: true, value: 0.2,
  inMul() { return 0.75; } });
/** Bosshi out with its wool up, guarding the reserves of its side. */
const herdGuard = (b: Battle, side: 0 | 1): Fighter | null => { const o = b.s[side].f[b.s[side].out]; return o && !o.ko && has(o, 'musk_wall') ? o : null; };
defPassive({ id: 'musk_coat', name: 'Winter Wool', owner: 'musk', text: 'Hits add Frost, max 4. Starts with a 10% shield, regrown after 2 unhit turns.',
  start(b, f) { giveShield(b, f, f, f.maxHp * 0.1, 99); },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side && !t.ko) mark(b, f, t, 'musk_frost', 1, 3); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.unhit = 0; },
  turnStart(b, f) { f.k.unhit = (f.k.unhit || 0) + 1; if (f.k.unhit >= 3 && f.shield < f.maxHp * 0.1) { giveShield(b, f, f, f.maxHp * 0.1 - f.shield, 99); f.k.unhit = 0; } } });
defPassive({ id: 'musk_wall', name: 'Herd Ring', owner: 'musk', text: 'While out with a shield: takes 0.85x, and hits on your reserves land on its shield.',
  inMul(b, f) { return f.shield > 0 ? 0.85 : 1; },
  start(b, f) { for (const a of b.s[f.side].f) if (a !== f) mark(b, null, a, 'musk_herd', 1, -1); } });
defMark({ id: 'musk_herd', name: '', value: 0,
  beforeTake(b, f, src, amt) {
    const g = isOut(b, f) ? null : herdGuard(b, f.side);
    if (!g || g.shield <= 0) return amt;
    const take = Math.min(g.shield, amt);
    g.shield -= take;
    emit(b, { e: 'dmg', side: g.side, idx: g.idx, amt: take, kind: 'T', eff: 1, shield: take });
    return amt - take;
  } });
defMove({ id: 'musk_bowl', name: 'Head Down', type: 'BEAST', owner: 'musk', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | bite',
  text: 'Hits for 105% ATK. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { atk: 1.05 }); c.delay(c.tgt, 20); } });
defMove({ id: 'musk_sweep', name: 'Snow Snort', type: 'TIDE', owner: 'musk', reach: 'spread', cd: 2, fx: 'recoil | puff frost',
  text: 'Hits for 53% ATK. Splash 35%. Slow 1. 1 Frost on each.',
  run(c) { c.spread({ atk: 0.53 }); c.st(c.tgt, 'slow', 1); for (const e of standing(c.them)) if (!e.ko) c.mark(e, 'musk_frost', 1, 3); } });
defMove({ id: 'musk_hardfreeze', name: 'Frozen Stiff', type: 'BEAST', owner: 'musk', reach: 'single', cd: 3, fx: 'stomp | frost quake',
  text: 'At 3 Frost: spends it, 110% ATK, Stun 1. Else: 80% ATK, 1 Frost.',
  run(c) {
    const full = c.marked(c.tgt, 'musk_frost') >= 3;
    c.hit(c.tgt, { atk: full ? 1.1 : 0.8 });
    if (c.tgt.ko) return;
    if (full) { unmark(c.tgt, 'musk_frost'); c.st(c.tgt, 'stun', 1); } else c.mark(c.tgt, 'musk_frost', 1, 3);
  } });
defMove({ id: 'musk_corral', name: 'Ring the Herd', type: 'BEAST', owner: 'musk', reach: 'spread', cd: 6, nerve: 5, fx: 'spin | ring frost big jolt',
  text: 'Hits for 80% ATK. Splash 35%. Stun 1. Shield 15% max HP. 3 turns: your team takes 0.75x.',
  run(c) { c.spread({ atk: 0.8 }); c.st(c.tgt, 'stun', 1); for (const a of standing(c.me)) c.mark(a, 'musk_ring', 1, 3); c.shield(c.u, c.u.maxHp * 0.15, 3); } });

// serac: a glacier block that freezes whatever stands still, makes a dash slip on its glare ice, and shatters what is nearly gone.
defMark({ id: 'serac_vortex', name: 'on glare ice', clock: 'own', negative: true, volatile: true, value: -0.1,
  afterDeal(b, f, t, dealt, d) { if (d.move?.tags?.includes('dash') && !d.reserve && dealt > 0 && !f.ko) { msg(b, `${label(b, f)} slips on the ice.`); dealDamage(b, null, f, dealt * 0.3, dot('T'), null); } } });
defMark({ id: 'serac_feet', name: 'frozen boots', clock: 'own', negative: true, volatile: true, value: -0.15,
  expire(b, f, mk) { msg(b, `${label(b, f)} freezes to the spot.`); applyStatus(b, markedBy(b, mk), f, 'stun', 1); } });
defPassive({ id: 'serac_shatter', name: 'Shatters', owner: 'serac', text: 'A foe it hits that drops below 12% HP is KO\'d.',
  afterDeal(b, f, t, dealt, d) { if (d.reserve || d.dot || t.ko || t.side === f.side || !under(t, 0.12)) return; msg(b, `${label(b, t)} shatters.`); dealDamage(b, f, t, t.hp + t.shield + 1, dot('T'), null); } });
defPassive({ id: 'serac_deepcold', name: 'Still Air', owner: 'serac', text: 'Deals 1.25x to a foe that has taken 3+ turns since it came out. Its hits add Rot 2.',
  outMul(b, f, t) { return (t.turns - (t.k.outTurns ?? 0)) >= 3 ? 1.25 : 1; },
  anyOut(b, f, who) { who.k.outTurns = who.turns; },
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !d.dot && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'rot', 2); } });
defMove({ id: 'serac_spall', name: 'Ice Spall', type: 'TIDE', owner: 'serac', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | shard*2 line | shatter',
  text: 'Hits for 148% MGK. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.48 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'serac_icefloor', name: 'Glare Ice', type: 'SALT', owner: 'serac', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | salt*3 converge | frost',
  text: 'Hits for 75% MGK. Slow 2. 3 turns: its dashes cost it 30% of their damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'serac_vortex', 1, 3); } });
defMove({ id: 'serac_spindrift', name: 'Frozen Boots', type: 'TIDE', owner: 'serac', reach: 'single', tags: ['spell'], cd: 4, fx: 'sink | frost quake',
  text: 'Hits for 83% MGK. If the foe is still out after 2 turns: Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.83 }); if (!c.tgt.ko) c.mark(c.tgt, 'serac_feet', 1, 2); } });
defMove({ id: 'serac_icefall', name: 'Calving Face', type: 'TIDE', owner: 'serac', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 60, fx: 'shake | shard*5 rain | shatter frost big jolt',
  text: 'Wind-up. Hits for 140% MGK. Splash 35%. Rot 3. Below 15% HP after: KO\'d.',
  run(c) { c.spread({ mgk: 1.4 }); c.st(c.tgt, 'rot', 3); if (!c.tgt.ko && under(c.tgt, 0.15)) { c.msg(`${label(c.b, c.tgt)} shatters.`); c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); } } });

// selkie: a sealskin that sleeps where it likes: hits on a foe it lulls sink into the dream and land at once when it wakes.
defMark({ id: 'selkie_dream', name: 'dreaming', clock: 'any', negative: true, volatile: true, value: -0.15,
  bankHit(b, f) { return !!f.s.sleep; },
  turnStart(b, f) { if (!f.s.sleep) selkieWake(b, f); },
  leave(b, f) { selkieWake(b, f); } });
/** A Dreaming whorl wakes: everything the dream held lands at 1.25x, and a Sea Born selkie's team heals. */
function selkieWake(b: Battle, f: Fighter): void {
  const mk = unmark(f, 'selkie_dream');
  const by = mk ? markedBy(b, mk) : null;
  if (!f.bank) return;
  msg(b, `${label(b, f)} wakes from the dream.`);
  landBank(b, f, 1.25, by);
  if (by && !by.ko && has(by, 'selkie_sealegs')) for (const a of standing(b.s[by.side])) heal(b, by, a, a.maxHp * 0.1);
}
defPassive({ id: 'selkie_lull', name: 'Sleepy Sea', owner: 'selkie', text: 'When it heals an out ally at least 5% of its max HP: that ally\'s next turn comes 20% sooner.',
  afterHeal(b, f, t, amt) { if (amt >= t.maxHp * 0.05 && t !== f && isOut(b, t)) hastenFighter(b, t, 20); } });
defPassive({ id: 'selkie_sealegs', name: 'Sea Born', owner: 'selkie', text: 'When a foe wakes from its dream with damage held: your team heals 10% of max HP.' });
defMove({ id: 'selkie_backwash', name: 'Undertow Mend', type: 'TIDE', owner: 'selkie', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | drop*2 wave | splash',
  text: 'Hits for 76% MGK. Your lowest-HP whorl heals 35% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.76 }); c.heal(lowestAlly(c), d * 0.35); } });
defMove({ id: 'selkie_bubble', name: 'Lullaby', type: 'TIDE', owner: 'selkie', reach: 'single', tags: ['spell'], cd: 4, wu: 50, fx: 'sway | bubble*4 rise | fizz daze',
  text: 'Wind-up. Sleep 2. Dreaming: hits wait, then land at 1.25x when it wakes.',
  run(c) { if (c.st(c.tgt, 'sleep', 2)) c.mark(c.tgt, 'selkie_dream', 1, 6); } });
defMove({ id: 'selkie_gift', name: 'Seal Bite', type: 'BEAST', owner: 'selkie', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | bite',
  text: 'Hits for 72% MGK. 1.5x on a sleeping foe. Slow 1. Heals 8% of its max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.72 }, { mult: c.tgt.s.sleep ? 1.5 : 1 }); c.st(c.tgt, 'slow', 1); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'selkie_seventh', name: 'Seven Waves', type: 'TIDE', owner: 'selkie', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'sway | crest*7 sweep | splash big tint jolt',
  text: 'Hits for 100% MGK. Splash 35%. A sleeping foe takes 2x. Stun 1. Slow 2.',
  run(c) { c.spread({ mgk: 1.0 }, { mult: c.tgt.s.sleep ? 2 : 1 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'slow', 2); } });

// walrus: a walrus that counts its blows aloud so the foe sees the third coming, punishes a guard, and hauls its herd in.
defMark({ id: 'walrus_count', name: 'blows', max: 2, value: 0.06 });
/** Rosmachi's blow count, 0 to 2. The 3rd blow deals 2x and starts the count again. */
const blows = (f: Fighter): number => marked(f, 'walrus_count');
defPassive({ id: 'walrus_thirdblow', name: 'Third Tusk', owner: 'walrus', text: 'Every 3rd blow it lands on the foe deals 2x. Its count shows above it.',
  outMul(b, f, t, d) { return !d.dot && !d.reserve && t.side !== f.side && blows(f) >= 2 ? 2 : 1; },
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.side === f.side || f.k.walrusHit === b.turnNo) return;
    f.k.walrusHit = b.turnNo;
    if (blows(f) >= 2) unmark(f, 'walrus_count'); else mark(b, f, f, 'walrus_count', 1, -1);
  } });
defPassive({ id: 'walrus_pileon', name: 'Haul Out', owner: 'walrus', text: 'In reserve: your out whorl\'s dashes deal 1.15x.',
  auraOut(b, f, o, t, d) { return d.move?.tags?.includes('dash') ? 1.15 : 1; } });
defMove({ id: 'walrus_flipper', name: 'Flipper Slap', type: 'TIDE', owner: 'walrus', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | splash',
  text: 'Hits for 85% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'walrus_snowball', name: 'Herd Roll', type: 'TIDE', owner: 'walrus', reach: 'single', tags: ['dash'], cd: 3, wu: 50, fx: 'lunge slow | quake jolt',
  text: 'Wind-up. Hits for 90% ATK, +20% per other ally standing. Stun 1.',
  run(c) { const n = standing(c.me).length; c.hit(c.tgt, { atk: 0.9 }, { mult: 1 + 0.2 * (n - 1) }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'walrus_shardwall', name: 'Tusk Gouge', type: 'BEAST', owner: 'walrus', reach: 'single', cd: 3, fx: 'stomp | fang | claw',
  text: 'Hits for 68% ATK. Splash 35%. Root 2. Breaks a guard this round, for 2x.',
  run(c) {
    const g = !!c.tgt.s.guard || foeChoice(c.b, c.u)?.k === 'guard';
    c.spread({ atk: 0.68 }, { mult: g ? 2 : 1, noGuard: g });
    c.st(c.tgt, 'root', 2);
    if (g && c.tgt.s.guard) { delete c.tgt.s.guard; c.msg(`${label(c.b, c.tgt)}'s guard breaks.`); }
  } });
defMove({ id: 'walrus_haymaker', name: 'Tusk Down', type: 'TIDE', owner: 'walrus', reach: 'single', cd: 6, nerve: 4, fx: 'hop | fang*2 rain | bite crack big jolt',
  text: 'Hits for 140% ATK. It always counts as its 3rd blow. Stun 1. Slow 2.',
  run(c) { unmark(c.u, 'walrus_count'); mark(c.b, c.u, c.u, 'walrus_count', 2, -1); c.hit(c.tgt, { atk: 1.4 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'slow', 2); } });

// berg: an iceberg mostly under the water that cuts below the line, comes back from behind, and rolls the fight over.
defPassive({ id: 'berg_undercut', name: 'Below the Line', owner: 'berg', text: 'Its hits ignore 25% of the foe\'s DEF and RES.',
  outMul(b, f, t, d) { if (d.kind === 'T') return 1; const a = stat(b, t, d.kind === 'P' ? 'def' : 'res'); return (100 + a) / (100 + a * 0.75); } });
defPassive({ id: 'berg_keel', name: 'Mostly Under', owner: 'berg', text: 'Takes 0.75x damage from dashes: they hit the part above the water.',
  inMul(b, f, src, d) { return d.move?.tags?.includes('dash') ? 0.75 : 1; } });
defMove({ id: 'berg_bit', name: 'Scrape Hull', type: 'TIDE', owner: 'berg', reach: 'single', cd: 1, fx: 'lunge | slash',
  text: 'Hits for 120% ATK. The foe loses 4 DEF for the battle, up to 20.',
  run(c) { c.hit(c.tgt, { atk: 1.2 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.defLoss = Math.min(20, (c.tgt.k.defLoss || 0) + 4); } });
defMove({ id: 'berg_groan', name: 'Ice Groan', type: 'SALT', owner: 'berg', reach: 'spread', cd: 4, wu: 50, fx: 'shake slow | quake frost',
  text: 'Wind-up. Hits for 101% ATK. Splash 35%. Sleep 1.',
  run(c) { c.spread({ atk: 1.01 }); c.st(c.tgt, 'sleep', 1); } });
defMove({ id: 'berg_growler', name: 'Undercut', type: 'TIDE', owner: 'berg', reach: 'single', cd: 3, fx: 'sink | shard rise | shatter',
  text: 'Hits for 85% ATK, 1.5x if the foe has a higher HP share than Gevuori. Empower 1.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }, { mult: c.tgt.hp / c.tgt.maxHp > c.u.hp / c.u.maxHp ? 1.5 : 1 }); c.st(c.u, 'empower', 1); } });
defMove({ id: 'berg_capsize', name: 'Capsize', type: 'TIDE', owner: 'berg', reach: 'single', cd: 6, nerve: 5, fx: 'sink slow | crest wave | splash big dark jolt',
  text: 'It and the foe swap their shares of HP. Then hits for 60% ATK. Splash 35%.',
  run(c) { if (!c.blocked(c.tgt)) rollHp(c.b, c.u, c.tgt); if (!c.tgt.ko) c.spread({ atk: 0.6 }); } });

// narwhal: a narwhal that lines its tusk up on one foe from under the ice, and the longer the line holds the harder the tusk lands.
defMark({ id: 'narwhal_line', name: 'lined up', max: 4, clock: 'any', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'narwhal_sighting', name: 'Under Watch', owner: 'narwhal', text: 'Deals 1.2x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return t.outAt > (f.k.prevTurn ?? -1) ? 1.2 : 1; } });
defPassive({ id: 'narwhal_ivory', name: 'Ivory Point', owner: 'narwhal', text: 'Its dashes and projectiles add a Line to the foe until it leaves. Its Stuns add Expose 2.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && t.side !== f.side && !t.ko && (d.move?.tags?.includes('dash') || d.move?.tags?.includes('projectile')) && f.k.lineAt !== b.turnNo) { f.k.lineAt = b.turnNo; mark(b, f, t, 'narwhal_line', 1, 8); } },
  afterApply(b, f, t, id) { if (id === 'stun' && t.side !== f.side) applyStatus(b, f, t, 'expose', 2); } });
defMove({ id: 'narwhal_lance', name: 'Shard Fall', type: 'TIDE', owner: 'narwhal', reach: 'single', tags: ['projectile'], cd: 1, fx: 'shard*2 rain | shatter',
  text: 'Hits for 90% ATK. Splash 35%.',
  run(c) { c.spread({ atk: 0.9 }); } });
defMove({ id: 'narwhal_breach', name: 'Breach', type: 'BEAST', owner: 'narwhal', reach: 'single', tags: ['dash'], cd: 2, fx: 'lunge fast | bite',
  text: 'Hits for 70% ATK, +20% per Line on the foe. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.7 }, { mult: 1 + 0.2 * c.marked(c.tgt, 'narwhal_line') }); c.hasten(c.u, 20); } });
defMove({ id: 'narwhal_podrush', name: 'Pod Dive', type: 'TIDE', owner: 'narwhal', reach: 'reserveAlly', cd: 4, tag: true, fx: 'sink | fish*3 orbit | splash ally',
  text: 'Haste 1 on your team. Switches to an ally. Its first turn comes 30% sooner.',
  run(c) { for (const a of standing(c.me)) c.st(a, 'haste', 1); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 30; } });
defMove({ id: 'narwhal_hornshot', name: 'Tusk Line', type: 'TIDE', owner: 'narwhal', reach: 'single', tags: ['projectile'], cd: 6, nerve: 5, wu: 100, fx: 'recoil slow | shard line fast | shatter big glare',
  text: 'Long wind-up. Hits for 100% ATK, +30% per Line on the foe. Stun 2.',
  run(c) { const n = c.marked(c.tgt, 'narwhal_line'); c.hit(c.tgt, { atk: 1.0 }, { mult: 1 + 0.3 * n }); unmark(c.tgt, 'narwhal_line'); c.st(c.tgt, 'stun', 2); } });

// rime: an icicle in love that kisses a friend so the first blow each turn on it lands soft and frosts the attacker, and grieves if it falls.
defMark({ id: 'rime_field', name: 'hoar night', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.45, 'M', 'TIDE'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 1); },
 });
defMark({ id: 'rime_kissed', name: 'kissed', clock: 'own', value: 0.12,
  beforeTake(b, f, src, amt, d) {
    if (d.dot || f.k.kissAt === b.turnNo || !src || src.side === f.side) return amt;
    f.k.kissAt = b.turnNo;
    return amt * 0.5;
  } });
defPassive({ id: 'rime_clearair', name: 'Cold Air', owner: 'rime', text: 'In reserve: every 3rd turn your side takes, 1 tide.',
  reserveTurn(b, f) { f.k.air = (f.k.air || 0) + 1; if (f.k.air % 3 === 0) addNerve(b, f.side, 1); } });
defPassive({ id: 'rime_cracked', name: 'Loved', owner: 'rime', text: 'When an ally it Kissed is KO\'d: Empower 3 on Puikria.',
  anyKO(b, f, v) { if (v !== f && v.side === f.side && v.k.kissedBy === f.idx + 1) applyStatus(b, f, f, 'empower', 3); } });
defMove({ id: 'rime_petal', name: 'Frost Flower', type: 'TIDE', owner: 'rime', reach: 'spread', tags: ['spell'], cd: 1, fx: 'sway | petal*4 spiral | bloom frost',
  text: 'Hits for 58% MGK. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.58 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'rime_grip', name: 'Frost Bitten', type: 'TIDE', owner: 'rime', reach: 'single', tags: ['spell'], cd: 3, fx: 'flare | salt*3 converge | frost drip',
  text: 'Hits for 64% MGK. Root 2. Burn 2 (30% MGK each turn).',
  run(c) { c.hit(c.tgt, { mgk: 0.64 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'mgk') * 0.3); } });
defMove({ id: 'rime_bloom', name: 'Chilly Kiss', type: 'TIDE', owner: 'rime', reach: 'ally', cd: 3, fx: 'sway | petal*3 orbit | sparkle ally',
  text: 'Kisses an ally 3 turns: the first hit on it each turn deals 0.5x. 1 tide.',
  run(c) { const a = c.ally!; c.mark(a, 'rime_kissed', 1, 3); a.k.kissedBy = c.u.idx + 1; c.nerve(c.me, 1); } });
defMove({ id: 'rime_field', name: 'Kind Winter', type: 'TIDE', owner: 'rime', reach: 'spread', tags: ['spell', 'channel'], cd: 6, nerve: 5, fx: 'lift | star*5 rain | frost sparkle big tint',
  text: 'Hits for 64% MGK. Splash 35%. At its next 3 turns: 45% MGK, Splash 35%, Slow 1.',
  run(c) { c.spread({ mgk: 0.64 }); c.mark(c.u, 'rime_field', 1, 3); startChannel(c.b, c.u, [{ on: c.u, id: 'rime_field' }]); } });

// auk: the last great auk that never stops sliding: each dash in a row builds Momentum, and it fights hardest as the last of its side.
defMark({ id: 'auk_momentum', name: 'momentum', max: 4, volatile: true, value: 0.06,
  outMul(b, f, t, d) { return d.move ? 1 + 0.08 * marked(f, 'auk_momentum') : 1; } });
defMark({ id: 'auk_roll', name: 'sliding', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; msg(b, `${label(b, f)} slides on.`); splash(b, f, stat(b, f, 'atk') * 0.6, 'P', 'BEAST'); } });
defPassive({ id: 'auk_ricochet', name: 'Momentum', owner: 'auk', text: 'Each turn in a row it dashes: 1 Momentum, up to 4. Its moves deal +8% per Momentum.',
  turnEnd(b, f, action) {
    const m = action === 'move' && f.k.lastMove ? MOVES[f.moves[f.k.lastMove - 1]] : null;
    if (m?.tags?.includes('dash')) mark(b, f, f, 'auk_momentum', 1, -1); else unmark(f, 'auk_momentum');
  } });
defPassive({ id: 'auk_lastpair', name: 'Last of Them', owner: 'auk', text: 'Takes 0.85x while Unstoppable or shielded. While last on its side: deals 1.3x, takes 0.8x.',
  outMul(b, f) { return standing(b.s[f.side]).length === 1 ? 1.3 : 1; },
  inMul(b, f) { return (standing(b.s[f.side]).length === 1 ? 0.8 : 1) * (f.s.unstop || f.shield > 0 ? 0.85 : 1); } });
defMove({ id: 'auk_flurry', name: 'Wing Slaps', type: 'BEAST', owner: 'auk', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | slash',
  text: 'Hits 3 times for 30% ATK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.3 }); } });
defMove({ id: 'auk_carom', name: 'Crash Landing', type: 'TIDE', owner: 'auk', reach: 'spread', cd: 3, fx: 'hop | splash puff',
  text: 'Hits for 35% ATK. Splash 35%. Shield of 6% max HP per foe standing.',
  run(c) { c.spread({ atk: 0.35 }); c.shield(c.u, c.u.maxHp * 0.06 * standing(c.them).length, 3); } });
defMove({ id: 'auk_bellyflop', name: 'Belly Slide', type: 'BEAST', owner: 'auk', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | puff',
  text: 'Hits for 48% ATK, +15% per Momentum. Weaken 1. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.48 }, { mult: 1 + 0.15 * marked(c.u, 'auk_momentum') }); c.st(c.tgt, 'weaken', 1); c.hasten(c.u, 25); } });
defMove({ id: 'auk_toboggan', name: 'Ice Slide', type: 'BEAST', owner: 'auk', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'lunge | slash frost big jolt',
  text: 'Unstoppable 2. Hits for 80% ATK. Stun 1. 3 Momentum. Next 2 turns: 60% ATK, Splash 35%.',
  run(c) { c.st(c.u, 'unstop', 2); c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'stun', 1); c.mark(c.u, 'auk_momentum', 3, -1); c.mark(c.u, 'auk_roll', 1, 2); } });

// cuirass: a breastplate that work-hardens with every dent and hammers its dents back out as force.
defMark({ id: 'cuirass_dent', name: 'dents', max: 8, value: 0.05 });
defPassive({ id: 'cuirass_dented', name: 'Dented Hard', owner: 'cuirass', text: 'When hit: a Dent, up to 8. Each cuts damage by 3%. Turn start: one fades.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) mark(b, f, f, 'cuirass_dent', 1); },
  inMul(b, f) { return 1 - 0.03 * marked(f, 'cuirass_dent'); },
  turnStart(b, f) { shed(f, 'cuirass_dent', 1); } });
defPassive({ id: 'cuirass_riveted', name: 'Rivet Heads', owner: 'cuirass', text: 'When a dash hits it: the dasher takes 25% of Losari\'s DEF as true damage.',
  afterTake(b, f, src, dealt, d) { if (src && src.side !== f.side && !src.ko && d.move?.tags?.includes('dash')) strike(b, f, src, stat(b, f, 'def') * 0.25, 'T', null); } });
defMove({ id: 'cuirass_rivet', name: 'Strap Whirl', type: 'GEAR', owner: 'cuirass', reach: 'spread', cd: 1, fx: 'spin | slash',
  text: 'Hits for 80% ATK. Splash 35%. Weaken 1.',
  run(c) { c.spread({ atk: 0.8 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'cuirass_platespin', name: 'Hammer Out', type: 'STONE', owner: 'cuirass', reach: 'single', cd: 2, fx: 'stomp | quake shatter',
  text: 'Spends its Dents: 57% ATK + 17% ATK per Dent. Its next turn comes 30% sooner.',
  run(c) { const n = marked(c.u, 'cuirass_dent'); unmark(c.u, 'cuirass_dent'); c.hit(c.tgt, { atk: 0.57 + 0.17 * n }); c.hasten(c.u, 30); } });
defMove({ id: 'cuirass_burnish', name: 'Take Dents', type: 'GEAR', owner: 'cuirass', reach: 'self', cd: 4, wt: 60, fx: 'shake | ring self',
  text: 'Gains 4 Dents. Heals 8% of its max HP.',
  run(c) { c.mark(c.u, 'cuirass_dent', 4); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'cuirass_hammerout', name: 'Saw Edge', type: 'GEAR', owner: 'cuirass', reach: 'single', cd: 6, nerve: 4, fx: 'lunge | claw slash big jolt',
  text: 'Hits for 137% ATK, +11% ATK per Dent. Its Dents stay. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 1.37 + 0.11 * marked(c.u, 'cuirass_dent') }); c.st(c.tgt, 'slow', 2); } });

// ================================================================ hilt road and battlefield

// pennon: a battle banner whose snap changes how far its moves carry: wide over the whole enemy line, or tight onto one foe.
defMark({ id: 'pennon_tether', name: 'roped', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The rope on ${label(b, f)} snaps tight.`); strike(b, by, f, stat(b, by, 'mgk') * 0.5, 'M', 'ROOT'); } });
defPassive({ id: 'pennon_windcatch', name: 'Catches Wind', owner: 'pennon', text: 'When it hits a foe: Snap Out\'s cooldown drops 1.',
  afterDeal(b, f, t, dealt, d) { if (d.reserve || d.dot || t.side === f.side) return; const i = f.moves.indexOf('pennon_unfurl'); if (i >= 0) f.cd[i] = Math.max(0, f.cd[i] - 1); } });
defPassive({ id: 'pennon_rallying', name: 'Colors', owner: 'pennon', text: 'Allies it shields get Empower 1. A foe KO\'d while it is out: its next move reaches wide.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) setReach(b, f, 'wide', 1); } });
defMove({ id: 'pennon_snap', name: 'Wind Crack', type: 'STAR', owner: 'pennon', reach: 'spread', tags: ['spell'], cd: 1, fx: 'shake | feather*3 sweep | slash',
  text: 'Hits for 88% MGK. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.88 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'pennon_rally', name: 'Guy Rope', type: 'ROOT', owner: 'pennon', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | kelp line | slash',
  text: 'Hits for 100% MGK. Root 2. After the foe\'s next turn: it takes 50% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1 }); c.st(c.tgt, 'root', 2); if (!c.tgt.ko) c.mark(c.tgt, 'pennon_tether', 1, 1); } });
defMove({ id: 'pennon_plant', name: 'Plant Pole', type: 'STAR', owner: 'pennon', reach: 'ally', cd: 3, fx: 'stomp | pillar ally',
  text: 'Shields an ally 15% of max HP. It gets Haste 1, and its next move reaches wide.',
  run(c) { const a = c.ally!; c.shield(a, a.maxHp * 0.15, 3); c.st(a, 'haste', 1); if (has(c.u, 'pennon_rallying') && a !== c.u) c.st(a, 'empower', 1); setReach(c.b, a, 'wide', 1); } });
defMove({ id: 'pennon_unfurl', name: 'Snap Out', type: 'STAR', owner: 'pennon', reach: 'self', cd: 5, nerve: 3, wt: 40, fx: 'swell | star*4 orbit | burst big glare',
  text: 'Its next move reaches wide (reserves too), or its next 2 tight (1.4x, one foe). Heals 6% max HP.',
  options() { return ['Wide', 'Tight']; },
  run(c) { setReach(c.b, c.u, c.opt === 1 ? 'tight' : 'wide', c.opt === 1 ? 2 : 1); c.heal(c.u, c.u.maxHp * 0.06); } });

// tang: the hidden half of a sword that hands its keen edge to whoever holds it, spins when cornered, and cuts a thousand times.
defSummon({ id: 'tang_ward', name: 'Whetstone', owner: 'tang', text: 'Each turn: your out whorl heals 6% of its max HP.', every: 100,
  sprite: { px: ['........', '..2222..', '.222222.', '22233222', '22311322', '.222222.', '..2222..', '.4.44.4.'], c: ['#9d9da5', '#63f383', '#705037'] },
  act(b, s) { const o = b.s[s.side].f[b.s[s.side].out]; if (o && !o.ko) heal(b, ownerOf(b, s), o, o.maxHp * 0.06); } });
defMark({ id: 'tang_spin', name: 'spinning', clock: 'own', volatile: true, value: 0.15,
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.2 : 1; },
  statusImmune(f, id) { return has(f, 'tang_twostep') && (id === 'stun' || id === 'silence'); },
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.56, 'P', 'GEAR'); } });
defPassive({ id: 'tang_edgeguard', name: 'Keen Edge', owner: 'tang', text: 'Every 3rd hit it lands on the foe deals 1.3x and heals it 15% of the damage.',
  outMul(b, f, t, d) { return !d.dot && !d.reserve && t.side !== f.side && (f.k.dance || 0) % 3 === 2 ? 1.3 : 1; },
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.side === f.side || f.k.danceAt === b.turnNo) return;
    f.k.danceAt = b.turnNo;
    if ((f.k.dance || 0) % 3 === 2) heal(b, f, f, dealt * 0.15);
    f.k.dance = (f.k.dance || 0) + 1;
  } });
defPassive({ id: 'tang_twostep', name: 'Spin Through', owner: 'tang', text: 'While spinning: immune to Stun and Silence.' });
defMove({ id: 'tang_chip', name: 'Pommel Chip', type: 'STONE', owner: 'tang', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | quake',
  text: 'Hits for 84% ATK. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.84 }); c.hasten(c.u, 20); } });
defMove({ id: 'tang_spin', name: 'Grip Spin', type: 'GEAR', owner: 'tang', reach: 'spread', cd: 4, fx: 'spin | cog*3 orbit | slash',
  text: '2 turns: it takes 0.2x magic. At each of its turns: 56% ATK, Splash 35%.',
  run(c) { c.mark(c.u, 'tang_spin', 1, 2); } });
defMove({ id: 'tang_scabbard', name: 'Hand Over', type: 'GEAR', owner: 'tang', reach: 'ally', cd: 3, fx: 'flare | card return | sparkle ally',
  text: 'Lends an ally Keen Edge for 3 turns, and sets a Whetstone (3 turns) for it.',
  run(c) { const a = c.ally!; if (a !== c.u) lendPassive(c.b, c.u, a, 'tang_edgeguard', 3); summon(c.b, c.u, 'tang_ward', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'tang_cuts', name: 'Thousand Cuts', type: 'GEAR', owner: 'tang', reach: 'single', cd: 6, nerve: 5, fx: 'blink | slash claw big glare',
  text: 'Untouchable 1. Hits 6 times for 14% ATK, every 3rd on a reserve.',
  run(c) {
    c.st(c.u, 'invuln', 1);
    const rs = reserves(c.them);
    for (let i = 0; i < 6; i++) {
      const t = i % 3 === 2 && rs.length ? rs[(i / 3) % rs.length | 0] : c.tgt;
      if (t.ko) continue;
      c.hit(t, { atk: 0.14 }, t === c.tgt ? {} : { reserve: true });
    }
  } });

// buckler: a round shield that keeps a count of every blow it takes and pays the whole count back, and turns attacks and throws on its rim.
defMark({ id: 'buckler_count', name: 'blows taken', max: 8, value: 0.05 });
defMark({ id: 'buckler_aegis', name: 'rim raised', clock: 'own', volatile: true, value: 0.15,
  beforeTake(b, f, src, amt, d) {
    if (!src || src.side === f.side || !(d.attack || d.move?.tags?.includes('projectile'))) return amt;
    if (has(f, 'buckler_riposte') && !src.ko) strike(b, f, src, stat(b, f, 'atk') * 0.4, 'P', 'GEAR');
    return 0;
  },
  turnStart(b, f) { unmark(f, 'buckler_aegis'); msg(b, `${label(b, f)} drives the shield out.`); splash(b, f, stat(b, f, 'atk') * 0.83, 'P', 'GEAR'); } });
defPassive({ id: 'buckler_umbo', name: 'Ledger', owner: 'buckler', text: 'Each hit it takes adds 1 Blow Taken, up to 8. Pay It Back spends them.',
  afterTake(b, f, src, dealt, d) { if (!d.dot && src && src.side !== f.side) mark(b, f, f, 'buckler_count', 1, -1); } });
defPassive({ id: 'buckler_riposte', name: 'Riposte', owner: 'buckler', text: 'Each hit Raise the Rim stops is answered for 40% ATK.' });
defMove({ id: 'buckler_rim', name: 'Rim Throw', type: 'ROOT', owner: 'buckler', reach: 'single', tags: ['projectile'], cd: 1, fx: 'spin | hoop return | ring',
  text: 'Hits for 115% ATK. 1.5x on a foe below 25% HP.',
  run(c) { c.hit(c.tgt, { atk: 1.15 }, { mult: under(c.tgt, 0.25) ? 1.5 : 1 }); } });
defMove({ id: 'buckler_vault', name: 'Pay It Back', type: 'GEAR', owner: 'buckler', reach: 'single', tags: ['dash'], cd: 4, fx: 'lunge | shatter burst',
  text: 'Spends its Blows Taken: hits for 50% ATK + 20% ATK per Blow. Stun 1.',
  run(c) { const n = marked(c.u, 'buckler_count'); unmark(c.u, 'buckler_count'); c.hit(c.tgt, { atk: 0.5 + 0.2 * n }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'buckler_parry', name: 'Raise the Rim', type: 'GEAR', owner: 'buckler', reach: 'self', cd: 4, wt: 60, fx: 'recoil | hoop orbit | ring self',
  text: 'Attacks and projectiles deal it 0 till its next turn. Then 83% ATK, Splash 35%.',
  run(c) { c.mark(c.u, 'buckler_aegis', 1, 2); } });
defMove({ id: 'buckler_fall', name: 'Falling Shield', type: 'GEAR', owner: 'buckler', reach: 'spread', cd: 6, nerve: 5, wu: 80, unstop: true, fx: 'lift slow | shell rain | crack quake big jolt',
  text: 'Unstoppable wind-up. Hits for 177% ATK. Splash 35%. Slow 2.',
  run(c) { c.spread({ atk: 1.77 }); c.st(c.tgt, 'slow', 2); } });

// destrier: a war horse in its barding that ropes a foe, spurs on, rides through twice, and gallops a foe off the field.
defSummon({ id: 'destrier_skaarl', name: 'Barding', owner: 'destrier', sprite: { px: ['4......4', '44.33.44', '.444444.', '.4.44.4.', '.444444.', '42444424', '4.4444.4', '4.4..4.4'], c: ['#805037', '#e1b948', '#9a9eaa'] }, text: 'Umatsu\'s armour. Takes single-target hits meant for Umatsu until it falls.', guard: true,
  gone(b, s, owner) {
    if (!owner || owner.ko || owner.k.stabling) return;
    owner.k.onFoot = 1; owner.k.courage = 0;
    msg(b, `${label(b, owner)} loses its barding.`);
  } });
function mountUp(b: Battle, f: Fighter, pct: number): void {
  if (summonsOf(b, f.side, 'destrier_skaarl').length) return;
  summon(b, f, 'destrier_skaarl', { hp: pct });
  f.k.onFoot = 0;
}
const mounted = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'destrier_skaarl').length > 0;
defMark({ id: 'destrier_line', name: 'on the rope', clock: 'own', volatile: true, negative: true, value: -0.08,
  turnStart(b, f) { const mk = unmark(f, 'destrier_line'); const by = mk ? markedBy(b, mk) : null; if (!by) return; msg(b, `The rope yanks ${label(b, f)}.`); strike(b, by, f, stat(b, by, 'atk') * 0.38, 'P', 'TIDE'); } });
defMark({ id: 'destrier_frenzy', name: 'spurred', max: 3, clock: 'own', volatile: true, value: 0.06,
  afterAttack(b, f, t) { hastenFighter(b, f, 25); if (!t.ko && !t.gone) strike(b, f, t, t.maxHp * 0.03, 'P', 'BEAST'); shed(f, 'destrier_frenzy', 1); } });
defPassive({ id: 'destrier_mounted', name: 'Barded', owner: 'destrier', text: 'Comes out in Barding (20% max HP) that takes its hits. Without it: deals 0.9x.',
  comeOut(b, f) { if (!f.k.onFoot) mountUp(b, f, f.k.mountLeft ? f.k.mountLeft / 100 : 0.2); },
  leave(b, f) { const m = summonsOf(b, f.side, 'destrier_skaarl')[0]; f.k.mountLeft = m ? Math.round(100 * m.hp / f.maxHp) : 0; f.k.stabling = 1; if (m) dismiss(b, m); f.k.stabling = 0; },
  outMul(b, f) { return mounted(b, f) ? 1 : 0.9; } });
defPassive({ id: 'destrier_courage', name: 'Pluck', owner: 'destrier', text: 'Without Barding: each hit it lands adds Pluck. At 3: Barding again at 15%.',
  afterDeal(b, f, t, dealt, d) {
    if (d.reserve || d.dot || t.side === f.side || !f.k.onFoot) return;
    f.k.courage = (f.k.courage || 0) + 1;
    if (f.k.courage >= 3) { f.k.courage = 0; f.k.mountLeft = 0; mountUp(b, f, 0.15); msg(b, `${label(b, f)} gets its barding back.`); }
  } });
defMove({ id: 'destrier_rearup', name: 'Lead Rope', type: 'TIDE', owner: 'destrier', reach: 'single', cd: 1, fx: 'recoil | kelp line | slash',
  text: 'Hits for 61% ATK. Delays the foe\'s next turn by 30%. At that turn: 38% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.61 }); if (!c.tgt.ko) { c.delay(c.tgt, 30); c.mark(c.tgt, 'destrier_line', 1, 2); } } });
defMove({ id: 'destrier_couch', name: 'Spur On', type: 'BEAST', owner: 'destrier', reach: 'self', cd: 3, wt: 50, fx: 'stomp fast | puff self', text: 'Its next 3 attacks come 25% sooner and add 3% of the foe\'s max HP.',
  run(c) { c.mark(c.u, 'destrier_frenzy', 3, 4); } });
defMove({ id: 'destrier_joust', name: 'Ride Through', type: 'BEAST', owner: 'destrier', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge fast | slash', text: 'Hits for 88% ATK. In Barding: its cooldown resets, but not twice in a row.',
  run(c) { const m = mounted(c.b, c.u); c.hit(c.tgt, { atk: 0.88 }); if (m && !c.u.k.joustAgain) { c.u.k.joustAgain = 1; ready(c.u, 'destrier_joust'); } else c.u.k.joustAgain = 0; } });
defMove({ id: 'destrier_gallop', name: 'Full Gallop', type: 'BEAST', owner: 'destrier', reach: 'single', tags: ['dash'], cd: 6, nerve: 5, fx: 'lunge | bite quake big jolt',
  text: 'Barding again if it has none. Hits for 132% ATK. Forces the foe out.',
  run(c) { if (!mounted(c.b, c.u)) { c.u.k.mountLeft = 0; mountUp(c.b, c.u, 0.2); } c.hit(c.tgt, { atk: 1.32 }); if (!c.tgt.ko) c.forceOut(); } });

// mangonel: a catapult that catches whatever is thrown at it in its cradle and throws it back, and winds its arm bigger as it goes.
defMark({ id: 'mangonel_grown', name: 'wound up', max: 2, value: 0.12,
  statBonus(f, k) { const n = f.m.mangonel_grown?.n || 0; if (k === 'atk' || k === 'def') return Math.round(f.st[k] * 0.15 * n); return k === 'agi' ? -6 * n : 0; } });
defMark({ id: 'mangonel_load', name: 'cradle full', max: 1, value: 0.12, spend: 'mangonel_hurl' });
defPassive({ id: 'mangonel_cradle', name: 'Full Cradle', owner: 'mangonel', text: 'When a foe\'s projectile hits it: it catches the move in its cradle for Fling Back.',
  afterTake(b, f, src, dealt, d) { if (!src || src.side === f.side || !d.move?.tags?.includes('projectile') || f.ko) return; f.k.cradle = moveIdx(d.move.id); mark(b, f, f, 'mangonel_load', 1, -1); msg(b, `${label(b, f)} catches ${d.move.name}.`); } });
defPassive({ id: 'mangonel_creak', name: 'Creaking Arm', owner: 'mangonel', text: 'With a full cradle: 0.8x from projectiles. Every 3rd attack on it: Slow 2 on the attacker.',
  inMul(b, f, src, d) { return marked(f, 'mangonel_load') && d.move?.tags?.includes('projectile') ? 0.8 : 1; },
  afterTake(b, f, src, dealt, d) { if (!d.attack || !src || src.side === f.side) return; f.k.crag = (f.k.crag || 0) + 1; if (f.k.crag % 3 === 0 && !src.ko) applyStatus(b, f, src, 'slow', 2); } });
defMove({ id: 'mangonel_lob', name: 'Loose Stones', type: 'STONE', owner: 'mangonel', reach: 'spread', tags: ['projectile'], cd: 1, fx: 'recoil | pebble*4 arc | crack',
  text: 'Hits for 60% ATK. Splash 35%.',
  run(c) { c.spread({ atk: 0.6 }); } });
defMove({ id: 'mangonel_hurl', name: 'Fling Back', type: 'STONE', owner: 'mangonel', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | pebble arc | crack shatter',
  text: 'Throws the caught move at 1.2x. Empty: 90% ATK, Splash 35%, forces the foe out.',
  run(c) {
    const m = marked(c.u, 'mangonel_load') ? moveAt(c.u.k.cradle || 0) : null;
    unmark(c.u, 'mangonel_load');
    if (!m || m.id === c.move.id) { c.spread({ atk: 0.9 }); if (!c.tgt.ko) c.forceOut(); return; }
    c.msg(`${label(c.b, c.u)} throws ${m.name} back.`);
    borrow(c, m, 1.2);
  } });
defMove({ id: 'mangonel_payload', name: 'Arm Swing', type: 'ROOT', owner: 'mangonel', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | claw',
  text: 'Hits for 90% ATK. Splash 35%. Stun 1. Cuts off the foe\'s wind-up.',
  run(c) { c.spread({ atk: 0.9 }); if (!c.tgt.ko) { c.interrupt(c.tgt); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'mangonel_ratchet', name: 'Wind Arm', type: 'STONE', owner: 'mangonel', reach: 'single', cd: 6, nerve: 4, fx: 'swell | pebble*3 arc | quake big jolt',
  text: 'Grows: +15% ATK and DEF, -6 AGI, max 2. Heals 10% of max HP. Hits for 94% ATK.',
  run(c) { c.mark(c.u, 'mangonel_grown', 1, -1); c.heal(c.u, c.u.maxHp * 0.1); c.hit(c.tgt, { atk: 0.94 }); } });

// sallet: a helmet with a drake living in it some days: the drake comes out as a form, and the helmet can be worn by a friend.
const SALLET_DRAKE: SpriteData = { px: ['4......4', '44.22.44', '.422224.', '44344344', '444.4444', '.4444444', '..4..4.4', '.44..44.'], c: ['#aab2be', '#db5434', '#156d5c'] };
defMark({ id: 'sallet_drakeform', name: 'drake out', clock: 'own', value: 0.2,
  statusImmune(f, id) { return id === 'stun'; },
  inMul() { return 0.8; },
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.4, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); },
  expire(b, f) { clearForm(b, f); msg(b, `The drake goes back into ${label(b, f)}.`); },
  leave(b, f) { unmark(f, 'sallet_drakeform'); clearForm(b, f); } });
defPassive({ id: 'sallet_oldblood', name: 'Warm Steel', owner: 'sallet', text: 'Turn start: heals 2% of its max HP. Takes 0.9x damage from moves.',
  turnStart(b, f) { heal(b, f, f, f.maxHp * 0.02); },
  inMul(b, f, src, d) { return d.move ? 0.9 : 1; } });
defPassive({ id: 'sallet_wyrmscale', name: 'Drake Scale', owner: 'sallet', text: 'As the drake: immune to Stun, takes 0.8x, attacks hit reserves 40% ATK.' });
defMove({ id: 'sallet_hotbreath', name: 'Visor Breath', type: 'GEAR', owner: 'sallet', reach: 'spread', cd: 1, fx: 'flare | puff cinders',
  text: 'Hits for 57% ATK. Splash 35%. Weaken 1.',
  run(c) { c.spread({ atk: 0.57 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'sallet_drakefire', name: 'Drake Fire', type: 'STONE', owner: 'sallet', reach: 'spread', cd: 1, extra: true, fx: 'flare | ember*3 sweep | smoke cinders',
  text: 'Hits for 80% ATK. Splash 35%. Burn 2 on every foe (20% ATK each turn).',
  run(c) { c.spread({ atk: 0.8 }); for (const e of standing(c.them)) c.st(e, 'burn', 2, stat(c.b, c.u, 'atk') * 0.2); } });
defMove({ id: 'sallet_browbash', name: 'Plume Bash', type: 'STONE', owner: 'sallet', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | quake',
  text: 'Hits for 78% ATK. Stun 1. Expose 1. 2x if the foe dashes this round.',
  run(c) { const a = foeChoice(c.b, c.u); const dash = a?.k === 'move' && !!moveDef(c.tgt, a.i)?.tags?.includes('dash'); c.hit(c.tgt, { atk: 0.78 }, { mult: dash ? 2 : 1 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'sallet_visor', name: 'Lend the Helm', type: 'STONE', owner: 'sallet', reach: 'ally', cd: 3, wt: 60, fx: 'flare | shell return | ring ally',
  text: 'An ally wears its helm: Warm Steel for 3 turns. Fortify 1. Regen 2.',
  run(c) { const a = c.ally!; if (a !== c.u) lendPassive(c.b, c.u, a, 'sallet_oldblood', 3); c.st(a, 'fortify', 1); c.st(a, 'regen', 2, 0.06); } });
defMove({ id: 'sallet_drake', name: 'Drake Day', type: 'STONE', owner: 'sallet', reach: 'spread', cd: 7, nerve: 5, wt: 60, fx: 'swell | ember*4 orbit | cinders big tint',
  text: 'Hits for 80% ATK. Splash 35%. Drake for 3 turns: 1.2x ATK, 1.1x AGI, Drake Fire.',
  run(c) { c.spread({ atk: 0.8 }); setForm(c.b, c.u, { tag: 'drake', sprite: SALLET_DRAKE, statMul: { atk: 1.2, agi: 1.1 } }, ['sallet_drakefire']); c.mark(c.u, 'sallet_drakeform', 1, 3); } });

// fletch: an arrow that never came down, shot from a quiver of three with no wait between shots, its last arrow hanging in the air.
defMark({ id: 'fletch_hang', name: 'arrow hanging', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { unmark(f, 'fletch_hang'); const t = foe(b, f); if (!t) return; msg(b, 'The arrow comes down.'); strike(b, f, t, stat(b, f, 'atk') * 0.6, 'P', 'ROOT'); } });
defPassive({ id: 'fletch_rimed', name: 'High Frost', owner: 'fletch', text: 'Its attacks add Slow 1. Its projectiles deal 2x to a guarding foe.',
  outMul(b, f, t, d) { return t.s.guard && d.move?.tags?.includes('projectile') ? 2 : 1; },
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'fletch_neverlanded', name: 'Never Landed', owner: 'fletch', text: 'Deals 1.2x to a Slowed foe. Loose\'s last shot drops an arrow next turn: 60% ATK.',
  outMul(b, f, t) { return t.s.slow ? 1.2 : 1; },
  afterMove(b, f, m) { if (m.id === 'fletch_nock' && ammoOf(f, f.moves.indexOf(m.id)) === (m.ammo || 0) && f.cd[f.moves.indexOf(m.id)] > 0) mark(b, f, f, 'fletch_hang', 1, 2); } });
defMove({ id: 'fletch_nock', name: 'Loose', type: 'ROOT', owner: 'fletch', reach: 'single', tags: ['projectile'], cd: 3, ammo: 3, fx: 'recoil | shard line fast | slash',
  text: 'Hits for 77% ATK. 3 shots with no wait, then its cooldown starts.',
  run(c) { c.hit(c.tgt, { atk: 0.77 }); } });
defMove({ id: 'fletch_sheaf', name: 'Sheaf Loose', type: 'ROOT', owner: 'fletch', reach: 'spread', tags: ['projectile'], cd: 3, fx: 'recoil | shard*3 rain | shatter',
  text: 'Spends every shot left in Loose: 30% ATK per shot. Splash 35%. Slow 2.',
  run(c) {
    const i = c.u.moves.indexOf('fletch_nock'), n = i >= 0 && c.u.cd[i] <= 0 ? ammoOf(c.u, i) : 0;
    if (!n) { c.msg('The quiver is empty.'); return; }
    c.spread({ atk: 0.3 * n }); c.st(c.tgt, 'slow', 2);
    (c.u.ammo ||= c.u.moves.map(() => -1))[i] = -1;
    c.u.cd[i] = (MOVES.fletch_nock?.cd || 3) + 1;
  } });
defMove({ id: 'fletch_overshoot', name: 'Frost Tip', type: 'TIDE', owner: 'fletch', reach: 'single', tags: ['projectile'], cd: 3, fx: 'shard arc | frost',
  text: 'Hits for 70% ATK. Expose 2 on every foe.',
  run(c) { c.hit(c.tgt, { atk: 0.7 }); for (const e of standing(c.them)) c.st(e, 'expose', 2); } });
defMove({ id: 'fletch_overdraw', name: 'Overdraw', type: 'ROOT', owner: 'fletch', reach: 'single', tags: ['projectile'], cd: 6, splash: 0.3, nerve: 4, wu: 70, fx: 'recoil slow | thorn line fast | slash shatter big glare',
  text: 'Wind-up. Hits for 160% ATK. Splash 30%. Stun 2. Loose is ready with all 3 shots.',
  run(c) { c.spread({ atk: 1.6 }); c.st(c.tgt, 'stun', 2); const i = c.u.moves.indexOf('fletch_nock'); if (i >= 0) { c.u.cd[i] = 0; (c.u.ammo ||= c.u.moves.map(() => -1))[i] = -1; } } });

// ================================================================ moonbed

// image: a reflection that does what you were about to do: its side sees the foe's choice first, and it copies that choice before the foe.
defMark({ id: 'image_copy', name: 'a reflection', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); msg(b, `${label(b, f)} is itself again.`); },
  leave(b, f) { unmark(f, 'image_copy'); clearForm(b, f); } });
defPassive({ id: 'image_afterimage', name: 'Foreknowing', owner: 'image', text: 'While out: your side sees the foe\'s choice first. Its first turn out comes 25% sooner.',
  foresee() { return true; },
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 25; } });
defPassive({ id: 'image_calm', name: 'Calm Surface', owner: 'image', text: 'Takes 0.8x damage from crests.',
  inMul(b, f, src, d) { return d.move?.nerve ? 0.8 : 1; } });
defMove({ id: 'image_glint', name: 'Mirror Flash', type: 'STAR', owner: 'image', reach: 'spread', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | star*3 sweep | flash',
  text: 'Hits for 71% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 0.71 }); } });
defMove({ id: 'image_invert', name: 'Ripple Back', type: 'STAR', owner: 'image', reach: 'single', tags: ['spell'], cd: 3, quick: true, fx: 'blink fast | orb return | ring',
  text: 'Quick. Uses the move the foe chose this round, as itself. Else: 80% MGK.',
  run(c) {
    const a = foeChoice(c.b, c.u);
    const m = a?.k === 'move' ? moveDef(c.tgt, a.i) : null;
    if (!m || m.nerve || m.reach === 'reserveAlly' || m.reach === 'dragin' || m.id === c.move.id) { c.hit(c.tgt, { mgk: 0.8 }); return; }
    c.msg(`${label(c.b, c.u)} does it first: ${m.name}.`);
    borrow(c, m, 1);
  } });
defMove({ id: 'image_lure', name: 'Glassy Beam', type: 'TIDE', owner: 'image', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | beam | flash',
  text: 'Hits for 80% MGK, 2x on a foe below 50% HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }, { mult: under(c.tgt, 0.5) ? 2 : 1 }); } });
defMove({ id: 'image_mirrortake', name: 'Reflect It', type: 'STAR', owner: 'image', reach: 'single', cd: 6, nerve: 4, wt: 60, fx: 'blink | rune*4 converge | vortex big glare',
  text: 'Becomes the foe for 4 turns, every move ready.',
  run(c) { if (c.blocked(c.tgt)) return; takeOver(c.b, c.u, c.tgt, 'copy'); c.u.cd = c.u.cd.map(() => 0); c.mark(c.u, 'image_copy', 1, 4); c.msg(`${label(c.b, c.u)} is now ${label(c.b, c.tgt)}.`); } });

// skipper: a mudskipper that hops away from whatever looks at it, while the big thing that follows it comes up under whatever it marks.
defMark({ id: 'skipper_hop', name: 'hopped up', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'skipper_hop'); msg(b, `${label(b, f)} comes down.`); splash(b, f, stat(b, f, 'atk') * 0.59, 'P', 'TIDE'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 2); } });
defMark({ id: 'skipper_fish', name: 'followed', clock: 'own', negative: true, value: -0.2,
  expire(b, f, mk) {
    const by = markedBy(b, mk);
    msg(b, 'Something big comes up out of the mud.');
    if (!by) return;
    splash(b, by, stat(b, by, 'atk') * 1.4, 'P', 'TIDE');
    const t = foe(b, by);
    if (t && !t.ko) applyStatus(b, by, t, 'stun', 1);
  } });
defPassive({ id: 'skipper_slick', name: 'Slippery', owner: 'skipper', text: 'Takes 0.85x damage from attacks. Immune to Root.',
  inMul(b, f, src, d) { return d.attack ? 0.85 : 1; },
  statusImmune(f, id) { return id === 'root'; } });
defPassive({ id: 'skipper_sharkwater', name: 'Blood in Mud', owner: 'skipper', text: 'Something Big comes up 1 turn sooner under a Bleeding foe.' });
defMove({ id: 'skipper_dart', name: 'Skip In', type: 'TIDE', owner: 'skipper', reach: 'single', tags: ['projectile'], cd: 1, fx: 'hop | fish arc | splash',
  text: 'Hits for 75% ATK. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); c.hasten(c.u, 20); } });
defMove({ id: 'skipper_hop', name: 'Mud Hop', type: 'TIDE', owner: 'skipper', reach: 'self', tags: ['dash'], cd: 4, wt: 60, fx: 'hop | splash self',
  text: 'Untouchable 1. At its next turn: 59% ATK, Splash 35%, Slow 2.',
  run(c) { c.st(c.u, 'invuln', 1); c.mark(c.u, 'skipper_hop', 1, 2); } });
defMove({ id: 'skipper_barbfin', name: 'Barb Fin', type: 'BEAST', owner: 'skipper', reach: 'single', cd: 3, fx: 'lunge | fang | bite drip',
  text: 'Hits for 76% ATK. Bleed 3 (2% of the foe\'s max HP per stack each turn).',
  run(c) { c.hit(c.tgt, { atk: 0.76 }); c.st(c.tgt, 'bleed', 3, c.tgt.maxHp * 0.02); } });
defMove({ id: 'skipper_chum', name: 'Something Big', type: 'TIDE', owner: 'skipper', reach: 'single', cd: 6, nerve: 5, fx: 'sink | splash puff big dark jolt',
  text: 'Hits for 30% ATK. Slow 2. After 2 of the foe\'s turns: 140% ATK, Splash 35%, Stun 1.',
  run(c) {
    c.hit(c.tgt, { atk: 0.3 });
    c.st(c.tgt, 'slow', 2);
    if (c.tgt.ko) return;
    const soon = has(c.u, 'skipper_sharkwater') && c.tgt.s.bleed;
    c.mark(c.tgt, 'skipper_fish', 1, soon ? 1 : 2);
  } });

// silt: lakebed silt that settles heavier the longer it stays, opens a pit for whoever comes out next, and lets the bottom open.
defSummon({ id: 'silt_pit', name: 'Mire Pit', owner: 'silt', text: 'Each foe that comes out: Root 2 and 40% of Liemus\'s MGK. 3 turns.', every: 100,
  sprite: { px: ['........', '........', '..2222..', '.244442.', '24433442', '24133142', '.222222.', '........'], c: ['#636171', '#9ce341', '#3d3b48'] },
  act() { /* the pit only waits */ },
  trap(b, s, who) { const by = ownerOf(b, s); applyStatus(b, by, who, 'root', 2); if (by) strike(b, by, who, stat(b, by, 'mgk') * 0.4, 'M', 'STONE'); return false; } });
defMark({ id: 'silt_storm', name: 'stirred up', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.27, 'M', 'STONE'); } });
defPassive({ id: 'silt_silting', name: 'Settling', owner: 'silt', text: 'Each turn it stays out: takes 4% less damage, up to 20%. Leaving resets it.',
  comeOut(b, f) { f.k.settled = 0; },
  turnStart(b, f) { f.k.settled = Math.min(5, (f.k.settled || 0) + 1); },
  inMul(b, f) { return 1 - 0.04 * (f.k.settled || 0); } });
defPassive({ id: 'silt_lakebed', name: 'Soft Bottom', owner: 'silt', text: 'Takes 0.85x damage from a Rooted foe.',
  inMul(b, f, src) { return src && src.s.root ? 0.85 : 1; } });
defMove({ id: 'silt_sludge', name: 'Stir Up', type: 'STONE', owner: 'silt', reach: 'spread', tags: ['spell'], cd: 1, fx: 'sink | sand*2 rise | puff',
  text: 'Hits for 33% MGK. Splash 35%. At its next turn: 27% MGK to every foe.',
  run(c) { c.spread({ mgk: 0.33 }); c.mark(c.u, 'silt_storm', 1, 2); } });
defMark({ id: 'silt_murk', name: 'clouded', clock: 'own', negative: true, volatile: true, value: -0.08,
  outMul(b, f, t, d) { return d.move?.tags?.includes('projectile') ? 0.6 : 1; } });
defMove({ id: 'silt_cloud', name: 'Cloud Up', type: 'ROOT', owner: 'silt', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | kelp*2 rise | drip',
  text: 'Hits for 70% MGK. Weaken 2. Slow 1. The foe\'s projectiles deal 0.6x for 2 turns.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'weaken', 2); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'silt_murk', 1, 2); } });
defMove({ id: 'silt_mirepit', name: 'Sink Pit', type: 'STONE', owner: 'silt', reach: 'single', tags: ['spell'], cd: 5, fx: 'sink | sigil quake',
  text: 'Hits for 35% MGK. Root 2. Summons a Mire Pit (15% max HP, 3 turns).',
  run(c) { c.hit(c.tgt, { mgk: 0.35 }); c.st(c.tgt, 'root', 2); summon(c.b, c.u, 'silt_pit', { hp: 0.15, turns: 3 }); } });
defMove({ id: 'silt_sink', name: 'Bottom Opens', type: 'STONE', owner: 'silt', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'sink slow | sand*4 converge | vortex quake big dark',
  text: 'Hits for 80% MGK, +10% per turn settled. Splash 35%. Every foe: Root 2. Slow 2.',
  run(c) { c.spread({ mgk: 0.8 }, { mult: 1 + 0.1 * (c.u.k.settled || 0) }); for (const e of standing(c.them)) c.st(e, 'root', 2); c.st(c.tgt, 'slow', 2); } });

// spawn: a belly-mouthed frog whose curse turns a foe into a frog with frog moves, and whose tadpoles swarm.
const FROG: SpriteData = { px: ['........', '........', '.22..22.', '21222212', '23242322', '222.2222', '.222222.', '22....22'], c: ['#5ba840', '#b73226', '#e9c937'] };
defMark({ id: 'spawn_frog', name: 'a frog', clock: 'own', volatile: true, negative: true, value: -0.35,
  expire(b, f) { if (f.form?.tag === 'frog') clearForm(b, f); },
  leave(b, f) { unmark(f, 'spawn_frog'); if (f.form?.tag === 'frog') clearForm(b, f); } });
defMark({ id: 'spawn_shackle', name: 'tongue tied', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'spawn_shackle'); const t = foe(b, f); if (t) strike(b, f, t, stat(b, f, 'mgk') * 0.39 * (marked(t, 'spawn_frog') ? 2 : 1), 'M', 'BEAST'); } });
defSummon({ id: 'spawn_ward', name: 'Tadpole', owner: 'spawn', sprite: { px: ['........', '.2....2.', '..2222..', '.212212.', '.233332.', '.223322.', '...44...', '...4....'], c: ['#434149', '#f5f1e9', '#696777'] }, text: 'Twice a turn: bites the foe for 30% of Ranaru\'s MGK.', every: 50,
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'mgk') * 0.3, 'M', 'BEAST'); } });
defPassive({ id: 'spawn_toadskin', name: 'Toad Skin', owner: 'spawn', text: 'Deals 1.3x damage to a foe that is a frog or Stunned.',
  outMul(b, f, t) { return marked(t, 'spawn_frog') || t.s.stun ? 1.3 : 1; } });
defPassive({ id: 'spawn_amphibian', name: 'Amphibian', owner: 'spawn', text: 'Takes 0.85x magic damage.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.85 : 1; } });
defMove({ id: 'spawn_hop', name: 'Frog Hop', type: 'BEAST', owner: 'spawn', reach: 'single', tags: ['dash'], cd: 0, extra: true, fx: 'hop | puff',
  text: 'Hits for 30% of its ATK or MGK, whichever is higher.',
  run(c) { const st = stat(c.b, c.u, 'atk') >= stat(c.b, c.u, 'mgk') ? { atk: 0.3 } : { mgk: 0.3 }; c.hit(c.tgt, st); } });
defMove({ id: 'spawn_croak', name: 'Croak', type: 'BEAST', owner: 'spawn', reach: 'self', cd: 0, extra: true, fx: 'swell | ring self',
  text: 'Croaks. Nothing happens.',
  run(c) { c.msg(`${label(c.b, c.u)} croaks.`); } });
defMove({ id: 'spawn_flick', name: 'Belly Croak', type: 'TIDE', owner: 'spawn', reach: 'spread', tags: ['dash', 'spell'], cd: 1, fx: 'swell | splash ring',
  text: 'Hits for 85% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 0.85 }); } });
defMove({ id: 'spawn_hex', name: 'Make a Frog', type: 'BEAST', owner: 'spawn', reach: 'single', tags: ['spell'], cd: 5, fx: 'flare | rune*2 converge | sigil puff',
  text: 'The foe is a frog for 2 turns: its moves become Frog Hop and Croak.',
  run(c) {
    if (c.blocked(c.tgt) || c.tgt.s.unstop) return;
    if (!c.tgt.form) setForm(c.b, c.tgt, { tag: 'frog', sprite: FROG });
    c.tgt.moves.forEach((_, i) => swapMoveFor(c.b, c.tgt, i, i % 2 ? 'spawn_croak' : 'spawn_hop', 2));
    mark(c.b, c.u, c.tgt, 'spawn_frog', 1, 2);
    c.msg(`${label(c.b, c.tgt)} is a frog.`);
  } });
defMove({ id: 'spawn_tongue', name: 'Sticky Tongue', type: 'BEAST', owner: 'spawn', reach: 'single', tags: ['spell', 'channel'], cd: 3, fx: 'shake | kelp line fast | bite',
  text: 'Hits for 49% MGK. Stun 1. At its next turn: 39% MGK, 2x on a frog.',
  run(c) { c.hit(c.tgt, { mgk: 0.49 }); c.st(c.tgt, 'stun', 1); c.mark(c.u, 'spawn_shackle', 1, 2); startChannel(c.b, c.u, [{ on: c.u, id: 'spawn_shackle' }]); } });
defMove({ id: 'spawn_frogspawn', name: 'Frogspawn', type: 'BEAST', owner: 'spawn', reach: 'side', cd: 6, nerve: 5, fx: 'sink | bubble*4 rise | fizz claw jolt big',
  text: 'Summons 2 Tadpoles (10% max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'spawn_ward', { hp: 0.1, turns: 6 }); summon(c.b, c.u, 'spawn_ward', { hp: 0.1, turns: 6 }); } });

// lune: a piece of the moon's shell whose thrown edges come back, whose light waxes in reserve, and whose crest rains shards.
defMark({ id: 'lune_edge', name: 'edge coming back', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { unmark(f, 'lune_edge'); const t = foe(b, f); if (!t) return; msg(b, 'The edge comes back.'); strike(b, f, t, stat(b, f, 'mgk') * 0.75, 'M', 'TIDE'); } });
defPassive({ id: 'lune_rebound', name: 'Boomerang Edge', owner: 'lune', text: 'Its one-foe moves bounce on to 1 foe reserve for 35% of the damage.',
  afterDeal(b, f, t, dealt, d) {
    if (!d.move || d.reserve || d.spread || d.dot || t.side === f.side || f.k.bounceAt === b.turnNo) return;
    const r = reserves(b.s[t.side])[0];
    if (!r) return;
    f.k.bounceAt = b.turnNo;
    dealDamage(b, f, r, dealt * 0.35, { kind: 'T', move: null, attack: false, dot: false, spread: true, reserve: true }, null);
  } });
defPassive({ id: 'lune_waxing', name: 'Moonward', owner: 'lune', text: 'In reserve: your out whorl\'s spells deal 1.15x.',
  auraOut(b, f, o, t, d) { return d.move?.tags?.includes('spell') ? 1.15 : 1; } });
defMove({ id: 'lune_facet', name: 'Pale Beam', type: 'STAR', owner: 'lune', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | beam | flash',
  text: 'Hits for 100% MGK. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { mgk: 1.0 }); c.delay(c.tgt, 20); } });
defMove({ id: 'lune_beam', name: 'Edges Out', type: 'TIDE', owner: 'lune', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'spin | moon return | slash',
  text: 'Hits for 75% MGK. Haste 1. The edge comes back at its next turn: 75% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.u, 'haste', 1); c.mark(c.u, 'lune_edge', 1, 2); } });
defMove({ id: 'lune_glaive', name: 'Full Light', type: 'STAR', owner: 'lune', reach: 'team', cd: 4, fx: 'lift | moon*3 orbit | sparkle ally',
  text: 'Empower 1 on your team. Heals itself 12% of its max HP.',
  run(c) { for (const a of standing(c.me)) c.st(a, 'empower', 1); c.heal(c.u, c.u.maxHp * 0.12); } });
defMove({ id: 'lune_totality', name: 'Shard Rain', type: 'STAR', owner: 'lune', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, splash: 0.25, nerve: 5, fx: 'lift | moon*4 rain | shatter sparkle big tint',
  text: 'Hits 4 times for 40% MGK. Splash 25%.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.spread({ mgk: 0.4 }); } });

// siderite: a lodestone off the fallen star that pulls the foe's iron moves onto itself from the bench and drags foes where it likes.
defPassive({ id: 'siderite_remanence', name: 'Lodestone', owner: 'siderite', text: 'Even in reserve: a foe\'s one-target GEAR move aimed at your side hits it instead.',
  redirect(b, f, user, m) { return m.type === 'GEAR' || moveType(user, m) === 'GEAR'; } });
defPassive({ id: 'siderite_dense', name: 'Too Heavy', owner: 'siderite', text: 'Cannot be forced out or dragged in. Ignores delays.',
  immovable() { return true; }, noDelay() { return true; } });
defMove({ id: 'siderite_knock', name: 'Iron Wave', type: 'STONE', owner: 'siderite', reach: 'spread', cd: 1, fx: 'stomp | quake',
  text: 'Hits for 70% ATK. Splash 35%. Slow 1.',
  run(c) { c.spread({ atk: 0.7 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'siderite_skewer', name: 'Pull Iron', type: 'STONE', owner: 'siderite', reach: 'dragin', cd: 3, fx: 'recoil | shard return | bite',
  text: 'Drags in a reserve and hits it for 90% ATK, 1.4x if it has a GEAR move. Slow 2.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 0.9 }, { mult: t.moves.some(id => MOVES[id]?.type === 'GEAR') ? 1.4 : 1 }); c.st(t, 'slow', 2); } });
defMove({ id: 'siderite_magnetize', name: 'Iron Grip', type: 'GEAR', owner: 'siderite', reach: 'single', tags: ['projectile'], cd: 3, fx: 'shake | cog line | burst',
  text: 'Hits for 90% ATK. Root 1. Empower 1.',
  run(c) { c.hit(c.tgt, { atk: 0.9 }); c.st(c.tgt, 'root', 1); c.st(c.u, 'empower', 1); } });
defMove({ id: 'siderite_poleswap', name: 'Turn Poles', type: 'STONE', owner: 'siderite', reach: 'spread', cd: 7, nerve: 6, fx: 'spin | quake crack big glare jolt',
  text: 'Hits for 105% ATK, +10% per foe reserve. Splash 35%. Stun 1.',
  run(c) { c.spread({ atk: 1.05 }, { mult: 1 + 0.1 * reserves(c.them).length }); c.st(c.tgt, 'stun', 1); } });

// slag: furnace slag that eats DEF, runs acid, brews and throws, and melts down.
const SLAG_RAGE: SpriteData = { px: ['3.3..3.3', '.242242.', '44344344', '22422422', '.211112.', '24222242', '2.2222.2', '22....22'], c: ['#e77405', '#f2f2ee', '#59392f'] };
defMark({ id: 'slag_acid', name: 'in acid', clock: 'own', negative: true, volatile: true, value: -0.06,
  statBonus(f, k) { return k === 'def' ? -8 : 0; },
  turnStart(b, f) { const mk = f.m.slag_acid; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'atk') * 0.2, 'P', 'GEAR'); } });
defMark({ id: 'slag_rage', name: 'melting', clock: 'own', value: 0.2,
  turnStart(b, f) { heal(b, f, f, f.maxHp * 0.06); },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'slag_rage'); clearForm(b, f); } });
defPassive({ id: 'slag_unstable', name: 'Going Off', owner: 'slag', text: 'While brewing: +1 Brew a turn. At 5 it goes off on Kuoria: 10% max HP, Stun 1.',
  turnStart(b, f) {
    if (!f.k.brewing) return;
    f.k.brew = (f.k.brew || 0) + 1;
    mark(b, f, f, 'slag_brew', 1, -1);
    if (f.k.brew < 5) return;
    f.k.brewing = 0; f.k.brew = 0; unmark(f, 'slag_brew');
    msg(b, `The brew goes off on ${label(b, f)}.`);
    dealDamage(b, null, f, f.maxHp * 0.1, dot('T'), null);
    stunNow(b, null, f);
  } });
defPassive({ id: 'slag_skim', name: 'Skim Off', owner: 'slag', text: 'When a foe is KO\'d while it is out: 1 tide, and heals 8% of its max HP.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) { addNerve(b, f.side, 1); heal(b, f, f, f.maxHp * 0.08); } } });
defMove({ id: 'slag_dross', name: 'Dross Hit', type: 'STONE', owner: 'slag', reach: 'single', cd: 1, fx: 'stomp | shatter', text: 'Hits for 121% ATK. The foe loses 3 DEF, up to 15.',
  run(c) { c.hit(c.tgt, { atk: 1.21 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.shred = Math.min(15, (c.tgt.k.shred || 0) + 3); } });
defMove({ id: 'slag_spill', name: 'Acid Run', type: 'GEAR', owner: 'slag', reach: 'spread', cd: 3, fx: 'shake | drip smoke', text: 'Hits for 69% ATK. Splash 35%. 3 turns: -8 DEF and 20% ATK a turn.',
  run(c) { c.spread({ atk: 0.69 }); if (!c.tgt.ko) c.mark(c.tgt, 'slag_acid', 1, 3); } });
defMark({ id: 'slag_brew', name: 'brewing', max: 5, value: 0.04, spend: 'slag_pour' });
defMove({ id: 'slag_pour', name: 'Brew Up', type: 'GEAR', owner: 'slag', reach: 'single', tags: ['projectile'], cd: 1, fx: 'shake | ember arc | smoke cinders',
  text: 'Hits for 50% ATK and starts a Brew, or throws it: 40% ATK per Brew, Stun 1 (2 at 3+).',
  run(c) {
    if (!c.u.k.brewing) { c.hit(c.tgt, { atk: 0.5 }); c.u.k.brewing = 1; c.u.k.brew = 1; mark(c.b, c.u, c.u, 'slag_brew', 1, -1); c.msg(`${label(c.b, c.u)} starts a brew.`); return; }
    const n = c.u.k.brew || 0;
    c.u.k.brewing = 0; c.u.k.brew = 0; unmark(c.u, 'slag_brew');
    c.hit(c.tgt, { atk: 0.4 * n });
    if (n >= 1) c.st(c.tgt, 'stun', n >= 3 ? 2 : 1);
  } });
defMove({ id: 'slag_remelt', name: 'Melt Down', type: 'GEAR', owner: 'slag', reach: 'self', cd: 6, nerve: 4, wt: 60, fx: 'swell | ember*4 orbit | cinders smoke big tint', text: '3 turns: 1.2x ATK, Haste 3, heals 6% max HP a turn. Cleanses itself.',
  run(c) { c.cleanse(c.u); c.st(c.u, 'haste', 3); setForm(c.b, c.u, { tag: 'rage', sprite: SLAG_RAGE, statMul: { atk: 1.2 } }); c.mark(c.u, 'slag_rage', 1, 3); } });

// ================================================================ glass desert

// cullet: broken glass that blunts the first move on it, sends out glass mites, rings, shows Visions that pass on, and grips.
defSummon({ id: 'cullet_mite', name: 'Glass Mite', owner: 'cullet', sprite: { px: ['........', '........', '........', '.11222..', '..22.2..', '.12.22..', '..22221.', '..1.1.1.'], c: ['#b86bf1', '#9caaa6', '#9caaa6'] }, text: 'Hits the out foe for 40% of Vilasi\'s MGK each turn, 1.5x on a foe with Visions.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.4 * (marked(t, 'cullet_vision') ? 1.5 : 1), 'M', 'STONE'); } });
defMark({ id: 'cullet_vision', name: 'visions', clock: 'own', negative: true, value: -0.12,
  turnStart(b, f) { const mk = f.m.cullet_vision; const by = mk ? markedBy(b, mk) : null; if (by) dealDamage(b, by.ko ? null : by, f, f.maxHp * 0.05, dot('M'), null); } });
defMark({ id: 'cullet_grasp', name: 'gripping', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; const d = strike(b, f, t, stat(b, f, 'mgk') * 0.45, 'M', 'STONE'); heal(b, f, f, d * 0.3); } });
defPassive({ id: 'cullet_glazed', name: 'Fresh Edge', owner: 'cullet', text: 'When it comes out: the first move to hit it deals 0.5x.',
  comeOut(b, f) { f.k.glazed = 1; },
  beforeTake(b, f, src, amt, d) { if (!d.move || !f.k.glazed || !src || src.side === f.side) return amt; f.k.glazed = 0; return amt * 0.5; } });
defPassive({ id: 'cullet_sharp', name: 'Broken Sharp', owner: 'cullet', text: 'Deals 1.15x to foes with Visions. A foe KO\'d with Visions passes them on.',
  outMul(b, f, t) { return marked(t, 'cullet_vision') ? 1.15 : 1; },
  anyKO(b, f, v) { const mk = v.m.cullet_vision; if (v.side !== f.side && mk && markedBy(b, mk) === f) f.k.passVision = 1; },
  anyOut(b, f, who) { if (who.side !== f.side && f.k.passVision) { f.k.passVision = 0; mark(b, f, who, 'cullet_vision', 1, 3); } } });
defMove({ id: 'cullet_sliver', name: 'Glass Mites', type: 'STONE', owner: 'cullet', reach: 'single', tags: ['spell'], cd: 2, fx: 'shake | shard*2 line | sparkle', text: 'Hits for 63% MGK. Summons a Glass Mite (3 turns) that cuts the foe, up to 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.63 }); const ms = summonsOf(c.b, c.u.side, 'cullet_mite'); if (ms.length >= 2) dismiss(c.b, ms[0]); summon(c.b, c.u, 'cullet_mite', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'cullet_ring', name: 'Ringing Glass', type: 'STAR', owner: 'cullet', reach: 'single', tags: ['spell'], cd: 3, fx: 'flare | bell line | ring flash', text: 'Hits for 118% MGK. Silence 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.18 }); c.st(c.tgt, 'silence', 1); } });
defMove({ id: 'cullet_mirage', name: 'Glass Visions', type: 'STONE', owner: 'cullet', reach: 'single', tags: ['spell'], cd: 2, fx: 'sway | shard*3 converge | sparkle daze', text: 'Hits for 61% MGK. Visions 3: loses 5% max HP a turn.',
  run(c) { c.hit(c.tgt, { mgk: 0.61 }); if (!c.tgt.ko) c.mark(c.tgt, 'cullet_vision', 1, 3); } });
defMove({ id: 'cullet_grip', name: 'Shard Grip', type: 'STONE', owner: 'cullet', reach: 'single', tags: ['spell', 'channel'], cd: 6, nerve: 5, fx: 'flare | shard*4 converge | shatter claw big', text: 'Stun 1. Hits for 72% MGK now, 45% MGK next turn. Heals 30% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.72 }); c.heal(c.u, d * 0.3); c.st(c.tgt, 'stun', 1); c.mark(c.u, 'cullet_grasp', 1, 2); } });

// telson: a scorpion's tail whose venom turns a foe's own healing into harm, and which poisons whatever touches it.
defMark({ id: 'telson_venom', name: 'envenomed', clock: 'own', negative: true, volatile: true, value: -0.15,
  healIn() { return -1; } });
defPassive({ id: 'telson_venomtail', name: 'Walks on Sting', owner: 'telson', text: 'Its attacks add Poison 1 and Slow 1.',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) { applyStatus(b, f, t, 'poison', 1); applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'telson_shell', name: 'Venom Skin', owner: 'telson', text: 'Takes 0.9x magic damage. Foes that attack it get Poison 1.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.9 : 1; },
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src.side !== f.side && !src.ko) applyStatus(b, f, src, 'poison', 1); } });
defMove({ id: 'telson_barb', name: 'Sting Tip', type: 'BEAST', owner: 'telson', reach: 'single', cd: 1, fx: 'lunge | bite drip',
  text: 'Hits for 105% ATK. Poison 2.',
  run(c) { c.hit(c.tgt, { atk: 1.05 }); c.st(c.tgt, 'poison', 2); } });
defMove({ id: 'telson_seep', name: 'Venom Pool', type: 'BEAST', owner: 'telson', reach: 'spread', cd: 3, fx: 'sink | drip smoke',
  text: 'Hits for 45% ATK. Splash 35%. Envenomed 3 on each: heals burn them. Silence 1 under 50% HP.',
  run(c) { c.spread({ atk: 0.45 }); for (const e of standing(c.them)) c.mark(e, 'telson_venom', 1, 3); if (under(c.tgt, 0.5)) c.st(c.tgt, 'silence', 1); } });
defMove({ id: 'telson_pincer', name: 'Venom Jet', type: 'TIDE', owner: 'telson', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | drop line fast | splash drip',
  text: 'Hits for 80% ATK. Root 1. Doubles the foe\'s Poison.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'root', 1); const n = c.tgt.s.poison?.n || 0; if (n && !c.tgt.ko) c.st(c.tgt, 'poison', n); } });
defMove({ id: 'telson_cripple', name: 'Deep Sting', type: 'BEAST', owner: 'telson', reach: 'single', cd: 6, nerve: 4, fx: 'lunge | bite drip smoke big dark',
  text: 'Hits for 130% ATK. Poison 4. Slow 3. Weaken 2. Envenomed for 4 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.3 }); c.st(c.tgt, 'poison', 4); c.st(c.tgt, 'slow', 3); c.st(c.tgt, 'weaken', 2); if (!c.tgt.ko) c.mark(c.tgt, 'telson_venom', 1, 4); } });

// cholla: a jumping cactus whose joints cling to whatever passes, jump into each foe that comes out, and root as sprouts where they fall.
defSummon({ id: 'cholla_sprout', name: 'Joint Sprout', owner: 'cholla', sprite: { px: ['........', '...3....', '..323...', '...2....', '.322223.', '32122123', '.222222.', '4.4..4.4'], c: ['#8bb05a', '#f0e8b0', '#5a4a3a'] }, text: 'Each turn: pricks the out foe for 25% of Spitoge\'s ATK. 3 turns.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'atk') * 0.25, 'P', 'ROOT'); } });
function chollaSprout(b: Battle, by: Fighter): void {
  const ss = summonsOf(b, by.side, 'cholla_sprout');
  if (ss.length >= 2) dismiss(b, ss[0]);
  summon(b, by, 'cholla_sprout', { hp: 0.08, turns: 3 });
}
defMark({ id: 'cholla_tremor', name: 'joints in', max: 3, clock: 'own', negative: true, volatile: true, value: -0.08,
  text: 'A whorl that leaves with Joints in it drops them, and they root as a Joint Sprout.',
  leave(b, f) {
    const mk = f.m.cholla_tremor, by = mk ? markedBy(b, mk) : null;
    unmark(f, 'cholla_tremor');
    if (by && !by.ko && !by.gone) { msg(b, `The joints in ${label(b, f)} fall and take root.`); chollaSprout(b, by); }
  } });
function chollaTremor(b: Battle, f: Fighter, t: Fighter): void {
  if (t.ko || t.gone || t.side === f.side) return;
  mark(b, f, t, 'cholla_tremor', 1, 3);
  if (marked(t, 'cholla_tremor') < 3) return;
  unmark(t, 'cholla_tremor');
  msg(b, `The joints in ${label(b, t)} go deep.`);
  strike(b, f, t, t.maxHp * 0.08, 'T', null);
}
defPassive({ id: 'cholla_deepspines', name: 'Deep Spines', owner: 'cholla', text: 'Its hits add a Joint, up to 3. At 3: true damage of 8% of the foe\'s max HP.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && !f.k.cracking) { f.k.cracking = 1; chollaTremor(b, f, t); f.k.cracking = 0; } } });
defPassive({ id: 'cholla_storedwater', name: 'Catch a Ride', owner: 'cholla', text: 'Takes 0.85x while shielded. While it is out: a Joint jumps into each foe that comes out.',
  anyOut(b, f, who) { if (who.side !== f.side && !f.ko && isOut(b, f)) chollaTremor(b, f, who); },
  inMul(b, f) { return f.shield > 0 ? 0.85 : 1; } });
defMove({ id: 'cholla_jump', name: 'Jump On', type: 'ROOT', owner: 'cholla', reach: 'single', tags: ['dash'], cd: 1, fx: 'hop | thorn line fast | bite',
  text: 'Hits for 100% ATK, 1.5x if the foe switches this round. Delays it 15%.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }, { mult: foeChoice(c.b, c.u)?.k === 'switch' ? 1.5 : 1 }); c.delay(c.tgt, 15); } });
defMove({ id: 'cholla_jointdrop', name: 'Joint Drop', type: 'ROOT', owner: 'cholla', reach: 'spread', cd: 3, fx: 'shake | thorn*4 rain | puff',
  text: 'Hits for 38% ATK. Splash 35%. Slow 1. A Joint in every foe. Shield 11% max HP.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.11, 3); c.spread({ atk: 0.38 }); c.st(c.tgt, 'slow', 1); for (const e of standing(c.them)) if (e !== c.tgt) chollaTremor(c.b, c.u, e); } });
defMove({ id: 'cholla_spinebed', name: 'Burst Pad', type: 'TIDE', owner: 'cholla', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | drop arc | splash',
  text: 'Hits for 90% ATK, 1.5x at 2+ Joints. Stun 1 if it can\'t switch, else Slow 2.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 0.9 }, { mult: marked(c.tgt, 'cholla_tremor') >= 2 ? 1.5 : 1 }); c.st(c.tgt, pinned ? 'stun' : 'slow', pinned ? 1 : 2); } });
defMove({ id: 'cholla_grab', name: 'Cholla Grab', type: 'ROOT', owner: 'cholla', reach: 'single', tags: ['dash'], cd: 6, nerve: 5, fx: 'lunge | thorn*4 converge | claw big jolt',
  text: 'Hits for 110% ATK. Stun 1. Root 3. Every Joint in it goes deep: 8% max HP each.',
  run(c) {
    c.hit(c.tgt, { atk: 1.1 });
    c.st(c.tgt, 'stun', 1);
    c.st(c.tgt, 'root', 3);
    const n = c.tgt.ko ? 0 : marked(c.tgt, 'cholla_tremor');
    if (!n) return;
    unmark(c.tgt, 'cholla_tremor');
    c.msg(`The joints in ${label(c.b, c.tgt)} go deep.`);
    strike(c.b, c.u, c.tgt, c.tgt.maxHp * 0.08 * n, 'T', null);
  } });

// erg: a coral dune that comes up the road at night, buds sand Polyps that rush and soak blows, and buries the foe's next whorl at the door.
defSummon({ id: 'erg_soldier', name: 'Sand Polyp', owner: 'erg', text: 'Strikes with Sunaka\'s attacks and its Polyp Rush. 4 turns.', every: 100,
  sprite: { px: ['........', '........', '...3.3..', '...3.3..', '...3.3..', '...333..', '...33...', '..2222..'], c: ['#efe7d7', '#a90a0e', '#cbbba3'] },
  act() { /* soldiers only strike when commanded */ } });
defSummon({ id: 'erg_wall', name: 'Reef Wall', owner: 'erg', sprite: { px: ['........', '........', '........', '.3.33.3.', '22222222', '2.24.2.2', '24222242', '........'], c: ['#efe7d7', '#d7a02b', '#b9575f'] }, text: 'Takes single-target hits meant for your out whorl until it falls. 20% of Sunaka\'s max HP.', guard: true });
const soldiers = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'erg_soldier').length;
defMark({ id: 'erg_buried', name: 'buried', clock: 'side', negative: true, value: -0.12, color: '#c9a66b',
  text: 'Cannot come out. It comes out only if nobody else can.',
  barred() { return true; },
  comeOut(b, f) { unmark(f, 'erg_buried'); } });
defPassive({ id: 'erg_grain', name: 'Budding', owner: 'erg', text: 'When it attacks: each Polyp also hits for 30% MGK.',
  afterAttack(b, f, t) { const n = soldiers(b, f); if (n && !t.ko && !t.gone) strike(b, f, t, stat(b, f, 'mgk') * 0.3 * n, 'M', 'STONE'); } });
defPassive({ id: 'erg_sandsea', name: 'Colony', owner: 'erg', text: 'Takes 6% less damage per Polyp.',
  inMul(b, f) { return 1 - 0.06 * soldiers(b, f); } });
defMove({ id: 'erg_sandblast', name: 'Polyp Rush', type: 'STONE', owner: 'erg', reach: 'spread', tags: ['dash', 'spell'], cd: 1, fx: 'lunge | sand*3 sweep | burst',
  text: 'Its Polyps rush the foe: 94% MGK, +35% per Polyp. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.94 }, { mult: 1 + 0.35 * soldiers(c.b, c.u) }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'erg_saltation', name: 'Bud Polyp', type: 'SALT', owner: 'erg', reach: 'single', tags: ['spell'], cd: 2, fx: 'swell | salt line | sparkle',
  text: 'Hits for 93% MGK. Buds a Polyp (10% max HP, 4 turns), up to 3.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.93 });
    if (soldiers(c.b, c.u) >= 3) { const s = summonsOf(c.b, c.u.side, 'erg_soldier')[0]; if (s) dismiss(c.b, s); }
    summon(c.b, c.u, 'erg_soldier', { hp: 0.1, turns: 4 });
  } });
defMove({ id: 'erg_slipface', name: 'Sand Over', type: 'STONE', owner: 'erg', reach: 'bench', tags: ['spell'], cd: 5, fx: 'sink | sand*5 rain | quake',
  text: 'Hits for 86% MGK. Buries a foe reserve 3 turns: it can\'t come out. Shield 6% max HP per Polyp.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.86 });
    if (soldiers(c.b, c.u)) c.shield(c.u, c.u.maxHp * 0.06 * soldiers(c.b, c.u), 3);
    const r = c.them.f[c.pick];
    if (!r || r.ko || r.gone || isOut(c.b, r)) return;
    c.mark(r, 'erg_buried', 1, 3);
    c.msg(`${label(c.b, r)} is buried.`);
  } });
defMove({ id: 'erg_dunewall', name: 'Reef Rises', type: 'STONE', owner: 'erg', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift | sand*6 rise | quake pillar big tint jolt', text: 'Hits for 149% MGK. Splash 35%. Forces the foe out. Raises a Reef Wall.',
  run(c) { c.spread({ mgk: 1.49 }); if (!c.tgt.ko) c.forceOut(); summon(c.b, c.u, 'erg_wall', { hp: 0.2 }); } });

// haze: the wobble over hot glass, which holds glare, waver, and dew in its mouth and mixes the last three it held.
const EL = ['', 'haze_glare', 'haze_waver', 'haze_dew'];
for (const [i, n] of [[1, 'glare'], [2, 'waver'], [3, 'dew']] as const) defMark({ id: EL[i], name: n, max: 3, value: 0.02 });
const elems = (f: Fighter): number[] => [f.k.el1 || 0, f.k.el2 || 0, f.k.el3 || 0];
const elemCount = (f: Fighter, e: number): number => elems(f).filter(x => x === e).length;
function addElem(b: Battle, f: Fighter, e: number): void {
  f.k.el3 = f.k.el2 || 0;
  f.k.el2 = f.k.el1 || 0;
  f.k.el1 = e;
  for (let x = 1; x <= 3; x++) { unmark(f, EL[x]); const n = elemCount(f, x); if (n) mark(b, f, f, EL[x], n, -1); }
}
defPassive({ id: 'haze_mirror', name: 'Three Weathers', owner: 'haze', text: 'It holds its last 3 weathers. Moves deal +10% per kind held.',
  outMul(b, f, t, d) { return d.move ? 1 + 0.1 * [1, 2, 3].filter(e => elemCount(f, e) > 0).length : 1; } });
defPassive({ id: 'haze_veil', name: 'Wavering', owner: 'haze', text: 'Takes 8% less move damage per Waver held. Mix: Slow 2 at 1 Waver, Stun 1 at 2, Stun 2 at 3.',
  inMul(b, f, src, d) { return d.move ? 1 - 0.08 * elemCount(f, 2) : 1; } });
defMove({ id: 'haze_glare', name: 'Hard Glare', type: 'STAR', owner: 'haze', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | beam | flash glare', text: 'Hits for 151% MGK. Holds a Glare.',
  run(c) { c.hit(c.tgt, { mgk: 1.51 }); addElem(c.b, c.u, 1); } });
defMove({ id: 'haze_waver', name: 'Heat Wobble', type: 'STAR', owner: 'haze', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | spark*3 wave | daze', text: 'Hits for 112% MGK. Delays the foe\'s next turn by 15%. Holds a Waver.',
  run(c) { c.hit(c.tgt, { mgk: 1.12 }); c.delay(c.tgt, 15); addElem(c.b, c.u, 2); } });
defMove({ id: 'haze_dew', name: 'Night Dew', type: 'TIDE', owner: 'haze', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | drop*3 rain | splash',
  text: 'Hits for 61% MGK. Heals 8% of its max HP. Fortify 1. Holds a Dew.',
  run(c) { c.hit(c.tgt, { mgk: 0.61 }); c.heal(c.u, c.u.maxHp * 0.08); c.st(c.u, 'fortify', 1); addElem(c.b, c.u, 3); } });
defMove({ id: 'haze_thermal', name: 'Weather Mix', type: 'STAR', owner: 'haze', reach: 'spread', tags: ['spell'], cd: 5, nerve: 4, fx: 'swell | orb*3 spiral | flash sparkle big tint',
  text: 'Hits for 71% MGK +45% per Glare. Splash 35%. Your team heals 6% per Dew.',
  run(c) {
    const g = elemCount(c.u, 1), w = elemCount(c.u, 2), d = elemCount(c.u, 3);
    c.spread({ mgk: 0.71 + 0.45 * g });
    if (w && !c.tgt.ko) c.st(c.tgt, w === 1 ? 'slow' : 'stun', w === 1 ? 2 : w - 1);
    if (d) for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.06 * d);
  } });

// bonedry: a bleached skull that gets up once more, dries a foe out, holds a grudge for its fallen friends, and raises their bones.
defMark({ id: 'bonedry_spare', name: 'unburied', max: 1, value: 0.6 });
defMark({ id: 'bonedry_crit', name: 'cracked open', clock: 'own', volatile: true, value: 0.08,
  outMul(b, f, t, d) { return d.attack ? 1.9 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.attack) { heal(b, f, f, dealt * 0.3); unmark(f, 'bonedry_crit'); } } });
defMark({ id: 'bonedry_dry', name: 'dried out', clock: 'own', negative: true, volatile: true, value: -0.05,
  healIn() { return 0.5; } });
defMark({ id: 'bonedry_hated', name: 'grudged', negative: true, value: -0.08 });
defSummon({ id: 'bonedry_skeleton', name: 'Small Bones', owner: 'bonedry', text: 'Each turn: claws the foe for 22% of Calkuro\'s ATK.', every: 100,
  sprite: { px: ['........', '........', '..2.2...', '.22222..', '.23232..', '.22222..', '..2.2...', '.44.44..'], c: ['#efebe3', '#39e163', '#a0895b'] },
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'atk') * 0.22, 'P', 'BEAST'); } });
defPassive({ id: 'bonedry_unburied', name: 'Unburied', owner: 'bonedry', text: 'Once a battle, instead of a KO: up at 5% HP, cleansed. Foe: Stun 1, its moves wait 1 turn.',
  start(b, f) { mark(b, f, f, 'bonedry_spare', 1, -1); },
  wouldKO(b, f) {
    if (!marked(f, 'bonedry_spare')) return false;
    unmark(f, 'bonedry_spare');
    f.hp = Math.round(f.maxHp * 0.05);
    cleanse(b, f);
    msg(b, `${label(b, f)} gets back up.`);
    const t = foe(b, f);
    if (t) { shiftCd(b, t, 'all', 1); applyStatus(b, f, t, 'stun', 1); }
    return true;
  } });
defPassive({ id: 'bonedry_grudge', name: 'Old Grudge', owner: 'bonedry', text: 'Its attacks heal it 10% of their damage. 1.5x on the foe that last KO\'d one of its allies.',
  anyKO(b, f, v, killer) {
    if (v.side !== f.side || v === f || !killer || killer.side === f.side || killer.ko) return;
    for (const x of b.s[killer.side].f) unmark(x, 'bonedry_hated');
    mark(b, f, killer, 'bonedry_hated', 1, -1);
  },
  outMul(b, f, t) { return marked(t, 'bonedry_hated') ? 1.5 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.1); } });
defMove({ id: 'bonedry_marrow', name: 'Dry Bite', type: 'BEAST', owner: 'bonedry', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | bite drip',
  text: 'Hits for 85% ATK. Dry 2: the foe\'s heals do half.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); if (!c.tgt.ko) c.mark(c.tgt, 'bonedry_dry', 1, 2); } });
defMove({ id: 'bonedry_stare', name: 'Bleached Stare', type: 'VOID', owner: 'bonedry', reach: 'single', tags: ['projectile'], cd: 4, fx: 'flare | orb line | daze dark',
  text: 'Hits for 70% ATK. Slow 2. Burn 2 (25% ATK a turn). Locks its last move 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.7 }); c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'atk') * 0.25); const k = (c.tgt.k.lastMove || 0) - 1; if (!c.tgt.ko && k >= 0) lockMove(c.b, c.tgt, k, 2); } });
defMove({ id: 'bonedry_crack', name: 'Crack Open', type: 'BEAST', owner: 'bonedry', reach: 'self', cd: 3, wt: 50, fx: 'shake | bone*2 orbit | crack self', text: 'Its next attack deals 1.9x damage and heals 30% of it.',
  run(c) { c.mark(c.u, 'bonedry_crit', 1, 2); } });
defMove({ id: 'bonedry_ossuary', name: 'Ossuary', type: 'BEAST', owner: 'bonedry', reach: 'side', cd: 6, nerve: 5, fx: 'sink | bone*4 rise | crack big tint',
  text: 'Raises a Small Bones for each whorl down on either side, at least 1, up to 3.',
  run(c) { const n = Math.max(1, Math.min(3, c.b.stats.kos[0] + c.b.stats.kos[1])); for (let i = 0; i < n; i++) summon(c.b, c.u, 'bonedry_skeleton', { hp: 0.12, turns: 3 }); } });

// ================================================================ hands orchard

// shears: pruning shears with an eye in the pivot that pick one branch, cut it harder than the rest, strip it, snap back, and duel it.
defMark({ id: 'shears_duel', name: 'in a duel', max: 1, clock: 'own', value: -0.05,
  forbid(b, f, what) { return what === 'switch' || what === 'guard' ? 'In a duel.' : null; } });
defMark({ id: 'shears_branch', name: 'the branch', negative: true, value: -0.1 });
defMark({ id: 'shears_courage', name: 'oiled', clock: 'own', volatile: true, value: 0.1,
  afterTake(b, f, src, dealt, d) { if (d.dot || !src || src.side === f.side || src.ko) return; unmark(f, 'shears_courage'); const x = strike(b, f, src, stat(b, f, 'atk') * 0.7, 'P', 'GEAR'); heal(b, f, f, x * 0.5); } });
const GOOD = ['empower', 'fortify', 'haste', 'ward', 'regen', 'thorns'] as const;
defPassive({ id: 'shears_notched', name: 'Pivot Eye', owner: 'shears', text: 'The first foe it hits is its Branch: 1.3x damage to it, 0.85x to other foes.',
  afterDeal(b, f, t, dealt, d) {
    if (t.side === f.side || t.ko || t.gone || b.s[t.side].f.some(x => marked(x, 'shears_branch'))) return;
    mark(b, f, t, 'shears_branch', 1, -1);
    msg(b, `${label(b, f)} picks ${label(b, t)} as its Branch.`);
  },
  outMul(b, f, t) { return t.side === f.side ? 1 : marked(t, 'shears_branch') ? 1.3 : 0.85; } });
defPassive({ id: 'shears_snapback', name: 'Spring Back', owner: 'shears', text: 'Every 3rd hit it takes: strikes back for 50% ATK, heals 30% of it.',
  afterTake(b, f, src, dealt, d) { if (d.dot || !src || src.side === f.side) return; f.k.snaps = (f.k.snaps || 0) + 1; if (f.k.snaps % 3 === 0 && !src.ko) { const x = strike(b, f, src, stat(b, f, 'atk') * 0.5, 'P', 'GEAR'); heal(b, f, f, x * 0.3); } } });
defMove({ id: 'shears_snip', name: 'Snip Snip', type: 'GEAR', owner: 'shears', reach: 'single', tags: ['dash'], cd: 1, splash: 0.25, fx: 'lunge | shard*2 line fast | slash',
  text: 'Hits twice for 48% ATK. Splash 25%.',
  run(c) { c.spread({ atk: 0.48 }); if (!c.tgt.ko) c.spread({ atk: 0.48 }); } });
defMove({ id: 'shears_lop', name: 'Prune Back', type: 'ROOT', owner: 'shears', reach: 'single', cd: 3, fx: 'shake | leaf*3 converge | slash',
  text: 'Cuts every good status off the foe, then hits for 70% ATK +25% per cut. Haste 1.',
  run(c) {
    let n = 0;
    if (!c.blocked(c.tgt)) for (const id of GOOD) if (c.tgt.s[id]) { delete c.tgt.s[id]; n++; }
    if (n) c.msg(`${label(c.b, c.tgt)} is pruned back.`);
    c.hit(c.tgt, { atk: 0.7 }, { mult: 1 + 0.25 * n });
    c.st(c.u, 'haste', 1);
  } });
defMove({ id: 'shears_oil', name: 'Oil Pivot', type: 'GEAR', owner: 'shears', reach: 'self', cd: 3, wt: 50, fx: 'spin | ring self', text: 'The next hit on it is answered for 70% ATK. Heals 50% of that.',
  run(c) { c.mark(c.u, 'shears_courage', 1, 2); } });
defMove({ id: 'shears_lockblades', name: 'One Branch', type: 'GEAR', owner: 'shears', reach: 'single', cd: 6, nerve: 4, fx: 'spin | shard*2 converge | slash big jolt',
  text: 'The foe is its Branch. Duel 3: neither switches or guards. Empower 2. Hits for 95% ATK.',
  run(c) {
    if (!c.blocked(c.tgt)) {
      for (const x of c.them.f) unmark(x, 'shears_branch');
      c.mark(c.tgt, 'shears_branch', 1, -1);
      c.mark(c.tgt, 'shears_duel', 1, 3); c.mark(c.u, 'shears_duel', 1, 3);
    }
    c.st(c.u, 'empower', 2);
    c.hit(c.tgt, { atk: 0.95 });
  } });

// glove: a gardener's glove that is the hand of its team: a friend on the bench swings off its palm, and the next friend out gets a push.
defMark({ id: 'glove_unleash', name: 'let loose', clock: 'own', volatile: true, value: 0.15,
  afterAttack(b, f) { f.k.pulse = (f.k.pulse || 0) + 1; if (f.k.pulse % 2 === 0) { splash(b, f, stat(b, f, 'atk') * 0.5, 'P', 'BEAST'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'glove_cuffed', name: 'Cuff Off', owner: 'glove', text: 'Its attacks deal 1.3x while Let Loose runs.',
  outMul(b, f, t, d) { return d.attack && marked(f, 'glove_unleash') ? 1.3 : 1; } });
defPassive({ id: 'glove_handspring', name: 'Push Off', owner: 'glove', text: 'When it switches out: the ally that comes in gets Empower 1.',
  leave(b, f) { f.k.pushing = 1; },
  anyOut(b, f, who) { if (!f.k.pushing || who.side !== f.side || who === f) return; f.k.pushing = 0; applyStatus(b, f, who, 'empower', 1); } });
defMove({ id: 'glove_grub', name: 'Weed Pull', type: 'BEAST', owner: 'glove', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | leaf arc | burst', text: 'Hits for 142% ATK. Delays the foe\'s next turn by 25%.',
  run(c) { c.hit(c.tgt, { atk: 1.42 }); c.delay(c.tgt, 25); } });
defMove({ id: 'glove_springoff', name: 'Lend a Hand', type: 'BEAST', owner: 'glove', reach: 'reserveAlly', cd: 3, fx: 'swell | sparkle self',
  text: 'A reserve ally uses its first ready move at 0.9x from the bench. Foe: Slow 2.',
  run(c) {
    c.st(c.tgt, 'slow', 2);
    const al = c.ally;
    if (!al || al.ko || al.gone || isOut(c.b, al)) return;
    const i = al.moves.findIndex((_, k) => benchable(c.b, al, k));
    if (i < 0) { c.msg(`${label(c.b, al)} has nothing ready.`); return; }
    benchMove(c.b, al, i, 0.9);
  } });
defMove({ id: 'glove_helping', name: 'Green Thumb', type: 'ROOT', owner: 'glove', reach: 'single', cd: 3, fx: 'shake | leaf*3 line | bloom',
  text: 'Hits for 95% ATK. Your lowest-HP whorl heals 30% of the damage. Empower 1.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.95 }); const lo = standing(c.me).slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; if (lo && d > 0) c.heal(lo, d * 0.3); c.st(c.u, 'empower', 1); } });
defMove({ id: 'glove_unclench', name: 'Let Loose', type: 'BEAST', owner: 'glove', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'swell | spark*4 orbit | burst big tint',
  text: '3 turns: Haste 3. Every 2nd attack also hits for 50% ATK. Splash 35%. Slow 1.',
  run(c) { c.u.k.pulse = 0; c.st(c.u, 'haste', 3); c.mark(c.u, 'glove_unleash', 1, 3); } });

// scion: a grafted branch that hunts its first KO, takes after the tree it beats as hard old wood or pale and quick, and grows inside a foe.
const SCION_DARK: SpriteData = { px: ['..44.4..', '.444444.', '44444444', '43444434', '44422444', '.442244.', '..2.22..', '.222222.'], c: ['#4c3735', '#f24335', '#9c2435'] };
const SCION_SHADE: SpriteData = { px: ['4..44..4', '44.22.44', '..2222..', '..3.23..', '4.2222.4', '44.22.44', '...22...', '..2..2..'], c: ['#87bbf5', '#a958e6', '#dee6ee'] };
const scionForm = (f: Fighter) => f.form?.tag || '';
defMark({ id: 'scion_inside', name: 'growing inside', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    unmark(f, 'scion_inside');
    const t = foe(b, f);
    if (!t) return;
    msg(b, `${label(b, f)} bursts out.`);
    strike(b, f, t, stat(b, f, 'atk') * 0.9 + t.maxHp * 0.1, 'P', 'ROOT');
  } });
defPassive({ id: 'scion_rootstock', name: 'Rootstock', owner: 'scion', text: 'Its first KO makes it Old Wood after a physical foe, else Pale Graft.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side || f.form) return;
    if (basicOf(v) === 'P') { setForm(b, f, { tag: 'darkin', sprite: SCION_DARK, statMul: { def: 1.2, res: 1.2 } }); msg(b, `${label(b, f)} takes after the old wood.`); }
    else { setForm(b, f, { tag: 'shade', sprite: SCION_SHADE, statMul: { atk: 1.15, agi: 1.15 } }); msg(b, `${label(b, f)} takes after the shade.`); }
  } });
defPassive({ id: 'scion_union', name: 'Graft Union', owner: 'scion', text: 'Unformed: takes 0.8x. Old Wood: 1.2x DEF and RES, moves heal 25%. Pale Graft: 1.15x ATK and AGI.',
  inMul(b, f) { return f.form ? 1 : 0.8; },
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && t.side !== f.side && scionForm(f) === 'darkin') heal(b, f, f, dealt * 0.25); } });
defMove({ id: 'scion_cleft', name: 'Graft Slash', type: 'ROOT', owner: 'scion', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | leaf line fast | slash',
  text: 'Hits for 80% ATK, 1.4x on a foe below half HP. Splash 35%.',
  run(c) { c.spread({ atk: 0.8 }, { mult: c.tgt.hp < c.tgt.maxHp * 0.5 ? 1.4 : 1 }); } });
defMove({ id: 'scion_budding', name: 'Long Shoot', type: 'ROOT', owner: 'scion', reach: 'single', cd: 3, wu: 40, fx: 'recoil | thorn line | bite',
  text: 'Short wind-up. Hits for 110% ATK. Slow 2. Old Wood: Stun 1, Root 2. Pale Graft: 1.3x.',
  run(c) { const f = scionForm(c.u); c.hit(c.tgt, { atk: 1.1 }, { mult: f === 'shade' ? 1.3 : 1 }); c.st(c.tgt, 'slow', 2); if (f === 'darkin') { c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 2); } } });
defMove({ id: 'scion_splice', name: 'Splice In', type: 'TIDE', owner: 'scion', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | drop line fast | splash',
  text: 'Hits for 90% ATK. Haste 1. Heals 8% max HP. Pale Graft: next move deals 1.3x.',
  run(c) { c.hit(c.tgt, { atk: 0.9 }); c.st(c.u, 'haste', 1); c.heal(c.u, c.u.maxHp * 0.08); if (scionForm(c.u) === 'shade') c.u.k.nextMoveMul = 1.3; } });
defMove({ id: 'scion_ingrowth', name: 'Grow Inside', type: 'ROOT', owner: 'scion', reach: 'single', cd: 6, nerve: 4, fx: 'sink | kelp*3 converge | bloom big dark', text: 'Hits for 37% ATK. Untouchable 1. Next turn: 90% ATK + 10% of its max HP.',
  run(c) { c.hit(c.tgt, { atk: 0.37 }); c.st(c.u, 'invuln', 1); c.mark(c.u, 'scion_inside', 1, 2); } });

// espalier: a pear trained flat on the orchard wall that feeds whoever leans on it, drops free pears for anyone, and rides out on a friend.
defDrop({ id: 'espalier_pear', name: 'Pear', text: 'It heals the whorl that eats it 20% of its max HP.',
  sprite: { px: ['........', '....3...', '...3....', '...22...', '..2222..', '.222222.', '.222222.', '..2222..'], c: ['#c8c040', '#6a8a30', '#000000'] },
  take(b, f) { heal(b, null, f, f.maxHp * 0.2); } });
defPassive({ id: 'espalier_trained', name: 'Wall Fed', owner: 'espalier', text: 'In reserve: your out whorl heals 3% of max HP a turn and deals 1.05x.',
  reserveTurn(b, f) { const o = outOf(b, f); if (!o.ko) heal(b, f, o, o.maxHp * 0.03); },
  auraOut() { return 1.05; } });
defPassive({ id: 'espalier_pleached', name: 'Pears Free', owner: 'espalier', text: 'Every 2nd move it uses drops a Pear. Either out whorl may eat it to heal 20%.',
  afterMove(b, f) { f.k.pears = (f.k.pears || 0) + 1; if (f.k.pears % 2 === 0 && (b.drops || []).length < 2) dropItem(b, 'espalier_pear', 3); } });
defMove({ id: 'espalier_spur', name: 'Pear Drop', type: 'ROOT', owner: 'espalier', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'lift | pearl arc | burst', text: 'Hits for 78% MGK. 1.3x on a foe that was already out at its last turn.',
  run(c) { const long = c.tgt.outAt < (c.u.k.prevTurn ?? 0); c.hit(c.tgt, { mgk: 0.78 }, { mult: long ? 1.3 : 1 }); } });
defMove({ id: 'espalier_propup', name: 'Prop Up', type: 'ROOT', owner: 'espalier', reach: 'reserveAlly', cd: 3, tag: true, fx: 'swell | leaf*2 rise | sparkle ally',
  text: 'Switches to an ally. It heals 8% of max HP. Empower 2.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.08); c.st(c.ally!, 'empower', 2); } });
defMove({ id: 'espalier_saprise', name: 'Wall Sap', type: 'TIDE', owner: 'espalier', reach: 'ally', tags: ['spell'], cd: 2, fx: 'sway | drop*2 line | splash',
  text: 'Hits for 70% MGK. Heals an ally 12% of its max HP, with Haste 1 and Fortify 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.heal(c.ally!, c.ally!.maxHp * 0.12); c.st(c.ally!, 'haste', 1); c.st(c.ally!, 'fortify', 1); } });
defMove({ id: 'espalier_lattice', name: 'Full Trellis', type: 'ROOT', owner: 'espalier', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift | leaf*6 sweep | bloom big tint', text: 'Hits for 78% MGK. Splash 35%. Root 2. Your team heals 10% of max HP.',
  run(c) { c.spread({ mgk: 0.78 }); c.st(c.tgt, 'root', 2); for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.1); } });

// rung: a ladder rung that climbs a Step each turn it takes, rings at the top, bars a foe and the one behind it, sets a landing, and holds still.
defSummon({ id: 'rung_shrine', name: 'Landing', owner: 'rung', sprite: { px: ['4......4', '4......4', '42222224', '42222224', '4.3..3.4', '4.3..3.4', '4......4', '4......4'], c: ['#c49d6d', '#efcf5f', '#266875'] }, text: 'At your next turn: heals your out whorl 25% of its max HP. Haste 2. Then it goes.', every: 100,
  act(b, s) { const o = b.s[s.side].f[b.s[s.side].out]; if (o && !o.ko) { heal(b, ownerOf(b, s), o, o.maxHp * 0.25); applyStatus(b, null, o, 'haste', 2); } } });
defPassive({ id: 'rung_stepup', name: 'Step Higher', owner: 'rung', text: 'Turn start: +1 Step, up to 6. Its attacks add 8% MGK per Step.',
  turnStart(b, f) { f.k.chimes = Math.min(6, (f.k.chimes || 0) + 1); },
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'mgk') * 0.08 * (f.k.chimes || 0) : 0; } });
defPassive({ id: 'rung_footing', name: 'Sure Footing', owner: 'rung', text: 'Its switches take 30% of a turn.',
  quickWeight(f, act) { return act === 'switch' ? 30 : null; } });
defMove({ id: 'rung_rap', name: 'Rung Rap', type: 'ROOT', owner: 'rung', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | bell line | ring',
  text: 'Hits for 110% MGK, +5% per Step. Slow 1. At 6 Steps it rings: Silence 1.',
  run(c) { const n = c.u.k.chimes || 0; c.hit(c.tgt, { mgk: 1.1 }, { mult: 1 + 0.05 * n }); c.st(c.tgt, 'slow', 1); if (n >= 6 && !c.tgt.ko) { c.msg(`${label(c.b, c.u)} rings.`); c.st(c.tgt, 'silence', 1); } } });
defMove({ id: 'rung_crossbar', name: 'Crossbar', type: 'GEAR', owner: 'rung', reach: 'single', tags: ['spell'], cd: 3, fx: 'shake | cog*2 line | crack',
  text: 'Hits the foe and its first reserve for 72% MGK each. Stun 1, or Slow 2 if no reserve.',
  run(c) { c.hit(c.tgt, { mgk: 0.72 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.72 }, { reserve: true }); if (!c.tgt.ko) c.st(c.tgt, r ? 'stun' : 'slow', r ? 1 : 2); } });
defMove({ id: 'rung_reststep', name: 'Landing Rest', type: 'ROOT', owner: 'rung', reach: 'side', cd: 3, fx: 'lift | shell rise | sparkle self', text: 'Sets a Landing (8% max HP).',
  run(c) { summon(c.b, c.u, 'rung_shrine', { hp: 0.08, turns: 1 }); } });
defMove({ id: 'rung_standstill', name: 'Top Rung', type: 'ROOT', owner: 'rung', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, fx: 'lift | bell*3 rain | ring flash big glare',
  text: 'Hits for 100% MGK, +15% per Step, and drops to 0 Steps. Heals 10% of max HP.',
  run(c) { const n = c.u.k.chimes || 0; c.hit(c.tgt, { mgk: 1.0 }, { mult: 1 + 0.15 * n }); c.u.k.chimes = 0; c.heal(c.u, c.u.maxHp * 0.1); } });

// ================================================================ the margin

// nought: a blank where nothing was, which spreads every hit thin, rubs out what makes a foe itself, stamps the blanked, and is nothing there.
defMark({ id: 'nought_blank', name: 'rubbed out', text: 'Its passives do nothing.', clock: 'own', volatile: true, negative: true, value: -0.2, mutes: true });
defPassive({ id: 'nought_spread', name: 'Spread Thin', owner: 'nought', text: 'When hit: every foe takes 10% of it as true damage.',
  afterTake(b, f, src, dealt, d) {
    if (d.dot || !src || src.side === f.side) return;
    for (const e of standing(b.s[1 - f.side])) dealDamage(b, f, e, dealt * 0.1, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: !isOut(b, e) }, null);
  } });
defPassive({ id: 'nought_emptied', name: 'Emptied', owner: 'nought', text: 'Deals 1.2x damage to a foe with 1 reserve or none.',
  outMul(b, f, t) { return reserves(b.s[t.side]).length <= 1 ? 1.2 : 1; } });
defMove({ id: 'nought_edge', name: 'Blank Edge', type: 'STAR', owner: 'nought', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | card line fast | slash',
  text: 'Hits for 95% MGK. Slow 1. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.95 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 15); } });
defMove({ id: 'nought_erase', name: 'Rub Out', type: 'STAR', owner: 'nought', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | hoop converge | puff daze',
  text: 'Hits for 75% MGK. The foe\'s passives are rubbed out for 2 turns.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); if (!c.tgt.ko && !c.blocked(c.tgt)) { c.mark(c.tgt, 'nought_blank', 1, 2); c.msg(`${label(c.b, c.tgt)}'s passives are rubbed out.`); } } });
defMove({ id: 'nought_path', name: 'Blank Stamp', type: 'GEAR', owner: 'nought', reach: 'single', cd: 3, fx: 'stomp | cog line | crack',
  text: 'Hits for 80% MGK, 1.5x if the foe\'s passives are rubbed out. Haste 1. Fortify 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }, { mult: muted(c.tgt) ? 1.5 : 1 }); c.st(c.u, 'haste', 1); c.st(c.u, 'fortify', 1); } });
defMove({ id: 'nought_haunting', name: 'Nothing There', type: 'STAR', owner: 'nought', reach: 'spread', tags: ['spell'], cd: 6, splash: 1, nerve: 5, fx: 'blink | orb*6 rain | puff big dark', text: 'Hits for 64% MGK. Splash 100%.',
  run(c) { c.spread({ mgk: 0.64 }); } });

// terminus: the end of a road that keeps whatever reaches it, charges at its barrier, takes a toll in tide, and ends what is nearly done.
defMark({ id: 'terminus_purge', name: 'posts firing', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { for (let i = 0; i < 2 && !t.ko && !t.gone; i++) strike(b, f, t, stat(b, f, 'atk') * 0.48, 'P', 'STONE'); } });
defMark({ id: 'terminus_dread', name: '', value: 0,
  anyOut(b, f, who) { if (who.side === f.side) return; unmark(f, 'terminus_dread'); msg(b, `${label(b, who)} saw what happened.`); forceAction(b, who, 'skip'); } });
defPassive({ id: 'terminus_endline', name: 'Last Post', owner: 'terminus', text: 'Every 3rd attack: adds 15% of the foe\'s max HP.',
  afterAttack(b, f, t) { f.k.legs = (f.k.legs || 0) + 1; if (f.k.legs % 3 === 0 && !t.ko && !t.gone) strike(b, f, t, t.maxHp * 0.15, 'P', 'STONE'); } });
defPassive({ id: 'terminus_terminal', name: 'Stays Here', owner: 'terminus', text: 'A foe whose dash hits it gets Root 2. When Road\'s End KOs a foe: heals 20% of max HP.',
  afterTake(b, f, src, dealt, d) { if (src && src.side !== f.side && !src.ko && !src.gone && d.move?.tags?.includes('dash')) applyStatus(b, f, src, 'root', 2); } });
defMove({ id: 'terminus_lastmile', name: 'Barrier Charge', type: 'STONE', owner: 'terminus', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | burst crack',
  text: 'Hits for 155% ATK. Root 1. Slow 1. The foe loses 3 DEF, up to 15.',
  run(c) { c.hit(c.tgt, { atk: 1.55 }); c.st(c.tgt, 'root', 1); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.shred = Math.min(15, (c.tgt.k.shred || 0) + 3); } });
defMove({ id: 'terminus_deadend', name: 'Warning Posts', type: 'STONE', owner: 'terminus', reach: 'self', cd: 3, wt: 50, fx: 'stomp | pebble*2 rise | ring self', text: 'For 2 turns its attacks hit 2 more times for 48% ATK.',
  run(c) { c.mark(c.u, 'terminus_purge', 1, 2); } });
defMove({ id: 'terminus_toll', name: 'Toll Bar', type: 'GEAR', owner: 'terminus', reach: 'single', cd: 3, fx: 'swell | cog line | crack',
  text: 'Hits for 100% ATK. Stun 1. Shield 10% max HP. The foe pays 1 tide to your side.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }); c.st(c.tgt, 'stun', 1); c.shield(c.u, c.u.maxHp * 0.1, 3); if (!c.tgt.ko && c.them.nerve > 0) { addNerve(c.b, c.tgt.side, -1); addNerve(c.b, c.u.side, 1); c.msg(`${label(c.b, c.tgt)} pays a toll.`); } } });
defMove({ id: 'terminus_roadsend', name: 'Road\'s End', type: 'STONE', owner: 'terminus', reach: 'single', cd: 6, nerve: 5, fx: 'lunge | crack pillar big dark jolt',
  text: 'Hits for 120% ATK. Below 25% HP after: KO\'d, and the next foe out skips a turn.',
  run(c) {
    c.hit(c.tgt, { atk: 1.2 });
    if (c.tgt.ko || c.blocked(c.tgt) || !under(c.tgt, 0.25)) return;
    c.msg(`${label(c.b, c.tgt)} reaches the end of the road.`);
    c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true });
    if (!c.tgt.ko) return;
    mark(c.b, c.u, c.u, 'terminus_dread', 1);
    if (has(c.u, 'terminus_terminal')) c.heal(c.u, c.u.maxHp * 0.2);
  } });

// horizon: a horizon with its stars still going round it, which raises more, sinks a well under a foe, and asks every star to fall at once.
defSummon({ id: 'horizon_star', name: 'Circling Star', owner: 'horizon', text: 'Each turn: hits the foe for 12% of Finihei\'s MGK.', every: 100,
  fall(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner && !owner.ko && has(owner, 'horizon_accretion')) { msg(b, 'The star falls on the foe.'); strike(b, owner, t, stat(b, owner, 'mgk') * 0.4, 'M', 'STAR'); } },
  sprite: { px: ['........', '.2....2.', '..2..2..', '...33...', '...33...', '..2..2..', '.2....2.', '........'], c: ['#e8c858', '#f8f8ff', '#424f9e'] },
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'mgk') * 0.12, 'M', 'STAR'); } });
defMark({ id: 'horizon_well', name: 'sinking', clock: 'own', negative: true, value: -0.1,
  turnStart(b, f) {
    const mk = f.m.horizon_well; const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    strike(b, by, f, stat(b, by, 'mgk') * 0.16, 'M', 'TIDE');
    if (!f.ko) applyStatus(b, by, f, 'slow', 1);
    if (!f.ko && under(f, 0.08)) { msg(b, `${label(b, f)} falls into the well.`); dealDamage(b, by, f, f.hp + f.shield + 1, dot('T'), null); }
  } });
defPassive({ id: 'horizon_ring', name: 'Turning Stars', owner: 'horizon', text: 'Starts with a Circling Star (10% max HP). Each KO it lands: another, max 3.',
  start(b, f) { summon(b, f, 'horizon_star', { hp: 0.1 }); },
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side && summonsOf(b, f.side, 'horizon_star').length < 3) summon(b, f, 'horizon_star', { hp: 0.1 }); } });
defPassive({ id: 'horizon_accretion', name: 'Falling Stars', owner: 'horizon', text: 'A Circling Star knocked down falls on the out foe for 40% of its MGK.' });
defMove({ id: 'horizon_skyline', name: 'Star Breath', type: 'STAR', owner: 'horizon', reach: 'single', tags: ['spell'], cd: 1, fx: 'swell | star*3 line | sparkle',
  text: 'Hits for 42% MGK, +15% per Circling Star.',
  run(c) { c.hit(c.tgt, { mgk: 0.42 }, { mult: 1 + 0.15 * summonsOf(c.b, c.u.side, 'horizon_star').length }); } });
defMove({ id: 'horizon_widen', name: 'Rise Up', type: 'STAR', owner: 'horizon', reach: 'side', cd: 3, fx: 'lift | star rise | sparkle self',
  text: 'Raises a Circling Star (10% max HP), up to 3. Haste 1.',
  run(c) { if (summonsOf(c.b, c.u.side, 'horizon_star').length < 3) summon(c.b, c.u, 'horizon_star', { hp: 0.1 }); c.st(c.u, 'haste', 1); } });
defMove({ id: 'horizon_farpoint', name: 'Sink Well', type: 'TIDE', owner: 'horizon', reach: 'single', tags: ['spell'], cd: 3, fx: 'sink | drop*3 converge | vortex',
  text: 'Hits for 20% MGK. At its next 3 turns: 16% MGK and Slow 1. Below 8% HP: it falls in.',
  run(c) { c.hit(c.tgt, { mgk: 0.2 }); if (!c.tgt.ko) c.mark(c.tgt, 'horizon_well', 1, 3); } });
defMove({ id: 'horizon_skyfall', name: 'Stars Fall', type: 'STAR', owner: 'horizon', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift | star*6 rain | flash sparkle big glare',
  text: 'Hits for 80% MGK, +30% per Circling Star. Splash 35%. Stun 1. They all fall.',
  run(c) { const ss = summonsOf(c.b, c.u.side, 'horizon_star'); c.spread({ mgk: 0.8 }, { mult: 1 + 0.3 * ss.length }); c.st(c.tgt, 'stun', 1); if (!c.preview) for (const x of ss) dismiss(c.b, x); } });

// murk: fog off the tide that rolls in hidden, cuts deepest at whoever has not touched it, muffles a foe, and cuts from inside itself.
defPassive({ id: 'murk_unseen', name: 'Unseen', owner: 'murk', text: 'If nothing hit it since its last turn: its hits deal 1.4x.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.seen = b.turnNo; if (src && src.side !== f.side) f.k.touched = (f.k.touched || 0) | (1 << src.idx); },
  outMul(b, f, t, d) { return !d.reserve && (f.k.seen ?? -9) < (f.k.lastTurnNo ?? 0) ? 1.4 : 1; },
  turnEnd(b, f) { f.k.lastTurnNo = b.turnNo; } });
defPassive({ id: 'murk_smother', name: 'Rolls In', owner: 'murk', text: 'When it comes out: Hidden 1.',
  comeOut(b, f) { applyStatus(b, f, f, 'hidden', 1); } });
defMove({ id: 'murk_coldcut', name: 'Cold Edge', type: 'TIDE', owner: 'murk', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | frost slash', text: 'Hits for 75% ATK, 1.4x on a foe that never hit it. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }, { mult: (c.u.k.touched || 0) & (1 << c.tgt.idx) ? 1 : 1.4 }); c.hasten(c.u, 25); } });
defMove({ id: 'murk_pall', name: 'Fog Pall', type: 'VOID', owner: 'murk', reach: 'single', cd: 4, fx: 'sway | orb*3 converge | smoke daze',
  text: 'Hits for 60% ATK. Silence 1. Weaken 2. Sea Fog for 4 rounds.',
  run(c) { setField(c.b, 'fog', 4, c.u); c.hit(c.tgt, { atk: 0.6 }); c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'weaken', 2); } });
defMove({ id: 'murk_lurk', name: 'Thicken', type: 'TIDE', owner: 'murk', reach: 'self', cd: 4, wt: 50, fx: 'blink | smoke self', text: 'Hidden 1. Every foe counts as never having hit it.',
  run(c) { c.st(c.u, 'hidden', 1); c.u.k.touched = 0; } });
defMove({ id: 'murk_fogbound', name: 'Fogbound', type: 'TIDE', owner: 'murk', reach: 'spread', cd: 6, nerve: 4, fx: 'blink | shard*3 sweep | slash smoke big dark', text: 'Hidden 1. Hits 3 times for 30% ATK. Splash 35%.',
  run(c) {
    c.st(c.u, 'hidden', 1);
    for (let i = 0; i < 3 && !c.tgt.ko; i++) c.spread({ atk: 0.3 });
  } });

// undine: something drowned past the edge and too big to see whole, which no one blow can finish, that wraps kelp, shows a part, and sings.
defSummon({ id: 'undine_image', name: 'Drowned Image', owner: 'undine', sprite: { px: ['........', '4.4.....', '.44.....', '33333333', '22222222', '24442222', '24142222', '22222222'], c: ['#2e4a68', '#70a7bf', '#bfd7cf'] }, text: 'Takes single-target hits meant for your out whorl. Each turn: hits the foe for 25% ATK.', every: 100, guard: true,
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'atk') * 0.25, 'P', 'TIDE'); } });
defPassive({ id: 'undine_undercurrent', name: 'Under Pull', owner: 'undine', text: 'Every 4th attack: Expose 2, and each foe reserve takes 55% MGK.',
  afterAttack(b, f, t) { f.k.rip = (f.k.rip || 0) + 1; if (f.k.rip % 4 !== 0) return; if (!t.ko && !t.gone) applyStatus(b, f, t, 'expose', 2); for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.55, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'undine_toobig', name: 'Bigger Below', owner: 'undine', text: 'Too big to see whole: one hit takes at most 25% of its max HP.',
  beforeTake(b, f, src, amt) { return Math.min(amt, f.maxHp * 0.25); } });
defMove({ id: 'undine_fathom', name: 'Deep Rip', type: 'TIDE', owner: 'undine', reach: 'single', tags: ['spell'], cd: 1, fx: 'sink | wave | splash',
  text: 'Hits for 84% MGK. Splash 35%. The foe loses 3 DEF, up to 15. Delays it 15%.',
  run(c) { c.spread({ mgk: 0.84 }); c.delay(c.tgt, 15); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.shred = Math.min(15, (c.tgt.k.shred || 0) + 3); } });
defMove({ id: 'undine_kelphold', name: 'Kelp Wrap', type: 'TIDE', owner: 'undine', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | kelp*3 converge | bite', text: 'Hits for 97% MGK. Root 2, or Root 4 on a foe below half HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.97 }); c.st(c.tgt, 'root', c.tgt.hp < c.tgt.maxHp * 0.5 ? 4 : 2); } });
defMove({ id: 'undine_glimpse', name: 'Show a Part', type: 'BEAST', owner: 'undine', reach: 'single', tags: ['spell'], cd: 4, fx: 'sink | fang rise | bite',
  text: 'Hits for 80% MGK. Summons a Drowned Image (7% max HP, 2 turns).',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); summon(c.b, c.u, 'undine_image', { hp: 0.07, turns: 2 }); } });
defMove({ id: 'undine_undersong', name: 'Deep Song', type: 'TIDE', owner: 'undine', reach: 'single', tags: ['channel'], cd: 6, nerve: 5, fx: 'sway | bell*3 wave | ring big tint', text: 'Stasis 2 on the foe. Your team heals 10% of max HP.',
  run(c) { c.st(c.tgt, 'stasis', 2); for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.1); } });

// lip: a piece of the Lip that walked off, pulls a foe's summons over to its side, trips whoever steps back, and grows heavier with each fall.
defMark({ id: 'lip_edge', name: 'on the edge', negative: true, volatile: true, value: -0.04,
  leave(b, f) {
    const mk = f.m.lip_edge, by = mk ? markedBy(b, mk) : null;
    unmark(f, 'lip_edge');
    if (!by || by.ko || !isOut(b, by)) return;
    const a = Math.min(f.hp - 1, Math.round(f.maxHp * 0.08));
    if (a <= 0) return;
    msg(b, `${label(b, f)} slips at the edge.`);
    dealDamage(b, by, f, a, dot('T'), null);
  } });
defMark({ id: 'lip_rot', name: 'crumbling', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { const t = foe(b, f); dealDamage(b, null, f, f.maxHp * 0.03, dot('T'), null); if (t) { dealDamage(b, f, t, t.maxHp * 0.08, dot('T'), null); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } } });
defMark({ id: 'lip_apart', name: 'pulling apart', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { unmark(f, 'lip_apart'); const t = foe(b, f); if (!t) return; const d = strike(b, f, t, stat(b, f, 'atk') * 0.5 + t.maxHp * 0.04, 'P', 'BEAST'); heal(b, f, f, d * 0.5); } });
defPassive({ id: 'lip_heaped', name: 'Heavier', owner: 'lip', text: 'When a foe is KO\'d while it is out: +8% max HP for the battle.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) { const add = Math.round(f.st.hp * 0.08); f.maxHp += add; heal(b, f, f, add); } } });
defPassive({ id: 'lip_overhang', name: 'Overhang', owner: 'lip', text: 'While it is out: a foe that switches out in front of it slips for 8% max HP.',
  comeOut(b, f) { const t = foe(b, f); if (t) mark(b, f, t, 'lip_edge', 1, -1); },
  anyOut(b, f, who) { if (who.side !== f.side && !f.ko && isOut(b, f)) mark(b, f, who, 'lip_edge', 1, -1); } });
defMove({ id: 'lip_gnaw', name: 'Edge Bite', type: 'BEAST', owner: 'lip', reach: 'single', cd: 1, fx: 'lunge | bite drip', text: 'Hits for 110% ATK. Rot 2.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); c.st(c.tgt, 'rot', 2); } });
defMove({ id: 'lip_pullover', name: 'Over the Edge', type: 'BEAST', owner: 'lip', reach: 'dragin', tags: ['projectile'], cd: 3, fx: 'recoil | kelp return | claw',
  text: 'Pulls the foe\'s newest summon to your side, or drags in a reserve and hits it for 72% ATK.',
  run(c) {
    const u = c.them.sum.slice().reverse().find(x => !x.moves && x.link === undefined);
    if (u && stealSummon(c.b, u, c.u)) return;
    c.dragIn(c.pick);
    c.hit(c.them.f[c.them.out], { atk: 0.72 });
  } });
defMove({ id: 'lip_fester', name: 'Crumble', type: 'TIDE', owner: 'lip', reach: 'single', cd: 3, fx: 'shake | pebble*3 rain | crack',
  text: 'Hits for 80% ATK. 3 turns: it loses 3% max HP and the foe loses 8%, Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.mark(c.u, 'lip_rot', 1, 3); } });
defMove({ id: 'lip_pullapart', name: 'Pull Apart', type: 'BEAST', owner: 'lip', reach: 'single', tags: ['channel'], cd: 6, nerve: 5, fx: 'lunge | fang*2 converge | bite big jolt',
  text: 'Hits for 58% ATK + 4% max HP now and next turn, healing half. Stun 1. Root 2.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.58, tgtHp: 0.04 }); c.heal(c.u, d * 0.5); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 2); c.mark(c.u, 'lip_apart', 1, 2); } });

// ================================================================ the shallows

// rumple: a wrinkle in loose ground that rucks the ground under the foe's side, so a hit on one corner raises the others, and raises a corner to guard.
defGround({ id: 'rumple_rucked', name: 'Rucked Ground', color: '#9e805e', text: 'A hit on the out whorl here also hits each reserve here for 25% of it.',
  afterTake(b, f, src, dealt, d) {
    if (d.dot || d.reserve || !isOut(b, f)) return;
    for (const r of reserves(b.s[f.side])) dealDamage(b, src, r, dealt * 0.25, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: true }, null);
  },
  value(b, side) { return b.s[side].ground?.id === 'rumple_rucked' ? -0.12 : 0.12; } });
defMark({ id: 'rumple_word', name: 'creased', clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.rumple_word; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'mgk') * 0.28, 'M', 'ROOT'); } });
defSummon({ id: 'rumple_golem', name: 'Raised Corner', owner: 'rumple', sprite: { px: ['........', '..3333..', '..2222..', '.232232.', '.222222.', '22222222', '4.4..4.4', '........'], c: ['#9e805e', '#7ad959', '#50405e'] }, text: 'Takes single-target hits for your out whorl. Each turn: hits the foe for 30% MGK.', every: 100, guard: true,
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'mgk') * 0.3, 'M', 'ROOT'); } });
defPassive({ id: 'rumple_foldover', name: 'Fold Over', owner: 'rumple', text: 'Its moves deal 1.2x to a foe on rucked ground, and each foe reserve takes 25% of it.',
  outMul(b, f, t, d) { return d.move && t.gnd === 'rumple_rucked' ? 1.2 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.move || d.reserve || d.spread || d.dot || t.side === f.side || t.gnd !== 'rumple_rucked' || dealt <= 0) return; for (const r of reserves(b.s[t.side])) dealDamage(b, f, r, dealt * 0.25, { kind: 'T', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'rumple_give', name: 'Give Way', owner: 'rumple', text: 'While its Raised Corner stands: your out whorl heals 2% of max HP a turn.',
  turnStart(b, f) { if (summonsOf(b, f.side, 'rumple_golem').length) heal(b, f, f, f.maxHp * 0.02); },
  reserveTurn(b, f) { if (summonsOf(b, f.side, 'rumple_golem').length) { const o = outOf(b, f); if (!o.ko) heal(b, f, o, o.maxHp * 0.02); } } });
defMove({ id: 'rumple_ruck', name: 'Ruck Up', type: 'ROOT', owner: 'rumple', reach: 'single', tags: ['spell'], cd: 1, fx: 'stomp | sand line | crack', text: 'Hits for 47% MGK. At the foe\'s next 2 turns: it takes 28% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.47 }); if (!c.tgt.ko) c.mark(c.tgt, 'rumple_word', 1, 2); } });
defMove({ id: 'rumple_buckle', name: 'Buckle Under', type: 'ROOT', owner: 'rumple', reach: 'single', tags: ['spell'], cd: 3, fx: 'stomp | quake crack',
  text: 'Rucks the ground under the foe\'s side for 3 rounds. Hits for 38% MGK.',
  run(c) { setGround(c.b, c.tgt.side, 'rumple_rucked', 3, c.u); c.hit(c.tgt, { mgk: 0.38 }); } });
defMove({ id: 'rumple_pucker', name: 'Pucker Up', type: 'TIDE', owner: 'rumple', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | drop line | splash',
  text: 'Hits for 70% MGK, 1.5x on rucked ground. Slow 2. Weaken 1. Delays it 30%.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }, { mult: c.tgt.gnd === 'rumple_rucked' ? 1.5 : 1 }); c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'weaken', 1); c.delay(c.tgt, 30); } });
defMove({ id: 'rumple_upfold', name: 'Fold Up', type: 'ROOT', owner: 'rumple', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift | pebble*4 rise | quake big jolt',
  text: 'Hits for 60% MGK. Splash 35%. Stun 1. Raises a Corner (25% max HP, 3 turns).',
  run(c) { c.spread({ mgk: 0.6 }); c.st(c.tgt, 'stun', 1); summon(c.b, c.u, 'rumple_golem', { hp: 0.25, turns: 3 }); } });

// sag: a salt dip that wears mud Layers, gathers Drops to let go at once, floods its own side into a Salt Pool, and sends up mud puppies.
defGround({ id: 'sag_pool', name: 'Salt Pool', color: '#7d9cb0', text: 'Whorls here heal 4% of max HP a turn. Dashes that hit them deal 0.75x.',
  turnStart(b, f) { if (!f.ko) heal(b, groundBy(b, f.side), f, f.maxHp * 0.04); },
  inMul(b, f, src, d) { return d.move?.tags?.includes('dash') ? 0.75 : 1; },
  value(b, side) { return b.s[side].ground?.id === 'sag_pool' ? 0.12 : -0.12; } });
defMark({ id: 'sag_layer', name: 'layers', max: 4, value: 0.05 });
defSummon({ id: 'sag_familiar', name: 'Mud Puppy', owner: 'sag', sprite: { px: ['........', '4......4', '44.33.44', '.422224.', '.212212.', '.222222.', '.2....2.', '........'], c: ['#7d634c', '#ebefef', '#493f47'] }, text: 'Each turn: bites the foe for 30% of Notbomi\'s MGK.', every: 100,
  act(b, s, owner) {
    const t = b.s[1 - s.side].f[b.s[1 - s.side].out];
    if (!t || t.ko || !owner) return;
    strike(b, owner, t, stat(b, owner, 'mgk') * 0.3, 'M', 'BEAST');
  } });
defPassive({ id: 'sag_sediment', name: 'Laid Down', owner: 'sag', text: 'Wears 4 Layers, each 6% less damage. A hit over 10% max HP strips one.',
  start(b, f) { mark(b, f, f, 'sag_layer', 4); },
  inMul(b, f) { return 1 - 0.06 * marked(f, 'sag_layer'); },
  afterTake(b, f, src, dealt, d) { if (!d.dot && dealt > f.maxHp * 0.1) shed(f, 'sag_layer', 1); } });
defPassive({ id: 'sag_seepage', name: 'Seeps In', owner: 'sag', text: 'When it hits or is hit: 1 Drop, up to 5, for Cold Hollow.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) f.k.souls = Math.min(5, (f.k.souls || 0) + 1); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.souls = Math.min(5, (f.k.souls || 0) + 1); } });
defMove({ id: 'sag_runoff', name: 'Run Off', type: 'TIDE', owner: 'sag', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | drop line | splash',
  text: 'Hits for 85% MGK. Slow 1. +1 Layer, up to 4. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 20); if (marked(c.u, 'sag_layer') < 4) c.mark(c.u, 'sag_layer', 1); } });
defMove({ id: 'sag_coldhollow', name: 'Cold Hollow', type: 'SALT', owner: 'sag', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'sink | salt*3 converge | shatter', text: 'Spends Drops: hits for 43% MGK + 18% MGK per Drop.',
  run(c) { const n = c.u.k.souls || 0; c.u.k.souls = 0; c.hit(c.tgt, { mgk: 0.43 + 0.18 * n }); } });
defMove({ id: 'sag_sinkhole', name: 'Settle In', type: 'TIDE', owner: 'sag', reach: 'self', cd: 5, wt: 60, fx: 'sink | drop*4 rise | splash ally',
  text: 'Untouchable 1. Floods your side into a Salt Pool for 4 rounds. All 4 Layers back.',
  run(c) { c.st(c.u, 'invuln', 1); setGround(c.b, c.u.side, 'sag_pool', 4, c.u); unmark(c.u, 'sag_layer'); c.mark(c.u, 'sag_layer', 4); } });
defMove({ id: 'sag_subside', name: 'Mud Up', type: 'TIDE', owner: 'sag', reach: 'side', cd: 6, nerve: 5, fx: 'sink | bubble*4 rise | puff splash tint big',
  text: 'Summons 2 Mud Puppies (12% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'sag_familiar', { hp: 0.12, turns: 3 }); summon(c.b, c.u, 'sag_familiar', { hp: 0.12, turns: 3 }); } });

// furrow: a walking craze that leaves a Thorn Tangle for whoever comes out, hits the rooted harder, drains their tide, and rings a foe in thorns.
defSummon({ id: 'furrow_maze', name: 'Thorn Tangle', owner: 'furrow', sprite: { px: ['........', '........', '........', '3.3..3.3', '.3.33.3.', '22224222', '22242222', '........'], c: ['#9a8262', '#962f97', '#352933'] }, text: 'Each foe that comes out: Root 2 and 80% of Vakone\'s MGK. 3 turns.', every: 100,
  act() { /* the maze only waits */ },
  trap(b, s, who) { const by = ownerOf(b, s); applyStatus(b, by, who, 'root', 2); if (by) strike(b, by, who, stat(b, by, 'mgk') * 0.8, 'M', 'ROOT'); return false; } });
defMark({ id: 'furrow_crown', name: 'ringed', clock: 'own', negative: true, value: -0.2,
  expire(b, f, mk) {
    const by = markedBy(b, mk);
    msg(b, 'The ring of thorns closes.');
    if (!by) return;
    splash(b, by, stat(b, by, 'mgk') * 0.8, 'M', 'ROOT');
    const t = b.s[f.side].f[b.s[f.side].out];
    if (t && !t.ko) { applyStatus(b, by, t, 'stun', 1); applyStatus(b, by, t, 'root', 2); }
  } });
defPassive({ id: 'furrow_walker', name: 'Crack Walker', owner: 'furrow', text: 'Its moves deal 1.2x damage to a Rooted foe.',
  outMul(b, f, t, d) { return d.move && t.s.root ? 1.2 : 1; } });
defPassive({ id: 'furrow_illfooting', name: 'Ill Footing', owner: 'furrow', text: 'Foes it Roots also get Slow 1. Once a turn: a Rooted foe it hits with a move loses 1 tide.',
  afterApply(b, f, t, id) { if (id === 'root' && t.side !== f.side) applyStatus(b, f, t, 'slow', 1); },
  afterDeal(b, f, t, dealt, d) {
    if (!d.move || d.reserve || !t.s.root || t.side === f.side || f.k.tideAt === b.turnNo || b.s[t.side].nerve <= 0) return;
    f.k.tideAt = b.turnNo;
    addNerve(b, t.side, -1);
  } });
defMove({ id: 'furrow_split', name: 'Crack Thorn', type: 'ROOT', owner: 'furrow', reach: 'single', tags: ['spell'], cd: 1, fx: 'shake | thorn line fast | slash',
  text: 'Hits for 144% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.44 }); } });
defMove({ id: 'furrow_maze', name: 'Crazed Ground', type: 'STONE', owner: 'furrow', reach: 'single', tags: ['spell'], cd: 4, fx: 'stomp | thorn*3 rise | crack', text: 'Hits for 78% MGK. Root 1. Summons a Thorn Tangle (12% max HP).',
  run(c) { c.hit(c.tgt, { mgk: 0.78 }); c.st(c.tgt, 'root', 1); summon(c.b, c.u, 'furrow_maze', { hp: 0.12, turns: 3 }); } });
defMark({ id: 'furrow_crack', name: 'in the crack', clock: 'own', volatile: true, value: 0.08,
  afterDeal(b, f, t, dealt, d) { if (!d.move || d.reserve || t.side === f.side) return; unmark(f, 'furrow_crack'); if (!t.ko) applyStatus(b, f, t, 'root', 1); } });
defMove({ id: 'furrow_underfold', name: 'Into the Crack', type: 'ROOT', owner: 'furrow', reach: 'self', cd: 4, wt: 50, fx: 'blink | crack self',
  text: 'Hidden 1. Its next move deals 1.5x and Roots the foe for 1.',
  run(c) { c.st(c.u, 'hidden', 1); c.u.k.nextMoveMul = 1.5; c.mark(c.u, 'furrow_crack', 1, 2); } });
defMove({ id: 'furrow_circlet', name: 'Thorn Ring', type: 'ROOT', owner: 'furrow', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'flare | thorn*6 orbit | slash big jolt', text: 'Hits for 83% MGK. After 2 of its turns: 80% MGK, Splash 35%, Stun 1, Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.83 }); if (!c.tgt.ko) c.mark(c.tgt, 'furrow_crown', 1, 2); } });

export const KITS4_LOADED = true;
void sk; void lowestAlly; void setMove; void doSwitch; void cleanse; void moveIdx;
