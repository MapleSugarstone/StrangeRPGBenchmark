// Whorls that hold Still Minute, for the tools that test its rewind: Tynagi itself, or a fit of Tynagi and another kind that
// keeps Still Minute in any slot beside one more Tynagi move and two of the other kind's (Notes/still-minute.md).
import type { Mon } from '../battle/model';
import { MOVES } from '../battle/registry';
import { makeMon } from '../data/species';
import { makeFit, nameOptions, NO_FIT_HABITS, paletteOf, shapeOf, typeOptions } from '../game/fitting';

/** A move that tests the visitor's choice: a swap, a crest, a pick of target or option, a summon, or several hits. */
const testing = (id: string): boolean => {
  const m = MOVES[id];
  return !!m && (!!m.tag || !!m.options || !!m.nerve || ['ally', 'reserveAlly', 'dragin', 'bench'].includes(m.reach) || /[Ss]ummons|twin|times|twice/.test(m.text));
};

/** Kinds whose own four hold a move with `has`, so fits can keep one: a swap, so the visitor can trade places, or an option to pick. */
const holding = (kinds: string[], has: (id: string) => boolean): string[] => kinds.filter(k => makeMon(k, 25).moves.some(has));
const swap = (id: string): boolean => !!MOVES[id]?.tag, option = (id: string): boolean => !!MOVES[id]?.options;

/** Tynagi, or a fit of Tynagi and one of `kinds` that keeps Still Minute. Most fits keep at least one move of the other kind that tests the visitor's choice. */
export function minuteHolder(rnd: () => number, kinds: string[]): Mon {
  if (rnd() < 0.3) return makeMon('slackwater', 25);
  const pick = <T>(arr: T[]): T => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
  const r = rnd(), want = r < 0.3 ? swap : r < 0.55 ? option : null;
  const special = want ? holding(kinds, want) : [];
  const from = special.length ? special : kinds, k2 = from[Math.floor(rnd() * from.length)];
  const A = makeMon('slackwater', 25), B = makeMon(k2, 25);
  const theirs = B.moves.slice(), odd = theirs.filter(id => (special.length && want ? want(id) : testing(id)));
  const first = odd.length && rnd() < 0.8 ? odd[Math.floor(rnd() * odd.length)] : pick(theirs.slice());
  const second = pick(theirs.filter(id => id !== first));
  const moves = ['slackwater_minute', pick(A.moves.filter(id => id !== 'slackwater_minute')), first, second];
  for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
  const ps = [...new Set([...A.passives, ...B.passives])].filter(id => !NO_FIT_HABITS.has(id));
  const passives = [pick(ps), pick(ps)];
  const tos = typeOptions(A, B), types = tos[Math.floor(rnd() * tos.length)];
  const shape = Math.floor(rnd() * 4), palette = Math.floor(rnd() * 3);
  const sprite = { px: shapeOf(A.sprite, B.sprite, shape), c: paletteOf(A.sprite, B.sprite, palette) };
  return makeFit(A, B, { moves, passives, types, basic: rnd() < 0.5 ? A.basic : B.basic, retune: null, sprite, name: nameOptions(A.name, B.name)[0] || A.name, look: { shape: shape ? 1 : 0, palette } }, 0);
}
