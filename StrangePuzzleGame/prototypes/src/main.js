// Title, intro, the drive menu, shared frames, and the main loop.
var BUILDS = {
  A: { name: 'COMPILE', color: PAL.cobaltDk, scene: function (i) { return new SceneA(i); }, blurb: 'Carry bits, stack them, and compile daemons with your wand.' },
  B: { name: 'SYNTAX', color: PAL.magenta, scene: function (i) { return new SceneB(i); }, blurb: 'The rules are keycaps on the floor. Push them to change who is YOU.' },
  C: { name: 'LOOP', color: PAL.tealDk, scene: function (i) { return new SceneC(i); }, blurb: 'Write looping tapes for imps, then watch the machine run.' },
};
var BUILD_KEYS = ['A', 'B', 'C'];

function drawTopBar(build, name, li, levelName, turn) {
  rect(0, 0, W, 13, PAL.ink);
  rect(0, 1, W, 11, BUILDS[build].color);
  text('BUILD ' + build + ': ' + name + '   ' + (li + 1) + '/3 ' + levelName.toUpperCase(), 4, 3, PAL.white);
  var tt = (build === 'C' ? 'cycle ' : 'turn ') + turn, chips = 'chips ' + Save.chips() + '/9';
  text(chips, W - 4 - textW(chips), 3, PAL.yellow);
  text(tt, W - 12 - textW(chips) - textW(tt), 3, PAL.white);
}

function winPopup(def) {
  var lines = wrap(def.note, 34).map(function (l) { return { s: l }; });
  lines.push({ s: '' });
  lines.push({ s: 'Tilde has ' + Save.chips() + ' of 9 chips.', c: PAL.cobaltDk });
  lines.push({ s: 'Enter next   Esc drives   Z undo', c: PAL.g4 });
  popup(lines, 'DATACHIP RECOVERED', PAL.green, 186);
}

function nextPuzzle(build, li) {
  if (li < 2) setScene(BUILDS[build].scene(li + 1));
  else toHub(build, li);
}
function toHub(build, li) {
  Save.data.seen.cursor = [BUILD_KEYS.indexOf(build), li];
  Save.store();
  FX.clear();
  setScene(new HubScene());
}

function drawTildeNest(cx, y, t) {
  var cols = [PAL.g4, PAL.cobaltDk, PAL.redDk, PAL.g3];
  for (var i = 0; i < 7; i++) {
    var c = cols[i % 4];
    for (var x = -22; x <= 22; x++) {
      var yy = y + 10 + Math.round(Math.sin((x + i * 5) / 4) * 2) + (i % 3);
      rect(cx + x, yy, 1, 2, c);
    }
  }
  var chips = Save.chips(), glitch = chips < 9 && (Math.floor(t * 0.7) % 5 === 0);
  var tx = cx - 12, ty = y;
  spr(SPR.tilde, tx, ty);
  if (glitch) {
    var gy = ty + 3 + (Math.floor(t * 0.7) % 4);
    rect(tx + 2, gy, 20, 2, PAL.deep);
    rect(tx + 4, gy, 6, 1, PAL.teal);
    rect(tx + 14, gy + 1, 7, 1, PAL.pink);
  }
}

var TILDE_LINES = [
  'pil~ the static is in my left side again',
  'that one helped. i can feel my fingers~',
  'that one helped. i can feel my fingers~',
  'half of me compiles now. the half that likes you',
  'half of me compiles now. the half that likes you',
  'half of me compiles now. the half that likes you',
  'almost. bring the rest~',
  'almost. bring the rest~',
  'almost. bring the rest~',
  'all nine. i can sit up. lets go see the ruins together~',
];

function TitleScene() { this.t = 0; }
TitleScene.prototype.key = function (ev) {
  if (ev.mouse || isOk(ev)) {
    sfx('ok');
    if (!Save.data.seen.intro) setScene(new IntroScene()); else setScene(new HubScene());
  }
};
TitleScene.prototype.update = function (dt) { this.t += dt; };
TitleScene.prototype.draw = function () {
  drawVoid(THEMES.A, Game.t);
  var title = 'CHECKSUM', x = Math.round((W - textW(title, 3)) / 2);
  text(title, x + 3, 43, PAL.ink, 3);
  text(title, x, 40, PAL.yellow, 3);
  rect(x, 66, Math.ceil(textW(title, 3) / 2), 3, PAL.cobalt);
  rect(x + Math.ceil(textW(title, 3) / 2), 66, Math.floor(textW(title, 3) / 2), 3, PAL.yellow);
  textC('three test builds', W / 2, 76, PAL.g1);
  for (var y = 0; y < 2; y++) for (var i = 0; i < 7; i++) drawFloorTile(136 + i * 16, 100 + y * 16, 16, THEMES.A, (i + y) & 1);
  for (var j = 0; j < 7; j++) drawCliff(136 + j * 16, 132, 16, THEMES.A);
  spr(SPR.pilcrow, 158, 98 + ((Math.floor(Game.t * 2) & 1) ? 1 : 0));
  drawTildeNest(204, 106, Game.t);
  if (Math.floor(Game.t * 1.5) & 1) textC('press enter', W / 2, 150, PAL.white);
  textC('a codemage, a dying friend, and the ruins of a crashed world', W / 2, 196, PAL.g2);
};

var INTRO = [
  ['TILDE', 'pil~ you came back'],
  ['PILCROW', 'Said I would. Hold still.'],
  ['TILDE', 'the static got in my left side. keeps writing over me~'],
  ['PILCROW', 'Ruins down the line still have datachips. Each chip patches a piece of you.'],
  ['TILDE', 'the ruins run on old builds. magic works different in each one~'],
  ['PILCROW', 'Then I try all three. Back soon.'],
];
function IntroScene() { this.i = 0; }
IntroScene.prototype.key = function (ev) {
  if (ev.mouse || isOk(ev)) {
    sfx('select');
    this.i++;
    if (this.i >= INTRO.length) { Save.data.seen.intro = 1; Save.store(); setScene(new HubScene()); }
  } else if (isBack(ev)) { Save.data.seen.intro = 1; Save.store(); setScene(new HubScene()); }
};
IntroScene.prototype.update = function () {};
IntroScene.prototype.draw = function () {
  drawVoid(THEMES.A, Game.t);
  for (var y = 0; y < 4; y++) for (var x = 0; x < 8; x++) drawFloorTile(128 + x * 16, 70 + y * 16, 16, THEMES.A, (x + y) & 1);
  for (var x2 = 0; x2 < 8; x2++) drawCliff(128 + x2 * 16, 134, 16, THEMES.A);
  drawTildeNest(208, 92, Game.t);
  spr(SPR.pilcrow, 160, 86 + ((Math.floor(Game.t * 2) & 1) ? 1 : 0));
  var line = INTRO[Math.min(this.i, INTRO.length - 1)];
  panel(40, 148, 304, 50, line[0], line[0] === 'TILDE' ? PAL.magenta : PAL.cobaltDk);
  wrap(line[1], 58).forEach(function (l, i) { text(l, 46, 164 + i * LH, PAL.ink); });
  text('enter', 334 - textW('enter'), 188, PAL.g4);
};

function HubScene() {
  var c = Save.data.seen.cursor || [0, 0];
  this.col = c[0]; this.row = c[1];
}
HubScene.prototype.key = function (ev) {
  if (ev.mouse) {
    for (var b = 0; b < 3; b++) for (var r = 0; r < 3; r++) {
      var x = 6 + b * 126, y = 74 + r * 16;
      if (ev.x >= x && ev.x < x + 120 && ev.y >= y && ev.y < y + 14) {
        if (this.col === b && this.row === r) this.open(); else { this.col = b; this.row = r; sfx('select'); }
        return;
      }
    }
    return;
  }
  var d = dirOf(ev);
  if (d === 1) { this.col = (this.col + 1) % 3; sfx('select'); }
  else if (d === 3) { this.col = (this.col + 2) % 3; sfx('select'); }
  else if (d === 0) { this.row = (this.row + 2) % 3; sfx('select'); }
  else if (d === 2) { this.row = (this.row + 1) % 3; sfx('select'); }
  else if (isOk(ev)) this.open();
  else if (isBack(ev)) setScene(new TitleScene());
  else if (ev.key === 'm') Sound.muted = !Sound.muted;
};
HubScene.prototype.open = function () {
  sfx('ok');
  Save.data.seen.cursor = [this.col, this.row];
  Save.store();
  setScene(BUILDS[BUILD_KEYS[this.col]].scene(this.row));
};
HubScene.prototype.update = function () {};
HubScene.prototype.draw = function () {
  drawVoid(THEMES.A, Game.t);
  rect(0, 0, W, 13, PAL.ink);
  rect(0, 1, W, 11, PAL.g4);
  text('CHECKSUM   pick a build and a ruin', 4, 3, PAL.white);
  var chips = 'chips ' + Save.chips() + '/9';
  text(chips, W - 4 - textW(chips), 3, PAL.yellow);
  var self = this;
  BUILD_KEYS.forEach(function (k, b) {
    var x = 6 + b * 126, bd = BUILDS[k];
    panel(x, 20, 120, 126, 'BUILD ' + k + ': ' + bd.name, bd.color);
    wrap(bd.blurb, 22).forEach(function (l, i) { text(l, x + 4, 36 + i * LH, PAL.ink); });
    LEVELS[k].forEach(function (lv, r) {
      var y = 74 + r * 16, on = self.col === b && self.row === r;
      inset(x + 4, y, 112, 14, on ? bd.color : PAL.g5);
      text((r + 1) + ' ' + lv.name, x + 8, y + 3, on ? PAL.white : PAL.g1);
      if (Save.data.done[lv.id]) spr(SPR.chip, x + 100, y + 2);
    });
    var best = 0;
    LEVELS[k].forEach(function (lv) { if (Save.data.done[lv.id]) best++; });
    text(best + '/3 chips', x + 4, 128, PAL.g4);
  });
  panel(6, 152, 372, 58, 'TILDE', PAL.magenta);
  drawTildeNest(40, 172, Game.t);
  for (var i = 0; i < 9; i++) {
    rect(76 + i * 10, 170, 8, 6, PAL.ink);
    rect(77 + i * 10, 171, 6, 4, i < Save.chips() ? PAL.lime : PAL.g4);
  }
  wrap('"' + TILDE_LINES[Save.chips()] + '"', 56).forEach(function (l, i) { text(l, 76, 182 + i * LH, PAL.ink); });
  text('arrows pick  enter go', 372 - textW('arrows pick  enter go'), 170, PAL.g4);
};

var _last = 0;
function tick(dt) {
  Game.t += dt;
  Input.update();
  while (Input.queue.length) Game.scene.key(Input.queue.shift());
  Game.scene.update(dt);
  Game.scene.draw();
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
  var m = /[?&]p=([abc][123])/.exec(location.search), b = /[?&]b=([abc])/.exec(location.search);
  if (m) setScene(BUILDS[m[1][0].toUpperCase()].scene(+m[1][1] - 1));
  else if (b) { Save.data.seen.cursor = ['abc'.indexOf(b[1]), 0]; setScene(new HubScene()); }
  else setScene(new TitleScene());
  window.__ck = { tick: tick, game: Game, save: Save, setScene: setScene, builds: BUILDS, hub: function () { setScene(new HubScene()); } };
  requestAnimationFrame(loop);
}
window.addEventListener('load', boot);
