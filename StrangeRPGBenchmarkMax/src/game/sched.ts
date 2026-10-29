// A frame scheduler for scripted waits. Scenes await conditions, and the main loop checks them each frame.

interface Waiter { check: () => boolean; resolve: () => void }
let waiters: Waiter[] = [];
let time = 0;

/** Resolves on the first frame the condition holds. */
export function until(check: () => boolean): Promise<void> {
  if (check()) return Promise.resolve();
  return new Promise((resolve) => waiters.push({ check, resolve }));
}

/** Resolves after a number of seconds of game time. */
export function sleep(seconds: number): Promise<void> {
  const end = time + seconds;
  return until(() => time >= end);
}

/** Resolves on the next frame. */
export function nextFrame(): Promise<void> {
  const start = time;
  return until(() => time > start);
}

export function tickScheduler(dt: number) {
  time += dt;
  const ready: Waiter[] = [];
  waiters = waiters.filter((w) => { if (w.check()) { ready.push(w); return false; } return true; });
  for (const w of ready) w.resolve();
}

export function now(): number { return time; }
