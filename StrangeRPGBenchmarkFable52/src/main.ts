import { present } from './gfx/screen';
import { G, stepView } from './ui/game';
import { input, tickFrame, widgets } from './ui/core';
import { app, baseDraw } from './ui/meta';
import { battleShown, drawBattle } from './ui/battleview';
import { initAudio } from './audio/audio';
import { apply, legal } from './rules/engine';
import { decide } from './rules/ai';
import { counts, standing } from './rules/board';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
input.attach(canvas);

function fit(): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 256));
  canvas.style.width = 256 * scale + 'px';
  canvas.style.height = 256 * scale + 'px';
}
window.addEventListener('resize', fit);
fit();
canvas.focus();

const main = app();

function update(): void {
  G.waiting = false;
  main.next();
  stepView();
  tickFrame();
  input.endFrame();
}

function draw(): void {
  baseDraw();
  if (battleShown()) drawBattle();
  for (const w of widgets) w.draw();
  present(ctx);
}

let last = performance.now(), acc = 0;
function loop(now: number): void {
  acc += Math.min(100, now - last);
  last = now;
  let n = 0;
  while (acc >= 1000 / 60 && n < 5) { update(); acc -= 1000 / 60; n++; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

initAudio(canvas);

/** A debug handle for the browser test harness. `step` runs update ticks synchronously, then draws once. */
(window as unknown as { game: unknown }).game = {
  G, input, widgets, apply, legal, decide, counts, standing,
  step(n: number) { for (let i = 0; i < n; i++) update(); draw(); },
};
