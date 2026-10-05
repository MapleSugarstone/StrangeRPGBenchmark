// Builds every game in games.json that has a build step and assembles the static site in _site/.
// Usage: node tools/build-site.mjs [--skip-build] [--serve [port]] [--open]
import { exec, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const serveFlag = args.indexOf('--serve');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'games.json'), 'utf8'));

function run(command, cwd) {
  console.log(`> ${command}  (${path.relative(root, cwd)})`);
  execSync(command, { cwd, stdio: 'inherit' });
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'games.json', 'menu']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');

for (const game of manifest.games) {
  if (!game.build) {
    console.log(`${game.title}: no build step, shown in the menu only`);
    continue;
  }
  const dir = path.join(root, game.folder);
  if (!skipBuild) {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) run('npm ci --no-audit --no-fund', dir);
    run(game.build.command, dir);
  }
  const dist = path.join(dir, game.build.dist);
  const exclude = new Set(game.build.exclude ?? []);
  fs.cpSync(dist, path.join(out, 'games', game.id), {
    recursive: true,
    filter: (src) => !src.endsWith('.map') && !exclude.has(path.relative(dist, src).split(path.sep).join('/')),
  });
  console.log(`${game.title}: copied to _site/games/${game.id}/`);
}

if (serveFlag !== -1) {
  const port = Number(args[serveFlag + 1]) || 8080;
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  };
  http.createServer((req, res) => {
    let file = path.join(out, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(out)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is in use. Pass another port, for example --serve ${port + 1}.` : err.message);
    process.exit(1);
  }).listen(port, () => {
    const url = `http://localhost:${port}/`;
    console.log(`Serving _site at ${url}`);
    console.log('Press Ctrl+C to stop the server.');
    if (args.includes('--open')) {
      const opener = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${opener} ${url}`);
    }
  });
}
