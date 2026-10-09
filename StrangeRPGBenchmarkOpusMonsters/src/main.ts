import { starfall } from './game/minigames/starfall';
import { scrape } from './game/minigames/scrape';
import { drawStone, playSetting } from './game/minigames/setting';
import { shopScreen } from './game/shopScreen';
import { middenScreen } from './game/middenScreen';
import { PUZZLES } from './game/setting/puzzles';
import { cardOf, pegboard } from './game/minigames/pegboard';
import { battle } from './game/battleView';
import { BACKDROP_KEYS, contactSheet, drawFighter, paintBackdrop, SCENE_H, SCENE_W, sceneNow } from './game/backdrops';
import { canvas, layer } from './engine/screen';
import { lightStats } from './game/fieldfx';
import { text as dbgText } from './engine/font';
import './data/species';
import { input } from './engine/input';
import { audio, setMuted, muted, setSfxVolume, sfx, sfxWav } from './engine/audio';
import { music } from './engine/music';
import { text, textCenter, textWidth } from './engine/font';
import { Splash } from './game/splash';
import { clear, dither, rect, INK } from './engine/screen';
import { drawSprite, PEOPLE } from './engine/sprites';
import { paletteOf, shapeOf } from './game/fitting';
import { variants as fitVariants } from './game/fitlab';
import { registerPortraits } from './game/dialogue';
import { drawAll, fadeToBlack, modes, replaceAll, run, top, close, tickAll, type Mode } from './game/modes';
import { field, safeSpot } from './game/field';
import { startMenu } from './game/menus';
import { G, HERO, hasSave, load, setGame, fresh, loosened, useSlot } from './game/state';
import { FileSelect, NameEntry } from './game/files';
import { inPractice, practice } from './game/practice';
import { MOVES, NOTIONS, PASSIVES, SUMMONS } from './battle/registry';
import { nerveUnlocked } from './game/state';

/**
 * Until tide opens, every sentence of an ability text that mentions tide reads "???", so a new player isn't told about a
 * resource they can't see yet. Practice always shows it, because tide is always on there.
 */
for (const table of [MOVES, PASSIVES, NOTIONS, SUMMONS] as unknown as Record<string, { text?: string }>[]) {
  for (const d of Object.values(table)) {
    const raw = d.text;
    if (!raw || !/\btide\b/i.test(raw)) continue;
    const hidden = raw.split(/(?<=[.!?])\s+/).map(s => (/\btide\b/i.test(s) ? '???' : s)).join(' ');
    Object.defineProperty(d, 'text', { configurable: true, enumerable: true, get: () => (nerveUnlocked() || inPractice ? raw : hidden) });
  }
}
import { drawLogo, drawMenu, drawNight } from './game/title';
import { setTextFilter } from './engine/font';
import { DIM, PAPER, SEL } from './game/ui';
import { MAPS, SCRIPTS } from './game/world';
import './content';
import './game/harness';
import { choose as aiChoose } from './battle/ai';
import { makeMon, SPECIES } from './data/species';
import { SCRIPTS as SCR } from './game/world';
import { feelStats } from './game/feel';
import { openRegisterAt } from './game/register';
import { voiceFor } from './game/voices';
import { playKindCry, speciesCry } from './game/cries';

registerPortraits();
// Game text names the hero Ouro. The font swaps in the name the player chose.
setTextFilter(s => (G.name && G.name !== HERO && s.includes(HERO) ? s.replace(/\bOuro\b/g, G.name) : s));

/** Frames before the menu takes input: the scene fades in, the logo's letters land, then the menu appears. A press skips it. */
const INTRO = 80;
const LEAVE = 18;
const BACK = 14;

class Title implements Mode {
  opaque = true;
  i = 0;
  t = 0;
  opts: string[] = [];
  /** Frames left in the fade to black after a pick, and in the fade back up after a file screen closes. */
  leave = 0;
  back = 0;
  constructor() { this.opts = hasSave() ? ['Continue', 'New game', 'Practice'] : ['New game', 'Practice']; music.play('title'); }
  busy = false;
  update(): void {
    this.t++;
    if (this.back > 0) this.back--;
    if (this.leave > 0) {
      if (--this.leave === 0) {
        this.busy = true;
        const o = this.opts[this.i];
        void (o === 'Continue' ? continueGame() : o === 'Practice' ? practice() : newGame()).finally(() => { this.busy = false; this.back = BACK; });
      }
      return;
    }
    if (this.busy) return;
    if (this.t < INTRO) { if (input.hit('ok') || input.hit('back')) { audio(); this.t = INTRO; } return; }
    if (input.hit('up')) { this.i = (this.i + this.opts.length - 1) % this.opts.length; sfx('move'); }
    if (input.hit('down')) { this.i = (this.i + 1) % this.opts.length; sfx('move'); }
    if (input.hit('ok')) { audio(); sfx('ok'); this.leave = LEAVE; }
  }
  draw(): void {
    drawNight(this.t);
    drawLogo(38, 10, this.t);
    drawMenu(this.opts, this.i, this.t, Math.min(1, Math.max(0, (this.t - 60) / 20)), this.leave > 0);
    const cover = Math.max(1 - this.t / 30, this.leave > 0 ? 1 - this.leave / LEAVE : 0, this.back / BACK);
    if (cover > 0) dither(0, 0, 192, 192, INK, cover);
  }
}

async function continueGame(): Promise<void> {
  const n = await run<number | null>(new FileSelect('load'));
  const s = n ? load(n) : null;
  if (!n || !s) return;
  useSlot(n);
  setGame(s);
  await fadeToBlack();
  startField(false);
}

async function newGame(): Promise<void> {
  for (;;) {
    const n = await run<number | null>(new FileSelect('new'));
    if (!n) return;
    const name = await run<string | null>(new NameEntry());
    if (name === null) continue;
    useSlot(n);
    const g = fresh();
    g.name = name;
    setGame(g);
    await fadeToBlack();
    startField(true);
    return;
  }
}

function startField(isNew: boolean): void {
  replaceAll(field);
  field.menuOpener = startMenu;
  setSfxVolume(G.opts.sfx);
  music.setVolume(G.opts.music);
  music.setDrop(loosened());
  if (isNew) {
    field.load('home', 4, 4, 2);
    const s = SCRIPTS['intro'];
    if (s) field.runBusy(s);
  } else {
    const [x, y] = safeSpot(G.map, G.x, G.y);
    field.load(G.map, x, y, G.dir);
    field.goalText = (G as any).goal || '';
    const e = field.map.enter && SCRIPTS[field.map.enter];
    if (e) field.runBusy(e);
  }
}

replaceAll(new Splash(() => replaceAll(new Title())));

let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;
let secs = 0;
function stepOnce(): void {
  if (input.hit('mute')) setMuted(!muted);
  const m = top();
  if (m) m.update();
  tickAll();
  input.end();
  music.update();
  secs += STEP / 1000;
  if (secs >= 1) { secs -= 1; G.time++; }
}

function loop(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  let steps = 0;
  // On a display running near 60 frames a second, every frame takes exactly one step. Counting time instead lets timer
  // noise give one frame no step and the next two, and the scrolling world shudders.
  if (Math.abs(dt - STEP) < 4) { acc = 0; stepOnce(); steps = 1; }
  else {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; stepOnce(); steps++; }
  }
  if (steps) drawAll();
}
function rafLoop(now: number): void { loop(now); requestAnimationFrame(rafLoop); }
requestAnimationFrame(rafLoop);
// Hidden panes and background tabs pause animation frames, so a timer keeps the game moving.
setInterval(() => { if (performance.now() - last > 60) loop(performance.now()); }, 33);

(window as any).__slough = {
  G: () => G, sfx, sfxWav, field, modes, close, top, input, aiChoose, makeMon, scripts: SCR, startField, SPECIES, PEOPLE, shapeOf, paletteOf, fitVariants, battle, sceneNow, BACKDROP_KEYS, scrape, pegboard, cardOf, playSetting, drawStone, PUZZLES, shopScreen, middenScreen, starfall, drawFighter,
  feel: { stats: feelStats, openRegisterAt, voiceFor, playKindCry, speciesCry },
  /** Shows six battle backdrops at a time for art review. Any key closes it. */
  sheet(page: number, loose = 0, dusk = 0): void {
    let t = 0;
    const m: Mode = {
      opaque: true,
      update() { t++; if (input.hit('ok') || input.hit('back')) close(m); },
      draw() {
        contactSheet(page, { t, loose, dusk }, (key, i) => {
          const x = (i % 2) * 96, y = Math.floor(i / 2) * 64;
          layer('sheet' + i, SCENE_W, SCENE_H, x, y, 1, () => paintBackdrop(key, { t, loose, dusk }));
          dbgText(key, x + 1, y + 54, '#ffffff', '#000000');
        });
      },
    };
    void run(m);
  },
  /** Draws a whole map screen by screen into one picture and posts it to the dev server as a PNG. Ouro and the follower stay out of it. */
  async mapShot(id: string, name: string, bright = false): Promise<string> {
    const m = MAPS[id];
    if (!m) return 'no map ' + id;
    const [x, y] = safeSpot(id, -1, -1);
    field.load(id, x, y, 0);
    field.banner = 0;
    const W = m.rows[0].length * 8, H = m.rows.length * 8;
    const big = document.createElement('canvas');
    big.width = W; big.height = H;
    const g = big.getContext('2d')!;
    const px = field.px, py = field.py;
    field.px = field.py = field.fol.px = field.fol.py = -999;
    lightStats.off = bright;
    for (let cy = 0; cy < H; cy += 184) for (let cx = 0; cx < W; cx += 184) {
      const ax = Math.max(0, Math.min(cx, W - 192)), ay = Math.max(0, Math.min(cy, H - 192));
      field.camAt = [ax, ay];
      drawAll();
      g.drawImage(canvas, 0, 0, 192, 192, ax, ay, 192, 192);
    }
    field.camAt = null; lightStats.off = false;
    field.px = px; field.py = py; field.placeFollower();
    const r = await fetch('/__shot?name=' + name, { method: 'POST', body: big.toDataURL('image/png') });
    return r.ok ? 'saved ' + name : 'failed ' + r.status;
  },
  /** Runs n fixed steps at once, for automated playtests. */
  step(n: number): void { for (let i = 0; i < n; i++) { const m = top(); if (m) m.update(); tickAll(); input.end(); } drawAll(); },
  tap(b: any, n = 1): void { for (let i = 0; i < n; i++) { input.press(b); const m = top(); if (m) m.update(); input.end(); for (let k = 0; k < 3; k++) { const mm = top(); if (mm) mm.update(); input.end(); } } drawAll(); },
};
void INK;
