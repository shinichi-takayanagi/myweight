import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.PORT || 4173);
const basePath = '/myweight';
const distDir = path.resolve('dist');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
]);

const getContentType = (filePath) => {
  return contentTypes.get(path.extname(filePath)) || 'application/octet-stream';
};

const getFilePath = async (pathname) => {
  if (pathname === basePath) {
    return { redirect: `${basePath}/` };
  }

  if (pathname === `${basePath}/`) {
    return { filePath: path.join(distDir, 'index.html') };
  }

  if (!pathname.startsWith(`${basePath}/`)) {
    return null;
  }

  const relativePath = pathname.slice(basePath.length + 1);
  const filePath = path.join(distDir, relativePath);
  const relativeFromDist = path.relative(distDir, filePath);
  if (relativeFromDist.startsWith('..') || path.isAbsolute(relativeFromDist)) {
    return null;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      return { filePath };
    }
  } catch {
    return { filePath: path.join(distDir, 'index.html') };
  }

  return { filePath: path.join(distDir, 'index.html') };
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const resolved = await getFilePath(decodeURIComponent(url.pathname));

    if (!resolved) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    if (resolved.redirect) {
      response.writeHead(302, { Location: resolved.redirect });
      response.end();
      return;
    }

    const body = await readFile(resolved.filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': getContentType(resolved.filePath),
    });
    response.end(body);
  } catch (error) {
    console.error('serve-pages error:', error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Internal server error');
  }
}).listen(port, 'localhost', () => {
  console.log(`Serving dist at http://localhost:${port}${basePath}/`);
});
