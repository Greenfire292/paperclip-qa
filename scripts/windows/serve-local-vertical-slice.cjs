const http = require('http');
const fs = require('fs');
const path = require('path');

const host = process.argv[2] || '127.0.0.1';
const port = Number(process.argv[3] || '4173');
const root = path.resolve(__dirname, '..', '..');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache'
  });
  response.end(body);
}

function safePathFromUrl(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const normalized = decoded === '/' ? '/index.html' : decoded;
  const candidate = path.resolve(root, '.' + normalized);
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

const server = http.createServer((request, response) => {
  const target = safePathFromUrl(request.url || '/');
  if (!target) {
    send(response, 403, 'Forbidden');
    return;
  }

  fs.stat(target, (statErr, stats) => {
    if (statErr) {
      send(response, 404, 'Not found');
      return;
    }

    const filePath = stats.isDirectory() ? path.join(target, 'index.html') : target;
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(response, 404, 'Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      send(response, 200, data, mimeTypes[ext] || 'application/octet-stream');
    });
  });
});

server.listen(port, host, () => {
  console.log(`Local vertical-slice server listening at http://${host}:${port}`);
});

server.on('error', (error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
