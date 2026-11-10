// Input, the frame-driven coroutine runner, and the widgets every screen shares.
// Flows are generators that yield once a frame, so a test harness can step frames synchronously.
import { C, frame, panel, rect, text, textWidth, wrap, W, H } from '../gfx/screen';

export type Co<X> = Generator<void, X, void>;

export interface Widget { draw(): void; kind?: string; info?: Record<string, unknown> }

const KEYMAP: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
  z: 'ok', Enter: 'ok', ' ': 'ok', x: 'back', Escape: 'back', Tab: 'tab', e: 'end', m: 'mute', q: 'info', Shift: 'fast', r: 'rules',
};

export class Input {
  private down = new Set<string>();
  private hit = new Set<string>();
  mouseX = -1;
  mouseY = -1;
  clicked = false;
  moved = false;
  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (ev) => {
      const k = KEYMAP[ev.key] ?? KEYMAP[ev.key.toLowerCase()];
      if (!k) return;
      ev.preventDefault();
      if (!this.down.has(k)) this.hit.add(k);
      this.down.add(k);
    });
    window.addEventListener('keyup', (ev) => {
      const k = KEYMAP[ev.key] ?? KEYMAP[ev.key.toLowerCase()];
      if (k) this.down.delete(k);
    });
    const pos = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = Math.floor(((ev.clientX - r.left) / r.width) * W);
      this.mouseY = Math.floor(((ev.clientY - r.top) / r.height) * H);
    };
    canvas.addEventListener('mousemove', (ev) => { pos(ev); this.moved = true; });
    canvas.addEventListener('mousedown', (ev) => { pos(ev); if (ev.button === 0) this.clicked = true; else this.hit.add('back'); ev.preventDefault(); });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  pressed(k: string): boolean { return this.hit.has(k); }
  held(k: string): boolean { return this.down.has(k); }
  press(k: string): void { this.hit.add(k); }
  endFrame(): void { this.hit.clear(); this.clicked = false; this.moved = false; }
  inRect(x: number, y: number, w: number, h: number): boolean { return this.mouseX >= x && this.mouseY >= y && this.mouseX < x + w && this.mouseY < y + h; }
}

export const input = new Input();
export const widgets: Widget[] = [];
export let frameNo = 0;
export function tickFrame(): void { frameNo++; }

export interface Sound { sfx(name: string): void }
export const sound: Sound = { sfx: () => undefined };

export function* wait(frames: number, skippable = true): Co<void> {
  for (let i = 0; i < frames; i++) {
    if (skippable && (input.held('fast') || input.pressed('ok') || input.clicked)) return;
    yield;
  }
}

export interface MenuItem { label: string; hint?: string; off?: boolean; right?: string; ink?: number }
export interface MenuOpts { title?: string; x?: number; y?: number; w?: number; start?: number; cancel?: boolean; footer?: string }

const lastChoice = new Map<string, number>();

/** A list menu. Returns the chosen index, or -1 when the player backs out. The cursor starts on the last choice made in a menu with the same title. */
export function* menu(items: MenuItem[], opts: MenuOpts = {}): Co<number> {
  const pad = 5, row = 10;
  let w = opts.w ?? 0;
  if (!w) {
    for (const it of items) w = Math.max(w, textWidth(it.label) + (it.right ? textWidth(it.right) + 10 : 0));
    if (opts.title) w = Math.max(w, textWidth(opts.title));
    w += pad * 2 + 8;
  }
  const hints = items.some((it) => it.hint) || !!opts.footer;
  const h = pad * 2 + items.length * row + (opts.title ? 12 : 0) + (hints ? 22 : 0);
  const x = Math.max(2, Math.min(W - w - 4, opts.x ?? Math.floor((W - w) / 2)));
  const y = Math.max(2, Math.min(H - h - 4, opts.y ?? Math.floor((H - h) / 2)));
  const key = opts.title ?? '';
  let cur = opts.start ?? (key ? lastChoice.get(key) ?? 0 : 0);
  if (cur >= items.length || cur < 0) cur = 0;
  if (items[cur]?.off) { const i = items.findIndex((it) => !it.off); if (i >= 0) cur = i; }
  const top = y + pad + (opts.title ? 12 : 0);
  const widget: Widget = {
    draw() {
      panel(x, y, w, h);
      if (opts.title) { text(opts.title, x + pad, y + pad, C.sepia); rect(x + pad, y + pad + 9, w - pad * 2, 1, C.paper3); }
      items.forEach((it, i) => {
        const yy = top + i * row;
        if (i === cur) rect(x + 2, yy - 1, w - 4, row, C.paper2);
        if (i === cur) text('>', x + pad - 1, yy, C.perch);
        text(it.label, x + pad + 7, yy, it.off ? C.pencil : it.ink ?? C.ink);
        if (it.right) text(it.right, x + w - pad - textWidth(it.right), yy, it.off ? C.pencil : C.sepia);
      });
      if (hints) {
        const hint = items[cur]?.hint ?? opts.footer ?? '';
        rect(x + pad, top + items.length * row + 1, w - pad * 2, 1, C.paper3);
        wrap(hint, w - pad * 2).slice(0, 2).forEach((ln, i) => text(ln, x + pad, top + items.length * row + 4 + i * 9, C.sepia));
      }
    },
  };
  widget.kind = 'menu';
  widget.info = { items, title: opts.title ?? '', cur: () => cur, set: (i: number) => { cur = i; } };
  widgets.push(widget);
  yield;
  let result = -2;
  while (result === -2) {
    if (input.pressed('up')) { do { cur = (cur + items.length - 1) % items.length; } while (items.every((it) => it.off) ? false : items[cur].off && items.some((it) => !it.off)); sound.sfx('tick'); }
    if (input.pressed('down')) { do { cur = (cur + 1) % items.length; } while (items[cur].off && items.some((it) => !it.off)); sound.sfx('tick'); }
    if (input.moved || input.clicked) {
      for (let i = 0; i < items.length; i++) if (input.inRect(x, top + i * row - 1, w, row) && !items[i].off) cur = i;
    }
    if (input.pressed('ok') || (input.clicked && input.inRect(x, top - 1, w, items.length * row))) {
      if (!items[cur].off) { result = cur; sound.sfx('ok'); }
      else sound.sfx('no');
    } else if ((input.pressed('back') || (input.clicked && !input.inRect(x, y, w, h))) && opts.cancel !== false) { result = -1; sound.sfx('back'); }
    if (result === -2) yield;
  }
  widgets.splice(widgets.indexOf(widget), 1);
  if (key && result >= 0) lastChoice.set(key, result);
  yield;
  return result;
}

/** A dialogue box across the bottom of the screen. Waits for the player to confirm. */
export function* say(speaker: string, body: string, ink: number = C.ink, system = false, auto = 0): Co<void> {
  const lines = wrap(body, W - 28);
  let shown = 0;
  let held = 0;
  const total = body.length;
  const widget: Widget = {
    draw() {
      const bh = 20 + Math.max(2, lines.length) * 10;
      const by = H - bh - 3;
      panel(4, by, W - 10, bh, system ? C.paper2 : C.paper);
      if (speaker) {
        const tw = textWidth(speaker) + 8;
        rect(8, by - 6, tw, 11, C.paper);
        frame(8, by - 6, tw, 11, C.ink);
        text(speaker, 12, by - 4, ink);
      }
      let left = shown;
      lines.forEach((ln, i) => {
        if (left <= 0) return;
        const part = ln.slice(0, left);
        left -= ln.length + 1;
        text(part, 12, by + 9 + i * 10, system ? C.sepia : C.ink);
      });
      if (shown >= total && (frameNo >> 4) & 1) text('>', W - 18, by + bh - 11, C.perch);
    },
  };
  widget.kind = 'say';
  widget.info = { speaker, body };
  widgets.push(widget);
  yield;
  for (;;) {
    const go = input.pressed('ok') || input.clicked;
    if (shown < total) {
      shown += input.held('fast') ? 8 : 2;
      if (shown % 6 < 2 && !system) sound.sfx('talk');
      if (go) shown = total;
    } else if (go || input.held('fast') || (auto > 0 && ++held > auto)) break;
    yield;
  }
  widgets.splice(widgets.indexOf(widget), 1);
  sound.sfx('tick');
  yield;
}

/** A yes or no question in a small panel. Returns true for the first answer. */
export function* confirm(question: string, yes = 'Yes', no = 'No', hintYes = '', hintNo = ''): Co<boolean> {
  const r = yield* menu([{ label: yes, hint: hintYes }, { label: no, hint: hintNo }], { title: question, cancel: false, w: Math.max(150, textWidth(question) + 20) });
  return r === 0;
}

/** A number picker from lo to hi. Returns -1 when cancelled. */
export function* pickNumber(title: string, lo: number, hi: number, start: number, unit: string): Co<number> {
  let v = Math.max(lo, Math.min(hi, start));
  const w = Math.max(120, textWidth(title) + 20);
  const x = Math.floor((W - w) / 2), y = 100;
  const widget: Widget = {
    draw() {
      panel(x, y, w, 40);
      text(title, x + 6, y + 5, C.sepia);
      const label = '< ' + v + ' ' + unit + ' >';
      text(label, x + Math.floor((w - textWidth(label)) / 2), y + 18, C.ink);
      text('Left, Right: change   Z: confirm', x + 6, y + 30, C.pencil);
    },
  };
  widget.kind = 'number';
  widget.info = { title, set: (n: number) => { v = Math.max(lo, Math.min(hi, n)); } };
  widgets.push(widget);
  yield;
  let out = -2;
  while (out === -2) {
    if (input.pressed('left') && v > lo) { v--; sound.sfx('tick'); }
    if (input.pressed('right') && v < hi) { v++; sound.sfx('tick'); }
    if (input.clicked) { if (input.mouseX < W / 2 - 10 && v > lo) v--; else if (input.mouseX > W / 2 + 10 && v < hi) v++; else out = v; }
    if (input.pressed('ok')) out = v;
    if (input.pressed('back')) out = -1;
    if (out === -2) yield;
  }
  widgets.splice(widgets.indexOf(widget), 1);
  yield;
  return out;
}

/** Shows text pages until the player backs out. */
export function* pages(title: string, body: string[][]): Co<void> {
  let page = 0;
  const widget: Widget = {
    draw() {
      panel(8, 8, W - 18, H - 18);
      text(title, 14, 13, C.sepia);
      const tag = page + 1 + ' / ' + body.length;
      text(tag, W - 18 - textWidth(tag), 13, C.pencil);
      rect(14, 23, W - 30, 1, C.paper3);
      let y = 28;
      for (const para of body[page]) {
        const head = para.startsWith('# ');
        for (const ln of wrap(head ? para.slice(2) : para, W - 34)) { text(ln, 14, y, head ? C.perch : C.ink); y += 9; }
        y += head ? 1 : 3;
      }
      text('Left, Right: page   X: close', 14, H - 22, C.pencil);
    },
  };
  widget.kind = 'pages';
  widget.info = { title };
  widgets.push(widget);
  yield;
  for (;;) {
    if ((input.pressed('right') || input.pressed('ok') || (input.clicked && input.mouseX > W / 2)) && page < body.length - 1) { page++; sound.sfx('page'); }
    else if ((input.pressed('left') || (input.clicked && input.mouseX <= W / 2)) && page > 0) { page--; sound.sfx('page'); }
    else if (input.pressed('back') || ((input.pressed('ok') || input.clicked) && page === body.length - 1)) break;
    yield;
  }
  widgets.splice(widgets.indexOf(widget), 1);
  yield;
}
