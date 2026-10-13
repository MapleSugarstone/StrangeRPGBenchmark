// A debug auto-player. It follows the game's own goal guidance through the real field, dialogue, and battle code.
// Only the test handle on window starts it.
import { input, type Btn } from '../engine/input';
import { F, blocked, DX, DY, entVisible, tileAt, type Ent } from './field';
import { dlg } from './dialogue';
import { CARD } from './cards';
import { game, goal } from './registry';
import { busy, run } from './script';
import { S, fmax, slotCount } from './state';
import { SHELLS } from '../battle/enemies';
import { autoBattle, battleStep, battleActive } from './battleView';
import type { SenseId } from '../battle/model';

/** Answers for choices whose first option is wrong or is not the route under test. */
const CHOICES: { has: string; pick: string | number }[] = [
  { has: 'It is taken off so that', pick: 'A shell.' },
  { has: 'The more of it you take', pick: 'A memory. Taken.' },
  { has: 'Backward, the current runs', pick: 0 },
  { has: 'The Choice.', pick: 0 },
  { has: 'Then stand.', pick: 'Then stand.' },
];

export const AUTO = { steadied: '', on: false, log: [] as string[], lastKey: '', still: 0, stuck: '', lastMap: '', choices: CHOICES, pick: -1 as number };

function note(s: string): void {
  AUTO.log.push(`[${game.tick}] ${s}`);
  if (AUTO.log.length > 60) AUTO.log.shift();
}

function press(b: Btn): void { input.press(b); }

/** Wears the sturdiest shell held and fills empty concept slots, as a player using the Pilgrim menu would. */
function equip(): void {
  const held = Object.keys(S.shells).filter(k => S.shells[k] > 0 && SHELLS[k]);
  const score = (k: string) => SHELLS[k].armor + SHELLS[k].voidRes * 0.5;
  const best = held.sort((a, b) => score(b) - score(a))[0];
  if (best && (!S.worn || score(best) > score(S.worn))) { S.worn = best; note('wear ' + best); }
  const pref = ['Protection', 'Order', 'Hope', 'Holding On', 'Untranslatable', 'Forgetting', 'Weight', 'Heat'];
  for (const c of [...pref, ...S.concepts]) { if (S.slots.length >= slotCount()) break; if (S.concepts.includes(c) && !S.slots.includes(c)) { S.slots.push(c); note('slot ' + c); } }
}

function chooseOption(): void {
  const opts = dlg.options!;
  const prompt = dlg.pages.map(p => p.lines.join(' ')).join(' ');
  let i = opts.findIndex(o => o.ok !== false);
  const goalAct = goal().act || '';
  if (goalAct.startsWith('wheel:')) { const k = opts.findIndex(o => o.text === goalAct.slice(6)); if (k >= 0) i = k; }
  for (const c of CHOICES) {
    if (!prompt.includes(c.has) && !opts.some(o => o.text.includes(c.has))) continue;
    i = typeof c.pick === 'number' ? c.pick : Math.max(0, opts.findIndex(o => o.text === c.pick));
  }
  if (AUTO.pick >= 0) { i = AUTO.pick; AUTO.pick = -1; }
  dlg.cursor = i;
  note(`choose "${opts[i]?.text}"`);
  press('ok');
}

/** Breadth-first path to (gx, gy) or, when that tile is solid, to a tile next to it. Drifters count as open. */
function pathTo(gx: number, gy: number): { dirs: number[]; adjacent: boolean } | null {
  const w = F.w;
  const key = (x: number, y: number) => y * w + x;
  const goalSolid = blocked(gx, gy, null) && !(F.p.x === gx && F.p.y === gy);
  const prev = new Map<number, [number, number]>();
  const start = key(F.p.x, F.p.y);
  prev.set(start, [-1, -1]);
  const q = [[F.p.x, F.p.y]];
  let end = -1;
  while (q.length) {
    const [x, y] = q.shift()!;
    const k = key(x, y);
    if (goalSolid ? Math.abs(x - gx) + Math.abs(y - gy) === 1 : x === gx && y === gy) { end = k; break; }
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= F.w || ny >= F.h) continue;
      const isGoal = nx === gx && ny === gy;
      if (!isGoal && blocked(nx, ny, null)) continue;
      const t = tileAt(nx, ny);
      if (!isGoal && t?.harm) continue;
      if (!isGoal && F.ents.some(e => entVisible(e) && e.x === nx && e.y === ny && (e.def.door || e.def.touch))) continue;
      const [rx, ry] = isGoal ? [nx, ny] : carried(nx, ny, d);
      const nk = key(rx, ry);
      if (prev.has(nk)) continue;
      prev.set(nk, [k, d]);
      q.push([rx, ry]);
    }
  }
  if (end < 0) return null;
  const dirs: number[] = [];
  for (let k = end; k !== start; ) { const [p, d] = prev.get(k)!; dirs.unshift(d); k = p; }
  return { dirs, adjacent: goalSolid };
}

const DIR_BTN: Btn[] = ['down', 'left', 'right', 'up'];

/** Where a step really ends: currents and belts carry the walker on, and a gravity well slides it to a wall. */
function carried(x: number, y: number, d: number): [number, number] {
  for (let n = 0; n < 40; n++) {
    const t = tileAt(x, y);
    let dx = 0, dy = 0;
    if (t?.push) [dx, dy] = t.push; else if (t?.well) { dx = DX[d]; dy = DY[d]; } else break;
    if (blocked(x + dx, y + dy, null)) break;
    x += dx; y += dy;
  }
  return [x, y];
}

function faceToward(x: number, y: number): number { return x < F.p.x ? 1 : x > F.p.x ? 2 : y < F.p.y ? 3 : 0; }

function entAt(x: number, y: number): Ent | undefined { return F.ents.find(e => entVisible(e) && e.x === x && e.y === y); }

/** Does what the goal says once the Pilgrim stands next to or on the target. */
function act(g: { x: number; y: number; act?: string }): void {
  const a = g.act || 'talk';
  const d = faceToward(g.x, g.y);
  if (F.p.dir !== d && !(F.p.x === g.x && F.p.y === g.y)) { input.hold(DIR_BTN[d], true); return; }
  const e = entAt(g.x, g.y);
  if (a === 'talk') { press('ok'); note(`talk ${e?.def.id || g.x + ',' + g.y}`); return; }
  if (a.startsWith('sense:')) { F.onSense?.(a.slice(6) as SenseId); note(`sense ${a.slice(6)}`); return; }
  if (a.startsWith('rename:')) {
    const name = a.slice(7);
    const fn = e?.def.rename?.[name];
    if (fn && (S.names[name] || 0) > 0) { S.names[name]--; run(fn); note(`rename ${name}`); }
    else note(`cannot rename ${name}`);
    return;
  }
  if (a.startsWith('wheel:')) { press('ok'); return; }
  if (a === 'step') { input.hold(DIR_BTN[d], true); return; }
}

/** One frame of auto-play. Call before the game's update. */
export function autoTick(): void {
  if (!AUTO.on) return;
  if (CARD.active) { if (game.tick % 20 === 0) press('ok'); return; }
  if (game.mode === 'title') { if (game.tick % 30 === 0) press('ok'); return; }
  if (game.mode === 'menu') { press('back'); return; }
  if (dlg.active) {
    if (dlg.options && dlg.typedOut()) { if (game.tick % 6 === 0) chooseOption(); return; }
    if (dlg.typedOut() || game.tick % 4 === 0) press('ok');
    return;
  }
  if (game.mode === 'battle') {
    const st = battleStep();
    if (st === 'won' || st === 'lost') { if (game.tick % 10 === 0) press('ok'); return; }
    if (battleActive()) { press('fast'); input.hold('fast', true); autoBattle(); }
    return;
  }
  input.hold('fast', false);
  if (game.mode !== 'field' || busy() || F.p.move || !F.map) return;
  const g = goal();
  const stamp = `${F.map.id}:${F.p.x},${F.p.y}:${Object.keys(S.flags).length}:${JSON.stringify(S.senses)}:${S.state}`;
  if (stamp === AUTO.lastKey) { if (++AUTO.still > 900) { AUTO.stuck = `${g.text} @ ${stamp}`; AUTO.on = false; note('STUCK ' + AUTO.stuck); } }
  else { AUTO.still = 0; AUTO.lastKey = stamp; }
  if (F.map.id !== AUTO.lastMap) { AUTO.lastMap = F.map.id; note(`map ${F.map.id}`); }
  if (g.map !== F.map.id || g.x === undefined || g.y === undefined) {
    if (g.act === 'wait') return;
    AUTO.stuck = `no route: ${g.text} (on ${F.map.id})`;
    AUTO.on = false;
    note('STUCK ' + AUTO.stuck);
    return;
  }
  let gx = g.x, gy = g.y!;
  let todo = g.act;
  const fm = fmax();
  if (S.f < fm * 0.35) {
    const mem = Object.keys(S.memories).find(k => S.memories[k] > 0);
    if (mem) { S.memories[mem]--; S.f = Math.min(fm, S.f + Math.round(fm * 0.25)); note('absorb memory'); return; }
  }
  equip();
  const fresh = AUTO.steadied !== F.map.id && F.ents.some(e => e.def.steady && entVisible(e));
  if (fresh && S.steady.map === F.map.id) AUTO.steadied = F.map.id;
  if (fresh || S.f < fm * 0.5 || S.f > fm * 0.8) {
    const st = F.ents.find(e => e.def.steady && entVisible(e) && pathTo(e.x, e.y));
    if (st && (fresh || Math.abs(S.f - fm * 0.6) > 2)) { gx = st.x; gy = st.y; todo = 'talk'; }
  }
  const here = F.p.x === gx && F.p.y === gy;
  const p = pathTo(gx, gy);
  if (!p) { AUTO.stuck = `no path to ${gx},${gy}: ${g.text}`; AUTO.on = false; note('STUCK ' + AUTO.stuck); return; }
  if (p.dirs.length === 0) { act({ x: gx, y: gy, act: todo }); return; }
  if (here) return;
  const d = p.dirs[0];
  if (p.dirs.length === 1 && todo !== 'step' && !p.adjacent) { act({ x: gx, y: gy, act: todo }); return; }
  input.hold(DIR_BTN[d], true);
  for (const b of DIR_BTN) if (b !== DIR_BTN[d]) input.hold(b, false);
}

/** Releases held directions after the frame. */
export function autoAfter(): void {
  if (!AUTO.on) return;
  for (const b of DIR_BTN) input.hold(b, false);
}
