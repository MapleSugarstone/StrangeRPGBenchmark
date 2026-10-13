import { addMaps, setGoalFn, MAPS } from '../game/registry';
import type { Goal } from '../game/types';
import { BRASS_MAPS, BRASS_HELPERS } from './brass';
import { SEA_MAPS } from './sea';
import { YEAR_MAPS } from './year';
import { STONE_MAPS } from './stone';
import { resolveDoors, spot, SPOTS } from './kit';
import { flag, S } from '../game/state';
import { F } from '../game/field';

export const OPENING = BRASS_HELPERS.opening;

export function registerContent(): void {
  addMaps([...BRASS_MAPS, ...SEA_MAPS, ...YEAR_MAPS, ...STONE_MAPS]);
  resolveDoors();
  setGoalFn(goalNow);
}

/** One story step: where it happens and what the Pilgrim does there. */
interface Target { text: string; map: string; mark: string; act?: string }

const T = (text: string, map: string, mark: string, act = 'talk'): Target => ({ text, map, mark, act });

function target(): Target {
  if (!flag('intro_done')) return T('Wake up.', 'plaza', '@', 'wait');
  if (!flag('tower_done')) {
    if (!(S.senses.hearing || 0)) return T('The Gear-Keeper in the Gear-Tower knows things. The tower is west of the plaza.', 'tower', '1');
    if (!flag('heard_gear') && !flag('loop_broken')) return T('One gear in the Gear-Tower turns the wrong way. Listen for it with Hearing.', 'tower', 'Q', 'sense:hearing');
    if (!flag('loop_broken')) return T('Hold the wrong gear still with Touch.', 'tower', 'Q', 'sense:touch');
    if (F.map?.id === 'tower') return T('The stairs at the top of the tower go somewhere new now.', 'tower', 'U', 'step');
    return T('Someone is stuck at the top of the Gear-Tower.', 'tower_top', '1');
  }
  if (!flag('library_done')) {
    if (!flag('library_book')) return T('The Brass Library is open, through the north wall of the plaza. A book there contains your own memory.', 'library', 'Y');
    return T('A soldier without a memory stands in the aisle.', 'library', 'K');
  }
  if (!flag('bridge_down')) return T('The Tinkerer repairs broken parts. The bridge to the Steam Gardens is broken.', 'plaza', 'T');
  if (!flag('gardens_done')) {
    if (!flag('gardener_met')) return T('Visit the Gardener in the Steam Gardens, south of the plaza.', 'gardens', '1');
    if (!(S.senses.taste || 0)) return T('#123 wants you to taste the steam fruit in the gardens.', 'gardens', '2');
    if (!flag('storm_done')) return T('Cross the lawn in the middle of the Steam Gardens.', 'gardens', 'T', 'step');
    return T('The big flower in the Steam Gardens is blooming into a weapon.', 'gardens', 'R');
  }
  if (!flag('watchman_down')) return T('Answer the Watchman at the east entrance of the plaza.', 'plaza', 'W');
  if (!flag('sea_intro')) return T('Board the Ship of Many Sails, past the east entrance.', 'plaza', 'E', 'step');
  if (!flag('light_done')) {
    if (F.map?.id !== 'lighthouse') return T('Steer for the Lighthouse of Lost Things.', 'ship', 'W', 'wheel:The Lighthouse of Lost Things');
    if (!(S.senses.smell || 0)) return T('The Lighthouse Keeper remembers everything that has been lost.', 'lighthouse', '1');
    return T('Climb to the light at the top of the Lighthouse of Lost Things.', 'lighthouse', 'U', 'step');
  }
  if (!flag('reef_done')) {
    if (F.map?.id !== 'reef') return T('Steer for the Reef of Forgotten Names.', 'ship', 'W', 'wheel:The Reef of Forgotten Names');
    if (!flag('storm_names_done')) return T('Go into the middle of the Reef of Forgotten Names.', 'reef', 'T', 'step');
    if (!flag('name_bridge')) return T('A forgotten name lies on the sand at the top of the reef.', 'reef', 'n', 'step');
    if (!flag('reef_bridge')) return T('A gap in the reef is waiting to be called something. (Use the name from the Collector.)', 'reef', 'G', 'rename:Bridge');
    if (!flag('name_door')) return T('Past the gap there is another forgotten name.', 'reef', 'q', 'step');
    if (!flag('reef_door')) return T('Coral on the east side is almost a door.', 'reef', 'D', 'rename:Door');
    return T('The far side of the reef runs out into the Current of Time.', 'reef', 'E', 'step');
  }
  if (!flag('choice_made')) {
    if (F.map?.id !== 'current') return T('Steer for the Current of Time.', 'ship', 'W', 'wheel:The Current of Time');
    if (!(S.senses.thought || 0)) return T('Find the Time-Current.', 'current', '1');
    return T('The water splits in the middle of the current. Choose.', 'current', 'X', 'step');
  }
  if (flag('escaping')) return T('Leave 1977 by the west edge of the Yellow Town.', 'yellowtown', 'Q', 'step');
  if (flag('choice_back') && !flag('year_done') && F.map && ['yellowtown', 'factory', 'storyteller', 'chasm'].includes(F.map.id)) return T('At the bottom of the Chasm of Despair, something is waiting.', 'chasm', 'X');
  const inYear = !!F.map && ['yellowtown', 'factory', 'storyteller', 'chasm'].includes(F.map.id);
  if (inYear && (flag('year_done') || !flag('choice_back'))) return T('The edge of the year, west of the Yellow Town, leads back to the Current of Time.', 'yellowtown', 'Q', 'step');
  if (!flag('archive_down')) {
    if (F.map?.id === 'current') return T("The forward current runs to the Keeper's Archive.", 'current', 'F', 'step');
    if (F.map?.id === 'ship') return T("Steer for the Keeper's Archive.", 'ship', 'W', "wheel:The Keeper's Archive");
    if (!flag('keeper_met')) return T("Find the Keeper in the Keeper's Archive.", 'archive', '1');
    return T('The Archive keeps everything in its middle.', 'archive', 'X');
  }
  if (!flag('ch4')) return T('Back on the ship, the way down is open. Steer down.', 'ship', 'W', 'wheel:Down. Under everything.');
  if (F.map?.id === 'ship') return T('The way down is open. Steer down.', 'ship', 'W', 'wheel:Down. Under everything.');
  if (!flag('spire_top')) return T('Climb to the top of the Crystal Spire.', 'spire', 'T', 'step');
  if (!flag('vault_done')) return T('The Memory Vault is west of the spire. A memory there wants to become real.', 'vault', 'Y');
  if (!flag('voidwalker_down')) return T('Climb from the spire into the Void Chamber. Something guards the Stone.', 'voidchamber', '2');
  if (!flag('lbend_down')) return T('Go to the Stone.', 'voidchamber', 'B');
  return T('The Final Choice is past the Stone.', 'final', '1');
}

/** The door of the current map that leads toward another map, by breadth-first search over doors. */
function nextHop(from: string, to: string): { x: number; y: number } | null {
  const prev = new Map<string, { map: string; x: number; y: number } | null>();
  prev.set(from, null);
  const q = [from];
  while (q.length) {
    const m = q.shift()!;
    if (m === to) break;
    for (const e of MAPS[m]?.ents || []) {
      if (!e.door || prev.has(e.door.map)) continue;
      prev.set(e.door.map, { map: m, x: e.x, y: e.y });
      q.push(e.door.map);
    }
  }
  if (!prev.has(to)) return null;
  let cur = to;
  let hop = prev.get(cur)!;
  while (hop && hop.map !== from) { cur = hop.map; hop = prev.get(cur)!; }
  return hop ? { x: hop.x, y: hop.y } : null;
}

/** Maps reached only by the ship have a gangplank exit marked 'A'. */
function shipExit(map: string): { x: number; y: number } | null {
  const s = SPOTS[map]?.['A'];
  return s && !MAPS[map]?.ents.some(e => e.x === s.x && e.y === s.y && e.door) ? s : null;
}

function goalNow(): Goal {
  const t = target();
  const here = F.map?.id;
  if (!here) return { text: t.text };
  if (here === t.map && SPOTS[t.map]?.[t.mark]) { const s = spot(t.map, t.mark); return { text: t.text, map: here, x: s.x, y: s.y, act: t.act }; }
  const hop = nextHop(here, t.map);
  if (hop) return { text: t.text, map: here, x: hop.x, y: hop.y, act: 'step' };
  const ex = shipExit(here);
  if (ex && here !== 'ship') return { text: t.text, map: here, x: ex.x, y: ex.y, act: 'step' };
  return { text: t.text, map: t.map };
}
