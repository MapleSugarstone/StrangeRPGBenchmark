// Field states any kit can lay over a battle with setField. One holds at a time, counted in rounds.
// A field's hooks run for every whorl on both sides, so they only use hooks that act on their own holder.
import { applyStatus, dealDamage, heal, isOut, out, typesOf } from '../battle/engine';
import type { Battle, Fighter } from '../battle/model';
import { defField, type DmgInfo } from '../battle/registry';
import { TYPE_COLOR, type Type } from './types';

const tagged = (d: DmgInfo, tag: 'dash' | 'projectile' | 'spell') => !!d.move?.tags?.includes(tag);
const outIs = (b: Battle, side: 0 | 1, type: Type) => { const f = out(b, side); return !!f && !f.ko && typesOf(f).includes(type); };
const lean = (b: Battle, side: 0 | 1, type: Type, w: number) => (outIs(b, side, type) ? w : 0) - (outIs(b, (1 - side) as 0 | 1, type) ? w : 0);

defField({
  id: 'fog', name: 'Sea Fog', color: '#9aa8b8',
  text: 'Projectiles deal 0.7x damage.',
  outMul(b, f, t, d) { void b; void f; void t; return tagged(d, 'projectile') ? 0.7 : 1; },
});

defField({
  id: 'gale', name: 'Gale', color: '#c8e0e8',
  text: 'Dashes deal 1.25x damage.',
  outMul(b, f, t, d) { void b; void f; void t; return tagged(d, 'dash') ? 1.25 : 1; },
});

defField({
  id: 'hightide', name: 'High Tide', color: TYPE_COLOR.TIDE,
  text: 'TIDE moves deal 1.3x. STONE Whorls\' turns come 15% later.',
  outMul(b, f, t, d) { void b; void t; return d.move && d.move.type === 'TIDE' ? 1.3 : 1; },
  speedMul(b, f) { void b; return typesOf(f).includes('STONE') ? 1.15 : 1; },
  value(b, side) { return lean(b, side, 'TIDE', 0.08) - lean(b, side, 'STONE', 0.05); },
});

defField({
  id: 'starfall', name: 'Starfall', color: TYPE_COLOR.STAR,
  text: 'Turn start: a Whorl takes 4% of its max HP. A STAR Whorl heals it instead.',
  turnStart(b, f) {
    if (!isOut(b, f)) return;
    if (typesOf(f).includes('STAR')) { heal(b, null, f, f.maxHp * 0.04); return; }
    dealDamage(b, null, f, f.maxHp * 0.04, { kind: 'T', move: null, attack: false, dot: true, spread: false, reserve: false }, null);
  },
  value(b, side) { return lean(b, side, 'STAR', 0.1); },
});

defField({
  id: 'saltcrust', name: 'Salt Crust', color: TYPE_COLOR.SALT,
  text: 'Healing is 0.5x. SALT moves deal 1.2x.',
  healMul(b, f) { void b; void f; return 0.5; },
  outMul(b, f, t, d) { void b; void f; void t; return d.move && d.move.type === 'SALT' ? 1.2 : 1; },
  value(b, side) { return lean(b, side, 'SALT', 0.06); },
});

defField({
  id: 'eclipse', name: 'Eclipse', color: TYPE_COLOR.VOID,
  text: 'Magic hits deal 1.2x. Physical hits deal 0.85x.',
  outMul(b, f, t, d) { void b; void f; void t; return d.kind === 'M' ? 1.2 : d.kind === 'P' ? 0.85 : 1; },
});

defField({
  id: 'stillwater', name: 'Still Water', color: '#6a8ab0',
  text: 'Speed turns over: the slower Whorl\'s turns come sooner.',
  // A plain turn of 200 / (AGI + 100) becomes (AGI + 100) / 200, so turn gaps grow with AGI instead of shrinking.
  speedMul(b, f) { void b; const a = f.st.agi + 100; return (a * a) / 40000; },
});

defField({
  id: 'driftsand', name: 'Drift Sand', color: '#c8a870',
  text: 'Dashes deal 0.75x. Turn start: a rooted Whorl takes Slow 1.',
  outMul(b, f, t, d) { void b; void f; void t; return tagged(d, 'dash') ? 0.75 : 1; },
  turnStart(b: Battle, f: Fighter) { if (isOut(b, f) && f.s.root) applyStatus(b, null, f, 'slow', 1); },
});

defField({
  id: 'mirror', name: 'Silver Glass', color: '#c8ccdc',
  text: 'The type chart turns over: strong hits are weak, and weak hits are strong.',
  typeIn(b, f, type, m) { void b; void f; void type; return m > 0 ? 1 / m : m; },
});
