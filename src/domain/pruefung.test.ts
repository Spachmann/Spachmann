import { describe, expect, it } from 'vitest';
import { berechneAbrechnung } from './berechnung';
import { pruefeAbrechnung, type Befund } from './pruefung';
import { standardHeizkosten } from './heizkosten';
import type { Abrechnungszeitraum, AppState, Kostenposition } from './types';

const ZEITRAUM: Abrechnungszeitraum = {
  id: 'z1',
  objektId: 'o1',
  bezeichnung: 'Abrechnung 2023',
  von: '2023-01-01',
  bis: '2023-12-31',
  zugangDatum: '2024-06-30',
};

function state(overrides: Partial<AppState> = {}, zeitraum = ZEITRAUM): AppState {
  return {
    version: 1,
    objekt: {
      id: 'o1',
      bezeichnung: 'Musterhaus',
      strasse: 'Musterstraße 1',
      plz: '10115',
      ort: 'Berlin',
      leerstandPersonenFiktiv: 1,
      vermieter: { name: 'Erika Mustermann', strasse: 'Vermieterweg 2', plz: '10117', ort: 'Berlin' },
    },
    einheiten: [
      { id: 'e1', objektId: 'o1', bezeichnung: 'Whg. 1', wohnflaecheQm: 60 },
      { id: 'e2', objektId: 'o1', bezeichnung: 'Whg. 2', wohnflaecheQm: 40 },
    ],
    mietverhaeltnisse: [
      {
        id: 'm1',
        einheitId: 'e1',
        mieter: ['Anna Müller'],
        beginn: '2020-01-01',
        personenzahlen: [{ von: '2020-01-01', bis: '9999-12-31', anzahl: 2 }],
        vorauszahlungBetriebskostenMonatlich: 10000,
        vorauszahlungHeizkostenMonatlich: 5000,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
      },
      {
        id: 'm2',
        einheitId: 'e2',
        mieter: ['Bernd Schmidt'],
        beginn: '2019-05-01',
        personenzahlen: [{ von: '2019-05-01', bis: '9999-12-31', anzahl: 1 }],
        vorauszahlungBetriebskostenMonatlich: 8000,
        vorauszahlungHeizkostenMonatlich: 4000,
        umlageVereinbart: true,
        sonstigeBetriebskostenVereinbart: true,
      },
    ],
    abrechnungszeitraeume: [zeitraum],
    kostenpositionen: [
      {
        id: 'p1',
        abrechnungszeitraumId: zeitraum.id,
        katalogId: 'BETRKV_2_1',
        bezeichnung: 'Grundsteuer',
        betrag: 120000,
        verteilerschluessel: 'WOHNFLAECHE',
      },
    ],
    verbraeuche: [],
    leerstandsverbraeuche: [],
    heizkosten: [],
    aktiverZeitraumId: zeitraum.id,
    ...overrides,
  };
}

function pruefe(s: AppState, zeitraum = ZEITRAUM) {
  return pruefeAbrechnung(s, zeitraum, berechneAbrechnung(s, zeitraum));
}

const enthaelt = (befunde: Befund[], titel: string, schweregrad?: Befund['schweregrad']) =>
  befunde.some(
    (b) => b.titel.includes(titel) && (!schweregrad || b.schweregrad === schweregrad),
  );

describe('Grundfall', () => {
  it('ist ohne Fehler erteilbar', () => {
    const bericht = pruefe(state());
    expect(bericht.anzahlFehler).toBe(0);
    expect(bericht.erteilbar).toBe(true);
  });

  it('berechnet das Ende der Abrechnungsfrist', () => {
    const bericht = pruefe(state());
    expect(bericht.abrechnungsfristEnde).toBe('2024-12-31');
    expect(bericht.abrechnungsfristAbgelaufen).toBe(false);
  });
});

describe('§ 556 Abs. 3 BGB – Abrechnungszeitraum und Frist', () => {
  it('beanstandet einen Zeitraum über zwölf Monate', () => {
    const z = { ...ZEITRAUM, von: '2023-01-01', bis: '2024-03-31' };
    const bericht = pruefe(state({}, z), z);
    expect(enthaelt(bericht.befunde, 'länger als zwölf Monate', 'FEHLER')).toBe(true);
    expect(bericht.erteilbar).toBe(false);
  });

  it('warnt bei abgelaufener Abrechnungsfrist', () => {
    const z = { ...ZEITRAUM, zugangDatum: '2025-03-01' };
    const bericht = pruefe(state({}, z), z);
    expect(bericht.abrechnungsfristAbgelaufen).toBe(true);
    expect(enthaelt(bericht.befunde, 'Abrechnungsfrist abgelaufen', 'WARNUNG')).toBe(true);
  });

  it('akzeptiert einen Zugang genau am letzten Tag der Frist', () => {
    const z = { ...ZEITRAUM, zugangDatum: '2024-12-31' };
    expect(pruefe(state({}, z), z).abrechnungsfristAbgelaufen).toBe(false);
  });

  it('weist auf verkürzte Zeiträume hin', () => {
    const z = { ...ZEITRAUM, von: '2023-07-01', bis: '2023-12-31' };
    expect(enthaelt(pruefe(state({}, z), z).befunde, 'Verkürzter Abrechnungszeitraum')).toBe(true);
  });
});

describe('§ 556 Abs. 1, 2 BGB – Vereinbarung', () => {
  it('beanstandet eine fehlende Umlagevereinbarung', () => {
    const s = state();
    s.mietverhaeltnisse[0].umlageVereinbart = false;
    expect(enthaelt(pruefe(s).befunde, 'Keine Umlagevereinbarung', 'FEHLER')).toBe(true);
  });

  it('warnt bei vereinbarter Betriebskostenpauschale', () => {
    const s = state();
    s.mietverhaeltnisse[0].betriebskostenpauschale = true;
    expect(enthaelt(pruefe(s).befunde, 'Betriebskostenpauschale', 'WARNUNG')).toBe(true);
  });

  it('warnt bei fehlenden Vorauszahlungen', () => {
    const s = state();
    s.mietverhaeltnisse[0].vorauszahlungBetriebskostenMonatlich = 0;
    s.mietverhaeltnisse[0].vorauszahlungHeizkostenMonatlich = 0;
    expect(enthaelt(pruefe(s).befunde, 'Keine Vorauszahlungen erfasst', 'WARNUNG')).toBe(true);
  });
});

describe('§ 2 BetrKV – Kostenarten', () => {
  it('beanstandet sonstige Betriebskosten ohne vertragliche Vereinbarung', () => {
    const s = state();
    s.mietverhaeltnisse[0].sonstigeBetriebskostenVereinbart = false;
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_17',
      bezeichnung: 'Wartung Rauchwarnmelder',
      betrag: 12000,
      verteilerschluessel: 'WOHNEINHEIT',
    });
    expect(enthaelt(pruefe(s).befunde, 'Sonstige Betriebskosten ohne Vereinbarung', 'FEHLER')).toBe(true);
  });

  it('akzeptiert sonstige Betriebskosten bei Vereinbarung', () => {
    const s = state();
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_17',
      bezeichnung: 'Wartung Rauchwarnmelder',
      betrag: 12000,
      verteilerschluessel: 'WOHNEINHEIT',
    });
    expect(enthaelt(pruefe(s).befunde, 'Sonstige Betriebskosten ohne Vereinbarung')).toBe(false);
  });

  it('beanstandet Kabelentgelte nach Wegfall des Nebenkostenprivilegs', () => {
    const z = { ...ZEITRAUM, von: '2024-01-01', bis: '2024-12-31', zugangDatum: '2025-06-30' };
    const s = state({}, z);
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: z.id,
      katalogId: 'BETRKV_2_15B',
      bezeichnung: 'Kabelanschluss',
      betrag: 60000,
      verteilerschluessel: 'WOHNEINHEIT',
    });
    expect(enthaelt(pruefe(s, z).befunde, 'Nicht mehr umlagefähig', 'FEHLER')).toBe(true);
  });

  it('lässt Kabelentgelte für Zeiträume bis 30.06.2024 zu', () => {
    const z = { ...ZEITRAUM, von: '2023-07-01', bis: '2024-06-30', zugangDatum: '2025-01-31' };
    const s = state({}, z);
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: z.id,
      katalogId: 'BETRKV_2_15B',
      bezeichnung: 'Kabelanschluss',
      betrag: 60000,
      verteilerschluessel: 'WOHNEINHEIT',
    });
    expect(enthaelt(pruefe(s, z).befunde, 'Nicht mehr umlagefähig')).toBe(false);
  });

  it('beanstandet ein überhöhtes Glasfaserbereitstellungsentgelt', () => {
    const s = state();
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_15C',
      bezeichnung: 'Glasfaserbereitstellungsentgelt',
      betrag: 20000, // 200,00 € bei 2 Wohnungen -> Grenze 120,00 €
      verteilerschluessel: 'WOHNEINHEIT',
    });
    expect(enthaelt(pruefe(s).befunde, 'Höchstbetrag überschritten', 'FEHLER')).toBe(true);
  });

  it('akzeptiert das Glasfaserentgelt innerhalb der Höchstgrenze', () => {
    const s = state();
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_15C',
      bezeichnung: 'Glasfaserbereitstellungsentgelt',
      betrag: 12000,
      verteilerschluessel: 'WOHNEINHEIT',
    });
    expect(enthaelt(pruefe(s).befunde, 'Höchstbetrag überschritten')).toBe(false);
  });

  it('beanstandet einen zu hohen Vorwegabzug', () => {
    const s = state();
    s.kostenpositionen[0].nichtUmlagefaehigerAnteil = 200000;
    expect(enthaelt(pruefe(s).befunde, 'Vorwegabzug zu hoch', 'FEHLER')).toBe(true);
  });

  it('weist auf Hauswartkosten ohne Vorwegabzug hin', () => {
    const s = state();
    s.kostenpositionen.push({
      id: 'p2',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_14',
      bezeichnung: 'Hauswart',
      betrag: 240000,
      verteilerschluessel: 'WOHNFLAECHE',
    });
    expect(enthaelt(pruefe(s).befunde, 'Hauswartkosten ohne Vorwegabzug', 'HINWEIS')).toBe(true);
  });

  it('beanstandet eine Direktzuordnung ohne Einheit', () => {
    const s = state();
    const p: Kostenposition = {
      id: 'p2',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_12',
      bezeichnung: 'Schornsteinfeger',
      betrag: 5000,
      verteilerschluessel: 'DIREKTZUORDNUNG',
    };
    s.kostenpositionen.push(p);
    expect(enthaelt(pruefe(s).befunde, 'Direktzuordnung ohne Einheit', 'FEHLER')).toBe(true);
  });
});

describe('Stammdaten', () => {
  it('beanstandet fehlende Vermieterangaben', () => {
    const s = state();
    s.objekt.vermieter.name = '';
    expect(enthaelt(pruefe(s).befunde, 'Angaben zum Vermieter', 'FEHLER')).toBe(true);
  });

  it('beanstandet eine fehlende Wohnfläche', () => {
    const s = state();
    s.einheiten[0].wohnflaecheQm = 0;
    expect(enthaelt(pruefe(s).befunde, 'Wohnfläche fehlt', 'FEHLER')).toBe(true);
  });

  it('beanstandet fehlende Kostenpositionen', () => {
    const s = state({ kostenpositionen: [] });
    expect(enthaelt(pruefe(s).befunde, 'Keine Kosten erfasst', 'FEHLER')).toBe(true);
  });
});

describe('HeizkostenV', () => {
  const mitHeizung = (anpassung: Partial<ReturnType<typeof standardHeizkosten>> = {}) => {
    const s = state();
    s.kostenpositionen.push({
      id: 'h1',
      abrechnungszeitraumId: 'z1',
      katalogId: 'BETRKV_2_6',
      bezeichnung: 'Heizung und Warmwasser',
      betrag: 400000,
      verteilerschluessel: 'HEIZKOSTENV',
    });
    s.heizkosten = [
      {
        ...standardHeizkosten('z1'),
        warmwasserErmittlung: 'FORMEL_9_2',
        warmwasserVolumenM3: 150,
        warmwasserTemperaturC: 60,
        gesamtwaermemengeKwh: 80000,
        ...anpassung,
      },
    ];
    s.verbraeuche = [
      { id: 'v1', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm1', art: 'HEIZUNG', verbrauch: 600, einheit: 'Einheiten' },
      { id: 'v2', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm2', art: 'HEIZUNG', verbrauch: 400, einheit: 'Einheiten' },
      { id: 'v3', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm1', art: 'WARMWASSER', verbrauch: 90, einheit: 'm3' },
      { id: 'v4', abrechnungszeitraumId: 'z1', mietverhaeltnisId: 'm2', art: 'WARMWASSER', verbrauch: 60, einheit: 'm3' },
    ];
    return s;
  };

  it('ist im Regelfall fehlerfrei', () => {
    expect(pruefe(mitHeizung()).anzahlFehler).toBe(0);
  });

  it('beanstandet einen Verbrauchsanteil außerhalb von 50–70 %', () => {
    const s = mitHeizung({ verbrauchsanteilHeizung: 40 as never });
    expect(enthaelt(pruefe(s).befunde, 'Verbrauchsanteil Heizung unzulässig', 'FEHLER')).toBe(true);
  });

  it('beanstandet einen nicht ermittelbaren Warmwasseranteil', () => {
    const s = mitHeizung({ gesamtwaermemengeKwh: 0 });
    expect(enthaelt(pruefe(s).befunde, 'Warmwasseranteil nicht ermittelbar', 'FEHLER')).toBe(true);
  });

  it('warnt bei manuell gesetztem Warmwasseranteil', () => {
    const s = mitHeizung({ warmwasserErmittlung: 'MANUELL', warmwasserAnteilProzentManuell: 18 });
    expect(enthaelt(pruefe(s).befunde, 'Warmwasseranteil manuell angesetzt', 'WARNUNG')).toBe(true);
  });

  it('warnt bei fehlender Verbrauchserfassung und weist die Kürzung aus', () => {
    const s = mitHeizung({ verbrauchsabhaengigAbgerechnet: false });
    expect(enthaelt(pruefe(s).befunde, '15 % Kürzung', 'WARNUNG')).toBe(true);
  });

  it('warnt bei fehlender unterjähriger Verbrauchsinformation', () => {
    const s = mitHeizung({ verbrauchsinformationErteilt: false });
    expect(enthaelt(pruefe(s).befunde, 'Verbrauchsinformation nicht erteilt', 'WARNUNG')).toBe(true);
  });

  it('beanstandet fehlende Zählerstände', () => {
    const s = mitHeizung();
    s.verbraeuche = s.verbraeuche.filter((v) => v.mietverhaeltnisId !== 'm2');
    expect(enthaelt(pruefe(s).befunde, 'Umlagemaßstab unvollständig', 'FEHLER')).toBe(true);
  });

  it('beanstandet Heizkosten ohne aktivierte HeizkostenV-Abrechnung', () => {
    const s = mitHeizung();
    s.heizkosten[0].aktiv = false;
    expect(enthaelt(pruefe(s).befunde, 'Heizkostenabrechnung nicht aktiviert', 'FEHLER')).toBe(true);
  });
});

describe('Leerstand', () => {
  it('weist den Leerstandsanteil des Vermieters aus', () => {
    const s = state();
    s.mietverhaeltnisse = [s.mietverhaeltnisse[0]];
    expect(enthaelt(pruefe(s).befunde, 'Leerstandsanteil verbleibt beim Vermieter', 'HINWEIS')).toBe(true);
  });
});
