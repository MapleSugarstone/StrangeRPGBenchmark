import { dither, H, INK, W } from '../engine/screen';

/** A screen or overlay. The top mode gets input. Every mode in the stack draws, bottom first, unless one is opaque. */
export interface Mode {
  update(): void;
  /** Runs every step for every mode in the stack, top or not. */
  tick?(): void;
  draw(): void;
  opaque?: boolean;
  finish?: (v: any) => void;
}

const stack: Mode[] = [];

export function top(): Mode | undefined { return stack[stack.length - 1]; }
export function modes(): Mode[] { return stack; }

/** Pushes a mode and resolves when it calls `close`. */
export function run<T>(m: Mode): Promise<T> {
  return new Promise<T>(res => {
    m.finish = (v: T) => res(v);
    stack.push(m);
  });
}

export function close(m: Mode, v?: any): void {
  const i = stack.indexOf(m);
  if (i >= 0) stack.splice(i, 1);
  m.finish?.(v);
}

export function replaceAll(m: Mode): void {
  stack.length = 0;
  stack.push(m);
}

export function push(m: Mode): void { stack.push(m); }

/** Frames a fade to or from black takes. Every change of the full-screen mode fades in, so no scene cuts in. */
const FADE = 14;
let fadeIn = 0, fadeOut = 0, held = 0, lastBase: Mode | null = null;

export function tickAll(): void {
  if (fadeIn > 0) fadeIn--;
  if (fadeOut > 0 && fadeOut < FADE) fadeOut++;
  // A fade to black that no scene change follows lifts again rather than leaving the screen dark.
  else if (fadeOut >= FADE && ++held > 40) { fadeOut = 0; held = 0; fadeIn = FADE; }
  for (const m of stack.slice()) m.tick?.();
}

export function drawAll(): void {
  let start = 0;
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].opaque) { start = i; break; }
  const base = stack[start] ?? null;
  if (base !== lastBase) {
    if (lastBase) fadeIn = FADE;
    fadeOut = 0; held = 0; lastBase = base;
  }
  for (let i = start; i < stack.length; i++) stack[i].draw();
  const dark = Math.max(fadeIn, fadeOut) / FADE;
  if (dark > 0) dither(0, 0, W, H, INK, dark);
}

/** Fades the screen to black, for just before a change of scene. The next scene fades in on its own. */
export function fadeToBlack(): Promise<void> {
  fadeOut = 1; held = 0;
  return wait(FADE);
}

export function wait(frames: number): Promise<void> {
  let n = frames;
  const m: Mode = { update() { if (--n <= 0) close(m); }, draw() {} };
  return run(m);
}
