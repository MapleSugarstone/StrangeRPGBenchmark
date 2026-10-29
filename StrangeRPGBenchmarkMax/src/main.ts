// Boot and the main loop: input, scenes, screens, effects, and drawing at a fixed step.
import { attach, present, buf, W, H } from './engine/screen';
import { attachInput, pollInput, onFirstGesture, pressed, consume, injectPress, injectHold, type Button } from './engine/input';
import { fadeFrame } from './engine/gfx';
import { PX, C } from './engine/palette';
import { tickScheduler } from './game/sched';
import { loadScripts } from './game/script';
import { loadMaps } from './content/maps';
import { GAME } from './game/game';
import { F, updateField, renderField, enterMap, walkPath } from './game/field';
import { updateDialogue, renderDialogue, dialogueActive, cardActive } from './game/dialogue';
import { runScene, encounterBattle, changeMap, sceneRunning, join, startBattle } from './game/runner';
import { openMenu } from './game/menus';
import { FX, updateFx, shakeOffset, fadeTo } from './game/fx';
import { G, SETTINGS, loadSettings, flag } from './game/state';
import { Splash, Title, beginGame } from './game/title';
import { initAudio, setVolumes, playMusic, setChapter } from './audio';
import { MAPS } from './game/map';
import { renderEmotes } from './game/emotes';
import { initSticks, versusSticks } from './game/sticks';
import { initCredits } from './game/credits';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
attach(canvas);
attachInput(window);
loadSettings();
loadScripts();
loadMaps();
initSticks();
initCredits();

onFirstGesture(() => { initAudio(); setVolumes(SETTINGS.music, SETTINGS.sfx, SETTINGS.voice); });

function fit() {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth, window.innerHeight) / W));
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
window.addEventListener('resize', fit);
fit();

let splash: Splash | null = new Splash();
let title: Title | null = null;

F.hooks.scene = (id) => { if (!sceneRunning()) runScene(id); };
F.hooks.encounter = (a) => { encounterBattle(a); };
F.hooks.menu = () => { if (!GAME.overlay && !sceneRunning()) openMenu(); };
F.hooks.exit = (to, at) => { changeMap(to, at); };
GAME.toTitle = () => { title = new Title(); GAME.mode = 'title'; FX.fade = 0; };

async function startPlaying() {
  GAME.mode = 'field';
  FX.fade = 1;
  enterMap(G.map, [G.x, G.y], G.dir);
  setChapter(G.chapter || 1);
  playMusic(MAPS.get(G.map)?.music ?? 'none');
  if (!flag('ch1_started')) {
    await runScene('ch1_open');
  } else await fadeTo(0, 0.5);
}

function update(dt: number) {
  pollInput(dt);
  tickScheduler(dt);
  updateFx(dt);
  if (pressed('mute')) { SETTINGS.music = SETTINGS.music ? 0 : 8; setVolumes(SETTINGS.music, SETTINGS.sfx, SETTINGS.voice); }
  if (GAME.mode === 'splash') {
    splash!.update(dt);
    if (splash!.done) { splash = null; title = new Title(); GAME.mode = 'title'; consume(); }
    return;
  }
  if (GAME.mode === 'title') {
    title!.update(dt);
    const r = title!.result;
    if (r) {
      title = null;
      consume();
      if (r.kind === 'versus') { versusSticks().then(() => { title = new Title(); GAME.mode = 'title'; }); GAME.mode = 'sticks'; return; }
      beginGame(r);
      startPlaying();
    }
    return;
  }
  if (GAME.mode === 'field' || GAME.mode === 'battle') G.playtime += dt;
  if (dialogueActive()) { updateDialogue(dt); keepWorldMoving(dt); return; }
  if (GAME.overlay) { GAME.overlay.update(dt); return; }
  if (GAME.mode === 'battle' && GAME.battle) { GAME.battle.update(dt); return; }
  if (GAME.mode === 'field') updateField(dt, !sceneRunning() && FX.fade < 0.5);
}

/** People keep walking while a line is on screen. */
function keepWorldMoving(dt: number) {
  if (GAME.mode === 'field') updateField(dt, false);
  else if (GAME.mode === 'battle' && GAME.battle) GAME.battle.update(dt);
}

function render() {
  if (GAME.mode === 'splash') { splash!.render(); present(); return; }
  if (GAME.mode === 'title') { title!.render(); present(); return; }
  if (GAME.mode === 'battle' && GAME.battle) GAME.battle.render();
  else if (GAME.mode === 'field' || GAME.mode === 'sticks' || GAME.mode === 'credits') {
    if (F.map) { renderField(); renderEmotes(); }
    else buf.fill(PX[C.black]);
  }
  if (GAME.overlay) GAME.overlay.render();
  if (cardActive()) {
    applyShake();
    fadeFrame(FX.fade);
    renderDialogue();
  } else {
    renderDialogue();
    applyShake();
    fadeFrame(FX.fade);
  }
  present();
}

function applyShake() {
  const [sx, sy] = shakeOffset();
  if (!sx && !sy) return;
  const copy = buf.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ix = Math.min(W - 1, Math.max(0, x - sx)), iy = Math.min(H - 1, Math.max(0, y - sy));
    buf[y * W + x] = copy[iy * W + ix];
  }
}

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
function frame(now: number) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  let n = 0;
  while (acc >= STEP && n < 5) { update(STEP); acc -= STEP; n++; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// A small handle for the browser harness and tests. Saves only go to slot 9 from here.
(window as unknown as Record<string, unknown>).__g = {
  G: () => G, F, GAME, press: (b: Button) => injectPress(b), hold: (b: Button, on: boolean) => injectHold(b, on),
  scene: (id: string) => runScene(id), warp: (m: string, at: string) => enterMap(m, at),
  /** Starts the hero walking to a tile by the field's own pathfinding, as a player holding the arrows would. */
  walk: (x: number, y: number) => (F.player ? walkPath(F.player, x, y) : false),
  running: () => sceneRunning(),
  newGame: (name = 'Nodus', fs: string[] = []) => { beginGame({ kind: 'new', slot: 9, name }); for (const f of fs) G.flags[f] = true; splash = null; title = null; startPlaying(); },
  flags: (...fs: string[]) => { for (const f of fs) G.flags[f] = true; },
  join: (id: string) => join(id),
  battle: (group: string) => startBattle(group, null),
  /** Saves the canvas at its own size to shots/<name>.png. Needs the dev server started with --shots. */
  shot: (name: string) => new Promise<string>((ok) => canvas.toBlob((b) => { if (!b) return ok('no image'); fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: b }).then((r) => r.text()).then(ok, (e) => ok(String(e))); }, 'image/png')),
  /** Runs the game for some seconds at full speed, pressing buttons on the given frames, then draws once. */
  tick: async (seconds: number, presses: [number, Button][] = []) => {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      for (const [f, b] of presses) if (f === i) injectPress(b);
      update(STEP);
      // Let scene scripts continue between frames, as they do between real animation frames.
      for (let k = 0; k < 4; k++) await Promise.resolve();
    }
    render();
    return { mode: GAME.mode, map: G.map, x: G.x, y: G.y, frozen: F.frozen, dialogue: dialogueActive(), fade: FX.fade };
  },
};
