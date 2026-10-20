// Serves this folder for local play, opens a page in the browser, or stops the server.
// Usage: node tools/serve.mjs [port] | --open <page> [port] | --stop [port] | --levels (prints the level menu)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a))) || 8137;
const base = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(base + '/'); return true; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  return false;
}

if (args.includes('--levels')) {
  const ctx = { window: {}, document: {}, Map };
  for (const f of ['core.js', 'art.js', 'levels.js']) vm.runInNewContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx);
  vm.runInNewContext('this.L = LEVELS; this.A = AREAS;', ctx);
  let area = -1, line = '';
  ctx.L.forEach((l, i) => {
    if ((l.area || 0) !== area) {
      if (line) console.log(line);
      area = l.area || 0;
      console.log(`  ${ctx.A[area].name}`);
      line = '';
    }
    const cell = `${String(i + 1).padStart(4)} ${l.name}`;
    if (line.length + cell.length > 76) { console.log(line); line = ''; }
    line += cell.padEnd(22);
  });
  if (line) console.log(line);
} else if (args.includes('--open')) {
  const page = args[args.indexOf('--open') + 1] || '/';
  if (!(await waitForServer())) { console.error(`Nothing answered on port ${port}.`); process.exit(1); }
  const opener = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${opener} "${base}${page}"`, () => process.exit(0));
} else if (args.includes('--stop')) {
  try { await fetch(base + '/__quit'); } catch { /* already stopped */ }
} else {
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  };
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, base).pathname);
    if (pathname === '/__quit') { res.end('stopped'); setTimeout(() => process.exit(0), 50); return; }
    let file = path.join(root, pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') { console.log(`A server already answers on port ${port}, so this one is not needed.`); process.exit(0); }
    console.error(err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Serving Checksum at ${base}/`);
    console.log('Pick Q in play.cmd or close this window to stop it.');
  });
}
