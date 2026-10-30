// Bundles the game into dist/. With --tools, also bundles the test, sim, and audio tools into dist-tools/.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const watch = args.includes('--watch');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(root, 'dist', 'index.html'));

const game = {
  entryPoints: [path.join(root, 'src', 'main.ts')],
  outfile: path.join(root, 'dist', 'game.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: !watch,
  sourcemap: watch,
  logLevel: 'warning',
};

// The launcher's Soundtrack screen loads dist/soundtrack.js. The contract is in the root README, under Soundtracks.
const soundtrack = { ...game, entryPoints: [path.join(root, 'src', 'soundtrack.ts')], outfile: path.join(root, 'dist', 'soundtrack.js'), sourcemap: false };

if (watch) {
  const ctx = await esbuild.context(game);
  await ctx.watch();
  console.log('Watching src/ for changes.');
} else {
  await esbuild.build(game);
  console.log('Built dist/game.js');
}
await esbuild.build(soundtrack);
console.log('Built dist/soundtrack.js');

if (args.includes('--tools')) {
  const entries = {};
  const dir = path.join(root, 'src', 'tools');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (f.endsWith('.ts')) entries[f.slice(0, -3)] = path.join(dir, f);
  await esbuild.build({
    entryPoints: entries,
    outdir: path.join(root, 'dist-tools'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'warning',
  });
  console.log('Built dist-tools/');
}
