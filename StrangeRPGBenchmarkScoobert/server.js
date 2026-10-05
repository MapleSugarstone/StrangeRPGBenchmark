// server.js — plain Node static file server for PATCHWORK.
// Usage: node server.js  (serves on $PORT or 8080)

import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0].split("#")[0] || "/";
  if (url === "/") url = "/index.html";

  // index.html is at root; everything else is in dist/
  let filePath;
  if (url === "/index.html") {
    filePath = path.join(__dirname, "index.html");
  } else {
    // Strip /dist prefix if present, otherwise prepend dist/
    const subPath = url.startsWith("/dist/") ? url.slice(6) : url.slice(1);
    filePath = path.join(__dirname, "dist", subPath || "index.js");
  }

  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PATCHWORK server running at http://127.0.0.1:${PORT}`);
});
