/**
 * Datenmodell, Vorbelegungen und Demodaten.
 */

import { SCHLUESSEL } from './katalog.js';

export const DATEN_VERSION = 1;

export function id(praefix = 'x') {
  return `${praefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function leererDatenbestand() {
  return {
    version: DATEN_VERSION,
    vermieter: { name: '', strasse: '', plz: '', ort: '', telefon: '', email: '', iban: '', bank: '', steuernummer: '' },
    objekt: {
      bezeichnung: '',
      strasse: '',
      plz: '',
      ort: '',
      wohnflaecheGesamt: 0,
      gebaeudetyp: 'wohn',
      leerstandPersonen: 1,
      verbrauchsdifferenz: 'verbrauch',
    },
    einheiten: [],
    mietverhaeltnisse: [],
    abrechnungen: [],
  };
}

export function neueEinheit(nr = 1) {
  return { id: id('e'), bezeichnung: `Wohnung ${nr}`, lage: '', wohnflaeche: 0, mea: 0, notiz: '' };
}

export function neuesMietverhaeltnis(einheitId, jahr) {
  return {
    id: id('m'),
    einheitId,
    mieterName: '',
    mieterAnschrift: '',
    von: `${jahr}-01-01`,
    bis: '',
    personen: 1,
    vzModus: 'monatlich',
    vzBetriebskostenMonat: 0,
    vzHeizkostenMonat: 0,
    vzGesamtBetriebskosten: 0,
    vzGesamtHeizkosten: 0,
  };
}

export function neuePosition(kostenartId = 'grundsteuer', schluessel = SCHLUESSEL.FLAECHE) {
  return {
    id: id('p'),
    kostenartId,
    bezeichnung: '',
    betragBrutto: 0,
    abzugBetrag: 0,
    abzugGrund: '',
    schluessel,
    direktEinheitId: '',
    verbrauchsart: 'kaltwasser',
    umlagefaehig: true,
    zeitraumVon: '',
    zeitraumBis: '',
    lohnanteilHaushaltsnah: 0,
    lohnanteilHandwerker: 0,
    lieferant: '',
    beleg: '',
    notiz: '',
    imMietvertragVereinbart: false,
  };
}

export function neueAbrechnung(jahr) {
  return {
    id: id('a'),
    jahr,
    von: `${jahr}-01-01`,
    bis: `${jahr}-12-31`,
    erstelltAm: '',
    zugestelltAm: '',
    zahlungsfristTage: 30,
    positionen: [],
    verbraeuche: [],
    hauptzaehler: { kaltwasser: 0, warmwasser: 0, heizung: 0 },
    heizung: neueHeizung(),
  };
}

export function neueHeizung() {
  return {
    aktiv: false,
    verbunden: true,
    brennstoff: 'erdgas',
    brennstoffmenge: 0,
    gesamtwaermeKwh: 0,
    kosten: { brennstoff: 0, betriebsstrom: 0, wartung: 0, messdienst: 0, schornsteinfeger: 0, sonstiges: 0 },
    kostenWarmwasserSeparat: 0,
    warmwasser: { modus: 'formel', volumen: 0, temperatur: 60, warmwasserKwh: 0, prozentsatz: 0.18 },
    anteilVerbrauchHeizung: 0.7,
    anteilVerbrauchWarmwasser: 0.7,
    verbrauchserfassung: true,
    co2: { kostenCent: 0, emissionKg: 0, gebaeudetyp: 'wohn', ausnahme: false },
  };
}

/** Stellt sicher, dass geladene Daten alle Felder aktueller Versionen besitzen. */
export function migriere(daten) {
  const basis = leererDatenbestand();
  const d = { ...basis, ...daten };
  d.vermieter = { ...basis.vermieter, ...(daten.vermieter || {}) };
  d.objekt = { ...basis.objekt, ...(daten.objekt || {}) };
  d.einheiten = (daten.einheiten || []).map((e) => ({ ...neueEinheit(), ...e }));
  d.mietverhaeltnisse = (daten.mietverhaeltnisse || []).map((m) => ({ ...neuesMietverhaeltnis('', 2024), ...m }));
  d.abrechnungen = (daten.abrechnungen || []).map((a) => {
    const vorlage = neueAbrechnung(a.jahr || 2024);
    const heizung = { ...vorlage.heizung, ...(a.heizung || {}) };
    heizung.kosten = { ...vorlage.heizung.kosten, ...(a.heizung?.kosten || {}) };
    heizung.warmwasser = { ...vorlage.heizung.warmwasser, ...(a.heizung?.warmwasser || {}) };
    heizung.co2 = { ...vorlage.heizung.co2, ...(a.heizung?.co2 || {}) };
    return {
      ...vorlage,
      ...a,
      heizung,
      hauptzaehler: { ...vorlage.hauptzaehler, ...(a.hauptzaehler || {}) },
      positionen: (a.positionen || []).map((p) => ({ ...neuePosition(), ...p })),
      verbraeuche: a.verbraeuche || [],
    };
  });
  d.version = DATEN_VERSION;
  return d;
}

/** Vollständiger Beispieldatensatz – dient als Demo und als Testfixture. */
export function demodaten() {
  const e1 = { id: 'e1', bezeichnung: 'Wohnung 1 EG links', lage: 'Erdgeschoss links', wohnflaeche: 62.5, mea: 250, notiz: '' };
  const e2 = { id: 'e2', bezeichnung: 'Wohnung 2 EG rechts', lage: 'Erdgeschoss rechts', wohnflaeche: 58.0, mea: 230, notiz: '' };
  const e3 = { id: 'e3', bezeichnung: 'Wohnung 3 OG links', lage: '1. OG links', wohnflaeche: 74.5, mea: 300, notiz: '' };
  const e4 = { id: 'e4', bezeichnung: 'Wohnung 4 OG rechts', lage: '1. OG rechts', wohnflaeche: 55.0, mea: 220, notiz: '' };

  return {
    version: DATEN_VERSION,
    vermieter: {
      name: 'Kim Spachmann',
      strasse: 'Lindenallee 4',
      plz: '70173',
      ort: 'Stuttgart',
      telefon: '0711 1234567',
      email: 'verwaltung@example.de',
      iban: 'DE02 1203 0000 0000 2020 51',
      bank: 'Beispielbank Stuttgart',
      steuernummer: '',
    },
    objekt: {
      bezeichnung: 'Mehrfamilienhaus Gartenstraße 12',
      strasse: 'Gartenstraße 12',
      plz: '70173',
      ort: 'Stuttgart',
      wohnflaecheGesamt: 250.0,
      gebaeudetyp: 'wohn',
      leerstandPersonen: 1,
      verbrauchsdifferenz: 'flaeche',
    },
    einheiten: [e1, e2, e3, e4],
    mietverhaeltnisse: [
      {
        id: 'm1', einheitId: 'e1', mieterName: 'Familie Aydin', mieterAnschrift: 'Gartenstraße 12, 70173 Stuttgart',
        von: '2020-05-01', bis: '', personen: 3, vzModus: 'monatlich', vzBetriebskostenMonat: 20000, vzHeizkostenMonat: 14500,
        vzGesamtBetriebskosten: 0, vzGesamtHeizkosten: 0,
      },
      {
        id: 'm2', einheitId: 'e2', mieterName: 'Herr Bernhardt', mieterAnschrift: 'Gartenstraße 12, 70173 Stuttgart',
        von: '2018-09-01', bis: '', personen: 1, vzModus: 'monatlich', vzBetriebskostenMonat: 15000, vzHeizkostenMonat: 12000,
        vzGesamtBetriebskosten: 0, vzGesamtHeizkosten: 0,
      },
      {
        id: 'm3', einheitId: 'e3', mieterName: 'Frau Costa', mieterAnschrift: 'Gartenstraße 12, 70173 Stuttgart',
        von: '2015-01-01', bis: '2024-06-30', personen: 2, vzModus: 'monatlich', vzBetriebskostenMonat: 23000, vzHeizkostenMonat: 17500,
        vzGesamtBetriebskosten: 0, vzGesamtHeizkosten: 0,
      },
      {
        id: 'm4', einheitId: 'e3', mieterName: 'Herr und Frau Delgado', mieterAnschrift: 'Gartenstraße 12, 70173 Stuttgart',
        von: '2024-08-01', bis: '', personen: 2, vzModus: 'monatlich', vzBetriebskostenMonat: 24000, vzHeizkostenMonat: 18000,
        vzGesamtBetriebskosten: 0, vzGesamtHeizkosten: 0,
      },
      {
        id: 'm5', einheitId: 'e4', mieterName: 'Frau Eberhardt', mieterAnschrift: 'Gartenstraße 12, 70173 Stuttgart',
        von: '2022-03-01', bis: '', personen: 2, vzModus: 'monatlich', vzBetriebskostenMonat: 16500, vzHeizkostenMonat: 13000,
        vzGesamtBetriebskosten: 0, vzGesamtHeizkosten: 0,
      },
    ],
    abrechnungen: [
      {
        id: 'a2024',
        jahr: 2024,
        von: '2024-01-01',
        bis: '2024-12-31',
        erstelltAm: '2025-03-15',
        zugestelltAm: '2025-03-20',
        zahlungsfristTage: 30,
        hauptzaehler: { kaltwasser: 400, warmwasser: 0, heizung: 0 },
        positionen: [
          { ...pos('grundsteuer', SCHLUESSEL.FLAECHE, 142800), lieferant: 'Stadtkasse Stuttgart', beleg: 'Bescheid 2024' },
          { ...pos('wasser', SCHLUESSEL.VERBRAUCH_WASSER, 88000), verbrauchsart: 'kaltwasser', lieferant: 'Stadtwerke' },
          { ...pos('entwaesserung', SCHLUESSEL.VERBRAUCH_WASSER, 112000), verbrauchsart: 'kaltwasser', lieferant: 'Stadtentwässerung' },
          { ...pos('strassenreinigung_muell', SCHLUESSEL.PERSONEN, 72000), lieferant: 'AWS Stuttgart' },
          { ...pos('gebaeudereinigung', SCHLUESSEL.FLAECHE, 132000), lohnanteilHaushaltsnah: 115000, lieferant: 'Reinigung Meier GmbH' },
          { ...pos('gartenpflege', SCHLUESSEL.FLAECHE, 66000), lohnanteilHaushaltsnah: 54000, lieferant: 'Gartenbau Klein' },
          { ...pos('beleuchtung', SCHLUESSEL.FLAECHE, 42300), lieferant: 'EnBW' },
          { ...pos('versicherung', SCHLUESSEL.FLAECHE, 98000), lieferant: 'Allianz', notiz: 'Gebäude- und Haftpflichtversicherung' },
          {
            ...pos('hauswart', SCHLUESSEL.FLAECHE, 144000),
            abzugBetrag: 28800,
            abzugGrund: '20 % Instandhaltungs- und Verwaltungsanteil nach § 2 Nr. 14 BetrKV herausgerechnet',
            lohnanteilHaushaltsnah: 99000,
            lieferant: 'Hausmeisterservice Ruf',
          },
          {
            ...pos('sonstige', SCHLUESSEL.FLAECHE, 38000),
            bezeichnung: 'Wartung Rauchwarnmelder',
            imMietvertragVereinbart: true,
            lohnanteilHandwerker: 26000,
            lieferant: 'Techem',
          },
          { ...pos('schornsteinreinigung', SCHLUESSEL.FLAECHE, 21400), lieferant: 'Bezirksschornsteinfeger' },
          {
            ...pos('verwaltung', SCHLUESSEL.FLAECHE, 144000),
            umlagefaehig: false,
            bezeichnung: 'Hausverwaltung 2024',
            lieferant: 'Immo-Verwaltung GmbH',
          },
          {
            ...pos('instandhaltung', SCHLUESSEL.FLAECHE, 452000),
            umlagefaehig: false,
            bezeichnung: 'Reparatur Steigleitung + Malerarbeiten Treppenhaus',
            lieferant: 'Sanitär Wolf / Maler Braun',
          },
          {
            ...pos('sonstige_nicht', SCHLUESSEL.EINHEITEN, 64800),
            umlagefaehig: false,
            bezeichnung: 'Kabel-TV Sammelvertrag (ab 01.07.2024 nicht mehr umlagefähig)',
            lieferant: 'Vodafone',
          },
        ],
        verbraeuche: [
          { id: 'v1', einheitId: 'e1', mietverhaeltnisId: null, art: 'kaltwasser', wert: 118 },
          { id: 'v2', einheitId: 'e2', mietverhaeltnisId: null, art: 'kaltwasser', wert: 52 },
          { id: 'v3', einheitId: 'e3', mietverhaeltnisId: 'm3', art: 'kaltwasser', wert: 68 },
          { id: 'v4', einheitId: 'e3', mietverhaeltnisId: 'm4', art: 'kaltwasser', wert: 44 },
          { id: 'v5', einheitId: 'e4', mietverhaeltnisId: null, art: 'kaltwasser', wert: 82 },

          { id: 'v6', einheitId: 'e1', mietverhaeltnisId: null, art: 'heizung', wert: 1420 },
          { id: 'v7', einheitId: 'e2', mietverhaeltnisId: null, art: 'heizung', wert: 1180 },
          { id: 'v8', einheitId: 'e3', mietverhaeltnisId: 'm3', art: 'heizung', wert: 940 },
          { id: 'v9', einheitId: 'e3', mietverhaeltnisId: 'm4', art: 'heizung', wert: 760 },
          { id: 'v10', einheitId: 'e4', mietverhaeltnisId: null, art: 'heizung', wert: 1090 },

          { id: 'v11', einheitId: 'e1', mietverhaeltnisId: null, art: 'warmwasser', wert: 34 },
          { id: 'v12', einheitId: 'e2', mietverhaeltnisId: null, art: 'warmwasser', wert: 12 },
          { id: 'v13', einheitId: 'e3', mietverhaeltnisId: 'm3', art: 'warmwasser', wert: 13 },
          { id: 'v14', einheitId: 'e3', mietverhaeltnisId: 'm4', art: 'warmwasser', wert: 11 },
          { id: 'v15', einheitId: 'e4', mietverhaeltnisId: null, art: 'warmwasser', wert: 22 },
        ],
        heizung: {
          aktiv: true,
          verbunden: true,
          brennstoff: 'erdgas',
          // 4.200 m³ Erdgas ≈ 42.000 kWh; davon rund 11.500 kWh für Warmwasser
          brennstoffmenge: 4200,
          gesamtwaermeKwh: 0,
          kosten: { brennstoff: 462000, betriebsstrom: 32000, wartung: 62000, messdienst: 74500, schornsteinfeger: 0, sonstiges: 0 },
          kostenWarmwasserSeparat: 0,
          warmwasser: { modus: 'formel', volumen: 92, temperatur: 60, warmwasserKwh: 0, prozentsatz: 0.18 },
          anteilVerbrauchHeizung: 0.7,
          anteilVerbrauchWarmwasser: 0.7,
          verbrauchserfassung: true,
          // 42.000 kWh × 0,201 kg/kWh ≈ 8.442 kg CO₂; bei 45 €/t rund 380 €
          co2: { kostenCent: 38000, emissionKg: 8442, gebaeudetyp: 'wohn', ausnahme: false },
        },
      },
    ],
  };
}

function pos(kostenartId, schluessel, betragBrutto) {
  return { ...neuePosition(kostenartId, schluessel), id: id('p'), betragBrutto };
}
