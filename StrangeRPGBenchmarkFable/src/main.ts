import { Screen, W, H } from "./engine/screen";
import { Input } from "./engine/input";
import { Game } from "./game/game";
import { TitleScene } from "./game/ui/title";
import { audio } from "./engine/audio";

function boot(): void {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const fit = () => {
    // Size in device pixels so each game pixel covers a whole number of screen pixels at any page zoom or display scaling.
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(window.innerWidth, window.innerHeight - 40) * dpr;
    const scale = Math.max(1, Math.floor(size / W));
    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = `${(W * scale) / dpr}px`;
    canvas.style.height = `${(H * scale) / dpr}px`;
  };
  fit();
  window.addEventListener("resize", fit);
  const screen = new Screen(canvas);
  const input = new Input(window);
  const game = new Game(screen, input);
  game.stack.push(new TitleScene(game));
  // Browsers only allow sound after a gesture. M mutes.
  const wake = () => audio.init();
  window.addEventListener("keydown", wake);
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", (e) => { if (e.code === "KeyM") audio.toggleMute(); });
  // #ch4 in the address bar starts a fresh game at chapter 4 with a fitting party.
  const hash = /^#ch(\d)$/.exec(location.hash);
  if (hash) void game.debugStart(Number(hash[1]));

  // On screen buttons for touch.
  document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((b) => {
    const k = b.dataset.key as "up" | "down" | "left" | "right" | "ok" | "cancel" | "menu";
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); input.press(k); });
  });

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.tick(dt);
    game.stack.update(dt);
    if (game.state) game.state.playtime += dt;
    screen.clear("black");
    game.stack.draw(screen);
    screen.present();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  (window as unknown as { game: Game; audio: typeof audio }).game = game;
  (window as unknown as { game: Game; audio: typeof audio }).audio = audio;
}

boot();
