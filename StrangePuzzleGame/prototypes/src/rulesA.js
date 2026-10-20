// Build A rules: bits, compiled daemons, and husks on a turn-based grid. No drawing code, so Node can load it.
var RulesA = (function () {
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var INV_MAX = 3, STACK_MAX = 2, FUSE = 3;

  // Map characters: # wall, % cracked wall, _ void, . floor, P Pilcrow, C chip, r y b bits, h husk, B brick.
  function load(def) {
    var rows = def.map, h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var s = {
      w: w, h: h, tiles: [], bits: {}, objs: [], nid: 1, px: 0, py: 0, face: 2,
      hp: def.hp || 3, maxHp: def.hp || 3, inv: '', goal: -1, recipes: def.recipes,
      won: false, lost: false, turn: 0,
    };
    var husks = def.husks || [], hi = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y][x] || '_', i = y * w + x, t = '.';
      if (ch === '#' || ch === '%' || ch === '_') t = ch;
      else if (ch === 'P') { s.px = x; s.py = y; }
      else if (ch === 'C') s.goal = i;
      else if ('ryb'.indexOf(ch) >= 0) s.bits[i] = ch;
      else if (ch === 'h') {
        var hd = husks[hi++] || {};
        s.objs.push({ id: s.nid++, k: 'husk', x: x, y: y, hp: hd.hp || 1, maxHp: hd.hp || 1, pd: hd.pace === undefined ? -1 : hd.pace });
      } else if (ch === 'B') s.objs.push({ id: s.nid++, k: 'brick', x: x, y: y });
      s.tiles.push(t);
    }
    return s;
  }

  function clone(s) {
    var c = Object.assign({}, s);
    c.tiles = s.tiles.slice();
    c.bits = Object.assign({}, s.bits);
    c.objs = s.objs.map(function (o) { return Object.assign({}, o); });
    return c;
  }

  function inb(s, x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h; }
  function tile(s, x, y) { return inb(s, x, y) ? s.tiles[y * s.w + x] : 'X'; }
  function objAt(s, x, y) {
    for (var i = 0; i < s.objs.length; i++) { var o = s.objs[i]; if (!o.dead && o.x === x && o.y === y) return o; }
    return null;
  }
  function sortStr(str) { return str.split('').sort().join(''); }
  function recipeFor(s, stack) {
    var key = sortStr(stack);
    for (var k in s.recipes) if (sortStr(s.recipes[k]) === key) return k;
    return null;
  }

  function kill(s, o, ev) { o.dead = true; ev.push({ e: 'die', id: o.id, k: o.k, x: o.x, y: o.y }); }

  function movePlayer(s, x, y, ev) {
    s.px = x; s.py = y;
    var i = y * s.w + x, st = s.bits[i];
    if (st) {
      var room = INV_MAX - s.inv.length;
      if (room > 0) {
        s.inv += st.slice(0, room);
        if (st.length > room) s.bits[i] = st.slice(room); else delete s.bits[i];
        ev.push({ e: 'pick', x: x, y: y });
      }
    }
    if (i === s.goal) { s.won = true; ev.push({ e: 'win' }); }
  }

  // Direction (0-3) from (x, y) along which Pilcrow is visible, or -1.
  function sight(s, x, y) {
    for (var d = 0; d < 4; d++) {
      var cx = x + DX[d], cy = y + DY[d];
      for (;;) {
        if (cx === s.px && cy === s.py) return d;
        var t = tile(s, cx, cy);
        if (t === '#' || t === '%' || t === 'X' || objAt(s, cx, cy)) break;
        cx += DX[d]; cy += DY[d];
      }
    }
    return -1;
  }

  function ramAct(s, o, ev) {
    if (o.d < 0) {
      var d = sight(s, o.x, o.y);
      if (d < 0) return;
      o.d = d;
      ev.push({ e: 'spot', id: o.id });
    }
    var nx = o.x + DX[o.d], ny = o.y + DY[o.d];
    if (nx === s.px && ny === s.py) {
      s.hp -= 3; o.d = -1;
      ev.push({ e: 'crush', id: o.id, x: nx, y: ny });
      return;
    }
    var q = objAt(s, nx, ny), t = tile(s, nx, ny);
    if (q) {
      if (q.k === 'husk') {
        q.hp -= 3;
        ev.push({ e: 'hit', id: q.id, x: nx, y: ny, by: o.id });
        if (q.hp <= 0) kill(s, q, ev); else o.d = -1;
        return;
      }
      o.d = -1; ev.push({ e: 'bump', id: o.id });
      return;
    }
    if (t === '%') { s.tiles[ny * s.w + nx] = '.'; ev.push({ e: 'smash', x: nx, y: ny }); return; }
    if (t === '#') { o.d = -1; ev.push({ e: 'bump', id: o.id }); return; }
    o.x = nx; o.y = ny;
    if (t === '_' || t === 'X') {
      o.dead = true;
      if (t === '_') { s.tiles[ny * s.w + nx] = '.'; ev.push({ e: 'fill', id: o.id, x: nx, y: ny }); }
      else ev.push({ e: 'fall', id: o.id, x: nx, y: ny });
    }
  }

  function explode(s, o, ev) {
    o.dead = true;
    ev.push({ e: 'boom', id: o.id, x: o.x, y: o.y });
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var x = o.x + dx, y = o.y + dy;
      if (!inb(s, x, y)) continue;
      var i = y * s.w + x;
      if (s.tiles[i] === '%') { s.tiles[i] = '.'; ev.push({ e: 'smash', x: x, y: y }); }
      delete s.bits[i];
      var q = objAt(s, x, y);
      if (q) {
        if (q.k === 'husk') { q.hp -= 3; ev.push({ e: 'hit', id: q.id, x: x, y: y }); if (q.hp <= 0) kill(s, q, ev); }
        else kill(s, q, ev);
      }
      if (s.px === x && s.py === y) { s.hp -= 3; ev.push({ e: 'burn', x: x, y: y }); }
    }
  }

  function huskAct(s, o, ev) {
    if (o.pd >= 0) {
      var nx = o.x + DX[o.pd], ny = o.y + DY[o.pd];
      if (tile(s, nx, ny) === '.' && !objAt(s, nx, ny) && !(nx === s.px && ny === s.py)) { o.x = nx; o.y = ny; }
      else o.pd = (o.pd + 2) % 4;
    }
    if (Math.abs(o.x - s.px) + Math.abs(o.y - s.py) === 1) {
      s.hp -= 1;
      ev.push({ e: 'bite', id: o.id, x: s.px, y: s.py });
    }
  }

  // Actions: {t:'move', d}, {t:'zap', d}, {t:'drop', c}, {t:'wait'}. Returns {s, ev}, or null when nothing happens.
  function step(s0, act) {
    if (s0.won || s0.lost) return null;
    var s = clone(s0), ev = [];
    if (act.t === 'move') {
      var d = act.d, tx = s.px + DX[d], ty = s.py + DY[d], o = objAt(s, tx, ty), t = tile(s, tx, ty);
      s.face = d;
      if (o) {
        if (o.k === 'husk') {
          o.hp -= 1;
          ev.push({ e: 'hit', id: o.id, x: tx, y: ty, by: 0 });
          if (o.hp <= 0) kill(s, o, ev);
        } else if (o.k === 'fork' || o.k === 'brick') {
          var bx = tx + DX[d], by = ty + DY[d], bt = tile(s, bx, by);
          if (bt === '.' && !objAt(s, bx, by)) {
            o.x = bx; o.y = by;
            ev.push({ e: 'push', id: o.id });
          } else if (bt === '_' || bt === 'X') {
            o.x = bx; o.y = by; o.dead = true;
            if (o.k === 'brick' && bt === '_') { s.tiles[by * s.w + bx] = '.'; ev.push({ e: 'fill', id: o.id, x: bx, y: by }); }
            else ev.push({ e: 'fall', id: o.id, x: bx, y: by });
          } else return null;
          movePlayer(s, tx, ty, ev);
        } else return null;
      } else if (t === '.') {
        movePlayer(s, tx, ty, ev);
        ev.push({ e: 'step' });
      } else return null;
    } else if (act.t === 'drop') {
      var i0 = s.py * s.w + s.px, st = s.bits[i0] || '', at = s.inv.indexOf(act.c);
      if (at < 0 || st.length >= STACK_MAX) return null;
      s.inv = s.inv.slice(0, at) + s.inv.slice(at + 1);
      s.bits[i0] = st + act.c;
      ev.push({ e: 'drop', x: s.px, y: s.py });
    } else if (act.t === 'zap') {
      var zx = s.px, zy = s.py, hit = null;
      s.face = act.d;
      for (;;) {
        zx += DX[act.d]; zy += DY[act.d];
        var zt = tile(s, zx, zy);
        if (zt === 'X' || zt === '#' || zt === '%' || objAt(s, zx, zy)) { hit = 'block'; break; }
        var zi = zy * s.w + zx;
        if (s.bits[zi]) {
          var k = recipeFor(s, s.bits[zi]);
          if (k) {
            delete s.bits[zi];
            var no = { id: s.nid++, k: k, x: zx, y: zy };
            if (k === 'ram') no.d = -1;
            if (k === 'fork') no.f = FUSE;
            s.objs.push(no);
            hit = 'compile';
            ev.push({ e: 'compile', id: no.id, k: k, x: zx, y: zy });
          } else hit = 'norecipe';
          break;
        }
      }
      ev.push({ e: 'zap', x0: s.px, y0: s.py, x1: zx, y1: zy, d: act.d, hit: hit });
    } else if (act.t !== 'wait') return null;

    if (!s.won) {
      for (var a = 0; a < s.objs.length; a++) {
        var ob = s.objs[a];
        if (ob.dead) continue;
        if (ob.k === 'ram') ramAct(s, ob, ev);
        else if (ob.k === 'fork') { ob.f -= 1; if (ob.f <= 0) explode(s, ob, ev); else ev.push({ e: 'tick', id: ob.id }); }
      }
      for (var b = 0; b < s.objs.length; b++) {
        var hk = s.objs[b];
        if (!hk.dead && hk.k === 'husk') huskAct(s, hk, ev);
      }
      if (s.hp <= 0) { s.hp = 0; s.lost = true; ev.push({ e: 'lose' }); }
    }
    s.objs = s.objs.filter(function (q) { return !q.dead; });
    s.turn++;
    return { s: s, ev: ev };
  }

  function key(s) {
    var bk = Object.keys(s.bits).sort(function (a, b) { return a - b; }).map(function (k) { return k + sortStr(s.bits[k]); }).join(',');
    var ok = s.objs.map(function (o) { return o.k[0] + o.x + ',' + o.y + ',' + (o.d === undefined ? '' : o.d) + ',' + (o.f || '') + ',' + (o.hp || '') + ',' + (o.pd === undefined ? '' : o.pd); }).join(';');
    return s.px + ',' + s.py + ',' + s.hp + ',' + sortStr(s.inv) + '|' + s.tiles.join('') + '|' + bk + '|' + ok;
  }

  function actions(s) {
    var out = [];
    for (var d = 0; d < 4; d++) { out.push({ t: 'move', d: d }); out.push({ t: 'zap', d: d }); }
    var seen = {};
    for (var i = 0; i < s.inv.length; i++) if (!seen[s.inv[i]]) { seen[s.inv[i]] = 1; out.push({ t: 'drop', c: s.inv[i] }); }
    out.push({ t: 'wait' });
    return out;
  }

  return { load: load, step: step, key: key, actions: actions, DX: DX, DY: DY, objAt: objAt, tile: tile, sight: sight };
})();
