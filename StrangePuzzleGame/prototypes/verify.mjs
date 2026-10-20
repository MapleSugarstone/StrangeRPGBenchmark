// Proves every puzzle is solvable. A and B get a breadth-first search for the shortest solution, C runs its reference tapes.
// Usage: node tools/verify.mjs [levelId ...] [--cap N]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
for (const f of ['rulesA.js', 'rulesB.js', 'rulesC.js', 'levels.js']) vm.runInThisContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), { filename: f });

const args = process.argv.slice(2);
const capAt = args.indexOf('--cap');
const CAP = capAt >= 0 ? +args[capAt + 1] : 4_000_000;
const only = args.filter((a, i) => !a.startsWith('--') && (capAt < 0 || i !== capAt + 1));
const NAMES = 'URDL';

function actName(a) {
  if (a.t === 'move') return NAMES[a.d];
  if (a.t === 'zap') return 'x' + NAMES[a.d];
  if (a.t === 'drop') return 'd' + a.c;
  return 'w';
}

function bfs(R, def) {
  const s0 = R.load(def);
  const seen = new Map([[R.key(s0), null]]);
  let frontier = [s0], depth = 0;
  const t0 = Date.now();
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const a of R.actions(s)) {
        const r = R.step(s, a);
        if (!r || r.s.lost) continue;
        const k = R.key(r.s);
        if (seen.has(k)) continue;
        seen.set(k, [R.key(s), a]);
        if (r.s.won) {
          const path = [];
          let cur = k;
          while (seen.get(cur)) { const [pk, pa] = seen.get(cur); path.unshift(actName(pa)); cur = pk; }
          return { ok: true, len: path.length, path: path.join(' '), states: seen.size, ms: Date.now() - t0 };
        }
        next.push(r.s);
        if (seen.size > CAP) return { ok: false, capped: true, states: seen.size, depth };
      }
    }
    frontier = next;
    depth++;
  }
  return { ok: false, states: seen.size, depth };
}

let bad = 0;
for (const [build, R] of [['A', RulesA], ['B', RulesB]]) {
  for (const def of LEVELS[build]) {
    if (only.length && !only.includes(def.id)) continue;
    const r = bfs(R, def);
    if (!r.ok) bad++;
    console.log(`${def.id} ${def.name}: ${r.ok ? `solved in ${r.len} moves (${r.states} states, ${r.ms} ms)\n  ${r.path}` : `NO SOLUTION${r.capped ? ' (state cap hit)' : ''} after ${r.states} states, depth ${r.depth}`}`);
  }
}
for (const def of LEVELS.C) {
  if (only.length && !only.includes(def.id)) continue;
  if (!def.ref || !def.ref.length) { console.log(`${def.id} ${def.name}: no reference tape yet`); bad++; continue; }
  const prog = def.ref.map((p) => ({ x: p.x, y: p.y, d: p.d, tape: p.tape.split('').map((c) => (c === '.' ? '' : c)) }));
  const r = RulesC.run(def, prog);
  if (!r.ok) bad++;
  console.log(`${def.id} ${def.name}: ${r.ok ? `reference solves it: ${r.cycles} cycles, cost ${r.cost}, area ${r.area}` : `reference FAILS: ${r.error && r.error.msg} at cycle ${r.cycles}`}`);
}
process.exit(bad ? 1 : 0);
