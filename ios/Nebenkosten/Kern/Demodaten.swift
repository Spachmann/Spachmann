import Foundation

/// Vollständiger Beispieldatensatz: Mehrfamilienhaus mit vier Einheiten,
/// unterjährigem Mieterwechsel samt Leerstandsmonat, verbundener Heizungs-
/// anlage, CO₂-Kostenaufteilung und nicht umlagefähigen Positionen.
///
/// Dient zugleich als Prüfgrundlage der Tests – die Werte stimmen mit dem
/// Beispieldatensatz der Web-Fassung überein.
enum Demodaten {

    static func erzeuge() -> Datenbestand {
        var daten = Datenbestand()

        daten.vermieter = vermieter()
        daten.objekt = objekt()
        daten.einheiten = einheiten()
        daten.mietverhaeltnisse = mietverhaeltnisse()
        daten.abrechnungen = [abrechnung2024()]
        return daten
    }

    // MARK: - Stammdaten

    private static func vermieter() -> Vermieter {
        var v = Vermieter()
        v.name = "Kim Spachmann"
        v.strasse = "Lindenallee 4"
        v.plz = "70173"
        v.ort = "Stuttgart"
        v.telefon = "0711 1234567"
        v.email = "verwaltung@example.de"
        v.iban = "DE02 1203 0000 0000 2020 51"
        v.bank = "Beispielbank Stuttgart"
        return v
    }

    private static func objekt() -> Objekt {
        var o = Objekt()
        o.bezeichnung = "Mehrfamilienhaus Gartenstraße 12"
        o.strasse = "Gartenstraße 12"
        o.plz = "70173"
        o.ort = "Stuttgart"
        o.wohnflaecheGesamt = 250
        o.gebaeudetyp = .wohn
        o.leerstandPersonen = 1
        o.verbrauchsdifferenz = .flaeche
        return o
    }

    private static func einheit(_ id: String, _ bezeichnung: String, _ lage: String, _ flaeche: Double, _ mea: Double) -> Einheit {
        var e = Einheit()
        e.id = id
        e.bezeichnung = bezeichnung
        e.lage = lage
        e.wohnflaeche = flaeche
        e.mea = mea
        return e
    }

    private static func einheiten() -> [Einheit] {
        [
            einheit("e1", "Wohnung 1 EG links", "Erdgeschoss links", 62.5, 250),
            einheit("e2", "Wohnung 2 EG rechts", "Erdgeschoss rechts", 58.0, 230),
            einheit("e3", "Wohnung 3 OG links", "1. OG links", 74.5, 300),
            einheit("e4", "Wohnung 4 OG rechts", "1. OG rechts", 55.0, 220),
        ]
    }

    private static func mietverhaeltnis(
        _ id: String, _ einheitId: String, _ name: String,
        von: String, bis: String, personen: Double,
        betriebskosten: Cent, heizkosten: Cent
    ) -> Mietverhaeltnis {
        var m = Mietverhaeltnis()
        m.id = id
        m.einheitId = einheitId
        m.mieterName = name
        m.mieterAnschrift = "Gartenstraße 12, 70173 Stuttgart"
        m.von = von
        m.bis = bis
        m.personen = personen
        m.vzModus = .monatlich
        m.vzBetriebskostenMonat = betriebskosten
        m.vzHeizkostenMonat = heizkosten
        return m
    }

    private static func mietverhaeltnisse() -> [Mietverhaeltnis] {
        [
            mietverhaeltnis("m1", "e1", "Familie Aydin",
                            von: "2020-05-01", bis: "", personen: 3,
                            betriebskosten: 20000, heizkosten: 14500),
            mietverhaeltnis("m2", "e2", "Herr Bernhardt",
                            von: "2018-09-01", bis: "", personen: 1,
                            betriebskosten: 15000, heizkosten: 12000),
            mietverhaeltnis("m3", "e3", "Frau Costa",
                            von: "2015-01-01", bis: "2024-06-30", personen: 2,
                            betriebskosten: 23000, heizkosten: 17500),
            mietverhaeltnis("m4", "e3", "Herr und Frau Delgado",
                            von: "2024-08-01", bis: "", personen: 2,
                            betriebskosten: 24000, heizkosten: 18000),
            mietverhaeltnis("m5", "e4", "Frau Eberhardt",
                            von: "2022-03-01", bis: "", personen: 2,
                            betriebskosten: 16500, heizkosten: 13000),
        ]
    }

    // MARK: - Abrechnungszeitraum 2024

    private static func abrechnung2024() -> Abrechnungszeitraum {
        var a = Abrechnungszeitraum(jahr: 2024)
        a.id = "a2024"
        a.erstelltAm = "2025-03-15"
        a.zugestelltAm = "2025-03-20"
        a.zahlungsfristTage = 30
        a.hauptzaehler.kaltwasser = 400
        a.positionen = positionen()
        a.verbraeuche = verbraeuche()
        a.heizung = heizung()
        return a
    }

    private static func positionen() -> [Position] {
        var liste: [Position] = []

        func fuege(
            _ id: String, _ kostenartId: String, _ schluessel: Schluessel, _ betrag: Cent,
            bezeichnung: String = "", lieferant: String = "", notiz: String = "",
            abzug: Cent = 0, abzugGrund: String = "",
            haushaltsnah: Cent = 0, handwerker: Cent = 0,
            umlagefaehig: Bool = true, vereinbart: Bool = false,
            verbrauchsart: Verbrauchsart = .kaltwasser, beleg: String = ""
        ) {
            var p = Position(kostenartId: kostenartId, schluessel: schluessel, betragBrutto: betrag)
            p.id = id
            p.bezeichnung = bezeichnung
            p.lieferant = lieferant
            p.notiz = notiz
            p.abzugBetrag = abzug
            p.abzugGrund = abzugGrund
            p.lohnanteilHaushaltsnah = haushaltsnah
            p.lohnanteilHandwerker = handwerker
            p.umlagefaehig = umlagefaehig
            p.imMietvertragVereinbart = vereinbart
            p.verbrauchsart = verbrauchsart
            p.beleg = beleg
            liste.append(p)
        }

        fuege("p01", "grundsteuer", .flaeche, 142_800,
              lieferant: "Stadtkasse Stuttgart", beleg: "Bescheid 2024")
        fuege("p02", "wasser", .verbrauchWasser, 88_000, lieferant: "Stadtwerke")
        fuege("p03", "entwaesserung", .verbrauchWasser, 112_000, lieferant: "Stadtentwässerung")
        fuege("p04", "strassenreinigung_muell", .personen, 72_000, lieferant: "AWS Stuttgart")
        fuege("p05", "gebaeudereinigung", .flaeche, 132_000,
              lieferant: "Reinigung Meier GmbH", haushaltsnah: 115_000)
        fuege("p06", "gartenpflege", .flaeche, 66_000,
              lieferant: "Gartenbau Klein", haushaltsnah: 54_000)
        fuege("p07", "beleuchtung", .flaeche, 42_300, lieferant: "EnBW")
        fuege("p08", "versicherung", .flaeche, 98_000,
              lieferant: "Allianz", notiz: "Gebäude- und Haftpflichtversicherung")
        fuege("p09", "hauswart", .flaeche, 144_000,
              lieferant: "Hausmeisterservice Ruf",
              abzug: 28_800,
              abzugGrund: "20 % Instandhaltungs- und Verwaltungsanteil nach § 2 Nr. 14 BetrKV herausgerechnet",
              haushaltsnah: 99_000)
        fuege("p10", "sonstige", .flaeche, 38_000,
              bezeichnung: "Wartung Rauchwarnmelder", lieferant: "Techem",
              handwerker: 26_000, vereinbart: true)
        fuege("p11", "schornsteinreinigung", .flaeche, 21_400, lieferant: "Bezirksschornsteinfeger")

        // Nicht umlagefähige Positionen – erscheinen ausschließlich in der
        // internen Vermieterübersicht.
        fuege("p12", "verwaltung", .flaeche, 144_000,
              bezeichnung: "Hausverwaltung 2024", lieferant: "Immo-Verwaltung GmbH",
              umlagefaehig: false)
        fuege("p13", "instandhaltung", .flaeche, 452_000,
              bezeichnung: "Reparatur Steigleitung und Malerarbeiten Treppenhaus",
              lieferant: "Sanitär Wolf / Maler Braun", umlagefaehig: false)
        fuege("p14", "sonstige_nicht", .einheiten, 64_800,
              bezeichnung: "Kabel-TV-Sammelvertrag (ab 01.07.2024 nicht mehr umlagefähig)",
              lieferant: "Vodafone", umlagefaehig: false)

        return liste
    }

    private static func verbraeuche() -> [Verbrauch] {
        func v(_ id: String, _ einheitId: String, _ mvId: String?, _ art: Verbrauchsart, _ wert: Double) -> Verbrauch {
            var eintrag = Verbrauch(einheitId: einheitId, mietverhaeltnisId: mvId, art: art, wert: wert)
            eintrag.id = id
            return eintrag
        }

        return [
            v("v1", "e1", nil, .kaltwasser, 118),
            v("v2", "e2", nil, .kaltwasser, 52),
            v("v3", "e3", "m3", .kaltwasser, 68),
            v("v4", "e3", "m4", .kaltwasser, 44),
            v("v5", "e4", nil, .kaltwasser, 82),

            v("v6", "e1", nil, .heizung, 1420),
            v("v7", "e2", nil, .heizung, 1180),
            v("v8", "e3", "m3", .heizung, 940),
            v("v9", "e3", "m4", .heizung, 760),
            v("v10", "e4", nil, .heizung, 1090),

            v("v11", "e1", nil, .warmwasser, 34),
            v("v12", "e2", nil, .warmwasser, 12),
            v("v13", "e3", "m3", .warmwasser, 13),
            v("v14", "e3", "m4", .warmwasser, 11),
            v("v15", "e4", nil, .warmwasser, 22),
        ]
    }

    private static func heizung() -> Heizungseinstellungen {
        var h = Heizungseinstellungen()
        h.aktiv = true
        h.verbunden = true
        h.brennstoff = .erdgas
        // 4.200 m³ Erdgas ≈ 42.000 kWh; davon rund 11.500 kWh für Warmwasser
        h.brennstoffmenge = 4200
        h.kosten.brennstoff = 462_000
        h.kosten.betriebsstrom = 32_000
        h.kosten.wartung = 62_000
        h.kosten.messdienst = 74_500
        h.warmwasser.modus = .formel
        h.warmwasser.volumen = 92
        h.warmwasser.temperatur = 60
        h.anteilVerbrauchHeizung = 0.7
        h.anteilVerbrauchWarmwasser = 0.7
        h.verbrauchserfassung = true
        // 42.000 kWh × 0,201 kg/kWh ≈ 8.442 kg CO₂; bei 45 €/t rund 380 €
        h.co2.kostenCent = 38_000
        h.co2.emissionKg = 8442
        h.co2.gebaeudetyp = .wohn
        return h
    }
}
