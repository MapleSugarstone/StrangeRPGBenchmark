// Proves every level is solvable with a breadth-first search and prints the shortest solution.
// Usage: node tools/verify.mjs [levelId ...] [--cap N] [--variant '{"id":"lobby","husks":[{"hp":99}]}']
// A variant patches one level before the search, to check that a shortcut stays closed.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['rules.js', 'levels.js']) vm.runInThisContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), { filename: f });

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const CAP = Number(opt('--cap')) || 4_000_000;
const variant = opt('--variant') ? JSON.parse(opt('--variant')) : null;
const only = args.filter((a, i) => !a.startsWith('--') && !['--cap', '--variant'].includes(args[i - 1]));
const NAMES = 'URDL';

function actName(a) {
  if (a.t === 'move') return NAMES[a.d];
  if (a.t === 'zap') return 'x' + NAMES[a.d];
  if (a.t === 'drop') return 'd' + a.c;
  return 'w';
}

export function bfs(def) {
  const s0 = Rules.load(def);
  const seen = new Map([[Rules.key(s0), null]]);
  let frontier = [s0], depth = 0;
  const t0 = Date.now();
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const a of Rules.actions(s)) {
        const r = Rules.step(s, a);
        if (!r || r.s.lost) continue;
        const k = Rules.key(r.s);
        if (seen.has(k)) continue;
        seen.set(k, [Rules.key(s), a]);
        if (r.s.won) {
          const p = [];
          let cur = k;
          while (seen.get(cur)) { const [pk, pa] = seen.get(cur); p.unshift(actName(pa)); cur = pk; }
          return { ok: true, len: p.length, path: p.join(' '), states: seen.size, ms: Date.now() - t0 };
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
for (const base of LEVELS) {
  if (only.length && !only.includes(base.id)) continue;
  if (variant && variant.id !== base.id) continue;
  const def = variant ? Object.assign({}, base, variant) : base;
  const rows = def.map.length, cols = Math.max(...def.map.map((r) => r.length));
  if (rows > 9 || cols > 12) { console.log(`${def.id}: TOO BIG (${cols}x${rows}, limit 12x9)`); bad++; continue; }
  const r = bfs(def);
  if (!r.ok && !variant) bad++;
  console.log(`${def.id} ${def.name}${variant ? ' (variant)' : ''}: ${r.ok ? `solved in ${r.len} moves (${r.states} states, ${r.ms} ms)\n  ${r.path}` : `NO SOLUTION${r.capped ? ' (state cap hit)' : ''} after ${r.states} states, depth ${r.depth}`}`);
}
process.exit(bad ? 1 : 0);
