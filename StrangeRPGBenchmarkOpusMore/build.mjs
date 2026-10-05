import * as esbuild from 'esbuild';
import fs from 'node:fs';

const args = process.argv.slice(2);

if (args.includes('--validate')) {
  await esbuild.build({
    entryPoints: ['src/tools/validate.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: 'build/validate.cjs',
    logLevel: 'warning',
  });
} else if (args.includes('--sim')) {
  await esbuild.build({
    entryPoints: ['src/sim/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: 'build/sim.cjs',
    sourcemap: 'inline',
    logLevel: 'warning',
  });
} else {
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('index.html', 'dist/index.html');
  const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: 'dist/game.js',
    sourcemap: 'linked',
    logLevel: 'warning',
  });
  if (args.includes('--watch')) {
    await ctx.watch();
    console.log('Watching src for changes.');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Built dist/game.js');
  }
}
