/**
 * Abrechnung der Heiz- und Warmwasserkosten nach der Verordnung über
 * Heizkostenabrechnung (HeizkostenV).
 *
 * Kernregeln:
 *  - § 7 Abs. 1: 50 bis 70 % der Heizkosten sind nach erfasstem Verbrauch zu
 *    verteilen, der Rest als Grundkosten nach Wohn-/Nutzfläche oder umbautem Raum.
 *  - § 8 Abs. 1: dasselbe für die Warmwasserkosten.
 *  - § 9 Abs. 2: Bei verbundenen Anlagen wird die auf das Warmwasser
 *    entfallende Wärmemenge vorrangig gemessen; ersatzweise gilt
 *    Q = 2,5 · V · (tw − 10) / 1000  [MWh].
 *  - § 12 Abs. 1: Wird nicht verbrauchsabhängig abgerechnet, kann der Nutzer
 *    den auf ihn entfallenden Anteil um 15 % kürzen.
 */

import { runde, anteilVon, summe } from './money.js';
import { teileCo2Kosten } from './co2.js';

/** Heizwerte in kWh je Mengeneinheit (Standardwerte für Überschlagsrechnungen). */
export const HEIZWERT = {
  erdgas: { wert: 10.0, einheit: 'm³', bezeichnung: 'Erdgas H' },
  heizoel: { wert: 10.0, einheit: 'l', bezeichnung: 'Heizöl EL' },
  fluessiggas: { wert: 6.57, einheit: 'l', bezeichnung: 'Flüssiggas' },
  pellets: { wert: 4.8, einheit: 'kg', bezeichnung: 'Holzpellets' },
  fernwaerme: { wert: 1.0, einheit: 'kWh', bezeichnung: 'Fernwärme' },
  waermepumpe: { wert: 1.0, einheit: 'kWh', bezeichnung: 'Wärmepumpenstrom' },
};

export const VERBRAUCHSANTEIL_MIN = 0.5;
export const VERBRAUCHSANTEIL_MAX = 0.7;

/**
 * Prüft den gewählten Verbrauchsanteil gegen § 7 Abs. 1 / § 8 Abs. 1 HeizkostenV.
 */
export function verbrauchsanteilZulaessig(anteil) {
  return Number.isFinite(anteil) && anteil >= VERBRAUCHSANTEIL_MIN - 1e-9 && anteil <= VERBRAUCHSANTEIL_MAX + 1e-9;
}

/**
 * Wärmemenge des Warmwassers nach § 9 Abs. 2 HeizkostenV.
 * @param {number} volumenM3 verbrauchtes Warmwasser in m³
 * @param {number} temperaturC mittlere Warmwassertemperatur in °C
 * @returns {number} Wärmemenge in kWh
 */
export function warmwasserWaermemengeKwh(volumenM3, temperaturC = 60) {
  const v = Number.isFinite(volumenM3) ? volumenM3 : 0;
  const t = Number.isFinite(temperaturC) ? temperaturC : 60;
  if (v <= 0 || t <= 10) return 0;
  // Q [MWh] = 2,5 · V · (tw − 10) / 1000  =>  Q [kWh] = 2,5 · V · (tw − 10)
  return 2.5 * v * (t - 10);
}

/**
 * Ermittelt den Anteil der Warmwasserbereitung an den Brennstoffkosten
 * einer verbundenen Anlage.
 *
 * @param {object} p
 * @param {'wmz'|'formel'|'prozent'} p.modus
 * @param {number} p.warmwasserKwh      gemessene Wärmemenge Warmwasser (Modus 'wmz')
 * @param {number} p.warmwasserVolumen  Gesamtwarmwasser in m³ (Modus 'formel')
 * @param {number} p.temperatur         mittlere Warmwassertemperatur in °C
 * @param {number} p.gesamtwaermeKwh    insgesamt erzeugte Wärmemenge in kWh
 * @param {number} p.brennstoffmenge    verbrauchte Brennstoffmenge
 * @param {string} p.brennstoff         Schlüssel aus HEIZWERT
 * @param {number} p.prozentsatz        fester Anteil 0..1 (Modus 'prozent')
 */
export function warmwasserAnteil(p = {}) {
  const modus = p.modus || 'formel';

  if (modus === 'prozent') {
    const anteil = klemme(p.prozentsatz ?? 0.18, 0, 1);
    return { anteil, methode: 'Fester vertraglich/technisch begründeter Anteil', warmwasserKwh: 0, gesamtwaermeKwh: 0 };
  }

  const gesamtwaermeKwh =
    p.gesamtwaermeKwh > 0
      ? p.gesamtwaermeKwh
      : (p.brennstoffmenge || 0) * (HEIZWERT[p.brennstoff]?.wert || 0);

  const warmwasserKwh =
    modus === 'wmz'
      ? p.warmwasserKwh || 0
      : warmwasserWaermemengeKwh(p.warmwasserVolumen, p.temperatur);

  if (gesamtwaermeKwh <= 0 || warmwasserKwh <= 0) {
    return { anteil: 0, methode: 'Keine Aufteilung möglich – Datengrundlage fehlt', warmwasserKwh, gesamtwaermeKwh };
  }

  return {
    anteil: klemme(warmwasserKwh / gesamtwaermeKwh, 0, 1),
    methode:
      modus === 'wmz'
        ? 'Gemessene Wärmemenge Warmwasser (Wärmemengenzähler, § 9 Abs. 2 Satz 1 HeizkostenV)'
        : 'Rechnerisch nach § 9 Abs. 2 HeizkostenV: Q = 2,5 · V · (tw − 10) / 1000',
    warmwasserKwh,
    gesamtwaermeKwh,
  };
}

function klemme(wert, min, max) {
  if (!Number.isFinite(wert)) return min;
  return Math.min(max, Math.max(min, wert));
}

/**
 * Vollständige Heiz- und Warmwasserkostenabrechnung.
 *
 * @param {object} p
 * @param {object} p.kosten            Cent-Beträge: brennstoff, betriebsstrom, wartung, messdienst, schornsteinfeger, sonstiges
 * @param {object} p.co2               Eingaben für das CO2KostAufG (optional)
 * @param {boolean} p.verbunden        verbundene Anlage (Heizung + Warmwasser aus einer Erzeugung)
 * @param {object} p.warmwasser        Parameter für warmwasserAnteil()
 * @param {number} p.anteilVerbrauchHeizung   0,5..0,7
 * @param {number} p.anteilVerbrauchWarmwasser 0,5..0,7
 * @param {boolean} p.verbrauchserfassung  false => § 12 HeizkostenV, 15 % Kürzung
 * @param {Array} p.nutzer  [{ id, bezeichnung, flaecheTage, verbrauchHeizung, verbrauchWarmwasser, leerstand }]
 * @param {number} p.tageZeitraum
 * @param {number} p.wohnflaecheGesamt
 */
export function berechneHeizkosten(p) {
  const kosten = p.kosten || {};
  const nutzer = p.nutzer || [];

  const brennstoffBrutto = kosten.brennstoff || 0;
  const nebenkosten = summe([
    kosten.betriebsstrom,
    kosten.wartung,
    kosten.messdienst,
    kosten.schornsteinfeger,
    kosten.sonstiges,
  ]);

  // 1. CO2-Kosten aufteilen — der Vermieteranteil wird vorab abgezogen (§ 6 CO2KostAufG).
  const co2 = teileCo2Kosten({
    co2KostenCent: p.co2?.kostenCent || 0,
    emissionKg: p.co2?.emissionKg || 0,
    wohnflaeche: p.wohnflaecheGesamt || 0,
    tageZeitraum: p.tageZeitraum || 365,
    gebaeudetyp: p.co2?.gebaeudetyp || 'wohn',
    ausnahme: !!p.co2?.ausnahme,
  });

  const umlagefaehigeBrennstoffkosten = Math.max(0, brennstoffBrutto - co2.vermieterCent);
  const gesamtUmlagefaehig = umlagefaehigeBrennstoffkosten + nebenkosten;

  // 2. Aufteilung Heizung / Warmwasser
  const ww = p.verbunden
    ? warmwasserAnteil(p.warmwasser || {})
    : { anteil: 0, methode: 'Getrennte Anlagen – keine Aufteilung erforderlich', warmwasserKwh: 0, gesamtwaermeKwh: 0 };

  const kostenWarmwasser = p.verbunden ? anteilVon(gesamtUmlagefaehig, ww.anteil) : (p.kostenWarmwasserSeparat || 0);
  const kostenHeizung = p.verbunden ? gesamtUmlagefaehig - kostenWarmwasser : gesamtUmlagefaehig;

  // 3. Grund- und Verbrauchsanteile bilden (§ 7 Abs. 1, § 8 Abs. 1 HeizkostenV)
  const aH = klemme(p.anteilVerbrauchHeizung ?? 0.7, 0, 1);
  const aW = klemme(p.anteilVerbrauchWarmwasser ?? 0.7, 0, 1);

  const heizVerbrauchTopf = anteilVon(kostenHeizung, aH);
  const heizGrundTopf = kostenHeizung - heizVerbrauchTopf;
  const wwVerbrauchTopf = anteilVon(kostenWarmwasser, aW);
  const wwGrundTopf = kostenWarmwasser - wwVerbrauchTopf;

  // 4. Bezugsgrößen
  const flaecheTageGesamt = summe(nutzer.map((n) => n.flaecheTage || 0));
  const verbrauchHeizungGesamt = summe(nutzer.map((n) => n.verbrauchHeizung || 0));
  const verbrauchWarmwasserGesamt = summe(nutzer.map((n) => n.verbrauchWarmwasser || 0));

  const zeilen = nutzer.map((n) => {
    const flAnteil = flaecheTageGesamt > 0 ? (n.flaecheTage || 0) / flaecheTageGesamt : 0;
    const vhAnteil = verbrauchHeizungGesamt > 0 ? (n.verbrauchHeizung || 0) / verbrauchHeizungGesamt : 0;
    const vwAnteil = verbrauchWarmwasserGesamt > 0 ? (n.verbrauchWarmwasser || 0) / verbrauchWarmwasserGesamt : 0;

    // Ohne Verbrauchserfassung fällt alles auf den Flächenmaßstab zurück.
    const ohneErfassung = p.verbrauchserfassung === false;
    const heizGrund = anteilVon(heizGrundTopf, flAnteil);
    const heizVerbrauch = anteilVon(heizVerbrauchTopf, ohneErfassung ? flAnteil : vhAnteil);
    const wwGrund = anteilVon(wwGrundTopf, flAnteil);
    const wwVerbrauch = anteilVon(wwVerbrauchTopf, ohneErfassung ? flAnteil : vwAnteil);

    const roh = heizGrund + heizVerbrauch + wwGrund + wwVerbrauch;
    // § 12 Abs. 1 HeizkostenV: 15 % Kürzung, wenn nicht verbrauchsabhängig abgerechnet wird.
    const kuerzung = ohneErfassung && !n.leerstand ? runde(roh * 0.15) : 0;

    return {
      id: n.id,
      bezeichnung: n.bezeichnung,
      leerstand: !!n.leerstand,
      flaecheTage: n.flaecheTage || 0,
      flaecheAnteil: flAnteil,
      verbrauchHeizung: n.verbrauchHeizung || 0,
      verbrauchHeizungAnteil: ohneErfassung ? flAnteil : vhAnteil,
      verbrauchWarmwasser: n.verbrauchWarmwasser || 0,
      verbrauchWarmwasserAnteil: ohneErfassung ? flAnteil : vwAnteil,
      heizGrund,
      heizVerbrauch,
      wwGrund,
      wwVerbrauch,
      kuerzung15: kuerzung,
      summe: roh - kuerzung,
    };
  });

  return {
    kostenRoh: { brennstoffBrutto, nebenkosten, gesamt: brennstoffBrutto + nebenkosten },
    co2,
    umlagefaehigeBrennstoffkosten,
    gesamtUmlagefaehig,
    verbunden: !!p.verbunden,
    warmwasserAufteilung: ww,
    kostenHeizung,
    kostenWarmwasser,
    anteilVerbrauchHeizung: aH,
    anteilVerbrauchWarmwasser: aW,
    verbrauchserfassung: p.verbrauchserfassung !== false,
    toepfe: { heizGrundTopf, heizVerbrauchTopf, wwGrundTopf, wwVerbrauchTopf },
    bezug: { flaecheTageGesamt, verbrauchHeizungGesamt, verbrauchWarmwasserGesamt },
    zeilen,
    summeVerteilt: summe(zeilen.map((z) => z.summe)),
  };
}
