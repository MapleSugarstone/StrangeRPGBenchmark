export type Action = "up" | "down" | "left" | "right" | "ok" | "cancel" | "menu" | "run" | "mute" | "goal" | "hand";

const KEYMAP: Record<string, Action> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  KeyZ: "ok", Enter: "ok", Space: "ok", KeyJ: "ok",
  KeyX: "cancel", Escape: "cancel", KeyK: "cancel",
  KeyC: "menu", KeyE: "menu",
  ShiftLeft: "run", ShiftRight: "run",
  KeyM: "mute",
  Tab: "goal",
  KeyH: "hand",
};

export interface Pointer {
  /** Position in game pixels. */
  x: number;
  y: number;
  /** True while the pointer is over the canvas. */
  over: boolean;
  /** Clicks since the last frame. */
  clicks: number;
  down: boolean;
}

/**
 * Keyboard, gamepad and touch for player one. Mouse for player two, the Hand.
 * `pressed` is true for one frame after a press. `held` is true while down.
 * Repeats fire for held direction keys so menus scroll.
 */
export class Input {
  private down = new Set<Action>();
  private justPressed = new Set<Action>();
  private holdTime = new Map<Action, number>();
  private repeatFired = new Set<Action>();
  readonly pointer: Pointer = { x: 0, y: 0, over: false, clicks: 0, down: false };
  /** Any key or click since start, used to unlock audio. */
  gestured = false;
  private padPrev = new Set<Action>();
  onAny: (() => void) | null = null;
  /** Text typed since last frame, for the password field. */
  typed = "";
  captureText = false;

  constructor(private canvas: HTMLCanvasElement, private pxScale: () => number) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) {
        if (KEYMAP[e.code]) e.preventDefault();
        return;
      }
      this.gestured = true;
      this.onAny?.();
      if (this.captureText) {
        if (e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key)) this.typed += e.key;
        else if (e.key === "Backspace") this.typed += "\b";
      }
      const a = KEYMAP[e.code];
      if (!a) return;
      if (a === "goal") e.preventDefault();
      if (a === "ok" && e.code === "Space") e.preventDefault();
      if (a === "up" || a === "down") e.preventDefault();
      this.press(a);
    });
    window.addEventListener("keyup", (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.holdTime.clear();
    });
    const toGame = (e: MouseEvent | Touch) => {
      const r = canvas.getBoundingClientRect();
      const s = pxScale();
      return { x: Math.floor((e.clientX - r.left) / s), y: Math.floor((e.clientY - r.top) / s) };
    };
    window.addEventListener("mousemove", (e) => {
      const p = toGame(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.over = p.x >= 0 && p.y >= 0 && p.x < 224 && p.y < 224;
    });
    canvas.addEventListener("mousedown", (e) => {
      this.gestured = true;
      this.onAny?.();
      const p = toGame(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.over = true;
      this.pointer.down = true;
      this.pointer.clicks++;
      e.preventDefault();
    });
    window.addEventListener("mouseup", () => {
      this.pointer.down = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    // On screen buttons for touch screens.
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-key]"))) {
      const a = b.dataset.key as Action;
      const start = (e: Event) => {
        e.preventDefault();
        this.gestured = true;
        this.onAny?.();
        this.press(a);
      };
      const end = (e: Event) => {
        e.preventDefault();
        this.release(a);
      };
      b.addEventListener("touchstart", start, { passive: false });
      b.addEventListener("touchend", end, { passive: false });
      b.addEventListener("touchcancel", end, { passive: false });
      b.addEventListener("mousedown", start);
      b.addEventListener("mouseup", end);
      b.addEventListener("mouseleave", end);
    }
  }

  private press(a: Action): void {
    if (!this.down.has(a)) {
      this.down.add(a);
      this.justPressed.add(a);
      this.holdTime.set(a, 0);
    }
  }
  private release(a: Action): void {
    this.down.delete(a);
    this.holdTime.delete(a);
    this.repeatFired.delete(a);
  }

  /** Call once per frame before update. */
  poll(dt: number): void {
    this.repeatFired.clear();
    for (const a of this.down) {
      const t = (this.holdTime.get(a) ?? 0) + dt;
      this.holdTime.set(a, t);
      if ((a === "up" || a === "down" || a === "left" || a === "right") && t > 0.32) {
        this.holdTime.set(a, t - 0.09);
        this.repeatFired.add(a);
      }
    }
    this.pollPad();
  }

  private pollPad(): void {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set<Action>();
    for (const p of pads) {
      if (!p) continue;
      const b = (i: number) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      if (b(12) || ay < -0.5) now.add("up");
      if (b(13) || ay > 0.5) now.add("down");
      if (b(14) || ax < -0.5) now.add("left");
      if (b(15) || ax > 0.5) now.add("right");
      if (b(0)) now.add("ok");
      if (b(1)) now.add("cancel");
      if (b(2) || b(9)) now.add("menu");
      if (b(3) || b(8)) now.add("goal");
      if (b(5) || b(7)) now.add("run");
    }
    for (const a of now) if (!this.padPrev.has(a)) { this.gestured = true; this.press(a); }
    for (const a of this.padPrev) if (!now.has(a)) this.release(a);
    this.padPrev = now;
  }

  /** Call once per frame after update. */
  endFrame(): void {
    this.justPressed.clear();
    this.pointer.clicks = 0;
    this.typed = "";
  }

  pressed(a: Action): boolean {
    return this.justPressed.has(a) || this.repeatFired.has(a);
  }
  /** Pressed this frame, without key repeat. */
  tapped(a: Action): boolean {
    return this.justPressed.has(a);
  }
  held(a: Action): boolean {
    return this.down.has(a);
  }
  /** Consume a press so no later scene sees it this frame. */
  consume(a: Action): void {
    this.justPressed.delete(a);
    this.repeatFired.delete(a);
  }
  consumeAll(): void {
    this.justPressed.clear();
    this.repeatFired.clear();
  }
  private dir(a: Action): boolean {
    return this.down.has(a) || this.justPressed.has(a);
  }
  dirX(): number {
    return (this.dir("right") ? 1 : 0) - (this.dir("left") ? 1 : 0);
  }
  dirY(): number {
    return (this.dir("down") ? 1 : 0) - (this.dir("up") ? 1 : 0);
  }
}
