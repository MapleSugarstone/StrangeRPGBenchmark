export type Btn = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c' | 'mute' | 'debug';

const KEYMAP: Record<string, Btn> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Space: 'a', Enter: 'a', NumpadEnter: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b',
  KeyC: 'c', ShiftLeft: 'c', ShiftRight: 'c',
  KeyM: 'mute',
  Backquote: 'debug',
};

const ALL: Btn[] = ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'mute', 'debug'];

export class Input {
  private down = new Set<Btn>();
  private held = new Map<Btn, number>();
  private pressedNow = new Set<Btn>();
  private queue: Btn[] = [];
  onAny: (() => void) | null = null;

  attach(target: Window) {
    target.addEventListener('keydown', e => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      if (!this.down.has(b)) this.queue.push(b);
      this.down.add(b);
      this.onAny?.();
    });
    target.addEventListener('keyup', e => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      this.down.delete(b);
    });
    target.addEventListener('blur', () => this.down.clear());
  }

  /** Call once per frame before updating scenes. */
  tick() {
    this.pressedNow.clear();
    for (const b of this.queue) this.pressedNow.add(b);
    this.queue.length = 0;
    for (const b of ALL) {
      if (this.down.has(b)) this.held.set(b, (this.held.get(b) ?? 0) + 1);
      else this.held.set(b, 0);
    }
  }

  isDown(b: Btn): boolean {
    return this.down.has(b) || this.pressedNow.has(b);
  }

  pressed(b: Btn): boolean {
    return this.pressedNow.has(b);
  }

  /** True on press and then on a repeat cadence while held. */
  repeat(b: Btn): boolean {
    if (this.pressedNow.has(b)) return true;
    const h = this.held.get(b) ?? 0;
    return h > 14 && (h - 14) % 4 === 0;
  }

  consume() {
    this.pressedNow.clear();
  }
}
