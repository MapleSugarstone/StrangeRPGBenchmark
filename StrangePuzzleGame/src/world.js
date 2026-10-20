// The ruins as walkable rooms, one per area. Doorways start puzzles, digits link rooms, and keycard doors gate wings.
// Map legend: # wall, . floor, _ void, d doorway, T Tilde's nest, P start, 1-9 exits, R B Y G keycard doors,
// x the area's prop, p plant, c desk, o floor decal.
var ROOMS = [
  { id: 'lobby', area: 0, links: { 1: 'sales', '!': 'afterhours' }, map: [
    '####d#####d#####d###',
    '#p................p#',
    '#..................#',
    '#..ccccc...........#',
    '!H.................1',
    '#.......ooo........#',
    '#.......oTo........#',
    '#.......ooo........#',
    '#....P.............#',
    '#p................p#',
    '####################',
  ] },
  { id: 'sales', area: 1, links: { 1: 'lobby', 2: 'back' }, map: [
    '###d#####d#####d####',
    '#..................#',
    '#.xxxx.xxxx.xxxx...#',
    '1..................2',
    '#.xxxx.xxxx.xxxx...#',
    '#..................#',
    '#.xxxx.xxxx.xxxx...#',
    '#..................#',
    '####################',
  ] },
  { id: 'back', area: 2, links: { 2: 'sales', 3: 'display' }, map: [
    '###d####d####d####d###',
    '#....................#',
    '#.xx..x..xx..x..xx...#',
    '2....................R3',
    '#.xx..x..xx..x..xx...#',
    '#....................#',
    '#.xx......xx.....xx..#',
    '#....................#',
    '######################',
  ] },
  { id: 'display', area: 3, links: { 3: 'back', 4: 'loss' }, map: [
    '####d#####d#####d#####',
    '#....................#',
    '#..x...x...x...x.....#',
    '3....................#',
    '#..x...x...x...x.....#',
    '#....................#',
    '####d#####d#####d##4##',
  ] },
  { id: 'loss', area: 4, links: { 4: 'display', 5: 'shipping' }, map: [
    '##d####d####4####d####',
    '#....................#',
    '#.x....x.....x....x..#',
    '#....................B5',
    '#.x....x.....x....x..#',
    '#....................#',
    '##d####d####d####d####',
  ] },
  { id: 'shipping', area: 5, links: { 5: 'loss', 6: 'office' }, map: [
    '##d####d####d####d####',
    '#....................#',
    '#.xx.oooooooooo.xx...#',
    '5....................Y6',
    '#.xx.oooooooooo.xx...#',
    '#....................#',
    '####d######d######d###',
  ] },
  { id: 'office', area: 6, links: { 6: 'shipping', 7: 'overtime' }, map: [
    '###d#####d#####d######',
    '#....................#',
    '#..cc...cc...cc......#',
    '6....................G7',
    '#..cc...cc...cc......#',
    '#....................#',
    '###d#####d#####d######',
  ] },
  { id: 'overtime', area: 7, links: { 7: 'office', 8: 'foodcourt' }, map: [
    '###d####d####d####d###',
    '#....................#',
    '#.p......x.......p...#',
    '7....................S8',
    '#.p......x.......p...#',
    '#....................#',
    '######################',
  ] },
  { id: 'foodcourt', area: 8, links: { 8: 'overtime', 9: 'arcade' }, map: [
    '##d####d####d####d####',
    '#....................#',
    '#.xx...xx...xx...xx..#',
    '8...................N9',
    '#.xx...xx...xx...xx..#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'arcade', area: 9, links: { 9: 'foodcourt', 0: 'garden' }, map: [
    '##d####d####d####d####',
    '#....................#',
    '#.x.x.x.x....x.x.x.x.#',
    '9...................V0',
    '#.x.x.x.x....x.x.x.x.#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'garden', area: 10, links: { 0: 'arcade', '+': 'server' }, map: [
    '##d####d####d####d####',
    '#....................#',
    '#.xx..p..xx..p..xx...#',
    '0...................W+',
    '#.xx..p..xx..p..xx...#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'server', area: 11, links: { '+': 'garden', '-': 'garage' }, map: [
    '###d#####d#####d######',
    '#....................#',
    '#.x.x.x.x....x.x.x.x.#',
    '+...................K-',
    '#.x.x.x.x....x.x.x.x.#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'garage', area: 12, links: { '-': 'server', '~': 'cinema' }, map: [
    '###d#####d#####d######',
    '#....................#',
    '#.x..x..x....x..x..x.#',
    '-...................I~',
    '#.x..x..x....x..x..x.#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'cinema', area: 13, links: { '~': 'garage', ':': 'toys' }, map: [
    '###d#####d#####d######',
    '#....................#',
    '#..xxx..xxx..xxx..xx.#',
    '~...................U:',
    '#..xxx..xxx..xxx..xx.#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'toys', area: 14, links: { ':': 'cinema', '>': 'atrium' }, map: [
    '###d#####d#####d######',
    '#....................#',
    '#.x...x...x...x...x..#',
    ':...................E>',
    '#.x...x...x...x...x..#',
    '#....................#',
    '######d#######d#######',
  ] },
  { id: 'atrium', area: 15, fight: true, links: { '>': 'toys' }, map: [
    '#######d########',
    '#..............#',
    '#.x..........x.#',
    '#..............#',
    '>..............#',
    '#..............#',
    '#.x..........x.#',
    '#..............#',
    '################',
  ] },
  { id: 'afterhours', area: 16, links: { '!': 'lobby' }, map: [
    '###d#####d#####d######',
    '#....................#',
    '#..p.............p...#',
    '#....................!',
    '#..p.............p...#',
    '#....................#',
    '######d#######d#######',
  ] },
];
var KEYCARD_DOOR = { R: 'red', B: 'blue', Y: 'yellow', G: 'gold', S: 'silver', N: 'green', V: 'violet', W: 'white', K: 'black', I: 'rainbow', U: 'copper', E: 'pearl', H: 'staff' };
var KEYCARD_COLOR = { red: PAL.red, blue: PAL.cobalt, yellow: PAL.yellow, gold: PAL.ochre, silver: '#c8d0e0', green: PAL.lime, violet: PAL.magenta, white: PAL.white, black: '#4a4458', rainbow: PAL.teal, copper: '#c87a3a', pearl: '#f0e8f8', staff: PAL.pink };
var KEYCARD_ORDER = ['staff', 'pearl', 'copper', 'rainbow', 'black', 'white', 'violet', 'green', 'silver', 'gold', 'yellow', 'blue', 'red'];
function keycardOf(def) { return def.keycard || null; }

function roomById(id) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i]; return ROOMS[0]; }
function roomTile(room, x, y) { return y >= 0 && y < room.map.length && x >= 0 && x < room.map[y].length ? room.map[y][x] : '_'; }
// Doorways in reading order, each paired with the next level of the room's area.
function roomDoors(room) {
  if (room.doors) return room.doors;
  var levels = [];
  LEVELS.forEach(function (l, i) { if ((l.area || 0) === room.area) levels.push(i); });
  var out = [], n = 0;
  room.map.forEach(function (row, y) { for (var x = 0; x < row.length; x++) if (row[x] === 'd') out.push({ x: x, y: y, li: n < levels.length ? levels[n++] : -1 }); });
  // A fight room has one doorway, and it always leads to the first stage not yet cleared.
  if (room.fight) out.forEach(function (d) { Object.defineProperty(d, 'li', { get: function () { return fightStage(levels); } }); });
  room.doors = out;
  return out;
}
function fightStage(levels) {
  for (var i = 0; i < levels.length; i++) if (!Save.data.done[LEVELS[levels[i]].id]) return levels[i];
  return levels.length ? levels[0] : -1;
}
function doorAt(room, x, y) { var ds = roomDoors(room); for (var i = 0; i < ds.length; i++) if (ds[i].x === x && ds[i].y === y) return ds[i]; return null; }
// The floor tile in front of a doorway, where Pilcrow stands to enter it.
function frontOf(room, x, y) {
  for (var d = 0; d < 4; d++) {
    var nx = x + Rules.DX[d], ny = y + Rules.DY[d], c = roomTile(room, nx, ny);
    if (c === '.' || c === 'o' || c === 'P') return { x: nx, y: ny, face: (d + 2) % 4 };
  }
  return { x: x, y: y + 1, face: 0 };
}
function worldSpotOfLevel(li) {
  for (var r = 0; r < ROOMS.length; r++) {
    var ds = roomDoors(ROOMS[r]);
    for (var i = 0; i < ds.length; i++) if (ds[i].li === li) { var f = frontOf(ROOMS[r], ds[i].x, ds[i].y); return { room: ROOMS[r].id, x: f.x, y: f.y, face: f.face }; }
  }
  return null;
}
function toWorld(li) {
  var spot = li !== undefined && li >= 0 ? worldSpotOfLevel(li) : null;
  setScene(new OverworldScene(spot || Save.data.world || null));
}

function OverworldScene(spot) {
  var room = roomById(spot ? spot.room : 'lobby');
  this.room = room;
  if (spot) { this.px = spot.x; this.py = spot.y; this.face = spot.face === undefined ? 2 : spot.face; }
  else {
    var self = this;
    room.map.forEach(function (row, y) { var x = row.indexOf('P'); if (x >= 0) { self.px = x; self.py = y; } });
    this.face = 2;
  }
  this.fx = this.px; this.fy = this.py; this.t = 1;
  // After the ending Tilde floats one step behind Pilcrow, starting on the tile Pilcrow came from.
  this.friend = null;
  if (Save.data.seen.final) {
    var bx = this.px - Rules.DX[this.face], by = this.py - Rules.DY[this.face], ok = this.passable(roomTile(room, bx, by));
    this.friend = { x: ok ? bx : this.px, y: ok ? by : this.py, fx: ok ? bx : this.px, fy: ok ? by : this.py, flip: false };
  }
  this.msg = ''; this.msgT = 0; this.tildePanel = false; this.bump = 0; this.bd = 0; this.queued = -1;
}
OverworldScene.prototype.enter = function () {
  FX.clear();
  music('area' + this.room.area);
  Sound.setArea(this.room.area);
  this.save();
  if (Save.data.keys && Save.data.keys.gold && !Save.data.seen.end) {
    Save.data.seen.end = 1; Save.store();
    setScene(new StoryScene(MID_LINES, -1));
  }
};
OverworldScene.prototype.save = function () {
  Save.data.world = { room: this.room.id, x: this.px, y: this.py, face: this.face };
  Save.store();
};
OverworldScene.prototype.owns = function (color) { return !!(Save.data.keys && Save.data.keys[color]); };
OverworldScene.prototype.passable = function (c) {
  if (c === '.' || c === 'o' || c === 'P' || this.room.links[c]) return true;
  return !!(KEYCARD_DOOR[c] && this.owns(KEYCARD_DOOR[c]));
};
OverworldScene.prototype.say = function (s) { this.msg = s; this.msgT = 2; };

OverworldScene.prototype.key = function (ev) {
  if (ev.code === 'KeyM') { setMuted(!Sound.muted); return; }
  if (this.tildePanel) { this.tildePanel = false; sfx('select'); return; }
  var d = dirOf(ev);
  if (d >= 0) { if (this.t < 1) this.queued = d; else this.walk(d); return; }
  if (isBack(ev)) { sfx('back'); setScene(new TitleScene()); }
};
OverworldScene.prototype.walk = function (d) {
  var room = this.room, tx = this.px + Rules.DX[d], ty = this.py + Rules.DY[d], c = roomTile(room, tx, ty);
  this.face = d;
  if (c === 'd') {
    var door = doorAt(room, tx, ty);
    if (door && door.li >= 0) { sfx2('enter'); this.save(); Save.data.cursor = door.li; setScene(new PuzzleScene(door.li)); }
    else { sfx('bump'); this.say('SEALED'); }
    return;
  }
  if (c === 'T') { sfx('select'); this.tildePanel = true; return; }
  if (KEYCARD_DOOR[c] && !this.owns(KEYCARD_DOOR[c])) { sfx('bump'); this.bump = 0.12; this.bd = d; this.say('NEEDS ' + KEYCARD_DOOR[c].toUpperCase() + ' KEYCARD'); return; }
  if (!this.passable(c)) { sfx('bump'); this.bump = 0.12; this.bd = d; return; }
  var fr = this.friend;
  if (fr) { fr.fx = fr.x; fr.fy = fr.y; fr.x = this.px; fr.y = this.py; if (fr.x !== fr.fx) fr.flip = fr.x > fr.fx; }
  this.fx = this.px; this.fy = this.py; this.px = tx; this.py = ty; this.t = 0;
  sfx('step');
  if (room.links[c]) { this.leave(c); return; }
  this.save();
};
// Takes Pilcrow through an exit to the same digit in the linked room, one step inside.
OverworldScene.prototype.leave = function (digit) {
  var to = roomById(this.room.links[digit]), spot = null;
  to.map.forEach(function (row, y) { var x = row.indexOf(digit); if (x >= 0) spot = { x: x, y: y }; });
  if (!spot) return;
  var f = frontOf(to, spot.x, spot.y);
  Save.data.world = { room: to.id, x: f.x, y: f.y, face: (f.face + 2) % 4 };
  Save.store();
  setScene(new OverworldScene(Save.data.world));
};

OverworldScene.prototype.update = function (dt) {
  this.t = Math.min(1, this.t + dt / 0.11);
  this.bump = Math.max(0, this.bump - dt);
  this.msgT = Math.max(0, this.msgT - dt);
  if (this.t >= 1 && this.queued >= 0) { var q = this.queued; this.queued = -1; this.walk(q); }
  FX.update(dt);
};

var OW_TOP = TOP, OW_BOTTOM = H - 13;
OverworldScene.prototype.draw = function () {
  var room = this.room, area = AREAS[room.area], t = Game.t, self = this;
  drawVoid(area, t);
  var rw = 0;
  room.map.forEach(function (r) { rw = Math.max(rw, r.length); });
  var rh = room.map.length, e = ease(this.t), dx = this.fx + (this.px - this.fx) * e, dy = this.fy + (this.py - this.fy) * e;
  var viewH = OW_BOTTOM - OW_TOP;
  var camX = rw * T <= W ? Math.round((rw * T - W) / 2) : Math.max(0, Math.min(rw * T - W, Math.round(dx * T + 8 - W / 2)));
  var camY = rh * T + 8 <= viewH ? Math.round((rh * T - viewH) / 2) - 4 : Math.max(-8, Math.min(rh * T - viewH + 6, Math.round(dy * T + 8 - viewH / 2)));
  var ox = -camX, oy = OW_TOP - camY;
  function solidAt(x, y) { var c = roomTile(room, x, y); return c === '#' || c === 'd' || (KEYCARD_DOOR[c] && !self.owns(KEYCARD_DOOR[c])); }
  function shown(x, y) { return roomTile(room, x, y) !== '_'; }
  for (var y = 0; y < rh; y++) for (var x = 0; x < rw; x++) {
    var c = roomTile(room, x, y), px = ox + x * T, py = oy + y * T;
    if (c === '_') continue;
    if (!solidAt(x, y)) {
      drawFloor(px, py, area, x, y);
      if (c === 'o') drawDecal(px, py, area, x, y, t);
      if (room.links[c]) { var ed = frontOf(room, x, y).face; drawArrow(px + 8, py + 8, (ed + 2) % 4, PAL.white); }
      if (KEYCARD_DOOR[c]) drawKeyDoor(px, py, KEYCARD_COLOR[KEYCARD_DOOR[c]], true);
    }
    if (!shown(x, y + 1)) drawCliff(px, py + T, area);
  }
  var next = this.nextLevel();
  for (var row = 0; row < rh; row++) {
    for (var x2 = 0; x2 < rw; x2++) {
      var c2 = roomTile(room, x2, row), bx = ox + x2 * T, by = oy + row * T;
      if (c2 === '#') drawBlock(bx, by, area, { u: solidAt(x2, row - 1), d: solidAt(x2, row + 1), l: solidAt(x2 - 1, row), r: solidAt(x2 + 1, row) });
      else if (c2 === 'd') this.drawDoorway(bx, by, doorAt(room, x2, row), next);
      else if (KEYCARD_DOOR[c2] && !this.owns(KEYCARD_DOOR[c2])) drawKeyDoor(bx, by, KEYCARD_COLOR[KEYCARD_DOOR[c2]], false);
      else if (c2 === 'x' || c2 === 'p' || c2 === 'c') drawProp(bx, by, c2, area, t + x2);
      else if (c2 === 'T') { if (Save.data.seen.final) drawNest(bx + 8, by - 2); else drawTildeNest(bx + 8, by - 2, t, Save.health()); }
    }
    var fr = this.friend;
    if (fr && Math.round(fr.fy + (fr.y - fr.fy) * e) === row) {
      var frx = ox + (fr.fx + (fr.x - fr.fx) * e) * T, fry = oy + (fr.fy + (fr.y - fr.fy) * e) * T;
      rect(frx + 4, fry + 13, 8, 1, PAL.ink);
      spr(SPR.tilde, frx, fry - 2 + Math.round(Math.sin(t * 3) * 1.5), fr.flip);
    }
    if (Math.round(dy) === row) {
      var pxx = ox + dx * T, pyy = oy + dy * T - 3;
      if (this.t < 1) pyy -= Math.round(Math.sin(Math.PI * this.t) * 2);
      if (this.bump > 0) { var k = Math.round(Math.sin(this.bump / 0.12 * Math.PI) * 2); pxx += Rules.DX[this.bd] * k; pyy += Rules.DY[this.bd] * k; }
      var f = this.face, rows = f === 0 ? SPR.pilBack : f === 2 ? SPR.pilFront : SPR.pilSide;
      spr(rows, pxx, pyy + (this.t >= 1 && (Math.floor(t * 2) & 1) ? 1 : 0), f === 3, f === 3 ? LEFT_SWAP : null);
    }
  }
  FX.draw();
  this.drawHud();
  if (this.tildePanel) this.drawTilde();
};

// The first level not yet solved, which gets a sparkle so the way on is easy to find.
OverworldScene.prototype.nextLevel = function () {
  for (var i = 0; i < LEVELS.length; i++) if (!Save.data.done[LEVELS[i].id]) return i;
  return -1;
};
OverworldScene.prototype.drawDoorway = function (x, y, door, next) {
  var area = AREAS[this.room.area], top = y - LIFT, t = Game.t;
  drawBlock(x, y, area, { u: true, d: false, l: true, r: true });
  if (!door || door.li < 0) {
    rect(x + 3, top + 4, 10, 11, PAL.g4);
    rect(x + 3, top + 6, 10, 1, PAL.ochre); rect(x + 3, top + 10, 10, 1, PAL.ochre);
    return;
  }
  var def = LEVELS[door.li], done = Save.data.done[def.id], kc = keycardOf(def);
  // A number plate on the wall's top face, and a dark doorway opening below it.
  rect(x + 1, top + 1, 14, 10, PAL.ink);
  rect(x + 2, top + 2, 12, 8, kc ? KEYCARD_COLOR[kc] : done ? PAL.lime : PAL.g1);
  var num = String(door.li + 1);
  text(num, x + 8 - Math.floor(textW(num) / 2), top + 3, PAL.ink);
  rect(x + 3, top + 12, 10, 9, PAL.ink);
  rect(x + 4, top + 13, 8, 8, done ? '#1c3a24' : '#140c22');
  if (done) rect(x + 7, top + 15, 2, 2, PAL.lime);
  if (door.li === next && (Math.floor(t * 2) & 1)) { rect(x, top + 12, 1, 5, PAL.white); rect(x + 15, top + 12, 1, 5, PAL.white); }
};
OverworldScene.prototype.drawHud = function () {
  var self = this, area = AREAS[this.room.area];
  rect(0, 0, W, TOP, PAL.ink);
  text(area.name.toUpperCase(), 3, 2, PAL.white);
  var chips = Save.chips() + '/' + LEVELS.length;
  text(chips, W - 3 - textW(chips), 2, PAL.white);
  spr(SPR.chip, W - 4 - textW(chips) - 13, 1);
  var kx = W - 22 - textW(chips) - 13, owned = KEYCARD_ORDER.filter(function (k) { return self.owns(k); });
  // The cards close up when there are too many to fit beside the area name.
  var room = kx - (3 + textW(area.name.toUpperCase()) + 4) + 9, pitch = Math.max(4, Math.min(9, Math.floor(room / Math.max(1, owned.length))));
  owned.forEach(function (k) {
    if (pitch >= 9) { rect(kx, 2, 7, 7, PAL.ink); rect(kx + 1, 3, 5, 5, KEYCARD_COLOR[k]); rect(kx + 2, 5, 3, 1, PAL.ink); }
    else { rect(kx + 9 - pitch, 2, pitch, 7, PAL.ink); rect(kx + 10 - pitch, 3, pitch - 2, 5, KEYCARD_COLOR[k]); }
    kx -= pitch;
  });
  rect(0, OW_BOTTOM, W, H - OW_BOTTOM, PAL.ink);
  rect(0, OW_BOTTOM, W, 1, area.trim);
  var tx = this.px + Rules.DX[this.face], ty = this.py + Rules.DY[this.face], c = roomTile(this.room, tx, ty), line = '', col = PAL.g2;
  if (this.msgT > 0) { line = this.msg; col = PAL.orange; }
  else if (c === 'd') {
    var door = doorAt(this.room, tx, ty);
    if (door && door.li >= 0) { var def = LEVELS[door.li]; line = (door.li + 1) + ' ' + def.name.toUpperCase(); col = Save.data.done[def.id] ? PAL.lime : PAL.white; }
    else line = 'SEALED';
  } else if (c === 'T') line = Save.data.seen.final ? 'NEST' : 'TILDE';
  else if (KEYCARD_DOOR[c]) line = (this.owns(KEYCARD_DOOR[c]) ? 'OPEN WITH ' : 'NEEDS ') + KEYCARD_DOOR[c].toUpperCase() + ' KEYCARD';
  if (line) text(line, 4, OW_BOTTOM + 3, col);
};
OverworldScene.prototype.drawTilde = function () {
  var w = 140, h = 50, x = (W - w) / 2, y = 60, n = Save.chips(), tot = LEVELS.length;
  panel(x, y, w, h, 'TILDE', PAL.magenta);
  drawTildeNest(x + 26, y + 22, Game.t, Save.health());
  rect(x + 48, y + 22, 84, 6, PAL.ink);
  rect(x + 49, y + 23, Math.round(82 * n / Math.max(1, tot)), 4, PAL.lime);
  text(n + ' of ' + tot + ' chips', x + 48, y + 32, PAL.ink);
};
