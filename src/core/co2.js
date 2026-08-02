/**
 * Aufteilung der CO2-Kosten nach dem Kohlendioxidkostenaufteilungsgesetz
 * (CO2KostAufG, in Kraft seit 01.01.2023).
 *
 * Bei Wohngebäuden gilt das Stufenmodell der Anlage zu § 5 Abs. 1 CO2KostAufG:
 * Je schlechter die spezifische Emission des Gebäudes (kg CO2 je m² Wohnfläche
 * und Jahr), desto höher der vom Vermieter zu tragende Anteil. Der Vermieter-
 * anteil wird vor der Umlage von den Brennstoffkosten abgezogen (§ 6 Abs. 1).
 */

/** Stufenmodell für Wohngebäude, Anlage zu § 5 Abs. 1 CO2KostAufG. */
export const STUFEN = [
  { stufe: 1, ab: 0, unter: 12, mieter: 1.0, vermieter: 0.0 },
  { stufe: 2, ab: 12, unter: 17, mieter: 0.9, vermieter: 0.1 },
  { stufe: 3, ab: 17, unter: 22, mieter: 0.8, vermieter: 0.2 },
  { stufe: 4, ab: 22, unter: 27, mieter: 0.7, vermieter: 0.3 },
  { stufe: 5, ab: 27, unter: 32, mieter: 0.6, vermieter: 0.4 },
  { stufe: 6, ab: 32, unter: 37, mieter: 0.5, vermieter: 0.5 },
  { stufe: 7, ab: 37, unter: 42, mieter: 0.4, vermieter: 0.6 },
  { stufe: 8, ab: 42, unter: 47, mieter: 0.3, vermieter: 0.7 },
  { stufe: 9, ab: 47, unter: 52, mieter: 0.2, vermieter: 0.8 },
  { stufe: 10, ab: 52, unter: Infinity, mieter: 0.05, vermieter: 0.95 },
];

/** Emissionsfaktoren in kg CO2 je kWh (Standardwerte, Rechnung geht vor). */
export const EMISSIONSFAKTOR = {
  erdgas: 0.201,
  heizoel: 0.266,
  fluessiggas: 0.234,
  fernwaerme: 0.18,
  pellets: 0.0,
  waermepumpe: 0.0,
};

/**
 * Ermittelt die Stufe anhand der spezifischen Emission.
 * @param {number} kgProM2 kg CO2 je m² Wohnfläche und Jahr
 */
export function stufeFuer(kgProM2) {
  const wert = Number.isFinite(kgProM2) && kgProM2 > 0 ? kgProM2 : 0;
  return STUFEN.find((s) => wert >= s.ab && wert < s.unter) || STUFEN[0];
}

/**
 * Teilt die CO2-Kosten zwischen Vermieter und Mieterschaft auf.
 *
 * @param {object} p
 * @param {number} p.co2KostenCent  Im Abrechnungszeitraum angefallene CO2-Kosten (aus der Brennstoffrechnung, § 3 CO2KostAufG)
 * @param {number} p.emissionKg     Im Abrechnungszeitraum verursachte CO2-Menge in kg
 * @param {number} p.wohnflaeche    Gesamtwohnfläche des Gebäudes in m²
 * @param {number} p.tageZeitraum   Länge des Abrechnungszeitraums in Tagen (für die Hochrechnung auf ein Jahr)
 * @param {'wohn'|'nichtwohn'} p.gebaeudetyp
 * @param {boolean} p.ausnahme      Vermieteranteil entfällt, weil öffentlich-rechtliche Vorgaben eine Sanierung verhindern (§ 9 CO2KostAufG)
 */
export function teileCo2Kosten({
  co2KostenCent = 0,
  emissionKg = 0,
  wohnflaeche = 0,
  tageZeitraum = 365,
  gebaeudetyp = 'wohn',
  ausnahme = false,
}) {
  const basis = {
    co2KostenCent,
    emissionKg,
    wohnflaeche,
    gebaeudetyp,
    anwendbar: co2KostenCent > 0,
  };

  if (co2KostenCent <= 0) {
    return { ...basis, kgProM2: 0, stufe: null, anteilVermieter: 0, anteilMieter: 1, vermieterCent: 0, mieterCent: co2KostenCent };
  }

  if (ausnahme) {
    return {
      ...basis,
      kgProM2: 0,
      stufe: null,
      anteilVermieter: 0,
      anteilMieter: 1,
      vermieterCent: 0,
      mieterCent: co2KostenCent,
      hinweis: 'Ausnahme nach § 9 CO2KostAufG: Der Vermieteranteil entfällt.',
    };
  }

  // Nichtwohngebäude: bis zur Einführung eines eigenen Stufenmodells hälftige
  // Teilung (§ 8 Abs. 1 CO2KostAufG).
  if (gebaeudetyp === 'nichtwohn') {
    const vermieterCent = Math.round(co2KostenCent * 0.5);
    return {
      ...basis,
      kgProM2: 0,
      stufe: null,
      anteilVermieter: 0.5,
      anteilMieter: 0.5,
      vermieterCent,
      mieterCent: co2KostenCent - vermieterCent,
      hinweis: 'Nichtwohngebäude: hälftige Teilung nach § 8 Abs. 1 CO2KostAufG.',
    };
  }

  // Auf ein volles Jahr hochrechnen, damit unterjährige Zeiträume korrekt
  // eingestuft werden (§ 5 Abs. 2 CO2KostAufG).
  const jahresfaktor = tageZeitraum > 0 ? 365 / tageZeitraum : 1;
  const kgProM2 = wohnflaeche > 0 ? (emissionKg * jahresfaktor) / wohnflaeche : 0;
  const stufe = stufeFuer(kgProM2);
  const vermieterCent = Math.round(co2KostenCent * stufe.vermieter);

  return {
    ...basis,
    jahresfaktor,
    kgProM2,
    stufe,
    anteilVermieter: stufe.vermieter,
    anteilMieter: stufe.mieter,
    vermieterCent,
    mieterCent: co2KostenCent - vermieterCent,
  };
}

/** Schätzt die CO2-Menge aus Energiemenge und Brennstoffart. */
export function schaetzeEmission(kwh, brennstoff) {
  const faktor = EMISSIONSFAKTOR[brennstoff];
  return Number.isFinite(faktor) ? kwh * faktor : 0;
}
