import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePlacesApi } from './places-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const envFile = path.join(root, '.env');

if (existsSync(envFile)) {
  const contents = await readFile(envFile, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
  if (request.url?.startsWith('/api/places/')) {
    await handlePlacesApi(request, response, process.env.GOOGLE_PLACES_API_KEY);
    return;
  }
  if (!existsSync(dist)) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Production build is missing. Run npm run build first.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Invalid URL');
    return;
  }
  const candidate = path.resolve(dist, `.${pathname}`);
  const safeCandidate = candidate.startsWith(`${dist}${path.sep}`) ? candidate : path.join(dist, 'index.html');
  try {
    const filePath = existsSync(safeCandidate) ? safeCandidate : path.join(dist, 'index.html');
    const contents = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
    });
    response.end(contents);
  } catch (error) {
    console.error('Unable to serve production file:', error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to serve this page.');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`Tourism app server listening on port ${port}`);
});
