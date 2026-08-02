/**
 * Datenhaltung. Alles bleibt lokal auf dem Gerät (localStorage) – es werden
 * keine Mieterdaten an Server übertragen.
 */

import { leererDatenbestand, migriere, demodaten, neueAbrechnung } from './core/model.js';

const SCHLUESSEL = 'nebenkosten.daten.v1';
const AUSWAHL = 'nebenkosten.auswahl.v1';

let daten = leererDatenbestand();
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
  aktiveAbrechnungId = localStorage.getItem(AUSWAHL) || daten.abrechnungen[0]?.id || null;
  if (aktiveAbrechnungId && !daten.abrechnungen.some((a) => a.id === aktiveAbrechnungId)) {
    aktiveAbrechnungId = daten.abrechnungen[0]?.id || null;
  }
  return daten;
}

export function speichere() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
    if (aktiveAbrechnungId) localStorage.setItem(AUSWAHL, aktiveAbrechnungId);
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
  aktiveAbrechnungId = daten.abrechnungen[0]?.id || null;
  speichere();
  benachrichtige();
}

/** Führt eine Änderung aus, speichert und aktualisiert die Oberfläche. */
export function aendere(fn) {
  const ergebnis = fn(daten);
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

export function aktiveAbrechnung() {
  if (!daten.abrechnungen.length) return null;
  return daten.abrechnungen.find((a) => a.id === aktiveAbrechnungId) || daten.abrechnungen[0];
}

export function setzeAktiveAbrechnung(id) {
  aktiveAbrechnungId = id;
  speichere();
  benachrichtige();
}

export function legeAbrechnungAn(jahr) {
  const neu = neueAbrechnung(jahr);
  daten.abrechnungen.push(neu);
  daten.abrechnungen.sort((a, b) => b.jahr - a.jahr);
  aktiveAbrechnungId = neu.id;
  speichere();
  benachrichtige();
  return neu;
}

export function loescheAbrechnung(id) {
  daten.abrechnungen = daten.abrechnungen.filter((a) => a.id !== id);
  if (aktiveAbrechnungId === id) aktiveAbrechnungId = daten.abrechnungen[0]?.id || null;
  speichere();
  benachrichtige();
}

export function ladeDemodaten() {
  ersetze(demodaten());
}

export function setzeZurueck() {
  daten = leererDatenbestand();
  aktiveAbrechnungId = null;
  localStorage.removeItem(SCHLUESSEL);
  localStorage.removeItem(AUSWAHL);
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
