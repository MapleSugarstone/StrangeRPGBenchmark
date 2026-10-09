import {
  addNerve, applyStatus, banish, canSwitch, cleanse, clearForm, dealDamage, delayFighter, disguise, dismiss, emit, foeOf, forceAction, forceOut, giveShield, has, hastenFighter, heal, hitSummon, interrupt, isOut,
  label, mark, marked, markedBy, msg, reflect, reserves, runMove, setForm, setMove, sk, standing, stat, summon, summonsOf, unmark,
} from '../battle/engine';
import type { Battle, Fighter, SpriteData, StatusId, Summon } from '../battle/model';
import { defMark, defMove, defNotion, defPassive, defSummon, MOVES, type Ctx, type DmgInfo, type MoveDef } from '../battle/registry';
import type { Type } from './types';

// Act 2 kinds, chapters 1 to 3 and the first rare four, plus Small Gran and five notions.

const dot = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
const enemy = (f: Fighter, src: Fighter | null): src is Fighter => !!src && src.side !== f.side && !src.ko;
const slotOf = (f: Fighter, id: string) => f.moves.indexOf(id);
const isMove = (w: unknown): w is MoveDef => typeof w === 'object' && w !== null;
const landed = (d: DmgInfo) => !d.dot && !d.reserve && (d.attack || !!d.move);
/** A move that can be done again with no target picked: it hits the foe out front. */
const replayable = (m: MoveDef | undefined) => !!m && (m.reach === 'single' || m.reach === 'spread') && !m.tag;
const GOOD: StatusId[] = ['empower', 'fortify', 'haste', 'unstop', 'ward', 'thorns', 'regen'];
const BADS: StatusId[] = ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'burn', 'bleed', 'poison', 'rot', 'expose', 'weaken', 'doom'];
const STOPS: string[] = ['stun', 'silence', 'sleep', 'taunt'];

/** A hit from a passive or mark: typed and mitigated like a move, outside any move. */
function strike(b: Battle, src: Fighter | null, t: Fighter, raw: number, kind: 'P' | 'M' | 'T', type: Type | null): number {
  if (!t || t.ko || t.gone || raw <= 0) return 0;
  return dealDamage(b, src, t, raw, { kind, move: null, attack: false, dot: false, spread: false, reserve: !isOut(b, t) }, kind === 'T' ? null : type);
}
/** True damage of a share of max HP, credited to src. */
function trueShare(b: Battle, src: Fighter | null, t: Fighter, share: number): number {
  if (t.ko || t.gone) return 0;
  return dealDamage(b, src, t, t.maxHp * share, dot('T'), null);
}
function stacks(b: Battle, f: Fighter, id: string, n: number): void {
  unmark(f, id);
  if (n > 0) mark(b, f, f, id, n, -1);
}
function dropStack(f: Fighter, id: string): void {
  const mk = f.m[id];
  if (!mk) return;
  mk.n--;
  if (mk.n <= 0) delete f.m[id];
}
/** Adds turns to a move's cooldown. A ready move is blocked for n turns. */
function addCd(t: Fighter, i: number, n: number): void {
  t.cd[i] = t.cd[i] > 0 ? t.cd[i] + n : n + 1;
}
function scour(t: Fighter, n: number): number {
  let k = 0;
  for (const id of GOOD) {
    if (k >= n) break;
    if (t.s[id]) { delete t.s[id]; k++; }
  }
  return k;
}
function selfCost(f: Fighter, share: number): void {
  f.hp = Math.max(1, f.hp - Math.round(f.maxHp * share));
}

// ---------------------------------------------------------------- the Strand: tide and stars

/** Whether the tide is in for this battle. A kit may have turned it. Off the Strand the tide counts as out. */
function tideIn(b: Battle): boolean {
  const o = sk(b, 0).c5tide;
  return o ? o === 1 : !!b.rules.tideHigh;
}
function turnTide(b: Battle, high: boolean): void {
  if (tideIn(b) === high) return;
  sk(b, 0).c5tide = high ? 1 : 2;
  msg(b, high ? 'The tide comes in.' : 'The tide goes out.');
}
/** Stars that have landed this battle: the Strand's own at low tide, and any a kit called down. */
function starCount(b: Battle): number {
  const every = b.rules.starEvery || 0;
  return (sk(b, 0).c5stars || 0) + (every && b.starred ? Math.floor(b.starred / every) : 0);
}
function landStar(b: Battle, side: 0 | 1, tide: number): void {
  sk(b, 0).c5stars = (sk(b, 0).c5stars || 0) + 1;
  msg(b, 'A star lands on the field.');
  addNerve(b, side, tide);
}
/** Stars landed since this fighter last looked. */
function freshStars(b: Battle, f: Fighter): number {
  const n = starCount(b);
  const seen = f.k.c5star ?? n;
  f.k.c5star = n;
  return Math.max(0, n - seen);
}


/** A spread hit from a passive or mark: the out foe in full, each foe reserve at the spread share. */
function splash(b: Battle, u: Fighter, raw: number, kind: 'P' | 'M', type: Type | null): number {
  const them = b.s[1 - u.side];
  const t = them.f[them.out];
  let dealt = 0;
  if (t && !t.ko && !t.gone) dealt = dealDamage(b, u, t, raw, { kind, move: null, attack: false, dot: false, spread: true, reserve: false }, type);
  for (const r of reserves(them)) dealDamage(b, u, r, raw * 0.35, { kind, move: null, attack: false, dot: false, spread: true, reserve: true }, type);
  return dealt;
}
const foe = (b: Battle, f: Fighter): Fighter | null => { const t = foeOf(b, f); return t && !t.ko && !t.gone ? t : null; };
const outOf = (b: Battle, f: Fighter): Fighter => b.s[f.side].f[b.s[f.side].out];
const ownerOf = (b: Battle, s: Summon): Fighter | null => { const f = b.s[s.side].f[s.by]; return f && !f.ko ? f : null; };
const under = (t: Fighter, p: number) => t.hp < t.maxHp * p;
function ready(f: Fighter, id: string): void { const i = f.moves.indexOf(id); if (i >= 0) f.cd[i] = 0; }
function stunNow(b: Battle, src: Fighter | null, t: Fighter): boolean {
  if (!applyStatus(b, src, t, 'stun', 1)) return false;
  if (t.s.stun) t.s.stun.src = -1;
  return true;
}
/** Runs another move with this move's context at a power multiplier. The caller's own cooldown is kept. */
function borrow(c: Ctx, m: MoveDef, power: number): void {
  const own = c.u.moves.indexOf(c.move.id);
  const keep = own >= 0 ? c.u.cd[own] : 0;
  const c2 = Object.create(c) as Ctx;
  c2.move = m;
  c2.ally = c.ally || c.u;
  const was = c.u.k.moveMul || 0;
  c.u.k.moveMul = power;
  try { m.run(c2); } catch { c.msg('It slips away.'); }
  c.u.k.moveMul = was;
  if (own >= 0) c.u.cd[own] = Math.max(c.u.cd[own], keep);
}
/** Hits a summon on the foe's side directly, at the summon share of the raw power. */
function hitAllSummons(b: Battle, side: 0 | 1, raw: number): void { for (const s of summonsOf(b, side)) hitSummon(b, s, raw * 0.5); }

// ================================================================ chapter 1: the Outer Whorl

// acorn: a barnacle that will not be moved, stops the first shot at it, fires its cirri faster, shuts tight, and drags them onto its bed.
defPassive({ id: 'acorn_cemented', name: 'Cemented', owner: 'acorn', text: 'Cannot be forced out or dragged in. Takes 0.9x damage from attacks.',
  immovable() { return true; },
  inMul(b, f, src, d) { return d.attack ? 0.9 : 1; } });
defPassive({ id: 'acorn_spat', name: 'Spat Spin', owner: 'acorn', text: 'When it comes out: blocks the first projectile move aimed at it.',
  comeOut(b, f) { f.k.spun = 0; },
  intercept(b, f, user, m) { if (!isOut(b, f) || f.k.spun || !m.tags?.includes('projectile')) return null; f.k.spun = 1; return 'block'; } });
defMove({ id: 'acorn_cirri', name: 'Cirri Fire', type: 'STONE', owner: 'acorn', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits 3 times for 39% ATK. +10% per use since it came out, up to +30%.',
  run(c) {
    if (c.u.k.cirriAt !== c.u.outAt) { c.u.k.cirriAt = c.u.outAt; c.u.k.cirri = 0; }
    const m = 1 + 0.1 * Math.min(3, c.u.k.cirri || 0);
    for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.39 }, { mult: m });
    c.u.k.cirri = (c.u.k.cirri || 0) + 1;
  } });
defMove({ id: 'acorn_cement', name: 'Cement Spear', type: 'STONE', owner: 'acorn', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 107% ATK. If the foe can\'t switch: Stun 1. If it can: delays its next turn by 30%.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 1.07 }); if (pinned) c.st(c.tgt, 'stun', 1); else c.delay(c.tgt, 30); } });
defMove({ id: 'acorn_shut', name: 'Shut Tight', type: 'STONE', owner: 'acorn', reach: 'self', cd: 4, wt: 60, text: 'Unstoppable 2. Fortify 2 (35% less damage).',
  run(c) { c.st(c.u, 'unstop', 2); c.st(c.u, 'fortify', 2, 0.35); } });
defMove({ id: 'acorn_bed', name: 'Barnacle Bed', type: 'STONE', owner: 'acorn', reach: 'spread', cd: 6, nerve: 5, wu: 70, unstop: true, text: 'Unstoppable wind-up. Hits every foe for 161% ATK. Stun 1.',
  run(c) { c.spread({ atk: 1.61 }); c.st(c.tgt, 'stun', 1); } });

// varix: an old lip that grows angry with every hit, tosses and hops while small, and slams and crushes when it is Big.
const VARIX_BIG: SpriteData = { px: ['3......3', '33333333', '32222223', '31133113', '22222222', '222.2222', '33.23.33', '33....33'], c: ['#bc845c', '#ae2f21', '#f2e2ca'] };
const varixBig = (f: Fighter) => f.form?.tag === 'big';
defMark({ id: 'varix_rage', name: 'big', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); f.k.rage = 0; msg(b, `${label(b, f)} shrinks back.`); },
  leave(b, f) { unmark(f, 'varix_rage'); clearForm(b, f); f.k.rage = 0; } });
function varixAnger(b: Battle, f: Fighter, n: number): void {
  if (varixBig(f) || f.ko) return;
  f.k.rage = Math.min(100, (f.k.rage || 0) + n);
  if (f.k.rage < 100) return;
  setForm(b, f, { tag: 'big', sprite: VARIX_BIG, statMul: { atk: 1.25, def: 1.3, res: 1.3, agi: 0.8 } }, ['varix_boulder', 'varix_wallop', 'varix_crunch']);
  mark(b, f, f, 'varix_rage', 1, 3);
  msg(b, `${label(b, f)} grows huge.`);
}
defPassive({ id: 'varix_growth', name: 'Growth', owner: 'varix', text: 'Each hit it deals adds 20 Rage, and each hit it takes adds 10. At 100 Rage: it is Big for 3 turns, with 1.25x ATK and 1.3x DEF.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) varixAnger(b, f, 20); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) varixAnger(b, f, 10); } });
defPassive({ id: 'varix_oldlip', name: 'Old Lip', owner: 'varix', text: 'Small: turns 10% sooner. Big: takes 0.85x damage, 1.3x RES, 0.8x AGI.',
  inMul(b, f) { return varixBig(f) ? 0.85 : 1; },
  turnEnd(b, f) { if (!varixBig(f)) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); } } });
defMove({ id: 'varix_toss', name: 'Lip Toss', type: 'STONE', owner: 'varix', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 68% ATK. Slow 1. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.68 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 15); } });
defMove({ id: 'varix_hop', name: 'Lip Hop', type: 'STONE', owner: 'varix', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 57% ATK. Haste 1.',
  run(c) { c.hit(c.tgt, { atk: 0.57 }); c.st(c.u, 'haste', 1); } });
defMove({ id: 'varix_grind', name: 'Grind', type: 'STONE', owner: 'varix', reach: 'single', cd: 3, text: 'Hits 3 times for 23% ATK. The 3rd adds 6% of the foe\'s max HP.',
  run(c) { c.hit(c.tgt, { atk: 0.23 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.23 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.23, tgtHp: 0.06 }); } });
defMove({ id: 'varix_spring', name: 'Lip Break', type: 'STONE', owner: 'varix', reach: 'single', cd: 6, nerve: 4, text: 'Becomes Big. Hits for 88% ATK. Stun 1, 2 if the foe can\'t switch.',
  run(c) { varixAnger(c.b, c.u, 100); const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 0.88 }); c.st(c.tgt, 'stun', pinned ? 2 : 1); } });
defMove({ id: 'varix_boulder', name: 'Boulder Lob', type: 'STONE', owner: 'varix', reach: 'spread', tags: ['projectile'], cd: 1, extra: true, text: 'Hits every foe for 85% ATK. Slow 1.',
  run(c) { c.spread({ atk: 0.85 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'varix_wallop', name: 'Wallop', type: 'STONE', owner: 'varix', reach: 'spread', cd: 3, extra: true, text: 'Hits every foe for 90% ATK. Stun 1.',
  run(c) { c.spread({ atk: 0.9 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'varix_crunch', name: 'Lip Crush', type: 'STONE', owner: 'varix', reach: 'single', cd: 2, extra: true, text: 'Hits for 120% ATK. Heals 30% of the damage.',
  run(c) { const d = c.hit(c.tgt, { atk: 1.2 }); c.heal(c.u, d * 0.3); } });

// mew: a gull that harries the foe every other turn, dives, wheels, vaults off, and rides the air for three turns.
const MEW_BIRD: SpriteData = { px: ['........', '........', '4..22..4', '44221244', '444.2444', '...33...', '........', '........'], c: ['#f0f2f4', '#dd9e09', '#717b8a'] };
defMark({ id: 'mew_harried', name: 'harried', clock: 'own', negative: true, value: -0.06 });
defMark({ id: 'mew_aloft', name: 'aloft', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); const t = foe(b, f); if (t) { msg(b, `${label(b, f)} drops onto ${label(b, t)}.`); strike(b, f, t, stat(b, f, 'atk') * 0.9, 'P', 'BEAST'); } },
  leave(b, f) { unmark(f, 'mew_aloft'); clearForm(b, f); } });
defPassive({ id: 'mew_draft', name: 'Draft', owner: 'mew', text: 'Every 2nd turn: the foe is Harried. Its next attack on a Harried foe deals 1.5x.',
  turnStart(b, f) { f.k.harry = (f.k.harry || 0) + 1; const t = foe(b, f); if (t && f.k.harry % 2 === 0) mark(b, f, t, 'mew_harried', 1, 2); },
  outMul(b, f, t, d) { return d.attack && marked(t, 'mew_harried') ? 1.5 : 1; },
  afterAttack(b, f, t) { unmark(t, 'mew_harried'); } });
defPassive({ id: 'mew_eye', name: 'Gull Eye', owner: 'mew', text: 'Deals 1.2x damage to a foe below 50% HP.',
  outMul(b, f, t) { return under(t, 0.5) ? 1.2 : 1; } });
defMove({ id: 'mew_dive', name: 'Gull Dive', type: 'BEAST', owner: 'mew', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 105% ATK. Weaken 1. Harried.',
  run(c) { c.hit(c.tgt, { atk: 1.05 }); c.st(c.tgt, 'weaken', 1); if (!c.tgt.ko) c.mark(c.tgt, 'mew_harried', 1, 2); } });
defMove({ id: 'mew_wheel', name: 'Wheel', type: 'BEAST', owner: 'mew', reach: 'self', cd: 3, wt: 50, text: 'Haste 2. The foe is Harried.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.tgt, 'mew_harried', 1, 2); } });
defMove({ id: 'mew_snatch', name: 'Vault Off', type: 'BEAST', owner: 'mew', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 89% ATK. Slow 2. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.89 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 30); } });
defMove({ id: 'mew_forty', name: 'Forty Years', type: 'BEAST', owner: 'mew', reach: 'self', cd: 6, nerve: 4, wt: 50, text: '3 turns aloft: 1.2x ATK, 1.3x AGI, Haste 2. Then drops for 90% ATK.',
  run(c) { setForm(c.b, c.u, { tag: 'bird', sprite: MEW_BIRD, statMul: { atk: 1.2, agi: 1.3 } }); c.mark(c.u, 'mew_aloft', 1, 3); c.st(c.u, 'haste', 2); } });

// halite: dried spray that sets square Grains, drops and throws them, scatters them, and spends every one at once.
defSummon({ id: 'halite_sphere', name: 'Salt Grain', owner: 'halite', text: 'Shiola\'s moves throw and spend it. Lasts 3 turns, or 5 with Cubic.', every: 100,
  sprite: { px: ['........', '...2222.', '..22223.', '.444433.', '.444433.', '.44443..', '.4444...', '........'], c: ['#fbfaf8', '#8890b0', '#e8c8d4'] },
  act() { /* a grain only waits */ } });
const grains = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'halite_sphere');
function setGrain(b: Battle, f: Fighter): void {
  summon(b, f, 'halite_sphere', { hp: 0.05, turns: has(f, 'halite_cubic') ? 5 : 3 });
  f.k.grainsMade = (f.k.grainsMade || 0) + 1;
}
defPassive({ id: 'halite_cubic', name: 'Cubic', owner: 'halite', text: 'Its Grains last 5 turns instead of 3.' });
defPassive({ id: 'halite_spray', name: 'Counted', owner: 'halite', text: 'Every 3rd Grain it sets: +5% MGK for the battle.',
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.st.mgk * 0.05 * Math.floor((f.k.grainsMade || 0) / 3)) : 0; } });
defMove({ id: 'halite_grain', name: 'Grain Drop', type: 'SALT', owner: 'halite', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 120% MGK. Sets a Grain (5% max HP).',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }); setGrain(c.b, c.u); } });
defMove({ id: 'halite_dryout', name: 'Dry Out', type: 'SALT', owner: 'halite', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 100% MGK, Slow 2, spending a Grain. No Grain: 60%, Slow 1.',
  run(c) { const g = grains(c.b, c.u)[0]; if (g) dismiss(c.b, g); c.hit(c.tgt, { mgk: g ? 1.0 : 0.6 }); c.st(c.tgt, 'slow', g ? 2 : 1); } });
defMove({ id: 'halite_square', name: 'Square Off', type: 'SALT', owner: 'halite', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 84% MGK. Stun 1 with 2+ Grains.',
  run(c) { const n = grains(c.b, c.u).length; c.spread({ mgk: 0.84 }); if (n >= 2) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'halite_pan', name: 'Salt Pan', type: 'SALT', owner: 'halite', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Spends every Grain: hits for 84% MGK + 35% MGK per Grain.',
  run(c) { const gs = grains(c.b, c.u); for (const g of gs) dismiss(c.b, g); c.hit(c.tgt, { mgk: 0.84 + 0.35 * gs.length }); } });

// skitter: a sand hopper that comes out hidden, counts its Hops to a Full Hop, pounces, kicks sand, throws, and hunts at night.
defPassive({ id: 'skitter_shadow', name: 'Shadow Leap', owner: 'skitter', text: 'When it comes out: Hidden 1. Its first attack from hiding deals 1.4x.',
  comeOut(b, f) { applyStatus(b, f, f, 'hidden', 1); },
  outMul(b, f, t, d) { return d.attack && f.s.hidden ? 1.4 : 1; } });
defPassive({ id: 'skitter_hops', name: 'Hop Count', owner: 'skitter', text: 'Each move adds a Hop. At 4 Hops its next move is a Full Hop and spends them.',
  afterMove(b, f) { if (f.k.fierce) { f.k.fierce = 0; f.k.fero = 0; return; } f.k.fero = (f.k.fero || 0) + 1; if (f.k.fero >= 4) { f.k.fierce = 1; msg(b, `${label(b, f)} crouches low.`); } } });
const fierce = (c: Ctx) => !!c.u.k.fierce;
defMove({ id: 'skitter_pounce', name: 'Pounce', type: 'BEAST', owner: 'skitter', reach: 'single', cd: 1, text: 'Hits for 111% ATK. Next attack deals 1.5x. Full Hop: +74% ATK hit.',
  run(c) { c.hit(c.tgt, { atk: 1.11 }); if (fierce(c) && !c.tgt.ko) c.hit(c.tgt, { atk: 0.74 }); c.u.k.nextAtkMul = 1.5; } });
defMove({ id: 'skitter_kick', name: 'Sand Kick', type: 'BEAST', owner: 'skitter', reach: 'spread', cd: 3, text: 'Hits every foe for 74% ATK. Heals 8% max HP, 20% on a Full Hop.',
  run(c) { c.spread({ atk: 0.74 }); c.heal(c.u, c.u.maxHp * (fierce(c) ? 0.2 : 0.08)); } });
defMove({ id: 'skitter_burrow', name: 'Sand Throw', type: 'BEAST', owner: 'skitter', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 80% ATK. Slow 2. Full Hop: Root 2.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); c.st(c.tgt, 'slow', 2); if (fierce(c)) c.st(c.tgt, 'root', 2); } });
defMove({ id: 'skitter_night', name: 'Night Hunt', type: 'BEAST', owner: 'skitter', reach: 'self', cd: 6, nerve: 4, wt: 50, text: 'Hidden 2. Haste 2. Its next attack deals 2x damage.',
  run(c) { c.st(c.u, 'hidden', 2); c.st(c.u, 'haste', 2); c.u.k.nextAtkMul = 2; } });

// ================================================================ chapter 1: the Wrack

// fucus: bladder wrack that pops every third turn, lobs a bladder, inflates a foe out, lays pods, and bursts the big one.
defSummon({ id: 'fucus_mine', name: 'Pop Pod', owner: 'fucus', text: 'Stays until a foe comes out. Hits it for 50% of Rakmata\'s MGK. Slow 1.',
  sprite: { px: ['........', '....3...', '...4....', '..2222..', '.222222.', '.211112.', '..2222..', '........'], c: ['#84743a', '#f3c42f', '#49392f'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} steps on a bladder.`); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.5, 'M', 'ROOT'); if (!who.ko) applyStatus(b, f, who, 'slow', 1); return true; } });
defPassive({ id: 'fucus_bladders', name: 'Bladders', owner: 'fucus', text: 'Every 3rd turn: its next attack adds 60% MGK.',
  turnStart(b, f) { f.k.fuse = (f.k.fuse || 0) + 1; },
  afterAttack(b, f, t) { if ((f.k.fuse || 0) < 3 || t.ko || t.gone) return; f.k.fuse = 0; strike(b, f, t, stat(b, f, 'mgk') * 0.6, 'M', 'ROOT'); } });
defPassive({ id: 'fucus_tideline', name: 'Tideline', owner: 'fucus', text: 'Deals 1.15x damage to a Slowed or Rooted foe.',
  outMul(b, f, t) { return t.s.slow || t.s.root ? 1.15 : 1; } });
defMove({ id: 'fucus_lash', name: 'Pop Lob', type: 'ROOT', owner: 'fucus', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 100% MGK. The first reserve takes 45% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 1.0 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.0 }, { reserve: true, mult: 0.45 }); } });
defMove({ id: 'fucus_inflate', name: 'Inflate', type: 'ROOT', owner: 'fucus', reach: 'single', tags: ['spell'], cd: 4, text: 'Hits for 60% MGK. Forces the foe out. Haste 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); if (!c.tgt.ko) c.forceOut(); c.st(c.u, 'haste', 1); } });
defMove({ id: 'fucus_pop', name: 'Pop Field', type: 'ROOT', owner: 'fucus', reach: 'side', cd: 3, text: 'Slow 1. Sets 2 Pop Pods (5% max HP each).',
  run(c) { c.st(c.tgt, 'slow', 1); summon(c.b, c.u, 'fucus_mine', { hp: 0.05 }); summon(c.b, c.u, 'fucus_mine', { hp: 0.05 }); } });
defMove({ id: 'fucus_wrack', name: 'Wrack Bomb', type: 'ROOT', owner: 'fucus', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 50, text: 'Wind-up. Hits every foe for 150% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.5 }, { spread: true }); for (const r of reserves(c.them)) c.hit(r, { mgk: 1.5 }, { spread: true, reserve: true, mult: 0.35 }); } });

// flotsam: a shut crate that seethes after three moves, swings its lid, stoves in, bobs a foe up, and nails it in its hold.
defMark({ id: 'flotsam_realm', name: 'in the hold', clock: 'own', negative: true, value: -0.2,
  forbid(b, f, what) { return what === 'switch' ? 'Shut in the hold.' : null; },
  statBonus(f, k) { return k === 'atk' || k === 'mgk' || k === 'def' ? -Math.round(f.st[k] * 0.1) : 0; } });
defPassive({ id: 'flotsam_stayed', name: 'Stayed Shut', owner: 'flotsam', text: 'After 3 moves in a row: for 2 turns the foe loses 4% max HP a turn.',
  afterMove(b, f) { f.k.rise = (f.k.rise || 0) + 1; if (f.k.rise >= 3) { f.k.rise = 0; f.k.seethe = 2; } },
  turnEnd(b, f, action) { if (action !== 'move' && action !== 'windup') f.k.rise = 0; },
  turnStart(b, f) { if (!f.k.seethe) return; f.k.seethe--; const t = foe(b, f); if (t) dealDamage(b, f, t, t.maxHp * 0.04, dot('M'), null); } });
defPassive({ id: 'flotsam_cargo', name: 'Cargo', owner: 'flotsam', text: 'While the foe is in its hold: +10% ATK, MGK, and DEF.',
  statBonus(f, k) { return f.k.holding && (k === 'atk' || k === 'mgk' || k === 'def') ? Math.round(f.st[k] * 0.1) : 0; } });
defMove({ id: 'flotsam_batten', name: 'Batten', type: 'GEAR', owner: 'flotsam', reach: 'single', cd: 1, text: 'Hits for 122% ATK. 1.3x on a foe with no reserves.',
  run(c) { c.hit(c.tgt, { atk: 1.22 }, { mult: reserves(c.them).length ? 1 : 1.3 }); } });
defMove({ id: 'flotsam_stove', name: 'Stove In', type: 'GEAR', owner: 'flotsam', reach: 'single', cd: 3, text: 'Hits for 95% ATK. Shield of 50% of the damage + 5% max HP.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.95 }); c.shield(c.u, d * 0.5 + c.u.maxHp * 0.05, 3); } });
defMove({ id: 'flotsam_bob', name: 'Bob Up', type: 'GEAR', owner: 'flotsam', reach: 'dragin', cd: 3, text: 'Drags in a reserve. Hits it for 95% ATK.',
  run(c) { c.dragIn(c.pick); c.hit(c.them.f[c.them.out], { atk: 0.95 }); } });
defMove({ id: 'flotsam_nailed', name: 'Nailed Shut', type: 'GEAR', owner: 'flotsam', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 85% ATK. 3 turns in its hold: no switch, -10% ATK, MGK, DEF.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); if (c.tgt.ko) return; if (c.mark(c.tgt, 'flotsam_realm', 1, 3)) { c.u.k.holding = 1; c.u.k.holdUntil = c.b.turnNo + 6; } } });

// mote: a warm grain of star that heals from reserve, glints, sets a warm pylon, hops in a burst, and holds a sun on a foe.
defSummon({ id: 'mote_pylon', name: 'Warm Pylon', owner: 'mote', text: 'Each turn: heals your out whorl 12% of its max HP.', every: 100,
  sprite: { px: ['........', '..3333..', '.3.33.3.', '..4444..', '...22...', '...22...', '..2222..', '.444444.'], c: ['#efdbbf', '#e9ab20', '#027977'] },
  act(b, s) { const o = b.s[s.side].f[b.s[s.side].out]; const f = ownerOf(b, s); if (o && !o.ko) heal(b, f, o, o.maxHp * (f && has(f, 'mote_grain') ? 0.14 : 0.12)); } });
defMark({ id: 'mote_sun', name: 'held sun', clock: 'own', negative: true, value: -0.15,
  afterTake(b, f, src, dealt, d) {
    if (d.dot || !src || src.side === f.side || f.k.sunBurst) return;
    const mk = unmark(f, 'mote_sun');
    const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    f.k.sunBurst = 1;
    msg(b, `The sun on ${label(b, f)} bursts.`);
    strike(b, by, f, stat(b, by, 'mgk') * 1.0, 'M', 'STAR');
    if (!f.ko) applyStatus(b, by, f, 'slow', 2);
    f.k.sunBurst = 0;
  } });
defPassive({ id: 'mote_side', name: 'Warm Side', owner: 'mote', text: 'In reserve: your out whorl heals 3% of max HP at your turns.',
  reserveTurn(b, f) { const o = outOf(b, f); if (!o.ko) heal(b, f, o, o.maxHp * 0.03); } });
defPassive({ id: 'mote_grain', name: 'Mote Grain', owner: 'mote', text: 'Its Warm Pylons heal 14% instead of 12%.' });
defMove({ id: 'mote_glint', name: 'Warm Glint', type: 'STAR', owner: 'mote', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 90% MGK. Your lowest-HP whorl heals 40% of it.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.9 }); const a = standing(c.me).sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0]; if (a) c.heal(a, d * 0.4); } });
defMove({ id: 'mote_turn', name: 'Turn Over', type: 'STAR', owner: 'mote', reach: 'side', cd: 4, text: 'Summons a Warm Pylon (15% max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'mote_pylon', { hp: 0.15, turns: 3 }); } });
defMove({ id: 'mote_hand', name: 'Handful', type: 'STAR', owner: 'mote', reach: 'single', tags: ['dash', 'spell'], cd: 3, text: 'Hits for 72% MGK. Delays the foe\'s next turn by 20%. Its own next turn comes 40% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.72 }); c.delay(c.tgt, 20); c.hasten(c.u, 40); } });
defMove({ id: 'mote_star', name: 'Captive Star', type: 'STAR', owner: 'mote', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, text: 'Hits for 63% MGK. The next time the foe is hit in 3 turns: it also takes 100% MGK. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.63 }); if (!c.tgt.ko) c.mark(c.tgt, 'mote_sun', 1, 3); } });

// seaglass: frosted sea glass that builds Rage, cuts to bleed, rubs past, holds back damage, and finishes the weak.
defMark({ id: 'seaglass_defer', name: 'holding back', clock: 'own', value: 0.08,
  beforeTake(b, f, src, amt, d) { if (d.dot) return amt; f.k.deferred = (f.k.deferred || 0) + amt * 0.4; return amt * 0.6; },
  turnStart(b, f) { const n = Math.round((f.k.deferred || 0) / 2); if (n > 0) { f.k.deferred -= n; dealDamage(b, null, f, n, dot('T'), null); } },
  expire(b, f) { f.k.deferred = 0; } });
defPassive({ id: 'seaglass_note', name: 'Glass Note', owner: 'seaglass', text: 'When it hits: 1 Rage. At 5: Empower 2, spends them.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; f.k.rage5 = (f.k.rage5 || 0) + 1; if (f.k.rage5 >= 5) { f.k.rage5 = 0; applyStatus(b, f, f, 'empower', 2); } } });
defPassive({ id: 'seaglass_frosted', name: 'Frosted', owner: 'seaglass', text: 'Its attacks add Bleed 1 (12% ATK per stack each turn).',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.12); } });
defMove({ id: 'seaglass_shard', name: 'Shard Knives', type: 'SALT', owner: 'seaglass', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 103% ATK. Bleed 2 (12% ATK per stack each turn).',
  run(c) { c.hit(c.tgt, { atk: 1.03 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'seaglass_rub', name: 'Rub Through', type: 'SALT', owner: 'seaglass', reach: 'single', tags: ['dash'], cd: 2, text: 'Hits for 108% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.08 }); c.hasten(c.u, 30); } });
defMove({ id: 'seaglass_break', name: 'Break Glass', type: 'SALT', owner: 'seaglass', reach: 'self', cd: 4, wt: 60, text: 'For 3 turns: takes 0.6x from each hit and stores the rest. At each of its turns it takes half the store. What is left after 3 turns is gone.',
  run(c) { c.u.k.deferred = c.u.k.deferred || 0; c.mark(c.u, 'seaglass_defer', 1, 3); } });
defMove({ id: 'seaglass_beach', name: 'Beach Glass', type: 'SALT', owner: 'seaglass', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Hits for 135% ATK. A foe left below 30% HP is KO\'d.',
  run(c) { c.hit(c.tgt, { atk: 1.35 }); if (!c.tgt.ko && under(c.tgt, 0.3) && !c.blocked(c.tgt)) { c.msg(`${label(c.b, c.u)} cuts it through.`); c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); } } });

// kipper: a salted fish that slaps brine, bubbles a friend, flips under, and swallows a foe for two turns.
defPassive({ id: 'kipper_hung', name: 'Hung Up', owner: 'kipper', text: 'Its heals also remove 1 bad status.',
  afterHeal(b, f, t, amt) { if (amt > 0) cleanse(b, t, 1); } });
defPassive({ id: 'kipper_stiff', name: 'Stiff', owner: 'kipper', text: 'Its heals are 1.15x.',
  healMul() { return 1.15; } });
defMove({ id: 'kipper_slap', name: 'Kipper Slap', type: 'SALT', owner: 'kipper', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 90% MGK.',
  run(c) { c.spread({ mgk: 0.9 }); } });
defMove({ id: 'kipper_desiccate', name: 'Bubble Up', type: 'SALT', owner: 'kipper', reach: 'ally', cd: 2, text: 'Heals an ally 14% of max HP. Haste 1.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.14); c.st(c.ally!, 'haste', 1); } });
defMove({ id: 'kipper_flip', name: 'Flip Under', type: 'SALT', owner: 'kipper', reach: 'self', tags: ['dash'], cd: 4, wt: 50, text: 'Hidden 2. Heals 12% of its max HP.',
  run(c) { c.st(c.u, 'hidden', 2); c.heal(c.u, c.u.maxHp * 0.12); } });
defMove({ id: 'kipper_cured', name: 'Cured', type: 'SALT', owner: 'kipper', reach: 'single', tags: ['projectile'], cd: 6, nerve: 5, wt: 70, text: 'Swallows the foe: off the field for 2 turns.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; c.msg(`${label(c.b, c.u)} swallows ${label(c.b, c.tgt)} whole.`); banish(c.b, c.tgt, 2, c.u); } });

// actinia: an anemone that finds Soft Spots, stings attackers, lunges, closes up against a move, blooms out, and stings every soft spot.
defMark({ id: 'actinia_vital', name: 'soft spot', clock: 'own', negative: true, value: -0.06 });
defMark({ id: 'actinia_riposte', name: 'closed up', clock: 'own', volatile: true, value: 0.2,
  intercept(b, f, user, m) { if (!isOut(b, f)) return null; unmark(f, 'actinia_riposte'); applyStatus(b, f, user, 'stun', 1); msg(b, `${label(b, f)} turns the blow aside.`); return 'block'; } });
defMark({ id: 'actinia_dance', name: 'blooming', max: 2, clock: 'own', volatile: true, value: 0.08,
  outMul(b, f, t, d) { return d.attack ? 1.5 : 1; },
  afterAttack(b, f, t) { const mk = f.m.actinia_dance; if (!mk) return; mk.n--; if (mk.n <= 0) { unmark(f, 'actinia_dance'); if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 2); } } });
function vitalHit(b: Battle, f: Fighter, t: Fighter): void {
  if (!marked(t, 'actinia_vital') || t.ko) return;
  unmark(t, 'actinia_vital');
  dealDamage(b, f, t, t.maxHp * 0.06, dot('T'), null);
  heal(b, f, f, f.maxHp * 0.04);
}
defPassive({ id: 'actinia_cells', name: 'Stinging Cells', owner: 'actinia', text: 'Every 2nd move marks a Soft Spot on the foe for 3 turns. Its next hit there adds 6% of the foe\'s max HP as true damage and heals it 4%.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side === 1 - f.side && !f.k.vitaling) { f.k.vitaling = 1; vitalHit(b, f, t); f.k.vitaling = 0; } },
  afterMove(b, f) { f.k.cells = (f.k.cells || 0) + 1; const t = foe(b, f); if (t && f.k.cells % 2 === 0) mark(b, f, t, 'actinia_vital', 1, 3); } });
defPassive({ id: 'actinia_shy', name: 'Shy', owner: 'actinia', text: 'Takes 0.9x damage from attacks. Attackers that hit it get Slow 1.',
  inMul(b, f, src, d) { return d.attack ? 0.9 : 1; },
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src.side !== f.side && !src.ko) applyStatus(b, f, src, 'slow', 1); } });
defMove({ id: 'actinia_arm', name: 'Arm Lunge', type: 'TIDE', owner: 'actinia', reach: 'single', tags: ['dash', 'spell'], cd: 1, text: 'Hits for 117% MGK. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 1.17 }); c.hasten(c.u, 15); } });
defMove({ id: 'actinia_close', name: 'Close Up', type: 'TIDE', owner: 'actinia', reach: 'self', cd: 4, wt: 50, text: 'Blocks the next foe move at it before its next turn. User: Stun 1.',
  run(c) { c.mark(c.u, 'actinia_riposte', 1, 1); } });
defMove({ id: 'actinia_bloom', name: 'Bloom Out', type: 'TIDE', owner: 'actinia', reach: 'self', cd: 3, wt: 50, text: 'Its next 2 attacks deal 1.5x. The second adds Slow 2.',
  run(c) { c.mark(c.u, 'actinia_dance', 2, 3); } });
defMove({ id: 'actinia_pool', name: 'Pool Challenge', type: 'TIDE', owner: 'actinia', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits 4 times for 22% MGK + 6% max HP true. Team heals 10% max HP.',
  run(c) {
    for (let i = 0; i < 4 && !c.tgt.ko; i++) { c.hit(c.tgt, { mgk: 0.22 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.hit(c.tgt, { tgtHp: 0.06 }, { kind: 'T' }); }
    for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.1);
  } });

// lacuna: a hollow that looks like a friend, scoops twice, leaves a copy, sinks barbs, and opens at dead low.
defSummon({ id: 'lacuna_clone', name: 'Hollow Copy', owner: 'lacuna', sprite: { px: ['........', '........', '........', '...33...', '..3333..', '.222222.', '21122112', '.244442.'], c: ['#a0d7d0', '#d68aa9', '#ffefd8'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* the copy only stands */ } });
defPassive({ id: 'lacuna_hollow', name: 'Hollow', owner: 'lacuna', text: 'When it comes out: looks like its first reserve until a move hits it.',
  comeOut(b, f) { const a = reserves(b.s[f.side])[0]; if (a) disguise(b, f, a); },
  afterTake(b, f, src, dealt, d) { if (d.move && f.disguise) { disguise(b, f, null); msg(b, `${label(b, f)} shows itself.`); } },
  leave(b, f) { disguise(b, f, null); } });
defPassive({ id: 'lacuna_round', name: 'Look Round', owner: 'lacuna', text: 'Deals 1.3x damage while disguised.',
  outMul(b, f) { return f.disguise ? 1.3 : 1; } });
defMove({ id: 'lacuna_scoop', name: 'Scoop', type: 'VOID', owner: 'lacuna', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 80% MGK, then 40% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); if (!c.tgt.ko) c.hit(c.tgt, { mgk: 0.4 }); } });
defMove({ id: 'lacuna_sweep', name: 'Sweep Off', type: 'VOID', owner: 'lacuna', reach: 'side', cd: 4, wt: 50, text: 'Summons a Hollow Copy (10% max HP, 3 turns). Hidden 1.',
  run(c) { summon(c.b, c.u, 'lacuna_clone', { hp: 0.1, turns: 3 }); c.st(c.u, 'hidden', 1); } });
defMove({ id: 'lacuna_sink', name: 'Sink Barbs', type: 'VOID', owner: 'lacuna', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 75% MGK. Root 2, or 3 with a Hollow Copy standing.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.tgt, 'root', summonsOf(c.b, c.u.side, 'lacuna_clone').length ? 3 : 2); } });
defMove({ id: 'lacuna_deadlow', name: 'Dead Low', type: 'VOID', owner: 'lacuna', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 50, text: 'Wind-up. Hits every foe for 110% MGK. Stun 1, 2 if disguised.',
  run(c) { const hid = !!c.u.disguise; c.spread({ mgk: 1.1 }); c.st(c.tgt, 'stun', hid ? 2 : 1); if (hid) disguise(c.b, c.u, null); } });

// columba: a sand dollar dove that heals with its wing, carries light to a friend, flies home, and rings the fallen back.
defPassive({ id: 'columba_homing', name: 'Homing', owner: 'columba', text: 'When it comes out: its first turn comes 30% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 30; } });
defPassive({ id: 'columba_doves', name: 'Doves', owner: 'columba', text: 'Turn start: if nothing hit it since its last turn, heals 5% of max HP.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.doveHit = 1; },
  turnStart(b, f) { if (!f.k.doveHit) heal(b, f, f, f.maxHp * 0.05); f.k.doveHit = 0; } });
defMove({ id: 'columba_wing', name: 'Dove Wing', type: 'STAR', owner: 'columba', reach: 'ally', cd: 1, text: 'Heals an ally 10% of max HP + 10% CHA.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.1 + c.cha(0.1)); } });
defMove({ id: 'columba_carry', name: 'Carry Light', type: 'STAR', owner: 'columba', reach: 'ally', tags: ['spell'], cd: 3, text: 'An ally gets Empower 2. Hits the foe for 70% MGK.',
  run(c) { c.st(c.ally!, 'empower', 2); c.hit(c.tgt, { mgk: 0.7 }); } });
defMove({ id: 'columba_home', name: 'Fly Home', type: 'STAR', owner: 'columba', reach: 'reserveAlly', tags: ['dash'], cd: 4, tag: true, text: 'Switches to an ally. It heals 10% of max HP and acts at once.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.1); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 200; } });
defMove({ id: 'columba_ring', name: 'Ring Home', type: 'STAR', owner: 'columba', reach: 'team', cd: 7, nerve: 6, text: 'Brings back your first KO\'d whorl at 15% HP. If none: team heals 15%.',
  run(c) {
    const down = c.me.f.find(f => f.ko && !f.gone);
    if (!down) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.15); return; }
    down.ko = false; down.hp = Math.round(down.maxHp * 0.15); down.s = {}; down.m = {};
    emit(c.b, { e: 'heal', side: down.side, idx: down.idx, amt: down.hp });
    c.msg(`${label(c.b, down)} comes back.`);
  } });

// lobworm: a worm cast that curls and heals, raises Little Curls, sinks a foe, collapses on it, and raises a Great Curl.
defSummon({ id: 'lobworm_ghoul', name: 'Little Curl', owner: 'lobworm', sprite: { px: ['........', '........', '...22...', '..2332..', '.212212.', '.233332.', '..2222..', '..4..4..'], c: ['#bfa77f', '#a3ebbb', '#806b4f'] }, text: 'Each turn: hits the foe for 20% of Spijire\'s ATK, 30% if it is Collapsed.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'atk') * (marked(t, 'lobworm_mist') ? 0.3 : 0.2), 'P', 'ROOT'); } });
defSummon({ id: 'lobworm_maiden', name: 'Great Curl', owner: 'lobworm', sprite: { px: ['...22...', '..2332..', '..2222..', '...2332.', '..2222..', '.22332..', '.222222.', '43433434'], c: ['#bfa77f', '#a3ebbb', '#806b4f'] }, text: 'Takes single-target hits for your out whorl. Each turn: hits the foe for 50% of Spijire\'s ATK.', every: 100, guard: true,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'ROOT'); } });
defMark({ id: 'lobworm_mist', name: 'collapsed', clock: 'own', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'lobworm_castings', name: 'Castings', owner: 'lobworm', text: 'Every 2nd Curl: a Little Curl rises (8% max HP, 3 turns).' });
defPassive({ id: 'lobworm_lowwater', name: 'Ebb Mud', owner: 'lobworm', text: 'Takes 5% less damage per summon of its own standing.',
  inMul(b, f) { return 1 - 0.05 * summonsOf(b, f.side).filter(s => s.by === f.idx).length; } });
defMove({ id: 'lobworm_curl', name: 'Curl', type: 'ROOT', owner: 'lobworm', reach: 'single', cd: 1, text: 'Hits for 113% ATK. Heals 6% of max HP, 12% below 50% HP.',
  run(c) {
    c.hit(c.tgt, { atk: 1.13 });
    c.heal(c.u, c.u.maxHp * (under(c.u, 0.5) ? 0.12 : 0.06));
    c.u.k.rites = (c.u.k.rites || 0) + 1;
    if (c.u.k.rites % 2 === 0 && has(c.u, 'lobworm_castings')) summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 });
  } });
defMove({ id: 'lobworm_go', name: 'Go Under', type: 'ROOT', owner: 'lobworm', reach: 'single', cd: 4, text: 'Root 2. A Little Curl rises (8% max HP, 3 turns).',
  run(c) { c.st(c.tgt, 'root', 2); summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 }); } });
defMove({ id: 'lobworm_collapse', name: 'Collapse', type: 'ROOT', owner: 'lobworm', reach: 'single', cd: 3, text: 'Hits for 86% ATK. Slow 1. 3 turns: Little Curls hit it for 30% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.86 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'lobworm_mist', 1, 3); } });
defMove({ id: 'lobworm_coil', name: 'Great Curl', type: 'ROOT', owner: 'lobworm', reach: 'side', cd: 6, nerve: 5, text: 'A Great Curl (25%, 4 turns) and 2 Little Curls (8%, 3 turns) rise.',
  run(c) { summon(c.b, c.u, 'lobworm_maiden', { hp: 0.25, turns: 4 }); summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 }); summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 }); } });

// razor: a razor clam whose cuts come in threes, that bursts up, digs in, and lets a long blade fly.
defMark({ id: 'razor_long', name: 'long blade', clock: 'own', volatile: true, value: 0.15,
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.2) : 0; },
  expire(b, f) { const t = foe(b, f); if (!t) return; msg(b, `${label(b, f)} lets the blade fly.`); strike(b, f, t, stat(b, f, 'atk') * 0.8 + (t.maxHp - t.hp) * 0.25, 'P', 'GEAR'); } });
defPassive({ id: 'razor_hinge', name: 'Hinge', owner: 'razor', text: 'When it uses a move: its next attack deals 1.4x.',
  afterMove(b, f) { f.k.hinge = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.hinge ? 1.4 : 1; },
  afterAttack(b, f) { f.k.hinge = 0; } });
defPassive({ id: 'razor_startle', name: 'Startle', owner: 'razor', text: 'Its Stuns also delay the foe\'s next turn by 20%.',
  afterApply(b, f, t, id) { if (id === 'stun' && t.side !== f.side) delayFighter(b, t, 20); } });
defMove({ id: 'razor_cut', name: 'Razor Cut', type: 'GEAR', owner: 'razor', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 70% ATK. Every 3rd use: hits for 90% ATK and Stun 1 instead.',
  run(c) { c.u.k.cuts = ((c.u.k.cuts || 0) % 3) + 1; c.hit(c.tgt, { atk: c.u.k.cuts === 3 ? 0.9 : 0.7 }); if (c.u.k.cuts === 3) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'razor_upright', name: 'Upright', type: 'GEAR', owner: 'razor', reach: 'spread', cd: 4, text: 'Hits every foe for 55% ATK. Stun 1.',
  run(c) { c.spread({ atk: 0.55 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'razor_dig', name: 'Dig In', type: 'GEAR', owner: 'razor', reach: 'self', cd: 3, wt: 50, text: 'Shield of 15% of its max HP, 2 turns. Its next turn comes 20% sooner.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.15, 2); c.hasten(c.u, 20); } });
defMove({ id: 'razor_wind', name: 'Wind Up', type: 'GEAR', owner: 'razor', reach: 'self', cd: 6, nerve: 4, wt: 50, text: 'Haste 1. For 2 turns: 1.2x ATK. Then: 80% ATK + 25% missing HP.',
  run(c) { c.mark(c.u, 'razor_long', 1, 2); c.st(c.u, 'haste', 1); } });

// annulet: a ring of starlight that lights foes for its next hit, binds, shields out and back, dithers, and sends a long spark.
defMark({ id: 'annulet_lit', name: 'lit', clock: 'own', negative: true, value: -0.06 });
function annuletBurst(b: Battle, f: Fighter, t: Fighter): void {
  if (!marked(t, 'annulet_lit') || t.ko || f.k.lighting) return;
  unmark(t, 'annulet_lit');
  f.k.lighting = 1;
  strike(b, f, t, stat(b, f, 'mgk') * 0.4, 'M', 'STAR');
  f.k.lighting = 0;
}
defMark({ id: 'annulet_barrier', name: 'ring coming back', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { const mk = unmark(f, 'annulet_barrier'); const by = mk ? markedBy(b, mk) : null; if (by) giveShield(b, by, f, f.maxHp * (has(by, 'annulet_ring') ? 0.12 : 0.1), 2); } });
defPassive({ id: 'annulet_kept', name: 'Kept Light', owner: 'annulet', text: 'Its moves Light the foe. Its next hit on a Lit foe adds 40% MGK.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; if (marked(t, 'annulet_lit') && !d.move) annuletBurst(b, f, t); else if (d.move) { if (marked(t, 'annulet_lit')) annuletBurst(b, f, t); else mark(b, f, t, 'annulet_lit', 1, 2); } } });
defPassive({ id: 'annulet_ring', name: 'Ring Light', owner: 'annulet', text: 'Its shields are 1.2x.' });
defMove({ id: 'annulet_draw', name: 'Draw Light', type: 'STAR', owner: 'annulet', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 85% MGK. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'annulet_glow', name: 'Glow', type: 'STAR', owner: 'annulet', reach: 'ally', cd: 3, text: 'Shields an ally 10% of max HP now and again at its next turn.',
  run(c) { const p = has(c.u, 'annulet_ring') ? 0.12 : 0.1; c.shield(c.ally!, c.ally!.maxHp * p, 2); c.mark(c.ally!, 'annulet_barrier', 1, 2); } });
defMove({ id: 'annulet_dither', name: 'Dither', type: 'STAR', owner: 'annulet', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 75% MGK. Slow 2.',
  run(c) { c.spread({ mgk: 0.75 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'annulet_landing', name: 'Long Spark', type: 'STAR', owner: 'annulet', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, text: 'Hits for 160% MGK. Reserves take 35% of the damage. If it KOs the foe: its cooldown resets.',
  run(c) { c.hit(c.tgt, { mgk: 1.6 }); for (const r of reserves(c.them)) c.hit(r, { mgk: 1.6 }, { reserve: true, spread: true, mult: 0.35 }); if (c.tgt.ko) ready(c.u, 'annulet_landing'); } });

// ================================================================ chapter 1 and 2: the Cowrie

// macula: a dark spot that hits the newly out hardest, shivs, leaves a box that frightens, looks away, and leaves a copy that bursts.
defSummon({ id: 'macula_box', name: 'Spot Box', owner: 'macula', text: 'When a foe comes out: it must switch at its next turn. Each turn: 30% MGK to the foe.', every: 100,
  sprite: { px: ['........', '........', '.4444...', '....444.', '.222222.', '.231222.', '.222222.', '........'], c: ['#423850', '#f2eae2', '#b32037'] },
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.3, 'M', 'VOID'); },
  trap(b, s, who) { msg(b, `A box opens in front of ${label(b, who)}.`); forceAction(b, who, 'switch'); return false; } });
defSummon({ id: 'macula_copy', name: 'Spot Copy', owner: 'macula', sprite: { px: ['4......4', '44.22.44', '.422224.', '.233332.', '.313313.', '.311113.', '.222222.', '..2..2..'], c: ['#685e76', '#d5cddd', '#b76d7d'] }, text: 'Takes single-target hits meant for Madaku. When it goes: 80% MGK to every foe.', every: 100, guard: true,
  act() { /* the copy only stands */ },
  gone(b, s, f) { if (!f || f.ko) return; msg(b, 'The copy bursts.'); splash(b, f, stat(b, f, 'mgk') * 0.8, 'M', 'VOID'); } });
defPassive({ id: 'macula_first', name: 'First Spot', owner: 'macula', text: 'Deals 1.5x damage to a foe that came out since its last turn.',
  outMul(b, f, t, d) { return !d.reserve && t.outAt > (f.k.prevTurn ?? -1) ? 1.5 : 1; } });
defPassive({ id: 'macula_unwatched', name: 'Unwatched', owner: 'macula', text: 'Its hits from Hidden deal 1.4x.',
  outMul(b, f) { return f.s.hidden ? 1.4 : 1; } });
defMove({ id: 'macula_dark', name: 'Dark Spot', type: 'VOID', owner: 'macula', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 105% MGK. Slow 1. Weaken 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); c.st(c.tgt, 'slow', 1); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'macula_moveoff', name: 'Move Off', type: 'VOID', owner: 'macula', reach: 'side', tags: ['projectile'], cd: 4, text: 'Summons a Spot Box (10% max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'macula_box', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'macula_lookup', name: 'Look Up', type: 'VOID', owner: 'macula', reach: 'self', cd: 3, wt: 50, text: 'Hidden 1. Its next move deals 1.3x.',
  run(c) { c.st(c.u, 'hidden', 1); c.u.k.nextMoveMul = 1.3; } });
defMove({ id: 'macula_spots', name: 'Many Spots', type: 'VOID', owner: 'macula', reach: 'side', cd: 6, nerve: 4, text: 'Summons a Spot Copy (20% max HP, 3 turns). Hidden 1.',
  run(c) { summon(c.b, c.u, 'macula_copy', { hp: 0.2, turns: 3 }); c.st(c.u, 'hidden', 1); } });

// pallium: a cowrie's mantle that slides over its team, buffs a friend, flashes, and covers everyone in shine.
defMark({ id: 'pallium_radiance', name: 'shine coming', clock: 'own', volatile: true, value: 0.2,
  turnStart(b, f) { unmark(f, 'pallium_radiance'); msg(b, 'Light covers them.'); for (const a of standing(b.s[f.side])) { heal(b, f, a, a.maxHp * 0.15); if (isOut(b, a)) applyStatus(b, f, a, 'invuln', 1); } } });
defPassive({ id: 'pallium_polishes', name: 'Polishes', owner: 'pallium', text: 'Its heals are 1.2x.',
  healMul() { return 1.2; } });
defPassive({ id: 'pallium_lieson', name: 'Lies On', owner: 'pallium', text: 'When it uses a move: its next 2 attacks heal your team 7% of max HP.',
  afterMove(b, f) { f.k.brava = 2; },
  afterAttack(b, f) { if (!f.k.brava) return; f.k.brava--; for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.07); } });
defMove({ id: 'pallium_slide', name: 'Slide Over', type: 'TIDE', owner: 'pallium', reach: 'team', cd: 2, text: 'Your out whorl heals 18% of max HP, reserves 10%.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * (isOut(c.b, a) ? 0.18 : 0.1)); } });
defMove({ id: 'pallium_buff', name: 'Buff', type: 'TIDE', owner: 'pallium', reach: 'ally', cd: 3, text: 'An ally: Fortify 2. Shield of 15% of its max HP.',
  run(c) { c.st(c.ally!, 'fortify', 2); c.shield(c.ally!, c.ally!.maxHp * 0.15, 3); } });
defMove({ id: 'pallium_dazzle', name: 'Bright Flash', type: 'TIDE', owner: 'pallium', reach: 'single', tags: ['spell'], cd: 3, wu: 50, text: 'Wind-up. Hits for 170% MGK. Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.7 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'pallium_shine', name: 'Shine', type: 'TIDE', owner: 'pallium', reach: 'team', cd: 7, nerve: 5, wt: 60, text: 'Next turn: your team heals 15%, your out whorl is Untouchable 1.',
  run(c) { c.mark(c.u, 'pallium_radiance', 1, 2); } });

// seiche: a standing wave that sloshes, raises a still wall, strikes through guard, and breaks over the line.
defSummon({ id: 'seiche_wall', name: 'Still Wall', owner: 'seiche', text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  sprite: { px: ['........', '33333333', '24242424', '22222222', '24242424', '22222222', '44444444', '........'], c: ['#6a8aa7', '#eef6fd', '#30506f'] },
  act() { /* the wall only stands */ } });
defPassive({ id: 'seiche_standing', name: 'Standing Wave', owner: 'seiche', text: 'Cannot be forced out. Takes 0.85x damage while its Still Wall stands.',
  immovable() { return true; },
  inMul(b, f) { return summonsOf(b, f.side, 'seiche_wall').length ? 0.85 : 1; } });
defPassive({ id: 'seiche_gray', name: 'Gray Pin', owner: 'seiche', text: 'Deals 1.2x damage to a foe that can\'t switch.',
  outMul(b, f, t) { return !canSwitch(b, t) ? 1.2 : 1; } });
defMove({ id: 'seiche_slosh', name: 'Slosh', type: 'TIDE', owner: 'seiche', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 78% MGK.',
  run(c) { c.spread({ mgk: 0.78 }); } });
defMove({ id: 'seiche_still', name: 'Still', type: 'TIDE', owner: 'seiche', reach: 'side', cd: 4, text: 'Summons a Still Wall (25% max HP, 3 turns).',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'seiche_wall')) dismiss(c.b, s); summon(c.b, c.u, 'seiche_wall', { hp: 0.25, turns: 3 }); } });
defMove({ id: 'seiche_hold', name: 'Hold Water', type: 'TIDE', owner: 'seiche', reach: 'single', tags: ['projectile', 'spell'], noGuard: true, cd: 2, text: 'Hits for 110% MGK through guard.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); } });
defMove({ id: 'seiche_break', name: 'Break Over', type: 'TIDE', owner: 'seiche', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 70, text: 'Wind-up. Hits every foe for 120% MGK. Stun 1. Reserves: Slow 1.',
  run(c) { c.spread({ mgk: 1.2 }); c.st(c.tgt, 'stun', 1); for (const r of reserves(c.them)) c.st(r, 'slow', 1); } });

// scud: running spray that throws a star twice with its shade, skips ahead, runs through, and marks a foe to come due.
defSummon({ id: 'scud_shade', name: 'Spray Shade', owner: 'scud', text: 'Roibuki\'s moves strike again from it. 3 turns.', every: 100,
  sprite: { px: ['........', '..4444..', '.434434.', '.444444.', '2.4444.2', '..4..4..', '.4....4.', '........'], c: ['#c0ccd8', '#da031e', '#3c3c4a'] },
  act() { /* the shadow only copies */ } });
const shade = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'scud_shade').length > 0;
defMark({ id: 'scud_deathmark', name: 'coming due', clock: 'own', negative: true, value: -0.2,
  afterTake(b, f, src, dealt, d) { const mk = f.m.scud_deathmark; if (mk && src && markedBy(b, mk) === src) f.k.owed = (f.k.owed || 0) + dealt; },
  expire(b, f, mk) { const by = markedBy(b, mk); const owed = f.k.owed || 0; f.k.owed = 0; if (!by) return; msg(b, `The mark on ${label(b, f)} comes due.`); strike(b, by, f, stat(b, by, 'atk') * 0.5 + owed * 0.35, 'P', 'SALT'); } });
defPassive({ id: 'scud_kept', name: 'Kept Running', owner: 'scud', text: 'Its first hit on a foe below 50% HP adds 8% of max HP. Once per foe.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || !under(t, 0.5) || t.k.contempt) return; t.k.contempt = 1; strike(b, f, t, t.maxHp * 0.08, 'P', 'SALT'); } });
defPassive({ id: 'scud_ahead', name: 'Ahead', owner: 'scud', text: 'When it comes out: its first turn comes 35% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 35; } });
defMove({ id: 'scud_whip', name: 'Spray Star', type: 'SALT', owner: 'scud', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 93% ATK. With its Spray Shade out: again for 46% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.93 }); if (shade(c.b, c.u) && !c.tgt.ko) c.hit(c.tgt, { atk: 0.46 }); } });
defMove({ id: 'scud_skip', name: 'Skip Ahead', type: 'SALT', owner: 'scud', reach: 'side', cd: 3, text: 'Summons a Spray Shade (15% max HP, 3 turns). Its next turn comes 30% sooner.',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'scud_shade')) dismiss(c.b, s); summon(c.b, c.u, 'scud_shade', { hp: 0.15, turns: 3 }); c.hasten(c.u, 30); } });
defMove({ id: 'scud_run', name: 'Run Through', type: 'SALT', owner: 'scud', reach: 'spread', cd: 3, text: 'Hits every foe for 66% ATK. With its Spray Shade out: Slow 2.',
  run(c) { c.spread({ atk: 0.66 }); if (shade(c.b, c.u)) c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'scud_spume', name: 'Spume Mark', type: 'SALT', owner: 'scud', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Untouchable 1. Hits for 53% ATK. After 2 of the foe\'s turns: it takes 50% ATK + 35% of the damage this whorl dealt it in between.',
  run(c) { c.st(c.u, 'invuln', 1); c.hit(c.tgt, { atk: 0.53 }); if (!c.tgt.ko) { c.tgt.k.owed = 0; c.mark(c.tgt, 'scud_deathmark', 1, 2); } } });

// ================================================================ chapter 2: the Polish

// enamel: a sheet of polish that leaves held foes Sunlit, breaks day on a foe, dims, slides a glaze blade, and flares from the dome.
defMark({ id: 'enamel_sun', name: 'sunlit', clock: 'own', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'enamel_gloss', name: 'Gloss', owner: 'enamel', text: 'Foes it Stuns or Roots are Sunlit for 2 turns.',
  afterApply(b, f, t, id) { if ((id === 'stun' || id === 'root') && t.side !== f.side) mark(b, f, t, 'enamel_sun', 1, 2); } });
function sunBurst(b: Battle, f: Fighter, t: Fighter): void {
  if (!marked(t, 'enamel_sun') || t.k.sunning || t.ko) return;
  t.k.sunning = 1; unmark(t, 'enamel_sun');
  strike(b, f, t, stat(b, f, 'mgk') * 0.4, 'M', 'STONE');
  t.k.sunning = 0;
}
defPassive({ id: 'enamel_shatter', name: 'Shatter Glaze', owner: 'enamel', text: 'Sunlit: the next hit on it from Nitorshi or its out ally adds 40% of Nitorshi\'s MGK.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) sunBurst(b, f, t); },
  auraOut(b, f, o, t, d) { if (!d.dot && !d.reserve && t.side !== f.side) sunBurst(b, f, t); return 1; } });
defMove({ id: 'enamel_slam', name: 'Daybreak', type: 'STONE', owner: 'enamel', reach: 'single', cd: 3, text: 'Hits for 87% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 0.87 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'enamel_bash', name: 'Dim Coat', type: 'STONE', owner: 'enamel', reach: 'self', cd: 3, wt: 60, text: 'Fortify 1 (40% less damage). At its next turn: every foe takes 60% MGK.',
  run(c) { c.st(c.u, 'fortify', 1, 0.4); c.mark(c.u, 'enamel_flash', 1, 2); } });
defMark({ id: 'enamel_flash', name: 'dimmed', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'enamel_flash'); splash(b, f, stat(b, f, 'mgk') * 0.6, 'M', 'STONE'); } });
defMove({ id: 'enamel_glaze', name: 'Glaze Blade', type: 'STONE', owner: 'enamel', reach: 'single', tags: ['dash'], cd: 4, text: 'Hits for 79% ATK. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 0.79 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'enamel_whole', name: 'Whole Dome', type: 'STONE', owner: 'enamel', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 50, text: 'Wind-up. Hits every foe for 87% MGK. Stun 2. Reserves: Slow 1.',
  run(c) { c.spread({ mgk: 0.87 }); c.st(c.tgt, 'stun', 2); for (const r of reserves(c.them)) c.st(r, 'slow', 1); } });

// porcella: a glazed pig that tilts in fast, snorts up summons, starts rolling, bumps snowballs, and rolls downhill into the cold.
defPassive({ id: 'porcella_tilts', name: 'Tilts', owner: 'porcella', text: 'When it comes out: its first turn comes 30% sooner, its first attack deals 1.2x.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 30; f.k.rollIn = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.rollIn ? 1.2 : 1; },
  afterAttack(b, f) { f.k.rollIn = 0; } });
defPassive({ id: 'porcella_glazed', name: 'Glaze Shell', owner: 'porcella', text: 'Takes 0.8x damage while it has a wind-up coming.',
  inMul(b, f) { return b.pend.some(p => p.kind === 'windup' && p.side === f.side && p.idx === f.idx) ? 0.8 : 1; } });
defMove({ id: 'porcella_snort', name: 'Snort', type: 'BEAST', owner: 'porcella', reach: 'single', cd: 1, text: 'Hits for 126% ATK. Heals 15% of it. Foe summons take 40% ATK.',
  run(c) { const d = c.hit(c.tgt, { atk: 1.26 }); c.heal(c.u, d * 0.15); hitAllSummons(c.b, c.them === c.b.s[0] ? 0 : 1, stat(c.b, c.u, 'atk') * 0.4); } });
defMove({ id: 'porcella_start', name: 'Start Rolling', type: 'BEAST', owner: 'porcella', reach: 'single', tags: ['dash'], cd: 4, wu: 80, unstop: true, text: 'Unstoppable wind-up. Hits for 137% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 1.37 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'porcella_bump', name: 'Bump', type: 'BEAST', owner: 'porcella', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits 3 times for 37% ATK. All 3 land: Root 1.',
  run(c) { let n = 0; for (let i = 0; i < 3 && !c.tgt.ko; i++) if (c.hit(c.tgt, { atk: 0.37 }) > 0) n++; if (n === 3) c.st(c.tgt, 'root', 1); } });
defMove({ id: 'porcella_downhill', name: 'Downhill', type: 'BEAST', owner: 'porcella', reach: 'spread', tags: ['channel'], cd: 6, nerve: 5, wu: 100, text: 'Long wind-up. Hits every foe for 179% ATK. Slow 2.',
  run(c) { c.spread({ atk: 1.79 }); c.st(c.tgt, 'slow', 2); } });

// specie: a shut purse that gathers Coins, clips, pays out a hold, buys time, and spends it all on its team.
defMark({ id: 'specie_embrace', name: 'held', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `${label(b, f)} is held.`); applyStatus(b, by, f, 'root', 2); strike(b, by, f, stat(b, by, 'atk') * 0.5, 'P', 'GEAR'); } });
defPassive({ id: 'specie_clinks', name: 'Clinks', owner: 'specie', text: 'When a foe is KO\'d, and every 3rd attack: a Coin, max 10. +3% ATK per Coin.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.coins = (f.k.coins || 0) + 1; },
  afterAttack(b, f) { f.k.ca = (f.k.ca || 0) + 1; if (f.k.ca % 3 === 0) f.k.coins = (f.k.coins || 0) + 1; },
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.03 * Math.min(10, f.k.coins || 0)) : 0; } });
defPassive({ id: 'specie_shut', name: 'Shut Purse', owner: 'specie', text: 'Its attacks deal 1.3x. After it attacks: its next turn comes 15% later.',
  outMul(b, f, t, d) { return d.attack ? 1.3 : 1; },
  turnEnd(b, f, action) { if (action === 'attack') b.s[f.side].next += 15; } });
defMove({ id: 'specie_clip', name: 'Clip', type: 'GEAR', owner: 'specie', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 82% ATK. Your lowest-HP whorl heals 40% of it.',
  run(c) { const d = c.hit(c.tgt, { atk: 0.82 }); const a = standing(c.me).sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0]; if (a) c.heal(a, d * 0.4); } });
defMove({ id: 'specie_payout', name: 'Pay Out', type: 'GEAR', owner: 'specie', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 55% ATK. If still out next turn: Root 2, 50% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.55 }); if (!c.tgt.ko) c.mark(c.tgt, 'specie_embrace', 1, 1); } });
defMove({ id: 'specie_buy', name: 'Buy Time', type: 'GEAR', owner: 'specie', reach: 'self', cd: 4, wt: 50, text: 'Hidden 1. Its next attack deals 1.4x.',
  run(c) { c.st(c.u, 'hidden', 1); c.u.k.nextAtkMul = 1.4; } });
defMove({ id: 'specie_spend', name: 'Spend It All', type: 'GEAR', owner: 'specie', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, text: 'Hits for 86% ATK, reserves 70% of it. Team gets a 12% max HP shield.',
  run(c) { c.hit(c.tgt, { atk: 0.86 }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.86 }, { reserve: true, spread: true, mult: 0.7 }); for (const a of standing(c.me)) c.shield(a, a.maxHp * 0.12, 2); } });

// emery: polishing grit that leaves foes Caustic, stings, rubs under, hides in a grit storm, and polishes off the ground.
defMark({ id: 'emery_caustic', name: 'caustic', clock: 'own', negative: true, value: -0.06,
  anyKO(b, f, v) { if (v !== f) return; const mk = f.m.emery_caustic; const by = mk ? markedBy(b, mk) : null; if (!by || by.ko) return; msg(b, `${label(b, f)} bursts in grit.`); for (const r of reserves(b.s[f.side])) dealDamage(b, by, r, stat(b, by, 'atk') * 0.6, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defMark({ id: 'emery_storm', name: 'in a grit storm', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.35, 'P', 'SALT'); } });
defMark({ id: 'emery_pulse', name: 'scouring', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.5, 'P', 'SALT'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'emery_scours', name: 'Scours', owner: 'emery', text: 'Foes it hits are Caustic 3 turns: if KO\'d, their reserves take 60% ATK.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side && !t.ko) mark(b, f, t, 'emery_caustic', 1, 3); } });
defPassive({ id: 'emery_hardgrit', name: 'Hard Grit', owner: 'emery', text: 'Attackers take 15% of their damage back.',
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src !== f && !src.ko) dealDamage(b, f, src, dealt * 0.15, { ...dot('M'), reflect: true } as DmgInfo, null); } });
defMove({ id: 'emery_coarse', name: 'Coarse Sting', type: 'SALT', owner: 'emery', reach: 'single', cd: 1, text: 'Hits for 100% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'emery_rub', name: 'Rub Under', type: 'SALT', owner: 'emery', reach: 'single', tags: ['dash'], cd: 4, text: 'Hits for 82% ATK. Stun 1. Expose 1.',
  run(c) { c.hit(c.tgt, { atk: 0.82 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'emery_abrade', name: 'Abrade', type: 'SALT', owner: 'emery', reach: 'self', cd: 4, wt: 60, text: 'Hidden 2. 2 turns: 35% ATK to every foe each turn.',
  run(c) { c.st(c.u, 'hidden', 2); c.mark(c.u, 'emery_storm', 1, 2); } });
defMove({ id: 'emery_polishoff', name: 'Polish Off', type: 'SALT', owner: 'emery', reach: 'spread', cd: 6, nerve: 5, wu: 50, text: 'Wind-up. Hits every foe for 55% ATK. Next 3 turns: 50% ATK, Slow 1.',
  run(c) { c.spread({ atk: 0.55 }); c.mark(c.u, 'emery_pulse', 1, 3); } });

// faience: a glazed flower that rings true every third move, sounds a clear note, chimes for its team, drips from the box, and peals out.
defPassive({ id: 'faience_rings', name: 'Rings True', owner: 'faience', text: 'Every 3rd move: 50% MGK to the foe, and your team heals 4% of max HP.',
  afterMove(b, f) {
    f.k.echo = (f.k.echo || 0) + 1;
    if (f.k.echo % 3 !== 0) return;
    const t = foe(b, f);
    msg(b, 'Ting.');
    if (t) strike(b, f, t, stat(b, f, 'mgk') * 0.5, 'M', 'ROOT');
    for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.04);
  } });
defPassive({ id: 'faience_petals', name: 'Petals', owner: 'faience', text: 'Its heals and shields are 1.2x.',
  healMul() { return 1.2; } });
defMove({ id: 'faience_clear', name: 'Clear Note', type: 'ROOT', owner: 'faience', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 90% MGK + 6% of the foe\'s missing HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.9, tgtMiss: 0.06 }); } });
defMove({ id: 'faience_chime', name: 'Chime', type: 'ROOT', owner: 'faience', reach: 'team', cd: 3, text: 'Your team: a shield of 10% max HP, 2 turns. Haste 1.',
  run(c) { const p = has(c.u, 'faience_petals') ? 1.2 : 1; for (const a of standing(c.me)) { c.shield(a, a.maxHp * 0.1 * p, 2); c.st(a, 'haste', 1); } } });
defMove({ id: 'faience_box', name: 'Window Box', type: 'ROOT', owner: 'faience', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 75% MGK. Slow 2. Already Slowed: Root 2.',
  run(c) { const slowed = !!c.tgt.s.slow; c.hit(c.tgt, { mgk: 0.75 }); c.st(c.tgt, 'slow', 2); if (slowed) c.st(c.tgt, 'root', 2); } });
defMove({ id: 'faience_peal', name: 'Peal Out', type: 'ROOT', owner: 'faience', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, text: 'Hits every foe for 110% MGK. The foe skips its next turn.',
  run(c) { c.spread({ mgk: 1.1 }); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'skip'); } });

// ================================================================ chapter 2: the Under-teeth

// denticle: three teeth that bleed what they bite, gnash, go All Teeth, overbite, and lock their jaw.
defMark({ id: 'denticle_frenzy', name: 'all teeth', clock: 'own', volatile: true, value: 0.12,
  forbid(b, f, what) { return what === 'attack' || what === 'switch' ? null : 'In a frenzy.'; },
  outMul(b, f, t, d) { return d.attack ? 1.4 : 1; },
  afterAttack(b, f) { hastenFighter(b, f, 25); },
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.2); } });
defPassive({ id: 'denticle_nothing', name: 'Nothing Left', owner: 'denticle', text: 'Its attacks add Bleed 1 (15% ATK per stack each turn).',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.15); } });
defPassive({ id: 'denticle_still', name: 'Still Meshing', owner: 'denticle', text: 'Its attacks heal 15% of the damage dealt, 30% below 50% HP.',
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * (under(f, 0.5) ? 0.3 : 0.15)); } });
defMove({ id: 'denticle_bite', name: 'Gnash Bite', type: 'BEAST', owner: 'denticle', reach: 'single', cd: 1, text: 'Hits for 125% ATK. Bleed 2 (12% ATK per stack each turn).',
  run(c) { c.hit(c.tgt, { atk: 1.25 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'denticle_teeth', name: 'All Teeth', type: 'BEAST', owner: 'denticle', reach: 'self', cd: 4, wt: 50, text: 'For 2 turns: it can only Attack or Switch. Its attacks deal 1.4x, heal 20% of their damage, and make its next turn come 25% sooner.',
  run(c) { c.mark(c.u, 'denticle_frenzy', 1, 2); } });
defMove({ id: 'denticle_overbite', name: 'Overbite', type: 'BEAST', owner: 'denticle', reach: 'single', tags: ['channel'], cd: 3, text: 'Hits for 102% ATK. Heals 10% max HP. If the foe can\'t switch: Stun 1.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 1.02 }); c.heal(c.u, c.u.maxHp * 0.1); if (pinned) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'denticle_lockjaw', name: 'Lockjaw', type: 'BEAST', owner: 'denticle', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Hits for 156% ATK. Root 3. Then All Teeth for 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.56 }); c.st(c.tgt, 'root', 3); c.mark(c.u, 'denticle_frenzy', 1, 2); } });

// diastema: a wandering gap that cuts off wind-ups, slips a blade in, closes a pulse, and walks wider each time.
defPassive({ id: 'diastema_wandered', name: 'Wandered', owner: 'diastema', text: 'Takes 0.8x magic damage.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.8 : 1; } });
defPassive({ id: 'diastema_gap', name: 'Gap', owner: 'diastema', text: 'When a foe uses a move: Pulse Close\'s cooldown drops 1.',
  anyMove(b, f, user, m) { if (!m || user.side === f.side) return; const i = f.moves.indexOf('diastema_close'); if (i >= 0) f.cd[i] = Math.max(0, f.cd[i] - 1); } });
defMove({ id: 'diastema_null', name: 'Gap Sphere', type: 'VOID', owner: 'diastema', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 109% MGK. Interrupts.',
  run(c) { c.hit(c.tgt, { mgk: 1.09 }); c.interrupt(c.tgt); } });
defMove({ id: 'diastema_slip', name: 'Slip Blade', type: 'VOID', owner: 'diastema', reach: 'self', cd: 3, wt: 50, text: 'Its next attack adds 80% MGK and gives 1 tide.',
  run(c) { c.mark(c.u, 'diastema_blade', 1, 2); } });
defMark({ id: 'diastema_blade', name: 'blade in the gap', clock: 'own', volatile: true, value: 0.08,
  afterAttack(b, f, t) { unmark(f, 'diastema_blade'); if (!t.ko && !t.gone) strike(b, f, t, stat(b, f, 'mgk') * 0.8, 'M', 'VOID'); addNerve(b, f.side, 1); } });
defMove({ id: 'diastema_close', name: 'Pulse Close', type: 'VOID', owner: 'diastema', reach: 'spread', tags: ['spell'], cd: 4, text: 'Hits every foe for 87% MGK. Slow 2.',
  run(c) { c.spread({ mgk: 0.87 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'diastema_wider', name: 'Wider', type: 'VOID', owner: 'diastema', reach: 'single', tags: ['dash', 'spell'], cd: 5, nerve: 3, text: 'Hits for 109% MGK, +40% per use in its last 4 turns, max 3.',
  run(c) {
    const recent = (c.u.k.riftAt || -99) >= c.b.turnNo - 8 ? Math.min(3, c.u.k.rifts || 0) : 0;
    c.hit(c.tgt, { mgk: 1.09 }, { mult: 1 + 0.4 * recent });
    c.u.k.rifts = recent + 1; c.u.k.riftAt = c.b.turnNo;
  } });

// furl: a rolled lip that changes stance with every move: claw, mantle, rush, or storm.
const furlStance = (f: Fighter) => f.k.stance || 0;
function setStance(b: Battle, f: Fighter, n: number): void {
  if (furlStance(f) === n) return;
  f.k.stance = n;
  if (has(f, 'furl_fast')) { f.k.furyHits = 2; hastenFighter(b, f, 20); }
  if (has(f, 'furl_rolled')) cleanse(b, f, 1);
}
defMark({ id: 'furl_storm', name: 'storm stance', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.4, 'M', 'ROOT'); } });
defPassive({ id: 'furl_fast', name: 'Fast Roll', owner: 'furl', text: 'When it changes stance: its next turn comes 20% sooner, and its next 2 attacks heal 4% of its max HP.',
  afterAttack(b, f) { if (!f.k.furyHits) return; f.k.furyHits--; heal(b, f, f, f.maxHp * 0.08 * 0.5); },
  outMul(b, f, t, d) { return d.attack && furlStance(f) === 1 ? 1.3 : 1; },
  inMul(b, f) { return furlStance(f) === 2 ? 0.85 : 1; } });
defPassive({ id: 'furl_rolled', name: 'Rolled In', owner: 'furl', text: 'Changing stance removes 1 bad status.' });
defMove({ id: 'furl_lash', name: 'Claw Roll', type: 'ROOT', owner: 'furl', reach: 'single', cd: 1, text: 'Claw stance: attacks deal 1.3x. Hits for 74% ATK. Bleed 2 (12% ATK per stack each turn).',
  run(c) { setStance(c.b, c.u, 1); c.hit(c.tgt, { atk: 0.74 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'furl_tight', name: 'Roll Tight', type: 'ROOT', owner: 'furl', reach: 'self', cd: 3, wt: 60, text: 'Mantle stance: takes 0.85x damage. Shield of 15% max HP, 2 turns.',
  run(c) { setStance(c.b, c.u, 2); c.shield(c.u, c.u.maxHp * 0.15, 2); } });
defMove({ id: 'furl_whip', name: 'Whip Out', type: 'ROOT', owner: 'furl', reach: 'single', tags: ['dash'], cd: 4, text: 'Rush stance. Hits for 70% ATK. Stun 1.',
  run(c) { setStance(c.b, c.u, 3); c.hit(c.tgt, { atk: 0.7 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'furl_unroll', name: 'Unroll', type: 'ROOT', owner: 'furl', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, text: 'Storm stance. Hits every foe for 65% MGK. Next 3 turns: 40% MGK.',
  run(c) { setStance(c.b, c.u, 4); c.spread({ mgk: 0.65 }); c.mark(c.u, 'furl_storm', 1, 3); } });

// ================================================================ chapter 2: the Glaze Halls

// laggard: a late reflection that leaves Sigils, falls behind, chains a foe, and does its last move again.
defMark({ id: 'laggard_sigil', name: 'sigil', clock: 'own', negative: true, value: -0.08 });
defMark({ id: 'laggard_chain', name: 'lagging', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The chain closes on ${label(b, f)}.`); applyStatus(b, by, f, 'root', 2); strike(b, by, f, stat(b, by, 'mgk') * 0.5, 'M', 'VOID'); } });
defSummon({ id: 'laggard_image', name: 'Late Image', owner: 'laggard', sprite: { px: ['........', '3..3....', '33.33...', '4322223.', '4212212.', '4322223.', '..4444..', '.4.44.4.'], c: ['#b2b6cb', '#b28b4b', '#785995'] }, text: 'Takes single-target hits meant for your out whorl. 2 turns.', every: 100, guard: true,
  act() { /* the copy only stands */ } });
function sigilBurst(b: Battle, f: Fighter, t: Fighter): void {
  if (!marked(t, 'laggard_sigil') || t.ko) return;
  unmark(t, 'laggard_sigil');
  msg(b, `The sigil on ${label(b, t)} bursts.`);
  strike(b, f, t, stat(b, f, 'mgk') * 0.6, 'M', 'VOID');
}
defPassive({ id: 'laggard_glass', name: 'Behind Glass', owner: 'laggard', text: 'Once per battle, below 40% HP: Hidden 1 and a Late Image (10% max HP).',
  afterTake(b, f) { if (f.k.glassed || f.hp <= 0 || !under(f, 0.4)) return; f.k.glassed = 1; applyStatus(b, f, f, 'hidden', 1); summon(b, f, 'laggard_image', { hp: 0.1, turns: 2 }); } });
defPassive({ id: 'laggard_late', name: 'Late', owner: 'laggard', text: 'Its moves deal 1.2x damage to a foe with a Sigil.',
  outMul(b, f, t, d) { return d.move && marked(t, 'laggard_sigil') ? 1.2 : 1; } });
defMove({ id: 'laggard_catchup', name: 'Catch Up', type: 'VOID', owner: 'laggard', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 97% MGK. Sigil 3: its next move on the foe adds 60% MGK.',
  run(c) { sigilBurst(c.b, c.u, c.tgt); c.hit(c.tgt, { mgk: 0.97 }); if (!c.tgt.ko) c.mark(c.tgt, 'laggard_sigil', 1, 3); c.u.k.lastLag = 1; } });
defMove({ id: 'laggard_behind', name: 'Fall Behind', type: 'VOID', owner: 'laggard', reach: 'spread', tags: ['dash', 'spell'], cd: 3, text: 'Hits every foe for 76% MGK. Its next turn comes 30% sooner.',
  run(c) { sigilBurst(c.b, c.u, c.tgt); c.spread({ mgk: 0.76 }); c.hasten(c.u, 30); c.u.k.lastLag = 2; } });
defMove({ id: 'laggard_lag', name: 'Lag Chain', type: 'VOID', owner: 'laggard', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 65% MGK. If still out next turn: 50% MGK, Root 2.',
  run(c) { sigilBurst(c.b, c.u, c.tgt); c.hit(c.tgt, { mgk: 0.65 }); if (!c.tgt.ko) c.mark(c.tgt, 'laggard_chain', 1, 1); c.u.k.lastLag = 3; } });
defMove({ id: 'laggard_mirror', name: 'Mirror Back', type: 'VOID', owner: 'laggard', reach: 'single', tags: ['spell'], cd: 5, nerve: 4, text: 'Uses its last move again at 1.2x power.',
  run(c) {
    const id = ['', 'laggard_catchup', 'laggard_behind', 'laggard_lag'][c.u.k.lastLag || 1];
    const m = MOVES[id];
    if (!m) return;
    c.msg(`${label(c.b, c.u)} does ${m.name} again.`);
    borrow(c, m, 1.2);
  } });

// tain: mirror silver that turns a foe's reflection on it, leaves Silver Images, tarnishes black, and swaps wounds.
const TAIN_DEMON: SpriteData = { px: ['44....44', '.4.22.4.', '.322223.', '32422423', '32222223', '.333333.', '3.34.3.3', '.334433.'], c: ['#3e3650', '#7c6cc8', '#c4b4e8'] };
defSummon({ id: 'tain_image', name: 'Silver Image', owner: 'tain', sprite: { px: ['........', '..3..3..', '..3223..', '.324423.', '.344443.', '.324423.', '..3333..', '.33..33.'], c: ['#d4d8e4', '#5a83cd', '#6a5e80'] }, text: 'Takes single-target hits meant for your out whorl. Each turn: 35% MGK to the foe.', every: 100, guard: true,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'VOID'); } });
defMark({ id: 'tain_demon', name: 'tarnished', clock: 'own', value: 0.2,
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.4, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'tain_demon'); clearForm(b, f); } });
defPassive({ id: 'tain_silver', name: 'Silver Back', owner: 'tain', text: 'When it attacks: each Silver Image also hits for 20% MGK.',
  afterAttack(b, f, t) { const n = summonsOf(b, f.side, 'tain_image').length; if (n && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.2 * n, 'M', 'VOID'); } });
defPassive({ id: 'tain_nothing', name: 'Bare Glass', owner: 'tain', text: 'While Tarnished: takes 0.85x damage.',
  inMul(b, f) { return marked(f, 'tain_demon') ? 0.85 : 1; } });
defMove({ id: 'tain_backing', name: 'Backing', type: 'VOID', owner: 'tain', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 50% of the foe\'s higher of ATK or MGK. Slow 2.',
  run(c) { if (c.blocked(c.tgt)) return; const p = Math.max(stat(c.b, c.tgt, 'atk'), stat(c.b, c.tgt, 'mgk')); c.hit(c.tgt, { flat: p * 0.5 }, { kind: 'M' }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'tain_blank', name: 'Blank Image', type: 'VOID', owner: 'tain', reach: 'side', cd: 3, text: 'Summons a Silver Image (14% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'tain_image', { hp: 0.14, turns: 3 }); } });
defMove({ id: 'tain_tarnish', name: 'Tarnish', type: 'VOID', owner: 'tain', reach: 'self', tags: ['spell'], cd: 5, wt: 60, text: 'Tarnished 3 turns: 1.25x MGK, 1.1x AGI, attacks hit reserves 40% MGK.',
  run(c) { setForm(c.b, c.u, { tag: 'demon', sprite: TAIN_DEMON, statMul: { mgk: 1.25, agi: 1.1 } }); c.mark(c.u, 'tain_demon', 1, 3); } });
defMove({ id: 'tain_empty', name: 'Empty Swap', type: 'VOID', owner: 'tain', reach: 'single', cd: 6, nerve: 4, text: 'Swaps HP shares with the foe. Its own share stays 25% or more.',
  run(c) {
    if (c.blocked(c.tgt) || c.tgt.s.unstop) return;
    const mine = c.u.hp / c.u.maxHp, theirs = c.tgt.hp / c.tgt.maxHp;
    c.u.hp = Math.max(1, Math.round(c.u.maxHp * Math.max(0.25, theirs)));
    c.tgt.hp = Math.max(1, Math.round(c.tgt.maxHp * mine));
    emit(c.b, { e: 'heal', side: c.u.side, idx: c.u.idx, amt: 0 });
    c.msg(`${label(c.b, c.u)} and ${label(c.b, c.tgt)} trade wounds.`);
  } });

// luster: a dome shine that charges its next attack, throws light long, makes a foe drowsy, hops, and glares on sleepers.
defMark({ id: 'luster_drowsy', name: 'drowsy', clock: 'own', negative: true, value: -0.15,
  expire(b, f, mk) { applyStatus(b, markedBy(b, mk), f, 'sleep', 2); } });
defPassive({ id: 'luster_went', name: 'Went Off', owner: 'luster', text: 'When it uses a move: its next attack adds 50% MGK.',
  afterMove(b, f) { f.k.sparkle = 1; },
  afterAttack(b, f, t) { if (!f.k.sparkle || t.ko || t.gone) return; f.k.sparkle = 0; strike(b, f, t, stat(b, f, 'mgk') * 0.5, 'M', 'STAR'); } });
defPassive({ id: 'luster_dark', name: 'Full Dark', owner: 'luster', text: 'Deals 2x damage to a sleeping foe.',
  outMul(b, f, t) { return t.s.sleep ? 2 : 1; } });
defMove({ id: 'luster_shine', name: 'Dome Shine', type: 'STAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 113% MGK. 1.3x on a foe that was already out at its last turn.',
  run(c) { const long = c.tgt.outAt < (c.u.k.prevTurn ?? 0); c.hit(c.tgt, { mgk: 1.13 }, { mult: long ? 1.3 : 1 }); } });
defMove({ id: 'luster_drowse', name: 'Drowse', type: 'STAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 4, text: 'Hits for 43% MGK. After its next turn: Sleep 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.43 }); if (!c.tgt.ko) c.mark(c.tgt, 'luster_drowsy', 1, 1); } });
defMove({ id: 'luster_long', name: 'Long Shine', type: 'STAR', owner: 'luster', reach: 'self', tags: ['dash'], cd: 3, wt: 50, text: 'Haste 2. Its next move deals 1.4x.',
  run(c) { c.st(c.u, 'haste', 2); c.u.k.nextMoveMul = 1.4; } });
defMove({ id: 'luster_glare', name: 'Glare Off', type: 'STAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, text: 'Hits for 162% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.62 }); } });

// ================================================================ chapter 3: the Auger's dune

// gyre: a looped wind that grows with tide, keeps Round ready, cages, spreads Flux, and warps a friend in.
defMark({ id: 'gyre_flux', name: 'fluxed', clock: 'own', negative: true, value: -0.06 });
defPassive({ id: 'gyre_shape', name: 'Shape Held', owner: 'gyre', text: '+2% MGK for each tide your side holds.',
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.st.mgk * 0.02 * (f.k.tideSeen || 0)) : 0; },
  turnStart(b, f) { f.k.tideSeen = b.s[f.side].nerve; } });
defPassive({ id: 'gyre_inner', name: 'Inner Round', owner: 'gyre', text: 'Its other moves reset the cooldown of Round.',
  afterMove(b, f, m) { if (m.id !== 'gyre_round') ready(f, 'gyre_round'); } });
defMove({ id: 'gyre_round', name: 'Round', type: 'TIDE', owner: 'gyre', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 89% MGK. Each Fluxed reserve takes 60% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.89 }); for (const r of reserves(c.them)) if (marked(r, 'gyre_flux')) c.hit(r, { mgk: 0.89 }, { reserve: true, mult: 0.6 }); } });
defMove({ id: 'gyre_whirlin', name: 'Whirl In', type: 'TIDE', owner: 'gyre', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 51% MGK. Root 2, or 3 on a Fluxed foe.',
  run(c) { const fx = c.marked(c.tgt, 'gyre_flux') > 0; c.hit(c.tgt, { mgk: 0.51 }); c.st(c.tgt, 'root', fx ? 3 : 2); } });
defMove({ id: 'gyre_gather', name: 'Flux Gather', type: 'TIDE', owner: 'gyre', reach: 'spread', tags: ['projectile', 'spell'], cd: 2, text: 'Hits every foe for 51% MGK. Every foe is Fluxed for 3 turns.',
  run(c) { c.spread({ mgk: 0.51 }); for (const e of standing(c.them)) c.mark(e, 'gyre_flux', 1, 3); } });
defMove({ id: 'gyre_auger', name: 'Auger Warp', type: 'TIDE', owner: 'gyre', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, text: 'Switches to an ally that acts at once. Both get Empower 2.',
  run(c) { c.st(c.u, 'empower', 2); c.st(c.ally!, 'empower', 2); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 200; } });

// lichen: a lichen that crusts foes with poison, feeds on the poisoned, clings twice, and stares a moving foe to stone.
defPassive({ id: 'lichen_dryside', name: 'Dry Side', owner: 'lichen', text: 'Its moves deal 1.25x damage to Poisoned foes.',
  outMul(b, f, t, d) { return d.move && t.s.poison ? 1.25 : 1; },
  anyMove(b, f, user, m) { if (m && user.side !== f.side) user.k.usedMoveAt = b.turnNo; } });
defPassive({ id: 'lichen_growth', name: 'Slow Growth', owner: 'lichen', text: 'Heals 15% of the damage it deals to Poisoned foes.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && t.s.poison) heal(b, f, f, dealt * 0.15); } });
defMove({ id: 'lichen_encrust', name: 'Encrust', type: 'ROOT', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 107% MGK. Poison 3.',
  run(c) { c.hit(c.tgt, { mgk: 1.07 }); c.st(c.tgt, 'poison', 3); } });
defMove({ id: 'lichen_feed', name: 'Lichen Feed', type: 'ROOT', owner: 'lichen', reach: 'spread', tags: ['spell'], cd: 4, text: 'Poison 1 on every foe. Root 2. Slow 1.',
  run(c) { for (const e of standing(c.them)) c.st(e, 'poison', 1); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'lichen_cling', name: 'Cling Fang', type: 'ROOT', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 132% MGK. On a Poisoned foe: its cooldown resets, but not twice in a row.',
  run(c) { c.hit(c.tgt, { mgk: 1.32 }); if (c.tgt.s.poison && !c.u.k.fangAgain) { c.u.k.fangAgain = 1; ready(c.u, 'lichen_cling'); } else c.u.k.fangAgain = 0; } });
defMove({ id: 'lichen_crust', name: 'Stone Crust', type: 'ROOT', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 153% MGK. If the foe used a move at its last turn: Stun 2. If not: Slow 2.',
  run(c) { const facing = (c.tgt.k.usedMoveAt ?? -9) >= c.b.turnNo - 2; c.hit(c.tgt, { mgk: 1.53 }); if (facing) c.st(c.tgt, 'stun', 2); else c.st(c.tgt, 'slow', 2); } });

// groundswell: a swell that comes in shielded, cascades, raises a water dome, pins with high water, and springs a great wave.
defSummon({ id: 'groundswell_cove', name: 'Water Dome', owner: 'groundswell', sprite: { px: ['........', '..2332..', '.222222.', '22422222', '24442242', '22422222', '44444444', '........'], c: ['#a5dce4', '#effbfb', '#26526f'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* the cove only stands */ } });
defMark({ id: 'groundswell_reckon', name: 'swept up', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.35, 'M', 'TIDE'); } });
defPassive({ id: 'groundswell_full', name: 'Full Swell', owner: 'groundswell', text: 'When it comes out: a shield of 8% of its max HP, 3 turns.',
  comeOut(b, f) { giveShield(b, f, f, f.maxHp * 0.08, 3); } });
defPassive({ id: 'groundswell_setdown', name: 'Settle Down', owner: 'groundswell', text: 'Deals 1.25x damage to a foe that can\'t switch.',
  outMul(b, f, t) { return !canSwitch(b, t) ? 1.25 : 1; } });
defMove({ id: 'groundswell_swell', name: 'Swell Up', type: 'TIDE', owner: 'groundswell', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 60% MGK. Slow 1.',
  run(c) { c.spread({ mgk: 0.6 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'groundswell_lift', name: 'Lift Dome', type: 'TIDE', owner: 'groundswell', reach: 'side', cd: 5, text: 'Summons a Water Dome (28% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'groundswell_cove', { hp: 0.28, turns: 3 }); } });
defMove({ id: 'groundswell_turn', name: 'High Turn', type: 'TIDE', owner: 'groundswell', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 65% MGK. Root 2. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'groundswell_spring', name: 'Spring High', type: 'TIDE', owner: 'groundswell', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 50, text: 'Wind-up. Hits every foe for 78% MGK. Stun 1. Next 2 turns: 35% MGK.',
  run(c) { c.spread({ mgk: 0.78 }); c.st(c.tgt, 'stun', 1); c.mark(c.u, 'groundswell_reckon', 1, 2); } });

// ================================================================ chapter 3: the mouth room

// chalk: climbing chalk that loads its next attack after a move, tosses, hides in dust, climbs out twice, and comes clean.
defMark({ id: 'chalk_flip', name: 'handprint', clock: 'own', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'chalk_hand', name: 'Chalked Hand', owner: 'chalk', text: 'When it uses a move: its next attack deals 1.3x and heals 20% of it.',
  afterMove(b, f) { f.k.mark = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.mark ? 1.3 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.attack && f.k.mark) { f.k.mark = 0; heal(b, f, f, dealt * 0.2); } } });
defPassive({ id: 'chalk_grip', name: 'Chalk Grip', owner: 'chalk', text: 'Its hits from Hidden deal 1.25x.',
  outMul(b, f) { return f.s.hidden ? 1.25 : 1; } });
defMove({ id: 'chalk_toss', name: 'Chalk Toss', type: 'SALT', owner: 'chalk', reach: 'spread', tags: ['projectile'], cd: 1, text: 'Hits every foe for 47% ATK. Slow 1.',
  run(c) { c.spread({ atk: 0.47 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'chalk_dust', name: 'Dust Cloud', type: 'SALT', owner: 'chalk', reach: 'self', cd: 4, wt: 50, text: 'Hidden 2. Haste 1. 1 tide.',
  run(c) { c.st(c.u, 'hidden', 2); c.st(c.u, 'haste', 1); c.nerve(c.me, 1); } });
defMove({ id: 'chalk_climb', name: 'Climb Out', type: 'SALT', owner: 'chalk', reach: 'single', tags: ['projectile', 'dash'], cd: 3, text: 'Hits for 51% ATK, and its cooldown resets. The next use on that foe within 2 turns hits for 58% ATK instead.',
  run(c) {
    if (c.marked(c.tgt, 'chalk_flip')) { unmark(c.tgt, 'chalk_flip'); c.hit(c.tgt, { atk: 0.58 }); return; }
    c.hit(c.tgt, { atk: 0.51 }); if (!c.tgt.ko) { c.mark(c.tgt, 'chalk_flip', 1, 2); ready(c.u, 'chalk_climb'); }
  } });
defMove({ id: 'chalk_hands', name: 'Clean Hands', type: 'SALT', owner: 'chalk', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Hits for 58% ATK. Untouchable 1. Hits for 37% ATK + 30% of the foe\'s missing HP.',
  run(c) { c.hit(c.tgt, { atk: 0.58 }); c.st(c.u, 'invuln', 1); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.37, tgtMiss: 0.3 }); } });

// saltline: a tide line that crusts foes, plants a Salt Post for its side, rimes and stuns, walls itself, and rings a foe in salt.
defSummon({ id: 'saltline_post', name: 'Salt Post', owner: 'saltline', text: 'While it stands, High Mark gives your side 1.1x attacks. 4 turns.', every: 100,
  sprite: { px: ['...3....', '...33...', '...3....', '..2222..', '..2222..', '..4444..', '..2222..', '.222222.'], c: ['#efefe9', '#d19a21', '#677d94'] },
  act() { /* the standard only stands */ } });
const postUp = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'saltline_post').length > 0;
defMark({ id: 'saltline_ring', name: 'walled in salt', clock: 'own', volatile: true, negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' ? 'Walled in by salt.' : null; } });
defPassive({ id: 'saltline_roll', name: 'Every Roll', owner: 'saltline', text: 'Its first hit on each foe adds 8% of that foe\'s current HP.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || t.k.cadence) return; t.k.cadence = 1; strike(b, f, t, t.hp * 0.08, 'M', 'SALT'); } });
defPassive({ id: 'saltline_mark', name: 'High Mark', owner: 'saltline', text: 'While its Salt Post stands: your side\'s attacks deal 1.1x.',
  outMul(b, f, t, d) { return d.attack && postUp(b, f) ? 1.1 : 1; },
  auraOut(b, f, o, t, d) { return d.attack && postUp(b, f) ? 1.1 : 1; } });
defMove({ id: 'saltline_rime', name: 'Rime Strike', type: 'SALT', owner: 'saltline', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 149% MGK. -4 DEF, up to 16. Salt Post out: Stun 1 once.',
  run(c) { c.hit(c.tgt, { mgk: 1.49 }); if (c.tgt.ko || c.blocked(c.tgt)) return; c.tgt.k.shred = Math.min(16, (c.tgt.k.shred || 0) + 4); if (postUp(c.b, c.u) && !c.u.k.dragonUsed) { c.u.k.dragonUsed = 1; c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'saltline_wall', name: 'Salt Wall', type: 'SALT', owner: 'saltline', reach: 'self', cd: 3, wt: 60, text: 'Shield of 15% of its max HP, 2 turns. Slow 1 on the foe.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.15, 2); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'saltline_wash', name: 'Wash Line', type: 'SALT', owner: 'saltline', reach: 'side', cd: 4, text: 'Summons a Salt Post (10% max HP, 4 turns). Haste 1.',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'saltline_post')) dismiss(c.b, s); summon(c.b, c.u, 'saltline_post', { hp: 0.1, turns: 4 }); c.st(c.u, 'haste', 1); c.u.k.dragonUsed = 0; } });
defMove({ id: 'saltline_spring', name: 'Spring Line', type: 'SALT', owner: 'saltline', reach: 'single', tags: ['dash', 'spell'], cd: 6, nerve: 5, text: 'Hits for 181% MGK. Neither out whorl can switch for 3 turns.',
  run(c) { c.hit(c.tgt, { mgk: 1.81 }); if (!c.tgt.ko) c.mark(c.tgt, 'saltline_ring', 1, 3); c.mark(c.u, 'saltline_ring', 1, 3); } });

// ================================================================ chapter 3: the rolling rooms

// tumbleweed: a tumbleweed that shields itself as it rolls, heals through a quill, bounds in, hitches to a friend, and rounds a foe up.
defMark({ id: 'tumbleweed_quick', name: 'charming', max: 2, clock: 'own', volatile: true, value: 0.1,
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; const mk = f.m.tumbleweed_quick; if (!mk) return; forceAction(b, t, 'skip'); mk.n--; if (mk.n <= 0) unmark(f, 'tumbleweed_quick'); } });
defPassive({ id: 'tumbleweed_never', name: 'Never Roots', owner: 'tumbleweed', text: 'Every 3rd turn: a shield of 8% of its max HP.',
  turnStart(b, f) { f.k.feather = (f.k.feather || 0) + 1; if (f.k.feather % 3 === 0) giveShield(b, f, f, f.maxHp * 0.08, 3); } });
defPassive({ id: 'tumbleweed_burs', name: 'Burs', owner: 'tumbleweed', text: 'Takes 0.85x damage while shielded. Immune to Root.',
  inMul(b, f) { return f.shield > 0 ? 0.85 : 1; },
  statusImmune(f, id) { return id === 'root'; } });
defMove({ id: 'tumbleweed_through', name: 'Roll Through', type: 'ROOT', owner: 'tumbleweed', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 87% MGK. Your lowest-HP whorl heals 6% of its max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.87 }); const a = standing(c.me).sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0]; if (a) c.heal(a, a.maxHp * 0.06); } });
defMove({ id: 'tumbleweed_bound', name: 'Bound In', type: 'ROOT', owner: 'tumbleweed', reach: 'spread', tags: ['dash', 'spell'], cd: 4, text: 'Hits every foe for 61% MGK. Stun 1.',
  run(c) { c.spread({ mgk: 0.61 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'tumbleweed_hitch', name: 'Hitch Ride', type: 'ROOT', owner: 'tumbleweed', reach: 'ally', tags: ['dash'], cd: 3, text: 'Shields an ally 12% max HP, 2 turns. Its next turn comes 30% sooner.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.12, 2); c.hasten(c.u, 30); } });
defMove({ id: 'tumbleweed_round', name: 'Round Up', type: 'ROOT', owner: 'tumbleweed', reach: 'self', cd: 6, nerve: 4, wt: 50, text: 'Haste 3. Its next 2 hits make the foe skip its next turn.',
  run(c) { c.st(c.u, 'haste', 3); c.mark(c.u, 'tumbleweed_quick', 2, 3); } });

// riser: a stair step that practices its tread, sneezes sparks, kicks up, and roars the top flight.
defPassive({ id: 'riser_goesup', name: 'Goes Up', owner: 'riser', text: 'Stair Tread hits add Practice. 5+: it burns. 15+: it KOs foes below 8%.',
  afterDeal(b, f, t, dealt, d) { if (d.move?.id === 'riser_tread' && !d.reserve) f.k.practice = (f.k.practice || 0) + 1; } });
defPassive({ id: 'riser_banister', name: 'Banister', owner: 'riser', text: 'Every 3 Practice: +2% max HP for the battle.',
  afterMove(b, f, m) { if (m.id !== 'riser_tread') return; const want = Math.floor((f.k.practice || 0) / 3); while ((f.k.banister || 0) < want) { f.k.banister = (f.k.banister || 0) + 1; const add = Math.round(f.st.hp * 0.02); f.maxHp += add; heal(b, f, f, add); } } });
defMove({ id: 'riser_tread', name: 'Stair Tread', type: 'GEAR', owner: 'riser', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 82% ATK, +2% per Practice, up to +50%. With 5+ Practice: Burn 2 (20% ATK each turn).',
  run(c) {
    const p = c.u.k.practice || 0;
    c.hit(c.tgt, { atk: 0.82 }, { mult: 1 + 0.02 * Math.min(25, p) });
    if (c.tgt.ko) return;
    if (p >= 5) c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'atk') * 0.2);
    if (p >= 15 && under(c.tgt, 0.08)) { c.msg(`${label(c.b, c.u)} has practiced enough.`); c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); }
  } });
defMove({ id: 'riser_goup', name: 'Go Up', type: 'GEAR', owner: 'riser', reach: 'spread', cd: 3, text: 'Hits every foe for 53% ATK. Slow 2.',
  run(c) { c.spread({ atk: 0.53 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'riser_kick', name: 'Kick Plate', type: 'GEAR', owner: 'riser', reach: 'self', cd: 3, wt: 50, text: 'Haste 2. Fortify 2.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'fortify', 2); } });
defMove({ id: 'riser_flight', name: 'Top Flight', type: 'GEAR', owner: 'riser', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, text: 'Hits every foe for 102% ATK. Burn 2 on every foe (20% ATK each turn). Heals 10% of its max HP.',
  run(c) { c.spread({ atk: 1.02 }); for (const e of standing(c.them)) c.st(e, 'burn', 2, stat(c.b, c.u, 'atk') * 0.2); c.heal(c.u, c.u.maxHp * 0.1); } });

// columella: the Auger's middle post that shields after moves, cuts with a blade that returns, dashes to taunt, takes refuge, and stands under a friend.
defMark({ id: 'columella_blade', name: 'blade out', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'columella_blade'); const t = foe(b, f); if (t) { strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'STONE'); applyStatus(b, f, t, 'slow', 1); } } });
defMark({ id: 'columella_refuge', name: 'in refuge', clock: 'own', volatile: true, value: 0.12,
  beforeTake(b, f, src, amt, d) { return d.attack ? 0 : amt; } });
defPassive({ id: 'columella_center', name: 'Center', owner: 'columella', text: 'After a move, once every 3 turns: a shield of 10% of its max HP.',
  afterMove(b, f) { if ((f.k.kiAt || -9) > b.turnNo - 6) return; f.k.kiAt = b.turnNo; giveShield(b, f, f, f.maxHp * 0.1, 3); } });
defPassive({ id: 'columella_climbed', name: 'Climbed', owner: 'columella', text: 'Takes 0.8x damage while shielded.',
  inMul(b, f) { return f.shield > 0 ? 0.8 : 1; } });
defMove({ id: 'columella_axis', name: 'Axis Cut', type: 'STONE', owner: 'columella', reach: 'single', cd: 1, text: 'Hits for 116% ATK. Next turn its blade returns: 50% ATK, Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.16 }); c.mark(c.u, 'columella_blade', 1, 2); } });
defMove({ id: 'columella_dash', name: 'Post Dash', type: 'STONE', owner: 'columella', reach: 'single', tags: ['dash'], cd: 4, text: 'Hits for 87% ATK. Taunt 1.',
  run(c) { c.hit(c.tgt, { atk: 0.87 }); c.st(c.tgt, 'taunt', 1); } });
defMove({ id: 'columella_middle', name: 'Middle Post', type: 'STONE', owner: 'columella', reach: 'self', cd: 4, wt: 60, text: 'Attacks deal it 0 until its next turn ends.',
  run(c) { c.mark(c.u, 'columella_refuge', 1, 1); } });
defMove({ id: 'columella_under', name: 'Stand Under', type: 'STONE', owner: 'columella', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, text: 'Switches to an ally with a shield of 25% max HP + 20% CHA.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.25 + c.cha(0.2), 3); } });

// ================================================================ chapter 3: the stair

// crimp: a worn handhold that grows MGK from every hit and KO, flicks, drops a loose hold, holds a foe, and goes through the hurt.
defPassive({ id: 'crimp_sixty', name: 'Sixty Years', owner: 'crimp', text: 'When its moves hit: +1.5% MGK for the battle, max 30%. A KO: +6%.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && t.side !== f.side) f.k.evil = Math.min(20, (f.k.evil || 0) + 1); },
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side) f.k.evil = Math.min(20, (f.k.evil || 0) + 4); },
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.st.mgk * 0.015 * (f.k.evil || 0)) : 0; } });
defPassive({ id: 'crimp_smooth', name: 'Worn Smooth', owner: 'crimp', text: 'Every +6% MGK from Sixty Years: +2% max HP.',
  afterMove(b, f) { const want = Math.floor((f.k.evil || 0) / 4); while ((f.k.smooth || 0) < want) { f.k.smooth = (f.k.smooth || 0) + 1; const add = Math.round(f.st.hp * 0.02); f.maxHp += add; heal(b, f, f, add); } } });
defMove({ id: 'crimp_tip', name: 'Fingertip', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 153% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.53 }); } });
defMove({ id: 'crimp_under', name: 'Loose Hold', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['spell'], cd: 3, wu: 80, text: 'Wind-up. Hits for 236% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 2.36 }); } });
defMove({ id: 'crimp_rest', name: 'Rest Hold', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['spell'], cd: 4, text: 'Stun 1. Root 3.',
  run(c) { c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 3); } });
defMove({ id: 'crimp_through', name: 'Go Through', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 166% MGK. +15% per 10% of the foe\'s HP missing, max 2x.',
  run(c) { c.hit(c.tgt, { mgk: 1.66 }, { mult: 1 + Math.min(1, (c.tgt.maxHp - c.tgt.hp) / c.tgt.maxHp * 1.5) }); } });

// chamois: a wall goat that dents with its horns, butts, runs the wall, leaps off, and goes headlong.
defPassive({ id: 'chamois_foot', name: 'Sure Foot', owner: 'chamois', text: 'After a move, once every 3 turns: a shield of 12% of its max HP.',
  afterMove(b, f) { if ((f.k.blastAt || -9) > b.turnNo - 6) return; f.k.blastAt = b.turnNo; giveShield(b, f, f, f.maxHp * 0.12, 3); } });
defPassive({ id: 'chamois_horns', name: 'Horns', owner: 'chamois', text: 'Every 3rd hit on the same foe: +6% of its max HP and -4 DEF.',
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.side === f.side || f.k.denting) return;
    const key = `dent${t.side}${t.idx}`; f.k[key] = (f.k[key] || 0) + 1;
    if (f.k[key] % 3 !== 0) return;
    f.k.denting = 1; strike(b, f, t, t.maxHp * 0.06, 'P', 'BEAST'); f.k.denting = 0;
    t.k.defLoss = Math.min(20, (t.k.defLoss || 0) + 4);
  } });
defMove({ id: 'chamois_butt', name: 'Head Butt', type: 'BEAST', owner: 'chamois', reach: 'single', tags: ['dash'], cd: 1, wu: 30, text: 'Short wind-up. Hits for 112% ATK. Delays the foe\'s next turn by 30%.',
  run(c) { c.hit(c.tgt, { atk: 1.12 }); c.delay(c.tgt, 30); } });
defMove({ id: 'chamois_wallrun', name: 'Wall Run', type: 'BEAST', owner: 'chamois', reach: 'self', cd: 3, wt: 50, text: 'Its next attack deals 1.6x and hits each reserve for 50% ATK.',
  run(c) { c.u.k.nextAtkMul = 1.6; c.mark(c.u, 'chamois_force', 1, 2); } });
defMark({ id: 'chamois_force', name: 'wall running', clock: 'own', volatile: true, value: 0.06,
  afterAttack(b, f) { unmark(f, 'chamois_force'); for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.5, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defMove({ id: 'chamois_leap', name: 'Leap Off', type: 'BEAST', owner: 'chamois', reach: 'single', tags: ['dash'], cd: 3, text: 'Hits for 88% ATK. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 0.88 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'chamois_headlong', name: 'Headlong', type: 'BEAST', owner: 'chamois', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Unstoppable 1. Hits for 126% ATK. Stun 1. Root 2.',
  run(c) { c.st(c.u, 'unstop', 1); c.hit(c.tgt, { atk: 1.26 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 2); } });

// swift: a swift that fires twice after each move, shoots through, screeches a mark, dives past, and never stops.
defPassive({ id: 'swift_double', name: 'Double Back', owner: 'swift', text: 'When it uses a move: its next attack also hits for 50% ATK.',
  afterMove(b, f) { f.k.twin = 1; },
  afterAttack(b, f, t) { if (!f.k.twin || t.ko || t.gone) return; f.k.twin = 0; strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'BEAST'); } });
defPassive({ id: 'swift_aloft', name: 'Aloft', owner: 'swift', text: 'When it comes out: its first turn comes 20% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 20; } });
defMark({ id: 'swift_blaze', name: 'screeched at', clock: 'own', negative: true, volatile: true, value: -0.06,
  inMul(b, f, src, d) { return d.attack ? 1.2 : 1; } });
defMove({ id: 'swift_scythe', name: 'Scythe Shot', type: 'BEAST', owner: 'swift', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 104% ATK. The first reserve takes 40% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 1.04 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { atk: 1.04 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'swift_screech', name: 'Screech', type: 'BEAST', owner: 'swift', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 83% ATK. 2 turns: the foe takes 1.2x from attacks.',
  run(c) { c.hit(c.tgt, { atk: 0.83 }); if (!c.tgt.ko) c.mark(c.tgt, 'swift_blaze', 1, 2); } });
defMove({ id: 'swift_dive', name: 'Dive Past', type: 'BEAST', owner: 'swift', reach: 'self', tags: ['dash'], cd: 2, wt: 40, text: 'Its next turn comes 20% sooner.',
  run(c) { c.hasten(c.u, 20); } });
defMove({ id: 'swift_endless', name: 'Endless', type: 'BEAST', owner: 'swift', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, text: 'Hits 8 times for 23% ATK: 6 on the foe, 2 on reserves.',
  run(c) { const rs = reserves(c.them); for (let i = 0; i < 8; i++) { const t = i % 4 === 3 && rs[(i / 4) | 0] ? rs[(i / 4) | 0] : c.tgt; if (!t.ko) c.hit(t, { atk: 0.23 }, t === c.tgt ? {} : { reserve: true }); } } });

// torr: a push of air that fires fast, blasts in, breathes Pressure into a foe, and blows it out.
defMark({ id: 'torr_charge', name: 'under pressure', max: 4, clock: 'own', negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The pressure in ${label(b, f)} bursts.`); const raw = stat(b, by, 'mgk') * (0.8 + 0.25 * mk.n); strike(b, by, f, raw, 'M', 'GEAR'); if (has(by, 'torr_narrow')) for (const r of reserves(b.s[f.side])) dealDamage(b, by, r, raw * 0.35, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'torr_kept', name: 'Kept Push', owner: 'torr', text: 'Its attacks add 1 to the foe\'s Pressure, max 4. It bursts for 80% MGK +25% each.',
  afterAttack(b, f, t) { const mk = t.m.torr_charge; if (mk && mk.n < 4) mk.n++; } });
defPassive({ id: 'torr_narrow', name: 'Narrow', owner: 'torr', text: 'Pressure also bursts on the foe\'s reserves for 35%.' });
defMove({ id: 'torr_gust', name: 'Gust Fire', type: 'GEAR', owner: 'torr', reach: 'self', cd: 3, wt: 40, text: 'Haste 3.',
  run(c) { c.st(c.u, 'haste', 3); } });
defMove({ id: 'torr_blast', name: 'Blast Jump', type: 'GEAR', owner: 'torr', reach: 'spread', tags: ['dash', 'spell'], cd: 3, text: 'Hits every foe for 69% MGK. Slow 2. If it KOs the foe: its cooldown resets.',
  run(c) { c.spread({ mgk: 0.69 }); c.st(c.tgt, 'slow', 2); if (c.tgt.ko) ready(c.u, 'torr_blast'); } });
defMove({ id: 'torr_breathe', name: 'Breathe In', type: 'GEAR', owner: 'torr', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 37% MGK. Sets Pressure: it bursts after 2 foe turns.',
  run(c) { c.hit(c.tgt, { mgk: 0.37 }); if (!c.tgt.ko) c.mark(c.tgt, 'torr_charge', 1, 2); } });
defMove({ id: 'torr_blowout', name: 'Blowout', type: 'GEAR', owner: 'torr', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, text: 'Hits for 129% MGK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { mgk: 1.29 }); if (!c.tgt.ko) c.forceOut(); } });

// ================================================================ chapter 3: the point

// plummet: a drop that comes up through the floor, opens a hole under a foe, trips, and bottoms out into a falling dark.
const PLUMMET_DARK: SpriteData = { px: ['22222222', '21111112', '21444412', '21433412', '21444412', '21111112', '222.2222', '.222222.'], c: ['#c1b9d1', '#d41f2d', '#2e2a40'] };
defMark({ id: 'plummet_dark', name: 'fallen through', clock: 'own', value: 0.2,
  inMul() { return 0.85; },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'plummet_dark'); clearForm(b, f); } });
defPassive({ id: 'plummet_nofloor', name: 'No Floor', owner: 'plummet', text: 'A foe it drops off the field comes back to 30% MGK.',
  banishEnd(b, f, back) { if (f.ko || back.ko) return; strike(b, f, back, stat(b, f, 'mgk') * 0.3, 'M', 'VOID'); } });
defPassive({ id: 'plummet_kept', name: 'Kept Falling', owner: 'plummet', text: 'After Bottom Out, for 3 turns: takes 0.85x damage, moves deal 1.2x.',
  outMul(b, f, t, d) { return d.move && marked(f, 'plummet_dark') ? 1.2 : 1; } });
defMove({ id: 'plummet_drop', name: 'Drop In', type: 'VOID', owner: 'plummet', reach: 'single', tags: ['dash', 'spell'], cd: 1, text: 'Hits for 88% MGK. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.88 }); c.hasten(c.u, 20); } });
defMove({ id: 'plummet_freefall', name: 'Freefall', type: 'VOID', owner: 'plummet', reach: 'single', tags: ['spell'], cd: 5, text: 'Hits for 26% MGK. The foe falls off the field for 1 turn.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; c.hit(c.tgt, { mgk: 0.26 }); if (!c.tgt.ko) banish(c.b, c.tgt, 1, c.u); } });
defMove({ id: 'plummet_trip', name: 'Trip', type: 'VOID', owner: 'plummet', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 66% MGK. Slow 1.',
  run(c) { c.spread({ mgk: 0.66 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'plummet_bottom', name: 'Bottom Out', type: 'VOID', owner: 'plummet', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, text: 'Hits every foe for 79% MGK. Haste 2. 3 turns: 1.15x MGK and AGI.',
  run(c) { setForm(c.b, c.u, { tag: 'dark', sprite: PLUMMET_DARK, statMul: { mgk: 1.15, agi: 1.15 } }); c.mark(c.u, 'plummet_dark', 1, 3); c.st(c.u, 'haste', 2); c.spread({ mgk: 0.79 }); } });

// zenith: a high point that makes every fifth attack a Long Shot, points at foes, snaps traps, nets, and fires from the highest.
defSummon({ id: 'zenith_trap', name: 'Snap Trap', owner: 'zenith', text: 'Stays until a foe comes out: Root 2, and Huipki\'s next attack is a Long Shot.',
  sprite: { px: ['........', '........', '2......2', '22....22', '.2.33.2.', '44444444', '........', '........'], c: ['#d3c3e3', '#fff2c1', '#54446a'] },
  trap(b, s, who) { const f = ownerOf(b, s); applyStatus(b, f, who, 'root', 2); if (f) f.k.headshot = 1; return true; } });
defPassive({ id: 'zenith_points', name: 'Points', owner: 'zenith', text: 'Every 5th attack is a Long Shot: 1.8x. So is the next after a trap or net.',
  outMul(b, f, t, d) { return d.attack && ((f.k.hs || 0) % 5 === 4 || f.k.headshot) ? (has(f, 'zenith_plumb') && (t.s.root || t.s.slow) ? 2.3 : 1.8) : 1; },
  afterAttack(b, f) { if (f.k.headshot) f.k.headshot = 0; else f.k.hs = (f.k.hs || 0) + 1; } });
defPassive({ id: 'zenith_plumb', name: 'Plumb', owner: 'zenith', text: 'Its Long Shots deal 2.3x on a Rooted or Slowed foe.' });
defMove({ id: 'zenith_pointat', name: 'Point At', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile', 'spell'], cd: 1, wu: 30, text: 'Short wind-up. Hits for 149% MGK. The first reserve takes 40% of it.',
  run(c) { c.hit(c.tgt, { mgk: 1.49 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.49 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'zenith_shot', name: 'Snap Shot', type: 'STAR', owner: 'zenith', reach: 'side', cd: 3, text: 'Root 1. Sets a Snap Trap (6% max HP).',
  run(c) { c.st(c.tgt, 'root', 1); summon(c.b, c.u, 'zenith_trap', { hp: 0.06 }); } });
defMove({ id: 'zenith_bearing', name: 'Net Bearing', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 91% MGK. Slow 2. Its next turn comes 30% sooner, and its next attack is a Long Shot.',
  run(c) { c.hit(c.tgt, { mgk: 0.91 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 30); c.u.k.headshot = 1; } });
defMove({ id: 'zenith_highest', name: 'Highest', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 80, text: 'Long wind-up. Hits for 246% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 2.46 }); } });

// bourdon: a low hum that mends or speeds whoever is out, pulses, shifts its drone, pushes air, and tunes a shield over everyone.
defPassive({ id: 'bourdon_starts', name: 'Starts Low', owner: 'bourdon', text: 'Turns 10% sooner. Turn start: Mend song heals 3% (out ally 2%), Speed song Haste 1.',
  turnEnd(b, f) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); },
  turnStart(b, f) { const amp = f.k.amp && f.k.amp >= b.turnNo ? 2 : 1; if (f.k.song) applyStatus(b, f, f, 'haste', 1); else heal(b, f, f, f.maxHp * 0.03 * amp); },
  reserveTurn(b, f) { const o = outOf(b, f); if (o.ko) return; if (f.k.song) applyStatus(b, f, o, 'haste', 1); else heal(b, f, o, o.maxHp * 0.02); } });
defPassive({ id: 'bourdon_listen', name: 'Amp Up', owner: 'bourdon', text: 'Every 3rd move: its next Mend heal is 2x.',
  afterMove(b, f) { f.k.notes3 = (f.k.notes3 || 0) + 1; if (f.k.notes3 % 3 === 0) f.k.amp = b.turnNo + 2; } });
defMove({ id: 'bourdon_low', name: 'Low Pulse', type: 'STAR', owner: 'bourdon', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits 4 times for 21% MGK.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.21 }); } });
defMove({ id: 'bourdon_drone', name: 'Drone Shift', type: 'STAR', owner: 'bourdon', reach: 'self', cd: 1, wt: 40, text: 'Switches between Mend and Speed songs. Heals itself 4% of max HP.',
  run(c) { c.u.k.song = c.u.k.song ? 0 : 1; c.heal(c.u, c.u.maxHp * 0.04); c.msg(`${label(c.b, c.u)} hums the ${c.u.k.song ? 'speed' : 'mend'} song.`); } });
defMove({ id: 'bourdon_air', name: 'Push Air', type: 'STAR', owner: 'bourdon', reach: 'single', tags: ['spell'], cd: 4, text: 'Hits for 44% MGK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { mgk: 0.44 }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'bourdon_tune', name: 'Tune Up', type: 'STAR', owner: 'bourdon', reach: 'team', cd: 6, nerve: 5, text: 'Your team gets a shield of 20% of max HP for 2 turns.',
  run(c) { for (const a of standing(c.me)) c.shield(a, a.maxHp * 0.2, 2); } });

// ================================================================ rare

// ostium: a burned-through hole that ramps on one foe, burns, opens turrets underneath, steps a friend through, and walls the team.
defSummon({ id: 'ostium_turret', name: 'Hole Turret', owner: 'ostium', text: 'Each turn: zaps the foe for 35% of Reikuchi\'s MGK. Slow 1.', every: 100,
  sprite: { px: ['........', '...33...', '..3443..', '.342243.', '..3443..', '...33...', '........', '........'], c: ['#ffffff', '#87e8fe', '#2957b4'] },
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (!f || f.ko || !t || t.ko) return; strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'VOID'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } });
defSummon({ id: 'ostium_wall', name: 'Hole Wall', owner: 'ostium', sprite: { px: ['........', '33333333', '34422443', '34444443', '34422443', '33333333', '........', '........'], c: ['#f3f9ff', '#81e2f8', '#2451ae'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* the wall only stands */ } });
defPassive({ id: 'ostium_anywhere', name: 'Opens Anywhere', owner: 'ostium', text: 'Moves hitting the same foe in a row: +15% each, up to +45%.',
  outMul(b, f, t, d) { return d.move && f.k.beamOn === t.side * 8 + t.idx + 1 ? 1 + 0.15 * Math.min(3, f.k.beam || 0) : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.move || d.reserve || t.side === f.side) return; const id = t.side * 8 + t.idx + 1; if (f.k.beamOn !== id) { f.k.beamOn = id; f.k.beam = 0; } f.k.beam = (f.k.beam || 0) + 1; } });
defPassive({ id: 'ostium_burn', name: 'Star Burn', owner: 'ostium', text: 'Its moves that hit add Burn 2 (8% MGK each turn).',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.08); } });
defMove({ id: 'ostium_through', name: 'Hole Through', type: 'VOID', owner: 'ostium', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 134% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.34 }); } });
defMove({ id: 'ostium_under', name: 'Open Under', type: 'VOID', owner: 'ostium', reach: 'side', cd: 3, text: 'Summons a Hole Turret (10% max HP, 3 turns), up to 3.',
  run(c) { if (summonsOf(c.b, c.u.side, 'ostium_turret').length >= 3) dismiss(c.b, summonsOf(c.b, c.u.side, 'ostium_turret')[0]); summon(c.b, c.u, 'ostium_turret', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'ostium_step', name: 'Step Through', type: 'VOID', owner: 'ostium', reach: 'reserveAlly', cd: 3, tag: true, text: 'Switches to an ally that acts at once.',
  run(c) { c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 200; } });
defMove({ id: 'ostium_margin', name: 'Margin Hole', type: 'VOID', owner: 'ostium', reach: 'team', cd: 6, nerve: 5, text: 'Summons a Hole Wall (35% max HP, 3 turns). Your team gets Fortify 2.',
  run(c) { summon(c.b, c.u, 'ostium_wall', { hp: 0.35, turns: 3 }); for (const a of standing(c.me)) c.st(a, 'fortify', 2, 0.25); } });

// gimlet: a moon snail that drills holes that add up, splits bolts, rasps twice, lifts the ground, and goes in with a held ray.
defMark({ id: 'gimlet_decon', name: 'drilled', max: 3, clock: 'own', negative: true, volatile: true, value: -0.06 });
defMark({ id: 'gimlet_rift', name: 'rasping', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'gimlet_rift'); const t = foe(b, f); if (t) strike(b, f, t, stat(b, f, 'atk') * 0.6, 'P', 'VOID'); } });
defMark({ id: 'gimlet_ray', name: 'going in', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { unmark(f, 'gimlet_ray'); splash(b, f, stat(b, f, 'atk') * 0.6, 'P', 'VOID'); },
  afterGet(b, f, src, id) { if (id === 'stun' || id === 'silence') unmark(f, 'gimlet_ray'); } });
function decon(b: Battle, f: Fighter, t: Fighter): void {
  if (t.ko || t.gone || t.side === f.side || f.k.deconning) return;
  mark(b, f, t, 'gimlet_decon', 1, 3);
  if (marked(t, 'gimlet_decon') < 3) return;
  unmark(t, 'gimlet_decon');
  f.k.deconning = 1;
  msg(b, `${label(b, t)} comes apart.`);
  dealDamage(b, f, t, t.maxHp * 0.08, dot('T'), null);
  f.k.deconning = 0;
}
defPassive({ id: 'gimlet_drill', name: 'Drill Through', owner: 'gimlet', text: 'Its moves add a Drill Hole, up to 3. At 3: 8% of the foe\'s max HP, true.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) decon(b, f, t); } });
defPassive({ id: 'gimlet_goes', name: 'Goes In', owner: 'gimlet', text: 'Deals 1.15x damage to a foe with a Drill Hole.',
  outMul(b, f, t) { return marked(t, 'gimlet_decon') ? 1.15 : 1; } });
defMove({ id: 'gimlet_drillmove', name: 'Drill', type: 'VOID', owner: 'gimlet', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 77% ATK. Reserves take 40% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 0.77 }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.77 }, { reserve: true, spread: true, mult: 0.4 }); } });
defMove({ id: 'gimlet_radula', name: 'Radula', type: 'VOID', owner: 'gimlet', reach: 'single', cd: 2, text: 'Hits for 49% ATK. At its next turn: 49% ATK again.',
  run(c) { c.hit(c.tgt, { atk: 0.49 }); c.mark(c.u, 'gimlet_rift', 1, 2); } });
defMove({ id: 'gimlet_foot', name: 'Moon Foot', type: 'VOID', owner: 'gimlet', reach: 'spread', cd: 4, wu: 40, text: 'Short wind-up. Hits every foe for 62% ATK. Stun 1.',
  run(c) { c.spread({ atk: 0.62 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'gimlet_goin', name: 'Go In', type: 'VOID', owner: 'gimlet', reach: 'spread', tags: ['channel'], cd: 6, nerve: 5, text: 'Hits every foe for 65% ATK, again next turn. Stun or Silence ends it.',
  run(c) { c.spread({ atk: 0.65 }); c.mark(c.u, 'gimlet_ray', 1, 2); } });

// albatross: an albatross shell that builds force with every hit, shoots, marks a foe overflown, shifts its shadow, and covers the whole beach.
defMark({ id: 'albatross_flux', name: 'overflown', clock: 'own', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'albatross_never', name: 'Never Lands', owner: 'albatross', text: 'When a move hits: +4% damage, up to +20%. Lost when it switches out.',
  afterMove(b, f) { if (f.k.dealt) f.k.force = Math.min(5, (f.k.force || 0) + 1); },
  outMul(b, f) { return 1 + 0.04 * (f.k.force || 0); },
  leave(b, f) { f.k.force = 0; } });
defPassive({ id: 'albatross_shell', name: 'Long Shell', owner: 'albatross', text: 'When it comes out: its first turn comes 15% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 15; } });
defMove({ id: 'albatross_wingspan', name: 'Wingspan', type: 'BEAST', owner: 'albatross', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 136% ATK, 1.6x on an Overflown foe. Other cooldowns drop 1.',
  run(c) {
    const fx = c.marked(c.tgt, 'albatross_flux') > 0;
    c.hit(c.tgt, { atk: 1.36 }, { mult: fx ? 1.6 : 1 });
    if (fx) unmark(c.tgt, 'albatross_flux');
    c.u.moves.forEach((id, i) => { if (id !== 'albatross_wingspan') c.u.cd[i] = Math.max(0, c.u.cd[i] - 1); });
  } });
defMove({ id: 'albatross_soar', name: 'Soar Over', type: 'BEAST', owner: 'albatross', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 59% ATK. The foe is Overflown for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.59 }); if (!c.tgt.ko) c.mark(c.tgt, 'albatross_flux', 1, 3); } });
defMove({ id: 'albatross_shadow', name: 'Shadow Shift', type: 'BEAST', owner: 'albatross', reach: 'single', tags: ['dash', 'projectile'], cd: 3, text: 'Hits for 82% ATK. Its next turn comes 40% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.82 }); c.hasten(c.u, 40); } });
defMove({ id: 'albatross_beach', name: 'Whole Beach', type: 'BEAST', owner: 'albatross', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, wu: 60, text: 'Wind-up. Hits for 147% ATK. Reserves take 70% of it.',
  run(c) { c.hit(c.tgt, { atk: 1.47 }); for (const r of reserves(c.them)) c.hit(r, { atk: 1.47 }, { reserve: true, spread: true, mult: 0.7 }); } });

// protoconch: a pea-sized first room that builds Swell, grows its moves, rains jets, seeks, charges, and coils in.
defMark({ id: 'protoconch_plasma', name: 'swell', max: 5, clock: 'own', negative: true, volatile: true, value: -0.05 });
function plasma(b: Battle, f: Fighter, t: Fighter, n: number): void {
  if (t.ko || t.gone || t.side === f.side || f.k.bursting) return;
  mark(b, f, t, 'protoconch_plasma', n, 3);
  if (marked(t, 'protoconch_plasma') < 5) return;
  unmark(t, 'protoconch_plasma');
  f.k.bursting = 1;
  msg(b, `The swell in ${label(b, t)} bursts.`);
  strike(b, f, t, stat(b, f, 'mgk') * 0.5 + (t.maxHp - t.hp) * 0.12, 'M', 'TIDE');
  f.k.bursting = 0;
}
const evolved = (f: Fighter, id: string) => (f.k['evo_' + id] || 0) >= 3;
defPassive({ id: 'protoconch_first', name: 'First Room', owner: 'protoconch', text: 'Its hits add Swell, up to 5. At 5 it bursts: 50% MGK + 12% missing HP.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) plasma(b, f, t, 1); } });
defPassive({ id: 'protoconch_sealed', name: 'Sealed', owner: 'protoconch', text: 'A move it has used 3 times is Grown.',
  afterMove(b, f, m) { const key = 'evo_' + m.id; if ((f.k[key] || 0) < 3) { f.k[key] = (f.k[key] || 0) + 1; if (f.k[key] === 3) msg(b, `${label(b, f)} grows a new room.`); } } });
defMove({ id: 'protoconch_jet', name: 'Jet Rain', type: 'TIDE', owner: 'protoconch', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits 6 times for 18% MGK, 9 Grown. 1.3x on a foe with no reserves.',
  run(c) { const n = evolved(c.u, 'protoconch_jet') ? 9 : 6; const lone = reserves(c.them).length === 0 ? 1.3 : 1; for (let i = 0; i < n && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.18 }, { mult: lone }); } });
defMove({ id: 'protoconch_room', name: 'Room Seeker', type: 'TIDE', owner: 'protoconch', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 85% MGK. 2 Swell. Grown: Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); if (!c.tgt.ko) { plasma(c.b, c.u, c.tgt, 2); if (evolved(c.u, 'protoconch_room')) c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'protoconch_pea', name: 'Pea Charge', type: 'TIDE', owner: 'protoconch', reach: 'self', cd: 3, wt: 50, text: 'Haste 2. Grown: Untouchable 1.',
  run(c) { c.st(c.u, 'haste', 2); if (evolved(c.u, 'protoconch_pea')) c.st(c.u, 'invuln', 1); } });
defMove({ id: 'protoconch_coil', name: 'Coil In', type: 'TIDE', owner: 'protoconch', reach: 'single', tags: ['dash', 'spell'], cd: 5, nerve: 3, text: 'Shield of 20% max HP. Hits for 110% MGK, 1.25x if Swelled. 2 Swell.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.2, 2); c.hit(c.tgt, { mgk: 1.1 }, { mult: c.marked(c.tgt, 'protoconch_plasma') ? 1.25 : 1 }); if (!c.tgt.ko) plasma(c.b, c.u, c.tgt, 2); } });

// ================================================================ Small Gran

// Her five lines, in order. Only the next one can be said, then she starts again.
const LINES = ['smallgranw_today', 'smallgranw_scratch', 'smallgranw_feel', 'smallgranw_look', 'smallgranw_there'];
function nextLine(f: Fighter): string | null {
  for (let k = 0; k < 5; k++) {
    const id = LINES[((f.k.line || 0) + k) % 5];
    if (f.moves.includes(id)) return id;
  }
  return null;
}
defPassive({ id: 'smallgranw_next', name: 'Next Line', owner: 'smallgranw', text: 'She can say only her next line. After the fifth she starts again.',
  forbid(b, f, what) { return isMove(what) && LINES.includes(what.id) && what.id !== nextLine(f) ? 'Not her line yet.' : null; },
  afterMove(b, f, m) { const i = LINES.indexOf(m.id); if (i >= 0) f.k.line = (i + 1) % 5; } });
defPassive({ id: 'smallgranw_away', name: 'Faces Away', owner: 'smallgranw', text: 'Takes 0.8x damage from attacks. Cannot be Taunted.',
  inMul(b, f, src, d) { return d.attack ? 0.8 : 1; },
  statusImmune(f, id) { return id === 'taunt'; } });
defMove({ id: 'smallgranw_today', name: 'Is It Today', type: 'BEAST', owner: 'smallgranw', reach: 'single', cd: 0, text: 'Hits for 110% ATK. Her next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); c.hasten(c.u, 20); } });
defMove({ id: 'smallgranw_scratch', name: 'Don\'t Scratch', type: 'BEAST', owner: 'smallgranw', reach: 'self', cd: 0, text: 'Removes her bad statuses. Fortify 2. Heals 10% of her max HP.',
  run(c) { c.cleanse(c.u); c.st(c.u, 'fortify', 2); c.heal(c.u, c.u.maxHp * 0.1); } });
defMove({ id: 'smallgranw_feel', name: 'I Can Feel It', type: 'BEAST', owner: 'smallgranw', reach: 'self', cd: 0, text: '1 tide. Empower 2.',
  run(c) { c.nerve(c.me, 1); c.st(c.u, 'empower', 2); } });
defMove({ id: 'smallgranw_look', name: 'Don\'t Look Yet', type: 'BEAST', owner: 'smallgranw', reach: 'single', cd: 0, text: 'Slow 1 on the foe. Ward 1 on herself.',
  run(c) { c.st(c.u, 'ward', 1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'smallgranw_there', name: 'There It Goes', type: 'BEAST', owner: 'smallgranw', reach: 'spread', cd: 5, nerve: 4, text: 'Hits every foe for 150% ATK. Heals 20% of her max HP.',
  run(c) { c.spread({ atk: 1.5 }); c.heal(c.u, c.u.maxHp * 0.2); } });

// ================================================================ notions

defNotion({ id: 'seapebble', name: 'Sea Pebble', price: 500, text: '+3% HP and +3% RES.', pct: { hp: 0.03, res: 0.03 } });
defNotion({ id: 'sieve', name: 'Sieve', price: 600, text: 'The first hit it takes each battle deals 0.8x damage.',
  beforeTake(b, f, src, amt, d) { if (f.k.sieved || d.dot || !src) return amt; f.k.sieved = 1; msg(b, 'The sieve catches some of the hit.'); return amt * 0.8; } });
defNotion({ id: 'glazecoat', name: 'Glaze Coat', price: 600, text: '+4% RES. The first bad status put on it each battle is removed at once.', pct: { res: 0.04 },
  afterGet(b, f, src, id) { if (f.k.glazed || !BADS.includes(id as StatusId)) return; f.k.glazed = 1; delete f.s[id as StatusId]; msg(b, 'It slides off the glaze.'); } });
defNotion({ id: 'saltboots', name: 'Salt Boots', price: 500, text: '+5% DEF. The first crest to hit it each battle deals 0.7x damage.', pct: { def: 0.05 },
  beforeTake(b, f, src, amt, d) { if (f.k.booted || !d.move?.nerve) return amt; f.k.booted = 1; return amt * 0.7; } });
defNotion({ id: 'climbingchalk', name: 'Climbing Chalk', price: 600, text: '+3% ATK. Cannot be forced out or dragged in.', pct: { atk: 0.03 },
  immovable() { return true; } });

/** Notion ids for the lead to add to NOTION_IDS. */
export const NOTIONS5 = ['seapebble', 'sieve', 'glazecoat', 'saltboots', 'climbingchalk'];
