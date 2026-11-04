import { buffer } from "./screen.js";
import { drawText, textWidth } from "./font.js";
import { COLOR_STONE_LIGHT, COLOR_SHADOW, COLOR_VOID } from "./palette.js";

export type DialogueState = {
  speaker: string;
  lines: string[];
  currentLine: number;
  charIndex: number;
  visible: boolean;
  waiting: boolean;
};

/** Splits a line into pages of at most three rows of 160 pixels, the size of the field's dialogue box. */
export function pages(line: string, width = 160, rows = 3): string[] {
  const wrapped: string[] = [];
  for (const word of line.split(" ")) {
    const last = wrapped[wrapped.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`) <= width) wrapped[wrapped.length - 1] = `${last} ${word}`;
    else wrapped.push(word);
  }
  const out: string[] = [];
  for (let i = 0; i < wrapped.length; i += rows) out.push(wrapped.slice(i, i + rows).join(" "));
  return out.length ? out : [line];
}

export function startDialogue(speaker: string, lines: string[]): DialogueState {
  return {
    speaker,
    lines: lines.flatMap((l) => pages(l)),
    currentLine: 0,
    charIndex: 0,
    visible: false,
    waiting: false,
  };
}

export function updateDialogue(state: DialogueState, dt: number): void {
  if (!state.visible) {
    state.visible = true;
    state.charIndex = 0;
    state.waiting = false;
    return;
  }

  if (state.waiting) return;

  const currentLine = state.lines[state.currentLine];
  if (state.charIndex < currentLine.length) {
    state.charIndex += dt * 40;
    if (state.charIndex > currentLine.length) state.charIndex = currentLine.length;
  } else {
    state.waiting = true;
  }
}

export function advanceDialogue(state: DialogueState): void {
  if (!state.visible) {
    state.visible = true;
    state.charIndex = 0;
    state.waiting = false;
    return;
  }

  // A press while a line types shows it whole, the last line included; the next press moves on or closes.
  if (!state.waiting) {
    state.charIndex = state.lines[state.currentLine].length;
    state.waiting = true;
    return;
  }

  state.currentLine++;
  if (state.currentLine >= state.lines.length) {
    state.visible = false;
  } else {
    state.charIndex = 0;
    state.waiting = false;
  }
}

export function isDialogueFinished(state: DialogueState): boolean {
  return state.currentLine >= state.lines.length;
}

export function renderDialogue(state: DialogueState, boxX: number, boxY: number, boxW: number, boxH: number): void {
  if (!state.visible) return;

  const currentLine = state.lines[state.currentLine];
  const visibleText = currentLine.substring(0, Math.floor(state.charIndex));
  
  const maxWidth = boxW - 8;
  const words = visibleText.split(" ");
  let row = "";
  let y = boxY + 4;
  
  for (const word of words) {
    const testRow = row ? row + " " + word : word;
    if (textWidth(testRow) > maxWidth && row) {
      drawText(buffer, row, boxX + 4, y, COLOR_STONE_LIGHT);
      row = word;
      y += 9;
    } else {
      row = testRow;
    }
  }
  if (row) {
    drawText(buffer, row, boxX + 4, y, COLOR_STONE_LIGHT);
  }
  
  drawText(buffer, state.speaker, boxX + 4, boxY - 10, COLOR_STONE_LIGHT);
}
