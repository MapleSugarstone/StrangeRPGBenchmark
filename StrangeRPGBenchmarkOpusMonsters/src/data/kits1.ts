import { knockDown, takeIn, delayPending, fogBench, dropItem, sporeMove, addNerve, applyStatus, banish, reflect, dismiss, forceAction, summon, summonsOf, cameOutSince, cleanse, dealDamage, delayFighter, doSwitch, emit, foeOf, giveShield, has, heal, isOut, label, mark, marked, markedBy, msg, reserves, sk, standing, stat, unmark, SPREAD_SHARE } from '../battle/engine';
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

// cairn: a wayside cairn that takes a stone from every walker who passes and adds every blow it takes to its pile.
defPassive({ id: 'stacking', name: 'Piled High', owner: 'cairn', text: 'A Stone, up to 6, when hit or when any Whorl comes out. Each cuts damage taken 4%.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.stone = Math.min(6, (f.k.stone || 0) + 1); },
  anyOut(b, f, who) { if (who !== f && isOut(b, f)) f.k.stone = Math.min(6, (f.k.stone || 0) + 1); },
  inMul(b, f) { return 1 - 0.04 * (f.k.stone || 0); } });
defMark({ id: 'cairn_way', name: 'pointed at', calls: true, negative: true, value: -0.05 });
defPassive({ id: 'waymark', name: 'Points the Way', owner: 'cairn', text: 'Reserve: your out Whorl takes 0.92x. Coming out: the foe\'s weakest is next out.',
  auraIn() { return 0.92; },
  comeOut(b, f) {
    const r = reserves(b.s[1 - f.side]).filter(x => !x.ko && !x.gone).sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0];
    if (!r) return;
    mark(b, f, r, 'cairn_way', 1, -1);
    msg(b, `${label(b, f)} points the way toward ${label(b, r)}.`);
  } });
defMark({ id: 'cairn_grasp', name: 'catching', clock: 'own', volatile: true, value: 0.15,
  beforeTake(b, f, src, amt, d) {
    if (d.dot || !src || src.side === f.side) return amt;
    unmark(f, 'cairn_grasp');
    f.k.stone = Math.min(6, (f.k.stone || 0) + 2);
    msg(b, `${label(b, f)} catches it and throws some back.`);
    if (!src.ko) reflect(b, f, src, amt * 0.4);
    return 0;
  } });
defMove({ id: 'topple', name: 'Top Stone', type: 'STONE', owner: 'cairn', reach: 'single', cd: 1, fx: 'lunge | pebble arc | crack',
  text: 'Hits for 125% ATK + 6% max HP. Throws a Stone: +30% ATK. 3 Stones: Stun 1.',
  run(c) { const tall = (c.u.k.stone || 0) >= 3, st = (c.u.k.stone || 0) > 0; if (st && !c.preview) c.u.k.stone -= 1; c.hit(c.tgt, { atk: st ? 1.55 : 1.25, selfHp: 0.06 }); if (tall && !c.tgt.ko) c.st(c.tgt, 'stun', 1); } });
defSummon({ id: 'cairn_barrier', name: 'Little Cairn', owner: 'cairn', text: 'Takes every single-target hit meant for your out Whorl. When knocked down: Kivishi gains 2 Stones.', every: 100, guard: true,
  sprite: { px: ['........', '........', '...33...', '..2222..', '..4444..', '.222222.', '.444444.', '22222222'], c: ['#9d9da5', '#ddbe9e', '#5e5c64'] },
  act() { /* it only stands */ },
  fall(b, s, owner) { if (owner && !owner.ko) owner.k.stone = Math.min(6, (owner.k.stone || 0) + 2); } });
defMove({ id: 'laystone', name: 'Little Cairn', type: 'SALT', owner: 'cairn', reach: 'side', cd: 4, fx: 'lift | shell arc | crack',
  text: 'Hits for 60% ATK. Summons a Little Cairn (18% of its max HP, 3 turns).',
  run(c) { c.hit(c.tgt, { atk: 0.6 }); for (const x of summonsOf(c.b, c.u.side, 'cairn_barrier')) dismiss(c.b, x); summon(c.b, c.u, 'cairn_barrier', { hp: 0.18, turns: 3 }); } });
defMove({ id: 'shoulder', name: 'Catch a Stone', type: 'STONE', owner: 'cairn', reach: 'self', cd: 4, wt: 60,
  fx: 'swell | pebble return | flash self', text: 'Blocks the next hit before its next turn. Returns 40% of it. +2 Stones.',
  run(c) { c.mark(c.u, 'cairn_grasp', 1, 1); } });
defMove({ id: 'landslide', name: 'Tumbledown', type: 'STONE', owner: 'cairn', reach: 'spread', cd: 5, splash: 0.5, nerve: 4, wu: 90,
  fx: 'stomp | pebble*8 rain | quake crack jolt big', text: 'Wind-up. Hits for 112% ATK + 22% per Stone. Splash 50%. Spends the Stones.',
  run(c) { const s = c.u.k.stone || 0; c.spread({ atk: 1.12 + 0.22 * s }); c.u.k.stone = 0; } });

// scree: a bank of loose shingle that comes down a bit at a time, never all the way, and buries cobbles for whoever comes next.
function screeBurst(b: Battle, f: Fighter | null, who: Fighter): void {
  if (!f || who.ko || who.gone) return;
  msg(b, `A cobble goes off beneath ${label(b, who)}.`);
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
  fx: 'shake | pebble*4 line | crack small', text: 'Hits 4 times for 28% ATK.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.28 }); } });
defMove({ id: 'rockfall', name: 'Slip Shove', type: 'STONE', owner: 'scree', reach: 'single', tags: ['projectile'], cd: 3, wu: 60, fx: 'shake | pebble*3 arc | quake',
  text: 'Wind-up. Hits for 128% ATK and forces the foe out. If it can\'t go: Stun 1.',
  run(c) {
    const t = c.tgt;
    c.hit(t, { atk: 1.28 });
    if (t.ko || c.blocked(t)) return;
    const rock = has(c.u, 'shedstone') ? summonsOf(c.b, c.u.side, 'scree_boulder')[0] : undefined;
    if (rock) { dismiss(c.b, rock); screeBurst(c.b, c.u, t); }
    if (!t.ko && !c.forceOut()) c.st(t, 'stun', 1);
  } });
defMove({ id: 'skid', name: 'Bury Cobbles', type: 'SALT', owner: 'scree', reach: 'side', cd: 3, fx: 'stomp | salt*2 arc | puff',
  text: 'Hits for 70% ATK. Summons 2 Cobbles (6% of its max HP each).',
  run(c) { c.hit(c.tgt, { atk: 0.7 }); summon(c.b, c.u, 'scree_boulder', { hp: 0.06 }); summon(c.b, c.u, 'scree_boulder', { hp: 0.06 }); } });
defMove({ id: 'avalanche', name: 'Shingle Bank', type: 'STONE', owner: 'scree', reach: 'single', cd: 6, nerve: 4,
  fx: 'stomp | pebble*6 sweep | quake crack jolt all big', text: 'Hits for 128% ATK. Neither out Whorl can switch for 3 turns. Haste 3.',
  run(c) { c.hit(c.tgt, { atk: 1.28 }); c.mark(c.tgt, 'scree_walled', 1, 3); c.mark(c.u, 'scree_walled', 1, 3); c.st(c.u, 'haste', 3); } });

// plinth: a statue's empty plinth that keeps its top clear for whoever needs to stand on it and bears the weight from below.
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
    heal(b, by && !by.ko ? by : null, f, f.maxHp * 0.2);
  } });
defMark({ id: 'plinth_hold', name: 'held up', clock: 'side', value: 0.1 });
defPassive({ id: 'pedestal', name: 'Swivel Base', owner: 'plinth', text: 'When it uses a move: its other cooldowns drop by 1, except its crest.',
  afterMove(b, f, m) { f.moves.forEach((id, i) => { const mv = MOVES[id]; if (id !== m.id && mv && !mv.nerve) f.cd[i] = Math.max(0, f.cd[i] - 1); }); } });
defPassive({ id: 'unmoved', name: 'Bears the Weight', owner: 'plinth', text: 'In reserve: it takes 30% of each hit on your out Whorl, down to 1 HP of its own.',
  bears(b, f) { return marked(f, 'plinth_hold') ? 0.5 : 0.3; } });
defMove({ id: 'raise', name: 'Barnacle Cut', type: 'SALT', owner: 'plinth', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | shell line | slash',
  text: 'Hits for 167% MGK. Slow 2. A foe that was already Slowed: Poison 3.',
  run(c) { const slowed = !!c.tgt.s.slow; c.hit(c.tgt, { mgk: 1.67 }); if (slowed) c.st(c.tgt, 'poison', 3); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'lower', name: 'Top Pool', type: 'STONE', owner: 'plinth', reach: 'ally', tags: ['spell'], cd: 2,
  fx: 'swell | drop*3 rise | splash ally', text: 'Heals an ally 54% CHA + 6% max HP. Hits for 86% MGK + 60% of the heal.',
  run(c) { const h = c.heal(c.ally!, c.cha(0.54) + c.ally!.maxHp * 0.06); c.hit(c.tgt, { mgk: 0.86, flat: h * 0.6 }); } });
defMove({ id: 'unveil', name: 'Step Up', type: 'STONE', owner: 'plinth', reach: 'reserveAlly', cd: 3, tag: true, fx: 'lift | crest rise | ring ally',
  text: 'Expose 2. Swaps in an ally: Fortify 2. Bears 50% of hits on it for 3 turns.',
  run(c) { c.st(c.tgt, 'expose', 2); c.st(c.ally!, 'fortify', 2); c.mark(c.u, 'plinth_hold', 1, 3); } });
defMove({ id: 'monument', name: 'Keep the Top', type: 'STONE', owner: 'plinth', reach: 'ally', cd: 6, nerve: 4,
  fx: 'swell big | crest*2 orbit | sigil ally glare', text: 'An ally can\'t fall below 1 HP for 2 turns. Saved: heals 20%. Removes 1 bad status.',
  run(c) { c.mark(c.ally!, 'plinth_grave', 1, 2); c.cleanse(c.ally!, 1); } });

// grotto: a sea cave's old shell that breathes the tide in and out and takes in whatever the tide brings, to give back later.
defMark({ id: 'grotto_taste', name: 'damp', max: 3, negative: true, volatile: true, value: -0.07 });
defPassive({ id: 'drip', name: 'Wet Walls', owner: 'grotto', text: 'When it hits a foe: 1 Damp, up to 3. Damp clears when the foe leaves.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !d.dot && !t.ko && t.side !== f.side) mark(b, f, t, 'grotto_taste', 1, -1); } });
defPassive({ id: 'deep', name: 'Seep', owner: 'grotto', text: 'When hit: stores 30% of the damage as Seep, up to 30% of its max HP.',
  afterTake(b, f, src, dealt) { f.k.gray = Math.min(f.maxHp * 0.3, (f.k.gray || 0) + dealt * 0.3); } });
defMove({ id: 'cavein', name: 'Stalactite', type: 'STONE', owner: 'grotto', reach: 'single', cd: 1, fx: 'shake | shard rain | crack',
  text: 'Hits for 115% ATK. Slow 1. At 3 Damp: Stun 1, and its next action goes in.',
  run(c) {
    const full = c.marked(c.tgt, 'grotto_taste') >= 3;
    c.hit(c.tgt, { atk: 1.15 });
    if (c.tgt.ko) return;
    if (!full) { c.st(c.tgt, 'slow', 1); return; }
    if (c.blocked(c.tgt)) return;
    unmark(c.tgt, 'grotto_taste');
    c.st(c.tgt, 'stun', 1);
    takeIn(c.b, c.tgt, 200);
    c.msg(`The cave inhales around ${label(c.b, c.tgt)}.`);
  } });
defMove({ id: 'takein', name: 'Inrush', type: 'SALT', owner: 'grotto', reach: 'spread', cd: 3, splash: 0.6, wu: 60, fx: 'sink | drop*5 converge | splash all',
  text: 'Wind-up. Hits for 122% ATK. Splash 60%. 2 Damp, and 1 on each reserve.',
  run(c) { c.spread({ atk: 1.22 }); if (!c.tgt.ko) c.mark(c.tgt, 'grotto_taste', 2, -1); for (const r of reserves(c.them)) c.mark(r, 'grotto_taste', 1, -1); } });
defMove({ id: 'hush', name: 'Seep Shell', type: 'STONE', owner: 'grotto', reach: 'self', cd: 3, wt: 60,
  fx: 'swell | drop*3 return | ring self', text: 'Shield of all its Seep + 5% of its max HP, 2 turns. Spends the Seep.',
  run(c) { const g = c.u.k.gray || 0; c.u.k.gray = 0; c.shield(c.u, g + c.u.maxHp * 0.05, 2); } });
defMove({ id: 'swallow', name: 'Take In', type: 'STONE', owner: 'grotto', reach: 'single', cd: 6, nerve: 4,
  fx: 'sink | drop*4 converge | vortex crack jolt big', text: 'Hits for 125% ATK + 9% foe max HP. 3 Damp: it leaves the field for 2 turns.',
  run(c) { const full = c.marked(c.tgt, 'grotto_taste') >= 3; c.hit(c.tgt, { atk: 1.25, tgtHp: 0.09 }); if (full && !c.tgt.ko && !c.blocked(c.tgt)) { unmark(c.tgt, 'grotto_taste'); c.msg(`The tide pulls ${label(c.b, c.tgt)} into ${label(c.b, c.u)}.`); banish(c.b, c.tgt, 2, c.u); } } });

// menhir: a standing stone cut with old star-marks that holds its ground, draws every eye, and falls over on purpose.
defPassive({ id: 'standing', name: 'Old Stance', owner: 'menhir', text: 'Every 3rd turn: its attack adds 50% DEF and hits reserves. Taunts last +1 turn.',
  turnStart(b, f) { f.k.galioT = (f.k.galioT || 0) + 1; },
  addRaw(b, f, t, d) { return d.attack && f.k.galioT % 3 === 0 ? stat(b, f, 'def') * 0.5 : 0; },
  afterAttack(b, f) {
    if (f.k.galioT % 3 !== 0 || f.k.galioDone === f.k.galioT) return;
    f.k.galioDone = f.k.galioT;
    const raw = (stat(b, f, 'atk') + stat(b, f, 'def') * 0.5) * SPREAD_SHARE;
    for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, raw, { ...plain('P'), spread: true, reserve: true }, null);
  } });
defPassive({ id: 'oldmass', name: 'Heavy Base', owner: 'menhir', text: 'Moves add 20% of its DEF to damage. Magic hits meet its DEF rather than its RES.',
  addRaw(b, f, t, d) { return d.attack ? 0 : stat(b, f, 'def') * 0.2; },
  inMul(b, f, src, d) { return d.kind === 'M' ? (100 + stat(b, f, 'res')) / (100 + stat(b, f, 'def')) : 1; } });
defMove({ id: 'lean', name: 'Wind Shadow', type: 'STONE', owner: 'menhir', reach: 'spread', tags: ['spell'], cd: 1, splash: 0.35,
  fx: 'sway | feather*3 sweep | puff all', text: 'Hits for 26% MGK + 35% DEF. Splash 35%.',
  run(c) { c.spread({ mgk: 0.26, def: 0.35 }, { kind: 'M' }); } });
defMove({ id: 'ringofstones', name: 'Stand Fast', type: 'STONE', owner: 'menhir', reach: 'self', cd: 3, wt: 60,
  fx: 'stomp | pebble*4 orbit | ring self', text: 'Taunt 1. Fortify 2 on itself.',
  run(c) { c.st(c.u, 'fortify', 2); c.st(c.tgt, 'taunt', 1); } });
defMove({ id: 'summons', name: 'Star Marks', type: 'STAR', owner: 'menhir', reach: 'single', cd: 4, fx: 'swell | star*3 line | sigil',
  text: 'Hits for 49% ATK + 49% DEF. Stun 1. Fog over your bench for 2 rounds.',
  run(c) { c.hit(c.tgt, { atk: 0.49, def: 0.49 }); c.st(c.tgt, 'stun', 1); fogBench(c.b, c.u.side, 2); } });
defMove({ id: 'fallforward', name: 'Keel Over', type: 'STONE', owner: 'menhir', reach: 'spread', cd: 6, splash: 0.5, nerve: 4, wu: 80, unstop: true, fx: 'stomp | pebble*6 sweep | quake crack jolt all big',
  text: 'Unstoppable wind-up. Hits for 92% ATK + 22% DEF. Splash 50%. Stun 1. Fortify 2.',
  run(c) { c.spread({ atk: 0.92, def: 0.22 }); c.st(c.tgt, 'stun', 1); c.st(c.u, 'fortify', 2); } });

// quarry: the shell a quarry pit left, bored through like piddock rock, that takes stone out of whatever it hits and builds itself up.
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
defMove({ id: 'cut', name: 'Chisel', type: 'STONE', owner: 'quarry', reach: 'single', cd: 1, fx: 'lunge | pebble line | crack', text: 'Hits for 120% ATK. Slow 1. Deals 1.3x damage if the foe has less DEF than it.',
  run(c) { const m = stat(c.b, c.tgt, 'def') < stat(c.b, c.u, 'def') ? 1.3 : 1; c.hit(c.tgt, { atk: 1.2 }, { mult: m }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'blast', name: 'Blasting', type: 'STONE', owner: 'quarry', reach: 'spread', cd: 3, splash: 0.35, wu: 50,
  fx: 'flare | pebble*6 sweep | burst all', text: 'Wind-up. Hits for 107% ATK. Splash 35%. Removes its own bad statuses.',
  run(c) { c.cleanse(c.u); c.spread({ atk: 1.07 }); } });
defMove({ id: 'undermine', name: 'Undermine', type: 'BEAST', owner: 'quarry', reach: 'single', tags: ['dash'], cd: 3, fx: 'sink | shell spiral | bite',
  text: 'Hits for 109% ATK and takes the foe\'s shield as its own. Root 2.',
  run(c) {
    const sh = c.tgt.shield;
    if (sh > 0 && !c.blocked(c.tgt) && !c.preview) { c.tgt.shield = 0; c.tgt.shieldTurns = 0; giveShield(c.b, c.u, c.u, sh, 2); c.msg(`${label(c.b, c.u)} claims the shield as its own.`); }
    c.hit(c.tgt, { atk: 1.09 });
    c.st(c.tgt, 'root', 2);
  } });
defMove({ id: 'excavate', name: 'Flooded Pit', type: 'STONE', owner: 'quarry', reach: 'self', cd: 6, nerve: 4, wt: 70,
  fx: 'sink | drop*5 rise | splash pillar tint self big', text: 'Untouchable 1. Regen 3 (9% of max HP each turn). Empower 2.',
  run(c) { c.st(c.u, 'invuln', 1); c.st(c.u, 'regen', 3, 0.09); c.st(c.u, 'empower', 2); } });

// grotesque: a gutter gargoyle with a barnacled spout that pulls a face at the rain, drops on lone things, and grows a horn each time it wins.
defPassive({ id: 'gutter', name: 'First Drop', owner: 'grotesque', text: 'When it comes out: its first move deals 1.4x damage and adds Slow 1.',
  outMul(b, f, t, d) { return f.k.fresh && d.move ? 1.4 : 1; },
  afterDeal(b, f, t, dealt, d) { if (f.k.fresh && d.move && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'spout', name: 'Coral Horns', owner: 'grotesque', text: 'When it KOs a foe: 1 tide and a Horn, up to 3. Each Horn: moves deal +8%.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side) return;
    addNerve(b, f.side, 1);
    if ((f.k.evo || 0) < 3) { f.k.evo = (f.k.evo || 0) + 1; msg(b, `${label(b, f)} sprouts a coral horn.`); }
  },
  outMul(b, f, t, d) { return d.move ? 1 + 0.08 * (f.k.evo || 0) : 1; } });
defMove({ id: 'drop', name: 'Gutter Drop', type: 'STONE', owner: 'grotesque', reach: 'single', cd: 1,
  fx: 'hop | pebble line | crack', text: 'Hits for 100% ATK. Deals 1.4x if the foe has 1 reserve or none.',
  run(c) { const lone = reserves(c.them).length <= 1; c.hit(c.tgt, { atk: 1 }, { mult: lone ? 1.4 : 1 }); } });
defMove({ id: 'gargle', name: 'Rain Spout', type: 'STONE', owner: 'grotesque', reach: 'spread', cd: 2, splash: 0.2,
  fx: 'swell | drop*4 sweep | splash all', text: 'Hits for 68% ATK. Splash 20%. Heals 30% of the damage to the foe.',
  run(c) { const d = c.spread({ atk: 0.68 }); c.heal(c.u, d * 0.3); } });
defMove({ id: 'perch', name: 'Off the Roof', type: 'BEAST', owner: 'grotesque', reach: 'single', tags: ['dash'], cd: 3, fx: 'hop big | fang line | bite big',
  text: 'Hits for 125% ATK. If it KOs the foe: its cooldown resets.',
  run(c) { c.hit(c.tgt, { atk: 1.25 }); if (c.tgt.ko) { const i = c.u.moves.indexOf('perch'); if (i >= 0) c.u.cd[i] = 0; } } });
defMove({ id: 'leer', name: 'Stone Still', type: 'STONE', owner: 'grotesque', reach: 'self', cd: 6, nerve: 4, wt: 70,
  fx: 'swell big | crest rise | sigil pillar tint self', text: 'Untouchable 1. Its next move deals 1.3x, and First Drop works again.',
  run(c) { c.st(c.u, 'invuln', 1); c.u.k.nextMoveMul = 1.3; c.u.k.fresh = 1; } });

// tor: a hilltop that walked off toward the fallen star and stamps until the ground rings, feeling every wind-up through its feet.
defPassive({ id: 'aftershock', name: 'Hill Shrug', owner: 'tor', text: 'When it uses a move: hits the foe for 30% ATK. Delays its next turn by 10%.',
  afterMove(b, f) { const t = foeOf(b, f); if (!t.ko && !t.gone) { dealDamage(b, f, t, stat(b, f, 'atk') * 0.3, plain('P'), null); delayFighter(b, t, 10); } } });
defMark({ id: 'tor_heel', name: 'heel down', clock: 'own', volatile: true, value: 0.12,
  afterAttack(b, f) {
    unmark(f, 'tor_heel');
    for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.4, { ...plain('P'), spread: true, reserve: true }, 'STONE');
  } });
defPassive({ id: 'bedrock', name: 'Deep Footing', owner: 'tor', text: 'Stunning a foe: 1 tide. A foe winding up: it stamps, and the wind-up lands 30% later.',
  afterApply(b, f, t, id) { if (id === 'stun' && t.side !== f.side) addNerve(b, f.side, 1); },
  anyWindup(b, f, user, m, p) {
    if (user.side === f.side || f.ko || !isOut(b, f)) return;
    delayPending(b, p, 30);
    msg(b, `${label(b, f)} stamps, shaking the ground ${label(b, user)}.`);
  } });
defMove({ id: 'fissure', name: 'Craze Line', type: 'ROOT', owner: 'tor', reach: 'spread', cd: 1, splash: 0.35, fx: 'stomp | thorn*4 sweep | crack all',
  text: 'Hits for 63% ATK. Splash 35%. Root 1. A foe up off the ground comes down.',
  run(c) { c.spread({ atk: 0.63 }); if (c.tgt.ko) return; if (c.tgt.up) knockDown(c.b, c.tgt); c.st(c.tgt, 'root', 1); } });
defMove({ id: 'stamp', name: 'Heel Down', type: 'STONE', owner: 'tor', reach: 'self', cd: 2, wt: 70, fx: 'stomp big | pebble*2 rise | quake self',
  text: 'Its next attack deals 2x and Slow 2, and each foe reserve takes 40% ATK.',
  run(c) { c.u.k.nextAtkMul = 2; c.u.k.nextAtkSlow = 2; c.mark(c.u, 'tor_heel', 1, 2); } });
defMove({ id: 'heave', name: 'Roll Downhill', type: 'STONE', owner: 'tor', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge big | pebble*3 line | quake', text: 'Hits for 71% ATK. Interrupts. Delays the foe\'s next turn by 40%.',
  run(c) { c.hit(c.tgt, { atk: 0.71 }); c.interrupt(c.tgt); c.delay(c.tgt, 40); } });
defMove({ id: 'quake', name: 'Ground Rings', type: 'STONE', owner: 'tor', reach: 'spread', cd: 6, splash: 0.6, nerve: 6, wu: 90, fx: 'stomp | pebble*6 sweep | quake crack jolt all big',
  text: 'Wind-up. Hits for 107% ATK, +10% per Whorl standing. Splash 60%. Stun 1.',
  run(c) { const n = standing(c.them).length + standing(c.me).length; c.spread({ atk: 1.07 + 0.1 * n }); c.st(c.tgt, 'stun', 1); } });

// ================================================================ TIDE

// welling: Turnstone's well, out walking, that brings up water for whoever needs it and frightens easy.
defPassive({ id: 'deepwater', name: 'Deep Draw', owner: 'welling', text: 'Its heals are 1.3x on allies below 40% HP.',
  healMul(b, f, t) { return t.hp < t.maxHp * 0.4 ? 1.3 : 1; } });
defPassive({ id: 'drawnup', name: 'Full Bucket', owner: 'welling', text: 'When Bucket Drop deals damage: Regen 2 (4% of max HP each turn).' });
defMove({ id: 'bucket', name: 'Bucket Drop', type: 'TIDE', owner: 'welling', reach: 'single', tags: ['spell'], cd: 1, fx: 'lift | drop*3 arc | splash',
  text: 'Hits for 155% MGK. Slow 1. Heals itself 4% of its max HP.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.55 }); c.st(c.tgt, 'slow', 1); c.heal(c.u, c.u.maxHp * 0.04); if (d > 0 && has(c.u, 'drawnup')) c.st(c.u, 'regen', 2, 0.04); } });
defMove({ id: 'splash', name: 'Haul Water', type: 'TIDE', owner: 'welling', reach: 'ally', cd: 2, fx: 'sway | drop*3 rise | splash ally', text: 'Heals an ally 60% CHA + 8% of its max HP. Costs Kaivodo 5% max HP.',
  run(c) { const a = c.ally!; c.heal(a, c.cha(0.6) + a.maxHp * 0.08); payHp(c.b, c.u, c.u.maxHp * 0.05); } });
defMove({ id: 'brim', name: 'Well Cover', type: 'STONE', owner: 'welling', reach: 'single', cd: 4, fx: 'stomp | pebble line | ring',
  text: 'Hits for 60% MGK. Silence 1. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'spring', name: 'Spring Rising', type: 'TIDE', owner: 'welling', reach: 'team', cd: 6, nerve: 5, fx: 'swell | drop*6 rise | bloom fizz tint ally big', text: 'Your team heals 20% of max HP, 30% for any below 40% HP.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * (a.hp < a.maxHp * 0.4 ? 0.3 : 0.2)); } });

// undertow: a rip current's shell, a clear coil of cold water off the bottom of a bay that pulls at ankles and drags things under.
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
defMark({ id: 'undertow_sand', name: 'sand in its eyes', clock: 'own', volatile: true, negative: true, value: -0.1,
  outMul(b, f, t, d) { return d.attack ? 0 : 1; },
  afterAttack(b, f) { unmark(f, 'undertow_sand'); msg(b, `${label(b, f)} blinks away the sand.`); } });
defMove({ id: 'pullunder', name: 'Ankle Drag', type: 'TIDE', owner: 'undertow', reach: 'single', tags: ['spell'], cd: 1, fx: 'sink | drop*2 line | drip', text: 'Hits for 85% MGK. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); if (!c.tgt.ko) c.delay(c.tgt, 20); } });
defMove({ id: 'churn', name: 'Sand Churn', type: 'STONE', owner: 'undertow', reach: 'spread', tags: ['spell'], cd: 2, splash: 0.35, fx: 'spin | sand*5 sweep | puff all',
  text: 'Hits for 55% MGK. Splash 35%. Slow 1. The foe\'s next Attack misses.',
  run(c) { c.spread({ mgk: 0.55 }); if (c.tgt.ko) return; c.st(c.tgt, 'slow', 1); c.mark(c.tgt, 'undertow_sand', 1, 2); } });
defMove({ id: 'sink', name: 'Pull Under', type: 'TIDE', owner: 'undertow', reach: 'single', tags: ['spell'], cd: 5, fx: 'sink big | drop*4 converge | vortex',
  text: 'Hits for 60% MGK. It and the foe leave the field for 2 turns.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.6 });
    if (c.tgt.ko || c.blocked(c.tgt) || c.preview) return;
    c.msg(`${label(c.b, c.u)} pulls ${label(c.b, c.tgt)} down.`);
    banish(c.b, c.tgt, 2, c.u);
    banish(c.b, c.u, 2, c.u);
  } });
defMove({ id: 'rip', name: 'Rip Current', type: 'TIDE', owner: 'undertow', reach: 'single', tags: ['spell'], cd: 6, splash: 0.5, nerve: 5, fx: 'sink | drop*6 sweep | vortex splash tint all big',
  text: 'Hits for 100% MGK. Splash 50%. Stun 1.',
  run(c) { c.spread({ mgk: 1.0 }); c.st(c.tgt, 'stun', 1); } });

// fogbank: a sea fog's shell that rolls in off the water, hides its friends on the bench, and comes out of itself somewhere else.
defMark({ id: 'fogbank_shadow', name: 'rolling in', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    unmark(f, 'fogbank_shadow');
    const t = foeOf(b, f);
    if (t.ko || t.gone || f.s.silence) return;
    msg(b, `${label(b, f)} steps out of its own form.`);
    dealDamage(b, f, t, stat(b, f, 'mgk') * 1.6, { kind: 'M', move: MOVES.whiteout, attack: false, dot: false, spread: false, reserve: false }, 'TIDE');
    if (!t.ko) applyStatus(b, f, t, 'silence', 1);
  } });
defPassive({ id: 'grey', name: 'Thick Fog', owner: 'fogbank', text: 'Takes 0.8x from single-target moves. Coming out: bench fog for 2 rounds.',
  inMul(b, f, src, d) { return d.move && !d.spread ? 0.8 : 1; },
  comeOut(b, f) { fogBench(b, f.side, 2); } });
defPassive({ id: 'lift', name: 'Burns Off', owner: 'fogbank', text: 'When it is KO\'d: the next ally out gets Ward 1.',
  anyKO(b, f, v) { if (v === f) sk(b, f.side).wardNext = 1; } });
defMove({ id: 'damp', name: 'Sea Fret', type: 'VOID', owner: 'fogbank', reach: 'spread', tags: ['spell'], cd: 1, splash: 0.2, fx: 'sway | orb*4 sweep | smoke all',
  text: 'Hits for 47% MGK. Splash 20%. Weaken 1. Fog over your bench for 1 round.',
  run(c) { c.spread({ mgk: 0.47 }); c.st(c.tgt, 'weaken', 1); fogBench(c.b, c.u.side, 1); } });
defMove({ id: 'bank', name: 'Fog Bank', type: 'TIDE', owner: 'fogbank', reach: 'ally', cd: 3, fx: 'swell | orb*3 orbit | smoke ally',
  text: 'An ally gets Ward 1, and your bench hides in fog for 3 rounds.',
  run(c) { c.st(c.ally!, 'ward', 1); fogBench(c.b, c.u.side, 3); } });
defMove({ id: 'muffle', name: 'Roll Back', type: 'TIDE', owner: 'fogbank', reach: 'reserveAlly', cd: 4, wt: 50, tag: true,
  fx: 'sink | orb return | smoke self', text: 'Switches to an ally. Its first turn comes 10% sooner.',
  run(c) { c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 10; } });
defMove({ id: 'whiteout', name: 'Haar', type: 'TIDE', owner: 'fogbank', reach: 'self', cd: 6, nerve: 5,
  fx: 'sink big | orb*5 converge | smoke big dark', text: 'Untouchable 1. At its next turn: hits for 160% MGK. Silence 1.',
  run(c) { c.st(c.u, 'invuln', 1); c.mark(c.u, 'fogbank_shadow', 1, 2); } });

// floe: a drift of sea ice down from the north that chills whatever it touches and freezes back together when it breaks.
defMark({ id: 'floe_storm', name: 'sleeting', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.5, 'M', 'TIDE'); const t = foeOf(b, f); if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'chill', name: 'Rime', owner: 'floe', text: 'Its damaging moves add Slow 1.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'refreeze', name: 'Freezes Back', owner: 'floe', text: 'Once per battle, instead of a KO: Stasis 1, back at 15% HP. Slow 2 on the foe.',
  wouldKO(b, f) {
    if (f.k.refroze) return false;
    f.k.refroze = 1; f.hp = 1; f.s = { stasis: { n: 1, src: -1 } }; f.k.thaw = 1;
    f.k.thawPct = 15;
    msg(b, `${label(b, f)} freezes solid, thickening the water around it.`);
    const t = foeOf(b, f);
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 2);
    return true;
  } });
defMove({ id: 'shard', name: 'Ice Splinter', type: 'TIDE', owner: 'floe', reach: 'single', tags: ['spell'], cd: 1, fx: 'blink | shard line | frost', text: 'Hits for 77% MGK. Interrupts if the foe was already Slowed.',
  run(c) { const slowed = !!c.tgt.s.slow; c.hit(c.tgt, { mgk: 0.77 }); if (slowed && !c.tgt.ko) c.interrupt(c.tgt); } });
defMove({ id: 'packice', name: 'Pressure Ridge', type: 'STONE', owner: 'floe', reach: 'single', tags: ['spell'], cd: 3, fx: 'stomp | shard*3 rise | crack',
  text: 'Hits for 50% MGK. Root 2. Shields itself 10% of its max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); c.st(c.tgt, 'root', 2); c.shield(c.u, c.u.maxHp * 0.1, 2); } });
defMove({ id: 'calve', name: 'Calving', type: 'TIDE', owner: 'floe', reach: 'single', tags: ['spell'], cd: 2, fx: 'shake | shard*2 rain | shatter', text: 'Hits for 60% MGK. Deals 2x damage to a Slowed foe.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }, { mult: c.tgt.s.slow ? 2 : 1 }); } });
defMove({ id: 'freezeover', name: 'Sleet Drift', type: 'TIDE', owner: 'floe', reach: 'spread', tags: ['spell'], cd: 6, splash: 0.35, nerve: 5,
  fx: 'swell | shard*6 rain | frost splash tint all big', text: 'Hits for 46% MGK. Splash 35%. Its next 3 turns: 50% MGK, Splash 35%, Slow 1.',
  run(c) { c.spread({ mgk: 0.46 }); c.mark(c.u, 'floe_storm', 1, 3); } });

// squall: a squall that came off the sea sideways and still does, pinning things flat with rain and running ahead of its own wind.
defMark({ id: 'squall_windrun', name: 'running ahead', clock: 'own', volatile: true, value: 0.12,
  beforeTake(b, f, src, amt, d) { return d.attack ? 0 : amt; } });
defMark({ id: 'squall_flat', name: 'flattened', clock: 'own', volatile: true, negative: true, value: -0.12,
  forbid(b, f, what) { return what === 'guard' || what === 'switch' ? 'Flattened.' : null; } });
defPassive({ id: 'downpour', name: 'Two Drops', owner: 'squall', text: 'Its attacks hit 2 times at 0.5x damage.' });
defPassive({ id: 'clearing', name: 'Blows Over', owner: 'squall', text: 'When it switches out: the ally coming out gets Haste 1.' });
defMove({ id: 'gust', name: 'Rain Shot', type: 'TIDE', owner: 'squall', reach: 'spread', tags: ['projectile'], cd: 1, splash: 0.5, fx: 'sway | drop*4 sweep | splash all', text: 'Hits for 79% ATK. Splash 50%.',
  run(c) { c.spread({ atk: 0.79 }); } });
defMove({ id: 'sheets', name: 'Flatten', type: 'STONE', owner: 'squall', reach: 'single', cd: 3, fx: 'stomp | drop*3 rain | quake',
  text: 'Hits for 93% ATK. Flattened 1: it can\'t guard or switch at its next turn.',
  run(c) { c.hit(c.tgt, { atk: 0.93 }); if (!c.tgt.ko) c.mark(c.tgt, 'squall_flat', 1, 1); } });
defMove({ id: 'bluster', name: 'Run Ahead', type: 'TIDE', owner: 'squall', reach: 'self', cd: 4, wt: 60, fx: 'lift | feather*3 sweep | puff self', text: 'Attacks deal 0 damage to it until its next turn ends. Haste 1.',
  run(c) { c.mark(c.u, 'squall_windrun', 1, 1); c.st(c.u, 'haste', 1); } });
defMove({ id: 'cloudburst', name: 'Cloudburst', type: 'TIDE', owner: 'squall', reach: 'single', cd: 5, nerve: 5, fx: 'swell | drop*6 rain | splash ring tint big', text: 'Hits 6 times for 27% ATK.',
  run(c) { for (let i = 0; i < 6 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.27 }); } });

// bore: a tidal bore's shell, one wave that runs up rivers the wrong way, gathers speed with every turn, and washes over whatever falls.
defPassive({ id: 'momentum', name: 'Gathering', owner: 'bore', text: '+1 Gathering each turn it doesn\'t guard, up to 4: +8% damage each. A guard clears it.',
  outMul(b, f) { const m = f.k.momentum || 0; return f.k.boreTide ? 1 + 0.16 * m : 1 + 0.08 * m; } });
defPassive({ id: 'upstream', name: 'Washes Over', owner: 'bore', text: 'The first time it comes out: its first turn comes 40% sooner. A KO blow\'s rest hits the next foe out, up to 25% HP.',
  comeOut(b, f) { if (f.k.washed) return; f.k.washed = 1; f.k.firstBonus = (f.k.firstBonus || 0) + 40; },
  overflow(b, f, v, over, d) { if (v.side !== f.side && !d.dot) f.k.wash = (f.k.wash || 0) + over; },
  anyOut(b, f, who) {
    if (!f.k.wash || who.side === f.side || f.ko) return;
    const n = Math.min(f.k.wash, who.maxHp * 0.25);
    f.k.wash = 0;
    msg(b, `The remainder of the wave crashes over ${label(b, who)}.`);
    dealDamage(b, f, who, n, plain('T'), null);
  } });
defMove({ id: 'surge', name: 'Wave Front', type: 'TIDE', owner: 'bore', reach: 'single', cd: 1, fx: 'lunge | drop*2 wave | splash', text: 'Hits for 49% ATK. +10% damage per use since it came out, up to +30%.',
  run(c) {
    if (c.u.k.surgeAt !== c.u.outAt) { c.u.k.surgeAt = c.u.outAt; c.u.k.surges = 0; }
    c.hit(c.tgt, { atk: 0.49 }, { mult: 1 + 0.1 * Math.min(3, c.u.k.surges || 0) });
    c.u.k.surges = (c.u.k.surges || 0) + 1;
  } });
defMove({ id: 'crest', name: 'Draw Back', type: 'TIDE', owner: 'bore', reach: 'spread', cd: 2, splash: 0.25, fx: 'sink | drop*4 return | splash all', text: 'Hits for 29% ATK. Splash 25%. Heals 25% of the damage to the foe.',
  run(c) { const d = c.spread({ atk: 0.29 }); c.heal(c.u, d * 0.25); } });
defMove({ id: 'runup', name: 'Overtop', type: 'STONE', owner: 'bore', reach: 'single', cd: 3, fx: 'lunge big | pebble*3 wave | quake',
  text: 'Hits for 38% ATK + 8% ATK per Gathering. Forces the foe out.',
  run(c) { c.hit(c.tgt, { atk: 0.38 + 0.08 * (c.u.k.momentum || 0) }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'boretide', name: 'Spring Bore', type: 'TIDE', owner: 'bore', reach: 'spread', cd: 6, splash: 0.6, nerve: 5,
  fx: 'lunge | drop*6 wave | splash ring jolt all big', text: 'Hits for 93% ATK. Splash 60%. The foe must switch at its next turn.',
  run(c) { c.spread({ atk: 0.93 }); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'switch'); } });

// brine: a crust off the Dry Sea's salt pans that spits brine from a long way off and dries every wound it touches shut.
defMark({ id: 'brine_barrage', name: 'salting', clock: 'own', volatile: true, value: 0.1,
  addRaw(b, f, t, d) { return d.attack ? t.maxHp * 0.05 : 0; } });
defPassive({ id: 'salt', name: 'Salt Wound', owner: 'brine', text: 'Foes it damages get Rot 2.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'rot', 2); } });
defPassive({ id: 'cure', name: 'Salt Burst', owner: 'brine', text: 'When it is KO\'d: the foe takes 15% of its max HP as true damage. Rot 3.',
  anyKO(b, f, v) {
    if (v !== f) return;
    const t = foeOf(b, f);
    if (t.ko || t.gone) return;
    msg(b, `${label(b, f)} explodes into salt.`);
    dealDamage(b, f, t, t.maxHp * 0.15, dot('T'), null);
    if (!t.ko) applyStatus(b, f, t, 'rot', 3);
  } });
defMove({ id: 'sting', name: 'Brine Spit', type: 'SALT', owner: 'brine', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | salt line | drip',
  text: 'Hits for 110% MGK. Expose 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'crust', name: 'Salt Rime', type: 'TIDE', owner: 'brine', reach: 'self', cd: 3, wt: 60, fx: 'swell | salt*3 orbit | sparkle self', text: 'For 3 turns its attacks add 5% of the foe\'s max HP.',
  run(c) { c.mark(c.u, 'brine_barrage', 1, 3); } });
defMove({ id: 'pickle', name: 'Brine Flood', type: 'TIDE', owner: 'brine', reach: 'spread', tags: ['spell'], cd: 2, splash: 0.35, fx: 'sink | drop*5 sweep | drip all',
  text: 'Hits for 70% MGK. Splash 35%. Slow 2.',
  run(c) { c.spread({ mgk: 0.7 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'evaporate', name: 'Dry Up', type: 'TIDE', owner: 'brine', reach: 'single', tags: ['projectile', 'spell'], cd: 5, nerve: 3, fx: 'flare big | salt*3 rise | fizz splash tint', text: 'Hits for 120% MGK. Deals 2x damage to a foe below 40% HP.',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }, { mult: c.tgt.hp < c.tgt.maxHp * 0.4 ? 2 : 1 }); } });

// eddy: a whirlpool off a river bend that turns in one place, makes you turn, and spins whatever it catches into another place.
defMark({ id: 'eddy_dizzy', name: 'dizzy', clock: 'own', volatile: true, negative: true, value: -0.12,
  spins(b, f, i) { return i < 3 ? (i + 1) % 3 : i; } });
defPassive({ id: 'turnabout', name: 'Spun Round', owner: 'eddy', text: 'When it forces a foe out or drags one in: a shield of 12% of its max HP.' });
defPassive({ id: 'spin', name: 'Makes You Turn', owner: 'eddy', text: 'In reserve: your out Whorl deals 1.05x. Out: a foe that comes out goes Dizzy 2.',
  auraOut() { return 1.05; },
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f) && !f.ko) mark(b, f, who, 'eddy_dizzy', 1, 2); } });
defMove({ id: 'whirl', name: 'Dizzy Wave', type: 'TIDE', owner: 'eddy', reach: 'spread', tags: ['spell'], cd: 1, splash: 0.35, fx: 'spin | drop*4 spiral | vortex all',
  text: 'Hits for 56% MGK. Splash 35%. Expose 1. Dizzy 1.',
  run(c) { c.spread({ mgk: 0.56 }); if (c.tgt.ko) return; c.st(c.tgt, 'expose', 1); c.mark(c.tgt, 'eddy_dizzy', 1, 1); } });
defMove({ id: 'turn', name: 'Spin Bolt', type: 'GEAR', owner: 'eddy', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'spin | cog line | crack',
  text: 'Hits for 95% MGK, 1.4x on a Dizzy foe. Stun 1.',
  run(c) { const dz = marked(c.tgt, 'eddy_dizzy') > 0; c.hit(c.tgt, { mgk: 0.95 }, { mult: dz ? 1.4 : 1 }); if (!c.tgt.ko) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'exchange', name: 'Hand Round', type: 'TIDE', owner: 'eddy', reach: 'reserveAlly', cd: 4, tag: true,
  fx: 'spin | drop*2 return | ring ally', text: 'Switches to an ally: Empower 1, and its first turn comes 40% sooner.',
  run(c) { c.st(c.ally!, 'empower', 1); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 40; } });
defMove({ id: 'maelstrom', name: 'Whirlpool', type: 'TIDE', owner: 'eddy', reach: 'dragin', tags: ['spell'], cd: 6, nerve: 4, tag: true, fx: 'spin | drop*6 spiral | vortex splash tint big',
  text: 'Drags in a reserve. Hits it for 84% MGK. Stun 1. Dizzy 2. Then switches out.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 0.84 }); if (t.ko) return; c.st(t, 'stun', 1); c.mark(t, 'eddy_dizzy', 1, 2); } });

// ================================================================ ROOT

// thicket: a hedge of sea buckthorn that balls itself up, bristles, and grows across whatever path it likes.
defMark({ id: 'thicket_slam', name: 'settling', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { unmark(f, 'thicket_slam'); msg(b, 'Hedge settles again.'); splash(b, f, stat(b, f, 'atk') * 0.55, 'P', 'ROOT'); } });
defPassive({ id: 'thorned', name: 'Buckthorn', owner: 'thicket', text: 'When hit: returns 15% of the damage. Its moves add 25% DEF to their damage.',
  afterTake(b, f, src, dealt) { if (src && src !== f && !src.ko) dealDamage(b, f, src, dealt * 0.15, { ...dot('M'), reflect: true } as DmgInfo, null); },
  addRaw(b, f, t, d) { return d.move ? stat(b, f, 'def') * 0.25 : 0; } });
defPassive({ id: 'hedge', name: 'Hedged In', owner: 'thicket', text: 'A dash that hits it gets caught in the hedge: Root 2 on the Whorl that dashed.',
  afterTake(b, f, src, dealt, d) {
    if (!src || src.side === f.side || src.ko || d.dot || !d.move?.tags?.includes('dash')) return;
    msg(b, `${label(b, src)} is caught in the hedge.`);
    applyStatus(b, f, src, 'root', 2);
  } });
defMark({ id: 'thicket_caught', name: 'caught', clock: 'own', volatile: true, negative: true, value: -0.08,
  inMul(b, f, src) { return src && src.mon.kind === 'thicket' ? 1.25 : 1; } });
defMove({ id: 'snag', name: 'Roll Across', type: 'ROOT', owner: 'thicket', reach: 'single', tags: ['dash'], cd: 1, fx: 'spin | thorn*3 line | slash',
  text: 'Hits for 54% ATK + 25% DEF, and the first reserve for half. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.54, def: 0.25 }); if (!c.tgt.ko) c.st(c.tgt, 'slow', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { atk: 0.54, def: 0.25 }, { reserve: true, mult: 0.5 }); } });
defMove({ id: 'bristle', name: 'Bristle Up', type: 'ROOT', owner: 'thicket', reach: 'self', cd: 3, fx: 'swell | thorn*6 orbit | ring self', text: 'Thorns 2 (returns 40% of damage taken). Fortify 2.',
  run(c) { c.st(c.u, 'thorns', 2, 0.4); c.st(c.u, 'fortify', 2); } });
defMove({ id: 'tangle', name: 'Catch a Sleeve', type: 'TIDE', owner: 'thicket', reach: 'single', cd: 3, fx: 'sway | thorn line | drip',
  text: 'Hits for 42% ATK. Taunt 2: it takes 1.25x from Yabuko till then.',
  run(c) { c.hit(c.tgt, { atk: 0.42 }); if (c.tgt.ko) return; c.st(c.tgt, 'taunt', 2); c.mark(c.tgt, 'thicket_caught', 1, 2); } });
defMove({ id: 'overgrow', name: 'Hedge Fall', type: 'ROOT', owner: 'thicket', reach: 'spread', tags: ['dash'], cd: 6, splash: 0.5, nerve: 5, fx: 'stomp | thorn*6 sweep | slash bloom jolt all big',
  text: 'Hits for 133% ATK. Splash 50%. Slow 2. Its next turn: 55% ATK, Splash 35%.',
  run(c) { c.spread({ atk: 1.33 }); c.st(c.tgt, 'slow', 2); c.mark(c.u, 'thicket_slam', 1, 2); } });

// mycel: the white threads under a wood, gone walking as a pale mat that fruits on whatever it poisons and passes the poison on.
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
defMove({ id: 'spore', name: 'Spore Gust', type: 'ROOT', owner: 'mycel', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | sand*4 wave | puff',
  text: 'Hits for 113% MGK. Poison 2. Slow 1. Already Poisoned: summons a Stinkhorn.',
  run(c) {
    const fruits = !!c.tgt.s.poison;
    c.hit(c.tgt, { mgk: 1.13 });
    c.st(c.tgt, 'poison', 2);
    c.st(c.tgt, 'slow', 1);
    if (fruits && !c.preview && summonsOf(c.b, c.u.side, 'mycel_ward').length < 2) summon(c.b, c.u, 'mycel_ward', { hp: 0.1, turns: 3 });
  } });
defMove({ id: 'flush', name: 'Push Up', type: 'ROOT', owner: 'mycel', reach: 'side', cd: 3, wt: 70,
  fx: 'sink | leaf rise | puff', text: 'Summons a Stinkhorn (10% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'mycel_ward', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'decompose', name: 'Rot Down', type: 'VOID', owner: 'mycel', reach: 'single', cd: 3, fx: 'sink | orb*3 converge | smoke',
  text: 'Hits for 45% MGK, then deals all of the foe\'s remaining Poison at once.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    c.hit(c.tgt, { mgk: 0.45 });
    const n = c.tgt.s.poison?.n || 0;
    if (!n || c.tgt.ko) return;
    delete c.tgt.s.poison;
    c.hit(c.tgt, { tgtHp: 0.03 * n * (n + 1) / 2 }, { kind: 'T' });
  } });
defMove({ id: 'mycorrhiza', name: 'Through Roots', type: 'ROOT', owner: 'mycel', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5,
  fx: 'stomp big | thorn*5 sweep | puff bloom jolt all', text: 'Hits for 80% MGK. Poison 4. Rot 2. Each reserve gets Poison 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); c.st(c.tgt, 'poison', 4); c.st(c.tgt, 'rot', 2); for (const r of reserves(c.them)) c.st(r, 'poison', 2); } });

// burr: a burdock burr the size of a dog that sticks to whatever passes, and to the next thing that passes after that.
defMark({ id: 'burr_sap', name: 'hooked', max: 5, negative: true, clock: 'own', value: -0.05, sticks: true });
defMark({ id: 'burr_fly', name: 'along for the ride', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { const t = foeOf(b, f); if (t.ko || t.gone) return; applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.25); mark(b, f, t, 'burr_sap', 1, 4); } });
defPassive({ id: 'stuckon', name: 'Hooked On', owner: 'burr', text: 'Hooks, up to 5, last 4 turns and stick to the next foe out. +6% damage per Hook.',
  outMul(b, f, t) { return 1 + 0.06 * marked(t, 'burr_sap'); } });
defPassive({ id: 'seedfall', name: 'Catches On', owner: 'burr', text: 'Takes 0.8x from attacks while Hasted. A Whorl that dashes into it gets 2 Hooks.',
  inMul(b, f, src, d) { return d.attack && f.s.haste ? 0.8 : 1; },
  afterTake(b, f, src, dealt, d) {
    if (!src || src.side === f.side || src.ko || d.dot || !d.move?.tags?.includes('dash')) return;
    mark(b, f, src, 'burr_sap', 2, 4);
  } });
defMove({ id: 'catch', name: 'Hook On', type: 'ROOT', owner: 'burr', reach: 'single', cd: 1, fx: 'lunge | thorn*2 line | claw', text: 'Hits for 59% ATK. 2 Hooks.',
  run(c) { c.hit(c.tgt, { atk: 0.59 }); if (!c.tgt.ko) c.mark(c.tgt, 'burr_sap', 2, 4); } });
defMove({ id: 'prickle', name: 'Seed Burst', type: 'GEAR', owner: 'burr', reach: 'spread', cd: 3, splash: 0.35, fx: 'flare | thorn*6 sweep | slash all',
  text: 'Hits for 60% ATK. Splash 35%. A Hook on each foe. Bleed 2. Delays it 20%.',
  run(c) { c.spread({ atk: 0.6 }); for (const t of [c.tgt, ...reserves(c.them)]) if (!t.ko && !t.gone) c.mark(t, 'burr_sap', 1, 4); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.17); c.delay(c.tgt, 20); } });
defMove({ id: 'hitch', name: 'Hitch a Ride', type: 'ROOT', owner: 'burr', reach: 'self', cd: 4, wt: 60,
  fx: 'hop | thorn return | sparkle self', text: 'Haste 2. At its next 2 turns: Bleed 1 and a Hook on the foe.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.u, 'burr_fly', 1, 2); } });
defMove({ id: 'burstpod', name: 'Drag Along', type: 'ROOT', owner: 'burr', reach: 'single', cd: 6, nerve: 4, fx: 'lunge | thorn*4 converge | claw bloom jolt big',
  text: 'Drags in their weakest reserve. Hits for 55% ATK. 2 Hooks. Stun 1. Root 3.',
  run(c) {
    const r = reserves(c.them).sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0];
    if (r) c.dragIn(r.idx);
    const t = c.them.f[c.them.out];
    c.hit(t, { atk: 0.55 });
    if (t.ko) return;
    c.mark(t, 'burr_sap', 2, 4);
    c.st(t, 'stun', 1);
    c.st(t, 'root', 3);
  } });

// orchard: an orchard's shell that walks on its roots, drops fruit for its friends, and pulls them in under its boughs.
defPassive({ id: 'windfall', name: 'Last Windfall', owner: 'orchard', text: 'When it is KO\'d: the next ally out heals 20% of its max HP.',
  anyKO(b, f, v) { if (v === f) sk(b, f.side).healNext = 1; } });
defPassive({ id: 'overripe', name: 'Too Ripe', owner: 'orchard', text: 'When it overheals: the extra becomes a shield, up to 20% of max HP.',
  afterHeal(b, f, t, amt, over) { if (over > 0) giveShield(b, f, t, Math.min(over, t.maxHp * 0.2), 3); } });
defMove({ id: 'pick', name: 'Ripe Fruit', type: 'ROOT', owner: 'orchard', reach: 'ally', cd: 1, fx: 'sway | leaf*2 arc | sparkle ally',
  text: 'Heals an ally 55% CHA + 5% of its max HP. Drops a Pear, up to 2 at once.',
  run(c) { c.heal(c.ally!, c.cha(0.55) + c.ally!.maxHp * 0.05); if (!c.preview && (c.b.drops || []).length < 2) dropItem(c.b, 'espalier_pear', 3); } });
defMove({ id: 'graft', name: 'Hard Pips', type: 'STONE', owner: 'orchard', reach: 'single', tags: ['spell'], cd: 2, fx: 'shake | pebble*3 line | crack small',
  text: 'Hits 3 times for 57% MGK. Each hit heals your most hurt ally 3%.',
  run(c) {
    for (let i = 0; i < 3 && !c.tgt.ko; i++) {
      if (c.hit(c.tgt, { mgk: 0.57 }) <= 0) continue;
      const a = standing(c.me).slice().sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0];
      if (a) c.heal(a, a.maxHp * 0.03);
    }
  } });
defMove({ id: 'dropfruit', name: 'Under Boughs', type: 'ROOT', owner: 'orchard', reach: 'reserveAlly', cd: 4, tag: true,
  fx: 'sway | leaf*3 rain | ring ally', text: 'Switches to an ally. It gets Ward 1 and heals 10% of its max HP.',
  run(c) { c.st(c.ally!, 'ward', 1); c.heal(c.ally!, c.ally!.maxHp * 0.1); } });
defMove({ id: 'harvest', name: 'Full Bloom', type: 'ROOT', owner: 'orchard', reach: 'team', cd: 7, nerve: 5,
  fx: 'swell | petal*6 rain | bloom ring tint ally big', text: 'Your team heals 20% of max HP and gets Regen 2 (5% of max HP each turn).',
  run(c) { for (const a of standing(c.me)) { c.heal(a, a.maxHp * 0.2); c.st(a, 'regen', 2, 0.05); } } });

// stump: a felled tree's stump that grows a ring every turn, puts out shoots, and will not stay down.
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
    msg(b, `${label(b, f)} sends out a new shoot.`);
  } });
defMove({ id: 'splinter', name: 'Splinter Off', type: 'ROOT', owner: 'stump', reach: 'single', cd: 1, fx: 'lunge | thorn*2 line | slash',
  text: 'Hits for 100% ATK + 10% per Ring, + 8% of the foe\'s current HP. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.0 + 0.1 * (c.u.k.rings || 0), tgtCur: 0.08 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'sap', name: 'Sap Rising', type: 'ROOT', owner: 'stump', reach: 'single', cd: 2, fx: 'sway | leaf rise | drip self', text: 'Hits for 55% ATK. After 2 turns: heals 40% of the damage taken in them.',
  run(c) { c.hit(c.tgt, { atk: 0.55 }); c.u.k.zap = 0; c.mark(c.u, 'stump_zap', 1, 2); } });
defMove({ id: 'stubborn', name: 'Stump Butt', type: 'STONE', owner: 'stump', reach: 'single', cd: 3, fx: 'lunge big | pebble line | quake',
  text: 'Hits for 98% ATK + 25% of its missing HP. Unstoppable 1.',
  run(c) { c.hit(c.tgt, { atk: 0.98, flat: (c.u.maxHp - c.u.hp) * 0.25 }); c.st(c.u, 'unstop', 1); } });
defMove({ id: 'heartwood', name: 'New Growth', type: 'ROOT', owner: 'stump', reach: 'self', cd: 6, nerve: 4,
  fx: 'swell | leaf*5 rise | bloom ring tint self big', text: 'Max HP +15% for the battle. Regen 3. Haste 2.',
  run(c) { const add = Math.round(c.u.st.hp * 0.15); c.u.maxHp += add; c.heal(c.u, add); c.st(c.u, 'regen', 3, 0.06); c.st(c.u, 'haste', 2); } });

// puffball: a field puffball on a short stalk that goes off when stepped on and gets spores into everything, tea included.
defMark({ id: 'puffball_quick', name: 'rolling', clock: 'own', volatile: true, value: 0.04,
  afterTake(b, f, src, dealt, d) { if (d.move) { delete f.s.haste; unmark(f, 'puffball_quick'); } } });
defPassive({ id: 'spores', name: 'Spore Cloud', owner: 'puffball', text: 'Attacks add Poison 1. Its hits spore the foe\'s last move 3 turns. Caps deal 1.5x.',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'poison', 1); },
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.ko || t.side === f.side) return;
    const i = (t.k.lastMove || 0) - 1;
    if (i >= 0) sporeMove(b, t, i, 3);
  } });
defPassive({ id: 'camouflage', name: 'Lies Low', owner: 'puffball', text: 'When it guards: Ward 1.',
  afterGuard(b, f) { applyStatus(b, f, f, 'ward', 1); } });
defMove({ id: 'toxicpuff', name: 'Eye Dust', type: 'ROOT', owner: 'puffball', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | sand*3 line | daze',
  text: 'Hits for 146% MGK. Weaken 1. Spores the foe\'s crest for 3 turns.',
  run(c) { c.hit(c.tgt, { mgk: 1.46 }); if (c.tgt.ko) return; c.st(c.tgt, 'weaken', 1); sporeMove(c.b, c.tgt, 3, 3); } });
defMove({ id: 'setcap', name: 'Plant a Cap', type: 'TIDE', owner: 'puffball', reach: 'side', tags: ['spell'], cd: 2, fx: 'stomp | sand*2 arc | puff',
  text: 'Hits for 50% MGK. Sets a Cap, up to 3. The next foe out: 90% MGK, Poison 2.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.5 });
    const side = c.them === c.b.s[0] ? 0 : 1;
    c.them.caps = Math.min(3, c.them.caps + 1);
    sk(c.b, side).capMgk = stat(c.b, c.u, 'mgk') * (has(c.u, 'spores') ? 1.5 : 1);
    c.msg(`Their side has ${c.them.caps} caps.`);
  } });
defMove({ id: 'dust', name: 'Roll Away', type: 'ROOT', owner: 'puffball', reach: 'self', cd: 4, wt: 50, fx: 'spin | sand*2 return | puff self', text: 'Haste 3. It ends when a move hits it.',
  run(c) { c.st(c.u, 'haste', 3); c.mark(c.u, 'puffball_quick', 1, 3); } });
defMove({ id: 'fairyring', name: 'Ring of Caps', type: 'ROOT', owner: 'puffball', reach: 'side', tags: ['spell'], cd: 5, nerve: 4,
  fx: 'stomp big | sand*5 orbit | puff bloom jolt all', text: 'Sets 3 Caps on their side. Poison 2.',
  run(c) { const side = c.them === c.b.s[0] ? 0 : 1; c.them.caps = 3; sk(c.b, side).capMgk = stat(c.b, c.u, 'mgk') * (has(c.u, 'spores') ? 1.5 : 1); c.st(c.tgt, 'poison', 2); c.msg('A ring of caps rises up.'); } });

// bramble: a briar off the mill hedge that hooks, holds, bleeds things slow, and tears free all at once.
defPassive({ id: 'briar', name: 'Hooked Thorns', owner: 'bramble', text: 'Its hits add Bleed 1, 12% ATK a turn per stack. A foe at Bleed 5: it gets Empower 2.',
  afterDeal(b, f, t, dealt, d) {
    if (d.reserve || d.dot || t.ko || t.side === f.side) return;
    applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.12);
    if ((t.s.bleed?.n || 0) >= 5) applyStatus(b, f, f, 'empower', 2);
  } });
defMark({ id: 'bramble_hold', name: 'held fast', clock: 'own', volatile: true, negative: true, value: -0.08,
  forbid(b, f, what) { return what === 'switch' ? 'Held fast.' : null; } });
defPassive({ id: 'feed', name: 'Holds Fast', owner: 'bramble', text: 'Heals 20% of its damage to Bleeding foes. One at 3+ Bleed can\'t switch next turn.',
  afterDeal(b, f, t, dealt, d) {
    if (d.reserve || t.side === f.side) return;
    if (t.s.bleed) heal(b, f, f, dealt * 0.2);
    if (!t.ko && (t.s.bleed?.n || 0) >= 3) mark(b, f, t, 'bramble_hold', 1, 1);
  } });
defMove({ id: 'lash', name: 'Briar Sweep', type: 'ROOT', owner: 'bramble', reach: 'spread', cd: 1, splash: 0.35, fx: 'spin | thorn*5 sweep | slash all', text: 'Hits for 59% ATK. Splash 35%. Heals 4% of its max HP per Bleeding foe.',
  run(c) { c.spread({ atk: 0.59 }); const n = standing(c.them).filter(e => e.s.bleed).length; c.heal(c.u, c.u.maxHp * 0.04 * n); } });
defMove({ id: 'creep', name: 'Snag Cane', type: 'GEAR', owner: 'bramble', reach: 'single', cd: 2, fx: 'lunge | thorn*2 line | slash',
  text: 'Hits for 77% ATK. Slow 2. Bleed 2.',
  run(c) { c.hit(c.tgt, { atk: 0.77 }); if (c.tgt.ko) return; c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'ripout', name: 'Reel In', type: 'ROOT', owner: 'bramble', reach: 'dragin', cd: 4, fx: 'sway | thorn line | claw', text: 'Drags in a reserve. Hits it for 81% ATK. Root 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 0.81 }); c.st(t, 'root', 1); } });
defMove({ id: 'thornwall', name: 'Tear Free', type: 'ROOT', owner: 'bramble', reach: 'single', cd: 5, nerve: 4,
  fx: 'flare | thorn*6 converge | slash bloom tint big', text: 'True damage: 82% ATK + 20% per Bleed. A KO resets its cooldown.',
  run(c) {
    const n = c.tgt.s.bleed?.n || 0;
    c.hit(c.tgt, { atk: 0.82 + 0.2 * n }, { kind: 'T' });
    if (c.tgt.ko) { const i = c.u.moves.indexOf('thornwall'); if (i >= 0) c.u.cd[i] = 0; c.msg(`${label(c.b, c.u)} breaks free.`); }
  } });

// hemlock: a hemlock in a cracked cup off the tide line that doses foes, sends them to sleep, and pours the last of itself into a friend.
defPassive({ id: 'cup', name: 'Bitter End', owner: 'hemlock', text: 'Deals 1.3x damage to foes below 40% HP.',
  outMul(b, f, t) { return t.hp < t.maxHp * 0.4 ? 1.3 : 1; } });
defPassive({ id: 'tincture', name: 'Deep Sleep', owner: 'hemlock', text: 'Deals 1.6x damage to a sleeping foe.',
  outMul(b, f, t) { return t.s.sleep ? 1.6 : 1; } });
defMove({ id: 'dose', name: 'Bitter Dose', type: 'ROOT', owner: 'hemlock', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | drop*2 line | drip', text: 'Hits for 127% MGK. Poison 2. Heals 25% of the damage dealt.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.27 }); c.st(c.tgt, 'poison', 2); c.heal(c.u, d * 0.25); } });
defMove({ id: 'draught', name: 'Sleeping Cup', type: 'ROOT', owner: 'hemlock', reach: 'single', cd: 4, fx: 'sway | bubble arc | daze', text: 'Sleep 2. Damage wakes the foe.',
  run(c) { c.st(c.tgt, 'sleep', 2); } });
defMove({ id: 'wilt', name: 'Spilled Cup', type: 'TIDE', owner: 'hemlock', reach: 'spread', tags: ['spell'], cd: 3, splash: 0.35, fx: 'sink | drop*5 sweep | drip all',
  text: 'Hits for 79% MGK. Splash 35%. Rot 2 on every foe. Heals 8% max HP.',
  run(c) { c.spread({ mgk: 0.79 }); for (const e of standing(c.them)) c.st(e, 'rot', 2); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'lastcup', name: 'Pour Out', type: 'ROOT', owner: 'hemlock', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true,
  fx: 'swell big | drop*3 return | bloom ring tint ally', text: 'Switches to an ally: heals it 20% of max HP. Empower 2. Fortify 2.',
  run(c) { const a = c.ally!; c.heal(a, a.maxHp * 0.2); c.st(a, 'empower', 2); c.st(a, 'fortify', 2); } });
