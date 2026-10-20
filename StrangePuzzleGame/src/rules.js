// Compile rules: bits, compiled daemons, husks, packets, and room machinery on a turn-based grid.
// No drawing code, so Node can load it. Notes/mechanics.md describes every rule and the turn order.
var Rules = (function () {
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var STACK_MAX = 2, FUSE = 3, PINGER_BEAT = 2;
  var CONV = { '^': 0, '>': 1, 'v': 2, '<': 3 };
  // A microwave cooks every bit on it one step around the color wheel each turn. Tokens never cook.
  var COOK = { r: 'y', y: 'b', b: 'r', t: 't' };
  // Portals pair ( with ) and [ with ]. The High Score's relink swaps the pairing to ( with [ and ) with ].
  var LINKS = [{ '(': ')', ')': '(', '[': ']', ']': '[' }, { '(': '[', '[': '(', ')': ']', ']': ')' }];
  var PRINTER = { '1': 'r', '2': 'y', '3': 'b' };
  var PLATE = { o: 0, q: 1 }, DOOR = { D: 0, Q: 1 };
  var HUSK_AI = { h: 'still', H: 'hunt', K: 'clerk', U: 'hoard' };
  var PUSHABLE = { fork: 1, brick: 1, mirror: 1, decoy: 1, key: 1, toy: 1 };
  var METAL = { ram: 1, fork: 1, brick: 1, pinger: 1, mirror: 1, swapper: 1, toy: 1 };
  var DAEMONS = { ram: 1, fork: 1, brick: 1, pinger: 1, mirror: 1, decoy: 1, swapper: 1, echo: 1, toy: 1 };
  // Bolts and packets turn 90 degrees in a mirror. Mirror 0 is '/', mirror 1 is '\'.
  var REFLECT = [[1, 0, 3, 2], [3, 2, 1, 0]];

  // Map characters: # wall, % cracked wall, _ void, . floor, P Pilcrow, C chip, r y b bits,
  // h husk, H hunter, K clerk, U hoarder, B brick, M and N mirrors (/ and \), g glass,
  // ^ > v < conveyors, o and q plates, D and Q their doors, 1 2 3 printers of r y b, i grease, w microwave,
  // ( ) [ ] portals, t token (a bit that never compiles unless a recipe names it), $ token gate, ',' seed, & vine,
  // * splitter, ! toggle switch, J and j switch doors (J open while the switch is on, j while it is off; def.sw starts it on),
  // A ramp, ; cracked floor, O bumper. def.objs may place magnets {k: 'magnet', x, y, on: 0 to start switched off} and projectors {k: 'projector', x, y, d}.
  // def.objs may place sprinklers: {k: 'sprinkler', x, y, d}.
  // def.husks configures every husk letter in reading order: {hp, pace, face}. def.objs places other daemons: {k, x, y, d}.
  // def.stacks places bit stacks, bottom bit first, on any floor tile including conveyors: {x, y, bits}.
  function load(def) {
    var rows = def.map, h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var s = {
      w: w, h: h, tiles: [], bits: {}, objs: [], nid: 1, px: 0, py: 0, face: 2,
      hp: def.hp || 3, maxHp: def.hp || 3, inv: ['', '', ''], goal: -1, recipes: Object.assign({}, def.recipes),
      open: [false, false], won: false, lost: false, turn: 0, link: 0, ports: {}, sw: def.sw || 0,
    };
    var husks = def.husks || [], hi = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y][x] || '_', i = y * w + x, t = '.';
      if ('#%_g^>v<oqDQ123=iw()[]$,&*!JjA;O'.indexOf(ch) >= 0) t = ch;
      else if (ch === 'Z') s.objs.push(makeBoss(s, def.boss || {}, x, y));
      else if (ch === 'P') { s.px = x; s.py = y; }
      else if (ch === 'C') s.goal = i;
      else if ('rybt'.indexOf(ch) >= 0) s.bits[i] = ch;
      else if (HUSK_AI[ch]) {
        var hd = husks[hi++] || {}, ai = HUSK_AI[ch];
        if (ai === 'still' && hd.pace !== undefined) ai = 'pace';
        var hk = { id: s.nid++, k: 'husk', ai: ai, x: x, y: y, hp: hd.hp || 1, maxHp: hd.hp || 1, pd: hd.pace === undefined ? -1 : hd.pace };
        if (ai === 'clerk') hk.f = hd.face === undefined ? 2 : hd.face;
        if (ai === 'hoard') { hk.belly = ''; if (hk.pd < 0) hk.pd = 1; }
        s.objs.push(hk);
      } else if (ch === 'B') s.objs.push({ id: s.nid++, k: 'brick', x: x, y: y });
      else if (ch === 'M' || ch === 'N') s.objs.push({ id: s.nid++, k: 'mirror', x: x, y: y, o: ch === 'M' ? 0 : 1 });
      s.tiles.push(t);
      if (LINKS[0][t]) s.ports[t] = i;
    }
    (def.objs || []).forEach(function (o) { var m = make(s, o.k, o.x, o.y, o.d === undefined ? 1 : o.d); if (o.on === 0) m.on = 0; s.objs.push(m); });
    (def.stacks || []).forEach(function (st) { s.bits[st.y * w + st.x] = st.bits; });
    (def.keys || []).forEach(function (kc) { s.objs.push({ id: s.nid++, k: 'key', x: kc.x, y: kc.y, v: kc.v }); });
    s.board = !!def.board;
    boardRecipes(s);
    updateDoors(s);
    s.objs.forEach(function (o) { if (o.k === 'boss') telegraph(s, o); });
    return s;
  }

  function make(s, k, x, y, d) {
    var o = { id: s.nid++, k: k, x: x, y: y };
    if (k === 'ram') o.d = -1;
    if (k === 'fork') o.f = FUSE;
    if (k === 'pinger') { o.d = d; o.c = PINGER_BEAT; }
    if (k === 'mirror') o.o = d === 1 || d === 3 ? 1 : 0;
    if (k === 'packet') { o.d = d; o.fresh = 1; }
    if (k === 'sprinkler') o.d = d;
    if (k === 'magnet') o.on = 1;
    if (k === 'projector') o.d = d;
    if (k === 'toy') o.d = d;
    return o;
  }

  function clone(s) {
    var c = Object.assign({}, s);
    c.tiles = s.tiles.slice();
    c.bits = Object.assign({}, s.bits);
    c.inv = s.inv.slice();
    c.open = s.open.slice();
    c.objs = s.objs.map(function (o) { return Object.assign({}, o); });
    c.recipes = Object.assign({}, s.recipes);
    return c;
  }

  function inb(s, x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h; }
  function tile(s, x, y) { return inb(s, x, y) ? s.tiles[y * s.w + x] : 'X'; }
  function doorOpen(s, t) { return DOOR[t] !== undefined && s.open[DOOR[t]]; }
  // A switch door follows the switch, but it never shuts on something standing in it.
  function swOpen(s, x, y) {
    var t = tile(s, x, y);
    if (t !== 'J' && t !== 'j') return false;
    return (t === 'J') === !!s.sw || isPil(s, x, y) || !!objAt(s, x, y);
  }
  // Ground that feet, wheels, and pushed things can stand on.
  function walkable(s, x, y) {
    var t = tile(s, x, y);
    return t === '.' || t === 'i' || t === 'w' || t === ',' || t === 'A' || t === ';' || CONV[t] !== undefined || PLATE[t] !== undefined || doorOpen(s, t) || !!LINKS[0][t] || swOpen(s, x, y);
  }
  // Tiles that stop bolts, packets, and sight. Glass and void let them through.
  function opaque(s, x, y) {
    var t = tile(s, x, y);
    return t === '#' || t === '%' || t === 'X' || t === '=' || t === '$' || t === '&' || (DOOR[t] !== undefined && !doorOpen(s, t)) || ((t === 'J' || t === 'j') && !swOpen(s, x, y));
  }
  // The cell one step along d from (x, y). Stepping onto a portal lands on its partner instead, still heading along d.
  function ahead(s, x, y, d) {
    var nx = x + DX[d], ny = y + DY[d], p = s.ports[(LINKS[s.link] || {})[tile(s, nx, ny)]];
    return p === undefined ? [nx, ny] : [p % s.w, Math.floor(p / s.w)];
  }
  function portalEv(x, y, d, nx, ny, id, ev) {
    if (nx !== x + DX[d] || ny !== y + DY[d]) ev.push({ e: 'portal', id: id, x0: x + DX[d], y0: y + DY[d], x1: nx, y1: ny });
  }
  function objAt(s, x, y) {
    for (var i = 0; i < s.objs.length; i++) {
      var o = s.objs[i];
      if (o.dead || o.k === 'packet') continue;
      if (o.x === x && o.y === y) return o;
      if (o.k === 'boss' && x >= o.x && x <= o.x + 1 && y >= o.y && y <= o.y + 1) return o;
    }
    return null;
  }
  function isPil(s, x, y) { return s.px === x && s.py === y; }
  function sortStr(str) { return str.split('').sort().join(''); }
  // Recipes may be ordered (r>y means r at the bottom, y on top). Unordered ones match any order.
  function recipeFor(s, stack) {
    for (var k in s.recipes) {
      var r = s.recipes[k];
      if (r.indexOf('>') >= 0 ? stack === r.replace(/>/g, '') : sortStr(stack) === sortStr(r)) return k;
    }
    return null;
  }
  function kill(s, o, ev) {
    if (o.dead) return;
    o.dead = true;
    ev.push({ e: 'die', id: o.id, k: o.k, x: o.x, y: o.y });
    if (o.k === 'husk' && o.belly) dropBits(s, o.x, o.y, o.belly, ev);
  }
  function dropBits(s, x, y, bits, ev) {
    var i = y * s.w + x, st = (s.bits[i] || '') + bits;
    s.bits[i] = st.slice(0, STACK_MAX);
    ev.push({ e: 'spill', x: x, y: y });
  }
  // A Clerk's shield faces the way it looks. A hit travelling toward its face does nothing.
  function shielded(q, dir) { return q.k === 'husk' && q.ai === 'clerk' && q.f === (dir + 2) % 4; }

  // The nearest target (Pilcrow or a Decoy) seen along a clear row or column. A tie goes to the Decoy.
  function nearestTarget(s, x, y) {
    var best = null;
    for (var d = 0; d < 4; d++) {
      var a = ahead(s, x, y, d), cx = a[0], cy = a[1], dist = 1;
      for (var n = 0; n < 200; n++) {
        if (opaque(s, cx, cy) || PRINTER[tile(s, cx, cy)] || tile(s, cx, cy) === '*' || tile(s, cx, cy) === '!') break;
        var hit = null;
        if (isPil(s, cx, cy)) hit = { d: d, dist: dist, decoy: false };
        var q = objAt(s, cx, cy);
        if (!hit && q && q.k === 'decoy') hit = { d: d, dist: dist, decoy: true };
        if (hit) {
          if (!best || hit.dist < best.dist || (hit.dist === best.dist && hit.decoy && !best.decoy)) best = hit;
          break;
        }
        if (q || (cx === x && cy === y)) break;
        a = ahead(s, cx, cy, d); cx = a[0]; cy = a[1]; dist++;
      }
    }
    return best;
  }

  function movePlayer(s, x, y, ev) {
    s.px = x; s.py = y;
    var i = y * s.w + x, st = s.bits[i];
    if (st) {
      var left = '', slots = [];
      for (var k = 0; k < st.length; k++) {
        var free = s.inv.indexOf('');
        if (free < 0) { left += st[k]; continue; }
        s.inv[free] = st[k];
        slots.push(free);
      }
      if (left) s.bits[i] = left; else delete s.bits[i];
      if (slots.length) ev.push({ e: 'pick', x: x, y: y, slots: slots });
    }
    if (i === s.goal) { s.won = true; ev.push({ e: 'win' }); }
  }

  // Grease: whatever steps onto it keeps sliding the same way until the next tile would stop it or it reaches dry floor.
  // who is an object, or null for Pilcrow. Sliding into the void drops it there.
  // A ramp under it throws it on first, and it slides on wherever it lands.
  function slide(s, who, d, ev) {
    for (var n = 0; n < 64; n++) {
      var x = who ? who.x : s.px, y = who ? who.y : s.py;
      if (who && who.dead) return;
      if (tile(s, x, y) === 'A') { if (!vault(s, who, x, y, d, ev)) return; continue; }
      if (tile(s, x, y) !== 'i') return;
      var a = ahead(s, x, y, d), nx = a[0], ny = a[1], nt = tile(s, nx, ny);
      if (nt === '_' || nt === 'X') {
        if (!who) { s.px = nx; s.py = ny; s.hp = 0; ev.push({ e: 'drop-off', x: nx, y: ny }); }
        else if (who.k === 'husk') { who.x = nx; who.y = ny; who.dead = true; ev.push({ e: 'fall', id: who.id, k: 'husk', x: nx, y: ny }); }
        else sink(s, who, nx, ny, ev);
        return;
      }
      if (!walkable(s, nx, ny) || objAt(s, nx, ny) || (who && isPil(s, nx, ny))) return;
      if (who) { who.x = nx; who.y = ny; } else movePlayer(s, nx, ny, ev);
      ev.push({ e: 'slide', id: who ? who.id : 0 });
      portalEv(x, y, d, nx, ny, who ? who.id : 0, ev);
      if (s.won) return;
    }
  }

  // A ramp throws whatever arrives on it over the next tile to land on the one after. Walls, hedges, glass, closed doors,
  // and machines are too tall to clear, so they leave it on the ramp. Returns whether it landed and may move on.
  function vault(s, who, x, y, d, ev) {
    if (who && (who.k === 'packet' || who.k === 'boss')) return false;
    var mx = x + DX[d], my = y + DY[d], lx = mx + DX[d], ly = my + DY[d], mt = tile(s, mx, my), lt = tile(s, lx, ly), id = who ? who.id : 0;
    if (opaque(s, mx, my) || mt === 'g' || PRINTER[mt] || mt === '*' || mt === '!') return false;
    if (lt === '_' || lt === 'X') {
      ev.push({ e: 'jump', id: id, x0: x, y0: y, x1: lx, y1: ly });
      if (!who) { s.px = lx; s.py = ly; s.hp = 0; ev.push({ e: 'drop-off', x: lx, y: ly }); }
      else if (who.k === 'husk') { who.x = lx; who.y = ly; who.dead = true; ev.push({ e: 'fall', id: who.id, k: 'husk', x: lx, y: ly }); }
      else sink(s, who, lx, ly, ev);
      return false;
    }
    if (!walkable(s, lx, ly) || objAt(s, lx, ly) || isPil(s, lx, ly)) return false;
    ev.push({ e: 'jump', id: id, x0: x, y0: y, x1: lx, y1: ly });
    if (who) { who.x = lx; who.y = ly; } else movePlayer(s, lx, ly, ev);
    return !s.won;
  }
  // Each switched-on magnet pulls the nearest metal daemon in each of its four lines one tile closer.
  // Walls stop the pull, and Pilcrow or anything that is not metal in the way shields what lies beyond.
  function pull(s, m, ev) {
    for (var d = 0; d < 4; d++) {
      var x = m.x + DX[d], y = m.y + DY[d];
      for (var n = 0; n < 50 && inb(s, x, y) && !opaque(s, x, y); n++) {
        if (isPil(s, x, y)) break;
        var q = objAt(s, x, y);
        if (q) {
          if (METAL[q.k] && n > 0 && push(s, q, (d + 2) % 4, ev)) ev.push({ e: 'pull', id: q.id, mag: m.id });
          break;
        }
        x += DX[d]; y += DY[d];
      }
    }
  }

  // Pushes o one tile along d. Returns false when the way is blocked.
  function push(s, o, d, ev) {
    var a = ahead(s, o.x, o.y, d), bx = a[0], by = a[1], bt = tile(s, bx, by);
    if (walkable(s, bx, by) && !objAt(s, bx, by) && !isPil(s, bx, by)) {
      portalEv(o.x, o.y, d, bx, by, o.id, ev);
      o.x = bx; o.y = by;
      ev.push({ e: 'push', id: o.id });
      slide(s, o, d, ev);
      return true;
    }
    if (bt === '_' || bt === 'X') { sink(s, o, bx, by, ev); return true; }
    return false;
  }
  // A Ram or Brick that drops into the void fills it. Anything else falls away.
  function sink(s, o, x, y, ev) {
    o.x = x; o.y = y; o.dead = true;
    if ((o.k === 'brick' || o.k === 'ram') && tile(s, x, y) === '_') { s.tiles[y * s.w + x] = '.'; ev.push({ e: 'fill', id: o.id, k: o.k, x: x, y: y }); }
    else ev.push({ e: 'fall', id: o.id, k: o.k, x: x, y: y });
  }

  function hurtHusk(s, q, dmg, dir, ev, by) {
    if (shielded(q, dir)) { ev.push({ e: 'clank', id: q.id, x: q.x, y: q.y }); return false; }
    q.hp -= dmg;
    ev.push({ e: 'hit', id: q.id, x: q.x, y: q.y, by: by });
    if (q.hp <= 0) kill(s, q, ev);
    return true;
  }

  // Pilcrow's or an Echo's step: hit a husk, push a crate-like daemon, or walk.
  function stepInto(s, who, d, ev) {
    var x0 = who ? who.x : s.px, y0 = who ? who.y : s.py, a = ahead(s, x0, y0, d), tx = a[0], ty = a[1], id = who ? who.id : 0;
    if (who && isPil(s, tx, ty)) return false;
    var o = objAt(s, tx, ty);
    if (o) {
      if (o.k === 'husk') { hurtHusk(s, o, 1, d, ev, id); return true; }
      if (o.k === 'boss') { ev.push({ e: 'clank', id: o.id, x: tx, y: ty }); return true; }
      if (PUSHABLE[o.k]) {
        if (!push(s, o, d, ev)) return false;
        if (who) { who.x = tx; who.y = ty; } else movePlayer(s, tx, ty, ev);
        portalEv(x0, y0, d, tx, ty, id, ev);
        if (!s.won) slide(s, who, d, ev);
        return true;
      }
      return false;
    }
    // A token gate opens for good when Pilcrow walks into it with a token to spend.
    if (tile(s, tx, ty) === '$' && !who && s.inv.indexOf('t') >= 0) {
      var slot = s.inv.indexOf('t');
      s.inv[slot] = '';
      s.tiles[ty * s.w + tx] = '.';
      ev.push({ e: 'pay', x: tx, y: ty, slot: slot });
    }
    if (!walkable(s, tx, ty)) return false;
    if (who) { who.x = tx; who.y = ty; ev.push({ e: 'echo', id: who.id }); }
    else { movePlayer(s, tx, ty, ev); ev.push({ e: 'step' }); }
    portalEv(x0, y0, d, tx, ty, id, ev);
    if (!s.won) slide(s, who, d, ev);
    return true;
  }

  // A Printer prints one bit onto the tile a hit came from, if there is room.
  function print(s, color, x, y, ev) {
    if (!walkable(s, x, y) || objAt(s, x, y)) return;
    var i = y * s.w + x, st = s.bits[i] || '';
    if (st.length >= STACK_MAX) return;
    s.bits[i] = st + color;
    ev.push({ e: 'print', x: x, y: y, c: color });
  }

  // Compiles the stack at (x, y) if it matches a recipe. The new daemon faces d.
  function compileAt(s, x, y, d, ev) {
    var i = y * s.w + x, k = recipeFor(s, s.bits[i]);
    if (!k) return false;
    delete s.bits[i];
    var no = make(s, k, x, y, d);
    s.objs.push(no);
    ev.push({ e: 'compile', id: no.id, k: k, x: x, y: y });
    return true;
  }

  function swap(s, sw, ev) {
    var ox = s.px, oy = s.py;
    ev.push({ e: 'swap', id: sw.id, x0: ox, y0: oy, x1: sw.x, y1: sw.y });
    var tx = sw.x, ty = sw.y;
    sw.x = ox; sw.y = oy;
    movePlayer(s, tx, ty, ev);
  }

  function fire(s, p, ev) {
    var a = ahead(s, p.x, p.y, p.d);
    ev.push({ e: 'fire', id: p.id, x: p.x, y: p.y, d: p.d });
    var pk = make(s, 'packet', p.x, p.y, p.d);
    if (flyPacket(s, pk, a[0], a[1], ev)) s.objs.push(pk);
  }

  // Moves a packet onto (nx, ny) and resolves what it meets. Returns whether it is still flying.
  function flyPacket(s, p, nx, ny, ev) {
    var t = tile(s, nx, ny);
    if (opaque(s, nx, ny)) { ev.push({ e: 'pop', x: p.x, y: p.y, d: p.d }); return false; }
    if (PRINTER[t]) { print(s, PRINTER[t], p.x, p.y, ev); ev.push({ e: 'pop', x: p.x, y: p.y, d: p.d }); return false; }
    if (t === '!') { toggle(s, nx, ny, ev); ev.push({ e: 'pop', x: p.x, y: p.y, d: p.d }); return false; }
    if (t === 'O') { p.d = (p.d + 2) % 4; ev.push({ e: 'boing', x: nx, y: ny }); return true; }
    // A packet that enters a splitter becomes two that leave its sides on the next turn.
    if (t === '*') {
      [(p.d + 3) % 4, (p.d + 1) % 4].forEach(function (nd) { var np = make(s, 'packet', nx, ny, nd); s.objs.push(np); });
      ev.push({ e: 'split', x: nx, y: ny });
      return false;
    }
    if (isPil(s, nx, ny)) { s.hp -= 1; ev.push({ e: 'zapped', x: nx, y: ny }); return false; }
    var q = objAt(s, nx, ny);
    if (q) {
      if (q.k === 'mirror') { p.x = nx; p.y = ny; p.d = REFLECT[q.o][p.d]; ev.push({ e: 'glint', id: q.id }); return true; }
      if (q.k === 'husk') hurtHusk(s, q, 1, p.d, ev, p.id);
      else if (q.k === 'boss') hurtBoss(s, q, 1, ev, p.d);
      else if (q.k === 'fork') explode(s, q, ev);
      else if (q.k === 'ram') { q.d = p.d; ev.push({ e: 'spot', id: q.id }); }
      else if (q.k === 'decoy' || q.k === 'echo') kill(s, q, ev);
      else ev.push({ e: 'pop', x: nx, y: ny, d: p.d });
      return false;
    }
    if (s.bits[ny * s.w + nx]) {
      if (!compileAt(s, nx, ny, p.d, ev)) ev.push({ e: 'pop', x: nx, y: ny, d: p.d });
      return false;
    }
    portalEv(p.x, p.y, p.d, nx, ny, p.id, ev);
    p.x = nx; p.y = ny;
    return true;
  }

  function zap(s, d, ev) { trace(s, s.px, s.py, d, ev, 0); }
  // One bolt from (x, y) along d. A splitter sends two more bolts out of its sides, and those are branches.
  function trace(s, zx, zy, d, ev, depth) {
    var path = [[zx, zy]], hit = null, split = false;
    for (var n = 0; n < 200; n++) {
      var nx = zx + DX[d], ny = zy + DY[d], t = tile(s, nx, ny);
      if (opaque(s, nx, ny)) { hit = 'block'; break; }
      if (PRINTER[t]) { print(s, PRINTER[t], zx, zy, ev); hit = 'print'; zx = nx; zy = ny; break; }
      if (t === '!') { toggle(s, nx, ny, ev); hit = 'switch'; zx = nx; zy = ny; break; }
      if (t === '*') { hit = 'split'; zx = nx; zy = ny; split = true; break; }
      if (t === 'O') { path.push([zx, zy]); d = (d + 2) % 4; ev.push({ e: 'boing', x: nx, y: ny }); continue; }
      // A bolt that enters a portal leaves its partner. The path breaks with a null so the jump is not drawn.
      var a = ahead(s, zx, zy, d);
      if (a[0] !== nx || a[1] !== ny) { path.push([nx, ny], null, a); nx = a[0]; ny = a[1]; }
      zx = nx; zy = ny;
      if (isPil(s, zx, zy)) { hit = 'block'; break; }
      var q = objAt(s, zx, zy);
      if (q) {
        if (q.k === 'mirror') { d = REFLECT[q.o][d]; path.push([zx, zy]); ev.push({ e: 'glint', id: q.id }); continue; }
        if (q.k === 'swapper') { hit = 'swap'; path.push([zx, zy]); swap(s, q, ev); break; }
        if (q.k === 'fork') { q.f = 1; hit = 'overclock'; ev.push({ e: 'overclock', id: q.id }); break; }
        if (q.k === 'pinger') { hit = 'overclock'; ev.push({ e: 'overclock', id: q.id }); fire(s, q, ev); break; }
        if (q.k === 'sprinkler') { q.d = (q.d + 1) % 4; hit = 'overclock'; ev.push({ e: 'overclock', id: q.id }); break; }
        if (q.k === 'magnet') { q.on = q.on ? 0 : 1; hit = 'overclock'; ev.push({ e: 'overclock', id: q.id }); break; }
        if (q.k === 'projector') { q.d = (q.d + 1) % 4; hit = 'overclock'; ev.push({ e: 'overclock', id: q.id }); break; }
        hit = 'block';
        break;
      }
      if (s.bits[zy * s.w + zx]) { hit = compileAt(s, zx, zy, d, ev) ? 'compile' : 'norecipe'; break; }
    }
    path.push([zx, zy]);
    ev.push({ e: 'zap', path: path, hit: hit, x0: path[0][0], y0: path[0][1], x1: zx, y1: zy, d: d, branch: depth > 0 });
    if (split && depth < 6) { trace(s, zx, zy, (d + 3) % 4, ev, depth + 1); trace(s, zx, zy, (d + 1) % 4, ev, depth + 1); }
  }
  // A toggle switch flips every switch door: J is open while the switch is on, j while it is off.
  function toggle(s, x, y, ev) {
    s.sw = 1 - s.sw;
    ev.push({ e: 'toggle', x: x, y: y, on: s.sw });
  }

  // A jet of water from (x, y) along d. It pushes the first loose thing it meets one tile, or waters the first plant.
  // Mirrors turn it and portals carry it. Walls, vines, gates, printers, sprinklers, and the boss stop it.
  function spray(s, x, y, d, id, ev, depth) {
    var path = [[x, y]], split = false;
    for (var n = 0; n < 100; n++) {
      var nx = x + DX[d], ny = y + DY[d], t = tile(s, nx, ny);
      if (t === '&') { grow(s, nx, ny, d, ev); break; }
      if (t === '*') { x = nx; y = ny; split = true; break; }
      if (t === 'O') { path.push([x, y]); d = (d + 2) % 4; continue; }
      if (opaque(s, nx, ny) || PRINTER[t] || t === '!') break;
      var a = ahead(s, x, y, d);
      if (a[0] !== nx || a[1] !== ny) { path.push([nx, ny], null, a); nx = a[0]; ny = a[1]; t = tile(s, nx, ny); }
      x = nx; y = ny;
      if (isPil(s, x, y)) { shove(s, null, d, ev); break; }
      var q = objAt(s, x, y);
      if (q) {
        if (q.k === 'mirror') { d = REFLECT[q.o][d]; path.push([x, y]); continue; }
        if (q.k !== 'boss' && q.k !== 'sprinkler') shove(s, q, d, ev);
        break;
      }
      var i = y * s.w + x;
      if (s.bits[i]) { shoveBits(s, x, y, d, ev); break; }
      if (t === ',') { s.tiles[i] = '&'; ev.push({ e: 'sprout', x: x, y: y }); break; }
    }
    path.push([x, y]);
    ev.push({ e: 'spray', id: id, path: path, d: d });
    if (split && (depth || 0) < 6) { spray(s, x, y, (d + 3) % 4, id, ev, (depth || 0) + 1); spray(s, x, y, (d + 1) % 4, id, ev, (depth || 0) + 1); }
  }
  // The jet's push moves Pilcrow or an object one tile along d. Grease, portals, and the void act as for any push.
  function shove(s, o, d, ev) {
    if (o) { if (push(s, o, d, ev)) ev.push({ e: 'shove', id: o.id }); return; }
    var a = ahead(s, s.px, s.py, d), nx = a[0], ny = a[1], t = tile(s, nx, ny), x0 = s.px, y0 = s.py;
    if (t === '_' || t === 'X') { s.px = nx; s.py = ny; s.hp = 0; ev.push({ e: 'drop-off', x: nx, y: ny }); return; }
    if (!walkable(s, nx, ny) || objAt(s, nx, ny)) return;
    movePlayer(s, nx, ny, ev);
    ev.push({ e: 'shove', id: 0 });
    portalEv(x0, y0, d, nx, ny, 0, ev);
    if (!s.won) slide(s, null, d, ev);
  }
  function shoveBits(s, x, y, d, ev) {
    var i = y * s.w + x, a = ahead(s, x, y, d), nx = a[0], ny = a[1], t = tile(s, nx, ny), ni = ny * s.w + nx;
    if (t === '_' || t === 'X') { delete s.bits[i]; ev.push({ e: 'fall', k: 'bits', x: nx, y: ny }); return; }
    if (!walkable(s, nx, ny) || objAt(s, nx, ny) || isPil(s, nx, ny) || s.bits[ni]) return;
    s.bits[ni] = s.bits[i];
    delete s.bits[i];
    ev.push({ e: 'carry', x: x, y: y, x1: nx, y1: ny });
  }
  // A watered vine grows one tile at its far end along the jet, into empty floor or a seed.
  function grow(s, x, y, d, ev) {
    while (tile(s, x + DX[d], y + DY[d]) === '&') { x += DX[d]; y += DY[d]; }
    var nx = x + DX[d], ny = y + DY[d], t = tile(s, nx, ny), i = ny * s.w + nx;
    if ((t === '.' || t === ',') && !objAt(s, nx, ny) && !isPil(s, nx, ny) && !s.bits[i]) { s.tiles[i] = '&'; ev.push({ e: 'grow', x: nx, y: ny }); }
  }

  // A wind-up toy walks a tile along its facing every turn, and turns right when the way is blocked. It walks off edges.
  function toyAct(s, o, ev) {
    var a = ahead(s, o.x, o.y, o.d), nx = a[0], ny = a[1], t = tile(s, nx, ny);
    if (t === '_' || t === 'X') { sink(s, o, nx, ny, ev); return; }
    if (!walkable(s, nx, ny) || objAt(s, nx, ny) || isPil(s, nx, ny)) { o.d = (o.d + 1) % 4; ev.push({ e: 'toyturn', id: o.id }); return; }
    portalEv(o.x, o.y, o.d, nx, ny, o.id, ev);
    o.x = nx; o.y = ny;
    ev.push({ e: 'march', id: o.id });
    slide(s, o, o.d, ev);
  }

  function ramAct(s, o, ev) {
    if (o.d < 0) {
      var tg = nearestTarget(s, o.x, o.y);
      if (!tg) return;
      o.d = tg.d;
      ev.push({ e: 'spot', id: o.id });
    }
    var a = ahead(s, o.x, o.y, o.d), nx = a[0], ny = a[1];
    if (isPil(s, nx, ny)) { s.hp -= 3; o.d = -1; ev.push({ e: 'crush', id: o.id, x: nx, y: ny }); return; }
    var q = objAt(s, nx, ny), t = tile(s, nx, ny);
    if (q) {
      if (q.k === 'husk') { if (!hurtHusk(s, q, 3, o.d, ev, o.id) || !q.dead) o.d = -1; return; }
      if (q.k === 'boss') { hurtBoss(s, q, 3, ev, o.d); o.d = -1; return; }
      if (q.k === 'decoy' || q.k === 'echo') { kill(s, q, ev); return; }
      o.d = -1; ev.push({ e: 'bump', id: o.id });
      return;
    }
    if (t === '%' || t === '&') { s.tiles[ny * s.w + nx] = '.'; ev.push({ e: 'smash', x: nx, y: ny, k: t }); return; }
    if (t === 'g') { s.tiles[ny * s.w + nx] = '.'; o.d = -1; ev.push({ e: 'shatter', x: nx, y: ny }); return; }
    if (t === '_' || t === 'X') { sink(s, o, nx, ny, ev); return; }
    if (t === 'O') { o.d = (o.d + 2) % 4; ev.push({ e: 'boing', x: nx, y: ny, id: o.id }); return; }
    if (!walkable(s, nx, ny)) { o.d = -1; ev.push({ e: 'bump', id: o.id }); return; }
    portalEv(o.x, o.y, o.d, nx, ny, o.id, ev);
    o.x = nx; o.y = ny;
    ev.push({ e: 'roll', id: o.id });
    if (tile(s, nx, ny) === 'A') slide(s, o, o.d, ev);
  }

  function explode(s, o, ev) {
    o.dead = true;
    ev.push({ e: 'boom', id: o.id, x: o.x, y: o.y });
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var x = o.x + dx, y = o.y + dy;
      if (!inb(s, x, y)) continue;
      var i = y * s.w + x;
      if (s.tiles[i] === '%' || s.tiles[i] === '&') { ev.push({ e: 'smash', x: x, y: y, k: s.tiles[i] }); s.tiles[i] = '.'; }
      if (s.tiles[i] === 'g') { s.tiles[i] = '.'; ev.push({ e: 'shatter', x: x, y: y }); }
      delete s.bits[i];
      s.objs.forEach(function (q) {
        if (q.dead || q === o || q.k === 'boss' || q.x !== x || q.y !== y) return;
        if (q.k === 'packet') { q.dead = true; return; }
        if (q.k === 'husk') { q.hp -= 3; ev.push({ e: 'hit', id: q.id, x: x, y: y }); if (q.hp <= 0) kill(s, q, ev); }
        else kill(s, q, ev);
      });
      if (isPil(s, x, y)) { s.hp -= 3; ev.push({ e: 'burn', x: x, y: y }); }
    }
    s.objs.forEach(function (b) {
      if (!b.dead && b.k === 'boss' && b.x <= o.x + 1 && b.x + 1 >= o.x - 1 && b.y <= o.y + 1 && b.y + 1 >= o.y - 1) hurtBoss(s, b, 3, ev);
    });
  }

  // Bosses: 2 by 2 husks that carry out last turn's telegraphed action, then telegraph the next.
  // The type sets the sprite and the rules: the Manager slams, the Foreman stacks crates, the Warden guards a side and fires a beam,
  // the Forklift drives and can fall off an edge, the Fry Cook greases and charges, the High Score relinks portals and warps,
  // the Gardener sows seeds and sprays its two front lanes, the Mainframe fires packets and reboots the switch doors,
  // the Valet parks Bricks beside Pilcrow and switches every magnet, and the Usher's flashlight pauses everything in its
  // two front lanes while it cracks the floor, and the Jack winds up toys and springs off bumpers.
  // Any boss can use any action the cycle names.
  function makeBoss(s, cfg, x, y) {
    return {
      id: s.nid++, k: 'boss', type: cfg.type || 'manager', x: x, y: y, hp: cfg.hp || 9, maxHp: cfg.hp || 9, i: 0, tel: '', p2: 0, di: 0,
      f: cfg.face === undefined ? 2 : cfg.face,
      cyc: cfg.cycle || ['step', 'slam', 'wait'], cyc2: cfg.cycle2 || null, door: cfg.door || null,
      hireHp: cfg.hireHp || 1, hirePace: cfg.hirePace === undefined ? 1 : cfg.hirePace, hireAi: cfg.hireAi || 'pace',
      drops: cfg.drops || [], dropBits: cfg.bits || 'ry', form: cfg.form || '',
      shield: cfg.shield || cfg.type === 'warden' ? 1 : 0, light: cfg.light || cfg.type === 'usher' ? 1 : 0,
    };
  }
  // The direction from the boss's center toward the nearest target, Pilcrow or a Decoy, along the larger offset.
  function towardTarget(s, b) {
    var cx = b.x + 0.5, cy = b.y + 0.5, best = { x: s.px, y: s.py, d: Math.abs(s.px - cx) + Math.abs(s.py - cy) };
    s.objs.forEach(function (q) {
      if (q.dead || q.k !== 'decoy') return;
      var dist = Math.abs(q.x - cx) + Math.abs(q.y - cy);
      if (dist <= best.d) best = { x: q.x, y: q.y, d: dist };
    });
    var dx = best.x - cx, dy = best.y - cy;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  }
  // The free floor tile next to Pilcrow on the side facing the boss, where the Foreman drops a crate.
  function stackSpot(s, b) {
    var cx = b.x + 0.5, cy = b.y + 0.5, dx = cx - s.px, dy = cy - s.py;
    var dirs = Math.abs(dx) >= Math.abs(dy) ? [dx > 0 ? 1 : 3, dy > 0 ? 2 : 0] : [dy > 0 ? 2 : 0, dx > 0 ? 1 : 3];
    for (var i = 0; i < dirs.length; i++) {
      var x = s.px + DX[dirs[i]], y = s.py + DY[dirs[i]];
      if (tile(s, x, y) === '.' && !objAt(s, x, y) && !s.bits[y * s.w + x]) return x + ',' + y;
    }
    return null;
  }
  function telegraph(s, b) {
    var cyc = b.p2 && b.cyc2 ? b.cyc2 : b.cyc, act = cyc[b.i % cyc.length];
    b.i++;
    if (act === 'slam' || act === 'step' || act === 'drive' || act === 'turn' || act === 'grease' || act === 'charge' || act === 'sow' || act === 'spray' || act === 'fire' || act === 'crack' || act === 'spring' || act === 'wind') b.tel = act + ':' + towardTarget(s, b);
    else if (act === 'beam') b.tel = 'beam:' + b.f;
    else if (act === 'stack') { var spot = stackSpot(s, b); b.tel = spot ? 'stack:' + spot : 'wait'; }
    else if (act === 'warp') b.tel = 'warp:' + (s.w - 2 - b.x) + ',' + (s.h - 2 - b.y);
    else if (act === 'park') { var pk = stackSpot(s, b); b.tel = pk ? 'park:' + pk : 'wait'; }
    else b.tel = act;
  }
  // The two rows or columns a slam or beam sweeps, from the boss's side out to the first wall.
  function slamBand(s, b, d, max) {
    var out = [];
    for (var lane = 0; lane < 2; lane++) {
      var len = 0;
      var x = d === 1 ? b.x + 2 : d === 3 ? b.x - 1 : b.x + lane, y = d === 2 ? b.y + 2 : d === 0 ? b.y - 1 : b.y + lane;
      while (inb(s, x, y)) {
        var t = tile(s, x, y);
        if (t === '#' || t === '=' || (DOOR[t] !== undefined && !doorOpen(s, t))) break;
        out.push([x, y]);
        if (t === '%' || t === '&' || (max && ++len >= max)) break;
        x += DX[d]; y += DY[d];
      }
    }
    return out;
  }
  function sweep(s, b, band, ev) {
    band.forEach(function (p) {
      var x = p[0], y = p[1], i = y * s.w + x;
      if (s.tiles[i] === '%' || s.tiles[i] === 'g' || s.tiles[i] === '&') s.tiles[i] = '.';
      delete s.bits[i];
      if (isPil(s, x, y)) { s.hp -= 3; ev.push({ e: 'burn', x: x, y: y }); }
      s.objs.forEach(function (q) {
        if (q.dead || q === b || q.x !== x || q.y !== y) return;
        if (q.k === 'husk') { q.hp -= 3; if (q.hp <= 0) kill(s, q, ev); } else if (q.k === 'packet') q.dead = true; else kill(s, q, ev);
      });
    });
  }
  // The two cells the boss would move into along d.
  function frontCells(b, d) {
    var ax = d === 1 ? b.x + 2 : d === 3 ? b.x - 1 : b.x, ay = d === 2 ? b.y + 2 : d === 0 ? b.y - 1 : b.y;
    return d === 1 || d === 3 ? [[ax, ay], [ax, ay + 1]] : [[ax, ay], [ax + 1, ay]];
  }
  // One step of a boss along d: crushes Pilcrow, falls into the void, or moves if both cells are clear.
  function bossMove(s, b, d, ev) {
    var cells = frontCells(b, d);
    if (cells.some(function (c) { return isPil(s, c[0], c[1]); })) { s.hp -= 3; ev.push({ e: 'crush', id: b.id, x: s.px, y: s.py }); return 'crush'; }
    if (cells.some(function (c) { var t = tile(s, c[0], c[1]); return t === '_' || t === 'X'; })) {
      b.dead = true;
      s.goal = b.y * s.w + b.x;
      ev.push({ e: 'bossfall', id: b.id, x: b.x, y: b.y, d: d });
      return 'fall';
    }
    if (!cells.every(function (c) { return walkable(s, c[0], c[1]) && !objAt(s, c[0], c[1]); })) return 'blocked';
    b.x += DX[d]; b.y += DY[d];
    return 'moved';
  }
  // A boss with any of its four cells on grease keeps sliding the way it moved.
  function bossSlide(s, b, d, ev) {
    for (var n = 0; n < 20 && !b.dead; n++) {
      var on = [[b.x, b.y], [b.x + 1, b.y], [b.x, b.y + 1], [b.x + 1, b.y + 1]].some(function (c) { return tile(s, c[0], c[1]) === 'i'; });
      if (!on || bossMove(s, b, d, ev) !== 'moved') return;
      ev.push({ e: 'slide', id: b.id });
    }
  }
  function bossAct(s, b, ev) {
    var parts = b.tel.split(':'), act = parts[0], d = +parts[1];
    if (act === 'slam' || act === 'beam') {
      var band = slamBand(s, b, d);
      ev.push({ e: act, id: b.id, tiles: band, d: d });
      sweep(s, b, band, ev);
    } else if (act === 'grease') {
      var spill = slamBand(s, b, d, 4).filter(function (p) { return tile(s, p[0], p[1]) === '.'; });
      spill.forEach(function (p) { s.tiles[p[1] * s.w + p[0]] = 'i'; });
      ev.push({ e: 'grease', id: b.id, tiles: spill, d: d });
    } else if (act === 'charge') {
      b.f = d;
      for (var c = 0; c < 20 && !b.dead; c++) { if (bossMove(s, b, d, ev) !== 'moved') break; ev.push({ e: 'bossdrive', id: b.id }); }
      if (b.dead) return;
    } else if (act === 'step') {
      if (bossMove(s, b, d, ev) === 'moved') { ev.push({ e: 'bossstep', id: b.id }); bossSlide(s, b, d, ev); }
      if (b.dead) return;
    } else if (act === 'drive') {
      b.f = d;
      for (var k = 0; k < 3 && !b.dead; k++) {
        var r = bossMove(s, b, d, ev);
        if (r !== 'moved') break;
        ev.push({ e: 'bossdrive', id: b.id });
      }
      if (!b.dead) bossSlide(s, b, d, ev);
      if (b.dead) return;
    } else if (act === 'turn') {
      if (b.f !== d) { b.f = d; ev.push({ e: 'bossturn', id: b.id }); }
    } else if (act === 'stack') {
      var xy = parts[1].split(','), sx = +xy[0], sy = +xy[1];
      if (tile(s, sx, sy) === '.' && !objAt(s, sx, sy) && !isPil(s, sx, sy)) {
        s.tiles[sy * s.w + sx] = '%';
        delete s.bits[sy * s.w + sx];
        ev.push({ e: 'stack', id: b.id, x: sx, y: sy });
      }
    } else if (act === 'spring') {
      // The Jack springs at its target until something stops it. A bumper in front of it throws it back the other way.
      b.f = d;
      for (var sg = 0, bounces = 0; sg < 20 && !b.dead; sg++) {
        var mv = bossMove(s, b, d, ev);
        if (mv === 'moved') { ev.push({ e: 'bossdrive', id: b.id }); continue; }
        if (mv === 'blocked' && bounces < 2 && frontCells(b, d).some(function (c) { return tile(s, c[0], c[1]) === 'O'; })) { d = (d + 2) % 4; b.f = d; bounces++; ev.push({ e: 'boing', x: b.x, y: b.y, id: b.id }); continue; }
        break;
      }
      if (b.dead) return;
    } else if (act === 'wind' && b.door) {
      var wx2 = b.door.x, wy2 = b.door.y;
      if (walkable(s, wx2, wy2) && !objAt(s, wx2, wy2) && !isPil(s, wx2, wy2)) {
        var toy = make(s, 'toy', wx2, wy2, d);
        s.objs.push(toy);
        ev.push({ e: 'wind', id: b.id, toy: toy.id, x: wx2, y: wy2 });
      }
    } else if (act === 'crack') {
      var cracked = slamBand(s, b, d, 4).filter(function (p) { return tile(s, p[0], p[1]) === '.'; });
      cracked.forEach(function (p) { s.tiles[p[1] * s.w + p[0]] = ';'; });
      ev.push({ e: 'crack', id: b.id, tiles: cracked, d: d });
    } else if (act === 'sow') {
      var sown = slamBand(s, b, d, 4).filter(function (p) { return tile(s, p[0], p[1]) === '.' && !objAt(s, p[0], p[1]) && !isPil(s, p[0], p[1]) && !s.bits[p[1] * s.w + p[0]]; });
      sown.forEach(function (p) { s.tiles[p[1] * s.w + p[0]] = ','; });
      ev.push({ e: 'sow', id: b.id, tiles: sown, d: d });
    } else if (act === 'spray') {
      b.f = d;
      frontCells(b, d).forEach(function (c) { if (!b.dead && !s.won) spray(s, c[0] - DX[d], c[1] - DY[d], d, b.id, ev); });
    } else if (act === 'fire') {
      // The Mainframe fires a packet out of each of its two front cells.
      b.f = d;
      frontCells(b, d).forEach(function (c) {
        var pk = make(s, 'packet', c[0] - DX[d], c[1] - DY[d], d);
        if (flyPacket(s, pk, c[0], c[1], ev)) s.objs.push(pk);
      });
      ev.push({ e: 'bossfire', id: b.id, d: d });
    } else if (act === 'park') {
      // The Valet parks a Brick on the free tile beside Pilcrow that faces it.
      var pp = parts[1].split(','), px = +pp[0], py = +pp[1];
      if (walkable(s, px, py) && tile(s, px, py) !== 'A' && !objAt(s, px, py) && !isPil(s, px, py)) {
        var car = make(s, 'brick', px, py, 1);
        s.objs.push(car);
        ev.push({ e: 'park', id: b.id, car: car.id, x: px, y: py });
      }
    } else if (act === 'magnets') {
      s.objs.forEach(function (q) { if (!q.dead && q.k === 'magnet') q.on = q.on ? 0 : 1; });
      ev.push({ e: 'magnets', id: b.id });
    } else if (act === 'reboot') {
      toggle(s, b.x, b.y, ev);
      ev.push({ e: 'reboot', id: b.id });
    } else if (act === 'relink') {
      s.link = 1 - s.link;
      ev.push({ e: 'relink', id: b.id });
    } else if (act === 'warp') {
      // The High Score jumps to the spot mirrored through the room's center. Pilcrow there is crushed, and anything else there stops it.
      var wp = parts[1].split(','), wx = +wp[0], wy = +wp[1], foot = [[wx, wy], [wx + 1, wy], [wx, wy + 1], [wx + 1, wy + 1]];
      if (foot.some(function (c) { return isPil(s, c[0], c[1]); })) { s.hp -= 3; ev.push({ e: 'crush', id: b.id, x: s.px, y: s.py }); }
      else if (foot.every(function (c) { var q = objAt(s, c[0], c[1]); return walkable(s, c[0], c[1]) && (!q || q === b); })) {
        ev.push({ e: 'bosswarp', id: b.id, x0: b.x, y0: b.y, x1: wx, y1: wy });
        b.x = wx; b.y = wy;
      }
    } else if (act === 'flip') {
      var flip = { '^': 'v', 'v': '^', '<': '>', '>': '<' };
      for (var i = 0; i < s.tiles.length; i++) if (flip[s.tiles[i]]) s.tiles[i] = flip[s.tiles[i]];
      ev.push({ e: 'flip', id: b.id });
    } else if (act === 'hire' && b.door) {
      var hx = b.door.x, hy = b.door.y;
      if (walkable(s, hx, hy) && !objAt(s, hx, hy) && !isPil(s, hx, hy)) {
        var hk = { id: s.nid++, k: 'husk', ai: b.hireAi, x: hx, y: hy, hp: b.hireHp, maxHp: b.hireHp, pd: b.hireAi === 'pace' ? b.hirePace : -1 };
        s.objs.push(hk);
        ev.push({ e: 'hire', id: hk.id, x: hx, y: hy });
      }
    }
    telegraph(s, b);
  }
  // Each hit knocks a bit loose onto the next drop tile. At 0 HP the chip lies where the boss stood.
  // A Warden's front turns any hit that travels toward its face.
  function hurtBoss(s, b, dmg, ev, dir) {
    if (b.dead) return;
    if (b.shield && dir !== undefined && b.f === (dir + 2) % 4) { ev.push({ e: 'clank', id: b.id, x: b.x, y: b.y }); return; }
    b.hp -= dmg;
    ev.push({ e: 'bosshit', id: b.id, x: b.x, y: b.y, dmg: dmg });
    if (b.drops.length) {
      var p = b.drops[b.di % b.drops.length], i = p.y * s.w + p.x, c = b.dropBits[b.di % b.dropBits.length];
      b.di++;
      if (walkable(s, p.x, p.y) && (s.bits[i] || '').length < STACK_MAX) { s.bits[i] = (s.bits[i] || '') + c; ev.push({ e: 'print', x: p.x, y: p.y, c: c }); }
    }
    if (b.hp <= 0) {
      b.dead = true;
      s.goal = b.y * s.w + b.x;
      ev.push({ e: 'bossdie', id: b.id, x: b.x, y: b.y });
      return;
    }
    if (!b.p2 && b.cyc2 && b.hp * 2 <= b.maxHp) { b.p2 = 1; b.i = 0; ev.push({ e: 'phase', id: b.id }); }
  }

  // In a keycap room, each row that reads bit, bit, '=', daemon (or bit, '=', daemon) is a recipe, and there are no others.
  function boardRecipes(s) {
    if (!s.board) return;
    var keys = {};
    s.objs.forEach(function (o) { if (!o.dead && o.k === 'key') keys[o.y * s.w + o.x] = o.v; });
    var rec = {};
    for (var i = 0; i < s.tiles.length; i++) {
      if (s.tiles[i] !== '=') continue;
      var x = i % s.w, y = Math.floor(i / s.w), right = x + 1 < s.w ? keys[i + 1] : null, l1 = x > 0 ? keys[i - 1] : null, l2 = x > 1 ? keys[i - 2] : null;
      if (!right || !DAEMONS[right] || !l1 || DAEMONS[l1]) continue;
      rec[right] = (l2 && !DAEMONS[l2] ? l2 : '') + l1;
    }
    s.recipes = rec;
  }

  function huskAct(s, o, ev) {
    if (o.ai === 'pace' || o.ai === 'hoard') {
      var a = ahead(s, o.x, o.y, o.pd), nx = a[0], ny = a[1];
      if (walkable(s, nx, ny) && !objAt(s, nx, ny) && !isPil(s, nx, ny)) { portalEv(o.x, o.y, o.pd, nx, ny, o.id, ev); o.x = nx; o.y = ny; slide(s, o, o.pd, ev); }
      else o.pd = (o.pd + 2) % 4;
      if (o.dead) return;
      if (o.ai === 'hoard') {
        var i = o.y * s.w + o.x, st = s.bits[i];
        if (st && o.belly.length < STACK_MAX) {
          var n = Math.min(STACK_MAX - o.belly.length, st.length);
          o.belly += st.slice(0, n);
          if (st.length > n) s.bits[i] = st.slice(n); else delete s.bits[i];
          ev.push({ e: 'eat', id: o.id, x: o.x, y: o.y });
        }
      }
    } else if (o.ai === 'hunt') {
      var tg = nearestTarget(s, o.x, o.y);
      if (tg && tg.dist > 1) {
        var ah = ahead(s, o.x, o.y, tg.d), hx = ah[0], hy = ah[1];
        if (walkable(s, hx, hy) && !objAt(s, hx, hy) && !isPil(s, hx, hy)) { portalEv(o.x, o.y, tg.d, hx, hy, o.id, ev); o.x = hx; o.y = hy; ev.push({ e: 'hunt', id: o.id }); slide(s, o, tg.d, ev); }
      }
    } else if (o.ai === 'clerk') {
      var tc = nearestTarget(s, o.x, o.y);
      if (tc && tc.d !== o.f) { o.f = tc.d; ev.push({ e: 'turn', id: o.id }); }
    }
  }

  function bite(s, o, ev) {
    if (Math.abs(o.x - s.px) + Math.abs(o.y - s.py) === 1) { s.hp -= 1; ev.push({ e: 'bite', id: o.id, x: s.px, y: s.py }); }
    s.objs.forEach(function (q) {
      if (q.dead || q.k !== 'decoy') return;
      if (Math.abs(o.x - q.x) + Math.abs(o.y - q.y) === 1) kill(s, q, ev);
    });
  }

  // Conveyors carry everything on them one tile. Things move once each, the ones in front first.
  function convey(s, ev) {
    var movers = [];
    if (CONV[tile(s, s.px, s.py)] !== undefined) movers.push({ pil: 1, x: s.px, y: s.py });
    s.objs.forEach(function (o) { if (!o.dead && o.k !== 'packet' && o.k !== 'boss' && CONV[tile(s, o.x, o.y)] !== undefined) movers.push({ o: o, x: o.x, y: o.y }); });
    Object.keys(s.bits).forEach(function (k) { var x = k % s.w, y = Math.floor(k / s.w); if (CONV[s.tiles[k]] !== undefined) movers.push({ bits: +k, x: x, y: y }); });
    if (!movers.length) return;
    var progress = true;
    while (progress) {
      progress = false;
      movers.forEach(function (m) {
        if (m.done) return;
        var d = CONV[tile(s, m.x, m.y)], a = ahead(s, m.x, m.y, d), nx = a[0], ny = a[1], t = tile(s, nx, ny);
        if (m.bits !== undefined) {
          if (t === '_' || t === 'X') { delete s.bits[m.bits]; ev.push({ e: 'fall', k: 'bits', x: nx, y: ny }); m.done = 1; progress = true; return; }
          var ni = ny * s.w + nx;
          if (!walkable(s, nx, ny) || s.bits[ni] || isPil(s, nx, ny)) return;
          s.bits[ni] = s.bits[m.bits]; delete s.bits[m.bits];
          ev.push({ e: 'carry', x: m.x, y: m.y, x1: nx, y1: ny });
          m.done = 1; progress = true;
          return;
        }
        if (t === '_' || t === 'X') {
          m.done = 1; progress = true;
          if (m.pil) { s.px = nx; s.py = ny; s.hp = 0; ev.push({ e: 'drop-off', x: nx, y: ny }); }
          else sink(s, m.o, nx, ny, ev);
          return;
        }
        if (!walkable(s, nx, ny) || objAt(s, nx, ny) || isPil(s, nx, ny)) return;
        m.done = 1; progress = true;
        portalEv(m.x, m.y, d, nx, ny, m.pil ? 0 : m.o.id, ev);
        if (m.pil) movePlayer(s, nx, ny, ev);
        else { m.o.x = nx; m.o.y = ny; }
        ev.push({ e: 'carry', id: m.pil ? 0 : m.o.id });
        if (tile(s, nx, ny) === 'A' && !s.won) slide(s, m.pil ? null : m.o, d, ev);
      });
    }
  }

  // A door is open while any plate of its color holds something heavy, or while something stands in it.
  function updateDoors(s) {
    var pressed = [false, false];
    function heavy(x, y) { return isPil(s, x, y) || !!objAt(s, x, y); }
    for (var i = 0; i < s.tiles.length; i++) {
      var t = s.tiles[i], x = i % s.w, y = Math.floor(i / s.w);
      if (PLATE[t] !== undefined && heavy(x, y)) pressed[PLATE[t]] = true;
      if (DOOR[t] !== undefined && heavy(x, y)) pressed[DOOR[t]] = true;
    }
    s.open = pressed;
  }

  // Every projector's beam runs along its facing until something opaque stops it. Mirrors turn it, splitters split it,
  // and portals carry it. Returns the lit tile indices. Whatever stands in the light is paused for the turn.
  function lightUp(s) {
    var lit = {};
    function beam(x, y, d, depth) {
      for (var n = 0; n < 100; n++) {
        var nx = x + DX[d], ny = y + DY[d], t = tile(s, nx, ny);
        if (opaque(s, nx, ny) || PRINTER[t] || t === '!') return;
        if (t === '*') { lit[ny * s.w + nx] = 1; if (depth < 4) { beam(nx, ny, (d + 3) % 4, depth + 1); beam(nx, ny, (d + 1) % 4, depth + 1); } return; }
        if (t === 'O') { d = (d + 2) % 4; continue; }
        var a = ahead(s, x, y, d);
        x = a[0]; y = a[1];
        if (lit[y * s.w + x + 1e6 * (d + 1)]) return;
        lit[y * s.w + x + 1e6 * (d + 1)] = 1;
        lit[y * s.w + x] = 1;
        var q = objAt(s, x, y);
        if (q && q.k === 'mirror') d = REFLECT[q.o][d];
      }
    }
    s.objs.forEach(function (o) {
      if (!o.dead && o.k === 'projector') beam(o.x, o.y, o.d, 0);
      if (!o.dead && o.k === 'boss' && o.light) slamBand(s, o, o.f).forEach(function (c) { lit[c[1] * s.w + c[0]] = 1; });
    });
    return lit;
  }
  // The cracked floor tiles that something heavy stands on at the start of the turn.
  function standing(s) {
    var out = [];
    for (var i = 0; i < s.tiles.length; i++) {
      if (s.tiles[i] !== ';') continue;
      var x = i % s.w, y = Math.floor(i / s.w);
      if (isPil(s, x, y) || objAt(s, x, y)) out.push(i);
    }
    return out;
  }
  // Cracked floor falls in once whatever stood on it has moved off. Bits on it fall too.
  function crumble(s, stood, ev) {
    stood.forEach(function (i) {
      var x = i % s.w, y = Math.floor(i / s.w);
      if (s.tiles[i] !== ';' || isPil(s, x, y) || objAt(s, x, y)) return;
      s.tiles[i] = '_';
      delete s.bits[i];
      ev.push({ e: 'crumble', x: x, y: y });
    });
  }

  // Actions: {t:'move', d}, {t:'zap', d}, {t:'drop', i or c}, {t:'wait'}. Returns {s, ev}, or null when nothing happens.
  function step(s0, act) {
    if (s0.won || s0.lost) return null;
    var s = clone(s0), ev = [], stood = standing(s);
    boardRecipes(s);
    if (act.t === 'move') {
      s.face = act.d;
      if (!stepInto(s, null, act.d, ev)) return null;
      if (!s.won) s.objs.forEach(function (o) { if (!o.dead && o.k === 'echo') stepInto(s, o, act.d, ev); });
    } else if (act.t === 'drop') {
      var i0 = s.py * s.w + s.px, st = s.bits[i0] || '', at = act.i !== undefined ? act.i : s.inv.indexOf(act.c);
      if (at < 0 || !s.inv[at] || st.length >= STACK_MAX) return null;
      var dc = s.inv[at];
      s.inv[at] = '';
      s.bits[i0] = st + dc;
      ev.push({ e: 'drop', x: s.px, y: s.py, slot: at, c: dc });
    } else if (act.t === 'zap') {
      s.face = act.d;
      zap(s, act.d, ev);
    } else if (act.t !== 'wait') return null;

    if (!s.won) {
      var lit = lightUp(s);
      var still = function (o) { return o.k === 'boss' ? [[o.x, o.y], [o.x + 1, o.y], [o.x, o.y + 1], [o.x + 1, o.y + 1]].some(function (c) { return lit[c[1] * s.w + c[0]]; }) : !!lit[o.y * s.w + o.x]; };
      convey(s, ev);
      s.objs.slice().forEach(function (sp) { if (!sp.dead && sp.k === 'sprinkler' && !s.won && !still(sp)) spray(s, sp.x, sp.y, sp.d, sp.id, ev); });
      s.objs.slice().forEach(function (mg) { if (!mg.dead && mg.k === 'magnet' && mg.on && !s.won && !still(mg)) pull(s, mg, ev); });
      var objs = s.objs.slice(), a;
      for (a = 0; a < objs.length; a++) {
        var ob = objs[a];
        if (ob.dead || still(ob)) continue;
        if (ob.k === 'ram') ramAct(s, ob, ev);
        else if (ob.k === 'fork') { ob.f -= 1; if (ob.f <= 0) explode(s, ob, ev); else ev.push({ e: 'tick', id: ob.id, f: ob.f }); }
        else if (ob.k === 'pinger') { ob.c -= 1; if (ob.c <= 0) { ob.c = PINGER_BEAT; fire(s, ob, ev); } }
        else if (ob.k === 'toy') toyAct(s, ob, ev);
      }
      s.objs.forEach(function (p) {
        if (p.dead || p.k !== 'packet') return;
        if (p.fresh) { delete p.fresh; return; }
        if (still(p)) return;
        if (!flyPacket(s, p, p.x + DX[p.d], p.y + DY[p.d], ev)) p.dead = true;
      });
      for (a = 0; a < s.objs.length; a++) { var hk = s.objs[a]; if (!hk.dead && hk.k === 'husk' && !still(hk)) huskAct(s, hk, ev); }
      for (a = 0; a < s.objs.length; a++) { var hb = s.objs[a]; if (!hb.dead && hb.k === 'husk' && !still(hb)) bite(s, hb, ev); }
      for (a = 0; a < s.objs.length; a++) { var bs = s.objs[a]; if (!bs.dead && bs.k === 'boss' && !still(bs)) bossAct(s, bs, ev); }
      crumble(s, stood, ev);
      Object.keys(s.bits).forEach(function (mi) {
        if (s.tiles[mi] !== 'w' || lit[mi]) return;
        s.bits[mi] = s.bits[mi].split('').map(function (c) { return COOK[c]; }).join('');
        ev.push({ e: 'cook', x: mi % s.w, y: Math.floor(mi / s.w) });
      });
      updateDoors(s);
      boardRecipes(s);
      if (s.hp <= 0) { s.hp = 0; s.lost = true; ev.push({ e: 'lose' }); }
    }
    s.objs = s.objs.filter(function (q) { return !q.dead; });
    s.objs.forEach(function (q) { delete q.fresh; });
    s.turn++;
    return { s: s, ev: ev };
  }

  var KEY_FIELDS = ['d', 'f', 'c', 'hp', 'pd', 'o', 'belly', 'v', 'i', 'tel', 'p2', 'di', 'on'];
  function key(s) {
    var bk = Object.keys(s.bits).sort(function (a, b) { return a - b; }).map(function (k) { return k + s.bits[k]; }).join(',');
    // A boss's counter only matters modulo its cycle, so folding it lets a fight's search close.
    var ok = s.objs.map(function (o) {
      var parts = [o.k, o.x, o.y], len = o.k === 'boss' ? (o.p2 && o.cyc2 ? o.cyc2 : o.cyc).length : 0;
      KEY_FIELDS.forEach(function (f) { parts.push(o[f] === undefined ? '' : f === 'i' && len ? o[f] % len : o[f]); });
      return parts.join(',');
    }).join(';');
    return s.px + ',' + s.py + ',' + s.hp + ',' + sortStr(s.inv.join('')) + '|' + s.tiles.join('') + '|' + bk + '|' + ok + '|' + (s.open[0] ? 1 : 0) + (s.open[1] ? 1 : 0) + s.link + s.sw;
  }

  function actions(s) {
    var out = [];
    for (var d = 0; d < 4; d++) { out.push({ t: 'move', d: d }); out.push({ t: 'zap', d: d }); }
    var seen = {};
    for (var i = 0; i < s.inv.length; i++) if (s.inv[i] && !seen[s.inv[i]]) { seen[s.inv[i]] = 1; out.push({ t: 'drop', c: s.inv[i] }); }
    out.push({ t: 'wait' });
    return out;
  }

  return {
    load: load, step: step, key: key, actions: actions, DX: DX, DY: DY, CONV: CONV, PRINTER: PRINTER, PLATE: PLATE, DOOR: DOOR,
    objAt: objAt, tile: tile, walkable: walkable, opaque: opaque, nearestTarget: nearestTarget, recipeFor: recipeFor, doorOpen: doorOpen,
    slamBand: slamBand, DAEMONS: DAEMONS, LINKS: LINKS, lightUp: lightUp,
  };
})();
