import { initScreen, present } from "./engine/screen.js";
import { updateInput, endInputFrame } from "./engine/input.js";
import { TitleScene } from "./scenes/title.js";
import { FieldScene } from "./scenes/field.js";
import { BattleScene } from "./scenes/battle.js";
import { MenuScene } from "./scenes/menu.js";
import { EndingScene } from "./scenes/ending.js";
import { updateMusic } from "./engine/music_director.js";

export const sceneRef = { scene: null as TitleScene | FieldScene | BattleScene | MenuScene | EndingScene | null };

let lastTime: number = 0;

function init(): void {
  const canvas = document.createElement("canvas");
  canvas.id = "game";
  document.body.appendChild(canvas);
  initScreen(canvas);
  sceneRef.scene = new TitleScene();
  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp: number): void {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (sceneRef.scene) {
    updateInput(dt);
    sceneRef.scene.update(dt);
    sceneRef.scene.render();
    updateMusic(sceneRef.scene);
    endInputFrame();
  }

  present();
  requestAnimationFrame(gameLoop);
}

init();
