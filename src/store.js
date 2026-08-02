/**
 * Datenhaltung. Alles bleibt lokal auf dem Gerät (localStorage) – es werden
 * keine Mieterdaten an Server übertragen.
 *
 * Der Bestand kann mehrere Vermieter mit jeweils mehreren Objekten enthalten.
 * Die Oberfläche arbeitet immer auf einem ausgewählten Objekt; `bestand()`
 * liefert dazu den passenden Ausschnitt für Abrechnung, Prüfung und Dokument.
 */

import {
  leererDatenbestand, migriere, demodaten,
  neueAbrechnung, neuerVermieter, neuesObjekt, neueEinheit, neuesMietverhaeltnis,
  bestandFuerObjekt, abrechnungenVon, einheitenVon, mietverhaeltnisseVon, objektVon,
} from './core/model.js';

const SCHLUESSEL = 'nebenkosten.daten.v1';
const AUSWAHL_OBJEKT = 'nebenkosten.objekt.v1';
const AUSWAHL_ABRECHNUNG = 'nebenkosten.auswahl.v1';

let daten = leererDatenbestand();
let aktivesObjektId = null;
let aktiveAbrechnungId = null;
const hoerer = new Set();

export function lade() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    daten = roh ? migriere(JSON.parse(roh)) : leererDatenbestand();
  } catch (fehler) {
    console.warn('Gespeicherte Daten konnten nicht gelesen werden:', fehler);
    daten = leererDatenbestand();
  }
  aktivesObjektId = localStorage.getItem(AUSWAHL_OBJEKT);
  aktiveAbrechnungId = localStorage.getItem(AUSWAHL_ABRECHNUNG);
  richteAuswahlAus();
  return daten;
}

/** Sorgt dafür, dass Objekt- und Zeitraumauswahl auf vorhandene Einträge zeigen. */
function richteAuswahlAus() {
  if (!daten.objekte.some((o) => o.id === aktivesObjektId)) {
    aktivesObjektId = daten.objekte[0]?.id || null;
  }
  const zeitraeume = aktivesObjektId ? abrechnungenVon(daten, aktivesObjektId) : [];
  if (!zeitraeume.some((a) => a.id === aktiveAbrechnungId)) {
    aktiveAbrechnungId = zeitraeume[0]?.id || null;
  }
}

export function speichere() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
    if (aktivesObjektId) localStorage.setItem(AUSWAHL_OBJEKT, aktivesObjektId);
    if (aktiveAbrechnungId) localStorage.setItem(AUSWAHL_ABRECHNUNG, aktiveAbrechnungId);
  } catch (fehler) {
    console.error('Speichern fehlgeschlagen:', fehler);
    return false;
  }
  return true;
}

export function hole() {
  return daten;
}

export function ersetze(neu) {
  daten = migriere(neu);
  aktivesObjektId = null;
  aktiveAbrechnungId = null;
  richteAuswahlAus();
  speichere();
  benachrichtige();
}

/** Führt eine Änderung aus, speichert und aktualisiert die Oberfläche. */
export function aendere(fn) {
  const ergebnis = fn(daten);
  richteAuswahlAus();
  speichere();
  benachrichtige();
  return ergebnis;
}

/** Speichert stillschweigend, ohne neu zu rendern (für Tippen in Textfeldern). */
export function aendereStill(fn) {
  const ergebnis = fn(daten);
  speichere();
  return ergebnis;
}

/* ------------------------------------------------------------------ Auswahl */

export function aktivesObjekt() {
  return aktivesObjektId ? objektVon(daten, aktivesObjektId) : null;
}

export function setzeAktivesObjekt(objektId) {
  aktivesObjektId = objektId;
  aktiveAbrechnungId = null;
  richteAuswahlAus();
  speichere();
  benachrichtige();
}

export function aktiveAbrechnung() {
  if (!aktiveAbrechnungId) return null;
  return daten.abrechnungen.find((a) => a.id === aktiveAbrechnungId) || null;
}

export function setzeAktiveAbrechnung(id) {
  aktiveAbrechnungId = id;
  speichere();
  benachrichtige();
}

/** Abrechnungszeiträume des aktiven Objekts, neueste zuerst. */
export function zeitraeume() {
  return aktivesObjektId ? abrechnungenVon(daten, aktivesObjektId) : [];
}

/** Ausschnitt des Bestands für das aktive Objekt. */
export function bestand() {
  return aktivesObjektId ? bestandFuerObjekt(daten, aktivesObjektId) : null;
}

export function einheiten() {
  return aktivesObjektId ? einheitenVon(daten, aktivesObjektId) : [];
}

export function mietverhaeltnisse() {
  return aktivesObjektId ? mietverhaeltnisseVon(daten, aktivesObjektId) : [];
}

/* ------------------------------------------------------------- Stammdaten */

export function legeVermieterAn(name = '') {
  const neu = neuerVermieter(name);
  daten.vermieter.push(neu);
  speichere();
  benachrichtige();
  return neu;
}

export function loescheVermieter(vermieterId) {
  const betroffen = daten.objekte.filter((o) => o.vermieterId === vermieterId).map((o) => o.id);
  daten.vermieter = daten.vermieter.filter((v) => v.id !== vermieterId);
  for (const objektId of betroffen) entferneObjekt(objektId);
  richteAuswahlAus();
  speichere();
  benachrichtige();
}

export function legeObjektAn(vermieterId, bezeichnung = '') {
  const eigentuemer = vermieterId || daten.vermieter[0]?.id;
  if (!eigentuemer) return null;
  const neu = neuesObjekt(eigentuemer, bezeichnung || `Objekt ${daten.objekte.length + 1}`);
  daten.objekte.push(neu);
  aktivesObjektId = neu.id;
  aktiveAbrechnungId = null;
  richteAuswahlAus();
  speichere();
  benachrichtige();
  return neu;
}

export function loescheObjekt(objektId) {
  entferneObjekt(objektId);
  richteAuswahlAus();
  speichere();
  benachrichtige();
}

function entferneObjekt(objektId) {
  const einheitIds = new Set(daten.einheiten.filter((e) => e.objektId === objektId).map((e) => e.id));
  daten.objekte = daten.objekte.filter((o) => o.id !== objektId);
  daten.einheiten = daten.einheiten.filter((e) => e.objektId !== objektId);
  daten.mietverhaeltnisse = daten.mietverhaeltnisse.filter((m) => !einheitIds.has(m.einheitId));
  daten.abrechnungen = daten.abrechnungen.filter((a) => a.objektId !== objektId);
}

export function legeEinheitAn() {
  if (!aktivesObjektId) return null;
  const neu = neueEinheit(aktivesObjektId, einheiten().length + 1);
  daten.einheiten.push(neu);
  const objekt = aktivesObjekt();
  if (objekt && !objekt.wohnflaecheGesamt) {
    objekt.wohnflaecheGesamt = einheiten().reduce((s, e) => s + (e.wohnflaeche || 0), 0);
  }
  speichere();
  benachrichtige();
  return neu;
}

export function loescheEinheit(einheitId) {
  daten.einheiten = daten.einheiten.filter((e) => e.id !== einheitId);
  daten.mietverhaeltnisse = daten.mietverhaeltnisse.filter((m) => m.einheitId !== einheitId);
  for (const a of daten.abrechnungen) a.verbraeuche = a.verbraeuche.filter((v) => v.einheitId !== einheitId);
  speichere();
  benachrichtige();
}

export function legeMietverhaeltnisAn() {
  const liste = einheiten();
  if (!liste.length) return null;
  const jahr = aktiveAbrechnung()?.jahr || new Date().getFullYear();
  const neu = neuesMietverhaeltnis(liste[0].id, jahr);
  daten.mietverhaeltnisse.push(neu);
  speichere();
  benachrichtige();
  return neu;
}

export function loescheMietverhaeltnis(mietverhaeltnisId) {
  daten.mietverhaeltnisse = daten.mietverhaeltnisse.filter((m) => m.id !== mietverhaeltnisId);
  for (const a of daten.abrechnungen) {
    a.verbraeuche = a.verbraeuche.filter((v) => v.mietverhaeltnisId !== mietverhaeltnisId);
  }
  speichere();
  benachrichtige();
}

/* -------------------------------------------------- Abrechnungszeiträume */

export function legeAbrechnungAn(jahr) {
  if (!aktivesObjektId) return null;
  const neu = neueAbrechnung(aktivesObjektId, jahr);
  daten.abrechnungen.push(neu);
  aktiveAbrechnungId = neu.id;
  speichere();
  benachrichtige();
  return neu;
}

export function loescheAbrechnung(id) {
  daten.abrechnungen = daten.abrechnungen.filter((a) => a.id !== id);
  if (aktiveAbrechnungId === id) aktiveAbrechnungId = null;
  richteAuswahlAus();
  speichere();
  benachrichtige();
}

/* ---------------------------------------------------------------- Sonstiges */

export function ladeDemodaten() {
  ersetze(demodaten());
}

export function setzeZurueck() {
  daten = leererDatenbestand();
  aktivesObjektId = null;
  aktiveAbrechnungId = null;
  localStorage.removeItem(SCHLUESSEL);
  localStorage.removeItem(AUSWAHL_OBJEKT);
  localStorage.removeItem(AUSWAHL_ABRECHNUNG);
  benachrichtige();
}

export function abonniere(fn) {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

function benachrichtige() {
  for (const fn of hoerer) fn(daten);
}

/** JSON-Sicherung als Datei erzeugen. */
export function sicherungBlob() {
  const inhalt = JSON.stringify({ exportiertAm: new Date().toISOString(), daten }, null, 2);
  return new Blob([inhalt], { type: 'application/json' });
}

export async function stelleWiederHer(datei) {
  const text = await datei.text();
  const inhalt = JSON.parse(text);
  const nutzdaten = inhalt.daten || inhalt;
  if (!nutzdaten || typeof nutzdaten !== 'object' || !Array.isArray(nutzdaten.einheiten)) {
    throw new Error('Die Datei enthält keine gültige Sicherung.');
  }
  ersetze(nutzdaten);
}
