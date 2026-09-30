// NULL SECTOR: tiny static server so the browser can load the game's modules.
// Usage: node server.js [port]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2]) || 8420;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT) || url.includes('..')) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`NULL SECTOR running at http://localhost:${PORT}/`));
