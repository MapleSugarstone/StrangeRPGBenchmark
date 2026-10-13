import { canvas, rect, dither, W, H, clear, screenCtx } from './engine/screen';
import { snapBuffer } from './engine/palette';
import { input } from './engine/input';
import { unlockAudio, setMuted, isMuted, setProgress } from './engine/audio';
import { game, MAPS } from './game/registry';
import { fieldUpdate, fieldDraw, loadMap, F, setFollowers, saveReveal, tileAt, entVisible } from './game/field';
import { battleUpdate, battleDraw } from './game/battleView';
import { dlg } from './game/dialogue';
import { stepScripts, busy, run, clearScripts } from './game/script';
import { menuUpdate, menuDraw, openMenu } from './game/menu';
import { titleUpdate, titleDraw, enterTitle, setTitlePick } from './game/title';
import { cardUpdate, cardDraw, CARD } from './game/cards';
import { installHooks } from './game/hooks';
import { S, setSave, fresh, readSave, writeSave } from './game/state';
import { toast, clearToasts } from './game/ui';
import { UI } from './game/palette';
import { registerContent, OPENING } from './content';
import { battle as battleScript } from './game/api';
import { AVATAR } from './game/art';
import { uiCheck, setUiDraw } from './game/uicheck';
import { AUTO, autoTick, autoAfter } from './game/autoplay';
import { currentBattle, battleStep, battleMotes } from './game/battleView';

registerContent();
installHooks();

setTitlePick(choice => {
  clearScripts();
  clearToasts();
  if (choice === 'continue') {
    const s = readSave();
    if (!s) return;
    setSave(s);
    game.mode = 'field';
    loadMap(S.map, S.x, S.y, S.dir);
    setFollowers();
    setProgress(S.flags.ch5 ? 1 : S.flags.ch4 ? 0.75 : S.flags.year_seen ? 0.55 : S.flags.sea_intro ? 0.4 : 0.1);
    toast('You come back together.', UI.dim);
  } else {
    setSave(fresh('snake'));
    game.mode = 'field';
    run(OPENING);
  }
});

let last = performance.now(), acc = 0;
const STEP = 1000 / 60;

function update(): void {
  game.tick++;
  autoTick();
  if (input.anyKey()) unlockAudio();
  if (input.hit('mute')) { setMuted(!isMuted()); toast(isMuted() ? 'Sound off.' : 'Sound on.', UI.dim); }
  if (CARD.active) { stepScripts(); cardUpdate(); return; }
  switch (game.mode) {
    case 'title': titleUpdate(); break;
    case 'field':
      S.time++;
      stepScripts();
      dlg.update();
      if (game.mode !== 'field') break;
      if (!busy() && !dlg.active && !F.p.move && !F.ring && input.hit('back')) { openMenu(); break; }
      fieldUpdate();
      break;
    case 'battle':
      stepScripts();
      dlg.update();
      battleUpdate();
      break;
    case 'menu': menuUpdate(); break;
    case 'ending': stepScripts(); dlg.update(); break;
  }
}

function draw(): void {
  clear();
  if (CARD.active) { cardDraw(game.tick); overlays(); return; }
  switch (game.mode) {
    case 'title': titleDraw(); break;
    case 'field': fieldDraw(); dlg.draw(); break;
    case 'battle': battleDraw(); dlg.draw(); break;
    case 'menu': fieldDraw(); menuDraw(); break;
    case 'ending': rect(0, 0, W, H, UI.ink); dlg.draw(); break;
  }
  overlays();
}

/** Every frame ends snapped to the master palette, so nothing drawn late escapes it. */
function snapScreen(): void {
  const g = screenCtx();
  const im = g.getImageData(0, 0, W, H);
  snapBuffer(new Uint32Array(im.data.buffer));
  g.putImageData(im, 0, 0);
}

function overlays(): void {
  if (game.fade > 0) dither(0, 0, W, H, UI.ink, game.fade);
  if (game.flash > 0) { dither(0, 0, W, H, game.flashColor, Math.min(1, game.flash / 8)); game.flash--; }
  if (game.mode !== 'field' && game.mode !== 'battle') snapScreen();
}

function loop(now: number): void {
  acc += Math.min(250, now - last);
  last = now;
  let n = 0;
  while (acc >= STEP && n < 5) { update(); autoAfter(); input.end(); acc -= STEP; n++; }
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('beforeunload', () => { if (game.mode === 'field' && F.map) saveReveal(); });
canvas.focus();
setUiDraw(draw);
enterTitle();
requestAnimationFrame(loop);

// Debug handle for tests and the cartridge captures.
(window as unknown as { __vp: unknown }).__vp = {
  game, get S() { return S; }, F, setSave, fresh, writeSave, loadMap, run, dlg, CARD,
  step(n = 1, keys: string[] = [], quiet = false) { for (let i = 0; i < n; i++) { for (const k of keys) input.press(k as never); update(); autoAfter(); input.end(); } if (!quiet) draw(); },
  auto: AUTO,
  bstep: battleStep,
  motes: battleMotes,
  ui: uiCheck,
  draw, MAPS, AVATAR, tileAt, entVisible, clearScripts,
  fight(group: string) { run(function* () { yield* battleScript(group); }); },
  get battle() { return currentBattle(); },
  press(b: string) { input.press(b as never); },
  hold(b: string, on: boolean) { input.hold(b as never, on); },
};
