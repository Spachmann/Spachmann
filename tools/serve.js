/**
 * Minimaler statischer Server für die lokale Entwicklung.
 *
 *   npm start            → http://localhost:8080
 *   node tools/serve.js 3000
 *
 * Für den Einsatz auf dem iPad muss die App über HTTPS oder localhost
 * ausgeliefert werden, damit Service Worker und Installation funktionieren.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (anfrage, antwort) => {
  try {
    const pfad = decodeURIComponent(new URL(anfrage.url, 'http://localhost').pathname);
    let ziel = join(WURZEL, normalize(pfad).replace(/^(\.\.[/\\])+/, ''));

    if (!ziel.startsWith(WURZEL)) {
      antwort.writeHead(403).end('Verboten');
      return;
    }

    const info = await stat(ziel).catch(() => null);
    if (info?.isDirectory()) ziel = join(ziel, 'index.html');

    const inhalt = await readFile(ziel);
    antwort.writeHead(200, {
      'Content-Type': TYPEN[extname(ziel)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    antwort.end(inhalt);
  } catch {
    antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
});

server.listen(PORT, () => {
  console.log(`Nebenkosten-App läuft auf http://localhost:${PORT}`);
});
