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
import { networkInterfaces } from 'node:os';
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

/** Adressen dieses Rechners im lokalen Netz – damit das iPad sie erreichen kann. */
function netzadressen() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((schnittstelle) => schnittstelle && schnittstelle.family === 'IPv4' && !schnittstelle.internal)
    .map((schnittstelle) => schnittstelle.address);
}

server.listen(PORT, () => {
  const strich = '─'.repeat(52);
  console.log(`\n  Nebenkostenabrechnung\n  ${strich}`);
  console.log(`  Auf diesem Rechner:  http://localhost:${PORT}`);

  const adressen = netzadressen();
  if (adressen.length) {
    console.log('\n  Auf dem iPad im selben WLAN:');
    for (const adresse of adressen) console.log(`      http://${adresse}:${PORT}`);
    console.log('\n  Adresse in Safari öffnen, dann Teilen → Zum Home-Bildschirm.');
  } else {
    console.log('\n  Keine Netzwerkadresse gefunden – ist der Rechner im WLAN?');
  }

  console.log(`  ${strich}\n  Beenden mit Strg + C\n`);
});
