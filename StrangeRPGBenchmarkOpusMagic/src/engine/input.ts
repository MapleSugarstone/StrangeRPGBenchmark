// Keyboard input: actions with key repeat for menus, and a raw text mode for the editor.
export type Action = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'cast' | 'mute' | 'tab' | 'run' | 'page';

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'back', Escape: 'back', Backspace: 'back',
  KeyC: 'cast', KeyM: 'mute', Tab: 'tab', ShiftLeft: 'run', ShiftRight: 'run', KeyR: 'page',
};

const held = new Map<Action, number>();
const fresh = new Set<Action>();
let textHandler: ((e: KeyboardEvent) => boolean) | null = null;
let anyKey = false;

export const clip = {
  onPaste: null as ((text: string) => void) | null,
  onCopy: null as (() => string | null) | null,
  onCut: null as (() => string | null) | null,
};

export function setTextMode(fn: ((e: KeyboardEvent) => boolean) | null) {
  textHandler = fn;
  held.clear();
  fresh.clear();
}

export function inTextMode(): boolean { return textHandler !== null; }

export function initInput() {
  window.addEventListener('keydown', (e) => {
    anyKey = true;
    if (textHandler) {
      if (textHandler(e)) e.preventDefault();
      return;
    }
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!held.has(a)) { held.set(a, 0); fresh.add(a); }
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) held.delete(a);
  });
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('paste', (e) => {
    const t = e.clipboardData?.getData('text/plain');
    if (t && clip.onPaste) { clip.onPaste(t); e.preventDefault(); }
  });
  document.addEventListener('copy', (e) => {
    const t = clip.onCopy?.();
    if (t != null && e.clipboardData) { e.clipboardData.setData('text/plain', t); e.preventDefault(); }
  });
  document.addEventListener('cut', (e) => {
    const t = clip.onCut?.();
    if (t != null && e.clipboardData) { e.clipboardData.setData('text/plain', t); e.preventDefault(); }
  });
}

/** True on the frame the key went down, and again on repeat while held, for menus. */
export function pressed(a: Action): boolean {
  if (fresh.has(a)) return true;
  const t = held.get(a);
  return t !== undefined && t > 16 && (t - 16) % 4 === 0;
}

/** True only on the frame the key went down. */
export function tapped(a: Action): boolean { return fresh.has(a); }

export function down(a: Action): boolean { return held.has(a); }

export function anyTapped(): boolean { return fresh.size > 0; }

export function consumeAny(): boolean { const v = anyKey; anyKey = false; return v; }

/** Call once at the end of every frame. */
export function endFrame() {
  fresh.clear();
  for (const [a, t] of held) held.set(a, t + 1);
}

export function clearInput() {
  fresh.clear();
  for (const a of held.keys()) held.set(a, -1000);
}
