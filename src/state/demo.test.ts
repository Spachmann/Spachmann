import { describe, expect, it } from 'vitest';
import { berechneAbrechnung } from '../domain/berechnung';
import { pruefeAbrechnung } from '../domain/pruefung';
import { summe } from '../domain/util';
import { demoZustand } from './demo';
import { importiereJson, exportiereJson } from './store';

const state = demoZustand();
const zeitraum = state.abrechnungszeitraeume[0];
const ergebnis = berechneAbrechnung(state, zeitraum);
const bericht = pruefeAbrechnung(state, zeitraum, ergebnis);

describe('Beispieldaten', () => {
  it('rechnet für alle fünf Mietverhältnisse des Zeitraums ab', () => {
    expect(ergebnis.mieterAbrechnungen).toHaveLength(5);
    expect(ergebnis.gesamtTage).toBe(366); // 2024 ist ein Schaltjahr
  });

  it('trennt umlagefähige von nicht umlagefähigen Kosten', () => {
    const alle = summe(state.kostenpositionen.map((p) => p.betrag));
    expect(ergebnis.gesamtkostenAlle).toBe(alle);
    expect(ergebnis.gesamtkostenUmlagefaehig + ergebnis.gesamtkostenNichtUmlagefaehig).toBe(alle);
    // Hausverwaltung, Reparatur, Rücklage, Kontoführung, Anwalt
    expect(ergebnis.nichtUmlagefaehigePositionen).toHaveLength(5);
    // Vorwegabzug beim Hauswart
    expect(ergebnis.vorwegabzuegeGesamt).toBe(60000);
  });

  it('verteilt die umlagefähigen Kosten lückenlos und ohne Rundungsverlust', () => {
    const verteilt =
      summe(
        ergebnis.mieterAbrechnungen.map(
          (m) => m.summeKalteBetriebskosten + m.summeHeizUndWarmwasser,
        ),
      ) + ergebnis.leerstandsanteilVermieter;
    expect(verteilt).toBe(ergebnis.gesamtkostenUmlagefaehig);
  });

  it('trägt den Leerstand des Monats Juli beim Vermieter', () => {
    expect(ergebnis.leerstandsanteilVermieter).toBeGreaterThan(0);
  });

  it('berücksichtigt den Mieterwechsel in Wohnung 2 taggenau', () => {
    const vor = ergebnis.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'mv2a')!;
    const nach = ergebnis.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'mv2b')!;
    expect(vor.nutzung.tage).toBe(182); // 01.01.–30.06.2024
    expect(nach.nutzung.tage).toBe(153); // 01.08.–31.12.2024
    expect(vor.nutzung.tage + nach.nutzung.tage).toBe(366 - 31); // Juli = Leerstand
  });

  it('gewichtet die geänderte Personenzahl in Wohnung 3', () => {
    const w3 = ergebnis.mieterAbrechnungen.find((m) => m.nutzung.mietverhaeltnis.id === 'mv3')!;
    // 3 Personen bis 30.04., danach 4 Personen
    expect(w3.nutzung.personentage).toBe(3 * 121 + 4 * 245);
  });

  it('teilt die Heizkosten nach HeizkostenV auf', () => {
    const hk = ergebnis.heizkosten!;
    expect(hk.aufteilung.gesamt).toBe(685000 + 21000 + 48000 + 39000);
    // Q = 2,5 · 146 m³ · 50 K = 18.250 kWh von 96.000 kWh
    expect(hk.aufteilung.warmwasserAnteil.anteil).toBeCloseTo(18250 / 96000, 10);
    expect(hk.bloecke).toHaveLength(4);
    const verteilt =
      summe(hk.bloecke.flatMap((b) => Object.values(b.anteile))) +
      summe(hk.bloecke.map((b) => b.leerstandsanteil));
    expect(verteilt).toBe(hk.aufteilung.gesamt);
  });

  it('weist Arbeitskosten nach § 35a EStG aus', () => {
    for (const m of ergebnis.mieterAbrechnungen) {
      expect(m.arbeitskosten35a).toBeGreaterThan(0);
      expect(m.arbeitskosten35a).toBeLessThan(m.summeUmlagefaehig);
    }
  });

  it('ist rechtlich fehlerfrei', () => {
    expect(bericht.befunde.filter((b) => b.schweregrad === 'FEHLER')).toEqual([]);
    expect(bericht.erteilbar).toBe(true);
    expect(bericht.abrechnungsfristAbgelaufen).toBe(false);
  });

  it('überlebt eine Export-/Import-Runde unverändert', () => {
    const zurueck = importiereJson(exportiereJson(state));
    const neu = berechneAbrechnung(zurueck, zurueck.abrechnungszeitraeume[0]);
    expect(neu.gesamtkostenUmlagefaehig).toBe(ergebnis.gesamtkostenUmlagefaehig);
    expect(neu.mieterAbrechnungen.map((m) => m.saldo)).toEqual(
      ergebnis.mieterAbrechnungen.map((m) => m.saldo),
    );
  });
});
