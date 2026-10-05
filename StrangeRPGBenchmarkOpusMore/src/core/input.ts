export type Btn = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'menu' | 'aux' | 'listen' | 'run';
const BTNS: Btn[] = ['up', 'down', 'left', 'right', 'ok', 'back', 'menu', 'aux', 'listen', 'run'];

// In one-player mode both key sets drive player 0. In two-player mode WASD is player 0 and the arrows are player 1.
const KEYS_P1: Record<string, Btn> = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyF: 'ok', Space: 'ok', KeyG: 'back', KeyQ: 'menu', KeyE: 'listen', Tab: 'aux', ShiftLeft: 'run',
};
const KEYS_P2: Record<string, Btn> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyZ: 'ok', Enter: 'ok', KeyX: 'back', Escape: 'back', ShiftRight: 'back', Backspace: 'back',
  KeyC: 'listen', KeyV: 'menu', Slash: 'aux',
};

class PadState {
  held = new Set<Btn>();
  pressed = new Set<Btn>();
  repeat = new Map<Btn, number>();
}

export class Input {
  twoPlayer = false;
  players = [new PadState(), new PadState()];
  textHandler: ((e: KeyboardEvent) => void) | null = null;
  anyKey = false;
  private rawDown = new Set<string>();
  private padPrev: Set<Btn>[] = [new Set(), new Set()];

  constructor(target: HTMLElement | Window) {
    target.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      this.anyKey = true;
      if (this.textHandler) {
        this.textHandler(e);
        e.preventDefault();
        return;
      }
      const hit = this.map(e.code);
      if (hit) {
        e.preventDefault();
        if (!this.rawDown.has(e.code)) this.press(hit[0], hit[1]);
      }
      this.rawDown.add(e.code);
    });
    target.addEventListener('keyup', (ev) => {
      const e = ev as KeyboardEvent;
      this.rawDown.delete(e.code);
      const hit = this.map(e.code);
      if (hit) this.release(hit[0], hit[1]);
    });
    window.addEventListener('blur', () => {
      this.rawDown.clear();
      for (const p of this.players) { p.held.clear(); p.repeat.clear(); }
    });
  }

  private map(code: string): [number, Btn] | null {
    if (KEYS_P1[code]) return [0, KEYS_P1[code]];
    if (KEYS_P2[code]) return [this.twoPlayer ? 1 : 0, KEYS_P2[code]];
    return null;
  }

  private press(p: number, b: Btn) {
    const st = this.players[p];
    st.held.add(b);
    st.pressed.add(b);
    st.repeat.set(b, 0);
  }

  private release(p: number, b: Btn) {
    this.players[p].held.delete(b);
    this.players[p].repeat.delete(b);
  }

  // Polls gamepads. Pad 0 is player 0, pad 1 is player 1 in two-player mode.
  pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 2; i++) {
      const gp = pads[i];
      if (!gp) continue;
      const p = this.twoPlayer ? i : 0;
      const now = new Set<Btn>();
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      const b = (n: number) => !!gp.buttons[n]?.pressed;
      if (ay < -0.5 || b(12)) now.add('up');
      if (ay > 0.5 || b(13)) now.add('down');
      if (ax < -0.5 || b(14)) now.add('left');
      if (ax > 0.5 || b(15)) now.add('right');
      if (b(0)) now.add('ok');
      if (b(1)) now.add('back');
      if (b(9)) now.add('menu');
      if (b(2)) now.add('listen');
      if (b(3) || b(8)) now.add('aux');
      if (b(5) || b(7)) now.add('run');
      const prev = this.padPrev[i];
      for (const btn of BTNS) {
        if (now.has(btn) && !prev.has(btn)) this.press(p, btn);
        if (!now.has(btn) && prev.has(btn)) this.release(p, btn);
      }
      this.padPrev[i] = now;
      if (now.size) this.anyKey = true;
    }
  }

  // Called once per frame after the scene update.
  endFrame() {
    for (const st of this.players) {
      st.pressed.clear();
      for (const [b, t] of st.repeat) {
        const n = t + 1;
        st.repeat.set(b, n);
        if (n > 18 && (n - 18) % 5 === 0 && (b === 'up' || b === 'down' || b === 'left' || b === 'right')) st.pressed.add(b);
      }
    }
    this.anyKey = false;
  }

  // p = -1 means either player.
  pressed(b: Btn, p = -1): boolean {
    if (p >= 0) return this.players[p].pressed.has(b);
    return this.players[0].pressed.has(b) || this.players[1].pressed.has(b);
  }

  held(b: Btn, p = -1): boolean {
    if (p >= 0) return this.players[p].held.has(b);
    return this.players[0].held.has(b) || this.players[1].held.has(b);
  }

  consume(b: Btn) {
    this.players[0].pressed.delete(b);
    this.players[1].pressed.delete(b);
  }

  clearAll() {
    for (const st of this.players) { st.pressed.clear(); }
  }
}
