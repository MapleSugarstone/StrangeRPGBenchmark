// Copies the page and its script into dist/ with relative paths.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!html.includes('src="src/main.js"')) throw new Error('index.html no longer loads src/main.js');
fs.writeFileSync(path.join(dist, 'index.html'), html.split('src="src/main.js"').join('src="main.js"'));
fs.copyFileSync(path.join(root, 'src', 'main.js'), path.join(dist, 'main.js'));
console.log('Built dist/index.html and dist/main.js');
