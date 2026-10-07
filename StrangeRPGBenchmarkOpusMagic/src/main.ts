// Boots the game and runs a fixed 60 frames per second loop.
import { initAudio, toggleMute } from './engine/audio';
import { endFrame, initInput, inTextMode, tapped } from './engine/input';
import { fit, focusCanvas, present } from './engine/screen';
import { app } from './game/app';
import { game } from './game/game';
import { music } from './engine/music';
import './engine/sprites16';
import './engine/sprites2';
import './game/reeling';

fit();
window.addEventListener('resize', fit);
initInput();
window.addEventListener('keydown', () => initAudio());
window.addEventListener('pointerdown', () => { initAudio(); focusCanvas(); });
focusCanvas();

game.boot();

function tick() {
  app.frame++;
  app.t += 1 / 60;
  if (!inTextMode() && tapped('mute')) toggleMute();
  try { app.update(); } catch (e) { console.error(e); }
  endFrame();
}

// Debug handle for automated play-testing: rote.step(n) advances n frames without the animation loop.
(window as unknown as { rote: unknown }).rote = {
  app, game, music,
  step(n = 1) { for (let i = 0; i < n; i++) tick(); app.draw(); present(); },
};

let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;

function loop(now: number) {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP) {
    acc -= STEP;
    tick();
  }
  try { app.draw(); } catch (e) { console.error(e); }
  present();
  updateTitle();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

let lastTitle = '';
function updateTitle() {
  const s = app.s;
  const again = s.chapter === 6 && !s.flags.c6_won ? (app.beat() ? 'again' : 'Rote') : 'Rote';
  if (again !== lastTitle) { document.title = again; lastTitle = again; }
}
