/**
 * Ermittlung des Warmwasseranteils und der Kostentrennung nach HeizkostenV.
 *
 *  - § 7 Abs. 1 HeizkostenV: 50–70 % der Heizkosten sind nach erfasstem Verbrauch,
 *    der Rest nach Wohn-/Nutzfläche zu verteilen.
 *  - § 8 Abs. 1 HeizkostenV: Entsprechendes gilt für die Warmwasserkosten.
 *  - § 9 Abs. 2 HeizkostenV: Bei verbundenen Anlagen ist die auf die Warmwasser-
 *    bereitung entfallende Wärmemenge vorweg abzuziehen.
 *  - § 12 Abs. 1 HeizkostenV: Wird nicht verbrauchsabhängig abgerechnet, kann der
 *    Mieter den auf ihn entfallenden Anteil um 15 % kürzen.
 */

import type { Cent, HeizkostenEinstellungen } from './types';
import { anteilVonBetrag, formatZahl } from './util';

export const KUERZUNGSSATZ_HEIZKOSTENV = 0.15;

export interface WarmwasserAnteil {
  /** Anteil der Warmwasserkosten an den Gesamtkosten der verbundenen Anlage (0–1) */
  anteil: number;
  /** Nachvollziehbare Herleitung für die Abrechnung */
  herleitung: string;
  /** Die Ermittlung war nicht möglich – es wird 0 angesetzt. */
  unvollstaendig?: boolean;
}

/**
 * Wärmemenge für die Warmwasserbereitung nach der Formel des § 9 Abs. 2 HeizkostenV.
 *
 *   Q [kWh] = 2,5 · V · (t_w − 10)
 *
 * mit V = verbrauchtes Warmwasservolumen in m³ und t_w = mittlere
 * Warmwassertemperatur in °C.
 */
export function waermemengeWarmwasserKwh(volumenM3: number, temperaturC: number): number {
  return 2.5 * volumenM3 * (temperaturC - 10);
}

export function ermittleWarmwasserAnteil(e: HeizkostenEinstellungen): WarmwasserAnteil {
  switch (e.warmwasserErmittlung) {
    case 'GETRENNT':
      return {
        anteil: 0,
        herleitung:
          'Getrennte Anlagen: Heiz- und Warmwasserkosten werden jeweils gesondert erfasst; ein Vorwegabzug nach § 9 HeizkostenV ist nicht erforderlich.',
      };

    case 'WAERMEZAEHLER': {
      const ww = e.waermemengeWarmwasserKwh ?? 0;
      const gesamt = e.gesamtwaermemengeKwh ?? 0;
      if (ww <= 0 || gesamt <= 0) {
        return {
          anteil: 0,
          unvollstaendig: true,
          herleitung:
            'Warmwasseranteil nicht ermittelbar: Wärmemenge Warmwasser und/oder Gesamtwärmemenge fehlen.',
        };
      }
      const anteil = Math.min(ww / gesamt, 1);
      return {
        anteil,
        herleitung:
          `Verbundene Anlage, gemessene Wärmemenge für Warmwasser (§ 9 Abs. 2 S. 1 HeizkostenV): ` +
          `${formatZahl(ww, 0)} kWh von ${formatZahl(gesamt, 0)} kWh Gesamtwärmemenge = ` +
          `${formatZahl(anteil * 100, 2)} %.`,
      };
    }

    case 'FORMEL_9_2': {
      const volumen = e.warmwasserVolumenM3 ?? 0;
      const temperatur = e.warmwasserTemperaturC ?? 60;
      const gesamt = e.gesamtwaermemengeKwh ?? 0;
      if (volumen <= 0 || gesamt <= 0) {
        return {
          anteil: 0,
          unvollstaendig: true,
          herleitung:
            'Warmwasseranteil nicht ermittelbar: Warmwasservolumen und/oder Gesamtwärmemenge fehlen.',
        };
      }
      const ww = waermemengeWarmwasserKwh(volumen, temperatur);
      const anteil = Math.min(Math.max(ww / gesamt, 0), 1);
      return {
        anteil,
        herleitung:
          `Verbundene Anlage, Berechnung nach § 9 Abs. 2 HeizkostenV: ` +
          `Q = 2,5 · ${formatZahl(volumen, 2)} m³ · (${formatZahl(temperatur, 0)} °C − 10 °C) = ` +
          `${formatZahl(ww, 0)} kWh. Anteil an der Gesamtwärmemenge von ` +
          `${formatZahl(gesamt, 0)} kWh = ${formatZahl(anteil * 100, 2)} %.`,
      };
    }

    case 'MANUELL': {
      const prozent = e.warmwasserAnteilProzentManuell ?? 0;
      const anteil = Math.min(Math.max(prozent / 100, 0), 1);
      return {
        anteil,
        herleitung:
          `Warmwasseranteil manuell mit ${formatZahl(prozent, 2)} % angesetzt. ` +
          (e.begruendungManuell ? `Begründung: ${e.begruendungManuell}` : 'Ohne Begründung.'),
      };
    }
  }
}

export interface HeizkostenAufteilung {
  /** Gesamtkosten der Heizungs-/Warmwasseranlage nach Vorwegabzug */
  gesamt: Cent;
  /** Auf die Warmwasserbereitung entfallender Anteil */
  warmwasserKosten: Cent;
  /** Verbleibende Kosten der Raumheizung */
  heizkosten: Cent;
  /** Grundkostenanteil der Heizung (nach Fläche) */
  heizungGrundkosten: Cent;
  /** Verbrauchskostenanteil der Heizung */
  heizungVerbrauchskosten: Cent;
  warmwasserGrundkosten: Cent;
  warmwasserVerbrauchskosten: Cent;
  warmwasserAnteil: WarmwasserAnteil;
}

export function teileHeizkostenAuf(
  gesamt: Cent,
  e: HeizkostenEinstellungen,
): HeizkostenAufteilung {
  const warmwasserAnteil = ermittleWarmwasserAnteil(e);
  const warmwasserKosten = anteilVonBetrag(gesamt, warmwasserAnteil.anteil);
  const heizkosten = gesamt - warmwasserKosten;

  const heizungVerbrauchskosten = anteilVonBetrag(heizkosten, e.verbrauchsanteilHeizung / 100);
  const warmwasserVerbrauchskosten = anteilVonBetrag(
    warmwasserKosten,
    e.verbrauchsanteilWarmwasser / 100,
  );

  return {
    gesamt,
    warmwasserKosten,
    heizkosten,
    heizungVerbrauchskosten,
    heizungGrundkosten: heizkosten - heizungVerbrauchskosten,
    warmwasserVerbrauchskosten,
    warmwasserGrundkosten: warmwasserKosten - warmwasserVerbrauchskosten,
    warmwasserAnteil,
  };
}

/** Standardwerte für einen neuen Abrechnungszeitraum. */
export function standardHeizkosten(abrechnungszeitraumId: string): HeizkostenEinstellungen {
  return {
    abrechnungszeitraumId,
    aktiv: true,
    verbrauchsanteilHeizung: 70,
    verbrauchsanteilWarmwasser: 70,
    warmwasserErmittlung: 'FORMEL_9_2',
    warmwasserTemperaturC: 60,
    verbrauchsabhaengigAbgerechnet: true,
    verbrauchsinformationErteilt: true,
  };
}
