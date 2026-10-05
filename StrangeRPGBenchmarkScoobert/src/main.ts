// MAIN — game entry point. Initializes the UI canvas and starts the game loop.

import { initUI } from "./engine/ui.js";

window.addEventListener("load", () => {
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  if (!canvas) {
    console.error("Canvas #game not found!");
    return;
  }
  initUI(canvas);
});
