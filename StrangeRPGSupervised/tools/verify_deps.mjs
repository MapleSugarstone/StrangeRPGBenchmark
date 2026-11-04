// Checks node_modules against the supervisor's recorded hashes before any script loads esbuild or tsc from it,
// because a changed file there would run in Node. A mismatch reinstalls from the approved lockfile.
//   node tools/verify_deps.mjs --record   (supervisor only, after an approved install)
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const MODULES = path.join(ROOT, "node_modules");
const MANIFEST = path.join(ROOT, "tools", "approved", "node_modules.sha256.json");
const same = (a, b) => fs.existsSync(a) && fs.existsSync(b) &&
  fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n") === fs.readFileSync(b, "utf8").replace(/\r\n/g, "\n");

function hashTree() {
  const out = {};
  const walk = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, d.name);
      const rel = path.relative(MODULES, full).replace(/\\/g, "/");
      if (d.isSymbolicLink()) out[rel] = "link";
      else if (d.isDirectory()) walk(full);
      else out[rel] = createHash("sha256").update(fs.readFileSync(full)).digest("hex");
    }
  };
  if (fs.existsSync(MODULES)) walk(MODULES);
  return out;
}

function differences(want, have) {
  const keys = new Set([...Object.keys(want), ...Object.keys(have)]);
  return [...keys].filter((k) => want[k] !== have[k]);
}

export function verifyDeps() {
  if (!fs.existsSync(MANIFEST)) throw new Error("tools/approved/node_modules.sha256.json is missing.");
  const want = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!differences(want, hashTree()).length) return;
  if (!same(path.join(ROOT, "package.json"), path.join(ROOT, "tools", "approved", "package.json")) ||
      !same(path.join(ROOT, "package-lock.json"), path.join(ROOT, "tools", "approved", "package-lock.json")))
    throw new Error("package.json or package-lock.json differs from tools/approved, so the packages were not reinstalled.");
  fs.rmSync(MODULES, { recursive: true, force: true });
  const r = spawnSync("npm ci --ignore-scripts --no-audit --no-fund", { cwd: ROOT, shell: true, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`Reinstalling the approved packages failed:\n${(r.stderr || "").slice(-1500)}`);
  const left = differences(want, hashTree());
  if (left.length) throw new Error(`node_modules still differs from the approved hashes after a reinstall: ${left.slice(0, 5).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  if (process.argv.includes("--record")) {
    const tree = hashTree();
    fs.writeFileSync(MANIFEST, JSON.stringify(tree, null, 1) + "\n");
    console.log(`recorded ${Object.keys(tree).length} files`);
  } else {
    verifyDeps();
    console.log("node_modules matches the approved hashes");
  }
}
