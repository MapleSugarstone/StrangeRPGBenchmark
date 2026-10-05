export type Key = "up" | "down" | "left" | "right" | "ok" | "cancel" | "menu" | "fast";

const MAP: Record<string, Key> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  KeyZ: "ok", Enter: "ok", Space: "ok", KeyJ: "ok",
  KeyX: "cancel", Escape: "cancel", Backspace: "cancel", KeyK: "cancel",
  KeyC: "menu", Tab: "menu",
  ShiftLeft: "fast", ShiftRight: "fast",
};

/** Keyboard state with edge detection and key repeat for held directions. */
export class Input {
  private down = new Set<Key>();
  private pressedQueue: Key[] = [];
  private holdTime = new Map<Key, number>();

  constructor(target: EventTarget = window) {
    target.addEventListener("keydown", (e) => {
      const ev = e as KeyboardEvent;
      const k = MAP[ev.code];
      if (!k) return;
      ev.preventDefault();
      if (!this.down.has(k)) {
        this.down.add(k);
        this.holdTime.set(k, 0);
        this.pressedQueue.push(k);
      }
    });
    target.addEventListener("keyup", (e) => {
      const k = MAP[(e as KeyboardEvent).code];
      if (k) { this.down.delete(k); this.holdTime.delete(k); }
    });
    window.addEventListener("blur", () => { this.down.clear(); this.holdTime.clear(); });
  }

  /** Call once per frame. Generates repeat presses for held directional keys. */
  tick(dt: number): void {
    for (const k of this.down) {
      const t = (this.holdTime.get(k) ?? 0) + dt;
      this.holdTime.set(k, t);
      if ((k === "up" || k === "down" || k === "left" || k === "right") && t > 0.3) {
        this.holdTime.set(k, t - 0.09);
        this.pressedQueue.push(k);
      }
    }
  }

  /** Drains one queued press. */
  poll(): Key | undefined {
    return this.pressedQueue.shift();
  }

  flush(): void {
    this.pressedQueue.length = 0;
  }

  held(k: Key): boolean {
    return this.down.has(k);
  }

  /** Attach on screen buttons (touch) that inject key presses. */
  press(k: Key): void {
    this.pressedQueue.push(k);
  }
}
