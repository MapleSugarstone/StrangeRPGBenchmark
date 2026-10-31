import { fogBench, WET_SAND, startBout, setFlock, bodiesOf, RANGE_DOWN, latchOn, setRange, rangeOf, stepOrbits, forceOut, goUp, dismiss, addCharge, addNerve, applyStatus, forceAction, summon, summonsOf, cameOutSince, cleanse, negatives, clearForm, dealDamage, delayFighter, foeOf, giveShield, has, heal, hastenFighter, isOut, label, mark, marked, markedBy, msg, reserves, setForm, setMove, standing, stat, unmark, emit, SPREAD_SHARE } from '../battle/engine';
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

// orrery: the Riders' brass sky, whose Planets travel the foe's whole line and come down where their orbit ends.
/** A Planet comes down on t, out or in reserve: 115% of the orrery's MGK as STAR. */
function orreryBurst(b: Battle, by: Fighter | null, t: Fighter): void {
  if (t.ko || t.gone) return;
  msg(b, `The planet round ${label(b, t)} comes down.`);
  const raw = by ? stat(b, by, 'mgk') * 1.15 : 60;
  dealDamage(b, by && !by.ko ? by : null, t, raw, { ...plain('M'), reserve: !isOut(b, t) }, 'STAR');
}
defMark({ id: 'orrery_planet', name: 'planet', max: 3, orbit: true, negative: true, value: -0.15,
  arrive(b, f, mk) {
    const by = markedBy(b, mk);
    if (!by || f.ko) return;
    dealDamage(b, by.ko ? null : by, f, stat(b, by, 'mgk') * 0.2, { ...plain('M'), reserve: !isOut(b, f) }, 'STAR');
    if (mk.n < 2 || f.ko || !has(by, 'escapement')) return;
    unmark(f, 'orrery_planet');
    msg(b, `Two planets align above ${label(b, f)}.`);
    for (let i = 0; i < mk.n; i++) orreryBurst(b, by, f);
    if (!f.ko) applyStatus(b, by, f, 'stun', 1);
  },
  expire(b, f, mk) { for (let i = 0; i < mk.n; i++) orreryBurst(b, markedBy(b, mk), f); } });
defMark({ id: 'orrery_shift', name: 'on an orbit', clock: 'own', value: 0.2,
  wouldKO(b, f) {
    unmark(f, 'orrery_shift');
    f.hp = Math.max(1, Math.round(f.maxHp * 0.3)); f.shield = 0;
    msg(b, `${label(b, f)} completes its orbit.`);
    return true;
  } });
defPassive({ id: 'epicycle', name: 'Epicycle', owner: 'orrery', text: 'In reserve, every 3rd turn your side takes: your out Whorl\'s non-crest cooldowns drop 1.',
  reserveTurn(b, f) { f.k.bottle = (f.k.bottle || 0) + 1; if (f.k.bottle % 3 === 0) { const o = b.s[f.side].f[b.s[f.side].out]; if (!o.ko) cutCooldowns(o, 1); } } });
defPassive({ id: 'escapement', name: 'Conjunction', owner: 'orrery', text: 'Two Planets on one foe come down at once, with Stun 1.' });
defMove({ id: 'wind', name: 'Set Orbit', type: 'STAR', owner: 'orrery', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'flare | star orbit | sparkle',
  text: 'Hits for 98% MGK. A Planet orbits the foe\'s line: 20% MGK a stop, 115% after 3.',
  run(c) {
    const had = c.marked(c.tgt, 'orrery_planet');
    c.hit(c.tgt, { mgk: 0.98 });
    if (c.tgt.ko || c.blocked(c.tgt)) return;
    if (had && has(c.u, 'escapement')) {
      unmark(c.tgt, 'orrery_planet');
      for (let i = 0; i <= had; i++) orreryBurst(c.b, c.u, c.tgt);
      if (!c.tgt.ko) c.st(c.tgt, 'stun', 1);
      return;
    }
    c.mark(c.tgt, 'orrery_planet', 1, 3);
  } });
defMove({ id: 'unwind', name: 'Spin Faster', type: 'GEAR', owner: 'orrery', reach: 'single', tags: ['spell'], cd: 3, wt: 50, fx: 'spin fast | cog*3 orbit | ring',
  text: 'Hits for 59% MGK. Every Planet moves on 1. Its other non-crest cooldowns drop 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.59 }); stepOrbits(c.b, c.u.side, true); cutCooldowns(c.u, 2, c.u.moves.indexOf('unwind')); } });
defMove({ id: 'tick', name: 'Close Pass', type: 'GEAR', owner: 'orrery', reach: 'ally', cd: 3, fx: 'sway | star*2 orbit | sparkle ally',
  text: 'Ally: Haste 2. Foe: Slow 1, delayed 20%. Each Planet on it hits for 40% MGK.',
  run(c) {
    c.st(c.ally!, 'haste', 2); c.st(c.tgt, 'slow', 1); c.delay(c.tgt, 20);
    const n = c.marked(c.tgt, 'orrery_planet');
    for (let i = 0; i < n && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.4 });
  } });
defMove({ id: 'conjunction', name: 'Comes Round', type: 'GEAR', owner: 'orrery', reach: 'ally', cd: 6, nerve: 5, fx: 'swell big | star*5 rain | flash sparkle big glare all',
  text: 'Every Planet lands now. An ally KO\'d in its next 3 turns returns at 30% HP.',
  run(c) {
    for (const e of c.them.f) {
      const mk = e.m.orrery_planet;
      if (!mk || e.ko || e.gone || markedBy(c.b, mk)?.side !== c.u.side) continue;
      unmark(e, 'orrery_planet');
      for (let i = 0; i < mk.n; i++) orreryBurst(c.b, c.u, e);
    }
    c.mark(c.ally!, 'orrery_shift', 1, 3);
  } });

// crane: a dock crane that hooks a load off the quay, swings it round, goes up with it, and drops it where it likes.
defMark({ id: 'crane_drive', name: 'swinging', clock: 'own', volatile: true, value: 0.05,
  expire(b, f) { applyStatus(b, f, f, 'slow', 1); } });
defMark({ id: 'crane_fist', name: 'load raised', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { unmark(f, 'crane_fist'); if (f.up) { f.up = 0; msg(b, `${label(b, f)} lands on ${label(b, t)}.`); } if (!t.ko && !t.gone) applyStatus(b, f, t, 'stun', 1); } });
defPassive({ id: 'counterweight', name: 'Counterweight', owner: 'crane', text: 'Once per battle, below 30% HP: a shield of 30% of its max HP.',
  afterTake(b, f) { if (!f.k.cw && f.hp > 0 && f.hp < f.maxHp * 0.3) { f.k.cw = 1; giveShield(b, f, f, f.maxHp * 0.3, 3); } } });
defPassive({ id: 'hoist', name: 'Cable Snap', owner: 'crane', text: 'Every 3rd attack also hits for 40% MGK and forces the foe out.',
  afterAttack(b, f, t) {
    f.k.zaps = (f.k.zaps || 0) + 1;
    if (f.k.zaps % 3 !== 0 || t.ko || t.gone) return;
    dealDamage(b, f, t, stat(b, f, 'mgk') * 0.4, plain('M'), 'GEAR');
    if (!t.ko && isOut(b, t)) forceOut(b, f, t.side);
  } });
defMove({ id: 'hook', name: 'Grab Hook', type: 'GEAR', owner: 'crane', reach: 'dragin', cd: 3, wu: 50, fx: 'lift | cog return | claw',
  text: 'Wind-up. Swings a chosen foe reserve in: 90% ATK to the one swung out. Stun 1.',
  run(c) {
    const old = c.tgt;
    const pick = c.pick >= 0 && !c.them.f[c.pick]?.ko ? c.pick : -1;
    const moved = pick >= 0 && pick !== c.them.out && c.dragIn(pick);
    const t = c.them.f[c.them.out];
    if (moved && !old.ko) c.hit(old, { atk: 0.9 }, { reserve: true }); else c.hit(t, { atk: 0.9 });
    c.st(t, 'stun', 1);
  } });
defMove({ id: 'swing', name: 'Full Swing', type: 'STONE', owner: 'crane', reach: 'spread', cd: 3, splash: 0.5, fx: 'spin | pebble*3 sweep | crack',
  text: 'Hits for 60% ATK. Splash 50%. Haste 2, then Slow 1 when it ends.',
  run(c) { c.spread({ atk: 0.6 }); c.st(c.u, 'haste', 2); c.mark(c.u, 'crane_drive', 1, 2); } });
defMove({ id: 'lift', name: 'Lift and Drop', type: 'GEAR', owner: 'crane', reach: 'self', cd: 3, wt: 50, fx: 'lift | cog*2 orbit | ring self',
  text: 'Goes up 2 turns: dashes can\'t reach it. Its next attack drops: 1.6x, Stun 1.',
  run(c) { goUp(c.b, c.u, 2); c.u.k.nextAtkMul = 1.6; c.mark(c.u, 'crane_fist', 1, 2); } });
defMove({ id: 'staticfield', name: 'Drop the Load', type: 'GEAR', owner: 'crane', reach: 'spread', cd: 5, nerve: 4, fx: 'lift | shell*4 rain | quake big jolt',
  text: 'Hits for 108% MGK. Splash 35%. Delays the foe 30%. Up high: 1.4x.',
  run(c) {
    const hi = !!c.u.up;
    c.spread({ mgk: 1.08 }, { mult: hi ? 1.4 : 1 });
    c.delay(c.tgt, 30);
    if (hi && !c.preview) { c.u.up = 0; c.msg(`${label(c.b, c.u)} is brought down with it.`); }
  } });

// turbine: a wind pump that faces into the sea wind and turns it round for its friends.
defMark({ id: 'turbine_lee', name: 'in the lee', clock: 'own', value: 0.08,
  inMul(b, f, src, d) { return d.move?.tags?.includes('projectile') ? 0.5 : 1; } });
defPassive({ id: 'tailwind', name: 'Sea Breeze', owner: 'turbine', text: 'In reserve: a Slow on your out Whorl turns into Haste 1.',
  anyStatus(b, f, src, t, id) {
    if (id !== 'slow' || t === f || t.side !== f.side || !isOut(b, t) || isOut(b, f) || !t.s.slow) return;
    delete t.s.slow;
    msg(b, `${label(b, f)} turns the wind round.`);
    applyStatus(b, f, t, 'haste', 1);
  } });
defPassive({ id: 'feather', name: 'Light Vanes', owner: 'turbine', text: 'Immune to Slow and to delays.',
  noDelay() { return true; }, statusImmune(f, id) { return id === 'slow'; } });
defMove({ id: 'spinup', name: 'Vane Cut', type: 'GEAR', owner: 'turbine', reach: 'single', tags: ['spell'], cd: 1, fx: 'spin fast | spark*2 sweep | slash', text: 'Hits for 92% MGK. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.92 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'gale', name: 'Whirlwind', type: 'STAR', owner: 'turbine', reach: 'single', tags: ['spell'], cd: 3, wu: 60, fx: 'spin | leaf*4 spiral | vortex',
  text: 'Wind-up. Hits for 84% MGK. Stun 1. Blows away foe summons and every Drop.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.84 });
    c.st(c.tgt, 'stun', 1);
    if (c.preview) return;
    const gone = c.them.sum.length + (c.b.drops?.length || 0);
    for (const u of c.them.sum.slice()) dismiss(c.b, u);
    c.b.drops = [];
    if (gone) c.msg('The wind sweeps the field clear.');
  } });
defMove({ id: 'updraft', name: 'Lee Side', type: 'GEAR', owner: 'turbine', reach: 'ally', cd: 3, fx: 'sway | leaf*3 rise | ring ally',
  text: 'Ally: Empower 2. Shield 50% CHA + 6% max HP, 3 turns. Projectiles deal it 0.5x.',
  run(c) { const a = c.ally!; c.shield(a, c.cha(0.5) + a.maxHp * 0.06, 3); c.st(a, 'empower', 2); c.mark(a, 'turbine_lee', 1, 3); } });
defMove({ id: 'monsoon', name: 'Onshore Wind', type: 'GEAR', owner: 'turbine', reach: 'team', cd: 6, nerve: 5,
  fx: 'swell | leaf*5 rise | bloom cinders tint ally big', text: 'Your team heals 20% max HP, now and next turn. Forces the foe out.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.2); c.u.k.monsoon = 1; c.forceOut(); } });

// perigee: a Rider machine that fell out of the sky one winter and still watches, finding what hides and seeing what a foe will do.
defMark({ id: 'perigee_spot', name: 'spotted', clock: 'own', negative: true, value: -0.06,
  statusImmune(f, id) { return id === 'hidden' || id === 'invuln'; } });
defMark({ id: 'perigee_watch', name: 'watching', clock: 'own', value: 0.12,
  foresee() { return true; } });
defMark({ id: 'perigee_dart', name: 'pinned', clock: 'own', negative: true, value: -0.05,
  beforeTake(b, f, src, amt, d) {
    const mk = f.m.perigee_dart;
    return mk && src && markedBy(b, mk) === src && f.s.guard && !d.dot ? amt * 2 : amt;
  } });
defMark({ id: 'perigee_fury', name: 'beaming', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { msg(b, 'A beam slices through the line.'); splash(b, f, stat(b, f, 'atk') * 0.85, 'P', 'GEAR', true); } });
defPassive({ id: 'orbit', name: 'Far Watch', owner: 'perigee', text: 'Its moves ignore Ward and Fortify.' });
defPassive({ id: 'telemetry', name: 'Locked On', owner: 'perigee', text: 'Deals 1.3x damage to foes with Slow, Root, Stun, Sleep, or Expose.',
  outMul(b, f, t) { return t.s.slow || t.s.root || t.s.stun || t.s.sleep || t.s.expose ? 1.3 : 1; } });
defMove({ id: 'ping', name: 'Bounce Signal', type: 'GEAR', owner: 'perigee', reach: 'spread', tags: ['projectile'], cd: 1, fx: 'recoil | hoop zigzag fast | ring',
  text: 'Hits for 87% ATK. Splash 35%. Spots the foe: no Hidden or Untouchable, 2 turns.',
  run(c) {
    c.spread({ atk: 0.87 });
    if (c.tgt.ko || c.blocked(c.tgt)) return;
    if (c.tgt.s.hidden || c.tgt.s.invuln) { delete c.tgt.s.hidden; delete c.tgt.s.invuln; c.msg(`${label(c.b, c.tgt)} has been spotted.`); }
    c.mark(c.tgt, 'perigee_spot', 1, 2);
  } });
defMove({ id: 'fix', name: 'Sweep', type: 'GEAR', owner: 'perigee', reach: 'spread', tags: ['projectile'], cd: 3, fx: 'flare | beam ray | flash all',
  text: 'Expose 2. Expose 1 on each reserve. Next round it sees the foe\'s choice first.',
  run(c) { c.st(c.tgt, 'expose', 2); for (const r of reserves(c.them)) c.st(r, 'expose', 1); c.mark(c.u, 'perigee_watch', 1, 1); } });
defMove({ id: 'burnin', name: 'Pinpoint', type: 'STAR', owner: 'perigee', reach: 'single', tags: ['projectile'], cd: 3, fx: 'flare | beam | flash glare',
  text: 'Hits for 108% ATK. For 2 turns the foe\'s guard doesn\'t cut its damage.',
  run(c) { c.hit(c.tgt, { atk: 1.08 }); if (!c.tgt.ko) c.mark(c.tgt, 'perigee_dart', 1, 2); } });
defMove({ id: 'deorbit', name: 'Last Pass', type: 'GEAR', owner: 'perigee', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, noGuard: true, fx: 'lift big | comet*3 rain | burst all big jolt',
  text: 'Hits for 102% ATK through guard. Splash 35%. Next 2 turns: 85% ATK, Splash 35%.',
  run(c) { c.spread({ atk: 1.02 }); c.mark(c.u, 'perigee_fury', 1, 2); } });

// furnace: a works furnace, warm all through, that keeps a crab of living slag in its firebox and lets it out to fight.
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
    msg(b, 'The crab clamps down.');
    dealDamage(b, f.ko ? null : f, t, stat(b, f, 'mgk') * 0.35, plain('M'), 'GEAR');
    if (!t.ko) applyStatus(b, f, t, 'burn', 1, stat(b, f, 'mgk') * 0.2);
  } });
const bearOut = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'furnace_bear').length > 0;
defPassive({ id: 'radiant', name: 'Stoked Full', owner: 'furnace', text: 'Every 4th move it uses: Stun 1 on the foe.',
  afterMove(b, f) {
    f.k.pyro = (f.k.pyro || 0) + 1;
    if (f.k.pyro % 4 !== 0) return;
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) { msg(b, `${label(b, f)} bellows.`); applyStatus(b, f, t, 'stun', 1); }
  } });
defPassive({ id: 'banked', name: 'Slag Shelter', owner: 'furnace', text: 'While its Slag Crab is out: takes 0.85x damage, and its attacks add Burn 2.',
  inMul(b, f) { return bearOut(b, f) ? 0.85 : 1; },
  afterAttack(b, f, t) { if (bearOut(b, f) && !t.ko && !t.gone) applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.2); } });
defMove({ id: 'stoke', name: 'Coal Shot', type: 'GEAR', owner: 'furnace', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | ember line fast | burst cinders', text: 'Hits for 156% MGK. If it KOs the foe: cooldown resets, 1 tide.',
  run(c) { c.hit(c.tgt, { mgk: 1.56 }); if (c.tgt.ko) { const i = c.u.moves.indexOf('stoke'); if (i >= 0) c.u.cd[i] = 0; c.nerve(c.me, 1); } } });
defMove({ id: 'flue', name: 'Open Flue', type: 'STAR', owner: 'furnace', reach: 'spread', tags: ['spell'], cd: 2, fx: 'swell | ember*4 sweep | smoke cinders',
  text: 'Hits for 94% MGK. Splash 35%. Burn 1. Every foe\'s Burn ticks once now.',
  run(c) {
    c.spread({ mgk: 0.94 });
    c.st(c.tgt, 'burn', 1, stat(c.b, c.u, 'mgk') * 0.26);
    for (const e of standing(c.them)) { const v = e.s.burn?.v || 0; if (v > 0 && !c.blocked(e)) dealDamage(c.b, c.u, e, v, { ...dot('M'), reserve: !isOut(c.b, e) }, null); }
  } });
defMove({ id: 'firebox', name: 'Hot Plate', type: 'GEAR', owner: 'furnace', reach: 'ally', cd: 3, fx: 'sway | ember*2 orbit | ring ally', text: 'Shields an ally 15% of its max HP, 2 turns. Its attackers get Burn 2.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.15, 2); c.mark(c.ally!, 'furnace_molten', 1, 2); } });
defMove({ id: 'blastheat', name: 'Let It Out', type: 'GEAR', owner: 'furnace', reach: 'single', tags: ['spell'], cd: 6, nerve: 5,
  fx: 'swell big | ember*3 arc | burst cinders big tint', text: 'Hits for 156% MGK. Summons a Slag Crab (25% of its max HP, 3 turns).',
  run(c) { c.hit(c.tgt, { mgk: 1.56 }); summon(c.b, c.u, 'furnace_bear', { hp: 0.25, turns: 3 }); } });

// piston: a pump piston off the old works that works the gap to the foe, in and out, quicker each time.
defMark({ id: 'piston_block', name: 'holding pressure', clock: 'own', volatile: true, value: 0.12,
  inMul() { return 0.4; },
  afterTake(b, f, src, dealt) { if (dealt > 0) f.k.charged = 1; } });
defMark({ id: 'piston_meteor', name: 'top of the stroke', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    unmark(f, 'piston_meteor');
    msg(b, `${label(b, f)} charges down the lane.`);
    splash(b, f, stat(b, f, 'atk') * 1.01, 'P', 'GEAR');
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 2);
  } });
defPassive({ id: 'stroke', name: 'Packing', owner: 'piston', text: 'When a move deals damage: a shield of 6% of its max HP, up to 24%. At Near, 9%.',
  afterMove(b, f) { if (!f.k.dealt) return; const room = f.maxHp * 0.24 - f.shield; if (room > 0) giveShield(b, f, f, Math.min(room, f.maxHp * (rangeOf(b) === 'near' ? 0.09 : 0.06)), 3); } });
defPassive({ id: 'pressure', name: 'Blow-off', owner: 'piston', text: 'Its attacks hit each foe reserve for 25% ATK.',
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.25, { ...plain('P'), spread: true, reserve: true }, null); } });
defMove({ id: 'drive', name: 'In Stroke', type: 'GEAR', owner: 'piston', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | burst',
  text: 'Moves to Near. Hits for 54% ATK. Its next turn comes 10% sooner per use, max 30%.',
  run(c) {
    if (c.u.k.driveAt !== c.u.outAt) { c.u.k.driveAt = c.u.outAt; c.u.k.drives = 0; }
    const charged = c.u.k.charged ? 1.5 : 1;
    c.u.k.charged = 0;
    if (!c.blocked(c.tgt)) setRange(c.b, 'near');
    c.hit(c.tgt, { atk: 0.54 }, { mult: charged });
    c.u.k.drives = Math.min(3, (c.u.k.drives || 0) + 1);
    c.hasten(c.u, 10 * c.u.k.drives);
  } });
defMove({ id: 'plunge', name: 'Rod Slam', type: 'STONE', owner: 'piston', reach: 'spread', tags: ['dash'], cd: 2, fx: 'stomp | pebble*2 sweep | crack',
  text: 'Hits for 45% ATK. Splash 35%. Slow 1. Knocks the foe back to Far.',
  run(c) { c.spread({ atk: 0.45 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) setRange(c.b, 'far'); } });
defMove({ id: 'vent', name: 'Hold Pressure', type: 'GEAR', owner: 'piston', reach: 'self', tags: ['dash'], cd: 3, wt: 50, fx: 'sink | cog*2 converge | ring self',
  text: 'Moves to Far. Until its next turn: takes 0.4x. If hit: next In Stroke deals 1.5x.',
  run(c) { setRange(c.b, 'far'); c.mark(c.u, 'piston_block', 1, 1); } });
defMove({ id: 'fullstroke', name: 'Long Stroke', type: 'GEAR', owner: 'piston', reach: 'self', tags: ['dash'], cd: 6, nerve: 4, fx: 'lift big | cog*4 rise | quake big jolt',
  text: 'Untouchable 1. At its next turn it comes down: 101% ATK, Splash 35%, Slow 2.',
  run(c) { c.st(c.u, 'invuln', 1); c.mark(c.u, 'piston_meteor', 1, 2); } });

// dynamo: the old pump's dynamo that hums when it is turned and builds charge in whatever it touches until the charge jumps.
defMark({ id: 'dynamo_charge', name: 'charge', max: 3, contact: true, negative: true, value: -0.08,
  arrive(b, f, mk) {
    const by = markedBy(b, mk);
    if (mk.n < 3 || !by || by.side === f.side || f.ko) return;
    unmark(f, 'dynamo_charge');
    msg(b, `${label(b, f)} is fully charged up.`);
    applyStatus(b, by, f, 'stun', 1);
  } });
defPassive({ id: 'charge', name: 'Builds Charge', owner: 'dynamo', text: 'Its damaging moves add a Charge to the foe. A foe at 3 Charges: Stun 1, and they go.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) addCharge(b, f, t); } });
defPassive({ id: 'ground', name: 'Static', owner: 'dynamo', text: 'Charges jump across a dash or an Attack between two Whorls. It starts with 2 Charges.',
  start(b, f) { addCharge(b, f, f, 2); } });
defMove({ id: 'spark', name: 'Brush Spark', type: 'GEAR', owner: 'dynamo', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | bolt zigzag fast | burst', text: 'Hits for 136% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.36 }); } });
defMove({ id: 'arc', name: 'Jump the Gap', type: 'STAR', owner: 'dynamo', reach: 'single', tags: ['spell'], cd: 2, fx: 'flare | bolt line fast | flash',
  text: 'Hits for 105% MGK. On a foe with a Charge: 1.5x damage, 1 more Charge.',
  run(c) { const ch = c.marked(c.tgt, 'dynamo_charge') > 0; c.hit(c.tgt, { mgk: 1.05 }, { mult: ch ? 1.5 : 1 }); if (ch && !c.tgt.ko && !c.blocked(c.tgt)) addCharge(c.b, c.u, c.tgt); } });
defMove({ id: 'induct', name: 'Spin Up', type: 'GEAR', owner: 'dynamo', reach: 'self', tags: ['dash'], cd: 3, wt: 60, fx: 'spin fast | spark*3 orbit | cinders self',
  text: 'Haste 2. Fortify 1. A Charge on the foe, and 2 on itself.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'fortify', 1); if (!c.blocked(c.tgt)) addCharge(c.b, c.u, c.tgt); addCharge(c.b, c.u, c.u, 2); } });
defMove({ id: 'stormcoil', name: 'Field Coil', type: 'GEAR', owner: 'dynamo', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | bolt*4 zigzag | burst all big jolt',
  text: 'Hits for 68% MGK. Splash 35%. Each ally: 1 Charge. Next 2 turns: 60% MGK, a Charge.',
  run(c) { c.spread({ mgk: 0.68 }); c.u.k.storm = 2; for (const a of standing(c.me)) addCharge(c.b, c.u, a); } });

// siren: a whistling buoy off the marsh mouth that goes off when something is wrong and drowns out everything else.
defMark({ id: 'siren_drown', name: 'drowned out', clock: 'own', negative: true, mutes: true, value: -0.15 });
defMark({ id: 'siren_curse', name: 'rattled', clock: 'own', negative: true, value: -0.08,
  turnStart(b, f) {
    const mk = f.m.siren_curse;
    const by = mk ? markedBy(b, mk) : null;
    if (by) dealDamage(b, by.ko ? null : by, f, stat(b, by, 'mgk') * 0.38, dot('M'), null);
  },
  anyMove(b, f, user, m) { const mk = f.m.siren_curse; if (user === f && m && mk && mk.t > 0 && mk.t < 4) mk.t++; } });
defMark({ id: 'siren_word', name: 'hushed', clock: 'own', volatile: true, negative: true, value: -0.12,
  anyMove(b, f, user, m) {
    if (user !== f || !m) return;
    const mk = unmark(f, 'siren_word');
    const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    msg(b, `${label(b, f)} is silenced.`);
    dealDamage(b, by.ko ? null : by, f, stat(b, by, 'mgk') * 1, plain('M'), 'GEAR');
    if (!f.ko) applyStatus(b, by, f, 'silence', 1);
  } });
defMark({ id: 'siren_glaives', name: 'swelling', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'mgk') * 0.4 : 0; } });
defPassive({ id: 'alarm', name: 'Fog Warning', owner: 'siren', text: 'Once per battle: when one of yours drops below 30% HP, 2 tide.' });
defPassive({ id: 'wail', name: 'Long Blast', owner: 'siren', text: 'Its Silences last 1 turn longer.' });
defMove({ id: 'blare', name: 'Clank', type: 'GEAR', owner: 'siren', reach: 'single', tags: ['spell'], cd: 1, fx: 'shake | bell*2 wave | ring', text: 'Hits for 82% MGK. Clank 2: 38% MGK a turn. Each move the foe uses adds 1 turn.',
  run(c) { c.hit(c.tgt, { mgk: 0.82 }); if (!c.tgt.ko) c.mark(c.tgt, 'siren_curse', 1, 2); } });
defMove({ id: 'shriek', name: 'Hush Blast', type: 'VOID', owner: 'siren', reach: 'single', tags: ['spell'], cd: 3, fx: 'swell | hoop*3 line | ring daze',
  text: 'Hits for 76% MGK. If the foe uses a move at its next turn: 100% MGK, Silence 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.76 }); if (!c.tgt.ko) c.mark(c.tgt, 'siren_word', 1, 1); } });
defMove({ id: 'allclear', name: 'Rising Swell', type: 'GEAR', owner: 'siren', reach: 'self', cd: 3, wt: 60, fx: 'swell | bell*3 orbit | ring self',
  text: 'For 3 turns its attacks add 40% MGK, and the foe\'s passives do nothing.',
  run(c) { c.mark(c.u, 'siren_glaives', 1, 3); if (!c.blocked(c.tgt)) c.mark(c.tgt, 'siren_drown', 1, 3); } });
defMove({ id: 'klaxon', name: 'Fog Signal', type: 'GEAR', owner: 'siren', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | hoop*5 wave | ring all big dark',
  text: 'Hits for 80% MGK. Splash 35%. Silence 1 on every foe.',
  run(c) { c.spread({ mgk: 0.8 }); for (const e of standing(c.them)) c.st(e, 'silence', 1); } });

// ================================================================ BEAST

// howl: a wolf's pale shell, nose down on a smell from years back, that follows a foe anywhere and never lets go once it has hold.
defMark({ id: 'howl_trail', name: 'on the trail', clock: 'own', volatile: true, value: 0.1,
  aims(b, f) { const code = f.m.howl_trail?.v || 0; return code ? b.s[Math.floor((code - 1) / 8)]?.f[(code - 1) % 8] || null : null; } });
defMark({ id: 'howl_hold', name: 'held in its jaws', clock: 'own', negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' ? 'Held in its jaws.' : null; } });
defPassive({ id: 'bloodscent', name: 'Old Scent', owner: 'howl', text: 'Deals 1.2x damage to foes below 50% HP. Haste 1 when a foe first drops below 30%.',
  outMul(b, f, t) { return pctOut(t, 0.5) ? 1.2 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !t.ko && pctOut(t, 0.3) && !t.k.scented) { t.k.scented = 1; applyStatus(b, f, f, 'haste', 1); } } });
defPassive({ id: 'pack', name: 'Lean Years', owner: 'howl', text: 'Its attacks heal 15% of the damage dealt, 30% while it is below 50% HP.',
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * (pctOut(f, 0.5) ? 0.3 : 0.15)); } });
defMove({ id: 'bite', name: 'Jaw', type: 'BEAST', owner: 'howl', reach: 'single', cd: 1, fx: 'lunge | fang | bite', text: 'Hits for 62% ATK + 3% of the foe\'s max HP. Heals 20% of the damage.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.62, tgtHp: 0.03 }); c.heal(c.u, d * 0.2); } });
defMove({ id: 'rundown', name: 'Nose Down', type: 'TIDE', owner: 'howl', reach: 'single', cd: 2, fx: 'sink | drop*2 line fast | bite',
  text: 'Hits for 69% ATK, 1.5x on a foe that just came out. Tracks the foe for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.69 }, { mult: cameOutSince(c.b, c.tgt, c.u) ? 1.5 : 1 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.mark(c.u, 'howl_trail', 1, 3, c.tgt.side * 8 + c.tgt.idx + 1); } });
defMove({ id: 'hackles', name: 'Moon Howl', type: 'BEAST', owner: 'howl', reach: 'single', cd: 5, wt: 60, fx: 'swell | moon rise | ring daze', text: 'Hits for 60% ATK. The foe must switch at its next turn. Fortify 2.',
  run(c) { c.hit(c.tgt, { atk: 0.6 }); c.st(c.u, 'fortify', 2); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'switch'); } });
defMove({ id: 'pindown', name: 'Never Let Go', type: 'BEAST', owner: 'howl', reach: 'single', cd: 5, nerve: 4, fx: 'lunge big | fang*3 converge | bite big jolt',
  text: 'Hits 3 times for 35% ATK. Stun 1. Heals 40% of it. The foe can\'t switch 2 turns.',
  run(c) { c.st(c.tgt, 'stun', 1); let d = 0; for (let i = 0; i < 3; i++) d += c.hit(c.tgt, { atk: 0.35 }); c.heal(c.u, d * 0.4); if (!c.tgt.ko && !c.blocked(c.tgt)) c.mark(c.tgt, 'howl_hold', 1, 2); } });

// yoke: an ox team's yoke with the oxen's shape still in it, that pulls whatever it is tied to and stamps when it is not.
defMark({ id: 'yoke_hoof', name: 'trodden', max: 3, volatile: true, negative: true, value: -0.08 });
/** A Hoof on t from the yoke. At 3: Stun 1, and the Hooves go. */
function yokeHoof(b: Battle, by: Fighter, t: Fighter, n = 1): void {
  if (t.ko || t.gone || !mark(b, by, t, 'yoke_hoof', n, -1)) return;
  if (marked(t, 'yoke_hoof') >= 3) { unmark(t, 'yoke_hoof'); applyStatus(b, by, t, 'stun', 1); }
}
defMark({ id: 'yoke_pull', name: 'yoked', clock: 'own', volatile: true, value: 0.15,
  leave(b, f) {
    if (f.ko) return;
    const t = foeOf(b, f);
    if (!t || t.ko || t.gone) return;
    msg(b, `${label(b, f)} pulls ${label(b, t)} out with it.`);
    forceOut(b, f, t.side);
  } });
defMark({ id: 'yoke_stomp', name: 'stamping', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) {
    const t = foeOf(b, f);
    if (t.ko || t.gone) return;
    dealDamage(b, f, t, stat(b, f, 'atk') * 0.4, plain('P'), 'BEAST');
    if (!t.ko) yokeHoof(b, f, t);
  } });
defPassive({ id: 'trample', name: 'Field Rest', owner: 'yoke', text: 'When it Stuns or forces out a foe: heals 6% of its max HP, reserves 3%.' });
defPassive({ id: 'unbroken', name: 'Hard Neck', owner: 'yoke', text: 'Takes 0.75x damage while it has a bad status.',
  inMul(b, f) { return negatives(f) > 0 ? 0.75 : 1; } });
defMove({ id: 'toss', name: 'Plough Up', type: 'ROOT', owner: 'yoke', reach: 'spread', cd: 2, fx: 'stomp | pebble*3 rise | crack',
  text: 'Hits for 60% ATK. Splash 35%. Interrupts and delays it 30%. A Hoof on each foe.',
  run(c) { c.spread({ atk: 0.6 }); c.interrupt(c.tgt); c.delay(c.tgt, 30); for (const e of standing(c.them)) if (!c.blocked(e)) yokeHoof(c.b, c.u, e); } });
defMove({ id: 'headbutt', name: 'Horn Shove', type: 'BEAST', owner: 'yoke', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | burst crack',
  text: 'Hits for 130% ATK. Forces the foe out. Its Hooves pass to the one that comes in.',
  run(c) {
    const n = c.marked(c.tgt, 'yoke_hoof');
    c.hit(c.tgt, { atk: 1.3 });
    if (c.tgt.ko || !c.forceOut()) return;
    const t = c.them.f[c.them.out];
    if (n > 0 && t && t !== c.tgt) yokeHoof(c.b, c.u, t, n);
  } });
defMove({ id: 'bellow', name: 'Stamp Furrows', type: 'BEAST', owner: 'yoke', reach: 'self', cd: 3, wt: 70, fx: 'stomp | ring self', text: 'At its next 2 turns: hits for 40% ATK and adds a Hoof. At 3 Hooves: Stun 1.',
  run(c) { c.mark(c.u, 'yoke_stomp', 1, 2); } });
defMove({ id: 'undertheyoke', name: 'Pull Hard', type: 'BEAST', owner: 'yoke', reach: 'self', cd: 6, nerve: 4, fx: 'swell big | ring self big jolt',
  text: 'Cleanses itself. Unstoppable 2. Fortify 2 (60% less). 3 turns: the foe leaves with it.',
  run(c) { c.cleanse(c.u); c.st(c.u, 'unstop', 2); c.st(c.u, 'fortify', 2, 0.6); c.mark(c.u, 'yoke_pull', 1, 3); } });

// stoat: a stoat's white winter shell that throws icicles, sets snares in the snow, and dances its prey into staring.
defMark({ id: 'stoat_stare', name: 'staring', clock: 'own', negative: true, value: -0.12,
  order() { return -1; } });
const STOAT_CAT: SpriteData = { px: ['........', '.....2.2', '44...222', '.2222212', '.222222.', '..22.2..', '.2.33.2.', '2...3..2'], c: ['#f2f2ee', '#9cd3f2', '#a26420'] };
defMark({ id: 'stoat_hunted', name: 'hunted', clock: 'own', negative: true, value: -0.06 });
defMark({ id: 'stoat_snare', name: 'snare set', value: 0.06,
  anyOut(b, f, who) {
    if (who.side === f.side) return;
    unmark(f, 'stoat_snare');
    msg(b, `${label(b, who)} steps into a trap.`);
    dealDamage(b, f, who, stat(b, f, 'atk') * 0.55, plain('P'), 'BEAST');
    if (who.ko) return;
    applyStatus(b, f, who, 'slow', 1);
    mark(b, f, who, 'stoat_hunted', 1, 2);
  } });
defMark({ id: 'stoat_cat', name: 'dancing', clock: 'own', value: 0.1,
  expire(b, f) { clearForm(b, f); msg(b, `${label(b, f)} ceases its dance.`); },
  leave(b, f) { unmark(f, 'stoat_cat'); clearForm(b, f); } });
const stoatCat = (f: Fighter) => f.form?.tag === 'cat';
defPassive({ id: 'weasel', name: 'War Dance', owner: 'stoat', text: 'While it dances: deals 1.25x damage to Hunted foes.',
  outMul(b, f, t) { return stoatCat(f) && marked(t, 'stoat_hunted') ? 1.25 : 1; } });
defPassive({ id: 'wintercoat', name: 'Ermine', owner: 'stoat', text: 'While it dances: takes 0.85x damage.',
  inMul(b, f) { return stoatCat(f) ? 0.85 : 1; } });
defMove({ id: 'nip', name: 'Icicle Throw', type: 'BEAST', owner: 'stoat', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | shard line fast | shatter frost', text: 'Hits for 219% ATK. Slow 1. Hunted 2.',
  run(c) { c.hit(c.tgt, { atk: 2.19 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'stoat_hunted', 1, 2); } });
defMove({ id: 'dart', name: 'Snow Snare', type: 'TIDE', owner: 'stoat', reach: 'single', cd: 3, fx: 'sink | sand*2 rise | frost',
  text: 'Hits for 110% ATK. Expose 1. Next foe out: 55% ATK, Slow 1, Hunted 2.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); c.st(c.tgt, 'expose', 1); c.mark(c.u, 'stoat_snare', 1); } });
defMove({ id: 'slipaway', name: 'Warm Den', type: 'BEAST', owner: 'stoat', reach: 'ally', cd: 3, fx: 'sink | leaf*2 rise | ring ally',
  text: 'Heals an ally 12% of its max HP + 21% CHA. Haste 1. Hidden 1 in the den.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.12 + c.cha(0.21)); c.st(c.ally!, 'haste', 1); c.st(c.ally!, 'hidden', 1); } });
defMove({ id: 'dance', name: 'Mad Dance', type: 'BEAST', owner: 'stoat', reach: 'self', tags: ['dash'], cd: 5, nerve: 3, wt: 60, fx: 'spin | feather*4 orbit | sparkle ring tint self big',
  text: 'Dances 3 turns: 1.15x ATK, 1.1x AGI, new moves. Haste 1. The foe\'s moves go Late.',
  run(c) {
    setForm(c.b, c.u, { tag: 'cat', sprite: STOAT_CAT, statMul: { atk: 1.15, agi: 1.1 } }, ['stoat_takedown', 'stoat_pounce', 'stoat_swipe']);
    c.mark(c.u, 'stoat_cat', 1, 3);
    c.st(c.u, 'haste', 1);
    if (!c.blocked(c.tgt)) c.mark(c.tgt, 'stoat_stare', 1, 3);
  } });
defMove({ id: 'stoat_takedown', name: 'Nape Bite', type: 'BEAST', owner: 'stoat', reach: 'single', cd: 1, extra: true,
  fx: 'lunge | fang | bite', text: 'Hits for 113% ATK + 19% of the foe\'s missing HP. 1.5x if Hunted.',
  run(c) { c.hit(c.tgt, { atk: 1.13, tgtMiss: 0.19 }, { mult: marked(c.tgt, 'stoat_hunted') ? 1.5 : 1 }); } });
defMove({ id: 'stoat_pounce', name: 'Pounce Off', type: 'BEAST', owner: 'stoat', reach: 'single', cd: 2, extra: true,
  fx: 'hop | claw', text: 'Hits for 106% ATK. Its next turn comes 30% sooner. On a Hunted foe: no cooldown.',
  run(c) { const h = marked(c.tgt, 'stoat_hunted') > 0; c.hit(c.tgt, { atk: 1.06 }); c.hasten(c.u, 30); if (h) { const i = c.u.moves.indexOf('stoat_pounce'); if (i >= 0) c.u.cd[i] = 0; } } });
defMove({ id: 'stoat_swipe', name: 'Snow Rake', type: 'BEAST', owner: 'stoat', reach: 'spread', cd: 2, extra: true,
  fx: 'spin | sand*3 sweep | claw all', text: 'Hits for 100% ATK. Splash 35%.',
  run(c) { c.spread({ atk: 1 }); } });

// leech: a marsh leech's shell that holds on until it is full, rides what it drinks from, and bursts it back out.
defPassive({ id: 'engorge', name: 'Swollen', owner: 'leech', text: 'MGK +3% of its max HP. Latched on: lets go when full or when its host guards.',
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.maxHp * 0.03) : 0; } });
defPassive({ id: 'clot', name: 'Clotting', owner: 'leech', text: 'Immune to Rot. Takes 0.8x damage from Bleed and Poison.',
  inMul(b, f, src, d) { return d.dot && !d.move && d.kind !== 'M' ? 0.8 : 1; } });
defMove({ id: 'draw', name: 'Draw Blood', type: 'BEAST', owner: 'leech', reach: 'single', tags: ['spell'], cd: 1, fx: 'lunge | fang | bite drip',
  text: 'Hits for 130% MGK. Heals 40% of the damage. Every 3rd use: 1.5x.',
  run(c) { c.u.k.draws = (c.u.k.draws || 0) + 1; const d = c.hit(c.tgt, { mgk: 1.3 }, { mult: c.u.k.draws % 3 === 0 ? 1.5 : 1 }); c.heal(c.u, d * 0.4); } });
defMove({ id: 'pool', name: 'Latch On', type: 'BEAST', owner: 'leech', reach: 'single', cd: 3, wt: 70, fx: 'hop | fang | bite drip',
  text: 'Slow 1. Pays 10% HP to latch onto the foe: drinks 8% max HP a turn, 4 times.',
  run(c) {
    payHp(c.b, c.u, c.u.hp * 0.1);
    c.st(c.tgt, 'slow', 1);
    if (!c.preview && !c.tgt.ko && !c.blocked(c.tgt)) latchOn(c.b, c.u, c.tgt, 3);
  } });
defMove({ id: 'bloat', name: 'Gorge', type: 'TIDE', owner: 'leech', reach: 'spread', tags: ['spell'], cd: 3, fx: 'swell | drop*3 wave | splash drip',
  text: 'Hits for 83% MGK + 9% of its max HP. Splash 35%. Pays 8% current HP.',
  run(c) { payHp(c.b, c.u, c.u.hp * 0.08); c.spread({ mgk: 0.83, selfHp: 0.09 }); } });
defMove({ id: 'hemorrhage', name: 'Burst Full', type: 'BEAST', owner: 'leech', reach: 'spread', cd: 6, nerve: 5, fx: 'swell big | drop*5 converge | splash drip big tint',
  text: 'Expose 1. Its next turn: 120% MGK, Splash 35%, heals 25%. Cast at full HP: 1.5x.',
  run(c) { c.st(c.tgt, 'expose', 1); c.u.k.hemo = c.u.hp >= c.u.maxHp ? 1.5 : 1; } });

// carrion: a carrion crow's shell that waits on the fence, calls a flock in, and becomes the whole flock when it is ready.
const CARRION_DEMON: SpriteData = { px: ['2......2', '22.22.22', '22322322', '22222222', '33322222', '33.2.2.2', '3.2.2.2.', '.4.4....'], c: ['#393544', '#e13634', '#635969'] };
defMark({ id: 'carrion_demon', name: 'a flock', clock: 'own', value: 0.2,
  turnStart(b, f) {
    const them = b.s[1 - f.side];
    let total = 0;
    for (const e of standing(them)) {
      const out = e.idx === them.out;
      total += dealDamage(b, f, e, stat(b, f, 'atk') * 0.36 * (out ? 1 : SPREAD_SHARE), { ...plain('P'), spread: true, reserve: !out }, 'BEAST');
    }
    heal(b, f, f, total * 0.5);
  },
  expire(b, f) { msg(b, `${label(b, f)} releases the flock.`); clearForm(b, f); },
  leave(b, f) { unmark(f, 'carrion_demon'); clearForm(b, f); } });
defPassive({ id: 'gather', name: 'Picks Over', owner: 'carrion', text: 'When a foe is KO\'d: +6% ATK for the battle. Heals 8% of its max HP.',
  anyKO(b, f, v) { if (v === f || v.side === f.side) return; f.k.picked = (f.k.picked || 0) + 1; heal(b, f, f, f.maxHp * 0.08); },
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.06 * (f.k.picked || 0)) : 0; } });
defPassive({ id: 'watch', name: 'Waits for It', owner: 'carrion', text: 'Deals true damage to foes below 30% HP. Flock: a single-target hit fells one bird.' });
defMove({ id: 'peck', name: 'Flock Peck', type: 'BEAST', owner: 'carrion', reach: 'spread', cd: 1, fx: 'hop | feather*3 sweep | slash', text: 'Hits for 31% ATK. Splash 35%.',
  run(c) { c.spread({ atk: 0.31 }); } });
defMove({ id: 'mob', name: 'Mobbing', type: 'BEAST', owner: 'carrion', reach: 'single', cd: 3, wu: 60, fx: 'swell | feather*5 converge | claw',
  text: 'Wind-up. Hits for 96% ATK, +25% per bird past the first. Root 2. Expose 1.',
  run(c) { c.hit(c.tgt, { atk: 0.96 }, { mult: 1 + 0.25 * (bodiesOf(c.u) - 1) }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'circle', name: 'Circle Low', type: 'VOID', owner: 'carrion', reach: 'single', cd: 3, fx: 'lift | feather*2 orbit | claw dark',
  text: 'Hits for 92% ATK. Root 1. Already Rooted: delays it 30%.',
  run(c) { const rooted = !!c.tgt.s.root; c.hit(c.tgt, { atk: 0.92 }); c.st(c.tgt, 'root', 1); if (rooted) c.delay(c.tgt, 30); } });
defMove({ id: 'feast', name: 'Black Flock', type: 'BEAST', owner: 'carrion', reach: 'self', tags: ['projectile'], cd: 6, nerve: 5, fx: 'swell big | feather*6 orbit | slash all big dark',
  text: 'Becomes a Flock of 4 for 3 turns. Each turn: 36% ATK, Splash 35%, heals half.',
  run(c) { setForm(c.b, c.u, { tag: 'demon', sprite: CARRION_DEMON }); c.mark(c.u, 'carrion_demon', 1, 3); setFlock(c.b, c.u, 4, 3); } });

// gore: a bull's shell, barnacled at the horns, that backs off for a run-up and comes from wherever you are not looking.
function goreBash(b: Battle, f: Fighter, t: Fighter): void {
  if (t.ko || t.gone) return;
  msg(b, `${label(b, f)} shoves hard.`);
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
defMove({ id: 'horn', name: 'Hook Horn', type: 'BEAST', owner: 'gore', reach: 'single', cd: 1, fx: 'lunge | burst', text: 'Hits for 139% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.39 }); } });
defMove({ id: 'charge', name: 'Long Charge', type: 'TIDE', owner: 'gore', reach: 'single', tags: ['dash'], cd: 3, wu: 80, unstop: true, fx: 'lunge slow | splash crack jolt',
  text: 'Unstoppable wind-up. Hits for 150% ATK, 1.5x from Far. Stun 1. Ends Near.',
  run(c) {
    const far = rangeOf(c.b) === 'far';
    c.hit(c.tgt, { atk: 1.5 }, { mult: far ? 1.5 / RANGE_DOWN : 1 });
    c.st(c.tgt, 'stun', 1);
    if (!c.tgt.ko) setRange(c.b, 'near');
  } });
defMove({ id: 'stampmove', name: 'Paw the Sand', type: 'BEAST', owner: 'gore', reach: 'self', cd: 4, wt: 50, fx: 'stomp | sand*2 rise | puff self',
  text: 'Haste 2. Unstoppable 2. Backs off to Far for a run-up.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'unstop', 2); setRange(c.b, 'far'); } });
defMove({ id: 'stampede', name: 'From Behind', type: 'BEAST', owner: 'gore', reach: 'single', cd: 6, nerve: 5, noGuard: true, fx: 'blink | fang*2 converge | bite big jolt',
  text: 'Hits for 220% ATK through guard. Interrupts. Delays the foe 30%.',
  run(c) { c.hit(c.tgt, { atk: 2.2 }); if (c.tgt.ko || c.blocked(c.tgt)) return; c.interrupt(c.tgt); c.delay(c.tgt, 30); } });

// thumb: a giant's thumb by itself, pale and nailed like a shell, that clenches when hit and presses down on whatever is under it.
defMark({ id: 'thumb_pin', name: 'pinned', clock: 'own', negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' ? 'Pinned under the thumb.' : null; } });
defPassive({ id: 'grip', name: 'Thick Nail', owner: 'thumb', text: 'Takes 0.85x damage from moves. Pinned: a mark. A Pinned foe can\'t switch out.',
  inMul(b, f, src, d) { return d.move ? 0.85 : 1; } });
defPassive({ id: 'opposable', name: 'Clench', owner: 'thumb', text: 'When hit: 1 Clench, up to 5. Each Clench: +4% damage.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.uproar = Math.min(5, (f.k.uproar || 0) + 1); },
  outMul(b, f) { return 1 + 0.04 * (f.k.uproar || 0); } });
defMove({ id: 'press', name: 'Press Down', type: 'BEAST', owner: 'thumb', reach: 'single', splash: 0.25, cd: 1, fx: 'stomp | quake', text: 'Hits for 90% ATK. Splash 25%.',
  run(c) { c.hit(c.tgt, { atk: 0.9 }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.9 }, { reserve: true, spread: true, mult: 0.25 }); } });
defMove({ id: 'pinch', name: 'Thumb Flick', type: 'BEAST', owner: 'thumb', reach: 'single', tags: ['dash'], cd: 3, wu: 60, fx: 'lunge | burst',
  text: 'Wind-up. Hits for 106% ATK. Forces the foe out. Stun 1 on the one that comes in.',
  run(c) {
    c.hit(c.tgt, { atk: 1.06 });
    if (c.tgt.ko) return;
    const moved = c.forceOut();
    const t = c.them.f[c.them.out];
    c.st(moved ? t : c.tgt, 'stun', 1);
  } });
defMove({ id: 'thumbsdown', name: 'Let Go', type: 'ROOT', owner: 'thumb', reach: 'spread', cd: 3, fx: 'swell | pebble*3 rise | quake',
  text: 'Hits for 51% ATK + 13% per Clench, all spent. Splash 35%. Fortify 1.',
  run(c) { const u = c.u.k.uproar || 0; c.u.k.uproar = 0; c.spread({ atk: 0.51 + 0.13 * u }); c.st(c.u, 'fortify', 1); } });
defMove({ id: 'squash', name: 'Squash Flat', type: 'BEAST', owner: 'thumb', reach: 'single', tags: ['channel'], cd: 6, nerve: 5, wt: 150, fx: 'lift big | quake crack big jolt',
  text: 'Hits 3 times for 47% ATK. Stun 1. Pinned 2. Its own next turn comes 50% later.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.47 }); c.st(c.tgt, 'stun', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) c.mark(c.tgt, 'thumb_pin', 1, 2); } });

// hare: a March hare's shell that boxes the moon in spring, squares up to a foe for a bout, and kicks whatever stands up to it.
defMark({ id: 'hare_flurry', name: 'on its toes', max: 2, clock: 'own', volatile: true, value: 0.05,
  outMul(b, f, t, d) { return d.attack ? 1.3 : 1; },
  afterAttack(b, f) { const mk = f.m.hare_flurry; if (!mk) return; mk.n--; if (mk.n <= 0) unmark(f, 'hare_flurry'); hastenFighter(b, f, 15); } });
defMark({ id: 'hare_mark', name: 'boxed', clock: 'own', negative: true, value: -0.05 });
defPassive({ id: 'quick', name: 'Spring Legs', owner: 'hare', text: 'When it uses a move: its next 2 attacks deal 1.3x and come 15% sooner.',
  afterMove(b, f) { mark(b, f, f, 'hare_flurry', 2 - marked(f, 'hare_flurry'), 3); } });
defPassive({ id: 'box', name: 'Moon Boxer', owner: 'hare', text: 'Its moves heal it 10% of their damage.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) heal(b, f, f, dealt * 0.1); } });
defMove({ id: 'kick', name: 'Hind Kick', type: 'BEAST', owner: 'hare', reach: 'single', cd: 1, fx: 'hop | claw', text: 'Hits for 107% ATK. Boxed 2. On a Boxed foe: 102% ATK + 12% missing HP instead.',
  run(c) {
    if (c.marked(c.tgt, 'hare_mark')) { unmark(c.tgt, 'hare_mark'); c.hit(c.tgt, { atk: 1.02, tgtMiss: 0.12 }); return; }
    c.hit(c.tgt, { atk: 1.07 });
    if (!c.tgt.ko) c.mark(c.tgt, 'hare_mark', 1, 2);
  } });
defMove({ id: 'bolt', name: 'Zigzag', type: 'BEAST', owner: 'hare', reach: 'reserveAlly', tags: ['dash'], cd: 3, tag: true, fx: 'hop fast | ring ally', text: 'Switches to an ally. Shields itself 10% and the ally 12% of max HP.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.1, 3); c.shield(c.ally!, c.ally!.maxHp * 0.12, 3); } });
defMove({ id: 'freeze', name: 'Thump Ring', type: 'ROOT', owner: 'hare', reach: 'spread', cd: 3, fx: 'stomp | pebble*2 rise | quake ring',
  text: 'Hits for 77% ATK. Splash 35%. Slow 2. A 3-round bout: no switching, best of 2.',
  run(c) { c.spread({ atk: 0.77 }); c.st(c.tgt, 'slow', 2); if (!c.preview && !c.tgt.ko && !c.blocked(c.tgt)) startBout(c.b, c.u, c.tgt, 3); } });
defMove({ id: 'madmarch', name: 'Box the Moon', type: 'BEAST', owner: 'hare', reach: 'single', cd: 6, nerve: 4,
  fx: 'lunge big | moon arc | burst big jolt', text: 'Hits for 158% ATK. Forces the foe out. The next foe takes 93% ATK.',
  run(c) {
    c.hit(c.tgt, { atk: 1.58 });
    if (c.tgt.ko || c.blocked(c.tgt) || !c.forceOut()) return;
    c.hit(c.them.f[c.them.out], { atk: 1.58 }, { mult: 0.6 });
  } });

// ================================================================ STAR

// paring: a thin crescent of the moon's monthly shell that came down in a field and still waxes and wanes by the night.
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
defMove({ id: 'crescent', name: 'Crescent Edge', type: 'STAR', owner: 'paring', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | moon line | slash', text: 'Hits for 110% MGK. Moonlit 3.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); if (!c.tgt.ko) c.mark(c.tgt, 'paring_moonlit', 1, 3); } });
defMove({ id: 'waning', name: 'Wane', type: 'STAR', owner: 'paring', reach: 'self', tags: ['projectile'], cd: 3, fx: 'sink | moon*2 orbit | ring self', text: 'Shield of 15% of its max HP. At its next 2 turns: hits the foe for 45% MGK.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.15, 3); c.mark(c.u, 'paring_orbs', 1, 2); } });
defMove({ id: 'lunarrush', name: 'Thin Edge', type: 'TIDE', owner: 'paring', reach: 'single', tags: ['spell'], cd: 3, fx: 'blink | moon line fast | slash',
  text: 'Hits for 144% MGK. On a Moonlit foe: removes it, cooldown resets.',
  run(c) {
    const lit = marked(c.tgt, 'paring_moonlit') > 0;
    c.hit(c.tgt, { mgk: 1.44 });
    if (lit && !c.blocked(c.tgt)) { unmark(c.tgt, 'paring_moonlit'); const i = c.u.moves.indexOf('lunarrush'); if (i >= 0) c.u.cd[i] = 0; }
  } });
defMove({ id: 'fullphase', name: 'Waxes Full', type: 'STAR', owner: 'paring', reach: 'spread', tags: ['spell'], cd: 5, nerve: 4, fx: 'swell big | moon*4 rain | sparkle all big glare',
  text: 'Hits for 86% MGK, +20% per foe standing. Splash 35%. Slow 2 on every foe.',
  run(c) { const n = standing(c.them).length; for (const e of standing(c.them)) c.st(e, 'slow', 2); c.spread({ mgk: 0.86 }, { mult: 1 + 0.2 * n }); } });

// coma: a comet's icy head that came round once and stayed, and that comes back from the bench the harder the longer it was away.
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
defPassive({ id: 'perihelion', name: 'Sunward', owner: 'coma', text: 'When it comes out: its first move is Unstoppable and deals 1.3x, +0.1x per turn in reserve.',
  reserveTurn(b, f) { f.k.away = Math.min(5, (f.k.away || 0) + 1); },
  comeOut(b, f) { f.k.awayOut = f.k.away || 0; f.k.away = 0; },
  outMul(b, f, t, d) { return f.k.fresh && d.move ? 1.3 + 0.1 * (f.k.awayOut || 0) : 1; } });
defMove({ id: 'dustmove', name: 'Dust Tail', type: 'STAR', owner: 'coma', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | comet line | burst', text: 'Hits for 73% MGK. Slow 1. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.73 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 15); } });
defMove({ id: 'icecore', name: 'Frozen Core', type: 'STAR', owner: 'coma', reach: 'self', cd: 3, wt: 60, fx: 'swell | shard*3 orbit | frost self', text: 'For 3 turns: attacks add 30% DEF, reserves take 30% MGK. Fortify 1.',
  run(c) { c.mark(c.u, 'coma_clap', 1, 3); c.st(c.u, 'fortify', 1); } });
defMove({ id: 'streak', name: 'Tail Sweep', type: 'STONE', owner: 'coma', reach: 'spread', tags: ['spell'], cd: 3, fx: 'spin | sand*4 sweep | puff',
  text: 'Hits for 42% MGK + 40% DEF. Splash 35%. Weaken 2.',
  run(c) { c.spread({ mgk: 0.42, def: 0.4 }, { kind: 'M' }); c.st(c.tgt, 'weaken', 2); } });
defMove({ id: 'impact', name: 'Strike Home', type: 'STAR', owner: 'coma', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 70, unstop: true,
  fx: 'lift big | comet*3 rain | burst all big jolt', text: 'Unstoppable wind-up. Hits for 117% MGK. Splash 35%. Stun 1.',
  run(c) { c.spread({ mgk: 1.17 }); c.st(c.tgt, 'stun', 1); } });

// curtain: the shell of the northern lights that hangs in folds, bends its own light back, hides its friends, and closes round a foe.
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
defPassive({ id: 'veil', name: 'Green Cover', owner: 'curtain', text: 'In reserve: your out Whorl takes 0.9x magic damage.',
  auraIn(b, f, o, src, d) { return d.kind === 'M' ? 0.9 : 1; } });
defMove({ id: 'ripple', name: 'Fold Back', type: 'STAR', owner: 'curtain', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | beam ray | flash', text: 'Hits for 68% MGK. At its next turn: hits for 40% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.68 }); c.mark(c.u, 'curtain_hex', 1, 2); } });
defMove({ id: 'brighthour', name: 'Flicker', type: 'STAR', owner: 'curtain', reach: 'self', tags: ['dash'], cd: 4, wt: 60, fx: 'blink | star*3 orbit | sparkle self', text: 'Ward 1. Haste 2. Fold Back\'s cooldown resets.',
  run(c) { c.st(c.u, 'ward', 1); c.st(c.u, 'haste', 2); const i = c.u.moves.indexOf('ripple'); if (i >= 0) c.u.cd[i] = 0; } });
defMove({ id: 'bands', name: 'Green Bands', type: 'ROOT', owner: 'curtain', reach: 'spread', tags: ['spell'], cd: 3, fx: 'sway | leaf*4 wave | bloom all tint',
  text: 'Hits for 52% MGK. Splash 35%. Slow 2. Delays it 20%. Fogs your bench 2 rounds.',
  run(c) { c.spread({ mgk: 0.52 }); c.st(c.tgt, 'slow', 2); c.delay(c.tgt, 20); fogBench(c.b, c.u.side, 2); } });
defMove({ id: 'encore', name: 'Draw Close', type: 'STAR', owner: 'curtain', reach: 'single', tags: ['spell'], cd: 6, nerve: 5,
  fx: 'swell big | beam ray | sigil sparkle glare', text: 'Hits for 96% MGK. For 3 turns the foe can\'t switch and takes 1.2x from it.',
  run(c) { c.hit(c.tgt, { mgk: 0.96 }); if (!c.tgt.ko) c.mark(c.tgt, 'curtain_world', 1, 3); } });

// fulgur: a fork of glass fused out of beach sand where lightning struck, that strikes the same place twice.
defPassive({ id: 'conductive', name: 'Wet Sand', owner: 'fulgur', text: 'Adds 15% to the Splash of its moves.' });
defPassive({ id: 'static', name: 'Glass Charge', owner: 'fulgur', text: 'Its moves add 4% of the foe\'s current HP. Its attackers take 30% MGK.',
  addRaw(b, f, t, d) { return d.move && !d.reserve ? t.hp * 0.04 : 0; } });
defMove({ id: 'arcbolt', name: 'Sand Arc', type: 'STONE', owner: 'fulgur', reach: 'spread', tags: ['spell'], cd: 1, fx: 'flare | sand*3 zigzag | burst',
  text: 'Hits for 60% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 0.6 }); } });
defMark({ id: 'fulgur_struck', name: 'struck once', clock: 'own', volatile: true, negative: true, value: -0.04 });
defMove({ id: 'fork', name: 'Same Place', type: 'STAR', owner: 'fulgur', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'flare | bolt line fast | flash', text: 'Hits for 79% MGK. Expose 1. Interrupts. 1.35x on a foe it hit in its last 3 turns.',
  run(c) { const again = c.marked(c.tgt, 'fulgur_struck') > 0; c.hit(c.tgt, { mgk: 0.79 }, { mult: again ? 1.35 : 1 }); c.interrupt(c.tgt); c.st(c.tgt, 'expose', 1); if (!c.tgt.ko) c.mark(c.tgt, 'fulgur_struck', 1, 3); } });
defMove({ id: 'flash', name: 'Flash Over', type: 'STAR', owner: 'fulgur', reach: 'single', tags: ['dash', 'spell'], cd: 3, wt: 70, fx: 'blink fast | bolt zigzag | flash',
  text: 'Hits for 52% MGK. Slow 1. Its next turn comes 30% sooner. Readies Same Place.',
  run(c) { c.hit(c.tgt, { mgk: 0.52 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 30); const i = c.u.moves.indexOf('fork'); if (i >= 0) c.u.cd[i] = 0; } });
defMove({ id: 'thundergod', name: 'Whole Sky', type: 'STAR', owner: 'fulgur', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift big | bolt*5 rain | flash all big glare jolt',
  text: 'Hits for 105% MGK, 1.2x on any foe below 50% HP. Splash 35%.',
  run(c) {
    const share = Math.min(1, (c.move.splash ?? 0.35) + (has(c.u, 'conductive') ? WET_SAND : 0));
    c.hit(c.tgt, { mgk: 1.05 }, { spread: true, mult: pctOut(c.tgt, 0.5) ? 1.2 : 1 });
    for (const r of reserves(c.them)) c.hit(r, { mgk: 1.05 }, { spread: true, reserve: true, mult: share * (pctOut(r, 0.5) ? 1.2 : 1) });
  } });

// halo: a saint's halo, a ring of pale light that floats over whoever it picks and glows on over its side after it falls.
defMark({ id: 'halo_hover', name: 'haloed', clock: 'own', value: 0.12,
  glows() { return { turns: 2, heal: 0.06 }; } });
defPassive({ id: 'grace', name: 'Brightening', owner: 'halo', text: 'When it uses a move: +5% damage, up to 3 times. Its shields last +1 turn.',
  afterMove(b, f) { f.k.ascent = Math.min(3, (f.k.ascent || 0) + 1); },
  outMul(b, f) { return 1 + 0.05 * (f.k.ascent || 0); } });
defPassive({ id: 'martyr', name: 'Rim Light', owner: 'halo', text: 'Attacks add 6% foe missing HP. KO\'d: glows 3 turns, your out Whorl heals 8% a turn.',
  addRaw(b, f, t, d) { return d.attack ? (t.maxHp - t.hp) * 0.06 : 0; },
  glows() { return { turns: 3, heal: 0.08 }; } });
defMove({ id: 'smite', name: 'Ring Strike', type: 'STAR', owner: 'halo', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | hoop line | flash', text: 'Hits for 149% MGK. Slow 1. Your lowest-HP Whorl heals 30% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.49 }); c.st(c.tgt, 'slow', 1); c.heal(lowestAlly(c), d * 0.3); } });
defMove({ id: 'aegis', name: 'Hover Over', type: 'STAR', owner: 'halo', reach: 'ally', cd: 2, fx: 'lift | hoop rain | sparkle ally',
  text: 'Heals an ally 12% max HP + 11% CHA. Haste 1. Haloed 2: if it falls, it glows on.',
  run(c) { const a = c.ally!; c.heal(a, a.maxHp * 0.12 + c.cha(0.11)); c.st(a, 'haste', 1); c.mark(a, 'halo_hover', 1, 2); } });
defMove({ id: 'sanctify', name: 'Lit Rim', type: 'GEAR', owner: 'halo', reach: 'single', cd: 3, fx: 'spin | hoop return | slash',
  text: 'Hits for 79% MGK. Next attack: +15% foe missing HP, and 40% MGK to reserves.',
  run(c) { c.hit(c.tgt, { mgk: 0.79 }); c.mark(c.u, 'halo_blade', 1, 2); } });
defMark({ id: 'halo_blade', name: 'rim lit', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? (t.maxHp - t.hp) * 0.15 : 0; },
  afterAttack(b, f) { unmark(f, 'halo_blade'); for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.4, { ...plain('M'), spread: true, reserve: true }, null); } });
defMove({ id: 'intervention', name: 'Crowned', type: 'STAR', owner: 'halo', reach: 'ally', cd: 7, nerve: 5, fx: 'swell big | hoop*3 rain | pillar ally big glare',
  text: 'Cleanses an ally. It is Untouchable for 2 turns.',
  run(c) { c.cleanse(c.ally!); c.st(c.ally!, 'invuln', 2); } });

// umbra: an eclipse's fallen shadow, a disc of dark with a gold rim, that passes over at noon and puts the lights out.
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
defMove({ id: 'shade', name: 'Dusk Edge', type: 'STAR', owner: 'umbra', reach: 'single', cd: 1, fx: 'lunge | slash dark', text: 'Hits for 120% ATK. Empower 1.',
  run(c) { c.hit(c.tgt, { atk: 1.2 }); c.st(c.u, 'empower', 1); } });
defMove({ id: 'blot', name: 'Blot Out', type: 'STAR', owner: 'umbra', reach: 'self', cd: 4, wt: 60, fx: 'blink | ring self dark', text: 'Ward 1. If it blocks a move before its next turn: Haste 2, Empower 1.',
  run(c) { c.st(c.u, 'ward', 1); c.mark(c.u, 'umbra_shroud', 1, 2); } });
defMove({ id: 'umbralstep', name: 'Noon Dark', type: 'STONE', owner: 'umbra', reach: 'single', cd: 4, fx: 'blink | moon line | crack dark',
  text: 'Hits for 100% ATK. Its next turn comes 30% sooner. The foe must switch next turn.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'switch'); c.hasten(c.u, 30); } });
defMove({ id: 'paranoia', name: 'Full Eclipse', type: 'STAR', owner: 'umbra', reach: 'single', cd: 6, nerve: 5, fx: 'swell big | moon converge | vortex big dark', text: 'Hits for 160% ATK. Silence 1. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 1.6 }); c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'root', 2); } });

// portent: a red star's shell that hangs over a place before bad news and keeps a piece of everything it outlasts.
defMark({ id: 'portent_scorch', name: 'red sky', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) {
    heal(b, f, f, f.maxHp * 0.05);
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) dealDamage(b, f, t, stat(b, f, 'mgk') * 0.36, dot('M'), null);
  } });
defPassive({ id: 'foretold', name: 'Keeps a Piece', owner: 'portent', text: 'When it KOs a foe: takes that foe\'s first move into its first slot. 1 tide.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side) return;
    const id = v.moves[0];
    if (MOVES[id] && !MOVES[id].nerve && f.moves[0] !== id) { setMove(b, f, 0, id); msg(b, `${label(b, f)} keeps ${MOVES[id].name}.`); }
    addNerve(b, f.side, 1);
  } });
defPassive({ id: 'illwind', name: 'Bad Sky', owner: 'portent', text: 'Doomed foes take 1.15x damage from everything.' });
defMove({ id: 'sign', name: 'Red Streak', type: 'STAR', owner: 'portent', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | comet line fast | burst cinders', text: 'Hits for 171% MGK + 4% of the foe\'s max HP. Burn 1 (30% MGK each turn).',
  run(c) { c.hit(c.tgt, { mgk: 1.71, tgtHp: 0.04 }); c.st(c.tgt, 'burn', 1, stat(c.b, c.u, 'mgk') * 0.3); } });
defMove({ id: 'badnews', name: 'Red Sky', type: 'STAR', owner: 'portent', reach: 'self', cd: 3, wt: 70, fx: 'swell | star*3 orbit | cinders self tint', text: 'For 3 turns: the foe takes 36% MGK and it heals 5% max HP each turn.',
  run(c) { c.mark(c.u, 'portent_scorch', 1, 3); } });
defMove({ id: 'unlucky', name: 'On Its Way', type: 'STONE', owner: 'portent', reach: 'single', tags: ['spell'], cd: 3, fx: 'lift | pebble rain slow | crack',
  text: 'After 2 of the foe\'s turns: it takes 315% MGK.',
  run(c) { if (c.blocked(c.tgt)) return; c.tgt.k.badnews = 2; c.tgt.k.badnewsDmg = Math.round(stat(c.b, c.u, 'mgk') * 3.15); c.msg(`Something is approaching ${c.tgt.mon.name}.`); } });
defMove({ id: 'doom', name: 'Ill Omen', type: 'STAR', owner: 'portent', reach: 'single', tags: ['spell'], cd: 7, nerve: 5, fx: 'flare big | rune*3 converge | sigil sparkle dark', text: 'Doom 3. The foe takes 60% MGK each turn.',
  run(c) { if (c.st(c.tgt, 'doom', 3, stat(c.b, c.u, 'mgk') * 0.6) && has(c.u, 'illwind')) c.tgt.k.illwind = 1; } });

// flare: a solar flare's shell that burns itself to burn others, fires its moves before they cool, and dies down to a cinder to light again.
const FLARE_EGG: SpriteData = { px: ['........', '...3....', '..4444..', '.442244.', '44422444', '44244244', '.44.244.', '..4444..'], c: ['#da650f', '#f9ca5a', '#3e2e2e'] };
defMark({ id: 'flare_egg', name: 'a cinder', value: 0.4,
  inMul() { return 0; },
  leave(b, f) { unmark(f, 'flare_egg'); clearForm(b, f); } });
defSummon({ id: 'flare_shell', name: 'Cinder Shell', owner: 'flare', sprite: { px: ['........', '........', '..3..3..', '...3....', '.444444.', '44422444', '44222244', '44444444'], c: ['#d97308', '#f9ca5a', '#534341'] }, text: 'Takes single-target hits meant for Honoki. Each turn: hits every foe for 30% MGK. If it lasts 2 turns: Honoki comes back at 60% HP and every foe takes 80% MGK. Stun 1. If it is destroyed: Honoki loses 20% max HP.', every: 100, guard: true,
  act(b, s) { const f = b.s[s.side].f[s.by]; if (f && !f.ko) splash(b, f, stat(b, f, 'mgk') * 0.3, 'M', 'STAR'); },
  gone(b, s, f) {
    if (!f || f.ko || !marked(f, 'flare_egg')) return;
    unmark(f, 'flare_egg'); clearForm(b, f); delete f.s.stun;
    if (s.hp <= 0) { msg(b, `${label(b, f)}'s ember dies.`); dealDamage(b, null, f, f.maxHp * 0.2, dot('T'), null); return; }
    f.hp = Math.max(f.hp, Math.round(f.maxHp * 0.6));
    emit(b, { e: 'heal', side: f.side, idx: f.idx, amt: 0 });
    msg(b, `${label(b, f)} is rekindled.`);
    splash(b, f, stat(b, f, 'mgk') * 0.8, 'M', 'STAR');
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'stun', 1);
  } });
defPassive({ id: 'ignite', name: 'Sunburn', owner: 'flare', text: 'Its damaging moves add Burn 2 (25% MGK each turn).',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko) { t.k.wasBurning = t.s.burn ? 1 : 0; applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.25); } } });
defPassive({ id: 'blaze', name: 'Flare Up', owner: 'flare', text: 'Fires a cooling move early for 8% max HP per turn left. Hits on Burning foes burn reserves.',
  overdrive() { return 0.08; },
  afterDeal(b, f, t, dealt, d) {
    if (!d.move || d.reserve) return;
    const was = t.k.wasBurning !== undefined ? t.k.wasBurning : (t.s.burn ? 1 : 0);
    t.k.wasBurning = undefined as unknown as number;
    if (was) for (const r of reserves(b.s[t.side])) applyStatus(b, f, r, 'burn', 1, stat(b, f, 'mgk') * 0.25);
  } });
defMove({ id: 'sear', name: 'Sunspot', type: 'STAR', owner: 'flare', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | ember line | burst cinders', text: 'Hits for 115% MGK. Slow 1 if the foe was already Burning.',
  run(c) { const burning = !!c.tgt.s.burn; c.hit(c.tgt, { mgk: 1.15 }); if (burning && !c.tgt.ko) c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'flashpoint', name: 'Leap Out', type: 'STAR', owner: 'flare', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'lunge fast | ember*2 line | burst cinders',
  text: 'Pays 5% max HP. Hits for 125% MGK, up to 2x at low HP. Its next turn comes 25% sooner.',
  run(c) { payHp(c.b, c.u, c.u.maxHp * 0.05); c.hit(c.tgt, { mgk: 1.25 }, { mult: 2 - c.u.hp / c.u.maxHp }); c.hasten(c.u, 25); } });
defMove({ id: 'prominence', name: 'Solar Loop', type: 'TIDE', owner: 'flare', reach: 'single', tags: ['spell'], cd: 3, fx: 'spin | ember*3 return | burst cinders',
  text: 'Pays 6% max HP. Hits for 95% MGK + 6% foe max HP, then its first reserve for half.',
  run(c) {
    payHp(c.b, c.u, c.u.maxHp * 0.06);
    c.hit(c.tgt, { mgk: 0.95, tgtHp: 0.06 });
    const r = reserves(c.them)[0];
    if (r) c.hit(r, { mgk: 0.95, tgtHp: 0.06 }, { reserve: true, mult: 0.5 });
  } });
defMove({ id: 'supernova', name: 'Burn Down', type: 'STAR', owner: 'flare', reach: 'self', cd: 6, nerve: 5,
  fx: 'swell big | ember*5 orbit | cinders self big tint', text: 'Summons a Cinder Shell (25% of its max HP, 2 turns) and hides in it.',
  run(c) { setForm(c.b, c.u, { tag: 'egg', sprite: FLARE_EGG }); c.mark(c.u, 'flare_egg', 1); c.st(c.u, 'stun', 4); summon(c.b, c.u, 'flare_shell', { hp: 0.25, turns: 2 }); } });

// ================================================================ special sloughs

// tackle: Tack's cast, a kid's first friend, that grabs, digs in, and rushes, and counts every foe its side brings down.
defMark({ id: 'tackle_hold', name: 'got a grip', clock: 'own', volatile: true, value: 0.06 });
defMark({ id: 'tackle_braced', name: 'braced', clock: 'own', volatile: true, value: 0.08,
  afterTake(b, f, src, dealt, d) {
    if (d.dot || !src || src.side === f.side) return;
    unmark(f, 'tackle_braced');
    const i = f.moves.indexOf('rush');
    if (i >= 0 && f.cd[i] > 0) { f.cd[i] = 0; msg(b, `${label(b, f)} prepares to charge.`); }
  } });

defPassive({ id: 'tally', name: 'Tally', owner: 'tackle', text: 'Deals +10% damage for each foe its side has KO\'d.',
  anyKO(b, f, v, killer) { if (killer && killer.side === f.side && v.side !== f.side) f.k.tally = (f.k.tally || 0) + 1; },
  outMul(b, f) { return 1 + 0.1 * (f.k.tally || 0); } });
defPassive({ id: 'kid', name: 'Kid', owner: 'tackle', text: 'When it comes out: its first turn comes 20% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 20; } });
defMove({ id: 'shove', name: 'Shove', type: 'BEAST', owner: 'tackle', reach: 'single', cd: 1, fx: 'lunge | burst',
  text: 'Hits for 120% ATK, 1.5x after a Grab.',
  run(c) { const g = marked(c.u, 'tackle_hold') > 0; unmark(c.u, 'tackle_hold'); c.hit(c.tgt, { atk: 1.2 }, { mult: g ? 1.5 : 1 }); } });
defMove({ id: 'grab', name: 'Grab', type: 'TIDE', owner: 'tackle', reach: 'single', cd: 2, fx: 'lunge | drop | claw',
  text: 'Hits for 80% ATK. Root 1. Its next Shove deals 1.5x.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'root', 1); c.mark(c.u, 'tackle_hold', 1, 3); } });
defMove({ id: 'standfirm', name: 'Stand Firm', type: 'BEAST', owner: 'tackle', reach: 'self', cd: 3, fx: 'stomp | ring self',
  text: 'Fortify 2. If it is hit before its next turn: Rush is ready.',
  run(c) { c.st(c.u, 'fortify', 2); c.mark(c.u, 'tackle_braced', 1, 1); } });
defMove({ id: 'rush', name: 'Rush', type: 'BEAST', owner: 'tackle', reach: 'single', cd: 5, nerve: 4, fx: 'lunge big | burst crack big jolt',
  text: 'Hits for 180% ATK. Stun 1. A KO with it counts twice for Tally.',
  run(c) { c.hit(c.tgt, { atk: 1.8 }); c.st(c.tgt, 'stun', 1); if (c.tgt.ko && has(c.u, 'tally')) c.u.k.tally = (c.u.k.tally || 0) + 1; } });

// Full, Mundane, Knot, and Holm live in kits8.ts.

export const KITS_LOADED = true;
void isOut; void cleanse;
