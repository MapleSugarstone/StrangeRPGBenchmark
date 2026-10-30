// A small scheduler for scenes: promises that resolve after a time or when a condition turns true.

interface Waiter { done: () => boolean; resolve: () => void }
const waiters: Waiter[] = [];
let clock = 0;

export function now(): number { return clock; }

export function wait(seconds: number): Promise<void> {
  const end = clock + seconds;
  return until(() => clock >= end);
}

export function until(cond: () => boolean): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise((resolve) => waiters.push({ done: cond, resolve }));
}

export function tickScheduler(dt: number) {
  clock += dt;
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w.done()) { waiters.splice(i, 1); w.resolve(); }
  }
}
