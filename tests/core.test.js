import test from 'node:test';
import assert from 'node:assert/strict';

import { parseBetrag, parseZahl, euro, anteilVon, runde, summe } from '../src/core/money.js';
import { tage, ueberschneidungTage, plusMonate, monateImZeitraum, dt } from '../src/core/datum.js';
import { stufeFuer, teileCo2Kosten } from '../src/core/co2.js';
import { warmwasserWaermemengeKwh, warmwasserAnteil, berechneHeizkosten, verbrauchsanteilZulaessig } from '../src/core/heizkosten.js';
import { BETRIEBSKOSTEN, NICHT_UMLAGEFAEHIG, istUmlagefaehigeArt, SCHLUESSEL } from '../src/core/katalog.js';
import { berechneAbrechnung, bildeNutzeinheiten, berechneVorauszahlungen, istUmlagefaehig, verteilePosition } from '../src/core/abrechnung.js';
import { pruefe } from '../src/core/pruefung.js';
import {
  demodaten, neuePosition, migriere, leererDatenbestand, bestandFuerObjekt,
  einheitenVon, mietverhaeltnisseVon, abrechnungenVon, objekteVon, rechtsform,
} from '../src/core/model.js';

// ---------------------------------------------------------------- Geldbeträge

test('parseBetrag versteht deutsche und englische Schreibweisen', () => {
  assert.equal(parseBetrag('1.234,56'), 123456);
  assert.equal(parseBetrag('1234,56'), 123456);
  assert.equal(parseBetrag('1234.56'), 123456);
  assert.equal(parseBetrag('1.234'), 123400);
  assert.equal(parseBetrag('12.34'), 1234);
  assert.equal(parseBetrag('1.234.567,89'), 123456789);
  assert.equal(parseBetrag('89,90 €'), 8990);
  assert.equal(parseBetrag('-45,10'), -4510);
  assert.equal(parseBetrag(''), 0);
  assert.equal(parseBetrag('abc'), 0);
  assert.equal(parseBetrag(19.99), 1999);
});

test('parseZahl liefert Dezimalwerte', () => {
  assert.equal(parseZahl('62,5'), 62.5);
  assert.equal(parseZahl('1.234,5'), 1234.5);
  assert.equal(parseZahl(''), 0);
});

test('euro formatiert deutsch', () => {
  assert.match(euro(123456), /1\.234,56/);
});

test('runde rundet kaufmännisch von der Null weg', () => {
  assert.equal(runde(0.5), 1);
  assert.equal(runde(-0.5), -1);
  assert.equal(runde(2.4), 2);
});

test('anteilVon rundet auf Cent', () => {
  assert.equal(anteilVon(10000, 1 / 3), 3333);
  assert.equal(anteilVon(10000, 0), 0);
});

// -------------------------------------------------------------------- Datum

test('tage zählt beide Randtage', () => {
  assert.equal(tage('2024-01-01', '2024-01-01'), 1);
  assert.equal(tage('2024-01-01', '2024-12-31'), 366); // Schaltjahr
  assert.equal(tage('2023-01-01', '2023-12-31'), 365);
  assert.equal(tage('2024-12-31', '2024-01-01'), 0);
});

test('ueberschneidungTage bestimmt den Schnitt', () => {
  assert.equal(ueberschneidungTage('2024-01-01', '2024-06-30', '2024-04-01', '2024-12-31'), 91);
  assert.equal(ueberschneidungTage('2024-01-01', '2024-03-31', '2024-04-01', '2024-12-31'), 0);
});

test('plusMonate kappt am Monatsende', () => {
  assert.equal(plusMonate('2024-12-31', 12), '2025-12-31');
  assert.equal(plusMonate('2024-01-31', 1), '2024-02-29');
});

test('monateImZeitraum zählt angefangene Monate', () => {
  assert.equal(monateImZeitraum('2024-01-01', '2024-12-31'), 12);
  assert.equal(monateImZeitraum('2024-01-01', '2024-06-30'), 6);
  assert.equal(monateImZeitraum('2024-08-01', '2024-12-31'), 5);
});

test('dt formatiert deutsch', () => {
  assert.equal(dt('2024-03-07'), '07.03.2024');
});

// ---------------------------------------------------------------- Katalog

test('Katalog bildet § 2 BetrKV vollständig ab', () => {
  assert.equal(BETRIEBSKOSTEN.length, 17);
  const nummern = BETRIEBSKOSTEN.map((k) => k.nr);
  assert.deepEqual(nummern, Array.from({ length: 17 }, (_, i) => i + 1));
});

test('nicht umlagefähige Arten gelten nie als umlagefähig', () => {
  for (const n of NICHT_UMLAGEFAEHIG) {
    assert.equal(istUmlagefaehigeArt(n.id), false, `${n.id} darf nicht umlagefähig sein`);
    assert.equal(istUmlagefaehig({ kostenartId: n.id, umlagefaehig: true }), false);
  }
});

test('Heizkostenarten laufen nicht über die normale Umlage', () => {
  for (const artId of ['heizung', 'warmwasser', 'verbundene_anlage']) {
    assert.equal(istUmlagefaehig({ kostenartId: artId, umlagefaehig: true }), false);
  }
});

test('manueller Ausschluss überschreibt den Katalog', () => {
  assert.equal(istUmlagefaehig({ kostenartId: 'gartenpflege', umlagefaehig: true }), true);
  assert.equal(istUmlagefaehig({ kostenartId: 'gartenpflege', umlagefaehig: false }), false);
});

// ------------------------------------------------------------------- CO2

test('CO2-Stufenmodell trifft die Grenzwerte der Anlage zu § 5 CO2KostAufG', () => {
  assert.equal(stufeFuer(11.9).vermieter, 0);
  assert.equal(stufeFuer(12).vermieter, 0.1);
  assert.equal(stufeFuer(16.99).vermieter, 0.1);
  assert.equal(stufeFuer(17).vermieter, 0.2);
  assert.equal(stufeFuer(34).vermieter, 0.5);
  assert.equal(stufeFuer(51.99).vermieter, 0.8);
  assert.equal(stufeFuer(52).vermieter, 0.95);
  assert.equal(stufeFuer(200).vermieter, 0.95);
});

test('CO2-Kosten werden nach Stufe geteilt', () => {
  // 5.000 kg auf 250 m² = 20 kg/m² -> Stufe 3 -> 20 % Vermieter
  const r = teileCo2Kosten({ co2KostenCent: 100000, emissionKg: 5000, wohnflaeche: 250, tageZeitraum: 365 });
  assert.equal(r.stufe.stufe, 3);
  assert.equal(r.vermieterCent, 20000);
  assert.equal(r.mieterCent, 80000);
  assert.equal(r.vermieterCent + r.mieterCent, 100000);
});

test('CO2-Einstufung rechnet unterjährige Zeiträume aufs Jahr hoch', () => {
  // 2.500 kg auf 250 m² in 183 Tagen -> hochgerechnet 19,95 kg/m²·a -> Stufe 3
  const halbjahr = teileCo2Kosten({ co2KostenCent: 50000, emissionKg: 2500, wohnflaeche: 250, tageZeitraum: 183 });
  assert.ok(halbjahr.kgProM2 > 19.9 && halbjahr.kgProM2 < 20.0);
  assert.equal(halbjahr.stufe.stufe, 3);
  assert.equal(halbjahr.vermieterCent, 10000);

  // Derselbe Verbrauch ohne Hochrechnung läge in Stufe 1 – die Hochrechnung ist entscheidend
  const ohneHochrechnung = teileCo2Kosten({ co2KostenCent: 50000, emissionKg: 2500, wohnflaeche: 250, tageZeitraum: 365 });
  assert.equal(ohneHochrechnung.stufe.stufe, 1);
});

test('Nichtwohngebäude werden hälftig geteilt', () => {
  const r = teileCo2Kosten({ co2KostenCent: 100000, emissionKg: 9000, wohnflaeche: 250, gebaeudetyp: 'nichtwohn' });
  assert.equal(r.vermieterCent, 50000);
});

test('Ausnahme nach § 9 CO2KostAufG lässt den Vermieteranteil entfallen', () => {
  const r = teileCo2Kosten({ co2KostenCent: 100000, emissionKg: 20000, wohnflaeche: 250, ausnahme: true });
  assert.equal(r.vermieterCent, 0);
});

// -------------------------------------------------------------- HeizkostenV

test('Verbrauchsanteil nur zwischen 50 und 70 Prozent zulässig', () => {
  assert.equal(verbrauchsanteilZulaessig(0.5), true);
  assert.equal(verbrauchsanteilZulaessig(0.7), true);
  assert.equal(verbrauchsanteilZulaessig(0.6), true);
  assert.equal(verbrauchsanteilZulaessig(0.49), false);
  assert.equal(verbrauchsanteilZulaessig(0.71), false);
});

test('Warmwasserwärmemenge nach § 9 Abs. 2 HeizkostenV', () => {
  // Q [kWh] = 2,5 * V * (tw - 10)
  assert.equal(warmwasserWaermemengeKwh(100, 60), 12500);
  assert.equal(warmwasserWaermemengeKwh(0, 60), 0);
  assert.equal(warmwasserWaermemengeKwh(100, 10), 0);
});

test('Warmwasseranteil aus Brennstoffmenge und Heizwert', () => {
  const r = warmwasserAnteil({
    modus: 'formel',
    warmwasserVolumen: 200,
    temperatur: 60,
    brennstoffmenge: 25000,
    brennstoff: 'erdgas',
  });
  // Q_ww = 2,5*200*50 = 25.000 kWh; gesamt = 25.000 m³ * 10 kWh = 250.000 kWh
  assert.ok(Math.abs(r.anteil - 0.1) < 1e-9);
});

test('Heizkostenverteilung hält Grund- und Verbrauchsanteil ein', () => {
  const r = berechneHeizkosten({
    kosten: { brennstoff: 1000000, betriebsstrom: 0, wartung: 0, messdienst: 0 },
    verbunden: false,
    anteilVerbrauchHeizung: 0.7,
    verbrauchserfassung: true,
    tageZeitraum: 366,
    wohnflaecheGesamt: 200,
    nutzer: [
      { id: 'a', flaecheTage: 100 * 366, verbrauchHeizung: 1000, verbrauchWarmwasser: 0 },
      { id: 'b', flaecheTage: 100 * 366, verbrauchHeizung: 3000, verbrauchWarmwasser: 0 },
    ],
  });
  assert.equal(r.toepfe.heizVerbrauchTopf, 700000);
  assert.equal(r.toepfe.heizGrundTopf, 300000);
  // a: 150.000 Grund + 175.000 Verbrauch
  assert.equal(r.zeilen[0].heizGrund, 150000);
  assert.equal(r.zeilen[0].heizVerbrauch, 175000);
  assert.equal(r.zeilen[1].heizVerbrauch, 525000);
  assert.equal(r.summeVerteilt, 1000000);
});

test('§ 12 HeizkostenV: 15 Prozent Kürzung ohne Verbrauchserfassung', () => {
  const r = berechneHeizkosten({
    kosten: { brennstoff: 100000 },
    verbunden: false,
    anteilVerbrauchHeizung: 0.7,
    verbrauchserfassung: false,
    tageZeitraum: 365,
    wohnflaecheGesamt: 100,
    nutzer: [{ id: 'a', flaecheTage: 100 * 365, verbrauchHeizung: 0, verbrauchWarmwasser: 0 }],
  });
  assert.equal(r.zeilen[0].kuerzung15, 15000);
  assert.equal(r.zeilen[0].summe, 85000);
});

test('Leerstand erhält keine 15-Prozent-Kürzung', () => {
  const r = berechneHeizkosten({
    kosten: { brennstoff: 100000 },
    verbunden: false,
    anteilVerbrauchHeizung: 0.7,
    verbrauchserfassung: false,
    tageZeitraum: 365,
    wohnflaecheGesamt: 100,
    nutzer: [{ id: 'a', flaecheTage: 100 * 365, leerstand: true, verbrauchHeizung: 0, verbrauchWarmwasser: 0 }],
  });
  assert.equal(r.zeilen[0].kuerzung15, 0);
});

test('CO2-Vermieteranteil mindert die umlagefähigen Brennstoffkosten', () => {
  const r = berechneHeizkosten({
    kosten: { brennstoff: 1000000 },
    co2: { kostenCent: 100000, emissionKg: 5000 },
    verbunden: false,
    anteilVerbrauchHeizung: 0.5,
    verbrauchserfassung: true,
    tageZeitraum: 365,
    wohnflaecheGesamt: 250,
    nutzer: [{ id: 'a', flaecheTage: 250 * 365, verbrauchHeizung: 100, verbrauchWarmwasser: 0 }],
  });
  assert.equal(r.co2.vermieterCent, 20000);
  assert.equal(r.umlagefaehigeBrennstoffkosten, 980000);
  assert.equal(r.summeVerteilt, 980000);
});

// -------------------------------------------------------- Nutzungszeiträume

test('Mieterwechsel erzeugt Abschnitte samt Leerstandslücke', () => {
  const daten = demodaten();
  const bestand = bestandFuerObjekt(daten, 'o1');
  const n = bildeNutzeinheiten(bestand, { von: '2024-01-01', bis: '2024-12-31' });
  const e3 = n.filter((x) => x.einheitId === 'e3');
  assert.equal(e3.length, 3);
  assert.equal(e3[0].mieterName, 'Frau Costa');
  assert.equal(e3[0].bis, '2024-06-30');
  assert.equal(e3[1].leerstand, true);
  assert.equal(e3[1].von, '2024-07-01');
  assert.equal(e3[1].bis, '2024-07-31');
  assert.equal(e3[2].mieterName, 'Herr und Frau Delgado');
  assert.equal(summe(e3.map((x) => x.tage)), 366);
});

test('durchgehendes Mietverhältnis erzeugt genau einen Abschnitt', () => {
  const daten = demodaten();
  const bestand = bestandFuerObjekt(daten, 'o1');
  const n = bildeNutzeinheiten(bestand, { von: '2024-01-01', bis: '2024-12-31' });
  const e1 = n.filter((x) => x.einheitId === 'e1');
  assert.equal(e1.length, 1);
  assert.equal(e1[0].tage, 366);
});

test('Vorauszahlungen werden aus Monaten im Nutzungszeitraum gebildet', () => {
  const mv = { vzModus: 'monatlich', vzBetriebskostenMonat: 10000, vzHeizkostenMonat: 5000 };
  const r = berechneVorauszahlungen(mv, '2024-01-01', '2024-06-30');
  assert.equal(r.monate, 6);
  assert.equal(r.gesamt, 90000);
});

test('Vorauszahlungen können als Gesamtbetrag erfasst werden', () => {
  const mv = { vzModus: 'gesamt', vzGesamtBetriebskosten: 120000, vzGesamtHeizkosten: 60000 };
  const r = berechneVorauszahlungen(mv, '2024-01-01', '2024-12-31');
  assert.equal(r.gesamt, 180000);
});

// ------------------------------------------------------------- Verteilung

test('Flächenschlüssel verteilt zeitanteilig und vollständig', () => {
  const daten = demodaten();
  const zeitraum = { von: '2024-01-01', bis: '2024-12-31' };
  const nutz = bildeNutzeinheiten(bestandFuerObjekt(daten, 'o1'), zeitraum);
  const p = { ...neuePosition('grundsteuer', SCHLUESSEL.FLAECHE), betragBrutto: 100000 };
  const r = verteilePosition(p, nutz, { zeitraum });

  const verteilt = summe([...r.anteile.values()].map((a) => a.betrag));
  assert.ok(Math.abs(verteilt - 100000) <= 5, `verteilt=${verteilt}`);
  assert.ok(Math.abs(r.bezugGesamt - 250) < 0.01, `Bezugsgröße ${r.bezugGesamt}`);
});

test('Kosten eines Teilzeitraums treffen nur die dortigen Nutzer', () => {
  const daten = demodaten();
  const zeitraum = { von: '2024-01-01', bis: '2024-12-31' };
  const nutz = bildeNutzeinheiten(bestandFuerObjekt(daten, 'o1'), zeitraum);
  const p = {
    ...neuePosition('gartenpflege', SCHLUESSEL.FLAECHE),
    betragBrutto: 100000,
    zeitraumVon: '2024-09-01',
    zeitraumBis: '2024-12-31',
  };
  const r = verteilePosition(p, nutz, { zeitraum });

  const costa = nutz.find((n) => n.mieterName === 'Frau Costa');
  assert.equal(r.anteile.get(costa.key).betrag, 0);
  const delgado = nutz.find((n) => n.mieterName === 'Herr und Frau Delgado');
  assert.ok(r.anteile.get(delgado.key).betrag > 0);
});

test('Direktzuordnung belastet nur die gewählte Einheit', () => {
  const daten = demodaten();
  const zeitraum = { von: '2024-01-01', bis: '2024-12-31' };
  const nutz = bildeNutzeinheiten(bestandFuerObjekt(daten, 'o1'), zeitraum);
  const p = { ...neuePosition('sonstige', SCHLUESSEL.DIREKT), betragBrutto: 50000, direktEinheitId: 'e2' };
  const r = verteilePosition(p, nutz, { zeitraum });

  for (const n of nutz) {
    const a = r.anteile.get(n.key);
    if (n.einheitId === 'e2') assert.equal(a.betrag, 50000);
    else assert.equal(a, undefined);
  }
});

test('Wasserdifferenz wird als eigene, nachprüfbare Zeile ausgewiesen', () => {
  const daten = demodaten();
  const zeitraum = { von: '2024-01-01', bis: '2024-12-31' };
  const nutz = bildeNutzeinheiten(bestandFuerObjekt(daten, 'o1'), zeitraum);
  const verbraeuche = daten.abrechnungen[0].verbraeuche;
  const hauptzaehler = daten.abrechnungen[0].hauptzaehler.kaltwasser;
  const summeZaehler = summe(verbraeuche.filter((v) => v.art === 'kaltwasser').map((v) => v.wert));

  const p = { ...neuePosition('wasser', SCHLUESSEL.VERBRAUCH_WASSER), betragBrutto: 200000, verbrauchsart: 'kaltwasser' };
  const r = verteilePosition(p, nutz, {
    zeitraum,
    verbraeuche,
    hauptzaehler: { kaltwasser: hauptzaehler },
    verbrauchsdifferenz: 'flaeche',
  });

  // Die Verbrauchszeile bezieht sich auf die Summe der Wohnungszähler,
  // damit „Ihr Maßstab ÷ Gesamtmaßstab = Ihr Anteil" aufgeht.
  assert.equal(r.bezugGesamt, summeZaehler);
  for (const a of r.anteile.values()) {
    assert.ok(Math.abs(a.anteil - a.bezug / summeZaehler) < 1e-9);
  }

  const verbrauchsteil = summe([...r.anteile.values()].map((a) => a.betrag));
  const differenzteil = summe([...r.differenzInfo.anteile.values()].map((a) => a.betrag));

  assert.equal(r.differenzInfo.menge, hauptzaehler - summeZaehler);
  assert.ok(Math.abs(verbrauchsteil - 200000 * (summeZaehler / hauptzaehler)) < 200);
  assert.ok(Math.abs(verbrauchsteil + differenzteil - 200000) <= 10, `zusammen=${verbrauchsteil + differenzteil}`);
});

test('Wasserdifferenz zulasten des Vermieters bleibt beim Vermieter', () => {
  const daten = demodaten();
  const zeitraum = { von: '2024-01-01', bis: '2024-12-31' };
  const nutz = bildeNutzeinheiten(bestandFuerObjekt(daten, 'o1'), zeitraum);
  const verbraeuche = daten.abrechnungen[0].verbraeuche;
  const hauptzaehler = daten.abrechnungen[0].hauptzaehler.kaltwasser;
  const summeZaehler = summe(verbraeuche.filter((v) => v.art === 'kaltwasser').map((v) => v.wert));
  assert.ok(hauptzaehler > summeZaehler, 'Demodaten müssen eine Zählerdifferenz enthalten');

  const p = { ...neuePosition('wasser', SCHLUESSEL.VERBRAUCH_WASSER), betragBrutto: 200000, verbrauchsart: 'kaltwasser' };
  const r = verteilePosition(p, nutz, {
    zeitraum,
    verbraeuche,
    hauptzaehler: { kaltwasser: hauptzaehler },
    verbrauchsdifferenz: 'vermieter',
  });
  const verteilt = summe([...r.anteile.values()].map((a) => a.betrag));
  assert.ok(verteilt < 200000);
  assert.ok(Math.abs(verteilt - 200000 * (summeZaehler / hauptzaehler)) < 500);
});

// ------------------------------------------------------- Gesamtabrechnung

test('Gesamtabrechnung trennt umlagefähige von nicht umlagefähigen Kosten', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);

  assert.equal(r.positionenNichtUmlagefaehig.length, 3);
  const nichtIds = r.positionenNichtUmlagefaehig.map((p) => p.kostenartId).sort();
  assert.deepEqual(nichtIds, ['instandhaltung', 'sonstige_nicht', 'verwaltung']);

  // Keine nicht umlagefähige Position taucht bei einem Mieter auf
  for (const e of r.ergebnisse) {
    for (const p of e.posten) {
      assert.equal(istUmlagefaehigeArt(p.kostenartId), true, `${p.kostenartId} darf nicht umgelegt werden`);
    }
  }
});

test('Verwaltungs- und Instandhaltungskosten schlagen nie beim Mieter durch', () => {
  const daten = demodaten();
  const periode = daten.abrechnungen[0];
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);

  const erwartet = summe(
    periode.positionen.filter((p) => !istUmlagefaehig(p)).map((p) => p.betragBrutto)
  );
  assert.equal(r.vermieter.nichtUmlagefaehig, erwartet);
  assert.ok(erwartet > 0);

  const hauswart = periode.positionen.find((p) => p.kostenartId === 'hauswart');
  assert.equal(r.vermieter.abzuege, hauswart.abzugBetrag);
  assert.ok(hauswart.abzugBetrag > 0);
});

test('umgelegte Summe plus Vermieteranteile ergibt die Gesamtkosten', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);

  const rekonstruiert =
    r.summen.aufMieterUmgelegt +
    r.vermieter.leerstandsanteil +
    r.vermieter.nichtUmlagefaehig +
    r.vermieter.abzuege +
    r.vermieter.co2Anteil +
    r.vermieter.rundungsdifferenz;

  assert.ok(
    Math.abs(rekonstruiert - r.summen.gesamtkosten) < 200,
    `rekonstruiert=${rekonstruiert} gesamt=${r.summen.gesamtkosten}`
  );
});

test('jedes Mietverhältnis erhält ein nachvollziehbares Ergebnis', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);
  assert.equal(r.ergebnisse.length, 5);

  for (const e of r.ergebnisse) {
    assert.ok(e.posten.length > 0, `${e.mieterName} ohne Posten`);
    assert.equal(e.summeGesamt, summe(e.posten.map((p) => p.betrag)) + e.heizsumme);
    assert.equal(e.saldo, e.summeGesamt - e.vorauszahlungen.gesamt);
    assert.equal(e.nachzahlung > 0 ? e.guthaben : 0, 0);
    // Jeder Posten trägt Gesamtkosten, Schlüssel und Anteil - die vier BGH-Elemente
    for (const p of e.posten) {
      assert.ok(p.gesamtkosten >= 0);
      assert.ok(p.schluesselText);
      assert.ok(Number.isFinite(p.anteil));
    }
  }
});

test('jeder Posten ist für den Mieter nachrechenbar', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);

  for (const e of r.ergebnisse) {
    const ganzjaehrig = e.nutzungTage === r.tageZeitraum;
    for (const p of e.posten) {
      // Betrag = Gesamtkosten × Anteil
      assert.ok(
        Math.abs(p.betrag - p.gesamtkosten * p.anteil) <= 1,
        `${e.mieterName} / ${p.bezeichnung}: ${p.betrag} != ${p.gesamtkosten} × ${p.anteil}`
      );

      // Bei ganzjähriger Nutzung muss auch Maßstab ÷ Gesamtmaßstab aufgehen
      if (ganzjaehrig && p.bezugGesamt > 0 && p.schluessel !== SCHLUESSEL.DIREKT) {
        assert.ok(
          Math.abs(p.anteil - p.bezugAnteil / p.bezugGesamt) < 0.005,
          `${e.mieterName} / ${p.bezeichnung}: Anteil ${p.anteil} passt nicht zu ${p.bezugAnteil}/${p.bezugGesamt}`
        );
      }
    }
    assert.equal(e.summeBetriebskosten, summe(e.posten.map((p) => p.betrag)));
  }
});

test('unterjähriger Mieterwechsel führt zu zeitanteiligen Beträgen', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);
  const costa = r.ergebnisse.find((e) => e.mieterName === 'Frau Costa');
  const delgado = r.ergebnisse.find((e) => e.mieterName === 'Herr und Frau Delgado');

  assert.equal(costa.nutzungTage, 182); // 01.01. – 30.06.2024
  assert.equal(delgado.nutzungTage, 153); // 01.08. – 31.12.2024

  const gCosta = costa.posten.find((p) => p.kostenartId === 'grundsteuer');
  const gDelgado = delgado.posten.find((p) => p.kostenartId === 'grundsteuer');
  // Gleiche Wohnung, Beträge verhalten sich wie die Nutzungstage
  const quote = gCosta.betrag / gDelgado.betrag;
  assert.ok(Math.abs(quote - 182 / 153) < 0.02, `Quote ${quote}`);
});

test('Leerstandsanteil wird nicht auf Mieter umgelegt', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);
  assert.ok(r.vermieter.leerstandsanteil > 0);
  const summeMieter = summe(r.ergebnisse.map((e) => e.summeGesamt));
  assert.ok(summeMieter + r.vermieter.leerstandsanteil <= r.summen.umlagefaehig + 200);
});

test('§ 35a-Lohnanteile werden anteilig bescheinigt', () => {
  const daten = demodaten();
  const periode = daten.abrechnungen[0];
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);

  const erfasstHaushaltsnah = summe(periode.positionen.map((p) => p.lohnanteilHaushaltsnah || 0));
  const erfasstHandwerker = summe(periode.positionen.map((p) => p.lohnanteilHandwerker || 0));
  const bescheinigtHaushaltsnah = summe(r.ergebnisse.map((e) => e.paragraph35a.haushaltsnah));
  const bescheinigtHandwerker = summe(r.ergebnisse.map((e) => e.paragraph35a.handwerker));

  // Bescheinigt werden darf höchstens das, was erfasst wurde – der Leerstandsanteil bleibt beim Vermieter.
  assert.ok(bescheinigtHaushaltsnah > 0 && bescheinigtHaushaltsnah <= erfasstHaushaltsnah);
  assert.ok(bescheinigtHandwerker > 0 && bescheinigtHandwerker <= erfasstHandwerker);
});

test('Heizkosten fließen in jedes Mietverhältnis ein', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);
  for (const e of r.ergebnisse) assert.ok(e.heizsumme > 0, `${e.mieterName} ohne Heizkosten`);
  const summeHeiz = summe(r.ergebnisse.map((e) => e.heizsumme));
  assert.ok(summeHeiz <= r.heizung.gesamtUmlagefaehig);
});

// ------------------------------------------------------------------ Prüfung

test('Demodaten sind abrechnungsfähig', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0], r);
  assert.equal(p.abrechnungsfaehig, true, JSON.stringify(p.befunde.filter((b) => b.stufe === 'fehler'), null, 2));
});

test('Zeitraum über zwölf Monate wird als Fehler erkannt', () => {
  const daten = demodaten();
  const periode = { ...daten.abrechnungen[0], von: '2024-01-01', bis: '2025-03-31' };
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), periode, r);
  assert.ok(p.befunde.some((b) => b.stufe === 'fehler' && b.titel.includes('zwölf Monate')));
});

test('Versäumte Abrechnungsfrist sperrt Nachforderungen', () => {
  const daten = demodaten();
  const periode = { ...daten.abrechnungen[0], zugestelltAm: '2026-02-01' };
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), periode, r);
  assert.ok(p.befunde.some((b) => b.stufe === 'fehler' && b.titel === 'Abrechnungsfrist versäumt'));
});

test('Sonstige Betriebskosten ohne Vereinbarung sind ein Fehler', () => {
  const daten = demodaten();
  const periode = structuredClone(daten.abrechnungen[0]);
  periode.positionen.find((p) => p.kostenartId === 'sonstige').imMietvertragVereinbart = false;
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), periode, r);
  assert.ok(p.befunde.some((b) => b.stufe === 'fehler' && b.titel.includes('Sonstige Betriebskosten nicht vereinbart')));
});

test('Unzulässiger Verbrauchsanteil wird erkannt', () => {
  const daten = demodaten();
  const periode = structuredClone(daten.abrechnungen[0]);
  periode.heizung.anteilVerbrauchHeizung = 0.8;
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), periode, r);
  assert.ok(p.befunde.some((b) => b.stufe === 'fehler' && b.titel.includes('Verbrauchsanteil Heizung')));
});

test('Kabel-TV nach dem 30.06.2024 löst eine Warnung aus', () => {
  const daten = demodaten();
  const periode = structuredClone(daten.abrechnungen[0]);
  periode.positionen.push({ ...neuePosition('antenne_breitband', SCHLUESSEL.EINHEITEN), betragBrutto: 50000, bezeichnung: 'Kabelanschluss' });
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), periode, r);
  assert.ok(p.befunde.some((b) => b.stufe === 'warnung' && b.titel.includes('Breitband')));
});

test('Hauswart ohne Abzug löst eine Warnung aus', () => {
  const daten = demodaten();
  const periode = structuredClone(daten.abrechnungen[0]);
  periode.positionen.find((p) => p.kostenartId === 'hauswart').abzugBetrag = 0;
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), periode);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), periode, r);
  assert.ok(p.befunde.some((b) => b.stufe === 'warnung' && b.titel === 'Hauswartkosten ohne Abzug'));
});

test('Nutzerwechsel erzeugt Hinweis auf Zwischenablesung', () => {
  const daten = demodaten();
  const r = berechneAbrechnung(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0]);
  const p = pruefe(bestandFuerObjekt(daten, 'o1'), daten.abrechnungen[0], r);
  assert.ok(p.befunde.some((b) => b.titel.startsWith('Nutzerwechsel')));
});

// ------------------------------------------------------------------ Modell

test('migriere hebt eine Sicherung der Fassung 1 auf die Mehrobjektstruktur', () => {
  // Fassung 1 kannte genau einen Vermieter und ein Objekt.
  const alt = {
    vermieter: { name: 'Kim Spachmann', ort: 'Stuttgart' },
    objekt: { bezeichnung: 'Haus A', strasse: 'Weg 1', wohnflaecheGesamt: 120 },
    einheiten: [{ id: 'e1', bezeichnung: 'W1', wohnflaeche: 60 }],
    mietverhaeltnisse: [{ id: 'm1', einheitId: 'e1', mieterName: 'Frau A' }],
    abrechnungen: [{ id: 'a1', jahr: 2023, positionen: [{ id: 'p1', kostenartId: 'grundsteuer' }] }],
  };
  const neu = migriere(alt);

  assert.equal(neu.version, 2);
  assert.equal(neu.vermieter.length, 1);
  assert.equal(neu.vermieter[0].name, 'Kim Spachmann');
  assert.equal(neu.vermieter[0].rechtsform, 'privat');
  assert.equal(neu.objekte.length, 1);
  assert.equal(neu.objekte[0].bezeichnung, 'Haus A');
  assert.equal(neu.objekte[0].vermieterId, neu.vermieter[0].id);

  // Einheiten und Abrechnungen hängen danach am migrierten Objekt.
  assert.equal(neu.einheiten[0].objektId, neu.objekte[0].id);
  assert.equal(neu.abrechnungen[0].objektId, neu.objekte[0].id);

  // Fehlende Felder werden ergänzt.
  assert.equal(neu.abrechnungen[0].von, '2023-01-01');
  assert.equal(neu.abrechnungen[0].heizung.anteilVerbrauchHeizung, 0.7);
  assert.equal(neu.abrechnungen[0].positionen[0].abzugBetrag, 0);

  // Und der migrierte Bestand ist unmittelbar rechenbar.
  const bestand = bestandFuerObjekt(neu, neu.objekte[0].id);
  assert.equal(bestand.einheiten.length, 1);
  assert.equal(bestand.mietverhaeltnisse.length, 1);
  assert.equal(bestand.vermieter.name, 'Kim Spachmann');
});

test('migriere lässt eine Sicherung der Fassung 2 unverändert', () => {
  const original = demodaten();
  const neu = migriere(JSON.parse(JSON.stringify(original)));
  assert.equal(neu.vermieter.length, 2);
  assert.equal(neu.objekte.length, 4);
  assert.equal(neu.einheiten.length, original.einheiten.length);
  assert.deepEqual(neu.objekte.map((o) => o.id), original.objekte.map((o) => o.id));
});

test('migriere verträgt einen leeren Bestand', () => {
  const neu = migriere({});
  assert.deepEqual(neu, leererDatenbestand());
});

// ------------------------------------------------------- Mehrere Objekte

test('Beispielbestand enthält zwei Vermieter und vier Objekte', () => {
  const daten = demodaten();
  assert.equal(daten.vermieter.length, 2);
  assert.equal(daten.objekte.length, 4);
  assert.equal(objekteVon(daten, 'v1').length, 2); // privat
  assert.equal(objekteVon(daten, 'v2').length, 2); // GbR
  assert.equal(rechtsform(daten.vermieter[1].rechtsform).id, 'gbr');
});

test('jedes Objekt sieht ausschließlich seine eigenen Einheiten und Mieter', () => {
  const daten = demodaten();
  const alleEinheiten = new Set();
  const alleMieter = new Set();

  for (const o of daten.objekte) {
    const bestand = bestandFuerObjekt(daten, o.id);
    assert.equal(bestand.objekt.id, o.id);

    for (const e of bestand.einheiten) {
      assert.equal(e.objektId, o.id, `${e.bezeichnung} gehört zu einem anderen Objekt`);
      assert.ok(!alleEinheiten.has(e.id), 'Einheit taucht in zwei Objekten auf');
      alleEinheiten.add(e.id);
    }
    for (const m of bestand.mietverhaeltnisse) {
      assert.ok(bestand.einheiten.some((e) => e.id === m.einheitId));
      assert.ok(!alleMieter.has(m.id), 'Mietverhältnis taucht in zwei Objekten auf');
      alleMieter.add(m.id);
    }
  }

  // Es geht nichts verloren.
  assert.equal(alleEinheiten.size, daten.einheiten.length);
  assert.equal(alleMieter.size, daten.mietverhaeltnisse.length);
});

test('Kosten eines Objekts wirken sich nicht auf andere Objekte aus', () => {
  const daten = demodaten();
  const vorher = daten.objekte.map((o) => {
    const b = bestandFuerObjekt(daten, o.id);
    return berechneAbrechnung(b, abrechnungenVon(daten, o.id)[0]).summen.aufMieterUmgelegt;
  });

  // Im ersten Objekt eine große Position ergänzen
  abrechnungenVon(daten, 'o1')[0].positionen.push({
    ...neuePosition('gartenpflege', SCHLUESSEL.FLAECHE),
    betragBrutto: 500000,
  });

  const nachher = daten.objekte.map((o) => {
    const b = bestandFuerObjekt(daten, o.id);
    return berechneAbrechnung(b, abrechnungenVon(daten, o.id)[0]).summen.aufMieterUmgelegt;
  });

  assert.ok(nachher[0] > vorher[0], 'Objekt 1 muss teurer werden');
  assert.deepEqual(nachher.slice(1), vorher.slice(1), 'die übrigen Objekte dürfen sich nicht ändern');
});

test('jedes Objekt des Beispielbestands ist abrechnungsfähig', () => {
  const daten = demodaten();
  for (const o of daten.objekte) {
    const bestand = bestandFuerObjekt(daten, o.id);
    const periode = abrechnungenVon(daten, o.id)[0];
    assert.ok(periode, `${o.bezeichnung} ohne Abrechnungszeitraum`);

    const r = berechneAbrechnung(bestand, periode);
    const pr = pruefe(bestand, periode, r);
    assert.ok(
      pr.abrechnungsfaehig,
      `${o.bezeichnung}: ${pr.befunde.filter((b) => b.stufe === 'fehler').map((b) => b.titel).join(' | ')}`
    );
    assert.equal(r.ergebnisse.length, bestand.mietverhaeltnisse.length);
    assert.ok(r.summen.umlagefaehig > 0);
  }
});

test('jedes Mieterdokument nennt den Vermieter des jeweiligen Objekts', () => {
  const daten = demodaten();
  for (const o of daten.objekte) {
    const bestand = bestandFuerObjekt(daten, o.id);
    const r = berechneAbrechnung(bestand, abrechnungenVon(daten, o.id)[0]);
    assert.equal(bestand.vermieter.id, o.vermieterId);
    assert.ok(bestand.vermieter.name.length > 0);
  }
});

test('fehlende Vertretung einer GbR wird bemängelt', () => {
  const daten = demodaten();
  const gbr = daten.vermieter.find((v) => v.rechtsform === 'gbr');
  const objekt = objekteVon(daten, gbr.id)[0];
  const periode = abrechnungenVon(daten, objekt.id)[0];

  // Mit Vertretung: kein Befund
  let bestand = bestandFuerObjekt(daten, objekt.id);
  let pr = pruefe(bestand, periode, berechneAbrechnung(bestand, periode));
  assert.ok(!pr.befunde.some((b) => b.titel.includes('Vertretung')));

  // Ohne Vertretung: Warnung
  gbr.vertretenDurch = '';
  bestand = bestandFuerObjekt(daten, objekt.id);
  pr = pruefe(bestand, periode, berechneAbrechnung(bestand, periode));
  assert.ok(pr.befunde.some((b) => b.stufe === 'warnung' && b.titel.includes('Vertretung')));
});

test('Hilfsfunktionen liefern die Zuordnung je Objekt', () => {
  const daten = demodaten();
  assert.equal(einheitenVon(daten, 'o1').length, 4);
  assert.equal(einheitenVon(daten, 'o2').length, 2);
  assert.equal(mietverhaeltnisseVon(daten, 'o1').length, 5);
  assert.equal(mietverhaeltnisseVon(daten, 'o3').length, 3);
  assert.equal(abrechnungenVon(daten, 'o4').length, 1);
  assert.equal(bestandFuerObjekt(daten, 'gibtesnicht'), null);
});
