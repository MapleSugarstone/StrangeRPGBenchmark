// The colors of a move's picture and of a summon when the user is a fit or the move's type has changed. A picture drawn
// in its owner kind's colors moves each of those colors to a fit color or to the new type's color, and every shade of a
// color moves with it. View only: this reads the battle and never changes it.
import { moveType } from '../battle/engine';
import type { Fighter, SpriteData } from '../battle/model';
import { SUMMONS, type MoveDef } from '../battle/registry';
import { SPECIES } from '../data/species';
import { TYPE_COLOR, type Type } from '../data/types';

/** Maps a color the picture asks for to the color it draws. */
export type Paint = (c: string) => string;

type Hsl = [number, number, number];

function hsl(c: string): Hsl {
  const n = parseInt(c.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo;
  if (d === 0) return [0, 0, l];
  const h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
}

function hex([h, s, l]: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number): number => Math.round(Math.max(0, Math.min(1, v + m)) * 255);
  return '#' + ((1 << 24) | (to(r) << 16) | (to(g) << 8) | to(b)).toString(16).slice(1);
}

/** How far apart two colors are, from 0 to 1. */
function gap(p: string, q: string): number {
  const a = parseInt(p.slice(1), 16), b = parseInt(q.slice(1), 16);
  return Math.hypot(((a >> 16) & 255) - ((b >> 16) & 255), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255)) / 441;
}

const nearest = (list: string[], c: string): number => list.reduce((best, x, i) => (gap(c, x) < gap(c, list[best]) ? i : best), 0);
const three = (c: readonly (string | undefined)[]): string[] => [c[0]!, c[1]!, c[2] || c[1]!];

/** Moves v from where it sits around a to the same place around t: 0 to a lands on 0 to t, and a to 1 on t to 1. */
const rescale = (v: number, a: number, t: number): number => (v >= a ? t + ((v - a) * (1 - t)) / Math.max(0.01, 1 - a) : (t * v) / Math.max(0.01, a));

/** Color c, a shade of `from`, as the same shade of `to`. A hue that sits off its base color keeps up to 15 degrees of that offset. */
function shift(c: string, from: string, to: string): string {
  const [hc, sc, lc] = hsl(c), [hf, sf, lf] = hsl(from), [ht, st, lt] = hsl(to);
  const dh = sc < 0.12 || sf < 0.12 ? 0 : Math.max(-15, Math.min(15, ((hc - hf + 540) % 360) - 180));
  return hex([(ht + dh + 360) % 360, rescale(sc, sf, st), rescale(lc, lf, lt)]);
}

/** A recoloring that moves each color with the owner color nearest it. Near-black and near-white colors stay, so ink and white stay. */
function painter(roles: string[], to: string[]): Paint | null {
  if (roles.every((r, i) => r === to[i])) return null;
  const memo = new Map<string, string>();
  return c => {
    let v = memo.get(c);
    if (v === undefined) {
      const i = nearest(roles, c), l = hsl(c)[2];
      v = l < 0.1 || l > 0.94 || roles[i] === to[i] ? c : shift(c, roles[i], to[i]);
      memo.set(c, v);
    }
    return v;
  };
}

/**
 * What each owner color becomes. The one nearest the move's own type color is its main color: it takes the new type's
 * color when the type changed, or else the fit color nearest the type. For a fit the others take the fit's other colors,
 * dark to dark. For any other whorl they take the new type's hue at their own lightness.
 */
function targets(roles: string[], was: Type, main: string | null, fit: string[] | null): string[] {
  const out = roles.slice(), m = nearest(roles, TYPE_COLOR[was]);
  if (!fit) {
    if (main) { const [h, s] = hsl(main); roles.forEach((r, i) => { out[i] = i === m ? main : hex([h, s, hsl(r)[2]]); }); }
    return out;
  }
  const k = nearest(fit, main || TYPE_COLOR[was]);
  out[m] = main || fit[k];
  const rest = fit.filter((_, i) => i !== k).sort((a, z) => hsl(a)[2] - hsl(z)[2]);
  const others = roles.map((_, i) => i).filter(i => i !== m).sort((a, z) => hsl(roles[a])[2] - hsl(roles[z])[2]);
  others.forEach((i, j) => { out[i] = rest[Math.min(j, rest.length - 1)]; });
  return out;
}

/** The fit's own three colors, or null for a whorl that is not a fit. */
export function fitColors(f: Fighter | undefined): string[] | null {
  return f?.mon.fitted && f.mon.sprite?.c?.length ? three(f.mon.sprite.c) : null;
}

/** The recoloring for art an owner kind drew for a move of type `was` that now plays as `now`, for a user with fit colors `fit`. */
export function paintFor(owner: string | undefined, was: Type, now: Type, fit: string[] | null): Paint | null {
  if (was === now && !fit) return null;
  const sp = owner ? SPECIES[owner] : undefined;
  const roles = sp?.c?.length ? three(sp.c) : [TYPE_COLOR[was]];
  return painter(roles, targets(roles, was, was === now ? null : TYPE_COLOR[now], fit));
}

/** How a move's own picture recolors for its user, or null when it draws as it always has. */
export function movePaint(user: Fighter | undefined, mv: MoveDef | undefined): Paint | null {
  return user && mv ? paintFor(mv.owner, mv.type, moveType(user, mv), fitColors(user)) : null;
}

/** A fit picture's accent: the fit color farthest from the picture's main color, passing over dark ones when it can. */
export function fitAccent(fit: string[] | null, main: string): string | undefined {
  if (!fit) return undefined;
  const lit = fit.filter(c => hsl(c)[2] >= 0.25);
  return (lit.length ? lit : fit).slice().sort((a, z) => gap(z, main) - gap(a, main))[0];
}

const sumMemo = new Map<string, SpriteData>();

/** A summon's sprite for its owner. A fit's summon takes the fit's colors. */
export const summonSprite = (def: string, owner: Fighter | undefined): SpriteData | undefined => summonLook(def, fitColors(owner));

/** A summon's sprite for an owner with fit colors `fit`, or its own sprite when `fit` is null. */
export function summonLook(def: string, fit: string[] | null): SpriteData | undefined {
  const d = SUMMONS[def], s = d?.sprite;
  if (!s || !fit) return s;
  const key = def + '|' + fit.join();
  let o = sumMemo.get(key);
  if (!o) {
    const was = (SPECIES[d.owner]?.types[0] || 'STONE') as Type, p = paintFor(d.owner, was, was, fit);
    o = p ? { ...s, c: (s.c[2] ? [p(s.c[0]), p(s.c[1]), p(s.c[2])] : [p(s.c[0]), p(s.c[1])]) as SpriteData['c'] } : s;
    sumMemo.set(key, o);
  }
  return o;
}
