import type { Machine, Puzzle } from '../game/setting/core';
import type { Action, Battle, Fighter, Mon } from '../battle/model';
// Content validation. Runs in Node against the game's data without a browser.
declare const process: { argv: string[]; exitCode: number };
const g = globalThis as any;
// Minimal stand-ins so browser modules load in Node.
const fakeCtx = new Proxy({}, { get: () => () => {}, set: () => true });
g.document = { getElementById: () => ({ getContext: () => fakeCtx, style: {} }), createElement: () => ({ getContext: () => fakeCtx, width: 0, height: 0 }) };
g.window = { addEventListener: () => {}, innerWidth: 800, innerHeight: 800 };
g.localStorage = { getItem: () => null, setItem: () => {} };
g.performance = g.performance || { now: () => Date.now() };

const errors: string[] = [];
const warn: string[] = [];
const fail = (s: string) => errors.push(s);

async function main(): Promise<void> {
  await import('../data/species');
  await import('../content');
  const { MAPS, SCRIPTS } = await import('../game/world');
  const { SPECIES, WILD_KINDS } = await import('../data/species');
  const { MOVES, PASSIVES } = await import('../battle/registry');
  const { isSolid, LEDGE } = await import('../game/tiles');
  const { ROW_WARNINGS } = await import('../content/areakit');
  const { crossable, checkStory, checkPuzzles, puzzleReach, RING_MAPS } = await import('./worldcheck');
  const ALL = new Set(['prisingiron', 'stilts', 'jingle', 'haul', 'letter', 'STONE', 'TIDE', 'ROOT', 'GEAR', 'BEAST', 'STAR', 'SALT', 'VOID']);
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  // People who stand where nobody can reach on purpose: a puzzle moves them, or they are only looked at.
  const PUZZLE_PIECES = ['battlefield:soldier', 'battlefield:soldierbed', 'tuskgym:youngtallow'];
  const NEW_AREAS = ['undermeadow', 'knucklebones', 'wrecks', 'shoreline', 'underspire', 'rootfall', 'skinfall', 'iceshelf', 'battlefield', 'moonbed', 'glassdesert', 'handsorchard', 'margin',
    'outerwhorl', 'wrack', 'sanddollar', 'doves', 'flats', 'cowrieback', 'polish', 'underteeth', 'glazehalls', 'glosshall', 'augerdune', 'augermouth', 'augerroll',
    'augerstair', 'turnwisegym', 'augerpoint', 'lowline', 'livingchamber', 'oldchambers', 'tidechamber', 'siphuncle', 'springlow', 'longstrand', 'tray',
    'hollowtop', 'mudlarkyard', 'oldapex', 'conchlip', 'conchpink', 'conchturn', 'conchroar', 'conchmouth', ...RING_MAPS];

  // species and kits
  for (const sp of Object.values(SPECIES)) {
    for (const m of sp.moves) if (!MOVES[m]) fail(`${sp.id}: missing move ${m}`);
    for (const p of sp.passives) if (!PASSIVES[p]) fail(`${sp.id}: missing passive ${p}`);
    const bigs = sp.moves.filter(m => MOVES[m]?.nerve).length;
    if (bigs !== 1) fail(`${sp.id}: ${bigs} crests`);
  }
  const { wrap } = await import('../engine/font');
  const { moveText } = await import('../battle/engine');
  const owners = new Map<string, string>();
  for (const m of Object.values(MOVES)) {
    if (owners.has(m.name)) fail(`move name ${m.name} used by ${owners.get(m.name)} and ${m.owner}`);
    owners.set(m.name, m.owner);
    // The battle panel's detail column is 94 pixels wide with 5 rows under the move name, and turns pages every 3 seconds.
    const rows = wrap(moveText(m), 94).length;
    if (rows > 10) warn.push(`move text needs 3 pages in battle: ${m.id} (${rows} rows)`);
  }
  // Every move's picture spec reads with the words in Notes/battle-fx.md.
  const { checkFx } = await import('../game/fxspec');
  for (const m of Object.values(MOVES)) {
    const bad = m.fx ? checkFx(m.fx) : null;
    if (bad) fail(`${m.id}: fx "${m.fx}" has ${bad}`);
    for (const o of m.fxOpts || []) { const ob = checkFx(o); if (ob) fail(`${m.id}: fxOpts "${o}" has ${ob}`); }
  }
  await (await import('./soundcheck')).checkSounds(fail);
  if (WILD_KINDS.length < 48) fail(`expected at least 48 wild kinds, got ${WILD_KINDS.length}`);
  console.log(`wild kinds: ${WILD_KINDS.length}`);

  // maps
  for (const m of Object.values(MAPS)) {
    const H = m.rows.length, W = m.rows[0].length;
    for (const w of m.warps) {
      const t = MAPS[w.to];
      if (!t) { fail(`${m.id}: warp to missing map ${w.to}`); continue; }
      const md = (t.mods || []).find(md => md.y === w.ty && w.tx >= md.x && w.tx < md.x + (md.w || 1));
      const ch = md ? md.ch : t.rows[w.ty]?.[w.tx];
      if (ch === undefined) fail(`${m.id}: warp lands outside ${w.to} at ${w.tx},${w.ty}`);
      else if (isSolid(ch)) fail(`${m.id}: warp lands on solid '${ch}' in ${w.to} at ${w.tx},${w.ty}`);
      if (w.x < 0 || w.y < 0 || w.x >= W || w.y >= H) fail(`${m.id}: warp source out of bounds ${w.x},${w.y}`);
    }
    for (const n of m.npcs) {
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= H) fail(`${m.id}: npc ${n.id} out of bounds`);
      if (n.talk && !SCRIPTS[n.talk]) fail(`${m.id}: npc ${n.id} talks to missing script ${n.talk}`);
      const tr = n.trainer;
      if (tr && Array.isArray(tr.team)) for (const [k] of tr.team) if (!SPECIES[k]) fail(`${m.id}: trainer ${n.id} has missing kind ${k}`);
      if (n.mon && !SPECIES[n.mon]) fail(`${m.id}: npc ${n.id} shows missing kind ${n.mon}`);
      const ch = m.rows[n.y]?.[n.x];
      if (ch && isSolid(ch) && ch !== 'c' && !n.onSolid) warn.push(`${m.id}: npc ${n.id} stands on solid '${ch}'`);
      // A route walks only open ground and comes back to where it starts, so the walker never drifts or gets stuck in a wall.
      if (n.route) {
        let x = n.x, y = n.y;
        for (const c of n.route) {
          const k = 'drul'.indexOf(c);
          if (k < 0) continue;
          x += [0, 1, 0, -1][k]; y += [1, 0, -1, 0][k];
          const md = (m.mods || []).filter(o => o.when() && o.y === y && x >= o.x && x < o.x + (o.w || 1)).pop();
          const t = md ? md.ch : m.rows[y]?.[x];
          if (!t || isSolid(t)) { fail(`${m.id}: ${n.id}'s route runs into '${t ?? 'the edge'}' at ${x},${y}`); break; }
        }
        if (x !== n.x || y !== n.y) fail(`${m.id}: ${n.id}'s route ends at ${x},${y}, not where it starts`);
      }
    }
    if (m.enter && !SCRIPTS[m.enter]) fail(`${m.id}: enter script ${m.enter} missing`);
    for (const t of m.triggers || []) if (!SCRIPTS[t.script]) fail(`${m.id}: trigger script ${t.script} missing`);
    for (const s of Object.values(m.tileTalk || {})) if (!SCRIPTS[s]) fail(`${m.id}: tile script ${s} missing`);
    if (m.zone) for (const [k] of m.zone.kinds) if (!SPECIES[k]) fail(`${m.id}: zone kind ${k} missing`);
    if (m.zone && !m.rows.some(r => r.includes(','))) fail(`${m.id}: zone without brush tiles`);
  }

  // reachability: flood from every warp landing, with every mod applied, and check warps, people, and spots
  for (const m of Object.values(MAPS)) {
    const H = m.rows.length, W = m.rows[0].length;
    const grid = m.rows.map(r => r.split(''));
    for (const md of m.mods || []) for (let k = 0; k < (md.w || 1); k++) if (grid[md.y]?.[md.x + k] !== undefined) grid[md.y][md.x + k] = md.ch;
    const bs = m.basin;
    if (bs) for (let y = bs.y; y < bs.y + bs.h; y++) for (let x = bs.x; x < bs.x + bs.w; x++) if (grid[y][x] === 'O') grid[y][x] = '@';
    // Every key item and worn type opens its ground here, so a place counts as reachable once any of them reaches it. Ledges still go one way.
    const flood = (wear: boolean) => {
      const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !/[1-8]/.test(grid[y][x]) && (wear ? crossable(grid[y][x], ALL) : !isSolid(grid[y][x]));
      const seen = new Set<number>();
      const queue: [number, number][] = [];
      for (const src of Object.values(MAPS)) for (const w of src.warps) if (w.to === m.id && open(w.tx, w.ty)) queue.push([w.tx, w.ty]);
      // A walk puzzle's own solver proves its goal reachable, so the flood starts there too.
      for (const [x, y] of puzzleReach(m.id)) if (open(x, y)) queue.push([x, y]);
      // People block the way, and ice carries Vellum on until something stops the slide.
      const blocked = new Set(m.npcs.filter(n => !n.sleeper && !n.movable).map(n => n.y * W + n.x));
      const free = (x: number, y: number) => open(x, y) && !blocked.has(y * W + x);
      for (const p of queue) blocked.delete(p[1] * W + p[0]);
      while (queue.length) {
        const [x, y] = queue.pop()!;
        if (seen.has(y * W + x) || !free(x, y)) continue;
        seen.add(y * W + x);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy;
          const drop = LEDGE[grid[ny]?.[nx] ?? ''];
          if (drop !== undefined) {
            if (DIRS[drop][0] === dx && DIRS[drop][1] === dy && free(nx + dx, ny + dy)) queue.push([nx + dx, ny + dy]);
            continue;
          }
          if (!free(nx, ny)) continue;
          while (grid[ny][nx] === 'I' && free(nx + dx, ny + dy)) { nx += dx; ny += dy; }
          queue.push([nx, ny]);
        }
      }
      return seen;
    };
    const seen = flood(true);
    if (!seen.size) continue;
    const near = (x: number, y: number) => seen.has(y * W + x) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((y + dy) * W + x + dx));
    const fresh = NEW_AREAS.includes(m.id);
    const note = (s: string) => (fresh ? fail : (x: string) => warn.push(x))(s);
    for (const w of m.warps) if (!near(w.x, w.y)) note(`${m.id}: warp at ${w.x},${w.y} to ${w.to} is unreachable`);
    for (const n of m.npcs) if (!near(n.x, n.y) && !PUZZLE_PIECES.includes(m.id + ':' + n.id)) note(`${m.id}: npc ${n.id} at ${n.x},${n.y} is unreachable`);
    for (const s of m.spots || []) if (!near(s.x, s.y)) note(`${m.id}: spot at ${s.x},${s.y} is unreachable`);
    // Wild whorls appear on brush, so a closed-in patch of brush on a ring map holds whorls nobody can meet.
    if (RING_MAPS.includes(m.id)) {
      let shut = 0, at = '';
      const stood = new Set(m.npcs.map(n => n.y * W + n.x));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === ',' && !seen.has(y * W + x) && !stood.has(y * W + x)) { shut++; at ||= `${x},${y}`; }
      if (shut) fail(`${m.id}: ${shut} brush tiles cannot be reached, first at ${at}`);
    }
  }
  // No person stands in a gap whose blocking cuts the walkable ground in two, unless the person is meant to block the way.
  for (const m of Object.values(MAPS)) {
    const H = m.rows.length, W = m.rows[0].length;
    const grid = m.rows.map(r => r.split(''));
    for (const md of m.mods || []) for (let k = 0; k < (md.w || 1); k++) if (grid[md.y]?.[md.x + k] !== undefined) grid[md.y][md.x + k] = md.ch;
    const starts: [number, number][] = [];
    for (const src of Object.values(MAPS)) for (const w of src.warps) if (w.to === m.id) starts.push([w.tx, w.ty]);
    const walk = (block: number) => {
      const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && y * W + x !== block && !/[1-8]/.test(grid[y][x]) && !isSolid(grid[y][x]);
      const seen = new Set<number>();
      const queue = starts.filter(([x, y]) => open(x, y)).map(p => p.slice() as [number, number]);
      while (queue.length) {
        const [x, y] = queue.pop()!;
        if (seen.has(y * W + x)) continue;
        seen.add(y * W + x);
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = DIRS[d];
          let nx = x + dx, ny = y + dy;
          const drop = LEDGE[grid[ny]?.[nx] ?? ''];
          if (drop !== undefined) { if (drop === d && open(nx + dx, ny + dy)) queue.push([nx + dx, ny + dy]); continue; }
          if (!open(nx, ny)) continue;
          while (grid[ny][nx] === 'I' && open(nx + dx, ny + dy)) { nx += dx; ny += dy; }
          queue.push([nx, ny]);
        }
      }
      return seen;
    };
    const base = walk(-1);
    for (const n of m.npcs) {
      if (n.blocks || n.sleeper || n.movable || n.ghost || PUZZLE_PIECES.includes(m.id + ':' + n.id)) continue;
      const k = n.y * W + n.x;
      if (!base.has(k)) continue;
      const cut = walk(k);
      const lost = [...base].filter(t => t !== k && !cut.has(t));
      if (lost.length) fail(`${m.id}: ${n.id} at ${n.x},${n.y} cuts off ${lost.length} tile(s), such as ${lost[0] % W},${Math.floor(lost[0] / W)}. Move it, or mark it blocks: true if it is meant to.`);
    }
  }

  for (const r of ROW_WARNINGS) fail('map rows: ' + r);
  const storyPlaces = checkStory(fail);
  console.log(`puzzles: ${checkPuzzles(fail)} solved`);
  console.log(`story: ${storyPlaces} places checked in chapter order`);

  // every wild kind lives somewhere other than the catch-all postgame zone
  const zoned = new Set<string>();
  for (const m of Object.values(MAPS)) if (m.zone) for (const [k, w] of m.zone.kinds) if (m.zone.kinds.length < 40 || w >= 3) zoned.add(k);
  const homeless = WILD_KINDS.filter(k => !zoned.has(k));
  if (homeless.length) fail(`kinds with no zone: ${homeless.join(', ')}`);

  // text: lines spoken anywhere in content source
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve('src/content');
  const banned = [/\bwhisper/i, /\becho(es)?\b/i, /shimmer/i, /tapestry/i, /testament/i, /journey/i, /destiny/i, /ancient/i, /something shifted/i, /a part of me/i, /\bI guess\b/, /\bLook,/, /\bseemed\b/i, /\balmost\b/i, /after a moment/i, /—/, /–/];
  const contentFiles: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) contentFiles.push(p); } };
  walk(dir);
  for (const full of contentFiles) {
    const file = path.relative(dir, full);
    const src = fs.readFileSync(full, 'utf8');
    const strings = src.match(/'(?:[^'\\]|\\.)*'/g) || [];
    for (const raw of strings) {
      const s = raw.slice(1, -1).replace(/\\'/g, "'");
      if (s.includes('\n')) continue;
      if (s.length < 12 || !/[a-z] [a-z]/i.test(s)) continue;
      // The Guide's paragraphs wrap on the Register's pages, so only text boxes keep to 100 characters.
      if (s.length > 100 && file !== 'guide.ts') fail(`${file}: line over 100 chars: ${s.slice(0, 60)}...`);
      for (const b of banned) if (b.test(s)) fail(`${file}: banned word ${b} in: ${s.slice(0, 70)}`);
      if (/;/.test(s) && !/[{}()=]/.test(s)) fail(`${file}: semicolon in text: ${s.slice(0, 70)}`);
    }
  }

  // scenes: every scene tool names someone who exists, people never jump, and narration stays rare
  const people = new Set(['ouro', 'whorl']);
  for (const m of Object.values(MAPS)) for (const n of m.npcs) people.add(n.id);
  let narrs = 0;
  for (const full of contentFiles) {
    const file = path.relative(dir, full);
    const src = fs.readFileSync(full, 'utf8');
    narrs += (src.match(/(^|[^.\w])narr\(/g) || []).length;
    for (const mm of src.matchAll(/\b(walkTo|walkOff|walkIn|walkUp|emote|act|face|faceToward|fadeWho|liftOff|joinOuro|offstage)\('([^']+)'(?:, '([^']+)')?/g)) {
      if (!people.has(mm[2])) fail(`${file}: ${mm[1]} names nobody: ${mm[2]}`);
      if (mm[1] === 'faceToward' && mm[3] && !people.has(mm[3])) fail(`${file}: faceToward names nobody: ${mm[3]}`);
    }
    // A walk that ends on a solid tile on every map the person stands on cannot get there, and they would stop short.
    for (const mm of src.matchAll(/\b(walkTo|walkOff|walkIn)\('([^']+)', (\d+), (\d+)(?:, (\d+), (\d+))?\)/g)) {
      if (mm[2] === 'ouro' || mm[2] === 'whorl') continue;
      // A walk in may start on a door or in water. Only where it ends has to be open.
      const spots = mm[1] === 'walkIn' ? (mm[5] ? [[+mm[5], +mm[6]]] : []) : [[+mm[3], +mm[4]]];
      const homes = Object.values(MAPS).filter(m => m.npcs.some(n => n.id === mm[2]));
      for (const [x, y] of spots) {
        const open = homes.some(m => {
          const chs = [m.rows[y]?.[x], ...(m.mods || []).filter(md => md.y === y && x >= md.x && x < md.x + (md.w || 1)).map(md => md.ch)];
          return chs.some(ch => ch !== undefined && (!isSolid(ch) || m.warps.some(w => w.x === x && w.y === y)));
        });
        if (!open) fail(`${file}: ${mm[1]} sends ${mm[2]} to ${x},${y}, which is solid or off the map`);
      }
    }
    if (/\bnpcAt\(/.test(src)) fail(`${file}: npcAt puts a person down without walking them. Use walkTo or walkIn.`);
  }
  console.log(`scenes: ${narrs} narration calls`);
  if (narrs > 100) fail(`${narrs} narration calls, more than 100`);

  // Setting: every puzzle's reference machine runs in the puzzle's own simulator and delivers.
  const { PUZZLES, SHOP_PUZZLES, ALL_PUZZLES, FIRST_SET_NACRE } = await import('../game/setting/puzzles');
  for (const pz of ALL_PUZZLES) if (!(FIRST_SET_NACRE[pz.id] >= 1 && FIRST_SET_NACRE[pz.id] <= 5)) fail(`setting ${pz.id}: first-set nacre ${FIRST_SET_NACRE[pz.id]}, expected 1 to 5`);
  const { runAll, start: simStart, step: simStep, TAPE_LEN } = await import('../game/setting/core');
  const { SKETCH_SALE } = await import('../content/gems');
  const { EXTRA_WARES } = await import('../game/shopScreen');
  const settingLine: string[] = [];
  for (const pz of ALL_PUZZLES) {
    const r = runAll(pz, pz.ref);
    if (!r.ok) fail(`setting ${pz.id} ${pz.name}: reference fails: ${r.err} at cycle ${r.cycles}`);
    for (const p of pz.ref.parts) if (p.kind === 'arm' && p.tape.length > TAPE_LEN) fail(`setting ${pz.id}: a tape is longer than ${TAPE_LEN}`);
    settingLine.push(`${pz.id} ${r.cycles}/${r.cost}/${r.area}`);
  }
  if (PUZZLES.length !== 12) fail(`setting: ${PUZZLES.length} puzzles, expected 12`);
  if (SHOP_PUZZLES.length !== 12) fail(`setting: ${SHOP_PUZZLES.length} bought sketches, expected 12`);
  for (const pz of SHOP_PUZZLES) if (!SKETCH_SALE.some(s => s.id === pz.id) || !EXTRA_WARES['sketch:' + pz.id]) fail(`setting ${pz.id}: no Shellwright sells it`);
  console.log(`setting: ${settingLine.join(', ')}`);
  // The newer parts: a pivot turns the held piece about the claw, a mold copies onto paste, a chute takes a whole piece,
  // an input with a count stops giving, and a stone may not rest on an arm's base.
  {
    const lim = { arm: 2, polish: 0, set: 0, split: 0, mold: 1, chute: 1 };
    const pair = { atoms: [[0, 0, 'pearl'], [1, 0, 'amber']] as [number, number, 'pearl' | 'amber'][], bonds: [[0, 1]] as [number, number][] };
    const board = (inputs: Puzzle['inputs']): Puzzle => ({ id: 't', name: 't', idea: '', w: 6, h: 6, inputs, outputs: [{ x: 5, y: 5, shape: { atoms: [[0, 0, 'glass']], bonds: [] } }], need: 1, limit: lim, pivot: true, ref: { parts: [] } });
    const run = (pz: Puzzle, m: Machine, n: number) => { const s = simStart(pz, m); for (let k = 0; k < n; k++) simStep(pz, m, s); return s; };
    let s = run(board([{ x: 2, y: 2, shape: pair }]), { parts: [{ kind: 'arm', x: 1, y: 2, dir: 0, tape: 'G>' }] }, 2);
    const at = s.pieces[0]?.atoms.map(a => `${a.s}${a.x},${a.y}`).join(' ');
    if (at !== 'pearl2,2 amber2,3') fail(`setting rules: a pivot right left the pair at ${at}`);
    s = run(board([{ x: 1, y: 1, shape: { atoms: [[0, 0, 'star']], bonds: [] } }, { x: 2, y: 1, shape: { atoms: [[0, 0, 'paste']], bonds: [] } }]), { parts: [{ kind: 'mold', x: 1, y: 1, dir: 0 }] }, 1);
    if (!s.pieces.every(p => p.atoms[0].s === 'star')) fail('setting rules: a mold did not copy the star onto the paste');
    s = run(board([{ x: 1, y: 1, shape: pair, count: 2 }]), { parts: [{ kind: 'chute', x: 2, y: 1, dir: 0 }] }, 6);
    if (s.pieces.length || s.given[0] !== 2) fail(`setting rules: a chute left ${s.pieces.length} pieces, or the input gave ${s.given[0]} of 2`);
    s = run(board([{ x: 1, y: 1, shape: { atoms: [[0, 0, 'pearl']], bonds: [] } }]), { parts: [{ kind: 'arm', x: 1, y: 2, dir: 3, tape: 'GR' }, { kind: 'arm', x: 2, y: 2, dir: 0, tape: '' }] }, 2);
    if (s.err !== 'A stone ran into an arm.') fail(`setting rules: a stone swung onto an arm's base, and the run said ${s.err}`);
  }

  // Carcanet: its Tape sets Stones in order, a fifth pushes off the oldest, the newest Stone shapes its moves, Cleave
  // takes off the oldest, the crest reaches reserves only with four kinds, and the AI prices a full collar.
  {
    const { newBattle, runMove, out: outOf } = await import('../battle/engine');
    const { evaluate } = await import('../battle/ai');
    const { collar, setNext } = await import('../data/kits7');
    const { makeMon } = await import('../data/species');
    const carc = (tape: string, sets: number) => {
      const m = makeMon('carcanet', 25);
      m.tape = tape;
      const b = newBattle({ mons: [m], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25), makeMon('hare', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
      b.quiet = true;
      const f = b.s[0].f[0];
      f.k.cn = 0; f.k.tp = 0; f.k.taped = 1;
      for (const id of Object.keys(f.m)) delete f.m[id];
      for (let i = 0; i < sets; i++) setNext(b, f);
      return { b, f };
    };
    const t1 = carc('aags', 5);
    if (collar(t1.f).join('') !== '2342') fail(`carcanet: Tape aags holds ${collar(t1.f).join('')} after 5 sets, expected 2342`);
    if (t1.f.m.carc_amber?.n !== 2 || Object.keys(t1.f.m).pop() !== 'carc_amber') fail('carcanet: the readout marks do not follow the Stones');
    // The foe gets HP enough that neither hit can KO it, so the damage it takes is the whole hit.
    const facet = (tape: string) => { const t = carc(tape, 4), foe = outOf(t.b, 1); foe.maxHp = foe.hp = 9999; const hp = foe.hp; runMove(t.b, t.f, 0, {}); return hp - foe.hp; };
    const amberHit = facet('aaaa'), pearlHit = facet('pppp');
    if (!(Math.abs(amberHit / pearlHit - 1.4) < 0.03)) fail(`carcanet: Facet under amber ${amberHit}, under pearl ${pearlHit}, expected 1.4x`);
    const t2 = carc('pags', 4);
    runMove(t2.b, t2.f, 2, {});
    if (collar(t2.f).join('') !== '234') fail(`carcanet: Cleave left ${collar(t2.f).join('')}, expected 234`);
    const crest = (tape: string) => { const t = carc(tape, 4), r = t.b.s[1].f[1], hp = r.hp; runMove(t.b, t.f, 3, {}); return { reserve: hp - r.hp, left: collar(t.f).length }; };
    const kinds4 = crest('pags'), alike4 = crest('aaaa');
    if (!(kinds4.reserve > 0) || alike4.reserve !== 0 || kinds4.left || alike4.left) fail(`carcanet: crest reserve damage ${kinds4.reserve} with four kinds and ${alike4.reserve} with four alike`);
    const t3 = carc('pags', 0), bare = evaluate(t3.b, 0);
    for (let i = 0; i < 4; i++) setNext(t3.b, t3.f);
    if (!(evaluate(t3.b, 0) > bare + 0.1)) fail('carcanet: the AI does not value a full collar');
  }

  // The reworked legendaries: Full's Moon, Knot's Tension, Mundane's Layers, and Holm's Rider.
  {
    const { newBattle, runMove, forbidden, marked: stacks } = await import('../battle/engine');
    const { PASSIVES } = await import('../battle/registry');
    const { makeMon } = await import('../data/species');
    const duo = (kind: string) => {
      const b = newBattle({ mons: [makeMon(kind, 25), makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25), makeMon('hare', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
      b.quiet = true;
      return { b, f: b.s[0].f[0], mate: b.s[0].f[1], foe: b.s[1].f[0], back: b.s[1].f[1] };
    };
    const full = duo('full');
    if (!stacks(full.f, 'full_home')) fail('full: the Moon does not start at home');
    runMove(full.b, full.f, 0, { target: 1 });
    if (!stacks(full.back, 'full_moon') || stacks(full.f, 'full_home')) fail('full: Tide Lift did not move the Moon to a foe in reserve');
    if (!forbidden(full.b, full.back, 'switch')) fail('full: a foe with the Moon can switch');
    runMove(full.b, full.f, 2, {});
    if (stacks(full.back, 'full_moon') || !stacks(full.f, 'full_home') || !(full.f.shield > 0)) fail('full: Spring Tide did not call the Moon home with a shield');
    const knot = duo('knot');
    runMove(knot.b, knot.f, 1, {});
    if (!stacks(knot.foe, 'knot_bound') || !forbidden(knot.b, knot.foe, 'switch')) fail('knot: Tie did not bind the foe');
    PASSIVES.habit.turnStart!(knot.b, knot.f);
    PASSIVES.habit.turnStart!(knot.b, knot.f);
    if (stacks(knot.f, 'knot_tension') !== 2) fail(`knot: ${stacks(knot.f, 'knot_tension')} Tension after two turn starts, expected 2`);
    runMove(knot.b, knot.f, 2, {});
    if (stacks(knot.f, 'knot_tension') || !knot.foe.s.stun || !(knot.f.shield > 0)) fail('knot: Tighten did not spend 2 Tension for Stun 1 and a shield');
    const mund = duo('mundane');
    if (stacks(mund.f, 'mundane_layer') !== 5) fail(`mundane: starts with ${stacks(mund.f, 'mundane_layer')} Layers, expected 5`);
    const backHp = mund.back.hp;
    runMove(mund.b, mund.f, 3, {});
    if (stacks(mund.f, 'mundane_layer') || !stacks(mund.f, 'mundane_bare') || !(mund.back.hp < backHp)) fail('mundane: Peel did not shed every Layer, reach the reserve, and leave it Bare');
    const holm = duo('holm');
    if (!stacks(holm.mate, 'holm_rider')) fail('holm: its first reserve did not board');
    runMove(holm.b, holm.f, 3, { target: 1 });
    if (!(holm.mate.shield > 0) || !holm.mate.s.haste) fail('holm: Make Landfall did not shield and haste the Rider');
  }

  // cries: every kind has its own, under a second
  const { speciesCry } = await import('../game/cries');
  const { planPage, VOICES, voiceFor } = await import('../game/voices');
  const { letterLength } = await import('../engine/speech');
  const cries = new Map<string, string>();
  for (const k of [...WILD_KINDS, 'full', 'mundane', 'knot', 'carcanet']) {
    const c = speciesCry(k);
    if (!c) { fail(`${k}: no cry`); continue; }
    if (c.dur >= 1 || c.f.some(f => !(f > 40 && f < 4000))) fail(`${k}: cry out of range ${JSON.stringify(c)}`);
    const sig = JSON.stringify([c.f, c.dur, c.types]);
    if (cries.has(sig)) fail(`${k} cries the same as ${cries.get(sig)}`);
    cries.set(sig, k);
  }
  // voices: each named voice sits in a sane range, every letter lasts 25 to 45 ms, and every line in content types out
  // with letters to speak, in order, with no pause over a second
  for (const [who, v] of Object.entries(VOICES)) {
    if (!(v.f > 60 && v.f < 2000) || !(v.size >= 0.6 && v.size <= 1.8) || !(v.rate >= 26 && v.rate <= 50) || !v.steps.length) fail(`voice ${who} out of range`);
    const vowel = letterLength(v, 'a') * 1000;
    if (vowel < 25 || vowel > 45) fail(`voice ${who}: a vowel lasts ${vowel.toFixed(0)} ms`);
  }
  const anyVoice = voiceFor('Old man')!;
  let letters = 0;
  for (const full of contentFiles) for (const raw of fs.readFileSync(full, 'utf8').match(/'(?:[^'\\]|\\.)*'/g) || []) {
    const s = raw.slice(1, -1).replace(/\\'/g, "'");
    if (s.length < 12 || !/[a-z] [a-z]/i.test(s)) continue;
    const beats = planPage(anyVoice, [s]);
    const n = beats.filter(b => b.say).length;
    if (!n || beats.length !== s.length) fail(`no letters to speak in: ${s.slice(0, 50)}`);
    if (beats.some((b, i) => i && (b.at < beats[i - 1].at || b.at - beats[i - 1].at > 1))) fail(`bad pacing in: ${s.slice(0, 50)}`);
    letters += n;
  }
  console.log(`${cries.size} cries, ${Object.keys(VOICES).length} named voices, ${letters} spoken letters in content text`);

  // Rounds: equal turns make a joint round, switch and guard go first, the move kinds have their rules, Slow moves the next
  // turn at once, a knocked-out whorl's choice is dropped, and two AIs finish a battle.
  {
    const E = await import('../battle/engine');
    const { aiTurn, choose } = await import('../battle/ai');
    const { MOVES } = await import('../battle/registry');
    const { makeMon } = await import('../data/species');
    const mk = (a: string[], z: string[]) => {
      const b = E.newBattle({ mons: a.map(k => makeMon(k, 25)), name: 'A', ai: 'keeper' }, { mons: z.map(k => makeMon(k, 25)), name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
      b.quiet = true;
      return b;
    };
    const round = (b: ReturnType<typeof mk>, a0: Parameters<typeof E.actJoint>[1], a1: Parameters<typeof E.actJoint>[2]) => { E.actJoint(b, a0, a1); E.advance(b); };
    {
      const b = mk(['cairn', 'hare'], ['cairn', 'hare']);
      if (E.advance(b).kind !== 'joint') fail('rounds: two equal whorls do not open with a joint round');
      // A switch goes first, so the attack lands on the whorl that comes in.
      const first = b.s[1].f[0], second = b.s[1].f[1], hp0 = first.hp, hp1 = second.hp;
      round(b, { k: 'attack' }, { k: 'switch', to: 1 });
      if (first.hp !== hp0 || second.hp >= hp1) fail(`rounds: the attack should land on the whorl switched in (${hp0}->${first.hp}, ${hp1}->${second.hp})`);
    }
    {
      // A guard goes first even when its turn comes later in the round.
      const hit = (guard: boolean) => {
        const b = mk(['cairn'], ['cairn']);
        E.advance(b);
        b.s[1].next = b.s[0].next + 5;
        const t = b.s[1].f[0], hp = t.hp;
        round(b, { k: 'attack' }, guard ? { k: 'guard' } : { k: 'attack' });
        return hp - t.hp;
      };
      const plain = hit(false), guarded = hit(true);
      if (!(guarded > 0 && Math.abs(guarded / plain - 0.5) < 0.05)) fail(`rounds: a guard on a later turn took ${guarded} of ${plain}`);
    }
    {
      // Kinds against a guard and a dashing whorl, measured on one hit of the same raw power.
      const b = mk(['cairn'], ['cairn']);
      const u = b.s[0].f[0], t = b.s[1].f[0];
      // No habits on either side, so only the rules under test change the hit.
      u.mon = { ...u.mon, passives: [] }; t.mon = { ...t.mon, passives: [] };
      const fake = (tags?: ('dash' | 'projectile' | 'spell')[]) => ({ ...MOVES[u.moves[0]], tags });
      const take = (tags: ('dash' | 'projectile' | 'spell')[] | undefined, st: 'guard' | 'dashing' | null) => {
        t.hp = t.maxHp * 4; t.ko = false; t.shield = 0; t.s = {}; t.m = {};
        if (st) t.s[st] = { n: 1 };
        return E.dealDamage(b, u, t, 400, { kind: 'P', move: fake(tags), attack: false, dot: false, spread: false, reserve: false }, null);
      };
      const open = take(undefined, null), guarded = take(undefined, 'guard'), proj = take(['projectile'], 'guard'), dash = take(['dash'], 'guard'), dashing = take(undefined, 'dashing');
      if (Math.abs(guarded / open - 0.5) > 0.02) fail(`kinds: a guard let through ${guarded} of ${open}`);
      if (Math.abs(proj / open - 0.25) > 0.02) fail(`kinds: a guard let through ${proj} of ${open} from a projectile`);
      if (dash !== open) fail(`kinds: a guard reduced a dash to ${dash} of ${open}`);
      if (Math.abs(dashing / open - 0.9) > 0.02) fail(`kinds: a dashing whorl took ${dashing} of ${open}`);
    }
    {
      // Silence stops spells, Root stops dashes, and both leave other moves alone.
      const spellOwner = Object.values(MOVES).find(m => m.tags?.includes('spell') && !m.extra && makeMon(m.owner, 25)?.moves.some(id => !MOVES[id].tags?.includes('spell')));
      const dashOwner = Object.values(MOVES).find(m => m.tags?.includes('dash') && !m.extra && makeMon(m.owner, 25)?.moves.some(id => !MOVES[id].tags?.includes('dash')));
      for (const [m, st, tag] of [[spellOwner, 'silence', 'spell'], [dashOwner, 'root', 'dash']] as const) {
        if (!m) { fail(`kinds: no kind with a ${tag} move to test`); continue; }
        const b = mk([m.owner], ['cairn']);
        E.advance(b);
        const f = b.s[0].f[0];
        f.s[st] = { n: 2 };
        f.moves.forEach((id, i) => {
          const has = !!MOVES[id].tags?.includes(tag);
          const why = E.usable(b, f, i).why;
          if (has && !/Silenced|Rooted/.test(why)) fail(`kinds: ${st} did not stop ${MOVES[id].name}`);
          if (!has && /Silenced|Rooted/.test(why)) fail(`kinds: ${st} stopped ${MOVES[id].name}, which is not a ${tag}`);
        });
      }
    }
    {
      // Slow 1 on a whorl between its turns moves that turn back by 30% of a plain turn, and wears off after it.
      const b = mk(['cairn'], ['cairn']);
      E.advance(b);
      const t = b.s[1].f[0], before = b.s[1].next;
      b.acting = null;
      E.applyStatus(b, b.s[0].f[0], t, 'slow', 1);
      const moved = b.s[1].next - before, want = Math.round(E.SPEED_SHIFT * E.plainTicks(b, t));
      if (moved !== want) fail(`slow: the next turn moved ${moved} ticks, expected ${want}`);
      round(b, { k: 'attack' }, { k: 'attack' });
      if (t.s.slow) fail('slow: Slow 1 is still on after the turn it moved');
    }
    {
      // A whorl hasted while its foe is slowed takes a solo turn before long.
      const b = mk(['cairn'], ['cairn']);
      let solo = false;
      for (let i = 0; i < 12 && !solo; i++) {
        const d = E.advance(b);
        b.s[0].f[0].s.haste = { n: 9, v: 1 }; b.s[1].f[0].s.slow = { n: 9, v: 1 };
        if (d.kind === 'act' && d.side === 0) solo = true;
        if (d.kind === 'over') break;
        aiTurn(b);
      }
      if (!solo) fail('rounds: a much faster whorl never took a solo turn');
    }
    {
      // A whorl knocked out before its choice resolves loses the choice, and its side's replacement comes out on its own clock.
      const b = mk(['cairn'], ['cairn', 'hare']);
      E.advance(b);
      b.s[1].next = b.s[0].next + 5;
      b.s[1].f[0].hp = 1;
      round(b, { k: 'attack' }, { k: 'attack' });
      if (b.queue.length) fail('rounds: a knocked-out whorl kept its choice in the round');
      if (!b.s[1].f[0].ko) fail('rounds: the setup did not knock the foe out');
      E.replace(b, 1, 1);
      const d = E.advance(b);
      if (d.kind !== 'act' && d.kind !== 'joint') fail(`rounds: after a knockout and a replacement the battle waits on ${d.kind}`);
      else if (!choose(b, 0)) fail('rounds: the AI could not choose after a knockout');
    }
    {
      // Two AIs finish whole battles through joint rounds and solo turns.
      for (const [a, z] of [[['cairn', 'hare', 'brine', 'eddy'], ['floe', 'burr', 'tor', 'squall']], [['skua', 'tang', 'razor', 'gimlet'], ['menhir', 'howl', 'kipper', 'pallium']]]) {
        const b = mk(a, z);
        let n = 0;
        while (n++ < 600) {
          const d = E.advance(b, (bb, side) => E.standing(bb.s[side]).find(f => f.idx !== bb.s[side].out)?.idx ?? -1);
          if (d.kind === 'over') break;
          aiTurn(b);
        }
        if (b.over === null) fail(`rounds: ${a[0]} against ${z[0]} did not finish in 600 decisions`);
      }
    }
    {
      // Move toolkit: a boost scales a move's hit and is spent by its uses, a retyped move counts as its new type until its
      // turns run out, and added cooldown keeps a ready move waiting that many turns and counts against its holder for the AI.
      const { evaluate } = await import('../battle/ai');
      const b = mk(['cairn'], ['cairn']);
      E.advance(b);
      const u = b.s[0].f[0], t = b.s[1].f[0];
      u.mon = { ...u.mon, passives: [] }; t.mon = { ...t.mon, passives: [] };
      const dmg = (slot: number, mul: number) => {
        const c = E.clone(b), cu = c.s[0].f[0], ct = c.s[1].f[0];
        ct.hp = ct.maxHp * 4;
        if (mul !== 1) E.boostMove(c, cu, slot, mul, 1);
        const hp = ct.hp;
        E.runMove(c, cu, slot, {});
        if (cu.boost?.length) fail('toolkit: a one-use boost was not spent');
        return hp - ct.hp;
      };
      const slot = [0, 1, 2].find(i => dmg(i, 1) > 0);
      if (slot === undefined) fail('toolkit: no cairn move deals damage to test a boost on');
      else {
        const plain = dmg(slot, 1), boosted = dmg(slot, 1.5);
        if (Math.abs(boosted / plain - 1.5) > 0.05) fail(`toolkit: a 1.5x boost took a hit from ${plain} to ${boosted}`);
      }
      const m0 = MOVES[u.moves[0]], other = (['TIDE', 'STAR', 'VOID'] as const).find(x => x !== m0.type)!;
      E.retypeMove(b, u, 0, other, 1);
      if (E.moveType(u, m0) !== other) fail('toolkit: a retyped move kept its own type');
      const k = t.cd.findIndex(c => c === 0);
      b.acting = 0;
      E.shiftCd(b, t, k, 2);
      b.acting = null;
      if (t.cdHit?.[k] !== 2) fail(`toolkit: added cooldown counted ${t.cdHit?.[k]} against the holder, expected 2`);
      const bare = E.clone(b);
      bare.s[1].f[0].cdHit = [];
      if (!(evaluate(b, 0) > evaluate(bare, 0))) fail('toolkit: the AI does not value cooldown added to the foe');
      // Both sides attack until the foe starts its next turn.
      const nextTurn = () => {
        const n = t.turns;
        for (let i = 0; i < 6 && t.turns === n && b.over === null; i++) {
          if (b.need?.kind === 'joint') E.actJoint(b, { k: 'attack' }, { k: 'attack' });
          else if (b.need?.kind === 'act') E.act(b, { k: 'attack' });
          E.advance(b);
        }
      };
      nextTurn();
      if (E.moveType(u, m0) === other) fail('toolkit: a move retyped for 1 turn kept its new type after the turn');
      if (!/2 more turns/.test(E.usable(b, t, k).why)) fail(`toolkit: 2 added turns on a ready move left it "${E.usable(b, t, k).why}"`);
      nextTurn();
      nextTurn();
      if (!E.usable(b, t, k).ok && b.over === null) fail(`toolkit: a move was still waiting 3 turns after 2 were added (${E.usable(b, t, k).why})`);
    }
    // ---- Kit pass mechanics from kits4 to kits6, one block each (Notes/mechanics.md).
    {
      // Choice moves: legal() lists one action per option, and the pick reaches the move as Ctx.opt.
      const b = mk(['aerial'], ['cairn', 'hare']);
      E.advance(b);
      const u = b.s[0].f[0], i = u.moves.indexOf('aerial_broadcast');
      const opts = E.legal(b, 0).filter(a => a.k === 'move' && a.i === i);
      if (opts.length !== 3 || opts.some((a, k) => a.k !== 'move' || a.opt !== k)) fail('choice moves: Tune In is not listed once per band');
      const reserveHit = (opt: number) => { const c = E.clone(b); const r = c.s[1].f[1], hp = r.hp; E.runMove(c, c.s[0].f[0], i, { opt }); return hp - r.hp; };
      if (reserveHit(1) <= 0 || reserveHit(0) !== 0) fail('choice moves: the Mid band did not reach the reserve while Long stayed on the foe');
      const dead = E.clone(b), j = u.moves.indexOf('aerial_longwave');
      E.runMove(dead, dead.s[0].f[0], j, { opt: 1 });
      const foe = dead.s[1].f[0], dash = foe.moves.findIndex(id => MOVES[id]?.tags?.includes('dash'));
      if (dash >= 0 && E.usable(dead, foe, dash).why !== 'Jammed.') fail('choice moves: Dead Air on dashes left the foe its dash');
    }
    {
      // Rescue swap: a reserve with a rescue hook swaps in for the out ally a blow would knock out, once.
      const b = mk(['cairn', 'capsule'], ['cairn']);
      E.advance(b);
      const ally = b.s[0].f[0], cap = b.s[0].f[1], hitter = b.s[1].f[0];
      const blow = () => E.dealDamage(b, hitter, b.s[0].f[b.s[0].out], 99999, { kind: 'T', move: null, attack: false, dot: false, spread: false, reserve: false }, null);
      blow();
      if (ally.ko || ally.hp !== 1 || b.s[0].out !== cap.idx) fail('rescue swap: Eject did not swap Capkara in and leave the ally at 1 HP');
      E.doSwitch(b, 0, ally.idx, true);
      blow();
      if (!ally.ko) fail('rescue swap: Eject saved a second ally');
    }
    {
      // Echoes: a heard foe move is scheduled to come back, castMove casts it at the echo's power, and the AI counts the echo.
      const { evaluate } = await import('../battle/ai');
      const b = mk(['dish'], ['cairn']);
      E.advance(b);
      const d = b.s[0].f[0], t = b.s[1].f[0];
      E.runMove(b, d, d.moves.indexOf('dish_sidelobe'), {});
      const slot = t.moves.findIndex(id => MOVES[id]?.reach === 'single');
      E.runMove(b, t, slot, {});
      const echo = b.pend.find(p => p.kind === 'echo');
      if (!echo || echo.move !== t.moves[slot] || echo.side !== 0) fail('echoes: Feedback did not catch the foe\'s move as an echo for Pasara');
      const hurt = (power: number) => { const c = E.clone(b), ct = c.s[1].f[0]; ct.hp = ct.maxHp * 9; const hp = ct.hp; E.castMove(c, c.s[0].f[0], t.moves[slot], power); return hp - ct.hp; };
      const full = hurt(1), half = hurt(0.5);
      if (full > 0 && Math.abs(half / full - 0.5) > 0.08) fail(`echoes: a 0.5x echo dealt ${half} against ${full} at full power`);
      const quiet = E.clone(b);
      quiet.pend = quiet.pend.filter(p => p.kind !== 'echo');
      if (full > 0 && !(evaluate(b, 0) > evaluate(quiet, 0))) fail('echoes: the AI does not count an echo on its side');
    }
    {
      // Banked hits: a dreaming foe's hits wait in Fighter.bank without waking it, then land together when it wakes.
      const { evaluate } = await import('../battle/ai');
      const { MARKS } = await import('../battle/registry');
      const b = mk(['selkie'], ['cairn']);
      E.advance(b);
      const s = b.s[0].f[0], t = b.s[1].f[0];
      t.mon = { ...t.mon, passives: [] };
      E.runMove(b, s, s.moves.indexOf('selkie_bubble'), {});
      const hp = t.hp;
      E.dealDamage(b, s, t, 60, { kind: 'P', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      if (t.hp !== hp || !t.s.sleep || !(t.bank! > 0)) fail('banked hits: a hit on a dreaming foe was not held back, or it woke the foe');
      const held = E.clone(b), bare = E.clone(b);
      bare.s[1].f[0].bank = 0;
      if (!(evaluate(held, 0) > evaluate(bare, 0))) fail('banked hits: the AI does not count damage waiting in the bank');
      const bank = t.bank || 0;
      delete t.s.sleep;
      MARKS.selkie_dream.turnStart!(b, t);
      if (Math.abs((hp - t.hp) - Math.round(bank * 1.25)) > 2 || t.bank) fail(`banked hits: waking landed ${hp - t.hp} for a bank of ${bank}`);
    }
    {
      // HP roll: two whorls swap their shares of HP, and Capsize does it before its hit.
      const b = mk(['berg'], ['cairn']);
      E.advance(b);
      const g = b.s[0].f[0], t = b.s[1].f[0];
      g.hp = Math.round(g.maxHp * 0.2); t.hp = Math.round(t.maxHp * 0.9);
      E.rollHp(b, g, t);
      if (Math.abs(g.hp / g.maxHp - 0.9) > 0.02 || Math.abs(t.hp / t.maxHp - 0.2) > 0.02) fail('HP roll: rollHp did not swap the shares of HP');
      g.hp = Math.round(g.maxHp * 0.3); t.hp = t.maxHp;
      E.runMove(b, g, g.moves.indexOf('berg_capsize'), {});
      if (g.hp / g.maxHp < 0.95 || t.hp / t.maxHp > 0.3) fail('HP roll: Capsize did not roll Gevuori and the foe over');
    }
    {
      // Reach shift: a wide reach carries a one-foe hit on to the reserves, a tight one puts an every-foe hit on the out foe.
      const b = mk(['pennon'], ['cairn', 'hare']);
      E.advance(b);
      const p = b.s[0].f[0];
      const run = (id: string, mode: 'wide' | 'tight' | null) => {
        const c = E.clone(b), u = c.s[0].f[0], t = c.s[1].f[0], r = c.s[1].f[1];
        t.hp = t.maxHp * 5; const ht = t.hp, hr = r.hp;
        if (mode) E.setReach(c, u, mode, 1);
        E.runMove(c, u, u.moves.indexOf(id), {});
        return { out: ht - t.hp, res: hr - r.hp, left: u.reach };
      };
      const wide = run('pennon_rally', 'wide'), narrow = run('pennon_snap', 'tight'), plain = run('pennon_snap', null);
      if (!(wide.res > 0) || wide.left) fail('reach shift: a wide Guy Rope did not reach the reserve, or the reach was not spent');
      if (narrow.res !== 0 || Math.abs(narrow.out / plain.out - 1.4) > 0.05) fail(`reach shift: a tight Wind Crack hit the reserve or dealt ${narrow.out} against ${plain.out}`);
      void p;
    }
    {
      // Lent passives: a lent passive's hooks run as the borrower's own, and leaving the field ends the loan.
      const { PASSIVES } = await import('../battle/registry');
      const b = mk(['tang', 'cairn'], ['cairn']);
      E.advance(b);
      const tg = b.s[0].f[0], ally = b.s[0].f[1];
      E.runMove(b, tg, tg.moves.indexOf('tang_scabbard'), { target: ally.idx });
      if (!E.hooks(ally).includes(PASSIVES.tang_edgeguard)) fail('lent passives: Hand Over did not lend Keen Edge to the ally');
      E.doSwitch(b, 0, ally.idx, true);
      E.doSwitch(b, 0, tg.idx, true);
      if (E.hooks(ally).includes(PASSIVES.tang_edgeguard)) fail('lent passives: the loan outlasted the ally leaving the field');
    }
    {
      // Ammo: a move with shots fires with no wait until its last shot, which starts its cooldown and refills it.
      const b = mk(['fletch'], ['cairn']);
      E.advance(b);
      const f = b.s[0].f[0], i = f.moves.indexOf('fletch_nock');
      b.s[1].f[0].hp = b.s[1].f[0].maxHp * 50;
      const shoot = () => { b.need = { kind: 'act', side: 0 }; b.acting = null; E.act(b, { k: 'move', i }); };
      shoot();
      if (f.cd[i] !== 0 || E.ammoOf(f, i) !== 2) fail(`ammo: one shot left Loose waiting ${f.cd[i]} with ${E.ammoOf(f, i)} shots`);
      shoot(); shoot();
      if (!(f.cd[i] > 0) || E.ammoOf(f, i) !== 3) fail(`ammo: the last shot left Loose waiting ${f.cd[i]} with ${E.ammoOf(f, i)} shots`);
    }
    {
      // Foresight: the side whose out whorl foresees chooses after the other, answering its known choice.
      const { answer } = await import('../battle/ai');
      const b = mk(['image'], ['cairn']);
      if (E.advance(b).kind !== 'joint') fail('foresight: Kugami against Cairn did not open with a joint round');
      if (!E.foresees(b, 0) || E.foresees(b, 1)) fail('foresight: Foreknowing did not give its side the sight, or gave it to both');
      const theirs: Parameters<typeof E.actJoint>[2] = { k: 'guard' };
      const mine = answer(b, 0, theirs);
      if (!E.legal(b, 0).some(x => JSON.stringify(x) === JSON.stringify(mine))) fail('foresight: the answer to a known guard is not a legal action');
      const done = aiTurn(b);
      if (done.length !== 2) fail('foresight: a joint round with foresight did not resolve both choices');
    }
    {
      // Redirect: a reserve with a redirect hook takes a foe's one-target move in place of its out ally.
      const b = mk(['cairn', 'siderite'], ['kiln']);
      E.advance(b);
      const out0 = b.s[0].f[0], sid = b.s[0].f[1], k = b.s[1].f[0];
      const h0 = out0.hp, h1 = sid.hp;
      E.runMove(b, k, k.moves.indexOf('kiln_temper'), {});
      if (out0.hp !== h0 || sid.hp >= h1) fail('redirect: Lodestone did not pull a GEAR move off the out ally onto Siderite');
    }
    {
      // Heal inversion: a healIn hook below 0 turns a heal on the holder into damage, as Envenomed does.
      const b = mk(['telson'], ['cairn']);
      E.advance(b);
      const tl = b.s[0].f[0], t = b.s[1].f[0];
      E.runMove(b, tl, tl.moves.indexOf('telson_seep'), {});
      t.hp = Math.round(t.maxHp * 0.5);
      const hp = t.hp;
      E.heal(b, t, t, 40);
      if (t.hp >= hp) fail('heal inversion: a heal on an Envenomed foe did not burn it');
      E.unmark(t, 'telson_venom');
      const hp2 = t.hp;
      E.heal(b, t, t, 40);
      if (t.hp <= hp2) fail('heal inversion: a heal still burned after Envenomed ended');
      // A hook that turns damage into healing (Kucella's filling up) must not loop with a burning heal.
      E.mark(b, null, t, 'telson_venom', 1, 3);
      E.mark(b, null, t, 'cellar_time', 1, 3);
      try { E.dealDamage(b, tl, t, 30, { kind: 'P', move: null, attack: true, dot: false, spread: false, reserve: false }, null); }
      catch (e) { fail(`heal inversion: Envenomed and a healing hook looped (${(e as Error).message})`); }
    }
    {
      // Burial: a buried reserve cannot be switched in, and it comes out only when nobody else can.
      const { chooseReplacement } = await import('../battle/ai');
      const b = mk(['erg'], ['cairn', 'hare', 'kiln']);
      E.advance(b);
      const e = b.s[0].f[0], them = b.s[1], r1 = them.f[1], r2 = them.f[2];
      const i = e.moves.indexOf('erg_slipface');
      if (E.legal(b, 0).filter(a => a.k === 'move' && a.i === i).length !== 2) fail('burial: Sand Over is not listed once per foe reserve');
      E.runMove(b, e, i, { target: r1.idx });
      if (!E.barred(r1) || E.barred(r2)) fail('burial: Sand Over did not bury the reserve it picked');
      const sw = E.legal(b, 1).flatMap(a => (a.k === 'switch' ? [a.to] : []));
      if (sw.includes(r1.idx) || !sw.includes(r2.idx)) fail('burial: the foe could still switch to a buried reserve');
      if (E.nextInLine(them) !== r2.idx) fail('burial: a force out would bring in the buried reserve');
      them.f[0].ko = true;
      if (chooseReplacement(b, 1) !== r2.idx) fail('burial: a replacement picked the buried reserve over a free one');
      r2.ko = true;
      if (chooseReplacement(b, 1) !== r1.idx) fail('burial: a buried reserve did not come out when nobody else could');
      E.replace(b, 1, r1.idx);
      if (E.barred(r1)) fail('burial: a whorl stayed buried after it came out');
    }
    {
      // Bench moves: a reserve uses its own move from the bench without coming out, and that move's cooldown starts.
      const b = mk(['glove', 'cairn'], ['hare']);
      E.advance(b);
      const g = b.s[0].f[0], al = b.s[0].f[1], t = b.s[1].f[0];
      t.hp = t.maxHp * 9;
      const hp = t.hp, i = g.moves.indexOf('glove_springoff'), k = al.moves.indexOf('topple');
      if (!E.benchable(b, al, k)) fail('bench moves: Top Stone cannot be used from the bench');
      E.runMove(b, g, i, { target: al.idx });
      if (b.s[0].out !== g.idx || !(t.hp < hp)) fail('bench moves: Lend a Hand did not let Kivishi hit from the bench');
      if (!(al.cd[k] > 0) || al.boost?.length) fail(`bench moves: Top Stone waits ${al.cd[k]} after a bench use, with ${al.boost?.length || 0} boosts left`);
    }
    {
      // Drops: a drop on the field gives both out whorls a take action, and taking it spends the turn on its effect.
      const b = mk(['espalier'], ['cairn']);
      E.advance(b);
      E.dropItem(b, 'espalier_pear', 3);
      const uid = b.drops?.[0]?.uid ?? -1;
      for (const side of [0, 1] as const) if (!E.legal(b, side).some(a => a.k === 'take' && a.i === uid)) fail(`drops: side ${side} cannot take the Pear`);
      const c = E.clone(b), t = c.s[1].f[0];
      t.hp = Math.round(t.maxHp * 0.5);
      const hp = t.hp;
      c.need = { kind: 'act', side: 1 }; c.acting = null;
      E.act(c, { k: 'take', i: uid });
      if (c.drops?.length || !(t.hp > hp)) fail('drops: taking the Pear did not heal the taker and clear it from the field');
      if (b.drops?.length !== 1) fail('drops: a clone shared its drops with the battle');
    }
    {
      // Muted passives: a mark that mutes stops the holder's passives until it ends, and has() agrees.
      const { PASSIVES } = await import('../battle/registry');
      const b = mk(['nought'], ['cholla']);
      E.advance(b);
      const n = b.s[0].f[0], t = b.s[1].f[0];
      E.runMove(b, n, n.moves.indexOf('nought_erase'), {});
      if (!E.muted(t) || E.hooks(t).includes(PASSIVES.cholla_deepspines) || E.has(t, 'cholla_deepspines')) fail('muted passives: Rub Out left the foe its passives');
      E.unmark(t, 'nought_blank');
      if (E.muted(t) || !E.hooks(t).includes(PASSIVES.cholla_deepspines)) fail('muted passives: the passives did not come back when the mark ended');
    }
    {
      // Summon theft: a summon pulled over changes side and owner, and its own clock follows it.
      const b = mk(['lip'], ['erg', 'cairn']);
      E.advance(b);
      const h = b.s[0].f[0], e = b.s[1].f[0];
      const u = E.summon(b, e, 'erg_soldier', { hp: 0.1, turns: 4 });
      E.runMove(b, h, h.moves.indexOf('lip_pullover'), { target: 1 });
      if (!u || u.side !== 0 || u.by !== h.idx || b.s[1].sum.includes(u) || !b.s[0].sum.includes(u)) fail('summon theft: Over the Edge did not pull the Polyp over to Hebrum');
      if (u && b.pend.some(p => p.kind === 'summon' && p.data?.uid === u.uid && p.side !== 0)) fail('summon theft: the Polyp\'s clock stayed with its old side');
      if (b.s[1].out !== 0) fail('summon theft: Over the Edge also dragged a reserve in');
    }
    {
      // Grounds: a ground lies under one side only, its hooks reach that side's whorls, and it copies with the battle.
      const { GROUNDS } = await import('../battle/registry');
      const b = mk(['sag'], ['cairn']);
      E.advance(b);
      const n = b.s[0].f[0], t = b.s[1].f[0];
      E.runMove(b, n, n.moves.indexOf('sag_sinkhole'), {});
      if (b.s[0].ground?.id !== 'sag_pool' || n.gnd !== 'sag_pool' || t.gnd || b.s[1].ground) fail('grounds: Settle In did not lay a Salt Pool under its own side alone');
      if (!E.hooks(n).includes(GROUNDS.sag_pool) || E.hooks(t).includes(GROUNDS.sag_pool)) fail('grounds: the Salt Pool\'s hooks did not reach its side alone');
      const c = E.clone(b);
      c.s[0].ground!.turns = 0.5;
      if (b.s[0].ground?.turns === 0.5) fail('grounds: a clone shared its ground with the battle');
      n.hp = Math.round(n.maxHp * 0.5);
      const hp = n.hp;
      GROUNDS.sag_pool.turnStart!(b, n);
      if (!(n.hp > hp)) fail('grounds: the Salt Pool did not heal the whorl standing in it');
      E.setGround(b, 0, null);
      if (n.gnd || b.s[0].ground) fail('grounds: clearing the ground left it under the side');
    }
    {
      // Battle clock: a whorl that keeps time starts the clock, every hour it passes reaches every whorl's hooks, and copies keep their own.
      const b = mk(['mew'], ['cairn']);
      E.advance(b);
      const m = b.s[0].f[0];
      if (b.clock !== 16 * 60) fail(`battle clock: Kamorus did not start the clock at 4:00 (it reads ${b.clock})`);
      const c = E.clone(b);
      E.setClock(c, 20 * 60);
      if (b.clock !== 16 * 60) fail('battle clock: a copy moved the battle\'s clock');
      E.setClock(b, 18 * 60);
      if (!m.m.mew_aloft) fail('battle clock: Kamorus did not go up at six');
    }
    {
      // Curing: a mark that preserves stops the holder's statuses from counting down, while it runs down on its own clock.
      const b = mk(['halite'], ['cairn']);
      E.advance(b);
      const t = b.s[1].f[0];
      E.applyStatus(b, null, t, 'weaken', 2);
      E.mark(b, null, t, 'halite_cured', 1, 2);
      t.m.halite_cured!.at = -1;
      const before = t.s.weaken?.n;
      b.need = { kind: 'act', side: 1 }; b.acting = null;
      E.act(b, { k: 'guard' });
      if (!E.cured(t) || t.s.weaken?.n !== before) fail(`curing: Weaken went from ${before} to ${t.s.weaken?.n} while the foe was cured`);
      if (t.m.halite_cured?.t !== 1) fail('curing: the cure did not run down on its own clock');
    }
    {
      // Tide hold: while a side's tide is held, what it would gain goes to the holding side, and copies keep their own hold.
      const b = mk(['flotsam'], ['cairn']);
      E.advance(b);
      b.rules.nerve = true;
      E.holdTide(b, 1, 0, 3);
      const n0 = b.s[0].nerve, n1 = b.s[1].nerve;
      E.addNerve(b, 1, 2);
      if (b.s[1].nerve !== n1 || b.s[0].nerve !== n0 + 2) fail(`tide hold: tide went ${n0}>${b.s[0].nerve} and ${n1}>${b.s[1].nerve} with side 1 held`);
      const c = E.clone(b);
      c.s[1].hold = null;
      if (!b.s[1].hold) fail('tide hold: a copy shared the hold with the battle');
    }
    {
      // Called next: a reserve with a calling mark is the only switch, the next in line, and the replacement.
      const { chooseReplacement } = await import('../battle/ai');
      const b = mk(['actinia', 'cairn', 'hare'], ['kiln']);
      E.advance(b);
      const a = b.s[0].f[0], r2 = b.s[0].f[2];
      E.runMove(b, a, a.moves.indexOf('actinia_bloom'), { target: r2.idx });
      const sw = E.legal(b, 0).flatMap(x => (x.k === 'switch' ? [x.to] : []));
      if (sw.length !== 1 || sw[0] !== r2.idx) fail('called next: Take In did not make the hosted ally the only switch');
      if (E.nextInLine(b.s[0]) !== r2.idx) fail('called next: the next in line is not the hosted ally');
      a.ko = true;
      if (chooseReplacement(b, 0) !== r2.idx) fail('called next: a replacement passed over the hosted ally');
      E.replace(b, 0, r2.idx);
      if (E.calledOf(b.s[0])) fail('called next: the call stayed after the ally came out');
    }
    {
      // Revive: a knocked-out whorl comes back to its side through the engine, with a rise event for the screen.
      const b = mk(['columba', 'cairn'], ['kiln']);
      E.advance(b);
      b.quiet = false;
      const c0 = b.s[0].f[0], down = b.s[0].f[1];
      down.hp = 0; down.ko = true;
      const evs = b.ev.length;
      b.s[0].nerve = 10;
      E.runMove(b, c0, c0.moves.indexOf('columba_ring'), {});
      if (down.ko || !(down.hp > 0)) fail('revive: Ring Home did not bring the fallen whorl back');
      if (!b.ev.slice(evs).some(e => e.e === 'rise')) fail('revive: no rise event reached the screen');
    }
    {
      // Mantle: a shield over the whole side takes a hit on any of its whorls before that whorl's own shield and HP.
      const b = mk(['pallium', 'cairn'], ['kiln']);
      E.advance(b);
      const r = b.s[0].f[1], k = b.s[1].f[0];
      E.setMantle(b, 0, 500, 3);
      const hp = r.hp;
      E.dealDamage(b, k, r, 30, { kind: 'T', move: null, attack: false, dot: false, spread: false, reserve: true }, null);
      if (r.hp !== hp || !b.s[0].mantle || !(b.s[0].mantle.hp < 500)) fail(`mantle: a hit on a reserve went past the mantle (HP ${hp} to ${r.hp})`);
      const c = E.clone(b);
      c.s[0].mantle!.hp = 1;
      if (b.s[0].mantle?.hp === 1) fail('mantle: a copy shared the mantle with the battle');
    }
    {
      // Last act: a whorl with a last-act passive uses its first ready plain move once more as it falls.
      const b = mk(['scud', 'cairn'], ['kiln']);
      E.advance(b);
      const sc = b.s[0].f[0], t = b.s[1].f[0];
      t.hp = t.maxHp * 9;
      const hp = t.hp;
      E.dealDamage(b, t, sc, 999999, { kind: 'T', move: null, attack: false, dot: false, spread: false, reserve: false }, null);
      if (!sc.ko || !(t.hp < hp)) fail(`last act: Roibuki ${sc.ko ? 'fell without keeping going' : 'did not fall'}`);
    }
    {
      // Piercing: a hit from a whorl whose hooks pierce goes past the target's shield and its side's mantle to HP.
      const b = mk(['emery'], ['cairn']);
      E.advance(b);
      const e = b.s[0].f[0], t = b.s[1].f[0];
      t.hp = t.maxHp * 9;
      t.shield = 500;
      E.setMantle(b, 1, 500, 3);
      const hp = t.hp;
      E.dealDamage(b, e, t, 40, { kind: 'T', move: null, attack: false, dot: false, spread: false, reserve: false }, null);
      if (!(t.hp < hp) || t.shield !== 500 || b.s[1].mantle?.hp !== 500) fail('piercing: Scours did not go straight through the shield and the mantle');
    }
    {
      // Wedge: a side cut off from its bench cannot switch, and copies keep their own wedge.
      const b = mk(['diastema'], ['cairn', 'hare']);
      E.advance(b);
      const d = b.s[0].f[0];
      E.runMove(b, d, d.moves.indexOf('diastema_close'), {});
      if (!b.s[1].cut || E.legal(b, 1).some(a => a.k === 'switch')) fail('wedge: Get Between left the foe its switches');
      const c = E.clone(b);
      c.s[1].cut = null;
      if (!b.s[1].cut) fail('wedge: a copy shared the wedge with the battle');
    }
    {
      // Turned chart: under Silver Glass a resisted hit lands strong, in damage and in the AI's matchup.
      const { matchup } = await import('../battle/ai');
      const b = mk(['tain'], ['cairn']);
      E.advance(b);
      const t = b.s[0].f[0], c = b.s[1].f[0];
      c.hp = c.maxHp * 9;
      const hit = () => { const hp = c.hp; E.dealDamage(b, t, c, 40, { kind: 'M', move: null, attack: false, dot: false, spread: false, reserve: false }, 'VOID'); const d = hp - c.hp; c.hp = hp; return d; };
      const plain = hit(), m0 = matchup(t, c, b), eff0 = E.typeOn(b, c, 'VOID');
      E.setField(b, 'mirror', 3, t);
      const turned = hit(), m1 = matchup(t, c, b), eff1 = E.typeOn(b, c, 'VOID');
      if (!(eff0 < 1 && eff1 > 1 && turned > plain * 1.8)) fail(`turned chart: VOID on STONE went ${eff0.toFixed(2)}x to ${eff1.toFixed(2)}x (${plain} to ${turned} damage)`);
      if (!(m1 > m0)) fail('turned chart: the AI matchup did not turn with Silver Glass');
    }
    {
      // Spin: a spinning side's out whorl goes to the back after each of its turns until the spin runs out, and copies keep their own spin.
      const b = mk(['cairn'], ['cairn', 'hare', 'kiln']);
      E.advance(b);
      E.spinSide(b, 1, 2);
      const c = E.clone(b);
      c.s[1].spin = null;
      if (!b.s[1].spin) fail('spin: a copy shared the spin with the battle');
      const turn = () => { b.need = { kind: 'act', side: 1 }; b.acting = null; E.act(b, { k: 'attack' }); };
      turn();
      const one = b.s[1].out;
      turn();
      if (one !== 1 || b.s[1].out !== 2 || b.s[1].spin) fail(`spin: the foe's line went 0 to ${one} to ${b.s[1].out}, and the spin is ${b.s[1].spin ? 'still on' : 'off'}`);
    }
    {
      // Lull: a hit from a whorl whose hooks lull leaves a sleeping target asleep.
      const b = mk(['luster'], ['cairn']);
      E.advance(b);
      const d = b.s[0].f[0], t = b.s[1].f[0];
      t.hp = t.maxHp * 9;
      E.applyStatus(b, d, t, 'sleep', 2);
      E.dealDamage(b, d, t, 30, { kind: 'M', move: null, attack: false, dot: false, spread: false, reserve: false }, 'STAR');
      if (!t.s.sleep) fail('lull: a hit from Full Dark woke the sleeper');
    }
    {
      // Tide prices: a price on a side changes what its crests cost and stops one it can no longer pay for, and copies keep their own price.
      const b = mk(['groundswell'], ['cairn']);
      E.advance(b);
      const g = b.s[0].f[0], m = MOVES[g.moves[3]];
      b.s[0].nerve = m.nerve!;
      if (!E.usable(b, g, 3).ok) fail('tide prices: the crest was not usable at its own cost');
      E.setPrice(b, 0, 2, 3);
      if (E.tideCost(b, g, m) !== m.nerve! + 2 || E.usable(b, g, 3).ok) fail('tide prices: a raised price did not stop the crest');
      const c = E.clone(b);
      c.s[0].price = null;
      if (!b.s[0].price) fail('tide prices: a copy shared the price with the battle');
      E.setPrice(b, 0, -9, 3);
      if (E.tideCost(b, g, m) !== 0) fail('tide prices: a lowered price went below 0');
    }
    {
      // Snatch: a move the foe uses on itself lands on the whorl whose hook takes it, once.
      const b = mk(['tumbleweed'], ['furl']);
      E.advance(b);
      const k = b.s[0].f[0], fu = b.s[1].f[0];
      E.mark(b, k, k, 'tumbleweed_snatch', 1, 1);
      const roll = () => { b.need = { kind: 'act', side: 1 }; b.acting = null; fu.cd = fu.cd.map(() => 0); E.act(b, { k: 'move', i: fu.moves.indexOf('furl_tight') }); };
      roll();
      if (fu.shield > 0 || !(k.shield > 0)) fail('snatch: Roll Tight did not land on Kokieri');
      roll();
      if (!(fu.shield > 0)) fail('snatch: a second Roll Tight was taken too');
    }
    {
      // Height: a dash from the ground cannot reach a whorl that is up, grounds do not touch it, and a knock-down brings it down.
      const { GROUNDS } = await import('../battle/registry');
      const b = mk(['chamois'], ['swift']);
      E.advance(b);
      const ch = b.s[0].f[0], sw = b.s[1].f[0];
      sw.hp = sw.maxHp * 9;
      if (!sw.up) fail('height: Pasubame did not come out up');
      const hp = sw.hp;
      b.need = { kind: 'act', side: 0 }; b.acting = null; ch.cd = ch.cd.map(() => 0);
      E.act(b, { k: 'move', i: ch.moves.indexOf('chamois_leap') });
      if (sw.hp !== hp) fail('height: a dash from the ground reached a whorl that is up');
      E.setGround(b, 1, 'sag_pool', 3);
      if (E.hooks(sw).includes(GROUNDS.sag_pool)) fail('height: a ground touched a whorl that is up');
      E.knockDown(b, sw);
      if (sw.up || !E.hooks(sw).includes(GROUNDS.sag_pool)) fail('height: a knock-down left it up');
    }
    {
      // Parting shots: a whorl with an anyLeave hook hits a foe as it switches out, before the next one comes in.
      const b = mk(['zenith'], ['cairn', 'hare']);
      E.advance(b);
      const c0 = b.s[1].f[0];
      c0.hp = c0.maxHp * 9;
      const hp = c0.hp;
      E.doSwitch(b, 1, 1);
      if (!(c0.hp < hp) || b.s[1].out !== 1) fail('parting shots: Huipki did not fire at the whorl that left');
    }
    {
      // Through: a hole sends a foe's one-target move on to the user's own next reserve.
      const b = mk(['ostium'], ['cairn', 'hare']);
      E.advance(b);
      const o = b.s[0].f[0], c0 = b.s[1].f[0], h = b.s[1].f[1];
      o.hp = o.maxHp * 9; h.hp = h.maxHp * 9;
      E.mark(b, o, o, 'ostium_hole', 1, 1);
      const ho = o.hp, hh = h.hp;
      b.need = { kind: 'act', side: 1 }; b.acting = null; c0.cd = c0.cd.map(() => 0);
      E.act(b, { k: 'move', i: c0.moves.indexOf('topple') });
      if (o.hp !== ho || !(h.hp < hh)) fail('through: Top Stone did not go through to the foe\'s own reserve');
    }
    {
      // Round start: a roundStart hook runs once as each new round opens, from the bench too.
      const b = mk(['cairn', 'albatross'], ['hare']);
      const h = b.s[1].f[0];
      h.hp = h.maxHp * 9;
      const hp = h.hp;
      E.advance(b);
      if (!(h.hp < hp)) fail('round start: the bird did not dive from the bench as the first round opened');
      const seen = b.roundSeen, hp2 = h.hp;
      E.advance(b);
      if (b.roundSeen !== seen || h.hp !== hp2) fail('round start: the hooks ran twice in one round');
    }
    {
      // Order shift: a hook that shifts a move's order class makes a plain move Late in a joint round.
      const b = mk(['eelgrass'], ['cairn']);
      E.advance(b);
      const c0 = b.s[1].f[0], i = c0.moves.indexOf('topple');
      if (E.tierOf(b, 1, { k: 'move', i }) !== 0) fail('order shift: Top Stone was not a plain move to begin with');
      E.mark(b, b.s[0].f[0], c0, 'eelgrass_tangled', 1, 2);
      if (E.tierOf(b, 1, { k: 'move', i }) !== -1) fail('order shift: a tangled foe\'s move did not go Late');
    }
    {
      // Volley: a hook that makes the Attack a volley fires one shot per Arm, and fewer once an Arm comes off.
      const b = mk(['asterias'], ['cairn']);
      E.advance(b);
      const a = b.s[0].f[0], t = b.s[1].f[0];
      t.hp = t.maxHp * 9;
      b.quiet = false;
      const shots = () => { const from = b.ev.length; E.doAttack(b, a, t); return b.ev.slice(from).filter(e => e.e === 'dmg' && e.side === 1).length; };
      const five = shots();
      a.k.arms = 3;
      const three = shots();
      b.quiet = true;
      if (five !== 5 || three !== 3) fail(`volley: Tahtode's Attack fired ${five} then ${three} shots, not 5 then 3`);
    }
    {
      // Per-Attack habits: a habit that triggers after an Attack fires once for a whole volley, and a per-hit habit fires on every shot.
      const b = mk(['asterias'], ['cairn']);
      E.advance(b);
      const a = b.s[0].f[0], t = b.s[1].f[0];
      t.hp = t.maxHp * 9;
      a.mon = { ...a.mon, passives: [...a.mon.passives, 'hart_rutseason', 'fleam_lodged'] };
      E.doAttack(b, a, t);
      if (a.k.punch !== 1) fail(`per-Attack habits: a 5-shot Attack counted ${a.k.punch} attacks for Rut Season, not 1`);
      if (E.marked(t, 'fleam_spear') !== 5) fail(`per-Attack habits: a 5-shot Attack lodged ${E.marked(t, 'fleam_spear')} Blades, not 1 per hit`);
    }
    {
      // Room swap: the two sides trade their grounds, summons, and side states, and each whorl's ground follows its side.
      const b = mk(['sluice'], ['cairn']);
      E.advance(b);
      const m = b.s[0].f[0], c0 = b.s[1].f[0];
      E.setGround(b, 0, 'sag_pool', 3, m);
      E.summon(b, c0, 'cairn_barrier', { hp: 0.1 });
      E.setPrice(b, 1, 2, 3);
      E.swapRooms(b);
      if (b.s[1].ground?.id !== 'sag_pool' || b.s[0].ground || c0.gnd !== 'sag_pool' || m.gnd) fail('room swap: the ground did not move across');
      if (!b.s[0].sum.some(u => u.def === 'cairn_barrier') || b.s[1].sum.length) fail('room swap: the summon did not move across');
      if (b.s[0].price?.add !== 2 || b.s[1].price) fail('room swap: the price did not move across');
    }
    {
      // Kept moment: a sealed whorl goes back to its HP, statuses, and marks when the moment comes due, and copies keep their own seal.
      const b = mk(['vacuole'], ['cairn']);
      E.advance(b);
      const t = b.s[1].f[0], half = Math.round(t.maxHp * 0.5);
      t.hp = half;
      E.keepMoment(t);
      const c = E.clone(b);
      t.hp = t.maxHp;
      E.applyStatus(b, null, t, 'empower', 2);
      if (!c.s[1].f[0].kept || c.s[1].f[0].kept === t.kept) fail('kept moment: a copy shared the seal with the battle');
      E.returnToMoment(b, t);
      if (t.hp !== half || t.s.empower || t.kept) fail('kept moment: the whorl did not go back to how it stood');
    }
    {
      // Star catch: a whorl whose hook catches a falling star takes all of its tide for its side, and a called star is counted.
      const b = mk(['spoor'], ['cairn']);
      E.advance(b);
      b.s[0].nerve = 0; b.s[1].nerve = 0;
      E.starFall(b, true);
      if (b.s[0].nerve !== 4 || b.s[1].nerve !== 0 || b.starsCalled !== 1) fail(`star catch: the star gave ${b.s[0].nerve} and ${b.s[1].nerve} tide`);
    }
    {
      // Glare: a hook on the attacker's side keeps its hits from landing strong, after the target's own hooks.
      const b = mk(['albedo'], ['cairn']);
      E.advance(b);
      const a = b.s[0].f[0], c0 = b.s[1].f[0];
      const before = E.typeOn(b, a, 'TIDE', undefined, c0);
      E.mark(b, a, c0, 'albedo_glare', 1, 3);
      const after = E.typeOn(b, a, 'TIDE', undefined, c0);
      if (!(before > 1 && after === 1)) fail(`glare: a TIDE hit on Shidor went from ${before.toFixed(2)}x to ${after.toFixed(2)}x`);
    }
    {
      // Low Water: while the sea is out attacks gain no tide, and copies keep their own Low Water.
      const b = mk(['medusa'], ['cairn']);
      E.advance(b);
      const m = b.s[0].f[0], c0 = b.s[1].f[0];
      E.setLowWater(b, 3);
      const c = E.clone(b);
      c.lowWater = null;
      if (!b.lowWater) fail('low water: a copy shared it with the battle');
      c0.hp = c0.maxHp * 9;
      b.s[0].nerve = 0;
      E.doAttack(b, m, c0);
      if (b.s[0].nerve !== 0) fail('low water: an attack gained tide');
    }
    {
      // Status draw: a status a foe puts on itself goes into the whorl whose hook draws it, once, and never into a draw again.
      const b = mk(['hopper'], ['cairn']);
      E.advance(b);
      const h = b.s[0].f[0], c0 = b.s[1].f[0];
      E.applyStatus(b, c0, c0, 'empower', 2);
      if (c0.s.empower || !h.s.empower) fail('status draw: the foe kept its own Empower');
      E.applyStatus(b, c0, h, 'weaken', 1);
      if (!h.s.weaken) fail('status draw: a status aimed at Kidedan itself went astray');
    }
    {
      // Status watch: a whorl whose hook hears every status takes a turn of a good status another whorl gains.
      const b = mk(['magpie'], ['cairn']);
      E.advance(b);
      const m = b.s[0].f[0], c0 = b.s[1].f[0];
      E.applyStatus(b, c0, c0, 'empower', 2);
      if (!c0.s.empower || !m.s.empower) fail('status watch: Picagi did not take a turn of the foe\'s Empower');
    }
    {
      // True sight: a whorl whose hook finds hidden foes hits a Hidden target that any other hit would miss.
      const b = mk(['strombus'], ['cairn']);
      E.advance(b);
      const s0 = b.s[0].f[0], c0 = b.s[1].f[0];
      c0.hp = c0.maxHp * 9;
      E.applyStatus(b, c0, c0, 'hidden', 2);
      const hp = c0.hp;
      E.dealDamage(b, s0, c0, 40, { kind: 'P', move: null, attack: true, dot: false, spread: false, reserve: false }, 'BEAST');
      if (!c0.s.hidden && !(c0.hp < hp)) fail('true sight: the foe was never hidden');
      if (!(c0.hp < hp)) fail('true sight: Masilma missed a hidden foe');
    }
    {
      // Status turn: each status with an opposite turns into it and keeps its turns.
      const b = mk(['surf'], ['cairn']);
      E.advance(b);
      const c0 = b.s[1].f[0];
      E.applyStatus(b, c0, c0, 'empower', 3);
      E.turnStatuses(b, b.s[0].f[0], c0);
      if (c0.s.empower || c0.s.weaken?.n !== 3) fail('status turn: Empower 3 did not turn into Weaken 3');
    }
    {
      // Roll in: a reserve whose hook says so rolls out in front of a foe's crest and takes it.
      const b = mk(['cairn', 'blush'], ['squall']);
      E.advance(b);
      const q = b.s[1].f[0], c0 = b.s[0].f[0], hp = c0.hp;
      const ci = q.moves.findIndex(id => !!MOVES[id].nerve && !MOVES[id].wu);
      if (ci < 0) fail('roll in: the foe has no crest to use');
      b.s[1].nerve = 10; q.cd[ci] = 0;
      b.need = { kind: 'act', side: 1 }; b.acting = null;
      E.act(b, { k: 'move', i: ci });
      if (b.s[0].out !== 1 || c0.hp !== hp) fail('roll in: Shinmi stayed in reserve when the foe used a crest');
    }
    {
      // Deafness: the foe across a whorl that deafens hears nothing others do, so its passives do not answer them.
      const heard = (kind: string) => {
        const b = mk([kind], ['flange']);
        E.advance(b);
        const fl = b.s[1].f[0];
        fl.hp = fl.maxHp * 9;
        b.need = { kind: 'act', side: 0 }; b.acting = null;
        E.act(b, { k: 'move', i: 0 });
        return { deaf: E.deaf(b, fl), wider: E.marked(fl, 'flange_open') };
      };
      const loud = heard('hare'), quiet = heard('lull');
      if (loud.deaf || loud.wider !== 1) fail(`deafness: Laibiru should hear Hind Kick (deaf ${loud.deaf}, wider ${loud.wider})`);
      if (!quiet.deaf || quiet.wider !== 0) fail(`deafness: Laibiru should not hear Shh across Hilzuka (deaf ${quiet.deaf}, wider ${quiet.wider})`);
    }
    {
      // Measure: a side that measures chooses after the foe's action, inside the same round, from its own turn time.
      const setup = (z: string) => {
        const b = mk(['astrolabe'], [z]);
        for (const s of b.s) for (const f of s.f) f.hp = f.maxHp * 9;
        if (E.advance(b).kind !== 'joint') fail('measure: the test needs a joint round');
        return b;
      };
      const a = setup('cairn'), plain = E.clone(a);
      if (!E.legal(a, 0).some(x => x.k === 'wait') || E.legal(a, 1).some(x => x.k === 'wait')) fail('measure: only the Astrolabe should be offered Measure');
      const hp = a.s[0].f[0].hp;
      E.actJoint(a, { k: 'wait' }, { k: 'attack' });
      const d = E.advance(a);
      if (d.kind !== 'act' || d.side !== 0 || a.waited !== 0) fail('measure: the measuring side was not asked to choose');
      if (!(a.s[0].f[0].hp < hp)) fail('measure: the foe had not acted before the measured choice');
      if (E.clone(a).waited !== 0) fail('measure: a copy lost the measured pause');
      if (E.foeChoice(a, a.s[1].f[0])?.k !== 'wait') fail('measure: a read of the waiting side did not see it wait');
      const n = a.rnd?.n;
      E.act(a, { k: 'attack' });
      if (a.rnd?.n !== n || !a.rnd?.done[0]) fail('measure: the measured action did not resolve in the same round');
      if (a.waited !== null || a.turnBase !== null) fail('measure: the pause was not cleared');
      if (E.foeChoice(a, a.s[1].f[0])?.k !== 'attack') fail('measure: the round did not take the measured action as its choice');
      E.actJoint(plain, { k: 'attack' }, { k: 'attack' });
      E.advance(plain);
      if (a.s[0].next !== plain.s[0].next) fail(`measure: its next turn moved (${a.s[0].next} measured, ${plain.s[0].next} plain)`);
      // A stun or a knockout from the foe's action skips the measured choice.
      const st = setup('cairn');
      E.actJoint(st, { k: 'wait' }, { k: 'attack' });
      E.applyStatus(st, st.s[1].f[0], st.s[0].f[0], 'stun', 1);
      const ds = E.advance(st);
      if (ds.kind === 'act' && ds.side === 0 && st.waited === 0) fail('measure: a stunned Astrolabe still chose');
      const ko = setup('cairn');
      ko.s[0].f[0].hp = 1;
      E.actJoint(ko, { k: 'wait' }, { k: 'attack' });
      E.advance(ko);
      if (ko.over !== 1 || ko.waited === 0) fail('measure: a knocked-out Astrolabe still chose');
      // Both sides measuring learn nothing: the round opens again without Measure.
      const both = setup('astrolabe');
      E.actJoint(both, { k: 'wait' }, { k: 'wait' });
      if (both.need?.kind !== 'joint' || E.legal(both, 0).some(x => x.k === 'wait')) fail('measure: two measures did not reopen the round without Measure');
      E.actJoint(both, { k: 'attack' }, { k: 'attack' });
      if (both.measureOff) fail('measure: Measure stayed off after the reopened round');
    }
    {
      // Pink tide: tide a side holds that cannot pay for a crest until it runs clear, and copies keep their own.
      const b = mk(['cairn'], ['cairn']);
      E.advance(b);
      const c0 = b.s[1].f[0], ci = c0.moves.findIndex(id => !!MOVES[id].nerve);
      c0.cd[ci] = 0;
      b.s[1].nerve = 6;
      if (!E.usable(b, c0, ci).ok) fail('pink tide: the test crest should be usable on clear tide');
      E.pinkTide(b, 1, 3, 2);
      const u = E.usable(b, c0, ci);
      if (E.pinkOf(b, 1) !== 3 || u.ok || u.why !== 'Not enough clear tide.') fail(`pink tide: a crest was paid for with pink tide (pink ${E.pinkOf(b, 1)}, ok ${u.ok}, why ${u.why})`);
      const c = E.clone(b);
      c.s[1].pink = null;
      if (!b.s[1].pink) fail('pink tide: a copy shared the pink tide');
      E.addNerve(b, 1, -4);
      if (E.pinkOf(b, 1) !== 2 || b.s[1].pink?.n !== 2) fail('pink tide: a side held more pink tide than tide');
      E.clearPink(b, 1);
      if (b.s[1].pink) fail('pink tide: it did not run clear');
    }
    {
      // Bearing: a whorl whose own hook keeps a bearing lands its one-target moves on that foe, even in reserve.
      const b = mk(['lodestar'], ['cairn', 'hare']);
      E.advance(b);
      const l = b.s[0].f[0], c0 = b.s[1].f[0], h = b.s[1].f[1];
      for (const f of [c0, h]) f.hp = f.maxHp * 9;
      E.mark(b, l, l, 'lodestar_point', 1, 3, 1 * 8 + c0.idx + 1);
      E.doSwitch(b, 1, h.idx);
      if (E.aimOf(b, l) !== c0) fail('bearing: the bearing did not point at the foe that switched out');
      const hp = c0.hp, hh = h.hp;
      b.need = { kind: 'act', side: 0 }; b.acting = null;
      E.act(b, { k: 'move', i: 0 });
      if (!(c0.hp < hp) || h.hp !== hh) fail(`bearing: the hit should land on the foe in reserve (${hp}->${c0.hp}, out foe ${hh}->${h.hp})`);
    }
    {
      // Bearing the weight: a reserve that bears takes its share of a hit on the out whorl, down to 1 HP of its own.
      const b = mk(['hare', 'plinth'], ['cairn']);
      E.advance(b);
      const h = b.s[0].f[0], pl = b.s[0].f[1], c0 = b.s[1].f[0];
      h.hp = h.maxHp * 9;
      const info = { kind: 'T' as const, move: null, attack: false, dot: false, spread: false, reserve: false };
      const hp = h.hp, php = pl.hp;
      E.dealDamage(b, c0, h, 100, info, null);
      if (php - pl.hp !== 30 || hp - h.hp !== 70) fail(`bearing the weight: Daista should bear 30 of 100 (bore ${php - pl.hp}, out whorl took ${hp - h.hp})`);
      pl.hp = 1;
      const hp2 = h.hp;
      E.dealDamage(b, c0, h, 100, info, null);
      if (pl.hp !== 1 || hp2 - h.hp !== 100) fail('bearing the weight: a bearer at 1 HP still bore');
    }
    {
      // Taking in: a whorl's next attack is held and lands later, and it never comes back out if the whorl has left.
      const run = (leave: boolean) => {
        const b = mk(['hare', 'cairn'], ['cairn']);
        E.advance(b);
        const h = b.s[0].f[0], c0 = b.s[1].f[0];
        for (const f of [...b.s[0].f, c0]) f.hp = f.maxHp * 9;
        E.takeIn(b, h, 50);
        const hp = c0.hp;
        b.need = { kind: 'act', side: 0 }; b.acting = null;
        E.act(b, { k: 'attack' });
        const held = b.pend.some(p => p.kind === 'held') && c0.hp === hp;
        if (leave) E.doSwitch(b, 0, 1);
        // Everyone stands still while the held attack waits, so only it can touch the foe.
        for (const f of [...b.s[0].f, c0]) f.s.stun = { n: 9, src: -1 };
        for (let i = 0; i < 12 && b.pend.some(p => p.kind === 'held'); i++) { const d = E.advance(b); if (d.kind !== 'act' && d.kind !== 'joint') break; }
        return { held, landed: c0.hp < hp };
      };
      const stay = run(false), gone = run(true);
      if (!stay.held) fail('taking in: the attack landed at once');
      if (!stay.landed) fail('taking in: the held attack never came back out');
      if (gone.landed) fail('taking in: a held attack came back out after its whorl left');
    }
    {
      // Shaken wind-ups: a whorl that hears a wind-up start can push it later on the timeline.
      const lands = (kind: string) => {
        const b = mk([kind], ['cairn']);
        E.advance(b);
        const c0 = b.s[1].f[0], ci = c0.moves.findIndex(id => !!MOVES[id].wu);
        c0.cd[ci] = 0; b.s[1].nerve = 10;
        b.need = { kind: 'act', side: 1 }; b.acting = null;
        const t0 = b.t;
        E.act(b, { k: 'move', i: ci });
        const p = b.pend.find(x => x.kind === 'windup');
        return p ? p.at - t0 : -1;
      };
      const plain = lands('hare'), shaken = lands('tor');
      if (plain < 0 || shaken - plain !== 30) fail(`shaken wind-ups: Kumpuka should push the wind-up 30 later (${plain} plain, ${shaken} shaken)`);
    }
    {
      // Bench fog: nothing from the other side reaches a fogged side's reserves, and the out whorl is still hit.
      const b = mk(['hare', 'cairn'], ['cairn']);
      E.advance(b);
      const h = b.s[0].f[0], r = b.s[0].f[1], c0 = b.s[1].f[0];
      for (const f of [h, r]) f.hp = f.maxHp * 9;
      E.fogBench(b, 0, 2);
      const info = { kind: 'T' as const, move: null, attack: false, dot: false, spread: true, reserve: true };
      const rh = r.hp, hh = h.hp;
      E.dealDamage(b, c0, r, 50, info, null);
      E.applyStatus(b, c0, r, 'poison', 2);
      E.dealDamage(b, c0, h, 50, { ...info, reserve: false }, null);
      if (r.hp !== rh || r.s.poison) fail('bench fog: a hit or a status reached a fogged reserve');
      if (!(h.hp < hh)) fail('bench fog: the out whorl was hidden too');
      const c = E.clone(b);
      c.s[0].fog = null;
      if (!b.s[0].fog) fail('bench fog: a copy shared the fog');
    }
    {
      // Washing over: a knockout blow's rest lands on the next foe out.
      const b = mk(['bore'], ['cairn', 'hare']);
      E.advance(b);
      const bo = b.s[0].f[0], c0 = b.s[1].f[0], h = b.s[1].f[1];
      c0.hp = 10;
      const hh = h.hp;
      E.dealDamage(b, bo, c0, 60, { kind: 'T', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      if (!c0.ko) fail('washing over: the test blow did not knock the foe out');
      b.need = null;
      E.advance(b, (bb, side) => (side === 1 ? h.idx : -1));
      if (!(h.hp < hh)) fail('washing over: the rest of the blow did not wash over the next foe out');
    }
    {
      // Dizziness: a dizzy whorl's picked move comes out of the next slot.
      const b = mk(['cairn'], ['hare']);
      E.advance(b);
      const c0 = b.s[0].f[0], h = b.s[1].f[0];
      h.hp = h.maxHp * 9;
      c0.cd = c0.cd.map(() => 0);
      E.mark(b, h, c0, 'eddy_dizzy', 1, 2);
      b.need = { kind: 'act', side: 0 }; b.acting = null;
      E.act(b, { k: 'move', i: 0 });
      if (c0.cd[0] !== 0 || !(c0.cd[1] > 0)) fail(`dizziness: Top Stone should have come out as Little Cairn (cooldowns ${c0.cd.join(',')})`);
    }
    {
      // Sticky marks: a sticky mark on a whorl that switches out lands on the whorl that comes in.
      const b = mk(['burr'], ['cairn', 'hare']);
      E.advance(b);
      const bu = b.s[0].f[0], c0 = b.s[1].f[0], h = b.s[1].f[1];
      E.mark(b, bu, c0, 'burr_sap', 2, 4);
      E.doSwitch(b, 1, h.idx);
      if (E.marked(c0, 'burr_sap') || E.marked(h, 'burr_sap') !== 2) fail(`sticky marks: the Hooks should move to the whorl that came in (left ${E.marked(c0, 'burr_sap')}, came ${E.marked(h, 'burr_sap')})`);
    }
    {
      // Spored moves: using a spored move poisons its user.
      const b = mk(['cairn'], ['hare']);
      E.advance(b);
      const c0 = b.s[0].f[0], h = b.s[1].f[0];
      h.hp = h.maxHp * 9;
      c0.cd = c0.cd.map(() => 0);
      E.sporeMove(b, c0, 0, 3);
      b.need = { kind: 'act', side: 0 }; b.acting = null;
      E.act(b, { k: 'move', i: 0 });
      if (!c0.s.poison) fail('spored moves: a spored move did not poison its user');
    }
    {
      // Orbits: a Planet steps one foe along each time its setter's side ends a turn, wraps round, and comes down after 3 steps.
      const b = mk(['orrery'], ['cairn', 'hare', 'kiln']);
      E.advance(b);
      const o = b.s[0].f[0], z = b.s[1].f;
      for (const f of z) f.hp = f.maxHp * 9;
      E.mark(b, o, z[0], 'orrery_planet', 1, 3);
      b.turnNo++;
      E.stepOrbits(b, 0);
      if (!E.marked(z[1], 'orrery_planet') || E.marked(z[0], 'orrery_planet')) fail('orbits: the Planet did not move from the out foe to the first reserve');
      const hp2 = z[2].hp;
      E.stepOrbits(b, 0);
      if (!E.marked(z[2], 'orrery_planet') || !(z[2].hp < hp2)) fail('orbits: the Planet did not reach the second reserve and hit it');
      const hp0 = z[0].hp;
      E.stepOrbits(b, 0);
      if (E.marked(z[0], 'orrery_planet') || !(z[0].hp < hp0)) fail('orbits: the Planet did not wrap round to the out foe and come down after 3 steps');
      E.mark(b, o, z[0], 'orrery_planet', 1, 3);
      E.stepOrbits(b, 0);
      if (!E.marked(z[0], 'orrery_planet')) fail('orbits: a Planet set this turn moved before its setter\'s side ended a later turn');
      E.stepOrbits(b, 1);
      if (!E.marked(z[0], 'orrery_planet')) fail('orbits: the other side\'s turn moved the Planet');
    }
    {
      // Range: Near makes a dash land harder and Far a projectile, and a switch ends it.
      const b = mk(['piston'], ['cairn', 'hare']);
      E.advance(b);
      const dmg = (at: 'near' | 'far' | null, tag: string) => {
        const cb = E.clone(b);
        if (at) E.setRange(cb, at);
        const t = cb.s[1].f[0], hp = (t.hp = t.maxHp * 9);
        E.dealDamage(cb, cb.s[0].f[0], t, 100, { kind: 'P', move: { ...MOVES.drive, tags: [tag] } as typeof MOVES.drive, attack: false, dot: false, spread: false, reserve: false }, null);
        return hp - t.hp;
      };
      const even = dmg(null, 'dash');
      if (!(dmg('near', 'dash') > even && dmg('far', 'dash') < even)) fail('range: Near should raise a dash and Far lower it');
      if (!(dmg('far', 'projectile') > dmg('near', 'projectile'))) fail('range: Far should favor a projectile over Near');
      E.setRange(b, 'near');
      E.doSwitch(b, 1, 1);
      if (E.rangeOf(b) !== null) fail('range: a switch did not end the range');
    }
    {
      // Contact marks: a dash or an Attack carries Charges across, another hit does not, and a foe that reaches 3 is stunned.
      const b = mk(['dynamo'], ['cairn', 'hare']);
      E.advance(b);
      const d = b.s[0].f[0], c0 = b.s[1].f[0];
      c0.hp = c0.maxHp * 9;
      if (E.marked(d, 'dynamo_charge') !== 2) fail(`contact marks: Virtaki should start with 2 Charges (has ${E.marked(d, 'dynamo_charge')})`);
      E.dealDamage(b, c0, d, 10, { kind: 'P', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      if (E.marked(d, 'dynamo_charge') || E.marked(c0, 'dynamo_charge') !== 2) fail('contact marks: an Attack on Virtaki did not carry its Charges to the attacker');
      E.dealDamage(b, d, c0, 10, { kind: 'M', move: null, attack: false, dot: false, spread: false, reserve: false }, null);
      if (E.marked(c0, 'dynamo_charge') !== 2) fail('contact marks: a hit with no contact moved the Charges');
      E.addCharge(b, d, c0);
      if (E.marked(c0, 'dynamo_charge') || !c0.s.stun) fail('contact marks: a foe at 3 Charges was not stunned');
    }
    {
      // Latching: a whorl leaves its side to ride a foe and drinks from it, its side sends another out, and once full it lets go and comes back.
      const b = mk(['leech', 'cairn'], ['hare', 'kiln']);
      E.advance(b);
      const l = b.s[0].f[0], h = b.s[1].f[0];
      h.hp = h.maxHp * 9;
      l.hp = Math.round(l.maxHp * 0.5);
      const hp0 = h.hp, mine = l.hp;
      if (!E.latchOn(b, l, h, 3)) fail('latching: the leech could not latch on');
      if (!l.gone || E.latchHost(b, l) !== h || !(h.hp < hp0) || !(l.hp > mine)) fail('latching: the leech did not leave its side and drink once');
      const pick = (bb: ReturnType<typeof mk>, side: 0 | 1) => (side === 0 ? 1 : -1);
      b.need = null;
      E.advance(b, pick);
      if (b.s[0].out !== 1) fail('latching: its side did not send the next whorl out');
      l.hp = l.maxHp;
      for (let i = 0; i < 8 && l.gone; i++) {
        const d = E.advance(b, pick);
        if (d.kind === 'joint') round(b, { k: 'guard' }, { k: 'guard' });
        else if (d.kind === 'act') E.act(b, { k: 'guard' });
        else break;
      }
      if (l.gone || l.latch) fail('latching: a full leech did not let go and come back');
    }
    {
      // Flock: a one-target hit fells one body at most, and a spread hit is not held back.
      const b = mk(['carrion'], ['cairn']);
      E.advance(b);
      const cr = b.s[0].f[0], c0 = b.s[1].f[0];
      cr.hp = cr.maxHp;
      E.setFlock(b, cr, 4, 3);
      const body = cr.flock?.body || 0, hp0 = cr.hp;
      E.dealDamage(b, c0, cr, cr.maxHp * 3, { kind: 'T', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      if (!body || hp0 - cr.hp > body || E.bodiesOf(cr) !== 3) fail(`flock: a one-target hit took ${hp0 - cr.hp} from a flock with bodies of ${body}`);
      const hp1 = cr.hp;
      E.dealDamage(b, c0, cr, body * 1.5, { kind: 'T', move: null, attack: false, dot: false, spread: true, reserve: false }, null);
      if (!(hp1 - cr.hp > body)) fail('flock: a spread hit was held to one body');
    }
    {
      // Bout: neither boxer can switch, a round goes to the one that dealt the other more, and 2 rounds win it.
      const b = mk(['hare', 'cairn'], ['cairn', 'kiln']);
      E.advance(b);
      const h = b.s[0].f[0], c0 = b.s[1].f[0];
      h.hp = h.maxHp * 9; c0.hp = c0.maxHp * 9;
      if (!E.startBout(b, h, c0, 3)) fail('bout: the bout did not start');
      if (E.canSwitch(b, h) || E.canSwitch(b, c0)) fail('bout: a boxer could switch');
      const hit = () => E.dealDamage(b, h, c0, 50, { kind: 'T', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      hit();
      E.boutRound(b);
      if (b.bout?.score[0] !== 1) fail('bout: the round did not go to the one that dealt more');
      hit();
      E.boutRound(b);
      if (b.bout || !h.s.empower || !c0.s.stun) fail('bout: winning 2 rounds did not end the bout with Empower for the winner and Stun for the loser');
    }
    {
      // Afterglow: a fallen halo glows on, keeps its place among its side's aura holders, and heals its side's out whorl.
      const b = mk(['halo', 'kiln'], ['cairn']);
      E.advance(b);
      const h = b.s[0].f[0], k1 = b.s[0].f[1], z = b.s[1].f[0];
      z.hp = z.maxHp * 9;
      E.dealDamage(b, z, h, h.hp + h.shield + 10, { kind: 'T', move: null, attack: false, dot: false, spread: false, reserve: false }, null);
      if (!h.ko || !h.glow || h.glow.turns !== 3) fail('afterglow: the fallen halo did not glow on');
      b.need = null;
      k1.hp = Math.round(k1.maxHp / 2);
      const before = k1.hp, pick = (bb: ReturnType<typeof mk>, side: 0 | 1) => (side === 0 ? 1 : -1);
      for (let i = 0; i < 6 && k1.hp <= before; i++) {
        const d = E.advance(b, pick);
        if (d.kind === 'joint') round(b, { k: 'guard' }, { k: 'guard' });
        else if (d.kind === 'act') E.act(b, { k: 'guard' });
        else break;
      }
      if (!(k1.hp > before)) fail('afterglow: the glow did not heal its side\'s out whorl');
      if (h.glow && !E.auraHolders(b.s[0]).includes(h)) fail('afterglow: a glowing fallen whorl was not among its side\'s aura holders');
    }
    {
      // Overdrive: a cooling move can be used by paying HP for each turn it has left, and a whorl without the hook still waits.
      const b = mk(['flare'], ['cairn']);
      E.advance(b);
      const f = b.s[0].f[0], z = b.s[1].f[0];
      z.hp = z.maxHp * 9;
      const i = f.moves.indexOf('sear');
      f.cd = f.cd.map(() => 0);
      f.cd[i] = 2;
      const cost = E.overdriveCost(b, f, i), want = Math.round(f.maxHp * 0.08 * 2);
      if (cost !== want || !E.usable(b, f, i).ok) fail(`overdrive: a cooling Sunspot should cost ${want} HP (got ${cost})`);
      const hp = f.hp;
      b.need = { kind: 'act', side: 0 }; b.acting = null;
      E.act(b, { k: 'move', i });
      if (!(f.hp <= hp - cost)) fail('overdrive: the move did not take its HP');
      const c2 = mk(['cairn'], ['cairn']);
      E.advance(c2);
      const k = c2.s[0].f[0];
      k.cd[0] = 2;
      if (E.usable(c2, k, 0).ok) fail('overdrive: a cooling move worked without the hook');
    }
    {
      // Coming due: Burn, Poison, and Seeds land at once, Regen heals in one go, and a whorl with nothing waiting takes nothing.
      const b = mk(['dandle'], ['cairn']);
      E.advance(b);
      const d = b.s[0].f[0], z = b.s[1].f[0];
      z.hp = z.maxHp * 9;
      if (!E.applyStatus(b, d, z, 'burn', 3, 20) || !E.applyStatus(b, d, z, 'poison', 2)) fail('coming due: the foe would not take Burn and Poison');
      const due = E.dueOf(z), want = Math.round(60 + z.maxHp * 0.09);
      if (due !== want) fail(`coming due: Burn 3 at 20 and Poison 2 should have ${want} waiting (got ${due})`);
      E.mark(b, d, z, 'dandle_seed', 2, 2);
      const bare = E.clone(b), bz = bare.s[1].f[0];
      E.unmark(bz, 'dandle_seed');
      const hp0 = z.hp;
      E.comeDue(b, d, z);
      E.comeDue(bare, bare.s[0].f[0], bz);
      if (z.s.burn || z.s.poison || E.marked(z, 'dandle_seed')) fail('coming due: a Burn, Poison, or Seed was left waiting');
      if (!(hp0 - bz.hp > 0 && hp0 - z.hp > hp0 - bz.hp)) fail('coming due: the damage over time and the Seeds did not all land');
      d.hp = Math.round(d.maxHp / 2);
      E.applyStatus(b, d, d, 'regen', 3, 0.1);
      const mine = d.hp;
      E.comeDue(b, z, d);
      if (d.s.regen || d.hp - mine !== Math.round(d.maxHp * 0.3)) fail(`coming due: Regen 3 should heal 30% at once (healed ${d.hp - mine})`);
      const hp1 = d.hp;
      E.comeDue(b, z, d);
      if (d.hp !== hp1) fail('coming due: a whorl with nothing waiting lost HP');
    }
    {
      // Poise: a foe's Stun, Root, and Slow fail while it holds, hits wear it down, and breaking it stuns the holder.
      const b = mk(['wain'], ['cairn']);
      E.advance(b);
      const w = b.s[0].f[0], z = b.s[1].f[0];
      w.hp = w.maxHp * 9;
      E.addPoise(b, w, 0.1, 0.3);
      E.addPoise(b, w, 0.3, 0.3);
      if (w.poise !== Math.round(w.maxHp * 0.3)) fail(`poise: it should stop at its cap of 30% (has ${w.poise})`);
      if (E.applyStatus(b, z, w, 'stun', 1) || E.applyStatus(b, z, w, 'root', 2) || E.applyStatus(b, z, w, 'slow', 1)) fail('poise: a foe\'s Stun, Root, or Slow landed through it');
      if (!E.applyStatus(b, z, w, 'weaken', 1)) fail('poise: a status it does not stop was turned away');
      const p = w.poise || 0;
      const hit = (n: number) => E.dealDamage(b, z, w, n, { kind: 'T', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      hit(10);
      if (w.poise !== p - 10) fail(`poise: a hit of 10 should wear it to ${p - 10} (has ${w.poise})`);
      hit(p);
      if (w.poise || !w.s.stun) fail('poise: a hit that broke it did not leave the holder Stunned');
    }
    {
      // Cold storage: a stored reserve cannot be reached by the other side or brought out, its cooldowns wait, and it heals until it comes back out.
      const b = mk(['cellar', 'kiln', 'hare'], ['cairn']);
      E.advance(b);
      const r = b.s[0].f[1], z = b.s[1].f[0];
      r.hp = Math.round(r.maxHp / 2);
      r.cd[1] = 3;
      if (!E.storeAway(b, r, 2, 0.1)) fail('cold storage: a reserve could not be stored');
      const hp0 = r.hp;
      E.dealDamage(b, z, r, 50, { kind: 'T', move: null, attack: false, dot: false, spread: true, reserve: true }, null);
      if (r.hp !== hp0 || E.applyStatus(b, z, r, 'poison', 2)) fail('cold storage: the other side reached a stored reserve');
      if (!E.barred(r) || E.dragIn(b, z, 0, 1)) fail('cold storage: a stored reserve could be brought out');
      b.need = null;
      const pick = (bb: ReturnType<typeof mk>, side: 0 | 1) => (side === 0 ? 2 : -1);
      for (let i = 0; i < 8 && r.stored; i++) {
        const d = E.advance(b, pick);
        if (d.kind === 'joint') round(b, { k: 'guard' }, { k: 'guard' });
        else if (d.kind === 'act') E.act(b, { k: 'guard' });
        else break;
      }
      const healed = 2 * Math.round(r.maxHp * 0.1);
      if (r.stored || r.hp !== hp0 + healed || r.cd[1] !== 2) fail(`cold storage: after 2 turns it should be out of storage with ${hp0 + healed} HP and its cooldown at 2 (has ${r.hp} HP, cooldown ${r.cd[1]})`);
    }
    {
      // Shut in: a side shut in switches after the other side's action, so the attack lands on the whorl that was out.
      const b = mk(['cairn', 'hare'], ['cairn', 'hare']);
      if (E.advance(b).kind !== 'joint') fail('shut in: two equal whorls do not open with a joint round');
      E.shutIn(b, 1, 2);
      if (E.tierOf(b, 1, { k: 'switch', to: 1 }) !== -1 || E.tierOf(b, 0, { k: 'switch', to: 1 }) !== 2) fail('shut in: only the shut side should switch Late');
      const first = b.s[1].f[0], second = b.s[1].f[1], hp0 = first.hp, hp1 = second.hp;
      round(b, { k: 'attack' }, { k: 'switch', to: 1 });
      if (first.hp >= hp0 || second.hp !== hp1 || b.s[1].out !== 1) fail(`shut in: the attack should land on the whorl that was out before it switched (${hp0}->${first.hp}, ${hp1}->${second.hp})`);
      const c = E.clone(b);
      if (!c.s[1].shut || c.s[1].shut === b.s[1].shut) fail('shut in: a copy of the battle shares its door');
    }
    {
      // Fracture: heals stop at the line set when the bone cracked, a lower line wins, and the bone sets after its turns.
      const b = mk(['molar'], ['cairn']);
      E.advance(b);
      const m = b.s[0].f[0], z = b.s[1].f[0];
      z.hp = Math.round(z.maxHp * 0.5);
      if (!E.fracture(b, m, z, 2)) fail('fracture: the foe would not crack');
      E.heal(b, null, z, z.maxHp);
      if (z.hp !== Math.round(z.maxHp * 0.5)) fail(`fracture: a heal went past the line (${z.hp} of ${z.maxHp})`);
      z.hp = Math.round(z.maxHp * 0.3);
      E.fracture(b, m, z, 1);
      E.heal(b, null, z, z.maxHp);
      if (z.hp !== Math.round(z.maxHp * 0.3) || z.fracture?.turns !== 2) fail('fracture: a second crack should lower the line and keep the longer turns');
      if (E.clone(b).s[1].f[0].fracture === z.fracture) fail('fracture: a copy of the battle shares the fracture');
      b.need = null;
      for (let i = 0; i < 8 && z.fracture; i++) {
        const d = E.advance(b);
        if (d.kind === 'joint') round(b, { k: 'guard' }, { k: 'guard' });
        else if (d.kind === 'act') E.act(b, { k: 'guard' });
        else break;
      }
      if (z.fracture) fail('fracture: the bone did not set after its turns');
    }
    {
      // Body swap: two out whorls trade moves, types, and cooldowns, and both take their own back when one leaves.
      const b = mk(['socket'], ['hare', 'kiln']);
      E.advance(b);
      const s0 = b.s[0].f[0], h = b.s[1].f[0];
      const sm = s0.moves.join(), hm = h.moves.join(), ht = E.typesOf(h).join();
      h.cd = h.cd.map((_, i) => i + 1);
      const hcd = h.cd.join();
      if (!E.swapBodies(b, s0, h, 2)) fail('body swap: the trade did not happen');
      if (s0.moves.join() !== hm || h.moves.join() !== sm || s0.cd.join() !== hcd || E.typesOf(s0).join() !== ht) fail('body swap: the two did not trade moves, cooldowns, and types');
      if (E.clone(b).s[0].f[0].swap === s0.swap) fail('body swap: a copy of the battle shares the trade');
      E.doSwitch(b, 1, 1);
      if (s0.swap || h.swap || s0.moves.join() !== sm || h.moves.join() !== hm || h.cd.join() !== hcd) fail('body swap: leaving the field did not give both their own bodies back');
    }
    {
      // Mirage: the other side sees more HP than the holder has, up to a cap, and leaving the field ends it.
      const b = mk(['fata', 'kiln'], ['cairn']);
      E.advance(b);
      const f = b.s[0].f[0];
      f.hp = Math.round(f.maxHp * 0.4);
      E.addMirage(b, f, 0.3, 2);
      if (E.shownHp(f) !== f.hp + Math.round(f.maxHp * 0.3)) fail('mirage: the shown HP should be its HP plus the mirage');
      E.addMirage(b, f, 0.9, 1);
      if (E.shownHp(f) !== f.maxHp || f.mirage?.hp !== Math.round(f.maxHp * 0.6) || f.mirage?.turns !== 2) fail('mirage: the mirage should stop at 60% of max HP, keep its longer turns, and show no more than full');
      if (E.clone(b).s[0].f[0].mirage === f.mirage) fail('mirage: a copy of the battle shares the mirage');
      E.doSwitch(b, 0, 1);
      if (f.mirage) fail('mirage: leaving the field did not end the mirage');
    }
    {
      // Cover: an out whorl that covers its bench takes the other side's hits meant for its reserves.
      const b = mk(['prow', 'kiln'], ['cairn']);
      E.advance(b);
      const p = b.s[0].f[0], k = b.s[0].f[1], z = b.s[1].f[0];
      p.hp = p.maxHp * 9;
      const info = { kind: 'T' as const, move: null, attack: false, dot: false, spread: true, reserve: true };
      const k0 = k.hp;
      E.dealDamage(b, z, k, 20, info, null);
      if (k.hp !== k0 - 20 || E.covering(b, 0)) fail('cover: a reserve with nobody covering it should take the hit');
      E.mark(b, p, p, 'prow_front', 1, 3);
      if (E.covering(b, 0) !== p) fail('cover: the out whorl should be covering its bench');
      const p0 = p.hp, k1 = k.hp;
      E.dealDamage(b, z, k, 20, info, null);
      if (k.hp !== k1 || p.hp !== p0 - 20) fail(`cover: the covering whorl should take the hit meant for its reserve (${p0}->${p.hp}, ${k1}->${k.hp})`);
    }
    {
      // Wind: a projectile thrown toward the side the wind blows to hits harder, one thrown against it softer, and a copy keeps its own wind.
      const b = mk(['bombard'], ['cairn']);
      E.advance(b);
      const dmg = (to: 0 | 1 | null, tag: string) => {
        const cb = E.clone(b);
        if (to !== null) E.setWind(cb, to, 2);
        const t = cb.s[1].f[0], hp = (t.hp = t.maxHp * 9);
        E.dealDamage(cb, cb.s[0].f[0], t, 100, { kind: 'T', move: { ...MOVES.drive, tags: [tag] } as typeof MOVES.drive, attack: false, dot: false, spread: false, reserve: false }, null);
        return hp - t.hp;
      };
      const calm = dmg(null, 'projectile');
      if (!(dmg(1, 'projectile') > calm && dmg(0, 'projectile') < calm)) fail('wind: a projectile should ride the wind toward the foe and fight it the other way');
      if (dmg(1, 'dash') !== dmg(null, 'dash')) fail('wind: the wind moved a dash');
      E.setWind(b, 1, 2);
      if (E.clone(b).wind === b.wind) fail('wind: a copy of the battle shares its wind');
    }
    {
      // Swell: Namito starts the swell, and at 9 the wave breaks: a TIDE whorl gets Haste 1, and another takes 12% of its max HP and Slow 1.
      const b = mk(['breaker'], ['cairn']);
      E.advance(b);
      if (!b.swell) fail('swell: Namito coming out should start the swell');
      const w = b.s[0].f[0], z = b.s[1].f[0];
      z.hp = z.maxHp * 9;
      delete w.s.haste;
      E.raiseSwell(b, 8 - (b.swell?.n || 0));
      const hp0 = z.hp;
      if (b.swell?.n !== 8 || z.hp !== hp0) fail('swell: the wave broke early');
      E.raiseSwell(b, 1);
      if (b.swell?.n !== 0 || !(z.hp < hp0) || !z.s.slow || !w.s.haste) fail('swell: at 9 the wave should break, hitting and slowing the foe and hastening the TIDE whorl');
      if (E.clone(b).swell === b.swell) fail('swell: a copy of the battle shares the swell');
    }
    {
      // Credit: a side with credit pays for a crest with tide it does not have, and gains pay the debt back while losses never deepen it.
      const b = mk(['spume', 'kiln'], ['cairn']);
      E.advance(b);
      const s0 = b.s[0], sp = s0.f[0];
      if (E.creditOf(b, 0) !== 2 || E.creditOf(b, 1) !== 0) fail('credit: Spuawa should give its side 2 credit and the other side none');
      s0.nerve = 3;
      sp.cd = sp.cd.map(() => 0);
      if (!E.usable(b, sp, sp.moves.indexOf('spume_keptafloat')).ok) fail('credit: a crest costing 5 should be usable with 3 tide and 2 credit');
      E.payTide(b, 0, 5);
      if (s0.nerve !== -2) fail(`credit: paying 5 from 3 tide should leave 2 owed (has ${s0.nerve})`);
      E.addNerve(b, 0, 1);
      if (s0.nerve !== -1) fail('credit: a gain should pay the debt back');
      E.addNerve(b, 0, -3);
      if (s0.nerve !== -1) fail('credit: a loss should never take a side deeper into debt');
      b.s[1].nerve = 2;
      E.addNerve(b, 1, -5);
      if (b.s[1].nerve !== 0) fail('credit: a side out of debt should still stop at 0 tide');
    }
    {
      // Lie in wait: the waiting strike lands first as the foe acts, a switch included, on the whorl going out, and the wait is spent.
      const b = mk(['heron'], ['cairn', 'hare']);
      if (E.advance(b).kind !== 'joint') fail('lie in wait: two whorls do not open with a joint round');
      const h = b.s[0].f[0], first = b.s[1].f[0], second = b.s[1].f[1];
      first.hp = first.maxHp * 9;
      E.lieInWait(b, h, 'heron_strike');
      if (!h.wait || !E.marked(h, E.WAITING)) fail('lie in wait: the heron should show that it is lying in wait');
      const hp0 = first.hp, hp1 = second.hp;
      round(b, { k: 'guard' }, { k: 'switch', to: 1 });
      if (!(first.hp < hp0) || second.hp !== hp1 || b.s[1].out !== 1) fail(`lie in wait: the strike should land on the whorl switching out before it goes (${hp0}->${first.hp}, ${hp1}->${second.hp})`);
      if (h.wait || E.marked(h, E.WAITING)) fail('lie in wait: the wait should be spent once it springs');
    }
    {
      // Sound: a guard does not stop a sound move, a sound move finds a Hidden foe, a Deaf whorl takes 0.5x, and Silence stops it.
      const b = mk(['tenor'], ['cairn']);
      E.advance(b);
      const dmg = (tag: string, set: (z: ReturnType<typeof mk>['s'][0]['f'][0], cb: ReturnType<typeof mk>) => void) => {
        const cb = E.clone(b), zz = cb.s[1].f[0];
        zz.hp = zz.maxHp * 9;
        set(zz, cb);
        const hp = zz.hp;
        E.dealDamage(cb, cb.s[0].f[0], zz, 100, { kind: 'T', move: { ...MOVES.drive, tags: [tag] } as typeof MOVES.drive, attack: false, dot: false, spread: false, reserve: false }, null);
        return hp - zz.hp;
      };
      const plain = dmg('sound', () => {});
      if (dmg('sound', zz => { zz.s.guard = { n: 1 }; }) !== plain || !(dmg('spell', zz => { zz.s.guard = { n: 1 }; }) < plain)) fail('sound: a guard should stop a spell but not a sound move');
      if (dmg('sound', zz => { zz.s.hidden = { n: 2 }; }) !== plain) fail('sound: a Hidden foe hid from a sound move');
      if (dmg('sound', (zz, cb) => { E.mark(cb, null, zz, 'lull_hush', 1, 3); }) !== Math.round(plain * 0.5)) fail('sound: a Deaf whorl should take 0.5x from a sound move');
      const t = b.s[0].f[0];
      t.s.silence = { n: 1 };
      if (E.usable(b, t, t.moves.indexOf('tenor_clapper')).ok) fail('sound: Silence should stop a sound move');
    }
    {
      // Keepsake: a kept move fills a ready fifth slot, stays through a form ending, and a newer keepsake takes its place.
      const b = mk(['relic'], ['cairn']);
      E.advance(b);
      const r = b.s[0].f[0];
      if (!E.keepMove(b, r, 'heron_billstab') || r.moves.length !== 5 || r.moves[4] !== 'heron_billstab' || r.cd[4] !== 0) fail('keepsake: the kept move should fill a ready fifth slot');
      if (!E.usable(b, r, 4).ok) fail('keepsake: the fifth slot should be usable');
      E.setForm(b, r, { tag: 'test' }, ['dandle_sow']);
      E.clearForm(b, r);
      if (r.moves[4] !== 'heron_billstab') fail('keepsake: a form ending lost the keepsake');
      E.keepMove(b, r, 'heron_reedsnare');
      if (r.moves.length !== 5 || r.moves[4] !== 'heron_reedsnare') fail('keepsake: a newer keepsake should take the old one\'s place');
      if (E.clone(b).s[0].f[0].moves[4] !== 'heron_reedsnare') fail('keepsake: a copy of the battle lost the keepsake');
    }
    {
      // Silent: a silent whorl's hit goes unanswered, so a foe that returns damage to its attacker does not hear it.
      const b = mk(['strix'], ['urchin']);
      E.advance(b);
      b.s[1].f[0].hp = b.s[1].f[0].maxHp * 9;
      const back = (night: boolean) => {
        const cb = E.clone(b), st = cb.s[0].f[0], ur = cb.s[1].f[0];
        if (night) E.mark(cb, st, st, 'strix_dark', 1, 3);
        if (E.silent(cb, st) !== night) fail(`silent: Polro should be Silent only at night (night ${night})`);
        const hp = st.hp;
        E.dealDamage(cb, st, ur, 100, { kind: 'T', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
        return hp - st.hp;
      };
      if (!(back(false) > 0)) fail('silent: Sharp Spines should return damage to an attacker it hears');
      if (back(true) !== 0) fail('silent: Sharp Spines heard a Silent attacker');
    }
    {
      // Drink: a heal meant for a Rooted foe goes to Nekkori instead, and with no Root it lands as usual.
      const b = mk(['taproot'], ['cairn']);
      E.advance(b);
      const tp = b.s[0].f[0], z = b.s[1].f[0];
      tp.hp = Math.round(tp.maxHp / 2);
      z.hp = Math.round(z.maxHp / 2);
      const t0 = tp.hp, z0 = z.hp;
      E.heal(b, null, z, 50);
      if (z.hp !== z0 + 50 || tp.hp !== t0 || E.drinkerOf(b, z)) fail('drink: a heal on a foe that is not Rooted should land on it');
      E.applyStatus(b, tp, z, 'root', 2);
      const t1 = tp.hp, z1 = z.hp;
      E.heal(b, null, z, 50);
      if (z.hp !== z1 || tp.hp !== t1 + 50 || E.drinkerOf(b, z) !== tp) fail(`drink: Nekkori should drink the heal meant for a Rooted foe (${z1}->${z.hp}, ${t1}->${tp.hp})`);
    }
    {
      // Watch over: a reserve with the hook answers a foe's hit on its out ally, and a side cut off from its bench gets no answer.
      const b = mk(['cairn', 'whip'], ['hare']);
      E.advance(b);
      const c0 = b.s[0].f[0], h = b.s[1].f[0];
      c0.hp = c0.maxHp * 9;
      if (E.watchers(b, 0)[0] !== b.s[0].f[1]) fail('watch over: Virtsa in reserve should watch over its out ally');
      const hit = (bb: ReturnType<typeof mk>) => E.dealDamage(bb, bb.s[1].f[0], bb.s[0].f[0], 20, { kind: 'T', move: null, attack: true, dot: false, spread: false, reserve: false }, null);
      const cut = E.clone(b);
      E.wedge(cut, 0, 2);
      hit(cut);
      if (cut.s[1].f[0].s.root) fail('watch over: a bench cut off from its out whorl still answered');
      hit(b);
      if (!h.s.root) fail('watch over: Virtsa should root the foe that hit its out ally');
    }
    {
      // Telegraph: Carcanet foretells its next Stones in Tape order, the first is the Stone it sets next, and the readout turns with the loop.
      const K7 = await import('../data/kits7');
      const b = mk(['carcanet'], ['cairn']);
      E.advance(b);
      const f = b.s[0].f[0];
      const names = (l: { name: string }[]) => l.map(g => g.name);
      const before = names(E.foretold(b, f)), stone = ['', 'pearl', 'amber', 'beach glass', 'star glass'];
      if (before.length !== 4 || new Set(before).size !== 4) fail(`telegraph: Tape apgs should foretell its four Stones (got ${before.join(', ')})`);
      K7.setNext(b, f);
      const c = K7.collar(f), after = names(E.foretold(b, f));
      if (stone[c[c.length - 1]] !== before[0] || after.join() !== [...before.slice(1), before[0]].join()) fail('telegraph: the Stone set should be the one foretold first, and the readout should turn');
    }
    {
      // House: a heal past full on Holm's side fills its house up to its cap, and the next whorl to come out drinks it.
      const b = mk(['holm', 'hare'], ['cairn']);
      E.advance(b);
      const holm = b.s[0].f[0], mate = b.s[0].f[1], cap = E.houseCap(b, 0);
      if (cap !== Math.round(holm.maxHp * 0.25) || E.houseCap(b, 1) !== 0) fail(`house: Holm's side should have a house of 25% of its max HP and the other side none (cap ${cap})`);
      holm.hp = holm.maxHp;
      E.heal(b, null, holm, holm.maxHp);
      if (b.s[0].pool !== cap) fail(`house: a heal past full should fill the house to ${cap} (it holds ${b.s[0].pool})`);
      mate.hp = 1;
      E.doSwitch(b, 0, mate.idx, true);
      if (b.s[0].out !== mate.idx || mate.hp !== 1 + cap || b.s[0].pool) fail(`house: the next whorl out should drink the house (HP ${mate.hp}, house ${b.s[0].pool})`);
    }
    {
      // Rewind: the real battle keeps its decisions. Still Minute goes back 3 rounds the moment it resolves, its visitor chooses
      // its move there from the board as it stood, the rounds since play again from the record, and the record then holds the
      // new timeline. Notes/still-minute.md has every rule.
      const AI = await import('../battle/ai');
      const { fitted } = await import('../game/wildfit');
      const aiReplace = (bb: Battle, side: 0 | 1) => (side === 1 ? AI.chooseReplacement(bb, side) : -1);
      // One decision made by the AI for whichever side has it, the visitor's choice included.
      const step = (b: Battle) => { const d = E.advance(b, aiReplace); if (d.kind === 'replace') E.replace(b, d.side, AI.chooseReplacement(b, d.side)); else if (d.kind !== 'over') AI.aiTurn(b); };
      // Deep HP on every whorl keeps a battle going through a whole test.
      const live = (a: (string | Mon)[], z: string[]) => {
        const b = E.newBattle({ mons: a.map(k => (typeof k === 'string' ? makeMon(k, 25) : k)), name: 'A', ai: 'keeper' }, { mons: z.map(k => makeMon(k, 25)), name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
        for (const s of b.s) for (const f of s.f) f.hp = f.maxHp * 9;
        return b;
      };
      const slot = (f: Fighter, id: string) => f.moves.indexOf(id);
      // Plays on to a decision where side 0 chooses and makes `a` there, with the AI choosing for side 1.
      const choose0 = (b: Battle, a: Action) => {
        for (let i = 0; i < 30; i++) { const d = E.advance(b, aiReplace); if (d.kind === 'joint' || (d.kind === 'act' && d.side === 0)) break; step(b); }
        if (b.need?.kind === 'joint') E.actJoint(b, a, AI.choose(b, 1));
        else if (b.need?.kind === 'act' && b.need.side === 0) E.act(b, a);
        else fail('rewind: side 0 never had a choice to make');
      };
      // The foe's latest recorded choice becomes a move in a slot no foe has, so the replay must find a choice to stand in for it.
      const spoil = (b: Battle) => { const ps = b.past || []; for (let i = ps.length - 1; i >= 0; i--) if (ps[i].acts[1]) { ps[i].acts[1] = { k: 'move', i: 9 }; return; } };
      // The record loses every choice the foe made, so the replay must ask the AI for each of its turns.
      const forget = (b: Battle) => { for (const st of b.past || []) st.acts[1] = null; };
      const counting = (asks: number[]) => E.setPastAi({ ...AI.PAST_AI, choose: (bb, side) => { asks[side]++; return AI.PAST_AI.choose(bb, side); } });
      {
        const b = live(['slackwater'], ['hare', 'kiln']);
        const t = b.s[0].f[0], sm = slot(t, 'slackwater_minute'), lap = slot(t, 'slackwater_lap');
        // Tynagi's crest waits on a long cooldown until the test uses it, so the AI cannot spend it first.
        t.cd[sm] = 99;
        for (let i = 0; i < 6; i++) step(b);
        if (!b.past || b.past.length < 2) fail('rewind: the real battle kept no history');
        if (E.clone(b).past !== undefined) fail('rewind: an AI copy carried the history');
        b.s[0].nerve = 10; t.cd[sm] = 0;
        const asks = [0, 0];
        counting(asks);
        choose0(b, { k: 'move', i: sm });
        spoil(b);
        // The battle must come back exactly as one of its recorded moments stood, HP and knockouts both.
        const moments = (b.past || []).map(st => JSON.stringify([st.snap.s.map(s => s.f.map(f => f.hp)), st.snap.s.map(s => s.f.map(f => f.ko))]));
        const from = b.ev.length, turnAt = b.turnNo;
        const d = E.advance(b, aiReplace);
        if (d.kind !== 'visit' || d.side !== 0) fail(`rewind: Still Minute did not stop in the past for the visitor's choice (${d.kind})`);
        else {
          const jump = b.ev.slice(from).find(e => e.e === 'rewind');
          if (!jump || jump.e !== 'rewind' || !jump.past || !moments.includes(JSON.stringify([jump.hp, jump.ko]))) fail('rewind: the past did not come back as it stood');
          if (!E.visitChoices(b).some(a => a.k === 'move' && a.i === lap)) fail('rewind: the visitor cannot pick Still Lap');
          if (E.visitChoices(b).some(a => a.k === 'move' && E.moveDef(b.visit!.body, a.i)?.nerve)) fail('rewind: the visitor may pick a crest');
          E.visit(b, { k: 'move', i: lap });
        }
        E.setPastAi(AI.PAST_AI);
        const evs = b.ev.slice(from);
        if (!evs.some(e => e.e === 'use' && e.move === 'slackwater_lap' && e.past && e.visit)) fail('rewind: the visitor did not cast Still Lap in the past');
        if (b.over === null && b.turnNo < turnAt) fail(`rewind: the replay stopped at turn ${b.turnNo}, before turn ${turnAt}`);
        if (asks[1]) fail(`rewind: the replay asked the AI ${asks[1]} times though a plain Attack could stand in for the foe's spoiled choice`);
        const now = b.s[0].f[0];
        if (now.moves.includes('slackwater_minute') || !now.moves.includes('slackwater_flood') || !now.k.rewound) fail('rewind: Still Minute was not spent into Running Tide');
        if (!b.past?.length) fail('rewind: the record did not keep the new timeline');
        if (b.over === null && (!b.need || b.need.kind === 'visit')) fail('rewind: the battle did not come back to a live decision');
      }
      {
        // A failed replay puts the present back and casts the pick there.
        const b = live(['slackwater'], ['hare', 'kiln']);
        const t = b.s[0].f[0], sm = slot(t, 'slackwater_minute'), lap = slot(t, 'slackwater_lap');
        t.cd[sm] = 99;
        for (let i = 0; i < 6; i++) step(b);
        b.s[0].nerve = 10; t.cd[sm] = 0;
        choose0(b, { k: 'move', i: sm });
        forget(b);
        const from = b.ev.length;
        E.setPastAi({ ...AI.PAST_AI, choose: () => { throw new Error('test'); } });
        const d = E.advance(b, aiReplace);
        if (d.kind === 'visit') E.visit(b, { k: 'move', i: lap });
        E.setPastAi(AI.PAST_AI);
        if (!b.ev.slice(from).some(e => e.e === 'use' && e.move === 'slackwater_lap' && !e.past)) fail('rewind: a failed replay did not cast the pick in the present');
      }
      {
        // A peg reaches outside the battle, so the history starts again after it.
        const b = live(['slackwater'], ['hare', 'kiln']);
        b.rules.wild = true;
        b.s[0].f[0].cd[3] = 99;
        for (let i = 0; i < 3; i++) step(b);
        for (let i = 0; i < 20; i++) { const d = E.advance(b, aiReplace); if (d.kind === 'joint' || (d.kind === 'act' && d.side === 0)) break; step(b); }
        const peg = { k: 'peg' as const, peg: 'twig' };
        if (b.need?.kind === 'joint') E.actJoint(b, peg, AI.choose(b, 1)); else if (b.need?.kind === 'act') E.act(b, peg);
        if (b.past && b.past.length) fail('rewind: a peg left history behind it');
      }
      {
        // Tynagi waits in reserve while Hare starts, comes out in the second round, and uses Still Minute in the fourth. Its
        // visitor arrives in the first round, where its past self is still in reserve, its Still Lap lands there, and every
        // recorded choice plays again with no help from the AI. Tynagi's recorded Still Minute plays as Running Tide.
        const b = live(['hare', 'slackwater'], ['kiln', 'cairn']);
        const t = b.s[0].f[1], sm = slot(t, 'slackwater_minute'), lap = slot(t, 'slackwater_lap');
        b.s[0].nerve = 10;
        const plan = (bb: Battle): Action => {
          const r = E.roundOf(bb), o = E.out(bb, 0);
          if (r <= 1) return { k: 'attack' };
          if (o.idx === 0) return { k: 'switch', to: 1 };
          return r <= 3 ? { k: 'attack' } : { k: 'move', i: sm };
        };
        const asks = [0, 0];
        counting(asks);
        let d = E.advance(b, aiReplace);
        for (let i = 0; i < 60 && d.kind !== 'visit' && d.kind !== 'over'; i++) {
          if (d.kind === 'replace') E.replace(b, d.side, AI.chooseReplacement(b, d.side));
          else if (d.kind === 'joint') E.actJoint(b, plan(b), AI.choose(b, 1));
          else E.act(b, d.side === 0 ? plan(b) : AI.choose(b, 1));
          d = E.advance(b, aiReplace);
        }
        if (d.kind !== 'visit') fail(`rewind: Tynagi's Still Minute from reserve-to-out play never went back (${d.kind})`);
        else {
          if (b.visit?.back !== 3) fail(`rewind: the visitor went back ${b.visit?.back} rounds, not 3`);
          if (b.s[0].out !== 0 || b.s[0].f[1].ko || b.s[0].f[1].gone) fail('rewind: Tynagi was not in reserve in the round its visitor arrived at');
          // The past Tynagi in reserve is a target like any other ally.
          if (!E.visitChoices(b).length) fail('rewind: the visitor had nothing to choose');
          const from = b.ev.length, foeAt = b.s[1].out;
          E.visit(b, { k: 'move', i: lap });
          const evs = b.ev.slice(from);
          const use = evs.findIndex(e => e.e === 'use' && e.move === 'slackwater_lap' && !!e.visit && !!e.past);
          const hit = evs.findIndex((e, k) => k > use && e.e === 'dmg' && e.side === 1 && e.idx === foeAt && !!e.past && !e.visit);
          if (use < 0 || hit < 0) fail('rewind: the visitor\'s Still Lap did not land on the foe in the past');
          if (asks[0] || asks[1]) fail(`rewind: the replay asked the AI ${asks[0] + asks[1]} times though every recorded choice still stood`);
          const back = evs.flatMap(e => (e.past && !e.visit && (e.e === 'use' || e.e === 'out') && e.side === 0 ? [e.e === 'use' ? e.name : `out ${e.idx}`] : []));
          if (!back.includes('Attack') || !back.includes('out 1') || !back.includes('Running Tide')) fail(`rewind: the replay did not make side 0's recorded choices again (${back.join(', ')})`);
          const now = b.s[0].f[1];
          if (now.moves.includes('slackwater_minute') || !now.moves.includes('slackwater_flood')) fail('rewind: Still Minute came back in the new timeline');
        }
        E.setPastAi(AI.PAST_AI);
      }
      {
        // Both sides pick Still Minute in one round. The first to resolve goes back at once. The other side's recorded Still
        // Minute cannot be cast while the past plays again, so a plain Attack stands in for it, and that crest stays unspent.
        const b = live(['slackwater'], ['slackwater']);
        const sm = slot(b.s[0].f[0], 'slackwater_minute');
        for (const s of b.s) s.f[0].cd[sm] = 99;
        for (let i = 0; i < 6; i++) step(b);
        for (const s of b.s) { s.nerve = 10; s.f[0].cd[sm] = 0; }
        for (let i = 0; i < 30; i++) { const d = E.advance(b, aiReplace); if (d.kind === 'joint') break; step(b); }
        if (b.need?.kind !== 'joint') fail('rewind: two Tynagis never chose in one round');
        else {
          const asks = [0, 0];
          counting(asks);
          E.actJoint(b, { k: 'move', i: sm }, { k: 'move', i: sm });
          const d = E.advance(b, aiReplace);
          if (d.kind !== 'visit') fail(`rewind: neither Still Minute went back (${d.kind})`);
          else {
            const first = d.side, other = (1 - first) as 0 | 1;
            if (!b.s[first].f[0].moves.includes('slackwater_flood') || !b.s[other].f[0].moves.includes('slackwater_minute')) fail('rewind: both Still Minutes were spent, or the wrong one');
            const from = b.ev.length;
            E.visit(b, E.passiveVisit(b));
            const again = b.ev.slice(from).filter(e => e.e === 'use' && e.past && !e.visit && e.side === other);
            if (again.some(e => e.e === 'use' && e.move === 'slackwater_minute')) fail('rewind: the second recorded Still Minute was played in the replay');
            if (asks[other] || !again.some(e => e.e === 'use' && e.name === 'Attack')) fail(`rewind: a plain Attack did not stand in for the second recorded Still Minute (the AI was asked ${asks[other]} times)`);
            if (!b.s[other].f[0].moves.includes('slackwater_minute') || b.s[other].f[0].k.rewound) fail('rewind: the Still Minute that never resolved was spent');
          }
          E.setPastAi(AI.PAST_AI);
        }
      }
      {
        // In a replay a recorded move plays as the same move by id from the same whorl, else as the move in the same slot from
        // the whorl now in its place, else as a plain Attack.
        const b = live(['hare', 'kiln'], ['cairn', 'scree']);
        for (let i = 0; i < 30; i++) { const d = E.advance(b, aiReplace); if (d.kind === 'joint' || (d.kind === 'act' && d.side === 0)) break; step(b); }
        const snap = E.clone(b), s0 = b.s[0], f = E.out(b, 0);
        const plain = (i: number) => E.legal(b, 0).some(x => x.k === 'move' && x.i === i && x.target === undefined && x.opt === undefined && !x.aim);
        const [p, q] = [0, 1, 2, 3].filter(plain);
        const got = (a: Action) => { const x = E.pastChoice(b, 0, snap, a); return !x ? 'the AI' : x.k === 'move' ? `slot ${x.i}` : x.k; };
        if (s0.out !== 0 || q === undefined) fail('rewind: the stand-in test found no two plain moves for side 0');
        else {
          const rec: Action = { k: 'move', i: p };
          if (got(rec) !== `slot ${p}`) fail(`rewind: a recorded move that still stands played as ${got(rec)}`);
          [f.moves[p], f.moves[q]] = [f.moves[q], f.moves[p]];
          if (got(rec) !== `slot ${q}`) fail(`rewind: a recorded move did not follow its id to its new slot (${got(rec)})`);
          f.cd[q] = 9;
          if (got(rec) !== `slot ${p}`) fail(`rewind: a barred recorded move did not give way to the move in its slot (${got(rec)})`);
          f.cd[p] = 9;
          if (got(rec) !== 'attack') fail(`rewind: a plain Attack did not stand in for two barred moves (${got(rec)})`);
          f.cd[p] = f.cd[q] = 0;
          [f.moves[p], f.moves[q]] = [f.moves[q], f.moves[p]];
          s0.out = 1;
          const want = E.legal(b, 0).some(x => x.k === 'move' && x.i === p) ? `slot ${p}` : 'attack';
          if (got(rec) !== want) fail(`rewind: the whorl in the recorded whorl's place played ${got(rec)}, not ${want}`);
          s0.out = 0;
        }
      }
      {
        // A fit that keeps Still Minute and Zigzag: its visitor swaps with an ally, stays in that ally's place, and the ally
        // leaves in the time machine. The past fit stays, so two of it fight on, and both hold Running Tide.
        const hare = makeMon('hare', 25).moves.filter(id => id !== 'bolt')[0];
        const fit = fitted('slackwater', 'hare', 25, ['slackwater_lap', 'slackwater_minute', 'bolt', hare], ['slackwater_turn', 'slackwater_unhurried']);
        const b = live([fit, 'kiln', 'cairn'], ['hare', 'kiln']);
        const f = b.s[0].f[0], sm = slot(f, 'slackwater_minute'), zig = slot(f, 'bolt');
        b.s[0].nerve = 10;
        let d = E.advance(b, aiReplace);
        for (let i = 0; i < 60 && d.kind !== 'visit' && d.kind !== 'over'; i++) {
          const mine: Action = E.roundOf(b) <= 3 ? { k: 'attack' } : { k: 'move', i: sm };
          if (d.kind === 'replace') E.replace(b, d.side, AI.chooseReplacement(b, d.side));
          else if (d.kind === 'joint') E.actJoint(b, mine, AI.choose(b, 1));
          else E.act(b, d.side === 0 ? mine : AI.choose(b, 1));
          d = E.advance(b, aiReplace);
        }
        if (d.kind !== 'visit') fail(`rewind: the fit's Still Minute did not go back (${d.kind})`);
        else {
          const ally = E.visitChoices(b).find(a => a.k === 'move' && a.i === zig && a.target !== undefined && a.target !== 0);
          if (!ally || ally.k !== 'move') fail('rewind: the fit\'s visitor cannot swap with an ally');
          else {
            const to = ally.target!, uid = b.s[0].f[to].mon.uid;
            E.visit(b, ally);
            const s0 = b.s[0];
            if (s0.f.some(x => x.mon.uid === uid) && b.over === null) fail('rewind: the ally the visitor swapped with is still in the battle');
            if (s0.f.filter(x => x.mon === fit).length !== 2) fail('rewind: the visitor and the past fit are not both on the team');
            if (s0.f.some(x => x.moves.includes('slackwater_minute'))) fail('rewind: a fit kept an unspent Still Minute after it went back');
          }
        }
        for (let i = 0; i < 12 && b.over === null; i++) step(b);
      }
      {
        // Copies: a take-over of a whorl with Still Minute gets Running Tide in its place, and a whorl that does not hold
        // Still Minute in a slot, as an echo or a snatch casts it, gets nothing from it.
        const b = live(['cairn'], ['slackwater']);
        const c0 = b.s[0].f[0];
        E.takeOver(b, c0, b.s[1].f[0]);
        if (c0.moves.includes('slackwater_minute') || !c0.moves.includes('slackwater_flood')) fail('rewind: a take-over kept Still Minute');
        const from = b.ev.length;
        E.castMove(b, c0, 'slackwater_minute');
        if (b.rewindReq || !b.ev.slice(from).some(e => e.e === 'msg' && /does nothing/.test(e.text))) fail('rewind: a cast by a whorl that does not hold Still Minute did something');
      }
      {
        // A wind-up in progress when the visitor arrives lands at its time while the past plays again. A wind-up is seldom in
        // progress as a round opens, so the test puts one into every recorded moment, of a move the foe itself never picks.
        const winds = (id: string) => !!MOVES[id]?.wu && MOVES[id].reach === 'single';
        const wk = WILD_KINDS.find(k => makeMon(k, 25).moves.some(winds));
        if (!wk) fail('rewind: no wild kind holds a one-target move that winds up');
        else {
          const wid = makeMon(wk, 25).moves.find(winds)!;
          const b = live(['slackwater'], [wk]);
          const t = b.s[0].f[0], foe = b.s[1].f[0], sm = slot(t, 'slackwater_minute'), lap = slot(t, 'slackwater_lap');
          t.cd[sm] = 99;
          foe.cd[slot(foe, wid)] = 99;
          for (let i = 0; i < 6; i++) step(b);
          b.s[0].nerve = 10; t.cd[sm] = 0;
          choose0(b, { k: 'move', i: sm });
          for (const { snap } of b.past || []) snap.pend.push({ id: snap.pid++, at: snap.t + 40, kind: 'windup', side: 1, idx: 0, move: wid, data: { target: -1, aim: 0, opt: -1 }, unstop: true });
          const d = E.advance(b, aiReplace);
          if (d.kind !== 'visit') fail(`rewind: Still Minute did not go back in the wind-up test (${d.kind})`);
          else {
            if (!b.pend.some(p => p.kind === 'windup' && p.move === wid)) fail('rewind: the wind-up in progress did not come back with the past');
            const from = b.ev.length;
            E.visit(b, { k: 'move', i: lap });
            if (!b.ev.slice(from).some(e => e.e === 'use' && e.move === wid && e.side === 1 && e.past && !e.visit)) fail('rewind: the wind-up in progress did not land while the past played again');
            if (b.over === null && b.pend.some(p => p.kind === 'windup' && p.at < b.t)) fail('rewind: a wind-up is past its time after the replay');
          }
        }
      }
    }
  }

  // Splash: a text that names its Splash names the move's real share, and a spread move's reserves take that share.
  {
    const E = await import('../battle/engine');
    const { MOVES } = await import('../battle/registry');
    for (const m of Object.values(MOVES)) {
      const said = m.text.match(/Splash (\d+)%/);
      if (said && Number(said[1]) !== Math.round((m.splash ?? E.SPREAD_SHARE) * 100)) fail(`splash: ${m.id} says Splash ${said[1]}% but its share is ${m.splash ?? E.SPREAD_SHARE}`);
      if (m.splash !== undefined && !(m.splash > 0 && m.splash <= 1)) fail(`splash: ${m.id} has a share of ${m.splash}`);
    }
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25), makeMon('hare', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    const spreadOf = (share: number) => {
      const id = `zz_splash_${Math.round(share * 100)}`;
      MOVES[id] = { id, name: 'Test Splash', type: 'STONE', owner: 'cairn', reach: 'spread', cd: 0, splash: share, text: '', extra: true, run(c: { spread(r: { atk: number }): number }) { c.spread({ atk: 1 }); } } as any;
      const c = E.clone(b), u = c.s[0].f[0], foe = c.s[1].f[0], back = c.s[1].f[1];
      u.mon = { ...u.mon, passives: [] }; foe.mon = { ...foe.mon, passives: [] }; back.mon = { ...back.mon, passives: [] };
      u.moves[0] = id;
      const f0 = foe.hp, r0 = back.hp;
      E.runMove(c, u, 0, {});
      delete MOVES[id];
      return [f0 - foe.hp, r0 - back.hp];
    };
    const [m15, s15] = spreadOf(0.15), [m60, s60] = spreadOf(0.6);
    if (!(m15 > 0 && s15 > 0 && m60 > 0)) fail(`splash: a spread move dealt ${m15} and ${s15} at Splash 15%`);
    // The two reserves' armor cancels in the ratio, so 60% against 15% reads as about 4x.
    else if (!(s60 / m60 > 2.5 * (s15 / m15))) fail(`splash: Splash 60% hit the reserve for ${s60} of ${m60}, against ${s15} of ${m15} at 15%`);
  }

  // Lost turns never chain: a Stun tags the whorl steady against Stun until it acts, one other effect (Sleep) can still land,
  // and once both are over the whorl is stalwart for 2 turns, when nothing can cost it a turn.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const u = b.s[0].f[0], t = b.s[1].f[0];
    u.mon = { ...u.mon, passives: [] }; t.mon = { ...t.mon, passives: [] };
    u.hp = t.hp = 9999; u.maxHp = t.maxHp = 9999;
    const turnOf = (f: typeof t) => {
      const n = f.turns;
      for (let i = 0; i < 8 && f.turns === n && b.over === null; i++) {
        if (b.need?.kind === 'joint') E.actJoint(b, { k: 'guard' }, { k: 'guard' });
        else if (b.need?.kind === 'act') E.act(b, { k: 'guard' });
        E.advance(b);
      }
    };
    if (!E.applyStatus(b, u, t, 'stun', 1)) fail('lost turns: the first Stun did not land');
    if (!t.m.steady_stun) fail('lost turns: a Stun did not tag the whorl steady against Stun');
    if (E.applyStatus(b, u, t, 'stun', 1)) fail('lost turns: a second Stun landed before the whorl acted');
    turnOf(t);
    if (E.applyStatus(b, u, t, 'stun', 1)) fail('lost turns: a Stun landed after the stunned turn but before the whorl acted');
    turnOf(t);
    turnOf(t);
    if (t.m.steady_stun) fail('lost turns: acting did not clear a single steady tag');
    // The chain: Stun, then Sleep before the whorl acts, then nothing more until both are over, then stalwart.
    const c = E.clone(b), ct = c.s[1].f[0], cu = c.s[0].f[0];
    c.quiet = true;
    if (!E.applyStatus(c, cu, ct, 'stun', 1)) fail('lost turns: a Stun did not land on a whorl that had acted');
    if (!E.applyStatus(c, cu, ct, 'sleep', 1)) fail('lost turns: a Sleep did not land on a whorl steady against Stun only');
    if (E.applyStatus(c, cu, ct, 'stun', 1) || E.applyStatus(c, cu, ct, 'sleep', 1)) fail('lost turns: a third effect landed in a chain of two');
    const n0 = ct.turns;
    for (let i = 0; i < 12 && !ct.m.stalwart && c.over === null; i++) {
      if (c.need?.kind === 'joint') E.actJoint(c, { k: 'guard' }, { k: 'guard' });
      else if (c.need?.kind === 'act') E.act(c, { k: 'guard' });
      E.advance(c);
    }
    if (!ct.m.stalwart) fail(`lost turns: no stalwart after the chain ended (${ct.turns - n0} turns later)`);
    else {
      if (ct.s.stun || ct.s.sleep) fail('lost turns: stalwart came while an effect of the chain was still on');
      if (E.applyStatus(c, cu, ct, 'stun', 1)) fail('lost turns: a Stun landed on a stalwart whorl');
    }
  }

  // Forced switches lose turns too: a foe's force out tags the whorl steady against forced switches, and the whorl that comes
  // out in its place counts as forced too, so no foe can drag either in or force either to switch until it acts. A forced
  // switch clears no tag of its own.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('scree', 25), makeMon('plinth', 25), makeMon('menhir', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const u = b.s[0].f[0];
    for (const f of [u, ...b.s[1].f]) { f.mon = { ...f.mon, passives: [] }; f.hp = f.maxHp = 9999; }
    const first = E.out(b, 1);
    if (!E.forceOut(b, u, 1) || !first.m.steady_switch) fail('forced switch: a force out did not tag the whorl steady against forced switches');
    const second = E.out(b, 1);
    if (!second.m.steady_switch) fail('forced switch: the whorl that came out in place of a forced one was not tagged');
    if (E.dragIn(b, u, 1, first.idx)) fail('forced switch: a drag in brought back a whorl steady against forced switches');
    E.forceAction(b, second, 'switch', undefined, u);
    if (second.forced) fail('forced switch: a must-switch moved the whorl that came out in place of a forced one');
    // A whorl that came out by choice can be made to switch. It and the whorl that replaces it are both tagged.
    delete second.m.steady_switch;
    E.forceAction(b, second, 'switch', undefined, u);
    if (second.forced?.k !== 'switch' || !second.m.steady_switch) fail('forced switch: a must-switch did not land and tag the whorl');
    for (let i = 0; i < 8 && E.out(b, 1) === second && b.over === null; i++) {
      if (b.need?.kind === 'joint') E.actJoint(b, { k: 'guard' }, { k: 'guard' });
      else if (b.need?.kind === 'act') E.act(b, { k: 'guard' });
      E.advance(b);
    }
    const third = E.out(b, 1);
    if (third === second) fail('forced switch: the must-switch never resolved');
    else {
      if (!second.m.steady_switch) fail('forced switch: the forced switch cleared its own steady tag');
      if (!third.m.steady_switch) fail('forced switch: the whorl a must-switch brought out was not tagged');
    }
  }

  // Untouchable does not chain: another Untouchable never lengthens one in progress, and once Untouchable ends the whorl is
  // Seen through its next turn, when no Untouchable can land on it.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const u = b.s[0].f[0], t = b.s[1].f[0];
    u.mon = { ...u.mon, passives: [] }; t.mon = { ...t.mon, passives: [] };
    u.hp = t.hp = 9999; u.maxHp = t.maxHp = 9999;
    const turnOf = (f: typeof u) => {
      const n = f.turns;
      for (let i = 0; i < 8 && f.turns === n && b.over === null; i++) {
        if (b.need?.kind === 'joint') E.actJoint(b, { k: 'guard' }, { k: 'guard' });
        else if (b.need?.kind === 'act') E.act(b, { k: 'guard' });
        E.advance(b);
      }
    };
    if (!E.applyStatus(b, null, u, 'invuln', 1)) fail('untouchable: the first Untouchable did not land');
    const first = { ...u.s.invuln! };
    E.applyStatus(b, null, u, 'invuln', 1);
    if (u.s.invuln?.n !== first.n || u.s.invuln?.src !== first.src) fail('untouchable: a second Untouchable lengthened the first');
    for (let i = 0; i < 3 && u.s.invuln; i++) turnOf(u);
    if (u.s.invuln) fail('untouchable: Untouchable never ended');
    else {
      if (!u.m.seen) fail('untouchable: the whorl was not Seen after Untouchable ended');
      if (E.applyStatus(b, null, u, 'invuln', 1)) fail('untouchable: Untouchable landed on a Seen whorl');
      turnOf(u);
      if (u.m.seen) fail('untouchable: Seen outlasted the whorl\'s next turn');
      if (!E.applyStatus(b, null, u, 'invuln', 1)) fail('untouchable: Untouchable did not land once Seen was over');
    }
  }

  // No damage past 0 HP before the knockout: a follow-up hit inside a killing blow cannot knock the target out twice or pay
  // the knockout's tide twice. Tynagi's Turn of Tide strikes again on its 4th hit, here the blow that knocks out the Walrus.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('slackwater', 25), makeMon('crane', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('walrus', 25), makeMon('grenadier', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const u = b.s[0].f[0], w = b.s[1].f[0];
    u.k.lock = 3;
    w.hp = Math.round(w.maxHp * 0.1);
    const tide = [b.s[0].nerve, b.s[1].nerve];
    E.castMove(b, u, 'slackwater_lap');
    if (!w.ko) fail('double knockout: the setup did not knock the Walrus out');
    else {
      if (b.stats.kos[1] !== 1) fail(`double knockout: one knockout counted ${b.stats.kos[1]} times`);
      if (b.s[1].nerve - tide[1] !== 1) fail(`double knockout: the fallen side gained ${b.s[1].nerve - tide[1]} tide, not 1`);
    }
  }

  // One guard for Hidden and Untouchable: a whorl Revealed after Hidden cannot become Untouchable, and a whorl Seen after
  // Untouchable cannot hide, so the two never alternate.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const u = b.s[0].f[0], t = b.s[1].f[0];
    u.mon = { ...u.mon, passives: [] }; t.mon = { ...t.mon, passives: [] };
    u.hp = t.hp = 9999; u.maxHp = t.maxHp = 9999;
    const turnOf = (f: typeof u) => {
      const n = f.turns;
      for (let i = 0; i < 8 && f.turns === n && b.over === null; i++) {
        if (b.need?.kind === 'joint') E.actJoint(b, { k: 'guard' }, { k: 'guard' });
        else if (b.need?.kind === 'act') E.act(b, { k: 'guard' });
        E.advance(b);
      }
    };
    if (!E.applyStatus(b, null, u, 'hidden', 1)) fail('one guard: Hidden did not land');
    for (let i = 0; i < 3 && u.s.hidden; i++) turnOf(u);
    if (!u.s.revealed) fail('one guard: the whorl was not Revealed after Hidden ended');
    else if (E.applyStatus(b, null, u, 'invuln', 1)) fail('one guard: Untouchable landed on a Revealed whorl');
    for (let i = 0; i < 3 && u.s.revealed; i++) turnOf(u);
    if (!E.applyStatus(b, null, u, 'invuln', 1)) fail('one guard: Untouchable did not land once Revealed was over');
    for (let i = 0; i < 3 && u.s.invuln; i++) turnOf(u);
    if (!u.m.seen) fail('one guard: the whorl was not Seen after Untouchable ended');
    else if (E.applyStatus(b, null, u, 'hidden', 1)) fail('one guard: Hidden landed on a Seen whorl');
  }

  // A cure never holds a lost turn in place: under a cure, Stun, Sleep, and Stasis still wear off, and other statuses stop
  // counting down.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('cairn', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const u = b.s[0].f[0], t = b.s[1].f[0];
    u.mon = { ...u.mon, passives: [] }; t.mon = { ...t.mon, passives: [] };
    u.hp = t.hp = 9999; u.maxHp = t.maxHp = 9999;
    E.mark(b, u, t, 'halite_cured', 1, 9);
    E.applyStatus(b, u, t, 'expose', 2);
    if (!E.applyStatus(b, u, t, 'sleep', 2)) fail('cure: the Sleep did not land');
    const n = t.turns;
    for (let i = 0; i < 16 && t.turns < n + 3 && b.over === null; i++) {
      if (b.need?.kind === 'joint') E.actJoint(b, { k: 'guard' }, { k: 'guard' });
      else if (b.need?.kind === 'act') E.act(b, { k: 'guard' });
      E.advance(b);
    }
    if (!E.marked(t, 'halite_cured')) fail('cure: the cure ran out before the check');
    if (t.s.sleep) fail(`cure: a Sleep 2 on a cured whorl still held after ${t.turns - n} turns`);
    if (t.s.expose?.n !== 2) fail('cure: a cure did not stop Expose counting down');
  }

  // The Gleaner's lift: the foe that comes out when the Gleaner lifts a foe to its ear counts as forced, so no forced switch
  // can move it until it acts.
  {
    const E = await import('../battle/engine');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('gleaner', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('scree', 25), makeMon('plinth', 25), makeMon('menhir', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    E.advance(b);
    const g = b.s[0].f[0], first = E.out(b, 1);
    E.castMove(b, g, 'gleaner_hold');
    const comes = E.out(b, 1);
    if (comes === first || !first.gone) fail('lift: Hold to Ear did not lift the out foe');
    else if (!comes.m.steady_switch) fail('lift: the foe that came out was not counted as forced');
    else if (E.forceOut(b, g, 1)) fail('lift: a force out moved the foe that came out after a lift');
  }

  // A turn-start effect of the second side in a round can knock out the first side's whorl, whose turn has begun. That side
  // must send out a replacement rather than be asked to act at 0 HP, and the other side acts alone.
  {
    const E = await import('../battle/engine');
    const { chooseReplacement } = await import('../battle/ai');
    const { makeMon } = await import('../data/species');
    const b = E.newBattle({ mons: [makeMon('lune', 25)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 25), makeMon('hare', 25)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
    b.quiet = true;
    const lune = b.s[0].f[0], foe = b.s[1].f[0];
    foe.hp = 1;
    b.s[1].next = 100; b.s[0].next = 104;
    E.mark(b, lune, lune, 'lune_edge', 1, -1);
    const d = E.advance(b);
    if (d.kind === 'joint' || (d.kind === 'act' && d.side === 1)) fail(`rounds: a whorl knocked out at the other side's turn start was asked to act (${d.kind})`);
    if (!foe.ko) fail('rounds: the setup did not knock the foe out at the other side\'s turn start');
    if (d.kind === 'act') E.act(b, { k: 'guard' });
    const d2 = E.advance(b, chooseReplacement);
    const now = b.s[1].f[b.s[1].out];
    if (now.ko || d2.kind === 'over') fail(`rounds: no replacement came out after the knockout (${d2.kind})`);
  }

  // Old saves: a loaded whorl is redrawn from the current art, and an old fit, saved with only its parents' names, still
  // counts as both of its kinds.
  {
    const { makeMon, SPECIES, spriteOf } = await import('../data/species');
    const { makeStarborn, starbornSprite } = await import('../data/starborn');
    const { refreshMon } = await import('../game/refresh');
    const { kindsOf } = await import('../game/fitting');
    const { randomFit } = await import('../game/wildfit');
    const same = (x: { px: string[]; c: (string | undefined)[] }, y: { px: string[]; c: (string | undefined)[] }) => x.px.join() === y.px.join() && x.c.join() === y.c.join();
    const stale = (m: { sprite: { px: string[]; c: any } }) => { m.sprite = { px: m.sprite.px.map(r => r.replace(/[1-4]/g, '1')), c: ['#000000', '#111111', '#222222'] }; };
    const plain = makeMon('cairn', 25);
    stale(plain);
    refreshMon(plain);
    if (!same(plain.sprite, spriteOf(SPECIES.cairn))) fail('old saves: a whorl kept its stale sprite after a refresh');
    const star = makeStarborn(makeMon('hare', 25));
    stale(star);
    refreshMon(star);
    if (!same(star.sprite, starbornSprite(spriteOf(SPECIES.hare)))) fail('old saves: a starborn whorl lost its starborn look in a refresh');
    let seed = 5;
    const fit = randomFit(() => (seed = (seed * 9301 + 49297) % 233280) / 233280, 'cairn', 'hare', 50);
    const now = { px: fit.sprite.px.slice(), c: fit.sprite.c.slice() };
    delete fit.parentKinds; delete fit.fitLook;
    refreshMon(fit);
    if (kindsOf(fit).slice().sort().join() !== 'cairn,hare') fail(`old saves: an old fit of cairn and hare counts as ${kindsOf(fit).join(' and ')}`);
    if (!same(fit.sprite, now)) fail('old saves: an old fit was redrawn in a different look from the one it was made with');
  }

  // Battle code gives every browser the same numbers: no clock, no unseeded draw, and no Math function that engines may round
  // differently. Online play runs one battle in two browsers and needs both to agree (Notes/online-design.md).
  {
    const risky = /\bMath\.(random|pow|exp|expm1|log|log1p|log2|log10|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|cbrt|hypot)\b|\bDate\.now\b|\bperformance\.now\b|[\w)\]]\s*\*\*\s*[\w(]/;
    const allowed = [
      /Math\.random\(\) < chance/, /Math\.pow\(Math\.max\(0, \(1 - h\) \/ \(1 - line\)\), 1\.5\)/, // the horn roll that only wild battles make
      /Math\.pow\(2, n - 1\)/, // a power of two with a whole exponent is exact everywhere
      /Math\.pow\(n, 1\.4\)/, // experience that online battles never give
      /Math\.sin\(t \/ 45 \+ seed\)/, // the starborn glow that is drawn and never kept
    ];
    for (const d of ['src/battle', 'src/data']) for (const name of fs.readdirSync(d)) {
      if (!name.endsWith('.ts')) continue;
      fs.readFileSync(path.join(d, name), 'utf8').split('\n').forEach((line: string, i: number) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || !risky.test(line) || allowed.some(a => a.test(line))) return;
        fail(`${d}/${name}:${i + 1}: battle code that can differ between browsers: ${line.trim().slice(0, 90)}`);
      });
    }
  }

  // Random battles: every seed gives both sides a roster that passes the roster check and spreads its types, attack stats,
  // and bulk, the same seed gives the same rosters, about one whorl in four is a hybrid, and every hybrid keeps exactly one
  // crest when its parents have one.
  {
    const { randomRosters, spreadProblems } = await import('../net/random');
    const { teamProblems } = await import('../net/wire');
    const { MOVES, PASSIVES } = await import('../battle/registry');
    const { SPECIES } = await import('../data/species');
    let hybrids = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rs = randomRosters(seed * 7919);
      if (JSON.stringify(rs) !== JSON.stringify(randomRosters(seed * 7919))) fail(`random battles: seed ${seed} gave two different rosters`);
      rs.forEach((roster, side) => {
        const p = teamProblems(roster), spread = spreadProblems(roster);
        if (p.length) fail(`random battles: seed ${seed} side ${side}: ${p.join(' ')}`);
        if (spread.length) fail(`random battles: seed ${seed} side ${side} misses a floor: ${spread.join(', ')}`);
        for (const w of roster) {
          if (!w.fit) continue;
          hybrids++;
          const crests = w.fit.moves.filter(id => MOVES[id]?.nerve).length;
          const avail = w.fit.kinds.some(k => SPECIES[k].moves.some(id => MOVES[id]?.nerve));
          if (avail ? crests !== 1 : crests !== 0) fail(`random battles: seed ${seed} hybrid ${w.fit.kinds.join('+')} keeps ${crests} crests`);
          if (w.fit.passives.some(id => !PASSIVES[id])) fail(`random battles: seed ${seed} hybrid ${w.fit.kinds.join('+')} has an unknown habit`);
        }
      });
    }
    if (hybrids < 400 || hybrids > 800) fail(`random battles: ${hybrids} hybrids in 2,400 whorls, not about one in four`);
  }

  // Online rosters: six whorls, each kind once with a fit using up both of its kinds, one legendary at most with a fit's
  // parents counted, each notion once, and no persons. A pick is four different members of its own roster, and a rebuilt
  // battle starts from the two picked fours. A whorl comes back from its wire form unchanged.
  {
    const { monFromWire, pickProblems, teamProblems, wireFromMon } = await import('../net/wire');
    const { rebuild, teamsFromPicks } = await import('../net/lockstep');
    const { makeMon, SPECIES } = await import('../data/species');
    const { randomFit } = await import('../game/wildfit');
    const { TYPES } = await import('../data/types');
    let s = 7;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const kind = (k: string) => wireFromMon(makeMon(k, 25));
    const fit = (a: string, z: string) => wireFromMon(randomFit(r, a, z, 25));
    const held = (w: ReturnType<typeof kind>, notion: string | null) => ({ ...w, notion });
    const expect = (what: string, roster: unknown[], ok: boolean) => {
      const p = teamProblems(roster);
      if (ok && p.length) fail(`online rosters: ${what} was refused: ${p.join(' ')}`);
      if (!ok && !p.length) fail(`online rosters: ${what} passed the check`);
    };
    // Five whorls of kinds that no other line here uses, to fill out each roster.
    const rest = ['hare', 'squall', 'dynamo', 'bramble', 'lune'].map(kind);
    const six = [kind('cairn'), fit('flare', 'tor'), ...rest.slice(0, 4)];
    expect('a roster of six', six, true);
    expect('a roster of five', rest, false);
    expect('a roster of seven', [kind('cairn'), kind('tor'), ...rest], false);
    expect('a team of four', rest.slice(0, 4), false);
    expect('a kind twice', [kind('cairn'), kind('cairn'), ...rest.slice(0, 4)], false);
    expect('a kind alone and in a fit', [fit('flare', 'tor'), kind('flare'), ...rest.slice(0, 4)], false);
    expect('a kind in two fits', [fit('flare', 'tor'), fit('tor', 'cairn'), ...rest.slice(0, 4)], false);
    expect('one legendary', [kind('full'), ...rest], true);
    expect('two legendaries with one in the last slot', [kind('full'), ...rest.slice(0, 4), kind('mundane')], false);
    expect('a fit with a legendary parent and a legendary', [fit('full', 'tor'), kind('mundane'), ...rest.slice(0, 4)], false);
    expect('a fit with a legendary parent', [fit('full', 'tor'), ...rest], true);
    expect('two legendaries sent without their flag', [{ ...kind('full'), legendary: false }, { ...kind('mundane'), legendary: false }, ...rest.slice(0, 4)], false);
    expect('a person', [kind('tackle'), ...rest], false);
    expect('Ouro\'s cast', [{ kind: 'vellumslip', name: 'Ouro', notion: null }, ...rest], false);
    expect('a kind named after an object property', [{ kind: 'constructor', name: 'Odd', notion: null }, ...rest], false);
    expect('an unknown notion', [{ ...kind('cairn'), notion: 'nonsense' }, ...rest], false);
    expect('a different notion on each whorl', ['whetstone', 'bitterroot', 'hideplate', 'waxcoat', 'longshin', 'ribbon'].map((n, i) => held([kind('cairn'), ...rest][i], n)), true);
    expect('one notion on two whorls', [held(kind('cairn'), 'whetstone'), held(rest[0], 'whetstone'), ...rest.slice(1)], false);
    expect('several whorls holding nothing', [held(kind('cairn'), null), held(rest[0], null), ...rest.slice(1)], true);
    const twice = teamProblems([held(kind('cairn'), 'whetstone'), held(rest[0], 'whetstone'), ...rest.slice(1)]).join(' ');
    if (!/Two whorls hold .+\. A roster takes each notion once\./.test(twice)) fail(`online rosters: a repeated notion reads "${twice}"`);
    expect('nacre past the game\'s cap in one stat', [{ ...kind('cairn'), tan: { atk: 7 } }, ...rest], false);
    expect('nacre past the game\'s total', [{ ...kind('cairn'), tan: { atk: 6, hp: 6, def: 1 } }, ...rest], false);
    expect('full nacre', [{ ...kind('cairn'), tan: { atk: 6, hp: 6 } }, ...rest], true);
    const picks: [string, unknown, boolean][] = [['the first four', [0, 1, 2, 3], true], ['four in a new order', [5, 0, 3, 1], true], ['three', [0, 1, 2], false],
      ['five', [0, 1, 2, 3, 4], false], ['one whorl twice', [0, 1, 2, 2], false], ['a whorl off the roster', [0, 1, 2, 6], false], ['a name for a number', [0, 1, 2, '3'], false]];
    for (const [what, p, ok] of picks) if ((pickProblems(p).length === 0) !== ok) fail(`online picks: ${what} ${ok ? 'was refused' : 'passed the check'}`);
    const rosters: [typeof six, typeof six] = [six, [kind('full'), ...rest]];
    const release = { picks: [[5, 0, 3, 1], null] as [number[] | null, number[] | null], timeout: [false, true] as [boolean, boolean] };
    const fours = teamsFromPicks(rosters, release);
    if (fours[0].map(w => w.name).join() !== [5, 0, 3, 1].map(i => six[i].name).join()) fail('online picks: a pick did not set the team and its order');
    if (fours[1].map(w => w.name).join() !== rosters[1].slice(0, 4).map(w => w.name).join()) fail('online picks: a side whose time ran out did not get its first four');
    const rebuilt = rebuild(rosters, ['A', 'B'], 0, release, []);
    if (rebuilt.b.s[0].f.length !== 4 || rebuilt.b.s[0].f[0].mon.name !== six[5].name || rebuilt.b.s[1].f[0].mon.name !== rosters[1][0].name) fail('online picks: a rebuilt battle did not start from the picked fours');
    let refused = false;
    try { teamsFromPicks(rosters, { picks: [[0, 1, 2, 2], [0, 1, 2, 3]], timeout: [false, false] }); } catch { refused = true; }
    if (!refused) fail('online picks: a pick naming one whorl twice was used');
    expect('a tape on Carcanet', [{ ...kind('carcanet'), tape: 'pags' }, ...rest], true);
    expect('a tape on another kind', [{ ...kind('cairn'), tape: 'pags' }, ...rest], false);
    expect('a tape with a stone that does not exist', [{ ...kind('carcanet'), tape: 'pagx' }, ...rest], false);
    const f = fit('flare', 'tor'), ff = f.fit!;
    const odd = TYPES.find(t => !SPECIES.flare.types.includes(t) && !SPECIES.tor.types.includes(t))!;
    expect('a fit with a move from neither parent', [{ ...f, fit: { ...ff, moves: [...ff.moves.slice(0, 3), SPECIES.cairn.moves[0]] } }, ...rest], false);
    expect('a fit with three moves from one parent', [{ ...f, fit: { ...ff, moves: [...SPECIES.flare.moves.slice(0, 3), SPECIES.tor.moves[0]] } }, ...rest], false);
    expect('a fit with a habit neither parent has', [{ ...f, fit: { ...ff, passives: [ff.passives[0], SPECIES.cairn.passives[0]] } }, ...rest], false);
    expect('a fit with a type neither parent has', [{ ...f, fit: { ...ff, types: [odd] } }, ...rest], false);
    expect('a fit with a retune to a type it lacks', [{ ...f, fit: { ...ff, retune: { move: ff.moves[0], type: odd } } }, ...rest], false);
    const made = randomFit(r, 'flare', 'tor', 25);
    made.notion = 'whetstone';
    made.tan = { atk: 6, hp: 6 };
    const back = monFromWire(wireFromMon(made), 1, 2), same = (x: string[] = [], z: string[] = []) => x.join() === z.join();
    if (!same(back.moves, made.moves) || !same(back.passives, made.passives) || !same(back.types, made.types) || !same(back.parentKinds, made.parentKinds)
      || back.basic !== made.basic || back.notion !== 'whetstone' || back.tan?.atk !== 6 || back.level !== 25 || back.uid !== 13) fail('online teams: a fit changed on its way through the wire');
    expect('a name the room left empty', [{ ...kind('cairn'), name: '' }, ...rest], true);
  }

  // Names that reach another player online: the word filter refuses slurs, sexual terms, and strong insults, reads digits
  // that look like letters and repeated letters, and lets innocent names through. No kind's name fails it, so a stand-in
  // always shows whole.
  {
    const { nameBlocked, shownPlayerName, STRANGER } = await import('../net/names');
    const { shownWhorlName, wireFromMon } = await import('../net/wire');
    const { makeMon, SPECIES } = await import('../data/species');
    const { nameOptions } = await import('../game/fitting');
    const refused = ['FUCK', 'fuuuck', 'f.u.c.k', 'B1tch', 'B!tch', 'Sh1thead', 'n1gga', 'C0ck', 'Big Dick', 'p0rn', 'Wh0re', 'S3xy', 'Ass Hole'];
    const innocent = ['Cassie', 'Cockle', 'Peacock', 'Hancock', 'Dickens', 'Grape', 'Therapist', 'Canal', 'Essex', 'Shiitake', 'Cumulus', 'Titan',
      'Spice', 'Japan', 'Bass', 'Assassin', 'Compass', 'Stranger', 'Ouro', 'Pussycat', 'Sextant', 'Scrape', 'Homer', 'Hello', 'Mississippi'];
    for (const n of refused) if (!nameBlocked(n)) fail(`online names: "${n}" passed the word filter`);
    for (const n of innocent) if (nameBlocked(n)) fail(`online names: "${n}" was refused by the word filter`);
    if (shownPlayerName('B1tch') !== STRANGER || shownPlayerName('Tellin') !== 'Tellin' || shownPlayerName('') !== STRANGER) fail('online names: a player name shows the wrong stand-in');
    const kinds = Object.values(SPECIES).filter(s => nameBlocked(s.name)).map(s => s.name);
    if (kinds.length) fail(`online names: the word filter refuses kinds' names: ${kinds.join(', ')}`);
    const one = shownWhorlName({ ...wireFromMon(makeMon('cairn', 25)), name: 'Sh1thead' });
    if (one !== SPECIES.cairn.name) fail(`online names: a refused whorl name shows "${one}"`);
    const fitted = wireFromMon(makeMon('cairn', 25));
    const blend = shownWhorlName({ fit: { kinds: ['flare', 'tor'], moves: [], passives: [], types: [], basic: 'P', retune: null, look: { shape: 0, palette: 0 } }, name: '', notion: fitted.notion });
    if (blend !== nameOptions(SPECIES.flare.name, SPECIES.tor.name)[0]) fail(`online names: a fit's stand-in is "${blend}"`);
  }

  // Every message both ways goes through a reader that refuses extra keys, object-property keys, wrong types, nesting too
  // deep, and frames too long, and builds a fresh message from the fields it checked.
  {
    const { readClient, readRoom } = await import('../net/protocol');
    const takes = (raw: string) => 'm' in readClient(raw);
    const frames: [string, string, boolean][] = [
      ['a ready report', '{"type":"ready","n":3,"hash":"0a1b2c3d","need":{"kind":"joint","sees":null}}', true],
      ['a choice with a move and a target', '{"type":"choose","n":3,"c":{"k":"move","i":1,"target":0}}', true],
      ['a hello with a token', '{"type":"hello","build":"abc","resume":"0f0e-token"}', true],
      ['an extra key', '{"type":"choose","n":3,"c":{"k":"guard","x":1}}', false],
      ['an object-property key', '{"type":"resign","__proto__":{"x":1}}', false],
      ['a decision number with a fraction', '{"type":"choose","n":1.5,"c":null}', false],
      ['a number sent as text', '{"type":"pick","order":[0,1,2,"3"]}', false],
      ['an action no online battle has', '{"type":"choose","n":0,"c":{"k":"run"}}', false],
      ['nesting too deep', '{"type":"ready","n":0,"hash":"0a1b2c3d","need":[[[[[[[[[[]]]]]]]]]]}', false],
      ['a frame too long', JSON.stringify({ type: 'foul', n: 0, why: 'x'.repeat(20_000) }), false],
      ['a reason with a control character', '{"type":"foul","n":0,"why":"bad\\u0007"}', false],
    ];
    for (const [what, raw, want] of frames) if (takes(raw) !== want) fail(`online messages: ${what} was ${want ? 'refused' : 'taken'}`);
    if (readRoom('{"type":"release","n":0,"need":{"kind":"replace2"},"c":[1,2],"timeout":[false,false],"extra":1}') !== null) fail('online messages: a release with an extra key was taken');
    const sent = '{"c":{"i":1,"k":"move"},"n":2,"type":"choose"}', read = readClient(sent);
    if (!('m' in read) || JSON.stringify(read.m) !== '{"type":"choose","n":2,"c":{"k":"move","i":1}}') fail('online messages: a choice was not rebuilt from its checked fields');
  }

  // The Guide: every chapter reads at grade 4 or below, with no dashes or semicolons.
  const { GUIDE, chapterText } = await import('../content/guide');
  const { score, GRADE_MAX } = await import('./readscore');
  for (const ch of GUIDE) {
    const s = score(chapterText(ch));
    if (s.grade > GRADE_MAX) fail(`guide ${ch.id}: reads at grade ${s.grade.toFixed(1)}, over ${GRADE_MAX}`);
    for (const line of chapterText(ch)) if (/[–—;]/.test(line)) fail(`guide ${ch.id}: dash or semicolon in "${line.slice(0, 40)}"`);
  }
  console.log(`${GUIDE.length} Guide chapters, grade ${score(GUIDE.flatMap(chapterText)).grade.toFixed(1)} overall`);

  // Byssus: the service and its Guide chapter open at six whorls with the team and the Midden counted together, the tally counts
  // a win or a loss and skips a match with no winner, and a match's backdrop and track come from its seed alone.
  {
    const { G, addToTally, byssusUnlocked, onlineTally } = await import('../game/state');
    const { outcomeOf } = await import('../game/online');
    const { onlineLook } = await import('../game/battleView');
    const { BACKDROP_KEYS } = await import('../game/backdrops');
    const { BATTLE_TRACKS } = await import('../engine/score');
    const { makeMon } = await import('../data/species');
    const chapter = GUIDE.find(c => c.id === 'byssus');
    if (!chapter) fail('byssus: the Guide has no Byssus chapter');
    const kept = { party: G.party, rack: G.rack, online: G.online };
    const whorls = ['cairn', 'hare', 'squall', 'dynamo', 'bramble', 'lune'].map(k => makeMon(k, 25));
    G.party = whorls.slice(0, 4);
    G.rack = whorls.slice(4, 5);
    if (byssusUnlocked() || chapter?.open()) fail('byssus: five whorls opened the service or its Guide chapter');
    G.rack = whorls.slice(4);
    if (!byssusUnlocked() || !chapter?.open()) fail('byssus: six whorls, four in the team and two in the Midden, did not open the service and its Guide chapter');

    // A save from before the tally holds none, a bad number counts as none, and each match adds one to its side.
    G.online = { roster: [], menu: 0 };
    let t = onlineTally();
    if (t.won !== 0 || t.lost !== 0) fail(`byssus tally: an older save starts at ${t.won} and ${t.lost}`);
    addToTally(true); addToTally(false); addToTally(false);
    t = onlineTally();
    if (t.won !== 1 || t.lost !== 2) fail(`byssus tally: a win and two losses read ${t.won} and ${t.lost}`);
    G.online = { roster: [], menu: 0, won: -3, lost: 'many' as unknown as number };
    t = onlineTally();
    if (t.won !== 0 || t.lost !== 0) fail(`byssus tally: bad numbers read ${t.won} and ${t.lost}`);

    const match = (side: 0 | 1) => ({ type: 'match' as const, side, token: '', names: ['A', 'B'] as [string, string], rosters: [[], []] as [never[], never[]], seed: 1, deal: 1, game: 1, wins: [0, 0] as [number, number], clock: { pick: 90, choice: 60, replace: 30 } });
    const end = (why: 'over' | 'resign' | 'timeouts' | 'gone' | 'void', winner: 0 | 1 | null, wins: [number, number] = [0, 0]) => ({ type: 'end' as const, why, winner, wins, final: true, matchWinner: winner });
    const cases: [string, Parameters<typeof outcomeOf>[0], string | null][] = [
      ['a win on side 0', { end: end('over', 0), match: match(0) }, 'won'],
      ['a loss on side 0', { end: end('over', 1), match: match(0) }, 'lost'],
      ['a win on side 1 when the other player gave up', { end: end('resign', 1), match: match(1) }, 'won'],
      ['a win when the other seat left', { end: end('gone', 0), match: match(0) }, 'won'],
      ['a loss on three timeouts', { end: end('timeouts', 0), match: match(1) }, 'lost'],
      ['a match with no winner', { end: end('void', null), match: match(0) }, null],
      ['both seats gone', { end: end('gone', null), match: match(1) }, null],
      ['a wait that was canceled', { end: null, canceled: true }, null],
      ['a refusal before any match', { end: null, refused: 'Reload the page.' }, null],
      ['an end that came with no match or seat', { end: end('resign', 0) }, null],
      ['a held seat that found its match over and lost', { end: end('resign', 0), side: 1, foe: 'Tellin' }, 'lost'],
      ['a held seat that found its match over and won', { end: end('timeouts', 1), side: 1, foe: 'Tellin' }, 'won'],
      ['a held seat that found a match with no winner', { end: end('void', null), side: 0, foe: 'Tellin' }, null],
      ['a match won on games when its last game had no winner', { end: { ...end('over', null, [1, 0]), matchWinner: 0 }, match: match(0) }, 'won'],
    ];
    for (const [what, r, want] of cases) if (outcomeOf(r) !== want) fail(`byssus tally: ${what} counted as ${outcomeOf(r)}`);

    // The result screen names the winner from the match, or from the seat when the match was already over. It never shows an empty name.
    const { ResultScreen } = await import('../game/online');
    const shows: [string, Parameters<typeof outcomeOf>[0], string][] = [
      ['a match played to its end', { end: end('over', 0, [2, 1]), match: match(0) }, 'You win the match. Games: you 2, B 1'],
      ['a seat that found its match over after the player gave up', { end: end('resign', 0), side: 1, foe: 'Tellin' }, 'Tellin wins the match. You gave up.'],
      ['a seat that found its match over and won on three timeouts', { end: end('timeouts', 1), side: 1, foe: 'Tellin' }, 'You win the match. Tellin ran out of time three times in a row.'],
      ['a seat that kept no name', { end: end('over', 0, [2, 0]), side: 1 }, 'The other player wins the match. Games: you 0, The other player 2'],
      ['a seat whose kept name the word filter refuses', { end: end('gone', 0), side: 1, foe: 'B1tch' }, 'Stranger wins the match. You left the match.'],
      ['an end that came with no match or seat', { end: end('resign', 0) }, 'No result. The match ended while this page was away.'],
      ['a player who left between games', { end: end('resign', 1, [1, 0]), match: match(0), left: true }, 'B wins the match. Games: you 1, B 0 You left the match.'],
    ];
    for (const [what, r, want] of shows) {
      const s = new ResultScreen(r), got = [s.head, s.score, ...s.why].filter(Boolean).join(' ');
      if (got !== want) fail(`byssus result: ${what} reads "${got}", not "${want}"`);
      if (s.choices.join() !== 'Back') fail(`byssus result: ${what} offers ${s.choices.join(' and ')} with no link`);
    }

    // Every backdrop and track comes up with every other over 18 seeds, the same seed always gives the same pair, and no track
    // belongs to a person or a story fight.
    const owned = new Set(['rival', 'legend', 'battleHand', 'battleCinch', 'battlePeel', 'collector', 'holm']);
    const pairs = new Set<string>();
    for (let seed = 0; seed < 18; seed++) {
      const a = onlineLook(seed), b = onlineLook(seed);
      pairs.add(`${a.scene}/${a.music}`);
      if (a.scene !== b.scene || a.music !== b.music) fail(`byssus look: seed ${seed} gave two different pairs`);
      if (!BACKDROP_KEYS().includes(a.scene)) fail(`byssus look: seed ${seed} names the backdrop ${a.scene}, which does not exist`);
      if (!BATTLE_TRACKS.has(a.music) || owned.has(a.music)) fail(`byssus look: seed ${seed} names the track ${a.music}, which is not a battle track free of the story`);
    }
    if (pairs.size !== 18) fail(`byssus look: 18 seeds gave ${pairs.size} different pairs of backdrop and track`);
    G.party = kept.party; G.rack = kept.rack; G.online = kept.online;
    console.log(`byssus: the chapter opens at six whorls, ${cases.length} results counted, ${shows.length} result screens read, ${pairs.size} looks`);
  }

  for (const w of warn) console.log('warn: ' + w);
  for (const e of errors) console.log('FAIL: ' + e);
  console.log(`${Object.keys(MAPS).length} maps, ${Object.keys(SCRIPTS).length} scripts, ${Object.keys(MOVES).length} moves, ${Object.keys(PASSIVES).length} passives. ${errors.length} failures, ${warn.length} warnings.`);
  if (errors.length) process.exitCode = 1;
}

main();
