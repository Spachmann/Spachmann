import XCTest
@testable import NebenkostenKern

/// Prüft den Rechenkern gegen die Referenzwerte der bereits verifizierten
/// Web-Fassung. Beide Implementierungen rechnen mit demselben Beispieldatensatz;
/// weicht die Portierung ab, schlagen diese Tests fehl.
final class GeldTests: XCTestCase {

    func testParseVerstehtDeutscheUndEnglischeSchreibweisen() {
        XCTAssertEqual(Geld.parse("1.234,56"), 123456)
        XCTAssertEqual(Geld.parse("1234,56"), 123456)
        XCTAssertEqual(Geld.parse("1234.56"), 123456)
        XCTAssertEqual(Geld.parse("1.234"), 123400)
        XCTAssertEqual(Geld.parse("12.34"), 1234)
        XCTAssertEqual(Geld.parse("1.234.567,89"), 123456789)
        XCTAssertEqual(Geld.parse("89,90 €"), 8990)
        XCTAssertEqual(Geld.parse("-45,10"), -4510)
        XCTAssertEqual(Geld.parse(""), 0)
        XCTAssertEqual(Geld.parse("abc"), 0)
    }

    func testParseZahlLiefertDezimalwerte() {
        XCTAssertEqual(Geld.parseZahl("62,5"), 62.5)
        XCTAssertEqual(Geld.parseZahl("1.234,5"), 1234.5)
        XCTAssertEqual(Geld.parseZahl(""), 0)
    }

    func testRundeRundetVonDerNullWeg() {
        XCTAssertEqual(Geld.runde(0.5), 1)
        XCTAssertEqual(Geld.runde(-0.5), -1)
        XCTAssertEqual(Geld.runde(2.4), 2)
    }

    func testAnteilRundetAufCent() {
        XCTAssertEqual(Geld.anteil(von: 10000, 1.0 / 3.0), 3333)
        XCTAssertEqual(Geld.anteil(von: 10000, 0), 0)
    }

    func testEuroFormatiertDeutsch() {
        XCTAssertTrue(Geld.euro(123456).contains("1.234,56"))
    }
}

final class DatumTests: XCTestCase {

    func testTageZaehltBeideRandtage() {
        XCTAssertEqual(Datum.tage("2024-01-01", "2024-01-01"), 1)
        XCTAssertEqual(Datum.tage("2024-01-01", "2024-12-31"), 366)   // Schaltjahr
        XCTAssertEqual(Datum.tage("2023-01-01", "2023-12-31"), 365)
        XCTAssertEqual(Datum.tage("2024-12-31", "2024-01-01"), 0)
    }

    func testHinUndRueckwandlungIstVerlustfrei() {
        for iso in ["1970-01-01", "1999-12-31", "2000-02-29", "2024-02-29", "2100-03-01"] {
            let nummer = Datum.tagesnummer(iso)
            XCTAssertNotNil(nummer, iso)
            XCTAssertEqual(Datum.iso(nummer!), iso)
        }
    }

    func testUeberschneidungBestimmtDenSchnitt() {
        XCTAssertEqual(Datum.ueberschneidungTage("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31"), 91)
        XCTAssertEqual(Datum.ueberschneidungTage("2024-01-01", "2024-03-31", "2024-04-01", "2024-12-31"), 0)
    }

    func testPlusMonateKapptAmMonatsende() {
        XCTAssertEqual(Datum.plusMonate("2024-12-31", 12), "2025-12-31")
        XCTAssertEqual(Datum.plusMonate("2024-01-31", 1), "2024-02-29")
        XCTAssertEqual(Datum.plusMonate("2023-01-31", 1), "2023-02-28")
    }

    func testMonateImZeitraumZaehltAngefangeneMonate() {
        XCTAssertEqual(Datum.monateImZeitraum("2024-01-01", "2024-12-31"), 12)
        XCTAssertEqual(Datum.monateImZeitraum("2024-01-01", "2024-06-30"), 6)
        XCTAssertEqual(Datum.monateImZeitraum("2024-08-01", "2024-12-31"), 5)
    }

    func testDeutscheDarstellung() {
        XCTAssertEqual(Datum.deutsch("2024-03-07"), "07.03.2024")
    }
}

final class KatalogTests: XCTestCase {

    func testKatalogBildetParagraf2BetrKVVollstaendigAb() {
        XCTAssertEqual(Katalog.betriebskosten.count, 17)
        XCTAssertEqual(Katalog.betriebskosten.compactMap(\.nr), Array(1...17))
    }

    func testNichtUmlagefaehigeArtenGeltenNieAlsUmlagefaehig() {
        for art in Katalog.nichtUmlagefaehig {
            XCTAssertFalse(Katalog.istUmlagefaehigeArt(art.id), art.id)
            var position = Position(kostenartId: art.id)
            position.umlagefaehig = true
            XCTAssertFalse(position.istUmlagefaehig, art.id)
        }
    }

    func testHeizkostenartenLaufenNichtUeberDieNormaleUmlage() {
        for id in ["heizung", "warmwasser", "verbundene_anlage"] {
            var position = Position(kostenartId: id)
            position.umlagefaehig = true
            XCTAssertFalse(position.istUmlagefaehig, id)
        }
    }

    func testManuellerAusschlussUeberschreibtDenKatalog() {
        var position = Position(kostenartId: "gartenpflege")
        XCTAssertTrue(position.istUmlagefaehig)
        position.umlagefaehig = false
        XCTAssertFalse(position.istUmlagefaehig)
    }
}

final class CO2Tests: XCTestCase {

    func testStufenmodellTrifftDieGrenzwerte() {
        XCTAssertEqual(CO2.stufe(fuer: 11.9).vermieter, 0.0)
        XCTAssertEqual(CO2.stufe(fuer: 12).vermieter, 0.1)
        XCTAssertEqual(CO2.stufe(fuer: 16.99).vermieter, 0.1)
        XCTAssertEqual(CO2.stufe(fuer: 17).vermieter, 0.2)
        XCTAssertEqual(CO2.stufe(fuer: 34).vermieter, 0.5)
        XCTAssertEqual(CO2.stufe(fuer: 51.99).vermieter, 0.8)
        XCTAssertEqual(CO2.stufe(fuer: 52).vermieter, 0.95)
        XCTAssertEqual(CO2.stufe(fuer: 200).vermieter, 0.95)
    }

    func testKostenWerdenNachStufeGeteilt() {
        // 5.000 kg auf 250 m² = 20 kg/m² → Stufe 3 → 20 % Vermieter
        let ergebnis = CO2.teile(kostenGesamt: 100_000, emissionKg: 5000, wohnflaeche: 250, tageZeitraum: 365)
        XCTAssertEqual(ergebnis.stufe?.nummer, 3)
        XCTAssertEqual(ergebnis.vermieterCent, 20_000)
        XCTAssertEqual(ergebnis.mieterCent, 80_000)
        XCTAssertEqual(ergebnis.vermieterCent + ergebnis.mieterCent, 100_000)
    }

    func testUnterjaehrigeZeitraeumeWerdenAufsJahrHochgerechnet() {
        let halbjahr = CO2.teile(kostenGesamt: 50_000, emissionKg: 2500, wohnflaeche: 250, tageZeitraum: 183)
        XCTAssertGreaterThan(halbjahr.kgProM2, 19.9)
        XCTAssertLessThan(halbjahr.kgProM2, 20.0)
        XCTAssertEqual(halbjahr.stufe?.nummer, 3)

        let ganzjahr = CO2.teile(kostenGesamt: 50_000, emissionKg: 2500, wohnflaeche: 250, tageZeitraum: 365)
        XCTAssertEqual(ganzjahr.stufe?.nummer, 1)
    }

    func testNichtwohngebaeudeWerdenHaelftigGeteilt() {
        let ergebnis = CO2.teile(kostenGesamt: 100_000, emissionKg: 9000, wohnflaeche: 250, gebaeudetyp: .nichtwohn)
        XCTAssertEqual(ergebnis.vermieterCent, 50_000)
    }

    func testAusnahmeLaesstDenVermieteranteilEntfallen() {
        let ergebnis = CO2.teile(kostenGesamt: 100_000, emissionKg: 20000, wohnflaeche: 250, ausnahme: true)
        XCTAssertEqual(ergebnis.vermieterCent, 0)
    }
}

final class HeizkostenTests: XCTestCase {

    func testVerbrauchsanteilNurZwischen50Und70Prozent() {
        XCTAssertTrue(Heizkosten.verbrauchsanteilZulaessig(0.5))
        XCTAssertTrue(Heizkosten.verbrauchsanteilZulaessig(0.6))
        XCTAssertTrue(Heizkosten.verbrauchsanteilZulaessig(0.7))
        XCTAssertFalse(Heizkosten.verbrauchsanteilZulaessig(0.49))
        XCTAssertFalse(Heizkosten.verbrauchsanteilZulaessig(0.71))
    }

    func testWarmwasserwaermemengeNachParagraf9() {
        // Q [kWh] = 2,5 · V · (tw − 10)
        XCTAssertEqual(Heizkosten.warmwasserWaermemengeKwh(volumenM3: 100, temperaturC: 60), 12500)
        XCTAssertEqual(Heizkosten.warmwasserWaermemengeKwh(volumenM3: 0, temperaturC: 60), 0)
        XCTAssertEqual(Heizkosten.warmwasserWaermemengeKwh(volumenM3: 100, temperaturC: 10), 0)
    }

    func testWarmwasseranteilAusBrennstoffmengeUndHeizwert() {
        var eingaben = Heizkosten.Warmwassereingaben()
        eingaben.methode = .formel
        eingaben.volumen = 200
        eingaben.temperatur = 60
        eingaben.brennstoffmenge = 25000
        eingaben.brennstoff = .erdgas
        // Q = 2,5 · 200 · 50 = 25.000 kWh von 250.000 kWh = 10 %
        XCTAssertEqual(Heizkosten.warmwasseranteil(eingaben).anteil, 0.1, accuracy: 1e-9)
    }

    func testVerteilungHaeltGrundUndVerbrauchsanteilEin() {
        var eingaben = Heizkosten.Eingaben()
        eingaben.kosten.brennstoff = 1_000_000
        eingaben.verbunden = false
        eingaben.anteilVerbrauchHeizung = 0.7
        eingaben.tageZeitraum = 366
        eingaben.wohnflaecheGesamt = 200
        eingaben.nutzer = [
            Heizkosten.Nutzer(id: "a", bezeichnung: "A", flaecheTage: 100 * 366, verbrauchHeizung: 1000),
            Heizkosten.Nutzer(id: "b", bezeichnung: "B", flaecheTage: 100 * 366, verbrauchHeizung: 3000),
        ]

        let ergebnis = Heizkosten.berechne(eingaben)
        XCTAssertEqual(ergebnis.toepfe.heizVerbrauch, 700_000)
        XCTAssertEqual(ergebnis.toepfe.heizGrund, 300_000)
        XCTAssertEqual(ergebnis.zeilen[0].heizGrund, 150_000)
        XCTAssertEqual(ergebnis.zeilen[0].heizVerbrauch, 175_000)
        XCTAssertEqual(ergebnis.zeilen[1].heizVerbrauch, 525_000)
        XCTAssertEqual(ergebnis.summeVerteilt, 1_000_000)
    }

    func testKuerzungUm15ProzentOhneVerbrauchserfassung() {
        var eingaben = Heizkosten.Eingaben()
        eingaben.kosten.brennstoff = 100_000
        eingaben.verbunden = false
        eingaben.verbrauchserfassung = false
        eingaben.tageZeitraum = 365
        eingaben.wohnflaecheGesamt = 100
        eingaben.nutzer = [Heizkosten.Nutzer(id: "a", bezeichnung: "A", flaecheTage: 100 * 365)]

        let ergebnis = Heizkosten.berechne(eingaben)
        XCTAssertEqual(ergebnis.zeilen[0].kuerzung15, 15_000)
        XCTAssertEqual(ergebnis.zeilen[0].summe, 85_000)
    }

    func testLeerstandErhaeltKeineKuerzung() {
        var eingaben = Heizkosten.Eingaben()
        eingaben.kosten.brennstoff = 100_000
        eingaben.verbunden = false
        eingaben.verbrauchserfassung = false
        eingaben.tageZeitraum = 365
        eingaben.wohnflaecheGesamt = 100
        eingaben.nutzer = [Heizkosten.Nutzer(id: "a", bezeichnung: "A", leerstand: true, flaecheTage: 100 * 365)]

        XCTAssertEqual(Heizkosten.berechne(eingaben).zeilen[0].kuerzung15, 0)
    }

    func testCO2VermieteranteilMindertDieUmlagefaehigenBrennstoffkosten() {
        var eingaben = Heizkosten.Eingaben()
        eingaben.kosten.brennstoff = 1_000_000
        eingaben.co2Kosten = 100_000
        eingaben.co2EmissionKg = 5000
        eingaben.verbunden = false
        eingaben.anteilVerbrauchHeizung = 0.5
        eingaben.tageZeitraum = 365
        eingaben.wohnflaecheGesamt = 250
        eingaben.nutzer = [Heizkosten.Nutzer(id: "a", bezeichnung: "A", flaecheTage: 250 * 365, verbrauchHeizung: 100)]

        let ergebnis = Heizkosten.berechne(eingaben)
        XCTAssertEqual(ergebnis.co2.vermieterCent, 20_000)
        XCTAssertEqual(ergebnis.umlagefaehigeBrennstoffkosten, 980_000)
        XCTAssertEqual(ergebnis.summeVerteilt, 980_000)
    }
}

final class NutzungszeitraumTests: XCTestCase {

    private let daten = Demodaten.erzeuge()

    func testMieterwechselErzeugtAbschnitteSamtLeerstandsluecke() {
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: "2024-01-01", bis: "2024-12-31")
        let e3 = nutzeinheiten.filter { $0.einheitId == "e3" }

        XCTAssertEqual(e3.count, 3)
        XCTAssertEqual(e3[0].mieterName, "Frau Costa")
        XCTAssertEqual(e3[0].bis, "2024-06-30")
        XCTAssertTrue(e3[1].leerstand)
        XCTAssertEqual(e3[1].von, "2024-07-01")
        XCTAssertEqual(e3[1].bis, "2024-07-31")
        XCTAssertEqual(e3[2].mieterName, "Herr und Frau Delgado")
        XCTAssertEqual(e3.map(\.tage).reduce(0, +), 366)
    }

    func testDurchgehendesMietverhaeltnisErzeugtEinenAbschnitt() {
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: "2024-01-01", bis: "2024-12-31")
        let e1 = nutzeinheiten.filter { $0.einheitId == "e1" }
        XCTAssertEqual(e1.count, 1)
        XCTAssertEqual(e1[0].tage, 366)
    }

    func testVorauszahlungenAusMonatenImNutzungszeitraum() {
        var mv = Mietverhaeltnis()
        mv.vzModus = .monatlich
        mv.vzBetriebskostenMonat = 10_000
        mv.vzHeizkostenMonat = 5_000
        let ergebnis = Abrechnung.berechneVorauszahlungen(mv, von: "2024-01-01", bis: "2024-06-30")
        XCTAssertEqual(ergebnis.monate, 6)
        XCTAssertEqual(ergebnis.gesamt, 90_000)
    }

    func testVorauszahlungenAlsGesamtbetrag() {
        var mv = Mietverhaeltnis()
        mv.vzModus = .gesamt
        mv.vzGesamtBetriebskosten = 120_000
        mv.vzGesamtHeizkosten = 60_000
        XCTAssertEqual(Abrechnung.berechneVorauszahlungen(mv, von: "2024-01-01", bis: "2024-12-31").gesamt, 180_000)
    }
}

final class VerteilungTests: XCTestCase {

    private let daten = Demodaten.erzeuge()

    private func kontext(_ periode: Abrechnungszeitraum, differenz: Verbrauchsdifferenz) -> Abrechnung.Verteilungskontext {
        Abrechnung.Verteilungskontext(
            von: periode.von, bis: periode.bis,
            verbraeuche: periode.verbraeuche,
            hauptzaehler: periode.hauptzaehler,
            verbrauchsdifferenz: differenz)
    }

    func testFlaechenschluesselVerteiltZeitanteiligUndVollstaendig() {
        let periode = daten.abrechnungen[0]
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: periode.von, bis: periode.bis)
        let position = Position(kostenartId: "grundsteuer", schluessel: .flaeche, betragBrutto: 100_000)
        let verteilung = Abrechnung.verteile(position, auf: nutzeinheiten, kontext: kontext(periode, differenz: .flaeche))

        let verteilt = verteilung.anteile.values.map(\.betrag).summe
        XCTAssertEqual(Double(verteilt), 100_000, accuracy: 5)
        XCTAssertEqual(verteilung.bezugGesamt, 250, accuracy: 0.01)
    }

    func testKostenEinesTeilzeitraumsTreffenNurDieDortigenNutzer() {
        let periode = daten.abrechnungen[0]
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: periode.von, bis: periode.bis)
        var position = Position(kostenartId: "gartenpflege", schluessel: .flaeche, betragBrutto: 100_000)
        position.zeitraumVon = "2024-09-01"
        position.zeitraumBis = "2024-12-31"

        let verteilung = Abrechnung.verteile(position, auf: nutzeinheiten, kontext: kontext(periode, differenz: .flaeche))

        let costa = nutzeinheiten.first { $0.mieterName == "Frau Costa" }!
        let delgado = nutzeinheiten.first { $0.mieterName == "Herr und Frau Delgado" }!
        XCTAssertEqual(verteilung.anteile[costa.id]?.betrag, 0)
        XCTAssertGreaterThan(verteilung.anteile[delgado.id]?.betrag ?? 0, 0)
    }

    func testDirektzuordnungBelastetNurDieGewaehlteEinheit() {
        let periode = daten.abrechnungen[0]
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: periode.von, bis: periode.bis)
        var position = Position(kostenartId: "sonstige", schluessel: .direkt, betragBrutto: 50_000)
        position.direktEinheitId = "e2"

        let verteilung = Abrechnung.verteile(position, auf: nutzeinheiten, kontext: kontext(periode, differenz: .flaeche))

        for n in nutzeinheiten {
            if n.einheitId == "e2" {
                XCTAssertEqual(verteilung.anteile[n.id]?.betrag, 50_000)
            } else {
                XCTAssertNil(verteilung.anteile[n.id])
            }
        }
    }

    func testZaehlerdifferenzWirdAlsEigeneNachpruefbareZeileAusgewiesen() {
        let periode = daten.abrechnungen[0]
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: periode.von, bis: periode.bis)
        let summeZaehler = periode.verbraeuche.filter { $0.art == .kaltwasser }.map(\.wert).summe
        let hauptzaehler = periode.hauptzaehler.kaltwasser
        XCTAssertGreaterThan(hauptzaehler, summeZaehler, "Demodaten müssen eine Zählerdifferenz enthalten")

        var position = Position(kostenartId: "wasser", schluessel: .verbrauchWasser, betragBrutto: 200_000)
        position.verbrauchsart = .kaltwasser
        let verteilung = Abrechnung.verteile(position, auf: nutzeinheiten, kontext: kontext(periode, differenz: .flaeche))

        // Die Verbrauchszeile bezieht sich auf die Summe der Wohnungszähler,
        // damit „Ihr Maßstab ÷ Gesamtmaßstab = Ihr Anteil" aufgeht.
        XCTAssertEqual(verteilung.bezugGesamt, summeZaehler)
        for anteil in verteilung.anteile.values {
            XCTAssertEqual(anteil.anteil, anteil.bezug / summeZaehler, accuracy: 1e-9)
        }

        let verbrauchsteil = verteilung.anteile.values.map(\.betrag).summe
        let differenzteil = (verteilung.differenzInfo?.anteile?.values.map(\.betrag).summe) ?? 0
        XCTAssertEqual(verteilung.differenzInfo?.menge, hauptzaehler - summeZaehler)
        XCTAssertEqual(Double(verbrauchsteil), 200_000 * (summeZaehler / hauptzaehler), accuracy: 200)
        XCTAssertEqual(Double(verbrauchsteil + differenzteil), 200_000, accuracy: 10)
    }

    func testZaehlerdifferenzZulastenDesVermietersBleibtBeimVermieter() {
        let periode = daten.abrechnungen[0]
        let nutzeinheiten = Abrechnung.bildeNutzeinheiten(daten, von: periode.von, bis: periode.bis)
        let summeZaehler = periode.verbraeuche.filter { $0.art == .kaltwasser }.map(\.wert).summe
        let hauptzaehler = periode.hauptzaehler.kaltwasser

        var position = Position(kostenartId: "wasser", schluessel: .verbrauchWasser, betragBrutto: 200_000)
        position.verbrauchsart = .kaltwasser
        let verteilung = Abrechnung.verteile(position, auf: nutzeinheiten, kontext: kontext(periode, differenz: .vermieter))

        let verteilt = verteilung.anteile.values.map(\.betrag).summe
        XCTAssertLessThan(verteilt, 200_000)
        XCTAssertGreaterThan(verteilung.vermieterTraegt, 0)
        XCTAssertEqual(Double(verteilt), 200_000 * (summeZaehler / hauptzaehler), accuracy: 200)
    }
}

/// Referenzwerte aus der Web-Fassung – jede Abweichung zeigt einen
/// Portierungsfehler an.
final class GesamtabrechnungTests: XCTestCase {

    private let daten = Demodaten.erzeuge()
    private var periode: Abrechnungszeitraum { daten.abrechnungen[0] }
    private lazy var ergebnis = Abrechnung.berechne(daten, periode)

    private func mieter(_ name: String) -> Abrechnung.Mieterergebnis {
        ergebnis.ergebnisse.first { $0.mieterName == name }!
    }

    func testSummenEntsprechenDerReferenz() {
        XCTAssertEqual(ergebnis.tageZeitraum, 366)
        XCTAssertEqual(ergebnis.summen.gesamtkosten, 2_247_800)
        XCTAssertEqual(ergebnis.summen.umlagefaehig, 1_539_200)
        XCTAssertEqual(ergebnis.summen.nichtUmlagefaehig, 689_600)
        XCTAssertEqual(ergebnis.summen.aufMieterUmgelegt, 1_516_799)
    }

    func testVermieteranteileEntsprechenDerReferenz() {
        XCTAssertEqual(ergebnis.vermieter.leerstandsanteil, 22_406)
        XCTAssertEqual(ergebnis.vermieter.nichtUmlagefaehig, 660_800)
        XCTAssertEqual(ergebnis.vermieter.abzuege, 28_800)
        XCTAssertEqual(ergebnis.vermieter.co2Anteil, 19_000)
        XCTAssertEqual(ergebnis.vermieter.rundungsdifferenz, -5)
        XCTAssertEqual(ergebnis.vermieter.gesamtbelastung, 731_006)
    }

    func testHeizkostenEntsprechenDerReferenz() {
        let heizung = ergebnis.heizung!
        XCTAssertEqual(heizung.gesamtUmlagefaehig, 611_500)
        XCTAssertEqual(heizung.kostenHeizung, 444_065)
        XCTAssertEqual(heizung.kostenWarmwasser, 167_435)
        XCTAssertEqual(heizung.warmwasserAufteilung.warmwasserKwh, 11_500, accuracy: 0.001)
        XCTAssertEqual(heizung.warmwasserAufteilung.gesamtwaermeKwh, 42_000, accuracy: 0.001)
        XCTAssertEqual(heizung.warmwasserAufteilung.anteil, 11_500.0 / 42_000.0, accuracy: 1e-9)
        XCTAssertEqual(heizung.co2.stufe?.nummer, 6)
        XCTAssertEqual(heizung.co2.kgProM2, 33.6757, accuracy: 0.001)
        XCTAssertEqual(heizung.toepfe.heizGrund, 133_219)
        XCTAssertEqual(heizung.toepfe.heizVerbrauch, 310_846)
        XCTAssertEqual(heizung.toepfe.wwGrund, 50_231)
        XCTAssertEqual(heizung.toepfe.wwVerbrauch, 117_204)
        XCTAssertEqual(heizung.bezug.flaecheTageGesamt, 91_500, accuracy: 0.001)
        XCTAssertEqual(heizung.bezug.verbrauchHeizungGesamt, 5_390, accuracy: 0.001)
        XCTAssertEqual(heizung.bezug.verbrauchWarmwasserGesamt, 92, accuracy: 0.001)
        XCTAssertEqual(heizung.summeVerteilt, 611_503)
    }

    func testErgebnisseJeMietverhaeltnisEntsprechenDerReferenz() {
        struct Referenz {
            let name: String, tage: Int, bk: Cent, heiz: Cent, ges: Cent, vz: Cent, saldo: Cent
            let haushaltsnah: Cent, handwerker: Cent
        }
        let referenzen = [
            Referenz(name: "Familie Aydin", tage: 366, bk: 254_714, heiz: 171_071, ges: 425_785, vz: 414_000, saldo: 11_785, haushaltsnah: 67_000, handwerker: 6_500),
            Referenz(name: "Herr Bernhardt", tage: 366, bk: 191_395, heiz: 125_900, ges: 317_295, vz: 324_000, saldo: -6_705, haushaltsnah: 62_176, handwerker: 6_032),
            Referenz(name: "Frau Costa", tage: 182, bk: 142_880, heiz: 97_957, ges: 240_837, vz: 243_000, saldo: -2_163, haushaltsnah: 39_714, handwerker: 3_853),
            Referenz(name: "Herr und Frau Delgado", tage: 153, bk: 113_531, heiz: 80_697, ges: 194_228, vz: 210_000, saldo: -15_772, haushaltsnah: 33_386, handwerker: 3_239),
            Referenz(name: "Frau Eberhardt", tage: 366, bk: 207_407, heiz: 131_247, ges: 338_654, vz: 354_000, saldo: -15_346, haushaltsnah: 58_960, handwerker: 5_720),
        ]

        XCTAssertEqual(ergebnis.ergebnisse.count, referenzen.count)
        for referenz in referenzen {
            let eintrag = mieter(referenz.name)
            XCTAssertEqual(eintrag.nutzungTage, referenz.tage, referenz.name)
            XCTAssertEqual(eintrag.summeBetriebskosten, referenz.bk, referenz.name)
            XCTAssertEqual(eintrag.heizsumme, referenz.heiz, referenz.name)
            XCTAssertEqual(eintrag.summeGesamt, referenz.ges, referenz.name)
            XCTAssertEqual(eintrag.vorauszahlungen.gesamt, referenz.vz, referenz.name)
            XCTAssertEqual(eintrag.saldo, referenz.saldo, referenz.name)
            XCTAssertEqual(eintrag.paragraph35a.haushaltsnah, referenz.haushaltsnah, referenz.name)
            XCTAssertEqual(eintrag.paragraph35a.handwerker, referenz.handwerker, referenz.name)
            XCTAssertEqual(eintrag.posten.count, 13, referenz.name)
        }
    }

    func testTrennungUmlagefaehigVonNichtUmlagefaehig() {
        XCTAssertEqual(ergebnis.positionenNichtUmlagefaehig.count, 3)
        XCTAssertEqual(Set(ergebnis.positionenNichtUmlagefaehig.map(\.kostenartId)),
                       ["verwaltung", "instandhaltung", "sonstige_nicht"])

        // Keine nicht umlagefähige Kostenart darf bei einem Mieter auftauchen.
        for eintrag in ergebnis.ergebnisse {
            for posten in eintrag.posten {
                XCTAssertTrue(Katalog.istUmlagefaehigeArt(posten.kostenartId),
                              "\(posten.kostenartId) darf nicht umgelegt werden")
            }
        }
    }

    func testJederPostenIstFuerDenMieterNachrechenbar() {
        for eintrag in ergebnis.ergebnisse {
            let ganzjaehrig = eintrag.nutzungTage == ergebnis.tageZeitraum
            for posten in eintrag.posten {
                // Betrag = Gesamtkosten × Anteil
                XCTAssertEqual(Double(posten.betrag), Double(posten.gesamtkosten) * posten.anteil, accuracy: 1,
                               "\(eintrag.mieterName) / \(posten.bezeichnung)")
                // Bei ganzjähriger Nutzung muss auch Maßstab ÷ Gesamtmaßstab aufgehen.
                if ganzjaehrig, posten.bezugGesamt > 0, posten.schluessel != .direkt {
                    XCTAssertEqual(posten.anteil, posten.bezugAnteil / posten.bezugGesamt, accuracy: 0.005,
                                   "\(eintrag.mieterName) / \(posten.bezeichnung)")
                }
            }
            XCTAssertEqual(eintrag.summeBetriebskosten, eintrag.posten.map(\.betrag).summe)
            XCTAssertEqual(eintrag.summeGesamt, eintrag.summeBetriebskosten + eintrag.heizsumme)
            XCTAssertEqual(eintrag.saldo, eintrag.summeGesamt - eintrag.vorauszahlungen.gesamt)
        }
    }

    func testGrundsteuerJeMieterEntsprichtDerReferenz() {
        let aydin = mieter("Familie Aydin")
        let grundsteuer = aydin.posten.first { $0.kostenartId == "grundsteuer" }!
        XCTAssertEqual(grundsteuer.gesamtkosten, 142_800)
        XCTAssertEqual(grundsteuer.bezugGesamt, 250, accuracy: 0.001)
        XCTAssertEqual(grundsteuer.bezugAnteil, 62.5, accuracy: 0.001)
        XCTAssertEqual(grundsteuer.anteil, 0.25, accuracy: 1e-9)
        XCTAssertEqual(grundsteuer.betrag, 35_700)
    }

    func testWasserWirdInVerbrauchsUndDifferenzzeileAufgeteilt() {
        let aydin = mieter("Familie Aydin")
        let wasserzeilen = aydin.posten.filter { $0.kostenartId == "wasser" }
        XCTAssertEqual(wasserzeilen.count, 2)

        let verbrauch = wasserzeilen.first { $0.schluessel == .verbrauchWasser }!
        XCTAssertEqual(verbrauch.gesamtkosten, 80_080)
        XCTAssertEqual(verbrauch.bezugGesamt, 364, accuracy: 0.001)
        XCTAssertEqual(verbrauch.bezugAnteil, 118, accuracy: 0.001)
        XCTAssertEqual(verbrauch.betrag, 25_960)

        let differenz = wasserzeilen.first { $0.schluessel == .flaeche }!
        XCTAssertEqual(differenz.gesamtkosten, 7_920)
        XCTAssertEqual(differenz.betrag, 1_980)
        XCTAssertNotNil(differenz.erlaeuterung)
    }

    func testUnterjaehrigerMieterwechselFuehrtZuZeitanteiligenBetraegen() {
        let costa = mieter("Frau Costa")
        let delgado = mieter("Herr und Frau Delgado")
        let gCosta = costa.posten.first { $0.kostenartId == "grundsteuer" }!
        let gDelgado = delgado.posten.first { $0.kostenartId == "grundsteuer" }!

        let quote = Double(gCosta.betrag) / Double(gDelgado.betrag)
        XCTAssertEqual(quote, 182.0 / 153.0, accuracy: 0.02)
    }

    func testLeerstandsanteilWirdNichtAufMieterUmgelegt() {
        XCTAssertGreaterThan(ergebnis.vermieter.leerstandsanteil, 0)
        let summeMieter = ergebnis.ergebnisse.map(\.summeGesamt).summe
        XCTAssertLessThanOrEqual(summeMieter + ergebnis.vermieter.leerstandsanteil,
                                 ergebnis.summen.umlagefaehig + 200)
    }

    func testUmgelegteSummePlusVermieteranteileErgibtDieGesamtkosten() {
        let rekonstruiert = ergebnis.summen.aufMieterUmgelegt
            + ergebnis.vermieter.leerstandsanteil
            + ergebnis.vermieter.nichtUmlagefaehig
            + ergebnis.vermieter.abzuege
            + ergebnis.vermieter.co2Anteil
            + ergebnis.vermieter.rundungsdifferenz
        XCTAssertEqual(Double(rekonstruiert), Double(ergebnis.summen.gesamtkosten), accuracy: 200)
    }
}

final class PruefungTests: XCTestCase {

    private let daten = Demodaten.erzeuge()

    private func pruefe(_ periode: Abrechnungszeitraum) -> Pruefung.Ergebnis {
        Pruefung.pruefe(daten, periode, Abrechnung.berechne(daten, periode))
    }

    func testDemodatenSindAbrechnungsfaehig() {
        let ergebnis = pruefe(daten.abrechnungen[0])
        XCTAssertTrue(ergebnis.abrechnungsfaehig,
                      ergebnis.gefiltert(.fehler).map(\.titel).joined(separator: " | "))
        XCTAssertEqual(ergebnis.fehler, 0)
        XCTAssertEqual(ergebnis.warnungen, 1)   // Nutzerwechsel in Wohnung 3
    }

    func testZeitraumUeberZwoelfMonateIstEinFehler() {
        var periode = daten.abrechnungen[0]
        periode.bis = "2025-03-31"
        XCTAssertTrue(pruefe(periode).gefiltert(.fehler).contains { $0.titel.contains("zwölf Monate") })
    }

    func testVersaeumteAbrechnungsfristSperrtNachforderungen() {
        var periode = daten.abrechnungen[0]
        periode.zugestelltAm = "2026-02-01"
        XCTAssertTrue(pruefe(periode).gefiltert(.fehler).contains { $0.titel == "Abrechnungsfrist versäumt" })
    }

    func testSonstigeBetriebskostenOhneVereinbarungSindEinFehler() {
        var periode = daten.abrechnungen[0]
        let index = periode.positionen.firstIndex { $0.kostenartId == "sonstige" }!
        periode.positionen[index].imMietvertragVereinbart = false
        XCTAssertTrue(pruefe(periode).gefiltert(.fehler).contains { $0.titel.contains("Sonstige Betriebskosten nicht vereinbart") })
    }

    func testUnzulaessigerVerbrauchsanteilWirdErkannt() {
        var periode = daten.abrechnungen[0]
        periode.heizung.anteilVerbrauchHeizung = 0.8
        XCTAssertTrue(pruefe(periode).gefiltert(.fehler).contains { $0.titel.contains("Verbrauchsanteil Heizung") })
    }

    func testKabelTVNachDem30Juni2024LoestWarnungAus() {
        var periode = daten.abrechnungen[0]
        var position = Position(kostenartId: "antenne_breitband", schluessel: .einheiten, betragBrutto: 50_000)
        position.bezeichnung = "Kabelanschluss"
        periode.positionen.append(position)
        XCTAssertTrue(pruefe(periode).gefiltert(.warnung).contains { $0.titel.contains("Breitband") })
    }

    func testHauswartOhneAbzugLoestWarnungAus() {
        var periode = daten.abrechnungen[0]
        let index = periode.positionen.firstIndex { $0.kostenartId == "hauswart" }!
        periode.positionen[index].abzugBetrag = 0
        XCTAssertTrue(pruefe(periode).gefiltert(.warnung).contains { $0.titel == "Hauswartkosten ohne Abzug" })
    }

    func testNutzerwechselErzeugtHinweisAufZwischenablesung() {
        XCTAssertTrue(pruefe(daten.abrechnungen[0]).befunde.contains { $0.titel.hasPrefix("Nutzerwechsel") })
    }
}

final class ModellTests: XCTestCase {

    func testSicherungLaesstSichVerlustfreiSchreibenUndLesen() throws {
        let original = Demodaten.erzeuge()
        let roh = try JSONEncoder().encode(original)
        let gelesen = try JSONDecoder().decode(Datenbestand.self, from: roh)

        XCTAssertEqual(gelesen.einheiten.count, original.einheiten.count)
        XCTAssertEqual(gelesen.mietverhaeltnisse.count, original.mietverhaeltnisse.count)
        XCTAssertEqual(gelesen.abrechnungen[0].positionen.count, original.abrechnungen[0].positionen.count)
        XCTAssertEqual(gelesen.abrechnungen[0].heizung.co2.emissionKg, 8442)

        // Auch das Rechenergebnis muss identisch bleiben.
        let a = Abrechnung.berechne(original, original.abrechnungen[0])
        let b = Abrechnung.berechne(gelesen, gelesen.abrechnungen[0])
        XCTAssertEqual(a.summen.aufMieterUmgelegt, b.summen.aufMieterUmgelegt)
    }

    func testFehlendeFelderWerdenAufStandardwerteGelesen() throws {
        // Sicherung einer älteren Fassung mit unvollständigen Feldern
        let json = """
        {"einheiten":[{"id":"e1","bezeichnung":"W1"}],
         "abrechnungen":[{"id":"a1","jahr":2023,"positionen":[{"id":"p1","kostenartId":"grundsteuer"}]}]}
        """
        let daten = try JSONDecoder().decode(Datenbestand.self, from: Data(json.utf8))

        XCTAssertEqual(daten.einheiten[0].wohnflaeche, 0)
        XCTAssertEqual(daten.abrechnungen[0].von, "2023-01-01")
        XCTAssertEqual(daten.abrechnungen[0].bis, "2023-12-31")
        XCTAssertEqual(daten.abrechnungen[0].heizung.anteilVerbrauchHeizung, 0.7)
        XCTAssertEqual(daten.abrechnungen[0].positionen[0].abzugBetrag, 0)
        XCTAssertEqual(daten.vermieter.name, "")
        XCTAssertEqual(daten.objekt.leerstandPersonen, 1)
    }
}

final class DokumentTests: XCTestCase {

    private let daten = Demodaten.erzeuge()

    func testMieterdokumentEnthaeltDieVierFormellenMindestangaben() {
        let periode = daten.abrechnungen[0]
        let ergebnis = Abrechnung.berechne(daten, periode)
        let mieter = ergebnis.ergebnisse.first { $0.mieterName == "Familie Aydin" }!
        let html = DokumentHTML.mieterdokument(daten, periode, ergebnis, mieter)

        // 1. Gesamtkosten je Kostenart
        XCTAssertTrue(html.contains("Gesamtkosten, Verteilerschlüssel und Ihr Anteil"))
        XCTAssertTrue(html.contains("Laufende öffentliche Lasten"))
        // 2. Verteilerschlüssel samt Erläuterung
        XCTAssertTrue(html.contains("Erläuterung der verwendeten Verteilerschlüssel"))
        XCTAssertTrue(html.contains("§ 556a Abs. 1 Satz 1 BGB"))
        // 3. Anteil des Mieters
        XCTAssertTrue(html.contains("Ihr Maßstab"))
        // 4. Abzug der Vorauszahlungen
        XCTAssertTrue(html.contains("geleistete Vorauszahlungen"))
        // Ergänzende Pflichtangaben
        XCTAssertTrue(html.contains("Belegeinsicht"))
        XCTAssertTrue(html.contains("Einwendungen"))
        XCTAssertTrue(html.contains("§ 35a EStG"))
        XCTAssertTrue(html.contains("Heizkostenverordnung"))
    }

    func testMieterdokumentEnthaeltKeineNichtUmlagefaehigenPositionen() {
        let periode = daten.abrechnungen[0]
        let ergebnis = Abrechnung.berechne(daten, periode)
        for mieter in ergebnis.ergebnisse {
            let html = DokumentHTML.mieterdokument(daten, periode, ergebnis, mieter)
            XCTAssertFalse(html.contains("Hausverwaltung 2024"), mieter.mieterName)
            XCTAssertFalse(html.contains("Reparatur Steigleitung"), mieter.mieterName)
            XCTAssertFalse(html.contains("Kabel-TV-Sammelvertrag"), mieter.mieterName)
        }
    }

    func testVermieteruebersichtStelltBeideKostenartenGegenueber() {
        let periode = daten.abrechnungen[0]
        let ergebnis = Abrechnung.berechne(daten, periode)
        let html = DokumentHTML.vermieteruebersicht(daten, periode, ergebnis)

        XCTAssertTrue(html.contains("Umlagefähige Betriebskosten"))
        XCTAssertTrue(html.contains("Nicht umlagefähige Kosten"))
        XCTAssertTrue(html.contains("Hausverwaltung 2024"))
        XCTAssertTrue(html.contains("Nicht zur Weitergabe an Mieter bestimmt"))
    }

    func testTextWirdMaskiert() {
        XCTAssertEqual(DokumentHTML.esc("<b>A & B</b>"), "&lt;b&gt;A &amp; B&lt;/b&gt;")
    }
}
