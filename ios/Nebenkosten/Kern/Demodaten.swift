import Foundation

/// Beispielbestand mit zwei Vermietern und vier Objekten: zwei privat
/// gehaltene Immobilien und eine GbR mit zwei weiteren Objekten.
///
/// Objekt 1 zeigt den vollen Funktionsumfang – Zentralheizung, Mieterwechsel
/// mit Leerstandsmonat, CO₂-Aufteilung und nicht umlagefähige Positionen. Es
/// dient zugleich als Prüfgrundlage der Tests; seine Werte stimmen mit dem
/// Beispieldatensatz der Web-Fassung überein.
enum Demodaten {

    static func erzeuge() -> Datenbestand {
        var daten = Datenbestand()
        daten.vermieter = [privat(), gbr()]
        daten.objekte = [objekt1(), objekt2(), objekt3(), objekt4()]
        daten.einheiten = einheiten1() + einheiten2() + einheiten3() + einheiten4()
        daten.mietverhaeltnisse = mieter1() + mieter2() + mieter3() + mieter4()
        daten.abrechnungen = [abrechnung1(), abrechnung2(), abrechnung3(), abrechnung4()]
        return daten
    }

    // MARK: - Vermieter

    private static func privat() -> Vermieter {
        var v = Vermieter(name: "Kim Spachmann")
        v.id = "v1"
        v.rechtsform = .privat
        v.strasse = "Lindenallee 4"
        v.plz = "70173"
        v.ort = "Stuttgart"
        v.telefon = "0711 1234567"
        v.email = "verwaltung@example.de"
        v.iban = "DE02 1203 0000 0000 2020 51"
        v.bank = "Beispielbank Stuttgart"
        return v
    }

    private static func gbr() -> Vermieter {
        var v = Vermieter(name: "Spachmann & Partner GbR")
        v.id = "v2"
        v.rechtsform = .gbr
        v.vertretenDurch = "Kim Spachmann und Jana Spachmann"
        v.strasse = "Lindenallee 4"
        v.plz = "70173"
        v.ort = "Stuttgart"
        v.telefon = "0711 1234567"
        v.email = "gbr@example.de"
        v.iban = "DE02 1203 0000 0000 3030 62"
        v.bank = "Beispielbank Stuttgart"
        v.steuernummer = "99012/34567"
        return v
    }

    // MARK: - Bausteine

    private static func objekt(
        _ id: String, _ vermieterId: String, _ bezeichnung: String,
        _ strasse: String, _ plz: String, _ ort: String,
        flaeche: Double, differenz: Verbrauchsdifferenz, notiz: String = ""
    ) -> Objekt {
        var o = Objekt(vermieterId: vermieterId, bezeichnung: bezeichnung)
        o.id = id
        o.strasse = strasse
        o.plz = plz
        o.ort = ort
        o.wohnflaecheGesamt = flaeche
        o.gebaeudetyp = .wohn
        o.leerstandPersonen = 1
        o.verbrauchsdifferenz = differenz
        o.notiz = notiz
        return o
    }

    private static func einheit(
        _ id: String, _ objektId: String, _ bezeichnung: String,
        _ lage: String, _ flaeche: Double, _ mea: Double
    ) -> Einheit {
        var e = Einheit(objektId: objektId, bezeichnung: bezeichnung)
        e.id = id
        e.lage = lage
        e.wohnflaeche = flaeche
        e.mea = mea
        return e
    }

    private static func mietverhaeltnis(
        _ id: String, _ einheitId: String, _ name: String, _ anschrift: String,
        von: String, bis: String, personen: Double, betriebskosten: Cent, heizkosten: Cent
    ) -> Mietverhaeltnis {
        var m = Mietverhaeltnis(einheitId: einheitId)
        m.id = id
        m.mieterName = name
        m.mieterAnschrift = anschrift
        m.von = von
        m.bis = bis
        m.personen = personen
        m.vzModus = .monatlich
        m.vzBetriebskostenMonat = betriebskosten
        m.vzHeizkostenMonat = heizkosten
        return m
    }

    private static func position(
        _ id: String, _ kostenartId: String, _ schluessel: Schluessel, _ betrag: Cent,
        bezeichnung: String = "", lieferant: String = "", notiz: String = "",
        abzug: Cent = 0, abzugGrund: String = "",
        haushaltsnah: Cent = 0, handwerker: Cent = 0,
        umlagefaehig: Bool = true, vereinbart: Bool = false, beleg: String = ""
    ) -> Position {
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
        p.beleg = beleg
        p.verbrauchsart = .kaltwasser
        return p
    }

    private static func verbrauch(_ id: String, _ einheitId: String, _ mvId: String?, _ art: Verbrauchsart, _ wert: Double) -> Verbrauch {
        var v = Verbrauch(einheitId: einheitId, mietverhaeltnisId: mvId, art: art, wert: wert)
        v.id = id
        return v
    }

    // MARK: - Objekt 1: privat, Zentralheizung, Mieterwechsel

    private static func objekt1() -> Objekt {
        objekt("o1", "v1", "Mehrfamilienhaus Gartenstraße 12", "Gartenstraße 12", "70173", "Stuttgart",
               flaeche: 250, differenz: .flaeche)
    }

    private static func einheiten1() -> [Einheit] {
        [
            einheit("e1", "o1", "Wohnung 1 EG links", "Erdgeschoss links", 62.5, 250),
            einheit("e2", "o1", "Wohnung 2 EG rechts", "Erdgeschoss rechts", 58.0, 230),
            einheit("e3", "o1", "Wohnung 3 OG links", "1. OG links", 74.5, 300),
            einheit("e4", "o1", "Wohnung 4 OG rechts", "1. OG rechts", 55.0, 220),
        ]
    }

    private static func mieter1() -> [Mietverhaeltnis] {
        let anschrift = "Gartenstraße 12, 70173 Stuttgart"
        return [
            mietverhaeltnis("m1", "e1", "Familie Aydin", anschrift, von: "2020-05-01", bis: "", personen: 3, betriebskosten: 20000, heizkosten: 14500),
            mietverhaeltnis("m2", "e2", "Herr Bernhardt", anschrift, von: "2018-09-01", bis: "", personen: 1, betriebskosten: 15000, heizkosten: 12000),
            mietverhaeltnis("m3", "e3", "Frau Costa", anschrift, von: "2015-01-01", bis: "2024-06-30", personen: 2, betriebskosten: 23000, heizkosten: 17500),
            mietverhaeltnis("m4", "e3", "Herr und Frau Delgado", anschrift, von: "2024-08-01", bis: "", personen: 2, betriebskosten: 24000, heizkosten: 18000),
            mietverhaeltnis("m5", "e4", "Frau Eberhardt", anschrift, von: "2022-03-01", bis: "", personen: 2, betriebskosten: 16500, heizkosten: 13000),
        ]
    }

    private static func abrechnung1() -> Abrechnungszeitraum {
        var a = Abrechnungszeitraum(objektId: "o1", jahr: 2024)
        a.id = "a2024"
        a.erstelltAm = "2025-03-15"
        a.zugestelltAm = "2025-03-20"
        a.hauptzaehler.kaltwasser = 400

        a.positionen = [
            position("p01", "grundsteuer", .flaeche, 142_800, lieferant: "Stadtkasse Stuttgart", beleg: "Bescheid 2024"),
            position("p02", "wasser", .verbrauchWasser, 88_000, lieferant: "Stadtwerke"),
            position("p03", "entwaesserung", .verbrauchWasser, 112_000, lieferant: "Stadtentwässerung"),
            position("p04", "strassenreinigung_muell", .personen, 72_000, lieferant: "AWS Stuttgart"),
            position("p05", "gebaeudereinigung", .flaeche, 132_000, lieferant: "Reinigung Meier GmbH", haushaltsnah: 115_000),
            position("p06", "gartenpflege", .flaeche, 66_000, lieferant: "Gartenbau Klein", haushaltsnah: 54_000),
            position("p07", "beleuchtung", .flaeche, 42_300, lieferant: "EnBW"),
            position("p08", "versicherung", .flaeche, 98_000, lieferant: "Allianz", notiz: "Gebäude- und Haftpflichtversicherung"),
            position("p09", "hauswart", .flaeche, 144_000,
                     lieferant: "Hausmeisterservice Ruf",
                     abzug: 28_800,
                     abzugGrund: "20 % Instandhaltungs- und Verwaltungsanteil nach § 2 Nr. 14 BetrKV herausgerechnet",
                     haushaltsnah: 99_000),
            position("p10", "sonstige", .flaeche, 38_000,
                     bezeichnung: "Wartung Rauchwarnmelder", lieferant: "Techem",
                     handwerker: 26_000, vereinbart: true),
            position("p11", "schornsteinreinigung", .flaeche, 21_400, lieferant: "Bezirksschornsteinfeger"),
            position("p12", "verwaltung", .flaeche, 144_000,
                     bezeichnung: "Hausverwaltung 2024", lieferant: "Immo-Verwaltung GmbH", umlagefaehig: false),
            position("p13", "instandhaltung", .flaeche, 452_000,
                     bezeichnung: "Reparatur Steigleitung und Malerarbeiten Treppenhaus",
                     lieferant: "Sanitär Wolf / Maler Braun", umlagefaehig: false),
            position("p14", "sonstige_nicht", .einheiten, 64_800,
                     bezeichnung: "Kabel-TV-Sammelvertrag (ab 01.07.2024 nicht mehr umlagefähig)",
                     lieferant: "Vodafone", umlagefaehig: false),
        ]

        a.verbraeuche = [
            verbrauch("v1", "e1", nil, .kaltwasser, 118), verbrauch("v2", "e2", nil, .kaltwasser, 52),
            verbrauch("v3", "e3", "m3", .kaltwasser, 68), verbrauch("v4", "e3", "m4", .kaltwasser, 44),
            verbrauch("v5", "e4", nil, .kaltwasser, 82),
            verbrauch("v6", "e1", nil, .heizung, 1420), verbrauch("v7", "e2", nil, .heizung, 1180),
            verbrauch("v8", "e3", "m3", .heizung, 940), verbrauch("v9", "e3", "m4", .heizung, 760),
            verbrauch("v10", "e4", nil, .heizung, 1090),
            verbrauch("v11", "e1", nil, .warmwasser, 34), verbrauch("v12", "e2", nil, .warmwasser, 12),
            verbrauch("v13", "e3", "m3", .warmwasser, 13), verbrauch("v14", "e3", "m4", .warmwasser, 11),
            verbrauch("v15", "e4", nil, .warmwasser, 22),
        ]

        a.heizung.aktiv = true
        a.heizung.verbunden = true
        a.heizung.brennstoff = .erdgas
        // 4.200 m³ Erdgas ≈ 42.000 kWh; davon rund 11.500 kWh für Warmwasser
        a.heizung.brennstoffmenge = 4200
        a.heizung.kosten.brennstoff = 462_000
        a.heizung.kosten.betriebsstrom = 32_000
        a.heizung.kosten.wartung = 62_000
        a.heizung.kosten.messdienst = 74_500
        a.heizung.warmwasser.modus = .formel
        a.heizung.warmwasser.volumen = 92
        a.heizung.warmwasser.temperatur = 60
        // 42.000 kWh × 0,201 kg/kWh ≈ 8.442 kg CO₂; bei 45 €/t rund 380 €
        a.heizung.co2.kostenCent = 38_000
        a.heizung.co2.emissionKg = 8442
        return a
    }

    // MARK: - Objekt 2: privat, Etagenheizungen

    private static func objekt2() -> Objekt {
        objekt("o2", "v1", "Zweifamilienhaus Ulmenweg 7", "Ulmenweg 7", "71638", "Ludwigsburg",
               flaeche: 168, differenz: .vermieter,
               notiz: "Jede Wohnung hat eine eigene Gastherme mit eigenem Liefervertrag – keine Heizkostenabrechnung.")
    }

    private static func einheiten2() -> [Einheit] {
        [
            einheit("e5", "o2", "Wohnung EG", "Erdgeschoss", 84, 500),
            einheit("e6", "o2", "Wohnung OG", "Obergeschoss", 84, 500),
        ]
    }

    private static func mieter2() -> [Mietverhaeltnis] {
        let anschrift = "Ulmenweg 7, 71638 Ludwigsburg"
        return [
            mietverhaeltnis("m6", "e5", "Familie Fischer", anschrift, von: "2021-07-01", bis: "", personen: 4, betriebskosten: 18000, heizkosten: 0),
            mietverhaeltnis("m7", "e6", "Herr Gruber", anschrift, von: "2019-04-01", bis: "", personen: 2, betriebskosten: 16000, heizkosten: 0),
        ]
    }

    private static func abrechnung2() -> Abrechnungszeitraum {
        var a = Abrechnungszeitraum(objektId: "o2", jahr: 2024)
        a.id = "a2024o2"
        a.erstelltAm = "2025-03-15"
        a.zugestelltAm = "2025-03-20"
        a.positionen = [
            position("q01", "grundsteuer", .flaeche, 86_400, lieferant: "Stadtkasse Ludwigsburg"),
            position("q02", "wasser", .verbrauchWasser, 62_000, lieferant: "Stadtwerke Ludwigsburg"),
            position("q03", "entwaesserung", .verbrauchWasser, 78_000, lieferant: "Stadtentwässerung"),
            position("q04", "strassenreinigung_muell", .personen, 54_000, lieferant: "AVL Ludwigsburg"),
            position("q05", "gartenpflege", .flaeche, 48_000, lieferant: "Gartenbau Klein", haushaltsnah: 40_000),
            position("q06", "versicherung", .flaeche, 62_000, lieferant: "Allianz"),
            position("q07", "schornsteinreinigung", .flaeche, 18_600, lieferant: "Bezirksschornsteinfeger"),
            position("q08", "instandhaltung", .flaeche, 178_000,
                     bezeichnung: "Erneuerung Dachrinne", lieferant: "Spenglerei Vogt", umlagefaehig: false),
        ]
        a.verbraeuche = [
            verbrauch("w1", "e5", nil, .kaltwasser, 152),
            verbrauch("w2", "e6", nil, .kaltwasser, 84),
        ]
        return a
    }

    // MARK: - Objekt 3: GbR, Zentralheizung und Aufzug

    private static func objekt3() -> Objekt {
        objekt("o3", "v2", "Wohnhaus Bahnhofstraße 44", "Bahnhofstraße 44", "70372", "Stuttgart",
               flaeche: 195, differenz: .flaeche)
    }

    private static func einheiten3() -> [Einheit] {
        [
            einheit("e7", "o3", "Wohnung 1", "Erdgeschoss", 68, 350),
            einheit("e8", "o3", "Wohnung 2", "1. OG", 72, 370),
            einheit("e9", "o3", "Wohnung 3", "Dachgeschoss", 55, 280),
        ]
    }

    private static func mieter3() -> [Mietverhaeltnis] {
        let anschrift = "Bahnhofstraße 44, 70372 Stuttgart"
        return [
            mietverhaeltnis("m8", "e7", "Frau Hoffmann", anschrift, von: "2020-01-01", bis: "", personen: 2, betriebskosten: 17000, heizkosten: 13500),
            mietverhaeltnis("m9", "e8", "Familie Ivanov", anschrift, von: "2022-09-01", bis: "", personen: 3, betriebskosten: 18500, heizkosten: 14500),
            mietverhaeltnis("m10", "e9", "Herr Jung", anschrift, von: "2023-02-01", bis: "", personen: 1, betriebskosten: 14000, heizkosten: 11000),
        ]
    }

    private static func abrechnung3() -> Abrechnungszeitraum {
        var a = Abrechnungszeitraum(objektId: "o3", jahr: 2024)
        a.id = "a2024o3"
        a.erstelltAm = "2025-03-15"
        a.zugestelltAm = "2025-03-20"
        a.hauptzaehler.kaltwasser = 290
        a.positionen = [
            position("r01", "grundsteuer", .flaeche, 118_000, lieferant: "Stadtkasse Stuttgart"),
            position("r02", "wasser", .verbrauchWasser, 64_000, lieferant: "Stadtwerke"),
            position("r03", "entwaesserung", .verbrauchWasser, 81_000, lieferant: "Stadtentwässerung"),
            position("r04", "strassenreinigung_muell", .personen, 58_000, lieferant: "AWS Stuttgart"),
            position("r05", "gebaeudereinigung", .flaeche, 96_000, lieferant: "Reinigung Meier GmbH", haushaltsnah: 84_000),
            position("r06", "beleuchtung", .flaeche, 33_600, lieferant: "EnBW"),
            position("r07", "versicherung", .flaeche, 78_000, lieferant: "Allianz"),
            position("r08", "aufzug", .flaeche, 96_000, lieferant: "Schindler", notiz: "Wartung, Notruf und TÜV"),
            position("r09", "verwaltung", .flaeche, 108_000,
                     bezeichnung: "Verwaltung durch die GbR", lieferant: "Spachmann & Partner GbR", umlagefaehig: false),
        ]
        a.verbraeuche = [
            verbrauch("x1", "e7", nil, .kaltwasser, 94), verbrauch("x2", "e8", nil, .kaltwasser, 118), verbrauch("x3", "e9", nil, .kaltwasser, 56),
            verbrauch("x4", "e7", nil, .heizung, 980), verbrauch("x5", "e8", nil, .heizung, 1140), verbrauch("x6", "e9", nil, .heizung, 720),
            verbrauch("x7", "e7", nil, .warmwasser, 21), verbrauch("x8", "e8", nil, .warmwasser, 28), verbrauch("x9", "e9", nil, .warmwasser, 13),
        ]
        a.heizung.aktiv = true
        a.heizung.verbunden = true
        a.heizung.brennstoff = .erdgas
        a.heizung.brennstoffmenge = 3100
        a.heizung.kosten.brennstoff = 341_000
        a.heizung.kosten.betriebsstrom = 24_000
        a.heizung.kosten.wartung = 48_000
        a.heizung.kosten.messdienst = 56_000
        a.heizung.warmwasser.modus = .formel
        a.heizung.warmwasser.volumen = 62
        a.heizung.warmwasser.temperatur = 60
        a.heizung.co2.kostenCent = 28_000
        a.heizung.co2.emissionKg = 6231
        return a
    }

    // MARK: - Objekt 4: GbR, kleines Objekt ohne Zentralheizung

    private static func objekt4() -> Objekt {
        objekt("o4", "v2", "Stadthaus Marktplatz 2", "Marktplatz 2", "71634", "Ludwigsburg",
               flaeche: 122, differenz: .verbrauch)
    }

    private static func einheiten4() -> [Einheit] {
        [
            einheit("e10", "o4", "Wohnung vorne", "1. OG", 66, 540),
            einheit("e11", "o4", "Wohnung hinten", "2. OG", 56, 460),
        ]
    }

    private static func mieter4() -> [Mietverhaeltnis] {
        let anschrift = "Marktplatz 2, 71634 Ludwigsburg"
        return [
            mietverhaeltnis("m11", "e10", "Frau Kern", anschrift, von: "2021-11-01", bis: "", personen: 2, betriebskosten: 15000, heizkosten: 0),
            mietverhaeltnis("m12", "e11", "Herr Lindner", anschrift, von: "2024-03-01", bis: "", personen: 1, betriebskosten: 13500, heizkosten: 0),
        ]
    }

    private static func abrechnung4() -> Abrechnungszeitraum {
        var a = Abrechnungszeitraum(objektId: "o4", jahr: 2024)
        a.id = "a2024o4"
        a.erstelltAm = "2025-03-15"
        a.zugestelltAm = "2025-03-20"
        a.positionen = [
            position("s01", "grundsteuer", .flaeche, 74_000, lieferant: "Stadtkasse Ludwigsburg"),
            position("s02", "wasser", .verbrauchWasser, 48_000, lieferant: "Stadtwerke Ludwigsburg"),
            position("s03", "entwaesserung", .verbrauchWasser, 59_000, lieferant: "Stadtentwässerung"),
            position("s04", "strassenreinigung_muell", .personen, 42_000, lieferant: "AVL Ludwigsburg"),
            position("s05", "gebaeudereinigung", .flaeche, 54_000, lieferant: "Reinigung Meier GmbH", haushaltsnah: 47_000),
            position("s06", "versicherung", .flaeche, 51_000, lieferant: "Allianz"),
        ]
        a.verbraeuche = [
            verbrauch("y1", "e10", nil, .kaltwasser, 88),
            verbrauch("y2", "e11", nil, .kaltwasser, 41),
        ]
        return a
    }
}
