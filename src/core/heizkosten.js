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
import { teileCo2Kosten, EMISSIONSFAKTOR } from './co2.js';

/**
 * Energieträger einer Wärmeerzeugung.
 *
 *  - `heizwert`      kWh je Mengeneinheit (Standardwert für Überschlagsrechnungen)
 *  - `co2Pflichtig`  true, wenn der Träger dem BEHG unterliegt und damit
 *                    CO2-Kosten nach dem CO2KostAufG anfallen. Strom fällt
 *                    nicht darunter (er unterliegt dem europäischen
 *                    Emissionshandel), Holz ebenfalls nicht.
 *  - `arbeitszahl`   true, wenn aus der eingesetzten Energie erst über eine
 *                    Arbeitszahl die erzeugte Wärmemenge wird (Wärmepumpe).
 */
export const ENERGIETRAEGER = {
  erdgas: { bezeichnung: 'Erdgas H', einheit: 'm³', heizwert: 10.0, co2Pflichtig: true },
  heizoel: { bezeichnung: 'Heizöl EL', einheit: 'l', heizwert: 10.0, co2Pflichtig: true },
  fluessiggas: { bezeichnung: 'Flüssiggas', einheit: 'l', heizwert: 6.57, co2Pflichtig: true },
  pellets: { bezeichnung: 'Holzpellets', einheit: 'kg', heizwert: 4.8, co2Pflichtig: false },
  fernwaerme: { bezeichnung: 'Fernwärme', einheit: 'kWh', heizwert: 1.0, co2Pflichtig: true },
  waermepumpe: { bezeichnung: 'Wärmepumpenstrom', einheit: 'kWh', heizwert: 1.0, co2Pflichtig: false, arbeitszahl: true },
  heizstrom: { bezeichnung: 'Heizstrom (direkt)', einheit: 'kWh', heizwert: 1.0, co2Pflichtig: false },
};

export function energietraeger(id) {
  return ENERGIETRAEGER[id] || null;
}

/** Emissionsfaktor in kg CO₂ je kWh Endenergie. */
export function emissionsfaktor(traegerId) {
  return EMISSIONSFAKTOR[traegerId] || 0;
}

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

/* ---------------------------------------------------------- Wärmeerzeuger */

/**
 * Wärmemenge eines Erzeugers in kWh.
 *
 * Vorrang hat die Messung: die Differenz zweier Zählerstände, ersatzweise eine
 * direkt eingetragene Wärmemenge. Erst wenn kein Wärmemengenzähler vorhanden
 * ist, wird aus der eingesetzten Energiemenge gerechnet – bei einer Wärmepumpe
 * über die Arbeitszahl, sonst über den Heizwert.
 */
export function waermemengeVon(e = {}) {
  const stand = (e.zaehler?.standEnde || 0) - (e.zaehler?.standAnfang || 0);
  if (stand > 0) return stand;
  if (e.waermemengeKwh > 0) return e.waermemengeKwh;

  const t = ENERGIETRAEGER[e.energietraeger];
  const endenergie = (e.menge || 0) * (t?.heizwert || 0);
  if (t?.arbeitszahl) return endenergie * (e.arbeitszahl > 0 ? e.arbeitszahl : 1);
  return endenergie;
}

/** true, wenn die Wärmemenge dieses Erzeugers gemessen und nicht gerechnet ist. */
export function istGemessen(e = {}) {
  return (e.zaehler?.standEnde || 0) - (e.zaehler?.standAnfang || 0) > 0 || (e.waermemengeKwh || 0) > 0;
}

/**
 * Bereitet die Wärmeerzeuger für die Abrechnung auf und bildet die Summen.
 *
 * CO2-Kosten werden nur von Erzeugern übernommen, deren Energieträger dem
 * BEHG unterliegt. Wärmepumpenstrom bleibt dabei außen vor – für ihn gilt das
 * CO2KostAufG nicht, und er senkt dadurch zugleich den Emissionskennwert des
 * Gebäudes.
 */
export function fasseErzeugerZusammen(liste = []) {
  const erzeuger = liste.map((e) => {
    const t = ENERGIETRAEGER[e.energietraeger] || {};
    const co2Pflichtig = !!t.co2Pflichtig;
    return {
      id: e.id,
      bezeichnung: e.bezeichnung || t.bezeichnung || 'Wärmeerzeuger',
      energietraeger: e.energietraeger,
      traegerBezeichnung: t.bezeichnung || e.energietraeger || '',
      mengeneinheit: t.einheit || '',
      menge: e.menge || 0,
      arbeitszahl: t.arbeitszahl ? (e.arbeitszahl > 0 ? e.arbeitszahl : 1) : 0,
      zaehlernummer: e.zaehler?.nummer || '',
      waermeKwh: waermemengeVon(e),
      gemessen: istGemessen(e),
      kostenCent: e.kostenCent || 0,
      co2Pflichtig,
      co2KostenCent: co2Pflichtig ? e.co2KostenCent || 0 : 0,
      co2EmissionKg: co2Pflichtig ? e.co2EmissionKg || 0 : 0,
    };
  });

  const waermeGesamtKwh = summe(erzeuger.map((e) => e.waermeKwh));
  return {
    erzeuger,
    anzahl: erzeuger.length,
    hybrid: erzeuger.length > 1,
    kostenGesamt: summe(erzeuger.map((e) => e.kostenCent)),
    waermeGesamtKwh,
    vollstaendigGemessen: erzeuger.length > 0 && erzeuger.every((e) => e.gemessen),
    co2KostenGesamt: summe(erzeuger.map((e) => e.co2KostenCent)),
    co2EmissionGesamt: summe(erzeuger.map((e) => e.co2EmissionKg)),
    anteile: erzeuger.map((e) => ({
      id: e.id,
      bezeichnung: e.bezeichnung,
      anteilWaerme: waermeGesamtKwh > 0 ? e.waermeKwh / waermeGesamtKwh : 0,
    })),
  };
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
 * @param {number} p.prozentsatz        fester Anteil 0..1 (Modus 'prozent')
 */
export function warmwasserAnteil(p = {}) {
  const modus = p.modus || 'formel';

  if (modus === 'prozent') {
    const anteil = klemme(p.prozentsatz ?? 0.18, 0, 1);
    return { anteil, methode: 'Fester vertraglich/technisch begründeter Anteil', warmwasserKwh: 0, gesamtwaermeKwh: 0 };
  }

  const gesamtwaermeKwh = p.gesamtwaermeKwh > 0 ? p.gesamtwaermeKwh : 0;

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
 * @param {Array}  p.erzeuger          Wärmeerzeuger: [{ energietraeger, menge, arbeitszahl, zaehler, waermemengeKwh, kostenCent, co2KostenCent, co2EmissionKg }]
 * @param {object} p.kosten            Cent-Beträge: betriebsstrom, wartung, messdienst, schornsteinfeger, sonstiges
 * @param {object} p.co2               Gebäudeangaben für das CO2KostAufG: gebaeudetyp, ausnahme
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

  // 0. Wärmeerzeuger zusammenfassen. Eine Hybridanlage – etwa Gaskessel und
  //    Wärmepumpe – liefert hier mehrere Einträge; ihre Kosten bilden gemeinsam
  //    die Brennstoffkosten, ihre Wärmemengen die Gesamtwärmemenge.
  const erzeugung = fasseErzeugerZusammen(p.erzeuger || []);

  const brennstoffBrutto = erzeugung.kostenGesamt;
  const nebenkosten = summe([
    kosten.betriebsstrom,
    kosten.wartung,
    kosten.messdienst,
    kosten.schornsteinfeger,
    kosten.sonstiges,
  ]);

  // 1. CO2-Kosten aufteilen — der Vermieteranteil wird vorab abgezogen
  //    (§ 6 CO2KostAufG). Berücksichtigt werden nur Energieträger, die dem
  //    BEHG unterliegen; Wärmepumpenstrom bleibt außen vor.
  const co2 = teileCo2Kosten({
    co2KostenCent: erzeugung.co2KostenGesamt,
    emissionKg: erzeugung.co2EmissionGesamt,
    wohnflaeche: p.wohnflaecheGesamt || 0,
    tageZeitraum: p.tageZeitraum || 365,
    gebaeudetyp: p.co2?.gebaeudetyp || 'wohn',
    ausnahme: !!p.co2?.ausnahme,
  });

  const umlagefaehigeBrennstoffkosten = Math.max(0, brennstoffBrutto - co2.vermieterCent);
  const gesamtUmlagefaehig = umlagefaehigeBrennstoffkosten + nebenkosten;

  // 2. Aufteilung Heizung / Warmwasser
  const ww = p.verbunden
    ? warmwasserAnteil({ ...(p.warmwasser || {}), gesamtwaermeKwh: erzeugung.waermeGesamtKwh })
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
    erzeugung,
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
