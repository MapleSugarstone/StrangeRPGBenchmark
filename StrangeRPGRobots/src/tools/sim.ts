// Balance simulator: plays every map encounter many times with scripted parties and reports win rates and
// fun metrics. Progress goes to Notes/sim-progress.txt every few seconds. Create Notes/sim.stop to end
// early; the report covers everything finished so far.
//   node dist-tools/sim.js [runs] [filter] [--profile careful|rush|poor] [--diff runner]
import fs from 'node:fs';
import path from 'node:path';
import { ALL_MAPS } from '../content/maps/index';
import { registerMaps, MAPS, type MapDef, type EncounterDef } from '../world/map';
import '../content/register';
import { setSave, blankSave, G, type Difficulty } from '../game/state';
import { makeMember, maxHp } from '../rules/stats';
import { buildCompanion } from '../content/companions';
import { WORLD, loadWorld, walkable } from '../world/world';
import { findPath } from '../world/path';
import { spawnEncounters, F } from '../world/field';
import { CB } from '../combat/core';
import { startCombat } from '../combat/combat';
import { sheetFor } from '../art/cast';
import { T } from '../world/tiles';
import type { Actor } from '../world/world';
import { ENEMY } from '../rules/data';
import { CLASSES } from '../rules/data';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 60);
const filter = args.find((a) => !/^\d+$/.test(a) && !a.startsWith('--') && !['careful', 'rush', 'poor', 'story', 'runner', 'flatline'].includes(a));
const profArg = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : null;
const diff = (args.includes('--diff') ? args[args.indexOf('--diff') + 1] : 'runner') as Difficulty;
const NOTES = path.resolve('Notes');
const PROGRESS = path.join(NOTES, 'sim-progress.txt');
const STOP = path.join(NOTES, 'sim.stop');

registerMaps(ALL_MAPS);

/** Party and level by chapter, for encounters that name their chapter with `ch` in the id or by map. */
const PARTY_BY_CH: Record<number, { level: number; members: string[] }> = {
  1: { level: 1, members: ['courtesy', 'sallis'] },
  2: { level: 3, members: ['courtesy', 'sallis', 'quaye'] },
  3: { level: 5, members: ['courtesy', 'quaye', 'tova'] },
  4: { level: 6, members: ['ambrose', 'quaye', 'tova'] },
  5: { level: 8, members: ['courtesy', 'ambrose', 'tova'] },
  6: { level: 9, members: ['courtesy', 'quaye', 'tova'] },
};

function chapterOf(def: MapDef, e: EncounterDef): number {
  if (e.simLevel !== undefined) return e.simLevel <= 2 ? 1 : e.simLevel <= 4 ? 2 : e.simLevel <= 5 ? 3 : e.simLevel <= 7 ? 4 : e.simLevel <= 8 ? 5 : 6;
  const m = (e.id + ' ' + def.id).match(/ch(\d)/);
  if (m) return Number(m[1]);
  const lv = Math.max(...e.units.map((u) => u.level ?? ENEMY.get(u.kind)?.level ?? 1));
  return lv <= 1 ? 1 : lv <= 3 ? 2 : lv <= 5 ? 3 : lv <= 7 ? 4 : lv <= 8 ? 5 : 6;
}

function setupParty(ch: number, heroCls: 'blade' | 'diver' | 'rigger' | 'mouth', members?: string[], level?: number) {
  const s = blankSave();
  s.difficulty = diff;
  setSave(s);
  const base = PARTY_BY_CH[ch] ?? PARTY_BY_CH[1];
  const p = { level: level ?? base.level, members: members ?? base.members };
  G.roster.hero = makeMember('hero', 'Hero', heroCls, p.level);
  G.party = ['hero'];
  for (const id of p.members) { G.roster[id] = buildCompanion(id, p.level); G.party.push(id); }
  for (const m of Object.values(G.roster)) m.hp = maxHp(m);
  G.items = { stim: 3, frag: 1 };
  G.chapter = ch;
  G.flags.port_powers = ch >= 4 ? 1 : 0;
}

/** Puts the party on open tiles 5 to 8 tiles from the encounter, on the side with the most room. */
function placeParty(e: EncounterDef): boolean {
  const cx = Math.round(e.units.reduce((s, u) => s + u.at[0], 0) / e.units.length);
  const cy = Math.round(e.units.reduce((s, u) => s + u.at[1], 0) / e.units.length);
  const taken = new Set(e.units.map((u) => `${u.at[0]},${u.at[1]}`));
  const spots: [number, number][] = [];
  for (let r = 5; r <= 9 && spots.length < G.party.length; r++) {
    for (let dy = -r; dy <= r && spots.length < G.party.length; dy++) for (let dx = -r; dx <= r && spots.length < G.party.length; dx++) {
      if (Math.abs(dx) + Math.abs(dy) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (!walkable(x, y) || taken.has(`${x},${y}`)) continue;
      if (!spots.length && !e.units.some((u) => { const p = findPath(x, y, u.at[0], u.at[1], { adjacent: true }); return p && p.length <= 16; })) continue;
      if (spots.length && Math.abs(spots[0][0] - x) + Math.abs(spots[0][1] - y) > 3) continue;
      spots.push([x, y]);
      taken.add(`${x},${y}`);
    }
  }
  if (spots.length < G.party.length) return false;
  G.party.forEach((id, i) => {
    const [x, y] = spots[i];
    const a: Actor = { id, name: id, sheet: sheetFor(id === 'hero' ? 'crowd:1' : id), tx: x, ty: y, px: x * T, py: y * T, dir: 'down', anim: 0, moving: false, path: [], speed: 6, role: 'party', idle: 0, visible: true, lift: 0, alert: 0 };
    WORLD.actors.push(a);
  });
  return true;
}

interface Row { id: string; ch: number; n: number; wins: number; rounds: number; hpLeft: number; downed: number; close: number; variety: number; env: number; dead: number; skipped?: string }

let seed = 12345;
function rng() { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return seed / 4294967296; }

async function runOne(def: MapDef, e: EncounterDef, ch: number, cls: 'blade' | 'diver' | 'rigger' | 'mouth'): Promise<{ win: boolean; rounds: number; hpLeft: number; downed: number; close: boolean; variety: number; env: number; dead: number } | null> {
  setupParty(ch, cls, e.simParty, e.simLevel);
  loadWorld(def);
  F.inCombat = false;
  for (const x of def.encounters ?? []) G.defeated.push(`${def.id}:${x.id}`);
  G.defeated = G.defeated.filter((d) => d !== `${def.id}:${e.id}`);
  const keepShow = e.showIf, keepHide = e.hideIf;
  e.showIf = undefined; e.hideIf = undefined;
  spawnEncounters(def);
  e.showIf = keepShow; e.hideIf = keepHide;
  if (!placeParty(e)) return null;
  CB.sim = true;
  CB.rng = rng;
  const win = await startCombat([e.id], false);
  const party = CB.units.filter((u) => u.member);
  const hp = party.reduce((s, u) => s + Math.max(0, u.hp) / u.maxHp, 0) / party.length;
  const downed = party.filter((u) => u.downed).length;
  const st = CB.stats;
  return { win, rounds: CB.round, hpLeft: hp, downed, close: st.closeCall || party.some((u) => u.hp > 0 && u.hp < u.maxHp * 0.2), variety: st.actions ? 1 - st.plain / st.actions : 0, env: st.env, dead: 0 };
}

async function main() {
  fs.mkdirSync(NOTES, { recursive: true });
  try { fs.unlinkSync(STOP); } catch { /* none */ }
  const jobs: { def: MapDef; e: EncounterDef }[] = [];
  for (const def of MAPS.values()) for (const e of def.encounters ?? []) if (e.units.length && (!filter || `${def.id}:${e.id}`.includes(filter))) jobs.push({ def, e });
  const profiles = profArg ? [profArg] : ['careful'];
  const classes: ('blade' | 'diver' | 'rigger' | 'mouth')[] = ['blade', 'diver', 'rigger', 'mouth'];
  const rows: Row[] = [];
  const t0 = Date.now();
  let lastWrite = 0;
  let done = 0, total = jobs.length * runs;
  let stopped = false;
  for (const { def, e } of jobs) {
    const ch = chapterOf(def, e);
    const row: Row = { id: `${def.id}:${e.id}`, ch, n: 0, wins: 0, rounds: 0, hpLeft: 0, downed: 0, close: 0, variety: 0, env: 0, dead: 0 };
    for (let i = 0; i < runs; i++) {
      if (fs.existsSync(STOP)) { stopped = true; break; }
      const r = await runOne(def, e, ch, classes[i % 4]);
      done++;
      if (!r) { row.skipped = 'no room for the party'; break; }
      row.n++;
      if (r.win) row.wins++;
      row.rounds += r.rounds; row.hpLeft += r.hpLeft; row.downed += r.downed; row.close += r.close ? 1 : 0; row.variety += r.variety; row.env += r.env;
      if (Date.now() - lastWrite > 3000) {
        lastWrite = Date.now();
        const el = (Date.now() - t0) / 1000;
        const eta = done ? el / done * (total - done) : 0;
        fs.writeFileSync(PROGRESS, `${done}/${total} fights, ${el.toFixed(0)}s elapsed, about ${eta.toFixed(0)}s left\ncurrent: ${row.id}\n` + rows.map(fmt).join('\n') + '\n');
      }
    }
    rows.push(row);
    if (stopped) break;
  }
  void profiles; void CLASSES;
  const head = `Fathom balance, ${diff}, ${runs} runs per fight${stopped ? ` (PARTIAL: stopped after ${done} fights)` : ''}`;
  const out = [head, 'fight | ch | win% | rounds | hp left | downed/fight | close% | variety | env/fight', ...rows.map(fmt)].join('\n');
  console.log(out);
  fs.writeFileSync(path.join(NOTES, 'sim-report.txt'), out + '\n');
  fs.writeFileSync(PROGRESS, `done: ${done}/${total}${stopped ? ' (stopped)' : ''}\n`);
}

function fmt(r: Row): string {
  if (r.skipped) return `${r.id} | ${r.ch} | skipped: ${r.skipped}`;
  const n = Math.max(1, r.n);
  return `${r.id} | ${r.ch} | ${(100 * r.wins / n).toFixed(0)} | ${(r.rounds / n).toFixed(1)} | ${(100 * r.hpLeft / n).toFixed(0)}% | ${(r.downed / n).toFixed(2)} | ${(100 * r.close / n).toFixed(0)} | ${(100 * r.variety / n).toFixed(0)}% | ${(r.env / n).toFixed(2)}`;
}

void main();
