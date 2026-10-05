// Serves dist/ for local testing. Usage: node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const port = Number(process.argv[2]) || 8137;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.map': 'application/json', '.png': 'image/png' };

http.createServer((req, res) => {
  // Saves a data URL posted from the page, for capturing screenshots during development.
  if (req.method === 'POST' && (req.url.startsWith('/capture/') || req.url.startsWith('/shot/'))) {
    const dir = req.url.startsWith('/shot/') ? 'build/shots' : 'art';
    const name = path.basename(req.url.slice(req.url.indexOf('/', 1) + 1)).replace(/[^\w.-]/g, '');
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), Buffer.from(body.replace(/^data:[^,]+,/, ''), 'base64'));
      res.writeHead(200).end('saved');
    });
    return;
  }
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving dist at http://localhost:${port}/`));
