// Playtest helpers on window.__h. They drive the real game loop one fixed step at a time.
import { choose as aiChoose } from '../battle/ai';
import type { Btn } from '../engine/input';
import { input } from '../engine/input';
import { drawAll, modes, tickAll, top } from './modes';
import { field } from './field';
import { G, fresh, setGame } from './state';
import { replaceAll } from './modes';
import { makeMon } from '../data/species';
import { startMenu } from './menus';
import './uicheck';

const flush = async () => { for (let k = 0; k < 10; k++) await Promise.resolve(); };

export const harness = {
  async run(n: number): Promise<void> {
    for (let i = 0; i < n; i++) { const m = top(); if (m) m.update(); tickAll(); input.end(); await flush(); }
    drawAll();
  },
  async tap(b: Btn): Promise<void> { input.press(b); await harness.run(4); },
  /** Presses Z through dialogue until the field is free again. Picks option `pick` at choices. */
  async talk(max = 80, pick = 0): Promise<number> {
    for (let i = 0; i < max; i++) {
      if (modes().length <= 1 && !field.busy) return i;
      const t: any = top();
      if (t && t.constructor && t.constructor.name !== 'Field' && t.b && t.phase) { await harness.battle(); continue; }
      if (t && t.__choice !== undefined) { for (let k = 0; k < pick; k++) await harness.tap('down'); }
      await harness.tap('ok');
    }
    return -1;
  },
  /** Plays the current battle with the AI choosing for Vellum. */
  async battle(max = 400): Promise<string> {
    for (let i = 0; i < max; i++) {
      const v: any = top();
      if (!v || !v.b) return 'done';
      if (v.phase === 'menu') { const a = aiChoose(v.b); v.commit(a); await harness.run(2); continue; }
      if (v.phase === 'replace') { await harness.tap('ok'); continue; }
      if (v.phase === 'target' || v.phase === 'tagto' || v.phase === 'switch' || v.phase === 'peg') { await harness.tap('ok'); continue; }
      await harness.tap('ok');
    }
    return 'timeout';
  },
  async step(d: Btn): Promise<void> {
    input.hold(d, true); await harness.run(1); input.hold(d, false);
    for (let i = 0; i < 40 && field.moving > 0; i++) await harness.run(1);
    await harness.run(2);
  },
  async walkTo(tx: number, ty: number): Promise<string> {
    const f = field;
    const key = (x: number, y: number) => x + ',' + y;
    const prev = new Map<string, [number, number] | null>();
    const q: [number, number][] = [[f.x, f.y]];
    prev.set(key(f.x, f.y), null);
    const D: [number, number, Btn][] = [[0, 1, 'down'], [1, 0, 'right'], [0, -1, 'up'], [-1, 0, 'left']];
    while (q.length) {
      const [x, y] = q.shift()!;
      if (x === tx && y === ty) break;
      for (const [dx, dy] of D) {
        const nx = x + dx, ny = y + dy;
        if (prev.has(key(nx, ny))) continue;
        if (!(nx === tx && ny === ty) && !f.passable(nx, ny)) continue;
        if (!(nx === tx && ny === ty) && f.map.warps.some(w => w.x === nx && w.y === ny)) continue;
        prev.set(key(nx, ny), [x, y]);
        q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return 'no path';
    const path: [number, number][] = [];
    let cur: [number, number] = [tx, ty];
    while (prev.get(key(cur[0], cur[1]))) { const p = prev.get(key(cur[0], cur[1]))!; path.unshift([cur[0] - p[0], cur[1] - p[1]]); cur = p; }
    for (const [dx, dy] of path) {
      const d = D.find(e => e[0] === dx && e[1] === dy)![2];
      const m0 = f.map.id;
      await harness.step(d);
      if (modes().length > 1 || f.busy || f.map.id !== m0) return `stopped ${f.map.id} ${f.x},${f.y}`;
    }
    return 'ok';
  },
  /** Walks to a tile, fighting through anything that stops the walk, until standing on it or warped away. */
  async go(x: number, y: number, tries = 8): Promise<string> {
    const m0 = field.map.id;
    for (let i = 0; i < tries; i++) {
      const r = await harness.walkTo(x, y);
      await harness.talk(300);
      if (field.map.id !== m0) return 'warped ' + harness.where();
      if (field.x === x && field.y === y) return 'ok';
      if (r === 'no path') return r;
    }
    return 'stuck ' + harness.where();
  },
  /** Talks to whatever is in direction d (0 down, 1 right, 2 up, 3 left), then plays it out. */
  async use(d: number): Promise<void> { field.dir = d; await harness.run(1); input.press('ok'); await harness.run(3); await harness.talk(400); },
  face(d: number): void { field.dir = d; },
  where(): string { return `${field.map.id} ${field.x},${field.y} busy${field.busy} modes${modes().length}`; },
  G: () => G,
  setup(scales: string[], flags: Record<string, number>, kinds: string[], lv: number, map: string, x: number, y: number, pulled: string[] = []): void {
    try { localStorage.clear(); } catch { /* ignore */ }
    setGame(fresh());
    replaceAll(field);
    field.busy = 0;
    field.menuOpener = startMenu;
    G.scales = scales.slice(); G.pulled = pulled.slice();
    Object.assign(G.flags, { morning: 1, slipday: 1, night: 1, starter: 1, tack1: 1, sg: 3, nerve: scales.length >= 2 ? 1 : 0 }, flags);
    G.party = kinds.map(k => makeMon(k, lv)); G.pegs.brass = 10; G.rind = 5000;
    for (const k of kinds) G.register[k] = 2;
    field.load(map, x, y, 0);
  },
};
(window as any).__h = harness;
