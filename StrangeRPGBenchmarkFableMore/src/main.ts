import { createGame } from "./game/game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const game = createGame(canvas);
void game.start();
