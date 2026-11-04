// Fusing (design/systems.md, section 3): two Ruin of level 10 or more become one new Ruin. The player picks its name
// from four mixes of the parents' names, its look from four mixes of their sprites, its types from four mixes of their
// types, and four moves from their combined moves; it keeps both parents' passives. Its base stats are 92% of the
// parents' average, a little under a normal Ruin's, for the stronger kit. Fused species live in the save and are added
// to SPECIES and SPRITES whenever a save comes into play.
import type { GameState } from './game_state.js';
import { SPECIES, type SpeciesData } from '../battle/species.js';
import { SPRITES } from '../art/sprites.js';
import type { Sprite } from './sprite.js';
import type { Type } from '../battle/types.js';
import { FUSE_PRICE, FUSE_MIN_LEVEL } from '../content/forge.js';

export interface FusedSpecies extends SpeciesData { sprite: Sprite }

/** Adds the save's fused species to the species and sprite tables. */
export function registerFusions(save: GameState): void {
  for (const [key, sp] of Object.entries(save.fusions ?? {})) {
    SPECIES[key] = sp;
    SPRITES[key] = sp.sprite;
  }
}

/** A Ruin the player holds, in the party or in storage. */
export interface Held { key: string; level: number; where: 'party' | 'storage'; i: number }

export function heldRuin(save: GameState): Held[] {
  return [...save.party.map((key, i) => ({ key, level: save.partyLevels[i] ?? 1, where: 'party' as const, i })),
    ...(save.storage ?? []).map((r, i) => ({ key: r.key, level: r.level, where: 'storage' as const, i }))];
}

export const canFuse = (r: Held) => r.level >= FUSE_MIN_LEVEL;

const words = (name: string) => name.split(' ').filter(Boolean);
const half = (w: string, front: boolean) => (front ? w.slice(0, Math.ceil(w.length / 2)) : w.slice(Math.floor(w.length / 2)));

/** Four mixes of two names: each one's first word with the other's last, and two blends of their last words. */
export function nameMixes(a: string, b: string): string[] {
  const wa = words(a), wb = words(b);
  const la = wa[wa.length - 1], lb = wb[wb.length - 1];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const out = [`${wa[0]} ${lb}`, `${wb[0]} ${la}`, cap(half(la, true) + half(lb, false)), cap(half(lb, true) + half(la, false)),
    `${wa[0]} ${wb[0]}`, `${la} ${lb}`];
  return [...new Set(out.map((s) => s.trim()).filter((s) => s && s !== a && s !== b))].slice(0, 4);
}

/** Four mixes of two 8 by 8 sprites: top of one over the bottom of the other, and left of one beside the right of the
 * other, each in the colors of the parent that gives the top or left half (a sprite holds three colors at most). */
export function lookMixes(a: Sprite, b: Sprite): Sprite[] {
  const mix = (top: Sprite, low: Sprite, vertical: boolean): Sprite => ({
    colors: top.colors,
    rows: top.rows.map((row, y) => (vertical ? (y < 4 ? row : low.rows[y] ?? row) : row.slice(0, 4) + (low.rows[y] ?? row).slice(4))),
  });
  return [mix(a, b, true), mix(b, a, true), mix(a, b, false), mix(b, a, false)];
}

/** Four mixes of the parents' types: each alone, and both in either order. */
export function typeMixes(a: Type[], b: Type[]): Type[][] {
  const out = [[a[0]], [b[0]], [a[0], b[0]], [b[0], a[0]]].map((t) => [...new Set(t)]);
  const seen = new Set<string>();
  return out.filter((t) => !seen.has(t.join('/')) && !!seen.add(t.join('/')));
}

/** The parents' moves together, without repeats. */
export function movePool(a: string, b: string): string[] {
  return [...new Set([...(SPECIES[a]?.moves ?? []), ...(SPECIES[b]?.moves ?? [])])];
}

/** The passives a fusion keeps: each parent's own (a fused parent gives its first). */
const passiveKey = (k: string) => (SPECIES[k]?.passiveOf?.[0] ?? k);

/** Makes the fusion: pays, removes the parents, and puts the new Ruin where the first parent was. Returns its key. */
export function fuse(save: GameState, a: Held, b: Held, pick: { name: string; sprite: Sprite; types: Type[]; moves: string[] }): string | null {
  if ((save.bag.cinder ?? 0) < FUSE_PRICE || !canFuse(a) || !canFuse(b)) return null;
  const pa = SPECIES[a.key], pb = SPECIES[b.key];
  if (!pa || !pb) return null;
  save.bag.cinder -= FUSE_PRICE;
  const stats = Object.fromEntries(Object.keys(pa.baseStats).map((s) => {
    const k = s as keyof SpeciesData['baseStats'];
    return [k, Math.round(((pa.baseStats[k] + pb.baseStats[k]) / 2) * 0.92)];
  })) as SpeciesData['baseStats'];
  const n = Object.keys(save.fusions ?? {}).length + 1;
  const key = `fusion_${n}`;
  const species: FusedSpecies = {
    name: pick.name, types: pick.types, baseStats: stats, moves: pick.moves.slice(0, 4),
    passive: pa.passive, passiveOf: [...new Set([passiveKey(a.key), passiveKey(b.key)])],
    attackKind: pa.attackKind, description: pa.description, sprite: pick.sprite,
  };
  (save.fusions ??= {})[key] = species;
  registerFusions(save);
  (save.seen ??= []).push(key);
  (save.caught ??= []).push(key);
  const level = Math.floor((a.level + b.level) / 2);
  // Remove the later index first so the earlier one stays right.
  const fromParty = [a, b].filter((p) => p.where === 'party').map((p) => p.i).sort((x, y) => y - x);
  const fromStorage = [a, b].filter((p) => p.where === 'storage').map((p) => p.i).sort((x, y) => y - x);
  for (const i of fromStorage) save.storage!.splice(i, 1);
  for (const i of fromParty) {
    for (const list of [save.party, save.partyLevels, save.partyExp, save.partyHp, save.partyQuench, save.partyNames] as (unknown[] | undefined)[]) list?.splice(i, 1);
  }
  // The new Ruin takes the first parent's place in the party, or goes to the party or storage like a catch.
  if (fromParty.length) {
    const at = Math.min(a.where === 'party' ? a.i - (b.where === 'party' && b.i < a.i ? 1 : 0) : Math.min(...fromParty), save.party.length);
    save.party.splice(at, 0, key);
    save.partyLevels.splice(at, 0, level);
    (save.partyExp ??= save.party.map(() => 0)).splice(at, 0, 0);
    save.partyHp?.splice(at, 0, 9999);
    save.partyQuench?.splice(at, 0, {});
    save.partyNames?.splice(at, 0, "");
  } else if (save.party.length < 4) {
    save.party.push(key); save.partyLevels.push(level); (save.partyExp ??= []).push(0); save.partyHp?.push(9999); save.partyQuench?.push({}); save.partyNames?.push("");
  } else (save.storage ??= []).push({ key, level, exp: 0 });
  return key;
}
