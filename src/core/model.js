/**
 * Datenmodell, Vorbelegungen und Demodaten.
 *
 * Aufbau:
 *   Vermieter  →  Objekte  →  Einheiten  →  Mietverhältnisse
 *                     ↳  Abrechnungszeiträume (Kosten, Verbräuche, Heizung)
 *
 * Ein Vermieter kann mehrere Objekte halten – etwa zwei privat vermietete
 * Immobilien und daneben eine GbR mit weiteren Objekten. Abgerechnet wird
 * immer je Objekt; die Rechenkerne arbeiten deshalb auf dem Ausschnitt, den
 * `bestandFuerObjekt()` liefert.
 */

import { SCHLUESSEL } from './katalog.js';

export const DATEN_VERSION = 2;

export function id(praefix = 'x') {
  return `${praefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Rechtsformen des Vermieters. Bestimmt, ob eine Vertretung anzugeben ist. */
export const RECHTSFORMEN = [
  { id: 'privat', bezeichnung: 'Privatperson', vertretungNoetig: false },
  { id: 'ehepaar', bezeichnung: 'Eheleute / Gemeinschaft', vertretungNoetig: false },
  { id: 'gbr', bezeichnung: 'GbR', vertretungNoetig: true },
  { id: 'weg', bezeichnung: 'Wohnungseigentümergemeinschaft', vertretungNoetig: true },
  { id: 'gmbh', bezeichnung: 'GmbH / UG', vertretungNoetig: true },
  { id: 'sonstige', bezeichnung: 'Sonstige', vertretungNoetig: true },
];

export function rechtsform(id) {
  return RECHTSFORMEN.find((r) => r.id === id) || RECHTSFORMEN[0];
}

export function leererDatenbestand() {
  return {
    version: DATEN_VERSION,
    vermieter: [],
    objekte: [],
    einheiten: [],
    mietverhaeltnisse: [],
    abrechnungen: [],
  };
}

export function neuerVermieter(name = '') {
  return {
    id: id('v'),
    name,
    rechtsform: 'privat',
    vertretenDurch: '',
    strasse: '',
    plz: '',
    ort: '',
    telefon: '',
    email: '',
    iban: '',
    bank: '',
    steuernummer: '',
  };
}

export function neuesObjekt(vermieterId, bezeichnung = '') {
  return {
    id: id('o'),
    vermieterId,
    bezeichnung,
    strasse: '',
    plz: '',
    ort: '',
    wohnflaecheGesamt: 0,
    gebaeudetyp: 'wohn',
    leerstandPersonen: 1,
    verbrauchsdifferenz: 'verbrauch',
    notiz: '',
  };
}

export function neueEinheit(objektId, nr = 1) {
  return { id: id('e'), objektId, bezeichnung: `Wohnung ${nr}`, lage: '', wohnflaeche: 0, mea: 0, notiz: '' };
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

export function neueAbrechnung(objektId, jahr) {
  return {
    id: id('a'),
    objektId,
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
    erzeuger: [],
    erfassungsart: 'hkv',
    kosten: { betriebsstrom: 0, wartung: 0, messdienst: 0, schornsteinfeger: 0, sonstiges: 0 },
    kostenWarmwasserSeparat: 0,
    warmwasser: { modus: 'formel', volumen: 0, temperatur: 60, warmwasserKwh: 0, prozentsatz: 0.18 },
    anteilVerbrauchHeizung: 0.7,
    anteilVerbrauchWarmwasser: 0.7,
    verbrauchserfassung: true,
    co2: { gebaeudetyp: 'wohn', ausnahme: false },
  };
}

/**
 * Ein Wärmeerzeuger. Eine Hybridanlage – etwa Gas-Brennwertkessel und
 * Wärmepumpe – wird als mehrere Erzeuger erfasst, jeder mit eigener
 * Abrechnung des Versorgers und eigenem Wärmemengenzähler.
 */
export function neuerErzeuger(energietraeger = 'erdgas', bezeichnung = '') {
  return {
    id: id('we'),
    bezeichnung,
    energietraeger,
    menge: 0,
    arbeitszahl: energietraeger === 'waermepumpe' ? 3 : 0,
    zaehler: { nummer: '', standAnfang: 0, standEnde: 0 },
    waermemengeKwh: 0,
    kostenCent: 0,
    co2KostenCent: 0,
    co2EmissionKg: 0,
    lieferant: '',
  };
}

/* ------------------------------------------------------------------ Zugriff */

export function vermieterVon(daten, vermieterId) {
  return daten.vermieter.find((v) => v.id === vermieterId) || null;
}

export function objektVon(daten, objektId) {
  return daten.objekte.find((o) => o.id === objektId) || null;
}

export function einheitenVon(daten, objektId) {
  return daten.einheiten.filter((e) => e.objektId === objektId);
}

export function mietverhaeltnisseVon(daten, objektId) {
  const ids = new Set(einheitenVon(daten, objektId).map((e) => e.id));
  return daten.mietverhaeltnisse.filter((m) => ids.has(m.einheitId));
}

export function abrechnungenVon(daten, objektId) {
  return daten.abrechnungen.filter((a) => a.objektId === objektId).sort((a, b) => b.jahr - a.jahr);
}

export function objekteVon(daten, vermieterId) {
  return daten.objekte.filter((o) => o.vermieterId === vermieterId);
}

/**
 * Schneidet den Gesamtbestand auf ein Objekt zu.
 *
 * Das Ergebnis hat genau die Form, die Abrechnung, Prüfung und Dokument
 * erwarten – ein Vermieter, ein Objekt, dessen Einheiten und Mietverhältnisse.
 * Dadurch bleiben die Rechenkerne frei von Mehrobjektlogik.
 */
export function bestandFuerObjekt(daten, objektId) {
  const objekt = objektVon(daten, objektId);
  if (!objekt) return null;
  return {
    vermieter: vermieterVon(daten, objekt.vermieterId) || neuerVermieter(),
    objekt,
    einheiten: einheitenVon(daten, objektId),
    mietverhaeltnisse: mietverhaeltnisseVon(daten, objektId),
  };
}

/* ---------------------------------------------------------------- Migration */

/** Stellt sicher, dass geladene Daten der aktuellen Struktur entsprechen. */
export function migriere(daten) {
  const eingang = daten && typeof daten === 'object' ? daten : {};
  const d = leererDatenbestand();

  // Fassung 2 führt Vermieter und Objekte als Listen. Fassung 1 kannte je
  // genau einen Eintrag. Ein vollständig leerer Eingang bleibt leer, statt
  // einen namenlosen Vermieter zu erfinden.
  const istFassung2 = Array.isArray(eingang.vermieter) || Array.isArray(eingang.objekte);
  const hatInhalt = Boolean(
    eingang.objekt ||
      eingang.vermieter ||
      (eingang.einheiten || []).length ||
      (eingang.abrechnungen || []).length ||
      (eingang.mietverhaeltnisse || []).length
  );

  if (!istFassung2 && !hatInhalt) return d;

  if (!istFassung2) {
    const vermieter = { ...neuerVermieter(), ...(eingang.vermieter || {}) };
    const objekt = {
      ...neuesObjekt(vermieter.id),
      ...(eingang.objekt || {}),
      id: (eingang.objekt && eingang.objekt.id) || id('o'),
      vermieterId: vermieter.id,
    };
    d.vermieter = [vermieter];
    d.objekte = [objekt];
    d.einheiten = (eingang.einheiten || []).map((e) => ({ ...neueEinheit(objekt.id), ...e, objektId: objekt.id }));
    d.abrechnungen = (eingang.abrechnungen || []).map((a) => migriereAbrechnung(a, objekt.id));
  } else {
    d.vermieter = (eingang.vermieter || []).map((v) => ({ ...neuerVermieter(), ...v }));
    if (!d.vermieter.length) d.vermieter = [neuerVermieter()];

    d.objekte = (eingang.objekte || []).map((o) => ({
      ...neuesObjekt(d.vermieter[0].id),
      ...o,
      vermieterId: d.vermieter.some((v) => v.id === o.vermieterId) ? o.vermieterId : d.vermieter[0].id,
    }));

    const erstesObjekt = d.objekte[0]?.id || '';
    d.einheiten = (eingang.einheiten || []).map((e) => ({
      ...neueEinheit(erstesObjekt),
      ...e,
      objektId: d.objekte.some((o) => o.id === e.objektId) ? e.objektId : erstesObjekt,
    }));
    d.abrechnungen = (eingang.abrechnungen || []).map((a) =>
      migriereAbrechnung(a, d.objekte.some((o) => o.id === a.objektId) ? a.objektId : erstesObjekt)
    );
  }

  d.mietverhaeltnisse = (eingang.mietverhaeltnisse || []).map((m) => ({
    ...neuesMietverhaeltnis('', 2024),
    ...m,
  }));

  d.version = DATEN_VERSION;
  return d;
}

function migriereAbrechnung(a, objektId) {
  const vorlage = neueAbrechnung(objektId, a?.jahr || 2024);
  const heizung = { ...vorlage.heizung, ...(a?.heizung || {}) };
  heizung.kosten = { ...vorlage.heizung.kosten, ...(a?.heizung?.kosten || {}) };
  heizung.warmwasser = { ...vorlage.heizung.warmwasser, ...(a?.heizung?.warmwasser || {}) };
  heizung.co2 = { ...vorlage.heizung.co2, ...(a?.heizung?.co2 || {}) };
  heizung.erzeuger = migriereErzeuger(heizung, a?.heizung || {});
  // Diese Felder gingen im Erzeuger auf.
  delete heizung.brennstoff;
  delete heizung.brennstoffmenge;
  delete heizung.gesamtwaermeKwh;
  delete heizung.kosten.brennstoff;
  delete heizung.co2.kostenCent;
  delete heizung.co2.emissionKg;
  return {
    ...vorlage,
    ...a,
    objektId,
    heizung,
    hauptzaehler: { ...vorlage.hauptzaehler, ...(a?.hauptzaehler || {}) },
    positionen: (a?.positionen || []).map((p) => ({ ...neuePosition(), ...p })),
    verbraeuche: a?.verbraeuche || [],
  };
}

/**
 * Hebt eine Heizung auf die Erzeugerliste.
 *
 * Ältere Sicherungen kannten genau einen Energieträger samt Menge, Kosten und
 * CO2-Angaben. Daraus wird ein einzelner Wärmeerzeuger; die Werte bleiben
 * unverändert, die Abrechnung rechnet danach identisch weiter.
 */
function migriereErzeuger(heizung, alt) {
  const liste = (heizung.erzeuger || []).map((e) => ({
    ...neuerErzeuger(e.energietraeger || 'erdgas'),
    ...e,
    zaehler: { ...neuerErzeuger().zaehler, ...(e.zaehler || {}) },
  }));
  if (liste.length) return liste;

  const menge = alt.brennstoffmenge || 0;
  const kosten = alt.kosten?.brennstoff || 0;
  const waerme = alt.gesamtwaermeKwh || 0;
  const co2Kosten = alt.co2?.kostenCent || 0;
  const co2Menge = alt.co2?.emissionKg || 0;
  if (!menge && !kosten && !waerme && !co2Kosten) return [];

  return [
    {
      ...neuerErzeuger(alt.brennstoff || 'erdgas'),
      // Die alte Fassung kannte keine Arbeitszahl; 1 hält das Ergebnis stabil.
      arbeitszahl: 1,
      menge,
      waermemengeKwh: waerme,
      kostenCent: kosten,
      co2KostenCent: co2Kosten,
      co2EmissionKg: co2Menge,
    },
  ];
}

/* ---------------------------------------------------------------- Demodaten */

/**
 * Beispielbestand mit zwei Vermietern und vier Objekten:
 * zwei privat gehaltene Immobilien und eine GbR mit zwei weiteren Objekten.
 */
export function demodaten() {
  const daten = leererDatenbestand();

  const privat = {
    ...neuerVermieter('Kim Spachmann'),
    id: 'v1',
    rechtsform: 'privat',
    strasse: 'Lindenallee 4',
    plz: '70173',
    ort: 'Stuttgart',
    telefon: '0711 1234567',
    email: 'verwaltung@example.de',
    iban: 'DE02 1203 0000 0000 2020 51',
    bank: 'Beispielbank Stuttgart',
  };

  const gbr = {
    ...neuerVermieter('Spachmann & Partner GbR'),
    id: 'v2',
    rechtsform: 'gbr',
    vertretenDurch: 'Kim Spachmann und Jana Spachmann',
    strasse: 'Lindenallee 4',
    plz: '70173',
    ort: 'Stuttgart',
    telefon: '0711 1234567',
    email: 'gbr@example.de',
    iban: 'DE02 1203 0000 0000 3030 62',
    bank: 'Beispielbank Stuttgart',
    steuernummer: '99012/34567',
  };

  daten.vermieter = [privat, gbr];
  daten.objekte = [objekt1(), objekt2(), objekt3(), objekt4()];
  daten.einheiten = [...einheiten1(), ...einheiten2(), ...einheiten3(), ...einheiten4()];
  daten.mietverhaeltnisse = [...mieter1(), ...mieter2(), ...mieter3(), ...mieter4()];
  daten.abrechnungen = [abrechnung1(), abrechnung2(), abrechnung3(), abrechnung4()];
  return daten;
}

/* --- Objekt 1: privat, Mehrfamilienhaus mit Zentralheizung und Mieterwechsel --- */

function objekt1() {
  return {
    ...neuesObjekt('v1'),
    id: 'o1',
    bezeichnung: 'Mehrfamilienhaus Gartenstraße 12',
    strasse: 'Gartenstraße 12',
    plz: '70173',
    ort: 'Stuttgart',
    wohnflaecheGesamt: 250,
    gebaeudetyp: 'wohn',
    leerstandPersonen: 1,
    verbrauchsdifferenz: 'flaeche',
  };
}

function einheiten1() {
  return [
    { ...neueEinheit('o1'), id: 'e1', bezeichnung: 'Wohnung 1 EG links', lage: 'Erdgeschoss links', wohnflaeche: 62.5, mea: 250 },
    { ...neueEinheit('o1'), id: 'e2', bezeichnung: 'Wohnung 2 EG rechts', lage: 'Erdgeschoss rechts', wohnflaeche: 58.0, mea: 230 },
    { ...neueEinheit('o1'), id: 'e3', bezeichnung: 'Wohnung 3 OG links', lage: '1. OG links', wohnflaeche: 74.5, mea: 300 },
    { ...neueEinheit('o1'), id: 'e4', bezeichnung: 'Wohnung 4 OG rechts', lage: '1. OG rechts', wohnflaeche: 55.0, mea: 220 },
  ];
}

function mieter1() {
  const anschrift = 'Gartenstraße 12, 70173 Stuttgart';
  return [
    mv('m1', 'e1', 'Familie Aydin', anschrift, '2020-05-01', '', 3, 20000, 14500),
    mv('m2', 'e2', 'Herr Bernhardt', anschrift, '2018-09-01', '', 1, 15000, 12000),
    mv('m3', 'e3', 'Frau Costa', anschrift, '2015-01-01', '2024-06-30', 2, 23000, 17500),
    mv('m4', 'e3', 'Herr und Frau Delgado', anschrift, '2024-08-01', '', 2, 24000, 18000),
    mv('m5', 'e4', 'Frau Eberhardt', anschrift, '2022-03-01', '', 2, 16500, 13000),
  ];
}

function abrechnung1() {
  return {
    ...neueAbrechnung('o1', 2024),
    id: 'a2024',
    erstelltAm: '2025-03-15',
    zugestelltAm: '2025-03-20',
    hauptzaehler: { kaltwasser: 400, warmwasser: 0, heizung: 0 },
    positionen: [
      { ...pos('p01', 'grundsteuer', SCHLUESSEL.FLAECHE, 142800), lieferant: 'Stadtkasse Stuttgart', beleg: 'Bescheid 2024' },
      { ...pos('p02', 'wasser', SCHLUESSEL.VERBRAUCH_WASSER, 88000), lieferant: 'Stadtwerke' },
      { ...pos('p03', 'entwaesserung', SCHLUESSEL.VERBRAUCH_WASSER, 112000), lieferant: 'Stadtentwässerung' },
      { ...pos('p04', 'strassenreinigung_muell', SCHLUESSEL.PERSONEN, 72000), lieferant: 'AWS Stuttgart' },
      { ...pos('p05', 'gebaeudereinigung', SCHLUESSEL.FLAECHE, 132000), lohnanteilHaushaltsnah: 115000, lieferant: 'Reinigung Meier GmbH' },
      { ...pos('p06', 'gartenpflege', SCHLUESSEL.FLAECHE, 66000), lohnanteilHaushaltsnah: 54000, lieferant: 'Gartenbau Klein' },
      { ...pos('p07', 'beleuchtung', SCHLUESSEL.FLAECHE, 42300), lieferant: 'EnBW' },
      { ...pos('p08', 'versicherung', SCHLUESSEL.FLAECHE, 98000), lieferant: 'Allianz', notiz: 'Gebäude- und Haftpflichtversicherung' },
      {
        ...pos('p09', 'hauswart', SCHLUESSEL.FLAECHE, 144000),
        abzugBetrag: 28800,
        abzugGrund: '20 % Instandhaltungs- und Verwaltungsanteil nach § 2 Nr. 14 BetrKV herausgerechnet',
        lohnanteilHaushaltsnah: 99000,
        lieferant: 'Hausmeisterservice Ruf',
      },
      {
        ...pos('p10', 'sonstige', SCHLUESSEL.FLAECHE, 38000),
        bezeichnung: 'Wartung Rauchwarnmelder',
        imMietvertragVereinbart: true,
        lohnanteilHandwerker: 26000,
        lieferant: 'Techem',
      },
      { ...pos('p11', 'schornsteinreinigung', SCHLUESSEL.FLAECHE, 21400), lieferant: 'Bezirksschornsteinfeger' },
      { ...pos('p12', 'verwaltung', SCHLUESSEL.FLAECHE, 144000), umlagefaehig: false, bezeichnung: 'Hausverwaltung 2024', lieferant: 'Immo-Verwaltung GmbH' },
      {
        ...pos('p13', 'instandhaltung', SCHLUESSEL.FLAECHE, 452000),
        umlagefaehig: false,
        bezeichnung: 'Reparatur Steigleitung + Malerarbeiten Treppenhaus',
        lieferant: 'Sanitär Wolf / Maler Braun',
      },
      {
        ...pos('p14', 'sonstige_nicht', SCHLUESSEL.EINHEITEN, 64800),
        umlagefaehig: false,
        bezeichnung: 'Kabel-TV Sammelvertrag (ab 01.07.2024 nicht mehr umlagefähig)',
        lieferant: 'Vodafone',
      },
    ],
    verbraeuche: [
      vb('v1', 'e1', null, 'kaltwasser', 118), vb('v2', 'e2', null, 'kaltwasser', 52),
      vb('v3', 'e3', 'm3', 'kaltwasser', 68), vb('v4', 'e3', 'm4', 'kaltwasser', 44),
      vb('v5', 'e4', null, 'kaltwasser', 82),
      vb('v6', 'e1', null, 'heizung', 1420), vb('v7', 'e2', null, 'heizung', 1180),
      vb('v8', 'e3', 'm3', 'heizung', 940), vb('v9', 'e3', 'm4', 'heizung', 760),
      vb('v10', 'e4', null, 'heizung', 1090),
      vb('v11', 'e1', null, 'warmwasser', 34), vb('v12', 'e2', null, 'warmwasser', 12),
      vb('v13', 'e3', 'm3', 'warmwasser', 13), vb('v14', 'e3', 'm4', 'warmwasser', 11),
      vb('v15', 'e4', null, 'warmwasser', 22),
    ],
    heizung: {
      ...neueHeizung(),
      aktiv: true,
      verbunden: true,
      erfassungsart: 'hkv',
      erzeuger: [
        {
          ...neuerErzeuger('erdgas', 'Gas-Brennwertkessel'),
          id: 'we1',
          lieferant: 'Stadtwerke Stuttgart',
          // 4.200 m³ Erdgas ≈ 42.000 kWh; davon rund 11.500 kWh für Warmwasser
          menge: 4200,
          kostenCent: 462000,
          // 42.000 kWh × 0,201 kg/kWh ≈ 8.442 kg CO₂; bei 45 €/t rund 380 €
          co2KostenCent: 38000,
          co2EmissionKg: 8442,
        },
      ],
      kosten: { betriebsstrom: 32000, wartung: 62000, messdienst: 74500, schornsteinfeger: 0, sonstiges: 0 },
      warmwasser: { modus: 'formel', volumen: 92, temperatur: 60, warmwasserKwh: 0, prozentsatz: 0.18 },
      co2: { gebaeudetyp: 'wohn', ausnahme: false },
    },
  };
}

/* --- Objekt 2: privat, Zweifamilienhaus mit Etagenheizungen --- */

function objekt2() {
  return {
    ...neuesObjekt('v1'),
    id: 'o2',
    bezeichnung: 'Zweifamilienhaus Ulmenweg 7',
    strasse: 'Ulmenweg 7',
    plz: '71638',
    ort: 'Ludwigsburg',
    wohnflaecheGesamt: 168,
    gebaeudetyp: 'wohn',
    leerstandPersonen: 1,
    verbrauchsdifferenz: 'vermieter',
    notiz: 'Jede Wohnung hat eine eigene Gastherme mit eigenem Liefervertrag – keine Heizkostenabrechnung.',
  };
}

function einheiten2() {
  return [
    { ...neueEinheit('o2'), id: 'e5', bezeichnung: 'Wohnung EG', lage: 'Erdgeschoss', wohnflaeche: 84, mea: 500 },
    { ...neueEinheit('o2'), id: 'e6', bezeichnung: 'Wohnung OG', lage: 'Obergeschoss', wohnflaeche: 84, mea: 500 },
  ];
}

function mieter2() {
  const anschrift = 'Ulmenweg 7, 71638 Ludwigsburg';
  return [
    mv('m6', 'e5', 'Familie Fischer', anschrift, '2021-07-01', '', 4, 18000, 0),
    mv('m7', 'e6', 'Herr Gruber', anschrift, '2019-04-01', '', 2, 16000, 0),
  ];
}

function abrechnung2() {
  return {
    ...neueAbrechnung('o2', 2024),
    id: 'a2024o2',
    erstelltAm: '2025-03-15',
    zugestelltAm: '2025-03-20',
    hauptzaehler: { kaltwasser: 0, warmwasser: 0, heizung: 0 },
    positionen: [
      { ...pos('q01', 'grundsteuer', SCHLUESSEL.FLAECHE, 86400), lieferant: 'Stadtkasse Ludwigsburg' },
      { ...pos('q02', 'wasser', SCHLUESSEL.VERBRAUCH_WASSER, 62000), lieferant: 'Stadtwerke Ludwigsburg' },
      { ...pos('q03', 'entwaesserung', SCHLUESSEL.VERBRAUCH_WASSER, 78000), lieferant: 'Stadtentwässerung' },
      { ...pos('q04', 'strassenreinigung_muell', SCHLUESSEL.PERSONEN, 54000), lieferant: 'AVL Ludwigsburg' },
      { ...pos('q05', 'gartenpflege', SCHLUESSEL.FLAECHE, 48000), lohnanteilHaushaltsnah: 40000, lieferant: 'Gartenbau Klein' },
      { ...pos('q06', 'versicherung', SCHLUESSEL.FLAECHE, 62000), lieferant: 'Allianz' },
      { ...pos('q07', 'schornsteinreinigung', SCHLUESSEL.FLAECHE, 18600), lieferant: 'Bezirksschornsteinfeger' },
      { ...pos('q08', 'instandhaltung', SCHLUESSEL.FLAECHE, 178000), umlagefaehig: false, bezeichnung: 'Erneuerung Dachrinne', lieferant: 'Spenglerei Vogt' },
    ],
    verbraeuche: [
      vb('w1', 'e5', null, 'kaltwasser', 152),
      vb('w2', 'e6', null, 'kaltwasser', 84),
    ],
    heizung: neueHeizung(),
  };
}

/* --- Objekt 3: GbR, Wohnhaus mit Zentralheizung --- */

function objekt3() {
  return {
    ...neuesObjekt('v2'),
    id: 'o3',
    bezeichnung: 'Wohnhaus Bahnhofstraße 44',
    strasse: 'Bahnhofstraße 44',
    plz: '70372',
    ort: 'Stuttgart',
    wohnflaecheGesamt: 195,
    gebaeudetyp: 'wohn',
    leerstandPersonen: 1,
    verbrauchsdifferenz: 'flaeche',
  };
}

function einheiten3() {
  return [
    { ...neueEinheit('o3'), id: 'e7', bezeichnung: 'Wohnung 1', lage: 'Erdgeschoss', wohnflaeche: 68, mea: 350 },
    { ...neueEinheit('o3'), id: 'e8', bezeichnung: 'Wohnung 2', lage: '1. OG', wohnflaeche: 72, mea: 370 },
    { ...neueEinheit('o3'), id: 'e9', bezeichnung: 'Wohnung 3', lage: 'Dachgeschoss', wohnflaeche: 55, mea: 280 },
  ];
}

function mieter3() {
  const anschrift = 'Bahnhofstraße 44, 70372 Stuttgart';
  return [
    mv('m8', 'e7', 'Frau Hoffmann', anschrift, '2020-01-01', '', 2, 17000, 13500),
    mv('m9', 'e8', 'Familie Ivanov', anschrift, '2022-09-01', '', 3, 18500, 14500),
    mv('m10', 'e9', 'Herr Jung', anschrift, '2023-02-01', '', 1, 14000, 11000),
  ];
}

function abrechnung3() {
  return {
    ...neueAbrechnung('o3', 2024),
    id: 'a2024o3',
    erstelltAm: '2025-03-15',
    zugestelltAm: '2025-03-20',
    hauptzaehler: { kaltwasser: 290, warmwasser: 0, heizung: 0 },
    positionen: [
      { ...pos('r01', 'grundsteuer', SCHLUESSEL.FLAECHE, 118000), lieferant: 'Stadtkasse Stuttgart' },
      { ...pos('r02', 'wasser', SCHLUESSEL.VERBRAUCH_WASSER, 64000), lieferant: 'Stadtwerke' },
      { ...pos('r03', 'entwaesserung', SCHLUESSEL.VERBRAUCH_WASSER, 81000), lieferant: 'Stadtentwässerung' },
      { ...pos('r04', 'strassenreinigung_muell', SCHLUESSEL.PERSONEN, 58000), lieferant: 'AWS Stuttgart' },
      { ...pos('r05', 'gebaeudereinigung', SCHLUESSEL.FLAECHE, 96000), lohnanteilHaushaltsnah: 84000, lieferant: 'Reinigung Meier GmbH' },
      { ...pos('r06', 'beleuchtung', SCHLUESSEL.FLAECHE, 33600), lieferant: 'EnBW' },
      { ...pos('r07', 'versicherung', SCHLUESSEL.FLAECHE, 78000), lieferant: 'Allianz' },
      { ...pos('r08', 'aufzug', SCHLUESSEL.FLAECHE, 96000), lieferant: 'Schindler', notiz: 'Wartung, Notruf und TÜV' },
      { ...pos('r09', 'verwaltung', SCHLUESSEL.FLAECHE, 108000), umlagefaehig: false, bezeichnung: 'Verwaltung durch die GbR', lieferant: 'Spachmann & Partner GbR' },
    ],
    verbraeuche: [
      vb('x1', 'e7', null, 'kaltwasser', 94), vb('x2', 'e8', null, 'kaltwasser', 118), vb('x3', 'e9', null, 'kaltwasser', 56),
      vb('x4', 'e7', null, 'heizung', 980), vb('x5', 'e8', null, 'heizung', 1140), vb('x6', 'e9', null, 'heizung', 720),
      vb('x7', 'e7', null, 'warmwasser', 21), vb('x8', 'e8', null, 'warmwasser', 28), vb('x9', 'e9', null, 'warmwasser', 13),
    ],
    // Hybridanlage: Wärmepumpe als Grundlast, Gaskessel für Spitzenlast.
    // Beide Erzeuger haben einen eigenen Wärmemengenzähler, deshalb ist die
    // Aufteilung zwischen ihnen gemessen und nicht geschätzt.
    heizung: {
      ...neueHeizung(),
      aktiv: true,
      verbunden: true,
      erfassungsart: 'hkv',
      erzeuger: [
        {
          ...neuerErzeuger('waermepumpe', 'Luft-Wasser-Wärmepumpe'),
          id: 'we2',
          lieferant: 'EnBW (Wärmepumpentarif)',
          menge: 6400,
          arbeitszahl: 3.4,
          zaehler: { nummer: 'WMZ-1 Wärmepumpe', standAnfang: 42980, standEnde: 64480 },
          kostenCent: 179200,
        },
        {
          ...neuerErzeuger('erdgas', 'Gas-Brennwertkessel (Spitzenlast)'),
          id: 'we3',
          lieferant: 'Stadtwerke Stuttgart',
          menge: 1400,
          zaehler: { nummer: 'WMZ-2 Gaskessel', standAnfang: 128450, standEnde: 141650 },
          kostenCent: 154000,
          // Nur der Gasanteil unterliegt dem BEHG: 14.000 kWh × 0,201 kg/kWh
          co2KostenCent: 12600,
          co2EmissionKg: 2814,
        },
      ],
      kosten: { betriebsstrom: 24000, wartung: 48000, messdienst: 56000, schornsteinfeger: 0, sonstiges: 0 },
      warmwasser: { modus: 'formel', volumen: 62, temperatur: 60, warmwasserKwh: 0, prozentsatz: 0.18 },
      co2: { gebaeudetyp: 'wohn', ausnahme: false },
    },
  };
}

/* --- Objekt 4: GbR, kleines Objekt ohne Zentralheizung --- */

function objekt4() {
  return {
    ...neuesObjekt('v2'),
    id: 'o4',
    bezeichnung: 'Stadthaus Marktplatz 2',
    strasse: 'Marktplatz 2',
    plz: '71634',
    ort: 'Ludwigsburg',
    wohnflaecheGesamt: 122,
    gebaeudetyp: 'wohn',
    leerstandPersonen: 1,
    verbrauchsdifferenz: 'verbrauch',
  };
}

function einheiten4() {
  return [
    { ...neueEinheit('o4'), id: 'e10', bezeichnung: 'Wohnung vorne', lage: '1. OG', wohnflaeche: 66, mea: 540 },
    { ...neueEinheit('o4'), id: 'e11', bezeichnung: 'Wohnung hinten', lage: '2. OG', wohnflaeche: 56, mea: 460 },
  ];
}

function mieter4() {
  const anschrift = 'Marktplatz 2, 71634 Ludwigsburg';
  return [
    mv('m11', 'e10', 'Frau Kern', anschrift, '2021-11-01', '', 2, 15000, 0),
    mv('m12', 'e11', 'Herr Lindner', anschrift, '2024-03-01', '', 1, 13500, 0),
  ];
}

function abrechnung4() {
  return {
    ...neueAbrechnung('o4', 2024),
    id: 'a2024o4',
    erstelltAm: '2025-03-15',
    zugestelltAm: '2025-03-20',
    positionen: [
      { ...pos('s01', 'grundsteuer', SCHLUESSEL.FLAECHE, 74000), lieferant: 'Stadtkasse Ludwigsburg' },
      { ...pos('s02', 'wasser', SCHLUESSEL.VERBRAUCH_WASSER, 48000), lieferant: 'Stadtwerke Ludwigsburg' },
      { ...pos('s03', 'entwaesserung', SCHLUESSEL.VERBRAUCH_WASSER, 59000), lieferant: 'Stadtentwässerung' },
      { ...pos('s04', 'strassenreinigung_muell', SCHLUESSEL.PERSONEN, 42000), lieferant: 'AVL Ludwigsburg' },
      { ...pos('s05', 'gebaeudereinigung', SCHLUESSEL.FLAECHE, 54000), lohnanteilHaushaltsnah: 47000, lieferant: 'Reinigung Meier GmbH' },
      { ...pos('s06', 'versicherung', SCHLUESSEL.FLAECHE, 51000), lieferant: 'Allianz' },
    ],
    verbraeuche: [
      vb('y1', 'e10', null, 'kaltwasser', 88),
      vb('y2', 'e11', null, 'kaltwasser', 41),
    ],
    heizung: neueHeizung(),
  };
}

/* ------------------------------------------------------------------ Helfer */

function pos(kennung, kostenartId, schluessel, betragBrutto) {
  const p = { ...neuePosition(kostenartId, schluessel), id: kennung, betragBrutto };
  if (schluessel === SCHLUESSEL.VERBRAUCH_WASSER) p.verbrauchsart = 'kaltwasser';
  return p;
}

function vb(kennung, einheitId, mietverhaeltnisId, art, wert) {
  return { id: kennung, einheitId, mietverhaeltnisId, art, wert };
}

function mv(kennung, einheitId, name, anschrift, von, bis, personen, vzBk, vzHk) {
  return {
    ...neuesMietverhaeltnis(einheitId, Number(von.slice(0, 4))),
    id: kennung,
    einheitId,
    mieterName: name,
    mieterAnschrift: anschrift,
    von,
    bis,
    personen,
    vzModus: 'monatlich',
    vzBetriebskostenMonat: vzBk,
    vzHeizkostenMonat: vzHk,
  };
}
