// The replay systems at run time: faction standing, relationships between companions, travel destinations,
// world events, and quests that expire. Design: Notes/replay-design.md.
import { G, flag } from './state';
import { EVENTS, FACTION, TRAVEL, type Destination } from '../content/replay';
import { QUEST } from '../content/quests';
import { MAPS } from '../world/map';
import { SCENES } from './script';
import { toast } from '../ui/dialogue';
import { C } from '../engine/palette';

export function rep(faction: string): number { return G.rep?.[faction] ?? 0; }

export function addRep(faction: string, n: number) {
  G.rep ??= {};
  const v = Math.max(-10, Math.min(10, rep(faction) + n));
  if (v === rep(faction)) return;
  G.rep[faction] = v;
  const f = FACTION.get(faction);
  if (f) toast(`${f.name} ${n > 0 ? '+' : ''}${n}`, n > 0 ? f.color : C.gray);
}

const pairKey = (a: string, b: string) => [a, b].sort().join('-');
export function rel(a: string, b: string): number { return G.rel?.[pairKey(a, b)] ?? 0; }
export function addRel(a: string, b: string, n: number) {
  G.rel ??= {};
  G.rel[pairKey(a, b)] = Math.max(-10, Math.min(10, rel(a, b) + n));
}

/** The approval tier of a companion: hostile, wary, neutral, friendly, or devoted. */
export function tier(id: string): 'hostile' | 'wary' | 'neutral' | 'friendly' | 'devoted' {
  const a = G.roster[id]?.approval ?? 0;
  return a <= -30 ? 'hostile' : a < -10 ? 'wary' : a >= 30 ? 'devoted' : a >= 15 ? 'friendly' : 'neutral';
}

/** Where a destination leads right now, after its variants. */
export function resolve(d: Destination): { map: string; marker: string } {
  for (const v of d.variants ?? []) if (flag(v.when)) return { map: v.map, marker: v.marker };
  return { map: d.map, marker: d.marker };
}

/** Destinations the party can travel to now, except the map it stands on. */
export function destinations(): Destination[] {
  return TRAVEL.filter((d) => {
    if (d.when && !flag(d.when)) return false;
    const to = resolve(d);
    if (!MAPS.has(to.map) || to.map === G.map) return false;
    return !!G.flags['visited_' + d.map] || !!G.flags['visited_' + to.map] || (!!d.known && flag(d.known));
  });
}

/** Marks a map visited and counts arrivals, for travel and for world event cooldowns. */
export function noteArrival(map: string) {
  G.flags['visited_' + map] = 1;
  G.flags.arrivals = (G.flags.arrivals ?? 0) + 1;
}

function roll(id: string, n: number): number {
  let h = (G.seed ?? 1) ^ Math.imul(n + 1, 2654435761);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** A world event scene to run on arriving at a map, or null. The save's seed decides which ones fire. */
export function eventOnArrive(mapId: string): string | null {
  const def = MAPS.get(mapId);
  if (!def) return null;
  const n = G.flags.arrivals ?? 0;
  for (const e of EVENTS) {
    if (!SCENES.has(e.scene)) continue;
    if (e.maps && !e.maps.includes(mapId)) continue;
    if (e.district && (e.district === 'inside' ? !def.inside : def.district !== e.district || def.inside)) continue;
    if (e.when && !flag(e.when)) continue;
    const last = G.flags['event_' + e.id];
    if (last && (!e.repeat || n - last < e.repeat)) continue;
    if (roll(e.id, n) > (e.chance ?? 0.25)) continue;
    G.flags['event_' + e.id] = n;
    return e.scene;
  }
  return null;
}

/** Fails every started quest whose last chapter has passed. */
export function expireQuests(chapter: number) {
  for (const [id, q] of Object.entries(G.quests)) {
    const d = QUEST.get(id);
    if (!d?.expires || q.done || q.failed || chapter <= d.expires) continue;
    q.failed = true;
    G.flags[id + '_missed'] = 1;
    toast(`Missed: ${d.title}`, C.gray);
  }
}
