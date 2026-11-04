/**
 * Input handling for Ruin.
 * Arrows or WASD move, Z/Enter/Space confirms, X/Esc goes back.
 * Held direction keys repeat.
 */

type Direction = "up" | "down" | "left" | "right" | null;

let currentDirection: Direction = null;
let lastDirectionTime: number = 0;
let repeatTimer: number = 0;
const REPEAT_DELAY = 0.2; // seconds
const REPEAT_INTERVAL = 0.1; // seconds

const keys: Set<string> = new Set();
let confirmPressed = false;
let backPressed = false;
let pressedDirection: Direction = null;
/** Keys pressed down this frame, in lower case, for one-key commands such as Tab and renaming. */
const pressedKeys: Set<string> = new Set();

window.addEventListener("keydown", (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  // Tab shows the goal; the page must not move focus away from the game.
  if (key === "tab") e.preventDefault();
  if (!keys.has(key)) {
    pressedKeys.add(key);
    if (key === "z" || key === "enter" || key === " ") {
      confirmPressed = true;
    }
    if (key === "x" || key === "escape") {
      backPressed = true;
    }
    if (key === "arrowup" || key === "w") {
      pressedDirection = "up";
    } else if (key === "arrowdown" || key === "s") {
      pressedDirection = "down";
    } else if (key === "arrowleft" || key === "a") {
      pressedDirection = "left";
    } else if (key === "arrowright" || key === "d") {
      pressedDirection = "right";
    }
  }
  keys.add(key);
  updateDirection();
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  keys.delete(key);
  updateDirection();
});

function updateDirection(): void {
  if (keys.has("arrowup") || keys.has("w")) {
    currentDirection = "up";
  } else if (keys.has("arrowdown") || keys.has("s")) {
    currentDirection = "down";
  } else if (keys.has("arrowleft") || keys.has("a")) {
    currentDirection = "left";
  } else if (keys.has("arrowright") || keys.has("d")) {
    currentDirection = "right";
  } else {
    currentDirection = null;
  }
}

/**
 * Get the current direction.
 */
export function getDirection(): Direction {
  return currentDirection;
}

/**
 * Get the direction for a single menu tap.
 */
export function menuDirection(): Direction {
  const dir = pressedDirection;
  return dir;
}

/**
 * Check if the confirm key is pressed.
 */
export function isConfirm(): boolean {
  return confirmPressed;
}

/**
 * Check if the back key is pressed.
 */
export function isBack(): boolean {
  return backPressed;
}

/**
 * Update the input state for a frame.
 */
export function updateInput(dt: number): void {
  if (currentDirection) {
    repeatTimer += dt;
    if (repeatTimer >= REPEAT_DELAY) {
      if (repeatTimer >= REPEAT_DELAY + REPEAT_INTERVAL) {
        repeatTimer = REPEAT_DELAY;
      }
    }
  }
}

/** Whether this key went down this frame. */
export function wasPressed(key: string): boolean {
  return pressedKeys.has(key);
}

/**
 * Clear the frame-specific input flags after the scene has processed them.
 */
export function endInputFrame(): void {
  pressedKeys.clear();
  confirmPressed = false;
  backPressed = false;
  pressedDirection = null;
}

/**
 * Menu cursor helper that remembers the last choice of each menu by its id.
 */
export class MenuCursor {
  private cursors: Map<string, number> = new Map();

  /**
   * Get or set the cursor position for a menu.
   */
  get(id: string, max: number): number {
    if (!this.cursors.has(id)) {
      this.cursors.set(id, 0);
    }
    let pos = this.cursors.get(id)!;
    if (pos < 0) pos = 0;
    if (pos >= max) pos = max - 1;
    return pos;
  }

  /**
   * Set the cursor position for a menu.
   */
  set(id: string, pos: number): void {
    this.cursors.set(id, pos);
  }

  /**
   * Move the cursor up.
   */
  up(id: string, max: number): void {
    let pos = this.get(id, max);
    if (pos > 0) {
      pos--;
      this.set(id, pos);
    }
  }

  /**
   * Move the cursor down.
   */
  down(id: string, max: number): void {
    let pos = this.get(id, max);
    if (pos < max - 1) {
      pos++;
      this.set(id, pos);
    }
  }

  /**
   * Move the cursor by delta, clamping to valid range.
   */
  move(id: string, max: number, delta: number): void {
    let pos = this.get(id, max);
    const newPos = pos + delta;
    if (newPos >= 0 && newPos < max) {
      this.set(id, newPos);
    }
  }
}
