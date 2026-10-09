export {};
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
  const { crossable, checkStory, checkPuzzles, RING_MAPS } = await import('./worldcheck');
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
  const { PUZZLES } = await import('../game/setting/puzzles');
  const { runAll, TAPE_LEN } = await import('../game/setting/core');
  const settingLine: string[] = [];
  for (const pz of PUZZLES) {
    const r = runAll(pz, pz.ref);
    if (!r.ok) fail(`setting ${pz.id} ${pz.name}: reference fails: ${r.err} at cycle ${r.cycles}`);
    for (const p of pz.ref.parts) if (p.kind === 'arm' && p.tape.length > TAPE_LEN) fail(`setting ${pz.id}: a tape is longer than ${TAPE_LEN}`);
    settingLine.push(`${pz.id} ${r.cycles}/${r.cost}/${r.area}`);
  }
  if (PUZZLES.length !== 12) fail(`setting: ${PUZZLES.length} puzzles, expected 12`);
  console.log(`setting: ${settingLine.join(', ')}`);

  // Carcanet: its Tape sets Stones in order, a fifth pushes off the oldest, the newest Stone shapes its moves, Cleave
  // takes off the oldest, the crest reaches reserves only with four kinds, and the AI prices a full collar.
  {
    const { newBattle, runMove, out: outOf } = await import('../battle/engine');
    const { evaluate } = await import('../battle/ai');
    const { collar, setNext } = await import('../data/kits7');
    const { makeMon } = await import('../data/species');
    const carc = (tape: string, sets: number) => {
      const m = makeMon('carcanet', 50);
      m.tape = tape;
      const b = newBattle({ mons: [m], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 50), makeMon('hare', 50)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
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
    const facet = (tape: string) => { const t = carc(tape, 4), foe = outOf(t.b, 1), hp = foe.hp; runMove(t.b, t.f, 0, {}); return hp - foe.hp; };
    const amberHit = facet('aaaa'), pearlHit = facet('pppp');
    if (!(Math.abs(amberHit / pearlHit - 1.25) < 0.03)) fail(`carcanet: Facet under amber ${amberHit}, under pearl ${pearlHit}, expected 1.25x`);
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
      const b = newBattle({ mons: [makeMon(kind, 50), makeMon('cairn', 50)], name: 'A', ai: 'keeper' }, { mons: [makeMon('cairn', 50), makeMon('hare', 50)], name: 'Z', ai: 'keeper' }, { nerve: true, wild: false, sync: true, canRun: false });
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
    if (stacks(mund.f, 'mundane_layer') !== 4) fail(`mundane: starts with ${stacks(mund.f, 'mundane_layer')} Layers, expected 4`);
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

  // The Guide: every chapter reads at grade 4 or below, with no dashes or semicolons.
  const { GUIDE, chapterText } = await import('../content/guide');
  const { score, GRADE_MAX } = await import('./readscore');
  for (const ch of GUIDE) {
    const s = score(chapterText(ch));
    if (s.grade > GRADE_MAX) fail(`guide ${ch.id}: reads at grade ${s.grade.toFixed(1)}, over ${GRADE_MAX}`);
    for (const line of chapterText(ch)) if (/[–—;]/.test(line)) fail(`guide ${ch.id}: dash or semicolon in "${line.slice(0, 40)}"`);
  }
  console.log(`${GUIDE.length} Guide chapters, grade ${score(GUIDE.flatMap(chapterText)).grade.toFixed(1)} overall`);

  for (const w of warn) console.log('warn: ' + w);
  for (const e of errors) console.log('FAIL: ' + e);
  console.log(`${Object.keys(MAPS).length} maps, ${Object.keys(SCRIPTS).length} scripts, ${Object.keys(MOVES).length} moves, ${Object.keys(PASSIVES).length} passives. ${errors.length} failures, ${warn.length} warnings.`);
  if (errors.length) process.exitCode = 1;
}

main();
