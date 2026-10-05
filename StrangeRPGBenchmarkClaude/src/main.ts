import { Game } from './game/game';
import { TitleScene } from './scenes/title';
import { SW } from './core/gfx';
import { chapterStart } from './game/presets';
import { CHAPTERS } from './maps';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const game = new Game(canvas);
game.input.attach(window);
game.input.onAny = () => game.audio.unlock();
window.addEventListener('pointerdown', () => game.audio.unlock());

function fit() {
  // Size in device pixels so each game pixel covers a whole number of screen pixels at any page zoom or display scaling.
  const dpr = window.devicePixelRatio || 1;
  const avail = Math.min(window.innerWidth - 32, window.innerHeight - 80) * dpr;
  const scale = Math.max(1, Math.min(Math.round(4 * dpr), Math.floor(avail / SW)));
  canvas.style.width = `${(SW * scale) / dpr}px`;
  canvas.style.height = `${(SW * scale) / dpr}px`;
}
fit();
window.addEventListener('resize', fit);

game.onTitle = () => game.replaceAll(new TitleScene(game));
game.replaceAll(new TitleScene(game));
canvas.focus();

const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;
function loop(now: number) {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP) {
    game.update();
    acc -= STEP;
  }
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

(window as unknown as { duotone: Game }).duotone = game;
const tick = () => new Promise(r => setTimeout(r, 0));
const run = (n: number) => { for (let i = 0; i < n; i++) game.update(); game.draw(); };
(window as unknown as { dbg: unknown }).dbg = {
  battle: (grp: string) => game.run(async s => { await s.battle(grp); }),
  warp: (m: string, mk: string) => game.run(async s => { await s.warp(m, mk); }),
  flag: (k: string, v: boolean | number | string = true) => { game.st.flags[k] = v; game.world?.refresh(game.st); },
  run,
  key: async (code: string, hold = 2, after = 20) => {
    await tick(); window.dispatchEvent(new KeyboardEvent('keydown', { code })); run(hold);
    window.dispatchEvent(new KeyboardEvent('keyup', { code })); run(after); await tick();
  },
  start: (n: number) => {
    game.st = chapterStart(n);
    game.stack = [];
    game.field = null;
    game.greyAll = !!game.st.flags.greyWorld;
    game.loadMap(game.st.map, CHAPTERS[n - 1].startMarker);
    game.push(game.field!);
  },
  state: () => ({ stack: game.stack.map(s => s.constructor.name), busy: game.busy, map: game.st?.map, x: game.st?.x, y: game.st?.y }),
};
