import {
  addNerve, applyStatus, banish, castMove, goUp, knockDown, wedge, setGround, setPrice, tideCost, lockMove, spinSide, boostMove, echoMove, foeActed, setField, typeOn, lastAct, setMantle, moveType, revive, benchable, benchMove, holdTide, shiftCd, setClock, startClock, canSwitch, cleanse, clearForm, dealDamage, delayFighter, disguise, dismiss, emit, foeOf, forceAction, forceOut, giveShield, has, hastenFighter, heal, hitSummon, interrupt, isOut,
  label, mark, marked, markedBy, msg, reflect, reserves, runMove, setForm, setMove, sk, standing, stat, summon, summonsOf, unmark,
} from '../battle/engine';
import type { Battle, Fighter, SpriteData, StatusId, Summon } from '../battle/model';
import { defGround, defMark, defMove, defNotion, defPassive, defSummon, MOVES, type Ctx, type DmgInfo, type MoveDef } from '../battle/registry';
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
  msg(b, 'A star crashes onto the field.');
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
  try { m.run(c2); } catch { c.msg('It escapes.'); }
  c.u.k.moveMul = was;
  if (own >= 0) c.u.cd[own] = Math.max(c.u.cd[own], keep);
}
/** Hits a summon on the foe's side directly, at the summon share of the raw power. */
function hitAllSummons(b: Battle, side: 0 | 1, raw: number): void { for (const s of summonsOf(b, side)) hitSummon(b, s, raw * 0.5); }

// ================================================================ chapter 1: the Outer Whorl

// acorn: a barnacle cemented in place that stops the first shot at it, sweeps its cirri faster the longer it stays, shuts to wait, and lays a bed.
defPassive({ id: 'acorn_cemented', name: 'Cemented', owner: 'acorn', text: 'Cannot be forced out or dragged in. Takes 0.9x damage from attacks.',
  immovable() { return true; },
  inMul(b, f, src, d) { return d.attack ? 0.9 : 1; } });
defPassive({ id: 'acorn_spat', name: 'Spat Spin', owner: 'acorn', text: 'When it comes out: blocks the first projectile move aimed at it.',
  comeOut(b, f) { f.k.spun = 0; },
  intercept(b, f, user, m) { if (!isOut(b, f) || f.k.spun || !m.tags?.includes('projectile')) return null; f.k.spun = 1; return 'block'; } });
defMove({ id: 'acorn_cirri', name: 'Cirri Fire', type: 'STONE', owner: 'acorn', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | spark*3 line fast | burst',
  text: 'Hits 3 times for 39% ATK. +10% per use since it came out, up to +30%.',
  run(c) {
    if (c.u.k.cirriAt !== c.u.outAt) { c.u.k.cirriAt = c.u.outAt; c.u.k.cirri = 0; }
    const m = 1 + 0.1 * Math.min(3, c.u.k.cirri || 0), n = c.u.k.cirriFive ? 5 : 3;
    c.u.k.cirriFive = 0;
    for (let i = 0; i < n && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.39 }, { mult: m });
    c.u.k.cirri = (c.u.k.cirri || 0) + 1;
  } });
defMove({ id: 'acorn_cement', name: 'Cement Spear', type: 'SALT', owner: 'acorn', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | salt line | shatter',
  text: 'Hits for 100% ATK. Stun 1 if the foe can\'t switch, else delays it 30%.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 1.0 }); if (!c.tgt.ko) { if (pinned) c.st(c.tgt, 'stun', 1); else c.delay(c.tgt, 30); } } });
defMove({ id: 'acorn_shut', name: 'Shut Tight', type: 'STONE', owner: 'acorn', reach: 'self', cd: 4, wt: 60, fx: 'sink | shell self',
  text: 'Untouchable 1. Unstoppable 2. Fortify 2. Its next Cirri Fire hits 5 times.',
  run(c) { c.st(c.u, 'invuln', 1); c.st(c.u, 'unstop', 2); c.st(c.u, 'fortify', 2); c.u.k.cirriFive = 1; } });
defMove({ id: 'acorn_bed', name: 'Barnacle Bed', type: 'STONE', owner: 'acorn', reach: 'spread', cd: 6, splash: 0.5, nerve: 5, wu: 70, unstop: true, fx: 'stomp | shell*6 rain | crack quake big jolt',
  text: 'Unstoppable wind-up. Hits for 150% ATK. Splash 50%. Stun 1.',
  run(c) { c.spread({ atk: 1.5 }); c.st(c.tgt, 'stun', 1); } });

// varix: an old lip that the shell grew past, small and quick until every hit it gives or takes makes it angry enough to grow Big.
const VARIX_BIG: SpriteData = { px: ['3......3', '33333333', '32222223', '31133113', '22222222', '222.2222', '33.23.33', '33....33'], c: ['#bc845c', '#ae2f21', '#f2e2ca'] };
const varixBig = (f: Fighter) => f.form?.tag === 'big';
defMark({ id: 'varix_rage', name: 'big', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); f.k.rage = 0; msg(b, `${label(b, f)} retreats.`); },
  leave(b, f) { unmark(f, 'varix_rage'); clearForm(b, f); f.k.rage = 0; } });
function varixAnger(b: Battle, f: Fighter, n: number): void {
  if (varixBig(f) || f.ko) return;
  f.k.rage = Math.min(100, (f.k.rage || 0) + n);
  if (f.k.rage < 100) return;
  setForm(b, f, { tag: 'big', sprite: VARIX_BIG, statMul: { atk: 1.25, def: 1.3, res: 1.3, agi: 0.8 } }, ['varix_boulder', 'varix_wallop', 'varix_crunch']);
  mark(b, f, f, 'varix_rage', 1, 3);
  msg(b, `${label(b, f)} expands massively.`);
}
defPassive({ id: 'varix_growth', name: 'Growth', owner: 'varix', text: 'Hits it deals add 20 Rage, hits it takes add 10. At 100 Rage: Big for 3 turns.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) varixAnger(b, f, 20); },
  afterTake(b, f, src, dealt, d) { if (!d.dot) varixAnger(b, f, 10); } });
defPassive({ id: 'varix_oldlip', name: 'Old Lip', owner: 'varix', text: 'Small: its turns come 10% sooner. Big: 1.25x ATK, 1.3x DEF and RES, 0.8x AGI.',
  turnEnd(b, f) { if (!varixBig(f)) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); } } });
defMove({ id: 'varix_toss', name: 'Lip Toss', type: 'STONE', owner: 'varix', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | pebble arc | burst',
  text: 'Hits for 70% ATK. Slow 1. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.7 }); c.st(c.tgt, 'slow', 1); c.hasten(c.u, 20); } });
defMove({ id: 'varix_hop', name: 'Lip Hop', type: 'BEAST', owner: 'varix', reach: 'single', tags: ['dash'], cd: 3, fx: 'hop | bite',
  text: 'Hits for 65% ATK and adds 40 Rage. Haste 1.',
  run(c) { c.hit(c.tgt, { atk: 0.65 }); varixAnger(c.b, c.u, 40); c.st(c.u, 'haste', 1); } });
defMove({ id: 'varix_grind', name: 'Grind', type: 'STONE', owner: 'varix', reach: 'single', cd: 3, fx: 'shake | pebble*3 converge | crack', text: 'Hits 3 times for 23% ATK. The 3rd adds 6% of the foe\'s max HP.',
  run(c) { c.hit(c.tgt, { atk: 0.23 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.23 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.23, tgtHp: 0.06 }); } });
defMove({ id: 'varix_spring', name: 'Lip Break', type: 'STONE', owner: 'varix', reach: 'single', cd: 6, nerve: 4, fx: 'swell | shell burst | crack big jolt',
  text: 'Becomes Big at once. Hits for 100% ATK, 1.5x if the foe can\'t switch. Stun 1.',
  run(c) { varixAnger(c.b, c.u, 100); const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 1.0 }, { mult: pinned ? 1.5 : 1 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'varix_boulder', name: 'Boulder Lob', type: 'STONE', owner: 'varix', reach: 'spread', tags: ['projectile'], cd: 1, extra: true, fx: 'lift | pebble*3 arc | quake',
  text: 'Hits for 85% ATK. Splash 35%. Slow 1.',
  run(c) { c.spread({ atk: 0.85 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'varix_wallop', name: 'Wallop', type: 'STONE', owner: 'varix', reach: 'spread', cd: 3, extra: true, fx: 'stomp | quake crack big',
  text: 'Hits for 90% ATK. Splash 35%. Forces the foe out.',
  run(c) { c.spread({ atk: 0.9 }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'varix_crunch', name: 'Lip Crush', type: 'STONE', owner: 'varix', reach: 'single', cd: 2, extra: true, fx: 'lunge | bite crack', text: 'Hits for 120% ATK. Heals 30% of the damage.',
  run(c) { const d = c.hit(c.tgt, { atk: 1.2 }); c.heal(c.u, d * 0.3); } });

// mew: a gull that keeps the battle clock and goes up at six, even from the bench, harries the foe, and dives from the air.
const MEW_BIRD: SpriteData = { px: ['........', '........', '4..22..4', '44221244', '444.2444', '...33...', '........', '........'], c: ['#f0f2f4', '#dd9e09', '#717b8a'] };
defMark({ id: 'mew_harried', name: 'harried', clock: 'own', negative: true, value: -0.06 });
defMark({ id: 'mew_aloft', name: 'aloft', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); const t = foe(b, f); if (t) { msg(b, `${label(b, f)} lands heavily on ${label(b, t)}.`); strike(b, f, t, stat(b, f, 'atk') * 0.9, 'P', 'BEAST'); } },
  leave(b, f) { unmark(f, 'mew_aloft'); clearForm(b, f); } });
defPassive({ id: 'mew_draft', name: 'Draft', owner: 'mew', text: 'Every 2nd turn: the foe is Harried. Its next attack on a Harried foe deals 1.5x.',
  turnStart(b, f) { f.k.harry = (f.k.harry || 0) + 1; const t = foe(b, f); if (t && f.k.harry % 2 === 0) mark(b, f, t, 'mew_harried', 1, 2); },
  outMul(b, f, t, d) { return d.attack && marked(t, 'mew_harried') ? 1.5 : 1; },
  afterAttack(b, f, t) { unmark(t, 'mew_harried'); } });
function mewUp(b: Battle, f: Fighter): void {
  if (f.ko || f.gone || marked(f, 'mew_aloft')) return;
  setForm(b, f, { tag: 'bird', sprite: MEW_BIRD, statMul: { atk: 1.2, agi: 1.3 } });
  mark(b, f, f, 'mew_aloft', 1, 3);
  msg(b, `Six o'clock. ${label(b, f)} rises.`);
}
defPassive({ id: 'mew_eye', name: 'Six O\'Clock', owner: 'mew', text: 'Starts the battle clock at 4:00. At 6:00 it goes up for 3 turns, even in reserve.',
  start(b) { startClock(b, 16 * 60); },
  atHour(b, f, h) { if (h === 18) mewUp(b, f); } });
defMove({ id: 'mew_dive', name: 'Gull Dive', type: 'BEAST', owner: 'mew', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | feather line | bite',
  text: 'Hits for 58% ATK, 1.4x while aloft. Weaken 1.',
  run(c) { c.hit(c.tgt, { atk: 0.58 }, { mult: marked(c.u, 'mew_aloft') ? 1.4 : 1 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'mew_wheel', name: 'Wheel', type: 'BEAST', owner: 'mew', reach: 'self', cd: 3, wt: 50, fx: 'spin | feather*3 orbit | sparkle self', text: 'Haste 2. The foe is Harried.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.tgt, 'mew_harried', 1, 2); } });
defMove({ id: 'mew_snatch', name: 'Wave Skim', type: 'TIDE', owner: 'mew', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge | drop sweep | splash',
  text: 'Hits for 28% ATK, 1.5x on a Harried foe. Slow 2. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.28 }, { mult: marked(c.tgt, 'mew_harried') ? 1.5 : 1 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 30); } });
defMove({ id: 'mew_forty', name: 'Forty Years', type: 'BEAST', owner: 'mew', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'lift | feather*4 rise | sparkle big glare',
  text: 'It is six o\'clock now: the clock jumps to 6:00 and it goes up. Haste 2.',
  run(c) {
    if (c.b.clock == null) startClock(c.b, 16 * 60);
    const now = c.b.clock!, day = Math.floor(now / 1440) * 1440;
    setClock(c.b, day + 18 * 60 > now ? day + 18 * 60 : day + 1440 + 18 * 60);
    mewUp(c.b, c.u);
    c.st(c.u, 'haste', 2);
  } });

// halite: dried spray that sets square Grains and throws them, and whatever its salt touches stops going off: its statuses stop counting down.
defMark({ id: 'halite_cured', name: 'cured', text: 'Its statuses and marks stop counting down, except Stun, Sleep, and Stasis.', clock: 'own', negative: true, volatile: true, value: -0.08, preserves: true });
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
defMove({ id: 'halite_grain', name: 'Grain Drop', type: 'SALT', owner: 'halite', reach: 'single', tags: ['spell'], cd: 1, fx: 'swell | salt line | shatter', text: 'Hits for 205% MGK. Sets a Grain (5% max HP).',
  run(c) { c.hit(c.tgt, { mgk: 2.05 }); setGrain(c.b, c.u); } });
defMove({ id: 'halite_dryout', name: 'Dry Out', type: 'SALT', owner: 'halite', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'recoil | salt arc | shatter frost',
  text: 'Throws a Grain: 119% MGK, Slow 2, cures the foe 2 turns. No Grain: 79% MGK, Slow 1.',
  run(c) { const g = grains(c.b, c.u)[0]; if (g) dismiss(c.b, g); c.hit(c.tgt, { mgk: g ? 1.19 : 0.79 }); c.st(c.tgt, 'slow', g ? 2 : 1); if (g && !c.tgt.ko && !c.blocked(c.tgt)) { c.mark(c.tgt, 'halite_cured', 1, 2); c.msg(`${label(c.b, c.tgt)} is preserved in salt.`); } } });
defMove({ id: 'halite_square', name: 'Square Off', type: 'STONE', owner: 'halite', reach: 'spread', tags: ['spell'], cd: 3, fx: 'stomp | salt*4 rise | shatter',
  text: 'Hits for 91% MGK, +10% per Grain. Splash 35%. Stun 1 with 2+ Grains.',
  run(c) { const n = grains(c.b, c.u).length; c.spread({ mgk: 0.91 }, { mult: 1 + 0.1 * n }); if (n >= 2) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'halite_pan', name: 'Salt Pan', type: 'SALT', owner: 'halite', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift | salt*6 converge | shatter flash big tint', text: 'Spends every Grain: hits for 124% MGK + 52% MGK per Grain.',
  run(c) { const gs = grains(c.b, c.u); for (const g of gs) dismiss(c.b, g); c.hit(c.tgt, { mgk: 1.24 + 0.52 * gs.length }); } });

// skitter: a sand hopper that jumps at shadows: it comes out hidden, counts its Hops to a Full Hop, kicks wet sand, and hunts from hiding.
defPassive({ id: 'skitter_shadow', name: 'Shadow Leap', owner: 'skitter', text: 'When it comes out: Hidden 1. Its first attack from hiding deals 1.4x.',
  comeOut(b, f) { applyStatus(b, f, f, 'hidden', 1); },
  outMul(b, f, t, d) { return d.attack && f.s.hidden ? 1.4 : 1; } });
defPassive({ id: 'skitter_hops', name: 'Hop Count', owner: 'skitter', text: 'Each move adds a Hop. At 4 Hops its next move is a Full Hop and spends them.',
  afterMove(b, f) { if (f.k.fierce) { f.k.fierce = 0; f.k.fero = 0; return; } f.k.fero = (f.k.fero || 0) + 1; if (f.k.fero >= 4) { f.k.fierce = 1; msg(b, `${label(b, f)} crouches down low.`); } } });
const fierce = (c: Ctx) => !!c.u.k.fierce;
defMove({ id: 'skitter_pounce', name: 'Pounce', type: 'BEAST', owner: 'skitter', reach: 'single', cd: 1, fx: 'hop | bite', text: 'Hits for 100% ATK. Next attack deals 1.5x. Full Hop: +67% ATK hit.',
  run(c) { c.hit(c.tgt, { atk: 1 }); if (fierce(c) && !c.tgt.ko) c.hit(c.tgt, { atk: 0.67 }); c.u.k.nextAtkMul = 1.5; } });
defMove({ id: 'skitter_kick', name: 'Sand Kick', type: 'TIDE', owner: 'skitter', reach: 'spread', cd: 3, fx: 'hop | sand*3 sweep | splash',
  text: 'Hits for 59% ATK. Splash 35%. Heals 8% max HP, 20% on a Full Hop.',
  run(c) { c.spread({ atk: 0.59 }); c.heal(c.u, c.u.maxHp * (fierce(c) ? 0.2 : 0.08)); } });
defMove({ id: 'skitter_burrow', name: 'Sand Throw', type: 'BEAST', owner: 'skitter', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | sand line | puff daze',
  text: 'Hits for 64% ATK. Slow 2. Full Hop: Root 2, its crest waits 1 more turn.',
  run(c) { c.hit(c.tgt, { atk: 0.64 }); c.st(c.tgt, 'slow', 2); if (fierce(c) && !c.tgt.ko) { c.st(c.tgt, 'root', 2); shiftCd(c.b, c.tgt, 3, 1); } } });
defMove({ id: 'skitter_night', name: 'Night Hunt', type: 'BEAST', owner: 'skitter', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'blink big | smoke ring dark self', text: 'Hidden 2. Haste 2. Its next attack deals 2x damage.',
  run(c) { c.st(c.u, 'hidden', 2); c.st(c.u, 'haste', 2); c.u.k.nextAtkMul = 2; } });

// ================================================================ chapter 1: the Wrack

// fucus: bladder wrack along the tide line whose bladders pop: it lobs one, floats a foe away, and leaves pods where foes will step.
defSummon({ id: 'fucus_mine', name: 'Pop Pod', owner: 'fucus', text: 'Stays until a foe comes out. Hits it for 60% of Rakmata\'s MGK.',
  sprite: { px: ['........', '....3...', '...4....', '..2222..', '.222222.', '.211112.', '..2222..', '........'], c: ['#84743a', '#f3c42f', '#49392f'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} pops a water bladder.`); if (f) { strike(b, f, who, stat(b, f, 'mgk') * 0.6, 'M', 'ROOT'); f.k.popped = 1; } return true; } });
defPassive({ id: 'fucus_bladders', name: 'Bladders', owner: 'fucus', text: 'Every 3rd turn: its next attack adds 60% MGK.',
  turnStart(b, f) { f.k.fuse = (f.k.fuse || 0) + 1; },
  afterAttack(b, f, t) { if ((f.k.fuse || 0) < 3 || t.ko || t.gone) return; f.k.fuse = 0; strike(b, f, t, stat(b, f, 'mgk') * 0.6, 'M', 'ROOT'); } });
defPassive({ id: 'fucus_tideline', name: 'Tideline', owner: 'fucus', text: 'Deals 1.15x to a Slowed or Rooted foe. After a Pop Pod goes off, its next move deals 1.3x.',
  outMul(b, f, t, d) { return (d.move && f.k.popped ? 1.3 : 1) * (t.s.slow || t.s.root ? 1.15 : 1); },
  afterMove(b, f) { f.k.popped = 0; } });
defMove({ id: 'fucus_lash', name: 'Pop Lob', type: 'ROOT', owner: 'fucus', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'lift | bubble arc | splash', text: 'Hits for 125% MGK. The first reserve takes 45% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 1.25 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.25 }, { reserve: true, mult: 0.45 }); } });
defMove({ id: 'fucus_inflate', name: 'Inflate', type: 'TIDE', owner: 'fucus', reach: 'single', tags: ['spell'], cd: 4, fx: 'swell | bubble*3 converge | puff',
  text: 'Hits for 75% MGK. Forces the foe out. Haste 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); if (!c.tgt.ko) c.forceOut(); c.st(c.u, 'haste', 1); } });
defMove({ id: 'fucus_pop', name: 'Pop Field', type: 'ROOT', owner: 'fucus', reach: 'side', cd: 3, fx: 'sink | bubble*2 rise | puff',
  text: 'Slow 1. Sets 2 Pop Pods (5% max HP each) for the next foes to come out.',
  run(c) { c.st(c.tgt, 'slow', 1); summon(c.b, c.u, 'fucus_mine', { hp: 0.05 }); summon(c.b, c.u, 'fucus_mine', { hp: 0.05 }); } });
defMove({ id: 'fucus_wrack', name: 'Wrack Bomb', type: 'ROOT', owner: 'fucus', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 50, fx: 'lift | bubble*5 rain | splash puff big jolt', text: 'Wind-up. Hits for 150% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 1.5 }); } });

// flotsam: a crate that floated in shut and shuts other things in its hold: a foe it drags up, and with its crest the foe's own tide.
defMark({ id: 'flotsam_realm', name: 'in the hold', clock: 'own', negative: true, value: -0.2,
  forbid(b, f, what) { return what === 'switch' ? 'Shut in the hold.' : null; },
  statBonus(f, k) { return k === 'atk' || k === 'mgk' || k === 'def' ? -Math.round(f.st[k] * 0.1) : 0; } });
defPassive({ id: 'flotsam_stayed', name: 'Stayed Shut', owner: 'flotsam', text: 'After 3 moves in a row: for 2 turns the foe loses 4% max HP a turn.',
  afterMove(b, f) { f.k.rise = (f.k.rise || 0) + 1; if (f.k.rise >= 3) { f.k.rise = 0; f.k.seethe = 2; } },
  turnEnd(b, f, action) { if (action !== 'move' && action !== 'windup') f.k.rise = 0; },
  turnStart(b, f) { if (!f.k.seethe) return; f.k.seethe--; const t = foe(b, f); if (t) dealDamage(b, f, t, t.maxHp * 0.04, dot('M'), null); } });
defPassive({ id: 'flotsam_cargo', name: 'Cargo', owner: 'flotsam', text: 'While it holds the foe\'s tide: its moves deal 1.2x.',
  outMul(b, f, t, d) { return d.move && b.s[t.side].hold?.to === f.side ? 1.2 : 1; } });
defMove({ id: 'flotsam_batten', name: 'Batten', type: 'GEAR', owner: 'flotsam', reach: 'single', cd: 1, fx: 'lunge | cog line | crack', text: 'Hits for 168% ATK. 1.3x on a foe with no reserves.',
  run(c) { c.hit(c.tgt, { atk: 1.68 }, { mult: reserves(c.them).length ? 1 : 1.3 }); } });
defMove({ id: 'flotsam_stove', name: 'Stove In', type: 'STONE', owner: 'flotsam', reach: 'single', cd: 3, fx: 'stomp | shatter crack',
  text: 'Hits for 131% ATK. Shield of 50% of the damage + 5% max HP.',
  run(c) { const d = c.hit(c.tgt, { atk: 1.31 }); c.shield(c.u, d * 0.5 + c.u.maxHp * 0.05, 3); } });
defMove({ id: 'flotsam_bob', name: 'Bob Up', type: 'GEAR', owner: 'flotsam', reach: 'dragin', cd: 3, fx: 'recoil | shell return | bite',
  text: 'Drags in a reserve and hits it for 107% ATK. It cannot switch for 2 turns.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 1.07 }); if (!t.ko && !c.blocked(t)) c.mark(t, 'flotsam_realm', 1, 2); } });
defMove({ id: 'flotsam_nailed', name: 'Nailed Shut', type: 'GEAR', owner: 'flotsam', reach: 'single', cd: 6, nerve: 5, fx: 'stomp | cog*3 converge | crack big jolt',
  text: 'Hits for 107% ATK. For 3 rounds, tide the foe\'s side would gain goes to yours.',
  run(c) { c.hit(c.tgt, { atk: 1.07 }); holdTide(c.b, c.tgt.side, c.u.side, 3); } });

// mote: a grain of fallen star warm on one side, whose glints warm the bench, that sets a warm pylon and holds a small sun on a foe to burst.
defSummon({ id: 'mote_pylon', name: 'Warm Pylon', owner: 'mote', text: 'Each turn: heals your out whorl 12% of its max HP.', every: 100,
  sprite: { px: ['........', '..3333..', '.3.33.3.', '..4444..', '...22...', '...22...', '..2222..', '.444444.'], c: ['#efdbbf', '#e9ab20', '#027977'] },
  act(b, s) { const o = b.s[s.side].f[b.s[s.side].out]; const f = ownerOf(b, s); if (o && !o.ko) heal(b, f, o, o.maxHp * (f && has(f, 'mote_grain') ? 0.14 : 0.12)); } });
defMark({ id: 'mote_sun', name: 'held sun', clock: 'own', negative: true, value: -0.35,
  afterTake(b, f, src, dealt, d) {
    if (d.dot || !src || src.side === f.side || f.k.sunBurst) return;
    const mk = unmark(f, 'mote_sun');
    const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    f.k.sunBurst = 1;
    msg(b, `The sun ignites ${label(b, f)}.`);
    strike(b, by, f, stat(b, by, 'mgk') * 1.0, 'M', 'STAR');
    if (has(by, 'mote_grain')) for (const a of standing(b.s[by.side])) heal(b, by, a, a.maxHp * 0.1);
    f.k.sunBurst = 0;
  } });
defPassive({ id: 'mote_side', name: 'Warm Side', owner: 'mote', text: 'In reserve: your out whorl heals 3% of max HP at your turns.',
  reserveTurn(b, f) { const o = outOf(b, f); if (!o.ko) heal(b, f, o, o.maxHp * 0.03); } });
defPassive({ id: 'mote_grain', name: 'Mote Grain', owner: 'mote', text: 'When its held sun bursts on a foe: your team heals 10% of max HP.' });
defMove({ id: 'mote_glint', name: 'Warm Glint', type: 'STAR', owner: 'mote', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | star line | sparkle',
  text: 'Hits for 96% MGK. Each ally in reserve heals 5% of its max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.96 }); for (const a of reserves(c.me)) c.heal(a, a.maxHp * 0.05); } });
defMove({ id: 'mote_turn', name: 'Turn Over', type: 'STAR', owner: 'mote', reach: 'side', cd: 4, fx: 'swell | star rise | sparkle self', text: 'Summons a Warm Pylon (15% max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'mote_pylon', { hp: 0.15, turns: 3 }); } });
defMove({ id: 'mote_hand', name: 'Handful', type: 'STONE', owner: 'mote', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'lunge | sand*3 line fast | burst',
  text: 'Hits for 77% MGK. Delays the foe 20%. Its next turn comes 40% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.77 }); c.delay(c.tgt, 20); c.hasten(c.u, 40); } });
defMove({ id: 'mote_star', name: 'Captive Star', type: 'STAR', owner: 'mote', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, fx: 'lift | star orbit | flash sparkle big glare',
  text: 'Hits for 91% MGK. Slow 2. The next time the foe is hit in 3 turns: 100% MGK more.',
  run(c) { c.hit(c.tgt, { mgk: 0.91 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'mote_sun', 1, 3); } });

// seaglass: a bottle broken on the wrack and rubbed frosty, that walks off sharp end first: its cuts bleed, it rubs deeper, and it finishes.
defMark({ id: 'seaglass_defer', name: 'holding back', clock: 'own', value: 0.08,
  beforeTake(b, f, src, amt, d) { if (d.dot) return amt; f.k.deferred = (f.k.deferred || 0) + amt * 0.5; return amt * 0.5; },
  turnStart(b, f) { const n = Math.round((f.k.deferred || 0) / 2); if (n > 0) { f.k.deferred -= n; dealDamage(b, null, f, n, dot('T'), null); } },
  expire(b, f) { f.k.deferred = 0; } });
defPassive({ id: 'seaglass_note', name: 'Glass Note', owner: 'seaglass', text: 'When it hits: 1 Rage. At 5: Empower 2, spends them.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; f.k.rage5 = (f.k.rage5 || 0) + 1; if (f.k.rage5 >= 5) { f.k.rage5 = 0; applyStatus(b, f, f, 'empower', 2); } } });
defPassive({ id: 'seaglass_frosted', name: 'Frosted', owner: 'seaglass', text: 'Its attacks add Bleed 1 (12% ATK per stack each turn).',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.12); } });
defMove({ id: 'seaglass_shard', name: 'Shard Knives', type: 'SALT', owner: 'seaglass', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | shard*2 line fast | slash drip', text: 'Hits for 130% ATK. Bleed 2 (12% ATK per stack each turn).',
  run(c) { c.hit(c.tgt, { atk: 1.3 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'seaglass_rub', name: 'Rub Through', type: 'STONE', owner: 'seaglass', reach: 'single', tags: ['dash'], cd: 2, fx: 'lunge | sand sweep | slash',
  text: 'Hits for 95% ATK, +15% per Bleed on the foe. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.95 }, { mult: 1 + 0.15 * (c.tgt.s.bleed?.n || 0) }); c.hasten(c.u, 30); } });
defMove({ id: 'seaglass_break', name: 'Break Glass', type: 'SALT', owner: 'seaglass', reach: 'self', cd: 4, wt: 60, fx: 'shake | shard*4 orbit | shatter self', text: '3 turns: takes 0.5x of each hit now and half the rest at each of its turns.',
  run(c) { c.u.k.deferred = c.u.k.deferred || 0; c.mark(c.u, 'seaglass_defer', 1, 3); } });
defMove({ id: 'seaglass_beach', name: 'Beach Glass', type: 'SALT', owner: 'seaglass', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'lunge | shard*3 converge | slash big jolt', text: 'Hits for 135% ATK. A foe left below 30% HP is KO\'d.',
  run(c) { c.hit(c.tgt, { atk: 1.35 }); if (!c.tgt.ko && under(c.tgt, 0.3) && !c.blocked(c.tgt)) { c.msg(`${label(c.b, c.u)} slices through it.`); c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); } } });

// kipper: a fish salted on the wrack line that heals its friends stiff and swallows a foe whole, then spits it out as its side's next whorl.
defMark({ id: 'kipper_stiffened', name: 'stiff', text: 'Its statuses stop counting down, except Stun, Sleep, and Stasis.', clock: 'own', volatile: true, value: 0.05, preserves: true });
defMark({ id: 'kipper_spat', name: 'spat out', text: 'It comes out next.', value: -0.06, calls: true,
  comeOut(b, f) { unmark(f, 'kipper_spat'); } });
defPassive({ id: 'kipper_hung', name: 'Hung Up', owner: 'kipper', text: 'Its heals also remove 1 bad status.',
  afterHeal(b, f, t, amt) { if (amt > 0) cleanse(b, t, 1); } });
defPassive({ id: 'kipper_stiff', name: 'Stiff', owner: 'kipper', text: 'Its heals cure a friend for 1 turn. A foe it swallows comes back out next.',
  afterHeal(b, f, t, amt) { if (amt > 0 && t.side === f.side && !t.ko) mark(b, f, t, 'kipper_stiffened', 1, 1); },
  banishEnd(b, f, back) { if (back.side !== f.side && !back.ko) { mark(b, f, back, 'kipper_spat', 1, -1); msg(b, `${label(b, f)} spits out ${label(b, back)}.`); } } });
defMove({ id: 'kipper_slap', name: 'Kipper Slap', type: 'SALT', owner: 'kipper', reach: 'spread', tags: ['spell'], cd: 1, fx: 'swell | fish sweep | splash', text: 'Hits for 100% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 1 }); } });
defMove({ id: 'kipper_desiccate', name: 'Bubble Up', type: 'SALT', owner: 'kipper', reach: 'ally', cd: 2, fx: 'sway | bubble*3 rise | sparkle ally', text: 'Heals an ally 14% of max HP. Haste 1.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.14); c.st(c.ally!, 'haste', 1); } });
defMove({ id: 'kipper_flip', name: 'Flip Under', type: 'ROOT', owner: 'kipper', reach: 'single', tags: ['spell'], cd: 4, fx: 'spin | kelp line | bite',
  text: 'Hits for 67% MGK, then flips under the wrack: Hidden 1, heals 12% max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.67 }); c.st(c.u, 'hidden', 1); c.heal(c.u, c.u.maxHp * 0.12); } });
defMove({ id: 'kipper_cured', name: 'Cured', type: 'SALT', owner: 'kipper', reach: 'single', tags: ['projectile'], cd: 6, nerve: 5, wt: 70, fx: 'swell | fish converge | bite big dark',
  text: 'Swallows the foe for 2 turns, then spits it out as its side\'s next whorl.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; c.msg(`${label(c.b, c.u)} swallows ${label(c.b, c.tgt)} in one gulp.`); banish(c.b, c.tgt, 2, c.u); } });

// actinia: a tide-pool anemone that hosts a friend from the bench, shuts tight against a blow, and stings soft spots.
defMark({ id: 'actinia_host', name: 'hosted', text: 'Inside the anemone: nothing hits it, it heals, and it comes out next.', value: 0.12, calls: true,
  beforeTake(b, f, src, amt, d) { return d.reserve ? 0 : amt; },
  reserveTurn(b, f) { heal(b, null, f, f.maxHp * 0.05); },
  comeOut(b, f) { unmark(f, 'actinia_host'); } });
defMark({ id: 'actinia_vital', name: 'soft spot', clock: 'own', negative: true, value: -0.06 });
defMark({ id: 'actinia_riposte', name: 'closed up', clock: 'own', volatile: true, value: 0.2,
  intercept(b, f, user, m) { if (!isOut(b, f)) return null; unmark(f, 'actinia_riposte'); msg(b, `${label(b, f)} deflects the attack.`); strike(b, f, user, stat(b, f, 'mgk') * 0.5, 'M', 'BEAST'); if (!user.ko) applyStatus(b, f, user, 'stun', 1); return 'block'; } });

function vitalHit(b: Battle, f: Fighter, t: Fighter): void {
  if (!marked(t, 'actinia_vital') || t.ko) return;
  unmark(t, 'actinia_vital');
  dealDamage(b, f, t, t.maxHp * 0.06, dot('T'), null);
  heal(b, f, f, f.maxHp * 0.04);
}
defPassive({ id: 'actinia_cells', name: 'Stinging Cells', owner: 'actinia', text: 'Every 2nd move: a Soft Spot on the foe. A hit there adds 6% max HP true, and Isoko heals 4%.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side === 1 - f.side && !f.k.vitaling) { f.k.vitaling = 1; vitalHit(b, f, t); f.k.vitaling = 0; } },
  afterMove(b, f) { f.k.cells = (f.k.cells || 0) + 1; const t = foe(b, f); if (t && f.k.cells % 2 === 0) mark(b, f, t, 'actinia_vital', 1, 3); } });
let darting = false;
defPassive({ id: 'actinia_shy', name: 'Shy', owner: 'actinia', text: 'Attackers get Slow 1. A dash hits it: its hosted ally darts out with its first ready move.',
  afterTake(b, f, src, dealt, d) {
    if (d.attack && src && src.side !== f.side && !src.ko) applyStatus(b, f, src, 'slow', 1);
    if (!d.move?.tags?.includes('dash') || !src || src.side === f.side || src.ko) return;
    const h = reserves(b.s[f.side]).find(r => marked(r, 'actinia_host'));
    const i = h ? h.moves.findIndex((_, k) => benchable(b, h, k)) : -1;
    if (!h || i < 0 || darting) return;
    darting = true;
    try { msg(b, `${label(b, h)} darts out from the anemone.`); benchMove(b, h, i, 0.8); } finally { darting = false; }
  } });
defMove({ id: 'actinia_arm', name: 'Arm Lunge', type: 'TIDE', owner: 'actinia', reach: 'single', tags: ['dash', 'spell'], cd: 1, fx: 'lunge | kelp line fast | bite', text: 'Hits for 131% MGK. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 1.31 }); c.hasten(c.u, 15); } });
defMove({ id: 'actinia_close', name: 'Close Up', type: 'BEAST', owner: 'actinia', reach: 'self', cd: 4, wt: 50, fx: 'sink | ring self',
  text: 'Blocks the next foe move at it before its next turn. Its user: 50% MGK, Stun 1.',
  run(c) { c.mark(c.u, 'actinia_riposte', 1, 1); } });
defMove({ id: 'actinia_bloom', name: 'Arms Around', type: 'TIDE', owner: 'actinia', reach: 'reserveAlly', cd: 4, fx: 'swell | kelp*3 return | sparkle ally',
  text: 'Hosts a reserve ally: nothing hits it, it heals 5% a turn, and it comes out next.',
  run(c) { const a = c.ally; if (!a || a === c.u || isOut(c.b, a)) return; for (const x of c.me.f) unmark(x, 'actinia_host'); c.mark(a, 'actinia_host', 1, -1); c.msg(`${label(c.b, a)} takes shelter within ${label(c.b, c.u)}.`); } });
defMove({ id: 'actinia_pool', name: 'Pool Challenge', type: 'TIDE', owner: 'actinia', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'sway | kelp*4 converge | bite big tint', text: 'Hits 4 times for 25% MGK + 7% max HP true. Team heals 10% max HP.',
  run(c) {
    for (let i = 0; i < 4 && !c.tgt.ko; i++) { c.hit(c.tgt, { mgk: 0.25 }); if (!c.tgt.ko && !c.blocked(c.tgt)) c.hit(c.tgt, { tgtHp: 0.07 }, { kind: 'T' }); }
    for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.1);
  } });

// lacuna: the hollow where a taken shell lay, which looks like other shells, leaves hollow copies, and opens at dead low.
defSummon({ id: 'lacuna_clone', name: 'Hollow Copy', owner: 'lacuna', sprite: { px: ['........', '........', '........', '...33...', '..3333..', '.222222.', '21122112', '.244442.'], c: ['#a0d7d0', '#d68aa9', '#ffefd8'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* the copy only stands */ } });
defPassive({ id: 'lacuna_hollow', name: 'Hollow', owner: 'lacuna', text: 'When it comes out: looks like its first reserve until a move hits it.',
  comeOut(b, f) { const a = reserves(b.s[f.side])[0]; if (a) disguise(b, f, a); },
  afterTake(b, f, src, dealt, d) { if (d.move && f.disguise) { disguise(b, f, null); msg(b, `${label(b, f)} reveals itself.`); } },
  leave(b, f) { disguise(b, f, null); } });
defPassive({ id: 'lacuna_round', name: 'Look Round', owner: 'lacuna', text: 'Deals 1.3x damage while disguised.',
  outMul(b, f) { return f.disguise ? 1.3 : 1; } });
defMove({ id: 'lacuna_scoop', name: 'Scoop', type: 'VOID', owner: 'lacuna', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | orb*2 line | burst', text: 'Hits for 80% MGK, then 40% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); if (!c.tgt.ko) c.hit(c.tgt, { mgk: 0.4 }); } });
defMove({ id: 'lacuna_sweep', name: 'Sweep Off', type: 'VOID', owner: 'lacuna', reach: 'side', cd: 4, wt: 50, fx: 'blink | puff self', text: 'Summons a Hollow Copy (10% max HP, 3 turns). Hidden 1.',
  run(c) { summon(c.b, c.u, 'lacuna_clone', { hp: 0.1, turns: 3 }); c.st(c.u, 'hidden', 1); } });
defMove({ id: 'lacuna_sink', name: 'Sink Barbs', type: 'TIDE', owner: 'lacuna', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'recoil | urchin line | bite drip',
  text: 'Hits for 75% MGK. Root 2, or 3 with a Hollow Copy standing.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.tgt, 'root', summonsOf(c.b, c.u.side, 'lacuna_clone').length ? 3 : 2); } });
defMove({ id: 'lacuna_deadlow', name: 'Dead Low', type: 'VOID', owner: 'lacuna', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 50, fx: 'sink slow | orb*5 rise | vortex big dark',
  text: 'Wind-up. Hits for 110% MGK, 1.4x while disguised. Splash 35%. Stun 1.',
  run(c) { const hid = !!c.u.disguise; c.spread({ mgk: 1.1 }, { mult: hid ? 1.4 : 1 }); c.st(c.tgt, 'stun', 1); if (hid) disguise(c.b, c.u, null); } });

// columba: a sand dollar dove that flies only at night and brings things home: friends to the field, and the fallen back to the team.
/** Night on the battle clock: 8:00 in the evening to 5:00 in the morning. */
const night = (b: Battle) => b.clock != null && (b.clock % 1440 >= 20 * 60 || b.clock % 1440 < 5 * 60);
defPassive({ id: 'columba_homing', name: 'Night Flier', owner: 'columba', text: 'Starts the clock at 7:00. At night, 8:00 to 5:00, its heals are 1.5x.',
  start(b) { startClock(b, 19 * 60); },
  healMul(b) { return night(b) ? 1.5 : 1; } });
defPassive({ id: 'columba_doves', name: 'Doves', owner: 'columba', text: 'Turn start: if nothing hit it since its last turn, heals 5% of max HP.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.doveHit = 1; },
  turnStart(b, f) { if (!f.k.doveHit) heal(b, f, f, f.maxHp * 0.05); f.k.doveHit = 0; } });
defMove({ id: 'columba_wing', name: 'Dove Wing', type: 'STAR', owner: 'columba', reach: 'ally', cd: 1, fx: 'swell | feather rise | sparkle ally', text: 'Heals an ally 10% of max HP + 10% CHA.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.1 + c.cha(0.1)); } });
defMove({ id: 'columba_carry', name: 'Dollar Edge', type: 'STONE', owner: 'columba', reach: 'ally', tags: ['spell'], cd: 3, fx: 'spin | shell line | slash foe',
  text: 'Hits the foe for 75% MGK. An ally gets Empower 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.ally!, 'empower', 2); } });
defMove({ id: 'columba_home', name: 'Fly Home', type: 'STAR', owner: 'columba', reach: 'reserveAlly', tags: ['dash'], cd: 4, tag: true, fx: 'lift | feather*3 rise | sparkle ally', text: 'Switches to an ally. It heals 10% of max HP and acts at once.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.1); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 200; } });
defMove({ id: 'columba_ring', name: 'Ring Home', type: 'STAR', owner: 'columba', reach: 'team', cd: 7, nerve: 6, fx: 'lift | feather*5 rise | ring sparkle big glare',
  text: 'Brings back your first KO\'d whorl at 25% HP, 40% at night. None: team heals 15%.',
  run(c) {
    const down = c.me.f.find(f => f.ko && !f.gone);
    if (!down) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.15); return; }
    revive(c.b, down, night(c.b) ? 0.4 : 0.25);
  } });

// lobworm: the coiled cast a lugworm left at low water, which keeps curling and pushes up little curls of its own.
defSummon({ id: 'lobworm_ghoul', name: 'Little Curl', owner: 'lobworm', sprite: { px: ['........', '........', '...22...', '..2332..', '.212212.', '.233332.', '..2222..', '..4..4..'], c: ['#bfa77f', '#a3ebbb', '#806b4f'] }, text: 'Each turn: hits the foe for 20% of Spijire\'s ATK, 30% if it is Collapsed.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'atk') * (marked(t, 'lobworm_mist') ? 0.3 : 0.2), 'P', 'ROOT'); } });
defSummon({ id: 'lobworm_maiden', name: 'Great Curl', owner: 'lobworm', sprite: { px: ['...22...', '..2332..', '..2222..', '...2332.', '..2222..', '.22332..', '.222222.', '43433434'], c: ['#bfa77f', '#a3ebbb', '#806b4f'] }, text: 'Takes single-target hits for your out whorl. Each turn: hits the foe for 50% of Spijire\'s ATK.', every: 100, guard: true,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'ROOT'); } });
defMark({ id: 'lobworm_mist', name: 'collapsed', clock: 'own', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'lobworm_castings', name: 'Castings', owner: 'lobworm', text: 'Every 2nd Curl: a Little Curl rises (8% max HP, 3 turns).' });
defPassive({ id: 'lobworm_lowwater', name: 'Ebb Mud', owner: 'lobworm', text: 'Takes 5% less damage per summon of its own standing.',
  inMul(b, f) { return 1 - 0.05 * summonsOf(b, f.side).filter(s => s.by === f.idx).length; } });
defMove({ id: 'lobworm_curl', name: 'Curl', type: 'ROOT', owner: 'lobworm', reach: 'single', cd: 1, fx: 'spin | kelp line | bite', text: 'Hits for 121% ATK. Heals 6% of max HP, 12% below 50% HP.',
  run(c) {
    c.hit(c.tgt, { atk: 1.21 });
    c.heal(c.u, c.u.maxHp * (under(c.u, 0.5) ? 0.12 : 0.06));
    c.u.k.rites = (c.u.k.rites || 0) + 1;
    if (c.u.k.rites % 2 === 0 && has(c.u, 'lobworm_castings')) summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 });
  } });
defMove({ id: 'lobworm_go', name: 'Go Under', type: 'TIDE', owner: 'lobworm', reach: 'single', cd: 4, fx: 'sink | drop rise | splash',
  text: 'Hits for 75% ATK. Root 2. A Little Curl rises (8% max HP, 3 turns).',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); c.st(c.tgt, 'root', 2); summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 }); } });
defMove({ id: 'lobworm_collapse', name: 'Collapse', type: 'ROOT', owner: 'lobworm', reach: 'single', cd: 3, fx: 'stomp | sand*3 converge | quake',
  text: 'Hits for 96% ATK. Slow 1. 3 turns: Little Curls hit it for 30% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.96 }); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'lobworm_mist', 1, 3); } });
defMove({ id: 'lobworm_coil', name: 'Great Curl', type: 'ROOT', owner: 'lobworm', reach: 'side', cd: 6, nerve: 5, fx: 'sink | kelp*4 rise | bloom slash tint big', text: 'A Great Curl (25%, 4 turns) and 2 Little Curls (8%, 3 turns) rise.',
  run(c) { summon(c.b, c.u, 'lobworm_maiden', { hp: 0.25, turns: 4 }); summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 }); summon(c.b, c.u, 'lobworm_ghoul', { hp: 0.08, turns: 3 }); } });

// razor: a razor clam that digs down whenever a star lands near it and comes back up cutting, whose cuts come in threes.
defMark({ id: 'razor_long', name: 'long blade', clock: 'own', volatile: true, value: 0.15,
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.2) : 0; },
  expire(b, f) { const t = foe(b, f); if (!t) return; msg(b, `${label(b, f)} hurls the blade.`); strike(b, f, t, stat(b, f, 'atk') * 0.8 + (t.maxHp - t.hp) * 0.25, 'P', 'GEAR'); } });
defPassive({ id: 'razor_hinge', name: 'Hinge', owner: 'razor', text: 'When it uses a move: its next attack deals 1.4x.',
  afterMove(b, f) { f.k.hinge = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.hinge ? 1.4 : 1; },
  afterAttack(b, f) { f.k.hinge = 0; } });
defPassive({ id: 'razor_startle', name: 'Star Shy', owner: 'razor', text: 'When anyone uses a STAR move: Untouchable 1, and its next attack deals 1.6x.',
  anyMove(b, f, user, m) {
    if (!m || f.ko || !isOut(b, f) || f.k.dugAt === b.turnNo || moveType(user, m) !== 'STAR') return;
    f.k.dugAt = b.turnNo;
    msg(b, `${label(b, f)} plunges straight down.`);
    applyStatus(b, f, f, 'invuln', 1);
    f.k.nextAtkMul = Math.max(f.k.nextAtkMul || 0, 1.6);
  } });
defMove({ id: 'razor_cut', name: 'Razor Cut', type: 'GEAR', owner: 'razor', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | slash',
  text: 'Hits for 77% ATK. Every 3rd use: 110% ATK, Stun 1, its crest waits 1 turn.',
  run(c) { c.u.k.cuts = ((c.u.k.cuts || 0) % 3) + 1; const third = c.u.k.cuts === 3; c.hit(c.tgt, { atk: third ? 1.1 : 0.77 }); if (third && !c.tgt.ko) { c.st(c.tgt, 'stun', 1); shiftCd(c.b, c.tgt, 3, 1); } } });
defMove({ id: 'razor_upright', name: 'Upright', type: 'STONE', owner: 'razor', reach: 'spread', cd: 4, fx: 'lift | sand*3 rise | slash',
  text: 'Hits for 67% ATK. Splash 35%. Stun 1.',
  run(c) { c.spread({ atk: 0.67 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'razor_dig', name: 'Dig In', type: 'GEAR', owner: 'razor', reach: 'self', cd: 3, wt: 50, fx: 'sink | sand puff self', text: 'Shield of 15% of its max HP, 2 turns. Its next turn comes 20% sooner.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.15, 2); c.hasten(c.u, 20); } });
defMove({ id: 'razor_wind', name: 'Wind Up', type: 'GEAR', owner: 'razor', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'swell | shard*3 orbit | slash big jolt', text: 'Haste 1. For 2 turns: 1.2x ATK. Then: 80% ATK + 25% missing HP.',
  run(c) { c.mark(c.u, 'razor_long', 1, 2); c.st(c.u, 'haste', 1); } });

// annulet: the ring of light a landed star left on wet sand, which lights whatever it touches so its next hit bursts.
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
defMove({ id: 'annulet_draw', name: 'Draw Light', type: 'STONE', owner: 'annulet', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'flare | hoop line | ring',
  text: 'Draws a ring in the sand round the foe: 85% MGK. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'annulet_glow', name: 'Glow', type: 'STAR', owner: 'annulet', reach: 'ally', cd: 3, fx: 'swell | hoop rise | sparkle ally', text: 'Shields an ally 10% of max HP now and again at its next turn.',
  run(c) { const p = has(c.u, 'annulet_ring') ? 0.12 : 0.1; c.shield(c.ally!, c.ally!.maxHp * p, 2); c.mark(c.ally!, 'annulet_barrier', 1, 2); } });
defMove({ id: 'annulet_dither', name: 'Dither', type: 'STAR', owner: 'annulet', reach: 'spread', tags: ['spell'], cd: 3, fx: 'flare | star*4 sweep | sparkle',
  text: 'Hits for 75% MGK. Splash 35%. Slow 2. Lights every foe.',
  run(c) { c.spread({ mgk: 0.75 }); c.st(c.tgt, 'slow', 2); for (const e of standing(c.them)) if (!e.ko && !marked(e, 'annulet_lit')) c.mark(e, 'annulet_lit', 1, 4); } });
defMove({ id: 'annulet_landing', name: 'Long Spark', type: 'STAR', owner: 'annulet', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, fx: 'lift | bolt line | flash big glare',
  text: 'Hits for 160% MGK. Splash 35%. A KO with it makes it ready again.',
  run(c) { c.spread({ mgk: 1.6 }); if (c.tgt.ko) ready(c.u, 'annulet_landing'); } });

// ================================================================ chapter 1 and 2: the Cowrie

// macula: a dark spot on the Cowrie's dome that moves when nobody looks, hits the newly out hardest, and leaves boxes of dark to step in.
defSummon({ id: 'macula_box', name: 'Spot Box', owner: 'macula', text: 'When a foe comes out: it must switch at its next turn. Each turn: 30% MGK to the foe.', every: 100,
  sprite: { px: ['........', '........', '.4444...', '....444.', '.222222.', '.231222.', '.222222.', '........'], c: ['#423850', '#f2eae2', '#b32037'] },
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.3, 'M', 'VOID'); },
  trap(b, s, who) { msg(b, `A box materializes before ${label(b, who)}.`); forceAction(b, who, 'switch', undefined, b.s[s.side].f[s.by]); return false; } });
defSummon({ id: 'macula_copy', name: 'Spot Copy', owner: 'macula', sprite: { px: ['4......4', '44.22.44', '.422224.', '.233332.', '.313313.', '.311113.', '.222222.', '..2..2..'], c: ['#685e76', '#d5cddd', '#b76d7d'] }, text: 'Takes single-target hits meant for Madaku. When it goes: 80% MGK to every foe.', every: 100, guard: true,
  act() { /* the copy only stands */ },
  gone(b, s, f) { if (!f || f.ko) return; msg(b, 'The copy shatters.'); splash(b, f, stat(b, f, 'mgk') * 0.8, 'M', 'VOID'); } });
defPassive({ id: 'macula_first', name: 'First Spot', owner: 'macula', text: 'Deals 1.5x damage to a foe that came out since its last turn.',
  outMul(b, f, t, d) { return !d.reserve && t.outAt > (f.k.prevTurn ?? -1) ? 1.5 : 1; } });
defPassive({ id: 'macula_unwatched', name: 'Unwatched', owner: 'macula', text: 'Its hits from Hidden deal 1.4x.',
  outMul(b, f) { return f.s.hidden ? 1.4 : 1; } });
defMove({ id: 'macula_dark', name: 'Dark Spot', type: 'VOID', owner: 'macula', reach: 'single', tags: ['spell'], cd: 1, fx: 'blink | orb line | daze dark',
  text: 'Hits for 105% MGK. Slow 1. Weaken 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); c.st(c.tgt, 'slow', 1); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'macula_moveoff', name: 'Move Off', type: 'VOID', owner: 'macula', reach: 'side', tags: ['projectile'], cd: 4, fx: 'recoil | card arc | puff dark', text: 'Summons a Spot Box (10% max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'macula_box', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'macula_lookup', name: 'Look Away', type: 'TIDE', owner: 'macula', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | drop line | splash dark',
  text: 'Hits for 75% MGK, then moves while nobody looks: Hidden 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.75 }); c.st(c.u, 'hidden', 1); } });
defMove({ id: 'macula_spots', name: 'Many Spots', type: 'VOID', owner: 'macula', reach: 'side', cd: 6, nerve: 4, fx: 'blink | orb*4 orbit | puff big dark', text: 'Summons a Spot Copy (20% max HP, 3 turns). Hidden 1.',
  run(c) { summon(c.b, c.u, 'macula_copy', { hp: 0.2, turns: 3 }); c.st(c.u, 'hidden', 1); } });

// pallium: a cowrie's soft mantle that slides over its whole team as one shared shield, polishes, and covers everyone in shine.
defMark({ id: 'pallium_slick', name: 'polished', text: 'Its next hit slips off: 0.7x.', clock: 'own', negative: true, volatile: true, value: -0.06,
  outMul(b, f, t, d) { return d.dot ? 1 : 0.7; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot) unmark(f, 'pallium_slick'); } });
defMark({ id: 'pallium_radiance', name: 'shine coming', clock: 'own', volatile: true, value: 0.2,
  turnStart(b, f) { unmark(f, 'pallium_radiance'); msg(b, 'Light swallows them.'); for (const a of standing(b.s[f.side])) { heal(b, f, a, a.maxHp * 0.2); if (isOut(b, a)) applyStatus(b, f, a, 'invuln', 1); } } });
defPassive({ id: 'pallium_polishes', name: 'Polishes', owner: 'pallium', text: 'Its heals are 1.5x on a whorl whose side has a Mantle over it.',
  healMul(b, f, t) { return b.s[t.side].mantle ? 1.5 : 1; } });
defPassive({ id: 'pallium_lieson', name: 'Lies On', owner: 'pallium', text: 'When it uses a move: its next 2 attacks heal your team 7% of max HP.',
  afterMove(b, f) { f.k.brava = 2; },
  afterAttack(b, f) { if (!f.k.brava) return; f.k.brava--; for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.07); } });
defMove({ id: 'pallium_slide', name: 'Slide Over', type: 'TIDE', owner: 'pallium', reach: 'team', cd: 2, fx: 'sway | shell sweep | sparkle ally', text: 'Your out whorl heals 33% of max HP, reserves 18%.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * (isOut(c.b, a) ? 0.33 : 0.18)); } });
defMove({ id: 'pallium_buff', name: 'Mantle Over', type: 'TIDE', owner: 'pallium', reach: 'team', cd: 4, fx: 'swell | shell*3 rise | ring sparkle ally',
  text: 'A Mantle (36% of its max HP) takes your team\'s hits for 3 rounds. Fortify 2.',
  run(c) { setMantle(c.b, c.u.side, c.u.maxHp * 0.36, 3); c.st(c.u, 'fortify', 2); } });
defMove({ id: 'pallium_dazzle', name: 'Lie Over', type: 'BEAST', owner: 'pallium', reach: 'single', tags: ['spell'], cd: 3, wu: 50, fx: 'swell | shell converge | bite big',
  text: 'Wind-up. Hits for 241% MGK. Stun 1. Polishes the foe: its next hit deals 0.7x.',
  run(c) { c.hit(c.tgt, { mgk: 2.41 }); c.st(c.tgt, 'stun', 1); if (!c.tgt.ko) c.mark(c.tgt, 'pallium_slick', 1, 2); } });
defMove({ id: 'pallium_shine', name: 'Shine', type: 'TIDE', owner: 'pallium', reach: 'team', cd: 7, nerve: 5, wt: 60, fx: 'lift | star*5 rain | flash sparkle big glare', text: 'Next turn: your team heals 20%, your out whorl is Untouchable 1.',
  run(c) { c.mark(c.u, 'pallium_radiance', 1, 2); } });

// seiche: a wave that stopped on the sand and stood up gray, holding the water back until it breaks over the whole line.
defSummon({ id: 'seiche_wall', name: 'Still Wall', owner: 'seiche', text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  sprite: { px: ['........', '33333333', '24242424', '22222222', '24242424', '22222222', '44444444', '........'], c: ['#6a8aa7', '#eef6fd', '#30506f'] },
  act() { /* the wall only stands */ } });
defPassive({ id: 'seiche_standing', name: 'Standing Wave', owner: 'seiche', text: 'Cannot be forced out. Takes 0.85x damage while its Still Wall stands.',
  immovable() { return true; },
  inMul(b, f) { return summonsOf(b, f.side, 'seiche_wall').length ? 0.85 : 1; } });
defPassive({ id: 'seiche_gray', name: 'Gray Pin', owner: 'seiche', text: 'Deals 1.2x damage to a foe that can\'t switch.',
  outMul(b, f, t) { return !canSwitch(b, t) ? 1.2 : 1; } });
defMove({ id: 'seiche_slosh', name: 'Slosh', type: 'TIDE', owner: 'seiche', reach: 'spread', tags: ['spell'], cd: 1, fx: 'sway | wave | splash', text: 'Hits for 78% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 0.78 }); } });
defMove({ id: 'seiche_still', name: 'Still', type: 'TIDE', owner: 'seiche', reach: 'side', cd: 4, fx: 'lift | drop*3 rise | ring self', text: 'Summons a Still Wall (25% max HP, 3 turns).',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'seiche_wall')) dismiss(c.b, s); summon(c.b, c.u, 'seiche_wall', { hp: 0.25, turns: 3 }); } });
defMove({ id: 'seiche_hold', name: 'Gray Hold', type: 'VOID', owner: 'seiche', reach: 'single', tags: ['projectile', 'spell'], noGuard: true, cd: 2, fx: 'sink | orb converge | vortex dark',
  text: 'Holds the foe in gray water: 110% MGK through guard.',
  run(c) { c.hit(c.tgt, { mgk: 1.1 }); } });
defMove({ id: 'seiche_break', name: 'Break Over', type: 'TIDE', owner: 'seiche', reach: 'spread', tags: ['spell'], cd: 6, splash: 1, nerve: 5, wu: 70, fx: 'lift | drop*6 sweep | splash big tint jolt',
  text: 'Wind-up. Hits for 120% MGK. Splash 100%. Stun 1. Slow 1 on every foe.',
  run(c) { c.spread({ mgk: 1.2 }); c.st(c.tgt, 'stun', 1); for (const e of standing(c.them)) c.st(e, 'slow', 1); } });

// scud: spray that keeps going after its wave has stopped, leaves a shade of itself, and keeps going even after it falls.
defSummon({ id: 'scud_shade', name: 'Spray Shade', owner: 'scud', text: 'Roibuki\'s moves strike again from it. 3 turns.', every: 100,
  sprite: { px: ['........', '..4444..', '.434434.', '.444444.', '2.4444.2', '..4..4..', '.4....4.', '........'], c: ['#c0ccd8', '#da031e', '#3c3c4a'] },
  act() { /* the shadow only copies */ } });
const shade = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'scud_shade').length > 0;
defMark({ id: 'scud_deathmark', name: 'coming due', clock: 'own', negative: true, value: -0.2,
  afterTake(b, f, src, dealt, d) { const mk = f.m.scud_deathmark; if (mk && src && markedBy(b, mk) === src) f.k.owed = (f.k.owed || 0) + dealt; },
  expire(b, f, mk) { const by = markedBy(b, mk); const owed = f.k.owed || 0; f.k.owed = 0; if (!by) return; msg(b, `${label(b, f)}'s mark reaches its due.`); strike(b, by, f, stat(b, by, 'atk') * 0.5 + owed * 0.35, 'P', 'SALT'); } });
defPassive({ id: 'scud_kept', name: 'Kept Going', owner: 'scud', text: 'When it is knocked out: it uses its first ready move one last time.',
  anyKO(b, f, v) { if (v === f) lastAct(b, f); } });
defPassive({ id: 'scud_ahead', name: 'Ahead', owner: 'scud', text: 'When it comes out: its first turn comes 35% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 35; } });
defMove({ id: 'scud_whip', name: 'Spray Star', type: 'SALT', owner: 'scud', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | salt*2 line fast | shatter', text: 'Hits for 93% ATK. With its Spray Shade out: again for 46% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.93 }); if (shade(c.b, c.u) && !c.tgt.ko) c.hit(c.tgt, { atk: 0.46 }); } });
defMove({ id: 'scud_skip', name: 'Skip Ahead', type: 'SALT', owner: 'scud', reach: 'side', cd: 3, fx: 'blink | salt rise | puff self', text: 'Summons a Spray Shade (15% max HP, 3 turns). Its next turn comes 30% sooner.',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'scud_shade')) dismiss(c.b, s); summon(c.b, c.u, 'scud_shade', { hp: 0.15, turns: 3 }); c.hasten(c.u, 30); } });
defMove({ id: 'scud_run', name: 'Run Through', type: 'STAR', owner: 'scud', reach: 'spread', cd: 3, fx: 'lunge | spark*3 sweep | sparkle',
  text: 'Hits for 66% ATK. Splash 35%. With its Spray Shade out: 1.4x and Slow 2.',
  run(c) { const sh = shade(c.b, c.u); c.spread({ atk: 0.66 }, { mult: sh ? 1.4 : 1 }); if (sh) c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'scud_spume', name: 'Spume Mark', type: 'SALT', owner: 'scud', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'blink | salt line | shatter big dark', text: 'Untouchable 1. Hits for 53% ATK. In 2 foe turns: 50% ATK + 35% of its hits since.',
  run(c) { c.st(c.u, 'invuln', 1); c.hit(c.tgt, { atk: 0.53 }); if (!c.tgt.ko) { c.tgt.k.owed = 0; c.mark(c.tgt, 'scud_deathmark', 1, 2); } } });

// ================================================================ chapter 2: the Polish

// enamel: the Cowrie's top coat that came off in one sheet and catches the light: it leaves the foes it holds Sunlit for the next blow.
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
defMove({ id: 'enamel_slam', name: 'Daybreak', type: 'STONE', owner: 'enamel', reach: 'single', cd: 3, fx: 'flare | beam | flash glare',
  text: 'Hits for 95% ATK. Stun 1. The foe is Sunlit for 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.95 }); c.st(c.tgt, 'stun', 1); if (!c.tgt.ko) c.mark(c.tgt, 'enamel_sun', 1, 2); } });
defMove({ id: 'enamel_bash', name: 'Dim Coat', type: 'STONE', owner: 'enamel', reach: 'self', cd: 3, wt: 60, fx: 'sink | shell self dark', text: 'Fortify 1 (40% less damage). At its next turn: every foe takes 60% MGK.',
  run(c) { c.st(c.u, 'fortify', 1, 0.4); c.mark(c.u, 'enamel_flash', 1, 2); } });
defMark({ id: 'enamel_flash', name: 'dimmed', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'enamel_flash'); splash(b, f, stat(b, f, 'mgk') * 0.6, 'M', 'STONE'); } });
defMove({ id: 'enamel_glaze', name: 'Glaze Blade', type: 'STAR', owner: 'enamel', reach: 'single', tags: ['dash'], cd: 4, fx: 'lunge | shard line fast | slash flash',
  text: 'Hits for 85% ATK. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'enamel_whole', name: 'Whole Dome', type: 'STONE', owner: 'enamel', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 50, fx: 'lift | shell*5 rise | flash big glare',
  text: 'Wind-up. Hits for 100% MGK. Splash 35%. Stun 1. Slow 1 on every foe.',
  run(c) { c.spread({ mgk: 1.0 }); c.st(c.tgt, 'stun', 1); for (const e of standing(c.them)) c.st(e, 'slow', 1); } });

// porcella: a small glazed pig that rolls when the floor tilts and gathers cold as it goes, in wind-ups nothing can stop.
defPassive({ id: 'porcella_tilts', name: 'Tilts', owner: 'porcella', text: 'When it comes out: its first turn comes 30% sooner, its first attack deals 1.2x.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 30; f.k.rollIn = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.rollIn ? 1.2 : 1; },
  afterAttack(b, f) { f.k.rollIn = 0; } });
defPassive({ id: 'porcella_glazed', name: 'Glaze Shell', owner: 'porcella', text: 'Takes 0.8x damage while it has a wind-up coming.',
  inMul(b, f) { return b.pend.some(p => p.kind === 'windup' && p.side === f.side && p.idx === f.idx) ? 0.8 : 1; } });
defMove({ id: 'porcella_snort', name: 'Snort', type: 'BEAST', owner: 'porcella', reach: 'single', cd: 1, fx: 'lunge | puff bite', text: 'Hits for 113% ATK. Heals 15% of it. Foe summons take 40% ATK.',
  run(c) { const d = c.hit(c.tgt, { atk: 1.13 }); c.heal(c.u, d * 0.15); hitAllSummons(c.b, c.them === c.b.s[0] ? 0 : 1, stat(c.b, c.u, 'atk') * 0.4); } });
defMove({ id: 'porcella_start', name: 'Start Rolling', type: 'BEAST', owner: 'porcella', reach: 'single', tags: ['dash'], cd: 4, wu: 80, unstop: true, fx: 'spin | lunge | crack big',
  text: 'Unstoppable wind-up. Hits for 150% ATK. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 1.5 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'porcella_bump', name: 'Bump', type: 'TIDE', owner: 'porcella', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | orb*3 arc | frost',
  text: 'Bumps 3 snowballs into the foe: 37% ATK each. All 3 land: Root 1.',
  run(c) { let n = 0; for (let i = 0; i < 3 && !c.tgt.ko; i++) if (c.hit(c.tgt, { atk: 0.37 }) > 0) n++; if (n === 3) c.st(c.tgt, 'root', 1); } });
defMove({ id: 'porcella_downhill', name: 'Downhill', type: 'BEAST', owner: 'porcella', reach: 'spread', tags: ['channel'], cd: 6, splash: 0.5, nerve: 5, wu: 100, fx: 'spin | frost sweep | crack big jolt',
  text: 'Long wind-up. Hits for 180% ATK. Splash 50%. Slow 2.',
  run(c) { c.spread({ atk: 1.8 }); c.st(c.tgt, 'slow', 2); } });

// specie: a purse of tiny cowries that grew shut, gathers Coins, and spends them to buy a second turn or pay out to its friends.
defMark({ id: 'specie_embrace', name: 'held', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `${label(b, f)} is seized.`); applyStatus(b, by, f, 'root', 2); strike(b, by, f, stat(b, by, 'atk') * 0.59, 'P', 'GEAR'); } });
defPassive({ id: 'specie_clinks', name: 'Clinks', owner: 'specie', text: 'When a foe is KO\'d, and every 3rd attack: a Coin, max 10. +3% ATK per Coin.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.coins = (f.k.coins || 0) + 1; },
  afterAttack(b, f) { f.k.ca = (f.k.ca || 0) + 1; if (f.k.ca % 3 === 0) f.k.coins = (f.k.coins || 0) + 1; },
  statBonus(f, k) { return k === 'atk' ? Math.round(f.st.atk * 0.03 * Math.min(10, f.k.coins || 0)) : 0; } });
defPassive({ id: 'specie_shut', name: 'Shut Purse', owner: 'specie', text: 'Its attacks deal 1.3x. After it attacks: its next turn comes 15% later.',
  outMul(b, f, t, d) { return d.attack ? 1.3 : 1; },
  turnEnd(b, f, action) { if (action === 'attack') b.s[f.side].next += 15; } });
defMove({ id: 'specie_clip', name: 'Clip', type: 'GEAR', owner: 'specie', reach: 'single', tags: ['projectile'], cd: 1, fx: 'recoil | shell line fast | slash',
  text: 'Hits for 111% ATK and clips a Coin off the foe. Your lowest-HP whorl heals 40% of it.',
  run(c) { const d = c.hit(c.tgt, { atk: 1.11 }); const a = standing(c.me).slice().sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0]; if (a && d > 0) c.heal(a, d * 0.4); c.u.k.coins = Math.min(10, (c.u.k.coins || 0) + 1); } });
defMove({ id: 'specie_payout', name: 'Pay Out', type: 'STONE', owner: 'specie', reach: 'single', tags: ['projectile'], cd: 3, fx: 'recoil | shell*3 arc | crack',
  text: 'Hits for 73% ATK. If still out next turn: Root 2, 59% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.73 }); if (!c.tgt.ko) c.mark(c.tgt, 'specie_embrace', 1, 1); } });
defMove({ id: 'specie_buy', name: 'Buy Time', type: 'GEAR', owner: 'specie', reach: 'self', cd: 4, wt: 50, fx: 'swell | shell*2 orbit | sparkle self',
  text: 'Spends 2 Coins to act again at once. Without them: Hidden 1.',
  run(c) { if ((c.u.k.coins || 0) >= 2) { c.u.k.coins -= 2; c.u.k.again = (c.u.k.again || 0) + 1; c.msg(`${label(c.b, c.u)} buys another turn.`); } else c.st(c.u, 'hidden', 1); } });
defMove({ id: 'specie_spend', name: 'Spend It All', type: 'GEAR', owner: 'specie', reach: 'spread', tags: ['projectile'], cd: 6, splash: 0.7, nerve: 5, fx: 'lift | shell*6 rain | crack sparkle big tint',
  text: 'Spends every Coin: hits for 78% ATK +10% per Coin. Splash 70%. Team shield 12%.',
  run(c) { const n = Math.min(10, c.u.k.coins || 0); c.u.k.coins = 0; c.spread({ atk: 0.78 }, { mult: 1 + 0.1 * n }); for (const a of standing(c.me)) c.shield(a, a.maxHp * 0.12, 2); } });

// emery: polishing grit that scours whatever touches it: its hits go straight through shields, and it polishes them off.
defMark({ id: 'emery_caustic', name: 'caustic', clock: 'own', negative: true, value: -0.06,
  anyKO(b, f, v) { if (v !== f) return; const mk = f.m.emery_caustic; const by = mk ? markedBy(b, mk) : null; if (!by || by.ko) return; msg(b, `${label(b, f)} bursts into grit.`); for (const r of reserves(b.s[f.side])) dealDamage(b, by, r, stat(b, by, 'atk') * 0.6, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defMark({ id: 'emery_storm', name: 'in a grit storm', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.25, 'P', 'SALT'); } });
defMark({ id: 'emery_pulse', name: 'scouring', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.5, 'P', 'SALT'); } });
defPassive({ id: 'emery_scours', name: 'Scours', owner: 'emery', text: 'Its hits go straight through shields and mantles to HP.',
  pierces() { return true; } });
defPassive({ id: 'emery_hardgrit', name: 'Hard Grit', owner: 'emery', text: 'Attackers take 15% of their damage back.',
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src !== f && !src.ko) dealDamage(b, f, src, dealt * 0.15, { ...dot('M'), reflect: true } as DmgInfo, null); } });
defMove({ id: 'emery_coarse', name: 'Coarse Sting', type: 'SALT', owner: 'emery', reach: 'single', cd: 1, fx: 'lunge | salt*2 line | shatter',
  text: 'Hits for 100% ATK, 1.3x on a foe with a shield. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }, { mult: c.tgt.shield > 0 || c.them.mantle ? 1.3 : 1 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'emery_rub', name: 'Rub Under', type: 'STONE', owner: 'emery', reach: 'single', tags: ['dash'], cd: 4, fx: 'lunge | sand sweep | slash',
  text: 'Hits for 85% ATK. Stun 1. Expose 1. Caustic 3: if it falls, its reserves take 60% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.85 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'expose', 1); if (!c.tgt.ko) c.mark(c.tgt, 'emery_caustic', 1, 3); } });
defMove({ id: 'emery_abrade', name: 'Abrade', type: 'SALT', owner: 'emery', reach: 'self', cd: 4, wt: 60, fx: 'blink | sand*4 orbit | puff self', text: 'Hidden 2. 2 turns: 25% ATK to every foe each turn.',
  run(c) { c.st(c.u, 'hidden', 2); c.mark(c.u, 'emery_storm', 1, 2); } });
defMove({ id: 'emery_polishoff', name: 'Polish Off', type: 'SALT', owner: 'emery', reach: 'spread', cd: 6, nerve: 5, wu: 50, fx: 'spin | salt*5 sweep | shatter big glare',
  text: 'Wind-up. Strips every foe\'s shield. Hits for 60% ATK, then 50% for 3 turns. Splash 35%.',
  run(c) { for (const e of standing(c.them)) { e.shield = 0; e.shieldTurns = 0; } c.them.mantle = null; c.spread({ atk: 0.6 }); c.mark(c.u, 'emery_pulse', 1, 3); } });

// faience: a glazed flower out of a window box that rings when it is touched and rings true every third move.
defMark({ id: 'faience_drip', name: 'dripped on', clock: 'own', negative: true, volatile: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.faience_drip, by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'mgk') * 0.3, 'M', 'TIDE'); } });
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
defMove({ id: 'faience_clear', name: 'Clear Note', type: 'ROOT', owner: 'faience', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | bell line | ring', text: 'Hits for 90% MGK + 6% of the foe\'s missing HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.9, tgtMiss: 0.06 }); } });
defMove({ id: 'faience_chime', name: 'Chime', type: 'ROOT', owner: 'faience', reach: 'team', cd: 3, fx: 'swell | bell*3 orbit | ring sparkle ally', text: 'Your team: a shield of 10% max HP, 2 turns. Haste 1.',
  run(c) { const p = has(c.u, 'faience_petals') ? 1.2 : 1; for (const a of standing(c.me)) { c.shield(a, a.maxHp * 0.1 * p, 2); c.st(a, 'haste', 1); } } });
defMove({ id: 'faience_box', name: 'Window Box', type: 'TIDE', owner: 'faience', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | drop*3 rain | drip',
  text: 'Hits for 60% MGK, then 30% MGK at its next 2 turns. Slow 2. Root 2 if already Slowed.',
  run(c) { const slowed = !!c.tgt.s.slow; c.hit(c.tgt, { mgk: 0.6 }); c.st(c.tgt, 'slow', 2); if (slowed) c.st(c.tgt, 'root', 2); if (!c.tgt.ko) c.mark(c.tgt, 'faience_drip', 1, 2); } });
defMove({ id: 'faience_peal', name: 'Peal Out', type: 'ROOT', owner: 'faience', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, fx: 'swell | bell*4 sweep | ring flash big glare', text: 'Hits for 110% MGK. Splash 35%. The foe skips its next turn.',
  run(c) { c.spread({ mgk: 1.1 }); if (!c.tgt.ko && !c.blocked(c.tgt)) forceAction(c.b, c.tgt, 'skip'); } });

// ================================================================ chapter 2: the Under-teeth

// denticle: three of the Cowrie's teeth that broke off together and still mesh on anything: they bleed it, drink it, and lock on.
defMark({ id: 'denticle_frenzy', name: 'all teeth', clock: 'own', volatile: true, value: 0.12,
  forbid(b, f, what) { return what === 'attack' || what === 'switch' ? null : 'In a frenzy.'; },
  outMul(b, f, t, d) { return d.attack ? 1.4 : 1; },
  afterAttack(b, f) { hastenFighter(b, f, 25); },
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.2); } });
defPassive({ id: 'denticle_nothing', name: 'Nothing Left', owner: 'denticle', text: 'Its attacks add Bleed 1 (15% ATK per stack each turn).',
  afterAttack(b, f, t) { if (!t.ko && !t.gone) applyStatus(b, f, t, 'bleed', 1, stat(b, f, 'atk') * 0.15); } });
defPassive({ id: 'denticle_still', name: 'Still Meshing', owner: 'denticle', text: 'Its attacks heal 15% of the damage dealt, 30% below 50% HP.',
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * (under(f, 0.5) ? 0.3 : 0.15)); } });
defMove({ id: 'denticle_bite', name: 'Gnash Bite', type: 'BEAST', owner: 'denticle', reach: 'single', cd: 1, fx: 'lunge | fang*3 converge | bite drip', text: 'Hits for 125% ATK. Bleed 2 (12% ATK per stack each turn).',
  run(c) { c.hit(c.tgt, { atk: 1.25 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'denticle_teeth', name: 'All Teeth', type: 'BEAST', owner: 'denticle', reach: 'self', cd: 4, wt: 50, fx: 'swell | fang*3 orbit | bite self', text: '2 turns: it can only Attack or Switch. Attacks: 1.4x, heal 20%, next turn 25% sooner.',
  run(c) { c.mark(c.u, 'denticle_frenzy', 1, 2); } });
defMove({ id: 'denticle_overbite', name: 'Overbite', type: 'TIDE', owner: 'denticle', reach: 'single', tags: ['channel'], cd: 3, fx: 'lunge | bite drip',
  text: 'Hits for 100% ATK and heals 10% max HP. 1.4x and Stun 1 if the foe can\'t switch.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 1.0 }, { mult: pinned ? 1.4 : 1 }); c.heal(c.u, c.u.maxHp * 0.1); if (pinned) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'denticle_lockjaw', name: 'Lockjaw', type: 'BEAST', owner: 'denticle', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'lunge | fang*4 converge | bite big jolt', text: 'Hits for 156% ATK. Root 3. Then All Teeth for 2 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.56 }); c.st(c.tgt, 'root', 3); c.mark(c.u, 'denticle_frenzy', 1, 2); } });

// diastema: the gap between two teeth that wandered off and gets in between whatever it meets, even a foe and its own bench.
defPassive({ id: 'diastema_wandered', name: 'Wandered', owner: 'diastema', text: 'Takes 0.8x magic damage.',
  inMul(b, f, src, d) { return d.kind === 'M' ? 0.8 : 1; } });
defPassive({ id: 'diastema_gap', name: 'Gap', owner: 'diastema', text: 'When a foe uses a move: Get Between\'s cooldown drops 1.',
  anyMove(b, f, user, m) { if (!m || user.side === f.side) return; const i = f.moves.indexOf('diastema_close'); if (i >= 0) f.cd[i] = Math.max(0, f.cd[i] - 1); } });
defMove({ id: 'diastema_null', name: 'Gap Sphere', type: 'VOID', owner: 'diastema', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | orb line fast | vortex', text: 'Hits for 139% MGK. Interrupts.',
  run(c) { c.hit(c.tgt, { mgk: 1.39 }); c.interrupt(c.tgt); } });
defMove({ id: 'diastema_slip', name: 'Slip Blade', type: 'VOID', owner: 'diastema', reach: 'self', cd: 3, wt: 50, fx: 'blink | slash self', text: 'Its next attack adds 113% MGK and gives 1 tide.',
  run(c) { c.mark(c.u, 'diastema_blade', 1, 2); } });
defMark({ id: 'diastema_blade', name: 'blade in the gap', clock: 'own', volatile: true, value: 0.08,
  afterAttack(b, f, t) { unmark(f, 'diastema_blade'); if (!t.ko && !t.gone) strike(b, f, t, stat(b, f, 'mgk') * 1.13, 'M', 'VOID'); addNerve(b, f.side, 1); } });
defMove({ id: 'diastema_close', name: 'Get Between', type: 'TIDE', owner: 'diastema', reach: 'single', tags: ['spell'], cd: 4, fx: 'sink | drop line | vortex',
  text: 'Hits for 130% MGK. Slow 2. Wedges in for 2 rounds: no switching, no help from its bench.',
  run(c) { c.hit(c.tgt, { mgk: 1.3 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko && !c.blocked(c.tgt)) wedge(c.b, c.tgt.side, 2); } });
defMove({ id: 'diastema_wider', name: 'Wider', type: 'VOID', owner: 'diastema', reach: 'single', tags: ['dash', 'spell'], cd: 5, nerve: 3, fx: 'lunge | orb*3 converge | vortex big dark', text: 'Hits for 139% MGK, +40% per use in its last 4 turns, max 3.',
  run(c) {
    const recent = (c.u.k.riftAt || -99) >= c.b.turnNo - 8 ? Math.min(3, c.u.k.rifts || 0) : 0;
    c.hit(c.tgt, { mgk: 1.39 }, { mult: 1 + 0.4 * recent });
    c.u.k.rifts = recent + 1; c.u.k.riftAt = c.b.turnNo;
  } });

// furl: the rolled-in lip of the Cowrie's mouth that changes stance with every move and gains most by leaving each one.
const furlStance = (f: Fighter) => f.k.furlStance || 0;
function setStance(b: Battle, f: Fighter, n: number): void {
  if (furlStance(f) === n) return;
  f.k.furlStance = n;
  if (has(f, 'furl_fast')) { hastenFighter(b, f, 20); heal(b, f, f, f.maxHp * 0.05); }
  if (has(f, 'furl_rolled')) cleanse(b, f, 1);
}
defPassive({ id: 'furl_fast', name: 'Fast Roll', owner: 'furl', text: 'When it changes stance: its next turn comes 20% sooner. Heals 5% of its max HP.',
  outMul(b, f, t, d) { return d.attack && furlStance(f) === 1 ? 1.3 : 1; },
  inMul(b, f) { return furlStance(f) === 2 ? 0.85 : 1; } });
defPassive({ id: 'furl_rolled', name: 'Rolled In', owner: 'furl', text: 'Changing stance removes 1 bad status.' });
defMove({ id: 'furl_lash', name: 'Claw Roll', type: 'ROOT', owner: 'furl', reach: 'single', tags: ['dash'], cd: 1, fx: 'spin | claw drip',
  text: 'Claw stance: attacks deal 1.3x. Hits for 74% ATK. Bleed 2.',
  run(c) { setStance(c.b, c.u, 1); c.hit(c.tgt, { atk: 0.74 }); c.st(c.tgt, 'bleed', 2, stat(c.b, c.u, 'atk') * 0.12); } });
defMove({ id: 'furl_tight', name: 'Roll Tight', type: 'ROOT', owner: 'furl', reach: 'self', cd: 3, wt: 60, fx: 'spin | shell*2 orbit | ring self',
  text: 'Mantle stance: takes 0.85x. Shield 15% max HP. Its next Unroll deals 1.3x.',
  run(c) { setStance(c.b, c.u, 2); c.shield(c.u, c.u.maxHp * 0.15, 2); const i = slotOf(c.u, 'furl_unroll'); if (i >= 0) boostMove(c.b, c.u, i, 1.3, 1); } });
defMove({ id: 'furl_whip', name: 'Whip Out', type: 'TIDE', owner: 'furl', reach: 'single', tags: ['dash'], cd: 4, tag: true, fx: 'lunge fast | drop*2 line | splash',
  text: 'Rush stance. Hits for 58% ATK. Stun 1. Switches out.',
  run(c) { setStance(c.b, c.u, 3); c.hit(c.tgt, { atk: 0.58 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'furl_unroll', name: 'Unroll', type: 'ROOT', owner: 'furl', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, fx: 'swell big | leaf*6 spiral | slash bloom tint all',
  text: 'Storm stance. Hits for 80% MGK. Splash 35%. Its other moves are ready now.',
  run(c) { setStance(c.b, c.u, 4); c.spread({ mgk: 0.8 }); c.u.moves.forEach((id, k) => { if (id !== 'furl_unroll') c.u.cd[k] = 0; }); } });

// ================================================================ chapter 2: the Glaze Halls

// laggard: a reflection three steps behind its owner that waits for the foe to move, leaves Sigils, and does things twice.
defMark({ id: 'laggard_sigil', name: 'sigil', clock: 'own', negative: true, value: -0.08 });
defMark({ id: 'laggard_chain', name: 'lagging', clock: 'own', volatile: true, negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The ripple closes in on ${label(b, f)}.`); applyStatus(b, by, f, 'root', 2); strike(b, by, f, stat(b, by, 'mgk') * 0.5, 'M', 'TIDE'); } });
defMark({ id: 'laggard_twice', name: 'falling behind', clock: 'own', volatile: true, value: 0.2,
  anyMove(b, f, user, m) {
    if (user !== f || !m || m.id === 'laggard_behind' || !replayable(m)) return;
    unmark(f, 'laggard_twice');
    msg(b, `${label(b, f)}'s reflection fades behind them.`);
    echoMove(b, f, m.id, 100, 0.6);
  } });
defSummon({ id: 'laggard_image', name: 'Late Image', owner: 'laggard', sprite: { px: ['........', '3..3....', '33.33...', '4322223.', '4212212.', '4322223.', '..4444..', '.4.44.4.'], c: ['#b2b6cb', '#b28b4b', '#785995'] }, text: 'Takes single-target hits meant for your out whorl. 2 turns.', every: 100, guard: true,
  act() { /* the copy only stands */ } });
function sigilBurst(b: Battle, f: Fighter, t: Fighter): void {
  if (!marked(t, 'laggard_sigil') || t.ko) return;
  unmark(t, 'laggard_sigil');
  msg(b, `The sigil on ${label(b, t)} explodes.`);
  strike(b, f, t, stat(b, f, 'mgk') * 0.6, 'M', 'VOID');
}
defPassive({ id: 'laggard_glass', name: 'Behind Glass', owner: 'laggard', text: 'Once per battle, below 40% HP: Hidden 1 and a Late Image (10% max HP).',
  afterTake(b, f) { if (f.k.glassed || f.hp <= 0 || !under(f, 0.4)) return; f.k.glassed = 1; applyStatus(b, f, f, 'hidden', 1); summon(b, f, 'laggard_image', { hp: 0.1, turns: 2 }); } });
defPassive({ id: 'laggard_late', name: 'Late', owner: 'laggard', text: 'Its moves deal 1.25x damage to a foe that has acted this round.',
  outMul(b, f, t, d) { void t; return d.move && foeActed(b, f) ? 1.25 : 1; } });
defMove({ id: 'laggard_catchup', name: 'Catch Up', type: 'VOID', owner: 'laggard', reach: 'single', tags: ['projectile', 'spell'], cd: 1, late: true, fx: 'sway | orb line | sigil',
  text: 'Late. Hits for 104% MGK. Sigil 3: its next move on the foe adds 60% MGK.',
  run(c) { sigilBurst(c.b, c.u, c.tgt); c.hit(c.tgt, { mgk: 1.04 }); if (!c.tgt.ko) c.mark(c.tgt, 'laggard_sigil', 1, 3); c.u.k.lastLag = 1; } });
defMove({ id: 'laggard_behind', name: 'Fall Behind', type: 'VOID', owner: 'laggard', reach: 'spread', tags: ['spell'], cd: 3, fx: 'blink | orb*3 wave | ring all dark',
  text: 'Hits for 64% MGK. Splash 35%. Its next move hits again 1 turn later at 0.6x.',
  run(c) { sigilBurst(c.b, c.u, c.tgt); c.spread({ mgk: 0.64 }); c.mark(c.u, 'laggard_twice', 1, 2); } });
defMove({ id: 'laggard_lag', name: 'Late Ripple', type: 'TIDE', owner: 'laggard', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'sway | drop*3 wave | splash',
  text: 'Hits for 70% MGK. If still out next turn: 50% MGK, Root 2.',
  run(c) { sigilBurst(c.b, c.u, c.tgt); c.hit(c.tgt, { mgk: 0.7 }); if (!c.tgt.ko) c.mark(c.tgt, 'laggard_chain', 1, 1); c.u.k.lastLag = 3; } });
defMove({ id: 'laggard_mirror', name: 'Mirror Back', type: 'VOID', owner: 'laggard', reach: 'single', tags: ['spell'], cd: 5, nerve: 4, fx: 'flare | orb*2 return | sigil big dark', text: 'Uses its last move again at 1.2x power.',
  run(c) {
    const id = ['', 'laggard_catchup', 'laggard_behind', 'laggard_lag'][c.u.k.lastLag || 1];
    const m = MOVES[id];
    if (!m) return;
    c.msg(`${label(c.b, c.u)} performs ${m.name} once more.`);
    borrow(c, m, 1.2);
  } });

// tain: the silver off the back of a mirror that shows nothing on its own, turns the type chart over, and trades wounds.
const TAIN_DEMON: SpriteData = { px: ['44....44', '.4.22.4.', '.322223.', '32422423', '32222223', '.333333.', '3.34.3.3', '.334433.'], c: ['#3e3650', '#7c6cc8', '#c4b4e8'] };
defSummon({ id: 'tain_image', name: 'Silver Image', owner: 'tain', sprite: { px: ['........', '..3..3..', '..3223..', '.324423.', '.344443.', '.324423.', '..3333..', '.33..33.'], c: ['#d4d8e4', '#5a83cd', '#6a5e80'] }, text: 'Takes single-target hits meant for your out whorl. When a hit breaks it, the rest goes through. Each turn: 25% MGK to the foe.', every: 100, guard: true, spill: true,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.25, 'M', 'VOID'); } });
defMark({ id: 'tain_demon', name: 'tarnished', clock: 'own', value: 0.2,
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.4, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'tain_demon'); clearForm(b, f); } });
defPassive({ id: 'tain_silver', name: 'Silver Back', owner: 'tain', text: 'When it comes out: summons a Silver Image (10% of its max HP, 3 turns).',
  comeOut(b, f) { summon(b, f, 'tain_image', { hp: 0.1, turns: 3 }); } });
defPassive({ id: 'tain_nothing', name: 'Bare Glass', owner: 'tain', text: 'Once per battle, when a strong hit lands on it: Silver Glass for 2 rounds.',
  afterTake(b, f, src, dealt, d) {
    if (f.k.bared || f.hp <= 0 || !enemy(f, src) || !d.move || d.dot || b.field?.id === 'mirror') return;
    if (typeOn(b, f, moveType(src, d.move)) <= 1.01) return;
    f.k.bared = 1;
    msg(b, `The glass flips behind ${label(b, f)}.`);
    setField(b, 'mirror', 2, f);
  } });
defMove({ id: 'tain_backing', name: 'Backing', type: 'VOID', owner: 'tain', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | orb return | flash',
  text: 'Hits for 50% of the foe\'s higher of ATK or MGK. Slow 1.',
  run(c) { if (c.blocked(c.tgt)) return; const p = Math.max(stat(c.b, c.tgt, 'atk'), stat(c.b, c.tgt, 'mgk')); c.hit(c.tgt, { flat: p * 0.5 }, { kind: 'M' }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'tain_blank', name: 'Silvering', type: 'STAR', owner: 'tain', reach: 'single', tags: ['spell'], cd: 4, fx: 'flare | star*3 ray | sparkle glare',
  text: 'Hits for 55% MGK. Silver Glass for 3 rounds.',
  run(c) { c.hit(c.tgt, { mgk: 0.55 }); setField(c.b, 'mirror', 3, c.u); } });
defMove({ id: 'tain_tarnish', name: 'Tarnish', type: 'VOID', owner: 'tain', reach: 'self', tags: ['spell'], cd: 5, wt: 60, fx: 'swell | smoke self dark', text: 'Tarnished 3 turns: 1.25x MGK, 1.1x AGI, attacks hit reserves 40% MGK.',
  run(c) { setForm(c.b, c.u, { tag: 'demon', sprite: TAIN_DEMON, statMul: { mgk: 1.25, agi: 1.1 } }); c.mark(c.u, 'tain_demon', 1, 3); } });
defMove({ id: 'tain_empty', name: 'Empty Swap', type: 'VOID', owner: 'tain', reach: 'single', cd: 6, nerve: 4, fx: 'swell | orb*2 orbit | vortex smoke dark big', text: 'Swaps HP shares with the foe. Its own share stays 25% or more.',
  run(c) {
    if (c.blocked(c.tgt) || c.tgt.s.unstop) return;
    const mine = c.u.hp / c.u.maxHp, theirs = c.tgt.hp / c.tgt.maxHp;
    c.u.hp = Math.max(1, Math.round(c.u.maxHp * Math.max(0.25, theirs)));
    c.tgt.hp = Math.max(1, Math.round(c.tgt.maxHp * mine));
    emit(c.b, { e: 'heal', side: c.u.side, idx: c.u.idx, amt: 0 });
    c.msg(`${label(c.b, c.u)} and ${label(c.b, c.tgt)} trade wounds.`);
  } });

// luster: the shine off the Cowrie's dome at full dark that puts foes to sleep and shines on sleepers without waking them.
defMark({ id: 'luster_drowsy', name: 'drowsy', clock: 'own', negative: true, value: -0.15,
  expire(b, f, mk) { applyStatus(b, markedBy(b, mk), f, 'sleep', 2); } });
defPassive({ id: 'luster_went', name: 'Went Off', owner: 'luster', text: 'When it uses a move: its next attack adds 50% MGK.',
  afterMove(b, f) { f.k.sparkle = 1; },
  afterAttack(b, f, t) { if (!f.k.sparkle || t.ko || t.gone) return; f.k.sparkle = 0; strike(b, f, t, stat(b, f, 'mgk') * 0.5, 'M', 'STAR'); } });
defPassive({ id: 'luster_dark', name: 'Full Dark', owner: 'luster', text: 'Deals 1.5x damage to a sleeping foe, and its hits do not wake it.',
  outMul(b, f, t) { return t.s.sleep ? 1.5 : 1; },
  lulls() { return true; } });
defMove({ id: 'luster_shine', name: 'Dome Shine', type: 'STAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | star line | sparkle', text: 'Hits for 206% MGK. 1.3x on a foe that was already out at its last turn.',
  run(c) { const long = c.tgt.outAt < (c.u.k.prevTurn ?? 0); c.hit(c.tgt, { mgk: 2.06 }, { mult: long ? 1.3 : 1 }); } });
defMove({ id: 'luster_drowse', name: 'Drowse', type: 'STAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 4, fx: 'sway | moon arc | daze', text: 'Hits for 80% MGK. After its next turn: Sleep 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); if (!c.tgt.ko) c.mark(c.tgt, 'luster_drowsy', 1, 1); } });
defMove({ id: 'luster_long', name: 'Lamp Out', type: 'GEAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 3, late: true, fx: 'blink | spark*3 line | flash dark',
  text: 'Late. Hits for 105% MGK. Locks the foe\'s last move for 2 turns. Haste 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); const i = (c.tgt.k.lastMove || 0) - 1; if (i >= 0 && !c.tgt.ko) lockMove(c.b, c.tgt, i, 2); c.st(c.u, 'haste', 1); } });
defMove({ id: 'luster_glare', name: 'Glare Off', type: 'STAR', owner: 'luster', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, fx: 'swell | beam ray | flash big glare',
  text: 'Hits for 227% MGK. A sleeping foe sleeps 1 more turn.',
  run(c) { c.hit(c.tgt, { mgk: 2.27 }); const z = c.tgt.s.sleep; if (z && !c.tgt.ko) z.n++; } });

// ================================================================ chapter 3: the Auger's dune

// gyre: a wind that kept the shape of the Auger and spins the foe's whole side round, catching each foe in its Flux.
defMark({ id: 'gyre_flux', name: 'fluxed', clock: 'own', negative: true, value: -0.06 });
defPassive({ id: 'gyre_shape', name: 'Shape Held', owner: 'gyre', text: 'When a foe comes out: it is Fluxed for 3 turns. +2% MGK for each tide your side holds.',
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.st.mgk * 0.02 * (f.k.tideSeen || 0)) : 0; },
  turnStart(b, f) { f.k.tideSeen = b.s[f.side].nerve; },
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f) && !who.ko) mark(b, f, who, 'gyre_flux', 1, 3); } });
defPassive({ id: 'gyre_inner', name: 'Inner Round', owner: 'gyre', text: 'Its other moves reset the cooldown of Round.',
  afterMove(b, f, m) { if (m.id !== 'gyre_round') ready(f, 'gyre_round'); } });
defMove({ id: 'gyre_round', name: 'Round', type: 'TIDE', owner: 'gyre', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'spin | orb*3 spiral | splash', text: 'Hits for 99% MGK. Each Fluxed reserve takes 60% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.99 }); for (const r of reserves(c.them)) if (marked(r, 'gyre_flux')) c.hit(r, { mgk: 0.99 }, { reserve: true, mult: 0.6 }); } });
defMove({ id: 'gyre_whirlin', name: 'Whirl In', type: 'TIDE', owner: 'gyre', reach: 'single', tags: ['spell'], cd: 4, fx: 'spin | orb*4 orbit | vortex',
  text: 'Hits for 57% MGK. Spins the foe\'s side for its next 2 turns.',
  run(c) { c.hit(c.tgt, { mgk: 0.57 }); if (!c.blocked(c.tgt)) spinSide(c.b, c.tgt.side, 2); } });
defMove({ id: 'gyre_gather', name: 'Dust Devil', type: 'STONE', owner: 'gyre', reach: 'spread', tags: ['projectile', 'spell'], cd: 2, fx: 'spin | sand*5 spiral | puff all',
  text: 'Hits for 57% MGK. Splash 35%. Every foe is Fluxed for 3 turns.',
  run(c) { c.spread({ mgk: 0.57 }); for (const e of standing(c.them)) c.mark(e, 'gyre_flux', 1, 3); } });
defMove({ id: 'gyre_auger', name: 'Auger Warp', type: 'TIDE', owner: 'gyre', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, fx: 'spin big | orb*3 spiral | ring fizz tint fast ally', text: 'Switches to an ally that acts at once. Both get Empower 2.',
  run(c) { c.st(c.u, 'empower', 2); c.st(c.ally!, 'empower', 2); c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 200; } });

// lichen: lichen off the Auger's outside that creeps its Poison round the foe's bench and feeds on every foe it poisons.
defPassive({ id: 'lichen_dryside', name: 'Dry Side', owner: 'lichen', text: 'When its move hits a Poisoned foe: Poison 1 on each of the foe\'s reserves.',
  afterDeal(b, f, t, dealt, d) {
    if (!d.move || d.reserve || d.dot || !t.s.poison || f.k.crept === b.turnNo) return;
    f.k.crept = b.turnNo;
    for (const r of reserves(b.s[t.side])) applyStatus(b, f, r, 'poison', 1);
  },
  anyMove(b, f, user, m) { if (m && user.side !== f.side) user.k.usedMoveAt = b.turnNo; } });
defPassive({ id: 'lichen_growth', name: 'Slow Growth', owner: 'lichen', text: 'Heals 15% of the damage it deals to Poisoned foes.',
  afterDeal(b, f, t, dealt, d) { if (!d.reserve && t.s.poison) heal(b, f, f, dealt * 0.15); } });
defMove({ id: 'lichen_encrust', name: 'Encrust', type: 'ROOT', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | leaf*3 arc | drip', text: 'Hits for 135% MGK. Poison 3.',
  run(c) { c.hit(c.tgt, { mgk: 1.35 }); c.st(c.tgt, 'poison', 3); } });
defMove({ id: 'lichen_feed', name: 'Lichen Feed', type: 'ROOT', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 4, fx: 'sway | kelp*4 rise | drip all',
  text: 'Every foe: Poison 1. Root 2. Slow 1. Heals 6% max HP per Poisoned foe.',
  run(c) { for (const e of standing(c.them)) c.st(e, 'poison', 1); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 1); const n = standing(c.them).filter(e => e.s.poison).length; if (n) c.heal(c.u, c.u.maxHp * 0.06 * n); } });
defMove({ id: 'lichen_cling', name: 'Cling Fang', type: 'STONE', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 2, fx: 'lunge | fang*2 converge | bite', text: 'Hits for 166% MGK. Ready again on a Poisoned foe, but not twice in a row.',
  run(c) { c.hit(c.tgt, { mgk: 1.66 }); if (c.tgt.s.poison && !c.u.k.fangAgain) { c.u.k.fangAgain = 1; ready(c.u, 'lichen_cling'); } else c.u.k.fangAgain = 0; } });
defMove({ id: 'lichen_crust', name: 'Stone Crust', type: 'ROOT', owner: 'lichen', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'stomp | pebble*4 converge | crack bloom jolt big',
  text: 'Hits for 164% MGK. Stun 1 if the foe used a move at its last turn, else Slow 2.',
  run(c) { const facing = (c.tgt.k.usedMoveAt ?? -9) >= c.b.turnNo - 2; c.hit(c.tgt, { mgk: 1.64 }); if (facing) c.st(c.tgt, 'stun', 1); else c.st(c.tgt, 'slow', 2); } });

// groundswell: the swell that lifted the Auger and set it down, which lifts the price of a foe's crest and lifts shields off.
/** True when t's side cannot pay for t's crest now. */
const cantPay = (b: Battle, t: Fighter) => { const m = MOVES[t.moves[3]]; return !!m?.nerve && b.rules.nerve && b.s[t.side].nerve < tideCost(b, t, m); };
defSummon({ id: 'groundswell_cove', name: 'Water Dome', owner: 'groundswell', sprite: { px: ['........', '..2332..', '.222222.', '22422222', '24442242', '22422222', '44444444', '........'], c: ['#a5dce4', '#effbfb', '#26526f'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* the cove only stands */ } });
defPassive({ id: 'groundswell_full', name: 'Full Swell', owner: 'groundswell', text: 'When it comes out: a shield of 8% of its max HP, 3 turns.',
  comeOut(b, f) { giveShield(b, f, f, f.maxHp * 0.08, 3); } });
defPassive({ id: 'groundswell_setdown', name: 'Settle Down', owner: 'groundswell', text: 'Deals 1.25x damage to a foe that can\'t pay for its crest.',
  outMul(b, f, t) { return cantPay(b, t) ? 1.25 : 1; } });
defMove({ id: 'groundswell_swell', name: 'Swell Up', type: 'TIDE', owner: 'groundswell', reach: 'spread', tags: ['spell'], cd: 1, fx: 'swell | drop*4 wave | splash all',
  text: 'Hits for 60% MGK. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.6 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'groundswell_lift', name: 'Lift Dome', type: 'TIDE', owner: 'groundswell', reach: 'side', cd: 5, fx: 'lift | bubble*3 rise | ring ally',
  text: 'Summons a Water Dome (28% max HP, 3 turns). Your crests cost 1 less tide.',
  run(c) { summon(c.b, c.u, 'groundswell_cove', { hp: 0.28, turns: 3 }); setPrice(c.b, c.u.side, -1, 3); } });
defMove({ id: 'groundswell_turn', name: 'Lift Off', type: 'GEAR', owner: 'groundswell', reach: 'single', tags: ['spell'], cd: 3, fx: 'lift | cog*2 arc | burst',
  text: 'Lifts the foe\'s shield onto itself. Hits for 70% MGK. Root 2. Slow 1.',
  run(c) {
    const sh = c.tgt.shield || 0;
    if (sh > 0 && !c.blocked(c.tgt)) { c.tgt.shield = 0; c.tgt.shieldTurns = 0; giveShield(c.b, c.u, c.u, sh, 2); c.msg(`${label(c.b, c.u)} removes the shield.`); }
    c.hit(c.tgt, { mgk: 0.7 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 1);
  } });
defMove({ id: 'groundswell_spring', name: 'Spring High', type: 'TIDE', owner: 'groundswell', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 50, fx: 'swell | drop*6 wave | splash ring tint all big',
  text: 'Wind-up. Hits for 80% MGK. Splash 35%. Stun 1. Foe crests cost 2 more tide, 3 rounds.',
  run(c) { c.spread({ mgk: 0.8 }); c.st(c.tgt, 'stun', 1); setPrice(c.b, c.tgt.side, 2, 3); } });

// ================================================================ chapter 3: the mouth room

// chalk: climbing chalk out of its pouch that leaves Handprints on every foe and climbs over the one in front to reach the bench.
defMark({ id: 'chalk_flip', name: 'handprint', clock: 'own', negative: true, max: 3, value: -0.06 });
defPassive({ id: 'chalk_hand', name: 'Chalked Hand', owner: 'chalk', text: 'When it uses a move: its next attack deals 1.3x and heals 20% of it.',
  afterMove(b, f) { f.k.chalked = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.chalked ? 1.3 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.attack && f.k.chalked) { f.k.chalked = 0; heal(b, f, f, dealt * 0.2); } } });
defPassive({ id: 'chalk_grip', name: 'Chalk Grip', owner: 'chalk', text: 'Its hits deal +10% per Handprint on the foe (up to 3), and 1.25x from Hidden.',
  outMul(b, f, t) { return (1 + 0.1 * marked(t, 'chalk_flip')) * (f.s.hidden ? 1.25 : 1); } });
defMove({ id: 'chalk_toss', name: 'Chalk Toss', type: 'SALT', owner: 'chalk', reach: 'spread', tags: ['projectile'], cd: 1, fx: 'shake | sand*5 sweep | puff all',
  text: 'Hits for 47% ATK. Splash 35%. Slow 1. A Handprint on every foe.',
  run(c) { c.spread({ atk: 0.47 }); c.st(c.tgt, 'slow', 1); for (const e of standing(c.them)) c.mark(e, 'chalk_flip', 1, 4); } });
defMove({ id: 'chalk_dust', name: 'Dust Cloud', type: 'SALT', owner: 'chalk', reach: 'self', cd: 4, wt: 50, fx: 'shake | sand*6 rise | smoke self', text: 'Hidden 2. Haste 1. 1 tide.',
  run(c) { c.st(c.u, 'hidden', 2); c.st(c.u, 'haste', 1); c.nerve(c.me, 1); } });
defMove({ id: 'chalk_climb', name: 'Climb Over', type: 'STONE', owner: 'chalk', reach: 'bench', tags: ['dash'], cd: 3, fx: 'hop | pebble*3 arc | claw',
  text: 'Hits a foe reserve for 30% ATK, +15% per Handprint on it.',
  run(c) { const r = c.them.f[c.pick]; if (!r || r.ko || r.gone || isOut(c.b, r)) return; c.hit(r, { atk: 0.3 + 0.15 * marked(r, 'chalk_flip') }, { reserve: true }); } });
defMove({ id: 'chalk_hands', name: 'Clean Hands', type: 'SALT', owner: 'chalk', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'lunge | slash frost jolt big', text: 'Hits for 58% ATK. Untouchable 1. Hits for 37% ATK + 30% of the foe\'s missing HP.',
  run(c) { c.hit(c.tgt, { atk: 0.58 }); c.st(c.u, 'invuln', 1); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.37, tgtMiss: 0.3 }); } });

// saltline: the tide line on the Auger's walls that lays a Rising Line under the foe, plants a Salt Post, and walls a foe in salt.
/** How high the Rising Line under a side stands, as a share of max HP: 15%, and 5% more each round. */
const saltHeight = (b: Battle, side: 0 | 1) => { const g = b.s[side].ground; return g ? Math.min(0.5, 0.15 + 0.025 * Math.max(0, b.turnNo - g.at)) : 0; };
defGround({ id: 'saltline_line', name: 'Rising Line', color: '#e4e8f0', text: 'A line on HP bars from 15% of max HP, rising 5% a round. A whorl under it takes 1.3x from hits.',
  line(b, side) { return saltHeight(b, side); },
  inMul(b, f, src, d) { return !d.dot && f.hp < f.maxHp * saltHeight(b, f.side) ? 1.3 : 1; },
  value(b, side) { return b.s[side].ground?.id === 'saltline_line' ? -0.1 : 0.1; } });
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
defMove({ id: 'saltline_rime', name: 'Rime Strike', type: 'SALT', owner: 'saltline', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | salt*2 line fast | frost', text: 'Hits for 173% MGK. -4 DEF, up to 16. Salt Post out: Stun 1 once.',
  run(c) { c.hit(c.tgt, { mgk: 1.73 }); if (c.tgt.ko || c.blocked(c.tgt)) return; c.tgt.k.shred = Math.min(16, (c.tgt.k.shred || 0) + 4); if (postUp(c.b, c.u) && !c.u.k.dragonUsed) { c.u.k.dragonUsed = 1; c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'saltline_wall', name: 'Mark the Wall', type: 'STONE', owner: 'saltline', reach: 'single', tags: ['spell'], cd: 4, fx: 'flare | salt*3 line | crack',
  text: 'Hits for 60% MGK. Slow 1. Shield 15% max HP. A Rising Line under the foe\'s side, 5 rounds.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); c.st(c.tgt, 'slow', 1); c.shield(c.u, c.u.maxHp * 0.15, 2); if (!c.blocked(c.tgt)) setGround(c.b, c.tgt.side, 'saltline_line', 5, c.u); } });
defMove({ id: 'saltline_wash', name: 'Wash Line', type: 'SALT', owner: 'saltline', reach: 'single', tags: ['spell'], cd: 4, fx: 'stomp | salt*4 rise | pillar ally', text: 'Hits for 64% MGK. Summons a Salt Post (10% max HP, 4 turns). Haste 1.',
  run(c) { for (const s of summonsOf(c.b, c.u.side, 'saltline_post')) dismiss(c.b, s); summon(c.b, c.u, 'saltline_post', { hp: 0.1, turns: 4 }); c.u.k.dragonUsed = 0; c.hit(c.tgt, { mgk: 0.64 }); c.st(c.u, 'haste', 1); } });
defMove({ id: 'saltline_spring', name: 'Spring Line', type: 'SALT', owner: 'saltline', reach: 'single', tags: ['dash', 'spell'], cd: 6, nerve: 5, fx: 'lunge | salt*5 converge | shatter frost jolt big', text: 'Hits for 181% MGK. Neither out whorl can switch for 3 turns.',
  run(c) { c.hit(c.tgt, { mgk: 1.81 }); if (!c.tgt.ko) c.mark(c.tgt, 'saltline_ring', 1, 3); c.mark(c.u, 'saltline_ring', 1, 3); } });

// ================================================================ chapter 3: the rolling rooms

// tumbleweed: a tumbleweed that never roots, rolls off with the foe's own moves, hitches a friend, and charms what it rolls into.
defMark({ id: 'tumbleweed_snatch', name: 'rolling off', clock: 'own', volatile: true, value: 0.1,
  snatch(b, f) { unmark(f, 'tumbleweed_snatch'); return true; } });
defMark({ id: 'tumbleweed_bur', name: 'burred', clock: 'own', negative: true, volatile: true, value: -0.1,
  outMul(b, f, t, d) { return d.dot ? 1 : 0.5; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot) unmark(f, 'tumbleweed_bur'); } });
defMark({ id: 'tumbleweed_hitched', name: 'hitched', clock: 'side', calls: true, value: 0.15,
  inMul(b, f, src, d) { return d.reserve ? 0 : 1; },
  comeOut(b, f) { unmark(f, 'tumbleweed_hitched'); giveShield(b, f, f, f.maxHp * 0.2, 2); } });
defMark({ id: 'tumbleweed_quick', name: 'charming', max: 2, clock: 'own', volatile: true, value: 0.1,
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; const mk = f.m.tumbleweed_quick; if (!mk) return; forceAction(b, t, 'skip'); mk.n--; if (mk.n <= 0) unmark(f, 'tumbleweed_quick'); } });
defPassive({ id: 'tumbleweed_never', name: 'Never Roots', owner: 'tumbleweed', text: 'Immune to Root. Every 3rd turn: a shield of 8% of its max HP.',
  turnStart(b, f) { f.k.feather = (f.k.feather || 0) + 1; if (f.k.feather % 3 === 0) giveShield(b, f, f, f.maxHp * 0.08, 3); },
  statusImmune(f, id) { return id === 'root'; } });
defPassive({ id: 'tumbleweed_burs', name: 'Burs', owner: 'tumbleweed', text: 'When a dash hits it: the attacker\'s next hit deals 0.5x. Immune to Root.',
  afterTake(b, f, src, dealt, d) { if (enemy(f, src) && d.move?.tags?.includes('dash')) mark(b, f, src, 'tumbleweed_bur', 1, 2); },
  statusImmune(f, id) { return id === 'root'; } });
defMove({ id: 'tumbleweed_through', name: 'Roll Through', type: 'ROOT', owner: 'tumbleweed', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'spin | leaf*2 line | puff', text: 'Hits for 121% MGK. Your lowest-HP whorl heals 8% of its max HP.',
  run(c) { c.hit(c.tgt, { mgk: 1.21 }); const a = standing(c.me).sort((x, z) => x.hp / x.maxHp - z.hp / z.maxHp)[0]; if (a) c.heal(a, a.maxHp * 0.08); } });
defMove({ id: 'tumbleweed_bound', name: 'Roll Off With', type: 'STONE', owner: 'tumbleweed', reach: 'single', tags: ['dash'], cd: 4, quick: true, fx: 'spin fast | sand*3 line | puff',
  text: 'Quick. Hits for 75% MGK. Splash 35%. Steals the next move the foe uses on its side.',
  run(c) { c.spread({ mgk: 0.75 }); c.mark(c.u, 'tumbleweed_snatch', 1, 1); } });
defMove({ id: 'tumbleweed_hitch', name: 'Hitch Ride', type: 'ROOT', owner: 'tumbleweed', reach: 'reserveAlly', cd: 3, fx: 'hop | leaf orbit | ring ally',
  text: 'A reserve ally takes no bench damage and comes out next with a 20% shield. Haste 1.',
  run(c) { if (c.ally && !isOut(c.b, c.ally)) c.mark(c.ally, 'tumbleweed_hitched', 1, 4); c.st(c.u, 'haste', 1); } });
defMove({ id: 'tumbleweed_round', name: 'Round Up', type: 'ROOT', owner: 'tumbleweed', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'spin | leaf*5 spiral | daze bloom tint all big', text: 'Haste 3. Its next 2 hits make the foe skip its next turn.',
  run(c) { c.st(c.u, 'haste', 3); c.mark(c.u, 'tumbleweed_quick', 2, 3); } });

// riser: a step off the Auger's stair that goes up with practice and spends all of it on one great climb.
defPassive({ id: 'riser_goesup', name: 'Goes Up', owner: 'riser', text: 'Stair Tread hits add Practice. 5+: it burns. 15+: it KOs foes below 8%.',
  afterDeal(b, f, t, dealt, d) { if (d.move?.id === 'riser_tread' && !d.reserve) f.k.practice = (f.k.practice || 0) + 1; } });
defPassive({ id: 'riser_banister', name: 'Banister', owner: 'riser', text: 'Every 3 Practice: +2% max HP for the battle.',
  afterMove(b, f, m) { if (m.id !== 'riser_tread') return; const want = Math.floor((f.k.practice || 0) / 3); while ((f.k.banister || 0) < want) { f.k.banister = (f.k.banister || 0) + 1; const add = Math.round(f.st.hp * 0.02); f.maxHp += add; heal(b, f, f, add); } } });
defMove({ id: 'riser_tread', name: 'Stair Tread', type: 'GEAR', owner: 'riser', reach: 'single', tags: ['projectile'], cd: 1, fx: 'stomp | cog*2 line | burst', text: 'Hits for 92% ATK, +2% per Practice, up to +50%. 5+ Practice: Burn 2.',
  run(c) {
    const p = c.u.k.practice || 0;
    c.hit(c.tgt, { atk: 0.92 }, { mult: 1 + 0.02 * Math.min(25, p) });
    if (c.tgt.ko) return;
    if (p >= 5) c.st(c.tgt, 'burn', 2, stat(c.b, c.u, 'atk') * 0.2);
    if (p >= 15 && under(c.tgt, 0.08)) { c.msg(`${label(c.b, c.u)} is finally ready.`); c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); }
  } });
defMove({ id: 'riser_goup', name: 'Go Up', type: 'STONE', owner: 'riser', reach: 'spread', cd: 3, fx: 'stomp | pebble*4 rise | quake all',
  text: 'Hits for 65% ATK. Splash 35%. Slow 2. Practice +2.',
  run(c) { c.spread({ atk: 0.65 }); c.st(c.tgt, 'slow', 2); c.u.k.practice = (c.u.k.practice || 0) + 2; } });
defMove({ id: 'riser_kick', name: 'Kick Plate', type: 'GEAR', owner: 'riser', reach: 'self', cd: 3, wt: 50, fx: 'hop | ring self',
  text: 'Practice +3. Fortify 2. Its next turn comes 30% sooner.',
  run(c) { c.u.k.practice = (c.u.k.practice || 0) + 3; c.st(c.u, 'fortify', 2); c.hasten(c.u, 30); } });
defMove({ id: 'riser_flight', name: 'Top Flight', type: 'GEAR', owner: 'riser', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, fx: 'lift | cog*5 rise | burst cinders jolt all big',
  text: 'Spends all Practice: 85% ATK, +5% per Practice. Splash 35%. Heals 10% of max HP.',
  run(c) { const p = c.u.k.practice || 0; c.u.k.practice = 0; c.spread({ atk: 0.85 + 0.05 * p }); c.heal(c.u, c.u.maxHp * 0.1); } });

// columella: the Auger's middle post that everything leans on, which spreads a blow across its team and holds a friend up from the bench.
defMark({ id: 'columella_blade', name: 'blade out', clock: 'own', volatile: true, value: 0.06,
  turnStart(b, f) { unmark(f, 'columella_blade'); const t = foe(b, f); if (t) { strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'STONE'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } } });
defMark({ id: 'columella_refuge', name: 'leaned on', clock: 'own', volatile: true, value: 0.12,
  beforeTake(b, f, src, amt, d) {
    if (d.dot || d.reserve) return amt;
    const team = standing(b.s[f.side]).filter(r => r !== f);
    if (!team.length) return amt;
    const part = amt / (team.length + 1);
    for (const r of team) dealDamage(b, src, r, part, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: true }, null);
    return part;
  } });
defMark({ id: 'columella_held', name: 'held up', clock: 'own', volatile: true, value: 0.2,
  beforeTake(b, f, src, amt, d) {
    const mk = f.m.columella_held, by = mk ? markedBy(b, mk) : null;
    if (!by || by.ko || by.gone || isOut(b, by) || d.dot) return amt;
    dealDamage(b, src, by, amt * 0.5, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: true }, null);
    return amt * 0.5;
  } });
defPassive({ id: 'columella_center', name: 'Center', owner: 'columella', text: 'After a move, once every 3 turns: a shield of 10% of its max HP.',
  afterMove(b, f) { if ((f.k.kiAt || -9) > b.turnNo - 6) return; f.k.kiAt = b.turnNo; giveShield(b, f, f, f.maxHp * 0.1, 3); } });
defPassive({ id: 'columella_climbed', name: 'Climbed', owner: 'columella', text: 'In reserve: your out whorl takes 0.9x damage.',
  auraIn() { return 0.9; } });
defMove({ id: 'columella_axis', name: 'Axis Cut', type: 'STONE', owner: 'columella', reach: 'single', cd: 1, fx: 'spin | shard return | slash', text: 'Hits for 116% ATK. The blade returns at its next turn: 50% ATK, Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.16 }); c.mark(c.u, 'columella_blade', 1, 2); } });
defMove({ id: 'columella_dash', name: 'Post Dash', type: 'GEAR', owner: 'columella', reach: 'single', tags: ['dash'], cd: 4, fx: 'lunge | cog line | crack', text: 'Hits for 87% ATK. Taunt 1.',
  run(c) { c.hit(c.tgt, { atk: 0.87 }); c.st(c.tgt, 'taunt', 1); } });
defMove({ id: 'columella_middle', name: 'Middle Post', type: 'STONE', owner: 'columella', reach: 'self', cd: 4, wt: 60, fx: 'stomp | pillar self',
  text: 'Until its next turn: hits on it are split evenly across your team.',
  run(c) { c.mark(c.u, 'columella_refuge', 1, 1); } });
defMove({ id: 'columella_under', name: 'Stand Under', type: 'STONE', owner: 'columella', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, fx: 'sink big | ring pillar tint ally',
  text: 'Switches to an ally. 3 turns: it takes 0.5x, and Coshira takes the rest.',
  run(c) { if (c.ally) c.mark(c.ally, 'columella_held', 1, 3); } });

// ================================================================ chapter 3: the stair

// crimp: a handhold worn finger-shaped by sixty years of climbers that grows from every grip, pins a foe, and goes straight through.
defPassive({ id: 'crimp_sixty', name: 'Sixty Years', owner: 'crimp', text: 'When its moves hit: +1.5% MGK for the battle, max 30%. A KO: +6%.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && t.side !== f.side) f.k.evil = Math.min(20, (f.k.evil || 0) + 1); },
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side) f.k.evil = Math.min(20, (f.k.evil || 0) + 4); },
  statBonus(f, k) { return k === 'mgk' ? Math.round(f.st.mgk * 0.015 * (f.k.evil || 0)) : 0; } });
defPassive({ id: 'crimp_smooth', name: 'Worn Smooth', owner: 'crimp', text: 'Every +6% MGK from Sixty Years: +2% max HP.',
  afterMove(b, f) { const want = Math.floor((f.k.evil || 0) / 4); while ((f.k.smooth || 0) < want) { f.k.smooth = (f.k.smooth || 0) + 1; const add = Math.round(f.st.hp * 0.02); f.maxHp += add; heal(b, f, f, add); } } });
defMove({ id: 'crimp_tip', name: 'Fingertip', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | pebble line fast | crack',
  text: 'Hits for 260% MGK. Knocks the foe down.',
  run(c) { c.hit(c.tgt, { mgk: 2.6 }); if (!c.tgt.ko) knockDown(c.b, c.tgt); } });
defMove({ id: 'crimp_under', name: 'Loose Hold', type: 'ROOT', owner: 'crimp', reach: 'single', tags: ['spell'], cd: 3, wu: 80, fx: 'shake | thorn*3 arc | crack big', text: 'Wind-up. Hits for 380% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 3.8 }); } });
defMove({ id: 'crimp_rest', name: 'Rest Hold', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['spell'], cd: 3, fx: 'stomp | pebble*2 converge | crack',
  text: 'Hits for 110% MGK. Knocks the foe down. Stun 1. Root 3.',
  run(c) { if (c.blocked(c.tgt)) return; c.hit(c.tgt, { mgk: 1.1 }); if (c.tgt.ko) return; knockDown(c.b, c.tgt); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'root', 3); } });
defMove({ id: 'crimp_through', name: 'Go Through', type: 'STONE', owner: 'crimp', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'lunge | pebble*4 line | shatter crack jolt big',
  text: 'Hits for 240% MGK through shields. +15% per 10% of the foe\'s HP missing.',
  run(c) { c.hit(c.tgt, { mgk: 2.4 }, { mult: 1 + Math.min(1, (c.tgt.maxHp - c.tgt.hp) / c.tgt.maxHp * 1.5), pierce: true }); } });

// chamois: a climbers' goat that runs up the wall out of reach and butts whatever is in its way off the ledge.
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
defMove({ id: 'chamois_butt', name: 'Head Butt', type: 'BEAST', owner: 'chamois', reach: 'single', tags: ['dash'], cd: 1, wu: 30, fx: 'lunge | crack jolt',
  text: 'Short wind-up. Hits for 112% ATK. Delays it 30%. Knocks it down.',
  run(c) { c.hit(c.tgt, { atk: 1.12 }); if (!c.tgt.ko) { c.delay(c.tgt, 30); knockDown(c.b, c.tgt); } } });
defMove({ id: 'chamois_wallrun', name: 'Wall Run', type: 'BEAST', owner: 'chamois', reach: 'self', cd: 3, wt: 50, fx: 'hop fast | pebble*2 rise | ring self',
  text: 'Goes up for 2 turns. Next attack: 1.5x, and each reserve takes 50% ATK.',
  run(c) { goUp(c.b, c.u, 2); c.u.k.nextAtkMul = 1.5; c.mark(c.u, 'chamois_force', 1, 2); } });
defMark({ id: 'chamois_force', name: 'wall running', clock: 'own', volatile: true, value: 0.06,
  afterAttack(b, f) { unmark(f, 'chamois_force'); for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.5, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defMove({ id: 'chamois_leap', name: 'Leap Off', type: 'TIDE', owner: 'chamois', reach: 'single', tags: ['dash'], cd: 3, fx: 'lift | drop*3 arc | splash big',
  text: 'Hits for 71% ATK, 1.3x if it is up, then lands. Slow 2.',
  run(c) { const hi = !!c.u.up; c.hit(c.tgt, { atk: 0.71 }, { mult: hi ? 1.3 : 1 }); c.st(c.tgt, 'slow', 2); if (hi) { c.u.up = 0; c.msg(`${label(c.b, c.u)} touches down.`); } } });
defMove({ id: 'chamois_headlong', name: 'Headlong', type: 'BEAST', owner: 'chamois', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'lunge big | crack big jolt',
  text: 'Unstoppable 1. Hits for 130% ATK. Forces it out: it lands for 10% max HP.',
  run(c) {
    c.st(c.u, 'unstop', 1);
    c.hit(c.tgt, { atk: 1.3 });
    const t = c.tgt;
    if (!t.ko && c.forceOut()) dealDamage(c.b, c.u, t, t.maxHp * 0.1, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: true }, null);
  } });

// swift: a swift that never lands any lower than it must, fires down from up high, and skims the water to go back up.
defPassive({ id: 'swift_double', name: 'Double Back', owner: 'swift', text: 'When it uses a move: its next attack also hits for 50% ATK.',
  afterMove(b, f) { f.k.twin = 1; },
  afterAttack(b, f, t) { if (!f.k.twin || t.ko || t.gone) return; f.k.twin = 0; strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'BEAST'); } });
defPassive({ id: 'swift_aloft', name: 'Aloft', owner: 'swift', text: 'When it comes out: it goes up for 3 turns, and its first turn comes 20% sooner.',
  comeOut(b, f) { goUp(b, f, 3); f.k.firstBonus = (f.k.firstBonus || 0) + 20; } });
defMark({ id: 'swift_blaze', name: 'screeched at', clock: 'own', negative: true, volatile: true, value: -0.06,
  inMul(b, f, src, d) { return d.attack ? 1.2 : 1; } });
defMove({ id: 'swift_scythe', name: 'Scythe Shot', type: 'BEAST', owner: 'swift', reach: 'single', tags: ['projectile'], cd: 1, fx: 'flare | feather*2 line fast | slash', text: 'Hits for 104% ATK. The first reserve takes 40% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 1.04 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { atk: 1.04 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'swift_screech', name: 'Screech', type: 'BEAST', owner: 'swift', reach: 'single', tags: ['projectile'], cd: 3, fx: 'swell | hoop*3 wave | daze', text: 'Hits for 95% ATK. 2 turns: the foe takes 1.2x from attacks.',
  run(c) { c.hit(c.tgt, { atk: 0.95 }); if (!c.tgt.ko) c.mark(c.tgt, 'swift_blaze', 1, 2); } });
defMove({ id: 'swift_dive', name: 'Dive Past', type: 'TIDE', owner: 'swift', reach: 'single', tags: ['dash'], cd: 2, fx: 'lunge fast | drop*2 sweep | splash',
  text: 'Hits for 80% ATK. Then it goes up for 2 turns. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.8 }); goUp(c.b, c.u, 2); c.hasten(c.u, 20); } });
defMove({ id: 'swift_endless', name: 'Endless', type: 'BEAST', owner: 'swift', reach: 'spread', tags: ['projectile'], cd: 6, splash: 0.15, nerve: 5, fx: 'swell big | feather*8 rain | slash claw jolt all', text: 'Hits 6 times for 23% ATK. Splash 15%.',
  run(c) { for (let i = 0; i < 6 && !c.tgt.ko; i++) c.spread({ atk: 0.23 }); } });

// torr: the push of air in the Auger's narrow whorls that pushes Pressure into a foe and pushes it out of the way.
defMark({ id: 'torr_charge', name: 'under pressure', max: 4, clock: 'own', negative: true, value: -0.1,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The pressure inside ${label(b, f)} gives way.`); const raw = stat(b, by, 'mgk') * (0.8 + 0.25 * mk.n); strike(b, by, f, raw, 'M', 'GEAR'); if (has(by, 'torr_narrow')) for (const r of reserves(b.s[f.side])) dealDamage(b, by, r, raw * 0.35, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'torr_kept', name: 'Kept Push', owner: 'torr', text: 'Its attacks add 1 to the foe\'s Pressure, max 4. It bursts for 80% MGK +25% each.',
  afterAttack(b, f, t) { const mk = t.m.torr_charge; if (mk && mk.n < 4) mk.n++; } });
defPassive({ id: 'torr_narrow', name: 'Narrow', owner: 'torr', text: 'Pressure also bursts on the foe\'s reserves for 35%.' });
defMove({ id: 'torr_gust', name: 'Gust Fire', type: 'GEAR', owner: 'torr', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | orb*2 line fast | puff',
  text: 'Hits for 90% MGK. Pressure +1.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); if (c.tgt.ko) return; const mk = c.tgt.m.torr_charge; if (mk) mk.n = Math.min(4, mk.n + 1); else c.mark(c.tgt, 'torr_charge', 1, 2); } });
defMove({ id: 'torr_blast', name: 'Blast Jump', type: 'GEAR', owner: 'torr', reach: 'spread', tags: ['dash', 'spell'], cd: 3, fx: 'stomp | orb*3 sweep | burst all',
  text: 'Hits for 69% MGK. Splash 35%. Slow 2. If it KOs the foe: its cooldown resets.',
  run(c) { c.spread({ mgk: 0.69 }); c.st(c.tgt, 'slow', 2); if (c.tgt.ko) ready(c.u, 'torr_blast'); } });
defMove({ id: 'torr_breathe', name: 'Breathe In', type: 'VOID', owner: 'torr', reach: 'single', tags: ['spell'], cd: 3, fx: 'swell | orb*3 converge | ring', text: 'Hits for 37% MGK. Sets Pressure: it bursts after 2 foe turns.',
  run(c) { c.hit(c.tgt, { mgk: 0.37 }); if (!c.tgt.ko) c.mark(c.tgt, 'torr_charge', 1, 2); } });
defMove({ id: 'torr_blowout', name: 'Blowout', type: 'GEAR', owner: 'torr', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, fx: 'swell | orb*4 line | burst cinders jolt big', text: 'Hits for 129% MGK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { mgk: 1.29 }); if (!c.tgt.ko) c.forceOut(); } });

// ================================================================ chapter 3: the point

// plummet: the drop under the top stair that kept falling and takes things down with it, so a foe that leaves falls on the way.
const PLUMMET_DARK: SpriteData = { px: ['22222222', '21111112', '21444412', '21433412', '21444412', '21111112', '222.2222', '.222222.'], c: ['#c1b9d1', '#d41f2d', '#2e2a40'] };
defMark({ id: 'plummet_dark', name: 'fallen through', clock: 'own', value: 0.2,
  inMul() { return 0.85; },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'plummet_dark'); clearForm(b, f); } });
defPassive({ id: 'plummet_nofloor', name: 'No Floor', owner: 'plummet', text: 'When a foe switches out: it falls for 8% of its max HP.',
  anyLeave(b, f, who) {
    if (who.side === f.side || !isOut(b, f) || f.ko || who.ko) return;
    msg(b, `${label(b, who)} collapses as they exit.`);
    dealDamage(b, f, who, who.maxHp * 0.08, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
  } });
defPassive({ id: 'plummet_kept', name: 'Kept Falling', owner: 'plummet', text: 'After Bottom Out, for 3 turns: takes 0.85x damage, moves deal 1.2x.',
  outMul(b, f, t, d) { return d.move && marked(f, 'plummet_dark') ? 1.2 : 1; } });
defMove({ id: 'plummet_drop', name: 'Drop In', type: 'VOID', owner: 'plummet', reach: 'single', tags: ['spell'], cd: 1, fx: 'sink | orb*2 rain | crack',
  text: 'Hits for 88% MGK. Knocks the foe down. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.88 }); if (!c.tgt.ko) knockDown(c.b, c.tgt); c.hasten(c.u, 20); } });
defMove({ id: 'plummet_freefall', name: 'Freefall', type: 'VOID', owner: 'plummet', reach: 'single', tags: ['spell'], cd: 5, fx: 'sink | vortex dark', text: 'Hits for 26% MGK. The foe falls off the field for 1 turn.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; c.hit(c.tgt, { mgk: 0.26 }); if (!c.tgt.ko) banish(c.b, c.tgt, 1, c.u); } });
defMove({ id: 'plummet_trip', name: 'Trip', type: 'TIDE', owner: 'plummet', reach: 'spread', tags: ['spell'], cd: 3, fx: 'sway | drop*4 sweep | splash all',
  text: 'Hits for 70% MGK. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.7 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'plummet_bottom', name: 'Bottom Out', type: 'VOID', owner: 'plummet', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, fx: 'sink big | orb*5 rain | vortex big dark', text: 'Hits for 79% MGK. Splash 35%. Haste 2. 3 turns: 1.15x MGK and AGI.',
  run(c) { setForm(c.b, c.u, { tag: 'dark', sprite: PLUMMET_DARK, statMul: { mgk: 1.15, agi: 1.15 } }); c.mark(c.u, 'plummet_dark', 1, 3); c.st(c.u, 'haste', 2); c.spread({ mgk: 0.79 }); } });

// zenith: the highest point the Auger ever pointed at, which keeps pointing at a foe that runs and lines up Long Shots from far off.
defSummon({ id: 'zenith_trap', name: 'Snap Trap', owner: 'zenith', text: 'Stays until a foe comes out: Root 2, and Huipki\'s next attack is a Long Shot.',
  sprite: { px: ['........', '........', '2......2', '22....22', '.2.33.2.', '44444444', '........', '........'], c: ['#d3c3e3', '#fff2c1', '#54446a'] },
  trap(b, s, who) { const f = ownerOf(b, s); applyStatus(b, f, who, 'root', 2); if (f) f.k.headshot = 1; return true; } });
defPassive({ id: 'zenith_points', name: 'Points', owner: 'zenith', text: 'Every 5th attack is a Long Shot: 1.8x. So is the next after a trap or net.',
  outMul(b, f, t, d) { return d.attack && ((f.k.hs || 0) % 5 === 4 || f.k.headshot) ? 1.8 : 1; },
  afterAttack(b, f) { if (f.k.headshot) f.k.headshot = 0; else f.k.hs = (f.k.hs || 0) + 1; } });
defPassive({ id: 'zenith_plumb', name: 'Still Points', owner: 'zenith', text: 'When a foe switches out: Huipki fires at it as it goes, for 70% MGK.',
  anyLeave(b, f, who) { if (who.side !== f.side && isOut(b, f) && !f.ko && !who.ko) castMove(b, f, 'zenith_parting'); } });
defMove({ id: 'zenith_parting', name: 'Parting Shot', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile'], cd: 0, extra: true, fx: 'flare | star line fast | flash',
  text: 'Hits a foe as it switches out for 70% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }); } });
defMove({ id: 'zenith_pointat', name: 'Point At', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile', 'spell'], cd: 1, wu: 30, fx: 'flare | star line | flash', text: 'Short wind-up. Hits for 112% MGK. The first reserve takes 40% of it.',
  run(c) { c.hit(c.tgt, { mgk: 1.12 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.12 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'zenith_shot', name: 'Snap Shot', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile'], cd: 3, fx: 'sway | rune arc | sigil',
  text: 'Hits for 60% MGK. Root 1. Sets a Snap Trap (6% max HP).',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); c.st(c.tgt, 'root', 1); summon(c.b, c.u, 'zenith_trap', { hp: 0.06 }); } });
defMove({ id: 'zenith_bearing', name: 'Net Bearing', type: 'GEAR', owner: 'zenith', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | cog*3 arc | ring',
  text: 'Hits for 91% MGK. Slow 2. Its next turn comes 30% sooner. Next attack: a Long Shot.',
  run(c) { c.hit(c.tgt, { mgk: 0.91 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 30); c.u.k.headshot = 1; } });
defMove({ id: 'zenith_highest', name: 'Highest', type: 'STAR', owner: 'zenith', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 80, fx: 'lift | star*5 rain | flash big glare',
  text: 'Long wind-up. Hits for 260% MGK, 1.5x on a foe that is up.',
  run(c) { c.hit(c.tgt, { mgk: 2.6 }, { mult: c.tgt.up ? 1.5 : 1 }); } });

// bourdon: the low note the Auger plays, which hums a mend or speed song for whoever is out, from the field or the bench.
defPassive({ id: 'bourdon_starts', name: 'Starts Low', owner: 'bourdon', text: 'Turns 10% sooner. Turn start: Mend song heals 3% (out ally 2%), Speed song Haste 1.',
  turnEnd(b, f) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); },
  turnStart(b, f) { const amp = f.k.amp && f.k.amp >= b.turnNo ? 2 : 1; if (f.k.song) applyStatus(b, f, f, 'haste', 1); else heal(b, f, f, f.maxHp * 0.03 * amp); },
  reserveTurn(b, f) { const o = outOf(b, f); if (o.ko) return; if (f.k.song) applyStatus(b, f, o, 'haste', 1); else heal(b, f, o, o.maxHp * 0.02); } });
defPassive({ id: 'bourdon_listen', name: 'Amp Up', owner: 'bourdon', text: 'Every 3rd move: its next Mend heal is 2x.',
  afterMove(b, f) { f.k.notes3 = (f.k.notes3 || 0) + 1; if (f.k.notes3 % 3 === 0) f.k.amp = b.turnNo + 2; } });
defMove({ id: 'bourdon_low', name: 'Low Pulse', type: 'STAR', owner: 'bourdon', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | orb*4 wave | ring', text: 'Hits 4 times for 21% MGK.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.21 }); } });
defMove({ id: 'bourdon_drone', name: 'Drone Shift', type: 'STAR', owner: 'bourdon', reach: 'self', cd: 1, wt: 40, fx: 'sway | bell orbit | ring self', text: 'Switches between Mend and Speed songs. Heals itself 6% of max HP.',
  run(c) { c.u.k.song = c.u.k.song ? 0 : 1; c.heal(c.u, c.u.maxHp * 0.06); c.msg(`${label(c.b, c.u)} hums the tune of ${c.u.k.song ? 'speed' : 'mend'}.`); } });
defMove({ id: 'bourdon_air', name: 'Push Air', type: 'GEAR', owner: 'bourdon', reach: 'single', tags: ['spell'], cd: 4, fx: 'swell | orb*3 line | puff',
  text: 'Hits for 55% MGK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { mgk: 0.55 }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'bourdon_tune', name: 'Tune Up', type: 'STAR', owner: 'bourdon', reach: 'team', cd: 6, nerve: 5, fx: 'swell big | bell*3 orbit | ring sparkle tint ally',
  text: 'Your team: a shield of 25% max HP, 2 turns. Its Mend heals 2x for 3 turns.',
  run(c) { for (const a of standing(c.me)) c.shield(a, a.maxHp * 0.25, 2); c.u.k.amp = c.b.turnNo + 6; } });

// ================================================================ rare

// ostium: the hole the star burned through the Margin, which opens wherever it is put and lets a foe's move through to its own bench.
defMark({ id: 'ostium_hole', name: 'hole open', clock: 'own', volatile: true, value: 0.2,
  intercept(b, f, user, m) { if (!isOut(b, f) || m.reach !== 'single') return null; unmark(f, 'ostium_hole'); return 'through'; } });
defSummon({ id: 'ostium_turret', name: 'Hole Turret', owner: 'ostium', text: 'Each turn: zaps the foe for 44% of Reikuchi\'s MGK. It zaps each foe that comes out too.', every: 100,
  sprite: { px: ['........', '...33...', '..3443..', '.342243.', '..3443..', '...33...', '........', '........'], c: ['#ffffff', '#87e8fe', '#2957b4'] },
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (!f || f.ko || !t || t.ko) return; strike(b, f, t, stat(b, f, 'mgk') * 0.44, 'M', 'STAR'); },
  trap(b, s, who) { const f = ownerOf(b, s); if (f && !f.ko && !who.ko) strike(b, f, who, stat(b, f, 'mgk') * 0.44, 'M', 'STAR'); return false; } });
defSummon({ id: 'ostium_wall', name: 'Hole Wall', owner: 'ostium', sprite: { px: ['........', '33333333', '34422443', '34444443', '34422443', '33333333', '........', '........'], c: ['#f3f9ff', '#81e2f8', '#2451ae'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* the wall only stands */ } });
defPassive({ id: 'ostium_anywhere', name: 'Opens Anywhere', owner: 'ostium', text: 'Moves hitting the same foe in a row: +15% each, up to +45%.',
  outMul(b, f, t, d) { return d.move && f.k.beamOn === t.side * 8 + t.idx + 1 ? 1 + 0.15 * Math.min(3, f.k.beam || 0) : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.move || d.reserve || t.side === f.side) return; const id = t.side * 8 + t.idx + 1; if (f.k.beamOn !== id) { f.k.beamOn = id; f.k.beam = 0; } f.k.beam = (f.k.beam || 0) + 1; } });
defPassive({ id: 'ostium_burn', name: 'Star Burn', owner: 'ostium', text: 'Its moves that hit add Burn 2 (8% MGK each turn).',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.08); } });
defMove({ id: 'ostium_through', name: 'Hole Through', type: 'VOID', owner: 'ostium', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | beam ray | burst', text: 'Hits for 168% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.68 }); } });
defMove({ id: 'ostium_under', name: 'Open Under', type: 'STAR', owner: 'ostium', reach: 'side', cd: 3, fx: 'sink | star*2 rise | sparkle self', text: 'Summons a Hole Turret (10% max HP, 3 turns), up to 3.',
  run(c) { if (summonsOf(c.b, c.u.side, 'ostium_turret').length >= 3) dismiss(c.b, summonsOf(c.b, c.u.side, 'ostium_turret')[0]); summon(c.b, c.u, 'ostium_turret', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'ostium_step', name: 'Other End', type: 'VOID', owner: 'ostium', reach: 'self', cd: 3, quick: true, fx: 'blink | hoop orbit | vortex',
  text: 'Quick. The foe\'s next one-target move goes through to its own reserve.',
  run(c) { c.mark(c.u, 'ostium_hole', 1, 1); } });
defMove({ id: 'ostium_margin', name: 'Margin Hole', type: 'VOID', owner: 'ostium', reach: 'team', cd: 6, nerve: 5, fx: 'swell big | hoop*3 orbit | ring vortex tint ally', text: 'Summons a Hole Wall (35% max HP, 3 turns). Your team gets Fortify 2.',
  run(c) { summon(c.b, c.u, 'ostium_wall', { hp: 0.35, turns: 3 }); for (const a of standing(c.me)) c.st(a, 'fortify', 2, 0.25); } });

// gimlet: a moon snail that drills neat round Holes that add up to true damage, rasps twice, and goes in.
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
  msg(b, `${label(b, t)} falls apart.`);
  dealDamage(b, f, t, t.maxHp * 0.08, dot('T'), null);
  f.k.deconning = 0;
}
defPassive({ id: 'gimlet_drill', name: 'Drill Through', owner: 'gimlet', text: 'Its moves add a Drill Hole, up to 3. At 3: 8% of the foe\'s max HP, true.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) decon(b, f, t); } });
defPassive({ id: 'gimlet_goes', name: 'Goes In', owner: 'gimlet', text: 'Deals 1.15x damage to a foe with a Drill Hole.',
  outMul(b, f, t) { return marked(t, 'gimlet_decon') ? 1.15 : 1; } });
defMove({ id: 'gimlet_drillmove', name: 'Drill', type: 'VOID', owner: 'gimlet', reach: 'single', splash: 0.4, tags: ['projectile'], cd: 1, fx: 'spin | shard line | crack', text: 'Hits for 96% ATK. Splash 40%.',
  run(c) { c.hit(c.tgt, { atk: 0.96 }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.96 }, { reserve: true, spread: true, mult: 0.4 }); } });
defMove({ id: 'gimlet_radula', name: 'Radula', type: 'VOID', owner: 'gimlet', reach: 'single', cd: 2, fx: 'lunge | fang*2 line | bite', text: 'Hits for 49% ATK. At its next turn: 49% ATK again.',
  run(c) { c.hit(c.tgt, { atk: 0.49 }); c.mark(c.u, 'gimlet_rift', 1, 2); } });
defMove({ id: 'gimlet_foot', name: 'Moon Foot', type: 'TIDE', owner: 'gimlet', reach: 'spread', cd: 4, wu: 40, fx: 'stomp | drop*3 sweep | splash all',
  text: 'Short wind-up. Hits for 70% ATK. Splash 35%. Stun 1.',
  run(c) { c.spread({ atk: 0.7 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'gimlet_goin', name: 'Go In', type: 'VOID', owner: 'gimlet', reach: 'spread', tags: ['channel'], cd: 6, nerve: 5, fx: 'spin | shard*4 spiral | crack vortex dark all big', text: 'Hits for 65% ATK, again next turn. Splash 35%. Stun or Silence ends it.',
  run(c) { c.spread({ atk: 0.65 }); c.mark(c.u, 'gimlet_ray', 1, 2); } });

// albatross: the shell of an albatross that never came down, whose bird still dives from the sky at the start of every round.
defMark({ id: 'albatross_flux', name: 'overflown', clock: 'own', negative: true, volatile: true, value: -0.06 });
defPassive({ id: 'albatross_never', name: 'Still Up There', owner: 'albatross', text: 'Round start: the bird overhead dives at the foe for 12% ATK, even from the bench.',
  roundStart(b, f) { if (foe(b, f)) castMove(b, f, 'albatross_dive'); } });
defMove({ id: 'albatross_dive', name: 'Bird Dive', type: 'BEAST', owner: 'albatross', reach: 'single', tags: ['projectile'], cd: 0, extra: true, fx: 'lift | feather*3 rain | slash',
  text: 'The bird overhead dives at the foe for 12% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.12 }); } });
defPassive({ id: 'albatross_shell', name: 'Long Shell', owner: 'albatross', text: 'When it comes out: its first turn comes 15% sooner.',
  comeOut(b, f) { f.k.firstBonus = (f.k.firstBonus || 0) + 15; } });
defMove({ id: 'albatross_wingspan', name: 'Wingspan', type: 'BEAST', owner: 'albatross', reach: 'single', tags: ['projectile'], cd: 1, fx: 'sway | feather*3 line | slash', text: 'Hits for 62% ATK, 1.6x on an Overflown foe. Other cooldowns drop 1.',
  run(c) {
    const fx = c.marked(c.tgt, 'albatross_flux') > 0;
    c.hit(c.tgt, { atk: 0.62 }, { mult: fx ? 1.6 : 1 });
    if (fx) unmark(c.tgt, 'albatross_flux');
    c.u.moves.forEach((id, i) => { if (id !== 'albatross_wingspan') c.u.cd[i] = Math.max(0, c.u.cd[i] - 1); });
  } });
defMove({ id: 'albatross_soar', name: 'Soar Over', type: 'BEAST', owner: 'albatross', reach: 'single', tags: ['projectile'], cd: 3, fx: 'lift | feather arc | daze', text: 'Hits for 41% ATK. The foe is Overflown for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 0.41 }); if (!c.tgt.ko) c.mark(c.tgt, 'albatross_flux', 1, 3); } });
defMove({ id: 'albatross_shadow', name: 'Shadow Shift', type: 'TIDE', owner: 'albatross', reach: 'single', tags: ['dash', 'projectile'], cd: 3, fx: 'blink | drop*2 sweep | splash', text: 'Hits for 34% ATK. Its next turn comes 40% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.34 }); c.hasten(c.u, 40); } });
defMove({ id: 'albatross_beach', name: 'Whole Beach', type: 'BEAST', owner: 'albatross', reach: 'spread', tags: ['projectile'], cd: 6, splash: 0.7, nerve: 5, wu: 60, fx: 'lift | feather*6 rain | slash claw jolt all big', text: 'Wind-up. Hits for 118% ATK. Splash 70%.',
  run(c) { c.spread({ atk: 1.18 }); } });

// protoconch: the Nautilus's first room, the size of a pea, which grows each move it repeats into a bigger one and fills foes with Swell.
defMark({ id: 'protoconch_plasma', name: 'swell', max: 5, clock: 'own', negative: true, volatile: true, value: -0.05 });
function plasma(b: Battle, f: Fighter, t: Fighter, n: number): void {
  if (t.ko || t.gone || t.side === f.side || f.k.bursting) return;
  mark(b, f, t, 'protoconch_plasma', n, 3);
  if (marked(t, 'protoconch_plasma') < 5) return;
  unmark(t, 'protoconch_plasma');
  f.k.bursting = 1;
  msg(b, `The swelling in ${label(b, t)} ruptures.`);
  strike(b, f, t, stat(b, f, 'mgk') * 0.5 + (t.maxHp - t.hp) * 0.12, 'M', 'TIDE');
  f.k.bursting = 0;
}
const evolved = (f: Fighter, id: string) => (f.k['evo_' + id] || 0) >= 3;
defPassive({ id: 'protoconch_first', name: 'First Room', owner: 'protoconch', text: 'Its hits add Swell, up to 5. At 5 it bursts: 50% MGK + 12% missing HP.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) plasma(b, f, t, 1); } });
defPassive({ id: 'protoconch_sealed', name: 'Sealed', owner: 'protoconch', text: 'A move it has used 3 times is Grown.',
  afterMove(b, f, m) { const key = 'evo_' + m.id; if ((f.k[key] || 0) < 3) { f.k[key] = (f.k[key] || 0) + 1; if (f.k[key] === 3) msg(b, `${label(b, f)} builds a room.`); } } });
defMove({ id: 'protoconch_jet', name: 'Jet Rain', type: 'TIDE', owner: 'protoconch', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | drop*6 rain | splash', text: 'Hits 6 times for 33% MGK, 9 Grown. 1.3x on a foe with no reserves.',
  run(c) { const n = evolved(c.u, 'protoconch_jet') ? 9 : 6; const lone = reserves(c.them).length === 0 ? 1.3 : 1; for (let i = 0; i < n && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.33 }, { mult: lone }); } });
defMove({ id: 'protoconch_room', name: 'Room Seeker', type: 'STONE', owner: 'protoconch', reach: 'single', tags: ['projectile', 'spell'], cd: 3, fx: 'flare | shell line | crack',
  text: 'Hits for 153% MGK. 2 Swell. Grown: 3 Swell and Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.53 }); if (!c.tgt.ko) { const g = evolved(c.u, 'protoconch_room'); plasma(c.b, c.u, c.tgt, g ? 3 : 2); if (g) c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'protoconch_pea', name: 'Pea Charge', type: 'TIDE', owner: 'protoconch', reach: 'self', cd: 3, wt: 50, fx: 'spin | shell orbit | ring self', text: 'Haste 2. Grown: Untouchable 1.',
  run(c) { c.st(c.u, 'haste', 2); if (evolved(c.u, 'protoconch_pea')) c.st(c.u, 'invuln', 1); } });
defMove({ id: 'protoconch_coil', name: 'Coil In', type: 'TIDE', owner: 'protoconch', reach: 'single', tags: ['dash', 'spell'], cd: 5, nerve: 3, fx: 'spin | shell*3 spiral | splash ring tint big', text: 'Shield of 20% max HP. Hits for 132% MGK, 1.25x if Swelled. 2 Swell.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.2, 2); c.hit(c.tgt, { mgk: 1.32 }, { mult: c.marked(c.tgt, 'protoconch_plasma') ? 1.25 : 1 }); if (!c.tgt.ko) plasma(c.b, c.u, c.tgt, 2); } });

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
defMove({ id: 'smallgranw_today', name: 'Is It Today', type: 'BEAST', owner: 'smallgranw', reach: 'single', cd: 0, fx: 'lunge | claw', text: 'Hits for 110% ATK. Her next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); c.hasten(c.u, 20); } });
defMove({ id: 'smallgranw_scratch', name: 'Don\'t Scratch', type: 'BEAST', owner: 'smallgranw', reach: 'self', cd: 0, fx: 'shake | sparkle self', text: 'Removes her bad statuses. Fortify 2. Heals 10% of her max HP.',
  run(c) { c.cleanse(c.u); c.st(c.u, 'fortify', 2); c.heal(c.u, c.u.maxHp * 0.1); } });
defMove({ id: 'smallgranw_feel', name: 'I Can Feel It', type: 'BEAST', owner: 'smallgranw', reach: 'self', cd: 0, fx: 'swell | ring self', text: '1 tide. Empower 2.',
  run(c) { c.nerve(c.me, 1); c.st(c.u, 'empower', 2); } });
defMove({ id: 'smallgranw_look', name: 'Don\'t Look Yet', type: 'BEAST', owner: 'smallgranw', reach: 'single', cd: 0, fx: 'sway | hoop line | daze', text: 'Slow 1 on the foe. Ward 1 on herself.',
  run(c) { c.st(c.u, 'ward', 1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'smallgranw_there', name: 'There It Goes', type: 'BEAST', owner: 'smallgranw', reach: 'spread', cd: 5, nerve: 4, fx: 'lunge big | slash all big', text: 'Hits for 150% ATK. Splash 35%. Heals 20% of her max HP.',
  run(c) { c.spread({ atk: 1.5 }); c.heal(c.u, c.u.maxHp * 0.2); } });

// ================================================================ notions

defNotion({ id: 'seapebble', name: 'Sea Pebble', price: 500, text: '+6% HP and +6% RES.', pct: { hp: 0.06, res: 0.06 } });
defNotion({ id: 'sieve', name: 'Sieve', price: 600, text: 'The first hit it takes each battle deals 0.5x damage.',
  beforeTake(b, f, src, amt, d) { if (f.k.sieved || d.dot || !src) return amt; f.k.sieved = 1; msg(b, 'The sieve catches some of the blow.'); return amt * 0.5; } });
defNotion({ id: 'glazecoat', name: 'Glaze Coat', price: 600, text: '+13% RES. The first bad status put on it each battle is removed at once.', pct: { res: 0.13 },
  afterGet(b, f, src, id) { if (f.k.glazeCoat || !BADS.includes(id as StatusId)) return; f.k.glazeCoat = 1; delete f.s[id as StatusId]; msg(b, 'It slips off glaze.'); } });
defNotion({ id: 'saltboots', name: 'Salt Boots', price: 500, text: '+12% DEF. The first crest to hit it each battle deals 0.5x damage.', pct: { def: 0.12 },
  beforeTake(b, f, src, amt, d) { if (f.k.booted || !d.move?.nerve) return amt; f.k.booted = 1; return amt * 0.5; } });
defNotion({ id: 'climbingchalk', name: 'Climbing Chalk', price: 600, text: '+7% ATK. Cannot be forced out or dragged in.', pct: { atk: 0.07 },
  immovable() { return true; } });

/** Notion ids for the lead to add to NOTION_IDS. */
export const NOTIONS5 = ['seapebble', 'sieve', 'glazecoat', 'saltboots', 'climbingchalk'];
