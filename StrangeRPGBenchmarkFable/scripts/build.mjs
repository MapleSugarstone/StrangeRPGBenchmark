import * as esbuild from "esbuild";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";

const watch = process.argv.includes("--watch");
const sim = process.argv.includes("--sim");

mkdirSync("dist", { recursive: true });

if (sim) {
  await esbuild.build({
    entryPoints: ["src/sim/main.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: "dist/sim.js",
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

if (existsSync("web/index.html")) copyFileSync("web/index.html", "dist/index.html");
if (existsSync("web/style.css")) copyFileSync("web/style.css", "dist/style.css");

if (watch) {
  await ctx.watch();
  console.log("watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
