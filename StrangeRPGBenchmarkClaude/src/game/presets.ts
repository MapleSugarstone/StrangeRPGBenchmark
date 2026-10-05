import { newGame, newMember, GameState, healAll } from './state';
import { CHAPTERS } from '../maps';

/** Expected party state at the start of each chapter, for chapter select and the balance sim. */
export interface Preset {
  lvl: number;
  party: string[];
  reserve?: string[];
  weaponTier: number;
  gold: number;
  items: Record<string, number>;
  mech: string[];
  flags?: Record<string, number | string | boolean>;
  keyItems?: string[];
  charms?: Record<string, string>;
}

export const PRESETS: Preset[] = [
  { lvl: 1, party: ['wick'], weaponTier: 0, gold: 20, items: { tallow: 3 }, mech: [] },
  { lvl: 6, party: ['wick', 'nona'], weaponTier: 1, gold: 150, items: { tallow: 5, ink_vial: 2, pin: 1 }, mech: [], keyItems: ['lampsap'], charms: { wick: 'lucky_button', nona: 'wool_scarf' } },
  { lvl: 10, party: ['wick', 'nona', 'tint'], weaponTier: 2, gold: 350, items: { tallow: 4, candle: 2, ink_vial: 3, relight: 1 }, mech: ['hues'], keyItems: ['lens_shard'], charms: { wick: 'lucky_button', nona: 'wool_scarf', tint: 'ink_ring' } },
  { lvl: 14, party: ['wick', 'nona', 'tint', 'brask'], weaponTier: 3, gold: 600, items: { candle: 5, ink_vial: 4, relight: 2, pin: 2 }, mech: ['hues', 'break'], keyItems: ['lens_shard', 'seal'] },
  { lvl: 17, party: ['wick', 'nona', 'tint', 'tock'], reserve: ['brask'], weaponTier: 4, gold: 900, items: { candle: 6, ink_vial: 3, ink_well: 2, relight: 2, clock_tea: 1 }, mech: ['hues', 'break', 'tempo'], keyItems: ['lens_shard', 'seal', 'sundial'] },
  { lvl: 20, party: ['wick', 'nona', 'tint', 'vend'], reserve: ['tock', 'brask'], weaponTier: 5, gold: 1400, items: { candle: 6, honey: 2, ink_well: 3, relight: 3 }, mech: ['hues', 'break', 'tempo', 'coin'], keyItems: ['seal', 'sundial', 'ticket'] },
  { lvl: 23, party: ['wick', 'nona', 'tint', 'vend'], reserve: ['tock', 'brask'], weaponTier: 5, gold: 2000, items: { honey: 4, ink_well: 4, relight: 3, chorus: 1 }, mech: ['hues', 'break', 'tempo', 'coin', 'link', 'mirror'], keyItems: ['sundial'], flags: { mirrowJoined: true } },
  { lvl: 27, party: ['wick', 'tint', 'brask', 'nil'], reserve: ['tock', 'vend', 'mirrow'], weaponTier: 6, gold: 2500, items: { honey: 5, ink_well: 4, relight: 4, chorus: 2 }, mech: ['hues', 'break', 'tempo', 'coin', 'link', 'mirror', 'echo'], keyItems: ['ninth_spool', 'gran_jar'], flags: { nonaGone: true, greyWorld: true, mirrowJoined: true } },
];

export function chapterStart(n: number): GameState {
  const p = PRESETS[n - 1];
  const st = newGame();
  const ch = CHAPTERS[n - 1];
  st.chapter = n;
  st.map = ch.startMap;
  st.members = {};
  st.party = [];
  st.reserve = [];
  for (const id of [...p.party, ...(p.reserve ?? [])]) {
    const m = newMember(id, p.lvl);
    const tier = Math.min(6, p.weaponTier);
    m.weapon = `${m.weapon.slice(0, -1)}${tier}`;
    if (p.charms?.[id]) m.charm = p.charms[id];
    st.members[id] = m;
  }
  st.party = [...p.party];
  st.reserve = [...(p.reserve ?? [])];
  st.gold = p.gold;
  st.items = { ...p.items };
  for (const k of p.keyItems ?? []) st.items[k] = 1;
  st.mech = [...p.mech];
  st.flags = { ...(p.flags ?? {}), ...(ch.presetFlags ?? {}) };
  healAll(st);
  return st;
}
