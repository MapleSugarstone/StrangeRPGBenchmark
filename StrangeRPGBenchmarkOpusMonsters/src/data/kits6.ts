import {
  addNerve, applyStatus, banish, turnStatuses, setLowWater, lendPassive, passivesOf, starFall, keepMoment, returnToMoment, swapRooms, castMove, shiftCd, pinkTide, pinkOf, clearPink, knockDown, requestRewind, castBest, spendMove, cameOutSince, cameInForced, canSwitch, cleanse, clearForm, dealDamage, delayFighter, disguise, dismiss, doSwitch, emit, foeOf,
  forbidden, forceAction, giveShield, has, hastenFighter, heal, hitSummon, interrupt, isOut, label, mark, marked, markedBy, msg, negatives,
  nextInLine, NERVE_MAX, reserves, roundOf, runMove, setForm, setMove, sk, standing, stat, summon, summonsOf, summonTwin, takeOver, unmark,
} from '../battle/engine';
import type { Battle, Fighter, SpriteData, StatusId, Summon } from '../battle/model';
import { defMark, defMove, defNotion, defPassive, defSummon, MOVES, type Ctx, type DmgInfo, type MoveDef } from '../battle/registry';
import { TYPES, typeMult, type Type } from './types';

const dot = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
const live = (t: Fighter | null | undefined): t is Fighter => !!t && !t.ko && !t.gone;
const isMove = (w: unknown): w is MoveDef => typeof w === 'object' && w !== null;
const under = (t: Fighter, p: number) => t.hp < t.maxHp * p;
const enemyOf = (f: Fighter, src: Fighter | null): src is Fighter => !!src && src.side !== f.side;
const slotOf = (f: Fighter, id: string) => f.moves.indexOf(id);
const otherSide = (f: Fighter) => (1 - f.side) as 0 | 1;
const basicStat = (b: Battle, f: Fighter) => stat(b, f, f.mon.basic === 'P' ? 'atk' : 'mgk');
const onCooldown = (t: Fighter) => t.cd.filter(x => x > 0).length;
const GOOD: StatusId[] = ['fortify', 'empower', 'haste', 'ward', 'regen', 'thorns', 'unstop'];

/** A hit from a passive or mark: typed and mitigated like a move, outside any move. */
function strike(b: Battle, src: Fighter | null, t: Fighter, raw: number, kind: 'P' | 'M' | 'T', type: Type | null): number {
  if (!live(t) || raw <= 0) return 0;
  return dealDamage(b, src, t, raw, { kind, move: null, attack: false, dot: false, spread: false, reserve: !isOut(b, t) }, kind === 'T' ? null : type);
}
/** Hits the out fighter of a side and splashes its reserves, from outside a move. */
function strikeSide(b: Battle, src: Fighter | null, side: 0 | 1, raw: number, kind: 'P' | 'M' | 'T', type: Type | null): void {
  const s = b.s[side];
  strike(b, src, s.f[s.out], raw, kind, type);
  for (const r of reserves(s)) strike(b, src, r, raw * 0.35, kind, type);
}
/** Stun applied at a turn start: it costs exactly the turn it lands on. */
function stunNow(b: Battle, src: Fighter | null, t: Fighter): void {
  if (applyStatus(b, src, t, 'stun', 1) && t.s.stun) t.s.stun.src = -1;
}
/** Pays HP for an effect without ever dropping below 1. */
function selfCost(b: Battle, f: Fighter, amt: number): void {
  const a = Math.min(Math.round(amt), f.hp - 1);
  if (a > 0) dealDamage(b, null, f, a, dot('T'), null);
}
/** Tells the battle screen to redraw HP that changed outside a hit or a heal. */
function syncHp(b: Battle, f: Fighter): void {
  emit(b, { e: 'heal', side: f.side, idx: f.idx, amt: 0 });
}
/** Runs a used move again at lower power, damage only. */
function playBack(b: Battle, f: Fighter, m: MoveDef, power: number): void {
  const i = slotOf(f, m.id);
  if (i < 0 || m.nerve || (m.reach !== 'single' && m.reach !== 'spread')) return;
  if (!isOut(b, f) || !live(foeOf(b, f))) return;
  msg(b, `${label(b, f)} plays ${m.name} back.`);
  runMove(b, f, i, {}, false, power);
}
/** The fighter that placed a mark on f, null if it is gone, or false when the mark itself is gone. */
function placer(b: Battle, f: Fighter, id: string): Fighter | null | false {
  const mk = f.m[id];
  return mk ? markedBy(b, mk) : false;
}
function setStacks(b: Battle, f: Fighter, id: string, n: number): void {
  unmark(f, id);
  if (n > 0) mark(b, f, f, id, n, -1);
}

const foe = (b: Battle, f: Fighter): Fighter | null => { const t = foeOf(b, f); return live(t) ? t : null; };
const outOf = (b: Battle, f: Fighter): Fighter => b.s[f.side].f[b.s[f.side].out];
const ownerOf = (b: Battle, s: Summon): Fighter | null => { const f = b.s[s.side].f[s.by]; return f && !f.ko ? f : null; };
const foeOut = (b: Battle, s: Summon): Fighter | null => { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; return live(t) ? t : null; };
function ready(f: Fighter, id: string): void { const i = f.moves.indexOf(id); if (i >= 0) f.cd[i] = 0; }
/** The out foe in full, each foe reserve at the spread share, from outside a move. */
function splash(b: Battle, u: Fighter, raw: number, kind: 'P' | 'M', type: Type | null): number {
  const them = b.s[1 - u.side];
  const t = them.f[them.out];
  let dealt = 0;
  if (live(t)) dealt = dealDamage(b, u, t, raw, { kind, move: null, attack: false, dot: false, spread: true, reserve: false }, type);
  for (const r of reserves(them)) dealDamage(b, u, r, raw * 0.35, { kind, move: null, attack: false, dot: false, spread: true, reserve: true }, type);
  return dealt;
}

// ================================================================ the Low Line

// laminaria: kelp off the Low Line whose Kelp Arms slap with every move it makes, and which lies down for a newcomer out of manners.
defSummon({ id: 'laminaria_tentacle', name: 'Kelp Arm', owner: 'laminaria', text: 'Hits the foe for 30% ATK when Konleva uses a damaging move, and heals Konleva 2%. 6 turns.', every: 100,
  sprite: { px: ['..2.....', '..22....', '...22...', '..2232..', '...22...', '..222...', '..4444..', '.444444.'], c: ['#726230', '#dea734', '#49392f'] },
  act() { /* an arm slams only with Laminaria */ } });
const arms = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'laminaria_tentacle');
function slam(b: Battle, f: Fighter, t: Fighter, share: number): void {
  for (const a of arms(b, f)) { if (!live(t)) return; strike(b, f, t, stat(b, f, 'atk') * share, 'P', 'ROOT'); if (live(f)) heal(b, f, f, f.maxHp * 0.02); void a; }
}
defMark({ id: 'laminaria_spirit', name: 'held', clock: 'own', negative: true, value: -0.12,
  turnStart(b, f) { const mk = f.m.laminaria_spirit; const by = mk ? markedBy(b, mk) : null; if (by && live(by)) slam(b, by, f, 0.3); } });
defPassive({ id: 'laminaria_standsup', name: 'Stands Up', owner: 'laminaria', text: 'Every 3rd turn: summons a Kelp Arm (8% max HP, 6 turns), up to 3.',
  turnStart(b, f) { f.k.armT = (f.k.armT || 0) + 1; if (f.k.armT % 3 === 0 && arms(b, f).length < 3) summon(b, f, 'laminaria_tentacle', { hp: 0.08, turns: 6 }); },
  afterMove(b, f) { const t = foe(b, f); if (t && f.k.dealt) slam(b, f, t, 0.3); } });
defPassive({ id: 'laminaria_undertide', name: 'Out of Manners', owner: 'laminaria', text: 'When a foe comes out: it lies down, and that foe\'s first hit on it deals 0.6x.',
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f)) f.k.manners = who.side * 8 + who.idx + 1; },
  inMul(b, f, src, d) { return src && !d.dot && f.k.manners === src.side * 8 + src.idx + 1 ? 0.6 : 1; },
  afterTake(b, f, src, dealt, d) { if (src && !d.dot && f.k.manners === src.side * 8 + src.idx + 1) f.k.manners = 0; } });
defMove({ id: 'laminaria_frond', name: 'Frond Slap', type: 'ROOT', owner: 'laminaria', reach: 'single', cd: 1, fx: 'sway | kelp*2 arc | slash',
  text: 'Hits for 85% ATK. Slow 1. Summons a Kelp Arm if it has none.',
  run(c) { if (!arms(c.b, c.u).length) summon(c.b, c.u, 'laminaria_tentacle', { hp: 0.08, turns: 6 }); c.hit(c.tgt, { atk: 0.85 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'laminaria_sway', name: 'Blade Sway', type: 'TIDE', owner: 'laminaria', reach: 'single', cd: 3, fx: 'sway | kelp*3 sweep | splash', text: 'Hits for 75% ATK. Each Kelp Arm hits for 35% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); if (!c.tgt.ko) slam(c.b, c.u, c.tgt, 0.35); } });
defMove({ id: 'laminaria_shed', name: 'Shed Water', type: 'ROOT', owner: 'laminaria', reach: 'single', cd: 4, fx: 'shake | drop*3 rain | drip', text: 'Hits for 42% ATK. Held 3 turns: each Kelp Arm hits it at its turns, 30% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.42 }); if (!c.tgt.ko) c.mark(c.tgt, 'laminaria_spirit', 1, 3); } });
defMove({ id: 'laminaria_ebbblade', name: 'Ebb Blade', type: 'ROOT', owner: 'laminaria', reach: 'spread', tags: ['dash'], cd: 6, nerve: 5, fx: 'lunge | kelp*5 sweep | slash bloom jolt all big',
  text: 'Hits for 85% ATK. Splash 35%. Slow 1. Summons 3 Kelp Arms.',
  run(c) { c.spread({ atk: 0.85 }); c.st(c.tgt, 'slow', 1); for (let i = 0; i < 3; i++) summon(c.b, c.u, 'laminaria_tentacle', { hp: 0.08, turns: 6 }); } });

// eelgrass: a sea meadow with a face that tangles the feet of a foe that steps on it, so it acts last, and lulls the dusted to sleep.
defMark({ id: 'eelgrass_tangled', name: 'tangled', clock: 'own', negative: true, volatile: true, value: -0.12,
  order() { return -1; } });
defMark({ id: 'eelgrass_dust', name: 'dream dust', clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.eelgrass_dust; const by = mk ? markedBy(b, mk) : null; dealDamage(b, by && live(by) ? by : null, f, f.maxHp * 0.03, dot('M'), null); } });
defMark({ id: 'eelgrass_drowsy', name: 'drowsy', clock: 'own', negative: true, value: -0.15,
  expire(b, f, mk) { applyStatus(b, markedBy(b, mk), f, 'sleep', 2); } });
defPassive({ id: 'eelgrass_flat', name: 'Lies Flat', owner: 'eelgrass', text: 'Its hits add Dream Dust: 3% of max HP a turn for 3 turns.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side && !t.ko) mark(b, f, t, 'eelgrass_dust', 1, 3); } });
defPassive({ id: 'eelgrass_bed', name: 'Meadow Bed', owner: 'eelgrass', text: 'Attackers get Slow 1. When a dash hits it: the attacker\'s moves are Late for 2 turns.',
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src.side !== f.side && !src.ko) applyStatus(b, f, src, 'slow', 1); if (enemyOf(f, src) && !src.ko && d.move?.tags?.includes('dash')) mark(b, f, src, 'eelgrass_tangled', 1, 2); } });
defMove({ id: 'eelgrass_comb', name: 'Comb Through', type: 'ROOT', owner: 'eelgrass', reach: 'spread', tags: ['spell'], cd: 1, fx: 'sway | kelp*4 sweep | puff all', text: 'Hits for 55% MGK. Splash 35%. Heals 15% of it. Haste 1.',
  run(c) { const d = c.spread({ mgk: 0.55 }); c.heal(c.u, d * 0.15); c.st(c.u, 'haste', 1); } });
defMove({ id: 'eelgrass_sway', name: 'Sway Over', type: 'ROOT', owner: 'eelgrass', reach: 'single', tags: ['dash', 'spell'], cd: 3, wu: 40, fx: 'sway | kelp*3 wave | bloom',
  text: 'Short wind-up. Hits for 110% MGK. The foe\'s moves are Late for 2 turns.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); if (!c.tgt.ko) c.mark(c.tgt, 'eelgrass_tangled', 1, 2); } });
defMove({ id: 'eelgrass_mend', name: 'Meadow Seed', type: 'TIDE', owner: 'eelgrass', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | drop*2 arc | splash',
  text: 'Hits for 70% MGK. Slow 2. The first reserve takes 40% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'slow', 2); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.7 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'eelgrass_farreach', name: 'Lull Over', type: 'ROOT', owner: 'eelgrass', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'sway big | petal*5 rain | daze bloom tint all',
  text: 'Hits for 60% MGK. Splash 35%. Slow 2. Each with Dream Dust sleeps 2 after its next turn.',
  run(c) { c.spread({ mgk: 0.6 }); c.st(c.tgt, 'slow', 2); for (const e of standing(c.them)) if (marked(e, 'eelgrass_dust')) c.mark(e, 'eelgrass_drowsy', 1, 1); } });

// grenadier: a deep fish with both eyes on top of its head that haunts what it sees and lures a foe up so it hesitates.
defMark({ id: 'grenadier_lured', name: 'lured', clock: 'own', negative: true, volatile: true, value: -0.12,
  order() { return -1; } });
defMark({ id: 'grenadier_haunt', name: 'haunted', clock: 'own', negative: true, volatile: true, value: -0.08 });
defPassive({ id: 'grenadier_scent', name: 'Deep Scent', owner: 'grenadier', text: 'Deals 1.25x damage to a Haunted foe.',
  outMul(b, f, t) { return marked(t, 'grenadier_haunt') ? 1.25 : 1; } });
defPassive({ id: 'grenadier_surface', name: 'Up From Deep', owner: 'grenadier', text: 'When a foe is KO\'d while it is out: heals 12% of its max HP.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) heal(b, f, f, f.maxHp * 0.12); } });
defMove({ id: 'grenadier_bite', name: 'Long Bite', type: 'BEAST', owner: 'grenadier', reach: 'single', cd: 1, fx: 'lunge | fang*2 converge | bite',
  text: 'Hits for 149% ATK. Slow 1 on a Haunted foe.',
  run(c) { c.hit(c.tgt, { atk: 1.49 }); if (marked(c.tgt, 'grenadier_haunt')) c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'grenadier_rake', name: 'Deep Rake', type: 'BEAST', owner: 'grenadier', reach: 'single', tags: ['projectile'], cd: 3, fx: 'flare | bone*2 line | claw', text: 'Hits for 109% ATK. Expose 1. Haunted for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.09 }); c.st(c.tgt, 'expose', 1); if (!c.tgt.ko) c.mark(c.tgt, 'grenadier_haunt', 1, 3); } });
defMove({ id: 'grenadier_lure', name: 'Lure Up', type: 'TIDE', owner: 'grenadier', reach: 'single', cd: 4, fx: 'sink | drop*3 rise | splash',
  text: 'Hits for 85% ATK. Root 2. Silence 1. The foe\'s moves are Late for 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'silence', 1); if (!c.tgt.ko) c.mark(c.tgt, 'grenadier_lured', 1, 2); } });
defMove({ id: 'grenadier_drop', name: 'Pressure Drop', type: 'BEAST', owner: 'grenadier', reach: 'spread', cd: 6, nerve: 5, fx: 'sink big | orb*5 rain | quake all dark', text: 'Hits for 136% ATK. Splash 35%. Every foe: Haunted 3 turns and Rot 2.',
  run(c) { c.spread({ atk: 1.36 }); for (const e of standing(c.them)) { c.mark(e, 'grenadier_haunt', 1, 3); c.st(e, 'rot', 2); } } });

// asterias: a starfish that says it fell from the sky and proves it with a volley from every Arm it has, and grows lost Arms back.
/** Arms it has now, five to start. A mark mirrors the count in the battle readout. */
const armsOf = (f: Fighter) => f.k.arms ?? 5;
function setArms(b: Battle, f: Fighter, n: number): void {
  f.k.arms = Math.max(0, Math.min(5, n));
  setStacks(b, f, 'asterias_armcount', f.k.arms);
}
defMark({ id: 'asterias_armcount', name: 'arms', max: 5, clock: 'own', value: 0.02 });
defMark({ id: 'asterias_legend', name: 'locked on', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { unmark(f, 'asterias_legend'); const t = foe(b, f); for (let i = 0; i < 4 && t && live(t); i++) strike(b, f, t, stat(b, f, 'mgk') * 0.3, 'M', 'STAR'); } });
defPassive({ id: 'asterias_arms', name: 'Many Arms', owner: 'asterias', text: 'Its turns come 10% sooner. Its Attack fires a 25% MGK shot per Arm. It starts with 5 Arms.',
  start(b, f) { setArms(b, f, 5); },
  turnEnd(b, f) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); },
  volley(b, f) { return { hits: armsOf(f), per: 0.25 }; } });
defPassive({ id: 'asterias_regrow', name: 'Regrows Arms', owner: 'asterias', text: 'A hit of 15% max HP knocks off an Arm. Every 3rd turn: an Arm grows back and it heals 8%.',
  afterTake(b, f, src, dealt, d) { if (d.dot || dealt < f.maxHp * 0.15 || armsOf(f) <= 0 || f.ko) return; setArms(b, f, armsOf(f) - 1); msg(b, `An arm comes off ${label(b, f)}.`); },
  turnStart(b, f) { f.k.regrow = (f.k.regrow || 0) + 1; if (f.k.regrow % 3 === 0) { if (armsOf(f) < 5) setArms(b, f, armsOf(f) + 1); heal(b, f, f, f.maxHp * 0.08); } } });
defMove({ id: 'asterias_barrage', name: 'Arm Barrage', type: 'STAR', owner: 'asterias', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | star*2 line | sparkle', text: 'Hits 2 times for 57% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.57 }); if (!c.tgt.ko) c.hit(c.tgt, { mgk: 0.57 }); } });
defMove({ id: 'asterias_five', name: 'Point Five', type: 'STAR', owner: 'asterias', reach: 'spread', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | star*5 sweep | sparkle all',
  text: 'Hits for 11% MGK per Arm. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.11 * Math.max(1, armsOf(c.u)) }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'asterias_homing', name: 'Fallen Star', type: 'STONE', owner: 'asterias', reach: 'single', tags: ['projectile'], cd: 4, fx: 'lift | pebble*3 rain | crack',
  text: 'Hits for 59% MGK. An Arm grows back. Hidden 1. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.59 }); setArms(c.b, c.u, armsOf(c.u) + 1); c.st(c.u, 'hidden', 1); c.hasten(c.u, 30); } });
defMove({ id: 'asterias_skydrop', name: 'Falling Arms', type: 'STAR', owner: 'asterias', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 5, fx: 'lift | star*8 rain | sparkle pillar glare big', text: 'Hits 4 times for 31% MGK, and 4 more at its next turn.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.31 }); c.mark(c.u, 'asterias_legend', 1, 2); } });

// cirrus: one arm off a nautilus that kept reaching and holds on to whatever it finds, so a foe it grabs cannot get away.
defMark({ id: 'cirrus_box', name: 'wrapped up', clock: 'own', volatile: true, negative: true, value: -0.15,
  forbid(b, f, what) { return what === 'switch' ? 'Boxed in.' : null; } });
defPassive({ id: 'cirrus_suckers', name: 'Suckers', owner: 'cirrus', text: 'When a foe is KO\'d, and every 3rd hit: a Grip, max 10. +2% DEF and MGK each.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.souls = Math.min(10, (f.k.souls || 0) + 1); },
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; f.k.reap = (f.k.reap || 0) + 1; if (f.k.reap % 3 === 0) f.k.souls = Math.min(10, (f.k.souls || 0) + 1); },
  statBonus(f, k) { return k === 'def' || k === 'mgk' ? Math.round(f.st[k] * 0.02 * (f.k.souls || 0)) : 0; } });
defPassive({ id: 'cirrus_reaching', name: 'Keeps Reaching', owner: 'cirrus', text: 'Deals 1.2x to a Rooted foe. Its Attack holds on: the foe can\'t switch at its next turn.',
  afterAttack(b, f, t) { if (live(t)) mark(b, f, t, 'cirrus_box', 1, 1); },
  outMul(b, f, t) { return t.s.root ? 1.2 : 1; } });
defMove({ id: 'cirrus_slap', name: 'Sucker Slap', type: 'BEAST', owner: 'cirrus', reach: 'single', cd: 1, fx: 'lunge | bite',
  text: 'Hits for 151% ATK. Delays the foe\'s next turn by 30%.',
  run(c) { c.hit(c.tgt, { atk: 1.51 }); c.delay(c.tgt, 30); } });
defMove({ id: 'cirrus_cling', name: 'Cling On', type: 'BEAST', owner: 'cirrus', reach: 'reserveAlly', cd: 4, tag: true, fx: 'hop | ring ally', text: 'Switches to an ally with a shield of 31% max HP + 31% CHA.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.31 + c.cha(0.31), 3); } });
defMove({ id: 'cirrus_reach', name: 'Long Reach', type: 'TIDE', owner: 'cirrus', reach: 'dragin', tags: ['projectile'], cd: 3, fx: 'lunge | kelp line | claw', text: 'Drags in a reserve. Hits it for 218% ATK. Root 2.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 2.18 }); c.st(t, 'root', 2); } });
defMove({ id: 'cirrus_wrap', name: 'Wrap Around', type: 'BEAST', owner: 'cirrus', reach: 'single', cd: 6, nerve: 5, fx: 'spin | kelp*4 orbit | claw bite jolt big',
  text: 'Hits for 173% ATK. Slow 2. The foe can\'t switch for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.73 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'cirrus_box', 1, 3); } });

// hyponome: the jet a nautilus breathes out, which rides a shell of its own and breathes everything away from it.
defSummon({ id: 'hyponome_mech', name: 'Jet Shell', owner: 'hyponome', sprite: { px: ['........', '..2222..', '.222222.', '22.33.22', '22333322', '22222222', '444..444', '.44..44.'], c: ['#ebe3db', '#96c6dd', '#4a78a7'] }, text: 'Takes single-target hits meant for Puhalki. When a hit breaks it, the rest of the damage goes to Puhalki, and Puhalki gets Haste 2.', guard: true, spill: true, lasting: false,
  gone(b, s, f) { if (!f || f.ko || f.k.stowing) return; if (s.hp <= 0) { msg(b, `${label(b, f)} is thrown clear of its shell.`); f.k.shellBroke = 1; applyStatus(b, f, f, 'haste', 2); } } });
const inMech = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'hyponome_mech').length > 0;
defMark({ id: 'hyponome_matrix', name: 'breathing out', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('projectile')) return null; unmark(f, 'hyponome_matrix'); return 'block'; } });
defPassive({ id: 'hyponome_ebbpull', name: 'Ebb Pull', owner: 'hyponome', text: 'Comes out riding a Jet Shell (25% max HP), one per side. A broken shell stays broken.',
  comeOut(b, f) { if (!f.k.shellLeft && f.k.shellLeft !== undefined) return; const s = sk(b, f.side); if (s.shellBy && s.shellBy !== f.mon.uid + 1) return; s.shellBy = f.mon.uid + 1; summon(b, f, 'hyponome_mech', { hp: f.k.shellLeft ? f.k.shellLeft / 100 : 0.25 }); },
  leave(b, f) { const m = summonsOf(b, f.side, 'hyponome_mech')[0]; f.k.shellLeft = m ? Math.max(1, Math.round(100 * m.hp / f.maxHp)) : 0; f.k.stowing = 1; if (m) dismiss(b, m); f.k.stowing = 0; } });
// Only a whorl whose own Jet Shell broke or burst breathes freely, so a fusion that keeps this without the shell gets nothing.
const breathing = (b: Battle, f: Fighter) => !!f.k.shellBroke && !inMech(b, f);
defPassive({ id: 'hyponome_breath', name: 'Jet Breath', owner: 'hyponome', text: 'After its Jet Shell breaks, with no shell: deals 1.2x damage and its turns come 10% sooner.',
  outMul(b, f) { return breathing(b, f) ? 1.2 : 1; },
  turnEnd(b, f) { if (breathing(b, f)) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); } } });
defMove({ id: 'hyponome_squirt', name: 'Squirt', type: 'TIDE', owner: 'hyponome', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | drop*3 line fast | splash', text: 'Hits 3 times for 40% MGK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.4 }); } });
defMove({ id: 'hyponome_pushoff', name: 'Push Off', type: 'GEAR', owner: 'hyponome', reach: 'single', tags: ['dash', 'spell'], cd: 4, fx: 'lunge | drop*2 line | burst', text: 'Hits for 83% MGK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { mgk: 0.83 }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'hyponome_exhale', name: 'Exhale', type: 'TIDE', owner: 'hyponome', reach: 'self', cd: 3, wt: 50, fx: 'swell | ring self', text: 'Blocks the next projectile move at its side before its next turn.',
  run(c) { c.mark(c.u, 'hyponome_matrix', 1, 2); } });
defMove({ id: 'hyponome_jet', name: 'Full Jet', type: 'TIDE', owner: 'hyponome', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 60, fx: 'swell | drop*6 sweep | splash ring tint all big', text: 'Wind-up. Bursts its Jet Shell: 110% to 190% MGK. Splash 35%. No shell: grows a new one.',
  run(c) {
    const m = summonsOf(c.b, c.u.side, 'hyponome_mech')[0];
    if (!m) { summon(c.b, c.u, 'hyponome_mech', { hp: 0.25 }); c.msg(`${label(c.b, c.u)} grows a new shell.`); return; }
    const p = m.hp / m.maxHp;
    c.u.k.stowing = 1; dismiss(c.b, m); c.u.k.stowing = 0;
    c.u.k.shellBroke = 1;
    c.spread({ mgk: 1.1 + 0.8 * p });
  } });

// slackwater: the still minute between tides, which turns the battle back three turns and plays it forward again from a changed moment.
defMark({ id: 'slackwater_back', name: 'holding still', clock: 'own', volatile: true, value: 0.1,
  beforeTake(b, f, src, amt, d) { if (d.dot || !src || src.side === f.side) return amt; unmark(f, 'slackwater_back'); msg(b, `${label(b, f)} was never there.`); return 0; } });
defMark({ id: 'slackwater_dilate', name: 'slackened', clock: 'own', negative: true, volatile: true, value: -0.1,
  cooldown(b, f, m, cd) { return cd + 1; } });
defPassive({ id: 'slackwater_turn', name: 'Turn of Tide', owner: 'slackwater', text: 'Every 4th hit it lands: also hits for 65% MGK and delays the foe\'s next turn by 40%.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || f.k.locking) return; f.k.lock = (f.k.lock || 0) + 1; if (f.k.lock % 4 !== 0) return; f.k.locking = 1; strike(b, f, t, stat(b, f, 'mgk') * 0.65, 'M', 'TIDE'); if (live(t)) delayFighter(b, t, 40); f.k.locking = 0; },
  afterTake(b, f, src, dealt, d) { f.k.lastHurt = (f.k.lastHurtAt === b.turnNo || f.k.lastHurtAt === b.turnNo - 1 ? f.k.lastHurt || 0 : 0) + dealt; f.k.lastHurtAt = b.turnNo; } });
defPassive({ id: 'slackwater_unhurried', name: 'Unhurried', owner: 'slackwater', text: 'Cannot be delayed or Slowed.',
  noDelay() { return true; },
  statusImmune(f, id) { return id === 'slow'; },
  forbid(b, f, what) { return isMove(what) && what.id === 'slackwater_minute' && f.k.rewound ? 'The tide has turned once.' : null; } });
defMove({ id: 'slackwater_lap', name: 'Still Lap', type: 'TIDE', owner: 'slackwater', reach: 'single', tags: ['dash', 'spell'], cd: 2, fx: 'sway | drop*2 return | splash', text: 'Hits for 105% MGK. Heals 50% of the damage it took in its last turn.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); if ((c.u.k.lastHurtAt || -9) >= c.b.turnNo - 2) c.heal(c.u, (c.u.k.lastHurt || 0) * 0.5); c.u.k.lastHurt = 0; } });
defMove({ id: 'slackwater_slacken', name: 'Slacken', type: 'VOID', owner: 'slackwater', reach: 'single', tags: ['spell'], cd: 3, fx: 'sink | orb*2 line slow | vortex',
  text: 'Hits for 70% MGK. Slow 2. 3 turns: the foe\'s cooldowns grow 1 more.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'slackwater_dilate', 1, 3); } });
defMove({ id: 'slackwater_hold', name: 'Hold Still', type: 'TIDE', owner: 'slackwater', reach: 'self', cd: 4, wt: 50, fx: 'blink | ring self', text: 'Blocks the next hit on it before its next turn.',
  run(c) { c.mark(c.u, 'slackwater_back', 1, 2); } });
defMove({ id: 'slackwater_minute', name: 'Still Minute', type: 'TIDE', owner: 'slackwater', reach: 'self', tags: ['spell'], cd: 7, nerve: 6, late: true, fx: 'swell big | rune*4 orbit | sigil big tint',
  next: 'slackwater_flood', once: true, rewinds: true,
  text: 'Late. Goes back 3 rounds and casts a move there. Becomes Running Tide.',
  run(c) {
    const slot = c.u.moves.indexOf('slackwater_minute');
    // Only a whorl that holds it in a slot goes back. A copy cast any other way, such as an echo or a snatch, does nothing.
    if (slot < 0) { c.msg(`Still Minute does nothing for ${label(c.b, c.u)}.`); return; }
    spendMove(c.u, 'slackwater_minute');
    if (requestRewind(c.b, c.u, 'slackwater_minute', slot)) return;
    // A copy the AI plays out has no past to go back to, so it prices the crest as its best move cast now at 1.3x.
    castBest(c.b, c.u, 1.3);
    c.u.k.rewound = 1;
  } });
defMove({ id: 'slackwater_flood', name: 'Running Tide', type: 'TIDE', owner: 'slackwater', reach: 'single', tags: ['spell'], cd: 3, extra: true, fx: 'sway | drop*3 wave fast | splash',
  text: 'Hits for 90% MGK. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); c.hasten(c.u, 20); } });

// brinicle: a finger of cold brine that froze its way down, knocks whatever is up back down, and freezes what it knocks out.
defSummon({ id: 'brinicle_thrall', name: 'Frozen Thrall', owner: 'brinicle', sprite: { px: ['........', '..2222..', '.223322.', '.224422.', '.222222.', '4.2222.4', '..2..2..', '.22..22.'], c: ['#9ea6ae', '#8ed5ff', '#354573'] }, text: 'Stays until a foe comes out. Hits it for 60% of Soryubi\'s MGK. Slow 2. Stays if Soryubi falls.', lasting: true,
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, 'A frozen thrall bursts.'); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.6, 'M', 'SALT'); if (!who.ko) applyStatus(b, f, who, 'slow', 2); return true; } });
defPassive({ id: 'brinicle_finger', name: 'Frost Finger', owner: 'brinicle', text: 'When it KOs a foe: a Frozen Thrall (10% max HP) waits for the next foe out.',
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side) summon(b, f, 'brinicle_thrall', { hp: 0.1 }); } });
defPassive({ id: 'brinicle_comfort', name: 'Points Down', owner: 'brinicle', text: 'Its hits knock foes down. Turn start: heals 4% while the foe is Slowed or Rooted.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && t.side !== f.side && t.up) knockDown(b, t); },
  turnStart(b, f) { const t = foe(b, f); if (t && (t.s.slow || t.s.root)) heal(b, f, f, f.maxHp * 0.04); } });
defMove({ id: 'brinicle_drip', name: 'Cold Drip', type: 'SALT', owner: 'brinicle', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | drop line | frost',
  text: 'Hits for 83% MGK. Slow 1. The first reserve takes 35% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.83 }); c.st(c.tgt, 'slow', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.83 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'brinicle_spray', name: 'Brine Ring', type: 'SALT', owner: 'brinicle', reach: 'spread', tags: ['spell'], cd: 3, fx: 'sway | salt*4 orbit | frost all', text: 'Hits for 59% MGK. Splash 35%. Root 1.',
  run(c) { c.spread({ mgk: 0.59 }); c.st(c.tgt, 'root', 1); } });
defMove({ id: 'brinicle_line', name: 'Freeze Line', type: 'STONE', owner: 'brinicle', reach: 'single', tags: ['spell'], cd: 3, tag: true, fx: 'stomp | shard*3 line | frost',
  text: 'Hits for 65% MGK. Root 1. Slow 1. Switches out.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); c.st(c.tgt, 'root', 1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'brinicle_floor', name: 'Sea Floor', type: 'SALT', owner: 'brinicle', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'sink | salt*5 rain | frost shatter glare big',
  text: 'Hits for 100% MGK. Stun 1. Root 2. Below 35% HP instead: heals 30%, Stasis 1, foe Slow 2.',
  run(c) {
    if (c.u.hp < c.u.maxHp * 0.35) { c.heal(c.u, c.u.maxHp * 0.3); c.st(c.u, 'stasis', 1); c.st(c.tgt, 'slow', 2); return; }
    c.hit(c.tgt, { mgk: 1.0 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 2);
  } });

// transit: the night a star crossed the moon, kept and played back, so everything it does happens twice.
defSummon({ id: 'transit_spark', name: 'Late Spark', owner: 'transit', sprite: { px: ['........', '...3....', '.3.2.3..', '..222...', '.3.2.3..', '...3....', '....4...', '........'], c: ['#dff7fe', '#4f97dd', '#2e4a88'] }, text: 'Waits a turn, then hits the foe for 210% of Yliri\'s MGK.', every: 200,
  act(b, s, f) { const t = foeOut(b, s); if (f && t) strike(b, f, t, stat(b, f, 'mgk') * 2.1, 'M', 'STAR'); } });
defSummon({ id: 'transit_double', name: 'Second Showing', owner: 'transit', text: 'A second Yliri with its own HP. On its own turns it uses Yliri\'s moves, except the crest.', every: 100,
  sprite: { px: ['3.3..3.3', '.3.22.3.', '..2222..', '.232232.', '4.2222.4', '4.2222.4', '44.22.44', '.4....4.'], c: ['#80b0df', '#c4e4f4', '#495997'] } });
defPassive({ id: 'transit_lonely', name: 'Lonely Star', owner: 'transit', text: 'Deals 1.25x damage to a foe with 1 reserve or none.',
  outMul(b, f, t) { return reserves(b.s[t.side]).length <= 1 ? 1.25 : 1; } });
defPassive({ id: 'transit_showing', name: 'First Showing', owner: 'transit', text: 'When it comes out: its first move repeats at 0.6x.',
  comeOut(b, f) { f.k.showing = 1; },
  afterMove(b, f, m) { if (!f.k.showing) return; f.k.showing = 0; playBack(b, f, m, 0.6); } });
defMove({ id: 'transit_cross', name: 'Cross Over', type: 'STAR', owner: 'transit', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | star line | sparkle',
  text: 'Hits for 172% MGK. Slow 1 on a foe with no reserves.',
  run(c) { c.hit(c.tgt, { mgk: 1.72 }); if (!reserves(c.them).length) c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'transit_late', name: 'Late Light', type: 'STAR', owner: 'transit', reach: 'side', cd: 3, fx: 'sway | star rise | sparkle self', text: 'Summons a Late Spark (12% max HP). After 1 turn it hits the foe for 210% MGK.',
  run(c) { summon(c.b, c.u, 'transit_spark', { hp: 0.12, turns: 1 }); } });
defMove({ id: 'transit_eclipse', name: 'Moon Pass', type: 'STONE', owner: 'transit', reach: 'single', tags: ['spell'], cd: 4, fx: 'lift | moon arc | flash',
  text: 'Hits for 94% MGK. 2 turns: takes 0.6x damage from attacks. Haste 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.94 }); c.mark(c.u, 'transit_field', 1, 2); c.st(c.u, 'haste', 1); } });
defMark({ id: 'transit_field', name: 'in a still field', clock: 'own', volatile: true, value: 0.1,
  inMul(b, f, src, d) { return d.attack ? 0.6 : 1; } });
defMove({ id: 'transit_double', name: 'Played Back', type: 'STAR', owner: 'transit', reach: 'side', cd: 6, nerve: 5, fx: 'swell big | star*3 orbit | ring sparkle tint ally', text: 'Summons a Second Showing (35% max HP, 3 turns). It casts all but Yliri\'s crest.',
  run(c) { summonTwin(c.b, c.u, 'transit_double', { hp: 0.35, turns: 3 }); } });

// ================================================================ the old chambers

// ballast: a sack of sinking stones that turns the blows its Barriers soak into Weight, and holds every foe down.
function charge(b: Battle, f: Fighter, amt: number): void { f.k.energy = Math.min(100, (f.k.energy || 0) + Math.round(amt / f.maxHp * 250)); }
defMark({ id: 'ballast_barrier', name: 'barrier', clock: 'own', value: 0.08,
  beforeTake(b, f, src, amt) { const mk = f.m.ballast_barrier; const by = mk ? markedBy(b, mk) : null; if (by && live(by) && f.shield > 0) charge(b, by, Math.min(amt, f.shield)); return amt; } });
defMark({ id: 'ballast_surge', name: 'in the surge', clock: 'own', volatile: true, negative: true, value: -0.15,
  forbid(b, f, what) { return what === 'switch' ? 'Held in the surge.' : null; } });
defPassive({ id: 'ballast_sinking', name: 'Sinking', owner: 'ballast', text: 'Hits on its Barriers add Weight, up to 100: +5% damage per 10. It loses 5 a turn.',
  outMul(b, f) { return 1 + 0.005 * (f.k.energy || 0); },
  turnStart(b, f) { f.k.energy = Math.max(0, (f.k.energy || 0) - 5); } });
defPassive({ id: 'ballast_ballasted', name: 'Ballasted', owner: 'ballast', text: 'Cannot be forced out, dragged in, or Slowed.',
  immovable() { return true; },
  statusImmune(f, id) { return id === 'slow'; } });
defMove({ id: 'ballast_drop', name: 'Drop Stone', type: 'GEAR', owner: 'ballast', reach: 'single', tags: ['projectile'], cd: 1, fx: 'lift | pebble arc | crack big', text: 'Hits for 182% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.82 }); } });
defMove({ id: 'ballast_storm', name: 'Storm Stone', type: 'GEAR', owner: 'ballast', reach: 'self', cd: 3, wt: 50, fx: 'stomp | ring self', text: 'A Barrier on itself: 23% max HP shield, 2 turns.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.23, 2); c.mark(c.u, 'ballast_barrier', 1, 2); } });
defMove({ id: 'ballast_room', name: 'Sink Room', type: 'STONE', owner: 'ballast', reach: 'single', cd: 3, fx: 'lift | pebble*2 rain | crack',
  text: 'Hits for 131% ATK. A Barrier on itself: 10% max HP shield, 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.31 }); c.shield(c.u, c.u.maxHp * 0.1, 2); c.mark(c.u, 'ballast_barrier', 1, 2); } });
defMove({ id: 'ballast_hold', name: 'Full Hold', type: 'GEAR', owner: 'ballast', reach: 'spread', cd: 6, nerve: 5, wu: 50, fx: 'stomp | pebble*6 rain | quake burst jolt all big',
  text: 'Wind-up. Hits for 145% ATK. Splash 35%. Knocks it down. Root 2. Slow 2. +30 Weight.',
  run(c) { c.spread({ atk: 1.45 }); if (!c.tgt.ko) knockDown(c.b, c.tgt); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 2); c.u.k.energy = Math.min(100, (c.u.k.energy || 0) + 30); } });

// sluice: a gate between two rooms that lets one side through and never says which, and swaps the rooms themselves.
defMark({ id: 'sluice_shell', name: 'charged shell', clock: 'own', value: 0.1,
  turnStart(b, f) { const mk = f.m.sluice_shell; const by = mk ? markedBy(b, mk) : null; const t = foe(b, f); if (by && live(by) && t) strike(b, by, t, stat(b, by, 'mgk') * 0.14, 'M', 'GEAR'); } });
defPassive({ id: 'sluice_oneway', name: 'One Way', owner: 'sluice', text: 'Its first hit on a foe that came out since its last turn deals 1.15x. Slow 2.',
  outMul(b, f, t, d) { return !d.dot && t.side !== f.side && t.outAt > (f.k.prevTurn ?? -1) && t.k.punchedAt !== t.outAt ? 1.15 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side && t.outAt > (f.k.prevTurn ?? -1) && t.k.punchedAt !== t.outAt) { t.k.punchedAt = t.outAt; if (!t.ko) applyStatus(b, f, t, 'slow', 2); } } });
defPassive({ id: 'sluice_floodgate', name: 'Floodgate', owner: 'sluice', text: 'When an ally comes out: it gets a Charged Shell for 1 turn.',
  anyOut(b, f, who) { if (who.side === f.side && who !== f && !who.ko) mark(b, f, who, 'sluice_shell', 1, 1); } });
defMove({ id: 'sluice_slap', name: 'Gate Slap', type: 'GEAR', owner: 'sluice', reach: 'ally', cd: 2, fx: 'flare | cog orbit | ring ally', text: 'Charged Shell (3 turns) on an ally: at each of its turns, the foe takes 14% MGK.',
  run(c) { c.mark(c.ally!, 'sluice_shell', 1, 3); } });
defMove({ id: 'sluice_backflow', name: 'Back Flow', type: 'VOID', owner: 'sluice', reach: 'dragin', tags: ['spell'], cd: 4, fx: 'sink | orb*2 return | vortex',
  text: 'Drags in a reserve. Hits it for 24% MGK. Slow 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 0.24 }); c.st(t, 'slow', 1); } });
defMove({ id: 'sluice_bolt', name: 'Gate Bolt', type: 'GEAR', owner: 'sluice', reach: 'ally', cd: 3, fx: 'swell | cog*2 line fast | ring ally', text: 'An ally: Haste 2. Its next turn comes 30% sooner.',
  run(c) { c.st(c.ally!, 'haste', 2); c.hasten(c.ally!, 30); } });
defMove({ id: 'sluice_swap', name: 'Swap Rooms', type: 'GEAR', owner: 'sluice', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'blink | hoop*2 orbit | vortex burst jolt big',
  text: 'Hits for 90% MGK. The two sides trade everything on their side of the field.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); swapRooms(c.b); } });

// septum: a wall inside the Nautilus that seals the room behind whatever walks past it.
defMark({ id: 'septum_chomped', name: 'bitten', clock: 'own', negative: true, value: -0.06,
  statBonus(f, k) { return k === 'atk' ? -Math.round(f.st.atk * 0.08) : 0; } });
defMark({ id: 'septum_fed', name: 'fed', clock: 'own', value: 0.06,
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.08) : 0; } });
defMark({ id: 'septum_domain', name: 'cold room', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { heal(b, f, f, f.maxHp * 0.04); } });
defMark({ id: 'septum_sealed', name: 'sealed in', clock: 'own', volatile: true, negative: true, value: -0.08,
  forbid(b, f, what) { return what === 'switch' ? 'Sealed in.' : null; } });
defMark({ id: 'septum_subdued', name: 'let down', clock: 'own', negative: true, value: -0.15,
  statBonus(f, k) { return k === 'def' || k === 'res' ? -Math.round(f.st[k] * 0.2) : 0; } });
defPassive({ id: 'septum_behind', name: 'Seals Behind', owner: 'septum', text: 'A foe that comes out can\'t switch for 2 turns. Heals 8% when a foe is KO\'d while it is out.',
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f) && !who.ko) mark(b, f, who, 'septum_sealed', 1, 2); },
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) heal(b, f, f, f.maxHp * 0.08); } });
defPassive({ id: 'septum_bulkhead', name: 'Bulkhead', owner: 'septum', text: 'Takes 0.8x damage from a foe that can\'t switch.',
  inMul(b, f, src) { return src && src.side !== f.side && !canSwitch(b, src) ? 0.8 : 1; } });
defMove({ id: 'septum_slam', name: 'Wall Slam', type: 'STONE', owner: 'septum', reach: 'single', cd: 1, fx: 'lunge | crack', text: 'Hits for 124% ATK. 3 turns: takes 8% of the foe\'s ATK for itself.',
  run(c) { c.hit(c.tgt, { atk: 1.24 }); if (!c.tgt.ko) { c.mark(c.tgt, 'septum_chomped', 1, 3); c.mark(c.u, 'septum_fed', 1, 3); } } });
defMove({ id: 'septum_knock', name: 'Chamber Knock', type: 'STONE', owner: 'septum', reach: 'self', cd: 3, wt: 60, fx: 'stomp | ring self', text: 'Haste 2. 3 turns: heals 4% of its max HP a turn.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.u, 'septum_domain', 1, 3); } });
defMove({ id: 'septum_seal', name: 'Seal Room', type: 'GEAR', owner: 'septum', reach: 'single', cd: 3, fx: 'lunge | cog line | crack',
  text: 'Hits for 80% ATK. Slow 2. The foe can\'t switch for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'septum_sealed', 1, 3); } });
defMove({ id: 'septum_shot', name: 'Seal Shot', type: 'STONE', owner: 'septum', reach: 'single', cd: 6, nerve: 5, fx: 'lunge | pebble*3 line | shatter crack jolt big', text: 'Hits for 118% ATK. Heals 15% max HP. The foe has 0.8x DEF and RES for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.18 }); c.heal(c.u, c.u.maxHp * 0.15); if (!c.tgt.ko) c.mark(c.tgt, 'septum_subdued', 1, 3); } });

// vacuole: air from a room sealed long ago, which keeps a whorl's moment and sends it back there later.
defMark({ id: 'vacuole_discord', name: 'thinned', clock: 'own', negative: true, value: -0.1,
  inMul() { return 1.25; } });
defMark({ id: 'vacuole_harmony', name: 'air kept', clock: 'own', value: 0.2,
  wouldKO(b, f) { if (!f.kept) return false; unmark(f, 'vacuole_harmony'); return returnToMoment(b, f); },
  expire(b, f) { f.kept = null; },
  turnStart(b, f) { heal(b, null, f, f.maxHp * 0.06); } });
defMark({ id: 'vacuole_calm', name: 'old air', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f) { returnToMoment(b, f); },
  leave(b, f) { f.kept = null; } });
defPassive({ id: 'vacuole_thin', name: 'Thin Air', owner: 'vacuole', text: 'Its attacks deal 1.25x and delay the foe\'s next turn by 15%.',
  outMul(b, f, t, d) { return d.attack ? 1.25 : 1; },
  afterAttack(b, f, t) { if (live(t)) delayFighter(b, t, 15); } });
defPassive({ id: 'vacuole_airless', name: 'Airless', owner: 'vacuole', text: 'Deals 1.2x damage to a foe whose side has no tide.',
  outMul(b, f, t) { return b.s[t.side].nerve <= 0 ? 1.2 : 1; } });
defMove({ id: 'vacuole_old', name: 'Old Air', type: 'VOID', owner: 'vacuole', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | orb line | smoke', text: 'Hits for 215% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 2.15 }); } });
defMove({ id: 'vacuole_vacuum', name: 'Thin Out', type: 'STAR', owner: 'vacuole', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | star*2 line | sparkle',
  text: 'Hits for 118% MGK. 3 turns: the foe takes 1.25x damage.',
  run(c) { c.mark(c.tgt, 'vacuole_discord', 1, 3); c.hit(c.tgt, { mgk: 1.18 }); } });
defMove({ id: 'vacuole_shell', name: 'Kept Air', type: 'VOID', owner: 'vacuole', reach: 'ally', cd: 3, fx: 'swell | bubble orbit | ring ally',
  text: 'Keeps an ally\'s moment, 3 turns: a KO sends it back there instead. It heals 6% a turn.',
  run(c) { const a = c.ally!; keepMoment(a); c.mark(a, 'vacuole_harmony', 1, 3); } });
defMove({ id: 'vacuole_wall', name: 'Old Year', type: 'VOID', owner: 'vacuole', reach: 'single', tags: ['spell'], cd: 7, nerve: 5, fx: 'swell big | orb*4 orbit | vortex big tint',
  text: 'Hits for 114% MGK. Untouchable 1. After 2 of its turns: the foe returns to this moment.',
  run(c) { c.hit(c.tgt, { mgk: 1.14 }); c.st(c.u, 'invuln', 1); if (c.tgt.ko || c.blocked(c.tgt)) return; keepMoment(c.tgt); c.mark(c.tgt, 'vacuole_calm', 1, 2); } });

// evaporite: the rings of salt a dried room left, which take a Ring of max HP off whatever stands in them.
const EVAP_GOLEM: SpriteData = { px: ['2.2222.2', '.244442.', '22111122', '21311312', '24444442', '222.2222', '24444442', '22.22.22'], c: ['#efefe9', '#d19a21', '#7f7f87'] };
defSummon({ id: 'evaporite_tomb', name: 'Salt Tomb', owner: 'evaporite', sprite: { px: ['........', '........', '...44...', '..4334..', '.224422.', '22222222', '.222222.', '........'], c: ['#efefe9', '#d19a21', '#444242'] }, text: 'Each turn: hits the foe for 25% of Kuorisho\'s MGK.', every: 100,
  act(b, s, f) { const t = foeOut(b, s); if (!f || !t) return; strike(b, f, t, stat(b, f, 'mgk') * 0.25, 'M', 'SALT'); } });
defMark({ id: 'evaporite_golem', name: 'dried hard', clock: 'own', value: 0.2,
  afterDeal(b, f, t, dealt, d) { if (d.attack && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'expose', 1); },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'evaporite_golem'); clearForm(b, f); } });
function takeRing(c: Ctx, t: Fighter): void {
  if (t.ko || c.blocked(t)) return;
  const amt = Math.round(t.maxHp * 0.04);
  t.maxHp -= amt; t.hp = Math.min(t.hp, t.maxHp);
  c.u.maxHp += amt; c.heal(c.u, amt);
  c.u.k.rings = (c.u.k.rings || 0) + 1;
  t.k.ringedBy = c.u.side + 1;
}
defPassive({ id: 'evaporite_ringed', name: 'Ringed', owner: 'evaporite', text: 'Takes 4% less damage per Ring it has taken, up to 20%.',
  inMul(b, f) { return 1 - 0.04 * Math.min(5, f.k.rings || 0); } });
defPassive({ id: 'evaporite_dries', name: 'Dries Out', owner: 'evaporite', text: 'Deals 1.2x damage to a foe it took a Ring from.',
  outMul(b, f, t) { return t.k.ringedBy === f.side + 1 ? 1.2 : 1; } });
defMove({ id: 'evaporite_flake', name: 'Salt Flake', type: 'SALT', owner: 'evaporite', reach: 'single', tags: ['spell'], cd: 2, fx: 'flare | salt line | shatter', text: 'Hits for 125% MGK. Takes a Ring: 4% of the foe\'s max HP to itself.',
  run(c) { c.hit(c.tgt, { mgk: 1.25 }); takeRing(c, c.tgt); } });
defMove({ id: 'evaporite_ring', name: 'Dry Ring', type: 'STONE', owner: 'evaporite', reach: 'spread', tags: ['spell'], cd: 3, fx: 'stomp | salt*4 orbit | shatter all', text: 'Hits for 91% MGK, +8% per whorl standing. Splash 35%. Heals 15% of it.',
  run(c) { const n = standing(c.me).length + standing(c.them).length; const d = c.spread({ mgk: 0.91 }, { mult: 1 + 0.08 * n }); c.heal(c.u, d * 0.15); } });
defMove({ id: 'evaporite_draw', name: 'Draw Water', type: 'SALT', owner: 'evaporite', reach: 'side', cd: 4, fx: 'sink | salt*2 rise | pillar ally', text: 'Summons a Salt Tomb (20% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'evaporite_tomb', { hp: 0.2, turns: 3 }); } });
defMove({ id: 'evaporite_room', name: 'Dry Room', type: 'SALT', owner: 'evaporite', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell | salt*5 converge | shatter frost glare big', text: 'Hits for 82% MGK. Takes 2 Rings. 3 turns: 1.15x ATK and MGK, attacks Expose 1.',
  run(c) {
    setForm(c.b, c.u, { tag: 'golem', sprite: EVAP_GOLEM, statMul: { mgk: 1.15, atk: 1.15 } });
    c.mark(c.u, 'evaporite_golem', 1, 3);
    c.hit(c.tgt, { mgk: 0.82 }); takeRing(c, c.tgt); takeRing(c, c.tgt);
  } });

// hood: the hood a nautilus shuts its door with, which shuts any door on trouble, a foe's way out included.
defMark({ id: 'hood_angel', name: 'door shut', clock: 'own', value: 0.2,
  inMul(b, f, src, d) { return d.kind === 'P' ? 0 : 1; } });
defPassive({ id: 'hood_hard', name: 'Hard Hood', owner: 'hood', text: 'Its attacks add 50% DEF to their damage, and its moves add 25% DEF.',
  addRaw(b, f, t, d) { return stat(b, f, 'def') * (d.attack ? 0.5 : 0.25); } });
defPassive({ id: 'hood_door', name: 'Door Behind', owner: 'hood', text: 'When it switches out: the ally coming in gets Fortify 2.',
  leave(b, f) { f.k.doorOpen = 1; },
  anyOut(b, f, who) { if (f.k.doorOpen && who.side === f.side && who !== f) { f.k.doorOpen = 0; applyStatus(b, f, who, 'fortify', 2); } } });
defMove({ id: 'hood_knock', name: 'Hood Knock', type: 'STONE', owner: 'hood', reach: 'single', cd: 1, fx: 'lunge | crack',
  text: 'Hits for 138% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.38 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'hood_purify', name: 'Purify', type: 'STONE', owner: 'hood', reach: 'ally', cd: 3, fx: 'swell | sparkle ally', text: 'Heals an ally 18% of max HP. The foe takes that much as magic.',
  run(c) { const h = c.heal(c.ally!, c.ally!.maxHp * 0.18); c.hit(c.tgt, { flat: h }, { kind: 'M' }); } });
defMove({ id: 'hood_holdshut', name: 'Door Slam', type: 'GEAR', owner: 'hood', reach: 'single', cd: 3, fx: 'lunge | cog line | crack big',
  text: 'Hits for 113% ATK. Fortify 2. The foe can\'t switch for 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.13 }); c.st(c.u, 'fortify', 2); if (!c.tgt.ko) c.mark(c.tgt, 'septum_sealed', 1, 2); } });
defMove({ id: 'hood_shutdoor', name: 'Shut Door', type: 'STONE', owner: 'hood', reach: 'team', cd: 7, nerve: 5, fx: 'stomp big | shell*3 orbit | ring pillar tint ally', text: 'Your team takes no physical damage for 2 turns and heals 10%.',
  run(c) { for (const a of standing(c.me)) { c.mark(a, 'hood_angel', 1, 2); c.heal(a, a.maxHp * 0.1); } } });

// ================================================================ the Long Strand

// spoor: one of the Gleaner's footprints, long as a house, that catches the falling stars and leaves Live Prints of its own.
defSummon({ id: 'spoor_print', name: 'Live Print', owner: 'spoor', text: 'Stays until a foe comes out. Hits it for 45% of Ashiaki\'s MGK.',
  sprite: { px: ['........', '........', '....3...', '...4....', '..2222..', '.213312.', '.222222.', '........'], c: ['#4a4458', '#facb39', '#926b4b'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `A print goes off under ${label(b, who)}.`); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.45, 'M', 'VOID'); return true; } });
const prints = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'spoor_print');
defPassive({ id: 'spoor_prints', name: 'Footprints', owner: 'spoor', text: 'When it uses a move: summons a Live Print (4% max HP), up to 3.',
  afterMove(b, f) { if (prints(b, f).length < 3) summon(b, f, 'spoor_print', { hp: 0.04 }); } });
defPassive({ id: 'spoor_starsland', name: 'Stars Land In', owner: 'spoor', text: 'While it is out, falling stars land in its print: your side alone gets 4 tide.',
  catchStar(b, f) { return isOut(b, f); } });
defMove({ id: 'spoor_footfall', name: 'Footfall', type: 'VOID', owner: 'spoor', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'stomp | orb line | quake',
  text: 'Hits for 105% MGK. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'spoor_toes', name: 'Toe Prints', type: 'TIDE', owner: 'spoor', reach: 'single', tags: ['spell'], cd: 3, fx: 'stomp | drop*2 line | splash',
  text: 'Hits for 70% MGK. Sets a Live Print. Haste 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); if (prints(c.b, c.u).length < 3) summon(c.b, c.u, 'spoor_print', { hp: 0.04 }); c.st(c.u, 'haste', 1); } });
defMove({ id: 'spoor_guard', name: 'Print Guard', type: 'VOID', owner: 'spoor', reach: 'side', cd: 3, fx: 'stomp | ring ally', text: 'Sets 2 Live Prints.',
  run(c) { summon(c.b, c.u, 'spoor_print', { hp: 0.04 }); summon(c.b, c.u, 'spoor_print', { hp: 0.04 }); } });
defMove({ id: 'spoor_walkback', name: 'Walk Back', type: 'VOID', owner: 'spoor', reach: 'spread', tags: ['dash', 'spell'], cd: 6, nerve: 5, fx: 'lunge big | orb*5 sweep | quake all dark', text: 'Hits for 147% MGK. Splash 35%. Silence 1. Pays 12% of its max HP.',
  run(c) { selfCost(c.b, c.u, c.u.maxHp * 0.12); c.spread({ mgk: 1.47 }); c.st(c.tgt, 'silence', 1); } });

// bolide: a star that came down bright at a spring low and kept burning, and calls another star down when it likes.
defPassive({ id: 'bolide_burning', name: 'Burning Down', owner: 'bolide', text: 'Moves add 1 Heat, max 3, other actions take 1. Each: +6% damage, 5% sooner turns.',
  afterMove(b, f) { f.k.heat3 = Math.min(3, (f.k.heat3 || 0) + 1); f.k.heatAt = b.turnNo; },
  outMul(b, f) { return 1 + 0.06 * (f.k.heat3 || 0); },
  turnEnd(b, f, action) { if (action === 'move' || action === 'windup') { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 5 * (f.k.heat3 || 0)); } else f.k.heat3 = Math.max(0, (f.k.heat3 || 0) - 1); } });
defPassive({ id: 'bolide_brightfall', name: 'Bright Fall', owner: 'bolide', text: 'When a star lands: its Heat goes to 3.',
  starLanded(b, f) { if (!f.ko) f.k.heat3 = 3; } });
defMove({ id: 'bolide_flick', name: 'Cinder Flick', type: 'STAR', owner: 'bolide', reach: 'spread', tags: ['spell'], cd: 1, fx: 'flare | ember*3 sweep | cinders all', text: 'Hits for 45% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 0.45 }); } });
defMove({ id: 'bolide_streak', name: 'Bright Streak', type: 'STONE', owner: 'bolide', reach: 'spread', tags: ['spell'], cd: 3, wu: 40, fx: 'lift | comet line | crack all',
  text: 'Short wind-up. Hits for 60% MGK. Splash 35%. Stun 1.',
  run(c) { c.spread({ mgk: 0.6 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'bolide_ring', name: 'Strike Ring', type: 'STAR', owner: 'bolide', reach: 'self', cd: 4, wt: 50, fx: 'swell | ember*4 orbit | ring self', text: 'Haste 2. Fortify 2 (20% less damage). Its Heat goes to 3.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'fortify', 2, 0.2); c.u.k.heat3 = 3; } });
defMove({ id: 'bolide_whiteline', name: 'White Line', type: 'STAR', owner: 'bolide', reach: 'single', tags: ['spell'], noGuard: true, cd: 6, nerve: 5, fx: 'lift big | star line fast | flash big glare',
  text: 'A star lands now. Hits for 100% MGK as true damage, through guard.',
  run(c) { starFall(c.b, true); c.hit(c.tgt, { mgk: 1.0 }, { kind: 'T' }); } });

// marram: a root of dune grass that walked off the Long Strand, holds its friends together, and comes up as Tussocks.
defSummon({ id: 'marram_treant', name: 'Tussock', owner: 'marram', text: 'Each turn: hits the foe for 25% of Heinaba\'s ATK.', every: 100,
  sprite: { px: ['3......3', '4..44..4', '44.44.44', '.444444.', '.212212.', '.222222.', '.2....2.', '........'], c: ['#d3c39b', '#347433', '#8dab54'] },
  act(b, s, f) { const t = foeOut(b, s); if (f && t) strike(b, f, t, stat(b, f, 'atk') * 0.25, 'P', 'ROOT'); } });
defMark({ id: 'marram_pen', name: 'penned in', clock: 'own', volatile: true, negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' || what === 'guard' ? 'Penned in.' : null; } });
defPassive({ id: 'marram_holds', name: 'Holds Together', owner: 'marram', text: 'Takes 0.9x damage while it has an ally in reserve.',
  inMul(b, f) { return reserves(b.s[f.side]).length ? 0.9 : 1; } });
defPassive({ id: 'marram_walked', name: 'Root Walked', owner: 'marram', text: 'When it switches out: the next ally\'s first turn comes 20% sooner.',
  leave(b, f) { sk(b, f.side).bonusNext = (sk(b, f.side).bonusNext || 0) + 20; } });
defMove({ id: 'marram_sprout', name: 'Sprout Ring', type: 'ROOT', owner: 'marram', reach: 'single', cd: 2, fx: 'sway | leaf*3 converge | bloom', text: 'Hits for 75% ATK. 2 turns: the foe can\'t switch or guard.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); if (!c.tgt.ko) c.mark(c.tgt, 'marram_pen', 1, 2); } });
defMove({ id: 'marram_runner', name: 'Runner', type: 'ROOT', owner: 'marram', reach: 'side', cd: 3, fx: 'sink | kelp*2 rise | puff ally', text: 'Summons 2 Tussocks (10% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'marram_treant', { hp: 0.1, turns: 3 }); summon(c.b, c.u, 'marram_treant', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'marram_walkoff', name: 'Walk Off', type: 'STONE', owner: 'marram', reach: 'single', cd: 3, tag: true, fx: 'lunge | pebble*2 line | crack', text: 'Hits for 97% ATK. Switches out.',
  run(c) { c.hit(c.tgt, { atk: 0.97 }); } });
defMove({ id: 'marram_rootrun', name: 'Root Run', type: 'ROOT', owner: 'marram', reach: 'spread', cd: 6, splash: 0.5, nerve: 5, fx: 'sink big | thorn*5 sweep | crack bloom tint all', text: 'Hits for 107% ATK, +20% per foe reserve it hits. Splash 50%.',
  run(c) { let n = 0; for (const r of reserves(c.them)) { c.hit(r, { atk: 1.07 }, { reserve: true, spread: true, mult: 0.5 }); n++; } c.hit(c.tgt, { atk: 1.07 }, { mult: 1 + 0.2 * n }); } });

// saltwort: a crisp salt plant whose spat salt piles up as Crust on whatever it hits, until it draws every pile in at once.
defMark({ id: 'saltwort_brine', name: 'crusted', max: 6, clock: 'own', negative: true, value: -0.05,
  turnStart(b, f) { const mk = f.m.saltwort_brine; const by = mk ? markedBy(b, mk) : null; if (mk) dealDamage(b, by && live(by) ? by : null, f, f.maxHp * 0.008 * mk.n, dot('T'), null); } });
defMark({ id: 'saltwort_spray', name: 'spraying', clock: 'own', volatile: true, value: 0.12,
  afterAttack(b, f, t) { for (const r of reserves(b.s[1 - f.side])) { dealDamage(b, f, r, stat(b, f, 'mgk') * 0.6, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); addBrine(b, f, r, 1); } } });
function addBrine(b: Battle, f: Fighter, t: Fighter, n: number): void {
  if (!live(t) || t.side === f.side) return;
  mark(b, f, t, 'saltwort_brine', n, 4);
}
defPassive({ id: 'saltwort_crisp', name: 'Crisp', owner: 'saltwort', text: 'Its attacks add 1 Crust, up to 6, for 4 turns. Each Crust: 0.8% max HP a turn.',
  afterAttack(b, f, t) { addBrine(b, f, t, 1); } });
defPassive({ id: 'saltwort_post', name: 'Salt Crust', owner: 'saltwort', text: 'Its hits on a foe with 3 or more of its Crust deal 1.2x and add Slow 1.',
  outMul(b, f, t) { return marked(t, 'saltwort_brine') >= 3 ? 1.2 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && t.side !== f.side && !t.ko && marked(t, 'saltwort_brine') >= 3) applyStatus(b, f, t, 'slow', 1); } });
defMove({ id: 'saltwort_spit', name: 'Salt Spit', type: 'SALT', owner: 'saltwort', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | salt line | shatter', text: 'Hits for 118% MGK. 1 Crust.',
  run(c) { c.hit(c.tgt, { mgk: 1.18 }); addBrine(c.b, c.u, c.tgt, 1); } });
defMove({ id: 'saltwort_mist', name: 'Brine Mist', type: 'SALT', owner: 'saltwort', reach: 'spread', tags: ['projectile', 'spell'], cd: 3, fx: 'sway | salt*4 sweep | shatter all', text: 'Hits for 83% MGK. Splash 35%. 2 Crust on the foe, 1 on each reserve.',
  run(c) { c.spread({ mgk: 0.83 }); addBrine(c.b, c.u, c.tgt, 2); for (const r of reserves(c.them)) addBrine(c.b, c.u, r, 1); } });
defMove({ id: 'saltwort_cure', name: 'Cure Through', type: 'ROOT', owner: 'saltwort', reach: 'spread', tags: ['spell'], cd: 3, fx: 'sway | kelp*3 converge | burst all', text: 'Spends all Crust: the foe and each reserve take 35% MGK + 2% max HP per Crust on it.',
  run(c) {
    for (const e of standing(c.them)) {
      const n = marked(e, 'saltwort_brine');
      if (!n || c.blocked(e)) continue;
      unmark(e, 'saltwort_brine');
      c.hit(e, { mgk: 0.35 * n, tgtHp: 0.02 * n }, e === c.tgt ? {} : { reserve: true });
    }
  } });
defMove({ id: 'saltwort_pressed', name: 'Pressed Flat', type: 'SALT', owner: 'saltwort', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'sink big | salt*3 rain | shatter frost tint self', text: 'Hidden 1. 3 turns: its attacks also hit each reserve for 60% MGK, adding a Crust.',
  run(c) { c.st(c.u, 'hidden', 1); c.mark(c.u, 'saltwort_spray', 1, 3); } });

// albedo: the white glare off a salt flat at night, which blinds a foe to its own strengths and keeps the shine of whatever falls.
defMark({ id: 'albedo_glare', name: 'glared', clock: 'own', negative: true, volatile: true, value: -0.12,
  typeOut(b, f, t, type, m) { return Math.min(1, m); } });
defMark({ id: 'albedo_empress', name: 'flaring', clock: 'own', volatile: true, value: 0.2,
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.15); } });
defPassive({ id: 'albedo_hard', name: 'Night Glare', owner: 'albedo', text: 'When a foe is KO\'d, and on every 4th hit it lands: gains a Shine, up to 3.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.souls = Math.min(3, (f.k.souls || 0) + 1); },
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; f.k.glare = (f.k.glare || 0) + 1; if (f.k.glare % 4 === 0) f.k.souls = Math.min(3, (f.k.souls || 0) + 1); } });
defPassive({ id: 'albedo_kept', name: 'Kept Shine', owner: 'albedo', text: 'When a whorl falls, friend or foe: it takes that whorl\'s first passive while out.',
  anyKO(b, f, v) { if (v === f || f.ko || f.gone || !isOut(b, f)) return; const p = passivesOf(v)[0]; if (p) lendPassive(b, v, f, p, 99); } });
defMove({ id: 'albedo_glint', name: 'Night Glint', type: 'SALT', owner: 'albedo', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | star line | sparkle',
  text: 'Hits for 145% MGK. Weaken 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.45 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'albedo_field', name: 'White Field', type: 'SALT', owner: 'albedo', reach: 'self', cd: 2, wt: 50, fx: 'swell | sparkle self', text: 'Spends a Shine: heals 20% max HP. Without one: heals 8%.',
  run(c) { const s = (c.u.k.souls || 0) > 0; if (s) c.u.k.souls--; c.heal(c.u, c.u.maxHp * (s ? 0.2 : 0.08)); } });
defMove({ id: 'albedo_link', name: 'Glare Link', type: 'STAR', owner: 'albedo', reach: 'single', tags: ['spell'], cd: 3, fx: 'flare | beam ray | flash glare',
  text: 'Hits for 90% MGK. Hidden 1. 3 turns: the foe\'s hits are never strong.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); c.st(c.u, 'hidden', 1); if (!c.tgt.ko) c.mark(c.tgt, 'albedo_glare', 1, 3); } });
defMove({ id: 'albedo_flare', name: 'Salt Flare', type: 'SALT', owner: 'albedo', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'swell | salt*5 rise | flash big glare', text: 'Haste 3, Empower 3, 2 Shine. 3 turns: its attacks heal 15% of their damage.',
  run(c) { c.st(c.u, 'haste', 3); c.st(c.u, 'empower', 3); c.mark(c.u, 'albedo_empress', 1, 3); c.u.k.souls = Math.min(3, (c.u.k.souls || 0) + 2); } });

// cuttle: a cuttlefish bone that matches whatever it lies beside, friend or foe.
defSummon({ id: 'cuttle_decoy', name: 'Bone Decoy', owner: 'cuttle', sprite: { px: ['........', '..2222..', '.242242.', '.224422.', '.242242.', '..2222..', '...33...', '........'], c: ['#efebe3', '#51a95a', '#866757'] }, text: 'Takes single-target hits meant for Ikapia. Uses Color Jab on its own turns.', every: 100, guard: true });
defMark({ id: 'cuttle_shape', name: 'in other colors', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); msg(b, `${label(b, f)} lies back down as itself.`); },
  leave(b, f) { unmark(f, 'cuttle_shape'); clearForm(b, f); } });
defPassive({ id: 'cuttle_matches', name: 'Matches', owner: 'cuttle', text: 'Deals 1.3x damage while its Bone Decoy stands.',
  outMul(b, f) { return summonsOf(b, f.side, 'cuttle_decoy').length ? 1.3 : 1; } });
defPassive({ id: 'cuttle_liesby', name: 'Lies By', owner: 'cuttle', text: 'When it comes out: the first hit it takes deals 0.7x.',
  comeOut(b, f) { f.k.liesBy = 1; },
  beforeTake(b, f, src, amt, d) { if (!f.k.liesBy || d.dot) return amt; f.k.liesBy = 0; return amt * 0.7; } });
defMove({ id: 'cuttle_jab', name: 'Color Jab', type: 'TIDE', owner: 'cuttle', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | drop line | splash', text: 'Hits for 103% MGK. The first reserve takes 35% of it.',
  run(c) { c.hit(c.tgt, { mgk: 1.03 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.03 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'cuttle_clap', name: 'Flat Clap', type: 'BEAST', owner: 'cuttle', reach: 'single', cd: 3, fx: 'lunge | bone line | bite',
  text: 'Hits for 70% MGK. Hidden 1. A Bone Decoy (12% max HP, 2 turns) uses Color Jab.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); c.st(c.u, 'hidden', 1); summonTwin(c.b, c.u, 'cuttle_decoy', { hp: 0.12, turns: 2, moves: ['cuttle_jab'] }); } });
defMove({ id: 'cuttle_brew', name: 'Cloud Brew', type: 'TIDE', owner: 'cuttle', reach: 'reserveAlly', cd: 4, tag: true, fx: 'swell | bubble*3 orbit | smoke ally', text: 'Switches to an ally that comes out looking like Ikapia.',
  run(c) { disguise(c.b, c.ally!, c.u); c.ally!.k.wearing = 1; } });
defMove({ id: 'cuttle_three', name: 'Three Colors', type: 'TIDE', owner: 'cuttle', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, wt: 60, fx: 'blink big | orb*3 orbit | sparkle splash tint', text: 'Takes the foe\'s look, types, passives, and moves for 3 turns.',
  run(c) { if (c.blocked(c.tgt)) return; takeOver(c.b, c.u, c.tgt, 'shape'); c.mark(c.u, 'cuttle_shape', 1, 3); c.msg(`${label(c.b, c.u)} matches ${label(c.b, c.tgt)}.`); } });

// medusa: a jelly the spring low left behind, which drains the tide out of anyone who talks near it and sends the sea out.
defMark({ id: 'medusa_counter', name: 'quiet', clock: 'own', volatile: true, value: 0.15,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('spell')) return null; unmark(f, 'medusa_counter'); return 'reflect'; } });
defPassive({ id: 'medusa_ripples', name: 'Ripples', owner: 'medusa', text: 'Every 2nd hit: the foe\'s side loses 1 tide, and it takes 5% max HP true.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || f.k.breaking) return; f.k.mb = (f.k.mb || 0) + 1; if (f.k.mb % 2 !== 0) return; addNerve(b, t.side, -1); f.k.breaking = 1; strike(b, f, t, t.maxHp * 0.05, 'T', null); f.k.breaking = 0; } });
defPassive({ id: 'medusa_talked', name: 'Talked Near', owner: 'medusa', text: 'When a foe uses a spell: the foe\'s side loses 1 tide.',
  anyMove(b, f, user, m) { if (m && user.side !== f.side && isOut(b, f) && m.tags?.includes('spell')) addNerve(b, user.side, -1); } });
defMove({ id: 'medusa_sting', name: 'Bell Sting', type: 'TIDE', owner: 'medusa', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | bell line | ring', text: 'Hits for 85% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); c.hasten(c.u, 30); } });
defMove({ id: 'medusa_pulse', name: 'Quiet Pulse', type: 'TIDE', owner: 'medusa', reach: 'self', cd: 3, wt: 50, fx: 'swell | ring self', text: 'Turns the next spell aimed at its side back on its user.',
  run(c) { c.mark(c.u, 'medusa_counter', 1, 2); } });
defMove({ id: 'medusa_bell', name: 'Pulse Bell', type: 'BEAST', owner: 'medusa', reach: 'single', cd: 3, fx: 'lunge | bell*2 line | bite', text: 'Hits for 100% ATK. The foe\'s side loses 1 tide.',
  run(c) { c.hit(c.tgt, { atk: 1 }); if (!c.blocked(c.tgt)) c.nerve(c.them, -1); } });
defMove({ id: 'medusa_bigripple', name: 'Big Ripple', type: 'TIDE', owner: 'medusa', reach: 'spread', cd: 6, nerve: 5, fx: 'swell | drop*6 sweep | splash ring tint all big',
  text: 'Low Water 3 rounds. Hits for 57% ATK, +17% per tide the foe has under 10. Splash 35%.',
  run(c) {
    setLowWater(c.b, 3);
    const lack = Math.max(0, 10 - c.them.nerve);
    c.spread({ atk: 0.57 + 0.17 * lack });
  } });

// ================================================================ the Tray

// bollard: a white corner post off a slot in the Tray that stands where it is put and drives itself in to shoot.
const BOLLARD_TURRET: SpriteData = { px: ['........', '..2222..', '33111133', '.243342.', '222.2222', '44444444', '44444444', '4.4.4.4.'], c: ['#f9f9f1', '#7ded9d', '#444a42'] };
defMark({ id: 'bollard_shells', name: 'stones coming', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { msg(b, 'A stone lands from the corners.'); splash(b, f, stat(b, f, 'atk') * 0.6, 'P', 'STONE'); } });
const turret = (f: Fighter) => f.form?.tag === 'turret';
defPassive({ id: 'bollard_stands', name: 'Stands Put', owner: 'bollard', text: 'Cannot be forced out. Driven In: takes 0.8x damage, can\'t switch.',
  immovable() { return true; },
  inMul(b, f) { return turret(f) ? 0.8 : 1; },
  forbid(b, f, what) { return turret(f) && what === 'switch' ? 'Set in place.' : null; },
  leave(b, f) { clearForm(b, f); } });
defPassive({ id: 'bollard_corner', name: 'Corner Post', owner: 'bollard', text: 'Turn start, Driven In: heals 6% of its max HP.',
  turnStart(b, f) { if (turret(f)) heal(b, f, f, f.maxHp * 0.06); } });
defMove({ id: 'bollard_post', name: 'Post Shot', type: 'STONE', owner: 'bollard', reach: 'single', tags: ['projectile'], cd: 1, fx: 'flare | pebble line | crack', text: 'Hits for 139% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.39 }); } });
defMove({ id: 'bollard_shove', name: 'Shove Back', type: 'GEAR', owner: 'bollard', reach: 'spread', tags: ['projectile'], cd: 3, fx: 'stomp | cog*3 sweep | burst all', text: 'Hits for 95% ATK. Splash 35%. Weaken 1.',
  run(c) { c.spread({ atk: 0.95 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'bollard_drive', name: 'Post Drive', type: 'STONE', owner: 'bollard', reach: 'self', cd: 2, wt: 50, fx: 'sink | ring self', text: 'Drives itself in, or pulls out. Driven In: 1.2x DEF, 0.85x AGI.',
  run(c) {
    if (turret(c.u)) { clearForm(c.b, c.u); c.msg(`${label(c.b, c.u)} stands back up.`); return; }
    setForm(c.b, c.u, { tag: 'turret', sprite: BOLLARD_TURRET, statMul: { def: 1.2, agi: 0.85 } }, ['bollard_gatling']);
    c.msg(`${label(c.b, c.u)} sets itself down.`);
  } });
defMove({ id: 'bollard_gatling', name: 'Post Volley', type: 'STONE', owner: 'bollard', reach: 'single', tags: ['projectile'], cd: 1, extra: true, fx: 'shake | pebble*5 line fast | crack', text: 'Hits 5 times for 30% ATK, the last 2 on reserves.',
  run(c) { const rs = reserves(c.them); for (let i = 0; i < 5; i++) { const t = i >= 3 && rs[i - 3] ? rs[i - 3] : c.tgt; if (!t.ko) c.hit(t, { atk: 0.3 }, t === c.tgt ? {} : { reserve: true }); } } });
defMove({ id: 'bollard_four', name: 'Four Posts', type: 'STONE', owner: 'bollard', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, fx: 'lift big | pebble*4 rain | quake crack jolt all', text: 'Hits for 40% ATK. Splash 35%. At its next 3 turns: every foe takes 60% ATK.',
  run(c) { c.spread({ atk: 0.4 }); c.mark(c.u, 'bollard_shells', 1, 3); } });

// docket: a docket post that walks to the nearest shell and waits in front of it, ticketing whatever it means to write down.
defMark({ id: 'docket_label', name: 'ticketed', clock: 'own', negative: true, value: -0.08,
  inMul(b, f, src) { const mk = f.m.docket_label; return mk && src && markedBy(b, mk) === src ? 1.15 : 1; } });
defSummon({ id: 'docket_wire', name: 'Trip Label', owner: 'docket', text: 'Stays until a foe comes out. Hits it for 162% MGK. Root 2. Ticketed 3.',
  sprite: { px: ['........', '........', '........', '..2222..', '..2132..', '..2222..', '...44...', '33.44.33'], c: ['#fff7ee', '#5ee6fd', '#3c3c4a'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} trips a label.`); if (f) strike(b, f, who, stat(b, f, 'mgk') * 1.62, 'M', 'ROOT'); applyStatus(b, f, who, 'root', 2); mark(b, f, who, 'docket_label', 1, 3); if (f && has(f, 'docket_nearest')) addNerve(b, f.side, 1); return true; } });
defMark({ id: 'docket_cage', name: 'held off', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('projectile')) return null; unmark(f, 'docket_cage'); return 'block'; } });
defPassive({ id: 'docket_nearest', name: 'Nearest Shell', owner: 'docket', text: 'Each time a Trip Label goes off: +1 tide.' });
defPassive({ id: 'docket_letters', name: 'Last Letters', owner: 'docket', text: 'When it is KO\'d: every foe is Ticketed for 3 turns.',
  anyKO(b, f, v) { if (v !== f) return; for (const e of standing(b.s[1 - f.side])) mark(b, null, e, 'docket_label', 1, 3); } });
defMove({ id: 'docket_tap', name: 'Post Tap', type: 'GEAR', owner: 'docket', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | card line | flash', text: 'Hits for 261% MGK. Ticketed 3: it takes 1.15x from Tifuda.',
  run(c) { c.hit(c.tgt, { mgk: 2.61 }); if (!c.tgt.ko) c.mark(c.tgt, 'docket_label', 1, 3); } });
defMove({ id: 'docket_plant', name: 'Plant Label', type: 'ROOT', owner: 'docket', reach: 'side', cd: 3, fx: 'sink | card rise | sigil self', text: 'Sets a Trip Label (5% of its max HP).',
  run(c) { summon(c.b, c.u, 'docket_wire', { hp: 0.05 }); } });
defMove({ id: 'docket_hold', name: 'Hold Label', type: 'GEAR', owner: 'docket', reach: 'self', cd: 3, wt: 50, fx: 'swell | card orbit | ring self', text: 'Fortify 1. Blocks the next projectile move at its side.',
  run(c) { c.st(c.u, 'fortify', 1); c.mark(c.u, 'docket_cage', 1, 2); } });
defMove({ id: 'docket_blast', name: 'All Ticketed', type: 'GEAR', owner: 'docket', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, fx: 'flare big | card*5 sweep | flash burst jolt all', text: 'Hits for 208% MGK. Splash 35%. Ticketed 3 on every foe. Empower 1 on your team.',
  run(c) { c.hit(c.tgt, { mgk: 2.08 }); for (const e of standing(c.them)) c.mark(e, 'docket_label', 1, 3); for (const a of standing(c.me)) c.st(a, 'empower', 1); } });

// vacancy: an empty slot from the Tray that empties whatever stands in it and waits inside a friend to burst out.
defMark({ id: 'vacancy_inside', name: 'waiting inside', value: 0.15,
  comeOut(b, f) { unmark(f, 'vacancy_inside'); msg(b, `${label(b, f)} bursts out.`); splash(b, f, stat(b, f, 'mgk') * 1.0, 'M', 'VOID'); heal(b, f, f, f.maxHp * 0.15); } });
defPassive({ id: 'vacancy_empties', name: 'Empties', owner: 'vacancy', text: 'Every 2nd attack: the foe\'s side loses 1 tide.',
  afterAttack(b, f, t) { f.k.empt = (f.k.empt || 0) + 1; if (f.k.empt % 2 === 0) addNerve(b, t.side, -1); } });
defPassive({ id: 'vacancy_counter', name: 'Counter Empty', owner: 'vacancy', text: 'When it comes out: the first enemy move to hit it deals 0.6x.',
  comeOut(b, f) { f.k.counterE = 1; },
  beforeTake(b, f, src, amt, d) { if (!d.move || !f.k.counterE || !src || src.side === f.side) return amt; f.k.counterE = 0; return amt * 0.6; } });
defMove({ id: 'vacancy_tap', name: 'Hollow Tap', type: 'VOID', owner: 'vacancy', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | orb line | vortex', text: 'Hits for 106% MGK + 4% of the foe\'s max HP. Heals that 4%.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.06, tgtHp: 0.04 }); c.heal(c.u, Math.min(d, c.tgt.maxHp * 0.04)); } });
defMove({ id: 'vacancy_slip', name: 'Slip In', type: 'TIDE', owner: 'vacancy', reach: 'single', tags: ['spell'], cd: 2, fx: 'blink | drop line | splash',
  text: 'Hits for 88% MGK. Slow 2. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.88 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 25); } });
defMove({ id: 'vacancy_emptyout', name: 'Empty Out', type: 'VOID', owner: 'vacancy', reach: 'self', cd: 4, wt: 50, fx: 'sink | ring self', text: 'Cleanses itself. Unstoppable 2. Fortify 2 (20% less damage).',
  run(c) { c.cleanse(c.u); c.st(c.u, 'unstop', 2); c.st(c.u, 'fortify', 2, 0.2); } });
defMove({ id: 'vacancy_square', name: 'Square Waits', type: 'VOID', owner: 'vacancy', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, fx: 'sink big | orb*3 orbit | vortex smoke tint ally', text: 'Switches to an ally, healing it 10%. Next out: 100% MGK to every foe, heals 15%.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.1); c.mark(c.u, 'vacancy_inside', 1); } });

// trochus: a top shell from a world in the Tray that spins when nobody watches and heals when nothing touches it.
defMark({ id: 'trochus_judgment', name: 'spinning', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.38, 'P', 'STONE'); } });
defPassive({ id: 'trochus_unwatched', name: 'Unwatched Spin', owner: 'trochus', text: 'Turn start: if nothing hit it since its last turn, heals 4% of max HP.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.trochHit = 1; },
  turnStart(b, f) { if (!f.k.trochHit) heal(b, f, f, f.maxHp * 0.04); f.k.trochHit = 0; } });
defPassive({ id: 'trochus_spinning', name: 'Keeps Spinning', owner: 'trochus', text: 'Immune to Slow and Root.',
  statusImmune(f, id) { return id === 'slow' || id === 'root'; } });
defMove({ id: 'trochus_spin', name: 'Top Spin', type: 'STONE', owner: 'trochus', reach: 'single', cd: 3, fx: 'spin | shell line | crack', text: 'Hits for 76% ATK. Silence 1. Haste 1.',
  run(c) { c.hit(c.tgt, { atk: 0.76 }); c.st(c.tgt, 'silence', 1); c.st(c.u, 'haste', 1); } });
defMove({ id: 'trochus_under', name: 'Spin Under', type: 'STONE', owner: 'trochus', reach: 'self', cd: 3, wt: 50, fx: 'spin | ring self', text: 'Cleanses itself. Fortify 2 (30% less damage).',
  run(c) { c.cleanse(c.u); c.st(c.u, 'fortify', 2, 0.3); } });
defMove({ id: 'trochus_grit', name: 'Grit Finish', type: 'GEAR', owner: 'trochus', reach: 'spread', cd: 3, fx: 'spin | sand*4 sweep | puff all', text: 'Hits for 36% ATK. Splash 35%. At its next 2 turns: every foe takes 38% ATK.',
  run(c) { c.spread({ atk: 0.36 }); c.mark(c.u, 'trochus_judgment', 1, 2); } });
defMove({ id: 'trochus_spinout', name: 'Spin Out', type: 'STONE', owner: 'trochus', reach: 'single', cd: 6, nerve: 5, fx: 'spin | shell*3 orbit | crack quake jolt big', text: 'Hits for 64% ATK, then 27% of the foe\'s missing HP as true damage.',
  run(c) { c.hit(c.tgt, { atk: 0.64 }); if (!c.tgt.ko) c.hit(c.tgt, { tgtMiss: 0.27 }, { kind: 'T' }); } });

// hopper: a hollow salt crystal stepped inward like a stair, where everything goes in and nothing comes out, statuses included.
defMark({ id: 'hopper_step', name: 'steps', max: 4, value: 0.05 });
defPassive({ id: 'hopper_stepped', name: 'Stepped In', owner: 'hopper', text: 'When it uses a move: a Step, up to 4. Each Step: takes 5% less damage.',
  afterMove(b, f, m) { if (m.id !== 'hopper_core') mark(b, f, f, 'hopper_step', 1); },
  inMul(b, f) { return 1 - 0.05 * marked(f, 'hopper_step'); } });
defPassive({ id: 'hopper_hollow', name: 'All Goes In', owner: 'hopper', text: 'While it is out, a status a foe puts on anyone else goes into Kidedan instead.',
  drawStatus(b, f) { return isOut(b, f); } });
defMove({ id: 'hopper_face', name: 'Cube Face', type: 'SALT', owner: 'hopper', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | salt line | shatter', text: 'Hits for 126% MGK. 1.3x on a foe that came out since its last turn.',
  run(c) { c.hit(c.tgt, { mgk: 1.26 }, { mult: c.tgt.outAt > (c.u.k.prevTurn ?? -1) ? 1.3 : 1 }); } });
defMove({ id: 'hopper_stair', name: 'Inward Stair', type: 'STONE', owner: 'hopper', reach: 'dragin', tags: ['projectile'], cd: 3, fx: 'sink | shard*2 converge | crack',
  text: 'Drags in a reserve. Hits it for 102% MGK. Slow 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 1.02 }); c.st(t, 'slow', 1); } });
defMove({ id: 'hopper_crust', name: 'Crust Over', type: 'SALT', owner: 'hopper', reach: 'self', cd: 4, wt: 60, fx: 'swell | salt*3 orbit | ring self', text: 'Heals 20% of its max HP. Fortify 1 (50% less damage).',
  run(c) { c.heal(c.u, c.u.maxHp * 0.2); c.st(c.u, 'fortify', 1, 0.5); } });
defMove({ id: 'hopper_core', name: 'Hollow Core', type: 'SALT', owner: 'hopper', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, fx: 'swell | salt*6 converge | shatter frost glare all big',
  text: 'Spends all Steps: 72% MGK, +18% per Step. Splash 35%. Delays the foe 15%.',
  run(c) { const n = marked(c.u, 'hopper_step'); unmark(c.u, 'hopper_step'); c.spread({ mgk: 0.72 + 0.18 * n }); if (!c.tgt.ko) c.delay(c.tgt, 15); } });

// crabwise: a salt-crusted crab that walks between the Tray's slots, never into one, and cuts sideways.
defMark({ id: 'crabwise_wall', name: 'salt screen', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { return isOut(b, f) && m.tags?.includes('projectile') ? 'block' : null; } });
defPassive({ id: 'crabwise_sideways', name: 'Sideways', owner: 'crabwise', text: 'After a move, once every 3 turns: a shield of 14% of its max HP.',
  afterMove(b, f) { if ((f.k.flowAt || -9) > b.turnNo - 6) return; f.k.flowAt = b.turnNo; giveShield(b, f, f, f.maxHp * 0.14, 3); } });
defPassive({ id: 'crabwise_claw', name: 'Crusted Claw', owner: 'crabwise', text: 'Every 4th hit it lands deals 1.5x.',
  outMul(b, f, t, d) { return !d.reserve && !d.dot && (f.k.claw4 || 0) % 4 === 3 ? 1.5 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) f.k.claw4 = (f.k.claw4 || 0) + 1; } });
defMove({ id: 'crabwise_nip', name: 'Claw Nip', type: 'SALT', owner: 'crabwise', reach: 'single', cd: 1, fx: 'lunge | claw',
  text: 'Hits for 100% ATK. Every 3rd use: 150% ATK and Stun 1 instead.',
  run(c) { c.u.k.tempest = ((c.u.k.tempest || 0) % 3) + 1; c.hit(c.tgt, { atk: c.u.k.tempest === 3 ? 1.5 : 1.0 }); if (c.u.k.tempest === 3) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'crabwise_flick', name: 'Salt Flick', type: 'SALT', owner: 'crabwise', reach: 'self', cd: 4, wt: 50, fx: 'shake | salt*3 orbit | ring self', text: '3 turns: blocks every projectile move at it.',
  run(c) { c.mark(c.u, 'crabwise_wall', 1, 3); } });
defMove({ id: 'crabwise_side', name: 'Side Step', type: 'STONE', owner: 'crabwise', reach: 'single', tags: ['dash'], cd: 2, fx: 'blink | claw', text: 'Hits for 125% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.25 }); c.hasten(c.u, 30); } });
defMove({ id: 'crabwise_between', name: 'Between Slots', type: 'SALT', owner: 'crabwise', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'lunge | salt*3 line | claw frost jolt big',
  text: 'Hits for 150% ATK, 1.5x if the foe can\'t switch. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 1.5 }, { mult: canSwitch(c.b, c.tgt) ? 1 : 1.5 }); c.st(c.tgt, 'root', 2); } });

// magpie: a magpie that took one of everything and keeps it under its wings, a turn of every good status it sees included.
defMark({ id: 'magpie_hacked', name: 'pecked', clock: 'own', volatile: true, negative: true, value: -0.15,
  forbid(b, f, what) { return typeof what === 'object' ? 'Hacked.' : null; } });
defPassive({ id: 'magpie_each', name: 'One of Each', owner: 'magpie', text: 'When any whorl gains a good status: Picagi gains 1 turn of it too.',
  anyStatus(b, f, src, t, id) { if (isOut(b, f) && (GOOD as string[]).includes(id)) applyStatus(b, f, f, id, 1); } });
defPassive({ id: 'magpie_wing', name: 'Under Wing', owner: 'magpie', text: 'When it comes out: Hidden 1 and Haste 1.',
  comeOut(b, f) { applyStatus(b, f, f, 'hidden', 1); applyStatus(b, f, f, 'haste', 1); } });
defMove({ id: 'magpie_snatch', name: 'Snatch', type: 'BEAST', owner: 'magpie', reach: 'single', tags: ['projectile'], cd: 1, fx: 'flare | feather*3 line fast | slash', text: 'Hits 3 times for 29% ATK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.29 }); } });
defMove({ id: 'magpie_pecks', name: 'Three Pecks', type: 'STAR', owner: 'magpie', reach: 'single', cd: 4, fx: 'lunge | star*3 converge | bite', text: 'Hits for 50% ATK. Pecked 1: it can\'t use moves at its next turn.',
  run(c) { c.hit(c.tgt, { atk: 0.5 }); if (!c.tgt.ko) c.mark(c.tgt, 'magpie_hacked', 1, 1); } });
defMove({ id: 'magpie_hoard', name: 'Hoard', type: 'BEAST', owner: 'magpie', reach: 'reserveAlly', cd: 4, tag: true, wt: 50, fx: 'hop | feather orbit | ring ally', text: 'Switches to an ally. Its first turn comes 12% sooner.',
  run(c) { c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 12; } });
defMove({ id: 'magpie_back', name: 'Gives It Back', type: 'BEAST', owner: 'magpie', reach: 'spread', cd: 6, nerve: 5, fx: 'swell big | feather*6 sweep | slash claw jolt all', text: 'Every foe loses shields and good statuses. Hits for 90% ATK. Splash 35%.',
  run(c) { for (const e of standing(c.them)) { if (c.blocked(e)) continue; e.shield = 0; e.shieldTurns = 0; for (const id of GOOD) delete e.s[id]; } c.spread({ atk: 0.9 }); } });

// cache: the hole where the Mudlark hides her finds, which keeps whatever falls in for a while, people included.
defMark({ id: 'cache_shadow', name: 'sand in it', max: 5, clock: 'own', negative: true, value: -0.06 });
defPassive({ id: 'cache_deep', name: 'Deep Keep', owner: 'cache', text: 'Takes 0.8x damage. A foe it hides comes back with 2 Sand.',
  inMul() { return 0.8; },
  banishEnd(b, f, back) { if (live(back)) mark(b, f, back, 'cache_shadow', 2, 4); } });
defPassive({ id: 'cache_eye', name: 'Mudlark\'s Eye', owner: 'cache', text: 'Deals 1.25x damage to a foe with a shield or a good status.',
  outMul(b, f, t) { return t.shield > 0 || GOOD.some(id => t.s[id]) ? 1.25 : 1; } });
defMove({ id: 'cache_poke', name: 'Poke In', type: 'VOID', owner: 'cache', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | sand*2 line | puff', text: 'Hits for 179% MGK. 1 Sand, max 5.',
  run(c) { c.hit(c.tgt, { mgk: 1.79 }); if (!c.tgt.ko) c.mark(c.tgt, 'cache_shadow', 1, 4); } });
defMove({ id: 'cache_fallin', name: 'Fall In', type: 'TIDE', owner: 'cache', reach: 'single', tags: ['spell'], cd: 3, fx: 'sink | drop*3 converge | vortex',
  text: 'Strips shield and good statuses. Hits for 125% MGK. Slow 3. 1 Sand.',
  run(c) { if (c.blocked(c.tgt)) return; for (const id of GOOD) delete c.tgt.s[id]; c.tgt.shield = 0; c.tgt.shieldTurns = 0; c.hit(c.tgt, { mgk: 1.25 }); c.st(c.tgt, 'slow', 3); if (!c.tgt.ko) c.mark(c.tgt, 'cache_shadow', 1, 4); } });
defMove({ id: 'cache_hole', name: 'Shallow Hole', type: 'VOID', owner: 'cache', reach: 'single', tags: ['spell'], cd: 5, fx: 'sink | vortex big dark', text: 'Takes the foe off the field for 1 turn. It returns with 2 Sand.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; banish(c.b, c.tgt, 1, c.u); } });
defMove({ id: 'cache_keepsit', name: 'Keeps It', type: 'VOID', owner: 'cache', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | sand*5 rise | burst vortex dark all', text: 'Hits for 108% MGK. Splash 35%. Each foe\'s Sand bursts: 44% MGK, x2 per Sand past the first.',
  run(c) { c.hit(c.tgt, { mgk: 1.08 }); for (const e of standing(c.them)) { const n = marked(e, 'cache_shadow'); if (!n || c.blocked(e)) continue; unmark(e, 'cache_shadow'); c.hit(e, { mgk: 0.44 * Math.pow(2, n - 1) }, e === c.tgt ? {} : { reserve: true }); } } });

// ================================================================ the Conch

// strombus: an eye on a stalk off a conch lip that has not blinked in years, so nothing can hide from it.
defSummon({ id: 'strombus_mine', name: 'Toxin Trap', owner: 'strombus', sprite: { px: ['........', '........', '3.3..3..', '.333.3..', '..3333..', '..3223..', '.444444.', '........'], c: ['#f2eae2', '#be2f56', '#a09071'] }, text: 'Stays until a foe comes out: Poison 4.',
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} steps in the toxin.`); applyStatus(b, f, who, 'poison', 4); return true; } });
defPassive({ id: 'strombus_never', name: 'Never Blinks', owner: 'strombus', text: 'Deals 1.25x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return t.outAt > (f.k.prevTurn ?? -1) ? 1.25 : 1; } });
defPassive({ id: 'strombus_unblinking', name: 'Unblinking', owner: 'strombus', text: 'Immune to Sleep. Its hits find hidden foes.',
  statusImmune(f, id) { return id === 'sleep'; },
  findsHidden() { return true; } });
defMove({ id: 'strombus_jab', name: 'Stalk Jab', type: 'BEAST', owner: 'strombus', reach: 'single', tags: ['projectile'], cd: 1, fx: 'flare | orb line fast | flash', text: 'Hits for 193% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.93 }); } });
defMove({ id: 'strombus_look', name: 'Long Look', type: 'TIDE', owner: 'strombus', reach: 'single', cd: 3, fx: 'sway | drop*2 line | drip', text: 'Hits for 73% ATK. Poison 2. Sets a Toxin Trap (5% max HP).',
  run(c) { c.hit(c.tgt, { atk: 0.73 }); c.st(c.tgt, 'poison', 2); summon(c.b, c.u, 'strombus_mine', { hp: 0.05 }); } });
defMove({ id: 'strombus_stare', name: 'Stare', type: 'BEAST', owner: 'strombus', reach: 'self', tags: ['dash'], cd: 3, wt: 40, fx: 'swell | ring self', text: 'Haste 1. Its next attack deals 1.7x.',
  run(c) { c.st(c.u, 'haste', 1); c.u.k.nextAtkMul = 1.7; } });
defMove({ id: 'strombus_cull', name: 'Cull', type: 'BEAST', owner: 'strombus', reach: 'single', tags: ['projectile'], cd: 6, nerve: 5, wu: 80, fx: 'lift | bone line fast | bite claw jolt big', text: 'Long wind-up. Hits for 220% ATK. A foe left under 25% HP falls: +2 tide.',
  run(c) { c.hit(c.tgt, { atk: 2.2 }); if (!c.tgt.ko && c.tgt.hp < c.tgt.maxHp * 0.25 && !c.blocked(c.tgt)) { c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); if (c.tgt.ko) c.nerve(c.me, 2); } } });

// sanderling: a shore bird that runs at the edge of every wave and has never once been wet, so TIDE cannot touch it.
defMark({ id: 'sanderling_wuju', name: 'sharp', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { if (live(t)) strike(b, f, t, stat(b, f, 'atk') * 0.3, 'T', null); } });
defMark({ id: 'sanderling_high', name: 'outrunning', clock: 'own', volatile: true, value: 0.2,
  outMul(b, f, t, d) { return d.attack ? 1.4 : 1; },
  statusImmune(f, id) { return id === 'slow' || id === 'root'; } });
defPassive({ id: 'sanderling_dry', name: 'Never Wet', owner: 'sanderling', text: 'TIDE hits deal it no damage.',
  typeIn(b, f, type, m) { return type === 'TIDE' ? 0 : m; } });
defPassive({ id: 'sanderling_edge', name: 'Runs the Edge', owner: 'sanderling', text: 'When it KOs a foe: its cooldowns drop 2.',
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side) f.cd = f.cd.map(x => Math.max(0, x - 2)); } });
defMove({ id: 'sanderling_pin', name: 'Pin', type: 'BEAST', owner: 'sanderling', reach: 'spread', tags: ['dash'], cd: 1, fx: 'lunge fast | slash all', text: 'Hits for 103% ATK. Splash 35%.',
  run(c) { c.spread({ atk: 1.03 }); } });
defMove({ id: 'sanderling_longshot', name: 'Still Foot', type: 'BEAST', owner: 'sanderling', reach: 'self', cd: 4, wt: 70, fx: 'sink | ring self', text: 'Heals 20% of its max HP. Fortify 1 (40% less damage).',
  run(c) { c.heal(c.u, c.u.maxHp * 0.2); c.st(c.u, 'fortify', 1, 0.4); } });
defMove({ id: 'sanderling_run', name: 'Edge Run', type: 'STAR', owner: 'sanderling', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge fast | star line | slash',
  text: 'Hits for 80% ATK. 3 turns: its attacks add 30% ATK as true damage.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.mark(c.u, 'sanderling_wuju', 1, 3); } });
defMove({ id: 'sanderling_wave', name: 'Wave Edge', type: 'BEAST', owner: 'sanderling', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'swell big | feather*4 sweep | ring sparkle tint self', text: 'Haste 3. For 3 turns: its attacks deal 1.4x, and it is immune to Slow and Root.',
  run(c) { c.st(c.u, 'haste', 3); c.mark(c.u, 'sanderling_high', 1, 3); } });

// flood: the top of a high tide that came into the Conch and stayed, wetting whatever is lowest.
defMark({ id: 'flood_whirl', name: 'in a whirl', clock: 'own', volatile: true, negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' ? 'Caught in the whirl.' : null; },
  turnStart(b, f) { const mk = f.m.flood_whirl; const by = mk ? markedBy(b, mk) : null; if (by && live(by)) strike(b, by, f, stat(b, by, 'mgk') * 0.3, 'M', 'VOID'); } });
defPassive({ id: 'flood_comesup', name: 'Comes Up', owner: 'flood', text: 'When it uses a move: its next attack deals 1.35x.',
  afterMove(b, f) { f.k.surge = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.surge ? 1.35 : 1; },
  afterAttack(b, f) { f.k.surge = 0; } });
defPassive({ id: 'flood_stays', name: 'Stays High', owner: 'flood', text: '+3% damage per tide in its side\'s pool.',
  outMul(b, f) { return 1 + 0.03 * b.s[f.side].nerve; } });
defMove({ id: 'flood_rise', name: 'Rise', type: 'TIDE', owner: 'flood', reach: 'single', tags: ['spell'], cd: 1, fx: 'lift | drop*2 rise | splash', text: 'Hits for 113% MGK. Delays the foe\'s next turn by 15%.',
  run(c) { c.hit(c.tgt, { mgk: 1.13 }); c.delay(c.tgt, 15); } });
defMove({ id: 'flood_spill', name: 'Top Spill', type: 'TIDE', owner: 'flood', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'sway | drop*3 sweep | splash',
  text: 'Hits the foe with the lowest share of HP, out or in reserve, for 97% MGK.',
  run(c) { const low = standing(c.them).sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0]; if (low) c.hit(low, { mgk: 0.97 }, low === c.tgt ? {} : { reserve: true }); } });
defMove({ id: 'flood_stay', name: 'Stay a While', type: 'VOID', owner: 'flood', reach: 'single', tags: ['spell'], cd: 3, fx: 'spin | orb*3 spiral | vortex',
  text: 'Slow 1. For 2 turns: the foe can\'t switch and takes 30% MGK at each of its turns.',
  run(c) { c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'flood_whirl', 1, 2); } });
defMove({ id: 'flood_spring', name: 'Spring Flood', type: 'TIDE', owner: 'flood', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 60, fx: 'swell | drop*6 rise | splash ring tint all big',
  text: 'Wind-up. Hits for 162% MGK. Splash 35%. Stun 1.',
  run(c) { c.spread({ mgk: 1.62 }); c.st(c.tgt, 'stun', 1); } });

// surf: the sea sound from inside the Conch that got out and sounds backward, so a foe's statuses turn into their opposites.
defPassive({ id: 'surf_loud', name: 'Loud Inside', owner: 'surf', text: 'Every 3rd move: 40% MGK to the foe, its statuses turn backward, and then Slow 1.',
  afterMove(b, f) { f.k.chord3 = (f.k.chord3 || 0) + 1; if (f.k.chord3 % 3 !== 0) return; const t = foe(b, f); if (!t) return; strike(b, f, t, stat(b, f, 'mgk') * 0.4, 'M', 'TIDE'); if (live(t)) { turnStatuses(b, f, t); applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'surf_after', name: 'After Rush', owner: 'surf', text: 'After its crest: its next turn comes 30% sooner.',
  afterMove(b, f, m) { if (m.nerve) hastenFighter(b, f, 30); } });
defMove({ id: 'surf_hiss', name: 'Hiss', type: 'TIDE', owner: 'surf', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | hoop line | ring', text: 'Hits for 150% MGK. Its next attack deals 1.2x.',
  run(c) { c.hit(c.tgt, { mgk: 1.5 }); c.u.k.nextAtkMul = 1.2; } });
defMove({ id: 'surf_crash', name: 'Crash', type: 'TIDE', owner: 'surf', reach: 'team', cd: 2, fx: 'swell | drop*4 rain | sparkle ally', text: 'Your team heals 8% of max HP. Shield of 10% max HP on itself.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.08); c.shield(c.u, c.u.maxHp * 0.1, 2); } });
defMove({ id: 'surf_rush', name: 'Roar Back', type: 'BEAST', owner: 'surf', reach: 'single', tags: ['spell'], cd: 3, fx: 'swell | hoop*3 wave | daze',
  text: 'Hits for 112% MGK. Its Empower, Haste, Fortify become Weaken, Slow, Expose.',
  run(c) { c.hit(c.tgt, { mgk: 1.12 }); if (!c.tgt.ko && !c.blocked(c.tgt)) turnStatuses(c.b, c.u, c.tgt); } });
defMove({ id: 'surf_seasound', name: 'Sea Sound', type: 'TIDE', owner: 'surf', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell | hoop*5 wave | ring splash tint all big',
  text: 'Hits for 130% MGK, and their statuses turn backward. Splash 35%. Stun 1.',
  run(c) { c.spread({ mgk: 1.3 }); for (const e of standing(c.them)) if (!c.blocked(e)) turnStatuses(c.b, c.u, e); c.st(c.tgt, 'stun', 1); } });

// fleur: a salt flower on the Conch's lip that dries whatever it touches into a crust that cracks over every foe.
defMark({ id: 'fleur_blaze', name: 'drying', max: 3, clock: 'own', negative: true, value: -0.08,
  turnStart(b, f) { const mk = f.m.fleur_blaze; const by = mk ? markedBy(b, mk) : null; if (by && live(by)) dealDamage(b, by, f, stat(b, by, 'mgk') * 0.1 * mk!.n, dot('M'), null); } });
function blaze(b: Battle, f: Fighter, t: Fighter): void {
  if (!live(t) || t.side === f.side || f.k.blazing) return;
  mark(b, f, t, 'fleur_blaze', 1, 3);
  if (marked(t, 'fleur_blaze') < 3) return;
  unmark(t, 'fleur_blaze');
  f.k.blazing = 1;
  msg(b, `The salt on ${label(b, t)} bursts.`);
  splash(b, f, stat(b, f, 'mgk') * 0.6, 'M', 'SALT');
  f.k.blazing = 0;
}
defPassive({ id: 'fleur_dries', name: 'Spray Dries', owner: 'fleur', text: 'Its hits add 1 Dry (10% MGK a turn). At 3 Dry, it cracks: every foe takes 60% MGK.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) blaze(b, f, t); } });
defPassive({ id: 'fleur_blooms', name: 'Blooms', owner: 'fleur', text: 'Turn start: heals 2% of its max HP per Dry on the foe.',
  turnStart(b, f) { const t = foe(b, f); if (t) heal(b, f, f, f.maxHp * 0.02 * marked(t, 'fleur_blaze')); } });
defMove({ id: 'fleur_spray', name: 'Spray', type: 'SALT', owner: 'fleur', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | salt*2 line | shatter',
  text: 'Hits for 102% MGK. 1.3x and Stun 1 if the foe is Dry.',
  run(c) { const lit = c.marked(c.tgt, 'fleur_blaze') > 0; c.hit(c.tgt, { mgk: 1.02 }, { mult: lit ? 1.3 : 1 }); if (lit) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'fleur_bloom', name: 'Salt Bloom', type: 'SALT', owner: 'fleur', reach: 'spread', tags: ['spell'], cd: 1, wu: 30, fx: 'sway | petal*4 rise | shatter all', text: 'Short wind-up. Hits for 70% MGK, 1.25x if the foe is Dry. Splash 35%.',
  run(c) { c.spread({ mgk: 0.7 }, { mult: c.marked(c.tgt, 'fleur_blaze') ? 1.25 : 1 }); } });
defMove({ id: 'fleur_crack', name: 'Crack', type: 'ROOT', owner: 'fleur', reach: 'single', tags: ['spell'], cd: 3, fx: 'stomp | thorn*2 line | crack', text: 'Hits for 86% MGK. If the foe was Dry: each reserve gets 1 Dry.',
  run(c) { const lit = c.marked(c.tgt, 'fleur_blaze') > 0; c.hit(c.tgt, { mgk: 0.86 }); if (lit) for (const r of reserves(c.them)) mark(c.b, c.u, r, 'fleur_blaze', 1, 3); } });
defMove({ id: 'fleur_flower', name: 'Salt Flower', type: 'SALT', owner: 'fleur', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, splash: 0.5, nerve: 5, fx: 'swell big | petal*5 return | shatter frost glare', text: 'Hits 3 times for 45% MGK. Splash 50%.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.spread({ mgk: 0.45 }); } });

// madrepore: coral grown like a hand that holds the hand of any friend near it and raps the knuckles of anyone else.
defPassive({ id: 'madrepore_kind', name: 'Kind Hand', owner: 'madrepore', text: 'Its heals are 1.3x, and a friend it heals gets Empower 1.',
  healMul() { return 1.3; },
  afterHeal(b, f, t) { if (t !== f && !t.ko) applyStatus(b, f, t, 'empower', 1); } });
defPassive({ id: 'madrepore_shaped', name: 'Shaped Hand', owner: 'madrepore', text: 'When it comes out: its first move removes 1 bad status from each ally.',
  comeOut(b, f) { f.k.shapedReady = 1; },
  afterMove(b, f) { if (!f.k.shapedReady) return; f.k.shapedReady = 0; for (const a of standing(b.s[f.side])) cleanse(b, a, 1); } });
defMove({ id: 'madrepore_rap', name: 'Hand Hold', type: 'STONE', owner: 'madrepore', reach: 'ally', cd: 2, fx: 'sway | sparkle ally', text: 'Heals an ally 14% of its max HP and itself 5%. Raps the foe for 73% ATK.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.14); if (c.ally !== c.u) c.heal(c.u, c.u.maxHp * 0.05); c.hit(c.tgt, { atk: 0.73 }); } });
defMove({ id: 'madrepore_close', name: 'Knuckle Rap', type: 'BEAST', owner: 'madrepore', reach: 'single', tags: ['projectile'], cd: 1, fx: 'lunge | bone line | crack', text: 'Hits for 229% ATK, 1.5x on a foe below 50% HP.',
  run(c) { c.hit(c.tgt, { atk: 2.29 }, { mult: c.tgt.hp < c.tgt.maxHp * 0.5 ? 1.5 : 1 }); } });
defMove({ id: 'madrepore_palm', name: 'Open Palm', type: 'STONE', owner: 'madrepore', reach: 'ally', cd: 3, fx: 'swell | ring ally', text: 'Cleanses an ally. Untouchable 1 on it.',
  run(c) { c.cleanse(c.ally!); c.st(c.ally!, 'invuln', 1); } });
defMove({ id: 'madrepore_hand', name: 'Every Hand', type: 'STONE', owner: 'madrepore', reach: 'team', cd: 6, nerve: 5, fx: 'swell big | shell*4 orbit | sparkle pillar tint all', text: 'Hits for 99% ATK. Splash 35%. Your team: Haste 2, Empower 1, cooldowns 1 shorter.',
  run(c) { c.spread({ atk: 0.99 }); for (const a of standing(c.me)) { c.st(a, 'haste', 2); c.st(a, 'empower', 1); a.cd = a.cd.map((x, i) => (MOVES[a.moves[i]]?.nerve ? x : Math.max(0, x - 1))); } } });

// blush: a pink pearl that rolls toward any voice it hears, so a foe's crest calls it off the bench to meet it.
defSummon({ id: 'blush_mine', name: 'Seed Pearl', owner: 'blush', sprite: { px: ['........', '........', '........', '...22...', '..2322..', '..2222..', '.444444.', '........'], c: ['#e8a0b0', '#fff6f9', '#a09071'] }, text: 'Stays until a foe comes out. Hits it for 40% MGK.',
  trap(b, s, who) { const f = ownerOf(b, s); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.4, 'M', 'STONE'); return true; } });
defMark({ id: 'blush_rolling', name: 'trundling', clock: 'own', volatile: true, value: 0.1,
  inMul() { return 0.9; } });
defPassive({ id: 'blush_voices', name: 'Toward Voices', owner: 'blush', text: 'When it comes out: a shield of 4% of its max HP per foe standing.',
  comeOut(b, f) { giveShield(b, f, f, f.maxHp * 0.04 * standing(b.s[1 - f.side]).length, 3); } });
defPassive({ id: 'blush_gift', name: 'Nacre Gift', owner: 'blush', text: 'In reserve: when a foe uses a crest, Shinmi rolls out to meet it first.',
  rollsIn(b, f, user, m) { return !!m.nerve && user.side !== f.side && !isOut(b, f); } });
defMove({ id: 'blush_roll', name: 'Pearl Roll', type: 'STONE', owner: 'blush', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'spin | pearl*3 line | sparkle', text: 'Hits 3 times for 31% MGK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.31 }); } });
defMove({ id: 'blush_hum', name: 'Roll Over', type: 'STONE', owner: 'blush', reach: 'spread', tags: ['dash', 'spell'], cd: 3, fx: 'spin | pearl*4 sweep | crack all',
  text: 'Hits for 72% MGK. Splash 35%. Trundling: 1.3x and Stun 1. Else: Slow 2.',
  run(c) { const r = marked(c.u, 'blush_rolling') > 0; c.spread({ mgk: 0.72 }, { mult: r ? 1.3 : 1 }); c.st(c.tgt, r ? 'stun' : 'slow', r ? 1 : 2); } });
defMove({ id: 'blush_give', name: 'Hear a Voice', type: 'SALT', owner: 'blush', reach: 'single', tags: ['dash'], cd: 3, fx: 'spin fast | pearl line | shatter',
  text: 'Hits for 75% MGK. Trundling 2: it takes 0.9x damage. Haste 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.mark(c.u, 'blush_rolling', 1, 2); c.st(c.u, 'haste', 1); } });
defMove({ id: 'blush_home', name: 'Rolls Home', type: 'STONE', owner: 'blush', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'spin | pearl*5 sweep | sparkle crack jolt all big', text: 'Hits for 50% MGK. Splash 35%. Leaves 3 Seed Pearls (4% max HP).',
  run(c) { c.spread({ mgk: 0.5 }); for (let i = 0; i < 3; i++) summon(c.b, c.u, 'blush_mine', { hp: 0.04 }); } });

// cochlea: the spiral in the Conch that sends a sound out louder, so a blow to one foe sounds again in the one behind it.
defMark({ id: 'cochlea_bound', name: 'resonant', clock: 'own', negative: true, value: -0.1,
  afterTake(b, f, src, dealt, d) {
    if (d.dot || d.reserve || f.k.bindPass || !isOut(b, f)) return;
    const mk = f.m.cochlea_bound; const by = mk ? markedBy(b, mk) : null;
    for (const r of reserves(b.s[f.side])) if (marked(r, 'cochlea_bound')) { r.k.bindPass = 1; dealDamage(b, by && live(by) ? by : null, r, dealt * 0.5, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: true }, null); r.k.bindPass = 0; }
  },
  comeOut(b, f) { const mk = f.m.cochlea_bound; const by = mk ? markedBy(b, mk) : null; if (by && has(by, 'cochlea_both')) applyStatus(b, by, f, 'silence', 1); } });
defMark({ id: 'cochlea_phantom', name: 'echo', clock: 'own', negative: true, volatile: true, value: -0.12,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; strike(b, by, f, stat(b, by, 'mgk') * 0.5, 'M', 'VOID'); if (!f.ko) applyStatus(b, by, f, 'silence', 2); } });
defPassive({ id: 'cochlea_spiral', name: 'Inner Spiral', owner: 'cochlea', text: 'Deals 1.3x damage to a Resonant foe. Hits on it pass 50% to a Resonant reserve.',
  outMul(b, f, t) { return marked(t, 'cochlea_bound') ? 1.3 : 1; } });
defPassive({ id: 'cochlea_both', name: 'Hears Both', owner: 'cochlea', text: 'When a Resonant foe comes out: Silence 1 on it.' });
defMove({ id: 'cochlea_hum', name: 'Spiral Hum', type: 'VOID', owner: 'cochlea', reach: 'spread', tags: ['spell'], cd: 1, fx: 'swell | hoop*3 spiral | ring all',
  text: 'Hits for 75% MGK. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.75 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'cochlea_ear', name: 'Inner Ear', type: 'TIDE', owner: 'cochlea', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | drop*2 spiral | daze', text: 'Hits for 40% MGK. After 2 of the foe\'s turns: it takes 50% MGK. Silence 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.4 }); if (!c.tgt.ko) c.mark(c.tgt, 'cochlea_phantom', 1, 2); } });
defMove({ id: 'cochlea_bind', name: 'Ring Through', type: 'VOID', owner: 'cochlea', reach: 'single', tags: ['spell'], cd: 3, fx: 'swell | hoop*2 line | ring', text: 'Hits for 65% MGK. Resonant 3 on the foe and its first reserve.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); const r = reserves(c.them)[0]; if (!c.tgt.ko) { c.mark(c.tgt, 'cochlea_bound', 1, 3); if (r) mark(c.b, c.u, r, 'cochlea_bound', 1, 3); } } });
defMove({ id: 'cochlea_louder', name: 'Louder Out', type: 'VOID', owner: 'cochlea', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell | hoop*5 spiral | burst vortex dark big', text: 'Hits for 140% MGK. Silence 1. Each Resonant reserve takes 140% MGK.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.4 }); c.st(c.tgt, 'silence', 1); for (const r of reserves(c.them)) if (marked(r, 'cochlea_bound')) c.hit(r, { mgk: 1.4 }, { reserve: true }); void d; } });

// samphire: a crisp salt plant from the Conch's damp turns that pickles whatever it holds and drives salt stakes into the sand.
defSummon({ id: 'samphire_ward', name: 'Salt Stake', owner: 'samphire', text: 'Each turn: hits the foe for 45% of Suomono\'s MGK.', every: 100, lasting: false,
  sprite: { px: ['..3..3..', '...33...', '...22...', '..2222..', '..2222..', '..2222..', '...22...', '.444444.'], c: ['#efefe9', '#60a836', '#7c6d4f'] },
  act(b, s, f) { const t = foeOut(b, s); if (f && t) strike(b, f, t, stat(b, f, 'mgk') * 0.45, 'M', 'ROOT'); } });
defMark({ id: 'samphire_curse', name: 'pickled', clock: 'own', negative: true, value: -0.12,
  turnStart(b, f) {
    const mk = f.m.samphire_curse; const by = mk ? markedBy(b, mk) : null;
    const lost = Math.max(0, (f.k.curseHp || f.hp) - f.hp);
    f.k.curseHp = f.hp;
    if (lost > 0) dealDamage(b, by && live(by) ? by : null, f, lost * 0.25, dot('M'), null);
  } });
defPassive({ id: 'samphire_damp', name: 'Damp Turns', owner: 'samphire', text: 'Turn start: heals 3% of its max HP, 6% while its Salt Stake stands.',
  turnStart(b, f) { heal(b, f, f, f.maxHp * (summonsOf(b, f.side, 'samphire_ward').length ? 0.06 : 0.03)); } });
defPassive({ id: 'samphire_edge', name: 'Crisp Edge', owner: 'samphire', text: 'Deals 1.25x damage to a Pickled foe.',
  outMul(b, f, t) { return marked(t, 'samphire_curse') ? 1.25 : 1; } });
defMove({ id: 'samphire_mend', name: 'Brine Mend', type: 'ROOT', owner: 'samphire', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | leaf*2 line | sparkle', text: 'Hits for 144% MGK. Your reserves heal 5% of max HP.',
  run(c) { c.hit(c.tgt, { mgk: 1.44 }); for (const r of reserves(c.me)) c.heal(r, r.maxHp * 0.05); } });
defMove({ id: 'samphire_pod', name: 'Pod Toss', type: 'TIDE', owner: 'samphire', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'lift | drop*3 arc | splash',
  text: 'Hits for 108% MGK. Stun 1. The first reserve takes 50% of it.',
  run(c) { c.hit(c.tgt, { mgk: 1.08 }); c.st(c.tgt, 'stun', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.08 }, { reserve: true, mult: 0.5 }); } });
defMove({ id: 'samphire_curse', name: 'Pickle', type: 'ROOT', owner: 'samphire', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | salt*3 converge | drip', text: 'Hits for 60% MGK. Pickled 3 turns: each turn it loses 25% of what it lost since.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); if (!c.tgt.ko) { c.tgt.k.curseHp = c.tgt.hp; c.mark(c.tgt, 'samphire_curse', 1, 3); } } });
defMove({ id: 'samphire_stake', name: 'Stake Down', type: 'ROOT', owner: 'samphire', reach: 'side', cd: 6, nerve: 5, fx: 'stomp big | salt*2 rise | pillar bloom tint ally', text: 'Summons a Salt Stake (15% of its max HP, 4 turns).',
  run(c) { summon(c.b, c.u, 'samphire_ward', { hp: 0.15, turns: 4 }); } });

// gimbal: a ring in a ring that keeps whatever sits in it level, so it pulls every uneven thing in the fight back toward even.
/** The statuses Outer Ring can swing off Tenbinka onto the foe. */
const TIPS: StatusId[] = ['root', 'slow', 'burn', 'bleed', 'poison', 'rot', 'expose', 'weaken'];
defMark({ id: 'gimbal_drain', name: 'steeping', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; const d = strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'ROOT'); heal(b, f, f, d); } });
defPassive({ id: 'gimbal_ride', name: 'Level Ride', owner: 'gimbal', text: 'Hits over 20% of its max HP deal 0.65x past it. Its next hit returns the cut.',
  beforeTake(b, f, src, amt) { const cap = f.maxHp * 0.2; if (amt <= cap) return amt; const cut = (amt - cap) * 0.35; f.k.swing = (f.k.swing || 0) + cut; return amt - cut; },
  anyMove(b, f, user) {
    if (user !== f || !f.k.swing) return;
    const t = foe(b, f), n = f.k.swing;
    f.k.swing = 0;
    if (!t) return;
    msg(b, `${label(b, f)} swings back.`);
    strike(b, f, t, n, 'T', null);
  } });
defPassive({ id: 'gimbal_tips', name: 'Even Keel', owner: 'gimbal', text: 'Each round start while out: a side 2 or more tide ahead gives the other 1.',
  roundStart(b, f) {
    if (!b.rules.nerve || !isOut(b, f)) return;
    const a = b.s[0].nerve, z = b.s[1].nerve;
    if (Math.abs(a - z) < 2) return;
    const rich = (a > z ? 0 : 1) as 0 | 1;
    addNerve(b, rich, -1);
    addNerve(b, (1 - rich) as 0 | 1, 1);
    msg(b, `${label(b, f)} keeps an even keel.`);
  } });
defMove({ id: 'gimbal_tip', name: 'Tip', type: 'GEAR', owner: 'gimbal', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | cog arc | crack',
  text: 'Hits for 158% MGK. +1% per point of HP share it trails the foe by.',
  run(c) { const gap = Math.max(0, c.tgt.hp / c.tgt.maxHp - c.u.hp / c.u.maxHp); c.hit(c.tgt, { mgk: 1.58 }, { mult: 1 + gap }); } });
defMove({ id: 'gimbal_inner', name: 'Steep', type: 'ROOT', owner: 'gimbal', reach: 'single', tags: ['spell', 'channel'], cd: 3, fx: 'sway | leaf*3 spiral | drip',
  text: 'Hits for 66% MGK, then 35% at its next 2 turns. Heals all it deals.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.66 }); c.heal(c.u, d); c.mark(c.u, 'gimbal_drain', 1, 2); } });
defMove({ id: 'gimbal_outer', name: 'Outer Ring', type: 'GEAR', owner: 'gimbal', reach: 'single', cd: 3, fx: 'spin | hoop line | ring',
  text: 'Moves its bad statuses to the foe. Hits for 72% MGK, +36% per status moved.',
  run(c) {
    let k = 0;
    for (const id of TIPS) {
      const v = c.u.s[id];
      if (!v || c.tgt.ko) continue;
      delete c.u.s[id];
      applyStatus(c.b, c.u, c.tgt, id, v.n);
      k++;
    }
    if (k) c.msg(`${label(c.b, c.u)} swings the tilt out.`);
    c.hit(c.tgt, { mgk: 0.72 + 0.36 * k });
  } });
defMove({ id: 'gimbal_level', name: 'Level', type: 'GEAR', owner: 'gimbal', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | hoop*3 orbit | sigil big tint', text: 'Its HP % and the foe\'s both become the average of the two.',
  run(c) {
    if (c.blocked(c.tgt) || c.tgt.s.unstop) return;
    const avg = (c.u.hp / c.u.maxHp + c.tgt.hp / c.tgt.maxHp) / 2;
    c.u.hp = Math.max(1, Math.round(c.u.maxHp * avg)); c.tgt.hp = Math.max(1, Math.round(c.tgt.maxHp * avg));
    syncHp(c.b, c.u); syncHp(c.b, c.tgt);
    c.msg('They level out.');
  } });

// lull: the quiet in the Conch's mouth while the big one sleeps, which takes the sound out of anything near it, so nothing near it hears.
defMark({ id: 'lull_frag', name: 'lingering', clock: 'own', volatile: true, negative: true, value: -0.04,
  turnStart(b, f) { const mk = unmark(f, 'lull_frag'); const by = mk ? markedBy(b, mk) : null; if (by && live(by)) strike(b, by, f, stat(b, by, 'mgk') * 0.35, 'M', 'VOID'); } });
defMark({ id: 'lull_hush', name: 'deaf', clock: 'side', volatile: true, negative: true, value: -0.08, deaf: true, color: '#9a9ab8' });
defPassive({ id: 'lull_notes', name: 'Missing Notes', owner: 'lull', text: 'While out, the foe across is Deaf: its passives and stances ignore what others do.',
  deafens(b, f, w) { return isOut(b, w); } });
defPassive({ id: 'lull_mouth', name: 'Quiet Mouth', owner: 'lull', text: 'Once per battle, instead of a KO: Stasis 1, back at 12% HP.',
  wouldKO(b, f) { if (f.k.stopped) return false; f.k.stopped = 1; f.hp = 1; f.s = { stasis: { n: 1, src: -1 } }; f.k.thaw = 1; f.k.thawPct = 12; msg(b, `${label(b, f)} goes very quiet.`); return true; } });
defMove({ id: 'lull_bolt', name: 'Shh', type: 'VOID', owner: 'lull', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'blink | hoop small line | daze small',
  text: 'Hits for 90% MGK. At the foe\'s next turn: 35% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); if (!c.tgt.ko) c.mark(c.tgt, 'lull_frag', 1, 2); } });
defMove({ id: 'lull_note', name: 'Low Note', type: 'TIDE', owner: 'lull', reach: 'single', tags: ['projectile', 'spell'], cd: 3, splash: 0.5, fx: 'swell | hoop*3 wave | ring all',
  text: 'Hits for 53% MGK. Splash 50%. Weaken 2. Slow 2. Each foe reserve: Deaf 2 turns.',
  run(c) { c.spread({ mgk: 0.53 }); c.st(c.tgt, 'weaken', 2); c.st(c.tgt, 'slow', 2); for (const r of reserves(c.them)) if (live(r)) c.mark(r, 'lull_hush', 1, 2); } });
defMove({ id: 'lull_seal', name: 'Hush Seal', type: 'VOID', owner: 'lull', reach: 'single', tags: ['projectile', 'spell'], cd: 4, fx: 'blink | rune line | daze',
  text: 'Hits for 55% MGK. Silence 1. Deaf for 3 turns, even once Hilzuka is gone.',
  run(c) { c.hit(c.tgt, { mgk: 0.55 }); if (c.tgt.ko) return; c.st(c.tgt, 'silence', 1); c.mark(c.tgt, 'lull_hush', 1, 3); } });
defMove({ id: 'lull_long', name: 'Long Quiet', type: 'VOID', owner: 'lull', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'sink big | hoop*5 converge | vortex all dark',
  text: 'Hits for 90% MGK. Splash 35%. Silence 1. Every foe goes Deaf for 3 turns.',
  run(c) { c.spread({ mgk: 0.9 }); if (!c.tgt.ko) c.st(c.tgt, 'silence', 1); for (const t of [c.tgt, ...reserves(c.them)]) if (live(t)) c.mark(t, 'lull_hush', 1, 3); } });

// flange: the Conch's flared lip that opens wider each time it hears its name and notches anything it closes on.
/** Opens Laibiru n wider. At 3, a Laibiru with Snaps Shut snaps shut on the out foe and leaves a Notch. */
function widen(b: Battle, f: Fighter, n: number): void {
  mark(b, f, f, 'flange_open', n, -1);
  if (marked(f, 'flange_open') < 3 || !has(f, 'flange_flared')) return;
  unmark(f, 'flange_open');
  const t = foe(b, f);
  if (!t) return;
  msg(b, `${label(b, f)} snaps shut.`);
  strike(b, f, t, stat(b, f, 'atk') * 1.1, 'P', 'GEAR');
  if (live(t)) mark(b, f, t, 'flange_hunger', 1, -1);
}
defMark({ id: 'flange_hunger', name: 'notched', max: 5, clock: 'own', negative: true, value: -0.04,
  inMul(b, f, src) { return src && src.mon.kind === 'flange' ? 1 + 0.05 * marked(f, 'flange_hunger') : 1; } });
defMark({ id: 'flange_open', name: 'wider', max: 3, clock: 'own', volatile: true, value: 0.08,
  outMul(b, f) { return 1 + 0.1 * marked(f, 'flange_open'); } });
defPassive({ id: 'flange_name', name: 'Hears Its Name', owner: 'flange', text: 'Each foe move aimed at it alone opens it Wider, max 3. Each Wider: 1.1x damage.',
  anyMove(b, f, user, m) { if (m && m.reach === 'single' && user.side !== f.side && isOut(b, f) && !f.ko) widen(b, f, 1); } });
defPassive({ id: 'flange_flared', name: 'Snaps Shut', owner: 'flange', text: 'At 3 Wider it snaps shut on the foe: 110% ATK and a Notch. Its Wider resets.' });
defMove({ id: 'flange_ring', name: 'Lip Notch', type: 'GEAR', owner: 'flange', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | fang | bite',
  text: 'Hits for 95% ATK. A Notch that lasts the battle, max 5: 1.05x from it each.',
  run(c) { c.hit(c.tgt, { atk: 0.95 }); if (!c.tgt.ko) c.mark(c.tgt, 'flange_hunger', 1, -1); } });
defMove({ id: 'flange_flare', name: 'Flare Out', type: 'STONE', owner: 'flange', reach: 'spread', cd: 2, fx: 'flare | shell*3 sweep | crack all',
  text: 'Hits for 56% ATK. Splash 35%. Each Notched foe it hits gains another Notch.',
  run(c) { c.spread({ atk: 0.56 }); for (const t of [c.tgt, ...reserves(c.them)]) if (live(t) && marked(t, 'flange_hunger')) c.mark(t, 'flange_hunger', 1, -1); } });
defMove({ id: 'flange_call', name: 'Name Call', type: 'GEAR', owner: 'flange', reach: 'self', quick: true, cd: 4, fx: 'swell | crest rise | sparkle self',
  text: 'Quick. Says its own name: it opens Wider 2. Taunt 2. Fortify 3.',
  run(c) { c.msg(`"${c.u.mon.name}!"`); widen(c.b, c.u, 2); c.st(c.tgt, 'taunt', 2); c.st(c.u, 'fortify', 3); } });
defMove({ id: 'flange_wide', name: 'Wide Open', type: 'GEAR', owner: 'flange', reach: 'single', tags: ['dash'], cd: 6, nerve: 5, fx: 'lunge | fang*2 converge | bite burst jolt big',
  text: 'Hits for 85% ATK, +15% per Wider. Under 8% HP per Notch: KO\'d, and your team gets Haste 2.',
  run(c) {
    c.hit(c.tgt, { atk: 0.85 + 0.15 * marked(c.u, 'flange_open') });
    if (c.tgt.ko || c.blocked(c.tgt) || c.tgt.hp >= c.tgt.maxHp * 0.08 * marked(c.tgt, 'flange_hunger')) return;
    c.msg('It swallows the foe whole.');
    c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true });
    if (c.tgt.ko) for (const a of standing(c.me)) c.st(a, 'haste', 2);
  } });

// pleiad: one of seven stars that fell together, which looks for its six sisters and fights beside whichever it finds.
defSummon({ id: 'pleiad_sister', name: 'Sister', owner: 'pleiad', text: 'Acts every 1.5 turns with Twinkle or Cluster. Stays until KO\'d.', every: 150,
  sprite: { px: ['........', '.3.3.3..', '..222...', '.21212..', '..242...', '.3.2.3..', '........', '........'], c: ['#ffd84a', '#ff9a20', '#6a78d8'] } });
const sisters = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'pleiad_sister').length;
function addSister(b: Battle, f: Fighter): void {
  if (sisters(b, f) < 3) summonTwin(b, f, 'pleiad_sister', { hp: 0.15, moves: ['pleiad_twinkle', 'pleiad_cluster'], link: 0.08 });
}
defPassive({ id: 'pleiad_six', name: 'Looks for Six', owner: 'pleiad', text: 'When it comes out: a Sister (15% max HP) if none. Up to 3. Each KO\'d costs it 8% HP.',
  comeOut(b, f) { if (!sisters(b, f)) addSister(b, f); } });
defPassive({ id: 'pleiad_sisters', name: 'Sisters', owner: 'pleiad', text: 'Once a round, the first hit on it lands on a Sister instead.',
  beforeTake(b, f, src, amt, d) {
    const n = b.rnd?.n ?? -1;
    if (!src || d.dot || d.reserve || !isOut(b, f) || f.k.shelter === n) return amt;
    const u = summonsOf(b, f.side, 'pleiad_sister')[0];
    if (!u) return amt;
    f.k.shelter = n;
    msg(b, 'A Sister takes it.');
    hitSummon(b, u, amt);
    return 0;
  } });
defMove({ id: 'pleiad_twinkle', name: 'Twinkle', type: 'STAR', owner: 'pleiad', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'blink | star line | sparkle',
  text: 'Hits for 56% MGK, 1.4x on a foe already Rooted. Root 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.56 }, { mult: c.tgt.s.root ? 1.4 : 1 }); c.st(c.tgt, 'root', 1); } });
defMove({ id: 'pleiad_cluster', name: 'Cluster', type: 'STONE', owner: 'pleiad', reach: 'single', tags: ['spell'], cd: 1, fx: 'swell | pebble*3 converge | crack',
  text: 'Hits for 58% MGK + 15% MGK per Sister.',
  run(c) { c.hit(c.tgt, { mgk: 0.58 + 0.15 * sisters(c.b, c.u) }); } });
defMove({ id: 'pleiad_call', name: 'Call Out', type: 'STAR', owner: 'pleiad', reach: 'side', cd: 3, fx: 'swell | star*3 orbit | sparkle ally',
  text: 'Calls a Sister. With 3 already, the eldest flies at the foe: 39% MGK.',
  run(c) {
    const all = summonsOf(c.b, c.u.side, 'pleiad_sister');
    if (all.length < 3) { addSister(c.b, c.u); return; }
    const t = foe(c.b, c.u);
    c.msg('The eldest Sister flies at the foe.');
    dismiss(c.b, all[0]);
    if (t) strike(c.b, c.u, t, stat(c.b, c.u, 'mgk') * 0.39, 'M', 'STAR');
    addSister(c.b, c.u);
  } });
defMove({ id: 'pleiad_seven', name: 'Seven Fall', type: 'STAR', owner: 'pleiad', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift big | star*7 rain | flash all glare', text: 'Hits for 53% MGK + 15% per Sister. Splash 35%. Calls 2 Sisters.',
  run(c) { c.spread({ mgk: 0.53 + 0.15 * sisters(c.b, c.u) }); addSister(c.b, c.u); addSister(c.b, c.u); } });

// aphelion: a star on its way back from as far out as it could go, hotter and quicker the closer it comes.
defMark({ id: 'aphelion_close', name: 'closer', max: 4, clock: 'own', volatile: true, value: 0.05,
  outMul(b, f) { return 1 + 0.08 * marked(f, 'aphelion_close'); },
  speedMul(b, f) { return 1 - 0.05 * marked(f, 'aphelion_close'); } });
defMark({ id: 'aphelion_spears', name: 'glow', max: 5, clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.aphelion_spears; const by = mk ? markedBy(b, mk) : null; if (mk) dealDamage(b, by && live(by) ? by : null, f, (by ? stat(b, by, 'mgk') : 50) * 0.1 * mk.n, dot('M'), null); } });
defPassive({ id: 'aphelion_way', name: 'On Its Way', owner: 'aphelion', text: 'Each turn it stays out it comes Closer, max 4: 1.08x damage, 5% quicker each.',
  turnEnd(b, f) { if (isOut(b, f) && !f.ko) mark(b, f, f, 'aphelion_close', 1, -1); } });
defPassive({ id: 'aphelion_far', name: 'Far Side', owner: 'aphelion', text: 'Coming back out, it heals 10% of its max HP per round it was away, up to 30%.',
  leave(b, f) { f.k.awayAt = roundOf(b); },
  comeOut(b, f) {
    const at = f.k.awayAt;
    delete f.k.awayAt;
    if (at === undefined || f.ko) return;
    const n = Math.min(3, roundOf(b) - at);
    if (n > 0) heal(b, f, f, f.maxHp * 0.1 * n);
  } });
defMove({ id: 'aphelion_spear', name: 'Return Flare', type: 'STAR', owner: 'aphelion', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | comet line | burst',
  text: 'Hits for 93% MGK. A Glow, max 5: 10% MGK at each of the foe\'s turns.',
  run(c) { c.hit(c.tgt, { mgk: 0.93 }); if (!c.tgt.ko) c.mark(c.tgt, 'aphelion_spears', 1, 4); } });
defMove({ id: 'aphelion_farout', name: 'Far Out', type: 'STONE', owner: 'aphelion', reach: 'single', tags: ['projectile'], cd: 2, fx: 'lift | pebble*2 arc | crack',
  text: 'Hits for 93% MGK, 1.5x while it is not yet Closer.',
  run(c) { c.hit(c.tgt, { mgk: 0.93 }, { mult: marked(c.u, 'aphelion_close') ? 1 : 1.5 }); } });
defMove({ id: 'aphelion_swing', name: 'Swing Back', type: 'STAR', owner: 'aphelion', reach: 'spread', tags: ['spell'], cd: 3, tag: true, fx: 'spin | star*3 sweep | sparkle all',
  text: 'Hits for 65% MGK. Splash 35%. Weaken 1. Heals 8% max HP. Swaps in an ally.',
  run(c) { c.spread({ mgk: 0.65 }); c.st(c.tgt, 'weaken', 1); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'aphelion_back', name: 'Comes Back', type: 'STAR', owner: 'aphelion', reach: 'single', tags: ['dash'], cd: 6, nerve: 5, fx: 'lunge big | comet*3 line | burst big glare',
  text: 'Hits for 76% MGK, +38% for each Closer. Slow 2. Pays 10% of its max HP.',
  run(c) { selfCost(c.b, c.u, c.u.maxHp * 0.1); c.hit(c.tgt, { mgk: 0.76 + 0.38 * marked(c.u, 'aphelion_close') }); c.st(c.tgt, 'slow', 2); } });

// astrolabe: the Tide-reader's grandmother's brass star-measurer, which measures before it acts and acts on the fourth reading.
defMark({ id: 'astrolabe_shrapnel', name: 'stars falling', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (t) { strike(b, f, t, stat(b, f, 'mgk') * 0.23, 'M', 'STAR'); if (live(t)) applyStatus(b, f, t, 'slow', 1); } } });
defPassive({ id: 'astrolabe_measuring', name: 'Measuring', owner: 'astrolabe', text: 'Every 4th hit it lands deals 1.6x and delays the foe\'s next turn by 20%.',
  outMul(b, f, t, d) { return !d.dot && !d.reserve && (f.k.reading || 0) % 4 === 3 ? 1.6 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; if ((f.k.reading || 0) % 4 === 3 && live(t)) delayFighter(b, t, 20); f.k.reading = (f.k.reading || 0) + 1; } });
defPassive({ id: 'astrolabe_longsight', name: 'Long Sight', owner: 'astrolabe', text: 'It may Measure in a joint round: choose after the foe acts, and deal 1.2x.',
  waits() { return true; },
  outMul(b, f) { return b.waited === f.side ? 1.2 : 1; } });
defMove({ id: 'astrolabe_sight', name: 'Sight Line', type: 'GEAR', owner: 'astrolabe', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | beam ray | flash', text: 'Hits for 107% MGK. Counts as 2 hits toward Measuring.',
  run(c) { c.hit(c.tgt, { mgk: 1.07 }); if (!c.preview && (c.u.k.reading || 0) % 4 !== 3) c.u.k.reading = (c.u.k.reading || 0) + 1; } });
defMove({ id: 'astrolabe_ring', name: 'Brass Ring', type: 'GEAR', owner: 'astrolabe', reach: 'spread', tags: ['projectile', 'spell'], cd: 3, fx: 'spin | hoop*2 sweep | ring all',
  text: 'Hits for 45% MGK. Splash 35%. Slow 2. The out foe\'s ready moves wait 1 more turn.',
  run(c) { c.spread({ mgk: 0.45 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) shiftCd(c.b, c.tgt, 'ready', 1); } });
defMove({ id: 'astrolabe_shower', name: 'Star Shower', type: 'STAR', owner: 'astrolabe', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'lift | star*4 rain | sparkle',
  text: 'Hits for 38% MGK. At its next 3 turns: hits the foe for 23% MGK, Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.38 }); c.mark(c.u, 'astrolabe_shrapnel', 1, 3); } });
defMove({ id: 'astrolabe_last', name: 'Last Reading', type: 'GEAR', owner: 'astrolabe', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 5, fx: 'swell big | rune*4 converge | sigil big glare',
  text: 'Hits for 140% MGK. It always lands as the 4th hit of Measuring.',
  run(c) {
    if (!c.preview) { const r = c.u.k.reading || 0; c.u.k.reading = r + (7 - r % 4) % 4; }
    c.hit(c.tgt, { mgk: 1.4 });
  } });

// pallasite: a fallen star, green and cold inside, caught in a shell before it touched sand, which shuts the shell again when hurt.
defSummon({ id: 'pallasite_wall', name: 'Shell Wall', owner: 'pallasite', text: 'Takes the single-target hits meant for your out whorl.', every: 100, guard: true,
  sprite: { px: ['........', '3.3..3.3', '33333333', '32222223', '32222223', '33333333', '44444444', '44444444'], c: ['#ebf3fa', '#73bbe3', '#395594'] },
  act() { /* the wall only stands */ } });
defMark({ id: 'pallasite_chill', name: 'chill', max: 3, clock: 'own', negative: true, volatile: true, value: -0.06,
  outMul(b, f) { return 1 - 0.05 * marked(f, 'pallasite_chill'); } });
defMark({ id: 'pallasite_shut', name: 'shut', clock: 'own', volatile: true, value: 0.15, color: '#73bbe3',
  inMul() { return 0.5; },
  outMul() { return 1.3; } });
defPassive({ id: 'pallasite_caught', name: 'Caught Shell', owner: 'pallasite', text: 'Once per battle, instead of a KO: Stasis 1, back at 25% HP.',
  wouldKO(b, f) { if (f.k.caught) return false; f.k.caught = 1; f.hp = 1; f.s = { stasis: { n: 1, src: -1 } }; f.k.thaw = 1; f.k.thawPct = 25; msg(b, `${label(b, f)} shuts its shell.`); return true; } });
defPassive({ id: 'pallasite_unspent', name: 'Shell Shuts', owner: 'pallasite', text: 'A hit of 25%+ max HP shuts it to the end of its next turn: 0.5x taken, 1.3x dealt.',
  afterTake(b, f, src, dealt, d) {
    if (d.dot || f.ko || dealt < f.maxHp * 0.25 || marked(f, 'pallasite_shut')) return;
    mark(b, f, f, 'pallasite_shut', 1, 1);
    msg(b, `${label(b, f)} shuts its shell.`);
  } });
defMove({ id: 'pallasite_glint', name: 'Green Glint', type: 'STAR', owner: 'pallasite', reach: 'single', tags: ['spell'], cd: 1, fx: 'blink | shard line | frost',
  text: 'Hits for 85% MGK. Slow 1. +1 Chill (5% less damage each). At 3: Stun 1, Chill ends.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.st(c.tgt, 'slow', 1); if (c.tgt.ko) return; c.mark(c.tgt, 'pallasite_chill', 1, 2); if (marked(c.tgt, 'pallasite_chill') >= 3) { unmark(c.tgt, 'pallasite_chill'); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'pallasite_sparks', name: 'Iron Sparks', type: 'GEAR', owner: 'pallasite', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'flare | spark*4 zigzag | fizz',
  text: 'Hits for 100% MGK, then its shell shuts until its next turn ends.',
  run(c) { c.hit(c.tgt, { mgk: 1.0 }); c.mark(c.u, 'pallasite_shut', 1, 1); } });
defMove({ id: 'pallasite_dive', name: 'Half Shell', type: 'STAR', owner: 'pallasite', reach: 'side', cd: 4, fx: 'sink | shell rise | ring ally', text: 'Summons a Shell Wall (20% of its max HP, 2 turns).',
  run(c) { summon(c.b, c.u, 'pallasite_wall', { hp: 0.2, turns: 2 }); } });
defMove({ id: 'pallasite_nova', name: 'Shell Nova', type: 'STAR', owner: 'pallasite', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, fx: 'swell big | shard*6 sweep | shatter all glare',
  text: 'Hits for 90% MGK, each foe +20% per Chill it carries. Splash 35%. Slow 2.',
  run(c) {
    for (const t of [c.tgt, ...reserves(c.them)]) {
      if (!live(t)) continue;
      const mult = 1 + (0.2 / 0.9) * marked(t, 'pallasite_chill');
      if (t === c.tgt) c.hit(t, { mgk: 0.9 }, { spread: true, mult });
      else c.hit(t, { mgk: 0.9 }, { spread: true, reserve: true, mult: mult * 0.35 });
    }
    c.st(c.tgt, 'slow', 2);
  } });

// halophile: a pink bloom off the saltiest pool on the Strand, which turns the water pink and grows pinker with every whorl that falls.
defPassive({ id: 'halophile_water', name: 'Pink Water', owner: 'halophile', text: 'When it comes out, 2 of the foe\'s tide turn pink for 3 rounds. Pink pays no crest.',
  comeOut(b, f) { pinkTide(b, otherSide(f), 2, 3); } });
defPassive({ id: 'halophile_lip', name: 'Lip Color', owner: 'halophile', text: 'Each whorl that falls, on either side, turns 1 of the foe\'s tide pink for 3 rounds.',
  anyKO(b, f, v) { if (v !== f && !f.ko) pinkTide(b, otherSide(f), 1, 3); } });
defMove({ id: 'halophile_bloom', name: 'Pink Bloom', type: 'ROOT', owner: 'halophile', reach: 'single', tags: ['spell'], cd: 3, fx: 'swell | petal*4 spiral | bloom',
  text: 'Hits for 118% MGK, the first reserve for 30%. Stun 1. 2 of the foe\'s tide turn pink.',
  run(c) {
    c.hit(c.tgt, { mgk: 1.18 }); c.st(c.tgt, 'stun', 1);
    const r = reserves(c.them)[0];
    if (r) c.hit(r, { mgk: 1.18 }, { reserve: true, mult: 0.375 });
    if (!c.blocked(c.tgt)) pinkTide(c.b, otherSide(c.u), 2, 3);
  } });
defMove({ id: 'halophile_draw', name: 'Salt Draw', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell', 'channel'], cd: 1, fx: 'sway | salt*3 converge | drip',
  text: 'Hits for 103% MGK. Takes 1 clear tide from the foe\'s side.',
  run(c) { c.hit(c.tgt, { mgk: 1.03 }); if (c.them.nerve - pinkOf(c.b, otherSide(c.u)) > 0 && !c.blocked(c.tgt)) { c.nerve(c.them, -1); c.nerve(c.me, 1); } } });
defMove({ id: 'halophile_stain', name: 'Stain Water', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell'], cd: 4, fx: 'sink | drop*4 rain | drip all tint',
  text: 'Hits for 67% MGK. Every tide the foe holds turns pink for 2 rounds.',
  run(c) { c.hit(c.tgt, { mgk: 0.67 }); if (!c.blocked(c.tgt)) pinkTide(c.b, otherSide(c.u), NERVE_MAX, 2); } });
defMove({ id: 'halophile_pink', name: 'Pink Pool', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'sink big | drop*6 converge | splash big tint',
  text: 'Hits for 155% MGK, +19% per pink tide the foe holds. That tide runs clear.',
  run(c) { const side = otherSide(c.u), n = pinkOf(c.b, side); c.hit(c.tgt, { mgk: 1.55 + 0.19 * n }); if (n && !c.preview) clearPink(c.b, side); } });

// heirloom: the oldest whorl in the Gleaner's Tray, empty so long nobody knows what grew in it, which takes the best thing you have.
/** The stats Old Dust can take, in the order its marks number them from 1. */
const HEIR_STATS = ['atk', 'mgk', 'def', 'res', 'agi'] as const;
defMark({ id: 'heirloom_dust', name: 'dusted', clock: 'own', volatile: true, negative: true, value: -0.08,
  statBonus(f, k) { const i = (f.m.heirloom_dust?.v || 0) - 1; return i >= 0 && HEIR_STATS[i] === k ? -0.1 * f.st[k] : 0; } });
defMark({ id: 'heirloom_kept', name: 'kept', clock: 'own', volatile: true, value: 0.08,
  statBonus(f, k) { const i = (f.m.heirloom_kept?.v || 0) - 1; return i >= 0 && HEIR_STATS[i] === k ? (f.k.keptAmt || 0) : 0; } });
defMark({ id: 'heirloom_taken', name: 'move taken', max: 1, value: -0.3,
  forbid(b, f, what) { return isMove(what) && f.k.heirTaken && f.moves[f.k.heirTaken - 1] === what.id ? 'Taken.' : null; } });
defPassive({ id: 'heirloom_unknown', name: 'Unknown Grower', owner: 'heirloom', text: 'When it uses a move: its next attack also hits reserves for 40% MGK.',
  afterMove(b, f) { f.k.burst = 1; },
  afterAttack(b, f) { if (!f.k.burst) return; f.k.burst = 0; for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.4, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'heirloom_longest', name: 'Kept Longest', owner: 'heirloom', text: 'Immune to Silence. Cannot be forced out.',
  statusImmune(f, id) { return id === 'silence'; },
  immovable() { return true; } });
defMove({ id: 'heirloom_dust', name: 'Old Dust', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | sand*4 wave | smoke',
  text: 'Hits for 100% MGK. Slow 2. Takes 10% of the foe\'s best stat for 3 turns.',
  run(c) {
    c.hit(c.tgt, { mgk: 1.0 }); c.st(c.tgt, 'slow', 2);
    if (!live(c.tgt) || c.blocked(c.tgt)) return;
    let k = 0;
    HEIR_STATS.forEach((st, i) => { if (c.tgt.st[st] > c.tgt.st[HEIR_STATS[k]]) k = i; });
    c.mark(c.tgt, 'heirloom_dust', 1, 3, k + 1);
    c.u.k.keptAmt = 0.1 * c.tgt.st[HEIR_STATS[k]];
    c.mark(c.u, 'heirloom_kept', 1, 3, k + 1);
  } });
defMove({ id: 'heirloom_faded', name: 'Faded Label', type: 'TIDE', owner: 'heirloom', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | card line | drip',
  text: 'Hits for 105% MGK and heals 30% of it. Takes one good status from the foe as its own.',
  run(c) {
    const d = c.hit(c.tgt, { mgk: 1.05 }); c.heal(c.u, d * 0.3);
    if (!live(c.tgt) || c.blocked(c.tgt)) return;
    const id = GOOD.find(g => c.tgt.s[g]);
    if (!id) return;
    const n = c.tgt.s[id]!.n;
    delete c.tgt.s[id];
    c.st(c.u, id, n);
    c.msg(`${label(c.b, c.u)} takes it.`);
  } });
defMove({ id: 'heirloom_nobody', name: 'Nobody Knows', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'blink | rune*2 orbit | smoke', text: 'Hits for 87% MGK. 12% max HP shield. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.87 }); c.shield(c.u, c.u.maxHp * 0.12, 2); c.hasten(c.u, 20); } });
defMove({ id: 'heirloom_take', name: 'Take to Keep', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['spell'], cd: 6, nerve: 4,
  fx: 'swell big | rune*3 converge | sigil big dark', text: 'Hits for 87% MGK. Takes the foe\'s crest for the battle, in this slot.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    const t = c.tgt;
    c.hit(t, { mgk: 0.87 });
    if (!live(t) || t.k.heirTaken || c.preview) return;
    let best = -1, bv = -1;
    t.moves.forEach((id, i) => {
      const m = MOVES[id];
      if (!m || c.u.moves.includes(id)) return;
      const v = (m.nerve || 0) * 10 + m.cd;
      if (v > bv) { bv = v; best = i; }
    });
    if (best < 0) return;
    const id = t.moves[best];
    t.k.heirTaken = best + 1;
    mark(c.b, c.u, t, 'heirloom_taken', 1, -1);
    const mine = slotOf(c.u, 'heirloom_take');
    if (mine >= 0) setMove(c.b, c.u, mine, id);
    c.msg(`${label(c.b, c.u)} takes ${MOVES[id].name} and keeps it.`);
  } });

// lodestar: the star the Gleaner walked by and took down, which still points one way and keeps every turn in order around it.
defSummon({ id: 'lodestar_star', name: 'Fixed Star', owner: 'lodestar', text: 'Stays until spent. Bearing and Steer By each spend one for an extra effect.',
  sprite: { px: ['........', '........', '..2.....', '.222223.', '..2.....', '........', '........', '........'], c: ['#f6f2de', '#f0b22c', '#4d4d7a'] } });
const stars = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'lodestar_star');
function placeStar(b: Battle, f: Fighter): void { if (stars(b, f).length < 3) summon(b, f, 'lodestar_star', { hp: 0.06 }); }
function spendStar(b: Battle, f: Fighter): boolean { const s = stars(b, f)[0]; if (!s) return false; dismiss(b, s); return true; }
defMark({ id: 'lodestar_kept', name: 'kept in order', volatile: true, max: 1, value: -0.08,
  turnEnd(b, f) {
    const by = placer(b, f, 'lodestar_kept'); if (by === false) return;
    if (!by || !live(by) || !isOut(b, by)) { unmark(f, 'lodestar_kept'); return; }
    b.s[f.side].next = Math.max(b.s[f.side].next, b.s[by.side].next + 1);
  } });
defMark({ id: 'lodestar_steer', name: 'pulled in', negative: true, volatile: true, max: 1, clock: 'own', value: -0.06,
  forbid(b, f, what) { return what === 'switch' ? 'Pulled in.' : null; } });
defMark({ id: 'lodestar_point', name: 'bearing', clock: 'own', volatile: true, value: 0.1,
  aims(b, f) {
    const code = f.m.lodestar_point?.v || 0;
    const t = code ? b.s[Math.floor((code - 1) / 8)]?.f[(code - 1) % 8] : null;
    return live(t) && t.side !== f.side ? t : null;
  } });
defMark({ id: 'lodestar_divide', name: 'behind a divide', clock: 'own', volatile: true, value: 0.15,
  intercept(b, f, user, m) { return isOut(b, f) && user.side !== f.side && m.tags?.includes('projectile') ? 'block' : null; } });
defPassive({ id: 'lodestar_walked', name: 'Walked By', owner: 'lodestar', text: 'While it is out: the foe never takes two turns in a row. Can\'t be delayed.',
  noDelay() { return true; },
  comeOut(b, f) { const t = foeOf(b, f); if (live(t)) mark(b, f, t, 'lodestar_kept', 1, -1); },
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f)) mark(b, f, who, 'lodestar_kept', 1, -1); } });
defPassive({ id: 'lodestar_steady', name: 'Star Chart', owner: 'lodestar', text: 'When it comes out: 2 Fixed Stars (6% max HP), up to 3. Immune to Stun, Slow.',
  statusImmune(f, id) { return id === 'stun' || id === 'slow'; },
  comeOut(b, f) { placeStar(b, f); placeStar(b, f); } });
defMove({ id: 'lodestar_bearing', name: 'Bearing', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | star line | sparkle',
  text: 'Hits for 135% MGK. Spends a Fixed Star: delays it 30%, and its moves find it 3 turns.',
  run(c) {
    c.hit(c.tgt, { mgk: 1.35 });
    if (live(c.tgt) && !c.blocked(c.tgt) && !c.preview && spendStar(c.b, c.u)) { c.delay(c.tgt, 30); c.mark(c.u, 'lodestar_point', 1, 3, c.tgt.side * 8 + c.tgt.idx + 1); }
  } });
defMove({ id: 'lodestar_fix', name: 'Star Fix', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 2, fx: 'lift | star rise | sparkle', text: 'Hits for 116% MGK. Weaken 1. Places a Fixed Star.',
  run(c) { placeStar(c.b, c.u); c.hit(c.tgt, { mgk: 1.16 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'lodestar_steer', name: 'Steer By', type: 'GEAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 3, fx: 'spin | bolt line | ring',
  text: 'Hits for 110% MGK. Expose 2. Spends a Fixed Star: the foe can\'t switch 2 turns.',
  run(c) { if (c.blocked(c.tgt)) return; c.hit(c.tgt, { mgk: 1.1 }); c.st(c.tgt, 'expose', 2); if (!c.tgt.ko && spendStar(c.b, c.u)) c.mark(c.tgt, 'lodestar_steer', 1, 2); } });
defMove({ id: 'lodestar_course', name: 'Kept Course', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | star*5 converge | flash big glare', text: 'Hits for 194% MGK. 2 turns: blocks the foe\'s projectile moves.',
  run(c) { c.hit(c.tgt, { mgk: 1.94 }); c.mark(c.u, 'lodestar_divide', 1, 2); } });

// ammonite: a coiled shell from a beach that is gone, which lies still until struck and keeps every blow in its chambers to give back.
defPassive({ id: 'ammonite_coil', name: 'Oldest Coil', owner: 'ammonite', text: 'Takes 0.9x damage, 0.4x during Sleep. First time it comes out: Sleep 1.',
  comeOut(b, f) { if (f.k.coiled) return; f.k.coiled = 1; applyStatus(b, f, f, 'sleep', 1); },
  inMul(b, f) { return f.s.sleep ? 0.4 : 0.9; } });
defPassive({ id: 'ammonite_struck', name: 'Struck Into', owner: 'ammonite', text: 'Keeps 70% of the damage it takes as Struck, up to 60% of its max HP.',
  afterTake(b, f, src, dealt, d) {
    if (d.dot) return;
    f.k.struck = Math.min(f.maxHp * 0.6, (f.k.struck || 0) + dealt * 0.7);
    if (enemyOf(f, src)) f.k.wasStruck = 1;
  },
  turnEnd(b, f) { f.k.wasStruck = 0; } });
defMove({ id: 'ammonite_knock', name: 'Coil Knock', type: 'BEAST', owner: 'ammonite', reach: 'spread', cd: 3, fx: 'spin | shell*3 sweep | quake all',
  text: 'Hits for 45% ATK, 1.4x if it was struck since its last turn. Splash 35%. Stun 1.',
  run(c) { c.spread({ atk: 0.45 }, { mult: c.u.k.wasStruck ? 1.4 : 1 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'ammonite_ridge', name: 'Spiral Ridge', type: 'STONE', owner: 'ammonite', reach: 'single', cd: 1, fx: 'spin | shell spiral | crack', text: 'Hits for 108% ATK. Pays 5% of its max HP, which adds to Struck.',
  run(c) {
    selfCost(c.b, c.u, c.u.maxHp * 0.05);
    c.hit(c.tgt, { atk: 1.08 });
    if (!c.preview) c.u.k.struck = Math.min(c.u.maxHp * 0.6, (c.u.k.struck || 0) + c.u.maxHp * 0.05);
  } });
defMove({ id: 'ammonite_septa', name: 'Septa', type: 'STONE', owner: 'ammonite', reach: 'team', cd: 4, fx: 'swell | hoop*3 rise | sparkle ally', text: 'Haste 2 on your team. Fortify 1. Struck grows by 10% of its max HP.',
  run(c) {
    for (const a of standing(c.me)) c.st(a, 'haste', 2);
    c.st(c.u, 'fortify', 1);
    if (!c.preview) c.u.k.struck = Math.min(c.u.maxHp * 0.6, (c.u.k.struck || 0) + c.u.maxHp * 0.1);
  } });
defMove({ id: 'ammonite_all', name: 'All Struck', type: 'STONE', owner: 'ammonite', reach: 'single', cd: 6, nerve: 5,
  fx: 'stomp big | shell*4 converge | quake big glare', text: 'Hits for 100% ATK + all its Struck. Struck of 30% max HP or more: Stun 1.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    const s = c.u.k.struck || 0;
    c.hit(c.tgt, { atk: 1, flat: s });
    if (s >= c.u.maxHp * 0.3) c.st(c.tgt, 'stun', 1);
    if (!c.preview) c.u.k.struck = 0;
  } });

// ================================================================ the Gleaner

// The Gleaner listens, labels, lifts, and sets down. Holding a whorl to its ear is the one habit that stops it.
defMark({ id: 'gleaner_label', name: 'labeled', negative: true, volatile: true, max: 1, clock: 'own', value: -0.12,
  forbid(b, f, what) { return what === 'switch' ? 'Labeled.' : null; },
  inMul(b, f, src) { return src && placer(b, f, 'gleaner_label') === src ? 1.25 : 1; } });
defMark({ id: 'gleaner_ear', name: 'listening', max: 1, clock: 'any', value: -0.2,
  expire(b, f) { setDown(b, f); } });
function labelFoe(b: Battle, g: Fighter, t: Fighter, c?: Ctx): void {
  if (!live(t)) return;
  const ok = c ? c.mark(t, 'gleaner_label', 1, 3) : mark(b, g, t, 'gleaner_label', 1, 3);
  if (ok) msg(b, `Label: KEEP THE ${t.mon.name.toUpperCase()}.`);
}
function lift(b: Battle, g: Fighter, t: Fighter): void {
  const s = b.s[t.side];
  g.k.held = t.side * 8 + t.idx + 1;
  mark(b, g, g, 'gleaner_ear', 1, 3);
  msg(b, `${label(b, g)} lifts ${t.mon.name} to its ear and listens.`);
  const to = nextInLine(s);
  if (to < 0 || !has(g, 'gleaner_listening')) { applyStatus(b, g, t, 'stasis', 2); g.k.heldGone = 0; return; }
  interrupt(b, t, g);
  const keep = s.next;
  cameInForced(b, s.f[to]);
  doSwitch(b, t.side, to, true);
  t.gone = true;
  g.k.heldGone = 1;
  s.next = keep;
  msg(b, `${label(b, s.f[to])} comes out.`);
}
function setDown(b: Battle, g: Fighter): void {
  const code = g.k.held || 0;
  if (!code) return;
  g.k.held = 0;
  unmark(g, 'gleaner_ear');
  const t = b.s[Math.floor((code - 1) / 8)].f[(code - 1) % 8];
  if (!t || t.ko) return;
  if (g.k.heldGone) t.gone = false;
  g.k.heldGone = 0;
  t.cd = t.cd.map(() => 0);
  msg(b, `${label(b, g)} sets ${t.mon.name} down, very carefully.`);
}
defPassive({ id: 'gleaner_wade', name: 'Wading', owner: 'gleaner', text: 'Turn start, unhit since its last turn: repeats its last attack at 0.9x.',
  comeOut(b, f) { f.k.wadeMove = 0; f.k.wadeHit = 0; },
  afterTake(b, f, src, dealt, d) { if (!d.dot && enemyOf(f, src)) f.k.wadeHit = 1; },
  afterMove(b, f, m) { if (!m.nerve && (m.reach === 'single' || m.reach === 'spread')) f.k.wadeMove = slotOf(f, m.id) + 1; },
  turnStart(b, f) {
    const again = !f.k.wadeHit && f.k.wadeMove && !f.s.stun && !f.s.sleep && !marked(f, 'gleaner_ear');
    f.k.wadeHit = 0;
    if (!again || !live(foeOf(b, f))) return;
    const m = MOVES[f.moves[f.k.wadeMove - 1]];
    if (!m) return;
    msg(b, `${label(b, f)} does ${m.name} again.`);
    runMove(b, f, f.k.wadeMove - 1, {}, false, 0.9);
  } });
defPassive({ id: 'gleaner_listening', name: 'Listening', owner: 'gleaner', text: '1.3x max HP. Takes 0.75x damage, 1.3x while it holds a whorl to its ear.',
  start(b, f) { f.maxHp = Math.round(f.maxHp * 1.3); f.hp = f.maxHp; },
  inMul(b, f) { return marked(f, 'gleaner_ear') ? 1.3 : 0.75; },
  immovable() { return true; },
  forbid(b, f, what) { return isMove(what) && what.id === 'gleaner_hold' && !marked(foeOf(b, f), 'gleaner_label') ? 'It labels first.' : null; },
  anyKO(b, f, v) {
    if (!f.k.held) return;
    if (v === f) { setDown(b, f); return; }
    const side = Math.floor((f.k.held - 1) / 8) as 0 | 1;
    if (v.side === side && standing(b.s[side]).length === 0) setDown(b, f);
  } });
defMove({ id: 'gleaner_listen', name: 'Listen', type: 'VOID', owner: 'gleaner', reach: 'single', cd: 1, fx: 'sway | hoop*2 converge | daze', text: 'Hits for 145% ATK. +12% damage per foe move on cooldown, up to 4.',
  run(c) { c.hit(c.tgt, { atk: 1.45 }, { mult: 1 + 0.12 * Math.min(4, onCooldown(c.tgt)) }); } });
defMove({ id: 'gleaner_label', name: 'Label', type: 'VOID', owner: 'gleaner', reach: 'single', cd: 3,
  fx: 'stomp | card line | sigil', text: 'Hits for 115% ATK. Labeled 3: can\'t switch, takes 1.25x from it.',
  run(c) { if (c.blocked(c.tgt)) return; c.hit(c.tgt, { atk: 1.15 }); labelFoe(c.b, c.u, c.tgt, c); } });
defMove({ id: 'gleaner_setdown', name: 'Set Down', type: 'TIDE', owner: 'gleaner', reach: 'single', cd: 3,
  fx: 'lift | drop*3 arc | splash', text: 'Hits for 135% ATK. Forces the foe out. Labeled 3 on the new foe.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    c.hit(c.tgt, { atk: 1.35 });
    if (live(c.tgt) && c.forceOut()) labelFoe(c.b, c.u, c.them.f[c.them.out]);
  } });
defMove({ id: 'gleaner_hold', name: 'Hold to Ear', type: 'VOID', owner: 'gleaner', reach: 'single', cd: 6, nerve: 4, wt: 200,
  fx: 'lift big | hoop*3 orbit | vortex dark', text: 'Lifts a Labeled foe out for 2 turns. The foe that comes out counts as forced. Its next turn comes 100% later.',
  run(c) { if (c.blocked(c.tgt) || c.preview || !live(c.tgt)) return; lift(c.b, c.u, c.tgt); } });

// ================================================================ notions

defNotion({ id: 'tallystone', name: 'Tally Stone', price: 600, text: '+6% ATK and MGK. Every 3rd turn it takes: +1 tide.',
  pct: { atk: 0.06, mgk: 0.06 },
  turnEnd(b, f) { f.k.tally = (f.k.tally || 0) + 1; if (f.k.tally % 3 === 0) addNerve(b, f.side, 1); } });
defNotion({ id: 'siphoncup', name: 'Siphon Cup', price: 700, text: '+6% HP. Its crests heal it 4% of max HP per tide they cost.',
  pct: { hp: 0.06 },
  afterMove(b, f, m) { if (m.nerve) heal(b, f, f, f.maxHp * 0.04 * m.nerve); } });
defMark({ id: 'siphonhood_seal', name: 'sealed note', negative: true, max: 1, clock: 'own', value: -0.15,
  forbid(b, f, what) { const mk = f.m.siphonhood_seal; return mk && isMove(what) && f.moves[mk.v - 1] === what.id ? 'Sealed.' : null; } });
defNotion({ id: 'siphonhood', name: 'Siphon\'s Hood', price: 800, text: '+20% RES. Action, once: seals the foe\'s last-used move for 3 turns.',
  pct: { res: 0.2 },
  action: { name: 'Siphon\'s Hood', run(b, f) {
    const t = foeOf(b, f);
    const i = live(t) ? (t.k.lastMove || 0) - 1 : -1;
    if (i < 0) { msg(b, 'There is nothing to seal.'); return; }
    mark(b, f, t, 'siphonhood_seal', 1, 3, i + 1);
    msg(b, `${label(b, t)} cannot use ${MOVES[t.moves[i]]?.name || 'that move'} for 3 turns.`);
  } } });
defNotion({ id: 'polishedring', name: 'Polished Ring', price: 600, text: '+5% ATK and MGK. Its first hit deals 1.3x damage and ignores guard and Fortify.',
  pct: { atk: 0.05, mgk: 0.05 },
  outMul(b, f, t, d) {
    if (f.k.ringDone || d.dot || d.reserve) return 1;
    let m = 1.3;
    if (t.s.guard && !d.move?.noGuard) m *= 2;
    if (t.s.fortify) m /= 1 - (t.s.fortify.v || 0.25);
    return m;
  },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) f.k.ringDone = 1; } });

export const KITS6_NOTIONS = ['tallystone', 'siphoncup', 'siphonhood', 'polishedring'];
