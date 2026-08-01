import type { AppState, Kostenposition, Verbrauch } from '../domain/types';

/**
 * Beispielobjekt mit vier Wohnungen, einem unterjährigen Mieterwechsel,
 * einem Monat Leerstand, einer verbundenen Heiz-/Warmwasseranlage sowie
 * umlagefähigen und nicht umlagefähigen Kosten.
 */

const Z = 'z-2024';
const O = 'o-musterhaus';

const kosten = (
  id: string,
  katalogId: string,
  bezeichnung: string,
  betrag: number,
  verteilerschluessel: Kostenposition['verteilerschluessel'],
  extra: Partial<Kostenposition> = {},
): Kostenposition => ({
  id,
  abrechnungszeitraumId: Z,
  katalogId,
  bezeichnung,
  betrag,
  verteilerschluessel,
  ...extra,
});

const verbrauch = (
  id: string,
  mietverhaeltnisId: string,
  art: Verbrauch['art'],
  wert: number,
  einheit: Verbrauch['einheit'],
): Verbrauch => ({
  id,
  abrechnungszeitraumId: Z,
  mietverhaeltnisId,
  art,
  verbrauch: wert,
  einheit,
});

export function demoZustand(): AppState {
  return {
    version: 1,
    objekt: {
      id: O,
      bezeichnung: 'Mehrfamilienhaus Musterstraße 12',
      strasse: 'Musterstraße 12',
      plz: '30159',
      ort: 'Hannover',
      baujahr: 1976,
      leerstandPersonenFiktiv: 1,
      vermieter: {
        name: 'Erika Mustermann',
        strasse: 'Lindenallee 7',
        plz: '30161',
        ort: 'Hannover',
        telefon: '0511 1234567',
        email: 'verwaltung@example.org',
        iban: 'DE02500105170137075030',
        bic: 'INGDDEFFXXX',
        kreditinstitut: 'Beispielbank',
        kontoinhaber: 'Erika Mustermann',
      },
    },

    einheiten: [
      { id: 'e1', objektId: O, bezeichnung: 'Whg. 1 – EG links', wohnflaecheQm: 62.5, lage: 'Erdgeschoss links', zimmer: 2 },
      { id: 'e2', objektId: O, bezeichnung: 'Whg. 2 – EG rechts', wohnflaecheQm: 48, lage: 'Erdgeschoss rechts', zimmer: 2 },
      { id: 'e3', objektId: O, bezeichnung: 'Whg. 3 – 1. OG', wohnflaecheQm: 78.2, lage: '1. Obergeschoss', zimmer: 3 },
      { id: 'e4', objektId: O, bezeichnung: 'Whg. 4 – Dachgeschoss', wohnflaecheQm: 95.3, lage: 'Dachgeschoss', zimmer: 4 },
    ],

    mietverhaeltnisse: [
      {
        id: 'mv1',
        einheitId: 'e1',
        mieter: ['Anna Berger', 'Jonas Berger'],
        beginn: '2019-03-01',
        personenzahlen: [{ von: '2019-03-01', bis: '9999-12-31', anzahl: 2 }],
        vorauszahlungBetriebskostenMonatlich: 9500,
        vorauszahlungHeizkostenMonatlich: 7500,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
      },
      {
        id: 'mv2a',
        einheitId: 'e2',
        mieter: ['Familie Özdemir'],
        beginn: '2018-09-01',
        ende: '2024-06-30',
        zustellanschrift: {
          name: 'Familie Özdemir',
          strasse: 'Neue Straße 44',
          plz: '30167',
          ort: 'Hannover',
        },
        personenzahlen: [{ von: '2018-09-01', bis: '2024-06-30', anzahl: 3 }],
        vorauszahlungBetriebskostenMonatlich: 8000,
        vorauszahlungHeizkostenMonatlich: 6000,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
        anmerkung: 'Auszug zum 30.06.2024; Wohnung stand im Juli 2024 leer.',
      },
      {
        id: 'mv2b',
        einheitId: 'e2',
        mieter: ['Lukas Feldmann'],
        beginn: '2024-08-01',
        personenzahlen: [{ von: '2024-08-01', bis: '9999-12-31', anzahl: 1 }],
        vorauszahlungBetriebskostenMonatlich: 8500,
        vorauszahlungHeizkostenMonatlich: 6500,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
      },
      {
        id: 'mv3',
        einheitId: 'e3',
        mieter: ['Sabine Wagner', 'Thomas Wagner'],
        beginn: '2015-07-01',
        personenzahlen: [
          { von: '2015-07-01', bis: '2024-04-30', anzahl: 3 },
          { von: '2024-05-01', bis: '9999-12-31', anzahl: 4 },
        ],
        vorauszahlungBetriebskostenMonatlich: 12000,
        vorauszahlungHeizkostenMonatlich: 9500,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
        anmerkung: 'Geburt eines Kindes im Mai 2024 – Personenzahl ab 01.05.2024 vier.',
      },
      {
        id: 'mv4',
        einheitId: 'e4',
        mieter: ['Dr. Martin Krüger'],
        beginn: '2021-10-01',
        personenzahlen: [{ von: '2021-10-01', bis: '9999-12-31', anzahl: 1 }],
        vorauszahlungBetriebskostenMonatlich: 14000,
        vorauszahlungHeizkostenMonatlich: 11000,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
      },
    ],

    abrechnungszeitraeume: [
      {
        id: Z,
        objektId: O,
        bezeichnung: 'Betriebskostenabrechnung 2024',
        von: '2024-01-01',
        bis: '2024-12-31',
        zugangDatum: '2025-03-31',
      },
    ],

    kostenpositionen: [
      // --- umlagefähige Betriebskosten ---------------------------------------
      kosten('k1', 'BETRKV_2_1', 'Grundsteuer', 184200, 'WOHNFLAECHE', {
        belegnummer: 'GS-2024',
        belegdatum: '2024-02-15',
      }),
      kosten('k2', 'BETRKV_2_2', 'Wasserversorgung (Frischwasser)', 198050, 'VERBRAUCH', {
        verbrauchsart: 'KALTWASSER',
        belegnummer: 'SW-4711',
      }),
      kosten('k3', 'BETRKV_2_3', 'Entwässerung (Schmutz- und Niederschlagswasser)', 142000, 'VERBRAUCH', {
        verbrauchsart: 'KALTWASSER',
        belegnummer: 'SW-4712',
      }),
      kosten('k4', 'BETRKV_2_6', 'Erdgas (verbundene Heiz-/Warmwasseranlage)', 685000, 'HEIZKOSTENV', {
        belegnummer: 'GAS-2024',
      }),
      kosten('k5', 'BETRKV_2_4A', 'Betriebsstrom Heizungsanlage', 21000, 'HEIZKOSTENV'),
      kosten('k6', 'BETRKV_2_4A', 'Wartung Heizungsanlage', 48000, 'HEIZKOSTENV', {
        arbeitskostenAnteil: 33600,
      }),
      kosten('k7', 'BETRKV_2_4A', 'Messdienst / Verbrauchserfassung', 39000, 'HEIZKOSTENV'),
      kosten('k8', 'BETRKV_2_8', 'Straßenreinigung und Müllabfuhr', 126000, 'PERSONENZAHL', {
        belegnummer: 'AHA-2024',
      }),
      kosten('k9', 'BETRKV_2_9', 'Treppenhaus- und Gebäudereinigung', 168000, 'WOHNFLAECHE', {
        arbeitskostenAnteil: 168000,
      }),
      kosten('k10', 'BETRKV_2_10', 'Gartenpflege', 96000, 'WOHNFLAECHE', {
        arbeitskostenAnteil: 84000,
      }),
      kosten('k11', 'BETRKV_2_11', 'Allgemeinstrom / Beleuchtung', 38460, 'WOHNFLAECHE'),
      kosten('k12', 'BETRKV_2_12', 'Schornsteinreinigung', 9600, 'WOHNFLAECHE', {
        arbeitskostenAnteil: 9600,
      }),
      kosten('k13', 'BETRKV_2_13', 'Gebäude- und Haftpflichtversicherung', 124580, 'WOHNFLAECHE'),
      kosten('k14', 'BETRKV_2_14', 'Hauswart', 240000, 'WOHNFLAECHE', {
        nichtUmlagefaehigerAnteil: 60000,
        begruendungVorwegabzug:
          '25 % der Tätigkeit entfallen laut Hauswartvertrag auf Instandhaltung, Kleinreparaturen und Verwaltung.',
        arbeitskostenAnteil: 180000,
      }),
      kosten('k15', 'BETRKV_2_15C', 'Glasfaserbereitstellungsentgelt', 24000, 'WOHNEINHEIT', {
        anmerkung: '60,00 € je Wohnung und Jahr, Inbetriebnahme 03/2023.',
      }),
      kosten('k16', 'BETRKV_2_17', 'Wartung der Rauchwarnmelder', 9600, 'WOHNEINHEIT', {
        anmerkung: 'Im Mietvertrag unter "sonstige Betriebskosten" ausdrücklich benannt.',
        arbeitskostenAnteil: 9600,
      }),

      // --- nicht umlagefähige Kosten -----------------------------------------
      kosten('n1', 'NU_VERWALTUNG', 'Hausverwaltung (12 × 120,00 €)', 144000, 'WOHNFLAECHE'),
      kosten('n2', 'NU_REPARATUR', 'Austausch Heizungsumwälzpumpe', 68500, 'WOHNFLAECHE'),
      kosten('n3', 'NU_RUECKLAGE', 'Zuführung zur Instandhaltungsrücklage', 240000, 'WOHNFLAECHE'),
      kosten('n4', 'NU_BANK', 'Kontoführungsgebühren Mietkonto', 7200, 'WOHNFLAECHE'),
      kosten('n5', 'NU_RECHT', 'Anwaltskosten Mahnverfahren', 35700, 'WOHNFLAECHE'),
    ],

    verbraeuche: [
      // Kaltwasser (m³)
      verbrauch('vw1', 'mv1', 'KALTWASSER', 78, 'm3'),
      verbrauch('vw2', 'mv2a', 'KALTWASSER', 62, 'm3'),
      verbrauch('vw3', 'mv2b', 'KALTWASSER', 22, 'm3'),
      verbrauch('vw4', 'mv3', 'KALTWASSER', 148, 'm3'),
      verbrauch('vw5', 'mv4', 'KALTWASSER', 41, 'm3'),
      // Warmwasser (m³)
      verbrauch('ww1', 'mv1', 'WARMWASSER', 32, 'm3'),
      verbrauch('ww2', 'mv2a', 'WARMWASSER', 26, 'm3'),
      verbrauch('ww3', 'mv2b', 'WARMWASSER', 9, 'm3'),
      verbrauch('ww4', 'mv3', 'WARMWASSER', 61, 'm3'),
      verbrauch('ww5', 'mv4', 'WARMWASSER', 17, 'm3'),
      // Heizung (Einheiten der Heizkostenverteiler)
      verbrauch('hz1', 'mv1', 'HEIZUNG', 812, 'Einheiten'),
      verbrauch('hz2', 'mv2a', 'HEIZUNG', 402, 'Einheiten'),
      verbrauch('hz3', 'mv2b', 'HEIZUNG', 265, 'Einheiten'),
      verbrauch('hz4', 'mv3', 'HEIZUNG', 1105, 'Einheiten'),
      verbrauch('hz5', 'mv4', 'HEIZUNG', 1340, 'Einheiten'),
    ],

    leerstandsverbraeuche: [
      { id: 'lv1', abrechnungszeitraumId: Z, einheitId: 'e2', art: 'KALTWASSER', verbrauch: 2, einheit: 'm3' },
      { id: 'lv2', abrechnungszeitraumId: Z, einheitId: 'e2', art: 'WARMWASSER', verbrauch: 1, einheit: 'm3' },
      { id: 'lv3', abrechnungszeitraumId: Z, einheitId: 'e2', art: 'HEIZUNG', verbrauch: 46, einheit: 'Einheiten' },
    ],

    heizkosten: [
      {
        abrechnungszeitraumId: Z,
        aktiv: true,
        verbrauchsanteilHeizung: 70,
        verbrauchsanteilWarmwasser: 70,
        warmwasserErmittlung: 'FORMEL_9_2',
        warmwasserVolumenM3: 146,
        warmwasserTemperaturC: 60,
        gesamtwaermemengeKwh: 96000,
        verbrauchsabhaengigAbgerechnet: true,
        verbrauchsinformationErteilt: true,
      },
    ],

    aktiverZeitraumId: Z,
  };
}
