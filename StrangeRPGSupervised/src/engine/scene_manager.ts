import { TitleScene } from "../scenes/title.js";
import { FieldScene } from "../scenes/field.js";
import { BattleScene } from "../scenes/battle.js";
import { MenuScene } from "../scenes/menu.js";
import { EndingScene } from "../scenes/ending.js";
import { ShopScene } from "../scenes/shop.js";
import { QuenchScene } from "../scenes/quench.js";
import { ForgeScene } from "../scenes/forge.js";
import { BoardScene } from "../scenes/board.js";
import { registerFusions } from "./fusion.js";
import { sceneRef } from "../main.js";
import { loadGame } from "./game_state.js";

export type SceneType = "title" | "field" | "battle" | "menu" | "ending" | "shop" | "quench" | "forge" | "board";

let _setSceneImpl: (type: SceneType, data?: any) => void;

function defaultSetScene(type: SceneType, data?: any): void {
  // Fused species live in the save; any scene that brings a save brings them back into play.
  const save = data?.save ?? data?.fieldState?.save;
  if (save?.fusions) registerFusions(save);
  switch (type) {
    case "title":
      sceneRef.scene = new TitleScene();
      break;
    case "field":
      sceneRef.scene = new FieldScene(data);
      break;
    case "battle":
      sceneRef.scene = new BattleScene(
        data.playerSpecies || ["shard"],
        data.opponentSpecies || ["rust_crawler"],
        data.isWild || false,
        data.playerLevels || [5],
        data.opponentLevel || 1,
        data.fieldState,
        data.trainerFlag,
        data.gift ?? null
      );
      break;
    case "menu":
      sceneRef.scene = new MenuScene(data);
      break;
    case "ending":
      sceneRef.scene = new EndingScene(data);
      break;
    case "shop":
      sceneRef.scene = new ShopScene(data) as any;
      break;
    case "quench":
      sceneRef.scene = new QuenchScene(data) as any;
      break;
    case "forge":
      sceneRef.scene = new ForgeScene(data) as any;
      break;
    case "board":
      sceneRef.scene = new BoardScene(data) as any;
      break;
  }
}

_setSceneImpl = defaultSetScene;

export function setScene(type: SceneType, data?: any): void {
  _setSceneImpl(type, data);
}

export function overrideSetScene(fn: (type: SceneType, data?: any) => void): void {
  _setSceneImpl = fn;
}

export function resetSetScene(): void {
  _setSceneImpl = defaultSetScene;
}

export function startGame(): void {
  const save = loadGame();
  if (save) {
    setScene("field", { save });
  } else {
    setScene("field");
  }
}
