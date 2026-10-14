import { keepMove, retypeMove, typeOn, lieInWait, summonTwin, raiseSwell, SWELL_BREAK, barred, doSwitch, setWind, holdTide, addMirage, setRange, swapBodies, fracture, shutIn, storeAway, shiftCd, addPoise, comeDue, startChannel,
  addNerve, applyStatus, banish, dismiss, forceAction, summon, summonsOf, canSwitch, cleanse, clearForm, dealDamage, roundOf, delayFighter, disguise, dragIn, emit, foeOf, giveShield, has, hastenFighter, heal, isOut,
  label, mark, marked, markedBy, msg, reserves, runMove, setForm, setMove, sk, standing, stat, takeOver, unmark, SPREAD_SHARE,
} from '../battle/engine';
import type { Battle, Fighter, SpriteData, Summon } from '../battle/model';
import { defMark, defMove, defPassive, defSummon, MOVES, type Ctx, type DmgInfo } from '../battle/registry';

/** The fighter that made a summon, or null once it is down. */
const ownerOf = (b: Battle, s: Summon): Fighter | null => { const f = b.s[s.side].f[s.by]; return f && !f.ko ? f : null; };
import type { Type } from './types';

const dot = (kind: 'P' | 'M' | 'T'): DmgInfo => ({ kind, move: null, attack: false, dot: true, spread: false, reserve: false });
const pctOut = (t: Fighter, p: number) => t.hp < t.maxHp * p;
const foe = (b: Battle, f: Fighter): Fighter | null => { const t = foeOf(b, f); return t && !t.ko && !t.gone ? t : null; };
const lowestAlly = (c: Ctx): Fighter => standing(c.me).slice().sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0] || c.u;

/** A hit from a passive or mark: typed and mitigated like a move, outside any move. */
function strike(b: Battle, src: Fighter | null, t: Fighter, raw: number, kind: 'P' | 'M' | 'T', type: Type | null): number {
  if (!t || t.ko || t.gone || raw <= 0) return 0;
  return dealDamage(b, src && !src.ko ? src : null, t, raw, { kind, move: null, attack: false, dot: false, spread: false, reserve: !isOut(b, t) }, kind === 'T' ? null : type);
}
/** A spread hit from a passive or mark: the out foe in full, each foe reserve at the spread share. */
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
function ready(f: Fighter, id: string): void { const i = f.moves.indexOf(id); if (i >= 0) f.cd[i] = 0; }
/** A stun put on a whorl at the start of its own turn lasts that turn only. */
function stunNow(b: Battle, src: Fighter | null, t: Fighter): boolean {
  if (!applyStatus(b, src, t, 'stun', 1)) return false;
  if (t.s.stun) t.s.stun.src = -1;
  return true;
}
const FEAR_TEXT = 'Afraid.';

// ================================================================ meadow and tanning

// dandle: a dandelion clock gone to seed whose Seeds are small clocks in the foe, and whose breath makes everything on the foe come due.
defMark({ id: 'dandle_seed', name: 'seeded', max: 4, clock: 'own', negative: true, value: -0.05,
  expire(b, f, mk) { dandleBloom(b, markedBy(b, mk), f, mk.n, 1); } });
function dandleBloom(b: Battle, src: Fighter | null, t: Fighter, n: number, mult: number): number {
  if (!n || t.ko || t.gone) return 0;
  msg(b, `${n} seed${n > 1 ? 's' : ''} bloom on ${label(b, t)}.`);
  return strike(b, src, t, (src ? stat(b, src, 'mgk') : 60) * 0.3 * n * mult, 'M', 'ROOT');
}
defPassive({ id: 'dandle_seedhead', name: 'Seed Clock', owner: 'dandle', text: 'When it uses a move: 1 Seed on the foe, max 4. Seeds bloom in 2 foe turns: 30% MGK.',
  afterMove(b, f, m, c) { const t = foe(b, f); if (t && !c.blocked(t)) mark(b, f, t, 'dandle_seed', 1, 2); } });
defPassive({ id: 'dandle_garden', name: 'Last Puff', owner: 'dandle', text: 'When it is KO\'d: hits the foe for 60% MGK. Everything on the foe comes due.',
  anyKO(b, f, v) {
    if (v !== f) return;
    const t = foe(b, f);
    if (!t) return;
    strike(b, f, t, stat(b, f, 'mgk') * 0.6, 'M', 'ROOT');
    comeDue(b, f, t);
  } });
defMove({ id: 'dandle_sow', name: 'Puff Blow', type: 'ROOT', owner: 'dandle', reach: 'single', tags: ['spell'], cd: 1, fx: 'swell | feather*3 line fast | bloom', text: 'Hits for 129% MGK. The foe\'s Seeds bloom now at 1.33x.',
  run(c) { c.hit(c.tgt, { mgk: 1.29 }); if (c.tgt.ko || c.blocked(c.tgt)) return; const mk = unmark(c.tgt, 'dandle_seed'); if (mk) dandleBloom(c.b, c.u, c.tgt, mk.n, 1.33); } });
defMove({ id: 'dandle_spines', name: 'Seed Drift', type: 'TIDE', owner: 'dandle', reach: 'single', tags: ['spell'], cd: 2, fx: 'sway | feather*5 wave slow | puff',
  text: 'Hits for 64% MGK. 2 Seeds. 1 Seed on each foe reserve.',
  run(c) { c.hit(c.tgt, { mgk: 0.64 }); if (!c.tgt.ko) c.mark(c.tgt, 'dandle_seed', 2, 2); for (const r of reserves(c.them)) c.mark(r, 'dandle_seed', 1, 2); } });
defMove({ id: 'dandle_snarl', name: 'Tell the Hour', type: 'STONE', owner: 'dandle', reach: 'single', tags: ['spell'], cd: 3, fx: 'lift | rune*4 orbit | sigil bloom',
  text: 'Hits for 94% MGK. Root 2. Slow 1 per Seed. Everything on the foe comes due.',
  run(c) {
    const n = c.marked(c.tgt, 'dandle_seed');
    c.hit(c.tgt, { mgk: 0.94 }); c.st(c.tgt, 'root', 2); if (n) c.st(c.tgt, 'slow', n);
    if (!c.tgt.ko && !c.blocked(c.tgt)) comeDue(c.b, c.u, c.tgt);
  } });
defMove({ id: 'dandle_thornburst', name: 'Blow Apart', type: 'ROOT', owner: 'dandle', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 60, fx: 'swell big | feather*8 sweep | bloom all big tint jolt',
  text: 'Wind-up. Hits for 129% MGK. Splash 35%. Stun 1. Every foe\'s Seeds bloom at 2x.',
  run(c) {
    c.spread({ mgk: 1.29 }); c.st(c.tgt, 'stun', 1);
    for (const t of [c.tgt, ...reserves(c.them)]) {
      if (t.ko || t.gone || c.blocked(t)) continue;
      const mk = unmark(t, 'dandle_seed');
      if (mk) dandleBloom(c.b, c.u, t, mk.n, 2);
    }
  } });

// mawkin: a scarecrow's shell stuffed with dry kelp that looks like a friend until it moves, frightens foes off, and has its crows pick them clean.
defMark({ id: 'mawkin_fear', name: 'afraid', clock: 'own', volatile: true, negative: true, value: -0.1 });
defMark({ id: 'mawkin_drain', name: 'pecking', clock: 'own', volatile: true, value: 0.14,
  turnStart(b, f) {
    const t = foe(b, f);
    if (!t) return;
    const d = strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'ROOT');
    heal(b, f, f, d * 0.6);
    const g = GOODS.find(id => t.s[id]);
    if (g && !t.ko) { delete t.s[g]; msg(b, `The crows pick ${label(b, t)} clean.`); }
  } });
defMark({ id: 'mawkin_crows', name: 'crows out', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { msg(b, 'The crows come round again.'); splash(b, f, stat(b, f, 'mgk') * 0.45, 'M', 'ROOT'); } });
/** Frightens a foe: it runs from the field at its next turn, and stays afraid a turn. */
function frighten(c: Ctx, t: Fighter): void { if (t.ko || c.blocked(t)) return; c.mark(t, 'mawkin_fear', 1, 1); forceAction(c.b, t, 'switch'); }
defPassive({ id: 'mawkin_effigy', name: 'Looks Like One', owner: 'mawkin', text: 'When it comes out: looks like its first reserve until it acts. Disguised moves deal 1.3x.',
  comeOut(b, f) { const a = reserves(b.s[f.side])[0]; if (a) disguise(b, f, a); },
  outMul(b, f, t, d) { return f.disguise && d.move ? 1.3 : 1; },
  anyMove(b, f, user) { if (user === f && f.disguise) { disguise(b, f, null); msg(b, `It was ${label(b, f)} all along.`); } },
  leave(b, f) { disguise(b, f, null); } });
defPassive({ id: 'mawkin_dread', name: 'Scare', owner: 'mawkin', text: 'Deals 1.2x damage to a foe that is Afraid or below 40% HP.',
  outMul(b, f, t) { return marked(t, 'mawkin_fear') || pctOut(t, 0.4) ? 1.2 : 1; } });
defMove({ id: 'mawkin_rattle', name: 'Kelp Swipe', type: 'TIDE', owner: 'mawkin', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | kelp sweep | slash',
  text: 'Hits for 129% MGK. Slow 1. 1.4x damage if the foe is Afraid.',
  run(c) { c.hit(c.tgt, { mgk: 1.29 }, { mult: c.marked(c.tgt, 'mawkin_fear') ? 1.4 : 1 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'mawkin_terrify', name: 'Flap Up', type: 'ROOT', owner: 'mawkin', reach: 'single', tags: ['spell'], cd: 4, fx: 'shake | feather*4 sweep | daze',
  text: 'Hits for 86% MGK, 2x if Afraid. Afraid 1. It must switch at its next turn.',
  run(c) { c.hit(c.tgt, { mgk: 0.86 }, { mult: c.marked(c.tgt, 'mawkin_fear') ? 2 : 1 }); frighten(c, c.tgt); } });
defMove({ id: 'mawkin_glean', name: 'Pick Clean', type: 'ROOT', owner: 'mawkin', reach: 'single', tags: ['spell', 'channel'], cd: 3, fx: 'recoil | feather*3 zigzag | bite',
  text: 'Hits for 49% MGK. Its next 2 turns: 35% MGK, heals 60% of it, takes a good status.',
  run(c) { c.hit(c.tgt, { mgk: 0.49 }); if (c.mark(c.u, 'mawkin_drain', 1, 2)) startChannel(c.b, c.u, [{ on: c.u, id: 'mawkin_drain' }]); } });
defMove({ id: 'mawkin_crowstorm', name: 'Crows Come In', type: 'ROOT', owner: 'mawkin', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, wu: 60, fx: 'lift big | feather*8 converge | claw all big dark jolt',
  text: 'Wind-up. Hits for 93% MGK. Splash 35%. Every foe: Afraid 1. Next 2 turns: 45% MGK, Splash 35%.',
  run(c) { c.spread({ mgk: 0.93 }); for (const t of [c.tgt, ...reserves(c.them)]) if (!t.ko && !t.gone) c.mark(t, 'mawkin_fear', 1, 1); c.mark(c.u, 'mawkin_crows', 1, 2); } });

// fleam: a farrier's fleam with six blades and no handle that leaves a Blade in all it touches, draws them all at once, and opens them to bleed.
defMark({ id: 'fleam_spear', name: 'blades', max: 8, clock: 'own', negative: true, value: -0.05 });
const lodge = (b: Battle, f: Fighter, t: Fighter, n: number) => { if (!t.ko && !t.gone && t.side !== f.side) mark(b, f, t, 'fleam_spear', n, 3); };
defPassive({ id: 'fleam_lodged', name: 'Leaves a Blade', owner: 'fleam', text: 'Its hits lodge a Blade, up to 8, for 3 turns. When it attacks: its next turn comes 20% sooner.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && !f.k.rending) lodge(b, f, t, 1); },
  afterAttack(b, f) { hastenFighter(b, f, 20); } });
defPassive({ id: 'fleam_letting', name: 'Spare Blades', owner: 'fleam', text: 'In reserve: hits by your out whorl lodge Blades too.',
  auraOut(b, f, o, t, d) { if (!d.dot && !d.reserve && t.side !== f.side) lodge(b, f, t, 1); return 1; } });
defMove({ id: 'fleam_pierce', name: 'Nick', type: 'GEAR', owner: 'fleam', reach: 'single', tags: ['projectile'], cd: 1, fx: 'shard line fast | slash', text: 'Hits for 179% ATK. 1 Blade, or 2 on a foe that came out since its last turn.',
  run(c) { const fresh = c.tgt.outAt > (c.u.k.prevTurn ?? -1); c.hit(c.tgt, { atk: 1.79 }); if (!c.tgt.ko) c.mark(c.tgt, 'fleam_spear', fresh ? 2 : 1, 3); } });
defMove({ id: 'fleam_rend', name: 'Draw Blades', type: 'GEAR', owner: 'fleam', reach: 'single', tags: ['projectile'], cd: 2, fx: 'recoil | shard*6 return | slash drip', text: 'Pulls every Blade: 48% ATK + 59% ATK each. Slow 1. A KO resets its cooldown.',
  run(c) {
    if (c.blocked(c.tgt)) return;
    const n = c.marked(c.tgt, 'fleam_spear');
    unmark(c.tgt, 'fleam_spear');
    c.u.k.rending = 1;
    c.hit(c.tgt, { atk: 0.48 + 0.59 * n });
    c.u.k.rending = 0;
    if (c.tgt.ko) ready(c.u, 'fleam_rend'); else c.st(c.tgt, 'slow', 1);
  } });
defMove({ id: 'fleam_notch', name: 'Score', type: 'BEAST', owner: 'fleam', reach: 'single', tags: ['projectile'], cd: 3, fx: 'flare | shard*2 zigzag | claw drip',
  text: 'Hits for 124% ATK. Expose 1. Doubles the foe\'s Blades, up to 8.',
  run(c) { c.hit(c.tgt, { atk: 1.24 }); c.st(c.tgt, 'expose', 1); const n = c.marked(c.tgt, 'fleam_spear'); if (n && !c.tgt.ko) c.mark(c.tgt, 'fleam_spear', n, 3); } });
defMove({ id: 'fleam_openvein', name: 'Lancing', type: 'GEAR', owner: 'fleam', reach: 'reserveAlly', tags: ['projectile'], cd: 6, nerve: 4, tag: true, fx: 'spin big | shard*6 orbit | slash drip big jolt',
  text: 'Hits for 131% ATK. Stun 1. Bleed 1 per Blade in it. Swaps in an ally.',
  run(c) {
    c.hit(c.tgt, { atk: 1.31 });
    if (c.tgt.ko) return;
    c.st(c.tgt, 'stun', 1);
    const n = c.marked(c.tgt, 'fleam_spear');
    if (n && c.st(c.tgt, 'bleed', n, stat(c.b, c.u, 'atk') * 0.12)) unmark(c.tgt, 'fleam_spear');
  } });

// vat: a brine curing vat that walked off half full, slops brine over foes, rolls through them, and drinks from itself to harden.
defMark({ id: 'vat_rage', name: 'topped up', clock: 'own', volatile: true, value: 0.06,
  addRaw(b, f, t, d) { return d.attack ? t.maxHp * 0.07 : 0; },
  afterAttack(b, f) { unmark(f, 'vat_rage'); } });
defPassive({ id: 'vat_ferment', name: 'Still Curing', owner: 'vat', text: 'When it uses a move: heals 4% of its max HP.',
  afterMove(b, f) { heal(b, f, f, f.maxHp * 0.04); } });
defPassive({ id: 'vat_hops', name: 'Thick Staves', owner: 'vat', text: 'Takes 0.8x damage from attacks. A foe that dashes into it: Slow 1.',
  inMul(b, f, src, d) { return d.attack ? 0.8 : 1; },
  afterTake(b, f, src, dealt, d) { if (src && src.side !== f.side && !src.ko && d.move?.tags?.includes('dash')) applyStatus(b, f, src, 'slow', 1); } });
defMove({ id: 'vat_rollcask', name: 'Slop Over', type: 'SALT', owner: 'vat', reach: 'spread', tags: ['spell'], cd: 1, wu: 50, fx: 'sway | drop*5 arc | splash all',
  text: 'Wind-up. Hits for 81% MGK. Splash 35%. Slow 1.',
  run(c) { c.spread({ mgk: 0.81 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'vat_bodyslam', name: 'Barrel In', type: 'TIDE', owner: 'vat', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'spin | lunge | splash quake',
  text: 'Hits for 77% MGK + 4% of its max HP. Stun 1. The first reserve takes 50%.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.77, selfHp: 0.04 }); c.st(c.tgt, 'stun', 1);
    const r = reserves(c.them)[0];
    if (r) c.hit(r, { mgk: 0.77, selfHp: 0.04 }, { reserve: true, mult: 0.5 });
  } });
defMove({ id: 'vat_drinkup', name: 'Top Up', type: 'TIDE', owner: 'vat', reach: 'self', cd: 3, wt: 60, fx: 'sink | drop*3 rise | fizz self',
  text: 'Fortify 2. Poise 20%. Its next attack adds 7% of the foe\'s max HP.',
  run(c) { c.st(c.u, 'fortify', 2); addPoise(c.b, c.u, 0.2, 0.2); c.mark(c.u, 'vat_rage', 1, 2); } });
defMove({ id: 'vat_caskburst', name: 'Burst Hoops', type: 'TIDE', owner: 'vat', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | crest*4 sweep | splash all big tint jolt',
  text: 'Hits for 124% MGK. Splash 35%. Forces the foe out. Its replacement: Slow 2.',
  run(c) { c.spread({ mgk: 1.24 }); if (c.tgt.ko || !c.forceOut()) return; const n = foe(c.b, c.u); if (n && n !== c.tgt) c.st(n, 'slow', 2); } });

// wain: a hay cart's shell that gets harder to stop the longer it rolls, and keeps rolling after it breaks.
defMark({ id: 'wain_husk', name: 'wreck', value: 0.1,
  turnStart(b, f) { msg(b, `${label(b, f)} creaks.`); dealDamage(b, null, f, f.maxHp * 0.2, dot('T'), null); },
  forbid(b, f, what) { return what === 'attack' ? null : 'Only a wreck now.'; } });
defMark({ id: 'wain_furnace', name: 'wheels chocked', clock: 'own', volatile: true, value: 0.06,
  expire(b, f) { if (f.shield <= 0) return; const t = foe(b, f); if (t) { msg(b, `${label(b, f)}'s shield bursts.`); strike(b, f, t, t.maxHp * 0.1, 'M', 'GEAR'); } } });
defPassive({ id: 'wain_creaking', name: 'Keeps Rolling', owner: 'wain', text: 'Once, instead of a KO: a 40% HP Wreck with 1.3x ATK that only attacks and loses 20% max HP a turn.',
  wouldKO(b, f) {
    if (f.k.husked) return false;
    f.k.husked = 1; f.hp = Math.round(f.maxHp * 0.4); f.s = {};
    setForm(b, f, { tag: 'husk', statMul: { atk: 1.3 } });
    mark(b, f, f, 'wain_husk', 1, -1);
    msg(b, `${label(b, f)} keeps rolling.`);
    return true;
  } });
defPassive({ id: 'wain_runson', name: 'Heavier Load', owner: 'wain', text: 'When a foe is KO\'d while it is out: +6% max HP for the battle.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) { const add = Math.round(f.st.hp * 0.06); f.maxHp += add; heal(b, f, f, add); } } });
defMove({ id: 'wain_trundle', name: 'Run Over', type: 'GEAR', owner: 'wain', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | quake',
  text: 'Hits for 147% ATK. Slow 1. Poise +10%, up to 30%.',
  run(c) { c.hit(c.tgt, { atk: 1.47 }); c.st(c.tgt, 'slow', 1); addPoise(c.b, c.u, 0.1, 0.3); } });
defMove({ id: 'wain_rut', name: 'Into the Rut', type: 'STONE', owner: 'wain', reach: 'single', cd: 3, wu: 50, fx: 'shake | pebble*3 arc | crack',
  text: 'Wind-up. Hits for 153% ATK. Root 2. The foe repeats its last move next turn.',
  run(c) {
    c.hit(c.tgt, { atk: 1.53 });
    if (c.tgt.ko || c.blocked(c.tgt)) return;
    c.st(c.tgt, 'root', 2);
    const i = (c.tgt.k.lastMove || 0) - 1;
    if (i >= 0) forceAction(c.b, c.tgt, 'move', i);
  } });
defMove({ id: 'wain_chock', name: 'Chock Wheels', type: 'GEAR', owner: 'wain', reach: 'self', cd: 3, wt: 60, fx: 'stomp | cog*2 orbit | ring self',
  text: 'Its Poise becomes a shield + 15% max HP, 2 turns. If it lasts: the foe loses 10% max HP.',
  run(c) { const p = c.u.poise || 0; c.u.poise = 0; c.shield(c.u, c.u.maxHp * 0.15 + p, 2); c.mark(c.u, 'wain_furnace', 1, 2); } });
defMove({ id: 'wain_runaway', name: 'Runaway Cart', type: 'GEAR', owner: 'wain', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, wu: 70, unstop: true, fx: 'shake | lunge fast | quake burst big jolt',
  text: 'Unstoppable wind-up. Hits for 217% ATK + 57% of its Poise. Stun 1.',
  run(c) { c.hit(c.tgt, { atk: 2.17, flat: (c.u.poise || 0) * 0.57 }); c.st(c.tgt, 'stun', 1); } });

// talpa: a star-nosed mole's shell that feels for footsteps through the sand and comes up under them.
const TALPA_MOUND: SpriteData = { px: ['........', '........', '...33...', '33.33.33', '33222233', '44444444', '44444444', '44444444'], c: ['#8c8898', '#e4b4bc', '#feeac5'] };
defMark({ id: 'talpa_under', name: 'burrowed', value: 0.08,
  inMul() { return 0.85; },
  turnStart(b, f) { if (!has(f, 'talpa_earthfed') || !f.k.fury) return; heal(b, f, f, f.maxHp * 0.04 * f.k.fury); f.k.fury = 0; },
  leave(b, f) { unmark(f, 'talpa_under'); clearForm(b, f); } });
const burrowed = (f: Fighter) => f.form?.tag === 'burrow';
function surface(b: Battle, f: Fighter): void { unmark(f, 'talpa_under'); clearForm(b, f); }
defPassive({ id: 'talpa_earthfed', name: 'Grub Store', owner: 'talpa', text: 'Its hits add a Grub, up to 4. Burrowed, turn start: eats them, heals 4% max HP each.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) f.k.fury = Math.min(4, (f.k.fury || 0) + 1); } });
defPassive({ id: 'talpa_tremor', name: 'Star Nose', owner: 'talpa', text: 'Burrowed: when a foe comes out, hits it for 60% ATK.',
  anyOut(b, f, who) {
    if (who.side === f.side || f.ko || !burrowed(f) || !isOut(b, f)) return;
    msg(b, `${label(b, f)} feels the footsteps.`);
    strike(b, f, who, stat(b, f, 'atk') * 0.6, 'P', 'BEAST');
  } });
defMove({ id: 'talpa_gnaw', name: 'Nibble', type: 'BEAST', owner: 'talpa', reach: 'single', cd: 1, fx: 'lunge fast | bite', text: 'Hits 3 times for 56% ATK.',
  run(c) { for (let i = 0; i < 3 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.56 }); } });
defMove({ id: 'talpa_erupt', name: 'Dig Claw', type: 'BEAST', owner: 'talpa', reach: 'single', cd: 2, fx: 'sink | sand rise | claw', text: 'Hits for 156% ATK. At 4 Grubs: spends them, true damage.',
  run(c) { const full = (c.u.k.fury || 0) >= 4; if (full) c.u.k.fury = 0; c.hit(c.tgt, { atk: 1.56 }, { kind: full ? 'T' : 'P' }); } });
defMove({ id: 'talpa_burrow', name: 'Go to Earth', type: 'BEAST', owner: 'talpa', reach: 'self', cd: 3, wt: 50, fx: 'sink | sand*3 rise | puff self', text: 'Burrows: takes 0.85x damage, 1.2x AGI, and new moves.',
  run(c) { setForm(c.b, c.u, { tag: 'burrow', sprite: TALPA_MOUND, statMul: { agi: 1.2 } }, ['talpa_seek', 'talpa_unburrow', 'talpa_tunnel']); c.mark(c.u, 'talpa_under', 1); } });
defMove({ id: 'talpa_breach', name: 'Surface Lunge', type: 'BEAST', owner: 'talpa', reach: 'single', tags: ['dash'], cd: 6, nerve: 4, fx: 'sink | lunge | quake claw big jolt', text: 'Hits for 124% ATK + 25% of the foe\'s missing HP. Surfaces.',
  run(c) { c.hit(c.tgt, { atk: 1.24, tgtMiss: 0.25 }); if (burrowed(c.u)) surface(c.b, c.u); } });
defMove({ id: 'talpa_seek', name: 'Bubble Sniff', type: 'TIDE', owner: 'talpa', reach: 'spread', cd: 1, extra: true, fx: 'sway | bubble*4 wave | fizz all',
  text: 'Hits for 70% ATK. Splash 35%. Expose 1.',
  run(c) { c.spread({ atk: 0.7 }); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'talpa_unburrow', name: 'Mound Up', type: 'BEAST', owner: 'talpa', reach: 'single', cd: 3, extra: true, fx: 'stomp | sand rise | quake', text: 'Hits for 90% ATK. Stun 1. Surfaces.',
  run(c) { c.hit(c.tgt, { atk: 0.9 }); c.st(c.tgt, 'stun', 1); surface(c.b, c.u); } });
defMove({ id: 'talpa_tunnel', name: 'Tunnel Past', type: 'BEAST', owner: 'talpa', reach: 'single', cd: 2, extra: true, fx: 'sink | lunge fast | slash', text: 'Hits for 50% ATK. Its next turn comes 40% sooner.',
  run(c) { c.hit(c.tgt, { atk: 0.5 }); c.hasten(c.u, 40); } });

// ================================================================ undermeadow

// cellar: a root cellar's shell that keeps things cold through the bad months, shelves its friends, and fills back up when nearly empty.
defMark({ id: 'cellar_time', name: 'filling up', clock: 'own', value: 0.3,
  beforeTake(b, f, src, amt) { heal(b, f, f, amt); return 0; } });
defMark({ id: 'cellar_shield', name: 'shelved', clock: 'own', value: 0.06,
  afterTake(b, f) {
    if (f.shield > 0) return;
    const mk = unmark(f, 'cellar_shield');
    const by = mk ? markedBy(b, mk) : null;
    const t = foe(b, f);
    if (by && t) { msg(b, 'The shelf gives way onto the foe.'); strike(b, by, t, stat(b, by, 'atk') * 0.6, 'P', 'STONE'); }
  } });
defPassive({ id: 'cellar_borrowed', name: 'Cold Store', owner: 'cellar', text: 'Its hits add Slow 1. Every 4th hit on the same foe: Silence 1.',
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.ko || t.side === f.side) return;
    applyStatus(b, f, t, 'slow', 1);
    const key = `cold${t.side}${t.idx}`;
    f.k[key] = (f.k[key] || 0) + 1;
    if (f.k[key] % 4 === 0) applyStatus(b, f, t, 'silence', 1);
  } });
defPassive({ id: 'cellar_coldkeep', name: 'Fills Back Up', owner: 'cellar', text: 'Once per battle, below 25% HP: for 1 turn, damage heals it instead.',
  afterTake(b, f) { if (!f.k.coldkept && f.hp > 0 && pctOut(f, 0.25)) { f.k.coldkept = 1; msg(b, `${label(b, f)} fills back up.`); mark(b, f, f, 'cellar_time', 1, 1); } } });
defMove({ id: 'cellar_coldbreath', name: 'Cold Draft', type: 'STONE', owner: 'cellar', reach: 'single', cd: 1, fx: 'recoil | sand*3 wave | frost',
  text: 'Pays 4% max HP. Hits for 98% ATK. Your lowest-HP whorl heals 30% of it.',
  run(c) { payHp(c.b, c.u, c.u.maxHp * 0.04); const d = c.hit(c.tgt, { atk: 0.98 }); c.heal(lowestAlly(c), d * 0.3); } });
defMove({ id: 'cellar_shelf', name: 'Top Shelf', type: 'STONE', owner: 'cellar', reach: 'ally', cd: 3, fx: 'lift | shell*3 rise | ring ally', text: 'Cleanses an ally. Shield 18% max HP, 3 turns. If it breaks: 60% ATK to the foe.',
  run(c) { c.cleanse(c.ally!); c.shield(c.ally!, c.ally!.maxHp * 0.18, 3); c.mark(c.ally!, 'cellar_shield', 1, 3); } });
defMove({ id: 'cellar_frostrot', name: 'Frost Bite', type: 'SALT', owner: 'cellar', reach: 'single', cd: 3, fx: 'lunge | salt*2 line | bite frost',
  text: 'Hits for 62% ATK. Silence 1. Slow 2. Its moves still cooling wait 1 more turn.',
  run(c) {
    c.hit(c.tgt, { atk: 0.62 }); c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'slow', 2);
    if (c.tgt.ko || c.blocked(c.tgt)) return;
    c.tgt.cd.forEach((n, i) => { if (n > 0) shiftCd(c.b, c.tgt, i, 1); });
  } });
defMove({ id: 'cellar_overwinter', name: 'Bad Months', type: 'STONE', owner: 'cellar', reach: 'self', cd: 6, nerve: 4, wt: 70, fx: 'sink big | salt*6 rain | frost ally big tint',
  text: 'For 2 turns: damage heals it instead. Its reserves go into cold storage, 10% a turn.',
  run(c) { c.mark(c.u, 'cellar_time', 1, 2); for (const r of reserves(c.me)) storeAway(c.b, r, 2, 0.1); } });

// lumbric: a lugworm's shell with a face at each end that splits in two when broken and crawls back together.
defMark({ id: 'lumbric_halves', name: 'in halves', value: 0.2,
  inMul() { return 0; } });
defSummon({ id: 'lumbric_half', name: 'Worm End', owner: 'lumbric', text: 'Takes single-target hits meant for Mimato. After a split: if one lasts 2 turns, Mimato returns at 30% HP, and if both fall, Mimato is KO\'d.', every: 100, guard: true,
  sprite: { px: ['........', '........', '..2222..', '.212212.', '.232232.', '..2332..', '.444444.', '.4.44.4.'], c: ['#dd8272', '#f7eddd', '#934951'] },
  act() { /* the half only waits */ },
  gone(b, s, f) {
    if (!f || f.ko || !marked(f, 'lumbric_halves')) return;
    if (s.hp <= 0) f.k.halvesLost = (f.k.halvesLost || 0) + 1;
    if (summonsOf(b, s.side, 'lumbric_half').length) return;
    unmark(f, 'lumbric_halves');
    delete f.s.stun;
    if ((f.k.halvesLost || 0) >= 2) { msg(b, `Both halves of ${label(b, f)} are gone.`); dealDamage(b, null, f, f.hp + f.shield + 1, dot('T'), null); return; }
    f.hp = Math.max(f.hp, Math.round(f.maxHp * 0.3));
    emit(b, { e: 'heal', side: f.side, idx: f.idx, amt: 0 });
    msg(b, `${label(b, f)} pulls itself back together.`);
  } });
defPassive({ id: 'lumbric_split', name: 'Two Ends', owner: 'lumbric', text: 'Once, instead of a KO: 2 Worm Ends (12% max HP each). One lasts 2 turns: back at 30% HP.',
  wouldKO(b, f) {
    if (f.k.split) return false;
    f.k.split = 1; f.k.halvesLost = 0; f.hp = 1; f.shield = 0; f.s = { stun: { n: 9, src: -1 } };
    mark(b, f, f, 'lumbric_halves', 1);
    summon(b, f, 'lumbric_half', { hp: 0.12, turns: 2 });
    summon(b, f, 'lumbric_half', { hp: 0.12, turns: 2 });
    msg(b, `${label(b, f)} comes apart.`);
    return true;
  } });
defPassive({ id: 'lumbric_segments', name: 'Sand Casts', owner: 'lumbric', text: 'Its hits leave a Cast, up to 3. Turn start: heals 2% max HP per Cast, spends them.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) f.k.bits = Math.min(3, (f.k.bits || 0) + 1); },
  turnStart(b, f) { if (f.k.bits) { heal(b, f, f, f.maxHp * 0.02 * f.k.bits); f.k.bits = 0; } } });
defMove({ id: 'lumbric_stretch', name: 'Long Slap', type: 'ROOT', owner: 'lumbric', reach: 'single', cd: 1, fx: 'sway | kelp sweep | slash', text: 'Hits 2 times for 49% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.49 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.49 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'lumbric_wriggle', name: 'Squirm', type: 'TIDE', owner: 'lumbric', reach: 'spread', cd: 2, fx: 'shake | sand*4 sweep | drip all',
  text: 'Hits for 35% ATK + 4% foe max HP. Splash 35%. Its next turn comes 10% sooner per foe.',
  run(c) {
    const n = [c.tgt, ...reserves(c.them)].filter(t => !t.ko && !t.gone).length;
    c.spread({ atk: 0.35, tgtHp: 0.04 });
    c.hasten(c.u, 10 * n);
  } });
defMove({ id: 'lumbric_fling', name: 'Sling Self', type: 'ROOT', owner: 'lumbric', reach: 'spread', tags: ['dash'], cd: 3, wu: 70, fx: 'spin | lunge | quake all',
  text: 'Wind-up. Hits for 87% ATK. Splash 35%. Stun 1. A Worm End (8% max HP, 2 turns) guards it.',
  run(c) {
    c.spread({ atk: 0.87 }); c.st(c.tgt, 'stun', 1);
    if (!summonsOf(c.b, c.u.side, 'lumbric_half').length) summon(c.b, c.u, 'lumbric_half', { hp: 0.08, turns: 2 });
  } });
defMove({ id: 'lumbric_bounce', name: 'Loop Bounce', type: 'ROOT', owner: 'lumbric', reach: 'single', tags: ['dash'], cd: 6, nerve: 5, fx: 'hop | lunge fast | quake slash big jolt',
  text: 'Hits 4 times for 34% ATK. Slow 2. Stun 1. Spends its Casts: heals 6% max HP each.',
  run(c) {
    for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.34 });
    c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'stun', 1);
    const n = c.u.k.bits || 0;
    c.u.k.bits = 0;
    if (n) c.heal(c.u, c.u.maxHp * 0.06 * n);
  } });

// brogue: a hobnailed boot with nobody's foot in it that keeps every nail it puts in you and marches on.
defMark({ id: 'brogue_march', name: 'marching', clock: 'own', volatile: true, value: 0.2,
  cooldown(b, f, m, cd) { return m.id === 'brogue_hobnail' ? 0 : cd; } });
defPassive({ id: 'brogue_wornin', name: 'Broken In', owner: 'brogue', text: 'Heals 15% of the damage its moves deal.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) heal(b, f, f, dealt * 0.15); } });
defPassive({ id: 'brogue_hardwearing', name: 'Spare Nails', owner: 'brogue', text: 'When a foe is KO\'d while it is out: 3 Nails.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) f.k.nails = (f.k.nails || 0) + 3; } });
defMove({ id: 'brogue_hobnail', name: 'Hobnail', type: 'GEAR', owner: 'brogue', reach: 'single', cd: 1, fx: 'lunge | burst', text: 'Hits for 144% ATK, +7% per Nail, max 14. Adds a Nail when it lands.',
  run(c) { const n = Math.min(14, c.u.k.nails || 0); const d = c.hit(c.tgt, { atk: 1.44 }, { mult: 1 + 0.07 * n }); if (d > 0) c.u.k.nails = (c.u.k.nails || 0) + 1; } });
defMove({ id: 'brogue_scuff', name: 'Scuff Mark', type: 'GEAR', owner: 'brogue', reach: 'single', cd: 3, fx: 'stomp | sand sweep | daze',
  text: 'Slow 2. Weaken 2. Delays the foe 30%. Its crest waits 1 more turn.',
  run(c) { if (c.blocked(c.tgt)) return; c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'weaken', 2); c.delay(c.tgt, 30); shiftCd(c.b, c.tgt, 3, 1); } });
defMove({ id: 'brogue_tread', name: 'Tread Hard', type: 'STONE', owner: 'brogue', reach: 'spread', cd: 3, fx: 'stomp | quake crack all',
  text: 'Hits for 102% ATK. Splash 35%. Expose 2. 1 Nail for each foe it hits.',
  run(c) {
    const n = [c.tgt, ...reserves(c.them)].filter(t => !t.ko && !t.gone).length;
    c.spread({ atk: 1.02 }); c.st(c.tgt, 'expose', 2);
    c.u.k.nails = (c.u.k.nails || 0) + n;
  } });
defMove({ id: 'brogue_longmarch', name: 'Forced March', type: 'GEAR', owner: 'brogue', reach: 'single', cd: 6, nerve: 5, fx: 'stomp big | cog*4 orbit | quake daze big jolt',
  text: 'Max HP +15%. Taunt 2 on the foe. For 3 turns, Hobnail has no cooldown.',
  run(c) {
    const add = Math.round(c.u.st.hp * 0.15);
    c.u.maxHp += add; c.heal(c.u, add);
    c.mark(c.u, 'brogue_march', 1, 3); ready(c.u, 'brogue_hobnail');
    c.st(c.tgt, 'taunt', 2);
  } });

// pod: a beach pea's pod the size of a cat whose peas look back, and which sets more pods to ripen and pop all at once.
defSummon({ id: 'pod_keg', name: 'Ripe Pod', owner: 'pod', text: 'Pea Shot bursts it. A spread hit on its side can burst it first.',
  sprite: { px: ['........', '........', '.2....2.', '.222222.', '24144142', '24144142', '.222222.', '...33...'], c: ['#84ac70', '#a86840', '#e8f0bc'] } });
defMark({ id: 'pod_rain', name: 'peas falling', clock: 'own', volatile: true, value: 0.14,
  turnStart(b, f) {
    splash(b, f, stat(b, f, 'mgk') * 0.5, 'M', 'ROOT');
    const t = foe(b, f);
    if (t) applyStatus(b, f, t, 'slow', 1);
    if (summonsOf(b, f.side, 'pod_keg').length < 3) summon(b, f, 'pod_keg', { hp: 0.06 });
  } });
defPassive({ id: 'pod_ripening', name: 'Sun Ripe', owner: 'pod', text: 'Every 3rd attack: Burn 2 on the foe (30% MGK each turn). Haste 1.',
  afterAttack(b, f, t) { f.k.ripe = (f.k.ripe || 0) + 1; if (f.k.ripe % 3 !== 0) return; if (!t.ko && !t.gone) applyStatus(b, f, t, 'burn', 2, stat(b, f, 'mgk') * 0.3); applyStatus(b, f, f, 'haste', 1); } });
defPassive({ id: 'pod_seedcase', name: 'Full Pod', owner: 'pod', text: 'Turn start: each Pod ripens, +20% burst, up to 60%. Bursting 3 Pods at once: Stun 1.',
  turnStart(b, f) { for (const k of summonsOf(b, f.side, 'pod_keg')) k.v = Math.min(3, (k.v || 0) + 1); } });
defMove({ id: 'pod_pop', name: 'Pea Shot', type: 'ROOT', owner: 'pod', reach: 'spread', tags: ['projectile', 'spell'], cd: 1, fx: 'hop | pearl*3 line fast | burst',
  text: 'Hits for 179% MGK. Its Pods burst for 78% MGK each. Splash 35%. KO: 2 tide.',
  run(c) {
    c.hit(c.tgt, { mgk: 1.79 });
    const kegs = summonsOf(c.b, c.u.side, 'pod_keg');
    const n = kegs.length;
    if (n && !c.tgt.ko) {
      const ripe = kegs.reduce((s, k) => s + 1 + 0.2 * Math.min(3, k.v || 0), 0);
      for (const k of kegs) dismiss(c.b, k);
      c.msg(`${n} pod${n > 1 ? 's' : ''} go off.`);
      c.spread({ mgk: 0.78 * ripe });
      if (n >= 3 && has(c.u, 'pod_seedcase')) c.st(c.tgt, 'stun', 1);
    }
    if (c.tgt.ko) c.nerve(c.me, 2);
  } });
defMove({ id: 'pod_setpods', name: 'Grow Pods', type: 'TIDE', owner: 'pod', reach: 'single', tags: ['spell'], cd: 2, fx: 'sway | drop*3 arc | splash',
  text: 'Hits for 71% MGK. Summons 2 Pods, up to 3 (6% of its max HP).',
  run(c) { c.hit(c.tgt, { mgk: 0.71 }); for (let i = 0; i < 2; i++) if (summonsOf(c.b, c.u.side, 'pod_keg').length < 3) summon(c.b, c.u, 'pod_keg', { hp: 0.06 }); } });
defMove({ id: 'pod_shuck', name: 'Shell Out', type: 'ROOT', owner: 'pod', reach: 'self', cd: 3, wt: 60, fx: 'shake | puff self', text: 'Cleanses itself. Heals 15% of its max HP.',
  run(c) { c.cleanse(c.u); c.heal(c.u, c.u.maxHp * 0.15); } });
defMove({ id: 'pod_shower', name: 'Pea Rain', type: 'ROOT', owner: 'pod', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'lift big | pearl*8 rain | burst all big tint',
  text: 'Hits for 101% MGK. Splash 35%. Slow 1. Next 2 turns: 50% MGK, Splash 35%, Slow 1, +1 Pod.',
  run(c) { c.spread({ mgk: 1.01 }); c.st(c.tgt, 'slow', 1); c.mark(c.u, 'pod_rain', 1, 2); } });

// hatch: a cellar door with an eye where the handle was that shuts things in below for a while and grows heavier on what it takes.
defPassive({ id: 'hatch_staleair', name: 'Shut Air', owner: 'hatch', text: 'Every 3rd move: 1 tide. A foe it takes off the field takes 80% MGK when it comes back.',
  afterMove(b, f) { f.k.flux = (f.k.flux || 0) + 1; if (f.k.flux % 3 === 0) addNerve(b, f.side, 1); },
  banishEnd(b, f, back) { if (f.ko || back.ko) return; msg(b, `${label(b, back)} comes back out, shaken.`); strike(b, f, back, stat(b, f, 'mgk') * 0.8, 'M', 'STONE'); } });
defPassive({ id: 'hatch_heavylid', name: 'Takes Weight', owner: 'hatch', text: 'Its hits take 2 MGK from the foe and give it to Tobiku, up to 20 total.',
  afterDeal(b, f, t, dealt, d) { if (d.dot || d.reserve || t.side === f.side || (f.k.stolen || 0) >= 20) return; f.k.stolen = (f.k.stolen || 0) + 2; t.st.mgk = Math.max(1, t.st.mgk - 2); },
  statBonus(f, k) { return k === 'mgk' ? f.k.stolen || 0 : 0; } });
defMove({ id: 'hatch_latch', name: 'Swing Shut', type: 'STONE', owner: 'hatch', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | shell line | crack', text: 'Hits for 219% MGK + 7% of its max HP.',
  run(c) { c.hit(c.tgt, { mgk: 2.19, selfHp: 0.07 }); } });
defMove({ id: 'hatch_shutin', name: 'Below Stairs', type: 'STONE', owner: 'hatch', reach: 'single', tags: ['spell'], cd: 3, fx: 'sink | vortex sigil dark', text: 'Takes the foe off the field for 1 turn.',
  run(c) { if (c.blocked(c.tgt) || c.tgt.s.unstop) return; banish(c.b, c.tgt, 1, c.u); } });
defMove({ id: 'hatch_bangshut', name: 'Slam', type: 'ROOT', owner: 'hatch', reach: 'single', tags: ['spell'], cd: 3, fx: 'lunge | crack quake',
  text: 'Hits for 143% MGK + its MGK over the foe\'s RES. The foe\'s side: Shut In 2 rounds.',
  run(c) {
    const gap = Math.max(0, stat(c.b, c.u, 'mgk') - stat(c.b, c.tgt, 'res'));
    c.hit(c.tgt, { mgk: 1.43, flat: gap });
    if (!c.blocked(c.tgt)) shutIn(c.b, c.tgt.side, 2);
  } });
defMove({ id: 'hatch_downbelow', name: 'Down Below', type: 'STONE', owner: 'hatch', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'sink big | rune*6 rise | vortex quake all big dark jolt', text: 'Hits for 144% MGK + 4x the MGK it has taken. Splash 35%.',
  run(c) { c.spread({ mgk: 1.44, flat: 4 * (c.u.k.stolen || 0) }); } });

// chirr: a cave cricket with its knees on backward that chirps three times quietly and the fourth time loud.
defMark({ id: 'chirr_tag', name: '', clock: 'own', value: -0.02 });
defSummon({ id: 'chirr_trap', name: 'Leg Snare', owner: 'chirr', text: 'Stays until a foe comes out. Hits it for 70% of Koolus\'s ATK. Slow 2.',
  sprite: { px: ['........', '........', '2......2', '.2....2.', '..2..2..', '...33...', '44444444', '.444444.'], c: ['#d8c8a4', '#a15d6d', '#af9b84'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, `${label(b, who)} steps on a leg snare.`); if (f) strike(b, f, who, stat(b, f, 'atk') * 0.7, 'P', 'BEAST'); if (!who.ko) applyStatus(b, f, who, 'slow', 2); return true; } });
const chirrCrit = (f: Fighter) => (f.k.notes || 0) % 4 === 3;
defPassive({ id: 'chirr_fourth', name: 'Fourth Chirp', owner: 'chirr', text: 'Every 4th action: deals 1.6x damage, and its next turn comes 20% sooner.',
  outMul(b, f, t, d) { return !d.reserve && chirrCrit(f) ? 1.6 : 1; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) mark(b, f, t, 'chirr_tag', 1, 1); },
  turnEnd(b, f, action) {
    if (action !== 'attack' && action !== 'move' && action !== 'windup') return;
    if (chirrCrit(f)) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 20); }
    f.k.notes = (f.k.notes || 0) + 1;
  } });
defPassive({ id: 'chirr_deadquiet', name: 'Loud End', owner: 'chirr', text: 'Fourth Chirp deals up to 1.4x more, scaling with the foe\'s missing HP.',
  outMul(b, f, t, d) { return !d.reserve && chirrCrit(f) && has(f, 'chirr_fourth') ? 1 + 0.4 * (1 - t.hp / t.maxHp) : 1; } });
defMove({ id: 'chirr_trill', name: 'Trill', type: 'BEAST', owner: 'chirr', reach: 'single', tags: ['sound'], cd: 1, fx: 'shake | hoop*2 line fast | ring',
  text: 'Hits for 105% ATK. The first reserve takes 50%, every reserve on a Fourth Chirp.',
  run(c) {
    const loud = chirrCrit(c.u);
    c.hit(c.tgt, { atk: 1.05 });
    for (const r of loud ? reserves(c.them) : reserves(c.them).slice(0, 1)) c.hit(r, { atk: 1.05 }, { reserve: true, mult: 0.5 });
  } });
defMove({ id: 'chirr_stridulate', name: 'Cave Drip', type: 'TIDE', owner: 'chirr', reach: 'single', cd: 3, fx: 'hop | drop*3 rain | drip',
  text: 'Hits for 90% ATK. Root 2 if it hit the foe since its last turn.',
  run(c) { const tagged = c.marked(c.tgt, 'chirr_tag') > 0; c.hit(c.tgt, { atk: 0.9 }); if (tagged) c.st(c.tgt, 'root', 2); } });
defMove({ id: 'chirr_cavehop', name: 'Hop Off', type: 'BEAST', owner: 'chirr', reach: 'side', tags: ['dash'], cd: 3, fx: 'hop | puff ally', text: 'Summons a Leg Snare (6% of its max HP). Its next turn comes 20% sooner.',
  run(c) { summon(c.b, c.u, 'chirr_trap', { hp: 0.06 }); c.hasten(c.u, 20); } });
defMove({ id: 'chirr_lastnotes', name: 'Four Chirps', type: 'BEAST', owner: 'chirr', reach: 'single', tags: ['sound'], cd: 6, nerve: 5, fx: 'shake big | hoop*4 line | ring burst big jolt', text: 'Hits 3 times for 45% ATK, then once for 110% ATK.',
  run(c) { for (let i = 0; i < 4 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: i === 3 ? 1.1 : 0.45 }); } });

// ================================================================ knucklebones

// talus: a giant's knucklebone off the Knucklebones, hollow, that tumbles when thrown and often lands twice.
defMark({ id: 'talus_luck', name: 'lucky roll', clock: 'own', volatile: true, value: 0.15,
  afterMove(b, f, m, c) {
    if (f.k.recast || m.nerve || f.ko || !isOut(b, f)) return;
    unmark(f, 'talus_luck');
    const i = f.moves.indexOf(m.id);
    if (i < 0) return;
    f.k.recast = 1;
    msg(b, `${label(b, f)} rolls it again.`);
    runMove(b, f, i, { target: c.pick >= 0 ? c.pick : undefined });
    f.k.recast = 0;
  } });
defPassive({ id: 'talus_twice', name: 'Lands Twice', owner: 'talus', text: 'Every 3rd move it uses happens twice. Crests do not count.',
  afterMove(b, f, m, c) {
    if (f.k.recast || m.nerve) return;
    f.k.casts = (f.k.casts || 0) + 1;
    if (f.k.casts % 3 !== 0 || f.ko || !isOut(b, f)) return;
    const i = f.moves.indexOf(m.id);
    if (i < 0) return;
    f.k.recast = 1;
    msg(b, `${label(b, f)} does it again.`);
    runMove(b, f, i, { target: c.pick >= 0 ? c.pick : undefined });
    f.k.recast = 0;
  } });
defPassive({ id: 'talus_shaken', name: 'Old Bone', owner: 'talus', text: 'Starts each battle with 1.1x max HP.',
  start(b, f) { const add = Math.round(f.maxHp * 0.1); f.maxHp += add; f.hp += add; } });
defMove({ id: 'talus_tossup', name: 'Toss Up', type: 'STONE', owner: 'talus', reach: 'single', cd: 1, fx: 'hop | bone arc | crack', text: 'Hits for 89% ATK. Slow 1. Expose 1.',
  run(c) { c.hit(c.tgt, { atk: 0.89 }); c.st(c.tgt, 'slow', 1); c.st(c.tgt, 'expose', 1); } });
defMove({ id: 'talus_bonechip', name: 'Chip Off', type: 'BEAST', owner: 'talus', reach: 'single', tags: ['projectile'], cd: 3, fx: 'shake | bone*2 line fast | shatter',
  text: 'Hits for 95% ATK. Stun 1. Fracture 3.',
  run(c) { c.hit(c.tgt, { atk: 0.95 }); c.st(c.tgt, 'stun', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) fracture(c.b, c.u, c.tgt, 3); } });
defMove({ id: 'talus_eggon', name: 'Roll for It', type: 'STONE', owner: 'talus', reach: 'ally', cd: 3, fx: 'spin | bone*4 orbit | sparkle ally',
  text: 'An ally gets Haste 2 and Empower 1. Its next move, not a crest, happens twice.',
  run(c) { c.st(c.ally!, 'haste', 2); c.st(c.ally!, 'empower', 1); c.mark(c.ally!, 'talus_luck', 1, 2); } });
defMove({ id: 'talus_jackstones', name: 'All Five', type: 'STONE', owner: 'talus', reach: 'single', tags: ['projectile'], cd: 5, nerve: 4, fx: 'swell big | bone*5 arc | shatter crack all big jolt',
  text: 'Hits 5 times for 32% ATK, taking turns among every foe, out first. Stun 1.',
  run(c) {
    const line = [c.tgt, ...reserves(c.them)].filter(t => !t.ko && !t.gone);
    for (let k = 0; k < 5 && line.length; k++) {
      const t = line[k % line.length];
      if (!t.ko) c.hit(t, { atk: 0.32 }, t === c.tgt ? {} : { reserve: true });
    }
    c.st(c.tgt, 'stun', 1);
  } });

// molar: a giant's back tooth, hollow as a whelk, that looks out of its roots and grows on whatever it chews.
defPassive({ id: 'molar_eatswell', name: 'Well Fed', owner: 'molar', text: 'When a foe is KO\'d while it is out: heals 15% of its max HP.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) heal(b, f, f, f.maxHp * 0.15); } });
defPassive({ id: 'molar_heft', name: 'Root Weight', owner: 'molar', text: 'Its moves add 1.5% of its max HP to their damage.',
  addRaw(b, f, t, d) { return d.move ? f.maxHp * 0.015 : 0; } });
defMove({ id: 'molar_cusp', name: 'Cusp Bite', type: 'STONE', owner: 'molar', reach: 'single', splash: 0.25, cd: 1, fx: 'lunge | bite', text: 'Hits for 137% ATK. Splash 25%.',
  run(c) { c.hit(c.tgt, { atk: 1.37 }); for (const r of reserves(c.them)) c.hit(r, { atk: 1.37 }, { reserve: true, spread: true, mult: 0.25 }); } });
defMove({ id: 'molar_rupture', name: 'Root Heave', type: 'ROOT', owner: 'molar', reach: 'spread', cd: 3, wu: 60, fx: 'stomp | thorn*4 rise | quake all',
  text: 'Wind-up. Hits for 94% ATK. Splash 35%. Stun 1. 1.5x if the foe is Fractured.',
  run(c) { c.spread({ atk: 0.94 }, { mult: c.tgt.fracture ? 1.5 : 1 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'molar_gnash', name: 'Molar Grind', type: 'STONE', owner: 'molar', reach: 'single', cd: 3, fx: 'shake | bite crack',
  text: 'Hits for 117% ATK. Silence 1. Fracture 2.',
  run(c) { c.hit(c.tgt, { atk: 1.17 }); c.st(c.tgt, 'silence', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) fracture(c.b, c.u, c.tgt, 2); } });
defMove({ id: 'molar_chewup', name: 'Chew Down', type: 'STONE', owner: 'molar', reach: 'single', cd: 5, nerve: 4, fx: 'swell big | bite crack big jolt',
  text: 'True damage: 84% ATK + 12% missing HP, 24% if Fractured. KO: max HP +12%.',
  run(c) {
    c.hit(c.tgt, { atk: 0.84, tgtMiss: c.tgt.fracture ? 0.24 : 0.12 }, { kind: 'T' });
    if (!c.tgt.ko) return;
    const add = Math.round(c.u.st.hp * 0.12);
    c.u.maxHp += add; c.heal(c.u, add);
    c.msg(`${label(c.b, c.u)} grows.`);
  } });

// atlas: the top bone of a giant's neck that held a head up for three hundred years and grows bone spurs where it is struck.
defMark({ id: 'atlas_quill', name: 'spurred', max: 5, clock: 'own', negative: true, value: -0.04 });
defMark({ id: 'atlas_goo', name: 'gooed', max: 4, clock: 'own', negative: true, value: -0.04,
  statBonus(f, k) { return k === 'def' ? -5 * (f.m.atlas_goo?.n || 0) : 0; } });
defMark({ id: 'atlas_back', name: 'neck bowed', clock: 'own', volatile: true, value: 0.12,
  inMul() { return 0.6; },
  afterTake(b, f, src, dealt, d) { if (!d.dot) atlasSpray(b, f, 0.2); } });
defMark({ id: 'atlas_war', name: 'holding up', max: 4, clock: 'own', volatile: true, value: 0.08,
  outMul(b, f) { return 1 + 0.1 * (f.m.atlas_war?.n || 0); },
  afterMove(b, f) { const mk = f.m.atlas_war; if (mk && mk.n < 4) { mk.n++; applyStatus(b, f, f, 'haste', 1); } } });
function atlasSpray(b: Battle, f: Fighter, ratio: number): void {
  if (f.k.spraying) return;
  f.k.spraying = 1;
  splash(b, f, stat(b, f, 'atk') * ratio, 'P', 'STONE');
  const t = foe(b, f);
  if (t) mark(b, f, t, 'atlas_quill', 1, 3);
  f.k.spraying = 0;
}
defPassive({ id: 'atlas_turnedback', name: 'Bone Spurs', owner: 'atlas', text: 'Takes 0.9x from moves. Per 25% max HP lost: 15% ATK to every foe, 1 Spur.',
  inMul(b, f, src, d) { return d.move ? 0.9 : 1; },
  afterTake(b, f, src, dealt, d) {
    if (d.dot) return;
    f.k.backTaken = (f.k.backTaken || 0) + dealt;
    while (f.k.backTaken >= f.maxHp * 0.25) { f.k.backTaken -= f.maxHp * 0.25; atlasSpray(b, f, 0.15); }
  } });
defPassive({ id: 'atlas_quillbed', name: 'Spur Bed', owner: 'atlas', text: 'Spur: a mark, up to 5, for 3 turns. Foes take +3% damage from it per Spur.',
  outMul(b, f, t) { return 1 + 0.03 * marked(t, 'atlas_quill'); } });
defMove({ id: 'atlas_quills', name: 'Spur Spray', type: 'STONE', owner: 'atlas', reach: 'spread', cd: 1, fx: 'shake | thorn*5 sweep | shatter all', text: 'Hits for 36% ATK, +6% damage per Spur. Splash 35%. 1 Spur.',
  run(c) { const n = c.marked(c.tgt, 'atlas_quill'); c.spread({ atk: 0.36 }, { mult: 1 + 0.06 * n }); if (!c.tgt.ko) c.mark(c.tgt, 'atlas_quill', 1, 3); } });
defMove({ id: 'atlas_marrow', name: 'Marrow Spit', type: 'BEAST', owner: 'atlas', reach: 'single', tags: ['projectile'], cd: 2, fx: 'recoil | drop*2 arc | drip',
  text: 'Hits for 34% ATK. Slow 2. 2 Goo for 3 turns: -5 DEF per Goo, up to 4.',
  run(c) { c.hit(c.tgt, { atk: 0.34 }); c.st(c.tgt, 'slow', 2); c.mark(c.tgt, 'atlas_goo', 2, 3); } });
defMove({ id: 'atlas_hunker', name: 'Bow the Neck', type: 'STONE', owner: 'atlas', reach: 'self', cd: 3, wt: 60, fx: 'sink big | ring sparkle tint self', text: 'Until its next turn: takes 0.6x. When hit: 20% ATK, Splash 35%.',
  run(c) { c.mark(c.u, 'atlas_back', 1, 1); } });
defMove({ id: 'atlas_shrugoff', name: 'Hold Up', type: 'STONE', owner: 'atlas', reach: 'self', cd: 6, nerve: 3, wt: 60, fx: 'lift | bone*4 orbit | pillar ring tint self big', text: 'For 4 turns: each move adds +10% damage, up to 4, and Haste 1.',
  run(c) { c.mark(c.u, 'atlas_war', 1, 4); c.st(c.u, 'haste', 1); } });

// nail: the shell of a giant's nail that scratches the same spot until it gives.
defMark({ id: 'nail_hour', name: 'to the quick', clock: 'own', volatile: true, value: 0.15 });
defPassive({ id: 'nail_third', name: 'Same Spot', owner: 'nail', text: 'Every 3rd hit on the same foe: true damage of 9% of its max HP.',
  afterDeal(b, f, t, dealt, d) {
    if (d.dot || d.reserve || t.ko || t.side === f.side || f.k.bolting) return;
    const key = `bolt${t.side}${t.idx}`;
    f.k[key] = (f.k[key] || 0) + 1;
    const every = marked(f, 'nail_hour') ? 2 : 3;
    if (f.k[key] % every !== 0) return;
    f.k.bolting = 1;
    strike(b, f, t, t.maxHp * 0.09, 'T', null);
    f.k.bolting = 0;
  } });
defPassive({ id: 'nail_ingrown', name: 'Hangnail', owner: 'nail', text: 'When a foe comes out: its next turn comes 20% sooner.',
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f)) hastenFighter(b, f, 20); } });
defMove({ id: 'nail_flick', name: 'Nail Flick', type: 'BEAST', owner: 'nail', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge fast | slash', text: 'Hits for 106% ATK. Its next attack deals 1.7x damage.',
  run(c) { c.hit(c.tgt, { atk: 1.06 }); c.u.k.nextAtkMul = 1.7; } });
defMove({ id: 'nail_rake', name: 'Pin Under', type: 'BEAST', owner: 'nail', reach: 'single', cd: 3, fx: 'lunge | claw crack',
  text: 'Hits for 153% ATK. A foe that can\'t switch out: Stun 1. Else: Root 2.',
  run(c) { const pinned = !canSwitch(c.b, c.tgt); c.hit(c.tgt, { atk: 1.53 }); if (pinned) c.st(c.tgt, 'stun', 1); else c.st(c.tgt, 'root', 2); } });
defMove({ id: 'nail_pare', name: 'Pare Down', type: 'TIDE', owner: 'nail', reach: 'single', cd: 3, fx: 'sway | drop*2 sweep | slash',
  text: 'Hits for 133% ATK. Same Spot goes off on this hit.',
  run(c) {
    const key = `bolt${c.tgt.side}${c.tgt.idx}`, every = marked(c.u, 'nail_hour') ? 2 : 3;
    c.u.k[key] = Math.floor((c.u.k[key] || 0) / every) * every + every - 1;
    c.hit(c.tgt, { atk: 1.33 });
  } });
defMove({ id: 'nail_gouge', name: 'Down to Quick', type: 'BEAST', owner: 'nail', reach: 'self', cd: 6, nerve: 4, wt: 60, fx: 'flare big | claw self big tint', text: 'Empower 2. Haste 2. For 3 turns: Same Spot goes off every 2nd hit.',
  run(c) { c.st(c.u, 'empower', 2); c.st(c.u, 'haste', 2); c.mark(c.u, 'nail_hour', 1, 3); } });

// socket: the ball and cup of a giant's hip that never sits level, leans light or heavy, and sets round whatever it faces like a cast.
const sockStance = (f: Fighter) => f.k.stance || 1;
defPassive({ id: 'socket_rebalance', name: 'Leans Light', owner: 'socket', text: 'Light: 1.2x ATK, 0.8x DEF. Heavy: the reverse. It starts Light.',
  statBonus(f, k) {
    const s = sockStance(f) === 1 ? 1 : -1;
    if (k === 'atk') return Math.round(f.st.atk * 0.2 * s);
    if (k === 'def') return -Math.round(f.st.def * 0.2 * s);
    return 0;
  } });
defPassive({ id: 'socket_balljoint', name: 'Off Level', owner: 'socket', text: 'Heavy: takes 0.85x damage. Light: its turns come 10% sooner.',
  inMul(b, f) { return sockStance(f) === 2 ? 0.85 : 1; },
  turnEnd(b, f) { if (sockStance(f) === 1) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 10); } } });
defMove({ id: 'socket_snap', name: 'Pop Joint', type: 'GEAR', owner: 'socket', reach: 'single', cd: 1, fx: 'hop | burst', text: 'Hits for 138% ATK. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.38 }); c.hasten(c.u, 20); } });
defMove({ id: 'socket_adapt', name: 'Swing Leg', type: 'BEAST', owner: 'socket', reach: 'single', cd: 3, fx: 'spin | lunge | quake',
  text: 'Light: hits for 162% ATK. Heavy: hits for 91% ATK, Stun 1.',
  run(c) { if (sockStance(c.u) === 1) c.hit(c.tgt, { atk: 1.62 }); else { c.hit(c.tgt, { atk: 0.91 }); c.st(c.tgt, 'stun', 1); } } });
defMove({ id: 'socket_lockjoint', name: 'Shift Weight', type: 'GEAR', owner: 'socket', reach: 'self', cd: 1, wt: 50, fx: 'sway | ring self', text: 'Switches between Light and Heavy.',
  run(c) { c.u.k.stance = sockStance(c.u) === 1 ? 2 : 1; c.msg(`${label(c.b, c.u)} leans ${c.u.k.stance === 1 ? 'light' : 'heavy'}.`); } });
defMove({ id: 'socket_fullrotation', name: 'Cast Round', type: 'GEAR', owner: 'socket', reach: 'single', cd: 6, nerve: 4, fx: 'spin big | cog*4 orbit | vortex sigil big tint',
  text: 'Hits for 96% ATK. Trades bodies with the foe 3 turns: look, types, passives, moves.',
  run(c) { c.hit(c.tgt, { atk: 0.96 }); if (!c.tgt.ko && !c.blocked(c.tgt) && swapBodies(c.b, c.u, c.tgt, 3)) c.msg(`${label(c.b, c.u)} sets round ${label(c.b, c.tgt)} like a cast.`); } });

// furcula: a wishbone off a bird bigger than a barn that pulls long, then short, and splinters at anyone in the way.
defMark({ id: 'furcula_stack', name: 'wishing', clock: 'own', volatile: true, value: 0.08,
  addRaw(b, f, t, d) { return d.attack ? stat(b, f, 'mgk') * 0.58 : 0; } });
defPassive({ id: 'furcula_cardsharp', name: 'Lucky Break', owner: 'furcula', text: 'When a foe is KO\'d while it is out: 2 tide.',
  anyKO(b, f, v) { if (v.side !== f.side && isOut(b, f)) addNerve(b, f.side, 2); } });
defPassive({ id: 'furcula_pulled', name: 'Fourth Wish', owner: 'furcula', text: 'Every 4th attack: also hits for 60% MGK.',
  afterAttack(b, f, t) { f.k.deck = (f.k.deck || 0) + 1; if (f.k.deck % 4 === 0) strike(b, f, t, stat(b, f, 'mgk') * 0.6, 'M', 'STAR'); } });
defMove({ id: 'furcula_wish', name: 'Splinter Spray', type: 'STAR', owner: 'furcula', reach: 'spread', tags: ['projectile', 'spell'], cd: 1, fx: 'shake | shard*5 sweep | shatter all', text: 'Hits for 107% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 1.07 }); } });
defMove({ id: 'furcula_fan', name: 'Pull the Bone', type: 'GEAR', owner: 'furcula', reach: 'spread', tags: ['projectile', 'spell'], cd: 2, fx: 'recoil | bone*2 return | shatter',
  text: 'Alternates. Long end: 90% MGK, Splash 35%, Stun 1. Short end: 136% MGK, 1 tide.',
  run(c) {
    const card = (c.u.k.card || 0) % 2;
    c.u.k.card = card + 1;
    if (card === 0) { c.msg('The long end.'); c.spread({ mgk: 0.9 }); c.st(c.tgt, 'stun', 1); }
    else { c.msg('The short end.'); c.hit(c.tgt, { mgk: 1.36 }); c.nerve(c.me, 1); }
  } });
defMove({ id: 'furcula_stacked', name: 'Make a Wish', type: 'STAR', owner: 'furcula', reach: 'self', cd: 3, wt: 60, fx: 'flare | star*3 orbit | sparkle self',
  options() { return ['Tide', 'Health', 'Luck']; },
  text: 'Pick a wish. Tide: 2 tide. Health: Regen 3. Luck: its attacks add 58% MGK, 3 turns.',
  run(c) {
    if (c.opt === 0) c.nerve(c.me, 2);
    else if (c.opt === 1) c.st(c.u, 'regen', 3, 0.07);
    else c.mark(c.u, 'furcula_stack', 1, 3);
  } });
defMove({ id: 'furcula_fulldeck', name: 'Wish Them Here', type: 'STAR', owner: 'furcula', reach: 'dragin', tags: ['spell'], cd: 6, nerve: 4, fx: 'swell big | star*6 converge | sparkle flash big glare', text: 'Drags in a reserve and hits it for 124% MGK. Expose 2.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; c.hit(t, { mgk: 1.24 }); c.st(t, 'expose', 2); } });

// urchin: a sea urchin's test off the dry sea floor that shakes off whatever sticks to it and puts its spines out all round.
defMark({ id: 'urchin_spine', name: 'spine stuck', clock: 'own', negative: true, value: -0.08,
  afterAttack(b, f) { urchinSpine(b, f); },
  afterMove(b, f, m) { if (m.tags?.includes('dash')) urchinSpine(b, f); } });
function urchinSpine(b: Battle, f: Fighter): void {
  if (f.ko || f.gone) return;
  msg(b, `The spine in ${label(b, f)} digs in.`);
  dealDamage(b, null, f, f.maxHp * 0.05, dot('T'), null);
}
defPassive({ id: 'urchin_hardtest', name: 'Test Shell', owner: 'urchin', text: 'Hits under 6% max HP deal it 0.7x. Per 25% max HP lost: gives the foe its bad statuses.',
  beforeTake(b, f, src, amt, d) { return !d.dot && amt < f.maxHp * 0.06 ? amt * 0.7 : amt; },
  afterTake(b, f, src, dealt) {
    f.k.shell = (f.k.shell || 0) + dealt;
    if (f.k.shell < f.maxHp * 0.25) return;
    f.k.shell = 0;
    const bad = (['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'burn', 'bleed', 'poison', 'rot', 'expose', 'weaken'] as const)
      .filter(id => f.s[id]).map(id => ({ id, n: f.s[id]!.n, v: f.s[id]!.v }));
    cleanse(b, f);
    const t = foe(b, f);
    if (!t || !bad.length) return;
    msg(b, `${label(b, f)} shakes it all off onto ${label(b, t)}.`);
    for (const s of bad) applyStatus(b, f, t, s.id, s.n, s.v);
  } });
defPassive({ id: 'urchin_spined', name: 'Sharp Spines', owner: 'urchin', text: 'Attackers take 12% of their damage back.',
  afterTake(b, f, src, dealt, d) { if (d.attack && src && src !== f && !src.ko) dealDamage(b, f, src, dealt * 0.12, { ...dot('M'), reflect: true } as DmgInfo, null); } });
defMove({ id: 'urchin_spinering', name: 'Spine Sweep', type: 'TIDE', owner: 'urchin', reach: 'spread', cd: 1, fx: 'spin | urchin*3 sweep | shatter all', text: 'Hits for 71% ATK. Splash 35%. Weaken 1.',
  run(c) { c.spread({ atk: 0.71 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'urchin_gush', name: 'Water Jet', type: 'TIDE', owner: 'urchin', reach: 'single', tags: ['projectile'], cd: 2, fx: 'recoil | drop*4 line fast | splash',
  text: 'Hits for 92% ATK. Slow 2. Expose 1. Pushes the two of them to Far.',
  run(c) { c.hit(c.tgt, { atk: 0.92 }); c.st(c.tgt, 'slow', 2); c.st(c.tgt, 'expose', 1); if (!c.tgt.ko) setRange(c.b, 'far'); } });
defMove({ id: 'urchin_pincushion', name: 'Spine Pin', type: 'BEAST', owner: 'urchin', reach: 'single', cd: 3, fx: 'lunge | urchin line fast | slash',
  text: 'Hits for 87% ATK. Root 2. Slow 1. Spine 3: attacks and dashes cost it 5% max HP.',
  run(c) { c.hit(c.tgt, { atk: 0.87 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko) c.mark(c.tgt, 'urchin_spine', 1, 3); } });
defMove({ id: 'urchin_ravage', name: 'All Spines Out', type: 'TIDE', owner: 'urchin', reach: 'spread', splash: 1, cd: 7, nerve: 6, fx: 'swell big | urchin*8 converge | shatter all big jolt',
  text: 'Hits for 118% ATK. Splash 100%. Stun 1 on the foe and each reserve.',
  run(c) { c.spread({ atk: 1.18 }); c.st(c.tgt, 'stun', 1); for (const r of reserves(c.them)) c.st(r, 'stun', 1); } });

// fiddler: a fiddler crab that waves one great claw, raises it to catch blows, and swings it back at everyone.
defMark({ id: 'fiddler_counter', name: 'claw raised', clock: 'own', volatile: true, value: 0.15,
  beforeTake(b, f, src, amt, d) {
    if (!d.attack && !d.move?.tags?.includes('dash')) return amt;
    f.k.caught = (f.k.caught || 0) + 1;
    msg(b, `${label(b, f)} catches it on the claw.`);
    return 0;
  },
  turnStart(b, f) {
    unmark(f, 'fiddler_counter');
    const n = f.k.caught || 0;
    f.k.caught = 0;
    msg(b, `${label(b, f)} swings the claw back.`);
    splash(b, f, stat(b, f, 'atk') * (0.9 + 0.3 * n), 'P', 'BEAST');
  } });
defMark({ id: 'fiddler_might', name: 'claw regrown', clock: 'own', volatile: true, value: 0.12,
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.4, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'fiddler_waving', name: 'Courting Wave', owner: 'fiddler', text: 'Attacks in a row: its next turn comes 10% sooner, then 20%, then 30%.',
  afterAttack(b, f) { f.k.wave = Math.min(3, (f.k.wave || 0) + 1); hastenFighter(b, f, 10 * f.k.wave); },
  turnEnd(b, f, action) { if (action !== 'attack') f.k.wave = 0; } });
defPassive({ id: 'fiddler_bigclaw', name: 'Great Claw', owner: 'fiddler', text: 'Every 3rd attack: also hits for 50% MGK.',
  afterAttack(b, f, t) { f.k.claw = (f.k.claw || 0) + 1; if (f.k.claw % 3 === 0) strike(b, f, t, stat(b, f, 'mgk') * 0.5, 'M', 'BEAST'); } });
defMove({ id: 'fiddler_clawwave', name: 'Sidelong Jab', type: 'BEAST', owner: 'fiddler', reach: 'single', tags: ['dash'], cd: 1, fx: 'lunge | claw', text: 'Hits for 117% ATK. Weaken 1.',
  run(c) { c.hit(c.tgt, { atk: 1.17 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'fiddler_sidle', name: 'Wave the Claw', type: 'TIDE', owner: 'fiddler', reach: 'single', cd: 3, fx: 'sway | crest sweep | splash',
  text: 'Hits for 50% ATK. Taunt 1. Its next attack deals 1.7x damage.',
  run(c) { c.hit(c.tgt, { atk: 0.5 }); c.st(c.tgt, 'taunt', 1); c.u.k.nextAtkMul = 1.7; } });
defMove({ id: 'fiddler_counterclaw', name: 'Claw Raised', type: 'BEAST', owner: 'fiddler', reach: 'self', cd: 4, wt: 60, fx: 'lift | ring self',
  text: 'Attacks and dashes deal it 0 till its next turn. Then: 90% ATK +30% per blow. Splash 35%.',
  run(c) { c.u.k.caught = 0; c.mark(c.u, 'fiddler_counter', 1, 2); } });
defMove({ id: 'fiddler_regrown', name: 'Regrow Claw', type: 'BEAST', owner: 'fiddler', reach: 'single', cd: 6, nerve: 4, fx: 'swell big | claw slash big jolt', text: 'Hits for 148% ATK. Fortify 3. For 3 turns its attacks also hit each reserve for 40%.',
  run(c) { c.hit(c.tgt, { atk: 1.48 }); c.st(c.u, 'fortify', 3); c.mark(c.u, 'fiddler_might', 1, 3); } });

// fata: a mirage off the dry sea that stands on its own reflection and shows more of itself than there is.
defSummon({ id: 'fata_illusion', name: 'Reflection', owner: 'fata', sprite: { px: ['1.44.44.', '1.4.44.4', '14.44.4.', '1.4424..', '14142214', '13333333', '1.3333..', '2.......'], c: ['#69aeed', '#d0513a', '#0534a0'] }, text: 'Takes single-target hits meant for your out whorl. 3 turns.', every: 100, guard: true,
  act() { /* images strike only with Fata */ } });
const images = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'fata_illusion').length;
const addImage = (b: Battle, f: Fighter) => summon(b, f, 'fata_illusion', { hp: 0.05, turns: 3 });
defPassive({ id: 'fata_doubling', name: 'Reflected', owner: 'fata', text: 'Starts with a Reflection (5% max HP, 3 turns). Every 4th attack: another.',
  comeOut(b, f) { if (!f.k.imaged) { f.k.imaged = 1; addImage(b, f); } },
  afterAttack(b, f) { f.k.dbl = (f.k.dbl || 0) + 1; if (f.k.dbl % 4 === 0) addImage(b, f); } });
defPassive({ id: 'fata_farshore', name: 'Many Places', owner: 'fata', text: 'When it attacks: each Reflection also hits for 15% MGK.',
  afterAttack(b, f, t) { const n = images(b, f); if (n && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.15 * n, 'M', 'STAR'); } });
defMove({ id: 'fata_glint', name: 'Heat Glint', type: 'STAR', owner: 'fata', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'flare | star line fast | sparkle', text: 'Hits for 77% MGK. Slow 1. A Reflection if it has none.',
  run(c) { c.hit(c.tgt, { mgk: 0.77 }); c.st(c.tgt, 'slow', 1); if (!images(c.b, c.u)) addImage(c.b, c.u); } });
defMove({ id: 'fata_waver', name: 'Waver Off', type: 'STAR', owner: 'fata', reach: 'self', cd: 4, wt: 50, fx: 'blink | sparkle self',
  text: 'Cleanses itself. A Reflection. Mirage 25% for 3 turns.',
  run(c) { c.cleanse(c.u); addImage(c.b, c.u); addMirage(c.b, c.u, 0.25, 3); } });
defMove({ id: 'fata_hazerush', name: 'Haze Run', type: 'STONE', owner: 'fata', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'blink | lunge fast | sparkle',
  text: 'Hits for 70% MGK, +20% per Reflection. Its next turn comes 30% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 0.7 }, { mult: 1 + 0.2 * images(c.b, c.u) }); c.hasten(c.u, 30); } });
defMove({ id: 'fata_massmirage', name: 'Whole Mirage', type: 'STAR', owner: 'fata', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'swell big | star*6 orbit | sparkle flash big tint',
  text: 'Hits for 52% MGK + 50% MGK per Reflection. +2 Reflections. Mirage 30% for 3 turns.',
  run(c) { const n = images(c.b, c.u); c.hit(c.tgt, { mgk: 0.52 + 0.5 * n }); for (let i = 0; i < 2; i++) addImage(c.b, c.u); addMirage(c.b, c.u, 0.3, 3); } });

// fluke: a ship's anchor walking on its flukes that marks a spot and drags whatever leaves it back.
defMark({ id: 'fluke_x', name: 'anchored', max: 1, clock: 'any', value: -0.1,
  leave(b, f) { f.k.flukeGone = 1; } });
defMark({ id: 'fluke_haul', name: '', max: 1, value: 0,
  turnStart(b, f) {
    for (const r of reserves(b.s[1 - f.side])) {
      if (!marked(r, 'fluke_x') || !r.k.flukeGone) continue;
      r.k.flukeGone = 0;
      unmark(r, 'fluke_x');
      if (!dragIn(b, f, r.side, r.idx)) continue;
      msg(b, `${label(b, f)} hauls ${label(b, r)} back to the spot.`);
      if (has(f, 'fluke_longhaul')) { applyStatus(b, f, r, 'root', 2); strike(b, f, r, stat(b, f, 'atk') * 0.8, 'P', 'GEAR'); } else applyStatus(b, f, r, 'root', 1);
      return;
    }
  } });
defPassive({ id: 'fluke_heavyiron', name: 'Iron Swing', owner: 'fluke', text: 'Every 3rd attack: 1.4x damage, and reserves take 60% ATK.',
  outMul(b, f, t, d) { return d.attack && ((f.k.swing || 0) % 3 === 2 || f.k.fullSwing) ? 1.4 : 1; },
  afterAttack(b, f) {
    const full = (f.k.swing || 0) % 3 === 2 || f.k.fullSwing;
    f.k.swing = (f.k.swing || 0) + 1;
    f.k.fullSwing = 0;
    if (full) for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'atk') * 0.6, { kind: 'P', move: null, attack: false, dot: false, spread: true, reserve: true }, null);
  } });
defPassive({ id: 'fluke_longhaul', name: 'Hauled Up', owner: 'fluke', text: 'A foe Drop Anchor drags back takes 80% ATK and Root 2 instead of 1.' });
defMove({ id: 'fluke_anchorswing', name: 'Fluke Swipe', type: 'GEAR', owner: 'fluke', reach: 'single', cd: 1, fx: 'spin | slash', text: 'Hits for 110% ATK. Its next attack is an Iron Swing.',
  run(c) { c.hit(c.tgt, { atk: 1.1 }); c.u.k.fullSwing = 1; } });
defMove({ id: 'fluke_markspot', name: 'Drop Anchor', type: 'GEAR', owner: 'fluke', reach: 'single', cd: 3, wt: 70,
  fx: 'hop | quake crack', text: 'Hits for 60% ATK. 4 turns: a foe that leaves is dragged back, Root 1.',
  run(c) {
    c.hit(c.tgt, { atk: 0.6 });
    if (c.tgt.ko) return;
    c.tgt.k.flukeGone = 0;
    if (c.mark(c.tgt, 'fluke_x', 1, 4)) mark(c.b, c.u, c.u, 'fluke_haul', 1);
  } });
defMove({ id: 'fluke_torrent', name: 'Sand Spout', type: 'STONE', owner: 'fluke', reach: 'single', cd: 3, wu: 60, fx: 'stomp | sand*4 rise | puff',
  text: 'Wind-up. Hits for 100% ATK, 1.5x on an anchored foe. Stun 1. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }, { mult: c.marked(c.tgt, 'fluke_x') ? 1.5 : 1 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'fluke_scuttle', name: 'Wreck Comes In', type: 'GEAR', owner: 'fluke', reach: 'spread', cd: 6, nerve: 5, wu: 70, fx: 'shake big | shell*6 rain | quake crack all big jolt',
  text: 'Wind-up. Hits for 140% ATK. Splash 35%. Stun 1. Fortify 2. The foe\'s side: Shut In 2 rounds.',
  run(c) { c.spread({ atk: 1.4 }); c.st(c.tgt, 'stun', 1); c.st(c.u, 'fortify', 2); if (!c.tgt.ko) shutIn(c.b, c.tgt.side, 2); } });

// prow: a ship's figurehead that left before the ship went down and still stands in front of whoever is behind it.
defMark({ id: 'prow_front', name: 'standing in front', clock: 'own', volatile: true, value: 0.2,
  covers() { return true; } });
defMark({ id: 'prow_blow', name: 'blows', max: 4, volatile: true, negative: true, value: -0.06 });
defMark({ id: 'prow_wall', name: 'into the swell', clock: 'own', volatile: true, value: 0.15,
  inMul() { return 0.7; },
  intercept(b, f, user, m) { return isOut(b, f) && m.tags?.includes('projectile') ? 'block' : null; } });
function prowBlow(b: Battle, f: Fighter, t: Fighter, n: number): void {
  if (t.ko || t.gone || t.side === f.side) return;
  mark(b, f, t, 'prow_blow', n, -1);
  if (marked(t, 'prow_blow') >= 4) { unmark(t, 'prow_blow'); applyStatus(b, f, t, 'stun', 1); }
}
defPassive({ id: 'prow_figurehead', name: 'Prow First', owner: 'prow', text: 'Its hits add a Blow, up to 4. At 4 Blows: Stun 1.',
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve) prowBlow(b, f, t, 1); } });
defPassive({ id: 'prow_bowwave', name: 'Bow Wake', owner: 'prow', text: 'When it switches out: the ally coming out gets Ward 1.',
  leave(b, f) { sk(b, f.side).wardNext = 1; } });
defMove({ id: 'prow_coldspray', name: 'Spray Over', type: 'STAR', owner: 'prow', reach: 'single', cd: 1, fx: 'lunge | drop*3 sweep | frost', text: 'Hits for 114% ATK + 3% of its max HP. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.14, selfHp: 0.03 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'prow_bulwark', name: 'Into the Swell', type: 'TIDE', owner: 'prow', reach: 'single', cd: 4, fx: 'sway | crest sweep | splash',
  text: 'Hits for 50% ATK. Until its next turn: blocks projectiles, takes 0.7x damage.',
  run(c) { c.hit(c.tgt, { atk: 0.5 }); c.mark(c.u, 'prow_wall', 1, 1); } });
defMove({ id: 'prow_standbefore', name: 'Stand In Front', type: 'STAR', owner: 'prow', reach: 'self', cd: 4, wt: 60, fx: 'lift | ring ally',
  text: 'Fortify 2. For 3 turns: it takes the foe\'s hits meant for its reserves.',
  run(c) { c.st(c.u, 'fortify', 2); c.mark(c.u, 'prow_front', 1, 3); } });
defMove({ id: 'prow_breakwater', name: 'Ice Wake', type: 'STAR', owner: 'prow', reach: 'spread', cd: 6, nerve: 5, fx: 'sway big | crest*4 sweep | frost all big tint jolt',
  text: 'Hits for 126% ATK. Splash 35%. Stun 1. Slow 2. 2 Blows on every foe.',
  run(c) { c.spread({ atk: 1.26 }); c.st(c.tgt, 'stun', 1); c.st(c.tgt, 'slow', 2); for (const t of [c.tgt, ...reserves(c.them)]) prowBlow(c.b, c.u, t, 2); } });

// bilge: a bilge pump with no ship left to bail that pumps tide in and out and leaves still water that sets like stone.
defMark({ id: 'bilge_gaze', name: 'becalmed', clock: 'own', negative: true, value: -0.15,
  anyMove(b, f, user, m) {
    if (user !== f || !m) return;
    const mk = unmark(f, 'bilge_gaze');
    msg(b, `${label(b, f)} sets like stone.`);
    applyStatus(b, mk ? markedBy(b, mk) : null, f, 'stun', 1);
    applyStatus(b, mk ? markedBy(b, mk) : null, f, 'expose', 2);
  } });
defPassive({ id: 'bilge_pumpshield', name: 'Pumps Out', owner: 'bilge', text: 'Damage it takes spends your tide first: 1 tide stops 8% of its max HP.',
  beforeTake(b, f, src, amt) {
    const s = b.s[f.side];
    if (!s.nerve || amt <= 0) return amt;
    const per = f.maxHp * 0.08;
    const use = Math.min(s.nerve, Math.ceil(amt / per));
    const stop = Math.min(amt, use * per);
    addNerve(b, f.side, -use);
    return amt - stop;
  } });
defPassive({ id: 'bilge_overflow', name: 'Spill Over', owner: 'bilge', text: 'Its attacks hit each foe reserve for 20% MGK.',
  afterAttack(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.2, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defMove({ id: 'bilge_bail', name: 'Bail Out', type: 'GEAR', owner: 'bilge', reach: 'single', tags: ['spell'], cd: 1, fx: 'recoil | drop*3 arc | splash', text: 'Hits for 73% MGK. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.73 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'bilge_siphon', name: 'Suction', type: 'GEAR', owner: 'bilge', reach: 'spread', splash: 0.4, tags: ['spell'], cd: 2, fx: 'sink | drop*4 converge | vortex all',
  text: 'Hits for 60% MGK. Splash 40%. Steals 1 tide.',
  run(c) { c.spread({ mgk: 0.6 }); if (c.them.nerve > 0) { c.nerve(c.them, -1); c.nerve(c.me, 1); } } });
defMove({ id: 'bilge_stagnant', name: 'Still Water', type: 'STONE', owner: 'bilge', reach: 'single', tags: ['spell'], cd: 3, fx: 'sink | sigil frost',
  text: 'Hits for 90% MGK. Root 2. Slow 1. For 1 round the foe\'s tide gains go to you.',
  run(c) { c.hit(c.tgt, { mgk: 0.9 }); c.st(c.tgt, 'root', 2); c.st(c.tgt, 'slow', 1); if (!c.tgt.ko && !c.blocked(c.tgt)) holdTide(c.b, c.tgt.side, c.u.side, 1); } });
defMove({ id: 'bilge_deadwater', name: 'Dead Calm', type: 'GEAR', owner: 'bilge', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'sink big | drop*6 rain | frost sigil big tint', text: 'Hits for 71% MGK. 2 turns: if the foe uses a move, Stun 1, Expose 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.71 }); if (!c.tgt.ko) c.mark(c.tgt, 'bilge_gaze', 1, 2); } });

// sail: a torn sail with the mast through its face that tacks with no wind, throws its blocks, and closes in to beat with its boom.
defMark({ id: 'sail_billow', name: 'filled out', max: 3, clock: 'own', volatile: true, value: 0.06,
  afterAttack(b, f) { const mk = f.m.sail_billow; if (!mk) return; hastenFighter(b, f, 25); mk.n--; if (mk.n <= 0) unmark(f, 'sail_billow'); } });
defMark({ id: 'sail_trance', name: 'storm canvas', clock: 'own', volatile: true, value: 0.3,
  beforeTake(b, f, src, amt) { return amt >= f.hp + f.shield ? Math.max(0, f.hp + f.shield - 1) : amt; },
  afterDeal(b, f, t, dealt, d) { if (d.attack) heal(b, f, f, dealt * 0.3); } });
const sailClose = (f: Fighter) => f.form?.tag === 'close';
defPassive({ id: 'sail_tacking', name: 'Same Tack', owner: 'sail', text: 'Attacks on one foe add a Tack, up to 5. Each Tack: +6% damage, its next turn comes 5% sooner.',
  outMul(b, f, t, d) { return d.attack && f.k.tackOn === t.side * 8 + t.idx ? 1 + 0.06 * (f.k.tack || 0) : 1; },
  afterAttack(b, f, t) {
    const id = t.side * 8 + t.idx;
    if (f.k.tackOn !== id) { f.k.tackOn = id; f.k.tack = 0; }
    f.k.tack = Math.min(5, (f.k.tack || 0) + 1);
    hastenFighter(b, f, 5 * f.k.tack);
  } });
defPassive({ id: 'sail_fervor', name: 'Close Haul', owner: 'sail', text: 'Close: every 4th attack adds Stun 1.',
  afterAttack(b, f, t) { if (!sailClose(f)) return; f.k.bash = (f.k.bash || 0) + 1; if (f.k.bash % 4 === 0 && !t.ko && !t.gone) applyStatus(b, f, t, 'stun', 1); } });
defMove({ id: 'sail_gybe', name: 'Thrown Blocks', type: 'TIDE', owner: 'sail', reach: 'spread', tags: ['projectile'], cd: 1, fx: 'spin | pebble*3 arc | burst all', text: 'Hits for 84% ATK. Splash 35%. Slow 1.',
  run(c) { c.spread({ atk: 0.84 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'sail_boomswing', name: 'Come About', type: 'TIDE', owner: 'sail', reach: 'self', tags: ['projectile'], cd: 1, wt: 50, fx: 'sway | ring self', text: 'Switches Off and Close. Close: 1.15x ATK and DEF, and Boom Beat.',
  run(c) {
    if (sailClose(c.u)) { clearForm(c.b, c.u); c.msg(`${label(c.b, c.u)} stands off.`); return; }
    setForm(c.b, c.u, { tag: 'close', statMul: { atk: 1.15, def: 1.15 } }, ['sail_axes']);
    c.msg(`${label(c.b, c.u)} closes in.`);
  } });
defMove({ id: 'sail_axes', name: 'Boom Beat', type: 'GEAR', owner: 'sail', reach: 'single', cd: 1, extra: true, fx: 'spin | slash',
  text: 'Hits for 115% ATK. Weaken 1.',
  run(c) { c.hit(c.tgt, { atk: 1.15 }); c.st(c.tgt, 'weaken', 1); } });
defMove({ id: 'sail_billow', name: 'Fill Out', type: 'TIDE', owner: 'sail', reach: 'self', cd: 3, wt: 60, fx: 'swell | feather*4 sweep | ring self',
  text: 'Wind toward the foe for 3 rounds. Its next 3 attacks: next turn comes 25% sooner.',
  run(c) { setWind(c.b, (1 - c.u.side) as 0 | 1, 3); c.mark(c.u, 'sail_billow', 3, 4); } });
defMove({ id: 'sail_galeforce', name: 'Storm Canvas', type: 'TIDE', owner: 'sail', reach: 'self', cd: 6, nerve: 4, wt: 50, fx: 'swell big | crest*4 orbit | ring self big tint jolt', text: 'Haste 3. For 2 turns it can\'t fall below 1 HP, and attacks heal 30% of their damage.',
  run(c) { c.mark(c.u, 'sail_trance', 1, 2); c.st(c.u, 'haste', 3); } });

// keel: a ship's keel off the dry sea that nothing has moved in forty years and that moves other things a long way.
defMark({ id: 'keel_presence', name: 'sitting upright', clock: 'own', volatile: true, value: 0.12,
  intercept(b, f, user, m) { if (!isOut(b, f) || !m.tags?.includes('dash')) return null; applyStatus(b, f, user, 'stun', 1); return 'block'; } });
defPassive({ id: 'keel_evenkeel', name: 'Weighted', owner: 'keel', text: 'Every 3rd attack: 1.4x damage and a shield of 8% of its max HP.',
  outMul(b, f, t, d) { return d.attack && (f.k.buck || 0) % 3 === 2 ? 1.4 : 1; },
  afterAttack(b, f) { f.k.buck = (f.k.buck || 0) + 1; if (f.k.buck % 3 === 0) giveShield(b, f, f, f.maxHp * 0.08, 3); } });
defPassive({ id: 'keel_deepdraft', name: 'Deep Set', owner: 'keel', text: 'Cannot be forced out or dragged in.',
  immovable() { return true; },
  comeOut(b, f) { f.k.sat = f.turns; } });
defMove({ id: 'keel_doubleknock', name: 'Two Knocks', type: 'STONE', owner: 'keel', reach: 'single', cd: 1, fx: 'lunge | crack burst', text: 'Hits for 63% ATK, then 89% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 0.63 }); if (!c.tgt.ko) c.hit(c.tgt, { atk: 0.89 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'keel_ram', name: 'Ram Ashore', type: 'ROOT', owner: 'keel', reach: 'single', tags: ['dash'], cd: 3, fx: 'lunge big | quake crack',
  text: 'Hits for 126% ATK, +20% per turn out, max +80%. Stun 1 if the foe can\'t switch.',
  run(c) {
    const pinned = !canSwitch(c.b, c.tgt), sat = Math.min(4, Math.max(0, c.u.turns - (c.u.k.sat ?? c.u.turns) - 1));
    c.hit(c.tgt, { atk: 1.26 }, { mult: 1 + 0.2 * sat });
    if (pinned) c.st(c.tgt, 'stun', 1);
  } });
defMove({ id: 'keel_righting', name: 'Sit Upright', type: 'STONE', owner: 'keel', reach: 'single', cd: 3, wt: 60, fx: 'sink big | ring sparkle tint self', text: 'Fortify 2. Interrupts. For 2 turns a dash at it is blocked, and its user gets Stun 1.',
  run(c) { c.st(c.u, 'fortify', 2); c.mark(c.u, 'keel_presence', 1, 2); c.interrupt(c.tgt); } });
defMove({ id: 'keel_verdict', name: 'Launch', type: 'STONE', owner: 'keel', reach: 'single', cd: 6, nerve: 5, wu: 60,
  fx: 'shake big | lunge | burst quake big jolt', text: 'Wind-up. Hits for 158% ATK. The foe is off the field for 2 turns.',
  run(c) { const t = c.tgt; c.hit(t, { atk: 1.58 }); if (t.ko || c.blocked(t) || t.s.unstop) return; banish(c.b, t, 2, c.u); } });

// bombard: a ship's cannon that talks through the top of its head, lobs shot that lands where you will be, and fires its friends across the deck.
defMark({ id: 'bombard_shred', name: 'grape loaded', max: 3, clock: 'own', volatile: true, value: 0.08,
  afterAttack(b, f, t) {
    const mk = f.m.bombard_shred;
    if (!mk) return;
    for (let i = 0; i < 2 && !t.ko; i++) strike(b, f, t, stat(b, f, 'atk') * 0.3, 'P', 'GEAR');
    if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1);
    mk.n--;
    if (mk.n <= 0) unmark(f, 'bombard_shred');
  } });
defMark({ id: 'bombard_kiss', name: 'shot in the air', clock: 'own', volatile: true, value: 0.12,
  turnStart(b, f) { msg(b, 'A shot lands.'); splash(b, f, stat(b, f, 'atk') * 0.6, 'P', 'GEAR'); const t = foe(b, f); if (t) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'bombard_ranging', name: 'Second Charge', owner: 'bombard', text: 'Every 3rd attack: fires again for 60% ATK.',
  afterAttack(b, f, t) { f.k.range = (f.k.range || 0) + 1; if (f.k.range % 3 === 0) strike(b, f, t, stat(b, f, 'atk') * 0.6, 'P', 'GEAR'); } });
defPassive({ id: 'bombard_swab', name: 'Swabbed Out', owner: 'bombard', text: 'An ally it fires in with Fire a Friend heals 10% of its max HP.' });
defMove({ id: 'bombard_lob', name: 'Scatter Shot', type: 'STONE', owner: 'bombard', reach: 'spread', tags: ['projectile'], cd: 1, fx: 'recoil | pebble*4 arc | crack all',
  text: 'Hits for 62% ATK, 1.4x if the foe came out since its last turn. Splash 35%.',
  run(c) { const fresh = c.tgt.outAt > (c.u.k.prevTurn ?? -1); c.spread({ atk: 0.62 }, { mult: fresh ? 1.4 : 1 }); } });
defMove({ id: 'bombard_grapeshot', name: 'Load Grape', type: 'GEAR', owner: 'bombard', reach: 'self', tags: ['projectile'], cd: 3, wt: 60, fx: 'shake | cinders self', text: 'Its next 3 attacks add 2 hits of 30% ATK and Slow 1.',
  run(c) { c.mark(c.u, 'bombard_shred', 3, 4); } });
defMove({ id: 'bombard_ramhome', name: 'Fire a Friend', type: 'GEAR', owner: 'bombard', reach: 'reserveAlly', tags: ['projectile'], cd: 3, tag: true, fx: 'recoil | comet line fast | burst', text: 'Hits for 50% ATK. Stun 1. Switches to an ally.',
  run(c) { const a = c.ally!; if (has(c.u, 'bombard_swab')) c.heal(a, a.maxHp * 0.1); c.hit(c.tgt, { atk: 0.5 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'bombard_broadside', name: 'Late Shot', type: 'GEAR', owner: 'bombard', reach: 'spread', tags: ['projectile'], cd: 6, nerve: 5, fx: 'recoil big | pebble*6 arc slow | burst crack all big jolt', text: 'Hits for 36% ATK. Splash 35%. Its next 3 turns: 60% ATK, Splash 35%, Slow 1.',
  run(c) { c.spread({ atk: 0.36 }); c.mark(c.u, 'bombard_kiss', 1, 3); } });

// ================================================================ shoreline

// breaker: a breaking wave off the gray wall with one eye in the curl that hollows out what it touches and drags at you until something hits it.
defSummon({ id: 'breaker_ward', name: 'Spray Column', owner: 'breaker', text: 'Stands 3 turns. While it stands, Whitewater makes each foe move cost that foe 60% MGK.', every: 100,
  sprite: { px: ['3.3..3.3', '.333333.', '..2222..', '..2212..', '..2222..', '..2222..', '.222222.', '44444444'], c: ['#c9d3d8', '#f4fafc', '#275389'] },
  act() { /* the ward only watches */ } });
const wardUp = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'breaker_ward').length > 0;
defMark({ id: 'breaker_hollow', name: 'curled over', clock: 'own', negative: true, value: -0.08,
  beforeTake(b, f, src, amt, d) { return d.attack ? 0 : amt; },
  inMul(b, f, src, d) { return d.move ? 1.4 : 1; } });
defMark({ id: 'breaker_drain', name: 'dragging', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    const t = foe(b, f);
    if (!t) return;
    const grow = 1 + 0.15 * (f.k.drainT || 0);
    f.k.drainT = (f.k.drainT || 0) + 1;
    const d = strike(b, f, t, stat(b, f, 'mgk') * 0.53 * grow, 'M', 'TIDE');
    heal(b, f, f, d);
  } });
defPassive({ id: 'breaker_steadydraw', name: 'Builds Up', owner: 'breaker', text: 'When it first comes out: the swell starts. At 9 its wave breaks over both out whorls.',
  comeOut(b) { if (!b.swell) raiseSwell(b, 0); } });
defPassive({ id: 'breaker_whitewater', name: 'Whitewater', owner: 'breaker', text: 'While its Spray Column stands: each foe move costs that foe 60% MGK. Deals 1.15x.',
  anyMove(b, f, user, m) { if (!m || user.side === f.side || user.ko || !wardUp(b, f) || f.k.wardHit === b.turnNo) return; f.k.wardHit = b.turnNo; strike(b, f, user, stat(b, f, 'mgk') * 0.6, 'M', 'TIDE'); },
  outMul(b, f) { return wardUp(b, f) ? 1.15 : 1; } });
defMove({ id: 'breaker_spill', name: 'Crash Down', type: 'TIDE', owner: 'breaker', reach: 'spread', tags: ['projectile', 'spell'], cd: 1, fx: 'lift | crest*3 arc | splash all', text: 'Hits for 84% MGK. Splash 35%.',
  run(c) { c.spread({ mgk: 0.84 }); } });
defMove({ id: 'breaker_hollowout', name: 'Curl Over', type: 'SALT', owner: 'breaker', reach: 'single', tags: ['spell'], cd: 3, fx: 'lift | crest arc | splash',
  text: 'Hits for 40% MGK. For 2 turns: attacks deal the foe 0, moves deal it 1.4x.',
  run(c) { c.hit(c.tgt, { mgk: 0.4 }); if (!c.tgt.ko) c.mark(c.tgt, 'breaker_hollow', 1, 2); } });
defMove({ id: 'breaker_longdraw', name: 'Throw Spray', type: 'TIDE', owner: 'breaker', reach: 'side', cd: 4, fx: 'sway | drop*4 rise | splash ally', text: 'Summons a Spray Column (16% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'breaker_ward', { hp: 0.16, turns: 3 }); } });
defMove({ id: 'breaker_ninthwave', name: 'Ninth Wave', type: 'TIDE', owner: 'breaker', reach: 'single', tags: ['spell', 'channel'], cd: 6, nerve: 5, fx: 'swell big | crest*6 sweep | splash vortex big tint jolt',
  text: 'The ninth wave breaks. Drains 53% MGK now and its next 3 turns, +15% each. Heals all of it.',
  run(c) {
    raiseSwell(c.b, SWELL_BREAK - (c.b.swell?.n || 0));
    const d = c.hit(c.tgt, { mgk: 0.53 });
    c.heal(c.u, d);
    c.u.k.drainT = 0;
    if (c.mark(c.u, 'breaker_drain', 1, 3)) startChannel(c.b, c.u, [{ on: c.u, id: 'breaker_drain' }]);
  } });

// skua: a skua with a second beak in its belly that follows one bird until it drops what it carries, then takes it.
defPassive({ id: 'skua_highwheel', name: 'High Wheel', owner: 'skua', text: 'When it comes out or guards: its next attack deals 1.5x and adds Slow 1.',
  comeOut(b, f) { f.k.wheel = 1; },
  afterGuard(b, f) { f.k.wheel = 1; },
  outMul(b, f, t, d) { return d.attack && f.k.wheel ? 1.5 : 1; },
  afterAttack(b, f, t) { if (!f.k.wheel) return; f.k.wheel = 0; if (!t.ko && !t.gone) applyStatus(b, f, t, 'slow', 1); } });
defPassive({ id: 'skua_spotter', name: 'Robber', owner: 'skua', text: 'Deals 1.2x to Followed foes. When a Followed foe is KO\'d: 3 tide.',
  outMul(b, f, t) { return t.k.tracked ? 1.2 : 1; },
  anyKO(b, f, v) { if (v.side !== f.side && v.k.tracked) { v.k.tracked = 0; addNerve(b, f.side, 3); msg(b, 'The skua takes its share.'); } },
  anyOut(b, f, who) {
    if (who.side === f.side || !who.k.tracked || f.ko || f.gone || isOut(b, f) || barred(f)) return;
    const s = b.s[f.side], o = s.f[s.out];
    if (s.cut || (o && !o.ko && !o.gone && !canSwitch(b, o))) return;
    msg(b, `${label(b, f)} follows ${label(b, who)} out.`);
    doSwitch(b, f.side, f.idx, true);
  } });
defMove({ id: 'skua_harry', name: 'Harry', type: 'BEAST', owner: 'skua', reach: 'single', tags: ['projectile'], cd: 1, fx: 'lift | feather line fast | bite', text: 'Hits for 129% ATK. A Followed reserve takes 60% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 1.29 }); const r = reserves(c.them).find(x => x.k.tracked); if (r) c.hit(r, { atk: 1.29 }, { reserve: true, mult: 0.6 }); } });
defMove({ id: 'skua_stoop', name: 'Stoop', type: 'TIDE', owner: 'skua', reach: 'single', tags: ['dash'], cd: 2, fx: 'lift | lunge fast | splash',
  text: 'Hits for 74% ATK. Its next attack deals 1.8x damage. Steals 1 tide.',
  run(c) { c.hit(c.tgt, { atk: 0.74 }); c.u.k.nextAtkMul = 1.8; if (c.them.nerve > 0) { c.nerve(c.them, -1); c.nerve(c.me, 1); } } });
defMove({ id: 'skua_track', name: 'Follow', type: 'BEAST', owner: 'skua', reach: 'single', cd: 3, fx: 'lift | feather*2 orbit | ring',
  text: 'Expose 2. Followed for the battle: when the foe comes out, Tozodo follows it out.',
  run(c) { if (c.blocked(c.tgt)) return; c.tgt.k.tracked = 1; c.st(c.tgt, 'expose', 2); c.msg(`${label(c.b, c.tgt)} is followed.`); } });
defMove({ id: 'skua_plunder', name: 'Out of the Sun', type: 'BEAST', owner: 'skua', reach: 'self', cd: 6, nerve: 4, wt: 60, fx: 'lift | blink | flash big glare', text: 'Hidden 2. Its next attack deals 2x damage.',
  run(c) { c.st(c.u, 'hidden', 2); c.u.k.nextAtkMul = 2; } });

// bloom: a bloom of moon jellies off the shoreline that stings everything near it for as long as the tide lasts.
defMark({ id: 'bloom_edict', name: 'drifting over', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (t) strike(b, f, t, stat(b, f, 'mgk') * (reserves(b.s[t.side]).length ? 0.3 : 0.6), 'M', 'BEAST'); } });
defMark({ id: 'bloom_nova', name: 'blooming', clock: 'own', volatile: true, value: 0.15,
  turnStart(b, f) {
    if (b.s[f.side].nerve < 1) { unmark(f, 'bloom_nova'); msg(b, `${label(b, f)} closes.`); return; }
    addNerve(b, f.side, -1);
    splash(b, f, stat(b, f, 'mgk') * 0.45, 'M', 'TIDE');
  } });
defPassive({ id: 'bloom_clearbody', name: 'See-Through', owner: 'bloom', text: 'When it uses a move: each foe reserve takes 15% MGK.',
  afterMove(b, f) { for (const r of reserves(b.s[1 - f.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.15, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'bloom_nettled', name: 'Stung Twice', owner: 'bloom', text: 'Deals 1.1x damage to a Slowed foe.',
  outMul(b, f, t) { return t.s.slow ? 1.1 : 1; } });
defMove({ id: 'bloom_tendrils', name: 'Trailing Sting', type: 'TIDE', owner: 'bloom', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | kelp*2 wave | drip', text: 'Hits for 65% MGK. Slow 1. The first reserve takes 35% of the damage.',
  run(c) { c.hit(c.tgt, { mgk: 0.65 }); c.st(c.tgt, 'slow', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { mgk: 0.65 }, { reserve: true, mult: 0.35 }); } });
defMove({ id: 'bloom_upwell', name: 'Upwelling', type: 'TIDE', owner: 'bloom', reach: 'spread', tags: ['spell'], cd: 3, wu: 50, fx: 'sink | bubble*5 rise | splash all',
  text: 'Wind-up. Hits for 61% MGK. Splash 35%. Stun 1. The swell rises 3.',
  run(c) { c.spread({ mgk: 0.61 }); c.st(c.tgt, 'stun', 1); raiseSwell(c.b, 3); } });
defMove({ id: 'bloom_swarm', name: 'Drift Over', type: 'BEAST', owner: 'bloom', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | kelp*3 rain | drip',
  text: 'Hits for 28% MGK. Its next 3 turns: 30% MGK to the foe, 60% if it has no reserve.',
  run(c) { c.hit(c.tgt, { mgk: 0.28 }); c.mark(c.u, 'bloom_edict', 1, 3); } });
defMove({ id: 'bloom_openbloom', name: 'Open Bloom', type: 'TIDE', owner: 'bloom', reach: 'spread', tags: ['spell'], cd: 6, nerve: 4, fx: 'swell big | bubble*8 orbit | bloom all big tint', text: 'Hits for 44% MGK. Splash 35%. Its next 4 turns: pays 1 tide for 45% MGK, Splash 35%.',
  run(c) { c.spread({ mgk: 0.44 }); c.mark(c.u, 'bloom_nova', 1, 4); } });

// drift: a driftwood log off the gray wall with a face on its cut end that floats still, sprouts weed, and grows bark on its friends.
defMark({ id: 'drift_seed', name: 'weeded', clock: 'own', negative: true, value: -0.08,
  turnStart(b, f) {
    const mk = f.m.drift_seed;
    const by = mk ? markedBy(b, mk) : null;
    if (!by) return;
    const d = strike(b, by, f, stat(b, by, 'mgk') * 0.25, 'M', 'TIDE');
    const o = b.s[by.side].f[b.s[by.side].out];
    if (o && !o.ko) heal(b, by, o, d);
  } });
defMark({ id: 'drift_armor', name: 'barked', max: 3, value: 0.08,
  inMul() { return 0.7; },
  afterTake(b, f, src, dealt, d) { if (d.dot) return; heal(b, null, f, f.maxHp * 0.05); const mk = f.m.drift_armor; if (mk) { mk.n--; if (mk.n <= 0) unmark(f, 'drift_armor'); } } });
defPassive({ id: 'drift_floats', name: 'Floats', owner: 'drift', text: 'If nothing hit it since its last turn: its next move deals 1.25x and adds Root 1.',
  afterTake(b, f, src, dealt, d) { if (!d.dot) f.k.driftHit = b.turnNo; },
  outMul(b, f, t, d) { return d.move && (f.k.driftHit ?? -9) < (f.k.prevTurnNo ?? 0) ? 1.25 : 1; },
  afterMove(b, f, m, c) { if ((f.k.driftHit ?? -9) < (f.k.prevTurnNo ?? 0) && f.k.dealt) { const t = foe(b, f); if (t && !c.blocked(t)) applyStatus(b, f, t, 'root', 1); } },
  turnEnd(b, f) { f.k.prevTurnNo = b.turnNo; } });
defPassive({ id: 'drift_bleached', name: 'Bleached', owner: 'drift', text: 'Its moves add 4% of its max HP against a Rooted foe.',
  addRaw(b, f, t, d) { return d.move && t.s.root ? f.maxHp * 0.04 : 0; } });
defMove({ id: 'drift_waterlog', name: 'Waterlog', type: 'ROOT', owner: 'drift', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | drop*2 arc | drip', text: 'Hits for 131% MGK. Slow 1. 1.5x on a Rooted foe.',
  run(c) { c.hit(c.tgt, { mgk: 1.31 }, { mult: c.tgt.s.root ? 1.5 : 1 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'drift_tideseed', name: 'Weed Seed', type: 'TIDE', owner: 'drift', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | kelp*2 arc | drip',
  text: 'Hits for 48% MGK. 3 turns: drains 25% MGK, healing your out whorl.',
  run(c) { c.hit(c.tgt, { mgk: 0.48 }); if (!c.tgt.ko) c.mark(c.tgt, 'drift_seed', 1, 3); } });
defMove({ id: 'drift_graincoat', name: 'Bark Coat', type: 'ROOT', owner: 'drift', reach: 'ally', cd: 3, fx: 'lift | leaf*3 converge | ring ally', text: 'An ally\'s next 3 hits deal 0.7x and each heals it 5% max HP.',
  run(c) { unmark(c.ally!, 'drift_armor'); c.mark(c.ally!, 'drift_armor', 3); } });
defMove({ id: 'drift_washedup', name: 'Washed Up', type: 'ROOT', owner: 'drift', reach: 'spread', tags: ['spell'], cd: 6, nerve: 5, fx: 'sway big | crest*4 sweep | splash all big tint',
  text: 'Hits for 119% MGK. Splash 35%. Every foe: Root 2. The foe\'s side loses 2 tide.',
  run(c) { c.spread({ mgk: 1.19 }); for (const e of standing(c.them)) c.st(e, 'root', 2); c.nerve(c.them, -2); } });

// spume: sea foam the gray wall let go of that washes the luck off foes, holds a friend's damage, and sends the bill later.
defMark({ id: 'spume_edict', name: 'foam covered', clock: 'own', value: 0.12,
  inMul(b, f, src, d) { return d.kind === 'M' ? 0 : 1; },
  statusImmune(f, id) { return id === 'silence'; } });
defMark({ id: 'spume_promise', name: 'afloat', clock: 'own', value: 0.3,
  beforeTake(b, f, src, amt) { f.k.afloat = (f.k.afloat || 0) + amt; return 0; },
  expire(b, f) { const held = f.k.afloat || 0; f.k.afloat = 0; if (held > 0) { msg(b, `The bill comes for ${label(b, f)}.`); dealDamage(b, null, f, held * 0.35, dot('T'), null); } } });
defPassive({ id: 'spume_buoyant', name: 'Buoyant', owner: 'spume', text: 'Its heals are 1.3x on allies with a bad status.',
  healMul(b, f, t) { return Object.keys(t.s).some(id => ['stun', 'silence', 'sleep', 'root', 'taunt', 'slow', 'burn', 'bleed', 'poison', 'rot', 'expose', 'weaken'].includes(id)) ? 1.3 : 1; } });
defPassive({ id: 'spume_dissolve', name: 'On the Bill', owner: 'spume', text: 'While it stands, your crests can run 2 tide into debt. New tide pays the debt first.',
  credit() { return 2; } });
const GOODS = ['empower', 'fortify', 'haste', 'ward', 'regen', 'thorns', 'unstop'] as const;
defMove({ id: 'spume_foamwash', name: 'Foam Wash', type: 'TIDE', owner: 'spume', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | bubble*4 wave | fizz',
  text: 'Hits for 242% MGK. Removes 1 good status from the foe. Root 1.',
  run(c) { c.hit(c.tgt, { mgk: 2.42 }); if (c.tgt.ko || c.blocked(c.tgt)) return; const g = GOODS.find(id => c.tgt.s[id]); if (g) delete c.tgt.s[g]; c.st(c.tgt, 'root', 1); } });
defMove({ id: 'spume_becalm', name: 'Foam Cover', type: 'STAR', owner: 'spume', reach: 'ally', cd: 3, fx: 'swell | bubble*3 rise | ring ally', text: 'An ally takes no magic damage and can\'t be Silenced, 2 turns.',
  run(c) { c.mark(c.ally!, 'spume_edict', 1, 2); } });
defMove({ id: 'spume_washout', name: 'Rinse Clean', type: 'STAR', owner: 'spume', reach: 'ally', cd: 2, fx: 'sway | drop*3 rain | fizz ally',
  text: 'Cleanses an ally. Heals 8% max HP, 16% if it cleansed one. Regen 3 (7% max HP a turn).',
  run(c) { const a = c.ally!; const n = c.cleanse(a); c.heal(a, a.maxHp * (n ? 0.16 : 0.08)); c.st(a, 'regen', 3, 0.07); } });
defMove({ id: 'spume_keptafloat', name: 'Kept Afloat', type: 'STAR', owner: 'spume', reach: 'ally', cd: 6, nerve: 5, fx: 'lift big | bubble*6 orbit | fizz ally big tint', text: 'An ally takes no damage for 2 turns. Then 35% of it lands at once.',
  run(c) { c.ally!.k.afloat = 0; c.mark(c.ally!, 'spume_promise', 1, 2); } });

// ebb: a scrap of the sea's own shell that fires the tide out as a long shot, or pulls it in and pounds like an undertow.
defMark({ id: 'ebb_hammer', name: 'pulled in', value: 0.05,
  leave(b, f) { unmark(f, 'ebb_hammer'); clearForm(b, f); } });
defMark({ id: 'ebb_charge', name: 'running out', max: 2, clock: 'own', volatile: true, value: 0.06,
  outMul(b, f, t, d) { return d.attack ? 1.8 : 1; },
  afterAttack(b, f) { const mk = f.m.ebb_charge; if (!mk) return; hastenFighter(b, f, 30); mk.n--; if (mk.n <= 0) unmark(f, 'ebb_charge'); } });
defMark({ id: 'ebb_fieldmark', name: 'churning', clock: 'own', volatile: true, value: 0.08,
  turnStart(b, f) { const t = foe(b, f); if (t) strike(b, f, t, stat(b, f, 'atk') * 0.25, 'P', 'TIDE'); } });
const ebbHammer = (f: Fighter) => f.form?.tag === 'hammer';
function ebbTurn(b: Battle, f: Fighter): void { if (has(f, 'ebb_turningtide')) { f.k.nextMoveMul = 1.2; hastenFighter(b, f, 30); } }
defPassive({ id: 'ebb_turningtide', name: 'Turning Tide', owner: 'ebb', text: 'When it changes stance: its next turn comes 30% sooner, and its next move deals 1.2x.' });
defPassive({ id: 'ebb_recedes', name: 'Drawn Back', owner: 'ebb', text: 'Pulled In: takes 0.75x damage.',
  inMul(b, f) { return ebbHammer(f) ? 0.75 : 1; } });
defMove({ id: 'ebb_lap', name: 'Wave Shot', type: 'TIDE', owner: 'ebb', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'recoil | drop*3 line fast | splash', text: 'Hits for 277% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 2.77 }); } });
defMove({ id: 'ebb_setback', name: 'Run Out', type: 'TIDE', owner: 'ebb', reach: 'self', cd: 3, wt: 50, fx: 'sway | ring self', text: 'Its next 2 attacks deal 1.8x and each makes its next turn 30% sooner.',
  run(c) { c.mark(c.u, 'ebb_charge', 2, 3); } });
defMove({ id: 'ebb_slackwater', name: 'Pull In', type: 'TIDE', owner: 'ebb', reach: 'self', cd: 2, wt: 60, fx: 'sink | vortex self', text: 'Pulls In: 1.4x DEF and RES, physical attacks, and Pulled In moves.',
  run(c) { setForm(c.b, c.u, { tag: 'hammer', basic: 'P', statMul: { def: 1.4, res: 1.4 } }, ['ebb_skies', 'ebb_field', 'ebb_cannon', 'ebb_blow']); c.mark(c.u, 'ebb_hammer', 1); ebbTurn(c.b, c.u); } });
defMove({ id: 'ebb_kingtide', name: 'High Water', type: 'TIDE', owner: 'ebb', reach: 'single', tags: ['projectile', 'spell'], cd: 6, nerve: 4, fx: 'lift big | crest*4 line | splash big tint jolt',
  text: 'Hits for 304% MGK. Slow 1. The swell rises 4.',
  run(c) { c.hit(c.tgt, { mgk: 3.04 }); c.st(c.tgt, 'slow', 1); raiseSwell(c.b, 4); } });
defMove({ id: 'ebb_skies', name: 'Wave Crash', type: 'STONE', owner: 'ebb', reach: 'single', tags: ['dash'], cd: 1, extra: true, fx: 'lunge | splash crack',
  text: 'Hits for 181% ATK. Slow 1.',
  run(c) { c.hit(c.tgt, { atk: 1.81 }); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'ebb_field', name: 'Churned Water', type: 'TIDE', owner: 'ebb', reach: 'self', cd: 3, extra: true, wt: 60, fx: 'sink | drop*4 orbit | ring self', text: 'Shield of 10% max HP. Next 3 turns: hits the foe for 25% ATK.',
  run(c) { c.shield(c.u, c.u.maxHp * 0.1, 3); c.mark(c.u, 'ebb_fieldmark', 1, 3); } });
defMove({ id: 'ebb_cannon', name: 'Ebb Out', type: 'TIDE', owner: 'ebb', reach: 'self', tags: ['projectile'], cd: 2, extra: true, wt: 60, fx: 'lift | ring self', text: 'Returns to its Out stance.',
  run(c) { unmark(c.u, 'ebb_hammer'); clearForm(c.b, c.u); ebbTurn(c.b, c.u); } });
defMove({ id: 'ebb_blow', name: 'Undertow Pull', type: 'TIDE', owner: 'ebb', reach: 'single', cd: 6, nerve: 4, extra: true, fx: 'sink big | vortex big jolt', text: 'Hits for 161% ATK + 13% of the foe\'s max HP. Forces it out.',
  run(c) { c.hit(c.tgt, { atk: 1.61, tgtHp: 0.13 }); if (!c.tgt.ko) c.forceOut(); } });

// ================================================================ marsh

// heron: a gray heron on one leg that stands still in the reeds until it does not.
defMark({ id: 'heron_mark', name: 'spotted', clock: 'own', negative: true, value: -0.06,
  inMul(b, f, src) { const mk = f.m.heron_mark; return mk && src && markedBy(b, mk) === src ? 1.2 : 1; } });
defPassive({ id: 'heron_stockstill', name: 'Stock Still', owner: 'heron', text: 'Every 3rd hit it takes deals 0.',
  beforeTake(b, f, src, amt, d) {
    if (d.dot || !src || src.side === f.side) return amt;
    f.k.still = (f.k.still || 0) + 1;
    if (f.k.still % 3 !== 0) return amt;
    msg(b, `${label(b, f)} was never there.`);
    return 0;
  } });
defPassive({ id: 'heron_graycoat', name: 'Gray Coat', owner: 'heron', text: 'Deals 1.25x damage to a Rooted foe.',
  outMul(b, f, t) { return t.s.root ? 1.25 : 1; } });
defMove({ id: 'heron_billstab', name: 'Bill Stab', type: 'BEAST', owner: 'heron', reach: 'single', tags: ['projectile'], cd: 1, fx: 'lunge fast | slash', text: 'Hits for 62% ATK. Slow 1. The first reserve takes 40% of the damage.',
  run(c) { c.hit(c.tgt, { atk: 0.62 }); c.st(c.tgt, 'slow', 1); const r = reserves(c.them)[0]; if (r) c.hit(r, { atk: 0.62 }, { reserve: true, mult: 0.4 }); } });
defMove({ id: 'heron_reedsnare', name: 'Reed Snare', type: 'BEAST', owner: 'heron', reach: 'single', cd: 3, fx: 'sway | kelp*3 rise | ring', text: 'Hits for 60% ATK. Root 2. Already Rooted: Stun 1 instead.',
  run(c) { const caught = !!c.tgt.s.root; c.hit(c.tgt, { atk: 0.6 }); c.st(c.tgt, caught ? 'stun' : 'root', caught ? 1 : 2); } });
defMove({ id: 'heron_reedstand', name: 'Spot Prey', type: 'TIDE', owner: 'heron', reach: 'single', tags: ['projectile'], cd: 3, fx: 'shake | drop*2 line fast | splash',
  text: 'Hits for 90% ATK. For 2 turns the foe takes 1.2x from Ardeagi.',
  run(c) { c.hit(c.tgt, { atk: 0.9 }); if (!c.tgt.ko) c.mark(c.tgt, 'heron_mark', 1, 2); } });
defMove({ id: 'heron_longneck', name: 'Strike Down', type: 'BEAST', owner: 'heron', reach: 'self', cd: 6, nerve: 5, fx: 'sink big | ring sparkle tint self',
  text: 'Lies in wait. When the foe next acts, guard or switch too: strikes first, 200% ATK, Slow 2.',
  run(c) { lieInWait(c.b, c.u, 'heron_strike'); } });
defMove({ id: 'heron_strike', name: 'Spring Up', type: 'BEAST', owner: 'heron', reach: 'single', cd: 1, extra: true, fx: 'lunge fast | bite slash big jolt',
  text: 'Hits for 200% ATK. Slow 2.',
  run(c) { c.hit(c.tgt, { atk: 2.0 }); c.st(c.tgt, 'slow', 2); } });

// elver: a glass eel you can see through that slips past everything, and every third bite it does not let go.
defMark({ id: 'elver_haze', name: 'slimed', clock: 'own', negative: true, value: -0.08,
  statBonus(f, k) { return k === 'def' ? -12 : 0; } });
function elverBash(b: Battle, f: Fighter, t: Fighter): void {
  if (t.ko || t.gone) return;
  msg(b, `${label(b, f)} bites and holds.`);
  strike(b, f, t, stat(b, f, 'atk') * 0.35, 'P', 'TIDE');
  if (!t.ko) { delayFighter(b, t, 15); applyStatus(b, f, t, 'root', 1); }
  if (has(f, 'elver_slick')) heal(b, f, f, f.maxHp * 0.06);
}
defPassive({ id: 'elver_thirdbite', name: 'Third Bite', owner: 'elver', text: 'Every 3rd attack: also 35% ATK and holds on. Delays the foe 15%. Root 1.',
  afterAttack(b, f, t) { f.k.bites = (f.k.bites || 0) + 1; if (f.k.bites % 3 === 0 || f.k.bashNext) { f.k.bashNext = 0; elverBash(b, f, t); } } });
defPassive({ id: 'elver_slick', name: 'Slick', owner: 'elver', text: 'Third Bite heals it 6% of its max HP.' });
defMove({ id: 'elver_murk', name: 'Dart Off', type: 'TIDE', owner: 'elver', reach: 'self', cd: 2, wt: 50, fx: 'blink | ring self', text: 'Haste 2. Its next attack sets off Third Bite.',
  run(c) { c.st(c.u, 'haste', 2); c.u.k.bashNext = 1; } });
defMove({ id: 'elver_glasseel', name: 'Eel Coil', type: 'TIDE', owner: 'elver', reach: 'spread', cd: 3, fx: 'spin | kelp*3 orbit | ring all', text: 'Hits for 54% ATK. Splash 35%. Stun 1.',
  run(c) { c.spread({ atk: 0.54 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'elver_writhe', name: 'Writhe', type: 'BEAST', owner: 'elver', reach: 'single', cd: 3, fx: 'shake | kelp sweep | drip',
  text: 'Hits for 36% ATK. Removes Ward. -12 DEF for 3 turns.',
  run(c) { delete c.tgt.s.ward; c.mark(c.tgt, 'elver_haze', 1, 3); c.hit(c.tgt, { atk: 0.36 }); } });
defMove({ id: 'elver_elverrun', name: 'Elver Run', type: 'TIDE', owner: 'elver', reach: 'single', tags: ['dash'], cd: 5, nerve: 4, fx: 'lunge | bite splash jolt fast big', text: 'Hits for 108% ATK, then Third Bite. Haste 2.',
  run(c) { c.hit(c.tgt, { atk: 1.08 }); if (!c.tgt.ko && !c.blocked(c.tgt)) elverBash(c.b, c.u, c.tgt); c.st(c.u, 'haste', 2); } });

// peat: a cut of marsh peat with an eye in its top that keeps whatever falls in and takes a little of everything near it.
defSummon({ id: 'peat_body', name: 'Bog Body', owner: 'peat', every: 100,
  text: 'A fallen foe the bog kept. On its own clock it uses that foe\'s small moves with Deispes\'s stats. 2 turns.',
  sprite: { px: ['........', '..1..1..', '..3222..', '.132231.', '.122231.', '1..11...', '.114141.', '..4444.1'], c: ['#7a6040', '#36dc92', '#3a2e22'] } });
defMark({ id: 'peat_shroud', name: 'in marsh gas', clock: 'own', volatile: true, value: 0.12,
  beforeTake(b, f, src, amt, d) { return d.attack ? 0 : amt; } });
defPassive({ id: 'peat_bogbreath', name: 'Bog Breath', owner: 'peat', text: 'Turn start: the foe loses 2% of its max HP.',
  turnStart(b, f) { const t = foe(b, f); if (t) dealDamage(b, f, t, t.maxHp * 0.02, dot('T'), null); } });
defPassive({ id: 'peat_preserved', name: 'Preserved', owner: 'peat', text: 'When a foe is KO\'d while it is out: heals 18% of its max HP. The bog keeps a Bog Body.',
  anyKO(b, f, v) {
    if (v.side === f.side || !isOut(b, f)) return;
    heal(b, f, f, f.maxHp * 0.18);
    summonTwin(b, f, 'peat_body', { hp: 0.15, turns: 2, moves: v.mon.moves.slice() });
  } });
defMove({ id: 'peat_seep', name: 'Bog Pulse', type: 'ROOT', owner: 'peat', reach: 'spread', tags: ['spell'], cd: 1, fx: 'sink | bubble*4 rise | fizz all', text: 'Hits for 70% MGK. Splash 35%. Your team heals 3% of max HP.',
  run(c) { c.spread({ mgk: 0.7 }); for (const a of standing(c.me)) c.heal(a, a.maxHp * 0.03); } });
defMove({ id: 'peat_smoke', name: 'Marsh Gas', type: 'ROOT', owner: 'peat', reach: 'self', cd: 4, wt: 60, fx: 'sink | smoke self', text: 'Attacks deal it 0 until its next turn ends. Slow 1 on the foe.',
  run(c) { c.mark(c.u, 'peat_shroud', 1, 1); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'peat_mire', name: 'Sink Hole', type: 'TIDE', owner: 'peat', reach: 'single', tags: ['spell'], cd: 3, fx: 'sink | vortex drip',
  text: 'Hits for 103% MGK. Rot 2. Slow 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.03 }); c.st(c.tgt, 'rot', 2); c.st(c.tgt, 'slow', 1); } });
defMove({ id: 'peat_slane', name: 'Peat Spade', type: 'ROOT', owner: 'peat', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'stomp big | crack quake big jolt', text: 'Hits for 54% MGK + 35% of the foe\'s missing HP. Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.54, tgtMiss: 0.35 }); c.st(c.tgt, 'stun', 1); } });

// ================================================================ underspire

// tenor: the tenor bell from under Spire that hops on its clapper and rings so deep that whatever stands in front of it stays put.
defSummon({ id: 'tenor_eidolon', name: 'Bell Spirit', owner: 'tenor', sprite: { px: ['........', '...44...', '..2222..', '.222222.', '.212212.', '22222222', '...3....', '...3....'], c: ['#e6d6af', '#c59e56', '#877051'] }, text: 'Each turn: hits the foe for 35% of Kelpana\'s MGK.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (f && !f.ko && t && !t.ko) strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'GEAR'); } });
defMark({ id: 'tenor_malefice', name: 'ringing', clock: 'own', volatile: true, negative: true, value: -0.15,
  turnStart(b, f) { const mk = unmark(f, 'tenor_malefice'); const by = mk ? markedBy(b, mk) : null; if (!by) return; strike(b, by, f, stat(b, by, 'mgk') * 0.5, 'M', 'STONE'); if (!f.ko) stunNow(b, by, f); } });
defMark({ id: 'tenor_pulse', name: 'humming', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (t) dealDamage(b, f, t, t.maxHp * 0.05, dot('T'), null); } });
defMark({ id: 'tenor_hole', name: 'tolling', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'tenor_hole'); splash(b, f, stat(b, f, 'mgk') * 0.8, 'M', 'GEAR'); } });
defPassive({ id: 'tenor_undertone', name: 'Undertone', owner: 'tenor', text: 'When it Stuns a foe: each foe reserve takes 20% MGK.',
  afterApply(b, f, t, id) { if (id !== 'stun' || t.side === f.side) return; for (const r of reserves(b.s[t.side])) dealDamage(b, f, r, stat(b, f, 'mgk') * 0.2, { kind: 'M', move: null, attack: false, dot: false, spread: true, reserve: true }, null); } });
defPassive({ id: 'tenor_bellmouth', name: 'Bell Mouth', owner: 'tenor', text: 'Deals 1.25x damage to a Stunned foe.',
  outMul(b, f, t) { return t.s.stun ? 1.25 : 1; } });
defMove({ id: 'tenor_clapper', name: 'Clapper', type: 'GEAR', owner: 'tenor', reach: 'single', tags: ['sound'], cd: 2, fx: 'hop | bell line | ring',
  text: 'Hits for 56% MGK. Summons a Bell Spirit (8% max HP, 2 turns).',
  run(c) { c.hit(c.tgt, { mgk: 0.56 }); summon(c.b, c.u, 'tenor_eidolon', { hp: 0.08, turns: 2 }); } });
defMove({ id: 'tenor_peal', name: 'Peal', type: 'STONE', owner: 'tenor', reach: 'single', tags: ['sound'], cd: 3, fx: 'sway | bell*2 line | ring',
  text: 'Hits for 40% MGK. At the foe\'s next turn: 50% MGK and Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 0.4 }); if (!c.tgt.ko) c.mark(c.tgt, 'tenor_malefice', 1, 2); } });
defMove({ id: 'tenor_ringout', name: 'Ring Out', type: 'GEAR', owner: 'tenor', reach: 'self', tags: ['sound'], cd: 3, wt: 70, fx: 'shake | ring self',
  text: 'Next 3 turns: the foe loses 5% of its max HP.',
  run(c) { c.mark(c.u, 'tenor_pulse', 1, 3); } });
defMove({ id: 'tenor_greattoll', name: 'Great Toll', type: 'GEAR', owner: 'tenor', reach: 'spread', tags: ['sound', 'channel'], cd: 7, nerve: 6, fx: 'shake big | bell*4 rain | ring all big jolt',
  text: 'Hits for 49% MGK now and next turn. Splash 35%. Stun 2.',
  run(c) { c.spread({ mgk: 0.49 }); c.st(c.tgt, 'stun', 2); c.mark(c.u, 'tenor_hole', 1, 2); } });

// glaze: a crazed church window from under Spire with an eye in each pane that lets a pane go for every hit it takes.
defMark({ id: 'glaze_pane', name: 'panes', max: 4, value: 0.12,
  beforeTake(b, f, src, amt, d) {
    const mk = f.m.glaze_pane;
    if (!mk || d.dot || !src || src.side === f.side) return amt;
    mk.n--;
    f.k.panes = (f.k.panes || 0) + 1;
    msg(b, 'A pane breaks.');
    if (mk.n <= 0) { unmark(f, 'glaze_pane'); if (has(f, 'glaze_cracked')) hastenFighter(b, f, 30); }
    return amt * 0.6;
  } });
defSummon({ id: 'glaze_trap', name: 'Glass Shard', owner: 'glaze', sprite: { px: ['........', '...3....', '...33...', '..323...', '..333...', '..3433..', '.44444..', '........'], c: ['#f4d4dc', '#c7243e', '#473d54'] }, text: 'Stays until a foe comes out. Hits it for 60% of Madotra\'s MGK. Slow 2.',
  trap(b, s, who) { const f = ownerOf(b, s); applyStatus(b, f, who, 'slow', 2); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.6, 'M', 'STAR'); return true; } });
defMark({ id: 'glaze_meld', name: 'leaded', clock: 'own', volatile: true, value: 0.08,
  outMul(b, f, t, d) { return d.move ? 1.6 : 1; },
  afterMove(b, f, m, c) { unmark(f, 'glaze_meld'); if (f.k.dealt && !c.blocked(c.tgt)) applyStatus(b, f, c.tgt, 'expose', 2); } });
defPassive({ id: 'glaze_tinted', name: 'Leaded Panes', owner: 'glaze', text: 'Starts with 2 Panes. A hit breaks one and deals 0.6x. Per break: next move +15%.',
  start(b, f) { mark(b, f, f, 'glaze_pane', 2); },
  outMul(b, f, t, d) { return d.move && f.k.panes ? 1 + 0.15 * Math.min(2, f.k.panes) : 1; },
  afterMove(b, f) { f.k.panes = 0; } });
defPassive({ id: 'glaze_cracked', name: 'Crazed', owner: 'glaze', text: 'When its last Pane breaks: its next turn comes 30% sooner.' });
defMove({ id: 'glaze_stain', name: 'Stained Light', type: 'TIDE', owner: 'glaze', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | beam | flash',
  text: 'Hits for 60% MGK. The first reserve takes 40%. Each use turns it TIDE, GEAR, then STAR.',
  run(c) {
    c.hit(c.tgt, { mgk: 0.6 });
    const r = reserves(c.them)[0];
    if (r) c.hit(r, { mgk: 0.6 }, { reserve: true, mult: 0.4 });
    const i = c.u.moves.indexOf('glaze_stain'), cycle: Type[] = ['TIDE', 'GEAR', 'STAR'];
    if (i >= 0) retypeMove(c.b, c.u, i, cycle[(cycle.indexOf(c.type) + 1) % 3], 0);
  } });
defMove({ id: 'glaze_refract', name: 'New Pane', type: 'STAR', owner: 'glaze', reach: 'self', cd: 4, wt: 60, fx: 'flare | shard*3 orbit | sparkle self', text: 'Gains a Pane, up to 4.',
  run(c) { c.mark(c.u, 'glaze_pane', 1); } });
defMove({ id: 'glaze_leading', name: 'Lead Line', type: 'STAR', owner: 'glaze', reach: 'self', cd: 3, wt: 60, fx: 'sway | ring self', text: 'Its next move deals 1.6x damage and adds Expose 2.',
  run(c) { c.mark(c.u, 'glaze_meld', 1, 2); } });
defMove({ id: 'glaze_rosewindow', name: 'Rose Window', type: 'STAR', owner: 'glaze', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, fx: 'swell big | shard*8 converge | shatter sparkle big glare',
  text: 'Hits for 120% MGK, typed to hurt the foe most. Slow 2. Sets a Glass Shard (6% max HP).',
  run(c) {
    const all: Type[] = ['STONE', 'TIDE', 'ROOT', 'GEAR', 'BEAST', 'STAR', 'SALT', 'VOID'];
    const ty = all.reduce((best, t) => typeOn(c.b, c.tgt, t, undefined, c.u) > typeOn(c.b, c.tgt, best, undefined, c.u) ? t : best, c.type);
    c.hit(c.tgt, { mgk: 1.2 }, { type: ty });
    c.st(c.tgt, 'slow', 2);
    summon(c.b, c.u, 'glaze_trap', { hp: 0.06 });
  } });

// pipe: an organ pipe from Spire that sings out of its middle and lets out notes that go on hitting after it stops.
defSummon({ id: 'pipe_spirit', name: 'Held Note', owner: 'pipe', sprite: { px: ['........', '..2332..', '.24..42.', '24....42', '24....42', '.24..42.', '..2222..', '........'], c: ['#ceedde', '#3ea17b', '#7bcba4'] }, text: 'Twice a turn: hits the foe for 22% of Urkuda\'s MGK and heals Urkuda 33% of the damage. It sounds on after Urkuda falls.', every: 50, lasting: true,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (!f || !t || t.ko || t.gone) return; const d = strike(b, f, t, stat(b, f, 'mgk') * 0.22, 'M', 'STAR'); if (!f.ko) heal(b, f, f, d / 3); } });
defMark({ id: 'pipe_siphon', name: 'drawing air', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { const t = foe(b, f); if (!t) return; const d = dealDamage(b, f, t, t.maxHp * 0.04, dot('T'), null); heal(b, f, f, d); } });
defPassive({ id: 'pipe_cipher', name: 'Open Stop', owner: 'pipe', text: 'Its moves add 5% of the foe\'s max HP.',
  addRaw(b, f, t, d) { return d.move && !d.reserve ? t.maxHp * 0.05 : 0; } });
defPassive({ id: 'pipe_windchest', name: 'Full Chest', owner: 'pipe', text: 'While its Held Notes are out: takes 0.85x damage.',
  inMul(b, f) { return summonsOf(b, f.side, 'pipe_spirit').length ? 0.85 : 1; } });
defMove({ id: 'pipe_drone', name: 'Low Drone', type: 'STAR', owner: 'pipe', reach: 'spread', tags: ['sound'], cd: 1, fx: 'sway | ring all',
  text: 'Hits for 78% MGK. Splash 35%. Heals 20% of the damage to the foe.',
  run(c) { const d = c.spread({ mgk: 0.78 }); c.heal(c.u, d * 0.2); } });
defMove({ id: 'pipe_stopped', name: 'Stopped Note', type: 'GEAR', owner: 'pipe', reach: 'single', tags: ['sound'], cd: 3, fx: 'recoil | ring daze',
  text: 'Hits for 54% MGK. Silence 1. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 0.54 }); c.st(c.tgt, 'silence', 1); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'pipe_bellows', name: 'Draw Air', type: 'STAR', owner: 'pipe', reach: 'single', tags: ['spell', 'channel'], cd: 3, fx: 'sink | vortex', text: 'Hits for 43% MGK. Next 3 turns: drains 4% of the foe\'s max HP.',
  run(c) { c.hit(c.tgt, { mgk: 0.43 }); c.mark(c.u, 'pipe_siphon', 1, 3); } });
defMove({ id: 'pipe_fullorgan', name: 'Full Organ', type: 'STAR', owner: 'pipe', reach: 'side', tags: ['sound'], cd: 6, nerve: 5, wt: 70, fx: 'swell big | ring self big tint',
  text: 'Summons 2 Held Notes (8% max HP, 3 turns). They sound on after Urkuda falls.',
  run(c) { summon(c.b, c.u, 'pipe_spirit', { hp: 0.08, turns: 6 }); summon(c.b, c.u, 'pipe_spirit', { hp: 0.08, turns: 6 }); } });

// pew: a pew from under Spire with a face in its backrest that saves a seat for one foe at a time and lets nobody near it go all the way down.
defMark({ id: 'pew_hunted', name: 'seated', value: -0.04 });
defSummon({ id: 'pew_wolf', name: 'Hymnbook', owner: 'pew', sprite: { px: ['........', '22....22', '222..222', '22144122', '.224422.', '..2332..', '...33...', '........'], c: ['#6e4a3a', '#2bd200', '#ecdcc8'] }, text: 'Each turn: snaps at the foe for 30% of Nanum\'s ATK. Slow 1.', every: 100,
  act(b, s, f) { const t = b.s[1 - s.side].f[b.s[1 - s.side].out]; if (!f || f.ko || !t || t.ko) return; strike(b, f, t, stat(b, f, 'atk') * 0.3, 'P', 'STONE'); if (!t.ko) applyStatus(b, f, t, 'slow', 1); } });
defMark({ id: 'pew_respite', name: 'all kneeling', clock: 'own', volatile: true, value: 0.05,
  beforeTake(b, f, src, amt) { const floor = Math.round(f.maxHp * 0.1); return f.hp + f.shield - amt < floor ? Math.max(0, f.hp + f.shield - floor) : amt; } });
function pewHunt(b: Battle, f: Fighter): void {
  if (b.s[1 - f.side].f.some(e => !e.ko && !e.gone && marked(e, 'pew_hunted'))) return;
  const t = foe(b, f);
  if (t) { mark(b, f, t, 'pew_hunted', 1, -1); msg(b, `${label(b, f)} saves a seat for ${label(b, t)}.`); }
}
defPassive({ id: 'pew_pewrent', name: 'Pew Rent', owner: 'pew', text: 'Saves a Seat for one foe at a time. When a Seated foe is KO\'d: +8% damage for the battle.',
  comeOut(b, f) { pewHunt(b, f); },
  anyOut(b, f, who) { if (who.side !== f.side && isOut(b, f)) pewHunt(b, f); },
  anyKO(b, f, v) { if (v.side !== f.side && v.k.pewMark) { f.k.marks = (f.k.marks || 0) + 1; pewHunt(b, f); } },
  afterDeal(b, f, t) { if (marked(t, 'pew_hunted')) t.k.pewMark = 1; },
  outMul(b, f) { return 1 + 0.08 * (f.k.marks || 0); } });
defPassive({ id: 'pew_kneeling', name: 'Reserved', owner: 'pew', text: 'Deals 1.2x damage to the Seated foe.',
  outMul(b, f, t) { return marked(t, 'pew_hunted') ? 1.2 : 1; } });
defMove({ id: 'pew_slidealong', name: 'Slide Along', type: 'STONE', owner: 'pew', reach: 'single', tags: ['dash', 'projectile'], cd: 1, fx: 'lunge fast | burst', text: 'Hits for 100% ATK. Its next turn comes 25% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.0 }); c.hasten(c.u, 25); } });
defMove({ id: 'pew_hardseat', name: 'Open Hymnbook', type: 'STONE', owner: 'pew', reach: 'side', cd: 3, wt: 70, fx: 'hop | puff ally', text: 'Summons a Hymnbook (12% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'pew_wolf', { hp: 0.12, turns: 3 }); } });
defMove({ id: 'pew_boxpew', name: 'Box Pew', type: 'ROOT', owner: 'pew', reach: 'single', cd: 3, fx: 'stomp | crack',
  text: 'Hits for 100% ATK + 8% of the foe\'s missing HP. Slow 1. Its Seat moves to it.',
  run(c) {
    c.hit(c.tgt, { atk: 1.0, tgtMiss: 0.08 });
    c.st(c.tgt, 'slow', 1);
    if (c.tgt.ko || c.blocked(c.tgt) || c.marked(c.tgt, 'pew_hunted')) return;
    for (const e of c.them.f) unmark(e, 'pew_hunted');
    mark(c.b, c.u, c.tgt, 'pew_hunted', 1, -1);
    c.msg(`${label(c.b, c.u)} saves the seat for ${label(c.b, c.tgt)}.`);
  } });
defMove({ id: 'pew_respite', name: 'All Kneel', type: 'STONE', owner: 'pew', reach: 'side', cd: 6, nerve: 5, fx: 'sink big | ring ally big tint', text: 'For 2 turns, neither out whorl can fall below 10% HP.',
  run(c) { c.mark(c.u, 'pew_respite', 1, 2); mark(c.b, c.u, c.tgt, 'pew_respite', 1, 2); } });

// relic: a reliquary with one eye behind the glass that puts on whatever it beats for a while and keeps a piece of it after.
defMark({ id: 'relic_body', name: 'wearing a body', clock: 'own', value: 0.15,
  expire(b, f) { relicLeaves(b, f); },
  leave(b, f) { unmark(f, 'relic_body'); relicLeaves(b, f); } });
function relicLeaves(b: Battle, f: Fighter): void {
  clearForm(b, f);
  const v = b.s[f.k.keepSide]?.f[f.k.keepIdx];
  const id = v?.mon.moves[1];
  if (id) keepMove(b, f, id);
}
defPassive({ id: 'relic_reliquary', name: 'Reliquary', owner: 'relic', text: 'When it KOs a foe: wears its body 3 turns, then keeps its second move in a fifth slot.',
  anyKO(b, f, v, killer) {
    if (killer !== f || v.side === f.side || !isOut(b, f)) return;
    f.k.keepSide = v.side; f.k.keepIdx = v.idx;
    takeOver(b, f, v, 'taken');
    unmark(f, 'relic_body');
    mark(b, f, f, 'relic_body', 1, 3);
    if (has(f, 'relic_underglass')) heal(b, f, f, f.maxHp * 0.15);
    msg(b, `${label(b, f)} puts on ${v.mon.name}.`);
  } });
defPassive({ id: 'relic_underglass', name: 'Under Glass', owner: 'relic', text: 'In a worn body: takes 0.85x damage. Putting one on heals 15% max HP.',
  inMul(b, f) { return marked(f, 'relic_body') ? 0.85 : 1; } });
defMark({ id: 'relic_mist', name: 'dusted', clock: 'own', volatile: true, value: 0.1,
  outMul(b, f, t, d) { return d.move ? 1.6 : 1; },
  beforeTake(b, f, src, amt, d) { if (d.dot || f.k.mistUsed) return amt; f.k.mistUsed = 1; return amt * 0.5; } });
defMove({ id: 'relic_giltedge', name: 'Gilt Edge', type: 'STONE', owner: 'relic', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | star line fast | sparkle', text: 'Hits for 161% MGK + 6% of the foe\'s current HP.',
  run(c) { c.hit(c.tgt, { mgk: 1.61, tgtCur: 0.06 }); } });
defMove({ id: 'relic_pall', name: 'Lid Shut', type: 'GEAR', owner: 'relic', reach: 'single', tags: ['spell'], cd: 3, wu: 50, fx: 'lift | shell arc | crack',
  text: 'Wind-up. Hits for 137% MGK, 1.5x on a foe below 30% HP. Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.37 }, { mult: c.tgt.hp < c.tgt.maxHp * 0.3 ? 1.5 : 1 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'relic_keepsake', name: 'Glass Dust', type: 'STONE', owner: 'relic', reach: 'self', cd: 3, wt: 60, fx: 'flare | sparkle self', text: 'Its next move deals 1.6x. The next hit on it deals 0.5x.',
  run(c) { c.u.k.mistUsed = 0; c.mark(c.u, 'relic_mist', 1, 2); } });
defMove({ id: 'relic_heartbreak', name: 'Into the Case', type: 'STONE', owner: 'relic', reach: 'single', tags: ['spell'], cd: 6, nerve: 4, fx: 'swell big | shell*4 converge | vortex big dark',
  text: 'Hits for 137% MGK + 23% of the foe\'s missing HP. Each reserve takes 51% MGK.',
  run(c) { c.hit(c.tgt, { mgk: 1.37, tgtMiss: 0.23 }); for (const r of reserves(c.them)) c.hit(r, { mgk: 0.51 }, { reserve: true, spread: true }); } });

// censer: a church censer off its hook that swings on its chain, binds foes in soot, and closes its smoke round them two breaths later.
defMark({ id: 'censer_shield', name: 'smoke screened', clock: 'own', value: 0.12,
  statusImmune(f, id) { return f.shield > 0 && ['stun', 'sleep', 'root', 'slow'].includes(id); } });
defMark({ id: 'censer_pool', name: 'in the ash', clock: 'own', negative: true, value: -0.08,
  turnStart(b, f) { const mk = f.m.censer_pool; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'mgk') * (f.s.root ? 0.5 : 0.25), 'M', 'ROOT'); } });
defMark({ id: 'censer_chain', name: 'smoke closing', clock: 'own', volatile: true, negative: true, value: -0.15,
  expire(b, f, mk) { const by = markedBy(b, mk); if (!by) return; msg(b, `The smoke closes on ${label(b, f)}.`); strike(b, by, f, stat(b, by, 'mgk') * 0.9, 'M', 'STAR'); if (!f.ko) applyStatus(b, by, f, 'stun', 1); } });
defPassive({ id: 'censer_swungwide', name: 'Swung Wide', owner: 'censer', text: 'Heals 18% of the damage its moves deal.',
  afterDeal(b, f, t, dealt, d) { if (d.move && !d.reserve) heal(b, f, f, dealt * 0.18); } });
defPassive({ id: 'censer_incense', name: 'Incense', owner: 'censer', text: 'Deals 1.3x damage to a Rooted foe.',
  outMul(b, f, t) { return t.s.root ? 1.3 : 1; } });
defMove({ id: 'censer_binding', name: 'Soot Bind', type: 'GEAR', owner: 'censer', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'spin | ember*2 return | smoke',
  text: 'Hits for 204% MGK. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 2.04 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'censer_sootshield', name: 'Smoke Screen', type: 'STAR', owner: 'censer', reach: 'ally', cd: 3, fx: 'swell | smoke ally', text: 'Shields an ally 23% max HP, 3 turns. Blocks Stun, Sleep, Root, Slow.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.23, 3); c.mark(c.ally!, 'censer_shield', 1, 3); } });
defMove({ id: 'censer_ashpool', name: 'Ash Pool', type: 'ROOT', owner: 'censer', reach: 'single', tags: ['spell'], cd: 3, fx: 'sway | ember*3 rain | smoke cinders',
  text: 'Hits for 64% MGK. The foe\'s next 3 turns: 25% MGK to it, 50% if Rooted.',
  run(c) { c.hit(c.tgt, { mgk: 0.64 }); if (!c.tgt.ko) c.mark(c.tgt, 'censer_pool', 1, 3); } });
defMove({ id: 'censer_smokechain', name: 'Smoke Closes', type: 'STAR', owner: 'censer', reach: 'single', tags: ['spell'], cd: 6, nerve: 5, fx: 'sway big | ember*4 orbit | smoke vortex big dark', text: 'Hits for 147% MGK. Slow 2. Still out after 2 of its turns: 90% MGK and Stun 1.',
  run(c) { c.hit(c.tgt, { mgk: 1.47 }); c.st(c.tgt, 'slow', 2); if (!c.tgt.ko) c.mark(c.tgt, 'censer_chain', 1, 2); } });

// ================================================================ understory and rootfall

// strix: an owl's shell with more eyes painted on its wings that hunts at night and silences whatever it looks at.
const STRIX_NIGHT: SpriteData = { px: ['4.4..4.4', '44444444', '43422434', '43122134', '44222244', '4.4224.4', '44.44.44', '........'], c: ['#dcd0b4', '#bfa31a', '#3f3952'] };
defMark({ id: 'strix_dark', name: 'moonless', clock: 'own', value: 0.2,
  statusImmune(f, id) { return id === 'root' || id === 'slow'; },
  expire(b, f) { clearForm(b, f); },
  leave(b, f) { unmark(f, 'strix_dark'); clearForm(b, f); } });
const night = (b: Battle, f: Fighter) => marked(f, 'strix_dark') > 0 || Math.floor((roundOf(b) - 1) / 4) % 2 === 1;
defPassive({ id: 'strix_nightwings', name: 'Night Wings', owner: 'strix', text: 'Night is rounds 5 to 8 of every 8. At night: deals 1.2x, turns come 15% sooner.',
  outMul(b, f) { return night(b, f) ? 1.2 : 1; },
  turnEnd(b, f) { if (night(b, f)) { const s = b.s[f.side]; s.next = Math.max(b.t + 10, s.next - 15); } } });
defPassive({ id: 'strix_pinned', name: 'Hush Hunt', owner: 'strix', text: 'At night it is Silent: nothing hears what it does. Deals 1.25x damage to a Silenced foe.',
  silent(b, f) { return night(b, f); },
  outMul(b, f, t) { return t.s.silence ? 1.25 : 1; } });
defMove({ id: 'strix_swoop', name: 'Swoop', type: 'BEAST', owner: 'strix', reach: 'single', cd: 1, fx: 'lift | lunge fast | claw', text: 'Hits for 94% ATK. Slow 1. At night: delays the foe\'s next turn 30%.',
  run(c) { c.hit(c.tgt, { atk: 0.94 }); c.st(c.tgt, 'slow', 1); if (night(c.b, c.u)) c.delay(c.tgt, 30); } });
defMove({ id: 'strix_dreadcall', name: 'Owl Stare', type: 'VOID', owner: 'strix', reach: 'single', cd: 3, fx: 'flare | rune*2 converge | daze dark',
  text: 'Hits for 57% ATK. Silence 1, or 2 at night.',
  run(c) { c.hit(c.tgt, { atk: 0.57 }); c.st(c.tgt, 'silence', night(c.b, c.u) ? 2 : 1); } });
defMove({ id: 'strix_mantle', name: 'Wing Mantle', type: 'BEAST', owner: 'strix', reach: 'self', cd: 3, wt: 60, fx: 'lift | feather*3 orbit | ring self', text: 'Fortify 1. At night: Haste 2 and heals 8% of its max HP.',
  run(c) { c.st(c.u, 'fortify', 1); if (night(c.b, c.u)) { c.st(c.u, 'haste', 2); c.heal(c.u, c.u.maxHp * 0.08); } } });
defMove({ id: 'strix_longnight', name: 'Moonless', type: 'BEAST', owner: 'strix', reach: 'self', cd: 6, nerve: 4, wt: 60, fx: 'lift big | moon rise | sparkle self big dark', text: 'Night for it for 3 turns: 1.1x ATK, immune to Root and Slow. Haste 2.',
  run(c) { setForm(c.b, c.u, { tag: 'dark', sprite: STRIX_NIGHT, statMul: { atk: 1.1 } }); c.mark(c.u, 'strix_dark', 1, 3); c.st(c.u, 'haste', 2); } });

// hart: a red stag's shell with its antlers on that saves up everything you hit it with and spends it in one swing.
defPassive({ id: 'hart_grit', name: 'Stored Up', owner: 'hart', text: 'When hit: stores 30% of the damage as Grit, up to 40% of its max HP.',
  afterTake(b, f, src, dealt) { f.k.grit = Math.min(f.maxHp * 0.4, (f.k.grit || 0) + dealt * 0.3); } });
defPassive({ id: 'hart_rutseason', name: 'Rut Season', owner: 'hart', text: 'Every 2nd attack deals 1.4x damage.',
  outMul(b, f, t, d) { return d.attack && (f.k.punch || 0) % 2 === 1 ? 1.4 : 1; },
  afterAttack(b, f) { f.k.punch = (f.k.punch || 0) + 1; } });
defMove({ id: 'hart_antlers', name: 'Antler Jab', type: 'BEAST', owner: 'hart', reach: 'single', cd: 1, fx: 'lunge | slash', text: 'Hits for 123% ATK + 2% foe max HP. Its next turn comes 15% sooner.',
  run(c) { c.hit(c.tgt, { atk: 1.23, tgtHp: 0.02 }); c.hasten(c.u, 15); } });
defMove({ id: 'hart_lockantlers', name: 'Lock Antlers', type: 'BEAST', owner: 'hart', reach: 'single', cd: 3, fx: 'lunge | claw crack', text: 'Hits for 84% ATK. Slowed or Rooted foe: Stun 1. Else: Slow 2.',
  run(c) { const held = !!(c.tgt.s.slow || c.tgt.s.root); c.hit(c.tgt, { atk: 0.84 }); c.st(c.tgt, held ? 'stun' : 'slow', held ? 1 : 2); } });
defMove({ id: 'hart_haymaker', name: 'All At Once', type: 'TIDE', owner: 'hart', reach: 'single', cd: 3, fx: 'swell | lunge | burst splash',
  text: 'Spends Grit: shield of it. Hits for 70% ATK + 50% Grit, true damage.',
  run(c) { const g = c.u.k.grit || 0; c.u.k.grit = 0; c.shield(c.u, g, 2); c.hit(c.tgt, { atk: 0.7, flat: g * 0.5 }, { kind: 'T' }); } });
defMove({ id: 'hart_stagleap', name: 'Stag Leap', type: 'BEAST', owner: 'hart', reach: 'single', cd: 6, nerve: 5, fx: 'hop big | lunge | claw quake big jolt',
  text: 'Leaps over the foe: 118% ATK + 12% of its max HP to its first reserve, 40% of that to it.',
  run(c) {
    const r = reserves(c.them)[0];
    if (!r) { c.hit(c.tgt, { atk: 1.18, tgtHp: 0.12 }); return; }
    c.hit(r, { atk: 1.18, tgtHp: 0.12 }, { reserve: true });
    c.hit(c.tgt, { atk: 1.18, tgtHp: 0.12 }, { mult: 0.4 });
  } });

// skep: a straw beehive the bees left that stings on its own through the door in its belly, the same spot over and over.
defMark({ id: 'skep_swipe', name: 'stung', max: 6, clock: 'own', negative: true, value: -0.04 });
defMark({ id: 'skep_quick', name: 'buzzing', max: 3, clock: 'own', volatile: true, value: 0.06,
  afterAttack(b, f, t) { const mk = f.m.skep_quick; if (!mk) return; hastenFighter(b, f, 20); if (!t.ko && !t.gone) mark(b, f, t, 'skep_swipe', 1, 4); mk.n--; if (mk.n <= 0) unmark(f, 'skep_quick'); } });
defMark({ id: 'skep_rage', name: 'swarmed up', clock: 'own', volatile: true, value: 0.15,
  inMul() { return 0.4; } });
defPassive({ id: 'skep_swarming', name: 'Swarming', owner: 'skep', text: 'Its hits add a Sting, up to 6, for 4 turns. Each Sting: +7% ATK on its hits.',
  addRaw(b, f, t) { return stat(b, f, 'atk') * 0.07 * marked(t, 'skep_swipe'); },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && t.side !== f.side) mark(b, f, t, 'skep_swipe', marked(f, 'skep_rage') ? 2 : 1, 4); } });
defPassive({ id: 'skep_thickcomb', name: 'Honeycomb', owner: 'skep', text: 'At 4+ Stings on the foe: its attacks heal 20% of the damage.',
  afterDeal(b, f, t, dealt, d) { if (d.attack && marked(t, 'skep_swipe') >= 4) heal(b, f, f, dealt * 0.2); } });
defMove({ id: 'skep_buzz', name: 'Buzz', type: 'ROOT', owner: 'skep', reach: 'self', cd: 2, wt: 50, fx: 'shake | ring self', text: 'Its next 3 attacks each add 1 more Sting and come 20% sooner.',
  run(c) { c.mark(c.u, 'skep_quick', 3, 4); } });
defMove({ id: 'skep_smokeout', name: 'Smoke Out', type: 'VOID', owner: 'skep', reach: 'spread', cd: 2, fx: 'sway | smoke all',
  text: 'Hits for 88% ATK. Splash 35%. Slow 2. Drives out every foe summon.',
  run(c) { c.spread({ atk: 0.88 }); c.st(c.tgt, 'slow', 2); for (const u of c.them.sum.slice()) dismiss(c.b, u); } });
defMove({ id: 'skep_swarmup', name: 'Swarm Up', type: 'ROOT', owner: 'skep', reach: 'self', cd: 4, wt: 50, fx: 'swell | puff self', text: 'Until its next turn ends: takes 0.4x damage, Stings count 2.',
  run(c) { c.mark(c.u, 'skep_rage', 1, 1); } });
defMove({ id: 'skep_hiverage', name: 'Whole Hive', type: 'ROOT', owner: 'skep', reach: 'single', cd: 6, nerve: 4, fx: 'shake big | spark*5 converge | bite burst big jolt',
  text: 'Hits 5 times for 50% ATK, 1.5x each on a foe with 4 or more Stings.',
  run(c) { for (let i = 0; i < 5 && !c.tgt.ko; i++) c.hit(c.tgt, { atk: 0.5 }, { mult: c.marked(c.tgt, 'skep_swipe') >= 4 ? 1.5 : 1 }); } });

// taproot: a taproot off the Bole walking on its leaves that roots things where they stand and drinks from them.
defSummon({ id: 'taproot_sapling', name: 'Sapling', owner: 'taproot', text: 'Stays until a foe comes out. Hits it for 60% of Nekkori\'s MGK. Root 1.',
  sprite: { px: ['........', '........', '4....4..', '.2..2...', '..2222..', '.232232.', '.222222.', '.2.22.2.'], c: ['#523e2f', '#6afa8b', '#459d34'] },
  trap(b, s, who) { const f = ownerOf(b, s); msg(b, 'A sapling bursts.'); if (f) strike(b, f, who, stat(b, f, 'mgk') * 0.6, 'M', 'ROOT'); if (!who.ko) applyStatus(b, f, who, 'root', 1); return true; } });
defPassive({ id: 'taproot_deepdrink', name: 'Deep Drink', owner: 'taproot', text: 'While the foe is Rooted: its heals go to Nekkori instead. Every 3rd move: heals 8% max HP.',
  drinks(b, f, t) { return isOut(b, f) && t === foe(b, f) && !!t.s.root; },
  afterMove(b, f) { f.k.sips = (f.k.sips || 0) + 1; if (f.k.sips % 3 === 0) heal(b, f, f, f.maxHp * 0.08); } });
defPassive({ id: 'taproot_deepseated', name: 'Deep Seated', owner: 'taproot', text: 'Takes 0.85x damage while the foe is Rooted.',
  inMul(b, f) { const t = foe(b, f); return t && t.s.root ? 0.85 : 1; } });
defMove({ id: 'taproot_rootshove', name: 'Root Shove', type: 'ROOT', owner: 'taproot', reach: 'single', tags: ['spell'], cd: 1, fx: 'sway | thorn*2 line | burst', text: 'Hits for 116% MGK. Delays the foe\'s next turn by 20%.',
  run(c) { c.hit(c.tgt, { mgk: 1.16 }); c.delay(c.tgt, 20); } });
defMove({ id: 'taproot_twisted', name: 'Root Under', type: 'ROOT', owner: 'taproot', reach: 'single', tags: ['dash', 'spell'], cd: 3, fx: 'sink | thorn*3 rise | crack', text: 'Hits for 100% MGK. Root 2.',
  run(c) { c.hit(c.tgt, { mgk: 1 }); c.st(c.tgt, 'root', 2); } });
defMove({ id: 'taproot_saplingtoss', name: 'Seedling Toss', type: 'TIDE', owner: 'taproot', reach: 'single', tags: ['projectile', 'spell'], cd: 2, fx: 'hop | leaf arc | splash',
  text: 'Hits for 63% MGK. Slow 2. Summons a Sapling (6% max HP).',
  run(c) { c.hit(c.tgt, { mgk: 0.63 }); c.st(c.tgt, 'slow', 2); summon(c.b, c.u, 'taproot_sapling', { hp: 0.06 }); } });
defMove({ id: 'taproot_rootwave', name: 'Root Wave', type: 'ROOT', owner: 'taproot', reach: 'spread', tags: ['spell'], splash: 0.5, cd: 6, nerve: 5, fx: 'stomp big | thorn*8 rise | crack quake all big jolt',
  text: 'Hits for 110% MGK. Splash 50%. Root 2. Each foe reserve gets Root 1.',
  run(c) { c.spread({ mgk: 1.1 }); c.st(c.tgt, 'root', 2); for (const r of reserves(c.them)) c.st(r, 'root', 1); } });

// borer: a bark beetle bored right through that waits in its own holes and hits you on the way out.
defMark({ id: 'borer_shell', name: 'hard back', clock: 'own', volatile: true, value: 0.15,
  beforeTake(b, f, src, amt, d) {
    if (d.dot || !src || src.side === f.side) return amt;
    unmark(f, 'borer_shell');
    msg(b, `${label(b, src)} hits the carapace.`);
    dealDamage(b, f, src, amt * 0.5, { ...dot('M'), reflect: true } as DmgInfo, null);
    if (!src.ko) { applyStatus(b, f, src, 'stun', 1); if (has(f, 'borer_frass')) applyStatus(b, f, src, 'slow', 2); }
    return amt;
  } });
defPassive({ id: 'borer_tunneler', name: 'Out the Hole', owner: 'borer', text: 'When it comes out: its first move deals 1.4x.',
  outMul(b, f, t, d) { return f.k.fresh && d.move ? 1.4 : 1; } });
defPassive({ id: 'borer_frass', name: 'Frass', owner: 'borer', text: 'When it switches out: 50% ATK to the foe. A foe that hits Hard Back also gets Slow 2.',
  leave(b, f) { const t = foe(b, f); if (!t || f.ko) return; msg(b, `${label(b, f)} bites on its way out.`); strike(b, f, t, stat(b, f, 'atk') * 0.5, 'P', 'BEAST'); } });
defMove({ id: 'borer_borehole', name: 'Bore Hole', type: 'BEAST', owner: 'borer', reach: 'single', cd: 1, fx: 'lunge | bite', text: 'Hits for 90% ATK. Every 2nd use: the foe\'s side loses 1 tide.',
  run(c) { c.hit(c.tgt, { atk: 0.9 }); c.u.k.bores = (c.u.k.bores || 0) + 1; if (c.u.k.bores % 2 === 0 && !c.blocked(c.tgt)) c.nerve(c.them, -1); } });
defMove({ id: 'borer_gallery', name: 'Galleries', type: 'ROOT', owner: 'borer', reach: 'spread', cd: 3, fx: 'sink | thorn*4 rise | crack all',
  text: 'Hits for 60% ATK. Splash 35%. Stun 1.',
  run(c) { c.spread({ atk: 0.6 }); c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'borer_carapace', name: 'Hard Back', type: 'BEAST', owner: 'borer', reach: 'self', cd: 4, wt: 60, fx: 'shake | ring self', text: 'The next hit on it before its next turn: 50% returned, Stun 1.',
  run(c) { c.mark(c.u, 'borer_shell', 1, 1); } });
defMove({ id: 'borer_vendetta', name: 'Into the Wood', type: 'BEAST', owner: 'borer', reach: 'self', cd: 6, nerve: 4, wt: 60, fx: 'sink big | puff ring dark self', text: 'Hidden 2. Its next move deals 1.6x damage.',
  run(c) { c.st(c.u, 'hidden', 2); c.u.k.nextMoveMul = 1.6; } });

// clod: the ball of earth from under the Bole's roots, with small lumps of itself that follow it about to be thrown.
defSummon({ id: 'clod_stone', name: 'Lump', owner: 'clod', text: 'Mulchi\'s moves spend it for more.',
  sprite: { px: ['........', '........', '........', '...33...', '..2222..', '.232232.', '.212212.', '..4444..'], c: ['#927c63', '#68d899', '#564434'] } });
defMark({ id: 'clod_magnet', name: 'held fast', clock: 'own', negative: true, value: -0.1,
  turnStart(b, f) { const mk = f.m.clod_magnet; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, f, stat(b, by, 'atk') * 0.3, 'P', 'STONE'); } });
const stones = (b: Battle, f: Fighter) => summonsOf(b, f.side, 'clod_stone');
const spendStone = (b: Battle, f: Fighter): boolean => { const s = stones(b, f)[0]; if (!s) return false; dismiss(b, s); return true; };
defPassive({ id: 'clod_earthstore', name: 'Earth Store', owner: 'clod', text: 'Starts with 2 Lumps (6% max HP). Every 3rd turn: another, up to 3.',
  start(b, f) { summon(b, f, 'clod_stone', { hp: 0.06 }); summon(b, f, 'clod_stone', { hp: 0.06 }); },
  turnStart(b, f) { f.k.stoneT = (f.k.stoneT || 0) + 1; if (f.k.stoneT % 3 === 0 && stones(b, f).length < 3) summon(b, f, 'clod_stone', { hp: 0.06 }); } });
defPassive({ id: 'clod_clayskin', name: 'Clay Skin', owner: 'clod', text: 'Each Lump it has cuts damage taken by 4%.',
  inMul(b, f) { return 1 - 0.04 * stones(b, f).length; } });
defMove({ id: 'clod_rollclod', name: 'Roll Clod', type: 'STONE', owner: 'clod', reach: 'single', cd: 1, fx: 'lunge | pebble*2 arc | crack', text: 'Hits for 100% ATK. Spends a Lump: 1.3x and Slow 2.',
  run(c) { const s = spendStone(c.b, c.u); c.hit(c.tgt, { atk: 1.0 }, { mult: s ? 1.3 : 1 }); if (s) c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'clod_pullclod', name: 'Pull Clod', type: 'ROOT', owner: 'clod', reach: 'single', tags: ['dash'], cd: 2, fx: 'lunge | thorn return | crack',
  text: 'Hits for 85% ATK. Its next turn comes 20% sooner. Spends a Lump: Stun 1.',
  run(c) { const s = spendStone(c.b, c.u); c.hit(c.tgt, { atk: 0.85 }); c.hasten(c.u, 20); if (s) c.st(c.tgt, 'stun', 1); } });
defMove({ id: 'clod_packearth', name: 'Pack Earth', type: 'STONE', owner: 'clod', reach: 'dragin', cd: 3, fx: 'stomp | pebble*3 converge | quake', text: 'Drags in a reserve. Hits it for 80% ATK. Spends a Lump: Silence 1.',
  run(c) { c.dragIn(c.pick); const t = c.them.f[c.them.out]; const s = spendStone(c.b, c.u); c.hit(t, { atk: 0.8 }); if (s) c.st(t, 'silence', 1); } });
defMove({ id: 'clod_earthenhold', name: 'Earthen Hold', type: 'STONE', owner: 'clod', reach: 'single', cd: 6, nerve: 4, fx: 'stomp big | pebble*6 converge | quake crack big jolt',
  text: 'Spends every Lump: hits for 100% ATK, +25% per Lump. Next 3 turns: 30% ATK to it.',
  run(c) {
    let n = 0;
    while (spendStone(c.b, c.u)) n++;
    c.hit(c.tgt, { atk: 1.0 }, { mult: 1 + 0.25 * n });
    if (!c.tgt.ko) c.mark(c.tgt, 'clod_magnet', 1, 3);
  } });

// whip: a sapling off the Rootfall with a face in its leaves that holds anything that hits its friends and grows a big friend of its own.
defMark({ id: 'whip_seed', name: 'seed shield', clock: 'own', value: 0.08,
  afterTake(b, f, src, dealt, d) {
    const mk = f.m.whip_seed;
    const by = mk ? markedBy(b, mk) : null;
    if (by && src && src.side !== f.side && !src.ko && has(by, 'whip_whiplash')) applyStatus(b, by, src, 'root', 1);
    if (f.shield > 0) return;
    unmark(f, 'whip_seed');
    const t = foe(b, f);
    if (by && t) { strike(b, by, t, stat(b, by, 'mgk') * 0.6, 'M', 'ROOT'); applyStatus(b, by, t, 'slow', 2); }
  },
  expire(b, f, mk) { const by = markedBy(b, mk); const t = foe(b, f); if (by && t) { strike(b, by, t, stat(b, by, 'mgk') * 0.6, 'M', 'ROOT'); applyStatus(b, by, t, 'slow', 2); } } });
defSummon({ id: 'whip_friend', name: 'Root Friend', owner: 'whip', text: 'Takes single-target hits for your out whorl. Each turn: hits the foe for 55% of Virtsa\'s MGK. Every 3rd hit: Stun 1.', every: 100, guard: true,
  sprite: { px: ['........', '4......4', '44....44', '.222222.', '21222212', '23333332', '22222222', '.22..22.'], c: ['#5b7a38', '#e3a4ac', '#68a634'] },
  act(b, s, f) {
    const t = b.s[1 - s.side].f[b.s[1 - s.side].out];
    if (!f || f.ko || !t || t.ko) return;
    strike(b, f, t, stat(b, f, 'mgk') * 0.55, 'M', 'ROOT');
    s.v++;
    if (s.v % 3 === 0 && !t.ko) applyStatus(b, f, t, 'stun', 1);
  } });
defPassive({ id: 'whip_greenhand', name: 'Green Hand', owner: 'whip', text: 'Its heals and shields are 1.15x.',
  healMul() { return 1.15; } });
defPassive({ id: 'whip_whiplash', name: 'Whiplash', owner: 'whip', text: 'In reserve: Root 1 on a foe that hits your out whorl, once a turn. Hitting a Seed Shield: Root 1.',
  watchOver(b, f, out, src) {
    if (f.k.lashed === b.turnNo || src.ko || src.gone || src.s.root) return;
    f.k.lashed = b.turnNo;
    msg(b, `${label(b, f)}'s roots grab ${label(b, src)} from the bench.`);
    applyStatus(b, f, src, 'root', 1);
  } });
defMove({ id: 'whip_rootcaller', name: 'Root Pull', type: 'ROOT', owner: 'whip', reach: 'single', tags: ['spell'], cd: 2, fx: 'sway | thorn*2 line | crack', text: 'Hits for 163% MGK. Root 2. Its next turn comes 20% sooner.',
  run(c) { c.hit(c.tgt, { mgk: 1.63 }); c.st(c.tgt, 'root', 2); c.hasten(c.u, 20); } });
defMove({ id: 'whip_seedshield', name: 'Seed Shield', type: 'ROOT', owner: 'whip', reach: 'ally', cd: 3, fx: 'lift | leaf*3 converge | ring ally', text: 'Shields an ally 15% max HP + 25% CHA. When it ends: 60% MGK, Slow 2.',
  run(c) { const g = has(c.u, 'whip_greenhand') ? 1.15 : 1; c.shield(c.ally!, (c.ally!.maxHp * 0.15 + c.cha(0.25)) * g, 3); c.mark(c.ally!, 'whip_seed', 1, 3); } });
defMove({ id: 'whip_leafing', name: 'Leafing', type: 'TIDE', owner: 'whip', reach: 'ally', cd: 3, fx: 'sway | drop*3 rain | bloom ally',
  text: 'Ally: Regen 2 (7% a turn), and its next attack deals 1.4x. Hits the foe for 59% MGK.',
  run(c) { c.st(c.ally!, 'regen', 2, 0.07); c.ally!.k.nextAtkMul = 1.4; const t = foe(c.b, c.u); if (t) c.hit(t, { mgk: 0.59 }); } });
defMove({ id: 'whip_sproutguard', name: 'Sprout Guard', type: 'ROOT', owner: 'whip', reach: 'side', cd: 6, nerve: 5, fx: 'swell | leaf*6 rise | bloom ring tint ally big', text: 'Summons a Root Friend (30% of its max HP, 3 turns).',
  run(c) { summon(c.b, c.u, 'whip_friend', { hp: 0.3, turns: 3 }); } });

// gnarl: a face out of the Bole's roots with one eye too big that puts what it looks at to sleep and passes the dream on.
defMark({ id: 'gnarl_dream', name: 'bad dream', clock: 'own', negative: true, value: -0.1,
  afterTake(b, f, src, dealt, d) {
    const own = f.m.gnarl_dream;
    if (d.dot || !src || src === f || (own && markedBy(b, own) === src)) return;
    unmark(f, 'gnarl_dream');
    msg(b, `The bad dream passes to ${label(b, src)}.`);
    applyStatus(b, f, src, 'sleep', 1);
  },
  expire(b, f, mk) { const by = markedBy(b, mk); if (by && has(by, 'gnarl_gnarled')) { applyStatus(b, by, f, 'weaken', 2); applyStatus(b, by, f, 'expose', 2); } } });
defMark({ id: 'gnarl_grip', name: 'dream grip', clock: 'own', volatile: true, value: 0.1,
  turnStart(b, f) { unmark(f, 'gnarl_grip'); const t = foe(b, f); if (!t) return; const d = strike(b, f, t, stat(b, f, 'mgk') * 0.35, 'M', 'STAR'); heal(b, f, f, d); } });
defPassive({ id: 'gnarl_baddream', name: 'Bad Dream', owner: 'gnarl', text: 'Its hits add Weaken 1.',
  lulls(b, f) { return !!f.k.lulling; },
  afterDeal(b, f, t, dealt, d) { if (!d.dot && !d.reserve && !t.ko && t.side !== f.side) applyStatus(b, f, t, 'weaken', 1); } });
defPassive({ id: 'gnarl_gnarled', name: 'Gnarled', owner: 'gnarl', text: 'A foe that sleeps through a whole Bad Sleep wakes with Weaken 2, Expose 2.' });
defMove({ id: 'gnarl_enfeeble', name: 'Sap Dream', type: 'STAR', owner: 'gnarl', reach: 'single', tags: ['spell'], cd: 1, fx: 'flare | star line | sparkle', text: 'Hits for 105% MGK. Heals 30% of the damage.',
  run(c) { const d = c.hit(c.tgt, { mgk: 1.05 }); c.heal(c.u, d * 0.3); } });
defMove({ id: 'gnarl_nightmare', name: 'Bad Sleep', type: 'STAR', owner: 'gnarl', reach: 'single', cd: 4, fx: 'sway | moon arc | daze dark', text: 'Sleep 2. Whoever hits the sleeper gets Sleep 1 instead.',
  run(c) { if (c.st(c.tgt, 'sleep', 2)) c.mark(c.tgt, 'gnarl_dream', 1, 2); } });
defMove({ id: 'gnarl_mindsap', name: 'Heavy Eye', type: 'ROOT', owner: 'gnarl', reach: 'single', tags: ['spell'], cd: 3, fx: 'flare | rune converge | daze',
  text: 'Hits for 85% MGK, 1.5x on a sleeping foe without waking it. Weaken 2. Empower 1.',
  run(c) {
    const asleep = !!c.tgt.s.sleep;
    c.u.k.lulling = 1;
    c.hit(c.tgt, { mgk: 0.85 }, { mult: asleep ? 1.5 : 1 });
    c.u.k.lulling = 0;
    c.st(c.tgt, 'weaken', 2); c.st(c.u, 'empower', 1);
  } });
defMove({ id: 'gnarl_grip', name: 'Dream Grip', type: 'STAR', owner: 'gnarl', reach: 'single', tags: ['spell', 'channel'], cd: 6, nerve: 5, fx: 'swell big | moon*3 orbit | vortex big dark', text: 'Stun 2. Drains 60% MGK now and 35% MGK at its next turn.',
  run(c) { const d = c.hit(c.tgt, { mgk: 0.6 }); c.heal(c.u, d); c.st(c.tgt, 'stun', 2); c.mark(c.u, 'gnarl_grip', 1, 2); } });

// upfall: rain that fell upward near the Bole and kept at it, making friends tall and enemies short.
defMark({ id: 'upfall_small', name: 'shrunk', clock: 'own', volatile: true, negative: true, value: -0.2,
  forbid(b, f, what) { return what === 'attack' || what === 'switch' ? null : 'Too small.'; },
  inMul() { return 1.15; } });
defMark({ id: 'upfall_help', name: 'helped up', clock: 'own', value: 0.08,
  afterAttack(b, f, t) { const mk = f.m.upfall_help; const by = mk ? markedBy(b, mk) : null; if (by) strike(b, by, t, stat(b, by, 'mgk') * 0.28, 'M', 'TIDE'); } });
defMark({ id: 'upfall_big', name: 'grown tall', clock: 'own', value: 0.15,
  inMul(b, f) { const mk = f.m.upfall_big; const by = mk ? markedBy(b, mk) : null; return by && has(by, 'upfall_topsy') ? 0.9 : 1; },
  expire(b, f) { const add = f.k.grown || 0; f.k.grown = 0; f.maxHp = Math.max(1, f.maxHp - add); f.hp = Math.min(f.hp, f.maxHp); } });
defPassive({ id: 'upfall_raindrop', name: 'Upward Drop', owner: 'upfall', text: 'Its attacks also hit for 28% MGK.',
  afterAttack(b, f, t) { strike(b, f, t, stat(b, f, 'mgk') * 0.28, 'M', 'TIDE'); } });
defPassive({ id: 'upfall_topsy', name: 'Topsy', owner: 'upfall', text: 'An ally it grows takes 0.9x damage while big.' });
defMove({ id: 'upfall_risingdrops', name: 'Rising Drops', type: 'TIDE', owner: 'upfall', reach: 'single', tags: ['projectile', 'spell'], cd: 1, fx: 'sway | drop*4 rise | splash', text: 'Hits for 243% MGK. Slow 2.',
  run(c) { c.hit(c.tgt, { mgk: 2.43 }); c.st(c.tgt, 'slow', 2); } });
defMove({ id: 'upfall_shrink', name: 'Shrink', type: 'SALT', owner: 'upfall', reach: 'single', cd: 3, fx: 'sink | salt*3 rise | frost',
  text: 'Hits for 54% MGK. 1 turn: the foe can only attack or switch, and takes 1.15x.',
  run(c) { c.hit(c.tgt, { mgk: 0.54 }); if (!c.tgt.ko) c.mark(c.tgt, 'upfall_small', 1, 1); } });
defMove({ id: 'upfall_helpup', name: 'Help Up', type: 'TIDE', owner: 'upfall', reach: 'ally', tags: ['projectile'], cd: 3, fx: 'hop | drop*2 rise | ring ally', text: 'Shields an ally 21% max HP. 3 turns: its attacks add 28% MGK.',
  run(c) { c.shield(c.ally!, c.ally!.maxHp * 0.21, 3); c.mark(c.ally!, 'upfall_help', 1, 3); } });
defMove({ id: 'upfall_swell', name: 'Grow Tall', type: 'TIDE', owner: 'upfall', reach: 'ally', cd: 6, nerve: 5, fx: 'swell big | drop*6 rise | bloom ally big tint', text: 'Ally: +25% max HP for 3 turns and heals that much. Foe: Stun 1.',
  run(c) {
    const a = c.ally!;
    if (!marked(a, 'upfall_big')) { const add = Math.round(a.maxHp * 0.25); a.k.grown = add; a.maxHp += add; c.heal(a, add); }
    c.mark(a, 'upfall_big', 1, 3);
    c.st(c.tgt, 'stun', 1);
  } });

export const KITS3_LOADED = true;
void cleanse; void sk; void giveShield; void lowestAlly;
