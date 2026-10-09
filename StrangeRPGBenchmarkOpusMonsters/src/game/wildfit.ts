import type { Mon } from '../battle/model';
import { TAN_PER_STAT, TAN_TOTAL } from '../battle/engine';
import { MOVES } from '../battle/registry';
import { makeMon, WILD_KINDS } from '../data/species';
import { makeFit, nameOptions, NO_FIT_HABITS, paletteOf, shapeOf, typeOptions } from './fitting';
import type { Zone } from './world';

/** A fitted slough from two kinds with chosen moves and passives (for keeper teams). */
export function fitted(a: string, b: string, level: number, moves: string[], passives: string[], name?: string, shape = 2, pal = 2): Mon {
  const A = makeMon(a, level), B = makeMon(b, level);
  const fromA = moves.filter(id => A.moves.includes(id)).length, fromB = moves.filter(id => B.moves.includes(id)).length;
  if (moves.length !== 4 || fromA !== 2 || fromB !== 2) throw new Error(`fitting ${a}+${b} must keep two moves from each parent`);
  const types = [...new Set([...A.types, ...B.types])].slice(0, 2);
  const sprite = { px: shapeOf(A.sprite, B.sprite, shape), c: paletteOf(A.sprite, B.sprite, pal) };
  return makeFit(A, B, { moves, passives, types: types as any, basic: A.basic, retune: null, sprite, name: name || nameOptions(A.name, B.name)[0] }, 0);
}

/** A random fitting with two moves from each parent and exactly one crest when either parent has one. */
export function randomFit(rnd: () => number, a: string, b: string, level: number): Mon {
  const A = makeMon(a, level), B = makeMon(b, level);
  const pick = <T>(arr: T[]) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
  const two = (from: string[], bigOk: boolean, force: boolean): string[] => {
    const big = from.filter(id => MOVES[id]?.nerve), small = from.filter(id => !MOVES[id]?.nerve);
    const out: string[] = [];
    if (bigOk && big.length && (force || rnd() < 0.5)) out.push(pick(big));
    while (out.length < 2 && small.length) out.push(pick(small));
    while (out.length < 2 && big.length) out.push(pick(big));
    return out;
  };
  const fromA = two(A.moves.slice(), true, false);
  const hasBig = fromA.some(id => MOVES[id]?.nerve);
  const moves = [...fromA, ...two(B.moves.filter(id => !fromA.includes(id)), !hasBig, !hasBig)];
  const ps = [...new Set([...A.passives, ...B.passives])].filter(id => !NO_FIT_HABITS.has(id));
  const passives = [pick(ps), pick(ps)].filter(Boolean);
  const tos = typeOptions(A, B);
  const types = tos[Math.floor(rnd() * tos.length)];
  const names = nameOptions(A.name, B.name);
  const sprite = { px: shapeOf(A.sprite, B.sprite, Math.floor(rnd() * 4)), c: paletteOf(A.sprite, B.sprite, Math.floor(rnd() * 3)) };
  return makeFit(A, B, { moves, passives, types, basic: rnd() < 0.5 ? A.basic : B.basic, retune: null, sprite, name: names[Math.floor(rnd() * names.length)] || A.name }, 0);
}

/** Notions a player would pick for a whorl whose damage comes from this stat. */
export const PLANNED_NOTIONS: Record<'P' | 'M', string[]> = {
  P: ['whetstone', 'edgecharm', 'bodkin', 'heartstone', 'waxseal', 'bloodglass', 'longshin', 'spareskin'],
  M: ['bitterroot', 'crownofhorn', 'bodkin', 'heartstone', 'waxseal', 'bloodglass', 'longshin', 'spareskin'],
};

/** Gives a whorl the kit a player plans: a notion that suits its attack, and its tan in its attack stat and HP. */
export function plannedKit(rnd: () => number, m: Mon): Mon {
  const ns = PLANNED_NOTIONS[m.basic];
  m.notion = ns[Math.floor(rnd() * ns.length)];
  m.tan = { [m.basic === 'P' ? 'atk' : 'mgk']: TAN_PER_STAT, hp: TAN_TOTAL - TAN_PER_STAT };
  return m;
}

export function wildFit(rnd: () => number, z: Zone, level: number): Mon {
  const kinds = z.kinds.map(k => k[0]);
  const a = kinds[Math.floor(rnd() * kinds.length)];
  let b = WILD_KINDS[Math.floor(rnd() * WILD_KINDS.length)];
  if (b === a) b = kinds[(kinds.indexOf(a) + 1) % kinds.length];
  return randomFit(rnd, a, b, level);
}
