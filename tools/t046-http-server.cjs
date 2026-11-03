// Local-only static server for the isolated T-046 browser capacity test.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const allowed = new Map([
  ['/t046-indexed-test.html', 't046-indexed-test.html'],
  ['/js/modular3-indexed-events.js', 'js/modular3-indexed-events.js']
]);
http.createServer((req, res) => {
  const file = allowed.get((req.url || '').split('?')[0]);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  const full = path.join(root, file);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(500); res.end('Unavailable'); return; }
    res.writeHead(200, {'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(data);
  });
}).listen(8765, '127.0.0.1', () => console.log('T-046 local test server ready'));
