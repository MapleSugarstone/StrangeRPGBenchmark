// Copies the playable game (index.html and src/) into dist/ for the cartridge menu's site build.
// src/music.js and src/soundtrack.js are already bundled by tools/build-music.mjs, so nothing here compiles.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
const soundtrack = path.join(root, 'src', 'soundtrack.js');
fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true, filter: (p) => p !== soundtrack });
// The menu's Soundtrack screen loads this next to index.html. See the root README, under Soundtracks.
fs.copyFileSync(soundtrack, path.join(dist, 'soundtrack.js'));
const files = fs.readdirSync(path.join(dist, 'src')).length;
console.log(`dist: index.html, soundtrack.js, and ${files} files in src/`);
