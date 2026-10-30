// Keyboard, gamepad, and mouse input, read once per frame as held, pressed, and repeating buttons.
import { toFrame } from './screen';

export type Button =
  | 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'tab' | 'sneak' | 'run' | 'mute' | 'end'
  | 'n1' | 'n2' | 'n3' | 'n4' | 'n5' | 'n6' | 'n7' | 'n8' | 'n9' | 'n0' | 'map' | 'journal' | 'inv' | 'rename' | 'edge';

const KEYS: Record<string, Button> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a', NumpadEnter: 'a', KeyX: 'b', Escape: 'b', Backspace: 'b',
  Tab: 'tab', KeyC: 'sneak', ShiftLeft: 'run', ShiftRight: 'run', KeyM: 'mute', KeyE: 'end',
  Digit1: 'n1', Digit2: 'n2', Digit3: 'n3', Digit4: 'n4', Digit5: 'n5', Digit6: 'n6', Digit7: 'n7', Digit8: 'n8', Digit9: 'n9', Digit0: 'n0',
  KeyQ: 'map', KeyJ: 'journal', KeyI: 'inv', KeyR: 'rename', KeyF: 'edge',
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

/** Mouse position in frame pixels, whether it moved this frame, and its buttons. */
export const MOUSE = { x: -1, y: -1, moved: false, inside: false, left: false, right: false, wheel: 0, lastMove: 0 };
let mouseMovedQueue = false;
let leftQueue = false, rightQueue = false, wheelQueue = 0;

/** While on, a key that types a character only types it, so a name with Z or X in it does not also confirm or go back. */
export function setTextMode(on: boolean) { textMode = on; typed = []; }
const gestureHooks: (() => void)[] = [];

export function onFirstGesture(f: () => void) { gestureHooks.push(f); }

function gesture() {
  if (anyGesture) return;
  anyGesture = true;
  for (const f of gestureHooks) f();
}

export function attachInput(target: Window, canvas: HTMLCanvasElement) {
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
  canvas.addEventListener('pointermove', (e) => {
    const p = toFrame(e.clientX, e.clientY);
    if (!p) { MOUSE.inside = false; return; }
    if (p[0] !== MOUSE.x || p[1] !== MOUSE.y) mouseMovedQueue = true;
    MOUSE.x = p[0]; MOUSE.y = p[1]; MOUSE.inside = true;
  });
  canvas.addEventListener('pointerleave', () => { MOUSE.inside = false; });
  canvas.addEventListener('pointerdown', (e) => {
    gesture();
    const p = toFrame(e.clientX, e.clientY);
    if (p) { MOUSE.x = p[0]; MOUSE.y = p[1]; MOUSE.inside = true; }
    if (e.button === 0) leftQueue = true;
    if (e.button === 2) rightQueue = true;
    canvas.focus();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { wheelQueue += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
}

const PAD: [number, Button][] = [[12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'], [0, 'a'], [1, 'b'], [2, 'sneak'], [3, 'tab'], [5, 'end'], [9, 'b'], [4, 'map']];
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

let clock = 0;

/** Call once at the start of every update. */
export function pollInput(dt: number) {
  clock += dt;
  pollPad();
  const before = new Set(held);
  held.clear();
  for (const b of keyHeld) held.add(b);
  for (const b of padHeld) held.add(b);
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
  MOUSE.moved = mouseMovedQueue; mouseMovedQueue = false;
  if (MOUSE.moved) MOUSE.lastMove = clock;
  MOUSE.left = leftQueue; leftQueue = false;
  MOUSE.right = rightQueue; rightQueue = false;
  MOUSE.wheel = wheelQueue; wheelQueue = 0;
  if (MOUSE.right) pressedNow.add('b');
}

/** True while the mouse moved recently enough that it should drive the cursor. */
export function mouseActive(): boolean { return MOUSE.inside && clock - MOUSE.lastMove < 4; }

export function isDown(b: Button): boolean { return held.has(b); }
export function pressed(b: Button): boolean { return pressedNow.has(b); }
/** Pressed this frame, or held long enough to auto-repeat. For menus. */
export function repeat(b: Button): boolean { return pressedNow.has(b) || repeatFired.has(b); }
/** Swallows this frame's presses, so one key press does not act twice across a mode change. */
export function consume() { pressedNow.clear(); repeatFired.clear(); MOUSE.left = false; MOUSE.right = false; MOUSE.wheel = 0; }
/** Characters typed since the last call, for name entry. */
export function takeTyped(): string[] { const t = typed; typed = []; return t; }
export function clearTyped() { typed = []; }

/** For tests and the browser harness: press a button on the next poll. */
export function injectPress(b: Button) { pressedQueue.add(b); }
export function injectHold(b: Button, on: boolean) { if (on) keyHeld.add(b); else keyHeld.delete(b); }
export function injectClick(x: number, y: number, right = false) { MOUSE.x = x; MOUSE.y = y; MOUSE.inside = true; mouseMovedQueue = true; if (right) rightQueue = true; else leftQueue = true; }
