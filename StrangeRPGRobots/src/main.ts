// Boot and the main loop: splash, title, the field, scenes, combat, menus, and overlays at a fixed step.
import { attach, present, W, H } from './engine/screen';
import { LAYOUT } from './engine/layout';
import { attachInput, pollInput, onFirstGesture, pressed, consume, injectPress, injectHold, injectClick, mouseActive, type Button } from './engine/input';
import { rect, fadeFrame, shadeRect, box } from './engine/gfx';
import { drawText, textWidth } from './engine/font';
import { C } from './engine/palette';
import { addLight } from './engine/light';
import { tickScheduler } from './game/sched';
import { loadScripts, runScene, sceneRunning, SCENES } from './game/script';
import { SCRIPT_FILES } from './script/index';
import { ALL_MAPS } from './content/maps/index';
import { registerMaps } from './world/map';
import './content/register';
import { G, SETTINGS, loadSettings, flag } from './game/state';
import { WORLD, updateBailers } from './world/world';
import { T } from './world/tiles';
import { F, updateField, updateCamera, renderFieldOverlay } from './world/field';
import { renderWorld } from './world/render';
import { updateDialogue, renderDialogue, dialogueOpen } from './ui/dialogue';
import { MENU, menuOpen, openMenu, updateMenu, renderMenu } from './ui/menus';
import { Splash, Title } from './ui/title';
import { stage, OV, beginGame, talkTo, useProp, fightNow, changeMap, resumeLoaded, reloadAfterDefeat, leaveCamp } from './game/runner';
import { CB } from './combat/core';
import { updateCombat, renderCombat, combatLights } from './combat/combat';
import { animLights, FXS } from './game/anims';
import { maxHp, partyMembers } from './rules/stats';
import { initAudio, setVolumes, playMusic } from './audio/sfx';
import './audio/engine';
import { autosave } from './game/save';
import { Credits } from './ui/credits';
import { Sluice } from './ui/sluice';
import { QUEST } from './content/quests';
import { updateBanter, playBanter } from './game/banter';
import { inspect } from './game/details';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
attach(canvas);
attachInput(window, canvas);
loadSettings();
registerMaps(ALL_MAPS);
loadScripts(SCRIPT_FILES);

onFirstGesture(() => { initAudio(); setVolumes(SETTINGS.music, SETTINGS.sfx, SETTINGS.voice); });

// The page hides the system pointer over the canvas, so the game shows this arrow while the mouse drives.
const ARROW = ['#......', '##.....', '#o#....', '#oo#...', '#ooo#..', '#oooo#.', '#ooooo#', '#oo####', '#o#....', '##.....'];
let arrowCss = 'default';
let shownCursor = '';

function makeArrow(scale: number) {
  const k = Math.min(scale, 4);
  const o = document.createElement('canvas');
  o.width = ARROW[0].length * k; o.height = ARROW.length * k;
  const g = o.getContext('2d');
  if (!g) return;
  ARROW.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      g.fillStyle = row[x] === '#' ? '#07060c' : '#e8e4ef';
      g.fillRect(x * k, y * k, k, k);
    }
  });
  arrowCss = `url(${o.toDataURL()}) 0 0, default`;
  shownCursor = '';
}

function fit() {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth, window.innerHeight) / W));
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
  makeArrow(s);
}
window.addEventListener('resize', fit);
fit();

type Mode = 'splash' | 'title' | 'field';
let mode: Mode = 'splash';
let splash: Splash | null = new Splash();
let title: Title | null = null;
let now = 0;
let credits: Credits | null = null;

F.hooks.scene = (id) => { if (!sceneRunning()) void runScene(id); };
F.hooks.exit = (to, at) => { if (to === '__leavecamp') { void leaveCamp(); return; } void changeMap(to, at); };
F.hooks.encounter = (id, surprise) => { if (!CB.active && !sceneRunning()) { F.locked = true; void fightNow([id], surprise).finally(() => { F.locked = false; }); } };
F.hooks.menu = () => { if (!sceneRunning() && !CB.active) openMenu(); };
F.hooks.talk = (a) => talkTo(a);
F.hooks.use = (p) => useProp(p);
F.hooks.detail = (d) => { void inspect(d); };
MENU.hooks.title = () => { toTitle(); };

function toTitle() { mode = 'title'; title = new Title(); playMusic('title'); OV.fade = 0; }

function update(dt: number) {
  pollInput(dt);
  tickScheduler(dt);
  now += dt;
  if (pressed('mute')) { SETTINGS.music = SETTINGS.music ? 0 : 7; setVolumes(SETTINGS.music, SETTINGS.sfx, SETTINGS.voice); }
  if (mode === 'splash') {
    splash!.update(dt);
    if (splash!.done) { splash = null; toTitle(); }
    return;
  }
  if (mode === 'title' && OV.sluice) { OV.sluice.update(dt); if (OV.sluice.done) { OV.sluice = null; toTitle(); } return; }
  if (mode === 'title') {
    title!.update(dt);
    const r = title!.result;
    if (r) {
      title = null;
      mode = 'field';
      consume();
      if (r.kind === 'sluice') { mode = 'title'; title = new Title(); OV.sluice = new Sluice(r.opponent); return; }
      if (r.kind === 'new') void beginGame(r);
      else resumeLoaded();
    }
    return;
  }
  G.playtime += dt;
  WORLD.t += dt;
  if (FXS.flash > 0) FXS.flash -= dt;
  if (OV.sluice) { OV.sluice.update(dt); return; }
  if (OV.card) { OV.card.t += dt; if (OV.card.t > 3.2 || (OV.card.t > 0.8 && pressed('a'))) { OV.card = null; consume(); } return; }
  if (OV.name) { OV.name.update(dt); if (OV.name.done) { OV.nameSet?.(OV.name.done); OV.name = null; consume(); } return; }
  if (OV.gameOver) {
    if (pressed('a')) { consume(); OV.gameOver = false; if (!reloadAfterDefeat()) toTitle(); }
    return;
  }
  if (OV.ending) {
    if (!credits) { credits = new Credits(); playMusic('credits'); endGameSave(); }
    credits.update(dt);
    if (credits.finished() || (credits.t > 3 && pressed('b'))) { OV.ending = false; credits = null; consume(); toTitle(); }
    return;
  }
  if (menuOpen()) { updateMenu(dt); return; }
  if (dialogueOpen()) updateDialogue(dt);
  updateCombat(dt);
  if (!dialogueOpen() || CB.active) updateField(dt, now);
  else if (WORLD.map) {
    // Scenes keep actors walking while the box is up.
    updateField(dt, now);
  }
  updateBanter(dt);
  updateBailers(dt);
  updateCamera(dt);
}

/** After the ending, the autosave puts the crew back at camp for free roaming, with the ending recorded. */
function endGameSave() {
  G.flags.game_done = 1;
  const cm = G.campMap ?? 'camp';
  const p = ALL_MAPS.find((m) => m.id === cm)?.markers?.start;
  if (p) { G.map = cm; G.x = p[0]; G.y = p[1]; }
  autosave();
}

function questTarget(): [number, number] | null {
  const ids = Object.keys(G.quests).filter((id) => !G.quests[id].done && !G.quests[id].failed && QUEST.get(id)?.where);
  ids.sort((a, b) => (QUEST.get(a)!.kind === 'main' ? 0 : 1) - (QUEST.get(b)!.kind === 'main' ? 0 : 1));
  for (const id of ids) {
    const w = QUEST.get(id)!.where![String(G.quests[id].stage)];
    if (!w || w[0] !== G.map) continue;
    const p = WORLD.def?.markers?.[w[1]];
    if (p) return p;
  }
  return null;
}

function renderHud() {
  if (CB.active || !F.leader) return;
  // The port's pull: a small arrow at the top edge pointing toward the Brim.
  if (flag('port_awake') && !flag('port_quiet')) {
    const pull = WORLD.def?.markers?.pull;
    let ang = -Math.PI / 2;
    if (pull) ang = Math.atan2(pull[1] * T - F.leader.py, pull[0] * T - F.leader.px);
    ang += Math.sin(now * 1.3) * 0.05;
    const cx = W / 2 + Math.cos(ang) * 84, cy = H / 2 + Math.sin(ang) * 84;
    for (let k = 0; k < 4; k++) {
      const px = Math.round(cx - Math.cos(ang) * k), py = Math.round(cy - Math.sin(ang) * k);
      rect(px, py, 1, 1, C.cyan4);
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      if (k === 2 || k === 3) { rect(Math.round(px + nx * (k - 1)), Math.round(py + ny * (k - 1)), 1, 1, C.cyan3); rect(Math.round(px - nx * (k - 1)), Math.round(py - ny * (k - 1)), 1, 1, C.cyan3); }
    }
  }
  // The current quest target on this map: a diamond on it, or an arrow at the screen edge toward it.
  const tgt = questTarget();
  if (tgt && !dialogueOpen()) {
    const sx = tgt[0] * T + 5 - WORLD.cam.x, sy = tgt[1] * T - 4 - WORLD.cam.y;
    const bob = Math.round(Math.sin(now * 3) * 1);
    if (sx >= 4 && sy >= 4 && sx < W - 4 && sy < H - 4) {
      rect(sx - 1, sy - 2 + bob, 3, 1, C.amb4); rect(sx - 2, sy - 1 + bob, 5, 1, C.amb3); rect(sx - 1, sy + bob, 3, 1, C.amb2); rect(sx, sy + 1 + bob, 1, 1, C.amb2);
    } else {
      const ang = Math.atan2(sy - H / 2, sx - W / 2);
      const ex = Math.round(W / 2 + Math.cos(ang) * 92), ey = Math.round(H / 2 + Math.sin(ang) * 92);
      rect(ex - 1, ey - 1, 3, 3, C.amb3); rect(ex, ey, 1, 1, C.amb4);
    }
  }
  // Party health, bottom left, when anyone is hurt.
  const hurt = partyMembers().some((m) => m.hp < maxHp(m));
  if (hurt && !dialogueOpen()) {
    partyMembers().forEach((m, i) => {
      const y = H - 6 - i * 5;
      const mh = maxHp(m);
      rect(3, y, 22, 3, C.black);
      rect(4, y + 1, Math.round(20 * Math.max(0, m.hp) / mh), 1, m.hp < mh * 0.3 ? C.mag3 : C.grn3);
    });
  }
  if (G.campReturn && G.map === (G.campMap ?? 'camp') && !dialogueOpen()) drawText('Q: leave camp', W - 4 - textWidth('Q: leave camp'), H - 10, C.slate);
}

function render(dt: number) {
  if (mode === 'splash') { splash!.render(); present(); return; }
  if (mode === 'title' && OV.sluice) { OV.sluice.render(); present(); return; }
  if (mode === 'title') { title!.render(); present(); return; }
  if (WORLD.map) {
    renderWorld({
      flag,
      dt,
      lights: () => { combatLights(); animLights((x, y, r, i, c, o) => addLight(x, y, r, i, c, o)); },
    });
    renderCombat();
    renderFieldOverlay();
  } else rect(0, 0, W, H, C.black);
  renderHud();
  renderDialogue();
  renderMenu();
  if (FXS.flash > 0) shadeRect(0, 0, W, H, Math.min(1, FXS.flash * 6), C.white);
  if (OV.fade > 0) fadeFrame(OV.fade);
  if (OV.card) {
    const a = Math.min(1, OV.card.t / 0.5) * Math.min(1, Math.max(0, (3.2 - OV.card.t) / 0.5));
    rect(0, 70, W, 50, C.black);
    const t1 = `CHAPTER ${OV.card.n}`, t2 = OV.card.title;
    drawText(t1, Math.round((W - textWidth(t1)) / 2), 82, C.amb3);
    drawText(t2, Math.round((W - textWidth(t2)) / 2), 96, C.white);
    shadeRect(0, 70, W, 50, 1 - a);
  }
  if (OV.name) OV.name.render();
  if (OV.sluice) OV.sluice.render();
  if (OV.gameOver) {
    rect(0, 0, W, H, C.black);
    const t = 'FLATLINED';
    drawText(t, Math.round((W - textWidth(t)) / 2), 84, C.mag3);
    drawText('Z: load the last autosave', Math.round((W - textWidth('Z: load the last autosave')) / 2), 100, C.gray);
  }
  if (OV.ending && credits) credits.render();
  present();
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(t: number) {
  acc += Math.min(0.1, (t - last) / 1000);
  last = t;
  let dt = 0;
  while (acc >= STEP) { update(STEP); acc -= STEP; dt += STEP; }
  if (dt > 0) render(dt);
  const cursor = mouseActive() ? arrowCss : 'none';
  if (cursor !== shownCursor) { canvas.style.cursor = cursor; shownCursor = cursor; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Leave camp from the field with the map key.
window.addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && G.campReturn && G.map === (G.campMap ?? 'camp') && mode === 'field' && !sceneRunning() && !CB.active && !menuOpen()) void leaveCamp(); });

// Test and harness hooks.
const H_ = {
  G: () => G, WORLD, F, CB, SCENES, stage, runScene, autosave,
  press: (b: Button) => injectPress(b), hold: (b: Button, on: boolean) => injectHold(b, on), click: (x: number, y: number, r = false) => injectClick(x, y, r),
  /** Advances n frames, letting scene and combat promises run between frames. */
  step: async (n = 1) => { for (let i = 0; i < n; i++) { update(STEP); for (let k = 0; k < 30; k++) await Promise.resolve(); } render(STEP); },
  mode: () => mode,
  /** Steps frames and presses Z every few frames, to click through dialogue and first choices. */
  auto: async (frames = 300, every = 12) => { for (let i = 0; i < frames; i++) { if (i % every === 0 && dialogueOpen()) injectPress('a'); update(STEP); for (let k = 0; k < 30; k++) await Promise.resolve(); } render(STEP); },
  /** Clicks through whatever scene is running until the field is free. */
  idle: async (maxFrames = 6000) => {
    let i = 0;
    for (; i < maxFrames && (sceneRunning() || CB.active || OV.fade > 0); i++) {
      if (OV.name && i % 20 === 0) OV.name.done = OV.name.text || 'Lode';
      if (OV.card && i % 30 === 0) OV.card.t = 99;
      if (OV.gameOver) return { ok: false, frames: i, why: 'game over' };
      if (i % 10 === 0 && menuOpen()) injectPress('b');
      else if (i % 10 === 0 && dialogueOpen()) injectPress('a');
      update(STEP);
      for (let k = 0; k < 30; k++) await Promise.resolve();
    }
    render(STEP);
    return { ok: !sceneRunning(), frames: i, map: G.map };
  },
  /** Runs a scene to completion by clicking through it. */
  play: async (id: string, maxFrames = 6000) => {
    let done = false, err = '';
    void runScene(id).then(() => { done = true; }, (e) => { err = String(e); done = true; });
    let i = 0;
    for (; i < maxFrames && !done; i++) {
      if (OV.name && i % 20 === 0) OV.name.done = OV.name.text || 'Lode';
      if (OV.card && i % 30 === 0) OV.card.t = 99;
      if (OV.gameOver) { err = 'game over'; break; }
      if (i % 10 === 0 && menuOpen()) injectPress('b');
      else if (i % 10 === 0 && dialogueOpen()) injectPress('a');
      update(STEP);
      for (let k = 0; k < 30; k++) await Promise.resolve();
    }
    render(STEP);
    return { done, frames: i, err, map: G.map };
  },
  /** Draws every named look (down, right, up) on a plain background, for checking sprites. */
  /** Writes the hero designs as an editable sheet: one row per design, columns down, right, up with three frames each, 12 px apart. */
  heroSheet: async (name = 'hero-sheet', S = 1, count = 99) => {
    const { personSheet, HERO_PRESETS: ALL } = await import('./art/people');
    const HERO_PRESETS = ALL.slice(0, count);
    const { RGB } = await import('./engine/palette');
    const o = document.createElement('canvas');
    o.width = 9 * 12 * S; o.height = HERO_PRESETS.length * 12 * S;
    const g = o.getContext('2d')!;
    HERO_PRESETS.forEach((p, row) => {
      const sh = personSheet(p.look);
      (['down', 'right', 'up'] as const).forEach((d, di) => sh.frames[d].forEach((f, fi) => {
        const ox = (di * 3 + fi) * 12 + 1, oy = row * 12 + 1;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const v = f.px[y * f.w + x];
          if (v === 255) continue;
          const [r, gg, b] = RGB[v];
          g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect((ox + x) * S, (oy + y) * S, S, S);
        }
      }));
    });
    const blob = await new Promise<Blob | null>((r) => o.toBlob(r, 'image/png'));
    return (await fetch('/__shot?name=' + name, { method: 'POST', body: blob })).text();
  },
  /** Writes named looks with all walk frames: one row each, front, side, back, three frames per facing. */
  castSheet: async (name: string, S: number, ids: string[]) => {
    const { sheetFor } = await import('./art/cast');
    const { RGB } = await import('./engine/palette');
    const o = document.createElement('canvas');
    o.width = 9 * 12 * S; o.height = ids.length * 12 * S;
    const g = o.getContext('2d')!;
    ids.forEach((id, row) => {
      const sh = sheetFor(id);
      (['down', 'right', 'up'] as const).forEach((d, di) => sh.frames[d].forEach((f, fi) => {
        const ox = (di * 3 + fi) * 12 + 1, oy = row * 12 + 1;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const v = f.px[y * f.w + x];
          if (v === 255) continue;
          const [r, gg, b] = RGB[v];
          g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect((ox + x) * S, (oy + y) * S, S, S);
        }
      }));
    });
    const blob = await new Promise<Blob | null>((r) => o.toBlob(r, 'image/png'));
    return (await fetch('/__shot?name=' + name, { method: 'POST', body: blob })).text();
  },
  /** Writes the companion pitches as an editable sheet: one row per companion, each design as front, side, back. */
  pitchSheet: async (name = 'pitch-sheet', S = 1) => {
    const { personSheet } = await import('./art/people');
    const { sheetFor } = await import('./art/cast');
    const { PITCHES } = await import('./art/pitches');
    const { RGB } = await import('./engine/palette');
    const o = document.createElement('canvas');
    o.width = 12 * 12 * S; o.height = PITCHES.length * 12 * S;
    const g = o.getContext('2d')!;
    PITCHES.forEach((p, row) => p.designs.forEach((d, di) => {
      const sh = typeof d.look === 'string' ? sheetFor(d.look) : personSheet(d.look);
      (['down', 'right', 'up'] as const).forEach((dir, k) => {
        const f = sh.frames[dir][0];
        const ox = (di * 3 + k) * 12 + 1, oy = row * 12 + 1;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const v = f.px[y * f.w + x];
          if (v === 255) continue;
          const [r, gg, b] = RGB[v];
          g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect((ox + x) * S, (oy + y) * S, S, S);
        }
      });
    }));
    const blob = await new Promise<Blob | null>((r) => o.toBlob(r, 'image/png'));
    return (await fetch('/__shot?name=' + name, { method: 'POST', body: blob })).text();
  },
  /** Writes a labeled sheet of every character sprite, grouped by role, at 6x. */
  roster: async (name = 'roster', turns = false, heroes = false, pitches = false) => {
    const { LOOKS, sheetFor } = await import('./art/cast');
    const { SPEAKERS } = await import('./content/speakers');
    const { ENEMIES } = await import('./rules/data');
    const { RGB } = await import('./engine/palette');
    const { personSheet, HERO_PRESETS, TOP_NAMES } = await import('./art/people');
    const nameOf = new Map<string, string>();
    for (const sp of Object.values(SPEAKERS)) if (sp.look && !nameOf.has(sp.look)) nameOf.set(sp.look, sp.name);
    const foes = new Map<string, string>();
    for (const e of ENEMIES) if (!foes.has(e.look)) foes.set(e.look, e.name);
    const party = ['courtesy', 'sallis', 'quaye', 'ambrose', 'tova', 'ignace'];
    const story = ['opal', 'seo', 'sieve', 'dowser', 'marit', 'teun', 'hanne', 'jory', 'tilly', 'velt', 'lam', 'rina', 'bram', 'kees', 'moss', 'gus', 'kat', 'riek'];
    const used = new Set([...party, ...story]);
    const side = Object.keys(LOOKS).filter((k) => !used.has(k) && !foes.has(k) && nameOf.has(k));
    const enemies = [...foes.keys()].filter((k) => !used.has(k));
    const extra = Object.keys(LOOKS).filter((k) => !used.has(k) && !foes.has(k) && !nameOf.has(k));
    const groups: [string, { label: string; sheet: ReturnType<typeof sheetFor> }[]][] = [
      ['Party', [{ label: `${G.heroName} (you)`, sheet: personSheet(G.look) }, ...party.map((k) => ({ label: nameOf.get(k) ?? k, sheet: sheetFor(k) }))]],
      ['Story characters', story.map((k) => ({ label: nameOf.get(k) ?? k, sheet: sheetFor(k) }))],
      ['Side characters', side.map((k) => ({ label: nameOf.get(k) ?? k, sheet: sheetFor(k) }))],
      ['Enemies', enemies.map((k) => ({ label: foes.get(k)!, sheet: sheetFor(k) }))],
      ['Crowd and minor looks', extra.map((k) => ({ label: k, sheet: sheetFor(k) }))],
    ];
    if (heroes) {
      const base = HERO_PRESETS[0].look;
      groups.splice(0, groups.length,
        ['Hero designs', HERO_PRESETS.map((p) => ({ label: p.name, sheet: personSheet(p.look) }))],
        ['Coat cuts', TOP_NAMES.map((t) => ({ label: t, sheet: personSheet({ ...base, hairStyle: 'short', top: t, extras: [] }) }))]);
    }
    if (pitches) {
      const { PITCHES } = await import('./art/pitches');
      groups.splice(0, groups.length, ...PITCHES.map((p) => [p.who, p.designs.map((d) => ({ label: d.name, sheet: typeof d.look === 'string' ? sheetFor(d.look) : personSheet(d.look) }))] as [string, { label: string; sheet: ReturnType<typeof sheetFor> }[]]));
      heroes = true;
    }
    const S = heroes ? 7 : turns ? 4 : 6, CW = heroes ? 250 : turns ? 150 : 96, CH = heroes ? 100 : turns ? 76 : 104, COLS = heroes ? 4 : turns ? 7 : 10;
    let rows = 0;
    for (const [, list] of groups) rows += Math.ceil(list.length / COLS);
    const o = document.createElement('canvas');
    o.width = COLS * CW + 16; o.height = rows * CH + groups.length * 30 + 16;
    const g = o.getContext('2d')!;
    g.fillStyle = '#0d0b1a'; g.fillRect(0, 0, o.width, o.height);
    let y = 8;
    for (const [title, list] of groups) {
      g.fillStyle = '#e8d9a8'; g.font = 'bold 16px monospace'; g.fillText(title, 8, y + 18);
      y += 30;
      list.forEach((c, i) => {
        const cx = 8 + (i % COLS) * CW, cy = y + Math.floor(i / COLS) * CH;
        const shown = turns ? [c.sheet.frames.down[0], c.sheet.frames.right[0], c.sheet.frames.up[0]] : [c.sheet.frames.down[0]];
        const span = shown.reduce((n, f) => n + f.w * S + 4, -4);
        let ox = cx + Math.floor((CW - span) / 2);
        for (const f of shown) {
          const oy = cy + 4 + Math.max(0, (heroes ? 72 : turns ? 48 : 72) - f.h * S);
          for (let py = 0; py < f.h; py++) for (let px = 0; px < f.w; px++) {
            const v = f.px[py * f.w + px];
            if (v === 255) continue;
            const [r, gg, b] = RGB[v];
            g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(ox + px * S, oy + py * S, S, S);
          }
          ox += f.w * S + 4;
        }
        g.fillStyle = '#c8c8d8'; g.font = '11px monospace'; g.textAlign = 'center';
        g.fillText(c.label.length > 15 ? c.label.slice(0, 14) + '.' : c.label, cx + CW / 2, cy + CH - 12);
        g.textAlign = 'left';
      });
      y += Math.ceil(list.length / COLS) * CH;
    }
    const blob = await new Promise<Blob | null>((r) => o.toBlob(r, 'image/png'));
    return (await fetch('/__shot?name=' + name, { method: 'POST', body: blob })).text();
  },
  looks: async (name = 'looks') => {
    const { LOOKS, sheetFor } = await import('./art/cast');
    const { blitUI } = await import('./engine/gfx');
    rect(0, 0, W, H, C.night);
    const ids = [...Object.keys(LOOKS), 'courtesy', 'patrol', 'drone', 'tilly'];
    ids.forEach((id, i) => {
      const s = sheetFor(id);
      const x = 4 + (i % 6) * 33, y = 4 + Math.floor(i / 6) * 16;
      blitUI(s.frames.down[0], x, y + (s.frames.down[0].h > 10 ? 0 : 2));
      blitUI(s.frames.right[0], x + 11, y + 2);
      blitUI(s.frames.up[0], x + 22, y + 2);
    });
    present();
    const o = document.createElement('canvas');
    o.width = W * 4; o.height = H * 4;
    const g = o.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(canvas, 0, 0, W, H, 0, 0, o.width, o.height);
    const blob = await new Promise<Blob | null>((r) => o.toBlob(r, 'image/png'));
    return (await fetch('/__shot?name=' + name, { method: 'POST', body: blob })).text();
  },
  /** Starts a test game in save slot 9 so real saves are never touched. */
  setup: async (o: { name?: string; cls?: 'blade' | 'diver' | 'rigger' | 'mouth' } = {}) => {
    SETTINGS.slot = 9;
    mode = 'field';
    title = null; splash = null;
    void beginGame({ kind: 'new', name: o.name ?? 'Test', cls: o.cls ?? 'blade', look: { skin: C.skin4, hair: C.mag1, coat: C.cyan1, accent: C.mag3, shirt: C.mag2, top: 'open', hairStyle: 'strands', extras: ['beanie'] }, difficulty: 'runner' });
  },
  banter: playBanter,
  /** Game modules for the interface audit, which opens screens and dialogue directly. */
  mods: async () => ({
    dialogue: await import('./ui/dialogue'), menus: await import('./ui/menus'), runner: await import('./game/runner'),
    combat: await import('./combat/combat'), core: await import('./combat/core'), actions: await import('./combat/actions'), state: await import('./game/state'), details: await import('./game/details'),
    dcontent: await import('./content/details'), quests: await import('./content/quests'), replay: await import('./content/replay'),
    shops: await import('./content/shops'), cards: await import('./content/cards'), rules: await import('./rules/data'),
    companions: await import('./content/companions'), speakers: await import('./content/speakers'), maps: await import('./world/map'), sluice: await import('./ui/sluice'), people: await import('./art/people'), palette: await import('./engine/palette'),
  }),
  /** Opens every screen and returns the text that overlaps, touches, or is cut off. */
  uiAudit: async (parts?: import('./tools/uiaudit').Part[]) => (await import('./tools/uiaudit')).uiAudit(H_, parts),
  /** Renders one frame with the layout recorder on and returns text that overlaps, touches, or is cut off. */
  audit: () => { LAYOUT.on = true; render(STEP); LAYOUT.on = false; return LAYOUT.last; },
  shot: async (name: string, scale = 3, crop?: [number, number, number, number]) => {
    render(STEP);
    const [x, y, w, h] = crop ?? [0, 0, W, H];
    const o = document.createElement('canvas');
    o.width = w * scale; o.height = h * scale;
    const g = o.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(canvas, x, y, w, h, 0, 0, o.width, o.height);
    const blob = await new Promise<Blob | null>((r) => o.toBlob(r, 'image/png'));
    const res = await fetch('/__shot?name=' + name, { method: 'POST', body: blob });
    return res.text();
  },
};
(window as unknown as { __h: typeof H_ }).__h = H_;
void box;
