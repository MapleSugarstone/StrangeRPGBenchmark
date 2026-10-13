// Bundles one server test with esbuild, with `cloudflare:workers` pointed at the stub, and runs the bundle with node.
// Usage: node test/run.mjs <room|fuzz> [--out=<folder for the bundle>] [arguments for the test]
// The bundle goes to the system's temporary folder unless --out names another, so two runs never share one file.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRIES = { room: 'room.test.ts', fuzz: 'fuzz.ts' };
const [name, ...rest] = process.argv.slice(2);
if (!ENTRIES[name]) {
  console.log(`usage: node test/run.mjs <${Object.keys(ENTRIES).join('|')}> [--out=folder] [arguments]`);
  process.exit(2);
}
const outArg = rest.find(a => a.startsWith('--out='));
const outDir = outArg ? path.resolve(outArg.slice(6)) : os.tmpdir();
const outfile = path.join(outDir, `byssus-${name}-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(here, ENTRIES[name])],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  outfile,
  logLevel: 'warning',
  plugins: [{
    name: 'workers-stub',
    setup(b) { b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: path.join(here, 'stub-workers.ts') })); },
  }],
});
const run = spawnSync(process.execPath, [outfile, ...rest.filter(a => a !== outArg)], { stdio: 'inherit' });
process.exitCode = run.status ?? 1;
