// Bundles the game into dist/. With --tools, also bundles the test and balance tools into dist-tools/.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const tools = args.includes('--tools');
const watch = args.includes('--watch');

const common = { bundle: true, logLevel: 'warning', target: 'es2022' };

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

if (watch) {
  const ctx = await esbuild.context(game);
  await ctx.watch();
  console.log('Watching src/ for changes.');
} else {
  await esbuild.build(game);
}

if (tools) {
  const entries = {};
  for (const name of ['test', 'sim', 'story', 'music-check', 'music-wav', 'duel', 'meta', 'maps', 'kits', 'review', 'obtain', 'readability', 'profiles']) {
    const file = path.join(root, 'src', 'tools', `${name}.ts`);
    if (fs.existsSync(file)) entries[name] = file;
  }
  await esbuild.build({
    ...common,
    entryPoints: entries,
    outdir: path.join(root, 'dist-tools'),
    format: 'esm',
    platform: 'node',
  });
}
