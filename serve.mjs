#!/usr/bin/env node
// A tiny static server for previewing the showcase. No dependencies.
//
//   node showcase/serve.mjs            http://127.0.0.1:3000/
//   node showcase/serve.mjs 4180       another port
//   PORT=4180 node showcase/serve.mjs
//
// Serves this folder only, on the loopback interface only.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = root.endsWith(sep) ? root : root + sep;
const port = Number(process.argv[2] || process.env.PORT || 3000);
const host = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  if (pathname.split('/').some((part) => part.startsWith('.'))) return send(res, 404, 'Not found');

  const file = resolve(base, '.' + pathname);
  if (!file.startsWith(base)) return send(res, 404, 'Not found');

  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      res.writeHead(301, { location: pathname + '/' });
      return res.end();
    }
    const body = await readFile(file);
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'content-length': body.length, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 404, 'Not found');
  }
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${port} is in use. Try: node showcase/serve.mjs ${port + 1}` : err.message);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`ICARUS showcase: http://${host}:${port}/`);
});
