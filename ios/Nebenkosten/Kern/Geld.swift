import Foundation

/// Geldbeträge werden durchgängig als ganzzahlige Cent-Werte geführt.
/// Damit entstehen keine Fließkomma-Rundungsfehler in der Abrechnung.
typealias Cent = Int

enum Geld {

    /// Kaufmännische Rundung, halbe Werte von der Null weg.
    static func runde(_ zahl: Double) -> Int {
        guard zahl.isFinite else { return 0 }
        return Int(zahl.rounded(.toNearestOrAwayFromZero))
    }

    // MARK: - Eingaben lesen

    /// Liest eine Benutzereingabe als Cent.
    /// Versteht „1.234,56", „1234,56", „1234.56", „89,90 €" und leere Eingaben.
    static func parse(_ eingabe: String) -> Cent {
        guard let wert = parseDezimal(eingabe) else { return 0 }
        return runde(wert * 100)
    }

    /// Liest eine Dezimalzahl (Fläche, Verbrauch, Anteil) in deutscher Schreibweise.
    static func parseZahl(_ eingabe: String) -> Double {
        parseDezimal(eingabe) ?? 0
    }

    private static func parseDezimal(_ eingabe: String) -> Double? {
        var text = eingabe
        for zeichen in [" ", "\u{00A0}", "\u{202F}", "€"] {
            text = text.replacingOccurrences(of: zeichen, with: "")
        }
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty || text == "-" { return nil }

        let hatKomma = text.contains(",")
        let hatPunkt = text.contains(".")

        if hatKomma && hatPunkt {
            // Das zuletzt stehende Zeichen ist das Dezimaltrennzeichen.
            if text.lastIndex(of: ",")! > text.lastIndex(of: ".")! {
                text = text.replacingOccurrences(of: ".", with: "")
                text = text.replacingOccurrences(of: ",", with: ".")
            } else {
                text = text.replacingOccurrences(of: ",", with: "")
            }
        } else if hatKomma {
            text = text.replacingOccurrences(of: ",", with: ".")
        } else if hatPunkt, istTausenderGliederung(text) {
            // „1.234" ist ein Tausenderpunkt, „12.34" eine Dezimalzahl.
            text = text.replacingOccurrences(of: ".", with: "")
        }

        guard let wert = Double(text), wert.isFinite else { return nil }
        return wert
    }

    private static let tausenderMuster = try! NSRegularExpression(pattern: "^-?[0-9]{1,3}([.][0-9]{3})+$")

    private static func istTausenderGliederung(_ text: String) -> Bool {
        let bereich = NSRange(text.startIndex..<text.endIndex, in: text)
        return tausenderMuster.firstMatch(in: text, options: [], range: bereich) != nil
    }

    // MARK: - Ausgaben formatieren

    private static let sperre = NSLock()
    private static var formatspeicher: [String: NumberFormatter] = [:]

    private static func formatierer(_ schluessel: String, _ bauen: () -> NumberFormatter) -> NumberFormatter {
        sperre.lock()
        defer { sperre.unlock() }
        if let vorhanden = formatspeicher[schluessel] { return vorhanden }
        let neu = bauen()
        formatspeicher[schluessel] = neu
        return neu
    }

    private static var deutsch: Locale { Locale(identifier: "de_DE") }

    /// „1.234,56 €"
    static func euro(_ cent: Cent) -> String {
        let f = formatierer("euro") {
            let f = NumberFormatter()
            f.locale = deutsch
            f.numberStyle = .currency
            f.currencyCode = "EUR"
            f.currencySymbol = "€"
            f.minimumFractionDigits = 2
            f.maximumFractionDigits = 2
            return f
        }
        return f.string(from: NSNumber(value: Double(cent) / 100)) ?? "0,00 €"
    }

    /// „1.234,56" ohne Währungszeichen
    static func betragText(_ cent: Cent) -> String {
        zahl(Double(cent) / 100, 2)
    }

    /// Dezimalzahl mit fester Nachkommastellenzahl in deutscher Schreibweise.
    static func zahl(_ wert: Double, _ nachkomma: Int = 2) -> String {
        let f = formatierer("dezimal-\(nachkomma)") {
            let f = NumberFormatter()
            f.locale = deutsch
            f.numberStyle = .decimal
            f.minimumFractionDigits = nachkomma
            f.maximumFractionDigits = nachkomma
            return f
        }
        let sicher = wert.isFinite ? wert : 0
        return f.string(from: NSNumber(value: sicher)) ?? "0"
    }

    /// Anteil (0…1) als Prozentwert, etwa „25,00 %".
    static func prozent(_ anteil: Double, _ nachkomma: Int = 2) -> String {
        zahl((anteil.isFinite ? anteil : 0) * 100, nachkomma) + " %"
    }

    // MARK: - Rechnen

    /// Anteiliger Betrag, kaufmännisch auf Cent gerundet.
    /// Rundungsdifferenzen verbleiben beim Vermieter – höchstens ein Cent je Position.
    static func anteil(von gesamt: Cent, _ anteil: Double) -> Cent {
        guard anteil.isFinite, anteil > 0 else { return 0 }
        return runde(Double(gesamt) * anteil)
    }
}

extension Sequence where Element == Cent {
    var summe: Cent { reduce(0, +) }
}

extension Sequence where Element == Double {
    var summe: Double { reduce(0, +) }
}
