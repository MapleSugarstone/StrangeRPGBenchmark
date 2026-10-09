// Serves dist/ on a local port (default 8743).
// POST /__shot?name=<file> with a PNG or WAV data URL body saves a screenshot or a sound sheet into ../menu/art/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', 'dist');
const art = path.resolve(here, '..', '..', 'menu', 'art');
// The sprite review page and its data live in review/ and are never part of a build.
const review = path.resolve(here, '..', 'review');
const port = Number(process.argv[2]) || 8743;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.map': 'application/json', '.json': 'application/json' };

http.createServer((req, res) => {
  const [rawUrl, query = ''] = (req.url || '/').split('?');
  const url = decodeURIComponent(rawUrl);
  // POST /__review with { id, ...fields } merges one whorl's decision into review/choices.json.
  // POST /__ready with { note } tells the sprite agent the user has finished a review pass (review/ready.json).
  if (req.method === 'POST' && url === '/__ready') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e4) req.destroy(); });
    req.on('end', () => {
      let note = '';
      try { note = String(JSON.parse(body || '{}').note || '').slice(0, 4000); } catch { /* an empty note is fine */ }
      const entry = { at: new Date().toISOString(), note };
      fs.mkdirSync(review, { recursive: true });
      fs.writeFileSync(path.join(review, 'ready.json'), JSON.stringify(entry, null, 1));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(entry));
    });
    return;
  }
  if (req.method === 'POST' && url === '/__review') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let entry;
      try { entry = JSON.parse(body); } catch { res.writeHead(400); res.end('bad json'); return; }
      if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9_:]+$/.test(entry.id)) { res.writeHead(400); res.end('bad id'); return; }
      const file = path.join(review, 'choices.json');
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      const { id, ...fields } = entry;
      all[id] = { ...(all[id] || {}), ...fields, at: new Date().toISOString() };
      fs.mkdirSync(review, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(all, null, 1));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(all[id]));
    });
    return;
  }
  if (url === '/review' || url.startsWith('/review/')) {
    const rel = url === '/review' || url === '/review/' ? 'index.html' : url.slice('/review/'.length);
    const file = path.join(review, rel);
    if (!file.startsWith(review) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (req.method === 'POST' && url === '/__shot') {
    const name = new URLSearchParams(query).get('name') || '';
    if (!/^[a-z0-9-]+\.(png|wav)$/.test(name)) { res.writeHead(400); res.end('bad name'); return; }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1.2e7) req.destroy(); });
    req.on('end', () => {
      const m = body.match(/^data:(?:image\/png|audio\/wav);base64,(.+)$/);
      if (!m) { res.writeHead(400); res.end('bad data'); return; }
      fs.mkdirSync(art, { recursive: true });
      fs.writeFileSync(path.join(art, name), Buffer.from(m[1], 'base64'));
      res.writeHead(200); res.end('saved');
    });
    return;
  }
  let file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}/`));
