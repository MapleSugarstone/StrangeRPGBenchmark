// Keyboard and gamepad input, read once per frame as held, pressed, and repeating buttons.

export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c' | 'lamp' | 'tab' | 'run' | 'mute' | 'start';

const KEYS: Record<string, Button> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a', KeyX: 'b', Escape: 'b', Backspace: 'b', KeyC: 'c', KeyV: 'lamp', Tab: 'tab',
  ShiftLeft: 'run', ShiftRight: 'run', KeyM: 'mute',
};

const held = new Set<Button>();
const keyHeld = new Set<Button>();
let pressedNow = new Set<Button>();
const pressedQueue = new Set<Button>();
const holdTime = new Map<Button, number>();
const repeatFired = new Set<Button>();
let typed: string[] = [];
let textMode = false;
let anyGesture = false;

/** While on, a key that types a character only types it, so a name with Z or X in it does not also confirm or go back. */
export function setTextMode(on: boolean) { textMode = on; typed = []; }
const gestureHooks: (() => void)[] = [];

export function onFirstGesture(f: () => void) { gestureHooks.push(f); }

function gesture() {
  if (anyGesture) return;
  anyGesture = true;
  for (const f of gestureHooks) f();
}

export function attachInput(target: Window) {
  target.addEventListener('keydown', (e) => {
    gesture();
    const b = KEYS[e.code];
    if (e.key.length === 1) typed.push(e.key);
    else if (e.key === 'Backspace') typed.push('\b');
    else if (e.key === 'Enter') typed.push('\n');
    if (textMode && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) { e.preventDefault(); return; }
    if (!b) return;
    e.preventDefault();
    if (!keyHeld.has(b)) pressedQueue.add(b);
    keyHeld.add(b);
  });
  target.addEventListener('keyup', (e) => {
    const b = KEYS[e.code];
    if (b) keyHeld.delete(b);
  });
  target.addEventListener('blur', () => keyHeld.clear());
  target.addEventListener('pointerdown', () => gesture());
}

const PAD: [number, Button][] = [[12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'], [0, 'a'], [1, 'b'], [2, 'c'], [3, 'tab'], [4, 'lamp'], [9, 'start'], [5, 'run']];
const padHeld = new Set<Button>();

function pollPad() {
  padHeld.clear();
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    for (const [i, b] of PAD) if (p.buttons[i]?.pressed) padHeld.add(b);
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    if (ax < -0.5) padHeld.add('left');
    if (ax > 0.5) padHeld.add('right');
    if (ay < -0.5) padHeld.add('up');
    if (ay > 0.5) padHeld.add('down');
  }
}

/** Call once at the start of every update. */
export function pollInput(dt: number) {
  pollPad();
  const before = new Set(held);
  held.clear();
  for (const b of keyHeld) held.add(b);
  for (const b of padHeld) held.add(b);
  if (padHeld.has('start')) held.add('b');
  pressedNow = new Set(pressedQueue);
  pressedQueue.clear();
  for (const b of held) if (!before.has(b) && padHeld.has(b)) { pressedNow.add(b); gesture(); }
  repeatFired.clear();
  for (const b of held) {
    const t = (holdTime.get(b) ?? 0) + dt;
    const prev = holdTime.get(b) ?? 0;
    holdTime.set(b, t);
    if (prev === 0) continue;
    const first = 0.32, step = 0.075;
    if (t >= first && Math.floor((t - first) / step) > Math.floor(Math.max(0, prev - first) / step)) repeatFired.add(b);
    if (prev < first && t >= first) repeatFired.add(b);
  }
  for (const b of [...holdTime.keys()]) if (!held.has(b)) holdTime.delete(b);
}

export function isDown(b: Button): boolean { return held.has(b); }
export function pressed(b: Button): boolean { return pressedNow.has(b); }
/** Pressed this frame, or held long enough to auto-repeat. For menus. */
export function repeat(b: Button): boolean { return pressedNow.has(b) || repeatFired.has(b); }
/** Swallows this frame's presses, so one key press does not act twice across a mode change. */
export function consume() { pressedNow.clear(); repeatFired.clear(); }
/** Characters typed since the last call, for name entry. */
export function takeTyped(): string[] { const t = typed; typed = []; return t; }
export function clearTyped() { typed = []; }

/** For tests and the browser harness: press a button on the next poll. */
export function injectPress(b: Button) { pressedQueue.add(b); }
export function injectHold(b: Button, on: boolean) { if (on) keyHeld.add(b); else keyHeld.delete(b); }
