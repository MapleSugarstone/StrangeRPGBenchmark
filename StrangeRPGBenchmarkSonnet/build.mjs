import { build } from 'esbuild';
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';

const mode = process.argv[2] ?? 'game';
mkdirSync('dist', { recursive: true });

if (mode === 'game' || mode === 'all') {
  await build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/game.js',
    minify: false,
    sourcemap: false,
  });
  copyFileSync('web/index.html', 'dist/index.html');
  console.log('built dist/game.js');
}

if (mode === 'tools' || mode === 'all') {
  const tools = readdirSync('src/tools').filter((f) => f.endsWith('.ts'));
  await build({
    entryPoints: tools.map((f) => `src/tools/${f}`),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outdir: 'dist/tools',
    outExtension: { '.js': '.js' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  console.log('built tools');
}
