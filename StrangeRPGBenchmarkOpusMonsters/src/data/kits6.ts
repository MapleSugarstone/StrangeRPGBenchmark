import {
  addNerve, applyStatus, banish, cameOutSince, canSwitch, cleanse, clearForm, dealDamage, delayFighter, disguise, dismiss, doSwitch, emit, foeOf,
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

// laminaria: kelp that raises Kelp Arms to slam with its moves, slaps, sways, holds a foe, and raises three at once.
defSummon({ id: 'laminaria_tentacle', name: 'Kelp Arm', owner: 'laminaria', text: 'Hits the foe when Konleva uses a damaging move. 6 turns.', every: 100,
  sprite: { px: ['..2.....', '..22....', '...22...', '..2232..', '...22...', '..222...', '..4444..', '.444444.'], c: ['#726230', '#dea734', '#49392f'] },
  act() { /* an arm slams only with Laminaria */ } });
const arms = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'laminaria_tentacle');
function slam(b: Battle, f: Fighter, t: Fighter, share: number): void {
  for (const a of arms(b, f)) { if (!live(t)) return; strike(b, f, t, stat(b, f, 'atk') * share, 'P', 'ROOT'); if (has(f, 'laminaria_undertide')) heal(b, f, f, f.maxHp * 0.02); void a; }
}
defMark({ id: 'laminaria_spirit', name: 'held', clock: 'own', negative: true, value: -0.12,
  afterTake(b, f, src, dealt, d) { const mk = f.m.laminaria_spirit; const by = mk ? markedBy(b, mk) : null; if (by && live(by) && !d.dot) heal(b, by, by, dealt * 0.2); },
  turnStart(b, f) { const mk = f.m.laminaria_spirit; const by = mk ? markedBy(b, mk) : null; if (by && live(by)) slam(b, by, f, 0.3); } });
defPassive({ id: 'laminaria_standsup', name: 'Stands Up', owner: 'laminaria', text: 'Every 3rd turn: summons a Kelp Arm (8% max HP, 6 turns), up to 3. When it uses a damaging move: each Arm hits the foe for 30% ATK.',
  turnStart(b, f) { f.k.armT = (f.k.armT || 0) + 1; if (f.k.armT % 3 === 0 && arms(b, f).length < 3) summon(b, f, 'laminaria_tentacle', { hp: 0.08, turns: 6 }); },
  afterMove(b, f) { const t = foe(b, f); if (t && f.k.dealt) slam(b, f, t, 0.3); } });
defPassive({ id: 'laminaria_undertide', name: 'Undertide', owner: 'laminaria', text: 'Each Kelp Arm hit heals it 2% of its max HP. Damage a Held foe takes heals it 20% of that damage.' });
defMove({ id: 'laminaria_frond', name: 'Frond Slap', type: 'ROOT', owner: 'laminaria', reach: 'single', cd: 1, text: 'Hits for 83% ATK. Slow 1. Summons a Kelp Arm if it has none.',
  run(c) { if (!arms(c.b, c.u).length) summon(c.b, c.u, 'laminaria_tentacle', { hp: 0.08, turns: 6 }); c.hit(c.tgt, { atk: 0.83 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'laminaria_sway', name: 'Blade Sway', type: 'ROOT', owner: 'laminaria', reach: 'single', cd: 3, text: 'Hits for 75% ATK. Each Kelp Arm hits for 35% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); if (!c.tgt.ko) slam(c.b, c.u, c.tgt, 0.35); } });
defMove({ id: 'laminaria_shed', name: 'Shed Water', type: 'ROOT', owner: 'laminaria', reach: 'single', cd: 4, text: 'Hits for 42% ATK. Held for 3 turns: at each of the foe\'s turns, every Kelp Arm hits it for 30% ATK.',
  run(c) { c.hit(c.tgt, { atk: 0.42 }); if (!c.tgt.ko) c.mark(c.tgt, 'laminaria_spirit', 1, 3); } });
defMove({ id: 'laminaria_ebbblade', name: 'Ebb Blade', type: 'ROOT', owner: 'laminaria', reach: 'spread', tags: ['dash'], cd: 6, nerve: 5, text: 'Hits every foe for 83% ATK. Slow 1. Summons 3 Kelp Arms.',
  run(c) { c.spread({ atk: 0.83 }); c.st(c.tgt, 'slow', 1); for (let i = 0; i < 3; i++) summon(c.b, c.u, 'laminaria_tentacle', { hp: 0.08, turns: 6 }); } });

// eelgrass: a sea meadow that dusts foes with Dream Dust, combs through, sways over, rolls a seed, and lulls the dusted to sleep.
defMark({ id: 'eelgrass_dust', name: 'dream dust', clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.eelgrass_dust; const by = mk ? markedBy(b, mk) : null; dealDamage(b, by && live(by) ? by : null, f, f.maxHp * 0.03, dot('M'), null); } });
defMark({ id: 'eelgrass_drowsy', name: 'drowsy', clock: 'own', negative: true, value: -0.15,
  expire(b, f, mk) { applyStatus(b, markedBy(b, mk), f, 'sleep', 2); } });
defPassive({ id: 'eelgrass_flat', name: 'Lies Flat', owner: 'eelgrass', text: 'Its hits add Dream Dust: 3% of max HP a turn for 3 turns.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side && !t.ko) mark(b, f, t, 'eelgrass_dust', 1, 3); } });
defPassive({ id: 'eelgrass_bed', name: 'Meadow Bed', owner: 'eelgrass', text: 'Takes 0.8x damage from attacks. Attackers get Slow 1.',
  inMul(b, f, src, d) { return d.attack ? 0.8 : 1; },
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src.side !== f.side && !src.ko) applyStatus(b, f, src, 'slow', 1); } });
defMove({ id: 'eelgrass_comb', name: 'Comb Through', type: 'ROOT', owner: 'eelgrass', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 55% MGK. Heals 15% of it. Haste 1.',
  run(c) { const d = c.spread({ mgk: 0.55 }); c.heal(c.u, d * 0.15); c.st(c.u, 'haste', 1); } });
defMove({ id: 'eelgrass_sway', name: 'Sway Over', type: 'ROOT', owner: 'eelgrass', reach: 'single', tags: ['dash', 'spell'], cd: 3, wu: 40, text: 'Short wind-up. Hits for 116% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.16 }); } });
defMove({ id: 'eelgrass_mend', name: 'Meadow Seed', type: 'ROOT', owner: 'eelgrass', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 62% MGK. Slow 2. The first reserve takes 40% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.62 }); c.st(c.tgt, 'slow', 2); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.62 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'eelgrass_farreach', name: 'Lull Over', type: 'ROOT', owner: 'eelgrass', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Each foe with Dream Dust gets Sleep 2 after its next turn. Slow 2 on the foe.',
  run(c) { for (const e of standing(c.them)) if (marked(e, 'eelgrass_dust')) c.mark(e, 'eelgrass_drowsy', 1, 1); c.st(c.tgt, 'slow', 2); } });

// grenadier: a deep fish that haunts foes, bites, rakes, lures a foe up, and lets the pressure drop on all of them.
defMark({ id: 'grenadier_haunt', name: 'haunted', clock: 'own', negative: true, volatile: true, value: -0.08 });
defPassive({ id: 'grenadier_scent', name: 'Deep Scent', owner: 'grenadier', text: 'Deals 1.25x damage to a Haunted foe.',
  outMul(b, f, t) { return marked(t, 'grenadier_haunt') ? 1.25 : 1; } });
defPassive({ id: 'grenadier_surface', name: 'Up From Deep', owner: 'grenadier', text: 'When a foe is KO\'d while it is out: heals 12% of its max HP.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) heal(b, f, f, f.maxHp * 0.12); } });
defMove({ id: 'grenadier_bite', name: 'Long Bite', type: 'BEAST', owner: 'grenadier', reach: 'single', cd: 1, text: 'Hits for 149% ATK. On a Haunted foe: Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.49 }); if (marked(c.tgt, 'grenadier_haunt')) c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'grenadier_rake', name: 'Deep Rake', type: 'BEAST', owner: 'grenadier', reach: 'single', tags: ['projectile'], cd: 3, text: 'Hits for 109% ATK. Expose 1. Haunted for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.09 }); c.st(c.tgt, 'expose', 1); if (!c.tgt.ko) c.mark(c.tgt, 'grenadier_haunt', 1, 3); } });
defMove({ id: 'grenadier_lure', name: 'Lure Up', type: 'BEAST', owner: 'grenadier', reach: 'single', cd: 4, text: 'Hits for 82% ATK. Root 2. Silence 1.',
  run(c) { c.hit(c.tgt, { atk: 0.82 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'silence', 1); } });
defMove({ id: 'grenadier_drop', name: 'Pressure Drop', type: 'BEAST', owner: 'grenadier', reach: 'spread', cd: 6, nerve: 5, text: 'Hits every foe for 136% ATK. Every foe: Haunted 3 turns and Rot 2.',
  run(c) { c.spread({ atk: 1.36 }); for (const e of standing(c.them)) { c.mark(e, 'grenadier_haunt', 1, 3); c.st(e, 'rot', 2); } } });

// asterias: a starfish that acts quickly, regrows arms, fires from two and then five, shifts away, and drops a volley from the sky.
defMark({ id: 'asterias_legend', name: 'locked on', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { unmark(f, 'asterias_legend'); const t = foe(b, f); for (let i = 0; i < 4 && t && live(t); i++) strike(b, f, t, stat(b, f, 'mgk') * 0.3, 'M', 'STAR'); } });
defPassive({ id: 'asterias_arms', name: 'Many Arms', owner: 'asterias', text: 'Its turns come 10% sooner.',
  turnEnd(b, f) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); } });
defPassive({ id: 'asterias_regrow', name: 'Regrows Arms', owner: 'asterias', text: 'Every 3rd turn: heals 8% of its max HP.',
  turnStart(b, f) { f.k.regrow = (f.k.regrow || 0) + 1; if (f.k.regrow % 3 === 0) heal(b, f, f, f.maxHp * 0.08); } });
defMove({ id: 'asterias_barrage', name: 'Arm Barrage', type: 'STAR', owner: 'asterias', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits 2 times for 57% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.57 }); if (!c.tgt.ko) c.hit(c.tgt, { mgk: 0.57 }); } });
defMove({ id: 'asterias_five', name: 'Point Five', type: 'STAR', owner: 'asterias', reach: 'spread', tags: ['projectile', 'spell'], cd: 3, text: 'Hits every foe for 77% MGK. Slow 1.',
  run(c) { c.spread({ mgk: 0.77 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'asterias_homing', name: 'Star Shift', type: 'STAR', owner: 'asterias', reach: 'self', tags: ['dash'], cd: 4, wt: 50, text: 'Hidden 1. Its next turn comes 30% sooner.',
  run(c) { c.st(c.u, 'hidden', 1); c.hasten(c.u, 30); } });
defMove({ id: 'asterias_skydrop', name: 'Falling Arms', type: 'STAR', owner: 'asterias', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 5, text: 'Hits 4 times for 31% MGK, and 4 more at its next turn.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.31 }); c.mark(c.u, 'asterias_legend', 1, 2); } });

// cirrus: a loose nautilus arm that gathers Grips, slaps, lifts an ally in, reaches for a reserve, and wraps a foe up.
defMark({ id: 'cirrus_box', name: 'wrapped up', clock: 'own', volatile: true, negative: true, value: -0.15,
  forbid(b, f, what) { return what === 'switch' ? 'Boxed in.' : null; } });
defPassive({ id: 'cirrus_suckers', name: 'Suckers', owner: 'cirrus', text: 'When a foe is KO\'d, and every 3rd hit: a Grip, max 10. +2% DEF and MGK each.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.souls = Math.min(10, (f.k.souls || 0) + 1); },
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; f.k.reap = (f.k.reap || 0) + 1; if (f.k.reap % 3 === 0) f.k.souls = Math.min(10, (f.k.souls || 0) + 1); },
  statBonus(f, k) { return k === 'def' || k === 'mgk' ? Math.round(f.st[k] * 0.02 * (f.k.souls || 0)) : 0; } });
defPassive({ id: 'cirrus_reaching', name: 'Keeps Reaching', owner: 'cirrus', text: 'Deals 1.2x damage to a Rooted foe.',
  outMul(b, f, t) { return t.s.root ? 1.2 : 1; } });
defMove({ id: 'cirrus_slap', name: 'Sucker Slap', type: 'BEAST', owner: 'cirrus', reach: 'single', cd: 1, text: 'Hits for 136% ATK. Delays the foe\'s next turn by 30%.',
  run(c) { c.hit(c.tgt, { atk: 1.36 }); c.delay(c.tgt, 30); } });
defMove({ id: 'cirrus_cling', name: 'Cling On', type: 'BEAST', owner: 'cirrus', reach: 'reserveAlly', cd: 4, tag: true, text: 'Switches to an ally with a shield of 15% max HP + 15% CHA.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.15 + c.cha(0.15), 3); } });
defMove({ id: 'cirrus_reach', name: 'Long Reach', type: 'BEAST', owner: 'cirrus', reach: 'dragin', tags: ['projectile'], cd: 3, text: 'Drags in a reserve. Hits it for 115% ATK. Root 2.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { atk: 1.15 }); c.st(t, 'root', 2); } });
defMove({ id: 'cirrus_wrap', name: 'Wrap Around', type: 'BEAST', owner: 'cirrus', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 156% ATK. Slow 2. The foe can\'t switch for 3 turns.',
  run(c) { c.hit(c.tgt, { atk: 1.56 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'cirrus_box', 1, 3); } });

// hyponome: a breath of jet that rides in its own shell, squirts, pushes off, eats shots, and bursts the shell.
defSummon({ id: 'hyponome_mech', name: 'Jet Shell', owner: 'hyponome', sprite: { px: ['........', '..2222..', '.222222.', '22.33.22', '22333322', '22222222', '444..444', '.44..44.'], c: ['#ebe3db', '#96c6dd', '#4a78a7'] }, text: 'Takes single-target hits meant for Puhalki. When a hit breaks it, the rest of the damage goes to Puhalki, and Puhalki gets Haste 2.', guard: true, spill: true, lasting: false,
  gone(b, s, f) { if (!f || f.ko || f.k.stowing) return; if (s.hp <= 0) { msg(b, `${label(b, f)} is thrown clear of its shell.`); applyStatus(b, f, f, 'haste', 2); } } });
const inMech = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'hyponome_mech').length > 0;
defMark({ id: 'hyponome_matrix', name: 'breathing out', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('projectile')) return null; unmark(f, 'hyponome_matrix'); return 'block'; } });
defPassive({ id: 'hyponome_ebbpull', name: 'Ebb Pull', owner: 'hyponome', text: 'When it comes out: rides a Jet Shell (25% max HP). A broken shell stays broken. One per side.',
  comeOut(b, f) { if (!f.k.shellLeft && f.k.shellLeft !== undefined) return; const s = sk(b, f.side); if (s.shellBy && s.shellBy !== f.mon.uid + 1) return; s.shellBy = f.mon.uid + 1; summon(b, f, 'hyponome_mech', { hp: f.k.shellLeft ? f.k.shellLeft / 100 : 0.25 }); },
  leave(b, f) { const m = summonsOf(b, f.side, 'hyponome_mech')[0]; f.k.shellLeft = m ? Math.max(1, Math.round(100 * m.hp / f.maxHp)) : 0; f.k.stowing = 1; if (m) dismiss(b, m); f.k.stowing = 0; } });
defPassive({ id: 'hyponome_breath', name: 'Jet Breath', owner: 'hyponome', text: 'With no Jet Shell: deals 1.2x damage and its turns come 10% sooner.',
  outMul(b, f) { return inMech(b, f) ? 1 : 1.2; },
  turnEnd(b, f) { if (!inMech(b, f)) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); } } });
defMove({ id: 'hyponome_squirt', name: 'Squirt', type: 'TIDE', owner: 'hyponome', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits 3 times for 28% MGK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.28 }); } });
defMove({ id: 'hyponome_pushoff', name: 'Push Off', type: 'TIDE', owner: 'hyponome', reach: 'single', tags: ['dash', 'spell'], cd: 4, text: 'Hits for 58% MGK. Forces the foe out.',
  run(c) { c.hit(c.tgt, { mgk: 0.58 }); if (!c.tgt.ko) c.forceOut(); } });
defMove({ id: 'hyponome_exhale', name: 'Exhale', type: 'TIDE', owner: 'hyponome', reach: 'self', cd: 3, wt: 50, text: 'Blocks the next projectile move at its side before its next turn.',
  run(c) { c.mark(c.u, 'hyponome_matrix', 1, 2); } });
defMove({ id: 'hyponome_jet', name: 'Full Jet', type: 'TIDE', owner: 'hyponome', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 60, text: 'Wind-up. Breaks its Jet Shell: every foe takes 110% MGK, up to 190% at full shell HP. With no shell: summons a new one.',
  run(c) {
    const m = summonsOf(c.b, c.u.side, 'hyponome_mech')[0];
    if (!m) { summon(c.b, c.u, 'hyponome_mech', { hp: 0.25 }); c.msg(`${label(c.b, c.u)} grows a new shell.`); return; }
    const p = m.hp / m.maxHp;
    c.u.k.stowing = 1; dismiss(c.b, m); c.u.k.stowing = 0;
    c.spread({ mgk: 1.1 + 0.8 * p });
  } });

// slackwater: the still minute that locks every fourth hit, laps back what it lost, slackens a foe, holds still, and stops time.
defMark({ id: 'slackwater_back', name: 'holding still', clock: 'own', volatile: true, value: 0.1,
  beforeTake(b, f, src, amt, d) { if (d.dot || !src || src.side === f.side) return amt; unmark(f, 'slackwater_back'); msg(b, `${label(b, f)} was never there.`); return 0; } });
defMark({ id: 'slackwater_dilate', name: 'slackened', clock: 'own', negative: true, volatile: true, value: -0.1,
  cooldown(b, f, m, cd) { return cd + 1; } });
defPassive({ id: 'slackwater_turn', name: 'Turn of Tide', owner: 'slackwater', text: 'Every 4th hit it lands: also hits for 65% MGK. Delays the foe\'s next turn 40%.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || f.k.locking) return; f.k.lock = (f.k.lock || 0) + 1; if (f.k.lock % 4 !== 0) return; f.k.locking = 1; strike(b, f, t, stat(b, f, 'mgk') * 0.65, 'M', 'TIDE'); delayFighter(b, t, 40); f.k.locking = 0; },
  afterTake(b, f, src, dealt, d) { f.k.lastHurt = (f.k.lastHurtAt === b.turnNo || f.k.lastHurtAt === b.turnNo - 1 ? f.k.lastHurt || 0 : 0) + dealt; f.k.lastHurtAt = b.turnNo; } });
defPassive({ id: 'slackwater_unhurried', name: 'Unhurried', owner: 'slackwater', text: 'Cannot be delayed. Takes 0.85x damage.',
  noDelay() { return true; },
  inMul() { return 0.85; } });
defMove({ id: 'slackwater_lap', name: 'Still Lap', type: 'TIDE', owner: 'slackwater', reach: 'single', tags: ['dash', 'spell'], cd: 2, text: 'Hits for 105% MGK. Heals 50% of the damage it took in its last turn.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); if ((c.u.k.lastHurtAt || -9) >= c.b.turnNo - 2) c.heal(c.u, (c.u.k.lastHurt || 0) * 0.5); c.u.k.lastHurt = 0; } });
defMove({ id: 'slackwater_slacken', name: 'Slacken', type: 'TIDE', owner: 'slackwater', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 60% MGK. Slow 2. 3 turns: the foe\'s cooldowns grow 1 more.',
  run(c) { c.hit(c.tgt, { mgk: 0.6 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'slackwater_dilate', 1, 3); } });
defMove({ id: 'slackwater_hold', name: 'Hold Still', type: 'TIDE', owner: 'slackwater', reach: 'self', cd: 4, wt: 50, text: 'Blocks the next hit on it before its next turn.',
  run(c) { c.mark(c.u, 'slackwater_back', 1, 2); } });
defMove({ id: 'slackwater_minute', name: 'Still Minute', type: 'TIDE', owner: 'slackwater', reach: 'single', tags: ['spell'], cd: 7, nerve: 6, text: 'Hits for 50% MGK. Stun 2. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); c.st(c.tgt, 'stun', 2); c.hasten(c.u, 30); } });

// brinicle: a brinicle that freezes what it KOs into thralls, drips, rings in ice, lays a line, and entombs a foe or itself.
defSummon({ id: 'brinicle_thrall', name: 'Frozen Thrall', owner: 'brinicle', sprite: { px: ['........', '..2222..', '.223322.', '.224422.', '.222222.', '4.2222.4', '..2..2..', '.22..22.'], c: ['#9ea6ae', '#8ed5ff', '#354573'] }, text: 'Stays until a foe comes out. Hits it for 60% of Soryubi\'s MGK. Slow 2. Stays if Soryubi falls.', lasting: true,
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, 'A frozen thrall bursts.'); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.6, 'M', 'SALT'); if (!who.ko) applyStatus(b, f, who, 'slow', 2); return true; } });
defPassive({ id: 'brinicle_finger', name: 'Frost Finger', owner: 'brinicle', text: 'When it KOs a foe: a Frozen Thrall (10% max HP) waits for the next foe out.',
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side) summon(b, f, 'brinicle_thrall', { hp: 0.1 }); } });
defPassive({ id: 'brinicle_comfort', name: 'Cold Comfort', owner: 'brinicle', text: 'Turn start: heals 4% of its max HP while the foe is Slowed or Rooted.',
  turnStart(b, f) { const t = foe(b, f); if (t && (t.s.slow || t.s.root)) heal(b, f, f, f.maxHp * 0.04); } });
defMove({ id: 'brinicle_drip', name: 'Cold Drip', type: 'SALT', owner: 'brinicle', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 90% MGK. Slow 1. The first reserve takes 35% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); c.st(c.tgt, 'slow', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.9 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'brinicle_spray', name: 'Brine Ring', type: 'SALT', owner: 'brinicle', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 59% MGK. Root 1.',
  run(c) { c.spread({ mgk: 0.59 }); c.st(c.tgt, 'root', 1); } });
defMove({ id: 'brinicle_line', name: 'Freeze Line', type: 'SALT', owner: 'brinicle', reach: 'single', tags: ['spell'], cd: 3, tag: true, text: 'Hits for 59% MGK. Slow 1. Switches out.',
  run(c) { c.hit(c.tgt, { mgk: 0.59 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'brinicle_floor', name: 'Sea Floor', type: 'SALT', owner: 'brinicle', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 82% MGK. Stun 2. If it is below 35% HP, instead: heals 30% of its max HP, Stasis 1, Slow 2 on the foe.',
  run(c) {
    if (c.u.hp < c.u.maxHp * 0.35) { c.heal(c.u, c.u.maxHp * 0.3); c.st(c.u, 'stasis', 1); c.st(c.tgt, 'slow', 2); return; }
    c.hit(c.tgt, { mgk: 0.82 }); c.st(c.tgt, 'stun', 2);
  } });

// transit: a kept night that hits the lonely harder, sends a late spark, stills its field, and plays itself back as a double.
defSummon({ id: 'transit_spark', name: 'Late Spark', owner: 'transit', sprite: { px: ['........', '...3....', '.3.2.3..', '..222...', '.3.2.3..', '...3....', '....4...', '........'], c: ['#dff7fe', '#4f97dd', '#2e4a88'] }, text: 'Waits a turn, then hits the foe for 210% of Yliri\'s MGK.', every: 200,
  act(b, s, f) { const t = foeOut(b, s); if (f && t) strike(b, f, t, stat(b, f, 'mgk') * 2.1, 'M', 'STAR'); } });
defSummon({ id: 'transit_double', name: 'Second Showing', owner: 'transit', text: 'A second Yliri with its own HP. On its own turns it uses Yliri\'s moves, except the crest.', every: 100,
  sprite: { px: ['3.3..3.3', '.3.22.3.', '..2222..', '.232232.', '4.2222.4', '4.2222.4', '44.22.44', '.4....4.'], c: ['#80b0df', '#c4e4f4', '#495997'] } });
defPassive({ id: 'transit_lonely', name: 'Lonely Star', owner: 'transit', text: 'Deals 1.25x damage to a foe with 1 reserve or none.',
  outMul(b, f, t) { return reserves(b.s[t.side]).length <= 1 ? 1.25 : 1; } });
defPassive({ id: 'transit_showing', name: 'First Showing', owner: 'transit', text: 'When it comes out: its first move repeats at 0.6x.',
  comeOut(b, f) { f.k.showing = 1; },
  afterMove(b, f, m) { if (!f.k.showing) return; f.k.showing = 0; playBack(b, f, m, 0.6); } });
defMove({ id: 'transit_cross', name: 'Cross Over', type: 'STAR', owner: 'transit', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 155% MGK. Slow 1 on a foe with no reserves.',
  run(c) { c.hit(c.tgt, { mgk: 1.55 }); if (!reserves(c.them).length) c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'transit_late', name: 'Late Light', type: 'STAR', owner: 'transit', reach: 'side', cd: 3, text: 'Summons a Late Spark (12% max HP). After 1 turn it hits the foe for 210% MGK.',
  run(c) { summon(c.b, c.u, 'transit_spark', { hp: 0.12, turns: 1 }); } });
defMove({ id: 'transit_eclipse', name: 'Still Field', type: 'STAR', owner: 'transit', reach: 'self', cd: 4, wt: 60, text: '2 turns: takes 0.6x damage from attacks. Haste 1.',
  run(c) { c.mark(c.u, 'transit_field', 1, 2); c.st(c.u, 'haste', 1); } });
defMark({ id: 'transit_field', name: 'in a still field', clock: 'own', volatile: true, value: 0.1,
  inMul(b, f, src, d) { return d.attack ? 0.6 : 1; } });
defMove({ id: 'transit_double', name: 'Played Back', type: 'STAR', owner: 'transit', reach: 'side', cd: 6, nerve: 5, text: 'Summons a Second Showing (35% max HP, 3 turns). It uses Yliri\'s moves too, except the crest.',
  run(c) { summonTwin(c.b, c.u, 'transit_double', { hp: 0.35, turns: 3 }); } });

// ================================================================ the old chambers

// ballast: ballast stones that store Weight from hits on their Barriers, drop stones, sink a friend's room, and hold everything down.
function charge(b: Battle, f: Fighter, amt: number): void { f.k.energy = Math.min(100, (f.k.energy || 0) + Math.round(amt / f.maxHp * 250)); }
defMark({ id: 'ballast_barrier', name: 'barrier', clock: 'own', value: 0.08,
  beforeTake(b, f, src, amt) { const mk = f.m.ballast_barrier; const by = mk ? markedBy(b, mk) : null; if (by && live(by) && f.shield > 0) charge(b, by, Math.min(amt, f.shield)); return amt; } });
defMark({ id: 'ballast_surge', name: 'in the surge', clock: 'own', volatile: true, negative: true, value: -0.15,
  forbid(b, f, what) { return what === 'switch' ? 'Held in the surge.' : null; } });
defPassive({ id: 'ballast_sinking', name: 'Sinking', owner: 'ballast', text: 'Hits on its Barriers add Weight, up to 100. Each 10 Weight: +5% damage. Loses 5 Weight each turn.',
  outMul(b, f) { return 1 + 0.005 * (f.k.energy || 0); },
  turnStart(b, f) { f.k.energy = Math.max(0, (f.k.energy || 0) - 5); } });
defPassive({ id: 'ballast_ballasted', name: 'Ballasted', owner: 'ballast', text: 'Cannot be forced out, dragged in, or Slowed.',
  immovable() { return true; },
  statusImmune(f, id) { return id === 'slow'; } });
defMove({ id: 'ballast_drop', name: 'Drop Stone', type: 'GEAR', owner: 'ballast', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 150% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.5 }); } });
defMove({ id: 'ballast_storm', name: 'Storm Stone', type: 'GEAR', owner: 'ballast', reach: 'self', cd: 3, wt: 50, text: 'A Barrier on itself: 20% max HP shield, 2 turns.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.2, 2); c.mark(c.u, 'ballast_barrier', 1, 2); } });
defMove({ id: 'ballast_room', name: 'Sink Room', type: 'GEAR', owner: 'ballast', reach: 'ally', cd: 3, text: 'A Barrier on an ally: 14% max HP shield, 2 turns.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.14, 2); c.mark(c.ally!, 'ballast_barrier', 1, 2); } });
defMove({ id: 'ballast_hold', name: 'Full Hold', type: 'GEAR', owner: 'ballast', reach: 'spread', cd: 6, nerve: 5, wu: 50, text: 'Wind-up. Hits every foe for 120% ATK. Slow 2. Root 2. +30 Weight.',
  run(c) { c.spread({ atk: 1.2 }); c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'root', 2); c.u.k.energy = Math.min(100, (c.u.k.energy || 0) + 30); } });

// sluice: a gate that stuns what comes through, charges a friend's shell, pulls a reserve out, rushes a friend, and swaps a foe against itself.
defMark({ id: 'sluice_shell', name: 'charged shell', clock: 'own', value: 0.1,
  turnStart(b, f) { const mk = f.m.sluice_shell; const by = mk ? markedBy(b, mk) : null; const t = foe(b, f); if (by && live(by) && t) strike(b, by, t, stat(b, by, 'mgk') * 0.35, 'M', 'GEAR'); } });
defMark({ id: 'sluice_replica', name: 'facing itself', clock: 'own', negative: true, value: -0.15,
  turnStart(b, f) { const mk = f.m.sluice_replica; const by = mk ? markedBy(b, mk) : null; const p = Math.max(stat(b, f, 'atk'), stat(b, f, 'mgk')); msg(b, `${label(b, f)} meets itself in the gate.`); strike(b, by && live(by) ? by : null, f, p * 0.4, 'M', null); } });
defPassive({ id: 'sluice_oneway', name: 'One Way', owner: 'sluice', text: 'Its first hit on a foe that came out since its last turn: Stun 1.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || t.ko) return; if (t.outAt > (f.k.prevTurn ?? -1) && t.k.punchedAt !== t.outAt) { t.k.punchedAt = t.outAt; applyStatus(b, f, t, 'stun', 1); } } });
defPassive({ id: 'sluice_floodgate', name: 'Floodgate', owner: 'sluice', text: 'Deals 1.15x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return t.outAt > (f.k.prevTurn ?? -1) ? 1.15 : 1; } });
defMove({ id: 'sluice_slap', name: 'Gate Slap', type: 'GEAR', owner: 'sluice', reach: 'ally', cd: 2, text: 'An ally gets a Charged Shell for 3 turns: at each of the ally\'s turns, the foe takes 35% MGK.',
  run(c) { c.mark(c.ally!, 'sluice_shell', 1, 3); } });
defMove({ id: 'sluice_backflow', name: 'Back Flow', type: 'GEAR', owner: 'sluice', reach: 'dragin', tags: ['spell'], cd: 3, text: 'Drags in a reserve. Hits it for 69% MGK. Slow 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 0.69 }); c.st(t, 'slow', 1); } });
defMove({ id: 'sluice_bolt', name: 'Gate Bolt', type: 'GEAR', owner: 'sluice', reach: 'ally', cd: 3, text: 'An ally: Haste 2. Its next turn comes 30% sooner.',
  run(c) { c.st(c.ally!, 'haste', 2); c.hasten(c.ally!, 30); } });
defMove({ id: 'sluice_swap', name: 'Swap Rooms', type: 'GEAR', owner: 'sluice', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 79% MGK. For 3 turns: at each of its turns, the foe takes 40% of its own ATK or MGK, whichever is higher.',
  run(c) { c.hit(c.tgt, { mgk: 0.79 }); if (!c.tgt.ko) c.mark(c.tgt, 'sluice_replica', 1, 3); } });

// septum: a chamber wall that bites strength away, keeps a cold room, seals a foe in, and drops its guard.
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
defPassive({ id: 'septum_behind', name: 'Seals Behind', owner: 'septum', text: 'When a foe is KO\'d while it is out: heals 8% of its max HP.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) heal(b, f, f, f.maxHp * 0.08); } });
defPassive({ id: 'septum_bulkhead', name: 'Bulkhead', owner: 'septum', text: 'Takes 0.8x damage from a foe that can\'t switch.',
  inMul(b, f, src) { return src && src.side !== f.side && !canSwitch(b, src) ? 0.8 : 1; } });
defMove({ id: 'septum_slam', name: 'Wall Slam', type: 'STONE', owner: 'septum', reach: 'single', cd: 1, text: 'Hits for 124% ATK. 3 turns: takes 8% of the foe\'s ATK for itself.',
  run(c) { c.hit(c.tgt, { atk: 1.24 }); if (!c.tgt.ko) { c.mark(c.tgt, 'septum_chomped', 1, 3); c.mark(c.u, 'septum_fed', 1, 3); } } });
defMove({ id: 'septum_knock', name: 'Chamber Knock', type: 'STONE', owner: 'septum', reach: 'self', cd: 3, wt: 60, text: 'Haste 2. 3 turns: heals 4% of its max HP a turn.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.u, 'septum_domain', 1, 3); } });
defMove({ id: 'septum_seal', name: 'Seal Room', type: 'STONE', owner: 'septum', reach: 'single', cd: 3, text: 'The foe can\'t switch for 3 turns. Slow 2.',
  run(c) { if (c.mark(c.tgt, 'septum_sealed', 1, 3)) c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'septum_shot', name: 'Seal Shot', type: 'STONE', owner: 'septum', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 118% ATK. Heals 15% of its max HP. 3 turns: the foe has 0.8x DEF and RES.',
  run(c) { c.hit(c.tgt, { atk: 1.18 }); c.heal(c.u, c.u.maxHp * 0.15); if (!c.tgt.ko) c.mark(c.tgt, 'septum_subdued', 1, 3); } });

// vacuole: old air that hits and delays with every attack, thins a foe out, wraps a friend in good air, and walls everyone in calm.
defMark({ id: 'vacuole_discord', name: 'thinned', clock: 'own', negative: true, value: -0.1,
  inMul() { return 1.25; } });
defMark({ id: 'vacuole_harmony', name: 'good air', clock: 'own', value: 0.08,
  turnStart(b, f) { const mk = f.m.vacuole_harmony; const by = mk ? markedBy(b, mk) : null; heal(b, by, f, f.maxHp * 0.06); },
  reserveTurn(b, f) { const mk = f.m.vacuole_harmony; const by = mk ? markedBy(b, mk) : null; heal(b, by, f, f.maxHp * 0.03); } });
defMark({ id: 'vacuole_calm', name: 'calm', clock: 'own', volatile: true, value: 0.2,
  turnStart(b, f) { for (const a of standing(b.s[f.side])) heal(b, f, a, a.maxHp * 0.08); } });
defPassive({ id: 'vacuole_thin', name: 'Thin Air', owner: 'vacuole', text: 'Its attacks deal 1.25x and delay the foe\'s next turn by 15%.',
  outMul(b, f, t, d) { return d.attack ? 1.25 : 1; },
  afterAttack(b, f, t) { if (live(t)) delayFighter(b, t, 15); } });
defPassive({ id: 'vacuole_airless', name: 'Airless', owner: 'vacuole', text: 'Deals 1.2x damage to a foe whose side has no tide.',
  outMul(b, f, t) { return b.s[t.side].nerve <= 0 ? 1.2 : 1; } });
defMove({ id: 'vacuole_old', name: 'Old Air', type: 'VOID', owner: 'vacuole', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 135% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.35 }); } });
defMove({ id: 'vacuole_vacuum', name: 'Thin Out', type: 'VOID', owner: 'vacuole', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 57% MGK. 3 turns: the foe takes 1.25x damage.',
  run(c) { c.mark(c.tgt, 'vacuole_discord', 1, 3); c.hit(c.tgt, { mgk: 0.57 }); } });
defMove({ id: 'vacuole_shell', name: 'Air Shell', type: 'VOID', owner: 'vacuole', reach: 'ally', cd: 3, text: 'An ally heals 6% of max HP a turn for 3 turns, 3% in reserve.',
  run(c) { c.mark(c.ally!, 'vacuole_harmony', 1, 3); } });
defMove({ id: 'vacuole_wall', name: 'Wall of Air', type: 'VOID', owner: 'vacuole', reach: 'team', cd: 7, nerve: 5, text: 'Untouchable 1. Your team heals 8% of max HP now and at its next 2 turns.',
  run(c) { c.st(c.u, 'invuln', 1); for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.08); c.mark(c.u, 'vacuole_calm', 1, 2); } });

// evaporite: dried salt rings that take Rings of max HP from foes, ring the field, raise a salt tomb, and dry into a heavy stack.
const EVAP_GOLEM: SpriteData = { px: ['2.2222.2', '.244442.', '22111122', '21311312', '24444442', '222.2222', '24444442', '22.22.22'], c: ['#efefe9', '#d19a21', '#7f7f87'] };
defSummon({ id: 'evaporite_tomb', name: 'Salt Tomb', owner: 'evaporite', sprite: { px: ['........', '........', '...44...', '..4334..', '.224422.', '22222222', '.222222.', '........'], c: ['#efefe9', '#d19a21', '#444242'] }, text: 'Each turn: hits the foe for 25% of Kuorisho\'s MGK. Slow 1.', every: 100,
  act(b, s, f) { const t = foeOut(b, s); if (!f || !t) return; strike(b, f, t, stat(b, f, 'mgk') * 0.25, 'M', 'SALT'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } });
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
defMove({ id: 'evaporite_flake', name: 'Salt Flake', type: 'SALT', owner: 'evaporite', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 96% MGK. Takes a Ring: 4% of the foe\'s max HP to itself.',
  run(c) { c.hit(c.tgt, { mgk: 0.96 }); takeRing(c, c.tgt); } });
defMove({ id: 'evaporite_ring', name: 'Dry Ring', type: 'SALT', owner: 'evaporite', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 54% MGK, +8% per whorl standing. Heals 15% of it.',
  run(c) { const n = standing(c.me).length + standing(c.them).length; const d = c.spread({ mgk: 0.54 }, { mult: 1 + 0.08 * n }); c.heal(c.u, d * 0.15); } });
defMove({ id: 'evaporite_draw', name: 'Draw Water', type: 'SALT', owner: 'evaporite', reach: 'side', cd: 4, text: 'Summons a Salt Tomb (15% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'evaporite_tomb', { hp: 0.15, turns: 3 }); } });
defMove({ id: 'evaporite_room', name: 'Dry Room', type: 'SALT', owner: 'evaporite', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 63% MGK. Takes 2 Rings. For 3 turns: 1.15x ATK and MGK, 0.9x AGI, and its attacks add Expose 1.',
  run(c) {
    setForm(c.b, c.u, { tag: 'golem', sprite: EVAP_GOLEM, statMul: { mgk: 1.15, atk: 1.15, agi: 0.9 } });
    c.mark(c.u, 'evaporite_golem', 1, 3);
    c.hit(c.tgt, { mgk: 0.63 }); takeRing(c, c.tgt); takeRing(c, c.tgt);
  } });

// hood: a nautilus hood that hits with its weight, purges a friend clean, holds it shut, and shuts the door on blows.
defMark({ id: 'hood_angel', name: 'door shut', clock: 'own', value: 0.2,
  inMul(b, f, src, d) { return d.kind === 'P' ? 0 : 1; } });
defPassive({ id: 'hood_hard', name: 'Hard Hood', owner: 'hood', text: 'Its attacks add 50% DEF to their damage, and its moves add 25% DEF.',
  addRaw(b, f, t, d) { return stat(b, f, 'def') * (d.attack ? 0.5 : 0.25); } });
defPassive({ id: 'hood_door', name: 'Door Behind', owner: 'hood', text: 'When it switches out: the ally coming in gets Fortify 2.',
  leave(b, f) { f.k.doorOpen = 1; },
  anyOut(b, f, who) { if (f.k.doorOpen && who.side === f.side && who !== f) { f.k.doorOpen = 0; applyStatus(b, f, who, 'fortify', 2); } } });
defMove({ id: 'hood_knock', name: 'Hood Knock', type: 'STONE', owner: 'hood', reach: 'single', cd: 1, text: 'Hits for 105% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.05 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'hood_purify', name: 'Purify', type: 'STONE', owner: 'hood', reach: 'ally', cd: 3, text: 'Heals an ally 18% of max HP. The foe takes that much as magic.',
  run(c) { const h = c.heal(c.ally!, c.ally!.maxHp * 0.18); c.hit(c.tgt, { flat: h }, { kind: 'M' }); } });
defMove({ id: 'hood_holdshut', name: 'Hold Shut', type: 'STONE', owner: 'hood', reach: 'ally', cd: 3, text: 'Cleanses an ally. Fortify 2.',
  run(c) { c.cleanse(c.ally!); c.st(c.ally!, 'fortify', 2); } });
defMove({ id: 'hood_shutdoor', name: 'Shut Door', type: 'STONE', owner: 'hood', reach: 'team', cd: 7, nerve: 5, text: 'Your team takes no physical damage for 2 turns and heals 10%.',
  run(c) { for (const a of standing(c.me)) { c.mark(a, 'hood_angel', 1, 2); c.heal(a, a.maxHp * 0.1); } } });

// ================================================================ the Long Strand

// spoor: a giant footprint that leaves Live Prints with every move, footfalls, stuns attackers, guards, and walks back.
defSummon({ id: 'spoor_print', name: 'Live Print', owner: 'spoor', text: 'Stays until a foe comes out. Hits it for 45% of Ashiaki\'s MGK.',
  sprite: { px: ['........', '........', '....3...', '...4....', '..2222..', '.213312.', '.222222.', '........'], c: ['#4a4458', '#facb39', '#926b4b'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `A print goes off under ${label(b, who)}.`); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.45, 'M', 'VOID'); return true; } });
const prints = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'spoor_print');
defMark({ id: 'spoor_tazer', name: 'toes set', clock: 'own', volatile: true, value: 0.1,
  afterTake(b, f, src, dealt, d) { if (!d.attack || !src || src.side === f.side || src.ko) return; unmark(f, 'spoor_tazer'); applyStatus(b, f, src, 'stun', 1); } });
defPassive({ id: 'spoor_prints', name: 'Footprints', owner: 'spoor', text: 'When it uses a move: summons a Live Print (4% max HP), up to 3.',
  afterMove(b, f) { if (prints(b, f).length < 3) summon(b, f, 'spoor_print', { hp: 0.04 }); } });
defPassive({ id: 'spoor_starsland', name: 'Stars Land In', owner: 'spoor', text: '+5% damage per Live Print standing.',
  outMul(b, f) { return 1 + 0.05 * prints(b, f).length; } });
defMove({ id: 'spoor_footfall', name: 'Footfall', type: 'VOID', owner: 'spoor', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 100% MGK. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 1 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'spoor_toes', name: 'Toe Prints', type: 'VOID', owner: 'spoor', reach: 'self', cd: 3, wt: 50, text: 'Haste 1. The next foe to attack it: Stun 1.',
  run(c) { c.mark(c.u, 'spoor_tazer', 1, 2); c.st(c.u, 'haste', 1); } });
defMove({ id: 'spoor_guard', name: 'Print Guard', type: 'VOID', owner: 'spoor', reach: 'side', cd: 3, text: 'Sets 2 Live Prints.',
  run(c) { summon(c.b, c.u, 'spoor_print', { hp: 0.04 }); summon(c.b, c.u, 'spoor_print', { hp: 0.04 }); } });
defMove({ id: 'spoor_walkback', name: 'Walk Back', type: 'VOID', owner: 'spoor', reach: 'spread', tags: ['dash', 'spell'], cd: 6, nerve: 5, text: 'Hits every foe for 147% MGK. Silence 1. Pays 12% of its max HP.',
  run(c) { selfCost(c.b, c.u, c.u.maxHp * 0.12); c.spread({ mgk: 1.47 }); c.st(c.tgt, 'silence', 1); } });

// bolide: a burning star that heats with every move, flicks cinders, streaks down, rings itself in fire, and draws a white line.
defPassive({ id: 'bolide_burning', name: 'Burning Down', owner: 'bolide', text: 'Each move: +1 Heat, up to 3. Each Heat: +6% damage, and a move makes its next turn come 5% sooner. Any other action: -1 Heat.',
  afterMove(b, f) { f.k.heat3 = Math.min(3, (f.k.heat3 || 0) + 1); f.k.heatAt = b.turnNo; },
  outMul(b, f) { return 1 + 0.06 * (f.k.heat3 || 0); },
  turnEnd(b, f, action) { if (action === 'move' || action === 'windup') { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 5 * (f.k.heat3 || 0)); } else f.k.heat3 = Math.max(0, (f.k.heat3 || 0) - 1); } });
defPassive({ id: 'bolide_brightfall', name: 'Bright Fall', owner: 'bolide', text: 'When it comes out: its first move deals 1.2x.',
  outMul(b, f, t, d) { return f.k.fresh && d.move ? 1.2 : 1; } });
defMove({ id: 'bolide_flick', name: 'Cinder Flick', type: 'STAR', owner: 'bolide', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 45% MGK.',
  run(c) { c.spread({ mgk: 0.45 }); } });
defMove({ id: 'bolide_streak', name: 'Bright Streak', type: 'STAR', owner: 'bolide', reach: 'spread', tags: ['spell'], cd: 3, wu: 40, text: 'Short wind-up. Hits every foe for 49% MGK. Stun 1.',
  run(c) { c.spread({ mgk: 0.49 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'bolide_ring', name: 'Strike Ring', type: 'STAR', owner: 'bolide', reach: 'self', cd: 4, wt: 50, text: 'Haste 2. Fortify 2 (20% less damage). Its Heat goes to 3.',
  run(c) { c.st(c.u, 'haste', 2); c.st(c.u, 'fortify', 2, 0.2); c.u.k.heat3 = 3; } });
defMove({ id: 'bolide_whiteline', name: 'White Line', type: 'STAR', owner: 'bolide', reach: 'single', tags: ['spell'], noGuard: true, cd: 6, nerve: 5, text: 'Hits for 102% MGK as true damage, through guard.',
  run(c) { c.hit(c.tgt, { mgk: 1.02 }, { kind: 'T' }); } });

// marram: dune grass that holds together, pens a foe in sprouts, sends up tussocks, walks off, and runs its roots under the line.
defSummon({ id: 'marram_treant', name: 'Tussock', owner: 'marram', text: 'Each turn: hits the foe for 25% of Heinaba\'s ATK.', every: 100,
  sprite: { px: ['3......3', '4..44..4', '44.44.44', '.444444.', '.212212.', '.222222.', '.2....2.', '........'], c: ['#d3c39b', '#347433', '#8dab54'] },
  act(b, s, f) { const t = foeOut(b, s); if (f && t) strike(b, f, t, stat(b, f, 'atk') * 0.25, 'P', 'ROOT'); } });
defMark({ id: 'marram_pen', name: 'penned in', clock: 'own', volatile: true, negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' || what === 'guard' ? 'Penned in.' : null; } });
defPassive({ id: 'marram_holds', name: 'Holds Together', owner: 'marram', text: 'Takes 0.9x damage while it has an ally in reserve.',
  inMul(b, f) { return reserves(b.s[f.side]).length ? 0.9 : 1; } });
defPassive({ id: 'marram_walked', name: 'Root Walked', owner: 'marram', text: 'When it switches out: the next ally\'s first turn comes 20% sooner.',
  leave(b, f) { sk(b, f.side).bonusNext = (sk(b, f.side).bonusNext || 0) + 20; } });
defMove({ id: 'marram_sprout', name: 'Sprout Ring', type: 'ROOT', owner: 'marram', reach: 'single', cd: 2, text: 'Hits for 75% ATK. 2 turns: the foe can\'t switch or guard.',
  run(c) { c.hit(c.tgt, { atk: 0.75 }); if (!c.tgt.ko) c.mark(c.tgt, 'marram_pen', 1, 2); } });
defMove({ id: 'marram_runner', name: 'Runner', type: 'ROOT', owner: 'marram', reach: 'side', cd: 3, text: 'Summons 2 Tussocks (10% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'marram_treant', { hp: 0.1, turns: 3 }); summon(c.b, c.u, 'marram_treant', { hp: 0.1, turns: 3 }); } });
defMove({ id: 'marram_walkoff', name: 'Walk Off', type: 'ROOT', owner: 'marram', reach: 'single', cd: 3, tag: true, text: 'Hits for 97% ATK. Switches out.',
  run(c) { c.hit(c.tgt, { atk: 0.97 }); } });
defMove({ id: 'marram_rootrun', name: 'Root Run', type: 'ROOT', owner: 'marram', reach: 'spread', cd: 6, nerve: 5, text: 'Hits each reserve for 54% ATK, then the foe for 107% ATK, +20% per reserve hit.',
  run(c) { let n = 0; for (const r of reserves(c.them)) { c.hit(r, { atk: 1.07 }, { reserve: true, spread: true, mult: 0.5 }); n++; } c.hit(c.tgt, { atk: 1.07 }, { mult: 1 + 0.2 * n }); } });

// saltwort: a salt plant that crusts foes with every attack, spits, mists, cures it all at once, and sprays from hiding.
defMark({ id: 'saltwort_brine', name: 'crusted', max: 6, clock: 'own', negative: true, value: -0.05,
  turnStart(b, f) { const mk = f.m.saltwort_brine; const by = mk ? markedBy(b, mk) : null; if (mk) dealDamage(b, by && live(by) ? by : null, f, f.maxHp * 0.008 * mk.n, dot('T'), null); } });
defMark({ id: 'saltwort_spray', name: 'spraying', clock: 'own', volatile: true, value: 0.12,
  afterAttack(b, f, t) { for (const r of reserves(b.s[1 - f.side])) { dealDamage(b, f, r, stat(b, f, 'mgk') * 0.6, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); addBrine(b, f, r, 1); } } });
function addBrine(b: Battle, f: Fighter, t: Fighter, n: number): void {
  if (!live(t) || t.side === f.side) return;
  mark(b, f, t, 'saltwort_brine', n, 4);
  if (has(f, 'saltwort_post') && marked(t, 'saltwort_brine') >= 3) applyStatus(b, f, t, 'slow', 1);
}
defPassive({ id: 'saltwort_crisp', name: 'Crisp', owner: 'saltwort', text: 'Its attacks add 1 Crust for 4 turns, up to 6. Each Crust: the foe loses 0.8% of its max HP each turn.',
  afterAttack(b, f, t) { addBrine(b, f, t, 1); } });
defPassive({ id: 'saltwort_post', name: 'Salt Crust', owner: 'saltwort', text: 'A foe with 3+ of its Crust gets Slow 1.' });
defMove({ id: 'saltwort_spit', name: 'Salt Spit', type: 'SALT', owner: 'saltwort', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 105% MGK. 1 Crust.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); addBrine(c.b, c.u, c.tgt, 1); } });
defMove({ id: 'saltwort_mist', name: 'Brine Mist', type: 'SALT', owner: 'saltwort', reach: 'spread', tags: ['projectile', 'spell'], cd: 3, text: 'Hits every foe for 60% MGK. 2 Crust on the foe, 1 on each reserve.',
  run(c) { c.spread({ mgk: 0.6 }); addBrine(c.b, c.u, c.tgt, 2); for (const r of reserves(c.them)) addBrine(c.b, c.u, r, 1); } });
defMove({ id: 'saltwort_cure', name: 'Cure Through', type: 'SALT', owner: 'saltwort', reach: 'spread', tags: ['spell'], cd: 3, text: 'Spends all Crust: each foe takes 25% MGK + 2% max HP per Crust.',
  run(c) {
    for (const e of standing(c.them)) {
      const n = marked(e, 'saltwort_brine');
      if (!n || c.blocked(e)) continue;
      unmark(e, 'saltwort_brine');
      c.hit(e, { mgk: 0.25 * n, tgtHp: 0.02 * n }, e === c.tgt ? {} : { reserve: true });
    }
  } });
defMove({ id: 'saltwort_pressed', name: 'Pressed Flat', type: 'SALT', owner: 'saltwort', reach: 'self', cd: 6, nerve: 4, wt: 50, text: 'Hidden 1. For 3 turns: its attacks also hit each reserve for 60% MGK and add 1 Crust.',
  run(c) { c.st(c.u, 'hidden', 1); c.mark(c.u, 'saltwort_spray', 1, 3); } });

// albedo: night glare that keeps Shine from the fallen, glints, spends Shine to heal or vanish, and flares.
defMark({ id: 'albedo_empress', name: 'flaring', clock: 'own', volatile: true, value: 0.2,
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.15); } });
defPassive({ id: 'albedo_hard', name: 'Night Glare', owner: 'albedo', text: 'When a foe is KO\'d, and on every 4th hit it lands: gains a Shine, up to 3.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.souls = Math.min(3, (f.k.souls || 0) + 1); },
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; f.k.glare = (f.k.glare || 0) + 1; if (f.k.glare % 4 === 0) f.k.souls = Math.min(3, (f.k.souls || 0) + 1); } });
defPassive({ id: 'albedo_kept', name: 'Kept Shine', owner: 'albedo', text: 'Takes 4% less damage per Shine.',
  inMul(b, f) { return 1 - 0.04 * (f.k.souls || 0); } });
defMove({ id: 'albedo_glint', name: 'Night Glint', type: 'SALT', owner: 'albedo', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 130% MGK. Weaken 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.3 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'albedo_field', name: 'White Field', type: 'SALT', owner: 'albedo', reach: 'self', cd: 2, wt: 50, text: 'Spends a Shine: heals 16% max HP. Without one: heals 5%.',
  run(c) { const s = (c.u.k.souls || 0) > 0; if (s) c.u.k.souls--; c.heal(c.u, c.u.maxHp * (s ? 0.16 : 0.05)); } });
defMove({ id: 'albedo_link', name: 'Glare Link', type: 'SALT', owner: 'albedo', reach: 'self', cd: 3, wt: 50, text: 'Hidden 1. If it has a Shine: spends it for Untouchable 1 too.',
  run(c) { c.st(c.u, 'hidden', 1); if ((c.u.k.souls || 0) > 0) { c.u.k.souls--; c.st(c.u, 'invuln', 1); } } });
defMove({ id: 'albedo_flare', name: 'Salt Flare', type: 'SALT', owner: 'albedo', reach: 'self', cd: 6, nerve: 4, wt: 50, text: 'Haste 3. Empower 3. For 3 turns: its attacks heal 15% of their damage. Gains 2 Shine.',
  run(c) { c.st(c.u, 'haste', 3); c.st(c.u, 'empower', 3); c.mark(c.u, 'albedo_empress', 1, 3); c.u.k.souls = Math.min(3, (c.u.k.souls || 0) + 2); } });

// cuttle: a cuttlebone that jabs color, leaves a decoy, dresses a friend as itself, and takes the foe's colors.
defSummon({ id: 'cuttle_decoy', name: 'Bone Decoy', owner: 'cuttle', sprite: { px: ['........', '..2222..', '.242242.', '.224422.', '.242242.', '..2222..', '...33...', '........'], c: ['#efebe3', '#51a95a', '#866757'] }, text: 'Takes single-target hits meant for Ikapia. Uses Color Jab on its own turns.', every: 100, guard: true });
defMark({ id: 'cuttle_shape', name: 'in other colors', clock: 'own', value: 0.2,
  expire(b, f) { clearForm(b, f); msg(b, `${label(b, f)} lies back down as itself.`); },
  leave(b, f) { unmark(f, 'cuttle_shape'); clearForm(b, f); } });
defPassive({ id: 'cuttle_matches', name: 'Matches', owner: 'cuttle', text: 'Deals 1.3x damage while its Bone Decoy stands.',
  outMul(b, f) { return summonsOf(b, f.side, 'cuttle_decoy').length ? 1.3 : 1; } });
defPassive({ id: 'cuttle_liesby', name: 'Lies By', owner: 'cuttle', text: 'When it comes out: the first hit it takes deals 0.7x.',
  comeOut(b, f) { f.k.liesBy = 1; },
  beforeTake(b, f, src, amt, d) { if (!f.k.liesBy || d.dot) return amt; f.k.liesBy = 0; return amt * 0.7; } });
defMove({ id: 'cuttle_jab', name: 'Color Jab', type: 'TIDE', owner: 'cuttle', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 129% MGK. The first reserve takes 35% of it.',
  run(c) { c.hit(c.tgt, { mgk: 1.29 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 1.29 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'cuttle_clap', name: 'Flat Clap', type: 'TIDE', owner: 'cuttle', reach: 'side', cd: 3, text: 'Hidden 1. Summons a Bone Decoy (12% max HP, 2 turns) that uses Color Jab.',
  run(c) { summonTwin(c.b, c.u, 'cuttle_decoy', { hp: 0.12, turns: 2, moves: ['cuttle_jab'] }); c.st(c.u, 'hidden', 1); } });
defMove({ id: 'cuttle_brew', name: 'Cloud Brew', type: 'TIDE', owner: 'cuttle', reach: 'reserveAlly', cd: 4, tag: true, text: 'Switches to an ally that comes out looking like Ikapia.',
  run(c) { disguise(c.b, c.ally!, c.u); c.ally!.k.wearing = 1; } });
defMove({ id: 'cuttle_three', name: 'Three Colors', type: 'TIDE', owner: 'cuttle', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, wt: 60, text: 'Takes the foe\'s look, types, passives, and moves for 3 turns.',
  run(c) { if (c.blocked(c.tgt)) return; takeOver(c.b, c.u, c.tgt, 'shape'); c.mark(c.u, 'cuttle_shape', 1, 3); c.msg(`${label(c.b, c.u)} matches ${label(c.b, c.tgt)}.`); } });

// medusa: a jelly that drains tide every second hit, stings, turns a spell back, rings its bell, and ripples by what they lack.
defMark({ id: 'medusa_counter', name: 'quiet', clock: 'own', volatile: true, value: 0.15,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('spell')) return null; unmark(f, 'medusa_counter'); return 'reflect'; } });
defPassive({ id: 'medusa_ripples', name: 'Ripples', owner: 'medusa', text: 'Every 2nd hit: the foe\'s side loses 1 tide, and it takes 5% max HP true.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || f.k.breaking) return; f.k.mb = (f.k.mb || 0) + 1; if (f.k.mb % 2 !== 0) return; addNerve(b, t.side, -1); f.k.breaking = 1; strike(b, f, t, t.maxHp * 0.05, 'T', null); f.k.breaking = 0; } });
defPassive({ id: 'medusa_talked', name: 'Talked Near', owner: 'medusa', text: 'Takes 0.8x damage from spell moves.',
  inMul(b, f, src, d) { return d.move?.tags?.includes('spell') ? 0.8 : 1; } });
defMove({ id: 'medusa_sting', name: 'Bell Sting', type: 'TIDE', owner: 'medusa', reach: 'single', tags: ['dash'], cd: 1, text: 'Hits for 74% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.74 }); c.hasten(c.u, 30); } });
defMove({ id: 'medusa_pulse', name: 'Quiet Pulse', type: 'TIDE', owner: 'medusa', reach: 'self', cd: 3, wt: 50, text: 'Turns the next spell aimed at its side back on its user.',
  run(c) { c.mark(c.u, 'medusa_counter', 1, 2); } });
defMove({ id: 'medusa_bell', name: 'Pulse Bell', type: 'TIDE', owner: 'medusa', reach: 'single', cd: 3, text: 'Hits for 87% ATK. The foe\'s side loses 1 tide.',
  run(c) { c.hit(c.tgt, { atk: 0.87 }); if (!c.blocked(c.tgt)) c.nerve(c.them, -1); } });
defMove({ id: 'medusa_bigripple', name: 'Big Ripple', type: 'TIDE', owner: 'medusa', reach: 'spread', cd: 6, nerve: 5, text: 'Hits every foe for 52% ATK +15% per tide below 10 on their side.',
  run(c) { const lack = Math.max(0, 10 - c.them.nerve); c.hit(c.tgt, { atk: 0.52 + 0.15 * lack }); for (const r of reserves(c.them)) c.hit(r, { atk: 0.52 + 0.15 * lack }, { reserve: true, spread: true, mult: 0.35 }); } });

// ================================================================ the Tray

// bollard: a white corner post that shoots, shoves, drives itself in to fire rapidly, and calls stones down on four corners.
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
defMove({ id: 'bollard_post', name: 'Post Shot', type: 'STONE', owner: 'bollard', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 110% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); } });
defMove({ id: 'bollard_shove', name: 'Shove Back', type: 'STONE', owner: 'bollard', reach: 'spread', tags: ['projectile'], cd: 3, text: 'Hits every foe for 75% ATK. Weaken 1.',
  run(c) { c.spread({ atk: 0.75 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'bollard_drive', name: 'Post Drive', type: 'STONE', owner: 'bollard', reach: 'self', cd: 2, wt: 50, text: 'Drives itself in, or pulls out. Driven In: 1.2x DEF, 0.85x AGI.',
  run(c) {
    if (turret(c.u)) { clearForm(c.b, c.u); c.msg(`${label(c.b, c.u)} stands back up.`); return; }
    setForm(c.b, c.u, { tag: 'turret', sprite: BOLLARD_TURRET, statMul: { def: 1.2, agi: 0.85 } }, ['bollard_gatling']);
    c.msg(`${label(c.b, c.u)} sets itself down.`);
  } });
defMove({ id: 'bollard_gatling', name: 'Post Volley', type: 'STONE', owner: 'bollard', reach: 'single', tags: ['projectile'], cd: 1, extra: true, text: 'Hits 5 times for 30% ATK, the last 2 on reserves.',
  run(c) { const rs = reserves(c.them); for (let i = 0; i < 5; i++) { const t = i >= 3 && rs[i - 3] ? rs[i - 3] : c.tgt; if (!t.ko) c.hit(t, { atk: 0.3 }, t === c.tgt ? {} : { reserve: true }); } } });
defMove({ id: 'bollard_four', name: 'Four Posts', type: 'STONE', owner: 'bollard', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, text: 'Hits every foe for 40% ATK. At its next 3 turns: every foe takes 60% ATK.',
  run(c) { c.spread({ atk: 0.4 }); c.mark(c.u, 'bollard_shells', 1, 3); } });

// docket: a docket post that tickets foes, plants trip labels, holds them off, and tickets everyone at once.
defMark({ id: 'docket_label', name: 'ticketed', clock: 'own', negative: true, value: -0.08,
  inMul(b, f, src) { const mk = f.m.docket_label; return mk && src && markedBy(b, mk) === src ? 1.15 : 1; } });
defSummon({ id: 'docket_wire', name: 'Trip Label', owner: 'docket', text: 'Stays until a foe comes out. Hits it for 110% MGK. Root 2. Slow 1. Ticketed 3.',
  sprite: { px: ['........', '........', '........', '..2222..', '..2132..', '..2222..', '...44...', '33.44.33'], c: ['#fff7ee', '#5ee6fd', '#3c3c4a'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} trips a label.`); if (f) strike(b, f, who, stat(b, f, 'mgk') * 1.1, 'M', 'GEAR'); applyStatus(b, f, who, 'root', 2); applyStatus(b, f, who, 'slow', 1); mark(b, f, who, 'docket_label', 1, 3); if (f && has(f, 'docket_nearest')) addNerve(b, f.side, 1); return true; } });
defMark({ id: 'docket_cage', name: 'held off', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('projectile')) return null; unmark(f, 'docket_cage'); return 'block'; } });
defPassive({ id: 'docket_nearest', name: 'Nearest Shell', owner: 'docket', text: 'Each time a Trip Label goes off: +1 tide.' });
defPassive({ id: 'docket_letters', name: 'Last Letters', owner: 'docket', text: 'When it is KO\'d: every foe is Ticketed for 3 turns.',
  anyKO(b, f, v) { if (v !== f) return; for (const e of standing(b.s[1 - f.side])) mark(b, null, e, 'docket_label', 1, 3); } });
defMove({ id: 'docket_tap', name: 'Post Tap', type: 'GEAR', owner: 'docket', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 155% MGK. Ticketed 3: it takes 1.15x from Tifuda.',
  run(c) { c.hit(c.tgt, { mgk: 1.55 }); if (!c.tgt.ko) c.mark(c.tgt, 'docket_label', 1, 3); } });
defMove({ id: 'docket_plant', name: 'Plant Label', type: 'GEAR', owner: 'docket', reach: 'side', cd: 3, text: 'Sets a Trip Label (5% of its max HP).',
  run(c) { summon(c.b, c.u, 'docket_wire', { hp: 0.05 }); } });
defMove({ id: 'docket_hold', name: 'Hold Label', type: 'GEAR', owner: 'docket', reach: 'self', cd: 3, wt: 50, text: 'Fortify 1. Blocks the next projectile move at its side.',
  run(c) { c.st(c.u, 'fortify', 1); c.mark(c.u, 'docket_cage', 1, 2); } });
defMove({ id: 'docket_blast', name: 'All Ticketed', type: 'GEAR', owner: 'docket', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, text: 'Hits for 173% MGK. Ticketed 3 on every foe. Empower 1 on your team.',
  run(c) { c.hit(c.tgt, { mgk: 1.73 }); for (const e of standing(c.them)) c.mark(e, 'docket_label', 1, 3); for (const a of standing(c.me)) c.st(a, 'empower', 1); } });

// vacancy: an empty slot that drains tide, taps, slips in, empties itself out, and waits inside a friend.
defMark({ id: 'vacancy_inside', name: 'waiting inside', value: 0.15,
  comeOut(b, f) { unmark(f, 'vacancy_inside'); msg(b, `${label(b, f)} bursts out.`); splash(b, f, stat(b, f, 'mgk') * 1.0, 'M', 'VOID'); heal(b, f, f, f.maxHp * 0.15); } });
defPassive({ id: 'vacancy_empties', name: 'Empties', owner: 'vacancy', text: 'Every 2nd attack: the foe\'s side loses 1 tide.',
  afterAttack(b, f, t) { f.k.empt = (f.k.empt || 0) + 1; if (f.k.empt % 2 === 0) addNerve(b, t.side, -1); } });
defPassive({ id: 'vacancy_counter', name: 'Counter Empty', owner: 'vacancy', text: 'When it comes out: the first enemy move to hit it deals 0.6x.',
  comeOut(b, f) { f.k.counterE = 1; },
  beforeTake(b, f, src, amt, d) { if (!d.move || !f.k.counterE || !src || src.side === f.side) return amt; f.k.counterE = 0; return amt * 0.6; } });
defMove({ id: 'vacancy_tap', name: 'Hollow Tap', type: 'VOID', owner: 'vacancy', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 106% MGK + 4% of the foe\'s max HP. Heals that 4%.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.06, tgtHp: 0.04 }); c.heal(c.u, Math.min(d, c.tgt.maxHp * 0.04)); } });
defMove({ id: 'vacancy_slip', name: 'Slip In', type: 'VOID', owner: 'vacancy', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 106% MGK. Slow 2. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 1.06 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 25); } });
defMove({ id: 'vacancy_emptyout', name: 'Empty Out', type: 'VOID', owner: 'vacancy', reach: 'self', cd: 4, wt: 50, text: 'Cleanses itself. Unstoppable 2. Fortify 2 (20% less damage).',
  run(c) { c.cleanse(c.u); c.st(c.u, 'unstop', 2); c.st(c.u, 'fortify', 2, 0.2); } });
defMove({ id: 'vacancy_square', name: 'Square Waits', type: 'VOID', owner: 'vacancy', reach: 'reserveAlly', cd: 6, nerve: 4, tag: true, text: 'Switches to an ally and heals it 10% of max HP. When it next comes out: every foe takes 100% MGK, and it heals 15% of its max HP.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.1); c.mark(c.u, 'vacancy_inside', 1); } });

// trochus: a top shell that heals when unwatched, never slows, spins a foe quiet, spins under, and spins out.
defMark({ id: 'trochus_judgment', name: 'spinning', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { splash(b, f, stat(b, f, 'atk') * 0.38, 'P', 'STONE'); } });
defPassive({ id: 'trochus_unwatched', name: 'Unwatched Spin', owner: 'trochus', text: 'Turn start: if nothing hit it since its last turn, heals 4% of max HP.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.trochHit = 1; },
  turnStart(b, f) { if (!f.k.trochHit) heal(b, f, f, f.maxHp * 0.04); f.k.trochHit = 0; } });
defPassive({ id: 'trochus_spinning', name: 'Keeps Spinning', owner: 'trochus', text: 'Immune to Slow and Root.',
  statusImmune(f, id) { return id === 'slow' || id === 'root'; } });
defMove({ id: 'trochus_spin', name: 'Top Spin', type: 'STONE', owner: 'trochus', reach: 'single', cd: 3, text: 'Hits for 70% ATK. Silence 1. Haste 1.',
  run(c) { c.hit(c.tgt, { atk: 0.7 }); c.st(c.tgt, 'silence', 1); c.st(c.u, 'haste', 1); } });
defMove({ id: 'trochus_under', name: 'Spin Under', type: 'STONE', owner: 'trochus', reach: 'self', cd: 3, wt: 50, text: 'Cleanses itself. Fortify 2 (30% less damage).',
  run(c) { c.cleanse(c.u); c.st(c.u, 'fortify', 2, 0.3); } });
defMove({ id: 'trochus_grit', name: 'Grit Finish', type: 'STONE', owner: 'trochus', reach: 'spread', cd: 3, text: 'Hits every foe for 33% ATK. At its next 2 turns: every foe takes 38% ATK.',
  run(c) { c.spread({ atk: 0.33 }); c.mark(c.u, 'trochus_judgment', 1, 2); } });
defMove({ id: 'trochus_spinout', name: 'Spin Out', type: 'STONE', owner: 'trochus', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 59% ATK, then 25% of the foe\'s missing HP as true damage.',
  run(c) { c.hit(c.tgt, { atk: 0.59 }); if (!c.tgt.ko) c.hit(c.tgt, { tgtMiss: 0.25 }, { kind: 'T' }); } });

// hopper: a hollow salt crystal that steps inward with each move, throws its face, pulls a foe in, crusts over, and opens its hollow core.
defMark({ id: 'hopper_step', name: 'steps', max: 4, value: 0.05 });
defMark({ id: 'hopper_hog', name: 'hollowing', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.45, 'M', 'SALT'); const t = foe(b, f); if (t) delayFighter(b, t, 15); } });
defPassive({ id: 'hopper_stepped', name: 'Stepped In', owner: 'hopper', text: 'When it uses a move: a Step, up to 4. Each Step: takes 5% less damage.',
  afterMove(b, f) { if (marked(f, 'hopper_step') >= 4 && has(f, 'hopper_hollow')) { unmark(f, 'hopper_step'); return; } mark(b, f, f, 'hopper_step', 1); },
  inMul(b, f) { return 1 - 0.05 * marked(f, 'hopper_step'); } });
defPassive({ id: 'hopper_hollow', name: 'Hollow Center', owner: 'hopper', text: 'At 4 Steps: its next move deals 1.5x and spends the Steps.',
  outMul(b, f, t, d) { return d.move && marked(f, 'hopper_step') >= 4 ? 1.5 : 1; } });
defMove({ id: 'hopper_face', name: 'Cube Face', type: 'SALT', owner: 'hopper', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 105% MGK. 1.3x on a foe that came out since its last turn.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }, { mult: c.tgt.outAt > (c.u.k.prevTurn ?? -1) ? 1.3 : 1 }); } });
defMove({ id: 'hopper_stair', name: 'Inward Stair', type: 'SALT', owner: 'hopper', reach: 'dragin', tags: ['projectile'], cd: 3, text: 'Drags in a reserve. Hits it for 85% MGK. Slow 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 0.85 }); c.st(t, 'slow', 1); } });
defMove({ id: 'hopper_crust', name: 'Crust Over', type: 'SALT', owner: 'hopper', reach: 'self', cd: 4, wt: 60, text: 'Heals 20% of its max HP. Fortify 1 (50% less damage).',
  run(c) { c.heal(c.u, c.u.maxHp * 0.2); c.st(c.u, 'fortify', 1, 0.5); } });
defMove({ id: 'hopper_core', name: 'Hollow Core', type: 'SALT', owner: 'hopper', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, text: 'Hits every foe for 60% MGK and delays the foe\'s next turn by 15%. At its next 2 turns: every foe takes 45% MGK, and the delay repeats.',
  run(c) { c.spread({ mgk: 0.6 }); c.delay(c.tgt, 15); c.mark(c.u, 'hopper_hog', 1, 2); } });

// crabwise: a sideways crab that shields after moves, nips with every third a stunning whirl, flicks salt, steps aside, and cuts between slots.
defMark({ id: 'crabwise_wall', name: 'salt screen', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { return isOut(b, f) && m.tags?.includes('projectile') ? 'block' : null; } });
defPassive({ id: 'crabwise_sideways', name: 'Sideways', owner: 'crabwise', text: 'After a move, once every 3 turns: a shield of 14% of its max HP.',
  afterMove(b, f) { if ((f.k.flowAt || -9) > b.turnNo - 6) return; f.k.flowAt = b.turnNo; giveShield(b, f, f, f.maxHp * 0.14, 3); } });
defPassive({ id: 'crabwise_claw', name: 'Crusted Claw', owner: 'crabwise', text: 'Every 4th hit it lands deals 1.5x.',
  outMul(b, f, t, d) { return !d.reserve && !d.dot && (f.k.claw4 || 0) % 4 === 3 ? 1.5 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) f.k.claw4 = (f.k.claw4 || 0) + 1; } });
defMove({ id: 'crabwise_nip', name: 'Claw Nip', type: 'SALT', owner: 'crabwise', reach: 'single', cd: 1, text: 'Hits for 100% ATK. Every 3rd use: 80% ATK and Stun 1 instead.',
  run(c) { c.u.k.tempest = ((c.u.k.tempest || 0) % 3) + 1; c.hit(c.tgt, { atk: c.u.k.tempest === 3 ? 0.8 : 1.0 }); if (c.u.k.tempest === 3) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'crabwise_flick', name: 'Salt Flick', type: 'SALT', owner: 'crabwise', reach: 'self', cd: 4, wt: 50, text: '2 turns: blocks every projectile move at it.',
  run(c) { c.mark(c.u, 'crabwise_wall', 1, 2); } });
defMove({ id: 'crabwise_side', name: 'Side Step', type: 'SALT', owner: 'crabwise', reach: 'single', tags: ['dash'], cd: 2, text: 'Hits for 100% ATK. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1 }); c.hasten(c.u, 30); } });
defMove({ id: 'crabwise_between', name: 'Between Slots', type: 'SALT', owner: 'crabwise', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, text: 'Hits for 162% ATK, 1.5x on a Stunned foe. Root 2.',
  run(c) { c.hit(c.tgt, { atk: 1.62 }, { mult: c.tgt.s.stun ? 1.5 : 1 }); c.st(c.tgt, 'root', 2); } });

// magpie: a magpie that comes out hidden, snatches, pecks a foe quiet, hoards a friend in, and gives it all back.
defMark({ id: 'magpie_hacked', name: 'pecked', clock: 'own', volatile: true, negative: true, value: -0.15,
  forbid(b, f, what) { return typeof what === 'object' ? 'Hacked.' : null; } });
defPassive({ id: 'magpie_each', name: 'One of Each', owner: 'magpie', text: 'Deals 1.25x damage to a Pecked foe.',
  outMul(b, f, t) { return marked(t, 'magpie_hacked') ? 1.25 : 1; } });
defPassive({ id: 'magpie_wing', name: 'Under Wing', owner: 'magpie', text: 'When it comes out: Hidden 1 and Haste 1.',
  comeOut(b, f) { applyStatus(b, f, f, 'hidden', 1); applyStatus(b, f, f, 'haste', 1); } });
defMove({ id: 'magpie_snatch', name: 'Snatch', type: 'BEAST', owner: 'magpie', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits 3 times for 38% ATK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.38 }); } });
defMove({ id: 'magpie_pecks', name: 'Three Pecks', type: 'BEAST', owner: 'magpie', reach: 'single', cd: 4, text: 'Hits for 50% ATK. Pecked 1: it can\'t use moves at its next turn.',
  run(c) { c.hit(c.tgt, { atk: 0.5 }); if (!c.tgt.ko) c.mark(c.tgt, 'magpie_hacked', 1, 1); } });
defMove({ id: 'magpie_hoard', name: 'Hoard', type: 'BEAST', owner: 'magpie', reach: 'reserveAlly', cd: 3, tag: true, wt: 50, text: 'Switches to an ally. Its first turn comes 30% sooner.',
  run(c) { c.ally!.k.firstBonus = (c.ally!.k.firstBonus || 0) + 30; } });
defMove({ id: 'magpie_back', name: 'Gives It Back', type: 'BEAST', owner: 'magpie', reach: 'spread', cd: 6, nerve: 5, text: 'Every foe loses shields and good statuses. Hits each for 90% ATK.',
  run(c) { for (const e of standing(c.them)) { if (c.blocked(e)) continue; e.shield = 0; e.shieldTurns = 0; for (const id of GOOD) delete e.s[id]; } c.spread({ atk: 0.9 }); } });

// cache: the Mudlark's hiding hole that fills foes with Sand, strips what they have, takes one in, and lets it all out.
defMark({ id: 'cache_shadow', name: 'sand in it', max: 5, clock: 'own', negative: true, value: -0.06 });
defPassive({ id: 'cache_deep', name: 'Deep Keep', owner: 'cache', text: 'Takes 0.8x damage. A foe it hides comes back with 2 Sand.',
  inMul() { return 0.8; },
  banishEnd(b, f, back) { if (live(back)) mark(b, f, back, 'cache_shadow', 2, 4); } });
defPassive({ id: 'cache_eye', name: 'Mudlark\'s Eye', owner: 'cache', text: 'Deals 1.25x damage to a foe with a shield or a good status.',
  outMul(b, f, t) { return t.shield > 0 || GOOD.some(id => t.s[id]) ? 1.25 : 1; } });
defMove({ id: 'cache_poke', name: 'Poke In', type: 'VOID', owner: 'cache', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 149% MGK. 1 Sand, max 5.',
  run(c) { c.hit(c.tgt, { mgk: 1.49 }); if (!c.tgt.ko) c.mark(c.tgt, 'cache_shadow', 1, 4); } });
defMove({ id: 'cache_fallin', name: 'Fall In', type: 'VOID', owner: 'cache', reach: 'single', tags: ['spell'], cd: 3, text: 'Strips shield and good statuses. Hits for 104% MGK. Slow 3. 1 Sand.',
  run(c) { if (c.blocked(c.tgt)) return; for (const id of GOOD) delete c.tgt.s[id]; c.tgt.shield = 0; c.tgt.shieldTurns = 0; c.st(c.tgt, 'slow', 3); c.hit(c.tgt, { mgk: 1.04 }); if (!c.tgt.ko) c.mark(c.tgt, 'cache_shadow', 1, 4); } });
defMove({ id: 'cache_hole', name: 'Shallow Hole', type: 'VOID', owner: 'cache', reach: 'single', tags: ['spell'], cd: 5, text: 'Takes the foe off the field for 1 turn. It returns with 2 Sand.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; banish(c.b, c.tgt, 1, c.u); } });
defMove({ id: 'cache_keepsit', name: 'Keeps It', type: 'VOID', owner: 'cache', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 90% MGK. Then each foe\'s Sand bursts for 37% MGK, doubled for each Sand past the first.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); for (const e of standing(c.them)) { const n = marked(e, 'cache_shadow'); if (!n || c.blocked(e)) continue; unmark(e, 'cache_shadow'); c.hit(e, { mgk: 0.37 * Math.pow(2, n - 1) }, e === c.tgt ? {} : { reserve: true }); } } });

// ================================================================ the Conch

// strombus: a conch eye that never blinks, jabs from far off, lays toxin, stares, and culls the weak.
defSummon({ id: 'strombus_mine', name: 'Toxin Trap', owner: 'strombus', sprite: { px: ['........', '........', '3.3..3..', '.333.3..', '..3333..', '..3223..', '.444444.', '........'], c: ['#f2eae2', '#be2f56', '#a09071'] }, text: 'Stays until a foe comes out: Poison 4.',
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} steps in the toxin.`); applyStatus(b, f, who, 'poison', 4); return true; } });
defPassive({ id: 'strombus_never', name: 'Never Blinks', owner: 'strombus', text: 'Deals 1.25x damage to a foe that came out since its last turn.',
  outMul(b, f, t) { return t.outAt > (f.k.prevTurn ?? -1) ? 1.25 : 1; } });
defPassive({ id: 'strombus_unblinking', name: 'Unblinking', owner: 'strombus', text: 'Immune to Sleep. Takes 0.85x damage from a Taunted foe.',
  statusImmune(f, id) { return id === 'sleep'; },
  inMul(b, f, src) { return src && src.s.taunt ? 0.85 : 1; } });
defMove({ id: 'strombus_jab', name: 'Stalk Jab', type: 'BEAST', owner: 'strombus', reach: 'single', tags: ['projectile'], cd: 1, text: 'Hits for 138% ATK.',
  run(c) { c.hit(c.tgt, { atk: 1.38 }); } });
defMove({ id: 'strombus_look', name: 'Long Look', type: 'BEAST', owner: 'strombus', reach: 'single', cd: 3, text: 'Hits for 66% ATK. Poison 2. Sets a Toxin Trap (5% max HP).',
  run(c) { c.hit(c.tgt, { atk: 0.66 }); c.st(c.tgt, 'poison', 2); summon(c.b, c.u, 'strombus_mine', { hp: 0.05 }); } });
defMove({ id: 'strombus_stare', name: 'Stare', type: 'BEAST', owner: 'strombus', reach: 'self', tags: ['dash'], cd: 3, wt: 40, text: 'Haste 1. Its next attack deals 1.4x.',
  run(c) { c.st(c.u, 'haste', 1); c.u.k.nextAtkMul = 1.4; } });
defMove({ id: 'strombus_cull', name: 'Cull', type: 'BEAST', owner: 'strombus', reach: 'single', tags: ['projectile'], cd: 6, nerve: 5, wu: 80, text: 'Long wind-up. Hits for 198% ATK. If the foe is left below 25% HP: it is KO\'d, and you gain 2 tide.',
  run(c) { c.hit(c.tgt, { atk: 1.98 }); if (!c.tgt.ko && c.tgt.hp < c.tgt.maxHp * 0.25 && !c.blocked(c.tgt)) { c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true }); if (c.tgt.ko) c.nerve(c.me, 2); } } });

// sanderling: a shore bird that strikes twice every fourth attack, skips through the line, stands on one foot, runs the edge, and outruns the wave.
defMark({ id: 'sanderling_wuju', name: 'sharp', clock: 'own', volatile: true, value: 0.1,
  afterAttack(b, f, t) { if (live(t)) strike(b, f, t, stat(b, f, 'atk') * 0.3, 'T', null); } });
defMark({ id: 'sanderling_high', name: 'outrunning', clock: 'own', volatile: true, value: 0.2,
  outMul(b, f, t, d) { return d.attack ? 1.4 : 1; },
  statusImmune(f, id) { return id === 'slow' || id === 'root'; } });
defPassive({ id: 'sanderling_dry', name: 'Never Wet', owner: 'sanderling', text: 'Every 4th attack: also hits for 80% ATK.',
  afterAttack(b, f, t) { f.k.dbl4 = (f.k.dbl4 || 0) + 1; if (f.k.dbl4 % 4 === 0 && live(t)) strike(b, f, t, stat(b, f, 'atk') * 0.8, 'P', 'BEAST'); } });
defPassive({ id: 'sanderling_edge', name: 'Runs the Edge', owner: 'sanderling', text: 'When it KOs a foe: its cooldowns drop 2.',
  anyKO(b, f, v, killer) { if (killer === f && v.side !== f.side) f.cd = f.cd.map(x => Math.max(0, x - 2)); } });
defMove({ id: 'sanderling_pin', name: 'Pin', type: 'BEAST', owner: 'sanderling', reach: 'spread', tags: ['dash'], cd: 1, text: 'Hits every foe for 103% ATK.',
  run(c) { c.spread({ atk: 1.03 }); } });
defMove({ id: 'sanderling_longshot', name: 'Still Foot', type: 'BEAST', owner: 'sanderling', reach: 'self', cd: 4, wt: 70, text: 'Heals 20% of its max HP. Fortify 1 (40% less damage).',
  run(c) { c.heal(c.u, c.u.maxHp * 0.2); c.st(c.u, 'fortify', 1, 0.4); } });
defMove({ id: 'sanderling_run', name: 'Edge Run', type: 'BEAST', owner: 'sanderling', reach: 'self', cd: 3, wt: 50, text: 'For 3 turns its attacks add 30% ATK as true damage.',
  run(c) { c.mark(c.u, 'sanderling_wuju', 1, 3); } });
defMove({ id: 'sanderling_wave', name: 'Wave Edge', type: 'BEAST', owner: 'sanderling', reach: 'self', cd: 6, nerve: 4, wt: 50, text: 'Haste 3. For 3 turns: its attacks deal 1.4x, and it is immune to Slow and Root.',
  run(c) { c.st(c.u, 'haste', 3); c.mark(c.u, 'sanderling_high', 1, 3); } });

// flood: a high tide that comes up after every move, rises, spills, pulls a foe into a whirl, and floods up from below.
defMark({ id: 'flood_whirl', name: 'in a whirl', clock: 'own', volatile: true, negative: true, value: -0.1,
  forbid(b, f, what) { return what === 'switch' ? 'Caught in the whirl.' : null; },
  turnStart(b, f) { const mk = f.m.flood_whirl; const by = mk ? markedBy(b, mk) : null; if (by && live(by)) strike(b, by, f, stat(b, by, 'mgk') * 0.25, 'M', 'TIDE'); } });
defPassive({ id: 'flood_comesup', name: 'Comes Up', owner: 'flood', text: 'When it uses a move: its next attack deals 1.35x.',
  afterMove(b, f) { f.k.surge = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.surge ? 1.35 : 1; },
  afterAttack(b, f) { f.k.surge = 0; } });
defPassive({ id: 'flood_stays', name: 'Stays High', owner: 'flood', text: '+3% damage per tide in its side\'s pool.',
  outMul(b, f) { return 1 + 0.03 * b.s[f.side].nerve; } });
defMove({ id: 'flood_rise', name: 'Rise', type: 'TIDE', owner: 'flood', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 105% MGK. Delays the foe\'s next turn by 15%.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); c.delay(c.tgt, 15); } });
defMove({ id: 'flood_spill', name: 'Top Spill', type: 'TIDE', owner: 'flood', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 80% MGK + 6% foe current HP. First reserve takes 35% of it.',
  run(c) { c.hit(c.tgt, { mgk: 0.8, tgtCur: 0.06 }); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.8 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'flood_stay', name: 'Stay a While', type: 'TIDE', owner: 'flood', reach: 'single', tags: ['spell'], cd: 3, text: 'Slow 1. For 2 turns: the foe can\'t switch and takes 25% MGK at each of its turns.',
  run(c) { c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'flood_whirl', 1, 2); } });
defMove({ id: 'flood_spring', name: 'Spring Flood', type: 'TIDE', owner: 'flood', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 60, text: 'Wind-up. Hits every foe for 140% MGK. Stun 1.',
  run(c) { c.spread({ mgk: 1.4 }); c.st(c.tgt, 'stun', 1); } });

// surf: the sea sound that strikes a chord every third move, hisses, crashes over its team, rushes them, and roars.
defPassive({ id: 'surf_loud', name: 'Loud Inside', owner: 'surf', text: 'Every 3rd move: 40% MGK to the foe and Slow 1.',
  afterMove(b, f) { f.k.chord3 = (f.k.chord3 || 0) + 1; if (f.k.chord3 % 3 !== 0) return; const t = foe(b, f); if (!t) return; strike(b, f, t, stat(b, f, 'mgk') * 0.4, 'M', 'TIDE'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'surf_after', name: 'After Rush', owner: 'surf', text: 'After its crest: its next turn comes 30% sooner.',
  afterMove(b, f, m) { if (m.nerve) hastenFighter(b, f, 30); } });
defMove({ id: 'surf_hiss', name: 'Hiss', type: 'TIDE', owner: 'surf', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 105% MGK. Its next attack deals 1.2x.',
  run(c) { c.hit(c.tgt, { mgk: 1.05 }); c.u.k.nextAtkMul = 1.2; } });
defMove({ id: 'surf_crash', name: 'Crash', type: 'TIDE', owner: 'surf', reach: 'team', cd: 2, text: 'Your team heals 6% of max HP. Shield of 8% max HP on itself.',
  run(c) { for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.06); c.shield(c.u, c.u.maxHp * 0.08, 2); } });
defMove({ id: 'surf_rush', name: 'Rush Up', type: 'TIDE', owner: 'surf', reach: 'team', cd: 3, text: 'Haste 1 on your team.',
  run(c) { for (const a of standing(c.me)) c.st(a, 'haste', 1); } });
defMove({ id: 'surf_seasound', name: 'Sea Sound', type: 'TIDE', owner: 'surf', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 105% MGK. Stun 1.',
  run(c) { c.spread({ mgk: 1.05 }); c.st(c.tgt, 'stun', 1); } });

// fleur: a salt flower that dries foes until they crack, sprays, blooms, spreads the drying, and bounces a flower between them.
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
defPassive({ id: 'fleur_dries', name: 'Spray Dries', owner: 'fleur', text: 'Its damaging moves add 1 Dry for 3 turns. Each Dry: 10% MGK each turn. At 3 Dry: the Dry ends, and every foe takes 60% MGK.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) blaze(b, f, t); } });
defPassive({ id: 'fleur_blooms', name: 'Blooms', owner: 'fleur', text: 'Turn start: heals 2% of its max HP per Dry on the foe.',
  turnStart(b, f) { const t = foe(b, f); if (t) heal(b, f, f, f.maxHp * 0.02 * marked(t, 'fleur_blaze')); } });
defMove({ id: 'fleur_spray', name: 'Spray', type: 'SALT', owner: 'fleur', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 85% MGK. Stun 1 if the foe was Dry.',
  run(c) { const lit = c.marked(c.tgt, 'fleur_blaze') > 0; c.hit(c.tgt, { mgk: 0.85 }); if (lit) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'fleur_bloom', name: 'Salt Bloom', type: 'SALT', owner: 'fleur', reach: 'spread', tags: ['spell'], cd: 1, wu: 30, text: 'Short wind-up. Hits every foe for 62% MGK, 1.25x if the foe is Dry.',
  run(c) { c.spread({ mgk: 0.62 }, { mult: c.marked(c.tgt, 'fleur_blaze') ? 1.25 : 1 }); } });
defMove({ id: 'fleur_crack', name: 'Crack', type: 'SALT', owner: 'fleur', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 76% MGK. If the foe was Dry: each reserve gets 1 Dry.',
  run(c) { const lit = c.marked(c.tgt, 'fleur_blaze') > 0; c.hit(c.tgt, { mgk: 0.76 }); if (lit) for (const r of reserves(c.them)) mark(c.b, c.u, r, 'fleur_blaze', 1, 3); } });
defMove({ id: 'fleur_flower', name: 'Salt Flower', type: 'SALT', owner: 'fleur', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, text: 'Hits 5 times for 40% MGK, bouncing between the foe and reserves.',
  run(c) { const line = [c.tgt, ...reserves(c.them)]; for (let i = 0; i < 5; i++) { const t = line[i % line.length]; if (live(t)) c.hit(t, { mgk: 0.4 }, t === c.tgt ? {} : { reserve: true }); } } });

// madrepore: a coral hand that heals harder, frees its friends when it comes out, holds a hand, raps knuckles, shields a friend, and lends every hand.
defPassive({ id: 'madrepore_kind', name: 'Kind Hand', owner: 'madrepore', text: 'Its heals are 1.3x.',
  healMul() { return 1.3; } });
defPassive({ id: 'madrepore_shaped', name: 'Shaped Hand', owner: 'madrepore', text: 'When it comes out: its first move removes 1 bad status from each ally.',
  comeOut(b, f) { f.k.shapedReady = 1; },
  afterMove(b, f) { if (!f.k.shapedReady) return; f.k.shapedReady = 0; for (const a of standing(b.s[f.side])) cleanse(b, a, 1); } });
defMove({ id: 'madrepore_rap', name: 'Hand Hold', type: 'STONE', owner: 'madrepore', reach: 'ally', cd: 1, text: 'Heals an ally 15% of its max HP. Heals itself 5%.',
  run(c) { c.heal(c.ally!, c.ally!.maxHp * 0.14); if (c.ally !== c.u) c.heal(c.u, c.u.maxHp * 0.05); } });
defMove({ id: 'madrepore_close', name: 'Knuckle Rap', type: 'STONE', owner: 'madrepore', reach: 'single', tags: ['projectile'], cd: 2, text: 'Hits for 161% ATK, 1.5x on a foe below 50% HP.',
  run(c) { c.hit(c.tgt, { atk: 1.61 }, { mult: c.tgt.hp < c.tgt.maxHp * 0.5 ? 1.5 : 1 }); } });
defMove({ id: 'madrepore_palm', name: 'Open Palm', type: 'STONE', owner: 'madrepore', reach: 'ally', cd: 4, text: 'Cleanses an ally. Untouchable 1 on it.',
  run(c) { c.cleanse(c.ally!); c.st(c.ally!, 'invuln', 1); } });
defMove({ id: 'madrepore_hand', name: 'Every Hand', type: 'STONE', owner: 'madrepore', reach: 'team', cd: 6, nerve: 5, text: 'Your team gets Haste 2 and Empower 1. Their cooldowns drop 1, except crests.',
  run(c) { for (const a of standing(c.me)) { c.st(a, 'haste', 2); c.st(a, 'empower', 1); a.cd = a.cd.map((x, i) => (MOVES[a.moves[i]]?.nerve ? x : Math.max(0, x - 1))); } } });

// blush: a pink pearl that shields by the voices it hears, rolls hits, rolls over the line, picks up speed, and leaves seed pearls.
defSummon({ id: 'blush_mine', name: 'Seed Pearl', owner: 'blush', sprite: { px: ['........', '........', '........', '...22...', '..2322..', '..2222..', '.444444.', '........'], c: ['#e8a0b0', '#fff6f9', '#a09071'] }, text: 'Stays until a foe comes out. Hits it for 40% MGK.',
  trap(b, s, who) { const f = ownerOf(b, s); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.4, 'M', 'STONE'); return true; } });
defMark({ id: 'blush_rolling', name: 'trundling', clock: 'own', volatile: true, value: 0.08 });
defPassive({ id: 'blush_voices', name: 'Toward Voices', owner: 'blush', text: 'When it comes out: a shield of 4% of its max HP per foe standing.',
  comeOut(b, f) { giveShield(b, f, f, f.maxHp * 0.04 * standing(b.s[1 - f.side]).length, 3); } });
defPassive({ id: 'blush_gift', name: 'Nacre Gift', owner: 'blush', text: 'Trundling: takes 0.9x damage.',
  inMul(b, f) { return marked(f, 'blush_rolling') ? 0.9 : 1; } });
defMove({ id: 'blush_roll', name: 'Pearl Roll', type: 'STONE', owner: 'blush', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits 3 times for 24% MGK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { mgk: 0.24 }); } });
defMove({ id: 'blush_hum', name: 'Roll Over', type: 'STONE', owner: 'blush', reach: 'spread', tags: ['dash', 'spell'], cd: 3, text: 'Hits every foe for 47% MGK. If it is Trundling: Stun 1. If not: Slow 2.',
  run(c) { const r = marked(c.u, 'blush_rolling') > 0; c.spread({ mgk: 0.47 }); c.st(c.tgt, r ? 'stun' : 'slow', r ? 1 : 2); } });
defMove({ id: 'blush_give', name: 'Hear a Voice', type: 'STONE', owner: 'blush', reach: 'self', tags: ['dash'], cd: 3, wt: 50, text: 'Trundling 2. Haste 2.',
  run(c) { c.st(c.u, 'haste', 2); c.mark(c.u, 'blush_rolling', 1, 2); } });
defMove({ id: 'blush_home', name: 'Rolls Home', type: 'STONE', owner: 'blush', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 50% MGK. Leaves 3 Seed Pearls (4% max HP).',
  run(c) { c.spread({ mgk: 0.5 }); for (let i = 0; i < 3; i++) summon(c.b, c.u, 'blush_mine', { hp: 0.04 }); } });

// cochlea: the Conch's inner spiral that hums through the line, sends an echo, makes a foe and a reserve resonate, and plays it all back louder.
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
defMove({ id: 'cochlea_hum', name: 'Spiral Hum', type: 'VOID', owner: 'cochlea', reach: 'spread', tags: ['spell'], cd: 1, text: 'Hits every foe for 78% MGK. Slow 1.',
  run(c) { c.spread({ mgk: 0.78 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'cochlea_ear', name: 'Inner Ear', type: 'VOID', owner: 'cochlea', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 40% MGK. After 2 of the foe\'s turns: it takes 50% MGK. Silence 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.4 }); if (!c.tgt.ko) c.mark(c.tgt, 'cochlea_phantom', 1, 2); } });
defMove({ id: 'cochlea_bind', name: 'Ring Through', type: 'VOID', owner: 'cochlea', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 65% MGK. Resonant 3 on the foe and its first reserve.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); const r = reserves(c.them)[0]; if (!c.tgt.ko) { c.mark(c.tgt, 'cochlea_bound', 1, 3); if (r) mark(c.b, c.u, r, 'cochlea_bound', 1, 3); } } });
defMove({ id: 'cochlea_louder', name: 'Louder Out', type: 'VOID', owner: 'cochlea', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 140% MGK. Silence 1. Each Resonant reserve takes 140% MGK.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.4 }); c.st(c.tgt, 'silence', 1); for (const r of reserves(c.them)) if (marked(r, 'cochlea_bound')) c.hit(r, { mgk: 1.4 }, { reserve: true }); void d; } });

// samphire: a salt plant that pickles foes, mends its reserves, tosses pods, and drives a salt stake.
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
defMove({ id: 'samphire_mend', name: 'Brine Mend', type: 'ROOT', owner: 'samphire', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 120% MGK. Your reserves heal 5% of max HP.',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }); for (const r of reserves(c.me)) c.heal(r, r.maxHp * 0.05); } });
defMove({ id: 'samphire_pod', name: 'Pod Toss', type: 'ROOT', owner: 'samphire', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 84% MGK. Stun 1. First reserve takes 35% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.84 }); c.st(c.tgt, 'stun', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.84 }, { reserve: true, mult: 0.5 }); } });
defMove({ id: 'samphire_curse', name: 'Pickle', type: 'ROOT', owner: 'samphire', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 48% MGK. Pickled for 3 turns: at each of its turns, the foe loses 25% of the HP it lost since its last turn.',
  run(c) { c.hit(c.tgt, { mgk: 0.48 }); if (!c.tgt.ko) { c.tgt.k.curseHp = c.tgt.hp; c.mark(c.tgt, 'samphire_curse', 1, 3); } } });
defMove({ id: 'samphire_stake', name: 'Stake Down', type: 'ROOT', owner: 'samphire', reach: 'side', cd: 6, nerve: 5, text: 'Summons a Salt Stake (15% of its max HP, 4 turns).',
  run(c) { summon(c.b, c.u, 'samphire_ward', { hp: 0.15, turns: 4 }); } });

// gimbal: a ring in a ring that caps big hits, tips, drains through its inner ring, tilts foes with its outer ring, and levels the fight.
defMark({ id: 'gimbal_drain', name: 'draining', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; const d = strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'GEAR'); heal(b, f, f, d); } });
defMark({ id: 'gimbal_malice', name: 'tilt', max: 5, clock: 'own', negative: true, value: -0.05,
  inMul(b, f) { return 1 + 0.06 * (f.m.gimbal_malice?.n || 0); } });
defPassive({ id: 'gimbal_ride', name: 'Level Ride', owner: 'gimbal', text: 'Any hit above 20% of its max HP deals 0.65x past that point.',
  beforeTake(b, f, src, amt) { const cap = f.maxHp * 0.2; return amt > cap ? cap + (amt - cap) * 0.65 : amt; } });
defPassive({ id: 'gimbal_tips', name: 'Tips Back', owner: 'gimbal', text: 'Below 50% HP: deals 1.3x damage.',
  outMul(b, f) { return f.hp < f.maxHp * 0.5 ? 1.3 : 1; } });
defMove({ id: 'gimbal_tip', name: 'Tip', type: 'GEAR', owner: 'gimbal', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 135% MGK. Pays 4% of its max HP.',
  run(c) { selfCost(c.b, c.u, c.u.maxHp * 0.04); c.hit(c.tgt, { mgk: 1.35 }); } });
defMove({ id: 'gimbal_inner', name: 'Inner Ring', type: 'GEAR', owner: 'gimbal', reach: 'single', tags: ['spell', 'channel'], cd: 3, text: 'Hits for 55% MGK. At its next 2 turns: hits the foe for 35% MGK. Heals all the damage it deals.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.55 }); c.heal(c.u, d); c.mark(c.u, 'gimbal_drain', 1, 2); } });
defMove({ id: 'gimbal_outer', name: 'Outer Ring', type: 'GEAR', owner: 'gimbal', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 44% MGK. 2 Tilt, max 5. Each Tilt: takes 6% more damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.44 }); if (!c.tgt.ko) c.mark(c.tgt, 'gimbal_malice', 2, 3); } });
defMove({ id: 'gimbal_level', name: 'Level', type: 'GEAR', owner: 'gimbal', reach: 'single', tags: ['spell'], cd: 7, nerve: 5, text: 'Its HP % and the foe\'s both become the average of the two.',
  run(c) {
    if (c.blocked(c.tgt) || c.tgt.s.unstop) return;
    const avg = (c.u.hp / c.u.maxHp + c.tgt.hp / c.tgt.maxHp) / 2;
    c.u.hp = Math.max(1, Math.round(c.u.maxHp * avg)); c.tgt.hp = Math.max(1, Math.round(c.tgt.maxHp * avg));
    syncHp(c.b, c.u); syncHp(c.b, c.tgt);
    c.msg('They level out.');
  } });

// lull: the quiet in the Conch's mouth that shushes, sounds a low note, muffles a foe, and goes quiet for a long time.
defMark({ id: 'lull_frag', name: 'lingering', clock: 'own', volatile: true, negative: true, value: -0.04,
  turnStart(b, f) { const mk = unmark(f, 'lull_frag'); const by = mk ? markedBy(b, mk) : null; if (by && live(by)) strike(b, by, f, stat(b, by, 'mgk') * 0.35, 'M', 'VOID'); } });
defMark({ id: 'lull_hush', name: 'muffled', clock: 'own', negative: true, value: -0.08,
  inMul(b, f, src, d) { return d.kind === 'M' ? 1.25 : 1; } });
defMark({ id: 'lull_null', name: 'quieting', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) { splash(b, f, stat(b, f, 'mgk') * 0.4, 'M', 'VOID'); } });
defPassive({ id: 'lull_notes', name: 'Missing Notes', owner: 'lull', text: 'Deals 1.25x damage to a Silenced or Muffled foe.',
  outMul(b, f, t) { return t.s.silence || marked(t, 'lull_hush') ? 1.25 : 1; } });
defPassive({ id: 'lull_mouth', name: 'Quiet Mouth', owner: 'lull', text: 'Once per battle, instead of a KO: Stasis 1, back at 12% HP.',
  wouldKO(b, f) { if (f.k.stopped) return false; f.k.stopped = 1; f.hp = 1; f.s = { stasis: { n: 1, src: -1 } }; f.k.thaw = 1; f.k.thawPct = 12; msg(b, `${label(b, f)} goes very quiet.`); return true; } });
defMove({ id: 'lull_bolt', name: 'Shh', type: 'VOID', owner: 'lull', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 85% MGK. At the foe\'s next turn: 35% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); if (!c.tgt.ko) c.mark(c.tgt, 'lull_frag', 1, 2); } });
defMove({ id: 'lull_note', name: 'Low Note', type: 'VOID', owner: 'lull', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 50% MGK. Weaken 2. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); c.st(c.tgt, 'weaken', 2); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'lull_seal', name: 'Hush Seal', type: 'VOID', owner: 'lull', reach: 'single', tags: ['projectile', 'spell'], cd: 4, text: 'Hits for 50% MGK. Silence 1. Muffled 3: takes 1.25x MGK damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.5 }); c.st(c.tgt, 'silence', 1); c.mark(c.tgt, 'lull_hush', 1, 3); } });
defMove({ id: 'lull_long', name: 'Long Quiet', type: 'VOID', owner: 'lull', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 80% MGK. Silence 1. At its next 2 turns: every foe takes 40% MGK.',
  run(c) { c.spread({ mgk: 0.8 }); c.st(c.tgt, 'silence', 1); c.mark(c.u, 'lull_null', 1, 2); } });

// flange: the Conch's flared lip that spins when struck often, notches foes, flares out, calls names, and opens wide on the weak.
defMark({ id: 'flange_hunger', name: 'notched', clock: 'own', negative: true, value: -0.08,
  turnStart(b, f) { const mk = f.m.flange_hunger; const by = mk ? markedBy(b, mk) : null; if (by && live(by)) strike(b, by, f, stat(b, by, 'atk') * 0.2, 'P', 'GEAR'); } });
defPassive({ id: 'flange_name', name: 'Hears Its Name', owner: 'flange', text: 'Every 3rd hit it takes: hits every foe for 55% ATK.',
  afterTake(b, f, src, dealt, d) { if (d.dot || !src || src.side === f.side || f.k.helixing) return; f.k.helix = (f.k.helix || 0) + 1; if (f.k.helix % 3 !== 0) return; f.k.helixing = 1; msg(b, `${label(b, f)} spins.`); splash(b, f, stat(b, f, 'atk') * 0.55, 'P', 'GEAR'); f.k.helixing = 0; } });
defPassive({ id: 'flange_flared', name: 'Flared', owner: 'flange', text: 'Takes 0.8x damage from a Taunted foe.',
  inMul(b, f, src) { return src && src.s.taunt ? 0.8 : 1; } });
defMove({ id: 'flange_ring', name: 'Lip Notch', type: 'GEAR', owner: 'flange', reach: 'single', cd: 2, text: 'Hits for 58% ATK. Notched 3: takes 20% ATK at each of its turns.',
  run(c) { c.hit(c.tgt, { atk: 0.58 }); if (!c.tgt.ko) c.mark(c.tgt, 'flange_hunger', 1, 3); } });
defMove({ id: 'flange_flare', name: 'Flare Out', type: 'GEAR', owner: 'flange', reach: 'spread', cd: 1, text: 'Hits every foe for 48% ATK.',
  run(c) { c.spread({ atk: 0.48 }); } });
defMove({ id: 'flange_call', name: 'Name Call', type: 'GEAR', owner: 'flange', reach: 'single', cd: 4, text: 'Taunt 2. Fortify 2.',
  run(c) { c.st(c.tgt, 'taunt', 2); c.st(c.u, 'fortify', 2); } });
defMove({ id: 'flange_wide', name: 'Wide Open', type: 'GEAR', owner: 'flange', reach: 'single', cd: 6, nerve: 5, text: 'Hits for 83% ATK. If the foe is left below 25% HP: it is KO\'d, your team gets Haste 2, and its cooldown resets.',
  run(c) {
    c.hit(c.tgt, { atk: 0.83 });
    if (c.tgt.ko || c.blocked(c.tgt) || c.tgt.hp >= c.tgt.maxHp * 0.25) return;
    c.hit(c.tgt, { tgtCur: 1, flat: 1 }, { kind: 'T', noGuard: true });
    if (!c.tgt.ko) return;
    for (const a of standing(c.me)) c.st(a, 'haste', 2);
    ready(c.u, 'flange_wide');
  } });

// pleiad: a fallen star that brings its Sisters, roots with a twinkle, clusters, calls out, and lets seven fall.
defSummon({ id: 'pleiad_sister', name: 'Sister', owner: 'pleiad', text: 'Acts every 1.5 turns with Twinkle or Cluster. Stays until KO\'d.', every: 150,
  sprite: { px: ['........', '.3.3.3..', '..222...', '.21212..', '..242...', '.3.2.3..', '........', '........'], c: ['#ffd84a', '#ff9a20', '#6a78d8'] } });
const sisters = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'pleiad_sister').length;
function addSister(b: Battle, f: Fighter): void {
  if (sisters(b, f) < 3) summonTwin(b, f, 'pleiad_sister', { hp: 0.15, moves: ['pleiad_twinkle', 'pleiad_cluster'], link: 0.08 });
}
defPassive({ id: 'pleiad_six', name: 'Looks for Six', owner: 'pleiad', text: 'When it comes out: a Sister (15% max HP) if none. Up to 3. Each KO\'d costs it 8% HP.',
  comeOut(b, f) { if (!sisters(b, f)) addSister(b, f); } });
defPassive({ id: 'pleiad_sisters', name: 'Sisters', owner: 'pleiad', text: 'Each Sister standing: takes 3% less damage.',
  inMul(b, f) { return 1 - 0.03 * sisters(b, f); } });
defMove({ id: 'pleiad_twinkle', name: 'Twinkle', type: 'STAR', owner: 'pleiad', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 80% MGK. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.8 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'pleiad_cluster', name: 'Cluster', type: 'STAR', owner: 'pleiad', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 62% MGK + 15% MGK per Sister.',
  run(c) { c.hit(c.tgt, { mgk: 0.62 + 0.15 * sisters(c.b, c.u) }); } });
defMove({ id: 'pleiad_call', name: 'Call Out', type: 'STAR', owner: 'pleiad', reach: 'side', cd: 3, text: 'Calls a Sister. Its next turn comes 20% sooner.',
  run(c) { addSister(c.b, c.u); c.hasten(c.u, 20); } });
defMove({ id: 'pleiad_seven', name: 'Seven Fall', type: 'STAR', owner: 'pleiad', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits every foe for 71% MGK + 20% per Sister. Calls 2 Sisters.',
  run(c) { c.spread({ mgk: 0.71 + 0.2 * sisters(c.b, c.u) }); addSister(c.b, c.u); addSister(c.b, c.u); } });

// aphelion: a returning star that grows stronger as it burns down, leaves a glow, swings back, and comes back hard.
defMark({ id: 'aphelion_spears', name: 'glow', max: 5, clock: 'own', negative: true, value: -0.06,
  turnStart(b, f) { const mk = f.m.aphelion_spears; const by = mk ? markedBy(b, mk) : null; if (mk) dealDamage(b, by && live(by) ? by : null, f, (by ? stat(b, by, 'mgk') : 50) * 0.1 * mk.n, dot('M'), null); } });
defPassive({ id: 'aphelion_way', name: 'On Its Way', owner: 'aphelion', text: 'Deals up to 1.35x damage and acts up to 20% sooner as its HP falls.',
  outMul(b, f) { return 1 + 0.35 * (1 - f.hp / f.maxHp); },
  turnEnd(b, f) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - Math.round(20 * (1 - f.hp / f.maxHp))); } });
defPassive({ id: 'aphelion_far', name: 'Far Side', owner: 'aphelion', text: 'Turn start, below 40% HP: heals 3% of its max HP.',
  turnStart(b, f) { if (f.hp < f.maxHp * 0.4) heal(b, f, f, f.maxHp * 0.03); } });
defMove({ id: 'aphelion_spear', name: 'Return Flare', type: 'STAR', owner: 'aphelion', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 87% MGK. Adds 1 Glow for 4 turns, up to 5. Each Glow: 10% MGK each turn. Pays 3% of its max HP.',
  run(c) { selfCost(c.b, c.u, c.u.maxHp * 0.03); c.hit(c.tgt, { mgk: 0.87 }); if (!c.tgt.ko) c.mark(c.tgt, 'aphelion_spears', 1, 4); } });
defMove({ id: 'aphelion_farout', name: 'Far Out', type: 'STAR', owner: 'aphelion', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 92% MGK, 1.3x while it is below 50% HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.92 }, { mult: c.u.hp < c.u.maxHp * 0.5 ? 1.3 : 1 }); } });
defMove({ id: 'aphelion_swing', name: 'Swing Back', type: 'STAR', owner: 'aphelion', reach: 'spread', tags: ['spell'], cd: 3, text: 'Hits every foe for 64% MGK. Weaken 1. Heals 8% of its max HP.',
  run(c) { c.spread({ mgk: 0.64 }); c.st(c.tgt, 'weaken', 1); c.heal(c.u, c.u.maxHp * 0.08); } });
defMove({ id: 'aphelion_back', name: 'Comes Back', type: 'STAR', owner: 'aphelion', reach: 'single', tags: ['dash'], cd: 6, nerve: 5, text: 'Hits for 56% MGK + 25% of the foe\'s current HP. Slow 2. Pays 10% HP.',
  run(c) { selfCost(c.b, c.u, c.u.maxHp * 0.1); c.hit(c.tgt, { mgk: 0.56, tgtCur: 0.25 }); c.st(c.tgt, 'slow', 2); } });

// astrolabe: a brass star-measurer that marks every fourth hit, rings the field, showers stars, and takes a last reading.
defMark({ id: 'astrolabe_shrapnel', name: 'shards falling', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; strike(b, f, t, stat(b, f, 'mgk') * 0.3, 'M', 'GEAR'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'astrolabe_measuring', name: 'Measuring', owner: 'astrolabe', text: 'Every 4th hit it lands deals 1.6x and delays the foe\'s next turn by 20%.',
  outMul(b, f, t, d) { return !d.dot && !d.reserve && (f.k.reading || 0) % 4 === 3 ? 1.6 : 1; },
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side) return; if ((f.k.reading || 0) % 4 === 3 && live(t)) delayFighter(b, t, 20); f.k.reading = (f.k.reading || 0) + 1; } });
defPassive({ id: 'astrolabe_longsight', name: 'Long Sight', owner: 'astrolabe', text: 'Deals 1.25x damage to a foe winding up.',
  outMul(b, f, t) { return b.pend.some(p => p.kind === 'windup' && p.side === t.side && p.idx === t.idx) ? 1.25 : 1; } });
defMove({ id: 'astrolabe_sight', name: 'Sight Line', type: 'GEAR', owner: 'astrolabe', reach: 'single', tags: ['projectile', 'spell'], cd: 1, text: 'Hits for 107% MGK. Counts as 2 hits toward Measuring.',
  run(c) { c.hit(c.tgt, { mgk: 1.07 }); if (!c.preview && (c.u.k.reading || 0) % 4 !== 3) c.u.k.reading = (c.u.k.reading || 0) + 1; } });
defMove({ id: 'astrolabe_ring', name: 'Brass Ring', type: 'GEAR', owner: 'astrolabe', reach: 'spread', tags: ['projectile', 'spell'], cd: 3, text: 'Hits every foe for 64% MGK. Slow 2. Its next turn comes 30% sooner.',
  run(c) { c.spread({ mgk: 0.64 }); c.st(c.tgt, 'slow', 2); c.hasten(c.u, 30); } });
defMove({ id: 'astrolabe_shower', name: 'Star Shower', type: 'GEAR', owner: 'astrolabe', reach: 'single', tags: ['projectile', 'spell'], cd: 3, text: 'Hits for 43% MGK. At its next 3 turns: hits the foe for 30% MGK, Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.43 }); c.mark(c.u, 'astrolabe_shrapnel', 1, 3); } });
defMove({ id: 'astrolabe_last', name: 'Last Reading', type: 'GEAR', owner: 'astrolabe', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 5, wu: 100, unstop: true, text: 'Unstoppable long wind-up. Hits for 225% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 2.25 }); } });

// pallasite: a green fallen star in a shell that chills foes, sparks, raises a shell wall, and shuts the shell when hurt.
defSummon({ id: 'pallasite_wall', name: 'Shell Wall', owner: 'pallasite', text: 'Takes the single-target hits meant for your out whorl.', every: 100, guard: true,
  sprite: { px: ['........', '3.3..3.3', '33333333', '32222223', '32222223', '33333333', '44444444', '44444444'], c: ['#ebf3fa', '#73bbe3', '#395594'] },
  act() { /* the wall only stands */ } });
defMark({ id: 'pallasite_chill', name: 'chill', max: 3, clock: 'own', negative: true, volatile: true, value: -0.06 });
defMark({ id: 'pallasite_blizzard', name: 'shut in', clock: 'own', negative: true, volatile: true, value: -0.15,
  expire(b, f, mk) { const by = markedBy(b, mk); msg(b, `${label(b, f)} freezes in place.`); applyStatus(b, by, f, 'stun', 1); } });
defPassive({ id: 'pallasite_caught', name: 'Caught Shell', owner: 'pallasite', text: 'Once per battle, instead of a KO: Stasis 1, back at 25% HP.',
  wouldKO(b, f) { if (f.k.caught) return false; f.k.caught = 1; f.hp = 1; f.s = { stasis: { n: 1, src: -1 } }; f.k.thaw = 1; f.k.thawPct = 25; msg(b, `${label(b, f)} shuts its shell.`); return true; } });
defPassive({ id: 'pallasite_unspent', name: 'Unspent', owner: 'pallasite', text: 'Above 75% HP: deals 1.15x damage.',
  outMul(b, f) { return f.hp > f.maxHp * 0.75 ? 1.15 : 1; } });
defMove({ id: 'pallasite_glint', name: 'Green Glint', type: 'STAR', owner: 'pallasite', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 85% MGK. Slow 1. 1 Chill. At 3 Chill: Stun 1, Chill ends.',
  run(c) { c.hit(c.tgt, { mgk: 0.85 }); c.st(c.tgt, 'slow', 1); if (c.tgt.ko) return; c.mark(c.tgt, 'pallasite_chill', 1, 2); if (marked(c.tgt, 'pallasite_chill') >= 3) { unmark(c.tgt, 'pallasite_chill'); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'pallasite_sparks', name: 'Green Sparks', type: 'STAR', owner: 'pallasite', reach: 'single', tags: ['projectile', 'spell'], cd: 2, text: 'Hits for 130% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.3 }); } });
defMove({ id: 'pallasite_dive', name: 'Half Shell', type: 'STAR', owner: 'pallasite', reach: 'side', cd: 4, text: 'Summons a Shell Wall (20% of its max HP, 2 turns).',
  run(c) { summon(c.b, c.u, 'pallasite_wall', { hp: 0.2, turns: 2 }); } });
defMove({ id: 'pallasite_nova', name: 'Shell Nova', type: 'STAR', owner: 'pallasite', reach: 'spread', tags: ['projectile', 'spell'], cd: 6, nerve: 5, text: 'Hits every foe for 90% MGK. Slow 2. If the foe is still out after 2 of its turns: Stun 1.',
  run(c) { c.spread({ mgk: 0.9 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'pallasite_blizzard', 1, 2); } });

// halophile: a pink salt bloom that drains tide, stains a foe stiff, and pools pinker with every fall.
defMark({ id: 'halophile_hex', name: 'stained', clock: 'own', volatile: true, negative: true, value: -0.25,
  forbid(b, f, what) { return what === 'attack' ? null : 'Stained.'; },
  inMul() { return 1.15; } });
defPassive({ id: 'halophile_water', name: 'Pink Water', owner: 'halophile', text: 'When it comes out: the foe\'s side loses 1 tide.',
  comeOut(b, f) { addNerve(b, otherSide(f), -1); } });
defPassive({ id: 'halophile_lip', name: 'Lip Color', owner: 'halophile', text: 'When a foe is KO\'d: Pink Pool deals +20% damage for the battle.',
  anyKO(b, f, v) { if (v.side !== f.side) f.k.fingers = (f.k.fingers || 0) + 1; } });
defMove({ id: 'halophile_bloom', name: 'Pink Bloom', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 78% MGK. Stun 1. First reserve takes 30% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 0.78 }); c.st(c.tgt, 'stun', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.78 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'halophile_draw', name: 'Salt Draw', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell', 'channel'], cd: 1, text: 'Hits for 83% MGK. Takes 1 tide from the foe\'s side.',
  run(c) { c.hit(c.tgt, { mgk: 0.83 }); if (c.them.nerve > 0 && !c.blocked(c.tgt)) { c.nerve(c.them, -1); c.nerve(c.me, 1); } } });
defMove({ id: 'halophile_stain', name: 'Stain Water', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell'], cd: 4, text: 'Stained 1: the foe can only attack, and takes 1.15x damage.',
  run(c) { if (!c.tgt.s.unstop) c.mark(c.tgt, 'halophile_hex', 1, 1); } });
defMove({ id: 'halophile_pink', name: 'Pink Pool', type: 'SALT', owner: 'halophile', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 147% MGK, +20% per foe KO\'d this battle.',
  run(c) { c.hit(c.tgt, { mgk: 1.47 }, { mult: 1 + 0.2 * (c.u.k.fingers || 0) }); } });

// heirloom: the Tray's oldest whorl that throws old dust, drains with a faded label, slips off, and takes a foe's crest to keep.
defMark({ id: 'heirloom_taken', name: 'move taken', max: 1, value: -0.3,
  forbid(b, f, what) { return isMove(what) && f.k.heirTaken && f.moves[f.k.heirTaken - 1] === what.id ? 'Taken.' : null; } });
defPassive({ id: 'heirloom_unknown', name: 'Unknown Grower', owner: 'heirloom', text: 'When it uses a move: its next attack also hits reserves for 40% MGK.',
  afterMove(b, f) { f.k.burst = 1; },
  afterAttack(b, f) { if (!f.k.burst) return; f.k.burst = 0; for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.4, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'heirloom_longest', name: 'Kept Longest', owner: 'heirloom', text: 'Immune to Silence. Cannot be forced out.',
  statusImmune(f, id) { return id === 'silence'; },
  immovable() { return true; } });
defMove({ id: 'heirloom_dust', name: 'Old Dust', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 120% MGK. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 1.2 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'heirloom_faded', name: 'Faded Label', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 109% MGK. Heals 30% of the damage dealt, 60% below 50% HP.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.09 }); c.heal(c.u, d * (c.u.hp < c.u.maxHp * 0.5 ? 0.6 : 0.3)); } });
defMove({ id: 'heirloom_nobody', name: 'Nobody Knows', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['dash', 'spell'], cd: 3, text: 'Hits for 87% MGK. 12% max HP shield. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.87 }); c.shield(c.u, c.u.maxHp * 0.12, 2); c.hasten(c.u, 20); } });
defMove({ id: 'heirloom_take', name: 'Take to Keep', type: 'VOID', owner: 'heirloom', reach: 'single', tags: ['spell'], cd: 6, nerve: 4,
  text: 'Hits for 87% MGK. Takes the foe\'s crest for the battle, in this slot.',
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

// lodestar: the Gleaner's walked-by star that keeps foes in order, places Fixed Stars, spends them to delay and hold, and keeps its course.
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
defMark({ id: 'lodestar_divide', name: 'behind a divide', clock: 'own', volatile: true, value: 0.15,
  intercept(b, f, user, m) { return isOut(b, f) && user.side !== f.side && m.tags?.includes('projectile') ? 'block' : null; } });
defPassive({ id: 'lodestar_walked', name: 'Walked By', owner: 'lodestar', text: 'While it is out: the foe never takes two turns in a row. Can\'t be delayed.',
  noDelay() { return true; },
  comeOut(b, f) { const t = foeOf(b, f); if (live(t)) mark(b, f, t, 'lodestar_kept', 1, -1); },
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f)) mark(b, f, who, 'lodestar_kept', 1, -1); } });
defPassive({ id: 'lodestar_steady', name: 'Star Chart', owner: 'lodestar', text: 'When it comes out: 2 Fixed Stars (6% max HP), up to 3. Immune to Stun, Slow.',
  statusImmune(f, id) { return id === 'stun' || id === 'slow'; },
  comeOut(b, f) { placeStar(b, f); placeStar(b, f); } });
defMove({ id: 'lodestar_bearing', name: 'Bearing', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 1, text: 'Hits for 142% MGK. If it spends a Fixed Star: delays the foe\'s next turn by 30%.',
  run(c) { c.hit(c.tgt, { mgk: 1.42 }); if (!c.tgt.ko && !c.blocked(c.tgt) && spendStar(c.b, c.u)) c.delay(c.tgt, 30); } });
defMove({ id: 'lodestar_fix', name: 'Star Fix', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 2, text: 'Hits for 116% MGK. Weaken 1. Places a Fixed Star.',
  run(c) { placeStar(c.b, c.u); c.hit(c.tgt, { mgk: 1.16 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'lodestar_steer', name: 'Steer By', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 3, text: 'Hits for 110% MGK. Expose 2. If it spends a Fixed Star: the foe can\'t switch for 2 turns.',
  run(c) { if (c.blocked(c.tgt)) return; c.hit(c.tgt, { mgk: 1.1 }); c.st(c.tgt, 'expose', 2); if (!c.tgt.ko && spendStar(c.b, c.u)) c.mark(c.tgt, 'lodestar_steer', 1, 2); } });
defMove({ id: 'lodestar_course', name: 'Kept Course', type: 'STAR', owner: 'lodestar', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, text: 'Hits for 194% MGK. 2 turns: blocks the foe\'s projectile moves.',
  run(c) { c.hit(c.tgt, { mgk: 1.94 }); c.mark(c.u, 'lodestar_divide', 1, 2); } });

// ammonite: an old coil that sleeps until struck, keeps what hits it as Struck, knocks, ridges, charges with its septa, and gives it all back.
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
defMove({ id: 'ammonite_knock', name: 'Coil Knock', type: 'STONE', owner: 'ammonite', reach: 'spread', cd: 3, text: 'Hits every foe for 64% ATK. Stun 1.',
  run(c) { c.spread({ atk: 0.64 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'ammonite_ridge', name: 'Spiral Ridge', type: 'STONE', owner: 'ammonite', reach: 'single', cd: 1, text: 'Hits for 108% ATK. Pays 5% of its max HP, which adds to Struck.',
  run(c) {
    selfCost(c.b, c.u, c.u.maxHp * 0.05);
    c.hit(c.tgt, { atk: 1.08 });
    if (!c.preview) c.u.k.struck = Math.min(c.u.maxHp * 0.6, (c.u.k.struck || 0) + c.u.maxHp * 0.05);
  } });
defMove({ id: 'ammonite_septa', name: 'Septa', type: 'STONE', owner: 'ammonite', reach: 'team', cd: 4, text: 'Haste 2 on your team. Fortify 1. Struck grows by 10% of its max HP.',
  run(c) {
    for (const a of standing(c.me)) c.st(a, 'haste', 2);
    c.st(c.u, 'fortify', 1);
    if (!c.preview) c.u.k.struck = Math.min(c.u.maxHp * 0.6, (c.u.k.struck || 0) + c.u.maxHp * 0.1);
  } });
defMove({ id: 'ammonite_all', name: 'All Struck', type: 'STONE', owner: 'ammonite', reach: 'single', cd: 6, nerve: 5,
  text: 'Hits for 100% ATK + all its Struck. If Struck was 30% of its max HP or more: Stun 1.',
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
  inMul(b, f, src) { return src && placer(b, f, 'gleaner_label') === src ? 1.15 : 1; } });
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
defPassive({ id: 'gleaner_wade', name: 'Wading', owner: 'gleaner', text: 'Turn start, unhit since its last turn: repeats its last attack at 0.8x.',
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
    runMove(b, f, f.k.wadeMove - 1, {}, false, 0.8);
  } });
defPassive({ id: 'gleaner_listening', name: 'Listening', owner: 'gleaner', text: '1.3x max HP. Takes 0.8x damage, 1.3x while it holds a whorl to its ear.',
  start(b, f) { f.maxHp = Math.round(f.maxHp * 1.3); f.hp = f.maxHp; },
  inMul(b, f) { return marked(f, 'gleaner_ear') ? 1.3 : 0.8; },
  immovable() { return true; },
  forbid(b, f, what) { return isMove(what) && what.id === 'gleaner_hold' && !marked(foeOf(b, f), 'gleaner_label') ? 'It labels first.' : null; },
  anyKO(b, f, v) {
    if (!f.k.held) return;
    if (v === f) { setDown(b, f); return; }
    const side = Math.floor((f.k.held - 1) / 8) as 0 | 1;
    if (v.side === side && standing(b.s[side]).length === 0) setDown(b, f);
  } });
defMove({ id: 'gleaner_listen', name: 'Listen', type: 'VOID', owner: 'gleaner', reach: 'single', cd: 1, text: 'Hits for 125% ATK. +12% damage per foe move on cooldown, up to 4.',
  run(c) { c.hit(c.tgt, { atk: 1.25 }, { mult: 1 + 0.12 * Math.min(4, onCooldown(c.tgt)) }); } });
defMove({ id: 'gleaner_label', name: 'Label', type: 'VOID', owner: 'gleaner', reach: 'single', cd: 3,
  text: 'Hits for 95% ATK. Labeled 3: can\'t switch, takes 1.15x from it.',
  run(c) { if (c.blocked(c.tgt)) return; c.hit(c.tgt, { atk: 0.95 }); labelFoe(c.b, c.u, c.tgt, c); } });
defMove({ id: 'gleaner_setdown', name: 'Set Down', type: 'BEAST', owner: 'gleaner', reach: 'single', cd: 3,
  text: 'Hits for 115% ATK. Forces the foe out. Labeled 3 on the new foe.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    c.hit(c.tgt, { atk: 1.15 });
    if (live(c.tgt) && c.forceOut()) labelFoe(c.b, c.u, c.them.f[c.them.out]);
  } });
defMove({ id: 'gleaner_hold', name: 'Hold to Ear', type: 'VOID', owner: 'gleaner', reach: 'single', cd: 6, nerve: 4, wt: 200,
  text: 'Lifts a Labeled foe out for 2 turns. Its next turn comes 100% later.',
  run(c) { if (c.blocked(c.tgt) || c.preview || !live(c.tgt)) return; lift(c.b, c.u, c.tgt); } });

// ================================================================ notions

defNotion({ id: 'tallystone', name: 'Tally Stone', price: 600, text: '+3% ATK and MGK. Every 4th turn it takes: +1 tide.',
  pct: { atk: 0.03, mgk: 0.03 },
  turnEnd(b, f) { f.k.tally = (f.k.tally || 0) + 1; if (f.k.tally % 4 === 0) addNerve(b, f.side, 1); } });
defNotion({ id: 'siphoncup', name: 'Siphon Cup', price: 700, text: '+3% HP. Its crests heal it 2% of max HP per tide they cost.',
  pct: { hp: 0.03 },
  afterMove(b, f, m) { if (m.nerve) heal(b, f, f, f.maxHp * 0.02 * m.nerve); } });
defMark({ id: 'siphonhood_seal', name: 'sealed note', negative: true, max: 1, clock: 'own', value: -0.15,
  forbid(b, f, what) { const mk = f.m.siphonhood_seal; return mk && isMove(what) && f.moves[mk.v - 1] === what.id ? 'Sealed.' : null; } });
defNotion({ id: 'siphonhood', name: 'Siphon\'s Hood', price: 800, text: '+10% RES. Action, once: seals the foe\'s last-used move for 2 turns.',
  pct: { res: 0.1 },
  action: { name: 'Siphon\'s Hood', run(b, f) {
    const t = foeOf(b, f);
    const i = live(t) ? (t.k.lastMove || 0) - 1 : -1;
    if (i < 0) { msg(b, 'There is nothing to seal.'); return; }
    mark(b, f, t, 'siphonhood_seal', 1, 2, i + 1);
    msg(b, `${label(b, t)} cannot use ${MOVES[t.moves[i]]?.name || 'that move'} for 2 turns.`);
  } } });
defNotion({ id: 'polishedring', name: 'Polished Ring', price: 600, text: '+2% ATK and MGK. Its first hit deals 1.1x damage and ignores guard and Fortify.',
  pct: { atk: 0.02, mgk: 0.02 },
  outMul(b, f, t, d) {
    if (f.k.ringDone || d.dot || d.reserve) return 1;
    let m = 1.1;
    if (t.s.guard && !d.move?.noGuard) m *= 2;
    if (t.s.fortify) m /= 1 - (t.s.fortify.v || 0.25);
    return m;
  },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) f.k.ringDone = 1; } });

export const KITS6_NOTIONS = ['tallystone', 'siphoncup', 'siphonhood', 'polishedring'];
