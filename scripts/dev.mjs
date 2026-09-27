import { createServer as createHttpServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { handleIngestionRequest } from './ingestion/server.mjs';

await build({
  root: process.cwd(),
  configFile: false,
  base: '/quark-customer-success/',
  plugins: [react()],
  optimizeDeps: { disabled: true },
});

const root = join(process.cwd(), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const server = createHttpServer(async (request, response) => {
  const requestUrl = request.url ?? '/';
  const appPath = requestUrl.startsWith('/quark-customer-success/')
    ? requestUrl.slice('/quark-customer-success'.length)
    : requestUrl;
  if (appPath.startsWith('/api/')) {
    request.url = appPath;
    const handled = await handleIngestionRequest(request, response);
    if (handled !== false) return;
  }
  const requested = normalize(join(root, appPath === '/' ? 'index.html' : appPath.split('?')[0]));
  const file = requested.startsWith(root) && existsSync(requested) && statSync(requested).isFile() ? requested : join(root, 'index.html');
  response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
server.on('error', (error) => { console.error(error); process.exitCode = 1; });
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
const port = Number(process.env.PORT ?? 5173);
server.listen(port, '127.0.0.1', () => console.log(`Local: http://localhost:${port}/`));
