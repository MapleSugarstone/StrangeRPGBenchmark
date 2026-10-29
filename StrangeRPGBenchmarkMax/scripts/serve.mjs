// Serves dist/ over HTTP. Usage: node scripts/serve.mjs [port] [--shots]
// With --shots, a POST to /__shot?name=x saves the PNG body to shots/x.png (for test and menu screenshots).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, 'dist');
const port = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8765);
const shots = process.argv.includes('--shots');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.map': 'application/json' };

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (shots && req.method === 'POST' && url === '/__shot') {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^a-z0-9-]/gi, '');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(path.join(project, 'shots'), { recursive: true });
      fs.writeFileSync(path.join(project, 'shots', `${name}.png`), Buffer.concat(chunks));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`saved shots/${name}.png`);
    });
    return;
  }
  let file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Gnomon at http://localhost:${port}/`));
