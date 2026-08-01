import type { Cent, ISODate } from './types';

// ---------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------

const MS_PRO_TAG = 24 * 60 * 60 * 1000;

/** Parst ein ISO-Datum als UTC-Mitternacht, um Zeitzonenverschiebungen auszuschließen. */
export function parseDatum(d: ISODate): Date {
  const [j, m, t] = d.split('-').map(Number);
  return new Date(Date.UTC(j, (m ?? 1) - 1, t ?? 1));
}

export function formatDatum(d: ISODate | undefined): string {
  if (!d) return '–';
  const datum = parseDatum(d);
  return `${String(datum.getUTCDate()).padStart(2, '0')}.${String(datum.getUTCMonth() + 1).padStart(2, '0')}.${datum.getUTCFullYear()}`;
}

export function heuteISO(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

export function addTage(d: ISODate, tage: number): ISODate {
  const datum = parseDatum(d);
  datum.setUTCDate(datum.getUTCDate() + tage);
  return datum.toISOString().slice(0, 10);
}

export function addMonate(d: ISODate, monate: number): ISODate {
  const datum = parseDatum(d);
  const zielTag = datum.getUTCDate();
  datum.setUTCDate(1);
  datum.setUTCMonth(datum.getUTCMonth() + monate);
  const letzterTag = new Date(
    Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth() + 1, 0),
  ).getUTCDate();
  datum.setUTCDate(Math.min(zielTag, letzterTag));
  return datum.toISOString().slice(0, 10);
}

/** Anzahl der Tage von `von` bis `bis`, beide Tage eingeschlossen. */
export function tageInZeitraum(von: ISODate, bis: ISODate): number {
  const diff = parseDatum(bis).getTime() - parseDatum(von).getTime();
  if (diff < 0) return 0;
  return Math.round(diff / MS_PRO_TAG) + 1;
}

export interface Zeitraum {
  von: ISODate;
  bis: ISODate;
}

/** Schnittmenge zweier Zeiträume oder null, wenn sie sich nicht überschneiden. */
export function schnittmenge(a: Zeitraum, b: Zeitraum): Zeitraum | null {
  const von = a.von > b.von ? a.von : b.von;
  const bis = a.bis < b.bis ? a.bis : b.bis;
  return von <= bis ? { von, bis } : null;
}

/** Überschneidungstage zweier Zeiträume. */
export function ueberschneidungTage(a: Zeitraum, b: Zeitraum): number {
  const s = schnittmenge(a, b);
  return s ? tageInZeitraum(s.von, s.bis) : 0;
}

/**
 * Anzahl der angefangenen Monate, für die eine monatliche Vorauszahlung
 * geschuldet ist. Ein Monat zählt, wenn das Mietverhältnis am Monatsersten
 * innerhalb des Zeitraums besteht bzw. der Monat anteilig betroffen ist.
 */
export function angefangeneMonate(von: ISODate, bis: ISODate): number {
  if (von > bis) return 0;
  const a = parseDatum(von);
  const b = parseDatum(bis);
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1
  );
}

// ---------------------------------------------------------------------------
// Geld
// ---------------------------------------------------------------------------

const EURO_FORMAT = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEuro(cent: Cent): string {
  return EURO_FORMAT.format(cent / 100);
}

export function formatZahl(wert: number, nachkommastellen = 2): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  }).format(wert);
}

/** Wandelt eine deutsche Eingabe ("1.234,56", "1234.56") in Cent um. */
export function parseEuroZuCent(eingabe: string): Cent {
  const bereinigt = eingabe.trim().replace(/[€\s]/g, '');
  if (!bereinigt) return 0;
  let normalisiert = bereinigt;
  if (bereinigt.includes(',')) {
    normalisiert = bereinigt.replace(/\./g, '').replace(',', '.');
  }
  const wert = Number(normalisiert);
  if (!Number.isFinite(wert)) return 0;
  return Math.round(wert * 100);
}

export function centZuEuroString(cent: Cent): string {
  return (cent / 100).toFixed(2).replace('.', ',');
}

/** Wandelt eine deutsche Dezimaleingabe in eine Zahl um. */
export function parseDezimal(eingabe: string): number {
  const bereinigt = eingabe.trim().replace(/\s/g, '');
  if (!bereinigt) return 0;
  const normalisiert = bereinigt.includes(',')
    ? bereinigt.replace(/\./g, '').replace(',', '.')
    : bereinigt;
  const wert = Number(normalisiert);
  return Number.isFinite(wert) ? wert : 0;
}

// ---------------------------------------------------------------------------
// Verteilung
// ---------------------------------------------------------------------------

/**
 * Verteilt einen Cent-Betrag nach Gewichten so, dass die Summe der Teilbeträge
 * exakt dem Ausgangsbetrag entspricht (Verfahren des größten Rests).
 *
 * Das ist für eine prüffähige Abrechnung notwendig: die Einzelanteile müssen
 * sich lückenlos zur Gesamtsumme addieren.
 */
export function verteileCent(betrag: Cent, gewichte: number[]): Cent[] {
  const summe = gewichte.reduce((a, b) => a + b, 0);
  if (gewichte.length === 0) return [];
  if (summe <= 0) return gewichte.map(() => 0);

  const exakt = gewichte.map((g) => (betrag * g) / summe);
  const abgerundet = exakt.map((w) => Math.floor(w));
  let rest = betrag - abgerundet.reduce((a, b) => a + b, 0);

  const reihenfolge = exakt
    .map((w, i) => ({ i, rest: w - Math.floor(w) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);

  const ergebnis = [...abgerundet];
  let pos = 0;
  const schritt = rest >= 0 ? 1 : -1;
  while (rest !== 0 && reihenfolge.length > 0) {
    const idx = reihenfolge[pos % reihenfolge.length].i;
    ergebnis[idx] += schritt;
    rest -= schritt;
    pos++;
  }
  return ergebnis;
}

/** Rundet einen Prozentanteil eines Betrags kaufmännisch auf volle Cent. */
export function anteilVonBetrag(betrag: Cent, anteil: number): Cent {
  return Math.round(betrag * anteil);
}

export function summe(werte: number[]): number {
  return werte.reduce((a, b) => a + b, 0);
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
