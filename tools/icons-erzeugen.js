/**
 * Rendert icons/icon.svg mit dem vorinstallierten Chromium in die für iOS und
 * den Web-App-Manifest benötigten PNG-Größen.
 *
 *   node tools/icons-erzeugen.js
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(wurzel, 'icons/icon.svg'), 'utf8');

// headless_shell hat keine Fensterdekoration und liefert exakt die angeforderte
// Viewport-Größe – normale Chrome-Builds schneiden sonst unten ab.
const CHROMIUM = [
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

if (!CHROMIUM) {
  console.error('Kein Chromium gefunden – Icons können nicht erzeugt werden.');
  process.exit(1);
}

// 180 px: iOS-Homebildschirm; 192/512: Web-App-Manifest; maskable mit Sicherheitsrand.
const GROESSEN = [
  { datei: 'icon-180.png', groesse: 180, rand: 0 },
  { datei: 'icon-192.png', groesse: 192, rand: 0 },
  { datei: 'icon-512.png', groesse: 512, rand: 0 },
  { datei: 'icon-512-maskable.png', groesse: 512, rand: 0.12 },
];

const tmp = mkdtempSync(join(tmpdir(), 'icons-'));

for (const { datei, groesse, rand } of GROESSEN) {
  const skalierung = 1 - 2 * rand;
  // Ohne Rand definiert das SVG mit seinen abgerundeten Ecken die Silhouette,
  // der Seitenhintergrund bleibt transparent. Maskable-Icons brauchen dagegen
  // eine vollflächige Fläche, weil das System die Ecken selbst beschneidet.
  const seite = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${groesse}px;height:${groesse}px;overflow:hidden;background:transparent}
  .rahmen{
    width:${groesse}px;height:${groesse}px;display:grid;place-items:center;
    ${rand > 0 ? 'background:linear-gradient(135deg,#2f7cf6,#7c4dff);' : ''}
  }
  svg{width:${Math.round(groesse * skalierung)}px;height:${Math.round(groesse * skalierung)}px;display:block}
</style>
<div class="rahmen">${svg}</div>`;

  const htmlDatei = join(tmp, `${datei}.html`);
  writeFileSync(htmlDatei, seite);

  execFileSync(
    CHROMIUM,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--screenshot=${join(wurzel, 'icons', datei)}`,
      `--window-size=${groesse},${groesse}`,
      `file://${htmlDatei}`,
    ],
    { stdio: 'pipe' }
  );

  console.log(`icons/${datei} erzeugt (${groesse}×${groesse})`);
}

rmSync(tmp, { recursive: true, force: true });
