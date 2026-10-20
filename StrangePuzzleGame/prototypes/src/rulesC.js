// Build C rules: imps run looping tapes in lockstep to carry shards to the port. No drawing code, so Node can load it.
var RulesC = (function () {
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var SLOTS = 16, LIMIT = 400, IMP_COST = 10;
  var OPS = { F: 'step', L: 'turn left', R: 'turn right', G: 'grab', D: 'drop', H: 'hit', W: 'wait' };

  // Map characters: # wall, _ void, . floor, S source, T port, U fuser, h husk.
  function load(def) {
    var rows = def.map, h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var s = { w: w, h: h, tiles: [], items: {}, fuse: {}, husks: [], imps: [], delivered: 0, need: def.need, item: def.item || 's', cycle: 0, done: false, error: null, area: {} };
    var hd = def.husks || [], hi = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y][x] || '_', t = ch;
      if (ch === 'h') {
        var d = hd[hi++] || {};
        s.husks.push({ id: hi, x: x, y: y, d: d.pace === undefined ? -1 : d.pace, hp: d.hp || 2, maxHp: d.hp || 2 });
        t = '.';
      }
      if ('#_.STU'.indexOf(t) < 0) t = '.';
      s.tiles.push(t);
      if (t === 'S') s.items[y * w + x] = 's';
      if (t === 'U') s.fuse[y * w + x] = 0;
    }
    return s;
  }

  function tile(s, x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h ? s.tiles[y * s.w + x] : '_'; }
  function tapeLen(tape) { var n = 0; for (var i = 0; i < tape.length; i++) if (tape[i]) n = i + 1; return n; }

  // A program is a list of imps: {x, y, d, tape}. Returns the start state, or an error string for a bad placement.
  function start(def, prog) {
    var s = load(def);
    for (var i = 0; i < prog.length; i++) {
      var p = prog[i];
      if (tile(s, p.x, p.y) !== '.') return 'Imps stand on plain floor.';
      if (s.husks.some(function (q) { return q.x === p.x && q.y === p.y; })) return 'A husk already stands there.';
      s.imps.push({ id: i, x: p.x, y: p.y, d: p.d, tape: p.tape.slice(0, SLOTS), len: tapeLen(p.tape), held: null, alive: true, op: '' });
      s.area[p.y * s.w + p.x] = 1;
    }
    return s;
  }

  function clone(s) {
    var c = Object.assign({}, s);
    c.tiles = s.tiles.slice();
    c.items = Object.assign({}, s.items);
    c.fuse = Object.assign({}, s.fuse);
    c.area = Object.assign({}, s.area);
    c.husks = s.husks.map(function (q) { return Object.assign({}, q); });
    c.imps = s.imps.map(function (q) { return Object.assign({}, q); });
    return c;
  }

  function fail(s, msg, x, y, ev) { s.error = { msg: msg, x: x, y: y }; ev.push({ e: 'error', x: x, y: y }); }
  function huskAt(s, x, y) { for (var i = 0; i < s.husks.length; i++) { var q = s.husks[i]; if (q.hp > 0 && q.x === x && q.y === y) return q; } return null; }
  function impAt(s, x, y) { for (var i = 0; i < s.imps.length; i++) { var q = s.imps[i]; if (q.alive && q.x === x && q.y === y) return q; } return null; }
  var NAME = { s: 'shards', c: 'chips' };

  function cycle(s0) {
    if (s0.done || s0.error) return null;
    var s = clone(s0), ev = [], c = s.cycle;
    s.imps.forEach(function (m) { m.op = m.len ? (m.tape[c % m.len] || 'W') : 'W'; m.from = [m.x, m.y]; });
    s.husks.forEach(function (q) { q.from = [q.x, q.y]; });

    s.imps.forEach(function (m) {
      if (m.op === 'L') m.d = (m.d + 3) % 4;
      if (m.op === 'R') m.d = (m.d + 1) % 4;
    });
    s.imps.forEach(function (m) {
      if (m.op !== 'H') return;
      var fx = m.x + DX[m.d], fy = m.y + DY[m.d], q = huskAt(s, fx, fy);
      ev.push({ e: 'swing', id: m.id, x: fx, y: fy });
      if (q) { q.hp -= 1; ev.push({ e: 'hit', x: fx, y: fy }); if (q.hp <= 0) ev.push({ e: 'die', x: fx, y: fy }); }
    });
    s.imps.forEach(function (m) {
      if (m.op !== 'G' || m.held) return;
      var fx = m.x + DX[m.d], fy = m.y + DY[m.d], i = fy * s.w + fx, t = tile(s, fx, fy);
      if (s.items[i] && (t === 'S' || t === '.' || (t === 'U' && s.items[i] === 'c'))) {
        m.held = s.items[i]; delete s.items[i];
        ev.push({ e: 'grab', id: m.id, x: fx, y: fy });
      }
    });
    for (var a = 0; a < s.imps.length && !s.error; a++) {
      var m = s.imps[a];
      if (m.op !== 'D' || !m.held) continue;
      var fx = m.x + DX[m.d], fy = m.y + DY[m.d], i = fy * s.w + fx, t = tile(s, fx, fy);
      if (t === 'T') {
        if (m.held !== s.item) { fail(s, 'The port takes only ' + NAME[s.item] + '.', fx, fy, ev); break; }
        s.delivered++; m.held = null;
        ev.push({ e: 'deliver', x: fx, y: fy });
      } else if (t === 'U') {
        if (m.held !== 's' || s.items[i] || s.fuse[i] >= 2) { fail(s, 'The fuser cannot take that now.', fx, fy, ev); break; }
        s.fuse[i]++; m.held = null;
        ev.push({ e: 'feed', x: fx, y: fy });
      } else if (t === '.' && !s.items[i] && !huskAt(s, fx, fy)) {
        s.items[i] = m.held; m.held = null;
        ev.push({ e: 'drop', x: fx, y: fy });
      } else { fail(s, 'There is nowhere to drop it.', fx, fy, ev); break; }
    }
    if (s.error) return { s: s, ev: ev };

    var movers = s.imps.filter(function (m) { return m.alive && m.op === 'F'; });
    var target = {};
    for (var b = 0; b < movers.length; b++) {
      var mv = movers[b], tx = mv.x + DX[mv.d], ty = mv.y + DY[mv.d];
      if (tile(s, tx, ty) !== '.') { fail(s, 'An imp walked into a wall.', tx, ty, ev); return { s: s, ev: ev }; }
      if (huskAt(s, tx, ty)) { fail(s, 'An imp walked into a husk.', tx, ty, ev); return { s: s, ev: ev }; }
      var k = ty * s.w + tx;
      if (target[k]) { fail(s, 'Two imps collided.', tx, ty, ev); return { s: s, ev: ev }; }
      target[k] = mv; mv.to = [tx, ty];
    }
    for (var e = 0; e < movers.length; e++) {
      var m2 = movers[e], o = impAt(s, m2.to[0], m2.to[1]);
      if (o && o !== m2 && (!o.to || (o.op !== 'F') || (o.to[0] === m2.x && o.to[1] === m2.y))) {
        fail(s, 'Two imps collided.', m2.to[0], m2.to[1], ev); return { s: s, ev: ev };
      }
    }
    movers.forEach(function (m3) { m3.x = m3.to[0]; m3.y = m3.to[1]; delete m3.to; s.area[m3.y * s.w + m3.x] = 1; });
    s.imps.forEach(function (m4) { delete m4.to; });

    s.husks = s.husks.filter(function (q) { return q.hp > 0; });
    for (var f = 0; f < s.husks.length; f++) {
      var q = s.husks[f];
      if (q.d < 0) continue;
      var nx = q.x + DX[q.d], ny = q.y + DY[q.d];
      var im = impAt(s, nx, ny);
      if (im) { fail(s, 'A husk bit an imp.', nx, ny, ev); ev.push({ e: 'bite', x: nx, y: ny }); return { s: s, ev: ev }; }
      if (tile(s, nx, ny) === '.' && !huskAt(s, nx, ny)) { q.x = nx; q.y = ny; }
      else q.d = (q.d + 2) % 4;
    }
    for (var key in s.fuse) {
      if (s.fuse[key] >= 2 && !s.items[key]) { s.fuse[key] = 0; s.items[key] = 'c'; ev.push({ e: 'fuse', i: +key }); }
    }
    for (var j = 0; j < s.tiles.length; j++) if (s.tiles[j] === 'S' && !s.items[j]) s.items[j] = 's';

    s.cycle++;
    if (s.delivered >= s.need) { s.done = true; ev.push({ e: 'win' }); }
    else if (s.cycle >= LIMIT) fail(s, 'The loop ran ' + LIMIT + ' cycles without finishing.', -1, -1, ev);
    return { s: s, ev: ev };
  }

  function cost(prog) {
    var n = 0;
    prog.forEach(function (p) { n += IMP_COST; p.tape.forEach(function (t) { if (t && t !== 'W') n++; }); });
    return n;
  }

  // Runs a program to the end. Returns {ok, cycles, cost, area, error}.
  function run(def, prog) {
    var s = start(def, prog);
    if (typeof s === 'string') return { ok: false, error: { msg: s } };
    for (;;) {
      var r = cycle(s);
      if (!r) break;
      s = r.s;
      if (s.done || s.error) break;
    }
    return { ok: s.done, cycles: s.cycle, cost: cost(prog), area: Object.keys(s.area).length, error: s.error };
  }

  return { load: load, start: start, cycle: cycle, run: run, cost: cost, tile: tile, SLOTS: SLOTS, OPS: OPS, DX: DX, DY: DY, IMP_COST: IMP_COST };
})();
