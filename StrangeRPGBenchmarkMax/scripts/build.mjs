// Bundles the game into dist/. With --tools, also bundles the test and balance tools into dist-tools/.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const tools = args.includes('--tools');
const watch = args.includes('--watch');

const common = { bundle: true, logLevel: 'warning', target: 'es2022', loader: { '.txt': 'text' } };

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(root, 'dist', 'index.html'));

const game = {
  ...common,
  entryPoints: [path.join(root, 'src', 'main.ts')],
  outfile: path.join(root, 'dist', 'game.js'),
  format: 'iife',
  platform: 'browser',
  minify: !watch,
  sourcemap: watch,
};

// The menu's Soundtrack screen loads this next to index.html. See the root README, under Soundtracks.
const soundtrack = { ...game, entryPoints: [path.join(root, 'src', 'soundtrack.ts')], outfile: path.join(root, 'dist', 'soundtrack.js') };

if (watch) {
  const ctx = await esbuild.context(game);
  await ctx.watch();
  await (await esbuild.context(soundtrack)).watch();
  console.log('Watching src/ for changes.');
} else {
  await esbuild.build(game);
  await esbuild.build(soundtrack);
}

if (tools) {
  const dir = path.join(root, 'src', 'tools');
  const entries = {};
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.ts')) entries[f.slice(0, -3)] = path.join(dir, f);
  }
  await esbuild.build({
    ...common,
    entryPoints: entries,
    outdir: path.join(root, 'dist-tools'),
    format: 'esm',
    platform: 'node',
    outExtension: { '.js': '.js' },
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  });
}
