// The Volute's legendaries, reworked as hero kits: Full, Mundane, Knot, and Holm. Each keeps its old move and habit ids,
// so saved whorls load, but each now has a signature that its four moves and two habits work around.
import { heal, label, mark, marked, msg, reserves, unmark } from '../battle/engine';
import type { Battle, Fighter } from '../battle/model';
import { defMark, defMove, defPassive, type Ctx } from '../battle/registry';

const codeOf = (t: Fighter): number => t.side * 8 + t.idx + 1;
function fighterAt(b: Battle, code: number): Fighter | null {
  if (!code) return null;
  const t = b.s[Math.floor((code - 1) / 8)]?.f[(code - 1) % 8];
  return t && !t.ko && !t.gone ? t : null;
}
/** Sets a counter mark on its own holder to exactly n stacks, or removes it at 0. */
function setStacks(b: Battle, f: Fighter, id: string, n: number, max: number): void {
  if (n > 0) f.m[id] = { n: Math.min(max, n), v: 0, t: -1, by: f.side * 8 + f.idx, at: b.turnNo };
  else delete f.m[id];
}

// ---------------------------------------------------------------- Full
// The moon's first cast keeps a Moon on one foe or on itself, and its tides happen where the Moon is. The kit draws on
// a fighter whose spells start from a ball sent to friend or foe, and one who sends foes back along their path and fences them in.

const MOON = 'full_moon', HOME = 'full_home';
export const N_FULL = { lift: 140, neap: 85, neapDelay: 30, tide: 90, shield: 40, syzygy: 190, home: 0.8 };

/** The foe holding Full's Moon, or null when the Moon is home. */
export function moonFoe(b: Battle, f: Fighter): Fighter | null {
  const t = fighterAt(b, f.k.moon || 0);
  return t && marked(t, MOON) ? t : null;
}
function moonTo(b: Battle, f: Fighter, t: Fighter | null): void {
  const old = moonFoe(b, f);
  if (old && old !== t) unmark(old, MOON);
  f.k.moon = 0;
  if (t && t.side !== f.side && !t.ko && mark(b, f, t, MOON, 1, -1)) { f.k.moon = codeOf(t); unmark(f, HOME); return; }
  if (!marked(f, HOME)) mark(b, f, f, HOME, 1, -1);
}
defMark({ id: MOON, name: 'moon', negative: true, clock: 'own', value: -0.1, color: '#fcf8ec',
  forbid(b, f, what) { return what === 'switch' ? 'The Moon holds it.' : null; } });
defMark({ id: HOME, name: 'moon', clock: 'own', value: 0.05, color: '#fcf8ec' });

defPassive({ id: 'pull', name: 'Moon', owner: 'full',
  text: 'Moon: a mark it keeps on one foe, or at home on itself, where it starts. Its single-target moves can target a foe in reserve.',
  comeOut(b, f) { if (!moonFoe(b, f)) moonTo(b, f, null); },
  turnStart(b, f) { if (!moonFoe(b, f) && !marked(f, HOME)) moonTo(b, f, null); } });
defPassive({ id: 'massive', name: 'Tidal Lock', owner: 'full',
  text: `A foe with the Moon cannot switch out. With the Moon home: takes ${N_FULL.home}x damage and cannot be moved or delayed.`,
  immovable(f) { return !!marked(f, HOME); }, noDelay(f) { return !!marked(f, HOME); },
  inMul(b, f) { return moonFoe(b, f) ? 1 : N_FULL.home; } });
defMove({ id: 'tidelift', name: 'Tide Lift', type: 'STAR', owner: 'full', reach: 'single', tags: ['spell'], cd: 1,
  text: `Hits for ${N_FULL.lift}% MGK. The Moon moves to that foe.`,
  run(c) { c.hit(c.tgt, { mgk: N_FULL.lift / 100 }); if (!c.preview && !c.tgt.ko) moonTo(c.b, c.u, c.tgt); } });
defMove({ id: 'neap', name: 'Neap', type: 'TIDE', owner: 'full', reach: 'self', cd: 2,
  text: `Moon on a foe: hits it for ${N_FULL.neap}% MGK, delays it ${N_FULL.neapDelay}%. Else: Haste 2.`,
  run(c) {
    const t = moonFoe(c.b, c.u);
    if (!t) { c.st(c.u, 'haste', 2); return; }
    c.hit(t, { mgk: N_FULL.neap / 100 });
    if (!t.ko && t.idx === c.them.out) c.delay(t, N_FULL.neapDelay);
  } });
defMove({ id: 'springtide', name: 'Spring Tide', type: 'TIDE', owner: 'full', reach: 'self', cd: 3,
  text: `Calls the Moon home: shield of ${N_FULL.shield}% CHA for 3 turns. Its foe: ${N_FULL.tide}% MGK.`,
  run(c) {
    const t = moonFoe(c.b, c.u);
    if (t) c.hit(t, { mgk: N_FULL.tide / 100 });
    if (!c.preview) moonTo(c.b, c.u, null);
    c.shield(c.u, c.cha(N_FULL.shield / 100), 3);
  } });
defMove({ id: 'syzygy', name: 'Syzygy', type: 'STAR', owner: 'full', reach: 'self', tags: ['spell'], cd: 6, nerve: 6,
  text: `Hits the Moon's foe, else the foe, for ${N_FULL.syzygy}% MGK. Drags it in. Stun 1.`,
  run(c) {
    let t = moonFoe(c.b, c.u) || c.them.f[c.them.out];
    if (!t || t.ko || t.gone || c.blocked(t)) return;
    if (t.idx !== c.them.out && c.dragIn(t.idx)) t = c.them.f[c.them.out];
    c.hit(t, { mgk: N_FULL.syzygy / 100 });
    if (!t.ko) { c.st(t, 'stun', 1); if (!c.preview) moonTo(c.b, c.u, t); }
  } });

// ---------------------------------------------------------------- Knot
// The Holdfast's cast ties one foe to itself, the tie tightens every turn, and it spends the tension. The kit draws on
// a rider who binds to one foe and crashes down on it, and a warrior who walls everyone into an arena.

const BOUND = 'knot_bound', TENSION = 'knot_tension';
export const N_KNOT = { crank: 120, per: 28, tie: 85, shield: 10, operculum: 130, holdfast: 0.8 };

export function boundFoe(b: Battle, f: Fighter): Fighter | null {
  const t = fighterAt(b, f.k.bound || 0);
  return t && marked(t, BOUND) ? t : null;
}
function bind(c: Ctx, t: Fighter): void {
  const old = boundFoe(c.b, c.u);
  if (old && old !== t) unmark(old, BOUND);
  if (!t.ko && c.mark(t, BOUND, 1, -1)) c.u.k.bound = codeOf(t);
}
defMark({ id: BOUND, name: 'bound', negative: true, volatile: true, clock: 'own', value: -0.1, color: '#c8c0b8',
  forbid(b, f, what) { return what === 'switch' ? 'Bound.' : null; } });
defMark({ id: TENSION, name: 'tension', max: 3, clock: 'own', value: 0.04, spend: 'stand', color: '#e8903a' });

defPassive({ id: 'habit', name: 'Tension', owner: 'knot',
  text: 'Turn start, with a foe Bound: +1 Tension, up to 3. Bound: a mark. A Bound foe cannot switch out. It comes off when either leaves.',
  turnStart(b, f) { if (boundFoe(b, f)) setStacks(b, f, TENSION, marked(f, TENSION) + 1, 3); },
  leave(b, f) { const t = boundFoe(b, f); if (t) unmark(t, BOUND); f.k.bound = 0; } });
defPassive({ id: 'holdfast', name: 'Holdfast', owner: 'knot',
  text: `Cannot be forced out, dragged in, or delayed. Takes ${N_KNOT.holdfast}x damage from a Bound foe.`,
  immovable() { return true; }, noDelay() { return true; },
  inMul(b, f, src) { return src && src === boundFoe(b, f) ? N_KNOT.holdfast : 1; } });
defMove({ id: 'turnkey', name: 'Crank', type: 'GEAR', owner: 'knot', reach: 'single', cd: 1,
  text: `Hits for ${N_KNOT.crank}% ATK + ${N_KNOT.per}% ATK per Tension.`,
  run(c) { c.hit(c.tgt, { atk: (N_KNOT.crank + N_KNOT.per * marked(c.u, TENSION)) / 100 }); } });
defMove({ id: 'tension', name: 'Tie', type: 'GEAR', owner: 'knot', reach: 'single', cd: 3,
  text: `Hits for ${N_KNOT.tie}% ATK. Binds the foe. Slow 1.`,
  run(c) {
    if (c.blocked(c.tgt)) return;
    c.hit(c.tgt, { atk: N_KNOT.tie / 100 });
    if (!c.tgt.ko) { bind(c, c.tgt); c.st(c.tgt, 'slow', 1); }
  } });
defMove({ id: 'stand', name: 'Tighten', type: 'STONE', owner: 'knot', reach: 'single', cd: 3,
  text: `Spends Tension: shield of ${N_KNOT.shield}% max HP each for 3 turns. 2+: Stun 1.`,
  run(c) {
    const n = marked(c.u, TENSION);
    if (!n) { c.msg('Nothing to tighten.'); return; }
    c.shield(c.u, c.u.maxHp * N_KNOT.shield / 100 * n, 3);
    if (n >= 2 && !c.tgt.ko) c.st(c.tgt, 'stun', 1);
    if (!c.preview) setStacks(c.b, c.u, TENSION, 0, 3);
  } });
defMove({ id: 'thekey', name: 'The Operculum', type: 'GEAR', owner: 'knot', reach: 'spread', cd: 6, nerve: 5,
  text: `Hits every foe for ${N_KNOT.operculum}% ATK. Binds the foe. Its Tension goes to 3.`,
  run(c) {
    c.spread({ atk: N_KNOT.operculum / 100 });
    if (!c.tgt.ko) bind(c, c.tgt);
    if (!c.preview) setStacks(c.b, c.u, TENSION, 3, 3);
  } });

// ---------------------------------------------------------------- Mundane
// The old Volute's heart grows Layers the way a shell grows, and peels them all off at once to fight bare. The kit
// draws on a tank who sheds his armor to go all out, and a warrior whose war cry hardens him.

const LAYER = 'mundane_layer', BARE = 'mundane_bare';
export const N_MUND = { start: 4, per: 0.94, plate: 120, platePer: 2, heal: 10, peel: 70, peelPer: 30, bareOut: 1.3, bareIn: 1.15 };

defMark({ id: LAYER, name: 'layer', max: 6, clock: 'own', value: 0.04, spend: 'peel', color: '#d0a870' });
defMark({ id: BARE, name: 'bare', clock: 'own', value: 0.1, color: '#f4e0c8',
  outMul() { return N_MUND.bareOut; }, inMul() { return N_MUND.bareIn; } });
const layers = (f: Fighter) => marked(f, LAYER);

defPassive({ id: 'overdue', name: 'Layers', owner: 'mundane',
  text: `Layer: a mark, up to 6. It starts with ${N_MUND.start}. Takes ${N_MUND.per}x damage for each Layer. Every 3rd turn start: +1 Layer.`,
  start(b, f) { setStacks(b, f, LAYER, N_MUND.start, 6); },
  inMul(b, f) { return Math.pow(N_MUND.per, layers(f)); },
  turnStart(b, f) { f.k.od = (f.k.od || 0) + 1; if (f.k.od % 3 === 0) { setStacks(b, f, LAYER, layers(f) + 1, 6); msg(b, `${label(b, f)} grows a layer.`); } } });
defPassive({ id: 'oldground', name: 'Old Ground', owner: 'mundane',
  text: `Cannot be forced out or dragged in. A crest that hits it takes off a Layer. Bare: deals ${N_MUND.bareOut}x damage, takes ${N_MUND.bareIn}x.`,
  immovable() { return true; },
  afterTake(b, f, src, dealt, d) { if (d.move?.nerve && src && src.side !== f.side && layers(f)) setStacks(b, f, LAYER, layers(f) - 1, 6); } });
defMove({ id: 'plate', name: 'Plate', type: 'STONE', owner: 'mundane', reach: 'single', cd: 1,
  text: `Hits for ${N_MUND.plate}% ATK + ${N_MUND.platePer}% of its max HP per Layer.`,
  run(c) { c.hit(c.tgt, { atk: N_MUND.plate / 100, selfHp: N_MUND.platePer / 100 * layers(c.u) }); } });
defMove({ id: 'fold', name: 'Fold', type: 'BEAST', owner: 'mundane', reach: 'single', cd: 3,
  text: 'Forces the foe out. Its replacement: Expose 2. +1 Layer.',
  run(c) {
    if (c.forceOut()) c.st(c.them.f[c.them.out], 'expose', 2);
    if (!c.preview) setStacks(c.b, c.u, LAYER, layers(c.u) + 1, 6);
  } });
defMove({ id: 'settle', name: 'Settle', type: 'STONE', owner: 'mundane', reach: 'self', cd: 3,
  text: `+2 Layers. Heals ${N_MUND.heal}% of its max HP.`,
  run(c) { if (!c.preview) setStacks(c.b, c.u, LAYER, layers(c.u) + 2, 6); c.heal(c.u, c.u.maxHp * N_MUND.heal / 100); } });
defMove({ id: 'peel', name: 'Peel', type: 'BEAST', owner: 'mundane', reach: 'spread', cd: 6, nerve: 6,
  text: `Sheds its Layers: hits every foe for ${N_MUND.peel}% ATK + ${N_MUND.peelPer}% ATK each. Bare 2.`,
  run(c) {
    const n = layers(c.u);
    c.spread({ atk: (N_MUND.peel + N_MUND.peelPer * n) / 100 });
    if (!c.preview) { setStacks(c.b, c.u, LAYER, 0, 6); c.mark(c.u, BARE, 1, 2); }
  } });

// ---------------------------------------------------------------- Holm
// The island that walked off with a house on its back carries one whorl from its reserve and sets it ashore. The kit
// draws on a druid whose bear carries what he gives it, and a healer whose warm hug shields and speeds an ally.

const RIDER = 'holm_rider';
export const N_HOLM = { island: 5, islandMax: 15, heal: 2, spread: 0.5, shoulder: 90, carry: 20, wake: 80, wakeHeal: 8, land: 25, landRider: 35 };

defMark({ id: RIDER, name: 'riding', clock: 'own', value: 0.1, color: '#c8906a',
  inMul(b, f, src, d) { return d.reserve ? N_HOLM.spread : 1; },
  reserveTurn(b, f) { heal(b, f, f, f.maxHp * N_HOLM.heal / 100); },
  comeOut(b, f) { unmark(f, RIDER); } });
export const riderOf = (b: Battle, f: Fighter): Fighter | null => reserves(b.s[f.side]).find(r => marked(r, RIDER)) || null;
function board(b: Battle, f: Fighter, r: Fighter): void {
  for (const o of b.s[f.side].f) unmark(o, RIDER);
  mark(b, f, r, RIDER, 1, -1);
  msg(b, `${r.mon.name} climbs aboard ${label(b, f)}.`);
}

defPassive({ id: 'holm_island', name: 'Island', owner: 'holm',
  text: `Each time it comes back out: takes ${N_HOLM.island}% less damage, up to ${N_HOLM.islandMax}%. From its third time out, cannot be moved.`,
  comeOut(b, f) { f.k.outs = (f.k.outs || 0) + 1; },
  inMul(b, f) { return 1 - Math.min(N_HOLM.islandMax, N_HOLM.island * Math.max(0, (f.k.outs || 1) - 1)) / 100; },
  immovable(f) { return (f.k.outs || 0) >= 3; } });
defPassive({ id: 'holm_house', name: 'House on Its Back', owner: 'holm',
  text: `Rider: a mark on one whorl in its reserve. When it comes out with no Rider, the first boards. The Rider heals ${N_HOLM.heal}% of its max HP each turn and takes ${N_HOLM.spread}x damage from spread hits.`,
  comeOut(b, f) { if (!riderOf(b, f)) { const r = reserves(b.s[f.side])[0]; if (r) board(b, f, r); } } });
defMove({ id: 'holm_shoulder', name: 'Shoulder', type: 'STONE', owner: 'holm', reach: 'single', cd: 1,
  text: `Hits for ${N_HOLM.shoulder}% ATK + 4% of its max HP.`,
  run(c) { c.hit(c.tgt, { atk: N_HOLM.shoulder / 100, selfHp: 0.04 }); } });
defMove({ id: 'holm_carry', name: 'Carry Them', type: 'TIDE', owner: 'holm', reach: 'reserveAlly', cd: 3,
  text: `An ally in reserve boards as its Rider. Shield of ${N_HOLM.carry}% CHA for 3 turns.`,
  run(c) { const a = c.ally; if (!a || a.ko) return; if (!c.preview) board(c.b, c.u, a); c.shield(a, c.cha(N_HOLM.carry / 100), 3); } });
defMove({ id: 'holm_wake', name: 'Long Wake', type: 'TIDE', owner: 'holm', reach: 'single', cd: 2,
  text: `Hits for ${N_HOLM.wake}% ATK. Slow 2. Its Rider heals ${N_HOLM.wakeHeal}% of its max HP.`,
  run(c) {
    c.hit(c.tgt, { atk: N_HOLM.wake / 100 });
    if (!c.tgt.ko) c.st(c.tgt, 'slow', 2);
    const r = riderOf(c.b, c.u);
    if (r) c.heal(r, r.maxHp * N_HOLM.wakeHeal / 100);
  } });
defMove({ id: 'holm_lap', name: 'Make Landfall', type: 'TIDE', owner: 'holm', reach: 'reserveAlly', tag: true, cd: 6, nerve: 5,
  text: `Swaps in a reserve ally: Haste 1, shield of ${N_HOLM.land}% CHA, ${N_HOLM.landRider}% if its Rider.`,
  run(c) {
    const a = c.ally;
    if (!a || a.ko) return;
    c.shield(a, c.cha((marked(a, RIDER) ? N_HOLM.landRider : N_HOLM.land) / 100), 3);
    c.st(a, 'haste', 1);
  } });

export const LEGENDS_LOADED = true;
