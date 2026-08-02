import Foundation

enum Brennstoff: String, Codable, CaseIterable, Identifiable {
    case erdgas
    case heizoel
    case fluessiggas
    case pellets
    case fernwaerme
    case waermepumpe

    var id: String { rawValue }

    /// Heizwert in kWh je Mengeneinheit (Richtwert für Überschlagsrechnungen).
    var heizwert: Double {
        switch self {
        case .erdgas: return 10.0
        case .heizoel: return 10.0
        case .fluessiggas: return 6.57
        case .pellets: return 4.8
        case .fernwaerme: return 1.0
        case .waermepumpe: return 1.0
        }
    }

    var mengeneinheit: String {
        switch self {
        case .erdgas: return "m³"
        case .heizoel, .fluessiggas: return "l"
        case .pellets: return "kg"
        case .fernwaerme, .waermepumpe: return "kWh"
        }
    }

    var bezeichnung: String {
        switch self {
        case .erdgas: return "Erdgas H"
        case .heizoel: return "Heizöl EL"
        case .fluessiggas: return "Flüssiggas"
        case .pellets: return "Holzpellets"
        case .fernwaerme: return "Fernwärme"
        case .waermepumpe: return "Wärmepumpenstrom"
        }
    }

    var beschriftung: String {
        "\(bezeichnung) (\(Geld.zahl(heizwert, 2)) kWh/\(mengeneinheit))"
    }
}

enum Warmwassermethode: String, Codable, CaseIterable, Identifiable {
    case wmz
    case formel
    case prozent

    var id: String { rawValue }
    var bezeichnung: String {
        switch self {
        case .wmz: return "gemessene Wärmemenge (Wärmemengenzähler)"
        case .formel: return "rechnerisch nach § 9 Abs. 2 HeizkostenV"
        case .prozent: return "fester Prozentsatz"
        }
    }
}

/// Abrechnung der Heiz- und Warmwasserkosten nach der Heizkostenverordnung.
///
/// - § 7 Abs. 1: 50 bis 70 % der Heizkosten nach erfasstem Verbrauch, der Rest
///   als Grundkosten nach Wohnfläche.
/// - § 8 Abs. 1: dasselbe für die Warmwasserkosten.
/// - § 9 Abs. 2: Bei verbundenen Anlagen wird die auf das Warmwasser
///   entfallende Wärmemenge vorrangig gemessen, ersatzweise gilt
///   `Q = 2,5 · V · (tw − 10) / 1000` in MWh.
/// - § 12 Abs. 1: Ohne verbrauchsabhängige Abrechnung darf der Nutzer seinen
///   Anteil um 15 % kürzen.
enum Heizkosten {

    static let verbrauchsanteilMin = 0.5
    static let verbrauchsanteilMax = 0.7

    static func verbrauchsanteilZulaessig(_ anteil: Double) -> Bool {
        anteil.isFinite && anteil >= verbrauchsanteilMin - 1e-9 && anteil <= verbrauchsanteilMax + 1e-9
    }

    /// Wärmemenge des Warmwassers in kWh nach § 9 Abs. 2 HeizkostenV.
    static func warmwasserWaermemengeKwh(volumenM3: Double, temperaturC: Double = 60) -> Double {
        guard volumenM3 > 0, temperaturC > 10 else { return 0 }
        // Q [MWh] = 2,5 · V · (tw − 10) / 1000  ⇒  Q [kWh] = 2,5 · V · (tw − 10)
        return 2.5 * volumenM3 * (temperaturC - 10)
    }

    // MARK: - Warmwasseranteil

    struct Warmwasseranteil {
        var anteil: Double = 0
        var methode: String = ""
        var warmwasserKwh: Double = 0
        var gesamtwaermeKwh: Double = 0
    }

    struct Warmwassereingaben {
        var methode: Warmwassermethode = .formel
        var warmwasserKwh: Double = 0
        var volumen: Double = 0
        var temperatur: Double = 60
        var prozentsatz: Double = 0.18
        var gesamtwaermeKwh: Double = 0
        var brennstoffmenge: Double = 0
        var brennstoff: Brennstoff = .erdgas
    }

    static func warmwasseranteil(_ eingaben: Warmwassereingaben) -> Warmwasseranteil {
        if eingaben.methode == .prozent {
            return Warmwasseranteil(
                anteil: klemme(eingaben.prozentsatz, 0, 1),
                methode: "Fester vertraglich oder technisch begründeter Anteil")
        }

        let gesamtwaerme = eingaben.gesamtwaermeKwh > 0
            ? eingaben.gesamtwaermeKwh
            : eingaben.brennstoffmenge * eingaben.brennstoff.heizwert

        let warmwasser = eingaben.methode == .wmz
            ? eingaben.warmwasserKwh
            : warmwasserWaermemengeKwh(volumenM3: eingaben.volumen, temperaturC: eingaben.temperatur)

        guard gesamtwaerme > 0, warmwasser > 0 else {
            return Warmwasseranteil(
                anteil: 0,
                methode: "Keine Aufteilung möglich – Datengrundlage fehlt",
                warmwasserKwh: warmwasser,
                gesamtwaermeKwh: gesamtwaerme)
        }

        return Warmwasseranteil(
            anteil: klemme(warmwasser / gesamtwaerme, 0, 1),
            methode: eingaben.methode == .wmz
                ? "Gemessene Wärmemenge Warmwasser (Wärmemengenzähler, § 9 Abs. 2 Satz 1 HeizkostenV)"
                : "Rechnerisch nach § 9 Abs. 2 HeizkostenV: Q = 2,5 · V · (tw − 10) / 1000",
            warmwasserKwh: warmwasser,
            gesamtwaermeKwh: gesamtwaerme)
    }

    private static func klemme(_ wert: Double, _ unten: Double, _ oben: Double) -> Double {
        guard wert.isFinite else { return unten }
        return Swift.min(oben, Swift.max(unten, wert))
    }

    // MARK: - Verteilung

    struct Nutzer {
        let id: String
        let bezeichnung: String
        var leerstand: Bool = false
        var flaecheTage: Double = 0
        var verbrauchHeizung: Double = 0
        var verbrauchWarmwasser: Double = 0
    }

    struct Zeile: Identifiable {
        let id: String
        let bezeichnung: String
        let leerstand: Bool
        let flaecheTage: Double
        let flaecheAnteil: Double
        let verbrauchHeizung: Double
        let verbrauchHeizungAnteil: Double
        let verbrauchWarmwasser: Double
        let verbrauchWarmwasserAnteil: Double
        let heizGrund: Cent
        let heizVerbrauch: Cent
        let wwGrund: Cent
        let wwVerbrauch: Cent
        let kuerzung15: Cent
        let summe: Cent
    }

    struct Toepfe {
        var heizGrund: Cent = 0
        var heizVerbrauch: Cent = 0
        var wwGrund: Cent = 0
        var wwVerbrauch: Cent = 0
    }

    struct Bezugsgroessen {
        var flaecheTageGesamt: Double = 0
        var verbrauchHeizungGesamt: Double = 0
        var verbrauchWarmwasserGesamt: Double = 0
    }

    struct Ergebnis {
        var brennstoffBrutto: Cent = 0
        var nebenkosten: Cent = 0
        var kostenGesamtRoh: Cent = 0
        var co2 = CO2.Aufteilung()
        var umlagefaehigeBrennstoffkosten: Cent = 0
        var gesamtUmlagefaehig: Cent = 0
        var verbunden = false
        var warmwasserAufteilung = Warmwasseranteil()
        var kostenHeizung: Cent = 0
        var kostenWarmwasser: Cent = 0
        var anteilVerbrauchHeizung: Double = 0.7
        var anteilVerbrauchWarmwasser: Double = 0.7
        var verbrauchserfassung = true
        var toepfe = Toepfe()
        var bezug = Bezugsgroessen()
        var zeilen: [Zeile] = []
        var summeVerteilt: Cent = 0
    }

    struct Eingaben {
        var kosten = Heizkostenpositionen()
        var co2Kosten: Cent = 0
        var co2EmissionKg: Double = 0
        var gebaeudetyp: Gebaeudetyp = .wohn
        var co2Ausnahme = false
        var verbunden = true
        var kostenWarmwasserSeparat: Cent = 0
        var warmwasser = Warmwassereingaben()
        var anteilVerbrauchHeizung: Double = 0.7
        var anteilVerbrauchWarmwasser: Double = 0.7
        var verbrauchserfassung = true
        var tageZeitraum: Int = 365
        var wohnflaecheGesamt: Double = 0
        var nutzer: [Nutzer] = []
    }

    static func berechne(_ eingaben: Eingaben) -> Ergebnis {
        var ergebnis = Ergebnis()

        let brennstoff = eingaben.kosten.brennstoff
        let nebenkosten = eingaben.kosten.nebenkosten

        ergebnis.brennstoffBrutto = brennstoff
        ergebnis.nebenkosten = nebenkosten
        ergebnis.kostenGesamtRoh = brennstoff + nebenkosten

        // 1. CO₂-Kosten aufteilen – der Vermieteranteil wird vorab abgezogen.
        ergebnis.co2 = CO2.teile(
            kostenGesamt: eingaben.co2Kosten,
            emissionKg: eingaben.co2EmissionKg,
            wohnflaeche: eingaben.wohnflaecheGesamt,
            tageZeitraum: eingaben.tageZeitraum,
            gebaeudetyp: eingaben.gebaeudetyp,
            ausnahme: eingaben.co2Ausnahme)

        ergebnis.umlagefaehigeBrennstoffkosten = max(0, brennstoff - ergebnis.co2.vermieterCent)
        ergebnis.gesamtUmlagefaehig = ergebnis.umlagefaehigeBrennstoffkosten + nebenkosten

        // 2. Aufteilung Heizung / Warmwasser
        ergebnis.verbunden = eingaben.verbunden
        ergebnis.warmwasserAufteilung = eingaben.verbunden
            ? warmwasseranteil(eingaben.warmwasser)
            : Warmwasseranteil(anteil: 0, methode: "Getrennte Anlagen – keine Aufteilung erforderlich")

        ergebnis.kostenWarmwasser = eingaben.verbunden
            ? Geld.anteil(von: ergebnis.gesamtUmlagefaehig, ergebnis.warmwasserAufteilung.anteil)
            : eingaben.kostenWarmwasserSeparat
        ergebnis.kostenHeizung = eingaben.verbunden
            ? ergebnis.gesamtUmlagefaehig - ergebnis.kostenWarmwasser
            : ergebnis.gesamtUmlagefaehig

        // 3. Grund- und Verbrauchsanteile bilden
        let aH = klemme(eingaben.anteilVerbrauchHeizung, 0, 1)
        let aW = klemme(eingaben.anteilVerbrauchWarmwasser, 0, 1)
        ergebnis.anteilVerbrauchHeizung = aH
        ergebnis.anteilVerbrauchWarmwasser = aW
        ergebnis.verbrauchserfassung = eingaben.verbrauchserfassung

        var toepfe = Toepfe()
        toepfe.heizVerbrauch = Geld.anteil(von: ergebnis.kostenHeizung, aH)
        toepfe.heizGrund = ergebnis.kostenHeizung - toepfe.heizVerbrauch
        toepfe.wwVerbrauch = Geld.anteil(von: ergebnis.kostenWarmwasser, aW)
        toepfe.wwGrund = ergebnis.kostenWarmwasser - toepfe.wwVerbrauch
        ergebnis.toepfe = toepfe

        // 4. Bezugsgrößen
        var bezug = Bezugsgroessen()
        bezug.flaecheTageGesamt = eingaben.nutzer.map(\.flaecheTage).summe
        bezug.verbrauchHeizungGesamt = eingaben.nutzer.map(\.verbrauchHeizung).summe
        bezug.verbrauchWarmwasserGesamt = eingaben.nutzer.map(\.verbrauchWarmwasser).summe
        ergebnis.bezug = bezug

        let ohneErfassung = !eingaben.verbrauchserfassung

        ergebnis.zeilen = eingaben.nutzer.map { nutzer in
            let flAnteil = bezug.flaecheTageGesamt > 0 ? nutzer.flaecheTage / bezug.flaecheTageGesamt : 0
            let vhAnteil = bezug.verbrauchHeizungGesamt > 0 ? nutzer.verbrauchHeizung / bezug.verbrauchHeizungGesamt : 0
            let vwAnteil = bezug.verbrauchWarmwasserGesamt > 0 ? nutzer.verbrauchWarmwasser / bezug.verbrauchWarmwasserGesamt : 0

            // Ohne Verbrauchserfassung fällt alles auf den Flächenmaßstab zurück.
            let heizVerbrauchAnteil = ohneErfassung ? flAnteil : vhAnteil
            let wwVerbrauchAnteil = ohneErfassung ? flAnteil : vwAnteil

            let heizGrund = Geld.anteil(von: toepfe.heizGrund, flAnteil)
            let heizVerbrauch = Geld.anteil(von: toepfe.heizVerbrauch, heizVerbrauchAnteil)
            let wwGrund = Geld.anteil(von: toepfe.wwGrund, flAnteil)
            let wwVerbrauch = Geld.anteil(von: toepfe.wwVerbrauch, wwVerbrauchAnteil)

            let roh = heizGrund + heizVerbrauch + wwGrund + wwVerbrauch
            // § 12 Abs. 1 HeizkostenV: 15 % Kürzung ohne verbrauchsabhängige Abrechnung.
            let kuerzung = (ohneErfassung && !nutzer.leerstand) ? Geld.runde(Double(roh) * 0.15) : 0

            return Zeile(
                id: nutzer.id,
                bezeichnung: nutzer.bezeichnung,
                leerstand: nutzer.leerstand,
                flaecheTage: nutzer.flaecheTage,
                flaecheAnteil: flAnteil,
                verbrauchHeizung: nutzer.verbrauchHeizung,
                verbrauchHeizungAnteil: heizVerbrauchAnteil,
                verbrauchWarmwasser: nutzer.verbrauchWarmwasser,
                verbrauchWarmwasserAnteil: wwVerbrauchAnteil,
                heizGrund: heizGrund,
                heizVerbrauch: heizVerbrauch,
                wwGrund: wwGrund,
                wwVerbrauch: wwVerbrauch,
                kuerzung15: kuerzung,
                summe: roh - kuerzung)
        }

        ergebnis.summeVerteilt = ergebnis.zeilen.map(\.summe).summe
        return ergebnis
    }
}
