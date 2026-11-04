// Supervisor-owned build: bundles src/main.ts into dist/game.js and writes dist/index.html.
// esbuild only parses and bundles, so no game code runs here. No plugins, and the supervisor's tsconfig.
import fs from "node:fs";
import path from "node:path";
import { verifyDeps } from "./verify_deps.mjs";

verifyDeps();
const esbuild = await import("esbuild");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DIST = path.join(ROOT, "dist");

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const result = await esbuild.build({
  entryPoints: [path.join(ROOT, "src", "main.ts")],
  outfile: path.join(DIST, "game.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  tsconfig: path.join(ROOT, "tools", "approved", "tsconfig.json"),
  logLevel: "silent",
  absWorkingDir: ROOT,
}).catch((e) => e);
if (result.errors?.length) {
  const msgs = await esbuild.formatMessages(result.errors, { kind: "error", color: false });
  console.error(msgs.join("\n"));
  process.exit(1);
}
fs.writeFileSync(path.join(DIST, "index.html"), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ruin</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated}</style>
</head>
<body>
<script src="game.js"></script>
</body>
</html>
`);
console.log("built dist/index.html and dist/game.js");
