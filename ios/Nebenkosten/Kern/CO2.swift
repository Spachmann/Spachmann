import Foundation

/// Aufteilung der CO₂-Kosten nach dem Kohlendioxidkostenaufteilungsgesetz
/// (CO2KostAufG, in Kraft seit 01.01.2023).
///
/// Bei Wohngebäuden gilt das Stufenmodell der Anlage zu § 5 Abs. 1
/// CO2KostAufG: Je schlechter der Emissionskennwert des Gebäudes
/// (kg CO₂ je m² Wohnfläche und Jahr), desto höher der Vermieteranteil.
/// Dieser Anteil wird vor der Umlage von den Brennstoffkosten abgezogen
/// (§ 6 Abs. 1 CO2KostAufG).
enum CO2 {

    struct Stufe: Hashable {
        let nummer: Int
        let ab: Double
        let unter: Double
        let mieter: Double
        let vermieter: Double

        var bereichstext: String {
            unter.isInfinite ? "ab \(Geld.zahl(ab, 0))" : "\(Geld.zahl(ab, 0)) bis unter \(Geld.zahl(unter, 0))"
        }
    }

    /// Stufenmodell für Wohngebäude, Anlage zu § 5 Abs. 1 CO2KostAufG.
    static let stufen: [Stufe] = [
        Stufe(nummer: 1,  ab: 0,  unter: 12,       mieter: 1.00, vermieter: 0.00),
        Stufe(nummer: 2,  ab: 12, unter: 17,       mieter: 0.90, vermieter: 0.10),
        Stufe(nummer: 3,  ab: 17, unter: 22,       mieter: 0.80, vermieter: 0.20),
        Stufe(nummer: 4,  ab: 22, unter: 27,       mieter: 0.70, vermieter: 0.30),
        Stufe(nummer: 5,  ab: 27, unter: 32,       mieter: 0.60, vermieter: 0.40),
        Stufe(nummer: 6,  ab: 32, unter: 37,       mieter: 0.50, vermieter: 0.50),
        Stufe(nummer: 7,  ab: 37, unter: 42,       mieter: 0.40, vermieter: 0.60),
        Stufe(nummer: 8,  ab: 42, unter: 47,       mieter: 0.30, vermieter: 0.70),
        Stufe(nummer: 9,  ab: 47, unter: 52,       mieter: 0.20, vermieter: 0.80),
        Stufe(nummer: 10, ab: 52, unter: .infinity, mieter: 0.05, vermieter: 0.95),
    ]

    /// Emissionsfaktoren in kg CO₂ je kWh. Die Angabe auf der Rechnung geht vor.
    static let emissionsfaktor: [Brennstoff: Double] = [
        .erdgas: 0.201,
        .heizoel: 0.266,
        .fluessiggas: 0.234,
        .fernwaerme: 0.180,
        .pellets: 0.0,
        .waermepumpe: 0.0,
    ]

    static func stufe(fuer kgProM2: Double) -> Stufe {
        let wert = (kgProM2.isFinite && kgProM2 > 0) ? kgProM2 : 0
        return stufen.first { wert >= $0.ab && wert < $0.unter } ?? stufen[0]
    }

    struct Aufteilung {
        var kostenGesamt: Cent = 0
        var emissionKg: Double = 0
        var wohnflaeche: Double = 0
        var kgProM2: Double = 0
        var stufe: Stufe?
        var anteilVermieter: Double = 0
        var anteilMieter: Double = 1
        var vermieterCent: Cent = 0
        var mieterCent: Cent = 0
        var hinweis: String?

        var anwendbar: Bool { kostenGesamt > 0 }
    }

    /// Teilt die CO₂-Kosten zwischen Vermieter und Mieterschaft auf.
    ///
    /// - Parameters:
    ///   - kostenGesamt: im Zeitraum angefallene CO₂-Kosten laut Brennstoffrechnung (§ 3 CO2KostAufG)
    ///   - emissionKg: im Zeitraum verursachte CO₂-Menge in Kilogramm
    ///   - wohnflaeche: Gesamtwohnfläche des Gebäudes in m²
    ///   - tageZeitraum: Länge des Abrechnungszeitraums, für die Hochrechnung auf ein Jahr
    ///   - gebaeudetyp: Wohn- oder Nichtwohngebäude
    ///   - ausnahme: Vermieteranteil entfällt nach § 9 CO2KostAufG
    static func teile(
        kostenGesamt: Cent,
        emissionKg: Double,
        wohnflaeche: Double,
        tageZeitraum: Int = 365,
        gebaeudetyp: Gebaeudetyp = .wohn,
        ausnahme: Bool = false
    ) -> Aufteilung {
        var ergebnis = Aufteilung(kostenGesamt: kostenGesamt, emissionKg: emissionKg, wohnflaeche: wohnflaeche)
        ergebnis.mieterCent = kostenGesamt

        guard kostenGesamt > 0 else { return ergebnis }

        if ausnahme {
            ergebnis.hinweis = "Ausnahme nach § 9 CO2KostAufG: Der Vermieteranteil entfällt."
            return ergebnis
        }

        // Nichtwohngebäude: bis zur Einführung eines eigenen Stufenmodells
        // hälftige Teilung (§ 8 Abs. 1 CO2KostAufG).
        if gebaeudetyp == .nichtwohn {
            ergebnis.anteilVermieter = 0.5
            ergebnis.anteilMieter = 0.5
            ergebnis.vermieterCent = Geld.runde(Double(kostenGesamt) * 0.5)
            ergebnis.mieterCent = kostenGesamt - ergebnis.vermieterCent
            ergebnis.hinweis = "Nichtwohngebäude: hälftige Teilung nach § 8 Abs. 1 CO2KostAufG."
            return ergebnis
        }

        // Unterjährige Zeiträume werden für die Einstufung auf ein Jahr hochgerechnet.
        let jahresfaktor = tageZeitraum > 0 ? 365.0 / Double(tageZeitraum) : 1
        let kgProM2 = wohnflaeche > 0 ? (emissionKg * jahresfaktor) / wohnflaeche : 0
        let stufe = stufe(fuer: kgProM2)

        ergebnis.kgProM2 = kgProM2
        ergebnis.stufe = stufe
        ergebnis.anteilVermieter = stufe.vermieter
        ergebnis.anteilMieter = stufe.mieter
        ergebnis.vermieterCent = Geld.runde(Double(kostenGesamt) * stufe.vermieter)
        ergebnis.mieterCent = kostenGesamt - ergebnis.vermieterCent
        return ergebnis
    }

    /// Schätzt die CO₂-Menge aus Energiemenge und Brennstoffart.
    static func schaetzeEmission(kwh: Double, brennstoff: Brennstoff) -> Double {
        kwh * (emissionsfaktor[brennstoff] ?? 0)
    }
}

enum Gebaeudetyp: String, Codable, CaseIterable, Identifiable {
    case wohn
    case nichtwohn

    var id: String { rawValue }
    var bezeichnung: String {
        switch self {
        case .wohn: return "Wohngebäude"
        case .nichtwohn: return "Nichtwohngebäude"
        }
    }
}
