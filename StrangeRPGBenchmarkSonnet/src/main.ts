import { newGame } from './core/party';
import { Game, type Key } from './game/game';
import { SheetScene } from './game/sheet';
import { TitleScene } from './game/title';
import { WorldScene } from './game/world';
import { H, W } from './gfx/screen';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d')!;
const game = new Game();
game.ctx = ctx;
game.img = ctx.createImageData(W, H);
game.input.attach(window);
(window as unknown as { __game: Game }).__game = game;

function fit() {
  // Size in device pixels so each game pixel covers a whole number of screen pixels at any page zoom or display scaling.
  const dpr = window.devicePixelRatio || 1;
  const avail = Math.min(window.innerWidth - 24, window.innerHeight - 150) * dpr;
  const scale = Math.max(2, Math.min(Math.round(6 * dpr), Math.floor(avail / W)));
  canvas.style.width = `${(W * scale) / dpr}px`;
  canvas.style.height = `${(H * scale) / dpr}px`;
}
window.addEventListener('resize', fit);
fit();

document.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
  const k = el.dataset.key as Key;
  const down = (e: Event) => { e.preventDefault(); game.input.press(k); };
  const up = (e: Event) => { e.preventDefault(); game.input.release(k); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
});

const params = new URLSearchParams(location.search);
if (params.has('sheet')) game.push(new SheetScene());
else if (params.has('ch')) {
  game.state = newGame(Math.min(12, Math.max(1, Number(params.get('ch')))));
  game.push(new WorldScene(game));
} else game.push(new TitleScene());

let last = performance.now();
let acc = 0;
function loop(now: number) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    game.tick();
    game.state.stats.playMs += 1000 / 60;
    acc -= 1000 / 60;
  }
  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
