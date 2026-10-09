import { addNerve, applyStatus, banish, reflect, dismiss, forceAction, summon, summonsOf, cameOutSince, cleanse, dealDamage, delayFighter, doSwitch, emit, foeOf, giveShield, has, heal, isOut, label, mark, marked, markedBy, msg, reserves, sk, standing, stat, unmark, SPREAD_SHARE } from '../battle/engine';
import type { Battle, Fighter, StatusId, Summon } from '../battle/model';
import { defMark, defMove, defPassive, defSummon, MOVES, type Ctx, type DmgInfo } from '../battle/registry';

/** The fighter that made a summon, or null once it is down. */
const ownerOf = (b: Battle, s: Summon): Fighter | null => { const f = b.s[s.side].f[s.by]; return f && !f.ko ? f : null; };
import type { Type } from './types';

const dot = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
const plain = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: false, spread: false, reserve: false });
const lowestAlly = (c: Ctx): Fighter => standing(c.me).slice().sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0] || c.u;

/** Damage from a hook rather than a move: the out foe in full, each foe reserve at the spread share. */
function splash(b: Battle, u: Fighter, raw: number, kind: 'P' | 'M', type: Type | null): number {
  const them = b.s[1 - u.side];
  const t = them.f[them.out];
  let dealt = 0;
  if (t && !t.ko && !t.gone) dealt = dealDamage(b, u, t, raw, { kind, move: null, attack: false, dot: false, spread: true, reserve: false }, type);
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

/** Switches a side's out whorl for one of its reserves, unless the out whorl is held in place. */
function swapIn(b: Battle, f: Fighter, to: Fighter): boolean {
  if (f.s.root || f.s.taunt || to.ko || to.gone || !isOut(b, f)) return false;
  doSwitch(b, f.side, to.idx);
  return true;
}

// ================================================================ STONE

// cairn: a pile of stones that grows when hit, builds little cairns, and throws back what it catches.
defPassive({ id: 'stacking', name: 'Piled High', owner: 'cairn', text: 'When hit: gains a Stone, up to 6. Each Stone cuts damage taken by 4%.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.stone = Math.min(6, (f.k.stone || 0) + 1); },
  inMul(b, f) { return 1 - 0.04 * (f.k.stone || 0); } });
defPassive({ id: 'waymark', name: 'Points the Way', owner: 'cairn', text: 'In reserve: your out whorl takes 0.92x damage.',
  auraIn() { return 0.92; } });
defMark({ id: 'cairn_grasp', name: 'catching', clock: 'own', volatile: true, value: 0.15,
  beforeTake(b, f, src, amt, d) {
    if (d.dot || !src || src.side === f.side) return amt;
    unmark(f, 'cairn_grasp');
    f.k.stone = Math.min(6, (f.k.stone || 0) + 2);
    msg(b, `${label(b, f)} catches it and throws some back.`);
    if (!src.ko) reflect(b, f, src, amt * 0.4);
    return 0;
  } });
defMove({ id: 'topple', name: 'Top Stone', type: 'STONE', owner: 'cairn', reach: 'single', cd: 1,
  text: 'Hits for 130% ATK + 6% of its max HP. At 3 Stones: spends 3, Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 1.3, selfHp: 0.06 }); if ((c.u.k.stone || 0) >= 3 && !c.tgt.ko) { c.u.k.stone -= 3; c.st(c.tgt, 'stun', 1); } } });
defSummon({ id: 'cairn_barrier', name: 'Little Cairn', owner: 'cairn', text: 'Takes every single-target hit meant for your out whorl. When knocked down: Kivishi gains 2 Stones.', every: 100, guard: true,
  sprite: { px: ['........', '........', '...33...', '..2222..', '..4444..', '.222222.', '.444444.', '22222222'], c: ['#9d9da5', '#ddbe9e', '#5e5c64'] },
  act() { /* it only stands */ },
  fall(b, s, owner) { if (owner && !owner.ko) owner.k.stone = Math.min(6, (owner.k.stone || 0) + 2); } });
defMove({ id: 'laystone', name: 'Little Cairn', type: 'STONE', owner: 'cairn', reach: 'side', cd: 4,
  text: 'Summons a Little Cairn (18% of its max HP, 3 turns).',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'cairn_barrier')) dismiss(c.b, s); summon(c.b, c.u, 'cairn_barrier', { hp: 0.18, turns: 3 }); } });
defMove({ id: 'shoulder', name: 'Catch a Stone', type: 'STONE', owner: 'cairn', reach: 'self', cd: 4, wt: 60,
  text: 'Blocks the next hit before its next turn. Then it gains 2 Stones and returns 40% of the hit.',
  run(c) { c.mark(c.u, 'cairn_grasp', 1, 1); } });
defMove({ id: 'landslide', name: 'Tumbledown', type: 'STONE', owner: 'cairn', reach: 'spread', cd: 5, nerve: 4, wu: 90,
  text: 'Wind-up. Hits every foe for 112% ATK + 22% ATK per Stone. Spends all its Stones.',
  run(c) { const s = c.u.k.stone || 0; c.spread({ atk: 1.12 + 0.22 * s }); c.u.k.stone = 0; } });

// scree: a shingle bank that sprays pebbles, buries cobbles, and banks up so nobody leaves.
function screeBurst(b: Battle, f: Fighter | null, who: Fighter): void {
  if (!f || who.ko || who.gone) return;
  msg(b, `A cobble goes off under ${label(b, who)}.`);
  dealDamage(b, f, who, stat(b, f, 'atk') * 0.6, plain('P'), 'STONE');
  if (!who.ko) applyStatus(b, f, who, 'slow', 1);
}
defSummon({ id: 'scree_boulder', name: 'Buried Cobble', owner: 'scree', text: 'Waits for a foe to come out, then hits it for 60% ATK. Slow 1. Then it is gone.',
  sprite: { px: ['........', '........', '........', '........', '..2222..', '.223322.', '44444444', '22222222'], c: ['#8c857d', '#cad2da', '#b9a989'] },
  trap(b, s, who) { screeBurst(b, ownerOf(b, s), who); return true; } });
defMark({ id: 'scree_walled', name: 'banked in', clock: 'own', volatile: true, value: -0.06,
  forbid(b, f, what) { return what === 'switch' ? 'Walled in.' : null; } });
defPassive({ id: 'loose', name: 'Shingle Slide', owner: 'scree', text: 'When nothing hit it since its last turn: its next turn comes 15% sooner.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.screeHit = 1; },
  turnEnd(b, f) { if (!f.k.screeHit) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 15); } f.k.screeHit = 0; } });
defPassive({ id: 'shedstone', name: 'Sets Them Off', owner: 'scree', text: 'Slip Shove also sets off one of its Cobbles on the foe it hits.' });
defMove({ id: 'pelt', name: 'Shingle Spray', type: 'STONE', owner: 'scree', reach: 'single', cd: 1,
  text: 'Hits 4 times for 28% ATK.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.28 }); } });
defMove({ id: 'rockfall', name: 'Slip Shove', type: 'STONE', owner: 'scree', reach: 'single', tags: ['projectile'], cd: 3, wu: 60,
  text: 'Wind-up. Hits for 128% ATK. Forces the foe out. If it can\'t switch: Stun 1.',
  run(c) {
    const t = c.tgt;
    c.hit(t, { atk: 1.28 });
    if (t.ko || c.blocked(t)) return;
    const rock = has(c.u, 'shedstone') ? summonsOf(c.b, c.u.side, 'scree_boulder')[0] : undefined;
    if (rock) { dismiss(c.b, rock); screeBurst(c.b, c.u, t); }
    if (!t.ko && !c.forceOut()) c.st(t, 'stun', 1);
  } });
defMove({ id: 'skid', name: 'Bury Cobbles', type: 'STONE', owner: 'scree', reach: 'side', cd: 3,
  text: 'Hits for 54% ATK. Summons 2 Cobbles (6% of its max HP each).',
  run(c) { c.hit(c.tgt, { atk: 0.54 }); summon(c.b, c.u, 'scree_boulder', { hp: 0.06 }); summon(c.b, c.u, 'scree_boulder', { hp: 0.06 }); } });
defMove({ id: 'avalanche', name: 'Shingle Bank', type: 'STONE', owner: 'scree', reach: 'single', cd: 6, nerve: 4,
  text: 'Hits for 128% ATK. Neither out whorl can switch for 3 turns. Haste 3.',
  run(c) { c.hit(c.tgt, { atk: 1.28 }); c.mark(c.tgt, 'scree_walled', 1, 3); c.mark(c.u, 'scree_walled', 1, 3); c.st(c.u, 'haste', 3); } });

// plinth: a barnacled plinth that cuts with its crust, rinses friends from the pool on its top, and holds an ally up.
defMark({ id: 'plinth_grave', name: 'on the plinth', clock: 'own', value: 0.2,
  beforeTake(b, f, src, amt) {
    if (amt < f.hp + f.shield) return amt;
    f.k.graveSaved = 1;
    return Math.max(0, f.hp + f.shield - 1);
  },
  expire(b, f, mk) {
    if (!f.k.graveSaved) return;
    f.k.graveSaved = 0;
    const by = markedBy(b, mk);
    if (by && has(by, 'unmoved')) heal(b, by, f, f.maxHp * 0.2);
  } });
defPassive({ id: 'pedestal', name: 'Swivel Base', owner: 'plinth', text: 'When it uses a move: its other cooldowns drop by 1, except its crest.',
  afterMove(b, f, m) { f.moves.forEach((id, i) => { const mv = MOVES[id]; if (id !== m.id && mv && !mv.nerve) f.cd[i] = Math.max(0, f.cd[i] - 1); }); } });
defPassive({ id: 'unmoved', name: 'Stepped Down', owner: 'plinth', text: 'When Keep the Top ends on an ally it saved: the ally heals 20% of its max HP.' });
defMove({ id: 'raise', name: 'Barnacle Cut', type: 'STONE', owner: 'plinth', reach: 'single', tags: ['spell'], cd: 1,
  text: 'Hits for 130% MGK. Slow 2. If the foe was already Slowed: Poison 3.',
  run(c) { const slowed = !!c.tgt.s.slow; c.hit(c.tgt, { mgk: 1.3 }); if (slowed) c.st(c.tgt, 'poison', 3); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'lower', name: 'Top Pool', type: 'STONE', owner: 'plinth', reach: 'ally', tags: ['spell'], cd: 2,
  text: 'Heals an ally 45% CHA + 6% max HP. Hits for 72% MGK + 50% of the heal.',
  run(c) { const h = c.heal(c.ally!, c.cha(0.45) + c.ally!.maxHp * 0.06); c.hit(c.tgt, { mgk: 0.72, flat: h * 0.5 }); } });
defMove({ id: 'unveil', name: 'Weather Down', type: 'STONE', owner: 'plinth', reach: 'single', cd: 3,
  text: 'Expose 2. Fortify 2 on itself.',
  run(c) { c.st(c.tgt, 'expose', 2); c.st(c.u, 'fortify', 2); } });
defMove({ id: 'monument', name: 'Keep the Top', type: 'STONE', owner: 'plinth', reach: 'ally', cd: 6, nerve: 4,
  text: 'An ally cannot fall below 1 HP for 2 turns. Removes 1 bad status.',
  run(c) { c.mark(c.ally!, 'plinth_grave', 1, 2); c.cleanse(c.ally!, 1); } });

// grotto: a sea cave that wets the foe three times, then takes it in on the tide, or shelters a friend.
defMark({ id: 'grotto_taste', name: 'damp', max: 3, negative: true, volatile: true, value: -0.07 });
defPassive({ id: 'drip', name: 'Wet Walls', owner: 'grotto', text: 'When it hits a foe: 1 Damp, up to 3. Damp clears when the foe leaves.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !d.dot && !t.ko && t.side !== f.side) mark(b, f, t, 'grotto_taste', 1, -1); } });
defPassive({ id: 'deep', name: 'Seep', owner: 'grotto', text: 'When hit: stores 30% of the damage as Seep, up to 30% of its max HP.',
  afterTake(b, f, src, dealt) { f.k.gray = Math.min(f.maxHp * 0.3, (f.k.gray || 0) + dealt * 0.3); } });
defMove({ id: 'cavein', name: 'Stalactite', type: 'STONE', owner: 'grotto', reach: 'single', cd: 1,
  text: 'Hits for 117% ATK. Slow 1. At 3 Damp: spends them, Stun 1 instead.',
  run(c) {
    const full = c.marked(c.tgt, 'grotto_taste') >= 3;
    c.hit(c.tgt, { atk: 1.17 });
    if (c.tgt.ko) return;
    if (full) { unmark(c.tgt, 'grotto_taste'); c.st(c.tgt, 'stun', 1); } else c.st(c.tgt, 'slow', 1);
  } });
defMove({ id: 'takein', name: 'Inrush', type: 'STONE', owner: 'grotto', reach: 'spread', cd: 3, wu: 60,
  text: 'Wind-up. Hits every foe for 122% ATK. 2 Damp. Each reserve: 1 Damp.',
  run(c) { c.spread({ atk: 1.22 }); if (!c.tgt.ko) c.mark(c.tgt, 'grotto_taste', 2, -1); for (const r of reserves(c.them)) c.mark(r, 'grotto_taste', 1, -1); } });
defMove({ id: 'hush', name: 'Seep Shell', type: 'STONE', owner: 'grotto', reach: 'self', cd: 3, wt: 60,
  text: 'Shield of all its Seep + 5% of its max HP, 2 turns. Spends the Seep.',
  run(c) { const g = c.u.k.gray || 0; c.u.k.gray = 0; c.shield(c.u, g + c.u.maxHp * 0.05, 2); } });
defMove({ id: 'swallow', name: 'Take In', type: 'STONE', owner: 'grotto', reach: 'single', cd: 6, nerve: 4,
  text: 'Hits for 106% ATK + 8% foe max HP. At 3 Damp: the foe leaves the field for 2 turns.',
  run(c) { const full = c.marked(c.tgt, 'grotto_taste') >= 3; c.hit(c.tgt, { atk: 1.06, tgtHp: 0.08 }); if (full && !c.tgt.ko && !c.blocked(c.tgt)) { unmark(c.tgt, 'grotto_taste'); c.msg(`The tide takes ${label(c.b, c.tgt)} into ${label(c.b, c.u)}.`); banish(c.b, c.tgt, 2, c.u); } } });

// menhir: a standing stone that leans every third turn, draws the eye, and falls on the foe.
defPassive({ id: 'standing', name: 'Old Stance', owner: 'menhir', text: 'Every 3rd turn: its attack adds 50% DEF and hits reserves. Taunts last +1 turn.',
  turnStart(b, f) { f.k.galioT = (f.k.galioT || 0) + 1; },
  addRaw(b, f, t, d) { return d.attack && f.k.galioT % 3 === 0 ? stat(b, f, 'def') * 0.5 : 0; },
  afterAttack(b, f) {
    if (f.k.galioT % 3 !== 0 || f.k.galioDone === f.k.galioT) return;
    f.k.galioDone = f.k.galioT;
    const raw = (stat(b, f, 'atk') + stat(b, f, 'def') * 0.5) * SPREAD_SHARE;
    for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, raw, { ...plain('P'), spread: true, reserve: true }, null);
  } });
defPassive({ id: 'oldmass', name: 'Heavy Base', owner: 'menhir', text: 'Its moves add 20% DEF to their damage. Takes 0.85x magic damage.',
  addRaw(b, f, t, d) { return d.attack ? 0 : stat(b, f, 'def') * 0.2; },
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.85 : 1; } });
defMove({ id: 'lean', name: 'Wind Shadow', type: 'STONE', owner: 'menhir', reach: 'spread', tags: ['spell'], cd: 1,
  text: 'Hits every foe for 24% MGK + 32% DEF.',
  run(c) { c.spread({ mgk: 0.24, def: 0.32 }, { kind: 'M' }); } });
defMove({ id: 'ringofstones', name: 'Stand Fast', type: 'STONE', owner: 'menhir', reach: 'self', cd: 3, wt: 60,
  text: 'Taunt 1. Fortify 2 on itself.',
  run(c) { c.st(c.u, 'fortify', 2); c.st(c.tgt, 'taunt', 1); } });
defMove({ id: 'summons', name: 'Shoulder In', type: 'STONE', owner: 'menhir', reach: 'single', cd: 4,
  text: 'Hits for 43% ATK + 45% DEF. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 0.43, def: 0.45 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'fallforward', name: 'Keel Over', type: 'STONE', owner: 'menhir', reach: 'spread', cd: 6, nerve: 4, wu: 80, unstop: true,
  text: 'Unstoppable wind-up. Hits every foe for 84% ATK. Stun 1. Fortify 2.',
  run(c) { c.spread({ atk: 0.84 }); c.st(c.tgt, 'stun', 1); c.st(c.u, 'fortify', 2); } });

// quarry: a bored pit that takes stone from every foe it hits, blasts, and floods to hide.
defPassive({ id: 'dugout', name: 'Bored Through', owner: 'quarry', text: 'When it hits a foe: takes 4 DEF from it, gains 4 DEF and 3 RES. Up to 10 times.',
  afterDeal(b, f, t, dealt, d) {
    if (d.reserve || d.dot || t.side === f.side || (f.k.shifts || 0) >= 10) return;
    f.k.shifts = (f.k.shifts || 0) + 1;
    t.k.defLoss = Math.min(40, (t.k.defLoss || 0) + 4);
    f.k.defGain = (f.k.defGain || 0) + 4;
  },
  statBonus(f, k) { return k === 'res' ? 3 * (f.k.shifts || 0) : 0; } });
defPassive({ id: 'spoilheap', name: 'Rainwater', owner: 'quarry', text: 'Turn start: if nothing hit it since its last turn, heals 4% of its max HP.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.quarryHit = 1; },
  turnStart(b, f) { if (!f.k.quarryHit) heal(b, f, f, f.maxHp * 0.04); f.k.quarryHit = 0; } });
defMove({ id: 'cut', name: 'Chisel', type: 'STONE', owner: 'quarry', reach: 'single', cd: 1, text: 'Hits for 100% ATK. Deals 1.3x damage if the foe has less DEF than it.',
  run(c) { const m = stat(c.b, c.tgt, 'def') < stat(c.b, c.u, 'def') ? 1.3 : 1; c.hit(c.tgt, { atk: 1 }, { mult: m }); } });
defMove({ id: 'blast', name: 'Blasting', type: 'STONE', owner: 'quarry', reach: 'spread', cd: 3, wu: 50,
  text: 'Wind-up. Hits every foe for 83% ATK. Removes its own bad statuses.',
  run(c) { c.cleanse(c.u); c.spread({ atk: 0.83 }); } });
defMove({ id: 'undermine', name: 'Undermine', type: 'STONE', owner: 'quarry', reach: 'single', tags: ['dash'], cd: 3,
  text: 'Hits for 87% ATK. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 0.87 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'excavate', name: 'Flooded Pit', type: 'STONE', owner: 'quarry', reach: 'self', cd: 6, nerve: 4, wt: 70,
  text: 'Untouchable 1. Regen 3 (9% of max HP each turn). Empower 2.',
  run(c) { c.st(c.u, 'invuln', 1); c.st(c.u, 'regen', 3, 0.09); c.st(c.u, 'empower', 2); } });

// grotesque: a gargoyle that drops from the gutter, preys on the alone, and grows coral horns with every KO.
defPassive({ id: 'gutter', name: 'First Drop', owner: 'grotesque', text: 'When it comes out: its first move deals 1.4x damage and adds Slow 1.',
  outMul(b, f, t, d) { return f.k.fresh && d.move ? 1.4 : 1; },
  afterDeal(b, f, t, dealt, d) { if (f.k.fresh && d.move && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'spout', name: 'Coral Horns', owner: 'grotesque', text: 'When it KOs a foe: 1 tide and a Horn, up to 3. Each Horn: moves deal +8%.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side) return;
    addNerve(b, f.side, 1);
    if ((f.k.evo || 0) < 3) { f.k.evo = (f.k.evo || 0) + 1; msg(b, `${label(b, f)} grows a horn of coral.`); }
  },
  outMul(b, f, t, d) { return d.move ? 1 + 0.08 * (f.k.evo || 0) : 1; } });
defMove({ id: 'drop', name: 'Gutter Drop', type: 'STONE', owner: 'grotesque', reach: 'single', cd: 1,
  text: 'Hits for 81% ATK. Deals 1.4x if the foe has 1 reserve or none.',
  run(c) { const lone = reserves(c.them).length <= 1; c.hit(c.tgt, { atk: 0.81 }, { mult: lone ? 1.4 : 1 }); } });
defMove({ id: 'gargle', name: 'Rain Spout', type: 'STONE', owner: 'grotesque', reach: 'spread', cd: 2,
  text: 'Hits every foe for 53% ATK. Heals 30% of the damage to the foe.',
  run(c) { const d = c.spread({ atk: 0.53 }); c.heal(c.u, d * 0.3); } });
defMove({ id: 'perch', name: 'Off the Roof', type: 'STONE', owner: 'grotesque', reach: 'single', cd: 3,
  text: 'Hits for 84% ATK. If it KOs the foe: its cooldown resets.',
  run(c) { c.hit(c.tgt, { atk: 0.84 }); if (c.tgt.ko) { const i = c.u.moves.indexOf('perch'); if (i >= 0) c.u.cd[i] = 0; } } });
defMove({ id: 'leer', name: 'Stone Still', type: 'STONE', owner: 'grotesque', reach: 'self', cd: 6, nerve: 4, wt: 70,
  text: 'Untouchable 1. Its next move deals 1.3x, and First Drop works again.',
  run(c) { c.st(c.u, 'invuln', 1); c.u.k.nextMoveMul = 1.3; c.u.k.fresh = 1; } });

// tor: a walking hilltop whose every move shrugs the ground, and whose stamp rings for everyone standing.
defPassive({ id: 'aftershock', name: 'Hill Shrug', owner: 'tor', text: 'When it uses a move: hits the foe for 30% ATK. Delays its next turn by 10%.',
  afterMove(b, f) { const t = foeOf(b, f); if (!t.ko && !t.gone) { dealDamage(b, f, t, stat(b, f, 'atk') * 0.3, plain('P'), null); delayFighter(b, t, 10); } } });
defPassive({ id: 'bedrock', name: 'Deep Footing', owner: 'tor', text: 'When it Stuns a foe: 1 tide.' });
defMove({ id: 'fissure', name: 'Craze Line', type: 'STONE', owner: 'tor', reach: 'spread', cd: 1,
  text: 'Hits every foe for 63% ATK. Root 1.',
  run(c) { c.spread({ atk: 0.63 }); c.st(c.tgt, 'root', 1); } });
defMove({ id: 'stamp', name: 'Heel Down', type: 'STONE', owner: 'tor', reach: 'self', cd: 2, wt: 70, text: 'Its next attack deals 2x damage and adds Slow 2.',
  run(c) { c.u.k.nextAtkMul = 2; c.u.k.nextAtkSlow = 2; } });
defMove({ id: 'heave', name: 'Roll Downhill', type: 'STONE', owner: 'tor', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 71% ATK. Interrupts. Delays the foe\'s next turn by 40%.',
  run(c) { c.hit(c.tgt, { atk: 0.71 }); c.interrupt(c.tgt); c.delay(c.tgt, 40); } });
defMove({ id: 'quake', name: 'Ground Rings', type: 'STONE', owner: 'tor', reach: 'spread', cd: 6, nerve: 6, wu: 90,
  text: 'Wind-up. Hits every foe for 107% ATK +10% per whorl standing. Stun 1.',
  run(c) { const n = standing(c.them).length + standing(c.me).length; c.spread({ atk: 1.07 + 0.1 * n }); c.st(c.tgt, 'stun', 1); } });

// ================================================================ TIDE

// welling: a walking well that pays out its own water to heal, puts its cover on a foe, and springs up for everyone.
defPassive({ id: 'deepwater', name: 'Deep Draw', owner: 'welling', text: 'Its heals are 1.3x on allies below 40% HP.',
  healMul(b, f, t) { return t.hp < t.maxHp * 0.4 ? 1.3 : 1; } });
defPassive({ id: 'drawnup', name: 'Full Bucket', owner: 'welling', text: 'When Bucket Drop deals damage: Regen 2 (4% of max HP each turn).' });
defMove({ id: 'bucket', name: 'Bucket Drop', type: 'TIDE', owner: 'welling', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 138% MGK. Slow 1. Heals itself 4% of its max HP.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.38 }); c.st(c.tgt, 'slow', 1); c.heal(c.u, c.u.maxHp * 0.04); if (d > 0 && has(c.u, 'drawnup')) c.st(c.u, 'regen', 2, 0.04); } });
defMove({ id: 'splash', name: 'Haul Water', type: 'TIDE', owner: 'welling', reach: 'ally', cd: 2, text: 'Heals an ally 60% CHA + 8% of its max HP. Costs Kaivodo 5% max HP.',
  run(c) { const a = c.ally!; c.heal(a, c.cha(0.6) + a.maxHp * 0.08); payHp(c.b, c.u, c.u.maxHp * 0.05); } });
defMove({ id: 'brim', name: 'Well Cover', type: 'TIDE', owner: 'welling', reach: 'single', cd: 4, text: 'Silence 1. Root 2.',
  run(c) { c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'spring', name: 'Spring Rising', type: 'TIDE', owner: 'welling', reach: 'team', cd: 6, nerve: 5, text: 'Your team heals 20% of max HP, 30% for any below 40% HP.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * (a.hp < a.maxHp * 0.4 ? 0.3 : 0.2)); } });

// undertow: a rip current that roots the first time it lands, drags the foe back, and pulls the whole line.
defMark({ id: 'undertow_wrath', name: 'pulling under', clock: 'own', volatile: true, value: 0.08,
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'drag', name: 'First Pull', owner: 'undertow', text: 'The first time it hits each foe: Root 1.',
  afterDeal(b, f, t, dealt, d) {
    if (d.reserve || d.dot || t.ko || t.side === f.side) return;
    const key = `naut${f.side}${f.idx}`;
    if (t.k[key]) return;
    t.k[key] = 1;
    applyStatus(b, f, t, 'root', 1);
  } });
defPassive({ id: 'riptide', name: 'Cold Water', owner: 'undertow', text: 'Deals 1.3x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return cameOutSince(b, t, f) ? 1.3 : 1; } });
defMove({ id: 'pullunder', name: 'Ankle Drag', type: 'TIDE', owner: 'undertow', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 85% MGK. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); if (!c.tgt.ko) c.delay(c.tgt, 20); } });
defMove({ id: 'churn', name: 'Sand Churn', type: 'TIDE', owner: 'undertow', reach: 'spread', tags: ['spell'], cd: 2, text: 'Hits every foe for 53% MGK. Slow 1.',
  run(c) { c.spread({ mgk: 0.53 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'sink', name: 'Pull Under', type: 'TIDE', owner: 'undertow', reach: 'self', cd: 3, wt: 70, text: 'For 2 turns: a shield of 18% max HP, and its attacks add Slow 1.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.18, 2); c.mark(c.u, 'undertow_wrath', 1, 2); } });
defMove({ id: 'rip', name: 'Rip Current', type: 'TIDE', owner: 'undertow', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 100% MGK. Stun 1. Reserves take 50% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 1 }); c.st(c.tgt, 'stun', 1); for (const r of reserves(c.them)) c.hit(r, { mgk: 1 }, { reserve: true, mult: 0.5 }); } });

// fogbank: a sea fog that blinds, banks round a friend, rolls back out, and comes out of itself with a blow.
defMark({ id: 'fogbank_shadow', name: 'rolling in', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    unmark(f, 'fogbank_shadow');
    const t = foeOf(b, f);
    if (t.ko || t.gone || f.s.silence) return;
    msg(b, `${label(b, f)} comes out of itself.`);
    dealDamage(b, f, t, stat(b, f, 'mgk') * 1.6, { kind: 'M', move: MOVES.whiteout, attack: false, dot: false, spread: false, reserve: false }, 'TIDE');
    if (!t.ko) applyStatus(b, f, t, 'silence', 1);
  } });
defPassive({ id: 'grey', name: 'Thick Fog', owner: 'fogbank', text: 'Takes 0.8x damage from single-target moves.',
  inMul(b, f, src, d) { return d.move && !d.spread ? 0.8 : 1; } });
defPassive({ id: 'lift', name: 'Burns Off', owner: 'fogbank', text: 'When it is KO\'d: the next ally out gets Ward 1.',
  anyKO(b, f, v) { if (v === f) sk(b, f.side).wardNext = 1; } });
defMove({ id: 'damp', name: 'Sea Fret', type: 'TIDE', owner: 'fogbank', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 67% MGK. Weaken 1.',
  run(c) { c.spread({ mgk: 0.67 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'bank', name: 'Fog Bank', type: 'TIDE', owner: 'fogbank', reach: 'ally', cd: 3, text: 'An ally gets Ward 1.',
  run(c) { c.st(c.ally!, 'ward', 1); } });
defMove({ id: 'muffle', name: 'Roll Back', type: 'TIDE', owner: 'fogbank', reach: 'reserveAlly', cd: 3, wt: 50, tag: true,
  text: 'Switches to an ally. Its first turn comes 40% sooner.',
  run(c) { c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 40; } });
defMove({ id: 'whiteout', name: 'Haar', type: 'TIDE', owner: 'fogbank', reach: 'self', cd: 6, nerve: 5,
  text: 'Untouchable 1. At its next turn: hits for 160% MGK. Silence 1.',
  run(c) { c.st(c.u, 'invuln', 1); c.mark(c.u, 'fogbank_shadow', 1, 2); } });

// floe: sea ice that chills with everything, cracks the chilled, and sleets for three turns.
defMark({ id: 'floe_storm', name: 'sleeting', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.5, 'M', 'TIDE'); const t = foeOf(b, f); if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'chill', name: 'Rime', owner: 'floe', text: 'Its damaging moves add Slow 1.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'refreeze', name: 'Freezes Back', owner: 'floe', text: 'Once per battle, instead of a KO: Stasis 1, back at 15% HP. Slow 2 on the foe.',
  wouldKO(b, f) {
    if (f.k.refroze) return false;
    f.k.refroze = 1; f.hp = 1; f.s = { stasis: { n: 1, src: -1 } }; f.k.thaw = 1;
    f.k.thawPct = 15;
    msg(b, `${label(b, f)} freezes solid. The water round it goes thick.`);
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 2);
    return true;
  } });
defMove({ id: 'shard', name: 'Ice Splinter', type: 'TIDE', owner: 'floe', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 85% MGK. Interrupts if the foe was already Slowed.',
  run(c) { const slowed = !!c.tgt.s.slow; c.hit(c.tgt, { mgk: 0.85 }); if (slowed && !c.tgt.ko) c.interrupt(c.tgt); } });
defMove({ id: 'packice', name: 'Pressure Ridge', type: 'TIDE', owner: 'floe', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 46% MGK. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.46 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'calve', name: 'Calving', type: 'TIDE', owner: 'floe', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 60% MGK. Deals 2x damage to a Slowed foe.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }, { mult: c.tgt.s.slow ? 2 : 1 }); } });
defMove({ id: 'freezeover', name: 'Sleet Drift', type: 'TIDE', owner: 'floe', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5,
  text: 'Hits every foe for 46% MGK. At its next 3 turns: hits every foe for 50% MGK, Slow 1.',
  run(c) { c.spread({ mgk: 0.46 }); c.mark(c.u, 'floe_storm', 1, 3); } });

// squall: a sideways squall that shoots rain through the line, flattens, runs ahead, and bursts.
defMark({ id: 'squall_windrun', name: 'running ahead', clock: 'own', volatile: true, value: 0.12,
  beforeTake(b, f, src, amt, d) { return d.attack ? 0 : amt; } });
defPassive({ id: 'downpour', name: 'Two Drops', owner: 'squall', text: 'Its attacks hit 2 times at 0.5x damage.' });
defPassive({ id: 'clearing', name: 'Blows Over', owner: 'squall', text: 'When it switches out: the ally coming out gets Haste 1.' });
defMove({ id: 'gust', name: 'Rain Shot', type: 'TIDE', owner: 'squall', reach: 'spread', tags: ['projectile'], cd: 1, text: 'Hits for 55% ATK. Reserves take 50% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 0.55 }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.55 }, { reserve: true, spread: true, mult: 0.5 }); } });
defMove({ id: 'sheets', name: 'Flatten', type: 'TIDE', owner: 'squall', reach: 'single', cd: 3, text: 'Hits for 59% ATK. If the foe has a reserve: Stun 1. If not: Root 2.',
  run(c) { c.hit(c.tgt, { atk: 0.59 }); if (c.tgt.ko) return; if (reserves(c.them).length) c.st(c.tgt, 'stun', 1); else c.st(c.tgt, 'root', 2); } });
defMove({ id: 'bluster', name: 'Run Ahead', type: 'TIDE', owner: 'squall', reach: 'self', cd: 4, wt: 60, text: 'Attacks deal 0 damage to it until its next turn ends. Haste 1.',
  run(c) { c.mark(c.u, 'squall_windrun', 1, 1); c.st(c.u, 'haste', 1); } });
defMove({ id: 'cloudburst', name: 'Cloudburst', type: 'TIDE', owner: 'squall', reach: 'single', cd: 5, nerve: 5, text: 'Hits 6 times for 27% ATK.',
  run(c) { for (let i = 0; i < 6 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.27 }); } });

// bore: a tidal bore that gathers pace every turn, pulls back to heal, and washes the foe out.
defPassive({ id: 'momentum', name: 'Gathering', owner: 'bore', text: 'Gathering: +1 each turn it does not guard, up to 4. A guard clears it. Each Gathering: +8% damage.',
  outMul(b, f) { const m = f.k.momentum || 0; return f.k.boreTide ? 1 + 0.16 * m : 1 + 0.08 * m; } });
defPassive({ id: 'upstream', name: 'Flood Tide', owner: 'bore', text: 'When it comes out: its first turn comes 40% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 40; } });
defMove({ id: 'surge', name: 'Wave Front', type: 'TIDE', owner: 'bore', reach: 'single', cd: 1, text: 'Hits for 70% ATK. +10% damage per use since it came out, up to +30%.',
  run(c) {
    if (c.u.k.surgeAt !== c.u.outAt) { c.u.k.surgeAt = c.u.outAt; c.u.k.surges = 0; }
    c.hit(c.tgt, { atk: 0.7 }, { mult: 1 + 0.1 * Math.min(3, c.u.k.surges || 0) });
    c.u.k.surges = (c.u.k.surges || 0) + 1;
  } });
defMove({ id: 'crest', name: 'Draw Back', type: 'TIDE', owner: 'bore', reach: 'spread', cd: 2, text: 'Hits every foe for 45% ATK. Heals 25% of the damage to the foe.',
  run(c) { const d = c.spread({ atk: 0.45 }); c.heal(c.u, d * 0.25); } });
defMove({ id: 'runup', name: 'Overtop', type: 'TIDE', owner: 'bore', reach: 'single', cd: 3, text: 'Hits for 49% ATK + 10% ATK per Gathering. Forces the foe out.',
  run(c) { c.hit(c.tgt, { atk: 0.49 + 0.1 * (c.u.k.momentum || 0) }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'boretide', name: 'Spring Bore', type: 'TIDE', owner: 'bore', reach: 'spread', cd: 6, nerve: 5,
  text: 'Hits every foe for 93% ATK. The foe must switch at its next turn.',
  run(c) { c.spread({ atk: 0.93 }); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'switch'); } });

// brine: a salt crust that spits brine, salts every wound, and dries the weak out from far off.
defMark({ id: 'brine_barrage', name: 'salting', clock: 'own', volatile: true, value: 0.1,
  addRaw(b, f, t, d) { return d.attack ? t.maxHp * 0.05 : 0; } });
defPassive({ id: 'salt', name: 'Salt Wound', owner: 'brine', text: 'Foes it damages get Rot 2.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'rot', 2); } });
defPassive({ id: 'cure', name: 'Salt Burst', owner: 'brine', text: 'When it is KO\'d: the foe takes 15% of its max HP as true damage. Rot 3.',
  anyKO(b, f, v) {
    if (v !== f) return;
    const t = foeOf(b, f);
    if (t.ko || t.gone) return;
    msg(b, `${label(b, f)} bursts into salt.`);
    dealDamage(b, f, t, t.maxHp * 0.15, dot('T'), null);
    if (!t.ko) applyStatus(b, f, t, 'rot', 3);
  } });
defMove({ id: 'sting', name: 'Brine Spit', type: 'TIDE', owner: 'brine', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 110% MGK. Expose 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'crust', name: 'Salt Rime', type: 'TIDE', owner: 'brine', reach: 'self', cd: 3, wt: 60, text: 'For 3 turns its attacks add 5% of the foe\'s max HP.',
  run(c) { c.mark(c.u, 'brine_barrage', 1, 3); } });
defMove({ id: 'pickle', name: 'Brine Flood', type: 'TIDE', owner: 'brine', reach: 'spread', tags: ['spell'], cd: 2, text: 'Hits every foe for 70% MGK. Slow 2.',
  run(c) { c.spread({ mgk: 0.7 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'evaporate', name: 'Dry Up', type: 'TIDE', owner: 'brine', reach: 'single', tags: ['projectile', 'spell'], cd: 5, nerve: 3, text: 'Hits for 120% MGK. Deals 2x damage to a foe below 40% HP.',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }, { mult: c.tgt.hp < c.tgt.maxHp * 0.4 ? 2 : 1 }); } });

// eddy: a whirlpool that turns heads, spins a bolt of water, hands round to a friend, and swaps foes.
defMark({ id: 'eddy_grudge', name: '', value: 0.06,
  comeOut(b, f) {
    applyStatus(b, f, f, 'empower', 2);
    for (const a of b.s[f.side].f) unmark(a, 'eddy_grudge');
  } });
defPassive({ id: 'turnabout', name: 'Spun Round', owner: 'eddy', text: 'When it forces a foe out or drags one in: a shield of 12% of its max HP.' });
defPassive({ id: 'spin', name: 'Slack Water', owner: 'eddy', text: 'In reserve: your out whorl deals 1.05x. When KO\'d: next ally out gets Empower 2.',
  auraOut() { return 1.05; },
  anyKO(b, f, v) { if (v === f) for (const a of standing(b.s[f.side])) mark(b, f, a, 'eddy_grudge', 1, -1); } });
defMove({ id: 'whirl', name: 'Dizzy Wave', type: 'TIDE', owner: 'eddy', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 56% MGK. Expose 1.',
  run(c) { c.spread({ mgk: 0.56 }); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'turn', name: 'Spin Bolt', type: 'TIDE', owner: 'eddy', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 93% MGK. Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.93 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'exchange', name: 'Hand Round', type: 'TIDE', owner: 'eddy', reach: 'reserveAlly', cd: 4, tag: true,
  text: 'Switches to an ally: Empower 1, and its first turn comes 40% sooner.',
  run(c) { c.st(c.ally!, 'empower', 1); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 40; } });
defMove({ id: 'maelstrom', name: 'Whirlpool', type: 'TIDE', owner: 'eddy', reach: 'dragin', tags: ['spell'], cd: 6, nerve: 4, tag: true,
  text: 'Drags in a reserve. Hits it for 84% MGK. Stun 1. Then switches out.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 0.84 }); c.st(t, 'stun', 1); } });

// ================================================================ ROOT

// thicket: a buckthorn hedge that rolls in, bristles, catches the eye, and lands in a heap.
defMark({ id: 'thicket_slam', name: 'settling', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { unmark(f, 'thicket_slam'); msg(b, 'The hedge settles again.'); splash(b, f, stat(b, f, 'atk') * 0.55, 'P', 'ROOT'); } });
defPassive({ id: 'thorned', name: 'Buckthorn', owner: 'thicket', text: 'When hit: returns 15% of the damage. Its moves add 25% DEF to their damage.',
  afterTake(b, f, src, dealt) { if (src && src !== f && !src.ko) dealDamage(b, f, src, dealt * 0.15, { ...dot('M'), reflect: true } as DmgInfo, null); },
  addRaw(b, f, t, d) { return d.move ? stat(b, f, 'def') * 0.25 : 0; } });
defPassive({ id: 'hedge', name: 'Hedged In', owner: 'thicket', text: 'Deals 1.25x damage to a Taunted foe.',
  outMul(b, f, t) { return t.s.taunt ? 1.25 : 1; } });
defMove({ id: 'snag', name: 'Roll Across', type: 'ROOT', owner: 'thicket', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 104% ATK + 25% DEF. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.04, def: 0.25 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'bristle', name: 'Bristle Up', type: 'ROOT', owner: 'thicket', reach: 'self', cd: 3, text: 'Thorns 2 (returns 40% of damage taken). Fortify 2.',
  run(c) { c.st(c.u, 'thorns', 2, 0.4); c.st(c.u, 'fortify', 2); } });
defMove({ id: 'tangle', name: 'Catch a Sleeve', type: 'ROOT', owner: 'thicket', reach: 'single', cd: 3, text: 'Taunt 2.',
  run(c) { c.st(c.tgt, 'taunt', 2); } });
defMove({ id: 'overgrow', name: 'Hedge Fall', type: 'ROOT', owner: 'thicket', reach: 'spread', tags: ['dash'], cd: 6, nerve: 5,
  text: 'Hits every foe for 133% ATK. Slow 2. At its next turn: hits every foe for 55% ATK.',
  run(c) { c.spread({ atk: 1.33 }); c.st(c.tgt, 'slow', 2); c.mark(c.u, 'thicket_slam', 1, 2); } });

// mycel: a walking mat of threads that poisons on touch, pushes up stinkhorns, and passes its poison on.
defSummon({ id: 'mycel_ward', name: 'Stinkhorn', owner: 'mycel', text: 'Each turn: hits the foe for 30% of Sienoko\'s MGK. Poison 1. Acts with Sienoko in reserve.', every: 100,
  sprite: { px: ['...33...', '...33...', '...22...', '..2222..', '...22...', '...22...', '..2222..', '.444444.'], c: ['#efebdf', '#54443a', '#b9b199'] },
  act(b, s, owner) {
    const t = b.s[1 - s.side].f[b.s[1 - s.side].out];
    if (!owner || !t || t.ko || t.gone) return;
    dealDamage(b, owner, t, stat(b, owner, 'mgk') * 0.3, plain('M'), 'ROOT');
    if (!t.ko) applyStatus(b, owner, t, 'poison', 1);
  } });
defPassive({ id: 'network', name: 'Underground', owner: 'mycel', text: 'When a Poisoned foe is KO\'d: its Poison passes to the next foe out.',
  anyKO(b, f, v) { if (v.side !== f.side && v.k.diedPoison) sk(b, v.side).poisonNext = v.k.diedPoison; } });
defPassive({ id: 'fruiting', name: 'Fruit Body', owner: 'mycel', text: 'Its attacks add Poison 1.',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'poison', 1); } });
defMove({ id: 'spore', name: 'Spore Gust', type: 'ROOT', owner: 'mycel', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 110% MGK. Poison 2. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); c.st(c.tgt, 'poison', 2); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'flush', name: 'Push Up', type: 'ROOT', owner: 'mycel', reach: 'side', cd: 3, wt: 70,
  text: 'Summons a Stinkhorn (10% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'mycel_ward', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'decompose', name: 'Rot Down', type: 'ROOT', owner: 'mycel', reach: 'single', cd: 3, text: 'Deals all of the foe\'s remaining Poison damage at once.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    const n = c.tgt.s.poison?.n || 0;
    if (!n) { c.msg('Nothing to rot.'); return; }
    delete c.tgt.s.poison;
    c.hit(c.tgt, { tgtHp: 0.03 * n * (n + 1) / 2 }, { kind: 'T' });
  } });
defMove({ id: 'mycorrhiza', name: 'Through Roots', type: 'ROOT', owner: 'mycel', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5,
  text: 'Hits for 80% MGK. Poison 4. Rot 2. Each reserve gets Poison 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); c.st(c.tgt, 'poison', 4); c.st(c.tgt, 'rot', 2); for (const r of reserves(c.them)) c.st(r, 'poison', 2); } });

// burr: a burr that hooks on, scratches open, hitches a ride, and drags a foe out.
defMark({ id: 'burr_sap', name: 'hooked', max: 5, negative: true, clock: 'own', value: -0.05 });
defMark({ id: 'burr_fly', name: 'along for the ride', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { const t = foeOf(b, f); if (t.ko || t.gone) return; applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.25); mark(b, f, t, 'burr_sap', 1, 4); } });
defPassive({ id: 'stuckon', name: 'Hooked On', owner: 'burr', text: 'Hook: a mark, up to 5, for 4 turns. Its hits deal +6% damage per Hook.',
  outMul(b, f, t) { return 1 + 0.06 * marked(t, 'burr_sap'); } });
defPassive({ id: 'seedfall', name: 'Blows Loose', owner: 'burr', text: 'Takes 0.8x damage from attacks while it has Haste.',
  inMul(b, f, src, d) { return d.attack && f.s.haste ? 0.8 : 1; } });
defMove({ id: 'catch', name: 'Hook On', type: 'ROOT', owner: 'burr', reach: 'single', cd: 1, text: 'Hits for 59% ATK. 2 Hooks.',
  run(c) { c.hit(c.tgt, { atk: 0.59 }); if (!c.tgt.ko) c.mark(c.tgt, 'burr_sap', 2, 4); } });
defMove({ id: 'prickle', name: 'Seed Burst', type: 'ROOT', owner: 'burr', reach: 'spread', cd: 3, text: 'Hits every foe for 59% ATK. Bleed 2. Delays foe\'s next turn by 20%.',
  run(c) { c.spread({ atk: 0.59 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.17); c.delay(c.tgt, 20); } });
defMove({ id: 'hitch', name: 'Hitch a Ride', type: 'ROOT', owner: 'burr', reach: 'self', cd: 4, wt: 60,
  text: 'Haste 2. At its next 2 turns: Bleed 1 and a Hook on the foe.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.u, 'burr_fly', 1, 2); } });
defMove({ id: 'burstpod', name: 'Drag Along', type: 'ROOT', owner: 'burr', reach: 'single', cd: 6, nerve: 4,
  text: 'Drags in their weakest reserve. Hits for 51% ATK. Stun 1. Root 3.',
  run(c) { const r = reserves(c.them).sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0]; if (r) c.dragIn(r.idx); const t = c.them.f[c.them.out]; c.hit(t, { atk: 0.51 }); c.st(t, 'stun', 1); c.st(t, 'root', 3); } });

// orchard: an orchard that drops fruit, spits pips, shelters a friend under its boughs, and blossoms for everyone.
defPassive({ id: 'windfall', name: 'Last Windfall', owner: 'orchard', text: 'When it is KO\'d: the next ally out heals 20% of its max HP.',
  anyKO(b, f, v) { if (v === f) sk(b, f.side).healNext = 1; } });
defPassive({ id: 'overripe', name: 'Too Ripe', owner: 'orchard', text: 'When it overheals: the extra becomes a shield, up to 20% of max HP.',
  afterHeal(b, f, t, amt, over) { if (over > 0) giveShield(b, f, t, Math.min(over, t.maxHp * 0.2), 3); } });
defMove({ id: 'pick', name: 'Ripe Fruit', type: 'ROOT', owner: 'orchard', reach: 'ally', cd: 1, text: 'Heals an ally 55% CHA + 5% of its max HP.',
  run(c) { c.heal(c.ally!, c.cha(0.55) + c.ally!.maxHp * 0.05); } });
defMove({ id: 'graft', name: 'Hard Pips', type: 'ROOT', owner: 'orchard', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits 3 times for 52% MGK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.52 }); } });
defMove({ id: 'dropfruit', name: 'Under Boughs', type: 'ROOT', owner: 'orchard', reach: 'reserveAlly', cd: 4, tag: true,
  text: 'Switches to an ally. It gets Ward 1 and heals 10% of its max HP.',
  run(c) { c.st(c.ally!, 'ward', 1); c.heal(c.ally!, c.ally!.maxHp * 0.1); } });
defMove({ id: 'harvest', name: 'Full Bloom', type: 'ROOT', owner: 'orchard', reach: 'team', cd: 7, nerve: 5,
  text: 'Your team heals 20% of max HP and gets Regen 2 (5% of max HP each turn).',
  run(c) { for (const a of standing(c.me)) { c.heal(a, a.maxHp * 0.2); c.st(a, 'regen', 2, 0.05); } } });

// stump: a stump that grows rings, splinters, stores its sap, and comes back bigger.
defMark({ id: 'stump_zap', name: 'sap rising', clock: 'own', volatile: true, value: 0.08,
  afterTake(b, f, src, dealt) { f.k.zap = (f.k.zap || 0) + dealt * 0.4; },
  expire(b, f) { if (f.k.zap) heal(b, f, f, f.k.zap); f.k.zap = 0; } });
defPassive({ id: 'rings', name: 'Year Rings', owner: 'stump', text: 'Turn start: grows a Ring, up to 4. Each Ring adds 2% max HP.',
  turnStart(b, f) {
    if ((f.k.rings || 0) >= 4) return;
    f.k.rings = (f.k.rings || 0) + 1;
    const add = Math.round(f.st.hp * 0.02);
    f.maxHp += add;
    heal(b, f, f, add);
  } });
defPassive({ id: 'regrow', name: 'Sucker Shoots', owner: 'stump', text: 'The first Stun, Sleep, or Root each time it comes out is removed. Heals 5% max HP.',
  afterGet(b, f, src, id) {
    if (id !== 'stun' && id !== 'sleep' && id !== 'root') return;
    if (f.k.shrugAt === f.outAt + 1) return;
    f.k.shrugAt = f.outAt + 1;
    delete f.s[id as StatusId];
    heal(b, f, f, f.maxHp * 0.05);
    msg(b, `${label(b, f)} puts out a shoot.`);
  } });
defMove({ id: 'splinter', name: 'Splinter Off', type: 'ROOT', owner: 'stump', reach: 'single', cd: 1, text: 'Hits for 114% ATK + 8% of the foe\'s current HP. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.14, tgtCur: 0.08 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'sap', name: 'Sap Rising', type: 'ROOT', owner: 'stump', reach: 'single', cd: 2, text: 'Hits for 55% ATK. After 2 turns: heals 40% of the damage it took in those turns.',
  run(c) { c.hit(c.tgt, { atk: 0.55 }); c.u.k.zap = 0; c.mark(c.u, 'stump_zap', 1, 2); } });
defMove({ id: 'stubborn', name: 'Stump Butt', type: 'ROOT', owner: 'stump', reach: 'single', cd: 3, text: 'Hits for 98% ATK + 25% of its missing HP. Unstoppable 1.',
  run(c) { c.hit(c.tgt, { atk: 0.98, flat: (c.u.maxHp - c.u.hp) * 0.25 }); c.st(c.u, 'unstop', 1); } });
defMove({ id: 'heartwood', name: 'New Growth', type: 'ROOT', owner: 'stump', reach: 'self', cd: 6, nerve: 4,
  text: 'Max HP +15% for the battle. Regen 3. Haste 2.',
  run(c) { const add = Math.round(c.u.st.hp * 0.15); c.u.maxHp += add; c.heal(c.u, add); c.st(c.u, 'regen', 3, 0.06); c.st(c.u, 'haste', 2); } });

// puffball: a puffball that dusts the eyes, plants caps underfoot, and rolls off quick.
defMark({ id: 'puffball_quick', name: 'rolling', clock: 'own', volatile: true, value: 0.04,
  afterTake(b, f, src, dealt, d) { if (d.move) { delete f.s.haste; unmark(f, 'puffball_quick'); } } });
defPassive({ id: 'spores', name: 'Spore Cloud', owner: 'puffball', text: 'Its attacks add Poison 1. Its Caps deal 1.5x damage.',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'poison', 1); } });
defPassive({ id: 'camouflage', name: 'Lies Low', owner: 'puffball', text: 'When it guards: Ward 1.',
  afterGuard(b, f) { applyStatus(b, f, f, 'ward', 1); } });
defMove({ id: 'toxicpuff', name: 'Eye Dust', type: 'ROOT', owner: 'puffball', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 146% MGK. Weaken 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.46 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'setcap', name: 'Plant a Cap', type: 'ROOT', owner: 'puffball', reach: 'side', tags: ['spell'], cd: 2,
  text: 'Sets a Cap, up to 3. A Cap hits the next foe out: 90% MGK, Poison 2.',
  run(c) { const side = c.them === c.b.s[0] ? 0 : 1; c.them.caps = Math.min(3, c.them.caps + 1); sk(c.b, side).capMgk = stat(c.b, c.u, 'mgk') * (has(c.u, 'spores') ? 1.5 : 1); c.msg(`Caps on their side: ${c.them.caps}.`); } });
defMove({ id: 'dust', name: 'Roll Away', type: 'ROOT', owner: 'puffball', reach: 'self', cd: 4, wt: 50, text: 'Haste 3. It ends when a move hits it.',
  run(c) { c.st(c.u, 'haste', 3); c.mark(c.u, 'puffball_quick', 1, 3); } });
defMove({ id: 'fairyring', name: 'Ring of Caps', type: 'ROOT', owner: 'puffball', reach: 'side', tags: ['spell'], cd: 5, nerve: 4,
  text: 'Sets 3 Caps on their side. Poison 2.',
  run(c) { const side = c.them === c.b.s[0] ? 0 : 1; c.them.caps = 3; sk(c.b, side).capMgk = stat(c.b, c.u, 'mgk') * (has(c.u, 'spores') ? 1.5 : 1); c.st(c.tgt, 'poison', 2); c.msg('A ring of caps comes up.'); } });

// bramble: a briar whose canes bleed, sweep, reel a foe in, and tear free.
defPassive({ id: 'briar', name: 'Hooked Thorns', owner: 'bramble', text: 'Its hits add Bleed 1 (12% ATK per stack each turn). When a foe reaches Bleed 5: Empower 2.',
  afterDeal(b, f, t, dealt, d) {
    if (d.reserve || d.dot || t.ko || t.side === f.side) return;
    applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.12);
    if ((t.s.bleed?.n || 0) >= 5) applyStatus(b, f, f, 'empower', 2);
  } });
defPassive({ id: 'feed', name: 'Drinks Deep', owner: 'bramble', text: 'Heals 20% of the damage it deals to Bleeding foes.',
  afterDeal(b, f, t, dealt, d) { if (t.s.bleed && !d.reserve) heal(b, f, f, dealt * 0.2); } });
defMove({ id: 'lash', name: 'Briar Sweep', type: 'ROOT', owner: 'bramble', reach: 'spread', cd: 1, text: 'Hits every foe for 59% ATK. Heals 4% of its max HP per Bleeding foe.',
  run(c) { c.spread({ atk: 0.59 }); const n = standing(c.them).filter(e => e.s.bleed).length; c.heal(c.u, c.u.maxHp * 0.04 * n); } });
defMove({ id: 'creep', name: 'Snag Cane', type: 'ROOT', owner: 'bramble', reach: 'single', cd: 2, text: 'Hits for 109% ATK. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 1.09 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'ripout', name: 'Reel In', type: 'ROOT', owner: 'bramble', reach: 'dragin', cd: 4, text: 'Drags in a reserve. Hits it for 77% ATK. Root 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 0.77 }); c.st(t, 'root', 1); } });
defMove({ id: 'thornwall', name: 'Tear Free', type: 'ROOT', owner: 'bramble', reach: 'single', cd: 5, nerve: 4,
  text: 'Deals 82% ATK + 20% ATK per Bleed as true damage. If it KOs the foe: its cooldown resets.',
  run(c) {
    const n = c.tgt.s.bleed?.n || 0;
    c.hit(c.tgt, { atk: 0.82 + 0.2 * n }, { kind: 'T' });
    if (c.tgt.ko) { const i = c.u.moves.indexOf('thornwall'); if (i >= 0) c.u.cd[i] = 0; c.msg(`${label(c.b, c.u)} tears free.`); }
  } });

// hemlock: a hemlock in a cup that doses and mends, offers a sleeping sip, spills, and pours out for a friend.
defPassive({ id: 'cup', name: 'Bitter End', owner: 'hemlock', text: 'Deals 1.3x damage to foes below 40% HP.',
  outMul(b, f, t) { return t.hp < t.maxHp * 0.4 ? 1.3 : 1; } });
defPassive({ id: 'tincture', name: 'Deep Sleep', owner: 'hemlock', text: 'Deals 1.6x damage to a sleeping foe.',
  outMul(b, f, t) { return t.s.sleep ? 1.6 : 1; } });
defMove({ id: 'dose', name: 'Bitter Dose', type: 'ROOT', owner: 'hemlock', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 111% MGK. Poison 2. Heals 25% of the damage dealt.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.11 }); c.st(c.tgt, 'poison', 2); c.heal(c.u, d * 0.25); } });
defMove({ id: 'draught', name: 'Sleeping Cup', type: 'ROOT', owner: 'hemlock', reach: 'single', cd: 4, text: 'Sleep 2. Damage wakes the foe.',
  run(c) { c.st(c.tgt, 'sleep', 2); } });
defMove({ id: 'wilt', name: 'Spilled Cup', type: 'ROOT', owner: 'hemlock', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 69% MGK. Rot 2 on every foe. Heals 8% max HP.',
  run(c) { c.spread({ mgk: 0.69 }); for (const e of standing(c.them)) c.st(e, 'rot', 2); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'lastcup', name: 'Pour Out', type: 'ROOT', owner: 'hemlock', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true,
  text: 'Switches to an ally: heals it 20% of max HP. Empower 2. Fortify 2.',
  run(c) { const a = c.ally!; c.heal(a, a.maxHp * 0.2); c.st(a, 'empower', 2); c.st(a, 'fortify', 2); } });
