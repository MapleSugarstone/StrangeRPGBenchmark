import type { Script, ScriptFn } from './types';

// One cutscene runs at a time. A script yields to wait a frame and is stepped once per frame.

let cur: Script | null = null;
const queue: ScriptFn[] = [];

export function run(fn: ScriptFn): void {
  queue.push(fn);
  if (!cur) next();
}

function next(): void {
  const fn = queue.shift();
  cur = fn ? fn() : null;
}

export function stepScripts(): void {
  if (!cur && queue.length) next();
  let guard = 0;
  while (cur && guard++ < 50) {
    const r = cur.next();
    if (r.done) { next(); continue; }
    if (r.value === 'again') continue;
    break;
  }
}

export function busy(): boolean { return cur !== null || queue.length > 0; }

export function clearScripts(): void { cur = null; queue.length = 0; }
