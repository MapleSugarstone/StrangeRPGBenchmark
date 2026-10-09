// Shared rules for Act 2 on the Strand: the tide and the Gleaner's walk, shells and the sweep, the hand bell,
// star grains, and giving a whorl away. Chapter files build on these so every chapter plays by the same beach.
import { sfx } from '../../engine/audio';
import type { Mon } from '../../battle/model';
import { bell, choose, emote, field, hint, morph, narr, notice, say, sound, wait } from '../../game/api';
import { listMenu, menuExtras, monLine } from '../../game/menus';
import { G, HERO, flag, save, scaleNow, setFlag } from '../../game/state';
import { strandFx } from '../../game/strandfx';
import { MAPS, type MapDef } from '../../game/world';
import { highTide } from '../areakit';

type Spot = NonNullable<MapDef['spots']>[number];
type Mod = NonNullable<MapDef['mods']>[number];

// ---------------------------------------------------------------- footprints and the Gleaner's walk

/** The line of footprints the Gleaner walks on each map, in tiles. Stars land on them in this order at low water. */
export const FOOTPRINTS: Record<string, [number, number][]> = {};

/**
 * The low-water walk on the map Ouro is on: the ground shakes in slow steps, a shadow crosses, and a star lands in
 * each footprint in turn. Content may call it for a scripted low water. turnTide calls it when the tide goes out.
 */
export async function gleanerWalk(): Promise<void> {
  const steps = FOOTPRINTS[field.map.id] || [];
  strandFx.shadow = 60 + steps.length * 24;
  // With the tide table, Ouro can see where the stars will come down before they do.
  if (G.keys.includes('tidetable')) { strandFx.marks = steps.map(([x, y]) => [x, y] as [number, number]); await wait(40); }
  for (const [x, y] of steps) {
    strandFx.marks = strandFx.marks.filter(([mx, my]) => mx !== x || my !== y);
    field.shakeT = 10;
    sfx('boom');
    strandFx.landings.push({ x, y, t: 0 });
    await wait(24);
  }
  if (!steps.length) { field.shakeT = 30; sfx('boom'); await wait(60); }
}

// ---------------------------------------------------------------- shells and the sweep

const key = (map: string, id: string) => `${map}:${id}`;
/** 0 lying there, 1 taken by the sweep. */
const shellGone = (map: string, id: string) => !!flag('shell:' + key(map, id));

/** Whether a shell lies on the sand now (it may have a whorl in it). */
export function shellThere(map: string, id: string): boolean { return !shellGone(map, id); }
/** The whorl sitting in a shell, if any. */
export function shellMon(map: string, id: string): Mon | undefined { return G.shellMons[key(map, id)]; }

/**
 * Gives a map's shells their look and their use. An empty shell is tile C, a shell with a whorl in it is tile J,
 * and a taken shell leaves a hollow (tile b). Facing a shell offers to leave a whorl in it or call one back.
 */
export function defineShells(mapId: string): void {
  const m = MAPS[mapId];
  if (!m?.shells) return;
  const mods: Mod[] = m.mods ||= [];
  const spots: Spot[] = m.spots ||= [];
  for (const s of m.shells) {
    mods.push({ x: s.x, y: s.y, ch: 'b', when: () => shellGone(mapId, s.id) });
    mods.push({ x: s.x, y: s.y, ch: 'J', when: () => !shellGone(mapId, s.id) && !!shellMon(mapId, s.id) });
    mods.push({ x: s.x, y: s.y, ch: 'C', when: () => !shellGone(mapId, s.id) });
    spots.push({ x: s.x, y: s.y, script: () => useShell(mapId, s.id) });
  }
}

async function useShell(mapId: string, id: string): Promise<void> {
  if (shellGone(mapId, id)) { await emote('ouro', 'silence'); return; }
  const k = key(mapId, id);
  const sitting = G.shellMons[k];
  if (sitting) {
    if (await choose([`Call ${sitting.name}`, 'Leave it'], true) !== 0) return;
    sfx('switch');
    delete G.shellMons[k];
    if (G.party.length < 4) G.party.push(sitting); else G.rack.push(sitting);
    await notice(G.party.includes(sitting) ? `${sitting.name} comes back to your team.` : `${sitting.name} goes to the Midden.`);
    save();
    return;
  }
  if (G.party.length < 2) { await hint('Ouro needs at least one whorl to keep before leaving one in a shell.'); return; }
  if (await choose(['Leave a whorl in it', 'Leave it'], true) !== 0) return;
  const i = await listMenu('Leave which whorl?', G.party.map(monLine), { w: 140 });
  if (i < 0) return;
  const [mon] = G.party.splice(i, 1);
  G.shellMons[k] = mon;
  sfx('switch');
  await emote('ouro', 'heart');
  save();
}

/** Every shell with nothing moving in it is taken, on every map. Returns how many went from the map Ouro is on. */
export function sweepAll(): number {
  let here = 0;
  for (const m of Object.values(MAPS)) for (const s of m.shells || []) {
    if (shellGone(m.id, s.id) || shellMon(m.id, s.id)) continue;
    setFlag('shell:' + key(m.id, s.id), 1);
    if (m.id === field.map.id) here++;
  }
  return here;
}

/** High tide washes a fresh empty shell onto every place marked for one. */
export function washAll(): void {
  for (const m of Object.values(MAPS)) for (const s of m.shells || []) if (s.washed) setFlag('shell:' + key(m.id, s.id), 0);
}

// ---------------------------------------------------------------- the tide

/** Called after every turn of the tide, with true when the tide has come in. Chapters count low waters with it. */
export const tideHooks: ((high: boolean) => void | Promise<void>)[] = [];

/** Turns the tide. Going out, the Gleaner walks and the sweep runs. Coming in, shells wash up. */
export async function turnTide(): Promise<void> {
  const goingOut = highTide();
  // Ouro rings the bell. Going out, the water draws off the sand a long way. Coming in, the sea turns far out and starts back.
  bell(goingOut ? 7 : 0);
  sfx('boom');
  await morph(on => setFlag('tide', on !== goingOut ? 1 : 0), [field.x, field.y], 0, false);
  if (goingOut) {
    if (!flag('lowTold')) {
      setFlag('lowTold');
      await hint('(At low tide the sand is open, and stars fall in a line.)');
      await hint('(At low water a shell with nothing moving in it is gone when the shadow passes.)');
      await hint('(You can leave a whorl sitting in a shell. A whorl moves about, so the shell stays.)');
    }
    if (!flag('sweepOver')) {
      await gleanerWalk();
      // The shadow passes, and every empty shell here fades from the sand.
      const m = field.map;
      const going = (m.shells || []).filter(s => shellThere(m.id, s.id) && !shellMon(m.id, s.id));
      for (const s of going) void field.prop('sweep' + s.id, 'C', s.x, s.y, 0);
      sweepAll();
      for (const s of going) void field.unprop('sweep' + s.id, 40);
      if (going.length) { sound('wind'); await wait(44); }
    }
  } else {
    if (!flag('highTold')) { setFlag('highTold'); await hint('(Ring a tide bell to turn the tide. At high tide the low sand is under water.)'); }
    washAll();
  }
  field.spawnWanderers();
  field.playMapMusic();
  for (const h of tideHooks) await h(highTide());
  save();
}

/** A tide bell on a post. */
export function tideBell(x: number, y: number): Spot {
  return { x, y, script: turnTide };
}

menuExtras.push({ label: 'Hand bell', when: () => scaleNow.strand && G.keys.includes('handbell'), run: turnTide });

// ---------------------------------------------------------------- grains and gifts

/** A keeper's star grain. Raises the Strand level cap. */
export async function giveGrain(from: string): Promise<void> {
  G.flags.a2pearls = (G.flags.a2pearls || 0) + 1;
  sfx('level');
  await notice(`${from} gives Ouro a star grain.`);
  save();
}

/** Ouro chooses one whorl to give away for good. Resolves to the whorl given, or null if Ouro backs out. */
export async function chooseGift(prompt: string): Promise<Mon | null> {
  const all = [...G.party, ...G.rack];
  if (!all.length) return null;
  const i = await listMenu(prompt, all.map(monLine), { w: 160 });
  if (i < 0) return null;
  const m = all[i];
  if (await choose([`Give ${m.name}`, 'Not yet'], true, 'It will not come back.') !== 0) return null;
  G.party = G.party.filter(x => x !== m);
  G.rack = G.rack.filter(x => x !== m);
  G.flags.gaveUid = m.uid;
  (G as any).gift = { name: m.name, kind: m.kind };
  save();
  return m;
}

