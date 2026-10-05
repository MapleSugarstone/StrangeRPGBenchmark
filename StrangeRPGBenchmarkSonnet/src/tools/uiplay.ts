// Drives the real game scenes (world, dialogue, battle, menus) with an autopilot and no browser.
import { chooseAction } from '../core/bots';
import { newGame } from '../core/party';
import { Rng } from '../core/rng';
import { shop } from '../sim/simlib';
import { BattleScene } from '../game/battlescene';
import { Game, type Key } from '../game/game';
import { ItemsScene, EquipScene, JournalScene, MainMenu, PartyScene, ShopScene, StatusScene } from '../game/menus';
import { TitleScene } from '../game/title';
import { WorldScene } from '../game/world';
import { EndingScene } from '../game/ending';

// Timers used for pacing in the UI resolve immediately.
(globalThis as unknown as { setTimeout: (f: () => void) => void }).setTimeout = (f: () => void) => { setImmediate(f); };

type AnyScene = Record<string, unknown> & { mode?: string; b?: { actor: unknown; over: unknown }; commit?: (a: unknown) => void };

function bfs(w: WorldScene, tx: number, ty: number): { dx: number; dy: number } | null {
  const key = (x: number, y: number) => y * w.map.w + x;
  const prev = new Map<number, number>();
  const q: [number, number][] = [[w.x, w.y]];
  prev.set(key(w.x, w.y), -1);
  const gateOpen = (x: number, y: number) => w.map.gates.some((g) => g.x === x && g.y === y && (w as unknown as { g: Game }).g.state.beat >= g.beat);
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w.map.w || ny >= w.map.h || prev.has(key(nx, ny))) continue;
      const t = w.map.grid[ny][nx];
      if (t.solid && !(t.k === 'gate' && gateOpen(nx, ny))) continue;
      if (w.map.npcs.some((n) => n.x === nx && n.y === ny)) continue;
      prev.set(key(nx, ny), key(x, y));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  let cur = key(tx, ty);
  let p = prev.get(cur)!;
  while (p !== -1 && prev.get(p) !== -1) { cur = p; p = prev.get(cur)!; }
  const cx = cur % w.map.w, cy = Math.floor(cur / w.map.w);
  return { dx: cx - w.x, dy: cy - w.y };
}

export interface UiResult { ended: boolean; frames: number; chapters: number; battles: number; error?: string; stuck?: string }

export async function uiPlay(startChapter: number, seed: number, maxFrames = 400000, exercise = true): Promise<UiResult> {
  const g = new Game();
  g.rng = new Rng(seed);
  g.state = newGame(startChapter);
  const botRng = new Rng(seed + 9);
  const world = new WorldScene(g);
  g.push(world);
  let frames = 0;
  let lastProgress = 0;
  let lastKey = '';
  const snapshot = () => `${g.state.chapter}:${g.state.beat}:${world.x}:${world.y}:${g.overlays.length}:${g.scenes.length}:${(g.top as unknown as AnyScene).mode ?? ''}`;
  const uiTests = exercise ? [new ItemsScene(), new EquipScene(), new PartyScene(), new StatusScene(), new JournalScene(), new ShopScene()] : [];
  let exercised = false;
  let lastCh = 0;

  try {
    while (frames < maxFrames) {
      frames++;
      const top = g.top as unknown as AnyScene;
      const press = (k: Key) => { g.input.press(k); g.input.release(k); };

      if (g.overlays.length) { if (frames % 3 === 0) press('a'); }
      else if (top instanceof EndingScene) return { ended: true, frames, chapters: g.state.chapter, battles: g.state.stats.battles };
      else if (top instanceof BattleScene) {
        const bs = top as unknown as BattleScene;
        if (bs.mode === 'cmd') {
          if (exercise && frames % 7 === 0) { press('down'); press('up'); }
          const a = chooseAction(bs.b, 'smart', botRng);
          (bs as unknown as { commit: (x: unknown) => void }).commit(a);
        } else if (bs.mode === 'result' || bs.mode === 'defeat') { if (frames % 3 === 0) press('a'); }
      } else if (top instanceof WorldScene) {
        if (!world.busy && !world.moving) {
          if (exercise && !exercised && g.state.chapter >= 2 && g.state.beat >= 2) {
            exercised = true;
            for (const s of [new MainMenu(world), ...uiTests]) {
              g.push(s);
              for (let i = 0; i < 40; i++) {
                for (const k of ['down', 'a', 'up', 'left', 'right', 'b'] as Key[]) { g.input.press(k); g.tick(); g.render(); }
              }
              while (g.top !== world) g.pop();
            }
          }
          const b = g.state.beat;
          if (b < 8 && b > 0) {
            const t = world.map.beatSpot[b];
            const step = bfs(world, t.x, t.y);
            if (step) { g.input.held.clear(); if (step.dx || step.dy) g.input.held.add(step.dx > 0 ? 'right' : step.dx < 0 ? 'left' : step.dy > 0 ? 'down' : 'up'); }
            else return { ended: false, frames, chapters: g.state.chapter, battles: g.state.stats.battles, stuck: `no path to beat ${b + 1} in chapter ${g.state.chapter}` };
          } else g.input.held.clear();
        } else g.input.held.clear();
      } else if (top instanceof TitleScene) return { ended: false, frames, chapters: g.state.chapter, battles: g.state.stats.battles, stuck: 'returned to title' };
      else if (frames % 3 === 0) press('b');

      g.tick();
      if (frames % 12 === 0) g.render();
      if (frames % 500 === 0 || (world.busy && !g.overlays.length && g.top === world)) await new Promise((r) => setImmediate(r));
      if (g.state.chapter !== lastCh) { lastCh = g.state.chapter; shop(g.state, lastCh); if (process.env.CH) console.log(`chapter ${lastCh} at frame ${frames}: battles ${g.state.stats.battles}, wipes ${g.state.stats.wipes}, avg level ${(g.state.roster.reduce((a, m) => a + m.lvl, 0) / g.state.roster.length).toFixed(1)}`); }
      const snap = snapshot();
      if (snap !== lastKey) { lastKey = snap; lastProgress = frames; if (process.env.TRACE) console.log(frames, snap); }
      if (frames - lastProgress > 6000) return { ended: false, frames, chapters: g.state.chapter, battles: g.state.stats.battles, stuck: `stuck at ${snap}` };
    }
  } catch (e) {
    return { ended: false, frames, chapters: g.state.chapter, battles: g.state.stats.battles, error: (e as Error).stack ?? String(e) };
  }
  return { ended: false, frames, chapters: g.state.chapter, battles: g.state.stats.battles, stuck: 'frame budget exhausted' };
}

if (process.argv[1]?.endsWith('uiplay.js')) {
  const start = Number(process.argv[2] ?? 1);
  const seed = Number(process.argv[3] ?? 1);
  const r = await uiPlay(start, seed);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ended ? 0 : 1);
}
