/**
 * Geldbeträge werden durchgängig als ganzzahlige Cent-Werte gerechnet.
 * Damit gibt es keine Fließkomma-Rundungsfehler in der Abrechnung.
 */

/** Kaufmännische Rundung (halbe Cent von der Null weg). */
export function runde(zahl) {
  return zahl < 0 ? -Math.round(-zahl) : Math.round(zahl);
}

/**
 * Parst eine Benutzereingabe in Cent.
 * Akzeptiert "1.234,56", "1234,56", "1234.56", 1234.56 und "".
 * @returns {number} Cent, 0 bei leerer/ungültiger Eingabe
 */
export function parseBetrag(eingabe) {
  if (eingabe === null || eingabe === undefined || eingabe === '') return 0;
  if (typeof eingabe === 'number') return runde(eingabe * 100);

  let text = String(eingabe).trim().replace(/[\s €]/g, '');
  if (text === '' || text === '-') return 0;

  const hatKomma = text.includes(',');
  const hatPunkt = text.includes('.');

  if (hatKomma && hatPunkt) {
    // Das zuletzt stehende Zeichen ist das Dezimaltrennzeichen.
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hatKomma) {
    text = text.replace(',', '.');
  } else if (hatPunkt) {
    // "1.234" ist ein Tausenderpunkt, "12.34" eine Dezimalzahl.
    const nachkomma = text.length - text.lastIndexOf('.') - 1;
    if (nachkomma === 3 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  }

  const wert = Number.parseFloat(text);
  return Number.isFinite(wert) ? runde(wert * 100) : 0;
}

/** Parst eine Dezimalzahl (Fläche, Verbrauch, Anteil) aus deutscher Schreibweise. */
export function parseZahl(eingabe) {
  if (eingabe === null || eingabe === undefined || eingabe === '') return 0;
  if (typeof eingabe === 'number') return Number.isFinite(eingabe) ? eingabe : 0;
  const wert = parseBetrag(eingabe) / 100;
  return Number.isFinite(wert) ? wert : 0;
}

const EURO_FORMAT = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatiert Cent als "1.234,56 €". */
export function euro(cent) {
  return EURO_FORMAT.format((cent || 0) / 100);
}

/** Formatiert Cent als "1.234,56" (ohne Währungszeichen). */
export function betragText(cent) {
  return ((cent || 0) / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formatiert eine Dezimalzahl mit fester Nachkommastellenzahl. */
export function zahl(wert, nachkomma = 2) {
  return (Number.isFinite(wert) ? wert : 0).toLocaleString('de-DE', {
    minimumFractionDigits: nachkomma,
    maximumFractionDigits: nachkomma,
  });
}

/** Formatiert einen Anteil (0..1) als Prozentwert. */
export function prozent(anteil, nachkomma = 2) {
  return zahl((anteil || 0) * 100, nachkomma) + ' %';
}

/**
 * Anteiliger Betrag: gesamt * anteil, kaufmännisch auf Cent gerundet.
 * Rundungsdifferenzen verbleiben beim Vermieter — das entspricht der Praxis
 * und ist gegenüber dem Mieter nie nachteilig relevant (max. 1 Cent).
 */
export function anteilVon(gesamtCent, anteil) {
  if (!Number.isFinite(anteil) || anteil <= 0) return 0;
  return runde(gesamtCent * anteil);
}

/** Summiert eine Liste von Cent-Beträgen. */
export function summe(werte) {
  return werte.reduce((a, b) => a + (b || 0), 0);
}
