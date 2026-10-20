// The main loop, the scene wipe, and boot.
var _last = 0;
var WIPE_TIME = 0.22;

function tick(dt) {
  Game.t += dt;
  Game.shake = Math.max(0, Game.shake - dt * 18);
  Input.update();
  if (!Game.next) while (Input.queue.length) Game.scene.key(Input.queue.shift());
  else Input.queue.length = 0;
  Game.scene.update(dt);
  if (!(Game.scene instanceof TitleScene)) Save.tick(dt);
  if (Game.next) {
    Game.wipe += dt / WIPE_TIME;
    if (Game.wipe >= 1 && Game.scene !== Game.next) { Game.scene = Game.next; if (Game.scene.enter) Game.scene.enter(); }
    if (Game.wipe >= 2) { Game.next = null; Game.wipe = 0; }
  }
  Game.scene.draw();
  if (Game.next) {
    var level = Game.wipe < 1 ? Math.round(Game.wipe * 16) : Math.round((2 - Game.wipe) * 16);
    dither(0, 0, W, H, null, PAL.deep, level);
  }
}
function loop(now) {
  var dt = Math.min(0.05, (now - _last) / 1000 || 0);
  _last = now;
  tick(dt);
  requestAnimationFrame(loop);
}

function boot() {
  initCanvas();
  Input.init();
  Save.load();
  Sound.muted = !!Save.data.muted;
  if (window.Music && Music.setMuted) Music.setMuted(Sound.muted);
  mend();
  var m = /[?&]p=(\d+)/.exec(location.search);
  if (m && LEVELS[+m[1] - 1]) setScene(new PuzzleScene(+m[1] - 1), true);
  else if (/[?&]map/.test(location.search)) setScene(new MapScene(), true);
  else if (/[?&]world/.test(location.search)) setScene(new OverworldScene(Save.data.world), true);
  else setScene(new TitleScene(), true);
  window.__ck = { tick: tick, game: Game, save: Save, setScene: setScene, Puzzle: PuzzleScene, Map: MapScene, World: OverworldScene };
  window.addEventListener('pagehide', function () { Save.store(); });
  requestAnimationFrame(loop);
}
window.addEventListener('load', boot);
