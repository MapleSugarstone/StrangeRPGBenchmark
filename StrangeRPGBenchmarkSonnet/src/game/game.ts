import { newGame, type GameState } from '../core/party';
import { Rng } from '../core/rng';
import { Screen, W, H } from '../gfx/screen';
import { Music, trackFor } from './music';

export type Key = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu';

export class Input {
  held = new Set<Key>();
  pressed = new Set<Key>();
  private map: Record<string, Key> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right', z: 'a', Z: 'a', Enter: 'a', ' ': 'a', x: 'b', X: 'b', Escape: 'b', Backspace: 'b', c: 'menu', C: 'menu', Tab: 'menu',
  };
  attach(target: Window) {
    target.addEventListener('keydown', (e) => {
      const k = this.map[e.key];
      if (!k) return;
      e.preventDefault();
      const isDir = k === 'up' || k === 'down' || k === 'left' || k === 'right';
      if (!e.repeat || isDir) this.pressed.add(k);
      this.held.add(k);
    });
    target.addEventListener('keyup', (e) => {
      const k = this.map[e.key];
      if (k) this.held.delete(k);
    });
    target.addEventListener('blur', () => this.held.clear());
  }
  press(k: Key) { this.pressed.add(k); this.held.add(k); }
  release(k: Key) { this.held.delete(k); }
  was(k: Key): boolean { return this.pressed.has(k); }
  endFrame() { this.pressed.clear(); }
  dir(): { dx: number; dy: number } | null {
    if (this.held.has('up')) return { dx: 0, dy: -1 };
    if (this.held.has('down')) return { dx: 0, dy: 1 };
    if (this.held.has('left')) return { dx: -1, dy: 0 };
    if (this.held.has('right')) return { dx: 1, dy: 0 };
    return null;
  }
}

export class Audio {
  ctx: AudioContext | null = null;
  muted = false;
  /** Creates or resumes the audio context. Browsers require a user gesture first. */
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
  private init() {
    if (!this.ctx && typeof window !== 'undefined' && 'AudioContext' in window) this.ctx = new AudioContext();
  }
  beep(freq: number, dur = 0.06, type: OscillatorType = 'square', vol = 0.04, slide = 0) {
    if (this.muted) return;
    this.init();
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }
  sfx(name: string) {
    switch (name) {
      case 'move': this.beep(120, 0.03, 'triangle', 0.02); break;
      case 'ok': this.beep(520, 0.05); break;
      case 'cancel': this.beep(260, 0.05); break;
      case 'cursor': this.beep(380, 0.025, 'square', 0.02); break;
      case 'text': this.beep(300 + Math.random() * 60, 0.02, 'square', 0.012); break;
      case 'hit': this.beep(160, 0.12, 'sawtooth', 0.05, -100); break;
      case 'crit': this.beep(240, 0.18, 'sawtooth', 0.06, -180); break;
      case 'heal': this.beep(520, 0.15, 'sine', 0.05, 300); break;
      case 'ko': this.beep(200, 0.35, 'sawtooth', 0.05, -160); break;
      case 'magic': this.beep(440, 0.2, 'triangle', 0.05, 440); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.14, 'square', 0.04), i * 110)); break;
      case 'lose': [330, 262, 196, 147].forEach((f, i) => setTimeout(() => this.beep(f, 0.22, 'sawtooth', 0.04), i * 160)); break;
      case 'chest': [660, 880].forEach((f, i) => setTimeout(() => this.beep(f, 0.1), i * 80)); break;
      case 'levelup': [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'triangle', 0.05), i * 90)); break;
      case 'encounter': this.beep(90, 0.4, 'sawtooth', 0.06, 500); break;
    }
  }
}

export interface Scene {
  musicKind?: 'title' | 'world' | 'battle' | 'boss';
  update(g: Game): void;
  draw(g: Game, s: Screen): void;
  /** Called when a scene above this one is popped. */
  resume?(g: Game): void;
}

export interface Overlay {
  update(g: Game): void;
  draw(g: Game, s: Screen): void;
}

export class Game {
  scr = new Screen();
  input = new Input();
  audio = new Audio();
  music = new Music(() => this.audio.ctx, () => this.audio.muted);
  rng = new Rng((Date.now() & 0xfffffff) + 1);
  state: GameState = newGame(1);
  scenes: Scene[] = [];
  overlays: Overlay[] = [];
  frame = 0;
  shake = 0;
  flash = 0;
  fade = 0;
  ctx: CanvasRenderingContext2D | null = null;
  img: ImageData | null = null;
  lastSave = 0;

  push(s: Scene) { this.scenes.push(s); }
  pop() { this.scenes.pop(); this.scenes[this.scenes.length - 1]?.resume?.(this); }
  replace(s: Scene) { this.scenes = [s]; }
  get top(): Scene | undefined { return this.scenes[this.scenes.length - 1]; }

  /** Runs an overlay until it calls its own resolve. */
  overlay<T>(make: (resolve: (v: T) => void) => Overlay): Promise<T> {
    return new Promise<T>((res) => {
      const ov = make((v) => { this.overlays = this.overlays.filter((o) => o !== ov); res(v); });
      this.overlays.push(ov);
    });
  }

  tick() {
    this.frame++;
    if (this.input.pressed.size) this.audio.unlock();
    if (this.frame % 30 === 0) {
      let kind: Scene['musicKind'];
      for (let i = this.scenes.length - 1; i >= 0 && !kind; i--) kind = this.scenes[i].musicKind;
      this.music.set(kind ? trackFor(kind, kind === 'title' ? 1 : this.state.chapter) : null);
    }
    if (this.shake > 0) this.shake--;
    if (this.flash > 0) this.flash--;
    const ov = this.overlays[this.overlays.length - 1];
    if (ov) ov.update(this);
    else this.top?.update(this);
    this.input.endFrame();
  }

  render() {
    const s = this.scr;
    s.clear();
    for (const sc of this.scenes) sc.draw(this, s);
    for (const ov of this.overlays) ov.draw(this, s);
    if (this.flash > 0) for (let i = 0; i < s.buf.length; i++) if ((i + this.flash) % 2 === 0) s.buf[i] = 0xffffffff;
    if (this.shake > 0) {
      const dx = Math.round((Math.random() - 0.5) * 4), dy = Math.round((Math.random() - 0.5) * 4);
      const copy = s.buf.slice();
      s.buf.fill(0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const sx = x - dx, sy = y - dy;
        if (sx >= 0 && sy >= 0 && sx < W && sy < H) s.buf[y * W + x] = copy[sy * W + sx];
      }
    }
    if (this.ctx && this.img) s.present(this.ctx, this.img);
  }

  save(slot = 'auto') {
    try {
      localStorage.setItem('longnoon.save.' + slot, JSON.stringify({ v: 1, state: this.state, t: Date.now() }));
      localStorage.setItem('longnoon.max', String(Math.max(Number(localStorage.getItem('longnoon.max') ?? 1), this.state.chapter)));
      this.lastSave = Date.now();
      return true;
    } catch { return false; }
  }
  hasSave(slot = 'auto'): boolean {
    try { return !!localStorage.getItem('longnoon.save.' + slot); } catch { return false; }
  }
  load(slot = 'auto'): boolean {
    try {
      const raw = localStorage.getItem('longnoon.save.' + slot);
      if (!raw) return false;
      const o = JSON.parse(raw);
      this.state = o.state;
      return true;
    } catch { return false; }
  }
}
