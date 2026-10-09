// Kits for the second half of the species expansion.
import {
  addNerve, applyStatus, basicOf, canSwitch, cleanse, clearForm, forceAction, dealDamage, delayFighter, doSwitch, emit, foeOf, giveShield, has, hastenFighter, heal, isOut, label,
  mark, marked, markedBy, msg, reserves, setForm, setMove, sk, standing, stat, summon, summonsOf, dismiss, takeOver, unmark, SPREAD_SHARE,
} from '../battle/engine';
import type { Battle, Fighter, SpriteData, Summon } from '../battle/model';
import { defMark, defMove, defPassive, defSummon, MOVES, type Ctx, type DmgInfo, type MoveDef } from '../battle/registry';
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

// kiln: a kiln that glazes foes brittle, leaves a Pillar, breathes heat, charges into the Pillar, and throws a hot brick that comes back.
defMark({ id: 'kiln_brittle', name: 'brittle', negative: true, max: 1, value: -0.08,
  afterGet(b, f, src, id) {
    if (id !== 'stun' && id !== 'root') return;
    unmark(f, 'kiln_brittle');
    msg(b, `${label(b, f)} cracks.`);
    dealDamage(b, src, f, f.maxHp * 0.1, dot('T'), null);
  } });
defMark({ id: 'kiln_pillar', name: 'pillar up', value: 0.04 });
defMark({ id: 'kiln_return', name: 'brick coming back', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'kiln_return'); const t = foe(b, f); if (!t) return; msg(b, 'The brick comes back.'); strike(b, f, t, stat(b, f, 'atk') * 0.6, 'P', 'GEAR'); if (!t.ko) applyStatus(b, f, t, 'stun', 1); } });
defPassive({ id: 'kiln_glaze', name: 'Glazing', owner: 'kiln', text: 'Its damaging moves make the foe Brittle: its next Stun or Root costs 10% max HP.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko && t.side !== f.side) mark(b, f, t, 'kiln_brittle', 1, 3); } });
defPassive({ id: 'kiln_hearth', name: 'Hearth', owner: 'kiln', text: 'Battle start: each ally gets +4% ATK and MGK, +10% if it holds a notion. Once per side.',
  start(b, f) {
    const s = sk(b, f.side);
    if (s.hearth) return;
    s.hearth = 1;
    for (const a of b.s[f.side].f) {
      const p = a.mon.notion ? 0.1 : 0.04;
      a.st.atk = Math.round(a.st.atk * (1 + p)); a.st.mgk = Math.round(a.st.mgk * (1 + p));
    }
  } });
defMove({ id: 'kiln_clinker', name: 'Clinker', type: 'GEAR', owner: 'kiln', reach: 'single', cd: 1, text: 'Hits for 101% ATK. Slow 1. Sets a Pillar.',
  run(c) { c.hit(c.tgt, { atk: 1.01 }); c.st(c.tgt, 'slow', 1); mark(c.b, c.u, c.u, 'kiln_pillar', 1); } });
defMove({ id: 'kiln_bellows', name: 'Stoke Hole', type: 'GEAR', owner: 'kiln', reach: 'single', cd: 3, text: 'Hits for 67% ATK + 6% of the foe\'s max HP. Unstoppable 1.',
  run(c) { c.hit(c.tgt, { atk: 0.67, tgtHp: 0.06 }); c.st(c.u, 'unstop', 1); } });
defMove({ id: 'kiln_temper', name: 'Pillar Charge', type: 'GEAR', owner: 'kiln', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 91% ATK. With a Pillar: spends it, Stun 1.',
  run(c) { const p = marked(c.u, 'kiln_pillar'); c.hit(c.tgt, { atk: 0.91 }); if (p && !c.tgt.ko) { unmark(c.u, 'kiln_pillar'); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'kiln_ram', name: 'Fire Brick', type: 'GEAR', owner: 'kiln', reach: 'spread', cd: 6, nerve: 5, text: 'Hits every foe for 106% ATK. Every foe is Brittle. At its next turn: the foe takes 60% ATK. Stun 1.',
  run(c) {
    c.spread({ atk: 1.06 });
    for (const e of standing(c.them)) mark(c.b, c.u, e, 'kiln_brittle', 1, 3);
    c.mark(c.u, 'kiln_return', 1, 2);
  } });

// belt: a conveyor belt that couples to one friend, shares heals with it, rolls, runs fast, and carries it in.
defMark({ id: 'belt_coupled', name: 'coupled', max: 1, value: 0.05 });
const coupledOf = (b: Battle, f: Fighter): Fighter | undefined => standing(b.s[f.side]).find(a => a !== f && marked(a, 'belt_coupled'));
function couple(b: Battle, u: Fighter, a: Fighter): void {
  for (const x of b.s[u.side].f) unmark(x, 'belt_coupled');
  if (a !== u) mark(b, u, a, 'belt_coupled', 1, -1);
}
defPassive({ id: 'belt_load', name: 'Same Load', owner: 'belt', text: 'Its heals also heal its Coupled ally for 50%.',
  afterHeal(b, f, t, amt) { if (amt <= 0) return; const p = coupledOf(b, f); if (p && p !== t) heal(b, null, p, amt * 0.5); } });
defPassive({ id: 'belt_idler', name: 'Idler Wheel', owner: 'belt', text: 'Coupled ally: first turn 30% sooner. In reserve: it takes 0.88x damage.',
  anyOut(b, f, who) { if (who.side === f.side && who !== f && marked(who, 'belt_coupled')) who.k.firstBonus = (who.k.firstBonus || 0) + 30; },
  auraIn(b, f, o) { return marked(o, 'belt_coupled') ? 0.88 : 1; } });
defMove({ id: 'belt_rollers', name: 'Roller Spin', type: 'GEAR', owner: 'belt', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 85% MGK.',
  run(c) { c.spread({ mgk: 0.85 }); } });
defMove({ id: 'belt_couple', name: 'Couple Up', type: 'GEAR', owner: 'belt', reach: 'ally', cd: 2, wt: 70, text: 'Couples an ally. Both heal 10% of max HP. Slow 1 on the foe.',
  run(c) { const a = c.ally!; couple(c.b, c.u, a); c.heal(c.u, c.u.maxHp * 0.1); if (a !== c.u) c.heal(a, a.maxHp * 0.1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'belt_overdrive', name: 'Belt Speed', type: 'GEAR', owner: 'belt', reach: 'self', cd: 3, wt: 60, text: 'Haste 2 and Fortify 1 on it and its Coupled ally. Pays 6% max HP.',
  run(c) { payHp(c.b, c.u, c.u.maxHp * 0.06); for (const a of [c.u, coupledOf(c.b, c.u)]) if (a) { c.st(a, 'haste', 2); c.st(a, 'fortify', 1); } } });
defMove({ id: 'belt_trip', name: 'Carry Over', type: 'GEAR', owner: 'belt', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true,
  text: 'Couples an ally and switches to it: heals 15%, acts at once.',
  run(c) { const a = c.ally!; couple(c.b, c.u, a); c.heal(a, a.maxHp * 0.15); a.k.firstBonus = (a.k.firstBonus || 0) + 300; } });

// ================================================================ skinfall

// aerial: a fallen antenna that flashes static, sends a long beam, passes time on to a friend, and leaves a foe tuned to dead air.
defMark({ id: 'aerial_wisp', name: 'tuned in', clock: 'own', negative: true, value: -0.2,
  turnStart(b, f) { f.k.wispT = (f.k.wispT || 0) + 1; if (f.k.wispT % 2 === 1) { const mk = f.m.aerial_wisp; stunNow(b, mk ? markedBy(b, mk) : null, f); msg(b, `${label(b, f)} listens to the static.`); } } });
defPassive({ id: 'aerial_carrier', name: 'Good Signal', owner: 'aerial', text: 'When one of its wind-up moves lands: your team heals 5% of max HP.',
  afterMove(b, f, m) { if (m.wu) for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.05); } });
defPassive({ id: 'aerial_repeater', name: 'Relay', owner: 'aerial', text: 'Deals 1.2x damage to a Slowed or Stunned foe.',
  outMul(b, f, t) { return t.s.slow || t.s.stun ? 1.2 : 1; } });
defMove({ id: 'aerial_reception', name: 'Static Flash', type: 'STAR', owner: 'aerial', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 111% MGK. Weaken 1. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { mgk: 1.11 }); c.st(c.tgt, 'weaken', 1); c.delay(c.tgt, 20); } });
defMove({ id: 'aerial_broadcast', name: 'Long Beam', type: 'STAR', owner: 'aerial', reach: 'single', tags: ['projectile', 'spell'], cd: 3, wu: 80, text: 'Wind-up. Hits for 192% MGK. Reserves take 35% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 1.92 }); for (const r of reserves(c.them)) c.hit(r, { mgk: 1.92 }, { reserve: true, spread: true, mult: 0.35 }); } });
defMove({ id: 'aerial_interference', name: 'Pass It On', type: 'STAR', owner: 'aerial', reach: 'ally', cd: 4, text: 'An ally\'s cooldowns drop 2, except its crest. 1 tide.',
  run(c) { const a = c.ally!; a.moves.forEach((id, i) => { if (!MOVES[id]?.nerve) a.cd[i] = Math.max(0, a.cd[i] - 2); }); c.nerve(c.me, 1); } });
defMove({ id: 'aerial_longwave', name: 'Dead Air', type: 'STAR', owner: 'aerial', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 70% MGK. Next 4 foe turns: Stun 1 on the 1st and 3rd.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); if (!c.tgt.ko) { c.tgt.k.wispT = 0; c.mark(c.tgt, 'aerial_wisp', 1, 4); } } });

// vane: a weather vane that spins, throws its arrow and goes after it, points home every third swing, and sets down beside a friend.
defMark({ id: 'vane_hammer', name: 'arrow out', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'vane_hammer'); const t = foe(b, f); if (t) { strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'STAR'); hastenFighter(b, f, 20); } } });
defPassive({ id: 'vane_landfall', name: 'North Point', owner: 'vane', text: 'Every 3rd attack: deals 1.5x, and your team heals 5% of max HP.',
  outMul(b, f, t, d) { return d.attack && (f.k.lum || 0) % 3 === 2 ? 1.5 : 1; },
  afterAttack(b, f) { f.k.lum = (f.k.lum || 0) + 1; if (f.k.lum % 3 === 0) for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.05); } });
defPassive({ id: 'vane_fullsail', name: 'Beside You', owner: 'vane', text: 'Once, in reserve: your out whorl below 25% HP heals 15%. Foe: Stun 1.',
  reserveTurn(b, f) {
    if (f.k.landed) return;
    const o = outOf(b, f);
    if (o.ko || !under(o, 0.25)) return;
    f.k.landed = 1;
    msg(b, `${label(b, f)} comes down beside ${label(b, o)}.`);
    heal(b, f, o, o.maxHp * 0.15);
    const t = foe(b, o);
    if (t) stunNow(b, f, t);
  } });
defMove({ id: 'vane_spar', name: 'Spin on Pin', type: 'STAR', owner: 'vane', reach: 'single', cd: 1, text: 'Hits 2 times for 49% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.49 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.49 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'vane_jibe', name: 'Throw Arrow', type: 'STAR', owner: 'vane', reach: 'single', tags: ['projectile'], cd: 2, text: 'Hits for 75% ATK. At its next turn the arrow comes back for 50% ATK, and its turn after that comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); c.mark(c.u, 'vane_hammer', 1, 2); } });
defMove({ id: 'vane_halyard', name: 'After It', type: 'STAR', owner: 'vane', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 80% ATK. If its arrow has not come back yet: it catches it. Stun 1.',
  run(c) { const out = marked(c.u, 'vane_hammer') > 0; c.hit(c.tgt, { atk: 0.8 }); if (out) { unmark(c.u, 'vane_hammer'); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'vane_touchdown', name: 'Land Beside', type: 'STAR', owner: 'vane', reach: 'spread', cd: 6, nerve: 5, text: 'Hits every foe for 88% ATK. Stun 1. Your team heals 15% of max HP.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.15); c.spread({ atk: 0.88 }); c.st(c.tgt, 'stun', 1); } });

// capsule: a fallen capsule that drops hot, burns cold, shuts round a friend, and turns a foe's own side on it.
defMark({ id: 'capsule_burn', name: 'cold burn', clock: 'own', volatile: true, value: 0.1,
  addRaw(b, f, t, d) { return d.attack ? t.hp * 0.05 : 0; },
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defMark({ id: 'capsule_curse', name: 'turned on', clock: 'own', negative: true, value: -0.3,
  turnStart(b, f) {
    stunNow(b, null, f);
    for (const r of reserves(b.s[f.side])) { msg(b, `${label(b, r)} turns on ${label(b, f)}.`); strike(b, r, f, stat(b, r, 'atk') * 0.3, 'P', null); }
  } });
defPassive({ id: 'capsule_coldsoak', name: 'Frost Skin', owner: 'capsule', text: 'Deals 1.15x damage to a Slowed foe.',
  outMul(b, f, t) { return t.s.slow ? 1.15 : 1; } });
defPassive({ id: 'capsule_drogue', name: 'Drogue Chute', owner: 'capsule', text: 'Takes 0.85x damage while the foe is Slowed.',
  inMul(b, f) { const t = foe(b, f); return t && t.s.slow ? 0.85 : 1; } });
defMove({ id: 'capsule_reentry', name: 'Hot Drop', type: 'GEAR', owner: 'capsule', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 85% MGK. Slow 1. Reserves take 40% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.st(c.tgt, 'slow', 1); for (const r of reserves(c.them)) c.hit(r, { mgk: 0.85 }, { reserve: true, spread: true, mult: 0.4 }); } });
defMove({ id: 'capsule_hullburst', name: 'Cold Burn', type: 'GEAR', owner: 'capsule', reach: 'self', cd: 3, wt: 60, text: 'For 3 turns: attacks add 5% of the foe\'s current HP and Slow 1.',
  run(c) { c.mark(c.u, 'capsule_burn', 1, 3); } });
defMove({ id: 'capsule_sealin', name: 'Clam Shut', type: 'GEAR', owner: 'capsule', reach: 'ally', cd: 4, text: 'Heals an ally 20% of max HP. If it is out: Stasis 1.',
  run(c) { const a = c.ally!; if (isOut(c.b, a) && a !== c.u) c.st(a, 'stasis', 1); c.heal(a, a.maxHp * 0.2); } });
defMove({ id: 'capsule_mutiny', name: 'Turn Them', type: 'GEAR', owner: 'capsule', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 47% MGK. At the foe\'s next 2 turns: Stun, and each of its reserves hits it for 30% of their ATK.',
  run(c) { c.hit(c.tgt, { mgk: 0.47 }); if (!c.tgt.ko) c.mark(c.tgt, 'capsule_curse', 1, 2); } });

// booster: a spent rocket stage that switches between Burning and Spinning, sprays sparks, drops clamps, and fires one last long burn.
defSummon({ id: 'booster_chomper', name: 'Clamp', owner: 'booster', text: 'Stays until a foe comes out. Hits it for 50% of Imshin\'s ATK. Root 2.',
  sprite: { px: ['........', '........', '........', '3.3..3.3', '22222222', '21222212', '22222222', '4......4'], c: ['#81719e', '#f5f1f1', '#f37533'] },
  trap(b, s, who) { const by = ownerOf(b, s); msg(b, `${label(b, who)} steps in a clamp.`); if (by) strike(b, by, who, stat(b, by, 'atk') * 0.5, 'P', 'GEAR'); if (!who.ko) applyStatus(b, by, who, 'root', 2); return true; } });
defPassive({ id: 'booster_stage', name: 'Stage Off', owner: 'booster', text: 'When a foe is KO\'d while it is out: Haste 2. Its next attack deals 1.5x.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) { applyStatus(b, f, f, 'haste', 2); f.k.nextAtkMul = 1.5; } } });
defPassive({ id: 'booster_last', name: 'Two Burns', owner: 'booster', text: 'Burning: attacks hit reserves for 30% ATK. Spinning: +8% per attack in a row, max 4.',
  outMul(b, f, t, d) { return d.attack && !f.k.rocket ? 1 + 0.08 * Math.min(4, f.k.spin || 0) : 1; },
  afterAttack(b, f) {
    if (f.k.rocket) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.3, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); return; }
    f.k.spin = (f.k.spin || 0) + 1;
  },
  turnEnd(b, f, action) { if (action !== 'attack') f.k.spin = 0; } });
defMove({ id: 'booster_thrust', name: 'Switch Burn', type: 'GEAR', owner: 'booster', reach: 'self', tags: ['projectile'], cd: 1, wt: 50, text: 'Switches between Burning and Spinning.',
  run(c) { c.u.k.rocket = c.u.k.rocket ? 0 : 1; c.u.k.spin = 0; c.msg(`${label(c.b, c.u)} is ${c.u.k.rocket ? 'burning' : 'spinning'}.`); } });
defMove({ id: 'booster_scatter', name: 'Spark Spray', type: 'GEAR', owner: 'booster', reach: 'single', cd: 2, text: 'Hits for 100% ATK. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'booster_fuelleak', name: 'Fuel Leak', type: 'GEAR', owner: 'booster', reach: 'single', cd: 3, text: 'Hits for 60% ATK. Root 1. Sets a Clamp (10% max HP).',
  run(c) { c.hit(c.tgt, { atk: 0.6 }); c.st(c.tgt, 'root', 1); summon(c.b, c.u, 'booster_chomper', { hp: 0.1 }); } });
defMove({ id: 'booster_downrange', name: 'Long Burn', type: 'GEAR', owner: 'booster', reach: 'single', tags: ['projectile'], cd: 6, nerve: 4, text: 'Hits for 100% ATK + 25% foe missing HP. Each reserve takes 40% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.0, tgtMiss: 0.25 }); for (const r of reserves(c.them)) c.hit(r, { atk: 1.0 }, { reserve: true, spread: true, mult: 0.4 }); } });

// dish: a fallen dish that pings back, feeds back on cooldowns, says a foe's last move back, and hails it loud.
defMark({ id: 'dish_lift', name: 'deafened', clock: 'own', negative: true, value: -0.2,
  expire(b, f, mk) { const by = markedBy(b, mk); msg(b, `The noise knocks ${label(b, f)} flat.`); if (by) splash(b, by, stat(b, by, 'mgk') * 0.6, 'M', 'STAR'); } });
defPassive({ id: 'dish_gain', name: 'Turned Up', owner: 'dish', text: 'Its moves deal 1.1x. A move it repeats with Say It Back deals 1.25x.',
  outMul(b, f, t, d) { return d.move ? (f.k.saying ? 1.25 : 1.1) : 1; } });
defPassive({ id: 'dish_nullsteer', name: 'Ear Out', owner: 'dish', text: 'Hears every move a foe uses. Takes 0.85x magic damage.',
  anyMove(b, f, user, m) { if (m && user.side !== f.side) f.k.heard = moveIdx(m.id); },
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.85 : 1; } });
defMove({ id: 'dish_downlink', name: 'Ping Back', type: 'STAR', owner: 'dish', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 70% MGK. Weaken 1. First reserve takes 40% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'weaken', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.7 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'dish_sidelobe', name: 'Feedback', type: 'STAR', owner: 'dish', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 60% MGK. The foe\'s cooldowns go up 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.cd = c.tgt.cd.map(x => x + 1); } });
defMove({ id: 'dish_intercept', name: 'Say It Back', type: 'STAR', owner: 'dish', reach: 'single', tags: ['spell'], cd: 3, text: 'Uses the last move a foe used, at 0.8x power.',
  run(c) {
    const m = moveAt(c.u.k.heard || 0);
    if (!m || m.id === c.move.id) { c.hit(c.tgt, { mgk: 0.8 }); return; }
    c.msg(`${label(c.b, c.u)} says ${m.name} back.`);
    c.u.k.saying = 1;
    borrow(c, m, 0.8);
    c.u.k.saying = 0;
  } });
defMove({ id: 'dish_uplift', name: 'Loud Hail', type: 'STAR', owner: 'dish', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 55% MGK. Stun 2. When it ends: 60% MGK to every foe.',
  run(c) { c.hit(c.tgt, { mgk: 0.55 }); if (c.st(c.tgt, 'stun', 2)) c.mark(c.tgt, 'dish_lift', 1, 2); } });

// debris: fused hull scrap that heats with every move, throws sparks, hooks, plates itself, and makes a low pass.
const heat = (f: Fighter) => f.k.heat || 0;
function addHeat(b: Battle, f: Fighter, n: number): void {
  f.k.heat = Math.min(100, heat(f) + n);
  if (f.k.heat >= 100) { f.k.heat = 0; f.k.over = 2; msg(b, `${label(b, f)} overheats.`); applyStatus(b, f, f, 'silence', 1); }
}
defMark({ id: 'debris_strafe', name: 'passing low', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.45, 'P', 'STONE'); const t = foe(b, f); if (t) { applyStatus(b, f, t, 'burn', 1, stat(b, f, 'atk') * 0.2); applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'debris_hot', name: 'Burning Up', owner: 'debris', text: 'Loses 10 Heat each turn. At 50+ Heat: its moves deal 1.25x. At 100: Heat resets, Silence 1 on itself, and its next 2 attacks also hit for 50% MGK.',
  outMul(b, f, t, d) { return d.move && heat(f) >= 50 ? 1.25 : 1; },
  afterAttack(b, f, t) { if (f.k.over && !t.ko && !t.gone) { f.k.over--; strike(b, f, t, stat(b, f, 'mgk') * 0.5, 'M', 'STONE'); } },
  turnStart(b, f) { f.k.heat = Math.max(0, heat(f) - 10); } });
defPassive({ id: 'debris_fins', name: 'Heat Sink', owner: 'debris', text: 'Takes 0.85x damage at 50 Heat or more.',
  inMul(b, f) { return heat(f) >= 50 ? 0.85 : 1; } });
defMove({ id: 'debris_swarf', name: 'Hot Sparks', type: 'STONE', owner: 'debris', reach: 'spread', cd: 1, text: 'Hits every foe for 68% ATK. Burn 1 (20% ATK each turn). 25 Heat.',
  run(c) { c.spread({ atk: 0.68 }); c.st(c.tgt, 'burn', 1, stat(c.b, c.u, 'atk') * 0.2); addHeat(c.b, c.u, 25); } });
defMove({ id: 'debris_harpoon', name: 'Hull Hook', type: 'STONE', owner: 'debris', reach: 'single', cd: 2, text: 'Hits for 100% ATK. Slow 2. 25 Heat.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }); c.st(c.tgt, 'slow', 2); addHeat(c.b, c.u, 25); } });
defMove({ id: 'debris_plating', name: 'Scrap Plate', type: 'STONE', owner: 'debris', reach: 'self', cd: 3, wt: 60, text: 'Shield of 16% of its max HP, 2 turns. 25 Heat.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.16, 2); addHeat(c.b, c.u, 25); } });
defMove({ id: 'debris_strafe', name: 'Low Pass', type: 'STONE', owner: 'debris', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, text: 'Hits every foe for 70% ATK. At its next 2 turns: every foe takes 45% ATK, Burn 1, Slow 1.',
  run(c) { c.spread({ atk: 0.7 }); c.mark(c.u, 'debris_strafe', 1, 2); } });

// ================================================================ tundra and ice shelf

// musk: a musk ox that frosts what it hits, keeps a wool shield, lowers its head, sweeps its horns, and rings the herd round a foe.
defMark({ id: 'musk_frost', name: 'frost', max: 4, clock: 'own', negative: true, volatile: true, value: -0.05 });
defPassive({ id: 'musk_coat', name: 'Winter Wool', owner: 'musk', text: 'Hits add Frost, max 4. Starts with a 10% shield, regrown after 2 unhit turns.',
  start(b, f) { giveShield(b, f, f, f.maxHp * 0.1, 99); },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side && !t.ko) mark(b, f, t, 'musk_frost', 1, 3); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.unhit = 0; },
  turnStart(b, f) { f.k.unhit = (f.k.unhit || 0) + 1; if (f.k.unhit >= 3 && f.shield < f.maxHp * 0.1) { giveShield(b, f, f, f.maxHp * 0.1 - f.shield, 99); f.k.unhit = 0; } } });
defPassive({ id: 'musk_wall', name: 'Thick Wool', owner: 'musk', text: 'Takes 0.85x damage while it has a shield.',
  inMul(b, f) { return f.shield > 0 ? 0.85 : 1; } });
defMove({ id: 'musk_bowl', name: 'Head Down', type: 'BEAST', owner: 'musk', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 104% ATK. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { atk: 1.04 }); c.delay(c.tgt, 20); } });
defMove({ id: 'musk_sweep', name: 'Boss Sweep', type: 'BEAST', owner: 'musk', reach: 'spread', cd: 2, text: 'Hits every foe for 68% ATK. Slow 1. 1 more Frost.',
  run(c) { c.spread({ atk: 0.68 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'musk_frost', 1, 3); } });
defMove({ id: 'musk_hardfreeze', name: 'Frozen Stiff', type: 'BEAST', owner: 'musk', reach: 'single', cd: 3, text: 'At 3 Frost: spends it, 110% ATK, Stun 1. Else: 80% ATK, 1 Frost.',
  run(c) {
    const full = c.marked(c.tgt, 'musk_frost') >= 3;
    c.hit(c.tgt, { atk: full ? 1.1 : 0.8 });
    if (c.tgt.ko) return;
    if (full) { unmark(c.tgt, 'musk_frost'); c.st(c.tgt, 'stun', 1); } else c.mark(c.tgt, 'musk_frost', 1, 3);
  } });
defMove({ id: 'musk_corral', name: 'Ring the Herd', type: 'BEAST', owner: 'musk', reach: 'spread', cd: 6, nerve: 5, text: 'Hits every foe for 104% ATK. Stun 1, 2 at 3 Frost. Reserves: Slow 1.',
  run(c) {
    const full = c.marked(c.tgt, 'musk_frost') >= 3;
    c.spread({ atk: 1.04 });
    c.st(c.tgt, 'stun', full ? 2 : 1);
    for (const r of reserves(c.them)) c.st(r, 'slow', 1);
  } });

// serac: a glacier block that spalls, lays glare ice, freezes a foe's boots, and shatters what is nearly gone.
defMark({ id: 'serac_vortex', name: 'on glare ice', clock: 'own', negative: true, volatile: true, value: -0.08,
  inMul(b, f, src, d) { return d.kind === 'M' ? 1.15 : 1; } });
defMark({ id: 'serac_feet', name: 'frozen boots', clock: 'own', negative: true, volatile: true, value: -0.15,
  expire(b, f, mk) { msg(b, `${label(b, f)} freezes to the spot.`); applyStatus(b, markedBy(b, mk), f, 'stun', 1); } });
defPassive({ id: 'serac_shatter', name: 'Shatters', owner: 'serac', text: 'A foe it hits that drops below 12% HP is KO\'d.',
  afterDeal(b, f, t, dealt, d) { if (d.reserve || d.dot || t.ko || t.side === f.side || !under(t, 0.12)) return; msg(b, `${label(b, t)} shatters.`); dealDamage(b, f, t, t.hp + t.shield + 1, dot('T'), null); } });
defPassive({ id: 'serac_deepcold', name: 'Freezer Burn', owner: 'serac', text: 'Foes it hits get Rot 2.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'rot', 2); } });
defMove({ id: 'serac_spall', name: 'Ice Spall', type: 'TIDE', owner: 'serac', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 134% MGK. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.34 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'serac_icefloor', name: 'Glare Ice', type: 'TIDE', owner: 'serac', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 70% MGK. Slow 2. For 3 turns: the foe takes 1.15x magic damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'slow', 2); c.mark(c.tgt, 'serac_vortex', 1, 3); } });
defMove({ id: 'serac_spindrift', name: 'Frozen Boots', type: 'TIDE', owner: 'serac', reach: 'single', tags: ['spell'], cd: 4, text: 'Hits for 70% MGK. If the foe is still out after 2 turns: Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); if (!c.tgt.ko) c.mark(c.tgt, 'serac_feet', 1, 2); } });
defMove({ id: 'serac_icefall', name: 'Calving Face', type: 'TIDE', owner: 'serac', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 60, text: 'Wind-up. Hits every foe for 140% MGK. Rot 3. If the foe is left below 15% HP: it is KO\'d.',
  run(c) { c.spread({ mgk: 1.4 }); c.st(c.tgt, 'rot', 3); if (!c.tgt.ko && under(c.tgt, 0.15)) { c.msg(`${label(c.b, c.tgt)} shatters.`); c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); } } });

// selkie: a sealskin that hurts and mends, blows a sleeping bubble, blesses a friend's blows, and calls the seventh wave.
defMark({ id: 'selkie_gift', name: 'blessed', clock: 'own', value: 0.1,
  afterAttack(b, f, t) { const mk = f.m.selkie_gift; const by = mk ? markedBy(b, mk) : null; if (!by || t.ko || t.gone) return; strike(b, by, t, stat(b, by, 'mgk') * 0.3, 'M', 'TIDE'); if (!t.ko) applyStatus(b, by, t, 'slow', 1); } });
defPassive({ id: 'selkie_lull', name: 'Sleepy Sea', owner: 'selkie', text: 'When it heals an out ally: that ally\'s next turn comes 20% sooner.',
  afterHeal(b, f, t, amt) { if (amt > 0 && t !== f && isOut(b, t)) hastenFighter(b, t, 20); } });
defPassive({ id: 'selkie_sealegs', name: 'Sea Born', owner: 'selkie', text: 'Its heals are 1.25x on allies below 50% HP.',
  healMul(b, f, t) { return under(t, 0.5) ? 1.25 : 1; } });
defMove({ id: 'selkie_backwash', name: 'Undertow Mend', type: 'TIDE', owner: 'selkie', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 108% MGK. Your lowest-HP whorl heals 35% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.08 }); c.heal(lowestAlly(c), d * 0.35); } });
defMove({ id: 'selkie_bubble', name: 'Air Bubble', type: 'TIDE', owner: 'selkie', reach: 'single', cd: 4, wu: 50, text: 'Wind-up. Sleep 2. Damage wakes the foe.',
  run(c) { c.st(c.tgt, 'sleep', 2); } });
defMove({ id: 'selkie_gift', name: 'Seal Blessing', type: 'TIDE', owner: 'selkie', reach: 'ally', cd: 3, text: 'An ally heals 8% of max HP. 3 turns: its attacks add 30% MGK, Slow 1.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.08); c.mark(c.ally!, 'selkie_gift', 1, 3); } });
defMove({ id: 'selkie_seventh', name: 'Seven Waves', type: 'TIDE', owner: 'selkie', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 115% MGK. Stun 1. Slow 2.',
  run(c) { c.spread({ mgk: 1.15 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'slow', 2); } });

// walrus: a walrus whose third blow lands double, slaps with a flipper, rolls in with the herd, shoves ice, and brings its tusks down.
defMark({ id: 'walrus_tag', name: 'slapping', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'atk') * 0.3 : 0; },
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'walrus_thirdblow', name: 'Third Tusk', owner: 'walrus', text: 'Every 3rd attack deals 2x damage.',
  outMul(b, f, t, d) { return d.attack && (f.k.punches || 0) % 3 === 2 ? 2 : 1; },
  afterAttack(b, f) { f.k.punches = (f.k.punches || 0) + 1; } });
defPassive({ id: 'walrus_pileon', name: 'Haul Out', owner: 'walrus', text: 'In reserve: your out whorl\'s attacks deal 1.1x.',
  auraOut(b, f, o, t, d) { return d.attack ? 1.1 : 1; } });
defMove({ id: 'walrus_flipper', name: 'Flipper Slap', type: 'TIDE', owner: 'walrus', reach: 'self', cd: 2, wt: 50, text: 'For 2 turns its attacks add 30% ATK and Slow 1.',
  run(c) { c.mark(c.u, 'walrus_tag', 1, 2); } });
defMove({ id: 'walrus_snowball', name: 'Herd Roll', type: 'TIDE', owner: 'walrus', reach: 'single', tags: ['dash'], cd: 3, wu: 50, text: 'Wind-up. Hits for 90% ATK, +15% per other ally standing. Stun 1.',
  run(c) { const n = standing(c.me).length; c.hit(c.tgt, { atk: 0.9 }, { mult: 1 + 0.15 * (n - 1) }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'walrus_shardwall', name: 'Ice Shove', type: 'TIDE', owner: 'walrus', reach: 'spread', cd: 3, text: 'Hits every foe for 70% ATK. Root 2.',
  run(c) { c.spread({ atk: 0.7 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'walrus_haymaker', name: 'Tusk Down', type: 'TIDE', owner: 'walrus', reach: 'single', cd: 6, nerve: 4, text: 'Hits for 200% ATK. Stun 1. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 2.0 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'slow', 2); } });

// berg: an iceberg that cuts below the line, scrapes DEF off, groans, calves bits, and rolls under.
defMark({ id: 'berg_split', name: 'rolling under', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) {
    unmark(f, 'berg_split');
    msg(b, 'The berg rolls over.');
    const them = b.s[1 - f.side];
    for (const e of standing(them)) {
      const out = e.idx === them.out;
      dealDamage(b, f, e, e.maxHp * (out ? 0.22 : 0.08), { kind: 'T', move: null, attack: false, dot: false, spread: true, reserve: !out }, null);
    }
  } });
defPassive({ id: 'berg_undercut', name: 'Below the Line', owner: 'berg', text: 'Its hits ignore 25% of the foe\'s DEF and RES.',
  outMul(b, f, t, d) { if (d.kind === 'T') return 1; const a = stat(b, t, d.kind === 'P' ? 'def' : 'res'); return (100 + a) / (100 + a * 0.75); } });
defPassive({ id: 'berg_keel', name: 'Mostly Under', owner: 'berg', text: 'Takes 0.85x damage from attacks.',
  inMul(b, f, src, d) { return d.attack ? 0.85 : 1; } });
defMove({ id: 'berg_bit', name: 'Scrape Hull', type: 'TIDE', owner: 'berg', reach: 'single', cd: 1, text: 'Hits for 97% ATK. The foe loses 4 DEF for the battle, up to 20.',
  run(c) { c.hit(c.tgt, { atk: 0.97 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.defLoss = Math.min(20, (c.tgt.k.defLoss || 0) + 4); } });
defMove({ id: 'berg_groan', name: 'Ice Groan', type: 'TIDE', owner: 'berg', reach: 'spread', cd: 4, wu: 50, text: 'Wind-up. Hits every foe for 84% ATK. Sleep 1.',
  run(c) { c.spread({ atk: 0.84 }); c.st(c.tgt, 'sleep', 1); } });
defMove({ id: 'berg_growler', name: 'Calved Bit', type: 'TIDE', owner: 'berg', reach: 'spread', cd: 3, text: 'Hits every foe for 55% ATK. Empower 1, +1 for each foe standing past the 2nd.',
  run(c) { c.spread({ atk: 0.55 }); c.st(c.u, 'empower', Math.max(1, standing(c.them).length - 1)); } });
defMove({ id: 'berg_capsize', name: 'Roll Under', type: 'TIDE', owner: 'berg', reach: 'spread', cd: 6, nerve: 5, text: 'Hits for 46% ATK. At its next turn: the foe loses 22% of its max HP, and each reserve 8%.',
  run(c) { c.hit(c.tgt, { atk: 0.46 }); c.mark(c.u, 'berg_split', 1, 2); } });

// narwhal: a narwhal that shoots star shards, breaches, dives with the pod, and lines its tusk up a long time.
defPassive({ id: 'narwhal_sighting', name: 'Under Watch', owner: 'narwhal', text: 'Deals 1.2x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return t.outAt > (f.k.prevTurn ?? -1) ? 1.2 : 1; } });
defPassive({ id: 'narwhal_ivory', name: 'Ivory Point', owner: 'narwhal', text: 'Its Stuns also add Expose 2.',
  afterApply(b, f, t, id) { if (id === 'stun' && t.side !== f.side) applyStatus(b, f, t, 'expose', 2); } });
defMove({ id: 'narwhal_lance', name: 'Shard Fall', type: 'TIDE', owner: 'narwhal', reach: 'spread', tags: ['projectile'], cd: 1, text: 'Hits every foe for 50% ATK, then the foe for 25% ATK.',
  run(c) { c.spread({ atk: 0.5 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.25 }); } });
defMove({ id: 'narwhal_breach', name: 'Breach', type: 'TIDE', owner: 'narwhal', reach: 'single', tags: ['dash'], cd: 2, text: 'Hits for 75% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); c.hasten(c.u, 30); } });
defMove({ id: 'narwhal_podrush', name: 'Pod Dive', type: 'TIDE', owner: 'narwhal', reach: 'reserveAlly', cd: 4, tag: true, text: 'Haste 1 on your team. Switches to an ally. Its first turn comes 30% sooner.',
  run(c) { for (const a of standing(c.me)) c.st(a, 'haste', 1); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 30; } });
defMove({ id: 'narwhal_hornshot', name: 'Tusk Line', type: 'TIDE', owner: 'narwhal', reach: 'single', tags: ['projectile'], cd: 6, nerve: 5, wu: 100, text: 'Long wind-up. Hits for 124% ATK. Stun 2.',
  run(c) { c.hit(c.tgt, { atk: 1.24 }); c.st(c.tgt, 'stun', 2); } });

// rime: hoarfrost that flowers frost, bites, cools a friend's cooldowns, and keeps a hoar night over the field.
defMark({ id: 'rime_field', name: 'hoar night', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.5, 'M', 'ROOT'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 1); },
  afterGet(b, f, src, id) { if (id === 'stun' || id === 'silence' || id === 'sleep') { unmark(f, 'rime_field'); msg(b, 'The field breaks.'); } },
  inMul(b, f) { return has(f, 'rime_cracked') ? 0.8 : 1; } });
defPassive({ id: 'rime_clearair', name: 'Cold Air', owner: 'rime', text: 'In reserve: every 3rd turn your side takes, 1 tide.',
  reserveTurn(b, f) { f.k.air = (f.k.air || 0) + 1; if (f.k.air % 3 === 0) addNerve(b, f.side, 1); } });
defPassive({ id: 'rime_cracked', name: 'Loved', owner: 'rime', text: 'While Kind Winter runs: takes 0.8x damage.' });
defMove({ id: 'rime_petal', name: 'Frost Flower', type: 'ROOT', owner: 'rime', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 73% MGK. Slow 1.',
  run(c) { c.spread({ mgk: 0.73 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'rime_grip', name: 'Frost Bitten', type: 'ROOT', owner: 'rime', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 64% MGK. Root 2. Burn 2 (30% MGK each turn).',
  run(c) { c.hit(c.tgt, { mgk: 0.64 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'mgk') * 0.3); } });
defMove({ id: 'rime_bloom', name: 'Chilly Kiss', type: 'ROOT', owner: 'rime', reach: 'ally', cd: 4, text: 'An ally\'s cooldowns drop 1, except its crest. 1 tide.',
  run(c) { const a = c.ally!; a.moves.forEach((id, i) => { if (!MOVES[id]?.nerve) a.cd[i] = Math.max(0, a.cd[i] - 1); }); c.nerve(c.me, 1); } });
defMove({ id: 'rime_field', name: 'Kind Winter', type: 'ROOT', owner: 'rime', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 64% MGK. At its next 3 turns: every foe takes 50% MGK, Slow 1. A Stun, Silence, or Sleep on it ends this.',
  run(c) { c.spread({ mgk: 0.64 }); c.mark(c.u, 'rime_field', 1, 3); } });

// auk: a great auk that slaps, crash-lands for a shield, slides on its belly, and slides on through everything.
defMark({ id: 'auk_roll', name: 'sliding', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; msg(b, `${label(b, f)} slides on.`); splash(b, f, stat(b, f, 'atk') * 0.7, 'P', 'BEAST'); } });
defPassive({ id: 'auk_ricochet', name: 'Lucky Bird', owner: 'auk', text: 'Every 3rd attack: Weaken 1, Slow 1.',
  afterAttack(b, f, t) { f.k.luck = (f.k.luck || 0) + 1; if (f.k.luck % 3 === 0 && !t.ko && !t.gone) { applyStatus(b, f, t, 'weaken', 1); applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'auk_lastpair', name: 'Last of Them', owner: 'auk', text: 'Takes 0.85x damage while Unstoppable or shielded.',
  inMul(b, f) { return f.s.unstop || f.shield > 0 ? 0.85 : 1; } });
defMove({ id: 'auk_flurry', name: 'Wing Slaps', type: 'BEAST', owner: 'auk', reach: 'single', cd: 1, text: 'Hits 4 times for 18% ATK.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.18 }); } });
defMove({ id: 'auk_carom', name: 'Crash Landing', type: 'BEAST', owner: 'auk', reach: 'spread', cd: 3, text: 'Hits every foe for 39% ATK. Shield of 6% max HP per foe standing.',
  run(c) { c.spread({ atk: 0.39 }); c.shield(c.u, c.u.maxHp * 0.06 * standing(c.them).length, 3); } });
defMove({ id: 'auk_bellyflop', name: 'Belly Slide', type: 'BEAST', owner: 'auk', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 58% ATK. Weaken 1. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.58 }); c.st(c.tgt, 'weaken', 1); c.hasten(c.u, 25); } });
defMove({ id: 'auk_toboggan', name: 'Ice Slide', type: 'BEAST', owner: 'auk', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Unstoppable 2. Hits for 67% ATK. Stun 1. At its next 2 turns: every foe takes 70% ATK.',
  run(c) { c.st(c.u, 'unstop', 2); c.hit(c.tgt, { atk: 0.67 }); c.st(c.tgt, 'stun', 1); c.mark(c.u, 'auk_roll', 1, 2); } });

// cuirass: a breastplate that hardens with every dent, whirls its straps, lashes in on its mail, takes dents on purpose, and bites with its edge.
defMark({ id: 'cuirass_dent', name: 'dents', max: 8, value: 0.05 });
defMark({ id: 'cuirass_saw', name: 'edge biting', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; strike(b, f, t, stat(b, f, 'atk') * 0.45, 'P', 'GEAR'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'cuirass_dented', name: 'Dented Hard', owner: 'cuirass', text: 'When hit: a Dent, up to 8. Each cuts damage by 3%. Turn start: one fades.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) mark(b, f, f, 'cuirass_dent', 1); },
  inMul(b, f) { return 1 - 0.03 * marked(f, 'cuirass_dent'); },
  turnStart(b, f) { shed(f, 'cuirass_dent', 1); } });
defPassive({ id: 'cuirass_riveted', name: 'Rivet Heads', owner: 'cuirass', text: 'Its moves add 15% DEF as true damage.',
  afterDeal(b, f, t, dealt, d) { if (!d.move || d.reserve || t.ko || f.k.riveting) return; f.k.riveting = 1; strike(b, f, t, stat(b, f, 'def') * 0.15, 'T', null); f.k.riveting = 0; } });
defMove({ id: 'cuirass_rivet', name: 'Strap Whirl', type: 'GEAR', owner: 'cuirass', reach: 'spread', cd: 1, text: 'Hits every foe for 71% ATK. Weaken 1.',
  run(c) { c.spread({ atk: 0.71 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'cuirass_platespin', name: 'Mail Lash', type: 'GEAR', owner: 'cuirass', reach: 'single', cd: 2, text: 'Hits for 102% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.02 }); c.hasten(c.u, 30); } });
defMove({ id: 'cuirass_burnish', name: 'Take Dents', type: 'GEAR', owner: 'cuirass', reach: 'self', cd: 4, wt: 60, text: 'Gains 4 Dents. Heals 8% of its max HP.',
  run(c) { c.mark(c.u, 'cuirass_dent', 4); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'cuirass_hammerout', name: 'Saw Edge', type: 'GEAR', owner: 'cuirass', reach: 'single', cd: 6, nerve: 4, text: 'Hits for 128% ATK. At its next 3 turns: hits the foe for 45% ATK, Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.28 }); c.mark(c.u, 'cuirass_saw', 1, 3); } });

// ================================================================ hilt road and battlefield

// pennon: a banner that cracks in the wind, ropes a foe down, plants its pole for a friend, and snaps out to make the next move bigger.
defMark({ id: 'pennon_tether', name: 'roped', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The rope on ${label(b, f)} snaps tight.`); strike(b, by, f, stat(b, by, 'mgk') * 0.5, 'M', 'STAR'); if (!f.ko) applyStatus(b, by, f, 'root', 2); } });
defMark({ id: 'pennon_chant', name: 'snapped', clock: 'own', volatile: true, value: 0.12 });
const chanted = (c: Ctx): boolean => { if (!marked(c.u, 'pennon_chant')) return false; unmark(c.u, 'pennon_chant'); return true; };
defPassive({ id: 'pennon_windcatch', name: 'Catches Wind', owner: 'pennon', text: 'When it hits a foe: Snap Out\'s cooldown drops 1.',
  afterDeal(b, f, t, dealt, d) { if (d.reserve || d.dot || t.side === f.side) return; const i = f.moves.indexOf('pennon_unfurl'); if (i >= 0) f.cd[i] = Math.max(0, f.cd[i] - 1); } });
defPassive({ id: 'pennon_rallying', name: 'Colors', owner: 'pennon', text: 'Allies it shields also get Empower 1.' });
defMove({ id: 'pennon_snap', name: 'Wind Crack', type: 'STAR', owner: 'pennon', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 68% MGK. Snapped: 130% MGK, Slow 2.',
  run(c) { const ch = chanted(c); c.spread({ mgk: ch ? 1.3 : 0.68 }); if (ch) c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'pennon_rally', name: 'Guy Rope', type: 'STAR', owner: 'pennon', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 83% MGK. After the foe\'s next turn: it takes 50% MGK. Root 2. Snapped: heals 15% of its max HP.',
  run(c) { const ch = chanted(c); c.hit(c.tgt, { mgk: 0.83 }); if (!c.tgt.ko) c.mark(c.tgt, 'pennon_tether', 1, 1); if (ch) c.heal(c.u, c.u.maxHp * 0.15); } });
defMove({ id: 'pennon_plant', name: 'Plant Pole', type: 'STAR', owner: 'pennon', reach: 'ally', cd: 3, text: 'Shields an ally 14% max HP. Haste 1. Snapped: your whole team.',
  run(c) {
    const ch = chanted(c);
    for (const a of ch ? standing(c.me) : [c.ally!]) {
      c.shield(a, a.maxHp * 0.14, 3); c.st(a, 'haste', 1);
      if (has(c.u, 'pennon_rallying')) c.st(a, 'empower', 1);
    }
  } });
defMove({ id: 'pennon_unfurl', name: 'Snap Out', type: 'STAR', owner: 'pennon', reach: 'self', cd: 5, nerve: 3, wt: 40, text: 'Its next move is Snapped. Heals 6% of its max HP.',
  run(c) { c.mark(c.u, 'pennon_chant', 1, 2); c.heal(c.u, c.u.maxHp * 0.06); } });

// tang: a sword tang that crits every third swing, spins through magic, sets a whetstone, and cuts a thousand times.
defSummon({ id: 'tang_ward', name: 'Whetstone', owner: 'tang', text: 'Each turn: your out whorl heals 10% of its max HP.', every: 100,
  sprite: { px: ['........', '..2222..', '.222222.', '22233222', '22311322', '.222222.', '..2222..', '.4.44.4.'], c: ['#9d9da5', '#63f383', '#705037'] },
  act(b, s) { const o = b.s[s.side].f[b.s[s.side].out]; if (o && !o.ko) heal(b, ownerOf(b, s), o, o.maxHp * 0.1); } });
defMark({ id: 'tang_spin', name: 'spinning', clock: 'own', volatile: true, value: 0.15,
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.2 : 1; },
  statusImmune(f, id) { return has(f, 'tang_twostep') && (id === 'stun' || id === 'silence'); },
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.5, 'P', 'GEAR'); } });
defPassive({ id: 'tang_edgeguard', name: 'Keen Edge', owner: 'tang', text: 'Every 3rd attack: 1.3x damage, heals 15% of it.',
  outMul(b, f, t, d) { return d.attack && (f.k.dance || 0) % 3 === 2 ? 1.3 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.attack && (f.k.dance || 0) % 3 === 2) heal(b, f, f, dealt * 0.15); },
  afterAttack(b, f) { f.k.dance = (f.k.dance || 0) + 1; } });
defPassive({ id: 'tang_twostep', name: 'Spin Through', owner: 'tang', text: 'While spinning: immune to Stun and Silence.' });
defMove({ id: 'tang_chip', name: 'Pommel Chip', type: 'GEAR', owner: 'tang', reach: 'single', cd: 1, text: 'Hits for 59% ATK. Its next turn comes 10% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.59 }); c.hasten(c.u, 10); } });
defMove({ id: 'tang_spin', name: 'Grip Spin', type: 'GEAR', owner: 'tang', reach: 'spread', cd: 4, text: 'Hits every foe for 29% ATK. For 2 turns: takes 0.2x magic damage, and at each of its turns every foe takes 50% ATK.',
  run(c) { c.spread({ atk: 0.29 }); c.mark(c.u, 'tang_spin', 1, 2); } });
defMove({ id: 'tang_scabbard', name: 'Set Whetstone', type: 'GEAR', owner: 'tang', reach: 'side', cd: 4, text: 'Summons a Whetstone (10% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'tang_ward', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'tang_cuts', name: 'Thousand Cuts', type: 'GEAR', owner: 'tang', reach: 'single', cd: 6, nerve: 5, text: 'Untouchable 1. Hits 6 times for 14% ATK, every 3rd on a reserve.',
  run(c) {
    c.st(c.u, 'invuln', 1);
    const rs = reserves(c.them);
    for (let i = 0; i < 6; i++) {
      const t = i % 3 === 2 && rs.length ? rs[(i / 3) % rs.length | 0] : c.tgt;
      if (t.ko) continue;
      c.hit(t, { atk: 0.14 }, t === c.tgt ? {} : { reserve: true });
    }
  } });

// buckler: a round shield that throws its rim, bashes, raises its rim against attacks, and falls on the line from above.
defMark({ id: 'buckler_aegis', name: 'rim raised', clock: 'own', volatile: true, value: 0.15,
  beforeTake(b, f, src, amt, d) {
    if (!d.attack || !src || src.side === f.side) return amt;
    if (has(f, 'buckler_riposte') && !src.ko) strike(b, f, src, stat(b, f, 'atk') * 0.4, 'P', 'GEAR');
    return 0;
  },
  turnStart(b, f) { unmark(f, 'buckler_aegis'); msg(b, `${label(b, f)} drives the shield out.`); splash(b, f, stat(b, f, 'atk') * 0.8, 'P', 'GEAR'); } });
defPassive({ id: 'buckler_umbo', name: 'Fourth Blow', owner: 'buckler', text: 'Every 4th move deals 1.5x damage.',
  outMul(b, f, t, d) { return d.move && (f.k.will || 0) % 4 === 3 ? 1.5 : 1; },
  afterMove(b, f) { f.k.will = (f.k.will || 0) + 1; } });
defPassive({ id: 'buckler_riposte', name: 'Pay Back', owner: 'buckler', text: 'Each attack Raise the Rim stops is answered for 40% ATK.' });
defMove({ id: 'buckler_rim', name: 'Rim Throw', type: 'GEAR', owner: 'buckler', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 120% ATK. 1.5x on a foe below 25% HP.',
  run(c) { c.hit(c.tgt, { atk: 1.2 }, { mult: under(c.tgt, 0.25) ? 1.5 : 1 }); } });
defMove({ id: 'buckler_vault', name: 'Shield Bash', type: 'GEAR', owner: 'buckler', reach: 'single', tags: ['dash'], cd: 4, text: 'Hits for 99% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 0.99 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'buckler_parry', name: 'Raise the Rim', type: 'GEAR', owner: 'buckler', reach: 'self', cd: 4, wt: 60, text: 'Attacks deal it 0 until its next turn. Then every foe takes 80% ATK.',
  run(c) { c.mark(c.u, 'buckler_aegis', 1, 2); } });
defMove({ id: 'buckler_fall', name: 'Falling Shield', type: 'GEAR', owner: 'buckler', reach: 'spread', cd: 6, nerve: 5, wu: 80, unstop: true,
  text: 'Unstoppable wind-up. Hits every foe for 157% ATK. Slow 2.',
  run(c) { c.spread({ atk: 1.57 }); c.st(c.tgt, 'slow', 2); } });

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
  turnStart(b, f) { const mk = unmark(f, 'destrier_line'); const by = mk ? markedBy(b, mk) : null; if (!by) return; msg(b, `The rope yanks ${label(b, f)}.`); strike(b, by, f, stat(b, by, 'atk') * 0.5, 'P', 'BEAST'); if (!f.ko) delayFighter(b, f, 30); } });
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
defMove({ id: 'destrier_rearup', name: 'Lead Rope', type: 'BEAST', owner: 'destrier', reach: 'single', cd: 1, text: 'Hits for 79% ATK. At the foe\'s next turn: it takes 50% ATK, and its turn after that is delayed by 30%.',
  run(c) { c.hit(c.tgt, { atk: 0.79 }); if (!c.tgt.ko) c.mark(c.tgt, 'destrier_line', 1, 2); } });
defMove({ id: 'destrier_couch', name: 'Spur On', type: 'BEAST', owner: 'destrier', reach: 'self', cd: 3, wt: 50, text: 'Its next 3 attacks come 25% sooner and add 3% of the foe\'s max HP.',
  run(c) { c.mark(c.u, 'destrier_frenzy', 3, 4); } });
defMove({ id: 'destrier_joust', name: 'Ride Through', type: 'BEAST', owner: 'destrier', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 88% ATK. In Barding: its cooldown resets, but not twice in a row.',
  run(c) { const m = mounted(c.b, c.u); c.hit(c.tgt, { atk: 0.88 }); if (m && !c.u.k.joustAgain) { c.u.k.joustAgain = 1; ready(c.u, 'destrier_joust'); } else c.u.k.joustAgain = 0; } });
defMove({ id: 'destrier_gallop', name: 'Full Gallop', type: 'BEAST', owner: 'destrier', reach: 'single', tags: ['dash'], cd: 6, nerve: 5,
  text: 'Barding again if it has none. Hits for 132% ATK. Forces the foe out.',
  run(c) { if (!mounted(c.b, c.u)) { c.u.k.mountLeft = 0; mountUp(c.b, c.u, 0.2); } c.hit(c.tgt, { atk: 1.32 }); if (!c.tgt.ko) c.forceOut(); } });

// mangonel: a catapult that lobs stones, flings a foe back into its line, slides rock, and winds its arm tighter.
defMark({ id: 'mangonel_grown', name: 'wound up', max: 2, value: 0.12,
  statBonus(f, k) { const n = f.m.mangonel_grown?.n || 0; if (k === 'atk' || k === 'def') return Math.round(f.st[k] * 0.15 * n); return k === 'agi' ? -6 * n : 0; } });
defPassive({ id: 'mangonel_cradle', name: 'Full Cradle', owner: 'mangonel', text: 'Every 4th attack: each foe reserve takes 50% ATK.',
  afterAttack(b, f) { f.k.grab = (f.k.grab || 0) + 1; if (f.k.grab % 4 === 0) for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.5, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'mangonel_creak', name: 'Creaking Arm', owner: 'mangonel', text: 'Every 3rd attack that hits it: Slow 2 on the attacker.',
  afterTake(b, f, src, dealt, d) { if (!d.attack || !src || src.side === f.side) return; f.k.crag = (f.k.crag || 0) + 1; if (f.k.crag % 3 === 0 && !src.ko) applyStatus(b, f, src, 'slow', 2); } });
defMove({ id: 'mangonel_lob', name: 'Loose Stones', type: 'STONE', owner: 'mangonel', reach: 'spread', tags: ['projectile'], cd: 1, text: 'Hits every foe for 58% ATK.',
  run(c) { c.spread({ atk: 0.58 }); } });
defMove({ id: 'mangonel_hurl', name: 'Fling Back', type: 'STONE', owner: 'mangonel', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 63% ATK. Forces the foe out. Each reserve takes 31% ATK.',
  run(c) {
    c.hit(c.tgt, { atk: 0.63 });
    if (c.tgt.ko || !c.forceOut()) return;
    for (const r of reserves(c.them)) c.hit(r, { atk: 0.31 }, { reserve: true });
  } });
defMove({ id: 'mangonel_payload', name: 'Rock Slide', type: 'STONE', owner: 'mangonel', reach: 'spread', tags: ['dash'], cd: 3, wu: 50, text: 'Wind-up. Hits every foe for 75% ATK. Stun 1.',
  run(c) { c.spread({ atk: 0.75 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'mangonel_ratchet', name: 'Wind Arm', type: 'STONE', owner: 'mangonel', reach: 'single', cd: 6, nerve: 4, text: 'Grows: +15% ATK and DEF, -6 AGI, max 2. Heals 10%. Hits for 94% ATK.',
  run(c) { c.mark(c.u, 'mangonel_grown', 1, -1); c.heal(c.u, c.u.maxHp * 0.1); c.hit(c.tgt, { atk: 0.94 }); } });

// sallet: a helmet that breathes through its visor, bashes with its plume, closes up, and lets its drake out.
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
defMove({ id: 'sallet_hotbreath', name: 'Visor Breath', type: 'STONE', owner: 'sallet', reach: 'spread', cd: 1, text: 'Hits every foe for 64% ATK. Weaken 1.',
  run(c) { c.spread({ atk: 0.64 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'sallet_drakefire', name: 'Drake Fire', type: 'STONE', owner: 'sallet', reach: 'spread', cd: 1, extra: true, text: 'Hits every foe for 80% ATK. Burn 2 on every foe (20% ATK each turn).',
  run(c) { c.spread({ atk: 0.8 }); for (const e of standing(c.them)) c.st(e, 'burn', 2, stat(c.b, c.u, 'atk') * 0.2); } });
defMove({ id: 'sallet_browbash', name: 'Plume Bash', type: 'STONE', owner: 'sallet', reach: 'single', cd: 4, text: 'Hits for 80% ATK. Stun 1. Expose 1.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'sallet_visor', name: 'Close Visor', type: 'STONE', owner: 'sallet', reach: 'self', cd: 3, wt: 60, text: 'Fortify 2. Regen 2.',
  run(c) { c.st(c.u, 'fortify', 2); c.st(c.u, 'regen', 2, 0.06); } });
defMove({ id: 'sallet_drake', name: 'Drake Day', type: 'STONE', owner: 'sallet', reach: 'self', cd: 7, nerve: 5, wt: 60,
  text: 'The drake for 3 turns: 1.2x ATK, 1.1x AGI, and Drake Fire.',
  run(c) { setForm(c.b, c.u, { tag: 'drake', sprite: SALLET_DRAKE, statMul: { atk: 1.2, agi: 1.1 } }, ['sallet_drakefire']); c.mark(c.u, 'sallet_drakeform', 1, 3); } });

// fletch: an arrow that never landed, frosting what it hits, double-nocking, loosing a sheaf, and drawing one long shot.
defMark({ id: 'fletch_focus', name: 'double nocked', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { if (!t.ko && !t.gone) strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'ROOT'); } });
defPassive({ id: 'fletch_rimed', name: 'High Frost', owner: 'fletch', text: 'Its attacks add Slow 1.',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'fletch_neverlanded', name: 'Never Landed', owner: 'fletch', text: 'Deals 1.2x damage to a Slowed foe.',
  outMul(b, f, t) { return t.s.slow ? 1.2 : 1; } });
defMove({ id: 'fletch_nock', name: 'Double Nock', type: 'ROOT', owner: 'fletch', reach: 'self', tags: ['projectile'], cd: 2, wt: 50, text: 'For 2 turns its attacks fire a second arrow for 50% ATK.',
  run(c) { c.mark(c.u, 'fletch_focus', 1, 2); } });
defMove({ id: 'fletch_sheaf', name: 'Sheaf Loose', type: 'ROOT', owner: 'fletch', reach: 'spread', tags: ['projectile'], cd: 2, text: 'Hits every foe for 92% ATK. Slow 2.',
  run(c) { c.spread({ atk: 0.92 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'fletch_overshoot', name: 'Sight Down', type: 'ROOT', owner: 'fletch', reach: 'spread', cd: 4, text: 'Expose 2 on every foe.',
  run(c) { for (const e of standing(c.them)) c.st(e, 'expose', 2); } });
defMove({ id: 'fletch_overdraw', name: 'Overdraw', type: 'ROOT', owner: 'fletch', reach: 'single', tags: ['projectile'], cd: 6, nerve: 4, wu: 70, text: 'Wind-up. Hits for 165% ATK. Stun 2. Reserves take 30% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 1.65 }); c.st(c.tgt, 'stun', 2); for (const r of reserves(c.them)) c.hit(r, { atk: 1.65 }, { reserve: true, spread: true, mult: 0.3 }); } });

// ================================================================ moonbed

// image: a kept reflection that flashes, ripples back, beams at the weak, and becomes the foe.
defMark({ id: 'image_bomb', name: 'rippling', clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = unmark(f, 'image_bomb'); const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'mgk') * 0.6, 'M', 'STAR'); } });
defMark({ id: 'image_copy', name: 'a reflection', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); msg(b, `${label(b, f)} is itself again.`); },
  leave(b, f) { unmark(f, 'image_copy'); clearForm(b, f); } });
defPassive({ id: 'image_afterimage', name: 'Glides In', owner: 'image', text: 'When it comes out: its first turn comes 25% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 25; } });
defPassive({ id: 'image_calm', name: 'Calm Surface', owner: 'image', text: 'Takes 0.8x damage from crests.',
  inMul(b, f, src, d) { return d.move?.nerve ? 0.8 : 1; } });
defMove({ id: 'image_glint', name: 'Mirror Flash', type: 'STAR', owner: 'image', reach: 'spread', tags: ['projectile', 'spell'], cd: 1, text: 'Hits every foe for 71% MGK.',
  run(c) { c.spread({ mgk: 0.71 }); } });
defMove({ id: 'image_invert', name: 'Ripple Back', type: 'STAR', owner: 'image', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 60% MGK. At the foe\'s next turn: 60% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); if (!c.tgt.ko) c.mark(c.tgt, 'image_bomb', 1, 2); } });
defMove({ id: 'image_lure', name: 'Glassy Beam', type: 'STAR', owner: 'image', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 60% MGK. 3x damage to a foe below 50% HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }, { mult: under(c.tgt, 0.5) ? 3 : 1 }); } });
defMove({ id: 'image_mirrortake', name: 'Reflect It', type: 'STAR', owner: 'image', reach: 'single', cd: 6, nerve: 4, wt: 60,
  text: 'Becomes the foe for 4 turns, every move ready.',
  run(c) { if (c.blocked(c.tgt)) return; takeOver(c.b, c.u, c.tgt, 'copy'); c.u.cd = c.u.cd.map(() => 0); c.mark(c.u, 'image_copy', 1, 4); c.msg(`${label(c.b, c.u)} is now ${label(c.b, c.tgt)}.`); } });

// skipper: a mudskipper that skips in, hops out of reach, barbs a foe to bleed, and brings up something big.
defMark({ id: 'skipper_hop', name: 'hopped up', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'skipper_hop'); msg(b, `${label(b, f)} comes down.`); splash(b, f, stat(b, f, 'atk') * 0.6, 'P', 'TIDE'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 2); } });
defMark({ id: 'skipper_fish', name: 'followed', clock: 'own', negative: true, value: -0.2,
  expire(b, f, mk) {
    const by = markedBy(b, mk);
    msg(b, 'Something big comes up out of the mud.');
    if (!by) return;
    const them = b.s[f.side];
    for (const e of standing(them)) {
      const out = e.idx === them.out;
      dealDamage(b, by, e, stat(b, by, 'atk') * (out ? 1.4 : 0.5), { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: !out }, 'TIDE');
    }
    if (isOut(b, f) && !f.ko) applyStatus(b, by, f, 'stun', 1);
  } });
defMark({ id: 'skipper_barb', name: 'barbed', clock: 'own', volatile: true, value: 0.06,
  afterAttack(b, f, t) { unmark(f, 'skipper_barb'); if (!t.ko && !t.gone) applyStatus(b, f, t, 'bleed', 3, t.maxHp * 0.02); } });
defPassive({ id: 'skipper_slick', name: 'Slippery', owner: 'skipper', text: 'Takes 0.85x damage from attacks. Immune to Root.',
  inMul(b, f, src, d) { return d.attack ? 0.85 : 1; },
  statusImmune(f, id) { return id === 'root'; } });
defPassive({ id: 'skipper_sharkwater', name: 'Blood in Mud', owner: 'skipper', text: 'Deals 1.15x damage to a Bleeding foe.',
  outMul(b, f, t) { return t.s.bleed ? 1.15 : 1; } });
defMove({ id: 'skipper_dart', name: 'Skip In', type: 'TIDE', owner: 'skipper', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 73% ATK. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.73 }); c.hasten(c.u, 20); } });
defMove({ id: 'skipper_hop', name: 'Mud Hop', type: 'TIDE', owner: 'skipper', reach: 'self', tags: ['dash'], cd: 4, wt: 60, text: 'Untouchable 1. At its next turn: hits every foe for 60% ATK. Slow 2.',
  run(c) { c.st(c.u, 'invuln', 1); c.mark(c.u, 'skipper_hop', 1, 2); } });
defMove({ id: 'skipper_barbfin', name: 'Barb Fin', type: 'TIDE', owner: 'skipper', reach: 'single', cd: 3, text: 'Hits for 61% ATK. Its next attack adds Bleed 3 (2% of the foe\'s max HP per stack each turn).',
  run(c) { c.hit(c.tgt, { atk: 0.61 }); c.mark(c.u, 'skipper_barb', 1, 3); } });
defMove({ id: 'skipper_chum', name: 'Something Big', type: 'TIDE', owner: 'skipper', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 29% ATK. Slow 2. After 2 of the foe\'s turns: it takes 140% ATK, each reserve 50% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 0.29 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'skipper_fish', 1, 2); } });

// silt: lakebed silt that stirs up, clouds a foe, opens a pit for whoever comes out, and lets the bottom open.
defSummon({ id: 'silt_pit', name: 'Mire Pit', owner: 'silt', text: 'Each foe that comes out: Root 2 and 40% of Liemus\'s MGK. 3 turns.', every: 100,
  sprite: { px: ['........', '........', '..2222..', '.244442.', '24433442', '24133142', '.222222.', '........'], c: ['#636171', '#9ce341', '#3d3b48'] },
  act() { /* the pit only waits */ },
  trap(b, s, who) { const by = ownerOf(b, s); applyStatus(b, by, who, 'root', 2); if (by) strike(b, by, who, stat(b, by, 'mgk') * 0.4, 'M', 'STONE'); return false; } });
defMark({ id: 'silt_storm', name: 'stirred up', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.35, 'M', 'STONE'); } });
defPassive({ id: 'silt_silting', name: 'Settling', owner: 'silt', text: 'Takes 0.9x damage from foes. When a foe is KO\'d while it is out: +8% damage.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) f.k.atrophy = (f.k.atrophy || 0) + 1; },
  outMul(b, f) { return 1 + 0.08 * (f.k.atrophy || 0); },
  auraIn() { return 1; },
  inMul(b, f, src) { return src && src.side !== f.side ? 0.9 : 1; } });
defPassive({ id: 'silt_lakebed', name: 'Soft Bottom', owner: 'silt', text: 'Takes 0.85x damage from a Rooted foe.',
  inMul(b, f, src) { return src && src.s.root ? 0.85 : 1; } });
defMove({ id: 'silt_sludge', name: 'Stir Up', type: 'STONE', owner: 'silt', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 44% MGK. At its next turn: 35% MGK to every foe.',
  run(c) { c.spread({ mgk: 0.44 }); c.mark(c.u, 'silt_storm', 1, 2); } });
defMove({ id: 'silt_cloud', name: 'Cloud Up', type: 'STONE', owner: 'silt', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 75% MGK. Weaken 2. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.tgt, 'weaken', 2); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'silt_mirepit', name: 'Sink Pit', type: 'STONE', owner: 'silt', reach: 'single', tags: ['spell'], cd: 5, text: 'Hits for 35% MGK. Root 2. Summons a Mire Pit (15% max HP, 3 turns).',
  run(c) { c.hit(c.tgt, { mgk: 0.35 }); c.st(c.tgt, 'root', 2); summon(c.b, c.u, 'silt_pit', { hp: 0.15, turns: 3 }); } });
defMove({ id: 'silt_sink', name: 'Bottom Opens', type: 'STONE', owner: 'silt', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 97% MGK. Root 2 on every foe. Slow 2.',
  run(c) { c.spread({ mgk: 0.97 }); for (const e of standing(c.them)) c.st(e, 'root', 2); c.st(c.tgt, 'slow', 2); } });

// spawn: a belly-mouthed frog that croaks, turns a foe into a frog, holds it with its tongue, and leaves biting tadpoles.
const FROG: SpriteData = { px: ['........', '........', '.22..22.', '21222212', '23242322', '222.2222', '.222222.', '22....22'], c: ['#5ba840', '#b73226', '#e9c937'] };
defMark({ id: 'spawn_frog', name: 'a frog', clock: 'own', volatile: true, negative: true, value: -0.3,
  forbid(b, f, what) { return what === 'attack' ? null : 'A frog cannot.'; },
  expire(b, f) { if (f.form?.tag === 'frog') clearForm(b, f); },
  leave(b, f) { unmark(f, 'spawn_frog'); if (f.form?.tag === 'frog') clearForm(b, f); } });
defMark({ id: 'spawn_shackle', name: 'tongue tied', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'spawn_shackle'); const t = foe(b, f); if (t) strike(b, f, t, stat(b, f, 'mgk') * 0.5, 'M', 'BEAST'); } });
defSummon({ id: 'spawn_ward', name: 'Tadpole', owner: 'spawn', sprite: { px: ['........', '.2....2.', '..2222..', '.212212.', '.233332.', '.223322.', '...44...', '...4....'], c: ['#434149', '#f5f1e9', '#696777'] }, text: 'Twice a turn: bites the foe for 30% of Ranaru\'s MGK.', every: 50,
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'mgk') * 0.3, 'M', 'BEAST'); } });
defPassive({ id: 'spawn_toadskin', name: 'Toad Skin', owner: 'spawn', text: 'Deals 1.3x damage to a foe that is a frog or Stunned.',
  outMul(b, f, t) { return marked(t, 'spawn_frog') || t.s.stun ? 1.3 : 1; } });
defPassive({ id: 'spawn_amphibian', name: 'Amphibian', owner: 'spawn', text: 'Takes 0.85x magic damage.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.85 : 1; } });
defMove({ id: 'spawn_flick', name: 'Belly Croak', type: 'BEAST', owner: 'spawn', reach: 'spread', tags: ['dash', 'spell'], cd: 1, text: 'Hits every foe for 96% MGK.',
  run(c) { c.spread({ mgk: 0.96 }); } });
defMove({ id: 'spawn_hex', name: 'Make a Frog', type: 'BEAST', owner: 'spawn', reach: 'single', tags: ['spell'], cd: 4, text: 'The foe is a frog for 1 turn: attacks only, 0.7x ATK and MGK.',
  run(c) {
    if (c.blocked(c.tgt) || c.tgt.s.unstop) return;
    if (!c.tgt.form) setForm(c.b, c.tgt, { tag: 'frog', sprite: FROG, statMul: { atk: 0.7, mgk: 0.7 } });
    mark(c.b, c.u, c.tgt, 'spawn_frog', 1, 1);
    c.msg(`${label(c.b, c.tgt)} is a frog.`);
  } });
defMove({ id: 'spawn_tongue', name: 'Sticky Tongue', type: 'BEAST', owner: 'spawn', reach: 'single', tags: ['spell', 'channel'], cd: 3, wt: 130, text: 'Hits for 65% MGK. Stun 1. At its next turn: hits for 50% MGK. Its next turn comes 30% later.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); c.st(c.tgt, 'stun', 1); c.mark(c.u, 'spawn_shackle', 1, 2); } });
defMove({ id: 'spawn_frogspawn', name: 'Frogspawn', type: 'BEAST', owner: 'spawn', reach: 'side', cd: 6, nerve: 5, text: 'Summons 2 Tadpoles (10% max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'spawn_ward', { hp: 0.1, turns: 6 }); summon(c.b, c.u, 'spawn_ward', { hp: 0.1, turns: 6 }); } });

// lune: a broken piece of moon that throws its edges, beams pale light, lights its team, and rains shards.
defMark({ id: 'lune_glaives', name: 'edges out', clock: 'own', volatile: true, value: 0.08 });
defPassive({ id: 'lune_rebound', name: 'Boomerang Edge', owner: 'lune', text: 'Its attacks bounce to 1 reserve for 35% MGK, 2 with Edges Out.',
  afterAttack(b, f) { const rs = reserves(b.s[1 - f.side]).slice(0, marked(f, 'lune_glaives') ? 2 : 1); for (const r of rs) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.35, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'lune_waxing', name: 'Moonward', owner: 'lune', text: 'In reserve: your out whorl deals 1.08x.',
  auraOut() { return 1.08; } });
defMove({ id: 'lune_facet', name: 'Pale Beam', type: 'STAR', owner: 'lune', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 93% MGK. Delays the foe\'s next turn by 25%.',
  run(c) { c.hit(c.tgt, { mgk: 0.93 }); c.delay(c.tgt, 25); } });
defMove({ id: 'lune_beam', name: 'Edges Out', type: 'STAR', owner: 'lune', reach: 'self', cd: 3, wt: 60, text: '3 turns: its attacks bounce to 2 reserves. Haste 1.',
  run(c) { c.mark(c.u, 'lune_glaives', 1, 3); c.st(c.u, 'haste', 1); } });
defMove({ id: 'lune_glaive', name: 'Full Light', type: 'STAR', owner: 'lune', reach: 'team', cd: 4, text: 'Empower 1 on your team. Heals itself 10% of its max HP.',
  run(c) { for (const a of standing(c.me)) c.st(a, 'empower', 1); c.heal(c.u, c.u.maxHp * 0.1); } });
defMove({ id: 'lune_totality', name: 'Shard Rain', type: 'STAR', owner: 'lune', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, text: 'Hits 6 times for 33% MGK: 4 on the foe, 2 on reserves.',
  run(c) { const rs = reserves(c.them); for (let i = 0; i < 6; i++) { const t = i % 3 === 2 && rs[(i / 3) | 0] ? rs[(i / 3) | 0] : c.tgt; if (!t.ko) c.hit(t, { mgk: 0.33 }, t === c.tgt ? {} : { reserve: true }); } } });

// siderite: a star-iron stone that sends an iron wave, pulls a reserve out, lends its pull to a friend, and turns the poles.
defMark({ id: 'siderite_charged', name: 'iron-drawn', clock: 'own', value: 0.1,
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.3, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'siderite_remanence', name: 'Pull Through', owner: 'siderite', text: 'When it Stuns a foe: each foe reserve takes 20% ATK.',
  afterApply(b, f, t, id) { if (id !== 'stun' || t.side === f.side) return; for (const r of reserves(b.s[t.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.2, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'siderite_dense', name: 'Too Heavy', owner: 'siderite', text: 'Cannot be forced out or dragged in. Ignores delays.',
  immovable() { return true; }, noDelay() { return true; } });
defMove({ id: 'siderite_knock', name: 'Iron Wave', type: 'STONE', owner: 'siderite', reach: 'spread', cd: 1, text: 'Hits every foe for 68% ATK. Slow 1.',
  run(c) { c.spread({ atk: 0.68 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'siderite_skewer', name: 'Pull Iron', type: 'STONE', owner: 'siderite', reach: 'dragin', cd: 3, text: 'Drags in a reserve. Hits it for 90% ATK. Slow 2.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 0.9 }); c.st(t, 'slow', 2); } });
defMove({ id: 'siderite_magnetize', name: 'Lend Pull', type: 'STONE', owner: 'siderite', reach: 'ally', cd: 3, text: 'An ally: Empower 2. 3 turns: its attacks hit reserves for 30% ATK.',
  run(c) { c.st(c.ally!, 'empower', 2); c.mark(c.ally!, 'siderite_charged', 1, 3); } });
defMove({ id: 'siderite_poleswap', name: 'Turn Poles', type: 'STONE', owner: 'siderite', reach: 'spread', cd: 7, nerve: 6, text: 'Hits every foe for 110% ATK, +10% per foe reserve. Stun 2.',
  run(c) { c.spread({ atk: 1.1 }, { mult: 1 + 0.1 * reserves(c.them).length }); c.st(c.tgt, 'stun', 2); } });

// slag: furnace slag that eats DEF, runs acid, brews and throws, and melts down.
const SLAG_RAGE: SpriteData = { px: ['3.3..3.3', '.242242.', '44344344', '22422422', '.211112.', '24222242', '2.2222.2', '22....22'], c: ['#e77405', '#f2f2ee', '#59392f'] };
defMark({ id: 'slag_acid', name: 'in acid', clock: 'own', negative: true, volatile: true, value: -0.06,
  statBonus(f, k) { return k === 'def' ? -8 : 0; },
  turnStart(b, f) { const mk = f.m.slag_acid; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'atk') * 0.2, 'P', 'GEAR'); } });
defMark({ id: 'slag_rage', name: 'melting', clock: 'own', value: 0.2,
  turnStart(b, f) { heal(b, f, f, f.maxHp * 0.06); },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'slag_rage'); clearForm(b, f); } });
defPassive({ id: 'slag_unstable', name: 'Going Off', owner: 'slag', text: 'While brewing: +1 Brew a turn. At 4 it goes off on Kuoria: 10% max HP, Stun 1.',
  turnStart(b, f) {
    if (!f.k.brewing) return;
    f.k.brew = (f.k.brew || 0) + 1;
    if (f.k.brew < 4) return;
    f.k.brewing = 0; f.k.brew = 0;
    msg(b, `The brew goes off on ${label(b, f)}.`);
    dealDamage(b, null, f, f.maxHp * 0.1, dot('T'), null);
    stunNow(b, null, f);
  } });
defPassive({ id: 'slag_skim', name: 'Skim Off', owner: 'slag', text: 'When a foe is KO\'d while it is out: 1 tide, and heals 8% of its max HP.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) { addNerve(b, f.side, 1); heal(b, f, f, f.maxHp * 0.08); } } });
defMove({ id: 'slag_dross', name: 'Dross Hit', type: 'GEAR', owner: 'slag', reach: 'single', cd: 1, text: 'Hits for 121% ATK. The foe loses 3 DEF, up to 15.',
  run(c) { c.hit(c.tgt, { atk: 1.21 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.shred = Math.min(15, (c.tgt.k.shred || 0) + 3); } });
defMove({ id: 'slag_spill', name: 'Acid Run', type: 'GEAR', owner: 'slag', reach: 'spread', cd: 3, text: 'Hits every foe for 69% ATK. 3 turns: -8 DEF and 20% ATK a turn.',
  run(c) { c.spread({ atk: 0.69 }); if (!c.tgt.ko) c.mark(c.tgt, 'slag_acid', 1, 3); } });
defMove({ id: 'slag_pour', name: 'Brew Up', type: 'GEAR', owner: 'slag', reach: 'single', tags: ['projectile'], cd: 1, text: 'First use: starts a Brew. Next use: throws it for 69% ATK + 25% per Brew. Stun 1, or 2 at 3+ Brew.',
  run(c) {
    if (!c.u.k.brewing) { c.u.k.brewing = 1; c.u.k.brew = 0; c.msg(`${label(c.b, c.u)} starts a brew.`); return; }
    const n = c.u.k.brew || 0;
    c.u.k.brewing = 0; c.u.k.brew = 0;
    c.hit(c.tgt, { atk: 0.69 + 0.25 * n });
    if (n >= 1) c.st(c.tgt, 'stun', n >= 3 ? 2 : 1);
  } });
defMove({ id: 'slag_remelt', name: 'Melt Down', type: 'GEAR', owner: 'slag', reach: 'self', cd: 6, nerve: 4, wt: 60, text: '3 turns: 1.2x ATK, Haste 3, heals 6% max HP a turn. Cleanses itself.',
  run(c) { c.cleanse(c.u); c.st(c.u, 'haste', 3); setForm(c.b, c.u, { tag: 'rage', sprite: SLAG_RAGE, statMul: { atk: 1.2 } }); c.mark(c.u, 'slag_rage', 1, 3); } });

// ================================================================ glass desert

// cullet: broken glass that blunts the first move on it, sends out glass mites, rings, shows Visions that pass on, and grips.
defSummon({ id: 'cullet_mite', name: 'Glass Mite', owner: 'cullet', sprite: { px: ['........', '........', '........', '.11222..', '..22.2..', '.12.22..', '..22221.', '..1.1.1.'], c: ['#b86bf1', '#9caaa6', '#9caaa6'] }, text: 'Hits the out foe for 35% of Vilasi\'s MGK each turn, 1.5x on a foe with Visions.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.35 * (marked(t, 'cullet_vision') ? 1.5 : 1), 'M', 'STONE'); } });
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
defMove({ id: 'cullet_sliver', name: 'Glass Mites', type: 'STONE', owner: 'cullet', reach: 'side', tags: ['spell'], cd: 2, text: 'Summons a Glass Mite (10% max HP, 3 turns), up to 2. Each turn it hits the foe for 35% MGK.',
  run(c) { const ms = summonsOf(c.b, c.u.side, 'cullet_mite'); if (ms.length >= 2) dismiss(c.b, ms[0]); summon(c.b, c.u, 'cullet_mite', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'cullet_ring', name: 'Ringing Glass', type: 'STONE', owner: 'cullet', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 77% MGK. Silence 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.77 }); c.st(c.tgt, 'silence', 1); } });
defMove({ id: 'cullet_mirage', name: 'Glass Visions', type: 'STONE', owner: 'cullet', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 38% MGK. Visions 3: loses 5% max HP a turn.',
  run(c) { c.hit(c.tgt, { mgk: 0.38 }); if (!c.tgt.ko) c.mark(c.tgt, 'cullet_vision', 1, 3); } });
defMove({ id: 'cullet_grip', name: 'Shard Grip', type: 'STONE', owner: 'cullet', reach: 'single', tags: ['spell', 'channel'], cd: 6, nerve: 5, text: 'Stun 2. Hits for 58% MGK now, 45% MGK next turn. Heals 30% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.58 }); c.heal(c.u, d * 0.3); c.st(c.tgt, 'stun', 2); c.mark(c.u, 'cullet_grasp', 1, 2); } });

// telson: a scorpion tail that poisons every attack and every attacker, pools venom, hooks, and stings deep.
defPassive({ id: 'telson_venomtail', name: 'Walks on Sting', owner: 'telson', text: 'Its attacks add Poison 1 and Slow 1.',
  afterAttack(b, f, t) { if (t.ko || t.gone) return; applyStatus(b, f, t, 'poison', 1); applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'telson_shell', name: 'Venom Skin', owner: 'telson', text: 'Takes 0.9x magic damage. Foes that attack it get Poison 1.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.9 : 1; },
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src.side !== f.side && !src.ko) applyStatus(b, f, src, 'poison', 1); } });
defMove({ id: 'telson_barb', name: 'Sting Tip', type: 'BEAST', owner: 'telson', reach: 'single', cd: 1, text: 'Hits for 109% ATK. Poison 2.',
  run(c) { c.hit(c.tgt, { atk: 1.09 }); c.st(c.tgt, 'poison', 2); } });
defMove({ id: 'telson_seep', name: 'Venom Pool', type: 'BEAST', owner: 'telson', reach: 'spread', cd: 3, text: 'Hits every foe for 60% ATK + 10% missing HP. Below 50% HP: Silence 1.',
  run(c) { c.spread({ atk: 0.6, tgtMiss: 0.1 }); if (under(c.tgt, 0.5)) c.st(c.tgt, 'silence', 1); } });
defMove({ id: 'telson_pincer', name: 'Tail Hook', type: 'BEAST', owner: 'telson', reach: 'single', cd: 3, text: 'Hits for 93% ATK. Root 1. Poison 2.',
  run(c) { c.hit(c.tgt, { atk: 0.93 }); c.st(c.tgt, 'root', 1); c.st(c.tgt, 'poison', 2); } });
defMove({ id: 'telson_cripple', name: 'Deep Sting', type: 'BEAST', owner: 'telson', reach: 'single', cd: 6, nerve: 4, text: 'Hits for 120% ATK. Poison 4. Slow 3. Weaken 2.',
  run(c) { c.hit(c.tgt, { atk: 1.2 }); c.st(c.tgt, 'poison', 4); c.st(c.tgt, 'slow', 3); c.st(c.tgt, 'weaken', 2); } });

// cholla: a jumping cactus that leaves Joints in what it hits, jumps on, drops joints, pins, and grabs.
defMark({ id: 'cholla_tremor', name: 'joints in', max: 3, clock: 'own', negative: true, volatile: true, value: -0.06 });
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
defPassive({ id: 'cholla_storedwater', name: 'Stored Water', owner: 'cholla', text: 'Takes 0.85x damage while shielded.',
  inMul(b, f) { return f.shield > 0 ? 0.85 : 1; } });
defMove({ id: 'cholla_jump', name: 'Jump On', type: 'ROOT', owner: 'cholla', reach: 'single', cd: 1, text: 'Hits for 103% ATK. Delays the foe\'s next turn by 15%.',
  run(c) { c.hit(c.tgt, { atk: 1.03 }); c.delay(c.tgt, 15); } });
defMove({ id: 'cholla_jointdrop', name: 'Joint Drop', type: 'ROOT', owner: 'cholla', reach: 'spread', cd: 3, text: 'Hits every foe for 59% ATK. Slow 1. Shield of 14% of its max HP.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.14, 3); c.spread({ atk: 0.59 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'cholla_spinebed', name: 'Spine Bed', type: 'ROOT', owner: 'cholla', reach: 'single', tags: ['dash'], cd: 4, text: 'Hits for 98% ATK. Stun 1 if the foe can\'t switch, else Slow 2.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 0.98 }); c.st(c.tgt, pinned ? 'stun' : 'slow', pinned ? 1 : 2); } });
defMove({ id: 'cholla_grab', name: 'Cholla Grab', type: 'ROOT', owner: 'cholla', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 118% ATK. Stun 1. Root 3.',
  run(c) { c.hit(c.tgt, { atk: 1.18 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 3); } });

// erg: a coral dune that buds sand Polyps, rushes with them, shifts through the reef, and raises a reef wall.
defSummon({ id: 'erg_soldier', name: 'Sand Polyp', owner: 'erg', text: 'Strikes with Sunaka\'s attacks and its Polyp Rush. 4 turns.', every: 100,
  sprite: { px: ['........', '........', '...3.3..', '...3.3..', '...3.3..', '...333..', '...33...', '..2222..'], c: ['#efe7d7', '#a90a0e', '#cbbba3'] },
  act() { /* soldiers only strike when commanded */ } });
defSummon({ id: 'erg_wall', name: 'Reef Wall', owner: 'erg', sprite: { px: ['........', '........', '........', '.3.33.3.', '22222222', '2.24.2.2', '24222242', '........'], c: ['#efe7d7', '#d7a02b', '#b9575f'] }, text: 'Takes single-target hits meant for your out whorl until it falls. 20% of Sunaka\'s max HP.', guard: true });
const soldiers = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'erg_soldier').length;
defPassive({ id: 'erg_grain', name: 'Budding', owner: 'erg', text: 'When it attacks: each Polyp also hits for 30% MGK.',
  afterAttack(b, f, t) { const n = soldiers(b, f); if (n && !t.ko && !t.gone) strike(b, f, t, stat(b, f, 'mgk') * 0.3 * n, 'M', 'STONE'); } });
defPassive({ id: 'erg_sandsea', name: 'Colony', owner: 'erg', text: 'Takes 6% less damage per Polyp.',
  inMul(b, f) { return 1 - 0.06 * soldiers(b, f); } });
defMove({ id: 'erg_sandblast', name: 'Polyp Rush', type: 'STONE', owner: 'erg', reach: 'spread', tags: ['dash', 'spell'], cd: 1, text: 'Hits every foe for 55% MGK, +35% per Polyp. Slow 1.',
  run(c) { const n = soldiers(c.b, c.u); c.spread({ mgk: 0.55 }, { mult: 1 + 0.35 * n }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'erg_saltation', name: 'Bud Polyp', type: 'STONE', owner: 'erg', reach: 'side', cd: 2, text: 'Summons a Polyp (10% max HP, 4 turns), up to 3.',
  run(c) { if (soldiers(c.b, c.u) >= 3) { const s = summonsOf(c.b, c.u.side, 'erg_soldier')[0]; if (s) dismiss(c.b, s); } summon(c.b, c.u, 'erg_soldier', { hp: 0.1, turns: 4 }); } });
defMove({ id: 'erg_slipface', name: 'Through Reef', type: 'STONE', owner: 'erg', reach: 'single', tags: ['dash', 'spell'], cd: 3, text: 'Hits for 85% MGK. 6% max HP shield per Polyp. Next turn 25% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.shield(c.u, c.u.maxHp * 0.06 * Math.max(1, soldiers(c.b, c.u)), 3); c.hasten(c.u, 25); } });
defMove({ id: 'erg_dunewall', name: 'Reef Rises', type: 'STONE', owner: 'erg', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 120% MGK. Forces the foe out. Raises a Reef Wall.',
  run(c) { c.spread({ mgk: 1.2 }); if (!c.tgt.ko) c.forceOut(); summon(c.b, c.u, 'erg_wall', { hp: 0.2 }); } });

// haze: heat wobble that holds glare, waver, and dew, and mixes the last three it held.
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
defPassive({ id: 'haze_veil', name: 'Wavering', owner: 'haze', text: 'Takes 8% less damage from moves per Waver it holds. Weather Mix with 1 Waver: Slow 2. With 2 or 3: Stun 1 or 2.',
  inMul(b, f, src, d) { return d.move ? 1 - 0.08 * elemCount(f, 2) : 1; } });
defMove({ id: 'haze_glare', name: 'Hard Glare', type: 'STAR', owner: 'haze', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 147% MGK. Holds a Glare.',
  run(c) { c.hit(c.tgt, { mgk: 1.47 }); addElem(c.b, c.u, 1); } });
defMove({ id: 'haze_waver', name: 'Heat Wobble', type: 'STAR', owner: 'haze', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 112% MGK. Delays the foe\'s next turn by 15%. Holds a Waver.',
  run(c) { c.hit(c.tgt, { mgk: 1.12 }); c.delay(c.tgt, 15); addElem(c.b, c.u, 2); } });
defMove({ id: 'haze_dew', name: 'Night Dew', type: 'STAR', owner: 'haze', reach: 'self', cd: 1, wt: 70, text: 'Heals 8% of its max HP. Fortify 1. Holds a Dew.',
  run(c) { c.heal(c.u, c.u.maxHp * 0.08); c.st(c.u, 'fortify', 1); addElem(c.b, c.u, 3); } });
defMove({ id: 'haze_thermal', name: 'Weather Mix', type: 'STAR', owner: 'haze', reach: 'spread', tags: ['spell'], cd: 5, nerve: 4,
  text: 'Hits every foe for 71% MGK +45% per Glare. Your team heals 6% of max HP per Dew.',
  run(c) {
    const g = elemCount(c.u, 1), w = elemCount(c.u, 2), d = elemCount(c.u, 3);
    c.spread({ mgk: 0.71 + 0.45 * g });
    if (w === 1) c.st(c.tgt, 'slow', 2);
    else if (w >= 2) c.st(c.tgt, 'stun', w - 1);
    if (d) for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.06 * d);
  } });

// bonedry: a bleached skull that gets up once more, bites dry, stares a foe still, cracks open, and raises small bones.
defMark({ id: 'bonedry_spare', name: 'unburied', max: 1, value: 0.6 });
defMark({ id: 'bonedry_crit', name: 'cracked open', clock: 'own', volatile: true, value: 0.08,
  outMul(b, f, t, d) { return d.attack ? 1.9 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.attack) { heal(b, f, f, dealt * 0.3); unmark(f, 'bonedry_crit'); } } });
defSummon({ id: 'bonedry_skeleton', name: 'Small Bones', owner: 'bonedry', text: 'Each turn: claws the foe for 22% of Calkuro\'s ATK.', every: 100,
  sprite: { px: ['........', '........', '..2.2...', '.22222..', '.23232..', '.22222..', '..2.2...', '.44.44..'], c: ['#efebe3', '#39e163', '#a0895b'] },
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'atk') * 0.22, 'P', 'BEAST'); } });
defPassive({ id: 'bonedry_unburied', name: 'Unburied', owner: 'bonedry', text: 'Once per battle, instead of a KO: back at 5% HP, cleansed. Foe: Stun 1.',
  start(b, f) { mark(b, f, f, 'bonedry_spare', 1, -1); },
  wouldKO(b, f) {
    if (!marked(f, 'bonedry_spare')) return false;
    unmark(f, 'bonedry_spare');
    f.hp = Math.round(f.maxHp * 0.05);
    cleanse(b, f);
    msg(b, `${label(b, f)} gets back up.`);
    const t = foe(b, f);
    if (t) applyStatus(b, f, t, 'stun', 1);
    return true;
  } });
defPassive({ id: 'bonedry_grudge', name: 'Old Grudge', owner: 'bonedry', text: 'Its attacks heal it 10% of their damage.',
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.1); } });
defMove({ id: 'bonedry_marrow', name: 'Dry Bite', type: 'BEAST', owner: 'bonedry', reach: 'single', cd: 1, text: 'Hits for 74% ATK. Heals 10% of the damage.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.74 }); c.heal(c.u, d * 0.1); } });
defMove({ id: 'bonedry_stare', name: 'Bleached Stare', type: 'BEAST', owner: 'bonedry', reach: 'single', tags: ['projectile'], cd: 4, text: 'Hits for 35% ATK. Stun 1. Burn 2 (25% ATK each turn). Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 0.35 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'atk') * 0.25); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'bonedry_crack', name: 'Crack Open', type: 'BEAST', owner: 'bonedry', reach: 'self', cd: 3, wt: 50, text: 'Its next attack deals 1.9x damage and heals 30% of it.',
  run(c) { c.mark(c.u, 'bonedry_crit', 1, 2); } });
defMove({ id: 'bonedry_ossuary', name: 'Ossuary', type: 'BEAST', owner: 'bonedry', reach: 'side', cd: 6, nerve: 5, text: 'Summons 2 Small Bones (12% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'bonedry_skeleton', { hp: 0.12, turns: 3 }); summon(c.b, c.u, 'bonedry_skeleton', { hp: 0.12, turns: 3 }); } });

// ================================================================ hands orchard

// shears: pruning shears that snip at the many, prune a friend clean, oil the pivot, and pick one branch to cut.
defMark({ id: 'shears_duel', name: 'picked', max: 1, clock: 'own', value: -0.05,
  forbid(b, f, what) { return what === 'switch' || what === 'guard' ? 'In a duel.' : null; } });
defMark({ id: 'shears_courage', name: 'oiled', clock: 'own', volatile: true, value: 0.1,
  afterTake(b, f, src, dealt, d) { if (d.dot || !src || src.side === f.side || src.ko) return; unmark(f, 'shears_courage'); const x = strike(b, f, src, stat(b, f, 'atk') * 0.7, 'P', 'GEAR'); heal(b, f, f, x * 0.5); } });
defPassive({ id: 'shears_notched', name: 'Notches', owner: 'shears', text: 'When it KOs a foe in a Duel: +15% damage for the battle.',
  anyKO(b, f, v, killer) { if (killer === f && marked(v, 'shears_duel') === 0 && f.k.dueling && v.k.inDuel) { f.k.duelWins = (f.k.duelWins || 0) + 1; msg(b, `${label(b, f)} cuts a notch.`); } },
  outMul(b, f) { return 1 + 0.15 * (f.k.duelWins || 0); } });
defPassive({ id: 'shears_snapback', name: 'Spring Back', owner: 'shears', text: 'Every 3rd hit it takes: strikes back for 50% ATK, heals 30% of it.',
  afterTake(b, f, src, dealt, d) { if (d.dot || !src || src.side === f.side) return; f.k.snaps = (f.k.snaps || 0) + 1; if (f.k.snaps % 3 === 0 && !src.ko) { const x = strike(b, f, src, stat(b, f, 'atk') * 0.5, 'P', 'GEAR'); heal(b, f, f, x * 0.3); } } });
defMove({ id: 'shears_snip', name: 'Snip Snip', type: 'GEAR', owner: 'shears', reach: 'spread', cd: 1, text: 'Hits every foe for 53% ATK, +10% per foe standing.',
  run(c) { c.spread({ atk: 0.53 }, { mult: 1 + 0.1 * standing(c.them).length }); } });
defMove({ id: 'shears_lop', name: 'Prune Back', type: 'GEAR', owner: 'shears', reach: 'ally', cd: 3, text: 'Cleanses an ally. Heals it 12% of max HP. Haste 1.',
  run(c) { c.cleanse(c.ally!); c.heal(c.ally!, c.ally!.maxHp * 0.12); c.st(c.ally!, 'haste', 1); } });
defMove({ id: 'shears_oil', name: 'Oil Pivot', type: 'GEAR', owner: 'shears', reach: 'self', cd: 3, wt: 50, text: 'The next hit on it is answered for 70% ATK. Heals 50% of that.',
  run(c) { c.mark(c.u, 'shears_courage', 1, 2); } });
defMove({ id: 'shears_lockblades', name: 'One Branch', type: 'GEAR', owner: 'shears', reach: 'single', cd: 6, nerve: 4, text: 'Duel 3: neither can switch or guard. Empower 2. Hits for 86% ATK.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    c.mark(c.tgt, 'shears_duel', 1, 3); c.mark(c.u, 'shears_duel', 1, 3);
    c.u.k.dueling = 1; c.tgt.k.inDuel = 1;
    c.st(c.u, 'empower', 2);
    c.hit(c.tgt, { atk: 0.86 });
  } });

// glove: a gardener's glove that pulls weeds, springs off a friend, lends a hand, and lets loose.
defMark({ id: 'glove_side', name: 'helped', clock: 'own', value: 0.08,
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !d.dot) heal(b, f, f, dealt * 0.2); } });
defMark({ id: 'glove_unleash', name: 'let loose', clock: 'own', volatile: true, value: 0.15,
  afterAttack(b, f) { f.k.pulse = (f.k.pulse || 0) + 1; if (f.k.pulse % 2 === 0) { splash(b, f, stat(b, f, 'atk') * 0.5, 'P', 'BEAST'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'glove_cuffed', name: 'Cuff Off', owner: 'glove', text: 'Its attacks deal 1.3x while Let Loose runs.',
  outMul(b, f, t, d) { return d.attack && marked(f, 'glove_unleash') ? 1.3 : 1; } });
defPassive({ id: 'glove_handspring', name: 'Soft Palm', owner: 'glove', text: 'Takes 0.85x damage while it has Empower.',
  inMul(b, f) { return f.s.empower ? 0.85 : 1; } });
defMove({ id: 'glove_grub', name: 'Weed Pull', type: 'BEAST', owner: 'glove', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 142% ATK. Delays the foe\'s next turn by 25%.',
  run(c) { c.hit(c.tgt, { atk: 1.42 }); c.delay(c.tgt, 25); } });
defMove({ id: 'glove_springoff', name: 'Palm Spring', type: 'BEAST', owner: 'glove', reach: 'reserveAlly', cd: 3, text: 'Hits for 134% ATK. Slow 2. A reserve ally gets Empower 2.',
  run(c) { c.hit(c.tgt, { atk: 1.34 }); c.st(c.tgt, 'slow', 2); c.st(c.ally!, 'empower', 2); } });
defMove({ id: 'glove_helping', name: 'Lend a Hand', type: 'BEAST', owner: 'glove', reach: 'ally', cd: 3, text: 'An ally: Empower 2. 3 turns: its hits heal it 20% of the damage.',
  run(c) { c.st(c.ally!, 'empower', 2); c.mark(c.ally!, 'glove_side', 1, 3); } });
defMove({ id: 'glove_unclench', name: 'Let Loose', type: 'BEAST', owner: 'glove', reach: 'self', cd: 6, nerve: 4, wt: 50, text: '3 turns: Haste 3. Every 2nd attack: 50% ATK to every foe, Slow 1.',
  run(c) { c.u.k.pulse = 0; c.st(c.u, 'haste', 3); c.mark(c.u, 'glove_unleash', 1, 3); } });

// scion: a grafted branch that slashes, shoots long, splices in, grows inside a foe, and takes after the first one it beats.
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
defPassive({ id: 'scion_rootstock', name: 'Rootstock', owner: 'scion', text: 'Its first KO picks a form. A KO on a physical foe makes Old Wood (1.1x ATK, 1.15x DEF). Any other makes Pale Graft.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side || f.form) return;
    if (basicOf(v) === 'P') { setForm(b, f, { tag: 'darkin', sprite: SCION_DARK, statMul: { atk: 1.1, def: 1.15 } }); msg(b, `${label(b, f)} takes after the old wood.`); }
    else { setForm(b, f, { tag: 'shade', sprite: SCION_SHADE, statMul: { atk: 1.2, agi: 1.15 } }); msg(b, `${label(b, f)} takes after the shade.`); }
  } });
defPassive({ id: 'scion_union', name: 'Graft Union', owner: 'scion', text: 'No form: takes 0.85x. Old Wood: moves heal 25%. Pale Graft: 1.2x ATK, 1.15x AGI.',
  inMul(b, f) { return f.form ? 1 : 0.85; },
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && scionForm(f) === 'darkin') heal(b, f, f, dealt * 0.25); } });
defMove({ id: 'scion_cleft', name: 'Graft Slash', type: 'ROOT', owner: 'scion', reach: 'spread', cd: 1, text: 'Hits every foe for 67% ATK.',
  run(c) { c.spread({ atk: 0.67 }); } });
defMove({ id: 'scion_budding', name: 'Long Shoot', type: 'ROOT', owner: 'scion', reach: 'single', cd: 3, wu: 40, text: 'Short wind-up. Hits for 91% ATK. Slow 2. Old Wood: Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 0.91 }); c.st(c.tgt, 'slow', 2); if (scionForm(c.u) === 'darkin') c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'scion_splice', name: 'Splice In', type: 'ROOT', owner: 'scion', reach: 'self', tags: ['dash'], cd: 3, wt: 50, text: 'Haste 2. Heals 8% max HP. Pale Graft: next move deals 1.3x.',
  run(c) { c.st(c.u, 'haste', 2); c.heal(c.u, c.u.maxHp * 0.08); if (scionForm(c.u) === 'shade') c.u.k.nextMoveMul = 1.3; } });
defMove({ id: 'scion_ingrowth', name: 'Grow Inside', type: 'ROOT', owner: 'scion', reach: 'single', cd: 6, nerve: 4, text: 'Hits for 37% ATK. Untouchable 1. At its next turn: hits for 90% ATK + 10% of the foe\'s max HP.',
  run(c) { c.hit(c.tgt, { atk: 0.37 }); c.st(c.u, 'invuln', 1); c.mark(c.u, 'scion_inside', 1, 2); } });

// espalier: a wall-trained pear that feeds the out whorl from reserve, drops pears, props up a friend, and grows a full trellis.
defPassive({ id: 'espalier_trained', name: 'Wall Fed', owner: 'espalier', text: 'In reserve: your out whorl heals 3% of max HP a turn and deals 1.05x.',
  reserveTurn(b, f) { const o = outOf(b, f); if (!o.ko) heal(b, f, o, o.maxHp * 0.03); },
  auraOut() { return 1.05; } });
defPassive({ id: 'espalier_pleached', name: 'Pleached', owner: 'espalier', text: 'Allies it heals with a move also get Fortify 1.' });
defMove({ id: 'espalier_spur', name: 'Pear Drop', type: 'ROOT', owner: 'espalier', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 78% MGK. 1.3x on a foe that was already out at its last turn.',
  run(c) { const long = c.tgt.outAt < (c.u.k.prevTurn ?? 0); c.hit(c.tgt, { mgk: 0.78 }, { mult: long ? 1.3 : 1 }); } });
defMove({ id: 'espalier_propup', name: 'Prop Up', type: 'ROOT', owner: 'espalier', reach: 'reserveAlly', cd: 3, tag: true, text: 'Switches to an ally. It heals 8% of max HP. Empower 2.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.08); c.st(c.ally!, 'empower', 2); if (has(c.u, 'espalier_pleached')) c.st(c.ally!, 'fortify', 1); } });
defMove({ id: 'espalier_saprise', name: 'Wall Sap', type: 'ROOT', owner: 'espalier', reach: 'ally', cd: 2, text: 'Heals an ally 12% of max HP. Haste 1.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.12); c.st(c.ally!, 'haste', 1); if (has(c.u, 'espalier_pleached')) c.st(c.ally!, 'fortify', 1); } });
defMove({ id: 'espalier_lattice', name: 'Full Trellis', type: 'ROOT', owner: 'espalier', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 78% MGK. Root 2. Your team heals 10% of max HP.',
  run(c) { c.spread({ mgk: 0.78 }); c.st(c.tgt, 'root', 2); for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.1); } });

// rung: a ladder rung that climbs a Step each turn, raps, binds a foe to the one behind, sets a landing, and holds still.
defSummon({ id: 'rung_shrine', name: 'Landing', owner: 'rung', sprite: { px: ['4......4', '4......4', '42222224', '42222224', '4.3..3.4', '4.3..3.4', '4......4', '4......4'], c: ['#c49d6d', '#efcf5f', '#266875'] }, text: 'At your next turn: heals your out whorl 25% of its max HP. Haste 2. Then it goes.', every: 100,
  act(b, s) { const o = b.s[s.side].f[b.s[s.side].out]; if (o && !o.ko) { heal(b, ownerOf(b, s), o, o.maxHp * 0.25); applyStatus(b, null, o, 'haste', 2); } } });
defPassive({ id: 'rung_stepup', name: 'Step Higher', owner: 'rung', text: 'Turn start: +1 Step, up to 6. Its attacks add 8% MGK per Step.',
  turnStart(b, f) { f.k.chimes = Math.min(6, (f.k.chimes || 0) + 1); },
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'mgk') * 0.08 * (f.k.chimes || 0) : 0; } });
defPassive({ id: 'rung_footing', name: 'Sure Footing', owner: 'rung', text: 'Its switches take 30% of a turn.',
  quickWeight(f, act) { return act === 'switch' ? 30 : null; } });
defMove({ id: 'rung_rap', name: 'Rung Rap', type: 'ROOT', owner: 'rung', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 110% MGK, +5% per Step. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }, { mult: 1 + 0.05 * (c.u.k.chimes || 0) }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'rung_crossbar', name: 'Crossbar', type: 'ROOT', owner: 'rung', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 93% MGK. If the foe has a reserve: Stun 1, and its first reserve takes 50% of the hit. If not: Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.93 }); if (c.tgt.ko) return; if (reserves(c.them).length) { c.st(c.tgt, 'stun', 1); const r = reserves(c.them)[0]; c.hit(r, { mgk: 0.93 }, { reserve: true, mult: 0.5 }); } else c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'rung_reststep', name: 'Landing Rest', type: 'ROOT', owner: 'rung', reach: 'side', cd: 3, text: 'Sets a Landing (8% max HP).',
  run(c) { summon(c.b, c.u, 'rung_shrine', { hp: 0.08, turns: 1 }); } });
defMove({ id: 'rung_standstill', name: 'Stand Still', type: 'ROOT', owner: 'rung', reach: 'single', cd: 6, nerve: 4, text: 'Stasis 1 on the foe. Your next whorl out: its first turn comes 60% sooner. Heals 10% of its max HP.',
  run(c) { c.st(c.tgt, 'stasis', 1); sk(c.b, c.u.side).bonusNext = 60; c.heal(c.u, c.u.maxHp * 0.1); } });

// ================================================================ the margin

// nought: a blank that spreads every hit thin, throws its edge, rubs a foe out, steps off, and is nothing there.
defPassive({ id: 'nought_spread', name: 'Spread Thin', owner: 'nought', text: 'Takes 0.92x damage. When hit: every foe takes 8% of it as true damage.',
  inMul() { return 0.92; },
  afterTake(b, f, src, dealt, d) {
    if (d.dot || !src || src.side === f.side) return;
    for (const e of standing(b.s[1 - f.side])) dealDamage(b, f, e, dealt * 0.08, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: !isOut(b, e) }, null);
  } });
defPassive({ id: 'nought_emptied', name: 'Emptied', owner: 'nought', text: 'Deals 1.2x damage to a foe with 1 reserve or none.',
  outMul(b, f, t) { return reserves(b.s[t.side]).length <= 1 ? 1.2 : 1; } });
defMove({ id: 'nought_edge', name: 'Blank Edge', type: 'STAR', owner: 'nought', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 91% MGK. Slow 1. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.91 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 15); } });
defMove({ id: 'nought_erase', name: 'Rub Out', type: 'STAR', owner: 'nought', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 77% MGK + 6% of the foe\'s max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.77, tgtHp: 0.06 }); } });
defMove({ id: 'nought_path', name: 'Step Off', type: 'STAR', owner: 'nought', reach: 'self', cd: 3, wt: 50, text: 'Haste 2. Fortify 1.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'fortify', 1); } });
defMove({ id: 'nought_haunting', name: 'Nothing There', type: 'STAR', owner: 'nought', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 64% MGK, reserves in full.',
  run(c) { c.hit(c.tgt, { mgk: 0.64 }); for (const r of reserves(c.them)) c.hit(r, { mgk: 0.64 }, { reserve: true, spread: true }); } });

// terminus: a road's end that charges at the barrier, fires its warning posts, flips a foe at the toll bar, and ends what reaches it.
defMark({ id: 'terminus_purge', name: 'posts firing', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { for (let i = 0; i < 2 && !t.ko && !t.gone; i++) strike(b, f, t, stat(b, f, 'atk') * 0.3, 'P', 'STONE'); } });
defMark({ id: 'terminus_dread', name: '', value: 0,
  anyOut(b, f, who) { if (who.side === f.side) return; unmark(f, 'terminus_dread'); msg(b, `${label(b, who)} saw what happened.`); forceAction(b, who, 'skip'); } });
defPassive({ id: 'terminus_endline', name: 'Last Post', owner: 'terminus', text: 'Every 3rd attack: adds 12% of the foe\'s max HP.',
  afterAttack(b, f, t) { f.k.legs = (f.k.legs || 0) + 1; if (f.k.legs % 3 === 0 && !t.ko && !t.gone) strike(b, f, t, t.maxHp * 0.12, 'P', 'STONE'); } });
defPassive({ id: 'terminus_terminal', name: 'Stays Here', owner: 'terminus', text: 'When Road\'s End finishes a foe: heals 20% of its max HP.' });
defMove({ id: 'terminus_lastmile', name: 'Barrier Charge', type: 'STONE', owner: 'terminus', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 125% ATK. Slow 1. The foe loses 3 DEF, up to 15.',
  run(c) { c.hit(c.tgt, { atk: 1.25 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.shred = Math.min(15, (c.tgt.k.shred || 0) + 3); } });
defMove({ id: 'terminus_deadend', name: 'Warning Posts', type: 'STONE', owner: 'terminus', reach: 'self', cd: 3, wt: 50, text: 'For 2 turns its attacks hit 2 more times for 30% ATK.',
  run(c) { c.mark(c.u, 'terminus_purge', 1, 2); } });
defMove({ id: 'terminus_toll', name: 'Toll Bar', type: 'STONE', owner: 'terminus', reach: 'single', cd: 3, text: 'Hits for 85% ATK. Stun 1. Shield of 10% of its max HP.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); c.st(c.tgt, 'stun', 1); c.shield(c.u, c.u.maxHp * 0.1, 3); } });
defMove({ id: 'terminus_roadsend', name: 'Road\'s End', type: 'STONE', owner: 'terminus', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 120% ATK. If the foe is left below 25% HP: it is KO\'d, and the next foe out skips its first turn.',
  run(c) {
    c.hit(c.tgt, { atk: 1.2 });
    if (c.tgt.ko || c.blocked(c.tgt) || !under(c.tgt, 0.25)) return;
    c.msg(`${label(c.b, c.tgt)} reaches the end of the road.`);
    c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true });
    if (!c.tgt.ko) return;
    if (has(c.u, 'terminus_terminal')) c.heal(c.u, c.u.maxHp * 0.2);
    mark(c.b, c.u, c.u, 'terminus_dread', 1);
  } });

// horizon: a horizon whose stars circle and strike, that breathes starlight, rises, sinks a well, and brings the stars down.
defSummon({ id: 'horizon_star', name: 'Circling Star', owner: 'horizon', text: 'Each turn: hits the foe for 12% of Finihei\'s MGK.', every: 100,
  sprite: { px: ['........', '.2....2.', '..2..2..', '...33...', '...33...', '..2..2..', '.2....2.', '........'], c: ['#e8c858', '#f8f8ff', '#424f9e'] },
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'mgk') * 0.12, 'M', 'STAR'); } });
defMark({ id: 'horizon_well', name: 'sinking', clock: 'own', negative: true, value: -0.1,
  turnStart(b, f) {
    const mk = f.m.horizon_well; const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    strike(b, by, f, stat(b, by, 'mgk') * 0.25, 'M', 'STAR');
    if (!f.ko) applyStatus(b, by, f, 'slow', 1);
    if (!f.ko && under(f, 0.08)) { msg(b, `${label(b, f)} falls into the well.`); dealDamage(b, by, f, f.hp + f.shield + 1, dot('T'), null); }
  } });
defPassive({ id: 'horizon_ring', name: 'Turning Stars', owner: 'horizon', text: 'Starts with a Circling Star (10% max HP). Each KO it lands: another, max 3.',
  start(b, f) { summon(b, f, 'horizon_star', { hp: 0.1 }); },
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side && summonsOf(b, f.side, 'horizon_star').length < 3) summon(b, f, 'horizon_star', { hp: 0.1 }); } });
defPassive({ id: 'horizon_accretion', name: 'Gathered In', owner: 'horizon', text: 'Its moves deal +3% per Circling Star.',
  outMul(b, f, t, d) { return d.move ? 1 + 0.03 * summonsOf(b, f.side, 'horizon_star').length : 1; } });
defMove({ id: 'horizon_skyline', name: 'Star Breath', type: 'STAR', owner: 'horizon', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 50% MGK. Each Circling Star also hits for 6% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); for (const s of summonsOf(c.b, c.u.side, 'horizon_star')) if (!c.tgt.ko) c.hit(c.tgt, { mgk: 0.06 }); } });
defMove({ id: 'horizon_widen', name: 'Rise Up', type: 'STAR', owner: 'horizon', reach: 'self', cd: 3, wt: 50, text: 'Haste 2. Its next move deals 1.3x.',
  run(c) { c.st(c.u, 'haste', 2); c.u.k.nextMoveMul = 1.3; } });
defMove({ id: 'horizon_farpoint', name: 'Sink Well', type: 'STAR', owner: 'horizon', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 26% MGK. At the foe\'s next 3 turns: it takes 25% MGK, Slow 1. If it drops below 8% HP: it is KO\'d.',
  run(c) { c.hit(c.tgt, { mgk: 0.26 }); if (!c.tgt.ko) c.mark(c.tgt, 'horizon_well', 1, 3); } });
defMove({ id: 'horizon_skyfall', name: 'Stars Fall', type: 'STAR', owner: 'horizon', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 70, text: 'Wind-up. Hits every foe for 68% MGK. Stun 1. Summons a Star (10% max HP, 4 turns).',
  run(c) { c.spread({ mgk: 0.68 }); c.st(c.tgt, 'stun', 1); summon(c.b, c.u, 'horizon_star', { hp: 0.1, turns: 4 }); } });

// murk: edge fog that comes out hidden, cuts deep when untouched, palls a foe, thickens, and cuts from inside itself.
defPassive({ id: 'murk_unseen', name: 'Unseen', owner: 'murk', text: 'If nothing hit it since its last turn: its hits deal 1.4x.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.seen = b.turnNo; },
  outMul(b, f, t, d) { return !d.reserve && (f.k.seen ?? -9) < (f.k.lastTurnNo ?? 0) ? 1.4 : 1; },
  turnEnd(b, f) { f.k.lastTurnNo = b.turnNo; } });
defPassive({ id: 'murk_smother', name: 'Rolls In', owner: 'murk', text: 'When it comes out: Hidden 1.',
  comeOut(b, f) { applyStatus(b, f, f, 'hidden', 1); } });
defMove({ id: 'murk_coldcut', name: 'Cold Edge', type: 'TIDE', owner: 'murk', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 82% ATK. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.82 }); c.hasten(c.u, 25); } });
defMove({ id: 'murk_pall', name: 'Fog Pall', type: 'TIDE', owner: 'murk', reach: 'single', cd: 4, text: 'Silence 1. Weaken 2.',
  run(c) { c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'weaken', 2); } });
defMove({ id: 'murk_lurk', name: 'Thicken', type: 'TIDE', owner: 'murk', reach: 'self', cd: 4, wt: 50, text: 'Hidden 2. Its next move deals 1.3x.',
  run(c) { c.st(c.u, 'hidden', 2); c.u.k.nextMoveMul = 1.3; } });
defMove({ id: 'murk_fogbound', name: 'Fogbound', type: 'TIDE', owner: 'murk', reach: 'spread', cd: 6, nerve: 4, text: 'Hidden 1. Hits 5 times for 30% ATK: 3 on the foe, 2 on reserves.',
  run(c) {
    c.st(c.u, 'hidden', 1);
    const rs = reserves(c.them);
    for (let i = 0; i < 5; i++) { const t = i >= 3 && rs[i - 3] ? rs[i - 3] : c.tgt; if (!t.ko) c.hit(t, { atk: 0.3 }, t === c.tgt ? {} : { reserve: true }); }
  } });

// undine: something drowned that rips with deep water, wraps kelp, shows a part of itself, and sings a foe still.
defSummon({ id: 'undine_image', name: 'Drowned Image', owner: 'undine', sprite: { px: ['........', '4.4.....', '.44.....', '33333333', '22222222', '24442222', '24142222', '22222222'], c: ['#2e4a68', '#70a7bf', '#bfd7cf'] }, text: 'Takes single-target hits meant for your out whorl. Each turn: hits the foe for 25% ATK.', every: 100, guard: true,
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'atk') * 0.25, 'P', 'TIDE'); } });
defPassive({ id: 'undine_undercurrent', name: 'Under Pull', owner: 'undine', text: 'Every 4th attack: Expose 2, and each foe reserve takes 55% MGK.',
  afterAttack(b, f, t) { f.k.rip = (f.k.rip || 0) + 1; if (f.k.rip % 4 !== 0) return; if (!t.ko && !t.gone) applyStatus(b, f, t, 'expose', 2); for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.55, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'undine_toobig', name: 'Bigger Below', owner: 'undine', text: 'Has 1.1x max HP.',
  start(b, f) { const add = Math.round(f.maxHp * 0.1); f.maxHp += add; f.hp += add; } });
defMove({ id: 'undine_fathom', name: 'Deep Rip', type: 'TIDE', owner: 'undine', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 60% MGK. The foe loses 3 DEF, up to 15.',
  run(c) { c.spread({ mgk: 0.6 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.tgt.k.shred = Math.min(15, (c.tgt.k.shred || 0) + 3); } });
defMove({ id: 'undine_kelphold', name: 'Kelp Wrap', type: 'TIDE', owner: 'undine', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 100% MGK. Root 3.',
  run(c) { c.hit(c.tgt, { mgk: 1 }); c.st(c.tgt, 'root', 3); } });
defMove({ id: 'undine_glimpse', name: 'Show a Part', type: 'TIDE', owner: 'undine', reach: 'side', cd: 5, text: 'Summons 2 Drowned Images (7% max HP, 2 turns).',
  run(c) { summon(c.b, c.u, 'undine_image', { hp: 0.07, turns: 2 }); summon(c.b, c.u, 'undine_image', { hp: 0.07, turns: 2 }); } });
defMove({ id: 'undine_undersong', name: 'Deep Song', type: 'TIDE', owner: 'undine', reach: 'single', tags: ['channel'], cd: 6, nerve: 5, text: 'Stasis 2 on the foe. Your team heals 10% of max HP.',
  run(c) { c.st(c.tgt, 'stasis', 2); for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.1); } });

// lip: a piece of the Lip that bites, pulls a reserve over the edge, crumbles on both, and pulls apart.
defMark({ id: 'lip_rot', name: 'crumbling', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { const t = foe(b, f); dealDamage(b, null, f, f.maxHp * 0.03, dot('T'), null); if (t) { dealDamage(b, f, t, t.maxHp * 0.06, dot('T'), null); applyStatus(b, f, t, 'slow', 1); } } });
defMark({ id: 'lip_apart', name: 'pulling apart', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { unmark(f, 'lip_apart'); const t = foe(b, f); if (!t) return; const d = strike(b, f, t, stat(b, f, 'atk') * 0.5 + t.maxHp * 0.04, 'P', 'BEAST'); heal(b, f, f, d * 0.5); } });
defPassive({ id: 'lip_heaped', name: 'Heavier', owner: 'lip', text: 'When a foe is KO\'d while it is out: +8% max HP for the battle.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) { const add = Math.round(f.st.hp * 0.08); f.maxHp += add; heal(b, f, f, add); } } });
defPassive({ id: 'lip_overhang', name: 'Overhang', owner: 'lip', text: 'Takes 0.88x magic damage. Its moves add 4% of its max HP.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.88 : 1; },
  addRaw(b, f, t, d) { return d.move ? f.maxHp * 0.04 : 0; } });
defMove({ id: 'lip_gnaw', name: 'Edge Bite', type: 'BEAST', owner: 'lip', reach: 'single', cd: 1, text: 'Hits for 110% ATK. Rot 2.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); c.st(c.tgt, 'rot', 2); } });
defMove({ id: 'lip_pullover', name: 'Over the Edge', type: 'BEAST', owner: 'lip', reach: 'dragin', tags: ['projectile'], cd: 3, text: 'Drags in a reserve. Hits it for 101% ATK.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 1.01 }); } });
defMove({ id: 'lip_fester', name: 'Crumble', type: 'BEAST', owner: 'lip', reach: 'self', cd: 3, wt: 60, text: '3 turns: it loses 3% max HP and the foe loses 6% max HP, Slow 1.',
  run(c) { c.mark(c.u, 'lip_rot', 1, 3); } });
defMove({ id: 'lip_pullapart', name: 'Pull Apart', type: 'BEAST', owner: 'lip', reach: 'single', tags: ['channel'], cd: 6, nerve: 5, text: 'Stun 2. Hits for 58% ATK + 4% of the foe\'s max HP. At its next turn: 50% ATK + 4%. Heals 50% of both.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.58, tgtHp: 0.04 }); c.heal(c.u, d * 0.5); c.st(c.tgt, 'stun', 2); c.mark(c.u, 'lip_apart', 1, 2); } });

// ================================================================ the shallows

// rumple: a wrinkle in the ground that rucks a foe, folds every foe together, puckers, and raises a corner to guard.
defMark({ id: 'rumple_bond', name: 'folded', clock: 'own', negative: true, value: -0.1,
  afterTake(b, f, src, dealt, d) {
    if (d.dot || d.reserve || f.k.bondPassing) return;
    for (const r of reserves(b.s[f.side])) if (marked(r, 'rumple_bond')) { r.k.bondPassing = 1; dealDamage(b, src, r, dealt * 0.25, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: true }, null); r.k.bondPassing = 0; }
  } });
defMark({ id: 'rumple_word', name: 'rucked', clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.rumple_word; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'mgk') * 0.28, 'M', 'ROOT'); } });
defSummon({ id: 'rumple_golem', name: 'Raised Corner', owner: 'rumple', sprite: { px: ['........', '..3333..', '..2222..', '.232232.', '.222222.', '22222222', '4.4..4.4', '........'], c: ['#9e805e', '#7ad959', '#50405e'] }, text: 'Takes single-target hits for your out whorl. Each turn: hits the foe for 30% MGK.', every: 100, guard: true,
  act(b, s, owner) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (t && !t.ko && owner) strike(b, owner, t, stat(b, owner, 'mgk') * 0.3, 'M', 'ROOT'); } });
defPassive({ id: 'rumple_foldover', name: 'Fold Over', owner: 'rumple', text: 'When a Folded foe is hit: each Folded foe in reserve takes 25% of the damage. Deals 1.15x to Folded foes.',
  outMul(b, f, t) { return marked(t, 'rumple_bond') ? 1.15 : 1; } });
defPassive({ id: 'rumple_give', name: 'Give Way', owner: 'rumple', text: 'While its Raised Corner stands: your out whorl heals 2% of max HP a turn.',
  turnStart(b, f) { if (summonsOf(b, f.side, 'rumple_golem').length) heal(b, f, f, f.maxHp * 0.02); },
  reserveTurn(b, f) { if (summonsOf(b, f.side, 'rumple_golem').length) { const o = outOf(b, f); if (!o.ko) heal(b, f, o, o.maxHp * 0.02); } } });
defMove({ id: 'rumple_ruck', name: 'Ruck Up', type: 'ROOT', owner: 'rumple', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 47% MGK. At the foe\'s next 2 turns: it takes 28% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.47 }); if (!c.tgt.ko) c.mark(c.tgt, 'rumple_word', 1, 2); } });
defMove({ id: 'rumple_buckle', name: 'Buckle Under', type: 'ROOT', owner: 'rumple', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits for 32% MGK. Every foe is Folded for 3 turns.',
  run(c) { for (const e of standing(c.them)) c.mark(e, 'rumple_bond', 1, 3); c.hit(c.tgt, { mgk: 0.32 }); } });
defMove({ id: 'rumple_pucker', name: 'Pucker Up', type: 'ROOT', owner: 'rumple', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 32% MGK. Slow 2. Weaken 1. Delays the foe\'s next turn 30%.',
  run(c) { c.hit(c.tgt, { mgk: 0.32 }); c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'weaken', 1); c.delay(c.tgt, 30); } });
defMove({ id: 'rumple_upfold', name: 'Fold Up', type: 'ROOT', owner: 'rumple', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 57% MGK. Stun 1. Summons a Raised Corner (25% max HP, 3 turns).',
  run(c) { c.spread({ mgk: 0.57 }); c.st(c.tgt, 'stun', 1); summon(c.b, c.u, 'rumple_golem', { hp: 0.25, turns: 3 }); } });

// sag: a salt dip that wears mud Layers, gathers Drops to let go at once, settles in, and sends up mud puppies.
defMark({ id: 'sag_layer', name: 'layers', max: 4, value: 0.05 });
defSummon({ id: 'sag_familiar', name: 'Mud Puppy', owner: 'sag', sprite: { px: ['........', '4......4', '44.33.44', '.422224.', '.212212.', '.222222.', '.2....2.', '........'], c: ['#7d634c', '#ebefef', '#493f47'] }, text: 'Each turn: hits the foe for 30% of Notbomi\'s MGK. The first puppy\'s first hit: Stun 1.', every: 100,
  act(b, s, owner) {
    const t = b.s[1 - s.side].f[b.s[1 - s.side].out];
    if (!t || t.ko || !owner) return;
    strike(b, owner, t, stat(b, owner, 'mgk') * 0.3, 'M', 'TIDE');
    if (s.v && !t.ko) { s.v = 0; applyStatus(b, owner, t, 'stun', 1); }
  } });
defPassive({ id: 'sag_sediment', name: 'Laid Down', owner: 'sag', text: 'Starts with 4 Layers. Each Layer: takes 6% less damage. A hit over 10% of its max HP strips one. One grows back every 2 turns.',
  start(b, f) { mark(b, f, f, 'sag_layer', 4); },
  inMul(b, f) { return 1 - 0.06 * marked(f, 'sag_layer'); },
  afterTake(b, f, src, dealt, d) { if (!d.dot && dealt > f.maxHp * 0.1) shed(f, 'sag_layer', 1); },
  turnStart(b, f) { f.k.layerT = (f.k.layerT || 0) + 1; if (f.k.layerT % 2 === 0 && marked(f, 'sag_layer') < 4) mark(b, f, f, 'sag_layer', 1); } });
defPassive({ id: 'sag_seepage', name: 'Seeps In', owner: 'sag', text: 'When it hits or is hit: 1 Drop, up to 5, for Cold Hollow.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) f.k.souls = Math.min(5, (f.k.souls || 0) + 1); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.souls = Math.min(5, (f.k.souls || 0) + 1); } });
defMove({ id: 'sag_runoff', name: 'Run Off', type: 'TIDE', owner: 'sag', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 86% MGK. Slow 1. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.86 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 20); } });
defMove({ id: 'sag_coldhollow', name: 'Cold Hollow', type: 'TIDE', owner: 'sag', reach: 'single', tags: ['dash', 'spell'], cd: 3, text: 'Spends Drops: hits for 43% MGK + 18% MGK per Drop.',
  run(c) { const n = c.u.k.souls || 0; c.u.k.souls = 0; c.hit(c.tgt, { mgk: 0.43 + 0.18 * n }); } });
defMove({ id: 'sag_sinkhole', name: 'Settle In', type: 'TIDE', owner: 'sag', reach: 'self', cd: 5, wt: 60, text: 'Untouchable 1. Regen 2. All 4 Layers back.',
  run(c) { c.st(c.u, 'invuln', 1); c.st(c.u, 'regen', 2, 0.06); unmark(c.u, 'sag_layer'); c.mark(c.u, 'sag_layer', 4); } });
defMove({ id: 'sag_subside', name: 'Mud Up', type: 'TIDE', owner: 'sag', reach: 'side', cd: 6, nerve: 5, text: 'Summons 2 Mud Puppies (12% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'sag_familiar', { hp: 0.12, turns: 3, v: 1 }); summon(c.b, c.u, 'sag_familiar', { hp: 0.12, turns: 3 }); } });

// furrow: a walking craze that throws thorns, crazes the ground under foes, slips into its crack, and rings a foe in thorns.
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
    if (t && !t.ko) applyStatus(b, by, t, 'stun', 2);
  } });
defPassive({ id: 'furrow_walker', name: 'Crack Walker', owner: 'furrow', text: 'Its moves deal 1.2x damage to a Rooted foe.',
  outMul(b, f, t, d) { return d.move && t.s.root ? 1.2 : 1; } });
defPassive({ id: 'furrow_illfooting', name: 'Ill Footing', owner: 'furrow', text: 'Foes it Roots also get Slow 1.',
  afterApply(b, f, t, id) { if (id === 'root' && t.side !== f.side) applyStatus(b, f, t, 'slow', 1); } });
defMove({ id: 'furrow_split', name: 'Crack Thorn', type: 'ROOT', owner: 'furrow', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 125% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.25 }); } });
defMove({ id: 'furrow_maze', name: 'Crazed Ground', type: 'ROOT', owner: 'furrow', reach: 'single', tags: ['spell'], cd: 4, text: 'Hits for 70% MGK. Root 1. Summons a Thorn Tangle (12% max HP).',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'root', 1); summon(c.b, c.u, 'furrow_maze', { hp: 0.12, turns: 3 }); } });
defMove({ id: 'furrow_underfold', name: 'Into the Crack', type: 'ROOT', owner: 'furrow', reach: 'self', cd: 4, wt: 50, text: 'Hidden 1. Its next move deals 1.5x.',
  run(c) { c.st(c.u, 'hidden', 1); c.u.k.nextMoveMul = 1.5; } });
defMove({ id: 'furrow_circlet', name: 'Thorn Ring', type: 'ROOT', owner: 'furrow', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 50% MGK. After 2 of the foe\'s turns: every foe takes 80% MGK. Stun 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); if (!c.tgt.ko) c.mark(c.tgt, 'furrow_crown', 1, 2); } });

export const KITS4_LOADED = true;
void sk; void lowestAlly; void setMove; void doSwitch; void cleanse; void moveIdx;
