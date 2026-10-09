export type Btn = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'wear' | 'menu' | 'fast' | 'mute' | 'goal';

const MAP: Record<string, Btn> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'back', Escape: 'back', Backspace: 'back', KeyC: 'wear',
  KeyV: 'menu', ShiftLeft: 'fast', ShiftRight: 'fast', KeyM: 'mute', Tab: 'goal',
};

const held = new Set<Btn>();
const pressed = new Set<Btn>();
const repeatAt = new Map<Btn, number>();
let typed: string[] = [];

window.addEventListener('keydown', e => {
  const b = MAP[e.code];
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) typed.push(e.key);
  if (e.key === 'Backspace') typed.push('\b');
  if (!b) return;
  e.preventDefault();
  if (!held.has(b)) { pressed.add(b); repeatAt.set(b, performance.now() + 260); }
  held.add(b);
});
window.addEventListener('keyup', e => {
  const b = MAP[e.code];
  if (b) { held.delete(b); repeatAt.delete(b); }
});
window.addEventListener('blur', () => { held.clear(); repeatAt.clear(); });

export const input = {
  held: (b: Btn) => held.has(b),
  /** True once per press, plus key repeat for directions. */
  hit(b: Btn): boolean {
    if (pressed.has(b)) return true;
    if ((b === 'up' || b === 'down' || b === 'left' || b === 'right') && held.has(b)) {
      const t = repeatAt.get(b) || 0;
      if (performance.now() >= t) { repeatAt.set(b, performance.now() + 85); return true; }
    }
    return false;
  },
  /** Call at the end of each frame. */
  end(): void { pressed.clear(); typed = []; },
  typed: () => typed,
  press(b: Btn): void { pressed.add(b); },
  hold(b: Btn, on: boolean): void { if (on) { if (!held.has(b)) pressed.add(b); held.add(b); repeatAt.set(b, performance.now() + 260); } else held.delete(b); },
  clear(): void { pressed.clear(); },
};
