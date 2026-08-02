import Foundation

/// Datumsrechnung für Abrechnungszeiträume.
///
/// Datumsangaben werden als ISO-Zeichenketten „JJJJ-MM-TT" geführt – identisch
/// zum Sicherungsformat der Web-App, sodass Sicherungen zwischen beiden
/// Fassungen austauschbar sind. Gerechnet wird über Tagesnummern des
/// proleptischen gregorianischen Kalenders, also ohne Zeitzonen- und
/// Sommerzeiteinflüsse. Zeiträume schließen beide Randtage ein.
enum Datum {

    // MARK: - Umrechnung

    static func teile(_ iso: String) -> (jahr: Int, monat: Int, tag: Int)? {
        let stuecke = iso.prefix(10).split(separator: "-", omittingEmptySubsequences: false)
        guard stuecke.count == 3,
              let jahr = Int(stuecke[0]), let monat = Int(stuecke[1]), let tag = Int(stuecke[2]),
              monat >= 1, monat <= 12, tag >= 1, tag <= 31
        else { return nil }
        return (jahr, monat, tag)
    }

    /// Tagesnummer bezogen auf den 01.01.1970 (Algorithmus „days from civil").
    static func tagesnummer(_ iso: String) -> Int? {
        guard let t = teile(iso) else { return nil }
        return tagesnummer(jahr: t.jahr, monat: t.monat, tag: t.tag)
    }

    static func tagesnummer(jahr: Int, monat: Int, tag: Int) -> Int {
        let j = jahr - (monat <= 2 ? 1 : 0)
        let aera = (j >= 0 ? j : j - 399) / 400
        let jahrInAera = j - aera * 400                                   // 0…399
        let tagImJahr = (153 * (monat + (monat > 2 ? -3 : 9)) + 2) / 5 + tag - 1  // 0…365
        let tagInAera = jahrInAera * 365 + jahrInAera / 4 - jahrInAera / 100 + tagImJahr
        return aera * 146097 + tagInAera - 719468
    }

    static func iso(_ tagesnummer: Int) -> String {
        let z = tagesnummer + 719468
        let aera = (z >= 0 ? z : z - 146096) / 146097
        let tagInAera = z - aera * 146097                                 // 0…146096
        let jahrInAera = (tagInAera - tagInAera / 1460 + tagInAera / 36524 - tagInAera / 146096) / 365
        let jahr = jahrInAera + aera * 400
        let tagImJahr = tagInAera - (365 * jahrInAera + jahrInAera / 4 - jahrInAera / 100)
        let mp = (5 * tagImJahr + 2) / 153                                // 0…11
        let tag = tagImJahr - (153 * mp + 2) / 5 + 1
        let monat = mp + (mp < 10 ? 3 : -9)
        return zeichenkette(jahr: jahr + (monat <= 2 ? 1 : 0), monat: monat, tag: tag)
    }

    private static func zeichenkette(jahr: Int, monat: Int, tag: Int) -> String {
        String(format: "%04d-%02d-%02d", jahr, monat, tag)
    }

    static func istDatum(_ iso: String) -> Bool { tagesnummer(iso) != nil }

    // MARK: - Zeiträume

    /// Anzahl Tage von…bis, beide Randtage eingeschlossen.
    static func tage(_ von: String, _ bis: String) -> Int {
        guard let a = tagesnummer(von), let b = tagesnummer(bis), b >= a else { return 0 }
        return b - a + 1
    }

    /// Anzahl Tage, die sich zwei Zeiträume überschneiden.
    static func ueberschneidungTage(_ von1: String, _ bis1: String, _ von2: String, _ bis2: String) -> Int {
        guard let a1 = tagesnummer(von1), let e1 = tagesnummer(bis1),
              let a2 = tagesnummer(von2), let e2 = tagesnummer(bis2)
        else { return 0 }
        let start = max(a1, a2)
        let ende = min(e1, e2)
        return ende < start ? 0 : ende - start + 1
    }

    /// Schnittmenge zweier Zeiträume oder nil.
    static func schnitt(_ von1: String, _ bis1: String, _ von2: String, _ bis2: String) -> (von: String, bis: String)? {
        guard let a1 = tagesnummer(von1), let e1 = tagesnummer(bis1),
              let a2 = tagesnummer(von2), let e2 = tagesnummer(bis2)
        else { return nil }
        let start = max(a1, a2)
        let ende = min(e1, e2)
        guard ende >= start else { return nil }
        return (iso(start), iso(ende))
    }

    static func plusTage(_ datum: String, _ anzahl: Int) -> String {
        guard let n = tagesnummer(datum) else { return datum }
        return iso(n + anzahl)
    }

    /// Verschiebt um Monate; ein zu hoher Tag wird auf das Monatsende gekappt.
    static func plusMonate(_ datum: String, _ anzahl: Int) -> String {
        guard let t = teile(datum) else { return datum }
        let laufend = t.jahr * 12 + (t.monat - 1) + anzahl
        let jahr = bodenDivision(laufend, 12)
        let monat = laufend - jahr * 12 + 1
        return zeichenkette(jahr: jahr, monat: monat, tag: min(t.tag, tageImMonat(jahr: jahr, monat: monat)))
    }

    /// Anzahl angefangener Kalendermonate eines Zeitraums – Maßstab für die
    /// monatlich geleisteten Vorauszahlungen.
    static func monateImZeitraum(_ von: String, _ bis: String) -> Int {
        guard let a = teile(von), let b = teile(bis) else { return 0 }
        return (b.jahr - a.jahr) * 12 + (b.monat - a.monat) + 1
    }

    static func tageImMonat(jahr: Int, monat: Int) -> Int {
        switch monat {
        case 1, 3, 5, 7, 8, 10, 12: return 31
        case 4, 6, 9, 11: return 30
        default: return istSchaltjahr(jahr) ? 29 : 28
        }
    }

    static func istSchaltjahr(_ jahr: Int) -> Bool {
        (jahr % 4 == 0 && jahr % 100 != 0) || jahr % 400 == 0
    }

    private static func bodenDivision(_ zaehler: Int, _ nenner: Int) -> Int {
        let ergebnis = zaehler / nenner
        return (zaehler % nenner < 0) ? ergebnis - 1 : ergebnis
    }

    // MARK: - Darstellung

    /// „2024-03-07" wird zu „07.03.2024".
    static func deutsch(_ iso: String) -> String {
        guard let t = teile(iso) else { return "" }
        return String(format: "%02d.%02d.%04d", t.tag, t.monat, t.jahr)
    }

    static func heute() -> String {
        var kalender = Calendar(identifier: .gregorian)
        kalender.timeZone = TimeZone.current
        let teile = kalender.dateComponents([.year, .month, .day], from: Date())
        guard let jahr = teile.year, let monat = teile.month, let tag = teile.day else { return "" }
        return zeichenkette(jahr: jahr, monat: monat, tag: tag)
    }

    static func jahr(von iso: String) -> Int { teile(iso)?.jahr ?? 0 }
}
