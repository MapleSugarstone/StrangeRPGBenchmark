import { Audio } from './core/audio';
import { Gfx, W, H } from './core/gfx';
import { Input } from './core/input';
import { Game } from './game/game';
import { MUSIC } from './data/music';
import { SKILLS } from './data/skills';
import { GROUPS } from './data/enemies';
import { TitleScene, WishScene, IntroScene } from './scenes/title';
import { SplashScene } from './scenes/splash';
import { FieldScene } from './scenes/field';
import { BattleScene } from './scenes/battle';
import { newState, againState, loadGame, heroSprite, setSkillNamer, newMember, saveMeta, GameState } from './game/state';
import { setHeroSprite } from './game/speakers';
import { OPERATOR_CODE, ANYONE_CODE } from './game/letters';
import { installArg } from './game/arg';
import { genSprite, pxCanvas } from './core/sprites';
import { storyTest } from './game/storytest';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
const gfx = new Gfx(canvas);
const input = new Input(window);
const audio = new Audio();
audio.tracks = MUSIC;
const game = new Game(gfx, input, audio);
setSkillNamer((id) => SKILLS[id]?.name ?? id);

function fit() {
  // Size in device pixels so each game pixel covers a whole number of screen pixels at any page zoom or display scaling.
  const dpr = window.devicePixelRatio || 1;
  const s = Math.max(1, Math.min(Math.round(4 * dpr), Math.floor(Math.min((window.innerWidth - 16) * dpr / W, (window.innerHeight - 64) * dpr / H))));
  canvas.style.width = (W * s) / dpr + 'px';
  canvas.style.height = (H * s) / dpr + 'px';
  document.getElementById('tube')?.style.setProperty('--px', s / dpr + 'px');
}
try { if (localStorage.getItem('pleasehold.scan') === '1') document.body.classList.add('scan'); } catch { /* storage may be unavailable */ }
window.addEventListener('resize', fit);
fit();

const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !input.textHandler) audio.toggleMute(); });

function startField(s: GameState) {
  game.state = s;
  setHeroSprite(heroSprite(s.wish));
  game.replace(new FieldScene(game, s.map, s.x, s.y, s.dir));
}

function title() {
  game.state = null;
  game.replace(new TitleScene(game, (again) => {
    game.replace(new WishScene(game, (wish) => {
      game.replace(new IntroScene(game, wish, () => startField(again ? againState(wish, game.meta) : newState(wish))));
    }));
  }, () => {
    const s = loadGame();
    if (!s) return;
    const days = Math.floor((Date.now() - (s.lastSave || Date.now())) / 86400000);
    startField(s);
    if (days >= 1) {
      const f = game.stack[0] as FieldScene;
      f.run(async (c) => { await c.say(null, `You were away for ${days} day${days === 1 ? '' : 's'}. Someone kept your place in line.`); });
    }
  }));
}

game.loadFromSave = () => {
  const s = loadGame();
  if (s) startField(s); else title();
};
game.toTitle = title;

if (!game.meta.firstSeen) game.meta.firstSeen = Date.now();
saveMeta(game.meta);
game.replace(new SplashScene(game, title));
game.start();
installArg(game);

const pump: { out: string[]; done: boolean; queue: (() => void)[] } = { out: [], done: true, queue: [] };

// Debug hooks for testing and screenshots.
const dbg = {
  game,
  run: (n: number) => game.run(n),
  newGame: (wish = 'I wish for a good adventure') => startField(newState(wish)),
  again: (wish = 'I wish for a good adventure') => startField(againState(wish, game.meta)),
  start(ch: number, wish = 'I wish for a good adventure') {
    const s = newState(wish);
    const plan: Record<number, { map: string; x: number; y: number; party: string[]; lvl: number; flags: string[] }> = {
      1: { map: 'lowmost', x: 15, y: 12, party: ['hello'], lvl: 1, flags: ['c1_wake'] },
      2: { map: 'waiting', x: 20, y: 38, party: ['hello', 'someday'], lvl: 6, flags: ['c1_wake', 'c1_net', 'c1_dusk', 'c1_want', 'c1_lines', 'c1_mentor'] },
      3: { map: 'docket', x: 3, y: 26, party: ['hello', 'someday', 'bigger'], lvl: 9, flags: ['c1_mentor', 'mech_answer', 'c2_bigger', 'c2_served'] },
      4: { map: 'encore', x: 16, y: 26, party: ['hello', 'someday', 'bigger', 'anyone'], lvl: 12, flags: ['mech_answer', 'mech_line', 'c3_sup'] },
    };
    const p = plan[ch] ?? plan[1];
    s.map = p.map; s.x = p.x; s.y = p.y; s.chapter = ch;
    s.party = p.party;
    s.roster = {};
    for (const id of p.party) s.roster[id] = newMember(id, p.lvl);
    for (const f of p.flags) s.flags[f] = 1;
    s.pleas = 200;
    startField(s);
  },
  jump(map: string, x: number, y: number, party: string[] = ['hello', 'someday', 'bigger', 'anyone'], lvl = 12, flags: string[] = []) {
    const s = newState('I wish someone would remember me');
    s.map = map; s.x = x; s.y = y;
    s.party = party.slice(0, 4);
    s.roster = {};
    for (const id of party) s.roster[id] = newMember(id, lvl);
    for (const f of ['mech_answer', 'mech_line', 'mech_rewind', 'mech_lastword', 'mech_mask', 'mech_stakes', ...flags]) s.flags[f] = 1;
    s.pleas = 2000;
    startField(s);
  },
  view(map: string, x: number, y: number) {
    FieldScene.skipEnter = true;
    (game.stack[0] as FieldScene).load(map, x, y, 2);
    FieldScene.skipEnter = false;
    game.run(30);
  },
  battle(group: string, scene?: string) {
    const st = game.state;
    if (!st) return;
    const f = game.stack[0] as FieldScene;
    game.push(new BattleScene(game, group, { enemies: GROUPS[group] ?? [group], scene }, () => {}, f?.map));
  },
  key(code: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
    game.run(2);
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
    game.run(1);
  },
  codes: { OPERATOR_CODE, ANYONE_CODE },
  heroPng(wish = 'please') { const sp = heroSprite(wish); return pxCanvas(genSprite(sp), sp.a, sp.b).toDataURL('image/png'); },
  screenPng() { game.draw(); return canvas.toDataURL('image/png'); },
  // Saves the screen at 3x to build/shots for inspection.
  async shot(name: string, scale = 3) {
    game.draw();
    const big = document.createElement('canvas');
    big.width = W * scale; big.height = H * scale;
    const c = big.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(canvas, 0, 0, big.width, big.height);
    await fetch('/shot/' + name + '.png', { method: 'POST', body: big.toDataURL('image/png') });
    return name;
  },
  // Saves a 2-column contact sheet at 2x, calling `setup` before each cell.
  async sheet(name: string, list: string[], setup: (k: string) => Promise<void>) {
    const cw = W * 2;
    const big = document.createElement('canvas');
    big.width = cw * 2 + 4; big.height = Math.ceil(list.length / 2) * (cw + 4);
    const c = big.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#f0f'; c.fillRect(0, 0, big.width, big.height);
    for (let i = 0; i < list.length; i++) {
      await setup(list[i]);
      game.draw();
      c.drawImage(canvas, (i % 2) * (cw + 4), Math.floor(i / 2) * (cw + 4), cw, cw);
    }
    await fetch('/shot/' + name + '.png', { method: 'POST', body: big.toDataURL('image/png') });
    return name;
  },
  // Async helpers that let promises settle between frames.
  async frames(n: number) { for (let i = 0; i < n; i++) { game.run(1); for (let j = 0; j < 4; j++) await Promise.resolve(); } },
  async press(code: string, n = 1, gap = 30) { for (let i = 0; i < n; i++) { dbg.key(code); await dbg.frames(gap); } },
  async hold(code: string, frames: number) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
    await dbg.frames(frames);
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
    await dbg.frames(2);
  },
  route(tx: number, ty: number): string[] | null {
    const f = game.stack[0] as FieldScene;
    const h = f.hero;
    const k = (x: number, y: number) => x + ',' + y;
    const prev = new Map<string, [number, number, string] | null>([[k(h.x, h.y), null]]);
    const q: [number, number][] = [[h.x, h.y]];
    const D: [number, number, string][] = [[0, -1, 'ArrowUp'], [1, 0, 'ArrowRight'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft']];
    while (q.length) {
      const [x, y] = q.shift()!;
      if (x === tx && y === ty) break;
      for (const [dx, dy, c] of D) {
        const nx = x + dx, ny = y + dy;
        if (prev.has(k(nx, ny))) continue;
        const tile = f.tile(nx, ny);
        if (!tile || tile.solid || (f.actorAt(nx, ny, h) && !(nx === tx && ny === ty))) continue;
        prev.set(k(nx, ny), [x, y, c]);
        q.push([nx, ny]);
      }
    }
    if (!prev.has(k(tx, ty))) return null;
    const path: string[] = [];
    let cur = k(tx, ty);
    while (prev.get(cur)) { const [px, py, c] = prev.get(cur)!; path.unshift(c); cur = k(px, py); }
    return path;
  },
  async go(tx: number, ty: number, max = 300): Promise<string> {
    const f = game.stack[0] as FieldScene;
    const startMap = f.map.id;
    for (let i = 0; i < max; i++) {
      if (f.hero.x === tx && f.hero.y === ty) return 'arrived';
      const p = dbg.route(tx, ty);
      if (!p || !p.length) return `no path from ${f.hero.x},${f.hero.y}`;
      await dbg.hold(p[0], 2);
      await dbg.frames(8);
      if (game.stack.length > 1 || f.map.id !== startMap) return `interrupted at ${f.hero.x},${f.hero.y} (${game.stack.map((s) => s.constructor.name).join('>')})`;
    }
    return 'gave up';
  },
  async talk(dir: string) { await dbg.hold(dir, 1); await dbg.frames(3); await dbg.press('KeyZ', 1, 20); },
  async auto(max = 20000) {
    for (let i = 0; i < max; i++) {
      const top = game.top();
      if (!top) return 'empty';
      const name = top.constructor.name.replace(/^_+/, '');
      if (name === 'FieldScene' && !(top as FieldScene).busy) return 'field';
      if (name === 'BattleScene') {
        const b = top as BattleScene;
        if (b.phase === 'menu' || b.phase === 'end' || b.phase === 'listen' || b.phase === 'intro') dbg.key('KeyZ');
      } else if (name === 'DialogueScene' || name === 'CardScene' || name === 'GameOverScene') dbg.key('KeyZ');
      game.run(1);
      for (let j = 0; j < 4; j++) await Promise.resolve();
    }
    return 'timeout';
  },
  // A story run that only advances while dbg.pump is running, for browsers that freeze hidden pages.
  storyStart(ending: number[] = [0]) {
    pump.out = []; pump.done = false; pump.queue = [];
    const frames = async (n: number) => { for (let i = 0; i < n; i++) { await new Promise<void>((r) => pump.queue.push(r)); game.run(1); } };
    dbg.newGame('I wish someone would remember me');
    storyTest(game, (s) => { pump.out.push(s); }, frames, dbg.key, ending).then(() => { pump.done = true; }, (e) => { pump.out.push('ERR ' + e); pump.done = true; });
  },
  pumpState() { return { q: pump.queue.length, done: pump.done }; },
  async pump(ms = 30000) {
    const end = Date.now() + ms;
    while (Date.now() < end && !pump.done) {
      const r = pump.queue.shift();
      if (r) r();
      for (let i = 0; i < 6; i++) await Promise.resolve();
    }
    return { done: pump.done, map: game.state?.map, out: pump.out.join('\n') };
  },
  async story(ending: number[] = [0]) {
    const out: string[] = [];
    dbg.newGame('I wish someone would remember me');
    await storyTest(game, (s) => { out.push(s); console.log(s); }, dbg.frames, dbg.key, ending);
    return out.join('\n');
  },
  info() {
    const s = game.state!;
    return JSON.stringify({ map: s.map, x: s.x, y: s.y, party: s.party, lv: Object.values(s.roster).map((m) => m.id + m.lvl), flags: s.flags, inv: s.inv, pleas: s.pleas, stack: game.stack.map((x) => x.constructor.name) });
  },
};
(window as unknown as { dbg: typeof dbg }).dbg = dbg;
