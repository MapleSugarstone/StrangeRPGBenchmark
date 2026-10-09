// Offline check of the score. Renders ten minutes of every track in Node and checks ranges, channels, gains, and repetition.
import { BASE, MAX_CHANNELS, TRI_FLOOR, channels, foldBass, music, renderTrack, trackDef } from '../engine/music';
import type { Note, Rendered } from '../engine/music';
import { BATTLE_TRACKS, ONCE_TRACKS, SG_GAIN, SG_RATIO, SMALL_GRAN, TRACKS } from '../engine/score';
import type { Voice } from '../engine/score';

declare const process: { exitCode: number };

const REQUIRED = [
  'splash', 'title', 'home', 'fellside', 'route', 'town', 'gym', 'minigame', 'battle', 'wild', 'keeper', 'rival', 'legend',
  'battleHand', 'battleCinch', 'battlePeel', 'drysea', 'marsh', 'spire', 'wood', 'machine', 'hum', 'bare', 'tundra', 'tusk',
  'tallow', 'hiltroad', 'peel', 'moonwater', 'crater', 'fall', 'climb', 'crown', 'slack', 'oldrind', 'stack', 'credits', 'cave',
  'strand', 'sanddollar', 'cowrie', 'auger', 'nautilus', 'tray', 'conch', 'collector', 'cinchReal', 'wildStrand', 'keeperStrand',
  'starfall', 'credits2',
  'cove', 'brook', 'highwater', 'saltings', 'shout', 'kelp', 'gantry', 'floes', 'shingle', 'longway', 'gatering', 'holm', 'gempuzzle', 'geode',
];
/** The last section of each track that plays once. */
const LAST: Record<string, string> = { credits: 'end', credits2: 'shell' };
/** Pitch class of the degree Ouro lacks in the Collector's key (A-flat aeolian: C-flat). */
const COLLECTOR_MISSING = 11;
const RANGE: Record<Voice, [number, number]> = { p1: [45, 98], p2: [45, 96], tri: [28, 66], bell: [38, 100], air: [40, 86], nz: [0, 127] };
const MONO: Voice[] = ['p1', 'p2', 'tri', 'nz', 'air'];
const LEVELS = [0, 0.3, 0.45, 0.5, 0.6, 0.75, 0.85, 1];
const SECONDS = 600;
const SEEDS = [1, 2, 3];
const MAX_REPEAT = 4;
const MAX_LEVEL = 0.6;
const MAX_SUM = 1.6;

const fails: string[] = [];
const warns: string[] = [];
const fail = (s: string) => { if (fails.length < 400) fails.push(s); };

const active = (n: Note, x: number) => (n.lay ?? 0) <= x && x < (n.top ?? 2);

function checkSection(id: string, s: Rendered, mix: Partial<Record<Voice, number>>): number {
  let worst = 0;
  for (const n of s.notes) {
    const [lo, hi] = RANGE[n.v];
    if (n.v !== 'nz' && (n.n < lo || n.n > hi)) fail(`${id}/${s.name}: ${n.v} pitch ${n.n} outside ${lo}..${hi}`);
    if (!(n.g > 0 && n.g <= 1)) fail(`${id}/${s.name}: gain ${n.g}`);
    if (n.g * BASE[n.v] * (mix[n.v] ?? 1) > MAX_LEVEL) fail(`${id}/${s.name}: ${n.v} level ${(n.g * BASE[n.v] * (mix[n.v] ?? 1)).toFixed(2)}`);
    if (!(n.dur > 0) || !Number.isFinite(n.at)) fail(`${id}/${s.name}: bad timing`);
  }
  for (const x of LEVELS) {
    const on = s.notes.filter((n) => active(n, x)).sort((a, b) => a.at - b.at);
    for (const v of MONO) {
      const list = on.filter((n) => n.v === v);
      for (let i = 1; i < list.length; i++) if (list[i - 1].at + list[i - 1].dur > list[i].at + 1e-6) { fail(`${id}/${s.name}: two notes at once on ${v} at intensity ${x}`); break; }
    }
    for (const n of on) {
      const t = n.at + 1e-6;
      const sounding = on.filter((m) => m.at <= t && m.at + m.dur > t);
      const ch = channels(sounding);
      worst = Math.max(worst, ch);
      if (ch > MAX_CHANNELS) { fail(`${id}/${s.name}: ${ch} channels at intensity ${x}`); break; }
      if (sounding.filter((m) => m.v === 'bell').length > 2) { fail(`${id}/${s.name}: three bell notes at intensity ${x}`); break; }
      const sum = sounding.reduce((a, m) => a + m.g * BASE[m.v] * (mix[m.v] ?? 1), 0);
      if (sum > MAX_SUM) { fail(`${id}/${s.name}: summed level ${sum.toFixed(2)} at intensity ${x}`); break; }
    }
  }
  // At the deepest drop the bass must fold up rather than fall below the floor.
  const low = s.notes.map((n) => ({ v: n.v, n: n.n }));
  foldBass(low, 8);
  for (const n of low) if (n.v === 'tri' && n.n - 8 < TRI_FLOOR) { fail(`${id}/${s.name}: bass ${n.n - 8} below the floor at drop 8`); break; }
  return worst;
}

/** Small Gran's figure must be the same five notes, to the millisecond, everywhere it plays. */
function checkSmallGran(id: string, s: Rendered): number {
  const kept = s.notes.filter((n) => n.k).sort((a, b) => a.at - b.at);
  if (!kept.length) return 0;
  if (kept.length !== SMALL_GRAN.length) { fail(`${id}/${s.name}: Small Gran has ${kept.length} notes`); return 0; }
  const t0 = kept[0].at;
  kept.forEach((n, i) => {
    const [st, len, p] = SMALL_GRAN[i];
    if (Math.abs(n.at - t0 - st) > 0.001 || Math.abs(n.dur - len) > 0.001 || n.n !== p || n.g !== SG_GAIN || n.ratio !== SG_RATIO || n.v !== 'bell' || n.bend || n.det)
      fail(`${id}/${s.name}: Small Gran's line ${i + 1} differs`);
  });
  return 1;
}

function fingerprint(s: Rendered): string {
  return s.name + '|' + s.notes.map((n) => `${n.v}${n.n}@${(n.at - s.start).toFixed(3)}:${n.dur.toFixed(3)}:${n.g.toFixed(3)}:${n.lay ?? 0}:${n.top ?? 2}:${n.nz ?? ''}`).join(',');
}

function main(): void {
  for (const id of REQUIRED) if (!trackDef(id)) fail(`missing track ${id}`);
  for (const id of Object.keys(TRACKS)) {
    const def = trackDef(id)!;
    if (!def.secs[def.start]) fail(`${id}: start section ${def.start} missing`);
    for (const [from, opts] of Object.entries(def.graph ?? {})) for (const [to] of opts) if (!def.secs[to]) fail(`${id}: ${from} leads to missing ${to}`);
  }

  console.log('track          sections  minutes  max ch  capped  max repeat  small gran');
  for (const id of Object.keys(TRACKS)) {
    const def = trackDef(id)!;
    const region = !BATTLE_TRACKS.has(id) && !ONCE_TRACKS.has(id);
    let sections = 0, secs = 0, worst = 0, capped = 0, notes = 0, repeat = 0, gran = 0;
    for (const seed of SEEDS) {
      const ramp = BATTLE_TRACKS.has(id) ? (t: number) => Math.min(1, t / SECONDS) : () => 0;
      const out = renderTrack(id, SECONDS, { seed, intensity: ramp });
      const seen = new Map<string, number>();
      for (const s of out) {
        sections++;
        secs += s.secs;
        capped += s.capped;
        notes += s.notes.length;
        if (s.secs < 0.5) fail(`${id}/${s.name}: section only ${s.secs.toFixed(2)} s`);
        worst = Math.max(worst, checkSection(id, s, def.mix ?? {}));
        gran += checkSmallGran(id, s);
        // The Collector's missing degree may sound only above intensity 0.85, except in quotes from other worlds and in grace notes.
        if (id === 'collector' && s.name !== 'tray') {
          for (const n of s.notes) {
            if (n.v === 'nz' || ((n.n % 12) + 12) % 12 !== COLLECTOR_MISSING || n.dur < 0.15 || (n.lay ?? 0) >= 0.85) continue;
            fail(`collector/${s.name}: the missing degree sounds below intensity 0.85`);
            break;
          }
        }
        const f = fingerprint(s);
        const k = (seen.get(f) ?? 0) + 1;
        seen.set(f, k);
        repeat = Math.max(repeat, k);
      }
      if (ONCE_TRACKS.has(id)) {
        const total = out.reduce((a, s) => a + s.secs, 0);
        if (total >= SECONDS) fail(`${id}: never ends`);
        if (id === 'splash' && (total < 3 || total > 6)) fail(`splash lasts ${total.toFixed(1)} s`);
        if (LAST[id] && out[out.length - 1]?.name !== LAST[id]) fail(`${id} does not end on its ${LAST[id]} section`);
      } else if (out.reduce((a, s) => a + s.secs, 0) < SECONDS - 1) fail(`${id}: stopped before ten minutes`);
    }
    if (region && repeat > MAX_REPEAT) fail(`${id}: one section repeats exactly ${repeat} times in ten minutes`);
    if (!region && repeat > MAX_REPEAT && !ONCE_TRACKS.has(id)) warns.push(`${id}: a section repeats exactly ${repeat} times`);
    const share = notes ? capped / (notes + capped) : 0;
    if (share > 0.05) warns.push(`${id}: the channel limit trimmed ${(share * 100).toFixed(1)}% of notes`);
    console.log(`${id.padEnd(14)} ${String(sections).padStart(8)}  ${(secs / 60 / SEEDS.length).toFixed(1).padStart(7)}  ${String(worst).padStart(6)}  ${(share * 100).toFixed(1).padStart(5)}%  ${String(repeat).padStart(10)}  ${String(gran).padStart(10)}`);
  }

  // The engine must load and answer in Node, where there is no Web Audio.
  try {
    music.play('fellside'); music.play('fellside'); music.play('no such track');
    music.setDrop(8); music.bend(); music.setVolume(0.4); music.setIntensity(0.7); music.update();
    if (!music.finished()) fail('finished() should be true without audio');
    music.stop();
  } catch (e) { fail(`music API threw in Node: ${String(e)}`); }

  for (const w of warns) console.log('warn: ' + w);
  for (const f of fails) console.log('FAIL: ' + f);
  console.log(fails.length ? `${fails.length} failures` : 'music check passed');
  if (fails.length) process.exitCode = 1;
}

main();
