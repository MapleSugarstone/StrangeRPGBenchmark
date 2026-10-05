import * as esbuild from "esbuild";
import { mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const watch = process.argv.includes("--watch");
const sim = process.argv.includes("--sim");
const validate = process.argv.includes("--validate");

mkdirSync("dist", { recursive: true });

if (sim || validate) {
  await esbuild.build({
    entryPoints: [sim ? "src/sim/main.ts" : "src/tools/validate.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: sim ? "dist/sim.js" : "dist/validate.js",
    sourcemap: true,
    logLevel: "info",
  });
  process.exit(0);
}

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: "dist/game.js",
  sourcemap: true,
  minify: false,
  logLevel: "info",
});

function copyWeb() {
  if (!existsSync("web")) return;
  for (const f of readdirSync("web")) copyFileSync(join("web", f), join("dist", f));
}

copyWeb();

if (watch) {
  await ctx.watch();
  console.log("watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
