/**
 * Datumsrechnung für Abrechnungszeiträume.
 * Alle Datumsangaben sind ISO-Strings "YYYY-MM-DD". Zeiträume sind
 * tagegenau und inklusive beider Randtage (üblich in der Betriebskostenpraxis).
 */

const MS_PRO_TAG = 86400000;

/** Wandelt "YYYY-MM-DD" in einen UTC-Zeitstempel. */
export function ts(iso) {
  if (!iso) return NaN;
  const [j, m, t] = String(iso).slice(0, 10).split('-').map(Number);
  if (!j || !m || !t) return NaN;
  return Date.UTC(j, m - 1, t);
}

/** Wandelt einen UTC-Zeitstempel in "YYYY-MM-DD". */
export function iso(zeitstempel) {
  return new Date(zeitstempel).toISOString().slice(0, 10);
}

export function istDatum(wert) {
  return Number.isFinite(ts(wert));
}

/** Anzahl Tage von..bis, beide Randtage eingeschlossen. */
export function tage(von, bis) {
  const a = ts(von);
  const b = ts(bis);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / MS_PRO_TAG) + 1;
}

/** Anzahl Tage, die sich zwei Zeiträume überschneiden (inklusive Randtage). */
export function ueberschneidungTage(von1, bis1, von2, bis2) {
  const start = Math.max(ts(von1), ts(von2));
  const ende = Math.min(ts(bis1), ts(bis2));
  if (!Number.isFinite(start) || !Number.isFinite(ende) || ende < start) return 0;
  return Math.round((ende - start) / MS_PRO_TAG) + 1;
}

/** Schnittmenge zweier Zeiträume oder null. */
export function schnitt(von1, bis1, von2, bis2) {
  const start = Math.max(ts(von1), ts(von2));
  const ende = Math.min(ts(bis1), ts(bis2));
  if (!Number.isFinite(start) || !Number.isFinite(ende) || ende < start) return null;
  return { von: iso(start), bis: iso(ende) };
}

/** Datum um n Tage verschieben. */
export function plusTage(datum, n) {
  return iso(ts(datum) + n * MS_PRO_TAG);
}

/** Datum um n Monate verschieben (Monatsende wird gekappt). */
export function plusMonate(datum, n) {
  const d = new Date(ts(datum));
  const tagImMonat = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const letzterTag = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(tagImMonat, letzterTag));
  return iso(d.getTime());
}

/** Anzahl angefangener Monate eines Zeitraums (für Vorauszahlungen). */
export function monateImZeitraum(von, bis) {
  const a = new Date(ts(von));
  const b = new Date(ts(bis));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
}

/** "2024-01-01" -> "01.01.2024" */
export function dt(datum) {
  if (!istDatum(datum)) return '';
  const [j, m, t] = String(datum).slice(0, 10).split('-');
  return `${t}.${m}.${j}`;
}

/** Heutiges Datum als ISO-String. */
export function heute() {
  const d = new Date();
  return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Letzter Tag des Jahres eines Datums. */
export function jahresende(jahr) {
  return `${jahr}-12-31`;
}
