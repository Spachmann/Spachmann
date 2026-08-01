import { describe, expect, it } from 'vitest';
import { berechneAbrechnung, ermittleNutzungszeitraeume } from './berechnung';
import { standardHeizkosten, waermemengeWarmwasserKwh } from './heizkosten';
import type {
  Abrechnungszeitraum,
  AppState,
  Einheit,
  Kostenposition,
  Mietverhaeltnis,
} from './types';

// ---------------------------------------------------------------------------
// Testaufbau: Mehrfamilienhaus mit drei Wohnungen (60 / 40 / 100 m²)
// ---------------------------------------------------------------------------

const ZEITRAUM: Abrechnungszeitraum = {
  id: 'z1',
  objektId: 'o1',
  bezeichnung: 'Abrechnung 2023',
  von: '2023-01-01',
  bis: '2023-12-31',
  zugangDatum: '2024-06-30',
};

function einheit(id: string, bezeichnung: string, qm: number, extra: Partial<Einheit> = {}): Einheit {
  return { id, objektId: 'o1', bezeichnung, wohnflaecheQm: qm, ...extra };
}

function mietverhaeltnis(
  id: string,
  einheitId: string,
  mieter: string,
  beginn: string,
  ende: string | undefined,
  personen: number,
  vzBk = 10000,
  vzHk = 0,
): Mietverhaeltnis {
  return {
    id,
    einheitId,
    mieter: [mieter],
    beginn,
    ende,
    personenzahlen: [{ von: beginn, bis: ende ?? '9999-12-31', anzahl: personen }],
    vorauszahlungBetriebskostenMonatlich: vzBk,
    vorauszahlungHeizkostenMonatlich: vzHk,
    umlageVereinbart: true,
    sonstigeBetriebskostenVereinbart: true,
  };
}

function position(
  id: string,
  katalogId: string,
  bezeichnung: string,
  betrag: number,
  verteilerschluessel: Kostenposition['verteilerschluessel'],
  extra: Partial<Kostenposition> = {},
): Kostenposition {
  return {
    id,
    abrechnungszeitraumId: 'z1',
    katalogId,
    bezeichnung,
    betrag,
    verteilerschluessel,
    ...extra,
  };
}

function basisState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: 1,
    objekt: {
      id: 'o1',
      bezeichnung: 'Musterhaus',
      strasse: 'Musterstraße 1',
      plz: '10115',
      ort: 'Berlin',
      leerstandPersonenFiktiv: 1,
      vermieter: {
        name: 'Erika Mustermann',
        strasse: 'Vermieterweg 2',
        plz: '10117',
        ort: 'Berlin',
      },
    },
    einheiten: [
      einheit('e1', 'Whg. 1 EG links', 60),
      einheit('e2', 'Whg. 2 EG rechts', 40),
      einheit('e3', 'Whg. 3 OG', 100),
    ],
    mietverhaeltnisse: [
      mietverhaeltnis('m1', 'e1', 'Anna Müller', '2020-01-01', undefined, 2),
      mietverhaeltnis('m2', 'e2', 'Bernd Schmidt', '2019-05-01', undefined, 1),
      mietverhaeltnis('m3', 'e3', 'Familie Wagner', '2015-01-01', undefined, 4),
    ],
    abrechnungszeitraeume: [ZEITRAUM],
    kostenpositionen: [],
    verbraeuche: [],
    leerstandsverbraeuche: [],
    heizkosten: [],
    aktiverZeitraumId: 'z1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('Nutzungszeiträume', () => {
  it('erfasst volle Mietverhältnisse mit allen Tagen', () => {
    const n = ermittleNutzungszeitraeume(basisState(), ZEITRAUM);
    expect(n).toHaveLength(3);
    expect(n.every((x) => x.tage === 365)).toBe(true);
    expect(n.find((x) => x.mietverhaeltnis.id === 'm3')?.personentage).toBe(4 * 365);
  });

  it('kürzt Mietverhältnisse auf den Abrechnungszeitraum', () => {
    const state = basisState({
      mietverhaeltnisse: [
        mietverhaeltnis('m1', 'e1', 'Anna Müller', '2023-04-01', '2023-09-30', 2),
      ],
    });
    const n = ermittleNutzungszeitraeume(state, ZEITRAUM);
    expect(n[0].von).toBe('2023-04-01');
    expect(n[0].bis).toBe('2023-09-30');
    expect(n[0].tage).toBe(183);
  });

  it('ignoriert Mietverhältnisse außerhalb des Zeitraums', () => {
    const state = basisState({
      mietverhaeltnisse: [mietverhaeltnis('m1', 'e1', 'Alt', '2019-01-01', '2022-12-31', 2)],
    });
    expect(ermittleNutzungszeitraeume(state, ZEITRAUM)).toHaveLength(0);
  });

  it('gewichtet wechselnde Personenzahlen als Personentage', () => {
    const mv = mietverhaeltnis('m1', 'e1', 'Anna Müller', '2020-01-01', undefined, 2);
    mv.personenzahlen = [
      { von: '2020-01-01', bis: '2023-06-30', anzahl: 2 },
      { von: '2023-07-01', bis: '9999-12-31', anzahl: 3 },
    ];
    const n = ermittleNutzungszeitraeume(basisState({ mietverhaeltnisse: [mv] }), ZEITRAUM);
    expect(n[0].personentage).toBe(2 * 181 + 3 * 184);
  });
});

describe('Verteilung nach Wohnfläche', () => {
  it('teilt die Kosten im Verhältnis der Flächen auf', () => {
    const state = basisState({
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const anteil = (id: string) =>
      e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === id)!.summeUmlagefaehig;

    // 200,00 € auf 200 m²: 60 / 40 / 100 m²
    expect(anteil('m1')).toBe(60000);
    expect(anteil('m2')).toBe(40000);
    expect(anteil('m3')).toBe(100000);
    expect(e.leerstandsanteilVermieter).toBe(0);
  });

  it('addiert alle Anteile exakt zu den Gesamtkosten', () => {
    const state = basisState({
      kostenpositionen: [
        position('p1', 'BETRKV_2_1', 'Grundsteuer', 123457, 'WOHNFLAECHE'),
        position('p2', 'BETRKV_2_8', 'Müllabfuhr', 88891, 'WOHNEINHEIT'),
        position('p3', 'BETRKV_2_9', 'Treppenhausreinigung', 45673, 'PERSONENZAHL'),
      ],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const verteilt =
      e.mieterAbrechnungen.reduce((s, m) => s + m.summeUmlagefaehig, 0) +
      e.leerstandsanteilVermieter;
    expect(verteilt).toBe(123457 + 88891 + 45673);
    expect(e.gesamtkostenUmlagefaehig).toBe(verteilt);
  });
});

describe('Verteilung nach Personenzahl', () => {
  it('nutzt Personentage als Maßstab', () => {
    const state = basisState({
      kostenpositionen: [position('p1', 'BETRKV_2_8', 'Restmüll', 70000, 'PERSONENZAHL')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const anteil = (id: string) =>
      e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === id)!.summeUmlagefaehig;
    // 2 + 1 + 4 = 7 Personen
    expect(anteil('m1')).toBe(20000);
    expect(anteil('m2')).toBe(10000);
    expect(anteil('m3')).toBe(40000);
  });
});

describe('Verteilung nach Wohneinheiten', () => {
  it('verteilt zu gleichen Teilen', () => {
    const state = basisState({
      kostenpositionen: [position('p1', 'BETRKV_2_15A', 'Antennenanlage', 30000, 'WOHNEINHEIT')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    for (const m of e.mieterAbrechnungen) {
      expect(m.summeUmlagefaehig).toBe(10000);
    }
  });
});

describe('Direktzuordnung', () => {
  it('belastet nur die betroffene Einheit', () => {
    const state = basisState({
      kostenpositionen: [
        position('p1', 'BETRKV_2_12', 'Schornsteinfeger Whg. 3', 12000, 'DIREKTZUORDNUNG', {
          direktEinheitId: 'e3',
        }),
      ],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const anteil = (id: string) =>
      e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === id)!.summeUmlagefaehig;
    expect(anteil('m1')).toBe(0);
    expect(anteil('m2')).toBe(0);
    expect(anteil('m3')).toBe(12000);
  });
});

describe('Mieterwechsel und Leerstand', () => {
  it('teilt zeitabhängige Kosten taggenau auf', () => {
    const state = basisState({
      mietverhaeltnisse: [
        mietverhaeltnis('m1a', 'e1', 'Vormieter', '2020-01-01', '2023-06-30', 2),
        mietverhaeltnis('m1b', 'e1', 'Nachmieter', '2023-07-01', undefined, 2),
        mietverhaeltnis('m2', 'e2', 'Bernd Schmidt', '2019-05-01', undefined, 1),
        mietverhaeltnis('m3', 'e3', 'Familie Wagner', '2015-01-01', undefined, 4),
      ],
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const anteil = (id: string) =>
      e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === id)!.summeUmlagefaehig;

    // Whg. 1 trägt insgesamt 600,00 €, aufgeteilt auf 181 und 184 Tage
    expect(anteil('m1a') + anteil('m1b')).toBe(60000);
    expect(anteil('m1a')).toBe(Math.round((60000 * 181) / 365));
    expect(e.leerstandsanteilVermieter).toBe(0);
  });

  it('weist Leerstandsanteile dem Vermieter zu', () => {
    const state = basisState({
      mietverhaeltnisse: [
        // Whg. 1 steht das halbe Jahr leer
        mietverhaeltnis('m1', 'e1', 'Anna Müller', '2023-07-01', undefined, 2),
        mietverhaeltnis('m2', 'e2', 'Bernd Schmidt', '2019-05-01', undefined, 1),
        mietverhaeltnis('m3', 'e3', 'Familie Wagner', '2015-01-01', undefined, 4),
      ],
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const anteil = (id: string) =>
      e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === id)!.summeUmlagefaehig;

    expect(anteil('m1')).toBe(Math.round((60000 * 184) / 365));
    // Die anderen Mieter werden durch den Leerstand nicht belastet
    expect(anteil('m2')).toBe(40000);
    expect(anteil('m3')).toBe(100000);
    expect(e.leerstandsanteilVermieter).toBe(200000 - anteil('m1') - 40000 - 100000);
    expect(e.leerstandsanteilVermieter).toBeGreaterThan(29000);
  });

  it('belastet beim Personenschlüssel den Leerstand mit einer fiktiven Person', () => {
    const state = basisState({
      mietverhaeltnisse: [mietverhaeltnis('m2', 'e2', 'Bernd Schmidt', '2019-05-01', undefined, 1)],
      kostenpositionen: [position('p1', 'BETRKV_2_8', 'Restmüll', 30000, 'PERSONENZAHL')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    // 1 Person Mieter, 2 leerstehende Einheiten mit je 1 fiktiven Person
    expect(e.mieterAbrechnungen[0].summeUmlagefaehig).toBe(10000);
    expect(e.leerstandsanteilVermieter).toBe(20000);
  });
});

describe('Trennung umlagefähig / nicht umlagefähig', () => {
  it('verteilt nicht umlagefähige Positionen nicht auf die Mieter', () => {
    const state = basisState({
      kostenpositionen: [
        position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE'),
        position('p2', 'NU_VERWALTUNG', 'Hausverwaltung', 144000, 'WOHNFLAECHE'),
        position('p3', 'NU_INSTANDHALTUNG', 'Dachreparatur', 350000, 'WOHNFLAECHE'),
      ],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    expect(e.gesamtkostenAlle).toBe(694000);
    expect(e.gesamtkostenUmlagefaehig).toBe(200000);
    expect(e.gesamtkostenNichtUmlagefaehig).toBe(494000);
    expect(e.nichtUmlagefaehigePositionen).toHaveLength(2);
    const verteilt = e.mieterAbrechnungen.reduce((s, m) => s + m.summeUmlagefaehig, 0);
    expect(verteilt).toBe(200000);
  });

  it('zieht den nicht umlagefähigen Anteil vorweg ab', () => {
    const state = basisState({
      kostenpositionen: [
        position('p1', 'BETRKV_2_14', 'Hauswart', 240000, 'WOHNFLAECHE', {
          nichtUmlagefaehigerAnteil: 60000,
          begruendungVorwegabzug: '25 % Instandhaltungs- und Verwaltungstätigkeiten',
        }),
      ],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    expect(e.vorwegabzuegeGesamt).toBe(60000);
    expect(e.gesamtkostenUmlagefaehig).toBe(180000);
    expect(e.gesamtkostenNichtUmlagefaehig).toBe(60000);
    const m1 = e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'm1')!;
    expect(m1.summeUmlagefaehig).toBe(54000); // 60/200 von 1.800,00 €
  });
});

describe('Vorauszahlungen und Saldo', () => {
  it('zieht die rechnerischen Vorauszahlungen ab', () => {
    const state = basisState({
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const m1 = e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'm1')!;
    expect(m1.vorauszahlungen).toBe(12 * 10000);
    expect(m1.saldo).toBe(60000 - 120000); // Guthaben
    expect(m1.vorauszahlungenGeschaetzt).toBe(true);
  });

  it('bevorzugt tatsächlich erfasste Vorauszahlungen', () => {
    const mv = mietverhaeltnis('m1', 'e1', 'Anna Müller', '2020-01-01', undefined, 2);
    mv.vorauszahlungenTatsaechlich = { z1: 45000 };
    const state = basisState({
      mietverhaeltnisse: [mv],
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const m1 = e.mieterAbrechnungen[0];
    expect(m1.vorauszahlungen).toBe(45000);
    expect(m1.vorauszahlungenGeschaetzt).toBe(false);
    expect(m1.saldo).toBe(60000 - 45000); // Nachzahlung
  });

  it('berechnet Vorauszahlungen bei unterjährigem Mietverhältnis anteilig', () => {
    const state = basisState({
      mietverhaeltnisse: [mietverhaeltnis('m1', 'e1', 'Anna Müller', '2023-04-01', undefined, 2)],
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    expect(e.mieterAbrechnungen[0].vorauszahlungen).toBe(9 * 10000);
  });
});

describe('Heizkostenabrechnung nach HeizkostenV', () => {
  const heizState = () =>
    basisState({
      kostenpositionen: [
        position('h1', 'BETRKV_2_6', 'Erdgas, Wartung, Messdienst', 600000, 'HEIZKOSTENV'),
      ],
      heizkosten: [
        {
          ...standardHeizkosten('z1'),
          warmwasserErmittlung: 'FORMEL_9_2',
          warmwasserVolumenM3: 200,
          warmwasserTemperaturC: 60,
          gesamtwaermemengeKwh: 100000,
        },
      ],
      verbraeuche: [
        { id: 'v1', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm1', art: 'HEIZUNG', verbrauch: 300, einheit: 'Einheiten' },
        { id: 'v2', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm2', art: 'HEIZUNG', verbrauch: 200, einheit: 'Einheiten' },
        { id: 'v3', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm3', art: 'HEIZUNG', verbrauch: 500, einheit: 'Einheiten' },
        { id: 'v4', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm1', art: 'WARMWASSER', verbrauch: 50, einheit: 'm3' },
        { id: 'v5', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm2', art: 'WARMWASSER', verbrauch: 30, einheit: 'm3' },
        { id: 'v6', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm3', art: 'WARMWASSER', verbrauch: 120, einheit: 'm3' },
      ],
    });

  it('berechnet die Wärmemenge nach § 9 Abs. 2 HeizkostenV', () => {
    // Q = 2,5 · 200 m³ · (60 °C − 10 °C) = 25.000 kWh
    expect(waermemengeWarmwasserKwh(200, 60)).toBe(25000);
  });

  it('trennt Warmwasser- und Heizkosten vorweg ab', () => {
    const e = berechneAbrechnung(heizState(), ZEITRAUM);
    const hk = e.heizkosten!;
    // 25.000 von 100.000 kWh = 25 %
    expect(hk.aufteilung.warmwasserKosten).toBe(150000);
    expect(hk.aufteilung.heizkosten).toBe(450000);
  });

  it('teilt in Grund- und Verbrauchskosten nach §§ 7, 8 HeizkostenV', () => {
    const e = berechneAbrechnung(heizState(), ZEITRAUM);
    const hk = e.heizkosten!;
    expect(hk.aufteilung.heizungVerbrauchskosten).toBe(315000); // 70 %
    expect(hk.aufteilung.heizungGrundkosten).toBe(135000); // 30 %
    expect(hk.aufteilung.warmwasserVerbrauchskosten).toBe(105000);
    expect(hk.aufteilung.warmwasserGrundkosten).toBe(45000);
    expect(hk.bloecke).toHaveLength(4);
  });

  it('verteilt die Verbrauchskosten nach erfasstem Verbrauch', () => {
    const e = berechneAbrechnung(heizState(), ZEITRAUM);
    const m1 = e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'm1')!;
    // Heizung Grundkosten 60/200 von 1.350,00 € = 405,00 €
    // Heizung Verbrauch   300/1000 von 3.150,00 € = 945,00 €
    // WW Grundkosten      60/200 von 450,00 € = 135,00 €
    // WW Verbrauch        50/200 von 1.050,00 € = 262,50 €
    expect(m1.summeHeizUndWarmwasser).toBe(40500 + 94500 + 13500 + 26250);
  });

  it('verteilt die gesamten Heizkosten verlustfrei', () => {
    const e = berechneAbrechnung(heizState(), ZEITRAUM);
    const verteilt =
      e.mieterAbrechnungen.reduce((s, m) => s + m.summeHeizUndWarmwasser, 0) +
      e.heizkosten!.bloecke.reduce((s, b) => s + b.leerstandsanteil, 0);
    expect(verteilt).toBe(600000);
  });

  it('kürzt um 15 %, wenn nicht verbrauchsabhängig abgerechnet wurde', () => {
    const state = heizState();
    state.heizkosten[0].verbrauchsabhaengigAbgerechnet = false;
    const e = berechneAbrechnung(state, ZEITRAUM);
    const m1 = e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'm1')!;
    // 60/200 von 6.000,00 € = 1.800,00 €, davon 15 % Kürzung = 270,00 €
    expect(m1.summeHeizUndWarmwasser).toBe(180000);
    expect(m1.kuerzungHeizkostenV).toBe(27000);
    expect(m1.summeUmlagefaehig).toBe(153000);
    expect(e.heizkosten!.bloecke).toHaveLength(1);
  });

  it('erkennt fehlende Zählerstände als Mangel', () => {
    const state = heizState();
    state.verbraeuche = state.verbraeuche.filter((v) => v.mietverhaeltnisId !== 'm2');
    const e = berechneAbrechnung(state, ZEITRAUM);
    const maengel = e.heizkosten!.bloecke.flatMap((b) => b.basis.maengel);
    expect(maengel.length).toBeGreaterThan(0);
  });
});

describe('Verbrauchsabrechnung Kaltwasser', () => {
  it('verteilt nach gemessenem Verbrauch', () => {
    const state = basisState({
      kostenpositionen: [
        position('p1', 'BETRKV_2_2', 'Frischwasser', 100000, 'VERBRAUCH', {
          verbrauchsart: 'KALTWASSER',
        }),
      ],
      verbraeuche: [
        { id: 'v1', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm1', art: 'KALTWASSER', standAnfang: 100, standEnde: 180, einheit: 'm3' },
        { id: 'v2', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm2', art: 'KALTWASSER', standAnfang: 50, standEnde: 90, einheit: 'm3' },
        { id: 'v3', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm3', art: 'KALTWASSER', standAnfang: 0, standEnde: 80, einheit: 'm3' },
      ],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const anteil = (id: string) =>
      e.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === id)!.summeUmlagefaehig;
    // Verbrauch 80 / 40 / 80 m³ = 200 m³
    expect(anteil('m1')).toBe(40000);
    expect(anteil('m2')).toBe(20000);
    expect(anteil('m3')).toBe(40000);
  });

  it('belastet den Vermieter mit dem Leerstandsverbrauch', () => {
    const state = basisState({
      mietverhaeltnisse: [mietverhaeltnis('m1', 'e1', 'Anna Müller', '2020-01-01', undefined, 2)],
      kostenpositionen: [
        position('p1', 'BETRKV_2_2', 'Frischwasser', 100000, 'VERBRAUCH', {
          verbrauchsart: 'KALTWASSER',
        }),
      ],
      verbraeuche: [
        { id: 'v1', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm1', art: 'KALTWASSER', verbrauch: 75, einheit: 'm3' },
      ],
      leerstandsverbraeuche: [
        { id: 'l1', abrechnungszeitraumId: 'z1', einheitId: 'e2', art: 'KALTWASSER', verbrauch: 25, einheit: 'm3' },
      ],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    expect(e.mieterAbrechnungen[0].summeUmlagefaehig).toBe(75000);
    expect(e.leerstandsanteilVermieter).toBe(25000);
  });
});

describe('Abrechnungszeilen', () => {
  it('enthält alle nach BGH erforderlichen Angaben', () => {
    const state = basisState({
      kostenpositionen: [position('p1', 'BETRKV_2_1', 'Grundsteuer', 200000, 'WOHNFLAECHE')],
    });
    const e = berechneAbrechnung(state, ZEITRAUM);
    const zeile = e.mieterAbrechnungen[0].zeilen[0];
    expect(zeile.gesamtkosten).toBe(200000); // Zusammenstellung der Gesamtkosten
    expect(zeile.schluessel).toBe('WOHNFLAECHE'); // Verteilerschlüssel
    expect(zeile.schluesselErlaeuterung).toContain('§ 556a'); // Erläuterung
    expect(zeile.gesamtMassstab).toBe(200); // Gesamtmaßstab
    expect(zeile.mieterMassstab).toBe(60); // Anteil des Mieters
    expect(zeile.anteil).toBe(60000); // Berechneter Anteil
    expect(zeile.tage).toBe(365);
    expect(zeile.gesamtTage).toBe(365);
  });
});
