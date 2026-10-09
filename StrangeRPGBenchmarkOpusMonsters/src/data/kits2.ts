import { addCharge, addNerve, applyStatus, forceAction, summon, summonsOf, cameOutSince, cleanse, negatives, clearForm, dealDamage, delayFighter, foeOf, giveShield, has, heal, hastenFighter, isOut, label, mark, marked, markedBy, msg, reserves, setForm, setMove, standing, stat, unmark, emit, SPREAD_SHARE } from '../battle/engine';
import type { Battle, Fighter, SpriteData } from '../battle/model';
import { defMark, defMove, defPassive, defSummon, MOVES, type Ctx, type DmgInfo } from '../battle/registry';
import type { Type } from './types';

const dot = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
const plain = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: false, spread: false, reserve: false });
const lowestAlly = (c: Ctx): Fighter => standing(c.me).slice().sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0] || c.u;
const pctOut = (t: Fighter, p: number) => t.hp < t.maxHp * p;

/** Damage from a hook rather than a move: the out foe in full, each foe reserve at the spread share. */
function splash(b: Battle, u: Fighter, raw: number, kind: 'P' | 'M', type: Type | null, noGuard = false): number {
  const them = b.s[1 - u.side];
  const t = them.f[them.out];
  let dealt = 0;
  if (t && !t.ko && !t.gone) dealt = dealDamage(b, u, t, raw, { kind, move: null, attack: false, dot: false, spread: true, reserve: false }, type, 1, noGuard);
  for (const r of reserves(them)) dealDamage(b, u, r, raw * SPREAD_SHARE, { kind, move: null, attack: false, dot: false, spread: true, reserve: true }, type);
  return dealt;
}

/** HP paid as a cost. It never drops the payer below 1 HP. */
function payHp(b: Battle, f: Fighter, amt: number): void {
  const a = Math.min(f.hp - 1, Math.round(amt));
  if (a <= 0) return;
  f.hp -= a;
  emit(b, { e: 'dmg', side: f.side, idx: f.idx, amt: a, kind: 'T', eff: 1, shield: 0 });
}

/** Takes n off every cooldown of f except the crest and the slot named. */
function cutCooldowns(f: Fighter, n: number, skip = -1): void {
  f.moves.forEach((id, i) => { if (i !== skip && !MOVES[id]?.nerve) f.cd[i] = Math.max(0, f.cd[i] - n); });
}

// ================================================================ GEAR

// orrery: a brass sky that sets planets on orbits, spins faster, and brings an ally back round.
function orreryBurst(b: Battle, by: Fighter | null, t: Fighter): void {
  if (t.ko || t.gone) return;
  msg(b, `The planet round ${label(b, t)} comes down.`);
  const raw = by ? stat(b, by, 'mgk') * 1.15 : 60;
  const src = by && !by.ko ? by : null;
  dealDamage(b, src, t, raw, plain('M'), 'GEAR');
  for (const r of reserves(b.s[t.side])) dealDamage(b, src, r, raw * SPREAD_SHARE, { ...plain('M'), spread: true, reserve: true }, 'GEAR');
}
defMark({ id: 'orrery_bomb', name: 'in orbit', clock: 'own', negative: true, value: -0.12,
  expire(b, f, mk) { orreryBurst(b, markedBy(b, mk), f); } });
defMark({ id: 'orrery_shift', name: 'on an orbit', clock: 'own', value: 0.2,
  wouldKO(b, f) {
    unmark(f, 'orrery_shift');
    f.hp = Math.max(1, Math.round(f.maxHp * 0.2)); f.shield = 0;
    msg(b, `${label(b, f)} comes back round.`);
    return true;
  } });
defPassive({ id: 'epicycle', name: 'Epicycle', owner: 'orrery', text: 'In reserve, every 3rd turn your side takes: your out whorl\'s cooldowns drop 1, except its crest.',
  reserveTurn(b, f) { f.k.bottle = (f.k.bottle || 0) + 1; if (f.k.bottle % 3 === 0) { const o = b.s[f.side].f[b.s[f.side].out]; if (!o.ko) cutCooldowns(o, 1); } } });
defPassive({ id: 'escapement', name: 'Conjunction', owner: 'orrery', text: 'Set Orbit on a foe that has a Planet: both land now. Stun 1.' });
defMove({ id: 'wind', name: 'Set Orbit', type: 'GEAR', owner: 'orrery', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 75% MGK. Leaves a Planet on the foe. After 2 of its turns, every foe takes 115% MGK.',
  run(c) {
    const had = c.marked(c.tgt, 'orrery_bomb') > 0;
    c.hit(c.tgt, { mgk: 0.75 });
    if (c.tgt.ko || c.blocked(c.tgt)) return;
    if (had && has(c.u, 'escapement')) { unmark(c.tgt, 'orrery_bomb'); orreryBurst(c.b, c.u, c.tgt); orreryBurst(c.b, c.u, c.tgt); c.st(c.tgt, 'stun', 1); return; }
    c.mark(c.tgt, 'orrery_bomb', 1, 2);
  } });
defMove({ id: 'unwind', name: 'Spin Faster', type: 'GEAR', owner: 'orrery', reach: 'single', tags: ['spell'], cd: 3, wt: 50, text: 'Hits for 59% MGK. Its other cooldowns drop 2, except its crest.',
  run(c) { c.hit(c.tgt, { mgk: 0.59 }); cutCooldowns(c.u, 2, c.u.moves.indexOf('unwind')); } });
defMove({ id: 'tick', name: 'Close Pass', type: 'GEAR', owner: 'orrery', reach: 'ally', cd: 3, text: 'Ally: Haste 2. Foe: Slow 1. Delays the foe\'s next turn by 20%.',
  run(c) { c.st(c.ally!, 'haste', 2); c.st(c.tgt, 'slow', 1); c.delay(c.tgt, 20); } });
defMove({ id: 'conjunction', name: 'Comes Round', type: 'GEAR', owner: 'orrery', reach: 'ally', cd: 6, nerve: 5,
  text: 'An ally KO\'d within its next 3 turns comes back at 20% HP.',
  run(c) { c.mark(c.ally!, 'orrery_shift', 1, 3); } });

// crane: a dock crane that hooks a reserve out, swings hot, lifts and drops, and lets the whole load go.
defMark({ id: 'crane_drive', name: 'swinging', clock: 'own', volatile: true, value: 0.05,
  expire(b, f) { applyStatus(b, f, f, 'slow', 1); } });
defMark({ id: 'crane_fist', name: 'load raised', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { unmark(f, 'crane_fist'); if (!t.ko && !t.gone) applyStatus(b, f, t, 'stun', 1); } });
defPassive({ id: 'counterweight', name: 'Counterweight', owner: 'crane', text: 'Once per battle, below 30% HP: a shield of 30% of its max HP.',
  afterTake(b, f) { if (!f.k.cw && f.hp > 0 && f.hp < f.maxHp * 0.3) { f.k.cw = 1; giveShield(b, f, f, f.maxHp * 0.3, 3); } } });
defPassive({ id: 'hoist', name: 'Cable Snap', owner: 'crane', text: 'Every 3rd attack: also hits for 40% MGK.',
  afterAttack(b, f, t) { f.k.zaps = (f.k.zaps || 0) + 1; if (f.k.zaps % 3 === 0 && !t.ko && !t.gone) dealDamage(b, f, t, stat(b, f, 'mgk') * 0.4, plain('M'), 'GEAR'); } });
defMove({ id: 'hook', name: 'Grab Hook', type: 'GEAR', owner: 'crane', reach: 'dragin', cd: 3, wu: 50,
  text: 'Wind-up. Drags in a chosen reserve. Hits for 90% ATK. Stun 1.',
  run(c) {
    const pick = c.pick >= 0 && !c.them.f[c.pick]?.ko ? c.pick : -1;
    if (pick >= 0 && pick !== c.them.out) c.dragIn(pick);
    const t = c.them.f[c.them.out];
    c.hit(t, { atk: 0.9 });
    c.st(t, 'stun', 1);
  } });
defMove({ id: 'swing', name: 'Full Swing', type: 'GEAR', owner: 'crane', reach: 'self', cd: 3, wt: 50, text: 'Haste 2. Slow 1 when it ends.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.u, 'crane_drive', 1, 2); } });
defMove({ id: 'lift', name: 'Lift and Drop', type: 'GEAR', owner: 'crane', reach: 'self', cd: 3, wt: 50, text: 'Its next attack deals 1.6x damage and adds Stun 1.',
  run(c) { c.u.k.nextAtkMul = 1.6; c.mark(c.u, 'crane_fist', 1, 2); } });
defMove({ id: 'staticfield', name: 'Drop the Load', type: 'GEAR', owner: 'crane', reach: 'spread', tags: ['spell'], cd: 5, nerve: 4, text: 'Hits every foe for 108% MGK. Delays the foe\'s next turn by 30%.',
  run(c) { c.spread({ mgk: 1.08 }); c.delay(c.tgt, 30); } });

// turbine: a wind pump that cuts with its vanes, lifts a foe in a whirlwind, shelters an ally, and blows the foe out.
defPassive({ id: 'tailwind', name: 'Sea Breeze', owner: 'turbine', text: 'In reserve: your out whorl gets +5 AGI and deals 1.05x damage.',
  auraOut() { return 1.05; } });
defPassive({ id: 'feather', name: 'Light Vanes', owner: 'turbine', text: 'Immune to Slow and to delays.',
  noDelay() { return true; }, statusImmune(f, id) { return id === 'slow'; } });
defMove({ id: 'spinup', name: 'Vane Cut', type: 'GEAR', owner: 'turbine', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 92% MGK. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.92 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'gale', name: 'Whirlwind', type: 'GEAR', owner: 'turbine', reach: 'single', tags: ['spell'], cd: 3, wu: 60, text: 'Wind-up. Hits for 84% MGK. Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.84 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'updraft', name: 'Lee Side', type: 'GEAR', owner: 'turbine', reach: 'ally', cd: 3, text: 'Shields an ally for 50% CHA + 6% of its max HP, 3 turns. Empower 2.',
  run(c) { c.shield(c.ally!, c.cha(0.5) + c.ally!.maxHp * 0.06, 3); c.st(c.ally!, 'empower', 2); } });
defMove({ id: 'monsoon', name: 'Onshore Wind', type: 'GEAR', owner: 'turbine', reach: 'team', cd: 6, nerve: 5,
  text: 'Your team heals 20% max HP, now and next turn. Forces the foe out.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.2); c.u.k.monsoon = 1; c.forceOut(); } });

// perigee: a fallen watcher that bounces signals, sweeps the line, pins a foe, and makes three last passes.
defMark({ id: 'perigee_dart', name: 'pinned', clock: 'own', negative: true, value: -0.05,
  beforeTake(b, f, src, amt, d) {
    const mk = f.m.perigee_dart;
    return mk && src && markedBy(b, mk) === src && f.s.guard && !d.dot ? amt * 2 : amt;
  } });
defMark({ id: 'perigee_fury', name: 'beaming', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { msg(b, 'A beam goes through the line.'); splash(b, f, stat(b, f, 'atk') * 0.85, 'P', 'GEAR', true); } });
defPassive({ id: 'orbit', name: 'Far Watch', owner: 'perigee', text: 'Its moves ignore Ward and Fortify.' });
defPassive({ id: 'telemetry', name: 'Locked On', owner: 'perigee', text: 'Deals 1.3x damage to foes with Slow, Root, Stun, Sleep, or Expose.',
  outMul(b, f, t) { return t.s.slow || t.s.root || t.s.stun || t.s.sleep || t.s.expose ? 1.3 : 1; } });
defMove({ id: 'ping', name: 'Bounce Signal', type: 'GEAR', owner: 'perigee', reach: 'spread', tags: ['projectile'], cd: 1, text: 'Hits every foe for 87% ATK.',
  run(c) { c.spread({ atk: 0.87 }); } });
defMove({ id: 'fix', name: 'Sweep', type: 'GEAR', owner: 'perigee', reach: 'spread', tags: ['projectile'], cd: 3, text: 'Expose 2. Each reserve gets Expose 1.',
  run(c) { c.st(c.tgt, 'expose', 2); for (const r of reserves(c.them)) c.st(r, 'expose', 1); } });
defMove({ id: 'burnin', name: 'Pinpoint', type: 'GEAR', owner: 'perigee', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 108% ATK. For 2 turns the foe\'s guard doesn\'t cut its damage.',
  run(c) { c.hit(c.tgt, { atk: 1.08 }); if (!c.tgt.ko) c.mark(c.tgt, 'perigee_dart', 1, 2); } });
defMove({ id: 'deorbit', name: 'Last Pass', type: 'GEAR', owner: 'perigee', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, noGuard: true,
  text: 'Hits every foe for 102% ATK through guard. At its next 2 turns: every foe takes 85% ATK.',
  run(c) { c.spread({ atk: 1.02 }); c.mark(c.u, 'perigee_fury', 1, 2); } });

// furnace: a furnace that roars every fourth move, plates a friend in heat, and lets its slag crab out.
defMark({ id: 'furnace_molten', name: 'hot plate', clock: 'own', value: 0.06,
  afterTake(b, f, src) {
    const mk = f.m.furnace_molten;
    const by = mk ? markedBy(b, mk) : null;
    if (src && src.side !== f.side && !src.ko && by) applyStatus(b, by, src, 'burn', 2, stat(b, by, 'mgk') * 0.25);
  } });
defSummon({ id: 'furnace_bear', name: 'Slag Crab', owner: 'furnace', text: 'Each turn: hits the foe for 35% of Camado\'s MGK. Burn 1. Stays if Camado is KO\'d.', every: 100, lasting: true,
  sprite: { px: ['........', '.4....4.', '.44..44.', '22222222', '21222212', '22333322', '11444411', '.2....2.'], c: ['#ffa040', '#ffe2a8', '#4c4a62'] },
  act(b, s) {
    const f = b.s[s.side].f[s.by];
    const t = b.s[1 - s.side].f[b.s[1 - s.side].out];
    if (!f || !t || t.ko || t.gone) return;
    msg(b, 'The crab pinches.');
    dealDamage(b, f.ko ? null : f, t, stat(b, f, 'mgk') * 0.35, plain('M'), 'GEAR');
    if (!t.ko) applyStatus(b, f, t, 'burn', 1, stat(b, f, 'mgk') * 0.2);
  } });
const bearOut = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'furnace_bear').length > 0;
defPassive({ id: 'radiant', name: 'Stoked Full', owner: 'furnace', text: 'Every 4th move it uses: Stun 1 on the foe.',
  afterMove(b, f) {
    f.k.pyro = (f.k.pyro || 0) + 1;
    if (f.k.pyro % 4 !== 0) return;
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) { msg(b, `${label(b, f)} roars.`); applyStatus(b, f, t, 'stun', 1); }
  } });
defPassive({ id: 'banked', name: 'Slag Shelter', owner: 'furnace', text: 'While its Slag Crab is out: takes 0.85x damage, and its attacks add Burn 2.',
  inMul(b, f) { return bearOut(b, f) ? 0.85 : 1; },
  afterAttack(b, f, t) { if (bearOut(b, f) && !t.ko && !t.gone) applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.2); } });
defMove({ id: 'stoke', name: 'Coal Shot', type: 'GEAR', owner: 'furnace', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 120% MGK. If it KOs the foe: cooldown resets, 1 tide.',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }); if (c.tgt.ko) { const i = c.u.moves.indexOf('stoke'); if (i >= 0) c.u.cd[i] = 0; c.nerve(c.me, 1); } } });
defMove({ id: 'flue', name: 'Open Flue', type: 'GEAR', owner: 'furnace', reach: 'spread', tags: ['spell'], cd: 2, text: 'Hits every foe for 72% MGK. Burn 1.',
  run(c) { c.spread({ mgk: 0.72 }); c.st(c.tgt, 'burn', 1, stat(c.b, c.u, 'mgk') * 0.2); } });
defMove({ id: 'firebox', name: 'Hot Plate', type: 'GEAR', owner: 'furnace', reach: 'ally', cd: 3, text: 'Shields an ally 15% of its max HP, 2 turns. Its attackers get Burn 2.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.15, 2); c.mark(c.ally!, 'furnace_molten', 1, 2); } });
defMove({ id: 'blastheat', name: 'Let It Out', type: 'GEAR', owner: 'furnace', reach: 'single', tags: ['spell'], cd: 6, nerve: 5,
  text: 'Hits for 120% MGK. Summons a Slag Crab (25% of its max HP, 3 turns).',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }); summon(c.b, c.u, 'furnace_bear', { hp: 0.25, turns: 3 }); } });

// piston: a piston that strokes quicker each time, slams in steam, holds pressure, and drops from the top.
defMark({ id: 'piston_block', name: 'holding pressure', clock: 'own', volatile: true, value: 0.12,
  inMul() { return 0.4; },
  afterTake(b, f, src, dealt) { if (dealt > 0) f.k.charged = 1; } });
defMark({ id: 'piston_meteor', name: 'top of the stroke', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    unmark(f, 'piston_meteor');
    msg(b, `${label(b, f)} comes down the stroke.`);
    splash(b, f, stat(b, f, 'atk') * 1.35, 'P', 'GEAR');
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 2);
  } });
defPassive({ id: 'stroke', name: 'Packing', owner: 'piston', text: 'When a move deals damage: a shield of 6% of its max HP, up to 24%.',
  afterMove(b, f) { if (!f.k.dealt) return; const room = f.maxHp * 0.24 - f.shield; if (room > 0) giveShield(b, f, f, Math.min(room, f.maxHp * 0.06), 3); } });
defPassive({ id: 'pressure', name: 'Blow-off', owner: 'piston', text: 'Its attacks hit each foe reserve for 25% ATK.',
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.25, { ...plain('P'), spread: true, reserve: true }, null); } });
defMove({ id: 'drive', name: 'In Stroke', type: 'GEAR', owner: 'piston', reach: 'single', cd: 1, text: 'Hits for 72% ATK. Its next turn comes 10% sooner per use, up to 30%.',
  run(c) {
    if (c.u.k.driveAt !== c.u.outAt) { c.u.k.driveAt = c.u.outAt; c.u.k.drives = 0; }
    const charged = c.u.k.charged ? 1.5 : 1;
    c.u.k.charged = 0;
    c.hit(c.tgt, { atk: 0.72 }, { mult: charged });
    c.u.k.drives = Math.min(3, (c.u.k.drives || 0) + 1);
    c.hasten(c.u, 10 * c.u.k.drives);
  } });
defMove({ id: 'plunge', name: 'Steam Slam', type: 'GEAR', owner: 'piston', reach: 'spread', tags: ['dash'], cd: 2, text: 'Hits every foe for 45% ATK. Slow 1.',
  run(c) { c.spread({ atk: 0.45 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'vent', name: 'Hold Pressure', type: 'GEAR', owner: 'piston', reach: 'self', tags: ['dash'], cd: 3, wt: 50, text: 'Until its next turn: takes 0.4x damage. If it is hit: its next In Stroke deals 1.5x.',
  run(c) { c.mark(c.u, 'piston_block', 1, 1); } });
defMove({ id: 'fullstroke', name: 'Long Stroke', type: 'GEAR', owner: 'piston', reach: 'self', tags: ['dash'], cd: 6, nerve: 4,
  text: 'Untouchable 1. At its next turn: hits every foe for 135% ATK. Slow 2.',
  run(c) { c.st(c.u, 'invuln', 1); c.mark(c.u, 'piston_meteor', 1, 2); } });

// dynamo: a humming dynamo that charges what it hits, jumps the gap, spins up, and coils a field.
defPassive({ id: 'charge', name: 'Builds Charge', owner: 'dynamo', text: 'Its damaging moves add a Charge to the foe. At 3 Charges: Stun 1, reset.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) addCharge(b, f, t); } });
defPassive({ id: 'ground', name: 'Third Hum', owner: 'dynamo', text: 'Every 3rd attack: also hits for 40% MGK and adds a Charge.',
  afterAttack(b, f, t) {
    f.k.surgeA = (f.k.surgeA || 0) + 1;
    if (f.k.surgeA % 3 !== 0 || t.ko || t.gone) return;
    dealDamage(b, f, t, stat(b, f, 'mgk') * 0.4, plain('M'), 'GEAR');
    if (!t.ko) addCharge(b, f, t);
  } });
defMove({ id: 'spark', name: 'Brush Spark', type: 'GEAR', owner: 'dynamo', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 132% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.32 }); } });
defMove({ id: 'arc', name: 'Jump the Gap', type: 'GEAR', owner: 'dynamo', reach: 'single', tags: ['dash', 'spell'], cd: 2, text: 'Hits for 97% MGK. On a foe with a Charge: 1.5x damage, 1 more Charge.',
  run(c) { const ch = (c.tgt.k.charge || 0) > 0; c.hit(c.tgt, { mgk: 0.97 }, { mult: ch ? 1.5 : 1 }); if (ch && !c.tgt.ko && !c.blocked(c.tgt)) addCharge(c.b, c.u, c.tgt); } });
defMove({ id: 'induct', name: 'Spin Up', type: 'GEAR', owner: 'dynamo', reach: 'self', tags: ['dash'], cd: 3, wt: 60, text: 'Haste 2. Fortify 1. The foe gets a Charge.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'fortify', 1); if (!c.blocked(c.tgt)) addCharge(c.b, c.u, c.tgt); } });
defMove({ id: 'stormcoil', name: 'Field Coil', type: 'GEAR', owner: 'dynamo', reach: 'spread', tags: ['dash', 'spell'], cd: 6, nerve: 5,
  text: 'Hits every foe for 68% MGK. At its next 2 turns: hits for 60% MGK and adds a Charge.',
  run(c) { c.spread({ mgk: 0.68 }); c.u.k.storm = 2; } });

// siren: a whistling buoy that rattles, drowns out a foe that speaks, swells louder, and sounds for everyone.
defMark({ id: 'siren_curse', name: 'rattled', clock: 'own', negative: true, value: -0.08,
  turnStart(b, f) {
    const mk = f.m.siren_curse;
    const by = mk ? markedBy(b, mk) : null;
    if (by) dealDamage(b, by.ko ? null : by, f, stat(b, by, 'mgk') * 0.3, dot('M'), null);
  },
  anyMove(b, f, user, m) { const mk = f.m.siren_curse; if (user === f && m && mk && mk.t > 0 && mk.t < 4) mk.t++; } });
defMark({ id: 'siren_word', name: 'hushed', clock: 'own', volatile: true, negative: true, value: -0.12,
  anyMove(b, f, user, m) {
    if (user !== f || !m) return;
    const mk = unmark(f, 'siren_word');
    const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    msg(b, `${label(b, f)} is drowned out.`);
    dealDamage(b, by.ko ? null : by, f, stat(b, by, 'mgk') * 0.8, plain('M'), 'GEAR');
    if (!f.ko) applyStatus(b, by, f, 'silence', 1);
  } });
defMark({ id: 'siren_glaives', name: 'swelling', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'mgk') * 0.4 : 0; } });
defPassive({ id: 'alarm', name: 'Fog Warning', owner: 'siren', text: 'Once per battle: when one of yours drops below 30% HP, 2 tide.' });
defPassive({ id: 'wail', name: 'Long Blast', owner: 'siren', text: 'Its Silences last 1 turn longer.' });
defMove({ id: 'blare', name: 'Clank', type: 'GEAR', owner: 'siren', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 65% MGK. Clank 2: the foe takes 30% MGK each turn. Each move it uses adds 1 turn.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); if (!c.tgt.ko) c.mark(c.tgt, 'siren_curse', 1, 2); } });
defMove({ id: 'shriek', name: 'Hush Blast', type: 'GEAR', owner: 'siren', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 60% MGK. If the foe uses a move at its next turn: it takes 80% MGK. Silence 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); if (!c.tgt.ko) c.mark(c.tgt, 'siren_word', 1, 1); } });
defMove({ id: 'allclear', name: 'Rising Swell', type: 'GEAR', owner: 'siren', reach: 'self', cd: 3, wt: 60, text: 'For 3 turns its attacks add 40% MGK.',
  run(c) { c.mark(c.u, 'siren_glaives', 1, 3); } });
defMove({ id: 'klaxon', name: 'Fog Signal', type: 'GEAR', owner: 'siren', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 80% MGK. Silence 1 on every foe, reserves too.',
  run(c) { c.spread({ mgk: 0.8 }); for (const e of standing(c.them)) c.st(e, 'silence', 1); } });

// ================================================================ BEAST

// howl: a pale wolf that heals on the bite, chases what comes out, howls at the moon, and never lets go.
defPassive({ id: 'bloodscent', name: 'Old Scent', owner: 'howl', text: 'Deals 1.2x damage to foes below 50% HP. Haste 1 when a foe first drops below 30%.',
  outMul(b, f, t) { return pctOut(t, 0.5) ? 1.2 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !t.ko && pctOut(t, 0.3) && !t.k.scented) { t.k.scented = 1; applyStatus(b, f, f, 'haste', 1); } } });
defPassive({ id: 'pack', name: 'Lean Years', owner: 'howl', text: 'Its attacks heal 15% of the damage dealt, 30% while it is below 50% HP.',
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * (pctOut(f, 0.5) ? 0.3 : 0.15)); } });
defMove({ id: 'bite', name: 'Jaw', type: 'BEAST', owner: 'howl', reach: 'single', cd: 1, text: 'Hits for 62% ATK + 3% of the foe\'s max HP. Heals 20% of the damage.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.62, tgtHp: 0.03 }); c.heal(c.u, d * 0.2); } });
defMove({ id: 'rundown', name: 'Nose Down', type: 'BEAST', owner: 'howl', reach: 'single', cd: 2, text: 'Hits for 53% ATK. 1.5x if the foe came out since its last turn.',
  run(c) { c.hit(c.tgt, { atk: 0.53 }, { mult: cameOutSince(c.b, c.tgt, c.u) ? 1.5 : 1 }); } });
defMove({ id: 'hackles', name: 'Moon Howl', type: 'BEAST', owner: 'howl', reach: 'single', cd: 5, wt: 60, text: 'The foe must switch at its next turn. Fortify 2.',
  run(c) { c.st(c.u, 'fortify', 2); if (!c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'switch'); } });
defMove({ id: 'pindown', name: 'Never Let Go', type: 'BEAST', owner: 'howl', reach: 'single', cd: 5, nerve: 4, text: 'Hits 3 times for 35% ATK. Stun 1. Heals 40% of the damage.',
  run(c) { c.st(c.tgt, 'stun', 1); let d = 0; for (let i = 0; i < 3; i++) d += c.hit(c.tgt, { atk: 0.35 }); c.heal(c.u, d * 0.4); } });

// yoke: a yoke that ploughs the ground up, shoves a foe out, stamps furrows, and pulls through anything.
defMark({ id: 'yoke_hoof', name: 'trodden', max: 3, volatile: true, negative: true, value: -0.08 });
defMark({ id: 'yoke_stomp', name: 'stamping', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) {
    const t = foeOf(b, f);
    if (t.ko || t.gone) return;
    dealDamage(b, f, t, stat(b, f, 'atk') * 0.4, plain('P'), 'BEAST');
    if (t.ko) return;
    mark(b, f, t, 'yoke_hoof', 1, -1);
    if (marked(t, 'yoke_hoof') >= 3) { unmark(t, 'yoke_hoof'); applyStatus(b, f, t, 'stun', 1); }
  } });
defPassive({ id: 'trample', name: 'Field Rest', owner: 'yoke', text: 'When it Stuns or forces out a foe: heals 6% of its max HP, reserves 3%.' });
defPassive({ id: 'unbroken', name: 'Hard Neck', owner: 'yoke', text: 'Takes 0.75x damage while it has a bad status.',
  inMul(b, f) { return negatives(f) > 0 ? 0.75 : 1; } });
defMove({ id: 'toss', name: 'Plough Up', type: 'BEAST', owner: 'yoke', reach: 'spread', cd: 2, text: 'Hits every foe for 80% ATK. Interrupts. Delays its next turn by 30%.',
  run(c) { c.spread({ atk: 0.8 }); c.interrupt(c.tgt); c.delay(c.tgt, 30); } });
defMove({ id: 'headbutt', name: 'Horn Shove', type: 'BEAST', owner: 'yoke', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 130% ATK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { atk: 1.3 }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'bellow', name: 'Stamp Furrows', type: 'BEAST', owner: 'yoke', reach: 'self', cd: 3, wt: 70, text: 'At its next 2 turns: hits for 40% ATK and adds a Hoof. At 3 Hooves: Stun 1.',
  run(c) { c.mark(c.u, 'yoke_stomp', 1, 2); } });
defMove({ id: 'undertheyoke', name: 'Pull Hard', type: 'BEAST', owner: 'yoke', reach: 'self', cd: 6, nerve: 4,
  text: 'Cleanses itself. Unstoppable 2. Fortify 2 (60% less damage).',
  run(c) { c.cleanse(c.u); c.st(c.u, 'unstop', 2); c.st(c.u, 'fortify', 2, 0.6); } });

// stoat: a winter stoat that marks prey with an icicle, snares the snow, warms a friend, and dances.
const STOAT_CAT: SpriteData = { px: ['........', '.....2.2', '44...222', '.2222212', '.222222.', '..22.2..', '.2.33.2.', '2...3..2'], c: ['#f2f2ee', '#9cd3f2', '#a26420'] };
defMark({ id: 'stoat_hunted', name: 'hunted', clock: 'own', negative: true, value: -0.06 });
defMark({ id: 'stoat_snare', name: 'snare set', value: 0.06,
  anyOut(b, f, who) {
    if (who.side === f.side) return;
    unmark(f, 'stoat_snare');
    msg(b, `${label(b, who)} steps in a snare.`);
    dealDamage(b, f, who, stat(b, f, 'atk') * 0.5, plain('P'), 'BEAST');
    if (who.ko) return;
    applyStatus(b, f, who, 'slow', 1);
    mark(b, f, who, 'stoat_hunted', 1, 2);
  } });
defMark({ id: 'stoat_cat', name: 'dancing', clock: 'own', value: 0.1,
  expire(b, f) { clearForm(b, f); msg(b, `${label(b, f)} stops dancing.`); },
  leave(b, f) { unmark(f, 'stoat_cat'); clearForm(b, f); } });
const stoatCat = (f: Fighter) => f.form?.tag === 'cat';
defPassive({ id: 'weasel', name: 'War Dance', owner: 'stoat', text: 'While it dances: deals 1.25x damage to Hunted foes.',
  outMul(b, f, t) { return stoatCat(f) && marked(t, 'stoat_hunted') ? 1.25 : 1; } });
defPassive({ id: 'wintercoat', name: 'Ermine', owner: 'stoat', text: 'While it dances: takes 0.85x damage.',
  inMul(b, f) { return stoatCat(f) ? 0.85 : 1; } });
defMove({ id: 'nip', name: 'Icicle Throw', type: 'BEAST', owner: 'stoat', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 170% ATK. Hunted 2.',
  run(c) { c.hit(c.tgt, { atk: 1.7 }); if (!c.tgt.ko) c.mark(c.tgt, 'stoat_hunted', 1, 2); } });
defMove({ id: 'dart', name: 'Snow Snare', type: 'BEAST', owner: 'stoat', reach: 'single', cd: 3, text: 'Hits for 100% ATK. Expose 1. Next foe out: 50% ATK, Slow 1, Hunted 2.',
  run(c) { c.hit(c.tgt, { atk: 1 }); c.st(c.tgt, 'expose', 1); c.mark(c.u, 'stoat_snare', 1); } });
defMove({ id: 'slipaway', name: 'Warm Den', type: 'BEAST', owner: 'stoat', reach: 'ally', cd: 3, text: 'Heals an ally 12% of its max HP + 15% CHA. Haste 1.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.12 + c.cha(0.15)); c.st(c.ally!, 'haste', 1); } });
defMove({ id: 'dance', name: 'Mad Dance', type: 'BEAST', owner: 'stoat', reach: 'self', tags: ['dash'], cd: 5, nerve: 3, wt: 60,
  text: 'Dances for 3 turns: 1.15x ATK, 1.1x AGI, and new moves. Haste 1.',
  run(c) {
    setForm(c.b, c.u, { tag: 'cat', sprite: STOAT_CAT, statMul: { atk: 1.15, agi: 1.1 } }, ['stoat_takedown', 'stoat_pounce', 'stoat_swipe']);
    c.mark(c.u, 'stoat_cat', 1, 3);
    c.st(c.u, 'haste', 1);
  } });
defMove({ id: 'stoat_takedown', name: 'Nape Bite', type: 'BEAST', owner: 'stoat', reach: 'single', cd: 1, extra: true,
  text: 'Hits for 90% ATK + 15% of the foe\'s missing HP. 1.5x if Hunted.',
  run(c) { c.hit(c.tgt, { atk: 0.9, tgtMiss: 0.15 }, { mult: marked(c.tgt, 'stoat_hunted') ? 1.5 : 1 }); } });
defMove({ id: 'stoat_pounce', name: 'Pounce Off', type: 'BEAST', owner: 'stoat', reach: 'single', cd: 2, extra: true,
  text: 'Hits for 85% ATK. Its next turn comes 30% sooner. On a Hunted foe: its cooldown resets.',
  run(c) { const h = marked(c.tgt, 'stoat_hunted') > 0; c.hit(c.tgt, { atk: 0.85 }); c.hasten(c.u, 30); if (h) { const i = c.u.moves.indexOf('stoat_pounce'); if (i >= 0) c.u.cd[i] = 0; } } });
defMove({ id: 'stoat_swipe', name: 'Snow Rake', type: 'BEAST', owner: 'stoat', reach: 'spread', cd: 2, extra: true,
  text: 'Hits every foe for 80% ATK.',
  run(c) { c.spread({ atk: 0.8 }); } });

// leech: a leech that latches and drains, sinks into mud, swells, and bursts full.
defPassive({ id: 'engorge', name: 'Swollen', owner: 'leech', text: 'Gains MGK equal to 3% of its max HP.',
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.maxHp * 0.03) : 0; } });
defPassive({ id: 'clot', name: 'Clotting', owner: 'leech', text: 'Immune to Rot. Takes 0.8x damage from Bleed and Poison.',
  inMul(b, f, src, d) { return d.dot && !d.move && d.kind !== 'M' ? 0.8 : 1; } });
defMove({ id: 'draw', name: 'Latch On', type: 'BEAST', owner: 'leech', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 118% MGK. Heals 40% of the damage. Every 3rd use: 1.5x.',
  run(c) { c.u.k.draws = (c.u.k.draws || 0) + 1; const d = c.hit(c.tgt, { mgk: 1.18 }, { mult: c.u.k.draws % 3 === 0 ? 1.5 : 1 }); c.heal(c.u, d * 0.4); } });
defMove({ id: 'pool', name: 'Sink in Mud', type: 'BEAST', owner: 'leech', reach: 'self', cd: 3, wt: 70, text: 'Slow 1 on the foe. Untouchable 1. Pays 10% of its current HP.',
  run(c) { payHp(c.b, c.u, c.u.hp * 0.1); c.st(c.u, 'invuln', 1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'bloat', name: 'Gorge', type: 'BEAST', owner: 'leech', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 75% MGK + 8% of its max HP. Pays 8% current HP.',
  run(c) { payHp(c.b, c.u, c.u.hp * 0.08); c.spread({ mgk: 0.75, selfHp: 0.08 }); } });
defMove({ id: 'hemorrhage', name: 'Burst Full', type: 'BEAST', owner: 'leech', reach: 'spread', cd: 6, nerve: 5,
  text: 'Expose 1. Next turn: hits every foe for 120% MGK, heals 25% of it.',
  run(c) { c.st(c.tgt, 'expose', 1); c.u.k.hemo = 1; } });

// carrion: a crow that pecks with a swirl of beaks, lands the flock, circles low, and becomes the flock.
const CARRION_DEMON: SpriteData = { px: ['2......2', '22.22.22', '22322322', '22222222', '33322222', '33.2.2.2', '3.2.2.2.', '.4.4....'], c: ['#393544', '#e13634', '#635969'] };
defMark({ id: 'carrion_demon', name: 'a flock', clock: 'own', value: 0.2,
  turnStart(b, f) {
    const them = b.s[1 - f.side];
    let total = 0;
    for (const e of standing(them)) {
      const out = e.idx === them.out;
      total += dealDamage(b, f, e, stat(b, f, 'atk') * 0.7 * (out ? 1 : SPREAD_SHARE), { ...plain('P'), spread: true, reserve: !out }, 'BEAST');
    }
    heal(b, f, f, total * 0.5);
  },
  expire(b, f) { msg(b, `${label(b, f)} lets the flock go.`); clearForm(b, f); },
  leave(b, f) { unmark(f, 'carrion_demon'); clearForm(b, f); } });
defPassive({ id: 'gather', name: 'Picks Over', owner: 'carrion', text: 'When a foe is KO\'d: +6% ATK for the battle. Heals 8% of its max HP.',
  anyKO(b, f, v) { if (v === f || v.side === f.side) return; f.k.souls = (f.k.souls || 0) + 1; heal(b, f, f, f.maxHp * 0.08); },
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.06 * (f.k.souls || 0)) : 0; } });
defPassive({ id: 'watch', name: 'Waits for It', owner: 'carrion', text: 'Deals true damage to foes below 30% HP.' });
defMove({ id: 'peck', name: 'Flock Peck', type: 'BEAST', owner: 'carrion', reach: 'spread', cd: 1, text: 'Hits every foe for 81% ATK.',
  run(c) { c.spread({ atk: 0.81 }); } });
defMove({ id: 'mob', name: 'Mobbing', type: 'BEAST', owner: 'carrion', reach: 'single', cd: 3, wu: 60, text: 'Wind-up. Hits for 128% ATK. Root 2. Expose 1.',
  run(c) { c.hit(c.tgt, { atk: 1.28 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'circle', name: 'Circle Low', type: 'BEAST', owner: 'carrion', reach: 'single', cd: 3, text: 'Hits for 102% ATK. Root 1. If the foe was already Rooted: delays its next turn by 30%.',
  run(c) { const rooted = !!c.tgt.s.root; c.hit(c.tgt, { atk: 1.02 }); c.st(c.tgt, 'root', 1); if (rooted) c.delay(c.tgt, 30); } });
defMove({ id: 'feast', name: 'Black Flock', type: 'BEAST', owner: 'carrion', reach: 'self', tags: ['projectile'], cd: 6, nerve: 5,
  text: 'Next 3 turns: hits every foe for 70% ATK. Heals 50% of the damage.',
  run(c) { setForm(c.b, c.u, { tag: 'demon', sprite: CARRION_DEMON }); c.mark(c.u, 'carrion_demon', 1, 3); } });

// gore: a bull that butts hard every third blow, charges, paws the sand, and comes from behind.
function goreBash(b: Battle, f: Fighter, t: Fighter): void {
  if (t.ko || t.gone) return;
  msg(b, `${label(b, f)} butts hard.`);
  dealDamage(b, f, t, stat(b, f, 'atk') * 0.4, plain('P'), 'BEAST');
  if (!t.ko) delayFighter(b, t, 30);
}
defPassive({ id: 'headdown', name: 'Third Butt', owner: 'gore', text: 'Every 3rd hit it lands: also hits for 40% ATK. Delays the foe\'s next turn by 30%.',
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.side === f.side || f.k.bashing) return;
    f.k.bashes = (f.k.bashes || 0) + 1;
    if (f.k.bashes % 3 === 0) { f.k.bashing = 1; goreBash(b, f, t); f.k.bashing = 0; }
  } });
defPassive({ id: 'thickneck', name: 'Bull Neck', owner: 'gore', text: 'Takes 0.8x damage while it has Haste or Unstoppable.',
  inMul(b, f) { return f.s.haste || f.s.unstop ? 0.8 : 1; } });
defMove({ id: 'horn', name: 'Hook Horn', type: 'BEAST', owner: 'gore', reach: 'single', cd: 1, text: 'Hits for 139% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.39 }); } });
defMove({ id: 'charge', name: 'Long Charge', type: 'BEAST', owner: 'gore', reach: 'single', tags: ['dash'], cd: 3, wu: 80, unstop: true,
  text: 'Unstoppable wind-up. Hits whoever is out for 150% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 1.5 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'stampmove', name: 'Paw the Sand', type: 'BEAST', owner: 'gore', reach: 'self', cd: 4, wt: 50, text: 'Haste 2. Unstoppable 2.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'unstop', 2); } });
defMove({ id: 'stampede', name: 'From Behind', type: 'BEAST', owner: 'gore', reach: 'single', cd: 6, nerve: 5,
  text: 'Hits for 220% ATK. Interrupts. Delays the foe\'s next turn by 30%.',
  run(c) { c.hit(c.tgt, { atk: 2.2 }); if (c.tgt.ko || c.blocked(c.tgt)) return; c.interrupt(c.tgt); c.delay(c.tgt, 30); } });

// thumb: a giant's thumb that presses, flicks, unclenches what it stored, and pins a foe flat.
defPassive({ id: 'grip', name: 'Thick Nail', owner: 'thumb', text: 'Takes 0.85x damage from moves.',
  inMul(b, f, src, d) { return d.move ? 0.85 : 1; } });
defPassive({ id: 'opposable', name: 'Clench', owner: 'thumb', text: 'When hit: 1 Clench, up to 5. Each Clench: +4% damage.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.uproar = Math.min(5, (f.k.uproar || 0) + 1); },
  outMul(b, f) { return 1 + 0.04 * (f.k.uproar || 0); } });
defMove({ id: 'press', name: 'Press Down', type: 'BEAST', owner: 'thumb', reach: 'single', cd: 1, text: 'Hits for 84% ATK. Reserves take 25% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 0.84 }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.84 }, { reserve: true, spread: true, mult: 0.25 }); } });
defMove({ id: 'pinch', name: 'Thumb Flick', type: 'BEAST', owner: 'thumb', reach: 'single', tags: ['dash'], cd: 3, wu: 60, text: 'Wind-up. Hits for 99% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 0.99 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'thumbsdown', name: 'Let Go', type: 'BEAST', owner: 'thumb', reach: 'spread', cd: 3, text: 'Hits every foe for 48% ATK + 12% per Clench, all spent. Fortify 1.',
  run(c) { const u = c.u.k.uproar || 0; c.u.k.uproar = 0; c.spread({ atk: 0.48 + 0.12 * u }); c.st(c.u, 'fortify', 1); } });
defMove({ id: 'squash', name: 'Squash Flat', type: 'BEAST', owner: 'thumb', reach: 'single', tags: ['channel'], cd: 6, nerve: 5, wt: 150,
  text: 'Hits 3 times for 44% ATK. Stun 1. Its next turn comes 50% later.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.44 }); c.st(c.tgt, 'stun', 1); } });

// hare: a boxing hare that kicks and follows up, zigzags to a friend, thumps a ring, and boxes a foe into the next.
defMark({ id: 'hare_flurry', name: 'on its toes', max: 2, clock: 'own', volatile: true, value: 0.05,
  outMul(b, f, t, d) { return d.attack ? 1.3 : 1; },
  afterAttack(b, f) { const mk = f.m.hare_flurry; if (!mk) return; mk.n--; if (mk.n <= 0) unmark(f, 'hare_flurry'); hastenFighter(b, f, 15); } });
defMark({ id: 'hare_mark', name: 'boxed', clock: 'own', negative: true, value: -0.05 });
defPassive({ id: 'quick', name: 'Spring Legs', owner: 'hare', text: 'When it uses a move: its next 2 attacks deal 1.3x and come 15% sooner.',
  afterMove(b, f) { mark(b, f, f, 'hare_flurry', 2 - marked(f, 'hare_flurry'), 3); } });
defPassive({ id: 'box', name: 'Moon Boxer', owner: 'hare', text: 'Its moves heal it 10% of their damage.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) heal(b, f, f, dealt * 0.1); } });
defMove({ id: 'kick', name: 'Hind Kick', type: 'BEAST', owner: 'hare', reach: 'single', cd: 1, text: 'Hits for 107% ATK. Boxed 2. On a Boxed foe instead: 102% ATK + 12% of its missing HP.',
  run(c) {
    if (c.marked(c.tgt, 'hare_mark')) { unmark(c.tgt, 'hare_mark'); c.hit(c.tgt, { atk: 1.02, tgtMiss: 0.12 }); return; }
    c.hit(c.tgt, { atk: 1.07 });
    if (!c.tgt.ko) c.mark(c.tgt, 'hare_mark', 1, 2);
  } });
defMove({ id: 'bolt', name: 'Zigzag', type: 'BEAST', owner: 'hare', reach: 'reserveAlly', tags: ['dash'], cd: 3, tag: true, text: 'Switches to an ally. Shields itself 10% and the ally 12% of max HP.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.1, 3); c.shield(c.ally!, c.ally!.maxHp * 0.12, 3); } });
defMove({ id: 'freeze', name: 'Thump Ring', type: 'BEAST', owner: 'hare', reach: 'spread', cd: 3, text: 'Hits every foe for 77% ATK. Slow 2.',
  run(c) { c.spread({ atk: 0.77 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'madmarch', name: 'Box the Moon', type: 'BEAST', owner: 'hare', reach: 'single', cd: 6, nerve: 4,
  text: 'Hits for 158% ATK. Forces the foe out. The next foe takes 93% ATK.',
  run(c) {
    c.hit(c.tgt, { atk: 1.58 });
    if (c.tgt.ko || c.blocked(c.tgt) || !c.forceOut()) return;
    c.hit(c.them.f[c.them.out], { atk: 1.58 }, { mult: 0.6 });
  } });

// ================================================================ STAR

// paring: a moon paring that waxes every third blow, cuts moonlit foes again, and pulls them all in when full.
defMark({ id: 'paring_moonlit', name: 'moonlit', clock: 'own', negative: true, volatile: true, value: -0.05 });
defMark({ id: 'paring_orbs', name: 'motes', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { const t = foeOf(b, f); if (!t.ko && !t.gone) dealDamage(b, f, t, stat(b, f, 'mgk') * 0.45, plain('M'), 'STAR'); } });
defPassive({ id: 'phase', name: 'Gibbous', owner: 'paring', text: 'Every 3rd attack: 1.5x damage, and hits each reserve for 50% MGK.',
  outMul(b, f, t, d) { return d.attack && (f.k.dianaA || 0) % 3 === 2 ? 1.5 : 1; },
  afterAttack(b, f) {
    f.k.dianaA = (f.k.dianaA || 0) + 1;
    if (f.k.dianaA % 3 !== 0) return;
    for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.5, { ...plain('M'), spread: true, reserve: true }, null);
  } });
defPassive({ id: 'thin', name: 'New Moon', owner: 'paring', text: 'Deals 1.2x damage to Moonlit foes.',
  outMul(b, f, t) { return marked(t, 'paring_moonlit') ? 1.2 : 1; } });
defMove({ id: 'crescent', name: 'Crescent Edge', type: 'STAR', owner: 'paring', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 157% MGK. Moonlit 3.',
  run(c) { c.hit(c.tgt, { mgk: 1.57 }); if (!c.tgt.ko) c.mark(c.tgt, 'paring_moonlit', 1, 3); } });
defMove({ id: 'waning', name: 'Wane', type: 'STAR', owner: 'paring', reach: 'self', tags: ['projectile'], cd: 3, text: 'Shield of 15% of its max HP. At its next 2 turns: hits the foe for 45% MGK.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.15, 3); c.mark(c.u, 'paring_orbs', 1, 2); } });
defMove({ id: 'lunarrush', name: 'Thin Edge', type: 'STAR', owner: 'paring', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 144% MGK. On a Moonlit foe: removes it, cooldown resets.',
  run(c) {
    const lit = marked(c.tgt, 'paring_moonlit') > 0;
    c.hit(c.tgt, { mgk: 1.44 });
    if (lit && !c.blocked(c.tgt)) { unmark(c.tgt, 'paring_moonlit'); const i = c.u.moves.indexOf('lunarrush'); if (i >= 0) c.u.cd[i] = 0; }
  } });
defMove({ id: 'fullphase', name: 'Waxes Full', type: 'STAR', owner: 'paring', reach: 'spread', tags: ['spell'], cd: 5, nerve: 4,
  text: 'Hits for 144% MGK, +20% damage per foe standing. Slow 2 on every foe.',
  run(c) { const n = standing(c.them).length; for (const e of standing(c.them)) c.st(e, 'slow', 2); c.hit(c.tgt, { mgk: 1.44 }, { mult: 1 + 0.2 * n }); } });

// coma: a comet head with a crust that grows back, a dust tail, a frozen core, and a strike nothing stops.
defMark({ id: 'coma_clap', name: 'shedding dust', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'def') * 0.3 : 0; },
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.3, { ...plain('M'), spread: true, reserve: true }, null); } });
defPassive({ id: 'tail', name: 'Ice Crust', owner: 'coma', text: 'Starts with a shield of 10% max HP. It refills after 2 turns unhit.',
  start(b, f) { giveShield(b, f, f, f.maxHp * 0.1, 99); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.unhit = 0; },
  turnStart(b, f) {
    f.k.unhit = (f.k.unhit || 0) + 1;
    if (f.k.unhit >= 3 && f.shield < f.maxHp * 0.1) { giveShield(b, f, f, f.maxHp * 0.1 - f.shield, 99); f.k.unhit = 0; }
  } });
defPassive({ id: 'perihelion', name: 'Sunward', owner: 'coma', text: 'When it comes out: its first move is Unstoppable and deals 1.3x.',
  outMul(b, f, t, d) { return f.k.fresh && d.move ? 1.3 : 1; } });
defMove({ id: 'dustmove', name: 'Dust Tail', type: 'STAR', owner: 'coma', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 92% MGK. Slow 1. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.92 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 15); } });
defMove({ id: 'icecore', name: 'Frozen Core', type: 'STAR', owner: 'coma', reach: 'self', cd: 3, wt: 60, text: 'For 3 turns: attacks add 30% DEF, reserves take 30% MGK. Fortify 1.',
  run(c) { c.mark(c.u, 'coma_clap', 1, 3); c.st(c.u, 'fortify', 1); } });
defMove({ id: 'streak', name: 'Tail Sweep', type: 'STAR', owner: 'coma', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 42% MGK + 40% DEF. Weaken 2.',
  run(c) { c.spread({ mgk: 0.42, def: 0.4 }, { kind: 'M' }); c.st(c.tgt, 'weaken', 2); } });
defMove({ id: 'impact', name: 'Strike Home', type: 'STAR', owner: 'coma', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 70, unstop: true,
  text: 'Unstoppable wind-up. Hits every foe for 117% MGK. Stun 1.',
  run(c) { c.spread({ mgk: 1.17 }); c.st(c.tgt, 'stun', 1); } });

// curtain: green light that folds back, flickers out, lays cold bands, and closes round a foe.
defMark({ id: 'curtain_hex', name: 'light folding back', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'curtain_hex'); const t = foeOf(b, f); if (!t.ko && !t.gone) dealDamage(b, f, t, stat(b, f, 'mgk') * 0.4, plain('M'), 'STAR'); } });
defMark({ id: 'curtain_world', name: 'folded in', clock: 'own', volatile: true, negative: true, value: -0.12,
  forbid(b, f, what) { return what === 'switch' ? 'Folded in.' : null; },
  inMul(b, f, src) { const mk = f.m.curtain_world; return mk && src && markedBy(b, mk) === src ? 1.2 : 1; } });
defPassive({ id: 'chord', name: 'Third Band', owner: 'curtain', text: 'Every 3rd hit on the same foe: also hits for 30% MGK, heals 5% max HP.',
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.side === f.side || f.k.chording) return;
    const key = `aur${t.side}${t.idx}`;
    f.k[key] = (f.k[key] || 0) + 1;
    if (f.k[key] % 3 !== 0 || t.ko) return;
    f.k.chording = 1;
    dealDamage(b, f, t, stat(b, f, 'mgk') * 0.3, plain('M'), 'STAR');
    f.k.chording = 0;
    heal(b, f, f, f.maxHp * 0.05);
  } });
defPassive({ id: 'veil', name: 'Green Cover', owner: 'curtain', text: 'In reserve: your out whorl takes 0.9x magic damage.',
  auraIn(b, f, o, src, d) { return d.kind === 'M' ? 0.9 : 1; } });
defMove({ id: 'ripple', name: 'Fold Back', type: 'STAR', owner: 'curtain', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 68% MGK. At its next turn: hits for 40% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.68 }); c.mark(c.u, 'curtain_hex', 1, 2); } });
defMove({ id: 'brighthour', name: 'Flicker', type: 'STAR', owner: 'curtain', reach: 'self', tags: ['dash'], cd: 4, wt: 60, text: 'Ward 1. Haste 2. Fold Back\'s cooldown resets.',
  run(c) { c.st(c.u, 'ward', 1); c.st(c.u, 'haste', 2); const i = c.u.moves.indexOf('ripple'); if (i >= 0) c.u.cd[i] = 0; } });
defMove({ id: 'bands', name: 'Green Bands', type: 'STAR', owner: 'curtain', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 56% MGK. Slow 2. Delays foe\'s next turn by 20%.',
  run(c) { c.spread({ mgk: 0.56 }); c.st(c.tgt, 'slow', 2); c.delay(c.tgt, 20); } });
defMove({ id: 'encore', name: 'Draw Close', type: 'STAR', owner: 'curtain', reach: 'single', tags: ['spell'], cd: 6, nerve: 5,
  text: 'Hits for 96% MGK. For 3 turns: the foe can\'t switch and takes 1.2x damage from it.',
  run(c) { c.hit(c.tgt, { mgk: 0.96 }); if (!c.tgt.ko) c.mark(c.tgt, 'curtain_world', 1, 3); } });

// fulgur: beach glass from a strike that arcs down the line, hits harder in the same place, jumps, and opens the sky.
defPassive({ id: 'conductive', name: 'Wet Sand', owner: 'fulgur', text: 'Its spread moves hit reserves for 50% instead of 35%.' });
defPassive({ id: 'static', name: 'Glass Charge', owner: 'fulgur', text: 'Its moves add 4% of the foe\'s current HP. Its attackers take 30% MGK.',
  addRaw(b, f, t, d) { return d.move && !d.reserve ? t.hp * 0.04 : 0; } });
defMove({ id: 'arcbolt', name: 'Sand Arc', type: 'STAR', owner: 'fulgur', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 60% MGK.',
  run(c) { c.spread({ mgk: 0.6 }); } });
defMark({ id: 'fulgur_struck', name: 'struck once', clock: 'own', volatile: true, negative: true, value: -0.04 });
defMove({ id: 'fork', name: 'Same Place', type: 'STAR', owner: 'fulgur', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 79% MGK. Expose 1. Interrupts. Deals 1.35x if it hit the same foe in its last 3 turns.',
  run(c) { const again = c.marked(c.tgt, 'fulgur_struck') > 0; c.hit(c.tgt, { mgk: 0.79 }, { mult: again ? 1.35 : 1 }); c.interrupt(c.tgt); c.st(c.tgt, 'expose', 1); if (!c.tgt.ko) c.mark(c.tgt, 'fulgur_struck', 1, 3); } });
defMove({ id: 'flash', name: 'Flash Over', type: 'STAR', owner: 'fulgur', reach: 'single', tags: ['dash', 'spell'], cd: 3, wt: 70, text: 'Hits for 52% MGK. Slow 1. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.52 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 30); } });
defMove({ id: 'thundergod', name: 'Whole Sky', type: 'STAR', owner: 'fulgur', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 105% MGK. 1.2x on any foe below 50% HP.',
  run(c) {
    const share = has(c.u, 'conductive') ? 0.5 : 0.35;
    c.hit(c.tgt, { mgk: 1.05 }, { spread: true, mult: pctOut(c.tgt, 0.5) ? 1.2 : 1 });
    for (const r of reserves(c.them)) c.hit(r, { mgk: 1.05 }, { spread: true, reserve: true, mult: share * (pctOut(r, 0.5) ? 1.2 : 1) });
  } });

// halo: a floating halo that brightens with each move, strikes with its rim, hovers over a friend, and crowns it.
defPassive({ id: 'grace', name: 'Brightening', owner: 'halo', text: 'When it uses a move: +5% damage, up to 3 times. Its shields last +1 turn.',
  afterMove(b, f) { f.k.ascent = Math.min(3, (f.k.ascent || 0) + 1); },
  outMul(b, f) { return 1 + 0.05 * (f.k.ascent || 0); } });
defPassive({ id: 'martyr', name: 'Rim Light', owner: 'halo', text: 'Its attacks add 6% of the foe\'s missing HP.',
  addRaw(b, f, t, d) { return d.attack ? (t.maxHp - t.hp) * 0.06 : 0; } });
defMove({ id: 'smite', name: 'Ring Strike', type: 'STAR', owner: 'halo', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 132% MGK. Slow 1. Your lowest-HP whorl heals 30% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.32 }); c.st(c.tgt, 'slow', 1); c.heal(lowestAlly(c), d * 0.3); } });
defMove({ id: 'aegis', name: 'Hover Over', type: 'STAR', owner: 'halo', reach: 'ally', cd: 2, text: 'Heals an ally 12% of its max HP + 10% CHA. Haste 1.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.12 + c.cha(0.1)); c.st(c.ally!, 'haste', 1); } });
defMove({ id: 'sanctify', name: 'Lit Rim', type: 'STAR', owner: 'halo', reach: 'self', cd: 3, wt: 60, text: 'Next attack: +15% of the foe\'s missing HP, reserves take 40% MGK.',
  run(c) { c.mark(c.u, 'halo_blade', 1, 2); } });
defMark({ id: 'halo_blade', name: 'rim lit', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? (t.maxHp - t.hp) * 0.15 : 0; },
  afterAttack(b, f) { unmark(f, 'halo_blade'); for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.4, { ...plain('M'), spread: true, reserve: true }, null); } });
defMove({ id: 'intervention', name: 'Crowned', type: 'STAR', owner: 'halo', reach: 'ally', cd: 7, nerve: 5, text: 'An ally is Untouchable for 2 turns.',
  run(c) { c.st(c.ally!, 'invuln', 2); } });

// umbra: an eclipse shadow with a dusk edge, a blot that rewards a block, dark at noon, and totality.
defMark({ id: 'umbra_shroud', name: 'in shadow', clock: 'own', volatile: true, value: 0.05,
  turnStart(b, f) { unmark(f, 'umbra_shroud'); if (!f.s.ward) { applyStatus(b, f, f, 'haste', 2); applyStatus(b, f, f, 'empower', 1); } } });
defPassive({ id: 'penumbra', name: 'Half Shadow', owner: 'umbra', text: 'Every 3rd attack: reserves take 35% ATK, and it heals 40% ATK.',
  afterAttack(b, f, t) {
    f.k.umbraA = (f.k.umbraA || 0) + 1;
    if (f.k.umbraA % 3 !== 0) return;
    for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.35, { ...plain('P'), spread: true, reserve: true }, null);
    heal(b, f, f, stat(b, f, 'atk') * 0.4);
  } });
defPassive({ id: 'corona', name: 'Gold Rim', owner: 'umbra', text: 'Its attacks also hit for 25% MGK.' });
defMove({ id: 'shade', name: 'Dusk Edge', type: 'STAR', owner: 'umbra', reach: 'single', cd: 1, text: 'Hits for 120% ATK. Empower 1.',
  run(c) { c.hit(c.tgt, { atk: 1.2 }); c.st(c.u, 'empower', 1); } });
defMove({ id: 'blot', name: 'Blot Out', type: 'STAR', owner: 'umbra', reach: 'self', cd: 4, wt: 60, text: 'Ward 1. If it blocks a move before its next turn: Haste 2, Empower 1.',
  run(c) { c.st(c.u, 'ward', 1); c.mark(c.u, 'umbra_shroud', 1, 2); } });
defMove({ id: 'umbralstep', name: 'Noon Dark', type: 'STAR', owner: 'umbra', reach: 'single', cd: 4, text: 'Hits for 100% ATK. The foe must switch at its next turn.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'switch'); } });
defMove({ id: 'paranoia', name: 'Full Eclipse', type: 'STAR', owner: 'umbra', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 160% ATK. Silence 1. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 1.6 }); c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'root', 2); } });

// portent: a red star that keeps a move from each foe it ends, streaks, reddens the sky, and sends bad news.
defMark({ id: 'portent_scorch', name: 'red sky', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) {
    heal(b, f, f, f.maxHp * 0.05);
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) dealDamage(b, f, t, stat(b, f, 'mgk') * 0.3, dot('M'), null);
  } });
defPassive({ id: 'foretold', name: 'Keeps a Piece', owner: 'portent', text: 'When it KOs a foe: takes that foe\'s first move into its first slot. 1 tide.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side) return;
    const id = v.moves[0];
    if (MOVES[id] && !MOVES[id].nerve && f.moves[0] !== id) { setMove(b, f, 0, id); msg(b, `${label(b, f)} keeps ${MOVES[id].name}.`); }
    addNerve(b, f.side, 1);
  } });
defPassive({ id: 'illwind', name: 'Bad Sky', owner: 'portent', text: 'Doomed foes take 1.15x damage from everything.' });
defMove({ id: 'sign', name: 'Red Streak', type: 'STAR', owner: 'portent', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 120% MGK + 4% of the foe\'s max HP. Burn 1 (30% MGK each turn).',
  run(c) { c.hit(c.tgt, { mgk: 1.2, tgtHp: 0.04 }); c.st(c.tgt, 'burn', 1, stat(c.b, c.u, 'mgk') * 0.3); } });
defMove({ id: 'badnews', name: 'Red Sky', type: 'STAR', owner: 'portent', reach: 'self', cd: 3, wt: 70, text: 'For 3 turns: the foe takes 30% MGK and it heals 5% max HP each turn.',
  run(c) { c.mark(c.u, 'portent_scorch', 1, 3); } });
defMove({ id: 'unlucky', name: 'On Its Way', type: 'STAR', owner: 'portent', reach: 'single', tags: ['spell'], cd: 3, text: 'After 2 of the foe\'s turns: it takes 220% MGK.',
  run(c) { if (c.blocked(c.tgt)) return; c.tgt.k.badnews = 2; c.tgt.k.badnewsDmg = Math.round(stat(c.b, c.u, 'mgk') * 2.2); c.msg(`Something is on its way to ${c.tgt.mon.name}.`); } });
defMove({ id: 'doom', name: 'Ill Omen', type: 'STAR', owner: 'portent', reach: 'single', tags: ['spell'], cd: 7, nerve: 5, text: 'Doom 3. The foe takes 60% MGK each turn.',
  run(c) { if (c.st(c.tgt, 'doom', 3, stat(c.b, c.u, 'mgk') * 0.6) && has(c.u, 'illwind')) c.tgt.k.illwind = 1; } });

// flare: a solar flare that burns with every move, leaps through, loops fire, and dies down to a cinder to relight.
const FLARE_EGG: SpriteData = { px: ['........', '...3....', '..4444..', '.442244.', '44422444', '44244244', '.44.244.', '..4444..'], c: ['#da650f', '#f9ca5a', '#3e2e2e'] };
defMark({ id: 'flare_egg', name: 'a cinder', value: 0.4,
  inMul() { return 0; },
  leave(b, f) { unmark(f, 'flare_egg'); clearForm(b, f); } });
defSummon({ id: 'flare_shell', name: 'Cinder Shell', owner: 'flare', sprite: { px: ['........', '........', '..3..3..', '...3....', '.444444.', '44422444', '44222244', '44444444'], c: ['#d97308', '#f9ca5a', '#534341'] }, text: 'Takes single-target hits meant for Honoki. Each turn: hits every foe for 30% MGK. If it lasts 2 turns: Honoki comes back at 60% HP and every foe takes 80% MGK. Stun 1. If it is destroyed: Honoki loses 20% max HP.', every: 100, guard: true,
  act(b, s) { const f = b.s[s.side].f[s.by]; if (f && !f.ko) splash(b, f, stat(b, f, 'mgk') * 0.3, 'M', 'STAR'); },
  gone(b, s, f) {
    if (!f || f.ko || !marked(f, 'flare_egg')) return;
    unmark(f, 'flare_egg'); clearForm(b, f); delete f.s.stun;
    if (s.hp <= 0) { msg(b, `${label(b, f)}'s cinder goes out early.`); dealDamage(b, null, f, f.maxHp * 0.2, dot('T'), null); return; }
    f.hp = Math.max(f.hp, Math.round(f.maxHp * 0.6));
    emit(b, { e: 'heal', side: f.side, idx: f.idx, amt: 0 });
    msg(b, `${label(b, f)} lights again.`);
    splash(b, f, stat(b, f, 'mgk') * 0.8, 'M', 'STAR');
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'stun', 1);
  } });
defPassive({ id: 'ignite', name: 'Sunburn', owner: 'flare', text: 'Its damaging moves add Burn 2 (25% MGK each turn).',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko) { t.k.wasBurning = t.s.burn ? 1 : 0; applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.25); } } });
defPassive({ id: 'blaze', name: 'Wildfire', owner: 'flare', text: 'When a move hits a Burning foe: each foe reserve gets Burn 1.',
  afterDeal(b, f, t, dealt, d) {
    if (!d.move || d.reserve) return;
    const was = t.k.wasBurning !== undefined ? t.k.wasBurning : (t.s.burn ? 1 : 0);
    t.k.wasBurning = undefined as unknown as number;
    if (was) for (const r of reserves(b.s[t.side])) applyStatus(b, f, r, 'burn', 1, stat(b, f, 'mgk') * 0.25);
  } });
defMove({ id: 'sear', name: 'Sunspot', type: 'STAR', owner: 'flare', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 115% MGK. Slow 1 if the foe was already Burning.',
  run(c) { const burning = !!c.tgt.s.burn; c.hit(c.tgt, { mgk: 1.15 }); if (burning && !c.tgt.ko) c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'flashpoint', name: 'Leap Out', type: 'STAR', owner: 'flare', reach: 'single', tags: ['dash', 'spell'], cd: 3, text: 'Hits for 125% MGK. Its next turn comes 25% sooner. Pays 5% max HP.',
  run(c) { payHp(c.b, c.u, c.u.maxHp * 0.05); c.hit(c.tgt, { mgk: 1.25 }); c.hasten(c.u, 25); } });
defMove({ id: 'prominence', name: 'Solar Loop', type: 'STAR', owner: 'flare', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 95% MGK + 6% of the foe\'s max HP. Pays 6% of its max HP.',
  run(c) { payHp(c.b, c.u, c.u.maxHp * 0.06); c.hit(c.tgt, { mgk: 0.95, tgtHp: 0.06 }); } });
defMove({ id: 'supernova', name: 'Burn Down', type: 'STAR', owner: 'flare', reach: 'self', cd: 6, nerve: 5,
  text: 'Summons a Cinder Shell (25% of its max HP, 2 turns) and hides in it.',
  run(c) { setForm(c.b, c.u, { tag: 'egg', sprite: FLARE_EGG }); c.mark(c.u, 'flare_egg', 1); c.st(c.u, 'stun', 4); summon(c.b, c.u, 'flare_shell', { hp: 0.25, turns: 2 }); } });

// ================================================================ special sloughs

defPassive({ id: 'tally', name: 'Tally', owner: 'tackle', text: 'Deals +10% damage for each foe its side has KO\'d.',
  anyKO(b, f, v, killer) { if (killer && killer.side === f.side && v.side !== f.side) f.k.tally = (f.k.tally || 0) + 1; },
  outMul(b, f) { return 1 + 0.1 * (f.k.tally || 0); } });
defPassive({ id: 'kid', name: 'Kid', owner: 'tackle', text: 'When it comes out: its first turn comes 20% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 20; } });
defMove({ id: 'shove', name: 'Shove', type: 'BEAST', owner: 'tackle', reach: 'single', cd: 1, text: 'Hits for 120% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.2 }); } });
defMove({ id: 'grab', name: 'Grab', type: 'BEAST', owner: 'tackle', reach: 'single', cd: 2, text: 'Hits for 80% ATK. Root 1.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'root', 1); } });
defMove({ id: 'standfirm', name: 'Stand Firm', type: 'BEAST', owner: 'tackle', reach: 'self', cd: 3, text: 'Fortify 2.',
  run(c) { c.st(c.u, 'fortify', 2); } });
defMove({ id: 'rush', name: 'Rush', type: 'BEAST', owner: 'tackle', reach: 'single', cd: 5, nerve: 4, text: 'Hits for 180% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 1.8 }); c.st(c.tgt, 'stun', 1); } });

// Full, Mundane, Knot, and Holm live in kits8.ts.

export const KITS_LOADED = true;
void isOut; void cleanse;
