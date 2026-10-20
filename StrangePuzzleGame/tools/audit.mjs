// Measures every level against Notes/puzzle-quality.md: solvable, floor, needs, load-bearing pieces, random play, forbidden insights, depth.
// Usage: node --max-old-space-size=8000 tools/audit.mjs [levelId ...] [--fast] [--minutes N]
// --fast skips the load-bearing and random-play checks. A level with an alt field gets route checks in place of the load-bearing check. Progress goes to Notes/audit-progress.txt every few seconds.
// Creating Notes/audit.stop ends the run after the current check, and the report is marked partial.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['rules.js', 'levels.js']) vm.runInThisContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), { filename: f });

const args = process.argv.slice(2);
const fast = args.includes('--fast');
const minutes = Number(args[args.indexOf('--minutes') + 1]) || 0;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--minutes');
const progressFile = path.join(root, 'Notes', 'audit-progress.txt');
const stopFile = path.join(root, 'Notes', 'audit.stop');
const CAP = 3_000_000;
const FLOOR = [12, 18, 18, 20, 20, 20, 20, 20];
const t0 = Date.now();

// Breadth-first search. Returns the shortest length, the state count, and optionally the path.
function bfs(def, { withPath = false, forbid = null } = {}) {
  const s0 = Rules.load(def);
  const parent = withPath ? new Map([[Rules.key(s0), null]]) : null;
  const seen = new Set([Rules.key(s0)]);
  let frontier = [s0], depth = 0;
  while (frontier.length) {
    const next = [];
    depth++;
    for (const s of frontier) {
      const ks = withPath ? Rules.key(s) : null;
      for (const a of Rules.actions(s)) {
        const r = Rules.step(s, a);
        if (!r || r.s.lost) continue;
        if (forbid && r.ev.some((e) => forbid.some((f) => Object.keys(f).every((k) => e[k] === f[k])))) continue;
        const k = Rules.key(r.s);
        if (seen.has(k)) continue;
        seen.add(k);
        if (parent) parent.set(k, [ks, a]);
        if (r.s.won) {
          let p = null;
          if (parent) { p = []; let cur = k; while (parent.get(cur)) { const [pk, pa] = parent.get(cur); p.unshift(pa); cur = pk; } }
          return { ok: true, len: depth, states: seen.size, path: p };
        }
        if (seen.size > CAP) return { ok: false, capped: true, states: seen.size };
        next.push(r.s);
      }
    }
    frontier = next;
  }
  return { ok: false, states: seen.size };
}

const NAMES = 'URDL';
const actName = (a) => a.t === 'move' ? NAMES[a.d] : a.t === 'zap' ? 'x' + NAMES[a.d] : a.t === 'drop' ? 'd' + a.c : 'w';
const clone = (o) => JSON.parse(JSON.stringify(o));
const setChar = (map, x, y, c) => map.map((r, j) => (j === y ? r.slice(0, x) + c + r.slice(x + 1) : r));

// A needs entry is a recipe name, a map character to clear, or a swap: 'c/t', ['c', 't'], or the older 'c>t'.
function without(def, need) {
  const d = clone(def);
  if (d.recipes && d.recipes[need] !== undefined) { delete d.recipes[need]; return d; }
  const [from, to] = Array.isArray(need) ? need : need.includes('/') ? need.split('/') : need.length === 3 && need[1] === '>' ? [need[0], need[2]] : [need, '.'];
  d.map = d.map.map((r) => r.split(from).join(to));
  if (from === 'B' || from === 'M' || from === 'N') return d;
  d.objs = (d.objs || []).filter((o) => o.k !== need);
  return d;
}

// Every bit and placed piece, with a variant that removes it.
function pieces(def) {
  const out = [];
  def.map.forEach((row, y) => [...row].forEach((c, x) => {
    if ('rybtBMN'.includes(c)) out.push({ name: `${c}@${x},${y}`, kind: 'map', x, y, def: Object.assign(clone(def), { map: setChar(def.map, x, y, '.') }) });
  }));
  (def.stacks || []).forEach((st, i) => out.push({ name: `stack ${st.bits}@${st.x},${st.y}`, kind: 'stack', i, def: Object.assign(clone(def), { stacks: def.stacks.filter((_, j) => j !== i) }) }));
  (def.objs || []).forEach((o, i) => out.push({ name: `${o.k}@${o.x},${o.y}`, kind: 'obj', i, def: Object.assign(clone(def), { objs: def.objs.filter((_, j) => j !== i) }) }));
  const spare = new Set(def.spare || []);
  return out.filter((p) => !spare.has(loc(p)) && !spare.has(p.name));
}
const loc = (p) => p.name.replace(/^stack \w+@/, '').replace(/^\w+@/, '');

// A copy of def with every listed piece removed.
function strip(def, list) {
  const d = clone(def), stackIdx = new Set(), objIdx = new Set();
  for (const p of list) {
    if (p.kind === 'map') d.map = setChar(d.map, p.x, p.y, '.');
    else if (p.kind === 'stack') stackIdx.add(p.i);
    else objIdx.add(p.i);
  }
  if (def.stacks) d.stacks = def.stacks.filter((_, j) => !stackIdx.has(j));
  if (def.objs) d.objs = def.objs.filter((_, j) => !objIdx.has(j));
  return d;
}
// The state without Pilcrow's position, so walking does not count as changing the board.
function boardKey(s) { const k = Rules.key(s), a = k.indexOf(','), b = k.indexOf(',', a + 1); return k.slice(b + 1); }
function boardActs(def, path) {
  let s = Rules.load(def), prev = boardKey(s), n = 0;
  for (const a of path) { s = Rules.step(s, a).s; const k = boardKey(s); if (k !== prev) n++; prev = k; }
  return n;
}

// A level may declare a second solution with alt: { pieces: ['x,y', ...] }, the pieces only that route uses.
// The primary route's own pieces are the others whose removal leaves the level solvable. Every piece must be needed by
// at least one route, removing both routes' own pieces must leave the level unsolvable, and the alternate is never a
// shortcut: forced onto it, the shortest win takes at least as many moves (the search depth) and board-changing actions,
// and the level's own shortest win is the primary's, so the alternate's pieces neither block the primary nor combine into a shorter route.
function routeChecks(def, all, fails, notes, mainLen) {
  const tag = new Set(def.alt.pieces || []);
  const altP = all.filter((p) => tag.has(loc(p)) || tag.has(p.name));
  if (altP.length < tag.size) fails.push('alt names a piece that is not in the level');
  const rest = all.filter((p) => !altP.includes(p));
  const mainOnly = rest.filter((p) => { writeProgress(`${def.id}: route piece ${p.name}`); return bfs(p.def).ok; });
  writeProgress(`${def.id}: routes`);
  const primDef = strip(def, altP), altDef = strip(def, mainOnly);
  const prim = bfs(primDef, { withPath: true }), alt = bfs(altDef, { withPath: true });
  if (!prim.ok) { fails.push('the primary route is unsolvable on its own'); return; }
  if (!alt.ok) { fails.push('the alternate route is unsolvable on its own'); return; }
  if (!mainOnly.length) fails.push('the primary route has no pieces of its own');
  if (bfs(strip(def, altP.concat(mainOnly))).ok) fails.push('still solvable with both routes\' own pieces removed');
  for (const p of rest) {
    writeProgress(`${def.id}: primary piece ${p.name}`);
    const r = bfs(strip(def, altP.concat([p])));
    if (r.ok && r.len < prim.len * 1.25) fails.push(`${p.name} not load-bearing on the primary route (${r.len} moves without it)`);
  }
  for (const p of altP) {
    writeProgress(`${def.id}: alternate piece ${p.name}`);
    const r = bfs(strip(def, mainOnly.concat([p])));
    if (r.ok && r.len < alt.len * 1.25) fails.push(`${p.name} not load-bearing on the alternate route (${r.len} moves without it)`);
  }
  const pa = boardActs(primDef, prim.path), aa = boardActs(altDef, alt.path);
  if (alt.len < prim.len) fails.push(`the alternate route is a shortcut (${alt.len} < ${prim.len} moves)`);
  if (mainLen !== prim.len) fails.push(`the level's shortest win (${mainLen} moves) is not the primary route (${prim.len} moves)`);
  if (aa < pa) fails.push(`the alternate route needs fewer board-changing actions (${aa} < ${pa})`);
  notes.push(`primary ${prim.len} moves, ${pa} board actions, ${prim.states} states; alternate ${alt.len} moves, ${aa} board actions, ${alt.states} states`);
}

// A random player that avoids undoing its last move. Returns the share of runs that win.
function randomPlay(def, cap, runs = 300) {
  let wins = 0, seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let r = 0; r < runs; r++) {
    let s = Rules.load(def), prev = null;
    for (let i = 0; i < cap; i++) {
      const opts = [];
      for (const a of Rules.actions(s)) { const n = Rules.step(s, a); if (n && Rules.key(n.s) !== prev) opts.push(n.s); }
      if (!opts.length) break;
      prev = Rules.key(s);
      s = opts[Math.floor(rnd() * opts.length)];
      if (s.won) { wins++; break; }
      if (s.lost) break;
    }
  }
  return wins / runs;
}

const levels = LEVELS.filter((l) => !only.length || only.includes(l.id));
const report = [];
let stopped = false, done = 0;
function writeProgress(current) {
  const el = (Date.now() - t0) / 1000, per = done ? el / done : 0;
  const eta = per ? Math.round(per * (levels.length - done)) : '?';
  fs.writeFileSync(progressFile, `audit ${done}/${levels.length} levels, ${Math.round(el)} s elapsed, about ${eta} s left\nnow: ${current}\n\n${report.map((r) => r.line).join('\n')}\n`);
}
function shouldStop() { return fs.existsSync(stopFile) || (minutes && Date.now() - t0 > minutes * 60000); }

for (const def of levels) {
  if (shouldStop()) { stopped = true; break; }
  const li = LEVELS.indexOf(def), area = def.area || 0, fails = [], notes = [];
  writeProgress(`${def.id}: search`);
  const rows = def.map.length, cols = Math.max(...def.map.map((r) => r.length));
  if (rows > 9 || cols > 12) fails.push(`too big ${cols}x${rows}`);
  const main = bfs(def, { withPath: true });
  if (!main.ok) fails.push(main.capped ? 'state cap hit' : 'unsolvable');
  else {
    const floor = def.intro ? 8 : def.boss ? 0 : FLOOR[area] || 20;
    if (main.len < floor) fails.push(`shortest ${main.len} < floor ${floor}`);
    if (!def.idea) notes.push('no idea written');
    for (const need of def.needs || []) {
      writeProgress(`${def.id}: needs ${need}`);
      const r = bfs(without(def, need));
      if (r.ok) fails.push(`still solvable without ${need} (${r.len} moves)`);
    }
    if (def.forbid) {
      writeProgress(`${def.id}: forbid`);
      const r = bfs(def, { forbid: def.forbid });
      if (r.ok) fails.push(`solvable with the insight forbidden (${r.len} moves)`);
    }
    if (!fast) {
      if (def.alt) routeChecks(def, pieces(def), fails, notes, main.len);
      else for (const p of pieces(def)) {
        if (shouldStop()) break;
        writeProgress(`${def.id}: piece ${p.name}`);
        const r = bfs(p.def);
        if (r.ok && r.len < main.len * 1.25) fails.push(`${p.name} not load-bearing (${r.len} moves without it)`);
      }
      writeProgress(`${def.id}: random play`);
      const rate = randomPlay(def, main.len * 10);
      if (rate >= 0.02) fails.push(`random play wins ${(rate * 100).toFixed(1)}%`);
      else notes.push(`random ${(rate * 100).toFixed(1)}%`);
    }
    if (main.states > 2_000_000) notes.push('over 2M states');
  }
  const line = `${String(li + 1).padStart(2)} ${def.id.padEnd(12)} ${main.ok ? `${String(main.len).padStart(3)} moves ${String(main.states).padStart(8)} states` : 'NO SOLUTION'.padEnd(28)}  ${fails.length ? 'FAIL: ' + fails.join('; ') : 'ok'}${notes.length ? '  (' + notes.join(', ') + ')' : ''}`;
  report.push({ id: def.id, fails, line, path: main.path ? main.path.map(actName).join(' ') : '' });
  console.log(line);
  done++;
  writeProgress('');
}
const failed = report.filter((r) => r.fails.length).length;
const summary = `${stopped ? `PARTIAL: ${done} of ${levels.length} levels audited. ` : ''}${failed} of ${report.length} levels failed.`;
console.log(summary);
fs.writeFileSync(progressFile, `${summary}\n\n${report.map((r) => r.line + (r.path ? '\n    ' + r.path : '')).join('\n')}\n`);
if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
process.exit(failed ? 1 : 0);
