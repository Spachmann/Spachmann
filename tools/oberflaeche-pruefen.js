/**
 * Rauchtest der Oberfläche: startet den Server, lädt die App im Browser,
 * spielt die Beispieldaten ein und ruft jede Ansicht auf. Meldet Fehler, wenn
 * eine JavaScript-Ausnahme auftritt, eine Ansicht leer bleibt oder im
 * sichtbaren Text Platzhalter wie „undefined" oder „NaN" auftauchen.
 *
 *   node tools/oberflaeche-pruefen.js [--screenshots <verzeichnis>]
 *
 * Die Prüfseite wird bewusst im Projektverzeichnis abgelegt und über HTTP
 * geladen: nur so teilt sie den localStorage-Origin mit der App im iframe.
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const BASIS = `http://localhost:${PORT}`;

const CHROMIUM = [
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));

if (!CHROMIUM) {
  console.error('Kein Chromium gefunden.');
  process.exit(1);
}

const screenshotIndex = process.argv.indexOf('--screenshots');
const screenshotDir = screenshotIndex > -1 ? process.argv[screenshotIndex + 1] : null;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

const ANSICHTEN = [
  'start', 'kosten', 'heizung', 'verbrauch', 'pruefung',
  'abrechnung', 'vermieter', 'objekte', 'einheiten', 'mieter', 'daten',
];

const pruefDatei = join(WURZEL, 'pruefseite.html');
const profilBasis = mkdtempSync(join(tmpdir(), 'nk-profil-'));
const server = spawn(process.execPath, [join(WURZEL, 'tools/serve.js'), String(PORT)], { stdio: 'ignore' });

await new Promise((r) => setTimeout(r, 800));

let fehlerhaft = false;
try {
  for (const ansicht of ANSICHTEN) {
    const ergebnis = pruefeAnsicht(ansicht);
    if (ergebnis.ok) console.log(`✓ ${ansicht.padEnd(12)} ${ergebnis.info}`);
    else {
      fehlerhaft = true;
      console.error(`✗ ${ansicht.padEnd(12)} ${ergebnis.info}`);
    }
  }
} finally {
  server.kill();
  rmSync(pruefDatei, { force: true });
  rmSync(profilBasis, { recursive: true, force: true });
}

console.log(fehlerhaft ? '\nEs sind Fehler aufgetreten.' : '\nAlle Ansichten laden fehlerfrei.');
process.exit(fehlerhaft ? 1 : 0);

function pruefeAnsicht(ansicht) {
  writeFileSync(pruefDatei, pruefseite(ansicht));

  const profil = join(profilBasis, ansicht);
  const argumente = [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--virtual-time-budget=8000',
    '--window-size=1180,1500',
    `--user-data-dir=${profil}`,
  ];

  // Screenshot und DOM-Ausgabe schließen sich in Chromium gegenseitig aus,
  // daher wird bei Bedarf zweimal geladen.
  let ausgabe = '';
  try {
    ausgabe = execFileSync(CHROMIUM, [...argumente, '--dump-dom', `${BASIS}/pruefseite.html`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 40000,
    });
  } catch (fehler) {
    return { ok: false, info: `Browser abgebrochen: ${String(fehler.message).split('\n')[0]}` };
  }

  if (screenshotDir) {
    try {
      execFileSync(
        CHROMIUM,
        [...argumente, `--screenshot=${join(screenshotDir, `${ansicht}.png`)}`, `${BASIS}/pruefseite.html`],
        { stdio: 'ignore', timeout: 40000 }
      );
    } catch {
      /* Screenshot ist optional */
    }
  }

  const treffer = ausgabe.match(/id="ergebnis"[^>]*>(.*?)<\/pre>/s);
  if (!treffer) return { ok: false, info: 'Kein Ergebnis vom Browser erhalten' };

  let daten;
  try {
    daten = JSON.parse(entschluessle(treffer[1]));
  } catch (fehler) {
    return { ok: false, info: `Ergebnis unlesbar: ${treffer[1].slice(0, 160)}` };
  }

  return {
    ok: daten.ok,
    info: daten.ok
      ? `„${daten.ueberschrift}", ${daten.laenge} Zeichen`
      : daten.fehler.join(' | '),
  };
}

function entschluessle(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function pruefseite(ansicht) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Prüfung ${ansicht}</title>
<style>html,body{margin:0;background:#fff}iframe{border:0;width:1180px;height:1500px;display:block}
pre{position:fixed;left:-9999px}</style></head>
<body>
<iframe id="rahmen"></iframe>
<pre id="ergebnis"></pre>
<script type="module">
const fehler = [];
window.addEventListener('error', (e) => fehler.push('Seite: ' + e.message));
window.addEventListener('unhandledrejection', (e) => fehler.push('Promise: ' + e.reason));

function melde(daten) {
  document.getElementById('ergebnis').textContent = JSON.stringify(daten);
}

try {
  const modell = await import('${BASIS}/src/core/model.js');
  localStorage.setItem('nebenkosten.daten.v1', JSON.stringify(modell.demodaten()));
  localStorage.removeItem('nebenkosten.auswahl.v1');

  const rahmen = document.getElementById('rahmen');
  await new Promise((fertig, scheitern) => {
    rahmen.onload = fertig;
    rahmen.onerror = () => scheitern(new Error('iframe konnte nicht laden'));
    rahmen.src = '${BASIS}/index.html';
  });

  const f = rahmen.contentWindow;
  f.addEventListener('error', (e) => fehler.push('App: ' + e.message));
  f.addEventListener('unhandledrejection', (e) => fehler.push('App-Promise: ' + e.reason));

  await new Promise((r) => setTimeout(r, 500));

  const knopf = f.document.querySelector('[data-aktion="gehe-zu"][data-wert="${ansicht}"]');
  if (!knopf) fehler.push('Navigationspunkt „${ansicht}" nicht gefunden');
  else knopf.click();

  await new Promise((r) => setTimeout(r, 700));

  const inhalt = f.document.getElementById('inhalt');
  const laenge = inhalt ? inhalt.innerHTML.length : 0;
  const ueberschrift = (inhalt && inhalt.querySelector('h1') ? inhalt.querySelector('h1').textContent : '').trim();

  if (laenge < 400) fehler.push('Ansicht wirkt leer (' + laenge + ' Zeichen)');

  const text = inhalt ? inhalt.textContent : '';
  const stelle = text.match(/.{0,45}(undefined|NaN|\\[object Object\\]).{0,45}/);
  if (stelle) fehler.push('Platzhalter im Text: …' + stelle[0].replace(/\\s+/g, ' ').trim() + '…');

  melde({ ok: fehler.length === 0, laenge, ueberschrift, fehler });
} catch (e) {
  fehler.push('Ausnahme: ' + (e && e.message ? e.message : e));
  melde({ ok: false, laenge: 0, ueberschrift: '', fehler });
}
</script>
</body></html>`;
}
