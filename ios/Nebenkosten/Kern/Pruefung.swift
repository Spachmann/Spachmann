import Foundation

/// Prüfung der Abrechnung auf die formellen und materiellen Anforderungen des
/// deutschen Betriebskostenrechts.
enum Pruefung {

    enum Stufe: String, CaseIterable, Identifiable {
        case fehler
        case warnung
        case hinweis

        var id: String { rawValue }

        var titel: String {
            switch self {
            case .fehler: return "Fehler"
            case .warnung: return "Warnungen"
            case .hinweis: return "Hinweise"
            }
        }

        var symbol: String {
            switch self {
            case .fehler: return "exclamationmark.octagon.fill"
            case .warnung: return "exclamationmark.triangle.fill"
            case .hinweis: return "info.circle.fill"
            }
        }

        var rang: Int {
            switch self {
            case .fehler: return 0
            case .warnung: return 1
            case .hinweis: return 2
            }
        }
    }

    struct Befund: Identifiable {
        let id = UUID()
        let stufe: Stufe
        let titel: String
        let text: String
        let quelle: String
    }

    struct Ergebnis {
        var befunde: [Befund] = []

        var fehler: Int { befunde.filter { $0.stufe == .fehler }.count }
        var warnungen: Int { befunde.filter { $0.stufe == .warnung }.count }
        var hinweise: Int { befunde.filter { $0.stufe == .hinweis }.count }
        var abrechnungsfaehig: Bool { fehler == 0 }

        func gefiltert(_ stufe: Stufe) -> [Befund] { befunde.filter { $0.stufe == stufe } }
    }

    // MARK: - Einstieg

    static func pruefe(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis?) -> Ergebnis {
        var befunde: [Befund] = []
        func melde(_ stufe: Stufe, _ titel: String, _ text: String, _ quelle: String = "") {
            befunde.append(Befund(stufe: stufe, titel: titel, text: text, quelle: quelle))
        }

        pruefeStammdaten(bestand, melde)
        pruefeZeitraum(periode, ergebnis, melde)
        pruefeEinheiten(bestand, melde)
        pruefeMietverhaeltnisse(bestand, periode, melde)
        pruefePositionen(bestand, periode, ergebnis, melde)
        pruefeHeizung(periode, ergebnis, melde)
        pruefeErgebnis(ergebnis, melde)

        befunde.sort { $0.stufe.rang < $1.stufe.rang }
        return Ergebnis(befunde: befunde)
    }

    private typealias Melder = (Stufe, String, String, String) -> Void

    // MARK: - Einzelprüfungen

    private static func pruefeStammdaten(_ bestand: Objektbestand, _ melde: Melder) {
        let v = bestand.vermieter
        if v.name.isEmpty {
            melde(.fehler, "Vermieter fehlt",
                  "Die Abrechnung muss erkennen lassen, wer sie erteilt. Ohne Angabe des Vermieters ist sie formell unwirksam.",
                  "§ 259 BGB")
        }
        if v.strasse.isEmpty || v.ort.isEmpty {
            melde(.warnung, "Anschrift des Vermieters unvollständig",
                  "Der Mieter muss den Abrechnenden erreichen können, unter anderem zur Ausübung des Belegeinsichtsrechts.",
                  "§ 259 BGB")
        }
        if v.rechtsform.vertretungNoetig && v.vertretenDurch.isEmpty {
            melde(.warnung, "Vertretung des Vermieters nicht angegeben",
                  "Vermieter ist eine \(v.rechtsform.bezeichnung). Die Abrechnung sollte erkennen lassen, wer für sie handelt – trage die vertretungsberechtigten Personen unter „vertreten durch“ ein. Bei einer GbR ist das besonders wichtig, weil sie nur durch ihre Gesellschafter auftreten kann.",
                  "§ 259 BGB, § 709 BGB")
        }
        if bestand.objekt.strasse.isEmpty || bestand.objekt.ort.isEmpty {
            melde(.fehler, "Objektanschrift fehlt",
                  "Die Abrechnung muss das Abrechnungsobjekt eindeutig bezeichnen.",
                  "BGH VIII ZR 84/07")
        }
    }

    private static func pruefeZeitraum(_ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis?, _ melde: Melder) {
        let tage = Datum.tage(periode.von, periode.bis)
        guard tage > 0 else {
            melde(.fehler, "Abrechnungszeitraum ungültig",
                  "Beginn und Ende des Abrechnungszeitraums müssen gesetzt sein und das Ende muss nach dem Beginn liegen.",
                  "§ 556 Abs. 3 BGB")
            return
        }

        if tage > 366 {
            melde(.fehler, "Abrechnungszeitraum länger als zwölf Monate",
                  "Der Zeitraum umfasst \(tage) Tage. Über Betriebskosten ist jährlich abzurechnen; ein längerer Zeitraum macht die Abrechnung unwirksam.",
                  "§ 556 Abs. 3 Satz 1 BGB")
        }

        let frist = periode.abrechnungsfrist
        if periode.zugestelltAm.isEmpty {
            melde(.hinweis, "Abrechnungsfrist läuft",
                  "Die Abrechnung muss dem Mieter spätestens am \(Datum.deutsch(frist)) zugehen. Danach sind Nachforderungen ausgeschlossen, soweit der Vermieter die Verspätung zu vertreten hat.",
                  "§ 556 Abs. 3 Satz 2 und 3 BGB")
        } else if let zugestellt = Datum.tagesnummer(periode.zugestelltAm),
                  let fristTag = Datum.tagesnummer(frist),
                  zugestellt > fristTag {
            let nachzahlungen = (ergebnis?.ergebnisse ?? []).filter { $0.nachzahlung > 0 }
            var zusatz = "."
            if !nachzahlungen.isEmpty {
                let summe = nachzahlungen.map(\.nachzahlung).summe
                zusatz = " – betroffen sind \(nachzahlungen.count) Mietverhältnis(se) mit zusammen \(Geld.euro(summe))."
            }
            melde(.fehler, "Abrechnungsfrist versäumt",
                  "Zustellung am \(Datum.deutsch(periode.zugestelltAm)), Frist endete am \(Datum.deutsch(frist)). Nachforderungen sind ausgeschlossen\(zusatz) Guthaben sind gleichwohl auszuzahlen.",
                  "§ 556 Abs. 3 Satz 3 BGB")
        }

        if !periode.zugestelltAm.isEmpty {
            melde(.hinweis, "Einwendungsfrist des Mieters",
                  "Der Mieter kann bis zum \(Datum.deutsch(Datum.plusMonate(periode.zugestelltAm, 12))) Einwendungen gegen die Abrechnung erheben.",
                  "§ 556 Abs. 3 Satz 5 und 6 BGB")
        }
    }

    private static func pruefeEinheiten(_ bestand: Objektbestand, _ melde: Melder) {
        guard !bestand.einheiten.isEmpty else {
            melde(.fehler, "Keine Einheiten erfasst",
                  "Ohne Wohneinheiten lässt sich kein Verteilerschlüssel bilden.",
                  "§ 556a BGB")
            return
        }

        let ohneFlaeche = bestand.einheiten.filter { $0.wohnflaeche <= 0 }
        if !ohneFlaeche.isEmpty {
            let namen = ohneFlaeche.map(\.bezeichnung).joined(separator: ", ")
            melde(.fehler, "Wohnfläche fehlt",
                  "Für \(namen) ist keine Wohnfläche hinterlegt. Die Wohnfläche ist der gesetzliche Auffangschlüssel.",
                  "§ 556a Abs. 1 Satz 1 BGB")
        }

        let summeFlaechen = bestand.summeWohnflaechen
        let gesamt = bestand.objekt.wohnflaecheGesamt
        if gesamt > 0, abs(gesamt - summeFlaechen) / gesamt > 0.005 {
            melde(.warnung, "Wohnflächen stimmen nicht überein",
                  "Die Summe der Einheiten beträgt \(Geld.zahl(summeFlaechen)) m², im Objekt sind \(Geld.zahl(gesamt)) m² hinterlegt. Abweichungen führen dazu, dass zu viel oder zu wenig umgelegt wird.",
                  "§ 556a Abs. 1 BGB")
        }

        let mea = bestand.einheiten.map(\.mea).summe
        if bestand.einheiten.contains(where: { $0.mea > 0 }),
           abs(mea - 1000) > 0.5, abs(mea - 100) > 0.5, abs(mea - 10000) > 0.5 {
            melde(.hinweis, "Miteigentumsanteile prüfen",
                  "Die Miteigentumsanteile summieren sich auf \(Geld.zahl(mea)). Übliche Bezugsgrößen sind 100, 1.000 oder 10.000.",
                  "Teilungserklärung")
        }
    }

    private static func pruefeMietverhaeltnisse(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum, _ melde: Melder) {
        let imZeitraum = bestand.mietverhaeltnisse.filter {
            Datum.ueberschneidungTage($0.von, $0.ende(spaetestens: periode.bis), periode.von, periode.bis) > 0
        }

        guard !imZeitraum.isEmpty else {
            melde(.fehler, "Kein Mietverhältnis im Abrechnungszeitraum",
                  "Es gibt niemanden, für den abgerechnet werden könnte.",
                  "§ 556 BGB")
            return
        }

        for mv in imZeitraum {
            if mv.mieterName.isEmpty {
                melde(.fehler, "Mietername fehlt",
                      "Die Abrechnung muss an einen namentlich bestimmten Mieter gerichtet sein.",
                      "§ 259 BGB")
            }
            let vorauszahlung = mv.vzModus == .gesamt
                ? mv.vzGesamtBetriebskosten + mv.vzGesamtHeizkosten
                : mv.vzBetriebskostenMonat + mv.vzHeizkostenMonat
            if vorauszahlung == 0 {
                let name = mv.mieterName.isEmpty ? "unbenanntem Mieter" : mv.mieterName
                melde(.warnung, "Keine Vorauszahlungen bei \(name)",
                      "Der Abzug der geleisteten Vorauszahlungen gehört zu den formellen Mindestangaben. Sind tatsächlich keine vereinbart, ist das in Ordnung – sonst nachtragen.",
                      "BGH VIII ZR 84/07")
            }
            if bestand.einheit(mv.einheitId) == nil {
                melde(.fehler, "Mietverhältnis \(mv.mieterName) ohne Einheit",
                      "Dem Mietverhältnis ist keine gültige Wohneinheit zugeordnet.", "")
            }
        }

        // Nutzerwechsel innerhalb einer Einheit
        var jeEinheit: [String: Int] = [:]
        for mv in imZeitraum { jeEinheit[mv.einheitId, default: 0] += 1 }
        for (einheitId, anzahl) in jeEinheit where anzahl > 1 {
            let name = bestand.einheit(einheitId)?.bezeichnung ?? einheitId
            melde(.warnung, "Nutzerwechsel in \(name)",
                  "Bei einem Nutzerwechsel ist eine Zwischenablesung der Verbrauchserfassungsgeräte vorzunehmen. Ohne Zwischenablesung wird der Verbrauch hier nur zeitanteilig geschätzt.",
                  "§ 9b HeizkostenV")
        }
    }

    private static func pruefePositionen(
        _ bestand: Objektbestand,
        _ periode: Abrechnungszeitraum,
        _ ergebnis: Abrechnung.Ergebnis?,
        _ melde: Melder
    ) {
        guard !periode.positionen.isEmpty else {
            melde(.fehler, "Keine Kostenpositionen erfasst",
                  "Ohne Gesamtkosten kann keine Abrechnung erstellt werden.",
                  "BGH VIII ZR 84/07")
            return
        }

        let privilegEnde = Datum.tagesnummer("2024-06-30") ?? 0
        let zeitraumEnde = Datum.tagesnummer(periode.bis) ?? 0

        for p in periode.positionen {
            let name = p.anzeigename
            guard let art = p.art else {
                melde(.warnung, "Kostenart unbekannt: \(name)",
                      "Die Position ist keiner Kostenart zugeordnet und wird nicht umgelegt.",
                      "§ 2 BetrKV")
                continue
            }

            if p.betragBrutto <= 0 {
                melde(.hinweis, "Position ohne Betrag: \(name)", "Die Position wirkt sich nicht aus.", "")
            }
            if p.abzugBetrag > 0 && p.abzugGrund.isEmpty {
                melde(.warnung, "Abzug ohne Begründung: \(name)",
                      "Der herausgerechnete nicht umlagefähige Anteil sollte begründet werden, damit die Abrechnung nachvollziehbar bleibt.",
                      "§ 259 BGB")
            }
            if p.abzugBetrag > p.betragBrutto {
                melde(.fehler, "Abzug größer als Betrag: \(name)",
                      "Der nicht umlagefähige Abzug übersteigt die Gesamtkosten der Position.", "")
            }
            if p.kostenartId == "sonstige" && p.istUmlagefaehig && !p.imMietvertragVereinbart {
                melde(.fehler, "Sonstige Betriebskosten nicht vereinbart: \(name)",
                      "Kosten nach § 2 Nr. 17 BetrKV dürfen nur umgelegt werden, wenn die konkrete Kostenart im Mietvertrag ausdrücklich benannt ist. Eine Sammelklausel genügt nicht.",
                      "§ 2 Nr. 17 BetrKV, BGH VIII ZR 137/09")
            }
            if p.kostenartId == "antenne_breitband" && p.istUmlagefaehig && zeitraumEnde > privilegEnde {
                melde(.warnung, "Breitband- und TV-Kosten nach dem 30.06.2024: \(name)",
                      "Das Nebenkostenprivileg für Kabel-TV-Sammelverträge ist zum 30.06.2024 entfallen. Umlagefähig bleiben nur der Betrieb einer eigenen Gemeinschaftsantennenanlage sowie das Glasfaser-Bereitstellungsentgelt unter den Voraussetzungen des § 72 TKG.",
                      "§ 2 Nr. 15 BetrKV, § 72 TKG")
            }
            if p.kostenartId == "hauswart" && p.istUmlagefaehig && p.abzugBetrag <= 0 {
                melde(.warnung, "Hauswartkosten ohne Abzug",
                      "Anteile für Instandhaltung, Instandsetzung, Erneuerung, Schönheitsreparaturen und Verwaltung sind aus den Hauswartkosten herauszurechnen. Ohne Abzug ist die gesamte Position angreifbar.",
                      "§ 2 Nr. 14 BetrKV")
            }
            if Katalog.heizarten.contains(p.kostenartId) {
                melde(.hinweis, "Heizkostenposition außerhalb der HeizkostenV-Rechnung: \(name)",
                      "Heiz- und Warmwasserkosten werden im Bereich „Heizung & Warmwasser“ abgerechnet. Diese Position wird nicht umgelegt, um Doppelerfassungen zu vermeiden.",
                      "§§ 6–9 HeizkostenV")
            }
            if p.schluessel == .direkt && p.direktEinheitId.isEmpty {
                melde(.fehler, "Direktzuordnung ohne Einheit: \(name)",
                      "Bei Direktzuordnung muss eine Einheit ausgewählt sein.", "")
            }
            _ = art
        }

        // Verbrauchsschlüssel ohne Verbrauchswerte
        let verbrauchsPositionen = periode.positionen.filter { $0.istUmlagefaehig && $0.schluessel == .verbrauchWasser }
        if !verbrauchsPositionen.isEmpty {
            let werte = periode.verbraeuche.filter { $0.art == .kaltwasser && $0.wert > 0 }
            if werte.isEmpty {
                melde(.fehler, "Verbrauchsschlüssel ohne Zählerstände",
                      "Es sind Positionen nach Wasserverbrauch angelegt, aber keine Verbräuche erfasst. Bitte Verbräuche eintragen oder auf einen anderen Schlüssel wechseln.",
                      "§ 556a Abs. 1 Satz 2 BGB")
            }
        }

        // Hinweise aus der Verteilung übernehmen
        for eintrag in ergebnis?.verteilungen ?? [] {
            for hinweis in eintrag.verteilung.hinweise {
                melde(.warnung, "Verteilung: \(eintrag.position.anzeigename)", hinweis, "")
            }
        }

        melde(.hinweis, "Wirtschaftlichkeitsgebot beachten",
              "Der Vermieter darf nur Kosten umlegen, die bei wirtschaftlicher Betrachtung erforderlich waren. Auffällig teure Positionen sollten belegbar begründet sein.",
              "§ 556 Abs. 3 Satz 1 Halbsatz 2 BGB")
        _ = bestand
    }

    private static func pruefeHeizung(_ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis?, _ melde: Melder) {
        let h = periode.heizung
        guard h.aktiv else {
            melde(.hinweis, "Keine Heizkostenabrechnung",
                  "Es werden keine Heiz- und Warmwasserkosten abgerechnet. Bei zentraler Versorgung ist die Heizkostenverordnung zwingend anzuwenden.",
                  "§ 1 HeizkostenV")
            return
        }

        if !Heizkosten.verbrauchsanteilZulaessig(h.anteilVerbrauchHeizung) {
            melde(.fehler, "Verbrauchsanteil Heizung unzulässig",
                  "Der Verbrauchsanteil beträgt \(Geld.zahl(h.anteilVerbrauchHeizung * 100, 0)) %. Zulässig sind 50 bis 70 %.",
                  "§ 7 Abs. 1 HeizkostenV")
        }
        if !Heizkosten.verbrauchsanteilZulaessig(h.anteilVerbrauchWarmwasser) {
            melde(.fehler, "Verbrauchsanteil Warmwasser unzulässig",
                  "Der Verbrauchsanteil beträgt \(Geld.zahl(h.anteilVerbrauchWarmwasser * 100, 0)) %. Zulässig sind 50 bis 70 %.",
                  "§ 8 Abs. 1 HeizkostenV")
        }

        if !h.verbrauchserfassung {
            melde(.warnung, "Keine verbrauchsabhängige Abrechnung",
                  "Es wird rein nach Fläche abgerechnet. Der Mieter darf seinen Anteil um 15 % kürzen; die Kürzung ist in dieser Abrechnung bereits berücksichtigt.",
                  "§ 12 Abs. 1 HeizkostenV")
        }

        let heiz = ergebnis?.heizung
        if h.verbunden {
            if heiz == nil || (heiz?.warmwasserAufteilung.anteil ?? 0) <= 0 {
                melde(.fehler, "Warmwasseranteil nicht ermittelt",
                      "Bei einer verbundenen Anlage muss die auf die Warmwasserbereitung entfallende Wärmemenge ermittelt werden – vorrangig durch Messung, ersatzweise nach der Formel Q = 2,5 · V · (tw − 10) / 1000.",
                      "§ 9 Abs. 2 HeizkostenV")
            } else if h.warmwasser.modus == .formel {
                melde(.hinweis, "Warmwasser rechnerisch ermittelt",
                      "Seit dem 31.12.2013 ist die Wärmemenge für Warmwasser grundsätzlich mit einem Wärmemengenzähler zu messen. Die Formelberechnung ist nur ersatzweise zulässig.",
                      "§ 9 Abs. 2 Satz 1 HeizkostenV")
            }
        }

        if let heiz, heiz.bezug.verbrauchHeizungGesamt <= 0, h.verbrauchserfassung {
            melde(.fehler, "Keine Heizverbräuche erfasst",
                  "Ohne erfasste Verbrauchswerte kann der Verbrauchsanteil nicht verteilt werden.",
                  "§ 6 Abs. 1 HeizkostenV")
        }

        let co2Pflichtig: Set<Brennstoff> = [.erdgas, .heizoel, .fluessiggas, .fernwaerme]
        let zeitraumEnde = Datum.tagesnummer(periode.bis) ?? 0
        let co2Start = Datum.tagesnummer("2023-01-01") ?? 0
        if h.kosten.brennstoff > 0, h.co2.kostenCent <= 0, zeitraumEnde >= co2Start, co2Pflichtig.contains(h.brennstoff) {
            melde(.warnung, "CO₂-Kosten nicht aufgeteilt",
                  "Seit dem 01.01.2023 trägt der Vermieter bei Wohngebäuden je nach Emissionskennwert bis zu 95 % der CO₂-Kosten. Die Brennstoffrechnung muss CO₂-Menge und CO₂-Kosten ausweisen; trage sie im Bereich Heizung ein.",
                  "§§ 5–7 CO2KostAufG")
        }
        if let stufe = heiz?.co2.stufe, let heiz {
            melde(.hinweis, "CO₂-Kostenaufteilung angewendet",
                  "Emissionskennwert \(Geld.zahl(heiz.co2.kgProM2, 1)) kg CO₂/m²·a → Stufe \(stufe.nummer): Vermieteranteil \(Geld.zahl(heiz.co2.anteilVermieter * 100, 0)) % (\(Geld.euro(heiz.co2.vermieterCent))).",
                  "Anlage zu § 5 Abs. 1 CO2KostAufG")
        }

        melde(.hinweis, "Abrechnungs- und Verbrauchsinformationen",
              "Bei fernablesbaren Zählern müssen Mieter seit dem 01.12.2021 monatlich über ihren Verbrauch informiert werden. Fehlt die Information, kann der Mieter den Heizkostenanteil um 3 % kürzen.",
              "§ 6a, § 12 Abs. 1 Satz 2 HeizkostenV")
    }

    private static func pruefeErgebnis(_ ergebnis: Abrechnung.Ergebnis?, _ melde: Melder) {
        guard let ergebnis else { return }

        if abs(ergebnis.vermieter.rundungsdifferenz) > 100 {
            melde(.warnung, "Umlageausfall",
                  "\(Geld.euro(ergebnis.vermieter.rundungsdifferenz)) der umlagefähigen Kosten konnten keinem Nutzer zugeordnet werden. Prüfe, ob Bezugsgrößen wie Fläche, Personen und Verbrauch vollständig erfasst sind.",
                  "")
        }

        if ergebnis.vermieter.leerstandsanteil > 0 {
            melde(.hinweis, "Leerstandskosten beim Vermieter",
                  "\(Geld.euro(ergebnis.vermieter.leerstandsanteil)) entfallen auf leerstehende Zeiten und werden nicht auf Mieter umgelegt.",
                  "§ 556 Abs. 1 BGB")
        }

        let mit35a = ergebnis.ergebnisse.filter { $0.paragraph35a.gesamt > 0 }
        if mit35a.isEmpty {
            melde(.hinweis, "Keine Lohnanteile nach § 35a EStG ausgewiesen",
                  "Mieter können haushaltsnahe Dienstleistungen und Handwerkerleistungen steuerlich geltend machen. Erfasse die Lohnanteile bei den betroffenen Positionen, damit sie in der Abrechnung bescheinigt werden.",
                  "§ 35a EStG")
        }

        melde(.hinweis, "Belegeinsicht gewähren",
              "Der Mieter kann Einsicht in die Abrechnungsbelege verlangen. Die Abrechnung sollte einen entsprechenden Hinweis enthalten – er ist im erzeugten Dokument bereits vorgesehen.",
              "§ 259 BGB, BGH VIII ZR 78/05")
    }
}
