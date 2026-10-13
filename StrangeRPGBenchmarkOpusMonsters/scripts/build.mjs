// Bundles the game into dist/. With --tools, also bundles the test and balance tools into dist-tools/.
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const tools = args.includes('--tools');
const watch = args.includes('--watch');

/** Online play pairs only builds with the same fingerprint: a hash of everything a battle's result can depend on. */
function fingerprint() {
  const files = [path.join(root, 'src', 'game', 'fitting.ts')];
  // The move sound specs in src/data never reach a battle's result, so a sound edit leaves the fingerprint alone.
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts') && !/^sounds\d*\.ts$/.test(e.name)) files.push(p); } };
  for (const d of ['battle', 'data', 'net']) walk(path.join(root, 'src', d));
  const h = createHash('sha256');
  // Line endings and path separators differ between a Windows checkout and the CI build and must not change the hash.
  const rel = files.map(f => path.relative(root, f).split(path.sep).join('/')).sort();
  for (const f of rel) h.update(f + '\n' + fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n'));
  return h.digest('hex').slice(0, 16);
}

/** The deployed Byssus Worker that the published game reaches. A game served from localhost uses `wrangler dev` on port 8787. */
const BYSSUS_URL = process.env.BYSSUS_URL ?? 'https://whorl-byssus.maplesugarstone.workers.dev';

const common = { bundle: true, logLevel: 'warning', target: 'es2022', define: { __WHORL_BUILD__: JSON.stringify(fingerprint()), __BYSSUS_URL__: JSON.stringify(BYSSUS_URL) } };

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
  for (const name of ['test', 'sim', 'story', 'music-check', 'music-wav', 'duel', 'meta', 'maps', 'kits', 'review', 'obtain', 'readability', 'profiles', 'usage', 'aibench', 'fuzz', 'lockstep', 'nettest']) {
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
