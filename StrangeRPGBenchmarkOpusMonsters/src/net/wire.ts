// The wire form of an online roster: the least that rebuilds each whorl, the checks a roster must pass before it queues,
// and the check on the four each player picks from it once a match is found.
import type { Mon } from '../battle/model';
import { MOVES, NOTIONS, PASSIVES } from '../battle/registry';
import { TAN_PER_STAT, TAN_TOTAL } from '../battle/engine';
import { makeMon, SPECIES, spriteOf } from '../data/species';
import { NOTION_IDS } from '../data/notions';
import { starbornSprite } from '../data/starborn';
import { TYPES, type Type } from '../data/types';
import { nameOptions, NO_FIT_HABITS, paletteOf, parentKindsOf, SHAPES, shapeOf, typeOptions } from '../game/fitting';
import { nameBlocked } from './names';
import { NAME_CHARS, PLAYER_NAME_MAX, ROSTER_SIZE, TAN_KEYS, TEAM_SIZE, WHORL_NAME_MAX, type WireFit, type WireMon } from './protocol';

export { PLAYER_NAME_MAX, ROSTER_SIZE, TEAM_SIZE, WHORL_NAME_MAX, type WireFit, type WireMon } from './protocol';

/** The most legendaries a roster may hold with every fit counted by its parents. */
export const LEGENDARY_MAX = 1;
/** The level every online whorl fights at under `rules.sync`. */
export const SYNC_LEVEL = 25;
/** The palettes a fit's look can name in `paletteOf`. */
const PALETTES = 12;
const TAPE = /^[pags]{4}$/;

/**
 * A whorl's name as both players see it online: its own name, or a stand-in for a name the room left empty or the word filter
 * refuses. The stand-in is the kind's name, or for a fit the first blend of its kinds' names the Conjoiner offers. Both
 * copies of a battle build their whorls with it, so they agree on every name.
 */
export function shownWhorlName(w: WireMon): string {
  if (typeof w.name === 'string' && w.name.trim() && !nameBlocked(w.name)) return w.name;
  const name = (k: unknown) => (known(k) ? SPECIES[k].name : 'Whorl');
  if (!w.fit) return name(w.kind);
  const a = name(w.fit.kinds?.[0]), b = name(w.fit.kinds?.[1]);
  return nameOptions(a, b).find(n => !nameBlocked(n)) ?? a;
}

/** A whorl from a save in its wire form. */
export function wireFromMon(m: Mon): WireMon {
  const base: WireMon = { name: m.name, notion: m.notion ?? null };
  if (m.tan) base.tan = { ...m.tan };
  if (m.starborn) base.starborn = true;
  if (!m.fitted) return { kind: m.kind, ...base, ...(m.tape ? { tape: m.tape } : {}) };
  const kinds = parentKindsOf(m) ?? ['', ''];
  return {
    fit: {
      kinds: [kinds[0], kinds[1]], moves: m.moves.slice(), passives: m.passives.slice(), types: m.types.slice(), basic: m.basic,
      retune: m.retune ? { ...m.retune } : null, look: m.fitLook ? { ...m.fitLook } : { shape: 0, palette: 0 },
    },
    ...base,
  };
}

/** Rebuilds a checked wire whorl for `slot` on `side` with a kind's moves, passives, and types from this build's own species data. */
export function monFromWire(w: WireMon, side: 0 | 1, slot: number): Mon {
  // kits6 compares mon.uid, so both clients number the whorls the same way.
  const uid = side * 10 + slot + 1, name = shownWhorlName(w);
  let m: Mon;
  if (w.fit) {
    const f = w.fit, A = SPECIES[f.kinds[0]], B = SPECIES[f.kinds[1]], a = spriteOf(A), b = spriteOf(B);
    m = {
      uid, kind: 'fit', name, types: f.types.slice() as Type[], basic: f.basic, moves: f.moves.slice(), passives: f.passives.slice(),
      retune: f.retune ? { move: f.retune.move, type: f.retune.type as Type } : null, level: SYNC_LEVEL, xp: 0, notion: w.notion,
      sprite: { px: shapeOf(a, b, f.look.shape), c: paletteOf(a, b, f.look.palette) }, fitted: true, parents: [A.name, B.name],
      parentKinds: [f.kinds[0], f.kinds[1]], fitLook: { ...f.look }, legendary: !!(A.legendary || B.legendary),
    };
  } else {
    m = makeMon(w.kind!, 25, { uid, name, notion: w.notion, level: SYNC_LEVEL });
    if (w.tape) m.tape = w.tape;
  }
  if (w.tan) m.tan = { ...w.tan };
  if (w.starborn && !m.person) { m.starborn = true; m.sprite = starbornSprite(m.sprite); }
  return m;
}

/** The kinds a wire whorl uses up on a team: its own or both of a fit's. */
export function wireKinds(w: WireMon): string[] {
  if (w?.fit && Array.isArray(w.fit.kinds)) return w.fit.kinds.filter(k => typeof k === 'string');
  return typeof w?.kind === 'string' ? [w.kind] : [];
}

/** Null for a name that can go online and otherwise the reason it cannot. */
export function nameProblem(name: unknown, max = PLAYER_NAME_MAX): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'Enter a letter or number.';
  if (name.length > max) return `Max ${max} letters allowed.`;
  return NAME_CHARS.test(name) ? null : 'Use only name-screen letters.';
}

const whole = (n: unknown, lo: number, hi: number): boolean => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;
// An own-property test, since a kind sent as "constructor" would otherwise find the object's prototype.
const known = (k: unknown): k is string => typeof k === 'string' && Object.prototype.hasOwnProperty.call(SPECIES, k);

/** Every reason one wire whorl from untrusted data cannot play. */
export function whorlProblems(w: unknown): string[] {
  if (!w || typeof w !== 'object') return ['isn\'t a Whorl.'];
  const m = w as WireMon, out: string[] = [];
  // The room empties a name the word filter refuses, and the whorl then shows a stand-in.
  if (m.name !== '' && nameProblem(m.name, WHORL_NAME_MAX)) out.push(`bears a name the name screen cannot render in ${WHORL_NAME_MAX} characters.`);
  if (m.notion !== null && !NOTION_IDS.includes(m.notion as string)) out.push('holds a notion the game does not know.');
  // Online play sets no nacre limit. This refuses only nacre past the game's own caps, and only an edited save can hold that.
  if (m.tan !== undefined) {
    const tan = m.tan as Record<string, unknown>, keys = tan && typeof tan === 'object' ? Object.keys(tan) : null;
    if (!keys || keys.some(k => !(TAN_KEYS as readonly string[]).includes(k) || !whole(tan[k], 0, TAN_PER_STAT)) || keys.reduce((n, k) => n + (tan[k] as number), 0) > TAN_TOTAL) {
      out.push(`holds more nacre than the game lays (${TAN_PER_STAT} layers a stat and ${TAN_TOTAL} in all).`);
    }
  }
  if (m.starborn !== undefined && typeof m.starborn !== 'boolean') out.push('bears a starborn sigil that defies reading.');
  if ((m.kind === undefined) === (m.fit === undefined)) return [...out, 'must be of one species or one fit.'];
  if (m.kind !== undefined) {
    const sp = known(m.kind) ? SPECIES[m.kind] : undefined;
    if (!sp) out.push('is not a species the game knows.');
    else if (sp.person) out.push('is a person, and people can\'t go online.');
    if (m.tape !== undefined && (m.kind !== 'carcanet' || typeof m.tape !== 'string' || !TAPE.test(m.tape))) out.push('holds a tape it cannot set.');
    return out;
  }
  if (m.tape !== undefined) out.push('holds a tape it cannot set.');
  return [...out, ...fitProblems(m.fit)];
}

/** Every reason a wire fit is not one the Conjoiner could have made. */
function fitProblems(f: unknown): string[] {
  if (!f || typeof f !== 'object') return ['is a fit that can\'t be read.'];
  const x = f as WireFit;
  const kinds = Array.isArray(x.kinds) ? x.kinds : [];
  const A = known(kinds[0]) ? SPECIES[kinds[0]] : undefined, B = known(kinds[1]) ? SPECIES[kinds[1]] : undefined;
  if (kinds.length !== 2 || !A || !B || A === B) return ['is a fit of a species the game does not know.'];
  if (A.person || B.person) return ['is a fit containing a person, and persons cannot go online.'];
  const out: string[] = [];
  const moves = Array.isArray(x.moves) ? x.moves : [];
  const fromA = moves.filter(id => A.moves.includes(id)).length, fromB = moves.filter(id => B.moves.includes(id)).length;
  if (moves.length !== 4 || new Set(moves).size !== 4 || fromA !== 2 || fromB !== 2) out.push('is a fit that does not inherit two moves from each parent.');
  else if (moves.filter(id => MOVES[id]?.nerve).length > 2) out.push('is a fit with more than two crests.');
  const habits = new Set([...A.passives, ...B.passives].filter(id => !NO_FIT_HABITS.has(id)));
  const passives = Array.isArray(x.passives) ? x.passives : [];
  if (passives.length !== 2 || new Set(passives).size !== 2 || passives.some(id => !habits.has(id) || !PASSIVES[id])) out.push('is a fit with habits its parents do not possess.');
  const types = Array.isArray(x.types) ? x.types : [];
  const key = (t: string[]) => t.slice().sort().join();
  const options = typeOptions({ types: A.types } as Mon, { types: B.types } as Mon).map(key);
  if (!types.every(t => TYPES.includes(t as Type)) || !options.includes(key(types))) out.push('is a fit with types its parents cannot provide.');
  if (x.basic !== A.basic && x.basic !== B.basic) out.push('is a fit with a plain attack neither parent has.');
  if (x.retune !== null && (!x.retune || !moves.includes(x.retune.move) || !types.includes(x.retune.type))) out.push('is a fit with a retune it cannot make.');
  if (!x.look || !whole(x.look.shape, 0, SHAPES.length - 1) || !whole(x.look.palette, 0, PALETTES - 1)) out.push('is a fit with a look that cannot be drawn.');
  return out;
}

/** Every reason a wire roster cannot queue from its size, each whorl, and the team rule, legendary limit, and notion rule across all six. */
export function teamProblems(roster: unknown): string[] {
  if (!Array.isArray(roster)) return ['A roster is a collection of Whorls.'];
  const out: string[] = [];
  if (roster.length !== ROSTER_SIZE) out.push(`Each roster contains ${ROSTER_SIZE} Whorls.`);
  const owner = new Map<string, string>(), holds = new Set<string>();
  let legends = 0;
  roster.forEach((w: WireMon, i) => {
    const who = typeof w?.name === 'string' && w.name.trim() ? w.name : `Whorl ${i + 1}`;
    for (const p of whorlProblems(w)) out.push(`${who} ${p}`);
    if (typeof w?.notion === 'string') {
      if (holds.has(w.notion)) out.push(`Two Whorls hold ${(NOTION_IDS.includes(w.notion) && NOTIONS[w.notion]?.name) || w.notion}. A roster takes each notion once.`);
      holds.add(w.notion);
    }
    const kinds = wireKinds(w);
    for (const k of kinds) {
      const first = owner.get(k);
      if (first === undefined) owner.set(k, who);
      else out.push(`${known(k) ? SPECIES[k].name : k} appears on this roster twice: within ${first} and within ${who}.`);
    }
    // The species say what is legendary because a sender could leave the wire's flag off.
    if (kinds.some(k => known(k) && SPECIES[k].legendary)) legends++;
  });
  if (legends > LEGENDARY_MAX) out.push(`Max one legendary per roster. A fit with a legendary parent counts. ${legends} is here.`);
  return out;
}

/** The pick a side gets when its time runs out: the first four of its roster in roster order. */
export const DEFAULT_PICK: readonly number[] = Array.from({ length: TEAM_SIZE }, (_, i) => i);

/** Every reason a pick is not four different members of a roster of `size`, given by index in battle order with the lead first. */
export function pickProblems(pick: unknown, size = ROSTER_SIZE): string[] {
  if (!Array.isArray(pick)) return ['A pick is a selection of Whorls drawn from the roster.'];
  const out: string[] = [];
  if (pick.length !== TEAM_SIZE) out.push(`Each pick contains ${TEAM_SIZE} Whorls.`);
  if (pick.some(i => !whole(i, 0, size - 1))) out.push('A pick identifies a Whorl that is absent from the roster.');
  else if (new Set(pick).size !== pick.length) out.push('A pick repeats a Whorl.');
  return out;
}

/** The whorls a checked pick names from a roster, lead first. */
export function pickedTeam(roster: WireMon[], pick: readonly number[]): WireMon[] {
  return pick.map(i => roster[i]);
}
