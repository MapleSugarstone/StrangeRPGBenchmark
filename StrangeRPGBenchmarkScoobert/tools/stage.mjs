// Copies index.html into dist/ with paths relative to dist/, so dist/ is a standalone build.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace('src="dist/main.js"', 'src="main.js"');
fs.writeFileSync(path.join(root, "dist", "index.html"), html);
