/**
 * Prüft Nebenkosten.xcodeproj strukturell.
 *
 *     node ios/tools/xcodeproj-pruefen.mjs
 *
 * Ohne macOS lässt sich das Projekt hier nicht öffnen. Diese Prüfung liest die
 * Projektdatei deshalb mit einem eigenen Parser für das OpenStep-Plist-Format
 * und stellt die Invarianten sicher, an denen Xcode sonst scheitern würde:
 * Syntax, aufgelöste Objektverweise, vollständige Bauphasen und die
 * Übereinstimmung von Projektinhalt und Dateibaum.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const PFAD = join(WURZEL, 'Nebenkosten.xcodeproj', 'project.pbxproj');

// ------------------------------------------------------------------ Parser

function parse(text) {
  let i = 0;

  function fehler(meldung) {
    const zeile = text.slice(0, i).split('\n').length;
    throw new Error(`${meldung} (Zeile ${zeile})`);
  }

  function ueberspringe() {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (text.startsWith('//', i)) {
        while (i < text.length && text[i] !== '\n') i++;
      } else if (text.startsWith('/*', i)) {
        const ende = text.indexOf('*/', i + 2);
        if (ende < 0) fehler('Unbeendeter Kommentar');
        i = ende + 2;
      } else {
        return;
      }
    }
  }

  function leseZeichenkette() {
    if (text[i] === '"') {
      i++;
      let ergebnis = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') {
          i++;
          ergebnis += text[i];
        } else {
          ergebnis += text[i];
        }
        i++;
      }
      if (text[i] !== '"') fehler('Unbeendete Zeichenkette');
      i++;
      return ergebnis;
    }
    const start = i;
    while (i < text.length && /[A-Za-z0-9_.$/@<>-]/.test(text[i])) i++;
    if (i === start) fehler(`Unerwartetes Zeichen ${JSON.stringify(text[i])}`);
    return text.slice(start, i);
  }

  function leseWert() {
    ueberspringe();
    if (text[i] === '{') return leseDict();
    if (text[i] === '(') return leseArray();
    return leseZeichenkette();
  }

  function leseDict() {
    if (text[i] !== '{') fehler('{ erwartet');
    i++;
    const ergebnis = {};
    for (;;) {
      ueberspringe();
      if (text[i] === '}') { i++; return ergebnis; }
      if (i >= text.length) fehler('Unbeendetes Objekt');
      const schluessel = leseZeichenkette();
      ueberspringe();
      if (text[i] !== '=') fehler(`= erwartet nach ${schluessel}`);
      i++;
      const w = leseWert();
      ueberspringe();
      if (text[i] !== ';') fehler(`; erwartet nach ${schluessel}`);
      i++;
      ergebnis[schluessel] = w;
    }
  }

  function leseArray() {
    if (text[i] !== '(') fehler('( erwartet');
    i++;
    const ergebnis = [];
    for (;;) {
      ueberspringe();
      if (text[i] === ')') { i++; return ergebnis; }
      if (i >= text.length) fehler('Unbeendete Liste');
      ergebnis.push(leseWert());
      ueberspringe();
      if (text[i] === ',') i++;
    }
  }

  ueberspringe();
  if (!text.startsWith('// !$*UTF8*$!')) {
    // Kopfzeile wird von ueberspringe() bereits als Kommentar behandelt.
  }
  const wurzel = leseDict();
  ueberspringe();
  if (i !== text.length) fehler('Unerwarteter Inhalt nach dem Wurzelobjekt');
  return wurzel;
}

// ------------------------------------------------------------------ Prüfung

const fehler = [];
const hinweise = [];

function pruefe(bedingung, meldung) {
  if (!bedingung) fehler.push(meldung);
}

if (!existsSync(PFAD)) {
  console.error(`Projektdatei fehlt: ${PFAD}\nBitte zuerst node ios/tools/xcodeproj-erzeugen.mjs ausführen.`);
  process.exit(1);
}

const roh = readFileSync(PFAD, 'utf8');
let wurzel;
try {
  wurzel = parse(roh);
  hinweise.push('Syntax des OpenStep-Plists ist gültig');
} catch (e) {
  console.error(`✗ Syntaxfehler: ${e.message}`);
  process.exit(1);
}

const objekte = wurzel.objects || {};
const kennungen = new Set(Object.keys(objekte));

pruefe(wurzel.archiveVersion === '1', 'archiveVersion muss 1 sein');
pruefe(!!wurzel.objectVersion, 'objectVersion fehlt');
pruefe(kennungen.has(wurzel.rootObject), 'rootObject verweist auf ein unbekanntes Objekt');

// Alle 24-stelligen Kennungen im Text müssen definiert sein.
const verwendet = new Set(roh.match(/\b[0-9A-F]{24}\b/g) || []);
for (const id of verwendet) {
  pruefe(kennungen.has(id), `Verweis auf unbekannte Kennung ${id}`);
}
hinweise.push(`${kennungen.size} Objekte, alle ${verwendet.size} Verweise auflösbar`);

// Jedes Objekt braucht eine isa-Angabe.
for (const [id, objekt] of Object.entries(objekte)) {
  pruefe(typeof objekt === 'object' && !!objekt.isa, `Objekt ${id} ohne isa`);
}

const nachTyp = (typ) => Object.entries(objekte).filter(([, o]) => o.isa === typ);

const projekte = nachTyp('PBXProject');
pruefe(projekte.length === 1, 'Es muss genau ein PBXProject geben');
const projekt = projekte[0]?.[1];

const ziele = nachTyp('PBXNativeTarget');
pruefe(ziele.length === 1, 'Es muss genau ein Ziel geben');
const [zielId, ziel] = ziele[0] || [];

if (projekt && ziel) {
  pruefe(projekt.targets.includes(zielId), 'Das Ziel ist im Projekt nicht eingetragen');
  pruefe(kennungen.has(projekt.mainGroup), 'mainGroup fehlt');
  pruefe(kennungen.has(projekt.productRefGroup), 'productRefGroup fehlt');
  pruefe(ziel.productType === 'com.apple.product-type.application', 'Zieltyp ist keine Anwendung');
  pruefe(kennungen.has(ziel.productReference), 'productReference fehlt');

  for (const phase of ziel.buildPhases) {
    pruefe(kennungen.has(phase), `Bauphase ${phase} fehlt`);
  }
  const phasenTypen = ziel.buildPhases.map((id) => objekte[id]?.isa);
  for (const erwartet of ['PBXSourcesBuildPhase', 'PBXFrameworksBuildPhase', 'PBXResourcesBuildPhase']) {
    pruefe(phasenTypen.includes(erwartet), `Bauphase ${erwartet} fehlt`);
  }
}

// Bauzuordnungen müssen auf vorhandene Dateiverweise zeigen.
for (const [id, objekt] of nachTyp('PBXBuildFile')) {
  pruefe(kennungen.has(objekt.fileRef), `PBXBuildFile ${id} verweist auf einen unbekannten Dateiverweis`);
}

// Konfigurationen
for (const [id, liste] of nachTyp('XCConfigurationList')) {
  pruefe(liste.buildConfigurations.length >= 1, `Konfigurationsliste ${id} ist leer`);
  const namen = liste.buildConfigurations.map((k) => objekte[k]?.name);
  pruefe(namen.includes(liste.defaultConfigurationName),
         `Standardkonfiguration ${liste.defaultConfigurationName} fehlt in ${id}`);
}

const zielKonfigs = ziel ? objekte[ziel.buildConfigurationList].buildConfigurations.map((k) => objekte[k]) : [];
for (const konfig of zielKonfigs) {
  const e = konfig.buildSettings || {};
  pruefe(!!e.PRODUCT_BUNDLE_IDENTIFIER, `PRODUCT_BUNDLE_IDENTIFIER fehlt in ${konfig.name}`);
  pruefe(e.GENERATE_INFOPLIST_FILE === 'YES', `GENERATE_INFOPLIST_FILE fehlt in ${konfig.name}`);
  pruefe(e.TARGETED_DEVICE_FAMILY === '1,2', `TARGETED_DEVICE_FAMILY sollte iPhone und iPad umfassen (${konfig.name})`);
  pruefe(!!e.ASSETCATALOG_COMPILER_APPICON_NAME, `App-Symbol nicht gesetzt (${konfig.name})`);
}

// --------------------------------------------- Abgleich mit dem Dateibaum

function sammle(verzeichnis, treffer = []) {
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name.startsWith('.')) continue;
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      if (eintrag.name.endsWith('.xcassets')) treffer.push(pfad);
      else sammle(pfad, treffer);
    } else if (eintrag.name.endsWith('.swift')) treffer.push(pfad);
  }
  return treffer;
}

const aufPlatte = sammle(join(WURZEL, 'Nebenkosten')).map((p) => p.split('/').pop());
const quelldateien = nachTyp('PBXSourcesBuildPhase')
  .flatMap(([, phase]) => phase.files)
  .map((id) => objekte[objekte[id].fileRef].path);
const ressourcen = nachTyp('PBXResourcesBuildPhase')
  .flatMap(([, phase]) => phase.files)
  .map((id) => objekte[objekte[id].fileRef].path);

const imProjekt = new Set([...quelldateien, ...ressourcen]);
for (const name of aufPlatte) {
  pruefe(imProjekt.has(name), `Datei nicht im Projekt eingetragen: ${name}`);
}
for (const name of imProjekt) {
  pruefe(aufPlatte.includes(name), `Projekt verweist auf eine fehlende Datei: ${name}`);
}
pruefe(new Set(quelldateien).size === quelldateien.length, 'Eine Quelldatei ist mehrfach eingetragen');

hinweise.push(`${quelldateien.length} Quelldateien und ${ressourcen.length} Ressource(n) stimmen mit dem Dateibaum überein`);

// Der Rechenkern muss vollständig im App-Ziel enthalten sein.
const kern = readdirSync(join(WURZEL, 'Nebenkosten', 'Kern')).filter((n) => n.endsWith('.swift'));
for (const name of kern) {
  pruefe(quelldateien.includes(name), `Kerndatei fehlt im App-Ziel: ${name}`);
}

// ------------------------------------------------------------------ Ausgabe

for (const hinweis of hinweise) console.log(`✓ ${hinweis}`);

if (fehler.length) {
  console.error('');
  for (const meldung of fehler) console.error(`✗ ${meldung}`);
  console.error(`\n${fehler.length} Problem(e) gefunden.`);
  process.exit(1);
}

console.log(`✓ ${relative(process.cwd(), PFAD)} ist strukturell gültig`);
