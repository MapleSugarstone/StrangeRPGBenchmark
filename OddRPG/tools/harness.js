// Browser playtest harness. Load it into the running game page, then drive the game through window.__h.
// Every action goes through the real keydown and click handlers.
window.__h = (() => {
  const log = [];
  const note = (s) => { log.push(s); if (log.length > 60) log.shift(); };
  const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  const press = (k, n = 1) => { for (let i = 0; i < n; i++) key(k); };
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.message));

  const blocked = (x, y) => {
    const t = map[y]?.[x];
    return !t || t.type === 'water' || t.type === 'lava';
  };

  function path(tx, ty) {
    const prev = new Map([[playerX + ',' + playerY, null]]);
    const queue = [[playerX, playerY]];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy, k] of [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']]) {
        const nx = x + dx, ny = y + dy, id = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || blocked(nx, ny) || prev.has(id)) continue;
        prev.set(id, [x + ',' + y, k]);
        queue.push([nx, ny]);
      }
    }
    const steps = [];
    let cur = tx + ',' + ty;
    if (!prev.has(cur)) return null;
    while (prev.get(cur)) { const [p, k] = prev.get(cur); steps.unshift(k); cur = p; }
    return steps;
  }

  // Picks a move like a careful player and enters it with keys.
  function playTurn() {
    const cs = combatState;
    const actor = actorById(cs.currentActor);
    const living = livingParty();
    const hurt = party.filter(m => m.hp < m.maxHp * 0.45).length;
    const heals = actor.abilities.map((a, i) => ({ a, i })).filter(o => o.a.type === 'heal' && !o.a.self && canAfford(actor, o.a));
    let choice = null;
    if (hurt && heals.length) choice = heals.sort((x, y) => (y.a.power || 99) - (x.a.power || 99))[0].i;
    if (choice === null) {
      const dmg = actor.abilities.map((a, i) => ({ a, i })).filter(o => o.a.power > 0 && o.a.type !== 'heal' && canAfford(actor, o.a));
      if (dmg.length) {
        const n = livingEnemies().length;
        choice = dmg.sort((x, y) => y.a.power * (y.a.area ? n : 1) - x.a.power * (x.a.area ? n : 1))[0].i;
      }
    }
    if (choice === null) { press('a'); press('Enter'); return 'attack'; }
    press('b');
    press('ArrowUp', 5);
    press('ArrowDown', choice);
    press('Enter');
    return actor.abilities[choice].name;
  }

  function fight() {
    instantCombat = true;
    let guard = 0;
    while (gameState === 'combat' && guard++ < 600) {
      const cs = combatState;
      if (cs.gameOver) {
        const won = cs.victory;
        note((cs.isBoss ? 'boss ' + cs.dungeon.boss : 'fight') + (won ? ' won' : ' LOST') + ' round ' + cs.turn);
        press('Enter');
        return won;
      }
      if (cs.busy) { nextTurn(); continue; }
      playTurn();
    }
    note('fight stuck in ' + gameState);
    return false;
  }

  // Plays through story, chapter cards, and act screens until the field is free.
  function advance() {
    let guard = 0;
    while (guard++ < 50) {
      if (gameState === 'title') press('x');
      else if (gameState === 'story') press(' ');
      else if (gameState === 'gameover' || gameState === 'act2intro') press('Enter');
      else if (gameState === 'combat') fight();
      else break;
    }
    return gameState;
  }

  function walkTo(tx, ty) {
    let guard = 0;
    while ((playerX !== tx || playerY !== ty) && guard++ < 400) {
      if (gameState === 'combat') { fight(); continue; }
      if (gameState !== 'explore') { advance(); if (gameState !== 'explore') return 'stopped in ' + gameState; continue; }
      const p = path(tx, ty);
      if (!p) return 'no path';
      press(p[0]);
    }
    if (gameState === 'combat') fight();
    return playerX + ',' + playerY;
  }

  function solvePuzzle(useMouse) {
    if (gameState !== 'puzzle') return 'not in puzzle';
    const r = canvas.getBoundingClientRect();
    const click = (x, y) => canvas.dispatchEvent(new MouseEvent('click', { clientX: r.left + x * r.width / W, clientY: r.top + y * r.height / H }));
    let guard = 0;
    while (!puzzleSolved() && guard++ < 400) {
      if (sporeWeaveState) {
        const sw = sporeWeaveState;
        let done = true;
        for (let y = 0; y < 4 && done; y++) for (let x = 0; x < 4 && done; x++) {
          if (sw.current[y][x] !== sw.target[y][x]) {
            done = false;
            if (useMouse) { const g = PUZZLE_LAYOUT.weaveGrid; click(g.ox + x * g.size + 15, g.oy + y * g.size + 15); }
            else { press('ArrowLeft', 4); press('ArrowUp', 4); press('ArrowRight', x); press('ArrowDown', y); press('Enter'); }
          }
        }
        continue;
      }
      const p = puzzleState;
      if (p.type === 'reality') {
        const i = p.anchors.findIndex((a, j) => a !== p.target[j]);
        if (useMouse) { const a = PUZZLE_LAYOUT.anchor(i); click(a.cx, a.cy); }
        else { press('ArrowLeft', 3); press('ArrowRight', i); press('Enter'); }
      } else if (p.type === 'spore') {
        const i = p.pattern.findIndex((v, j) => v !== p.current[j]);
        const x = i % 4, y = Math.floor(i / 4);
        if (useMouse) { const g = PUZZLE_LAYOUT.sporeGrid; click(g.ox + x * g.size + 15, g.oy + y * g.size + 15); }
        else { press('ArrowLeft', 4); press('ArrowUp', 4); press('ArrowRight', x); press('ArrowDown', y); press('Enter'); }
      } else if (p.type === 'phase') {
        const walls = new Set(p.walls);
        const prev = new Map([[p.playerX + ',' + p.playerY, null]]);
        const q = [[p.playerX, p.playerY]];
        while (q.length) {
          const [x, y] = q.shift();
          for (const [dx, dy, k] of [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']]) {
            const nx = x + dx, ny = y + dy, id = nx + ',' + ny;
            if (nx < 0 || ny < 0 || nx > 4 || ny > 4 || walls.has(id) || prev.has(id)) continue;
            prev.set(id, [x + ',' + y, k]);
            q.push([nx, ny]);
          }
        }
        let cur = '4,4';
        const steps = [];
        while (prev.get(cur)) { const [pp, k] = prev.get(cur); steps.unshift(k); cur = pp; }
        steps.forEach(k => press(k));
      }
    }
    return puzzleSolved() ? 'solved' : 'unsolved';
  }

  // Clears every open dungeon of the current chapter, then plays the next story.
  function clearChapter(useMouse) {
    const start = currentChapter;
    let guard = 0;
    while (currentChapter === start && guard++ < 10) {
      advance();
      if (gameState !== 'explore') break;
      const d = activeDungeons().find(dungeonOpen);
      if (!d) break;
      const where = walkTo(d.x, d.y);
      if (where !== d.x + ',' + d.y) { note('walk failed: ' + where); return summary(); }
      party.forEach(m => { if (m.hp < m.maxHp * 0.6) { const i = inventory.findIndex(it => it.type === 'potion'); if (i >= 0) useItem(i); } });
      for (let i = inventory.length - 1; i >= 0; i--) if (inventory[i].type === 'spore') useItem(i);
      press('Enter');
      if (gameState === 'puzzle') note(d.name + ' puzzle ' + solvePuzzle(useMouse) + ' ' + (press('Enter'), gameState));
      if (gameState === 'combat') fight();
    }
    return summary();
  }

  function summary() {
    return {
      state: gameState, chapter: currentChapter, act2: act2Started, pos: playerX + ',' + playerY,
      party: party.map(m => m.id + ' ' + m.hp + '/' + m.maxHp + ' atk' + m.attack),
      cleared: [...visitedDungeons].length, spore: sporeLevel, items: inventory.length,
      errors: errors.slice(-5), log: log.slice(-8),
    };
  }

  // The canvas reads back blank while the pane is hidden, so draw the frame in the same task.
  function view(name) {
    const draw = { title: drawTitle, story: drawStory, explore: drawExplore, combat: drawCombat, gameover: drawGameOver,
      act2intro: drawAct2Intro, act2ending: drawAct2Ending, puzzle: () => (sporeWeaveState ? drawSporeWeave() : drawPuzzle()) }[gameState];
    if (draw) draw();
    const url = canvas.toDataURL('image/png');
    return fetch('http://localhost:8751/?name=' + name + '.png', { method: 'POST', body: url }).then(r => r.text());
  }

  return { key, press, path, fight, advance, walkTo, solvePuzzle, clearChapter, summary, view, log, errors };
})();
